from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.predictor import forecast_all
import pandas as pd

predictor_bp = APIRouter()

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
