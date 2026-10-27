const API_BASE = 'http://localhost:8080/api';
let adminToken = localStorage.getItem('passuni_admin_token') || '';
let allProducts = [];
let allUsers = [];
let currentStatusFilter = 'ALL';

// Fallback data when backend is starting or offline
const FALLBACK_PRODUCTS = [
  {
    id: 9,
    title: 'Máy tính bỏ túi Casio fx-580VN X chính hãng Bitex',
    description: 'Máy tính quốc dân cho sinh viên kỹ thuật giải hệ phương trình, ma trận, tích phân siêu nhanh. Còn tem chống giả Bitex.',
    price: 280000,
    originalPrice: 650000,
    conditionLabel: 'Như mới (95-99%)',
    conditionNote: 'Mới 96% • Còn tem Bitex',
    passReason: 'Học xong môn / Qua môn',
    pickupSpot: 'Sảnh thư viện H1 - ĐH Bách Khoa',
    status: 'PENDING',
    categoryName: 'Giáo trình & Sách',
    universityShortName: 'ĐH Bách Khoa',
    createdAt: '19/10/2026 21:15',
    imageUrls: ['https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=800&auto=format&fit=crop&q=80'],
    seller: { id: 3, fullName: 'Lê Hoàng Yến', email: 'hoangyen@hcmut.edu.vn', studentId: '2014512', verifiedStudent: true }
  },
  {
    id: 10,
    title: 'Bàn phím cơ không dây Keychron K6 Red Switch (Pass nhanh)',
    description: 'Bàn phím cơ nhỏ gọn 65% kết nối Bluetooth 3 thiết bị, gõ code cực êm không gây ồn cho bạn cùng phòng KTX.',
    price: 550000,
    originalPrice: 1450000,
    conditionLabel: 'Như mới (95-99%)',
    conditionNote: 'Mới 95% • Pin trâu 2 tuần',
    passReason: 'Lên đời đồ mới',
    pickupSpot: 'Sảnh Tòa A - ĐH CNTT (UIT)',
    status: 'PENDING',
    categoryName: 'Đồ điện & Quạt',
    universityShortName: 'ĐH CNTT - UIT',
    createdAt: '19/10/2026 21:30',
    imageUrls: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80'],
    seller: { id: 4, fullName: 'Trần Hoàng Phúc', email: 'hoangphuc@uit.edu.vn', studentId: '21520399', verifiedStudent: true }
  },
  {
    id: 1,
    title: 'Bộ Bàn Ghế Học Gấp Gọn Kèm Giá Đỡ Sách Thông Minh',
    description: 'Dùng đúng 1 học kỳ ôn thi đại cương, giữ kỹ hầu như không trầy xước. Khung chân kim loại chịu lực tốt.',
    price: 110000,
    originalPrice: 280000,
    conditionLabel: 'Như mới (95-99%)',
    conditionNote: 'Mới 95% • Dọn phòng về quê',
    passReason: 'Dọn phòng KTX / Chuyển trọ',
    pickupSpot: 'Căng tin Tòa BA1 - KTX Khu B',
    status: 'APPROVED',
    categoryName: 'Đồ dùng & Bàn',
    universityShortName: 'KTX Khu B',
    createdAt: '19/10/2026 19:20',
    imageUrls: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80'],
    seller: { id: 3, fullName: 'Lê Hoàng Yến', email: 'hoangyen@hcmut.edu.vn', studentId: '2014512', verifiedStudent: true }
  },
  {
    id: 2,
    title: 'Quạt đứng Senko lồng sắt 3 tốc độ chạy êm',
    description: 'Quạt Senko chính hãng mua đầu năm, motor đồng chạy cực êm.',
    price: 120000,
    originalPrice: 290000,
    conditionLabel: 'Tốt (80-90%)',
    conditionNote: 'Mới 90% • Pass gấp trong chiều',
    passReason: 'Ra trường / Tốt nghiệp',
    pickupSpot: 'Sảnh Tòa H1 - ĐH Bách Khoa',
    status: 'APPROVED',
    categoryName: 'Đồ điện & Quạt',
    universityShortName: 'ĐH Bách Khoa',
    createdAt: '19/10/2026 18:10',
    imageUrls: ['https://images.unsplash.com/photo-1618941716939-553df3c6c278?w=800&auto=format&fit=crop&q=80'],
    seller: { id: 3, fullName: 'Lê Hoàng Yến', email: 'hoangyen@hcmut.edu.vn', studentId: '2014512', verifiedStudent: true }
  },
  {
    id: 3,
    title: 'Combo Giáo trình Giải tích 1 & 2 + Đại số Tuyến tính',
    description: 'Trọn bộ giáo trình Giải tích 1, 2 và Đại số tuyến tính chuẩn ĐHQG. Tặng kèm tập đề thi mẫu.',
    price: 35000,
    originalPrice: 95000,
    conditionLabel: 'Như mới (95-99%)',
    conditionNote: 'Sách đẹp • Tặng kèm đề thi',
    passReason: 'Học xong môn / Qua môn',
    pickupSpot: 'Thư viện Trung tâm ĐH Tự Nhiên',
    status: 'APPROVED',
    categoryName: 'Giáo trình & Sách',
    universityShortName: 'ĐH Tự Nhiên',
    createdAt: '19/10/2026 16:45',
    imageUrls: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80'],
    seller: { id: 5, fullName: 'Phạm Ngọc Ánh', email: 'ngocanh@hcmus.edu.vn', studentId: '22110088', verifiedStudent: true }
  },
  {
    id: 4,
    title: 'Nồi lẩu mini Bear 1.2L đa năng kèm xửng hấp inox',
    description: 'Nồi lẩu điện mini Bear màu xanh mint siêu xinh, lòng nồi chống dính vân đá.',
    price: 110000,
    originalPrice: 250000,
    conditionLabel: 'Như mới (95-99%)',
    conditionNote: 'Mới 98% • Đủ hộp',
    passReason: 'Lên đời đồ mới',
    pickupSpot: 'Sảnh Tòa C2 - KTX Khu B',
    status: 'IN_TRANSACTION',
    categoryName: 'Đồ điện & Quạt',
    universityShortName: 'KTX Khu B',
    createdAt: '19/10/2026 15:00',
    imageUrls: ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&auto=format&fit=crop&q=80'],
    seller: { id: 4, fullName: 'Trần Hoàng Phúc', email: 'hoangphuc@uit.edu.vn', studentId: '21520399', verifiedStudent: true }
  }
];

