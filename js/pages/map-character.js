/**
 * MERIT FEST — Personal character "ME" for the 3D map.
 *  - NavGrid   : walkable grid (navigation mesh) + A* pathfinding with string-pulling
 *  - buildMe   : low-poly articulated character matching the guests' style
 *  - clips     : real THREE.AnimationClip keyframe animations driven by an AnimationMixer
 *                (idle / walk / dance / pray(wai) / sit-eat / stand-eat) with cross-fades
 *  - labels    : billboard sprites ("ME" chip + activity bubble) that always face the camera
 *  - controller: state machine (IDLE, WALKING_TO_*, PRAYING, DANCING, EATING)
 */
import * as THREE from 'three';

export const ME_STATE = Object.freeze({
  IDLE: 'IDLE',
  WALKING_TO_CHURCH: 'WALKING_TO_CHURCH',
  PRAYING: 'PRAYING',
  WALKING_TO_STAGE: 'WALKING_TO_STAGE',
  DANCING: 'DANCING',
  WALKING_TO_DINING: 'WALKING_TO_DINING',
  EATING: 'EATING',
});

const ACTIVITY = {
  church: { walk: ME_STATE.WALKING_TO_CHURCH, act: ME_STATE.PRAYING, clip: 'pray', text: '🙏 สาธุ', border: '#e3b14b' },
  stage: { walk: ME_STATE.WALKING_TO_STAGE, act: ME_STATE.DANCING, clip: 'dance', text: '🎶 ม่วนคักๆ', border: '#8a6fd1' },
  dining: { walk: ME_STATE.WALKING_TO_DINING, act: ME_STATE.EATING, clip: 'eat', text: '🍚 อนุโมทนาบุญ', border: '#7fa36b' },
};

/* =====================================================================
 * Navigation grid + A*
 * ===================================================================== */
