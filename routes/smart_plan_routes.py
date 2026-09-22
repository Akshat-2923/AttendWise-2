import datetime
from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.class_verdict import classify_class
from core.daily_verdict import daily_verdict
import pandas as pd

smart_plan_bp = APIRouter()

DAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

@smart_plan_bp.get("/api/smart-plan")
def api_smart_plan(request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    # ── Attendance summary (code -> stats) ──
    attendance = AttendanceScraper(scraper.session).get_attendance()
    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })
    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()
    summary_map = {row["code"]: row for _, row in summary.iterrows()}

    # ── Today's timetable ──
    timetable = TimetableScraper(scraper.session).get_timetable()
    today_key = DAY_MAP[datetime.datetime.now().weekday()]
    today_slots = timetable.get(today_key, [])

    # ── Build per-class verdicts ──
    classes = []
    for slot in today_slots:
        code = slot.get("subject_code")
        row  = summary_map.get(code)

        if row is None:
            # No attendance data for this subject yet
            classes.append({
                "time":      slot.get("time"),
                "subject":   slot.get("subject_name") or code,
                "code":      code,
                "type":      slot.get("type"),
                "room":      slot.get("room"),
                "faculty":   slot.get("faculty"),
                "status":    "RISKY",
                "percent":   0.0,
                "bunk_budget": 0,
            })
            continue

        attended  = int(row["attended"])
        conducted = int(row["conducted"])
        is_lab    = slot.get("type") == "P"

        verdict = classify_class(attended, conducted, is_lab=is_lab)

        classes.append({
            "time":         slot.get("time"),
            "subject":      row["subject"],
            "code":         code,
            "type":         slot.get("type"),
            "room":         slot.get("room"),
            "faculty":      slot.get("faculty"),
            "status":       verdict["status"],
            "percent":      verdict["percent"],
            "bunk_budget":  verdict["bunk_budget"],
        })

    # Sort by time
    def time_to_min(t):
        import re
        m = re.match(r"(\d+):(\d+)", t or "")
        if not m:
            return 0
        h, mi = int(m.group(1)), int(m.group(2))
        if "PM" in t and h != 12:
            h += 12
        if "AM" in t and h == 12:
            h = 0
        return h * 60 + mi

    classes.sort(key=lambda c: time_to_min(c["time"]))

    # ── Overall daily verdict (voting) ──
    verdict = daily_verdict(classes) if classes else {
        "status": "NO CLASSES",
        "reason": "No classes scheduled today."
    }

    return {
        "day":           today_key,
        "classes":       classes,
        "daily_verdict": verdict,
    }