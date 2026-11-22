import * as THREE from '../vendor/three.module.js';

// All procedural CanvasTextures are strictly <= 512x512 (well under the 1024px ceiling).

export function createWoodCounterTexture() {
  const w = 512, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Base warm honey-apricot wood wash
  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  baseGrad.addColorStop(0, '#efc590');
  baseGrad.addColorStop(0.5, '#e3b278');
  baseGrad.addColorStop(1, '#d79f65');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft watercolor washes
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 50 + Math.random() * 110;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    const warm = i % 2 === 0 ? 'rgba(255, 232, 194, 0.18)' : 'rgba(196, 132, 74, 0.12)';
    g.addColorStop(0, warm);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hand-painted horizontal wood grain & soft plank lines
  ctx.lineCap = 'round';
  for (let y = 8; y < h; y += 7) {
    ctx.strokeStyle = `rgba(155, 96, 48, ${0.05 + Math.random() * 0.07})`;
    ctx.lineWidth = 1.2 + Math.random() * 2.2;
    ctx.beginPath();
    let py = y;
    ctx.moveTo(0, py);
    for (let x = 0; x <= w; x += 32) {
      py = y + Math.sin(x * 0.02 + y * 0.05) * 3.5;
      ctx.lineTo(x, py);
    }
    ctx.stroke();
  }

  // Plank seams
  [128, 264, 396].forEach((sy) => {
    ctx.strokeStyle = 'rgba(128, 76, 36, 0.22)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy + 1.5);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.2);
  return tex;
}

export function createGinghamTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff8ee';
  ctx.fillRect(0, 0, s, s);

  const cell = 32;
  ctx.fillStyle = 'rgba(238, 118, 104, 0.34)';
  for (let y = 0; y < s; y += cell * 2) {
    ctx.fillRect(0, y, s, cell);
  }
  for (let x = 0; x < s; x += cell * 2) {
    ctx.fillRect(x, 0, cell, s);
  }

  // Subtle weave & hand-painted edge softness
  ctx.strokeStyle = 'rgba(205, 82, 70, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < s; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, s);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createKerchiefTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, '#e9564b');
  g.addColorStop(1, '#d6413a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Cream watercolor polka dots
  ctx.fillStyle = 'rgba(255, 247, 232, 0.92)';
  const step = 42;
  for (let y = 18; y < s; y += step) {
    const offset = ((y / step) | 0) % 2 === 0 ? 0 : step * 0.5;
    for (let x = 18; x < s; x += step) {
      ctx.beginPath();
      ctx.arc((x + offset) % s, y, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dynamic minced-meat -> cohesive rose patty -> caramelized golden-mahogany seared crust
export class MeatTexturePainter {
  constructor() {
    this.size = 256;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');

    // Pre-generate deterministic organic marbling flecks so redraws never flicker
    this.flecks = [];
    for (let i = 0; i < 240; i++) {
      this.flecks.push({
        x: Math.random() * this.size,
        y: Math.random() * this.size,
        rx: 3 + Math.random() * 8,
        ry: 2 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        kind: i % 5 === 0 ? 'onion' : (i % 3 === 0 ? 'fat' : 'lean')
      });
    }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.lastKey = '';
    this.update(0, 0, 0);
  }

  update(knead = 0, searBottom = 0, searTop = 0) {
    const key = `${(knead * 40) | 0}_${(searBottom * 40) | 0}_${(searTop * 40) | 0}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const s = this.size;
    const ctx = this.ctx;

    // Base raw rose-red -> kneaded silky salmon-pink -> cooked warm brownish-rose interior
    const cookAvg = Math.min(1, (searBottom + searTop) * 0.55);
    const rBase = Math.round(224 + knead * 10 - cookAvg * 58);
    const gBase = Math.round(112 + knead * 26 - cookAvg * 28);
    const bBase = Math.round(108 + knead * 22 - cookAvg * 36);
    ctx.fillStyle = `rgb(${rBase},${gBase},${bBase})`;
    ctx.fillRect(0, 0, s, s);

    // Draw minced strands & fat/onion flecks (softening as kneaded)
    const rawContrast = 1 - knead * 0.62;
    for (let i = 0; i < this.flecks.length; i++) {
      const f = this.flecks[i];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot + knead * 1.4);
      if (f.kind === 'fat') {
        ctx.fillStyle = `rgba(255, 232, 222, ${0.55 * rawContrast + 0.12})`;
      } else if (f.kind === 'onion') {
        ctx.fillStyle = `rgba(255, 250, 235, ${0.65 * rawContrast + 0.14})`;
      } else {
        ctx.fillStyle = `rgba(186, 68, 66, ${0.52 * rawContrast + 0.14})`;
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, f.rx * (1 - knead * 0.25), f.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sphere UV mapping: y=0 in canvas corresponds to UV.y=1 (top pole +Y),
    // y=s corresponds to UV.y=0 (bottom pole -Y).
    if (searTop > 0.01) {
      this._paintSearZone(ctx, 0, s * 0.56, searTop, true);
    }
    if (searBottom > 0.01) {
      this._paintSearZone(ctx, s * 0.44, s, searBottom, false);
    }

    this.texture.needsUpdate = true;
  }

  _paintSearZone(ctx, yStart, yEnd, amount, isTop) {
    const s = this.size;
    const grad = ctx.createLinearGradient(0, yStart, 0, yEnd);
    const midWarm = `rgba(188, 96, 40, ${Math.min(0.94, amount * 0.92)})`;
    const deepCrust = amount < 0.45
      ? `rgba(196, 108, 48, ${amount * 1.6})`
      : `rgba(116, 48, 20, ${Math.min(0.97, 0.68 + amount * 0.30)})`;

    if (isTop) {
      grad.addColorStop(0.0, deepCrust);
      grad.addColorStop(0.65, midWarm);
      grad.addColorStop(1.0, 'rgba(188, 96, 40, 0)');
    } else {
      grad.addColorStop(0.0, 'rgba(188, 96, 40, 0)');
      grad.addColorStop(0.35, midWarm);
      grad.addColorStop(1.0, deepCrust);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, yStart, s, yEnd - yStart);

    // Soft hand-painted watercolor Maillard roast clouds & subtle grill sear bands (no hard dots!)
    if (amount > 0.30) {
      const searAlpha = Math.min(0.55, (amount - 0.30) * 0.85);
      for (let i = 0; i < 18; i++) {
        const fx = this.flecks[i * 5].x;
        const fy = isTop
          ? (this.flecks[i * 5].y * 0.44)
          : (s - this.flecks[i * 5].y * 0.44);
        const r = 18 + (i % 4) * 9;
        const rg = ctx.createRadialGradient(fx, fy, 2, fx, fy, r);
        rg.addColorStop(0, `rgba(74, 26, 9, ${searAlpha})`);
        rg.addColorStop(0.6, `rgba(112, 44, 16, ${searAlpha * 0.45})`);
        rg.addColorStop(1, 'rgba(112, 44, 16, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle warm grill sear stripes across the pole
      ctx.save();
      ctx.strokeStyle = `rgba(68, 24, 8, ${searAlpha * 0.55})`;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      const baseBandY = isTop ? 8 : s - 56;
      for (let x = 24; x < s; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x - 10, baseBandY);
        ctx.lineTo(x + 14, baseBandY + 46);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

export function createSpriteTextures() {
  const makeTex = (drawFn) => {
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
  const steam = makeTex((ctx, s) => {
    const g = ctx.createRadialGradient(s * 0.5, s * 0.5, 4, s * 0.5, s * 0.5, s * 0.48);
    g.addColorStop(0, 'rgba(255, 252, 245, 0.88)');
    g.addColorStop(0.55, 'rgba(255, 246, 232, 0.45)');
    g.addColorStop(1, 'rgba(255, 246, 232, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.48, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pearly air bubble (for pechi-pechi air release!)
  const bubble = makeTex((ctx, s) => {
    const cx = s * 0.5, cy = s * 0.5, r = s * 0.4;
    const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 2, cx, cy, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    g.addColorStop(0.65, 'rgba(232, 246, 255, 0.34)');
    g.addColorStop(0.9, 'rgba(255, 224, 210, 0.68)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    // Cute specular crescent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.34, cy - r * 0.34, 9, 5, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4-point sunlit anime sparkle
  const sparkle = makeTex((ctx, s) => {
    const cx = s * 0.5, cy = s * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.46);
    g.addColorStop(0, 'rgba(255, 252, 220, 0.95)');
    g.addColorStop(0.4, 'rgba(255, 220, 125, 0.45)');
    g.addColorStop(1, 'rgba(255, 210, 100, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    ctx.fillStyle = '#fffdf0';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? s * 0.44 : s * 0.11;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });

  // Warm watercolor peach-coral heart
  const heart = makeTex((ctx, s) => {
    ctx.save();
    ctx.translate(s * 0.5, s * 0.54);
    ctx.scale(0.85, 0.85);
    ctx.fillStyle = '#ff7b89';
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.bezierCurveTo(-48, 4, -52, -38, -24, -42);
    ctx.bezierCurveTo(-6, -45, 0, -26, 0, -20);
    ctx.bezierCurveTo(0, -26, 6, -45, 24, -42);
    ctx.bezierCurveTo(52, -38, 48, 4, 0, 34);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 235, 238, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-16, -22, 8, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Golden meat-juice / butter droplet
  const droplet = makeTex((ctx, s) => {
    const cx = s * 0.5, cy = s * 0.5, r = s * 0.34;
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, r);
    g.addColorStop(0, '#fff9d2');
    g.addColorStop(0.55, '#f6be4f');
    g.addColorStop(1, 'rgba(224, 138, 34, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });

  return { steam, bubble, sparkle, heart, droplet };
}
