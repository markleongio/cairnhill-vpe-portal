-- ============================================================================
-- Cairnhill Toastmasters Club (经禧华语讲演会) — VP-Education Portal
-- Database Schema (SQLite, via Node's built-in node:sqlite)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. USERS — login accounts (exco + optionally other members who need access)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  member_id     INTEGER REFERENCES members(id) ON DELETE SET NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',   -- 'admin' (VPE/Pres) | 'exco' | 'viewer'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- ----------------------------------------------------------------------------
-- 2. MEMBERS — every club member, including guests recorded for history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name        TEXT NOT NULL,
  chinese_name     TEXT,
  member_no        TEXT,                 -- club member number, e.g. 93875388
  phone            TEXT,
  email            TEXT,
  membership_type  TEXT NOT NULL DEFAULT 'member',  -- 'member' | 'guest'
  joined_date      TEXT,
  status           TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'alumni'
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 3. PATHWAYS — the 11 Pathways tracks (precomputed reference, per the bottom
--    legend in the original sheet: 精通演说/创新规划/...)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pathways (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,   -- e.g. 'PM', 'IP', 'EH'
  name_zh       TEXT NOT NULL,          -- 精通演说
  name_en       TEXT,                   -- Presentation Mastery
  sort_order    INTEGER DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 4. PATHWAY_LEVELS — Levels 1-5 within each pathway, each with projects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pathway_levels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pathway_id    INTEGER NOT NULL REFERENCES pathways(id) ON DELETE CASCADE,
  level_no      INTEGER NOT NULL,        -- 1 .. 5
  level_label   TEXT,                    -- '级别：一'
  UNIQUE(pathway_id, level_no)
);

-- ----------------------------------------------------------------------------
-- 5. PATHWAY_PROJECTS — individual projects/units within a level
--    e.g. 单元四: 第二次演讲 / 题目: 被打抢后的感觉 (the speech project + title)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pathway_projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id        INTEGER NOT NULL REFERENCES pathway_levels(id) ON DELETE CASCADE,
  project_no      INTEGER NOT NULL,       -- order within level
  project_name_zh TEXT NOT NULL,          -- 第二次演讲 (unit/project title)
  default_time_min INTEGER DEFAULT 5,
  default_time_max INTEGER DEFAULT 7,
  evaluation_form_url TEXT,               -- link to the relevant PDF/Google Form
  UNIQUE(level_id, project_no)
);

-- ----------------------------------------------------------------------------
-- 6. MEMBER_PROGRESS — tracks each member's progression through pathway
--    projects. This is the heart of "monitor my members' progression".
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_progress (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  pathway_id      INTEGER NOT NULL REFERENCES pathways(id),
  current_level   INTEGER NOT NULL DEFAULT 1,
  is_primary_pathway INTEGER NOT NULL DEFAULT 1,  -- 0/1, a member could run 2 pathways
  started_date    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, pathway_id)
);

CREATE TABLE IF NOT EXISTS member_project_completion (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  project_id      INTEGER NOT NULL REFERENCES pathway_projects(id) ON DELETE CASCADE,
  meeting_id      INTEGER REFERENCES meetings(id) ON DELETE SET NULL, -- which meeting they delivered it at
  speech_title    TEXT,                  -- their actual chosen title, e.g. 被打抢后的感觉
  status          TEXT NOT NULL DEFAULT 'completed', -- 'completed' | 'in_progress'
  completed_date  TEXT NOT NULL DEFAULT (date('now')),
  evaluator_id    INTEGER REFERENCES members(id),
  UNIQUE(member_id, project_id, meeting_id)
);

-- ----------------------------------------------------------------------------
-- 7. EXCO_ROLES — the defined committee positions (会长, 文教副会长, etc.)
--    Static reference list, matches the panel down the left of the sheet.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exco_roles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name_zh  TEXT NOT NULL,        -- 会长 / 文教副会长 / 会员副会长 ...
  role_name_en  TEXT,                 -- President / VP Education / VP Membership
  sort_order    INTEGER DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 8. EXCO_TERMS — who holds which role, for which committee year
--    (matches members to exco roles per term, e.g. "2024-2025年度经禧执委")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exco_terms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  term_label    TEXT NOT NULL,         -- '2024-2025年度经禧执委'
  role_id       INTEGER NOT NULL REFERENCES exco_roles(id),
  member_id     INTEGER NOT NULL REFERENCES members(id),
  designation   TEXT,                  -- 'LD2', 'DTM/PM5', 'CTM/CL/PM1' (Toastmasters honors)
  start_date    TEXT,
  end_date      TEXT,
  UNIQUE(term_label, role_id)
);

