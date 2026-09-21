import os, glob, re

def fix_auth_checks(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern to match the flawed check and the scraper retrieval
    pattern = r'if not session\.get\([\'"]logged_in[\'"]\):\s*return redirect\(url_for\([\'"]login[\'"]\)\)\s*uid\s*=\s*session\[[\'"]uid[\'"]\]\s*scraper\s*=\s*login_sessions\[uid\]\[[\'"]scraper[\'"]\]'
    
    new_auth_check = """if not session.get("logged_in") or "uid" not in session or session["uid"] not in login_sessions:
        return {"error": "Unauthorized"}, 401
    
    uid = session["uid"]
    scraper = login_sessions[uid]["scraper"]"""

    updated_content = re.sub(pattern, new_auth_check, content)
    
    if updated_content != content:
        with open(filepath, 'w') as f:
            f.write(updated_content)
        print(f'Fixed {filepath}')

for f in glob.glob('routes/*.py'):
    if 'auth_routes' not in f and 'calendar_routes' not in f:
        fix_auth_checks(f)
