/**
 * MERIT FEST — Data Service
 * ---------------------------------------------------------------
 * Phase 1: browser-only implementation backed by localStorage so the
 * prototype works without a server. Every function is async and mirrors
 * a future REST endpoint, so swapping to a real backend (PostgreSQL /
 * Supabase / Node API) only means re-implementing this file.
 *
 *   registerGuest()   -> POST /api/registrations
 *   findByPhone()     -> GET  /api/registrations?phone=
 *   getByToken()      -> GET  /api/tickets/:token
 *   checkIn()         -> POST /api/checkins         (atomic on server)
 *   getStats()        -> GET  /api/stats            (realtime channel)
 *   getQuotes()       -> GET  /api/polaroid/quotes
 *   getMonkPhoto()    -> GET  /api/polaroid/monk
 *
 * Security notes (enforced for real on the backend later):
 *   - QR contains an unguessable random token only — never the phone number.
 *   - One registration per phone; one check-in per registration.
 *   - All staff actions are written to an audit log.
 */

export const EVENT = {
  name: 'MERIT FEST',
  titleTh: 'งานบวช & ดนตรี',
  tagline: 'ขอกราบลาอุปสมบท · ธนกร วงศ์คำภู (มังกร)',
  candidateName: 'ธนกร วงศ์คำภู',
  candidateNickname: 'มังกร',
  fullNameTh: 'นายธนกร วงศ์คำภู (นาคมังกร)',
  date: '2026-11-22T09:00:00+07:00',
  dateEnd: '2026-11-22T17:00:00+07:00',
  /** Lucky Star เปิดให้เล่นทั้งวันตามปฏิทินเขตเวลาไทย (YYYY-MM-DD, Asia/Bangkok) */
  luckyStarDate: '2026-11-22',
  luckyStarDateLabel: '22 พฤศจิกายน 2026',
  dateTh: 'วันอาทิตย์ที่ 22 พฤศจิกายน 2569',
  venue: 'พัทธสีมา วัดลานคา ต.บางปลาม้า อ.บางปลาม้า จ.สุพรรณบุรี',
  templeName: 'วัดลานคา',
  subdistrict: 'ตำบลบางปลาม้า',
  district: 'อำเภอบางปลาม้า',
  province: 'จังหวัดสุพรรณบุรี',
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%A5%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%B2+%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%9B%E0%B8%A5%E0%B8%B2%E0%B8%A1%E0%B9%89%E0%B8%B2+%E0%B8%AA%E0%B8%B8%E0%B8%9E%E0%B8%A3%E0%B8%A3%E0%B8%83%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5',
  target: 300,
  invitationCardImg: './assets/invitation-card.jpg',
  hosts: [
    { name: 'นางฉลวย คล้ายสุบรรณ', relation: 'ยาย' },
    { name: 'คุณกองเงิน - คุณนงค์รัก วงค์คำภู', relation: 'บิดา - มารดา' }
  ],
  hostInvitationText: 'มีความยินดีขอเรียนเชิญท่านเพื่อเป็นเกียรติในงานอุปสมบท',
  forgivenessText: 'กรรมใดที่ผู้อุปสมบทได้ล่วงเกินแก่ท่านทั้งกายกรรม วจีกรรม มโนกรรม ขอท่านจงได้โปรดอโหสิกรรมให้แก่ผู้อุปสมบทด้วยเทอญ',
  apologyText: '(ขออภัยหากมิได้มาเรียนเชิญด้วยตนเอง)',
  scheduleList: [
    {
      id: 'shave',
      time: '09:00',
      timeLabel: 'เวลา 09.00 น.',
      title: 'พิธีปลงผมนาค',
      phase: 'morning',
      phaseLabel: 'ช่วงเช้า',
      desc: 'ญาติมิตรและแขกผู้มีเกียรติร่วมขลิบผมนาค พิธีปลงผม และอาบน้ำนาค ชำระกายใจเตรียมสู่ร่มกาสาวพัสตร์',
      location: 'ศาลาการเปรียญ / ลานพิธี วัดลานคา',
      mapZone: 'lawn',
      icon: '✂️',
      badge: 'พิธีมงคลเช้า',
      startTimeISO: '2026-11-22T09:00:00+07:00',
      endTimeISO: '2026-11-22T11:00:00+07:00'
    },
    {
      id: 'lunch',
      time: '11:30',
      timeLabel: 'เวลา 11.30 น.',
      title: 'รับประทานอาหารกลางวัน (บุฟเฟต์)',
      phase: 'morning',
      phaseLabel: 'มื้อกลางวัน',
      desc: 'ขอเชิญแขกผู้มีเกียรติร่วมรับประทานอาหารกลางวันแบบบุฟเฟต์ ซุ้มอาหารคาวหวานและเครื่องดื่มต้อนรับ',
      location: 'ซุ้มอาหาร & เครื่องดื่ม วัดลานคา',
      mapZone: 'food',
      icon: '🍲',
      badge: 'เลี้ยงต้อนรับ',
      startTimeISO: '2026-11-22T11:30:00+07:00',
      endTimeISO: '2026-11-22T12:30:00+07:00'
    },
    {
      id: 'sermon',
      time: '12:30',
      timeLabel: 'เวลา 12.30 น.',
      title: 'เทศน์สอนนาค',
      phase: 'afternoon',
      phaseLabel: 'ช่วงบ่าย',
      desc: 'พระสงฆ์ผู้ใหญ่แสดงพระธรรมเทศนาอบรมสั่งสอนนาค รำลึกพระคุณบิดามารดาและข้อวัตรปฏิบัติของผู้บวช',
      location: 'ศาลาการเปรียญ วัดลานคา',
      mapZone: 'stage',
      icon: '🙏',
      badge: 'รับฟังธรรม',
      startTimeISO: '2026-11-22T12:30:00+07:00',
      endTimeISO: '2026-11-22T13:00:00+07:00'
    },
    {
      id: 'parade',
      time: '13:00',
      timeLabel: 'เวลา 13.00 น.',
      title: 'แห่นาคอุปสมบท',
      phase: 'afternoon',
      phaseLabel: 'ช่วงบ่าย',
      desc: 'ขบวนแห่นาครอบพัทธสีมา 3 รอบ บรรเลงดนตรีเฉลิมฉลองด้วยความเบิกบาน พิธีโปรยทาน และวันทาสีมา',
      location: 'ลานรอบพัทธสีมา (พระอุโบสถ) วัดลานคา',
      mapZone: 'temple',
      icon: '🥁',
      badge: 'ขบวนแห่เฉลิมฉลอง',
      startTimeISO: '2026-11-22T13:00:00+07:00',
      endTimeISO: '2026-11-22T14:45:00+07:00'
    },
    {
      id: 'ordain',
      time: '15:00',
      timeLabel: 'เวลา 15.00 น.',
      title: 'พิธีอุปสมบท',
      phase: 'afternoon',
      phaseLabel: 'พิธีสำคัญ',
      desc: 'นาคเข้าสู่พระอุโบสถ พระอุปัชฌาย์และพระสงฆ์อันดับประกอบพิธีญัตติจตุตถกรรมวาจา สำเร็จเป็นพระภิกษุสงฆ์โดยสมบูรณ์',
      location: 'ภายในพระอุโบสถ วัดลานคา',
      mapZone: 'temple',
      icon: '🪷',
      badge: 'พิธีบรรพชาอุปสมบท',
      startTimeISO: '2026-11-22T15:00:00+07:00',
      endTimeISO: '2026-11-22T17:00:00+07:00'
    }
  ]
};

