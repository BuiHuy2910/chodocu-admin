/* =============================================================================
   Bootstrap
   ============================================================================= */
(function () {
  const ui = PU.ui;

  function bindGlobals() {
    PU.modules.dashboard = PU.modules.dashboard;
    PU.modules.pending = PU.modules.pending;
    PU.modules.products = PU.modules.products;
    PU.modules.orders = PU.modules.orders;
    PU.modules.financial = PU.modules.financial;
    PU.modules.users = PU.modules.users;
    PU.modules.reports = PU.modules.reports;
    PU.modules.settings = PU.modules.settings;
  }

  function hideAdminOnlyForModerator() {
    // Chỉ ẩn khi chắc chắn là Moderator. Lúc chưa đăng nhập role = '' nên KHÔNG ẩn.
    if (PU.auth.getRole() !== 'MODERATOR') return;
    document.querySelectorAll('.pu-nav__item[data-nav="settings"]').forEach(el => el.classList.add('hidden'));
  }

  function bindEvents() {
    // Enter để đăng nhập
    ['loginEmail', 'loginPassword'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') PU.auth.login(); });
    });

    // ESC đóng modal + sidebar mobile
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ui.closeAllModals();
        ui.closeSidebar();
      }
    });

    // Click ra ngoài sidebar để đóng (mobile)
    document.addEventListener('click', e => {
      const sb = document.getElementById('sidebar');
      if (!sb || !sb.classList.contains('is-open')) return;
      if (sb.contains(e.target)) return;
      if (e.target.closest('.pu-burger')) return;
      ui.closeSidebar();
    });

    // Tự làm mới (tắt mặc định)
    if (PU.config.REFRESH_INTERVAL_MS > 0) {
      setInterval(() => PU.router.reload(), PU.config.REFRESH_INTERVAL_MS);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindGlobals();
    bindEvents();
    PU.app = { afterLogin: hideAdminOnlyForModerator };
    await PU.auth.restore();
    hideAdminOnlyForModerator();
  });
})();
