import * as THREE from '../vendor/three.module.js';

// Deterministic fast PRNG & 2D value/fBm noise for photographic procedural textures
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

function hash2(x, y, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise2(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2(x, y, seed, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise2(x * freq, y * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return val / norm;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = [1, 1], wrap = THREE.RepeatWrapping, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// 1. Hinoki wooden cutting board (warm Japanese cypress with fine grain, subtle knife marks, darkened wet center)
export function createWoodBoardTextures() {
  const size = 512;
  const cMap = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const cRough = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const ctxR = cRough.getContext('2d');

  const imgM = ctxM.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const warp = fbm2(nx * 2.5, ny * 6.0, 11, 4) * 0.25;
      const rings = Math.sin((ny * 28 + warp * 14) * Math.PI * 2) * 0.5 + 0.5;
      const fine = fbm2(nx * 42, ny * 6, 23, 3);
      const pores = smoothNoise2(nx * 140, ny * 18, 37);
      const grain = rings * 0.55 + fine * 0.35 + pores * 0.1;

      // Subtle damp culinary wear in center of cutting board
      const dx = (nx - 0.5) * 1.6;
      const dy = (ny - 0.52) * 2.0;
      const centerWet = Math.max(0, 1 - (dx * dx + dy * dy));
      const damp = centerWet * centerWet * 0.14;

      const r = Math.min(255, Math.max(0, (214 - grain * 42 - damp * 55) | 0));
      const g = Math.min(255, Math.max(0, (176 - grain * 44 - damp * 52) | 0));
      const b = Math.min(255, Math.max(0, (124 - grain * 36 - damp * 44) | 0));

      const idx = (y * size + x) * 4;
      imgM.data[idx] = r;
      imgM.data[idx + 1] = g;
      imgM.data[idx + 2] = b;
      imgM.data[idx + 3] = 255;

      const bVal = Math.min(255, Math.max(0, (130 + (grain - 0.5) * 70) | 0));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = bVal;
      imgB.data[idx + 3] = 255;

      const rVal = Math.min(255, Math.max(0, (195 + grain * 35 - damp * 95) | 0));
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rVal;
      imgR.data[idx + 3] = 255;
    }
  }
  ctxM.putImageData(imgM, 0, 0);
  ctxB.putImageData(imgB, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  // Add realistic faint knife-score marks near center
  const rng = mulberry32(901);
  for (let i = 0; i < 65; i++) {
    const cx = size * (0.2 + rng() * 0.6);
    const cy = size * (0.25 + rng() * 0.5);
    const len = 18 + rng() * 68;
    const ang = (rng() - 0.5) * 0.28 + Math.PI * 0.5;
    const x1 = cx - Math.cos(ang) * len * 0.5;
    const y1 = cy - Math.sin(ang) * len * 0.5;
    const x2 = cx + Math.cos(ang) * len * 0.5;
    const y2 = cy + Math.sin(ang) * len * 0.5;

    ctxM.strokeStyle = `rgba(98, 66, 36, ${0.06 + rng() * 0.11})`;
    ctxM.lineWidth = 0.7 + rng() * 0.9;
    ctxM.beginPath();
    ctxM.moveTo(x1, y1);
    ctxM.lineTo(x2, y2);
    ctxM.stroke();

    ctxB.strokeStyle = `rgba(40, 40, 40, ${0.22 + rng() * 0.28})`;
    ctxB.lineWidth = 1.0;
    ctxB.beginPath();
    ctxB.moveTo(x1, y1);
    ctxB.lineTo(x2, y2);
    ctxB.stroke();
  }

  return {
    map: toTexture(cMap, { srgb: true }),
    bumpMap: toTexture(cBump, { srgb: false }),
    roughnessMap: toTexture(cRough, { srgb: false }),
  };
}

// 2. Brushed stainless steel kitchen counter
export function createStainlessTextures() {
  const size = 512;
  const cMap = makeCanvas(size, size);
  const cRough = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const streak = smoothNoise2(0, y * 0.85, 501);
    for (let x = 0; x < size; x++) {
      const fine = smoothNoise2(x * 0.04, y * 1.4, 509);
      const blotch = fbm2(x / 120, y / 120, 521, 3);
      const val = streak * 0.45 + fine * 0.35 + blotch * 0.2;
      const idx = (y * size + x) * 4;

      const base = (176 + (val - 0.5) * 30) | 0;
      imgM.data[idx] = Math.min(255, base + 4);
      imgM.data[idx + 1] = Math.min(255, base + 2);
      imgM.data[idx + 2] = Math.min(255, base);
      imgM.data[idx + 3] = 255;

      const rv = Math.min(255, Math.max(0, (76 + val * 58 + blotch * 28) | 0));
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rv;
      imgR.data[idx + 3] = 255;

      const bv = Math.min(255, Math.max(0, (118 + (fine - 0.5) * 34) | 0));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = bv;
      imgB.data[idx + 3] = 255;
    }
  }
  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  // Subtle circular micro-scratches from pots
  const rng = mulberry32(771);
  ctxR.strokeStyle = 'rgba(170,170,170,0.16)';
  for (let i = 0; i < 45; i++) {
    ctxR.lineWidth = 0.7;
    ctxR.beginPath();
    const x = rng() * size;
    const y = rng() * size;
    ctxR.arc(x, y, 8 + rng() * 32, rng() * 6.28, rng() * 6.28);
    ctxR.stroke();
  }

  return {
    map: toTexture(cMap, { srgb: true, repeat: [2.5, 2.0] }),
    roughnessMap: toTexture(cRough, { srgb: false, repeat: [2.5, 2.0] }),
    bumpMap: toTexture(cBump, { srgb: false, repeat: [2.5, 2.0] }),
  };
}

// 3. Japanese kitchen ceramic tile backsplash (warm off-white glazed tiles with realistic mortar)
export function createTileTextures() {
  const size = 512;
  const cMap = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const cRough = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const ctxR = cRough.getContext('2d');

  // Grout background
  ctxM.fillStyle = '#a99e90';
  ctxM.fillRect(0, 0, size, size);
  ctxB.fillStyle = '#383838';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = '#e0e0e0';
  ctxR.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const tw = size / cols;
  const th = size / rows;
  const grout = 4;
  const rng = mulberry32(313);

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset + grout * 0.5;
      const y = r * th + grout * 0.5;
      const w = tw - grout;
      const h = th - grout;

      const warmShift = (rng() - 0.5) * 14;
      const lum = 232 + (rng() - 0.5) * 10;
      const grad = ctxM.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, `rgb(${(lum + 6 + warmShift) | 0}, ${(lum + 1 + warmShift * 0.8) | 0}, ${(lum - 8 + warmShift * 0.4) | 0})`);
      grad.addColorStop(1, `rgb(${(lum - 4 + warmShift) | 0}, ${(lum - 10 + warmShift * 0.8) | 0}, ${(lum - 20 + warmShift * 0.4) | 0})`);
      ctxM.fillStyle = grad;
      ctxM.fillRect(x, y, w, h);

      // Slight ceramic glaze bevel on bump
      ctxB.fillStyle = '#d6d6d6';
      ctxB.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctxB.strokeStyle = '#999999';
      ctxB.lineWidth = 2;
      ctxB.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Glossy glaze roughness
      const rg = (36 + rng() * 18) | 0;
      ctxR.fillStyle = `rgb(${rg},${rg},${rg})`;
      ctxR.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
  }

  return {
    map: toTexture(cMap, { srgb: true, repeat: [3.2, 1.8] }),
    bumpMap: toTexture(cBump, { srgb: false, repeat: [3.2, 1.8] }),
    roughnessMap: toTexture(cRough, { srgb: false, repeat: [3.2, 1.8] }),
  };
}

