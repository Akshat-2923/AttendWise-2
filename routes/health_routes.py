"""
routes/health_routes.py
/api/health  — returns the computed Health Score Card data
"""

from flask import Blueprint, session, redirect, url_for, jsonify

from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from analytics.health_score import HealthScoreCalculator
from core.sessions import login_sessions

import pandas as pd

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health")
def api_health():

    if not session.get("logged_in") or "uid" not in session or session["uid"] not in login_sessions:
        return {"error": "Unauthorized"}, 401
    
    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    raw = AttendanceScraper(scraper.session).get_attendance()

    df = pd.DataFrame(raw).rename(columns={
        "Code": "code",
        "Total_Delv": "total",
        "Total_Attd": "attended"
    })

    summary = AttendanceAnalyzer(df).compute_summary()

    result = HealthScoreCalculator().compute(summary)

    return jsonify(result)


@health_bp.route("/health")
def health_page():

    if not session.get("logged_in"):
        return redirect(url_for("login"))

    from flask import render_template
    return render_template("health.html")