# 经禧华语讲演会 · 文教副会长管理平台
### Cairnhill Toastmasters — VP-Education Portal

A self-hosted web system for the VP-Education to track member progression
through the Pathways program and quickly assemble meeting agendas, modelled
on the club's existing meeting sheet but rebuilt as a structured, queryable
database with a clean web interface.

---

## 1. What this system does

| Requirement | How it's implemented |
|---|---|
| **(a)** Dropdown to choose speaking member/guest, pathway, and project number | The agenda row editor has a member/guest toggle, a pathway dropdown, and a project dropdown that cascades from the chosen pathway (`GET /api/pathways/:id/levels`) |
| **(b)** Each meeting is a record | `meetings` table — one row per meeting, with a full child collection of agenda items, visitors, and results, fetched as one JSON document via `GET /api/meetings/:id` |
| **(c)** Match members with exco roles | `exco_terms` joins `members` and `exco_roles` per committee year (`term_label`), editable from the exco screen |
| **(d)** Link resources (e.g. evaluation forms) to agenda items | `resource_library` holds reusable links; any agenda row can have a `resource_label` plus `resource_url` attached and it surfaces in both the editor and the printable agenda |
| Meeting is in Chinese | All UI copy, the print agenda, and seeded reference data are in Chinese, with English glosses for technical/admin labels |
| Authorized login | Session-cookie auth gated by bcrypt-hashed passwords; all API routes except auth require a session |
| Original sheet's header/format retained, but sleeker | The print view keeps the navy masthead, Toastmasters District 80 crest, red theme bar, exco side-panel, and dress-code footer from the original, redrawn with consistent type, spacing, and a jade/gold accent palette instead of the original's cyan/red clash |

**Second round of additions:**

| Requirement | How it's implemented |
|---|---|
| User account management | `/users` screen — full CRUD for login accounts, including changing passwords and deleting other admin accounts (all logged-in users are admins per club preference) |
| Chinese/English UI toggle | `public/js/i18n.js` — a small dictionary plus a `t(key)` helper; toggled from the sidebar, persisted in `localStorage`. Data fields (names, themes) are never translated |
| Masters module for admin-managed lists | `/masters` screen — manage agenda segment types and meeting-day duty roles (add/edit/deactivate) without touching code |
| Pathway → Level → Project dropdown on evaluation rows | Same cascading dropdown used for prepared speeches now also available wherever `requires_pathway` is set on the segment type |
| Auto-calculated agenda times | "Recalculate Times" button walks the agenda in order, adding each row's `duration_min` to the meeting's start time — no manual time entry needed |
| Evaluation-target dropdown | Evaluation-type segments show a dropdown of that meeting's prepared speeches; picking one auto-fills the speaker/title instead of re-typing |
| Edit/delete meetings | Both already supported via the meeting builder's delete button and inline field editing |
| Member/guest dropdown for every role | Both the agenda row's speaker/responsible-person fields and the meeting-day duty roles support "pick a member" or "type a guest name" |
| Admin-managed role master list | Meeting-day duty roles (礼宾司/司仪/计时员 etc.) live in `meeting_day_roles`, editable from `/masters`, reused meeting to meeting |
| District 80 Toastmasters logo on print agenda | `public/images/toastmasters-logo.jpg`, referenced in the print view's masthead |
| Per-member meeting-role history | A member's detail page lists every meeting-day duty role they've held, separate from their formal Exco committee history |

**Third round of additions:**

| Requirement | How it's implemented |
|---|---|
| Club Masters settings | `/masters` now also has a "Club Masters" section: club name, number, district, default meeting venue/day/time, tagline, mission statement, dress code — all stored in a single-row `club_settings` table |
| Default venue feeds new meetings | When creating a meeting, venue and meeting time pre-fill from Club Masters instead of a hardcoded string, editable per-meeting as before |
| Member phone/email fields | Already existed in the add-member form and database; added an edit button on the member detail page (previously had no way to update a member after creation) so phone/email — and other fields — can be changed later |
| Exco terms as records | New `exco_term_records` table — each committee term (e.g. "2024-2025年度经禧执委") is now a real record with start/end dates and status, manageable from the Exco page's "Exco Terms" button (add new terms, delete empty ones) |
| Exco term dropdown defaults to latest | Both the Exco roster page and the new-meeting form show a dropdown of real term records, sorted so the most recent term is selected by default |

