import * as THREE from 'three';
import { EVENT, getMyTicket, getByToken, findByPhone, saveMyTicket, clearMyTicket, onStats } from '../store.js';
import { esc, fmtTime, downloadDataUrl, toast, footer } from '../ui.js';
import { buildMe } from './map-character.js';

let activeAvatarHandle = null;

/** Mount live animated 3D half-body bust of chosen character */
export function mountTicketAvatar(canvas, gender = 'male') {
  if (!canvas) return null;
  if (activeAvatarHandle) {
    try { activeAvatarHandle.destroy(); } catch (_) {}
    activeAvatarHandle = null;
  }

  const w = canvas.clientWidth || 130, h = canvas.clientHeight || 130;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10);
  camera.position.set(0, 0.02, 1.38);
  camera.lookAt(0, 0.02, 0);

  // Soft warm studio lighting for smooth clay look
  const amb = new THREE.AmbientLight(0xfff5eb, 1.45);
  const dir = new THREE.DirectionalLight(0xffffff, 1.75);
  dir.position.set(1.2, 1.8, 1.6);
  const fill = new THREE.DirectionalLight(0xfde8db, 0.85);
  fill.position.set(-1.2, 0.7, -0.8);
  scene.add(amb, dir, fill);

  const disposables = [];
  const { body } = buildMe(disposables, { gender, halfBody: true });
  // Center head-to-chest portrait in round viewport
  body.position.set(0, -1.16, 0);
  scene.add(body);

  const head = body.getObjectByName('me_head');
  const torso = body.getObjectByName('me_torso');
  const armL = body.getObjectByName('me_armL');
  const foreL = body.getObjectByName('me_foreL');
  const armR = body.getObjectByName('me_armR');
  const foreR = body.getObjectByName('me_foreR');

  let running = true;
  let rafId = 0;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Natural breathing & head tilt
    if (torso) {
      torso.position.y = 0.08 + Math.sin(t * 2.2) * 0.012;
      torso.rotation.y = Math.sin(t * 1.4) * 0.05;
      torso.rotation.z = Math.sin(t * 1.8) * 0.02;
    }
    if (head) {
      head.rotation.y = Math.sin(t * 1.6) * 0.12;
      head.rotation.x = Math.sin(t * 2.2) * 0.035;
      head.rotation.z = Math.sin(t * 1.6 + 0.6) * 0.035;
    }
    // Friendly greeting wave with right arm 👋
    if (armR && foreR) {
      armR.rotation.x = -0.35 + Math.sin(t * 2.4) * 0.08;
      armR.rotation.z = -0.62 + Math.sin(t * 3.6) * 0.14;
      foreR.rotation.z = -0.68 + Math.sin(t * 3.6) * 0.20;
    }
    // Left arm resting gracefully
    if (armL && foreL) {
      armL.rotation.z = 0.12 + Math.sin(t * 2.0) * 0.03;
      foreL.rotation.x = -0.18 + Math.sin(t * 2.2) * 0.025;
    }

    renderer.render(scene, camera);
  }
  animate();

  const handle = {
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      disposables.forEach(d => d?.dispose?.());
      renderer.dispose();
      if (activeAvatarHandle === handle) activeAvatarHandle = null;
    }
  };
  activeAvatarHandle = handle;
  return handle;
}

