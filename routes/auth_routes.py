from flask import Blueprint, request, jsonify, session, send_file
from io import BytesIO
from core.sessions import login_sessions
from scrapers.login_scraper import LoginScraper

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/api/auth/status")
def status():
    return jsonify({
        "logged_in": session.get("logged_in", False),
        "uid": session.get("uid")
    })

@auth_bp.route("/api/auth/captcha")
def captcha():
    uid = request.args.get("uid")
    if not uid:
        return jsonify({"error": "Missing uid"}), 400

    scraper = LoginScraper()
    image_bytes = scraper.start_login(uid)
    login_sessions[uid] = {"scraper": scraper}

    return send_file(BytesIO(image_bytes), mimetype="image/jpeg")

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    if not data:
        return jsonify({"error": "Invalid request"}), 400
        
    uid = data.get("uid")
    password = data.get("password")
    captcha = data.get("captcha")

    if not all([uid, password, captcha]):
        return jsonify({"error": "Missing credentials"}), 400

    if uid not in login_sessions:
        return jsonify({"error": "Load captcha first"}), 400

    scraper = login_sessions[uid]["scraper"]
    
    try:
        scraper.complete_login(uid, password, captcha)
        
        # Verify login by hitting home page
        home = scraper.session.get("https://student.culko.in/StudentHome.aspx")
        
        # Set standard flask session variables (signed cookie)
        session["uid"] = uid
        session["logged_in"] = True
        session.permanent = True
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    uid = session.get("uid")
    if uid and uid in login_sessions:
        login_sessions.pop(uid, None)
    
    session.clear()
    return jsonify({"success": True})
