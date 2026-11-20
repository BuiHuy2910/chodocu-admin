/* =============================================================================
   Module: Đơn hàng — phân trang server-side + tìm kiếm debounce + huỷ request cũ
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.orders = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const COLUMNS = 9;
  const CAN_ACCEPT = ['PENDING', 'DISPUTED'];
  const CAN_COMPLETE = ['PENDING', 'ACCEPTED', 'DISPUTED'];
  const FINISHED = ['COMPLETED', 'CANCELLED', 'REJECTED'];

  const ACTION_LABEL = {
    ACCEPTED: 'duyệt đơn',
    COMPLETED: 'hoàn tất đơn',
    CANCELLED: 'huỷ đơn',
    DISPUTED: 'đánh dấu tranh chấp',
    REJECTED: 'từ chối đơn'
  };

  let page = 0;
  let size = cfg.DEFAULT_PAGE_SIZE || 15;
  let aborter = null;

  const debouncedSearch = ui.debounce(() => {
    page = 0;
    load();
  }, 300);

  function onSearch() {
    debouncedSearch();
  }

  function onFilterChange() {
    page = 0;
    load();
  }

  function paintTable(data) {
    const body = $('ordersBody');
    const orders = (data && data.content) || [];
    body.innerHTML = orders.length
      ? orders.map(row).join('')
      : ui.emptyRow(COLUMNS, 'Không có đơn hàng', 'Chưa có đơn nào khớp bộ lọc hiện tại.');

    ui.renderPager('ordersPager', data, {
      unit: 'đơn hàng',
      onPage: next => { page = next; load(); },
      onSize: nextSize => { size = nextSize; page = 0; load(); }
    });
  }

  async function load() {
    if (aborter) aborter.abort();
    aborter = new AbortController();

    const body = $('ordersBody');
    const status = $('orderStatusFilter').value;
    const keyword = ($('orderSearch') && $('orderSearch').value.trim()) || '';
    const path = '/admin/orders' + http.query({ status, keyword, page, size });

    const cached = http.peek(path);
    if (cached) paintTable(cached);
    else body.innerHTML = ui.skeletonRows(COLUMNS, 5);

    try {
      const data = await http.get(path, { signal: aborter.signal });
      paintTable(data);
    } catch (e) {
      if (e && e.aborted) return;
      if (!cached) {
        body.innerHTML = ui.emptyRow(COLUMNS, 'Không tải được đơn hàng', e.message);
        ui.renderPager('ordersPager', null);
      }
    }
  }

  function row(o) {
    const title = (o.product && o.product.title) || '—';
    const money = value => (value != null ? ui.fmt(value) : '—');
    return `
      <tr>
        <td class="mono t-caption">${esc(o.orderCode || `#${o.id}`)}</td>
        <td class="t-body pu-cell-wide truncate" title="${esc(title)}">${esc(title)}</td>
        <td class="t-body">${esc((o.buyer && o.buyer.fullName) || '—')}</td>
        <td class="t-body">${esc((o.seller && o.seller.fullName) || '—')}</td>
        <td class="is-right strong">${ui.fmt(o.offeredPrice)}</td>
        <td class="is-right text-warn strong">${money(o.platformFeeAmount)}</td>
        <td class="is-right text-ok strong">${money(o.finalSellerAmount)}</td>
        <td>${ui.statusBadge(o.status)}</td>
        <td class="is-center">${rowActions(o)}</td>
      </tr>`;
  }

  function rowActions(o) {
    const id = Number(o.id);
    const button = (classes, icon, title, status) => `
      <button class="pu-btn pu-btn--icon ${classes}" title="${title}" onclick="PU.orders.update(${id}, '${status}')">
        <span class="material-symbols-outlined">${icon}</span>
      </button>`;
    const buttons = [];
    if (CAN_ACCEPT.includes(o.status)) buttons.push(button('pu-btn--ghost', 'check_circle', 'Duyệt đơn', 'ACCEPTED'));
    if (CAN_COMPLETE.includes(o.status)) buttons.push(button('pu-btn--success', 'done_all', 'Hoàn tất', 'COMPLETED'));
    if (!FINISHED.includes(o.status)) buttons.push(button('pu-btn--danger', 'cancel', 'Huỷ đơn', 'CANCELLED'));
    return `<div class="pu-row-actions">${buttons.join('')}</div>`;
  }

  function update(id, status) {
    ui.askNote(`Ghi chú khi ${ACTION_LABEL[status] || 'cập nhật đơn'}`, async note => {
      try {
        await http.put(`/admin/orders/${id}/status`, { status, note: note || null });
        ui.toast('Đã cập nhật trạng thái đơn hàng.', 'ok');
        PU.router.invalidate('dashboard', 'products', 'financial');
        load();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    });
  }

  return { load, onSearch, onFilterChange, update };
})();

PU.orders = PU.modules.orders;
