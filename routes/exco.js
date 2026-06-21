// routes/exco.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

router.get('/roles', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM exco_roles ORDER BY sort_order'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/terms', async (req, res) => {
  try {
    res.json(await all('SELECT DISTINCT term_label FROM exco_terms ORDER BY term_label DESC'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/terms/:termLabel', async (req, res) => {
  try {
    const rows = await all(
      'SELECT et.*, r.role_name_zh, r.role_name_en, r.sort_order AS role_order, ' +
      'm.full_name, m.chinese_name, m.member_no, m.id AS member_id ' +
      'FROM exco_terms et JOIN exco_roles r ON et.role_id = r.id JOIN members m ON et.member_id = m.id ' +
      'WHERE et.term_label = ? ORDER BY r.sort_order',
      [decodeURIComponent(req.params.termLabel)]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/terms/:termLabel/assign', async (req, res) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO exco_terms (term_label, role_id, member_id, designation, start_date, end_date) VALUES (?,?,?,?,?,?) ' +
      'ON DUPLICATE KEY UPDATE member_id = VALUES(member_id), designation = VALUES(designation), ' +
      'start_date = VALUES(start_date), end_date = VALUES(end_date)',
      [decodeURIComponent(req.params.termLabel), b.role_id, b.member_id, b.designation || null, b.start_date || null, b.end_date || null]
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/terms/:termLabel/roles/:roleId', async (req, res) => {
  try {
    await run('DELETE FROM exco_terms WHERE term_label = ? AND role_id = ?', [decodeURIComponent(req.params.termLabel), req.params.roleId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/members/:memberId/history', async (req, res) => {
  try {
    const rows = await all(
      'SELECT et.*, r.role_name_zh, r.role_name_en FROM exco_terms et JOIN exco_roles r ON et.role_id = r.id ' +
      'WHERE et.member_id = ? ORDER BY et.start_date DESC',
      [req.params.memberId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
