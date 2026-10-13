from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
from core.what_if import predict_target_date
import pandas as pd

subject_bp = APIRouter()

@subject_bp.get("/api/subject/{code}")
def api_subject(code: str, request: Request):
    if not request.session.get("logged_in") or "uid" not in request.session or request.session["uid"] not in login_sessions:
        return Response(content='{"error": "Unauthorized"}', media_type="application/json", status_code=401)
    
    uid = request.session["uid"]
    scraper = login_sessions[uid]["scraper"]

    attendance = AttendanceScraper(scraper.session).get_attendance()

    df = pd.DataFrame(attendance).rename(columns={
        "Code":       "code",
        "Total_Delv": "total",
        "Total_Attd": "attended",
    })

    analyzer = AttendanceAnalyzer(df)
    summary  = analyzer.compute_summary()

    row = summary[summary["code"] == code]
    if row.empty:
        return Response(content='{"error": "Subject not found"}', media_type="application/json", status_code=404)

    r = row.iloc[0]

    timetable = None
    try:
        user_sess = login_sessions[uid]
        if "timetable" in user_sess:
            timetable = user_sess["timetable"]
        else:
            timetable = TimetableScraper(scraper.session).get_timetable()
            user_sess["timetable"] = timetable
    except Exception:
        pass

    recovery_needed = int(r["recovery_classes"])
    pred = predict_target_date(code, recovery_needed, timetable) if (timetable and recovery_needed > 0) else None

    return {
        "code":             r["code"],
        "subject":          r["subject"],
        "conducted":        int(r["conducted"]),
        "attended":         int(r["attended"]),
        "percentage":       float(r["percentage"]),
        "bunk_budget":      int(r["bunk_budget"]),
        "recovery_classes": recovery_needed,
        "recovery_date":    pred.get("formatted") if pred else None,
        "recovery_days_away": pred.get("days_away") if pred else None,
        "status":           r["status"],
        "medical_leave":    int(r.get("medical_leave", 0)),
        "duty_leave":       int(r.get("duty_leave", 0)),
        "faculty":          "",   
    }