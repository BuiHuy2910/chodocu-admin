/* =============================================================================
   Auth: đăng nhập, đăng xuất, khôi phục phiên và ẩn/hiện mục theo vai trò
   ============================================================================= */
window.PU = window.PU || {};

PU.auth = (function () {
  const cfg = PU.config;
  const http = PU.http;
  const ui = PU.ui;
  const $ = id => document.getElementById(id);

  let currentUser = null;

  /* ------------------------------- GIAO DIỆN -------------------------------- */
  function showApp() {
    $('loginScreen').classList.add('hidden');
    $('app').classList.add('is-active');
  }

  function showLogin() {
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

  // Tên, vai trò và avatar chữ cái (phủ ảnh thật nếu người dùng đã tải lên)
  function paintUser(user, role) {
    currentUser = user || null;
    const name = (user && (user.fullName || user.email)) || 'Quản trị viên';
    $('sidebarName').textContent = name;
    $('sidebarRole').textContent = role || '';
    $('sidebarAvatar').innerHTML = ui.avatar(name, user && user.avatarUrl, 'md');
  }

  // Moderator không thấy các phần tử gắn thuộc tính data-admin-only
  // (Đơn hàng, Tài chính, Người dùng, Cài đặt). Đăng xuất thì hiện lại tất cả.
  function applyRoleVisibility(role) {
    const hide = role === 'MODERATOR';
    document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.toggle('hidden', hide));
  }

  function assertAllowed(role) {
    if (!cfg.ALLOWED_ROLES.includes(role)) {
      throw new Error('Tài khoản này không có quyền vào trang quản trị (cần ADMIN hoặc MODERATOR).');
    }
  }

  // Dựng giao diện sau khi đã xác thực xong
  function startSession(user, role) {
    http.setRole(role);
    paintUser(user, role);
    applyRoleVisibility(role);
    showApp();
    PU.router.go('dashboard', { force: true });
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
      startSession(user, user.role);
      ui.toast(`Đăng nhập thành công — xin chào ${user.fullName || email}.`, 'ok');
    } catch (e) {
      setError(e.message || 'Đăng nhập thất bại.');
    } finally {
      setLoginBusy(false);
    }
  }

  // Nút con mắt: hiện / ẩn mật khẩu đang gõ
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
    currentUser = null;
    if (PU.router && PU.router.invalidate) PU.router.invalidate();
    applyRoleVisibility('');
    $('loginPassword').value = '';   // không để lại mật khẩu trên màn hình đăng nhập
    togglePassword(true);
    showLogin();
    if (!silent) ui.toast('Đã đăng xuất.', 'info');
  }

  /* --------------------------- KHÔI PHỤC PHIÊN ------------------------------ */
  // Tải lại trang khi còn token → hỏi GET /auth/me xem token còn hợp lệ không
  async function restore() {
    if (!http.getToken()) return showLogin();
    try {
      const user = (await http.get('/auth/me')) || {};
      const role = user.role || http.getRole();
      assertAllowed(role);
      startSession(user, role);
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
