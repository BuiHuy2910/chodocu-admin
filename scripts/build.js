#!/usr/bin/env node
/* =============================================================================
   Đóng gói tài nguyên tĩnh cho môi trường VPS / Cloudflare CDN (không cần npm install):
   - Gộp & nén nhẹ 18 file JS → dist/app.min.js
   - Nén CSS → dist/admin.min.css
   - Tự gắn mã băm (content hash ?v=...) vào index.html để cache dài hạn 1 năm (immutable)
   Chạy: node scripts/build.js
   ============================================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const JS_FILES = [
  'js/config.js',
  'js/core/http.js',
  'js/core/ui.js',
  'js/core/product.js',
  'js/core/lightbox.js',
  'js/core/auth.js',
  'js/core/router.js',
  'js/modules/dashboard.js',
  'js/modules/pending-checks.js',
  'js/modules/pending-view.js',
  'js/modules/pending.js',
  'js/modules/products.js',
  'js/modules/orders.js',
  'js/modules/financial.js',
  'js/modules/users.js',
  'js/modules/reports.js',
  'js/modules/settings.js',
  'js/app.js'
];

function shortHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim() + '\n';
}

// Làm gọn JS an toàn 100% (không đụng chuỗi hay biểu thức chính quy có chứa http://)
function compactJs(source) {
  return source
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/gm, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .join('\n');
}

fs.mkdirSync(DIST, { recursive: true });

// 1. Build CSS
const rawCss = fs.readFileSync(path.join(ROOT, 'css/admin.css'), 'utf8');
const minCss = minifyCss(rawCss);
const cssOut = path.join(DIST, 'admin.min.css');
fs.writeFileSync(cssOut, minCss, 'utf8');
const cssHash = shortHash(minCss);

// 2. Build JS bundle
const bundleParts = JS_FILES.map(rel => {
  const full = path.join(ROOT, rel);
  return compactJs(fs.readFileSync(full, 'utf8'));
});
const bundleJs = bundleParts.join('\n;\n') + '\n';
const jsOut = path.join(DIST, 'app.min.js');
fs.writeFileSync(jsOut, bundleJs, 'utf8');
execFileSync(process.execPath, ['--check', jsOut], { stdio: 'inherit' });
const jsHash = shortHash(bundleJs);

// 3. Cập nhật hash cache-busting trong index.html
const htmlPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html
  .replace(/dist\/admin\.min\.css(?:\?v=[a-z0-9]+)?/g, `dist/admin.min.css?v=${cssHash}`)
  .replace(/dist\/app\.min\.js(?:\?v=[a-z0-9]+)?/g, `dist/app.min.js?v=${jsHash}`);
fs.writeFileSync(htmlPath, html, 'utf8');

console.log(`Built dist/admin.min.css (${Buffer.byteLength(minCss)} B, v=${cssHash})`);
console.log(`Built dist/app.min.js    (${Buffer.byteLength(bundleJs)} B, v=${jsHash})`);
