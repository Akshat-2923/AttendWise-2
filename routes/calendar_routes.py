from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from datetime import datetime, timedelta
from services.student_data_service import StudentDataService
from core.sessions import login_sessions

calendar_bp = Blueprint("calendar", __name__)

CACHE_TTL = timedelta(hours=1)

@calendar_bp.route("/calendar")
def calendar_view():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("calendar.html")

@calendar_bp.route("/api/calendar/history")
def api_calendar_history():
    if not session.get("logged_in"):
        return jsonify({"error": "Unauthorized"}), 401

    uid = session.get("uid")
    if uid not in login_sessions:
        return jsonify({"error": "Session expired", "redirect": "/login"}), 401
    
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"
    user_session_data = login_sessions[uid]
    
    # Check if we have valid cached history server-side
    cached_history = user_session_data.get("calendar_cache")
    if not force_refresh and cached_history:
        # Check TTL
        if datetime.now() - cached_history["timestamp"] < CACHE_TTL:
            return jsonify({
                "data": cached_history["data"],
                "last_sync": cached_history["last_sync"]
            })

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
        
        return jsonify({
            "data": history,
            "last_sync": sync_time
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