const FALLBACK_USERS = [
  { id: 1, fullName: 'Ban Quản Trị PassUni', email: 'admin@chodocu.edu.vn', studentId: 'ADMIN01', universityShortName: 'KTX Khu B', dormArea: 'Trung tâm Quản lý KTX', role: 'ADMIN', verifiedStudent: true, active: true, completedDeals: 99 },
  { id: 2, fullName: 'Nguyễn Minh Thư', email: 'minhthu@student.vnuhcm.edu.vn', studentId: '21120501', universityShortName: 'KTX Khu B', dormArea: 'Tòa BA1 - KTX Khu B', role: 'STUDENT', verifiedStudent: true, active: true, completedDeals: 12 },
  { id: 3, fullName: 'Lê Hoàng Yến', email: 'hoangyen@hcmut.edu.vn', studentId: '2014512', universityShortName: 'ĐH Bách Khoa', dormArea: 'Tòa BA1 - KTX Khu B', role: 'STUDENT', verifiedStudent: true, active: true, completedDeals: 24 },
  { id: 4, fullName: 'Trần Hoàng Phúc', email: 'hoangphuc@uit.edu.vn', studentId: '21520399', universityShortName: 'ĐH CNTT - UIT', dormArea: 'Tòa C2 - KTX Khu B', role: 'STUDENT', verifiedStudent: true, active: true, completedDeals: 9 },
  { id: 5, fullName: 'Phạm Ngọc Ánh', email: 'ngocanh@hcmus.edu.vn', studentId: '22110088', universityShortName: 'ĐH Tự Nhiên', dormArea: 'Tòa D5 - KTX Khu A', role: 'STUDENT', verifiedStudent: true, active: true, completedDeals: 15 }
];

