// Procedural Photorealistic PBR & Real-Time Cooking Textures
// Strict Hardware Budget: ALL textures <= 1024px (256..1024)

import * as THREE from '../vendor/three.module.min.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.min(1024, w);
  c.height = Math.min(1024, h);
  return c;
}

function finishTexture(canvas, { srgb = true, repeatX = 1, repeatY = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

// Deterministic fast pseudo-noise for organic veins, pores & sear marks
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return v;
}

// 1. Rich Warm Oiled Walnut Butcher-Block Kitchen Countertop (1024x1024)
// Gives photographic warmth & high visual contrast for white eggs, crystal glass, golden tamagoyaki & white steam!
export function createCounterStoneTextures() {
  const size = 1024;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  const plankCount = 6;
  for (let y = 0; y < size; y++) {
    const plankIdx = Math.floor((y / size) * plankCount);
    const plankSeam = Math.min(
      ((y / size) * plankCount) - plankIdx,
      1 - (((y / size) * plankCount) - plankIdx)
    );
    const seamDark = plankSeam < 0.012 ? (1 - plankSeam / 0.012) * 38 : 0;
    const plankTint = (hash2(plankIdx, 19) - 0.5) * 18;

    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const warp = fbm(nx * 2.8 + plankIdx * 1.7, ny * 9.0, 3) * 0.14;
      const ring = Math.sin((ny * 34.0 + warp * 18.0 + plankIdx * 0.9) * Math.PI) * 0.5 + 0.5;
      const fine = fbm(nx * 64.0, ny * 16.0, 2);
      const grain = Math.pow(ring, 2.2) * 0.68 + fine * 0.32;

      const r = Math.min(255, Math.max(0, 146 + plankTint - grain * 42 - seamDark));
      const g = Math.min(255, Math.max(0, 98 + plankTint * 0.75 - grain * 34 - seamDark));
      const b = Math.min(255, Math.max(0, 64 + plankTint * 0.5 - grain * 26 - seamDark));

      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;

      const bv = Math.min(255, Math.max(0, 136 - grain * 48 - seamDark * 2));
      bimg.data[i] = bv;
      bimg.data[i + 1] = bv;
      bimg.data[i + 2] = bv;
      bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  return {
    map: finishTexture(colC, { srgb: true, repeatX: 2, repeatY: 2 }),
    bumpMap: finishTexture(bumpC, { srgb: false, repeatX: 2, repeatY: 2 }),
  };
}

// 2. Straight-Grain Japanese Hinoki Cutting Board (1024x512)
export function createHinokiWoodTextures() {
  const w = 1024, h = 512;
  const colC = makeCanvas(w, h);
  const bumpC = makeCanvas(w, h);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  const img = ctx.createImageData(w, h);
  const bimg = bctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const ny = y / h;
      const warp = fbm(nx * 3.0, ny * 6.0, 3) * 0.08;
      const ring = Math.sin((ny * 26.0 + warp * 14.0) * Math.PI * 2) * 0.5 + 0.5;
      const fine = fbm(nx * 90.0, ny * 14.0, 2);
      const fiber = Math.pow(ring, 2.6) * 0.65 + fine * 0.35;

      const r = 236 - fiber * 29 + (fine - 0.5) * 8;
      const g = 202 - fiber * 34 + (fine - 0.5) * 7;
      const b = 152 - fiber * 36 + (fine - 0.5) * 6;

      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, Math.max(0, r));
      img.data[i + 1] = Math.min(255, Math.max(0, g));
      img.data[i + 2] = Math.min(255, Math.max(0, b));
      img.data[i + 3] = 255;

      const bv = Math.min(255, Math.max(0, 140 - fiber * 55 + (fine - 0.5) * 26));
      bimg.data[i] = bv;
      bimg.data[i + 1] = bv;
      bimg.data[i + 2] = bv;
      bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  return {
    map: finishTexture(colC, { srgb: true }),
    bumpMap: finishTexture(bumpC, { srgb: false }),
  };
}

// 3. Rich Warm Keyaki / Oak Wood for Pan Handle, Chopsticks & Bento Rim (512x512)
export function createKeyakiWoodTexture(dark = false) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const nx = x / s, ny = y / s;
      const wv = fbm(nx * 4, ny * 12, 3);
      const grain = Math.pow(Math.sin((ny * 18 + wv * 4) * Math.PI) * 0.5 + 0.5, 2.2);
      const baseR = dark ? 112 : 184;
      const baseG = dark ? 68 : 126;
      const baseB = dark ? 40 : 76;
      const i = (y * s + x) * 4;
      img.data[i] = Math.max(0, baseR - grain * 34);
      img.data[i + 1] = Math.max(0, baseG - grain * 28);
      img.data[i + 2] = Math.max(0, baseB - grain * 22);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(c, { srgb: true });
}

