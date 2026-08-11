<p align="center">
  <img src="static/images/icon-512.png" width="120" alt="AttendWise Logo" />
</p>

<h1 align="center">AttendWise v2</h1>

<p align="center">
  <b>Smart Attendance Analytics for Chandigarh University Students</b><br/>
  Live-scrape your ERP → per-subject insights, bunk budgets, forecasting & daily smart plans.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-3.x-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Pandas-2.x-150458?style=for-the-badge&logo=pandas&logoColor=white" />
  <img src="https://img.shields.io/badge/NumPy-blue?style=for-the-badge&logo=numpy&logoColor=white" />
  <img src="https://img.shields.io/badge/PWA-ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Endpoints](#-api-endpoints)
- [Academic Calendar](#-academic-calendar)
- [Testing](#-testing)
- [Tech Stack](#-tech-stack)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**AttendWise v2** is a full-stack web application that connects directly to the Chandigarh University student ERP portal (`student.culko.in`), scrapes live attendance and timetable data, and transforms it into actionable analytics — all within a sleek, dark-themed progressive web app.

Students can instantly see which classes they can safely skip, how many they need to recover, and what their attendance will look like weeks from now under different scenarios.

### Why AttendWise?

| Problem | AttendWise Solution |
|---|---|
| ERP shows raw numbers only | Per-subject status cards with bunk budgets & recovery counts |
| No way to plan bunks safely | **Smart Bunk Plan** — per-class verdict (SAFE / RISKY / MUST ATTEND) |
| Can't predict future attendance | **8-week forecasting** across 4 scenarios with visual timelines |
| No "what-if" analysis | **What-If Simulator** — see impact of attending/missing N classes |
| Hard to spot at-risk subjects | **Health Score** — weighted 0–100 score with A–F grading |
| Calendar confusion | **Calendar-aware engine** — respects holidays, working Saturdays, mid-sems |

---

## ✨ Features

### 1. 📊 Dashboard
The central hub displaying per-subject attendance cards with:
- Current attendance percentage and status (Safe / Below Threshold / Not Started)
- Bunk budget — how many classes you can skip and stay above 75%
- Recovery classes — how many consecutive classes needed to recover to 75%
- Medical and duty leave breakdowns

### 2. 📅 Timetable
Live timetable scraped from the ERP with:
- Subject codes mapped to full names
- Class type indicators (Lecture / Practical / Tutorial)
- Faculty names, room numbers, and time slots
- Chronologically sorted day views

### 3. 💚 Health Score
A weighted composite score (0–100) with grade breakdown:

| Component | Weight | Metric |
|---|:---:|---|
| Average Attendance | 40 pts | Linear scale: 0% → 0, 100% → 40 |
| Safe Subject Ratio | 30 pts | Fraction of subjects above 75% |
| Bunk Budget Health | 20 pts | Average remaining bunk budget (capped at 10) |
| No Critical Subjects | 10 pts | Fraction of subjects not needing recovery |

Grading: **A** (≥85) · **B** (≥70) · **C** (≥55) · **D** (≥40) · **F** (<40)

### 4. 🧮 Bunk Calculator
Interactive per-subject calculator showing:
- Exactly how many classes can be bunked while maintaining 75%
- Recovery classes needed if already below threshold
- Priority classification: *Must Attend / Attend Carefully / Bunkable*

### 5. 🔮 Predictor
Calendar-aware 8-week forecasting engine with 4 scenarios:

| Scenario | Logic |
|---|---|
| **Attend All** | Attend every remaining class |
| **Strategic** | Attend only when below 75%, re-evaluated per step |
| **Current Pace** | Continue at your historical attend rate |
| **Bunk All** | Miss every remaining class (worst case) |

Uses real upcoming class counts computed from timetable + academic calendar (holidays, working Saturdays, mid-sem blocks excluded).

### 6. 🤔 What-If Simulator
"What happens if I attend/miss the next N classes?"
- Side-by-side attend vs. miss tables (N = 1…20)
- Shows resulting percentage, delta, bunk budget, recovery needed
- Traffic-light status: Safe / Borderline / Danger

### 7. 📆 Weekly Analytics
Multi-dimensional weekly intelligence:
- **Day Workload** — per-day class counts, lecture/practical split, contact hours
- **Risk Heatmap** — cross-references timetable with attendance to flag risky days
- **Upcoming Week** — calendar-aware 7-day preview with per-class verdicts and holiday reasons

### 8. 🧠 Today's Smart Plan
Daily decision engine answering: *"Should I go to college today?"*
- Per-class verdict using priority logic (MUST ATTEND / RISKY / SAFE)
- Aggregate daily verdict via voting system (danger wins ties)
- Lab-aware — practicals are weighted more conservatively

### 9. 📱 PWA Support
- Installable as a home-screen app on mobile
- Service worker with offline caching
- App manifest with proper icons and theme colors

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (PWA)                          │
│  login.html → dashboard.html → [feature pages]             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / JSON API
┌────────────────────────▼────────────────────────────────────┐
│                   Flask App (app.py)                        │
│  Blueprints: timetable, health, bunk, predictor,           │
│              what_if, weekly, smart_plan, subject           │
└──┬──────────────┬──────────────┬────────────────────────────┘
   │              │              │
   ▼              ▼              ▼
┌──────┐   ┌───────────┐   ┌──────────┐
│Scrap-│   │ Analytics │   │  Core    │
│ ers  │   │  Engine   │   │  Logic   │
│      │   │           │   │          │
│login │   │attendance │   │budget    │
│attend│   │analyzer   │   │calendar  │
│time- │   │health     │   │predictor │
│table │   │score      │   │what_if   │
│      │   │           │   │weekly    │
│      │   │           │   │verdict   │
└──┬───┘   └───────────┘   └──────────┘
   │
   ▼
┌─────────────────┐
│  CU ERP Portal  │
│student.culko.in │
└─────────────────┘
```

### Data Flow
1. **Login** — Two-step CAPTCHA-based auth against the CU student portal
2. **Scrape** — Authenticated `requests.Session` fetches attendance & timetable HTML
3. **Parse** — BeautifulSoup extracts structured data from ASP.NET WebForms
4. **Analyze** — Pandas + NumPy compute summaries, budgets, and forecasts
5. **Serve** — Flask renders Jinja2 templates or returns JSON via API endpoints

---

## 📁 Project Structure

```
AttendWise-2/
├── app.py                          # Flask entry point & core routes
├── .env                            # Environment variables (SECRET_KEY) — git-ignored
├── .gitignore                      # Git exclusion rules
│
├── scrapers/                       # ERP data extraction layer
│   ├── login_scraper.py            #   Two-step CAPTCHA login flow
│   ├── attendance_scraper.py       #   Course-wise attendance summary
│   └── timetable_scraper.py        #   Weekly timetable with course map
│
├── analytics/                      # Data analysis engines
│   ├── attendance_analyzer.py      #   Per-subject stats, bunk budget, recovery
│   └── health_score.py             #   Composite 0–100 health score calculator
│
├── core/                           # Business logic modules
│   ├── budget_calculator.py        #   NumPy-based bunk budget & recovery math
│   ├── calendar_config.py          #   Academic calendar constants (dates only)
│   ├── calendar_logic.py           #   Teaching-day logic (holiday/mid-sem aware)
│   ├── class_verdict.py            #   Per-class SAFE/RISKY/MUST ATTEND verdict
│   ├── daily_verdict.py            #   Aggregate daily verdict via voting
│   ├── predictor.py                #   4-scenario 8-week forecasting engine
│   ├── priority.py                 #   Subject priority classification
│   ├── sessions.py                 #   In-memory login session store
│   ├── weekly_analytics.py         #   Workload, risk heatmap, upcoming week
│   ├── what_if.py                  #   What-if attend/miss simulator
│   └── config.py                   #   App-level configuration constants
│
├── routes/                         # Flask Blueprints (one per feature)
│   ├── bunk_routes.py              #   /bunk-calculator, /api/bunk
│   ├── health_routes.py            #   /health, /api/health
│   ├── predictor_routes.py         #   /predictor, /api/predictor
│   ├── smart_plan_routes.py        #   /smart-plan, /api/smart-plan
│   ├── subject.py                  #   /subject/<code>
│   ├── timetable_routes.py         #   /api/timetable
│   ├── weekly_routes.py            #   /weekly, /api/weekly
│   └── what_if_routes.py           #   /what-if, /api/what-if
│
├── services/                       # Service layer
│   └── student_data_service.py     #   Shared data-fetching helpers
│
├── utils/                          # Utility modules
│   └── subject_map.py              #   Fallback subject code → name mapping
│
├── templates/                      # Jinja2 HTML templates
│   ├── login.html                  #   Login page with CAPTCHA
│   ├── dashboard.html              #   Main attendance dashboard
│   ├── timetable.html              #   Weekly timetable view
│   ├── health.html                 #   Health score dashboard
│   ├── bunk_calculator.html        #   Bunk calculator interface
│   ├── predictor.html              #   Forecasting charts
│   ├── what_if.html                #   What-if simulator
│   ├── weekly.html                 #   Weekly analytics dashboard
│   ├── smart_plan.html             #   Today's smart plan
│   ├── subject.html                #   Individual subject detail
│   └── partials/
│       ├── nav.html                #   Shared navigation bar
│       ├── pwa_head.html           #   PWA meta tags & manifest link
│       └── pwa_sw.html             #   Service worker registration
│
├── static/                         # Static assets
│   ├── css/style.css               #   Global styles (dark theme)
│   ├── js/                         #   Client-side JavaScript
│   ├── images/                     #   PWA icons (192px, 512px)
│   ├── manifest.json               #   PWA web app manifest
│   └── service-worker.js           #   Offline caching service worker
│
├── data/                           # Sample/debug data
│   ├── attendance.json             #   Sample attendance response
│   └── timetable.json              #   Sample timetable response
│
└── tests/                          # Test suite
    ├── test_analytics.py
    ├── test_attendance.py
    ├── test_attendance_api.py
    ├── test_login.py
    ├── test_nav_migration.py
    ├── test_predictor_whatif.py
    ├── test_pwa.py
    ├── test_student_data.py
    ├── test_templates.py
    ├── test_timetable.py
    └── test_weekly.py
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **pip** (Python package manager)
- A valid **Chandigarh University student ERP account**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Akshat5698/AttendWise-V2.git
cd AttendWise-V2

# 2. Create and activate a virtual environment (recommended)
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 3. Install dependencies
pip install flask pandas numpy requests beautifulsoup4 python-dotenv

# 4. Generate a secret key and create .env
python -c "import secrets; print(f'SECRET_KEY={secrets.token_hex(32)}')" > .env

# 5. Run the application
python app.py
```

The app will start at **http://127.0.0.1:5000**

---

## ⚙ Configuration

### Environment Variables

| Variable | Required | Description |
|---|:---:|---|
| `SECRET_KEY` | ✅ | Flask session signing key. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |

All environment variables are loaded from a `.env` file in the project root via `python-dotenv`.

> [!WARNING]
> **Never commit your `.env` file.** It is already listed in `.gitignore`. If the `SECRET_KEY` is missing, the app will start with an insecure fallback and print a warning — this is acceptable for local development only.

### Academic Calendar

The academic calendar is configured in [`core/calendar_config.py`](core/calendar_config.py):

```python
SEMESTER_START = datetime(2026, 1, 5)
SEMESTER_END   = datetime(2026, 5, 5)

HOLIDAYS = {
    "2026-01-14",  # Makar Sankranti
    "2026-01-26",  # Republic Day
    "2026-03-04",  # Holi
    # ... more holidays
}

WORKING_SATURDAYS = {
    "2026-01-24": "Monday",      # follows Monday timetable
    "2026-02-14": "Friday",      # follows Friday timetable
    "2026-04-11": "Test",        # mid-sem test day (no classes)
    # ... more working saturdays
}

MID_SEM_DAYS = {
    "2026-02-17", "2026-02-18", ...  # blocked for exams
}
```

> [!TIP]
> To update for a new semester, **only edit `calendar_config.py`** — all logic in `calendar_logic.py` reads from these constants. No other file needs changes.

---

## 💡 Usage

### Login Flow
1. Open the app in your browser
2. Enter your **CU Student UID**
3. A CAPTCHA image is fetched from the ERP — solve it
4. Enter your **ERP password** and submit
5. You're redirected to the **Dashboard** with live attendance data

### Navigation
Once logged in, use the top navigation bar to access all features:

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Attendance overview with subject cards |
| Timetable | `/timetable` | Weekly class schedule |
| Health | `/health` | Composite health score & breakdown |
| Bunk Calc | `/bunk-calculator` | Per-subject bunk budget calculator |
| Predictor | `/predictor` | 8-week attendance forecasting |
| What-If | `/what-if` | Attend/miss scenario simulator |
| Weekly | `/weekly` | Workload, risk heatmap, upcoming week |
| Today's Plan | `/smart-plan` | Daily class-by-class verdict |

---

## 🔌 API Endpoints

All API endpoints return JSON and require an active session.

| Method | Endpoint | Description |
|:---:|---|---|
| `GET` | `/api/attendance` | Per-subject attendance summary |
| `GET` | `/api/timetable` | Full weekly timetable |
| `GET` | `/api/health` | Health score with breakdown |
| `GET` | `/api/bunk` | Bunk budget for all subjects |
| `GET` | `/api/predictor` | 8-week forecast for all subjects |
| `GET` | `/api/what-if?code=<CODE>&max_n=<N>` | What-if table for a subject |
| `GET` | `/api/weekly` | Weekly analytics (workload, risk, upcoming) |
| `GET` | `/api/smart-plan` | Today's classes with verdicts |
| `GET` | `/captcha?uid=<UID>` | Fetch CAPTCHA image for login |

### Example Response — `/api/attendance`

```json
[
  {
    "code": "25CSH-114",
    "subject": "Data Structures & Algorithms",
    "conducted": 42,
    "attended": 38,
    "percentage": 90.48,
    "bunk_budget": 8,
    "recovery_classes": 0,
    "status": "Safe"
  }
]
```

---

## 📅 Academic Calendar

The predictor and weekly analytics engines are **calendar-aware** — they don't naively multiply weekly classes by weeks. Instead, they walk through actual calendar dates and check each day against:

- **Holidays** — Makar Sankranti, Republic Day, Holi, Eid, Ram Navmi, etc.
- **Working Saturdays** — mapped to specific weekday timetables (e.g., a Saturday following Monday's schedule)
- **Mid-semester exam blocks** — multi-day exam periods where no regular classes run
- **Semester boundaries** — no classes before start or after end date

This ensures forecasts and remaining class counts are accurate, not just estimates.

---

## 🧪 Testing

The project includes a comprehensive test suite covering scrapers, analytics, routes, and templates.

```bash
# Run all tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_weekly.py -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=term-missing
```

### Test Coverage

| Module | Tests |
|---|---|
| `test_analytics.py` | Attendance analyzer computations |
| `test_attendance.py` | Attendance data extraction |
| `test_attendance_api.py` | `/api/attendance` endpoint |
| `test_login.py` | Login flow and session handling |
| `test_nav_migration.py` | Navigation template rendering |
| `test_predictor_whatif.py` | Predictor + What-If engines |
| `test_pwa.py` | Service worker, manifest, meta tags |
| `test_student_data.py` | Student data service layer |
| `test_templates.py` | Template rendering & content |
| `test_timetable.py` | Timetable parsing and routes |
| `test_weekly.py` | Weekly analytics engine |

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Flask 3.x | Web framework, routing, sessions |
| **Scraping** | Requests + BeautifulSoup4 | ERP portal data extraction |
| **Analysis** | Pandas + NumPy | DataFrames, vectorized math |
| **Templating** | Jinja2 | Server-side HTML rendering |
| **Frontend** | HTML5 + CSS3 + Vanilla JS | Dark-themed responsive UI |
| **PWA** | Service Worker + Manifest | Offline support, installability |
| **Config** | python-dotenv | Environment variable management |

---

## 🔒 Security

- **Secret key** — loaded from environment variable (`SECRET_KEY`), never hardcoded in source
- **Session-based auth** — Flask signed cookies, tied to authenticated ERP sessions
- **No credential storage** — user passwords are never saved; they flow directly to the CU ERP
- **`.env` git-ignored** — secrets excluded from version control via `.gitignore`
- **CAPTCHA relay** — CAPTCHA images are proxied from the ERP, not bypassed

> [!IMPORTANT]
> This application acts as a **proxy** to the CU student ERP. Your credentials are sent directly to `student.culko.in` — AttendWise does not store them. However, the authenticated session is held in server memory for the duration of your usage.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Commit** your changes: `git commit -m "Add my feature"`
4. **Push** to the branch: `git push origin feature/my-feature`
5. **Open** a Pull Request

### Guidelines
- Follow existing code style and project structure
- Add tests for new features
- Update `calendar_config.py` (not `calendar_logic.py`) for calendar changes
- Keep scraper logic isolated from business logic

---

## 📄 License

This project is for educational and personal use. Not affiliated with Chandigarh University.

---

<p align="center">
  Built with ❤️ for CU students who want to bunk responsibly.
</p>