// 4. Human Skin Textures (photorealistic warm Japanese adult hands: pores, fine knuckle creases, subtle undertone blush)
export function createSkinTextures() {
  const size = 512;
  const cMap = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const cRough = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const ctxR = cRough.getContext('2d');

  const imgM = ctxM.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const macro = fbm2(nx * 5.0, ny * 5.0, 101, 4);
      const micro = fbm2(nx * 28.0, ny * 28.0, 107, 3);
      const pore = smoothNoise2(nx * 110.0, ny * 110.0, 113);
      // Subtle epidermal diamond lines
      const creaseA = Math.sin((nx * 60 + ny * 35 + macro * 2.5) * Math.PI) * 0.5 + 0.5;
      const creaseB = Math.sin((nx * 45 - ny * 52 + macro * 2.0) * Math.PI) * 0.5 + 0.5;
      const skinGrid = (creaseA * creaseB) * 0.4 + pore * 0.6;

      // Warm realistic Japanese adult skin palette with rosy knuckle/blood-flow mottling + faint dorsal veins!
      const blush = Math.max(0, fbm2(nx * 3.2 + 4.1, ny * 3.2 + 1.7, 131, 3) - 0.32);
      const veinField = Math.abs(Math.sin((nx * 6.5 + fbm2(nx * 4, ny * 4, 149, 3) * 2.2) * Math.PI));
      const vein = veinField < 0.045 ? (0.045 - veinField) * 14.0 : 0;
      const r = Math.min(255, Math.max(0, (224 + (macro - 0.5) * 22 + blush * 26 - (1 - micro) * 12 - vein * 14) | 0));
      const g = Math.min(255, Math.max(0, (174 + (macro - 0.5) * 18 - blush * 8 - (1 - micro) * 12 - vein * 7) | 0));
      const b = Math.min(255, Math.max(0, (142 + (macro - 0.5) * 16 - blush * 12 - (1 - micro) * 10 + vein * 3) | 0));

      const idx = (y * size + x) * 4;
      imgM.data[idx] = r;
      imgM.data[idx + 1] = g;
      imgM.data[idx + 2] = b;
      imgM.data[idx + 3] = 255;

      const bVal = Math.min(255, Math.max(0, (124 + (skinGrid - 0.5) * 56 + (micro - 0.5) * 28) | 0));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = bVal;
      imgB.data[idx + 3] = 255;

      // Natural skin oiliness sheen (roughness ~0.46-0.64)
      const rVal = Math.min(255, Math.max(0, (132 + (1 - pore) * 34 + (macro - 0.5) * 24) | 0));
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rVal;
      imgR.data[idx + 3] = 255;
    }
  }
  ctxM.putImageData(imgM, 0, 0);
  ctxB.putImageData(imgB, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  // Subtle horizontal knuckle wrinkle bands along V
  for (let i = 0; i < 24; i++) {
    const y = (i / 24) * size;
    ctxB.strokeStyle = 'rgba(70,70,70,0.14)';
    ctxB.lineWidth = 1.2;
    ctxB.beginPath();
    ctxB.moveTo(0, y);
    ctxB.bezierCurveTo(size * 0.33, y + 3, size * 0.66, y - 3, size, y);
    ctxB.stroke();
  }

  return {
    map: toTexture(cMap, { srgb: true, repeat: [2, 2] }),
    bumpMap: toTexture(cBump, { srgb: false, repeat: [2, 2] }),
    roughnessMap: toTexture(cRough, { srgb: false, repeat: [2, 2] }),
  };
}

