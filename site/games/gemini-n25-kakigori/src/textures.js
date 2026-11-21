import * as THREE from '../vendor/three.module.js';

// All procedural textures strictly <= 1024px (256-1024px) for iPhone/iPad performance.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (repeatX > 1 || repeatY > 1) tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Deterministic pseudo-random for crisp repeatable macro textures
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

export function createWoodTextures(seed = 11, baseHex = '#c58f57', darkHex = '#8c5a2b') {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle plank bands
  const planks = 4;
  const ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const shade = (rng() - 0.5) * 16;
    ctx.fillStyle = shade > 0 ? `rgba(255,235,205,${shade / 255})` : `rgba(60,30,10,${-shade / 255})`;
    ctx.fillRect(0, p * ph, w, ph);

    // Fine wood grain fibers
    for (let i = 0; i < 95; i++) {
      const y = p * ph + rng() * ph;
      const amp = 1.5 + rng() * 4.5;
      const freq = 0.008 + rng() * 0.015;
      const phase = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.strokeStyle = rng() > 0.35
        ? `rgba(85, 48, 20, ${0.06 + rng() * 0.12})`
        : `rgba(255, 232, 198, ${0.05 + rng() * 0.09})`;
      ctx.lineWidth = 0.8 + rng() * 2.2;
      for (let x = 0; x <= w; x += 12) {
        const yy = y + Math.sin(x * freq + phase) * amp;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Occasional miniature knot
    if (rng() > 0.45) {
      const kx = 80 + rng() * (w - 160);
      const ky = p * ph + 28 + rng() * (ph - 56);
      for (let r = 18; r > 2; r -= 3.5) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 1.9, r * 0.65, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(70, 38, 15, ${0.08 + (18 - r) * 0.012})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // Plank seam
    ctx.fillStyle = 'rgba(48, 26, 10, 0.35)';
    ctx.fillRect(0, p * ph, w, 2);
    ctx.fillStyle = 'rgba(255, 235, 205, 0.16)';
    ctx.fillRect(0, p * ph + 2, w, 1.5);
  }

  // Subtle macro pores / wear speckles
  for (let i = 0; i < 650; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(65,36,16,0.08)' : 'rgba(255,240,215,0.06)';
    ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 8, 1);
  }

  // Bump map derived from grayscale grain
  const bc = makeCanvas(w, h);
  const bctx = bc.getContext('2d');
  bctx.drawImage(c, 0, 0);
  const img = bctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(d[i] * 0.35 + d[i + 1] * 0.45 + d[i + 2] * 0.2);
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  bctx.putImageData(img, 0, 0);

  return {
    map: finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true }),
    bumpMap: finalizeTexture(bc, { repeatX: 1, repeatY: 1, srgb: false }),
  };
}

export function createBambooCoasterTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s / 2;
  const cy = s / 2;

  ctx.fillStyle = '#d7b278';
  ctx.fillRect(0, 0, s, s);

  // Concentric woven bamboo coils
  for (let r = 8; r < s * 0.49; r += 9) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 18 === 0 ? '#b7894c' : '#e5c68f';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(92,58,24,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Radial woven stitches
  const spokes = 36;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
    ctx.lineTo(cx + Math.cos(a) * (s * 0.48), cy + Math.sin(a) * (s * 0.48));
    ctx.strokeStyle = 'rgba(110, 72, 32, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Red woven edge trim
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.46, 0, Math.PI * 2);
  ctx.strokeStyle = '#c84b44';
  ctx.lineWidth = 14;
  ctx.stroke();

  return finalizeTexture(c, { srgb: true });
}

export function createLinenMatTexture() {
  const w = 512;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f5eedf';
  ctx.fillRect(0, 0, w, h);

  // Classic Japanese summer indigo stripes
  const stripeColors = ['#2d5d8a', '#5386b3', '#2d5d8a'];
  for (let x = 20; x < w; x += 64) {
    ctx.fillStyle = stripeColors[0];
    ctx.fillRect(x, 0, 12, h);
    ctx.fillStyle = stripeColors[1];
    ctx.fillRect(x + 16, 0, 5, h);
    ctx.fillStyle = '#d96b59';
    ctx.fillRect(x + 25, 0, 4, h);
  }

  // Woven linen thread cross-hatch
  ctx.fillStyle = 'rgba(80, 65, 48, 0.07)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);

  return finalizeTexture(c, { srgb: true });
}

