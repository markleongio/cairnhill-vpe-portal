// routes/pathways.js
const express = require('express');
const { all, get, run } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// By default only active pathways are returned (what the "Register New
// Pathway" dropdown on the member page should show). Pass ?all=true to get
// everything including retired ones — used by the Masters Settings admin
// table so retired pathways are still visible there for reactivation.
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    const sql = 'SELECT * FROM pathways' + (includeInactive ? '' : ' WHERE is_active = 1') + ' ORDER BY sort_order, id';
    res.json(await all(sql));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create a new pathway (condition: masters-managed pathway list)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    if (!b.code || !b.name_zh) return res.status(400).json({ error: 'code and name_zh required' });
    const existing = await get('SELECT id FROM pathways WHERE code = ?', [b.code]);
    if (existing) return res.status(409).json({ error: '此代码已存在 / Pathway code already exists' });
    const maxOrder = await get('SELECT MAX(sort_order) AS mo FROM pathways');
    const sortOrder = b.sort_order !== undefined ? b.sort_order : ((maxOrder.mo === null ? -1 : maxOrder.mo) + 1);
    const result = await run(
      'INSERT INTO pathways (code, name_zh, name_en, sort_order, is_active) VALUES (?,?,?,?,1)',
      [b.code, b.name_zh, b.name_en || null, sortOrder]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: edit an existing pathway
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const fields = ['code', 'name_zh', 'name_en', 'sort_order', 'is_active'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(f + ' = ?');
        params.push(req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    if (req.body.code !== undefined) {
      const dupe = await get('SELECT id FROM pathways WHERE code = ? AND id != ?', [req.body.code, req.params.id]);
      if (dupe) return res.status(409).json({ error: '此代码已存在 / Pathway code already exists' });
    }
    params.push(req.params.id);
    await run('UPDATE pathways SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: retire (soft-delete) a pathway, or hard-delete with ?force=true if
// nothing references it. Members' progress and meeting agenda rows both FK
// to pathways with the default RESTRICT behaviour, so a hard delete while
// in use would fail at the DB level anyway — this just gives a friendlier
// error message first, matching the pattern used for item-types/meeting-roles.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (req.query.force === 'true') {
      const inProgress = await get('SELECT COUNT(*) AS c FROM member_progress WHERE pathway_id = ?', [req.params.id]);
      const inAgenda = await get('SELECT COUNT(*) AS c FROM meeting_agenda WHERE pathway_id = ?', [req.params.id]);
      if (inProgress.c > 0 || inAgenda.c > 0) {
        return res.status(409).json({ error: '此路径已被会员进度或议程记录使用，无法删除 / Pathway is in use by member progress or agenda records, cannot hard-delete' });
      }
      await run('DELETE FROM pathways WHERE id = ?', [req.params.id]);
    } else {
      await run('UPDATE pathways SET is_active = 0 WHERE id = ?', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// All levels + projects for one pathway (used to cascade the dropdown:
// pick pathway -> pick level -> pick project)
router.get('/:id/levels', async (req, res) => {
  try {
    const levels = await all('SELECT * FROM pathway_levels WHERE pathway_id = ? ORDER BY level_no', [req.params.id]);
    for (const lvl of levels) {
      lvl.projects = await all('SELECT * FROM pathway_projects WHERE level_id = ? ORDER BY project_no', [lvl.id]);
    }
    res.json(levels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/projects/:projectId', async (req, res) => {
  try {
    const project = await get(
      'SELECT pp.*, pl.level_no, p.name_zh AS pathway_name, p.code AS pathway_code ' +
      'FROM pathway_projects pp ' +
      'JOIN pathway_levels pl ON pp.level_id = pl.id ' +
      'JOIN pathways p ON pl.pathway_id = p.id ' +
      'WHERE pp.id = ?',
      [req.params.projectId]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: add a custom project under a level
router.post('/:id/levels/:levelId/projects', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url) VALUES (?,?,?,?,?,?)',
      [req.params.levelId, b.project_no, b.project_name_zh, b.default_time_min || 5, b.default_time_max || 7, b.evaluation_form_url || null]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
