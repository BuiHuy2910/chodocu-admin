# PassUni Admin — v3.0

Trang quản trị (static, không cần build) cho chợ đồ cũ sinh viên PassUni.
Dùng **REST API của backend Spring Boot** (`/api/**`).

## Chạy

```powershell
# 1. Bật backend
cd ..\chodocu-backend
.\mvnw.cmd spring-boot:run

# 2. Mở trang admin
start index.html
# hoặc serve tĩnh (khuyến nghị khi dev):
python -m http.server 5500
# -> http://localhost:5500
```

Tài khoản mặc định (đã seed trong `seed_data.sql`):

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@chodocu.edu.vn` | `admin123` |
| Moderator | `mod@passuni.vn` | `password123` |

## Cấu trúc thư mục

```
chodocu-admin/
├── index.html                 # Shell: màn đăng nhập, layout, các section, modal
├── README.md
├── css/
│   └── admin.css              # Design system thuần CSS (tokens + components)
└── js/
    ├── config.js              # API_BASE, Supabase URL, khoá localStorage
    ├── app.js                 # Bootstrap: bind event, khôi phục phiên, phím tắt
    ├── core/
    │   ├── http.js            # fetch wrapper: Bearer token, chuẩn hoá lỗi
    │   ├── ui.js              # format, badge, toast, modal, confirm, skeleton
    │   ├── auth.js            # đăng nhập / đăng xuất / khôi phục phiên
    │   └── router.js          # chuyển section + gọi loader
    └── modules/
        ├── dashboard.js       # KPI + 2 biểu đồ Chart.js
        ├── pending.js         # duyệt / từ chối bài đăng
        ├── products.js        # bảng sản phẩm, chi tiết, nhật ký duyệt
        ├── orders.js          # đơn hàng + can thiệp trạng thái
        ├── financial.js       # phí sàn, bậc phí, giao dịch
        ├── users.js           # khoá / xác thực / đổi vai trò
        ├── reports.js         # xử lý báo cáo vi phạm
        └── settings.js        # platform_settings
```

## Quy ước code

- Không dùng bundler, không ES module → nạp bằng `<script>` cổ điển để mở được `file://`.
- Mọi thứ nằm trong namespace `window.PU`: `PU.config`, `PU.http`, `PU.ui`,
  `PU.auth`, `PU.router`, `PU.modules.<tên>`.
- DOM handler viết inline dạng `onclick="PU.<module>.<fn>(id)"`.
- **Không dùng `@apply` của Tailwind trong `<style>`** (Tailwind Play CDN bỏ qua,
  component sẽ mất style). Toàn bộ component nằm trong `css/admin.css`.

## Đổi endpoint backend

`js/config.js`:

```js
API_BASE: 'http://localhost:8080/api'
// Máy khác trong LAN: 'http://192.168.1.10:8080/api'
```

## API đang dùng

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/profile` |
| Thống kê | `GET /admin/stats`, `GET /admin/financial` |
| Sản phẩm | `GET /admin/products?status=`, `PUT /admin/products/{id}/approve`, `PUT /admin/products/{id}/reject`, `DELETE /admin/products/{id}`, `GET /products/{id}` |
| Kiểm duyệt | `GET /admin/moderation-logs` |
| Đơn hàng | `GET /admin/orders?status=`, `PUT /admin/orders/{id}/status` |
| Phí sàn | `GET/POST/PUT/DELETE /admin/fee-tiers`, `GET /admin/fee/preview?amount=` |
| Cài đặt | `GET /admin/settings`, `PUT /admin/settings/{key}` |
| Người dùng | `GET /admin/users`, `PUT /admin/users/{id}/toggle-active`, `/toggle-verified`, `/role` |
| Báo cáo | `GET /admin/reports?status=`, `PUT /admin/reports/{id}/resolve` |