---

## 2. Tech stack

- Backend: Node.js + Express
- Database: MySQL 8.0+, accessed via `mysql2/promise`. Built to run against
  a free managed MySQL host (Aiven) paired with a free compute host
  (Render) — see the deployment section below.
- Frontend: vanilla JS single-page app with a hash-based router, no build step.
  Fonts: Noto Serif SC for headings, Noto Sans SC for body, from Google Fonts.
  Icons: Tabler Icons via CDN
- Auth: express-session (MySQL-backed session store, so logins survive
  server restarts) + bcryptjs

---

## 3. Database schema

See `db/schema.mysql.sql` for the full DDL with comments. Summary of the model:

```
members ---- member_progress (which pathway, current level)
         |--- member_project_completion (project-by-project history)
         |--- exco_terms (role held, per committee year)
         '--- users (login account, optional, only exco need logins)

pathways -- pathway_levels (1-5) -- pathway_projects (the actual units/speeches)

meetings ---- meeting_agenda (one row per agenda line item)
         |       |--> speaker (member_id OR guest_name)
         |       |--> pathway_id + pathway_project_id (cascading dropdown)
         |       '--> resource_label/resource_url (linked evaluation form etc.)
         '--- visitors_log (visiting club friends)

exco_roles -- exco_terms (role x term x member join table)

resource_library -- reusable links, attachable to any agenda row
```

Design notes:

- `meeting_agenda` is intentionally flexible: a row can reference a
  registered member (`speaker_member_id`) or a free-text guest name
  (`speaker_guest_name`) via the `speaker_is_guest` flag, so the dropdown in
  condition (a) degrades gracefully for visitors not yet in the system.
- `agenda_item_types` drives which fields the UI shows per row. A
  `prepared_speech` row needs the pathway/project dropdowns; an `admin` row
  like 茶点时间 does not. This keeps the agenda builder generic instead of
  hard-coding row kinds in application code.
- Progression lives in two tables: `member_progress` is the current state
  (what level a member is at, in which pathway), while
  `member_project_completion` is the history (every individual project
  they have delivered, which meeting it was at, what they titled it). The
  dashboard reads from the first; the member detail timeline reads from
  the second.
- `exco_terms` is keyed by `term_label`, a free-text string like
  2024-2025年度经禧执委, rather than a separate terms table. This matches
  how the club already refers to committee years on its sheets, and keeps
  rolling over to a new committee year a one-line change.
- Tables use `INSERT ... ON DUPLICATE KEY UPDATE` for upserts (pathway
  enrollment, exco role assignment, project completion), matching unique
  keys defined on the relevant tables.
- Indexes (`idx_agenda_meeting`, `idx_progress_member`, etc.) are created on
  first boot by `db/db.js`, checked against `information_schema` so re-runs
  don't error.

---

## 4. Project structure

```
cairnhill-vpe/
  server.js              Express app entry point, session config, route mounting
  package.json
  .env.example            Copy to .env (locally) or set in your host's env settings
  db/
    schema.mysql.sql       Full DDL (commented)
    db.js                   MySQL connection pool, query helpers, schema bootstrap
    seed.js                 Reference data (pathways, exco roles) plus demo data
  routes/
    auth.js                 Login, logout, session check
    members.js              Member CRUD plus progression tracking
    meetings.js              Meeting CRUD plus agenda builder endpoints
    pathways.js              Pathway/level/project lookup for dropdowns
    exco.js                   Exco role to member assignment per term
    resources.js              Resource library (evaluation forms etc.)
  public/
    index.html
    css/
      tokens.css              Design tokens: palette, type, buttons, forms
      layout.css              Sidebar shell, tables, agenda builder, print view
    js/
      api.js                   fetch() wrapper
      state.js                  Global store and small UI helpers
      router.js                 Hash-based router
      main.js                   Boot
      views/                     One file per screen
```

