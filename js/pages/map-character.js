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
  WALKING_TO_LUCKY: 'WALKING_TO_LUCKY',
  LUCKY_DRAWING: 'LUCKY_DRAWING',
});

const ACTIVITY = {
  church: { walk: ME_STATE.WALKING_TO_CHURCH, act: ME_STATE.PRAYING, clip: 'pray', text: '🙏 สาธุ', border: '#e3b14b' },
  stage: { walk: ME_STATE.WALKING_TO_STAGE, act: ME_STATE.DANCING, clip: 'dance', text: '🎶 ม่วนคักๆ', border: '#8a6fd1' },
  dining: { walk: ME_STATE.WALKING_TO_DINING, act: ME_STATE.EATING, clip: 'eat', text: '🍚 อนุโมทนาบุญ', border: '#7fa36b' },
  lucky: { walk: ME_STATE.WALKING_TO_LUCKY, act: ME_STATE.LUCKY_DRAWING, clip: 'reach', text: '⭐ สอยดาว', border: '#f5a623' },
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
 * Character model — Smooth 3D Clay Chibi Style (Male & Female)
 * ===================================================================== */
const JOINTS = ['me_hips', 'me_torso', 'me_head', 'me_armL', 'me_foreL', 'me_armR', 'me_foreR', 'me_legL', 'me_shinL', 'me_legR', 'me_shinR'];

export function buildMe(disposables, { gender = 'male', variant = 1, halfBody = false } = {}) {
  const isFemale = gender === 'female';
  const v = (variant === 2 || variant === 3) ? variant : 1;
  const mats = {};
  const M = (c, rough = 0.58, metal = 0.03) => {
    const key = `${c}_${rough}_${metal}`;
    if (!mats[key]) {
      mats[key] = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, flatShading: false });
      disposables.push(mats[key]);
    }
    return mats[key];
  };

  // 6 Character Palettes (3 Male + 3 Female):
  //  - male 1  : chestnut swept hair, beige jacket, blue overalls, red scarf
  //  - male 2  : feathery warm brown hair, dusty sky-blue collared shirt, beige chinos, brown shoes
  //  - male 3  : jet-black spiky hair, pastel purple short-sleeve polo, blue jeans with black belt, black sneakers
  //  - female 1: long straight blue-black hair, light denim jacket, white tee, jeans
  //  - female 2: caramel-brown wavy side-ponytail, round dark-brown glasses, white blouse, tan shoulder bag
  //  - female 3: chocolate-brown wavy hair, pastel pink cap/beret, mustard jacket over graphic tee, pink pleated skirt
  const PALETTES = {
    male: {
      1: {
        skin: '#f6cdb0', skinShade: '#e5a98c', blush: '#f39b92',
        hair: '#6a3a22', hairHi: '#86502f',
        iris: '#5b3520', pupil: '#1d100a', lid: '#3a2216', brow: '#5a311d',
        lip: '#b5525a', nose: '#ef8d7f', freckle: '#d39a82',
        top: '#e2d2b2', topShade: '#cbb790', inner: '#4f86c4', button: '#e6c15a',
        bottom: '#4a7fbd', cuff: '#4a7fbd', shoe: '#6b4630', shoeSole: '#3a2619', lace: '#e9dcc4',
        scarf: '#d2362d',
      },
      2: {
        skin: '#f6cdb0', skinShade: '#e5a98c', blush: '#f39b92',
        hair: '#5a3c28', hairHi: '#885e3f',
        iris: '#4e2d1b', pupil: '#1a0f0a', lid: '#341e14', brow: '#4e3322',
        lip: '#c46258', nose: '#e9a48d', freckle: '#d39a82',
        top: '#789ec2', topShade: '#5d83a8', inner: '#f7f7f4', button: '#ffffff',
        bottom: '#d7c3aa', cuff: '#c9b398', shoe: '#7d4e32', shoeSole: '#f2efe9', lace: '#e5ddd0',
      },
      3: {
        skin: '#f5c39e', skinShade: '#e2a37d', blush: '#ef9589',
        hair: '#18191d', hairHi: '#2c2e36',
        iris: '#4a2a19', pupil: '#140b07', lid: '#181412', brow: '#18191d',
        lip: '#c25e52', nose: '#e69f82', freckle: '#d39a82',
        top: '#bfa8d8', topShade: '#a88ec5', inner: '#d5c6eb', button: '#ffffff',
        bottom: '#467099', cuff: '#88a7c4', shoe: '#202125', shoeSole: '#f4f4f6', lace: '#35373d',
        belt: '#151619', buckle: '#d4dae0',
      },
    },
    female: {
      1: {
        skin: '#f8d6bf', skinShade: '#eab49a', blush: '#f5a3a0',
        hair: '#1b2226', hairHi: '#2b363b',
        iris: '#4a2c1d', pupil: '#1a0f0b', lid: '#1a1210', brow: '#1d1816',
        lip: '#cf5f68', nose: '#e8b096', freckle: '#d39a82',
        top: '#b8cfd6', topShade: '#9db7c0', inner: '#fbfbf8', button: '#dfe5e8',
        bottom: '#5b87b8', cuff: '#8fb0d2', shoe: '#a9b7c2', shoeSole: '#eef1f3', lace: '#ffffff',
      },
      2: {
        skin: '#f8d6bf', skinShade: '#eab49a', blush: '#f49e99',
        hair: '#8c5838', hairHi: '#ad734d',
        iris: '#59331e', pupil: '#1a0f0b', lid: '#1f1410', brow: '#683f26',
        lip: '#dc6e67', nose: '#eba98e', freckle: '#d39a82',
        top: '#fbfaf7', topShade: '#ebe6dc', inner: '#f3eee6', button: '#ffffff',
        bottom: '#6f4e37', cuff: '#6f4e37', shoe: '#8a5a36', shoeSole: '#f3efe8', lace: '#e8dfd5',
        glasses: '#2b1c15', bag: '#b8763e', belt: '#5e402b', buckle: '#dfc56b',
      },
      3: {
        skin: '#f8d6bf', skinShade: '#eab49a', blush: '#f59e9b',
        hair: '#462e23', hairHi: '#5e4032',
        iris: '#4a2918', pupil: '#1a0f0b', lid: '#1d120e', brow: '#3d261c',
        lip: '#d8656c', nose: '#eba990', freckle: '#d39a82',
        top: '#f09c38', topShade: '#d98224', inner: '#fbfaf8', button: '#e39030',
        bottom: '#f2c8be', cuff: '#f6f6f8', shoe: '#f6f6f8', shoeSole: '#ffffff', lace: '#e8e8ee',
        hat: '#f4afa3', hatShade: '#eb9e91', gold: '#eab949',
      },
    },
  };
  const C = PALETTES[isFemale ? 'female' : 'male'][v];

  const mesh = (geo, color, parent, x = 0, y = 0, z = 0, rough = 0.58) => {
    const m = new THREE.Mesh(geo, M(color, rough));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    disposables.push(geo);
    return m;
  };
  const group = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  // Tapered, rounded "clay" hair lock: chain of blended spheres along a smooth curve
  const unitSphere = new THREE.SphereGeometry(1, 14, 10);
  const strand = (pts, r0, r1, color, parent, n = 14) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t);
      const m = mesh(unitSphere, color, parent, p.x, p.y, p.z, 0.45);
      m.scale.setScalar(r0 + (r1 - r0) * t);
      m.castShadow = false;
    }
  };

  const body = new THREE.Group(); body.name = 'me_body';
  const hips = group('me_hips', body, 0, 0.54, 0);

  if (!halfBody) {
    if (isFemale && v === 3) {
      // Female 3: Flared pastel-pink pleated skirt
      mesh(new THREE.CylinderGeometry(0.145, 0.215, 0.24, 24), C.bottom, hips, 0, -0.02, 0, 0.65);
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * Math.PI * 2;
        const pleat = mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.23, 8), k % 2 ? '#e9bcb1' : C.bottom, hips, Math.cos(ang) * 0.17, -0.02, Math.sin(ang) * 0.17, 0.65);
        pleat.rotation.z = -Math.cos(ang) * 0.24;
        pleat.rotation.x = Math.sin(ang) * 0.24;
      }
    } else {
      // Pelvis trousers / jeans / skirt base
      mesh(new THREE.CylinderGeometry(0.152, 0.165, 0.16, 20), C.bottom, hips, 0, 0.01, 0, 0.7);
      // Belt for Male 3 & Female 2
      if ((!isFemale && v === 3) || (isFemale && v === 2)) {
        mesh(new THREE.CylinderGeometry(0.155, 0.157, 0.036, 22), C.belt, hips, 0, 0.075, 0, 0.45);
        mesh(new THREE.BoxGeometry(0.048, 0.042, 0.022), C.buckle, hips, 0, 0.075, 0.152, 0.3);
      }
    }
  }

  // ---- Torso ----
  const torso = group('me_torso', hips, 0, 0.08, 0);
  mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.30, 22), C.top, torso, 0, 0.16, 0, 0.66);
  const chest = mesh(new THREE.SphereGeometry(0.148, 22, 16), C.top, torso, 0, 0.24, 0, 0.66);
  chest.scale.set(1.06, 0.72, 0.88);

  if (isFemale && v === 1) {
    // Female 1 (Existing): Open light denim jacket over white tee
    mesh(new THREE.CylinderGeometry(0.151, 0.159, 0.26, 20, 1, false, -0.42, 0.84), C.inner, torso, 0, 0.17, 0, 0.62);
    for (const s of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.042, 0.26, 0.022), C.top, torso, s * 0.066, 0.17, 0.146, 0.66);
      lapel.rotation.y = s * 0.42;
      lapel.rotation.z = s * 0.06;
    }
    const collar = mesh(new THREE.TorusGeometry(0.088, 0.02, 12, 22), C.top, torso, 0, 0.318, 0.005, 0.66);
    collar.rotation.x = Math.PI / 2 + 0.08;
    for (const s of [-1, 1]) {
      const flap = mesh(new THREE.BoxGeometry(0.075, 0.05, 0.014), C.top, torso, s * 0.06, 0.305, 0.112, 0.66);
      flap.rotation.set(-0.5, s * 0.4, s * 0.55);
      const pocket = mesh(new THREE.BoxGeometry(0.046, 0.046, 0.012), C.topShade, torso, s * 0.098, 0.215, 0.124, 0.66);
      pocket.rotation.y = s * 0.66;
      const pflap = mesh(new THREE.BoxGeometry(0.05, 0.016, 0.016), C.top, torso, s * 0.1, 0.243, 0.126, 0.66);
      pflap.rotation.y = s * 0.66;
      mesh(new THREE.SphereGeometry(0.008, 8, 6), C.button, torso, s * 0.104, 0.236, 0.136, 0.35);
    }
  } else if (isFemale && v === 2) {
    // Female 2: Crisp white collared blouse + camel leather shoulder bag strap
    // Open V-neck skin peek
    const vNeck = mesh(new THREE.ConeGeometry(0.048, 0.09, 3), C.skin, torso, 0, 0.295, 0.132, 0.55);
    vNeck.rotation.set(Math.PI + 0.18, Math.PI / 3, 0);
    vNeck.scale.set(1, 1, 0.4);
    const collar = mesh(new THREE.TorusGeometry(0.086, 0.019, 12, 22), C.top, torso, 0, 0.318, 0.004, 0.6);
    collar.rotation.x = Math.PI / 2 + 0.08;
    for (const s of [-1, 1]) {
      const flap = mesh(new THREE.BoxGeometry(0.078, 0.052, 0.014), C.top, torso, s * 0.058, 0.302, 0.114, 0.6);
      flap.rotation.set(-0.48, s * 0.38, s * 0.52);
    }
    // Center button placket + pearl buttons
    mesh(new THREE.BoxGeometry(0.024, 0.22, 0.012), C.topShade, torso, 0, 0.15, 0.152, 0.62);
    for (const by of [0.22, 0.16, 0.10]) {
      mesh(new THREE.SphereGeometry(0.0075, 8, 6), C.button, torso, 0, by, 0.159, 0.3);
    }
    // Camel leather shoulder bag strap on her right shoulder (s = -1)
    const strap = mesh(new THREE.CylinderGeometry(0.154, 0.158, 0.026, 20), C.bag, torso, -0.105, 0.18, 0.0, 0.5);
    strap.rotation.z = Math.PI / 2 - 0.18;
    strap.scale.set(1.04, 1, 1.02);
    if (!halfBody) {
      const bagBody = mesh(new THREE.BoxGeometry(0.065, 0.13, 0.14), C.bag, torso, -0.168, 0.02, -0.01, 0.52);
      bagBody.rotation.z = 0.08;
    }
  } else if (isFemale && v === 3) {
    // Female 3: Mustard-yellow open jacket over white graphic tee + gold pendant necklace
    mesh(new THREE.CylinderGeometry(0.151, 0.159, 0.26, 20, 1, false, -0.45, 0.90), C.inner, torso, 0, 0.17, 0, 0.62);
    for (const s of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.044, 0.26, 0.024), C.top, torso, s * 0.068, 0.17, 0.146, 0.66);
      lapel.rotation.y = s * 0.42;
      lapel.rotation.z = s * 0.05;
      // Hood/collar flaps
      const flap = mesh(new THREE.BoxGeometry(0.078, 0.052, 0.018), C.top, torso, s * 0.065, 0.305, 0.11, 0.66);
      flap.rotation.set(-0.45, s * 0.4, s * 0.5);
      // Lower jacket flap pockets
      const pocket = mesh(new THREE.BoxGeometry(0.048, 0.055, 0.014), C.topShade, torso, s * 0.102, 0.11, 0.122, 0.66);
      pocket.rotation.y = s * 0.65;
    }
    const collar = mesh(new THREE.TorusGeometry(0.09, 0.022, 12, 22), C.top, torso, 0, 0.318, 0.002, 0.66);
    collar.rotation.x = Math.PI / 2 + 0.08;
    // Gold pendant necklace & cute graphic tee motifs
    mesh(new THREE.TorusGeometry(0.016, 0.005, 8, 16), C.gold, torso, 0, 0.278, 0.152, 0.28);
    mesh(new THREE.SphereGeometry(0.018, 12, 10), '#ef9d56', torso, -0.012, 0.205, 0.154, 0.5).scale.set(1.2, 0.9, 0.4);
    mesh(new THREE.SphereGeometry(0.013, 10, 8), '#5f82b8', torso, 0.016, 0.232, 0.153, 0.5).scale.set(1.1, 0.8, 0.4);
    mesh(new THREE.SphereGeometry(0.009, 8, 6), '#e56b55', torso, 0.018, 0.192, 0.154, 0.5).scale.set(1, 1, 0.4);
  } else if (!isFemale && v === 1) {
    // Male 1 (Existing): Beige jacket over blue overall bib + red scarf
    mesh(new THREE.CylinderGeometry(0.151, 0.159, 0.26, 20, 1, false, -0.42, 0.84), C.inner, torso, 0, 0.17, 0, 0.62);
    for (const s of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.042, 0.26, 0.022), C.top, torso, s * 0.066, 0.17, 0.146, 0.66);
      lapel.rotation.y = s * 0.42;
      lapel.rotation.z = s * 0.06;
      mesh(new THREE.BoxGeometry(0.03, 0.07, 0.012), C.inner, torso, s * 0.055, 0.31, 0.13, 0.62);
      mesh(new THREE.SphereGeometry(0.011, 10, 8), C.button, torso, s * 0.055, 0.282, 0.158, 0.3);
    }
    mesh(new THREE.BoxGeometry(0.062, 0.046, 0.01), '#3f72ad', torso, 0, 0.2, 0.158, 0.62);
    const wrap = mesh(new THREE.TorusGeometry(0.086, 0.028, 12, 22), C.scarf, torso, 0, 0.318, 0.005, 0.6);
    wrap.rotation.x = Math.PI / 2 + 0.08;
    mesh(new THREE.SphereGeometry(0.034, 14, 10), C.scarf, torso, 0, 0.296, 0.1, 0.6);
    const tail = mesh(new THREE.ConeGeometry(0.055, 0.095, 3), C.scarf, torso, 0, 0.245, 0.122, 0.6);
    tail.rotation.set(Math.PI + 0.25, Math.PI / 3, 0);
    tail.scale.set(1, 1, 0.45);
  } else if (!isFemale && v === 2) {
    // Male 2: Dusty sky-blue collared button-up shirt
    const collar = mesh(new THREE.TorusGeometry(0.086, 0.02, 12, 22), C.top, torso, 0, 0.318, 0.005, 0.65);
    collar.rotation.x = Math.PI / 2 + 0.08;
    for (const s of [-1, 1]) {
      const flap = mesh(new THREE.BoxGeometry(0.075, 0.048, 0.014), C.top, torso, s * 0.058, 0.304, 0.114, 0.65);
      flap.rotation.set(-0.5, s * 0.4, s * 0.52);
      const pocket = mesh(new THREE.BoxGeometry(0.046, 0.048, 0.012), C.topShade, torso, s * 0.082, 0.21, 0.134, 0.65);
      pocket.rotation.y = s * 0.52;
    }
    // Center button placket & white buttons
    mesh(new THREE.BoxGeometry(0.026, 0.25, 0.012), '#88afd1', torso, 0, 0.16, 0.152, 0.65);
    for (const by of [0.26, 0.19, 0.12]) {
      mesh(new THREE.SphereGeometry(0.0085, 8, 6), C.button, torso, 0, by, 0.159, 0.3);
    }
  } else if (!isFemale && v === 3) {
    // Male 3: Sleek black short-sleeve polo shirt with collar & 2 buttons
    const collar = mesh(new THREE.TorusGeometry(0.086, 0.021, 12, 22), C.topShade, torso, 0, 0.318, 0.005, 0.6);
    collar.rotation.x = Math.PI / 2 + 0.08;
    for (const s of [-1, 1]) {
      const flap = mesh(new THREE.BoxGeometry(0.072, 0.046, 0.014), C.topShade, torso, s * 0.055, 0.304, 0.114, 0.6);
      flap.rotation.set(-0.5, s * 0.38, s * 0.5);
    }
    // Polo placket + 2 small buttons
    mesh(new THREE.BoxGeometry(0.028, 0.11, 0.014), C.inner, torso, 0, 0.245, 0.151, 0.58);
    mesh(new THREE.SphereGeometry(0.0075, 8, 6), C.button, torso, 0, 0.262, 0.159, 0.3);
    mesh(new THREE.SphereGeometry(0.0075, 8, 6), C.button, torso, 0, 0.228, 0.159, 0.3);
  }

  // ---- Big Chibi Head ----
  const head = group('me_head', torso, 0, 0.34, 0);
  mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.07, 14), C.skin, head, 0, 0.02, 0, 0.55);
  const skull = mesh(new THREE.SphereGeometry(0.255, 36, 28), C.skin, head, 0, 0.245, 0, 0.55);
  skull.scale.set(1.12, 1.0, 1.0);
  // soft chubby lower cheeks
  for (const s of [-1, 1]) {
    const cv = mesh(new THREE.SphereGeometry(0.12, 18, 14), C.skin, head, s * 0.1, 0.17, 0.12, 0.55);
    cv.scale.set(1, 0.85, 0.9);
  }
  // ears
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.058, 16, 14), C.skin, head, s * 0.28, 0.225, -0.01, 0.55);
    ear.scale.set(0.55, 0.95, 0.75);
    const earIn = mesh(new THREE.SphereGeometry(0.034, 12, 10), C.skinShade, head, s * 0.293, 0.225, 0.005, 0.6);
    earIn.scale.set(0.45, 0.8, 0.6);
    earIn.castShadow = false;
    // Female 3: small cute gold earrings
    if (isFemale && v === 3) {
      const earStud = mesh(new THREE.SphereGeometry(0.012, 8, 8), C.gold, head, s * 0.282, 0.176, 0.012, 0.25);
      earStud.castShadow = false;
    }
  }

  // Big glossy brown eyes (sclera + iris + pupil + 2 highlights) with lid line
  for (const s of [-1, 1]) {
    const eg = group(`me_eye${s > 0 ? 'L' : 'R'}`, head, s * 0.098, 0.228, 0.222);
    eg.rotation.set(-0.04, s * 0.36, 0);
    const sclera = mesh(new THREE.SphereGeometry(0.047, 20, 16), '#ffffff', eg, 0, 0, 0, 0.3);
    sclera.scale.set(0.92, 1.06, 0.4);
    const iris = mesh(new THREE.SphereGeometry(0.038, 20, 16), C.iris, eg, 0, -0.003, 0.009, 0.25);
    iris.scale.set(0.95, 1.05, 0.36);
    const pupil = mesh(new THREE.SphereGeometry(0.02, 14, 10), C.pupil, eg, 0, -0.003, 0.016, 0.2);
    pupil.scale.set(1, 1.05, 0.4);
    const hl1 = mesh(new THREE.SphereGeometry(0.011, 10, 8), '#ffffff', eg, 0.013, 0.015, 0.022, 0.1);
    hl1.scale.set(1, 1, 0.5);
    const hl2 = mesh(new THREE.SphereGeometry(0.0055, 8, 6), '#ffffff', eg, -0.012, -0.014, 0.021, 0.1);
    hl2.scale.set(1, 1, 0.5);
    const lid = mesh(new THREE.TorusGeometry(0.046, isFemale ? 0.0075 : 0.0055, 8, 24, Math.PI * 0.82), C.lid, eg, 0, 0.002, 0.009, 0.4);
    lid.rotation.z = Math.PI * 0.09;
    lid.scale.set(0.95, 1.06, 1);
    if (isFemale) {
      // cute outer eyelash flicks
      const l1 = mesh(new THREE.ConeGeometry(0.008, 0.03, 8), C.lid, eg, s * 0.047, 0.022, 0.008, 0.4);
      l1.rotation.z = -s * 1.1;
      const l2 = mesh(new THREE.ConeGeometry(0.006, 0.022, 8), C.lid, eg, s * 0.038, 0.036, 0.008, 0.4);
      l2.rotation.z = -s * 0.7;
    }
    [sclera, iris, pupil, hl1, hl2, lid].forEach(m => { m.castShadow = false; });

    // eyebrows
    const browThickness = isFemale ? 0.0105 : (v === 3 ? 0.011 : 0.008);
    const brow = mesh(new THREE.TorusGeometry(0.05, browThickness, 8, 20, Math.PI * 0.45), C.brow, head, s * 0.1, 0.268, 0.222, 0.5);
    brow.rotation.set(-0.15, s * 0.36, Math.PI * 0.275);
    brow.castShadow = false;

    // rosy cheeks
    const cheek = mesh(new THREE.SphereGeometry(0.045, 14, 10), C.blush, head, s * 0.165, 0.165, 0.215, 0.65);
    cheek.scale.set(1.2, 0.7, 0.3);
    cheek.castShadow = false;
  }

  // Female 1: light freckles across the cheeks
  if (isFemale && v === 1) {
    for (const s of [-1, 1]) {
      for (const [fx, fy] of [[0.125, 0.205], [0.145, 0.212], [0.16, 0.2], [0.138, 0.195]]) {
        const fr = mesh(new THREE.SphereGeometry(0.0055, 8, 6), C.freckle, head, s * fx, fy, 0.219, 0.7);
        fr.scale.set(1, 1, 0.5);
        fr.castShadow = false;
      }
    }
  }

  // Female 2: Big round dark-brown eyeglasses
  if (isFemale && v === 2) {
    for (const s of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.072, 0.007, 10, 32), C.glasses, head, s * 0.096, 0.226, 0.244, 0.3);
      rim.rotation.set(-0.04, s * 0.26, 0);
      rim.scale.set(1.04, 0.96, 1);
      rim.castShadow = false;
      const temple = mesh(new THREE.BoxGeometry(0.008, 0.009, 0.16), C.glasses, head, s * 0.186, 0.238, 0.16, 0.3);
      temple.rotation.y = s * 0.35;
      temple.castShadow = false;
    }
    const bridge = mesh(new THREE.TorusGeometry(0.026, 0.0065, 8, 16, Math.PI), C.glasses, head, 0, 0.232, 0.258, 0.3);
    bridge.castShadow = false;
  }

  // little nose
  const nose = mesh(new THREE.SphereGeometry(0.016, 12, 10), C.nose, head, 0, 0.19, 0.252, 0.55);
  nose.scale.set(1.2, 0.85, 0.7);
  nose.castShadow = false;

  // gentle closed-mouth smile
  const smile = mesh(new THREE.TorusGeometry(0.032, isFemale ? 0.0068 : 0.0058, 8, 20, Math.PI * 0.62), C.lip, head, 0, 0.162, 0.241, 0.45);
  smile.rotation.set(0.35, 0, Math.PI * 1.19);
  smile.castShadow = false;

  // ---- Sculpted Hair ----
  const hairCap = mesh(new THREE.SphereGeometry(0.272, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), C.hair, head, 0, 0.262, -0.01, 0.45);
  hairCap.scale.set(1.13, 1.02, 1.07);
  hairCap.rotation.x = -0.55;

  if (isFemale && v === 1) {
    // Female 1 (Existing): Center-parted long straight blue-black hair
    for (const s of [-1, 1]) {
      const lobe = mesh(new THREE.SphereGeometry(0.17, 20, 16), C.hair, head, s * 0.1, 0.42, 0.04, 0.45);
      lobe.scale.set(1.1, 0.62, 1.15);
      lobe.rotation.z = -s * 0.2;
    }
    for (const s of [-1, 1]) {
      strand([[s * 0.015, 0.49, 0.15], [s * 0.13, 0.45, 0.22], [s * 0.24, 0.34, 0.16], [s * 0.285, 0.2, 0.1], [s * 0.3, 0.05, 0.07], [s * 0.32, -0.1, 0.05], [s * 0.35, -0.18, 0.06]], 0.05, 0.036, C.hair, head, 26);
      strand([[s * 0.06, 0.5, 0.08], [s * 0.2, 0.44, 0.12], [s * 0.29, 0.32, 0.06], [s * 0.31, 0.15, 0.02], [s * 0.32, -0.02, 0.0], [s * 0.34, -0.17, 0.0]], 0.06, 0.044, C.hairHi, head, 24);
      strand([[s * 0.08, 0.48, -0.05], [s * 0.22, 0.42, -0.06], [s * 0.3, 0.3, -0.08], [s * 0.31, 0.1, -0.1], [s * 0.31, -0.05, -0.12], [s * 0.33, -0.19, -0.12]], 0.07, 0.05, C.hair, head, 24);
    }
    for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) {
      strand([[x * 0.9, 0.45, -0.17], [x * 1.05, 0.3, -0.26], [x * 1.15, 0.1, -0.25], [x * 1.2, -0.05, -0.22], [x * 1.25, -0.18, -0.2]], 0.085, 0.06, C.hair, head, 18);
    }
  } else if (isFemale && v === 2) {
    // Female 2: Caramel-brown center-parted wavy hair swept into low side ponytail + loose tendrils
    for (const s of [-1, 1]) {
      const lobe = mesh(new THREE.SphereGeometry(0.18, 22, 16), C.hair, head, s * 0.105, 0.43, 0.04, 0.45);
      lobe.scale.set(1.15, 0.65, 1.18);
      lobe.rotation.z = -s * 0.22;
      // Voluminous wavy temple sweeps curving back
      strand([[s * 0.02, 0.50, 0.15], [s * 0.15, 0.46, 0.22], [s * 0.27, 0.37, 0.16], [s * 0.33, 0.28, 0.06], [s * 0.26, 0.20, -0.08]], 0.062, 0.042, C.hairHi, head, 20);
      strand([[s * 0.05, 0.49, 0.08], [s * 0.22, 0.43, 0.12], [s * 0.31, 0.32, 0.02], [s * 0.25, 0.18, -0.12]], 0.068, 0.048, C.hair, head, 18);
      // Delicate wavy face-framing tendril hanging past cheeks
      strand([[s * 0.24, 0.34, 0.16], [s * 0.255, 0.23, 0.15], [s * 0.23, 0.13, 0.14], [s * 0.25, 0.04, 0.13]], 0.024, 0.01, C.hairHi, head, 14);
    }
    // Back gathered crown + Low side ponytail draped over her left shoulder (x > 0)
    strand([[0.0, 0.36, -0.22], [0.06, 0.22, -0.22], [0.11, 0.10, -0.14], [0.14, 0.01, -0.03], [0.15, -0.08, 0.05]], 0.082, 0.045, C.hair, head, 20);
    strand([[0.04, 0.20, -0.18], [0.12, 0.09, -0.10], [0.16, -0.01, 0.0], [0.16, -0.11, 0.07]], 0.06, 0.028, C.hairHi, head, 16);
    const tie = mesh(new THREE.TorusGeometry(0.055, 0.01, 8, 16), '#3b281e', head, 0.10, 0.11, -0.13, 0.5);
    tie.rotation.set(0.6, 0.3, -0.4);
  } else if (isFemale && v === 3) {
    // Female 3: Chocolate-brown wavy shoulder-length hair with curled ends + Pastel pink cap/beret on top
    for (const s of [-1, 1]) {
      const lobe = mesh(new THREE.SphereGeometry(0.175, 20, 16), C.hair, head, s * 0.1, 0.42, 0.05, 0.45);
      lobe.scale.set(1.12, 0.62, 1.15);
      lobe.rotation.z = -s * 0.2;
      // Wavy shoulder-length locks with bouncy curled ends
      strand([[s * 0.02, 0.49, 0.16], [s * 0.14, 0.45, 0.22], [s * 0.25, 0.34, 0.16], [s * 0.29, 0.20, 0.10], [s * 0.33, 0.06, 0.08], [s * 0.30, -0.05, 0.11], [s * 0.25, -0.07, 0.13]], 0.058, 0.038, C.hair, head, 24);
      strand([[s * 0.06, 0.49, 0.08], [s * 0.21, 0.43, 0.11], [s * 0.30, 0.30, 0.05], [s * 0.33, 0.14, 0.02], [s * 0.35, -0.01, 0.02], [s * 0.29, -0.08, 0.05]], 0.064, 0.044, C.hairHi, head, 22);
    }
    for (const x of [-0.18, -0.09, 0, 0.09, 0.18]) {
      strand([[x * 0.9, 0.44, -0.16], [x * 1.05, 0.28, -0.24], [x * 1.15, 0.10, -0.23], [x * 1.18, -0.04, -0.20]], 0.08, 0.055, C.hair, head, 16);
    }
    // Cute pastel coral-pink cap/beret perched on top of crown
    const hatDome = mesh(new THREE.SphereGeometry(0.235, 28, 20), C.hat, head, 0, 0.455, -0.01, 0.52);
    hatDome.scale.set(1.08, 0.48, 1.06);
    hatDome.rotation.x = -0.18;
    const hatBrim = mesh(new THREE.TorusGeometry(0.215, 0.026, 12, 26, Math.PI * 0.85), C.hatShade, head, 0, 0.455, 0.045, 0.52);
    hatBrim.rotation.set(Math.PI / 2 - 0.36, 0, Math.PI * 0.075);
    hatBrim.scale.set(1.05, 0.85, 0.75);
  } else if (!isFemale && v === 1) {
    // Male 1 (Existing): Swept side-parted chestnut hair
    const top = mesh(new THREE.SphereGeometry(0.2, 22, 16), C.hair, head, 0.02, 0.43, 0.04, 0.45);
    top.scale.set(1.3, 0.62, 1.2);
    strand([[-0.08, 0.5, 0.1], [0.04, 0.47, 0.2], [0.15, 0.4, 0.24], [0.23, 0.31, 0.2]], 0.06, 0.025, C.hair, head, 18);
    strand([[-0.1, 0.47, 0.16], [-0.01, 0.41, 0.245], [0.09, 0.35, 0.26], [0.14, 0.31, 0.25]], 0.05, 0.02, C.hairHi, head, 16);
    strand([[-0.12, 0.46, 0.15], [-0.1, 0.4, 0.23], [-0.06, 0.34, 0.255]], 0.045, 0.02, C.hair, head, 12);
    strand([[-0.1, 0.48, 0.08], [-0.2, 0.42, 0.14], [-0.26, 0.32, 0.13], [-0.27, 0.24, 0.1]], 0.055, 0.025, C.hairHi, head, 16);
    for (const s of [-1, 1]) {
      strand([[s * 0.22, 0.4, 0.1], [s * 0.28, 0.3, 0.08], [s * 0.27, 0.21, 0.06]], 0.045, 0.022, C.hair, head, 12);
      strand([[s * -0.05, 0.52, -0.02], [s * 0.12, 0.48, -0.12], [s * 0.2, 0.38, -0.18], [s * 0.22, 0.26, -0.18]], 0.07, 0.04, C.hair, head, 14);
    }
    strand([[0.0, 0.53, 0.0], [0.06, 0.565, -0.06], [0.1, 0.55, -0.1]], 0.045, 0.015, C.hairHi, head, 10);
  } else if (!isFemale && v === 2) {
    // Male 2: Voluminous feathery windswept medium-brown hair with caramel highlights
    const top = mesh(new THREE.SphereGeometry(0.215, 22, 16), C.hair, head, 0.0, 0.44, 0.03, 0.45);
    top.scale.set(1.38, 0.66, 1.22);
    // Swooping feathered bangs & highlighted locks
    strand([[0.08, 0.52, 0.08], [0.02, 0.50, 0.20], [-0.08, 0.42, 0.25], [-0.18, 0.35, 0.22]], 0.065, 0.022, C.hairHi, head, 18);
    strand([[0.12, 0.50, 0.12], [0.08, 0.45, 0.23], [0.0, 0.36, 0.26], [-0.05, 0.31, 0.25]], 0.058, 0.018, C.hair, head, 16);
    strand([[-0.04, 0.53, 0.06], [-0.16, 0.48, 0.18], [-0.28, 0.41, 0.17], [-0.35, 0.36, 0.13]], 0.062, 0.018, C.hairHi, head, 16);
    strand([[0.08, 0.51, 0.08], [0.20, 0.46, 0.17], [0.30, 0.39, 0.14], [0.36, 0.35, 0.10]], 0.06, 0.018, C.hair, head, 16);
    // Feathery side wings sticking out playfully
    for (const s of [-1, 1]) {
      strand([[s * 0.18, 0.42, 0.10], [s * 0.29, 0.34, 0.09], [s * 0.34, 0.29, 0.06]], 0.05, 0.016, C.hairHi, head, 12);
      strand([[s * 0.20, 0.34, 0.06], [s * 0.29, 0.26, 0.04], [s * 0.31, 0.20, 0.03]], 0.042, 0.014, C.hair, head, 12);
      strand([[s * -0.04, 0.53, -0.02], [s * 0.14, 0.49, -0.12], [s * 0.23, 0.38, -0.18], [s * 0.24, 0.25, -0.17]], 0.072, 0.038, C.hair, head, 14);
    }
    // Top wispy flyaways
    strand([[0.04, 0.53, 0.02], [-0.04, 0.58, 0.0], [-0.12, 0.57, -0.03]], 0.042, 0.012, C.hairHi, head, 10);
  } else if (!isFemale && v === 3) {
    // Male 3: Jet-black short spiky/swept-up hair with clean tapered sides & open forehead
    const top = mesh(new THREE.SphereGeometry(0.19, 20, 14), C.hair, head, 0.0, 0.43, 0.02, 0.42);
    top.scale.set(1.22, 0.58, 1.15);
    // Spiky upward & swept front tufts exposing the forehead
    strand([[0.04, 0.46, 0.14], [0.0, 0.53, 0.19], [-0.06, 0.58, 0.16]], 0.058, 0.014, C.hair, head, 14);
    strand([[-0.06, 0.45, 0.13], [-0.11, 0.52, 0.18], [-0.17, 0.55, 0.14]], 0.054, 0.014, C.hairHi, head, 14);
    strand([[0.11, 0.45, 0.12], [0.09, 0.52, 0.17], [0.04, 0.56, 0.14]], 0.054, 0.014, C.hairHi, head, 14);
    strand([[0.17, 0.42, 0.09], [0.19, 0.48, 0.13], [0.15, 0.52, 0.10]], 0.046, 0.012, C.hair, head, 12);
    strand([[-0.15, 0.42, 0.10], [-0.20, 0.47, 0.13], [-0.23, 0.49, 0.09]], 0.046, 0.012, C.hair, head, 12);
    strand([[0.0, 0.48, 0.02], [-0.04, 0.56, -0.02], [-0.09, 0.59, -0.06]], 0.055, 0.014, C.hair, head, 12);
    // Clean tapered sideburns
    for (const s of [-1, 1]) {
      strand([[s * 0.23, 0.39, 0.08], [s * 0.27, 0.30, 0.06], [s * 0.26, 0.22, 0.05]], 0.038, 0.015, C.hair, head, 10);
      strand([[s * -0.04, 0.50, -0.03], [s * 0.12, 0.46, -0.13], [s * 0.19, 0.36, -0.18], [s * 0.20, 0.25, -0.17]], 0.065, 0.035, C.hair, head, 12);
    }
  }

  // ---- Arms: sleeves, cuffs & hands ----
  const isShortSleeve = (!isFemale && v === 3);
  const isRolledSleeve = (!isFemale && v === 2) || (isFemale && v === 2);
  const arm = (side) => {
    const s = side === 'L' ? 1 : -1;
    const a = group(`me_arm${side}`, torso, s * 0.175, 0.27, 0);
    mesh(new THREE.SphereGeometry(0.054, 14, 12), C.top, a, 0, -0.01, 0, 0.66);
    if (isShortSleeve) {
      // Short sleeve polo on upper arm + bare lower upper-arm
      mesh(new THREE.CylinderGeometry(0.049, 0.047, 0.10, 14), C.top, a, 0, -0.06, 0, 0.62);
      const sCuff = mesh(new THREE.TorusGeometry(0.044, 0.009, 8, 16), C.topShade, a, 0, -0.11, 0, 0.62);
      sCuff.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.042, 0.039, 0.06, 14), C.skin, a, 0, -0.14, 0, 0.55);
    } else {
      mesh(new THREE.CylinderGeometry(0.048, 0.045, 0.16, 14), C.top, a, 0, -0.09, 0, 0.66);
    }

    const f = group(`me_fore${side}`, a, 0, -0.16, 0);
    if (isShortSleeve) {
      // Bare forearm
      mesh(new THREE.CylinderGeometry(0.039, 0.032, 0.15, 14), C.skin, f, 0, -0.075, 0, 0.55);
    } else if (isRolledSleeve) {
      // 3/4 rolled sleeve
      mesh(new THREE.CylinderGeometry(0.045, 0.043, 0.065, 14), C.top, f, 0, -0.032, 0, 0.66);
      const cuff = mesh(new THREE.TorusGeometry(0.043, 0.012, 10, 16), C.topShade, f, 0, -0.068, 0, 0.66);
      cuff.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.035, 0.031, 0.085, 12), C.skin, f, 0, -0.112, 0, 0.55);
    } else {
      // Full-length jacket sleeve
      mesh(new THREE.CylinderGeometry(0.045, 0.042, 0.11, 14), C.top, f, 0, -0.055, 0, 0.66);
      const cuff = mesh(new THREE.TorusGeometry(0.041, 0.012, 10, 16), C.topShade, f, 0, -0.112, 0, 0.66);
      cuff.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.031, 0.03, 0.04, 12), C.skin, f, 0, -0.135, 0, 0.55);
    }
    const hand = mesh(new THREE.SphereGeometry(0.040, 14, 12), C.skin, f, 0, -0.175, 0.005, 0.55);
    hand.scale.set(0.95, 1.1, 0.78);
    mesh(new THREE.SphereGeometry(0.016, 8, 8), C.skin, f, -s * 0.028, -0.165, 0.02, 0.55);
    return f;
  };
  const foreL = arm('L');
  const foreR = arm('R');

  // ---- Legs: trousers / rolled jeans / skirt legs & shoes ----
  const leg = (side) => {
    const s = side === 'L' ? 1 : -1;
    const l = group(`me_leg${side}`, hips, s * 0.085, 0, 0);
    const isSkirtLegs = (isFemale && v === 3);
    mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.24, 16), isSkirtLegs ? C.skin : C.bottom, l, 0, -0.12, 0, isSkirtLegs ? 0.55 : 0.7);
    const sh = group(`me_shin${side}`, l, 0, -0.24, 0);
    if (isSkirtLegs) {
      // Bare lower legs + white ankle socks
      mesh(new THREE.CylinderGeometry(0.050, 0.042, 0.17, 16), C.skin, sh, 0, -0.085, 0, 0.55);
      mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.055, 14), C.cuff, sh, 0, -0.195, 0, 0.65);
    } else if ((isFemale && v === 1) || (!isFemale && v === 3)) {
      // Rolled denim cuffs
      mesh(new THREE.CylinderGeometry(0.054, 0.05, 0.19, 16), C.bottom, sh, 0, -0.095, 0, 0.7);
      const cuff = mesh(new THREE.TorusGeometry(0.05, 0.014, 10, 18), C.cuff, sh, 0, -0.188, 0, 0.7);
      cuff.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12), C.skin, sh, 0, -0.212, 0, 0.55);
    } else {
      // Full-length trousers
      mesh(new THREE.CylinderGeometry(0.054, 0.05, 0.21, 16), C.bottom, sh, 0, -0.105, 0, 0.7);
    }
    const shoe = mesh(new THREE.SphereGeometry(0.06, 16, 12), C.shoe, sh, 0, -0.245, 0.025, 0.55);
    shoe.scale.set(0.95, 0.7, 1.4);
    const sole = mesh(new THREE.CylinderGeometry(0.055, 0.057, 0.02, 16), C.shoeSole, sh, 0, -0.275, 0.025, 0.7);
    sole.scale.set(1.0, 1.0, 1.42);
    for (const lz of [0.05, 0.075]) {
      const lace = mesh(new THREE.BoxGeometry(0.036, 0.007, 0.012), C.lace, sh, 0, -0.218 - (lz - 0.05) * 0.5, lz, 0.5);
      lace.rotation.x = -0.5;
    }
  };

  if (!halfBody) {
    leg('L'); leg('R');

    // eating props: sticky-rice basket in left hand, spoon in right hand
    const bowl = new THREE.Group(); bowl.position.set(0, -0.21, 0.04); foreL.add(bowl);
    mesh(new THREE.CylinderGeometry(0.1, 0.065, 0.08, 12), '#d9a35b', bowl, 0, 0, 0);
    mesh(new THREE.SphereGeometry(0.085, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#fffaf0', bowl, 0, 0.03, 0);
    const spoon = new THREE.Group(); spoon.position.set(0, -0.18, 0.02); foreR.add(spoon);
    mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), '#c9c9d2', spoon, 0, -0.06, 0);
    mesh(new THREE.SphereGeometry(0.035, 8, 6), '#c9c9d2', spoon, 0, -0.15, 0).scale.set(1, 0.5, 1.3);
    bowl.visible = spoon.visible = false;

    // bamboo hook pole for Lucky Star harvest
    const hookPole = new THREE.Group();
    hookPole.position.set(0, -0.20, 0.05);
    hookPole.rotation.set(-Math.PI / 2 + 0.15, 0, 0);
    foreR.add(hookPole);
    mesh(new THREE.CylinderGeometry(0.012, 0.015, 1.35, 8), '#cfa15d', hookPole, 0, 0.67, 0);
    for (let ny = 0.25; ny <= 1.25; ny += 0.3) {
      mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8), '#8a5a2b', hookPole, 0, ny, 0);
    }
    const hookTip = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI * 1.3), new THREE.MeshStandardMaterial({ color: '#e0b068', roughness: 0.4 }));
    hookTip.position.set(0, 1.33, 0.02);
    hookTip.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    hookPole.add(hookTip);
    disposables.push(hookTip.geometry, hookTip.material);
    hookPole.visible = false;

    return { body, props: { bowl, spoon, hookPole } };
  }

  return { body, props: { bowl: null, spoon: null, hookPole: null } };
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

  // reach: look up, raise arms up to reach for star, pull down, celebrate
  const reach = makeClip('reach', 3.6, [
    [0, { me_head: [-0.15, 0, 0] }],
    [0.7, { me_head: [-0.35, 0, 0], me_armR: [-2.1, 0, -0.2], me_foreR: [-0.35, 0, 0], me_armL: [-1.8, 0, 0.2], me_foreL: [-0.35, 0, 0], me_torso: [-0.05, 0, 0], bodyY: 0.03 }],
    [1.4, { me_head: [-0.42, 0, 0], me_armR: [-2.85, 0, -0.15], me_foreR: [-0.2, 0, 0], me_armL: [-2.65, 0, 0.2], me_foreL: [-0.3, 0, 0], me_torso: [-0.08, 0, 0], bodyY: 0.06 }],
    [2.1, { me_head: [-0.38, 0, 0], me_armR: [-2.7, 0, -0.1], me_foreR: [-0.65, 0, 0], me_armL: [-2.5, 0, 0.15], me_foreL: [-0.65, 0, 0], bodyY: 0.04 }],
    [2.7, { me_head: [0.15, 0, 0], me_armR: [-1.15, 0, 0.15], me_foreR: [-1.35, 0, 0.55], me_armL: [-1.15, 0, -0.15], me_foreL: [-1.35, 0, -0.55], me_torso: [0.08, 0, 0], bodyY: -0.01 }],
    [3.2, { me_head: [-0.15, 0, 0], me_armR: [-2.55, 0, -0.35], me_foreR: [-0.45, 0, 0], me_armL: [-2.55, 0, 0.35], me_foreL: [-0.45, 0, 0], bodyY: 0.08 }],
    [3.6, { me_head: [0, 0, 0], me_armR: [0.05, 0, -0.12], me_foreR: [-0.18, 0, 0], me_armL: [0.05, 0, 0.12], me_foreL: [-0.18, 0, 0], bodyY: 0 }],
  ]);

  // 1. pickupPole: reach down, pick up pole, lift to chest level
  const pickupPole = makeClip('pickupPole', 0.8, [
    [0, {}],
    [0.4, { me_torso: [0.32, 0.1, 0], me_head: [0.25, 0.1, 0], me_armR: [0.85, 0, -0.2], me_foreR: [-0.65, 0, 0], bodyY: -0.05 }],
    [0.8, { me_torso: [0.05, 0, 0], me_head: [-0.1, 0, 0], me_armR: [-0.95, 0, -0.15], me_foreR: [-1.15, 0, 0], me_armL: [-0.75, 0, 0.2], me_foreL: [-1.2, 0, 0], bodyY: 0.01 }],
  ]);

  // 2. hookStar: raise pole high overhead towards star, stretching on tiptoes with rhythmic hooking tugs
  const hookStar = makeClip('hookStar', 1.6, [
    [0, { me_head: [-0.45, 0, 0], me_armR: [-2.85, 0, -0.15], me_foreR: [-0.2, 0, 0], me_armL: [-2.65, 0, 0.2], me_foreL: [-0.3, 0, 0], me_torso: [-0.08, 0, 0], bodyY: 0.06 }],
    [0.4, { me_head: [-0.42, 0, 0], me_armR: [-2.65, 0, -0.12], me_foreR: [-0.42, 0, 0], me_armL: [-2.45, 0, 0.18], me_foreL: [-0.45, 0, 0], me_torso: [-0.05, 0, 0], bodyY: 0.03 }],
    [0.8, { me_head: [-0.48, 0, 0], me_armR: [-2.92, 0, -0.15], me_foreR: [-0.15, 0, 0], me_armL: [-2.72, 0, 0.2], me_foreL: [-0.25, 0, 0], me_torso: [-0.09, 0, 0], bodyY: 0.07 }],
    [1.2, { me_head: [-0.42, 0, 0], me_armR: [-2.65, 0, -0.12], me_foreR: [-0.4, 0, 0], me_armL: [-2.45, 0, 0.18], me_foreL: [-0.45, 0, 0], me_torso: [-0.05, 0, 0], bodyY: 0.03 }],
    [1.6, { me_head: [-0.45, 0, 0], me_armR: [-2.8, 0, -0.15], me_foreR: [-0.25, 0, 0], me_armL: [-2.6, 0, 0.2], me_foreL: [-0.3, 0, 0], me_torso: [-0.08, 0, 0], bodyY: 0.05 }],
  ]);

  // 3. catchStar: lower pole, cup hands together to catch the falling star
  const catchStar = makeClip('catchStar', 0.9, [
    [0, { me_head: [-0.35, 0, 0], me_armR: [-1.8, 0, -0.1], me_foreR: [-0.8, 0, 0], me_armL: [-1.8, 0, 0.1], me_foreL: [-0.8, 0, 0] }],
    [0.5, { me_head: [0.15, 0, 0], me_armR: [-0.75, 0, -0.18], me_foreR: [-1.35, 0, -0.55], me_armL: [-0.75, 0, 0.18], me_foreL: [-1.35, 0, 0.55], me_torso: [0.08, 0, 0], bodyY: -0.02 }],
    [0.9, { me_head: [0.12, 0, 0], me_armR: [-0.72, 0, -0.18], me_foreR: [-1.35, 0, -0.55], me_armL: [-0.72, 0, 0.18], me_foreL: [-1.35, 0, 0.55], me_torso: [0.06, 0, 0], bodyY: -0.01 }],
  ]);

  // 4. celebrate: jumping bounce with both arms pumped high in victory
  const celebrate = makeClip('celebrate', 1.2, [
    [0, { me_head: [-0.15, 0, 0], me_armR: [-1.2, 0, -0.2], me_foreR: [-0.8, 0, 0], me_armL: [-1.2, 0, 0.2], me_foreL: [-0.8, 0, 0], bodyY: 0.01 }],
    [0.35, { me_head: [-0.3, 0, 0], me_armR: [-2.75, 0, -0.45], me_foreR: [-0.25, 0, 0], me_armL: [-2.75, 0, 0.45], me_foreL: [-0.25, 0, 0], bodyY: 0.11 }],
    [0.65, { me_head: [0.1, 0, 0], me_armR: [-1.8, 0, -0.25], me_foreR: [-0.7, 0, 0], me_armL: [-1.8, 0, 0.25], me_foreL: [-0.7, 0, 0], bodyY: -0.03 }],
    [0.95, { me_head: [-0.25, 0, 0], me_armR: [-2.65, 0, -0.4], me_foreR: [-0.25, 0, 0], me_armL: [-2.65, 0, 0.4], me_foreL: [-0.25, 0, 0], bodyY: 0.09 }],
    [1.2, { me_head: [0, 0, 0], me_armR: [0.05, 0, -0.12], me_foreR: [-0.18, 0, 0], me_armL: [0.05, 0, 0.12], me_foreL: [-0.18, 0, 0], bodyY: 0 }],
  ]);

  return { idle, walk, dance, pray, eat, eatStand, reach, pickupPole, hookStar, catchStar, celebrate };
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
export function createMe({ scene, nav, groundY, start, startFace = Math.PI * 0.75, onState, name = 'ME', gender = 'male', variant = 1 }) {
  const disposables = [];
  const SCALE = 0.9, SPEED = 3.6;
  const root = new THREE.Group(); root.name = 'me_root';
  root.scale.setScalar(SCALE);
  scene.add(root);

  let currentGender = (gender === 'female' ? 'female' : 'male');
  let currentVariant = (variant === 2 || variant === 3) ? variant : 1;
  let bodyDisposables = [];
  let props = null;
  let mixer = null;
  const clips = buildClips();
  let actions = {};
  let current = null;

  function play(clipName, fade = 0.3, syncTime) {
    const next = actions[clipName];
    if (!next) return;
    if (next === current) return;
    next.reset(); next.setEffectiveTimeScale(1); next.setEffectiveWeight(1);
    if (syncTime !== undefined) next.time = syncTime % next.getClip().duration;
    next.play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
  }

  function setupBody(g, v = currentVariant) {
    const prevClip = current ? current.getClip().name : 'idle';
    const prevTime = current ? current.time : 0;
    const wasHoldingPole = props?.hookPole?.visible ?? false;
    const wasBowlVisible = props?.bowl?.visible ?? false;
    currentGender = g;
    currentVariant = (v === 2 || v === 3) ? v : 1;

    bodyDisposables.forEach(o => o?.dispose?.());
    bodyDisposables = [];
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }
    const built = buildMe(bodyDisposables, { gender: currentGender, variant: currentVariant });
    root.add(built.body);
    props = built.props;
    if (props.hookPole) props.hookPole.visible = wasHoldingPole;
    if (props.bowl && props.spoon) props.bowl.visible = props.spoon.visible = wasBowlVisible;

    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    }
    mixer = new THREE.AnimationMixer(root);
    actions = Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, mixer.clipAction(c)]));
    current = null;
    play(prevClip, 0, prevTime);
  }

  setupBody(currentGender, currentVariant);

  // ground markers
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 28), ringMat); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 2;
  const destMat = new THREE.MeshBasicMaterial({ color: '#7a4fd1', transparent: true, opacity: 0.8, depthWrite: false });
  const dest = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 28), destMat); dest.rotation.x = -Math.PI / 2; dest.visible = false; dest.renderOrder = 2;
  scene.add(ring, dest);
  disposables.push(ringMat, ring.geometry, destMat, dest.geometry);

  // billboard labels
  const chip = makeSprite(disposables), bubble = makeSprite(disposables);
  let currentLabelName = (name || 'ME').trim() || 'ME';
  let chipTex = labelTexture(currentLabelName, { bg: '#4b3a33', fg: '#ffffff', border: '#ff9f43' }, disposables);
  chip.material.map = chipTex.tex; chip.material.needsUpdate = true;

  function setName(nextName) {
    const clean = (nextName || 'ME').trim() || 'ME';
    if (clean === currentLabelName) return;
    currentLabelName = clean;
    chipTex = labelTexture(currentLabelName, { bg: '#4b3a33', fg: '#ffffff', border: '#ff9f43' }, disposables);
    chip.material.map = chipTex.tex;
    chip.material.needsUpdate = true;
  }

  function setGender(nextGender, nextVariant = currentVariant) {
    const cleanG = (nextGender === 'female' ? 'female' : 'male');
    const cleanV = (nextVariant === 2 || nextVariant === 3) ? nextVariant : 1;
    if (cleanG === currentGender && cleanV === currentVariant) return;
    setupBody(cleanG, cleanV);
  }

  const bubbleTex = {};
  for (const [k, a] of Object.entries(ACTIVITY)) bubbleTex[k] = labelTexture(a.text, { bg: '#fffaf2', fg: '#4b3a33', border: a.border }, disposables);
  bubble.visible = false;
  scene.add(chip, bubble);

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
    props.hookPole.visible = false;
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
    } else if (t.kind === 'lucky') {
      play('idle', 0.25);
      t.onArrive?.();
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
        actions.walk.setEffectiveTimeScale(speed / 2.5);
        const step = speed * dt;
        if (dist <= step) { me.x = tx; me.z = tz; me.wp++; }
        else { me.x += (dx / dist) * step; me.z += (dz / dist) * step; }
        if (dist > 1e-3) me.face += wrapAngle(Math.atan2(dx, dz) - me.face) * Math.min(1, dt * 14);
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

  function resetToIdle() {
    me.kind = null; me.key = null; me.target = null;
    me.path = null; me.arrived = false; me.seated = false;
    props.bowl.visible = props.spoon.visible = false;
    hideBubble();
    dest.visible = false;
    play('idle', 0.35);
    setState(ME_STATE.IDLE);
  }

  return {
    get x() { return me.x; }, get y() { return me.y; }, get z() { return me.z; }, get state() { return me.state; },
    get kind() { return me.kind; }, get key() { return me.key; }, get target() { return me.target; },
    get position() { return _v.set(me.x, me.y, me.z); },
    get gender() { return currentGender; },
    goTo, update, setName, setGender, resetToIdle,
    showBubble(kind = me.kind) { showBubble(kind); },
    playAction(clipName, fade = 0.3) { play(clipName, fade); },
    setHoldingPole(v) { if (props?.hookPole) props.hookPole.visible = !!v; },
    dispose() {
      mixer?.stopAllAction(); mixer?.uncacheRoot(root);
      scene.remove(root, ring, dest, chip, bubble);
      bodyDisposables.forEach(o => o?.dispose?.());
      disposables.forEach(o => o?.dispose?.());
    },
  };
}