-- ----------------------------------------------------------------------------
-- 9. MEETINGS — each meeting is one record (condition b)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_no        TEXT,                 -- '第十六届第十二次例会'
  meeting_date      TEXT NOT NULL,        -- ISO date
  meeting_time      TEXT DEFAULT '19:00',
  venue             TEXT DEFAULT '经禧民众俱乐部，二楼会议室，1 Anthony Road, (S) 229944',
  theme             TEXT,                 -- '例会主题：万众一心，携手前进'
  term_label        TEXT,                 -- which exco term this falls under
  status            TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'completed'
  best_speaker_id   INTEGER REFERENCES members(id),
  best_evaluator_id INTEGER REFERENCES members(id),
  best_table_topics_id INTEGER REFERENCES members(id),
  dress_code        TEXT DEFAULT '女士服装端庄大方，男士衬衫长裤。欢迎公众人士观摩',
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 10. AGENDA_ITEM_TYPES — reference list of row "kinds" so the agenda builder
--     knows which fields to show (a speech row needs pathway+project dropdowns;
--     an admin row like 茶点时间 doesn't)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda_item_types (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type_key      TEXT NOT NULL UNIQUE,   -- 'prepared_speech' | 'evaluation' | 'admin' | 'role_task' | 'agm' | 'table_topics'
  label_zh      TEXT NOT NULL,
  requires_pathway INTEGER NOT NULL DEFAULT 0,
  requires_evaluator INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 11. MEETING_AGENDA — the actual line items of one meeting's program.
--     This is what condition (a) and (d) hang off: each row can reference
--     a member/guest, a pathway+project (the dropdown choices), and a
--     resource link (evaluation form etc).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_agenda (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id        INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  scheduled_time    TEXT,                  -- '7:00pm'
  item_type_id      INTEGER NOT NULL REFERENCES agenda_item_types(id),
  section_label     TEXT,                  -- bold section header e.g. '会员大会', '备稿演讲'
  summary_zh        TEXT NOT NULL,         -- 摘要 column text
  time_limit_min    INTEGER,
  time_limit_max    INTEGER,

  -- condition (a): dropdown-selected speaker/guest + pathway + project
  speaker_member_id INTEGER REFERENCES members(id),     -- NULL if a guest not in system
  speaker_guest_name TEXT,                              -- free text if guest not pre-registered
  speaker_is_guest  INTEGER NOT NULL DEFAULT 0,
  pathway_id        INTEGER REFERENCES pathways(id),
  pathway_project_id INTEGER REFERENCES pathway_projects(id),
  speech_title      TEXT,                  -- 题目: 被打抢后的感觉

  -- responsible / role person (讲员/负责会友 column)
  responsible_member_id INTEGER REFERENCES members(id),
  responsible_label TEXT,                  -- fallback free text, e.g. role designation snapshot

  -- condition (d): linked resource (evaluation form, ballot, etc.)
  resource_label    TEXT,                  -- '评估表'
  resource_url      TEXT,

  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 12. RESOURCE_LIBRARY — reusable links (evaluation forms per project type,
--     ballots, guest forms) that VPE can attach to agenda rows
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_library (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  label_zh      TEXT NOT NULL,           -- '备稿演讲评估表'
  category      TEXT,                    -- 'evaluation' | 'ballot' | 'guide' | 'other'
  url           TEXT NOT NULL,
  applies_to_type_id INTEGER REFERENCES agenda_item_types(id),
  notes         TEXT
);

-- ----------------------------------------------------------------------------
-- 13. VISITORS_LOG — 友会会友到访 (visiting club friends), linked per meeting
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id    INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  visitor_name  TEXT NOT NULL,
  home_club     TEXT,
  notes         TEXT
);

-- ----------------------------------------------------------------------------
-- Indexes for the lookups the app will do constantly
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agenda_meeting ON meeting_agenda(meeting_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_progress_member ON member_progress(member_id);
CREATE INDEX IF NOT EXISTS idx_completion_member ON member_project_completion(member_id);
CREATE INDEX IF NOT EXISTS idx_exco_term ON exco_terms(term_label);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
