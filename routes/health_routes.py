from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from analytics.health_score import HealthScoreCalculator
from core.sessions import login_sessions
import pandas as pd

health_bp = APIRouter()

@health_bp.get("/api/health")
def api_health(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    raw = AttendanceScraper(scraper.session).get_attendance()

    df = pd.DataFrame(raw).rename(columns={
        "Code": "code",
        "Total_Delv": "total",
        "Total_Attd": "attended"
    })

    summary = AttendanceAnalyzer(df).compute_summary()

    result = HealthScoreCalculator().compute(summary)

    return result