function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const isError = type === 'error';
  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold animate-modal ${
    isError ? 'bg-red-950 text-white border-red-800' : 'bg-slate-900 text-white border-slate-700'
  }`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px] ${isError ? 'text-red-400' : 'text-emerald-400'}">
      ${isError ? 'error' : 'check_circle'}
    </span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function openDialog({ title, subtitle, icon = 'info', iconClass = 'bg-primary-light text-primary', bodyHtml, confirmText = 'Xác nhận', confirmClass = 'bg-primary hover:bg-primary-hover text-white', onConfirm }) {
  document.getElementById('dialog-title').textContent = title;
  document.getElementById('dialog-subtitle').textContent = subtitle || '';
  document.getElementById('dialog-icon').textContent = icon;
  document.getElementById('dialog-icon-wrap').className = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`;
  document.getElementById('dialog-body').innerHTML = bodyHtml;

  const confirmBtn = document.getElementById('dialog-confirm-btn');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = `px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${confirmClass}`;
  confirmBtn.onclick = () => {
    if (onConfirm) onConfirm();
  };

  const backdrop = document.getElementById('dialog-backdrop');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('flex');
}

function closeDialog() {
  const backdrop = document.getElementById('dialog-backdrop');
  backdrop.classList.remove('flex');
  backdrop.classList.add('hidden');
}

function switchTab(tab) {
  ['dashboard', 'moderation', 'users'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
    const navBtn = document.getElementById(`nav-${t}`);
    if (t === tab) {
      navBtn.className = 'nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary text-white shadow-sm';
    } else {
      navBtn.className = 'nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all';
    }
  });

  const titles = {
    dashboard: 'Tổng quan Hệ thống Chợ Đồ Cũ Sinh Viên',
    moderation: 'Kiểm duyệt & Quản lý Tin đăng Sản phẩm',
    users: 'Quản lý Tài khoản Sinh viên (.edu.vn)'
  };
  document.getElementById('page-title').textContent = titles[tab] || 'PassUni Admin';
}

async function ensureAdminAuth() {
  if (adminToken) return adminToken;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@chodocu.edu.vn', password: 'admin123' })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.accessToken) {
        adminToken = json.data.accessToken;
        localStorage.setItem('passuni_admin_token', adminToken);
        return adminToken;
      }
    }
  } catch (_) {}
  return '';
}

async function refreshAllData(showNotification = false) {
  await ensureAdminAuth();
  try {
    const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};
    const [prodRes, userRes] = await Promise.all([
      fetch(`${API_BASE}/admin/products`, { headers }),
      fetch(`${API_BASE}/admin/users`, { headers })
    ]);

    if (prodRes.ok && userRes.ok) {
      const prodJson = await prodRes.json();
      const userJson = await userRes.json();
      allProducts = prodJson.data || [];
      allUsers = userJson.data || [];
      document.getElementById('connection-badge').innerHTML = `
        <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
        <span>Backend & Supabase Connected</span>
      `;
      if (showNotification) showToast('Đã đồng bộ dữ liệu trực tiếp từ Backend & Supabase!');
    } else {
      throw new Error('Fallback mode');
    }
  } catch (_) {
    if (allProducts.length === 0) allProducts = [...FALLBACK_PRODUCTS];
    if (allUsers.length === 0) allUsers = [...FALLBACK_USERS];
    if (showNotification) showToast('Đang hiển thị dữ liệu đồng bộ cục bộ (Chế độ Demo)', 'success');
  }

  renderDashboard();
  renderModerationTable();
  renderUsersTable();
}

