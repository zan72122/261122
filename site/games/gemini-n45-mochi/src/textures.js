import * as THREE from 'three';

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

function makeNoise2D(seed, gridSize = 64) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  function sample(x, y, period = gridSize) {
    const gx = ((x % period) + period) % period;
    const gy = ((y % period) + period) % period;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const fx = gx - x0;
    const fy = gy - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const i00 = (y0 % gridSize) * gridSize + (x0 % gridSize);
    const i10 = (y0 % gridSize) * gridSize + (x1 % gridSize);
    const i01 = (y1 % gridSize) * gridSize + (x0 % gridSize);
    const i11 = (y1 % gridSize) * gridSize + (x1 % gridSize);
    const a = grid[i00] * (1 - u) + grid[i10] * u;
    const b = grid[i01] * (1 - u) + grid[i11] * u;
    return a * (1 - v) + b * v;
  }

  return function fbm(u, v, octaves = 4, baseFreq = 8) {
    let sum = 0;
    let amp = 0.5;
    let freq = baseFreq;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * sample(u * freq, v * freq, freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

function heightToNormalTexture(height, size, strength = 2.0, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const tl = height[ym * size + xm];
      const t  = height[ym * size + x];
      const tr = height[ym * size + xp];
      const l  = height[y * size + xm];
      const r  = height[y * size + xp];
      const bl = height[yp * size + xm];
      const b  = height[yp * size + x];
      const br = height[yp * size + xp];

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      d[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function makeCanvasTex(canvas, isColor = true, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 1. Tatami woven rush straw (い草) — crisp woven reeds with sun-aged golden-green warmth
export function createTatamiTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(101, 64);
  const rand = mulberry32(102);

  const stalkTint = new Float32Array(size);
  for (let y = 0; y < size; y++) stalkTint[y] = (rand() - 0.5) * 20;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const stalkIdx = Math.floor(y / 3);
    const stalkLocal = (y % 3) / 3;
    const stalkProfile = Math.sin(stalkLocal * Math.PI);
    const stVar = stalkTint[stalkIdx % size];

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const weavePhase = (x / 6 + (stalkIdx % 2) * 0.5) * Math.PI * 2;
      const stitch = 0.5 + 0.5 * Math.cos(weavePhase);
      const broad = fbm(u, v, 3, 4);
      const micro = fbm(u, v, 2, 32);

      const h = stalkProfile * 0.62 + stitch * 0.28 + micro * 0.10;
      height[y * size + x] = h;

      const shade = 0.78 + h * 0.26 + (broad - 0.5) * 0.14;
      const r = Math.min(255, Math.max(0, (164 + stVar) * shade));
      const g = Math.min(255, Math.max(0, (152 + stVar * 0.85) * shade));
      const b = Math.min(255, Math.max(0, (94 + stVar * 0.5) * shade));

      const idx = (y * size + x) * 4;
      cImg.data[idx] = r;
      cImg.data[idx + 1] = g;
      cImg.data[idx + 2] = b;
      cImg.data[idx + 3] = 255;

      const rough = Math.min(255, Math.max(175, Math.round((0.88 - stalkProfile * 0.10) * 255)));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 6, 6),
    roughnessMap: makeCanvasTex(roughCanvas, false, 6, 6),
    normalMap: heightToNormalTexture(height, size, 2.8, 6, 6),
  };
}

// 2. Rich Deep Satin Keyaki / Walnut Chabudai Wood (座卓の木目 — natural fine pores, no zebra glare!)
export function createKeyakiWoodTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(203, 64);
  const fbm2 = makeNoise2D(209, 64);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Subtle long flowing Japanese keyaki grain
      const warp = fbm(u * 0.45, v * 1.4, 4, 3) * 1.45;
      const fineFiber = fbm2(u * 1.0, v * 28.0, 3, 8);
      const ringCoord = v * 9.5 + warp + Math.sin(u * Math.PI * 2) * 0.35;
      const ring = 0.5 + 0.5 * Math.sin(ringCoord * Math.PI * 2);
      const softRing = Math.pow(ring, 0.75);
      const pore = fineFiber < 0.20 ? (0.20 - fineFiber) * 1.6 : 0;

      const h = softRing * 0.42 + fineFiber * 0.44 - pore * 0.45;
      height[y * size + x] = h;

      // Authentic rich aged dark-chestnut Japanese zataku wood (#2c180e -> #54311e)
      const t = softRing * 0.58 + fineFiber * 0.42 - pore * 0.28;
      const r = Math.min(255, Math.max(0, 46 + t * 44));
      const g = Math.min(255, Math.max(0, 26 + t * 26));
      const b = Math.min(255, Math.max(0, 16 + t * 15));

      const idx = (y * size + x) * 4;
      cImg.data[idx] = r;
      cImg.data[idx + 1] = g;
      cImg.data[idx + 2] = b;
      cImg.data[idx + 3] = 255;

      // Hand-rubbed oil/satin lacquer: soft sheen (0.44 - 0.62) without harsh white streaks
      const rough = Math.min(255, Math.max(95, Math.round((0.46 + (1 - softRing) * 0.12 + pore * 0.18) * 255)));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 1.4, 1.1),
    roughnessMap: makeCanvasTex(roughCanvas, false, 1.4, 1.1),
    normalMap: heightToNormalTexture(height, size, 0.9, 1.4, 1.1),
  };
}

