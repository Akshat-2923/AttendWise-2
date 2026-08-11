"""Test timetable and subject templates with shared nav."""
from app import app

app.config['SECRET_KEY'] = 'test'
client = app.test_client()

with client.session_transaction() as sess:
    sess['logged_in'] = True
    sess['uid'] = 'test'

resp = client.get('/timetable')
print(f"Timetable: {resp.status_code}")
assert resp.status_code == 200
html = resp.data.decode()
assert 'Predictor' in html, "Predictor nav link missing"
assert 'What-If' in html, "What-If nav link missing"

resp = client.get('/subject?code=25CSH-114')
print(f"Subject: {resp.status_code}")
assert resp.status_code == 200
html = resp.data.decode()
assert 'Predictor' in html, "Predictor nav link missing"

print("All nav migration tests passed!")
