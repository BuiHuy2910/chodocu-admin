/* =============================================================================
   PassUni Admin — cấu hình chung
   Đổi API_BASE sang IP LAN khi chạy backend trên máy khác, ví dụ:
     http://192.168.1.10:8080/api
   ============================================================================= */
window.PU = window.PU || {};

PU.config = {
  API_BASE: 'http://localhost:8080/api',

  SUPABASE_URL: 'https://ovxnlepmewindufcgxln.supabase.co',

  // Khóa localStorage
  TOKEN_KEY: 'passuni_admin_token',
  ROLE_KEY: 'passuni_admin_role',

  // Vai trò được phép vào trang quản trị
  ALLOWED_ROLES: ['ADMIN', 'MODERATOR'],

  // Ảnh dự phòng (JPEG — Coil/trình duyệt đều đọc được)
  FALLBACK_AVATAR: 'https://i.pravatar.cc/80?img=12',
  FALLBACK_PRODUCT: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400&auto=format&fit=crop&q=60',

  REFRESH_INTERVAL_MS: 0 // 0 = tắt tự động làm mới
};