---

## 5. Running it locally

Requires Node.js 18 or newer, and access to a MySQL 8.0+ server (local
install, or a free Aiven instance — see deployment section).

```bash
npm install
cp .env.example .env   # then fill in DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
npm run seed             # applies schema + reference data + a demo meeting
npm start                 # http://localhost:3000
```

Default login, created by the seed script:

```
username: vpe.heyunlong
password: ChangeMe!2026
```

Change this password immediately. Either add an admin "change password"
route (not yet built, see section 7), or re-hash manually:

```bash
node -e "console.log(require('bcryptjs').hashSync('YOUR_NEW_PASSWORD', 10))"
```

then update the `password_hash` column for that user directly in the database.

---

## 6. Deploying for free: Aiven (database) + Render (app)

This pairing was chosen specifically because it's genuinely free with no
expiring trial: Aiven's free MySQL tier is always-on with no credit card
required, and Render's free web service tier doesn't need a persistent
disk once the database lives on Aiven instead of locally.

### 6.1 — Set up Aiven MySQL

1. Sign up at aiven.io (no credit card needed for the free tier).
2. Create a new service: choose **MySQL**, pick the **Free plan**, choose a
   region close to your users.
3. Once provisioned, open the service's **Overview** page and note down:
   `Host`, `Port`, `User`, `Password`, `Default database name`.

### 6.2 — Push this project to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Make sure `.env` is never committed — `.gitignore` already excludes it.

### 6.3 — Deploy to Render

1. Sign up at render.com, connect your GitHub account.
2. **New** → **Web Service** → select this repository.
3. Build command: `npm install`. Start command: `npm start`.
4. Under **Environment**, add these variables (values from Aiven's Overview page):
   ```
   SESSION_SECRET=<a long random string>
   DB_HOST=<your-service>.aivencloud.com
   DB_PORT=<aiven port, e.g. 12345>
   DB_USER=avnadmin
   DB_PASSWORD=<your aiven password>
   DB_NAME=defaultdb
   ```
   Leave `DB_SSL` unset — Aiven requires SSL, and the app defaults to using it.
5. Deploy. Render will build and start the app automatically.
6. **Run the seed once**, via Render's Shell tab (under your service) or by
   temporarily setting the start command to `npm run seed && npm start` for
   one deploy, then reverting to `npm start`.

### 6.4 — Free tier behavior worth knowing

- Render's free web services **sleep after 15 minutes of inactivity** and
  take ~30-60 seconds to wake on the next request. This is fine for an
  internal club tool used a few times a week; it's mildly noticeable if you
  want it always-instant.
- Aiven's free MySQL plan has a storage cap (check current limits on their
  pricing page) — comfortably enough for a single club's data for years.

---

## 7. Known gaps and good next additions

This is a working blueprint, not a finished commercial product. Things you
may want to add before relying on it long-term:

- Password change/reset flow: currently passwords are only set via the seed
  script or a direct database edit.
- Drag-to-reorder agenda rows: the reorder endpoint exists, but the UI
  currently only supports editing one row's time/order via the row form,
  not drag-and-drop.
- Role-based permissions: `users.role` distinguishes admin/exco/viewer, but
  every authenticated route currently allows any logged-in user to edit
  anything. Tightening this, for example so only VPE/President can publish
  a meeting, is a small change applied per-route.
- Bulk member import: adding all members today is one at a time via the UI;
  a CSV import endpoint would help onboard the full roster faster.
- Audit log: who edited what, when, useful once multiple exco members have
  logins.
