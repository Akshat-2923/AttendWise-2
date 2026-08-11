import json

from scrapers.login_scraper import LoginScraper
from scrapers.timetable_scraper import TimetableScraper


def main():

    username = input(
        "User ID: "
    )

    password = input(
        "Password: "
    )

    login_scraper = LoginScraper()

    response = login_scraper.login(
        username,
        password
    )

    print(
        "\nLogin Response:",
        response.status_code
    )

    print(
        "Current URL:",
        response.url
    )

    if "StudentHome.aspx" not in response.url:
        print("\nLogin Failed!")
        return

    print("\nLogin Successful!")

    timetable_scraper = TimetableScraper(
        login_scraper.session
    )

    timetable = (
        timetable_scraper.get_timetable()
    )

    with open(
        "data/timetable.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            timetable,
            file,
            indent=4,
            ensure_ascii=False
        )

    print(
        "\nTimetable saved to:"
    )

    print(
        "data/timetable.json"
    )


if __name__ == "__main__":
    main()
