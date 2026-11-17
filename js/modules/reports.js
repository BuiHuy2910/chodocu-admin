/* =============================================================================
   Module: Báo cáo vi phạm — phân trang server-side + đếm badge sẵn trong meta
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.reports = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const COLUMNS = 8;

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

  async function load() {
    if (aborter) aborter.abort();
    aborter = new AbortController();

    const body = $('reportsBody');
    body.innerHTML = ui.skeletonRows(COLUMNS, 4);
    const status = $('reportStatusFilter').value || 'ALL';
    const keyword = ($('reportSearch') && $('reportSearch').value.trim()) || '';

    try {
      const data = await http.get('/admin/reports' + http.query({ status, keyword, page, size }), {
        signal: aborter.signal
      });
      const list = (data && data.content) || [];
      if (data && data.meta && data.meta.pendingCount != null) {
        ui.setBadge('reportBadge', data.meta.pendingCount);
      }
      body.innerHTML = list.length
        ? list.map(row).join('')
        : ui.emptyRow(COLUMNS, 'Không có báo cáo', 'Chưa có báo cáo nào khớp bộ lọc.');

      ui.renderPager('reportsPager', data, {
        unit: 'báo cáo',
        onPage: next => { page = next; load(); },
        onSize: nextSize => { size = nextSize; page = 0; load(); }
      });
    } catch (e) {
      if (e && e.aborted) return;
      body.innerHTML = ui.emptyRow(COLUMNS, 'Không tải được báo cáo', e.message);
      ui.renderPager('reportsPager', null);
    }
  }

  function row(r) {
    const action = r.status === 'PENDING'
      ? `<button class="pu-btn pu-btn--warn pu-btn--sm" onclick="PU.reports.openResolve(${Number(r.id)})">
           <span class="material-symbols-outlined">gavel</span> Xử lý
         </button>`
      : `<span class="t-caption">${esc(r.adminNote || '—')}</span>`;
    return `
      <tr>
        <td class="mono t-caption">#${esc(r.id)}</td>
        <td class="t-body">${esc(r.reporterName || '—')}</td>
        <td class="t-body pu-cell-wide truncate">${esc(r.productTitle || '—')}</td>
        <td><span class="pu-badge pu-badge--danger pu-badge--no-dot">${esc(r.reason || '—')}</span></td>
        <td class="t-body pu-cell-wide truncate" title="${esc(r.detail || '')}">${esc(r.detail || '—')}</td>
        <td>${ui.statusBadge(r.status)}</td>
        <td class="t-caption">${ui.fmtDate(r.createdAt)}</td>
        <td class="is-center">${action}</td>
      </tr>`;
  }

  function openResolve(id) {
    $('resolveReportId').value = id;
    $('resolveNote').value = '';
    ui.openModal('resolveModal');
    setTimeout(() => $('resolveNote').focus(), 50);
  }

  async function resolve(action) {
    const id = $('resolveReportId').value;
    const note = $('resolveNote').value.trim();
    try {
      await http.put(`/admin/reports/${id}/resolve`, { action, note });
      ui.closeModal('resolveModal');
      ui.toast(action === 'RESOLVED' ? 'Đã xử lý báo cáo.' : 'Đã bác bỏ báo cáo.', 'ok');
      PU.router.invalidate('dashboard');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, onSearch, onFilterChange, openResolve, resolve };
})();

PU.reports = PU.modules.reports;
