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
  return { rejectUnauthorized: false };
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

      console.log('Database schema and indexes verified/applied.');
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
