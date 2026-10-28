/**
 * MERIT FEST — 3D Event Map
 * Isometric / cute low-poly diorama with 3 connected zones:
 *   1) โบสถ์ (ordination)  2) เวทีดนตรี + grouped tables  3) ซุ้มอาหาร row
 * - 1 monk mascot in front of the temple (idle / wai animation)
 * - Guest characters: pool supports 300, renders 50–100 via InstancedMesh
 * - Attendance numbers come from the data service, never from character count
 * - Personal character "ME": tap โบสถ์ / เวที / โต๊ะอาหาร to walk there (A* on a nav grid)
 *   and pray / dance / sit & eat (see map-character.js)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EVENT, getStats, onStats, recordVisit, getMyTicket } from '../store.js';
import { countUp, toast } from '../ui.js';
import { NavGrid, createMe, ME_STATE } from './map-character.js';

// single live map instance → guarantees exactly one ME even if render() is re-entered
let activeCleanup = null;
let renderSeq = 0;

const ME_STATUS = {
  [ME_STATE.IDLE]: ['👆', 'แตะ <b>โบสถ์</b> · <b>เวที</b> · <b>โต๊ะอาหาร</b> เพื่อพา ME ไปทำกิจกรรม'],
  [ME_STATE.WALKING_TO_CHURCH]: ['🚶', 'ME กำลังเดินไปหน้าพระ…'],
  [ME_STATE.PRAYING]: ['🙏', 'ME กำลังไหว้พระ · <b>สาธุ</b>'],
  [ME_STATE.WALKING_TO_STAGE]: ['🚶', 'ME กำลังเดินไปหน้าเวที…'],
  [ME_STATE.DANCING]: ['💃', 'ME กำลังเต้นหน้าเวที · <b>ม่วนคักๆ</b>'],
  [ME_STATE.WALKING_TO_DINING]: ['🚶', 'ME กำลังเดินไปโต๊ะอาหาร…'],
  [ME_STATE.EATING]: ['🍚', 'ME กำลังรับประทานอาหาร · <b>อนุโมทนาบุญ</b>'],
};

const CFG = { supported: 300, defaultVisible: 50 };

const COL = {
  grass: '#a8cf86', grass2: '#97c275', dirt: '#b98a5e', dirt2: '#94694a',
  path: '#efdcb6', plaza: '#ead8b8', stone: '#e6ddcc', white: '#fbf6ec',
  roof1: '#c8442f', roof2: '#e07a2c', gold: '#e3b14b', door: '#8a2b1f',
  wood: '#a8744a', woodD: '#7d5434', stage: '#4b3a33', metal: '#c9c9d2', dark: '#2f2a2a',
  cloth: '#fffaf0', leaf: '#6fa356', leaf2: '#86b765', trunk: '#8b5e3c', water: '#8fd0e6',
  robe: '#e8861e', skin: '#f2c9a0',
};
const SHIRTS = ['#f28b82', '#fbbc04', '#a7d08c', '#8ab4f8', '#c58af9', '#fdcfe8', '#ffffff', '#f6aea9', '#aecbfa', '#e6c9a8', '#ccff90', '#fff475'];
const SKINS = ['#f2c9a0', '#e8b88e', '#d9a47a', '#f5d3b3'];
const HAIRS = ['#2b211b', '#3b2a20', '#1d1714', '#5a3e2b'];

const ZONES = [
  {
    id: 'temple', name: 'โบสถ์ · พิธีอุปสมบท', short: 'โบสถ์', ico: '🛕', color: '#e8913a', tag: 'Landmark',
    label: [-18, 9, 0], focus: [-15, 0, 1], hit: { c: [-18, 3, -4], s: [16, 8, 20] },
    desc: 'จุดประกอบพิธีอุปสมบทและแห่นาครอบพัทธสีมา ผู้ร่วมงานสามารถร่วมอนุโมทนาบุญบริเวณลานหน้าโบสถ์',
    steps: [['ปลงผมนาค', '09:00'], ['แห่นาค', '13:00'], ['พิธีอุปสมบท', '15:00']],
    bounds: { x: [-24.5, -11.5], z: [1.8, 5.6] }, share: 0.45,
  },
  {
    id: 'stage', name: 'เวทีบวชนาคมังกร', short: 'บวชนาคมังกร', ico: '🎵', color: '#8a6fd1', tag: 'Live',
    label: [2, 8, -10], focus: [2, 0, -3], hit: { c: [2, 2, -3], s: [18, 6, 18] },
    desc: 'เวทีหลักพร้อมระบบแสง สี เสียง บรรเลงดนตรีเฉลิมฉลอง และพื้นที่ศาลาสำหรับเทศน์สอนนาค',
    steps: [['เปิดเสียงดนตรี', '09:00'], ['เทศน์สอนนาค', '12:30'], ['ดนตรีแห่นาค', '13:00'], ['ดนตรีฉลองพระใหม่', '16:00']],
    bounds: { x: [-6, 10], z: [-5.5, 6.2] }, share: 0.55,
  },
];
const PATH_BOUNDS = { x: [-25, 12], z: [7.2, 8.8] };

export async function render(el) {
  const seq = ++renderSeq;
  if (activeCleanup) { try { activeCleanup(); } catch (e) { console.warn(e); } activeCleanup = null; }
  el.innerHTML = `
  <section class="map-page" id="map-page">
    <div class="map-canvas" id="map-canvas"></div>
    <div class="map-labels" id="map-labels"></div>

    <div class="map-hud">
      <div class="hud-card glass" id="hud-card" title="${EVENT.dateTh} · ${EVENT.venue}">
        <div class="hud-head">
          <div class="logo">🛕</div>
          <div class="hud-head-main">
            <div class="hud-head-row">
              <h1>วัดลานคา · แผนที่งาน 3D</h1>
              <div class="clock"><span class="dot live" style="color:var(--leaf-d)"></span><span id="map-clock">--:--</span></div>
            </div>
            <div class="hud-mini-stats" id="hud-mini-stats">
              <span>จำนวนที่เข้ามาชม <b><span id="hs-visitors">0</span></b> คน</span>
              <span class="sep">•</span>
              <span>จำนวนเช็คอิน <b><span id="hs-chk">0</span></b> ครั้ง</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="map-controls glass">
      <button id="mc-zoom-in" title="ซูมเข้า">＋</button>
      <button id="mc-zoom-out" title="ซูมออก">－</button>
      <hr />
      <button id="mc-rot-l" title="หมุนซ้าย">⟲</button>
      <button id="mc-rot-r" title="หมุนขวา">⟳</button>
      <hr />
      <button id="mc-home" title="มุมมองเริ่มต้น">⌂</button>
    </div>


    <div class="zone-sheet glass" id="zone-sheet" role="dialog" aria-live="polite"></div>

    <div class="me-status glass" id="me-status" aria-live="polite">
      <span class="me-status-ico" id="me-status-ico">👆</span>
      <span class="me-status-text" id="me-status-text"></span>
      <button class="me-status-btn" id="me-focus" title="เลื่อนกล้องไปที่ ME">📍 คลิ๊กเพื่อดู ME</button>
    </div>

    <div class="map-loading" id="map-loading"><div style="text-align:center;color:var(--cocoa-2)"><div class="spinner"></div>กำลังสร้างโลกจำลอง…</div></div>
  </section>`;

  const container = el.querySelector('#map-canvas');
  const labelsEl = el.querySelector('#map-labels');
  const sheet = el.querySelector('#zone-sheet');

  // ---------- WebGL support ----------
  const testCanvas = document.createElement('canvas');
  if (!(testCanvas.getContext('webgl2') || testCanvas.getContext('webgl'))) {
    el.querySelector('#map-loading').innerHTML = `<div class="card" style="max-width:420px;text-align:center"><img src="./assets/hero.jpg" alt="ภาพแผนที่งาน" style="border-radius:12px;margin-bottom:12px"/>อุปกรณ์นี้ไม่รองรับ 3D แสดงภาพแผนที่แทน</div>`;
    return;
  }
  await Promise.all([
    document.fonts.ready,
    document.fonts.load('700 54px Prompt', 'ME สาธุ ม่วนคักๆ อนุโมทนาบุญ').catch(() => { }),
  ]);
  if (seq !== renderSeq || !el.isConnected) return; // superseded by a newer render

  // ---------- Renderer / scene / camera ----------
  const isMobile = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6ecd9');

  const HOME_TARGET_DESKTOP = new THREE.Vector3(-14, 0, 1);
  const HOME_TARGET_MOBILE = new THREE.Vector3(-8, 0, 3);
  const HOME_OFFSET_DESKTOP = new THREE.Vector3(40, 36, 40);
  const HOME_OFFSET_MOBILE = new THREE.Vector3(36, 38, 36);

  const getHomeTarget = () => matchMedia('(max-width: 760px)').matches ? HOME_TARGET_MOBILE.clone() : HOME_TARGET_DESKTOP.clone();
  const getHomeOffset = () => matchMedia('(max-width: 760px)').matches ? HOME_OFFSET_MOBILE.clone() : HOME_OFFSET_DESKTOP.clone();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  const initialTarget = getHomeTarget();
  const initialOffset = getHomeOffset();
  camera.position.copy(initialTarget).add(initialOffset);
  camera.lookAt(initialTarget);
  camera.zoom = isMobile ? 1.5 : 1.0;
  camera.updateProjectionMatrix();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minZoom = 0.6;
  controls.maxZoom = 4;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.15;
  controls.screenSpacePanning = false;
  controls.target.copy(initialTarget);

  // lights
  scene.add(new THREE.HemisphereLight('#fff6e6', '#8fbf6c', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.2);
  sun.position.set(30, 50, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // ---------- Helpers ----------
  const disposables = [];
  const matCache = new Map();
  const M = (c, extra = {}) => {
    const k = c + JSON.stringify(extra);
    if (!matCache.has(k)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, flatShading: true, ...extra }); matCache.set(k, m); disposables.push(m); }
    return matCache.get(k);
  };
  const world = new THREE.Group(); scene.add(world);
  const add = (mesh, parent = world, cast = true, recv = true) => { mesh.castShadow = cast; mesh.receiveShadow = recv; parent.add(mesh); disposables.push(mesh.geometry); return mesh; };
  /** box with bottom at y */
  const box = (w, h, d, c, x, y, z, parent = world, cast = true) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? M(c) : c), parent, cast); m.position.set(x, y + h / 2, z); return m; };
  const cyl = (rt, rb, h, c, x, y, z, parent = world, seg = 10) => { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'string' ? M(c) : c), parent); m.position.set(x, y + h / 2, z); return m; };
  const prism = (w, h, len, c) => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
    return new THREE.Mesh(g, M(c));
  };
  const canvasTex = (draw, w = 512, h = 128) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; disposables.push(t); return t;
  };
  const textTex = (text, bg, fg, font = '600 60px Prompt', w = 512, h = 128) => canvasTex((g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  }, w, h);

  // ---------- Ground (floating diorama) ----------
  const GW = 56, GD = 54, GCX = -9;
  const walkables = []; // surfaces ME stands on (ground-height raycast)
  walkables.push(box(GW, 0.6, GD, COL.grass, GCX, -0.6, 0, world, false));
  box(GW, 2.4, GD, COL.dirt, GCX, -3.0, 0, world, false);
  box(GW + 0.2, 0.25, GD + 0.2, COL.dirt2, GCX, -3.1, 0, world, false);
  // grass patches for texture
  for (let i = 0; i < 22; i++) {
    const p = box(2 + Math.random() * 4, 0.02, 2 + Math.random() * 4, COL.grass2, (GCX - GW / 2 + 3) + Math.random() * (GW - 6), 0, -23 + Math.random() * 46, world, false);
    p.rotation.y = Math.random() * Math.PI;
    walkables.push(p);
  }

  // ---------- Paths ----------
  const pathM = M(COL.path);
  walkables.push(
    box(38, 0.05, 3, pathM, -7, 0, 8, world, false),               // main E–W walkway (connects entrance, stage, temple)
    box(3.5, 0.05, 16, pathM, 0, 0, 17, world, false),             // entrance
    box(16, 0.06, 13, M(COL.plaza), 2, 0, 0.5, world, false),      // stage plaza
    box(15, 0.07, 5.5, M(COL.stone), -18, 0, 3.6, world, false),   // temple courtyard
  );
  // stepping stones
  for (let i = 0; i < 6; i++) walkables.push(box(1.1, 0.06, 0.8, M(COL.stone), -27 + i * 0.3, 0, 10 + i * 1.3, world, false));

  // ---------- Zone 1: Temple (Ubosot) ----------
  const temple = new THREE.Group(); temple.position.set(-18, 0, -6); world.add(temple);
  box(15, 0.5, 19, COL.stone, 0, 0, 0, temple);
  box(12, 0.6, 16, COL.white, 0, 0.5, 0, temple);
  // front stairs
  for (let i = 0; i < 3; i++) box(4 - i * 0.3, 0.37 * (i + 1), 0.6, COL.white, 0, 0, 8.3 - i * 0.6, temple);
  // main hall
  box(8, 3.6, 12, COL.white, 0, 1.1, 0, temple);
  box(8.2, 0.25, 12.2, COL.gold, 0, 4.7, 0, temple);
  // columns
  for (let z = -5; z <= 5; z += 2.5) for (const x of [-4.6, 4.6]) {
    cyl(0.28, 0.32, 3.6, COL.white, x, 1.1, z, temple, 8);
    cyl(0.4, 0.3, 0.3, COL.gold, x, 4.6, z, temple, 8);
  }
  for (const x of [-2.5, 2.5]) { cyl(0.3, 0.34, 3.6, COL.white, x, 1.1, 6.6, temple, 8); cyl(0.42, 0.32, 0.3, COL.gold, x, 4.6, 6.6, temple, 8); }
  // door + windows
  box(1.8, 2.6, 0.12, COL.door, 0, 1.1, 6.02, temple);
  box(2.2, 0.25, 0.14, COL.gold, 0, 3.7, 6.03, temple);
  for (let z = -3.75; z <= 3.75; z += 2.5) for (const x of [-4.02, 4.02]) { box(0.1, 1.5, 0.9, COL.door, x, 2, z, temple); box(0.12, 0.2, 1.1, COL.gold, x, 3.5, z, temple); }
  // Thai tiered roof (3 tiers) with gold gable faces
  const tiers = [
    { w: 11, h: 3.4, l: 14.6, y: 4.95, c: COL.roof1 },
    { w: 8.6, h: 3.9, l: 12, y: 5.6, c: COL.roof2 },
    { w: 6.2, h: 3.6, l: 9.2, y: 6.6, c: COL.roof1 },
  ];
  tiers.forEach((t, i) => {
    const r = add(prism(t.w, t.h, t.l, t.c), temple); r.position.y = t.y;
    for (const s of [1, -1]) {
      const gable = add(prism(t.w * 0.78, t.h * 0.78, 0.08, COL.gold), temple, false);
      gable.position.set(0, t.y + 0.25, s * (t.l / 2 + 0.04));
    }
    if (i === tiers.length - 1) {
      // chofa (gold finials) at the apex
      for (const s of [1, -1]) {
        const ch = add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 6), M(COL.gold)), temple);
        ch.position.set(0, t.y + t.h + 0.4, s * (t.l / 2 - 0.1)); ch.rotation.x = s * 0.55;
      }
      const ridge = box(0.25, 0.25, t.l, COL.gold, 0, t.y + t.h - 0.15, 0, temple);
      ridge.castShadow = false;
    }
  });
  // chedis at the corners
  for (const [x, z] of [[-6.5, 8], [6.5, 8]]) {
    cyl(1, 1.1, 0.6, COL.white, x, 0.5, z, temple, 8);
    cyl(0.75, 0.9, 0.9, COL.white, x, 1.1, z, temple, 8);
    const bell = add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(COL.white)), temple); bell.position.set(x, 2, z);
    const sp = add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 8), M(COL.gold)), temple); sp.position.set(x, 3.7, z);
  }
  // low boundary wall (kampaeng kaew) with front opening
  for (const [w, d, x, z] of [[15, 0.4, 0, -9.5], [0.4, 19, -7.5, 0], [0.4, 19, 7.5, 0], [5, 0.4, -5, 9.5], [5, 0.4, 5, 9.5]]) box(w, 0.9, d, COL.white, x, 0.5, z, temple);
  // flag poles with golden banners
  for (const x of [-9, 9]) { cyl(0.08, 0.08, 5, COL.metal, x, 0, 11.5, temple, 6); const f = box(0.05, 1.6, 0.9, COL.gold, x, 3.2, 11.95, temple); f.castShadow = false; }

  // ---------- Monk Mascot (front of temple) ----------
  const monk = new THREE.Group(); monk.position.set(-18, 0.07, 2.6); world.add(monk);
  const monkBody = new THREE.Group(); monk.add(monkBody);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 1.9, 12), M(COL.robe)), monkBody).position.y = 0.95;
  const sash = add(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.92, 0.5, 12, 1, true, 0, Math.PI), M('#d4701a', { side: THREE.DoubleSide })), monkBody); sash.position.y = 1.35; sash.rotation.z = 0.5;
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), new THREE.MeshStandardMaterial({ color: COL.skin, roughness: 0.7 })), monkBody); head.position.y = 2.45;
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: COL.skin, roughness: .7 })), monkBody).position.set(s * 0.7, 2.45, 0); // ears
    add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), M('#2a1d16')), monkBody, false).position.set(s * 0.24, 2.52, 0.65); // eyes
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M('#f4a3a0')), monkBody, false).position.set(s * 0.4, 2.33, 0.58); // blush
  }
  const hands = add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 6), new THREE.MeshStandardMaterial({ color: COL.skin, roughness: .7 })), monkBody); hands.position.set(0, 1.55, 0.85);
  // halo ring + pedestal
  cyl(1.4, 1.5, 0.12, COL.gold, 0, 0, 0, monk, 20);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.7 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 3.6; monk.add(halo); disposables.push(halo.geometry, halo.material);

  // ---------- Zone 2: Music stage + grouped tables ----------
  const stage = new THREE.Group(); stage.position.set(2, 0, -10); world.add(stage);
  box(13, 1.1, 6.5, COL.stage, 0, 0, 0, stage);
  box(13.1, 0.06, 6.6, '#34282a', 0, 1.1, 0, stage);
  for (let i = 0; i < 3; i++) box(2.4, 0.37 * (i + 1), 0.45, COL.woodD, 0, 0, 3.5 + (2 - i) * 0.45, stage);
  box(13, 5.5, 0.35, '#3a2f4a', 0, 1.1, -3.1, stage);
  const screenMat = new THREE.MeshStandardMaterial({ color: '#221a33', emissive: '#7a4fd1', emissiveIntensity: 0.9, roughness: .4 });
  disposables.push(screenMat);
  box(8, 3, 0.08, screenMat, 0, 2.4, -2.9, stage, false);
  // truss frame
  for (const x of [-6.6, 6.6]) for (const z of [-3, 3]) box(0.25, 7.2, 0.25, COL.metal, x, 0, z, stage);
  box(13.5, 0.3, 0.3, COL.metal, 0, 7.2, 3, stage); box(13.5, 0.3, 0.3, COL.metal, 0, 7.2, -3, stage);
  box(0.3, 0.3, 6.3, COL.metal, -6.6, 7.2, 0, stage); box(0.3, 0.3, 6.3, COL.metal, 6.6, 7.2, 0, stage);
  // banner
  const banner = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1, 0.1), [M('#c96f1c'), M('#c96f1c'), M('#c96f1c'), M('#c96f1c'),
  new THREE.MeshStandardMaterial({ map: textTex('บวชนาคมังกร ♪', '#e8913a', '#fff', '700 68px Prompt', 768, 110) }), M('#c96f1c')]);
  banner.position.set(0, 6.4, 3); stage.add(banner); disposables.push(banner.geometry);
  // speakers
  for (const x of [-5.4, 5.4]) { box(1.1, 1.8, 1, COL.dark, x, 1.1, 1.8, stage); cyl(0.3, 0.3, 0.05, '#555', x, 2.1, 2.31, stage).rotation.x = Math.PI / 2; }
  for (const x of [-7.6, 7.6]) { box(1.3, 1.4, 1.2, COL.dark, x, 0, 2.6, stage); box(1.1, 1.2, 1, COL.dark, x, 1.4, 2.6, stage); }
  // instruments
  cyl(0.55, 0.55, 0.5, '#d9d2c5', -2.2, 1.15, -1.2, stage, 14); cyl(0.4, 0.4, 0.35, '#d9d2c5', -1.3, 1.6, -1.5, stage, 14);
  cyl(0.45, 0.02, 0.05, COL.gold, -3, 2.3, -1.3, stage, 14);
  box(1.8, 0.15, 0.6, COL.dark, 2.5, 2.0, -1, stage); box(0.1, 0.9, 0.1, COL.metal, 2.5, 1.1, -1, stage);
  for (const x of [-0.5, 1]) { cyl(0.03, 0.03, 1.6, COL.metal, x, 1.1, 1.4, stage, 5); }
  // spotlight beams (additive, animated colors)
  const beamMats = [];
  [-4.5, -1.5, 1.5, 4.5].forEach((x, i) => {
    const m = new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 16, 1, true), m);
    beam.position.set(x, 4.1, 2.6); beam.rotation.x = 0.18; stage.add(beam); beamMats.push(m); disposables.push(m, beam.geometry);
    box(0.4, 0.4, 0.5, COL.dark, x, 6.8, 3, stage);
  });
  // stage musicians (simple)
  const musicians = [];
  [[-2.2, -0.4], [2.5, -0.2], [-0.5, 1.6], [1, 1.6]].forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 1.15, z); stage.add(g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 8), M(['#2f3b59', '#7a2e3b', '#f2f2f2', '#3d5a40'][i])), g).position.y = 0.4;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), M(SKINS[i % 4])), g).position.y = 1.05;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(HAIRS[i % 4])), g).position.y = 1.1;
    musicians.push(g);
  });
  // floating music notes
  const notes = [];
  const noteTex = canvasTex((g, w, h) => { g.clearRect(0, 0, w, h); g.font = '700 100px serif'; g.fillStyle = '#7a4fd1'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', w / 2, h / 2); }, 128, 128);
  for (let i = 0; i < 7; i++) {
    const sm = new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false }); disposables.push(sm);
    const s = new THREE.Sprite(sm); s.scale.set(1.1, 1.1, 1); s.userData = { t: Math.random() * 4, x: -5 + Math.random() * 10 }; stage.add(s); notes.push(s);
  }

  // tables in groups (InstancedMesh)
  const tableSpots = [];
  for (const x of [-3.5, 2, 7.5]) for (const z of [-3.2, 0.8, 4.6]) tableSpots.push([x, z]);
  const CHAIRS_PER = 6;
  const iTop = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 14), M(COL.cloth), tableSpots.length);
  const iLeg = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.3, 0.75, 8), M(COL.woodD), tableSpots.length);
  const iSeat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), M(COL.wood), tableSpots.length * CHAIRS_PER);
  const iBack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.6, 0.08), M(COL.wood), tableSpots.length * CHAIRS_PER);
  const iCenter = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), M('#f28b82'), tableSpots.length);
  [iTop, iLeg, iSeat, iBack, iCenter].forEach(m => { m.castShadow = true; m.receiveShadow = true; world.add(m); disposables.push(m.geometry); });
  const d = new THREE.Object3D();
  const seatPositions = [];
  tableSpots.forEach(([x, z], ti) => {
    d.position.set(x, 0.8, z); d.rotation.set(0, 0, 0); d.updateMatrix(); iTop.setMatrixAt(ti, d.matrix);
    d.position.set(x, 0.38, z); d.updateMatrix(); iLeg.setMatrixAt(ti, d.matrix);
    d.position.set(x, 0.98, z); d.updateMatrix(); iCenter.setMatrixAt(ti, d.matrix);
    iCenter.setColorAt(ti, new THREE.Color(['#f28b82', '#fbbc04', '#c58af9'][ti % 3]));
    for (let c = 0; c < CHAIRS_PER; c++) {
      const a = (c / CHAIRS_PER) * Math.PI * 2 + ti * 0.3;
      const cx = x + Math.cos(a) * 1.45, cz = z + Math.sin(a) * 1.45;
      d.position.set(cx, 0.45, cz); d.rotation.set(0, -a + Math.PI / 2, 0); d.updateMatrix(); iSeat.setMatrixAt(ti * CHAIRS_PER + c, d.matrix);
      d.position.set(x + Math.cos(a) * 1.7, 0.75, z + Math.sin(a) * 1.7); d.updateMatrix(); iBack.setMatrixAt(ti * CHAIRS_PER + c, d.matrix);
      seatPositions.push({ x: cx, z: cz, face: Math.atan2(x - cx, z - cz), table: ti, back: [x + Math.cos(a) * 1.7, z + Math.sin(a) * 1.7] });
    }
  });

  // string lights + bunting from truss to plaza poles
  const bulbPts = [], flagPts = [];
  const poles = [[-7, 7], [11, 7], [-7, -6.5], [11, -6.5]];
  poles.forEach(([x, z]) => cyl(0.08, 0.1, 5, COL.woodD, x, 0, z, world, 6));
  const spans = [[[-4.6, 7.2, -7], [-7, 5, 7]], [[8.6, 7.2, -7], [11, 5, 7]], [[-7, 5, 7], [11, 5, 7]], [[-4.6, 7.2, -7], [11, 5, 7]], [[8.6, 7.2, -7], [-7, 5, 7]], [[-7, 5, -6.5], [11, 5, -6.5]]];
  spans.forEach(([a, b], si) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const n = Math.round(A.distanceTo(B) / 0.9);
    for (let i = 1; i < n; i++) {
      const t = i / n; const p = A.clone().lerp(B, t); p.y -= Math.sin(Math.PI * t) * 1.2;
      (i % 2 === 0 ? bulbPts : flagPts).push({ p, si, i });
    }
  });
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe08a' }); disposables.push(bulbMat);
  const iBulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 4), bulbMat, bulbPts.length);
  bulbPts.forEach(({ p }, i) => { d.position.copy(p); d.rotation.set(0, 0, 0); d.updateMatrix(); iBulb.setMatrixAt(i, d.matrix); });
  const iFlag = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.45, 3), M('#ffffff'), flagPts.length);
  flagPts.forEach(({ p, i }, k) => { d.position.copy(p).add(new THREE.Vector3(0, -0.2, 0)); d.rotation.set(Math.PI, 0, 0); d.updateMatrix(); iFlag.setMatrixAt(k, d.matrix); iFlag.setColorAt(k, new THREE.Color(SHIRTS[(i + k) % SHIRTS.length])); });
  [iBulb, iFlag].forEach(m => { world.add(m); disposables.push(m.geometry); });

  // ---------- Entrance arch ----------
  const arch = new THREE.Group(); arch.position.set(0, 0, 21); world.add(arch);
  for (const x of [-2.6, 2.6]) { box(0.8, 4.4, 0.8, COL.white, x, 0, 0, arch); box(1, 0.3, 1, COL.gold, x, 4.4, 0, arch); }
  const archSign = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.1, 0.4), [M(COL.roof1), M(COL.roof1), M(COL.gold), M(COL.roof1),
  new THREE.MeshStandardMaterial({ map: textTex('วัดลานคา · บวชนาคมังกร', '#c8442f', '#ffe7a8', '600 46px Prompt', 768, 128) }), M(COL.roof1)]);
  archSign.position.set(0, 4.95, 0); archSign.castShadow = true; arch.add(archSign); disposables.push(archSign.geometry);
  const archRoof = add(prism(7.4, 1.1, 1.2, COL.roof2), arch); archRoof.position.y = 5.5;

  // ---------- Nature ----------
  const trees = [];
  const treeSpots = [
    // Left perimeter & back
    [-34, -22], [-29, -24], [-35, -13], [-34, -2], [-34, 8], [-34, 20], [-27, -19], [-24, 15],
    // Back center
    [-17, -23], [-10, -24], [-3, -25], [4, -24], [10, -22],
    // Right perimeter (curving gracefully around stage)
    [15, -18], [17, -9], [17, 1], [16, 10], [14, 18],
    // Front perimeter & entrance flanking
    [9, 23], [-10, 23], [-17, 23], [-6, 14], [6, 14], [-10, 12], [11, 13]
  ];
  treeSpots.forEach(([x, z], i) => {
    if (i % 4 === 0) { // palm
      const trunk = cyl(0.14, 0.22, 4.2, COL.trunk, x, 0, z, world, 6); trunk.rotation.z = 0.08;
      for (let k = 0; k < 6; k++) {
        const leaf = box(0.5, 0.06, 2.4, COL.leaf, x, 4.1, z); leaf.geometry.translate(0, 0, 1.1);
        leaf.rotation.set(0.45, (k / 6) * Math.PI * 2, 0);
      }
    } else {
      const s = 0.8 + Math.random() * 0.7;
      cyl(0.18 * s, 0.25 * s, 1.4 * s, COL.trunk, x, 0, z, world, 6);
      const f = add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * s, 0), M(i % 3 ? COL.leaf : COL.leaf2)));
      f.position.set(x, 2.2 * s, z); f.rotation.y = Math.random() * 3; trees.push(f);
      if (i % 2) { const f2 = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), M(COL.leaf2))); f2.position.set(x + 0.4, 3.2 * s, z - 0.3); }
    }
  });
  // bushes & flowers
  const bushSpots = [];
  for (let i = 0; i < 35; i++) {
    const x = (GCX - GW / 2 + 2) + Math.random() * (GW - 4);
    const z = -GD / 2 + 3 + Math.random() * (GD - 6);
    if (Math.abs(z - 8) < 2.5 || (x > -26 && x < -10 && z > -16 && z < 6) || (x > -7 && x < 12 && z > -14 && z < 7) || (Math.abs(x) < 3 && z > 8)) continue;
    bushSpots.push([x, z]);
    const b = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.3, 0), M(COL.leaf2))); b.position.set(x, 0.35, z);
    if (i % 2) { const fl = add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), M(['#f9a8c0', '#ffe28a', '#ffffff', '#f28b82'][i % 4])), world, false); fl.position.set(x + 0.3, 0.75, z + 0.2); }
  }
  // lotus pond
  const pond = add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.1, 20), new THREE.MeshStandardMaterial({ color: COL.water, roughness: 0.2, metalness: 0.1 })), world, false);
  pond.scale.set(1.3, 1, 0.9); pond.position.set(-28, 0.02, 17);
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
    const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 8), M('#5f9a4a')), world, false); pad.position.set(-28 + Math.cos(a) * r * 1.3, 0.1, 17 + Math.sin(a) * r * 0.9);
    if (i % 2) { const lo = add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 6), M('#f7a1c4')), world, false); lo.position.set(pad.position.x, 0.3, pad.position.z); }
  }

  // clouds (drifting, cast soft shadows)
  const clouds = [];
  for (let i = 0; i < 4; i++) {
    const cg = new THREE.Group(); cg.position.set(-36 + i * 18, 18 + Math.random() * 4, -18 + Math.random() * 26); world.add(cg);
    for (let k = 0; k < 4; k++) { const p = add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + Math.random(), 0), M('#ffffff')), cg, true, false); p.position.set(k * 1.5 - 2, Math.random() * 0.6, Math.random() - 0.5); }
    cg.userData.v = 0.6 + Math.random() * 0.5; clouds.push(cg);
  }

  // freeze static matrices for performance
  world.updateMatrixWorld(true);

  // ---------- Guests (InstancedMesh pool: 300) ----------
  const gBody = new THREE.CylinderGeometry(0.17, 0.25, 0.62, 8); gBody.translate(0, 0.31, 0);
  const gHead = new THREE.SphereGeometry(0.22, 10, 8); gHead.translate(0, 0.86, 0);
  const gHair = new THREE.SphereGeometry(0.235, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.1); gHair.translate(0, 0.9, -0.01);
  disposables.push(gBody, gHead, gHair);
  const whiteM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }); disposables.push(whiteM);
  const iBody = new THREE.InstancedMesh(gBody, whiteM, CFG.supported);
  const iHead = new THREE.InstancedMesh(gHead, whiteM, CFG.supported);
  const iHair = new THREE.InstancedMesh(gHair, whiteM, CFG.supported);
  [iBody, iHead, iHair].forEach(m => { m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.add(m); });

  const rand = (a, b) => a + Math.random() * (b - a);
  const nearTable = (x, z) => tableSpots.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 2.0);
  // ME position + reserved activity spot — guests keep clear of both
  const meAvoid = { x: 1e4, z: 1e4, rx: 1e4, rz: 1e4 };
  const ME_CLEAR = 0.65;
  const nearMe = (x, z) => Math.hypot(x - meAvoid.x, z - meAvoid.z) < ME_CLEAR + 0.35 || Math.hypot(x - meAvoid.rx, z - meAvoid.rz) < 1.1;
  const pickIn = (b, zoneId) => {
    for (let k = 0; k < 12; k++) { const x = rand(...b.x), z = rand(...b.z); if ((zoneId !== 'stage' || !nearTable(x, z)) && !nearMe(x, z)) return [x, z]; }
    return [rand(...b.x), rand(...b.z)];
  };
  const agents = [];
  const seatPool = seatPositions.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < CFG.supported; i++) {
    const r = Math.random();
    let zone = r < 0.4 ? ZONES[0] : r < 0.85 ? ZONES[1] : null;
    const b = zone ? zone.bounds : PATH_BOUNDS;
    const seat = zone?.id === 'stage' && Math.random() < 0.45 ? seatPool.pop() : null;
    const [x, z] = seat ? [seat.x, seat.z] : pickIn(b, zone?.id);
    agents.push({
      zone: zone?.id || 'path', b, x, z, tx: x, tz: z, face: seat ? seat.face : Math.random() * 6.28,
      seat, speed: rand(0.9, 1.7), idle: rand(0, 3), phase: Math.random() * 10, scale: rand(0.9, 1.08),
      photo: !seat && Math.random() < 0.1,
    });
    iBody.setColorAt(i, new THREE.Color(SHIRTS[i % SHIRTS.length]));
    iHead.setColorAt(i, new THREE.Color(SKINS[i % SKINS.length]));
    iHair.setColorAt(i, new THREE.Color(HAIRS[i % HAIRS.length]));
  }
  [iBody, iHead, iHair].forEach(m => { m.instanceColor.needsUpdate = true; });
  // shuffle so any visible subset is distributed across zones
  agents.sort(() => Math.random() - 0.5);

  const visible = 50;
  let meSeat = null, meTable = null; // chair currently claimed by ME
  const seatTaken = (seat) => { for (let i = 0; i < visible; i++) if (agents[i].seat === seat) return true; return false; };
  /** a guest that becomes visible on ME's chair stands up and wanders instead (no overlap) */
  const freeSeatFor = (seat) => {
    for (let i = 0; i < visible; i++) {
      const a = agents[i];
      if (a.seat !== seat) continue;
      a.seat = null; [a.x, a.z] = pickIn(a.b, a.zone); a.tx = a.x; a.tz = a.z; a.idle = rand(0.5, 2);
    }
  };
  [iBody, iHead, iHair].forEach(m => { m.count = visible; });

  const dummy = new THREE.Object3D();
  function updateAgents(dt, t) {
    for (let i = 0; i < visible; i++) {
      const a = agents[i];
      let bob = 0;
      if (a.seat) {
        bob = 0.25 + Math.abs(Math.sin(t * 2 + a.phase)) * 0.03; // seated (raised to chair height, gentle sway)
      } else if (a.idle > 0) {
        a.idle -= dt;
        bob = Math.abs(Math.sin(t * 3 + a.phase)) * 0.02;
        if (a.idle <= 0) { [a.tx, a.tz] = pickIn(a.b, a.zone); }
      } else {
        const dx = a.tx - a.x, dz = a.tz - a.z, dist = Math.hypot(dx, dz);
        if (dist < 0.08) { a.idle = rand(1.5, a.photo ? 6 : 4); }
        else {
          const step = Math.min(dist, a.speed * dt);
          a.x += (dx / dist) * step; a.z += (dz / dist) * step;
          const target = Math.atan2(dx, dz);
          let diff = target - a.face; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          a.face += diff * Math.min(1, dt * 8);
          bob = Math.abs(Math.sin(t * 10 + a.phase)) * 0.09;
        }
      }
      if (!a.seat) {
        // yield to ME: step aside and never target ME's spot
        const mdx = a.x - meAvoid.x, mdz = a.z - meAvoid.z, md = Math.hypot(mdx, mdz);
        if (md < ME_CLEAR) {
          if (md > 1e-4) { a.x = meAvoid.x + (mdx / md) * ME_CLEAR; a.z = meAvoid.z + (mdz / md) * ME_CLEAR; } else a.x += ME_CLEAR;
        }
        if (nearMe(a.tx, a.tz)) { [a.tx, a.tz] = pickIn(a.b, a.zone); if (a.idle <= 0) a.idle = 0; }
      }
      dummy.position.set(a.x, 0.07 + bob, a.z);
      dummy.rotation.set(0, a.face, 0);
      dummy.scale.setScalar(a.scale * (a.seat ? 0.92 : 1));
      dummy.updateMatrix();
      iBody.setMatrixAt(i, dummy.matrix); iHead.setMatrixAt(i, dummy.matrix); iHair.setMatrixAt(i, dummy.matrix);
    }
    iBody.instanceMatrix.needsUpdate = true; iHead.instanceMatrix.needsUpdate = true; iHair.instanceMatrix.needsUpdate = true;
  }

  // ---------- Zone hit areas + HTML labels ----------
  const hitMeshes = ZONES.map(z => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...z.hit.s), new THREE.MeshBasicMaterial());
    m.position.set(...z.hit.c); m.visible = false; m.userData.zone = z; scene.add(m); disposables.push(m.geometry, m.material);
    return m;
  });
  const labels = ZONES.map(z => {
    const b = document.createElement('button');
    b.className = 'map-label'; b.id = `zone-label-${z.id}`;
    b.innerHTML = `<span>${z.ico}</span>${z.short}<span class="cnt">${z.tag}</span>`;
    b.addEventListener('click', ev => { ev.stopPropagation(); openZone(z); }); // label = info card
    labelsEl.appendChild(b);
    return { el: b, pos: new THREE.Vector3(...z.label) };
  });
  // per-table interaction zones (tables + chairs) — checked before the wide stage zone
  const tableHits = tableSpots.map(([x, z], ti) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 1.5, 16), new THREE.MeshBasicMaterial());
    m.position.set(x, 0.75, z); m.visible = false; m.userData.table = ti; scene.add(m); disposables.push(m.geometry, m.material);
    return m;
  });

  // ---------- Navigation grid (walkable area minus obstacles) ----------
  const nav = new NavGrid({ minX: GCX - GW / 2 + 1, maxX: GCX + GW / 2 - 1, minZ: -GD / 2 + 1, maxZ: GD / 2 - 1, cell: 0.35 });
  const PAD = 0.24; // ME body radius
  nav.blockRect(-25.5, -10.5, -15.5, 3.5, PAD);                                   // temple platform, hall, columns, walls
  nav.blockCircle(-18, 2.6, 1.5, PAD);                                            // monk mascot pedestal
  [[-27, 5.5], [-9, 5.5]].forEach(([x, z]) => nav.blockCircle(x, z, 0.12, PAD));  // flag poles
  nav.blockRect(-4.5, 8.5, -13.25, -6.75, PAD);                                   // stage deck + truss
  nav.blockRect(0.8, 3.2, -6.75, -5.4, PAD);                                      // stage stairs
  for (const x of [-5.6, 9.6]) nav.blockRect(x - 0.65, x + 0.65, -8, -6.8, PAD);  // floor speakers
  poles.forEach(([x, z]) => nav.blockCircle(x, z, 0.12, PAD));                    // light poles
  tableSpots.forEach(([x, z]) => nav.blockCircle(x, z, 1.0, PAD));                // tables
  seatPositions.forEach(s => { nav.blockCircle(s.x, s.z, 0.27, PAD); nav.blockCircle(s.back[0], s.back[1], 0.27, PAD); }); // chairs
  treeSpots.forEach(([x, z], i) => nav.blockCircle(x, z, i % 4 === 0 ? 0.25 : 0.4, PAD));
  bushSpots.forEach(([x, z]) => nav.blockCircle(x, z, 0.55, PAD));
  nav.blockEllipse(-28, 17, 5.2, 3.6, PAD);                                       // lotus pond
  for (const x of [-2.6, 2.6]) nav.blockRect(x - 0.4, x + 0.4, 20.6, 21.4, PAD);  // entrance arch pillars

  // real ground height under ME (raycast against walkable surfaces)
  const downRay = new THREE.Raycaster(); downRay.far = 6;
  const DOWN = new THREE.Vector3(0, -1, 0), _origin = new THREE.Vector3();
  const groundY = (x, z) => { _origin.set(x, 3, z); downRay.set(_origin, DOWN); const h = downRay.intersectObjects(walkables, false)[0]; return h ? h.point.y : 0; };

  // ---------- Personal character: ME (created exactly once per map instance) ----------
  const pageEl = el.querySelector('#map-page');
  const statusIco = el.querySelector('#me-status-ico'), statusText = el.querySelector('#me-status-text');
  const showStatus = (s) => {
    const [ico, txt] = ME_STATUS[s] || ME_STATUS[ME_STATE.IDLE];
    statusIco.textContent = ico; statusText.innerHTML = txt;
    pageEl.dataset.meState = s;
    const box = el.querySelector('#me-status'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    if (s === ME_STATE.PRAYING || s === ME_STATE.DANCING || s === ME_STATE.EATING) {
      triggerActivityCloseUp(me.kind);
    }
  };
  const myTicket = await getMyTicket();
  if (seq !== renderSeq || !el.isConnected) return;
  const me = createMe({
    scene, nav, groundY,
    start: [-3, 8.3],
    startFace: Math.PI / 4,
    onState: showStatus,
    name: myTicket?.fullName || 'ME',
  });
  showStatus(ME_STATE.IDLE);

  const SPOTS = {
    church: { kind: 'church', key: 'church', x: -18, z: 5.3, face: Math.PI },               // in front of the monk / temple steps
    stage: { kind: 'stage', key: 'stage', x: -0.8, z: -5.2, face: Math.atan2(2.8, -4.8) },  // dance floor in front of the stage (not on it)
  };
  const blockedToast = () => toast('ME ยังไปจุดนั้นไม่ได้ ลองแตะที่อื่นนะ', 'error');
  function applyCommand(res, target, seat = null, table = null) {
    if (res !== 'ok') return res;
    meSeat = seat; meTable = table;
    meAvoid.rx = target.x; meAvoid.rz = target.z;
    if (seat) freeSeatFor(seat);
    startFollow();
    return res;
  }
  function commandSpot(spot) {
    const res = me.goTo(spot);
    if (res === 'blocked') blockedToast();
    else if (res === 'same') triggerActivityCloseUp(spot.kind);
    return applyCommand(res, spot);
  }
  function commandDining(ti, point) {
    if (me.kind === 'dining' && meTable === ti) {
      triggerActivityCloseUp('dining');
      return 'same';
    }
    const cands = seatPositions
      .map((s, i) => ({ s, i, d: Math.hypot(s.x - point.x, s.z - point.z) + (s.table === ti ? 0 : 2.5) }))
      .sort((a, b) => a.d - b.d);
    let tries = 0;
    for (const { s, i } of cands) {
      if (seatTaken(s)) continue;              // occupied → next closest chair
      if (++tries > 8) break;
      const allow = (x, z) => Math.hypot(x - s.x, z - s.z) < 0.62 && Math.hypot(x - s.back[0], z - s.back[1]) > 0.32;
      const target = { kind: 'dining', key: `seat-${i}`, x: s.x, z: s.z, face: s.face, sit: true, allow };
      const res = me.goTo(target);
      if (res !== 'blocked') return applyCommand(res, target, s, s.table);
    }
    // no free chair → safe standing spot beside the table, out of the way
    const [tx, tz] = tableSpots[ti];
    const a0 = Math.atan2(point.z - tz, point.x - tx);
    for (let k = 0; k < 12; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
      const x = tx + Math.cos(a) * 2.5, z = tz + Math.sin(a) * 2.5;
      if (!nav.isFree(x, z)) continue;
      const target = { kind: 'dining', key: `stand-${ti}-${k}`, x, z, face: Math.atan2(tx - x, tz - z), sit: false };
      const res = me.goTo(target);
      if (res !== 'blocked') return applyCommand(res, target, null, ti);
    }
    blockedToast();
    return 'blocked';
  }

  // ---------- Camera helpers & Follow System ----------
  const DEFAULT_ZOOM = isMobile ? 1.5 : 1.0;
  const WALK_ZOOM = isMobile ? 1.55 : 1.38;
  const CLOSE_ZOOM = {
    church: isMobile ? 3.3 : 2.7,
    stage:  isMobile ? 3.3 : 2.7,
    dining: isMobile ? 3.3 : 2.8,
  };
  const ACTIVITY_LEAD = {
    church: 1.2,
    stage:  1.5,
    dining: 0.9,
  };

  let anim = null;
  function flyTo(target, zoom, offset = camera.position.clone().sub(controls.target)) {
    anim = {
      t: 0, dur: 0.9,
      fromT: controls.target.clone(), toT: new THREE.Vector3(...target),
      fromO: camera.position.clone().sub(controls.target), toO: offset,
      fromZ: camera.zoom, toZ: zoom,
    };
  }
  const goHome = () => flyTo(getHomeTarget().toArray(), DEFAULT_ZOOM, getHomeOffset());
  function rotateBy(rad) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    flyTo(controls.target.toArray(), camera.zoom, off);
  }

  // Camera Follow State
  let followActive = false;
  let followState = 'idle'; // 'walking' | 'activity' | 'settled' | 'idle'
  let isUserInteracting = false;
  let followDesiredZoom = DEFAULT_ZOOM;
  let shouldAdjustZoom = false;
  let settleElapsed = 0;

  controls.addEventListener('start', () => {
    isUserInteracting = true;
    shouldAdjustZoom = false; // respect user manual zoom during interactions
  });
  controls.addEventListener('end', () => {
    isUserInteracting = false;
  });

  function startFollow() {
    followActive = true;
    followState = 'walking';
    settleElapsed = 0;
    anim = null; // stop any ongoing overview flyTo so follow takes over smoothly
    followDesiredZoom = (isMobile && me.kind) ? (CLOSE_ZOOM[me.kind] || 3.3) : WALK_ZOOM;
    shouldAdjustZoom = true;
  }

  function triggerActivityCloseUp(kind) {
    followActive = true;
    followState = 'activity';
    settleElapsed = 0;
    anim = null;
    followDesiredZoom = CLOSE_ZOOM[kind] || (isMobile ? 3.3 : 2.7);
    shouldAdjustZoom = true;
  }

  function stopFollow() {
    followActive = false;
    followState = 'idle';
  }

  const _camDir = new THREE.Vector3();
  const _desiredTarget = new THREE.Vector3();

  function updateCameraFollow(dt) {
    if (!followActive) return;
    if (anim) return; // allow user manual flyTo / rotation animations to play out without fighting

    const isWalking = me.state === ME_STATE.WALKING_TO_CHURCH ||
                      me.state === ME_STATE.WALKING_TO_STAGE ||
                      me.state === ME_STATE.WALKING_TO_DINING;

    const isActivity = me.state === ME_STATE.PRAYING ||
                       me.state === ME_STATE.DANCING ||
                       me.state === ME_STATE.EATING;

    if (isWalking) {
      followState = 'walking';
      settleElapsed = 0;
      followDesiredZoom = (isMobile && me.kind) ? (CLOSE_ZOOM[me.kind] || 3.3) : WALK_ZOOM;
      shouldAdjustZoom = true;
    } else if (isActivity) {
      if (followState !== 'activity' && followState !== 'settled') {
        followState = 'activity';
        settleElapsed = 0;
        followDesiredZoom = CLOSE_ZOOM[me.kind] || (isMobile ? 3.3 : 2.7);
        shouldAdjustZoom = true;
      }
    }

    // Lead vector: projects in camera's ground forward direction so ME stays in lower-center of viewport
    camera.getWorldDirection(_camDir);
    _camDir.y = 0;
    if (_camDir.lengthSq() > 0.0001) _camDir.normalize();

    let lead = 1.8;
    if (followState === 'walking') {
      lead = isMobile ? 2.2 : 1.8;
    } else if (me.kind === 'church') {
      lead = 1.2;
    } else if (me.kind === 'stage') {
      lead = 1.5;
    } else if (me.kind === 'dining') {
      lead = 0.9;
    } else {
      lead = 1.2;
    }

    const my = Number.isFinite(me.y) ? me.y : 0;
    _desiredTarget.set(me.x, my + 0.6, me.z).addScaledVector(_camDir, lead);

    // Smooth exponential damping (fluid tracking without warping)
    const lambda = isUserInteracting ? 2.2 : (followState === 'walking' ? 4.2 : 3.2);
    const factor = 1 - Math.exp(-lambda * dt);

    const dx = (_desiredTarget.x - controls.target.x) * factor;
    const dy = (_desiredTarget.y - controls.target.y) * factor;
    const dz = (_desiredTarget.z - controls.target.z) * factor;

    if (Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dz)) {
      controls.target.x += dx;
      controls.target.y += dy;
      controls.target.z += dz;

      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }

    // Smooth zoom adjustment
    if (shouldAdjustZoom && !isUserInteracting) {
      const zDiff = followDesiredZoom - camera.zoom;
      if (Math.abs(zDiff) > 0.01) {
        camera.zoom += zDiff * (1 - Math.exp(-3.0 * dt));
        camera.updateProjectionMatrix();
      } else {
        shouldAdjustZoom = false;
      }
    }

    if (followState === 'activity') {
      settleElapsed += dt;
      const dist = Math.hypot(_desiredTarget.x - controls.target.x, _desiredTarget.z - controls.target.z);
      if (settleElapsed > 2.0 && dist < 0.08 && !shouldAdjustZoom) {
        followState = 'settled';
        followActive = false; // settled in close-up: user can freely orbit around ME
      }
    }
  }

  // Click "📍 คลิ๊กเพื่อดู ME": Zoom in to close-up focus on ME (or toggle overview if already zoomed in close)
  el.querySelector('#me-focus').addEventListener('click', () => {
    stopFollow();
    const my = Number.isFinite(me.y) ? me.y : 0;
    const isActivity = me.state === ME_STATE.PRAYING || me.state === ME_STATE.DANCING || me.state === ME_STATE.EATING;
    const focusZoom = CLOSE_ZOOM[me.kind] || (isMobile ? 3.3 : 2.7);

    // If already zoomed in close (> 2.6 on mobile, > 2.0 on desktop), toggle back to overview; otherwise zoom in all the way to focus on ME
    const targetZoom = (camera.zoom > (isMobile ? 2.6 : 2.0)) ? DEFAULT_ZOOM : focusZoom;

    let tx = me.x, tz = me.z;
    if (targetZoom > 1.5) {
      camera.getWorldDirection(_camDir);
      _camDir.y = 0;
      if (_camDir.lengthSq() > 0.0001) _camDir.normalize();
      const lead = isActivity ? (ACTIVITY_LEAD[me.kind] || 1.2) : 0.8;
      tx += _camDir.x * lead;
      tz += _camDir.z * lead;
    }

    flyTo([tx, my + 0.6, tz], targetZoom);
  });

  const today = new Date();
  const isEventDay = today.toDateString() === new Date(EVENT.date).toDateString();
  function openZone(z) {
    stopFollow();
    labels.forEach((l, i) => l.el.classList.toggle('active', ZONES[i] === z));
    const nowMin = today.getHours() * 60 + today.getMinutes();
    const idx = isEventDay ? z.steps.reduce((acc, [, t], i) => { const [h, m] = t.split(':').map(Number); return nowMin >= h * 60 + m ? i : acc; }, -1) : -1;
    sheet.innerHTML = `
      <div class="zs-head">
        <div class="zs-ico" style="background:${z.color}">${z.ico}</div>
        <div><h3>${z.name}</h3><span class="badge" style="margin-top:4px">${z.tag}</span></div>
        <button class="close" id="zone-close" aria-label="ปิด">✕</button>
      </div>
      <p>${z.desc}</p>
      <div class="zs-timeline">
        ${z.steps.map(([n, t], i) => `<div class="tp ${i < idx ? 'done' : ''} ${i === idx ? 'done now' : ''}"><i></i><b style="color:var(--cocoa)">${n}</b>${t}</div>`).join('')}
      </div>
      <p style="font-size:11px;color:var(--muted)">${isEventDay ? 'อัปเดตตามเวลาจริง' : 'กำหนดการตัวอย่าง · รอยืนยันจากทีมงาน'}</p>`;
    sheet.classList.add('open');
    sheet.querySelector('#zone-close').addEventListener('click', closeZone);
    flyTo(z.focus, isMobile ? 1.7 : 1.9);
  }
  function closeZone() { sheet.classList.remove('open'); labels.forEach(l => l.el.classList.remove('active')); }

  el.querySelector('#mc-zoom-in').onclick = () => { shouldAdjustZoom = false; flyTo(controls.target.toArray(), Math.min(controls.maxZoom, camera.zoom * 1.35)); };
  el.querySelector('#mc-zoom-out').onclick = () => { shouldAdjustZoom = false; flyTo(controls.target.toArray(), Math.max(controls.minZoom, camera.zoom / 1.35)); };
  el.querySelector('#mc-rot-l').onclick = () => rotateBy(Math.PI / 4);
  el.querySelector('#mc-rot-r').onclick = () => rotateBy(-Math.PI / 4);
  el.querySelector('#mc-home').onclick = () => { stopFollow(); closeZone(); goHome(); };

  // click / tap on 3D scene → character command (drags, pinches & right-clicks are camera gestures)
  const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const t = raycaster.intersectObjects(tableHits, false)[0];
    if (t) return { type: 'dining', table: t.object.userData.table, point: t.point };
    const z = raycaster.intersectObjects(hitMeshes, false)[0];
    if (z) return { type: z.object.userData.zone.id === 'temple' ? 'church' : 'stage' };
    return null;
  }
  function handleTap(clientX, clientY) {
    const p = pick(clientX, clientY);
    closeZone(); // close the location detail card and command ME in the same tap
    if (!p) return;
    if (p.type === 'church') commandSpot(SPOTS.church);
    else if (p.type === 'stage') commandSpot(SPOTS.stage);
    else commandDining(p.table, p.point);
  }
  const pointers = new Set();
  let downAt = null, multiTouch = false, hoverAt = null;
  const onDown = e => {
    pointers.add(e.pointerId);
    if (pointers.size > 1) { multiTouch = true; downAt = null; } else { multiTouch = false; downAt = [e.clientX, e.clientY]; }
    anim = null;
  };
  const onUp = e => {
    pointers.delete(e.pointerId);
    const start = downAt; downAt = null;
    if (multiTouch) { if (!pointers.size) multiTouch = false; return; }
    if (!start || !e.isPrimary || e.button > 0) return;
    const tol = e.pointerType === 'mouse' ? 6 : 12;
    if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) > tol) return;
    handleTap(e.clientX, e.clientY);
  };
  const onCancel = e => { pointers.delete(e.pointerId); downAt = null; if (!pointers.size) multiTouch = false; };
  const onMove = e => {
    if (e.pointerType === 'mouse' && !e.buttons) {
      hoverAt = [e.clientX, e.clientY];
      renderer.domElement.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'default';
    }
  };
  const onLeave = () => { renderer.domElement.style.cursor = 'default'; };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onCancel);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', onLeave);

  // ---------- Resize ----------
  const VIEW = 40;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    let vh;
    if (aspect < 1) {
      // Mobile portrait mode: ensure temple and monk mascot are prominently framed
      const targetHSpan = 30;
      vh = targetHSpan / aspect;
    } else {
      vh = VIEW * 0.48;
    }
    camera.left = -vh * aspect / 2; camera.right = vh * aspect / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // ---------- Stats (from data service, not characters) ----------
  recordVisit();
  const applyStats = async s => {
    const visitors = el.querySelector('#hs-visitors');
    const chk = el.querySelector('#hs-chk');

    if (visitors) countUp(visitors, s.visitors || 0);
    if (chk) countUp(chk, s.checkedIn || 0);

    const latestTicket = await getMyTicket();
    me.setName(latestTicket?.fullName || 'ME');
  };
  applyStats(await getStats());
  const offStats = onStats(applyStats);

  const clockEl = el.querySelector('#map-clock');
  const clockTick = () => { clockEl.textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); };
  clockTick(); const clockTimer = setInterval(clockTick, 15000);

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  const v3 = new THREE.Vector3();
  const beamHues = [0.08, 0.75, 0.55, 0.95];
  let raf = 0, running = true;
  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

    if (anim) {
      anim.t += dt / anim.dur; const k = anim.t >= 1 ? 1 : 1 - Math.pow(1 - anim.t, 3);
      controls.target.lerpVectors(anim.fromT, anim.toT, k);
      v3.lerpVectors(anim.fromO, anim.toO, k);
      camera.position.copy(controls.target).add(v3);
      camera.zoom = anim.fromZ + (anim.toZ - anim.fromZ) * k; camera.updateProjectionMatrix();
      if (anim.t >= 1) anim = null;
    }
    controls.update();

    // monk: idle bob + periodic wai bow
    const cyc = t % 7;
    monkBody.rotation.x = cyc > 5.5 ? Math.sin(((cyc - 5.5) / 1.5) * Math.PI) * 0.35 : 0;
    monkBody.position.y = Math.sin(t * 2) * 0.05;
    halo.rotation.z = t * 0.5; halo.material.opacity = 0.45 + Math.sin(t * 2) * 0.25;

    // stage
    beamMats.forEach((m, i) => m.color.setHSL((beamHues[i] + t * 0.08) % 1, 0.9, 0.65));
    screenMat.emissive.setHSL((t * 0.05) % 1, 0.7, 0.45);
    musicians.forEach((m, i) => { m.position.y = 1.15 + Math.abs(Math.sin(t * 4 + i)) * 0.12; m.rotation.y = Math.sin(t * 2 + i) * 0.3; });
    notes.forEach(n => { n.userData.t += dt; const p = (n.userData.t % 4) / 4; n.position.set(n.userData.x + Math.sin(p * 6) * 0.6, 3 + p * 6, 2); n.material.opacity = Math.sin(p * Math.PI); });
    bulbMat.color.setHSL(0.13, 1, 0.68 + Math.sin(t * 3) * 0.08);

    clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 26) c.position.x = -38; });
    trees.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.2 + i) * 0.03; });

    me.update(dt, t, camera);
    meAvoid.x = me.x; meAvoid.z = me.z;
    updateAgents(dt, t);

    updateCameraFollow(dt);

    renderer.render(scene, camera);

    // labels
    const w = container.clientWidth, h = container.clientHeight;
    labels.forEach(l => {
      v3.copy(l.pos).project(camera);
      l.el.style.left = ((v3.x + 1) / 2 * w) + 'px';
      l.el.style.top = ((1 - v3.y) / 2 * h) + 'px';
      l.el.style.opacity = Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05 ? 0 : 1;
    });
  }
  frame();
  setTimeout(() => el.querySelector('#map-loading')?.classList.add('hide'), 250);

  // pause when tab hidden
  const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running) { running = true; clock.getDelta(); frame(); } };
  document.addEventListener('visibilitychange', onVis);

  // ---------- Cleanup ----------
  const cleanupFn = () => {
    if (activeCleanup === cleanupFn) activeCleanup = null;
    running = false; cancelAnimationFrame(raf);
    clearInterval(clockTimer); offStats(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    controls.dispose();
    me?.dispose?.();
    disposables.forEach(o => o?.dispose?.());
    [iBody, iHead, iHair, iTop, iLeg, iSeat, iBack, iCenter, iBulb, iFlag].forEach(m => m.dispose());
    renderer.dispose(); renderer.forceContextLoss?.();
  };
  activeCleanup = cleanupFn;
  return cleanupFn;
}
