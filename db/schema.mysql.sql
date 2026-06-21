-- ============================================================================
-- Cairnhill Toastmasters Club (经禧华语讲演会) — VP-Education Portal
-- Database Schema (MySQL 8.0+)
--
-- Converted from the original SQLite schema. Key differences from that
-- version: AUTO_INCREMENT instead of AUTOINCREMENT, CURRENT_TIMESTAMP/
-- CURRENT_DATE instead of datetime('now')/date('now'), explicit VARCHAR
-- lengths, and tables ordered so forward references aren't needed (MySQL
-- enforces FK target tables must already exist).
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 2. MEMBERS — every club member, including guests recorded for history
--    (created before USERS since users.member_id references this table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  full_name        VARCHAR(255) NOT NULL,
  chinese_name     VARCHAR(255),
  member_no        VARCHAR(50),
  phone            VARCHAR(50),
  email            VARCHAR(255),
  membership_type  VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_date      DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  notes            TEXT,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 1. USERS — login accounts (exco + optionally other members who need access)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  member_id     INT,
  role          VARCHAR(20) NOT NULL DEFAULT 'viewer',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. PATHWAYS — the 11 Pathways tracks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pathways (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(10) NOT NULL UNIQUE,
  name_zh       VARCHAR(100) NOT NULL,
  name_en       VARCHAR(100),
  sort_order    INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. PATHWAY_LEVELS — Levels 1-5 within each pathway
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pathway_levels (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  pathway_id    INT NOT NULL,
  level_no      INT NOT NULL,
  level_label   VARCHAR(50),
  UNIQUE KEY uniq_pathway_level (pathway_id, level_no),
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. PATHWAY_PROJECTS — individual projects/units within a level
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pathway_projects (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  level_id        INT NOT NULL,
  project_no      INT NOT NULL,
  project_name_zh VARCHAR(255) NOT NULL,
  default_time_min INT DEFAULT 5,
  default_time_max INT DEFAULT 7,
  evaluation_form_url VARCHAR(500),
  UNIQUE KEY uniq_level_project (level_id, project_no),
  FOREIGN KEY (level_id) REFERENCES pathway_levels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. EXCO_ROLES — the defined committee positions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exco_roles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role_name_zh  VARCHAR(100) NOT NULL,
  role_name_en  VARCHAR(100),
  sort_order    INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. EXCO_TERMS — who holds which role, for which committee year
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exco_terms (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  term_label    VARCHAR(100) NOT NULL,
  role_id       INT NOT NULL,
  member_id     INT NOT NULL,
  designation   VARCHAR(100),
  start_date    DATE,
  end_date      DATE,
  UNIQUE KEY uniq_term_role (term_label, role_id),
  FOREIGN KEY (role_id) REFERENCES exco_roles(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. MEETINGS — each meeting is one record (condition b)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  meeting_no        VARCHAR(100),
  meeting_date      DATE NOT NULL,
  meeting_time      VARCHAR(20) DEFAULT '19:00',
  venue             VARCHAR(500) DEFAULT '经禧民众俱乐部，二楼会议室，1 Anthony Road, (S) 229944',
  theme             VARCHAR(255),
  term_label        VARCHAR(100),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft',
  best_speaker_id   INT,
  best_evaluator_id INT,
  best_table_topics_id INT,
  dress_code        VARCHAR(500) DEFAULT '女士服装端庄大方，男士衬衫长裤。欢迎公众人士观摩',
  created_by        INT,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (best_speaker_id) REFERENCES members(id),
  FOREIGN KEY (best_evaluator_id) REFERENCES members(id),
  FOREIGN KEY (best_table_topics_id) REFERENCES members(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. MEMBER_PROGRESS / MEMBER_PROJECT_COMPLETION (after meetings, since
--    completion references meetings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_progress (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  member_id       INT NOT NULL,
  pathway_id      INT NOT NULL,
  current_level   INT NOT NULL DEFAULT 1,
  is_primary_pathway TINYINT NOT NULL DEFAULT 1,
  started_date    DATE,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_member_pathway (member_id, pathway_id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_project_completion (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  member_id       INT NOT NULL,
  project_id      INT NOT NULL,
  meeting_id      INT,
  speech_title    VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'completed',
  completed_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
  evaluator_id    INT,
  UNIQUE KEY uniq_member_project_meeting (member_id, project_id, meeting_id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES pathway_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL,
  FOREIGN KEY (evaluator_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. AGENDA_ITEM_TYPES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda_item_types (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type_key      VARCHAR(50) NOT NULL UNIQUE,
  label_zh      VARCHAR(100) NOT NULL,
  requires_pathway TINYINT NOT NULL DEFAULT 0,
  requires_evaluator TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. MEETING_AGENDA — the actual line items of one meeting's program
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_agenda (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id        INT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  scheduled_time    VARCHAR(20),
  item_type_id      INT NOT NULL,
  section_label     VARCHAR(255),
  summary_zh        VARCHAR(500) NOT NULL,
  time_limit_min    INT,
  time_limit_max    INT,

  speaker_member_id INT,
  speaker_guest_name VARCHAR(255),
  speaker_is_guest  TINYINT NOT NULL DEFAULT 0,
  pathway_id        INT,
  pathway_project_id INT,
  speech_title      VARCHAR(255),

  responsible_member_id INT,
  responsible_label VARCHAR(255),

  resource_label    VARCHAR(255),
  resource_url      VARCHAR(500),

  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (item_type_id) REFERENCES agenda_item_types(id),
  FOREIGN KEY (speaker_member_id) REFERENCES members(id),
  FOREIGN KEY (pathway_id) REFERENCES pathways(id),
  FOREIGN KEY (pathway_project_id) REFERENCES pathway_projects(id),
  FOREIGN KEY (responsible_member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. RESOURCE_LIBRARY — reusable links (evaluation forms etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_library (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  label_zh      VARCHAR(255) NOT NULL,
  category      VARCHAR(50),
  url           VARCHAR(500) NOT NULL,
  applies_to_type_id INT,
  notes         TEXT,
  FOREIGN KEY (applies_to_type_id) REFERENCES agenda_item_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. VISITORS_LOG — 友会会友到访 (visiting club friends), linked per meeting
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id    INT NOT NULL,
  visitor_name  VARCHAR(255) NOT NULL,
  home_club     VARCHAR(255),
  notes         TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
