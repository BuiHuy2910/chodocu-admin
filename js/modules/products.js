/* =============================================================================
   Module: Sản phẩm — phân trang server-side, tìm kiếm debounce, nhật ký phân trang
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.products = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;
  const product = PU.product;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const COLUMNS = 7;

  let items = [];
  let page = 0;
  let size = cfg.DEFAULT_PAGE_SIZE || 15;
  let aborter = null;

  let detail = null;
  let detailTicket = 0;

  let logPage = 0;
  let logSize = 20;

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

  function findItem(id) {
    if (detail && detail.id === id) return detail;
    return items.find(p => p.id === id) || null;
  }

  /* ---------------------------------- BẢNG ---------------------------------- */
  function paintTable(data) {
    const body = $('productsBody');
    items = (data && data.content) || [];
    body.innerHTML = items.length
      ? items.map(row).join('')
      : ui.emptyRow(COLUMNS, 'Không có sản phẩm', 'Thử đổi bộ lọc trạng thái hoặc từ khoá tìm kiếm.');

    ui.renderPager('productsPager', data, {
      unit: 'sản phẩm',
      onPage: next => { page = next; load(); },
      onSize: nextSize => { size = nextSize; page = 0; load(); }
    });
  }

  async function load() {
    if (aborter) aborter.abort();
    aborter = new AbortController();

    const body = $('productsBody');
    const status = $('productStatusFilter').value;
    const keyword = $('productSearch').value.trim();
    const path = '/admin/products' + http.query({ status, keyword, page, size });

    const cached = http.peek(path);
    if (cached) paintTable(cached);
    else body.innerHTML = ui.skeletonRows(COLUMNS, 5);

    try {
      const data = await http.get(path, { signal: aborter.signal });
      paintTable(data);
    } catch (e) {
      if (e && e.aborted) return;
      if (!cached) {
        body.innerHTML = ui.emptyRow(COLUMNS, 'Không tải được danh sách sản phẩm', e.message);
        ui.renderPager('productsPager', null);
      }
    }
  }

  function row(p) {
    const seller = product.seller(p);
    return `
      <tr>
        <td>${titleCell(p)}</td>
        <td>
          <div class="t-body strong">${esc(seller.fullName || '—')}</div>
          <div class="t-caption truncate">${esc(seller.email || '')}</div>
        </td>
        <td class="is-right"><span class="text-ok strong">${ui.fmt(p.price)}</span></td>
        <td class="t-body">${esc(product.category(p) || '—')}</td>
        <td>${ui.statusBadge(p.status)}</td>
        <td class="t-caption">${ui.fmtDate(product.createdAt(p) || p.createdAt)}</td>
        <td class="is-center">${rowActions(p)}</td>
      </tr>`;
  }

  function titleCell(p) {
    const tags = [p.isFree && 'Miễn phí', p.isUrgent && 'Tin gấp', product.school(p)].filter(Boolean).join(' · ');
    const reason = p.status === 'REJECTED' && p.rejectReason
      ? `<div class="pu-cell-prod__reason" title="${esc(p.rejectReason)}">Lý do: ${esc(p.rejectReason)}</div>`
      : '';
    return `
      <div class="pu-cell-prod">
        ${ui.thumb(product.images(p)[0], 'pu-cell-prod__thumb')}
        <div class="pu-cell-prod__text">
          <div class="pu-cell-prod__title truncate">${esc(p.title)}</div>
          ${tags ? `<div class="t-caption truncate">${esc(tags)}</div>` : ''}
          ${reason}
        </div>
      </div>`;
  }

  function rowActions(p) {
    const id = Number(p.id);
    const buttons = [iconButton('visibility', 'Xem chi tiết', `PU.products.view(${id})`)];
    if (p.status === 'PENDING') {
      buttons.push(iconButton('check', 'Duyệt', `PU.products.approve(${id})`, 'pu-btn--success'));
      buttons.push(iconButton('block', 'Từ chối', `PU.products.reject(${id})`, 'pu-btn--danger'));
    }
    if (p.status === 'APPROVED') buttons.push(iconButton('visibility_off', 'Ẩn tin', `PU.products.setHidden(${id}, true)`));
    if (p.status === 'HIDDEN') buttons.push(iconButton('restore', 'Hiện lại', `PU.products.setHidden(${id}, false)`));
    if (PU.auth.isAdmin()) {
      buttons.push(iconButton('delete', 'Xoá', `PU.products.remove(${id})`, 'pu-btn--ghost pu-btn--danger-text'));
    }
    return `<div class="pu-row-actions">${buttons.join('')}</div>`;
  }

  function iconButton(icon, title, onclick, classes) {
    return `
      <button class="pu-btn pu-btn--icon ${classes || 'pu-btn--ghost'}" title="${title}" aria-label="${title}" onclick="${onclick}">
        <span class="material-symbols-outlined">${icon}</span>
      </button>`;
  }

  /* ------------------------------ ĐỔI TRẠNG THÁI ----------------------------- */
  function approve(id) {
    ui.closeModal('productModal');
    PU.pending.approve(id);
  }

  function reject(id) {
    ui.closeModal('productModal');
    PU.pending.openReject(id);
  }

  function setHidden(id, hidden) {
    if (!hidden) return sendHidden(id, false);
    ui.confirmDialog('Ẩn tin đăng?', 'Tin sẽ không hiển thị trên sàn cho tới khi được hiện lại.',
      () => sendHidden(id, true), { okLabel: 'Ẩn tin', tone: 'warn' });
  }

  async function sendHidden(id, hidden) {
    try {
      await http.put(`/admin/products/${id}/hide?hidden=${hidden}`);
      ui.toast(hidden ? 'Đã ẩn tin đăng.' : 'Đã hiện lại tin đăng.', 'ok');
      PU.router.invalidate('dashboard');
      afterChange(id);
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  function remove(id) {
    ui.confirmDialog('Xoá sản phẩm?', 'Tin sẽ bị xoá vĩnh viễn khỏi hệ thống, không thể hoàn tác.', async () => {
      try {
        await http.del(`/admin/products/${id}`);
        ui.toast('Đã xoá sản phẩm.', 'ok');
        if (detail && detail.id === id) ui.closeModal('productModal');
        PU.router.invalidate('dashboard', 'pending');
        load();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    }, { okLabel: 'Xoá vĩnh viễn' });
  }

  function afterChange(id) {
    load();
    if (detail && detail.id === id && ui.isModalOpen('productModal')) view(id);
  }

  /* ------------------------------ CỬA SỔ CHI TIẾT ---------------------------- */
  async function view(id) {
    const ticket = ++detailTicket;
    const box = $('productModalContent');
    box.innerHTML = ui.skeleton(4);
    ui.openModal('productModal');
    try {
      const [p, logs] = await Promise.all([
        http.get(`/admin/products/${id}`),
        http.get(`/admin/products/${id}/logs`).catch(() => null)
      ]);
      if (ticket !== detailTicket) return;
      detail = p;
      box.innerHTML = detailHtml(p, logs);
    } catch (e) {
      if (ticket === detailTicket) box.innerHTML = ui.emptyState('Không tải được chi tiết', e.message, 'error');
    }
  }

  function detailHtml(p, logs) {
    const original = Number(p.originalPrice) > 0 ? `<s>${ui.fmt(p.originalPrice)}</s>` : '';
    const history = logs ? ui.historyList(logs) : '<div class="pu-history__empty">Không tải được lịch sử kiểm duyệt.</div>';
    return `
      <div class="pu-detail">
        ${galleryHtml(p)}
        <div class="pu-detail__head">
          <div class="pu-detail__headline">
            <div class="t-title">${esc(p.title)}</div>
            <div class="pu-detail__price">${ui.fmt(p.price)} ${original}</div>
          </div>
          ${ui.statusBadge(p.status)}
        </div>
        ${rejectNote(p)}
        <div class="pu-detail__desc">${esc(p.description || 'Không có mô tả.')}</div>
        ${infoGrid(p)}
        <div>
          <div class="pu-detail__heading">Lịch sử kiểm duyệt</div>
          ${history}
        </div>
        ${detailActions(p)}
      </div>`;
  }

  function galleryHtml(p) {
    const urls = product.images(p);
    if (!urls.length) {
      return `
        <div class="pu-detail__empty-img">
          <span class="material-symbols-outlined">image_not_supported</span>Không có ảnh
        </div>`;
    }
    const photos = urls.map((url, i) => `
      <button class="pu-thumb pu-detail__photo" title="Xem ảnh lớn" onclick="PU.products.openImage(${i})">
        ${ui.thumbInner(url, `Ảnh ${i + 1}`)}
      </button>`);
    return `<div class="pu-detail__gallery">${photos.join('')}</div>`;
  }

  function openImage(index) {
    if (detail) PU.lightbox.open(product.images(detail), index);
  }

  function rejectNote(p) {
    if (p.status !== 'REJECTED' || !p.rejectReason) return '';
    return `
      <div class="pu-info pu-info--danger">
        <span class="material-symbols-outlined">block</span>
        <span><b>Lý do từ chối:</b> ${esc(p.rejectReason)}</span>
      </div>`;
  }

  function infoGrid(p) {
    const seller = product.seller(p);
    const item = (label, value) => `
      <div class="pu-detail__item">
        <div class="t-label">${label}</div>
        <div class="t-body strong">${esc(value || '—')}</div>
      </div>`;
    return `
      <div class="pu-detail__grid">
        ${item('Người bán', seller.fullName)}
        ${item('Email người bán', seller.email)}
        ${item('Danh mục', product.category(p))}
        ${item('Tình trạng', product.condition(p))}
        ${item('Trường', p.universityName || product.school(p))}
        ${item('Điểm hẹn giao dịch', p.pickupSpot)}
        ${item('Lý do pass', p.passReason)}
        ${item('Ngày đăng', ui.fmtDate(product.createdAt(p) || p.createdAt))}
      </div>`;
  }

  function detailActions(p) {
    const id = Number(p.id);
    const button = (classes, icon, label, onclick) => `
      <button class="pu-btn ${classes}" onclick="${onclick}">
        <span class="material-symbols-outlined">${icon}</span> ${label}
      </button>`;
    const buttons = PU.auth.isAdmin()
      ? [button('pu-btn--ghost pu-btn--danger-text', 'delete', 'Xoá', `PU.products.remove(${id})`)]
      : [];
    if (p.status === 'PENDING') {
      buttons.push(button('pu-btn--danger', 'block', 'Từ chối', `PU.products.reject(${id})`));
      buttons.push(button('pu-btn--primary', 'check', 'Duyệt', `PU.products.approve(${id})`));
    }
    if (p.status === 'APPROVED') buttons.push(button('pu-btn--ghost', 'visibility_off', 'Ẩn tin', `PU.products.setHidden(${id}, true)`));
    if (p.status === 'HIDDEN') buttons.push(button('pu-btn--primary', 'restore', 'Hiện lại', `PU.products.setHidden(${id}, false)`));
    return `<div class="pu-detail__actions">${buttons.join('')}</div>`;
  }

  /* ----------------------- NHẬT KÝ KIỂM DUYỆT TOÀN SÀN ----------------------- */
  async function openLogs(resetPage) {
    if (resetPage !== false) logPage = 0;
    const box = $('logsContent');
    box.innerHTML = ui.skeleton(3);
    ui.renderPager('logsPager', null);
    ui.openModal('logsModal');
    try {
      const data = await http.get('/admin/moderation-logs' + http.query({ page: logPage, size: logSize }));
      const logs = (data && data.content) || [];
      box.innerHTML = logs.length
        ? logsTable(logs)
        : ui.emptyState('Chưa có nhật ký', 'Chưa có hành động kiểm duyệt nào được ghi lại.', 'history');

      ui.renderPager('logsPager', data, {
        unit: 'bản ghi',
        sizes: [10, 20, 50],
        onPage: next => { logPage = next; openLogs(false); },
        onSize: nextSize => { logSize = nextSize; logPage = 0; openLogs(false); }
      });
    } catch (e) {
      box.innerHTML = ui.emptyState('Không tải được nhật ký', e.message, 'error');
      ui.renderPager('logsPager', null);
    }
  }

  function logsTable(logs) {
    return `
      <div class="pu-table-wrap">
        <table class="pu-table">
          <thead>
            <tr><th>Thời gian</th><th>Sản phẩm</th><th>Người xử lý</th><th>Hành động</th><th>Trạng thái</th><th>Lý do</th></tr>
          </thead>
          <tbody>${logs.map(logRow).join('')}</tbody>
        </table>
      </div>`;
  }

  function logRow(log) {
    return `
      <tr>
        <td class="t-caption">${ui.fmtDate(log.createdAt)}</td>
        <td class="t-body pu-cell-wide truncate">${esc(log.productTitle || `#${log.productId || ''}`)}</td>
        <td class="t-body">${esc(log.adminName || log.moderatorName || '—')}</td>
        <td>${ui.actionBadge(log.action)}</td>
        <td class="t-caption">${esc(ui.statusLabel(log.fromStatus))} → ${esc(ui.statusLabel(log.toStatus))}</td>
        <td class="t-body pu-cell-wide truncate" title="${esc(log.reason || '')}">${esc(log.reason || '—')}</td>
      </tr>`;
  }

  return { load, onSearch, onFilterChange, findItem, view, openImage, approve, reject, setHidden, remove, openLogs };
})();

PU.products = PU.modules.products;