const KEY = {
  regs: 'mf.registrations.v1',
  audit: 'mf.audit.v1',
  myTicket: 'mf.myTicket.v1',
  quotes: 'mf.quotes.v1',
  monk: 'mf.monkPhoto.v1',
  seq: 'mf.seq.v1',
  visitors: 'mf.visitors.v1',
  lsPrizes: 'mf.lucky.prizes.v1',
  lsPlays: 'mf.lucky.plays.v1',
  lsConfig: 'mf.lucky.config.v1',
  lsSeq: 'mf.lucky.seq.v1',
  polaroidConfig: 'mf.polaroid.config.v1',
};

const DEFAULT_QUOTES = [
  'ขอให้ทุกก้าวของชีวิต เต็มไปด้วยความสุขและบุญกุศลนะครับ',
  'มาร่วมบุญกันนะ ขอบคุณที่อยู่ด้วยกันในวันนี้',
  'บุญใดที่ทำร่วมกัน ขอให้ความสุขนั้นงอกงามตลอดไป',
  'ใจที่สงบ คือของขวัญที่ดีที่สุด',
  'วันนี้ได้บุญ ได้ดนตรี ได้เพื่อน ครบเลย',
  'ขอบคุณที่มาเป็นส่วนหนึ่งของวันสำคัญ',
  'ทำดี คิดดี พูดดี ชีวิตก็ดีตาม',
  'ความสุขที่แท้ เริ่มจากการให้',
];

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('merit-fest') : null;
const listeners = new Set();

/* ---------------- helpers ---------------- */
const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const delay = (ms = 250) => new Promise(r => setTimeout(r, ms)); // simulate network latency

export function normalizePhone(p = '') {
  let d = String(p).replace(/\D/g, '');
  if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2);
  return d;
}
export function isValidThaiPhone(p) {
  return /^0[689]\d{8}$/.test(normalizePhone(p)) || /^0[2-7]\d{7}$/.test(normalizePhone(p));
}
export function maskPhone(p) {
  const d = normalizePhone(p);
  return d.length >= 10 ? `${d.slice(0, 3)}-xxx-${d.slice(-4)}` : d;
}

/** 128-bit unguessable token, base64url. */
function secureToken() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function nextRegId() {
  const regs = read(KEY.regs, []);
  let maxNum = read(KEY.seq, 0) || 0;
  for (const r of regs) {
    if (r.id && r.id.startsWith('MF-')) {
      const num = parseInt(r.id.slice(3), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  const n = maxNum + 1;
  write(KEY.seq, n);
  return 'MF-' + String(n).padStart(4, '0');
}

function audit(action, data = {}) {
  const log = read(KEY.audit, []);
  log.unshift({ at: new Date().toISOString(), action, ...data });
  write(KEY.audit, log.slice(0, 500));
}

export function recordVisit() {
  try {
    const sessionKey = 'mf_session_counted';
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      const cur = Number(read(KEY.visitors, 0)) || 0;
      const next = cur + 1;
      write(KEY.visitors, next);
      emit();
      return next;
    }
  } catch { }
  return getVisitorCount();
}

export function getVisitorCount() {
  const v = Number(read(KEY.visitors, 0)) || 0;
  if (v > 0) return v;
  const regs = read(KEY.regs, []).filter(r => r.status !== 'cancelled');
  return Math.max(1, regs.length);
}

function emit() {
  const stats = computeStats();
  listeners.forEach(fn => fn(stats));
  channel?.postMessage({ type: 'stats' });
}
channel && (channel.onmessage = () => { const s = computeStats(); listeners.forEach(fn => fn(s)); });
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === KEY.regs || e.key === KEY.visitors || e.key === KEY.lsPlays || e.key === KEY.lsPrizes || e.key === KEY.lsConfig || e.key === KEY.polaroidConfig) {
      const s = computeStats();
      listeners.forEach(fn => fn(s));
    }
  });
}

/* ---------------- Cloud Database (Firebase Firestore) ---------------- */
let firestoreModule = null;
let firestoreLoadPromise = null;
async function getFirestoreModule() {
  if (firestoreModule) return firestoreModule;
  if (typeof window === 'undefined') return null;
  if (firestoreLoadPromise) return firestoreLoadPromise;
  firestoreLoadPromise = (async () => {
    try {
      const fs = await import('firebase/firestore');
      const fb = await import('./firebase.js');
      if (fb.db) {
        firestoreModule = { ...fs, db: fb.db };
        return firestoreModule;
      }
    } catch (e) {
      console.warn('Firestore load failed:', e);
    }
    return null;
  })();
  return firestoreLoadPromise;
}

let cloudSyncStatus = {
  active: false,
  state: 'connecting', // 'connecting' | 'connected' | 'error'
  error: null,
  lastSyncAt: null,
};

export function getCloudSyncStatus() {
  return { ...cloudSyncStatus };
}

async function syncRegistrationToCloud(reg) {
  try {
    const fs = await getFirestoreModule();
    if (!fs?.db || !reg?.id) return;
    await fs.setDoc(fs.doc(fs.db, 'registrations', reg.id), reg, { merge: true });
  } catch (e) {
    console.warn('Sync reg to cloud failed:', e);
  }
}

async function updateRegistrationInCloud(id, patch) {
  try {
    const fs = await getFirestoreModule();
    if (!fs?.db || !id) return;
    await fs.setDoc(fs.doc(fs.db, 'registrations', id), patch, { merge: true });
  } catch (e) {
    console.warn('Update reg in cloud failed:', e);
  }
}

async function deleteRegistrationFromCloud(id) {
  try {
    const fs = await getFirestoreModule();
    if (!fs?.db || !id) return;
    await fs.deleteDoc(fs.doc(fs.db, 'registrations', id));
  } catch (e) {
    console.warn('Delete reg from cloud failed:', e);
  }
}

async function clearCloudCollection(collectionName) {
  try {
    const fs = await getFirestoreModule();
    if (!fs?.db || !collectionName) return;
    const snap = await fs.getDocs(fs.collection(fs.db, collectionName));
    const deletes = [];
    snap.forEach(d => {
      deletes.push(fs.deleteDoc(d.ref));
    });
    await Promise.all(deletes);
  } catch (e) {
    console.warn(`Failed to clear cloud collection ${collectionName}:`, e);
  }
}

