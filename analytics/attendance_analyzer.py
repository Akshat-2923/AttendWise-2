"""
core/attendance_analyzer.py
AttendanceAnalyzer class — main engine for computing per-subject stats.
"""

import numpy as np
import pandas as pd

from utils.subject_map import SUBJECT_MAP
from core.budget_calculator import BudgetCalculator


class AttendanceAnalyzer:

    THRESHOLD = 75.0

    def __init__(self, attendance_df: pd.DataFrame):

        self.df = attendance_df.copy()
        self.summary = None

    def compute_summary(self) -> pd.DataFrame:

        rows = []

        for _, row in self.df.iterrows():
        
            code = str(row["code"])

            conducted = int(
                row.get(
                    "EligibilityDelivered",
                    row["total"]
                )
            )

            attended = int(
                row.get(
                    "EligibilityAttended",
                    row["attended"]
                )
            )

            medical_leave = int(
                row.get(
                    "MedicalLeave",
                    0
                )
            )

            duty_leave = (
                int(row.get("DutyLeave", 0))
                + int(row.get("DutyLeave_N_P", 0))
                + int(row.get("DutyLeave_ADL", 0))
                + int(row.get("DutyLeave_Others", 0))
            )

            calc = BudgetCalculator(
                conducted,
                attended,
                self.THRESHOLD
            )

            budget = calc.bunk_budget()

            recovery = calc.recovery_classes()

            pct = float(
                row.get(
                    "EligibilityPercentage",
                    0
                )
            )

            if conducted == 0:

                status = "Not Started"

            elif pct < self.THRESHOLD:

                status = "Below Threshold"

            else:

                status = "Safe"

            title_val = row.get("Title")
            title_str = str(title_val).strip() if title_val is not None else ""
            if not title_str or title_str.lower() in ("nan", "none", "nat"):
                subject_name = SUBJECT_MAP.get_name(code)
            else:
                subject_name = title_str

            rows.append({

                "code":
                    code,

                "subject":
                    subject_name,

                "conducted":
                    conducted,

                "attended":
                    attended,

                "percentage":
                    pct,

                "portal_percentage":
                    pct,

                "medical_leave":
                    medical_leave,

                "duty_leave":
                    duty_leave,

                "bunk_budget":
                    int(budget),

                "recovery_classes":
                    int(recovery),

                "status":
                    status
            })

        self.summary = pd.DataFrame(rows)

        return self.summary

    def get_subject_percentage(
        self,
        subject: str
    ) -> float:

        self._ensure_summary()

        row = self.summary[
            (
                self.summary["subject"]
                == subject
            )
            |
            (
                self.summary["code"]
                == subject
            )
        ]

        if row.empty:
            return 0.0

        return float(
            row.iloc[0]["percentage"]
        )

    def is_below_threshold(
        self,
        subject: str,
        threshold: float = 75.0
    ) -> bool:

        return (
            self.get_subject_percentage(
                subject
            )
            < threshold
        )

    def _ensure_summary(self):

        if self.summary is None:

            self.compute_summary()