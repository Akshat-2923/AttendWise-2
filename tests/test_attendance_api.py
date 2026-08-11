import json

from scrapers.login_scraper import LoginScraper

username = input("User ID: ")
password = input("Password: ")

login = LoginScraper()

login.login(
    username,
    password
)

payload = {
    "UID": "A71wJhZJy9K1Gqt18GO/lMZBOji+b8/9ofQcyVe5l5c=",
    "Session": "25262"
}

response = login.session.post(
    "https://student.culko.in/frmStudentCourseWiseAttendanceSummary.aspx/GetReport",
    json=payload,
    headers={
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
    }
)

print(response.status_code)
print(response.text[:1000])