from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from io import BytesIO
from core.sessions import login_sessions
from scrapers.login_scraper import LoginScraper

auth_bp = APIRouter()

class LoginRequest(BaseModel):
    uid: str
    password: str
    captcha: str

@auth_bp.get("/api/auth/status")
def status(request: Request):
    return {
        "logged_in": request.session.get("logged_in", False),
        "uid": request.session.get("uid")
    }

@auth_bp.get("/api/auth/captcha")
def captcha(uid: str = None):
    if not uid:
        return Response(content='{"error": "Missing uid"}', media_type="application/json", status_code=400)

    scraper = LoginScraper()
    image_bytes = scraper.start_login(uid)
    login_sessions[uid] = {"scraper": scraper}

    return Response(content=image_bytes, media_type="image/jpeg")

@auth_bp.post("/api/auth/login")
def login(data: LoginRequest, request: Request):
    uid = data.uid
    password = data.password
    captcha = data.captcha

    if not all([uid, password, captcha]):
        return Response(content='{"error": "Missing credentials"}', media_type="application/json", status_code=400)

    if uid not in login_sessions:
        return Response(content='{"error": "Load captcha first"}', media_type="application/json", status_code=400)

    scraper = login_sessions[uid]["scraper"]
    
    try:
        scraper.complete_login(uid, password, captcha)
        
        # Verify login by hitting home page
        home = scraper.session.get("https://student.culko.in/StudentHome.aspx")
        
        # Set standard session variables
        request.session["uid"] = uid
        request.session["logged_in"] = True
        
        return {"success": True}
    except Exception as e:
        return Response(content=f'{{"error": "{str(e)}"}}', media_type="application/json", status_code=401)

@auth_bp.post("/api/auth/logout")
def logout(request: Request):
    uid = request.session.get("uid")
    if uid and uid in login_sessions:
        login_sessions.pop(uid, None)
    
    request.session.clear()
    return {"success": True}
