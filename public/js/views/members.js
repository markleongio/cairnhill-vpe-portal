// public/js/views/members.js

let membersViewState = { q: '', status: 'active', type: 'member' };

async function renderMembers() {
  renderShell('/members', '<div class="empty-state">加载中…</div>');
  await loadMembersTable();
}

async function loadMembersTable() {
  const params = new URLSearchParams();
  if (membersViewState.q) params.set('q', membersViewState.q);
  if (membersViewState.status) params.set('status', membersViewState.status);
  if (membersViewState.type) params.set('type', membersViewState.type);

  const [list, overview] = await Promise.all([
    API.get('/members?' + params.toString()),
    API.get('/members/dashboard/overview'),
  ]);
  const overviewMap = {};
  overview.forEach(function (o) { overviewMap[o.id] = o; });

  const rows = list.map(function (m) {
    const ov = overviewMap[m.id] || {};
    const pathwayCell = ov.pathway_name
      ? '<span class="badge badge-jade">' + escapeHtml(ov.pathway_code) + ' · ' + escapeHtml(ov.pathway_name) + '</span>'
      : '<span class="muted small">未登记</span>';
    return '<tr data-id="' + m.id + '">' +
      '<td><div class="member-cell">' + progressRing(ov.current_level, 5, 34, ov.current_level ? undefined : '—') +
        '<div><div style="font-weight:500">' + escapeHtml(m.full_name) + '</div>' +
        '<div class="small muted">' + escapeHtml(m.member_no || '') + '</div></div></div></td>' +
      '<td>' + pathwayCell + '</td>' +
      '<td>' + (ov.current_level ? '级别 ' + ov.current_level + ' / 5' : '—') + '</td>' +
      '<td>' + (ov.total_completed || 0) + '</td>' +
      '<td><span class="badge ' + (m.status === 'active' ? 'badge-jade' : 'badge-gray') + '">' + (m.status === 'active' ? '活跃' : m.status) + '</span></td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">会员管理</div><h1>会员进度</h1></div>' +
      '<button class="btn btn-primary" id="add-member-btn"><i class="ti ti-user-plus"></i> 新增会员</button>' +
    '</div>' +
    '<div class="card card-pad">' +
      '<div class="flex gap-12" style="margin-bottom:16px;">' +
        '<input type="text" id="member-search" placeholder="搜索姓名或会员编号…" style="max-width:280px" value="' + escapeHtml(membersViewState.q) + '">' +
        '<select id="member-status-filter" style="max-width:160px">' +
          '<option value="active"' + (membersViewState.status === 'active' ? ' selected' : '') + '>活跃 Active</option>' +
          '<option value="inactive"' + (membersViewState.status === 'inactive' ? ' selected' : '') + '>非活跃 Inactive</option>' +
          '<option value="">全部状态</option>' +
        '</select>' +
      '</div>' +
      '<table class="data-table clickable">' +
        '<thead><tr><th>会员</th><th>主修路径</th><th>当前级别</th><th>累计完成</th><th>状态</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">没有符合条件的会员</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';

  setContent(html);

  document.querySelectorAll('tr[data-id]').forEach(function (tr) {
    tr.addEventListener('click', function () { navigate('/members/' + tr.dataset.id); });
  });
  document.getElementById('add-member-btn').addEventListener('click', openAddMemberModal);

  let searchTimer;
  document.getElementById('member-search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    membersViewState.q = e.target.value;
    searchTimer = setTimeout(loadMembersTable, 300);
  });
  document.getElementById('member-status-filter').addEventListener('change', function (e) {
    membersViewState.status = e.target.value;
    loadMembersTable();
  });
}

function openAddMemberModal() {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>新增会员</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>姓名 Full name *</label><input type="text" id="f-name" required></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>会员编号</label><input type="text" id="f-no"></div>' +
          '<div class="field"><label>类型</label><select id="f-type"><option value="member">会员 Member</option><option value="guest">访客 Guest</option></select></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label>电话</label><input type="text" id="f-phone"></div>' +
          '<div class="field"><label>电邮</label><input type="text" id="f-email"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">取消</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> 保存</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const full_name = document.getElementById('f-name').value.trim();
    if (!full_name) { toast('请输入姓名', 'error'); return; }
    try {
      await API.post('/members', {
        full_name: full_name,
        chinese_name: full_name,
        member_no: document.getElementById('f-no').value.trim(),
        membership_type: document.getElementById('f-type').value,
        phone: document.getElementById('f-phone').value.trim(),
        email: document.getElementById('f-email').value.trim(),
      });
      toast('已新增会员', 'success');
      close();
      await Store.loadReferenceData();
      loadMembersTable();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
