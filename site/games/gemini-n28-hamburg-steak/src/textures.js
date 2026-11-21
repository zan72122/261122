import * as THREE from '../vendor/three.module.js';

// Helper: deterministic pseudo-random so watercolor washes look hand-crafted & repeatable
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

// Helper: paint soft watercolor pigment bloom dab
function watercolorWash(ctx, x, y, rx, ry, color, alpha = 0.25, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const grad = ctx.createRadialGradient(0, 0, Math.min(rx, ry) * 0.08, 0, 0, Math.max(rx, ry));
  grad.addColorStop(0, color);
  grad.addColorStop(0.72, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = alpha;
  ctx.scale(1, ry / rx);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Helper: subtle cold-press watercolor paper grain overlay
function applyPaperGrain(ctx, w, h, alpha = 0.055, seed = 42) {
  const rand = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < 4200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.8 + rand() * 2.2;
    ctx.fillStyle = rand() > 0.5 ? `rgba(148,112,78,${alpha})` : `rgba(255,250,240,${alpha * 1.1})`;
    ctx.fillRect(x, y, r, r);
  }
  ctx.restore();
}

/**
 * 1024x1024 Hand-drawn Anime Movie Watercolor Kitchen Backdrop
 * Sunlit Japanese home kitchen (warm plaster wall, sunlit garden window, wooden shelves, ceramic pots, sunlit glow)
 */
export function createWatercolorKitchenBackdrop() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(1284);

  // 1. Warm sunlit cream-apricot plaster wall base wash (richer Ghibli anime palette)
  const wallGrad = ctx.createLinearGradient(0, 0, size, size);
  wallGrad.addColorStop(0, '#fdf0d5');
  wallGrad.addColorStop(0.45, '#f5d9b2');
  wallGrad.addColorStop(0.82, '#e6be92');
  wallGrad.addColorStop(1, '#d8a678');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, size, size);

  // Soft painterly watercolor blooms on plaster wall
  const wallTints = ['#f2c89b', '#fae2be', '#dfa97c', '#fff0d2', '#d9b592'];
  for (let i = 0; i < 65; i++) {
    watercolorWash(
      ctx,
      rand() * size,
      rand() * size,
      70 + rand() * 160,
      50 + rand() * 130,
      wallTints[i % wallTints.length],
      0.22 + rand() * 0.16,
      rand() * Math.PI
    );
  }

  // Subtle cozy hand-painted kitchen tiles strip along lower wall (below window sill)
  const tileTop = 640;
  const tileBottom = 940;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 246, 232, 0.56)';
  ctx.fillRect(0, tileTop, size, tileBottom - tileTop);
  const tileW = 64;
  const tileH = 54;
  for (let y = tileTop; y < tileBottom; y += tileH) {
    for (let x = 0; x < size; x += tileW) {
      const tint = rand() > 0.5 ? 'rgba(242, 210, 176, 0.42)' : 'rgba(205, 224, 210, 0.34)';
      ctx.fillStyle = tint;
      ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
      ctx.strokeStyle = 'rgba(156, 114, 82, 0.32)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, tileW - 2, tileH - 2);
    }
  }
  ctx.restore();

  // 2. Large Sunlit Kitchen Window (left-center) positioned lower so it frames right behind the counter & girl!
  const wx = 78;
  const wy = 195;
  const ww = 435;
  const wh = 430;

  // Soft shadow around wooden window casing
  watercolorWash(ctx, wx + ww * 0.5, wy + wh * 0.5, ww * 0.65, wh * 0.65, '#b8855c', 0.3);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(wx, wy, ww, wh, 14);
  ctx.clip();

  // Watercolor cerulean-mint summer sky gradient
  const skyGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  skyGrad.addColorStop(0, '#5fb5dc');
  skyGrad.addColorStop(0.55, '#a8ddf0');
  skyGrad.addColorStop(1, '#fff2c2');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(wx, wy, ww, wh);

  // Fluffy hand-painted watercolor summer clouds
  for (let i = 0; i < 14; i++) {
    const cx = wx + 50 + rand() * (ww - 80);
    const cy = wy + 55 + rand() * 145;
    watercolorWash(ctx, cx, cy, 48 + rand() * 44, 30 + rand() * 26, '#fffdf7', 0.78);
  }

  // Sunlit distant hill wash
  watercolorWash(ctx, wx + 220, wy + wh - 65, 270, 130, '#6ba668', 0.7);
  watercolorWash(ctx, wx + 90, wy + wh - 45, 220, 120, '#4f8e59', 0.65);

  // Lush sunlit garden foliage leaves framing the window (vibrant Ghibli emerald & sunlight yellow-green)
  const leafPalette = ['#387a47', '#529850', '#79b85c', '#aed46c', '#2c643b', '#cfe37a'];
  for (let i = 0; i < 110; i++) {
    const edge = rand();
    let lx, ly;
    if (edge < 0.42) {
      lx = wx + rand() * 145;
      ly = wy + rand() * wh;
    } else if (edge < 0.8) {
      lx = wx + rand() * ww;
      ly = wy + wh - 165 + rand() * 175;
    } else {
      lx = wx + ww - 115 + rand() * 125;
      ly = wy + rand() * 220;
    }
    const rx = 18 + rand() * 34;
    const ry = 12 + rand() * 22;
    watercolorWash(ctx, lx, ly, rx, ry, leafPalette[i % leafPalette.length], 0.62 + rand() * 0.3, rand() * Math.PI);
  }

  // Tiny cheerful garden blossoms outside the window
  const flowerColors = ['#fff5d6', '#ff9e98', '#ffd85e'];
  for (let i = 0; i < 22; i++) {
    watercolorWash(
      ctx,
      wx + 35 + rand() * (ww - 70),
      wy + wh - 120 + rand() * 95,
      7 + rand() * 8,
      7 + rand() * 8,
      flowerColors[i % flowerColors.length],
      0.92
    );
  }

  // Warm sunlit glare through window glass
  watercolorWash(ctx, wx + ww * 0.42, wy + wh * 0.35, 180, 180, '#fffce6', 0.28);
  ctx.restore();

  // Hand-painted warm honey-wood window frame & mullions
  ctx.save();
  ctx.strokeStyle = '#8b5a36';
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.strokeRect(wx, wy, ww, wh);

  ctx.strokeStyle = '#bc8354';
  ctx.lineWidth = 10;
  ctx.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);

  // Inner mullions
  ctx.fillStyle = '#a86e42';
  ctx.fillRect(wx + ww * 0.5 - 6, wy, 12, wh);
  ctx.fillRect(wx, wy + wh * 0.52 - 5, ww, 10);

  // Soft white-cream lace curtains tucked softly on both window sides
  ctx.fillStyle = 'rgba(255, 250, 240, 0.78)';
  ctx.beginPath();
  ctx.moveTo(wx - 10, wy - 8);
  ctx.lineTo(wx + 95, wy - 8);
  ctx.quadraticCurveTo(wx + 42, wy + wh * 0.48, wx + 12, wy + wh);
  ctx.lineTo(wx - 10, wy + wh);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(wx + ww + 10, wy - 8);
  ctx.lineTo(wx + ww - 95, wy - 8);
  ctx.quadraticCurveTo(wx + ww - 42, wy + wh * 0.48, wx + ww - 12, wy + wh);
  ctx.lineTo(wx + ww + 10, wy + wh);
  ctx.closePath();
  ctx.fill();

  // Window sill ledge
  ctx.fillStyle = '#b4794a';
  ctx.beginPath();
  ctx.roundRect(wx - 22, wy + wh - 6, ww + 44, 24, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 212, 0.45)';
  ctx.fillRect(wx - 18, wy + wh - 4, ww + 36, 7);

  // Cozy little terracotta potted herb on window sill
  const potX = wx + 84;
  const potY = wy + wh - 6;
  ctx.fillStyle = '#cc6c44';
  ctx.beginPath();
  ctx.moveTo(potX - 24, potY - 40);
  ctx.lineTo(potX + 24, potY - 40);
  ctx.lineTo(potX + 18, potY);
  ctx.lineTo(potX - 18, potY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#df825a';
  ctx.fillRect(potX - 27, potY - 47, 54, 11);
  for (let i = 0; i < 14; i++) {
    watercolorWash(
      ctx,
      potX - 28 + rand() * 56,
      potY - 58 - rand() * 36,
      14 + rand() * 12,
      10 + rand() * 9,
      leafPalette[i % leafPalette.length],
      0.9,
      rand() * Math.PI
    );
  }
  ctx.restore();

  // 3. Cozy Hand-Painted Wooden Kitchen Shelves (right side, aligned with window height!)
  const shelfX = 560;
  const shelfW = 395;
  const shelvesY = [345, 525];

  shelvesY.forEach((sy, sIdx) => {
    // Soft shadow under shelf
    watercolorWash(ctx, shelfX + shelfW * 0.5, sy + 28, shelfW * 0.52, 22, '#b3835a', 0.25);

    // Shelf wooden plank
    ctx.fillStyle = '#b98153';
    ctx.beginPath();
    ctx.roundRect(shelfX, sy, shelfW, 20, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 238, 208, 0.35)';
    ctx.fillRect(shelfX + 6, sy + 2, shelfW - 12, 6);

    // Brackets
    ctx.fillStyle = '#8e5e39';
    ctx.fillRect(shelfX + 38, sy + 18, 12, 34);
    ctx.fillRect(shelfX + shelfW - 50, sy + 18, 12, 34);

    if (sIdx === 0) {
      // Top shelf: Ceramic teapot, stacked bowls, glass honey jar
      // Sky-blue ceramic teapot
      ctx.save();
      ctx.fillStyle = '#89b7c4';
      ctx.beginPath();
      ctx.ellipse(shelfX + 95, sy - 34, 42, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6c98a6';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(shelfX + 136, sy - 34, 18, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#a8ced8';
      ctx.beginPath();
      ctx.ellipse(shelfX + 95, sy - 66, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(shelfX + 95, sy - 76, 8, 0, Math.PI * 2);
      ctx.fill();
      // Cream highlight
      watercolorWash(ctx, shelfX + 82, sy - 44, 16, 12, '#ffffff', 0.45);

      // Stacked cozy cream plates/bowls
      const bowlCols = ['#f4d5a6', '#e9a98e', '#f8ebd6'];
      bowlCols.forEach((col, bi) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(shelfX + 190, sy - 20 - bi * 18, 86, 17, 7);
        ctx.fill();
      });

      // Warm amber honey jar
      ctx.fillStyle = '#e8a84a';
      ctx.beginPath();
      ctx.roundRect(shelfX + 305, sy - 68, 52, 68, 16);
      ctx.fill();
      ctx.fillStyle = '#f8d284';
      ctx.fillRect(shelfX + 314, sy - 58, 12, 46);
      ctx.fillStyle = '#e06c59';
      ctx.beginPath();
      ctx.roundRect(shelfX + 302, sy - 78, 58, 16, 6);
      ctx.fill();
      ctx.restore();
    } else {
      // Lower shelf: Spice jars + Hanging copper pan + wooden spoon jar
      const jarCols = ['#d98162', '#8db382', '#e8c468'];
      jarCols.forEach((col, ji) => {
        const jx = shelfX + 42 + ji * 68;
        ctx.fillStyle = 'rgba(255,250,242,0.85)';
        ctx.beginPath();
        ctx.roundRect(jx, sy - 58, 44, 58, 10);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(jx + 5, sy - 38, 34, 33, 6);
        ctx.fill();
        ctx.fillStyle = '#b98153';
        ctx.beginPath();
        ctx.roundRect(jx + 4, sy - 66, 36, 11, 4);
        ctx.fill();
      });

      // Ceramic utensil crock with wooden spoons
      const ux = shelfX + 275;
      ctx.strokeStyle = '#c48d5a';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ux + 16, sy - 50);
      ctx.lineTo(ux + 4, sy - 112);
      ctx.moveTo(ux + 38, sy - 50);
      ctx.lineTo(ux + 54, sy - 108);
      ctx.stroke();
      ctx.fillStyle = '#c99361';
      ctx.beginPath();
      ctx.ellipse(ux + 3, sy - 118, 13, 19, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f3e5cf';
      ctx.beginPath();
      ctx.roundRect(ux, sy - 68, 60, 68, 12);
      ctx.fill();
      ctx.strokeStyle = '#cf9e76';
      ctx.lineWidth = 3;
      ctx.strokeRect(ux + 2, sy - 50, 56, 10);

      // Hanging shiny warm copper pan below shelf
      const panX = shelfX + 125;
      const panY = sy + 95;
      ctx.strokeStyle = '#8b5b3c';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(panX, sy + 18);
      ctx.lineTo(panX, panY - 40);
      ctx.stroke();
      ctx.fillStyle = '#cc7a4b';
      ctx.beginPath();
      ctx.arc(panX, panY, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e09968';
      ctx.beginPath();
      ctx.arc(panX - 6, panY - 6, 32, 0, Math.PI * 2);
      ctx.fill();
      watercolorWash(ctx, panX - 14, panY - 14, 16, 12, '#fff5de', 0.55);
    }
  });

  // 4. Diagonal Golden Afternoon Sunlight Wash (classic Ghibli atmosphere!)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const sunGrad = ctx.createLinearGradient(120, 80, 760, 760);
  sunGrad.addColorStop(0, 'rgba(255, 247, 210, 0.36)');
  sunGrad.addColorStop(0.55, 'rgba(255, 234, 185, 0.14)');
  sunGrad.addColorStop(1, 'rgba(255, 224, 170, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.moveTo(85, 85);
  ctx.lineTo(520, 85);
  ctx.lineTo(960, 780);
  ctx.lineTo(320, 840);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Warm paper grain across entire backdrop
  applyPaperGrain(ctx, size, size, 0.05, 991);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 512x512 Warm Hand-Painted Watercolor Honey-Oak Countertop
 */
export function createWoodCounterTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(303);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#e9be8d');
  grad.addColorStop(0.5, '#dfa974');
  grad.addColorStop(1, '#cf945d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft watercolor washes
  for (let i = 0; i < 28; i++) {
    watercolorWash(
      ctx,
      rand() * size,
      rand() * size,
      90 + rand() * 140,
      20 + rand() * 35,
      i % 2 === 0 ? '#f4cfa0' : '#be7f4a',
      0.18
    );
  }

  // Hand-painted soft wood grain planks & wavy fibers
  for (let p = 0; p < 4; p++) {
    const py = (p / 4) * size;
    ctx.strokeStyle = 'rgba(136, 84, 45, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(size, py);
    ctx.stroke();
  }

  for (let i = 0; i < 85; i++) {
    const y = rand() * size;
    ctx.strokeStyle = rand() > 0.45 ? 'rgba(145, 90, 48, 0.14)' : 'rgba(255, 234, 200, 0.16)';
    ctx.lineWidth = 1.2 + rand() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 32; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.015 + i) * 3.5);
    }
    ctx.stroke();
  }

  applyPaperGrain(ctx, size, size, 0.04, 304);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 1.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 256x256 Soft Watercolor Glazed Ceramic Texture
 */
export function createCeramicTexture(variant = 'bowl') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(variant === 'bowl' ? 501 : variant === 'plate' ? 502 : 503);

  if (variant === 'bowl') {
    ctx.fillStyle = '#fbf1e2';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 20; i++) {
      watercolorWash(ctx, rand() * size, rand() * size, 45 + rand() * 55, 35 + rand() * 45, '#f2dcc0', 0.25);
    }
    // Delicate hand-painted stoneware speckles
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(148, 102, 70, ${0.15 + rand() * 0.28})`;
      const r = 0.8 + rand() * 1.6;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warm terracotta hand-brushed rim band
    ctx.fillStyle = 'rgba(202, 120, 82, 0.65)';
    ctx.fillRect(0, 0, size, 16);
  } else if (variant === 'plate') {
    // Cozy warm cream plate with painted soft sky-blue watercolor border & tiny blossoms
    ctx.fillStyle = '#fffaf2';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 16; i++) {
      watercolorWash(ctx, rand() * size, rand() * size, 50, 50, '#f4ebd9', 0.22);
    }
    // Soft sky-blue outer watercolor band (near rim)
    ctx.strokeStyle = 'rgba(118, 169, 198, 0.58)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(229, 152, 118, 0.42)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.37, 0, Math.PI * 2);
    ctx.stroke();

    // Cute tiny painted floral dots along the rim
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const fx = size / 2 + Math.cos(a) * size * 0.43;
      const fy = size / 2 + Math.sin(a) * size * 0.43;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 250, 240, 0.85)' : 'rgba(244, 190, 146, 0.8)';
      ctx.beginPath();
      ctx.arc(fx, fy, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Warm butter-cream ceramic sauce boat
    ctx.fillStyle = '#f9ebd2';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 18; i++) {
      watercolorWash(ctx, rand() * size, rand() * size, 45, 45, '#e8c499', 0.22);
    }
  }

  applyPaperGrain(ctx, size, size, 0.03, 510);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 256x256 Soft Warm Anime Skin Texture (for large hands & character)
 */
export function createSkinTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#ffe4cf');
  grad.addColorStop(0.65, '#fdd4b8');
  grad.addColorStop(1, '#f8bea3');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  watercolorWash(ctx, size * 0.5, size * 0.82, 110, 60, '#f49c8c', 0.25);
  applyPaperGrain(ctx, size, size, 0.025, 610);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 512x512 Dynamic Hamburg Meat CanvasTexture
 * Smoothly blends raw ground meat + diced onions + breadcrumbs + egg -> kneaded smooth pink meat
 * AND independently browns the TOP half (v: 0..0.5 in canvas y) and BOTTOM half (v: 0.5..1 in canvas y)
 * so flipping reveals the sizzling caramelized sear crust!
 */
export class DynamicMeatTexture {
  constructor() {
    this.size = 512;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');

    // Pre-generate organic speckles & sear blotches once for deterministic crisp updates
    const rand = mulberry32(777);
    this.meatGrains = [];
    for (let i = 0; i < 620; i++) {
      this.meatGrains.push({
        x: rand() * this.size,
        y: rand() * this.size,
        r: 4 + rand() * 11,
        type: rand() < 0.28 ? 'fat' : rand() < 0.55 ? 'deep' : 'mid',
        rot: rand() * Math.PI,
      });
    }
    this.onionBits = [];
    for (let i = 0; i < 85; i++) {
      this.onionBits.push({
        x: rand() * this.size,
        y: rand() * this.size,
        w: 6 + rand() * 10,
        h: 4 + rand() * 8,
        rot: rand() * Math.PI,
      });
    }
    this.searSpots = [];
    for (let i = 0; i < 120; i++) {
      this.searSpots.push({
        x: rand() * this.size,
        y: rand() * this.size,
        rx: 14 + rand() * 34,
        ry: 10 + rand() * 24,
        rot: rand() * Math.PI,
        dark: rand() > 0.55,
      });
    }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.lastKey = '';
    this.update(0, 0, 0, 0);
  }

  // knead: 0..1, topBrown: 0..1, bottomBrown: 0..1, butterGlaze: 0..1
  update(knead = 0, topBrown = 0, bottomBrown = 0, butterGlaze = 0) {
    const k = Math.round(knead * 24);
    const tb = Math.round(topBrown * 28);
    const bb = Math.round(bottomBrown * 28);
    const bg = Math.round(butterGlaze * 10);
    const key = `${k}_${tb}_${bb}_${bg}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const ctx = this.ctx;
    const s = this.size;

    // 1. Base raw ground meat gradient (slightly richer rosy-warm as egg & meat knead together)
    const rawR = Math.round(218 - knead * 16);
    const rawG = Math.round(120 - knead * 14);
    const rawB = Math.round(108 - knead * 16);
    ctx.fillStyle = `rgb(${rawR},${rawG},${rawB})`;
    ctx.fillRect(0, 0, s, s);

    // Organic ground meat texture grains
    for (const g of this.meatGrains) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      if (g.type === 'fat') {
        // Fat flecks soften slightly as kneaded
        ctx.fillStyle = `rgba(248, 224, 210, ${0.42 - knead * 0.14})`;
      } else if (g.type === 'deep') {
        ctx.fillStyle = `rgba(170, 72, 66, ${0.35 - knead * 0.08})`;
      } else {
        ctx.fillStyle = `rgba(216, 108, 92, 0.28)`;
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, g.r, g.r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Diced golden-translucent onions & breadcrumb specks (very visible when raw, softly blended when kneaded)
    const bitAlpha = 0.65 - knead * 0.35;
    for (const b of this.onionBits) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = `rgba(248, 232, 185, ${bitAlpha})`;
      ctx.beginPath();
      ctx.roundRect(-b.w * 0.5, -b.h * 0.5, b.w, b.h, 3);
      ctx.fill();
      ctx.restore();
    }

    // 2. Apply independent TOP hemisphere (y: 0 .. s/2) and BOTTOM hemisphere (y: s/2 .. s) cooking sear!
    // Note: on SphereGeometry, UV v=1 is top pole (canvas y=0), v=0 is bottom pole (canvas y=s).
    const paintHemisphereCook = (amount, isTop) => {
      if (amount <= 0.01) return;
      ctx.save();
      // Soft feather gradient so top & bottom blend warmly around the equator rim
      const yStart = isTop ? 0 : s * 0.42;
      const yEnd = isTop ? s * 0.58 : s;
      const grad = ctx.createLinearGradient(0, yStart, 0, yEnd);
      const midColor = `rgba(148, 76, 42, ${amount * 0.92})`;
      const edgeColor = `rgba(148, 76, 42, 0)`;
      if (isTop) {
        grad.addColorStop(0, midColor);
        grad.addColorStop(0.75, midColor);
        grad.addColorStop(1, edgeColor);
      } else {
        grad.addColorStop(0, edgeColor);
        grad.addColorStop(0.25, midColor);
        grad.addColorStop(1, midColor);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, yStart, s, yEnd - yStart);

      // Rich appetizing caramelized Maillard crust blotches!
      const clipTop = isTop ? 0 : s * 0.46;
      const clipH = isTop ? s * 0.54 : s * 0.54;
      ctx.beginPath();
      ctx.rect(0, clipTop, s, clipH);
      ctx.clip();

      for (const sp of this.searSpots) {
        if ((isTop && sp.y < s * 0.54) || (!isTop && sp.y > s * 0.46)) {
          const col = sp.dark ? '#5b2814' : '#8b431e';
          watercolorWash(ctx, sp.x, sp.y, sp.rx, sp.ry, col, amount * (sp.dark ? 0.55 : 0.42), sp.rot);
        }
      }

      // Warm golden butter glaze sheen when butter was melted in pan!
      if (butterGlaze > 0.05) {
        watercolorWash(
          ctx,
          s * 0.5,
          isTop ? s * 0.22 : s * 0.78,
          s * 0.48,
          s * 0.22,
          '#e39e38',
          butterGlaze * amount * 0.28
        );
      }
      ctx.restore();
    };

    paintHemisphereCook(topBrown, true);
    paintHemisphereCook(bottomBrown, false);

    // Subtle juicy side-rim cooking warmth whenever either side cooks
    const sideCook = Math.min(1, (topBrown + bottomBrown) * 0.65);
    if (sideCook > 0.05) {
      const bandGrad = ctx.createLinearGradient(0, s * 0.36, 0, s * 0.64);
      bandGrad.addColorStop(0, 'rgba(138, 72, 42, 0)');
      bandGrad.addColorStop(0.5, `rgba(138, 72, 42, ${sideCook * 0.72})`);
      bandGrad.addColorStop(1, 'rgba(138, 72, 42, 0)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, s * 0.36, s, s * 0.28);
    }

    this.texture.needsUpdate = true;
  }
}

/**
 * 512x512 Dynamic Hand-Drawn Anime Movie Girl Face CanvasTexture
 * Expressive eyes, blinking, eye look-target, cheeks, eyebrows, and mouth!
 */
export class DynamicGirlFace {
  constructor() {
    this.size = 512;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.expression = 'curious'; // curious | excited | amazed | anticipating | chewing | bliss
    this.lookX = 0;
    this.lookY = -0.15;
    this.blink = 0; // 0 = open, 1 = closed
    this.chewPhase = 0;
    this.dirty = true;
    this.render();
  }

  setState({ expression, lookX, lookY, blink, chewPhase }) {
    let changed = false;
    if (expression !== undefined && expression !== this.expression) {
      this.expression = expression;
      changed = true;
    }
    if (lookX !== undefined && Math.abs(lookX - this.lookX) > 0.03) {
      this.lookX = lookX;
      changed = true;
    }
    if (lookY !== undefined && Math.abs(lookY - this.lookY) > 0.03) {
      this.lookY = lookY;
      changed = true;
    }
    if (blink !== undefined && Math.abs(blink - this.blink) > 0.04) {
      this.blink = blink;
      changed = true;
    }
    if (chewPhase !== undefined && Math.abs(chewPhase - this.chewPhase) > 0.08) {
      this.chewPhase = chewPhase;
      changed = true;
    }
    if (changed) this.render();
  }

  render() {
    const ctx = this.ctx;
    const s = this.size;
    const cx = s * 0.5;
    const cy = s * 0.52;

    // 1. Warm soft anime skin backdrop
    const skinGrad = ctx.createRadialGradient(cx, cy - 30, 30, cx, cy, s * 0.55);
    skinGrad.addColorStop(0, '#ffebd9');
    skinGrad.addColorStop(0.7, '#fdd7be');
    skinGrad.addColorStop(1, '#f4bfa0');
    ctx.fillStyle = skinGrad;
    ctx.fillRect(0, 0, s, s);

    // 2. Soft watercolor rosy cheeks (brighter & fuller when chewing or bliss!)
    const blushBoost = this.expression === 'bliss' || this.expression === 'chewing' ? 0.56 : 0.34;
    const chewPuff = this.expression === 'chewing' ? Math.sin(this.chewPhase) * 8 : 0;
    watercolorWash(ctx, cx - 86 - chewPuff * 0.4, cy + 36, 48, 30, '#ff867c', blushBoost);
    watercolorWash(ctx, cx + 86 + chewPuff * 0.4, cy + 36, 48, 30, '#ff867c', blushBoost);

    // Cute subtle anime diagonal blush strokes when super happy
    if (this.expression === 'bliss' || this.expression === 'excited' || this.expression === 'chewing') {
      ctx.save();
      ctx.strokeStyle = 'rgba(235, 102, 96, 0.48)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      [-88, 88].forEach((ox) => {
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + ox + i * 11 - 4, cy + 40);
          ctx.lineTo(cx + ox + i * 11 + 4, cy + 28);
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    // 3. Expressive Anime Eyes (slightly larger & warmer Studio Ghibli film proportions!)
    const eyeY = cy - 8;
    const eyeSpan = 74;
    const drawEye = (side) => {
      const ex = cx + side * eyeSpan;
      ctx.save();
      ctx.translate(ex, eyeY);

      if (this.expression === 'bliss' || (this.expression === 'chewing' && Math.sin(this.chewPhase * 0.5) > 0.2)) {
        // Joyful smiling crescent eyes (^ ^)
        ctx.strokeStyle = '#4e2f24';
        ctx.lineWidth = 9.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 12, 33, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        // Cute tiny outer eyelash flick
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(side * 30, 2);
        ctx.lineTo(side * 39, -5);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (this.blink > 0.72) {
        // Soft closed blinking eye
        ctx.strokeStyle = '#4e2f24';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -6, 30, Math.PI * 0.14, Math.PI * 0.86);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const openness = (1 - this.blink * 0.85) * (this.expression === 'amazed' ? 1.12 : 1.0);
      const rx = 33;
      const ry = 37 * openness;

      // Soft white sclera
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Clip iris inside sclera
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx - 1, ry - 1, 0, 0, Math.PI * 2);
      ctx.clip();

      const ix = this.lookX * 10;
      const iy = this.lookY * 10;

      // Warm chestnut-amber iris gradient (Studio Ghibli warmth!)
      const irisR = this.expression === 'amazed' ? 28 : 26;
      const irisGrad = ctx.createRadialGradient(ix, iy - 4, 5, ix, iy + 7, irisR + 4);
      irisGrad.addColorStop(0, '#442519');
      irisGrad.addColorStop(0.55, '#6e3c25');
      irisGrad.addColorStop(0.85, '#b66c3a');
      irisGrad.addColorStop(1, '#e6a255');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(ix, iy, irisR, irisR * 1.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep warm pupil
      ctx.fillStyle = '#2d160e';
      ctx.beginPath();
      ctx.ellipse(ix, iy - 1, irisR * 0.48, irisR * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warm golden lower crescent reflection
      ctx.fillStyle = 'rgba(255, 214, 132, 0.58)';
      ctx.beginPath();
      ctx.ellipse(ix, iy + 15, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp anime catchlights!
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ix - 9, iy - 11, 10, 11, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ix + 9, iy + 11, 4.8, 0, Math.PI * 2);
      ctx.fill();

      // Extra twinkling 4-point star sparkle when amazed or excited!
      if (this.expression === 'amazed' || this.expression === 'excited' || this.expression === 'anticipating') {
        ctx.fillStyle = '#fff9d6';
        ctx.beginPath();
        const sx = ix + 8;
        const sy = iy - 9;
        const sr = this.expression === 'amazed' ? 11 : 8;
        ctx.moveTo(sx, sy - sr);
        ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy + sr);
        ctx.quadraticCurveTo(sx, sy, sx - sr, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy - sr);
        ctx.fill();
      }
      ctx.restore();

      // Expressive upper eyelid & soft eyelashes
      ctx.strokeStyle = '#3f241b';
      ctx.lineWidth = 8.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + 1, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      // Cute outer lash flick
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(side * (rx - 2), -ry * 0.35);
      ctx.lineTo(side * (rx + 9), -ry * 0.55);
      ctx.stroke();

      // Delicate lower lash hint
      ctx.strokeStyle = 'rgba(90, 54, 40, 0.35)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(0, 2, rx * 0.72, ry * 0.92, 0, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();

      ctx.restore();
    };

    drawEye(-1);
    drawEye(1);

    // 4. Soft Expressive Eyebrows
    const browLift =
      this.expression === 'amazed' ? -14 :
      this.expression === 'excited' || this.expression === 'anticipating' ? -8 :
      this.expression === 'bliss' ? -5 : 0;
    ctx.strokeStyle = '#5e3725';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const bx = cx + side * eyeSpan;
      const by = eyeY - 46 + browLift;
      ctx.beginPath();
      ctx.moveTo(bx - side * 20, by + 3);
      ctx.quadraticCurveTo(bx, by - 8, bx + side * 22, by + 2);
      ctx.stroke();
    });

    // 5. Cute tiny hand-drawn anime nose
    ctx.fillStyle = 'rgba(186, 114, 88, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 22, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Expressive Mouth!
    const my = cy + 58;
    ctx.save();
    ctx.translate(cx, my);

    if (this.expression === 'anticipating') {
      // Wide eager "Aaah!" mouth ready for a juicy forkful!
      ctx.fillStyle = '#c85058';
      ctx.beginPath();
      ctx.ellipse(0, 6, 26, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f28c88';
      ctx.beginPath();
      ctx.ellipse(0, 17, 17, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6c322b';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(0, 6, 26, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.expression === 'amazed') {
      // Cute surprised "O!" gasp mouth!
      ctx.fillStyle = '#d45a62';
      ctx.beginPath();
      ctx.ellipse(0, 4, 15, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f49590';
      ctx.beginPath();
      ctx.ellipse(0, 12, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6c322b';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (this.expression === 'excited' || this.expression === 'bliss') {
      // Big joyful open 'D' smile!
      ctx.fillStyle = '#d1565e';
      ctx.beginPath();
      ctx.moveTo(-26, -4);
      ctx.quadraticCurveTo(0, -1, 26, -4);
      ctx.quadraticCurveTo(22, 26, 0, 26);
      ctx.quadraticCurveTo(-22, 26, -26, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f69690';
      ctx.beginPath();
      ctx.ellipse(0, 16, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6c322b';
      ctx.lineWidth = 4.5;
      ctx.stroke();
    } else if (this.expression === 'chewing') {
      // Cute munching wavy happy smile moving with chewPhase!
      const wobble = Math.sin(this.chewPhase) * 4;
      ctx.strokeStyle = '#6c322b';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-18, 2 + wobble * 0.4);
      ctx.quadraticCurveTo(-8, 12 - wobble, 0, 4 + wobble * 0.4);
      ctx.quadraticCurveTo(8, 12 + wobble, 18, 2 - wobble * 0.4);
      ctx.stroke();
    } else {
      // Curious happy little smile
      ctx.strokeStyle = '#6c322b';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -4, 18, Math.PI * 0.16, Math.PI * 0.84);
      ctx.stroke();
    }
    ctx.restore();

    this.texture.needsUpdate = true;
  }
}

/**
 * 128x128 Soft Watercolor Particle Sprite Textures
 */
export function createParticleTextures() {
  const makeSprite = (drawFn) => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    drawFn(ctx, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // Soft watercolor steam puff
  const steam = makeSprite((ctx, s) => {
    watercolorWash(ctx, s * 0.5, s * 0.5, 52, 46, '#fffdf7', 0.65);
    watercolorWash(ctx, s * 0.36, s * 0.52, 34, 30, '#fff9eb', 0.45);
    watercolorWash(ctx, s * 0.64, s * 0.46, 32, 28, '#ffffff', 0.45);
  });

  // Cute air puff cloud (pat-pat air release!)
  const airPuff = makeSprite((ctx, s) => {
    watercolorWash(ctx, s * 0.5, s * 0.5, 42, 42, '#ffffff', 0.72);
    ctx.strokeStyle = 'rgba(218, 232, 240, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, 36, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Golden oil / juicy meat-juice droplet sparkle
  const sparkle = makeSprite((ctx, s) => {
    const cx = s * 0.5;
    watercolorWash(ctx, cx, cx, 46, 46, '#ffd466', 0.55);
    ctx.fillStyle = '#fff9d6';
    ctx.beginPath();
    ctx.moveTo(cx, cx - 36);
    ctx.quadraticCurveTo(cx, cx, cx + 36, cx);
    ctx.quadraticCurveTo(cx, cx, cx, cx + 36);
    ctx.quadraticCurveTo(cx, cx, cx - 36, cx);
    ctx.quadraticCurveTo(cx, cx, cx, cx - 36);
    ctx.fill();
  });

  // Juicy golden-amber droplet (肉汁!)
  const juice = makeSprite((ctx, s) => {
    const cx = s * 0.5;
    const grad = ctx.createRadialGradient(cx - 8, cx - 10, 4, cx, cx, 42);
    grad.addColorStop(0, '#fff7cf');
    grad.addColorStop(0.45, '#ffbe4f');
    grad.addColorStop(1, 'rgba(220, 128, 36, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cx, 42, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft watercolor blossom petal (happy feast celebration!)
  const petal = makeSprite((ctx, s) => {
    const cx = s * 0.5;
    ctx.save();
    ctx.translate(cx, cx);
    ctx.fillStyle = '#ffb9b9';
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.bezierCurveTo(28, -28, 30, 18, 0, 34);
    ctx.bezierCurveTo(-30, 18, -28, -28, 0, -34);
    ctx.fill();
    watercolorWash(ctx, -4, -6, 18, 18, '#fff2ef', 0.55);
    ctx.restore();
  });

  return { steam, airPuff, sparkle, juice, petal };
}
