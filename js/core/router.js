/* =============================================================================
   Router: chuyển mục tức thì + tải trước (prefetch) khi rê chuột vào thanh bên
   ============================================================================= */
window.PU = window.PU || {};

PU.router = (function () {
  const ui = PU.ui;
  const cfg = PU.config;
  const http = PU.http;
  const $ = id => document.getElementById(id);

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

  // Endpoint mặc định của từng mục để prefetch ngay khi rê chuột lên menu
  const PREFETCH_PATHS = {
    dashboard: () => '/admin/stats',
    pending:   () => `/admin/products/pending-queue?sort=oldest&page=0&size=${cfg.PENDING_PAGE_SIZE || 20}`,
    products:  () => `/admin/products?page=0&size=${cfg.DEFAULT_PAGE_SIZE || 15}`,
    orders:    () => `/admin/orders?page=0&size=${cfg.DEFAULT_PAGE_SIZE || 15}`,
    financial: () => '/admin/financial?page=0&size=10',
    users:     () => `/admin/users?page=0&size=${cfg.DEFAULT_PAGE_SIZE || 15}`,
    reports:   () => `/admin/reports?status=ALL&page=0&size=${cfg.DEFAULT_PAGE_SIZE || 15}`,
    settings:  () => '/admin/settings'
  };

  let current = 'dashboard';
  const loading = {};
  const loadedAt = {};

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

  function reload() {
    http.clearCache();
    invalidate(current);
    load(current);
  }

  function invalidate(...names) {
    if (!names.length) {
      Object.keys(loadedAt).forEach(k => delete loadedAt[k]);
      return;
    }
    names.forEach(n => delete loadedAt[n]);
  }

  function prefetchSection(name) {
    if (!name || name === current || isFresh(name) || !canOpen(name)) return;
    const fn = PREFETCH_PATHS[name];
    if (fn) http.prefetch(fn());
  }

  function bindPrefetch() {
    let hoverTimer = null;
    document.querySelectorAll('.pu-nav__item[data-nav]').forEach(btn => {
      const name = btn.getAttribute('data-nav');
      btn.addEventListener('pointerenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => prefetchSection(name), 65);
      });
      btn.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
      btn.addEventListener('touchstart', () => prefetchSection(name), { passive: true });
    });
  }

  document.addEventListener('DOMContentLoaded', bindPrefetch);

  function currentSection() {
    return current;
  }

  return { go, reload, load, invalidate, prefetchSection, currentSection, SECTIONS };
})();
