import * as THREE from '../vendor/three.module.min.js';

// Deterministic PRNG for consistent crisp felt fiber textures
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return {
    r: Math.round(c.r * 255),
    g: Math.round(c.g * 255),
    b: Math.round(c.b * 255),
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Shared high-tactility wool felt bump map (512x512, cached once)
let _feltBumpTex = null;
let _feltRoughTex = null;
let _woodBumpTex = null;

export function getFeltBumpTexture() {
  if (_feltBumpTex) return _feltBumpTex;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(104729);

  // Neutral gray base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Soft mottled wool clouds
  for (let i = 0; i < 650; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 6 + rng() * 24;
    const lum = 105 + Math.floor(rng() * 50);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${lum},${lum},${lum},0.16)`);
    grad.addColorStop(1, `rgba(${lum},${lum},${lum},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cross-woven fine felt hairs (wrapped around edges for seamless tiling)
  ctx.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 5 + rng() * 14;
    const ang = rng() * Math.PI * 2;
    const bright = rng() > 0.45 ? 165 + Math.floor(rng() * 65) : 55 + Math.floor(rng() * 55);
    ctx.strokeStyle = `rgba(${bright},${bright},${bright},${0.16 + rng() * 0.24})`;
    ctx.lineWidth = 0.7 + rng() * 1.1;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    const cx = x + dx * 0.5 + (rng() - 0.5) * 4;
    const cy = y + dy * 0.5 + (rng() - 0.5) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, x + dx, y + dy);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  _feltBumpTex = tex;
  return tex;
}

export function getFeltRoughnessTexture() {
  if (_feltRoughTex) return _feltRoughTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(223344);
  ctx.fillStyle = '#e5e5e5';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const l = 4 + rng() * 10;
    const a = rng() * Math.PI * 2;
    const v = 205 + Math.floor(rng() * 48);
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  _feltRoughTex = tex;
  return tex;
}

function getWoodBumpTexture() {
  if (_woodBumpTex) return _woodBumpTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(991122);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    const v = 112 + Math.floor(Math.sin(y * 0.14) * 18 + (rng() - 0.5) * 16);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  _woodBumpTex = tex;
  return tex;
}

const _materialCache = new Map();

/**
 * Create a rich handmade felt / fabric material with visible fiber & optional pattern/stitching.
 */
export function createFeltMaterial(baseHex, options = {}) {
  const {
    pattern = 'solid', // solid | stripe | gingham | polka | waffle | stitch_border | knit
    accentHex = '#fff7e8',
    repeatX = 1,
    repeatY = 1,
    bumpScale = 0.032,
    roughness = 0.93,
    stitchBorder = false,
    stitchColor = '#fff7ea',
    seed = 1337,
  } = options;

  const key = `${baseHex}|${pattern}|${accentHex}|${repeatX}|${repeatY}|${stitchBorder}|${stitchColor}|${seed}`;
  if (_materialCache.has(key)) return _materialCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);
  const base = hexToRgb(baseHex);
  const acc = hexToRgb(accentHex);

  // Base fill
  ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  ctx.fillRect(0, 0, size, size);

  // Subtle wool heather mottling
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 10 + rng() * 34;
    const delta = (rng() - 0.5) * 26;
    const rr = clamp(Math.round(base.r + delta), 0, 255);
    const gg = clamp(Math.round(base.g + delta), 0, 255);
    const bb = clamp(Math.round(base.b + delta), 0, 255);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rr},${gg},${bb},0.22)`);
    g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fabric patterns
  if (pattern === 'stripe') {
    ctx.fillStyle = `rgba(${acc.r},${acc.g},${acc.b},0.62)`;
    const band = 64;
    for (let y = 0; y < size; y += band) {
      ctx.fillRect(0, y, size, 24);
      // Tiny woven thread stitch along stripe edge
      ctx.strokeStyle = `rgba(${acc.r},${acc.g},${acc.b},0.85)`;
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y + 27);
      ctx.lineTo(size, y + 27);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if (pattern === 'gingham') {
    const step = 64;
    ctx.fillStyle = `rgba(${acc.r},${acc.g},${acc.b},0.34)`;
    for (let x = 0; x < size; x += step * 2) {
      ctx.fillRect(x, 0, step, size);
    }
    for (let y = 0; y < size; y += step * 2) {
      ctx.fillRect(0, y, size, step);
    }
    // Slight darker weave intersection
    ctx.fillStyle = `rgba(${Math.max(0, base.r - 25)},${Math.max(0, base.g - 25)},${Math.max(0, base.b - 25)},0.16)`;
    for (let x = step; x < size; x += step * 2) {
      for (let y = step; y < size; y += step * 2) {
        ctx.fillRect(x, y, step, step);
      }
    }
  } else if (pattern === 'polka') {
    const step = 76;
    for (let y = 24; y < size; y += step) {
      const shift = Math.floor(y / step) % 2 === 0 ? 0 : step * 0.5;
      for (let x = -step; x < size + step; x += step) {
        ctx.fillStyle = `rgba(${acc.r},${acc.g},${acc.b},0.78)`;
        ctx.beginPath();
        ctx.arc(x + shift, y, 14, 0, Math.PI * 2);
        ctx.fill();
        // Tiny cross stitch inside polka dot
        ctx.strokeStyle = `rgba(${base.r},${base.g},${base.b},0.4)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + shift - 4, y - 4);
        ctx.lineTo(x + shift + 4, y + 4);
        ctx.moveTo(x + shift + 4, y - 4);
        ctx.lineTo(x + shift - 4, y + 4);
        ctx.stroke();
      }
    }
  } else if (pattern === 'waffle') {
    const step = 32;
    ctx.strokeStyle = `rgba(${Math.max(0, base.r - 36)},${Math.max(0, base.g - 36)},${Math.max(0, base.b - 36)},0.32)`;
    ctx.lineWidth = 3;
    for (let i = 0; i < size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,0.22)`;
    ctx.lineWidth = 2;
    for (let i = 4; i < size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  } else if (pattern === 'knit') {
    ctx.strokeStyle = `rgba(${acc.r},${acc.g},${acc.b},0.28)`;
    ctx.lineWidth = 3;
    const cw = 28;
    const ch = 22;
    for (let y = 0; y < size + ch; y += ch) {
      for (let x = 0; x < size + cw; x += cw) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cw * 0.5, y + ch * 0.65);
        ctx.lineTo(x + cw, y);
        ctx.stroke();
      }
    }
  }

  // Visible fine wool felt fibers over the pattern (unifies the craft look!)
  ctx.lineCap = 'round';
  for (let i = 0; i < 3000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 4 + rng() * 11;
    const ang = rng() * Math.PI * 2;
    const lift = rng() > 0.48 ? 28 : -24;
    const rr = clamp(base.r + lift, 0, 255);
    const gg = clamp(base.g + lift, 0, 255);
    const bb = clamp(base.b + lift, 0, 255);
    ctx.strokeStyle = `rgba(${rr},${gg},${bb},${0.16 + rng() * 0.16})`;
    ctx.lineWidth = 0.8 + rng() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  if (stitchBorder) {
    const pad = 22;
    ctx.strokeStyle = stitchColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.setLineDash([18, 14]);
    ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);
    ctx.setLineDash([]);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 2;

  const bump = getFeltBumpTexture();
  const rough = getFeltRoughnessTexture();

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale,
    roughnessMap: rough,
    roughness,
    metalness: 0.0,
  });

  _materialCache.set(key, mat);
  return mat;
}

/**
 * Warm craft-wood material for drawers, buttons, clothespins, trinket dish.
 */
export function createWoodMaterial(baseHex = '#cfa06e', options = {}) {
  const key = `wood|${baseHex}|${options.roughness ?? 0.68}`;
  if (_materialCache.has(key)) return _materialCache.get(key);

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(445566);
  const base = hexToRgb(baseHex);

  ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin(y * 0.09) * 10 + (rng() - 0.5) * 10;
    const rr = clamp(Math.round(base.r + wave), 0, 255);
    const gg = clamp(Math.round(base.g + wave * 0.85), 0, 255);
    const bb = clamp(Math.round(base.b + wave * 0.65), 0, 255);
    ctx.fillStyle = `rgba(${rr},${gg},${bb},0.48)`;
    ctx.fillRect(0, y, size, 2.5);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: getWoodBumpTexture(),
    bumpScale: 0.015,
    roughness: options.roughness ?? 0.68,
    metalness: 0.02,
  });
  _materialCache.set(key, mat);
  return mat;
}

/**
 * Patchwork quilted tabletop texture with visible stitched diamond seams.
 */
export function createQuiltTableMaterial() {
  const key = 'quilt_table_main';
  if (_materialCache.has(key)) return _materialCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(778899);

  const patches = ['#f2e4cf', '#ead8be', '#f5ead9', '#e5d1b5'];
  const tile = 128;
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      ctx.fillStyle = patches[(px + py) % patches.length];
      ctx.fillRect(px * tile, py * tile, tile, tile);
    }
  }

  // Soft linen cross-weave
  for (let i = 0; i < 3600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const horiz = rng() > 0.5;
    const l = 6 + rng() * 14;
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(255,252,244,0.22)' : 'rgba(155,125,92,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(horiz ? x + l : x, horiz ? y : y + l);
    ctx.stroke();
  }

  // Hand-stitched patchwork seam lines
  ctx.strokeStyle = '#c8ab87';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  for (let i = tile; i < size; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2.5);

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: getFeltBumpTexture(),
    bumpScale: 0.025,
    roughness: 0.94,
    metalness: 0,
  });
  _materialCache.set(key, mat);
  return mat;
}

/**
 * Quilted cream folding pad material with visible diamond quilting & warm stitched border.
 */
export function createFoldingMatMaterial() {
  const key = 'folding_mat_quilt';
  if (_materialCache.has(key)) return _materialCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(55123);

  ctx.fillStyle = '#fbf4e6';
  ctx.fillRect(0, 0, size, size);

  // Soft fabric fibers
  for (let i = 0; i < 2400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const l = 5 + rng() * 10;
    const a = rng() * Math.PI * 2;
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(190,168,138,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }

  // Diamond quilting stitches
  ctx.strokeStyle = 'rgba(196, 168, 134, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 8]);
  const step = 64;
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Outer warm blanket border
  ctx.strokeStyle = '#d8a679';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, size - 20, size - 20);

  // Inner dashed embroidery frame
  ctx.strokeStyle = '#c58758';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(28, 28, size - 56, size - 56);
  ctx.setLineDash([]);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: getFeltBumpTexture(),
    bumpScale: 0.022,
    roughness: 0.92,
    metalness: 0,
  });
  _materialCache.set(key, mat);
  return mat;
}

/**
 * Woven fabric basket texture (plump stitched cloth rope coils).
 */
export function createBasketWeaveMaterial() {
  const key = 'basket_rope_weave';
  if (_materialCache.has(key)) return _materialCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(88321);

  ctx.fillStyle = '#e5cfad';
  ctx.fillRect(0, 0, size, size);

  const rowH = 32;
  for (let y = 0; y < size; y += rowH) {
    const grad = ctx.createLinearGradient(0, y, 0, y + rowH);
    grad.addColorStop(0, '#c7a97e');
    grad.addColorStop(0.35, '#eedbc0');
    grad.addColorStop(0.75, '#e2caa3');
    grad.addColorStop(1, '#b69468');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, size, rowH);

    // Thick zigzag whip-stitches holding coiled cloth rope together!
    ctx.strokeStyle = '#b47a4c';
    ctx.lineWidth = 3;
    for (let x = 0; x < size; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + 14, y + rowH - 4);
      ctx.stroke();
    }
  }

  // Felt fuzz
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,250,240,0.2)' : 'rgba(130,96,60,0.14)';
    ctx.fillRect(x, y, 3, 1.5);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 1.4);

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: getFeltBumpTexture(),
    bumpScale: 0.04,
    roughness: 0.9,
    metalness: 0,
  });
  _materialCache.set(key, mat);
  return mat;
}

/**
 * Helper to build actual 3D raised embroidery stitches along a path of Vector3 points.
 * Uses InstancedMesh for tiny triangle/draw-call cost while looking authentically stitched!
 */
const _stitchCapsuleGeo = new THREE.CapsuleGeometry(0.016, 0.055, 3, 5);
_stitchCapsuleGeo.rotateZ(Math.PI / 2);

const _stitchMatCache = new Map();
export function getStitchMaterial(colorHex = '#fff8ec') {
  if (_stitchMatCache.has(colorHex)) return _stitchMatCache.get(colorHex);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.85,
    metalness: 0,
  });
  _stitchMatCache.set(colorHex, mat);
  return mat;
}

/**
 * Creates a lightweight 3D stitched seam along a polyline (array of [x, y, z]).
 */
export function create3DStitchLine(points, options = {}) {
  const {
    color = '#fff8ec',
    spacing = 0.13,
    scale = 1.0,
    closed = false,
  } = options;

  const vecs = points.map((p) => (p instanceof THREE.Vector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  if (closed && vecs.length > 1) vecs.push(vecs[0].clone());

  const transforms = [];
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);
  const mat4 = new THREE.Matrix4();
  const scl = new THREE.Vector3(scale, scale, scale);

  for (let i = 0; i < vecs.length - 1; i++) {
    const a = vecs[i];
    const b = vecs[i + 1];
    const dist = a.distanceTo(b);
    if (dist < 0.01) continue;
    dir.subVectors(b, a).normalize();
    const count = Math.max(1, Math.floor(dist / spacing));
    quat.setFromUnitVectors(xAxis, dir);
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const pos = new THREE.Vector3().lerpVectors(a, b, t);
      mat4.compose(pos, quat, scl);
      transforms.push(mat4.clone());
    }
  }

  const mesh = new THREE.InstancedMesh(_stitchCapsuleGeo, getStitchMaterial(color), Math.max(1, transforms.length));
  transforms.forEach((m, idx) => mesh.setMatrixAt(idx, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * Creates a cute 3D wooden craft button with 4 holes & crossed embroidery thread X!
 */
export function createCraftButton(options = {}) {
  const {
    radius = 0.12,
    thickness = 0.045,
    color = '#d89d63',
    threadColor = '#fff7eb',
    isWood = true,
  } = options;

  const group = new THREE.Group();
  const baseMat = isWood
    ? createWoodMaterial(color, { roughness: 0.55 })
    : createFeltMaterial(color, { roughness: 0.72, bumpScale: 0.012 });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.96, thickness, 18),
    baseMat
  );
  disc.castShadow = true;
  disc.receiveShadow = true;
  group.add(disc);

  // Raised rim bevel ring
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.85, thickness * 0.22, 6, 18),
    baseMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = thickness * 0.42;
  group.add(rim);

  // 4 button holes
  const holeMat = new THREE.MeshStandardMaterial({ color: '#4a3525', roughness: 0.95 });
  const holeGeo = new THREE.CylinderGeometry(radius * 0.11, radius * 0.11, thickness * 0.25, 8);
  const off = radius * 0.28;
  for (const [hx, hz] of [[-off, -off], [off, -off], [-off, off], [off, off]]) {
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(hx, thickness * 0.45, hz);
    group.add(hole);
  }

  // Crossed thread X stitches!
  const threadMat = getStitchMaterial(threadColor);
  const threadGeo = new THREE.CapsuleGeometry(radius * 0.085, off * 2.1, 3, 6);
  threadGeo.rotateZ(Math.PI / 2);

  const t1 = new THREE.Mesh(threadGeo, threadMat);
  t1.position.y = thickness * 0.54;
  t1.rotation.y = Math.PI / 4;
  group.add(t1);

  const t2 = new THREE.Mesh(threadGeo, threadMat);
  t2.position.y = thickness * 0.58;
  t2.rotation.y = -Math.PI / 4;
  group.add(t2);

  return group;
}
