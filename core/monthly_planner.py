"""
core/monthly_planner.py
Monthly attendance planning engine for AttendWise v2.
Integrates academic calendar, timetables, live attendance, and user-planned decisions.
"""

import calendar
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from core.calendar_logic import (
    get_effective_timetable_day,
    is_teaching_day,
    is_holiday,
    is_mid_sem_day,
    is_working_saturday,
    is_sunday,
    date_to_str,
)
from core.calendar_config import (
    SEMESTER_START,
    SEMESTER_END,
    HOLIDAYS,
    WORKING_SATURDAYS,
    MID_SEM_DAYS,
)
from core.budget_calculator import BudgetCalculator
from core.priority import compute_priority


DAY_FULL_MAP = {
    "mon": "Mon",
    "tue": "Tue",
    "wed": "Wed",
    "thu": "Thu",
    "fri": "Fri",
    "sat": "Sat",
    "sun": "Sun",
}

HOLIDAY_NAMES = {
    "2026-01-14": "Makar Sankranti",
    "2026-01-26": "Republic Day",
    "2026-03-04": "Holi",
    "2026-03-20": "Eid ul Fitr",
    "2026-03-27": "Ram Navmi",
    "2026-04-14": "Dr. Ambedkar Jayanti",
    "2026-05-27": "Bakrid",
    "2026-08-15": "Independence Day",
    "2026-10-02": "Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-08": "Diwali",
    "2026-11-24": "Guru Nanak Jayanti",
    "2026-12-25": "Christmas",
}


def _match_code(code1: str, code2: str) -> bool:
    """Compare subject codes ignoring case and hyphens."""
    c1 = str(code1 or "").strip().upper()
    c2 = str(code2 or "").strip().upper()
    return c1 == c2 or c1.replace("-", "") == c2.replace("-", "")


def get_non_teaching_reason(date_obj: datetime, date_str: str) -> Optional[str]:
    """Get the specific reason why a date is not a regular teaching day."""
    if date_str in HOLIDAYS:
        return f"Holiday — {HOLIDAY_NAMES.get(date_str, 'Official Holiday')}"
    if date_str in MID_SEM_DAYS:
        return "Mid-Sem Examination"
    if is_sunday(date_obj):
        return "Weekend (Sunday)"
    if date_obj.weekday() == 5 and not is_working_saturday(date_obj):
        return "Weekend (Saturday)"
    if date_obj < SEMESTER_START or date_obj > SEMESTER_END:
        return "Outside Active Semester"
    return None


