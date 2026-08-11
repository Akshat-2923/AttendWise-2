import json

from scrapers.login_scraper import LoginScraper
from scrapers.attendance_scraper import AttendanceScraper


def main():

    username = input("User ID: ")
    password = input("Password: ")

    login = LoginScraper()

    login.login(
        username,
        password
    )

    print("\nLogin Successful")

    attendance_scraper = AttendanceScraper(
        login.session
    )

    attendance = attendance_scraper.get_attendance()

    with open(
        "data/attendance.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            attendance,
            file,
            indent=4,
            ensure_ascii=False
        )

    print(
        "\nAttendance saved to: data/attendance.json"
    )


if __name__ == "__main__":
    main()
