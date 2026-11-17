/* =============================================================================
   Module: Tổng quan — 1 request duy nhất tới /admin/stats + 2 biểu đồ (Chart.js)
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.dashboard = (function () {
  const http = PU.http;
  const ui = PU.ui;

  const PALETTE = ['#0B6B4A', '#B4530A', '#0D5C8C', '#5B3E96', '#B42318', '#6B7A5E', '#8A6D3B', '#4F6B82'];
  const charts = {};
  let latestStats = null;
  let chartListenerBound = false;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function load() {
    const stats = await http.get('/admin/stats');
    latestStats = stats;
    showStats(stats);
    ui.setBadge('pendingBadge', stats.pendingProducts);
    if (stats.pendingReports != null) ui.setBadge('reportBadge', stats.pendingReports);
    paintCharts(stats);
  }

  function showStats(stats) {
    setText('stat-students', ui.fmtNum(stats.totalStudents));
    setText('stat-products', ui.fmtNum(stats.totalProducts));
    setText('stat-pending', ui.fmtNum(stats.pendingProducts));
    setText('stat-orders', ui.fmtNum(stats.totalOrders));
    setText('stat-approved', ui.fmtNum(stats.approvedProducts));
    setText('stat-intransaction', ui.fmtNum(stats.inTransactionProducts));
    setText('stat-sold', ui.fmtNum(stats.soldProducts));
    setText('stat-revenue', stats.totalPlatformFees != null ? ui.fmt(stats.totalPlatformFees) : '—');
  }

  /* --------------------------------- BIỂU ĐỒ --------------------------------- */
  function paintCharts(stats) {
    if (typeof window.Chart === 'undefined') {
      const script = document.getElementById('chartScript');
      if (script && !chartListenerBound) {
        chartListenerBound = true;
        script.addEventListener('load', () => {
          if (latestStats) paintCharts(latestStats);
        });
      }
      return;
    }
    drawChart('chartCategory', categoryChart(stats.productsByCategory || {}));
    drawChart('chartUniversity', universityChart(stats.productsByUniversity || {}));
  }

  function drawChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof window.Chart === 'undefined') return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new window.Chart(canvas.getContext('2d'), config);
  }

  function categoryChart(data) {
    return {
      type: 'doughnut',
      data: {
        labels: Object.keys(data),
        datasets: [{ data: Object.values(data), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 11 } } }
        }
      }
    };
  }

  function universityChart(data) {
    return {
      type: 'bar',
      data: {
        labels: Object.keys(data),
        datasets: [{ label: 'Tin đăng', data: Object.values(data), backgroundColor: '#0B6B4ACC', borderRadius: 6, maxBarThickness: 34 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#F1F2F4' } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } }
        }
      }
    };
  }

  return { load };
})();

PU.dashboard = PU.modules.dashboard;
