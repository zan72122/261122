import * as THREE from '../vendor/three.module.min.js';

// Seeded PRNG for deterministic, tactile craft textures
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

/**
 * Miniature glazed ceramic wall tiles (512x512)
 * Soft cream-mint glazed squares with subtle kiln glaze variation & recessed warm grout.
 */
export function createWallTileTextures() {
  const size = 512;
  const cols = 8;
  const rows = 8;
  const tileW = size / cols;
  const tileH = size / rows;
  const rand = mulberry32(1042);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  // Warm stone grout base
  ctx.fillStyle = '#bab2a6';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#262626';
  bctx.fillRect(0, 0, size, size);

  const palette = [
    [206, 228, 224],
    [196, 222, 218],
    [214, 232, 228],
    [192, 218, 214],
    [218, 235, 230],
  ];

  const pad = 3.2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW + pad;
      const y = r * tileH + pad;
      const w = tileW - pad * 2;
      const h = tileH - pad * 2;

      const base = palette[Math.floor(rand() * palette.length)];
      const shift = Math.floor((rand() - 0.5) * 10);
      const R = Math.min(255, Math.max(0, base[0] + shift));
      const G = Math.min(255, Math.max(0, base[1] + shift));
      const B = Math.min(255, Math.max(0, base[2] + shift));

      // Subtle ceramic glaze gradient per tile
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, `rgb(${Math.min(255, R + 8)},${Math.min(255, G + 8)},${Math.min(255, B + 8)})`);
      grad.addColorStop(0.55, `rgb(${R},${G},${B})`);
      grad.addColorStop(1, `rgb(${Math.max(0, R - 10)},${Math.max(0, G - 8)},${Math.max(0, B - 7)})`);

      roundRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = grad;
      ctx.fill();

      // Tiny glossy edge highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bump: pillowy domed ceramic tile
      const bgrad = bctx.createRadialGradient(
        x + w * 0.5,
        y + h * 0.5,
        w * 0.08,
        x + w * 0.5,
        y + h * 0.5,
        w * 0.65
      );
      bgrad.addColorStop(0, '#ffffff');
      bgrad.addColorStop(0.82, '#e2e2e2');
      bgrad.addColorStop(1, '#7a7a7a');
      roundRect(bctx, x, y, w, h, 6);
      bctx.fillStyle = bgrad;
      bctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 1.5);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.5, 1.5);
  bumpMap.anisotropy = 4;

  return { map, bumpMap };
}

/**
 * Miniature bathroom floor mosaic tiles (512x512)
 * Warm cream & dusty terracotta/peach micro-squares like a real dollhouse/architectural model.
 */
export function createFloorTileTextures() {
  const size = 512;
  const cols = 10;
  const rows = 10;
  const tileW = size / cols;
  const tileH = size / rows;
  const rand = mulberry32(2077);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  ctx.fillStyle = '#9c8f80';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#2a2a2a';
  bctx.fillRect(0, 0, size, size);

  const pad = 3.0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW + pad;
      const y = r * tileH + pad;
      const w = tileW - pad * 2;
      const h = tileH - pad * 2;
      const isAccent = (r + c) % 2 === 0;
      const v = (rand() - 0.5) * 12;

      const R = isAccent ? 222 + v : 200 + v;
      const G = isAccent ? 210 + v : 182 + v;
      const B = isAccent ? 196 + v : 166 + v;

      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      ctx.fill();

      roundRect(bctx, x, y, w, h, 4);
      bctx.fillStyle = '#ececec';
      bctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 2.2);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.2, 2.2);
  bumpMap.anisotropy = 4;

  return { map, bumpMap };
}

/**
 * Miniature warm birch/cedar wood grain texture (512x512)
 * Used for diorama cross-section frames, shelf, and bath stool.
 */
