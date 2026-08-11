import os
import warnings

from dotenv import load_dotenv
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    send_file,
    flash,
    send_file
)

from io import BytesIO

from scrapers.login_scraper import LoginScraper
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from routes.timetable_routes import timetable_bp
from core.sessions import login_sessions
from routes.health_routes import health_bp
from routes.subject import subject_bp
from routes.bunk_routes import bunk_bp
from routes.smart_plan_routes import smart_plan_bp
from routes.predictor_routes import predictor_bp
from routes.what_if_routes import what_if_bp
from routes.weekly_routes import weekly_bp
import pandas as pd

# Load .env file (no-op if it doesn't exist)
load_dotenv()

app = Flask(__name__)

app.register_blueprint(timetable_bp)

# --- Secret key from environment ---
_secret = os.environ.get("SECRET_KEY")
if not _secret:
    warnings.warn(
        "SECRET_KEY not set! Using an insecure fallback. "
        "Set SECRET_KEY in your .env file for production.",
        stacklevel=1,
    )
    _secret = "dev-fallback-insecure-key"
app.secret_key = _secret
app.register_blueprint(health_bp)
app.register_blueprint(subject_bp)
app.register_blueprint(bunk_bp)
app.register_blueprint(smart_plan_bp)
app.register_blueprint(predictor_bp)
app.register_blueprint(what_if_bp)
app.register_blueprint(weekly_bp)

@app.route("/service-worker.js")
def service_worker():
    return send_file(
        "static/service-worker.js",
        mimetype="application/javascript",
    )

@app.route("/")
def home():

    return redirect(
        url_for("login")
    )


@app.route(
    "/login",
    methods=["GET", "POST"]
)
def login():

    if request.method == "POST":

        uid = request.form["uid"]

        password = request.form["password"]

        captcha = request.form["captcha"]

        try:

            if uid not in login_sessions:

                flash(
                    "Load captcha first"
                )

                return redirect(
                    url_for("login")
                )

            scraper = login_sessions[
                uid
            ]["scraper"]

            scraper.complete_login(
                uid,
                password,
                captcha
            )
            
            home = scraper.session.get(
                "https://student.culko.in/StudentHome.aspx"
            )

            print("\nAFTER LOGIN URL:")
            print(home.url)
            session["uid"] = uid

            session["logged_in"] = True

            return redirect(
                url_for(
                    "dashboard"
                )
            )

        except Exception as e:

            flash(str(e))

    return render_template(
        "login.html"
    )
@app.route("/captcha")
def captcha():

    uid = request.args.get(
        "uid"
    )

    if not uid:

        return ""

    scraper = LoginScraper()

    image_bytes = scraper.start_login(
        uid
    )

    login_sessions[uid] = {
        "scraper": scraper
    }

    return send_file(
        BytesIO(image_bytes),
        mimetype="image/jpeg"
    )

@app.route("/dashboard")
def dashboard():

    if not session.get(
        "logged_in"
    ):
        return redirect(
            url_for("login")
        )

    summary = session.get(
        "summary",
        []
    )

    return render_template(
        "dashboard.html",
        summary=summary
    )
    
@app.route("/api/attendance")
def api_attendance():

    uid = session["uid"]

    scraper = login_sessions[
        uid
    ]["scraper"]

    try:
        attendance = (
            AttendanceScraper(
                scraper.session
            )
            .get_attendance()
        )
    except Exception as e:
        # ERP session expired — scraper lands on Login.aspx
        # and can't find the attendance link
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
    
    print(df.columns.tolist())
    
    analyzer = AttendanceAnalyzer(
        df
    )
    summary = analyzer.compute_summary()

    return summary.to_dict(
        orient="records"
    )
@app.route("/timetable")
def timetable():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("timetable.html")

if __name__ == "__main__":

    app.run(
        debug=True
    )