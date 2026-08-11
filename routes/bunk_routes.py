"""
routes/bunk_routes.py
GET /bunk-calculator      — renders bunk_calculator.html
GET /api/bunk-calculator  — returns per-subject bunk data using priority.py logic
"""

from flask import Blueprint, session, redirect, url_for, jsonify, render_template
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.priority import compute_priority
import pandas as pd

bunk_bp = Blueprint("bunk", __name__)


@bunk_bp.route("/bunk-calculator")
def bunk_calculator_page():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("bunk_calculator.html")


@bunk_bp.route("/api/bunk-calculator")
def api_bunk_calculator():
    if not session.get("logged_in"):
        return redirect(url_for("login"))

    uid     = session["uid"]
    scraper = login_sessions[uid]["scraper"]

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

        # Use priority.py logic (is_lab heuristic: practical subjects)
        code    = str(row["code"])
        is_lab  = row.get("type", "") == "P"

        p = compute_priority(attended, conducted, is_lab=is_lab)

        results.append({
            "code":             code,
            "subject":          row["subject"],
            "attended":         attended,
            "conducted":        conducted,
            "percentage":       float(row["percentage"]),
            "bunk_budget":      p["bunk_budget"],
            "recovery_classes": int(row["recovery_classes"]),
            "priority":         p["priority"],
            "status":           row["status"],
        })

    # Sort: Must Attend first, then Attend Carefully, then Bunkable
    order = {"Must Attend": 0, "Attend Carefully": 1, "Bunkable": 2, "Not Started": 3}
    results.sort(key=lambda x: order.get(x["priority"], 99))

    return jsonify(results)