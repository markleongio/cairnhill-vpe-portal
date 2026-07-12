// routes/meetings.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

// IMPORTANT: registered before '/:id' so Express doesn't treat "meta" as an id.
router.get('/meta/item-types', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM agenda_item_types WHERE is_active = 1 ORDER BY id'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List of prepared-speech agenda rows in this meeting, for the "which
// speech does this evaluation cover" dropdown (条件 f) — avoids re-keying
// the speaker/title, since picking the row pulls that info in automatically.
router.get('/:id/speeches', async (req, res) => {
  try {
    const rows = await all(
      "SELECT ma.id, ma.summary_zh, ma.speech_title, ma.speaker_guest_name, " +
      "sm.full_name AS speaker_name " +
      "FROM meeting_agenda ma " +
      "JOIN agenda_item_types ait ON ma.item_type_id = ait.id " +
      "LEFT JOIN members sm ON ma.speaker_member_id = sm.id " +
      "WHERE ma.meeting_id = ? AND ait.requires_pathway = 1 " +
      "ORDER BY ma.sort_order",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Meetings (condition b: each meeting is a record) -----------------------

router.get('/', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM meetings ORDER BY meeting_date DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const meeting = await get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const agenda = await all(
      'SELECT ma.*, ait.type_key, ait.label_zh AS type_label, ait.label_en AS type_label_en, ' +
      'ait.requires_pathway, ait.requires_evaluator, ait.requires_evaluates_selection, ' +
      'sm.full_name AS speaker_name, sm.chinese_name AS speaker_chinese_name, ' +
      'rm.full_name AS responsible_name, rm.chinese_name AS responsible_chinese_name, ' +
      'p.name_zh AS pathway_name, p.code AS pathway_code, ' +
      'pp.project_name_zh, pl.level_no, pl.level_label, ' +
      'sp.code AS speaker_primary_pathway_code, smp.current_level AS speaker_primary_level, ' +
      'rp.code AS responsible_primary_pathway_code, rmp.current_level AS responsible_primary_level, ' +
      'eval_row.summary_zh AS evaluates_summary, eval_sm.full_name AS evaluates_speaker_name, eval_row.speaker_guest_name AS evaluates_guest_name ' +
      'FROM meeting_agenda ma ' +
      'JOIN agenda_item_types ait ON ma.item_type_id = ait.id ' +
      'LEFT JOIN members sm ON ma.speaker_member_id = sm.id ' +
      'LEFT JOIN members rm ON ma.responsible_member_id = rm.id ' +
      'LEFT JOIN pathways p ON ma.pathway_id = p.id ' +
      'LEFT JOIN pathway_projects pp ON ma.pathway_project_id = pp.id ' +
      'LEFT JOIN pathway_levels pl ON pp.level_id = pl.id ' +
      'LEFT JOIN member_progress smp ON smp.member_id = ma.speaker_member_id AND smp.is_primary_pathway = 1 ' +
      'LEFT JOIN pathways sp ON sp.id = smp.pathway_id ' +
      'LEFT JOIN member_progress rmp ON rmp.member_id = ma.responsible_member_id AND rmp.is_primary_pathway = 1 ' +
      'LEFT JOIN pathways rp ON rp.id = rmp.pathway_id ' +
      'LEFT JOIN meeting_agenda eval_row ON ma.evaluates_agenda_id = eval_row.id ' +
      'LEFT JOIN members eval_sm ON eval_row.speaker_member_id = eval_sm.id ' +
      'WHERE ma.meeting_id = ? ORDER BY ma.sort_order',
      [req.params.id]
    );

    const visitors = await all('SELECT * FROM visitors_log WHERE meeting_id = ?', [req.params.id]);

    const exco = meeting.term_label
      ? await all(
          'SELECT et.*, r.role_name_zh, r.role_name_en, m.full_name, m.chinese_name, m.member_no ' +
          'FROM exco_terms et JOIN exco_roles r ON et.role_id = r.id JOIN members m ON et.member_id = m.id ' +
          'WHERE et.term_label = ? ORDER BY r.sort_order',
          [meeting.term_label]
        )
      : [];

    const roleAssignments = await all(
      'SELECT mra.*, mdr.role_name_zh, mdr.role_name_en, mdr.sort_order AS role_sort_order, ' +
      'm.full_name AS member_name, m.chinese_name AS member_chinese_name ' +
      'FROM meeting_role_assignments mra ' +
      'JOIN meeting_day_roles mdr ON mra.role_id = mdr.id ' +
      'LEFT JOIN members m ON mra.member_id = m.id ' +
      'WHERE mra.meeting_id = ? ORDER BY mdr.sort_order',
      [req.params.id]
    );

    res.json(Object.assign({}, meeting, { agenda: agenda, visitors: visitors, exco: exco, roleAssignments: roleAssignments }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.meeting_date) return res.status(400).json({ error: 'meeting_date required' });

    // Defaults pulled from Club Masters settings (条件 a) instead of
    // hardcoded strings, so updating the club's venue/dress code in one
    // place (Masters Settings) automatically applies to future meetings.
    const clubSettings = await get('SELECT default_venue, meeting_time, dress_code FROM club_settings WHERE id = 1');

    const result = await run(
      'INSERT INTO meetings (meeting_no, meeting_date, meeting_time, venue, theme, term_label, dress_code, footer_remarks, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        b.meeting_no || null,
        b.meeting_date,
        b.meeting_time || (clubSettings && clubSettings.meeting_time) || '19:00',
        b.venue || (clubSettings && clubSettings.default_venue) || null,
        b.theme || null,
        b.term_label || null,
        b.dress_code || (clubSettings && clubSettings.dress_code) || null,
        b.footer_remarks || null,
        req.session.userId,
      ]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const fields = [
      'meeting_no', 'meeting_date', 'meeting_time', 'venue', 'theme', 'term_label',
      'status', 'best_speaker_id', 'best_evaluator_id', 'best_table_topics_id', 'dress_code', 'footer_remarks',
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
    updates.push('updated_at = NOW()');
    params.push(req.params.id);
    await run('UPDATE meetings SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM meetings WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/clone', async (req, res) => {
  try {
    const src = await get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!src) return res.status(404).json({ error: 'Meeting not found' });
    const b = req.body;

    const result = await run(
      "INSERT INTO meetings (meeting_no, meeting_date, meeting_time, venue, theme, term_label, dress_code, status, created_by) VALUES (?,?,?,?,?,?,?, 'draft', ?)",
      [b.new_meeting_no || src.meeting_no, b.new_date || src.meeting_date, src.meeting_time, src.venue, null, src.term_label, src.dress_code, req.session.userId]
    );
    const newId = result.lastInsertRowid;

    const rows = await all('SELECT * FROM meeting_agenda WHERE meeting_id = ? ORDER BY sort_order', [req.params.id]);
    const oldToNewAgendaId = {};
    for (const r of rows) {
      const inserted = await run(
        'INSERT INTO meeting_agenda ' +
        '(meeting_id, sort_order, scheduled_time, item_type_id, section_label, summary_zh, ' +
        'time_limit_min, time_limit_max, duration_min, speaker_member_id, speaker_guest_name, speaker_is_guest, ' +
        'pathway_id, pathway_project_id, speech_title, responsible_member_id, responsible_label, responsible_is_guest, ' +
        'resource_label, resource_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          newId, r.sort_order, r.scheduled_time, r.item_type_id, r.section_label, r.summary_zh,
          r.time_limit_min, r.time_limit_max, r.duration_min,
          null, null, 0, r.pathway_id, null, null, r.responsible_member_id, r.responsible_label, r.responsible_is_guest,
          r.resource_label, r.resource_url,
        ]
      );
      oldToNewAgendaId[r.id] = inserted.lastInsertRowid;
    }
    for (const r of rows) {
      if (r.evaluates_agenda_id && oldToNewAgendaId[r.evaluates_agenda_id]) {
        await run('UPDATE meeting_agenda SET evaluates_agenda_id = ? WHERE id = ?', [oldToNewAgendaId[r.evaluates_agenda_id], oldToNewAgendaId[r.id]]);
      }
    }

    res.json({ id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Agenda items -------------------------------------------------------------

router.post('/:id/agenda', async (req, res) => {
  try {
    const m = req.params.id;
    const b = req.body;
    const maxOrder = await get('SELECT MAX(sort_order) AS mo FROM meeting_agenda WHERE meeting_id = ?', [m]);
    const sortOrder = b.sort_order !== undefined ? b.sort_order : ((maxOrder.mo === null || maxOrder.mo === undefined ? -1 : maxOrder.mo) + 1);

    const result = await run(
      'INSERT INTO meeting_agenda ' +
      '(meeting_id, sort_order, scheduled_time, item_type_id, section_label, summary_zh, ' +
      'time_limit_min, time_limit_max, duration_min, speaker_member_id, speaker_guest_name, speaker_is_guest, ' +
      'pathway_id, pathway_project_id, speech_title, responsible_member_id, responsible_label, responsible_is_guest, ' +
      'evaluates_agenda_id, resource_label, resource_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        m, sortOrder, b.scheduled_time || null, b.item_type_id, b.section_label || null, b.summary_zh,
        b.time_limit_min || null, b.time_limit_max || null, b.duration_min || null,
        b.speaker_member_id || null, b.speaker_guest_name || null, b.speaker_is_guest ? 1 : 0,
        b.pathway_id || null, b.pathway_project_id || null, b.speech_title || null,
        b.responsible_member_id || null, b.responsible_label || null, b.responsible_is_guest ? 1 : 0,
        b.evaluates_agenda_id || null,
        b.resource_label || null, b.resource_url || null,
      ]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/agenda/:agendaId', async (req, res) => {
  try {
    const fields = [
      'sort_order', 'scheduled_time', 'item_type_id', 'section_label', 'summary_zh',
      'time_limit_min', 'time_limit_max', 'duration_min',
      'speaker_member_id', 'speaker_guest_name', 'speaker_is_guest',
      'pathway_id', 'pathway_project_id', 'speech_title',
      'responsible_member_id', 'responsible_label', 'responsible_is_guest',
      'evaluates_agenda_id', 'resource_label', 'resource_url',
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
    params.push(req.params.agendaId, req.params.id);
    await run('UPDATE meeting_agenda SET ' + updates.join(', ') + ' WHERE id = ? AND meeting_id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/agenda/:agendaId', async (req, res) => {
  try {
    await run('DELETE FROM meeting_agenda WHERE id = ? AND meeting_id = ?', [req.params.agendaId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/agenda/reorder', async (req, res) => {
  try {
    const order = req.body.order;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    for (let idx = 0; idx < order.length; idx++) {
      await run('UPDATE meeting_agenda SET sort_order = ? WHERE id = ? AND meeting_id = ?', [idx, order[idx], req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Recalculate scheduled_time for every agenda row from the meeting's start
// time plus each row's duration_min, in sort_order sequence.
router.post('/:id/agenda/recalculate-times', async (req, res) => {
  try {
    const meeting = await get('SELECT meeting_time FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const rows = await all('SELECT id, duration_min FROM meeting_agenda WHERE meeting_id = ? ORDER BY sort_order', [req.params.id]);

    let cursor = parseTimeToMinutes(meeting.meeting_time);
    if (cursor === null) cursor = 19 * 60;

    for (const row of rows) {
      const timeStr = formatMinutesToTime(cursor);
      await run('UPDATE meeting_agenda SET scheduled_time = ? WHERE id = ?', [timeStr, row.id]);
      if (row.duration_min) cursor += row.duration_min;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function parseTimeToMinutes(str) {
  if (!str) return null;
  const ampmMatch = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!ampmMatch) return null;
  let h = parseInt(ampmMatch[1], 10);
  const m = parseInt(ampmMatch[2], 10);
  const ampm = ampmMatch[3] ? ampmMatch[3].toLowerCase() : null;
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + m;
}

function formatMinutesToTime(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + String(m).padStart(2, '0') + ampm;
}

// --- Meeting-day role assignments (条件 h + k) -------------------------------

router.get('/:id/roles', async (req, res) => {
  try {
    const rows = await all(
      'SELECT mra.*, mdr.role_name_zh, mdr.role_name_en, m.full_name AS member_name ' +
      'FROM meeting_role_assignments mra ' +
      'JOIN meeting_day_roles mdr ON mra.role_id = mdr.id ' +
      'LEFT JOIN members m ON mra.member_id = m.id ' +
      'WHERE mra.meeting_id = ? ORDER BY mdr.sort_order',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/roles', async (req, res) => {
  try {
    const b = req.body;
    if (!b.role_id) return res.status(400).json({ error: 'role_id required' });
    const result = await run(
      'INSERT INTO meeting_role_assignments (meeting_id, role_id, member_id, guest_name, is_guest, notes) VALUES (?,?,?,?,?,?) ' +
      'ON DUPLICATE KEY UPDATE member_id = VALUES(member_id), guest_name = VALUES(guest_name), is_guest = VALUES(is_guest), notes = VALUES(notes)',
      [req.params.id, b.role_id, b.is_guest ? null : (b.member_id || null), b.is_guest ? (b.guest_name || null) : null, b.is_guest ? 1 : 0, b.notes || null]
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/roles/:assignmentId', async (req, res) => {
  try {
    await run('DELETE FROM meeting_role_assignments WHERE id = ? AND meeting_id = ?', [req.params.assignmentId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Visitors -----------------------------------------------------------------

router.post('/:id/visitors', async (req, res) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO visitors_log (meeting_id, visitor_name, home_club, notes) VALUES (?,?,?,?)',
      [req.params.id, b.visitor_name, b.home_club || null, b.notes || null]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/visitors/:visitorId', async (req, res) => {
  try {
    await run('DELETE FROM visitors_log WHERE id = ? AND meeting_id = ?', [req.params.visitorId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
