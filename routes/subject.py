"""
routes/subject_routes.py
GET /api/subject/<code>  — per-subject detail for Subject Detail Page
GET /subject             — renders subject.html (query param: ?code=25CSH-114)
"""

from flask import Blueprint, session, redirect, url_for, jsonify, render_template
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
import pandas as pd

subject_bp = Blueprint("subject", __name__)


@subject_bp.route("/subject")
def subject_page():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("subject.html")


@subject_bp.route("/api/subject/<code>")
def api_subject(code):
    if not session.get("logged_in") or "uid" not in session or session["uid"] not in login_sessions:
        return {"error": "Unauthorized"}, 401
    
    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    attendance = AttendanceScraper(scraper.session).get_attendance()

    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })

    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()

    row = summary[summary["code"] == code]
    if row.empty:
        return jsonify({"error": "Subject not found"}), 404

    r = row.iloc[0]

    return jsonify({
        "code":             r["code"],
        "subject":          r["subject"],
        "conducted":        int(r["conducted"]),
        "attended":         int(r["attended"]),
        "percentage":       float(r["percentage"]),
        "bunk_budget":      int(r["bunk_budget"]),
        "recovery_classes": int(r["recovery_classes"]),
        "status":           r["status"],
        "medical_leave":    int(r.get("medical_leave", 0)),
        "duty_leave":       int(r.get("duty_leave", 0)),
        "faculty":          "",   # not in attendance scraper; timetable can enrich this later
    })