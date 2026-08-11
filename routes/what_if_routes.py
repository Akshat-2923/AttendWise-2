"""
routes/what_if_routes.py
GET /what-if       — renders what_if.html
GET /api/what-if   — per-subject what-if attend/miss tables
"""

from flask import Blueprint, session, redirect, url_for, jsonify, render_template

from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.what_if import what_if_table
import pandas as pd

what_if_bp = Blueprint("what_if", __name__)


@what_if_bp.route("/what-if")
def what_if_page():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("what_if.html")


@what_if_bp.route("/api/what-if")
def api_what_if():
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

    results = []
    for _, row in summary.iterrows():
        attended  = int(row["attended"])
        conducted = int(row["conducted"])

        table = what_if_table(attended, conducted, max_n=20)

        results.append({
            "code":             str(row["code"]),
            "subject":          row["subject"],
            "attended":         attended,
            "conducted":        conducted,
            "percentage":       float(row["percentage"]),
            "status":           row["status"],
            "bunk_budget":      int(row["bunk_budget"]),
            "recovery_classes": int(row["recovery_classes"]),
            "what_if":          table,
        })

    return jsonify(results)
