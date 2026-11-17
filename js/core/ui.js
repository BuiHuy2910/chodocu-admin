/* =============================================================================
   UI helpers dùng chung: định dạng, badge, ảnh/avatar, phân trang, debounce, modal
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

    return validDate(new Date(text));
  }

  function fmtDate(raw) {
    const d = parseDate(raw);
    if (!d) return raw ? String(raw) : '—';
    return `${fmtDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtDay(raw) {
    const d = parseDate(raw);
    if (!d) return raw ? String(raw) : '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

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
  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
    return esc(letters.toUpperCase());
  }

  // Trì hoãn gọi hàm khi gõ phím liên tục để không bắn nhiều request xuống server
  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait || 300);
    };
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
  function imgTag(url, alt) {
    if (!url) return '';
    return `<img src="${esc(url)}" alt="${esc(alt || '')}" loading="lazy" decoding="async" onerror="PU.ui.imgFail(this)" />`;
  }

  function imgFail(img) {
    if (img.parentElement) img.parentElement.classList.add('is-broken');
    img.remove();
  }

  function thumbInner(url, alt) {
    return `<span class="material-symbols-outlined">image_not_supported</span>${imgTag(url, alt)}`;
  }

  function thumb(url, className) {
    return `<span class="pu-thumb ${className || ''}">${thumbInner(url)}</span>`;
  }

  function avatar(name, url, size) {
    const tone = hashText(name) % 4;
    return `<span class="pu-avatar pu-avatar--${size || 'sm'} pu-avatar--tone${tone}" aria-hidden="true">${initials(name)}${imgTag(url)}</span>`;
  }

  function hashText(text) {
    let hash = 0;
    for (const ch of String(text || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return hash;
  }

  /* ------------------------------- PHÂN TRANG ------------------------------- */
  // Vẽ thanh phân trang vào containerId.
  // pageData: { pageNumber, pageSize, totalElements, totalPages }
  // opts: { onPage(p), onSize?(s), sizes?: [10,15,25,50], unit?: 'mục', compact?: false }
  function renderPager(containerId, pageData, opts) {
    const box = $(containerId);
    if (!box) return;

    const total = Number(pageData && pageData.totalElements) || 0;
    const totalPages = Math.max(Number(pageData && pageData.totalPages) || 0, 1);
    const page = Math.min(Math.max(Number(pageData && pageData.pageNumber) || 0, 0), totalPages - 1);
    const size = Number(pageData && pageData.pageSize) || 15;
    const options = opts || {};

    if (total <= 0) {
      box.innerHTML = '';
      box.classList.add('hidden');
      return;
    }

    const from = page * size + 1;
    const to = Math.min(total, (page + 1) * size);
    const unit = options.unit || 'mục';
    const compact = !!options.compact;
    const sizes = options.sizes || [10, 15, 25, 50];

    const infoHtml = compact
      ? `<span class="pu-pager__info">Trang <b>${page + 1}</b>/${totalPages} · ${fmtNum(total)} ${esc(unit)}</span>`
      : `<span class="pu-pager__info">Hiển thị <b>${fmtNum(from)}–${fmtNum(to)}</b> trong <b>${fmtNum(total)}</b> ${esc(unit)}</span>`;

    const sizeHtml = typeof options.onSize === 'function'
      ? `<select class="pu-select pu-input--sm pu-pager__size" aria-label="Số dòng mỗi trang">
           ${sizes.map(s => `<option value="${s}" ${s === size ? 'selected' : ''}>${s} / trang</option>`).join('')}
         </select>`
      : '';

    const pages = pageWindow(page, totalPages, compact ? 1 : 2);
    const pageBtns = pages.map(item => item === '...'
      ? '<span class="pu-pager__dots">…</span>'
      : `<button type="button" class="pu-btn pu-btn--sm pu-pager__btn${item === page ? ' is-active' : ''}" data-page="${item}" ${item === page ? 'aria-current="page"' : ''}>${item + 1}</button>`
    ).join('');

    const navHtml = totalPages > 1 ? `
      <div class="pu-pager__pages">
        <button type="button" class="pu-btn pu-btn--ghost pu-btn--sm pu-pager__btn" data-page="${page - 1}" ${page <= 0 ? 'disabled' : ''} title="Trang trước" aria-label="Trang trước">
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        ${pageBtns}
        <button type="button" class="pu-btn pu-btn--ghost pu-btn--sm pu-pager__btn" data-page="${page + 1}" ${page >= totalPages - 1 ? 'disabled' : ''} title="Trang sau" aria-label="Trang sau">
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>` : '';

    box.className = `pu-pager${compact ? ' pu-pager--compact' : ''}`;
    box.innerHTML = `${infoHtml}<div class="pu-pager__controls">${sizeHtml}${navHtml}</div>`;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.onclick = () => {
        const next = Number(btn.getAttribute('data-page'));
        if (!Number.isNaN(next) && next !== page && next >= 0 && next < totalPages && typeof options.onPage === 'function') {
          options.onPage(next);
        }
      };
    });

    const select = box.querySelector('.pu-pager__size');
    if (select && typeof options.onSize === 'function') {
      select.onchange = () => options.onSize(Number(select.value) || size);
    }
  }

  function pageWindow(current, total, radius) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const set = new Set([0, total - 1]);
    for (let i = current - radius; i <= current + radius; i++) {
      if (i >= 0 && i < total) set.add(i);
    }
    const sorted = Array.from(set).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('...');
      out.push(sorted[i]);
    }
    return out;
  }

  /* -------------------------- LỊCH SỬ KIỂM DUYỆT ---------------------------- */
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

  function confirmDialog(title, desc, onOk, options) {
    const opts = Object.assign({ okLabel: 'Đồng ý', tone: 'danger' }, options);
    $('confirmTitle').textContent = title;
    $('confirmDesc').textContent = desc || '';
    const button = $('confirmOk');
    button.className = `pu-btn pu-btn--${opts.tone}`;
    button.textContent = opts.okLabel;
    button.onclick = () => {
      closeModal('confirmModal');
      if (typeof onOk === 'function') onOk();
    };
    openModal('confirmModal');
  }

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

  function setBadge(id, count) {
    const el = $(id);
    if (!el) return;
    const n = Number(count) || 0;
    el.textContent = n > 99 ? '99+' : n;
    el.classList.toggle('hidden', n <= 0);
  }

  return {
    fmt, fmtNum, fmtPct, parseDate, fmtDate, fmtDay, duration,
    esc, normalize, initials, debounce,
    statusBadge, statusLabel, roleBadge, actionBadge,
    thumb, thumbInner, avatar, imgFail, historyList, renderPager,
    toast, openModal, closeModal, closeAllModals, isModalOpen, anyModalOpen,
    confirmDialog, askNote,
    skeleton, skeletonRows, emptyRow, emptyState,
    toggleSidebar, closeSidebar, setBadge
  };
})();
