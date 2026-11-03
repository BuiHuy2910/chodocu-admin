/* =============================================================================
   Module: Người dùng
   ============================================================================= */
window.PU = window.PU || {};
PU.modules = PU.modules || {};

PU.modules.users = (function () {
  const http = PU.http;
  const ui = PU.ui;
  const cfg = PU.config;

  let all = [];

  function row(u) {
    const avatar = u.avatarUrl || cfg.FALLBACK_AVATAR;
    const locked = u.active === false;

    const roleControl = PU.auth.isAdmin()
      ? '<select class="pu-select pu-input--sm" style="width:118px" onchange="PU.users.changeRole(' + u.id + ', this.value)">' +
          '<option value="">Đổi vai trò…</option>' +
          '<option value="STUDENT">STUDENT</option>' +
          '<option value="MODERATOR">MODERATOR</option>' +
          '<option value="ADMIN">ADMIN</option>' +
        '</select>'
      : '';

    return '' +
      '<tr' + (locked ? ' style="opacity:.55"' : '') + '>' +
        '<td>' +
          '<div class="pu-cell-user">' +
            '<img src="' + ui.esc(avatar) + '" alt="" onerror="this.src=\'' + cfg.FALLBACK_AVATAR + '\'" />' +
            '<div style="min-width:0">' +
              '<div class="t-body strong truncate" style="max-width:170px">' + ui.esc(u.fullName || '—') + '</div>' +
              '<div class="t-caption truncate" style="max-width:170px">' + ui.esc(u.dormArea || '') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td class="t-caption">' + ui.esc(u.email || '—') + '</td>' +
        '<td class="mono t-caption">' + ui.esc(u.studentId || '—') + '</td>' +
        '<td class="t-body">' + ui.esc(u.universityShortName || (u.university && u.university.shortName) || '—') + '</td>' +
        '<td>' + ui.roleBadge(u.role) + '</td>' +
        '<td>' + ui.verifiedBadge(u.verifiedStudent) + '</td>' +
        '<td class="is-right t-body">' + (u.rating != null ? Number(u.rating).toFixed(1) : '—') + '</td>' +
        '<td class="is-right t-body">' + (u.completedDeals || 0) + '</td>' +
        '<td class="is-center">' +
          '<div class="pu-row-actions">' +
            '<button class="pu-btn ' + (locked ? 'pu-btn--success' : 'pu-btn--warn') + ' pu-btn--icon" ' +
              'title="' + (locked ? 'Mở khoá tài khoản' : 'Khoá tài khoản') + '" onclick="PU.users.toggleActive(' + u.id + ')">' +
              '<span class="material-symbols-outlined">' + (locked ? 'lock_open' : 'lock') + '</span></button>' +
            '<button class="pu-btn pu-btn--ghost pu-btn--icon" title="Đổi xác thực sinh viên" onclick="PU.users.toggleVerified(' + u.id + ')">' +
              '<span class="material-symbols-outlined">verified_user</span></button>' +
            roleControl +
          '</div>' +
        '</td>' +
      '</tr>';
  }

  function render(list) {
    const tbody = document.getElementById('usersBody');
    if (!list || list.length === 0) {
      tbody.innerHTML = ui.emptyRow(9, 'Không tìm thấy người dùng', 'Thử đổi từ khoá hoặc bộ lọc vai trò.');
      return;
    }
    tbody.innerHTML = list.map(row).join('');
  }

  async function load() {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = ui.skeletonRows(9, 6);
    try {
      all = await http.get('/admin/users');
      filter();
    } catch (e) {
      tbody.innerHTML = ui.emptyRow(9, 'Lỗi tải người dùng', e.message);
    }
  }

  function filter() {
    const q = (document.getElementById('userSearch').value || '').trim().toLowerCase();
    const role = document.getElementById('userRoleFilter').value;

    const list = (all || []).filter(u => {
      if (role && u.role !== role) return false;
      if (!q) return true;
      const hay = [u.fullName, u.email, u.studentId].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    render(list);
  }

  async function toggleActive(id) {
    const u = (all || []).find(x => x.id === id);
    const willLock = !(u && u.active === false);
    ui.confirmDialog(
      willLock ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
      willLock ? 'Người dùng sẽ không thể đăng nhập cho tới khi được mở khoá.' : 'Người dùng sẽ có thể đăng nhập trở lại.',
      async () => {
        try {
          await http.put('/admin/users/' + id + '/toggle-active');
          ui.toast('Đã cập nhật trạng thái tài khoản.', 'ok');
          load();
        } catch (e) {
          ui.toast(e.message, 'error');
        }
      }
    );
  }

  async function toggleVerified(id) {
    try {
      await http.put('/admin/users/' + id + '/toggle-verified');
      ui.toast('Đã cập nhật xác thực sinh viên.', 'ok');
      load();
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  function changeRole(id, role) {
    if (!role) return;
    ui.confirmDialog('Đổi vai trò', 'Xác nhận đổi vai trò của người dùng này thành ' + role + '?', async () => {
      try {
        await http.put('/admin/users/' + id + '/role', { role });
        ui.toast('Đã cập nhật vai trò.', 'ok');
        load();
      } catch (e) {
        ui.toast(e.message, 'error');
      }
    });
  }

  return { load, filter, toggleActive, toggleVerified, changeRole };
})();
