from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.weekly_analytics import day_workload, day_risk_map, upcoming_week
import pandas as pd

weekly_bp = APIRouter()

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

    # Analytics
    return {
        "workload":  day_workload(timetable),
        "risk_map":  day_risk_map(timetable, records),
        "upcoming":  upcoming_week(timetable, records),
    }
