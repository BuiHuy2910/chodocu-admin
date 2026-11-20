/* =============================================================================
   HTTP client — tối ưu VPS:
   - Không gửi header thừa trên GET để giảm preflight CORS
   - Gộp các GET trùng lặp đang bay
   - Cache Stale-While-Revalidate (RAM + sessionStorage) hiển thị tức thì 0ms
   - Tự động xoá cache ngay khi có thao tác ghi (POST/PUT/PATCH/DELETE)
   ============================================================================= */
window.PU = window.PU || {};

PU.http = (function () {
  const cfg = PU.config;
  const inflightGets = new Map();
  const memCache = new Map(); // path → { data, at }
  const CACHE_PREFIX = cfg.CACHE_PREFIX || 'chodocu_swr_v1:';
  const PREFETCH_TTL = cfg.SECTION_CACHE_TTL_MS || 45000;

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

  /* ------------------------- CACHE PHẢN HỒI (SWR) ------------------------- */
  function writeCache(path, data) {
    if (!path || path.startsWith('/auth/')) return;
    const entry = { data, at: Date.now() };
    memCache.set(path, entry);
    try {
      sessionStorage.setItem(CACHE_PREFIX + path, JSON.stringify(entry));
    } catch (_) {
      // sessionStorage đầy thì chỉ giữ trong RAM
    }
  }

  function peekEntry(path) {
    if (!path) return null;
    if (memCache.has(path)) return memCache.get(path);
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + path);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && 'data' in parsed) {
        memCache.set(path, parsed);
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  // Đọc nhanh bản lưu gần nhất (0ms) để vẽ giao diện ngay trước khi mạng trả về
  function peek(path) {
    const entry = peekEntry(path);
    return entry ? entry.data : null;
  }

  function clearCache() {
    memCache.clear();
    try {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
      }
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
  }

  // Tải trước ngầm khi rê chuột lên menu (bỏ qua nếu vừa tải chưa quá TTL)
  function prefetch(path) {
    if (!path || !getToken()) return;
    const hit = peekEntry(path);
    if (hit && Date.now() - hit.at < PREFETCH_TTL) return;
    request(path, 'GET').catch(() => {});
  }

  function friendly(message, status) {
    const m = String(message || '');
    if (m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('ERR_CONNECTION')) {
      return 'Không kết nối được backend. Kiểm tra kết nối tới ' + cfg.API_BASE;
    }
    if (status === 401) return m || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    if (status === 403) return m || 'Bạn không có quyền thực hiện thao tác này.';
    if (status === 404) return m || 'Không tìm thấy dữ liệu (404).';
    if (status >= 500) return m || 'Máy chủ gặp lỗi (' + status + ').';
    return m || 'Yêu cầu thất bại' + (status ? ' (' + status + ')' : '') + '.';
  }

  async function sendRequest(path, method, body, opts) {
    const verb = (method || 'GET').toUpperCase();
    const hasBody = body !== undefined && body !== null;
    const token = getToken();

    const headers = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;

    const options = Object.assign({ method: verb }, opts || {});
    options.headers = Object.assign(headers, (opts && opts.headers) || {});
    if (hasBody) options.body = JSON.stringify(body);

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

    const unwrapped = (data && typeof data === 'object' && 'data' in data && data.data !== undefined)
      ? data.data
      : data;

    if (verb === 'GET') writeCache(path, unwrapped);
    else clearCache();

    return unwrapped;
  }

  function request(path, method, body, opts) {
    const verb = (method || 'GET').toUpperCase();
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
    peek,
    prefetch,
    clearCache,
    get: (p, opts) => request(p, 'GET', null, opts),
    post: (p, b, opts) => request(p, 'POST', b, opts),
    put: (p, b, opts) => request(p, 'PUT', b, opts),
    patch: (p, b, opts) => request(p, 'PATCH', b, opts),
    del: (p, opts) => request(p, 'DELETE', null, opts),
    raw: request
  };
})();
