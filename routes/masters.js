// routes/masters.js
// Combined "Masters" settings area: agenda item types (环节类型) and
// meeting-day duty roles (礼宾司/司仪/计时员 etc). Both are simple
// admin-editable reference lists, kept in one routes file since they're
// presented together in one settings screen on the frontend.
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

// --- Agenda item types (环节类型) -------------------------------------------

router.get('/item-types', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM agenda_item_types ORDER BY id'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/item-types', async (req, res) => {
  try {
    const b = req.body;
    if (!b.type_key || !b.label_zh) return res.status(400).json({ error: 'type_key and label_zh required' });
    const result = await run(
      'INSERT INTO agenda_item_types (type_key, label_zh, label_en, requires_pathway, requires_evaluator, requires_evaluates_selection, is_active) VALUES (?,?,?,?,?,?,1)',
      [b.type_key, b.label_zh, b.label_en || null, b.requires_pathway ? 1 : 0, b.requires_evaluator ? 1 : 0, b.requires_evaluates_selection ? 1 : 0]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/item-types/:id', async (req, res) => {
  try {
    const fields = ['type_key', 'label_zh', 'label_en', 'requires_pathway', 'requires_evaluator', 'requires_evaluates_selection', 'is_active'];
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
    await run('UPDATE agenda_item_types SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Soft-delete by default (is_active = 0) since existing agenda rows may
// reference this type; hard delete only if ?force=true and nothing references it.
router.delete('/item-types/:id', async (req, res) => {
  try {
    if (req.query.force === 'true') {
      const inUse = await get('SELECT COUNT(*) AS c FROM meeting_agenda WHERE item_type_id = ?', [req.params.id]);
      if (inUse.c > 0) {
        return res.status(409).json({ error: '此类型已被议程项目使用，无法删除 / Type is in use by agenda items, cannot hard-delete' });
      }
      await run('DELETE FROM agenda_item_types WHERE id = ?', [req.params.id]);
    } else {
      await run('UPDATE agenda_item_types SET is_active = 0 WHERE id = ?', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Meeting-day roles (礼宾司/司仪/计时员 etc) -----------------------------

router.get('/meeting-roles', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM meeting_day_roles ORDER BY sort_order, id'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/meeting-roles', async (req, res) => {
  try {
    const b = req.body;
    if (!b.role_name_zh) return res.status(400).json({ error: 'role_name_zh required' });
    const maxOrder = await get('SELECT MAX(sort_order) AS mo FROM meeting_day_roles');
    const sortOrder = b.sort_order !== undefined ? b.sort_order : ((maxOrder.mo === null ? -1 : maxOrder.mo) + 1);
    const result = await run(
      'INSERT INTO meeting_day_roles (role_name_zh, role_name_en, sort_order, is_active) VALUES (?,?,?,1)',
      [b.role_name_zh, b.role_name_en || null, sortOrder]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/meeting-roles/:id', async (req, res) => {
  try {
    const fields = ['role_name_zh', 'role_name_en', 'sort_order', 'is_active'];
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
    await run('UPDATE meeting_day_roles SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/meeting-roles/:id', async (req, res) => {
  try {
    if (req.query.force === 'true') {
      const inUse = await get('SELECT COUNT(*) AS c FROM meeting_role_assignments WHERE role_id = ?', [req.params.id]);
      if (inUse.c > 0) {
        return res.status(409).json({ error: '此职务已被例会使用，无法删除 / Role is in use by meeting records, cannot hard-delete' });
      }
      await run('DELETE FROM meeting_day_roles WHERE id = ?', [req.params.id]);
    } else {
      await run('UPDATE meeting_day_roles SET is_active = 0 WHERE id = ?', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
