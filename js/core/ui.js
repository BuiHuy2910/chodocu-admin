/* =============================================================================
   UI helpers: format, badge, toast, modal, confirm, empty/loading state
   ============================================================================= */
window.PU = window.PU || {};

PU.ui = (function () {
  const cfg = PU.config;

  /* ----------------------------- FORMAT ----------------------------- */
  const nf = new Intl.NumberFormat('vi-VN');

  function fmt(n) {
    if (n === null || n === undefined || n === '') return '—';
    const v = Number(n);
    if (Number.isNaN(v)) return '—';
    return nf.format(v) + 'đ';
  }
  function fmtNum(n) {
    if (n === null || n === undefined || n === '') return '—';
    const v = Number(n);
    return Number.isNaN(v) ? '—' : nf.format(v);
  }
  function fmtPct(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    return Number.isNaN(n) ? '—' : (n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 1) + '%';
  }
  function fmtDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return esc(parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2));
  }

  /* ----------------------------- BADGES ----------------------------- */
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

  function statusBadge(status) {
    const [label, tone] = STATUS_MAP[status] || [status || '—', 'neutral'];
    return '<span class="pu-badge pu-badge--' + tone + '">' + esc(label) + '</span>';
  }

  const ROLE_MAP = {
    ADMIN: ['Admin', 'danger'],
    MODERATOR: ['Moderator', 'violet'],
    STUDENT: ['Sinh viên', 'ok']
  };

  function roleBadge(role) {
    const [label, tone] = ROLE_MAP[role] || [role || '—', 'neutral'];
    return '<span class="pu-badge pu-badge--' + tone + '">' + esc(label) + '</span>';
  }

  function verifiedBadge(ok) {
    return ok
      ? '<span class="pu-badge pu-badge--ok">Đã xác thực</span>'
      : '<span class="pu-badge pu-badge--neutral">Chưa</span>';
  }

  /* ----------------------------- TOAST ----------------------------- */
  const ICONS = { ok: 'check_circle', err: 'error', warn: 'warning', info: 'info' };

  function toast(message, type) {
    const kind = type === 'error' ? 'err' : type === 'warn' ? 'warn' : type === 'info' ? 'info' : 'ok';
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'pu-toast pu-toast--' + kind;
    el.innerHTML = '<span class="material-symbols-outlined">' + (ICONS[kind] || ICONS.ok) + '</span><span>' + esc(message) + '</span>';
    box.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  /* ----------------------------- MODAL ----------------------------- */
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('is-open');
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('is-open');
  }
  function closeAllModals() {
    document.querySelectorAll('.pu-modal.is-open').forEach(m => m.classList.remove('is-open'));
  }

  /* --------------------------- DIALOGS ----------------------------- */
  function confirmDialog(title, desc, onOk) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').textContent = desc || '';
    const btn = document.getElementById('confirmOk');
    // thay node để reset listener
    const clone = btn.cloneNode(true);
    clone.addEventListener('click', () => {
      closeModal('confirmModal');
      if (typeof onOk === 'function') onOk();
    });
    btn.parentNode.replaceChild(clone, btn);
    openModal('confirmModal');
  }

  function askNote(title, onOk) {
    document.getElementById('noteTitle').textContent = title || 'Ghi chú';
    const input = document.getElementById('noteInput');
    input.value = '';
    const btn = document.getElementById('noteConfirm');
    const clone = btn.cloneNode(true);
    clone.addEventListener('click', () => {
      closeModal('noteModal');
      if (typeof onOk === 'function') onOk(input.value.trim());
    });
    btn.parentNode.replaceChild(clone, btn);
    openModal('noteModal');
    setTimeout(() => input.focus(), 50);
  }

  /* ------------------------- STATE HELPERS ------------------------- */
  function skeletonRows(cols, rows) {
    const n = rows || 4;
    let html = '';
    for (let i = 0; i < n; i++) {
      html += '<tr><td colspan="' + cols + '"><div class="pu-skeleton"><span style="width:' + (55 + (i * 9) % 30) + '%"></span><span style="width:' + (30 + (i * 13) % 40) + '%"></span></div></td></tr>';
    }
    return html;
  }

  function emptyRow(cols, title, desc) {
    return '<tr><td colspan="' + cols + '">' + emptyState(title, desc) + '</td></tr>';
  }

  function emptyState(title, desc, icon) {
    return '<div class="pu-state">' +
      '<span class="material-symbols-outlined">' + (icon || 'inbox') + '</span>' +
      '<div class="pu-state__title">' + esc(title || 'Không có dữ liệu') + '</div>' +
      (desc ? '<div class="pu-state__desc">' + esc(desc) + '</div>' : '') +
      '</div>';
  }

  function imageOr(url, fallback) {
    return url || fallback || cfg.FALLBACK_PRODUCT;
  }

  /* --------------------------- SIDEBAR ----------------------------- */
  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('is-open');
  }

  function closeSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('is-open');
  }

  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    const n = Number(count) || 0;
    if (n > 0) { el.textContent = n > 99 ? '99+' : n; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  }

  return {
    fmt, fmtNum, fmtPct, fmtDate, esc, initials,
    statusBadge, roleBadge, verifiedBadge,
    toast, openModal, closeModal, closeAllModals,
    confirmDialog, askNote,
    skeletonRows, emptyRow, emptyState, imageOr,
    toggleSidebar, closeSidebar, setBadge
  };
})();
