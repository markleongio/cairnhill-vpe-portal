// db/db.js
// Thin wrapper around Node's built-in node:sqlite (no native compile needed).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cairnhill.db');
const db = new DatabaseSync(DB_PATH);

// Apply schema on boot (idempotent — uses IF NOT EXISTS everywhere)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Small helpers so route code reads cleanly
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

module.exports = { db, all, get, run };
