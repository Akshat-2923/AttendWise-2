import re
import json

from bs4 import BeautifulSoup


class AttendanceScraper:

    def __init__(self, session):
        self.session = session

    def get_attendance_page_url(self):

        response = self.session.get(
            "https://student.culko.in/StudentHome.aspx"
        )
        print("\n===== HOME URL =====")
        print(response.url)

        with open(
            "debug_home.html",
            "w",
            encoding="utf-8"
        ) as f:
            f.write(response.text)
        response.raise_for_status()
        
        with open(
            "student_home_debug.html",
            "w",
            encoding="utf-8"
        ) as f:
            f.write(response.text)
            
        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        link = soup.find(
            "a",
            href=lambda x:
                x and
                "frmStudentCourseWiseAttendanceSummary.aspx"
                in x
        )

        if not link:
            raise Exception(
                "Attendance link not found"
            )

        return (
            "https://student.culko.in/"
            + link["href"]
        )

    def fetch_attendance_page(self):

        url = self.get_attendance_page_url()

        response = self.session.get(url)

        response.raise_for_status()

        return response.text

    def extract_uid_and_session(
        self,
        html
    ):

        match = re.search(
            r"getReport\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)",
            html
        )

        if not match:
            raise Exception(
                "Could not find getReport() call"
            )

        return (
            match.group(1),
            match.group(2)
        )

    def get_attendance(self):

        html = self.fetch_attendance_page()

        uid, session_id = (
            self.extract_uid_and_session(
                html
            )
        )

        url = (
            "https://student.culko.in/"
            "frmStudentCourseWiseAttendanceSummary.aspx/"
            "GetReport"
        )

        response = self.session.post(
            url,
            json={
                "UID": uid,
                "Session": session_id
            },
            headers={
                "Content-Type":
                    "application/json; charset=UTF-8",

                "X-Requested-With":
                    "XMLHttpRequest",

                "Referer":
                    self.get_attendance_page_url(),

                "Origin":
                    "https://student.culko.in"
            }
        )

        response.raise_for_status()

        data = response.json()

        if not data.get("d"):
            return []

        return json.loads(
            data["d"]
        )
