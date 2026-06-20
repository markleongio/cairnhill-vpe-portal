// public/js/views/shell.js

const NAV_ITEMS = [
  { path: '/dashboard', icon: 'ti-layout-dashboard', label: '总览 Dashboard' },
  { path: '/meetings', icon: 'ti-calendar-event', label: '例会记录 Meetings' },
  { path: '/members', icon: 'ti-users', label: '会员进度 Members' },
  { path: '/exco', icon: 'ti-id-badge-2', label: '执委名单 Exco' },
  { path: '/resources', icon: 'ti-link', label: '资源链接 Resources' },
];

function renderShell(currentPath, contentHtml) {
  const app = document.getElementById('app');
  const navHtml = NAV_ITEMS.map(function (item) {
    const active = currentPath.indexOf(item.path) === 0 ? 'active' : '';
    return '<a href="#' + item.path + '" class="nav-item ' + active + '" data-nav="' + item.path + '">' +
      '<i class="ti ' + item.icon + '"></i> ' + item.label + '</a>';
  }).join('');

  app.innerHTML =
    '<div class="shell">' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="mark">禧</div>' +
          '<div><div class="title">经禧华语讲演会</div><div class="subtitle">文教副会长平台</div></div>' +
        '</div>' +
        '<nav class="sidebar-nav">' + navHtml + '</nav>' +
        '<div class="sidebar-foot">' +
          '<div class="who"><i class="ti ti-user-circle"></i> ' + escapeHtml((Store.user && Store.user.username) || '') + '</div>' +
          '<button id="logout-btn"><i class="ti ti-logout"></i> 登出 Sign out</button>' +
        '</div>' +
      '</aside>' +
      '<div class="main">' +
        '<div class="topbar no-print">' +
          '<button class="btn btn-icon" id="mobile-nav-toggle" style="display:none"><i class="ti ti-menu-2"></i></button>' +
          '<div class="muted small">' + fmtDate(new Date().toISOString().slice(0,10)) + '</div>' +
          '<div class="flex gap-8"><span class="badge badge-navy">' + ((Store.user && Store.user.role === 'admin') ? '管理员 Admin' : '执委 Exco') + '</span></div>' +
        '</div>' +
        '<div class="content" id="content"></div>' +
      '</div>' +
    '</div>';

  document.getElementById('content').innerHTML = contentHtml;

  document.getElementById('logout-btn').addEventListener('click', async function () {
    await API.post('/auth/logout');
    Store.user = null;
    navigate('/login');
  });
}

function setContent(html) {
  const content = document.getElementById('content');
  if (content) content.innerHTML = html;
}
