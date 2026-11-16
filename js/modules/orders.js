/* =============================================================================
   Module: Đơn hàng — theo dõi và can thiệp trạng thái đơn (chỉ ADMIN thấy mục này)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.orders = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const COLUMNS = 9;

  // Trạng thái nào thì được chuyển sang trạng thái nào
  const CAN_ACCEPT = ['PENDING', 'DISPUTED'];
  const CAN_COMPLETE = ['PENDING', 'ACCEPTED', 'DISPUTED'];
  const FINISHED = ['COMPLETED', 'CANCELLED', 'REJECTED'];

  // Dùng để ghép câu "Ghi chú khi …"
  const ACTION_LABEL = {
    ACCEPTED: 'duyệt đơn',
    COMPLETED: 'hoàn tất đơn',
    CANCELLED: 'huỷ đơn',
    DISPUTED: 'đánh dấu tranh chấp',
    REJECTED: 'từ chối đơn'
  };

  async function load() {
    const body = $('ordersBody');
    body.innerHTML = ui.skeletonRows(COLUMNS, 5);
    const status = $('orderStatusFilter').value;
    try {
      const orders = (await http.get('/admin/orders' + (status ? `?status=${encodeURIComponent(status)}` : ''))) || [];
      body.innerHTML = orders.length
        ? orders.map(row).join('')
        : ui.emptyRow(COLUMNS, 'Không có đơn hàng', 'Chưa có đơn nào khớp bộ lọc hiện tại.');
    } catch (e) {
      body.innerHTML = ui.emptyRow(COLUMNS, 'Không tải được đơn hàng', e.message);
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

  // Hỏi ghi chú (không bắt buộc) rồi đổi trạng thái đơn
  function update(id, status) {
    ui.askNote(`Ghi chú khi ${ACTION_LABEL[status] || 'cập nhật đơn'}`, async note => {
      try {
        await http.put(`/admin/orders/${id}/status`, { status, note: note || null });
        ui.toast('Đã cập nhật trạng thái đơn hàng.', 'ok');
        load();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    });
  }

  return { load, update };
})();

PU.orders = PU.modules.orders;
