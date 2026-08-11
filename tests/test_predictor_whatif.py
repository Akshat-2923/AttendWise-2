"""Quick smoke test for predictor.py and what_if.py"""
import json
from core.predictor import forecast_subject, count_weekly_classes, forecast_all
from core.what_if import what_if_attend, what_if_miss, what_if_table

# Test count_weekly_classes
tt = json.load(open("data/timetable.json"))
weekly = count_weekly_classes(tt)
print("Weekly classes per subject:")
for k, v in sorted(weekly.items()):
    print(f"  {k}: {v}")

# Test forecast_subject (simulating MTT-108: 42/60, 24 remaining)
print("\n--- Forecast for MTT-108 (42/60, 24 remaining) ---")
f = forecast_subject(42, 60, 24, weeks=8)
print(f"  Current: {f['current']['percent']}%")
print(f"  Attend-All endpoint: {f['attend_all']['endpoint']}%")
print(f"  Strategic endpoint: {f['strategic']['endpoint']}%")
print(f"  Current Pace endpoint: {f['current_pace']['endpoint']}%")
print(f"  Bunk-All endpoint: {f['bunk_all']['endpoint']}%")
print(f"  Weeks to safe: {f['weeks_to_safe']}")
print(f"  Timeline length: {len(f['attend_all']['timeline'])} points")

# Test forecast_all with sample data
print("\n--- forecast_all with sample data ---")
att = json.load(open("data/attendance.json"))
import pandas as pd
from analytics.attendance_analyzer import AttendanceAnalyzer
df = pd.DataFrame(att).rename(columns={"Code": "code", "Total_Delv": "total", "Total_Attd": "attended"})
summary = AttendanceAnalyzer(df).compute_summary()
records = summary.to_dict(orient="records")
results = forecast_all(records, tt, weeks=8)
print(f"Forecasts generated for {len(results)} subjects")
for r in results:
    fc = r["forecast"]
    print(f"  {r['code']}: {r['percentage']}% -> AA:{fc['attend_all']['endpoint']}% / ST:{fc['strategic']['endpoint']}% / BA:{fc['bunk_all']['endpoint']}% | weeks_to_safe={fc['weeks_to_safe']}")

# Test what_if
print("\n--- What-If Tests ---")
r = what_if_attend(42, 60, 5)
print(f"  Attend 5 (42/60): {r['new_percent']}% (delta {r['delta']}%, status: {r['status']}, budget: {r['bunk_budget']}, recovery: {r['recovery_needed']})")

r = what_if_miss(42, 60, 5)
print(f"  Miss 5 (42/60):   {r['new_percent']}% (delta {r['delta']}%, status: {r['status']}, budget: {r['bunk_budget']}, recovery: {r['recovery_needed']})")

t = what_if_table(42, 60, max_n=5)
print(f"  Table: current={t['current']}, attend_rows={len(t['attend'])}, miss_rows={len(t['miss'])}")

print("\nAll tests passed!")
