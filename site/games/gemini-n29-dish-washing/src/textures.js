import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Seeded deterministic PRNG for rich procedural grain
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

export function createBrushedSteelTextures() {
  const size = 512;
  const colorCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const rng = mulberry32(101);

  cCtx.fillStyle = '#c8cdd2';
  cCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#555555';
  rCtx.fillRect(0, 0, size, size);

  // Fine horizontal brushed stainless grain
  for (let i = 0; i < 2400; i++) {
    const y = rng() * size;
    const x = rng() * size;
    const len = 40 + rng() * 190;
    const shade = Math.floor(175 + rng() * 55);
    const alpha = 0.08 + rng() * 0.14;
    cCtx.fillStyle = `rgba(${shade},${shade + 3},${shade + 7},${alpha})`;
    cCtx.fillRect(x, y, len, 1 + rng() * 1.2);
    cCtx.fillRect(x - size, y, len, 1 + rng() * 1.2);

    const rShade = Math.floor(55 + rng() * 75);
    rCtx.fillStyle = `rgba(${rShade},${rShade},${rShade},${alpha * 1.3})`;
    rCtx.fillRect(x, y, len, 1.2);
  }

  // Subtle water-spot variation
  for (let i = 0; i < 35; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 12 + rng() * 32;
    const g = rCtx.createRadialGradient(x, y, 2, x, y, rad);
    g.addColorStop(0, 'rgba(130,130,130,0.14)');
    g.addColorStop(1, 'rgba(90,90,90,0)');
    rCtx.fillStyle = g;
    rCtx.beginPath();
    rCtx.arc(x, y, rad, 0, Math.PI * 2);
    rCtx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap };
}

export function createSubwayTileTextures() {
  const size = 512;
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);
  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const rng = mulberry32(202);

  // Warm light grout
  cCtx.fillStyle = '#c8c3ba';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#282828';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#dcdcdc';
  rCtx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const tileW = size / cols;
  const tileH = size / rows;
  const grout = 4;

  for (let row = 0; row < rows; row++) {
    const offsetX = (row % 2) * (tileW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * tileW + offsetX + grout * 0.5;
      const y = row * tileH + grout * 0.5;
      const w = tileW - grout;
      const h = tileH - grout;

      const warm = Math.floor((rng() - 0.5) * 10);
      const baseR = 246 + warm;
      const baseG = 243 + warm;
      const baseB = 236 + warm;

      const grad = cCtx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, `rgb(${Math.min(255, baseR + 5)},${Math.min(255, baseG + 5)},${Math.min(255, baseB + 4)})`);
      grad.addColorStop(0.5, `rgb(${baseR},${baseG},${baseB})`);
      grad.addColorStop(1, `rgb(${baseR - 8},${baseG - 8},${baseB - 7})`);
      cCtx.fillStyle = grad;
      cCtx.fillRect(x, y, w, h);

      // Glossy bevel highlight
      cCtx.strokeStyle = 'rgba(255,255,255,0.55)';
      cCtx.lineWidth = 2;
      cCtx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Bump height
      bCtx.fillStyle = '#e5e5e5';
      bCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
      bCtx.strokeStyle = '#999999';
      bCtx.lineWidth = 2;
      bCtx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Glazed low roughness
      const rv = Math.floor(28 + rng() * 18);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, w, h);
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.2, 1.8);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.2, 1.8);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.2, 1.8);

  return { map, bumpMap, roughnessMap };
}

