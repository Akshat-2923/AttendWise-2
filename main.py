import os
import warnings
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
import pandas as pd

# Import scrapers & logic
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions

# Import API routers
from routes.timetable_routes import timetable_bp
from routes.health_routes import health_bp
from routes.subject import subject_bp
from routes.bunk_routes import bunk_bp
from routes.smart_plan_routes import smart_plan_bp
from routes.predictor_routes import predictor_bp
from routes.what_if_routes import what_if_bp
from routes.weekly_routes import weekly_bp
from routes.calendar_routes import calendar_bp
from routes.auth_routes import auth_bp

load_dotenv()

app = FastAPI(title="AttendWise API")

# Allow cross-origin requests from local Next.js environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Secret key configuration ---
_secret = os.environ.get("SECRET_KEY")
if not _secret:
    warnings.warn(
        "SECRET_KEY not set! Using an insecure fallback. "
        "Set SECRET_KEY in your .env file for production.",
        stacklevel=1,
    )
    _secret = "dev-fallback-insecure-key"

app.add_middleware(
    SessionMiddleware,
    secret_key=_secret,
    session_cookie="session",
    max_age=86400 * 30  # 30 days
)

# --- Register API Routers ---
app.include_router(timetable_bp)
app.include_router(health_bp)
app.include_router(subject_bp)
app.include_router(bunk_bp)
app.include_router(smart_plan_bp)
app.include_router(predictor_bp)
app.include_router(what_if_bp)
app.include_router(weekly_bp)
app.include_router(calendar_bp)
app.include_router(auth_bp)

# --- Core API endpoints ---
@app.get("/api/attendance")
def api_attendance(request: Request):
    if "uid" not in request.session or request.session["uid"] not in login_sessions:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
    except Exception as e:
        # ERP session expired
        request.session.clear()
        login_sessions.pop(uid, None)
        return JSONResponse(
            status_code=401, 
            content={"error": "Session expired. Please log in again.", "redirect": "/login"}
        )

    df = pd.DataFrame(attendance)
    df = df.rename(
        columns={
            "Code": "code",
            "Total_Delv": "total",
            "Total_Attd": "attended"
        }
    )
    
    analyzer = AttendanceAnalyzer(df)
    summary = analyzer.compute_summary()
    return summary.to_dict(orient="records")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
