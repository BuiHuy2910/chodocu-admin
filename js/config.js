/* =============================================================================
   Chợ Đồ Cũ Admin — cấu hình chung
   ============================================================================= */
window.PU = window.PU || {};

PU.config = {
  // Địa chỉ backend (qua Cloudflare, subdomain api của chodocu.cc.cd)
  API_BASE: 'https://api.chodocu.cc.cd/api',

  SUPABASE_URL: 'https://ovxnlepmewindufcgxln.supabase.co',

  // Khoá lưu phiên đăng nhập & cache hiển thị nhanh
  TOKEN_KEY: 'chodocu_admin_token',
  ROLE_KEY: 'chodocu_admin_role',
  USER_KEY: 'chodocu_admin_user',
  CACHE_PREFIX: 'chodocu_swr_v1:',

  // Vai trò được phép vào trang quản trị
  ALLOWED_ROLES: ['ADMIN', 'MODERATOR'],

  // Kích thước trang mặc định để tránh tải toàn bộ bảng từ Supabase
  DEFAULT_PAGE_SIZE: 15,
  PENDING_PAGE_SIZE: 20,

  // Thời gian giữ dữ liệu màn hình khi chuyển qua lại giữa các tab (ms)
  SECTION_CACHE_TTL_MS: 45 * 1000,

  // Màn "Duyệt bài đăng" tự tải lại hàng chờ sau mỗi khoảng này (ms)
  PENDING_REFRESH_MS: 60 * 1000,

  // Tự làm mới toàn trang theo chu kỳ (ms). 0 = tắt
  REFRESH_INTERVAL_MS: 0
};