export class NavGrid {
  constructor({ minX, maxX, minZ, maxZ, cell = 0.35 }) {
    Object.assign(this, { minX, maxX, minZ, maxZ, cell });
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }
  toCell(x, z) { return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)]; }
  center(cx, cz) { return [this.minX + (cx + 0.5) * this.cell, this.minZ + (cz + 0.5) * this.cell]; }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h; }

  _mark(x0, x1, z0, z1, test) {
    const [a, b] = this.toCell(x0, z0), [c, d] = this.toCell(x1, z1);
    for (let cz = Math.max(0, b); cz <= Math.min(this.h - 1, d); cz++) {
      for (let cx = Math.max(0, a); cx <= Math.min(this.w - 1, c); cx++) {
        const [x, z] = this.center(cx, cz);
        if (test(x, z)) this.blocked[cz * this.w + cx] = 1;
      }
    }
  }
  blockRect(x0, x1, z0, z1, pad = 0) {
    this._mark(x0 - pad, x1 + pad, z0 - pad, z1 + pad, () => true);
  }
  blockCircle(x, z, r, pad = 0) {
    const R = r + pad;
    this._mark(x - R, x + R, z - R, z + R, (px, pz) => (px - x) ** 2 + (pz - z) ** 2 <= R * R);
  }
  blockEllipse(x, z, rx, rz, pad = 0) {
    const A = rx + pad, B = rz + pad;
    this._mark(x - A, x + A, z - B, z + B, (px, pz) => ((px - x) / A) ** 2 + ((pz - z) / B) ** 2 <= 1);
  }

  /** free-test factory. `allow(x, z)` may whitelist blocked cells (e.g. the target chair). */
  _freeFn(allow) {
    return (cx, cz) => {
      if (!this.inside(cx, cz)) return false;
      if (!this.blocked[cz * this.w + cx]) return true;
      if (!allow) return false;
      const [x, z] = this.center(cx, cz);
      return allow(x, z);
    };
  }
  isFree(x, z, allow) { const [cx, cz] = this.toCell(x, z); return this._freeFn(allow)(cx, cz); }

  _nearestFree(cx, cz, free, maxR) {
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (free(cx + dx, cz + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [cx + dx, cz + dz]; } }
      }
      if (best) return best;
    }
    return null;
  }

  _los(a, b, free, ignore) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / (this.cell * 0.35)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [cx, cz] = this.toCell(a[0] + dx * t, a[1] + dz * t);
      if (ignore && cx === ignore[0] && cz === ignore[1]) continue;
      if (!free(cx, cz)) return false;
    }
    return true;
  }

  /**
   * @returns {Array<[number,number]>|null} smoothed world-space waypoints (first = start), or null if unreachable.
   */
  findPath(sx, sz, gx, gz, allow) {
    const free = this._freeFn(allow);
    const startCell = this.toCell(sx, sz);
    let [scx, scz] = startCell;
    const startBlocked = !free(scx, scz);
    if (startBlocked) { const n = this._nearestFree(scx, scz, free, 8); if (!n) return null; [scx, scz] = n; }
    let [gcx, gcz] = this.toCell(gx, gz);
    let exact = true;
    if (!free(gcx, gcz)) { const n = this._nearestFree(gcx, gcz, free, 3); if (!n) return null; [gcx, gcz] = n; exact = false; }

    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const s = scz * W + scx, goal = gcz * W + gcx;
    const H = (i) => { const dx = Math.abs((i % W) - gcx), dz = Math.abs(((i / W) | 0) - gcz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    // binary heap
    const hi = [], hf = [];
    const push = (i, f) => {
      let k = hi.length; hi.push(i); hf.push(f);
      while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break;[hi[p], hi[k]] = [hi[k], hi[p]];[hf[p], hf[k]] = [hf[k], hf[p]]; k = p; }
    };
    const pop = () => {
      const top = hi[0], li = hi.pop(), lf = hf.pop();
      if (hi.length) {
        hi[0] = li; hf[0] = lf; let k = 0;
        for (; ;) {
          const l = 2 * k + 1, r = l + 1; let m = k;
          if (l < hi.length && hf[l] < hf[m]) m = l;
          if (r < hi.length && hf[r] < hf[m]) m = r;
          if (m === k) break;
          [hi[m], hi[k]] = [hi[k], hi[m]];[hf[m], hf[k]] = [hf[k], hf[m]]; k = m;
        }
      }
      return top;
    };
    g[s] = 0; push(s, H(s));
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    while (hi.length) {
      const cur = pop();
      if (closed[cur]) continue;
      if (cur === goal) { found = true; break; }
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cost] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (!free(nx, nz)) continue;
        if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue; // no corner cutting
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ni, ng + H(ni)); }
      }
    }
    if (!found) return null;

    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = [[sx, sz], ...cells.map(i => this.center(i % W, (i / W) | 0))];
    if (exact) pts.push([gx, gz]);

    // string pulling (line-of-sight smoothing)
    const ignore = startBlocked ? startCell : null;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this._los(pts[i], pts[j], free, i === 0 ? ignore : null)) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  }
}

/* =====================================================================
 * Character model
 * ===================================================================== */
const JOINTS = ['me_hips', 'me_torso', 'me_head', 'me_armL', 'me_foreL', 'me_armR', 'me_foreR', 'me_legL', 'me_shinL', 'me_legR', 'me_shinR'];

