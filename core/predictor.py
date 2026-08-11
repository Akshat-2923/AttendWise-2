"""
core/predictor.py
Calendar-aware attendance forecasting engine for AttendWise v2.

Provides per-subject forecasts across 4 scenarios:
  - Attend All:       attend every remaining class
  - Strategic:        attend only when below 75%, re-evaluated per step
  - Current Pace:     continue at current attend rate
  - Bunk All:         miss every remaining class (worst case)

Uses calendar_logic.count_remaining_classes_per_subject() for real
upcoming class counts (holidays, mid-sems, working Sats all excluded).
"""

import math
from datetime import datetime, timedelta
from core.calendar_logic import (
    count_remaining_classes_per_subject,
    get_effective_timetable_day,
)


# ── Helpers ─────────────────────────────────────────────────────────────

def count_weekly_classes(timetable_data: dict) -> dict[str, int]:
    """
    Iterate the timetable dict (keyed by Mon–Sun) and count
    occurrences of each subject_code across all days.

    Example: DSA (25CSH-114) has 3 Lectures + 2 Practicals across
    Mon/Tue/Wed/Fri → returns {"25CSH-114": 5, ...}
    """
    counts: dict[str, int] = {}
    for day_key, slots in timetable_data.items():
        for slot in slots:
            code = slot.get("subject_code")
            if code:
                counts[code] = counts.get(code, 0) + 1
    return counts


# ── Per-subject forecast ────────────────────────────────────────────────

THRESHOLD = 75.0


def _pct(attended: int, conducted: int) -> float:
    """Safe percentage calculation."""
    if conducted == 0:
        return 0.0
    return round((attended / conducted) * 100, 2)


