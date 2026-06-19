// routes/pathways.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(all('SELECT * FROM pathways ORDER BY sort_order'));
});

// All levels + projects for one pathway (used to cascade the dropdown:
// pick pathway -> pick level -> pick project)
router.get('/:id/levels', (req, res) => {
  const levels = all('SELECT * FROM pathway_levels WHERE pathway_id = ? ORDER BY level_no', [req.params.id]);
  for (const lvl of levels) {
    lvl.projects = all('SELECT * FROM pathway_projects WHERE level_id = ? ORDER BY project_no', [lvl.id]);
  }
  res.json(levels);
});

router.get('/projects/:projectId', (req, res) => {
  const project = get(
    `SELECT pp.*, pl.level_no, p.name_zh AS pathway_name, p.code AS pathway_code
     FROM pathway_projects pp
     JOIN pathway_levels pl ON pp.level_id = pl.id
     JOIN pathways p ON pl.pathway_id = p.id
     WHERE pp.id = ?`,
    [req.params.projectId]
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// Admin: add a custom project under a level (so VPE can fill out projects
// for pathways beyond the seeded examples)
router.post('/:id/levels/:levelId/projects', (req, res) => {
  const { project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url } = req.body;
  const result = run(
    `INSERT INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url)
     VALUES (?,?,?,?,?,?)`,
    [req.params.levelId, project_no, project_name_zh, default_time_min || 5, default_time_max || 7, evaluation_form_url || null]
  );
  res.json({ id: result.lastInsertRowid });
});

module.exports = router;
