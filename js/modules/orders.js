/* =============================================================================
   Module: Đơn hàng
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.orders = (function () {
  const http = PU.http;
  const ui = PU.ui;

  function row(o) {
    const code = o.orderCode || ('#' + o.id);
    const title = (o.product && o.product.title) || '—';
    const buyer = (o.buyer && o.buyer.fullName) || '—';
    const seller = (o.seller && o.seller.fullName) || '—';

    const canAccept = ['PENDING', 'DISPUTED'].indexOf(o.status) !== -1;
    const canComplete = ['PENDING', 'ACCEPTED', 'DISPUTED'].indexOf(o.status) !== -1;
    const canCancel = ['COMPLETED', 'CANCELLED', 'REJECTED'].indexOf(o.status) === -1;

    return '' +
      '<tr>' +
        '<td class="mono t-caption">' + ui.esc(code) + '</td>' +
        '<td class="t-body truncate" style="max-width:220px" title="' + ui.esc(title) + '">' + ui.esc(title) + '</td>' +
        '<td class="t-body">' + ui.esc(buyer) + '</td>' +
        '<td class="t-body">' + ui.esc(seller) + '</td>' +
        '<td class="is-right strong">' + ui.fmt(o.offeredPrice) + '</td>' +
        '<td class="is-right" style="color:var(--warning);font-weight:600">' + (o.platformFeeAmount != null ? ui.fmt(o.platformFeeAmount) : '—') + '</td>' +
        '<td class="is-right" style="color:var(--emerald);font-weight:600">' + (o.finalSellerAmount != null ? ui.fmt(o.finalSellerAmount) : '—') + '</td>' +
        '<td>' + ui.statusBadge(o.status) + '</td>' +
        '<td class="is-center">' +
          '<div class="pu-row-actions">' +
            (canAccept
              ? '<button class="pu-btn pu-btn--ghost pu-btn--icon" title="Duyệt đơn" onclick="PU.orders.update(' + o.id + ',\'ACCEPTED\')">' +
                  '<span class="material-symbols-outlined">check_circle</span></button>'
              : '') +
            (canComplete
              ? '<button class="pu-btn pu-btn--success pu-btn--icon" title="Hoàn tất" onclick="PU.orders.update(' + o.id + ',\'COMPLETED\')">' +
                  '<span class="material-symbols-outlined">done_all</span></button>'
              : '') +
            (canCancel
              ? '<button class="pu-btn pu-btn--danger pu-btn--icon" title="Huỷ đơn" onclick="PU.orders.update(' + o.id + ',\'CANCELLED\')">' +
                  '<span class="material-symbols-outlined">cancel</span></button>'
              : '') +
          '</div>' +
        '</td>' +
      '</tr>';
  }

  async function load() {
    const tbody = document.getElementById('ordersBody');
    tbody.innerHTML = ui.skeletonRows(9, 5);
    const status = document.getElementById('orderStatusFilter').value;

    try {
      const orders = await http.get('/admin/orders' + (status ? '?status=' + encodeURIComponent(status) : ''));
      if (!orders || orders.length === 0) {
        tbody.innerHTML = ui.emptyRow(9, 'Không có đơn hàng', 'Chưa có đơn nào khớp bộ lọc hiện tại.');
        return;
      }
      tbody.innerHTML = orders.map(row).join('');
    } catch (e) {
      tbody.innerHTML = ui.emptyRow(9, 'Lỗi tải đơn hàng', e.message);
    }
  }

  const LABEL = { ACCEPTED: 'duyệt đơn', COMPLETED: 'hoàn tất đơn', CANCELLED: 'huỷ đơn', DISPUTED: 'đánh dấu tranh chấp', REJECTED: 'từ chối đơn' };

  function update(id, status) {
    ui.askNote('Ghi chú khi ' + (LABEL[status] || 'cập nhật đơn'), async (note) => {
      try {
        await http.put('/admin/orders/' + id + '/status', { status, note: note || null });
        ui.toast('Đã cập nhật trạng thái đơn hàng.', 'ok');
        load();
        PU.modules.dashboard.load();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    });
  }

  return { load, update };
})();
