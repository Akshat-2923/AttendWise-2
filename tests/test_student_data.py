import json

from scrapers.login_scraper import LoginScraper
from services.student_data_service import (
    StudentDataService
)


def main():

    username = input("User ID: ")
    password = input("Password: ")

    login = LoginScraper()

    login.login(
        username,
        password
    )

    print("\nLogin Successful")

    service = StudentDataService(
        login.session
    )

    data = (
        service.get_dashboard_data()
    )

    with open(
        "data/dashboard.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            indent=4,
            ensure_ascii=False
        )

    print(
        "\nDashboard data saved"
    )


if __name__ == "__main__":
    main()