export function createWoodTexture() {
  const size = 512;
  const rand = mulberry32(3311);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#cfa072';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 160; i++) {
    const y = rand() * size;
    const h = 1 + rand() * 5;
    const dark = rand() > 0.45;
    ctx.fillStyle = dark
      ? `rgba(148, 96, 52, ${0.06 + rand() * 0.14})`
      : `rgba(248, 224, 190, ${0.05 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 64) {
      ctx.lineTo(x, y + Math.sin(x * 0.015 + i) * 3.5);
    }
    ctx.lineTo(size, y + h);
    ctx.lineTo(0, y + h);
    ctx.closePath();
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

/**
 * Realistic porous yellow bath sponge texture (512x512 color + bump)
 */
export function createSpongeTextures() {
  const size = 512;
  const rand = mulberry32(9001);

  const cCan = document.createElement('canvas');
  cCan.width = size;
  cCan.height = size;
  const ctx = cCan.getContext('2d');

  const bCan = document.createElement('canvas');
  bCan.width = size;
  bCan.height = size;
  const bctx = bCan.getContext('2d');

  ctx.fillStyle = '#ffd54a';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#d4d4d4';
  bctx.fillRect(0, 0, size, size);

  // Fine sponge grain
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.5 + rand() * 5.2;
    const shade = rand();
    ctx.fillStyle =
      shade < 0.5
        ? `rgba(214, 148, 20, ${0.18 + rand() * 0.3})`
        : `rgba(255, 240, 140, ${0.15 + rand() * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    bctx.fillStyle = shade < 0.5 ? 'rgba(60,60,60,0.55)' : 'rgba(255,255,255,0.4)';
    bctx.beginPath();
    bctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    bctx.fill();
  }

  // Larger honeycomb sponge pores
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 4 + rand() * 11;
    const ry = rx * (0.65 + rand() * 0.5);
    const rot = rand() * Math.PI;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 1, 0, 0, rx);
    g.addColorStop(0, 'rgba(165, 102, 10, 0.72)');
    g.addColorStop(0.7, 'rgba(204, 134, 18, 0.45)');
    g.addColorStop(1, 'rgba(255, 224, 96, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    bctx.save();
    bctx.translate(x, y);
    bctx.rotate(rot);
    bctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
    bctx.beginPath();
    bctx.ellipse(0, 0, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();
  }

  const map = new THREE.CanvasTexture(cCan);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCan);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

/**
 * Plush terrycloth bathmat texture (256x256)
 */
export function createTerryTexture(baseHex = '#f5b8c6') {
  const size = 256;
  const rand = mulberry32(4455);
  const cCan = document.createElement('canvas');
  cCan.width = size;
  cCan.height = size;
  const ctx = cCan.getContext('2d');

  const bCan = document.createElement('canvas');
  bCan.width = size;
  bCan.height = size;
  const bctx = bCan.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#888888';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 2.2;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(180,95,120,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    bctx.fillStyle = rand() > 0.5 ? '#dcdcdc' : '#4a4a4a';
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  // Subtle woven border stripe
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, size - 28, size - 28);

  const map = new THREE.CanvasTexture(cCan);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bCan);
  return { map, bumpMap };
}

/**
 * Dynamic Tub Inner Surface Canvas (512x512)
 * Tracks dirt grid & foam grid directly on a clean planar UV mapping of the bathtub basin!
 * UV (0..1, 0..1) covers the interior bottom + sloped walls of the oval tub.
 */