function buildMe(disposables) {
  const mats = {};
  const M = (c) => {
    if (!mats[c]) { mats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, flatShading: true }); disposables.push(mats[c]); }
    return mats[c];
  };
  const C = { shirt: '#3d8bd9', shirt2: '#2f6fb3', shorts: '#3b3b55', skin: '#f2c9a0', hair: '#2b211b', shoe: '#5a3e2b', sash: '#e8913a', sash2: '#c8442f' };
  const mesh = (geo, color, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); disposables.push(geo); return m;
  };
  const group = (name, parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group(); root.name = 'me_root';
  const body = group('me_body', root);
  const hips = group('me_hips', body, 0, 0.56, 0);
  mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), C.shorts, hips, 0, 0.02, 0);
  mesh(new THREE.BoxGeometry(0.37, 0.07, 0.25), C.sash, hips, 0, 0.1, 0);              // pha khao ma
  mesh(new THREE.BoxGeometry(0.08, 0.16, 0.03), C.sash2, hips, 0.1, 0.02, 0.13);       // sash knot
  const torso = group('me_torso', hips, 0, 0.1, 0);
  mesh(new THREE.CylinderGeometry(0.165, 0.19, 0.38, 8), C.shirt, torso, 0, 0.19, 0);
  mesh(new THREE.CylinderGeometry(0.12, 0.165, 0.05, 8), C.shirt2, torso, 0, 0.4, 0);
  for (const [x, y] of [[0.07, 0.28], [-0.06, 0.15], [0.09, 0.08]]) mesh(new THREE.SphereGeometry(0.035, 6, 4), '#ffd36b', torso, x, y, 0.17); // flower print

  const head = group('me_head', torso, 0, 0.42, 0);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 6), C.skin, head, 0, 0.02, 0);
  mesh(new THREE.SphereGeometry(0.21, 14, 10), C.skin, head, 0, 0.2, 0);
  const hair = mesh(new THREE.SphereGeometry(0.222, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.05), C.hair, head, 0, 0.22, -0.012);
  hair.rotation.x = -0.12;
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.028, 6, 4), '#2a1d16', head, s * 0.075, 0.2, 0.19).castShadow = false;
    mesh(new THREE.SphereGeometry(0.035, 6, 4), '#f4a3a0', head, s * 0.125, 0.15, 0.165).castShadow = false;
    mesh(new THREE.SphereGeometry(0.045, 6, 4), C.skin, head, s * 0.205, 0.19, 0);
  }
  mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), '#a8524a', head, 0, 0.12, 0.2).castShadow = false; // smile

  const arm = (side) => {
    const s = side === 'L' ? 1 : -1;
    const a = group(`me_arm${side}`, torso, s * 0.225, 0.33, 0);
    mesh(new THREE.SphereGeometry(0.065, 8, 6), C.shirt, a, 0, -0.01, 0);
    mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.2, 7), C.shirt, a, 0, -0.1, 0);
    const f = group(`me_fore${side}`, a, 0, -0.2, 0);
    mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.17, 7), C.skin, f, 0, -0.085, 0);
    mesh(new THREE.SphereGeometry(0.052, 8, 6), C.skin, f, 0, -0.19, 0);
    return f;
  };
  const foreL = arm('L');
  const foreR = arm('R');
  const leg = (side) => {
    const s = side === 'L' ? 1 : -1;
    const l = group(`me_leg${side}`, hips, s * 0.09, 0, 0);
    mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.26, 7), C.shorts, l, 0, -0.13, 0);
    const sh = group(`me_shin${side}`, l, 0, -0.26, 0);
    mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.24, 7), C.skin, sh, 0, -0.12, 0);
    mesh(new THREE.BoxGeometry(0.11, 0.07, 0.18), C.shoe, sh, 0, -0.265, 0.035);
  };
  leg('L'); leg('R');

  // eating props: sticky-rice basket in left hand, spoon in right hand
  const bowl = new THREE.Group(); bowl.position.set(0, -0.23, 0.04); foreL.add(bowl);
  mesh(new THREE.CylinderGeometry(0.1, 0.065, 0.08, 10), '#d9a35b', bowl, 0, 0, 0);
  mesh(new THREE.SphereGeometry(0.085, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#fffaf0', bowl, 0, 0.03, 0);
  const spoon = new THREE.Group(); spoon.position.set(0, -0.2, 0.02); foreR.add(spoon);
  mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), '#c9c9d2', spoon, 0, -0.06, 0);
  mesh(new THREE.SphereGeometry(0.035, 6, 4), '#c9c9d2', spoon, 0, -0.15, 0).scale.set(1, 0.5, 1.3);
  bowl.visible = spoon.visible = false;

  return { root, body, props: { bowl, spoon } };
}

/* =====================================================================
 * Animation clips (keyframed poses → QuaternionKeyframeTrack)
 * ===================================================================== */
const REST = {
  me_hips: [0, 0, 0], me_torso: [0, 0, 0], me_head: [0, 0, 0],
  me_armL: [0.05, 0, 0.12], me_foreL: [-0.18, 0, 0], me_armR: [0.05, 0, -0.12], me_foreR: [-0.18, 0, 0],
  me_legL: [0, 0, 0], me_shinL: [0, 0, 0], me_legR: [0, 0, 0], me_shinR: [0, 0, 0],
  bodyY: 0,
};
const SIT = { me_legL: [-1.57, 0, 0.04], me_shinL: [1.5, 0, 0], me_legR: [-1.57, 0, -0.04], me_shinR: [1.5, 0, 0], me_torso: [0.06, 0, 0], bodyY: 0.0 };
const WAI = { me_armL: [-0.8, 0, -0.35], me_foreL: [-1.4, 0, -0.9], me_armR: [-0.8, 0, 0.35], me_foreR: [-1.4, 0, 0.9] };

