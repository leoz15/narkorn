import { EVENT, getMyTicket, getByToken, findByPhone, saveMyTicket, clearMyTicket, qrPayload, onStats } from '../store.js';
import { esc, qrDataUrl, fmtTime, downloadDataUrl, toast, footer } from '../ui.js';

/** Ticket card markup (shared with register page). */
export async function ticketCard(t) {
  const qr = await qrDataUrl(qrPayload(t.token), 8);
  const checked = t.status === 'checked_in';
  return `
  <article class="ticket" id="ticket-card">
    <div class="ticket-head">
      <small>MERIT FEST · E-TICKET</small>
      <h2>งานบวช & ดนตรี</h2>
      <div style="font-size:13px;opacity:.95;margin-top:4px">📅 ${EVENT.dateTh}</div>
    </div>
    <div class="ticket-body">
      <div class="ticket-qr"><img src="${qr}" alt="QR Code สำหรับเช็กอิน ${esc(t.id)}" id="ticket-qr-img" /></div>
      <div class="ticket-id">${esc(t.id)}</div>
      <div class="ticket-name">${esc(t.fullName)}</div>
      <div style="margin-top:10px">
        ${checked
          ? `<span class="badge ok">✅ เช็กอินแล้ว · ${fmtTime(t.checkedInAt)}</span>`
          : `<span class="badge warn">⏳ รอเช็กอินหน้างาน</span>`}
      </div>
    </div>
    <div class="ticket-perf"></div>
    <div class="ticket-foot">
      <div><div class="k">เบอร์โทร</div>${esc(t.phoneMasked)}</div>
      <div><div class="k">ลงทะเบียนเมื่อ</div>${fmtTime(t.createdAt)}</div>
      <div><div class="k">สถานที่</div>${esc(EVENT.venue)}</div>
      <div><div class="k">สิทธิ์</div>${checked ? 'Polaroid · ของที่ระลึก' : 'ปลดล็อกหลังเช็กอิน'}</div>
    </div>
  </article>`;
}

/** Export the ticket as a PNG for saving to the phone gallery. */
export async function ticketImage(t) {
  const W = 720, H = 1080, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  await document.fonts.ready;
  g.fillStyle = '#fbf3e6'; g.fillRect(0, 0, W, H);
  // card
  g.save(); g.shadowColor = 'rgba(74,52,40,.18)'; g.shadowBlur = 40; g.shadowOffsetY = 16;
  roundRect(g, 60, 60, W - 120, H - 120, 40); g.fillStyle = '#fffaf2'; g.fill(); g.restore();
  // header gradient
  g.save(); roundRect(g, 60, 60, W - 120, 220, 40, true); g.clip();
  const grd = g.createLinearGradient(60, 60, W - 60, 280); grd.addColorStop(0, '#e8913a'); grd.addColorStop(1, '#d4a24c');
  g.fillStyle = grd; g.fillRect(60, 60, W - 120, 220); g.restore();
  g.fillStyle = '#fff'; g.font = '500 20px Prompt'; g.fillText('MERIT FEST · E-TICKET', 110, 130);
  g.font = '700 52px Mali'; g.fillText('งานบวช & ดนตรี', 110, 200);
  g.font = '400 22px Prompt'; g.fillText('📅 ' + EVENT.dateTh, 110, 245);
  // qr
  const img = new Image(); img.src = await qrDataUrl(qrPayload(t.token), 10);
  await img.decode();
  g.imageSmoothingEnabled = false;
  g.drawImage(img, W / 2 - 180, 320, 360, 360);
  g.textAlign = 'center'; g.fillStyle = '#4a3428';
  g.font = '700 40px ui-monospace, monospace'; g.fillText(t.id, W / 2, 740);
  g.font = '600 34px Prompt'; g.fillText(t.fullName, W / 2, 795);
  // perforation
  g.setLineDash([12, 10]); g.strokeStyle = 'rgba(74,52,40,.2)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(100, 850); g.lineTo(W - 100, 850); g.stroke(); g.setLineDash([]);
  g.font = '400 22px Prompt'; g.fillStyle = '#7a5f50';
  g.fillText('แสดง QR นี้ต่อเจ้าหน้าที่ ณ จุดเช็กอิน', W / 2, 910);
  g.font = '500 26px Mali'; g.fillStyle = '#c96f1c';
  g.fillText('ขอให้ทุกก้าวของชีวิต เต็มไปด้วยบุญกุศล 🪷', W / 2, 960);
  return c.toDataURL('image/png');
}
function roundRect(g, x, y, w, h, r, topOnly = false) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
  if (topOnly) { g.lineTo(x + w, y + h); g.lineTo(x, y + h); }
  else { g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); }
  g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function bindTicketActions(root, t) {
  root.querySelector('#btn-save-ticket')?.addEventListener('click', async () => {
    downloadDataUrl(await ticketImage(t), `MeritFest-${t.id}.png`);
    toast('บันทึกตั๋วเรียบร้อย', 'ok');
  });
}

import { render as checkinRender } from './checkin.js';

export async function render(el, params = {}) {
  return checkinRender(el, params);
}

