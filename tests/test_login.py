from scrapers.login_scraper import LoginScraper


def main():

    scraper = LoginScraper()

    username = input(
        "Enter User ID: "
    )

    password = input(
        "Enter Password: "
    )

    response = scraper.login(
        username,
        password
    )

    print("\nSTATUS CODE:")
    print(response.status_code)

    print("\nCURRENT URL:")
    print(response.url)

    if "StudentHome.aspx" in response.url:
        print("\nLogin Successful!")
    else:
        print("\nLogin Failed!")


if __name__ == "__main__":
    main()