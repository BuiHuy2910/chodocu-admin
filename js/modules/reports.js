/* =============================================================================
   Module: Báo cáo vi phạm — xem và xử lý báo cáo từ sinh viên
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.reports = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const COLUMNS = 8;

  async function load() {
    const body = $('reportsBody');
    body.innerHTML = ui.skeletonRows(COLUMNS, 4);
    const status = $('reportStatusFilter').value || 'ALL';
    try {
      const list = (await http.get(`/admin/reports?status=${encodeURIComponent(status)}`)) || [];
      updateBadge(status, list);
      body.innerHTML = list.length
        ? list.map(row).join('')
        : ui.emptyRow(COLUMNS, 'Không có báo cáo', 'Chưa có báo cáo nào khớp bộ lọc.');
    } catch (e) {
      body.innerHTML = ui.emptyRow(COLUMNS, 'Không tải được báo cáo', e.message);
    }
  }

  // Số cạnh menu = số báo cáo đang chờ xử lý
  async function updateBadge(status, list) {
    try {
      const pending = status === 'ALL' || status === 'PENDING'
        ? list.filter(r => r.status === 'PENDING')
        : (await http.get('/admin/reports?status=PENDING')) || [];
      ui.setBadge('reportBadge', pending.length);
    } catch (_) {
      // Không đếm được thì giữ số cũ
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

  // action: 'RESOLVED' (đã xử lý) | 'DISMISSED' (bác bỏ)
  async function resolve(action) {
    const id = $('resolveReportId').value;
    const note = $('resolveNote').value.trim();
    try {
      await http.put(`/admin/reports/${id}/resolve`, { action, note });
      ui.closeModal('resolveModal');
      ui.toast(action === 'RESOLVED' ? 'Đã xử lý báo cáo.' : 'Đã bác bỏ báo cáo.', 'ok');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, openResolve, resolve };
})();

PU.reports = PU.modules.reports;
