import json
import pandas as pd

import analytics.attendance_analyzer

print(
    analytics.attendance_analyzer.__file__
)

from analytics.attendance_analyzer import (
    AttendanceAnalyzer
)

with open(
    "data/attendance.json",
    "r",
    encoding="utf-8"
) as f:

    attendance = json.load(f)

df = pd.DataFrame(attendance)

df = df.rename(
    columns={
        "Code": "code",
        "Total_Delv": "total",
        "Total_Attd": "attended"
    }
)
print(df.columns.tolist())

print(
    df[
        [
            "code",
            "total",
            "attended",
            "EligibilityDelivered",
            "EligibilityAttended",
            "EligibilityPercentage"
        ]
    ].head()
)

print("\nFIRST ROW\n")
print(df.iloc[0].to_dict())

analyzer = AttendanceAnalyzer(
    df
)

result = analyzer.compute_summary()

print(result.to_string())