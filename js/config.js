/* =============================================================================
   Chợ Đồ Cũ Admin — cấu hình chung
   ============================================================================= */
window.PU = window.PU || {};

PU.config = {
  // Địa chỉ backend. Chạy backend trên máy khác trong LAN thì đổi thành
  // ví dụ 'http://192.168.1.10:8080/api'
  API_BASE: 'http://localhost:8080/api',

  SUPABASE_URL: 'https://ovxnlepmewindufcgxln.supabase.co',

  // Khoá lưu phiên đăng nhập trong localStorage
  TOKEN_KEY: 'chodocu_admin_token',
  ROLE_KEY: 'chodocu_admin_role',

  // Vai trò được phép vào trang quản trị
  ALLOWED_ROLES: ['ADMIN', 'MODERATOR'],

  // Màn "Duyệt bài đăng" tự tải lại hàng chờ sau mỗi khoảng này (ms)
  PENDING_REFRESH_MS: 60 * 1000,

  // Tự làm mới toàn trang theo chu kỳ (ms). 0 = tắt
  REFRESH_INTERVAL_MS: 0
};
