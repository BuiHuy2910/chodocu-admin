/* =============================================================================
   Đọc dữ liệu tin đăng (ProductResponse) một cách an toàn.
   Gom về một chỗ để các module không phải lặp lại kiểu `p.a || (p.b && p.b.c)`.
   ============================================================================= */
window.PU = window.PU || {};

PU.product = (function () {
  const ui = PU.ui;

  const DAY_MS = 24 * 60 * 60 * 1000;

  // Các trạng thái được tính là "đã qua kiểm duyệt"
  const APPROVED_STATES = ['APPROVED', 'IN_TRANSACTION', 'SOLD'];

  function images(p) {
    return ((p && p.imageUrls) || []).filter(Boolean);
  }

  function category(p) {
    return p.categoryName || (p.category && p.category.name) || '';
  }

  // Tên viết tắt của trường (dùng cho bộ lọc); thiếu thì dùng tên đầy đủ
  function school(p) {
    return p.universityShortName || p.universityName || '';
  }

  function seller(p) {
    return p.seller || {};
  }

  // "Như mới", "Còn tốt"… (conditionLabel); thiếu thì dùng mã gốc
  function condition(p) {
    return p.conditionLabel || p.condition || '';
  }

  // Ưu tiên createdAtIso (chuẩn ISO), backend cũ chỉ có createdAt "dd/MM/yyyy HH:mm"
  function createdAt(p) {
    return ui.parseDate(p.createdAtIso) || ui.parseDate(p.createdAt);
  }

  function isApproved(p) {
    return APPROVED_STATES.includes(p.status);
  }

  // Thời gian chờ duyệt: { label: "chờ 3 giờ", late: true nếu quá 24 giờ }
  function waiting(p) {
    const created = createdAt(p);
    if (!created) return { label: 'chưa rõ thời gian', late: false };
    const ms = Date.now() - created.getTime();
    return { label: 'chờ ' + ui.duration(ms), late: ms > DAY_MS };
  }

  return { images, category, school, seller, condition, createdAt, isApproved, waiting };
})();
