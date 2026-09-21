from scrapers.attendance_scraper import AttendanceScraper
from scrapers.timetable_scraper import TimetableScraper


class StudentDataService:

    def __init__(self, session):

        self.attendance_scraper = (
            AttendanceScraper(session)
        )

        self.timetable_scraper = (
            TimetableScraper(session)
        )

    def get_attendance(self):

        return (
            self.attendance_scraper
            .get_attendance()
        )

    def get_timetable(self):

        return (
            self.timetable_scraper
            .get_timetable()
        )

    def get_dashboard_data(self):

        return {

            "attendance":
                self.get_attendance(),

            "timetable":
                self.get_timetable()

        }

    def get_attendance_history(self):
        
        return (
            self.attendance_scraper
            .get_attendance_history()
        )