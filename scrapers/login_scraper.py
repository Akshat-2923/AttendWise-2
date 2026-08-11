import requests
from bs4 import BeautifulSoup


class LoginScraper:

    BASE_URL = "https://student.culko.in"

    def __init__(self):

        self.session = requests.Session()

        self.hidden_fields = {}

        self.password_page_url = None

        self.password_page_html = None

    def get_login_page(self):

        response = self.session.get(
            self.BASE_URL
        )

        response.raise_for_status()

        return response.text

    def extract_hidden_fields(
        self,
        html
    ):

        soup = BeautifulSoup(
            html,
            "html.parser"
        )

        hidden_fields = {}

        hidden_inputs = soup.find_all(
            "input",
            {"type": "hidden"}
        )

        for field in hidden_inputs:

            name = field.get("name")

            value = field.get(
                "value",
                ""
            )

            if name:

                hidden_fields[name] = value

        return hidden_fields

    def extract_form_fields(
        self,
        html
    ):

        soup = BeautifulSoup(
            html,
            "html.parser"
        )

        payload = {}

        for inp in soup.find_all(
            "input"
        ):

            name = inp.get("name")

            if not name:
                continue

            payload[name] = inp.get(
                "value",
                ""
            )

        return payload

    # ---------------------------------------
    # STEP 1
    # Username page + captcha generation
    # ---------------------------------------

    def start_login(
        self,
        username
    ):

        html = self.get_login_page()

        hidden = self.extract_hidden_fields(
            html
        )

        next_payload = hidden.copy()

        next_payload.update({

            "__EVENTTARGET": "",

            "__EVENTARGUMENT": "",

            "txtUserId": username,

            "btnNext": "NEXT"

        })

        response = self.session.post(

            self.BASE_URL,

            data=next_payload

        )

        response.raise_for_status()

        self.password_page_url = (
            response.url
        )

        self.password_page_html = (
            response.text
        )

        captcha_url = (

            f"{self.BASE_URL}/"

            "GenerateCaptcha.aspx"

        )

        captcha_response = self.session.get(
            captcha_url
        )

        captcha_response.raise_for_status()

        return captcha_response.content

    # ---------------------------------------
    # STEP 2
    # Actual Login
    # ---------------------------------------

    def complete_login(
        self,
        username,
        password,
        captcha
    ):

        login_payload = self.extract_form_fields(
            self.password_page_html
        )

        login_payload["__EVENTTARGET"] = ""

        login_payload["__EVENTARGUMENT"] = ""

        login_payload["__LASTFOCUS"] = ""

        login_payload["txtUserId"] = username

        login_payload["txtLoginPassword"] = (
            password
        )

        login_payload["txtcaptcha"] = captcha

        login_payload["btnLogin"] = "LOGIN"

        response = self.session.post(

            self.password_page_url,

            data=login_payload

        )

        response.raise_for_status()

        return response

    # ---------------------------------------
    # Old terminal compatibility
    # ---------------------------------------

    def login(
        self,
        username,
        password
    ):

        captcha_bytes = self.start_login(
            username
        )

        with open(
            "captcha_step2.jpg",
            "wb"
        ) as f:

            f.write(
                captcha_bytes
            )

        captcha = input(
            "Enter Captcha (captcha_step2.jpg): "
        )

        return self.complete_login(

            username,

            password,

            captcha

        )