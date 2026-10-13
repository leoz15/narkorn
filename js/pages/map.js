/**
 * MERIT FEST — 3D Event Map
 * Isometric / cute low-poly diorama with 3 connected zones:
 *   1) โบสถ์ (ordination)  2) เวทีดนตรี + grouped tables  3) ซุ้มอาหาร row
 * - 1 monk mascot in front of the temple (idle / wai animation)
 * - Guest characters: pool supports 300, renders 50–100 via InstancedMesh
 * - Attendance numbers come from the data service, never from character count
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EVENT, getStats, onStats } from '../store.js';
import { countUp } from '../ui.js';

const CFG = { supported: 300, defaultVisible: 80 };

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
    label: [-18, 11, -6], focus: [-18, 0, -2], hit: { c: [-18, 3, -4], s: [16, 8, 20] },
    desc: 'จุดประกอบพิธีอุปสมบท มีพระ Mascot ประจำอยู่หน้าโบสถ์ ผู้ร่วมงานสามารถร่วมอนุโมทนาบุญบริเวณลานหน้าโบสถ์',
    steps: [['แห่นาค', '07:00'], ['ทำขวัญนาค', '08:00'], ['อุปสมบท', '09:30'], ['ถวายเพล', '11:00']],
    bounds: { x: [-24.5, -11.5], z: [1.8, 5.6] }, share: 0.25,
  },
  {
    id: 'stage', name: 'เวทีดนตรี', short: 'เวที', ico: '🎵', color: '#8a6fd1', tag: 'Live',
    label: [2, 8, -10], focus: [2, 0, -3], hit: { c: [2, 2, -3], s: [18, 6, 18] },
    desc: 'เวทีหลักพร้อมระบบแสง สี เสียง ด้านหน้าจัดโต๊ะพร้อมเก้าอี้เป็นกลุ่ม นั่งชมดนตรีและรับประทานอาหารได้',
    steps: [['ดนตรีไทย', '12:00'], ['อะคูสติก', '15:00'], ['วงหลัก', '18:00'], ['ปิดงาน', '21:00']],
    bounds: { x: [-6, 10], z: [-5.5, 6.2] }, share: 0.4,
  },
  {
    id: 'food', name: 'ซุ้มอาหาร', short: 'อาหาร', ico: '🍜', color: '#4f9a6b', tag: '6 ร้าน',
    label: [22, 6.5, 0], focus: [20, 0, 0], hit: { c: [21, 2, 0], s: [8, 6, 30] },
    desc: 'ซุ้มอาหารและเครื่องดื่มหลายร้านเรียงต่อกัน มีพื้นที่ยืนต่อคิว และทางเดินเชื่อมไปยังโซนเวที',
    steps: [['เปิดซุ้ม', '10:00'], ['มื้อกลางวัน', '12:00'], ['ของว่าง', '15:00'], ['มื้อเย็น', '18:00']],
    bounds: { x: [16.2, 19.6], z: [-13, 12] }, share: 0.25,
  },
];
const PATH_BOUNDS = { x: [-28, 28], z: [7.2, 8.8] };

export async function render(el) {
  el.innerHTML = `
  <section class="map-page" id="map-page">
    <div class="map-canvas" id="map-canvas"></div>
    <div class="map-labels" id="map-labels"></div>

    <div class="map-hud">
      <div class="hud-head glass">
        <div class="logo">🛕</div>
        <div><h1>MERIT FEST · แผนที่งาน 3D</h1><p>${EVENT.dateTh} · ${EVENT.venue}</p></div>
        <div class="clock"><span class="dot live" style="color:var(--leaf-d)"></span><span id="map-clock">--:--</span></div>
      </div>
      <div class="hud-stats">
        <div class="hud-stat glass"><div class="k">ลงทะเบียน</div><div class="v"><span id="hs-reg">0</span> <small>คน</small></div></div>
        <div class="hud-stat glass"><div class="k">เช็กอินแล้ว</div><div class="v"><span id="hs-chk">0</span> <small>/ ${EVENT.target}</small></div><div class="bar"><i id="hs-bar" style="width:0%"></i></div></div>
        <div class="hud-stat glass"><div class="k">ตัวละครบนแผนที่</div><div class="v"><span id="hs-chr">0</span> <small>/ ${CFG.supported}</small></div></div>
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

    <div class="map-legend glass">
      <div style="font-weight:600;color:var(--cocoa);margin-bottom:6px">ความหนาแน่นตัวละคร (จำลอง)</div>
      <div style="display:flex;gap:6px" id="density">
        ${[50, 80, 100].map(n => `<button class="btn btn-sm ${n === CFG.defaultVisible ? 'btn-dark' : ''}" data-n="${n}" id="density-${n}">${n}</button>`).join('')}
      </div>
      <div style="margin-top:6px;font-size:11px">* ตัวละครเป็นภาพจำลอง ยอดผู้ร่วมงานจริงดูจากตัวเลขด้านบน</div>
    </div>

    <div class="zone-sheet glass" id="zone-sheet" role="dialog" aria-live="polite"></div>

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
  await document.fonts.ready;

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

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  const HOME_OFFSET = new THREE.Vector3(48, 46, 48);
  camera.position.copy(HOME_OFFSET);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minZoom = 0.7;
  controls.maxZoom = 4;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.15;
  controls.screenSpacePanning = false;
  controls.target.set(0, 0, 0);

  // lights
  scene.add(new THREE.HemisphereLight('#fff6e6', '#8fbf6c', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.2);
  sun.position.set(30, 50, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 40, bottom: -40, near: 1, far: 140 });
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
  box(78, 0.6, 58, COL.grass, 0, -0.6, 0, world, false);
  box(78, 2.4, 58, COL.dirt, 0, -3.0, 0, world, false);
  box(78.2, 0.25, 58.2, COL.dirt2, 0, -3.1, 0, world, false);
  // grass patches for texture
  for (let i = 0; i < 26; i++) {
    const p = box(2 + Math.random() * 4, 0.02, 2 + Math.random() * 4, COL.grass2, -36 + Math.random() * 72, 0, -26 + Math.random() * 52, world, false);
    p.rotation.y = Math.random() * Math.PI;
  }

  // ---------- Paths ----------
  const pathM = M(COL.path);
  box(60, 0.05, 3, pathM, 0, 0, 8, world, false);                // main E–W walkway (connects all zones)
  box(3.5, 0.05, 16, pathM, 0, 0, 17, world, false);             // entrance
  box(3, 0.05, 26, pathM, 18, 0, -1, world, false);              // food walkway
  box(16, 0.06, 13, M(COL.plaza), 2, 0, 0.5, world, false);      // stage plaza
  box(15, 0.07, 5.5, M(COL.stone), -18, 0, 3.6, world, false);   // temple courtyard
  // stepping stones
  for (let i = 0; i < 6; i++) box(1.1, 0.06, 0.8, M(COL.stone), -27 + i * 0.3, 0, 10 + i * 1.3, world, false);

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
  const banner = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 0.1), [M('#c96f1c'), M('#c96f1c'), M('#c96f1c'), M('#c96f1c'),
    new THREE.MeshStandardMaterial({ map: textTex('MERIT FEST ♪', '#e8913a', '#fff', '700 72px Prompt', 768, 110) }), M('#c96f1c')]);
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
      seatPositions.push({ x: cx, z: cz, face: Math.atan2(x - cx, z - cz) });
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

  // ---------- Zone 3: Food stalls (row) ----------
  const SHOPS = [['ก๋วยเตี๋ยว', '#e8913a', '#fff'], ['ข้าวมันไก่', '#f28b82', '#fff'], ['ส้มตำ', '#7fa36b', '#fff'], ['ชาไทย', '#d4701a', '#fff'], ['ขนมไทย', '#c58af9', '#fff'], ['ไอศกรีม', '#8ab4f8', '#fff']];
  SHOPS.forEach(([name, c1], i) => {
    const z = -12.5 + i * 5;
    const g = new THREE.Group(); g.position.set(22, 0, z); world.add(g);
    box(2.4, 0.1, 4.2, '#d9c6a3', 0, 0, 0, g, false);
    box(1.4, 1.05, 3.6, COL.wood, -0.6, 0, 0, g);
    box(1.5, 0.1, 3.7, '#f5ead7', -0.6, 1.05, 0, g);
    box(0.2, 2.2, 3.6, COL.woodD, 0.9, 0, 0, g);
    for (const zz of [-1.9, 1.9]) for (const xx of [-1.3, 0.9]) box(0.14, 2.9, 0.14, COL.woodD, xx, 0, zz, g);
    // striped awning
    const stripe = canvasTex((cx, w, h) => { for (let k = 0; k < 8; k++) { cx.fillStyle = k % 2 ? '#ffffff' : c1; cx.fillRect(0, k * h / 8, w, h / 8); } }, 64, 128);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 4.4), new THREE.MeshStandardMaterial({ map: stripe, roughness: .8 }));
    awn.position.set(-0.4, 3.05, 0); awn.rotation.z = 0.28; awn.castShadow = true; g.add(awn); disposables.push(awn.geometry, awn.material);
    // sign facing the walkway (-x)
    const signM = new THREE.MeshStandardMaterial({ map: textTex(name, '#fffaf0', '#4a3428', '600 64px Prompt') }); disposables.push(signM);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 3.2), [M(COL.woodD), signM, M(COL.woodD), M(COL.woodD), M(COL.woodD), M(COL.woodD)]);
    sign.position.set(-1.0, 3.75, 0); g.add(sign); disposables.push(sign.geometry);
    // food on counter
    for (let k = 0; k < 3; k++) cyl(0.25, 0.2, 0.22, ['#ffcf6b', '#f28b82', '#a7d08c', '#fff'][(i + k) % 4], -0.7, 1.15, -1.1 + k * 1.1, g, 8);
    // lanterns
    for (const zz of [-1.6, 1.6]) { const l = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff7b5c' })), g, false); l.position.set(-1.45, 2.6, zz); }
    // vendor
    const v = new THREE.Group(); v.position.set(0.2, 0.05, 0); g.add(v);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.75, 8), M(c1)), v).position.y = 0.38;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), M(SKINS[i % 4])), v).position.y = 0.98;
  });
  // ambient tables near food
  for (const z of [-8, 2, 10]) { cyl(0.6, 0.6, 0.08, COL.cloth, 13.5, 0.72, z, world, 10); cyl(0.1, 0.2, 0.72, COL.woodD, 13.5, 0, z, world, 6); }

  // ---------- Entrance arch ----------
  const arch = new THREE.Group(); arch.position.set(0, 0, 21); world.add(arch);
  for (const x of [-2.6, 2.6]) { box(0.8, 4.4, 0.8, COL.white, x, 0, 0, arch); box(1, 0.3, 1, COL.gold, x, 4.4, 0, arch); }
  const archSign = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.1, 0.4), [M(COL.roof1), M(COL.roof1), M(COL.gold), M(COL.roof1),
    new THREE.MeshStandardMaterial({ map: textTex('MERIT FEST · งานบวช & ดนตรี', '#c8442f', '#ffe7a8', '600 46px Prompt', 768, 128) }), M(COL.roof1)]);
  archSign.position.set(0, 4.95, 0); archSign.castShadow = true; arch.add(archSign); disposables.push(archSign.geometry);
  const archRoof = add(prism(7.4, 1.1, 1.2, COL.roof2), arch); archRoof.position.y = 5.5;

  // ---------- Nature ----------
  const trees = [];
  const treeSpots = [[-34, -24], [-30, -26], [-36, -14], [-35, -2], [-34, 8], [-8, -24], [-3, -26], [8, -25], [13, -23], [28, -25], [34, -20], [35, -9], [35, 3], [34, 14], [30, 24], [24, 25], [12, 25], [-10, 25], [-17, 24], [-35, 22], [-6, 14], [6, 14], [-10, 12], [11, 13], [27, -16], [27, 16], [-27, -20], [-24, 15]];
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
  for (let i = 0; i < 40; i++) {
    const x = -36 + Math.random() * 72, z = -26 + Math.random() * 52;
    if (Math.abs(z - 8) < 2.5 || (x > -26 && x < -10 && z > -16 && z < 6) || (x > -7 && x < 12 && z > -14 && z < 7) || (x > 16 && x < 25 && z > -15 && z < 14) || (Math.abs(x) < 3 && z > 8)) continue;
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
    const cg = new THREE.Group(); cg.position.set(-40 + i * 24, 18 + Math.random() * 4, -20 + Math.random() * 30); world.add(cg);
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
  const pickIn = (b, zoneId) => {
    for (let k = 0; k < 12; k++) { const x = rand(...b.x), z = rand(...b.z); if (zoneId !== 'stage' || !nearTable(x, z)) return [x, z]; }
    return [rand(...b.x), rand(...b.z)];
  };
  const agents = [];
  const seatPool = seatPositions.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < CFG.supported; i++) {
    const r = Math.random();
    let zone = r < 0.25 ? ZONES[0] : r < 0.65 ? ZONES[1] : r < 0.9 ? ZONES[2] : null;
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

  let visible = CFG.defaultVisible;
  const setVisible = n => {
    visible = Math.max(50, Math.min(100, n));
    [iBody, iHead, iHair].forEach(m => { m.count = visible; });
    countUp(el.querySelector('#hs-chr'), visible, 500);
    el.querySelectorAll('#density button').forEach(b => b.classList.toggle('btn-dark', Number(b.dataset.n) === visible));
  };
  setVisible(visible);
  el.querySelector('#density').addEventListener('click', e => { const n = e.target.closest('button')?.dataset.n; if (n) setVisible(Number(n)); });

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
    b.addEventListener('click', ev => { ev.stopPropagation(); openZone(z); });
    labelsEl.appendChild(b);
    return { el: b, pos: new THREE.Vector3(...z.label) };
  });

  // ---------- Camera helpers ----------
  let anim = null;
  function flyTo(target, zoom, offset = camera.position.clone().sub(controls.target)) {
    anim = {
      t: 0, dur: 0.9,
      fromT: controls.target.clone(), toT: new THREE.Vector3(...target),
      fromO: camera.position.clone().sub(controls.target), toO: offset,
      fromZ: camera.zoom, toZ: zoom,
    };
  }
  const goHome = () => flyTo([0, 0, 0], 1, HOME_OFFSET.clone());
  function rotateBy(rad) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    flyTo(controls.target.toArray(), camera.zoom, off);
  }

  const today = new Date();
  const isEventDay = today.toDateString() === new Date(EVENT.date).toDateString();
  function openZone(z) {
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

  el.querySelector('#mc-zoom-in').onclick = () => flyTo(controls.target.toArray(), Math.min(controls.maxZoom, camera.zoom * 1.35));
  el.querySelector('#mc-zoom-out').onclick = () => flyTo(controls.target.toArray(), Math.max(controls.minZoom, camera.zoom / 1.35));
  el.querySelector('#mc-rot-l').onclick = () => rotateBy(Math.PI / 4);
  el.querySelector('#mc-rot-r').onclick = () => rotateBy(-Math.PI / 4);
  el.querySelector('#mc-home').onclick = () => { closeZone(); goHome(); };

  // click / tap on 3D zones (ignore drags)
  const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let downAt = null;
  const onDown = e => { downAt = [e.clientX, e.clientY]; anim = null; };
  const onUp = e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitMeshes)[0];
    hit ? openZone(hit.object.userData.zone) : closeZone();
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  // ---------- Resize ----------
  const VIEW = 40;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const vh = aspect < 1 ? VIEW / aspect * 0.62 : VIEW * 0.72;
    camera.left = -vh * aspect / 2; camera.right = vh * aspect / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // ---------- Stats (from data service, not characters) ----------
  const applyStats = s => {
    countUp(el.querySelector('#hs-reg'), s.registered);
    countUp(el.querySelector('#hs-chk'), s.checkedIn);
    el.querySelector('#hs-bar').style.width = Math.min(100, (s.checkedIn / s.target) * 100) + '%';
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

    clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 48) c.position.x = -48; });
    trees.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.2 + i) * 0.03; });

    updateAgents(dt, t);
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
  return () => {
    running = false; cancelAnimationFrame(raf);
    clearInterval(clockTimer); offStats(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    controls.dispose();
    disposables.forEach(o => o?.dispose?.());
    [iBody, iHead, iHair, iTop, iLeg, iSeat, iBack, iCenter, iBulb, iFlag].forEach(m => m.dispose());
    renderer.dispose(); renderer.forceContextLoss?.();
  };
}
