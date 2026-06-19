// public/js/views/meetingBuilder.js

let builderState = { meeting: null, resources: [] };

async function renderMeetingBuilder(meetingId, viewOnly) {
  renderShell('/meetings', '<div class="empty-state">加载中…</div>');
  const meeting = await API.get('/meetings/' + meetingId);
  const resources = await API.get('/resources');
  builderState.meeting = meeting;
  builderState.resources = resources;
  renderBuilderContent(viewOnly);
}

function renderBuilderContent(viewOnly) {
  const m = builderState.meeting;
  const editable = !viewOnly;

  let lastSection = null;
  const rowsHtml = (m.agenda || []).map(function (row) {
    let sectionHtml = '';
    if (row.section_label && row.section_label !== lastSection) {
      sectionHtml = '<div class="section-divider">' + escapeHtml(row.section_label) + '</div>';
      lastSection = row.section_label;
    } else if (!row.section_label) {
      lastSection = null;
    }
    return sectionHtml + renderAgendaRow(row, editable);
  }).join('');

  const html =
    '<div class="page-head no-print">' +
      '<div>' +
        '<a href="#/meetings" class="small muted"><i class="ti ti-arrow-left"></i> 返回例会列表</a>' +
        '<h1 class="mt-8">' + escapeHtml(m.meeting_no || '例会') + '</h1>' +
        '<div class="small muted mt-8">' + fmtDate(m.meeting_date) + ' ' + (m.meeting_time || '') + ' · ' + statusBadge(m.status) + '</div>' +
      '</div>' +
      '<div class="flex gap-8">' +
        '<a href="#/meetings/' + m.id + '/print" class="btn" target="_blank"><i class="ti ti-printer"></i> 打印议程</a>' +
        (editable
          ? '<button class="btn btn-gold" id="publish-btn"><i class="ti ti-send"></i> ' + (m.status === 'draft' ? '发布' : '已发布') + '</button>'
          : '<button class="btn btn-primary" id="edit-btn"><i class="ti ti-edit"></i> 编辑议程</button>') +
      '</div>' +
    '</div>' +

    '<div class="card card-pad mt-16">' +
      '<div class="field-row">' +
        '<div class="field"><label>主题 Theme</label><input type="text" id="m-theme" value="' + escapeHtml(m.theme || '') + '" ' + (editable ? '' : 'disabled') + '></div>' +
        '<div class="field"><label>地点 Venue</label><input type="text" id="m-venue" value="' + escapeHtml(m.venue || '') + '" ' + (editable ? '' : 'disabled') + '></div>' +
      '</div>' +
      (editable ? '<button class="btn btn-sm" id="save-meta-btn"><i class="ti ti-device-floppy"></i> 保存基本信息</button>' : '') +
    '</div>' +

    '<div class="card card-pad mt-16">' +
      '<div class="flex justify-between items-center">' +
        '<h2>议程 Agenda</h2>' +
        (editable ? '<button class="btn btn-primary btn-sm" id="add-row-btn"><i class="ti ti-plus"></i> 新增环节</button>' : '') +
      '</div>' +
      '<div class="mt-16" id="agenda-rows">' + (rowsHtml || '<div class="empty-state"><i class="ti ti-list"></i>尚无议程项目</div>') + '</div>' +
    '</div>' +

    '<div class="card card-pad mt-16">' +
      '<h2>例会成绩 Results</h2>' +
      '<div class="field-row mt-16">' +
        '<div class="field"><label>最佳讲员 Best Speaker</label><select id="m-best-speaker" ' + (editable ? '' : 'disabled') + '><option value="">—</option>' + memberOptionsSelected(m.best_speaker_id) + '</select></div>' +
        '<div class="field"><label>最佳评论员 Best Evaluator</label><select id="m-best-evaluator" ' + (editable ? '' : 'disabled') + '><option value="">—</option>' + memberOptionsSelected(m.best_evaluator_id) + '</select></div>' +
        '<div class="field"><label>最佳即席讲员</label><select id="m-best-tt" ' + (editable ? '' : 'disabled') + '><option value="">—</option>' + memberOptionsSelected(m.best_table_topics_id) + '</select></div>' +
      '</div>' +
      (editable ? '<button class="btn btn-sm" id="save-results-btn"><i class="ti ti-device-floppy"></i> 保存成绩</button>' : '') +
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

function renderAgendaRow(row, editable) {
  const speakerLabel = row.speaker_name || row.speaker_guest_name || '';
  const respLabel = row.responsible_name || row.responsible_label || '';
  let metaBadges = '';
  if (row.pathway_code) metaBadges += '<span class="badge badge-jade">' + escapeHtml(row.pathway_code) + '</span>';
  if (row.time_limit_min) metaBadges += '<span class="badge badge-gray">' + row.time_limit_min + (row.time_limit_max ? '-' + row.time_limit_max : '') + '分</span>';

  return (
    '<div class="agenda-row" data-row-id="' + row.id + '">' +
      '<div class="agenda-row-head" data-toggle="' + row.id + '">' +
        (editable ? '<i class="ti ti-grip-vertical drag-handle"></i>' : '') +
        '<div class="agenda-row-time">' + (row.scheduled_time || '') + '</div>' +
        '<div class="agenda-row-summary">' +
          '<div class="title">' + escapeHtml(row.summary_zh) + '</div>' +
          '<div class="sub">' + [speakerLabel, respLabel, row.speech_title].filter(Boolean).map(escapeHtml).join(' · ') + '</div>' +
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
  const typeOptions = Store.itemTypes.map(function (t) {
    const sel = t.id === row.item_type_id ? ' selected' : '';
    return '<option value="' + t.id + '"' + sel + '>' + escapeHtml(t.label_zh) + '</option>';
  }).join('');

  const pathwayOptions = '<option value="">—</option>' + Store.pathways.map(function (p) {
    const sel = p.id === row.pathway_id ? ' selected' : '';
    return '<option value="' + p.id + '"' + sel + '>' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</option>';
  }).join('');

  const resourceOptions = '<option value="">— 不附加资源 —</option>' + builderState.resources.map(function (r) {
    const sel = r.url === row.resource_url ? ' selected' : '';
    return '<option value="' + r.id + '" data-label="' + escapeHtml(r.label_zh) + '" data-url="' + escapeHtml(r.url) + '"' + sel + '>' + escapeHtml(r.label_zh) + '</option>';
  }).join('');

  const memberOptionsWithSelected = '<option value="">— 选择会员 —</option>' + Store.members.map(function (mb) {
    const sel = mb.id === row.speaker_member_id ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  const respOptionsWithSelected = '<option value="">— 选择负责会友 —</option>' + Store.members.map(function (mb) {
    const sel = mb.id === row.responsible_member_id ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  return (
    '<div class="agenda-row-detail" style="display:none;">' +
      '<div class="field-row">' +
        '<div class="field"><label>环节类型</label><select class="rf-type">' + typeOptions + '</select></div>' +
        '<div class="field"><label>时间 Time</label><input type="text" class="rf-time" value="' + escapeHtml(row.scheduled_time || '') + '" placeholder="7:00pm"></div>' +
      '</div>' +
      '<div class="field"><label>摘要 Summary</label><input type="text" class="rf-summary" value="' + escapeHtml(row.summary_zh) + '"></div>' +
      '<div class="field"><label>分段标题 Section (可留空)</label><input type="text" class="rf-section" value="' + escapeHtml(row.section_label || '') + '" placeholder="例：备稿演讲"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>时限下限</label><input type="number" class="rf-tmin" value="' + (row.time_limit_min || '') + '"></div>' +
        '<div class="field"><label>时限上限</label><input type="number" class="rf-tmax" value="' + (row.time_limit_max || '') + '"></div>' +
      '</div>' +

      '<div class="section-divider" style="margin-top:8px;">讲员 / 会员选择 (条件 a)</div>' +
      '<div class="field"><label><input type="checkbox" class="rf-is-guest" style="width:auto;display:inline-block;margin-right:6px;" ' + (row.speaker_is_guest ? 'checked' : '') + '> 此讲员为来宾（非系统内会员）</label></div>' +
      '<div class="field rf-member-field" style="display:' + (row.speaker_is_guest ? 'none' : 'flex') + ';"><label>讲员（会员）</label><select class="rf-speaker-member">' + memberOptionsWithSelected + '</select></div>' +
      '<div class="field rf-guest-field" style="display:' + (row.speaker_is_guest ? 'flex' : 'none') + ';"><label>讲员（来宾姓名）</label><input type="text" class="rf-guest-name" value="' + escapeHtml(row.speaker_guest_name || '') + '"></div>' +

      '<div class="field-row">' +
        '<div class="field"><label>路径 Pathway</label><select class="rf-pathway">' + pathwayOptions + '</select></div>' +
        '<div class="field"><label>项目/单元 Project</label><select class="rf-project"><option value="">先选择路径…</option></select></div>' +
      '</div>' +
      '<div class="field"><label>讲题 Speech title</label><input type="text" class="rf-title" value="' + escapeHtml(row.speech_title || '') + '"></div>' +
      '<div class="field"><label>负责会友 Responsible member</label><select class="rf-responsible">' + respOptionsWithSelected + '</select></div>' +

      '<div class="section-divider" style="margin-top:8px;">附加资源 (条件 d)</div>' +
      '<div class="field"><label>评估表/资源链接</label><select class="rf-resource">' + resourceOptions + '</select></div>' +

      '<div class="flex justify-between mt-16">' +
        '<button class="btn btn-danger btn-sm rf-delete"><i class="ti ti-trash"></i> 删除此环节</button>' +
        '<button class="btn btn-primary btn-sm rf-save"><i class="ti ti-device-floppy"></i> 保存</button>' +
      '</div>' +
    '</div>'
  );
}

async function loadProjectsForPathway(pathwayId, selectEl, selectedProjectId) {
  if (!pathwayId) {
    selectEl.innerHTML = '<option value="">先选择路径…</option>';
    return;
  }
  selectEl.innerHTML = '<option value="">加载中…</option>';
  const levels = await API.get('/pathways/' + pathwayId + '/levels');
  let options = '<option value="">— 选择项目 —</option>';
  levels.forEach(function (lvl) {
    if (!lvl.projects || !lvl.projects.length) return;
    options += '<optgroup label="级别 ' + lvl.level_no + '">';
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

  const saveMetaBtn = document.getElementById('save-meta-btn');
  if (saveMetaBtn) saveMetaBtn.addEventListener('click', async function () {
    try {
      await API.put('/meetings/' + m.id, {
        theme: document.getElementById('m-theme').value,
        venue: document.getElementById('m-venue').value,
      });
      toast('已保存基本信息', 'success');
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
      toast('已保存例会成绩', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  const publishBtn = document.getElementById('publish-btn');
  if (publishBtn) publishBtn.addEventListener('click', async function () {
    try {
      await API.put('/meetings/' + m.id, { status: 'published' });
      toast('议程已发布', 'success');
      m.status = 'published';
      renderBuilderContent(false);
    } catch (err) { toast(err.message, 'error'); }
  });

  const addRowBtn = document.getElementById('add-row-btn');
  if (addRowBtn) addRowBtn.addEventListener('click', async function () {
    try {
      const defaultType = Store.itemTypes.filter(function (t) { return t.type_key === 'admin'; })[0];
      await API.post('/meetings/' + m.id + '/agenda', {
        item_type_id: defaultType ? defaultType.id : Store.itemTypes[0].id,
        summary_zh: '新环节',
      });
      await refreshMeeting(true);
    } catch (err) { toast(err.message, 'error'); }
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

    detail.querySelector('.rf-delete').addEventListener('click', async function () {
      if (!confirm('确定删除此议程环节？')) return;
      try {
        await API.del('/meetings/' + m.id + '/agenda/' + rowId);
        await refreshMeeting(true);
        toast('已删除', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });

    detail.querySelector('.rf-save').addEventListener('click', async function () {
      const resourceSel = detail.querySelector('.rf-resource');
      const resourceOpt = resourceSel.selectedOptions[0];
      try {
        await API.put('/meetings/' + m.id + '/agenda/' + rowId, {
          item_type_id: Number(detail.querySelector('.rf-type').value),
          scheduled_time: detail.querySelector('.rf-time').value,
          summary_zh: detail.querySelector('.rf-summary').value,
          section_label: detail.querySelector('.rf-section').value || null,
          time_limit_min: detail.querySelector('.rf-tmin').value ? Number(detail.querySelector('.rf-tmin').value) : null,
          time_limit_max: detail.querySelector('.rf-tmax').value ? Number(detail.querySelector('.rf-tmax').value) : null,
          speaker_is_guest: isGuestCb.checked ? 1 : 0,
          speaker_member_id: isGuestCb.checked ? null : (detail.querySelector('.rf-speaker-member').value || null),
          speaker_guest_name: isGuestCb.checked ? detail.querySelector('.rf-guest-name').value : null,
          pathway_id: pathwaySel.value || null,
          pathway_project_id: projectSel.value || null,
          speech_title: detail.querySelector('.rf-title').value || null,
          responsible_member_id: detail.querySelector('.rf-responsible').value || null,
          resource_label: resourceOpt && resourceOpt.dataset.label ? resourceOpt.dataset.label : null,
          resource_url: resourceOpt && resourceOpt.dataset.url ? resourceOpt.dataset.url : null,
        });
        toast('已保存环节', 'success');
        await refreshMeeting(true);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function refreshMeeting(editable) {
  const meeting = await API.get('/meetings/' + builderState.meeting.id);
  builderState.meeting = meeting;
  renderBuilderContent(!editable);
}
