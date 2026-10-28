import { toast, footer, icon } from '../ui.js';

/* ------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------ */
// TODO: เปลี่ยนเป็นรูปพระจริงภายหลัง (Placeholder ชั่วคราว)
const MONK_PHOTO = './assets/monk-novice.jpg';

const W = 900;   // ขนาดภาพโพลารอยด์ที่บันทึก
const H = 1200;

const MALI = '"Mali", "Prompt", cursive';
const PROMPT = '"Prompt", system-ui, sans-serif';

const T = {
  title1: '22 พฤศจิกา',
  title2: 'ขอลาบวช',
  name: 'ธนกร วงศ์คำภู (มังกร)',
  date: 'วันอาทิตย์ที่ 22 พฤศจิกายน 2569',
  place: 'วัดลานคา ต.บางปลาม้า จ.สุพรรณบุรี',
  userCaption: 'สาธุ 🙏',
};

/* 50 คำคม (สุ่มอัตโนมัติเมื่อกด สาธุ) */
export const DHAMMA_QUOTES = [
  // หมวดที่ 1: ตื่นจากกิเลสและความหลง
  'สุขที่วิ่งไล่... คือทุกข์ที่ตามหลอกหลอน ยิ่งดิ้นรน ยิ่งจมลึก',
  'แบกโลกไว้ทั้งใบ... แต่ลืมไปว่ามือของตัวเองยังว่าง',
  'ของรักของหวง แท้จริงเป็นแค่ของยืม... วันหนึ่งก็ต้องคืนให้ความว่างเปล่า',
  'แต่งหน้าให้สวยแค่ไหน... ก็ซ่อนความเน่าเฟะในใจไม่ได้',
  'หลงทางยังหาทางกลับเจอ... แต่หลงเงาตัวเอง วิ่งหาเท่าไหร่ก็ไม่เจอทางออก',
  'เงินซื้อความสุขได้ชั่วคราว... แต่ซื้อความสงบถาวรไม่ได้แม้แต่เศษเสี้ยว',
  'วิ่งตามโลกจนเหนื่อยหอบ... สุดท้ายที่ซบได้สนิทที่สุดคือหลุมศพ',
  'อยากชนะคนอื่นเป็นร้อยครั้ง... แต่ไม่เคยชนะใจตัวเองสักครั้งเดียว',
  'ชีวิตสั้นนัก... แต่เรามักใช้เวลาทั้งชีวิตไปกับเรื่องไร้สาระ',
  'โลภ โกรธ หลง ล้อมกรอบเราไว้... โดยที่เรายินยอมพร้อมใจให้มันขัง',
  // หมวดที่ 2: ความจริงของชีวิตและความตาย
  'ลมหายใจเข้า... ยังไม่แน่ว่าจะได้หายใจออก อย่าประมาทกับความตายที่ยืนรออยู่ข้างหลัง',
  'วันพรุ่งนี้กับความตาย... ใครจะมาถึงก่อนกัน? ตอบได้ไหม?',
  'ทรัพย์สินนับล้าน... ตายไปก็เอาติดตัวไปได้แค่อากาศ',
  'ร่างกายนี่คือโรงละคร... เล่นจบก็ต้องแยกย้าย ไม่มีใครเป็นเจ้าของจริง',
  'เกิดมามือเปล่า... ตอนตายก็กำมือเปล่า ทำไมต้องดิ้นรนจะเอาให้ได้ทุกอย่าง',
  'ความแก่และความตาย ไม่เคยนัดหมายใครล่วงหน้า',
  'บ้านหลังใหญ่แค่ไหน... สุดท้ายก็นอนได้แค่ห้องสี่เหลี่ยมเล็กๆ ตอนตาย',
  'วันนี้เถียงกันแทบตาย... วันหน้าก็กลายเป็นขี้เถ้าเหมือนกัน',
  'เวลาไม่เคยรอใคร... มันกำลังเชือดเฉือนชีวิตเราไปทีละวินาที',
  'สิ่งเดียวที่แท้จริงในโลก... คือความไม่เที่ยง',
  // หมวดที่ 3: สติและการปล่อยวาง
  'ยิ่งอยากควบคุมทุกอย่าง... ยิ่งเป็นบ้ากับสิ่งที่ไม่เป็นดั่งใจ',
  'ปล่อยวางไม่ได้... เพราะใจมันโง่แบกขยะไว้เอง',
  'ความทุกข์ไม่ได้อยู่ที่เรื่องราว... แต่อยู่ที่ความคิดที่เราแต่งเติม',
  'ไม่วางมือจากอดีต... ก็ไม่มีมือไปคว้าอนาคตและปัจจุบัน',
  'ความสุขที่แท้จริง... ไม่ได้อยู่ที่การมีมาก แต่อยู่ที่ความต้องการน้อย',
  'ชนะศึกเป็นแสนครั้ง... ไม่ยิ่งใหญ่เท่าชนะใจตัวเองครั้งเดียว',
  'รู้ทันความคิด... คือชีวิตที่เป็นอิสระ',
  'หยุดวิ่งตามความสุข... แล้วหันมาดูความสุขที่อยู่ตรงหน้า',
  'นิ่งเสียบ้าง... เพื่อฟังเสียงหัวใจตัวเองให้ชัดเจน',
  'ความเงียบไม่ใช่ความพ่ายแพ้... แต่คือชัยชนะเหนืออารมณ์',
  // หมวดที่ 4: การมองคนและคำนินทา
  'คำนินทาก็เหมือนลมปาก... ผ่านมาแล้วก็ผ่านไป ถ้าไม่เก็บมาใส่ใจ มันก็ทำอะไรเราไม่ได้',
  'อย่าเอาชีวิตไปผูกกับปากคนอื่น... เพราะเขาไม่ได้มาจ่ายค่าลมหายใจให้เรา',
  'คนที่เกลียดเรา... เขากำลังทรมานตัวเองอยู่ ไม่ใช่เรา',
  'มองความผิดคนอื่นเท่าภูเขา... มองความผิดตัวเองเท่าเม็ดทราย',
  'การแก้แค้นที่ดีที่สุด... คือการมีความสุขให้คนที่เกลียดเราอิจฉา',
  'คนฉลาดใช้ศัตรูเป็นครู... คนโง่ใช้ศัตรูเป็นกิเลส',
  'ยามมีคนสรรเสริญ... จงระวังหางเสียง ยามมีคนนินทา... จงดูใจตัวเอง',
  'ไม่มีใครทำร้ายเราได้... นอกจากความคิดของตัวเราเอง',
  'โลกนี้ไม่มีใครใจร้ายกับเราเท่ากับตัวเราที่คิดมาก',
  'ปล่อยให้คนอื่นพูดไป... เพราะความจริงก็คือความจริง',
  // หมวดที่ 5: ปลุกไฟในใจ สู่ทางพ้นทุกข์
  'พึ่งพาคนอื่น... เหนื่อยชั่วคราว พึ่งพาตัวเอง (สติ) รอดถาวร',
  'แสงสว่างไหนก็ไม่เท่า... แสงสว่างแห่งปัญญาในใจตน',
  'ทางนิพพานไม่ต้องเดินไปไหนไกล... แค่หยุดความอยากในใจ ก็ถึงแล้ว',
  'ศาสนาไม่ได้อยู่ในวัด... แต่อยู่ที่สติในใจเราทุกลมหายใจ',
  'ทำความดีไม่ต้องรอให้รวย... เพราะความดีสร้างความรวยให้ใจได้ทันที',
  'บุญกุศลไม่ใช่การซื้อขาย... แต่คือการสละความเห็นแก่ตัว',
  'ชีวิตนี้สั้นนัก... จงใช้มันทำความดีและสร้างปัญญา ก่อนจะสายเกินแก้',
  'จิตที่ฝึกดีแล้ว... นำความสุขมาให้แท้จริง',
  'ตื่นเถิด... อย่ามัวหลับใหลในความสุขปลอมๆ ของโลกเลย',
  "พระพุทธเจ้าไม่ได้บอกให้เชื่อ... แต่บอกให้ 'รู้และเห็น' ด้วยตัวเอง",
];

