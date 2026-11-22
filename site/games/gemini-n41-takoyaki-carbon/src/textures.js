import * as THREE from 'three';

// Deterministic fast PRNG & 2D value/gradient noise for rich procedural PBR maps (all <= 1024px)
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

function makeNoise2D(seed = 12345) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const grads = new Float32Array(512);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    grads[i] = rand() * 2 - 1;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) {
    perm[i + 256] = perm[i];
    grads[i + 256] = grads[i];
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;

  return function noise(x, y, period = 256) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;

    const aa = grads[perm[(x0 + perm[y0 & 255]) & 255]];
    const ba = grads[perm[(x1 + perm[y0 & 255]) & 255]];
    const ab = grads[perm[(x0 + perm[y1 & 255]) & 255]];
    const bb = grads[perm[(x1 + perm[y1 & 255]) & 255]];

    const u = fade(xf);
    const v = fade(yf);
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v); // -1..1
  };
}

function fbm(noise, x, y, octaves = 4, basePeriod = 16) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, basePeriod * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm; // -1..1
}

function heightToNormalTexture(heightData, size, strength = 2.5, repeat = true) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const hL = heightData[y * size + xm];
      const hR = heightData[y * size + xp];
      const hD = heightData[ym * size + x];
      const hU = heightData[yp * size + x];
      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz) || 1;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createAllTextures(renderer) {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  // 1. Seasoned Cast Iron (鋳鉄: 512x512 sand-cast grain + oil micro-variation)
  const ironSize = 512;
  const ironNoise = makeNoise2D(101);
  const ironHeight = new Float32Array(ironSize * ironSize);
  const ironColorCanvas = createCanvas(ironSize, ironSize);
  const ironRoughCanvas = createCanvas(ironSize, ironSize);
  const icCtx = ironColorCanvas.getContext('2d');
  const irCtx = ironRoughCanvas.getContext('2d');
  const icImg = icCtx.createImageData(ironSize, ironSize);
  const irImg = irCtx.createImageData(ironSize, ironSize);

  for (let y = 0; y < ironSize; y++) {
    const ny = y / ironSize;
    for (let x = 0; x < ironSize; x++) {
      const nx = x / ironSize;
      const fine = fbm(ironNoise, nx * 96, ny * 96, 3, 96);
      const med = fbm(ironNoise, nx * 24, ny * 24, 4, 24);
      const pits = Math.min(0, ironNoise(nx * 140, ny * 140, 140) + 0.32) * 1.4;
      const h = fine * 0.45 + med * 0.35 + pits * 0.55;
      ironHeight[y * ironSize + x] = h;

      const idx = (y * ironSize + x) * 4;
      const base = 24 + med * 7 + fine * 5;
      icImg.data[idx] = Math.max(10, Math.min(50, base + 2));
      icImg.data[idx + 1] = Math.max(10, Math.min(48, base));
      icImg.data[idx + 2] = Math.max(12, Math.min(52, base + 3));
      icImg.data[idx + 3] = 255;

      // Seasoned oiled iron roughness: smooth glazed valleys, slightly rougher sand peaks
      const rough = Math.max(25, Math.min(145, 78 + fine * 28 - med * 20 - pits * 35));
      irImg.data[idx] = irImg.data[idx + 1] = irImg.data[idx + 2] = rough;
      irImg.data[idx + 3] = 255;
    }
  }
  icCtx.putImageData(icImg, 0, 0);
  irCtx.putImageData(irImg, 0, 0);

  const ironMap = new THREE.CanvasTexture(ironColorCanvas);
  ironMap.colorSpace = THREE.SRGBColorSpace;
  ironMap.wrapS = ironMap.wrapT = THREE.RepeatWrapping;
  ironMap.anisotropy = maxAniso;

  const ironRoughnessMap = new THREE.CanvasTexture(ironRoughCanvas);
  ironRoughnessMap.wrapS = ironRoughnessMap.wrapT = THREE.RepeatWrapping;
  ironRoughnessMap.anisotropy = maxAniso;

  const ironNormalMap = heightToNormalTexture(ironHeight, ironSize, 2.2, true);
  ironNormalMap.anisotropy = maxAniso;

  // 2. Warm Walnut Dining Table Wood (1024x1024)
  const woodSize = 1024;
  const woodNoise = makeNoise2D(202);
  const woodHeight = new Float32Array(woodSize * woodSize);
  const woodCanvas = createCanvas(woodSize, woodSize);
  const woodRoughCanvas = createCanvas(woodSize, woodSize);
  const wcCtx = woodCanvas.getContext('2d');
  const wrCtx = woodRoughCanvas.getContext('2d');
  const wcImg = wcCtx.createImageData(woodSize, woodSize);
  const wrImg = wrCtx.createImageData(woodSize, woodSize);

  for (let y = 0; y < woodSize; y++) {
    const ny = y / woodSize;
    // Subtle plank seam across y
    const plankId = Math.floor(ny * 4);
    const plankEdge = Math.min((ny * 4) % 1, 1 - ((ny * 4) % 1));
    const seam = plankEdge < 0.006 ? -1.0 : 0.0;
    const pOff = plankId * 3.7;
    for (let x = 0; x < woodSize; x++) {
      const nx = x / woodSize;
      const warp = fbm(woodNoise, nx * 3 + pOff, ny * 6, 3, 12) * 0.22;
      const ring = Math.sin((ny * 26 + warp * 14 + pOff) * Math.PI * 2);
      const fiber = fbm(woodNoise, nx * 120, ny * 18, 3, 120);
      const vessel = Math.min(0, woodNoise(nx * 180, ny * 32, 180) + 0.55);

      const grain = ring * 0.5 + fiber * 0.35 + vessel * 0.5;
      woodHeight[y * woodSize + x] = grain * 0.3 + seam * 1.6 + vessel * 0.6;

      // Rich dark-warm walnut color
      const tone = 0.5 + 0.5 * ring;
      const plankShift = (plankId % 2 === 0 ? 1.0 : 0.91);
      const r = Math.max(18, Math.min(130, (66 + tone * 34 + fiber * 14 + vessel * 25 + seam * 45) * plankShift));
      const g = Math.max(10, Math.min(88, (37 + tone * 21 + fiber * 9 + vessel * 16 + seam * 30) * plankShift));
      const b = Math.max(6, Math.min(60, (21 + tone * 12 + fiber * 6 + vessel * 10 + seam * 18) * plankShift));

      const idx = (y * woodSize + x) * 4;
      wcImg.data[idx] = r;
      wcImg.data[idx + 1] = g;
      wcImg.data[idx + 2] = b;
      wcImg.data[idx + 3] = 255;

      const rough = Math.max(55, Math.min(175, 92 - tone * 16 - vessel * 55 - seam * 50 + fiber * 14));
      wrImg.data[idx] = wrImg.data[idx + 1] = wrImg.data[idx + 2] = rough;
      wrImg.data[idx + 3] = 255;
    }
  }
  wcCtx.putImageData(wcImg, 0, 0);
  wrCtx.putImageData(wrImg, 0, 0);

  const woodMap = new THREE.CanvasTexture(woodCanvas);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.anisotropy = maxAniso;

  const woodRoughnessMap = new THREE.CanvasTexture(woodRoughCanvas);
  woodRoughnessMap.wrapS = woodRoughnessMap.wrapT = THREE.RepeatWrapping;
  woodRoughnessMap.anisotropy = maxAniso;

  const woodNormalMap = heightToNormalTexture(woodHeight, woodSize, 1.5, true);
  woodNormalMap.anisotropy = maxAniso;

  // 3. Takoyaki Baked Crust & Flecks Detail Map (512x512)
  // Encodes organic Maillard blister variation, crispy pores, green negi & beni-shoga specks!
  const takoSize = 512;
  const takoNoise = makeNoise2D(303);
  const takoRand = mulberry32(309);
  const takoHeight = new Float32Array(takoSize * takoSize);
  const takoBakedCanvas = createCanvas(takoSize, takoSize);
  const takoRawCanvas = createCanvas(takoSize, takoSize);
  const tbCtx = takoBakedCanvas.getContext('2d');
  const trCtx = takoRawCanvas.getContext('2d');
  const tbImg = tbCtx.createImageData(takoSize, takoSize);
  const trImg = trCtx.createImageData(takoSize, takoSize);

  for (let y = 0; y < takoSize; y++) {
    const ny = y / takoSize;
    for (let x = 0; x < takoSize; x++) {
      const nx = x / takoSize;
      const mottle = fbm(takoNoise, nx * 10, ny * 10, 4, 10); // -1..1
      const blister = fbm(takoNoise, nx * 32, ny * 32, 3, 32);
      const pore = Math.min(0, takoNoise(nx * 72, ny * 72, 72) + 0.45);
      takoHeight[y * takoSize + x] = mottle * 0.4 + blister * 0.45 + pore * 0.85;

      const idx = (y * takoSize + x) * 4;
      // Raw creamy batter with subtle dashi/flour richness
      trImg.data[idx] = Math.min(255, 246 + mottle * 6);
      trImg.data[idx + 1] = Math.min(255, 235 + mottle * 8);
      trImg.data[idx + 2] = Math.min(255, 204 + mottle * 10);
      trImg.data[idx + 3] = 255;

      // Golden-brown crispy Maillard baked crust with toasted blister peaks & lighter crevices
      const toast = Math.max(0, Math.min(1, 0.52 + mottle * 0.36 + blister * 0.25));
      // Interpolate from warm custard-gold (236, 178, 92) to deep caramelized amber-brown (152, 72, 20)
      const r = 238 - toast * 86 + pore * 28;
      const g = 182 - toast * 108 + pore * 22;
      const b = 96 - toast * 76 + pore * 12;
      tbImg.data[idx] = Math.max(45, Math.min(250, r));
      tbImg.data[idx + 1] = Math.max(20, Math.min(220, g));
      tbImg.data[idx + 2] = Math.max(8, Math.min(150, b));
      tbImg.data[idx + 3] = 255;
    }
  }
  tbCtx.putImageData(tbImg, 0, 0);
  trCtx.putImageData(trImg, 0, 0);

  // Paint realistic embedded green negi rings & ruby beni-shoga slivers into both maps
  for (let i = 0; i < 65; i++) {
    const cx = takoRand() * takoSize;
    const cy = takoRand() * takoSize;
    const rx = 3 + takoRand() * 6;
    const ry = 2 + takoRand() * 4;
    const ang = takoRand() * Math.PI;
    // Green negi
    trCtx.save();
    trCtx.translate(cx, cy);
    trCtx.rotate(ang);
    trCtx.fillStyle = 'rgba(72, 148, 52, 0.55)';
    trCtx.fillRect(-rx, -ry, rx * 2, ry * 2);
    trCtx.restore();

    tbCtx.save();
    tbCtx.translate(cx, cy);
    tbCtx.rotate(ang);
    tbCtx.fillStyle = 'rgba(54, 108, 34, 0.68)';
    tbCtx.fillRect(-rx, -ry, rx * 2, ry * 2);
    tbCtx.restore();
  }
  for (let i = 0; i < 36; i++) {
    const cx = takoRand() * takoSize;
    const cy = takoRand() * takoSize;
    const ang = takoRand() * Math.PI;
    // Beni-shoga crimson sliver
    trCtx.save();
    trCtx.translate(cx, cy);
    trCtx.rotate(ang);
    trCtx.fillStyle = 'rgba(196, 38, 56, 0.45)';
    trCtx.fillRect(-6, -1.6, 12, 3.2);
    trCtx.restore();

    tbCtx.save();
    tbCtx.translate(cx, cy);
    tbCtx.rotate(ang);
    tbCtx.fillStyle = 'rgba(155, 28, 36, 0.55)';
    tbCtx.fillRect(-6, -1.6, 12, 3.2);
    tbCtx.restore();
  }

  const takoRawMap = new THREE.CanvasTexture(takoRawCanvas);
  takoRawMap.colorSpace = THREE.SRGBColorSpace;
  takoRawMap.wrapS = takoRawMap.wrapT = THREE.RepeatWrapping;
  takoRawMap.anisotropy = maxAniso;

  const takoBakedMap = new THREE.CanvasTexture(takoBakedCanvas);
  takoBakedMap.colorSpace = THREE.SRGBColorSpace;
  takoBakedMap.wrapS = takoBakedMap.wrapT = THREE.RepeatWrapping;
  takoBakedMap.anisotropy = maxAniso;

  const takoNormalMap = heightToNormalTexture(takoHeight, takoSize, 2.4, true);
  takoNormalMap.anisotropy = maxAniso;

  // 4. Boiled Octopus Skin & Flesh Texture (256x256)
  const octoSize = 256;
  const octoNoise = makeNoise2D(404);
  const octoCanvas = createCanvas(octoSize, octoSize);
  const oCtx = octoCanvas.getContext('2d');
  const oImg = oCtx.createImageData(octoSize, octoSize);
  const octoHeight = new Float32Array(octoSize * octoSize);
  for (let y = 0; y < octoSize; y++) {
    const ny = y / octoSize; // v: 0..0.45 = inner white cut flesh, 0.45..1.0 = burgundy skin
    for (let x = 0; x < octoSize; x++) {
      const nx = x / octoSize;
      const n1 = fbm(octoNoise, nx * 18, ny * 18, 3, 18);
      const skinBlend = THREE.MathUtils.smoothstep(ny, 0.36, 0.54);
      octoHeight[y * octoSize + x] = n1 * 0.4 + skinBlend * 0.25;

      // Creamy translucent boiled white flesh -> deep reddish-purple skin
      const wr = 247 + n1 * 6;
      const wg = 236 + n1 * 7;
      const wb = 232 + n1 * 6;

      const sr = 128 + n1 * 26;
      const sg = 26 + n1 * 10;
      const sb = 40 + n1 * 14;

      const idx = (y * octoSize + x) * 4;
      oImg.data[idx] = wr + (sr - wr) * skinBlend;
      oImg.data[idx + 1] = wg + (sg - wg) * skinBlend;
      oImg.data[idx + 2] = wb + (sb - wb) * skinBlend;
      oImg.data[idx + 3] = 255;
    }
  }
  oCtx.putImageData(oImg, 0, 0);
  const octopusMap = new THREE.CanvasTexture(octoCanvas);
  octopusMap.colorSpace = THREE.SRGBColorSpace;
  octopusMap.anisotropy = maxAniso;
  const octopusNormalMap = heightToNormalTexture(octoHeight, octoSize, 1.4, true);

  // 5. Katsuobushi Shaving Texture (256x256, delicate fibrous semi-translucent flake with torn edges)
  const katsuCanvas = createCanvas(256, 256);
  const kCtx = katsuCanvas.getContext('2d');
  const kNoise = makeNoise2D(505);
  const kImg = kCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    const ny = y / 255; // along flake length
    for (let x = 0; x < 256; x++) {
      const nx = x / 255; // across flake width
      const edgeWarp = fbm(kNoise, nx * 8, ny * 5, 3, 16) * 0.16;
      const dx = (nx - 0.5 + edgeWarp * 0.5) * 2.0;
      const dy = (ny - 0.5) * 2.0;
      const oval = dx * dx * 1.15 + dy * dy * 0.92;
      // Torn fibrous ends
      const tear = fbm(kNoise, nx * 42, ny * 10, 3, 42) * 0.24;
      const alpha = THREE.MathUtils.clamp((1.05 - oval + tear) * 3.8, 0, 1);

      // Longitudinal bonito grain streaks (warm amber-pink-tan)
      const streak = fbm(kNoise, nx * 64, ny * 6, 3, 64);
      const centerRuby = Math.exp(-Math.pow(nx - 0.52, 2) * 18) * 0.35;
      const r = Math.min(250, 224 + streak * 22 - centerRuby * 32);
      const g = Math.min(225, 174 + streak * 20 - centerRuby * 48);
      const b = Math.min(195, 134 + streak * 18 - centerRuby * 44);

      const idx = (y * 256 + x) * 4;
      kImg.data[idx] = r;
      kImg.data[idx + 1] = g;
      kImg.data[idx + 2] = b;
      kImg.data[idx + 3] = Math.round(alpha * 238);
    }
  }
  kCtx.putImageData(kImg, 0, 0);
  const katsuobushiMap = new THREE.CanvasTexture(katsuCanvas);
  katsuobushiMap.colorSpace = THREE.SRGBColorSpace;
  katsuobushiMap.anisotropy = maxAniso;

  // 6. Photorealistic Human Skin Micro-Pore Normal & Mottled Albedo Detail (512x512)
  const skinSize = 512;
  const skinNoise = makeNoise2D(606);
  const skinHeight = new Float32Array(skinSize * skinSize);
  const skinCanvas = createCanvas(skinSize, skinSize);
  const sCtx = skinCanvas.getContext('2d');
  const sImg = sCtx.createImageData(skinSize, skinSize);
  for (let y = 0; y < skinSize; y++) {
    const ny = y / skinSize;
    for (let x = 0; x < skinSize; x++) {
      const nx = x / skinSize;
      const pores = Math.min(0, skinNoise(nx * 140, ny * 140, 140) + 0.38) * 0.7;
      const microCell = fbm(skinNoise, nx * 64, ny * 64, 2, 64) * 0.35;
      const subDerm = fbm(skinNoise, nx * 12, ny * 12, 3, 12);
      skinHeight[y * skinSize + x] = pores + microCell;

      // Subtle warm hemoglobin / melanin mottling around white-neutral multiplier
      const idx = (y * skinSize + x) * 4;
      sImg.data[idx] = Math.min(255, 250 + subDerm * 5);
      sImg.data[idx + 1] = Math.min(255, 244 + subDerm * 7);
      sImg.data[idx + 2] = Math.min(255, 240 + subDerm * 8);
      sImg.data[idx + 3] = 255;
    }
  }
  sCtx.putImageData(sImg, 0, 0);
  const skinDetailMap = new THREE.CanvasTexture(skinCanvas);
  skinDetailMap.colorSpace = THREE.SRGBColorSpace;
  skinDetailMap.wrapS = skinDetailMap.wrapT = THREE.RepeatWrapping;
  const skinNormalMap = heightToNormalTexture(skinHeight, skinSize, 0.85, true);
  skinNormalMap.wrapS = skinNormalMap.wrapT = THREE.RepeatWrapping;

  // 7. Detailed Japanese Dark Chestnut-Brown Iris Texture (512x512)
  const eyeCanvas = createCanvas(512, 512);
  const eCtx = eyeCanvas.getContext('2d');
  // Warm ivory sclera with subtle vascular warmth at outer corners
  const scleraGrad = eCtx.createRadialGradient(256, 256, 95, 256, 256, 256);
  scleraGrad.addColorStop(0, '#f8f4ef');
  scleraGrad.addColorStop(0.55, '#f5eee8');
  scleraGrad.addColorStop(1, '#e5cfc8');
  eCtx.fillStyle = scleraGrad;
  eCtx.fillRect(0, 0, 512, 512);

  // Iris occupies center radius ~118px (for UV mapped onto front hemisphere of eye)
  const irisR = 118;
  // Limbal dark ring
  const irisGrad = eCtx.createRadialGradient(256, 256, 36, 256, 256, irisR);
  irisGrad.addColorStop(0, '#140a05');
  irisGrad.addColorStop(0.32, '#4a2511');
  irisGrad.addColorStop(0.68, '#5c2f16');
  irisGrad.addColorStop(0.88, '#2d1509');
  irisGrad.addColorStop(0.98, '#160b06');
  irisGrad.addColorStop(1, 'rgba(22,11,6,0)');
  eCtx.fillStyle = irisGrad;
  eCtx.beginPath();
  eCtx.arc(256, 256, irisR + 3, 0, Math.PI * 2);
  eCtx.fill();

  // Radial iris fibers
  const eyeRand = mulberry32(707);
  eCtx.save();
  eCtx.translate(256, 256);
  for (let i = 0; i < 280; i++) {
    const a = (i / 280) * Math.PI * 2 + (eyeRand() - 0.5) * 0.02;
    const r0 = 38 + eyeRand() * 10;
    const r1 = 88 + eyeRand() * 26;
    const bright = eyeRand() > 0.45;
    eCtx.strokeStyle = bright ? 'rgba(138, 78, 36, 0.28)' : 'rgba(24, 10, 4, 0.35)';
    eCtx.lineWidth = 0.9 + eyeRand() * 1.4;
    eCtx.beginPath();
    eCtx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    eCtx.lineTo(Math.cos(a + (eyeRand() - 0.5) * 0.06) * r1, Math.sin(a + (eyeRand() - 0.5) * 0.06) * r1);
    eCtx.stroke();
  }
  // Deep pupil
  const pupGrad = eCtx.createRadialGradient(0, 0, 2, 0, 0, 44);
  pupGrad.addColorStop(0, '#040202');
  pupGrad.addColorStop(0.85, '#090504');
  pupGrad.addColorStop(1, 'rgba(18,9,5,0)');
  eCtx.fillStyle = pupGrad;
  eCtx.beginPath();
  eCtx.arc(0, 0, 44, 0, Math.PI * 2);
  eCtx.fill();
  eCtx.restore();

  const eyeMap = new THREE.CanvasTexture(eyeCanvas);
  eyeMap.colorSpace = THREE.SRGBColorSpace;
  eyeMap.anisotropy = maxAniso;

  // 8. Anisotropic Hair Strand Normal & Alpha/Tint Map (256x256)
  const hairSize = 256;
  const hairHeight = new Float32Array(hairSize * hairSize);
  const hairNoise = makeNoise2D(808);
  for (let y = 0; y < hairSize; y++) {
    const ny = y / hairSize;
    for (let x = 0; x < hairSize; x++) {
      const nx = x / hairSize;
      const strand = fbm(hairNoise, nx * 90, ny * 4, 3, 90);
      hairHeight[y * hairSize + x] = strand;
    }
  }
  const hairNormalMap = heightToNormalTexture(hairHeight, hairSize, 2.0, true);

  // 9. Cozy Ribbed Knit Sweater Normal Map (256x256)
  const knitSize = 256;
  const knitHeight = new Float32Array(knitSize * knitSize);
  const knitNoise = makeNoise2D(909);
  for (let y = 0; y < knitSize; y++) {
    const ny = y / knitSize;
    for (let x = 0; x < knitSize; x++) {
      const nx = x / knitSize;
      const col = (nx * 36) % 1;
      const row = (ny * 48) % 1;
      const vStitch = Math.sin(col * Math.PI) * Math.sin(row * Math.PI * 2) * 0.5 + Math.sin(nx * 36 * Math.PI * 2) * 0.35;
      const fuzz = knitNoise(nx * 128, ny * 128, 128) * 0.25;
      knitHeight[y * knitSize + x] = vStitch + fuzz;
    }
  }
  const knitNormalMap = heightToNormalTexture(knitHeight, knitSize, 2.1, true);

  // 10. Soft Volumetric-like Steam Puff Sprite (256x256)
  const steamCanvas = createCanvas(256, 256);
  const stCtx = steamCanvas.getContext('2d');
  const stNoise = makeNoise2D(1010);
  const stImg = stCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    const ny = (y / 255) * 2 - 1;
    for (let x = 0; x < 256; x++) {
      const nx = (x / 255) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const wisp = fbm(stNoise, (nx + 1) * 3.5, (ny + 1) * 3.5, 4, 8) * 0.36;
      const falloff = Math.max(0, 1 - r * 1.05 + wisp * (1 - r * 0.5));
      const a = Math.pow(Math.max(0, Math.min(1, falloff)), 2.2);
      const idx = (y * 256 + x) * 4;
      stImg.data[idx] = 255;
      stImg.data[idx + 1] = 249;
      stImg.data[idx + 2] = 242;
      stImg.data[idx + 3] = Math.round(a * 165);
    }
  }
  stCtx.putImageData(stImg, 0, 0);
  const steamMap = new THREE.CanvasTexture(steamCanvas);
  steamMap.colorSpace = THREE.SRGBColorSpace;

  // 11. Custom Warm Night Japanese Dining Room HDR Environment Map via PMREMGenerator
  const envMap = createNightDiningEnvironment(renderer);

  return {
    ironMap,
    ironRoughnessMap,
    ironNormalMap,
    woodMap,
    woodRoughnessMap,
    woodNormalMap,
    takoRawMap,
    takoBakedMap,
    takoNormalMap,
    octopusMap,
    octopusNormalMap,
    katsuobushiMap,
    skinDetailMap,
    skinNormalMap,
    eyeMap,
    hairNormalMap,
    knitNormalMap,
    steamMap,
    envMap,
  };
}

function createNightDiningEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0c0806);

  // Warm cozy room enclosure
  const roomGeo = new THREE.BoxGeometry(6, 4, 6);
  const roomMat = new THREE.MeshBasicMaterial({
    color: 0x1e130c,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Overhead warm pendant bulb & diffuser (creates gorgeous realistic specular catchlights in eyes, oil, sauce, copper!)
  const bulbGeo = new THREE.SphereGeometry(0.32, 24, 16);
  const bulbMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(9.5, 6.6, 3.8), // HDR > 1.0 intensity!
  });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(0.05, 1.35, 0.1);
  envScene.add(bulb);

  // Warm lampshade bounce halo
  const haloGeo = new THREE.RingGeometry(0.32, 0.78, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.8, 1.7, 0.85),
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0.05, 1.32, 0.1);
  envScene.add(halo);

  // Warm shoji / side floor lamp glow on the left
  const sideGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.85, 0.42), side: THREE.DoubleSide })
  );
  sideGlow.position.set(-2.6, 0.4, -0.5);
  sideGlow.rotation.y = Math.PI / 2;
  envScene.add(sideGlow);

  // Subtle cool night window reflection on right-back for three-dimensional specular contrast
  const nightWin = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.42, 0.72), side: THREE.DoubleSide })
  );
  nightWin.position.set(2.6, 0.6, -0.8);
  nightWin.rotation.y = -Math.PI / 2;
  envScene.add(nightWin);

  // Warm wooden tabletop bounce from below
  const tableBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.30, 0.14), side: THREE.DoubleSide })
  );
  tableBounce.rotation.x = -Math.PI / 2;
  tableBounce.position.set(0, -0.6, 0);
  envScene.add(tableBounce);

  const rt = pmrem.fromScene(envScene, 0.025);
  pmrem.dispose();
  return rt.texture;
}
