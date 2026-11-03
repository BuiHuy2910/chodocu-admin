/* =============================================================================
   Module: Duyệt bài đăng (PENDING)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.pending = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;

  function card(p) {
    const img = ui.imageOr(p.imageUrls && p.imageUrls[0], cfg.FALLBACK_PRODUCT);
    const seller = (p.seller && p.seller.fullName) || '—';
    const uni = p.universityShortName || (p.university && p.university.shortName) || '—';
    const cat = p.categoryName || (p.category && p.category.name) || '—';
    const cond = p.conditionLabel || p.itemCondition || '—';

    return '' +
      '<article class="pu-review">' +
        '<div class="pu-review__media">' +
          '<img src="' + ui.esc(img) + '" alt="" onerror="this.src=\'' + cfg.FALLBACK_PRODUCT + '\'" />' +
          (p.isUrgent ? '<span class="pu-review__flag pu-badge pu-badge--danger">Tin gấp</span>' : '') +
        '</div>' +
        '<div class="pu-review__body">' +
          '<div class="pu-review__title">' + ui.esc(p.title) + '</div>' +
          '<div class="pu-review__desc">' + ui.esc(p.description || '') + '</div>' +
          '<div class="pu-review__price"><b>' + ui.fmt(p.price) + '</b>' +
            (p.originalPrice ? '<s class="t-caption">' + ui.fmt(p.originalPrice) + '</s>' : '') +
          '</div>' +
          '<div class="pu-review__meta">' +
            '<div><span class="material-symbols-outlined">person</span><span class="truncate">' + ui.esc(seller) + '</span></div>' +
            '<div><span class="material-symbols-outlined">school</span><span class="truncate">' + ui.esc(uni) + '</span></div>' +
            '<div><span class="material-symbols-outlined">category</span><span class="truncate">' + ui.esc(cat) + '</span></div>' +
            '<div><span class="material-symbols-outlined">sell</span><span class="truncate">' + ui.esc(cond) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="pu-review__foot">' +
          '<button class="pu-btn pu-btn--ghost pu-btn--sm" onclick="PU.products.view(' + p.id + ')">' +
            '<span class="material-symbols-outlined">visibility</span> Xem' +
          '</button>' +
          '<button class="pu-btn pu-btn--success pu-btn--sm" onclick="PU.pending.approve(' + p.id + ')">' +
            '<span class="material-symbols-outlined">check</span> Duyệt' +
          '</button>' +
          '<button class="pu-btn pu-btn--danger pu-btn--sm" onclick="PU.pending.openReject(' + p.id + ')">' +
            '<span class="material-symbols-outlined">block</span> Từ chối' +
          '</button>' +
        '</div>' +
      '</article>';
  }

  async function load() {
    const grid = document.getElementById('pendingGrid');
    grid.innerHTML = '<div class="pu-skeleton" style="grid-column:1/-1"><span style="width:40%"></span><span style="width:70%"></span><span style="width:55%"></span></div>';

    try {
      const products = await http.get('/admin/products?status=PENDING');
      ui.setBadge('pendingBadge', (products || []).length);

      if (!products || products.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1">' + ui.emptyState('Tất cả bài đăng đã được xử lý', 'Không còn tin nào đang chờ duyệt.', 'task_alt') + '</div>';
        return;
      }
      grid.innerHTML = products.map(card).join('');
    } catch (e) {
      grid.innerHTML = '<div style="grid-column:1/-1">' + ui.emptyState('Không tải được hàng chờ', e.message, 'error') + '</div>';
    }
  }

  async function approve(id) {
    try {
      await http.put('/admin/products/' + id + '/approve');
      ui.toast('Đã duyệt bài đăng.', 'ok');
      load();
      PU.modules.dashboard.load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  function openReject(id) {
    document.getElementById('rejectProductId').value = id;
    document.getElementById('rejectReason').value = '';
    ui.openModal('rejectModal');
    setTimeout(() => document.getElementById('rejectReason').focus(), 50);
  }

  async function confirmReject() {
    const id = document.getElementById('rejectProductId').value;
    const reason = (document.getElementById('rejectReason').value || '').trim();
    if (!reason) { ui.toast('Vui lòng nhập lý do từ chối.', 'warn'); return; }

    try {
      await http.put('/admin/products/' + id + '/reject', { reason });
      ui.closeModal('rejectModal');
      ui.toast('Đã từ chối bài đăng và gửi lý do cho người đăng.', 'warn');
      load();
      PU.modules.dashboard.load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, approve, openReject, confirmReject };
})();
