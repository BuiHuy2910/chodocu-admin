// =============================================================================
// PassUni Admin JS v2.0
// Không có dữ liệu fix cứng — tất cả lấy từ API backend
// =============================================================================

const API_BASE = 'http://localhost:8080/api';
let adminToken = localStorage.getItem('passuni_admin_token') || '';
let currentUserRole = localStorage.getItem('passuni_admin_role') || '';
let currentSection = 'dashboard';
let allProducts = [];
let allUsers = [];
let chartCategory = null;
let chartUniversity = null;
let financialData = null;

// =============================================================================
// UTILITY
// =============================================================================
function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}
function fmtNum(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(n);
}
function fmtPct(v) {
  if (!v && v !== 0) return '—';
  return (parseFloat(v) * 100).toFixed(1) + '%';
}

function statusBadge(status) {
  const map = {
    PENDING:        '<span class="badge bg-amber-100 text-amber-700">⏳ Chờ duyệt</span>',
    APPROVED:       '<span class="badge bg-emerald-100 text-emerald-700">✅ Đã duyệt</span>',
    REJECTED:       '<span class="badge bg-red-100 text-red-700">❌ Từ chối</span>',
    IN_TRANSACTION: '<span class="badge bg-violet-100 text-violet-700">🔄 Giao dịch</span>',
    SOLD:           '<span class="badge bg-slate-100 text-slate-600">💰 Đã bán</span>',
    HIDDEN:         '<span class="badge bg-slate-100 text-slate-500">🙈 Ẩn</span>',
    ACCEPTED:       '<span class="badge bg-campus-light text-campus">✔ Đã xác nhận</span>',
    IN_PROGRESS:    '<span class="badge bg-violet-100 text-violet-700">🚚 Đang giao</span>',
    COMPLETED:      '<span class="badge bg-emerald-100 text-emerald-700">🎉 Hoàn thành</span>',
    CANCELLED:      '<span class="badge bg-red-100 text-red-700">🚫 Đã huỷ</span>',
    DISPUTED:       '<span class="badge bg-orange-100 text-orange-700">⚠️ Tranh chấp</span>',
  };
  return map[status] || `<span class="badge bg-slate-100 text-slate-600">${status}</span>`;
}

function roleBadge(role) {
  const map = {
    ADMIN:     '<span class="badge bg-red-100 text-red-700">👑 Admin</span>',
    MODERATOR: '<span class="badge bg-violet-100 text-violet-700">🛡 Mod</span>',
    STUDENT:   '<span class="badge bg-campus-light text-campus">🎓 Sinh viên</span>',
  };
  return map[role] || `<span class="badge bg-slate-100 text-slate-600">${role || '—'}</span>`;
}

function reportStatusBadge(s) {
  const map = {
    PENDING:   '<span class="badge bg-amber-100 text-amber-700">⏳ Chờ xử lý</span>',
    RESOLVED:  '<span class="badge bg-emerald-100 text-emerald-700">✅ Đã xử lý</span>',
    DISMISSED: '<span class="badge bg-slate-100 text-slate-500">🚫 Bác bỏ</span>',
  };
  return map[s] || `<span class="badge bg-slate-100 text-slate-600">${s}</span>`;
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.className = `toast show ${type === 'error' ? 'bg-red-600' : type === 'warn' ? 'bg-amber-500' : 'bg-emerald-600'}`;
  el.textContent = msg;
  setTimeout(() => { el.className = 'toast bg-emerald-600'; }, 3000);
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id)  { document.getElementById(id).classList.add('open'); }

