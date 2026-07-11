// db/db.js
// MySQL connection pool wrapper, using mysql2/promise. Exposes async
// all/get/run helpers with the same names as the original SQLite version,
// but now Promise-based — every call site must use `await`.
//
// Reads connection details from environment variables (see .env.example):
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
//
// SSL: managed MySQL hosts like Aiven sign their certificate with their own
// CA, not a public one — so Node's default TLS verification rejects it as
// "self-signed" even though the connection is genuinely secure. The fix is
// to give Node that specific CA certificate to trust, via DB_CA_CERT (paste
// the full contents of Aiven's downloaded CA certificate, including the
// -----BEGIN CERTIFICATE----- / -----END CERTIFICATE----- lines, into that
// env var). If DB_CA_CERT isn't set, falls back to rejectUnauthorized:false
// (encrypted but unverified — fine for quick local testing, not ideal for
// production, hence the warning logged below).

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function buildSslConfig() {
  if (process.env.DB_SSL === 'false') return undefined;

  if (process.env.DB_CA_CERT) {
    // Render env vars sometimes arrive with literal "\n" instead of real
    // newlines if pasted oddly — normalize just in case.
    const ca = process.env.DB_CA_CERT.replace(/\\n/g, '\n');
    return { ca, rejectUnauthorized: true };
  }

  console.warn(
    'WARNING: DB_CA_CERT is not set. Connecting with rejectUnauthorized: false ' +
    '(encrypted but not verifying the server certificate). Set DB_CA_CERT to ' +
    "your database provider's CA certificate for a fully verified connection."
  );
  return { rejectUnauthorized: true, minVersion: "TLSv1.2" };
}

const connectionConfig = () => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: buildSslConfig(),
});

const pool = mysql.createPool(Object.assign({}, connectionConfig(), {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}));

// Indexes to ensure exist, checked/created individually in JS rather than
// via a MySQL stored procedure (avoids DELIMITER syntax, which mysql2's
// multi-statement mode can't parse).
const INDEXES = [
  ['meeting_agenda', 'idx_agenda_meeting', 'meeting_id, sort_order'],
  ['member_progress', 'idx_progress_member', 'member_id'],
  ['member_project_completion', 'idx_completion_member', 'member_id'],
  ['exco_terms', 'idx_exco_term', 'term_label'],
  ['meetings', 'idx_meetings_date', 'meeting_date'],
  ['meeting_role_assignments', 'idx_role_assignments_meeting', 'meeting_id'],
  ['meeting_role_assignments', 'idx_role_assignments_member', 'member_id'],
];

// Columns added after the initial deploy. CREATE TABLE IF NOT EXISTS won't
// retrofit columns onto a table that already exists (e.g. your live Aiven
// database from before this feature set), so these are added individually,
// checked against information_schema first so re-running this is safe.
const COLUMN_MIGRATIONS = [
  ['meeting_agenda', 'duration_min', 'INT'],
  ['meeting_agenda', 'responsible_is_guest', 'TINYINT NOT NULL DEFAULT 0'],
  ['meeting_agenda', 'evaluates_agenda_id', 'INT'],
  ['agenda_item_types', 'label_en', 'VARCHAR(100)'],
  ['agenda_item_types', 'requires_evaluates_selection', 'TINYINT NOT NULL DEFAULT 0'],
  ['agenda_item_types', 'is_active', 'TINYINT NOT NULL DEFAULT 1'],
  ['meetings', 'start_time_for_calc', 'VARCHAR(20)'],
  ['pathways', 'is_active', 'TINYINT NOT NULL DEFAULT 1'],
  ['meetings', 'footer_remarks', 'VARCHAR(1000)'],
];

let schemaReadyPromise = null;

