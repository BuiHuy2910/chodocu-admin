/* =============================================================================
   HTTP client — gắn Bearer token, gộp GET trùng lặp, hỗ trợ AbortController
   ============================================================================= */
window.PU = window.PU || {};

PU.http = (function () {
  const cfg = PU.config;
  const inflightGets = new Map(); // path → Promise (chống bắn trùng GET cùng lúc)

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

  // Ghép object thành "?a=1&b=2", tự bỏ qua các tham số rỗng/null
  function query(params) {
    if (!params) return '';
    const usp = new URLSearchParams();
    Object.keys(params).forEach(key => {
      const val = params[key];
      if (val !== undefined && val !== null && val !== '') {
        usp.set(key, String(val));
      }
    });
    const str = usp.toString();
    return str ? '?' + str : '';
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

  async function sendRequest(path, method, body, opts) {
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
      if (e && e.name === 'AbortError') {
        const aborted = new Error('Đã huỷ yêu cầu cũ');
        aborted.aborted = true;
        throw aborted;
      }
      throw new Error(friendly(e.message, 0));
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || friendly('', res.status);
      const err = new Error(friendly(msg, res.status));
      err.status = res.status;
      if (res.status === 401 && !path.startsWith('/auth/')) {
        setTimeout(() => PU.auth.logout(true), 60);
      }
      throw err;
    }

    if (data && typeof data === 'object' && 'data' in data && data.data !== undefined) return data.data;
    return data;
  }

  function request(path, method, body, opts) {
    const verb = (method || 'GET').toUpperCase();
    // Chỉ gộp các request GET không gắn AbortSignal riêng
    if (verb === 'GET' && !(opts && opts.signal)) {
      if (inflightGets.has(path)) return inflightGets.get(path);
      const p = sendRequest(path, verb, null, opts).finally(() => inflightGets.delete(path));
      inflightGets.set(path, p);
      return p;
    }
    return sendRequest(path, verb, body, opts);
  }

  return {
    getToken,
    setToken,
    getRole,
    setRole,
    query,
    get: (p, opts) => request(p, 'GET', null, opts),
    post: (p, b, opts) => request(p, 'POST', b, opts),
    put: (p, b, opts) => request(p, 'PUT', b, opts),
    patch: (p, b, opts) => request(p, 'PATCH', b, opts),
    del: (p, opts) => request(p, 'DELETE', null, opts),
    raw: request
  };
})();
