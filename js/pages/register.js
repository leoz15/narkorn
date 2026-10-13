import { registerGuest, saveMyTicket, getMyTicket, isValidThaiPhone, ApiError } from '../store.js';
import { esc, toast, footer } from '../ui.js';
import { ticketCard, bindTicketActions } from './ticket.js';

export async function render(el) {
  const existing = await getMyTicket();

  el.innerHTML = `
  <section class="page container">
    <div class="reg-wrap">
      <div class="reg-side">
        <span class="eyebrow">Open Registration</span>
        <h1>ลงทะเบียนร่วมงาน</h1>
        <p style="color:var(--cocoa-2)">เปิดให้ทุกคนลงทะเบียนได้ ไม่ต้องสมัครสมาชิก ใช้เวลาไม่ถึง 1 นาที</p>
        <ol class="steps">
          <li><span class="n">1</span><p><strong>กรอกชื่อและเบอร์โทร</strong>ใช้สำหรับค้นหาตั๋วกรณีทำ QR หาย</p></li>
          <li><span class="n">2</span><p><strong>รับ QR Ticket ทันที</strong>บันทึกลงเครื่องหรือแคปหน้าจอไว้</p></li>
          <li><span class="n">3</span><p><strong>แสดง QR ที่จุดเช็กอิน</strong>เจ้าหน้าที่สแกน แล้วปลดล็อก Polaroid และของที่ระลึก</p></li>
        </ol>
        ${existing ? `
          <div class="card" style="display:flex;gap:14px;align-items:center">
            <span style="font-size:30px">🎫</span>
            <div style="flex:1"><strong>คุณมีตั๋วแล้ว</strong><div style="font-size:13px;color:var(--cocoa-2)">${esc(existing.id)} · ${esc(existing.fullName)}</div></div>
            <a href="#/ticket" class="btn btn-sm btn-dark" id="reg-view-ticket">ดูตั๋ว</a>
          </div>` : ''}
      </div>

      <div id="reg-panel">
        <form class="card" id="reg-form" novalidate style="padding:30px">
          <h2 style="font-size:22px">ข้อมูลผู้ร่วมงาน</h2>
          <div class="field">
            <label for="reg-name">ชื่อ - นามสกุล</label>
            <input class="input" id="reg-name" name="fullName" autocomplete="name" placeholder="เช่น สมชาย ใจดี" required />
            <span class="err" data-for="fullName"></span>
          </div>
          <div class="field">
            <label for="reg-phone">เบอร์โทรศัพท์</label>
            <input class="input" id="reg-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="08x-xxx-xxxx" maxlength="12" required />
            <small>เบอร์โทรไม่ถูกใส่ใน QR และใช้เพื่อตรวจสอบการลงทะเบียนซ้ำเท่านั้น</small>
            <span class="err" data-for="phone"></span>
          </div>
          <label class="check" for="reg-consent">
            <input type="checkbox" id="reg-consent" name="consent" />
            <span>ยินยอมให้ผู้จัดงานเก็บชื่อและเบอร์โทรเพื่อใช้ในการลงทะเบียนและเช็กอินงานนี้เท่านั้น และจะลบข้อมูลหลังจบงานตามนโยบาย</span>
          </label>
          <span class="err" data-for="consent"></span>
          <button class="btn btn-primary btn-lg btn-block" id="reg-submit" style="margin-top:18px">รับ QR Ticket ✨</button>
        </form>
      </div>
    </div>
  </section>
  ${footer()}`;

  const form = el.querySelector('#reg-form');
  const phone = el.querySelector('#reg-phone');
  phone.addEventListener('input', () => {
    const d = phone.value.replace(/\D/g, '').slice(0, 10);
    phone.value = d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  });

  const setErr = (k, msg) => {
    const e = form.querySelector(`[data-for="${k}"]`); if (e) e.textContent = msg || '';
    form.querySelector(`[name="${k}"]`)?.classList.toggle('invalid', !!msg);
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { fullName: form.fullName.value, phone: form.phone.value, consent: form.consent.checked };
    let ok = true;
    setErr('fullName'); setErr('phone'); setErr('consent');
    if (data.fullName.trim().length < 3) { setErr('fullName', 'กรุณากรอกชื่อ-นามสกุล'); ok = false; }
    if (!isValidThaiPhone(data.phone)) { setErr('phone', 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง'); ok = false; }
    if (!data.consent) { setErr('consent', 'กรุณายอมรับเงื่อนไขก่อนลงทะเบียน'); ok = false; }
    if (!ok) return;

    const btn = el.querySelector('#reg-submit');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง QR…';
    try {
      const t = await registerGuest(data);
      saveMyTicket(t);
      await showSuccess(t, false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE') {
        toast('เบอร์นี้ลงทะเบียนแล้ว แสดงตั๋วเดิมให้', '');
        saveMyTicket(err.data);
        await showSuccess(err.data, true);
      } else {
        toast(err.message || 'ลงทะเบียนไม่สำเร็จ', 'err');
        btn.disabled = false; btn.textContent = 'รับ QR Ticket ✨';
      }
    }
  });

  async function showSuccess(t, dup) {
    const panel = el.querySelector('#reg-panel');
    panel.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:44px">${dup ? '🔁' : '🎉'}</div>
        <h2 style="font-family:var(--hand);font-size:30px;margin:0">${dup ? 'คุณลงทะเบียนไว้แล้ว' : 'ลงทะเบียนสำเร็จ!'}</h2>
        <p style="color:var(--cocoa-2);margin:4px 0 0">แสดง QR นี้ต่อเจ้าหน้าที่ในวันงาน</p>
      </div>
      ${await ticketCard(t)}
      <div class="ticket-actions">
        <button class="btn btn-rose" id="btn-save-ticket">⬇️ บันทึกตั๋วลงเครื่อง</button>
        <a href="#/map" class="btn" id="reg-go-map">🗺️ ดูแผนที่งาน</a>
      </div>`;
    bindTicketActions(panel, t);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
