/* =============================================================================
   Module: Báo cáo vi phạm
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.reports = (function () {
  const http = PU.http;
  const ui = PU.ui;

  function row(r) {
    return '' +
      '<tr>' +
        '<td class="mono t-caption">#' + ui.esc(r.id) + '</td>' +
        '<td class="t-body">' + ui.esc(r.reporterName || '—') + '</td>' +
        '<td class="t-body truncate" style="max-width:200px">' + ui.esc(r.productTitle || '—') + '</td>' +
        '<td><span class="pu-badge pu-badge--danger pu-badge--no-dot">' + ui.esc(r.reason || '—') + '</span></td>' +
        '<td class="t-body truncate" style="max-width:240px" title="' + ui.esc(r.detail || '') + '">' + ui.esc(r.detail || '—') + '</td>' +
        '<td>' + ui.statusBadge(r.status) + '</td>' +
        '<td class="t-caption">' + (r.createdAt ? ui.fmtDate(r.createdAt) : '—') + '</td>' +
        '<td class="is-center">' +
          (r.status === 'PENDING'
            ? '<button class="pu-btn pu-btn--warn pu-btn--sm" onclick="PU.reports.openResolve(' + r.id + ')">' +
                '<span class="material-symbols-outlined">gavel</span> Xử lý</button>'
            : '<span class="t-caption">' + ui.esc(r.adminNote || '—') + '</span>') +
        '</td>' +
      '</tr>';
  }

  async function load() {
    const tbody = document.getElementById('reportsBody');
    tbody.innerHTML = ui.skeletonRows(8, 4);
    const status = document.getElementById('reportStatusFilter').value || 'ALL';

    try {
      const list = await http.get('/admin/reports?status=' + encodeURIComponent(status));

      // Badge = số báo cáo đang chờ xử lý
      try {
        const pending = status === 'PENDING' || status === 'ALL'
          ? (list || []).filter(x => x.status === 'PENDING').length
          : (await http.get('/admin/reports?status=PENDING')).length;
        ui.setBadge('reportBadge', pending);
      } catch (_) { /* không quan trọng */ }

      if (!list || list.length === 0) {
        tbody.innerHTML = ui.emptyRow(8, 'Không có báo cáo', 'Chưa có báo cáo nào khớp bộ lọc.');
        return;
      }
      tbody.innerHTML = list.map(row).join('');
    } catch (e) {
      tbody.innerHTML = ui.emptyRow(8, 'Lỗi tải báo cáo', e.message);
    }
  }

  function openResolve(id) {
    document.getElementById('resolveReportId').value = id;
    document.getElementById('resolveNote').value = '';
    ui.openModal('resolveModal');
    setTimeout(() => document.getElementById('resolveNote').focus(), 50);
  }

  async function resolve(action) {
    const id = document.getElementById('resolveReportId').value;
    const note = (document.getElementById('resolveNote').value || '').trim();

    try {
      await http.put('/admin/reports/' + id + '/resolve', { action, note });
      ui.closeModal('resolveModal');
      ui.toast(action === 'RESOLVED' ? 'Đã xử lý báo cáo.' : 'Đã bác bỏ báo cáo.', 'ok');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, openResolve, resolve };
})();