export class DynamicTubSurface {
  constructor() {
    this.size = 512;
    this.gridW = 24;
    this.gridH = 16;

    this.dirtGrid = new Float32Array(this.gridW * this.gridH);
    this.foamGrid = new Float32Array(this.gridW * this.gridH);
    this.foamHueGrid = new Float32Array(this.gridW * this.gridH); // 0 = white, >0 = pastel pink/rainbow
    this.activeCellMask = new Uint8Array(this.gridW * this.gridH);

    // Precompute oval mask of cells inside the bathtub basin
    this.totalActiveCells = 0;
    for (let gy = 0; gy < this.gridH; gy++) {
      for (let gx = 0; gx < this.gridW; gx++) {
        const nx = ((gx + 0.5) / this.gridW) * 2 - 1;
        const ny = ((gy + 0.5) / this.gridH) * 2 - 1;
        // Superellipse matching the rounded bathtub shape
        const d = Math.pow(Math.abs(nx), 2.8) + Math.pow(Math.abs(ny), 2.4);
        const inside = d <= 0.98 ? 1 : 0;
        this.activeCellMask[gy * this.gridW + gx] = inside;
        if (inside) this.totalActiveCells++;
      }
    }

    this.colorCanvas = document.createElement('canvas');
    this.colorCanvas.width = this.size;
    this.colorCanvas.height = this.size;
    this.ctx = this.colorCanvas.getContext('2d');

    this.roughCanvas = document.createElement('canvas');
    this.roughCanvas.width = 256;
    this.roughCanvas.height = 256;
    this.rctx = this.roughCanvas.getContext('2d');

    // Low-res smooth bilinear mask canvas for buttery-smooth dirt & foam transitions (zero grid scallops!)
    this.dirtMaskCanvas = document.createElement('canvas');
    this.dirtMaskCanvas.width = this.gridW;
    this.dirtMaskCanvas.height = this.gridH;
    this.dmCtx = this.dirtMaskCanvas.getContext('2d');

    this.dirtCompCanvas = document.createElement('canvas');
    this.dirtCompCanvas.width = this.size;
    this.dirtCompCanvas.height = this.size;
    this.dcCtx = this.dirtCompCanvas.getContext('2d');

    this.map = new THREE.CanvasTexture(this.colorCanvas);
    this.map.colorSpace = THREE.SRGBColorSpace;
    this.map.anisotropy = 4;

    this.roughnessMap = new THREE.CanvasTexture(this.roughCanvas);

    // Offscreen procedural grime layer so dirt looks organic and photographic (bath rings, mud splashes, soap scum)
    this.dirtStampCanvas = document.createElement('canvas');
    this.dirtStampCanvas.width = this.size;
    this.dirtStampCanvas.height = this.size;
    this._buildDirtStamp();

    this.dirtyVisual = true;
    this.resetDirty();
  }

