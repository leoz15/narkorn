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
  tagline: 'A Little World of Merit',
  date: '2026-11-22T07:00:00+07:00',
  dateTh: 'อาทิตย์ 22 พฤศจิกายน 2569',
  venue: 'วัด (รอยืนยันชื่อสถานที่)',
  target: 300,
};

const KEY = {
  regs: 'mf.registrations.v1',
  audit: 'mf.audit.v1',
  myTicket: 'mf.myTicket.v1',
  quotes: 'mf.quotes.v1',
  monk: 'mf.monkPhoto.v1',
  seq: 'mf.seq.v1',
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
  const n = (read(KEY.seq, 0) || 0) + 1;
  write(KEY.seq, n);
  return 'MF-' + String(n).padStart(4, '0');
}

function audit(action, data = {}) {
  const log = read(KEY.audit, []);
  log.unshift({ at: new Date().toISOString(), action, ...data });
  write(KEY.audit, log.slice(0, 500));
}

function emit() {
  const stats = computeStats();
  listeners.forEach(fn => fn(stats));
  channel?.postMessage({ type: 'stats' });
}
channel && (channel.onmessage = () => { const s = computeStats(); listeners.forEach(fn => fn(s)); });
window.addEventListener('storage', e => { if (e.key === KEY.regs) { const s = computeStats(); listeners.forEach(fn => fn(s)); } });

function computeStats() {
  const regs = read(KEY.regs, []).filter(r => r.status !== 'cancelled');
  return {
    registered: regs.length,
    checkedIn: regs.filter(r => r.checkedInAt).length,
    target: EVENT.target,
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

export async function registerGuest({ fullName, phone, consent, source = 'online', staff = null }) {
  await delay(450);
  const name = String(fullName || '').trim().replace(/\s+/g, ' ');
  const tel = normalizePhone(phone);
  if (name.length < 3) throw new ApiError('VALIDATION', 'กรุณากรอกชื่อ-นามสกุล');
  if (!isValidThaiPhone(tel)) throw new ApiError('VALIDATION', 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
  if (!consent) throw new ApiError('VALIDATION', 'กรุณายอมรับเงื่อนไขการใช้ข้อมูล');

  const regs = read(KEY.regs, []);
  const dup = regs.find(r => r.phone === tel && r.status !== 'cancelled');
  if (dup) throw new ApiError('DUPLICATE', 'เบอร์นี้ลงทะเบียนไว้แล้ว', publicView(dup));

  const reg = {
    id: nextRegId(),
    token: secureToken(),
    fullName: name,
    phone: tel,
    source,
    status: 'registered',
    createdAt: new Date().toISOString(),
    checkedInAt: null,
    checkedInBy: null,
  };
  regs.push(reg);
  write(KEY.regs, regs);
  audit('registration.create', { id: reg.id, source, staff });
  emit();
  return publicView(reg);
}

/** What the guest's device is allowed to see/keep. */
function publicView(r) {
  return {
    id: r.id, token: r.token, fullName: r.fullName, phoneMasked: maskPhone(r.phone),
    status: r.checkedInAt ? 'checked_in' : r.status, createdAt: r.createdAt, checkedInAt: r.checkedInAt,
  };
}

export async function findByPhone(phone) {
  await delay(300);
  const tel = normalizePhone(phone);
  const r = read(KEY.regs, []).find(x => x.phone === tel && x.status !== 'cancelled');
  return r ? publicView(r) : null;
}

export async function getByToken(token) {
  await delay(120);
  const r = read(KEY.regs, []).find(x => x.token === token);
  return r ? publicView(r) : null;
}

/* ---------------- Check-in (Staff) ---------------- */
/** @returns {{result:'ok'|'already'|'invalid'|'cancelled', registration?:object}} */
export async function checkIn(token, staff = 'staff-demo') {
  await delay(300);
  const regs = read(KEY.regs, []);
  const r = regs.find(x => x.token === token);
  if (!r) { audit('checkin.invalid', { staff }); return { result: 'invalid' }; }
  if (r.status === 'cancelled') return { result: 'cancelled', registration: publicView(r) };
  if (r.checkedInAt) { audit('checkin.duplicate', { id: r.id, staff }); return { result: 'already', registration: publicView(r) }; }
  r.checkedInAt = new Date().toISOString();
  r.checkedInBy = staff;
  write(KEY.regs, regs);
  audit('checkin.success', { id: r.id, staff });
  emit();
  return { result: 'ok', registration: publicView(r) };
}

export async function listRegistrations() {
  await delay(150);
  return read(KEY.regs, []).slice().reverse().map(r => ({ ...publicView(r), source: r.source }));
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

/* ---------------- Polaroid content (Admin-managed later) ---------------- */
export async function getQuotes() { return read(KEY.quotes, DEFAULT_QUOTES); }
export async function getMonkPhoto() { return read(KEY.monk, './assets/monk.jpg'); }

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
      phone, source: Math.random() < 0.8 ? 'online' : 'onsite', status: 'registered', demo: true,
      createdAt: new Date(Date.now() - Math.random() * 6e8).toISOString(),
      checkedInAt: checked ? new Date().toISOString() : null, checkedInBy: checked ? 'seed' : null,
    });
  }
  write(KEY.regs, regs);
  audit('demo.seed', { n });
  emit();
}
export async function resetAll() {
  Object.values(KEY).forEach(k => localStorage.removeItem(k));
  emit();
}