// Applies schema.mysql.sql once on first use, then ensures indexes exist.
// Safe to call multiple times — every CREATE TABLE uses IF NOT EXISTS, and
// indexes are checked against information_schema before creating.
async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const schemaPath = path.join(__dirname, 'schema.mysql.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    const conn = await mysql.createConnection(Object.assign({}, connectionConfig(), {
      multipleStatements: true,
    }));
    try {
      await conn.query(schemaSql);

      for (const [table, column, definition] of COLUMN_MIGRATIONS) {
        const [existing] = await conn.query(
          'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
          [table, column]
        );
        if (existing.length === 0) {
          // table/column/definition come only from the fixed COLUMN_MIGRATIONS
          // constant above, never from user input, so string interpolation
          // here is safe (column/type names can't be parameterized in MySQL).
          await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
          console.log(`Migration: added column ${table}.${column}`);
        }
      }

      // Foreign key for the self-referencing evaluates_agenda_id column,
      // added separately since a freshly-added column can't declare its own
      // FK in the same ALTER on every MySQL version we want to support.
      const [fkExists] = await conn.query(
        "SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'meeting_agenda' AND constraint_name = 'fk_evaluates_agenda' LIMIT 1"
      );
      if (fkExists.length === 0) {
        await conn.query(
          'ALTER TABLE meeting_agenda ADD CONSTRAINT fk_evaluates_agenda ' +
          'FOREIGN KEY (evaluates_agenda_id) REFERENCES meeting_agenda(id) ON DELETE SET NULL'
        );
        console.log('Migration: added fk_evaluates_agenda constraint');
      }

      for (const [table, indexName, cols] of INDEXES) {
        const [existing] = await conn.query(
          'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
          [table, indexName]
        );
        if (existing.length === 0) {
          // Column/index names can't be parameterized — safe here since
          // INDEXES is a fixed constant above, not user input.
          await conn.query(`CREATE INDEX ${indexName} ON ${table} (${cols})`);
        }
      }

      // Backfill exco_term_records from any term_label values that already
      // exist in exco_terms (from before this formal-terms table existed),
      // so existing committee-year data shows up correctly in the new
      // Exco Term dropdown/management UI instead of being orphaned.
      const [distinctTerms] = await conn.query(
        'SELECT DISTINCT term_label FROM exco_terms WHERE term_label IS NOT NULL'
      );
      for (const row of distinctTerms) {
        await conn.query(
          'INSERT IGNORE INTO exco_term_records (term_label, status) VALUES (?, ?)',
          [row.term_label, 'active']
        );
      }

      // Allow multiple members to hold the same exco role concurrently: the
      // original unique key (term_label, role_id) permitted only one holder
      // per role per term. Widening it to include member_id still prevents
      // the same member being assigned to the same role twice, but allows
      // different members to co-hold a role (e.g. two Founding Sponsors).
      const [oldExcoKey] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'exco_terms' AND index_name = 'uniq_term_role'"
      );
      if (oldExcoKey[0].cnt > 0 && oldExcoKey[0].cnt < 3) {
        await conn.query('ALTER TABLE exco_terms DROP INDEX uniq_term_role');
        await conn.query('ALTER TABLE exco_terms ADD UNIQUE KEY uniq_term_role_member (term_label, role_id, member_id)');
        console.log('Migration: widened exco_terms unique key to (term_label, role_id, member_id)');
      }

      console.log('Database schema and indexes verified/applied.');

      // Content seed: populate the pathway project library with the
      // official Toastmasters required-project curriculum, sourced from
      // Toastmasters International's "Pathways Competencies by Path"
      // catalog (toastmasters.org). This only fills the level/project slots
      // for a given (level_id, project_no) that are still empty — it uses
      // INSERT IGNORE against the existing UNIQUE KEY, so any project
      // already added by hand (e.g. the original PM Level 1 / IP Level 2
      // seed data) is left untouched rather than being overwritten.
      // Level 1 is identical across every path; Levels 2-5 are path-specific.
      // This covers the required projects only — Pathways also offers a
      // shared pool of elective projects members can choose per level,
      // which isn't seeded here since the choice is member-specific.
      const evalFormUrl2 = 'https://www.toastmasters.org/-/media/files/department-documents/pathways-program-documents/evaluation-forms';
      const COMMON_L1 = [
        [1, '破冰演讲'],
        [2, '有目的的演讲写作'],
        [3, '声音变化与肢体语言入门'],
        [4, '评估与反馈'],
      ];
      const PATHWAY_PROJECT_SEED = {
        PM: { 2: [[1, '认识你的沟通风格'], [2, '有效的肢体语言'], [3, '认识导师计划']], 3: [[1, '说服性演讲']], 4: [[1, '应对难缠的听众']], 5: [[1, '准备专业演讲'], [2, '回顾你的学习路径']] },
        EH: { 2: [[1, '与听众建立连结'], [2, '认识你的幽默感'], [3, '认识导师计划']], 3: [[1, '用幽默吸引听众']], 4: [[1, '即席演讲中的幽默力量']], 5: [[1, '用幽默传递你的信息'], [2, '回顾你的学习路径']] },
        PI: { 2: [[1, '积极聆听'], [2, '认识你的领导风格'], [3, '认识导师计划']], 3: [[1, '认识冲突化解']], 4: [[1, '在困境中领导']], 5: [[1, '高效领导力'], [2, '回顾你的学习路径']] },
        DL: { 2: [[1, '认识你的领导风格'], [2, '认识你的沟通风格'], [3, '认识导师计划']], 3: [[1, '协商达成最佳结果']], 4: [[1, '管理变革']], 5: [[1, '在任何情境下领导'], [2, '回顾你的学习路径']] },
        VC: { 2: [[1, '认识你的领导风格'], [2, '认识你的沟通风格'], [3, '认识导师计划']], 3: [[1, '制定沟通计划']], 4: [[1, '沟通变革']], 5: [[1, '制定你的愿景'], [2, '回顾你的学习路径']] },
        MS: { 2: [[1, '积极聆听'], [2, '认识你的沟通风格'], [3, '认识导师计划']], 3: [[1, '认识情商']], 4: [[1, '激励他人']], 5: [[1, '团队建设'], [2, '回顾你的学习路径']] },
        IP: { 2: [[1, '认识你的领导风格'], [2, '与听众建立连结'], [3, '认识导师计划']], 3: [[1, '提案演讲']], 4: [[1, '成功管理项目']], 5: [[1, '高效领导力'], [2, '回顾你的学习路径']] },
        SR: { 2: [[1, '认识你的领导风格'], [2, '积极聆听'], [3, '认识导师计划']], 3: [[1, '透过人脉建立连结']], 4: [[1, '公共关系策略']], 5: [[1, '在志愿组织中领导'], [2, '回顾你的学习路径']] },
        EC: { 2: [[1, '认识你的领导风格'], [2, '认识你的沟通风格'], [3, '认识导师计划']], 3: [[1, '达成共识']], 4: [[1, '透过教练促进积极改善']], 5: [[1, '高效领导力'], [2, '回顾你的学习路径']] },
        LD: { 2: [[1, '时间管理'], [2, '认识你的领导风格'], [3, '认识导师计划']], 3: [[1, '规划与执行']], 4: [[1, '领导你的团队']], 5: [[1, '成功筹办活动'], [2, '回顾你的学习路径']] },
        TC: { 2: [[1, '认识你的领导风格'], [2, '积极聆听'], [3, '认识导师计划']], 3: [[1, '成功协作']], 4: [[1, '激励他人']], 5: [[1, '在任何情境下领导'], [2, '回顾你的学习路径']] },
      };

      const [seedPathways] = await conn.query('SELECT id, code FROM pathways');
      const [seedLevels] = await conn.query('SELECT id, pathway_id, level_no FROM pathway_levels');
      const levelIdByCode = {};
      for (const p of seedPathways) {
        for (const l of seedLevels) {
          if (l.pathway_id === p.id) levelIdByCode[p.code + '-' + l.level_no] = l.id;
        }
      }

      let seededProjects = 0;
      for (const code of Object.keys(PATHWAY_PROJECT_SEED)) {
        const level1Id = levelIdByCode[code + '-1'];
        if (level1Id) {
          for (const [projectNo, nameZh] of COMMON_L1) {
            const [r] = await conn.query(
              'INSERT IGNORE INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url) VALUES (?,?,?,?,?,?)',
              [level1Id, projectNo, nameZh, 5, 7, evalFormUrl2]
            );
            if (r.affectedRows > 0) seededProjects++;
          }
        }
        const levels = PATHWAY_PROJECT_SEED[code];
        for (const levelNo of Object.keys(levels)) {
          const levelId = levelIdByCode[code + '-' + levelNo];
          if (!levelId) continue;
          for (const [projectNo, nameZh] of levels[levelNo]) {
            const [r] = await conn.query(
              'INSERT IGNORE INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url) VALUES (?,?,?,?,?,?)',
              [levelId, projectNo, nameZh, 5, 7, evalFormUrl2]
            );
            if (r.affectedRows > 0) seededProjects++;
          }
        }
      }
      if (seededProjects > 0) {
        console.log(`Migration: seeded ${seededProjects} pathway project(s) from the official Toastmasters curriculum`);
      }
    } finally {
      await conn.end();
    }
  })();

  return schemaReadyPromise;
}

async function all(sql, params = []) {
  await ensureSchema();
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function get(sql, params = []) {
  await ensureSchema();
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

// Mirrors the shape the SQLite version returned: { lastInsertRowid, changes }
async function run(sql, params = []) {
  await ensureSchema();
  const [result] = await pool.query(sql, params);
  return {
    lastInsertRowid: result.insertId,
    changes: result.affectedRows,
  };
}

module.exports = { pool, all, get, run, ensureSchema, buildSslConfig };