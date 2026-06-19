// routes/exco.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

router.get('/roles', (req, res) => {
  res.json(all('SELECT * FROM exco_roles ORDER BY sort_order'));
});

router.get('/terms', (req, res) => {
  res.json(all('SELECT DISTINCT term_label FROM exco_terms ORDER BY term_label DESC'));
});

router.get('/terms/:termLabel', (req, res) => {
  const rows = all(
    `SELECT et.*, r.role_name_zh, r.role_name_en, r.sort_order AS role_order,
            m.full_name, m.chinese_name, m.member_no, m.id AS member_id
     FROM exco_terms et
     JOIN exco_roles r ON et.role_id = r.id
     JOIN members m ON et.member_id = m.id
     WHERE et.term_label = ?
     ORDER BY r.sort_order`,
    [decodeURIComponent(req.params.termLabel)]
  );
  res.json(rows);
});

router.post('/terms/:termLabel/assign', (req, res) => {
  const { role_id, member_id, designation, start_date, end_date } = req.body;
  const result = run(
    `INSERT INTO exco_terms (term_label, role_id, member_id, designation, start_date, end_date)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(term_label, role_id) DO UPDATE SET
       member_id = excluded.member_id, designation = excluded.designation,
       start_date = excluded.start_date, end_date = excluded.end_date`,
    [decodeURIComponent(req.params.termLabel), role_id, member_id, designation || null, start_date || null, end_date || null]
  );
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.delete('/terms/:termLabel/roles/:roleId', (req, res) => {
  run('DELETE FROM exco_terms WHERE term_label = ? AND role_id = ?', [decodeURIComponent(req.params.termLabel), req.params.roleId]);
  res.json({ ok: true });
});

router.get('/members/:memberId/history', (req, res) => {
  const rows = all(
    `SELECT et.*, r.role_name_zh, r.role_name_en
     FROM exco_terms et JOIN exco_roles r ON et.role_id = r.id
     WHERE et.member_id = ?
     ORDER BY et.start_date DESC`,
    [req.params.memberId]
  );
  res.json(rows);
});

module.exports = router;
