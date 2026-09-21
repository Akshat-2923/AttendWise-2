"""
routes/what_if_routes.py
GET /what-if       — renders what_if.html
GET /api/what-if   — per-subject what-if attend/miss tables
"""

from flask import Blueprint, session, redirect, url_for, jsonify, render_template, request

from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.what_if import what_if_table
from core.budget_calculator import BudgetCalculator
import pandas as pd

what_if_bp = Blueprint("what_if", __name__)


@what_if_bp.route("/what-if")
def what_if_page():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("what_if.html")


@what_if_bp.route("/api/what-if", methods=["GET", "POST"])
def api_what_if():
    if not session.get("logged_in") or "uid" not in session or session["uid"] not in login_sessions:
        return {"error": "Unauthorized"}, 401
    
    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    if request.method == "POST":
        data = request.json or {}
        target_code = data.get("code")
        target_percent = float(data.get("target", 75))

        attendance = AttendanceScraper(scraper.session).get_attendance()
        
        # find the subject
        subject = next((s for s in attendance if str(s.get("Code", "")) == str(target_code)), None)
        if not subject:
            return {"error": "Subject not found"}, 404
        
        conducted = int(subject.get("Total_Delv", 0))
        attended = int(subject.get("Total_Attd", 0))
        
        calc = BudgetCalculator(conducted, attended, threshold=target_percent)
        classes_needed = calc.recovery_classes()
        current_pct = calc.current_percentage()
        
        possible = target_percent <= 100
        
        if classes_needed == 0:
            if target_percent <= 100:
                verdict = f"You are already above {target_percent}%. You can safely bunk {calc.bunk_budget()} classes."
            else:
                possible = False
                verdict = "Impossible to reach."
        else:
            verdict = f"You need to attend {classes_needed} consecutive classes to reach {target_percent}%."
            
        return jsonify({
            "current_percentage": current_pct,
            "target_percentage": target_percent,
            "classes_required": classes_needed,
            "verdict": verdict,
            "possible": possible
        })

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
