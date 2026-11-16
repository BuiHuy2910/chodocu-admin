/* =============================================================================
   Router: chuyển giữa các mục (section) và gọi hàm load() của module tương ứng
   ============================================================================= */
window.PU = window.PU || {};

PU.router = (function () {
  const ui = PU.ui;
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

  function go(name, options) {
    const target = canOpen(name) ? name : 'dashboard';
    current = target;
    showSection(target);
    ui.closeSidebar();
    if ((options && options.force) || !loading[target]) load(target);
  }

  async function load(name) {
    const module = (PU.modules || {})[name];
    if (!module || typeof module.load !== 'function') return;
    loading[name] = true;
    try {
      await module.load();
    } catch (e) {
      ui.toast(e.message || 'Không tải được dữ liệu.', 'error');
    } finally {
      loading[name] = false;
      $('lastRefresh').textContent = new Date().toLocaleTimeString('vi-VN');
    }
  }

  function reload() {
    load(current);
  }

  function currentSection() {
    return current;
  }

  return { go, reload, load, currentSection, SECTIONS };
})();
