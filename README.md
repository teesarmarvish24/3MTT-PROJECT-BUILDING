# EcoPickup — Waste Pickup Scheduler

A full-stack web app for scheduling waste pickups, built for the **3MTT (3 Million Technical Talent) Software Development track — SD-14: Waste Pickup Scheduler**.

**Problem:** Waste pickups are unreliable — residents don't have a simple way to book them, get reminded, or report whether collection actually happened.

**Solution:** EcoPickup lets residents schedule one-off or recurring pickups, see reminders for anything due soon, self-report whether a pickup was collected or missed, leave feedback on the service, and track it all from a dashboard, calendar, and analytics view.

## Features

- **User accounts** — register (with a default pickup address) and log in with secure password hashing (bcrypt) and JWT-based sessions
- **Dashboard** — a personalized overview with live stats, upcoming pickups, and recent feedback
- **Scheduling** — book a pickup with waste type (general / recyclable / organic / hazardous), address, date, time window, and optional notes
- **Saved locations** — save addresses (e.g. Home, Office) to a personal address book and one-click fill them when scheduling
- **Calendar view** — a full month calendar with a colored dot per pickup; click any day to see or schedule pickups for that date
- **Recurring pickups** — set a pickup to repeat weekly, every 2 weeks, or monthly; the next occurrence is automatically scheduled as soon as the current one is marked collected or missed
- **Reminders** — a banner and notification bell surface any scheduled pickup due within the next 2 days
- **Status tracking** — mark a pickup as collected, missed, or cancel it; overdue-but-unconfirmed pickups are flagged as "Awaiting confirmation"
- **Feedback** — rate a collected/missed pickup 1–5 stars with an optional comment
- **Analytics** — status and waste-type breakdown charts, a 14-day collection trend, completion rate, and a rating-distribution chart, all rendered with dependency-free custom SVG charts
- **Search & filters** — filter your pickups by status, waste type, or a text search across address/notes
- **Settings page** — edit your profile and change your password
- **Dark mode** — toggle with a saved preference
- **Responsive UI** — collapsible sidebar navigation with a mobile hamburger menu

## Tech Stack

| Layer     | Technology                             |
|-----------|-----------------------------------------|
| Backend   | Node.js, Express 5                      |
| Database  | SQLite / libSQL via `@libsql/client` — a local file for development, a hosted [Turso](https://turso.tech) database in production |
| Auth      | bcryptjs (hashing), jsonwebtoken        |
| Frontend  | HTML, CSS, vanilla JavaScript (SPA), custom dependency-free SVG charts |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer

### Installation

```bash
git clone https://github.com/teesarmarvish24/3MTT-PROJECT-BUILDING.git
cd 3MTT-PROJECT-BUILDING
git checkout waste-pickup-scheduler
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

By default (no extra setup needed) the app uses a local SQLite file at
`data/waste-pickup.db`. This is fine for local development, but on a host
with an ephemeral filesystem (like Render's free tier) that file gets
wiped whenever the app restarts. For a deployment where data needs to
actually persist, set these two environment variables to point at a free
[Turso](https://turso.tech) database instead:

```bash
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

When both are set, the app talks to that hosted database instead of the
local file — same code either way.

For development with auto-reload:

```bash
npm run dev
```

To use a custom port or JWT secret:

```bash
PORT=4000 JWT_SECRET=your-secret npm start
```

## API Reference

All endpoints below (except `/api/auth/*` and `/api/health`) require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint             | Description                                         |
|--------|-----------------------|------------------------------------------------------|
| POST   | `/api/auth/register`  | Create account `{ name, email, password, address }` |
| POST   | `/api/auth/login`     | Log in `{ email, password }` → returns JWT           |

### Pickups

| Method | Endpoint          | Description                                                  |
|--------|-------------------|----------------------------------------------------------------|
| GET    | `/api/pickups`     | List your pickups (`?status=`, `?waste_type=`, `?due_soon=1`, `?search=`) |
| GET    | `/api/pickups/:id` | Full pickup detail, including feedback                       |
| POST   | `/api/pickups`     | Schedule a pickup `{ waste_type, address, scheduled_date, time_window, recurrence, notes }` |
| PUT    | `/api/pickups/:id` | Update / reschedule / change status (auto-creates the next occurrence when a recurring pickup is resolved) |
| DELETE | `/api/pickups/:id` | Delete a pickup                                               |

### Feedback (nested under a pickup)

| Method | Endpoint                    | Description                                     |
|--------|------------------------------|--------------------------------------------------|
| POST   | `/api/pickups/:id/feedback`  | Leave feedback `{ rating (1-5), comment }` — only once a pickup is collected or missed |
| GET    | `/api/pickups/:id/feedback`  | View feedback for a pickup                       |

### Locations

| Method | Endpoint             | Description                                  |
|--------|-----------------------|-----------------------------------------------|
| GET/POST | `/api/locations`    | List / save a location `{ label, address }` |
| DELETE | `/api/locations/:id`  | Delete a saved location                       |

### Analytics & profile

| Method | Endpoint                  | Description                                         |
|--------|----------------------------|-------------------------------------------------------|
| GET    | `/api/analytics`          | Status/waste-type breakdown, completion rate, average rating, 14-day trend |
| GET/PUT | `/api/users/me`           | View / update your profile `{ name, address }`       |
| PUT    | `/api/users/me/password`   | Change password `{ current_password, new_password }` |

### Other

| Method | Endpoint      | Description          |
|--------|---------------|-----------------------|
| GET    | `/api/health` | Server health check   |

## Project Structure

```
├── server.js              # Express app entry point
├── db.js                  # SQLite setup and schema
├── middleware/
│   └── authenticate.js    # JWT verification middleware
├── routes/
│   ├── auth.js            # Register / login endpoints
│   ├── pickups.js         # Pickup scheduling, status, feedback endpoints
│   ├── locations.js       # Saved address book endpoints
│   ├── analytics.js       # Analytics dashboard endpoint
│   └── users.js           # Profile & password endpoints
└── public/
    ├── index.html          # Single-page frontend (sidebar + dashboard/pickups/calendar/analytics/settings views)
    ├── style.css           # Styles (incl. dark mode)
    └── js/
        ├── charts.js       # Dependency-free SVG chart helpers
        └── app.js          # Frontend logic
```

## License

MIT
