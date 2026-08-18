# TaskFlow — 3MTT Task Manager

A full-stack task management web application built as a capstone project for the **3MTT (3 Million Technical Talent) Software Development track**.

TaskFlow lets users create an account, organize work into projects, track tasks on a list or a drag-and-drop Kanban board, break tasks into subtasks, tag and comment on them, and see their productivity on an analytics dashboard.

## Features

- **User accounts** — register and log in with secure password hashing (bcrypt) and JWT-based sessions; edit your profile and change your password
- **Projects** — organize tasks into color-coded projects
- **Tags** — flexible, color-coded labels you can attach to any task
- **List view** — the classic task list with search and filters
- **Kanban board** — drag and drop tasks between To Do / In Progress / Done columns
- **Subtasks** — break a task into a checklist with a live progress bar
- **Comments** — leave notes on a task as you work through it
- **Analytics dashboard** — custom SVG charts for tasks by status, tasks by priority, and a 14-day completion trend, plus completion-rate and overdue stats
- **Notifications** — a bell icon that surfaces tasks due soon or overdue
- **Dark mode** — toggle with a saved preference
- **Due dates** — with overdue highlighting
- **Responsive UI** — works on desktop and mobile, with a collapsible sidebar

## Tech Stack

| Layer     | Technology                             |
|-----------|-----------------------------------------|
| Backend   | Node.js, Express 5                      |
| Database  | SQLite (Node's built-in `node:sqlite`)  |
| Auth      | bcryptjs (hashing), jsonwebtoken        |
| Frontend  | HTML, CSS, vanilla JavaScript (SPA), custom dependency-free SVG charts |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22.5 or newer (uses the built-in `node:sqlite` module — no compiler or build tools needed)

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

All endpoints below (except `/api/auth/*` and `/api/health`) require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint             | Description                            |
|--------|----------------------|----------------------------------------|
| POST   | `/api/auth/register` | Create account `{ name, email, password }` |
| POST   | `/api/auth/login`    | Log in `{ email, password }` → returns JWT |

### Tasks

| Method | Endpoint         | Description                                          |
|--------|------------------|------------------------------------------------------|
| GET    | `/api/tasks`     | List your tasks (`?status=`, `?priority=`, `?search=`, `?project_id=`, `?tag_id=`, `?due_soon=1`) |
| GET    | `/api/tasks/:id` | Full task detail, including tags, subtasks, comments |
| POST   | `/api/tasks`     | Create task `{ title, description, priority, status, due_date, project_id, tag_ids }` |
| PUT    | `/api/tasks/:id` | Update any task field                                |
| DELETE | `/api/tasks/:id` | Delete a task                                        |

### Subtasks & comments (nested under a task)

| Method | Endpoint                              | Description               |
|--------|----------------------------------------|----------------------------|
| GET/POST | `/api/tasks/:id/subtasks`            | List / add a subtask `{ title }` |
| PUT/DELETE | `/api/tasks/:id/subtasks/:subId`   | Toggle/rename or delete a subtask |
| GET/POST | `/api/tasks/:id/comments`            | List / add a comment `{ body }` |
| DELETE | `/api/tasks/:id/comments/:commentId`   | Delete a comment          |

### Projects & tags

| Method | Endpoint            | Description                          |
|--------|---------------------|---------------------------------------|
| GET/POST | `/api/projects`   | List / create a project `{ name, color }` |
| PUT/DELETE | `/api/projects/:id` | Update / delete a project        |
| GET/POST | `/api/tags`       | List / create a tag `{ name, color }` |
| DELETE | `/api/tags/:id`     | Delete a tag                          |

### Analytics & profile

| Method | Endpoint               | Description                              |
|--------|------------------------|-------------------------------------------|
| GET    | `/api/analytics`       | Status/priority breakdown, completion rate, overdue count, 14-day trend |
| GET/PUT | `/api/users/me`       | View / update your profile `{ name }`     |
| PUT    | `/api/users/me/password` | Change password `{ current_password, new_password }` |

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
│   ├── tasks.js           # Task, subtask & comment endpoints
│   ├── projects.js        # Project endpoints
│   ├── tags.js             # Tag endpoints
│   ├── users.js            # Profile & password endpoints
│   └── analytics.js        # Analytics dashboard endpoint
└── public/
    ├── index.html          # Single-page frontend
    ├── style.css           # Styles (incl. dark mode)
    └── js/
        ├── charts.js       # Dependency-free SVG chart helpers
        └── app.js           # Frontend logic
```

## License

MIT
