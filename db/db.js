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