// 3. Warm Natural Hinoki Mochi Board (のし台) with authentic soft white rice-starch flour dusting
export function createHinokiBoardTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(307, 64);
  const flourNoise = makeNoise2D(313, 64);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbm(u * 0.45, v * 1.8, 3, 4) * 0.75;
      const ring = 0.5 + 0.5 * Math.sin((v * 16.0 + warp) * Math.PI * 2);
      const fiber = fbm(u * 1.2, v * 26.0, 2, 8);

      // Authentic organic patches of dusted white mochitoriko rice starch on working area
      const dx1 = (u - 0.34) * 2.1;
      const dy1 = (v - 0.48) * 2.0;
      const dx2 = (u - 0.64) * 2.2;
      const dy2 = (v - 0.54) * 2.2;
      const radial = Math.max(
        Math.max(0, 1.0 - Math.hypot(dx1, dy1)),
        Math.max(0, 1.0 - Math.hypot(dx2, dy2)) * 0.85
      );
      const fPatch = flourNoise(u, v, 4, 7);
      const flour = Math.max(0, Math.min(0.62, (radial * 0.78 + (fPatch - 0.42) * 0.55) * 0.68));

      const h = ring * 0.38 + fiber * 0.37 + flour * 0.25;
      height[y * size + x] = h;

      // Rich warm golden-beige hinoki cypress (slightly darker than bright mochi for crisp contrast!)
      const woodR = 178 + ring * 22 + (fiber - 0.5) * 12;
      const woodG = 140 + ring * 19 + (fiber - 0.5) * 10;
      const woodB = 96 + ring * 14 + (fiber - 0.5) * 8;

      const r = woodR * (1 - flour) + 236 * flour;
      const g = woodG * (1 - flour) + 232 * flour;
      const b = woodB * (1 - flour) + 222 * flour;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, r));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, g));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, b));
      cImg.data[idx + 3] = 255;

      const rough = Math.min(255, Math.round((0.72 + (1 - ring) * 0.08 + flour * 0.22) * 255));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 1, 1),
    roughnessMap: makeCanvasTex(roughCanvas, false, 1, 1),
    normalMap: heightToNormalTexture(height, size, 1.0, 1, 1),
  };
}

