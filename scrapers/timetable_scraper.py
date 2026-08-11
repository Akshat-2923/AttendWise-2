from bs4 import BeautifulSoup
import re


class TimetableScraper:

    def __init__(self, session):
        """
        session = authenticated requests.Session()
        """
        self.session = session

    def fetch_timetable_page(self):

        url = (
            "https://student.culko.in/frmMyTimeTable.aspx"
        )

        response = self.session.get(url)

        response.raise_for_status()

        return response.text

    def parse_lecture_details(self, lecture_text, time_slot, course_map):

        pattern = (
            r"(?P<subject_code>[^:]+)"
            r":(?P<type>[A-Z])"
            r"::(?P<group>[^:]+)"
            r": By "
            r"(?P<faculty>.*?)"          # faculty name — can be empty
            r"(?:\((?P<faculty_id>.*?)\))?"  # faculty ID in parens — optional
            r" at "
            r"(?P<room>.*)"
        )

        match = re.match(pattern, lecture_text)

        if not match:
            return {"time": time_slot, "raw": lecture_text}

        subject_code = match.group("subject_code").strip()
        type_code    = match.group("type")

        # Map all type codes to display labels
        type_map = {
            "L": "L",   # Lecture
            "P": "P",   # Practical
            "T": "T",   # Tutorial
        }

        return {
            "subject_code": subject_code,
            "subject_name": course_map.get(subject_code, subject_code),
            "type":         type_map.get(type_code, type_code),
            "group":        match.group("group").strip(),
            "faculty":      (match.group("faculty") or "").strip(),
            "faculty_id":   (match.group("faculty_id") or "").strip(),
            "room":         (match.group("room") or "").strip(),
            "time":         time_slot,
        }
    def parse_timetable(self, html):

        soup = BeautifulSoup(
            html,
            "html.parser"
        )
        course_map = self.extract_course_map(
            soup
        )
        
        table = soup.find("table", id="ContentPlaceHolder1_grdMain")

        if not table:
            raise Exception(
                "Timetable table not found"
            )

        rows = table.find_all("tr")

        timetable = {}

        headers = [
            th.get_text(strip=True)
            for th in rows[0].find_all("th")
        ]

        # Example:
        # ["Timing", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

        for day in headers[1:]:
            timetable[day] = []

        for row in rows[1:]:

            cells = row.find_all("td")

            if len(cells) < 2:
                continue

            time_slot = cells[0].get_text(
                strip=True
            )

            for index, cell in enumerate(
                cells[1:]
            ):

                day = headers[index + 1]

                lecture_text = cell.get_text(
                    separator=" ",
                    strip=True
                )

                if not lecture_text:
                    continue

                timetable[day].append(
                    self.parse_lecture_details(
                        lecture_text,
                        time_slot,
                        course_map
                    )
                )

        return timetable

    def get_timetable(self):

        html = self.fetch_timetable_page()

        return self.parse_timetable(html)
    
    def extract_course_map(self, soup):

        course_map = {}

        course_table = soup.find(
            "table",
            id="ContentPlaceHolder1_grdCourseDetail"
        )

        if not course_table:
            return course_map

        rows = course_table.find_all("tr")[1:]

        for row in rows:

            cells = row.find_all("td")

            if len(cells) < 2:
                continue

            code = cells[0].get_text(
                strip=True
            )

            title = cells[1].get_text(
                strip=True
            )

            course_map[code] = title

        return course_map