/* ------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------ */
export async function render(el) {
  let userPhoto = null;      // object URL / data URL ของรูปผู้ใช้
  let resultUrl = null;      // data URL ของภาพโพลารอยด์ที่สร้างแล้ว
  let lastQuoteIdx = -1;
  let stream = null;
  let facing = 'user';

  el.innerHTML = `
  <section class="page container pol-page">
    <div class="pol-stage-card glass">
      <span class="eyebrow">📸 Digital Polaroid</span>
      <h1 class="pol-title">ภาพที่ระลึกกับพระ</h1>

      <!-- Step 1: ปุ่มเดียว -->
      <div class="pol-step" id="step-start">
        <div class="pol-cta-wrap">
          <button class="pol-cta" id="btn-start" type="button">
            <span class="pol-cta-avatar"><img src="${MONK_PHOTO}" alt="" /></span>
            <span class="pol-cta-text">
              <strong>ถ่ายภาพกับพระ</strong>
              <small>ถ่ายรูป หรือ เลือกจากคลังภาพ</small>
            </span>
            <span class="pol-cta-ico" aria-hidden="true">${icon('camera', 'fill')}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: มีรูปแล้ว → กด สาธุ -->
      <div class="pol-step" id="step-ready" hidden>
        <div class="pol-pair">
          <figure class="mini-pol mini-user"><img id="ready-user" alt="รูปของท่าน" /></figure>
          <span class="pol-pair-plus" aria-hidden="true">🪷</span>
          <figure class="mini-pol mini-monk"><img src="${MONK_PHOTO}" alt="รูปพระ" /></figure>
        </div>
        <button class="pol-sadhu" id="btn-sadhu" type="button">🙏 สาธุ</button>
        <button class="pol-retake" id="btn-retake" type="button">↺ ถ่ายใหม่ / เปลี่ยนรูป</button>
      </div>
    </div>

    <!-- Step 3: ภาพผลลัพธ์ (ภาพเดียวกับที่บันทึก) -->
    <div class="pol-result" id="pol-result" hidden>
      <img id="result-img" class="pol-result-img" alt="ภาพโพลารอยด์ที่ระลึกงานบวช" />
      <div class="pol-result-actions">
        <button class="btn btn-primary btn-lg" id="btn-save" type="button">${icon('download', 'fill')} บันทึกภาพ</button>
        <button class="btn btn-lg" id="btn-share" type="button">${icon('share')} แชร์</button>
      </div>
    </div>

    <input type="file" id="file-input" accept="image/*" hidden />

    <!-- Camera sheet -->
    <div class="camera-modal" id="cam-modal" hidden>
      <div class="cam-overlay" data-close></div>
      <div class="cam-dialog card glass">
        <div class="cam-header">
          <h3>📷 ถ่ายภาพกับพระ</h3>
          <button class="cam-x" type="button" data-close aria-label="ปิด">✕</button>
        </div>
        <div class="cam-viewport" id="cam-viewport">
          <video id="cam-video" autoplay playsinline muted></video>
          <div class="cam-empty" id="cam-empty" hidden>ไม่สามารถเปิดกล้องได้<br />กรุณาเลือกรูปจากคลังภาพ</div>
          <div class="cam-guide"><span class="guide-frame"></span></div>
          <div class="cam-monk-badge"><img src="${MONK_PHOTO}" alt="" /></div>
          <div class="cam-flash" id="cam-flash"></div>
        </div>
        <div class="cam-footer">
          <button class="cam-side" id="btn-gallery" type="button">${icon('image')}<span>คลังภาพ</span></button>
          <button class="shutter-btn" id="btn-shutter" type="button" aria-label="ถ่ายรูป"></button>
          <button class="cam-side" id="btn-flip" type="button">${icon('refresh')}<span>สลับกล้อง</span></button>
        </div>
      </div>
    </div>
  </section>
  ${footer()}`;

  const $ = (s) => el.querySelector(s);
  const camModal = $('#cam-modal');
  const video = $('#cam-video');
  const fileInput = $('#file-input');

  /* ---------- camera ---------- */
  async function openCamera() {
    camModal.hidden = false;
    document.body.style.overflow = 'hidden';
    await startStream();
  }

  async function startStream() {
    stopStream();
    $('#cam-empty').hidden = true;
    $('#btn-shutter').disabled = false;
    $('#cam-viewport').classList.toggle('mirror', facing === 'user');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
    } catch (err) {
      console.warn('camera:', err);
      $('#cam-empty').hidden = false;
      $('#btn-shutter').disabled = true;
    }
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function closeCamera() {
    stopStream();
    camModal.hidden = true;
    document.body.style.overflow = '';
  }

  function capture() {
    if (!video.videoWidth) return;
    const flash = $('#cam-flash');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');

    const size = Math.min(video.videoWidth, video.videoHeight);
    const c = document.createElement('canvas');
    c.width = c.height = 900;
    const g = c.getContext('2d');
    if (facing === 'user') { g.translate(900, 0); g.scale(-1, 1); }
    g.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 900, 900);
    setUserPhoto(c.toDataURL('image/jpeg', 0.92));
    setTimeout(closeCamera, 250);
  }

  function setUserPhoto(url) {
    if (userPhoto && userPhoto.startsWith('blob:')) URL.revokeObjectURL(userPhoto);
    userPhoto = url;
    $('#ready-user').src = url;
    $('#step-start').hidden = true;
    $('#step-ready').hidden = false;
    $('#pol-result').hidden = true;
    resultUrl = null;
    toast('ได้รูปแล้ว กด "สาธุ" เพื่อรับภาพที่ระลึก 🙏', 'ok');
  }

  /* ---------- สาธุ → สร้างภาพ ---------- */
  async function onSadhu(e) {
    if (!userPhoto) return openCamera();
    const btn = e.currentTarget;
    burst(btn);
    btn.disabled = true;
    try {
      let i;
      do { i = Math.floor(Math.random() * DHAMMA_QUOTES.length); } while (i === lastQuoteIdx && DHAMMA_QUOTES.length > 1);
      lastQuoteIdx = i;
      resultUrl = await composePolaroid(userPhoto, DHAMMA_QUOTES[i]);
      const img = $('#result-img');
      img.src = resultUrl;
      const box = $('#pol-result');
      box.hidden = false;
      box.classList.remove('reveal'); void box.offsetWidth; box.classList.add('reveal');
      setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (err) {
      console.error(err);
      toast('สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง', 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- save / share ---------- */
  function save() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `ขอลาบวช-มังกร-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('บันทึกภาพเรียบร้อย 🪷', 'ok');
  }

  async function share() {
    if (!resultUrl) return;
    try {
      const blob = await (await fetch(resultUrl)).blob();
      const file = new File([blob], 'ขอลาบวช-มังกร.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ขอลาบวช · ธนกร วงศ์คำภู (มังกร)', text: `${T.date} ${T.place}` });
      } else {
        save();
      }
    } catch (err) {
      if (err.name !== 'AbortError') save();
    }
  }

  /* ---------- events ---------- */
  $('#btn-start').addEventListener('click', openCamera);
  $('#btn-retake').addEventListener('click', openCamera);
  $('#btn-sadhu').addEventListener('click', onSadhu);
  $('#btn-save').addEventListener('click', save);
  $('#btn-share').addEventListener('click', share);
  $('#btn-shutter').addEventListener('click', capture);
  $('#btn-flip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startStream(); });
  $('#btn-gallery').addEventListener('click', () => fileInput.click());
  camModal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeCamera));
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    setUserPhoto(URL.createObjectURL(f));
    closeCamera();
  });
  const onKey = (e) => { if (e.key === 'Escape' && !camModal.hidden) closeCamera(); };
  window.addEventListener('keydown', onKey);

  return () => {
    closeCamera();
    window.removeEventListener('keydown', onKey);
    if (userPhoto && userPhoto.startsWith('blob:')) URL.revokeObjectURL(userPhoto);
  };
}

/* ------------------------------------------------------------------
 * Effects
 * ------------------------------------------------------------------ */
function burst(btn) {
  const r = btn.getBoundingClientRect();
  const emojis = ['🪷', '💛', '✨', '🙏', '🤍', '☀️'];
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    p.className = 'blessing-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = `${r.left + r.width / 2 + (Math.random() * 80 - 40)}px`;
    p.style.top = `${r.top + (Math.random() * 20 - 10)}px`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty('--dy', `-${120 + Math.random() * 140}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 70}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

/* ------------------------------------------------------------------
 * Canvas composer — 900 × 1200
 * ------------------------------------------------------------------ */
async function composePolaroid(userSrc, quote) {
  if (document.fonts) {
    await Promise.all([
      document.fonts.load(`700 64px ${MALI}`),
      document.fonts.load(`500 24px ${MALI}`),
      document.fonts.load(`400 20px ${PROMPT}`),
      document.fonts.load(`600 26px ${PROMPT}`),
    ]).catch(() => {});
  }
  const [userImg, monkImg] = await Promise.all([loadImage(userSrc), loadImage(MONK_PHOTO)]);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // paper background + watercolor blobs
  ctx.fillStyle = '#FAF3E7';
  ctx.fillRect(0, 0, W, H);
  softBlob(ctx, 110, 110, 360, 'rgba(248,210,198,0.75)');
  softBlob(ctx, 80, 1120, 340, 'rgba(248,206,196,0.7)');
  softBlob(ctx, 880, 1180, 300, 'rgba(250,222,170,0.55)');
  softBlob(ctx, 860, 40, 240, 'rgba(250,228,190,0.5)');

  drawDoodles(ctx);
  drawHeader(ctx);

  // Monk polaroid (top-right)
  drawPolaroid(ctx, monkImg, {
    cx: 665, cy: 320, w: 370, rot: 5, tape: ['#F8D5BD', 'rgba(235,130,70,0.30)'],
    caption: quote, sizes: [22, 20, 18, 16], maxLines: 3, corner: '🪷',
  });

  // User polaroid (bottom-left)
  drawPolaroid(ctx, userImg, {
    cx: 285, cy: 800, w: 410, rot: -5, tape: ['#BEDCEE', 'rgba(70,140,210,0.30)'],
    caption: T.userCaption, sizes: [32, 28, 24], maxLines: 2, corner: '♡',
  });

  drawFooter(ctx);
  return c.toDataURL('image/jpeg', 0.93);
}

function drawHeader(ctx) {
  const x = 52;
  const maxW = 400;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // "22 พฤศจิกา"
  const s = fitSize(ctx, T.title1, maxW, 70, 700, MALI);
  ctx.font = `700 ${s}px ${MALI}`;
  ctx.fillStyle = '#4A3428';
  const y1 = 140;
  ctx.fillText(T.title1, x, y1);

  // "ขอลาบวช" (gradient)
  const y2 = y1 + Math.round(s * 1.12);
  const w2 = ctx.measureText(T.title2).width;
  const g = ctx.createLinearGradient(x, 0, x + w2, 0);
  g.addColorStop(0, '#E8913A');
  g.addColorStop(1, '#D9645A');
  ctx.fillStyle = g;
  ctx.fillText(T.title2, x, y2);

  // music notes
  ctx.fillStyle = '#7A5F50';
  ctx.font = `30px ${PROMPT}`;
  ctx.fillText('♪', x + w2 + 18, y2 - 6);
  ctx.fillText('♫', x + w2 + 50, y2 - 34);

  // ธนกร วงศ์คำภู (มังกร)
  const yn = y2 + 52;
  const ns = fitSize(ctx, T.name, maxW, 28, 600, PROMPT);
  ctx.font = `600 ${ns}px ${PROMPT}`;
  ctx.fillStyle = '#7A5F50';
  ctx.fillText(T.name, x + 2, yn);

  // hand-drawn underline
  ctx.strokeStyle = '#C88E75';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 4, yn + 18);
  ctx.quadraticCurveTo(x + 120, yn + 10, x + 250, yn + 20);
  ctx.stroke();

  ctx.restore();
}

function drawPolaroid(ctx, img, o) {
  const pad = Math.round(o.w * 0.055);
  const photo = o.w - pad * 2;
  const chin = Math.round(o.w * 0.30);
  const h = pad + photo + chin;

  ctx.save();
  ctx.translate(o.cx, o.cy);
  ctx.rotate((o.rot * Math.PI) / 180);

  // card + shadow
  ctx.shadowColor = 'rgba(74,52,40,0.22)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#FFFDF9';
  roundRect(ctx, -o.w / 2, -h / 2, o.w, h, 10);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // photo
  const px = -o.w / 2 + pad;
  const py = -h / 2 + pad;
  ctx.save();
  roundRect(ctx, px, py, photo, photo, 4);
  ctx.clip();
  drawCover(ctx, img, px, py, photo, photo);
  ctx.restore();

  // caption (auto-fit)
  const maxW = photo - 10;
  let size = o.sizes[o.sizes.length - 1];
  let lines = null;
  for (const s of o.sizes) {
    ctx.font = `500 ${s}px ${MALI}`;
    const l = wrapLines(ctx, o.caption, maxW);
    if (l.length <= o.maxLines) { size = s; lines = l; break; }
  }
  if (!lines) {
    ctx.font = `500 ${size}px ${MALI}`;
    lines = wrapLines(ctx, o.caption, maxW).slice(0, o.maxLines);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S{0,2}$/, '') + '…';
  }
  const lh = Math.round(size * 1.38);
  const top = py + photo + (chin - lines.length * lh) / 2 + size * 0.95;
  ctx.fillStyle = '#4A3428';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, 0, top + i * lh));

  // corner icon
  if (o.corner) {
    ctx.font = `20px ${PROMPT}`;
    ctx.fillStyle = '#C88E75';
    ctx.textAlign = 'right';
    ctx.fillText(o.corner, o.w / 2 - 14, h / 2 - 12);
  }

  // washi tape
  const tw = o.w * 0.38, th = 40;
  ctx.save();
  ctx.translate(0, -h / 2 + 2);
  ctx.rotate((-o.rot * 0.4 * Math.PI) / 180);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = o.tape[0];
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.fillStyle = o.tape[1];
  const st = 10;
  for (let x = -tw / 2; x < tw / 2; x += st * 2) ctx.fillRect(x, -th / 2, Math.min(st, tw / 2 - x), th);
  for (let y = -th / 2; y < th / 2; y += st * 2) ctx.fillRect(-tw / 2, y, tw, Math.min(st, th / 2 - y));
  ctx.restore();

  ctx.restore();
}