/** Ticket card markup (shared with register page). */
export async function ticketCard(t) {
  return `
  <article class="ticket" id="ticket-card">
    <div class="ticket-head">
      <small style="letter-spacing:.18em;font-size:12px">22 พฤศจิกาขอลาบวช</small>
      <h2 style="font-size:28px;margin-top:2px">ธนกร วงศ์คำภู</h2>
      <div style="font-size:13px;opacity:.95;margin-top:4px">📅 ${EVENT.dateTh}</div>
    </div>
    <div class="ticket-body">
      <div class="ticket-emblem">
        <div class="ticket-emblem-ring" title="${t.gender === 'female' ? 'ตัวละครหญิง 👧' : 'ตัวละครชาย 👦'}">
          <canvas id="ticket-avatar-canvas" class="ticket-avatar-canvas" width="130" height="130" aria-label="ตัวละคร 3D ${t.gender === 'female' ? 'หญิง' : 'ชาย'}"></canvas>
        </div>
      </div>
      <div class="ticket-guest-badge">บัตรประจำตัวผู้ร่วมงาน</div>
      <div class="ticket-name">${esc(t.fullName)} <span class="ticket-gender-pill">${t.gender === 'female' ? '👧 หญิง' : '👦 ชาย'}</span></div>
      <p class="ticket-blessing">ขออนุโมทนาบุญและยินดีต้อนรับสู่งานบุญ 🙏</p>
    </div>
    <div class="ticket-perf"></div>
    <div class="ticket-foot">
      <div><div class="k">เบอร์โทรศัพท์</div>${esc(t.phoneMasked || t.phone)}</div>
      <div><div class="k">ลงทะเบียนเมื่อ</div>${fmtTime(t.createdAt)}</div>
      <div><div class="k">สถานที่จัดงาน</div>${esc(EVENT.venue)}</div>
      <div><div class="k">สิทธิ์ร่วมงาน</div>Polaroid · สอยดาว · ของที่ระลึก</div>
      <div style="grid-column:span 2;padding-top:10px;margin-top:4px;border-top:1px dashed rgba(74,52,40,0.14);display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted)">
        <span>รหัสผู้ร่วมงาน (Ref ID)</span>
        <span style="font-family:ui-monospace, monospace;font-weight:600;letter-spacing:.06em;color:var(--cocoa-2)">${esc(t.id)}</span>
      </div>
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
  g.save(); roundRect(g, 60, 60, W - 120, 240, 40, true); g.clip();
  const grd = g.createLinearGradient(60, 60, W - 60, 300); grd.addColorStop(0, '#e8913a'); grd.addColorStop(1, '#d4a24c');
  g.fillStyle = grd; g.fillRect(60, 60, W - 120, 240); g.restore();
  g.fillStyle = '#fff'; g.font = '500 22px Prompt'; g.fillText('22 พฤศจิกาขอลาบวช', 110, 130);
  g.font = '700 48px Mali'; g.fillText('ธนกร วงศ์คำภู', 110, 205);
  g.font = '400 22px Prompt'; g.fillText('📅 ' + EVENT.dateTh, 110, 255);

  // Center emblem ring
  const cy = 410;
  g.save();
  g.shadowColor = 'rgba(232,145,58,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 6;
  g.beginPath(); g.arc(W / 2, cy, 80, 0, Math.PI * 2);
  g.fillStyle = '#fffdf7'; g.fill();
  g.lineWidth = 4; g.strokeStyle = '#e5b34a'; g.stroke();
  g.restore();

  // Draw 3D avatar snapshot into emblem ring
  const avatarCanvas = document.getElementById('ticket-avatar-canvas');
  if (avatarCanvas) {
    g.save();
    g.beginPath();
    g.arc(W / 2, cy, 78, 0, Math.PI * 2);
    g.clip();
    g.drawImage(avatarCanvas, W / 2 - 78, cy - 78, 156, 156);
    g.restore();
  } else {
    g.textAlign = 'center';
    g.font = '56px "Segoe UI Emoji", sans-serif';
    g.fillText(t.gender === 'female' ? '👧' : '👦', W / 2, cy + 20);
  }

  // Badge label
  g.textAlign = 'center';
  g.font = '700 20px Prompt'; g.fillStyle = '#c96f1c';
  g.fillText('บัตรประจำตัวผู้ร่วมงาน', W / 2, 535);

  // Guest Name
  g.fillStyle = '#4a3428';
  g.font = '700 44px Prompt';
  const genderIcon = t.gender === 'female' ? ' 👧' : ' 👦';
  g.fillText(t.fullName + genderIcon, W / 2, 600);

  g.font = '400 22px Prompt'; g.fillStyle = '#7a5f50';
  g.fillText('ขออนุโมทนาบุญและยินดีต้อนรับสู่งานบุญ 🙏', W / 2, 645);

  // perforation
  g.setLineDash([12, 10]); g.strokeStyle = 'rgba(74,52,40,.2)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(100, 700); g.lineTo(W - 100, 700); g.stroke(); g.setLineDash([]);

  // Details
  g.textAlign = 'left';
  const leftX = 120, rightX = W / 2 + 30;

  // Row 1
  g.font = '500 18px Prompt'; g.fillStyle = '#9e8070';
  g.fillText('เบอร์โทรศัพท์', leftX, 760);
  g.fillText('ลงทะเบียนเมื่อ', rightX, 760);
  g.font = '600 24px Prompt'; g.fillStyle = '#4a3428';
  g.fillText(t.phoneMasked || t.phone, leftX, 795);
  g.fillText(fmtTime(t.createdAt), rightX, 795);

  // Row 2
  g.font = '500 18px Prompt'; g.fillStyle = '#9e8070';
  g.fillText('สถานที่จัดงาน', leftX, 850);
  g.fillText('สิทธิ์ร่วมงาน', rightX, 850);
  g.font = '600 22px Prompt'; g.fillStyle = '#4a3428';
  g.fillText('วัดลานคา สุพรรณบุรี', leftX, 885);
  g.fillText('Polaroid · สอยดาว · ของที่ระลึก', rightX, 885);

  // Footer Ref & Blessing
  g.textAlign = 'center';
  g.font = '400 18px ui-monospace, monospace'; g.fillStyle = '#9e8070';
  g.fillText(`Ref ID: ${t.id}`, W / 2, 950);
  g.font = '500 24px Mali'; g.fillStyle = '#c96f1c';
  g.fillText('ขอให้ทุกก้าวของชีวิต เต็มไปด้วยความสุขและบุญกุศล 🪷', W / 2, 995);
  return c.toDataURL('image/png');
}
function roundRect(g, x, y, w, h, r, topOnly = false) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
  if (topOnly) { g.lineTo(x + w, y + h); g.lineTo(x, y + h); }
  else { g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); }
  g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function bindTicketActions(root, t) {
  // Mount live animated 3D character half-body avatar
  const canvas = root.querySelector('#ticket-avatar-canvas');
  if (canvas) {
    mountTicketAvatar(canvas, t.gender || 'male');
  }

  root.querySelector('#btn-save-ticket')?.addEventListener('click', async () => {
    downloadDataUrl(await ticketImage(t), `MeritFest-Badge-${t.id}.png`);
    toast('บันทึกบัตรผู้ร่วมงานเรียบร้อย', 'ok');
  });
}