export function createWoodCounterTextures() {
  const size = 512;
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rng = mulberry32(303);

  // Rich medium-warm natural oak butcher block (strong contrast against white ceramics & foam!)
  const planks = 6;
  const plankH = size / planks;

  for (let p = 0; p < planks; p++) {
    const py = p * plankH;
    const tone = (rng() - 0.5) * 20;
    const r = Math.floor(156 + tone);
    const g = Math.floor(114 + tone * 0.82);
    const b = Math.floor(76 + tone * 0.62);

    cCtx.fillStyle = `rgb(${r},${g},${b})`;
    cCtx.fillRect(0, py, size, plankH);

    bCtx.fillStyle = '#888888';
    bCtx.fillRect(0, py, size, plankH);

    // Wood grain fibers
    for (let i = 0; i < 140; i++) {
      const gy = py + rng() * plankH;
      const dark = rng() > 0.35;
      const alpha = 0.06 + rng() * 0.14;
      cCtx.strokeStyle = dark
        ? `rgba(${r - 42},${g - 38},${b - 28},${alpha})`
        : `rgba(${Math.min(255, r + 26)},${Math.min(255, g + 22)},${Math.min(255, b + 16)},${alpha})`;
      cCtx.lineWidth = 0.8 + rng() * 2.2;
      cCtx.beginPath();
      const wave = (rng() - 0.5) * 8;
      cCtx.moveTo(0, gy);
      cCtx.bezierCurveTo(size * 0.33, gy + wave, size * 0.66, gy - wave, size, gy);
      cCtx.stroke();

      bCtx.strokeStyle = dark ? `rgba(80,80,80,${alpha * 1.4})` : `rgba(175,175,175,${alpha})`;
      bCtx.lineWidth = 1.2;
      bCtx.beginPath();
      bCtx.moveTo(0, gy);
      bCtx.bezierCurveTo(size * 0.33, gy + wave, size * 0.66, gy - wave, size, gy);
      bCtx.stroke();
    }

    // Subtle plank seam
    cCtx.fillStyle = 'rgba(70,45,25,0.28)';
    cCtx.fillRect(0, py, size, 1.5);
    bCtx.fillStyle = '#303030';
    bCtx.fillRect(0, py, size, 2);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 1.5);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.2, 1.5);

  return { map, bumpMap };
}

export function createSpongeTextures() {
  const size = 256;
  const yellowColor = makeCanvas(size, size);
  const yellowBump = makeCanvas(size, size);
  const greenColor = makeCanvas(size, size);
  const greenBump = makeCanvas(size, size);
  const rng = mulberry32(404);

  const yc = yellowColor.getContext('2d');
  const yb = yellowBump.getContext('2d');
  yc.fillStyle = '#f2c63d';
  yc.fillRect(0, 0, size, size);
  yb.fillStyle = '#c8c8c8';
  yb.fillRect(0, 0, size, size);

  // Porous urethane cells
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 1.2 + rng() * 3.8;
    const dark = rng() > 0.25;
    yc.fillStyle = dark
      ? `rgba(196,138,18,${0.25 + rng() * 0.45})`
      : `rgba(255,233,130,${0.3 + rng() * 0.35})`;
    yc.beginPath();
    yc.arc(x, y, rad, 0, Math.PI * 2);
    yc.fill();

    yb.fillStyle = dark ? `rgba(35,35,35,${0.4 + rng() * 0.5})` : 'rgba(245,245,245,0.35)';
    yb.beginPath();
    yb.arc(x, y, rad, 0, Math.PI * 2);
    yb.fill();
  }

  // Green scouring pad fibrous texture
  const gc = greenColor.getContext('2d');
  const gb = greenBump.getContext('2d');
  gc.fillStyle = '#266b3a';
  gc.fillRect(0, 0, size, size);
  gb.fillStyle = '#707070';
  gb.fillRect(0, 0, size, size);

  for (let i = 0; i < 1400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const ang = rng() * Math.PI * 2;
    const len = 5 + rng() * 14;
    const bright = rng() > 0.45;
    gc.strokeStyle = bright ? 'rgba(65,148,84,0.45)' : 'rgba(18,56,28,0.55)';
    gc.lineWidth = 1 + rng() * 1.4;
    gc.beginPath();
    gc.moveTo(x, y);
    gc.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    gc.stroke();

    gb.strokeStyle = bright ? 'rgba(215,215,215,0.45)' : 'rgba(30,30,30,0.45)';
    gb.lineWidth = 1.2;
    gb.beginPath();
    gb.moveTo(x, y);
    gb.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    gb.stroke();
  }

  const yMap = new THREE.CanvasTexture(yellowColor);
  yMap.colorSpace = THREE.SRGBColorSpace;
  yMap.wrapS = yMap.wrapT = THREE.RepeatWrapping;

  const yBumpMap = new THREE.CanvasTexture(yellowBump);
  yBumpMap.wrapS = yBumpMap.wrapT = THREE.RepeatWrapping;

  const gMap = new THREE.CanvasTexture(greenColor);
  gMap.colorSpace = THREE.SRGBColorSpace;
  gMap.wrapS = gMap.wrapT = THREE.RepeatWrapping;

  const gBumpMap = new THREE.CanvasTexture(greenBump);
  gBumpMap.wrapS = gBumpMap.wrapT = THREE.RepeatWrapping;

  return { yMap, yBumpMap, gMap, gBumpMap };
}