// 5. Carrot outer skin (horizontal lenticel ridges, earthy slightly matte skin) + wet peeled inner flesh + cross-section core
export function createCarrotTextures() {
  const size = 512;
  // Outer skin
  const cSkin = makeCanvas(size, size);
  const cSkinB = makeCanvas(size, size);
  const ctxS = cSkin.getContext('2d');
  const ctxSB = cSkinB.getContext('2d');
  const imgS = ctxS.createImageData(size, size);
  const imgSB = ctxSB.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ringBand = Math.sin((y / size) * 44 * Math.PI) * 0.5 + 0.5;
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const n1 = fbm2(nx * 8, ny * 22, 211, 4);
      const lenticel = smoothNoise2(nx * 14, ny * 85, 223);
      const ridge = lenticel > 0.72 ? (lenticel - 0.72) * 3.2 : 0;

      // Slightly desaturated natural carrot skin with earthy flecks
      const r = Math.min(255, Math.max(0, (206 - ridge * 68 + (n1 - 0.5) * 34) | 0));
      const g = Math.min(255, Math.max(0, (92 - ridge * 38 + (n1 - 0.5) * 26) | 0));
      const b = Math.min(255, Math.max(0, (28 - ridge * 14 + (n1 - 0.5) * 14) | 0));

      const idx = (y * size + x) * 4;
      imgS.data[idx] = r;
      imgS.data[idx + 1] = g;
      imgS.data[idx + 2] = b;
      imgS.data[idx + 3] = 255;

      const bv = Math.min(255, Math.max(0, (140 - ridge * 95 + (ringBand - 0.5) * 28) | 0));
      imgSB.data[idx] = imgSB.data[idx + 1] = imgSB.data[idx + 2] = bv;
      imgSB.data[idx + 3] = 255;
    }
  }
  ctxS.putImageData(imgS, 0, 0);
  ctxSB.putImageData(imgSB, 0, 0);

  // Peeled wet bright inner flesh
  const cInner = makeCanvas(size, size);
  const ctxI = cInner.getContext('2d');
  const imgI = ctxI.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const streak = fbm2(nx * 12, ny * 38, 239, 3);
      const idx = (y * size + x) * 4;
      imgI.data[idx] = Math.min(255, (238 + (streak - 0.5) * 22) | 0);
      imgI.data[idx + 1] = Math.min(255, (108 + (streak - 0.5) * 24) | 0);
      imgI.data[idx + 2] = Math.min(255, (24 + (streak - 0.5) * 12) | 0);
      imgI.data[idx + 3] = 255;
    }
  }
  ctxI.putImageData(imgI, 0, 0);

  // Cross-section core ring (photorealistic xylem core & cambium ring)
  const cCore = makeCanvas(256, 256);
  const ctxC = cCore.getContext('2d');
  const imgC = ctxC.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128;
      const dy = (y - 128) / 128;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);
      const radial = Math.sin(ang * 18) * 0.04 + fbm2(x / 24, y / 24, 251, 3) * 0.14;
      const coreRing = Math.exp(-Math.pow((dist - 0.44) / 0.06, 2));
      const inner = dist < 0.44 ? 1 : 0;
      const idx = (y * 256 + x) * 4;
      const r = Math.min(255, Math.max(0, (240 + inner * 12 - coreRing * 24 + radial * 35) | 0));
      const g = Math.min(255, Math.max(0, (112 + inner * 36 - coreRing * 28 + radial * 28) | 0));
      const b = Math.min(255, Math.max(0, (26 + inner * 18 + radial * 14) | 0));
      imgC.data[idx] = r;
      imgC.data[idx + 1] = g;
      imgC.data[idx + 2] = b;
      imgC.data[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);

  return {
    skinMap: toTexture(cSkin, { srgb: true }),
    skinBump: toTexture(cSkinB, { srgb: false }),
    innerMap: toTexture(cInner, { srgb: true }),
    coreMap: toTexture(cCore, { srgb: true }),
  };
}

