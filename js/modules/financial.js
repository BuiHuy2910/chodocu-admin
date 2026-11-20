/* =============================================================================
   Module: Tài chính & phí sàn — 1 request gộp (summary + bậc phí + mô phỏng + trang GD)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.financial = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const NUMERIC_KEYS = ['min_platform_fee', 'max_platform_fee', 'platform_fee_rate'];
  const PREVIEW_KEYS = ['50k', '500k', '2m'];

  let financial = null;
  let tiers = [];
  let txPage = 0;
  let txSize = 10;

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  /* --------------------------------- TẢI DỮ LIỆU ------------------------------ */
  function applyFinancial(fin) {
    if (!fin) return;
    financial = fin;
    showSummary(fin);
    fillSettingInputs(fin);
    showFeeStatus(fin.feeEnabled !== false);
    renderPreviews(fin.feePreviews || {});
    renderTiers(fin.feeTiers || []);
    renderTransactionsPage(fin.transactionsPage || {
      content: fin.recentTransactions || [],
      pageNumber: txPage,
      pageSize: txSize,
      totalElements: (fin.recentTransactions || []).length,
      totalPages: 1
    });
  }

  async function load() {
    const path = '/admin/financial' + http.query({ page: txPage, size: txSize });
    const cached = http.peek(path);
    if (cached) applyFinancial(cached);

    try {
      applyFinancial(await http.get(path));
    } catch (e) {
      if (!cached) ui.toast(`Không tải được dữ liệu tài chính: ${e.message}`, 'error');
    }
  }

  async function loadTransactionsOnly() {
    $('transactionBody').innerHTML = ui.skeletonRows(9, 4);
    try {
      const pageData = await http.get('/admin/transactions' + http.query({ page: txPage, size: txSize }));
      renderTransactionsPage(pageData);
    } catch (e) {
      $('transactionBody').innerHTML = ui.emptyRow(9, 'Không tải được giao dịch', e.message);
      ui.renderPager('transactionsPager', null);
    }
  }

  function showSummary(fin) {
    setText('fin-totalFee', ui.fmt(fin.totalPlatformFees));
    setText('fin-totalValue', ui.fmt(fin.totalTransactionValue));
    setText('fin-totalCompleted', `${ui.fmtNum(fin.totalCompletedOrders)} đơn`);
    setText('curFeeRate', ui.fmtPct(fin.currentFeeRate || 0));
    setText('curMinFee', ui.fmt(fin.minFee));
    setText('curMaxFee', ui.fmt(fin.maxFee));
  }

  function fillSettingInputs(fin) {
    $('feeRate').value = (Number(fin.currentFeeRate || 0) * 100).toFixed(1);
    $('minFee').value = fin.minFee != null ? fin.minFee : '';
    $('maxFee').value = fin.maxFee != null ? fin.maxFee : '';
    if (fin.feePayer) $('feePayer').value = fin.feePayer;
  }

  function showFeeStatus(enabled) {
    const badge = $('feeStatusBadge');
    badge.textContent = enabled ? 'Đang thu phí' : 'Miễn phí sàn';
    badge.className = `pu-badge ${enabled ? 'pu-badge--ok' : 'pu-badge--neutral'}`;
  }

  function renderPreviews(previews) {
    for (const key of PREVIEW_KEYS) {
      const item = previews[key];
      setText(`preview${key}`, item ? ui.fmt(item.platformFeeAmount) : '—');
      setText(`preview${key}Seller`, item ? ui.fmt(item.sellerReceiveAmount) : '—');
    }
  }

  function renderTransactionsPage(pageData) {
    const list = (pageData && pageData.content) || [];
    $('transactionBody').innerHTML = list.length
      ? list.map(transactionRow).join('')
      : ui.emptyRow(9, 'Chưa có giao dịch', 'Giao dịch được tạo khi một đơn chuyển sang Hoàn thành.');

    ui.renderPager('transactionsPager', pageData, {
      unit: 'giao dịch',
      sizes: [10, 20, 50],
      onPage: next => { txPage = next; loadTransactionsOnly(); },
      onSize: nextSize => { txSize = nextSize; txPage = 0; loadTransactionsOnly(); }
    });
  }

  function transactionRow(t) {
    return `
      <tr>
        <td class="mono t-caption">#${esc(t.id)}</td>
        <td class="t-body pu-cell-wide truncate">${esc(t.productTitle || '—')}</td>
        <td class="t-body">${esc(t.buyerName || '—')}</td>
        <td class="t-body">${esc(t.sellerName || '—')}</td>
        <td class="is-right strong">${ui.fmt(t.transactionAmount)}</td>
        <td class="is-right t-caption">${ui.fmtPct(t.platformFeeRate)}</td>
        <td class="is-right text-warn strong">${ui.fmt(t.platformFeeAmount)}</td>
        <td class="is-right text-ok strong">${ui.fmt(t.sellerReceiveAmount)}</td>
        <td class="t-caption">${ui.fmtDate(t.createdAt)}</td>
      </tr>`;
  }

  /* ---------------------------------- BẬC PHÍ --------------------------------- */
  function renderTiers(list) {
    tiers = list || [];
    $('feeTiersBody').innerHTML = tiers.length
      ? tiers.map(tierRow).join('')
      : ui.emptyRow(7, 'Chưa có bậc phí', 'Hệ thống đang dùng tỷ lệ cơ bản cho mọi đơn.');
  }

  async function loadTiers() {
    const body = $('feeTiersBody');
    body.innerHTML = ui.skeletonRows(7, 3);
    try {
      renderTiers(await http.get('/admin/fee-tiers'));
    } catch (e) {
      body.innerHTML = ui.emptyRow(7, 'Không tải được bậc phí', e.message);
    }
  }

  function tierRow(t) {
    const id = Number(t.id);
    const status = t.active
      ? '<span class="pu-badge pu-badge--ok">Đang áp dụng</span>'
      : '<span class="pu-badge pu-badge--neutral">Đã tắt</span>';
    const disable = t.active
      ? `<button class="pu-btn pu-btn--danger pu-btn--icon" title="Tắt bậc" onclick="PU.financial.disableTier(${id})">
           <span class="material-symbols-outlined">block</span>
         </button>`
      : '';
    return `
      <tr>
        <td class="t-body strong">${esc(t.name)}</td>
        <td class="is-right t-body">${ui.fmt(t.minAmount)}</td>
        <td class="is-right t-body">${t.maxAmount != null ? ui.fmt(t.maxAmount) : '∞'}</td>
        <td class="is-right text-warn strong">${ui.fmtPct(t.feeRate)}</td>
        <td class="is-right t-body">${t.priority != null ? t.priority : 0}</td>
        <td>${status}</td>
        <td class="is-center">
          <div class="pu-row-actions">
            <button class="pu-btn pu-btn--ghost pu-btn--icon" title="Sửa" onclick="PU.financial.openTier(${id})">
              <span class="material-symbols-outlined">edit</span>
            </button>
            ${disable}
          </div>
        </td>
      </tr>`;
  }

  function openTier(id) {
    const t = id ? tiers.find(x => x.id === id) : null;
    $('tierId').value = t ? t.id : '';
    $('tierName').value = t ? t.name : '';
    $('tierMin').value = t ? t.minAmount : 0;
    $('tierMax').value = t && t.maxAmount != null ? t.maxAmount : '';
    $('tierRate').value = t ? Number(t.feeRate) * 100 : 3;
    $('tierPriority').value = t && t.priority != null ? t.priority : 10;
    ui.openModal('tierModal');
  }

  function readTierForm() {
    const max = $('tierMax').value;
    return {
      name: $('tierName').value.trim(),
      minAmount: Number($('tierMin').value || 0),
      maxAmount: max === '' ? null : Number(max),
      feeRate: Number($('tierRate').value || 0) / 100,
      priority: parseInt($('tierPriority').value || '0', 10),
      active: true
    };
  }

  async function saveTier() {
    const id = $('tierId').value;
    const tier = readTierForm();
    if (!tier.name) return ui.toast('Vui lòng nhập tên bậc phí.', 'warn');
    if (tier.maxAmount != null && tier.maxAmount < tier.minAmount) {
      return ui.toast('"Đến" phải lớn hơn hoặc bằng "Từ".', 'warn');
    }
    try {
      if (id) await http.put(`/admin/fee-tiers/${id}`, tier);
      else await http.post('/admin/fee-tiers', tier);
      ui.closeModal('tierModal');
      ui.toast('Đã lưu bậc phí.', 'ok');
      PU.router.invalidate('settings');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  function disableTier(id) {
    ui.confirmDialog('Tắt bậc phí?', 'Bậc phí không áp dụng cho đơn mới nhưng vẫn được giữ lại để đối chiếu lịch sử.', async () => {
      try {
        await http.del(`/admin/fee-tiers/${id}`);
        ui.toast('Đã tắt bậc phí.', 'ok');
        load();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    }, { okLabel: 'Tắt bậc phí' });
  }

  /* --------------------------------- CÀI ĐẶT PHÍ ------------------------------ */
  function saveSetting(key, inputId) {
    const value = $(inputId).value.trim();
    if (value === '') return ui.toast('Giá trị không được để trống.', 'warn');
    if (NUMERIC_KEYS.includes(key) && Number.isNaN(Number(value))) return ui.toast('Giá trị phải là số.', 'warn');
    putSetting(key, value);
  }

  function saveRate() {
    const percent = Number($('feeRate').value);
    if (Number.isNaN(percent) || percent < 0 || percent > 30) return ui.toast('Tỷ lệ phải trong khoảng 0–30%.', 'warn');
    putSetting('platform_fee_rate', String(percent / 100));
  }

  function toggleFee() {
    const enable = !(financial && financial.feeEnabled !== false);
    putSetting('fee_enabled', String(enable), enable ? 'Đã bật thu phí sàn.' : 'Đã tắt thu phí — miễn phí sàn.');
  }

  async function putSetting(key, value, successMessage) {
    try {
      await http.put(`/admin/settings/${key}`, { value });
      ui.toast(successMessage || 'Đã cập nhật cài đặt.', 'ok');
      PU.router.invalidate('settings');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, loadTiers, openTier, saveTier, disableTier, saveSetting, saveRate, toggleFee };
})();

PU.financial = PU.modules.financial;