def get_month_calendar_data(
    year: int,
    month: int,
    timetable_data: Dict[str, Any],
    user_plans: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build complete calendar days structure for a given month and year.
    Returns array of days with timetable slots and existing user plans.
    """
    num_days = calendar.monthrange(year, month)[1]
    today = datetime.now()
    today_date = today.date()

    days_data = []

    for day_num in range(1, num_days + 1):
        date_obj = datetime(year, month, day_num)
        date_str = date_to_str(date_obj)
        date_val = date_obj.date()

        is_past = date_val < today_date
        is_today = date_val == today_date

        effective_day = get_effective_timetable_day(date_obj)
        is_teaching = effective_day is not None
        reason = get_non_teaching_reason(date_obj, date_str)

        # Working Saturday note
        note = None
        if is_working_saturday(date_obj):
            mapped_day = WORKING_SATURDAYS.get(date_str, "")
            note = f"Working Saturday (follows {mapped_day} timetable)"

        # Scheduled classes
        classes = []
        if effective_day:
            day_key = DAY_FULL_MAP.get(effective_day, date_obj.strftime("%a"))
            slots = timetable_data.get(day_key, [])
            for idx, slot in enumerate(slots):
                classes.append({
                    "slot_index": idx,
                    "time": slot.get("time", ""),
                    "subject_code": slot.get("subject_code", ""),
                    "subject_name": slot.get("subject_name") or slot.get("subject_code", ""),
                    "type": slot.get("type", "L"),
                    "room": slot.get("room", ""),
                    "faculty": slot.get("faculty", ""),
                })

        # Plan state for this day
        day_plan = user_plans.get(date_str)
        plan_summary = {
            "total_classes": len(classes),
            "planned_attend": 0,
            "planned_skip": 0,
            "mode": "none",  # "all_attend", "all_skip", "custom", "none"
            "is_planned": False,
        }

        if day_plan and classes:
            plan_summary["is_planned"] = True
            mode = day_plan.get("mode", "custom")
            slots_map = day_plan.get("slots", {})

            att_count = 0
            skip_count = 0

            for idx in range(len(classes)):
                action = slots_map.get(str(idx), slots_map.get(idx, "attend"))
                if action in ["bunk", "skip"]:
                    skip_count += 1
                else:
                    att_count += 1

            plan_summary["planned_attend"] = att_count
            plan_summary["planned_skip"] = skip_count

            if skip_count == len(classes) and len(classes) > 0:
                plan_summary["mode"] = "all_skip"
            elif att_count == len(classes) and len(classes) > 0 and mode == "all_attend":
                plan_summary["mode"] = "all_attend"
            else:
                plan_summary["mode"] = "custom"

        days_data.append({
            "date": date_str,
            "day": day_num,
            "weekday": date_obj.strftime("%a"),
            "weekday_full": date_obj.strftime("%A"),
            "is_past": is_past,
            "is_today": is_today,
            "is_teaching": is_teaching,
            "reason": reason,
            "note": note,
            "classes": classes,
            "plan_summary": plan_summary,
            "day_plan": day_plan,
        })

    # Semester navigation constraints
    first_of_month = datetime(year, month, 1)
    last_of_month = datetime(year, month, num_days)

    can_prev = first_of_month > SEMESTER_START
    can_next = last_of_month < SEMESTER_END

    return {
        "year": year,
        "month": month,
        "month_name": calendar.month_name[month],
        "days": days_data,
        "semester_start": SEMESTER_START.strftime("%Y-%m-%d"),
        "semester_end": SEMESTER_END.strftime("%Y-%m-%d"),
        "can_prev": can_prev,
        "can_next": can_next,
    }


def compute_plan_projections(
    summary_records: List[Dict[str, Any]],
    timetable_data: Dict[str, Any],
    user_plans: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Simulate projected attendance based on user-planned decisions on upcoming dates.
    Uses existing attendance figures and updates forecasts using BudgetCalculator.
    """
    today_date = datetime.now().date()

    # Initialize projected stats map for each subject
    projections: Dict[str, Dict[str, Any]] = {}
    for rec in summary_records:
        code = str(rec["code"])
        attended = int(rec.get("attended", 0))
        conducted = int(rec.get("conducted", 0))
        pct = float(rec.get("percentage", 0.0))

        calc = BudgetCalculator(conducted, attended)

        projections[code] = {
            "code": code,
            "subject": rec.get("subject", code),
            "orig_attended": attended,
            "orig_conducted": conducted,
            "orig_percentage": pct,
            "attended": attended,
            "conducted": conducted,
            "percentage": pct,
            "bunk_budget": calc.bunk_budget(),
            "recovery_classes": calc.recovery_classes(),
            "status": rec.get("status", "Safe"),
            "planned_attends": 0,
            "planned_skips": 0,
        }

    total_classes_planned = 0
    total_planned_attend = 0
    total_planned_skip = 0
    unsafe_dates: List[str] = []

    # Iterate through all planned dates
    for date_str, day_data in sorted(user_plans.items()):
        try:
            d_obj = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue

        # Skip past dates (projections only apply to upcoming decisions)
        if d_obj.date() < today_date:
            continue

        effective_day = get_effective_timetable_day(d_obj)
        if not effective_day:
            continue

        day_key = DAY_FULL_MAP.get(effective_day, d_obj.strftime("%a"))
        slots = timetable_data.get(day_key, [])
        if not slots:
            continue

        slots_map = day_data.get("slots", {}) if isinstance(day_data, dict) else day_data
        day_had_unsafe_skip = False

        for idx, slot in enumerate(slots):
            slot_code = str(slot.get("subject_code", "")).strip()
            if not slot_code:
                continue

            # Find matching projection
            target_proj = None
            for p_code, p_data in projections.items():
                if _match_code(p_code, slot_code):
                    target_proj = p_data
                    break

            if not target_proj:
                continue

            action = slots_map.get(str(idx), slots_map.get(idx, "attend"))
            total_classes_planned += 1

            target_proj["conducted"] += 1

            if action in ["bunk", "skip"]:
                total_planned_skip += 1
                target_proj["planned_skips"] += 1

                # Check if this skip makes it unsafe
                temp_pct = (target_proj["attended"] / target_proj["conducted"]) * 100
                if temp_pct < 75.0:
                    day_had_unsafe_skip = True
            else:
                total_planned_attend += 1
                target_proj["attended"] += 1
                target_proj["planned_attends"] += 1

        if day_had_unsafe_skip and date_str not in unsafe_dates:
            unsafe_dates.append(date_str)

    # Re-calculate metrics and labels for all subjects
    total_safe_bunks_left = 0

    for code, p in projections.items():
        c = p["conducted"]
        a = p["attended"]
        p["percentage"] = round((a / c) * 100, 2) if c > 0 else 0.0
        p["delta"] = round(p["percentage"] - p["orig_percentage"], 2)

        calc = BudgetCalculator(c, a)
        p["bunk_budget"] = calc.bunk_budget()
        p["recovery_classes"] = calc.recovery_classes()
        total_safe_bunks_left += p["bunk_budget"]

        # Classification
        if p["percentage"] >= 80.0 and p["bunk_budget"] >= 2:
            p["status"] = "SAFE"
            p["color"] = "text-success"
            p["bg"] = "bg-success/10 border-success/30"
        elif p["percentage"] >= 75.0:
            p["status"] = "RISKY"
            p["color"] = "text-warning"
            p["bg"] = "bg-warning/10 border-warning/30"
        else:
            p["status"] = "MUST ATTEND"
            p["color"] = "text-danger"
            p["bg"] = "bg-danger/10 border-danger/30"

    return {
        "subjects": projections,
        "totals": {
            "total_classes": total_classes_planned,
            "planned_attend": total_planned_attend,
            "planned_skip": total_planned_skip,
            "safe_bunks_left": total_safe_bunks_left,
        },
        "unsafe_dates": unsafe_dates,
    }
