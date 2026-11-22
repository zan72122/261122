// Procedural PBR Texture & Dynamic Scrubbable Dish Layer Generator
// All textures strictly <= 1024px (256..1024) for mobile 60fps performance.

import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createKitchenTextures() {
  // 1. Brushed Stainless Steel (albedo + roughness + bump/normal feel) - 512x512
  const steelCanvas = makeCanvas(512, 512);
  const sctx = steelCanvas.getContext('2d');
  sctx.fillStyle = '#cfd5da';
  sctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) {
    const base = 196 + Math.sin(y * 0.09) * 8 + (Math.random() - 0.5) * 14;
    sctx.fillStyle = `rgb(${base},${base + 3},${base + 7})`;
    sctx.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 24 + Math.random() * 90;
    const a = (Math.random() - 0.5) * 0.16;
    sctx.strokeStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(60,70,80,${-a})`;
    sctx.lineWidth = 0.8;
    sctx.beginPath();
    sctx.moveTo(x, y);
    sctx.lineTo(x + len, y + (Math.random() - 0.5) * 1.2);
    sctx.stroke();
  }
  const steelMap = new THREE.CanvasTexture(steelCanvas);
  steelMap.colorSpace = THREE.SRGBColorSpace;
  steelMap.wrapS = steelMap.wrapT = THREE.RepeatWrapping;

  const steelRoughCanvas = makeCanvas(256, 256);
  const srctx = steelRoughCanvas.getContext('2d');
  srctx.fillStyle = '#424242';
  srctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = 52 + Math.floor(Math.random() * 26);
    srctx.fillStyle = `rgb(${v},${v},${v})`;
    srctx.fillRect(0, y, 256, 1);
  }
  const steelRoughMap = new THREE.CanvasTexture(steelRoughCanvas);
  steelRoughMap.wrapS = steelRoughMap.wrapT = THREE.RepeatWrapping;

  // 2. Warm Natural Oak Butcher-Block Countertop - 512x512
  const woodCanvas = makeCanvas(512, 512);
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#b98556';
  wctx.fillRect(0, 0, 512, 512);
  const plankCount = 8;
  const plankH = 512 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const y0 = p * plankH;
    const hueShift = (p % 3 - 1) * 9;
    const r = 186 + hueShift;
    const g = 135 + Math.round(hueShift * 0.7);
    const b = 88 + Math.round(hueShift * 0.5);
    wctx.fillStyle = `rgb(${r},${g},${b})`;
    wctx.fillRect(0, y0, 512, plankH);

    // Wood grain fibers
    for (let i = 0; i < 95; i++) {
      const gy = y0 + Math.random() * plankH;
      wctx.strokeStyle = i % 2 === 0 ? 'rgba(92,52,24,0.13)' : 'rgba(238,198,154,0.11)';
      wctx.lineWidth = 0.7 + Math.random() * 1.6;
      wctx.beginPath();
      wctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 32) {
        wctx.lineTo(x, gy + Math.sin(x * 0.025 + i) * 2.4);
      }
      wctx.stroke();
    }
    // Plank seam
    wctx.fillStyle = 'rgba(72,40,18,0.32)';
    wctx.fillRect(0, y0, 512, 1.5);
  }
  const woodMap = new THREE.CanvasTexture(woodCanvas);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.repeat.set(2, 1);

  // 3. Glossy White Ceramic Subway Tile Backsplash - 512x512
  const tileCanvas = makeCanvas(512, 512);
  const tctx = tileCanvas.getContext('2d');
  tctx.fillStyle = '#d7d2cb'; // warm grout
  tctx.fillRect(0, 0, 512, 512);
  const rows = 8;
  const cols = 4;
  const tw = 512 / cols;
  const th = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset + 3;
      const y = r * th + 3;
      const w = tw - 6;
      const h = th - 6;
      const shade = 244 + Math.floor((Math.random() - 0.5) * 8);
      const grad = tctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, `rgb(${shade + 4},${shade + 3},${shade})`);
      grad.addColorStop(1, `rgb(${shade - 5},${shade - 6},${shade - 8})`);
      tctx.fillStyle = grad;
      tctx.beginPath();
      tctx.roundRect(x, y, w, h, 4);
      tctx.fill();
    }
  }
  const tileMap = new THREE.CanvasTexture(tileCanvas);
  tileMap.colorSpace = THREE.SRGBColorSpace;
  tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping;
  tileMap.repeat.set(3, 1.4);

  // 4. Porous Yellow Cellulose Kitchen Sponge Texture + Bump - 512x512
  const spongeCanvas = makeCanvas(512, 512);
  const spctx = spongeCanvas.getContext('2d');
  spctx.fillStyle = '#f6ca38';
  spctx.fillRect(0, 0, 512, 512);
  const spongeBumpCanvas = makeCanvas(512, 512);
  const sbctx = spongeBumpCanvas.getContext('2d');
  sbctx.fillStyle = '#d8d8d8';
  sbctx.fillRect(0, 0, 512, 512);

  // Micro sponge texture
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1.2 + Math.random() * 2.8;
    spctx.fillStyle = Math.random() > 0.45 ? 'rgba(212,152,16,0.34)' : 'rgba(255,236,130,0.38)';
    spctx.beginPath();
    spctx.arc(x, y, r, 0, Math.PI * 2);
    spctx.fill();

    sbctx.fillStyle = 'rgba(120,120,120,0.35)';
    sbctx.beginPath();
    sbctx.arc(x, y, r, 0, Math.PI * 2);
    sbctx.fill();
  }
  // Larger authentic cellulose pores
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rx = 3 + Math.random() * 8;
    const ry = 2.5 + Math.random() * 6.5;
    const rot = Math.random() * Math.PI;
    spctx.save();
    spctx.translate(x, y);
    spctx.rotate(rot);
    spctx.fillStyle = 'rgba(168,112,8,0.52)';
    spctx.beginPath();
    spctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    spctx.fill();
    spctx.strokeStyle = 'rgba(255,235,140,0.45)';
    spctx.lineWidth = 1.2;
    spctx.stroke();
    spctx.restore();

    sbctx.save();
    sbctx.translate(x, y);
    sbctx.rotate(rot);
    sbctx.fillStyle = '#303030';
    sbctx.beginPath();
    sbctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    sbctx.fill();
    sbctx.restore();
  }
  const spongeMap = new THREE.CanvasTexture(spongeCanvas);
  spongeMap.colorSpace = THREE.SRGBColorSpace;
  const spongeBumpMap = new THREE.CanvasTexture(spongeBumpCanvas);

  // 5. Green Fibrous Scouring Pad Texture - 256x256
  const scourCanvas = makeCanvas(256, 256);
  const scctx = scourCanvas.getContext('2d');
  scctx.fillStyle = '#1f6a3b';
  scctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    scctx.strokeStyle = i % 3 === 0 ? 'rgba(12,42,22,0.55)' : 'rgba(62,148,88,0.42)';
    scctx.lineWidth = 1.1;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = Math.random() * Math.PI * 2;
    scctx.beginPath();
    scctx.moveTo(x, y);
    scctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    scctx.stroke();
  }
  const scourMap = new THREE.CanvasTexture(scourCanvas);
  scourMap.colorSpace = THREE.SRGBColorSpace;

  // 6. Pictorial Soap Bottle Labels (ZERO text! Pure fruit & sparkle art!) - 256x256
  const citrusLabel = createSoapLabelTexture('#fff9eb', '#ff9b19', '#ffe14d', 'citrus');
  const berryLabel = createSoapLabelTexture('#fff2f6', '#ec3b76', '#ff8fb8', 'berry');

  // 7. Water Ripple / Caustic Texture - 256x256
  const waterCanvas = makeCanvas(256, 256);
  const wtctx = waterCanvas.getContext('2d');
  wtctx.fillStyle = '#808080';
  wtctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 10 + Math.random() * 28;
    const g = wtctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.7, 'rgba(210,210,210,0.12)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    wtctx.fillStyle = g;
    wtctx.beginPath();
    wtctx.arc(x, y, r, 0, Math.PI * 2);
    wtctx.fill();
  }
  const waterBumpMap = new THREE.CanvasTexture(waterCanvas);
  waterBumpMap.wrapS = waterBumpMap.wrapT = THREE.RepeatWrapping;

  // 8. Woven Linen Apron & Gingham Party Placemat - 256x256
  const apronCanvas = makeCanvas(256, 256);
  const apctx = apronCanvas.getContext('2d');
  apctx.fillStyle = '#e78d73';
  apctx.fillRect(0, 0, 256, 256);
  apctx.fillStyle = 'rgba(255,235,225,0.22)';
  for (let i = 0; i < 256; i += 8) {
    apctx.fillRect(i, 0, 3, 256);
    apctx.fillRect(0, i, 256, 3);
  }
  const apronMap = new THREE.CanvasTexture(apronCanvas);
  apronMap.colorSpace = THREE.SRGBColorSpace;
  apronMap.wrapS = apronMap.wrapT = THREE.RepeatWrapping;

  const ginghamCanvas = makeCanvas(256, 256);
  const gctx = ginghamCanvas.getContext('2d');
  gctx.fillStyle = '#fffaf5';
  gctx.fillRect(0, 0, 256, 256);
  gctx.fillStyle = 'rgba(242, 92, 118, 0.36)';
  for (let i = 0; i < 256; i += 32) {
    gctx.fillRect(i, 0, 16, 256);
    gctx.fillRect(0, i, 256, 16);
  }
  const ginghamMap = new THREE.CanvasTexture(ginghamCanvas);
  ginghamMap.colorSpace = THREE.SRGBColorSpace;
  ginghamMap.wrapS = ginghamMap.wrapT = THREE.RepeatWrapping;
  ginghamMap.repeat.set(3, 2);

  // 9. Realistic Glossy Iris Texture for Helper Girl - 256x256
  const eyeCanvas = makeCanvas(256, 256);
  const ectx = eyeCanvas.getContext('2d');
  ectx.fillStyle = '#fcfaf7';
  ectx.fillRect(0, 0, 256, 256);
  const cx = 128, cy = 128;
  const irisGrad = ectx.createRadialGradient(cx, cy, 18, cx, cy, 78);
  irisGrad.addColorStop(0, '#3a2214');
  irisGrad.addColorStop(0.55, '#6e4226');
  irisGrad.addColorStop(0.88, '#4a2b18');
  irisGrad.addColorStop(1, '#26140a');
  ectx.fillStyle = irisGrad;
  ectx.beginPath();
  ectx.arc(cx, cy, 78, 0, Math.PI * 2);
  ectx.fill();
  // Iris fibers
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    ectx.strokeStyle = i % 2 === 0 ? 'rgba(215,155,95,0.28)' : 'rgba(35,18,8,0.32)';
    ectx.lineWidth = 1.6;
    ectx.beginPath();
    ectx.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
    ectx.lineTo(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74);
    ectx.stroke();
  }
  // Pupil
  ectx.fillStyle = '#120b08';
  ectx.beginPath();
  ectx.arc(cx, cy, 32, 0, Math.PI * 2);
  ectx.fill();
  // Crisp window catchlights
  ectx.fillStyle = 'rgba(255,255,255,0.96)';
  ectx.beginPath();
  ectx.arc(cx - 24, cy - 26, 16, 0, Math.PI * 2);
  ectx.fill();
  ectx.fillStyle = 'rgba(255,245,230,0.82)';
  ectx.beginPath();
  ectx.arc(cx + 22, cy + 24, 8, 0, Math.PI * 2);
  ectx.fill();
  const eyeMap = new THREE.CanvasTexture(eyeCanvas);
  eyeMap.colorSpace = THREE.SRGBColorSpace;

  // 10. Sparkle Star Sprite Texture - 128x128
  const spkCanvas = makeCanvas(128, 128);
  const kctx = spkCanvas.getContext('2d');
  const rg = kctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.25, 'rgba(255,250,210,0.85)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  kctx.fillStyle = rg;
  kctx.fillRect(0, 0, 128, 128);
  kctx.fillStyle = '#ffffff';
  for (let r = 0; r < 2; r++) {
    kctx.save();
    kctx.translate(64, 64);
    kctx.rotate(r * Math.PI * 0.5);
    kctx.beginPath();
    kctx.ellipse(0, 0, 56, 4.5, 0, 0, Math.PI * 2);
    kctx.fill();
    kctx.restore();
  }
  const sparkleMap = new THREE.CanvasTexture(spkCanvas);
  sparkleMap.colorSpace = THREE.SRGBColorSpace;

  return {
    steelMap,
    steelRoughMap,
    woodMap,
    tileMap,
    spongeMap,
    spongeBumpMap,
    scourMap,
    citrusLabel,
    berryLabel,
    waterBumpMap,
    apronMap,
    ginghamMap,
    eyeMap,
    sparkleMap,
  };
}

function createSoapLabelTexture(bg, mainColor, lightColor, kind) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Rounded waterproof glossy sticker (front half of cylinder UV)
  ctx.fillStyle = bg;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(44, 28, 168, 200, 32);
  ctx.fill();
  ctx.stroke();

  if (kind === 'citrus') {
    // Sliced juicy orange/lemon emblem (ZERO letters!)
    const cx = 128, cy = 132, r = 48;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lightColor;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + 0.08;
      const a1 = ((i + 1) / 8) * Math.PI * 2 - 0.08;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 11, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    // Green leaf
    ctx.fillStyle = '#38a84c';
    ctx.beginPath();
    ctx.ellipse(cx + 22, cy - 52, 18, 9, -0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Plump glossy strawberry emblem (ZERO letters!)
    const cx = 128, cy = 136;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 48);
    ctx.bezierCurveTo(cx - 54, cy + 18, cx - 48, cy - 38, cx, cy - 34);
    ctx.bezierCurveTo(cx + 48, cy - 38, cx + 54, cy + 18, cx, cy + 48);
    ctx.fill();
    // Seeds
    ctx.fillStyle = '#ffe58f';
    const seeds = [[-18, -10], [0, -14], [18, -10], [-24, 8], [-8, 10], [8, 10], [24, 8], [-10, 26], [10, 26]];
    seeds.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.ellipse(cx + sx, cy + sy, 2.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Green calyx leaves
    ctx.fillStyle = '#33a34a';
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.translate(cx, cy - 34);
      ctx.rotate(i * 0.45);
      ctx.beginPath();
      ctx.ellipse(0, -8, 7, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Pictorial shiny bubbles at top of sticker
  [[82, 66, 11], [174, 70, 14], [158, 48, 8]].forEach(([bx, by, br]) => {
    ctx.fillStyle = 'rgba(130, 215, 255, 0.45)';
    ctx.strokeStyle = 'rgba(80, 180, 240, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.28, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Dynamic Scrubbable Surface for each Dish (512x512).
 * Maintains:
 *  - baseCanvas: clean porcelain/glass/enamel pattern
 *  - dirtCanvas: realistic food sauces, grease, cream smears (erased physically along finger UV path)
 *  - sudsCanvas: creamy micro-foam trails deposited by soapy sponge & washed downward by running water
 *  - compositeCanvas -> THREE.CanvasTexture (color) + roughnessCanvas -> THREE.CanvasTexture (roughness)
 */
export class ScrubbableDishSurface {
  constructor(recipe) {
    this.size = 512;
    this.recipe = recipe;

    this.baseCanvas = makeCanvas(this.size, this.size);
    this.dirtCanvas = makeCanvas(this.size, this.size);
    this.sudsCanvas = makeCanvas(this.size, this.size);
    this.compCanvas = makeCanvas(this.size, this.size);
    this.roughCanvas = makeCanvas(128, 128);

    this.baseCtx = this.baseCanvas.getContext('2d');
    this.dirtCtx = this.dirtCanvas.getContext('2d', { willReadFrequently: true });
    this.sudsCtx = this.sudsCanvas.getContext('2d', { willReadFrequently: true });
    this.compCtx = this.compCanvas.getContext('2d');
    this.roughCtx = this.roughCanvas.getContext('2d');

    this.colorMap = new THREE.CanvasTexture(this.compCanvas);
    this.colorMap.colorSpace = THREE.SRGBColorSpace;

    this.roughnessMap = new THREE.CanvasTexture(this.roughCanvas);

    this.initialDirtScore = 1;
    this.dirtRatio = 1;
    this.sudsRatio = 0;
    this._sampleCounter = 0;

    this._paintBase();
    this.resetDirt();
  }

  _paintBase() {
    const s = this.size;
    const ctx = this.baseCtx;
    const cx = s * 0.5, cy = s * 0.5;
    ctx.fillStyle = this.recipe.baseColor || '#f9fbfd';
    ctx.fillRect(0, 0, s, s);

    // Subtle glazed ceramic radial shading
    const rg = ctx.createRadialGradient(cx, cy, s * 0.08, cx, cy, s * 0.49);
    rg.addColorStop(0, this.recipe.centerTint || '#ffffff');
    rg.addColorStop(0.72, this.recipe.baseColor || '#f5f8fb');
    rg.addColorStop(1, this.recipe.rimShade || '#e6ecf2');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, s, s);

    if (this.recipe.rimStripeColor) {
      ctx.strokeStyle = this.recipe.rimStripeColor;
      ctx.lineWidth = this.recipe.rimStripeWidth || 14;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.435, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = this.recipe.rimInnerColor || this.recipe.rimStripeColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.39, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  resetDirt() {
    const s = this.size;
    const dctx = this.dirtCtx;
    dctx.clearRect(0, 0, s, s);
    this.sudsCtx.clearRect(0, 0, s, s);

    const cx = s * 0.5, cy = s * 0.5;
    const stains = this.recipe.stains || [];

    // Rich multi-layered realistic sauce smears, rings, and splatters
    stains.forEach((st) => {
      const x = cx + st.x * s;
      const y = cy + st.y * s;
      const r = st.r * s;
      const grad = dctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.1, x, y, r);
      grad.addColorStop(0, st.innerColor || st.color);
      grad.addColorStop(0.7, st.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = grad;
      dctx.save();
      dctx.translate(x, y);
      dctx.rotate(st.rot || 0);
      dctx.scale(1, st.aspect || 0.82);
      dctx.beginPath();
      dctx.arc(0, 0, r, 0, Math.PI * 2);
      dctx.fill();
      dctx.restore();
    });

    // Swirl / fork-streak sauce trails for unmistakable food realism
    if (this.recipe.swirlColor) {
      dctx.strokeStyle = this.recipe.swirlColor;
      dctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        dctx.lineWidth = 14 + (i % 3) * 8;
        const a0 = i * 0.9;
        const rad = s * (0.11 + (i % 4) * 0.06);
        dctx.beginPath();
        dctx.arc(cx + Math.cos(a0) * 18, cy + Math.sin(a0) * 18, rad, a0, a0 + 1.55);
        dctx.stroke();
      }
    }

    this._recomputeScores(true);
    this._compose();
  }

  // Scrub at normalized local dish coordinates (u, v in 0..1)
  scrubAt(u, v, radiusUV, soapPower, sudsTint = '#ffffff', isOily = false) {
    const s = this.size;
    const px = u * s;
    const py = v * s;
    const rad = radiusUV * s;

    if (soapPower > 0.05) {
      // Surfactant dissolves dirt right along finger path!
      const dctx = this.dirtCtx;
      dctx.save();
      dctx.globalCompositeOperation = 'destination-out';
      const eraseAlpha = Math.min(0.98, 0.65 + soapPower * 0.35);
      const g = dctx.createRadialGradient(px, py, rad * 0.48, px, py, rad);
      g.addColorStop(0, `rgba(0,0,0,${eraseAlpha})`);
      g.addColorStop(0.75, `rgba(0,0,0,${eraseAlpha * 0.85})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(px, py, rad, 0, Math.PI * 2);
      dctx.fill();
      dctx.restore();

      // Paint fluffy micro-foam lather along scrub path!
      const sctx = this.sudsCtx;
      sctx.save();
      for (let i = 0; i < 5; i++) {
        const ox = (Math.random() - 0.5) * rad * 0.85;
        const oy = (Math.random() - 0.5) * rad * 0.85;
        const br = rad * (0.28 + Math.random() * 0.38);
        const sg = sctx.createRadialGradient(px + ox - br * 0.2, py + oy - br * 0.2, br * 0.08, px + ox, py + oy, br);
        sg.addColorStop(0, 'rgba(255,255,255,0.88)');
        sg.addColorStop(0.65, sudsTint);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        sctx.fillStyle = sg;
        sctx.beginPath();
        sctx.arc(px + ox, py + oy, br, 0, Math.PI * 2);
        sctx.fill();
      }
      sctx.restore();
    } else if (isOily) {
      // Without soap on an oily dish: oil smears slightly instead of coming clean!
      const dctx = this.dirtCtx;
      dctx.save();
      dctx.fillStyle = this.recipe.oilSmearColor || 'rgba(185, 110, 35, 0.10)';
      dctx.beginPath();
      dctx.arc(px + (Math.random() - 0.5) * 10, py + (Math.random() - 0.5) * 10, rad * 0.55, 0, Math.PI * 2);
      dctx.fill();
      dctx.restore();
    } else {
      // Non-oily dish with plain wet sponge smudges lightly (very weak cleaning -> invites soap!)
      const dctx = this.dirtCtx;
      dctx.save();
      dctx.globalCompositeOperation = 'destination-out';
      dctx.fillStyle = 'rgba(0,0,0,0.06)';
      dctx.beginPath();
      dctx.arc(px, py, rad * 0.5, 0, Math.PI * 2);
      dctx.fill();
      dctx.restore();
    }

    this._sampleCounter++;
    if (this._sampleCounter % 3 === 0) {
      this._recomputeScores(false);
    }
    this._compose();
  }

  // Rinse under water stream at (u, v) — avoids 8-bit Canvas alpha quantization stalls!
  rinseAt(u, v, radiusUV, strength = 1.0) {
    const s = this.size;
    const px = u * s;
    const py = v * s;
    const rad = radiusUV * s;

    const sctx = this.sudsCtx;
    sctx.save();
    sctx.globalCompositeOperation = 'destination-out';
    const coreA = Math.max(0.28, Math.min(1, 0.85 * strength));
    const g = sctx.createRadialGradient(px, py, rad * 0.45, px, py, rad * 1.45);
    g.addColorStop(0, `rgba(0,0,0,${coreA})`);
    g.addColorStop(0.8, `rgba(0,0,0,${coreA * 0.65})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(px, py, rad * 1.45, 0, Math.PI * 2);
    sctx.fill();

    // Sheet-flow water splash across dish: washes suds off evenly within ~1.8s under stream!
    this._rinseSplashAccum = (this._rinseSplashAccum || 0) + strength * 0.24;
    if (this._rinseSplashAccum >= 0.20) {
      sctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, this._rinseSplashAccum * 1.4)})`;
      sctx.fillRect(0, 0, s, s);
      if (!this.recipe.isOily && this.dirtRatio < 0.22) {
        this.dirtCtx.save();
        this.dirtCtx.globalCompositeOperation = 'destination-out';
        this.dirtCtx.fillStyle = 'rgba(0,0,0,0.22)';
        this.dirtCtx.fillRect(0, 0, s, s);
        this.dirtCtx.restore();
      }
      this._rinseSplashAccum = 0;
    }
    sctx.restore();

    this._recomputeScores(false);
    this._compose();
  }

  snapSparklingClean() {
    this.dirtCtx.clearRect(0, 0, this.size, this.size);
    this.sudsCtx.clearRect(0, 0, this.size, this.size);
    this.dirtRatio = 0;
    this.sudsRatio = 0;
    this._compose();
  }

  _recomputeScores(isInitial) {
    // Fast strided alpha sum inside the dish circle (radius 0.42 * size)
    const s = this.size;
    const dData = this.dirtCtx.getImageData(0, 0, s, s).data;
    const fData = this.sudsCtx.getImageData(0, 0, s, s).data;
    const half = s * 0.5;
    const maxR2 = (s * 0.41) * (s * 0.41);
    const step = 8;
    let dirtSum = 0;
    let sudsSum = 0;
    let totalSamples = 0;

    for (let y = 40; y < s - 40; y += step) {
      const dy = y - half;
      for (let x = 40; x < s - 40; x += step) {
        const dx = x - half;
        if (dx * dx + dy * dy <= maxR2) {
          const idx = (y * s + x) * 4 + 3;
          dirtSum += dData[idx];
          sudsSum += fData[idx];
          totalSamples++;
        }
      }
    }

    if (isInitial) {
      this.initialDirtScore = Math.max(1, dirtSum);
      this.dirtRatio = 1;
      this.sudsRatio = 0;
    } else {
      this.dirtRatio = Math.min(1, dirtSum / this.initialDirtScore);
      this.sudsRatio = Math.min(1, sudsSum / (totalSamples * 135));
    }
  }

  _compose() {
    const s = this.size;
    this.compCtx.clearRect(0, 0, s, s);
    this.compCtx.drawImage(this.baseCanvas, 0, 0);
    this.compCtx.drawImage(this.dirtCanvas, 0, 0);
    this.compCtx.drawImage(this.sudsCanvas, 0, 0);
    this.colorMap.needsUpdate = true;

    // Roughness map: clean porcelain is mirror-smooth (#121212 -> ~0.07), dirt/suds are rougher (#b8b8b8)
    const rctx = this.roughCtx;
    const baseRough = this.recipe.cleanRoughnessByte ?? 18;
    rctx.fillStyle = `rgb(${baseRough},${baseRough},${baseRough})`;
    rctx.fillRect(0, 0, 128, 128);
    rctx.globalAlpha = 0.78;
    rctx.drawImage(this.dirtCanvas, 0, 0, 128, 128);
    rctx.globalAlpha = 0.55;
    rctx.drawImage(this.sudsCanvas, 0, 0, 128, 128);
    rctx.globalAlpha = 1.0;
    this.roughnessMap.needsUpdate = true;
  }

  dispose() {
    this.colorMap.dispose();
    this.roughnessMap.dispose();
  }
}
