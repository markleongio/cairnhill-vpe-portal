// public/js/views/memberDetail.js

async function renderMemberDetail(id) {
  renderShell('/members', '<div class="empty-state">' + t('loading') + '</div>');
  const m = await API.get('/members/' + id);

  const progressCards = (m.progress || []).map(function (p) {
    const hasLevel = p.current_level !== null && p.current_level !== undefined;
    return '<div class="card card-pad flex items-center gap-12" style="min-width:220px;position:relative;">' +
      progressRing(p.current_level, 5, 48, hasLevel ? undefined : '—') +
      '<div><div style="font-weight:500">' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</div>' +
      '<div class="small muted">' + (hasLevel ? escapeHtml(t('current_level')) + ' ' + p.current_level + ' / 5' : escapeHtml(t('unassigned_level'))) + (p.is_primary_pathway ? ' · ' + escapeHtml(t('primary_pathway')) : '') + '</div></div>' +
      '<button class="btn btn-sm edit-progress-btn" style="position:absolute;top:8px;right:8px;" data-pathway="' + p.pathway_id + '" data-level="' + (hasLevel ? p.current_level : '') + '" data-primary="' + (p.is_primary_pathway ? '1' : '0') + '"><i class="ti ti-edit"></i></button>' +
    '</div>';
  }).join('');

  const completionRows = (m.completions || []).map(function (c) {
    return '<tr>' +
      '<td>' + fmtDate(c.completed_date) + '</td>' +
      '<td><span class="badge badge-jade">' + escapeHtml(c.pathway_code) + '</span> ' + escapeHtml(c.level_label || (t('pathway_level') + c.level_no)) + ' · ' + escapeHtml(c.project_name_zh) + '</td>' +
      '<td>' + escapeHtml(c.speech_title || '—') + '</td>' +
      '<td>' + (c.meeting_no ? escapeHtml(c.meeting_no) : '—') + '</td>' +
    '</tr>';
  }).join('');

  const excoRows = (m.excoHistory || []).map(function (e) {
    return '<tr><td>' + escapeHtml(e.term_label) + '</td><td>' + escapeHtml(e.role_name_zh) + '</td><td>' + escapeHtml(e.designation || '—') + '</td></tr>';
  }).join('');

  const roleHistoryRows = (m.meetingRoleHistory || []).map(function (r) {
    return '<tr>' +
      '<td>' + fmtDate(r.meeting_date) + '</td>' +
      '<td>' + escapeHtml(r.meeting_no || '—') + '</td>' +
      '<td>' + escapeHtml(r.role_name_zh) + '</td>' +
    '</tr>';
  }).join('');

  const pathwayOptions = Store.pathways.map(function (p) {
    return '<option value="' + p.id + '">' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</option>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div>' +
        '<a href="#/members" class="small muted"><i class="ti ti-arrow-left"></i> ' + escapeHtml(t('back')) + '</a>' +
        '<h1 class="mt-8">' + escapeHtml(m.full_name) + '</h1>' +
        '<div class="small muted mt-8">' + escapeHtml(t('member_no_label')) + ' ' + escapeHtml(m.member_no || '—') + (m.email ? ' · ' + escapeHtml(m.email) : '') + (m.phone ? ' · ' + escapeHtml(m.phone) : '') + '</div>' +
      '</div>' +
      '<div class="flex gap-8">' +
        '<button class="btn" id="edit-member-btn"><i class="ti ti-edit"></i> ' + escapeHtml(t('edit')) + '</button>' +
        '<button class="btn btn-primary" id="enroll-btn"><i class="ti ti-route"></i> ' + escapeHtml(t('register_new_pathway')) + '</button>' +
      '</div>' +
    '</div>' +

    '<h2 class="mt-24">' + escapeHtml(t('pathway_progress')) + '</h2>' +
    '<div class="flex gap-12 mt-16" style="flex-wrap:wrap;">' +
      (progressCards || '<div class="muted small">' + escapeHtml(t('not_registered')) + '</div>') +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<h2>' + escapeHtml(t('completed_projects')) + '</h2>' +
      '<table class="data-table mt-16"><thead><tr><th>' + escapeHtml(t('date')) + '</th><th>' + escapeHtml(t('project_unit')) + '</th><th>' + escapeHtml(t('speech_title')) + '</th><th>' + escapeHtml(t('meeting_no')) + '</th></tr></thead>' +
      '<tbody>' + (completionRows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">' + escapeHtml(t('no_completions')) + '</td></tr>') + '</tbody></table>' +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<h2>' + escapeHtml(t('exco_history')) + '</h2>' +
      '<table class="data-table mt-16"><thead><tr><th>' + escapeHtml(t('term')) + '</th><th>' + escapeHtml(t('role')) + '</th><th>' + escapeHtml(t('designation')) + '</th></tr></thead>' +
      '<tbody>' + (excoRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px;">' + escapeHtml(t('no_exco_history')) + '</td></tr>') + '</tbody></table>' +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<h2>' + escapeHtml(t('meeting_role_history')) + '</h2>' +
      '<table class="data-table mt-16"><thead><tr><th>' + escapeHtml(t('date')) + '</th><th>' + escapeHtml(t('meeting_no')) + '</th><th>' + escapeHtml(t('role_label')) + '</th></tr></thead>' +
      '<tbody>' + (roleHistoryRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px;">' + escapeHtml(t('no_role_history')) + '</td></tr>') + '</tbody></table>' +
    '</div>';

  setContent(html);

  document.getElementById('enroll-btn').addEventListener('click', function () {
    openEnrollModal(id, pathwayOptions);
  });

  document.querySelectorAll('.edit-progress-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openEnrollModal(id, pathwayOptions, {
        pathwayId: btn.dataset.pathway,
        currentLevel: btn.dataset.level,
        isPrimary: btn.dataset.primary === '1',
      });
    });
  });

  document.getElementById('edit-member-btn').addEventListener('click', function () {
    openEditMemberModal(m);
  });
}

