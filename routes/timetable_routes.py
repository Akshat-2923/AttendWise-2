from core.sessions import login_sessions
from flask import Blueprint, session, redirect, url_for, jsonify
from scrapers.timetable_scraper import TimetableScraper

timetable_bp = Blueprint("timetable", __name__)


@timetable_bp.route("/api/timetable")
def api_timetable():

    if not session.get("logged_in"):
        return redirect(url_for("login"))

    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]

    timetable = (
        TimetableScraper(scraper.session)
        .get_timetable()
    )

    return jsonify(timetable)


@timetable_bp.route("/api/timetable/today")
def api_timetable_today():

    if not session.get("logged_in"):
        return redirect(url_for("login"))

    import datetime

    uid = session["uid"]
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

    return jsonify({
        "day": today,
        "slots": timetable.get(today, [])
    })