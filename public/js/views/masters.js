// public/js/views/masters.js

async function renderMasters() {
  renderShell('/masters', '<div class="empty-state">' + t('loading') + '</div>');
  await loadMastersContent();
}

async function loadMastersContent() {
  const itemTypes = await API.get('/masters/item-types');
  const meetingRoles = await API.get('/masters/meeting-roles');
  const pathways = await API.get('/pathways?all=true');
  const clubSettings = await API.get('/club');

  const itemTypeRows = itemTypes.map(function (it) {
    const flags = [];
    if (it.requires_pathway) flags.push(t('requires_pathway_label'));
    if (it.requires_evaluator) flags.push(t('requires_evaluator_label'));
    if (it.requires_evaluates_selection) flags.push(t('requires_evaluates_selection_label'));
    return '<tr>' +
      '<td><code class="small">' + escapeHtml(it.type_key) + '</code></td>' +
      '<td>' + escapeHtml(it.label_zh) + '</td>' +
      '<td>' + escapeHtml(it.label_en || '—') + '</td>' +
      '<td class="small muted">' + (flags.join(' · ') || '—') + '</td>' +
      '<td><span class="badge ' + (it.is_active ? 'badge-jade' : 'badge-gray') + '">' + (it.is_active ? t('active_label') : t('inactive_label')) + '</span></td>' +
      '<td class="no-print flex gap-8">' +
        '<button class="btn btn-sm edit-itemtype-btn" data-id="' + it.id + '"><i class="ti ti-edit"></i></button>' +
        '<button class="btn btn-sm btn-danger del-itemtype-btn" data-id="' + it.id + '"><i class="ti ti-trash"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');

  const pathwayRows = pathways.map(function (p) {
    return '<tr>' +
      '<td><code class="small">' + escapeHtml(p.code) + '</code></td>' +
      '<td>' + escapeHtml(p.name_zh) + '</td>' +
      '<td>' + escapeHtml(p.name_en || '—') + '</td>' +
      '<td><span class="badge ' + (p.is_active ? 'badge-jade' : 'badge-gray') + '">' + (p.is_active ? t('active_label') : t('inactive_label')) + '</span></td>' +
      '<td class="no-print flex gap-8">' +
        '<button class="btn btn-sm edit-pathway-btn" data-id="' + p.id + '"><i class="ti ti-edit"></i></button>' +
        '<button class="btn btn-sm btn-danger del-pathway-btn" data-id="' + p.id + '"><i class="ti ti-trash"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');

  const roleRows = meetingRoles.map(function (r) {
    return '<tr>' +
      '<td>' + escapeHtml(r.role_name_zh) + '</td>' +
      '<td>' + escapeHtml(r.role_name_en || '—') + '</td>' +
      '<td><span class="badge ' + (r.is_active ? 'badge-jade' : 'badge-gray') + '">' + (r.is_active ? t('active_label') : t('inactive_label')) + '</span></td>' +
      '<td class="no-print flex gap-8">' +
        '<button class="btn btn-sm edit-role-btn" data-id="' + r.id + '"><i class="ti ti-edit"></i></button>' +
        '<button class="btn btn-sm btn-danger del-role-btn" data-id="' + r.id + '"><i class="ti ti-trash"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">' + escapeHtml(t('masters_title')) + '</div><h1>' + escapeHtml(t('masters_title')) + '</h1>' +
      '<p class="small muted mt-8">' + escapeHtml(t('masters_hint')) + '</p></div>' +
    '</div>' +

    '<div class="card card-pad">' +
      '<h2>' + escapeHtml(t('club_masters_section')) + '</h2>' +
      '<div class="field-row mt-16">' +
        '<div class="field"><label>' + escapeHtml(t('club_name_zh_label')) + '</label><input type="text" id="cs-name-zh" value="' + escapeHtml(clubSettings.club_name_zh || '') + '"></div>' +
        '<div class="field"><label>' + escapeHtml(t('club_name_en_label')) + '</label><input type="text" id="cs-name-en" value="' + escapeHtml(clubSettings.club_name_en || '') + '"></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('club_number_label')) + '</label><input type="text" id="cs-number" value="' + escapeHtml(clubSettings.club_number || '') + '"></div>' +
        '<div class="field"><label>' + escapeHtml(t('district_label_label')) + '</label><input type="text" id="cs-district" value="' + escapeHtml(clubSettings.district_label || '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>' + escapeHtml(t('default_venue_label')) + '</label><textarea id="cs-venue">' + escapeHtml(clubSettings.default_venue || '') + '</textarea></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('meeting_day_label')) + '</label><input type="text" id="cs-day" value="' + escapeHtml(clubSettings.meeting_day || '') + '" placeholder="例：每月第二、四个星期一"></div>' +
        '<div class="field"><label>' + escapeHtml(t('meeting_time_label')) + '</label><input type="text" id="cs-time" value="' + escapeHtml(clubSettings.meeting_time || '') + '" placeholder="19:00"></div>' +
      '</div>' +
      '<div class="field"><label>' + escapeHtml(t('tagline_label')) + '</label><input type="text" id="cs-tagline" value="' + escapeHtml(clubSettings.tagline || '') + '"></div>' +
      '<div class="field"><label>' + escapeHtml(t('mission_statement_label')) + '</label><textarea id="cs-mission">' + escapeHtml(clubSettings.mission_statement || '') + '</textarea></div>' +
      '<div class="field"><label>' + escapeHtml(t('dress_code_label')) + '</label><input type="text" id="cs-dress" value="' + escapeHtml(clubSettings.dress_code || '') + '"></div>' +
      '<h3 class="mt-16">' + escapeHtml(t('social_links_section')) + '</h3>' +
      '<div class="field-row">' +
        '<div class="field"><label><i class="ti ti-brand-youtube"></i> YouTube</label><input type="text" id="cs-youtube" value="' + escapeHtml(clubSettings.youtube_url || '') + '" placeholder="https://youtube.com/@..."></div>' +
        '<div class="field"><label><i class="ti ti-brand-facebook"></i> Facebook</label><input type="text" id="cs-facebook" value="' + escapeHtml(clubSettings.facebook_url || '') + '" placeholder="https://facebook.com/..."></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label><i class="ti ti-brand-instagram"></i> Instagram</label><input type="text" id="cs-instagram" value="' + escapeHtml(clubSettings.instagram_url || '') + '" placeholder="https://instagram.com/..."></div>' +
        '<div class="field"><label><i class="ti ti-brand-linkedin"></i> LinkedIn</label><input type="text" id="cs-linkedin" value="' + escapeHtml(clubSettings.linkedin_url || '') + '" placeholder="https://linkedin.com/company/..."></div>' +
      '</div>' +
      '<div class="field"><label><i class="ti ti-brand-tiktok"></i> TikTok</label><input type="text" id="cs-tiktok" value="' + escapeHtml(clubSettings.tiktok_url || '') + '" placeholder="https://tiktok.com/@..."></div>' +
      '<button class="btn btn-primary btn-sm" id="save-club-btn"><i class="ti ti-device-floppy"></i> ' + escapeHtml(t('save_club_settings')) + '</button>' +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<div class="flex justify-between items-center"><h2>' + escapeHtml(t('pathways_master_section')) + '</h2>' +
        '<button class="btn btn-primary btn-sm" id="add-pathway-btn"><i class="ti ti-plus"></i> ' + escapeHtml(t('add')) + '</button></div>' +
      '<table class="data-table mt-16">' +
        '<thead><tr><th>' + escapeHtml(t('pathway_code_label')) + '</th><th>' + escapeHtml(t('pathway_name_zh_label')) + '</th><th>' + escapeHtml(t('pathway_name_en_label')) + '</th><th>' + escapeHtml(t('status')) + '</th><th></th></tr></thead>' +
        '<tbody>' + (pathwayRows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px;">—</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<div class="flex justify-between items-center"><h2>' + escapeHtml(t('item_types_section')) + '</h2>' +
        '<button class="btn btn-primary btn-sm" id="add-itemtype-btn"><i class="ti ti-plus"></i> ' + escapeHtml(t('add')) + '</button></div>' +
      '<table class="data-table mt-16">' +
        '<thead><tr><th>' + escapeHtml(t('type_key_label')) + '</th><th>' + escapeHtml(t('label_zh_label')) + '</th><th>' + escapeHtml(t('label_en_label')) + '</th><th></th><th>' + escapeHtml(t('status')) + '</th><th></th></tr></thead>' +
        '<tbody>' + (itemTypeRows || '<tr><td colspan="6" class="muted" style="text-align:center;padding:20px;">—</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<div class="flex justify-between items-center"><h2>' + escapeHtml(t('meeting_roles_master_section')) + '</h2>' +
        '<button class="btn btn-primary btn-sm" id="add-role-btn"><i class="ti ti-plus"></i> ' + escapeHtml(t('add')) + '</button></div>' +
      '<table class="data-table mt-16">' +
        '<thead><tr><th>' + escapeHtml(t('label_zh_label')) + '</th><th>' + escapeHtml(t('label_en_label')) + '</th><th>' + escapeHtml(t('status')) + '</th><th></th></tr></thead>' +
        '<tbody>' + (roleRows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">—</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';

  setContent(html);

  document.getElementById('save-club-btn').addEventListener('click', async function () {
    try {
      await API.put('/club', {
        club_name_zh: document.getElementById('cs-name-zh').value.trim(),
        club_name_en: document.getElementById('cs-name-en').value.trim() || null,
        club_number: document.getElementById('cs-number').value.trim() || null,
        district_label: document.getElementById('cs-district').value.trim() || null,
        default_venue: document.getElementById('cs-venue').value.trim() || null,
        meeting_day: document.getElementById('cs-day').value.trim() || null,
        meeting_time: document.getElementById('cs-time').value.trim() || null,
        tagline: document.getElementById('cs-tagline').value.trim() || null,
        mission_statement: document.getElementById('cs-mission').value.trim() || null,
        dress_code: document.getElementById('cs-dress').value.trim() || null,
        youtube_url: document.getElementById('cs-youtube').value.trim() || null,
        facebook_url: document.getElementById('cs-facebook').value.trim() || null,
        instagram_url: document.getElementById('cs-instagram').value.trim() || null,
        linkedin_url: document.getElementById('cs-linkedin').value.trim() || null,
        tiktok_url: document.getElementById('cs-tiktok').value.trim() || null,
      });
      toast(I18N.lang === 'zh' ? '已保存俱乐部设置' : 'Club settings saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('add-itemtype-btn').addEventListener('click', function () { openItemTypeModal(null); });
  document.querySelectorAll('.edit-itemtype-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const it = itemTypes.filter(function (x) { return x.id === Number(btn.dataset.id); })[0];
      openItemTypeModal(it);
    });
  });
  document.querySelectorAll('.del-itemtype-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm(I18N.lang === 'zh' ? '确定停用此类型？' : 'Deactivate this type?')) return;
      try {
        await API.del('/masters/item-types/' + btn.dataset.id);
        toast(I18N.lang === 'zh' ? '已停用' : 'Deactivated', 'success');
        await Store.loadReferenceData();
        loadMastersContent();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('add-pathway-btn').addEventListener('click', function () { openPathwayModal(null); });
  document.querySelectorAll('.edit-pathway-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const p = pathways.filter(function (x) { return x.id === Number(btn.dataset.id); })[0];
      openPathwayModal(p);
    });
  });
  document.querySelectorAll('.del-pathway-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm(t('confirm_deactivate_pathway'))) return;
      try {
        await API.del('/pathways/' + btn.dataset.id);
        toast(I18N.lang === 'zh' ? '已停用' : 'Deactivated', 'success');
        await Store.loadReferenceData();
        loadMastersContent();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('add-role-btn').addEventListener('click', function () { openMeetingRoleModal(null); });
  document.querySelectorAll('.edit-role-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const r = meetingRoles.filter(function (x) { return x.id === Number(btn.dataset.id); })[0];
      openMeetingRoleModal(r);
    });
  });
  document.querySelectorAll('.del-role-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm(I18N.lang === 'zh' ? '确定停用此职务？' : 'Deactivate this role?')) return;
      try {
        await API.del('/masters/meeting-roles/' + btn.dataset.id);
        toast(I18N.lang === 'zh' ? '已停用' : 'Deactivated', 'success');
        await Store.loadReferenceData();
        loadMastersContent();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function openItemTypeModal(existing) {
  const isEdit = !!existing;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(isEdit ? t('edit') : t('add')) + ' — ' + escapeHtml(t('item_types_section')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('type_key_label')) + ' *</label><input type="text" id="f-key" value="' + (existing ? escapeHtml(existing.type_key) : '') + '" placeholder="custom_segment" ' + (isEdit ? 'disabled' : '') + '></div>' +
        '<div class="field"><label>' + escapeHtml(t('label_zh_label')) + ' *</label><input type="text" id="f-zh" value="' + (existing ? escapeHtml(existing.label_zh) : '') + '"></div>' +
        '<div class="field"><label>' + escapeHtml(t('label_en_label')) + '</label><input type="text" id="f-en" value="' + (existing && existing.label_en ? escapeHtml(existing.label_en) : '') + '"></div>' +
        '<div class="field"><label><input type="checkbox" id="f-req-pathway" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing && existing.requires_pathway ? 'checked' : '') + '> ' + escapeHtml(t('requires_pathway_label')) + '</label></div>' +
        '<div class="field"><label><input type="checkbox" id="f-req-eval" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing && existing.requires_evaluator ? 'checked' : '') + '> ' + escapeHtml(t('requires_evaluator_label')) + '</label></div>' +
        '<div class="field"><label><input type="checkbox" id="f-req-evalsel" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing && existing.requires_evaluates_selection ? 'checked' : '') + '> ' + escapeHtml(t('requires_evaluates_selection_label')) + '</label></div>' +
        (isEdit ? '<div class="field"><label><input type="checkbox" id="f-active" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing.is_active ? 'checked' : '') + '> ' + escapeHtml(t('active_label')) + '</label></div>' : '') +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const body = {
      label_zh: document.getElementById('f-zh').value.trim(),
      label_en: document.getElementById('f-en').value.trim() || null,
      requires_pathway: document.getElementById('f-req-pathway').checked ? 1 : 0,
      requires_evaluator: document.getElementById('f-req-eval').checked ? 1 : 0,
      requires_evaluates_selection: document.getElementById('f-req-evalsel').checked ? 1 : 0,
    };
    if (!body.label_zh) { toast(I18N.lang === 'zh' ? '请输入中文名称' : 'Please enter a Chinese label', 'error'); return; }
    if (isEdit) body.is_active = document.getElementById('f-active').checked ? 1 : 0;

    try {
      if (isEdit) {
        await API.put('/masters/item-types/' + existing.id, body);
      } else {
        const key = document.getElementById('f-key').value.trim();
        if (!key) { toast(I18N.lang === 'zh' ? '请输入类型代码' : 'Please enter a type key', 'error'); return; }
        body.type_key = key;
        await API.post('/masters/item-types', body);
      }
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      await Store.loadReferenceData();
      loadMastersContent();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function openPathwayModal(existing) {
  const isEdit = !!existing;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(isEdit ? t('edit') : t('add')) + ' — ' + escapeHtml(t('pathways_master_section')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('pathway_code_label')) + ' *</label><input type="text" id="f-code" value="' + (existing ? escapeHtml(existing.code) : '') + '" placeholder="PM"></div>' +
        '<div class="field"><label>' + escapeHtml(t('pathway_name_zh_label')) + ' *</label><input type="text" id="f-zh" value="' + (existing ? escapeHtml(existing.name_zh) : '') + '" placeholder="精通演说"></div>' +
        '<div class="field"><label>' + escapeHtml(t('pathway_name_en_label')) + '</label><input type="text" id="f-en" value="' + (existing && existing.name_en ? escapeHtml(existing.name_en) : '') + '" placeholder="Persuasive Influence"></div>' +
        (isEdit ? '<div class="field"><label><input type="checkbox" id="f-active" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing.is_active ? 'checked' : '') + '> ' + escapeHtml(t('active_label')) + '</label></div>' : '') +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const body = {
      code: document.getElementById('f-code').value.trim(),
      name_zh: document.getElementById('f-zh').value.trim(),
      name_en: document.getElementById('f-en').value.trim() || null,
    };
    if (!body.code) { toast(I18N.lang === 'zh' ? '请输入路径代码' : 'Please enter a pathway code', 'error'); return; }
    if (!body.name_zh) { toast(I18N.lang === 'zh' ? '请输入中文名称' : 'Please enter a Chinese name', 'error'); return; }
    if (isEdit) body.is_active = document.getElementById('f-active').checked ? 1 : 0;

    try {
      if (isEdit) {
        await API.put('/pathways/' + existing.id, body);
      } else {
        await API.post('/pathways', body);
      }
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      await Store.loadReferenceData();
      loadMastersContent();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function openMeetingRoleModal(existing) {
  const isEdit = !!existing;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(isEdit ? t('edit') : t('add')) + ' — ' + escapeHtml(t('meeting_roles_master_section')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('label_zh_label')) + ' *</label><input type="text" id="f-zh" value="' + (existing ? escapeHtml(existing.role_name_zh) : '') + '" placeholder="礼宾司"></div>' +
        '<div class="field"><label>' + escapeHtml(t('label_en_label')) + '</label><input type="text" id="f-en" value="' + (existing && existing.role_name_en ? escapeHtml(existing.role_name_en) : '') + '"></div>' +
        (isEdit ? '<div class="field"><label><input type="checkbox" id="f-active" style="width:auto;display:inline-block;margin-right:6px;" ' + (existing.is_active ? 'checked' : '') + '> ' + escapeHtml(t('active_label')) + '</label></div>' : '') +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const body = {
      role_name_zh: document.getElementById('f-zh').value.trim(),
      role_name_en: document.getElementById('f-en').value.trim() || null,
    };
    if (!body.role_name_zh) { toast(I18N.lang === 'zh' ? '请输入中文名称' : 'Please enter a Chinese label', 'error'); return; }
    if (isEdit) body.is_active = document.getElementById('f-active').checked ? 1 : 0;

    try {
      if (isEdit) {
        await API.put('/masters/meeting-roles/' + existing.id, body);
      } else {
        await API.post('/masters/meeting-roles', body);
      }
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      await Store.loadReferenceData();
      loadMastersContent();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
