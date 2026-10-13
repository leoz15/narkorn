import { EVENT, getStats, onStats } from '../store.js';
import { countUp, footer } from '../ui.js';

const FEATURES = [
  { ico: '📝', bg: '#fde7cf', title: 'ลงทะเบียน & QR Ticket', text: 'กรอกชื่อและเบอร์โทร รับ QR ประจำตัวทันที ใช้เช็กอินหน้างานได้เลย', href: '#/register', status: 'ok', label: 'พร้อมใช้งาน' },
  { ico: '🗺️', bg: '#e3efd9', title: '3D Event Map', text: 'สำรวจโบสถ์ เวทีดนตรี และซุ้มอาหาร ในโลกจำลองแบบ Isometric', href: '#/map', status: 'ok', label: 'พร้อมใช้งาน' },
  { ico: '📸', bg: '#f9dcda', title: 'Digital Polaroid', text: 'ถ่ายรูปคู่กับภาพพระนวกะ พร้อมคำอวยพร แล้วบันทึกเก็บไว้เป็นความทรงจำ', href: '#/polaroid', status: 'ok', label: 'พร้อมใช้งาน' },
  { ico: '🗓️', bg: '#e6eef8', title: 'กำหนดการ', text: 'ตารางพิธีบวชและการแสดงดนตรีตลอดทั้งวัน อัปเดตจากทีมงานแบบเรียลไทม์', href: '#/schedule', status: 'soon', label: 'เร็ว ๆ นี้' },
  { ico: '🎁', bg: '#fbf0d0', title: 'รับของที่ระลึก', text: 'ผู้ที่เช็กอินแล้วรับ Gift QR สิทธิ์ 1 ครั้งต่อคน', href: '#/gift', status: 'soon', label: 'เร็ว ๆ นี้' },
  { ico: '🪷', bg: '#efe4f6', title: 'ร่วมทำบุญ', text: 'โอนเงินและแนบสลิป ยอดบริจาคแสดงอย่างโปร่งใสหลังตรวจสอบ', href: '#/donate', status: 'soon', label: 'เร็ว ๆ นี้' },
];

export async function render(el) {
  el.innerHTML = `
  <section class="page container">
    <div class="hero">
      <div>
        <span class="eyebrow">☸ งานบุญ + Music Festival</span>
        <h1 id="hero-title">งานบวช <span class="amp">&</span> ดนตรี</h1>
        <div class="sub">MERIT FEST · ${EVENT.tagline}</div>
        <p class="lead">ร่วมเป็นส่วนหนึ่งของวันสำคัญ ลงทะเบียนล่วงหน้า สำรวจบรรยากาศงานผ่านแผนที่ 3D และเก็บความทรงจำด้วยภาพ Polaroid กับพระนวกะ</p>
        <div class="hero-cta">
          <a href="#/register" class="btn btn-primary btn-lg" id="hero-register">📝 ลงทะเบียนรับ QR</a>
          <a href="#/map" class="btn btn-lg" id="hero-map">🗺️ ดูแผนที่ 3D</a>
        </div>
        <div class="countdown" id="countdown">
          ${['วัน', 'ชั่วโมง', 'นาที', 'วินาที'].map((l, i) => `<div class="unit"><div class="num" data-i="${i}">--</div><div class="lbl">${l}</div></div>`).join('')}
        </div>
        <div class="hero-meta">
          <div>📅 ${EVENT.dateTh}</div>
          <div>📍 ${EVENT.venue}</div>
        </div>
      </div>
      <div class="hero-art">
        <div class="frame"><img src="./assets/hero.jpg" alt="ภาพจำลองบรรยากาศงาน MERIT FEST: โบสถ์ เวทีดนตรี และซุ้มอาหาร" /></div>
        <div class="sticker s1"><span style="font-size:26px">🙏</span><div><strong id="hero-reg">0</strong>ผู้ลงทะเบียน</div></div>
        <div class="sticker s2"><span class="badge ok"><span class="dot live"></span> Live</span><div><strong id="hero-chk">0</strong>เช็กอินแล้ว</div></div>
      </div>
    </div>

    <div class="section">
      <div class="grid grid-3">
        <div class="card stat"><span class="k">ผู้ลงทะเบียนทั้งหมด</span><span class="v"><span id="st-reg">0</span> <small>คน</small></span></div>
        <div class="card stat"><span class="k">เช็กอินเข้างานแล้ว</span><span class="v"><span id="st-chk">0</span> <small>คน</small></span></div>
        <div class="card stat"><span class="k">เป้าหมายผู้ร่วมงาน</span><span class="v">${EVENT.target} <small>คน</small></span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <span class="eyebrow">Experience</span>
        <h2>ทุกอย่างของงาน ในแพลตฟอร์มเดียว</h2>
        <p style="color:var(--cocoa-2)">ตั้งแต่ลงทะเบียน เช็กอิน จนถึงเก็บภาพความทรงจำและร่วมทำบุญ</p>
      </div>
      <div class="grid grid-3">
        ${FEATURES.map((f, i) => `
          <a href="${f.href}" class="card hover feature" id="feature-${i}">
            <span class="badge ${f.status}">${f.label}</span>
            <div class="ico" style="background:${f.bg}">${f.ico}</div>
            <h3>${f.title}</h3>
            <p>${f.text}</p>
            <span style="color:var(--saffron-d);font-weight:500;font-size:14px">เปิดดู →</span>
          </a>`).join('')}
      </div>
    </div>
  </section>
  ${footer()}`;

  // countdown
  const target = new Date(EVENT.date).getTime();
  const nums = el.querySelectorAll('#countdown .num');
  const tick = () => {
    let d = Math.max(0, target - Date.now());
    const parts = [86400000, 3600000, 60000, 1000].map(u => { const v = Math.floor(d / u); d -= v * u; return v; });
    nums.forEach((n, i) => n.textContent = String(parts[i]).padStart(2, '0'));
  };
  tick();
  const timer = setInterval(tick, 1000);

  // stats
  const apply = s => {
    ['st-reg', 'hero-reg'].forEach(id => countUp(el.querySelector('#' + id), s.registered));
    ['st-chk', 'hero-chk'].forEach(id => countUp(el.querySelector('#' + id), s.checkedIn));
  };
  apply(await getStats());
  const off = onStats(apply);

  return () => { clearInterval(timer); off(); };
}
