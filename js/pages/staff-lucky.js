/**
 * MERIT FEST — Staff · Lucky Star admin panel
 * Prize CRUD · stock · participants & results · redemption (QR / code)
 * Staff redemption here NEVER performs a guest check-in.
 */
import {
  listPrizes, savePrize, deletePrize, listLuckyPlays, getLuckyStats,
  getLuckyConfig, saveLuckyConfig, getLuckyWindow, findClaim, redeemPrize,
  revokeLuckyPrize, resetLuckyPlays, formatClaimCode, ApiError,
} from '../store.js';
import { esc, toast, fmtTime, icon, waitForGlobal } from '../ui.js';
import { starSvg } from '../lucky-star.js';

const visual = p => p?.image
  ? `<img class="lsa-prize-img" src="${esc(p.image)}" alt="" />`
  : `<span class="lsa-prize-emoji">${esc(p?.emoji || '🎁')}</span>`;

/** Resize an uploaded image to max 256px so it fits in storage. */
function fileToSmallDataUrl(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('กรุณาเลือกไฟล์รูปภาพ'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')); };
    img.src = url;
  });
}

/**
 * @param {HTMLElement} root
 * @param {{staffName:string}} session
 * @returns {{refresh:()=>Promise<void>, cleanup:()=>void}}
 */
