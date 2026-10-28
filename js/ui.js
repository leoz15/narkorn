/** Small UI helpers shared by pages. */
import { icon } from './icons.js';
export { icon };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, type = '') {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2800);
}

/** Wait for a global from a deferred CDN <script>. */
export function waitForGlobal(name, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function check() {
      if (window[name]) return resolve(window[name]);
      if (Date.now() - t0 > timeout) return reject(new Error(`${name} failed to load`));
      setTimeout(check, 60);
    })();
  });
}

/** Render a QR code into an <img> data URL (uses qrcode-generator). */
export async function qrDataUrl(text, cellSize = 8) {
  const qrcode = await waitForGlobal('qrcode');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize, 2);
}

/** Animate a number counting up. */
export function countUp(el, to, ms = 900) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString('th-TH');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const footer = () => `
  <footer class="footer container">
    <p class="hand">ขอให้ทุกก้าวของชีวิต เต็มไปด้วยความสุขและบุญกุศล 🪷</p>
    <p>MERIT FEST · งานบวช & ดนตรี · 22 พ.ย. 2569 &nbsp;·&nbsp; <a href="#/staff" id="footer-staff">สำหรับเจ้าหน้าที่</a></p>
  </footer>`;
