# 3MTT Capstone Project — Conventions & Preferences

This file captures the conventions established while building this student's 3MTT
(3 Million Technical Talent) Software Development capstone projects, so future
sessions/projects in this repo follow the same approach automatically. Read this
before starting a new capstone project or making significant changes to an
existing one.

## Repo layout: one branch per project

This repo hosts multiple, unrelated capstone projects (e.g. TaskFlow — a task
manager — and EcoPickup — a waste pickup scheduler), each on its **own branch**,
with the project's files at the **branch root** (not a subfolder). This keeps
`npm start` and Render's default root-directory config working with zero extra
setup.

- **Why branches, not separate repos:** this session's GitHub App connection can
  push to existing repos but returns 403 when trying to create a new repo via
  the API (it lacks repo-creation permission). Don't retry — either ask the user
  to create a new repo manually, or put the new project on a new branch instead.
- **Starting a new project on a new branch:** `git checkout -b <new-branch-name>`
  from whichever branch, then `git rm` the previous project's files before
  building the new one — don't nest projects in folders on the same branch.
- Because the *default* branch is whichever project happened to be pushed
  first, always give the user the **full branch URL**
  (`.../tree/<branch-name>`) when they need to link to a specific project —
  the bare repo URL may land on the wrong one.

## Tech stack (use this by default unless the user asks for something else)

- **Backend:** Node.js + Express 5.
- **Database:** SQLite via Node's **built-in `node:sqlite`** module — *not*
  `better-sqlite3` or other native packages. Native modules need a C++
  compiler/Visual Studio Build Tools to install, which fails on many Windows
  setups; `node:sqlite` avoids that entirely. Requires Node ≥22.5.0 — add an
  `"engines": { "node": ">=22.5.0" }` field to `package.json`. The API is
  drop-in compatible with `better-sqlite3` (`db.prepare(...).run/get/all`,
  `lastInsertRowid`, `changes`), so this is a safe swap either way.
- **Auth:** `bcryptjs` for password hashing + `jsonwebtoken` for sessions, a
  small Express middleware, `JWT_SECRET` read from `process.env` with a dev
  fallback.
- **Frontend:** vanilla HTML/CSS/JS single-page app, no framework, no build
  step — keeps setup to just `npm install && npm start`. Split large frontend
  logic into `public/js/app.js` plus small focused modules (e.g.
  `public/js/charts.js`) loaded via plain `<script>` tags (not ES modules) —
  simpler, no bundler needed, fewer things that can break.

## Design philosophy: avoid the "AI-generated" look

The user explicitly cares about this — don't let a rebuild regress it.

- **Never use emoji as functional UI icons** (buttons, nav items, badges,
  status indicators). Hand-write small inline SVG icons instead: simple
  stroke-based shapes (`stroke="currentColor"`, ~1.6 stroke-width, rounded
  linecap/linejoin), stored as strings in an `ICONS` map in `app.js` and
  wrapped in `<span class="icon">`.
- **Typography:** pair a distinctive display serif for headings/wordmark
  (Fraunces has worked well, via Google Fonts) with a clean sans for
  body/UI text (Inter) — not the default system font stack everywhere.
- **Color palette:** warm/earthy, deliberate tones (cream background, deep
  moss green primary, rust/ochre accent) rather than generic cold-gray +
  saturated-blue/purple SaaS-template colors. Define both a light and a dark
  palette as CSS custom properties.
- Prefer small rectangular tags / icon chips / dot-prefixed status
  indicators over pill-badges on every piece of metadata — pill overload
  reads as templated.
- **Auth screens:** avoid a plain centered floating card on a gradient
  background (the single most common AI-template tell). Use a real
  split-panel layout — brand messaging/tagline/value-props on one side, the
  form on the other. On mobile, don't just hide the brand panel entirely (it
  leaves the form stranded in empty vertical space) — show a compact version
  instead.
- **For any full app** (not a one-page tool), build a proper sidebar-driven
  dashboard: Dashboard / primary-list / calendar-or-relevant-view /
  Analytics / Settings navigation, with a mobile hamburger toggle that
  slides the sidebar in as an overlay. This mirrors real SaaS products
  (Linear, Stripe dashboard) and is what "make it look professional, not
  AI-generated" concretely means in practice.
- **Dark mode:** implement via CSS custom properties + a `data-theme`
  attribute on `<html>`, toggled by JS; switch the sun/moon icon via CSS
  visibility rules keyed off `[data-theme="dark"]`, not by swapping text/SVG
  in JS.
- **Analytics/charts:** hand-roll small dependency-free inline SVG charts
  (donut, bar, line — see `public/js/charts.js` pattern) rather than pulling
  in a charting library. Keeps the app dependency-light and the charts
  on-brand (they can use `var(--primary)` etc. directly in SVG `fill`/
  `stroke` presentation attributes in modern browsers).
