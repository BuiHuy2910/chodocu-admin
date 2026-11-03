/* =============================================================================
   Module: Tài chính & phí sàn (cấu hình, bậc phí, giao dịch)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.financial = (function () {
  const http = PU.http;
  const ui = PU.ui;

  let financial = null;
  let tiers = [];

  /* --------------------------- TIERS --------------------------- */
  function tierRow(t) {
    return '' +
      '<tr>' +
        '<td class="t-body strong">' + ui.esc(t.name) + '</td>' +
        '<td class="is-right t-body">' + ui.fmt(t.minAmount) + '</td>' +
        '<td class="is-right t-body">' + (t.maxAmount != null ? ui.fmt(t.maxAmount) : '∞') + '</td>' +
        '<td class="is-right" style="color:var(--warning);font-weight:600">' + ui.fmtPct(t.feeRate) + '</td>' +
        '<td class="is-right t-body">' + (t.priority != null ? t.priority : 0) + '</td>' +
        '<td>' + (t.active
          ? '<span class="pu-badge pu-badge--ok">Đang áp dụng</span>'
          : '<span class="pu-badge pu-badge--neutral">Đã tắt</span>') + '</td>' +
        '<td class="is-center">' +
          '<div class="pu-row-actions">' +
            '<button class="pu-btn pu-btn--ghost pu-btn--icon" title="Sửa" onclick="PU.financial.openTier(' + t.id + ')">' +
              '<span class="material-symbols-outlined">edit</span></button>' +
            (t.active
              ? '<button class="pu-btn pu-btn--danger pu-btn--icon" title="Tắt bậc" onclick="PU.financial.disableTier(' + t.id + ')">' +
                  '<span class="material-symbols-outlined">block</span></button>'
              : '') +
          '</div>' +
        '</td>' +
      '</tr>';
  }

  async function loadTiers() {
    const tbody = document.getElementById('feeTiersBody');
    tbody.innerHTML = ui.skeletonRows(7, 3);
    try {
      tiers = await http.get('/admin/fee-tiers');
      if (!tiers || tiers.length === 0) {
        tbody.innerHTML = ui.emptyRow(7, 'Chưa có bậc phí', 'Hệ thống đang dùng tỷ lệ cơ bản cho mọi đơn.');
        return;
      }
      tbody.innerHTML = tiers.map(tierRow).join('');
    } catch (e) {
      tbody.innerHTML = ui.emptyRow(7, 'Lỗi tải bậc phí', e.message);
    }
  }

  function openTier(id) {
    const t = id ? tiers.find(x => x.id === id) : null;
    document.getElementById('tierId').value = t ? t.id : '';
    document.getElementById('tierName').value = t ? t.name : '';
    document.getElementById('tierMin').value = t ? t.minAmount : 0;
    document.getElementById('tierMax').value = (t && t.maxAmount != null) ? t.maxAmount : '';
    document.getElementById('tierRate').value = t ? (Number(t.feeRate) * 100) : 3;
    document.getElementById('tierPriority').value = t ? (t.priority != null ? t.priority : 10) : 10;
    ui.openModal('tierModal');
  }

  async function saveTier() {
    const id = document.getElementById('tierId').value;
    const maxRaw = document.getElementById('tierMax').value;
    const body = {
      name: (document.getElementById('tierName').value || '').trim(),
      minAmount: Number(document.getElementById('tierMin').value || 0),
      maxAmount: maxRaw === '' ? null : Number(maxRaw),
      feeRate: Number(document.getElementById('tierRate').value || 0) / 100,
      priority: parseInt(document.getElementById('tierPriority').value || '0', 10),
      active: true
    };

    if (!body.name) { ui.toast('Vui lòng nhập tên bậc phí.', 'warn'); return; }
    if (body.maxAmount != null && body.maxAmount < body.minAmount) {
      ui.toast('"Đến" phải lớn hơn hoặc bằng "Từ".', 'warn'); return;
    }

    try {
      if (id) await http.put('/admin/fee-tiers/' + id, body);
      else await http.post('/admin/fee-tiers', body);
      ui.closeModal('tierModal');
      ui.toast('Đã lưu bậc phí.', 'ok');
      loadTiers();
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  function disableTier(id) {
    ui.confirmDialog('Tắt bậc phí', 'Bậc phí sẽ không áp dụng cho đơn mới nhưng vẫn giữ lại để đối chiếu lịch sử.', async () => {
      try {
        await http.del('/admin/fee-tiers/' + id);
        ui.toast('Đã tắt bậc phí.', 'warn');
        loadTiers();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    });
  }

  /* ------------------------- SETTINGS ------------------------- */
  async function saveSetting(key, inputId) {
    const raw = (document.getElementById(inputId).value || '').trim();
    if (raw === '') { ui.toast('Giá trị không được để trống.', 'warn'); return; }

    // Các khoá số phải là số hợp lệ; fee_payer là chuỗi (SELLER/BUYER/SPLIT)
    const numericKeys = ['min_platform_fee', 'max_platform_fee', 'platform_fee_rate'];
    if (numericKeys.indexOf(key) !== -1 && Number.isNaN(Number(raw))) {
      ui.toast('Giá trị phải là số.', 'warn');
      return;
    }
    await putSetting(key, raw);
  }

  async function saveRate() {
    const pct = Number(document.getElementById('feeRate').value);
    if (Number.isNaN(pct) || pct < 0 || pct > 30) { ui.toast('Tỷ lệ phải trong khoảng 0–30%.', 'warn'); return; }
    await putSetting('platform_fee_rate', (pct / 100).toString());
  }

  async function putSetting(key, value) {
    try {
      await http.put('/admin/settings/' + key, { value });
      ui.toast('Đã cập nhật cài đặt.', 'ok');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  async function toggleFee() {
    const enabled = !(financial && financial.feeEnabled !== false);
    try {
      await http.put('/admin/settings/fee_enabled', { value: enabled ? 'true' : 'false' });
      ui.toast(enabled ? 'Đã bật thu phí sàn.' : 'Đã tắt thu phí — miễn phí sàn.', enabled ? 'ok' : 'warn');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  /* --------------------------- PREVIEW ------------------------- */
  async function refreshPreviews() {
    const samples = [[50000, '50k'], [500000, '500k'], [2000000, '2m']];
    for (const [amount, key] of samples) {
      try {
        const p = await http.get('/admin/fee/preview?amount=' + amount);
        const feeEl = document.getElementById('preview' + key);
        const sellerEl = document.getElementById('preview' + key + 'Seller');
        if (feeEl) feeEl.textContent = ui.fmt(p.platformFeeAmount);
        if (sellerEl) sellerEl.textContent = ui.fmt(p.sellerReceiveAmount);
      } catch (_) { /* backend chưa hỗ trợ thì bỏ qua */ }
    }
  }

  /* ----------------------------- LOAD -------------------------- */
  async function load() {
    try {
      const fin = await http.get('/admin/financial');
      financial = fin;

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('fin-totalFee', ui.fmt(fin.totalPlatformFees));
      set('fin-totalValue', ui.fmt(fin.totalTransactionValue));
      set('fin-totalCompleted', ui.fmtNum(fin.totalCompletedOrders) + ' đơn');

      const rate = Number(fin.currentFeeRate || 0);
      set('curFeeRate', (rate * 100).toFixed(1) + '%');
      set('curMinFee', ui.fmt(fin.minFee));
      set('curMaxFee', ui.fmt(fin.maxFee));

      document.getElementById('feeRate').value = (rate * 100).toFixed(1);
      document.getElementById('minFee').value = fin.minFee != null ? fin.minFee : '';
      document.getElementById('maxFee').value = fin.maxFee != null ? fin.maxFee : '';
      if (fin.feePayer) document.getElementById('feePayer').value = fin.feePayer;

      const enabled = fin.feeEnabled !== false;
      const badge = document.getElementById('feeStatusBadge');
      badge.textContent = enabled ? 'Đang thu phí' : 'Miễn phí sàn';
      badge.className = 'pu-badge ' + (enabled ? 'pu-badge--ok' : 'pu-badge--neutral');

      renderTransactions(fin.recentTransactions || []);
      refreshPreviews();
      loadTiers();
    } catch (e) {
      ui.toast('Lỗi tải dữ liệu tài chính: ' + e.message, 'error');
    }
  }

  function renderTransactions(list) {
    const tbody = document.getElementById('transactionBody');
    if (!list.length) {
      tbody.innerHTML = ui.emptyRow(9, 'Chưa có giao dịch', 'Giao dịch được tạo khi một đơn chuyển sang Hoàn thành.');
      return;
    }
    tbody.innerHTML = list.map(t => '' +
      '<tr>' +
        '<td class="mono t-caption">#' + ui.esc(t.id) + '</td>' +
        '<td class="t-body truncate" style="max-width:200px">' + ui.esc(t.productTitle || '—') + '</td>' +
        '<td class="t-body">' + ui.esc(t.buyerName || '—') + '</td>' +
        '<td class="t-body">' + ui.esc(t.sellerName || '—') + '</td>' +
        '<td class="is-right strong">' + ui.fmt(t.transactionAmount) + '</td>' +
        '<td class="is-right t-caption">' + ui.fmtPct(t.platformFeeRate) + '</td>' +
        '<td class="is-right" style="color:var(--warning);font-weight:600">' + ui.fmt(t.platformFeeAmount) + '</td>' +
        '<td class="is-right" style="color:var(--emerald);font-weight:600">' + ui.fmt(t.sellerReceiveAmount) + '</td>' +
        '<td class="t-caption">' + (t.createdAt ? ui.fmtDate(t.createdAt) : '—') + '</td>' +
      '</tr>').join('');
  }

  return {
    load, loadTiers, openTier, saveTier, disableTier,
    saveSetting, saveRate, toggleFee
  };
})();