export function renderLuckyAdmin(root, session) {
  let playFilter = 'all';     // all | win | none | redeemed | awaiting
  let playQuery = '';
  let editing = null;         // prize being edited
  let pendingImage = '';      // dataURL from upload (or existing)
  let currentClaim = null;    // last looked-up claim
  let scanner = null;
  let alive = true;

  const cfg = getLuckyConfig();
  root.innerHTML = `
    <div class="lsa">
      <!-- Header / config -->
      <div class="card lsa-head">
        <div class="lsa-head-title">
          <div class="lsa-head-star">${starSvg('happy')}</div>
          <div>
            <span class="eyebrow">Lucky Star Admin</span>
            <h2>สอยดาว ลุ้นรับรางวัล</h2>
            <p class="lsa-window" id="lsa-window"></p>
          </div>
        </div>
        <div class="lsa-config">
          <label class="lsa-field">
            <span>จำนวนดาวทั้งหมดในตู้</span>
            <span class="lsa-inline">
              <input class="input" id="lsa-total" type="number" min="1" value="${cfg.totalStars}" />
              <button type="button" class="btn btn-sm" id="lsa-save-total">บันทึก</button>
            </span>
          </label>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="lsa-switch">
              <input type="checkbox" id="lsa-test" ${cfg.testMode ? 'checked' : ''} />
              <span class="lsa-switch-ui"></span>
              <span><b>โหมดทดสอบ</b><small>เปิดกิจกรรมก่อนวันงาน (ปิดก่อนใช้งานจริง)</small></span>
            </label>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="lsa-kpis" id="lsa-kpis"></div>

      <div class="lsa-grid">
        <!-- Redeem -->
        <div class="card lsa-redeem">
          <h3>${icon('camera', 'fill')} สแกน QR ยืนยันรับรางวัล</h3>
          <p class="lsa-hint">สแกน QR จากหน้าจอผู้ได้รับรางวัล หรือพิมพ์รหัส 8 หลัก · <b>ไม่ใช่การเช็กอินเข้างาน</b></p>
          <div class="lsa-scan-view" id="lsa-scan-view" hidden></div>
          <div class="lsa-inline" style="gap:8px;">
            <button type="button" class="btn btn-sm" id="lsa-scan-btn">${icon('camera')} เปิดกล้องสแกน</button>
            <button type="button" class="btn btn-sm btn-ghost" id="lsa-scan-refresh" title="รีเฟรชกล้องและล้างผลลัพธ์เพื่อเริ่มสแกนใหม่">🔄 รีเฟรชสแกนใหม่</button>
          </div>
          <form class="lsa-inline lsa-code-form" id="lsa-code-form">
            <input class="input" id="lsa-code" placeholder="เช่น K7Q2-M9XA" autocomplete="off" maxlength="20" />
            <button type="submit" class="btn btn-sm btn-primary">${icon('search')} ตรวจสอบ</button>
          </form>
          <div class="lsa-claim" id="lsa-claim"></div>
        </div>

        <!-- Prize form -->
        <div class="card lsa-form-card">
          <h3 id="lsa-form-title">${icon('flask')} เพิ่มรางวัล</h3>
          <form id="lsa-form" class="lsa-form" novalidate>
            <div class="lsa-form-row">
              <label class="lsa-field" style="flex:2"><span>ชื่อรางวัล *</span><input class="input" name="name" required /></label>
              <label class="lsa-field" style="flex:1"><span>จำนวน *</span><input class="input" name="qty" type="number" min="0" value="1" required /></label>
            </div>
            <label class="lsa-field"><span>รายละเอียด</span><input class="input" name="desc" /></label>
            <div class="lsa-form-row">
              <label class="lsa-field" style="flex:1"><span>อีโมจิ (ใช้เมื่อไม่มีรูป)</span><input class="input" name="emoji" value="🎁" maxlength="4" /></label>
              <label class="lsa-field" style="flex:2"><span>รูปรางวัล</span><input class="input" name="image" type="file" accept="image/*" /></label>
            </div>
            <div class="lsa-preview" id="lsa-preview"></div>
            <div class="lsa-inline">
              <button type="submit" class="btn btn-primary btn-sm" id="lsa-submit">บันทึกรางวัล</button>
              <button type="button" class="btn btn-sm btn-ghost" id="lsa-cancel" hidden>ยกเลิกการแก้ไข</button>
            </div>
            <span class="err" id="lsa-form-err"></span>
          </form>
        </div>
      </div>

      <!-- Prize table -->
      <div class="card">
        <div class="lsa-sec-head"><h3>🎁 รายการรางวัล</h3><span id="lsa-prize-sum"></span></div>
        <div class="staff-table-wrap" id="lsa-prizes"></div>
      </div>

      <!-- Participants -->
      <div class="card">
        <div class="lsa-sec-head"><h3>${icon('users', 'fill')} ผู้เข้าร่วมกิจกรรมและผลการสุ่ม</h3></div>
        <div class="staff-list-controls staff-list-controls-row">
          <div class="staff-search-box" style="flex:1;min-width:220px">
            <span class="search-ico">${icon('search')}</span>
            <input type="search" class="input staff-search-input" id="lsa-q" placeholder="ค้นหาชื่อ, รหัสตั๋ว MF-xxxx, รหัสรับรางวัล..." />
          </div>
          <div class="staff-filter-pills" id="lsa-filters">
            ${[['all', 'ทั้งหมด'], ['win', 'ได้รางวัล'], ['awaiting', 'รอรับรางวัล'], ['redeemed', 'รับแล้ว'], ['none', 'ไม่ได้รางวัล']]
              .map(([k, l]) => `<button type="button" class="filter-pill ${k === 'all' ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="staff-table-wrap" id="lsa-plays"></div>
      </div>

      <!-- Redemption history -->
      <div class="card">
        <div class="lsa-sec-head"><h3>${icon('check', 'fill')} ประวัติการรับรางวัล</h3></div>
        <div class="staff-table-wrap" id="lsa-history"></div>
        <div class="staff-list-foot">
          <span style="font-size:12px;color:var(--muted)">💡 ผลการสุ่มแก้ไขไม่ได้ · QR รับรางวัลใช้ได้ครั้งเดียว</span>
          <button type="button" class="btn btn-sm btn-ghost" id="lsa-reset" style="color:var(--rose-d);font-size:12px">${icon('trash')} ล้างผลการเล่นทั้งหมด (สำหรับทดสอบ)</button>
        </div>
      </div>
    </div>`;

  const $ = s => root.querySelector(s);
  const form = $('#lsa-form');
  const F = form.elements;

  /* ---------------- renderers ---------------- */
  function paintWindow() {
    const w = getLuckyWindow();
    const label = w.testMode
      ? '<span class="badge warn">🧪 โหมดทดสอบ: เปิดกิจกรรมอยู่</span>'
      : w.state === 'open' ? '<span class="badge ok"><span class="dot live"></span> เปิดกิจกรรมวันนี้</span>'
        : w.state === 'before' ? `<span class="badge">🔒 Locked · เปิด ${esc(w.label)}</span>`
          : '<span class="badge">กิจกรรมสิ้นสุดแล้ว</span>';
    $('#lsa-window').innerHTML = `${label} <small>เวลาประเทศไทย (Asia/Bangkok) วันนี้: ${esc(w.today)}</small>`;
  }

  function paintKpis(s) {
    const k = (label, v, sub, cls = '') => `
      <div class="card lsa-kpi ${cls}"><span class="kpi-label">${label}</span><b>${v.toLocaleString('th-TH')}</b><small>${sub}</small></div>`;
    $('#lsa-kpis').innerHTML =
      k('ผู้เข้าร่วมกิจกรรม', s.participants, 'คน · สุ่มแล้ว') +
      k('ได้รับรางวัล', s.winners, 'คน', 'is-gold') +
      k('ไม่ได้รับรางวัล', s.noPrize, 'คน') +
      k('รับรางวัลแล้ว', s.redeemed, `รอรับ ${s.awaitingRedeem} คน`, 'is-leaf') +
      k('รางวัลคงเหลือ', s.prizeRemaining, `จากทั้งหมด ${s.prizeTotal} ชิ้น`) +
      k('ดาวคงเหลือในตู้', s.starsLeft, `จาก ${s.totalStars} ดวง`);
  }

  function paintPrizes(prizes) {
    const tot = prizes.reduce((a, p) => a + (Number(p.qty) || 0), 0);
    const rem = prizes.reduce((a, p) => a + p.remaining, 0);
    $('#lsa-prize-sum').innerHTML = `ทั้งหมด <b>${tot}</b> ชิ้น · คงเหลือ <b>${rem}</b> ชิ้น`;
    if (!prizes.length) {
      $('#lsa-prizes').innerHTML = `<div class="staff-empty-state"><strong>ยังไม่มีรางวัล</strong><p>เพิ่มรางวัลจากฟอร์มด้านบน · ถ้าไม่มีรางวัล ผู้เล่นทุกคนจะได้ผล "ไม่ได้รับรางวัล"</p></div>`;
      return;
    }
    $('#lsa-prizes').innerHTML = `
      <table class="table staff-table">
        <thead><tr><th>รางวัล</th><th style="text-align:center">ทั้งหมด</th><th style="text-align:center">แจกแล้ว</th><th style="text-align:center">รับแล้ว</th><th style="text-align:center">คงเหลือ</th><th style="text-align:right">จัดการ</th></tr></thead>
        <tbody>${prizes.map(p => `
          <tr>
            <td><div class="lsa-prize-cell">${visual(p)}<div><strong>${esc(p.name)}</strong><small>${esc(p.desc || '')}</small></div></div></td>
            <td style="text-align:center">${p.qty}</td>
            <td style="text-align:center">${p.awarded}</td>
            <td style="text-align:center">${p.redeemed}</td>
            <td style="text-align:center"><span class="badge ${p.remaining ? 'ok' : 'warn'}">${p.remaining}</span></td>
            <td style="text-align:right;white-space:nowrap">
              <button type="button" class="btn btn-sm" data-edit="${esc(p.id)}">แก้ไข</button>
              <button type="button" class="btn-icon-del" data-del="${esc(p.id)}" title="${p.awarded ? 'มีผู้ได้รับแล้ว ลบไม่ได้' : 'ลบรางวัล'}" ${p.awarded ? 'disabled' : ''}>${icon('trash')}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  const statusBadge = p => p.status === 'redeemed'
    ? '<span class="badge ok">✅ รับรางวัลแล้ว</span>'
    : p.status === 'won' ? '<span class="badge warn">⭐ รอรับรางวัล</span>'
      : p.status === 'forfeited' ? '<span class="badge" style="background:rgba(200,80,60,.12);color:var(--rose-d);font-weight:600">↩️ สละสิทธิ์ (คืนตู้)</span>'
        : '<span class="badge">ไม่ได้รับรางวัล</span>';

  function paintPlays(plays) {
    const q = playQuery.trim().toLowerCase().replace(/-/g, '');
    const list = plays.filter(p => {
      if (playFilter === 'win' && p.result !== 'win') return false;
      if (playFilter === 'none' && p.result !== 'none') return false;
      if (playFilter === 'redeemed' && p.status !== 'redeemed') return false;
      if (playFilter === 'awaiting' && p.status !== 'won') return false;
      if (!q) return true;
      return [p.fullName, p.regId, p.id, p.claimCode, p.prize?.name, p.forfeitedPrizeName].some(v => String(v || '').toLowerCase().replace(/-/g, '').includes(q));
    });
    if (!list.length) {
      $('#lsa-plays').innerHTML = `<div class="staff-empty-state"><strong>ยังไม่มีผู้เข้าร่วมในหมวดนี้</strong><p>เมื่อผู้ร่วมงานกด "Check-in &amp; สอยดาว" บนแผนที่ 3D ผลจะแสดงที่นี่ทันที</p></div>`;
      return;
    }
    $('#lsa-plays').innerHTML = `
      <table class="table staff-table">
        <thead><tr><th>ลำดับ</th><th>รหัสตั๋ว</th><th>ชื่อผู้เข้าร่วม</th><th>ผลการสุ่ม</th><th>รหัสรับรางวัล</th><th>เวลาสุ่ม</th><th>สถานะ</th><th style="text-align:right">จัดการ</th></tr></thead>
        <tbody>${list.map(p => `
          <tr class="${p.status === 'redeemed' ? 'row-checked' : ''}">
            <td><span class="mono-id">${esc(p.id)}</span></td>
            <td><span class="mono-id">${esc(p.regId)}</span></td>
            <td><strong>${esc(p.fullName)}</strong></td>
            <td>${p.prize
              ? `<div class="lsa-prize-cell sm">${visual(p.prize)}<span>${esc(p.prize.name)}</span></div>`
              : p.forfeitedPrizeName
                ? `<div class="lsa-prize-cell sm" style="opacity:0.65"><span style="text-decoration:line-through">${esc(p.forfeitedPrizeName)}</span><small style="color:var(--rose-d);display:block">สละสิทธิ์</small></div>`
                : '<span style="color:var(--muted)">—</span>'}</td>
            <td>${p.claimCode ? `<span class="mono-id">${esc(formatClaimCode(p.claimCode))}</span>` : '-'}</td>
            <td style="font-size:13px;color:var(--cocoa-2)">${fmtTime(p.playedAt)}</td>
            <td>${statusBadge(p)}</td>
            <td style="text-align:right;white-space:nowrap">
              ${p.status === 'won'
                ? `<button type="button" class="btn btn-sm" style="background:#fff1f0;color:#cf1322;border:1px solid #ffa39e;font-size:12px;padding:3px 8px;font-weight:500;" data-forfeit="${esc(p.id)}" data-name="${esc(p.fullName)}" data-prize="${esc(p.prize?.name || 'รางวัล')}" title="ไม่มารับ / สละสิทธิ์ เพื่อนำรางวัลกลับเข้าสู่ตู้สอยดาว">↩️ คืนรางวัลสู่ตู้</button>`
                : p.status === 'forfeited'
                  ? '<span style="font-size:12px;color:var(--muted)">คืนตู้แล้ว</span>'
                  : '<span style="color:var(--muted)">—</span>'}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function paintHistory(plays) {
    const list = plays.filter(p => p.redeemedAt).sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt));
    $('#lsa-history').innerHTML = list.length ? `
      <table class="table staff-table">
        <thead><tr><th>เวลารับรางวัล</th><th>ผู้รับ</th><th>รางวัล</th><th>รหัส</th><th>ผู้ส่งมอบ (Staff)</th></tr></thead>
        <tbody>${list.map(p => `
          <tr>
            <td style="font-size:13px">${fmtTime(p.redeemedAt)}</td>
            <td><strong>${esc(p.fullName)}</strong> <span class="mono-id">${esc(p.regId)}</span></td>
            <td>${esc(p.prize?.name || '-')}</td>
            <td><span class="mono-id">${esc(formatClaimCode(p.claimCode))}</span></td>
            <td>${esc(p.redeemedBy || '-')}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : `<div class="staff-empty-state"><strong>ยังไม่มีการรับรางวัล</strong></div>`;
  }

  function paintClaim() {
    const el = $('#lsa-claim');
    const c = currentClaim;
    if (!c) { el.innerHTML = ''; return; }
    if (c.result === 'invalid') {
      el.innerHTML = `
        <div class="lsa-claim-box is-bad">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <b style="font-size:15px">❌ ไม่พบสิทธิ์รับรางวัล</b><br/>
              <small style="opacity:0.9">QR / รหัสไม่ถูกต้อง หรือไม่ใช่ QR รับรางวัล Lucky Star</small>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" id="lsa-claim-clear" title="ปิดกล่องนี้" style="flex:none;padding:2px 8px;">✕</button>
          </div>
          <button type="button" class="btn btn-sm btn-dark btn-block" id="lsa-claim-rescan" style="margin-top:6px;">🔄 สแกนใหม่ / ลองอีกครั้ง</button>
        </div>`;
      return;
    }
    if (c.result === 'forfeited') {
      const p = c.play;
      el.innerHTML = `
        <div class="lsa-claim-box is-bad">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <b style="font-size:15px;color:var(--rose-d)">↩️ รางวัลนี้ถูกสละสิทธิ์แล้ว (คืนสู่ตู้)</b><br/>
              <small style="opacity:0.9"><b>${esc(p?.fullName || '')}</b> (${esc(p?.regId || '')}) · รางวัลเดิม: ${esc(p?.forfeitedPrizeName || 'รางวัล')}<br/>ถูกสละสิทธิ์และนำรางวัลกลับไปให้ผู้อื่นสุ่มใหม่แล้ว</small>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" id="lsa-claim-clear" title="ปิดกล่องนี้" style="flex:none;padding:2px 8px;">✕</button>
          </div>
          <button type="button" class="btn btn-sm btn-dark btn-block" id="lsa-claim-rescan" style="margin-top:6px;">🔄 สแกนใหม่ / ตรวจสอบคนถัดไป</button>
        </div>`;
      return;
    }
    const p = c.play;
    const done = p.status === 'redeemed';
    el.innerHTML = `
      <div class="lsa-claim-box ${done ? 'is-done' : 'is-ok'}">
        <div class="lsa-prize-cell">${visual(p.prize)}<div><strong>${esc(p.prize?.name || '')}</strong><small>${esc(p.fullName)} · ${esc(p.regId)} · ${esc(formatClaimCode(p.claimCode))}</small></div></div>
        ${done
          ? `<div class="lsa-claim-msg">⚠️ <b>รับรางวัลไปแล้ว</b> เมื่อ ${fmtTime(p.redeemedAt)} โดย ${esc(p.redeemedBy || '-')}<br/><small>QR นี้ถูกใช้แล้ว ไม่สามารถรับซ้ำได้</small></div>
             <button type="button" class="btn btn-sm btn-ghost btn-block" id="lsa-claim-rescan" style="margin-top:6px;">🔄 สแกนคนถัดไป / สแกนใหม่</button>`
          : `<div class="lsa-claim-msg">✅ สิทธิ์ถูกต้อง · ยังไม่ได้รับรางวัล</div>
             <button type="button" class="btn btn-primary btn-block" id="lsa-confirm">${icon('check', 'fill')} ยืนยันส่งมอบรางวัล</button>
             <button type="button" class="btn btn-sm btn-ghost btn-block" id="lsa-forfeit-claim" style="color:var(--rose-d);margin-top:6px;">↩️ สละสิทธิ์ / ไม่มารับ (คืนรางวัลสู่ตู้)</button>
             <button type="button" class="btn btn-sm btn-ghost btn-block" id="lsa-claim-rescan" style="margin-top:4px;">🔄 สแกนรหัสอื่น</button>`}
      </div>`;
  }

  async function refresh() {
    const [stats, prizes, plays] = await Promise.all([getLuckyStats(), listPrizes(), listLuckyPlays()]);
    if (!alive) return;
    paintWindow(); paintKpis(stats); paintPrizes(prizes); paintPlays(plays); paintHistory(plays);
    if (currentClaim?.play) {
      const fresh = plays.find(p => p.id === currentClaim.play.id);
      if (fresh) { currentClaim = { ...currentClaim, play: fresh, result: fresh.redeemedAt ? 'already' : 'ok' }; paintClaim(); }
    }
  }

  /* ---------------- prize form ---------------- */
  function paintPreview() {
    $('#lsa-preview').innerHTML = pendingImage
      ? `<img src="${pendingImage}" alt="" /><button type="button" class="btn btn-sm btn-ghost" id="lsa-rm-img">ลบรูป</button>`
      : '';
  }
  function resetForm() {
    editing = null; pendingImage = '';
    form.reset(); F.emoji.value = '🎁'; F.qty.value = 1;
    $('#lsa-form-title').innerHTML = `${icon('flask')} เพิ่มรางวัล`;
    $('#lsa-cancel').hidden = true; $('#lsa-form-err').textContent = '';
    paintPreview();
  }
  F.image.addEventListener('change', async () => {
    const f = F.image.files?.[0];
    if (!f) return;
    try { pendingImage = await fileToSmallDataUrl(f); paintPreview(); }
    catch (err) { toast(err.message, 'err'); }
  });
  $('#lsa-preview').addEventListener('click', e => {
    if (e.target.id === 'lsa-rm-img') { pendingImage = ''; F.image.value = ''; paintPreview(); }
  });
  $('#lsa-cancel').addEventListener('click', resetForm);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    $('#lsa-form-err').textContent = '';
    try {
      const p = await savePrize({
        id: editing?.id, name: F.name.value, qty: F.qty.value,
        desc: F.desc.value, emoji: F.emoji.value, image: pendingImage,
      }, session.staffName);
      toast(`${editing ? 'แก้ไข' : 'เพิ่ม'}รางวัล "${p.name}" เรียบร้อย`, 'ok');
      resetForm();
      refresh();
    } catch (err) {
      $('#lsa-form-err').textContent = err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ';
    }
  });
  $('#lsa-prizes').addEventListener('click', async e => {
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const p = (await listPrizes()).find(x => x.id === ed.dataset.edit);
      if (!p) return;
      editing = p; pendingImage = p.image || '';
      F.name.value = p.name; F.qty.value = p.qty; F.desc.value = p.desc || ''; F.emoji.value = p.emoji || '🎁';
      F.image.value = '';
      $('#lsa-form-title').innerHTML = `✏️ แก้ไขรางวัล <span class="mono-id">${esc(p.id)}</span>`;
      $('#lsa-cancel').hidden = false;
      paintPreview();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del && !del.disabled) {
      if (!confirm('ต้องการลบรางวัลนี้ใช่หรือไม่?')) return;
      try { await deletePrize(del.dataset.del, session.staffName); toast('ลบรางวัลเรียบร้อย', ''); refresh(); }
      catch (err) { toast(err.message, 'err'); }
    }
  });

  /* ---------------- config ---------------- */
  $('#lsa-save-total').addEventListener('click', async () => {
    const c = await saveLuckyConfig({ totalStars: $('#lsa-total').value }, session.staffName);
    $('#lsa-total').value = c.totalStars;
    toast(`ตั้งจำนวนดาวในตู้ ${c.totalStars} ดวง`, 'ok');
  });
  $('#lsa-test').addEventListener('change', async e => {
    await saveLuckyConfig({ testMode: e.target.checked }, session.staffName);
    toast(e.target.checked ? '🧪 เปิดโหมดทดสอบ: กิจกรรมเปิดให้เล่นแล้ว' : 'ปิดโหมดทดสอบ: กลับไปใช้วันที่จริง', e.target.checked ? 'ok' : '');
  });
  $('#lsa-reset').addEventListener('click', async () => {
    if (!confirm('⚠️ ล้างผลการเล่น Lucky Star ทั้งหมด? (สต็อกรางวัลจะกลับมาเต็ม · ไม่ยกเลิกสถานะเช็กอิน)')) return;
    await resetLuckyPlays(session.staffName);
    currentClaim = null; paintClaim();
    toast('ล้างผลการเล่นทั้งหมดเรียบร้อย', '');
  });

  /* ---------------- participants filter & actions ---------------- */
  $('#lsa-q').addEventListener('input', async e => { playQuery = e.target.value; paintPlays(await listLuckyPlays()); });
  $('#lsa-filters').addEventListener('click', async e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    playFilter = b.dataset.f;
    root.querySelectorAll('#lsa-filters .filter-pill').forEach(x => x.classList.toggle('active', x === b));
    paintPlays(await listLuckyPlays());
  });
  $('#lsa-plays').addEventListener('click', async e => {
    const btn = e.target.closest('[data-forfeit]');
    if (!btn) return;
    const { forfeit: playId, name, prize } = btn.dataset;
    if (!confirm(`ยืนยันการสละสิทธิ์รางวัล "${prize}" ของ ${name}?\n\nรางวัลชิ้นนี้จะถูกนำกลับเข้าตู้สอยดาวทันที เพื่อให้ผู้ร่วมงานท่านอื่นสุ่มได้`)) return;
    try {
      btn.disabled = true;
      await revokeLuckyPrize(playId, session.staffName);
      toast(`คืนรางวัล "${prize}" กลับสู่ตู้สอยดาวเรียบร้อย ✨`, 'ok');
      await refresh();
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'เกิดข้อผิดพลาดในการคืนรางวัล', 'err');
    }
  });

  /* ---------------- redeem ---------------- */
  async function lookup(text) {
    currentClaim = await findClaim(text);
    if (!alive) return;
    paintClaim();
    if (currentClaim.result === 'invalid') toast('ไม่พบสิทธิ์รับรางวัล', 'err');
  }
  $('#lsa-code-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#lsa-code').value.trim();
    if (v) lookup(v);
  });
  $('#lsa-claim').addEventListener('click', async e => {
    if (e.target.closest('#lsa-claim-clear') || e.target.closest('#lsa-claim-rescan')) {
      await resetScan();
      return;
    }
    if (e.target.closest('#lsa-forfeit-claim') && currentClaim?.play) {
      const p = currentClaim.play;
      const prizeName = p.prize?.name || 'รางวัล';
      if (!confirm(`ยืนยันการสละสิทธิ์รางวัล "${prizeName}" ของ ${p.fullName}?\n\nรางวัลจะถูกนำกลับเข้าสู่ตู้สอยดาวทันที เพื่อให้ผู้ร่วมงานท่านอื่นมีโอกาสสุ่มได้`)) return;
      try {
        await revokeLuckyPrize(p.id, session.staffName);
        toast(`คืนรางวัล "${prizeName}" กลับสู่ตู้สอยดาวเรียบร้อย ✨`, 'ok');
        currentClaim = null;
        paintClaim();
        $('#lsa-code').value = '';
        await refresh();
      } catch (err) {
        toast(err.message || 'เกิดข้อผิดพลาดในการคืนรางวัล', 'err');
      }
      return;
    }
    if (e.target.closest('#lsa-confirm') && currentClaim?.play) {
      e.target.closest('#lsa-confirm').disabled = true;
      const r = await redeemPrize(currentClaim.play.claimCode, session.staffName);
      if (r.result === 'ok') toast(`ส่งมอบ "${r.play.prize?.name}" ให้ ${r.play.fullName} เรียบร้อย ✅`, 'ok');
      else if (r.result === 'already') toast('QR นี้ถูกใช้รับรางวัลไปแล้ว', 'err');
      else toast('ไม่พบสิทธิ์รับรางวัล', 'err');
      currentClaim = r.play ? { result: r.play.redeemedAt ? 'already' : 'ok', play: r.play } : { result: 'invalid' };
      paintClaim();
      $('#lsa-code').value = '';
      await refresh();
    }
  });

  let lastScannedText = '', lastScannedAt = 0;

  async function stopScan() {
    if (!scanner) return;
    const s = scanner; scanner = null;
    try { await s.stop(); s.clear(); } catch { }
    $('#lsa-scan-view').hidden = true;
    $('#lsa-scan-btn').innerHTML = `${icon('camera')} เปิดกล้องสแกน`;
  }

  async function startScan() {
    await stopScan();
    try {
      const Html5Qrcode = await waitForGlobal('Html5Qrcode');
      $('#lsa-scan-view').hidden = false;
      const scannerOpts = {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };
      if (window.Html5QrcodeSupportedFormats?.QR_CODE !== undefined) {
        scannerOpts.formatsToSupport = [window.Html5QrcodeSupportedFormats.QR_CODE];
      }
      scanner = new Html5Qrcode('lsa-scan-view', scannerOpts);
      $('#lsa-scan-btn').innerHTML = `${icon('close')} ปิดกล้อง`;
      lastScannedText = '';
      lastScannedAt = 0;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 24,
          qrbox: (w, h) => {
            const min = Math.min(w, h);
            const size = Math.max(260, Math.floor(min * 0.88));
            return { width: size, height: size };
          },
        },
        text => {
          if (currentClaim && currentClaim.result === 'ok') return; // รอส่งมอบหรือเคลียร์ก่อน
          const now = Date.now();
          if (text === lastScannedText && now - lastScannedAt < 2500) return; // debounce
          lastScannedText = text;
          lastScannedAt = now;
          lookup(text);
        }
      );
    } catch (err) {
      console.warn(err);
      toast('เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือพิมพ์รหัสแทน', 'err');
      await stopScan();
    }
  }

  async function resetScan() {
    currentClaim = null;
    paintClaim();
    $('#lsa-code').value = '';
    lastScannedText = '';
    lastScannedAt = 0;
    if (scanner) {
      await startScan();
      toast('รีเฟรชกล้องเรียบร้อย พร้อมสแกนใหม่ ✨', 'ok');
    } else {
      await startScan();
      toast('เปิดกล้องพร้อมสแกนแล้ว ✨', 'ok');
    }
  }

  $('#lsa-scan-btn').addEventListener('click', async () => {
    if (scanner) return stopScan();
    await startScan();
  });

  $('#lsa-scan-refresh')?.addEventListener('click', async () => {
    await resetScan();
  });

  resetForm();
  refresh();

  return {
    refresh,
    cleanup() { alive = false; stopScan(); },
  };
}
