import {
  EVENT, listRegistrations, getStats, onStats,
  toggleCheckIn, deleteRegistration, seedDemo, resetAll,
  getPolaroidConfig, savePolaroidConfig, isPolaroidOpen
} from '../store.js';
import { esc, toast, fmtTime, countUp, footer, icon } from '../ui.js';
import { renderLuckyAdmin } from './staff-lucky.js';

const STAFF_SESSION_KEY = 'mf.staff.session.v1';
const STAFF_PIN_KEY = 'mf.staff.pin.v1';
const DEFAULT_PIN = '2211'; // 22 พฤศจิกายน

function getExpectedPin() {
  return localStorage.getItem(STAFF_PIN_KEY) || DEFAULT_PIN;
}

function getStaffSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STAFF_SESSION_KEY));
  } catch {
    return null;
  }
}

function setStaffSession(staffName) {
  const s = { staffName: staffName || 'เจ้าหน้าที่ดูแลระบบ', loginAt: new Date().toISOString() };
  sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(s));
  return s;
}

function clearStaffSession() {
  sessionStorage.removeItem(STAFF_SESSION_KEY);
}

function formatFullPhone(p = '') {
  if (!p) return '-';
  const d = String(p).replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

export async function render(el) {
  let session = getStaffSession();
  let registrations = [];
  let stats = await getStats();
  let searchQuery = '';
  let filterMode = 'all'; // 'all' | 'checked_in' | 'pending'
  let offStats = null;
  let keyCleanup = null;
  let activeTab = 'guests'; // 'guests' | 'lucky'
  let lucky = null;         // Lucky Star admin panel handle

  const mount = async () => {
    if (keyCleanup) { keyCleanup(); keyCleanup = null; }
    unmountLucky();
    if (!session) {
      renderLogin();
    } else {
      registrations = await listRegistrations();
      stats = await getStats();
      renderDashboard();
    }
  };

  /* =========================================================
     1. STAFF LOGIN & PIN SCREEN
     ========================================================= */
  function renderLogin() {
    let pinValue = '';

    el.innerHTML = `
      <section class="page container">
        <div class="staff-login-wrap">
          <div class="card glass staff-login-card">
            <div class="staff-login-badge">${icon('lock', 'fill')} STAFF CONSOLE</div>
            <h1 class="hand staff-login-title">ระบบหลังบ้านเจ้าหน้าที่</h1>
            <p class="staff-login-sub">สำหรับดูยอดผู้ลงทะเบียนออนไลน์ แดชบอร์ดสถิติ และรายชื่อผู้เข้าร่วมงาน</p>

            <form id="staff-login-form" novalidate>
              <div class="field" style="text-align:left">
                <label for="staff-name">ชื่อเจ้าหน้าที่ผู้ใช้งาน</label>
                <input class="input" id="staff-name" name="staffName" placeholder="เช่น เจ้าหน้าที่ฝ่ายต้อนรับ" value="เจ้าหน้าที่ดูแลงาน" required />
              </div>

              <div class="field" style="text-align:left;margin-bottom:10px">
                <label>รหัส PIN เจ้าหน้าที่ (4 หลัก)</label>
                <div class="pin-dots" id="pin-dots" aria-live="polite">
                  <span class="pin-dot"></span>
                  <span class="pin-dot"></span>
                  <span class="pin-dot"></span>
                  <span class="pin-dot"></span>
                </div>
                <span class="err" id="pin-err" style="text-align:center;display:block;margin-top:6px"></span>
              </div>

              <div class="pin-pad" id="pin-pad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" class="pin-btn" data-key="${n}">${n}</button>`).join('')}
                <button type="button" class="pin-btn pin-btn-alt" data-key="clear">ล้าง</button>
                <button type="button" class="pin-btn" data-key="0">0</button>
                <button type="button" class="pin-btn pin-btn-alt" data-key="back">⌫</button>
              </div>

              <button type="submit" class="btn btn-primary btn-lg btn-block" style="margin-top:18px">
                ${icon('unlock', 'fill')} เข้าสู่ระบบเจ้าหน้าที่
              </button>
            </form>
          </div>
        </div>
      </section>
      ${footer()}
    `;

    const dots = [...el.querySelectorAll('#pin-dots .pin-dot')];
    const errEl = el.querySelector('#pin-err');
    const nameInput = el.querySelector('#staff-name');

    const updateDots = (shake = false) => {
      dots.forEach((d, i) => {
        d.classList.toggle('filled', i < pinValue.length);
        d.textContent = i < pinValue.length ? '●' : '';
      });
      const wrap = el.querySelector('#pin-dots');
      if (shake && wrap) {
        wrap.classList.remove('shake');
        void wrap.offsetWidth;
        wrap.classList.add('shake');
      }
    };

    const tryUnlock = () => {
      errEl.textContent = '';
      if (pinValue.length < 4) {
        errEl.textContent = 'กรุณากดรหัส PIN ให้ครบ 4 หลัก';
        updateDots(true);
        return;
      }
      if (pinValue !== getExpectedPin()) {
        errEl.textContent = 'รหัส PIN ไม่ถูกต้อง กรุณาลองอีกครั้ง';
        pinValue = '';
        updateDots(true);
        return;
      }
      const staffName = nameInput.value.trim() || 'เจ้าหน้าที่ดูแลงาน';
      session = setStaffSession(staffName);
      toast(`ยินดีต้อนรับ ${staffName} เข้าสู่ระบบหลังบ้าน 🙏`, 'ok');
      mount();
    };

    const handleKey = (key) => {
      errEl.textContent = '';
      if (key === 'clear') {
        pinValue = '';
        updateDots();
      } else if (key === 'back') {
        pinValue = pinValue.slice(0, -1);
        updateDots();
      } else if (/^\d$/.test(key) && pinValue.length < 4) {
        pinValue += key;
        updateDots();
        if (pinValue.length === 4) {
          setTimeout(tryUnlock, 140);
        }
      }
    };

    el.querySelector('#pin-pad')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      handleKey(btn.dataset.key);
    });

    el.querySelector('#staff-login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      tryUnlock();
    });

    const onKeyDown = (e) => {
      if (document.activeElement === nameInput) return;
      if (/^\d$/.test(e.key)) handleKey(e.key);
      else if (e.key === 'Backspace') handleKey('back');
      else if (e.key === 'Escape') handleKey('clear');
    };
    window.addEventListener('keydown', onKeyDown);
    keyCleanup = () => window.removeEventListener('keydown', onKeyDown);
  }

  /* =========================================================
     2. LIVE DASHBOARD & ONLINE GUEST LIST
     ========================================================= */
  function getCheckinBarWidths(s) {
    const total = Math.max(1, s.registered || 0);
    const chkW = s.registered > 0 ? Math.min(100, (s.checkedIn / total) * 100) : 0;
    const pendW = s.registered > 0 ? Math.max(0, 100 - chkW) : 0;
    return { chkW, pendW };
  }

  function renderDashboard() {
    const bw = getCheckinBarWidths(stats);
    const pctCheckin = stats.registered > 0 ? Math.round((stats.checkedIn / stats.registered) * 100) : 0;

    el.innerHTML = `
      <section class="page container staff-page">
        <!-- Top Header Bar -->
        <div class="staff-topbar card glass">
          <div class="staff-topbar-left">
            <span class="badge ok"><span class="dot live"></span> LIVE DASHBOARD</span>
            <h1 class="hand staff-main-title">แดชบอร์ดและรายชื่อผู้ลงทะเบียน</h1>
            <p class="staff-subtitle">
              ${icon('users')} ปฏิบัติงานโดย: <strong id="staff-current-name">${esc(session.staffName)}</strong>
              &nbsp;·&nbsp; ${icon('calendar')} ${esc(EVENT.dateTh)}
            </p>
          </div>
          <div class="staff-topbar-actions">
            <button type="button" class="btn btn-sm" id="btn-export-csv">${icon('download')} ส่งออกรายชื่อ (CSV)</button>
            <button type="button" class="btn btn-sm" id="btn-seed-demo">${icon('flask')} จำลองข้อมูลตัวอย่าง</button>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-logout" style="color:var(--rose-d)">${icon('lock')} ล็อกหน้าจอ</button>
          </div>
        </div>

        <!-- Section tabs -->
        <div class="staff-tabs" id="staff-tabs" role="tablist">
          <button type="button" class="staff-tab ${activeTab === 'guests' ? 'active' : ''}" data-tab="guests" role="tab">${icon('users')} ผู้ลงทะเบียน</button>
          <button type="button" class="staff-tab ${activeTab === 'lucky' ? 'active' : ''}" data-tab="lucky" role="tab">⭐ Lucky Star · สอยดาว</button>
          <button type="button" class="staff-tab ${activeTab === 'polaroid' ? 'active' : ''}" data-tab="polaroid" role="tab">
            📸 Polaroid · ภาพที่ระลึก <span class="badge ${isPolaroidOpen() ? 'ok' : ''}" id="tab-pol-badge" style="font-size:10.5px;padding:1px 7px;margin-left:6px;">${isPolaroidOpen() ? 'เปิด' : 'ปิด'}</span>
          </button>
        </div>

        <div id="panel-polaroid" ${activeTab === 'polaroid' ? '' : 'hidden'}></div>
        <div id="panel-lucky" ${activeTab === 'lucky' ? '' : 'hidden'}></div>
        <div id="panel-guests" ${activeTab === 'guests' ? '' : 'hidden'}>

        <!-- LIVE DASHBOARD KPI CARDS -->
        <div class="staff-kpi-grid">
          <div class="card staff-kpi-card kpi-primary">
            <div class="kpi-head">
              <span class="kpi-label">ผู้ลงทะเบียนเข้าร่วมงานทั้งหมด</span>
              <span class="kpi-ico" style="color:var(--saffron-d)">${icon('users', 'fill')}</span>
            </div>
            <div class="kpi-value">
              <span id="kpi-reg">${stats.registered.toLocaleString('th-TH')}</span>
              <small>คน</small>
            </div>
            <div class="kpi-meta" id="kpi-reg-meta">
              ยอดผู้ลงทะเบียนรับ QR Ticket ออนไลน์ทั้งหมด
            </div>
          </div>

          <div class="card staff-kpi-card kpi-success">
            <div class="kpi-head">
              <span class="kpi-label">เช็กอินเข้าร่วมงานแล้ว</span>
              <span class="kpi-ico" style="color:var(--leaf-d)">${icon('check', 'fill')}</span>
            </div>
            <div class="kpi-value">
              <span id="kpi-chk">${stats.checkedIn.toLocaleString('th-TH')}</span>
              <small>คน</small>
            </div>
            <div class="kpi-meta">
              คิดเป็น <strong id="kpi-chk-pct">${pctCheckin}%</strong> ของผู้ลงทะเบียนทั้งหมด
            </div>
          </div>

          <div class="card staff-kpi-card">
            <div class="kpi-head">
              <span class="kpi-label">รอเช็กอินเข้างาน</span>
              <span class="kpi-ico">${icon('clock')}</span>
            </div>
            <div class="kpi-value">
              <span id="kpi-pending">${(stats.pending || 0).toLocaleString('th-TH')}</span>
              <small>คน</small>
            </div>
            <div class="kpi-meta">
              ลงทะเบียนรับ QR Ticket แล้ว รอเช็กอิน
            </div>
          </div>

          <div class="card staff-kpi-card kpi-visitors">
            <div class="kpi-head">
              <span class="kpi-label">ผู้เข้าชมเว็บไซต์รวม</span>
              <span class="kpi-ico">${icon('eye')}</span>
            </div>
            <div class="kpi-value">
              <span id="kpi-vis">${(stats.visitors || 1).toLocaleString('th-TH')}</span>
              <small>ครั้ง</small>
            </div>
            <div class="kpi-meta">
              ยอดผู้เปิดเข้าชมหน้าเว็บไซต์ทั้งหมด
            </div>
          </div>
        </div>

        <!-- SUMMARY BAR VISUALIZATION -->
        <div class="card staff-progress-card">
          <div class="staff-progress-head">
            <div>
              <strong>สรุปสัดส่วนผู้เข้าร่วมงานทั้งหมด</strong>
              <span class="staff-progress-sub" id="prog-summary-text">
                ผู้ลงทะเบียนทั้งหมด ${stats.registered.toLocaleString('th-TH')} คน · เช็กอินเข้างานแล้ว ${stats.checkedIn.toLocaleString('th-TH')} คน · รอเช็กอิน ${(stats.pending || 0).toLocaleString('th-TH')} คน
              </span>
            </div>
            <span class="badge ok" id="prog-badge">
              รวมทั้งหมด ${stats.registered.toLocaleString('th-TH')} คน
            </span>
          </div>
          <div class="staff-progress-track">
            <div class="staff-progress-fill fill-checked" id="prog-fill-checked" style="width:${bw.chkW}%" title="เช็กอินแล้ว"></div>
            <div class="staff-progress-fill fill-pending" id="prog-fill-pending" style="width:${bw.pendW}%" title="รอเช็กอิน"></div>
          </div>
          <div class="staff-progress-legend">
            <span><i class="legend-dot checked"></i> เข้าร่วมงาน/เช็กอินแล้ว (<b id="leg-chk">${stats.checkedIn.toLocaleString('th-TH')}</b> คน)</span>
            <span><i class="legend-dot pending"></i> รอเช็กอินเข้างาน (<b id="leg-pend">${(stats.pending || 0).toLocaleString('th-TH')}</b> คน)</span>
          </div>
        </div>

        <!-- FULL-WIDTH GUEST DIRECTORY -->
        <div class="card staff-list-card">
          <div class="staff-list-head">
            <div>
              <span class="eyebrow">Online Registrations</span>
              <h2>${icon('users', 'fill')} รายชื่อผู้ลงทะเบียนเข้าร่วมงาน</h2>
            </div>
            <div class="staff-list-counter" id="list-summary-pill">
              ทั้งหมด <strong>0</strong> คน
            </div>
          </div>

          <!-- Search & Filters -->
          <div class="staff-list-controls staff-list-controls-row">
            <div class="staff-search-box" style="flex:1;min-width:240px">
              <span class="search-ico">${icon('search')}</span>
              <input type="search" class="input staff-search-input" id="guest-search" placeholder="ค้นหาชื่อ-นามสกุล, เบอร์โทรศัพท์ หรือรหัสตั๋ว MF-xxxx..." value="${esc(searchQuery)}" />
            </div>

            <div class="staff-filter-pills" id="guest-filters">
              <button type="button" class="filter-pill ${filterMode === 'all' ? 'active' : ''}" data-filter="all">${icon('users')} ทั้งหมด (<span id="flt-cnt-all">${registrations.length}</span>)</button>
              <button type="button" class="filter-pill ${filterMode === 'checked_in' ? 'active' : ''}" data-filter="checked_in">${icon('check')} เช็กอินเข้างานแล้ว (<span id="flt-cnt-chk">${registrations.filter(r => r.status === 'checked_in').length}</span>)</button>
              <button type="button" class="filter-pill ${filterMode === 'pending' ? 'active' : ''}" data-filter="pending">${icon('clock')} รอเช็กอิน (<span id="flt-cnt-pend">${registrations.filter(r => r.status !== 'checked_in').length}</span>)</button>
            </div>
          </div>

          <!-- Table Container -->
          <div class="staff-table-wrap" id="guest-table-wrap"></div>

          <!-- Footer utilities -->
          <div class="staff-list-foot">
            <span style="font-size:12px;color:var(--muted)">💡 คลิกปุ่มสถานะในตารางเพื่อสลับ "เช็กอินแล้ว / รอเช็กอิน" ได้ทันที</span>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-reset-all" style="color:var(--rose-d);font-size:12px">${icon('trash')} ล้างข้อมูลทั้งหมด</button>
          </div>
        </div>
        </div><!-- /panel-guests -->
      </section>
      ${footer()}
    `;

    bindDashboardEvents();
    renderGuestTable();
    if (activeTab === 'lucky') mountLucky();
    if (activeTab === 'polaroid') renderPolaroidPanel();
  }

  function renderPolaroidPanel() {
    const wrap = el.querySelector('#panel-polaroid');
    if (!wrap) return;
    const cfg = getPolaroidConfig();
    const isOpen = isPolaroidOpen();

    wrap.innerHTML = `
      <div class="card glass" style="max-width:820px;margin:0 auto 24px;border-radius:24px;padding:28px;">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:22px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="font-size:40px;background:linear-gradient(180deg,#fff6d8,#ffe7a8);width:62px;height:62px;display:grid;place-items:center;border-radius:18px;flex:none;box-shadow:var(--shadow-sm);">📸</div>
            <div>
              <h2 style="margin:0;font-size:22px;color:var(--cocoa);">ระบบ Digital Polaroid</h2>
              <p style="margin:4px 0 0;font-size:13.5px;color:var(--cocoa-2);">ควบคุมการเปิด-ปิดหน้าถ่ายภาพที่ระลึกกับพระนวกะ</p>
            </div>
          </div>
          <div>
            <span class="badge ${isOpen ? 'ok' : 'wait'}" id="pol-live-badge" style="font-size:13px;padding:6px 14px;border-radius:99px;">
              ${isOpen ? '🟢 สถานะ: เปิดใช้งานอยู่' : '🔒 สถานะ: ปิดไว้ก่อน (แสดงหน้าเร็วๆ นี้)'}
            </span>
          </div>
        </div>

        <div style="display:grid;gap:20px;">
          <div style="background:#fffaf0;border:1.5px solid rgba(245,166,35,0.35);border-radius:18px;padding:20px;">
            <label class="lsa-switch" style="cursor:pointer;">
              <input type="checkbox" id="pol-toggle-switch" ${cfg.enabled ? 'checked' : ''} />
              <span class="lsa-switch-ui"></span>
              <span style="font-size:15px;">
                <b id="pol-switch-text">${cfg.enabled ? 'เปิดใช้งานหน้า Polaroid ทันที (สวิตช์เปิด)' : 'ปิดไว้ก่อน (สวิตช์ปิด)'}</b>
                <small style="margin-top:4px;color:var(--cocoa-2);display:block;line-height:1.5;">
                  ${cfg.enabled ? 'ผู้ใช้งานทุกคนสามารถกดเข้าเมนู Polaroid เพื่อถ่ายภาพหรืออัปโหลดภาพได้ทันที' : 'ผู้ใช้งานที่กดเข้าเมนู Polaroid จะเห็นการ์ดแจ้งว่า "เปิดให้ร่วมถ่ายภาพในวันงาน (22 พฤศจิกายน 2569)"'}
                </small>
              </span>
            </label>
          </div>

          <div style="background:rgba(255,255,255,0.6);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px;color:var(--cocoa);">
              <input type="checkbox" id="pol-auto-open-opt" ${cfg.autoOpenOnEventDay ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--saffron-d);" />
              <span><b>เปิดอัตโนมัติในวันงาน</b> (เปิดระบบอัตโนมัติตั้งแต่ 22 พฤศจิกายน 2569 เป็นต้นไป แม้สวิตช์หลักจะปิดอยู่)</span>
            </label>
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:18px;align-items:center;">
            <a href="#/polaroid" target="_blank" class="btn btn-sm btn-primary">👁️ เปิดดูหน้า Polaroid ผู้ใช้งาน</a>
            <button type="button" class="btn btn-sm" id="pol-copy-test-link">📋 คัดลอกลิงก์ทดสอบสำหรับเปิดในมือถือ</button>
          </div>
        </div>
      </div>
    `;

    const sw = wrap.querySelector('#pol-toggle-switch');
    sw?.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await savePolaroidConfig({ enabled: isChecked }, session.staffName);
      toast(isChecked ? '🟢 เปิดใช้งานหน้า Polaroid เรียบร้อยแล้ว' : '🔒 ปิดหน้า Polaroid เรียบร้อยแล้ว', isChecked ? 'ok' : '');
      renderPolaroidPanel();
      const badge = el.querySelector('#tab-pol-badge');
      if (badge) {
        const opened = isPolaroidOpen();
        badge.className = `badge ${opened ? 'ok' : ''}`;
        badge.textContent = opened ? 'เปิด' : 'ปิด';
      }
    });

    wrap.querySelector('#pol-auto-open-opt')?.addEventListener('change', async (e) => {
      await savePolaroidConfig({ autoOpenOnEventDay: e.target.checked }, session.staffName);
      toast('บันทึกการตั้งค่าเปิดอัตโนมัติวันงานแล้ว', 'ok');
      renderPolaroidPanel();
    });

    wrap.querySelector('#pol-copy-test-link')?.addEventListener('click', async () => {
      const testUrl = `${location.origin}${location.pathname}?polaroid=1#/polaroid`;
      try {
        await navigator.clipboard.writeText(testUrl);
        toast('คัดลอกลิงก์ทดสอบ Polaroid แล้ว เปิดในมือถือได้ทันที', 'ok');
      } catch {
        prompt('คัดลอกลิงก์ทดสอบนี้ไปเปิดในมือถือ:', testUrl);
      }
    });
  }

  function mountLucky() {
    if (lucky) return;
    const host = el.querySelector('#panel-lucky');
    if (host) lucky = renderLuckyAdmin(host, session);
  }
  function unmountLucky() {
    if (lucky) { lucky.cleanup(); lucky = null; }
  }

  /* =========================================================
     TABLE RENDERER & LIVE STATS UPDATER
     ========================================================= */
  function getFilteredList() {
    const q = searchQuery.trim().toLowerCase();
    return registrations.filter(r => {
      if (filterMode === 'checked_in' && r.status !== 'checked_in') return false;
      if (filterMode === 'pending' && r.status === 'checked_in') return false;
      if (!q) return true;
      return (
        (r.fullName || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q.replace(/\D/g, '') || q)
      );
    });
  }

  function renderGuestTable() {
    const wrap = el.querySelector('#guest-table-wrap');
    const summaryPill = el.querySelector('#list-summary-pill');
    if (!wrap) return;

    // Update filter counts
    const setCnt = (sel, val) => { const n = el.querySelector(sel); if (n) n.textContent = val; };
    setCnt('#flt-cnt-all', registrations.length.toLocaleString('th-TH'));
    setCnt('#flt-cnt-chk', registrations.filter(r => r.status === 'checked_in').length.toLocaleString('th-TH'));
    setCnt('#flt-cnt-pend', registrations.filter(r => r.status !== 'checked_in').length.toLocaleString('th-TH'));

    const filtered = getFilteredList();

    if (summaryPill) {
      summaryPill.innerHTML = `จำนวนผู้เข้าร่วมงานในรายการนี้ <strong>${filtered.length.toLocaleString('th-TH')}</strong> คน (จากทั้งหมด <strong>${registrations.length.toLocaleString('th-TH')}</strong> คน)`;
    }

    if (filtered.length === 0) {
      wrap.innerHTML = `
        <div class="staff-empty-state">
          <div style="font-size:42px;margin-bottom:8px">📋</div>
          <strong>ยังไม่มีรายชื่อผู้ลงทะเบียนในหมวดหมู่นี้</strong>
          <p>เมื่อผู้มาร่วมงานลงทะเบียนผ่านหน้า Checkin ออนไลน์ รายชื่อและยอดสถิติจะแสดงที่นี่ทันที หรือกดปุ่ม "🧪 จำลองข้อมูลตัวอย่าง" ด้านบนเพื่อทดสอบระบบ</p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <table class="table staff-table">
        <thead>
          <tr>
            <th style="width:70px;text-align:center">ลำดับ</th>
            <th>รหัสตั๋ว</th>
            <th>ชื่อเล่น,ชื่อในวงการ,ชื่อทางการ</th>
            <th>เบอร์โทรศัพท์</th>
            <th>เวลาที่ลงทะเบียน</th>
            <th>เวลาเช็กอิน</th>
            <th>สถานะเข้าร่วมงาน</th>
            <th style="text-align:right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((r, idx) => {
            const isChecked = r.status === 'checked_in';
            return `
              <tr class="${isChecked ? 'row-checked' : ''}">
                <td style="text-align:center;color:var(--muted);font-variant-numeric:tabular-nums">${idx + 1}</td>
                <td><span class="mono-id">${esc(r.id)}</span></td>
                <td><strong>${esc(r.fullName)}</strong></td>
                <td style="font-variant-numeric:tabular-nums">${esc(formatFullPhone(r.phone))}</td>
                <td style="font-size:13px;color:var(--cocoa-2)">${fmtTime(r.createdAt)}</td>
                <td style="font-size:13px;color:var(--leaf-d)">
                  ${isChecked && r.checkedInAt ? fmtTime(r.checkedInAt) : '<span style="color:var(--muted)">-</span>'}
                </td>
                <td>
                  <button type="button" class="status-toggle-btn ${isChecked ? 'checked' : 'pending'}" data-toggle-id="${esc(r.id)}" title="คลิกเพื่อเปลี่ยนสถานะเช็กอิน">
                    ${isChecked ? `${icon('check', 'fill')} เข้าร่วมงานแล้ว` : `${icon('clock')} รอเช็กอิน (กดเพื่อเช็กอิน)`}
                  </button>
                </td>
                <td style="text-align:right">
                  <button type="button" class="btn-icon-del" data-del-id="${esc(r.id)}" data-del-name="${esc(r.fullName)}" title="ลบรายชื่อนี้">${icon('close')}</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function updateDashboardNumbers(s) {
    stats = s;
    const bw = getCheckinBarWidths(s);
    const pctCheckin = s.registered > 0 ? Math.round((s.checkedIn / s.registered) * 100) : 0;

    const setTxt = (sel, val) => { const n = el.querySelector(sel); if (n) n.textContent = val; };
    const kpiReg = el.querySelector('#kpi-reg');
    const kpiChk = el.querySelector('#kpi-chk');
    const kpiPend = el.querySelector('#kpi-pending');
    if (kpiReg) countUp(kpiReg, s.registered, 500);
    if (kpiChk) countUp(kpiChk, s.checkedIn, 500);
    if (kpiPend) countUp(kpiPend, s.pending || 0, 500);

    setTxt('#kpi-chk-pct', `${pctCheckin}%`);
    setTxt('#kpi-vis', (s.visitors || 1).toLocaleString('th-TH'));

    setTxt('#prog-summary-text', `ผู้ลงทะเบียนทั้งหมด ${s.registered.toLocaleString('th-TH')} คน · เช็กอินเข้างานแล้ว ${s.checkedIn.toLocaleString('th-TH')} คน · รอเช็กอิน ${(s.pending || 0).toLocaleString('th-TH')} คน`);
    setTxt('#prog-badge', `รวมทั้งหมด ${s.registered.toLocaleString('th-TH')} คน`);
    setTxt('#leg-chk', s.checkedIn.toLocaleString('th-TH'));
    setTxt('#leg-pend', (s.pending || 0).toLocaleString('th-TH'));

    const fillChk = el.querySelector('#prog-fill-checked');
    const fillPend = el.querySelector('#prog-fill-pending');
    if (fillChk) fillChk.style.width = `${bw.chkW}%`;
    if (fillPend) fillPend.style.width = `${bw.pendW}%`;
  }

  /* =========================================================
     EVENT BINDINGS FOR DASHBOARD
     ========================================================= */
  function bindDashboardEvents() {
    // Section tabs
    el.querySelector('#staff-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab || tab.dataset.tab === activeTab) return;
      activeTab = tab.dataset.tab;
      el.querySelectorAll('#staff-tabs .staff-tab').forEach(b => b.classList.toggle('active', b === tab));
      el.querySelector('#panel-guests').hidden = activeTab !== 'guests';
      el.querySelector('#panel-lucky').hidden = activeTab !== 'lucky';
      el.querySelector('#panel-polaroid').hidden = activeTab !== 'polaroid';
      if (activeTab === 'lucky') { mountLucky(); lucky?.refresh(); }
      if (activeTab === 'polaroid') { renderPolaroidPanel(); }
    });

    // Logout
    el.querySelector('#btn-logout')?.addEventListener('click', () => {
      clearStaffSession();
      session = null;
      toast('ล็อกหน้าจอเจ้าหน้าที่เรียบร้อย', '');
      mount();
    });

    // Search & filter
    el.querySelector('#guest-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderGuestTable();
    });

    el.querySelector('#guest-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      filterMode = btn.dataset.filter;
      el.querySelectorAll('#guest-filters .filter-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === filterMode);
      });
      renderGuestTable();
    });

    // Table actions (toggle check-in / delete)
    el.querySelector('#guest-table-wrap')?.addEventListener('click', async (e) => {
      const toggleBtn = e.target.closest('[data-toggle-id]');
      if (toggleBtn) {
        const id = toggleBtn.dataset.toggleId;
        toggleBtn.disabled = true;
        const updated = await toggleCheckIn(id, session.staffName);
        if (updated) {
          toast(
            updated.status === 'checked_in'
              ? `เช็กอิน ${updated.fullName} เรียบร้อย ✅`
              : `ยกเลิกสถานะเช็กอินของ ${updated.fullName} แล้ว`,
            'ok'
          );
          registrations = await listRegistrations();
          renderGuestTable();
        }
        return;
      }

      const delBtn = e.target.closest('[data-del-id]');
      if (delBtn) {
        const id = delBtn.dataset.delId;
        const name = delBtn.dataset.delName;
        if (!confirm(`ต้องการลบรายชื่อ "${name}" (${id}) ออกจากระบบใช่หรือไม่?`)) return;
        await deleteRegistration(id, session.staffName);
        toast(`ลบรายชื่อ "${name}" เรียบร้อย`, '');
        registrations = await listRegistrations();
        renderGuestTable();
      }
    });

    // Export CSV
    el.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      if (registrations.length === 0) {
        toast('ยังไม่มีข้อมูลรายชื่อสำหรับส่งออก', 'err');
        return;
      }
      const headers = ['ลำดับ', 'รหัสตั๋ว', 'ชื่อ-นามสกุล', 'เบอร์โทรศัพท์', 'สถานะ', 'เวลาลงทะเบียน', 'เวลาเช็กอิน', 'ผู้เช็กอิน'];
      const rows = registrations.map((r, i) => [
        i + 1,
        r.id,
        r.fullName,
        formatFullPhone(r.phone),
        r.status === 'checked_in' ? 'เข้าร่วมงานแล้ว' : 'รอเช็กอิน',
        r.createdAt ? new Date(r.createdAt).toLocaleString('th-TH') : '',
        r.checkedInAt ? new Date(r.checkedInAt).toLocaleString('th-TH') : '',
        r.checkedInBy || ''
      ]);
      const csvContent = '\uFEFF' + [headers, ...rows]
        .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `รายชื่อผู้ร่วมงานบวช-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('ดาวน์โหลดไฟล์ CSV เรียบร้อย 📥', 'ok');
    });

    // Seed demo data
    el.querySelector('#btn-seed-demo')?.addEventListener('click', async () => {
      await seedDemo(20);
      registrations = await listRegistrations();
      renderGuestTable();
      toast('เพิ่มข้อมูลตัวอย่าง 20 รายชื่อเรียบร้อย 🧪', 'ok');
    });

    // Reset all data
    el.querySelector('#btn-reset-all')?.addEventListener('click', async () => {
      if (!confirm('⚠️ ยืนยันการล้างข้อมูลผู้ลงทะเบียนทั้งหมดหรือไม่? (ไม่สามารถกู้คืนได้)')) return;
      await resetAll();
      registrations = await listRegistrations();
      renderGuestTable();
      toast('ล้างข้อมูลทั้งหมดเรียบร้อย', '');
    });
  }

  await mount();

  offStats = onStats(async (newStats) => {
    if (!session) return;
    updateDashboardNumbers(newStats);
    registrations = await listRegistrations();
    renderGuestTable();
    if (lucky && activeTab === 'lucky') lucky.refresh();
  });

  return () => {
    if (keyCleanup) keyCleanup();
    if (offStats) offStats();
    unmountLucky();
  };
}
