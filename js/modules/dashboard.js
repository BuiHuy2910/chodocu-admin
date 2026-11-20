/* =============================================================================
   Module: Tổng quan — SWR hiển thị tức thì 0ms + nạp lười (lazy-load) Chart.js
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.dashboard = (function () {
  const http = PU.http;
  const ui = PU.ui;

  const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  const PALETTE = ['#0B6B4A', '#B4530A', '#0D5C8C', '#5B3E96', '#B42318', '#6B7A5E', '#8A6D3B', '#4F6B82'];
  const charts = {};
  let latestStats = null;
  let chartPromise = null;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function applyStats(stats) {
    if (!stats) return;
    latestStats = stats;
    showStats(stats);
    ui.setBadge('pendingBadge', stats.pendingProducts);
    if (stats.pendingReports != null) ui.setBadge('reportBadge', stats.pendingReports);
    paintCharts(stats);
  }

  async function load() {
    // Hiển thị ngay bản lưu gần nhất trong 0ms nếu có, sau đó làm mới ngầm từ VPS
    const cached = http.peek('/admin/stats');
    if (cached) applyStats(cached);

    const stats = await http.get('/admin/stats');
    applyStats(stats);
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

  /* ----------------------- NẠP LƯỜI THƯ VIỆN CHART.JS ------------------------ */
  function ensureChartJs() {
    if (typeof window.Chart !== 'undefined') return Promise.resolve(true);
    if (chartPromise) return chartPromise;

    chartPromise = new Promise(resolve => {
      const script = document.createElement('script');
      script.src = CHART_CDN;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        chartPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });
    return chartPromise;
  }

  function paintCharts(stats) {
    if (typeof window.Chart === 'undefined') {
      const schedule = window.requestIdleCallback || (fn => setTimeout(fn, 60));
      schedule(() => {
        ensureChartJs().then(ok => {
          if (ok && latestStats) paintCharts(latestStats);
        });
      });
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
        animation: false,
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
        animation: false,
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