function openEditMemberModal(member) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(t('edit')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('full_name')) + ' *</label><input type="text" id="f-name" value="' + escapeHtml(member.full_name || '') + '"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>' + escapeHtml(t('member_no_label')) + '</label><input type="text" id="f-no" value="' + escapeHtml(member.member_no || '') + '"></div>' +
          '<div class="field"><label>' + escapeHtml(t('member_type')) + '</label><select id="f-type">' +
            '<option value="member"' + (member.membership_type === 'member' ? ' selected' : '') + '>' + escapeHtml(t('type_member')) + '</option>' +
            '<option value="guest"' + (member.membership_type === 'guest' ? ' selected' : '') + '>' + escapeHtml(t('type_guest')) + '</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label>' + escapeHtml(t('phone_label')) + '</label><input type="text" id="f-phone" value="' + escapeHtml(member.phone || '') + '"></div>' +
          '<div class="field"><label>' + escapeHtml(t('email_label')) + '</label><input type="text" id="f-email" value="' + escapeHtml(member.email || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>' + escapeHtml(t('active_status')) + '</label><select id="f-status">' +
          '<option value="active"' + (member.status === 'active' ? ' selected' : '') + '>' + escapeHtml(t('active_status')) + '</option>' +
          '<option value="inactive"' + (member.status === 'inactive' ? ' selected' : '') + '>Inactive</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const full_name = document.getElementById('f-name').value.trim();
    if (!full_name) { toast(I18N.lang === 'zh' ? '请输入姓名' : 'Please enter a name', 'error'); return; }
    try {
      await API.put('/members/' + member.id, {
        full_name: full_name,
        member_no: document.getElementById('f-no').value.trim() || null,
        membership_type: document.getElementById('f-type').value,
        phone: document.getElementById('f-phone').value.trim() || null,
        email: document.getElementById('f-email').value.trim() || null,
        status: document.getElementById('f-status').value,
      });
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      await Store.loadReferenceData();
      renderMemberDetail(member.id);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function openEnrollModal(memberId, pathwayOptionsHtml, existing) {
  const isEdit = !!existing;
  const pathwaySelectHtml = isEdit
    ? Store.pathways.map(function (p) {
        const sel = String(p.id) === String(existing.pathwayId) ? ' selected' : '';
        return '<option value="' + p.id + '"' + sel + '>' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</option>';
      }).join('')
    : pathwayOptionsHtml;

  function buildLevelOptions(levels) {
    let opts = '<option value="">' + escapeHtml(t('unassigned_level')) + '</option>';
    opts += levels.map(function (l) {
      const sel = isEdit && String(existing.currentLevel) === String(l.level_no) ? ' selected' : '';
      return '<option value="' + l.level_no + '"' + sel + '>' + escapeHtml(l.level_label || (t('pathway_level') + ' ' + l.level_no)) + '</option>';
    }).join('');
    return opts;
  }

  const initialPathwayId = isEdit ? existing.pathwayId : (Store.pathways[0] && Store.pathways[0].id);
  let initialLevels = [];
  try {
    initialLevels = initialPathwayId ? await API.get('/pathways/' + initialPathwayId + '/levels') : [];
  } catch (err) { initialLevels = []; }

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(isEdit ? t('edit') : t('register_new_pathway')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('pathway')) + '</label><select id="f-pathway"' + (isEdit ? ' disabled' : '') + '>' + pathwaySelectHtml + '</select></div>' +
        '<div class="field"><label>' + escapeHtml(t('current_level')) + '</label><select id="f-level">' + buildLevelOptions(initialLevels) + '</select></div>' +
        '<div class="field"><label><input type="checkbox" id="f-primary" ' + (isEdit ? (existing.isPrimary ? 'checked' : '') : 'checked') + ' style="width:auto;display:inline-block;margin-right:6px;"> ' + escapeHtml(t('set_as_primary')) + '</label></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  if (!isEdit) {
    document.getElementById('f-pathway').addEventListener('change', async function () {
      const levelSelect = document.getElementById('f-level');
      try {
        const levels = await API.get('/pathways/' + this.value + '/levels');
        levelSelect.innerHTML = buildLevelOptions(levels);
      } catch (err) { /* leave options as-is if this fails */ }
    });
  }

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    try {
      const levelRaw = document.getElementById('f-level').value;
      const pathwayId = isEdit ? Number(existing.pathwayId) : Number(document.getElementById('f-pathway').value);
      await API.post('/members/' + memberId + '/progress', {
        pathway_id: pathwayId,
        current_level: levelRaw === '' ? null : Number(levelRaw),
        is_primary_pathway: document.getElementById('f-primary').checked ? 1 : 0,
      });
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      renderMemberDetail(memberId);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
