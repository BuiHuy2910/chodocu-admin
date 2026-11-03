/* =============================================================================
   Module: Cài đặt hệ thống
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.settings = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;

  function settingRow(s) {
    const id = 'setting_' + s.key;
    return '' +
      '<div class="pu-setting">' +
        '<div class="pu-setting__main">' +
          '<div class="pu-setting__key">' + ui.esc(s.key) + '</div>' +
          '<div class="pu-setting__desc">' + ui.esc(s.description || '') + '</div>' +
          '<div class="pu-setting__meta">Cập nhật: ' + ui.esc(s.updatedAt ? ui.fmtDate(s.updatedAt) : '—') +
            ' · bởi ' + ui.esc(s.updatedBy || 'Hệ thống') + '</div>' +
        '</div>' +
        '<div class="pu-setting__ctrl">' +
          '<input id="' + id + '" class="pu-input" value="' + ui.esc(s.value) + '" />' +
          '<button class="pu-btn pu-btn--primary pu-btn--sm" onclick="PU.settings.save(\'' + ui.esc(s.key) + '\',\'' + id + '\')">Lưu</button>' +
        '</div>' +
      '</div>';
  }

  async function load() {
    const box = document.getElementById('settingsList');
    box.innerHTML = '<div class="pu-skeleton"><span style="width:60%"></span><span style="width:85%"></span><span style="width:40%"></span></div>';

    // Thông tin kết nối
    const apiEl = document.getElementById('connApi');
    const sbEl = document.getElementById('connSupabase');
    if (apiEl) apiEl.textContent = cfg.API_BASE;
    if (sbEl) sbEl.textContent = cfg.SUPABASE_URL;

    const statusEl = document.getElementById('connStatus');
    try {
      const ok = await fetch(cfg.API_BASE + '/categories').then(r => r.ok).catch(() => false);
      if (statusEl) {
        statusEl.textContent = ok ? 'Kết nối OK' : 'Không kết nối được';
        statusEl.style.color = ok ? 'var(--emerald)' : 'var(--danger)';
        statusEl.style.fontWeight = '600';
      }
    } catch (_) {
      if (statusEl) { statusEl.textContent = 'Không kết nối được'; statusEl.style.color = 'var(--danger)'; }
    }

    try {
      const settings = await http.get('/admin/settings');
      if (!settings || settings.length === 0) {
        box.innerHTML = ui.emptyState('Chưa có cấu hình', '', 'tune');
        return;
      }
      box.innerHTML = settings.map(settingRow).join('');
    } catch (e) {
      box.innerHTML = ui.emptyState('Không tải được cài đặt', e.message, 'error');
    }
  }

  async function save(key, inputId) {
    const el = document.getElementById(inputId);
    const value = (el.value || '').trim();
    if (value === '') { ui.toast('Giá trị không được để trống.', 'warn'); return; }
    try {
      await http.put('/admin/settings/' + key, { value });
      ui.toast('Đã lưu cấu hình "' + key + '".', 'ok');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, save };
})();
