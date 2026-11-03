/* =============================================================================
   Module: Sản phẩm (bảng + chi tiết + nhật ký duyệt)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.products = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;

  let all = [];

  function row(p) {
    const img = ui.imageOr(p.imageUrls && p.imageUrls[0], cfg.FALLBACK_PRODUCT);
    const seller = (p.seller && p.seller.fullName) || '—';
    const sellerEmail = (p.seller && p.seller.email) || '';
    const cat = p.categoryName || (p.category && p.category.name) || '—';

    return '' +
      '<tr>' +
        '<td>' +
          '<div class="pu-cell-prod">' +
            '<img src="' + ui.esc(img) + '" alt="" onerror="this.src=\'' + cfg.FALLBACK_PRODUCT + '\'" />' +
            '<div style="min-width:0">' +
              '<div class="pu-cell-prod__title truncate">' + ui.esc(p.title) + '</div>' +
              '<div class="t-caption">' +
                (p.isFree ? 'Miễn phí' : '') +
                (p.isFree && p.isUrgent ? ' · ' : '') +
                (p.isUrgent ? 'Tin gấp' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><div class="t-body strong">' + ui.esc(seller) + '</div><div class="t-caption truncate">' + ui.esc(sellerEmail) + '</div></td>' +
        '<td class="is-right"><span class="strong" style="color:var(--emerald)">' + ui.fmt(p.price) + '</span></td>' +
        '<td class="t-body">' + ui.esc(cat) + '</td>' +
        '<td>' + ui.statusBadge(p.status) + '</td>' +
        '<td class="t-caption">' + (p.createdAt ? ui.fmtDate(p.createdAt) : '—') + '</td>' +
        '<td class="is-center">' +
          '<div class="pu-row-actions">' +
            '<button class="pu-btn pu-btn--ghost pu-btn--icon" title="Xem chi tiết" onclick="PU.products.view(' + p.id + ')">' +
              '<span class="material-symbols-outlined">visibility</span></button>' +
            (p.status === 'PENDING'
              ? '<button class="pu-btn pu-btn--success pu-btn--icon" title="Duyệt" onclick="PU.pending.approve(' + p.id + ')">' +
                  '<span class="material-symbols-outlined">check</span></button>' +
                '<button class="pu-btn pu-btn--danger pu-btn--icon" title="Từ chối" onclick="PU.pending.openReject(' + p.id + ')">' +
                  '<span class="material-symbols-outlined">block</span></button>'
              : '') +
            '<button class="pu-btn pu-btn--ghost pu-btn--icon" title="Xoá" style="color:var(--danger)" onclick="PU.products.remove(' + p.id + ')">' +
              '<span class="material-symbols-outlined">delete</span></button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }

  function render(list) {
    const tbody = document.getElementById('productsBody');
    if (!list || list.length === 0) {
      tbody.innerHTML = ui.emptyRow(7, 'Không có sản phẩm', 'Thử đổi bộ lọc trạng thái hoặc từ khoá tìm kiếm.');
      return;
    }
    tbody.innerHTML = list.map(row).join('');
  }

  async function load() {
    const tbody = document.getElementById('productsBody');
    tbody.innerHTML = ui.skeletonRows(7, 5);
    const status = document.getElementById('productStatusFilter').value;

    try {
      all = await http.get('/admin/products' + (status ? '?status=' + encodeURIComponent(status) : ''));
      filter();
    } catch (e) {
      tbody.innerHTML = ui.emptyRow(7, 'Lỗi tải dữ liệu', e.message);
    }
  }

  function filter() {
    const input = document.getElementById('productSearch');
    const q = (input ? input.value : '').trim().toLowerCase();
    if (!q) return render(all);

    const matched = all.filter(p => {
      const hay = [
        p.title,
        p.seller && p.seller.fullName,
        p.seller && p.seller.email,
        p.categoryName || (p.category && p.category.name)
      ].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    render(matched);
  }

  function remove(id) {
    ui.confirmDialog(
      'Xoá sản phẩm',
      'Sản phẩm sẽ bị xoá khỏi hệ thống. Hành động không thể hoàn tác.',
      async () => {
        try {
          await http.del('/admin/products/' + id);
          ui.toast('Đã xoá sản phẩm.', 'warn');
          load();
          PU.modules.dashboard.load();
        } catch (e) {
          ui.toast(e.message, 'error');
        }
      }
    );
  }

  async function view(id) {
    const box = document.getElementById('productModalContent');
    box.innerHTML = '<div class="pu-skeleton"><span style="width:60%"></span><span style="width:90%"></span><span style="width:45%"></span></div>';
    ui.openModal('productModal');

    try {
      const p = await http.get('/products/' + id);
      const gallery = (p.imageUrls && p.imageUrls.length)
        ? '<div class="pu-detail__gallery">' + p.imageUrls.map(u =>
            '<img src="' + ui.esc(u) + '" alt="" onerror="this.src=\'' + cfg.FALLBACK_PRODUCT + '\'" />').join('') + '</div>'
        : '<div class="pu-detail__empty-img">Không có ảnh</div>';

      const info = (label, value) =>
        '<div class="pu-detail__item"><div class="t-label">' + label + '</div><div class="t-body strong">' + ui.esc(value || '—') + '</div></div>';

      box.innerHTML = '' +
        '<div class="pu-detail">' +
          gallery +
          '<div class="pu-detail__head">' +
            '<div style="min-width:0;flex:1">' +
              '<div class="t-title" style="margin-bottom:4px">' + ui.esc(p.title) + '</div>' +
              '<div class="pu-detail__price">' + ui.fmt(p.price) +
                (p.originalPrice ? '<s>' + ui.fmt(p.originalPrice) + '</s>' : '') +
              '</div>' +
            '</div>' +
            ui.statusBadge(p.status) +
          '</div>' +
          '<div class="pu-detail__desc">' + ui.esc(p.description || 'Không có mô tả.') + '</div>' +
          '<div class="pu-detail__grid">' +
            info('Người bán', p.seller && p.seller.fullName) +
            info('Danh mục', p.categoryName || (p.category && p.category.name)) +
            info('Tình trạng', p.conditionLabel || p.itemCondition) +
            info('Lý do pass', p.passReason) +
            info('Điểm hẹn', p.pickupSpot) +
            info('Ngày đăng', p.createdAt ? ui.fmtDate(p.createdAt) : '—') +
          '</div>' +
          (p.rejectReason
            ? '<div class="pu-info pu-info--danger"><span class="material-symbols-outlined">block</span><span><b>Lý do từ chối:</b> ' + ui.esc(p.rejectReason) + '</span></div>'
            : '') +
          (p.status === 'PENDING'
            ? '<div class="pu-inline" style="justify-content:flex-end;gap:8px">' +
                '<button class="pu-btn pu-btn--danger" onclick="PU.ui.closeModal(\'productModal\');PU.pending.openReject(' + p.id + ')">' +
                  '<span class="material-symbols-outlined">block</span> Từ chối</button>' +
                '<button class="pu-btn pu-btn--primary" onclick="PU.ui.closeModal(\'productModal\');PU.pending.approve(' + p.id + ')">' +
                  '<span class="material-symbols-outlined">check</span> Duyệt bài</button>' +
              '</div>'
            : '') +
        '</div>';
    } catch (e) {
      box.innerHTML = ui.emptyState('Không tải được chi tiết', e.message, 'error');
    }
  }

  async function openLogs() {
    const box = document.getElementById('logsContent');
    box.innerHTML = '<div class="pu-skeleton"><span style="width:50%"></span><span style="width:80%"></span></div>';
    ui.openModal('logsModal');

    try {
      const logs = await http.get('/admin/moderation-logs');
      if (!logs || logs.length === 0) {
        box.innerHTML = ui.emptyState('Chưa có nhật ký', 'Chưa có hành động kiểm duyệt nào được ghi lại.', 'history');
        return;
      }
      box.innerHTML =
        '<div class="pu-table-wrap"><table class="pu-table">' +
          '<thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Admin</th><th>Hành động</th><th>Trạng thái</th><th>Lý do</th></tr></thead>' +
          '<tbody>' + logs.map(l => {
            const from = l.fromStatus || '—';
            const to = l.toStatus || '—';
            return '<tr>' +
              '<td class="t-caption">' + (l.createdAt ? ui.fmtDate(l.createdAt) : '—') + '</td>' +
              '<td class="t-body truncate" style="max-width:220px">' + ui.esc(l.productTitle || ('#' + (l.productId || ''))) + '</td>' +
              '<td class="t-body">' + ui.esc(l.adminName || '—') + '</td>' +
              '<td><span class="pu-badge pu-badge--info pu-badge--no-dot">' + ui.esc(l.action || '—') + '</span></td>' +
              '<td class="t-caption">' + ui.esc(from) + ' → ' + ui.esc(to) + '</td>' +
              '<td class="t-body truncate" style="max-width:240px">' + ui.esc(l.reason || '—') + '</td>' +
            '</tr>';
          }).join('') + '</tbody>' +
        '</table></div>';
    } catch (e) {
      box.innerHTML = ui.emptyState('Không tải được nhật ký', e.message, 'error');
    }
  }

  return { load, filter, view, remove, openLogs };
})();
