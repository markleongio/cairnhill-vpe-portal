// routes/pathways.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM pathways ORDER BY sort_order'));
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
router.post('/:id/levels/:levelId/projects', async (req, res) => {
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
