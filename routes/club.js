// routes/club.js
// Condition (a): Club Masters — single-row settings table for club name,
// number, default meeting venue/day/time, mission statement, etc.
const express = require('express');
const { get, run } = require('../db/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let settings = await get('SELECT * FROM club_settings WHERE id = 1');
    if (!settings) {
      await run('INSERT IGNORE INTO club_settings (id) VALUES (1)');
      settings = await get('SELECT * FROM club_settings WHERE id = 1');
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const fields = [
      'club_name_zh', 'club_name_en', 'club_number', 'district_label',
      'default_venue', 'meeting_day', 'meeting_time', 'tagline',
      'mission_statement', 'dress_code',
    ];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(f + ' = ?');
        params.push(req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    await run('UPDATE club_settings SET ' + updates.join(', ') + ' WHERE id = 1', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
