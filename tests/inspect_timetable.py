# tests/inspect_timetable.py
from scrapers.login_scraper import LoginScraper

scraper = LoginScraper()
scraper.login("25LBCS3274", "Akshat@2006")  # ← add these

response = scraper.session.get("https://student.culko.in/frmMyTimeTable.aspx")

with open("timetable_debug.html", "w", encoding="utf-8") as f:
    f.write(response.text)

print("Done. Open timetable_debug.html")