// 6. Potato outer skin (golden-tan Danshaku/May Queen skin with earthy specks & eyes) + creamy wet starchy interior
export function createPotatoTextures() {
  const size = 512;
  const cSkin = makeCanvas(size, size);
  const cSkinB = makeCanvas(size, size);
  const ctxS = cSkin.getContext('2d');
  const ctxSB = cSkinB.getContext('2d');
  const imgS = ctxS.createImageData(size, size);
  const imgSB = ctxSB.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const mottle = fbm2(nx * 6, ny * 6, 307, 4);
      const grain = smoothNoise2(nx * 64, ny * 64, 311);
      const speck = smoothNoise2(nx * 46, ny * 46, 317) > 0.8 ? 1 : 0;

      const idx = (y * size + x) * 4;
      imgS.data[idx] = Math.min(255, Math.max(0, (176 + (mottle - 0.5) * 44 - speck * 45) | 0));
      imgS.data[idx + 1] = Math.min(255, Math.max(0, (141 + (mottle - 0.5) * 38 - speck * 40) | 0));
      imgS.data[idx + 2] = Math.min(255, Math.max(0, (92 + (mottle - 0.5) * 30 - speck * 32) | 0));
      imgS.data[idx + 3] = 255;

      const bv = Math.min(255, Math.max(0, (128 + (grain - 0.5) * 65 - speck * 55) | 0));
      imgSB.data[idx] = imgSB.data[idx + 1] = imgSB.data[idx + 2] = bv;
      imgSB.data[idx + 3] = 255;
    }
  }
  ctxS.putImageData(imgS, 0, 0);
  ctxSB.putImageData(imgSB, 0, 0);

  // Subtle potato "eyes"
  const rng = mulberry32(419);
  for (let i = 0; i < 12; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 5 + rng() * 6;
    const grad = ctxS.createRadialGradient(x, y, 1, x, y, rad);
    grad.addColorStop(0, 'rgba(72, 52, 30, 0.72)');
    grad.addColorStop(0.6, 'rgba(110, 82, 48, 0.35)');
    grad.addColorStop(1, 'rgba(110, 82, 48, 0)');
    ctxS.fillStyle = grad;
    ctxS.beginPath();
    ctxS.arc(x, y, rad, 0, Math.PI * 2);
    ctxS.fill();

    ctxSB.fillStyle = 'rgba(20, 20, 20, 0.65)';
    ctxSB.beginPath();
    ctxSB.arc(x, y, rad * 0.65, 0, Math.PI * 2);
    ctxSB.fill();
  }

  // Creamy moist peeled potato flesh
  const cInner = makeCanvas(size, size);
  const ctxI = cInner.getContext('2d');
  const imgI = ctxI.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x / 42, y / 42, 349, 3);
      const starch = smoothNoise2(x / 6, y / 6, 353);
      const idx = (y * size + x) * 4;
      imgI.data[idx] = Math.min(255, (242 + (n - 0.5) * 14 + (starch - 0.5) * 8) | 0);
      imgI.data[idx + 1] = Math.min(255, (226 + (n - 0.5) * 16 + (starch - 0.5) * 8) | 0);
      imgI.data[idx + 2] = Math.min(255, (176 + (n - 0.5) * 18) | 0);
      imgI.data[idx + 3] = 255;
    }
  }
  ctxI.putImageData(imgI, 0, 0);

  return {
    skinMap: toTexture(cSkin, { srgb: true }),
    skinBump: toTexture(cSkinB, { srgb: false }),
    innerMap: toTexture(cInner, { srgb: true }),
  };
}

