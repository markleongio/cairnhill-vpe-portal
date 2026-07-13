// public/js/views/meetingBuilder.js

let builderState = { meeting: null, resources: [], speeches: [] };

async function renderMeetingBuilder(meetingId, viewOnly) {
  renderShell('/meetings', '<div class="empty-state">' + t('loading') + '</div>');
  const meeting = await API.get('/meetings/' + meetingId);
  const resources = await API.get('/resources');
  const speeches = await API.get('/meetings/' + meetingId + '/speeches');
  builderState.meeting = meeting;
  builderState.resources = resources;
  builderState.speeches = speeches;
  renderBuilderContent(viewOnly);
}

function renderBuilderContent(viewOnly) {
  const m = builderState.meeting;
  const editable = !viewOnly;

  let lastSection = null;
  const agendaRows = m.agenda || [];
  const rowsHtml = agendaRows.map(function (row, idx) {
    let sectionHtml = '';
    if (row.section_label && row.section_label !== lastSection) {
      sectionHtml = '<div class="section-divider">' + escapeHtml(row.section_label) + '</div>';
      lastSection = row.section_label;
    } else if (!row.section_label) {
      lastSection = null;
    }
    return sectionHtml + renderAgendaRow(row, editable, idx === 0, idx === agendaRows.length - 1);
  }).join('');

  const roleAssignmentsHtml = renderRoleAssignmentsSection(m.roleAssignments || [], editable);

  const html =
    '<div class="page-head no-print">' +
      '<div>' +
        '<a href="#/meetings" class="small muted"><i class="ti ti-arrow-left"></i> ' + escapeHtml(t('back')) + '</a>' +
        '<h1 class="mt-8">' + escapeHtml(m.meeting_no || t('meeting_records')) + '</h1>' +
        '<div class="small muted mt-8">' + fmtDate(m.meeting_date) + ' ' + (m.meeting_time || '') + ' · ' + statusBadge(m.status) + '</div>' +
      '</div>' +
      '<div class="flex gap-8">' +
        '<a href="#/meetings/' + m.id + '/print" class="btn" target="_blank"><i class="ti ti-printer"></i> ' + escapeHtml(t('print_agenda')) + '</a>' +
        (m.status === 'published' ? '<button class="btn" id="share-btn"><i class="ti ti-share-2"></i> ' + escapeHtml(t('share')) + '</button>' : '') +
        (editable
          ? '<button class="btn btn-gold" id="publish-btn"><i class="ti ti-send"></i> ' + (m.status === 'draft' ? escapeHtml(t('publish')) : escapeHtml(t('published_label'))) + '</button>'
          : '<button class="btn btn-primary" id="edit-btn"><i class="ti ti-edit"></i> ' + escapeHtml(t('edit_agenda')) + '</button>') +
        (editable ? '<button class="btn btn-danger" id="delete-meeting-btn"><i class="ti ti-trash"></i> ' + escapeHtml(t('delete_meeting')) + '</button>' : '') +
      '</div>' +
    '</div>' +

    '<div class="card card-pad mt-16">' +
      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('theme')) + '</label><input type="text" id="m-theme" value="' + escapeHtml(m.theme || '') + '" ' + (editable ? '' : 'disabled') + '></div>' +
        '<div class="field"><label>' + escapeHtml(t('venue')) + '</label><input type="text" id="m-venue" value="' + escapeHtml(m.venue || '') + '" ' + (editable ? '' : 'disabled') + '></div>' +
      '</div>' +
      '<div class="field"><label>' + escapeHtml(t('footer_remarks')) + '</label><textarea id="m-footer-remarks" rows="2" placeholder="' + escapeHtml(t('footer_remarks_placeholder')) + '" ' + (editable ? '' : 'disabled') + '>' + escapeHtml(m.footer_remarks || '') + '</textarea></div>' +
      (editable ? '<button class="btn btn-sm" id="save-meta-btn"><i class="ti ti-device-floppy"></i> ' + escapeHtml(t('save_basic_info')) + '</button>' : '') +
    '</div>' +

    roleAssignmentsHtml +

    '<div class="card card-pad mt-16">' +
      '<div class="flex justify-between items-center">' +
        '<h2>' + escapeHtml(t('agenda')) + '</h2>' +
        (editable
          ? '<div class="flex gap-8"><button class="btn btn-sm" id="recalc-times-btn"><i class="ti ti-clock"></i> ' + escapeHtml(t('recalc_times')) + '</button>' +
            '<button class="btn btn-primary btn-sm" id="add-row-btn"><i class="ti ti-plus"></i> ' + escapeHtml(t('add_segment')) + '</button></div>'
          : '') +
      '</div>' +
      '<div class="mt-16" id="agenda-rows">' + (rowsHtml || '<div class="empty-state"><i class="ti ti-list"></i></div>') + '</div>' +
    '</div>' +

    '<div class="card card-pad mt-16">' +
      '<h2>' + escapeHtml(t('results')) + '</h2>' +
      '<div class="field-row mt-16">' +
        '<div class="field"><label>' + escapeHtml(t('best_speaker')) + '</label><select id="m-best-speaker" ' + (editable ? '' : 'disabled') + '><option value="">—</option>' + memberOptionsSelected(m.best_speaker_id) + '</select></div>' +
        '<div class="field"><label>' + escapeHtml(t('best_evaluator')) + '</label><select id="m-best-evaluator" ' + (editable ? '' : 'disabled') + '><option value="">—</option>' + memberOptionsSelected(m.best_evaluator_id) + '</select></div>' +
        '<div class="field"><label>' + escapeHtml(t('best_table_topics')) + '</label><select id="m-best-tt" ' + (editable ? '' : 'disabled') + '><option value="">—</option>' + memberOptionsSelected(m.best_table_topics_id) + '</select></div>' +
      '</div>' +
      (editable ? '<button class="btn btn-sm" id="save-results-btn"><i class="ti ti-device-floppy"></i> ' + escapeHtml(t('save_results')) + '</button>' : '') +
    '</div>';

  setContent(html);
  wireBuilderEvents(editable);
}

