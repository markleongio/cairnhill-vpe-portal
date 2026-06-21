// public/js/views/exco.js

async function renderExco() {
  renderShell('/exco', '<div class="empty-state">加载中…</div>');
  const terms = await API.get('/exco/terms');
  const currentTerm = (terms[0] && terms[0].term_label) || '2024-2025年度经禧执委';
  await loadExcoTerm(currentTerm, terms);
}

async function loadExcoTerm(termLabel, terms) {
  const roster = await API.get('/exco/terms/' + encodeURIComponent(termLabel));

  const termOptions = terms.map(function (t) {
    const sel = t.term_label === termLabel ? ' selected' : '';
    return '<option value="' + escapeHtml(t.term_label) + '"' + sel + '>' + escapeHtml(t.term_label) + '</option>';
  }).join('');

  const rosterByRole = {};
  roster.forEach(function (r) { rosterByRole[r.role_id] = r; });

  const rows = Store.excoRoles.map(function (role) {
    const r = rosterByRole[role.id];
    return '<tr>' +
      '<td><div style="font-weight:500">' + escapeHtml(role.role_name_zh) + '</div><div class="small muted">' + escapeHtml(role.role_name_en || '') + '</div></td>' +
      '<td>' + (r ? '<div class="member-cell"><div class="avatar-chip">' + escapeHtml(initials(r.full_name)) + '</div><div>' + escapeHtml(r.full_name) + '</div></div>' : '<span class="muted small">— 未指派 —</span>') + '</td>' +
      '<td>' + (r && r.designation ? '<span class="badge badge-gold">' + escapeHtml(r.designation) + '</span>' : '') + '</td>' +
      '<td>' + (r ? escapeHtml(r.member_no || '') : '') + '</td>' +
      '<td class="no-print"><button class="btn btn-sm assign-btn" data-role="' + role.id + '" data-current="' + (r ? r.member_id : '') + '" data-designation="' + escapeHtml((r && r.designation) || '') + '">指派 / 更换</button></td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">执委管理</div><h1>执委名单</h1></div>' +
      '<select id="term-select" style="max-width:240px">' + termOptions + '</select>' +
    '</div>' +
    '<div class="card card-pad">' +
      '<table class="data-table">' +
        '<thead><tr><th>职务</th><th>担任会友</th><th>荣衔</th><th>会员编号</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';

  setContent(html);

  document.getElementById('term-select').addEventListener('change', function (e) {
    loadExcoTerm(e.target.value, terms);
  });

  document.querySelectorAll('.assign-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openAssignModal(termLabel, btn.dataset.role, btn.dataset.current, btn.dataset.designation, terms);
    });
  });
}

function openAssignModal(termLabel, roleId, currentMemberId, currentDesignation, terms) {
  const memberOptions = Store.members.map(function (mb) {
    const sel = String(mb.id) === currentMemberId ? ' selected' : '';
    return '<option value="' + mb.id + '"' + sel + '>' + escapeHtml(mb.full_name) + '</option>';
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>指派职务</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>会员</label><select id="f-member">' + memberOptions + '</select></div>' +
        '<div class="field"><label>荣衔 Designation</label><input type="text" id="f-designation" value="' + escapeHtml(currentDesignation || '') + '" placeholder="例：DTM, CTM/CL/PM1"></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">取消</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> 保存</button></div>' +
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
      toast('已指派职务', 'success');
      close();
      loadExcoTerm(termLabel, terms);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
