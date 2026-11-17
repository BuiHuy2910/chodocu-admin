/* =============================================================================
   Router: chuyển giữa các mục (section) + nhớ ngắn hạn để tránh gọi lại API thừa
   ============================================================================= */
window.PU = window.PU || {};

PU.router = (function () {
  const ui = PU.ui;
  const cfg = PU.config;
  const $ = id => document.getElementById(id);

  // tên mục → [tiêu đề, mô tả] hiển thị trên thanh trên cùng
  const SECTIONS = {
    dashboard: ['Tổng quan', 'Bảng điều khiển Chợ Đồ Cũ'],
    pending:   ['Duyệt bài đăng', 'Hàng chờ phê duyệt từ sinh viên'],
    products:  ['Sản phẩm', 'Toàn bộ sản phẩm trên sàn'],
    orders:    ['Đơn hàng', 'Theo dõi và can thiệp trạng thái đơn'],
    financial: ['Tài chính & phí sàn', 'Doanh thu, bậc phí và bên chịu phí'],
    users:     ['Người dùng', 'Quản lý tài khoản sinh viên'],
    reports:   ['Báo cáo vi phạm', 'Xem xét và xử lý báo cáo'],
    settings:  ['Cài đặt hệ thống', 'Cấu hình toàn hệ thống']
  };

  let current = 'dashboard';
  const loading = {};
  const loadedAt = {}; // tên mục → thời điểm tải thành công gần nhất (ms)

  // Mục gắn data-admin-only thì chỉ ADMIN được mở
  function canOpen(name) {
    if (!SECTIONS[name]) return false;
    const section = $('section-' + name);
    const adminOnly = section && section.hasAttribute('data-admin-only');
    return !adminOnly || PU.auth.isAdmin();
  }

  function showSection(name) {
    document.querySelectorAll('.pu-section').forEach(s => s.classList.toggle('is-active', s.id === 'section-' + name));
    document.querySelectorAll('.pu-nav__item[data-nav]').forEach(el => {
      el.classList.toggle('is-active', el.getAttribute('data-nav') === name);
    });
    const [title, subtitle] = SECTIONS[name];
    $('pageTitle').textContent = title;
    $('pageSubtitle').textContent = subtitle;
  }

  function isFresh(name) {
    const ttl = cfg.SECTION_CACHE_TTL_MS || 0;
    return ttl > 0 && loadedAt[name] && (Date.now() - loadedAt[name] < ttl);
  }

  function go(name, options) {
    const target = canOpen(name) ? name : 'dashboard';
    current = target;
    showSection(target);
    ui.closeSidebar();
    const force = !!(options && options.force);
    if ((force || !isFresh(target)) && !loading[target]) {
      load(target);
    }
  }

  async function load(name) {
    const module = (PU.modules || {})[name];
    if (!module || typeof module.load !== 'function') return;
    loading[name] = true;
    try {
      await module.load();
      loadedAt[name] = Date.now();
    } catch (e) {
      if (!e || !e.aborted) ui.toast((e && e.message) || 'Không tải được dữ liệu.', 'error');
    } finally {
      loading[name] = false;
      $('lastRefresh').textContent = new Date().toLocaleTimeString('vi-VN');
    }
  }

  // Nút "Làm mới" luôn tải dữ liệu mới từ server
  function reload() {
    invalidate(current);
    load(current);
  }

  // Đánh dấu các mục cần tải lại sau khi dữ liệu thay đổi
  function invalidate(...names) {
    if (!names.length) {
      Object.keys(loadedAt).forEach(k => delete loadedAt[k]);
      return;
    }
    names.forEach(n => delete loadedAt[n]);
  }

  function currentSection() {
    return current;
  }

  return { go, reload, load, invalidate, currentSection, SECTIONS };
})();