function drawFooter(ctx) {
  ctx.save();
  const x = 56, y = 1136;
  // pin / checkin icon
  ctx.fillStyle = '#8A6A58';
  ctx.beginPath();
  ctx.arc(x, y - 6, 12, Math.PI, 0);
  ctx.lineTo(x, y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FAF3E7';
  ctx.beginPath(); ctx.arc(x, y - 6, 4.5, 0, Math.PI * 2); ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4A3428';
  ctx.font = `600 21px ${PROMPT}`;
  ctx.fillText(T.date, x + 24, y - 4);
  ctx.fillStyle = '#7A5F50';
  ctx.font = `400 17px ${PROMPT}`;
  ctx.fillText(T.place, x + 24, y + 22);
  ctx.restore();
}

function drawDoodles(ctx) {
  ctx.save();
  // sun
  drawSun(ctx, 590, 625, 20);
  // hearts
  ctx.strokeStyle = '#7A5F50';
  ctx.lineWidth = 2.2;
  drawHeart(ctx, 760, 690, 13);
  drawHeart(ctx, 565, 1000, 14);
  drawHeart(ctx, 40, 520, 11);
  // flowers & leaves
  drawFlower(ctx, 845, 630, 15, '#FFFFFF', '#F8C86A');
  drawFlower(ctx, 50, 1010, 14, '#F8C86A', '#E8913A');
  drawLeaf(ctx, 640, 760, 30, 0.4);
  drawLeaf(ctx, 560, 1090, 28, -0.3);
  drawLeaf(ctx, 30, 700, 26, -0.6);
  // temple line art (bottom-right)
  drawTemple(ctx, 630, 830);
  ctx.restore();
}

/* ------------------------------------------------------------------
 * Drawing helpers
 * ------------------------------------------------------------------ */
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 400;
      const g = c.getContext('2d');
      g.fillStyle = '#EFE6D8'; g.fillRect(0, 0, 400, 400);
      resolve(c);
    };
    img.src = src;
  });
}

function drawCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function softBlob(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(250,243,231,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitSize(ctx, text, maxW, start, weight, family) {
  let s = start;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Thai-aware word wrap */
function wrapLines(ctx, text, maxW) {
  const segs = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map((s) => s.segment)
    : [...text];
  const lines = [];
  let cur = '';
  for (const seg of segs) {
    const test = cur + seg;
    if (ctx.measureText(test).width > maxW && cur.trim() !== '') {
      lines.push(cur.trim());
      cur = seg.trimStart();
    } else {
      cur = test;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function drawSun(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#F8C86A';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#F4B042';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6));
    ctx.lineTo(Math.cos(a) * (r + 14), Math.sin(a) * (r + 14));
    ctx.stroke();
  }
  ctx.fillStyle = '#5A3E2B';
  ctx.beginPath(); ctx.arc(-6, -3, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -3, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5A3E2B'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, 3, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function drawHeart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - s, cy - s, cx - s * 1.5, cy + s * 0.5, cx, cy + s * 1.4);
  ctx.bezierCurveTo(cx + s * 1.5, cy + s * 0.5, cx + s, cy - s, cx, cy);
  ctx.stroke();
}

function drawFlower(ctx, cx, cy, r, petal, center) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#9FB58E'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, r); ctx.quadraticCurveTo(-4, r + 22, 2, r + 40); ctx.stroke();
  ctx.fillStyle = '#9FB58E';
  ctx.beginPath(); ctx.ellipse(10, r + 22, 11, 5, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = petal;
  ctx.strokeStyle = 'rgba(200,142,117,0.5)'; ctx.lineWidth = 1;
  for (let p = 0; p < 5; p++) {
    const a = (p * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, r * 0.62, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = center;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx, cx, cy, len, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = '#9FB58E';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len - 4, 0); ctx.stroke();
  ctx.restore();
}

function drawTemple(ctx, ox, oy) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.strokeStyle = '#C88E75';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(140, 40); ctx.lineTo(140, 8);
  ctx.moveTo(135, 26); ctx.lineTo(145, 26);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(140, 40); ctx.lineTo(124, 100); ctx.lineTo(156, 100); ctx.closePath(); ctx.stroke();
  ctx.strokeRect(116, 100, 48, 18);
  ctx.strokeRect(110, 118, 60, 20);
  ctx.beginPath();
  ctx.moveTo(110, 138); ctx.quadraticCurveTo(100, 165, 95, 190);
  ctx.lineTo(185, 190); ctx.quadraticCurveTo(180, 165, 170, 138);
  ctx.closePath(); ctx.stroke();
  ctx.strokeRect(84, 190, 112, 18);
  ctx.strokeRect(74, 208, 132, 20);
  ctx.strokeRect(62, 228, 156, 22);
  // small trees
  [[30, 220], [250, 222]].forEach(([tx, ty]) => {
    ctx.beginPath(); ctx.arc(tx, ty - 14, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx, ty - 1); ctx.lineTo(tx, ty + 28); ctx.stroke();
  });
  ctx.beginPath(); ctx.moveTo(0, 250); ctx.lineTo(270, 250); ctx.stroke();
  ctx.restore();
}
