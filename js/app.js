/* =============================================================================
   Khởi động: gắn các sự kiện dùng chung rồi khôi phục phiên đăng nhập.
   (Mỗi module tự gắn alias PU.<tên> ở cuối file của nó.)
   ============================================================================= */
(function () {
  const ui = PU.ui;
  const $ = id => document.getElementById(id);

  // Form đăng nhập: nhấn Enter hay bấm nút đều "submit" form
  function bindLoginForm() {
    $('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      PU.auth.login();
    });
  }

  // Esc đóng lớp trên cùng trước: hộp thoại → ngăn kéo chi tiết → sidebar
  // (lightbox tự xử lý Esc của riêng nó)
  function bindEscape() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (ui.anyModalOpen()) return ui.closeAllModals();
      PU.pending.closeDrawer();
      ui.closeSidebar();
    });
  }

  // Mobile: bấm ra ngoài sidebar thì đóng sidebar
  function bindSidebarOutsideClick() {
    document.addEventListener('click', e => {
      const sidebar = $('sidebar');
      if (!sidebar.classList.contains('is-open')) return;
      if (sidebar.contains(e.target) || e.target.closest('.pu-burger')) return;
      ui.closeSidebar();
    });
  }

  // Tự làm mới mục đang xem theo chu kỳ (mặc định tắt, xem config.js)
  function startAutoReload() {
    const every = PU.config.REFRESH_INTERVAL_MS;
    if (every > 0) setInterval(PU.router.reload, every);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindLoginForm();
    bindEscape();
    bindSidebarOutsideClick();
    startAutoReload();
    PU.auth.restore();
  });
})();