// 4. Artisan Hammered Copper ("Tsuchime") Exterior for Makiyakinabe Pan (512x512)
export function createHammeredCopperTextures() {
  const s = 512;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  ctx.fillStyle = '#cc7447';
  ctx.fillRect(0, 0, s, s);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, s, s);

  const cols = 22, rows = 14;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const cx = ((c + (r % 2) * 0.5) / cols) * s + (hash2(c, r) - 0.5) * 6;
      const cy = (r / rows) * s + (hash2(r, c) - 0.5) * 5;
      const rad = 16 + hash2(c * 3, r * 7) * 5;

      const bg = bctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
      bg.addColorStop(0, '#4a4a4a');
      bg.addColorStop(0.75, '#8e8e8e');
      bg.addColorStop(1, '#b8b8b8');
      bctx.fillStyle = bg;
      bctx.beginPath();
      bctx.arc(cx, cy, rad, 0, Math.PI * 2);
      bctx.fill();

      const cg = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, rad);
      cg.addColorStop(0, '#e59568');
      cg.addColorStop(0.7, '#c76d40');
      cg.addColorStop(1, '#9d4d27');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    map: finishTexture(colC, { srgb: true }),
    bumpMap: finishTexture(bumpC, { srgb: false }),
  };
}

// 5. Seasoned Oiled Cast-Iron / Tinned Pan Interior (512x512)
export function createSeasonedPanTextures() {
  const s = 512;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  const draw = (oilLevel = 0.6) => {
    const g = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.05, s * 0.5, s * 0.5, s * 0.68);
    g.addColorStop(0, oilLevel > 0.7 ? '#34302c' : '#2c2926');
    g.addColorStop(0.7, '#22201d');
    g.addColorStop(1, '#181614');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // Subtle oil droplets & brushed seasoning streaks
    ctx.strokeStyle = `rgba(255, 236, 190, ${0.04 + oilLevel * 0.05})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 90; i++) {
      const y = hash2(i, 1) * s;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y + (hash2(i, 2) - 0.5) * 10);
      ctx.stroke();
    }

    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      const x = hash2(i, 9) * s;
      const y = hash2(i, 13) * s;
      const r = 1 + hash2(i, 21) * 3;
      bctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
      bctx.beginPath();
      bctx.arc(x, y, r, 0, Math.PI * 2);
      bctx.fill();
    }
  };
  draw(0.6);

  const map = finishTexture(colC, { srgb: true });
  const bumpMap = finishTexture(bumpC, { srgb: false });
  return {
    map,
    bumpMap,
    setOil(oilLevel) {
      draw(oilLevel);
      map.needsUpdate = true;
    },
  };
}

// 6. Realistic Farm Eggshell Texture with Pores, Speckles & Dynamic Crack (512x512)
export function createEggShellPainter(variant = 0) {
  const s = 512;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  // Mix of warm cream-ivory & warm brown farm eggs
  const palettes = [
    ['#f8efe2', '#eddcc6', '#c99b74'],
    ['#efe0cc', '#e1c7a8', '#b58158'],
    ['#fbf4ea', '#f0e2cf', '#cfb08e'],
  ];
  const pal = palettes[variant % palettes.length];

  const paintBase = () => {
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(0.6, pal[1]);
    grad.addColorStop(1, pal[0]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    bctx.fillStyle = '#848484';
    bctx.fillRect(0, 0, s, s);

    // Subtle eggshell calcium pores & organic speckles
    for (let i = 0; i < 650; i++) {
      const x = hash2(i + variant * 31, 3) * s;
      const y = hash2(i + variant * 17, 8) * s;
      const rad = 0.7 + hash2(i, 19) * 1.9;
      ctx.fillStyle = i % 7 === 0 ? pal[2] : 'rgba(175, 130, 92, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();

      bctx.fillStyle = 'rgba(40,40,40,0.16)';
      bctx.beginPath();
      bctx.arc(x, y, rad * 0.9, 0, Math.PI * 2);
      bctx.fill();
    }
  };
  paintBase();

  const map = finishTexture(colC, { srgb: true });
  const bumpMap = finishTexture(bumpC, { srgb: false });

  return {
    map,
    bumpMap,
    reset() {
      paintBase();
      map.needsUpdate = true;
      bumpMap.needsUpdate = true;
    },
    drawCrack(severity = 1) {
      paintBase();
      const midY = s * 0.5;
      ctx.strokeStyle = 'rgba(72, 46, 28, 0.88)';
      ctx.lineWidth = 2.6 + severity * 1.6;
      ctx.beginPath();
      bctx.strokeStyle = '#121212';
      bctx.lineWidth = 5;
      bctx.beginPath();

      const span = severity >= 2 ? s * 0.85 : s * 0.42;
      const startX = s * 0.5 - span * 0.5;
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const px = startX + (span * i) / segs;
        const py = midY + (hash2(i * 5, variant + 2) - 0.5) * 26;
        if (i === 0) {
          ctx.moveTo(px, py);
          bctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
          bctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      bctx.stroke();

      // Spider hairline branches
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(90, 58, 36, 0.65)';
      for (let b = 0; b < 5; b++) {
        const bx = startX + span * (0.2 + b * 0.15);
        const by = midY + (hash2(b, 41) - 0.5) * 14;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (hash2(b, 55) - 0.5) * 32, by + (b % 2 === 0 ? -24 : 24));
        ctx.stroke();
      }
      map.needsUpdate = true;
      bumpMap.needsUpdate = true;
    },
  };
}

// 7. Real-Time Dynamic Egg Liquid Swirling Canvas in Glass Bowl (512x512)
export function createBowlLiquidPainter() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const texture = finishTexture(c, { srgb: true });

  const render = (mixProgress = 0, swirlAngle = 0, eggCount = 1, mixIns = {}) => {
    const cx = s * 0.5, cy = s * 0.5;
    ctx.clearRect(0, 0, s, s);

    // Base transitions from translucent pale albumen -> rich golden tamago liquid
    const m = Math.max(0, Math.min(1, mixProgress));
    const honeyBoost = mixIns.honey ? 14 : 0;
    const baseR = Math.round(238 + (252 - 238) * m);
    const baseG = Math.round(229 + (186 + honeyBoost * 0.4 - 229) * m);
    const baseB = Math.round(196 + (54 - 196) * m);

    const radG = ctx.createRadialGradient(cx, cy, s * 0.04, cx, cy, s * 0.5);
    radG.addColorStop(0, `rgb(${Math.min(255, baseR + 8)}, ${Math.min(255, baseG + 10)}, ${Math.min(255, baseB + 12)})`);
    radG.addColorStop(0.78, `rgb(${baseR}, ${baseG}, ${baseB})`);
    radG.addColorStop(1, `rgb(${Math.max(0, baseR - 22)}, ${Math.max(0, baseG - 24)}, ${Math.max(0, baseB - 18)})`);
    ctx.fillStyle = radG;
    ctx.fillRect(0, 0, s, s);

    // Marbled yolk & albumen ribbons during whisking (visible especially 0.05..0.92)
    if (m > 0.02 && m < 0.98) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(swirlAngle);

      const streakAlpha = Math.sin(Math.min(1, m * 1.05) * Math.PI) * 0.85 + (1 - m) * 0.35;
      const ribbons = 6 + eggCount * 3;
      for (let i = 0; i < ribbons; i++) {
        const a0 = (i / ribbons) * Math.PI * 2 + i * 0.4;
        ctx.beginPath();
        for (let t = 0; t <= 28; t++) {
          const u = t / 28;
          const r = (0.06 + u * 0.39) * s;
          const ang = a0 + u * (2.4 + m * 4.5);
          const px = Math.cos(ang) * r;
          const py = Math.sin(ang) * r;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = i % 3 === 0
          ? `rgba(255, 248, 226, ${streakAlpha * (1 - m * 0.72)})`
          : `rgba(246, 134, 14, ${streakAlpha * (1 - m * 0.55)})`;
        ctx.lineWidth = (18 - m * 12) * (i % 2 === 0 ? 1.1 : 0.7);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    // Mix-in flecks swirling in the liquid!
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(swirlAngle * 0.75);
    if (mixIns.honey) {
      ctx.strokeStyle = `rgba(228, 138, 12, ${0.55 * (1 - m * 0.5)})`;
      ctx.lineWidth = 9;
      ctx.beginPath();
      for (let t = 0; t < 30; t++) {
        const u = t / 30;
        const r = u * s * 0.33;
        const a = u * 8.5;
        if (t === 0) ctx.moveTo(r, 0);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    }
    if (mixIns.cheese) {
      for (let i = 0; i < 24; i++) {
        const r = (0.08 + hash2(i, 3) * 0.34) * s;
        const a = hash2(i, 7) * Math.PI * 2;
        ctx.fillStyle = '#fff2a6';
        ctx.strokeStyle = 'rgba(218,162,38,0.5)';
        ctx.lineWidth = 1.5;
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillRect(-6, -5, 12, 10);
        ctx.strokeRect(-6, -5, 12, 10);
        ctx.restore();
      }
    }
    if (mixIns.negi) {
      for (let i = 0; i < 34; i++) {
        const r = (0.06 + hash2(i, 11) * 0.36) * s;
        const a = hash2(i, 19) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? '#3a8c32' : '#5bb347';
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 6.5, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Whisked tiny frothy air bubbles around rim & center
    if (m > 0.25) {
      const bubbleCount = Math.floor((m - 0.2) * 75);
      for (let i = 0; i < bubbleCount; i++) {
        const ring = hash2(i, 31) > 0.35 ? 0.34 + hash2(i, 37) * 0.11 : hash2(i, 41) * 0.24;
        const a = hash2(i, 43) * Math.PI * 2 + swirlAngle * 0.4;
        const bx = cx + Math.cos(a) * ring * s;
        const by = cy + Math.sin(a) * ring * s;
        const br = 2 + hash2(i, 53) * 4.5;
        ctx.fillStyle = 'rgba(255, 252, 236, 0.58)';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(215, 148, 28, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    texture.needsUpdate = true;
  };

  render(0, 0, 1, {});
  return { texture, render };
}

// 8. Real-Time Pan-Baked Tamagoyaki Surface & Golden-Brown Sear ("Yaki-iro") Painter (512x512)
export function createCookedEggPainter() {
  const s = 512;
  const topC = makeCanvas(s, s);
  const botC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const tctx = topC.getContext('2d');
  const bctx = botC.getContext('2d');
  const mctx = bumpC.getContext('2d');

  // Precompute organic sear patch map so browning grows naturally like real coagulating egg proteins!
  const patchField = new Float32Array(128 * 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const n = fbm((x / 128) * 6.5, (y / 128) * 4.5, 4);
      const fine = fbm((x / 128) * 20.0, (y / 128) * 16.0, 2);
      patchField[y * 128 + x] = n * 0.72 + fine * 0.28;
    }
  }

  const topTexture = finishTexture(topC, { srgb: true });
  const bottomTexture = finishTexture(botC, { srgb: true });
  const bumpTexture = finishTexture(bumpC, { srgb: false });

  let lastSear = -1;
  let lastSet = -1;

  const update = ({ setProgress = 0, searLevel = 0.25, mixIns = {}, force = false }) => {
    if (!force && Math.abs(searLevel - lastSear) < 0.025 && Math.abs(setProgress - lastSet) < 0.03) {
      return;
    }
    lastSear = searLevel;
    lastSet = setProgress;

    const honeyWarm = mixIns.honey ? 1 : 0;

    // Top surface (starts wet glossy golden-amber, sets into tender custard yellow with white albumen flecks & bubbles)
    const topR = Math.round(252);
    const topG = Math.round(196 + setProgress * 16 - honeyWarm * 8);
    const topB = Math.round(58 + setProgress * 28 - honeyWarm * 12);
    tctx.fillStyle = `rgb(${topR}, ${topG}, ${topB})`;
    tctx.fillRect(0, 0, s, s);

    // Subtle curdled egg-white clouds & tender blisters on top
    for (let i = 0; i < 45; i++) {
      const x = hash2(i, 4) * s;
      const y = hash2(i, 9) * s;
      const rx = 10 + hash2(i, 12) * 26;
      const ry = 7 + hash2(i, 15) * 16;
      tctx.fillStyle = i % 3 === 0
        ? `rgba(255, 248, 220, ${0.18 + setProgress * 0.22})`
        : `rgba(240, 168, 28, ${0.18})`;
      tctx.beginPath();
      tctx.ellipse(x, y, rx, ry, hash2(i, 21) * Math.PI, 0, Math.PI * 2);
      tctx.fill();
    }

    // Bottom / Outer Rolled Surface: Authentic Japanese Tamagoyaki "Yaki-iro" (dappled golden-brown sear + pale blister rings!)
    const small = document.createElement('canvas');
    small.width = 128;
    small.height = 128;
    const sctx = small.getContext('2d');
    const simg = sctx.createImageData(128, 128);
    const bimg = sctx.createImageData(128, 128);

    const effSear = Math.min(1.0, searLevel + honeyWarm * 0.18);
    for (let i = 0; i < 128 * 128; i++) {
      const p = patchField[i];
      // Richer golden-amber custard + authentic caramelized Maillard brown spots ("Yaki-iro")!
      const threshold = 0.72 - effSear * 0.46;
      const brown = Math.max(0, Math.min(1, (p - threshold) * 4.4));
      const deepToast = Math.max(0, Math.min(1, (p - (threshold + 0.11)) * 5.2));
      const blister = Math.max(0, Math.min(1, (0.40 - p) * 3.8)) * setProgress;

      let r = 248 - brown * 86 - deepToast * 38 + blister * 7;
      let g = 186 - brown * 108 - deepToast * 36 + blister * 38;
      let b = 46 - brown * 34 - deepToast * 10 + blister * 72;

      const idx = i * 4;
      simg.data[idx] = Math.max(0, Math.min(255, r));
      simg.data[idx + 1] = Math.max(0, Math.min(255, g));
      simg.data[idx + 2] = Math.max(0, Math.min(255, b));
      simg.data[idx + 3] = 255;

      const bv = Math.max(0, Math.min(255, 128 + blister * 62 - brown * 38));
      bimg.data[idx] = bv;
      bimg.data[idx + 1] = bv;
      bimg.data[idx + 2] = bv;
      bimg.data[idx + 3] = 255;
    }
    sctx.putImageData(simg, 0, 0);
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(small, 0, 0, s, s);

    sctx.putImageData(bimg, 0, 0);
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(small, 0, 0, s, s);

    // Draw mix-ins into both surfaces!
    const drawMixInsOn = (ctx, alpha = 0.9) => {
      if (mixIns.cheese) {
        for (let i = 0; i < 22; i++) {
          const x = (0.08 + hash2(i, 61) * 0.84) * s;
          const y = (0.08 + hash2(i, 67) * 0.84) * s;
          const r = 8 + hash2(i, 71) * 11;
          const cg = ctx.createRadialGradient(x, y, 1, x, y, r);
          cg.addColorStop(0, `rgba(255, 248, 185, ${alpha})`);
          cg.addColorStop(1, `rgba(250, 206, 82, 0)`);
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (mixIns.negi) {
        for (let i = 0; i < 36; i++) {
          const x = (0.05 + hash2(i, 79) * 0.9) * s;
          const y = (0.05 + hash2(i, 83) * 0.9) * s;
          ctx.fillStyle = i % 2 === 0 ? `rgba(54, 134, 42, ${alpha})` : `rgba(88, 168, 62, ${alpha * 0.85})`;
          ctx.beginPath();
          ctx.ellipse(x, y, 7, 4.5, hash2(i, 89) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    drawMixInsOn(tctx, 0.92);
    drawMixInsOn(bctx, 0.68);

    topTexture.needsUpdate = true;
    bottomTexture.needsUpdate = true;
    bumpTexture.needsUpdate = true;
  };

  update({ setProgress: 0, searLevel: 0.2, mixIns: {}, force: true });
  return { topTexture, bottomTexture, bumpTexture, update };
}

// 9. Appetizing Layered Spiral Cross-Section Texture When Sliced! (512x512)
export function createSpiralCutTexture({ searLevel = 0.38, eggCount = 2, mixIns = {} } = {}) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');

  // Moist rich custard-gold interior base
  const honeyShift = mixIns.honey ? 12 : 0;
  const g = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.04, s * 0.5, s * 0.5, s * 0.56);
  g.addColorStop(0, `rgb(255, ${208 - honeyShift}, ${66 - honeyShift})`);
  g.addColorStop(0.72, `rgb(248, ${186 - honeyShift}, ${48 - honeyShift})`);
  g.addColorStop(1, `rgb(222, ${148 - honeyShift}, ${32 - honeyShift})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Subtle moist egg curds & tiny steam air pockets ("su")
  for (let i = 0; i < 85; i++) {
    const x = hash2(i, 101) * s;
    const y = hash2(i, 107) * s;
    if (i % 4 === 0) {
      // Tiny realistic air pocket shadow + moist rim
      const rx = 2.8 + hash2(i, 109) * 5.0;
      const ry = 2.0 + hash2(i, 113) * 3.4;
      ctx.fillStyle = 'rgba(154, 92, 10, 0.46)';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, hash2(i, 127) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255, 245, 206, 0.34)';
      ctx.beginPath();
      ctx.ellipse(x, y, 9 + hash2(i, 131) * 12, 5 + hash2(i, 137) * 7, hash2(i, 139) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Iconic Tamagoyaki Rounded-Rectangle Spiral Seam Line!
  const turns = 3.1 + eggCount * 0.45;
  const effSear = Math.min(1, searLevel + (mixIns.honey ? 0.15 : 0));
  const seamR = Math.round(162 - effSear * 68);
  const seamG = Math.round(92 - effSear * 52);
  const seamB = Math.round(22 - effSear * 14);

  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.lineCap = 'round';

  // Soft warm shadow halo around spiral seam + crisp seared spiral line
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const ang = u * turns * Math.PI * 2 + 0.35;
      const rad = 0.045 + u * 0.415;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const sq = 1 / Math.pow(Math.pow(Math.abs(ca), 3.2) + Math.pow(Math.abs(sa), 3.2), 1 / 3.2);
      const blend = 0.45 + 0.55 * u;
      const rr = rad * (1 - blend + blend * sq * 0.92) * s;
      const wob = (hash2(i, 7) - 0.5) * 2.5;
      const px = ca * (rr * 1.04) + wob;
      const py = sa * (rr * 0.88) - wob;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if (pass === 0) {
      ctx.strokeStyle = `rgba(${seamR}, ${seamG}, ${seamB}, 0.38)`;
      ctx.lineWidth = 17;
    } else {
      ctx.strokeStyle = `rgba(${seamR}, ${seamG}, ${seamB}, 0.94)`;
      ctx.lineWidth = 6.8;
    }
    ctx.stroke();
  }

  // Melted cheese ribbons & negi flecks tucked along the spiral!
  if (mixIns.cheese) {
    for (let i = 0; i < 14; i++) {
      const u = 0.15 + (i / 14) * 0.72;
      const ang = u * turns * Math.PI * 2 + 0.35;
      const px = Math.cos(ang) * u * s * 0.38;
      const py = Math.sin(ang) * u * s * 0.31;
      const cg = ctx.createRadialGradient(px, py, 1, px, py, 18);
      cg.addColorStop(0, 'rgba(255, 251, 204, 0.96)');
      cg.addColorStop(0.65, 'rgba(255, 224, 112, 0.78)');
      cg.addColorStop(1, 'rgba(255, 210, 90, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (mixIns.negi) {
    for (let i = 0; i < 24; i++) {
      const u = 0.1 + hash2(i, 151) * 0.78;
      const ang = hash2(i, 157) * Math.PI * 2;
      const px = Math.cos(ang) * u * s * 0.42;
      const py = Math.sin(ang) * u * s * 0.36;
      ctx.fillStyle = i % 2 === 0 ? '#2f7e2b' : '#58ad45';
      ctx.beginPath();
      ctx.ellipse(px, py, 7.5, 4.8, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 248, 198, 0.65)';
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Outer seared border ring
  ctx.strokeStyle = `rgb(${seamR - 14}, ${Math.max(20, seamG - 16)}, ${Math.max(10, seamB - 8)})`;
  ctx.lineWidth = 18;
  ctx.strokeRect(4, 4, s - 8, s - 8);

  return finishTexture(c, { srgb: true });
}

// 10. Soft Volumetric-Looking Steam Puff Texture (256x256)
export function createSteamSpriteTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  const lobes = [
    [0.5, 0.52, 0.44, 0.52],
    [0.37, 0.46, 0.33, 0.36],
    [0.64, 0.45, 0.32, 0.36],
    [0.48, 0.34, 0.30, 0.32],
    [0.52, 0.66, 0.31, 0.28],
  ];
  lobes.forEach(([lx, ly, lr, a]) => {
    const g = ctx.createRadialGradient(lx * s, ly * s, 2, lx * s, ly * s, lr * s);
    g.addColorStop(0, `rgba(255, 254, 250, ${a})`);
    g.addColorStop(0.55, `rgba(252, 249, 244, ${a * 0.52})`);
    g.addColorStop(1, 'rgba(252, 249, 244, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx * s, ly * s, lr * s, 0, Math.PI * 2);
    ctx.fill();
  });

  return finishTexture(c, { srgb: true });
}

// 11. Warm Glazed Sand-Taupe Ceramic Subway Wall Tiles (512x512)
// Warm earthy tone lets white rising steam & golden tamagoyaki pop clearly!
export function createSubwayTileTextures() {
  const s = 512;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  ctx.fillStyle = '#9c8e7e';
  ctx.fillRect(0, 0, s, s);
  bctx.fillStyle = '#383838';
  bctx.fillRect(0, 0, s, s);

  const rows = 8, cols = 4;
  const tw = s / cols, th = s / rows;
  const grout = 4;
  for (let r = 0; r < rows; r++) {
    const ox = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + ox + grout * 0.5;
      const y = r * th + grout * 0.5;
      const w = tw - grout;
      const h = th - grout;
      const tint = (hash2(c + 10, r + 5) - 0.5) * 10;
      ctx.fillStyle = `rgb(${198 + tint}, ${186 + tint}, ${170 + tint})`;
      ctx.fillRect(x, y, w, h);

      const bg = bctx.createLinearGradient(x, y, x, y + h);
      bg.addColorStop(0, '#c8c8c8');
      bg.addColorStop(0.15, '#eaeaea');
      bg.addColorStop(0.85, '#e2e2e2');
      bg.addColorStop(1, '#b0b0b0');
      bctx.fillStyle = bg;
      bctx.fillRect(x, y, w, h);
    }
  }

  return {
    map: finishTexture(colC, { srgb: true, repeatX: 4, repeatY: 2 }),
    bumpMap: finishTexture(bumpC, { srgb: false, repeatX: 4, repeatY: 2 }),
  };
}

// 12. Natural Woven Linen Fabric Texture for Apron & Kerchief (512x512)
export function createFabricTexture(mainRgb = [219, 134, 108], accentRgb = [202, 114, 88]) {
  const s = 512;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  ctx.fillStyle = `rgb(${mainRgb[0]}, ${mainRgb[1]}, ${mainRgb[2]})`;
  ctx.fillRect(0, 0, s, s);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, s, s);

  // Subtle woven linen slub threads
  for (let i = 0; i < s; i += 4) {
    ctx.fillStyle = i % 8 === 0
      ? `rgba(255,248,240,0.09)`
      : `rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.14)`;
    ctx.fillRect(0, i, s, 2);
    ctx.fillRect(i, 0, 2, s);

    bctx.fillStyle = i % 8 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    bctx.fillRect(0, i, s, 2);
    bctx.fillRect(i, 0, 2, s);
  }

  return {
    map: finishTexture(colC, { srgb: true, repeatX: 2, repeatY: 2 }),
    bumpMap: finishTexture(bumpC, { srgb: false, repeatX: 2, repeatY: 2 }),
  };
}

// 13. Glossy Chestnut Hair Strand Texture (512x512)
export function createHairTexture() {
  const s = 512;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  ctx.fillStyle = '#3b2419';
  ctx.fillRect(0, 0, s, s);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 420; i++) {
    const x = hash2(i, 201) * s;
    const w = 1.2 + hash2(i, 203) * 2.5;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(108, 68, 44, 0.36)' : 'rgba(34, 19, 12, 0.42)';
    ctx.fillRect(x, 0, w, s);
    bctx.fillStyle = i % 2 === 0 ? 'rgba(220,220,220,0.18)' : 'rgba(40,40,40,0.18)';
    bctx.fillRect(x, 0, w, s);
  }
  return {
    map: finishTexture(colC, { srgb: true }),
    bumpMap: finishTexture(bumpC, { srgb: false }),
  };
}

// 14. Lifelike Warm Chestnut-Amber Eye Iris Texture (256x256)
export function createIrisTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s * 0.5, cy = s * 0.5;

  ctx.fillStyle = '#faf6f0';
  ctx.fillRect(0, 0, s, s);

  const irisR = s * 0.44;
  const ig = ctx.createRadialGradient(cx, cy, irisR * 0.2, cx, cy, irisR);
  ig.addColorStop(0, '#6c3e20');
  ig.addColorStop(0.55, '#8a5229');
  ig.addColorStop(0.88, '#4e2b15');
  ig.addColorStop(1, '#2a160a');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  // Radial iris fibers
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(196, 132, 72, 0.28)' : 'rgba(42, 20, 8, 0.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * irisR * 0.28, Math.sin(a) * irisR * 0.28);
    ctx.lineTo(Math.cos(a) * irisR * 0.92, Math.sin(a) * irisR * 0.92);
    ctx.stroke();
  }
  ctx.restore();

  // Deep pupil
  ctx.fillStyle = '#120b08';
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.38, 0, Math.PI * 2);
  ctx.fill();

  return finishTexture(c, { srgb: true });
}

