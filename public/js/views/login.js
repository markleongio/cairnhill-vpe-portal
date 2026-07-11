// public/js/views/login.js

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="flex justify-between items-center" style="margin-bottom:8px;">
          <div></div>
          <button id="login-lang-toggle" class="btn btn-sm">${I18N.lang === 'zh' ? 'English' : '中文'}</button>
        </div>
        <div class="login-mark">禧</div>
        <h1 class="login-title">文教副会长管理平台</h1>
        <p class="login-sub">经禧华语讲演会 · VP-Education Portal</p>
        <div id="login-error" style="display:none" class="login-error"></div>
        <form id="login-form">
          <div class="field">
            <label>用户名 Username</label>
            <input type="text" id="login-username" autocomplete="username" required>
          </div>
          <div class="field">
            <label>密码 Password</label>
            <input type="password" id="login-password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary w-full" style="justify-content:center;padding:10px;">
            <i class="ti ti-login"></i> 登录 Sign in
          </button>
        </form>
        <div class="login-hint">
          仅限经禧华语讲演会执委使用。如忘记密码，请联系系统管理员（文教副会长）重置。
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-lang-toggle').addEventListener('click', function () {
    I18N.toggle();
    renderLogin();
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error');
    errBox.style.display = 'none';
    try {
      const res = await API.post('/auth/login', { username, password });
      Store.user = res.user;
      await Store.loadReferenceData();
      navigate('/dashboard');
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  });
}
