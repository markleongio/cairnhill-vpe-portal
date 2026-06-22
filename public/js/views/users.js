// public/js/views/users.js

async function renderUsers() {
  renderShell('/users', '<div class="empty-state">' + t('loading') + '</div>');
  await loadUsersTable();
}

async function loadUsersTable() {
  const users = await API.get('/users');

  const rows = users.map(function (u) {
    const isSelf = Store.user && Store.user.id === u.id;
    return '<tr>' +
      '<td><div style="font-weight:500">' + escapeHtml(u.username) + '</div>' + (isSelf ? '<span class="badge badge-gold small">' + (I18N.lang === 'zh' ? '目前登录' : 'Current session') + '</span>' : '') + '</td>' +
      '<td>' + escapeHtml(u.member_name || '—') + '</td>' +
      '<td><span class="badge badge-navy">' + escapeHtml(u.role) + '</span></td>' +
      '<td class="small muted">' + (u.last_login_at ? fmtDate(u.last_login_at.slice(0, 10)) : t('never')) + '</td>' +
      '<td class="no-print flex gap-8">' +
        '<button class="btn btn-sm edit-user-btn" data-id="' + u.id + '"><i class="ti ti-edit"></i></button>' +
        '<button class="btn btn-sm btn-danger del-user-btn" data-id="' + u.id + '" ' + (isSelf ? 'disabled title="' + escapeHtml(t('cannot_delete_self')) + '"' : '') + '><i class="ti ti-trash"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">' + escapeHtml(t('user_management')) + '</div><h1>' + escapeHtml(t('user_management')) + '</h1>' +
      '<p class="small muted mt-8">' + escapeHtml(t('user_management_hint')) + '</p></div>' +
      '<button class="btn btn-primary" id="add-user-btn"><i class="ti ti-user-plus"></i> ' + escapeHtml(t('add_user')) + '</button>' +
    '</div>' +
    '<div class="card card-pad">' +
      '<table class="data-table">' +
        '<thead><tr><th>' + escapeHtml(t('username_label')) + '</th><th>' + escapeHtml(t('linked_member_optional')) + '</th><th>' + escapeHtml(t('role')) + '</th><th>' + escapeHtml(t('last_login')) + '</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">—</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';

  setContent(html);

  document.getElementById('add-user-btn').addEventListener('click', function () { openUserModal(null); });
  document.querySelectorAll('.edit-user-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const u = users.find(function (x) { return x.id === Number(btn.dataset.id); });
      openUserModal(u);
    });
  });
  document.querySelectorAll('.del-user-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (btn.disabled) return;
      if (!confirm(t('confirm_delete_user'))) return;
      try {
        await API.del('/users/' + btn.dataset.id);
        toast(I18N.lang === 'zh' ? '已删除' : 'Deleted', 'success');
        loadUsersTable();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

function openUserModal(existingUser) {
  const isEdit = !!existingUser;
  const memberOptions = '<option value="">—</option>' + Store.members.map(function (m) {
    const sel = existingUser && existingUser.member_id === m.id ? ' selected' : '';
    return '<option value="' + m.id + '"' + sel + '>' + escapeHtml(m.full_name) + '</option>';
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>' + escapeHtml(isEdit ? t('edit') : t('add_user')) + '</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>' + escapeHtml(t('username_label')) + ' *</label><input type="text" id="f-username" value="' + (existingUser ? escapeHtml(existingUser.username) : '') + '"></div>' +
        '<div class="field"><label>' + escapeHtml(isEdit ? t('new_password_optional') : t('password_label')) + (isEdit ? '' : ' *') + '</label><input type="password" id="f-password"></div>' +
        '<div class="field"><label>' + escapeHtml(t('linked_member_optional')) + '</label><select id="f-member">' + memberOptions + '</select></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">' + escapeHtml(t('cancel')) + '</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('save')) + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const username = document.getElementById('f-username').value.trim();
    const password = document.getElementById('f-password').value;
    const member_id = document.getElementById('f-member').value || null;
    if (!username) { toast(I18N.lang === 'zh' ? '请输入用户名' : 'Please enter a username', 'error'); return; }
    if (!isEdit && !password) { toast(I18N.lang === 'zh' ? '请输入密码' : 'Please enter a password', 'error'); return; }

    try {
      if (isEdit) {
        const body = { username: username, member_id: member_id, role: 'admin' };
        if (password) body.password = password;
        await API.put('/users/' + existingUser.id, body);
      } else {
        await API.post('/users', { username: username, password: password, member_id: member_id, role: 'admin' });
      }
      toast(I18N.lang === 'zh' ? '已保存' : 'Saved', 'success');
      close();
      loadUsersTable();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