// ZERO-TEXT Japanese miniature noren curtain with purely pictorial wave + shaved-ice bowl motif
export function createNorenTexture(variant = 0) {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Deep indigo / sky summer linen
  ctx.fillStyle = variant % 2 === 0 ? '#275987' : '#f4eee1';
  ctx.fillRect(0, 0, w, h);

  // Woven linen texture
  ctx.fillStyle = variant % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(40,65,95,0.045)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1.5, h);

  // Bottom decorative wave scalloped band
  ctx.strokeStyle = variant % 2 === 0 ? '#e9f2f9' : '#2a6294';
  ctx.lineWidth = 6;
  for (let row = 0; row < 2; row++) {
    const yy = 212 + row * 18;
    ctx.beginPath();
    for (let x = -16; x <= w + 32; x += 36) {
      ctx.arc(x, yy, 18, Math.PI, 0, false);
    }
    ctx.stroke();
  }

  // Center circular crest with purely pictorial shaved-ice emblem (ZERO characters!)
  const cx = w / 2;
  const cy = 116;
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = variant % 2 === 0 ? '#f7f3e8' : '#296091';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.strokeStyle = variant % 2 === 0 ? '#c94141' : '#f7f3e8';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (variant % 2 === 0) {
    // Pictorial miniature kakigori silhouette inside circle
    // Fluffy white/pink dome
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 28, Math.PI, 0, false);
    ctx.fillStyle = '#e75567';
    ctx.fill();
    // Snow trim
    ctx.beginPath();
    ctx.arc(cx - 12, cy + 2, 13, Math.PI, 0);
    ctx.arc(cx + 12, cy + 2, 13, Math.PI, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Cherry on top
    ctx.beginPath();
    ctx.arc(cx, cy - 31, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#c81f32';
    ctx.fill();
    // Fluted glass bowl silhouette
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 4);
    ctx.lineTo(cx + 28, cy + 4);
    ctx.lineTo(cx + 16, cy + 24);
    ctx.lineTo(cx - 16, cy + 24);
    ctx.closePath();
    ctx.fillStyle = '#3675a8';
    ctx.fill();
    ctx.fillRect(cx - 14, cy + 27, 28, 5);
  } else {
    // Pictorial radiating summer sun / snowflake crystal motif
    ctx.strokeStyle = '#f7f3e8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
      ctx.stroke();
      const bx = cx + Math.cos(a) * 20;
      const by = cy + Math.sin(a) * 20;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + 0.65) * 10, by + Math.sin(a + 0.65) * 10);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.65) * 10, by + Math.sin(a - 0.65) * 10);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#e65656';
    ctx.fill();
  }

  return finalizeTexture(c, { srgb: true });
}