let registrationsSyncInitialized = false;
async function initRegistrationsCloudSync() {
  if (typeof window === 'undefined' || registrationsSyncInitialized) return;
  try {
    const fs = await getFirestoreModule();
    if (!fs || !fs.db) {
      cloudSyncStatus.state = 'error';
      cloudSyncStatus.error = 'Firebase Firestore db is not initialized';
      emit();
      return;
    }
    registrationsSyncInitialized = true;
    cloudSyncStatus.state = 'connecting';

    fs.onSnapshot(fs.collection(fs.db, 'registrations'), (snapshot) => {
      cloudSyncStatus.active = true;
      cloudSyncStatus.state = 'connected';
      cloudSyncStatus.error = null;
      cloudSyncStatus.lastSyncAt = new Date().toISOString();

      const cloudRegs = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d && d.id) cloudRegs.push(d);
      });

      // Check if this device has offline-created items awaiting initial sync
      const localRegs = read(KEY.regs, []);
      const pendingUploads = localRegs.filter(r => r && r.syncPending && !cloudRegs.some(c => c.id === r.id));
      pendingUploads.forEach(r => {
        const clean = { ...r };
        delete clean.syncPending;
        syncRegistrationToCloud(clean);
      });

      // Cloud is the single source of truth: active list is cloud registrations + pending offline creations
      const allRegs = [...cloudRegs, ...pendingUploads];
      allRegs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      write(KEY.regs, allRegs);
      emit();
    }, (err) => {
      cloudSyncStatus.active = false;
      cloudSyncStatus.state = 'error';
      cloudSyncStatus.error = err?.code === 'permission-denied'
        ? 'สิทธิ์การเข้าถึงถูกบล็อก (Permission Denied): กรุณาเปิด Rules ใน Firebase Console ให้เป็น allow read, write: if true;'
        : (err?.message || 'ไม่สามารถเชื่อมต่อ Firestore ได้ (อาจยังไม่ได้กด Create Database ใน Firebase Console)');
      console.warn('Firestore registrations snapshot warning:', err);
      emit();
    });
  } catch (e) {
    cloudSyncStatus.active = false;
    cloudSyncStatus.state = 'error';
    cloudSyncStatus.error = e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Firestore';
    console.warn('initRegistrationsCloudSync exception:', e);
    emit();
  }
}
if (typeof window !== 'undefined') {
  initRegistrationsCloudSync();
}

function computeStats() {
  const regs = read(KEY.regs, []).filter(r => r.status !== 'cancelled');
  const sumPax = list => list.reduce((acc, r) => acc + (Number(r.pax) || 1), 0);
  const checkedList = regs.filter(r => r.checkedInAt);
  const onlineList = regs.filter(r => (r.source || 'online') === 'online');
  const onsiteList = regs.filter(r => r.source === 'onsite');
  const pendingList = regs.filter(r => !r.checkedInAt);

  return {
    registered: sumPax(regs),
    registeredRecords: regs.length,
    checkedIn: sumPax(checkedList),
    checkedInRecords: checkedList.length,
    pending: sumPax(pendingList),
    online: sumPax(onlineList),
    onsite: sumPax(onsiteList),
    visitors: getVisitorCount(),
    target: EVENT.target,
    cloudSync: getCloudSyncStatus(),
  };
}

/* ---------------- QR payload ---------------- */
export const QR_PREFIX = 'MF1:';
export const qrPayload = token => QR_PREFIX + token;
export const parseQr = text => (text || '').startsWith(QR_PREFIX) ? text.slice(QR_PREFIX.length).trim() : null;

/* ---------------- Registration ---------------- */
export class ApiError extends Error {
  constructor(code, message, data) { super(message); this.code = code; this.data = data; }
}

