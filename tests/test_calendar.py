import json
import pytest
from unittest.mock import Mock, patch
from scrapers.attendance_scraper import AttendanceScraper
from app import app
from core.sessions import login_sessions

def test_attendance_scraper_history_parsing():
    # Setup mock session
    mock_session = Mock()
    scraper = AttendanceScraper(mock_session)
    
    # We will mock fetch_attendance_page and extract_uid_and_session
    # and the post requests
    scraper.fetch_attendance_page = Mock(return_value="<html></html>")
    scraper.extract_uid_and_session = Mock(return_value=("mockuid", "mocksession"))
    scraper.get_attendance_page_url = Mock(return_value="http://mock")
    
    # Mock responses
    summary_resp = Mock()
    summary_resp.json.return_value = {
        "d": json.dumps([{"EncryptCode": "ABC", "Code": "CS101", "Title": "Intro"}])
    }
    
    detail_resp = Mock()
    records = [
        {"Date": "18 Sep 2026", "Type": "Lecture", "Time": "10:00 - 11:00 AM", "Attendance": "Present"},
        {"Date": "18 Sep 2026", "Type": "Lecture", "Time": "10:00 - 11:00 AM", "Attendance": "Present"}, # Duplicate
        {"Date": "19 Sep 2026", "Type": "Practical", "Time": "11:00 - 12:00 PM", "Attendance": "Absent"}
    ]
    # Serialized twice as in reality
    detail_resp.json.return_value = {
        "dd": {
            "Result": json.dumps(records)
        }
    }
    
    # Mock post calls side effect
    def post_side_effect(url, **kwargs):
        if "GetReport" in url:
            return summary_resp
        elif "GetFullReport" in url:
            return detail_resp
        return Mock()
        
    mock_session.post.side_effect = post_side_effect
    
    history = scraper.get_attendance_history()
    
    # Assert deduplication and parsing
    assert len(history) == 2
    
    # 18 Sep 2026 -> 2026-09-18
    assert history[0]["date"] == "2026-09-18"
    assert history[0]["status"] == "Present"
    assert history[0]["type"] == "Lecture"
    
    assert history[1]["date"] == "2026-09-19"
    assert history[1]["status"] == "Absent"

@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.secret_key = "test_key"
    with app.test_client() as client:
        yield client

def test_api_calendar_unauthorized(client):
    res = client.get("/api/calendar/history")
    assert res.status_code == 401
    assert b"Unauthorized" in res.data

def test_api_calendar_session_expired(client):
    with client.session_transaction() as sess:
        sess["logged_in"] = True
        sess["uid"] = "invalid_uid"
        
    res = client.get("/api/calendar/history")
    assert res.status_code == 401
    assert b"Session expired" in res.data
