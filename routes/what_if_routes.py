from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.what_if import what_if_table
from core.budget_calculator import BudgetCalculator
import pandas as pd
from typing import Optional

what_if_bp = APIRouter()

class WhatIfRequest(BaseModel):
    code: str
    target: float = 75.0

@what_if_bp.post("/api/what-if")
def api_what_if_post(data: WhatIfRequest, request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    target_code = data.code
    target_percent = data.target

    attendance = AttendanceScraper(scraper.session).get_attendance()
    
    # find the subject
    subject = next((s for s in attendance if str(s.get("Code", "")) == str(target_code)), None)
    if not subject:
        return Response(content='{"error": "Subject not found"}', media_type="application/json", status_code=404)
    
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
        
    return {
        "current_percentage": current_pct,
        "target_percentage": target_percent,
        "classes_required": classes_needed,
        "verdict": verdict,
        "possible": possible
    }

@what_if_bp.get("/api/what-if")
def api_what_if_get(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
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

    return results
