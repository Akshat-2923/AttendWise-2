from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import pandas as pd

from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.weekly_analytics import day_workload, day_risk_map, upcoming_week
from core.monthly_planner import get_month_calendar_data, compute_plan_projections, _match_code
from core.calendar_config import SEMESTER_START, SEMESTER_END, HOLIDAYS, WORKING_SATURDAYS, MID_SEM_DAYS
from services.plan_service import PlanService

weekly_bp = APIRouter()


class SavePlanRequest(BaseModel):
    plans: Optional[Dict[str, Any]] = None
    date: Optional[str] = None
    day_plan: Optional[Dict[str, Any]] = None


class ResetPlanRequest(BaseModel):
    date: Optional[str] = None


@weekly_bp.get("/api/weekly")
def api_weekly(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    # Attendance summary
    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
    except Exception:
        request.session.clear()
        login_sessions.pop(uid, None)
        return Response(content='{"error": "Session expired. Please log in again.", "redirect": "/login"}', media_type="application/json", status_code=401)

    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })
    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()
    records  = summary.to_dict(orient="records")

    # Timetable
    timetable = TimetableScraper(scraper.session).get_timetable()

    # User's saved monthly plan
    user_plan = PlanService.get_plan(uid)

    # Projections based on saved plans
    projections = compute_plan_projections(records, timetable, user_plan.get("plans", {}))

    return {
        "workload":  day_workload(timetable),
        "risk_map":  day_risk_map(timetable, records),
        "upcoming":  upcoming_week(timetable, records),
        "saved_plan": user_plan,
        "projections": projections,
        "calendar_info": {
            "semester_start": SEMESTER_START.strftime("%Y-%m-%d"),
            "semester_end": SEMESTER_END.strftime("%Y-%m-%d"),
            "holidays": list(HOLIDAYS),
            "working_saturdays": WORKING_SATURDAYS,
            "mid_sem_days": list(MID_SEM_DAYS),
        }
    }


@weekly_bp.get("/api/weekly/month")
def api_weekly_month(request: Request, year: Optional[int] = None, month: Optional[int] = None):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)

    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    now = datetime.now()
    target_year = year or now.year
    target_month = month or now.month

    # Get timetable and attendance
    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
        df = pd.DataFrame(attendance).rename(columns={
            "Code":       "code",
            "Total_Delv": "total",
            "Total_Attd": "attended",
        })
        analyzer = AttendanceAnalyzer(df)
        summary  = analyzer.compute_summary()
        records  = summary.to_dict(orient="records")
    except Exception:
        request.session.clear()
        login_sessions.pop(uid, None)
        return Response(content='{"error": "Session expired. Please log in again.", "redirect": "/login"}', media_type="application/json", status_code=401)

    timetable = TimetableScraper(scraper.session).get_timetable()
    user_plan = PlanService.get_plan(uid)

    calendar_data = get_month_calendar_data(
        year=target_year,
        month=target_month,
        timetable_data=timetable,
        user_plans=user_plan.get("plans", {}),
    )

    projections = compute_plan_projections(records, timetable, user_plan.get("plans", {}))

    return {
        "calendar": calendar_data,
        "saved_plan": user_plan,
        "projections": projections,
    }


@weekly_bp.get("/api/weekly/today")
def api_weekly_today(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)

    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
        df = pd.DataFrame(attendance).rename(columns={
            "Code":       "code",
            "Total_Delv": "total",
            "Total_Attd": "attended",
        })
        analyzer = AttendanceAnalyzer(df)
        records = analyzer.compute_summary().to_dict(orient="records")
        subject_map = {r["code"]: r for r in records}
    except Exception:
        records = []
        subject_map = {}

    timetable = TimetableScraper(scraper.session).get_timetable()
    user_plan = PlanService.get_plan(uid)

    calendar_data = get_month_calendar_data(
        year=now.year,
        month=now.month,
        timetable_data=timetable,
        user_plans=user_plan.get("plans", {}),
    )

    today_day = next((d for d in calendar_data.get("days", []) if d.get("date") == today_str), None)

    # Enrich today's scheduled classes with live subject metrics
    if today_day and "classes" in today_day:
        for cls in today_day["classes"]:
            sub = subject_map.get(cls["subject_code"])
            if not sub:
                for code, rec in subject_map.items():
                    if _match_code(code, cls["subject_code"]):
                        sub = rec
                        break
            if sub:
                cls["percentage"] = float(sub.get("percentage", 0.0))
                cls["bunk_budget"] = int(sub.get("bunk_budget", 0))
                cls["status"] = sub.get("status", "Safe")
                cls["attended"] = int(sub.get("attended", 0))
                cls["conducted"] = int(sub.get("conducted", 0))

    return {
        "today": today_day,
        "saved_plan": user_plan.get("plans", {}).get(today_str),
        "all_plans": user_plan.get("plans", {}),
        "date_str": today_str,
        "formatted_date": now.strftime("%A, %d %B %Y"),
    }


@weekly_bp.post("/api/weekly/plan")
def api_save_plan(data: SavePlanRequest, request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)

    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    if data.date and data.day_plan is not None:
        updated = PlanService.update_date_plan(uid, data.date, data.day_plan)
    elif data.plans is not None:
        updated = PlanService.save_plan(uid, data.plans)
    else:
        return Response(content='{"error": "Invalid plan payload"}', media_type="application/json", status_code=400)

    # Compute updated projections
    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
        df = pd.DataFrame(attendance).rename(columns={
            "Code":       "code",
            "Total_Delv": "total",
            "Total_Attd": "attended",
        })
        analyzer = AttendanceAnalyzer(df)
        records  = analyzer.compute_summary().to_dict(orient="records")
        timetable = TimetableScraper(scraper.session).get_timetable()
        projections = compute_plan_projections(records, timetable, updated.get("plans", {}))
    except Exception:
        projections = None

    return {
        "success": True,
        "saved_plan": updated,
        "projections": projections,
    }


@weekly_bp.post("/api/weekly/plan/reset")
def api_reset_plan(data: ResetPlanRequest, request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)

    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    updated = PlanService.reset_plan(uid, data.date)

    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
        df = pd.DataFrame(attendance).rename(columns={
            "Code":       "code",
            "Total_Delv": "total",
            "Total_Attd": "attended",
        })
        records = AttendanceAnalyzer(df).compute_summary().to_dict(orient="records")
        timetable = TimetableScraper(scraper.session).get_timetable()
        projections = compute_plan_projections(records, timetable, updated.get("plans", {}))
    except Exception:
        projections = None

    return {
        "success": True,
        "saved_plan": updated,
        "projections": projections,
    }
