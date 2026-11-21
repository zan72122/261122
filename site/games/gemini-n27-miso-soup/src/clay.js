import * as THREE from 'three';

// Deterministic PRNG for consistent organic clay sculpting
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 3D value noise for organic hand-kneaded clay shapes (crack-free on seams)
function hash3(x, y, z, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1597334677);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function smoothNoise3D(x, y, z, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);

  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return (y0 + (y1 - y0) * w) * 2 - 1;
}

/**
 * Hand-sculpts a geometry with subtle clay thumb-dents and organic warmth.
 * Uses pure position-based noise so UV seams stay 100% watertight.
 */
export function sculptClay(geometry, amount = 0.025, freq = 2.6, seed = 7) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = smoothNoise3D(x * freq, y * freq, z * freq, seed);
    const ny = smoothNoise3D(x * freq + 13.7, y * freq + 5.1, z * freq + 9.3, seed + 31);
    const nz = smoothNoise3D(x * freq + 27.4, y * freq + 19.8, z * freq + 2.7, seed + 73);
    // Secondary fine thumb-press wobble
    const fine = smoothNoise3D(x * freq * 2.3, y * freq * 2.3, z * freq * 2.3, seed + 113) * 0.35;
    pos.setXYZ(
      i,
      x + (nx + fine) * amount,
      y + (ny + fine) * amount,
      z + (nz + fine) * amount
    );
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Create a plump rounded box (like a hand-shaped block of clay or tofu).
 */
export function createPlumpBoxGeometry(w, h, d, radius = 0.08, segs = 5) {
  const geo = new THREE.BoxGeometry(w, h, d, segs * 2, segs * 2, segs * 2);
  const pos = geo.attributes.position;
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  const r = Math.min(radius, hw * 0.85, hh * 0.85, hd * 0.85);
  const iw = hw - r;
  const ih = hh - r;
  const id = hd - r;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const cx = Math.max(-iw, Math.min(iw, x));
    const cy = Math.max(-ih, Math.min(ih, y));
    const cz = Math.max(-id, Math.min(id, z));
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-5) {
      // Slightly pillowed faces for plush clay feel
      const puff = 1 + 0.03 * (1 - Math.abs(cx / (hw || 1))) * (1 - Math.abs(cz / (hd || 1)));
      pos.setXYZ(i, (cx + (dx / len) * r) * puff, (cy + (dy / len) * r) * puff, (cz + (dz / len) * r) * puff);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Shared procedural clay textures (all <= 512px for crisp iPhone/iPad performance)
let cachedTextures = null;

export function getClayTextures() {
  if (cachedTextures) return cachedTextures;

  // 1. Clay fingerprint & matte grain bump map (512x512)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  const rand = mulberry32(20261122);
  // Soft kneaded clay blotches
  for (let i = 0; i < 160; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 18 + rand() * 55;
    const val = Math.floor(110 + rand() * 36);
    const grad = bctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, `rgba(${val},${val},${val},0.22)`);
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  // Subtle concentric thumbprint whorls (hallmark of real claymation!)
  for (let p = 0; p < 16; p++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const angle = rand() * Math.PI * 2;
    const rings = 5 + Math.floor(rand() * 4);
    bctx.save();
    bctx.translate(cx, cy);
    bctx.rotate(angle);
    bctx.scale(1, 0.68);
    bctx.strokeStyle = 'rgba(155,155,155,0.16)';
    bctx.lineWidth = 2.2;
    for (let k = 1; k <= rings; k++) {
      bctx.beginPath();
      bctx.arc(0, 0, k * 6.5, 0.2, Math.PI * 1.65);
      bctx.stroke();
    }
    bctx.restore();
  }

  // Fine matte micro-grain
  const imgData = bctx.getImageData(0, 0, 512, 512);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const grain = (rand() - 0.5) * 18;
    const v = Math.max(0, Math.min(255, d[i] + grain));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  bctx.putImageData(imgData, 0, 0);

  const clayBump = new THREE.CanvasTexture(bumpCanvas);
  clayBump.wrapS = THREE.RepeatWrapping;
  clayBump.wrapT = THREE.RepeatWrapping;
  clayBump.repeat.set(2, 2);

  // 2. Warm handcrafted clay wood counter texture (512x512)
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#dcb07e';
  wctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 6) {
    const shade = Math.sin(y * 0.045) * 10 + (rand() - 0.5) * 8;
    wctx.fillStyle = `rgb(${216 + shade}, ${169 + shade * 0.8}, ${118 + shade * 0.6})`;
    wctx.fillRect(0, y, 512, 7);
  }
  // Soft clay-carved wood rings
  wctx.strokeStyle = 'rgba(145, 96, 52, 0.22)';
  wctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const y0 = rand() * 512;
    wctx.beginPath();
    wctx.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 32) {
      wctx.lineTo(x, y0 + Math.sin(x * 0.018 + i) * 7);
    }
    wctx.stroke();
  }
  // Subtle plank seams
  wctx.strokeStyle = 'rgba(120, 76, 38, 0.24)';
  wctx.lineWidth = 4;
  for (let py = 128; py < 512; py += 128) {
    wctx.beginPath();
    wctx.moveTo(0, py);
    wctx.lineTo(512, py);
    wctx.stroke();
  }
  const woodMap = new THREE.CanvasTexture(woodCanvas);
  woodMap.wrapS = THREE.RepeatWrapping;
  woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.repeat.set(2.5, 2.5);

  // 3. Hand-pressed ceramic clay kitchen tiles (512x512)
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = 512;
  tileCanvas.height = 512;
  const tctx = tileCanvas.getContext('2d');
  tctx.fillStyle = '#e6d8c3';
  tctx.fillRect(0, 0, 512, 512);
  const cols = 4;
  const rows = 4;
  const tw = 512 / cols;
  const th = 512 / rows;
  const tilePalette = ['#fbf4e6', '#f7edd9', '#f4e8d2', '#faf1e1', '#efe2c8'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = tilePalette[Math.floor(rand() * tilePalette.length)];
      const x = c * tw + 6;
      const y = r * th + 6;
      const w = tw - 12;
      const h = th - 12;
      tctx.fillStyle = col;
      tctx.beginPath();
      tctx.roundRect(x, y, w, h, 14);
      tctx.fill();
      // Gentle pillowed highlight on each clay tile
      const g = tctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(175,145,105,0.18)');
      tctx.fillStyle = g;
      tctx.beginPath();
      tctx.roundRect(x, y, w, h, 14);
      tctx.fill();
    }
  }
  const tileMap = new THREE.CanvasTexture(tileCanvas);
  tileMap.wrapS = THREE.RepeatWrapping;
  tileMap.wrapT = THREE.RepeatWrapping;
  tileMap.colorSpace = THREE.SRGBColorSpace;
  tileMap.repeat.set(4, 2);

  // 4. Soft miso cloud swirl texture for liquid surface (512x512)
  const soupCanvas = document.createElement('canvas');
  soupCanvas.width = 512;
  soupCanvas.height = 512;
  const sctx = soupCanvas.getContext('2d');
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const dist = 30 + rand() * 170;
    const x = 256 + Math.cos(a) * dist;
    const y = 256 + Math.sin(a) * dist;
    const rad = 35 + rand() * 65;
    const shade = i % 2 === 0 ? 'rgba(255,244,218,0.28)' : 'rgba(182,118,52,0.16)';
    const g = sctx.createRadialGradient(x, y, 4, x, y, rad);
    g.addColorStop(0, shade);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(x, y, rad, 0, Math.PI * 2);
    sctx.fill();
  }
  const soupSwirlMap = new THREE.CanvasTexture(soupCanvas);
  soupSwirlMap.colorSpace = THREE.SRGBColorSpace;

  cachedTextures = { clayBump, woodMap, tileMap, soupSwirlMap };
  return cachedTextures;
}

