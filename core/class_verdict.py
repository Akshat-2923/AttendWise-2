"""
core/class_verdict.py
Determines a per-class verdict (MUST ATTEND / RISKY / SAFE) for each
slot in today's timetable, based on that subject's current attendance.

Used by Today's Smart Bunk Plan (#6).
"""

from core.priority import compute_priority


def classify_class(attended: int, conducted: int, is_lab: bool = False) -> dict:
    """
    Returns a per-class verdict using the same priority logic
    as the Bunk Calculator, but mapped to 3 simple bunk-plan states:
        MUST ATTEND, RISKY, SAFE
    """
    p = compute_priority(attended, conducted, is_lab=is_lab)

    priority = p["priority"]

    if priority == "Must Attend":
        status = "MUST ATTEND"
    elif priority == "Attend Carefully":
        status = "RISKY"
    elif priority == "Bunkable":
        status = "SAFE"
    else:
        # Not Started — treat conservatively as RISKY (no data yet)
        status = "RISKY"

    return {
        "status":       status,
        "percent":      p["percent"],
        "bunk_budget":  p["bunk_budget"],
        "needed":       p["needed"],
    }