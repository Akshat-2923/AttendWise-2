"""
utils/subject_map.py
SubjectMapper class — wraps the course-code-to-name lookup.
Demonstrates: OOP (encapsulation), basic data structures (dict).
"""


class SubjectMapper:
    """Maps course codes to human-readable subject names."""

    _DEFAULT_MAP = {
        "25CSH-102": "Computer Eco-System",
        "25CSH-114": "Data Structures and Algorithms-I",
        "25CSH-119": "Programming in Python",
        "25CSR-121": "Project Based Learning-II",
        "25CST-116": "Network Security",
        "25CST-123": "English Communication-II",
        "25DCP-151": "Soft Skills-I",
        "25MTT-108": "Linear Algebra and Vector Calculus",
        "25UCT-103": "Universal Human Values",
    }

    def __init__(self, custom_map: dict | None = None):
        """
        Initialise with an optional custom map.
        Falls back to the built-in _DEFAULT_MAP.
        """
        self._map: dict = custom_map if custom_map is not None else dict(self._DEFAULT_MAP)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def get_name(self, code: str) -> str:
        """Return the subject name for a code, or the code itself as fallback."""
        return self._map.get(code, code)

    def get_code(self, name: str) -> str | None:
        """Reverse lookup — returns the code for a given subject name."""
        for code, subject_name in self._map.items():
            if subject_name == name:
                return code
        return None

    def all_codes(self) -> list:
        """Return a list of all known course codes."""
        return list(self._map.keys())

    def all_subjects(self) -> list:
        """Return a list of all known subject names."""
        return list(self._map.values())

    def __len__(self):
        return len(self._map)

    def __repr__(self):
        return f"SubjectMapper(subjects={len(self._map)})"


# Module-level convenience instance (backward-compatible)
SUBJECT_MAP = SubjectMapper()