/**
 * Standard plump matte clay material (Plasticine / Sculpey feel)
 */
export function makeClayMaterial(color, opts = {}) {
  const { clayBump } = getClayTextures();
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.0,
    bumpMap: opts.noBump ? null : clayBump,
    bumpScale: opts.bumpScale ?? 0.018,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

/**
 * Glossy glazed ceramic / lacquer / wet clay material
 */
export function makeGlossClayMaterial(color, opts = {}) {
  const { clayBump } = getClayTextures();
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.24,
    metalness: opts.metalness ?? 0.02,
    clearcoat: opts.clearcoat ?? 0.55,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.22,
    bumpMap: opts.noBump ? null : clayBump,
    bumpScale: opts.bumpScale ?? 0.008,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

/**
 * Spring squash-and-stretch helper for claymation tactile bounce
 */
export class ClaySpring {
  constructor(stiffness = 180, damping = 13) {
    this.value = 0;
    this.vel = 0;
    this.target = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  impulse(v) {
    this.vel += v;
  }
  step(dt) {
    const clamped = Math.min(dt, 0.04);
    const force = (this.target - this.value) * this.stiffness;
    this.vel = (this.vel + force * clamped) * Math.exp(-this.damping * clamped);
    this.value += this.vel * clamped;
    return this.value;
  }
}

/**
 * Apply volume-preserving clay squash & stretch to a mesh/group
 * amount > 0 stretches vertically (tall), amount < 0 squashes horizontally (wide)
 */
export function applySquash(obj, amount, baseScale = 1) {
  const s = Math.max(-0.32, Math.min(0.35, amount));
  const sy = 1 + s;
  const sxz = 1 / Math.sqrt(Math.max(0.45, sy));
  obj.scale.set(baseScale * sxz, baseScale * sy, baseScale * sxz);
}
