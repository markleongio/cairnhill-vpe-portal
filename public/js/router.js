// public/js/router.js

function navigate(path) {
  location.hash = '#' + path;
}

async function handleRoute() {
  const hash = location.hash.replace(/^#/, '') || '/dashboard';

  const printMatch = hash.match(/^\/meetings\/(\d+)\/print$/);

  if (!Store.user) {
    const session = await API.get('/auth/session').catch(function () { return { authenticated: false }; });
    if (session.authenticated) {
      Store.user = session.user;
      await Store.loadReferenceData();
    } else if (hash !== '/login') {
      renderLogin();
      return;
    }
  }

  if (hash === '/login') { renderLogin(); return; }

  try {
    if (hash === '/dashboard') return renderDashboard();
    if (hash === '/members') return renderMembers();
    if (hash === '/meetings') return renderMeetings();
    if (hash === '/meetings/new') return renderMeetingNew();
    if (hash === '/exco') return renderExco();
    if (hash === '/resources') return renderResources();

    let m;
    if ((m = hash.match(/^\/members\/(\d+)$/))) return renderMemberDetail(m[1]);
    if ((m = printMatch)) return renderPrintAgenda(m[1]);
    if ((m = hash.match(/^\/meetings\/(\d+)\/edit$/))) return renderMeetingBuilder(m[1], false);
    if ((m = hash.match(/^\/meetings\/(\d+)$/))) return renderMeetingBuilder(m[1], true);

    navigate('/dashboard');
  } catch (err) {
    if (err.status === 401) {
      Store.user = null;
      navigate('/login');
    } else {
      document.getElementById('app').innerHTML =
        '<div class="empty-state"><i class="ti ti-alert-triangle"></i>出错了：' + escapeHtml(err.message) + '</div>';
    }
  }
}

window.addEventListener('hashchange', handleRoute);
