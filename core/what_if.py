"""
core/what_if.py
What-If simulation engine for AttendWise v2.

Computes the result of attending or missing the next N classes.
Reuses existing recovery math from BudgetCalculator.recovery_classes()
and compute_priority()'s bunk_budget — no parallel recomputation.
"""

import math
from core.budget_calculator import BudgetCalculator
from core.priority import compute_priority


def _status_label(percent: float, bunk_budget: int) -> str:
    """Classify result as Safe / Borderline / Danger."""
    if percent >= 80 and bunk_budget >= 2:
        return "Safe"
    elif percent >= 75:
        return "Borderline"
    else:
        return "Danger"


def what_if_attend(attended: int, conducted: int, n: int) -> dict:
    """
    Result after attending the next `n` classes.
    (Both attended and conducted increase by n.)
    """
    new_a = attended + n
    new_c = conducted + n
    return _build_result(attended, conducted, new_a, new_c)


def what_if_miss(attended: int, conducted: int, n: int) -> dict:
    """
    Result after missing the next `n` classes.
    (Only conducted increases by n.)
    """
    new_a = attended
    new_c = conducted + n
    return _build_result(attended, conducted, new_a, new_c)


def what_if_table(attended: int, conducted: int, max_n: int = 20) -> dict:
    """
    Full what-if table for both attend and miss scenarios, n=1..max_n.

    Returns:
      {
        "current": {attended, conducted, percent, bunk_budget, recovery_needed},
        "attend": [result_n1, result_n2, ...],
        "miss":   [result_n1, result_n2, ...],
      }
    """
    current_calc = BudgetCalculator(conducted, attended)
    current_prio = compute_priority(attended, conducted)

    current = {
        "attended":        attended,
        "conducted":       conducted,
        "percent":         current_calc.current_percentage(),
        "bunk_budget":     current_prio["bunk_budget"],
        "recovery_needed": current_calc.recovery_classes(),
    }

    attend_results = []
    miss_results = []

    for n in range(1, max_n + 1):
        attend_results.append(what_if_attend(attended, conducted, n))
        miss_results.append(what_if_miss(attended, conducted, n))

    return {
        "current": current,
        "attend":  attend_results,
        "miss":    miss_results,
    }


def _build_result(
    orig_attended: int,
    orig_conducted: int,
    new_attended: int,
    new_conducted: int,
) -> dict:
    """Build a single what-if result dict using existing math modules."""
    orig_pct = round((orig_attended / orig_conducted) * 100, 2) if orig_conducted > 0 else 0.0
    new_pct  = round((new_attended / new_conducted) * 100, 2) if new_conducted > 0 else 0.0
    delta    = round(new_pct - orig_pct, 2)

    # Reuse BudgetCalculator for recovery math
    calc = BudgetCalculator(new_conducted, new_attended)
    recovery = calc.recovery_classes()

    # Reuse compute_priority for bunk_budget
    prio = compute_priority(new_attended, new_conducted)
    bunk_budget = prio["bunk_budget"]
    if isinstance(bunk_budget, str):
        # "∞" for not-started subjects
        bunk_budget = 0

    status = _status_label(new_pct, bunk_budget)

    return {
        "new_attended":    new_attended,
        "new_conducted":   new_conducted,
        "new_percent":     new_pct,
        "delta":           delta,
        "bunk_budget":     bunk_budget,
        "recovery_needed": recovery,
        "status":          status,
    }
