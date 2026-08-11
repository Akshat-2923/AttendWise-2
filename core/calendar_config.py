"""
core/calendar_config.py
Pure data constants for the academic calendar.

This file holds ONLY dates — no functions, no logic.
Swap this file wholesale when the official academic calendar changes.
If any logic module needs a hardcoded date, it belongs here, not there.
"""

from datetime import datetime

# Semester boundaries
SEMESTER_START = datetime(2026, 1, 5)
SEMESTER_END   = datetime(2026, 5, 5)

# Fixed holidays (no classes)
HOLIDAYS = {
    "2026-01-14",  # Makar Sankranti
    "2026-01-26",  # Republic Day
    "2026-03-04",  # Holi
    "2026-03-20",  # Eid ul Fitr
    "2026-03-27",  # Ram Navmi
    "2026-04-14",  # Dr. Ambedkar Jayanti
    "2026-05-27",  # Bakrid (outside range, safety)
}

# Saturdays that ARE teaching days, mapped to which weekday's timetable to follow
WORKING_SATURDAYS = {
    "2026-01-24": "Monday",
    "2026-01-31": "Wednesday",
    "2026-02-14": "Friday",
    "2026-02-28": "Wednesday",
    "2026-03-14": "Thursday",
    "2026-03-28": "Friday",
    "2026-04-11": "Test",      # Mid-sem test day, not a teaching day
    "2026-04-25": "Tuesday",
}

# Days fully blocked for mid-sem exams (no regular classes)
MID_SEM_DAYS = {
    "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20",
    "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-28",
    "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-11",
}
