/* =============================================================================
   Lightbox: xem ảnh cỡ lớn.
   ← → chuyển ảnh, Esc hoặc bấm nền tối để đóng.
   ============================================================================= */
window.PU = window.PU || {};

PU.lightbox = (function () {
  const ui = PU.ui;
  const $ = id => document.getElementById(id);

  let urls = [];
  let index = 0;

  function isOpen() {
    const el = $('lightbox');
    return !!el && el.classList.contains('is-open');
  }

  function open(list, start) {
    urls = (list || []).filter(Boolean);
    if (!urls.length) return;
    index = Math.min(Math.max(start || 0, 0), urls.length - 1);
    paint();
    $('lightbox').classList.add('is-open');
  }

  function close() {
    $('lightbox').classList.remove('is-open');
  }

  function step(delta) {
    if (urls.length < 2) return;
    index = (index + delta + urls.length) % urls.length;
    paint();
  }

  function paint() {
    const stage = $('lightboxStage');
    const src = ui.resolveMediaUrl ? ui.resolveMediaUrl(urls[index]) : urls[index];
    stage.classList.remove('is-broken');
    stage.innerHTML = `
      <img src="${ui.esc(src)}" alt="Ảnh ${index + 1}" decoding="async" onerror="PU.ui.imgFail(this)" />
      <div class="pu-lightbox__broken">
        <span class="material-symbols-outlined">image_not_supported</span>Không tải được ảnh
      </div>`;
    $('lightboxCount').textContent = `${index + 1} / ${urls.length}`;
    const single = urls.length < 2;
    $('lightboxPrev').classList.toggle('hidden', single);
    $('lightboxNext').classList.toggle('hidden', single);
  }

  // Bấm vào vùng tối (không phải ảnh hay nút) thì đóng
  function backdropClick(e) {
    if (!e.target.closest('img, button')) close();
  }

  // Bắt phím ở pha "capture" (chạy trước mọi handler khác) để Esc chỉ đóng
  // lightbox, không đóng luôn modal/ngăn kéo đang mở phía dưới.
  const KEYS = {
    Escape: close,
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1)
  };

  window.addEventListener('keydown', e => {
    if (!isOpen() || !KEYS[e.key]) return;
    e.preventDefault();
    e.stopPropagation();
    KEYS[e.key]();
  }, true);

  return { open, close, step, isOpen, backdropClick };
})();
