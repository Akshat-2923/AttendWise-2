from fastapi import APIRouter, Request, Response
from datetime import datetime, timedelta
from services.student_data_service import StudentDataService
from core.sessions import login_sessions

calendar_bp = APIRouter()

CACHE_TTL = timedelta(hours=1)

@calendar_bp.get("/api/calendar/history")
def api_calendar_history(request: Request, force_refresh: bool = False):
    if not request.session.get("logged_in"):
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)

    uid = request.session.get("uid")
    if not uid or uid not in login_sessions:
        return Response(content='{"error": "Session expired", "redirect": "/login"}', media_type="application/json", status_code=401)
    
    user_session_data = login_sessions[uid]
    
    # Check if we have valid cached history server-side
    cached_history = user_session_data.get("calendar_cache")
    if not force_refresh and cached_history:
        # Check TTL
        if datetime.now() - cached_history["timestamp"] < CACHE_TTL:
            return {
                "data": cached_history["data"],
                "last_sync": cached_history["last_sync"]
            }

    scraper = user_session_data["scraper"]
    
    try:
        service = StudentDataService(scraper.session)
        history = service.get_attendance_history()
        
        # Cache server-side
        sync_time = datetime.now().strftime("%d %b %Y, %I:%M %p")
        user_session_data["calendar_cache"] = {
            "data": history,
            "timestamp": datetime.now(),
            "last_sync": sync_time
        }
        
        return {
            "data": history,
            "last_sync": sync_time
        }
    except Exception as e:
        return Response(content=f'{{"error": "{str(e)}"}}', media_type="application/json", status_code=500)
