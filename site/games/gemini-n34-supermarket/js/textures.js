import * as THREE from '../vendor/three.module.js';

// High-craft photorealistic procedural PBR textures (strictly <= 512px) with ZERO text and ZERO numbers.

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function cached(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

// 1. Realistic supermarket terrazzo ceramic floor tile (diffuse + roughness)
export function getFloorTextures() {
  return cached('floor', () => {
    const size = 512;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#ddd4c5';
    ctx.fillRect(0, 0, size, size);

    // Rich mineral terrazzo aggregate flecks
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.7 + Math.random() * 2.8;
      const shades = ['#c8bdab', '#b5a894', '#efe9de', '#9f9382', '#d3c8b7'];
      ctx.fillStyle = shades[(Math.random() * shades.length) | 0];
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const half = size / 2;
    ctx.strokeStyle = '#9e9280';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.beginPath();
    ctx.moveTo(half, 0); ctx.lineTo(half, size);
    ctx.moveTo(0, half); ctx.lineTo(size, half);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(half + 3, 0); ctx.lineTo(half + 3, size);
    ctx.moveTo(0, half + 3); ctx.lineTo(size, half + 3);
    ctx.stroke();

    const rc = makeCanvas(size, size);
    const rctx = rc.getContext('2d');
    rctx.fillStyle = '#404040';
    rctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 700; i++) {
      rctx.fillStyle = Math.random() > 0.5 ? '#525252' : '#353535';
      rctx.fillRect(Math.random() * size, Math.random() * size, 10, 10);
    }
    rctx.strokeStyle = '#d8d8d8';
    rctx.lineWidth = 6;
    rctx.strokeRect(2, 2, size - 4, size - 4);
    rctx.beginPath();
    rctx.moveTo(half, 0); rctx.lineTo(half, size);
    rctx.moveTo(0, half); rctx.lineTo(size, half);
    rctx.stroke();

    return {
      map: toTexture(c, { repeatX: 9, repeatY: 16, srgb: true }),
      roughnessMap: toTexture(rc, { repeatX: 9, repeatY: 16, srgb: false }),
    };
  });
}

// 2. Realistic ceramic subway-tile supermarket wall texture
export function getWallTileTexture() {
  return cached('wall_tile', () => {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e2d7';
    ctx.fillRect(0, 0, 512, 512);
    const rows = 8;
    const cols = 4;
    const rh = 512 / rows;
    const cw = 512 / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw / 2);
      for (let col = -1; col <= cols; col++) {
        const x = col * cw + off;
        const y = r * rh;
        const g = ctx.createLinearGradient(x, y, x, y + rh);
        g.addColorStop(0, '#f4efe6');
        g.addColorStop(1, '#e4ddd1');
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);
      }
    }
    ctx.strokeStyle = '#bfb6a6';
    ctx.lineWidth = 3;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(512, r * rh); ctx.stroke();
    }
    return toTexture(c, { repeatX: 12, repeatY: 2.5, srgb: true });
  });
}

// 3. Rich natural cedar/oak wood grain for produce & bakery fixtures
export function getWoodTexture(tone = 'warm') {
  return cached('wood_' + tone, () => {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const base = tone === 'dark' ? '#583b26' : tone === 'light' ? '#c89b67' : '#8d5e36';
    const streak = tone === 'dark' ? '#3a2415' : tone === 'light' ? '#9e7242' : '#653f20';
    const hi = tone === 'dark' ? '#6e4b32' : tone === 'light' ? '#ddb482' : '#a87449';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 2) {
      ctx.fillStyle = y % 6 === 0 ? hi : streak;
      ctx.globalAlpha = 0.1 + Math.sin(y * 0.055) * 0.06 + Math.random() * 0.08;
      ctx.fillRect(0, y, 512, 2);
    }
    // Wood knots & plank bevels
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#241308';
    for (let p = 128; p < 512; p += 128) {
      ctx.fillRect(0, p, 512, 4);
      ctx.fillStyle = 'rgba(255,225,190,0.18)';
      ctx.fillRect(0, p + 4, 512, 2);
      ctx.fillStyle = '#241308';
    }
    ctx.globalAlpha = 1;
    return toTexture(c, { repeatX: 1, repeatY: 1, srgb: true });
  });
}

