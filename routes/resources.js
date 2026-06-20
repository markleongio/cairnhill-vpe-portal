// routes/resources.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const category = req.query.category;
    const typeId = req.query.type_id;
    let sql = 'SELECT * FROM resource_library WHERE 1=1';
    const params = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (typeId) {
      sql += ' AND (applies_to_type_id = ? OR applies_to_type_id IS NULL)';
      params.push(typeId);
    }
    sql += ' ORDER BY category, label_zh';
    res.json(await all(sql, params));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.label_zh || !b.url) return res.status(400).json({ error: 'label_zh and url required' });
    const result = await run(
      'INSERT INTO resource_library (label_zh, category, url, applies_to_type_id, notes) VALUES (?,?,?,?,?)',
      [b.label_zh, b.category || 'other', b.url, b.applies_to_type_id || null, b.notes || null]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const fields = ['label_zh', 'category', 'url', 'applies_to_type_id', 'notes'];
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
    await run('UPDATE resource_library SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM resource_library WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
