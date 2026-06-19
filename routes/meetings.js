// routes/meetings.js
const express = require('express');
const { all, get, run } = require('../db/db');

const router = express.Router();

// --- Meetings (condition b: each meeting is a record) -----------------------

router.get('/', (req, res) => {
  const rows = all('SELECT * FROM meetings ORDER BY meeting_date DESC');
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const meeting = get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

  const agenda = all(
    `SELECT ma.*, ait.type_key, ait.label_zh AS type_label,
            sm.full_name AS speaker_name, sm.chinese_name AS speaker_chinese_name,
            rm.full_name AS responsible_name, rm.chinese_name AS responsible_chinese_name,
            p.name_zh AS pathway_name, p.code AS pathway_code,
            pp.project_name_zh, pl.level_no
     FROM meeting_agenda ma
     JOIN agenda_item_types ait ON ma.item_type_id = ait.id
     LEFT JOIN members sm ON ma.speaker_member_id = sm.id
     LEFT JOIN members rm ON ma.responsible_member_id = rm.id
     LEFT JOIN pathways p ON ma.pathway_id = p.id
     LEFT JOIN pathway_projects pp ON ma.pathway_project_id = pp.id
     LEFT JOIN pathway_levels pl ON pp.level_id = pl.id
     WHERE ma.meeting_id = ?
     ORDER BY ma.sort_order`,
    [req.params.id]
  );

  const visitors = all('SELECT * FROM visitors_log WHERE meeting_id = ?', [req.params.id]);

  const exco = meeting.term_label
    ? all(
        `SELECT et.*, r.role_name_zh, r.role_name_en, m.full_name, m.chinese_name, m.member_no
         FROM exco_terms et
         JOIN exco_roles r ON et.role_id = r.id
         JOIN members m ON et.member_id = m.id
         WHERE et.term_label = ?
         ORDER BY r.sort_order`,
        [meeting.term_label]
      )
    : [];

  res.json({ ...meeting, agenda, visitors, exco });
});

