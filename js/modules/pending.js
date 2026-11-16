/* =============================================================================
   Module: Duyệt bài đăng (hàng chờ PENDING)
   Bố cục 2 cột: bên trái là hàng chờ (đăng trước → duyệt trước), bên phải là
   chi tiết tin đang chọn. Màn hình hẹp: cột chi tiết thành ngăn kéo trượt ra.

   Phần duyệt bài chia làm 3 file cho dễ đọc:
     pending-checks.js  cảnh báo tự động (chỉ để tham khảo)
     pending-view.js    dựng HTML
     pending.js         (file này) trạng thái, gọi API, phím tắt
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.pending = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const product = PU.product;
  const checks = PU.pendingChecks;
  const view = PU.pendingView;
  const $ = id => document.getElementById(id);

  // Dưới bề rộng này cột chi tiết thành ngăn kéo (khớp với @media trong admin.css)
  const NARROW = window.matchMedia('(max-width: 1100px)');
  const MAX_REASON = 255;   // backend giới hạn lý do từ chối 255 ký tự
  const BULK_LIMIT = 100;   // backend xử lý tối đa 100 tin mỗi lần

  /* -------------------------------- TRẠNG THÁI ------------------------------ */
  const state = {
    phase: 'idle',          // 'idle' | 'loading' | 'ready' | 'error'
    error: '',
    queue: [],              // các tin đang chờ duyệt
    allProducts: [],        // mọi tin trên sàn (để thống kê người bán, tìm tin trùng)
    allLoaded: false,       // tải được danh sách mọi tin hay chưa
    bySeller: new Map(),    // id người bán → các tin của người đó
    issues: new Map(),      // id tin → cảnh báo tự động (tính khi cần rồi nhớ lại)
    logs: new Map(),        // id tin → lịch sử kiểm duyệt đã tải
    selectedId: null,
    imageIndex: 0,
    checked: new Set(),     // các tin được tick để xử lý hàng loạt
    skipped: new Map(),     // id tin → thứ tự bị "bỏ qua" (tin bỏ qua xếp xuống cuối)
    busy: false,            // đang chờ API duyệt / từ chối
    rejectIds: []           // (các) tin đang mở hộp thoại từ chối
  };
  let skipCounter = 0;

  /* ------------------------------- TẢI DỮ LIỆU ------------------------------ */
  // Danh sách mọi tin chỉ dùng để thống kê, nên lỗi thì bỏ qua (trả null)
  function fetchData() {
    return Promise.all([
      http.get('/admin/products?status=PENDING'),
      http.get('/admin/products').catch(() => null)
    ]);
  }

  async function load() {
    if (state.busy) return;
    closeDrawer();
    state.phase = 'loading';
    render();
    try {
      const [pending, all] = await fetchData();
      setData(pending, all);
      state.phase = 'ready';
    } catch (e) {
      setData([], null);
      state.phase = 'error';
      state.error = e.message || 'Lỗi không xác định.';
    }
    render();
  }

  // Làm mới ngầm (tự làm mới, sau thao tác hàng loạt): không hiện khung chờ,
  // giữ nguyên cột chi tiết nếu tin đang xem vẫn còn trong hàng chờ.
  async function refreshQuietly(options) {
    if (state.busy || state.phase !== 'ready') return;
    const before = new Set(state.queue.map(p => p.id));
    try {
      const [pending, all] = await fetchData();
      if (state.busy) return;   // trong lúc chờ đã có thao tác khác → bỏ kết quả cũ này
      setData(pending, all);
      const added = state.queue.filter(p => !before.has(p.id)).length;
      if (options && options.announce && added) ui.toast(`Có ${added} tin mới chờ duyệt.`, 'info');
      render({ keepReview: true });
    } catch (e) {
      // Làm mới ngầm thất bại thì giữ dữ liệu đang có, lần sau thử lại
    }
  }

  function setData(pending, all) {
    state.queue = pending || [];
    state.allLoaded = Array.isArray(all);
    state.allProducts = mergeById(all || [], state.queue);
    state.bySeller = groupBySeller(state.allProducts);
    state.issues.clear();
    state.logs.clear();
    forgetMissing();
    fillFilterOptions();
  }

  // Gộp 2 danh sách theo id, bản ghi trong `latest` được ưu tiên
  function mergeById(base, latest) {
    const byId = new Map(base.map(p => [p.id, p]));
    latest.forEach(p => byId.set(p.id, p));
    return Array.from(byId.values());
  }

  function groupBySeller(list) {
    const groups = new Map();
    list.forEach(p => {
      const sellerId = product.seller(p).id;
      if (sellerId == null) return;
      if (!groups.has(sellerId)) groups.set(sellerId, []);
      groups.get(sellerId).push(p);
    });
    return groups;
  }

  // Bỏ dấu tick / "bỏ qua" của những tin không còn trong hàng chờ
  function forgetMissing() {
    const inQueue = new Set(state.queue.map(p => p.id));
    state.checked.forEach(id => { if (!inQueue.has(id)) state.checked.delete(id); });
    state.skipped.forEach((order, id) => { if (!inQueue.has(id)) state.skipped.delete(id); });
  }

  /* --------------------------- DỮ LIỆU CỦA MỘT TIN -------------------------- */
  function selected() {
    return state.queue.find(p => p.id === state.selectedId) || null;
  }

  function findProduct(id) {
    return state.allProducts.find(p => p.id === id) || null;
  }

  // “Tên tin” (hoặc "tin #12" khi chưa có dữ liệu) để ghép vào thông báo
  function nameOf(id) {
    const p = findProduct(id);
    return p ? `“${p.title}”` : `tin #${id}`;
  }

  function sellerProducts(p) {
    return state.bySeller.get(product.seller(p).id) || [p];
  }

  function issuesOf(p) {
    if (!state.issues.has(p.id)) {
      state.issues.set(p.id, checks.run(p, { sellerProducts: sellerProducts(p) }));
    }
    return state.issues.get(p.id);
  }

  // Đếm tin của người bán theo trạng thái
  function sellerStats(p) {
    const list = sellerProducts(p);
    const count = test => list.filter(test).length;
    return {
      total: list.length,
      approved: count(product.isApproved),
      rejected: count(x => x.status === 'REJECTED'),
      pending: count(x => x.status === 'PENDING')
    };
  }

  /* ------------------------------ LỌC & SẮP XẾP ----------------------------- */
  function timeOf(p) {
    const date = product.createdAt(p);
    return date ? date.getTime() : 0;
  }

  // Mỗi cảnh báo nặng tính 10 điểm, cảnh báo nhẹ 1 điểm
  function riskOf(p) {
    return issuesOf(p).reduce((sum, item) => sum + (item.level === 'danger' ? 10 : 1), 0);
  }

  const SORTERS = {
    oldest: (a, b) => timeOf(a) - timeOf(b) || a.id - b.id,    // đăng trước → duyệt trước
    newest: (a, b) => timeOf(b) - timeOf(a) || b.id - a.id,
    risk: (a, b) => riskOf(b) - riskOf(a) || SORTERS.oldest(a, b),
    'price-asc': (a, b) => Number(a.price) - Number(b.price),
    'price-desc': (a, b) => Number(b.price) - Number(a.price)
  };

  function readFilters() {
    return {
      text: ui.normalize($('pqSearch').value),
      category: $('pqCategory').value,
      school: $('pqSchool').value,
      sort: $('pqSort').value
    };
  }

  function matches(p, filters) {
    if (filters.category && product.category(p) !== filters.category) return false;
    if (filters.school && product.school(p) !== filters.school) return false;
    if (!filters.text) return true;
    const seller = product.seller(p);
    const text = `#${p.id} ${p.title} ${p.description || ''} ${seller.fullName || ''} ${seller.email || ''}`;
    return ui.normalize(text).includes(filters.text);
  }

  // Danh sách đang hiển thị: lọc → sắp xếp → các tin "bỏ qua" xuống cuối
  function visibleItems() {
    const filters = readFilters();
    const sorter = SORTERS[filters.sort] || SORTERS.oldest;
    return state.queue
      .filter(p => matches(p, filters))
      .sort((a, b) => skipOrder(a) - skipOrder(b) || sorter(a, b));
  }

  // 0 = chưa bỏ qua; tin bị bỏ qua càng muộn thì số càng lớn → càng nằm sau
  function skipOrder(p) {
    return state.skipped.get(p.id) || 0;
  }

  function applyFilters() {
    render({ keepReview: true });
  }

  function clearFilters() {
    $('pqSearch').value = '';
    $('pqCategory').value = '';
    $('pqSchool').value = '';
    applyFilters();
  }

  // Ô lọc danh mục / trường chỉ liệt kê những giá trị đang có trong hàng chờ
  function fillFilterOptions() {
    fillSelect('pqCategory', state.queue.map(p => product.category(p)), 'Tất cả danh mục');
    fillSelect('pqSchool', state.queue.map(p => product.school(p)), 'Tất cả trường');
  }

  function fillSelect(id, values, allLabel) {
    const select = $(id);
    const current = select.value;
    const options = Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
    select.innerHTML = `<option value="">${allLabel}</option>` +
      options.map(v => `<option value="${ui.esc(v)}">${ui.esc(v)}</option>`).join('');
    select.value = options.includes(current) ? current : '';
  }

  /* ------------------------------- VẼ GIAO DIỆN ----------------------------- */
  // options.keepReview: không vẽ lại cột chi tiết nếu tin đang xem vẫn còn
  // (tránh giật màn hình và mất vị trí cuộn khi chỉ đổi bộ lọc / làm mới ngầm)
  function render(options) {
    const items = visibleItems();
    const selectionChanged = ensureSelection(items);
    syncBadge();
    renderToolbar(items);
    renderQueue(items);
    if (selectionChanged || !(options && options.keepReview)) renderReview(items);
    else renderPosition(items);
  }

  // Số cạnh menu "Duyệt bài đăng". Chỉ cập nhật khi đã tải được hàng chờ thật
  // (VD: duyệt từ mục Sản phẩm khi chưa mở mục này thì không ghi đè thành 0).
  function syncBadge() {
    if (state.phase === 'ready') ui.setBadge('pendingBadge', state.queue.length);
  }

  // Giữ tin đang chọn nếu nó còn hiển thị, không thì chọn tin đầu tiên
  function ensureSelection(items) {
    if (state.selectedId !== null && items.some(p => p.id === state.selectedId)) return false;
    state.selectedId = items.length ? items[0].id : null;
    state.imageIndex = 0;
    return true;
  }

  function renderToolbar(items) {
    const total = state.queue.length;
    $('pqCount').textContent = items.length === total
      ? `${total} tin chờ duyệt`
      : `${items.length}/${total} tin khớp bộ lọc`;
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

  function queueHtml(items) {
    if (state.phase === 'error') return view.loadError(state.error);
    if (state.phase === 'loading' && !state.queue.length) return view.queueSkeleton();
    if (!state.queue.length) return view.queueEmpty();
    if (!items.length) return view.noMatch();
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
    box.innerHTML = view.review(p, {
      position: items.findIndex(x => x.id === p.id) + 1,
      total: items.length,
      imageIndex: state.imageIndex,
      issues: issuesOf(p),
      sellerStats: sellerStats(p),
      statsComplete: state.allLoaded,
      busy: state.busy
    });
    box.scrollTop = 0;
    showLogs(p.id);
  }

  function emptyReviewHtml() {
    if (state.phase === 'loading') return view.reviewLoading();
    if (state.phase === 'error') return view.reviewEmpty('error');
    return view.reviewEmpty(state.queue.length ? 'pick' : 'done');
  }

  // Chỉ cập nhật số thứ tự "3/12" trên thanh chi tiết
  function renderPosition(items) {
    const el = $('pqPos');
    if (el) el.textContent = `${items.findIndex(p => p.id === state.selectedId) + 1}/${items.length}`;
  }

  /* ---------------------------- CHỌN TIN & DI CHUYỂN ------------------------ */
  // fromClick = true khi bấm vào hàng chờ → màn hình hẹp thì mở ngăn kéo chi tiết
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

  // "Bỏ qua": đẩy tin đang xem xuống cuối hàng chờ rồi chuyển sang tin kế tiếp
  function skip() {
    const id = state.selectedId;
    if (id === null) return;
    const index = visibleItems().findIndex(p => p.id === id);
    state.skipped.set(id, ++skipCounter);
    const items = visibleItems();
    // Tin vừa bỏ qua đã xuống cuối nên tin kế tiếp giờ nằm đúng vị trí cũ của nó
    const following = items[index] && items[index].id !== id ? items[index] : items[0];
    state.selectedId = following.id;
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

  // Lịch sử kiểm duyệt của tin đang xem (tải một lần rồi nhớ lại)
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
    if (box && id === state.selectedId) box.innerHTML = html;   // bỏ qua nếu đã chuyển sang tin khác
  }

  /* ----------------------------- DUYỆT / TỪ CHỐI ---------------------------- */
  // Đang tải lại hàng chờ hoặc đang chờ API thì tạm khoá thao tác
  function canAct() {
    return !state.busy && state.phase !== 'loading';
  }

  // Không truyền id → xử lý tin đang xem (dùng cho phím tắt và thanh chi tiết).
  // Mục Sản phẩm cũng gọi hai hàm này để duyệt / từ chối từ cửa sổ chi tiết.
  function approve(id) {
    const target = Number(id) || state.selectedId;
    if (!target || !canAct()) return;
    optimistic({
      ids: [target],
      newStatus: 'APPROVED',
      request: () => http.put(`/admin/products/${target}/approve`),
      success: () => `Đã duyệt ${nameOf(target)}.`
    });
  }

  function openReject(id) {
    const target = Number(id) || state.selectedId;
    if (!target || !canAct()) return;
    openReasonDialog([target]);
  }

  function rejectOne(id, reason) {
    return optimistic({
      ids: [id],
      newStatus: 'REJECTED',
      request: () => http.put(`/admin/products/${id}/reject`, { reason }),
      success: () => `Đã từ chối ${nameOf(id)} và gửi lý do cho người đăng.`
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
  // Gỡ tin khỏi hàng chờ NGAY rồi mới gọi API → kiểm duyệt viên làm tiếp không phải chờ.
  // API lỗi → trả tin về chỗ cũ và báo lỗi. Trả về true nếu thành công.
  //   job = { ids, newStatus, request(), success(kếtQuảApi) → câu thông báo, reconcile? }
  async function optimistic(job) {
    const backup = snapshot();
    setBusy(true);
    state.selectedId = nextRemaining(job.ids);
    state.imageIndex = 0;
    takeOut(job.ids, job.newStatus);
    render();

    try {
      const result = await job.request();
      setBusy(false);
      ui.toast(job.success(result), 'ok');
      afterChange(job);
      return true;
    } catch (e) {
      setBusy(false);
      restore(backup);
      render();
      ui.toast(`${e.message || 'Thao tác thất bại.'} Tin đã được trả lại hàng chờ.`, 'error');
      return false;
    }
  }

  function snapshot() {
    return {
      queue: state.queue.slice(),
      selectedId: state.selectedId,
      checked: new Set(state.checked),
      skipped: new Map(state.skipped)
    };
  }

  function restore(backup) {
    state.queue = backup.queue;
    state.selectedId = backup.selectedId;
    state.checked = backup.checked;
    state.skipped = backup.skipped;
    state.queue.forEach(p => { p.status = 'PENDING'; });
    state.issues.clear();
  }

  // Gỡ các tin khỏi hàng chờ, ghi trạng thái mới (để thống kê người bán đúng ngay)
  function takeOut(ids, newStatus) {
    state.queue.filter(p => ids.includes(p.id)).forEach(p => {
      p.status = newStatus;
      state.checked.delete(p.id);
      state.skipped.delete(p.id);
    });
    state.queue = state.queue.filter(p => !ids.includes(p.id));
    state.issues.clear();
  }

  // Tin sẽ được xem tiếp sau khi các tin `ids` rời hàng chờ:
  // tin kế tiếp trong danh sách, hết thì lùi về tin liền trước.
  function nextRemaining(ids) {
    if (!ids.includes(state.selectedId)) return state.selectedId;
    const items = visibleItems();
    const index = items.findIndex(p => p.id === state.selectedId);
    const after = items.slice(index + 1).find(p => !ids.includes(p.id));
    const before = items.slice(0, index).reverse().find(p => !ids.includes(p.id));
    const target = after || before;
    return target ? target.id : null;
  }

  // Khoá các nút thao tác trong lúc chờ API để tránh bấm hai lần
  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll('#section-pending [data-action]').forEach(button => {
      button.disabled = busy;
    });
  }

  // Sau khi API thành công: đồng bộ mục Sản phẩm (nếu đang mở) và đối chiếu lại hàng chờ
  function afterChange(job) {
    if (PU.router.currentSection() === 'products') PU.router.reload();
    if (job.reconcile) refreshQuietly();
  }

  /* ------------------------- HỘP THOẠI LÝ DO TỪ CHỐI ------------------------ */
  // Mở lại cho đúng (các) tin lần trước thì giữ chữ đã gõ, tin khác thì để trống
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
    // Thành công → lần mở sau bắt đầu với ô trống; lỗi → giữ lý do để gửi lại
    if (ok) state.rejectIds = [];
  }

  // Bấm chip → thêm / bớt câu lý do đó trong ô nhập (các lý do cách nhau bằng "; ")
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

  // Chip nào có câu lý do đang nằm trong ô nhập thì sáng lên + đếm số ký tự
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

  // Ô "chọn tất cả": tick / bỏ tick mọi tin đang hiển thị
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

  // Có tin được chọn, không vượt giới hạn của backend và không đang bận
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

  // API hàng loạt trả { processed, skipped } (số lượng hoặc danh sách id)
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
  // Phím thao tác không lặp lại khi giữ phím (tránh duyệt nhầm cả loạt tin)
  const ACTION_KEYS = { a: () => approve(), r: () => openReject(), s: skip, x: toggleCurrentCheck };
  const MOVE_KEYS = { j: next, arrowdown: next, k: prev, arrowup: prev };

  function onKeyDown(e) {
    const key = (e.key || '').toLowerCase();
    const action = MOVE_KEYS[key] || (!e.repeat && ACTION_KEYS[key]);
    if (!action || !shortcutsEnabled(e)) return;
    e.preventDefault();
    action();
  }

  // Chỉ bật phím tắt khi đang ở mục Duyệt bài, không gõ chữ, không mở hộp thoại
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
  // Bật ô "Tự làm mới" → cứ mỗi PENDING_REFRESH_MS (60 giây) tải lại hàng chờ
  function autoRefreshTick() {
    const box = $('pqAuto');
    if (box && box.checked && isOnScreen() && !document.hidden) refreshQuietly({ announce: true });
  }

  /* ------------------------------- GẮN SỰ KIỆN ------------------------------- */
  function bindEvents() {
    document.addEventListener('keydown', onKeyDown);
    $('rejectReason').addEventListener('input', syncReasonForm);
    // Ctrl + Enter (Cmd + Enter trên Mac) trong hộp thoại = bấm "Từ chối"
    $('rejectModal').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirmReject();
      }
    });
    NARROW.addEventListener('change', closeDrawer);
    setInterval(autoRefreshTick, PU.config.PENDING_REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', bindEvents);

  return {
    load, applyFilters, clearFilters,
    select, next, prev, skip, closeDrawer,
    showImage, zoom,
    approve, openReject, confirmReject, toggleReason,
    toggleCheck, toggleAll, clearChecks, bulkApprove, bulkReject
  };
})();

PU.pending = PU.modules.pending;
