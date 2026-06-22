// public/js/views/dashboard.js

async function renderDashboard() {
  const [members, meetings, overview] = await Promise.all([
    API.get('/members?type=member&status=active'),
    API.get('/meetings'),
    API.get('/members/dashboard/overview'),
  ]);

  const recent = meetings.slice(0, 5);
  const inProgress = overview.filter(function (m) { return m.pathway_code; }).length;
  const totalCompletions = overview.reduce(function (sum, m) { return sum + (m.total_completed || 0); }, 0);

  const recentRows = recent.length ? recent.map(function (m) {
    return '<tr data-id="' + m.id + '">' +
      '<td>' + fmtDate(m.meeting_date) + '</td>' +
      '<td>' + escapeHtml(m.meeting_no || '\u2014') + '</td>' +
      '<td>' + escapeHtml(m.theme || '\u2014') + '</td>' +
      '<td>' + statusBadge(m.status) + '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:24px;">\u5c1a\u65e0\u4f8b\u4f1a\u8bb0\u5f55</td></tr>';

  const overviewRows = overview.slice(0, 8).map(function (m) {
    const pathwayCell = m.pathway_name
      ? '<span class="badge badge-jade">' + escapeHtml(m.pathway_code) + ' \u00b7 ' + escapeHtml(m.pathway_name) + '</span>'
      : '<span class="muted small">\u672a\u767b\u8bb0</span>';
    return '<tr data-member="' + m.id + '">' +
      '<td>' + progressRing(m.current_level, 5, 32) + '</td>' +
      '<td>' + escapeHtml(m.full_name) + '</td>' +
      '<td>' + pathwayCell + '</td>' +
      '<td>' + (m.current_level ? '\u7ea7\u522b ' + m.current_level : '\u2014') + '</td>' +
      '<td>' + m.total_completed + '</td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">\u603b\u89c8</div><h1>\u6b22\u8fce\u56de\u6765' + (Store.user.memberName ? '\uff0c' + escapeHtml(Store.user.memberName) : '') + '</h1></div>' +
      '<a href="#/meetings/new" class="btn btn-primary"><i class="ti ti-plus"></i> \u65b0\u5efa\u4f8b\u4f1a</a>' +
    '</div>' +
    '<div class="stat-grid">' +
      '<div class="stat-card"><div class="label">\u5728\u7c4d\u4f1a\u5458</div><div class="value">' + members.length + '</div></div>' +
      '<div class="stat-card"><div class="label">\u5df2\u8bb0\u5f55\u4f8b\u4f1a</div><div class="value">' + meetings.length + '</div></div>' +
      '<div class="stat-card"><div class="label">\u6b63\u5728\u4fee\u4e60\u8def\u5f84</div><div class="value">' + inProgress + '</div></div>' +
      '<div class="stat-card"><div class="label">\u7d2f\u8ba1\u5b8c\u6210\u9879\u76ee</div><div class="value">' + totalCompletions + '</div></div>' +
    '</div>' +
    '<div class="card card-pad mt-24">' +
      '<div class="flex justify-between items-center"><h2>\u6700\u8fd1\u4f8b\u4f1a</h2><a href="#/meetings" class="small">\u67e5\u770b\u5168\u90e8 \u2192</a></div>' +
      '<table class="data-table clickable mt-16"><thead><tr><th>\u65e5\u671f</th><th>\u5c4a\u6b21</th><th>\u4e3b\u9898</th><th>\u72b6\u6001</th></tr></thead><tbody>' + recentRows + '</tbody></table>' +
    '</div>' +
    '<div class="card card-pad mt-24">' +
      '<h2>\u4f1a\u5458\u8fdb\u5ea6\u901f\u89c8</h2>' +
      '<table class="data-table clickable mt-16"><thead><tr><th></th><th>\u59d3\u540d</th><th>\u4e3b\u4fee\u8def\u5f84</th><th>\u5f53\u524d\u7ea7\u522b</th><th>\u7d2f\u8ba1\u5b8c\u6210</th></tr></thead><tbody>' + overviewRows + '</tbody></table>' +
      '<div class="mt-16"><a href="#/members" class="small">\u67e5\u770b\u5168\u90e8\u4f1a\u5458 \u2192</a></div>' +
    '</div>';

  renderShell('/dashboard', html);

  document.querySelectorAll('tr[data-id]').forEach(function (tr) {
    tr.addEventListener('click', function () { navigate('/meetings/' + tr.dataset.id); });
  });
  document.querySelectorAll('tr[data-member]').forEach(function (tr) {
    tr.addEventListener('click', function () { navigate('/members/' + tr.dataset.member); });
  });
}

function statusBadge(status) {
  const map = {
    draft: ['badge-gray', '\u8349\u7a3f Draft'],
    published: ['badge-navy', '\u5df2\u53d1\u5e03 Published'],
    completed: ['badge-jade', '\u5df2\u5b8c\u6210 Done'],
  };
  const pair = map[status] || map.draft;
  return '<span class="badge ' + pair[0] + '">' + pair[1] + '</span>';
}
