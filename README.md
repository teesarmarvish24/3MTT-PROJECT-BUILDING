# EcoPickup — Waste Pickup Scheduler

A full-stack web app for scheduling waste pickups, built for the **3MTT (3 Million Technical Talent) Software Development track — SD-14: Waste Pickup Scheduler**.

**Problem:** Waste pickups are unreliable — residents don't have a simple way to book them, get reminded, or report whether collection actually happened.

**Solution:** EcoPickup lets residents schedule one-off or recurring pickups, see reminders for anything due soon, self-report whether a pickup was collected or missed, and leave feedback on the service.

## Features

- **User accounts** — register (with a default pickup address) and log in with secure password hashing (bcrypt) and JWT-based sessions
- **Scheduling** — book a pickup with waste type (general / recyclable / organic / hazardous), address, date, time window, and optional notes
- **Recurring pickups** — set a pickup to repeat weekly, every 2 weeks, or monthly; the next occurrence is automatically scheduled as soon as the current one is marked collected or missed
- **Reminders** — a banner and notification bell surface any scheduled pickup due within the next 2 days
- **Status tracking** — mark a pickup as collected, missed, or cancel it; overdue-but-unconfirmed pickups are flagged as "Awaiting confirmation"
- **Feedback** — rate a collected/missed pickup 1–5 stars with an optional comment
- **Filters** — filter your pickups by status or waste type
- **Dashboard stats** — live counts of total, scheduled, collected, and missed pickups
- **Dark mode** — toggle with a saved preference
- **Responsive UI** — works on desktop and mobile

## Tech Stack

| Layer     | Technology                             |
|-----------|-----------------------------------------|
| Backend   | Node.js, Express 5                      |
| Database  | SQLite (Node's built-in `node:sqlite`)  |
| Auth      | bcryptjs (hashing), jsonwebtoken        |
| Frontend  | HTML, CSS, vanilla JavaScript (SPA)     |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22.5 or newer (uses the built-in `node:sqlite` module — no compiler or build tools needed)

### Installation

```bash
git clone https://github.com/teesarmarvish24/3MTT-PROJECT-BUILDING.git
cd 3MTT-PROJECT-BUILDING
git checkout waste-pickup-scheduler
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The SQLite database is created automatically at `data/waste-pickup.db` on first run.

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
| GET    | `/api/pickups`     | List your pickups (`?status=`, `?waste_type=`, `?due_soon=1`) |
| GET    | `/api/pickups/:id` | Full pickup detail, including feedback                       |
| POST   | `/api/pickups`     | Schedule a pickup `{ waste_type, address, scheduled_date, time_window, recurrence, notes }` |
| PUT    | `/api/pickups/:id` | Update / reschedule / change status (auto-creates the next occurrence when a recurring pickup is resolved) |
| DELETE | `/api/pickups/:id` | Delete a pickup                                               |

### Feedback (nested under a pickup)

| Method | Endpoint                    | Description                                     |
|--------|------------------------------|--------------------------------------------------|
| POST   | `/api/pickups/:id/feedback`  | Leave feedback `{ rating (1-5), comment }` — only once a pickup is collected or missed |
| GET    | `/api/pickups/:id/feedback`  | View feedback for a pickup                       |

### Profile

| Method | Endpoint                  | Description                                         |
|--------|----------------------------|-------------------------------------------------------|
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
│   └── users.js           # Profile & password endpoints
└── public/
    ├── index.html          # Single-page frontend
    ├── style.css           # Styles (incl. dark mode)
    └── js/
        └── app.js          # Frontend logic
```

## License

MIT
