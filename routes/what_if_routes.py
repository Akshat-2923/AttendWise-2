from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.what_if import what_if_table, predict_target_date
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
    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })
    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()
    
    # find the subject row matching code (case-insensitive and hyphen-agnostic)
    target_clean = str(target_code).strip().upper()
    row = summary[summary["code"].astype(str).str.strip().str.upper() == target_clean]
    if row.empty:
        row = summary[summary["code"].astype(str).str.upper().str.replace("-", "") == target_clean.replace("-", "")]
    if row.empty:
        return Response(content='{"error": "Subject not found"}', media_type="application/json", status_code=404)
    
    r = row.iloc[0]
    conducted = int(r["conducted"])
    attended = int(r["attended"])
    current_pct = float(r["percentage"])
    
    calc = BudgetCalculator(conducted, attended, threshold=target_percent)
    classes_needed = calc.recovery_classes()
    bunk_budget = calc.bunk_budget()
    
    # Fetch timetable (cached in session when possible)
    timetable = None
    try:
        user_sess = login_sessions[uid]
        if "timetable" in user_sess:
            timetable = user_sess["timetable"]
        else:
            timetable = TimetableScraper(scraper.session).get_timetable()
            user_sess["timetable"] = timetable
    except Exception as e:
        print(f"Warning: Failed to fetch timetable for what-if: {e}")

    # Predict target date based on upcoming teaching days in timetable
    date_pred = predict_target_date(
        subject_code=target_code,
        classes_needed=classes_needed,
        timetable_data=timetable,
    )

    possible = target_percent <= 100
    predicted_date_str = None
    days_away = None

    if classes_needed == 0:
        if target_percent <= 100:
            verdict = f"You are already above {target_percent}%. You can safely bunk {bunk_budget} classes."
            predicted_date_str = "Target already met"
            days_away = 0
        else:
            possible = False
            verdict = "Impossible to reach."
    else:
        if date_pred.get("date"):
            formatted_date = date_pred["formatted"]
            verdict = f"You need to attend {classes_needed} consecutive classes to reach {target_percent}%. Target achievable by {formatted_date}."
            predicted_date_str = formatted_date
            days_away = date_pred.get("days_away")
        else:
            if not date_pred.get("achievable"):
                possible = False
                verdict = f"You need to attend {classes_needed} consecutive classes to reach {target_percent}%, but not enough classes are scheduled this semester."
                predicted_date_str = "Not achievable"
            else:
                verdict = f"You need to attend {classes_needed} consecutive classes to reach {target_percent}%."
                predicted_date_str = None
        
    return {
        "current_percentage": current_pct,
        "target_percentage": target_percent,
        "classes_required": classes_needed,
        "verdict": verdict,
        "possible": possible,
        "predicted_date": predicted_date_str,
        "days_away": days_away,
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
