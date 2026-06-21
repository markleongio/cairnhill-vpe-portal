// public/js/views/shell.js

function navItems() {
  return [
    { path: '/dashboard', icon: 'ti-layout-dashboard', label: t('nav_dashboard') },
    { path: '/meetings', icon: 'ti-calendar-event', label: t('nav_meetings') },
    { path: '/members', icon: 'ti-users', label: t('nav_members') },
    { path: '/exco', icon: 'ti-id-badge-2', label: t('nav_exco') },
    { path: '/resources', icon: 'ti-link', label: t('nav_resources') },
    { path: '/users', icon: 'ti-user-cog', label: t('nav_users') },
    { path: '/masters', icon: 'ti-settings', label: t('nav_masters') },
  ];
}

function renderShell(currentPath, contentHtml) {
  const app = document.getElementById('app');
  const navHtml = navItems().map(function (item) {
    const active = currentPath.indexOf(item.path) === 0 ? 'active' : '';
    return '<a href="#' + item.path + '" class="nav-item ' + active + '" data-nav="' + item.path + '">' +
      '<i class="ti ' + item.icon + '"></i> ' + escapeHtml(item.label) + '</a>';
  }).join('');

  app.innerHTML =
    '<div class="shell">' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="mark">禧</div>' +
          '<div><div class="title">' + escapeHtml(t('brand_title')) + '</div><div class="subtitle">' + escapeHtml(t('brand_subtitle')) + '</div></div>' +
        '</div>' +
        '<nav class="sidebar-nav">' + navHtml + '</nav>' +
        '<div class="sidebar-foot">' +
          '<div class="who"><i class="ti ti-user-circle"></i> ' + escapeHtml((Store.user && Store.user.username) || '') + '</div>' +
          '<button id="lang-toggle-btn" style="margin-bottom:8px;"><i class="ti ti-language"></i> ' + (I18N.lang === 'zh' ? 'English' : '中文') + '</button>' +
          '<button id="logout-btn"><i class="ti ti-logout"></i> ' + escapeHtml(t('sign_out')) + '</button>' +
        '</div>' +
      '</aside>' +
      '<div class="main">' +
        '<div class="topbar no-print">' +
          '<button class="btn btn-icon" id="mobile-nav-toggle" style="display:none"><i class="ti ti-menu-2"></i></button>' +
          '<div class="muted small">' + fmtDate(new Date().toISOString().slice(0,10)) + '</div>' +
          '<div class="flex gap-8"><span class="badge badge-navy">' + ((Store.user && Store.user.role === 'admin') ? t('role_admin') : t('role_exco')) + '</span></div>' +
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

  document.getElementById('lang-toggle-btn').addEventListener('click', function () {
    I18N.toggle();
    handleRoute();
  });
}

function setContent(html) {
  const content = document.getElementById('content');
  if (content) content.innerHTML = html;
}