def forecast_subject(
    attended: int,
    conducted: int,
    remaining_classes: int,
    weeks: int = 8,
) -> dict:
    """
    Forecast a single subject across 4 scenarios over `weeks` weeks.

    remaining_classes: total classes left for this subject in the next
                       `weeks` weeks (from calendar_logic).

    Returns dict with:
      - current: {attended, conducted, percent}
      - attend_all: timeline + endpoint
      - strategic: timeline + endpoint
      - current_pace: timeline + endpoint
      - bunk_all: timeline + endpoint
      - weeks_to_safe: int or None (attend-all weeks needed to reach 75%)
    """
    current_pct = _pct(attended, conducted)

    if remaining_classes == 0 or weeks == 0:
        static_point = {
            "week": 0,
            "attended": attended,
            "conducted": conducted,
            "percent": current_pct,
        }
        return {
            "current": {"attended": attended, "conducted": conducted, "percent": current_pct},
            "attend_all":   {"timeline": [static_point], "endpoint": current_pct},
            "strategic":    {"timeline": [static_point], "endpoint": current_pct},
            "current_pace": {"timeline": [static_point], "endpoint": current_pct},
            "bunk_all":     {"timeline": [static_point], "endpoint": current_pct},
            "weeks_to_safe": 0 if current_pct >= THRESHOLD else None,
        }

    # Distribute remaining_classes across weeks (roughly even)
    classes_per_week = [remaining_classes // weeks] * weeks
    leftover = remaining_classes % weeks
    for i in range(leftover):
        classes_per_week[i] += 1

    # Current attend rate for "Current Pace" scenario
    attend_rate = (attended / conducted) if conducted > 0 else 0.5

    # Starting state for each scenario
    aa_a, aa_c = attended, conducted   # Attend All
    st_a, st_c = attended, conducted   # Strategic
    cp_a, cp_c = attended, conducted   # Current Pace
    ba_a, ba_c = attended, conducted   # Bunk All

    # Week 0 = current state
    start = {"week": 0, "attended": attended, "conducted": conducted, "percent": current_pct}
    tl_aa = [start.copy()]
    tl_st = [start.copy()]
    tl_cp = [start.copy()]
    tl_ba = [start.copy()]

    weeks_to_safe = None

    for w in range(1, weeks + 1):
        n = classes_per_week[w - 1]
        if n == 0:
            # No classes this week, carry forward
            tl_aa.append({"week": w, "attended": aa_a, "conducted": aa_c, "percent": _pct(aa_a, aa_c)})
            tl_st.append({"week": w, "attended": st_a, "conducted": st_c, "percent": _pct(st_a, st_c)})
            tl_cp.append({"week": w, "attended": cp_a, "conducted": cp_c, "percent": _pct(cp_a, cp_c)})
            tl_ba.append({"week": w, "attended": ba_a, "conducted": ba_c, "percent": _pct(ba_a, ba_c)})
            continue

        # ── Attend All: attend every class this week ──
        aa_a += n
        aa_c += n

        # ── Strategic: attend only if below 75%, re-evaluated per class ──
        for _ in range(n):
            st_c += 1
            if _pct(st_a, st_c - 1) < THRESHOLD:
                st_a += 1
            # else: skip this class (above 75%)

        # ── Current Pace: attend at historical rate ──
        cp_attend_this_week = round(n * attend_rate)
        cp_a += cp_attend_this_week
        cp_c += n

        # ── Bunk All: miss every class ──
        ba_c += n

        tl_aa.append({"week": w, "attended": aa_a, "conducted": aa_c, "percent": _pct(aa_a, aa_c)})
        tl_st.append({"week": w, "attended": st_a, "conducted": st_c, "percent": _pct(st_a, st_c)})
        tl_cp.append({"week": w, "attended": cp_a, "conducted": cp_c, "percent": _pct(cp_a, cp_c)})
        tl_ba.append({"week": w, "attended": ba_a, "conducted": ba_c, "percent": _pct(ba_a, ba_c)})

        # Track weeks_to_safe (first week attend-all crosses 75%)
        if weeks_to_safe is None and _pct(aa_a, aa_c) >= THRESHOLD:
            weeks_to_safe = w

    # If already safe at start
    if current_pct >= THRESHOLD:
        weeks_to_safe = 0

    return {
        "current": {"attended": attended, "conducted": conducted, "percent": current_pct},
        "attend_all":   {"timeline": tl_aa, "endpoint": tl_aa[-1]["percent"]},
        "strategic":    {"timeline": tl_st, "endpoint": tl_st[-1]["percent"]},
        "current_pace": {"timeline": tl_cp, "endpoint": tl_cp[-1]["percent"]},
        "bunk_all":     {"timeline": tl_ba, "endpoint": tl_ba[-1]["percent"]},
        "weeks_to_safe": weeks_to_safe,
    }


# ── Orchestrator ────────────────────────────────────────────────────────

def forecast_all(
    summary_records: list[dict],
    timetable_data: dict,
    weeks: int = 8,
) -> list[dict]:
    """
    Run forecast_subject for every subject, using calendar-aware class counts.

    summary_records: list of dicts from AttendanceAnalyzer.compute_summary()
                     .to_dict(orient='records')
    timetable_data:  dict from TimetableScraper.get_timetable()

    Returns sorted list (most at-risk subjects first).
    """
    remaining = count_remaining_classes_per_subject(
        timetable_data, from_date=datetime.now(), weeks=weeks
    )

    results = []
    for rec in summary_records:
        code      = rec["code"]
        attended  = int(rec["attended"])
        conducted = int(rec["conducted"])
        rem       = remaining.get(code, 0)

        forecast = forecast_subject(attended, conducted, rem, weeks=weeks)

        results.append({
            "code":              code,
            "subject":           rec.get("subject", code),
            "attended":          attended,
            "conducted":         conducted,
            "percentage":        float(rec.get("percentage", 0)),
            "remaining_classes": rem,
            "status":            rec.get("status", "Unknown"),
            "bunk_budget":       int(rec.get("bunk_budget", 0)),
            "recovery_classes":  int(rec.get("recovery_classes", 0)),
            "forecast":          forecast,
        })

    # Sort: at-risk first (lowest attend-all endpoint), then by current %
    results.sort(key=lambda x: (
        x["forecast"]["attend_all"]["endpoint"],
        x["percentage"],
    ))

    return results
