"""Verify PWA: manifest, service worker route, templates have PWA tags."""
from app import app

app.config["SECRET_KEY"] = "test"
client = app.test_client()

# 1. Service worker route
resp = client.get("/service-worker.js")
print(f"SW route: {resp.status_code}")
assert resp.status_code == 200
assert b"CACHE_VERSION" in resp.data, "SW content missing"
assert "application/javascript" in resp.content_type

# 2. Manifest accessible
resp = client.get("/static/manifest.json")
print(f"Manifest: {resp.status_code}")
assert resp.status_code == 200

# 3. All templates have PWA head + SW registration
with client.session_transaction() as sess:
    sess["logged_in"] = True
    sess["uid"] = "test"

pages = {
    "/dashboard": "Dashboard",
    "/timetable": "Timetable",
    "/health": "Health",
    "/bunk-calculator": "Bunk Calc",
    "/predictor": "Predictor",
    "/what-if": "What-If",
    "/weekly": "Weekly",
    "/smart-plan": "Smart Plan",
    "/subject?code=25CSH-114": "Subject",
}

for path, name in pages.items():
    resp = client.get(path)
    html = resp.data.decode()
    assert 'manifest.json' in html, f"{name}: manifest link missing"
    assert 'theme-color' in html, f"{name}: theme-color missing"
    assert 'service-worker.js' in html, f"{name}: SW registration missing"
    assert 'apple-mobile-web-app' in html, f"{name}: Apple meta missing"
    print(f"  {name}: PWA tags OK")

# Login page (no auth needed)
resp = client.get("/login")
html = resp.data.decode()
assert 'manifest.json' in html, "Login: manifest link missing"
assert 'service-worker.js' in html, "Login: SW registration missing"
print("  Login: PWA tags OK")

# 4. Route count
rules = [r for r in app.url_map.iter_rules() if not r.rule.startswith("/static")]
print(f"\nTotal routes: {len(rules)}")
for r in sorted(rules, key=lambda r: r.rule):
    print(f"  {r.rule} -> {r.endpoint}")

print("\nAll PWA tests passed!")
