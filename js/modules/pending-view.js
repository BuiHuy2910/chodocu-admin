/* =============================================================================
   Duyệt bài đăng — giao diện (HTML).
   Chỉ "vẽ" từ dữ liệu được truyền vào: không gọi API, không giữ trạng thái.
   Các nút gọi ngược về PU.pending.<hàm>() trong pending.js.
   ============================================================================= */
window.PU = window.PU || {};

PU.pendingView = (function () {
  const ui = PU.ui;
  const product = PU.product;
  const esc = ui.esc;

  /* -------------------------------- HÀNG CHỜ -------------------------------- */
  // opts: { active, checked, skipped, issues }
  function queueRow(p, opts) {
    const id = Number(p.id);
    const classes = ['pu-queue__item', opts.active && 'is-active', opts.checked && 'is-checked',
      opts.skipped && 'is-skipped'].filter(Boolean).join(' ');
    return `
      <div class="${classes}" role="option" aria-selected="${!!opts.active}" onclick="PU.pending.select(${id}, true)">
        <label class="pu-queue__check" onclick="event.stopPropagation()">
          <input type="checkbox" ${opts.checked ? 'checked' : ''} aria-label="Chọn tin để xử lý hàng loạt"
                 onchange="PU.pending.toggleCheck(${id}, this.checked)" />
        </label>
        ${ui.thumb(product.images(p)[0], 'pu-queue__thumb')}
        <div class="pu-queue__main">
          <div class="pu-queue__title">${esc(p.title)}</div>
          <div class="pu-queue__line">
            <span class="pu-queue__price">${ui.fmt(p.price)}</span>
            <span class="truncate">${esc(product.seller(p).fullName || '—')}</span>
          </div>
          <div class="pu-queue__line">
            <span class="truncate">${esc(product.school(p) || '—')}</span>
            ${waitTag(product.waiting(p))}
          </div>
        </div>
        ${issueCount(opts.issues)}
      </div>`;
  }

  // "chờ 3 giờ" — chuyển màu cảnh báo khi chờ quá 24 giờ
  function waitTag(wait) {
    return `
      <span class="pu-wait${wait.late ? ' is-late' : ''}">
        <span class="material-symbols-outlined">schedule</span>${esc(wait.label)}
      </span>`;
  }

  // Ô nhỏ báo số cảnh báo tự động (rê chuột để xem chi tiết)
  function issueCount(issues) {
    if (!issues || !issues.length) return '';
    const level = issues.some(item => item.level === 'danger') ? 'danger' : 'warn';
    const tooltip = issues.map(item => '• ' + item.text).join('\n');
    return `
      <span class="pu-queue__flag pu-queue__flag--${level}" title="${esc(tooltip)}">
        <span class="material-symbols-outlined">warning</span>${issues.length}
      </span>`;
  }

  function queueSkeleton() {
    const row = `
      <div class="pu-queue__item is-loading" aria-hidden="true">
        <span class="pu-thumb pu-queue__thumb"></span>
        <div class="pu-queue__main">${ui.skeleton(3)}</div>
      </div>`;
    return row.repeat(6);
  }

  function queueEmpty() {
    return ui.emptyState('Không còn tin nào chờ duyệt', 'Tin mới sẽ tự xuất hiện ở đây.', 'task_alt');
  }

  function noMatch() {
    const button = '<button class="pu-btn pu-btn--ghost pu-btn--sm" onclick="PU.pending.clearFilters()">Xoá bộ lọc</button>';
    return ui.emptyState('Không có tin khớp bộ lọc', 'Thử từ khoá khác hoặc xoá bộ lọc.', 'filter_alt_off', button);
  }

  function loadError(message) {
    const button = `
      <button class="pu-btn pu-btn--primary pu-btn--sm" onclick="PU.pending.load()">
        <span class="material-symbols-outlined">refresh</span> Thử lại
      </button>`;
    return ui.emptyState('Không tải được hàng chờ', message, 'cloud_off', button);
  }

  // Thanh thao tác hàng loạt (hiện khi có tin được tick)
  function bulkBar(count, busy) {
    const disabled = busy ? 'disabled' : '';
    return `
      <span class="pu-bulkbar__count">Đã chọn ${count} tin</span>
      <button class="pu-btn pu-btn--primary pu-btn--sm" data-action ${disabled} onclick="PU.pending.bulkApprove()">
        <span class="material-symbols-outlined">done_all</span> Duyệt (${count})
      </button>
      <button class="pu-btn pu-btn--danger pu-btn--sm" data-action ${disabled} onclick="PU.pending.bulkReject()">
        <span class="material-symbols-outlined">block</span> Từ chối (${count})
      </button>
      <button class="pu-btn pu-btn--ghost pu-btn--icon pu-btn--sm" title="Bỏ chọn tất cả" onclick="PU.pending.clearChecks()">
        <span class="material-symbols-outlined">close</span>
      </button>`;
  }

  /* ------------------------------ CHI TIẾT TIN ------------------------------ */
  // ctx: { position, total, imageIndex, issues, sellerStats, statsComplete, busy }
  function review(p, ctx) {
    const description = `<div class="pu-detail__desc">${esc(p.description || 'Không có mô tả.')}</div>`;
    return `
      ${reviewBar(p, ctx)}
      <div class="pu-rv__body">
        ${gallery(p, ctx.imageIndex)}
        ${headline(p)}
        ${issueList(ctx.issues)}
        ${facts(p)}
        ${section('Mô tả', description)}
        ${section('Người bán', sellerCard(p, ctx.sellerStats, ctx.statsComplete))}
        ${section('Lịch sử kiểm duyệt', `<div id="pqLogs">${ui.skeleton(2)}</div>`)}
      </div>`;
  }

  function section(title, body) {
    return `<section class="pu-rv__section"><h3 class="pu-rv__heading">${title}</h3>${body}</section>`;
  }

  // Thanh trên cùng (dính lại khi cuộn): vị trí trong hàng chờ + nút thao tác
  function reviewBar(p, ctx) {
    const disabled = ctx.busy ? 'disabled' : '';
    return `
      <div class="pu-rv__bar">
        <button class="pu-btn pu-btn--ghost pu-btn--icon pu-rv__back" title="Quay lại hàng chờ" onclick="PU.pending.closeDrawer()">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="pu-rv__pos">
          <b id="pqPos">${ctx.position}/${ctx.total}</b>
          <span class="mono">#${Number(p.id)}</span>
          ${waitTag(product.waiting(p))}
        </div>
        <div class="pu-rv__actions">
          <button class="pu-btn pu-btn--ghost pu-btn--sm" title="Bỏ qua, xem tin sau" onclick="PU.pending.skip()">
            Bỏ qua
          </button>
          <button class="pu-btn pu-btn--danger pu-btn--sm" data-action ${disabled} title="Từ chối (R)" onclick="PU.pending.openReject()">
            <span class="material-symbols-outlined">block</span> Từ chối
          </button>
          <button class="pu-btn pu-btn--primary pu-btn--sm" data-action ${disabled} title="Duyệt (A)" onclick="PU.pending.approve()">
            <span class="material-symbols-outlined">check</span> Duyệt
          </button>
        </div>
      </div>`;
  }

  function headline(p) {
    const original = Number(p.originalPrice) > 0 ? `<s>${ui.fmt(p.originalPrice)}</s>` : '';
    const free = p.isFree ? '<span class="pu-badge pu-badge--ok">Miễn phí</span>' : '';
    const urgent = p.isUrgent ? '<span class="pu-badge pu-badge--danger">Tin gấp</span>' : '';
    return `
      <div class="pu-rv__head">
        <h2 class="pu-rv__title">${esc(p.title)}</h2>
        <div class="pu-rv__price">${ui.fmt(p.price)} ${original} ${free} ${urgent}</div>
      </div>`;
  }

  function facts(p) {
    const item = (label, value) => `
      <div class="pu-detail__item">
        <div class="t-label">${label}</div>
        <div class="t-body strong">${esc(value || '—')}</div>
      </div>`;
    return `
      <div class="pu-detail__grid">
        ${item('Danh mục', product.category(p))}
        ${item('Tình trạng', [product.condition(p), p.conditionNote].filter(Boolean).join(' — '))}
        ${item('Điểm hẹn giao dịch', p.pickupSpot)}
        ${item('Trường', p.universityName || product.school(p))}
        ${item('Lý do pass', p.passReason)}
        ${item('Ngày đăng', ui.fmtDate(product.createdAt(p) || p.createdAt))}
      </div>`;
  }

  /* ---------------------------------- ẢNH ----------------------------------- */
  function gallery(p, index) {
    const urls = product.images(p);
    if (!urls.length) {
      return `
        <div class="pu-gallery__empty">
          <span class="material-symbols-outlined">image_not_supported</span>Tin đăng không có ảnh
        </div>`;
    }
    const current = Math.min(index || 0, urls.length - 1);
    return `
      <div class="pu-gallery" id="pqGallery">
        <button class="pu-thumb pu-gallery__main" title="Bấm để xem ảnh lớn" onclick="PU.pending.zoom()">
          ${ui.thumbInner(urls[current], `Ảnh ${current + 1}`)}
          <span class="pu-gallery__count">${current + 1}/${urls.length}</span>
        </button>
        ${urls.length > 1 ? thumbStrip(urls, current) : ''}
      </div>`;
  }

  function thumbStrip(urls, current) {
    const buttons = urls.map((url, i) => `
      <button class="pu-thumb pu-gallery__thumb${i === current ? ' is-active' : ''}" title="Ảnh ${i + 1}"
              onclick="PU.pending.showImage(${i})">${ui.thumbInner(url)}</button>`);
    return `<div class="pu-gallery__thumbs">${buttons.join('')}</div>`;
  }

  /* --------------------------- KIỂM TRA TỰ ĐỘNG ----------------------------- */
  function issueList(issues) {
    const rows = issues.length
      ? issues.map(issueRow).join('')
      : `<div class="pu-issue pu-issue--ok">
           <span class="material-symbols-outlined">verified</span><span>Không phát hiện vấn đề nào</span>
         </div>`;
    return section('Kiểm tra tự động <span class="pu-rv__hint">chỉ để tham khảo</span>',
      `<div class="pu-issues">${rows}</div>`);
  }

  function issueRow(item) {
    const link = item.refId
      ? ` <button class="pu-link" onclick="PU.products.view(${Number(item.refId)})">Xem tin</button>`
      : '';
    return `
      <div class="pu-issue pu-issue--${item.level}">
        <span class="material-symbols-outlined">${item.icon}</span>
        <span>${esc(item.text)}${link}</span>
      </div>`;
  }

  /* -------------------------------- NGƯỜI BÁN ------------------------------- */
  function sellerCard(p, stats, complete) {
    const s = product.seller(p);
    const locked = s.active === false ? '<span class="pu-badge pu-badge--danger">Đang bị khoá</span>' : '';
    const rating = s.rating != null ? `${Number(s.rating).toFixed(1)} / 5 điểm` : 'Chưa có đánh giá';
    return `
      <div class="pu-seller">
        <div class="pu-seller__head">
          ${ui.avatar(s.fullName, s.avatarUrl, 'lg')}
          <div class="pu-seller__who">
            <div class="pu-seller__name">${esc(s.fullName || '—')} ${locked}</div>
            <div class="t-caption truncate">${esc(s.email || 'Chưa có email')}</div>
          </div>
        </div>
        <div class="pu-seller__facts">
          ${sellerFact('call', s.phone || 'Chưa có số điện thoại')}
          ${sellerFact('event', s.createdAt ? 'Tham gia ' + ui.fmtDay(s.createdAt) : 'Chưa rõ ngày tham gia')}
          ${sellerFact('star', rating)}
          ${sellerFact('handshake', `${s.completedDeals || 0} giao dịch thành công`)}
        </div>
        ${sellerStats(stats, complete)}
      </div>`;
  }

  function sellerFact(icon, text) {
    return `<span><span class="material-symbols-outlined">${icon}</span><span class="truncate">${esc(text)}</span></span>`;
  }

  // Số tin của người bán, tính ngay trên trình duyệt từ danh sách đã tải
  function sellerStats(stats, complete) {
    const cell = (value, label, tone) => `<div class="pu-stat pu-stat--${tone}"><b>${value}</b><span>${label}</span></div>`;
    const note = complete ? '' : '<div class="t-caption">Chưa tải được toàn bộ tin của người bán — số liệu có thể thiếu.</div>';
    return `
      <div class="pu-seller__stats">
        ${cell(stats.total, 'Tổng tin', 'plain')}
        ${cell(stats.approved, 'Đã duyệt', 'ok')}
        ${cell(stats.rejected, 'Bị từ chối', 'danger')}
        ${cell(stats.pending, 'Đang chờ', 'warn')}
      </div>
      ${note}`;
  }

  /* ----------------------- TRẠNG THÁI CỦA CỘT CHI TIẾT ---------------------- */
  function reviewLoading() {
    return `<div class="pu-rv__body">${ui.skeleton(4)}${ui.skeleton(3)}</div>`;
  }

  // kind: 'pick' (chưa chọn tin) | 'done' (hết tin) | 'error' (chưa tải được)
  function reviewEmpty(kind) {
    if (kind === 'pick') return ui.emptyState('Chưa chọn tin nào', 'Chọn một tin ở hàng chờ (hoặc dùng phím J / K) để xem chi tiết.', 'touch_app');
    if (kind === 'error') return ui.emptyState('Chưa có dữ liệu', 'Hàng chờ chưa tải được, hãy thử lại.', 'cloud_off');
    return ui.emptyState('Đã xử lý hết hàng chờ', 'Không còn tin nào cần duyệt.', 'task_alt');
  }

  function logsError(message) {
    return `<div class="pu-history__empty">Không tải được lịch sử: ${esc(message)}</div>`;
  }

  return {
    queueRow, queueSkeleton, queueEmpty, noMatch, loadError, bulkBar,
    review, reviewLoading, reviewEmpty, gallery, logsError
  };
})();