// 4. Realistic grocery product packaging texture for background shelves (ZERO TEXT!)
export function getShelfPackTexture(paletteIdx = 0) {
  return cached('shelf_pack_' + paletteIdx, () => {
    const palettes = [
      { bg: '#c9342b', band: '#f5ead6', accent: '#f0b832', sym: 'circle' },
      { bg: '#1e5aa8', band: '#edf4fc', accent: '#4cb5f5', sym: 'wave' },
      { bg: '#2f7a42', band: '#f2f7ec', accent: '#8bc34a', sym: 'leaf' },
      { bg: '#d98a1c', band: '#fff8e6', accent: '#b84a14', sym: 'diamond' },
      { bg: '#7d3a68', band: '#faf0f5', accent: '#e87fa8', sym: 'circle' },
      { bg: '#384654', band: '#eceff2', accent: '#d9534f', sym: 'wave' },
    ];
    const p = palettes[paletteIdx % palettes.length];
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = p.band;
    ctx.fillRect(0, 34, 128, 56);
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(64, 62, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(0, 0, 128, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 110, 128, 18);
    return toTexture(c, { srgb: true });
  });
}

// 5. Woven wicker basket texture (bakery)
export function getWickerTexture() {
  return cached('wicker', () => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9c6e38';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) {
      for (let x = 0; x < 256; x += 32) {
        const shift = ((y / 16) % 2) * 16;
        const g = ctx.createLinearGradient(x + shift, y, x + shift + 28, y);
        g.addColorStop(0, '#6e471e');
        g.addColorStop(0.5, '#d19e5e');
        g.addColorStop(1, '#5e3c18');
        ctx.fillStyle = g;
        ctx.fillRect((x + shift) % 256, y + 2, 26, 12);
      }
    }
    return toTexture(c, { repeatX: 2, repeatY: 2, srgb: true });
  });
}

// 6. Rubber checkout conveyor belt with chevron ridges
export function getConveyorTexture() {
  return cached('conveyor', () => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#25282d';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#2f333a' : '#1d2024';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
    }
    ctx.strokeStyle = '#3b4049';
    ctx.lineWidth = 6;
    for (let y = 16; y < 256; y += 44) {
      ctx.beginPath();
      ctx.moveTo(14, y + 14);
      ctx.lineTo(128, y);
      ctx.lineTo(242, y + 14);
      ctx.stroke();
    }
    return toTexture(c, { repeatX: 1, repeatY: 3, srgb: true });
  });
}

