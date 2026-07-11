// public/js/views/exco.js

async function renderExco() {
  renderShell('/exco', '<div class="empty-state">' + t('loading') + '</div>');
  const terms = await API.get('/exco/terms');
  const currentTerm = terms[0] ? terms[0].term_label : null;
  await loadExcoTerm(currentTerm, terms);
}

async function loadExcoTerm(termLabel, terms) {
  const roster = termLabel ? await API.get('/exco/terms/' + encodeURIComponent(termLabel) + '/roster') : [];

  const termOptions = terms.map(function (term) {
    const sel = term.term_label === termLabel ? ' selected' : '';
    return '<option value="' + escapeHtml(term.term_label) + '"' + sel + '>' + escapeHtml(term.term_label) + '</option>';
  }).join('');

  const rosterByRole = {};
  roster.forEach(function (r) {
    if (!rosterByRole[r.role_id]) rosterByRole[r.role_id] = [];
    rosterByRole[r.role_id].push(r);
  });

  const rows = Store.excoRoles.map(function (role) {
    const holders = rosterByRole[role.id] || [];
    const holdersHtml = holders.length
      ? holders.map(function (r) {
          return '<div class="holder-row">' +
            '<div class="member-cell"><div class="avatar-chip">' + escapeHtml(initials(r.full_name)) + '</div>' +
              '<div><div>' + escapeHtml(r.full_name) + '</div>' +
                '<div class="small muted">' + [r.designation, r.member_no].filter(Boolean).map(function (s) { return escapeHtml(s); }).join(' · ') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="no-print flex gap-4">' +
              '<button class="btn btn-sm edit-holder-btn" data-role="' + role.id + '" data-member="' + r.member_id + '" data-designation="' + escapeHtml(r.designation || '') + '" data-name="' + escapeHtml(r.full_name) + '"><i class="ti ti-edit"></i></button>' +
              '<button class="btn btn-sm btn-danger remove-holder-btn" data-role="' + role.id + '" data-member="' + r.member_id + '"><i class="ti ti-trash"></i></button>' +
            '</div>' +
          '</div>';
        }).join('')
      : '<span class="muted small">' + escapeHtml(t('not_assigned')) + '</span>';

    return '<tr>' +
      '<td><div style="font-weight:500">' + escapeHtml(role.role_name_zh) + '</div><div class="small muted">' + escapeHtml(role.role_name_en || '') + '</div></td>' +
      '<td>' + holdersHtml + '</td>' +
      '<td class="no-print"><button class="btn btn-sm add-holder-btn" data-role="' + role.id + '"><i class="ti ti-plus"></i> ' + escapeHtml(t('add')) + '</button></td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">' + escapeHtml(t('nav_exco')) + '</div><h1>' + escapeHtml(t('exco_roster')) + '</h1></div>' +
      '<div class="flex gap-8">' +
        (terms.length ? '<select id="term-select" style="max-width:240px">' + termOptions + '</select>' : '') +
        '<button class="btn btn-primary btn-sm" id="manage-terms-btn"><i class="ti ti-calendar-plus"></i> ' + escapeHtml(t('exco_terms_section')) + '</button>' +
      '</div>' +
    '</div>' +
    (terms.length
      ? '<div class="card card-pad">' +
          '<table class="data-table">' +
            '<thead><tr><th>' + escapeHtml(t('position')) + '</th><th>' + escapeHtml(t('member_holding')) + '</th><th></th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>'
      : '<div class="card card-pad"><div class="empty-state"><i class="ti ti-calendar-off"></i>' + escapeHtml(t('no_terms_yet')) + '</div></div>');

  setContent(html);

  const termSelect = document.getElementById('term-select');
  if (termSelect) termSelect.addEventListener('change', function (e) {
    loadExcoTerm(e.target.value, terms);
  });

  document.getElementById('manage-terms-btn').addEventListener('click', function () {
    openManageTermsModal(terms, termLabel);
  });

  document.querySelectorAll('.add-holder-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openAddHolderModal(termLabel, btn.dataset.role, terms);
    });
  });
  document.querySelectorAll('.edit-holder-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openEditHolderModal(termLabel, btn.dataset.role, btn.dataset.member, btn.dataset.name, btn.dataset.designation, terms);
    });
  });
  document.querySelectorAll('.remove-holder-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm(I18N.lang === 'zh' ? '确定移除此人员？' : 'Remove this person from the role?')) return;
      try {
        await API.del('/exco/terms/' + encodeURIComponent(termLabel) + '/roles/' + btn.dataset.role + '/members/' + btn.dataset.member);
        toast(I18N.lang === 'zh' ? '已移除' : 'Removed', 'success');
        loadExcoTerm(termLabel, terms);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function openAddHolderModal(termLabel, roleId, terms) {
  const memberOptions = Store.members.map(function (mb) {
    return '<option value="' + mb.id + '">' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(t('add')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('member_holding')) + '</label><select id="f-member">' + memberOptions + '</select></div>' +
        '<div class="field"><label>' + escapeHtml(t('designation')) + '</label><input type="text" id="f-designation" placeholder="DTM, CTM/CL/PM1"></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    try {
      await API.post('/exco/terms/' + encodeURIComponent(termLabel) + '/assign', {
        role_id: Number(roleId),
        member_id: Number(document.getElementById('f-member').value),
        designation: document.getElementById('f-designation').value,
      });
      toast(I18N.lang === 'zh' ? '已新增' : 'Added', 'success');
      close();
      loadExcoTerm(termLabel, terms);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function openEditHolderModal(termLabel, roleId, memberId, memberName, currentDesignation, terms) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(t('edit')) + ' — ' + escapeHtml(memberName) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('designation')) + '</label><input type="text" id="f-designation" value="' + escapeHtml(currentDesignation || '') + '" placeholder="DTM, CTM/CL/PM1"></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    try {
      await API.post('/exco/terms/' + encodeURIComponent(termLabel) + '/assign', {
        role_id: Number(roleId),
        member_id: Number(memberId),
        designation: document.getElementById('f-designation').value,
      });
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      loadExcoTerm(termLabel, terms);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function openManageTermsModal(terms, activeTermLabel) {
  const rows = terms.map(function (term) {
    return '<tr>' +
      '<td>' + escapeHtml(term.term_label) + '</td>' +
      '<td class="small muted">' + (term.start_date ? fmtDate(term.start_date.slice(0, 10)) : '—') + '</td>' +
      '<td><span class="badge ' + (term.status === 'active' ? 'badge-jade' : 'badge-gray') + '">' + (term.status === 'active' ? t('term_status_active') : t('term_status_archived')) + '</span></td>' +
      '<td><button class="btn btn-sm btn-danger del-term-btn" data-id="' + term.id + '"><i class="ti ti-trash"></i></button></td>' +
    '</tr>';
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal" style="max-width:640px;">' +
      '<div class="modal-head"><h3>' + escapeHtml(t('exco_terms_section')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<table class="data-table mt-8">' +
          '<thead><tr><th>' + escapeHtml(t('term_label_field')) + '</th><th>' + escapeHtml(t('start_date_label')) + '</th><th>' + escapeHtml(t('status')) + '</th><th></th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:16px;">—</td></tr>') + '</tbody>' +
        '</table>' +
        '<div class="section-divider" style="margin-top:16px;">' + escapeHtml(t('add_term')) + '</div>' +
        '<div class="field"><label>' + escapeHtml(t('term_label_field')) + ' *</label><input type="text" id="f-label" placeholder="2026-2027年度经禧执委"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>' + escapeHtml(t('start_date_label')) + '</label><input type="date" id="f-start"></div>' +
          '<div class="field"><label>' + escapeHtml(t('end_date_label')) + '</label><input type="date" id="f-end"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('close')) + '</button><button class="btn btn-primary" id="add-term-btn"><i class="ti ti-plus"></i> ' + escapeHtml(t('add_term')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', async function () {
    close();
    await renderExco();
  });

  document.querySelectorAll('.del-term-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm(t('confirm_delete_term'))) return;
      try {
        await API.del('/exco/terms/' + btn.dataset.id + '?force=true');
        toast(I18N.lang === 'zh' ? '已删除' : 'Deleted', 'success');
        close();
        await renderExco();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('add-term-btn').addEventListener('click', async function () {
    const label = document.getElementById('f-label').value.trim();
    if (!label) { toast(I18N.lang === 'zh' ? '请输入届次名称' : 'Please enter a term label', 'error'); return; }
    try {
      await API.post('/exco/terms', {
        term_label: label,
        start_date: document.getElementById('f-start').value || null,
        end_date: document.getElementById('f-end').value || null,
      });
      toast(I18N.lang === 'zh' ? '已新增届次' : 'Term added', 'success');
      close();
      const newTerms = await API.get('/exco/terms');
      await loadExcoTerm(label, newTerms);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
