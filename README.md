<div align="center">
  <h1>🎓 AttendWise v2</h1>
  <p>The smartest, most advanced attendance manager and forecasting engine for Chandigarh University students.</p>
</div>

---

## ✨ Features

- **📊 Live Dashboard**: Real-time attendance parsing from the CU UIMS portal.
- **📅 Weekly Attendance Planner**: Plan your upcoming week (Attend/Bunk) and get instant projections on your safety status.
- **🔮 8-Week Predictor**: An advanced, calendar-aware algorithm that forecasts your attendance 8 weeks into the future, skipping holidays, mid-sems, and weekends.
- **🧮 What-If Calculator**: Pick a target percentage and instantly see exactly how many consecutive classes you need to attend (or can afford to bunk) to reach it.
- **📈 Bunk Budget**: Stop guessing. Know exactly how many classes you can bunk per subject while staying above 75%.
- **🩺 Health & Smart Plan**: Get a unified health score for your semester and daily actionable verdicts (Safe / Risky / Must Attend).
- **🗓️ Academic Calendar**: Full integration with the university calendar to account for working Saturdays and official holidays.

---

## 🛠 Tech Stack

AttendWise v2 has been completely rebuilt with a modern decoupled architecture.

| Component | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js (App Router), React, TypeScript | Interactive, component-driven UI |
| **Styling** | Tailwind CSS | Sleek, dark-mode responsive design |
| **Backend API** | FastAPI (Python) | Session management & REST endpoints |
| **Data Engine** | Pandas & NumPy | High-performance vectorized math |
| **Scraping** | Requests & BeautifulSoup4 | Live ERP portal data extraction |

---

## 📂 Project Structure

```text
AttendWise-V2/
├── frontend/                 # Next.js Application
│   ├── src/app/              # Next.js App Router pages (Dashboard, Weekly, etc.)
│   ├── src/components/       # Reusable React components (Nav, etc.)
│   ├── src/lib/              # API utilities
│   └── src/types/            # TypeScript interfaces
├── analytics/                # Pandas-based attendance crunching
├── core/                     # Math models, budgeting, and calendar logic
├── routes/                   # FastAPI REST API routers
├── scrapers/                 # UIMS portal web scrapers
└── main.py                   # FastAPI application entry point
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js** (v18+) & **npm**
- **Python** (3.11+) & **pip**
- A valid Chandigarh University student ERP account

### 1. Setup the Backend (FastAPI)

```bash
# Clone the repository
git clone https://github.com/Akshat-2923/AttendWise-2.git
cd AttendWise-2

# Create and activate a virtual environment
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate a secret key and create .env
python -c "import secrets; print(f'SECRET_KEY={secrets.token_hex(32)}')" > .env

# Run the FastAPI development server (starts on port 5000)
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### 2. Setup the Frontend (Next.js)

Open a **new terminal window** in the project root:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will now be live at **http://localhost:3000**!

---

## ☁️ Production Deployment (Vercel + Render)

AttendWise v2 is designed to be easily deployed for free using **Vercel** (Frontend) and **Render** (Backend).

### 1. Deploy the Backend (Render)
1. Create a **Web Service** on Render and connect your GitHub repository.
2. **Build Command:** `pip install -r requirements.txt`
3. **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables:**
   - `SECRET_KEY`: A random hex string (e.g., generate one with `openssl rand -hex 32`).
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://attend-wise-2-orm7jf796-akshat-4450.vercel.app`). *This is critical for CORS and secure cross-origin session cookies.*

### 2. Deploy the Frontend (Vercel)
1. Import the repository into **Vercel**.
2. Set the **Framework Preset** to Next.js.
3. Set the **Root Directory** to `frontend`.
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g., `https://attendwise-2-di1p.onrender.com`). *Ensure there is no trailing slash.*

### 💡 Tip: Keep the Free Backend Awake
Render's free tier spins down backends after 15 minutes of inactivity. To prevent users from waiting ~50 seconds for the backend to boot up during their first login, set up a free uptime monitor (like [UptimeRobot](https://uptimerobot.com/)) to ping your backend's `/api/auth/status` endpoint every 14 minutes.

---

## 📅 Calendar Configuration

AttendWise's forecasting algorithms are completely calendar-aware. Update the academic calendar in `core/calendar_config.py` for new semesters:

```python
SEMESTER_START = datetime(2026, 1, 5)
SEMESTER_END   = datetime(2026, 5, 5)

HOLIDAYS = { "2026-01-14", "2026-01-26", "2026-03-04" }
WORKING_SATURDAYS = { "2026-01-24": "Monday" }
MID_SEM_DAYS = { "2026-02-17", "2026-02-18" }
```

---

## 🔒 Security & Privacy

- **No Credential Storage**: Your passwords are **never** stored in a database. They are proxied securely to the CU ERP in real-time, and your authenticated session lives strictly in server memory for the duration of your usage.
- **Environment Variables**: Sensitive API signing keys are loaded from `.env` and excluded from version control.

---

## 🤝 Contributing

Contributions are always welcome!
1. **Fork** the repository
2. **Create** your feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m "Add some amazing feature"`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

---

## 📄 License

This project is for educational and personal use. It is not officially affiliated with or endorsed by Chandigarh University.

<p align="center">
  Built with ❤️ for students who want to bunk responsibly.
</p>
