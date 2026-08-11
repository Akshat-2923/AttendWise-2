"""Quick test: verify template rendering with shared nav partial."""
from app import app

app.config['SECRET_KEY'] = 'test'
client = app.test_client()

# Test predictor page (should redirect to login since not logged in)
resp = client.get('/predictor', follow_redirects=False)
print(f"Predictor (no auth): {resp.status_code}")
assert resp.status_code == 302, "Should redirect to login"

# Test what-if page
resp = client.get('/what-if', follow_redirects=False)
print(f"What-If (no auth): {resp.status_code}")
assert resp.status_code == 302, "Should redirect to login"

# Test that template rendering works (via login page which doesn't need auth)
resp = client.get('/login')
print(f"Login page: {resp.status_code}")
assert resp.status_code == 200

# Test dashboard redirect
resp = client.get('/dashboard', follow_redirects=False)
print(f"Dashboard (no auth): {resp.status_code}")
assert resp.status_code == 302

# Simulate logged-in session to test template rendering
with client.session_transaction() as sess:
    sess['logged_in'] = True
    sess['uid'] = 'test_user'

# Now predictor page should render (but API calls will fail since no real session)
resp = client.get('/predictor')
print(f"Predictor (authed): {resp.status_code}")
assert resp.status_code == 200
html = resp.data.decode()
assert 'AttendWise' in html, "Nav brand missing"
assert 'Predictor' in html, "Predictor link missing"
assert 'What-If' in html, "What-If link missing"
assert "Today's Plan" in html, "Today's Plan link missing"
assert 'Attendance Predictor' in html, "Page title missing"

resp = client.get('/what-if')
print(f"What-If (authed): {resp.status_code}")
assert resp.status_code == 200
html = resp.data.decode()
assert 'What-If Simulator' in html, "Page title missing"
assert 'AttendWise' in html, "Nav brand missing"

# Test existing pages still render with new nav partial
for path in ['/dashboard', '/bunk-calculator', '/smart-plan', '/health']:
    resp = client.get(path)
    print(f"{path} (authed): {resp.status_code}")
    assert resp.status_code == 200
    html = resp.data.decode()
    assert 'Predictor' in html, f"Predictor nav link missing on {path}"
    assert 'What-If' in html, f"What-If nav link missing on {path}"

print("\nAll template tests passed!")
