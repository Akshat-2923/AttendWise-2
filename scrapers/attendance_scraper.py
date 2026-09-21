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

    def get_attendance_history(self):
        from datetime import datetime
        html = self.fetch_attendance_page()
        
        import os
        os.makedirs("debug", exist_ok=True)
        with open("debug/attendance_page.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        uid, session_id = self.extract_uid_and_session(html)

        url_summary = "https://student.culko.in/frmStudentCourseWiseAttendanceSummary.aspx/GetReport"
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": self.get_attendance_page_url(),
            "Origin": "https://student.culko.in"
        }

        # Fetch courses summary first to get EncryptCodes
        response = self.session.post(
            url_summary,
            json={"UID": uid, "Session": session_id},
            headers=headers
        )
        response.raise_for_status()
        data = response.json()
        
        courses = []
        if data.get("d"):
            courses = json.loads(data["d"])

        url_detail = "https://student.culko.in/frmStudentCourseWiseAttendanceSummary.aspx/GetFullReport"
        
        history = []
        seen = set()

        for course in courses:
            encrypt_code = course.get("EncryptCode")
            course_code = course.get("Code", "")
            title = course.get("Title", "").strip()
            
            if not encrypt_code:
                continue

            data_payload = {
                "course": encrypt_code,
                "UID": uid,
                "fromDate": "0",
                "toDate": "0",
                "type": "All",
                "Session": session_id
            }

            try:
                detail_resp = self.session.post(url_detail, json=data_payload, headers=headers)
                detail_resp.raise_for_status()
                detail_json = detail_resp.json()

                with open("debug/attendance_response.json", "a", encoding="utf-8") as f:
                    f.write(json.dumps({
                        "course": course_code,
                        "payload": data_payload,
                        "response": detail_json
                    }) + "\n")

                # Parse the response structure
                d_val = detail_json.get("d")
                if not d_val:
                    raise Exception(f"RESPONSE EMPTY or UNEXPECTED: {detail_json}")
                
                if isinstance(d_val, dict):
                    result_val = d_val.get("Result")
                    if result_val == "No Data Found":
                        continue  # No records for this course, perfectly normal
                    elif result_val:
                        d_val = result_val
                    else:
                        raise Exception(f"PARSER FAILED: Expected Result in Task dict, got: {d_val}")

                try:
                    records = json.loads(d_val)
                except Exception as e:
                    raise Exception(f"PARSER FAILED: Could not decode JSON from {d_val[:100]}... Error: {e}")

                if not isinstance(records, list):
                    raise Exception(f"NORMALIZATION FAILED: Expected list of records, got {type(records)}")

                for rec in records:
                    raw_date = str(rec.get("AttDate", "")).strip()
                    if not raw_date:
                        continue

                    # Normalize date (e.g., "Friday, 18 Sep 2026" -> "2026-09-18")
                    try:
                        dt = datetime.strptime(raw_date, "%A, %d %b %Y")
                        norm_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        try:
                            dt = datetime.strptime(raw_date, "%d %b %Y")
                            norm_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            norm_date = raw_date

                    status = str(rec.get("AttendanceCode", "")).strip()
                    if status.lower() in ["present", "p"]:
                        status = "Present"
                    elif status.lower() in ["absent", "a"]:
                        status = "Absent"
                    else:
                        status = "Unknown"

                    class_type = str(rec.get("AttendanceType", "")).strip()
                    time_slot = str(rec.get("Timing", "")).strip()
                    section = str(rec.get("Section", "")).strip()

                    # Deduplication key
                    key = (course_code, norm_date, time_slot, class_type, status)
                    if key in seen:
                        continue
                    seen.add(key)

                    history.append({
                        "date": norm_date,
                        "time": time_slot,
                        "course_code": course_code,
                        "subject": title,
                        "type": class_type,
                        "section": section,
                        "status": status
                    })

            except Exception as e:
                print(f"Failed to fetch detailed attendance for {course_code}: {e}")
                # We should continue for other courses even if one fails,
                # but if we want to bubble it up as per user request:
                raise Exception(f"Failed to fetch detailed attendance for {course_code}: {str(e)}")
                
        return history