// 15. Glossy Ripe Strawberry Texture with Dimpled Seeds (256x256)
export function createStrawberryTextures() {
  const s = 256;
  const colC = makeCanvas(s, s);
  const bumpC = makeCanvas(s, s);
  const ctx = colC.getContext('2d');
  const bctx = bumpC.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#e82936');
  g.addColorStop(0.7, '#d11624');
  g.addColorStop(1, '#b50e1b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  bctx.fillStyle = '#9a9a9a';
  bctx.fillRect(0, 0, s, s);

  const rows = 10, cols = 14;
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + (r % 2) * 0.5) / cols) * s;
      const y = (r / rows) * s;
      ctx.fillStyle = 'rgba(120, 8, 16, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 4.2, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f3d26b';
      ctx.beginPath();
      ctx.ellipse(x, y, 1.9, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();

      const bg = bctx.createRadialGradient(x, y, 1, x, y, 6);
      bg.addColorStop(0, '#444444');
      bg.addColorStop(0.5, '#686868');
      bg.addColorStop(1, '#9a9a9a');
      bctx.fillStyle = bg;
      ctx.beginPath();
      bctx.beginPath();
      bctx.arc(x, y, 6, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  return {
    map: finishTexture(colC, { srgb: true }),
    bumpMap: finishTexture(bumpC, { srgb: false }),
  };
}