// 7. Realistic woven canvas eco-bag fabric (botanical leaf emblem, ZERO text)
export function getEcoBagTexture() {
  return cached('ecobag', () => {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#f2ead9');
    bg.addColorStop(1, '#dfd2bc');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    // Canvas linen weave
    ctx.fillStyle = 'rgba(110, 88, 62, 0.11)';
    for (let i = 0; i < 512; i += 4) {
      ctx.fillRect(i, 0, 1.5, 512);
      ctx.fillRect(0, i, 512, 1.5);
    }

    // Sewn pocket seam & botanical sprout emblem (ZERO text!)
    ctx.save();
    ctx.translate(256, 280);
    ctx.fillStyle = '#3d7d50';
    ctx.beginPath();
    ctx.ellipse(-38, -20, 48, 26, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5ca36e';
    ctx.beginPath();
    ctx.ellipse(36, -28, 44, 24, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e633e';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 58);
    ctx.quadraticCurveTo(-4, 0, 0, -52);
    ctx.stroke();

    // Top woven trim stripe
    ctx.strokeStyle = '#3d7d50';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(-256, -188);
    ctx.lineTo(256, -188);
    ctx.stroke();
    ctx.restore();

    return toTexture(c, { srgb: true });
  });
}

// Helper: crisp realistic barcode stripes (ZERO numbers!)
function drawBarcode(ctx, x, y, w, h) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#141414';
  let cx = x;
  const widths = [3, 2, 5, 2, 3, 4, 2, 2, 6, 2, 3, 5, 2, 4, 2, 3, 5, 2, 3];
  let i = 0;
  while (cx < x + w - 3) {
    const bw = widths[i % widths.length];
    if (i % 2 === 0) ctx.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw + 1;
    i++;
  }
}

// 8. Photorealistic Gable-Top Carton Textures (ZERO TEXT!)
export function getCartonTexture(variant = 'milk') {
  return cached('carton_' + variant, () => {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');

    if (variant === 'milk') {
      ctx.fillStyle = '#f6f9fd';
      ctx.fillRect(0, 0, 512, 512);

      const grad = ctx.createLinearGradient(0, 0, 0, 130);
      grad.addColorStop(0, '#1253ad');
      grad.addColorStop(1, '#2573d6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 122);

      // Rich cobalt splash wave
      ctx.fillStyle = '#1c69cb';
      ctx.beginPath();
      ctx.moveTo(0, 392);
      ctx.bezierCurveTo(130, 355, 260, 428, 390, 378);
      ctx.bezierCurveTo(450, 358, 490, 395, 512, 388);
      ctx.lineTo(512, 512);
      ctx.lineTo(0, 512);
      ctx.closePath();
      ctx.fill();

      // Crisp pictorial milk medallion with pasture & cow
      ctx.save();
      ctx.translate(256, 255);
      ctx.fillStyle = '#d6e9ff';
      ctx.beginPath();
      ctx.arc(0, 0, 114, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 114, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#55a646';
      ctx.beginPath();
      ctx.ellipse(0, 90, 136, 56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1d2b3a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-56, -14, 100, 58, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e242c';
      ctx.beginPath();
      ctx.ellipse(-22, 6, 17, 13, 0.3, 0, Math.PI * 2);
      ctx.ellipse(18, 18, 15, 11, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      [-40, -18, 12, 32].forEach((lx) => {
        ctx.fillRect(lx - 5, 40, 10, 24);
        ctx.strokeRect(lx - 5, 40, 10, 24);
      });
      ctx.beginPath();
      ctx.ellipse(-58, -24, 25, 21, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f6b0ba';
      ctx.beginPath();
      ctx.ellipse(-68, -14, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#181c22';
      ctx.beginPath();
      ctx.arc(-57, -28, 4, 0, Math.PI * 2);
      ctx.fill();
      // Glossy milk splash drops
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(48, -56, 15, 0, Math.PI * 2);
      ctx.arc(66, -32, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawBarcode(ctx, 355, 425, 118, 56);
    } else if (variant === 'strawberry_milk') {
      ctx.fillStyle = '#fff4f6';
      ctx.fillRect(0, 0, 512, 512);

      const grad = ctx.createLinearGradient(0, 0, 0, 120);
      grad.addColorStop(0, '#cf2954');
      grad.addColorStop(1, '#ea577d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 120);

      ctx.fillStyle = '#ec7695';
      ctx.beginPath();
      ctx.moveTo(0, 392);
      ctx.bezierCurveTo(160, 358, 310, 428, 512, 384);
      ctx.lineTo(512, 512);
      ctx.lineTo(0, 512);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.translate(256, 256);
      ctx.fillStyle = '#ffd9e3';
      ctx.beginPath();
      ctx.arc(0, 0, 112, 0, Math.PI * 2);
      ctx.fill();

      const sg = ctx.createRadialGradient(-18, -14, 10, 0, 8, 80);
      sg.addColorStop(0, '#ff596f');
      sg.addColorStop(0.65, '#d41733');
      sg.addColorStop(1, '#8f0c1f');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(0, 76);
      ctx.bezierCurveTo(-76, 36, -80, -44, 0, -50);
      ctx.bezierCurveTo(80, -44, 76, 36, 0, 76);
      ctx.fill();

      ctx.fillStyle = '#ffe48a';
      [[-24, -10], [0, -14], [24, -10], [-30, 15], [-8, 18], [16, 16], [30, 12], [-14, 42], [12, 42], [0, 56]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3.4, 5.2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#339440';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 15, -50 + Math.abs(i) * 4, 17, 9, i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      drawBarcode(ctx, 355, 425, 118, 56);
    } else {
      ctx.fillStyle = '#fff9ee';
      ctx.fillRect(0, 0, 512, 512);

      const grad = ctx.createLinearGradient(0, 0, 0, 120);
      grad.addColorStop(0, '#d96208');
      grad.addColorStop(1, '#f28b18');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 120);

      ctx.fillStyle = '#ef8f1c';
      ctx.beginPath();
      ctx.moveTo(0, 392);
      ctx.bezierCurveTo(150, 362, 340, 425, 512, 384);
      ctx.lineTo(512, 512);
      ctx.lineTo(0, 512);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.translate(256, 256);
      ctx.fillStyle = '#f2870c';
      ctx.beginPath();
      ctx.arc(0, 0, 102, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.arc(0, 0, 88, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 8; k++) {
        const a0 = k * (Math.PI / 4) + 0.08;
        const a1 = (k + 1) * (Math.PI / 4) - 0.08;
        ctx.fillStyle = '#f27f00';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 78, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawBarcode(ctx, 355, 425, 118, 56);
    }

    // Subtle paperboard vertical crease shading on carton edges
    const edgeShade = ctx.createLinearGradient(0, 0, 512, 0);
    edgeShade.addColorStop(0, 'rgba(0,0,0,0.12)');
    edgeShade.addColorStop(0.05, 'rgba(0,0,0,0)');
    edgeShade.addColorStop(0.95, 'rgba(0,0,0,0)');
    edgeShade.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, 512, 512);

    return toTexture(c, { srgb: true });
  });
}

// 9. Rich Photorealistic Food Skin / Baked Crust Textures (<= 256px)
export function getFoodSkinTexture(kind) {
  return cached('skin_' + kind, () => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');

    if (kind === 'carrot') {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#d8500b');
      g.addColorStop(0.5, '#ef6a15');
      g.addColorStop(1, '#c54308');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 7; y < 256; y += 10) {
        ctx.strokeStyle = 'rgba(110, 32, 4, 0.42)';
        ctx.lineWidth = 1.6 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.random() * 35, y);
        ctx.lineTo(150 + Math.random() * 106, y + (Math.random() - 0.5) * 3);
        ctx.stroke();
      }
    } else if (kind === 'corn') {
      ctx.fillStyle = '#e5ad12';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) {
        for (let x = 0; x < 256; x += 18) {
          const rg = ctx.createRadialGradient(x + 7, y + 6, 1, x + 9, y + 8, 9);
          rg.addColorStop(0, '#fff28c');
          rg.addColorStop(0.6, '#f2ba18');
          rg.addColorStop(1, '#b57b05');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, 15, 13, 5);
          ctx.fill();
        }
      }
    } else if (kind === 'melonpan') {
      const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 145);
      g.addColorStop(0, '#f2c060');
      g.addColorStop(0.7, '#d38a2e');
      g.addColorStop(1, '#9d5b15');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = 'rgba(110, 52, 10, 0.65)';
      ctx.lineWidth = 4.5;
      for (let i = -256; i < 512; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i + 256, 0); ctx.lineTo(i, 256); ctx.stroke();
      }
      for (let i = 0; i < 520; i++) {
        ctx.fillStyle = 'rgba(255, 250, 232, 0.78)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2.3, 2.3);
      }
    } else if (kind === 'baguette') {
      const g = ctx.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, '#9c561a');
      g.addColorStop(0.5, '#d48632');
      g.addColorStop(1, '#8c4a14');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 650; i++) {
        ctx.fillStyle = Math.random() > 0.45 ? 'rgba(255,244,220,0.28)' : 'rgba(90,42,8,0.28)';
        ctx.beginPath();
        ctx.arc(Math.random() * 256, Math.random() * 256, 1.5 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let y = 32; y < 240; y += 54) {
        ctx.save();
        ctx.translate(128, y);
        ctx.rotate(-0.32);
        ctx.fillStyle = '#f2cf8c';
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6e340a';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.restore();
      }
    } else if (kind === 'croissant') {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#a85712');
      g.addColorStop(0.45, '#df8f2e');
      g.addColorStop(1, '#8f440c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(102, 44, 6, 0.34)' : 'rgba(255, 224, 155, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, i * 10);
        ctx.lineTo(256, i * 10 + 9);
        ctx.stroke();
      }
    } else if (kind === 'apple') {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#96cf34');
      g.addColorStop(0.55, '#68ad22');
      g.addColorStop(1, '#438014');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 360; i++) {
        ctx.fillStyle = 'rgba(244, 255, 200, 0.45)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
    } else if (kind === 'barcode_sticker') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);
      drawBarcode(ctx, 24, 34, 208, 188);
    } else if (kind === 'receipt') {
      ctx.fillStyle = '#fcfbf7';
      ctx.fillRect(0, 0, 256, 512);
      ctx.fillStyle = '#3da35d';
      ctx.beginPath();
      ctx.arc(128, 60, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe568';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 16 : 7;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) ctx.moveTo(128 + Math.cos(a) * r, 60 + Math.sin(a) * r);
        else ctx.lineTo(128 + Math.cos(a) * r, 60 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      for (let r = 0; r < 3; r++) {
        const y = 140 + r * 68;
        ctx.fillStyle = ['#e84a3c', '#2a7ce0', '#e39a38'][r];
        ctx.beginPath();
        ctx.arc(54, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#737985';
        ctx.fillRect(88, y - 5, 118, 10);
      }
      drawBarcode(ctx, 42, 370, 172, 86);
    }
    return toTexture(c, { srgb: true });
  });
}

// 10. Soft radial contact shadow texture (grounds every food item & fixture photorealistically!)
export function getContactShadowTexture() {
  return cached('contact_shadow', () => {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    g.addColorStop(0, 'rgba(18, 12, 6, 0.45)');
    g.addColorStop(0.55, 'rgba(18, 12, 6, 0.18)');
    g.addColorStop(1, 'rgba(18, 12, 6, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return toTexture(c, { srgb: false });
  });
}

// 11. Overhead supermarket pictorial aisle signage (PURE ICONS, ZERO TEXT!)
export function getAisleSignTexture(section) {
  return cached('sign_' + section, () => {
    const c = makeCanvas(512, 192);
    const ctx = c.getContext('2d');
    const bg = section === 'produce' ? '#245c34' : section === 'dairy' ? '#195294' : section === 'bakery' ? '#8c4b1c' : '#b52b22';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 180, 22);
    ctx.fill();
    ctx.strokeStyle = '#f8f5ee';
    ctx.lineWidth = 6;
    ctx.stroke();

    if (section === 'produce') {
      drawItemIllustration(ctx, 'tomato', 110, 96, 56);
      drawItemIllustration(ctx, 'carrot', 256, 96, 60);
      drawItemIllustration(ctx, 'broccoli', 402, 96, 56);
    } else if (section === 'dairy') {
      drawItemIllustration(ctx, 'milk', 145, 96, 58);
      drawItemIllustration(ctx, 'strawberry_milk', 256, 96, 58);
      drawItemIllustration(ctx, 'orange_juice', 367, 96, 58);
    } else if (section === 'bakery') {
      drawItemIllustration(ctx, 'croissant', 120, 96, 58);
      drawItemIllustration(ctx, 'melonpan', 256, 96, 58);
      drawItemIllustration(ctx, 'baguette', 392, 96, 58);
    } else {
      drawBarcode(ctx, 90, 50, 130, 92);
      ctx.fillStyle = '#efe5d2';
      ctx.beginPath();
      ctx.roundRect(290, 62, 118, 92, 14);
      ctx.fill();
      ctx.strokeStyle = '#efe5d2';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(349, 62, 28, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#3d7d50';
      ctx.beginPath();
      ctx.arc(349, 108, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    return toTexture(c, { srgb: true });
  });
}

// 12. Crisp realistic pictorial illustrations for the Shopping List Card & POS Screen (ZERO TEXT!)
export function drawItemIllustration(ctx, itemType, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = r / 60;
  ctx.scale(s, s);

  if (itemType === 'tomato') {
    const g = ctx.createRadialGradient(-16, -14, 6, 0, 4, 48);
    g.addColorStop(0, '#ff6852');
    g.addColorStop(0.55, '#df261c');
    g.addColorStop(1, '#9b130d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 7, 44, 39, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-16, -8, 12, 7, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d8a34';
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(0, -28);
      ctx.rotate((i * Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -10, 5.5, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#246b28';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(4, -42, 10, -45);
    ctx.stroke();
  } else if (itemType === 'carrot') {
    ctx.rotate(0.55);
    ctx.fillStyle = '#33943c';
    [-12, 0, 12].forEach((ox, idx) => {
      ctx.beginPath();
      ctx.ellipse(ox, -38 - (idx === 1 ? 6 : 0), 7, 17, ox * 0.03, 0, Math.PI * 2);
      ctx.fill();
    });
    const g = ctx.createLinearGradient(-20, -20, 22, 48);
    g.addColorStop(0, '#ff8d29');
    g.addColorStop(0.5, '#f06314');
    g.addColorStop(1, '#c44206');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-21, -24);
    ctx.quadraticCurveTo(0, -32, 21, -24);
    ctx.quadraticCurveTo(16, 18, 2, 50);
    ctx.quadraticCurveTo(-2, 52, -4, 48);
    ctx.quadraticCurveTo(-17, 18, -21, -24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 38, 0, 0.38)';
    ctx.lineWidth = 2.6;
    [-10, 4, 18, 30].forEach((ry) => {
      ctx.beginPath();
      ctx.moveTo(-10 + Math.abs(ry) * 0.15, ry);
      ctx.lineTo(10 - Math.abs(ry) * 0.15, ry);
      ctx.stroke();
    });
  } else if (itemType === 'broccoli') {
    ctx.fillStyle = '#7ec45a';
    ctx.beginPath();
    ctx.roundRect(-14, 2, 28, 42, 10);
    ctx.fill();
    const puffs = [[-26, -10, 22], [26, -10, 22], [0, -26, 26], [-16, -24, 20], [16, -24, 20], [0, -6, 22]];
    puffs.forEach(([px, py, pr]) => {
      const g = ctx.createRadialGradient(px - 6, py - 6, 3, px, py, pr);
      g.addColorStop(0, '#4ca840');
      g.addColorStop(0.7, '#287a2a');
      g.addColorStop(1, '#1a571e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (itemType === 'corn') {
    ctx.rotate(0.28);
    const g = ctx.createLinearGradient(-18, -42, 18, 35);
    g.addColorStop(0, '#ffe85c');
    g.addColorStop(0.6, '#f2b818');
    g.addColorStop(1, '#cc8b08');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -6, 20, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#48a142';
    ctx.beginPath();
    ctx.moveTo(-26, 2); ctx.quadraticCurveTo(-24, 44, 0, 48); ctx.quadraticCurveTo(-8, 22, -26, 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(26, 2); ctx.quadraticCurveTo(24, 44, 0, 48); ctx.quadraticCurveTo(8, 22, 26, 2); ctx.fill();
  } else if (itemType === 'milk' || itemType === 'strawberry_milk' || itemType === 'orange_juice') {
    const primary = itemType === 'milk' ? '#1c6ed2' : itemType === 'strawberry_milk' ? '#df3c67' : '#e67a0e';
    const light = itemType === 'milk' ? '#edf6ff' : itemType === 'strawberry_milk' ? '#fff0f4' : '#fff7e8';
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(-27, -24);
    ctx.lineTo(0, -47);
    ctx.lineTo(27, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-26, -51, 52, 6);
    ctx.fillStyle = light;
    ctx.strokeStyle = '#bcc5d1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-27, -24, 54, 72, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.fillRect(-26, -24, 52, 15);
    ctx.fillRect(-26, 32, 52, 15);
    if (itemType === 'milk') {
      ctx.fillStyle = '#1c6ed2';
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.bezierCurveTo(16, 12, 14, 27, 0, 27);
      ctx.bezierCurveTo(-14, 27, -16, 12, 0, -4);
      ctx.fill();
    } else if (itemType === 'strawberry_milk') {
      ctx.fillStyle = '#dc1e3a';
      ctx.beginPath();
      ctx.arc(0, 12, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3da148';
      ctx.fillRect(-8, -4, 16, 6);
    } else {
      ctx.fillStyle = '#f28200';
      ctx.beginPath();
      ctx.arc(0, 12, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff5dc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (itemType === 'croissant') {
    // Unmistakable golden layered crescent croissant!
    const drawLobe = (x, y, rx, ry, rot, c0, c1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const g = ctx.createRadialGradient(-rx * 0.25, -ry * 0.3, 2, 0, 0, Math.max(rx, ry) * 1.1);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.strokeStyle = '#823f08';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawLobe(-34, 16, 15, 10, 0.72, '#f0b250', '#ad5b12');
    drawLobe(34, 16, 15, 10, -0.72, '#f0b250', '#ad5b12');
    drawLobe(-20, 0, 19, 15, 0.38, '#f6c268', '#bf6a18');
    drawLobe(20, 0, 19, 15, -0.38, '#f6c268', '#bf6a18');
    drawLobe(0, -8, 22, 19, 0, '#fbd484', '#c9721b');
    // Glossy butter glaze highlight
    ctx.fillStyle = 'rgba(255,248,220,0.45)';
    ctx.beginPath();
    ctx.ellipse(-4, -15, 10, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (itemType === 'melonpan') {
    const g = ctx.createRadialGradient(-12, -12, 5, 0, 0, 44);
    g.addColorStop(0, '#f8d78b');
    g.addColorStop(0.7, '#dfa043');
    g.addColorStop(1, '#b16f1f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 2, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 2, 39, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(130, 68, 16, 0.55)';
    ctx.lineWidth = 3;
    for (let i = -50; i <= 50; i += 18) {
      ctx.beginPath(); ctx.moveTo(i - 40, -40); ctx.lineTo(i + 40, 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + 40, -40); ctx.lineTo(i - 40, 44); ctx.stroke();
    }
    ctx.restore();
  } else if (itemType === 'baguette') {
    ctx.rotate(-0.48);
    const g = ctx.createLinearGradient(0, -18, 0, 18);
    g.addColorStop(0, '#edb058');
    g.addColorStop(0.55, '#d1832b');
    g.addColorStop(1, '#995314');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-48, -16, 96, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#fae0aa';
    [-22, 0, 22].forEach((sx) => {
      ctx.save();
      ctx.translate(sx, -2);
      ctx.rotate(-0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  ctx.restore();
}

export function renderCardSlot(canvas, itemType) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawItemIllustration(ctx, itemType, canvas.width / 2, canvas.height / 2, canvas.width * 0.42);
}

// 13. Dynamic POS register screen canvas (pictorial items + green dots, ZERO text/numbers!)
export function createPosScreenCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, tex };
}

export function updatePosScreen(posObj, scannedTypes, flashGreen = false) {
  const ctx = posObj.canvas.getContext('2d');
  ctx.fillStyle = flashGreen ? '#1b472b' : '#15202b';
  ctx.fillRect(0, 0, 256, 192);

  ctx.fillStyle = flashGreen ? '#4ade80' : '#38bdf8';
  ctx.fillRect(10, 10, 236, 12);

  for (let i = 0; i < 3; i++) {
    const x = 18 + i * 76;
    ctx.fillStyle = scannedTypes[i] ? '#ffffff' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x, 38, 68, 86, 10);
    ctx.fill();
    if (scannedTypes[i]) {
      drawItemIllustration(ctx, scannedTypes[i], x + 34, 81, 26);
    }
  }

  for (let i = 0; i < 3; i++) {
    const cx = 76 + i * 52;
    ctx.fillStyle = i < scannedTypes.length ? '#4ade80' : '#334155';
    ctx.beginPath();
    ctx.arc(cx, 156, 14, 0, Math.PI * 2);
    ctx.fill();
    if (i < scannedTypes.length) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 4, 152, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  posObj.tex.needsUpdate = true;
}