// 7. Cast-iron matte enamel pot texture
export function createCastIronTextures() {
  const size = 256;
  const cBump = makeCanvas(size, size);
  const cRough = makeCanvas(size, size);
  const ctxB = cBump.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgB = ctxB.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = smoothNoise2(x * 0.45, y * 0.45, 601) * 0.6 + smoothNoise2(x * 0.14, y * 0.14, 607) * 0.4;
      const idx = (y * size + x) * 4;
      const b = (110 + n * 42) | 0;
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = b;
      imgB.data[idx + 3] = 255;
      const r = (145 + n * 50) | 0;
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = r;
      imgR.data[idx + 3] = 255;
    }
  }
  ctxB.putImageData(imgB, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  return {
    bumpMap: toTexture(cBump, { srgb: false, repeat: [3, 2] }),
    roughnessMap: toTexture(cRough, { srgb: false, repeat: [3, 2] }),
  };
}

// 8. Steaming Koshihikari Rice texture (hundreds of individual glossy oval grains packed together!)
export function createRiceTextures() {
  const size = 512;
  const cMap = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const cRough = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const ctxR = cRough.getContext('2d');

  ctxM.fillStyle = '#ddd6c8';
  ctxM.fillRect(0, 0, size, size);
  ctxB.fillStyle = '#404040';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = '#b0b0b0';
  ctxR.fillRect(0, 0, size, size);

  const rng = mulberry32(821);
  // Draw dense overlapping rice grains in multiple depth layers
  for (let i = 0; i < 2400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const ang = rng() * Math.PI;
    const rx = 6.2 + rng() * 3.0;
    const ry = 2.8 + rng() * 1.4;
    const depth = i / 2400;
    const lum = (214 + depth * 36 + (rng() - 0.5) * 14) | 0;
    const warm = (rng() * 7) | 0;

    // Wrap around edges for seamless tiling
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        const gx = x + ox;
        const gy = y + oy;
        if (gx < -16 || gx > size + 16 || gy < -16 || gy > size + 16) continue;

        ctxM.save();
        ctxM.translate(gx, gy);
        ctxM.rotate(ang);
        const grad = ctxM.createRadialGradient(-rx * 0.2, -ry * 0.25, 0.5, 0, 0, rx);
        grad.addColorStop(0, `rgb(${Math.min(255, lum + 10)}, ${Math.min(255, lum + 8)}, ${Math.min(255, lum + 3)})`);
        grad.addColorStop(0.75, `rgb(${lum}, ${lum - 2}, ${lum - 8 - warm})`);
        grad.addColorStop(1, `rgb(${lum - 32}, ${lum - 35}, ${lum - 42})`);
        ctxM.fillStyle = grad;
        ctxM.beginPath();
        ctxM.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctxM.fill();
        ctxM.restore();

        ctxB.save();
        ctxB.translate(gx, gy);
        ctxB.rotate(ang);
        const bGrad = ctxB.createRadialGradient(0, 0, 0.5, 0, 0, rx);
        const bv = (115 + depth * 130) | 0;
        bGrad.addColorStop(0, `rgb(${bv},${bv},${bv})`);
        bGrad.addColorStop(1, 'rgb(52,52,52)');
        ctxB.fillStyle = bGrad;
        ctxB.beginPath();
        ctxB.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctxB.fill();
        ctxB.restore();

        ctxR.save();
        ctxR.translate(gx, gy);
        ctxR.rotate(ang);
        const rv = (48 + (1 - depth) * 70) | 0;
        ctxR.fillStyle = `rgb(${rv},${rv},${rv})`;
        ctxR.beginPath();
        ctxR.ellipse(0, 0, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
        ctxR.fill();
        ctxR.restore();
      }
    }
  }

  return {
    map: toTexture(cMap, { srgb: true, repeat: [2.2, 2.2] }),
    bumpMap: toTexture(cBump, { srgb: false, repeat: [2.2, 2.2] }),
    roughnessMap: toTexture(cRough, { srgb: false, repeat: [2.2, 2.2] }),
  };
}

