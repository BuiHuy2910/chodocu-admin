/* =============================================================================
   Module: Cài đặt hệ thống + thông tin kết nối (1 request duy nhất tới /admin/settings)
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
    $('connApi').textContent = cfg.API_BASE.startsWith('/') && typeof location !== 'undefined'
      ? location.origin + cfg.API_BASE
      : cfg.API_BASE;
    $('connSupabase').textContent = cfg.SUPABASE_URL;

    const box = $('settingsList');
    const cached = http.peek('/admin/settings');
    if (cached) {
      setConnectionStatus('ok');
      box.innerHTML = cached.length
        ? cached.map(settingRow).join('')
        : ui.emptyState('Chưa có cấu hình', '', 'tune');
    } else {
      setConnectionStatus('pending');
      box.innerHTML = ui.skeleton(3);
    }

    try {
      const settings = (await http.get('/admin/settings')) || [];
      setConnectionStatus('ok');
      box.innerHTML = settings.length
        ? settings.map(settingRow).join('')
        : ui.emptyState('Chưa có cấu hình', '', 'tune');
    } catch (e) {
      setConnectionStatus('err');
      if (!cached) box.innerHTML = ui.emptyState('Không tải được cài đặt', e.message, 'error');
    }
  }

  function setConnectionStatus(mode) {
    const status = $('connStatus');
    if (!status) return;
    if (mode === 'pending') {
      status.textContent = 'Đang kiểm tra…';
      status.className = 't-body';
    } else if (mode === 'ok') {
      status.textContent = 'Kết nối OK';
      status.className = 't-body strong text-ok';
    } else {
      status.textContent = 'Không kết nối được';
      status.className = 't-body strong text-danger';
    }
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
      PU.router.invalidate('financial');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, save };
})();

PU.settings = PU.modules.settings;