router.post('/', (req, res) => {
  const { meeting_no, meeting_date, meeting_time, venue, theme, term_label, dress_code } = req.body;
  if (!meeting_date) return res.status(400).json({ error: 'meeting_date required' });
  const result = run(
    `INSERT INTO meetings (meeting_no, meeting_date, meeting_time, venue, theme, term_label, dress_code, created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      meeting_no || null,
      meeting_date,
      meeting_time || '19:00',
      venue || '经禧民众俱乐部，二楼会议室，1 Anthony Road, (S) 229944',
      theme || null,
      term_label || null,
      dress_code || '女士服装端庄大方，男士衬衫长裤。欢迎公众人士观摩',
      req.session.userId,
    ]
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const fields = [
    'meeting_no', 'meeting_date', 'meeting_time', 'venue', 'theme', 'term_label',
    'status', 'best_speaker_id', 'best_evaluator_id', 'best_table_topics_id', 'dress_code',
  ];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  run(`UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM meetings WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Clone a meeting (and its agenda) as a quick-start template for the next one
router.post('/:id/clone', (req, res) => {
  const src = get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  if (!src) return res.status(404).json({ error: 'Meeting not found' });
  const { new_date, new_meeting_no } = req.body;

  const result = run(
    `INSERT INTO meetings (meeting_no, meeting_date, meeting_time, venue, theme, term_label, dress_code, status, created_by)
     VALUES (?,?,?,?,?,?,?, 'draft', ?)`,
    [new_meeting_no || src.meeting_no, new_date || src.meeting_date, src.meeting_time, src.venue, null, src.term_label, src.dress_code, req.session.userId]
  );
  const newId = result.lastInsertRowid;

  const rows = all('SELECT * FROM meeting_agenda WHERE meeting_id = ? ORDER BY sort_order', [req.params.id]);
  for (const r of rows) {
    run(
      `INSERT INTO meeting_agenda
        (meeting_id, sort_order, scheduled_time, item_type_id, section_label, summary_zh,
         time_limit_min, time_limit_max, speaker_member_id, speaker_guest_name, speaker_is_guest,
         pathway_id, pathway_project_id, speech_title, responsible_member_id, responsible_label,
         resource_label, resource_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newId, r.sort_order, r.scheduled_time, r.item_type_id, r.section_label, r.summary_zh,
        r.time_limit_min, r.time_limit_max,
        null, null, 0, r.pathway_id, null, null, r.responsible_member_id, r.responsible_label,
        r.resource_label, r.resource_url,
      ]
    );
  }
  res.json({ id: newId });
});

// --- Agenda items (condition a + d: dropdowns + resource links) ------------

router.post('/:id/agenda', (req, res) => {
  const m = req.params.id;
  const b = req.body;
  const maxOrder = get('SELECT MAX(sort_order) AS mo FROM meeting_agenda WHERE meeting_id = ?', [m]);
  const sortOrder = b.sort_order ?? ((maxOrder.mo ?? -1) + 1);

  const result = run(
    `INSERT INTO meeting_agenda
      (meeting_id, sort_order, scheduled_time, item_type_id, section_label, summary_zh,
       time_limit_min, time_limit_max, speaker_member_id, speaker_guest_name, speaker_is_guest,
       pathway_id, pathway_project_id, speech_title, responsible_member_id, responsible_label,
       resource_label, resource_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      m, sortOrder, b.scheduled_time || null, b.item_type_id, b.section_label || null, b.summary_zh,
      b.time_limit_min || null, b.time_limit_max || null,
      b.speaker_member_id || null, b.speaker_guest_name || null, b.speaker_is_guest ? 1 : 0,
      b.pathway_id || null, b.pathway_project_id || null, b.speech_title || null,
      b.responsible_member_id || null, b.responsible_label || null,
      b.resource_label || null, b.resource_url || null,
    ]
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id/agenda/:agendaId', (req, res) => {
  const fields = [
    'sort_order', 'scheduled_time', 'item_type_id', 'section_label', 'summary_zh',
    'time_limit_min', 'time_limit_max', 'speaker_member_id', 'speaker_guest_name', 'speaker_is_guest',
    'pathway_id', 'pathway_project_id', 'speech_title', 'responsible_member_id', 'responsible_label',
    'resource_label', 'resource_url',
  ];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.agendaId, req.params.id);
  run(`UPDATE meeting_agenda SET ${updates.join(', ')} WHERE id = ? AND meeting_id = ?`, params);
  res.json({ ok: true });
});

router.delete('/:id/agenda/:agendaId', (req, res) => {
  run('DELETE FROM meeting_agenda WHERE id = ? AND meeting_id = ?', [req.params.agendaId, req.params.id]);
  res.json({ ok: true });
});

router.put('/:id/agenda/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  order.forEach((agendaId, idx) => {
    run('UPDATE meeting_agenda SET sort_order = ? WHERE id = ? AND meeting_id = ?', [idx, agendaId, req.params.id]);
  });
  res.json({ ok: true });
});

// --- Visitors -----------------------------------------------------------------

router.post('/:id/visitors', (req, res) => {
  const { visitor_name, home_club, notes } = req.body;
  const result = run(
    'INSERT INTO visitors_log (meeting_id, visitor_name, home_club, notes) VALUES (?,?,?,?)',
    [req.params.id, visitor_name, home_club || null, notes || null]
  );
  res.json({ id: result.lastInsertRowid });
});

router.delete('/:id/visitors/:visitorId', (req, res) => {
  run('DELETE FROM visitors_log WHERE id = ? AND meeting_id = ?', [req.params.visitorId, req.params.id]);
  res.json({ ok: true });
});

// --- Agenda item types reference (for the dropdown in the builder) ---------

router.get('/meta/item-types', (req, res) => {
  res.json(all('SELECT * FROM agenda_item_types ORDER BY id'));
});

module.exports = router;
