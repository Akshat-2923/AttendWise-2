"""
services/plan_service.py
Service for persisting and retrieving user monthly attendance plans.
Isolates plans by authenticated User ID (UID) and persists to local JSON storage.
"""

import os
import json
import re
from datetime import datetime
from typing import Optional, Dict, Any

PLANS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "user_plans")
_memory_cache: Dict[str, Dict[str, Any]] = {}


def _get_safe_uid(uid: str) -> str:
    """Sanitize UID for safe file storage."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", str(uid).strip())


def _get_file_path(uid: str) -> str:
    os.makedirs(PLANS_DIR, exist_ok=True)
    return os.path.join(PLANS_DIR, f"{_get_safe_uid(uid)}.json")


class PlanService:
    @staticmethod
    def get_plan(uid: str) -> Dict[str, Any]:
        """Retrieve the saved plan for a user."""
        safe_uid = _get_safe_uid(uid)
        
        # Check memory cache first
        if safe_uid in _memory_cache:
            return _memory_cache[safe_uid]

        file_path = _get_file_path(safe_uid)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    _memory_cache[safe_uid] = data
                    return data
            except Exception as e:
                print(f"Error loading plan file for {safe_uid}: {e}")

        # Default empty plan structure
        empty_plan = {
            "uid": uid,
            "updated_at": None,
            "plans": {},
        }
        _memory_cache[safe_uid] = empty_plan
        return empty_plan

    @staticmethod
    def save_plan(uid: str, plans: Dict[str, Any]) -> Dict[str, Any]:
        """Save entire plans dictionary for a user."""
        safe_uid = _get_safe_uid(uid)
        timestamp = datetime.now().isoformat()

        # Clean/normalize plans dict
        cleaned_plans = {}
        for date_key, day_data in plans.items():
            if not isinstance(date_key, str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", date_key):
                continue
            cleaned_plans[date_key] = day_data

        user_data = {
            "uid": uid,
            "updated_at": timestamp,
            "plans": cleaned_plans,
        }

        _memory_cache[safe_uid] = user_data

        file_path = _get_file_path(safe_uid)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(user_data, f, indent=2)
        except Exception as e:
            print(f"Error writing plan file for {safe_uid}: {e}")

        return user_data

    @staticmethod
    def update_date_plan(uid: str, date_str: str, day_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Update a single date's planning decision for a user."""
        current = PlanService.get_plan(uid)
        plans = current.get("plans", {}).copy()

        if not day_plan or (isinstance(day_plan, dict) and not day_plan.get("slots")):
            # If empty or cleared, remove date
            plans.pop(date_str, None)
        else:
            plans[date_str] = day_plan

        return PlanService.save_plan(uid, plans)

    @staticmethod
    def reset_plan(uid: str, date_str: Optional[str] = None) -> Dict[str, Any]:
        """Reset plan for all dates or a specific date."""
        if date_str:
            return PlanService.update_date_plan(uid, date_str, {})
        else:
            return PlanService.save_plan(uid, {})
