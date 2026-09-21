"""
routes/weekly_routes.py
GET /weekly       — renders weekly.html
GET /api/weekly   — combined weekly analytics (workload + risk + upcoming)
"""

from flask import Blueprint, session, redirect, url_for, jsonify

from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.weekly_analytics import day_workload, day_risk_map, upcoming_week
import pandas as pd

weekly_bp = Blueprint("weekly", __name__)


@weekly_bp.route("/api/weekly")
def api_weekly():
    if not session.get("logged_in") or "uid" not in session or session["uid"] not in login_sessions:
        return {"error": "Unauthorized"}, 401
    
    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    # Attendance summary
    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
    except Exception:
        session.clear()
        login_sessions.pop(uid, None)
        return {"error": "Session expired. Please log in again.", "redirect": "/login"}, 401

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
    return jsonify({
        "workload":  day_workload(timetable),
        "risk_map":  day_risk_map(timetable, records),
        "upcoming":  upcoming_week(timetable, records),
    })