- When adding a genuinely useful "stand out" feature, prefer ones that reuse
  existing data/components (e.g. a calendar view that reuses the same
  pickup/task card renderer for a day's items) over bolting on unrelated
  complexity.

## Testing rigor — always do this before calling a feature done

1. **Backend first:** test every new/changed endpoint with `curl` — happy
   path, validation errors, auth checks (401 without token) — before
   touching the frontend.
2. **Then the frontend, in a real browser:** start the server, then drive it
   with a headless Chromium script using `playwright-core` (already
   available in this sandbox):
   - `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`
   - `args: ['--no-sandbox']`
   - Install `playwright-core` with `npm install playwright-core --no-save`
     in the scratchpad dir if missing — don't run `playwright install`.
   - Capture `pageerror` and console `error` events; fail loudly on real
     ones. The only known non-bug flake in this sandbox is an occasional
     `ERR_CONNECTION_RESET` on the Google Fonts CDN request — verified via
     `curl` that the hosts are actually reachable, so treat that one
     specific error as a harmless headless-network blip, not a real issue.
3. **Take screenshots at key steps and actually look at them** — don't just
   trust "no errors thrown". Visual review has caught real bugs before:
   clipped/overlapping chart axis labels, a mobile auth layout with the
   brand panel hidden leaving the form stranded in empty space, and a CSS
   specificity bug (`.modal form` beating `.inline-form`) that silently
   broke a form's row layout.
4. When something looks visually suspicious in a screenshot (e.g. a button
   that looks unexpectedly faded), **investigate with computed-style
   inspection** via a Playwright `evaluate()` call before concluding it's a
   bug — a screenshot taken in the same tick as a state-changing click can
   catch a genuine repaint-timing artifact that a real user would never see
   (confirmed this twice: once for a dark-mode button color, once for a
   calendar cell background that turned out to be a legitimate keyboard
   focus ring).
5. **Server restart gotcha in this sandbox:** chaining `pkill` with other
   commands in one Bash call sometimes returns a confusing exit code or
   silently fails to actually kill the process (leaving a stale server
   bound to port 3000, which then serves stale/duplicate data on the "new"
   run). Always verify with `ps aux | grep "node.*server.js"` and
   `curl .../api/health` after any restart attempt — don't assume it worked
   from the exit code alone.
6. Wipe `data/` before a clean test run (`rm -rf data`) so tests start from
   an empty database.

## Deployment

- **Recommend Render.com** for these apps by default: free tier, deploys
  directly from a GitHub branch (no need to merge to `main` first), simple
  dashboard setup — Build Command `npm install`, Start Command `npm start`.
  Explain the free-tier tradeoffs plainly: it spins down after ~15 min idle
  (30–50s cold-start on the next request), and the disk resets on
  redeploy/restart unless the user pays for a small persistent disk
  (~$1/mo).
- **Vercel is a poor fit** for these apps as built — it runs serverless
  functions with no persistent local disk, so the `node:sqlite` file would
  get wiped or fail to persist between requests. Flag this clearly before
  the user wastes time on it; offer Render/Railway/Fly instead, or (if they
  insist on Vercel) offer to swap in a hosted DB like Turso.
- **JWT_SECRET:** generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  One distinct secret per deployed app, reused consistently for that same
  app across redeploys — don't regenerate on every question, and don't reuse
  one app's secret for a different app.

## Demo videos

- Default to recording an **automated headless-browser walkthrough**
  (Playwright `recordVideo` on the browser context) rather than asking the
  user to record themselves — unless they say they specifically need to
  narrate/present it themselves for their submission.
- Add a small fake cursor dot via `context.addInitScript` (a fixed-position
  div that follows `mousemove`) so clicks are visible — headless mode has no
  real cursor otherwise.
- Use a `smoothClick` helper (interpolated `mouse.move` with `steps`, then
  `down`/`up` with a short pause) and `page.type(selector, text, { delay })`
  for natural-looking movement/typing instead of instant `.click()`/`.fill()`.
- Cover the full feature set in roughly 50–90 seconds: auth, core CRUD, any
  standout feature (recurrence, drag-and-drop, calendar, etc.), analytics/
  dashboard, dark mode, settings.
- Deliver as **`.webm`** — this sandbox's bundled ffmpeg
  (`/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`) can only encode VP8/webm, not
  H.264/mp4 (no `libx264`), and installing a fuller ffmpeg via `apt` doesn't
  reliably work here (repo 404s). This is fine: both YouTube and Google
  Drive accept `.webm` uploads directly, and it plays natively in modern
  browsers.
- Send the finished file via `SendUserFile`, and always add the honest
  caveat that it's an automated recording over sample data, not a live
  deployment or personal narration — in case the submission specifically
  requires the latter.

## Submission logistics (3MTT-specific)

- Assignment tables list deliverables like *"Deployed link or runnable
  repo, source code, README, 2–3 min demo video"* — that's an
  either/or for the first item (a live deployed link **or** a runnable
  repo), plus source code + README (covered by the GitHub link) and the
  video, as separate items. If the submission form has one link field,
  the **deployed link** is the one to submit (it's what a grader can
  actually click and use); mention the GitHub link in the README or a
  notes field.
- Confirm repo visibility before telling the user "anyone with the link"
  works — check via
  `curl -s https://api.github.com/repos/<owner>/<repo>` (no auth needed)
  and read the `"private"` field; a private repo needs to be made public
  or the grader needs explicit access.