// 9. Linen sleeve / potholder woven fabric
export function createLinenTextures(baseRGB = [228, 218, 200]) {
  const size = 256;
  const cMap = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin(x * 0.78) * 0.5 + 0.5;
      const weft = Math.sin(y * 0.78) * 0.5 + 0.5;
      const weave = ((x >> 2) + (y >> 2)) % 2 === 0 ? warp : weft;
      const slub = fbm2(x / 18, y / 18, 709, 3);
      const delta = (weave - 0.5) * 20 + (slub - 0.5) * 18;
      const idx = (y * size + x) * 4;
      imgM.data[idx] = Math.min(255, Math.max(0, (baseRGB[0] + delta) | 0));
      imgM.data[idx + 1] = Math.min(255, Math.max(0, (baseRGB[1] + delta) | 0));
      imgM.data[idx + 2] = Math.min(255, Math.max(0, (baseRGB[2] + delta) | 0));
      imgM.data[idx + 3] = 255;

      const b = Math.min(255, Math.max(0, (128 + (weave - 0.5) * 85) | 0));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = b;
      imgB.data[idx + 3] = 255;
    }
  }
  ctxM.putImageData(imgM, 0, 0);
  ctxB.putImageData(imgB, 0, 0);
  return {
    map: toTexture(cMap, { srgb: true, repeat: [3, 3] }),
    bumpMap: toTexture(cBump, { srgb: false, repeat: [3, 3] }),
  };
}