  _buildDirtStamp() {
    const ctx = this.dirtStampCanvas.getContext('2d');
    const s = this.size;
    const rand = mulberry32(7733);

    ctx.clearRect(0, 0, s, s);

    // Distinct dusty bath-scum film & unmistakable bath rings (porcelain stays clearly white underneath!)
    const bg = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.08, s * 0.5, s * 0.5, s * 0.52);
    bg.addColorStop(0, 'rgba(148, 122, 92, 0.30)');
    bg.addColorStop(0.55, 'rgba(138, 112, 82, 0.38)');
    bg.addColorStop(0.84, 'rgba(116, 88, 60, 0.70)');
    bg.addColorStop(1, 'rgba(146, 120, 92, 0.18)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);

    // Unmistakable muddy bath-ring waterline smudges around the white porcelain walls
    ctx.save();
    ctx.strokeStyle = 'rgba(112, 82, 54, 0.76)';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.5, s * 0.39, s * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(136, 106, 74, 0.54)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.5, s * 0.29, s * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Distinct organic mud/soap-scum spots on white porcelain so "dirty -> clean" contrast is crystal clear
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * 0.40;
      const x = s * (0.5 + Math.cos(a) * dist);
      const y = s * (0.5 + Math.sin(a) * dist * 0.86);
      const r = 16 + rand() * 32;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      const tone = rand() > 0.45 ? '108, 80, 52' : '132, 106, 78';
      g.addColorStop(0, `rgba(${tone}, ${0.56 + rand() * 0.28})`);
      g.addColorStop(0.65, `rgba(${tone}, ${0.24 + rand() * 0.14})`);
      g.addColorStop(1, `rgba(${tone}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A few cute tiny muddy duck-foot smudges inside the tub (tells a tiny story!)
    const prints = [
      [0.34, 0.46, 0.3],
      [0.44, 0.56, -0.2],
      [0.58, 0.42, 0.45],
      [0.67, 0.54, 0.1],
    ];
    ctx.fillStyle = 'rgba(104, 78, 52, 0.58)';
    for (const [px, py, rot] of prints) {
      ctx.save();
      ctx.translate(px * s, py * s);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.arc(0, 4, 8, 0, Math.PI * 2);
      ctx.arc(-8, -7, 4.5, 0, Math.PI * 2);
      ctx.arc(0, -10, 4.5, 0, Math.PI * 2);
      ctx.arc(8, -7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  resetDirty() {
    for (let i = 0; i < this.dirtGrid.length; i++) {
      this.dirtGrid[i] = this.activeCellMask[i] ? 1.0 : 0.0;
      this.foamGrid[i] = 0.0;
      this.foamHueGrid[i] = 0.0;
    }
    this.dirtyVisual = true;
    this.redraw();
  }

  /**
   * Scrub at normalized tub UV (u, v in 0..1)
   * Returns { cleanedAmount, foamedAmount }
   */
  scrubAt(u, v, radius = 0.145, strength = 0.55, rainbowBoost = 0) {
    let cleanedAmount = 0;
    let foamedAmount = 0;

    for (let gy = 0; gy < this.gridH; gy++) {
      const cy = (gy + 0.5) / this.gridH;
      const dy = cy - v;
      if (Math.abs(dy) > radius) continue;

      for (let gx = 0; gx < this.gridW; gx++) {
        const idx = gy * this.gridW + gx;
        if (!this.activeCellMask[idx]) continue;

        const cx = (gx + 0.5) / this.gridW;
        const dx = cx - u;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;

        const falloff = 1 - dist / radius;
        const delta = falloff * falloff * strength;

        const oldDirt = this.dirtGrid[idx];
        const newDirt = Math.max(0, oldDirt - delta * 1.35);
        cleanedAmount += oldDirt - newDirt;
        this.dirtGrid[idx] = newDirt;

        const oldFoam = this.foamGrid[idx];
        const newFoam = Math.min(1, oldFoam + delta * 1.15);
        foamedAmount += newFoam - oldFoam;
        this.foamGrid[idx] = newFoam;

        if (rainbowBoost > 0) {
          this.foamHueGrid[idx] = Math.min(1, Math.max(this.foamHueGrid[idx], rainbowBoost * falloff));
        }
      }
    }

    if (cleanedAmount > 0.001 || foamedAmount > 0.001) {
      this.dirtyVisual = true;
    }
    return { cleanedAmount, foamedAmount };
  }

  /**
   * Rinse with shower at normalized tub UV (u, v in 0..1)
   * Returns amount rinsed
   */
  rinseAt(u, v, radius = 0.16, strength = 0.6) {
    let rinsed = 0;

    for (let gy = 0; gy < this.gridH; gy++) {
      const cy = (gy + 0.5) / this.gridH;
      const dy = cy - v;
      if (Math.abs(dy) > radius) continue;

      for (let gx = 0; gx < this.gridW; gx++) {
        const idx = gy * this.gridW + gx;
        if (!this.activeCellMask[idx]) continue;

        const cx = (gx + 0.5) / this.gridW;
        const dx = cx - u;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;

        const falloff = 1 - dist / radius;
        const delta = falloff * strength;

        const oldFoam = this.foamGrid[idx];
        const newFoam = Math.max(0, oldFoam - delta * 1.4);
        rinsed += oldFoam - newFoam;
        this.foamGrid[idx] = newFoam;

        // Also wash away any residual dirt specks
        if (this.dirtGrid[idx] > 0) {
          const oldD = this.dirtGrid[idx];
          this.dirtGrid[idx] = Math.max(0, oldD - delta * 1.2);
          rinsed += (oldD - this.dirtGrid[idx]) * 0.5;
        }
      }
    }

    if (rinsed > 0.001) {
      this.dirtyVisual = true;
    }
    return rinsed;
  }

  clearAllRemaining() {
    for (let i = 0; i < this.dirtGrid.length; i++) {
      this.dirtGrid[i] = 0;
      this.foamGrid[i] = 0;
    }
    this.dirtyVisual = true;
    this.redraw();
  }

  getStats() {
    let dirtSum = 0;
    let foamSum = 0;
    let cleanCells = 0;
    for (let i = 0; i < this.dirtGrid.length; i++) {
      if (!this.activeCellMask[i]) continue;
      dirtSum += this.dirtGrid[i];
      foamSum += this.foamGrid[i];
      if (this.dirtGrid[i] < 0.28) cleanCells++;
    }
    const n = Math.max(1, this.totalActiveCells);
    return {
      dirtRatio: dirtSum / n,
      foamRatio: foamSum / n,
      cleanRatio: cleanCells / n,
    };
  }

  redraw() {
    if (!this.dirtyVisual) return;
    this.dirtyVisual = false;

    const ctx = this.ctx;
    const rctx = this.rctx;
    const s = this.size;

    // 1. Pristine gleaming warm-white porcelain base
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, s, s);

    // Subtle porcelain curvature shading inside basin
    const shine = ctx.createRadialGradient(s * 0.48, s * 0.48, s * 0.05, s * 0.5, s * 0.5, s * 0.55);
    shine.addColorStop(0, '#ffffff');
    shine.addColorStop(0.7, '#f8f6f2');
    shine.addColorStop(1, '#ebe6df');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, s, s);

    // 2. Smoothly composite remaining dirt using bilinearly upscaled alpha mask (ZERO wall banding!)
    const dmCtx = this.dmCtx;
    const imgData = dmCtx.createImageData(this.gridW, this.gridH);
    const data = imgData.data;
    for (let i = 0; i < this.dirtGrid.length; i++) {
      const a = Math.min(255, Math.max(0, Math.round(this.dirtGrid[i] * 255)));
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = a;
    }
    dmCtx.putImageData(imgData, 0, 0);

    const dcCtx = this.dcCtx;
    dcCtx.clearRect(0, 0, s, s);
    dcCtx.globalCompositeOperation = 'source-over';
    dcCtx.imageSmoothingEnabled = true;
    dcCtx.drawImage(this.dirtMaskCanvas, 0, 0, s, s);
    dcCtx.globalCompositeOperation = 'source-in';
    dcCtx.drawImage(this.dirtStampCanvas, 0, 0, s, s);
    dcCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.dirtCompCanvas, 0, 0);

    // Smooth roughness map (matte where dirty, ultra-glossy porcelain where clean!)
    rctx.fillStyle = '#202020';
    rctx.fillRect(0, 0, 256, 256);
    rctx.save();
    rctx.globalAlpha = 0.72;
    rctx.imageSmoothingEnabled = true;
    rctx.drawImage(this.dirtMaskCanvas, 0, 0, 256, 256);
    rctx.restore();

    const cellW = s / this.gridW;
    const cellH = s / this.gridH;

    // 3. Paint soft frothy soap foam film on top
    for (let gy = 0; gy < this.gridH; gy++) {
      for (let gx = 0; gx < this.gridW; gx++) {
        const idx = gy * this.gridW + gx;
        const f = this.foamGrid[idx];
        if (f > 0.04) {
          const cx = (gx + 0.5) * cellW;
          const cy = (gy + 0.5) * cellH;
          const rad = Math.max(cellW, cellH) * (0.72 + f * 0.55);
          const hueMix = this.foamHueGrid[idx];

          const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
          if (hueMix > 0.2) {
            g.addColorStop(0, `rgba(255, 240, 248, ${Math.min(0.95, f * 0.95)})`);
            g.addColorStop(0.65, `rgba(240, 232, 255, ${f * 0.65})`);
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
          } else {
            g.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.96, f * 0.96)})`);
            g.addColorStop(0.65, `rgba(232, 246, 255, ${f * 0.65})`);
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
          }
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    this.map.needsUpdate = true;
    this.roughnessMap.needsUpdate = true;
  }
}

