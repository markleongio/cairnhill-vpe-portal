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
| Original sheet's header/format retained, but sleeker | The print view keeps the navy masthead, gold crest, red theme bar, exco side-panel, and dress-code footer from the original, redrawn with consistent type, spacing, and a jade/gold accent palette instead of the original's cyan/red clash |

---

## 2. Tech stack

- Backend: Node.js + Express
- Database: SQLite via Node's built-in `node:sqlite` module (Node 22.5+),
  no native compilation required, which matters for easy self-hosting
  (no node-gyp, no Python toolchain, no platform-specific prebuilt binaries)
- Frontend: vanilla JS single-page app with a hash-based router, no build step.
  Fonts: Noto Serif SC for headings, Noto Sans SC for body, from Google Fonts.
  Icons: Tabler Icons via CDN
- Auth: express-session + bcryptjs

This was deliberately kept dependency-light so it can be deployed on almost
any cheap VPS, a Raspberry Pi, or a free-tier Node host without fighting
build toolchains.

---

## 3. Database schema

See `db/schema.sql` for the full DDL with comments. Summary of the model:

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

---

## 4. Project structure

```
cairnhill-vpe/
  server.js              Express app entry point, session config, route mounting
  package.json
  .env.example            Copy to .env and fill in SESSION_SECRET
  db/
    schema.sql            Full DDL (commented)
    db.js                  node:sqlite connection and query helpers
    seed.js                Reference data (pathways, exco roles) plus demo data
  routes/
    auth.js                Login, logout, session check
    members.js             Member CRUD plus progression tracking
    meetings.js            Meeting CRUD plus agenda builder endpoints
    pathways.js            Pathway/level/project lookup for dropdowns
    exco.js                 Exco role to member assignment per term
    resources.js            Resource library (evaluation forms etc.)
  public/
    index.html
    css/
      tokens.css            Design tokens: palette, type, buttons, forms
      layout.css            Sidebar shell, tables, agenda builder, print view
    js/
      api.js                 fetch() wrapper
      state.js                Global store and small UI helpers
      router.js               Hash-based router
      main.js                 Boot
      views/                   One file per screen
```

---

## 5. Running it locally

Requires Node.js 22.5 or newer, for built-in `node:sqlite`.

```bash
npm install
npm run seed     # creates db/cairnhill.db with reference data and a demo meeting
npm start         # http://localhost:3000
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

## 6. Deploying to your own host

Because there is no native module to compile, deployment is just copying the
folder and running it on anything with Node 22.5+:

1. Pick a host: a small VPS (Singapore region for low latency), or a
   Node-friendly PaaS.
2. Copy the project, run `npm install --omit=dev` and `npm run seed` once.
3. Set environment variables: copy `.env.example` to `.env` and set a real
   `SESSION_SECRET`.
4. Run behind a process manager so it restarts on crash or reboot:
   ```bash
   npm install -g pm2
   pm2 start server.js --name cairnhill-vpe
   pm2 save
   pm2 startup
   ```
5. Put it behind HTTPS. The simplest path is a small Caddy or nginx reverse
   proxy in front of port 3000, with a free Let's Encrypt certificate. Caddy
   is the easiest: a two-line Caddyfile handles HTTPS automatically.
6. Back up `db/cairnhill.db` regularly. It is a single file, so a simple cron
   job copying it to cloud storage is sufficient for a club's data volume.

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
