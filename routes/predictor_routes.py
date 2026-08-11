"""
routes/predictor_routes.py
GET /predictor       — renders predictor.html
GET /api/predictor   — per-subject calendar-aware attendance forecasts
"""

from flask import Blueprint, session, redirect, url_for, jsonify, render_template

from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.predictor import forecast_all
import pandas as pd

predictor_bp = Blueprint("predictor", __name__)


@predictor_bp.route("/predictor")
def predictor_page():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("predictor.html")


@predictor_bp.route("/api/predictor")
def api_predictor():
    if not session.get("logged_in"):
        return redirect(url_for("login"))

    uid     = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    # Attendance summary
    attendance = AttendanceScraper(scraper.session).get_attendance()
    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })
    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()
    records  = summary.to_dict(orient="records")

    # Timetable for class-count computation
    timetable = TimetableScraper(scraper.session).get_timetable()

    # Calendar-aware forecasts
    forecasts = forecast_all(records, timetable, weeks=8)

    return jsonify(forecasts)
