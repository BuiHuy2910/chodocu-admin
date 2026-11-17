/* =============================================================================
   Module: Người dùng — phân trang server-side + tìm kiếm debounce + khoá / đổi quyền
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.users = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;
  const esc = ui.esc;
  const $ = id => document.getElementById(id);

  const COLUMNS = 9;

  const ROLE_LABELS = {
    STUDENT: 'Sinh viên',
    MODERATOR: 'Kiểm duyệt viên',
    ADMIN: 'Quản trị viên'
  };

  let items = [];
  let page = 0;
  let size = cfg.DEFAULT_PAGE_SIZE || 15;
  let aborter = null;

  const debouncedSearch = ui.debounce(() => {
    page = 0;
    load();
  }, 300);

  function onSearch() {
    debouncedSearch();
  }

  function onFilterChange() {
    page = 0;
    load();
  }

  /* ---------------------------------- BẢNG ---------------------------------- */
  async function load() {
    if (aborter) aborter.abort();
    aborter = new AbortController();

    const body = $('usersBody');
    body.innerHTML = ui.skeletonRows(COLUMNS, 6);
    const role = $('userRoleFilter').value;
    const keyword = $('userSearch').value.trim();

    try {
      const data = await http.get('/admin/users' + http.query({ role, keyword, page, size }), {
        signal: aborter.signal
      });
      items = (data && data.content) || [];
      body.innerHTML = items.length
        ? items.map(row).join('')
        : ui.emptyRow(COLUMNS, 'Không tìm thấy người dùng', 'Thử đổi từ khoá hoặc bộ lọc vai trò.');

      ui.renderPager('usersPager', data, {
        unit: 'người dùng',
        onPage: next => { page = next; load(); },
        onSize: nextSize => { size = nextSize; page = 0; load(); }
      });
    } catch (e) {
      if (e && e.aborted) return;
      body.innerHTML = ui.emptyRow(COLUMNS, 'Không tải được người dùng', e.message);
      ui.renderPager('usersPager', null);
    }
  }

  function row(u) {
    return `
      <tr class="${u.active === false ? 'is-muted' : ''}">
        <td>${userCell(u)}</td>
        <td class="t-caption">${esc(u.email || '—')}</td>
        <td class="mono t-caption">${esc(u.studentId || '—')}</td>
        <td class="t-body">${esc(u.universityShortName || u.universityName || '—')}</td>
        <td>${ui.roleBadge(u.role)}</td>
        <td class="t-caption">${esc(ui.fmtDay(u.createdAt))}</td>
        <td class="is-right t-body">${u.rating != null ? Number(u.rating).toFixed(1) : '—'}</td>
        <td class="is-right t-body">${u.completedDeals || 0}</td>
        <td class="is-center">${rowActions(u)}</td>
      </tr>`;
  }

  function userCell(u) {
    const locked = u.active === false ? '<span class="pu-badge pu-badge--danger">Đã khoá</span>' : '';
    return `
      <div class="pu-cell-user">
        ${ui.avatar(u.fullName || u.email, u.avatarUrl, 'sm')}
        <div class="pu-cell-user__text">
          <div class="t-body strong truncate">${esc(u.fullName || '—')} ${locked}</div>
          <div class="t-caption truncate">${esc(u.dormArea || '')}</div>
        </div>
      </div>`;
  }

  function rowActions(u) {
    const id = Number(u.id);
    const locked = u.active === false;
    return `
      <div class="pu-row-actions">
        <button class="pu-btn pu-btn--icon ${locked ? 'pu-btn--success' : 'pu-btn--warn'}"
                title="${locked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}"
                aria-label="${locked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}" onclick="PU.users.toggleActive(${id})">
          <span class="material-symbols-outlined">${locked ? 'lock_open' : 'lock'}</span>
        </button>
        ${roleSelect(u)}
      </div>`;
  }

  function roleSelect(u) {
    const options = Object.keys(ROLE_LABELS).filter(role => role !== u.role)
      .map(role => `<option value="${role}">${ROLE_LABELS[role]}</option>`).join('');
    return `
      <select class="pu-select pu-input--sm pu-role-select" aria-label="Đổi vai trò"
              onchange="PU.users.changeRole(${Number(u.id)}, this)">
        <option value="">Đổi vai trò…</option>${options}
      </select>`;
  }

  /* -------------------------------- THAO TÁC --------------------------------- */
  function toggleActive(id) {
    const user = items.find(u => u.id === id);
    const willLock = !(user && user.active === false);
    ui.confirmDialog(
      willLock ? 'Khoá tài khoản?' : 'Mở khoá tài khoản?',
      willLock ? 'Người dùng sẽ không thể đăng nhập cho tới khi được mở khoá.' : 'Người dùng sẽ đăng nhập lại được.',
      () => send(`/admin/users/${id}/toggle-active`, undefined, willLock ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.'),
      { okLabel: willLock ? 'Khoá' : 'Mở khoá', tone: willLock ? 'danger' : 'primary' }
    );
  }

  function changeRole(id, select) {
    const role = select.value;
    select.value = '';
    if (!role) return;
    ui.confirmDialog('Đổi vai trò?', `Người dùng này sẽ trở thành ${ROLE_LABELS[role] || role}.`,
      () => send(`/admin/users/${id}/role`, { role }, 'Đã cập nhật vai trò.'),
      { okLabel: 'Đổi vai trò', tone: 'primary' });
  }

  async function send(path, body, successMessage) {
    try {
      await http.put(path, body);
      ui.toast(successMessage, 'ok');
      PU.router.invalidate('dashboard');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  return { load, onSearch, onFilterChange, toggleActive, changeRole };
})();

PU.users = PU.modules.users;