export async function registerGuest({
  fullName, phone, consent, gender = 'male', source = 'online', staff = null,
  autoCheckIn = false, pax = 1, note = ''
}) {
  await delay(250);
  const name = String(fullName || '').trim().replace(/\s+/g, ' ');
  const tel = normalizePhone(phone);
  const isOnsite = source === 'onsite';
  const partySize = Math.max(1, Math.min(50, Number(pax) || 1));

  if (name.length < 2) throw new ApiError('VALIDATION', 'กรุณากรอกชื่อเล่น,ชื่อในวงการ,ชื่อทางการ');
  if (!isOnsite || tel.length > 0) {
    if (!isValidThaiPhone(tel)) throw new ApiError('VALIDATION', 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
  }
  if (!isOnsite && !consent) throw new ApiError('VALIDATION', 'กรุณายอมรับเงื่อนไขการใช้ข้อมูล');

  // Check duplicate in Firestore if cloud is ready
  try {
    const fs = await getFirestoreModule();
    if (fs?.db && tel) {
      const q = fs.query(fs.collection(fs.db, 'registrations'), fs.where('phone', '==', tel));
      const snap = await fs.getDocs(q);
      if (!snap.empty) {
        const existing = snap.docs.map(d => d.data()).find(d => d && d.status !== 'cancelled');
        if (existing) {
          const regs = read(KEY.regs, []);
          if (!regs.some(r => r.id === existing.id)) {
            regs.push(existing);
            write(KEY.regs, regs);
          }
          throw new ApiError('DUPLICATE', 'เบอร์นี้ลงทะเบียนไว้แล้ว', publicView(existing));
        }
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
  }

  // Check duplicate locally
  const regs = read(KEY.regs, []);
  if (tel) {
    const dup = regs.find(r => r.phone === tel && r.status !== 'cancelled');
    if (dup) throw new ApiError('DUPLICATE', 'เบอร์นี้ลงทะเบียนไว้แล้ว', publicView(dup));
  }

  const now = new Date().toISOString();
  const avatarVariant = Math.floor(Math.random() * 3) + 1;
  const reg = {
    id: nextRegId(),
    token: secureToken(),
    fullName: name,
    phone: tel,
    gender: (gender === 'female' ? 'female' : 'male'),
    avatarVariant,
    pax: partySize,
    note: String(note || '').trim(),
    source,
    status: 'registered',
    createdAt: now,
    checkedInAt: autoCheckIn ? now : null,
    checkedInBy: autoCheckIn ? (staff || 'staff-onsite') : null,
  };
  regs.push({ ...reg, syncPending: true });
  write(KEY.regs, regs);
  audit('registration.create', { id: reg.id, source, staff, pax: partySize, autoCheckIn });
  emit();

  // Sync to Firestore in cloud
  try {
    await syncRegistrationToCloud(reg);
    const cur = read(KEY.regs, []);
    const idx = cur.findIndex(r => r.id === reg.id);
    if (idx >= 0 && cur[idx].syncPending) {
      delete cur[idx].syncPending;
      write(KEY.regs, cur);
    }
  } catch (e) {
    console.warn('Initial cloud sync queued for retry:', e);
  }

  return publicView(reg);
}

/** Deterministic fallback for legacy records without avatarVariant */
function resolveAvatarVariant(r) {
  const v = Number(r?.avatarVariant);
  if (v === 1 || v === 2 || v === 3) return v;
  const num = parseInt(String(r?.id || '').replace(/\D/g, ''), 10);
  return Number.isFinite(num) && num > 0 ? ((num - 1) % 3) + 1 : 1;
}

/** What the guest's device is allowed to see/keep. */
function publicView(r) {
  return {
    id: r.id,
    token: r.token,
    fullName: r.fullName,
    gender: r.gender || 'male',
    avatarVariant: resolveAvatarVariant(r),
    phone: r.phone || '',
    phoneMasked: r.phone ? maskPhone(r.phone) : '-',
    pax: Number(r.pax) || 1,
    note: r.note || '',
    source: r.source || 'online',
    status: r.checkedInAt ? 'checked_in' : r.status,
    createdAt: r.createdAt,
    checkedInAt: r.checkedInAt,
    checkedInBy: r.checkedInBy || null,
  };
}

export async function findByPhone(phone) {
  await delay(200);
  const tel = normalizePhone(phone);
  if (!tel) return null;

  // 1. Check local cache
  let r = read(KEY.regs, []).find(x => x.phone === tel && x.status !== 'cancelled');
  if (r) return publicView(r);

  // 2. Query Firestore if not found locally
  try {
    const fs = await getFirestoreModule();
    if (fs?.db) {
      const q = fs.query(fs.collection(fs.db, 'registrations'), fs.where('phone', '==', tel));
      const snap = await fs.getDocs(q);
      if (!snap.empty) {
        const found = snap.docs.map(d => d.data()).find(d => d && d.status !== 'cancelled');
        if (found) {
          const regs = read(KEY.regs, []);
          if (!regs.some(x => x.id === found.id)) {
            regs.push(found);
            write(KEY.regs, regs);
            emit();
          }
          return publicView(found);
        }
      }
    }
  } catch (e) {}

  return null;
}

export async function getByToken(token) {
  await delay(120);
  if (!token) return null;

  let r = read(KEY.regs, []).find(x => x.token === token);
  if (r) return publicView(r);

  try {
    const fs = await getFirestoreModule();
    if (fs?.db) {
      const q = fs.query(fs.collection(fs.db, 'registrations'), fs.where('token', '==', token));
      const snap = await fs.getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0].data();
        if (found) {
          const regs = read(KEY.regs, []);
          if (!regs.some(x => x.id === found.id)) {
            regs.push(found);
            write(KEY.regs, regs);
            emit();
          }
          return publicView(found);
        }
      }
    }
  } catch (e) {}

  return null;
}

/* ---------------- Check-in (Staff) ---------------- */
/** @returns {{result:'ok'|'already'|'invalid'|'cancelled', registration?:object}} */
export async function checkIn(token, staff = 'staff-demo') {
  await delay(200);
  const regs = read(KEY.regs, []);
  let r = regs.find(x => x.token === token);
  if (!r) {
    try {
      const fs = await getFirestoreModule();
      if (fs?.db) {
        const q = fs.query(fs.collection(fs.db, 'registrations'), fs.where('token', '==', token));
        const snap = await fs.getDocs(q);
        if (!snap.empty) {
          r = snap.docs[0].data();
          regs.push(r);
        }
      }
    } catch (e) {}
  }
  if (!r) { audit('checkin.invalid', { staff }); return { result: 'invalid' }; }
  if (r.status === 'cancelled') return { result: 'cancelled', registration: publicView(r) };
  if (r.checkedInAt) { audit('checkin.duplicate', { id: r.id, staff }); return { result: 'already', registration: publicView(r) }; }
  r.checkedInAt = new Date().toISOString();
  r.checkedInBy = staff;
  write(KEY.regs, regs);
  audit('checkin.success', { id: r.id, staff });
  emit();
  updateRegistrationInCloud(r.id, { checkedInAt: r.checkedInAt, checkedInBy: r.checkedInBy });
  return { result: 'ok', registration: publicView(r) };
}

export async function toggleCheckIn(id, staff = 'staff') {
  await delay(150);
  const regs = read(KEY.regs, []);
  const r = regs.find(x => x.id === id);
  if (!r) return null;
  if (r.checkedInAt) {
    r.checkedInAt = null;
    r.checkedInBy = null;
    audit('checkin.undo', { id: r.id, staff });
  } else {
    r.checkedInAt = new Date().toISOString();
    r.checkedInBy = staff;
    audit('checkin.success', { id: r.id, staff });
  }
  write(KEY.regs, regs);
  emit();
  updateRegistrationInCloud(r.id, { checkedInAt: r.checkedInAt, checkedInBy: r.checkedInBy });
  return publicView(r);
}

export async function deleteRegistration(id, staff = 'staff') {
  await delay(80);
  // 1. Remove from local storage immediately
  const regs = read(KEY.regs, []).filter(x => x.id !== id);
  write(KEY.regs, regs);

  // 2. Clear from device active ticket if this was the device's ticket
  const myTicket = getMyTicketRef();
  if (myTicket && myTicket.id === id) {
    clearMyTicket();
  }

  audit('registration.delete', { id, staff });
  emit();

  // 3. Delete from Firestore cloud and wait for completion
  await deleteRegistrationFromCloud(id);
  return true;
}

export async function listRegistrations() {
  await delay(40);
  try {
    const fs = await getFirestoreModule();
    if (fs?.db) {
      const snap = await fs.getDocs(fs.collection(fs.db, 'registrations'));
      const cloudRegs = [];
      snap.forEach(d => {
        const data = d.data();
        if (data && data.id) cloudRegs.push(data);
      });
      // Cloud is single source of truth when connected
      const localRegs = read(KEY.regs, []);
      const pendingUploads = localRegs.filter(r => r && r.syncPending && !cloudRegs.some(c => c.id === r.id));
      const allRegs = [...cloudRegs, ...pendingUploads];
      allRegs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      write(KEY.regs, allRegs);
      return allRegs
        .filter(r => r.status !== 'cancelled')
        .slice()
        .reverse()
        .map(r => publicView(r));
    }
  } catch (e) {}

  return read(KEY.regs, [])
    .filter(r => r.status !== 'cancelled')
    .slice()
    .reverse()
    .map(r => publicView(r));
}
export const getAuditLog = async () => read(KEY.audit, []);

/* ---------------- Stats (realtime) ---------------- */
export async function getStats() { await delay(100); return computeStats(); }
export function onStats(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---------------- My ticket (device) ---------------- */
export const saveMyTicket = t => write(KEY.myTicket, { id: t.id, token: t.token });
export const getMyTicketRef = () => read(KEY.myTicket, null);
export const clearMyTicket = () => localStorage.removeItem(KEY.myTicket);
export async function getMyTicket() {
  const ref = getMyTicketRef();
  return ref ? getByToken(ref.token) : null;
}
export function updateMyTicketGender(gender) {
  const ref = getMyTicketRef();
  if (!ref) return null;
  const g = gender === 'female' ? 'female' : 'male';
  const regs = read(KEY.regs, []);
  const idx = regs.findIndex(r => r.id === ref.id || r.token === ref.token);
  if (idx >= 0) {
    regs[idx].gender = g;
    write(KEY.regs, regs);
    if (regs[idx].id) {
      updateRegistrationInCloud(regs[idx].id, { gender: g });
    }
  }
  emit();
  return g;
}

/* ---------------- Polaroid content (Admin-managed later) ---------------- */
export async function getQuotes() { return read(KEY.quotes, DEFAULT_QUOTES); }
export async function getMonkPhoto() { return read(KEY.monk, './assets/monk.jpg'); }

/* ================================================================
 * Lucky Star — สอยดาว ลุ้นรับรางวัล
 * ----------------------------------------------------------------
 * Future endpoints:
 *   getLuckyWindow()   -> GET  /api/lucky/window
 *   playLuckyStar()    -> POST /api/lucky/play        (atomic: check-in + draw)
 *   findClaim()        -> GET  /api/lucky/claims/:code
 *   redeemPrize()      -> POST /api/lucky/claims/:code/redeem (atomic)
 *   listPrizes()/savePrize()/deletePrize() -> /api/lucky/prizes
 *
 * Draw model = "ตู้ดาว" (star box): the box holds `totalStars` stars,
 * prize stars = Σ prize.qty, the rest are blanks. Each play removes one
 * random star from what is left, so prizes can never exceed their qty.
 *
 * NOTE: this prototype enforces every rule in the browser (localStorage +
 * Web Locks across tabs). For multi-device production these rules must
 * run server-side / in a Firestore transaction — and the date check must
 * use server time, since the device clock can be changed.
 * ================================================================ */
export const LUCKY_QR_PREFIX = 'MFP1:';
export const luckyQrPayload = code => LUCKY_QR_PREFIX + code;
export const parseLuckyQr = text => {
  const t = String(text || '').trim();
  const raw = t.startsWith(LUCKY_QR_PREFIX) ? t.slice(LUCKY_QR_PREFIX.length) : t;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 8 ? code : null;
};
export const formatClaimCode = code => code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';

const DEFAULT_LUCKY_CONFIG = { totalStars: 300, testMode: true };
const DEFAULT_PRIZES = [
  { id: 'PZ-01', name: 'แก้วน้ำลายมังกร', desc: 'แก้วเก็บความเย็น ลายพิเศษเฉพาะงาน', emoji: '🥤', image: '', qty: 20 },
  { id: 'PZ-02', name: 'พวงกุญแจที่เปิดขวด', desc: 'พวงกุญแจพร้อมที่เปิดขวด ที่ระลึกงานบวช', emoji: '⭐', image: '', qty: 50 },
  { id: 'PZ-03', name: 'ชุดหมอนที่ระลึก', desc: 'ชุดหมอนพรีเมียม ที่ระลึกงานบวช', emoji: '🛏️', image: '', qty: 7 },
];

const CLAIM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randInt(n) {
  if (n <= 0) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n; // rejection sampling → no modulo bias
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}
function claimCode(existing) {
  let c;
  do { c = Array.from({ length: 8 }, () => CLAIM_ALPHABET[randInt(CLAIM_ALPHABET.length)]).join(''); }
  while (existing.has(c));
  return c;
}
function nextPlayId() {
  const n = (read(KEY.lsSeq, 0) || 0) + 1;
  write(KEY.lsSeq, n);
  return 'LS-' + String(n).padStart(4, '0');
}

/** Run fn exclusively across tabs (Web Locks) — prevents double draws on rapid taps. */
async function withLuckyLock(fn) {
  if (navigator.locks?.request) return navigator.locks.request('mf-lucky-star', fn);
  return fn();
}

const readPrizes = () => {
  let p = read(KEY.lsPrizes, null);
  if (!p || (Array.isArray(p) && p.some(item => item.name?.includes('พระเครื่อง')))) {
    write(KEY.lsPrizes, DEFAULT_PRIZES);
    return DEFAULT_PRIZES.slice();
  }
  return p;
};
const readPlays = () => read(KEY.lsPlays, []);

// Cloud sync helpers (Firebase Firestore with seamless localStorage fallback)
async function syncPlayToCloud(play) {
  try {
    const fs = await getFirestoreModule();
    if (!fs?.db || !play?.id) return;
    await fs.setDoc(fs.doc(fs.db, 'luckyPlays', play.id), play, { merge: true });
  } catch (e) {}
}

async function initLuckyPlaysCloudSync() {
  if (typeof window === 'undefined') return;
  try {
    const fs = await getFirestoreModule();
    if (!fs || !fs.db) return;
    fs.onSnapshot(fs.collection(fs.db, 'luckyPlays'), (snapshot) => {
      const cloudPlays = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d && d.id) cloudPlays.push(d);
      });
      cloudPlays.sort((a, b) => (a.playedAt || '').localeCompare(b.playedAt || ''));
      write(KEY.lsPlays, cloudPlays);
      emit();
    }, () => {});
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  initLuckyPlaysCloudSync();
}