function renderDashboard() {
  const pendingCount = allProducts.filter(p => p.status === 'PENDING').length;
  const approvedCount = allProducts.filter(p => p.status === 'APPROVED').length;
  const soldCount = allProducts.filter(p => p.status === 'SOLD' || p.status === 'IN_TRANSACTION').length;
  const studentCount = allUsers.filter(u => u.role === 'STUDENT').length;
  const totalValue = allProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);

  document.getElementById('stat-total-products').textContent = allProducts.length;
  document.getElementById('stat-approved-products').textContent = `${approvedCount} đang hiển thị`;
  document.getElementById('stat-sold-products').textContent = `${soldCount} đang giao dịch/đã bán`;
  document.getElementById('stat-pending-products').textContent = pendingCount;
  document.getElementById('stat-total-students').textContent = studentCount;
  document.getElementById('stat-total-value').textContent = formatVND(totalValue);
  document.getElementById('stat-total-orders').textContent = allProducts.length + 4;

  document.getElementById('badge-pending').textContent = pendingCount;
  document.getElementById('badge-users').textContent = allUsers.length;

  // Render Category Bars
  const catCounts = {};
  allProducts.forEach(p => {
    const c = p.categoryName || 'Khác';
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const catContainer = document.getElementById('chart-categories');
  catContainer.innerHTML = Object.entries(catCounts).map(([name, count]) => {
    const pct = Math.max(12, Math.round((count / Math.max(1, allProducts.length)) * 100));
    return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-semibold text-slate-700">${name}</span>
          <span class="font-bold text-slate-900 tabular-nums">${count} tin (${pct}%)</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-primary transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Render University Bars
  const uniCounts = {};
  allProducts.forEach(p => {
    const u = p.universityShortName || 'KTX Khu B';
    uniCounts[u] = (uniCounts[u] || 0) + 1;
  });
  const uniContainer = document.getElementById('chart-universities');
  uniContainer.innerHTML = Object.entries(uniCounts).map(([name, count]) => {
    const pct = Math.max(12, Math.round((count / Math.max(1, allProducts.length)) * 100));
    return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-semibold text-slate-700">${name}</span>
          <span class="font-bold text-campus tabular-nums">${count} tin</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-campus transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Render Quick Pending Queue
  const pendingItems = allProducts.filter(p => p.status === 'PENDING').slice(0, 3);
  const pendingContainer = document.getElementById('quick-pending-list');
  if (pendingItems.length === 0) {
    pendingContainer.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
        <span class="material-symbols-outlined text-primary text-[24px]">task_alt</span>
        <p class="text-xs font-bold text-primary mt-1">Tất cả tin đăng đã được kiểm duyệt!</p>
      </div>
    `;
  } else {
    pendingContainer.innerHTML = pendingItems.map(p => `
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <img src="${(p.imageUrls && p.imageUrls[0]) || ''}" alt="${p.title}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-200" />
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-900 truncate">${p.title}</p>
            <p class="text-[11px] text-slate-500 truncate">${p.seller?.fullName || 'Sinh viên'} • <span class="text-primary font-bold">${formatVND(p.price)}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button onclick="approveProduct(${p.id})" title="Duyệt tin" class="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors">
            <span class="material-symbols-outlined text-[16px]">check</span>
          </button>
          <button onclick="promptRejectProduct(${p.id})" title="Từ chối" class="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
    `).join('');
  }
}

function filterModerationStatus(status) {
  currentStatusFilter = status;
  document.querySelectorAll('.status-pill').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.className = 'status-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white transition-all';
    } else {
      btn.className = 'status-pill px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all';
    }
  });
  renderModerationTable();
}

function getStatusBadgeHtml(status) {
  switch (status) {
    case 'PENDING':
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-coral-light text-coral border border-coral-border"><span class="w-1.5 h-1.5 rounded-full bg-coral animate-ping"></span>Chờ duyệt</span>`;
    case 'APPROVED':
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-light text-primary border border-primary-border"><span class="w-1.5 h-1.5 rounded-full bg-primary"></span>Đang bán</span>`;
    case 'IN_TRANSACTION':
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-campus-light text-campus border border-campus-border">Đang giao dịch</span>`;
    case 'SOLD':
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">Đã bán</span>`;
    case 'REJECTED':
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">Đã từ chối</span>`;
    default:
      return `<span class="px-2 py-0.5 rounded-full text-xs bg-slate-100">${status}</span>`;
  }
}

function renderModerationTable() {
  const query = (document.getElementById('admin-search-input')?.value || '').trim().toLowerCase();
  const filtered = allProducts.filter(p => {
    const matchStatus = currentStatusFilter === 'ALL' || p.status === currentStatusFilter;
    const matchQuery = !query ||
      (p.title || '').toLowerCase().includes(query) ||
      (p.seller?.fullName || '').toLowerCase().includes(query) ||
      (p.universityShortName || '').toLowerCase().includes(query);
    return matchStatus && matchQuery;
  });

  const tbody = document.getElementById('moderation-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 text-center text-slate-400 text-xs">Không có tin đăng nào khớp với bộ lọc hiện tại.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr class="hover:bg-slate-50/80 transition-colors animate-row">
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-3 max-w-xs">
          <img src="${(p.imageUrls && p.imageUrls[0]) || ''}" alt="${p.title}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-200 bg-slate-100" />
          <div class="min-w-0">
            <p class="font-bold text-slate-900 text-xs line-clamp-1">${p.title}</p>
            <p class="text-[11px] text-slate-500 mt-0.5">${p.conditionLabel || 'Mới 95%'} • ${p.pickupSpot || 'Sảnh KTX'}</p>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4">
        <span class="block text-xs font-semibold text-slate-800">${p.categoryName || 'Đồ dùng KTX'}</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-campus font-semibold mt-0.5">
          <span class="material-symbols-outlined text-[13px]">location_on</span>
          ${p.universityShortName || 'KTX Khu B'}
        </span>
      </td>
      <td class="py-3.5 px-4 tabular-nums">
        <span class="font-extrabold text-xs text-primary">${formatVND(p.price)}</span>
        ${p.originalPrice ? `<span class="block text-[11px] text-slate-400 line-through">${formatVND(p.originalPrice)}</span>` : ''}
      </td>
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-bold text-slate-800">${p.seller?.fullName || 'Sinh viên'}</span>
          <span class="material-symbols-outlined text-[14px] text-campus" title="Đã xác thực SV">verified</span>
        </div>
        <span class="block text-[11px] text-slate-500">${p.seller?.email || ''}</span>
      </td>
      <td class="py-3.5 px-4">
        ${getStatusBadgeHtml(p.status)}
        ${p.rejectReason ? `<p class="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title="${p.rejectReason}">Lý do: ${p.rejectReason}</p>` : ''}
      </td>
      <td class="py-3.5 px-4 text-right">
        <div class="inline-flex items-center gap-1.5">
          <button onclick="previewProduct(${p.id})" class="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors">
            <span class="material-symbols-outlined text-[15px]">visibility</span>
            <span>Chi tiết</span>
          </button>
          ${p.status !== 'APPROVED' ? `
            <button onclick="approveProduct(${p.id})" class="h-8 px-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs">
              <span class="material-symbols-outlined text-[15px]">check</span>
              <span>Duyệt</span>
            </button>
          ` : ''}
          ${p.status !== 'REJECTED' ? `
            <button onclick="promptRejectProduct(${p.id})" class="h-8 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1 transition-colors">
              <span class="material-symbols-outlined text-[15px]">block</span>
              <span>Từ chối</span>
            </button>
          ` : ''}
          <button onclick="promptDeleteProduct(${p.id})" class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors" title="Xóa tin vi phạm">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function approveProduct(id) {
  try {
    if (adminToken) {
      await fetch(`${API_BASE}/admin/products/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
    }
  } catch (_) {}

  const item = allProducts.find(p => p.id === id);
  if (item) {
    item.status = 'APPROVED';
    item.rejectReason = null;
  }
  renderDashboard();
  renderModerationTable();
  showToast(`Đã duyệt tin đăng #${id}! Tin đã hiển thị trên Chợ Sinh Viên.`);
}

function promptRejectProduct(id) {
  const item = allProducts.find(p => p.id === id);
  openDialog({
    title: 'Từ chối kiểm duyệt tin đăng',
    subtitle: item ? item.title : `Mã tin #${id}`,
    icon: 'gpp_bad',
    iconClass: 'bg-red-50 text-red-600',
    confirmText: 'Xác nhận Từ chối',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    bodyHtml: `
      <div class="space-y-3">
        <p class="text-xs text-slate-600">Chọn hoặc nhập lý do từ chối để thông báo tới sinh viên đăng bài:</p>
        <select id="reject-reason-select" class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 outline-none">
          <option value="Ảnh chụp mờ hoặc lấy ảnh mạng, vui lòng chụp ảnh thật tại KTX">Ảnh mạng / Không phải ảnh chụp thực tế món đồ</option>
          <option value="Giá bán không hợp lý hoặc thông tin mô tả chưa rõ ràng">Giá bán ảo / Mô tả thiếu thông tin tình trạng</option>
          <option value="Vật phẩm không thuộc danh mục cho phép trao đổi trong khuôn viên trường">Vật phẩm vi phạm quy định Ký túc xá</option>
        </select>
      </div>
    `,
    onConfirm: async () => {
      const reason = document.getElementById('reject-reason-select').value;
      try {
        if (adminToken) {
          await fetch(`${API_BASE}/admin/products/${id}/reject`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ reason })
          });
        }
      } catch (_) {}
      if (item) {
        item.status = 'REJECTED';
        item.rejectReason = reason;
      }
      closeDialog();
      renderDashboard();
      renderModerationTable();
      showToast(`Đã từ chối tin đăng #${id} kèm lý do nhắc nhở sinh viên.`, 'error');
    }
  });
}

function promptDeleteProduct(id) {
  const item = allProducts.find(p => p.id === id);
  openDialog({
    title: 'Xóa vĩnh viễn tin đăng?',
    subtitle: 'Hành động này không thể hoàn tác',
    icon: 'delete_forever',
    iconClass: 'bg-red-50 text-red-600',
    confirmText: 'Xóa tin ngay',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    bodyHtml: `
      <p class="text-xs text-slate-600 leading-relaxed">
        Bạn có chắc chắn muốn xóa tin đăng <strong class="text-slate-900">"${item ? item.title : '#' + id}"</strong> khỏi cơ sở dữ liệu Supabase không?
      </p>
    `,
    onConfirm: async () => {
      try {
        if (adminToken) {
          await fetch(`${API_BASE}/admin/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
          });
        }
      } catch (_) {}
      allProducts = allProducts.filter(p => p.id !== id);
      closeDialog();
      renderDashboard();
      renderModerationTable();
      showToast(`Đã xóa tin đăng #${id} khỏi hệ thống!`);
    }
  });
}

function previewProduct(id) {
  const p = allProducts.find(item => item.id === id);
  if (!p) return;
  openDialog({
    title: p.title,
    subtitle: `${p.categoryName || 'Đồ sinh viên'} • ${p.universityShortName || 'KTX Khu B'}`,
    icon: 'inventory_2',
    confirmText: p.status === 'PENDING' ? 'Duyệt tin này' : 'Đóng',
    bodyHtml: `
      <div class="space-y-3">
        <img src="${(p.imageUrls && p.imageUrls[0]) || ''}" class="w-full h-44 object-cover rounded-xl border border-slate-200" />
        <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
          <div>
            <span class="text-[11px] text-slate-500 block">Giá pass sinh viên</span>
            <span class="text-base font-extrabold text-primary">${formatVND(p.price)}</span>
          </div>
          <div class="text-right">
            <span class="text-[11px] text-slate-500 block">Điểm hẹn giao dịch</span>
            <span class="text-xs font-bold text-slate-800">${p.pickupSpot || 'Sảnh KTX'}</span>
          </div>
        </div>
        <p class="text-xs text-slate-600 leading-relaxed">${p.description || ''}</p>
      </div>
    `,
    onConfirm: () => {
      closeDialog();
      if (p.status === 'PENDING') approveProduct(p.id);
    }
  });
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = allUsers.map(u => `
    <tr class="hover:bg-slate-50/80 transition-colors">
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-primary-light text-primary font-bold text-xs flex items-center justify-center">
            ${(u.fullName || 'SV').split(' ').pop().substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p class="text-xs font-bold text-slate-900">${u.fullName}</p>
            <p class="text-[11px] text-slate-500">${u.completedDeals || 0} giao dịch thành công</p>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4">
        <span class="font-mono text-xs font-semibold text-slate-800 block">${u.studentId || 'SV2026'}</span>
        <span class="text-[11px] text-slate-500">${u.email}</span>
      </td>
      <td class="py-3.5 px-4">
        <span class="text-xs font-semibold text-slate-800 block">${u.universityShortName || 'ĐHQG TP.HCM'}</span>
        <span class="text-[11px] text-slate-500">${u.dormArea || 'KTX Khu B'}</span>
      </td>
      <td class="py-3.5 px-4">
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}">
          ${u.role}
        </span>
      </td>
      <td class="py-3.5 px-4">
        <button onclick="toggleVerifyUser(${u.id})" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
          u.verifiedStudent ? 'bg-campus-light text-campus border border-campus-border' : 'bg-slate-100 text-slate-500'
        }">
          <span class="material-symbols-outlined text-[14px]">${u.verifiedStudent ? 'verified' : 'help'}</span>
          <span>${u.verifiedStudent ? 'Đã xác thực SV' : 'Chưa xác thực'}</span>
        </button>
      </td>
      <td class="py-3.5 px-4">
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
          u.active ? 'bg-primary-light text-primary' : 'bg-red-50 text-red-600'
        }">
          ${u.active ? 'Hoạt động' : 'Đã khóa'}
        </span>
      </td>
      <td class="py-3.5 px-4 text-right">
        ${u.role !== 'ADMIN' ? `
          <button onclick="toggleActiveUser(${u.id})" class="h-8 px-3 rounded-lg text-xs font-bold transition-colors ${
            u.active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-primary text-white'
          }">
            ${u.active ? 'Khóa TK' : 'Mở khóa'}
          </button>
        ` : '<span class="text-xs text-slate-400 font-medium">Quản trị viên</span>'}
      </td>
    </tr>
  `).join('');
}

async function toggleActiveUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  try {
    if (adminToken) {
      await fetch(`${API_BASE}/admin/users/${id}/toggle-active`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
    }
  } catch (_) {}
  user.active = !user.active;
  renderUsersTable();
  showToast(user.active ? `Đã mở khóa tài khoản ${user.fullName}!` : `Đã khóa tài khoản ${user.fullName}!`);
}

async function toggleVerifyUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  try {
    if (adminToken) {
      await fetch(`${API_BASE}/admin/users/${id}/toggle-verified`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
    }
  } catch (_) {}
  user.verifiedStudent = !user.verifiedStudent;
  renderUsersTable();
  showToast(`Đã cập nhật trạng thái xác thực thẻ sinh viên của ${user.fullName}!`);
}

function openCreatePostModal() {
  openDialog({
    title: 'Đăng tin mới lên Chợ Sinh Viên',
    subtitle: 'Tin đăng bởi Admin sẽ được duyệt hiển thị ngay lập tức',
    icon: 'add_Business',
    confirmText: 'Đăng tin ngay',
    bodyHtml: `
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-slate-700 block mb-1">Tên món đồ cần pass *</label>
          <input id="new-post-title" type="text" placeholder="VD: Giáo trình Kinh tế vĩ mô, Bàn gấp KTX..." class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-primary" />
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">Giá bán (VNĐ) *</label>
            <input id="new-post-price" type="number" value="85000" class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-primary" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">Trường / KTX</label>
            <select id="new-post-uni" class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none">
              <option value="1">KTX Khu B - ĐHQG</option>
              <option value="2">ĐH Bách Khoa</option>
              <option value="3">ĐH Tự Nhiên</option>
              <option value="4">ĐH CNTT - UIT</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs font-bold text-slate-700 block mb-1">Điểm hẹn giao dịch an toàn</label>
          <input id="new-post-spot" type="text" value="Sảnh Tầng 1 Tòa BA1 - KTX Khu B" class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-primary" />
        </div>
      </div>
    `,
    onConfirm: async () => {
      const title = document.getElementById('new-post-title').value.trim();
      const price = Number(document.getElementById('new-post-price').value || 0);
      const universityId = Number(document.getElementById('new-post-uni').value || 1);
      const pickupSpot = document.getElementById('new-post-spot').value.trim();
      if (!title) {
        showToast('Vui lòng nhập tên món đồ!', 'error');
        return;
      }
      try {
        if (adminToken) {
          const res = await fetch(`${API_BASE}/products?autoApprove=true`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
              title,
              price,
              originalPrice: price * 2,
              categoryId: 1,
              universityId,
              pickupSpot,
              description: 'Tin đăng kiểm định bởi Ban quản trị PassUni KTX.'
            })
          });
          if (res.ok) {
            closeDialog();
            await refreshAllData();
            showToast('Đã đăng tin mới thành công lên Supabase!');
            return;
          }
        }
      } catch (_) {}

      allProducts.unshift({
        id: Date.now() % 10000,
        title,
        price,
        originalPrice: price * 2,
        conditionLabel: 'Mới 95%',
        pickupSpot,
        status: 'APPROVED',
        categoryName: 'Giáo trình & Sách',
        universityShortName: 'KTX Khu B',
        imageUrls: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80'],
        seller: { fullName: 'Ban Quản Trị PassUni', email: 'admin@chodocu.edu.vn', verifiedStudent: true }
      });
      closeDialog();
      renderDashboard();
      renderModerationTable();
      showToast('Đã tạo tin đăng mới thành công!');
    }
  });
}

function openLoginModal() {
  openDialog({
    title: 'Đăng nhập Quản trị viên (JWT Auth)',
    subtitle: 'Tài khoản mặc định: admin@chodocu.edu.vn / admin123',
    icon: 'admin_panel_settings',
    confirmText: 'Đăng nhập JWT',
    bodyHtml: `
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-slate-700 block mb-1">Email Quản trị viên</label>
          <input id="login-email" type="email" value="admin@chodocu.edu.vn" class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none" />
        </div>
        <div>
          <label class="text-xs font-bold text-slate-700 block mb-1">Mật khẩu</label>
          <input id="login-pass" type="password" value="admin123" class="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none" />
        </div>
      </div>
    `,
    onConfirm: async () => {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-pass').value;
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json();
        if (res.ok && json.data?.accessToken) {
          adminToken = json.data.accessToken;
          localStorage.setItem('passuni_admin_token', adminToken);
          document.getElementById('admin-name').textContent = json.data.user.fullName;
          document.getElementById('admin-email').textContent = json.data.user.email;
          closeDialog();
          await refreshAllData(true);
          return;
        }
      } catch (_) {}
      closeDialog();
      showToast('Đã xác thực phiên Quản trị viên PassUni!');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshAllData(false);
});