// Fine sparkling crystalline shaved-ice bump texture
export function createSnowBumpTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(404);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);

  // Layered fluffy clumps
  for (let i = 0; i < 420; i++) {
    const x = rng() * s;
    const y = rng() * s;
    const r = 6 + rng() * 18;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = rng() > 0.4 ? 235 : 55;
    grad.addColorStop(0, `rgba(${v},${v},${v},0.42)`);
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine crisp ice crystal flecks
  for (let i = 0; i < 2400; i++) {
    const v = rng() > 0.45 ? 255 : 40;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.45})`;
    ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 2.5, 1 + rng() * 2.5);
  }

  return finalizeTexture(c, { repeatX: 3, repeatY: 3, srgb: false });
}

// Hammered vintage cast-iron enamel bump for the manual kakigori shaver
export function createCastIronBumpTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(99);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const x = rng() * s;
    const y = rng() * s;
    const r = 2 + rng() * 6;
    const v = 105 + Math.floor(rng() * 50);
    ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(c, { repeatX: 3, repeatY: 3, srgb: false });
}

// ZERO-TEXT miniature paper labels for syrup bottles & condensed milk
export function createSyrupLabelTexture(kind) {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Cream handmade paper background
  ctx.fillStyle = '#faf3e4';
  ctx.fillRect(0, 0, w, h);

  // Paper border stripe
  const borderColors = {
    strawberry: '#d92842',
    lemon: '#eab308',
    blue: '#0284c7',
    milk: '#d94848',
  };
  const col = borderColors[kind] || '#d92842';
  ctx.strokeStyle = col;
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.strokeStyle = 'rgba(120, 95, 65, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  const cx = w / 2;
  const cy = h / 2 + 4;

  if (kind === 'strawberry') {
    // Lush painted strawberry
    ctx.beginPath();
    ctx.moveTo(cx, cy - 42);
    ctx.bezierCurveTo(cx + 58, cy - 42, cx + 48, cy + 32, cx, cy + 58);
    ctx.bezierCurveTo(cx - 48, cy + 32, cx - 58, cy - 42, cx, cy - 42);
    ctx.fillStyle = '#e0243d';
    ctx.fill();
    // Seeds
    ctx.fillStyle = '#fde68a';
    const seeds = [[-20, -10], [0, -14], [20, -10], [-24, 12], [-8, 10], [10, 10], [24, 12], [-12, 32], [8, 32], [0, 44]];
    for (const [sx, sy] of seeds) {
      ctx.beginPath();
      ctx.ellipse(cx + sx, cy + sy, 3.2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Green leafy calyx
    ctx.fillStyle = '#2e8b47';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * 14, cy - 44, 16, 8, i * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'lemon') {
    // Bright painted lemon slice
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#fef9c3';
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + 0.1;
      const a1 = ((i + 1) / 8) * Math.PI * 2 - 0.1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 43, a0, a1);
      ctx.closePath();
      ctx.fillStyle = '#f5b800';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fef9c3';
    ctx.fill();
  } else if (kind === 'blue') {
    // Ocean wave + sunlit starfish (Blue Hawaii!)
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    // Crisp white rolling waves
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let row = 0; row < 2; row++) {
      const wy = cy + 12 + row * 22;
      ctx.beginPath();
      for (let x = cx - 44; x <= cx + 44; x += 22) {
        ctx.arc(x, wy, 11, Math.PI, 0, false);
      }
      ctx.stroke();
    }
    // Cute coral/golden sun star above waves
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 22 : 9;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy - 18 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'milk') {
    // Creamy milk droplet + little flower emblem (no text!)
    ctx.fillStyle = '#fff5f5';
    ctx.fillRect(26, 26, w - 52, h - 52);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 54);
    ctx.bezierCurveTo(cx + 46, cy - 2, cx + 46, cy + 52, cx, cy + 52);
    ctx.bezierCurveTo(cx - 46, cy + 52, cx - 46, cy - 2, cx, cy - 54);
    ctx.fillStyle = '#fff9eb';
    ctx.fill();
    ctx.strokeStyle = '#d94848';
    ctx.lineWidth = 7;
    ctx.stroke();
    // Cute glossy highlight on drop
    ctx.beginPath();
    ctx.ellipse(cx - 14, cy + 10, 7, 15, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  return finalizeTexture(c, { srgb: true });
}

// Strawberry fruit skin texture with realistic recessed pale seeds
export function createStrawberryTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, '#c8192e');
  grad.addColorStop(0.55, '#e5253c');
  grad.addColorStop(1, '#f44755');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const rows = 9;
  const cols = 12;
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * s;
    const offset = (r % 2) * (s / cols / 2);
    for (let k = 0; k < cols; k++) {
      const x = ((k / cols) * s + offset) % s;
      // Dark pit shadow
      ctx.beginPath();
      ctx.ellipse(x, y + 1.5, 4.2, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(110, 8, 22, 0.45)';
      ctx.fill();
      // Golden seed
      ctx.beginPath();
      ctx.ellipse(x, y, 2.6, 4.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f6dc7a';
      ctx.fill();
    }
  }

  return finalizeTexture(c, { srgb: true });
}

// Fresh translucent green kiwi slice texture
export function createKiwiTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s / 2;
  const cy = s / 2;

  ctx.fillStyle = '#6da82a';
  ctx.fillRect(0, 0, s, s);

  const g = ctx.createRadialGradient(cx, cy, 12, cx, cy, 118);
  g.addColorStop(0, '#eef7c8');
  g.addColorStop(0.28, '#e1f2a4');
  g.addColorStop(0.45, '#86c635');
  g.addColorStop(0.88, '#5ca124');
  g.addColorStop(1, '#7c5c33');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 126, 0, Math.PI * 2);
  ctx.fill();

  // Radiating pale fibers
  ctx.strokeStyle = 'rgba(244, 252, 205, 0.45)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    ctx.lineTo(cx + Math.cos(a) * 95, cy + Math.sin(a) * 95);
    ctx.stroke();
  }

  // Tiny black kiwi seeds ring
  ctx.fillStyle = '#1f2318';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 48 + (i % 2) * 14;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return finalizeTexture(c, { srgb: true });
}

// Juicy mandarin orange slice texture
export function createMandarinTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#ff9f1c');
  grad.addColorStop(0.5, '#ff7a00');
  grad.addColorStop(1, '#f36304');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // Juicy citrus pulp cells & fine white pith veins
  ctx.strokeStyle = 'rgba(255, 240, 205, 0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * s;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(s * 0.5, y + 10, s, y - 4);
    ctx.stroke();
  }
  return finalizeTexture(c, { srgb: true });
}

// Warm sun-drenched Japanese summer festival / garden macro bokeh backdrop (<=1024px)
export function createBokehBackdropTexture() {
  const w = 1024;
  const h = 768;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(777);

  // Warm golden-hour sunlit summer foliage gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0.0, '#7ebcd4');
  bg.addColorStop(0.24, '#bedec7');
  bg.addColorStop(0.50, '#7fa866');
  bg.addColorStop(0.76, '#507243');
  bg.addColorStop(1.0, '#3e3528');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Soft out-of-focus miniature garden bamboo & summer wooden shoji/fence silhouettes
  ctx.fillStyle = 'rgba(56, 40, 26, 0.22)';
  for (let x = 40; x < w; x += 110) {
    ctx.fillRect(x, h * 0.42, 22, h * 0.58);
  }
  ctx.fillRect(0, h * 0.56, w, 18);
  ctx.fillRect(0, h * 0.74, w, 18);

  // Lush layered sunlit garden foliage blurs
  const foliageCols = [
    'rgba(62, 118, 52, 0.46)',
    'rgba(116, 168, 78, 0.40)',
    'rgba(248, 218, 138, 0.34)',
    'rgba(220, 152, 92, 0.28)',
    'rgba(170, 218, 160, 0.26)',
  ];
  for (let i = 0; i < 48; i++) {
    const x = rng() * w;
    const y = h * 0.14 + rng() * h * 0.76;
    const r = 55 + rng() * 145;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, foliageCols[i % foliageCols.length]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft diagonal afternoon sunbeams filtering through trees
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const sx = 120 + i * 210;
    const grad = ctx.createLinearGradient(sx, 0, sx + 180, h);
    grad.addColorStop(0, 'rgba(255, 245, 200, 0.14)');
    grad.addColorStop(0.65, 'rgba(255, 232, 175, 0.06)');
    grad.addColorStop(1, 'rgba(255, 232, 175, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + 120, 0);
    ctx.lineTo(sx + 290, h);
    ctx.lineTo(sx + 130, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Creamy photographic lens bokeh orbs (warm summer lanterns + sunlight glints through leaves!)
  const bokehColors = [
    [255, 244, 195],
    [255, 206, 138],
    [255, 152, 128],
    [205, 245, 255],
    [255, 252, 235],
    [245, 226, 150],
  ];
  for (let i = 0; i < 85; i++) {
    const x = rng() * w;
    const y = h * 0.08 + rng() * h * 0.78;
    const r = 14 + rng() * 52;
    const [rr, gg, bb] = bokehColors[Math.floor(rng() * bokehColors.length)];
    const alpha = 0.12 + rng() * 0.28;
    const grad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha * 0.78})`);
    grad.addColorStop(0.76, `rgba(${rr},${gg},${bb},${alpha})`);
    grad.addColorStop(0.92, `rgba(${rr},${gg},${bb},${alpha * 1.18})`);
    grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(c, { srgb: true, anisotropy: 1 });
}

// Yukata fabric pattern texture for miniature doll customers
export function createYukataTexture(primaryHex, accentHex, dotHex) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');

  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, s, s);

  // Subtle cotton weave
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < s; y += 4) ctx.fillRect(0, y, s, 1);

  // Little handcrafted Japanese flower blossoms
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 4; k++) {
      const cx = (k + (r % 2) * 0.5) * 64 + 16;
      const cy = r * 64 + 32;
      ctx.fillStyle = accentHex;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = dotHex;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return finalizeTexture(c, { repeatX: 2, repeatY: 2, srgb: true });
}