async function syncLuckyConfigToCloud(cfg) {
  try {
    const fs = await getFirestoreModule();
    if (!fs || !fs.db) return;
    await fs.setDoc(fs.doc(fs.db, 'settings', 'luckyConfig'), cfg, { merge: true });
  } catch (e) {
    // Graceful fallback: Firestore not yet activated on GCP console
  }
}

async function initLuckyCloudSync() {
  if (typeof window === 'undefined') return;
  try {
    const fs = await getFirestoreModule();
    if (!fs || !fs.db) return;
    fs.onSnapshot(fs.doc(fs.db, 'settings', 'luckyConfig'), snap => {
      if (snap.exists()) {
        const remote = snap.data();
        const current = read(KEY.lsConfig, {});
        if (remote && JSON.stringify(remote) !== JSON.stringify(current)) {
          write(KEY.lsConfig, { ...DEFAULT_LUCKY_CONFIG, ...remote });
          emit();
        }
      }
    }, () => {});
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  initLuckyCloudSync();
}

export function getLuckyConfig() {
  const local = read(KEY.lsConfig, null);
  // Auto-detect ?test=1, ?testMode=true, or #test in URL and persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('test') === '1' || sp.get('testMode') === '1' || sp.get('testMode') === 'true' || window.location.hash.includes('test')) {
        if (!local || !local.testMode) {
          const patched = { ...DEFAULT_LUCKY_CONFIG, ...(local || {}), testMode: true };
          write(KEY.lsConfig, patched);
          return patched;
        }
      }
    } catch (e) {}
  }
  return { ...DEFAULT_LUCKY_CONFIG, ...(local || {}) };
}
export async function saveLuckyConfig(patch, staff = 'staff') {
  await delay(80);
  const cfg = { ...getLuckyConfig(), ...patch };
  cfg.totalStars = Math.max(1, Math.min(100000, Math.round(Number(cfg.totalStars) || DEFAULT_LUCKY_CONFIG.totalStars)));
  cfg.testMode = !!cfg.testMode;
  write(KEY.lsConfig, cfg);
  audit('lucky.config', { staff, ...cfg });
  emit();
  syncLuckyConfigToCloud(cfg);
  return cfg;
}