// 4. Shoji Washi Paper (障子紙) — luminous winter white daylight + delicate fibers + plum branch shadow
export function createShojiPaperTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise2D(401, 64);

  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = fbm(u, v, 4, 6);
      const n2 = fbm(u * 2.5, v * 0.7, 3, 16);
      const sunGlow = Math.exp(-((u - 0.36) ** 2 * 1.3 + (v - 0.28) ** 2 * 1.6));
      const base = 228 + sunGlow * 26 + (n1 - 0.5) * 14 + (n2 - 0.5) * 8;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(198, base));
      img.data[idx + 1] = Math.min(255, Math.max(196, base - 1));
      img.data[idx + 2] = Math.min(255, Math.max(192, base - 4 + sunGlow * 5));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const rand = mulberry32(409);
  ctx.strokeStyle = 'rgba(205, 198, 184, 0.32)';
  ctx.lineWidth = 0.85;
  for (let i = 0; i < 340; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 10 + rand() * 28;
    const ang = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang + 0.3) * len * 0.5,
      y + Math.sin(ang + 0.3) * len * 0.5,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    ctx.stroke();
  }

  // Soft out-of-focus winter plum/pine branch silhouette outside the shoji
  ctx.save();
  ctx.filter = 'blur(9px)';
  ctx.strokeStyle = 'rgba(122, 132, 140, 0.30)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(-20, size * 0.45);
  ctx.bezierCurveTo(size * 0.22, size * 0.40, size * 0.40, size * 0.28, size * 0.68, size * 0.16);
  ctx.stroke();

  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(size * 0.24, size * 0.38);
  ctx.quadraticCurveTo(size * 0.36, size * 0.48, size * 0.52, size * 0.52);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.42, size * 0.26);
  ctx.quadraticCurveTo(size * 0.52, size * 0.33, size * 0.70, size * 0.34);
  ctx.stroke();

  ctx.fillStyle = 'rgba(130, 126, 132, 0.22)';
  const buds = [
    [0.29, 0.35, 10], [0.37, 0.44, 9], [0.47, 0.49, 11],
    [0.51, 0.22, 9], [0.60, 0.18, 12], [0.65, 0.32, 10]
  ];
  for (const [bx, by, br] of buds) {
    ctx.beginPath();
    ctx.arc(bx * size, by * size, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = makeCanvasTex(canvas, true, 1, 1);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 5. Freshly Pounded Mochi Surface (creamy warm rice white, subtle starch dusting & moist sheen)
export function createMochiTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(501, 64);
  const fine = makeNoise2D(509, 64);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = fbm(u, v, 4, 6);
      const micro = fine(u, v, 3, 24);
      const dimple = Math.pow(n, 1.35);
      height[y * size + x] = dimple * 0.65 + micro * 0.35;

      // Authentic warm rice-ivory (#ebe4d5 -> #f6f1e6) so highlight peaks retain sculpted 3D volume!
      const flourDust = Math.max(0, (n - 0.54) * 1.8);
      const r = 236 + flourDust * 12 - (1 - micro) * 7;
      const g = 231 + flourDust * 12 - (1 - micro) * 8;
      const b = 219 + flourDust * 14 - (1 - micro) * 9;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, r));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, g));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, b));
      cImg.data[idx + 3] = 255;

      // Moist fresh mochi gloss (~0.24) with powdery flour-dusted matte spots (~0.62)
      const rough = Math.min(255, Math.max(52, Math.round((0.24 + flourDust * 0.38 + (1 - micro) * 0.08) * 255)));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 1, 1),
    roughnessMap: makeCanvasTex(roughCanvas, false, 1, 1),
    normalMap: heightToNormalTexture(height, size, 0.85, 1, 1),
  };
}

// 6. Kinako Powder Texture (きなこ: rich toasted golden-ochre soybean flour, NOT pale lemon yellow!)
export function createKinakoTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(601, 64);
  const rand = mulberry32(607);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const clumps = fbm(u, v, 4, 14);
      const grain = rand();
      const h = clumps * 0.62 + grain * 0.38;
      height[y * size + x] = h;

      // Authentic roasted Japanese kinako: warm toasted caramel-ochre (#b88234) with fine roasted flecks
      const speck = grain > 0.955 ? -32 : (grain < 0.04 ? 14 : 0);
      const r = 182 + (h - 0.5) * 42 + speck;
      const g = 132 + (h - 0.5) * 34 + speck * 0.85;
      const b = 56 + (h - 0.5) * 22 + speck * 0.55;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(0, r));
      img.data[idx + 1] = Math.min(255, Math.max(0, g));
      img.data[idx + 2] = Math.min(255, Math.max(0, b));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 2, 2),
    normalMap: heightToNormalTexture(height, size, 2.5, 2, 2),
  };
}

// 7. Tsubu-an / Anko Texture (つぶあん: deep rich glossy dark-brown-maroon adzuki paste, NOT pink!)
export function createAnkoTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(701, 64);
  const rand = mulberry32(709);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = fbm(u, v, 4, 10);
      height[y * size + x] = n * 0.42;
      const idx = (y * size + x) * 4;
      // Rich dark chocolate-maroon sweet azuki paste
      cImg.data[idx] = 36 + n * 22;
      cImg.data[idx + 1] = 17 + n * 10;
      cImg.data[idx + 2] = 16 + n * 9;
      cImg.data[idx + 3] = 255;

      const rough = Math.round((0.18 + (1 - n) * 0.16) * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }

  // Stamp plump simmered adzuki beans
  const beanCount = 175;
  for (let i = 0; i < beanCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rx = 10 + rand() * 8;
    const ry = 6 + rand() * 5;
    const ang = rand() * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const beanBright = 0.84 + rand() * 0.36;

    const pad = Math.ceil(Math.max(rx, ry)) + 2;
    for (let dy = -pad; dy <= pad; dy++) {
      for (let dx = -pad; dx <= pad; dx++) {
        const lx = (dx * ca + dy * sa) / rx;
        const ly = (-dx * sa + dy * ca) / ry;
        const d2 = lx * lx + ly * ly;
        if (d2 >= 1) continue;
        const dome = Math.sqrt(1 - d2);
        const px = ((Math.floor(cx) + dx) % size + size) % size;
        const py = ((Math.floor(cy) + dy) % size + size) % size;
        const pIdx = py * size + px;
        const newH = 0.35 + dome * 0.65;
        if (newH > height[pIdx]) {
          height[pIdx] = newH;
          const idx = pIdx * 4;
          cImg.data[idx] = Math.min(255, Math.round((56 + dome * 28) * beanBright));
          cImg.data[idx + 1] = Math.min(255, Math.round((22 + dome * 12) * beanBright));
          cImg.data[idx + 2] = Math.min(255, Math.round((21 + dome * 11) * beanBright));
          const rough = Math.round((0.12 + (1 - dome) * 0.16) * 255);
          rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
        }
      }
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 1.5, 1.5),
    roughnessMap: makeCanvasTex(roughCanvas, false, 1.5, 1.5),
    normalMap: heightToNormalTexture(height, size, 3.2, 1.5, 1.5),
  };
}