export function createWindowGardenTexture() {
  const c = makeCanvas(512, 384);
  const ctx = c.getContext('2d');
  const rng = mulberry32(505);

  // Soft sunlit sky & bright morning garden bokeh (realistic out-of-focus kitchen window view)
  const sky = ctx.createLinearGradient(0, 0, 0, 384);
  sky.addColorStop(0, '#a9d7f5');
  sky.addColorStop(0.45, '#e7f4fb');
  sky.addColorStop(0.7, '#d8ecc8');
  sky.addColorStop(1, '#7ea862');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 384);

  // Soft foliage blobs
  for (let i = 0; i < 60; i++) {
    const x = rng() * 512;
    const y = 160 + rng() * 230;
    const r = 24 + rng() * 64;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    const isLight = rng() > 0.4;
    g.addColorStop(0, isLight ? 'rgba(170,214,122,0.52)' : 'rgba(84,136,64,0.42)');
    g.addColorStop(1, 'rgba(120,175,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunlit bokeh circles
  for (let i = 0; i < 24; i++) {
    const x = rng() * 512;
    const y = 30 + rng() * 260;
    const r = 10 + rng() * 28;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255,252,226,0.58)');
    g.addColorStop(0.7, 'rgba(255,248,210,0.22)');
    g.addColorStop(1, 'rgba(255,248,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDetergentLabelTexture() {
  // Wordless botanical citrus drop artwork on the soap bottle
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  // Semi-clean white botanical label
  ctx.fillStyle = '#f8fbf7';
  ctx.fillRect(0, 0, 256, 256);

  // Top & bottom subtle green trim
  ctx.fillStyle = '#48b86d';
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 238, 256, 18);

  // Glossy lime slice illustration (wordless!)
  const cx = 128;
  const cy = 126;
  ctx.fillStyle = '#6ad454';
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e7f9d4';
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#9be862';
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + 0.08;
    const a1 = ((i + 1) / 8) * Math.PI * 2 - 0.08;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 46, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  // Sparkling bubbles around the lime (communicates soap foam!)
  const bubbles = [
    [60, 74, 15],
    [194, 70, 19],
    [198, 178, 13],
    [62, 182, 11],
    [128, 44, 10],
  ];
  for (const [bx, by, br] of bubbles) {
    const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(175,238,255,0.55)');
    g.addColorStop(1, 'rgba(110,210,180,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSparkleTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 56);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.25, 'rgba(255,252,225,0.85)');
  glow.addColorStop(0.6, 'rgba(210,242,255,0.22)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 4-point crisp star gleam
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.beginPath();
  ctx.moveTo(cx, 6);
  ctx.quadraticCurveTo(cx + 5, cy - 5, size - 6, cy);
  ctx.quadraticCurveTo(cx + 5, cy + 5, cx, size - 6);
  ctx.quadraticCurveTo(cx - 5, cy + 5, 6, cy);
  ctx.quadraticCurveTo(cx - 5, cy - 5, cx, 6);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createApronFabricTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  // Natural woven oatmeal linen apron with subtle fine stripes
  ctx.fillStyle = '#e7d9c5';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(176,120,98,0.22)';
  for (let i = 0; i < size; i += 24) {
    ctx.fillRect(i, 0, 5, size);
  }
  // Fine linen cross-weave texture
  ctx.fillStyle = 'rgba(110,88,68,0.09)';
  for (let i = 0; i < size; i += 4) {
    ctx.fillRect(i, 0, 1, size);
    ctx.fillRect(0, i, size, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}
