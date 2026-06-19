// routes/resources.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

router.get('/', (req, res) => {
  const { category, type_id } = req.query;
  let sql = 'SELECT * FROM resource_library WHERE 1=1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (type_id) {
    sql += ' AND (applies_to_type_id = ? OR applies_to_type_id IS NULL)';
    params.push(type_id);
  }
  sql += ' ORDER BY category, label_zh';
  res.json(all(sql, params));
});

router.post('/', (req, res) => {
  const { label_zh, category, url, applies_to_type_id, notes } = req.body;
  if (!label_zh || !url) return res.status(400).json({ error: 'label_zh and url required' });
  const result = run(
    'INSERT INTO resource_library (label_zh, category, url, applies_to_type_id, notes) VALUES (?,?,?,?,?)',
    [label_zh, category || 'other', url, applies_to_type_id || null, notes || null]
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const fields = ['label_zh', 'category', 'url', 'applies_to_type_id', 'notes'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  run(`UPDATE resource_library SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM resource_library WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
