from fastapi import APIRouter, Request, Response
from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from core.sessions import login_sessions
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

    return {
        "code":             r["code"],
        "subject":          r["subject"],
        "conducted":        int(r["conducted"]),
        "attended":         int(r["attended"]),
        "percentage":       float(r["percentage"]),
        "bunk_budget":      int(r["bunk_budget"]),
        "recovery_classes": int(r["recovery_classes"]),
        "status":           r["status"],
        "medical_leave":    int(r.get("medical_leave", 0)),
        "duty_leave":       int(r.get("duty_leave", 0)),
        "faculty":          "",   
    }