// 8. Roasted Yaki-Nori (焼き海苔)
export function createNoriTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(801, 64);
  const rand = mulberry32(811);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = fbm(u, v, 4, 14);
      const fiber = fbm(u * 3.0, v * 0.9, 3, 20);
      const crinkle = fbm(u, v, 2, 6);
      const h = n * 0.45 + fiber * 0.4 + crinkle * 0.15;
      height[y * size + x] = h;

      const r = 11 + h * 15;
      const g = 21 + h * 23;
      const b = 13 + h * 13;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = r;
      cImg.data[idx + 1] = g;
      cImg.data[idx + 2] = b;
      cImg.data[idx + 3] = 255;

      const rough = Math.round((0.36 + (1 - h) * 0.28) * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  cCtx.strokeStyle = 'rgba(26, 46, 28, 0.35)';
  cCtx.lineWidth = 1;
  for (let i = 0; i < 450; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 10 + rand() * 34;
    const a = rand() * Math.PI * 2;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    cCtx.stroke();
  }

  return {
    map: makeCanvasTex(colorCanvas, true, 1, 1),
    roughnessMap: makeCanvasTex(roughCanvas, false, 1, 1),
    normalMap: heightToNormalTexture(height, size, 2.2, 1, 1),
  };
}

// 9. Realistic Human Skin Texture (warm Japanese skin, subtle fine pores & vascular tone, no noisy swirl!)
export function createSkinTextures(seed = 901, baseRGB = [212, 158, 128]) {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const fbm = makeNoise2D(seed, 64);
  const pores = makeNoise2D(seed + 17, 64);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const mottle = fbm(u, v, 3, 5);
      const pore = pores(u, v, 2, 32);
      height[y * size + x] = pore * 0.72 + mottle * 0.28;

      // Subtle warm peach/rose micro-variation
      const warmShift = (mottle - 0.5) * 14;
      const poreShade = (pore - 0.5) * 5;
      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, baseRGB[0] + warmShift + poreShade));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, baseRGB[1] + warmShift * 0.62 + poreShade));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, baseRGB[2] + warmShift * 0.45 + poreShade));
      cImg.data[idx + 3] = 255;

      // Natural skin roughness (0.50 - 0.68) so hands never look waxy or chalky
      const rough = Math.round((0.52 + (1 - pore) * 0.12 + (1 - mottle) * 0.05) * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 2, 2),
    roughnessMap: makeCanvasTex(roughCanvas, false, 2, 2),
    normalMap: heightToNormalTexture(height, size, 0.35, 2, 2),
  };
}

