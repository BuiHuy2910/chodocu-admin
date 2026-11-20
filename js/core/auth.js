/* =============================================================================
   Auth: đăng nhập, đăng xuất, khôi phục phiên song song (0ms nháy màn đăng nhập)
   ============================================================================= */
window.PU = window.PU || {};

PU.auth = (function () {
  const cfg = PU.config;
  const http = PU.http;
  const ui = PU.ui;
  const $ = id => document.getElementById(id);
  const USER_KEY = cfg.USER_KEY || 'chodocu_admin_user';

  let currentUser = null;

  function saveCachedUser(user) {
    if (!user) {
      localStorage.removeItem(USER_KEY);
      return;
    }
    try {
      localStorage.setItem(USER_KEY, JSON.stringify({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role
      }));
    } catch (_) {}
  }

  function readCachedUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /* ------------------------------- GIAO DIỆN -------------------------------- */
  function showApp() {
    document.documentElement.classList.add('has-session');
    $('loginScreen').classList.add('hidden');
    $('app').classList.add('is-active');
  }

  function showLogin() {
    document.documentElement.classList.remove('has-session');
    $('app').classList.remove('is-active');
    $('loginScreen').classList.remove('hidden');
    setError('');
  }

  function setError(message) {
    const el = $('loginError');
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function setLoginBusy(busy) {
    const button = $('loginBtn');
    button.disabled = busy;
    button.innerHTML = busy
      ? '<span class="material-symbols-outlined spin">progress_activity</span> Đang đăng nhập…'
      : '<span class="material-symbols-outlined">login</span> Đăng nhập';
  }

  function paintUser(user, role) {
    currentUser = user || null;
    const name = (user && (user.fullName || user.email)) || 'Quản trị viên';
    $('sidebarName').textContent = name;
    $('sidebarRole').textContent = role || '';
    $('sidebarAvatar').innerHTML = ui.avatar(name, user && user.avatarUrl, 'md');
  }

  function applyRoleVisibility(role) {
    const hide = role === 'MODERATOR';
    document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.toggle('hidden', hide));
  }

  function assertAllowed(role) {
    if (!cfg.ALLOWED_ROLES.includes(role)) {
      throw new Error('Tài khoản này không có quyền vào trang quản trị (cần ADMIN hoặc MODERATOR).');
    }
  }

  function startSession(user, role, skipNavigate) {
    http.setRole(role);
    saveCachedUser(user);
    paintUser(user, role);
    applyRoleVisibility(role);
    showApp();
    if (!skipNavigate) PU.router.go('dashboard', { force: true });
  }

  /* ------------------------------- ĐĂNG NHẬP -------------------------------- */
  async function login() {
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;
    if (!email) return setError('Vui lòng nhập email quản trị.');
    if (!password) return setError('Vui lòng nhập mật khẩu.');

    setError('');
    setLoginBusy(true);
    try {
      const payload = (await http.raw('/auth/login', 'POST', { email, password })) || {};
      const token = payload.accessToken || payload.token;
      const user = payload.user || payload;
      if (!token) throw new Error('Máy chủ không trả về token đăng nhập.');
      assertAllowed(user.role);

      http.setToken(token);
      startSession(user, user.role, false);
      ui.toast(`Đăng nhập thành công — xin chào ${user.fullName || email}.`, 'ok');
    } catch (e) {
      setError(e.message || 'Đăng nhập thất bại.');
    } finally {
      setLoginBusy(false);
    }
  }

  function togglePassword(forceHide) {
    const input = $('loginPassword');
    const show = !forceHide && input.type === 'password';
    input.type = show ? 'text' : 'password';
    const button = $('loginPasswordToggle');
    button.title = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
    button.setAttribute('aria-label', button.title);
    button.querySelector('.material-symbols-outlined').textContent = show ? 'visibility_off' : 'visibility';
  }

  /* ------------------------------- ĐĂNG XUẤT -------------------------------- */
  function logout(silent) {
    http.setToken('');
    http.setRole('');
    http.clearCache();
    saveCachedUser(null);
    currentUser = null;
    if (PU.router && PU.router.invalidate) PU.router.invalidate();
    applyRoleVisibility('');
    $('loginPassword').value = '';
    togglePassword(true);
    showLogin();
    if (!silent) ui.toast('Đã đăng xuất.', 'info');
  }

  /* --------------------------- KHÔI PHỤC PHIÊN ------------------------------ */
  // Mở khung ứng dụng + tải Dashboard SONG SONG với /auth/me thay vì chờ nối tiếp
  async function restore() {
    if (!http.getToken()) return showLogin();

    const cachedRole = http.getRole();
    const cachedUser = readCachedUser();

    if (cfg.ALLOWED_ROLES.includes(cachedRole)) {
      paintUser(cachedUser, cachedRole);
      applyRoleVisibility(cachedRole);
      showApp();
      PU.router.go('dashboard', { force: true });

      try {
        const freshUser = (await http.get('/auth/me')) || {};
        const freshRole = freshUser.role || cachedRole;
        assertAllowed(freshRole);
        const roleChanged = freshRole !== cachedRole;
        startSession(freshUser, freshRole, !roleChanged);
      } catch (e) {
        if (e && (e.status === 401 || e.status === 403)) {
          logout(true);
          setError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
        }
      }
      return;
    }

    // Chưa có role lưu sẵn → kiểm tra /auth/me trước
    try {
      const user = (await http.get('/auth/me')) || {};
      const role = user.role || http.getRole();
      assertAllowed(role);
      startSession(user, role, false);
    } catch (e) {
      logout(true);
      setError(e.status === 401 ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' : e.message);
    }
  }

  return {
    login,
    logout,
    restore,
    togglePassword,
    getUser: () => currentUser,
    getRole: () => http.getRole(),
    isAdmin: () => http.getRole() === 'ADMIN'
  };
})();