function makeClip(name, duration, keys) {
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const times = keys.map(k => k[0]);
  const poses = keys.map(k => ({ ...REST, ...k[1] }));
  const tracks = JOINTS.map(j => {
    const vals = [];
    poses.forEach(p => { const [x, y, z] = p[j]; _q.setFromEuler(_e.set(x, y, z)); vals.push(_q.x, _q.y, _q.z, _q.w); });
    return new THREE.QuaternionKeyframeTrack(`${j}.quaternion`, times, vals);
  });
  tracks.push(new THREE.VectorKeyframeTrack('me_body.position', times, poses.flatMap(p => [0, p.bodyY, 0])));
  return new THREE.AnimationClip(name, duration, tracks);
}

function buildClips() {
  const idle = makeClip('idle', 3.2, [
    [0, {}],
    [1.6, { me_torso: [0.025, 0, 0], me_armL: [0.08, 0, 0.16], me_armR: [0.08, 0, -0.16], me_head: [0.03, 0.18, 0], bodyY: 0.008 }],
    [3.2, {}],
  ]);

  // walk cycle 0.7 s
  const stepA = { me_legL: [-0.55, 0, 0], me_shinL: [0.12, 0, 0], me_legR: [0.45, 0, 0], me_shinR: [0.45, 0, 0], me_armL: [0.5, 0, 0.1], me_armR: [-0.5, 0, -0.1], me_foreR: [-0.45, 0, 0], me_foreL: [-0.15, 0, 0], me_torso: [0.05, 0.1, 0], bodyY: -0.01 };
  const passA = { me_legL: [-0.05, 0, 0], me_shinL: [0.2, 0, 0], me_legR: [-0.25, 0, 0], me_shinR: [0.95, 0, 0], me_armL: [0.05, 0, 0.12], me_armR: [0.05, 0, -0.12], me_torso: [0.05, 0, 0], bodyY: 0.04 };
  const mirror = (p) => {
    const o = { ...p };
    const sw = (a, b) => { const A = p[a], B = p[b]; if (A) o[b] = [A[0], -A[1], -A[2]]; else delete o[b]; if (B) o[a] = [B[0], -B[1], -B[2]]; else delete o[a]; };
    sw('me_legL', 'me_legR'); sw('me_shinL', 'me_shinR'); sw('me_armL', 'me_armR'); sw('me_foreL', 'me_foreR');
    if (p.me_torso) o.me_torso = [p.me_torso[0], -p.me_torso[1], -p.me_torso[2]];
    return o;
  };
  const walk = makeClip('walk', 0.7, [[0, stepA], [0.175, passA], [0.35, mirror(stepA)], [0.525, mirror(passA)], [0.7, stepA]]);

  // dance: one bounce every π/8 s → matches the stage musicians' bounce (|sin(4t)| period π/4)
  const B = Math.PI / 8, danceKeys = [];
  for (let k = 0; k <= 8; k++) {
    const down = k % 2 === 0, side = (Math.floor(k / 2) % 2) ? -1 : 1, kk = k % 8;
    const p = {
      bodyY: down ? -0.045 : 0.05,
      me_legL: down ? [-0.32, 0, 0.06] : [-0.05, 0, 0.12 * side], me_shinL: down ? [0.6, 0, 0] : [0.1, 0, 0],
      me_legR: down ? [-0.32, 0, -0.06] : [-0.05, 0, 0.12 * side], me_shinR: down ? [0.6, 0, 0] : [0.1, 0, 0],
      me_hips: [0, 0.15 * side, 0.1 * side],
      me_torso: [0.04, 0.22 * side, -0.07 * side],
      me_head: [down ? 0.12 : -0.05, -0.1 * side, 0.12 * side],
    };
    if (kk < 4) { // both hands up, waving
      p.me_armL = [-2.65, 0, down ? 0.35 : 0.6]; p.me_foreL = [down ? -0.25 : -0.7, 0, 0];
      p.me_armR = [-2.65, 0, down ? -0.6 : -0.35]; p.me_foreR = [down ? -0.7 : -0.25, 0, 0];
    } else { // ram-wong style flowing arms
      p.me_armL = side > 0 ? [-1.7, 0, 0.25] : [-0.5, 0, 0.55]; p.me_foreL = side > 0 ? [-1.25, 0, -0.3] : [-1.4, 0, 0];
      p.me_armR = side > 0 ? [-0.5, 0, -0.55] : [-1.7, 0, -0.25]; p.me_foreR = side > 0 ? [-1.4, 0, 0] : [-1.25, 0, 0.3];
    }
    danceKeys.push([k * B, p]);
  }
  const dance = makeClip('dance', 8 * B, danceKeys);

  const pray = makeClip('pray', 4, [
    [0, { ...WAI }],
    [1.4, { ...WAI, me_torso: [0.03, 0, 0] }],
    [2.1, { ...WAI, me_torso: [0.32, 0, 0], me_head: [0.25, 0, 0], bodyY: -0.01 }],
    [2.8, { ...WAI, me_torso: [0.03, 0, 0] }],
    [4, { ...WAI }],
  ]);

  // eating: left hand holds the rice basket, right hand spoons food to mouth
  const hold = { me_armL: [-0.75, 0, -0.18], me_foreL: [-1.2, 0, -0.55] };
  const low = { me_armR: [-0.7, 0, 0.18], me_foreR: [-0.85, 0, 0.35] };
  const mouth = { me_armR: [-1.4, 0, 0.35], me_foreR: [-1.6, 0, 0.7], me_head: [0.14, 0, 0] };
  const eatKeys = (base) => [
    [0, { ...base, ...hold, ...low, me_head: [0.12, 0, 0] }],
    [0.55, { ...base, ...hold, ...mouth }],
    [0.95, { ...base, ...hold, ...mouth, me_head: [0.05, 0.05, 0] }],
    [1.6, { ...base, ...hold, ...low, me_head: [0.12, 0, 0] }],
    [2.4, { ...base, ...hold, ...low, me_head: [0.08, -0.12, 0] }],
  ];
  const eat = makeClip('eat', 2.4, eatKeys(SIT));
  const eatStand = makeClip('eatStand', 2.4, eatKeys({}));
  return { idle, walk, dance, pray, eat, eatStand };
}

