import {
  EVENT, registerGuest, saveMyTicket, getMyTicket, getByToken,
  findByPhone, clearMyTicket, isValidThaiPhone, ApiError, onStats
} from '../store.js';
import { esc, toast, footer } from '../ui.js';
import { ticketCard, bindTicketActions } from './ticket.js';

export async function render(el, params = {}) {
  el.innerHTML = `<section class="page container"><div style="text-align:center;padding:60px"><div class="spinner"></div>กำลังโหลด…</div></section>`;

  let currentTicket = params.t ? await getByToken(params.t) : await getMyTicket();
  if (currentTicket && params.t) saveMyTicket(currentTicket);

  // If user already has a ticket and didn't specify ?action=register, default to showing their ticket
  let activeTab = (currentTicket && params.action !== 'register') ? 'ticket' : 'form';
  let subTab = params.action === 'find' ? 'find' : 'register';

  const formatPhone = (val) => {
    const d = val.replace(/\D/g, '').slice(0, 10);
    return d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  };

  const paint = async () => {
    if (activeTab === 'ticket' && currentTicket) {
      el.innerHTML = `
      <section class="page container">
        <div class="checkin-head" style="text-align:center;max-width:560px;margin:0 auto 28px">
          <span class="eyebrow">E-Ticket · Check-in</span>
          <h1 style="font-family:var(--hand);font-size:clamp(34px, 5vw, 48px);margin:6px 0 10px">Checkin</h1>
          <p style="color:var(--cocoa-2);font-size:15px;margin:0">
            แสดง QR Code ด้านล่างนี้ต่อเจ้าหน้าที่ ณ จุดลงทะเบียน / เช็กอินเข้างาน
          </p>
        </div>

        <div id="checkin-ticket-wrap">
          ${await ticketCard(currentTicket)}
        </div>

        <div class="ticket-actions" style="margin-top:24px">
          <button class="btn btn-rose btn-lg" id="btn-save-ticket">⬇️ บันทึกตั๋วลงเครื่อง</button>
          ${currentTicket.status === 'checked_in'
          ? `<a href="#/polaroid" class="btn btn-primary btn-lg" id="btn-go-polaroid">📸 สร้างภาพ Polaroid</a>`
          : `<a href="#/map" class="btn btn-lg" id="btn-go-map">🗺️ ดูแผนที่งาน 3D</a>`}
        </div>

        <div class="card glass" style="max-width:460px;margin:32px auto 0;text-align:center;padding:18px 24px">
          <div style="font-size:14px;color:var(--cocoa-2);margin-bottom:12px">ต้องการลงทะเบียนให้ผู้ร่วมงานท่านอื่น หรือค้นหาตั๋วอื่น?</div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-dark" id="btn-add-guest">➕ ลงทะเบียนเพิ่ม</button>
            <button class="btn btn-sm" id="btn-search-other">🔍 ค้นหาด้วยเบอร์โทร</button>
            <button class="btn btn-sm btn-ghost" id="btn-forget" style="color:var(--rose-d)">สลับตั๋ว</button>
          </div>
        </div>
      </section>
      ${footer()}`;

      bindTicketActions(el, currentTicket);

      el.querySelector('#btn-add-guest')?.addEventListener('click', () => {
        activeTab = 'form'; subTab = 'register'; paint();
      });
      el.querySelector('#btn-search-other')?.addEventListener('click', () => {
        activeTab = 'form'; subTab = 'find'; paint();
      });
      el.querySelector('#btn-forget')?.addEventListener('click', () => {
        clearMyTicket();
        currentTicket = null;
        activeTab = 'form';
        subTab = 'register';
        paint();
      });
      return;
    }

    // Form View: Combined Registration & Phone Search
    el.innerHTML = `
    <section class="page container">
      <div class="reg-wrap">
        <div class="reg-side">
          <span class="eyebrow">Registration & Ticket</span>
          <h1 style="font-family:var(--hand);font-size:clamp(34px, 5vw, 52px)">Checkin</h1>
          <p style="color:var(--cocoa-2)">ลงทะเบียนรับ QR Code ประจำตัว หรือค้นหาตั๋วเดิมเพื่อใช้เช็กอินเข้างาน</p>

          <ol class="steps">
            <li><span class="n">1</span><p><strong>กรอกชื่อและเบอร์โทร</strong> หรือค้นหาตั๋วเดิมที่เคยลงทะเบียน</p></li>
            <li><span class="n">2</span><p><strong>รับ QR Ticket ทันที</strong> บันทึกลงเครื่องหรือแคปหน้าจอไว้</p></li>
            <li><span class="n">3</span><p><strong>แสดง QR ที่จุดเช็กอิน</strong> เจ้าหน้าที่สแกนเข้างาน และปลดล็อกสิทธิ์พิเศษ</p></li>
          </ol>

          ${currentTicket ? `
            <div class="card glass" style="display:flex;gap:14px;align-items:center;border-left:4px solid var(--saffron);margin-top:20px">
              <span style="font-size:30px">🎫</span>
              <div style="flex:1">
                <strong style="font-size:14px">คุณมีตั๋วในเครื่องนี้แล้ว</strong>
                <div style="font-size:13px;color:var(--cocoa-2)">${esc(currentTicket.id)} · ${esc(currentTicket.fullName)}</div>
              </div>
              <button class="btn btn-sm btn-primary" id="btn-back-to-ticket">ดูตั๋วของฉัน →</button>
            </div>` : ''}
        </div>

        <div id="checkin-panel">
          <div class="card" style="padding:28px">
            <div class="checkin-tabs" role="tablist">
              <button class="checkin-tab ${subTab === 'register' ? 'active' : ''}" id="tab-sub-reg">📝 ลงทะเบียนรับ QR</button>
              <button class="checkin-tab ${subTab === 'find' ? 'active' : ''}" id="tab-sub-find">🔍 มีตั๋วแล้ว / ค้นหา</button>
            </div>

            ${subTab === 'register' ? `
              <form id="reg-form" novalidate>
                <h2 style="font-size:20px;margin-bottom:14px">ข้อมูลผู้ร่วมงาน</h2>
                <div class="field">
                  <label for="reg-name">ชื่อเล่น,ชื่อในวงการ,ชื่อทางการ</label>
                  <input class="input" id="reg-name" name="fullName" autocomplete="name" placeholder="เช่น สมชาย ใจดี" required />
                  <span class="err" data-for="fullName"></span>
                </div>
                <div class="field">
                  <label for="reg-phone">เบอร์โทรศัพท์</label>
                  <input class="input" id="reg-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="08x-xxx-xxxx" maxlength="12" required />
                  <small>เบอร์โทรใช้สำหรับค้นหาตั๋วและตรวจสอบการลงทะเบียนเท่านั้น</small>
                  <span class="err" data-for="phone"></span>
                </div>
                <label class="check" for="reg-consent">
                  <input type="checkbox" id="reg-consent" name="consent" checked />
                  <span>ยินยอมให้ผู้จัดงานเก็บชื่อและเบอร์โทรเพื่อใช้ในการเช็กอินงานนี้เท่านั้น</span>
                </label>
                <span class="err" data-for="consent"></span>
                <button class="btn btn-primary btn-lg btn-block" id="reg-submit" style="margin-top:18px">รับ QR Checkin ✨</button>
              </form>
            ` : `
              <form id="find-form" novalidate>
                <h2 style="font-size:20px;margin-bottom:8px">ค้นหาตั๋วด้วยเบอร์โทร</h2>
                <p style="color:var(--cocoa-2);font-size:14px;margin-bottom:18px">กรอกเบอร์โทรศัพท์ที่คุณเคยใช้ลงทะเบียนไว้ เพื่อดึง QR Ticket กลับมาแสดงบนอุปกรณ์นี้</p>
                <div class="field">
                  <label for="find-phone">เบอร์โทรศัพท์ที่เคยลงทะเบียน</label>
                  <input class="input" id="find-phone" name="phone" type="tel" inputmode="numeric" placeholder="08x-xxx-xxxx" maxlength="12" required />
                  <span class="err" data-for="findPhone"></span>
                </div>
                <button class="btn btn-dark btn-lg btn-block" id="find-submit" style="margin-top:10px">🔍 ค้นหาตั๋ว</button>
              </form>
            `}
          </div>
        </div>
      </div>
    </section>
    ${footer()}`;

    el.querySelector('#btn-back-to-ticket')?.addEventListener('click', () => {
      activeTab = 'ticket'; paint();
    });

    el.querySelector('#tab-sub-reg')?.addEventListener('click', () => {
      if (subTab !== 'register') { subTab = 'register'; paint(); }
    });
    el.querySelector('#tab-sub-find')?.addEventListener('click', () => {
      if (subTab !== 'find') { subTab = 'find'; paint(); }
    });

    if (subTab === 'register') {
      const form = el.querySelector('#reg-form');
      const phoneInput = el.querySelector('#reg-phone');
      phoneInput?.addEventListener('input', () => { phoneInput.value = formatPhone(phoneInput.value); });

      const setErr = (k, msg) => {
        const e = form.querySelector(`[data-for="${k}"]`); if (e) e.textContent = msg || '';
        form.querySelector(`[name="${k}"]`)?.classList.toggle('invalid', !!msg);
      };

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { fullName: form.fullName.value, phone: form.phone.value, consent: form.consent.checked };
        let ok = true;
        setErr('fullName'); setErr('phone'); setErr('consent');
        if (data.fullName.trim().length < 2) { setErr('fullName', 'กรุณากรอกชื่อเล่น,ชื่อในวงการ,ชื่อทางการ'); ok = false; }
        if (!isValidThaiPhone(data.phone)) { setErr('phone', 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง'); ok = false; }
        if (!data.consent) { setErr('consent', 'กรุณายอมรับเงื่อนไขก่อนลงทะเบียน'); ok = false; }
        if (!ok) return;

        const btn = el.querySelector('#reg-submit');
        btn.disabled = true; btn.textContent = 'กำลังสร้าง QR…';
        try {
          const t = await registerGuest(data);
          saveMyTicket(t);
          currentTicket = t;
          activeTab = 'ticket';
          toast('ลงทะเบียนสำเร็จ! รับ QR Checkin เรียบร้อย 🎉', 'ok');
          paint();
        } catch (err) {
          if (err instanceof ApiError && err.code === 'DUPLICATE') {
            toast('เบอร์นี้เคยลงทะเบียนไว้แล้ว แสดงตั๋วให้เรียบร้อย ✨', 'ok');
            saveMyTicket(err.data);
            currentTicket = err.data;
            activeTab = 'ticket';
            paint();
          } else {
            toast(err.message || 'ลงทะเบียนไม่สำเร็จ', 'err');
            btn.disabled = false; btn.textContent = 'รับ QR Checkin ✨';
          }
        }
      });
    } else {
      const findForm = el.querySelector('#find-form');
      const findPhone = el.querySelector('#find-phone');
      findPhone?.addEventListener('input', () => { findPhone.value = formatPhone(findPhone.value); });

      findForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = findForm.querySelector('[data-for="findPhone"]');
        errEl.textContent = '';
        const phone = findPhone.value.trim();
        if (!isValidThaiPhone(phone)) {
          errEl.textContent = 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง';
          return;
        }
        const btn = el.querySelector('#find-submit');
        btn.disabled = true; btn.textContent = 'กำลังค้นหา…';
        try {
          const r = await findByPhone(phone);
          if (!r) {
            toast('ไม่พบข้อมูลการลงทะเบียนด้วยเบอร์นี้', 'err');
            errEl.textContent = 'ไม่พบเบอร์นี้ในระบบ กรุณาตรวจสอบหรือลงทะเบียนใหม่';
            btn.disabled = false; btn.textContent = '🔍 ค้นหาตั๋ว';
            return;
          }
          currentTicket = r;
          saveMyTicket(r);
          activeTab = 'ticket';
          toast('พบตั๋วของคุณแล้ว!', 'ok');
          paint();
        } catch (err) {
          toast(err.message || 'เกิดข้อผิดพลาดในการค้นหา', 'err');
          btn.disabled = false; btn.textContent = '🔍 ค้นหาตั๋ว';
        }
      });
    }
  };

  await paint();

  // live update when staff checks this ticket in (cross-tab / realtime)
  const off = onStats(async () => {
    if (!currentTicket) return;
    const fresh = await getByToken(currentTicket.token);
    if (fresh && fresh.status !== currentTicket.status) {
      currentTicket = fresh;
      toast('เช็กอินสำเร็จ! ปลดล็อก Polaroid แล้ว 🎉', 'ok');
      if (activeTab === 'ticket') paint();
    }
  });

  return off;
}
