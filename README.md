# Chợ Đồ Cũ Admin — v3.0

Trang quản trị (static, không cần build) cho **Chợ Đồ Cũ** — chợ đồ cũ sinh viên, "Cũ người mới ta".
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

Tài khoản mẫu (có sẵn sau khi chạy `seed_data.sql`). Màn đăng nhập không hiển thị
các tài khoản này, nhập tay email + mật khẩu:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@chodocu.edu.vn` | `admin123` |
| Moderator | `mod@passuni.vn` | `password123` |

Muốn có thêm Moderator: đăng nhập Admin → **Người dùng** → ô "Đổi vai trò".

## Cấu trúc thư mục

```
chodocu-admin/
├── index.html                 # Khung trang: đăng nhập, sidebar, các section, hộp thoại, lightbox
├── README.md
├── assets/brand/              # Logo, favicon (sinh từ chodocu-frontend/docs/brand/make_logo.py)
├── css/
│   └── admin.css              # Design system thuần CSS (tokens + components + responsive)
└── js/
    ├── config.js              # API_BASE, Supabase URL, khoá localStorage, chu kỳ làm mới
    ├── app.js                 # Khởi động: gắn sự kiện chung (form đăng nhập, Esc…), khôi phục phiên
    ├── core/
    │   ├── http.js            # fetch: gắn Bearer token, bóc ApiResponse{data}, chuẩn hoá lỗi, 401 → đăng xuất
    │   ├── ui.js              # định dạng tiền/ngày, badge, ảnh/avatar, lịch sử, toast, modal, trạng thái rỗng
    │   ├── product.js         # đọc trường của tin đăng (ảnh, danh mục, trường, người bán, thời gian chờ…)
    │   ├── lightbox.js        # xem ảnh cỡ lớn (← → Esc)
    │   ├── auth.js            # đăng nhập / đăng xuất / khôi phục phiên (GET /auth/me), ẩn mục theo vai trò
    │   └── router.js          # chuyển section + gọi hàm load() của module
    └── modules/
        ├── dashboard.js       # KPI + 2 biểu đồ Chart.js
        ├── pending.js         # Duyệt bài: trạng thái, tải dữ liệu, duyệt / từ chối / hàng loạt, phím tắt
        ├── pending-view.js    # Duyệt bài: chỉ dựng HTML (hàng chờ, cột chi tiết, thẻ người bán…)
        ├── pending-checks.js  # Duyệt bài: kiểm tra tự động (thiếu ảnh, giá lạ, SĐT trong mô tả, tin trùng…)
        ├── products.js        # bảng sản phẩm, chi tiết + lịch sử, ẩn / hiện lại, nhật ký duyệt
        ├── orders.js          # đơn hàng + can thiệp trạng thái
        ├── financial.js       # phí sàn, bậc phí, giao dịch
        ├── users.js           # khoá / mở khoá tài khoản, đổi vai trò
        ├── reports.js         # xử lý báo cáo vi phạm
        └── settings.js        # platform_settings
```

## Quy ước code

- Không dùng bundler, không ES module → nạp bằng `<script>` cổ điển để mở được `file://`.
  Thứ tự nạp nằm cuối `index.html`: `config` → `core/*` → `modules/*` → `app.js`.
- Mọi thứ nằm trong namespace `window.PU`. Mỗi module tự đăng ký
  `PU.modules.<tên>` rồi gắn alias ở cuối file: `PU.<tên> = PU.modules.<tên>;`
  để HTML gọi ngắn gọn `onclick="PU.pending.approve()"`.
- Dữ liệu người dùng luôn đi qua `PU.ui.esc()` trước khi đưa vào `innerHTML`.
- **Không dùng ảnh mẫu / ảnh stock / ảnh AI.** Ảnh sản phẩm thiếu hoặc lỗi → biểu tượng
  `image_not_supported`; avatar thiếu hoặc lỗi → chữ cái viết tắt của tên (`PU.ui.avatar`).
- Giao diện dùng class trong `css/admin.css` (BEM `pu-khoi__phan--bien-the`, trạng thái `is-…`),
  không viết `style="…"` trong HTML.
- **Không dùng `@apply` của Tailwind trong `<style>`** (Tailwind Play CDN bỏ qua,
  component sẽ mất style). Toàn bộ component nằm trong `css/admin.css`.

## Đổi endpoint backend

`js/config.js`:

```js
API_BASE: 'http://localhost:8080/api'
// Máy khác trong LAN: 'http://192.168.1.10:8080/api'
```

## Phân quyền ADMIN / MODERATOR

Cả hai vai trò đăng nhập được (`/api/admin/**` cho phép ADMIN và MODERATOR).
Phần tử HTML có thuộc tính `data-admin-only` bị ẩn với Moderator (`auth.js`), và
`router.js` không cho mở các section đó.

| Mục | Admin | Moderator |
|---|---|---|
| Tổng quan | ✔ (kèm tổng phí sàn) | ✔ (không có ô phí sàn) |
| Duyệt bài đăng, Sản phẩm, Báo cáo vi phạm | ✔ | ✔ (không có nút **Xoá tin**) |
| Đơn hàng | ✔ | ẩn |
| Tài chính & phí sàn | ✔ | ẩn |
| Người dùng | ✔ | ẩn |
| Cài đặt | ✔ | ẩn |

