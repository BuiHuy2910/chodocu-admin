/* =============================================================================
   Auth: đăng nhập / đăng xuất / khôi phục phiên
   ============================================================================= */
window.PU = window.PU || {};

PU.auth = (function () {
  const cfg = PU.config;
  const http = PU.http;
  const ui = PU.ui;

  let currentUser = null;

  function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.add('is-active');
  }

  function showLogin() {
    document.getElementById('app').classList.remove('is-active');
    document.getElementById('loginScreen').classList.remove('hidden');
    const err = document.getElementById('loginError');
    if (err) { err.classList.add('hidden'); err.textContent = ''; }
  }

  function paintUser(user, emailFallback, roleFallback) {
    currentUser = user || currentUser;
    const name = (user && user.fullName) || emailFallback || 'Admin';
    const role = (user && user.role) || roleFallback || '';
    const avatar = (user && user.avatarUrl) || cfg.FALLBACK_AVATAR;

    const nameEl = document.getElementById('sidebarName');
    const roleEl = document.getElementById('sidebarRole');
    const avEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
    if (avEl) avEl.src = avatar;
  }

  function setError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  async function login() {
    const email = (document.getElementById('loginEmail').value || '').trim();
    const password = document.getElementById('loginPassword').value || '';
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    errEl.classList.add('hidden');
    if (!email) return setError('Vui lòng nhập email quản trị.');
    if (!password) return setError('Vui lòng nhập mật khẩu.');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spin">progress_activity</span> Đang đăng nhập…';

    try {
      const payload = await http.raw('/auth/login', 'POST', { email, password });
      const token = payload && (payload.accessToken || payload.token);
      const user = (payload && payload.user) || payload || {};
      const role = user.role || '';

      if (!token) throw new Error('Máy chủ không trả về token đăng nhập.');
      if (cfg.ALLOWED_ROLES.indexOf(role) === -1) {
        throw new Error('Tài khoản này không có quyền truy cập trang quản trị (cần ADMIN hoặc MODERATOR).');
      }

      http.setToken(token);
      http.setRole(role);
      paintUser(user, email, role);

      showApp();
      PU.router.go('dashboard', { force: true });
      if (typeof PU.app !== 'undefined' && PU.app.afterLogin) PU.app.afterLogin();
      ui.toast('Đăng nhập thành công — xin chào ' + (user.fullName || email) + '.', 'ok');
    } catch (e) {
      setError(e.message || 'Đăng nhập thất bại.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined">login</span> Đăng nhập';
    }
  }

  function logout(silent) {
    http.setToken('');
    http.setRole('');
    currentUser = null;
    showLogin();
    if (!silent) ui.toast('Đã đăng xuất.', 'info');
  }

  async function restore() {
    const token = http.getToken();
    if (!token) { showLogin(); return; }
    try {
      const user = await http.raw('/auth/profile', 'GET');
      const u = user && user.data ? user.data : user;
      const role = (u && u.role) || http.getRole();
      if (cfg.ALLOWED_ROLES.indexOf(role) === -1) { logout(true); return; }
      http.setRole(role);
      paintUser(u, null, role);
      showApp();
      PU.router.go('dashboard', { force: true });
    } catch (e) {
      logout(true);
    }
  }

  return {
    login, logout, restore,
    getUser: () => currentUser,
    getRole: () => http.getRole(),
    isAdmin: () => http.getRole() === 'ADMIN'
  };
})();
