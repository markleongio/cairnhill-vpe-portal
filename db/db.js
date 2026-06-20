// db/db.js
// MySQL connection pool wrapper, using mysql2/promise. Exposes async
// all/get/run helpers with the same names as the original SQLite version,
// but now Promise-based — every call site must use `await`.
//
// Reads connection details from environment variables (see .env.example):
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
// Aiven and most managed MySQL providers also require SSL — see DB_SSL below.

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const connectionConfig = () => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Most managed MySQL hosts (Aiven, PlanetScale-likes) require TLS.
  // Set DB_SSL=false in .env to disable for purely local development.
  ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: true },
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

module.exports = { pool, all, get, run, ensureSchema };
