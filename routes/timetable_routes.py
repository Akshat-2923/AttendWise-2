from fastapi import APIRouter, Request, Response
from core.sessions import login_sessions
from scrapers.timetable_scraper import TimetableScraper
import datetime

timetable_bp = APIRouter()

@timetable_bp.get("/api/timetable")
def api_timetable(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    timetable = (
        TimetableScraper(scraper.session)
        .get_timetable()
    )

    return timetable

@timetable_bp.get("/api/timetable/today")
def api_timetable_today(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)

    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    timetable = (
        TimetableScraper(scraper.session)
        .get_timetable()
    )

    day_map = {
        0: "Mon", 1: "Tue", 2: "Wed",
        3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"
    }

    today = day_map[datetime.datetime.now().weekday()]

    return {
        "day": today,
        "slots": timetable.get(today, [])
    }