from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.predictor import forecast_all
from core.budget_calculator import BudgetCalculator
from core.what_if import predict_target_date
from pydantic import BaseModel
import pandas as pd

predictor_bp = APIRouter()


class PredictorRequest(BaseModel):
    code: str
    attend: int = 0
    miss: int = 0

@predictor_bp.get("/api/predictor")
def api_predictor(request: Request):
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
    records  = summary.to_dict(orient="records")

    # Timetable for class-count computation
    timetable = TimetableScraper(scraper.session).get_timetable()

    # Calendar-aware forecasts
    forecasts = forecast_all(records, timetable, weeks=8)

    return forecasts


@predictor_bp.post("/api/predictor")
def api_predictor_post(data: PredictorRequest, request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    attendance = AttendanceScraper(scraper.session).get_attendance()
    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })
    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()

    target_clean = str(data.code).strip().upper()
    row = summary[summary["code"].astype(str).str.strip().str.upper() == target_clean]
    if row.empty:
        row = summary[summary["code"].astype(str).str.upper().str.replace("-", "") == target_clean.replace("-", "")]
    if row.empty:
        return Response(content='{"error": "Subject not found"}', media_type="application/json", status_code=404)

    r = row.iloc[0]
    conducted = int(r["conducted"])
    attended = int(r["attended"])
    current_pct = float(r["percentage"])

    new_attended = attended + max(0, data.attend)
    new_conducted = conducted + max(0, data.attend) + max(0, data.miss)
    new_pct = round((new_attended / new_conducted) * 100, 2) if new_conducted > 0 else 0.0

    calc = BudgetCalculator(new_conducted, new_attended, threshold=75.0)
    recovery_needed = calc.recovery_classes()
    bunk_budget = calc.bunk_budget()

    # Timetable for date prediction
    timetable = None
    try:
        user_sess = login_sessions[uid]
        if "timetable" in user_sess:
            timetable = user_sess["timetable"]
        else:
            timetable = TimetableScraper(scraper.session).get_timetable()
            user_sess["timetable"] = timetable
    except Exception:
        pass

    pred = predict_target_date(data.code, recovery_needed, timetable) if recovery_needed > 0 else None

    if new_pct >= 75.0:
        status = "Safe"
        verdict = f"Attendance will be {new_pct}%. You can safely bunk {bunk_budget} more classes."
    else:
        status = "Below Threshold"
        if pred and pred.get("formatted"):
            verdict = f"Attendance will be {new_pct}%. You need to attend {recovery_needed} consecutive classes to recover (target date: {pred['formatted']})."
        else:
            verdict = f"Attendance will be {new_pct}%. You need to attend {recovery_needed} consecutive classes to recover."

    return {
        "current_percentage": current_pct,
        "new_percentage": new_pct,
        "status": status,
        "verdict": verdict,
        "recovery_classes": recovery_needed,
        "recovery_date": pred.get("formatted") if pred else None,
        "days_away": pred.get("days_away") if pred else None,
        "bunk_budget": bunk_budget,
    }

