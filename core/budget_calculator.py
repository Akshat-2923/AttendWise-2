"""
core/budget_calculator.py
BudgetCalculator class — bunk budget and recovery math using NumPy.

Demonstrates: OOP, NumPy (np.floor, np.ceil).
"""

import numpy as np


class BudgetCalculator:
    """Calculates bunk budget and recovery classes using NumPy."""

    def __init__(self, conducted: int, attended: int, threshold: float = 75.0):
        self.conducted = conducted
        self.attended = attended
        self.threshold = threshold          # e.g. 75.0
        self._t = threshold / 100.0         # fractional form, e.g. 0.75

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def bunk_budget(self) -> int:
        """
        How many more classes can be skipped while staying >= threshold.
        Uses np.floor((attended - t*conducted) / t).
        Returns 0 if already below threshold.
        """
        if self.conducted == 0:
            return 0  # Not started — no budget to give

        # NumPy floor as required
        raw = np.floor(
            (self.attended - self._t * self.conducted) / self._t
        )
        return int(max(0, raw))

    def recovery_classes(self) -> int:
        """
        How many consecutive classes to attend to reach threshold.
        Uses np.ceil((t*conducted - attended) / (1 - t)).
        Returns 0 if already at or above threshold.
        """
        if self.conducted == 0:
            return 0

        current_pct = (self.attended / self.conducted) * 100
        if current_pct >= self.threshold:
            return 0

        # NumPy ceil as required
        raw = np.ceil(
            (self._t * self.conducted - self.attended) / (1 - self._t)
        )
        return int(max(0, raw))

    def current_percentage(self) -> float:
        """Return current attendance percentage."""
        if self.conducted == 0:
            return 0.0
        return round((self.attended / self.conducted) * 100, 2)

    def __repr__(self):
        return (f"BudgetCalculator(conducted={self.conducted}, "
                f"attended={self.attended}, threshold={self.threshold})")