/**
 * Steamy bathroom mirror texture (256x256) that clears when sprayed by the shower
 */
export class DynamicMirrorTexture {
  constructor() {
    this.size = 256;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.map = new THREE.CanvasTexture(this.canvas);
    this.map.colorSpace = THREE.SRGBColorSpace;
    this.steamAmount = 1.0;
    this.reset();
  }

  reset() {
    this.steamAmount = 1.0;
    this._draw();
  }

  clearSteam(amount = 0.14) {
    if (this.steamAmount <= 0) return false;
    this.steamAmount = Math.max(0, this.steamAmount - amount);
    this._draw();
    return true;
  }

  _draw() {
    const ctx = this.ctx;
    const s = this.size;

    // Bright bathroom sky/softbox reflection behind mirror glass
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#eef7fa');
    grad.addColorStop(0.45, '#cfe7f0');
    grad.addColorStop(1, '#b9dce8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    // Diagonal glass specular reflection streaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(s * 0.12, 0);
    ctx.lineTo(s * 0.32, 0);
    ctx.lineTo(0, s * 0.36);
    ctx.lineTo(0, s * 0.16);
    ctx.closePath();
    ctx.fill();

    // Cute tiny rubber duck silhouette & sparkle reflection revealed when steam clears!
    ctx.save();
    ctx.globalAlpha = 1 - this.steamAmount * 0.85;
    // Duck head & body reflection
    ctx.fillStyle = '#ffd538';
    ctx.beginPath();
    ctx.arc(s * 0.52, s * 0.62, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.48, s * 0.43, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7e2e';
    ctx.beginPath();
    ctx.ellipse(s * 0.36, s * 0.45, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(s * 0.44, s * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
    // Little sparkles
    ctx.fillStyle = '#ffffff';
    drawStar(ctx, s * 0.72, s * 0.28, 12, 4);
    drawStar(ctx, s * 0.26, s * 0.68, 9, 3);
    ctx.restore();

    // Frosted steam overlay
    if (this.steamAmount > 0.01) {
      ctx.fillStyle = `rgba(244, 249, 252, ${this.steamAmount * 0.82})`;
      ctx.fillRect(0, 0, s, s);

      // Cute finger-drawn heart smudge in the steam
      ctx.strokeStyle = `rgba(200, 224, 236, ${this.steamAmount * 0.55})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(s * 0.44, s * 0.48, 16, Math.PI, 0);
      ctx.arc(s * 0.56, s * 0.48, 16, Math.PI, 0);
      ctx.lineTo(s * 0.5, s * 0.66);
      ctx.closePath();
      ctx.stroke();
    }

    this.map.needsUpdate = true;
  }
}

/**
 * Procedural Studio Softbox Environment Map for miniature photography specular highlights
 */
export function createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#c8c2b8');

  // Overhead warm-daylight photographic softbox
  const topBox = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.35, 2.25), side: THREE.DoubleSide })
  );
  topBox.position.set(0, 9, 1);
  topBox.rotation.x = Math.PI / 2;
  envScene.add(topBox);

  // Left cool daylight window softbox
  const leftBox = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.75, 1.95), side: THREE.DoubleSide })
  );
  leftBox.position.set(-10, 3, 2);
  leftBox.rotation.y = Math.PI / 2;
  envScene.add(leftBox);

  // Right warm studio bounce card
  const rightBox = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.5, 1.3), side: THREE.DoubleSide })
  );
  rightBox.position.set(10, 2, -2);
  rightBox.rotation.y = -Math.PI / 2;
  envScene.add(rightBox);

  // Warm floor bounce
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.64, 0.56), side: THREE.DoubleSide })
  );
  floorBounce.position.set(0, -8, 0);
  floorBounce.rotation.x = -Math.PI / 2;
  envScene.add(floorBounce);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

/**
 * Soft radial sprite texture for sparkles & steam
 */
export function createSparkleTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,250,220,0.85)');
  g.addColorStop(0.6, 'rgba(255,245,200,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  ctx.fillStyle = '#ffffff';
  drawStar(ctx, s / 2, s / 2, s * 0.44, s * 0.11);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSteamTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.62)');
  g.addColorStop(0.5, 'rgba(245,252,255,0.26)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
