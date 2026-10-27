import { footer } from '../ui.js';

const INFO = {
  gift: { ico: '🎁', title: 'รับของที่ระลึก', text: 'ระบบรับ Gift QR สำหรับผู้เช็กอินเข้างาน กำลังอยู่ในระหว่างเตรียมความพร้อม' },
  admin: { ico: '⚙️', title: 'Admin Console', text: 'ระบบจัดการและสถิติสำหรับผู้ดูแลงาน' },
};

export async function render(el, page = 'soon') {
  const meta = INFO[page] || { ico: '⏳', title: 'เร็ว ๆ นี้', text: 'หน้านี้กำลังอยู่ระหว่างการพัฒนา' };
  el.innerHTML = `
    <section class="page container">
      <div class="card soon-hero glass" style="max-width:560px;margin:40px auto;text-align:center;padding:48px 24px;">
        <div class="big-ico" style="font-size:64px;margin-bottom:12px;">${meta.ico}</div>
        <h1 style="font-family:var(--hand);">${meta.title}</h1>
        <p style="color:var(--cocoa-2);margin:16px auto 28px;max-width:420px;">${meta.text}</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <a href="#/schedule" class="btn btn-primary">🗓️ ดูกำหนดการงานบวช</a>
          <a href="#/" class="btn">🏠 กลับหน้าหลัก</a>
        </div>
      </div>
    </section>
    ${footer()}
  `;
}
