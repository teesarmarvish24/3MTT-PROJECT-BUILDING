# TaskFlow — 3MTT Task Manager

A full-stack task management web application built as a capstone project for the **3MTT (3 Million Technical Talent) Software Development track**.

TaskFlow lets users create an account, then create, organize, filter, and track their tasks with priorities, statuses, and due dates.

## Features

- **User accounts** — register and log in with secure password hashing (bcrypt) and JWT-based sessions
- **Task management** — create, edit, complete, and delete tasks
- **Priorities** — low / medium / high, with color-coded task cards
- **Statuses** — pending, in progress, completed
- **Due dates** — with overdue highlighting
- **Search & filters** — filter tasks by status, priority, or keyword search
- **Dashboard stats** — live counts of total, pending, in-progress, and completed tasks
- **Responsive UI** — works on desktop and mobile

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js, Express 5                  |
| Database  | SQLite (better-sqlite3)             |
| Auth      | bcryptjs (hashing), jsonwebtoken    |
| Frontend  | HTML, CSS, vanilla JavaScript (SPA) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer

### Installation

```bash
git clone https://github.com/teesarmarvish24/3MTT-PROJECT-BUILDING.git
cd 3MTT-PROJECT-BUILDING
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The SQLite database is created automatically at `data/taskflow.db` on first run.

For development with auto-reload:

```bash
npm run dev
```

To use a custom port or JWT secret:

```bash
PORT=4000 JWT_SECRET=your-secret npm start
```

## API Reference

All task endpoints require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint             | Description                            |
|--------|----------------------|----------------------------------------|
| POST   | `/api/auth/register` | Create account `{ name, email, password }` |
| POST   | `/api/auth/login`    | Log in `{ email, password }` → returns JWT |

### Tasks

| Method | Endpoint         | Description                                          |
|--------|------------------|------------------------------------------------------|
| GET    | `/api/tasks`     | List your tasks (`?status=`, `?priority=`, `?search=`) |
| POST   | `/api/tasks`     | Create task `{ title, description, priority, due_date }` |
| PUT    | `/api/tasks/:id` | Update any task field                                |
| DELETE | `/api/tasks/:id` | Delete a task                                        |

### Other

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| GET    | `/api/health` | Server health check |

## Project Structure

```
├── server.js              # Express app entry point
├── db.js                  # SQLite setup and schema
├── middleware/
│   └── authenticate.js    # JWT verification middleware
├── routes/
│   ├── auth.js            # Register / login endpoints
│   └── tasks.js           # Task CRUD endpoints
└── public/
    ├── index.html         # Single-page frontend
    ├── style.css          # Styles
    └── app.js             # Frontend logic
```

## License

MIT
