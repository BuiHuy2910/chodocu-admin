/* =============================================================================
   UI helpers dùng chung: định dạng, badge, ảnh/avatar, toast, modal, trạng thái
   ============================================================================= */
window.PU = window.PU || {};

PU.ui = (function () {
  const $ = id => document.getElementById(id);

  /* ------------------------------- SỐ & TIỀN -------------------------------- */
  const numberFormat = new Intl.NumberFormat('vi-VN');

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  // 150000 → "150.000đ"
  function fmt(value) {
    const n = toNumber(value);
    return n === null ? '—' : numberFormat.format(n) + 'đ';
  }

  // 1234 → "1.234"
  function fmtNum(value) {
    const n = toNumber(value);
    return n === null ? '—' : numberFormat.format(n);
  }

  // 0.05 → "5%", 0.025 → "2.5%"
  function fmtPct(value) {
    const n = toNumber(value);
    if (n === null) return '—';
    const pct = Math.round(n * 1000) / 10;
    return pct + '%';
  }

  /* -------------------------------- NGÀY GIỜ -------------------------------- */
  const pad = n => String(n).padStart(2, '0');
  const validDate = d => (Number.isNaN(d.getTime()) ? null : d);

  // Đọc ngày giờ từ backend, hỗ trợ các dạng:
  //   "2026-11-16T14:03:15Z"     → createdAtIso (giờ UTC, trình duyệt tự đổi sang giờ máy)
  //   "16/11/2026 21:03"         → createdAt (đã đổi sẵn sang giờ Việt Nam)
  //   "2026-11-16T21:03:15.123"  → ISO không có múi giờ (dữ liệu cũ) = giờ máy
  function parseDate(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (raw instanceof Date) return validDate(raw);
    if (typeof raw === 'number') return validDate(new Date(raw));

    const text = String(raw).trim();

    const vn = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (vn) {
      const [, day, month, year, hour = 0, minute = 0, second = 0] = vn;
      return validDate(new Date(+year, month - 1, +day, +hour, +minute, +second));
    }

    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/);
    if (iso) {
      const [, year, month, day, hour = 0, minute = 0, second = 0, fraction = '0'] = iso;
      const ms = Number(fraction.slice(0, 3).padEnd(3, '0'));
      return validDate(new Date(+year, month - 1, +day, +hour, +minute, +second, ms));
    }

    return validDate(new Date(text)); // dạng khác, ví dụ có múi giờ "…Z" hoặc "…+07:00"
  }

  // → "16/11/2026 21:03"
  function fmtDate(raw) {
    const d = parseDate(raw);
    if (!d) return raw ? String(raw) : '—';
    return `${fmtDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // → "16/11/2026"
  function fmtDay(raw) {
    const d = parseDate(raw);
    if (!d) return raw ? String(raw) : '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  // Khoảng thời gian dễ đọc: 90 phút → "1 giờ", 50 giờ → "2 ngày"
  function duration(ms) {
    const minutes = Math.floor(Math.max(ms, 0) / 60000);
    if (minutes < 1) return 'dưới 1 phút';
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày`;
    return days < 365 ? `${Math.floor(days / 30)} tháng` : `${Math.floor(days / 365)} năm`;
  }

  /* --------------------------------- CHUỖI ---------------------------------- */
  // Luôn bọc dữ liệu từ người dùng bằng esc() trước khi gán vào innerHTML
  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Bỏ dấu + chữ thường để tìm kiếm: "Điện Thoại" → "dien thoai"
  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // "Nguyễn Văn An" → "NA" (đã escape, dùng cho avatar chữ cái)
  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
    return esc(letters.toUpperCase());
  }

  /* --------------------------------- BADGE ---------------------------------- */
  const STATUS_MAP = {
    PENDING:        ['Chờ duyệt', 'warn'],
    APPROVED:       ['Đã duyệt', 'ok'],
    REJECTED:       ['Từ chối', 'danger'],
    IN_TRANSACTION: ['Đang giao dịch', 'info'],
    SOLD:           ['Đã bán', 'neutral'],
    HIDDEN:         ['Đang ẩn', 'neutral'],
    ACCEPTED:       ['Đã xác nhận', 'info'],
    COMPLETED:      ['Hoàn thành', 'ok'],
    CANCELLED:      ['Đã huỷ', 'danger'],
    DISPUTED:       ['Tranh chấp', 'warn'],
    RESOLVED:       ['Đã xử lý', 'ok'],
    DISMISSED:      ['Bác bỏ', 'neutral']
  };

  const ROLE_MAP = {
    ADMIN:     ['Admin', 'danger'],
    MODERATOR: ['Moderator', 'violet'],
    STUDENT:   ['Sinh viên', 'ok']
  };

  // Hành động trong nhật ký kiểm duyệt
  const ACTION_MAP = {
    APPROVE: ['Duyệt', 'ok'],
    REJECT:  ['Từ chối', 'danger'],
    HIDE:    ['Ẩn tin', 'neutral'],
    UNHIDE:  ['Hiện lại', 'info'],
    DELETE:  ['Xoá', 'danger']
  };

  function badge(entry, fallbackLabel) {
    const [label, tone] = entry || [fallbackLabel || '—', 'neutral'];
    return `<span class="pu-badge pu-badge--${tone}">${esc(label)}</span>`;
  }

  function statusBadge(status) { return badge(STATUS_MAP[status], status); }
  function roleBadge(role) { return badge(ROLE_MAP[role], role); }
  function actionBadge(action) { return badge(ACTION_MAP[action], action); }
  function statusLabel(status) { return (STATUS_MAP[status] || [status || '—'])[0]; }

  /* ------------------------------ ẢNH & AVATAR ------------------------------ */
  // Không dùng ảnh mẫu/ảnh stock. Cách làm: lớp dự phòng (biểu tượng hoặc chữ cái)
  // nằm dưới, <img> phủ lên trên; nếu ảnh lỗi thì gỡ <img> → lộ lớp dự phòng.
  function imgTag(url, alt) {
    if (!url) return '';
    return `<img src="${esc(url)}" alt="${esc(alt || '')}" loading="lazy" onerror="PU.ui.imgFail(this)" />`;
  }

  function imgFail(img) {
    if (img.parentElement) img.parentElement.classList.add('is-broken');
    img.remove();
  }

  // Ruột của ô ảnh (dùng trực tiếp khi ô ảnh là một <button>)
  function thumbInner(url, alt) {
    return `<span class="material-symbols-outlined">image_not_supported</span>${imgTag(url, alt)}`;
  }

  // Ô ảnh sản phẩm: không có ảnh / ảnh lỗi → biểu tượng trung tính
  function thumb(url, className) {
    return `<span class="pu-thumb ${className || ''}">${thumbInner(url)}</span>`;
  }

  // Avatar tròn: chữ cái viết tắt, phủ ảnh thật nếu người dùng đã tải lên.
  // size: 'sm' | 'md' | 'lg'. Màu nền chọn theo tên để mỗi người một màu cố định.
  function avatar(name, url, size) {
    const tone = hashText(name) % 4;
    return `<span class="pu-avatar pu-avatar--${size || 'sm'} pu-avatar--tone${tone}" aria-hidden="true">${initials(name)}${imgTag(url)}</span>`;
  }

  function hashText(text) {
    let hash = 0;
    for (const ch of String(text || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return hash;
  }

  /* -------------------------- LỊCH SỬ KIỂM DUYỆT ---------------------------- */
  // Dòng thời gian, mới nhất ở trên. API /admin/products/{id}/logs trả moderatorName,
  // API /admin/moderation-logs trả adminName → chấp nhận cả hai.
  function historyList(logs) {
    if (!logs || !logs.length) return '<div class="pu-history__empty">Chưa có lịch sử kiểm duyệt.</div>';
    const newestFirst = logs.slice().sort((a, b) =>
      timeValue(b.createdAt) - timeValue(a.createdAt) || (b.id || 0) - (a.id || 0));
    return `<ol class="pu-history">${newestFirst.map(historyItem).join('')}</ol>`;
  }

  function historyItem(log) {
    const who = log.moderatorName || log.adminName || 'Hệ thống';
    const reason = log.reason ? `<div class="pu-history__reason">${esc(log.reason)}</div>` : '';
    return `
      <li class="pu-history__item">
        ${actionBadge(log.action)}
        <div class="pu-history__body">
          <div class="pu-history__meta"><b>${esc(who)}</b> · ${esc(fmtDate(log.createdAt))}</div>
          ${reason}
        </div>
      </li>`;
  }

  function timeValue(raw) {
    const d = parseDate(raw);
    return d ? d.getTime() : 0;
  }

  /* --------------------------------- TOAST ---------------------------------- */
  const TOAST_ICONS = { ok: 'check_circle', err: 'error', warn: 'warning', info: 'info' };

  // type: 'ok' | 'error' | 'warn' | 'info'
  function toast(message, type) {
    const box = $('toasts');
    if (!box) return;
    const kind = { error: 'err', warn: 'warn', info: 'info' }[type] || 'ok';
    const el = document.createElement('div');
    el.className = `pu-toast pu-toast--${kind}`;
    el.innerHTML = `<span class="material-symbols-outlined">${TOAST_ICONS[kind]}</span><span>${esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  /* --------------------------------- MODAL ---------------------------------- */
  function openModal(id) { const el = $(id); if (el) el.classList.add('is-open'); }
  function closeModal(id) { const el = $(id); if (el) el.classList.remove('is-open'); }
  function isModalOpen(id) { const el = $(id); return !!el && el.classList.contains('is-open'); }
  function anyModalOpen() { return !!document.querySelector('.pu-modal.is-open'); }

  function closeAllModals() {
    document.querySelectorAll('.pu-modal.is-open').forEach(m => m.classList.remove('is-open'));
  }

  // Hộp thoại xác nhận. options: { okLabel: 'Đồng ý', tone: 'danger' | 'primary' | 'warn' }
  function confirmDialog(title, desc, onOk, options) {
    const opts = Object.assign({ okLabel: 'Đồng ý', tone: 'danger' }, options);
    $('confirmTitle').textContent = title;
    $('confirmDesc').textContent = desc || '';
    const button = $('confirmOk');
    button.className = `pu-btn pu-btn--${opts.tone}`;
    button.textContent = opts.okLabel;
    button.onclick = () => {          // gán onclick → luôn chỉ có MỘT handler
      closeModal('confirmModal');
      if (typeof onOk === 'function') onOk();
    };
    openModal('confirmModal');
  }

  // Hỏi một ghi chú ngắn (không bắt buộc) rồi gọi onOk(ghiChu)
  function askNote(title, onOk) {
    $('noteTitle').textContent = title || 'Ghi chú';
    const input = $('noteInput');
    input.value = '';
    $('noteConfirm').onclick = () => {
      closeModal('noteModal');
      if (typeof onOk === 'function') onOk(input.value.trim());
    };
    openModal('noteModal');
    setTimeout(() => input.focus(), 50);
  }

  /* ------------------------- ĐANG TẢI / DỮ LIỆU RỖNG ------------------------ */
  function skeleton(lines) {
    return `<div class="pu-skeleton">${'<span></span>'.repeat(lines || 3)}</div>`;
  }

  function skeletonRows(cols, rows) {
    const line = `<tr><td colspan="${cols}">${skeleton(2)}</td></tr>`;
    return line.repeat(rows || 4);
  }

  function emptyRow(cols, title, desc) {
    return `<tr><td colspan="${cols}">${emptyState(title, desc)}</td></tr>`;
  }

  // actionHtml (tuỳ chọn): ví dụ nút "Thử lại"
  function emptyState(title, desc, icon, actionHtml) {
    return `
      <div class="pu-state">
        <span class="material-symbols-outlined">${icon || 'inbox'}</span>
        <div class="pu-state__title">${esc(title || 'Không có dữ liệu')}</div>
        ${desc ? `<div class="pu-state__desc">${esc(desc)}</div>` : ''}
        ${actionHtml ? `<div class="pu-state__action">${actionHtml}</div>` : ''}
      </div>`;
  }

  /* ------------------------------- SIDEBAR ---------------------------------- */
  function toggleSidebar() { const sb = $('sidebar'); if (sb) sb.classList.toggle('is-open'); }
  function closeSidebar() { const sb = $('sidebar'); if (sb) sb.classList.remove('is-open'); }

  // Số đếm cạnh mục menu (ẩn khi bằng 0)
  function setBadge(id, count) {
    const el = $(id);
    if (!el) return;
    const n = Number(count) || 0;
    el.textContent = n > 99 ? '99+' : n;
    el.classList.toggle('hidden', n <= 0);
  }

  return {
    fmt, fmtNum, fmtPct, parseDate, fmtDate, fmtDay, duration,
    esc, normalize, initials,
    statusBadge, statusLabel, roleBadge, actionBadge,
    thumb, thumbInner, avatar, imgFail, historyList,
    toast, openModal, closeModal, closeAllModals, isModalOpen, anyModalOpen,
    confirmDialog, askNote,
    skeleton, skeletonRows, emptyRow, emptyState,
    toggleSidebar, closeSidebar, setBadge
  };
})();