// 10. Woven Fabric Textures for Cozy Winter Sleeves
export function createFabricTextures(seed, baseHex, accentHex, pattern = 'knit') {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const c1 = new THREE.Color(baseHex);
  const c2 = new THREE.Color(accentHex);
  const fbm = makeNoise2D(seed, 32);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let weave = 0.5;
      let mix = 0;
      if (pattern === 'knit') {
        const rib = Math.sin(u * Math.PI * 30);
        const loop = Math.sin(v * Math.PI * 44 + (rib > 0 ? 0.5 : -0.5));
        weave = 0.5 + 0.28 * rib + 0.16 * loop;
        mix = Math.max(0, rib) * 0.22;
      } else if (pattern === 'kasuri') {
        const warp = Math.sin(u * Math.PI * 48) * 0.5 + 0.5;
        const weft = Math.sin(v * Math.PI * 48) * 0.5 + 0.5;
        weave = (warp + weft) * 0.5;
        const stripe = (Math.sin(u * Math.PI * 8) > 0.74 || Math.sin(v * Math.PI * 8) > 0.84) ? 0.38 : 0;
        mix = stripe * (0.6 + 0.4 * fbm(u, v, 2, 12));
      } else {
        const warp = Math.sin(u * Math.PI * 56) * 0.5 + 0.5;
        const weft = Math.sin(v * Math.PI * 56) * 0.5 + 0.5;
        weave = 0.38 + 0.62 * ((x + y) % 2 === 0 ? warp : weft);
        mix = fbm(u, v, 3, 8) * 0.30;
      }
      const n = fbm(u, v, 2, 10);
      height[y * size + x] = weave * 0.75 + n * 0.25;

      const shade = 0.80 + weave * 0.30;
      const r = (c1.r * (1 - mix) + c2.r * mix) * shade * 255;
      const g = (c1.g * (1 - mix) + c2.g * mix) * shade * 255;
      const b = (c1.b * (1 - mix) + c2.b * mix) * shade * 255;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(0, r));
      img.data[idx + 1] = Math.min(255, Math.max(0, g));
      img.data[idx + 2] = Math.min(255, Math.max(0, b));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 2, 2),
    normalMap: heightToNormalTexture(height, size, 1.4, 2, 2),
  };
}

// 11. Handcrafted Japanese Ceramic Stoneware Texture
export function createCeramicTextures(seed, baseHex, speckleHex) {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const c1 = new THREE.Color(baseHex);
  const c2 = new THREE.Color(speckleHex);
  const fbm = makeNoise2D(seed, 32);
  const rand = mulberry32(seed + 31);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const wheelRing = 0.5 + 0.5 * Math.sin(v * Math.PI * 26);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const glaze = fbm(u, v, 3, 6);
      const ironSpeck = rand() > 0.986 ? 0.82 : 0;
      height[y * size + x] = wheelRing * 0.4 + glaze * 0.6;

      const shade = 0.86 + glaze * 0.24 + (wheelRing - 0.5) * 0.05;
      const r = (c1.r * (1 - ironSpeck) + c2.r * ironSpeck) * shade * 255;
      const g = (c1.g * (1 - ironSpeck) + c2.g * ironSpeck) * shade * 255;
      const b = (c1.b * (1 - ironSpeck) + c2.b * ironSpeck) * shade * 255;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(0, r));
      img.data[idx + 1] = Math.min(255, Math.max(0, g));
      img.data[idx + 2] = Math.min(255, Math.max(0, b));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: makeCanvasTex(colorCanvas, true, 1, 1),
    normalMap: heightToNormalTexture(height, size, 0.9, 1, 1),
  };
}

// 12. Multi-character soft organic particle sprites (airy flour puff + irregular dust grain + wispy steam)
export function createParticleSprite(kind = 'powder') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;

  if (kind === 'powder_cloud') {
    // Ultra-soft irregular billowing flour haze cloud (NOT a round dot!)
    const rand = mulberry32(881);
    for (let i = 0; i < 9; i++) {
      const ox = cx + (rand() - 0.5) * 18;
      const oy = cx + (rand() - 0.5) * 18;
      const rr = 14 + rand() * 14;
      const g = ctx.createRadialGradient(ox, oy, 1, ox, oy, rr);
      g.addColorStop(0.0, 'rgba(255, 252, 244, 0.28)');
      g.addColorStop(0.55, 'rgba(255, 248, 232, 0.12)');
      g.addColorStop(1.0, 'rgba(255, 244, 220, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'powder') {
    // Crisp tiny irregular powder speck cluster
    const rand = mulberry32(887);
    for (let i = 0; i < 5; i++) {
      const ox = cx + (rand() - 0.5) * 14;
      const oy = cx + (rand() - 0.5) * 14;
      const rr = 4 + rand() * 7;
      const g = ctx.createRadialGradient(ox, oy, 0.5, ox, oy, rr);
      g.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
      g.addColorStop(0.5, 'rgba(255, 248, 236, 0.45)');
      g.addColorStop(1.0, 'rgba(255, 240, 215, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Wispy translucent rising steam
    const grad = ctx.createRadialGradient(cx, cx, 2, cx, cx, cx);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.46)');
    grad.addColorStop(0.45, 'rgba(250, 250, 255, 0.20)');
    grad.addColorStop(0.8, 'rgba(245, 248, 255, 0.06)');
    grad.addColorStop(1.0, 'rgba(245, 248, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