/* ---------------- Polaroid Config (Open/Closed switch) ---------------- */
const DEFAULT_POLAROID_CONFIG = {
  enabled: false,           // ปิดไว้ก่อนตามที่ต้องการ (ถึงวันงานค่อยเปิด หรือเปิดผ่านสวิตช์หลังบ้าน)
  autoOpenOnEventDay: true, // เปิดอัตโนมัติตั้งแต่วันงาน 22 พ.ย. 2569 เป็นต้นไป
};

async function syncPolaroidConfigToCloud(cfg) {
  try {
    const fs = await getFirestoreModule();
    if (!fs || !fs.db) return;
    await fs.setDoc(fs.doc(fs.db, 'settings', 'polaroidConfig'), cfg, { merge: true });
  } catch (e) {}
}

async function initPolaroidCloudSync() {
  if (typeof window === 'undefined') return;
  try {
    const fs = await getFirestoreModule();
    if (!fs || !fs.db) return;
    fs.onSnapshot(fs.doc(fs.db, 'settings', 'polaroidConfig'), snap => {
      if (snap.exists()) {
        const remote = snap.data();
        const current = read(KEY.polaroidConfig, {});
        if (remote && JSON.stringify(remote) !== JSON.stringify(current)) {
          write(KEY.polaroidConfig, { ...DEFAULT_POLAROID_CONFIG, ...remote });
          emit();
        }
      }
    }, () => {});
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  initPolaroidCloudSync();
}

export function getPolaroidConfig() {
  const local = read(KEY.polaroidConfig, null);
  // Auto-detect ?polaroid=1 or ?openPolaroid=true in URL
  if (typeof window !== 'undefined') {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('polaroid') === '1' || sp.get('openPolaroid') === 'true') {
        return { ...DEFAULT_POLAROID_CONFIG, ...(local || {}), enabled: true };
      }
    } catch (e) {}
  }
  return { ...DEFAULT_POLAROID_CONFIG, ...(local || {}) };
}

export async function savePolaroidConfig(patch, staff = 'staff') {
  await delay(80);
  const cfg = { ...getPolaroidConfig(), ...patch };
  cfg.enabled = !!cfg.enabled;
  cfg.autoOpenOnEventDay = cfg.autoOpenOnEventDay !== false;
  write(KEY.polaroidConfig, cfg);
  audit('polaroid.config', { staff, ...cfg });
  emit();
  syncPolaroidConfigToCloud(cfg);
  return cfg;
}

export function isPolaroidOpen() {
  const cfg = getPolaroidConfig();
  if (cfg.enabled) return true;
  if (cfg.autoOpenOnEventDay) {
    const today = bangkokDate();
    if (today >= EVENT.luckyStarDate) return true;
  }
  return false;
}


/** Current Thai (Asia/Bangkok) calendar date as YYYY-MM-DD. */
export function bangkokDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** @returns {{state:'before'|'open'|'after', testMode:boolean, today:string, date:string, label:string}} */
export function getLuckyWindow() {
  const cfg = getLuckyConfig();
  const today = bangkokDate();
  let state = today < EVENT.luckyStarDate ? 'before' : today > EVENT.luckyStarDate ? 'after' : 'open';
  if (cfg.testMode) state = 'open';
  return { state, testMode: cfg.testMode, today, date: EVENT.luckyStarDate, label: EVENT.luckyStarDateLabel };
}

function prizeStock(prizes, plays) {
  return prizes.map(p => {
    const awarded = plays.filter(x => (x.prizeId === p.id || (x.forfeitedPrizeId === p.id && !x.forfeitedAt)) && x.status !== 'forfeited' && !x.forfeitedAt).length;
    const redeemed = plays.filter(x => (x.prizeId === p.id || x.forfeitedPrizeId === p.id) && x.redeemedAt).length;
    return { ...p, awarded, redeemed, remaining: Math.max(0, (Number(p.qty) || 0) - awarded) };
  });
}

export async function listPrizes() {
  await delay(60);
  return prizeStock(readPrizes(), readPlays());
}

export async function savePrize(input, staff = 'staff') {
  await delay(120);
  const name = String(input.name || '').trim();
  const qty = Math.round(Number(input.qty));
  if (name.length < 2) throw new ApiError('VALIDATION', 'กรุณากรอกชื่อรางวัล');
  if (!Number.isFinite(qty) || qty < 0) throw new ApiError('VALIDATION', 'จำนวนรางวัลต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');

  const prizes = readPrizes();
  const plays = readPlays();
  const awarded = input.id ? plays.filter(x => x.prizeId === input.id).length : 0;
  if (qty < awarded) throw new ApiError('VALIDATION', `แจกรางวัลนี้ไปแล้ว ${awarded} ชิ้น ไม่สามารถลดจำนวนให้ต่ำกว่านี้ได้`);

  const data = {
    name, qty,
    desc: String(input.desc || '').trim(),
    emoji: String(input.emoji || '').trim() || '🎁',
    image: input.image || '',
  };
  let prize;
  const idx = input.id ? prizes.findIndex(p => p.id === input.id) : -1;
  if (idx >= 0) {
    prize = prizes[idx] = { ...prizes[idx], ...data, updatedAt: new Date().toISOString() };
  } else {
    const max = prizes.reduce((m, p) => Math.max(m, Number(String(p.id).replace(/\D/g, '')) || 0), 0);
    prize = { id: 'PZ-' + String(max + 1).padStart(2, '0'), ...data, createdAt: new Date().toISOString() };
    prizes.push(prize);
  }
  try { write(KEY.lsPrizes, prizes); }
  catch { throw new ApiError('STORAGE', 'พื้นที่จัดเก็บเต็ม กรุณาใช้รูปภาพขนาดเล็กลง หรือใช้อีโมจิแทน'); }
  audit(idx >= 0 ? 'lucky.prize.update' : 'lucky.prize.create', { staff, id: prize.id, qty });
  emit();
  return prize;
}

export async function deletePrize(id, staff = 'staff') {
  await delay(100);
  const awarded = readPlays().filter(x => x.prizeId === id).length;
  if (awarded > 0) throw new ApiError('IN_USE', `รางวัลนี้มีผู้ได้รับแล้ว ${awarded} คน ไม่สามารถลบได้ (ปรับจำนวนแทนได้)`);
  write(KEY.lsPrizes, readPrizes().filter(p => p.id !== id));
  audit('lucky.prize.delete', { staff, id });
  emit();
  return true;
}

