"""
routes/health_routes.py
/api/health  — returns the computed Health Score Card data
"""

from flask import Blueprint, session, redirect, url_for, jsonify

from scrapers.attendance_scraper import AttendanceScraper
from analytics.attendance_analyzer import AttendanceAnalyzer
from analytics.health_score import HealthScoreCalculator
from core.sessions import login_sessions

import pandas as pd

health_bp = Blueprint("health", __name__)