/* =====================================================================
 * Billboard labels
 * ===================================================================== */
function labelTexture(text, { bg, fg, border }, disposables) {
  const font = '700 64px Prompt, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const meas = document.createElement('canvas').getContext('2d'); meas.font = font;
  const tw = meas.measureText(text).width;
  const H = 104, tail = 18, pad = 14, w = Math.ceil(tw + 72 + pad * 2), h = H + tail + pad * 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(60,40,20,.28)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
  const x = pad, y = pad, rw = w - pad * 2, r = H / 2;
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + rw - r, y); g.arc(x + rw - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(w / 2 + 16, y + H); g.lineTo(w / 2, y + H + tail); g.lineTo(w / 2 - 16, y + H);
  g.lineTo(x + r, y + H); g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); g.closePath();
  g.fillStyle = bg; g.fill();
  g.shadowColor = 'transparent'; g.lineWidth = 7; g.strokeStyle = border; g.stroke();
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, y + H / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  disposables.push(tex);
  return { tex, aspect: w / h };
}

function makeSprite(disposables) {
  const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
  disposables.push(mat);
  const s = new THREE.Sprite(mat); s.center.set(0.5, 0); s.renderOrder = 1000;
  return s;
}

const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* =====================================================================
 * Controller
 * ===================================================================== */
/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {NavGrid} o.nav
 * @param {(x:number,z:number)=>number} o.groundY  real ground height sampler (raycast)
 * @param {[number,number]} o.start
 * @param {(state:string, info:object)=>void} [o.onState]
 */