// 10. Curry roux block texture (rich dark waxy spice-flecked brown)
export function createRouxTextures() {
  const size = 256;
  const cMap = makeCanvas(size, size);
  const cBump = makeCanvas(size, size);
  const ctxM = cMap.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const m = fbm2(x / 28, y / 28, 911, 4);
      const spice = smoothNoise2(x / 4, y / 4, 919);
      const idx = (y * size + x) * 4;
      imgM.data[idx] = Math.min(255, Math.max(0, (74 + (m - 0.5) * 28 + (spice > 0.78 ? 22 : 0)) | 0));
      imgM.data[idx + 1] = Math.min(255, Math.max(0, (37 + (m - 0.5) * 16 + (spice > 0.78 ? 10 : 0)) | 0));
      imgM.data[idx + 2] = Math.min(255, Math.max(0, (17 + (m - 0.5) * 10) | 0));
      imgM.data[idx + 3] = 255;

      const b = Math.min(255, Math.max(0, (124 + (spice - 0.5) * 58 + (m - 0.5) * 24) | 0));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = b;
      imgB.data[idx + 3] = 255;
    }
  }
  ctxM.putImageData(imgM, 0, 0);
  ctxB.putImageData(imgB, 0, 0);
  return {
    map: toTexture(cMap, { srgb: true }),
    bumpMap: toTexture(cBump, { srgb: false }),
  };
}

// 11. Soft photographic steam puff sprite
export function createSteamTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - 64) / 64;
      const dy = (y - 64) / 64;
      const d = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - d);
      const n = fbm2(x / 24 + 3.1, y / 24 + 1.4, 977, 4);
      const a = Math.pow(falloff, 1.8) * (0.45 + n * 0.75);
      const idx = (y * size + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 242;
      img.data[idx + 2] = 224;
      img.data[idx + 3] = Math.min(255, Math.max(0, (a * 255) | 0));
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

// 12. Evening Western Sunlight Kitchen PMREM Environment Map
// Generates a warm sunset Japanese kitchen reflection probe with bright golden western window on the left!
export function createEveningKitchenEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x281e1a);

  // Warm kitchen interior shell
  const roomGeo = new THREE.BoxGeometry(12, 8, 12);
  const roomMat = new THREE.MeshBasicMaterial({ color: 0x3a2c24, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Warm ceiling bounce
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ color: 0x6b5344 })
  );
  ceil.position.set(0, 3.9, 0);
  ceil.rotation.x = Math.PI / 2;
  envScene.add(ceil);

  // Subtle warm kitchen pendant overhead (soft warm tungsten catchlight)
  const pendant = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.85, 1.25) })
  );
  pendant.position.set(0.5, 3.3, 0.2);
  envScene.add(pendant);

  // HERO: Blazing late-afternoon western sunset window on the left-back!
  const windowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(7.5, 3.9, 1.45) })
  );
  windowGlow.position.set(-5.8, 1.5, -1.8);
  windowGlow.rotation.y = Math.PI / 2;
  envScene.add(windowGlow);

  // Window sash dark mullions for realistic sharp specular reflections on steel knife & wet curry
  const mullionMat = new THREE.MeshBasicMaterial({ color: 0x221712 });
  const mV = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 3.5), mullionMat);
  mV.position.set(-5.75, 1.5, -1.8);
  mV.rotation.y = Math.PI / 2;
  envScene.add(mV);
  const mH = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.16), mullionMat);
  mH.position.set(-5.75, 1.7, -1.8);
  mH.rotation.y = Math.PI / 2;
  envScene.add(mH);

  // Secondary warm golden bounce on tiled wall opposite window
  const wallBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 3.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 0.92, 0.58) })
  );
  wallBounce.position.set(5.8, 1.0, -1.2);
  wallBounce.rotation.y = -Math.PI / 2;
  envScene.add(wallBounce);

  // Cool dusk sky fill on far front-right (creates warm/cool contrast on metallic edges!)
  const coolFill = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 3.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.65, 0.72, 1.05) })
  );
  coolFill.position.set(3.2, 2.2, 5.8);
  coolFill.rotation.y = Math.PI;
  envScene.add(coolFill);

  const rt = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return rt.texture;
}
