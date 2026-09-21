import os
import warnings
from dotenv import load_dotenv
from flask import Flask, session
from flask_cors import CORS

# Import scrapers & logic
from scrapers.login_scraper import LoginScraper
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
import pandas as pd

# Import API blueprints
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

# Load .env file
load_dotenv()

app = Flask(__name__)
# Allow cross-origin requests from local Next.js environment
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# --- Secret key configuration ---
_secret = os.environ.get("SECRET_KEY")
if not _secret:
    warnings.warn(
        "SECRET_KEY not set! Using an insecure fallback. "
        "Set SECRET_KEY in your .env file for production.",
        stacklevel=1,
    )
    _secret = "dev-fallback-insecure-key"
app.secret_key = _secret

# --- Register API Blueprints ---
app.register_blueprint(timetable_bp)
app.register_blueprint(health_bp)
app.register_blueprint(subject_bp)
app.register_blueprint(bunk_bp)
app.register_blueprint(smart_plan_bp)
app.register_blueprint(predictor_bp)
app.register_blueprint(what_if_bp)
app.register_blueprint(weekly_bp)
app.register_blueprint(calendar_bp)
app.register_blueprint(auth_bp)

# --- Legacy core API endpoints (now moved/moving to routes) ---
@app.route("/api/attendance")
def api_attendance():
    if "uid" not in session or session["uid"] not in login_sessions:
        return {"error": "Unauthorized"}, 401

    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    try:
        attendance = AttendanceScraper(scraper.session).get_attendance()
    except Exception as e:
        # ERP session expired
        session.clear()
        login_sessions.pop(uid, None)
        return {"error": "Session expired. Please log in again.", "redirect": "/login"}, 401

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
    app.run(debug=True)