// =============================================================================
// AUTH
// =============================================================================
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Sai email hoặc mật khẩu');

    const user = data.data || data;
    const token = user.accessToken || user.token;
    const role  = user.user?.role || user.role || '';

    if (!['ADMIN', 'MODERATOR'].includes(role)) {
      throw new Error('Bạn không có quyền truy cập trang quản trị.');
    }

    adminToken = token;
    currentUserRole = role;
    localStorage.setItem('passuni_admin_token', token);
    localStorage.setItem('passuni_admin_role', role);

    document.getElementById('sidebarName').textContent = user.user?.fullName || email;
    document.getElementById('sidebarRole').textContent = role;
    if (user.user?.avatarUrl) {
      document.getElementById('sidebarAvatar').src = user.user.avatarUrl;
    }

    // Hide settings-only items for MODERATOR
    if (role === 'MODERATOR') {
      document.querySelectorAll('[onclick*="settings"], [onclick*="financial"]').forEach(el => {
        // keep financial visible for moderators, hide settings tab for non-admin is optional
      });
    }

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    await loadDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function doLogout() {
  adminToken = '';
  currentUserRole = '';
  localStorage.removeItem('passuni_admin_token');
  localStorage.removeItem('passuni_admin_role');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

// Auto-restore session
if (adminToken) {
  fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${adminToken}` } })
    .then(r => r.json())
    .then(data => {
      const user = data.data || data;
      const role = user.role || '';
      if (['ADMIN', 'MODERATOR'].includes(role)) {
        document.getElementById('sidebarName').textContent = user.fullName || 'Admin';
        document.getElementById('sidebarRole').textContent = role;
        if (user.avatarUrl) document.getElementById('sidebarAvatar').src = user.avatarUrl;
        currentUserRole = role;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        loadDashboard();
      } else { doLogout(); }
    })
    .catch(() => doLogout());
}

// =============================================================================
// API HELPER
// =============================================================================
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Lỗi server');
  return data.data !== undefined ? data.data : data;
}

// =============================================================================
// NAVIGATION
// =============================================================================
function switchSection(name) {
  currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll(`.sidebar-item[onclick*="'${name}'"]`).forEach(el => el.classList.add('active'));

  const titles = {
    dashboard: ['Tổng quan', 'PassUni Admin Dashboard'],
    pending:   ['Duyệt bài đăng', 'Hàng chờ phê duyệt từ sinh viên'],
    products:  ['Quản lý sản phẩm', 'Toàn bộ sản phẩm trên sàn'],
    orders:    ['Quản lý đơn hàng', 'Theo dõi giao dịch mua bán'],
    financial: ['Tài chính & Phí sàn', 'Doanh thu và cấu hình phí'],
    users:     ['Người dùng', 'Quản lý tài khoản sinh viên'],
    reports:   ['Báo cáo vi phạm', 'Xem xét và xử lý báo cáo'],
    settings:  ['Cài đặt hệ thống', 'Cấu hình toàn hệ thống'],
  };
  const [title, sub] = titles[name] || ['—', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = sub;
  document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString('vi-VN');

  const loaders = { dashboard: loadDashboard, pending: loadPending, products: loadProducts, orders: loadOrders, financial: loadFinancial, users: loadUsers, reports: loadReports, settings: loadSettings };
  if (loaders[name]) loaders[name]();
}

function refreshCurrentSection() { switchSection(currentSection); }

// =============================================================================
// DASHBOARD
// =============================================================================
async function loadDashboard() {
  try {
    const [stats, fin] = await Promise.all([
      api('/admin/stats'),
      api('/admin/financial').catch(() => null)
    ]);

    document.getElementById('stat-students').textContent     = fmtNum(stats.totalStudents);
    document.getElementById('stat-products').textContent     = fmtNum(stats.totalProducts);
    document.getElementById('stat-pending').textContent      = fmtNum(stats.pendingProducts);
    document.getElementById('stat-orders').textContent       = fmtNum(stats.totalOrders);
    document.getElementById('stat-approved').textContent     = fmtNum(stats.approvedProducts);
    document.getElementById('stat-intransaction').textContent = fmtNum(stats.inTransactionProducts);
    document.getElementById('stat-sold').textContent         = fmtNum(stats.soldProducts);
    document.getElementById('stat-revenue').textContent      = fin ? fmt(fin.totalPlatformFees) : '—';

    // Update badges
    if (stats.pendingProducts > 0) {
      document.getElementById('pendingBadge').textContent = stats.pendingProducts;
      document.getElementById('pendingBadge').classList.remove('hidden');
    }

    // Charts
    renderCategoryChart(stats.productsByCategory || {});
    renderUniversityChart(stats.productsByUniversity || {});
  } catch (err) {
    showToast('Không thể tải thống kê: ' + err.message, 'error');
  }
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('chartCategory').getContext('2d');
  if (chartCategory) chartCategory.destroy();
  const colors = ['#006948','#EA580C','#0284C7','#D97706','#7C3AED','#E11D48','#059669','#0EA5E9'];
  chartCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } }
  });
}

function renderUniversityChart(data) {
  const ctx = document.getElementById('chartUniversity').getContext('2d');
  if (chartUniversity) chartUniversity.destroy();
  chartUniversity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(data),
      datasets: [{ label: 'Sản phẩm', data: Object.values(data), backgroundColor: '#006948cc', borderRadius: 8 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

// =============================================================================
// PENDING APPROVAL
// =============================================================================
async function loadPending() {
  const grid = document.getElementById('pendingGrid');
  grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400"><span class="material-symbols-outlined text-5xl mb-2 block spin">sync</span>Đang tải hàng chờ duyệt...</div>';
  try {
    const products = await api('/admin/products?status=PENDING');
    if (!products || products.length === 0) {
      grid.innerHTML = '<div class="col-span-3 text-center py-16 text-slate-400"><span class="material-symbols-outlined text-6xl block mb-3 text-emerald-300">task_alt</span><div class="font-semibold">Tất cả đã được duyệt!</div><div class="text-sm mt-1">Không còn bài nào chờ duyệt.</div></div>';
      return;
    }
    grid.innerHTML = products.map(p => `
      <div class="card hover:shadow-md transition-shadow flex flex-col gap-3">
        <div class="relative">
          <img src="${p.imageUrls?.[0] || 'https://via.placeholder.com/400x220?text=No+Image'}"
               onerror="this.src='https://via.placeholder.com/400x220?text=No+Image'"
               class="w-full h-44 object-cover rounded-xl bg-slate-100" />
          ${p.isUrgent ? '<span class="absolute top-2 left-2 badge bg-coral text-white">🔥 Gấp</span>' : ''}
        </div>
        <div class="flex-1">
          <div class="font-semibold text-slate-800 line-clamp-2 text-sm leading-snug">${p.title}</div>
          <div class="text-xs text-slate-500 mt-1">${p.description ? p.description.substring(0, 100) + '...' : ''}</div>
          <div class="mt-2 flex items-center justify-between">
            <div class="font-bold text-primary">${fmt(p.price)}</div>
            <div class="text-xs text-slate-400 line-through">${p.originalPrice ? fmt(p.originalPrice) : ''}</div>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500">
            <div class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">person</span>${p.seller?.fullName || '—'}</div>
            <div class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">school</span>${p.universityShortName || p.university?.shortName || '—'}</div>
            <div class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">category</span>${p.categoryName || p.category?.name || '—'}</div>
            <div class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">sell</span>${p.itemCondition || '—'}</div>
          </div>
          ${p.pickupSpot ? `<div class="text-xs text-slate-500 mt-1 flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span>${p.pickupSpot}</div>` : ''}
        </div>
        <div class="flex gap-2 pt-2 border-t border-slate-100">
          <button onclick="viewProduct(${p.id})" class="btn btn-ghost flex-1 text-xs py-1.5 justify-center">
            <span class="material-symbols-outlined text-sm">visibility</span> Xem
          </button>
          <button onclick="approveProduct(${p.id})" class="btn btn-success flex-1 text-xs py-1.5 justify-center">
            <span class="material-symbols-outlined text-sm">check_circle</span> Duyệt
          </button>
          <button onclick="openRejectModal(${p.id})" class="btn btn-danger flex-1 text-xs py-1.5 justify-center">
            <span class="material-symbols-outlined text-sm">block</span> Từ chối
          </button>
        </div>
      </div>
    `).join('');
    // Update badge
    document.getElementById('pendingBadge').textContent = products.length;
    document.getElementById('pendingBadge').classList.remove('hidden');
  } catch (err) {
    grid.innerHTML = `<div class="col-span-3 text-center py-12 text-red-400">Lỗi: ${err.message}</div>`;
  }
}

async function approveProduct(id) {
  try {
    await api(`/admin/products/${id}/approve`, 'PUT');
    showToast('✅ Đã duyệt bài đăng!');
    loadPending();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

function openRejectModal(id) {
  document.getElementById('rejectProductId').value = id;
  document.getElementById('rejectReason').value = '';
  openModal('rejectModal');
}

async function confirmReject() {
  const id     = document.getElementById('rejectProductId').value;
  const reason = document.getElementById('rejectReason').value.trim();
  try {
    await api(`/admin/products/${id}/reject`, 'PUT', { reason });
    showToast('❌ Đã từ chối tin đăng!', 'warn');
    closeModal('rejectModal');
    loadPending();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

// =============================================================================
// ALL PRODUCTS
// =============================================================================
async function loadProducts() {
  const statusFilter = document.getElementById('productStatusFilter').value;
  document.getElementById('productsBody').innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400"><span class="material-symbols-outlined spin">sync</span> Đang tải...</td></tr>';
  try {
    const url = statusFilter ? `/admin/products?status=${statusFilter}` : '/admin/products';
    allProducts = await api(url);
    renderProductsTable(allProducts);
  } catch (err) {
    document.getElementById('productsBody').innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-400">Lỗi: ${err.message}</td></tr>`;
  }
}

