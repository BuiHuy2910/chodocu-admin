/* =============================================================================
   Duyệt bài đăng — kiểm tra tự động.
   Đây chỉ là CẢNH BÁO giúp kiểm duyệt viên chú ý, không chặn nút Duyệt.
   Mỗi luật nhận một tin đăng và trả về null (ổn) hoặc một cảnh báo:
     { level: 'danger' | 'warn', icon, text, refId? (id tin liên quan) }
   ============================================================================= */
window.PU = window.PU || {};

PU.pendingChecks = (function () {
  const ui = PU.ui;
  const product = PU.product;

  const MIN_DESCRIPTION = 30;      // số ký tự mô tả tối thiểu
  const MAX_PRICE = 20000000;      // giá trên mức này cần xem kỹ
  const SIMILAR_TITLE = 0.85;      // độ giống tiêu đề (0..1) để coi là tin trùng

  // Số điện thoại VN: 0912345678, 0912 345 678, 0912.345.678, +84 912 345 678…
  const PHONE = /(?:^|\D)((?:\+?84|0)[1-9](?:[\s.-]?\d){7,9})(?!\d)/;
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|vn|net|org|me|io|ly|gl)\b\S*/i;
  // So khớp trên chữ đã bỏ dấu nên bắt được cả "SĐT", "Số điện thoại"
  const SOCIAL = /\b(zalo|facebook|fb|messenger|instagram|insta|telegram|tiktok|sdt|so dien thoai)\b/;

  function issue(level, icon, text, refId) {
    return { level, icon, text, refId };
  }

  /* -------------------------------- CÁC LUẬT -------------------------------- */
  function checkImages(p) {
    const count = product.images(p).length;
    if (count === 0) return issue('danger', 'image_not_supported', 'Không có ảnh sản phẩm');
    if (count < 2) return issue('warn', 'photo_library', 'Chỉ có 1 ảnh — nên có ít nhất 2 góc chụp');
    return null;
  }

  function checkDescription(p) {
    const length = String(p.description || '').trim().length;
    if (length === 0) return issue('warn', 'notes', 'Chưa có mô tả');
    if (length < MIN_DESCRIPTION) {
      return issue('warn', 'notes', `Mô tả quá ngắn (${length} ký tự, nên từ ${MIN_DESCRIPTION} ký tự)`);
    }
    return null;
  }

  function checkZeroPrice(p) {
    const zero = Number(p.price) === 0 && !p.isFree;
    return zero ? issue('warn', 'money_off', 'Giá 0đ nhưng không đánh dấu "Miễn phí"') : null;
  }

  function checkAboveOriginal(p) {
    const price = Number(p.price);
    const original = Number(p.originalPrice);
    if (!(original > 0 && price > original)) return null;
    return issue('warn', 'trending_up', `Giá bán (${ui.fmt(price)}) cao hơn giá gốc (${ui.fmt(original)})`);
  }

  function checkHighPrice(p) {
    return Number(p.price) > MAX_PRICE
      ? issue('warn', 'paid', `Giá trên ${ui.fmt(MAX_PRICE)} — kiểm tra kỹ`)
      : null;
  }

  function checkContact(p) {
    const found = findContact(`${p.title || ''}\n${p.description || ''}`);
    return found ? issue('danger', 'contact_phone', `Có thông tin liên hệ ngoài nền tảng: “${found}”`) : null;
  }

  // Trả về đoạn chữ vi phạm đầu tiên tìm thấy, hoặc null
  function findContact(text) {
    const phone = text.match(PHONE);
    if (phone) return phone[1].trim();
    const link = text.match(EMAIL) || text.match(LINK);
    if (link) return link[0];
    const social = ui.normalize(text).match(SOCIAL);
    return social ? social[1] : null;
  }

  function checkAllCaps(p) {
    const letters = String(p.title || '').replace(/[^\p{L}]/gu, '');
    const shouting = letters.length >= 6 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
    return shouting ? issue('warn', 'text_fields', 'Tiêu đề viết HOA toàn bộ') : null;
  }

  // Cùng người bán đã có tin khác (đang chờ hoặc đã duyệt) với tiêu đề gần giống
  function checkDuplicate(p, context) {
    const twin = (context.sellerProducts || []).find(other =>
      other.id !== p.id &&
      (other.status === 'PENDING' || other.status === 'APPROVED') &&
      similarity(other.title, p.title) >= SIMILAR_TITLE);
    if (!twin) return null;
    return issue('warn', 'content_copy',
      `Người bán có tin tương tự: “${twin.title}” (${ui.statusLabel(twin.status)})`, twin.id);
  }

  function checkSellerLocked(p) {
    return product.seller(p).active === false
      ? issue('danger', 'lock', 'Tài khoản người bán đang bị khoá')
      : null;
  }

  /* ---------------------------- SO KHỚP TIÊU ĐỀ ----------------------------- */
  // Độ giống nhau 0..1 (hệ số Dice trên từng cặp ký tự liền nhau),
  // không phân biệt dấu, hoa/thường, khoảng trắng hay dấu câu.
  function similarity(a, b) {
    const x = compact(a);
    const y = compact(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    if (x.length < 2 || y.length < 2) return 0;

    const pairs = new Map();
    for (let i = 0; i < x.length - 1; i++) {
      const pair = x.slice(i, i + 2);
      pairs.set(pair, (pairs.get(pair) || 0) + 1);
    }
    let shared = 0;
    for (let i = 0; i < y.length - 1; i++) {
      const pair = y.slice(i, i + 2);
      if (pairs.get(pair) > 0) {
        shared++;
        pairs.set(pair, pairs.get(pair) - 1);
      }
    }
    return (2 * shared) / (x.length + y.length - 2);
  }

  function compact(text) {
    return ui.normalize(text).replace(/[^a-z0-9]/g, '');
  }

  /* ---------------------------------- CHẠY ---------------------------------- */
  const RULES = [
    checkImages, checkDescription, checkZeroPrice, checkAboveOriginal, checkHighPrice,
    checkContact, checkAllCaps, checkDuplicate, checkSellerLocked
  ];

  // context.sellerProducts: mọi tin của cùng người bán (để tìm tin trùng)
  // Kết quả: cảnh báo nghiêm trọng (danger) xếp lên trước
  function run(p, context) {
    const rank = level => (level === 'danger' ? 0 : 1);
    return RULES
      .map(rule => rule(p, context || {}))
      .filter(Boolean)
      .sort((a, b) => rank(a.level) - rank(b.level));
  }

  return { run, similarity };
})();
