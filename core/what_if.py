"""
core/what_if.py
What-If simulation engine for AttendWise v2.

Computes the result of attending or missing the next N classes.
Reuses existing recovery math from BudgetCalculator.recovery_classes()
and compute_priority()'s bunk_budget — no parallel recomputation.
"""

import math
from datetime import datetime, timedelta
import re
from core.budget_calculator import BudgetCalculator
from core.priority import compute_priority
from core.calendar_logic import get_effective_timetable_day


def _status_label(percent: float, bunk_budget: int) -> str:
    """Classify result as Safe / Borderline / Danger."""
    if percent >= 80 and bunk_budget >= 2:
        return "Safe"
    elif percent >= 75:
        return "Borderline"
    else:
        return "Danger"


def what_if_attend(attended: int, conducted: int, n: int) -> dict:
    """
    Result after attending the next `n` classes.
    (Both attended and conducted increase by n.)
    """
    new_a = attended + n
    new_c = conducted + n
    return _build_result(attended, conducted, new_a, new_c)


def what_if_miss(attended: int, conducted: int, n: int) -> dict:
    """
    Result after missing the next `n` classes.
    (Only conducted increases by n.)
    """
    new_a = attended
    new_c = conducted + n
    return _build_result(attended, conducted, new_a, new_c)


def what_if_table(attended: int, conducted: int, max_n: int = 20) -> dict:
    """
    Full what-if table for both attend and miss scenarios, n=1..max_n.

    Returns:
      {
        "current": {attended, conducted, percent, bunk_budget, recovery_needed},
        "attend": [result_n1, result_n2, ...],
        "miss":   [result_n1, result_n2, ...],
      }
    """
    current_calc = BudgetCalculator(conducted, attended)
    current_prio = compute_priority(attended, conducted)

    current = {
        "attended":        attended,
        "conducted":       conducted,
        "percent":         current_calc.current_percentage(),
        "bunk_budget":     current_prio["bunk_budget"],
        "recovery_needed": current_calc.recovery_classes(),
    }

    attend_results = []
    miss_results = []

    for n in range(1, max_n + 1):
        attend_results.append(what_if_attend(attended, conducted, n))
        miss_results.append(what_if_miss(attended, conducted, n))

    return {
        "current": current,
        "attend":  attend_results,
        "miss":    miss_results,
    }


def _build_result(
    orig_attended: int,
    orig_conducted: int,
    new_attended: int,
    new_conducted: int,
) -> dict:
    """Build a single what-if result dict using existing math modules."""
    orig_pct = round((orig_attended / orig_conducted) * 100, 2) if orig_conducted > 0 else 0.0
    new_pct  = round((new_attended / new_conducted) * 100, 2) if new_conducted > 0 else 0.0
    delta    = round(new_pct - orig_pct, 2)

    # Reuse BudgetCalculator for recovery math
    calc = BudgetCalculator(new_conducted, new_attended)
    recovery = calc.recovery_classes()

    # Reuse compute_priority for bunk_budget
    prio = compute_priority(new_attended, new_conducted)
    bunk_budget = prio["bunk_budget"]
    if isinstance(bunk_budget, str):
        # "∞" for not-started subjects
        bunk_budget = 0

    status = _status_label(new_pct, bunk_budget)

    return {
        "new_attended":    new_attended,
        "new_conducted":   new_conducted,
        "new_percent":     new_pct,
        "delta":           delta,
        "bunk_budget":     bunk_budget,
        "recovery_needed": recovery,
        "status":          status,
    }


def _time_to_min(t: str) -> int:
    """Parse time slot string into minutes for time-of-day comparison."""
    m = re.match(r"(\d+):(\d+)", t or "")
    if not m:
        return 0
    h, mi = int(m.group(1)), int(m.group(2))
    if "PM" in t and h != 12:
        h += 12
    if "AM" in t and h == 12:
        h = 0
    return h * 60 + mi


def predict_target_date(
    subject_code: str,
    classes_needed: int,
    timetable_data: dict | None,
    from_date: datetime | None = None,
    max_days: int = 120,
) -> dict:
    """
    Simulate future teaching days using timetable_data and the academic calendar
    to determine the calendar date on which the student will have attended `classes_needed` classes.
    """
    if classes_needed <= 0:
        return {
            "date": None,
            "formatted": "Target already met",
            "days_away": 0,
            "classes_found": 0,
            "achievable": True,
        }

    if not timetable_data:
        return {
            "date": None,
            "formatted": None,
            "days_away": None,
            "classes_found": 0,
            "achievable": True,
        }

    from_date = from_date or datetime.now()
    now_dt = datetime.now()
    current = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_limit = current + timedelta(days=max_days)

    day_full_map = {
        "mon": "Mon", "tue": "Tue", "wed": "Wed",
        "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun",
    }

    norm_target = str(subject_code).strip().upper()
    norm_target_clean = norm_target.replace("-", "")

    attended_counter = 0
    target_date = None

    while current <= end_limit:
        effective_day = get_effective_timetable_day(current)
        if effective_day:
            day_key = day_full_map.get(effective_day)
            slots = timetable_data.get(day_key, [])
            for slot in slots:
                slot_code = str(slot.get("subject_code") or "").strip().upper()
                slot_code_clean = slot_code.replace("-", "")

                if slot_code == norm_target or (slot_code_clean and slot_code_clean == norm_target_clean):
                    # If this class is today, verify if it has already passed
                    if current.date() == now_dt.date():
                        slot_min = _time_to_min(slot.get("time", ""))
                        now_min = now_dt.hour * 60 + now_dt.minute
                        if slot_min > 0 and slot_min < now_min:
                            continue

                    attended_counter += 1
                    if attended_counter >= classes_needed:
                        target_date = current
                        break
            if target_date:
                break
        current += timedelta(days=1)

    if target_date:
        days_away = (target_date.date() - now_dt.date()).days
        return {
            "date": target_date.strftime("%Y-%m-%d"),
            "formatted": target_date.strftime("%a, %d %b %Y"),
            "days_away": days_away,
            "classes_found": attended_counter,
            "achievable": True,
        }
    else:
        return {
            "date": None,
            "formatted": "Not achievable this semester",
            "days_away": None,
            "classes_found": attended_counter,
            "achievable": False,
        }