function filterProducts() {
  const q = document.getElementById('productSearch').value.toLowerCase();
  renderProductsTable(allProducts.filter(p =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.seller?.fullName || '').toLowerCase().includes(q) ||
    (p.categoryName || p.category?.name || '').toLowerCase().includes(q)
  ));
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsBody');
  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Không có sản phẩm nào.</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td>
        <div class="flex items-center gap-3">
          <img src="${p.imageUrls?.[0] || 'https://via.placeholder.com/48'}" onerror="this.src='https://via.placeholder.com/48'"
               class="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
          <div>
            <div class="font-medium text-slate-800 max-w-xs truncate text-sm">${p.title}</div>
            <div class="text-xs text-slate-400">${p.isFree ? '🎁 Miễn phí' : ''} ${p.isUrgent ? '🔥 Urgent' : ''}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="text-sm font-medium">${p.seller?.fullName || '—'}</div>
        <div class="text-xs text-slate-400">${p.seller?.email || ''}</div>
      </td>
      <td class="font-semibold text-primary text-sm">${fmt(p.price)}</td>
      <td class="text-sm text-slate-600">${p.categoryName || p.category?.name || '—'}</td>
      <td>${statusBadge(p.status)}</td>
      <td class="text-xs text-slate-400">${p.createdAt || '—'}</td>
      <td class="text-center">
        <div class="flex items-center justify-center gap-1">
          <button onclick="viewProduct(${p.id})" class="btn btn-ghost text-xs py-1 px-2">
            <span class="material-symbols-outlined text-sm">visibility</span>
          </button>
          ${p.status === 'PENDING' ? `
            <button onclick="approveProduct(${p.id})" class="btn btn-success text-xs py-1 px-2">
              <span class="material-symbols-outlined text-sm">check</span>
            </button>
            <button onclick="openRejectModal(${p.id})" class="btn btn-danger text-xs py-1 px-2">
              <span class="material-symbols-outlined text-sm">block</span>
            </button>` : ''}
          <button onclick="deleteProduct(${p.id})" class="btn btn-ghost text-red-400 hover:text-red-600 text-xs py-1 px-2">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function deleteProduct(id) {
  if (!confirm('Xác nhận xóa sản phẩm này khỏi hệ thống?')) return;
  try {
    await api(`/admin/products/${id}`, 'DELETE');
    showToast('🗑️ Đã xóa sản phẩm!', 'warn');
    loadProducts();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

async function viewProduct(id) {
  try {
    const p = await api(`/products/${id}`);
    document.getElementById('productModalContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${(p.imageUrls || []).map(url => `<img src="${url}" class="h-48 w-auto rounded-xl object-cover flex-shrink-0" />`).join('') || '<div class="h-48 w-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">Không có ảnh</div>'}
        </div>
        <div>
          <div class="flex items-start justify-between gap-3 mb-2">
            <h2 class="font-bold text-lg text-slate-800">${p.title}</h2>
            ${statusBadge(p.status)}
          </div>
          <div class="text-2xl font-bold text-primary">${fmt(p.price)} ${p.originalPrice ? `<span class="text-sm font-normal text-slate-400 line-through ml-2">${fmt(p.originalPrice)}</span>` : ''}</div>
        </div>
        <div class="text-sm text-slate-600 leading-relaxed">${p.description || ''}</div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-50 p-3 rounded-xl"><div class="text-xs text-slate-400 mb-1">Người bán</div><div class="font-medium">${p.seller?.fullName || '—'}</div></div>
          <div class="bg-slate-50 p-3 rounded-xl"><div class="text-xs text-slate-400 mb-1">Danh mục</div><div class="font-medium">${p.categoryName || p.category?.name || '—'}</div></div>
          <div class="bg-slate-50 p-3 rounded-xl"><div class="text-xs text-slate-400 mb-1">Tình trạng</div><div class="font-medium">${p.conditionLabel || p.itemCondition || '—'}</div></div>
          <div class="bg-slate-50 p-3 rounded-xl"><div class="text-xs text-slate-400 mb-1">Lý do pass</div><div class="font-medium">${p.passReason || '—'}</div></div>
          <div class="bg-slate-50 p-3 rounded-xl"><div class="text-xs text-slate-400 mb-1">Địa điểm gặp</div><div class="font-medium">${p.pickupSpot || '—'}</div></div>
          <div class="bg-slate-50 p-3 rounded-xl"><div class="text-xs text-slate-400 mb-1">Ngày đăng</div><div class="font-medium">${p.createdAt || '—'}</div></div>
        </div>
        ${p.status === 'PENDING' ? `
          <div class="flex gap-3 pt-4 border-t">
            <button onclick="approveProduct(${p.id}); closeModal('productModal')" class="btn btn-success flex-1 justify-center">✅ Duyệt bài</button>
            <button onclick="closeModal('productModal'); openRejectModal(${p.id})" class="btn btn-danger flex-1 justify-center">❌ Từ chối</button>
          </div>` : ''}
        ${p.rejectReason ? `<div class="bg-red-50 border border-red-200 p-3 rounded-xl text-sm text-red-700"><strong>Lý do từ chối:</strong> ${p.rejectReason}</div>` : ''}
      </div>
    `;
    openModal('productModal');
  } catch (err) { showToast('Lỗi tải chi tiết: ' + err.message, 'error'); }
}

// =============================================================================
// ORDERS
// =============================================================================
async function loadOrders() {
  const statusFilter = document.getElementById('orderStatusFilter').value;
  document.getElementById('ordersBody').innerHTML = '<tr><td colspan="10" class="text-center py-8 text-slate-400"><span class="material-symbols-outlined spin">sync</span> Đang tải...</td></tr>';
  try {
    const orders = await api('/admin/orders' + (statusFilter ? `?status=${statusFilter}` : ''));
    const tbody = document.getElementById('ordersBody');
    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-slate-400">Không có đơn hàng.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => {
      const canAccept = o.status === 'PENDING' || o.status === 'DISPUTED';
      const canComplete = o.status === 'ACCEPTED' || o.status === 'PENDING' || o.status === 'DISPUTED';
      const canCancel = !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status);
      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="font-mono text-xs text-slate-500">${o.orderCode || '#' + o.id}</td>
        <td class="text-sm font-medium max-w-[150px] truncate">${o.product?.title || '—'}</td>
        <td class="text-sm">${o.buyer?.fullName || '—'}</td>
        <td class="text-sm">${o.seller?.fullName || '—'}</td>
        <td class="font-semibold text-slate-800 text-sm">${fmt(o.offeredPrice)}</td>
        <td class="text-gold font-medium text-sm">${o.platformFeeAmount ? fmt(o.platformFeeAmount) : '—'}</td>
        <td class="text-primary font-medium text-sm">${o.finalSellerAmount ? fmt(o.finalSellerAmount) : '—'}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="text-xs text-slate-400">${o.createdAt || '—'}</td>
        <td class="text-center">
          <div class="flex items-center justify-center gap-1">
            ${canAccept ? `<button onclick="adminUpdateOrder(${o.id}, 'ACCEPTED')" class="btn btn-ghost text-xs py-1 px-2" title="Duyệt đơn"><span class="material-symbols-outlined text-sm">check_circle</span></button>` : ''}
            ${canComplete ? `<button onclick="adminUpdateOrder(${o.id}, 'COMPLETED')" class="btn btn-success text-xs py-1 px-2" title="Hoàn tất"><span class="material-symbols-outlined text-sm">done_all</span></button>` : ''}
            ${canCancel ? `<button onclick="adminUpdateOrder(${o.id}, 'CANCELLED')" class="btn btn-danger text-xs py-1 px-2" title="Hủy đơn"><span class="material-symbols-outlined text-sm">cancel</span></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    document.getElementById('ordersBody').innerHTML = `<tr><td colspan="10" class="text-center py-8 text-red-400">Lỗi: ${err.message}</td></tr>`;
  }
}

async function adminUpdateOrder(id, status) {
  const labels = { ACCEPTED: 'duyệt', COMPLETED: 'hoàn tất', CANCELLED: 'hủy' };
  const note = prompt(`Ghi chú khi ${labels[status] || 'cập nhật'} đơn (không bắt buộc):`, '');
  if (note === null) return;
  try {
    await api(`/admin/orders/${id}/status`, 'PUT', { status, note });
    showToast('✅ Đã cập nhật đơn hàng!');
    loadOrders();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

// =============================================================================
// FINANCIAL
// =============================================================================
async function loadFinancial() {
  try {
    const fin = await api('/admin/financial');
    financialData = fin;

    document.getElementById('fin-totalFee').textContent       = fmt(fin.totalPlatformFees);
    document.getElementById('fin-totalValue').textContent     = fmt(fin.totalTransactionValue);
    document.getElementById('fin-totalCompleted').textContent = fmtNum(fin.totalCompletedOrders) + ' đơn';

    const rate = parseFloat(fin.currentFeeRate || 0);
    document.getElementById('curFeeRate').textContent   = (rate * 100).toFixed(1) + '%';
    document.getElementById('curMinFee').textContent    = fmt(fin.minFee);
    document.getElementById('curMaxFee').textContent    = fmt(fin.maxFee);
    document.getElementById('feeRate').value            = (rate * 100).toFixed(1);
    document.getElementById('minFee').value             = fin.minFee || '';
    document.getElementById('maxFee').value             = fin.maxFee || '';

    const enabled = fin.feeEnabled !== false;
    document.getElementById('feeStatusBadge').textContent = enabled ? '● Đang thu phí' : '○ Miễn phí';
    document.getElementById('feeStatusBadge').className   = `ml-auto badge ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;
    if (fin.feePayer && document.getElementById('feePayer')) {
      document.getElementById('feePayer').value = fin.feePayer;
    }

    updateFeePreviews(rate, parseFloat(fin.minFee || 2000), parseFloat(fin.maxFee || 50000), enabled);
    refreshFeePreviews();
    loadFeeTiers();

    // Transactions table
    const rows = (fin.recentTransactions || []).map(t => `
      <tr class="hover:bg-slate-50">
        <td class="font-mono text-xs">#${t.id}</td>
        <td class="text-sm max-w-[150px] truncate font-medium">${t.productTitle || '—'}</td>
        <td class="text-sm">${t.buyerName || '—'}</td>
        <td class="text-sm">${t.sellerName || '—'}</td>
        <td class="font-semibold text-sm">${fmt(t.transactionAmount)}</td>
        <td class="text-xs text-slate-500">${fmtPct(t.platformFeeRate)}</td>
        <td class="text-gold font-semibold text-sm">${fmt(t.platformFeeAmount)}</td>
        <td class="text-primary font-semibold text-sm">${fmt(t.sellerReceiveAmount)}</td>
        <td class="text-xs text-slate-400">${t.createdAt || '—'}</td>
      </tr>
    `).join('');
    document.getElementById('transactionBody').innerHTML = rows || '<tr><td colspan="9" class="text-center py-8 text-slate-400">Chưa có giao dịch nào.</td></tr>';
  } catch (err) {
    showToast('Lỗi tải tài chính: ' + err.message, 'error');
  }
}

function updateFeePreviews(rate, minFee, maxFee, enabled) {
  function calcFee(amount) {
    if (!enabled) return 0;
    let fee = Math.round(amount * rate);
    if (fee < minFee) fee = minFee;
    if (fee > maxFee) fee = maxFee;
    return fee;
  }
  [50000, 500000, 2000000].forEach((amount, i) => {
    const ids = ['50k', '500k', '2m'];
    const fee = calcFee(amount);
    document.getElementById(`preview${ids[i]}`).textContent = fmt(fee);
    document.getElementById(`preview${ids[i]}Seller`).textContent = fmt(amount - fee);
  });
}

async function updateSetting(key, value) {
  if (!value || value.trim() === '' || isNaN(parseFloat(value))) {
    showToast('Giá trị không hợp lệ!', 'error'); return;
  }
  try {
    await api(`/admin/settings/${key}`, 'PUT', { value });
    showToast('✅ Đã cập nhật cài đặt!');
    loadFinancial();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

async function toggleFee() {
  const current = financialData?.feeEnabled !== false;
  const newVal = !current;
  try {
    await api('/admin/settings/fee_enabled', 'PUT', { value: newVal.toString() });
    showToast(newVal ? '✅ Đã bật thu phí sàn!' : '🔕 Đã tắt thu phí (miễn phí)!', newVal ? 'success' : 'warn');
    loadFinancial();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

// =============================================================================
// FEE TIERS
// =============================================================================
let feeTiers = [];

async function loadFeeTiers() {
  try {
    feeTiers = await api('/admin/fee-tiers');
    renderFeeTiers();
  } catch (err) {
    const el = document.getElementById('feeTiersBody');
    if (el) el.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-400">Lỗi tải bậc phí: ${err.message}</td></tr>`;
  }
}

function renderFeeTiers() {
  const tbody = document.getElementById('feeTiersBody');
  if (!tbody) return;
  if (!feeTiers || feeTiers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">Chưa có bậc phí nào (đang dùng tỷ lệ cơ bản).</td></tr>';
    return;
  }
  tbody.innerHTML = feeTiers.map(t => `
    <tr class="hover:bg-slate-50">
      <td class="text-sm font-medium">${t.name}</td>
      <td class="text-sm">${fmt(t.minAmount)}</td>
      <td class="text-sm">${t.maxAmount != null ? fmt(t.maxAmount) : '∞'}</td>
      <td class="text-sm font-semibold text-gold">${(parseFloat(t.feeRate) * 100).toFixed(1)}%</td>
      <td class="text-sm">${t.priority ?? 0}</td>
      <td>${t.active ? '<span class="badge bg-emerald-100 text-emerald-700">Đang áp dụng</span>' : '<span class="badge bg-slate-100 text-slate-500">Đã tắt</span>'}</td>
      <td class="text-center">
        <div class="flex justify-center gap-1">
          <button onclick="openTierModal(${t.id})" class="btn btn-ghost text-xs py-1 px-2"><span class="material-symbols-outlined text-sm">edit</span></button>
          ${t.active ? `<button onclick="deleteTier(${t.id})" class="btn btn-ghost text-red-400 text-xs py-1 px-2"><span class="material-symbols-outlined text-sm">block</span></button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function openTierModal(id) {
  const t = id ? feeTiers.find(x => x.id === id) : null;
  document.getElementById('tierId').value = t ? t.id : '';
  document.getElementById('tierName').value = t ? t.name : '';
  document.getElementById('tierMin').value = t ? t.minAmount : 0;
  document.getElementById('tierMax').value = t && t.maxAmount != null ? t.maxAmount : '';
  document.getElementById('tierRate').value = t ? (parseFloat(t.feeRate) * 100) : 3;
  document.getElementById('tierPriority').value = t ? (t.priority ?? 10) : 10;
  openModal('tierModal');
}

async function saveTier() {
  const id = document.getElementById('tierId').value;
  const maxRaw = document.getElementById('tierMax').value;
  const body = {
    name: document.getElementById('tierName').value.trim(),
    minAmount: parseFloat(document.getElementById('tierMin').value || 0),
    maxAmount: maxRaw === '' ? null : parseFloat(maxRaw),
    feeRate: parseFloat(document.getElementById('tierRate').value || 0) / 100,
    priority: parseInt(document.getElementById('tierPriority').value || 0, 10),
    active: true
  };
  if (!body.name) { showToast('Nhập tên bậc phí!', 'error'); return; }
  try {
    if (id) await api(`/admin/fee-tiers/${id}`, 'PUT', body);
    else await api('/admin/fee-tiers', 'POST', body);
    showToast('✅ Đã lưu bậc phí!');
    closeModal('tierModal');
    loadFeeTiers();
    loadFinancial();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

async function deleteTier(id) {
  if (!confirm('Tắt bậc phí này? (Không xóa để giữ lịch sử đối chiếu)')) return;
  try {
    await api(`/admin/fee-tiers/${id}`, 'DELETE');
    showToast('Đã tắt bậc phí!', 'warn');
    loadFeeTiers();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

/** Gọi backend để xem trước phí (tôn trọng bậc phí + min/max + làm tròn). */
async function refreshFeePreviews() {
  for (const [amount, key] of [[50000, '50k'], [500000, '500k'], [2000000, '2m']]) {
    try {
      const p = await api(`/admin/fee/preview?amount=${amount}`);
      const feeEl = document.getElementById(`preview${key}`);
      const sellerEl = document.getElementById(`preview${key}Seller`);
      if (feeEl) feeEl.textContent = fmt(p.platformFeeAmount);
      if (sellerEl) sellerEl.textContent = fmt(p.sellerReceiveAmount);
    } catch (_) { /* bỏ qua */ }
  }
}

// =============================================================================
// USERS
// =============================================================================
async function loadUsers() {
  document.getElementById('usersBody').innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-400"><span class="material-symbols-outlined spin">sync</span> Đang tải...</td></tr>';
  try {
    allUsers = await api('/admin/users');
    filterUsers();
  } catch (err) {
    document.getElementById('usersBody').innerHTML = `<tr><td colspan="9" class="text-center py-8 text-red-400">Lỗi: ${err.message}</td></tr>`;
  }
}

function filterUsers() {
  const q    = (document.getElementById('userSearch').value || '').toLowerCase();
  const role = document.getElementById('userRoleFilter').value;
  const filtered = allUsers.filter(u =>
    (!role || u.role === role) &&
    (!q || (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  );
  renderUsersTable(filtered);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-400">Không tìm thấy người dùng.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-slate-50 transition-colors ${u.active === false ? 'opacity-50' : ''}">
      <td>
        <div class="flex items-center gap-3">
          <img src="${u.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${u.email}`}"
               onerror="this.src='https://api.dicebear.com/7.x/notionists/svg?seed=default'"
               class="w-9 h-9 rounded-full object-cover bg-slate-100" />
          <div>
            <div class="font-medium text-sm text-slate-800">${u.fullName || '—'}</div>
            <div class="text-xs text-slate-400">${u.dormArea || ''}</div>
          </div>
        </div>
      </td>
      <td class="text-xs text-slate-600">${u.email || '—'}</td>
      <td class="text-xs font-mono text-slate-500">${u.studentId || '—'}</td>
      <td class="text-xs text-slate-600">${u.universityShortName || u.university?.shortName || '—'}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.verifiedStudent ? '<span class="badge bg-emerald-100 text-emerald-700">✅ Đã xác thực</span>' : '<span class="badge bg-slate-100 text-slate-500">○ Chưa</span>'}</td>
      <td class="text-sm">⭐ ${u.rating?.toFixed(1) || '5.0'}</td>
      <td class="text-sm text-center">${u.completedDeals || 0}</td>
      <td>
        <div class="flex items-center gap-1">
          <button onclick="toggleUserActive(${u.id})" class="btn btn-ghost text-xs py-1 px-2 ${u.active === false ? 'text-emerald-600' : 'text-amber-600'}" title="${u.active === false ? 'Mở khóa' : 'Khóa tài khoản'}">
            <span class="material-symbols-outlined text-sm">${u.active === false ? 'lock_open' : 'lock'}</span>
          </button>
          <button onclick="toggleUserVerified(${u.id})" class="btn btn-ghost text-xs py-1 px-2 text-campus" title="Đổi xác thực SV">
            <span class="material-symbols-outlined text-sm">verified_user</span>
          </button>
          ${currentUserRole === 'ADMIN' ? `
          <select onchange="changeUserRole(${u.id}, this.value)" class="text-xs border border-slate-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30">
            <option value="">Role...</option>
            <option value="STUDENT" ${u.role==='STUDENT'?'selected':''}>STUDENT</option>
            <option value="MODERATOR" ${u.role==='MODERATOR'?'selected':''}>MODERATOR</option>
            <option value="ADMIN" ${u.role==='ADMIN'?'selected':''}>ADMIN</option>
          </select>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function toggleUserActive(id) {
  try {
    await api(`/admin/users/${id}/toggle-active`, 'PUT');
    showToast('✅ Đã cập nhật trạng thái tài khoản!');
    loadUsers();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

async function toggleUserVerified(id) {
  try {
    await api(`/admin/users/${id}/toggle-verified`, 'PUT');
    showToast('✅ Đã cập nhật xác thực sinh viên!');
    loadUsers();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

async function changeUserRole(id, role) {
  if (!role) return;
  if (!confirm(`Xác nhận đổi role thành ${role}?`)) return;
  try {
    await api(`/admin/users/${id}/role`, 'PUT', { role });
    showToast('✅ Đã cập nhật phân quyền!');
    loadUsers();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

// =============================================================================
// REPORTS
// =============================================================================
async function loadReports() {
  const status = document.getElementById('reportStatusFilter').value;
  document.getElementById('reportsBody').innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400"><span class="material-symbols-outlined spin">sync</span> Đang tải...</td></tr>';
  try {
    const reports = await api(`/admin/reports?status=${status}`);
    const tbody = document.getElementById('reportsBody');
    if (!reports || reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">Không có báo cáo nào.</td></tr>';
      // Update badge
      document.getElementById('reportBadge').classList.add('hidden');
      return;
    }
    const pendingCount = reports.filter(r => r.status === 'PENDING').length;
    if (pendingCount > 0) {
      document.getElementById('reportBadge').textContent = pendingCount;
      document.getElementById('reportBadge').classList.remove('hidden');
    }
    tbody.innerHTML = reports.map(r => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="font-mono text-xs text-slate-500">#${r.id}</td>
        <td class="text-sm font-medium">${r.reporterName || '—'}</td>
        <td class="text-sm max-w-[150px] truncate">${r.productTitle || '—'}</td>
        <td><span class="badge bg-red-100 text-red-700">${r.reason || '—'}</span></td>
        <td class="text-xs text-slate-600 max-w-[200px] truncate">${r.detail || '—'}</td>
        <td>${reportStatusBadge(r.status)}</td>
        <td class="text-xs text-slate-400">${r.createdAt || '—'}</td>
        <td class="text-center">
          ${r.status === 'PENDING' ? `
            <button onclick="openResolveModal(${r.id})" class="btn btn-warning text-xs py-1 px-3">
              <span class="material-symbols-outlined text-sm">gavel</span> Xử lý
            </button>` : `<span class="text-xs text-slate-400">${r.adminNote || '—'}</span>`}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    document.getElementById('reportsBody').innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-400">Lỗi: ${err.message}</td></tr>`;
  }
}

function openResolveModal(id) {
  document.getElementById('resolveReportId').value = id;
  document.getElementById('resolveNote').value = '';
  openModal('resolveModal');
}

async function resolveReport(action) {
  const id   = document.getElementById('resolveReportId').value;
  const note = document.getElementById('resolveNote').value.trim();
  try {
    await api(`/admin/reports/${id}/resolve`, 'PUT', { action, note });
    showToast('✅ Đã xử lý báo cáo!');
    closeModal('resolveModal');
    loadReports();
  } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
}

// =============================================================================
// SETTINGS
// =============================================================================
async function loadSettings() {
  try {
    const settings = await api('/admin/settings');
    const connRes = await fetch(`${API_BASE}/categories`).then(r => r.ok).catch(() => false);
    document.getElementById('connStatus').textContent = connRes ? '● Kết nối OK' : '✕ Không kết nối được';
    document.getElementById('connStatus').className = connRes ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold';

    const list = document.getElementById('settingsList');
    list.innerHTML = settings.map(s => `
      <div class="flex items-start justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-slate-700 font-mono">${s.key}</div>
          <div class="text-xs text-slate-400 mt-0.5">${s.description || ''}</div>
          <div class="text-xs text-slate-500 mt-1">Cập nhật: ${s.updatedAt || '—'} bởi ${s.updatedBy || 'Hệ thống'}</div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <input id="setting_${s.key}" value="${s.value}" class="input w-36 text-sm font-mono" />
          <button onclick="updateSetting('${s.key}', document.getElementById('setting_${s.key}').value)" class="btn btn-primary text-xs px-3">Lưu</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('settingsList').innerHTML = `<div class="text-red-400 text-sm">Lỗi tải cài đặt: ${err.message}</div>`;
  }
}

// =============================================================================
// INIT
// =============================================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});
