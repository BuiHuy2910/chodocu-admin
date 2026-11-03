/* =============================================================================
   Module: Dashboard
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.dashboard = (function () {
  const http = PU.http;
  const ui = PU.ui;

  let chartCategory = null;
  let chartUniversity = null;

  const PALETTE = ['#0B6B4A', '#B4530A', '#0D5C8C', '#5B3E96', '#B42318', '#6B7A5E', '#8A6D3B', '#4F6B82'];

  function hasChartJs() { return typeof window.Chart !== 'undefined'; }

  function renderCategory(data) {
    const el = document.getElementById('chartCategory');
    if (!el || !hasChartJs()) return;
    if (chartCategory) chartCategory.destroy();
    chartCategory = new Chart(el.getContext('2d'), {
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
    });
  }

  function renderUniversity(data) {
    const el = document.getElementById('chartUniversity');
    if (!el || !hasChartJs()) return;
    if (chartUniversity) chartUniversity.destroy();
    chartUniversity = new Chart(el.getContext('2d'), {
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
    });
  }

  async function load() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    try {
      const [stats, fin] = await Promise.all([
        http.get('/admin/stats'),
        http.get('/admin/financial').catch(() => null)
      ]);

      set('stat-students', ui.fmtNum(stats.totalStudents));
      set('stat-products', ui.fmtNum(stats.totalProducts));
      set('stat-pending', ui.fmtNum(stats.pendingProducts));
      set('stat-orders', ui.fmtNum(stats.totalOrders));
      set('stat-approved', ui.fmtNum(stats.approvedProducts));
      set('stat-intransaction', ui.fmtNum(stats.inTransactionProducts));
      set('stat-sold', ui.fmtNum(stats.soldProducts));
      set('stat-revenue', fin ? ui.fmt(fin.totalPlatformFees) : '—');

      ui.setBadge('pendingBadge', stats.pendingProducts);

      renderCategory(stats.productsByCategory || {});
      renderUniversity(stats.productsByUniversity || {});
    } catch (e) {
      ui.toast('Không tải được thống kê: ' + e.message, 'error');
    }
  }

  return { load };
})();