function playView(p, prizes) {
  if (!p) return null;
  const isForfeited = p.status === 'forfeited' || !!p.forfeitedAt;
  const prizeId = p.prizeId || p.forfeitedPrizeId;
  const prize = prizeId ? prizes.find(x => x.id === prizeId) : null;
  const status = isForfeited ? 'forfeited' : p.redeemedAt ? 'redeemed' : p.prizeId ? 'won' : 'none';
  return {
    id: p.id,
    regId: p.regId,
    fullName: p.fullName,
    result: isForfeited ? 'forfeited' : p.result,               // 'win' | 'none' | 'forfeited'
    status,                                                     // 'won' | 'redeemed' | 'none' | 'forfeited'
    prizeId: p.prizeId || null,
    forfeitedPrizeId: p.forfeitedPrizeId || null,
    forfeitedPrizeName: p.forfeitedPrizeName || null,
    prize: isForfeited
      ? null
      : (prize
        ? { id: prize.id, name: prize.name, desc: prize.desc, emoji: prize.emoji, image: prize.image }
        : (p.prizeId ? { id: p.prizeId, name: p.prizeName, desc: '', emoji: '🎁', image: '' } : null)),
    claimCode: isForfeited ? null : (p.claimCode || null),
    playedAt: p.playedAt,
    redeemedAt: p.redeemedAt || null,
    redeemedBy: p.redeemedBy || null,
    forfeitedAt: p.forfeitedAt || null,
    forfeitedBy: p.forfeitedBy || null,
  };
}

/** Lucky Star result for a registration token (null = not played yet). */
export async function getLuckyPlay(regToken) {
  await delay(60);
  const reg = read(KEY.regs, []).find(r => r.token === regToken);
  if (!reg) return null;
  return playView(readPlays().find(p => p.regId === reg.id), readPrizes());
}

/**
 * Check-in + draw in ONE step. Idempotent: if this registration already
 * has a result, the original result is returned and nothing is redrawn.
 * @returns {{result:'ok'|'already'|'locked'|'ended'|'not_registered', play?:object}}
 */
export async function playLuckyStar(regToken) {
  await delay(350);
  return withLuckyLock(() => {
    const regs = read(KEY.regs, []);
    const reg = regs.find(r => r.token === regToken && r.status !== 'cancelled');
    if (!reg) return { result: 'not_registered' };

    const prizes = readPrizes();
    const plays = readPlays();
    const existing = plays.find(p => p.regId === reg.id);
    if (existing) return { result: 'already', play: playView(existing, prizes) };

    const win = getLuckyWindow();
    if (win.state === 'before') return { result: 'locked' };
    if (win.state === 'after') return { result: 'ended' };

    // --- draw one star from the box ---
    const cfg = getLuckyConfig();
    const activePlays = plays.filter(x => x.status !== 'forfeited' && !x.forfeitedAt);
    const stock = prizeStock(prizes, plays).filter(p => p.remaining > 0);
    const prizeStars = stock.reduce((s, p) => s + p.remaining, 0);
    const starsLeft = Math.max(cfg.totalStars - activePlays.length, prizeStars);
    let prize = null;
    if (starsLeft > 0) {
      let pick = randInt(starsLeft);
      for (const p of stock) { if (pick < p.remaining) { prize = p; break; } pick -= p.remaining; }
    }

    const now = new Date().toISOString();
    const play = {
      id: nextPlayId(),
      regId: reg.id,
      fullName: reg.fullName,
      result: prize ? 'win' : 'none',
      prizeId: prize?.id || null,
      prizeName: prize?.name || null,
      claimCode: prize ? claimCode(new Set(plays.map(p => p.claimCode).filter(Boolean))) : null,
      playedAt: now,
      redeemedAt: null,
      redeemedBy: null,
    };

    // check-in is recorded together with the draw
    if (!reg.checkedInAt) { reg.checkedInAt = now; reg.checkedInBy = 'self-luckystar'; }
    plays.push(play);
    write(KEY.regs, regs);
    write(KEY.lsPlays, plays);
    audit('lucky.play', { id: play.id, regId: reg.id, result: play.result, prizeId: play.prizeId });
    emit();
    syncPlayToCloud(play);
    if (reg.id) updateRegistrationInCloud(reg.id, { checkedInAt: reg.checkedInAt, checkedInBy: reg.checkedInBy });
    return { result: 'ok', play: playView(play, prizes) };
  });
}

/** Look up a prize claim by QR text or 8-char code (staff). */
export async function findClaim(codeOrQr) {
  await delay(120);
  const code = parseLuckyQr(codeOrQr);
  if (!code) return { result: 'invalid' };
  let p = readPlays().find(x => x.claimCode === code);
  if (!p) {
    try {
      const fs = await getFirestoreModule();
      if (fs?.db) {
        const q = fs.query(fs.collection(fs.db, 'luckyPlays'), fs.where('claimCode', '==', code));
        const snap = await fs.getDocs(q);
        if (!snap.empty) {
          p = snap.docs[0].data();
          const plays = readPlays();
          if (!plays.some(x => x.id === p.id)) {
            plays.push(p);
            write(KEY.lsPlays, plays);
          }
        }
      }
    } catch (e) {}
  }
  if (!p) return { result: 'invalid' };
  if (p.status === 'forfeited' || p.forfeitedAt) {
    return {
      result: 'forfeited',
      play: playView(p, readPrizes()),
      registration: null,
    };
  }
  let reg = read(KEY.regs, []).find(r => r.id === p.regId);
  if (!reg) {
    try {
      const fs = await getFirestoreModule();
      if (fs?.db) {
        const snap = await fs.getDoc(fs.doc(fs.db, 'registrations', p.regId));
        if (snap.exists()) reg = snap.data();
      }
    } catch (e) {}
  }
  return {
    result: p.redeemedAt ? 'already' : 'ok',
    play: playView(p, readPrizes()),
    registration: reg ? publicView(reg) : null,
  };
}

/** Staff confirms hand-over. One-time only; does NOT touch check-in. */
export async function redeemPrize(codeOrQr, staff = 'staff') {
  await delay(200);
  const code = parseLuckyQr(codeOrQr);
  if (!code) return { result: 'invalid' };
  return withLuckyLock(async () => {
    const plays = readPlays();
    let p = plays.find(x => x.claimCode === code);
    if (!p) {
      try {
        const fs = await getFirestoreModule();
        if (fs?.db) {
          const q = fs.query(fs.collection(fs.db, 'luckyPlays'), fs.where('claimCode', '==', code));
          const snap = await fs.getDocs(q);
          if (!snap.empty) {
            p = snap.docs[0].data();
            plays.push(p);
          }
        }
      } catch (e) {}
    }
    if (!p) { audit('lucky.redeem.invalid', { staff }); return { result: 'invalid' }; }
    if (p.redeemedAt) {
      audit('lucky.redeem.duplicate', { staff, id: p.id });
      return { result: 'already', play: playView(p, readPrizes()) };
    }
    p.redeemedAt = new Date().toISOString();
    p.redeemedBy = staff;
    write(KEY.lsPlays, plays);
    audit('lucky.redeem', { staff, id: p.id, prizeId: p.prizeId });
    emit();
    try {
      const fs = await getFirestoreModule();
      if (fs?.db) {
        await fs.setDoc(fs.doc(fs.db, 'luckyPlays', p.id), { redeemedAt: p.redeemedAt, redeemedBy: p.redeemedBy }, { merge: true });
      }
    } catch (e) {}
    return { result: 'ok', play: playView(p, readPrizes()) };
  });
}

