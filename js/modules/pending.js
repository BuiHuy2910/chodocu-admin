/* =============================================================================
   Module: Duyệt bài đăng (hàng chờ PENDING) — phân trang + gộp 1 request duy nhất
   Tải 1 trang từ /admin/products/pending-queue kèm sẵn:
     - danh mục & trường có trong hàng chờ
     - thống kê số tin của từng người bán
     - danh sách tiêu đề tin cùng người bán (để báo trùng)
     - lịch sử kiểm duyệt của các tin trong trang (di chuyển J/K 0 tốn request)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.pending = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;
  const product = PU.product;
  const checks = PU.pendingChecks;
  const view = PU.pendingView;
  const $ = id => document.getElementById(id);

  const NARROW = window.matchMedia('(max-width: 1100px)');
  const MAX_REASON = 255;
  const BULK_LIMIT = 100;

  /* -------------------------------- TRẠNG THÁI ------------------------------ */
  const state = {
    phase: 'idle',          // 'idle' | 'loading' | 'ready' | 'error'
    error: '',
    page: 0,
    size: cfg.PENDING_PAGE_SIZE || 20,
    totalElements: 0,
    totalPages: 0,
    totalPending: 0,
    queue: [],              // các tin của trang hiện tại
    categories: [],
    schools: [],
    sellerStats: new Map(), // sellerId → { total, approved, rejected, pending }
    siblings: new Map(),    // sellerId → [{ id, title, status }]
    issues: new Map(),      // productId → cảnh báo tự động
    logs: new Map(),        // productId → lịch sử kiểm duyệt (đã tải sẵn từ pending-queue)
    selectedId: null,
    imageIndex: 0,
    checked: new Set(),
    skipped: new Map(),
    busy: false,
    rejectIds: []
  };
  let skipCounter = 0;
  let aborter = null;

  const debouncedSearch = ui.debounce(() => {
    state.page = 0;
    load();
  }, 300);

  function onSearch() {
    debouncedSearch();
  }

  /* ------------------------------- TẢI DỮ LIỆU ------------------------------ */
  function readFilters() {
    return {
      keyword: ($('pqSearch') && $('pqSearch').value.trim()) || '',
      category: ($('pqCategory') && $('pqCategory').value) || '',
      school: ($('pqSchool') && $('pqSchool').value) || '',
      sort: ($('pqSort') && $('pqSort').value) || 'oldest'
    };
  }

  function queuePath() {
    const f = readFilters();
    return '/admin/products/pending-queue' + http.query({
      keyword: f.keyword,
      category: f.category,
      school: f.school,
      sort: f.sort,
      page: state.page,
      size: state.size
    });
  }

  function fetchQueue(signal) {
    return http.get(queuePath(), signal ? { signal } : undefined);
  }

  async function load() {
    if (state.busy) return;
    if (aborter) aborter.abort();
    aborter = new AbortController();

    closeDrawer();
    const cached = http.peek(queuePath());
    if (cached) {
      setData(cached);
      state.phase = 'ready';
      render();
    } else {
      state.phase = 'loading';
      render();
    }

    try {
      const payload = await fetchQueue(aborter.signal);
      setData(payload);
      state.phase = 'ready';
    } catch (e) {
      if (e && e.aborted) return;
      if (!cached) {
        setData(null);
        state.phase = 'error';
        state.error = e.message || 'Lỗi không xác định.';
      }
    }
    render({ keepReview: !!cached });
  }

  async function refreshQuietly(options) {
    if (state.busy || state.phase !== 'ready') return;
    const before = new Set(state.queue.map(p => p.id));
    const prevTotal = state.totalPending;
    try {
      const payload = await fetchQueue();
      if (state.busy) return;
      setData(payload);
      const added = Math.max(0, state.totalPending - prevTotal) || state.queue.filter(p => !before.has(p.id)).length;
      if (options && options.announce && added > 0) ui.toast(`Có ${added} tin mới chờ duyệt.`, 'info');
      render({ keepReview: true });
    } catch (_) {
      // Làm mới ngầm thất bại thì giữ nguyên dữ liệu hiện có
    }
  }

  function setData(payload) {
    const pageObj = (payload && payload.page) || {};
    state.queue = pageObj.content || [];
    state.page = pageObj.pageNumber || 0;
    state.size = pageObj.pageSize || state.size;
    state.totalElements = pageObj.totalElements || 0;
    state.totalPages = pageObj.totalPages || 0;
    state.totalPending = payload && payload.totalPending != null ? payload.totalPending : state.totalElements;
    state.categories = (payload && payload.categories) || [];
    state.schools = (payload && payload.schools) || [];

    state.sellerStats.clear();
    if (payload && payload.sellerStats) {
      Object.keys(payload.sellerStats).forEach(sid => {
        state.sellerStats.set(Number(sid), payload.sellerStats[sid]);
      });
    }

    state.siblings.clear();
    if (payload && payload.sellerSiblings) {
      Object.keys(payload.sellerSiblings).forEach(sid => {
        state.siblings.set(Number(sid), payload.sellerSiblings[sid] || []);
      });
    }

    state.logs.clear();
    if (payload && payload.logsByProduct) {
      Object.keys(payload.logsByProduct).forEach(pid => {
        state.logs.set(Number(pid), payload.logsByProduct[pid] || []);
      });
    }

    state.issues.clear();
    forgetMissing();
    fillFilterOptions();
  }

  function forgetMissing() {
    const inQueue = new Set(state.queue.map(p => p.id));
    state.checked.forEach(id => { if (!inQueue.has(id)) state.checked.delete(id); });
    state.skipped.forEach((_, id) => { if (!inQueue.has(id)) state.skipped.delete(id); });
  }

  /* --------------------------- DỮ LIỆU CỦA MỘT TIN -------------------------- */
  function selected() {
    return state.queue.find(p => p.id === state.selectedId) || null;
  }

  function findProduct(id) {
    return state.queue.find(p => p.id === id)
      || (PU.products && PU.products.findItem && PU.products.findItem(id))
      || null;
  }

  function nameOf(id) {
    const p = findProduct(id);
    return p ? `“${p.title}”` : `tin #${id}`;
  }

  function sellerProducts(p) {
    const sid = product.seller(p).id;
    return (sid != null && state.siblings.get(Number(sid))) || [p];
  }

  function issuesOf(p) {
    if (!state.issues.has(p.id)) {
      state.issues.set(p.id, checks.run(p, { sellerProducts: sellerProducts(p) }));
    }
    return state.issues.get(p.id);
  }

  function sellerStats(p) {
    const sid = product.seller(p).id;
    const s = sid != null ? state.sellerStats.get(Number(sid)) : null;
    if (s) {
      return {
        total: s.total || 0,
        approved: s.approved || 0,
        rejected: s.rejected || 0,
        pending: s.pending || 0
      };
    }
    return { total: 1, approved: 0, rejected: 0, pending: 1 };
  }

  /* ------------------------------ LỌC & SẮP XẾP ----------------------------- */
  function timeOf(p) {
    const date = product.createdAt(p);
    return date ? date.getTime() : 0;
  }

  function riskOf(p) {
    return issuesOf(p).reduce((sum, item) => sum + (item.level === 'danger' ? 10 : 1), 0);
  }

  const SORTERS = {
    oldest: (a, b) => timeOf(a) - timeOf(b) || a.id - b.id,
    newest: (a, b) => timeOf(b) - timeOf(a) || b.id - a.id,
    risk: (a, b) => riskOf(b) - riskOf(a) || SORTERS.oldest(a, b),
    'price-asc': (a, b) => Number(a.price) - Number(b.price),
    'price-desc': (a, b) => Number(b.price) - Number(a.price)
  };

  function visibleItems() {
    const sort = ($('pqSort') && $('pqSort').value) || 'oldest';
    const sorter = SORTERS[sort] || SORTERS.oldest;
    return state.queue.slice().sort((a, b) => skipOrder(a) - skipOrder(b) || sorter(a, b));
  }

  function skipOrder(p) {
    return state.skipped.get(p.id) || 0;
  }

  function applyFilters() {
    state.page = 0;
    load();
  }

  function clearFilters() {
    $('pqSearch').value = '';
    $('pqCategory').value = '';
    $('pqSchool').value = '';
    state.page = 0;
    load();
  }

  function fillFilterOptions() {
    fillSelect('pqCategory', state.categories, 'Tất cả danh mục');
    fillSelect('pqSchool', state.schools, 'Tất cả trường');
  }

  function fillSelect(id, values, allLabel) {
    const select = $(id);
    if (!select) return;
    const current = select.value;
    const options = Array.from(new Set((values || []).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
    if (current && !options.includes(current)) options.unshift(current);
    select.innerHTML = `<option value="">${allLabel}</option>` +
      options.map(v => `<option value="${ui.esc(v)}">${ui.esc(v)}</option>`).join('');
    select.value = current;
  }

  /* ------------------------------- VẼ GIAO DIỆN ----------------------------- */
  function render(options) {
    const items = visibleItems();
    const selectionChanged = ensureSelection(items);
    syncBadge();
    renderToolbar(items);
    renderQueue(items);
    renderPager();
    if (selectionChanged || !(options && options.keepReview)) renderReview(items);
    else renderPosition(items);
  }

  function syncBadge() {
    if (state.phase === 'ready') ui.setBadge('pendingBadge', state.totalPending);
  }

  function ensureSelection(items) {
    if (state.selectedId !== null && items.some(p => p.id === state.selectedId)) return false;
    state.selectedId = items.length ? items[0].id : null;
    state.imageIndex = 0;
    return true;
  }

  function renderToolbar(items) {
    const f = readFilters();
    const filtered = !!(f.keyword || f.category || f.school);
    $('pqCount').textContent = !filtered
      ? `${ui.fmtNum(state.totalPending)} tin chờ duyệt`
      : `${ui.fmtNum(state.totalElements)}/${ui.fmtNum(state.totalPending)} tin khớp bộ lọc`;
    renderCheckAll(items);
    renderBulkBar();
    const loading = state.phase === 'loading';
    $('pqRefresh').disabled = loading;
    $('pqRefresh').classList.toggle('is-loading', loading);
  }

  function renderCheckAll(items) {
    const box = $('pqCheckAll');
    const checkedCount = items.filter(p => state.checked.has(p.id)).length;
    box.checked = items.length > 0 && checkedCount === items.length;
    box.indeterminate = checkedCount > 0 && checkedCount < items.length;
    box.disabled = !items.length;
  }

  function renderBulkBar() {
    const count = checkedIds().length;
    const bar = $('pqBulkBar');
    bar.classList.toggle('hidden', count === 0);
    bar.innerHTML = count ? view.bulkBar(count, state.busy) : '';
  }

  function renderQueue(items) {
    $('pqList').innerHTML = queueHtml(items);
  }

  function renderPager() {
    if (state.phase !== 'ready' || state.totalElements <= 0) {
      ui.renderPager('pqPager', null);
      return;
    }
    ui.renderPager('pqPager', {
      pageNumber: state.page,
      pageSize: state.size,
      totalElements: state.totalElements,
      totalPages: Math.max(state.totalPages, Math.ceil(state.totalElements / state.size))
    }, {
      compact: true,
      unit: 'tin',
      sizes: [15, 20, 50],
      onPage: next => { state.page = next; load(); },
      onSize: nextSize => { state.size = nextSize; state.page = 0; load(); }
    });
  }

  function queueHtml(items) {
    const f = readFilters();
    const hasFilter = !!(f.keyword || f.category || f.school);
    if (state.phase === 'error') return view.loadError(state.error);
    if (state.phase === 'loading' && !state.queue.length) return view.queueSkeleton();
    if (!state.totalPending && !items.length) return view.queueEmpty();
    if (!items.length && hasFilter) return view.noMatch();
    if (!items.length) return view.queueEmpty();
    return items.map(p => view.queueRow(p, {
      active: p.id === state.selectedId,
      checked: state.checked.has(p.id),
      skipped: state.skipped.has(p.id),
      issues: issuesOf(p)
    })).join('');
  }

  function renderReview(items) {
    const box = $('pqReview');
    const p = selected();
    if (!p) {
      closeDrawer();
      box.innerHTML = emptyReviewHtml();
      return;
    }
    const offset = state.page * state.size;
    box.innerHTML = view.review(p, {
      position: offset + items.findIndex(x => x.id === p.id) + 1,
      total: Math.max(state.totalElements, items.length),
      imageIndex: state.imageIndex,
      issues: issuesOf(p),
      sellerStats: sellerStats(p),
      statsComplete: true,
      busy: state.busy
    });
    box.scrollTop = 0;
    showLogs(p.id);
  }

  function emptyReviewHtml() {
    if (state.phase === 'loading') return view.reviewLoading();
    if (state.phase === 'error') return view.reviewEmpty('error');
    return view.reviewEmpty(state.totalPending ? 'pick' : 'done');
  }

  function renderPosition(items) {
    const el = $('pqPos');
    if (!el) return;
    const idx = items.findIndex(p => p.id === state.selectedId);
    if (idx >= 0) {
      el.textContent = `${state.page * state.size + idx + 1}/${Math.max(state.totalElements, items.length)}`;
    }
  }

  /* ---------------------------- CHỌN TIN & DI CHUYỂN ------------------------ */
  function select(id, fromClick) {
    if (id !== state.selectedId) {
      state.selectedId = id;
      state.imageIndex = 0;
      const items = visibleItems();
      renderQueue(items);
      renderReview(items);
      scrollToSelected();
    }
    if (fromClick && NARROW.matches) openDrawer();
  }

  function move(step) {
    const items = visibleItems();
    if (!items.length) return;
    const index = items.findIndex(p => p.id === state.selectedId);
    const target = Math.min(Math.max(index + step, 0), items.length - 1);
    select(items[target].id);
  }

  function next() { move(1); }
  function prev() { move(-1); }

  function skip() {
    const id = state.selectedId;
    if (id === null) return;
    const index = visibleItems().findIndex(p => p.id === id);
    state.skipped.set(id, ++skipCounter);
    const items = visibleItems();
    const following = items[index] && items[index].id !== id ? items[index] : items[0];
    state.selectedId = following ? following.id : null;
    state.imageIndex = 0;
    render();
    scrollToSelected();
  }

  function scrollToSelected() {
    const row = document.querySelector('#pqList .pu-queue__item.is-active');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  /* --------------------- NGĂN KÉO CHI TIẾT (MÀN HÌNH HẸP) ------------------- */
  function setDrawer(open) {
    const review = $('pqReview');
    const backdrop = $('pqBackdrop');
    if (review) review.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
  }

  function openDrawer() { setDrawer(true); }
  function closeDrawer() { setDrawer(false); }

  /* ------------------------------ ẢNH & LỊCH SỬ ----------------------------- */
  function showImage(index) {
    const p = selected();
    const box = $('pqGallery');
    if (!p || !box) return;
    state.imageIndex = index;
    box.outerHTML = view.gallery(p, index);
  }

  function zoom() {
    const p = selected();
    if (p) PU.lightbox.open(product.images(p), state.imageIndex);
  }

  // Lịch sử đã được gộp sẵn trong pending-queue; chỉ gọi lẻ nếu chưa có trong Map
  async function showLogs(id) {
    if (state.logs.has(id)) return paintLogs(id, ui.historyList(state.logs.get(id)));
    try {
      const logs = (await http.get(`/admin/products/${id}/logs`)) || [];
      state.logs.set(id, logs);
      paintLogs(id, ui.historyList(logs));
    } catch (e) {
      paintLogs(id, view.logsError(e.message));
    }
  }

  function paintLogs(id, html) {
    const box = $('pqLogs');
    if (box && id === state.selectedId) box.innerHTML = html;
  }

  /* ----------------------------- DUYỆT / TỪ CHỐI ---------------------------- */
  function canAct() {
    return !state.busy && state.phase !== 'loading';
  }

  function approve(id) {
    const target = Number(id) || state.selectedId;
    if (!target || !canAct()) return;
    const label = nameOf(target);
    optimistic({
      ids: [target],
      newStatus: 'APPROVED',
      request: () => http.put(`/admin/products/${target}/approve`),
      success: () => `Đã duyệt ${label}.`
    });
  }

  function openReject(id) {
    const target = Number(id) || state.selectedId;
    if (!target || !canAct()) return;
    openReasonDialog([target]);
  }

  function rejectOne(id, reason) {
    const label = nameOf(id);
    return optimistic({
      ids: [id],
      newStatus: 'REJECTED',
      request: () => http.put(`/admin/products/${id}/reject`, { reason }),
      success: () => `Đã từ chối ${label} và gửi lý do cho người đăng.`
    });
  }

  function rejectMany(ids, reason) {
    return optimistic({
      ids,
      newStatus: 'REJECTED',
      request: () => http.put('/admin/products/bulk-reject', { ids, reason }),
      success: result => bulkMessage('Đã từ chối', result, ids.length),
      reconcile: true
    });
  }

  /* ---------------------------- CẬP NHẬT LẠC QUAN --------------------------- */
  async function optimistic(job) {
    const backup = snapshot();
    setBusy(true);
    state.selectedId = nextRemaining(job.ids);
    state.imageIndex = 0;
    takeOut(job.ids, job.newStatus);
    if (state.phase === 'ready') render();

    try {
      const result = await job.request();
      setBusy(false);
      ui.toast(job.success(result), 'ok');
      afterChange(job);
      return true;
    } catch (e) {
      setBusy(false);
      restore(backup);
      if (state.phase === 'ready') render();
      ui.toast(`${e.message || 'Thao tác thất bại.'} Tin đã được trả lại hàng chờ.`, 'error');
      return false;
    }
  }

  function snapshot() {
    return {
      queue: state.queue.slice(),
      selectedId: state.selectedId,
      totalElements: state.totalElements,
      totalPending: state.totalPending,
      checked: new Set(state.checked),
      skipped: new Map(state.skipped)
    };
  }

  function restore(backup) {
    state.queue = backup.queue;
    state.selectedId = backup.selectedId;
    state.totalElements = backup.totalElements;
    state.totalPending = backup.totalPending;
    state.checked = backup.checked;
    state.skipped = backup.skipped;
    state.queue.forEach(p => { p.status = 'PENDING'; });
    state.issues.clear();
  }

  function takeOut(ids, newStatus) {
    const removed = state.queue.filter(p => ids.includes(p.id));
    removed.forEach(p => {
      p.status = newStatus;
      state.checked.delete(p.id);
      state.skipped.delete(p.id);
      const sid = product.seller(p).id;
      const st = sid != null ? state.sellerStats.get(Number(sid)) : null;
      if (st) {
        st.pending = Math.max(0, (st.pending || 0) - 1);
        if (newStatus === 'APPROVED') st.approved = (st.approved || 0) + 1;
        if (newStatus === 'REJECTED') st.rejected = (st.rejected || 0) + 1;
      }
    });
    const delta = removed.length;
    if (delta > 0) {
      state.totalElements = Math.max(0, state.totalElements - delta);
      state.totalPending = Math.max(0, state.totalPending - delta);
    }
    state.queue = state.queue.filter(p => !ids.includes(p.id));
    state.issues.clear();
  }

  function nextRemaining(ids) {
    if (!ids.includes(state.selectedId)) return state.selectedId;
    const items = visibleItems();
    const index = items.findIndex(p => p.id === state.selectedId);
    const after = items.slice(index + 1).find(p => !ids.includes(p.id));
    const before = items.slice(0, index).reverse().find(p => !ids.includes(p.id));
    const target = after || before;
    return target ? target.id : null;
  }

  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll('#section-pending [data-action]').forEach(button => {
      button.disabled = busy;
    });
  }

  function afterChange(job) {
    PU.router.invalidate('dashboard', 'products', 'pending');
    if (PU.router.currentSection() === 'products') {
      PU.router.reload();
      return;
    }
    // Nếu vừa xử lý hết các tin trên trang hiện tại nhưng vẫn còn trang khác → tự nạp trang kế
    if (state.phase === 'ready' && state.queue.length === 0 && state.totalElements > 0) {
      if (state.page > 0 && state.page * state.size >= state.totalElements) state.page--;
      load();
      return;
    }
    if (job.reconcile) refreshQuietly();
  }

  /* ------------------------- HỘP THOẠI LÝ DO TỪ CHỐI ------------------------ */
  function openReasonDialog(ids) {
    const input = $('rejectReason');
    if (!sameIds(ids, state.rejectIds)) input.value = '';
    state.rejectIds = ids;
    $('rejectTitle').textContent = ids.length > 1 ? `Từ chối ${ids.length} tin đăng` : 'Từ chối tin đăng';
    $('rejectSub').textContent = ids.length > 1
      ? `Người đăng của cả ${ids.length} tin sẽ nhận được cùng lý do này.`
      : `Người đăng ${nameOf(ids[0])} sẽ nhận được lý do này.`;
    syncReasonForm();
    ui.openModal('rejectModal');
    setTimeout(() => input.focus(), 50);
  }

  function sameIds(a, b) {
    return a.length === b.length && a.every(id => b.includes(id));
  }

  async function confirmReject() {
    const input = $('rejectReason');
    const reason = input.value.trim();
    const problem = !reason ? 'Vui lòng chọn hoặc nhập lý do từ chối.'
      : reason.length > MAX_REASON ? `Lý do quá dài (${reason.length}/${MAX_REASON} ký tự), hãy rút gọn.`
      : '';
    if (problem) {
      ui.toast(problem, 'warn');
      input.focus();
      return;
    }
    const ids = state.rejectIds;
    if (!ids.length || !canAct()) return;

    ui.closeModal('rejectModal');
    const ok = ids.length > 1 ? await rejectMany(ids, reason) : await rejectOne(ids[0], reason);
    if (ok) state.rejectIds = [];
  }

  function toggleReason(chip) {
    const text = chip.dataset.reason;
    const input = $('rejectReason');
    const reasons = splitReasons(input.value);
    const index = reasons.indexOf(text);
    if (index >= 0) reasons.splice(index, 1);
    else reasons.push(text);
    input.value = reasons.join('; ');
    syncReasonForm();
    input.focus();
  }

  function splitReasons(text) {
    return text.split(';').map(s => s.trim()).filter(Boolean);
  }

  function syncReasonForm() {
    const text = $('rejectReason').value;
    const reasons = splitReasons(text);
    document.querySelectorAll('#rejectModal .pu-chip').forEach(chip => {
      const active = reasons.includes(chip.dataset.reason);
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active);
    });
    const counter = $('rejectCount');
    const length = text.trim().length;
    counter.textContent = `${length}/${MAX_REASON}`;
    counter.classList.toggle('is-over', length > MAX_REASON);
  }

  /* ------------------------ CHỌN NHIỀU & XỬ LÝ HÀNG LOẠT --------------------- */
  function checkedIds() {
    return state.queue.filter(p => state.checked.has(p.id)).map(p => p.id);
  }

  function toggleCheck(id, on) {
    if (on) state.checked.add(id);
    else state.checked.delete(id);
    render({ keepReview: true });
  }

  function toggleAll(on) {
    visibleItems().forEach(p => (on ? state.checked.add(p.id) : state.checked.delete(p.id)));
    render({ keepReview: true });
  }

  function clearChecks() {
    state.checked.clear();
    render({ keepReview: true });
  }

  function toggleCurrentCheck() {
    const id = state.selectedId;
    if (id !== null) toggleCheck(id, !state.checked.has(id));
  }

  function canBulk(ids) {
    if (ids.length > BULK_LIMIT) {
      ui.toast(`Mỗi lần chỉ xử lý được tối đa ${BULK_LIMIT} tin, hãy bỏ chọn bớt.`, 'warn');
      return false;
    }
    return ids.length > 0 && canAct();
  }

  function bulkApprove() {
    const ids = checkedIds();
    if (!canBulk(ids)) return;
    ui.confirmDialog(`Duyệt ${ids.length} tin đăng?`, 'Các tin sẽ hiển thị công khai trên sàn ngay sau khi duyệt.', () => {
      optimistic({
        ids,
        newStatus: 'APPROVED',
        request: () => http.put('/admin/products/bulk-approve', { ids }),
        success: result => bulkMessage('Đã duyệt', result, ids.length),
        reconcile: true
      });
    }, { okLabel: `Duyệt ${ids.length} tin`, tone: 'primary' });
  }

  function bulkReject() {
    const ids = checkedIds();
    if (canBulk(ids)) openReasonDialog(ids);
  }

  function bulkMessage(verb, result, requested) {
    const done = countOf(result && result.processed, requested);
    const skipped = countOf(result && result.skipped, 0);
    return skipped
      ? `${verb} ${done} tin, bỏ qua ${skipped} tin đã được xử lý trước đó.`
      : `${verb} ${done} tin.`;
  }

  function countOf(value, fallback) {
    if (value == null) return fallback;
    if (Array.isArray(value)) return value.length;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /* --------------------------------- PHÍM TẮT -------------------------------- */
  const ACTION_KEYS = { a: () => approve(), r: () => openReject(), s: skip, x: toggleCurrentCheck };
  const MOVE_KEYS = { j: next, arrowdown: next, k: prev, arrowup: prev };

  function onKeyDown(e) {
    const key = (e.key || '').toLowerCase();
    const action = MOVE_KEYS[key] || (!e.repeat && ACTION_KEYS[key]);
    if (!action || !shortcutsEnabled(e)) return;
    e.preventDefault();
    action();
  }

  function shortcutsEnabled(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (!isOnScreen() || ui.anyModalOpen() || PU.lightbox.isOpen()) return false;
    return !isTyping(e.target);
  }

  function isOnScreen() {
    return PU.router.currentSection() === 'pending' && $('app').classList.contains('is-active');
  }

  function isTyping(el) {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    return el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type);
  }

  /* ------------------------------- TỰ LÀM MỚI -------------------------------- */
  function autoRefreshTick() {
    const box = $('pqAuto');
    if (box && box.checked && isOnScreen() && !document.hidden) refreshQuietly({ announce: true });
  }

  /* ------------------------------- GẮN SỰ KIỆN ------------------------------- */
  function bindEvents() {
    document.addEventListener('keydown', onKeyDown);
    $('rejectReason').addEventListener('input', syncReasonForm);
    $('rejectModal').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirmReject();
      }
    });
    NARROW.addEventListener('change', closeDrawer);
    setInterval(autoRefreshTick, cfg.PENDING_REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', bindEvents);

  return {
    load, onSearch, applyFilters, clearFilters,
    select, next, prev, skip, closeDrawer,
    showImage, zoom,
    approve, openReject, confirmReject, toggleReason,
    toggleCheck, toggleAll, clearChecks, bulkApprove, bulkReject
  };
})();

PU.pending = PU.modules.pending;
