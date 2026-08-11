"""
core/calendar_logic.py
Calendar-aware teaching-day logic for AttendWise v2.

This file holds ONLY logic. All date constants are imported from
calendar_config.py. If a calendar update requires editing THIS file
instead of calendar_config.py, that's a bug.
"""

from datetime import datetime, timedelta
from core.calendar_config import (
    SEMESTER_START,
    SEMESTER_END,
    HOLIDAYS,
    WORKING_SATURDAYS,
    MID_SEM_DAYS,
)


def date_to_str(date_obj: datetime) -> str:
    """Format a datetime as 'YYYY-MM-DD' for set/dict lookups."""
    return date_obj.strftime("%Y-%m-%d")


def is_sunday(date_obj: datetime) -> bool:
    return date_obj.weekday() == 6


def is_holiday(date_obj: datetime) -> bool:
    return date_to_str(date_obj) in HOLIDAYS


def is_working_saturday(date_obj: datetime) -> bool:
    return (
        date_obj.weekday() == 5
        and date_to_str(date_obj) in WORKING_SATURDAYS
        and WORKING_SATURDAYS[date_to_str(date_obj)] != "Test"
    )


def is_mid_sem_day(date_obj: datetime) -> bool:
    return date_to_str(date_obj) in MID_SEM_DAYS


def is_teaching_day(date_obj: datetime) -> bool:
    """
    A day counts as a teaching day if:
      - within semester range
      - not Sunday
      - not a holiday
      - not a mid-sem block day
      - AND (Mon-Fri OR an approved working Saturday)
    """
    if date_obj < SEMESTER_START or date_obj > SEMESTER_END:
        return False
    if is_sunday(date_obj):
        return False
    if is_holiday(date_obj):
        return False
    if is_mid_sem_day(date_obj):
        return False
    if date_obj.weekday() < 5:
        return True
    if is_working_saturday(date_obj):
        return True
    return False


def get_effective_timetable_day(date_obj: datetime) -> str | None:
    """
    Returns which timetable day (mon/tue/wed/thu/fri/sat) to use for this date.
    Returns None if it's not a teaching day (holiday, Sunday, mid-sem block,
    or a non-working Saturday).
    """
    date_str = date_to_str(date_obj)

    if date_str in WORKING_SATURDAYS:
        mapped = WORKING_SATURDAYS[date_str]
        if mapped == "Test":
            return None
        return mapped[:3].lower()

    if not is_teaching_day(date_obj):
        return None

    return date_obj.strftime("%a").lower()


def get_all_teaching_days(
    start: datetime = None,
    end: datetime = None,
) -> list[datetime]:
    """
    Returns all valid teaching days between start/end (defaults to
    full semester range from calendar_config).
    """
    start = start or SEMESTER_START
    end   = end or SEMESTER_END

    days = []
    current = start
    while current <= end:
        if is_teaching_day(current):
            days.append(current)
        current += timedelta(days=1)

    return days


def count_remaining_classes_per_subject(
    timetable_data: dict,
    from_date: datetime = None,
    weeks: int = 8,
) -> dict[str, int]:
    """
    Walks forward `weeks` from from_date (default: today), counting how many
    times each subject_code appears in the timetable on real teaching days
    (respecting holidays, working Saturdays, mid-sem blocks).

    timetable_data: dict from TimetableScraper.get_timetable()
                     e.g. {"Mon": [...slots...], "Tue": [...], ...}

    Returns: {"25CSH-114": 14, "25MTT-108": 12, ...}
    """
    from_date = from_date or datetime.now()
    end_date  = from_date + timedelta(weeks=weeks)

    # Map lowercase abbreviated day names to timetable dict keys
    day_full_map = {
        "mon": "Mon", "tue": "Tue", "wed": "Wed",
        "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun",
    }

    counts: dict[str, int] = {}
    current = from_date

    while current <= end_date:
        effective_day = get_effective_timetable_day(current)
        if effective_day:
            day_key = day_full_map.get(effective_day)
            slots = timetable_data.get(day_key, [])
            for slot in slots:
                code = slot.get("subject_code")
                if code:
                    counts[code] = counts.get(code, 0) + 1
        current += timedelta(days=1)

    return counts