> Ẩn trên giao diện chỉ để gọn màn hình. Quyền thật do backend quyết định:
> mọi API của các mục "ẩn" ở trên và `DELETE /admin/products/{id}` đều gắn
> `@PreAuthorize(ADMIN_ONLY)` trong `AdminController`, Moderator gọi sẽ nhận lỗi 403.

## Ngày giờ

Backend lưu giờ UTC. API trả hai dạng: `createdAt` dễ đọc (đã đổi sang giờ Việt Nam,
ví dụ `16/11/2026 21:03`) và `createdAtIso` chuẩn ISO có `Z` (ví dụ `2026-11-16T14:03:15Z`).
`PU.ui.parseDate()` đọc được cả hai; trang ưu tiên `createdAtIso` để tính "chờ bao lâu".

## Duyệt bài đăng

- **Hàng chờ** (trái): tin đăng trước được duyệt trước. Có tìm kiếm (không phân biệt dấu),
  lọc danh mục / trường, sắp xếp (cũ nhất, cần chú ý trước, mới nhất, theo giá),
  nút Tải lại và tuỳ chọn **Tự làm mới** mỗi 60 giây.
- **Chi tiết** (phải): ảnh (bấm để phóng to), giá, kết quả **kiểm tra tự động**, thông tin tin,
  mô tả, thẻ người bán (số tin đã duyệt / bị từ chối / đang chờ) và lịch sử kiểm duyệt.
  Màn hình ≤ 1100px: cột chi tiết thành ngăn kéo trượt từ phải.
- **Duyệt / Từ chối / Bỏ qua**: tin rời hàng chờ ngay (cập nhật lạc quan); nếu API lỗi,
  tin được trả lại chỗ cũ và báo lỗi. Bỏ qua = đẩy tin xuống cuối hàng chờ.
- **Từ chối**: chọn nhanh 7 lý do thường gặp hoặc tự nhập (tối đa 255 ký tự).
- **Hàng loạt**: tick nhiều tin (hoặc "Chọn tất cả") → Duyệt / Từ chối cùng lúc (tối đa 100 tin).
- Kiểm tra tự động chỉ để tham khảo, người duyệt vẫn quyết định.

### Phím tắt (khi đang ở mục Duyệt bài, không gõ chữ, không mở hộp thoại)

| Phím | Tác dụng |
|---|---|
| `A` | Duyệt tin đang xem |
| `R` | Từ chối tin đang xem (mở hộp lý do) |
| `S` | Bỏ qua, xem tin sau |
| `J` / `↓` | Tin sau |
| `K` / `↑` | Tin trước |
| `X` | Tick / bỏ tick tin đang xem (cho thao tác hàng loạt) |
| `Ctrl` + `Enter` | Gửi lý do từ chối (trong hộp lý do) |
| `Esc` | Đóng lightbox → hộp thoại → ngăn kéo chi tiết |
| `←` / `→` | Ảnh trước / sau (trong lightbox) |

## API đang dùng

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` (khôi phục phiên khi tải lại trang) |
| Thống kê | `GET /admin/stats` (tổng hợp SQL + số báo cáo chờ + tổng phí sàn cho Admin) |
| Hàng chờ duyệt | `GET /admin/products/pending-queue?page=&size=&keyword=&category=&school=&sort=` (gộp tin chờ + thống kê người bán + lịch sử trong 1 request) |
| Sản phẩm | `GET /admin/products?page=&size=&status=&keyword=`, `GET /admin/products/{id}`, `DELETE /admin/products/{id}` (chỉ Admin), `PUT /admin/products/{id}/hide?hidden=true\|false` |
| Kiểm duyệt | `PUT /admin/products/{id}/approve`, `PUT /admin/products/{id}/reject` `{reason}` |
| Hàng loạt | `PUT /admin/products/bulk-approve` `{ids}`, `PUT /admin/products/bulk-reject` `{ids, reason}` → `{processed, skipped}` |
| Lịch sử | `GET /admin/products/{id}/logs`, `GET /admin/moderation-logs?page=&size=` |
| Đơn hàng | `GET /admin/orders?page=&size=&status=&keyword=`, `PUT /admin/orders/{id}/status` `{status, note}` |
| Phí sàn & GD | `GET /admin/financial?page=&size=` (gộp bậc phí + mô phỏng + trang GD), `GET /admin/transactions?page=&size=`, `GET/POST/PUT/DELETE /admin/fee-tiers`, `GET /admin/fee/preview?amount=` |
| Cài đặt | `GET /admin/settings`, `PUT /admin/settings/{key}` `{value}` |
| Người dùng | `GET /admin/users?page=&size=&role=&keyword=`, `PUT /admin/users/{id}/toggle-active`, `PUT /admin/users/{id}/role` `{role}` |
| Báo cáo | `GET /admin/reports?page=&size=&status=&keyword=`, `PUT /admin/reports/{id}/resolve` `{action, note}` |
