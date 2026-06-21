// routes/members.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

// IMPORTANT: this route must be registered before '/:id', otherwise Express
// would try to match "dashboard" as the :id param.
// Club-wide progression dashboard: every member + their furthest pathway level
router.get('/dashboard/overview', async (req, res) => {
  try {
    const rows = await all(`
      SELECT m.id, m.full_name, m.chinese_name, m.membership_type, m.status,
             p.code AS pathway_code, p.name_zh AS pathway_name, mp.current_level,
             (SELECT COUNT(*) FROM member_project_completion mpc WHERE mpc.member_id = m.id) AS total_completed
      FROM members m
      LEFT JOIN member_progress mp ON mp.member_id = m.id AND mp.is_primary_pathway = 1
      LEFT JOIN pathways p ON mp.pathway_id = p.id
      WHERE m.membership_type = 'member'
      ORDER BY m.full_name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all members, with optional search & status filter
router.get('/', async (req, res) => {
  try {
    const { q, status, type } = req.query;
    let sql = 'SELECT * FROM members WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (full_name LIKE ? OR chinese_name LIKE ? OR member_no LIKE ?)';
      params.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND membership_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY full_name';
    res.json(await all(sql, params));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Single member with full progression detail
router.get('/:id', async (req, res) => {
  try {
    const member = await get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const progress = await all(
      'SELECT mp.*, p.code, p.name_zh, p.name_en FROM member_progress mp JOIN pathways p ON mp.pathway_id = p.id WHERE mp.member_id = ?',
      [req.params.id]
    );

    const completions = await all(
      'SELECT mpc.*, pp.project_name_zh, pp.project_no, pl.level_no, p.name_zh AS pathway_name, p.code AS pathway_code, m.meeting_no, m.meeting_date ' +
      'FROM member_project_completion mpc ' +
      'JOIN pathway_projects pp ON mpc.project_id = pp.id ' +
      'JOIN pathway_levels pl ON pp.level_id = pl.id ' +
      'JOIN pathways p ON pl.pathway_id = p.id ' +
      'LEFT JOIN meetings m ON mpc.meeting_id = m.id ' +
      'WHERE mpc.member_id = ? ORDER BY mpc.completed_date DESC',
      [req.params.id]
    );

    const excoHistory = await all(
      'SELECT et.*, r.role_name_zh, r.role_name_en FROM exco_terms et JOIN exco_roles r ON et.role_id = r.id WHERE et.member_id = ? ORDER BY et.start_date DESC',
      [req.params.id]
    );

    res.json(Object.assign({}, member, { progress: progress, completions: completions, excoHistory: excoHistory }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.full_name) return res.status(400).json({ error: 'full_name required' });
    const result = await run(
      'INSERT INTO members (full_name, chinese_name, member_no, phone, email, membership_type, joined_date, notes) VALUES (?,?,?,?,?,?,?,?)',
      [b.full_name, b.chinese_name || null, b.member_no || null, b.phone || null, b.email || null, b.membership_type || 'member', b.joined_date || null, b.notes || null]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const fields = ['full_name', 'chinese_name', 'member_no', 'phone', 'email', 'membership_type', 'status', 'joined_date', 'notes'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(f + ' = ?');
        params.push(req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    await run('UPDATE members SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM members WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Progression management --------------------------------------------------

router.post('/:id/progress', async (req, res) => {
  try {
    const b = req.body;
    const isPrimary = b.is_primary_pathway === undefined ? 1 : b.is_primary_pathway;
    const result = await run(
      'INSERT INTO member_progress (member_id, pathway_id, current_level, is_primary_pathway, started_date) VALUES (?,?,?,?, CURDATE()) ' +
      'ON DUPLICATE KEY UPDATE current_level = VALUES(current_level), is_primary_pathway = VALUES(is_primary_pathway)',
      [req.params.id, b.pathway_id, b.current_level || 1, isPrimary]
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/progress/:pathwayId', async (req, res) => {
  try {
    await run(
      'UPDATE member_progress SET current_level = ?, updated_at = NOW() WHERE member_id = ? AND pathway_id = ?',
      [req.body.current_level, req.params.id, req.params.pathwayId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/completions', async (req, res) => {
  try {
    const b = req.body;
    if (!b.project_id) return res.status(400).json({ error: 'project_id required' });
    const result = await run(
      'INSERT INTO member_project_completion (member_id, project_id, meeting_id, speech_title, evaluator_id, status, completed_date) VALUES (?,?,?,?,?,?, CURDATE()) ' +
      'ON DUPLICATE KEY UPDATE speech_title = VALUES(speech_title), evaluator_id = VALUES(evaluator_id), status = VALUES(status)',
      [req.params.id, b.project_id, b.meeting_id || null, b.speech_title || null, b.evaluator_id || null, b.status || 'completed']
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
