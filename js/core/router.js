/* =============================================================================
   Router: chuyển section + gọi loader tương ứng
   ============================================================================= */
window.PU = window.PU || {};

PU.router = (function () {
  const ui = PU.ui;

  const SECTIONS = {
    dashboard: ['Tổng quan', 'Bảng điều khiển PassUni'],
    pending:   ['Duyệt bài đăng', 'Hàng chờ phê duyệt từ sinh viên'],
    products:  ['Sản phẩm', 'Toàn bộ sản phẩm trên sàn'],
    orders:    ['Đơn hàng', 'Theo dõi và can thiệp trạng thái đơn'],
    financial: ['Tài chính & phí sàn', 'Doanh thu, bậc phí và bên chịu phí'],
    users:     ['Người dùng', 'Quản lý tài khoản sinh viên'],
    reports:   ['Báo cáo vi phạm', 'Xem xét và xử lý báo cáo'],
    settings:  ['Cài đặt hệ thống', 'Cấu hình toàn hệ thống']
  };

  let current = 'dashboard';
  let loading = {};

  function loader(name) {
    const mod = (PU.modules || {})[name];
    return mod && typeof mod.load === 'function' ? mod.load : null;
  }

  function paintNav(name) {
    document.querySelectorAll('.pu-nav__item[data-nav]').forEach(el => {
      el.classList.toggle('is-active', el.getAttribute('data-nav') === name);
    });
  }

  function go(name, opts) {
    if (!SECTIONS[name]) name = 'dashboard';
    const options = opts || {};

    current = name;
    document.querySelectorAll('.pu-section').forEach(s => s.classList.remove('is-active'));
    const target = document.getElementById('section-' + name);
    if (target) target.classList.add('is-active');

    const [title, sub] = SECTIONS[name];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = sub;
    paintNav(name);
    ui.closeSidebar();

    if (options.force || !loading[name]) load(name);
  }

  async function load(name) {
    const fn = loader(name);
    if (!fn) return;
    loading[name] = true;
    try {
      await fn();
    } catch (e) {
      ui.toast(e.message || 'Không tải được dữ liệu.', 'error');
    } finally {
      loading[name] = false;
      document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString('vi-VN');
    }
  }

  function reload() {
    load(current);
  }

  function currentSection() { return current; }

  return { go, reload, load, currentSection, SECTIONS };
})();
