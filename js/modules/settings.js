/* =============================================================================
   Module: Cài đặt hệ thống + thông tin kết nối (chỉ ADMIN thấy mục này)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.settings = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const inputIdOf = key => `setting-${key}`;

  async function load() {
    showConnection();
    const box = $('settingsList');
    box.innerHTML = ui.skeleton(3);
    try {
      const settings = (await http.get('/admin/settings')) || [];
      box.innerHTML = settings.length
        ? settings.map(settingRow).join('')
        : ui.emptyState('Chưa có cấu hình', '', 'tune');
    } catch (e) {
      box.innerHTML = ui.emptyState('Không tải được cài đặt', e.message, 'error');
    }
  }

  // Địa chỉ backend đang dùng + thử gọi một API công khai để biết có kết nối được không
  async function showConnection() {
    $('connApi').textContent = cfg.API_BASE;
    $('connSupabase').textContent = cfg.SUPABASE_URL;
    const status = $('connStatus');
    status.textContent = 'Đang kiểm tra…';
    status.className = 't-body';
    const ok = await fetch(`${cfg.API_BASE}/categories`).then(r => r.ok).catch(() => false);
    status.textContent = ok ? 'Kết nối OK' : 'Không kết nối được';
    status.className = `t-body strong ${ok ? 'text-ok' : 'text-danger'}`;
  }

  function settingRow(s) {
    return `
      <div class="pu-setting">
        <div class="pu-setting__main">
          <div class="pu-setting__key">${esc(s.key)}</div>
          <div class="pu-setting__desc">${esc(s.description || '')}</div>
          <div class="pu-setting__meta">Cập nhật: ${esc(ui.fmtDate(s.updatedAt))} · bởi ${esc(s.updatedBy || 'Hệ thống')}</div>
        </div>
        <div class="pu-setting__ctrl">
          <input id="${esc(inputIdOf(s.key))}" class="pu-input" value="${esc(s.value)}" />
          <button class="pu-btn pu-btn--primary pu-btn--sm" data-key="${esc(s.key)}" onclick="PU.settings.save(this.dataset.key)">Lưu</button>
        </div>
      </div>`;
  }

  async function save(key) {
    const value = $(inputIdOf(key)).value.trim();
    if (value === '') return ui.toast('Giá trị không được để trống.', 'warn');
    try {
      await http.put(`/admin/settings/${encodeURIComponent(key)}`, { value });
      ui.toast(`Đã lưu cấu hình "${key}".`, 'ok');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, save };
})();

PU.settings = PU.modules.settings;
