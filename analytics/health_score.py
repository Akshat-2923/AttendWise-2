"""
analytics/health_score.py
Computes an overall AttendWise Health Score (0–100) from attendance summary.
"""

import pandas as pd


class HealthScoreCalculator:
    """
    Inputs: summary DataFrame from AttendanceAnalyzer.compute_summary()
    Required columns: percentage, status, bunk_budget, recovery_classes, conducted
    """

    THRESHOLD = 75.0

    def compute(self, summary: pd.DataFrame) -> dict:

        if summary.empty:
            return self._empty()

        active = summary[summary["status"] != "Not Started"]

        if active.empty:
            return self._empty()

        # ── Component 1: Average attendance score (0–40 pts) ──────────────
        avg_pct = active["percentage"].mean()
        # Linear scale: 0% → 0 pts, 100% → 40 pts
        avg_score = min((avg_pct / 100) * 40, 40)

        # ── Component 2: Safe subject ratio (0–30 pts) ────────────────────
        total = len(active)
        safe_count = len(active[active["status"] == "Safe"])
        safe_ratio = safe_count / total if total > 0 else 0
        safe_score = safe_ratio * 30

        # ── Component 3: Bunk budget health (0–20 pts) ────────────────────
        # Avg bunk budget across subjects; cap at 10 bunks = full points
        avg_budget = active["bunk_budget"].clip(lower=0).mean()
        budget_score = min((avg_budget / 10) * 20, 20)

        # ── Component 4: No critical subjects (0–10 pts) ──────────────────
        # Deduct points for subjects needing recovery
        critical = active[active["recovery_classes"] > 0]
        critical_ratio = len(critical) / total if total > 0 else 0
        critical_score = (1 - critical_ratio) * 10

        # ── Final score ───────────────────────────────────────────────────
        raw = avg_score + safe_score + budget_score + critical_score
        score = round(min(max(raw, 0), 100), 1)

        grade, label, color = self._grade(score)

        return {
            "score": score,
            "grade": grade,
            "label": label,
            "color": color,
            "breakdown": {
                "avg_attendance": {
                    "value": round(avg_pct, 1),
                    "score": round(avg_score, 1),
                    "max": 40,
                    "label": "Average Attendance"
                },
                "safe_ratio": {
                    "value": f"{safe_count}/{total}",
                    "score": round(safe_score, 1),
                    "max": 30,
                    "label": "Subjects Above 75%"
                },
                "bunk_budget": {
                    "value": round(avg_budget, 1),
                    "score": round(budget_score, 1),
                    "max": 20,
                    "label": "Avg Bunk Budget"
                },
                "no_critical": {
                    "value": f"{total - len(critical)}/{total}",
                    "score": round(critical_score, 1),
                    "max": 10,
                    "label": "Subjects Not in Recovery"
                }
            },
            "stats": {
                "total_subjects": total,
                "safe_subjects": safe_count,
                "at_risk": len(active[active["status"] == "Below Threshold"]),
                "avg_percentage": round(avg_pct, 1),
                "total_bunk_budget": int(active["bunk_budget"].clip(lower=0).sum())
            }
        }

    def _grade(self, score: float):
        if score >= 85:
            return "A", "Excellent", "#22c55e"
        elif score >= 70:
            return "B", "Good", "#84cc16"
        elif score >= 55:
            return "C", "Average", "#f59e0b"
        elif score >= 40:
            return "D", "At Risk", "#f97316"
        else:
            return "F", "Critical", "#ef4444"

    def _empty(self):
        return {
            "score": 0,
            "grade": "N/A",
            "label": "No Data",
            "color": "#6b7280",
            "breakdown": {},
            "stats": {}
        }