/**
 * MERIT FEST — Lucky Star (สอยดาว ลุ้นรับรางวัล)
 * Floating card on the 3D map + draw animation + result popups.
 * All rules (registration, Asia/Bangkok date, one play per guest,
 * prize stock) are enforced in store.js — this file is UI only.
 *
 * Card states: unregistered · locked · ready · won · none · redeemed · ended
 */
import {
  getMyTicket, getLuckyWindow, getLuckyPlay, playLuckyStar, onStats,
  luckyQrPayload, formatClaimCode,
} from './store.js';
import { esc, toast, qrDataUrl, fmtTime } from './ui.js';

const DRAW_MS = 2300; // animation length before the reveal — short & snappy

let gradSeq = 0;
/** Cute glossy golden star with a face. mood: happy | sleepy | wow | wink */
export function starSvg(mood = 'happy', cls = '') {
  const g = `lsg${++gradSeq}`;
  const eyes = {
    happy: '<path d="M38 52q4-5 8 0M54 52q4-5 8 0" stroke="#5b3a12" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    sleepy: '<path d="M37 52q4.5 4 9 0M54 52q4.5 4 9 0" stroke="#5b3a12" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    wow: '<circle cx="42" cy="51" r="4.2" fill="#5b3a12"/><circle cx="58" cy="51" r="4.2" fill="#5b3a12"/><circle cx="43.4" cy="49.6" r="1.4" fill="#fff"/><circle cx="59.4" cy="49.6" r="1.4" fill="#fff"/>',
    wink: '<circle cx="42" cy="51" r="4" fill="#5b3a12"/><circle cx="43.3" cy="49.7" r="1.3" fill="#fff"/><path d="M54 52q4-5 8 0" stroke="#5b3a12" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  }[mood];
  const mouth = mood === 'wow'
    ? '<ellipse cx="50" cy="61.5" rx="4" ry="4.6" fill="#8a3b12"/>'
    : mood === 'sleepy'
      ? '<path d="M46 61q4 2.5 8 0" stroke="#8a3b12" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<path d="M44 59q6 7 12 0" stroke="#8a3b12" stroke-width="2.8" fill="#c2551d" stroke-linecap="round"/>';
  return `<svg class="ls-star-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="${g}" cx="38%" cy="30%" r="75%">
        <stop offset="0" stop-color="#fff6c4"/><stop offset=".42" stop-color="#ffd24a"/>
        <stop offset=".8" stop-color="#f5a623"/><stop offset="1" stop-color="#e0861a"/>
      </radialGradient>
    </defs>
    <path d="M50 6c3.4 0 5 2.6 6.4 5.6l8.2 17 18.6 2.6c3.3.5 6 1.6 7 4.8 1 3.1-.8 5.5-3.2 7.8L73.6 57l3.3 18.4c.6 3.3.4 6.2-2.3 8.1-2.7 2-5.6 1.2-8.5-.4L50 74.3l-16.1 8.8c-2.9 1.6-5.8 2.4-8.5.4-2.7-1.9-2.9-4.8-2.3-8.1L26.4 57 12.9 43.8c-2.4-2.3-4.2-4.7-3.2-7.8 1-3.2 3.7-4.3 7-4.8l18.6-2.6 8.2-17C45 8.6 46.6 6 50 6z"
      fill="url(#${g})" stroke="#d27a16" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M34 30q8-14 16-16" stroke="#fffbe6" stroke-width="5" stroke-linecap="round" fill="none" opacity=".85"/>
    <ellipse cx="34" cy="60" rx="5.5" ry="3.4" fill="#ff8f7a" opacity=".55"/>
    <ellipse cx="66" cy="60" rx="5.5" ry="3.4" fill="#ff8f7a" opacity=".55"/>
    ${eyes}${mouth}
  </svg>`;
}

const sparkles = (n = 6) => Array.from({ length: n }, (_, i) =>
  `<i class="ls-spark" style="--i:${i};--a:${(360 / n) * i}deg"></i>`).join('');

function prizeVisual(prize, cls = '') {
  if (!prize) return '';
  return prize.image
    ? `<img class="ls-prize-img ${cls}" src="${esc(prize.image)}" alt="${esc(prize.name)}" />`
    : `<span class="ls-prize-emoji ${cls}" aria-hidden="true">${esc(prize.emoji || '🎁')}</span>`;
}

/**
 * Mount the Lucky Star card into `host` and popups into `stage`.
 * @returns {() => void} cleanup
 */
export function mountLuckyStar(host, stage = document.body, opts = {}) {
  let alive = true;
  let busy = false;
  let ctx = { ticket: null, play: null, win: getLuckyWindow() };

  host.innerHTML = `
    <div class="ls-card" id="ls-card" data-state="loading" role="region" aria-label="Lucky Star สอยดาว ลุ้นรับรางวัล">
      <button type="button" class="ls-card-hit" id="ls-card-hit" aria-label="เปิดรายละเอียด Lucky Star"></button>
      <div class="ls-card-star">${starSvg('happy')}${sparkles(5)}</div>
      <div class="ls-card-main">
        <div class="ls-card-title">Lucky Star <span>· สอยดาว ลุ้นรับรางวัล</span></div>
        <div class="ls-card-desc" id="ls-card-desc">Check-in เข้าร่วมงาน พร้อมลุ้นรับรางวัลพิเศษ</div>
      </div>
      <button type="button" class="ls-card-btn" id="ls-card-btn" disabled>…</button>
    </div>`;

  const card = host.querySelector('#ls-card');
  const descEl = host.querySelector('#ls-card-desc');
  const btn = host.querySelector('#ls-card-btn');

  const modal = document.createElement('div');
  modal.className = 'ls-modal';
  modal.hidden = true;
  modal.innerHTML = `<div class="ls-modal-backdrop" data-close></div><div class="ls-modal-box" role="dialog" aria-modal="true" aria-live="polite"></div>`;
  stage.appendChild(modal);
  const box = modal.querySelector('.ls-modal-box');

  /* ---------------- state ---------------- */
  function stateOf() {
    const { ticket, play, win } = ctx;
    if (play) return play.status;              // won · none · redeemed (Already Played)
    if (!ticket) return 'unregistered';
    if (win.state === 'before') return 'locked';
    if (win.state === 'after') return 'ended';
    return 'ready';
  }

  function paintCard() {
    const s = stateOf();
    card.dataset.state = s;
    const set = (desc, label, disabled = false, extra = '') => {
      descEl.innerHTML = desc;
      btn.innerHTML = label;
      btn.disabled = disabled || busy;
      btn.className = `ls-card-btn ${extra}`;
    };
    const lockNote = ctx.win.testMode ? ' <em class="ls-test">โหมดทดสอบ</em>' : '';
    switch (s) {
      case 'unregistered':
        set('ลงทะเบียนเข้าร่วมงานก่อน เพื่อรับสิทธิ์ลุ้นรางวัล', 'ลงทะเบียน', false, 'is-outline'); break;
      case 'locked':
        set(`🔒 กิจกรรมจะเปิดให้เข้าร่วมในวันที่ ${esc(ctx.win.label)}`, '🔒 Check-in &amp; สอยดาว', true); break;
      case 'ended':
        set('กิจกรรมสอยดาวสิ้นสุดแล้ว ขอบคุณที่ร่วมงาน 🙏', 'ปิดกิจกรรม', true); break;
      case 'ready':
        set(`Check-in เข้าร่วมงาน พร้อมลุ้นรับรางวัลพิเศษ${lockNote}`, '⭐ Check-in &amp; สอยดาว', false, 'is-ready'); break;
      case 'won':
        set(`🎉 ได้รับ <b>${esc(ctx.play.prize?.name || 'รางวัล')}</b> · แสดง QR ที่จุดรับรางวัล`, 'ดู QR รับรางวัล', false, 'is-win'); break;
      case 'redeemed':
        set(`✅ รับรางวัล <b>${esc(ctx.play.prize?.name || '')}</b> เรียบร้อยแล้ว`, 'ดูผล', false, 'is-outline'); break;
      case 'none':
        set('ร่วมสนุกเรียบร้อยแล้ว · ขอบคุณที่ร่วมกิจกรรม 💛', 'ดูผล', false, 'is-outline'); break;
    }
  }

  async function refresh() {
    const ticket = await getMyTicket();
    const play = ticket ? await getLuckyPlay(ticket.token) : null;
    if (!alive) return;
    const prevStatus = ctx.play?.status;
    ctx = { ticket, play, win: getLuckyWindow() };
    paintCard();
    // live update an open popup when staff redeems the prize
    if (!modal.hidden && prevStatus === 'won' && play?.status === 'redeemed') showResult(play);
  }

  /* ---------------- modal ---------------- */
  let escHandler = null;
  function openModal(html, kind) {
    box.className = `ls-modal-box ls-${kind}`;
    box.innerHTML = html;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    if (!escHandler) {
      escHandler = e => { if (e.key === 'Escape' && !busy) closeModal(); };
      window.addEventListener('keydown', escHandler);
    }
  }
  function closeModal() {
    if (busy) return;
    modal.classList.remove('open');
    setTimeout(() => { if (!modal.classList.contains('open')) modal.hidden = true; }, 220);
    if (escHandler) { window.removeEventListener('keydown', escHandler); escHandler = null; }
    opts.onCloseModal?.();
  }
  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModal();
    if (e.target.closest('[data-go-checkin]')) { closeModal(); location.hash = '#/checkin'; }
    const copyBtn = e.target.closest('[data-copy-code]');
    if (copyBtn) {
      const code = copyBtn.getAttribute('data-copy-code') || copyBtn.textContent.trim();
      if (code) {
        const doCopy = async () => {
          try {
            await navigator.clipboard.writeText(code);
            return true;
          } catch {
            try {
              const ta = document.createElement('textarea');
              ta.value = code;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              const ok = document.execCommand('copy');
              document.body.removeChild(ta);
              return ok;
            } catch {
              return false;
            }
          }
        };
        doCopy().then(ok => {
          if (ok) {
            toast(`คัดลอกรหัส ${code} แล้ว 📋`, 'ok');
            copyBtn.classList.add('copied');
            const lbl = copyBtn.querySelector('.ls-copy-label');
            const ico = copyBtn.querySelector('.ls-copy-ico');
            if (lbl) lbl.textContent = 'คัดลอกแล้ว';
            if (ico) ico.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              if (lbl) lbl.textContent = 'คัดลอก';
              if (ico) ico.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
            }, 1800);
          } else {
            toast('ไม่สามารถคัดลอกได้', 'err');
          }
        });
      }
    }
  });

  function showDrawing() {
    openModal(`
      <div class="ls-draw">
        <div class="ls-draw-sky">
          <span class="ls-bg-star s1">★</span><span class="ls-bg-star s2">★</span>
          <span class="ls-bg-star s3">★</span><span class="ls-bg-star s4">★</span>
        </div>
        <div class="ls-hang">
          <span class="ls-string"></span>
          <div class="ls-hang-star">${starSvg('wow')}${sparkles(8)}</div>
        </div>
        <div class="ls-glow"></div>
        <h3 class="ls-draw-title">กำลังสอยดาว…</h3>
        <p class="ls-draw-sub">ตั้งจิตอธิษฐาน แล้วลุ้นไปพร้อมกัน ✨</p>
      </div>`, 'drawing');
  }

  async function showResult(play) {
    if (play.result === 'win') {
      const redeemed = play.status === 'redeemed';
      const qr = redeemed ? '' : await qrDataUrl(luckyQrPayload(play.claimCode), 6);
      if (!alive) return;
      openModal(`
        ${redeemed ? '' : `<div class="ls-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`}
        <button type="button" class="ls-x" data-close aria-label="ปิด">✕</button>
        <div class="ls-res-star">${starSvg(redeemed ? 'happy' : 'wink')}${sparkles(6)}</div>
        <div class="ls-res-kicker">${redeemed ? 'Prize Redeemed' : 'Lucky Star · Winner'}</div>
        <h3 class="ls-res-title">${redeemed ? 'รับรางวัลเรียบร้อยแล้ว' : 'ยินดีด้วย! คุณได้รับรางวัล'}</h3>
        <div class="ls-prize">
          ${prizeVisual(play.prize)}
          <div>
            <strong>${esc(play.prize?.name || 'รางวัลพิเศษ')}</strong>
            ${play.prize?.desc ? `<span>${esc(play.prize.desc)}</span>` : ''}
          </div>
        </div>
        ${redeemed ? `
          <div class="ls-redeemed-badge">✅ ส่งมอบรางวัลแล้ว · ${fmtTime(play.redeemedAt)}</div>
          <p class="ls-res-note">ขอบคุณที่ร่วมสนุกกับกิจกรรม Lucky Star 💛</p>
        ` : `
          <div class="ls-qr">
            <img src="${qr}" alt="QR Code สำหรับรับรางวัล" />
            <button type="button" class="ls-code" data-copy-code="${esc(formatClaimCode(play.claimCode))}" title="แตะเพื่อคัดลอกรหัส" aria-label="คัดลอกรหัส ${esc(formatClaimCode(play.claimCode))}">
              <span class="ls-code-text">${esc(formatClaimCode(play.claimCode))}</span>
              <span class="ls-copy-badge">
                <svg class="ls-copy-ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="ls-copy-label">คัดลอก</span>
              </span>
            </button>
          </div>
          <p class="ls-res-note"><b>กรุณาแสดง QR Code หรือแจ้งรหัสที่จุดรับรางวัล</b><br/>แตะที่รหัสเพื่อคัดลอก · ใช้ยืนยันได้ 1 ครั้งเท่านั้น</p>
        `}
        <button type="button" class="btn btn-primary btn-block" data-close>กลับสู่แผนที่ 3D</button>
      `, redeemed ? 'redeemed' : 'won');
    } else {
      openModal(`
        <button type="button" class="ls-x" data-close aria-label="ปิด">✕</button>
        <div class="ls-res-star is-soft">${starSvg('sleepy')}</div>
        <div class="ls-res-kicker">Lucky Star</div>
        <h3 class="ls-res-title">ขอบคุณที่ร่วมสนุก!</h3>
        <p class="ls-res-note">ครั้งนี้คุณยังไม่ได้รับรางวัล แต่ขอให้สนุกกับงาน MERIT FEST</p>
        <button type="button" class="btn btn-primary btn-block" data-close>กลับสู่แผนที่ 3D</button>
      `, 'none');
    }
  }

  function showInfo(kind) {
    const msg = {
      unregistered: ['ต้องลงทะเบียนก่อนนะ', 'กิจกรรมสอยดาวสำหรับผู้ที่ลงทะเบียนเข้าร่วมงานแล้วเท่านั้น ลงทะเบียนรับ QR Ticket ได้ภายใน 1 นาที', '<button type="button" class="btn btn-primary btn-block" data-go-checkin>ไปหน้าลงทะเบียน</button>'],
      locked: ['ยังไม่ถึงวันเปิดกิจกรรม', `กิจกรรมจะเปิดให้เข้าร่วมในวันที่ ${esc(ctx.win.label)}<br/>ระหว่างนี้สำรวจแผนที่ 3D ได้ตามปกติ`, ''],
      ended: ['กิจกรรมสิ้นสุดแล้ว', 'ขอบคุณทุกท่านที่ร่วมงานและร่วมสนุกกับ Lucky Star 🙏', ''],
    }[kind];
    openModal(`
      <button type="button" class="ls-x" data-close aria-label="ปิด">✕</button>
      <div class="ls-res-star is-soft">${starSvg(kind === 'locked' ? 'sleepy' : 'happy')}</div>
      <div class="ls-res-kicker">Lucky Star · สอยดาว ลุ้นรับรางวัล</div>
      <h3 class="ls-res-title">${msg[0]}</h3>
      <p class="ls-res-note">${msg[1]}</p>
      ${msg[2] || '<button type="button" class="btn btn-block" data-close>กลับสู่แผนที่ 3D</button>'}
    `, 'info');
  }

  async function triggerWalk() {
    if (typeof opts.onWalkToTree === 'function') {
      try {
        await opts.onWalkToTree();
      } catch (e) {
        console.warn('walkToTree fallback:', e);
      }
    }
  }

  /* ---------------- play ---------------- */
  async function play() {
    if (busy || !ctx.ticket) return;
    busy = true; paintCard();
    const t0 = performance.now();
    let res;
    try {
      // result is persisted BEFORE the reveal → refresh / offline re-entry shows the same result
      res = await playLuckyStar(ctx.ticket.token);
    } catch (err) {
      console.error(err);
      res = { result: 'error' };
    }

    if (res.play) {
      ctx.play = res.play; paintCard();

      // Walk ME to tree first, bubble shows "⭐ สอยดาว"
      await triggerWalk();
      if (!alive) return;

      // Play the full 3D interactive harvesting animation (both for first-time and re-play)
      if (typeof opts.onHarvestAnimation === 'function') {
        try {
          await opts.onHarvestAnimation(res);
        } catch (e) {
          console.warn('3D harvest animation fallback:', e);
        }
      } else {
        showDrawing();
        const wait = Math.max(0, DRAW_MS - (performance.now() - t0));
        await new Promise(r => setTimeout(r, wait));
      }
      busy = false;
      if (!alive) return;
      if (res.result === 'already') {
        toast('คุณร่วมกิจกรรมไปแล้ว แสดงผลเดิมของคุณ', '');
      }
      showResult(res.play);
    } else {
      busy = false;
      closeModal();
      const msg = {
        locked: `กิจกรรมจะเปิดในวันที่ ${ctx.win.label}`,
        ended: 'กิจกรรมสิ้นสุดแล้ว',
        not_registered: 'ไม่พบข้อมูลการลงทะเบียน กรุณาลงทะเบียนใหม่',
      }[res.result] || 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
      toast(msg, 'err');
      refresh();
    }
  }

  async function onAction() {
    if (busy) return;
    const s = stateOf();
    if (s === 'ready') return play();
    if (s === 'won' || s === 'none' || s === 'redeemed') {
      return play(); // re-play also triggers walk + 3D harvest animation + displays identical result
    }
    if (s === 'unregistered' || s === 'locked' || s === 'ended') {
      await triggerWalk();
      if (!alive) return;
      showInfo(s);
      return;
    }
  }
  btn.addEventListener('click', e => { e.stopPropagation(); onAction(); });
  host.querySelector('#ls-card-hit').addEventListener('click', () => {
    // tapping the card body never triggers a draw — it opens details / the result,
    // or (in ready state) highlights the main button
    if (stateOf() === 'ready') {
      btn.focus();
      btn.classList.remove('ls-pulse-once'); void btn.offsetWidth; btn.classList.add('ls-pulse-once');
      return;
    }
    onAction();
  });

  refresh();
  const off = onStats(() => refresh());
  const timer = setInterval(() => { if (!busy) refresh(); }, 30000); // date rollover

  const cleanupFn = () => {
    alive = false;
    off(); clearInterval(timer);
    if (escHandler) window.removeEventListener('keydown', escHandler);
    modal.remove();
    host.innerHTML = '';
  };
  cleanupFn.triggerAction = onAction;
  cleanupFn.getState = stateOf;
  cleanupFn.refresh = refresh;
  return cleanupFn;
}