export function createMe({ scene, nav, groundY, start, startFace = Math.PI * 0.75, onState }) {
  const disposables = [];
  const SCALE = 0.9, SPEED = 2.5;
  const { root, props } = buildMe(disposables);
  root.scale.setScalar(SCALE);
  scene.add(root);

  // ground markers
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 28), ringMat); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 2;
  const destMat = new THREE.MeshBasicMaterial({ color: '#7a4fd1', transparent: true, opacity: 0.8, depthWrite: false });
  const dest = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 28), destMat); dest.rotation.x = -Math.PI / 2; dest.visible = false; dest.renderOrder = 2;
  scene.add(ring, dest);
  disposables.push(ringMat, ring.geometry, destMat, dest.geometry);

  // billboard labels
  const chip = makeSprite(disposables), bubble = makeSprite(disposables);
  const chipTex = labelTexture('ME', { bg: '#4b3a33', fg: '#ffffff', border: '#ff9f43' }, disposables);
  chip.material.map = chipTex.tex; chip.material.needsUpdate = true;
  const bubbleTex = {};
  for (const [k, a] of Object.entries(ACTIVITY)) bubbleTex[k] = labelTexture(a.text, { bg: '#fffaf2', fg: '#4b3a33', border: a.border }, disposables);
  bubble.visible = false;
  scene.add(chip, bubble);

  // animation
  const mixer = new THREE.AnimationMixer(root);
  const clips = buildClips();
  const actions = Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, mixer.clipAction(c)]));
  let current = null;
  function play(name, fade = 0.3, syncTime) {
    const next = actions[name];
    if (next === current) return;
    next.reset(); next.setEffectiveTimeScale(1); next.setEffectiveWeight(1);
    if (syncTime !== undefined) next.time = syncTime % next.getClip().duration;
    next.play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
  }

  // state
  const me = {
    x: start[0], z: start[1], y: groundY(start[0], start[1]), face: startFace,
    state: ME_STATE.IDLE, kind: null, key: null, target: null, path: null, wp: 0,
    delay: 0, arrived: false, seated: false, bubbleT: -1, bubbleOn: false, elapsed: 0,
  };
  let lastGX = NaN, lastGZ = NaN;
  play('idle', 0);

  const setState = (s) => {
    if (me.state === s) return;
    me.state = s;
    onState?.(s, { kind: me.kind, key: me.key });
  };
  const showBubble = (kind) => {
    const t = bubbleTex[kind];
    bubble.material.map = t.tex; bubble.material.needsUpdate = true; bubble.userData.aspect = t.aspect;
    bubble.visible = true; me.bubbleOn = true; me.bubbleT = 0;
  };
  const hideBubble = () => { me.bubbleOn = false; me.bubbleT = 0; bubble.visible = false; };

  /**
   * Command ME to an activity.
   * @param {{kind:'church'|'stage'|'dining', key:string, x:number, z:number, face:number, sit?:boolean, allow?:Function}} target
   * @returns {'same'|'ok'|'blocked'}
   */
  function goTo(target) {
    if (me.key === target.key && me.kind === target.kind) return 'same';   // re-click: no new events
    const path = nav.findPath(me.x, me.z, target.x, target.z, target.allow);
    if (!path) return 'blocked';                                          // stay in place — never warp
    const wasSeated = me.seated;
    me.kind = target.kind; me.key = target.key; me.target = target;
    me.path = path; me.wp = 1; me.arrived = false; me.seated = false;
    props.bowl.visible = props.spoon.visible = false;
    hideBubble();
    dest.position.set(target.x, groundY(target.x, target.z) + 0.03, target.z); dest.visible = true;
    // stand up first if seated, then walk
    me.delay = wasSeated ? 0.45 : 0;
    play(wasSeated ? 'idle' : 'walk', wasSeated ? 0.4 : 0.25);
    setState(ACTIVITY[target.kind].walk);
    return 'ok';
  }

  function arrive() {
    const t = me.target, a = ACTIVITY[t.kind];
    me.arrived = true; dest.visible = false;
    if (t.kind === 'dining') {
      me.seated = !!t.sit;
      props.bowl.visible = props.spoon.visible = true;
      play(t.sit ? 'eat' : 'eatStand', 0.45);
    } else if (t.kind === 'stage') {
      play('dance', 0.35, me.elapsed);   // phase-lock to the musicians' beat
    } else {
      play(a.clip, 0.4);
    }
    showBubble(t.kind);
    setState(a.act);
  }

  const _v = new THREE.Vector3();
  function update(dt, t, camera) {
    me.elapsed = t;
    // ---- locomotion ----
    if (me.path && !me.arrived) {
      if (me.delay > 0) {
        me.delay -= dt;
        if (me.delay <= 0) play('walk', 0.25);
      } else if (me.wp < me.path.length) {
        const [tx, tz] = me.path[me.wp];
        const dx = tx - me.x, dz = tz - me.z, dist = Math.hypot(dx, dz);
        const remaining = dist + (me.wp < me.path.length - 1 ? 1 : 0);
        const speed = SPEED * (remaining < 0.6 ? 0.55 + remaining * 0.75 : 1);
        actions.walk.setEffectiveTimeScale(speed / SPEED);
        const step = speed * dt;
        if (dist <= step) { me.x = tx; me.z = tz; me.wp++; }
        else { me.x += (dx / dist) * step; me.z += (dz / dist) * step; }
        if (dist > 1e-3) me.face += wrapAngle(Math.atan2(dx, dz) - me.face) * Math.min(1, dt * 10);
      } else {
        // reached the spot → turn to face the activity (church / stage / table)
        const diff = wrapAngle(me.target.face - me.face);
        if (current === actions.walk) play('idle', 0.25);
        me.face += diff * Math.min(1, dt * 9);
        if (Math.abs(diff) < 0.04) { me.face = me.target.face; arrive(); }
      }
    }
    if (me.x !== lastGX || me.z !== lastGZ) { me.y = groundY(me.x, me.z); lastGX = me.x; lastGZ = me.z; }
    root.position.set(me.x, me.y, me.z);
    root.rotation.y = me.face;
    mixer.update(dt);

    // ---- markers ----
    ring.position.set(me.x, me.y + 0.025, me.z);
    const pulse = 1 + Math.sin(t * 4) * 0.06;
    ring.scale.setScalar(me.seated ? 0.001 : pulse);
    if (dest.visible) { dest.scale.setScalar(1 + ((t * 1.5) % 1) * 0.5); destMat.opacity = 0.85 * (1 - ((t * 1.5) % 1)); }

    // ---- billboard labels (scaled for mobile font-size 16 equivalent) ----
    const isMob = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches;
    const mobFactor = isMob ? 1.35 : 1.0;
    const zs = THREE.MathUtils.clamp(1 / Math.pow(camera.zoom, 0.45), 0.65, 1.6) * mobFactor;
    const headTop = me.y + 1.45;

    // Show ME chip when walking or idle without speech bubble; hide ME when speech bubble is active
    const showingBubble = me.bubbleOn || (bubble.visible && me.bubbleT > 0.05);
    chip.visible = !showingBubble;

    if (chip.visible) {
      const chipH = 0.85 * zs;
      chip.scale.set(chipH * chipTex.aspect, chipH, 1);
      chip.position.set(me.x, headTop + 0.12 * zs, me.z);
    }

    if (bubble.visible) {
      if (me.bubbleOn) me.bubbleT = Math.min(1, me.bubbleT + dt / 0.38);
      else me.bubbleT = Math.max(0, me.bubbleT - dt / 0.15);
      const k = me.bubbleOn ? easeOutBack(me.bubbleT) : me.bubbleT;
      const bh = 1.15 * zs * Math.max(0.001, k);
      bubble.scale.set(bh * bubble.userData.aspect, bh, 1);
      bubble.material.opacity = Math.min(1, me.bubbleT * 1.6);
      const bob = Math.sin(t * 2.4) * 0.05 * zs;
      bubble.position.set(me.x, headTop + 0.12 * zs + bob, me.z);
      if (!me.bubbleOn && me.bubbleT <= 0) bubble.visible = false;
    }
    _v.set(me.x, me.y, me.z);
  }

  return {
    get x() { return me.x; }, get y() { return me.y; }, get z() { return me.z; }, get state() { return me.state; },
    get kind() { return me.kind; }, get key() { return me.key; }, get target() { return me.target; },
    get position() { return _v.set(me.x, me.y, me.z); },
    goTo, update,
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(root);
      scene.remove(root, ring, dest, chip, bubble);
      disposables.forEach(o => o?.dispose?.());
    },
  };
}
