/* =============================================================================
   HTTP client — gắn Bearer token, chuẩn hoá lỗi tiếng Việt
   ============================================================================= */
window.PU = window.PU || {};

PU.http = (function () {
  const cfg = PU.config;

  function getToken() {
    return PU._token || localStorage.getItem(cfg.TOKEN_KEY) || '';
  }

  function setToken(token) {
    PU._token = token || '';
    if (token) localStorage.setItem(cfg.TOKEN_KEY, token);
    else localStorage.removeItem(cfg.TOKEN_KEY);
  }

  function getRole() {
    return PU._role || localStorage.getItem(cfg.ROLE_KEY) || '';
  }

  function setRole(role) {
    PU._role = role || '';
    if (role) localStorage.setItem(cfg.ROLE_KEY, role);
    else localStorage.removeItem(cfg.ROLE_KEY);
  }

  function friendly(message, status) {
    const m = String(message || '');
    if (m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('ERR_CONNECTION')) {
      return 'Không kết nối được backend. Kiểm tra backend đang chạy tại ' + cfg.API_BASE;
    }
    if (status === 401) return m || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    if (status === 403) return m || 'Bạn không có quyền thực hiện thao tác này.';
    if (status === 404) return m || 'Không tìm thấy dữ liệu (404).';
    if (status >= 500) return m || 'Máy chủ gặp lỗi (' + status + ').';
    return m || 'Yêu cầu thất bại' + (status ? ' (' + status + ')' : '') + '.';
  }

  async function request(path, method, body, opts) {
    const options = Object.assign({
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + getToken()
      }
    }, opts || {});

    if (body !== undefined && body !== null) options.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(cfg.API_BASE + path, options);
    } catch (e) {
      throw new Error(friendly(e.message, 0));
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || friendly('', res.status);
      const err = new Error(friendly(msg, res.status));
      err.status = res.status;
      if (res.status === 401) {
        // Token hỏng/hết hạn → đăng xuất
        setTimeout(() => PU.auth.logout(true), 60);
      }
      throw err;
    }

    // Backend bọc dữ liệu trong ApiResponse { data: ... }
    if (data && typeof data === 'object' && 'data' in data && data.data !== undefined) return data.data;
    return data;
  }

  return {
    getToken,
    setToken,
    getRole,
    setRole,
    get: (p) => request(p, 'GET'),
    post: (p, b) => request(p, 'POST', b),
    put: (p, b) => request(p, 'PUT', b),
    patch: (p, b) => request(p, 'PATCH', b),
    del: (p) => request(p, 'DELETE'),
    raw: request
  };
})();