function memberOptionsSelected(selectedId) {
  return Store.members.map(function (mb) {
    const sel = (selectedId && Number(selectedId) === mb.id) ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');
}

function renderRoleAssignmentsSection(assignments, editable) {
  const byRoleId = {};
  assignments.forEach(function (a) { byRoleId[a.role_id] = a; });

  const rows = Store.meetingDayRoles.map(function (role) {
    const a = byRoleId[role.id];
    const heldBy = a ? (a.is_guest ? a.guest_name : a.member_name) : null;
    return '<tr data-role-id="' + role.id + '">' +
      '<td style="font-weight:500;">' + escapeHtml(role.role_name_zh) + '</td>' +
      '<td>' + (heldBy ? escapeHtml(heldBy) + (a.is_guest ? ' <span class="badge badge-gray small">' + t('type_guest') + '</span>' : '') : '<span class="muted small">' + t('not_assigned') + '</span>') + '</td>' +
      (editable ? '<td class="no-print"><button class="btn btn-sm assign-role-btn" data-role-id="' + role.id + '" data-assignment-id="' + (a ? a.id : '') + '">' + escapeHtml(t('assign')) + '</button></td>' : '') +
    '</tr>';
  }).join('');

  return (
    '<div class="card card-pad mt-16">' +
      '<h2>' + escapeHtml(t('meeting_roles_section')) + '</h2>' +
      '<table class="data-table mt-16"><thead><tr><th>' + escapeHtml(t('role_label')) + '</th><th>' + escapeHtml(t('member_holding')) + '</th>' + (editable ? '<th></th>' : '') + '</tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:16px;">—</td></tr>') + '</tbody></table>' +
    '</div>'
  );
}

function openRoleAssignModal(roleId, assignmentId) {
  const role = Store.meetingDayRoles.filter(function (r) { return r.id === Number(roleId); })[0];
  const existing = (builderState.meeting.roleAssignments || []).filter(function (a) { return a.role_id === Number(roleId); })[0];

  const memberOptions = '<option value="">' + escapeHtml(t('select_member')) + '</option>' + Store.members.map(function (mb) {
    const sel = existing && !existing.is_guest && existing.member_id === mb.id ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(t('assign')) + ' — ' + escapeHtml(role.role_name_zh) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label><input type="checkbox" id="f-is-guest" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing && existing.is_guest ? 'checked' : '') + '> ' + escapeHtml(t('is_guest_role')) + '</label></div>' +
        '<div class="field" id="f-member-field" style="display:' + (existing && existing.is_guest ? 'none' : 'block') + ';"><label>' + escapeHtml(t('member_holding')) + '</label><select id="f-member">' + memberOptions + '</select></div>' +
        '<div class="field" id="f-guest-field" style="display:' + (existing && existing.is_guest ? 'block' : 'none') + ';"><label>' + escapeHtml(t('guest_name')) + '</label><input type="text" id="f-guest" value="' + (existing && existing.is_guest ? escapeHtml(existing.guest_name || '') : '') + '"></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        (assignmentId ? '<button class="btn btn-danger" id="remove-btn" style="margin-right:auto;"><i class="ti ti-trash"></i> ' + escapeHtml(t('delete')) + '</button>' : '') +
        '<button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);

  const isGuestCb = document.getElementById('f-is-guest');
  isGuestCb.addEventListener('change', function () {
    document.getElementById('f-member-field').style.display = isGuestCb.checked ? 'none' : 'block';
    document.getElementById('f-guest-field').style.display = isGuestCb.checked ? 'block' : 'none';
  });

  const removeBtn = document.getElementById('remove-btn');
  if (removeBtn) removeBtn.addEventListener('click', async function () {
    try {
      await API.del('/meetings/' + builderState.meeting.id + '/roles/' + assignmentId);
      toast(I18N.lang === 'zh' ? '已移除' : 'Removed', 'success');
      close();
      await refreshMeeting(true);
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('save-btn').addEventListener('click', async function () {
    const isGuest = isGuestCb.checked;
    try {
      await API.post('/meetings/' + builderState.meeting.id + '/roles', {
        role_id: roleId,
        is_guest: isGuest ? 1 : 0,
        member_id: isGuest ? null : (document.getElementById('f-member').value || null),
        guest_name: isGuest ? document.getElementById('f-guest').value : null,
      });
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      await refreshMeeting(true);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function renderAgendaRow(row, editable, isFirst, isLast) {
  const speakerLabel = row.speaker_name || row.speaker_guest_name || '';
  const respLabel = row.responsible_name || row.responsible_label || '';
  let metaBadges = '';
  if (row.pathway_code) metaBadges += '<span class="badge badge-jade">' + escapeHtml(row.pathway_code) + (row.level_no ? ' L' + row.level_no : '') + '</span>';
  if (row.time_limit_min) metaBadges += '<span class="badge badge-gray">' + row.time_limit_min + (row.time_limit_max ? '-' + row.time_limit_max : '') + (I18N.lang === 'zh' ? '分' : 'min') + '</span>';
  if (row.duration_min) metaBadges += '<span class="badge badge-navy">' + row.duration_min + (I18N.lang === 'zh' ? '分钟' : 'min') + '</span>';

  const evalSub = row.evaluates_summary ? (I18N.lang === 'zh' ? '评论：' : 'Evaluates: ') + (row.evaluates_speaker_name || row.evaluates_guest_name || '') : '';

  const moveButtonsHtml = editable
    ? '<div class="agenda-row-move-btns no-print">' +
        '<button type="button" class="btn btn-icon move-up-btn" data-row-id="' + row.id + '"' + (isFirst ? ' disabled' : '') + ' title="' + escapeHtml(t('move_up')) + '"><i class="ti ti-chevron-up"></i></button>' +
        '<button type="button" class="btn btn-icon move-down-btn" data-row-id="' + row.id + '"' + (isLast ? ' disabled' : '') + ' title="' + escapeHtml(t('move_down')) + '"><i class="ti ti-chevron-down"></i></button>' +
      '</div>'
    : '';

  return (
    '<div class="agenda-row" data-row-id="' + row.id + '">' +
      '<div class="agenda-row-head" data-toggle="' + row.id + '">' +
        (editable ? '<i class="ti ti-grip-vertical drag-handle"></i>' : '') +
        moveButtonsHtml +
        '<div class="agenda-row-time">' + (row.scheduled_time || '') + '</div>' +
        '<div class="agenda-row-summary">' +
          '<div class="title">' + escapeHtml(row.type_label || '') + (row.summary_zh ? '　' + escapeHtml(row.summary_zh) : '') + '</div>' +
          '<div class="sub">' + [speakerLabel, respLabel, row.speech_title, evalSub].filter(Boolean).map(function (s) { return escapeHtml(s); }).join(' · ') + '</div>' +
        '</div>' +
        '<div class="agenda-row-meta">' + metaBadges +
          (editable ? '<i class="ti ti-chevron-down"></i>' : '') +
        '</div>' +
      '</div>' +
      (editable ? renderAgendaRowDetail(row) : '') +
    '</div>'
  );
}

function renderAgendaRowDetail(row) {
  const typeOptions = Store.itemTypes.map(function (it) {
    const sel = it.id === row.item_type_id ? ' selected' : '';
    const label = I18N.lang === 'en' && it.label_en ? it.label_en : it.label_zh;
    return '<option value="' + it.id + '"' + sel + '>' + escapeHtml(label) + '</option>';
  }).join('');

  const pathwayOptions = '<option value="">—</option>' + Store.pathways.map(function (p) {
    const sel = p.id === row.pathway_id ? ' selected' : '';
    return '<option value="' + p.id + '"' + sel + '>' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</option>';
  }).join('');

  const resourceOptions = '<option value="">' + escapeHtml(t('no_resource')) + '</option>' + builderState.resources.map(function (r) {
    const sel = r.url === row.resource_url ? ' selected' : '';
    return '<option value="' + r.id + '" data-label="' + escapeHtml(r.label_zh) + '" data-url="' + escapeHtml(r.url) + '"' + sel + '>' + escapeHtml(r.label_zh) + '</option>';
  }).join('');

  const memberOptionsWithSelected = '<option value="">' + escapeHtml(t('select_member')) + '</option>' + Store.members.map(function (mb) {
    const sel = mb.id === row.speaker_member_id ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  const respOptionsWithSelected = '<option value="">' + escapeHtml(t('select_member')) + '</option>' + Store.members.map(function (mb) {
    const sel = mb.id === row.responsible_member_id ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  const speechOptions = '<option value="">' + escapeHtml(t('select_speech')) + '</option>' + builderState.speeches
    .filter(function (s) { return s.id !== row.id; })
    .map(function (s) {
      const sel = s.id === row.evaluates_agenda_id ? ' selected' : '';
      const label = (s.speaker_name || s.speaker_guest_name || '') + (s.speech_title ? ' — ' + s.speech_title : '');
      return '<option value="' + s.id + '"' + sel + '>' + escapeHtml(label) + '</option>';
    }).join('');

  const showEvalDropdown = !!row.requires_evaluates_selection;

  return (
    '<div class="agenda-row-detail" style="display:none;">' +
      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('segment_type')) + '</label><select class="rf-type">' + typeOptions + '</select></div>' +
        '<div class="field"><label>' + escapeHtml(t('time')) + '</label><input type="text" class="rf-time" value="' + escapeHtml(row.scheduled_time || '') + '" placeholder="7:00pm"></div>' +
      '</div>' +
      '<div class="field"><label>' + escapeHtml(t('summary')) + '</label><input type="text" class="rf-summary" value="' + escapeHtml(row.summary_zh) + '"></div>' +
      '<div class="field"><label>' + escapeHtml(t('section_optional')) + '</label><input type="text" class="rf-section" value="' + escapeHtml(row.section_label || '') + '"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('time_limit_min')) + '</label><input type="number" class="rf-tmin" value="' + (row.time_limit_min || '') + '"></div>' +
        '<div class="field"><label>' + escapeHtml(t('time_limit_max')) + '</label><input type="number" class="rf-tmax" value="' + (row.time_limit_max || '') + '"></div>' +
        '<div class="field"><label>' + escapeHtml(t('duration_min_label')) + '</label><input type="number" class="rf-duration" value="' + (row.duration_min || '') + '"></div>' +
      '</div>' +

      '<div class="section-divider" style="margin-top:8px;">' + escapeHtml(t('speaker_member_section')) + '</div>' +
      '<div class="field"><label><input type="checkbox" class="rf-is-guest" style="width:auto;display:inline-block;margin-right:6px;" ' + (row.speaker_is_guest ? 'checked' : '') + '> ' + escapeHtml(t('is_guest_speaker')) + '</label></div>' +
      '<div class="field rf-member-field" style="display:' + (row.speaker_is_guest ? 'none' : 'flex') + ';"><label>' + escapeHtml(t('speaker_member')) + '</label><select class="rf-speaker-member">' + memberOptionsWithSelected + '</select></div>' +
      '<div class="field rf-guest-field" style="display:' + (row.speaker_is_guest ? 'flex' : 'none') + ';"><label>' + escapeHtml(t('speaker_guest')) + '</label><input type="text" class="rf-guest-name" value="' + escapeHtml(row.speaker_guest_name || '') + '"></div>' +

      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('pathway')) + '</label><select class="rf-pathway">' + pathwayOptions + '</select></div>' +
        '<div class="field"><label>' + escapeHtml(t('project_unit')) + '</label><select class="rf-project"><option value="">' + escapeHtml(t('select_pathway_first')) + '</option></select></div>' +
      '</div>' +
      '<div class="field"><label>' + escapeHtml(t('speech_title')) + '</label><input type="text" class="rf-title" value="' + escapeHtml(row.speech_title || '') + '"></div>' +

      (showEvalDropdown
        ? '<div class="field"><label>' + escapeHtml(t('evaluates_which_speech')) + '</label><select class="rf-evaluates">' + speechOptions + '</select></div>'
        : '<input type="hidden" class="rf-evaluates" value="' + (row.evaluates_agenda_id || '') + '">') +

      '<div class="field"><label><input type="checkbox" class="rf-resp-is-guest" style="width:auto;display:inline-block;margin-right:6px;" ' + (row.responsible_is_guest ? 'checked' : '') + '> ' + escapeHtml(t('is_guest_responsible')) + '</label></div>' +
      '<div class="field rf-resp-member-field" style="display:' + (row.responsible_is_guest ? 'none' : 'flex') + ';"><label>' + escapeHtml(t('responsible_member')) + '</label><select class="rf-responsible">' + respOptionsWithSelected + '</select></div>' +
      '<div class="field rf-resp-guest-field" style="display:' + (row.responsible_is_guest ? 'flex' : 'none') + ';"><label>' + escapeHtml(t('responsible_member')) + ' (' + escapeHtml(t('type_guest')) + ')</label><input type="text" class="rf-resp-guest-name" value="' + escapeHtml(row.responsible_label || '') + '"></div>' +

      '<div class="section-divider" style="margin-top:8px;">' + escapeHtml(t('resource_section')) + '</div>' +
      '<div class="field"><label>' + escapeHtml(t('resource_link')) + '</label><select class="rf-resource">' + resourceOptions + '</select></div>' +

      '<div class="flex justify-between mt-16">' +
        '<button class="btn btn-danger btn-sm rf-delete"><i class="ti ti-trash"></i> ' + escapeHtml(t('delete_segment')) + '</button>' +
        '<button class="btn btn-primary btn-sm rf-save"><i class="ti ti-device-floppy"></i> ' + escapeHtml(t('save_segment')) + '</button>' +
      '</div>' +
    '</div>'
  );
}

async function loadProjectsForPathway(pathwayId, selectEl, selectedProjectId) {
  if (!pathwayId) {
    selectEl.innerHTML = '<option value="">' + escapeHtml(t('select_pathway_first')) + '</option>';
    return;
  }
  selectEl.innerHTML = '<option value="">' + escapeHtml(t('loading')) + '</option>';
  const levels = await API.get('/pathways/' + pathwayId + '/levels');
  let options = '<option value="">' + escapeHtml(t('select_project')) + '</option>';
  levels.forEach(function (lvl) {
    if (!lvl.projects || !lvl.projects.length) return;
    options += '<optgroup label="' + escapeHtml(t('pathway_level')) + ' ' + lvl.level_no + '">';
    lvl.projects.forEach(function (p) {
      const sel = selectedProjectId && Number(selectedProjectId) === p.id ? ' selected' : '';
      options += '<option value="' + p.id + '" data-eval="' + escapeHtml(p.evaluation_form_url || '') + '"' + sel + '>' + escapeHtml(p.project_name_zh) + '</option>';
    });
    options += '</optgroup>';
  });
  selectEl.innerHTML = options;
}

function wireBuilderEvents(editable) {
  const m = builderState.meeting;

  const editBtn = document.getElementById('edit-btn');
  if (editBtn) editBtn.addEventListener('click', function () { navigate('/meetings/' + m.id + '/edit'); });

  const deleteMeetingBtn = document.getElementById('delete-meeting-btn');
  if (deleteMeetingBtn) deleteMeetingBtn.addEventListener('click', async function () {
    if (!confirm(t('confirm_delete_meeting'))) return;
    try {
      await API.del('/meetings/' + m.id);
      toast(I18N.lang === 'zh' ? '已删除' : 'Deleted', 'success');
      navigate('/meetings');
    } catch (err) { toast(err.message, 'error'); }
  });

  const saveMetaBtn = document.getElementById('save-meta-btn');
  if (saveMetaBtn) saveMetaBtn.addEventListener('click', async function () {
    try {
      await API.put('/meetings/' + m.id, {
        theme: document.getElementById('m-theme').value,
        venue: document.getElementById('m-venue').value,
        footer_remarks: document.getElementById('m-footer-remarks').value,
      });
      toast(I18N.lang === 'zh' ? '已保存基本信息' : 'Basic info saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  const saveResultsBtn = document.getElementById('save-results-btn');
  if (saveResultsBtn) saveResultsBtn.addEventListener('click', async function () {
    try {
      await API.put('/meetings/' + m.id, {
        best_speaker_id: document.getElementById('m-best-speaker').value || null,
        best_evaluator_id: document.getElementById('m-best-evaluator').value || null,
        best_table_topics_id: document.getElementById('m-best-tt').value || null,
      });
      toast(I18N.lang === 'zh' ? '已保存例会成绩' : 'Results saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  const publishBtn = document.getElementById('publish-btn');
  if (publishBtn) publishBtn.addEventListener('click', async function () {
    try {
      await API.put('/meetings/' + m.id, { status: 'published' });
      toast(I18N.lang === 'zh' ? '议程已发布' : 'Agenda published', 'success');
      m.status = 'published';
      renderBuilderContent(false);
    } catch (err) { toast(err.message, 'error'); }
  });

  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) shareBtn.addEventListener('click', function () { openShareModal(m); });

  const recalcBtn = document.getElementById('recalc-times-btn');
  if (recalcBtn) recalcBtn.addEventListener('click', async function () {
    try {
      await API.post('/meetings/' + m.id + '/agenda/recalculate-times');
      toast(I18N.lang === 'zh' ? '已重新计算时间' : 'Times recalculated', 'success');
      await refreshMeeting(true);
    } catch (err) { toast(err.message, 'error'); }
  });

  const addRowBtn = document.getElementById('add-row-btn');
  if (addRowBtn) addRowBtn.addEventListener('click', async function () {
    try {
      const defaultType = Store.itemTypes.filter(function (it) { return it.type_key === 'admin'; })[0];
      await API.post('/meetings/' + m.id + '/agenda', {
        item_type_id: defaultType ? defaultType.id : Store.itemTypes[0].id,
        summary_zh: I18N.lang === 'zh' ? '新环节' : 'New segment',
      });
      await refreshMeeting(true);
    } catch (err) { toast(err.message, 'error'); }
  });

  document.querySelectorAll('.assign-role-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openRoleAssignModal(btn.dataset.roleId, btn.dataset.assignmentId || null);
    });
  });

  document.querySelectorAll('.move-up-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.disabled) return;
      moveAgendaRow(btn.dataset.rowId, -1);
    });
  });

  document.querySelectorAll('.move-down-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.disabled) return;
      moveAgendaRow(btn.dataset.rowId, 1);
    });
  });

  document.querySelectorAll('[data-toggle]').forEach(function (head) {
    head.addEventListener('click', function () {
      const detail = head.nextElementSibling;
      if (!detail || !detail.classList.contains('agenda-row-detail')) return;
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });
  });

  document.querySelectorAll('.agenda-row').forEach(function (rowEl) {
    const rowId = rowEl.dataset.rowId;
    const detail = rowEl.querySelector('.agenda-row-detail');
    if (!detail) return;

    const pathwaySel = detail.querySelector('.rf-pathway');
    const projectSel = detail.querySelector('.rf-project');
    const rowData = (m.agenda || []).filter(function (r) { return String(r.id) === rowId; })[0];

    if (pathwaySel.value) loadProjectsForPathway(pathwaySel.value, projectSel, rowData.pathway_project_id);

    pathwaySel.addEventListener('change', function () {
      loadProjectsForPathway(pathwaySel.value, projectSel, null);
    });

    const isGuestCb = detail.querySelector('.rf-is-guest');
    isGuestCb.addEventListener('change', function () {
      detail.querySelector('.rf-member-field').style.display = isGuestCb.checked ? 'none' : 'flex';
      detail.querySelector('.rf-guest-field').style.display = isGuestCb.checked ? 'flex' : 'none';
    });

    const respGuestCb = detail.querySelector('.rf-resp-is-guest');
    respGuestCb.addEventListener('change', function () {
      detail.querySelector('.rf-resp-member-field').style.display = respGuestCb.checked ? 'none' : 'flex';
      detail.querySelector('.rf-resp-guest-field').style.display = respGuestCb.checked ? 'flex' : 'none';
    });

    detail.querySelector('.rf-delete').addEventListener('click', async function () {
      if (!confirm(t('delete_segment') + '?')) return;
      try {
        await API.del('/meetings/' + m.id + '/agenda/' + rowId);
        await refreshMeeting(true);
        toast(I18N.lang === 'zh' ? '已删除' : 'Deleted', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });

    detail.querySelector('.rf-save').addEventListener('click', async function () {
      const resourceSel = detail.querySelector('.rf-resource');
      const resourceOpt = resourceSel.selectedOptions[0];
      const evalSel = detail.querySelector('.rf-evaluates');
      try {
        await API.put('/meetings/' + m.id + '/agenda/' + rowId, {
          item_type_id: Number(detail.querySelector('.rf-type').value),
          scheduled_time: detail.querySelector('.rf-time').value,
          summary_zh: detail.querySelector('.rf-summary').value,
          section_label: detail.querySelector('.rf-section').value || null,
          time_limit_min: detail.querySelector('.rf-tmin').value ? Number(detail.querySelector('.rf-tmin').value) : null,
          time_limit_max: detail.querySelector('.rf-tmax').value ? Number(detail.querySelector('.rf-tmax').value) : null,
          duration_min: detail.querySelector('.rf-duration').value ? Number(detail.querySelector('.rf-duration').value) : null,
          speaker_is_guest: isGuestCb.checked ? 1 : 0,
          speaker_member_id: isGuestCb.checked ? null : (detail.querySelector('.rf-speaker-member').value || null),
          speaker_guest_name: isGuestCb.checked ? detail.querySelector('.rf-guest-name').value : null,
          pathway_id: pathwaySel.value || null,
          pathway_project_id: projectSel.value || null,
          speech_title: detail.querySelector('.rf-title').value || null,
          evaluates_agenda_id: evalSel.value || null,
          responsible_is_guest: respGuestCb.checked ? 1 : 0,
          responsible_member_id: respGuestCb.checked ? null : (detail.querySelector('.rf-responsible').value || null),
          responsible_label: respGuestCb.checked ? detail.querySelector('.rf-resp-guest-name').value : null,
          resource_label: resourceOpt && resourceOpt.dataset.label ? resourceOpt.dataset.label : null,
          resource_url: resourceOpt && resourceOpt.dataset.url ? resourceOpt.dataset.url : null,
        });
        toast(I18N.lang === 'zh' ? '已保存环节' : 'Segment saved', 'success');
        await refreshMeeting(true);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function moveAgendaRow(rowId, delta) {
  const agenda = (builderState.meeting.agenda || []).slice();
  const idx = agenda.findIndex(function (r) { return String(r.id) === String(rowId); });
  const newIdx = idx + delta;
  if (idx === -1 || newIdx < 0 || newIdx >= agenda.length) return;

  const tmp = agenda[idx];
  agenda[idx] = agenda[newIdx];
  agenda[newIdx] = tmp;

  try {
    await API.put('/meetings/' + builderState.meeting.id + '/agenda/reorder', {
      order: agenda.map(function (r) { return r.id; }),
    });
    await refreshMeeting(true);
  } catch (err) { toast(err.message, 'error'); }
}

async function refreshMeeting(editable) {
  const meeting = await API.get('/meetings/' + builderState.meeting.id);
  const speeches = await API.get('/meetings/' + builderState.meeting.id + '/speeches');
  builderState.meeting = meeting;
  builderState.speeches = speeches;
  renderBuilderContent(!editable);
}

function openShareModal(m) {
  const publicUrl = window.location.origin + '/#/public/meetings/' + m.id;
  const shareTitle = '经禧华语讲演会 · ' + (m.meeting_no || '');
  const shareText = shareTitle + (m.theme ? ' — ' + m.theme : '');

  const hasNativeShare = !!navigator.share;

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(t('share')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('public_link_label')) + '</label>' +
          '<div class="flex gap-8">' +
            '<input type="text" id="share-url-input" value="' + escapeHtml(publicUrl) + '" readonly style="flex:1;">' +
            '<button class="btn btn-sm" id="copy-link-btn"><i class="ti ti-copy"></i> ' + escapeHtml(t('copy')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="flex gap-8 mt-16" style="flex-wrap:wrap;">' +
          (hasNativeShare ? '<button class="btn btn-primary btn-sm" id="native-share-btn"><i class="ti ti-share-2"></i> ' + escapeHtml(t('share')) + '</button>' : '') +
          '<button class="btn btn-sm" id="fb-share-btn">Facebook</button>' +
          '<button class="btn btn-sm" id="li-share-btn">LinkedIn</button>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('close')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);

  document.getElementById('copy-link-btn').addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast(I18N.lang === 'zh' ? '已复制链接' : 'Link copied', 'success');
    } catch (err) {
      const input = document.getElementById('share-url-input');
      input.select();
      document.execCommand('copy');
      toast(I18N.lang === 'zh' ? '已复制链接' : 'Link copied', 'success');
    }
  });

  const nativeBtn = document.getElementById('native-share-btn');
  if (nativeBtn) nativeBtn.addEventListener('click', async function () {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: publicUrl });
    } catch (err) { /* user cancelled the native share sheet — not an error */ }
  });

  document.getElementById('fb-share-btn').addEventListener('click', function () {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(publicUrl), '_blank', 'width=600,height=500');
  });

  document.getElementById('li-share-btn').addEventListener('click', function () {
    window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(publicUrl), '_blank', 'width=600,height=500');
  });
}
