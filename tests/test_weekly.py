"""Smoke test for weekly_analytics.py and route wiring."""
import json
import pandas as pd
from core.weekly_analytics import day_workload, day_risk_map, upcoming_week
from analytics.attendance_analyzer import AttendanceAnalyzer

# Load sample data
tt = json.load(open("data/timetable.json"))
att = json.load(open("data/attendance.json"))
df = pd.DataFrame(att).rename(columns={"Code": "code", "Total_Delv": "total", "Total_Attd": "attended"})
summary = AttendanceAnalyzer(df).compute_summary()
records = summary.to_dict(orient="records")

# Test day_workload
print("=== Day Workload ===")
wl = day_workload(tt)
for d in wl:
    print(f"  {d['day']}: {d['total_classes']} classes ({d['lectures']}L + {d['practicals']}P) = {d['hours']}h")
total = sum(d["total_classes"] for d in wl)
print(f"  Total weekly classes: {total}")

# Test day_risk_map
print("\n=== Day Risk Map ===")
rm = day_risk_map(tt, records)
for d in rm:
    print(f"  {d['day']}: danger={d['danger_score']} (must={d['must_attend']}, risky={d['risky']}, safe={d['safe']})"
          f" | heaviest: {d['heaviest_subject']} ({d['heaviest_pct']}%)")

# Test upcoming_week
print("\n=== Upcoming Week ===")
uw = upcoming_week(tt, records)
for d in uw:
    tag = "TODAY" if d["is_today"] else ""
    if d["is_teaching"]:
        print(f"  {d['date']} {d['day_abbr']} {tag}: {len(d['classes'])} classes"
              f" {('(' + d['reason'] + ')') if d['reason'] else ''}")
    else:
        print(f"  {d['date']} {d['day_abbr']} {tag}: OFF - {d['reason']}")

# Test Flask app wiring
print("\n=== Flask App ===")
from app import app
app.config["SECRET_KEY"] = "test"
client = app.test_client()

# Unauthenticated should redirect
resp = client.get("/weekly", follow_redirects=False)
print(f"  /weekly (no auth): {resp.status_code}")
assert resp.status_code == 302

# Authenticated template should render
with client.session_transaction() as sess:
    sess["logged_in"] = True
    sess["uid"] = "test"

resp = client.get("/weekly")
print(f"  /weekly (authed): {resp.status_code}")
assert resp.status_code == 200
html = resp.data.decode()
assert "Weekly Analytics" in html, "Page title missing"
assert "Weekly" in html, "Nav link missing"

# All existing pages should have Weekly in nav
for path in ["/dashboard", "/predictor", "/what-if", "/health", "/bunk-calculator", "/smart-plan"]:
    resp = client.get(path)
    assert "Weekly" in resp.data.decode(), f"Weekly nav link missing on {path}"
    print(f"  {path}: nav OK")

print("\nAll tests passed!")
