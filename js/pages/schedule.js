import { EVENT } from '../store.js';
import { $, $$, toast, footer } from '../ui.js';

/**
 * Format ISO string to Google Calendar format: YYYYMMDDTHHMMSSZ
 */
function toGCalTime(iso) {
  return new Date(iso).toISOString().replace(/-|:|\.\d{3}/g, '');
}

/**
 * Generate Google Calendar URL for an event
 */
function makeGCalUrl(title, startISO, endISO, desc, loc) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGCalTime(startISO)}/${toGCalTime(endISO)}`,
    details: desc,
    location: loc,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/**
 * Generate and download RFC 5545 iCalendar (.ics) file
 */
function downloadIcs(filename, events) {
  const now = toGCalTime(new Date().toISOString());
  const vEvents = events.map((ev, i) => `BEGIN:VEVENT
UID:mf-${ev.id || i}-${Date.now()}@meritfest.local
DTSTAMP:${now}
DTSTART:${toGCalTime(ev.startTimeISO)}
DTEND:${toGCalTime(ev.endTimeISO)}
SUMMARY:${ev.title} - งานอุปสมบท ${EVENT.candidateName} (${EVENT.candidateNickname})
DESCRIPTION:${ev.desc.replace(/\n/g, '\\n')} ณ ${ev.location}
LOCATION:${ev.location}
STATUS:CONFIRMED
END:VEVENT`).join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MERIT FEST//Ordination Ceremony//TH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vEvents,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function render(el) {
  const sched = EVENT.scheduleList || [];

  el.innerHTML = `
    <section class="page container sched-page">
      <!-- Auspicious Header & Invitation Card Showcase -->
      <div class="sched-hero glass card">
        <div class="sched-hero-decor">
          <span class="sched-emblem">☸</span>
          <span class="sched-pill">ขอกราบลาอุปสมบท</span>
        </div>

        <h1 class="sched-title">
          กำหนดการพิธีอุปสมบท
        </h1>

        <!-- Countdown Bar -->
        <div class="sched-countdown-wrap">
          <div class="countdown-head">
            <span class="countdown-badge">
              <span class="dot live"></span> นับถอยหลังสู่วันงานมงคล
            </span>
            <span class="countdown-target" id="sched-live-status">รอเริ่มพิธี</span>
          </div>
          <div class="countdown sched-countdown" id="sched-countdown">
            ${['วัน', 'ชั่วโมง', 'นาที', 'วินาที'].map((l, i) => `
              <div class="unit">
                <div class="num" data-i="${i}">--</div>
                <div class="lbl">${l}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Invitation Card Showcase inside Hero -->
        <div class="card card-invitation-showcase" style="max-width:540px;margin:0 auto;text-align:left;">
          <div class="invitation-img-wrap" id="invitation-trigger">
            <img src="${EVENT.invitationCardImg}" alt="การ์ดเชิญงานอุปสมบท ${EVENT.candidateName} (${EVENT.candidateNickname}) ${EVENT.dateTh}" class="invitation-thumb" />
            <div class="invitation-overlay">
              <span>🔍 แตะเพื่อดูการ์ดขยายเต็มจอ</span>
            </div>
          </div>
          <div class="invitation-card-foot">
            <div>
              <strong>การ์ดเชิญฉบับสมบูรณ์</strong>
              <p>สามารถแตะขยาย หรือบันทึกภาพเก็บไว้เป็นที่ระลึก</p>
            </div>
            <div class="invitation-btn-group">
              <button class="btn btn-sm btn-primary" id="btn-zoom-card">ขยายดูภาพ</button>
              <a href="${EVENT.invitationCardImg}" download="การ์ดเชิญอุปสมบท-${EVENT.candidateName}.jpg" class="btn btn-sm">บันทึกรูป</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Master Timeline Section -->
      <div class="section">
        <div class="section-head">
          <span class="eyebrow">Agenda</span>
          <h2>กำหนดการและลำดับพิธีการ</h2>
          <p style="color:var(--cocoa-2)">วันอาทิตย์ที่ 22 พฤศจิกายน 2569 ณ พัทธสีมา วัดลานคา</p>

          <!-- Filter Tabs -->
          <div class="sched-filter-tabs">
            <button class="filter-tab active" data-filter="all">ทั้งหมด (5)</button>
            <button class="filter-tab" data-filter="morning">ช่วงเช้า (2)</button>
            <button class="filter-tab" data-filter="afternoon">ช่วงบ่าย (3)</button>
          </div>
        </div>

        <div class="timeline" id="sched-timeline">
          ${sched.map((item, idx) => {
            const itemGCal = makeGCalUrl(
              `${item.title} - งานอุปสมบท ${EVENT.candidateName}`,
              item.startTimeISO,
              item.endTimeISO,
              `${item.desc}\nสถานที่: ${item.location}`,
              item.location
            );

            return `
              <div class="timeline-item ${item.phase}" data-phase="${item.phase}" data-start="${item.startTimeISO}" data-end="${item.endTimeISO}" id="item-${item.id}">
                <div class="tl-left">
                  <div class="tl-node">
                    <span class="tl-node-ico">${item.icon}</span>
                  </div>
                  <div class="tl-time-badge">${item.time} น.</div>
                </div>

                <div class="tl-card card hover">
                  <div class="tl-card-head">
                    <div class="tl-time-wrap">
                      <span class="tl-time-pill">${item.timeLabel}</span>
                      <span class="tl-phase-pill ${item.phase}">${item.phaseLabel}</span>
                      <span class="tl-badge-pill">${item.badge}</span>
                    </div>
                    <div class="tl-status-live" style="display:none;">
                      <span class="dot live"></span> ขณะนี้กำลังดำเนินพิธี
                    </div>
                  </div>

                  <h3 class="tl-title">${item.title}</h3>
                  <p class="tl-desc">${item.desc}</p>

                  <div class="tl-meta">
                    <div class="tl-loc">
                      <span>📍</span>
                      <strong>${item.location}</strong>
                    </div>
                  </div>

                  <div class="tl-card-actions">
                    <a href="${itemGCal}" target="_blank" rel="noopener" class="btn btn-sm tl-btn-cal" title="เตือนความจำใน Google Calendar">
                      📅 บันทึก Google Cal
                    </a>
                    <a href="#/map" class="btn btn-sm btn-ghost tl-btn-map" title="ดูจุดจัดงานในแผนที่ 3D">
                      🗺️ ดูแผนที่ 3D
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Guest Guide & Important Information -->
      <div class="section">
        <div class="section-head">
          <span class="eyebrow">Information</span>
          <h2>ข้อแนะนำและข้อมูลสำหรับผู้ร่วมงาน</h2>
        </div>

        <div class="grid grid-3">
          <div class="card info-card">
            <div class="info-ico">👕</div>
            <h3>การแต่งกาย (Dress Code)</h3>
            <p>แนะนำสวมใส่ชุดสุภาพ โทนสีขาว ครีม หรือสีสว่างสุภาพ เพื่อความสบายและเหมาะสมกับการร่วมพิธีในพัทธสีมา</p>
          </div>

          <div class="card info-card">
            <div class="info-ico">🚗</div>
            <h3>การเดินทาง & ที่จอดรถ</h3>
            <p>วัดลานคา อ.บางปลาม้า จ.สุพรรณบุรี มีลานจอดรถกว้างขวางรองรับรถยนต์ได้จำนวนมาก พร้อมเจ้าหน้าที่คอยแนะนำ</p>
            <a href="${EVENT.googleMapsUrl}" target="_blank" rel="noopener" style="color:var(--saffron-d);font-weight:600;font-size:14px;">เปิด Google Maps นำทาง →</a>
          </div>

          <div class="card info-card">
            <div class="info-ico">🎫</div>
            <h3>ตั๋ว QR ประจำตัว</h3>
            <p>ลงทะเบียนรับ QR Ticket ล่วงหน้า เพื่อความสะดวกรวดเร็วในการเช็กอินหน้างาน และรับของที่ระลึกของงานบุญ</p>
            <a href="#/checkin" style="color:var(--saffron-d);font-weight:600;font-size:14px;">Checkin รับ QR ทันที →</a>
          </div>
        </div>
      </div>

      <!-- Lightbox Modal for Card -->
      <div class="modal-lightbox" id="modal-card" aria-hidden="true">
        <div class="modal-lightbox-backdrop" id="modal-backdrop"></div>
        <div class="modal-lightbox-content">
          <button class="modal-close" id="modal-close" aria-label="ปิดการ์ด">✕</button>
          <img src="${EVENT.invitationCardImg}" alt="การ์ดเชิญอุปสมบท ธนกร วงศ์คำภู (มังกร)" class="modal-img" />
          <div class="modal-toolbar">
            <a href="${EVENT.invitationCardImg}" download="การ์ดเชิญอุปสมบท-ธนกร-วงศ์คำภู.jpg" class="btn btn-primary btn-sm">
              💾 บันทึกรูปลงเครื่อง
            </a>
            <button class="btn btn-sm" id="btn-share-card">
              🔗 แชร์การ์ดเชิญ
            </button>
          </div>
        </div>
      </div>
    </section>
    ${footer()}
  `;

  // Countdown logic
  const targetTime = new Date(EVENT.date).getTime();
  const nums = el.querySelectorAll('#sched-countdown .num');
  const liveStatus = el.querySelector('#sched-live-status');

  const updateCountdown = () => {
    const now = Date.now();
    let diff = targetTime - now;

    if (diff > 0) {
      const parts = [86400000, 3600000, 60000, 1000].map(unit => {
        const val = Math.floor(diff / unit);
        diff -= val * unit;
        return val;
      });
      nums.forEach((n, i) => (n.textContent = String(parts[i]).padStart(2, '0')));
      if (liveStatus) liveStatus.textContent = 'รอเริ่มพิธี';
    } else {
      nums.forEach(n => (n.textContent = '00'));
      // Check current ritual
      const current = sched.find(item => {
        const s = new Date(item.startTimeISO).getTime();
        const e = new Date(item.endTimeISO).getTime();
        return now >= s && now <= e;
      });
      if (current) {
        if (liveStatus) liveStatus.textContent = `กำลังดำเนิน: ${current.title}`;
        const activeItem = el.querySelector(`#item-${current.id}`);
        if (activeItem) {
          activeItem.classList.add('live-active');
          const liveBadge = activeItem.querySelector('.tl-status-live');
          if (liveBadge) liveBadge.style.display = 'inline-flex';
        }
      } else {
        if (liveStatus) liveStatus.textContent = 'วันงานมงคลอุปสมบท';
      }
    }
  };

  updateCountdown();
  const timer = setInterval(updateCountdown, 1000);

  // Filter Tabs
  const tabs = el.querySelectorAll('.filter-tab');
  const tlItems = el.querySelectorAll('.timeline-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      tlItems.forEach(item => {
        if (filter === 'all' || item.dataset.phase === filter) {
          item.style.display = 'grid';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // Modal Lightbox controls
  const modal = el.querySelector('#modal-card');
  const openModal = () => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  el.querySelector('#btn-view-card')?.addEventListener('click', openModal);
  el.querySelector('#btn-zoom-card')?.addEventListener('click', openModal);
  el.querySelector('#invitation-trigger')?.addEventListener('click', openModal);
  el.querySelector('#modal-close')?.addEventListener('click', closeModal);
  el.querySelector('#modal-backdrop')?.addEventListener('click', closeModal);

  // Keydown Escape to close modal
  const handleKey = (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  };
  window.addEventListener('keydown', handleKey);

  // Download whole calendar ICS
  el.querySelector('#btn-download-ics')?.addEventListener('click', () => {
    downloadIcs(`งานอุปสมบท-${EVENT.candidateNickname}-22พย2569.ics`, sched);
    toast('ดาวน์โหลดไฟล์ปฏิทิน (.ics) เรียบร้อยแล้ว', 'ok');
  });

  // Share card button
  el.querySelector('#btn-share-card')?.addEventListener('click', async () => {
    const shareData = {
      title: `งานอุปสมบท ${EVENT.candidateName} (มังกร)`,
      text: `ขอเรียนเชิญร่วมงานอุปสมบท ${EVENT.candidateName} (นาคมังกร) วันอาทิตย์ที่ 22 พฤศจิกายน 2569 ณ วัดลานคา จ.สุพรรณบุรี`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') copyLink();
      }
    } else {
      copyLink();
    }
  });

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      toast('คัดลอกลิงก์กำหนดการเรียบร้อยแล้ว', 'ok');
    }).catch(() => {
      toast('ลิงก์: ' + window.location.href);
    });
  }

  return () => {
    clearInterval(timer);
    window.removeEventListener('keydown', handleKey);
    document.body.style.overflow = '';
  };
}
