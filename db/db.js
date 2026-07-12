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

      // Allow current_level to be NULL: some progress entries don't have a
      // 5-level structure (e.g. a custom "DTM" entry recording an award/
      // designation rather than an in-progress path), so forcing a level
      // number on them doesn't make sense.
      const [levelColInfo] = await conn.query(
        "SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'member_progress' AND column_name = 'current_level'"
      );
      if (levelColInfo[0] && levelColInfo[0].IS_NULLABLE === 'NO') {
        await conn.query('ALTER TABLE member_progress MODIFY COLUMN current_level INT NULL');
        console.log('Migration: member_progress.current_level is now nullable');
      }

      // Allow the resource-library seed below to be idempotent (re-runnable
      // without creating duplicates) by ensuring a unique key on url exists
      // on databases created before this key was added to the schema.
      const [resUrlKey] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'resource_library' AND index_name = 'uniq_resource_url'"
      );
      if (resUrlKey[0].cnt === 0) {
        await conn.query('ALTER TABLE resource_library ADD UNIQUE KEY uniq_resource_url (url(255))');
        console.log('Migration: added unique key on resource_library.url');
      }

      console.log('Database schema and indexes verified/applied.');

      // Content seed: populate the pathway project library with the
      // official Toastmasters required-project curriculum, sourced from
      // Toastmasters International's "Pathways Competencies by Path"
      // catalog plus the official Toastmasters magazine and multiple
      // district checklists documenting the Nov 2021 "Level 1 Revision".
      // Level 1 is identical across every path (3 required projects: Ice
      // Breaker, Evaluation and Feedback, Researching and Presenting);
      // Levels 2-5 are path-specific. This covers required projects only —
      // Pathways also offers a shared pool of elective projects members can
      // choose per level, which isn't seeded here since the choice is
      // member-specific.
      //
      // Wrapped in its own try/catch: this is content seeding, not core
      // schema setup, so a bug here should never be able to block login or
      // any other core DB access (as happened once — a DELETE below missed
      // a foreign key from meeting_agenda and broke every request).
      try {
      const evalFormUrl2 = 'https://www.toastmasters.org/-/media/files/department-documents/pathways-program-documents/evaluation-forms';
      // Chinese titles below are sourced directly from the club's official
      // evaluation-forms library filenames (with explicit CS-codes), which
      // supersedes earlier best-guess translations and an earlier
      // over-correction that had wrongly trimmed Level 1 to 3 projects.
      const COMMON_L1 = [
        [1, '初试啼声演讲'],
        [2, '撰写带有目的性的演讲稿'],
        [3, '抑扬顿挫和肢体语言介绍'],
        [4, '评估与反馈'],
      ];
      const PATHWAY_PROJECT_SEED = {
        PM: { 2: [[1, '了解你的沟通风格'], [2, '有效的身体语言'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '应对棘手的听众']], 5: [[1, '为职业演讲做好准备'], [2, '反思你的学习路径']] },
        EH: { 2: [[1, '与听众交流'], [2, '了解幽默感'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '即兴演讲中增添幽默的威力']], 5: [[1, '发表包含幽默内容的演讲'], [2, '反思你的学习路径']] },
        PI: { 2: [[1, '主动倾听'], [2, '了解你的领导风格'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '在困境中领导']], 5: [[1, '高效领导力'], [2, '反思你的学习路径']] },
        DL: { 2: [[1, '了解你的领导风格'], [2, '了解你的沟通风格'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '管理变化']], 5: [[1, '应对不同情形的领导力'], [2, '反思你的学习路径']] },
        VC: { 2: [[1, '了解你的领导风格'], [2, '了解你的沟通风格'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '传达变化']], 5: [[1, '完善愿景'], [2, '反思你的学习路径']] },
        MS: { 2: [[1, '主动倾听'], [2, '了解你的沟通风格'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '激励他人']], 5: [[1, '团队建设'], [2, '反思你的学习路径']] },
        IP: { 2: [[1, '了解你的领导风格'], [2, '与听众交流'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '成功管理项目']], 5: [[1, '高效领导力'], [2, '反思你的学习路径']] },
        SR: { 2: [[1, '了解你的领导风格'], [2, '主动倾听'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '公共关系策略']], 5: [[1, '带领志愿者组织'], [2, '反思你的学习路径']] },
        EC: { 2: [[1, '了解你的领导风格'], [2, '了解你的沟通风格'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '积极教练下的成长']], 5: [[1, '高效领导力'], [2, '反思你的学习路径']] },
        LD: { 2: [[1, '时间管理'], [2, '了解你的领导风格'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '领导你的团队']], 5: [[1, '举办成功的活动'], [2, '反思你的学习路径']] },
        TC: { 2: [[1, '了解你的领导风格'], [2, '主动倾听'], [3, '介绍 Toastmasters 导师计划']], 4: [[1, '激励他人']], 5: [[1, '应对不同情形的领导力'], [2, '反思你的学习路径']] },
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
      let correctedLevel1Projects = 0;
      for (const code of Object.keys(PATHWAY_PROJECT_SEED)) {
        const level1Id = levelIdByCode[code + '-1'];
        if (level1Id) {
          // Force-correct Level 1 (UPSERT, not INSERT IGNORE) since some
          // paths — notably Presentation Mastery — still had stale
          // placeholder or outdated project titles sitting in these slots
          // from before this curriculum was verified against official
          // sources.
          for (const [projectNo, nameZh] of COMMON_L1) {
            const [r] = await conn.query(
              'INSERT INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url) VALUES (?,?,?,?,?,?) ' +
              'ON DUPLICATE KEY UPDATE project_name_zh = VALUES(project_name_zh), default_time_min = VALUES(default_time_min), default_time_max = VALUES(default_time_max), evaluation_form_url = VALUES(evaluation_form_url)',
              [level1Id, projectNo, nameZh, 5, 7, evalFormUrl2]
            );
            if (r.affectedRows > 0) correctedLevel1Projects++;
          }
        }
        const levels = PATHWAY_PROJECT_SEED[code];
        for (const levelNo of Object.keys(levels)) {
          const levelId = levelIdByCode[code + '-' + levelNo];
          if (!levelId) continue;
          // Force-correct Levels 2, 4, 5 too (UPSERT): the Chinese titles
          // previously seeded here were reasonable best-guess translations,
          // now replaced with the club's verified official wording.
          for (const [projectNo, nameZh] of levels[levelNo]) {
            const [r] = await conn.query(
              'INSERT INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url) VALUES (?,?,?,?,?,?) ' +
              'ON DUPLICATE KEY UPDATE project_name_zh = VALUES(project_name_zh), default_time_min = VALUES(default_time_min), default_time_max = VALUES(default_time_max), evaluation_form_url = VALUES(evaluation_form_url)',
              [levelId, projectNo, nameZh, 5, 7, evalFormUrl2]
            );
            if (r.affectedRows > 0) seededProjects++;
          }
        }

        // Elective pools: Level 3 has no fixed required project at all — a
        // member picks 2 from this full shared pool. Levels 4-5 add one
        // elective choice alongside the required project already seeded
        // above. Verified directly against the club's official evaluation-
        // forms library (explicit CS-codes). Added additively (INSERT
        // IGNORE) starting at project_no 10 so they never collide with each
        // path's required project_no slots, and skipped if the title
        // duplicates that path's own required project for that level.
        const ELECTIVE_POOLS = {
          3: ['研究和展示', '主动倾听', '与听众交流', '有效的身体语言', '了解幽默感', '故事产生共鸣', '创建高效的视觉辅助工具', '发表社交演讲', '制定沟通方案', '关注积极的一面', '激励你的听众', '通过社交建立关系', '商议最佳结果', '说服型演讲', '计划与实施', '为面谈做好准备', '提出建议', '达成共识', '成功合作', '了解抑扬顿挫', '使用描述性语言', '使用演示软件', '通过幽默感吸引听众', '掌握解决冲突的方法', '了解情商'],
          4: ['建立社交媒体影响力', '传达变化', '创建播客', '积极教练下的成长', '在困境中领导', '领导你的团队', '管理变化', '在线会议管理', '成功管理项目', '应对棘手的听众', '激励他人', '公共关系策略', '问答环节', '创建引人入胜的博客', '即兴演讲中增添幽默的威力'],
          5: ['完善愿景', '高尚领导力', '高效领导力', '应对不同情形的领导力', '带领志愿者组织', '有所认知', '举办成功的活动', '主持专题讨论', '为职业演讲做好准备', '反思你的学习路径', '团队建设', '发表包含幽默内容的演讲'],
        };
        for (const levelNo of Object.keys(ELECTIVE_POOLS)) {
          const levelId = levelIdByCode[code + '-' + levelNo];
          if (!levelId) continue;
          const requiredTitles = (levels[levelNo] || []).map(function (pair) { return pair[1]; });
          let seq = 10;
          for (const electiveName of ELECTIVE_POOLS[levelNo]) {
            if (requiredTitles.indexOf(electiveName) !== -1) continue; // don't duplicate this path's own required project
            const [r] = await conn.query(
              'INSERT IGNORE INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url) VALUES (?,?,?,?,?,?)',
              [levelId, seq, electiveName, 5, 7, evalFormUrl2]
            );
            if (r.affectedRows > 0) seededProjects++;
            seq++;
          }
        }
      }
      if (seededProjects > 0) {
        console.log(`Migration: seeded/corrected ${seededProjects} Level 2-5 pathway project row(s) with the official Toastmasters curriculum`);
      }
      if (correctedLevel1Projects > 0) {
        console.log(`Migration: corrected ${correctedLevel1Projects} Level 1 pathway project row(s) to match the official Toastmasters curriculum`);
      }


      // Correct the level titles: these were originally seeded with a
      // generic placeholder ("级别：一" etc). The official Toastmasters
      // Pathways level titles are the same across all 11 paths, so this
      // just fixes the label text for every level_no, unconditionally.
      const OFFICIAL_LEVEL_LABELS = {
        1: '级别一：掌握基础',
        2: '级别二：认识风格',
        3: '级别三：增进知识',
        4: '级别四：建立技能',
        5: '级别五：展现专业',
      };
      let relabeledLevels = 0;
      for (const levelNo of Object.keys(OFFICIAL_LEVEL_LABELS)) {
        const [r] = await conn.query(
          'UPDATE pathway_levels SET level_label = ? WHERE level_no = ? AND (level_label IS NULL OR level_label != ?)',
          [OFFICIAL_LEVEL_LABELS[levelNo], levelNo, OFFICIAL_LEVEL_LABELS[levelNo]]
        );
        relabeledLevels += r.affectedRows;
      }
      if (relabeledLevels > 0) {
        console.log(`Migration: corrected ${relabeledLevels} pathway level label(s) to the official Toastmasters titles`);
      }

      // Seed the Resource Library with the official Chinese evaluation
      // forms, organized by Pathways level. Files live as static assets
      // under public/resources/ and are served directly by Express.
      const RESOURCE_SEED = [
        ['Level 1 · 初试啼声演讲', 'evaluation', '/resources/L1-01.pdf'],
        ['Level 1 · 抑扬顿挫和肢体语言简介', 'evaluation', '/resources/L1-02.pdf'],
        ['Level 1 · 有目的地写演讲稿', 'evaluation', '/resources/L1-03.pdf'],
        ['Level 1 · 研究和展示', 'evaluation', '/resources/L1-04.pdf'],
        ['Level 1 · 评估与反馈 — 第一次演讲', 'evaluation', '/resources/L1-05.pdf'],
        ['Level 1 · 评估与反馈 — 第二次演讲', 'evaluation', '/resources/L1-06.pdf'],
        ['Level 1 · 评估与反馈 — 评估员演讲', 'evaluation', '/resources/L1-07.pdf'],
        ['Level 1 · 评估表格', 'evaluation', '/resources/L1-08.pdf'],
        ['Level 2 · 与听众交流', 'evaluation', '/resources/L2-01.pdf'],
        ['Level 2 · 主动倾听', 'evaluation', '/resources/L2-02.pdf'],
        ['Level 2 · 了解你的沟通风格', 'evaluation', '/resources/L2-03.pdf'],
        ['Level 2 · 了解你的领导风格', 'evaluation', '/resources/L2-04.pdf'],
        ['Level 2 · 了解幽默感', 'evaluation', '/resources/L2-05.pdf'],
        ['Level 2 · 介绍 Toastmasters 导师计划', 'evaluation', '/resources/L2-06.pdf'],
        ['Level 2 · 时间管理', 'evaluation', '/resources/L2-07.pdf'],
        ['Level 2 · 有效的身体语言', 'evaluation', '/resources/L2-08.pdf'],
        ['Level 2 · 跨文化理解', 'evaluation', '/resources/L2-09.pdf'],
        ['Level 3 · 与听众交流', 'evaluation', '/resources/L3-01.pdf'],
        ['Level 3 · 为面谈做好准备', 'evaluation', '/resources/L3-02.pdf'],
        ['Level 3 · 主动倾听', 'evaluation', '/resources/L3-03.pdf'],
        ['Level 3 · 了解幽默感', 'evaluation', '/resources/L3-04.pdf'],
        ['Level 3 · 了解情商', 'evaluation', '/resources/L3-05.pdf'],
        ['Level 3 · 了解抑扬顿挫', 'evaluation', '/resources/L3-06.pdf'],
        ['Level 3 · 使用描述性语言', 'evaluation', '/resources/L3-07.pdf'],
        ['Level 3 · 使用演示软件', 'evaluation', '/resources/L3-08.pdf'],
        ['Level 3 · 关注积极的一面', 'evaluation', '/resources/L3-09.pdf'],
        ['Level 3 · 创建高效的视觉辅助工具', 'evaluation', '/resources/L3-10.pdf'],
        ['Level 3 · 制定沟通方案', 'evaluation', '/resources/L3-11.pdf'],
        ['Level 3 · 发表社交演讲', 'evaluation', '/resources/L3-12.pdf'],
        ['Level 3 · 商议最佳结果', 'evaluation', '/resources/L3-13.pdf'],
        ['Level 3 · 成功合作', 'evaluation', '/resources/L3-14.pdf'],
        ['Level 3 · 掌握解决冲突的方法', 'evaluation', '/resources/L3-15.pdf'],
        ['Level 3 · 提出建议', 'evaluation', '/resources/L3-16.pdf'],
        ['Level 3 · 故事产生共鸣', 'evaluation', '/resources/L3-17.pdf'],
        ['Level 3 · 有效的身体语言', 'evaluation', '/resources/L3-18.pdf'],
        ['Level 3 · 激励你的听众', 'evaluation', '/resources/L3-19.pdf'],
        ['Level 3 · 研究和展示', 'evaluation', '/resources/L3-20.pdf'],
        ['Level 3 · 计划与实施', 'evaluation', '/resources/L3-21.pdf'],
        ['Level 3 · 说服型演讲', 'evaluation', '/resources/L3-22.pdf'],
        ['Level 3 · 达成共识 — 任务选项 1', 'evaluation', '/resources/L3-23.pdf'],
        ['Level 3 · 通过幽默感吸引听众', 'evaluation', '/resources/L3-24.pdf'],
        ['Level 3 · 通过社交建立关系', 'evaluation', '/resources/L3-25.pdf'],
        ['Level 4 · 传达变化', 'evaluation', '/resources/L4-01.pdf'],
        ['Level 4 · 公共关系策略', 'evaluation', '/resources/L4-02.pdf'],
        ['Level 4 · 创建博客', 'evaluation', '/resources/L4-03.pdf'],
        ['Level 4 · 创建引人入胜的博客', 'evaluation', '/resources/L4-04.pdf'],
        ['Level 4 · 即兴演讲中增添幽默的威力', 'evaluation', '/resources/L4-05.pdf'],
        ['Level 4 · 在困境中领导', 'evaluation', '/resources/L4-06.pdf'],
        ['Level 4 · 在线会议管理', 'evaluation', '/resources/L4-07.pdf'],
        ['Level 4 · 应对棘手的听众', 'evaluation', '/resources/L4-08.pdf'],
        ['Level 4 · 建立社交媒体影响力', 'evaluation', '/resources/L4-09.pdf'],
        ['Level 4 · 成功管理项目 — 第一次演讲', 'evaluation', '/resources/L4-10.pdf'],
        ['Level 4 · 指导', 'evaluation', '/resources/L4-11.pdf'],
        ['Level 4 · 激励他人', 'evaluation', '/resources/L4-12.pdf'],
        ['Level 4 · 积极教练下的成长', 'evaluation', '/resources/L4-13.pdf'],
        ['Level 4 · 管理变化', 'evaluation', '/resources/L4-14.pdf'],
        ['Level 4 · 问答环节', 'evaluation', '/resources/L4-15.pdf'],
        ['Level 4 · 领导你的团队', 'evaluation', '/resources/L4-16.pdf'],
        ['Level 5 · 360° 评估', 'evaluation', '/resources/L5-01.pdf'],
        ['Level 5 · 为职业演讲做好准备', 'evaluation', '/resources/L5-02.pdf'],
        ['Level 5 · 主持专题讨论', 'evaluation', '/resources/L5-03.pdf'],
        ['Level 5 · 举办成功的活动', 'evaluation', '/resources/L5-04.pdf'],
        ['Level 5 · 反思你的学习路径', 'evaluation', '/resources/L5-05.pdf'],
        ['Level 5 · 发表包含幽默内容的演讲', 'evaluation', '/resources/L5-06.pdf'],
        ['Level 5 · 团队建设 — 第一次演讲', 'evaluation', '/resources/L5-07.pdf'],
        ['Level 5 · 完善愿景 — 第一次演讲', 'evaluation', '/resources/L5-08.pdf'],
        ['Level 5 · 带领志愿者组织', 'evaluation', '/resources/L5-09.pdf'],
        ['Level 5 · 应对不同情形的领导力', 'evaluation', '/resources/L5-10.pdf'],
        ['Level 5 · 有所认知', 'evaluation', '/resources/L5-11.pdf'],
        ['Level 5 · 高尚领导力', 'evaluation', '/resources/L5-12.pdf'],
        ['Level 5 · 高效领导力 — 第一次演讲', 'evaluation', '/resources/L5-13.pdf'],
        ['Level 5 · 高级导师计划', 'evaluation', '/resources/L5-14.pdf'],
      ];
      let seededResources = 0;
      for (const [labelZh, category, url] of RESOURCE_SEED) {
        const [r] = await conn.query(
          'INSERT IGNORE INTO resource_library (label_zh, category, url) VALUES (?,?,?)',
          [labelZh, category, url]
        );
        if (r.affectedRows > 0) seededResources++;
      }

      // Second resource batch: the club's official CS-coded evaluation
      // forms library (explicit item codes), which is the definitive
      // source used to correct the pathway project data above.
      const RESOURCE_SEED_2 = [
        ['Level 1 · CS8100 评估与反馈', 'evaluation', '/resources/L1b-01.pdf'],
        ['Level 1 · CS8101 初试啼声演讲', 'evaluation', '/resources/L1b-02.pdf'],
        ['Level 1 · CS8103 撰写带有目的性的演讲稿', 'evaluation', '/resources/L1b-03.pdf'],
        ['Level 1 · CS8104 抑扬顿挫和肢体语言介绍', 'evaluation', '/resources/L1b-04.pdf'],
        ['Level 2 · CS8200 主动倾听', 'evaluation', '/resources/L2b-01.pdf'],
        ['Level 2 · CS8201 与听众交流', 'evaluation', '/resources/L2b-02.pdf'],
        ['Level 2 · CS8202 跨文化理解', 'evaluation', '/resources/L2b-03.pdf'],
        ['Level 2 · CS8203 有效的身体语言', 'evaluation', '/resources/L2b-04.pdf'],
        ['Level 2 · CS8204 介绍 Toastmasters 导师计划', 'evaluation', '/resources/L2b-05.pdf'],
        ['Level 2 · CS8205 时间管理', 'evaluation', '/resources/L2b-06.pdf'],
        ['Level 2 · CS8206 了解你的沟通风格', 'evaluation', '/resources/L2b-07.pdf'],
        ['Level 2 · CS8207 了解你的领导风格', 'evaluation', '/resources/L2b-08.pdf'],
        ['Level 2 · CS8208 了解幽默感', 'evaluation', '/resources/L2b-09.pdf'],
        ['Level 3 · CS8102 研究和展示', 'evaluation', '/resources/L3b-01.pdf'],
        ['Level 3 · CS8200 主动倾听', 'evaluation', '/resources/L3b-02.pdf'],
        ['Level 3 · CS8201 与听众交流', 'evaluation', '/resources/L3b-03.pdf'],
        ['Level 3 · CS8203 有效的身体语言', 'evaluation', '/resources/L3b-04.pdf'],
        ['Level 3 · CS8300 故事产生共鸣', 'evaluation', '/resources/L3b-05.pdf'],
        ['Level 3 · CS8301 创建高效的视觉辅助工具', 'evaluation', '/resources/L3b-06.pdf'],
        ['Level 3 · CS8302 发表社交演讲', 'evaluation', '/resources/L3b-07.pdf'],
        ['Level 3 · CS8303 制定沟通方案', 'evaluation', '/resources/L3b-08.pdf'],
        ['Level 3 · CS8304 关注积极的一面', 'evaluation', '/resources/L3b-09.pdf'],
        ['Level 3 · CS8305 激励你的听众', 'evaluation', '/resources/L3b-10.pdf'],
        ['Level 3 · CS8306 通过社交建立关系', 'evaluation', '/resources/L3b-11.pdf'],
        ['Level 3 · CS8307 商议最佳结果', 'evaluation', '/resources/L3b-12.pdf'],
        ['Level 3 · CS8308 说服型演讲', 'evaluation', '/resources/L3b-13.pdf'],
        ['Level 3 · CS8309 计划与实施', 'evaluation', '/resources/L3b-14.pdf'],
        ['Level 3 · CS8310 为面谈做好准备', 'evaluation', '/resources/L3b-15.pdf'],
        ['Level 3 · CS8312 提出建议', 'evaluation', '/resources/L3b-16.pdf'],
        ['Level 3 · CS8313 达成共识', 'evaluation', '/resources/L3b-17.pdf'],
        ['Level 3 · CS8314 成功合作', 'evaluation', '/resources/L3b-18.pdf'],
        ['Level 3 · CS8317 了解抑扬顿挫', 'evaluation', '/resources/L3b-19.pdf'],
        ['Level 3 · CS8318 使用描述性语言', 'evaluation', '/resources/L3b-20.pdf'],
        ['Level 3 · CS8319 使用演示软件', 'evaluation', '/resources/L3b-21.pdf'],
        ['Level 3 · CS8320 通过幽默感吸引听众', 'evaluation', '/resources/L3b-22.pdf'],
        ['Level 3 · CS8208 了解幽默感', 'evaluation', '/resources/L3b-23.pdf'],
        ['Level 3 · 掌握解决冲突的方法', 'evaluation', '/resources/L3b-24.pdf'],
        ['Level 3 · 了解情商', 'evaluation', '/resources/L3b-25.pdf'],
        ['Level 4 · CS8400 建立社交媒体影响力', 'evaluation', '/resources/L4b-01.pdf'],
        ['Level 4 · CS8401 传达变化', 'evaluation', '/resources/L4b-02.pdf'],
        ['Level 4 · CS8402 创建播客', 'evaluation', '/resources/L4b-03.pdf'],
        ['Level 4 · CS8403 积极教练下的成长', 'evaluation', '/resources/L4b-04.pdf'],
        ['Level 4 · CS8404 在困境中领导', 'evaluation', '/resources/L4b-05.pdf'],
        ['Level 4 · CS8405 领导你的团队', 'evaluation', '/resources/L4b-06.pdf'],
        ['Level 4 · CS8406 管理变化', 'evaluation', '/resources/L4b-07.pdf'],
        ['Level 4 · CS8407 在线会议管理', 'evaluation', '/resources/L4b-08.pdf'],
        ['Level 4 · CS8408 成功管理项目', 'evaluation', '/resources/L4b-09.pdf'],
        ['Level 4 · CS8409 应对棘手的听众', 'evaluation', '/resources/L4b-10.pdf'],
        ['Level 4 · CS8411 激励他人', 'evaluation', '/resources/L4b-11.pdf'],
        ['Level 4 · CS8412 公共关系策略', 'evaluation', '/resources/L4b-12.pdf'],
        ['Level 4 · CS8413 问答环节', 'evaluation', '/resources/L4b-13.pdf'],
        ['Level 4 · CS8414 创建引人入胜的博客', 'evaluation', '/resources/L4b-14.pdf'],
        ['Level 4 · CS8415 即兴演讲中增添幽默的威力', 'evaluation', '/resources/L4b-15.pdf'],
        ['Level 5 · CS8501 完善愿景', 'evaluation', '/resources/L5b-01.pdf'],
        ['Level 5 · CS8502 高尚领导力', 'evaluation', '/resources/L5b-02.pdf'],
        ['Level 5 · CS8503 高效领导力', 'evaluation', '/resources/L5b-03.pdf'],
        ['Level 5 · CS8504 应对不同情形的领导力', 'evaluation', '/resources/L5b-04.pdf'],
        ['Level 5 · CS8505 带领志愿者组织', 'evaluation', '/resources/L5b-05.pdf'],
        ['Level 5 · CS8506 有所认知', 'evaluation', '/resources/L5b-06.pdf'],
        ['Level 5 · CS8507 举办成功的活动', 'evaluation', '/resources/L5b-07.pdf'],
        ['Level 5 · CS8508 主持专题讨论', 'evaluation', '/resources/L5b-08.pdf'],
        ['Level 5 · CS8509 为职业演讲做好准备', 'evaluation', '/resources/L5b-09.pdf'],
        ['Level 5 · CS8510 反思你的学习路径', 'evaluation', '/resources/L5b-10.pdf'],
        ['Level 5 · CS8511 团队建设', 'evaluation', '/resources/L5b-11.pdf'],
        ['Level 5 · CS8512 发表包含幽默内容的演讲', 'evaluation', '/resources/L5b-12.pdf'],
      ];
      for (const [labelZh, category, url] of RESOURCE_SEED_2) {
        const [r] = await conn.query(
          'INSERT IGNORE INTO resource_library (label_zh, category, url) VALUES (?,?,?)',
          [labelZh, category, url]
        );
        if (r.affectedRows > 0) seededResources++;
      }

      if (seededResources > 0) {
        console.log(`Migration: seeded ${seededResources} resource(s) into the Resource Library`);
      }
      } catch (contentSeedErr) {
        // Never let a content-seeding issue block schema setup or login —
        // log it clearly and move on. The server keeps running either way.
        console.error('Content seed step failed (non-fatal, core schema is unaffected):', contentSeedErr.message);
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