export async function listLuckyPlays() {
  await delay(60);
  const prizes = readPrizes();
  return readPlays().slice().reverse().map(p => playView(p, prizes));
}

export async function getLuckyStats() {
  await delay(40);
  const plays = readPlays();
  const prizes = prizeStock(readPrizes(), plays);
  const cfg = getLuckyConfig();
  const activePlays = plays.filter(p => p.status !== 'forfeited' && !p.forfeitedAt);
  const winners = activePlays.filter(p => p.result === 'win' || p.prizeId);
  const prizeTotal = prizes.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const prizeRemaining = prizes.reduce((s, p) => s + p.remaining, 0);
  return {
    participants: plays.length,
    winners: winners.length,
    noPrize: plays.length - winners.length,
    redeemed: winners.filter(p => p.redeemedAt).length,
    awaitingRedeem: winners.filter(p => !p.redeemedAt).length,
    prizeTotal,
    prizeRemaining,
    totalStars: cfg.totalStars,
    starsLeft: Math.max(cfg.totalStars - activePlays.length, prizeRemaining, 0),
  };
}

/**
 * Staff revokes an uncollected/forfeited prize, returning it to the prize pool
 * so others can draw it again. Does NOT affect check-in or registration.
 */
export async function revokeLuckyPrize(playId, staff = 'staff') {
  await delay(150);
  return withLuckyLock(async () => {
    const plays = readPlays();
    let p = plays.find(x => x.id === playId);
    if (!p) {
      try {
        const fs = await getFirestoreModule();
        if (fs?.db) {
          const snap = await fs.getDoc(fs.doc(fs.db, 'luckyPlays', playId));
          if (snap.exists()) {
            p = snap.data();
            plays.push(p);
          }
        }
      } catch (e) {}
    }
    if (!p) throw new ApiError('NOT_FOUND', 'ไม่พบประวัติการสุ่มนี้');
    if (p.redeemedAt) throw new ApiError('ALREADY_REDEEMED', 'ผู้ร่วมงานรับรางวัลไปแล้ว ไม่สามารถสละสิทธิ์ได้');
    if (p.status === 'forfeited' || p.forfeitedAt) throw new ApiError('ALREADY_FORFEITED', 'รายการนี้สละสิทธิ์และคืนรางวัลสู่ตู้ไปแล้ว');
    if (p.result !== 'win' && !p.prizeId) throw new ApiError('NO_PRIZE', 'รายการนี้ไม่ได้รับรางวัล');

    const now = new Date().toISOString();
    const oldPrizeId = p.prizeId;
    const oldPrizeName = p.prizeName;
    p.status = 'forfeited';
    p.result = 'forfeited';
    p.forfeitedAt = now;
    p.forfeitedBy = staff;
    p.forfeitedPrizeId = oldPrizeId;
    p.forfeitedPrizeName = oldPrizeName;
    p.prizeId = null;
    p.claimCode = null;

    write(KEY.lsPlays, plays);
    audit('lucky.prize.forfeit', { staff, id: p.id, regId: p.regId, oldPrizeId, oldPrizeName });
    emit();

    try {
      const fs = await getFirestoreModule();
      if (fs?.db) {
        await fs.setDoc(fs.doc(fs.db, 'luckyPlays', p.id), {
          status: 'forfeited',
          result: 'forfeited',
          forfeitedAt: p.forfeitedAt,
          forfeitedBy: p.forfeitedBy,
          forfeitedPrizeId: oldPrizeId,
          forfeitedPrizeName: oldPrizeName,
          prizeId: null,
          claimCode: null,
        }, { merge: true });
      }
    } catch (e) {}

    return { result: 'ok', play: playView(p, readPrizes()) };
  });
}

export async function resetLuckyPlays(staff = 'staff') {
  await delay(100);
  try {
    await clearCloudCollection('luckyPlays');
  } catch (e) {}
  localStorage.removeItem(KEY.lsPlays);
  localStorage.removeItem(KEY.lsSeq);
  audit('lucky.reset', { staff });
  emit();
}

/* ---------------- Demo utilities ---------------- */
const DEMO_FIRST = ['สมชาย', 'สมหญิง', 'กิตติ', 'อรุณี', 'ธนา', 'พิมพ์ชนก', 'วีระ', 'ศิริพร', 'ณัฐ', 'ปวีณา', 'อนันต์', 'มาลี'];
const DEMO_LAST = ['ใจดี', 'บุญมา', 'ศรีสุข', 'แก้วงาม', 'ทองดี', 'รักษ์ธรรม', 'มีสุข', 'สายบุญ'];
export async function seedDemo(n = 40) {
  const regs = read(KEY.regs, []);
  for (let i = 0; i < n; i++) {
    const phone = '08' + String(Math.floor(10000000 + Math.random() * 89999999));
    if (regs.some(r => r.phone === phone)) continue;
    const checked = Math.random() < 0.62;
    regs.push({
      id: nextRegId(), token: secureToken(),
      fullName: `${DEMO_FIRST[i % DEMO_FIRST.length]} ${DEMO_LAST[(i * 7) % DEMO_LAST.length]}`,
      phone, source: 'online', status: 'registered', demo: true,
      createdAt: new Date(Date.now() - Math.random() * 6e8).toISOString(),
      checkedInAt: checked ? new Date().toISOString() : null, checkedInBy: checked ? 'seed' : null,
    });
  }
  write(KEY.regs, regs);
  const currentVisitors = Number(read(KEY.visitors, 0)) || 0;
  write(KEY.visitors, currentVisitors + Math.floor(n * 1.5));
  audit('demo.seed', { n });
  emit();
}
export async function resetAll(staff = 'staff') {
  // 1. Delete all Firestore cloud records
  try {
    await Promise.all([
      clearCloudCollection('registrations'),
      clearCloudCollection('luckyPlays'),
    ]);
  } catch (e) {
    console.warn('Cloud collections clear warning:', e);
  }

  // 2. Clear all local storage keys
  Object.values(KEY).forEach(k => localStorage.removeItem(k));
  try { sessionStorage.removeItem('mf_session_counted'); } catch { }
  audit('system.reset_all', { staff });
  emit();
}
