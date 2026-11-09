import {
  EVENT, registerGuest, saveMyTicket, getMyTicket, getByToken,
  findByPhone, clearMyTicket, updateMyTicketGender, isValidThaiPhone, ApiError, onStats
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
        <div class="checkin-head" style="text-align:center;max-width:600px;margin:0 auto 28px">
          <h1 style="font-family:var(--hand);font-size:clamp(34px, 5vw, 48px);margin:6px 0 10px">บัตรผู้ร่วมงาน</h1>
          <p style="color:var(--cocoa-2);font-size:15px;margin:0">
            ยินดีต้อนรับสู่งานบวชมังกร<br class="show-mobile" />พร้อมสิทธิ์ร่วมกิจกรรมพิเศษภายในงาน
          </p>
        </div>

        <div id="checkin-ticket-wrap">
          ${await ticketCard(currentTicket)}
        </div>

        <div class="ticket-actions" style="margin-top:24px">
          <button class="btn btn-rose btn-lg" id="btn-save-ticket">⬇️ บันทึกบัตรลงเครื่อง</button>
        </div>

        <div class="card glass ticket-gender-box" style="max-width:460px;margin:18px auto 0;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-radius:18px">
          <div style="text-align:left">
            <strong style="font-size:13.5px;color:var(--cocoa);display:block">เพศตัวละครในแผนที่ 3D</strong>
            <span style="font-size:12px;color:var(--cocoa-2)">แตะเปลี่ยนเพศตัวละครของคุณได้ตลอดเวลา</span>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-sm ${currentTicket.gender !== 'female' ? 'btn-primary' : 'btn-ghost'}" id="btn-toggle-male">👦 ชาย</button>
            <button type="button" class="btn btn-sm ${currentTicket.gender === 'female' ? 'btn-primary' : 'btn-ghost'}" id="btn-toggle-female">👧 หญิง</button>
          </div>
        </div>
      </section>
      ${footer()}`;

      bindTicketActions(el, currentTicket);

      el.querySelector('#btn-toggle-male')?.addEventListener('click', () => {
        if (currentTicket.gender !== 'male') {
          updateMyTicketGender('male');
          currentTicket.gender = 'male';
          toast('เปลี่ยนตัวละครเป็นเพศชาย 👦 แล้ว', 'ok');
          paint();
        }
      });
      el.querySelector('#btn-toggle-female')?.addEventListener('click', () => {
        if (currentTicket.gender !== 'female') {
          updateMyTicketGender('female');
          currentTicket.gender = 'female';
          toast('เปลี่ยนตัวละครเป็นเพศหญิง 👧 แล้ว', 'ok');
          paint();
        }
      });

      return;
    }

    // Form View: Combined Registration & Phone Search
    el.innerHTML = `
    <section class="page container">
      <div class="reg-wrap">
        <div class="reg-side">
          <span class="eyebrow">22 พฤศจิกาขอลาบวช</span>
          <h1 style="font-family:var(--hand);font-size:clamp(34px, 5vw, 52px)">บัตรผู้ร่วมงาน</h1>
          <p style="color:var(--cocoa-2)">ลงทะเบียนเข้าร่วมงานบวชมังกร<br class="show-mobile" />รับบัตรประจำตัว (E-Badge) เพื่อร่วมกิจกรรมพิเศษ</p>

          <ol class="steps">
            <li><span class="n">1</span><p><strong>กรอกชื่อและเบอร์โทร</strong> หรือค้นหาบัตรเดิมที่เคยลงทะเบียน</p></li>
            <li><span class="n">2</span><p><strong>รับบัตร E-Badge ทันที</strong> บันทึกลงเครื่องหรือแคปหน้าจอไว้</p></li>
            <li><span class="n">3</span><p><strong>รับสิทธิ์พิเศษในงาน</strong> ถ่ายภาพ Polaroid & สอยดาวลุ้นรางวัล</p></li>
          </ol>

          ${currentTicket ? `
            <div class="card glass" style="display:flex;gap:14px;align-items:center;border-left:4px solid var(--saffron);margin-top:20px">
              <span style="font-size:30px">🎫</span>
              <div style="flex:1">
                <strong style="font-size:14px">คุณมีบัตรในเครื่องนี้แล้ว</strong>
                <div style="font-size:13px;color:var(--cocoa-2)">${esc(currentTicket.id)} · ${esc(currentTicket.fullName)}</div>
              </div>
              <button class="btn btn-sm btn-primary" id="btn-back-to-ticket">ดูบัตรของฉัน →</button>
            </div>` : ''}
        </div>

        <div id="checkin-panel">
          <div class="card" style="padding:28px">
            <div class="checkin-tabs" role="tablist">
              <button class="checkin-tab ${subTab === 'register' ? 'active' : ''}" id="tab-sub-reg">📝 ลงทะเบียนรับบัตร</button>
              <button class="checkin-tab ${subTab === 'find' ? 'active' : ''}" id="tab-sub-find">🔍 มีบัตรแล้ว / ค้นหา</button>
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
                  <label>ระบุเพศ (สำหรับตัวละครในแผนที่ 3D)</label>
                  <div class="gender-selector" role="radiogroup" aria-label="ระบุเพศ">
                    <label class="gender-option active" data-gender="male">
                      <input type="radio" name="gender" value="male" checked />
                      <span class="gender-ico">👦</span>
                      <span class="gender-text">ชาย</span>
                    </label>
                    <label class="gender-option" data-gender="female">
                      <input type="radio" name="gender" value="female" />
                      <span class="gender-ico">👧</span>
                      <span class="gender-text">หญิง</span>
                    </label>
                  </div>
                </div>
                <div class="field">
                  <label for="reg-phone">เบอร์โทรศัพท์</label>
                  <input class="input" id="reg-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="08x-xxx-xxxx" maxlength="12" required />
                  <small>เบอร์โทรใช้สำหรับค้นหาบัตรและตรวจสอบการลงทะเบียนเท่านั้น</small>
                  <span class="err" data-for="phone"></span>
                </div>
                <label class="check" for="reg-consent">
                  <input type="checkbox" id="reg-consent" name="consent" checked />
                  <span>ยินยอมให้ผู้จัดงานเก็บชื่อและเบอร์โทรเพื่อใช้ในการร่วมงานนี้เท่านั้น</span>
                </label>
                <span class="err" data-for="consent"></span>
                <button class="btn btn-primary btn-lg btn-block" id="reg-submit" style="margin-top:18px">รับบัตร E-Badge ✨</button>
              </form>
            ` : `
              <form id="find-form" novalidate>
                <h2 style="font-size:20px;margin-bottom:8px">ค้นหาบัตรด้วยเบอร์โทร</h2>
                <p style="color:var(--cocoa-2);font-size:14px;margin-bottom:18px">กรอกเบอร์โทรศัพท์ที่คุณเคยใช้ลงทะเบียนไว้ เพื่อดึงบัตรประจำตัวกลับมาแสดงบนอุปกรณ์นี้</p>
                <div class="field">
                  <label for="find-phone">เบอร์โทรศัพท์ที่เคยลงทะเบียน</label>
                  <input class="input" id="find-phone" name="phone" type="tel" inputmode="numeric" placeholder="08x-xxx-xxxx" maxlength="12" required />
                  <span class="err" data-for="findPhone"></span>
                </div>
                <button class="btn btn-dark btn-lg btn-block" id="find-submit" style="margin-top:10px">🔍 ค้นหาบัตร</button>
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

      form?.querySelectorAll('.gender-option').forEach(opt => {
        opt.addEventListener('click', () => {
          form.querySelectorAll('.gender-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          const radio = opt.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
        });
      });

      const setErr = (k, msg) => {
        const e = form.querySelector(`[data-for="${k}"]`); if (e) e.textContent = msg || '';
        form.querySelector(`[name="${k}"]`)?.classList.toggle('invalid', !!msg);
      };

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const gender = form.querySelector('input[name="gender"]:checked')?.value || 'male';
        const data = { fullName: form.fullName.value, phone: form.phone.value, consent: form.consent.checked, gender };
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
