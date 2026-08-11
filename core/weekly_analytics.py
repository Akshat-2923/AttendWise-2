"""
core/weekly_analytics.py
Weekly analytics engine for AttendWise v2.

Combines timetable structure, live attendance data, and the academic calendar
to produce day-of-week workload, risk heatmaps, and upcoming week previews.
"""

from datetime import datetime, timedelta
from core.calendar_logic import (
    get_effective_timetable_day,
    is_holiday,
    is_mid_sem_day,
    is_working_saturday,
    is_sunday,
    date_to_str,
)
from core.calendar_config import HOLIDAYS, WORKING_SATURDAYS, MID_SEM_DAYS
from core.class_verdict import classify_class


DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

# Named holidays for display
HOLIDAY_NAMES = {
    "2026-01-14": "Makar Sankranti",
    "2026-01-26": "Republic Day",
    "2026-03-04": "Holi",
    "2026-03-20": "Eid ul Fitr",
    "2026-03-27": "Ram Navmi",
    "2026-04-14": "Dr. Ambedkar Jayanti",
    "2026-05-27": "Bakrid",
}


def day_workload(timetable_data: dict) -> list[dict]:
    """
    Per-day workload breakdown for Mon–Sat.

    Returns list of dicts sorted Mon→Sat:
      {day, total_classes, lectures, practicals, subjects, hours}
    """
    results = []
    for day in DAYS:
        slots = timetable_data.get(day, [])
        lectures = sum(1 for s in slots if s.get("type") == "L")
        practicals = sum(1 for s in slots if s.get("type") == "P")
        subjects = list({s.get("subject_code") for s in slots if s.get("subject_code")})

        results.append({
            "day": day,
            "total_classes": len(slots),
            "lectures": lectures,
            "practicals": practicals,
            "subjects": subjects,
            "hours": round(len(slots) * 0.83, 1),  # 50-min periods
        })

    return results


def day_risk_map(timetable_data: dict, summary_records: list[dict]) -> list[dict]:
    """
    Cross-references timetable with attendance to produce a per-day risk heatmap.

    summary_records: list of dicts from AttendanceAnalyzer.compute_summary()
                     .to_dict(orient='records')

    Returns list of dicts for Mon–Sat:
      {day, total_classes, must_attend, risky, safe, danger_score,
       heaviest_subject, heaviest_pct}
    """
    # Build lookup: code -> summary row
    code_map = {r["code"]: r for r in summary_records}

    results = []
    for day in DAYS:
        slots = timetable_data.get(day, [])
        must_attend = 0
        risky = 0
        safe = 0
        heaviest_code = None
        heaviest_pct = 100.0

        # Get unique subject codes on this day
        seen_codes = set()
        for slot in slots:
            code = slot.get("subject_code")
            if not code or code in seen_codes:
                continue
            seen_codes.add(code)

            row = code_map.get(code)
            if row is None:
                must_attend += 1
                continue

            pct = float(row.get("percentage", 0))
            if pct < 75:
                must_attend += 1
            elif pct < 80:
                risky += 1
            else:
                safe += 1

            if pct < heaviest_pct:
                heaviest_pct = pct
                heaviest_code = code

        danger_score = must_attend * 3 + risky * 1

        heaviest_name = ""
        if heaviest_code and heaviest_code in code_map:
            heaviest_name = code_map[heaviest_code].get("subject", heaviest_code)

        results.append({
            "day": day,
            "total_classes": len(slots),
            "must_attend": must_attend,
            "risky": risky,
            "safe": safe,
            "danger_score": danger_score,
            "heaviest_subject": heaviest_name,
            "heaviest_pct": round(heaviest_pct, 2) if heaviest_code else None,
        })

    return results


def upcoming_week(timetable_data: dict, summary_records: list[dict]) -> list[dict]:
    """
    Calendar-aware next-7-days preview.

    For each of the next 7 calendar days:
      - If teaching day: lists scheduled classes with attendance status + verdict
      - If not: marks reason (Holiday name, Mid-Sem Exam, Weekend)

    Returns list of 7 dicts:
      {date, day_name, day_abbr, is_today, is_teaching, reason, classes}
    """
    code_map = {r["code"]: r for r in summary_records}

    DAY_FULL_MAP = {
        "mon": "Mon", "tue": "Tue", "wed": "Wed",
        "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun",
    }

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    results = []

    for offset in range(7):
        date_obj = today + timedelta(days=offset)
        date_str = date_to_str(date_obj)
        day_name = date_obj.strftime("%A")      # "Monday"
        day_abbr = date_obj.strftime("%a")      # "Mon"
        is_today = offset == 0

        effective_day = get_effective_timetable_day(date_obj)

        if effective_day is None:
            # Not a teaching day — determine reason
            reason = _get_non_teaching_reason(date_obj, date_str)
            results.append({
                "date": date_str,
                "day_name": day_name,
                "day_abbr": day_abbr,
                "is_today": is_today,
                "is_teaching": False,
                "reason": reason,
                "classes": [],
            })
        else:
            # Teaching day — build class list
            tt_key = DAY_FULL_MAP.get(effective_day, day_abbr)
            slots = timetable_data.get(tt_key, [])

            classes = []
            for slot in slots:
                code = slot.get("subject_code")
                row = code_map.get(code)

                if row is None:
                    classes.append({
                        "time": slot.get("time"),
                        "subject": slot.get("subject_name") or code,
                        "code": code,
                        "type": slot.get("type"),
                        "room": slot.get("room"),
                        "faculty": slot.get("faculty"),
                        "percent": 0.0,
                        "status": "RISKY",
                    })
                    continue

                attended = int(row["attended"])
                conducted = int(row["conducted"])
                is_lab = slot.get("type") == "P"
                verdict = classify_class(attended, conducted, is_lab=is_lab)

                classes.append({
                    "time": slot.get("time"),
                    "subject": row.get("subject", code),
                    "code": code,
                    "type": slot.get("type"),
                    "room": slot.get("room"),
                    "faculty": slot.get("faculty"),
                    "percent": verdict["percent"],
                    "status": verdict["status"],
                })

            # Sort by time
            classes.sort(key=lambda c: _time_to_min(c.get("time", "")))

            note = ""
            if is_working_saturday(date_obj):
                mapped = WORKING_SATURDAYS.get(date_str, "")
                note = f"Working Saturday (follows {mapped} timetable)"

            results.append({
                "date": date_str,
                "day_name": day_name,
                "day_abbr": day_abbr,
                "is_today": is_today,
                "is_teaching": True,
                "reason": note,
                "classes": classes,
            })

    return results


def _get_non_teaching_reason(date_obj: datetime, date_str: str) -> str:
    """Determine why a day is not a teaching day."""
    if date_str in HOLIDAYS:
        name = HOLIDAY_NAMES.get(date_str, "Holiday")
        return f"Holiday — {name}"
    if date_str in MID_SEM_DAYS:
        return "Mid-Sem Examination"
    if is_sunday(date_obj):
        return "Weekend (Sunday)"
    if date_obj.weekday() == 5:
        return "Weekend (Saturday)"
    return "No Classes"


def _time_to_min(t: str) -> int:
    """Parse a time string like '09:30 - 10:20 AM' to minutes for sorting."""
    import re
    m = re.match(r"(\d+):(\d+)", t or "")
    if not m:
        return 0
    h, mi = int(m.group(1)), int(m.group(2))
    if "PM" in t and h != 12:
        h += 12
    if "AM" in t and h == 12:
        h = 0
    return h * 60 + mi
