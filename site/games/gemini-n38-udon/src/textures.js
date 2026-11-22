import * as THREE from '../vendor/three.module.js';

// Seeded PRNG for deterministic procedural photorealistic textures
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

// Fast 2D value noise + fBm for organic surface detail
function createNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    vals[i] = rand();
    perm[i] = i;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  function noise(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const aa = vals[perm[perm[xi] + yi]];
    const ab = vals[perm[perm[xi] + yi + 1]];
    const ba = vals[perm[perm[xi + 1] + yi]];
    const bb = vals[perm[perm[xi + 1] + yi + 1]];
    const x1 = aa + u * (ba - aa);
    const x2 = ab + u * (bb - ab);
    return x1 + v * (x2 - x1);
  }

  function fbm(x, y, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 1.0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      val += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.02;
    }
    return val / norm;
  }
  return { noise, fbm };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTex(canvas, { repeatX = 1, repeatY = 1, srgb = true, wrap = THREE.RepeatWrapping } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Aged Showa dark cedar/hinoki kitchen counter wood (albedo + roughness + bump)
 */
export function createShowaWoodTextures() {
  const size = 512;
  const colC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const roughCtx = roughC.getContext('2d');
  const bumpCtx = bumpC.getContext('2d');

  const colImg = colCtx.createImageData(size, size);
  const roughImg = roughCtx.createImageData(size, size);
  const bumpImg = bumpCtx.createImageData(size, size);

  const { fbm } = createNoise2D(1024);
  const { fbm: fbm2 } = createNoise2D(2048);

  const plankCount = 4;
  const plankH = size / plankCount;

  for (let y = 0; y < size; y++) {
    const plankIdx = Math.floor(y / plankH);
    const plankLocalY = (y % plankH) / plankH;
    const seamDist = Math.min(plankLocalY, 1 - plankLocalY);
    const seamFactor = seamDist < 0.016 ? seamDist / 0.016 : 1.0;
    const plankTone = 0.90 + ((plankIdx * 37) % 13) * 0.014;
    const plankOffset = plankIdx * 19.3;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Elongated Japanese cedar grain
      const warp = fbm(u * 2.5 + plankOffset, v * 5.0, 4) * 0.16;
      const ringVal = Math.sin((v * 26 + warp * 14 + plankOffset) * Math.PI * 2);
      const grain = 0.5 + 0.5 * ringVal;
      const fineFibers = fbm2(u * 64, v * 8, 3);
      const patina = fbm(u * 3.2 + 5.1, v * 3.2 + 1.7, 4);
      const dampStain = Math.max(0, fbm(u * 4.5 + 11, v * 4.5 + 7, 3) - 0.58) * 1.4;

      // Deep Showa warm dark walnut/aged hinoki brown
      let r = (74 + grain * 34 + fineFibers * 14 - dampStain * 24) * plankTone;
      let g = (49 + grain * 23 + fineFibers * 9 - dampStain * 18) * plankTone;
      let b = (32 + grain * 13 + fineFibers * 5 - dampStain * 12) * plankTone;

      // Subtle patina warmth variation
      r *= 0.88 + patina * 0.24;
      g *= 0.87 + patina * 0.24;
      b *= 0.86 + patina * 0.22;

      // Darken plank seams
      const seamDark = 0.25 + 0.75 * seamFactor;
      r *= seamDark;
      g *= seamDark;
      b *= seamDark;

      const idx = (y * size + x) * 4;
      colImg.data[idx] = Math.max(0, Math.min(255, r));
      colImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      colImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      colImg.data[idx + 3] = 255;

      // Roughness: worn oiled wood has soft satin sheen, damp spots glossier
      const rough = Math.max(0.28, Math.min(0.88, 0.62 - grain * 0.10 - dampStain * 0.26 + (1 - seamFactor) * 0.25));
      const rv = Math.floor(rough * 255);
      roughImg.data[idx] = rv;
      roughImg.data[idx + 1] = rv;
      roughImg.data[idx + 2] = rv;
      roughImg.data[idx + 3] = 255;

      // Bump
      const bv = Math.floor(Math.max(0, Math.min(255, (0.45 + grain * 0.25 + fineFibers * 0.2) * seamFactor * 255)));
      bumpImg.data[idx] = bv;
      bumpImg.data[idx + 1] = bv;
      bumpImg.data[idx + 2] = bv;
      bumpImg.data[idx + 3] = 255;
    }
  }

  colCtx.putImageData(colImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  // Subtle knife scars & wear marks on the Showa prep counter
  const rand = mulberry32(991);
  colCtx.strokeStyle = 'rgba(35, 22, 13, 0.24)';
  bumpCtx.strokeStyle = 'rgba(40, 40, 40, 0.45)';
  for (let i = 0; i < 48; i++) {
    const x1 = rand() * size;
    const y1 = rand() * size;
    const ang = (rand() - 0.5) * 0.7;
    const len = 14 + rand() * 42;
    colCtx.lineWidth = 0.6 + rand() * 1.1;
    colCtx.beginPath();
    colCtx.moveTo(x1, y1);
    colCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    colCtx.stroke();

    bumpCtx.lineWidth = colCtx.lineWidth;
    bumpCtx.beginPath();
    bumpCtx.moveTo(x1, y1);
    bumpCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    bumpCtx.stroke();
  }

  return {
    map: finalizeTex(colC, { repeatX: 2.2, repeatY: 2.2, srgb: true }),
    roughnessMap: finalizeTex(roughC, { repeatX: 2.2, repeatY: 2.2, srgb: false }),
    bumpMap: finalizeTex(bumpC, { repeatX: 2.2, repeatY: 2.2, srgb: false }),
  };
}

/**
 * Vintage Showa square ceramic kitchen tiles (pale warm ivory/celadon-greige with aged grout)
 */
export function createShowaTileTextures() {
  const size = 512;
  const colC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const roughCtx = roughC.getContext('2d');
  const bumpCtx = bumpC.getContext('2d');

  const { fbm } = createNoise2D(3301);
  const rand = mulberry32(3302);

  // Grout base
  colCtx.fillStyle = '#4e493f';
  colCtx.fillRect(0, 0, size, size);
  roughCtx.fillStyle = '#e5e5e5';
  roughCtx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = '#242424';
  bumpCtx.fillRect(0, 0, size, size);

  const grid = 6;
  const cell = size / grid;
  const grout = 5;

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = gx * cell + grout * 0.5;
      const y = gy * cell + grout * 0.5;
      const w = cell - grout;
      const h = cell - grout;

      // Subtle Showa muted ivory/pale-sage ceramic variation per tile (aged dim kitchen)
      const tint = rand();
      const baseR = 128 + Math.floor((tint - 0.5) * 14) - (rand() > 0.85 ? 8 : 0);
      const baseG = 126 + Math.floor((tint - 0.5) * 12);
      const baseB = 114 + Math.floor((tint - 0.5) * 12);

      const grad = colCtx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, `rgb(${baseR + 7},${baseG + 7},${baseB + 5})`);
      grad.addColorStop(0.5, `rgb(${baseR},${baseG},${baseB})`);
      grad.addColorStop(1, `rgb(${baseR - 12},${baseG - 12},${baseB - 10})`);

      colCtx.fillStyle = grad;
      colCtx.beginPath();
      colCtx.roundRect(x, y, w, h, 4);
      colCtx.fill();

      // Glaze speckle & subtle kitchen patina
      const stain = fbm(gx * 0.8 + 1.2, gy * 0.8 + 3.1, 3);
      colCtx.fillStyle = `rgba(92, 74, 48, ${0.06 + stain * 0.14})`;
      colCtx.fillRect(x, y, w, h);

      // Glossy ceramic roughness
      const rVal = 48 + Math.floor(rand() * 28);
      roughCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      roughCtx.beginPath();
      roughCtx.roundRect(x, y, w, h, 4);
      roughCtx.fill();

      // Raised pillowed ceramic tile bump
      const bGrad = bumpCtx.createRadialGradient(x + w * 0.5, y + h * 0.5, 4, x + w * 0.5, y + h * 0.5, w * 0.72);
      bGrad.addColorStop(0, '#f2f2f2');
      bGrad.addColorStop(0.82, '#c8c8c8');
      bGrad.addColorStop(1, '#707070');
      bumpCtx.fillStyle = bGrad;
      bumpCtx.beginPath();
      bumpCtx.roundRect(x, y, w, h, 4);
      bumpCtx.fill();
    }
  }

  return {
    map: finalizeTex(colC, { repeatX: 4, repeatY: 1.5, srgb: true }),
    roughnessMap: finalizeTex(roughC, { repeatX: 4, repeatY: 1.5, srgb: false }),
    bumpMap: finalizeTex(bumpC, { repeatX: 4, repeatY: 1.5, srgb: false }),
  };
}

/**
 * Weathered Showa brushed stainless steel (for gas stove deck & metal)
 */
export function createBrushedSteelTextures() {
  const size = 512;
  const colC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const roughCtx = roughC.getContext('2d');
  const bumpCtx = bumpC.getContext('2d');
  const rand = mulberry32(4401);
  const { fbm } = createNoise2D(4402);

  // Deep Showa worn dark brushed stainless steel
  colCtx.fillStyle = '#5c5f61';
  colCtx.fillRect(0, 0, size, size);
  roughCtx.fillStyle = '#787878';
  roughCtx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  // Horizontal brushed hairline scratches
  for (let i = 0; i < 1600; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 30 + rand() * 180;
    const bright = rand() > 0.5;
    colCtx.strokeStyle = bright ? 'rgba(220,222,225,0.08)' : 'rgba(42,44,46,0.09)';
    colCtx.lineWidth = 0.6 + rand() * 1.1;
    colCtx.beginPath();
    colCtx.moveTo(x, y);
    colCtx.lineTo(x + len, y + (rand() - 0.5) * 2.0);
    colCtx.stroke();

    roughCtx.strokeStyle = bright ? 'rgba(85,85,85,0.14)' : 'rgba(155,155,155,0.14)';
    roughCtx.beginPath();
    roughCtx.moveTo(x, y);
    roughCtx.lineTo(x + len, y);
    roughCtx.stroke();

    bumpCtx.strokeStyle = bright ? 'rgba(165,165,165,0.14)' : 'rgba(95,95,95,0.14)';
    bumpCtx.beginPath();
    bumpCtx.moveTo(x, y);
    bumpCtx.lineTo(x + len, y);
    bumpCtx.stroke();
  }

  // Subtle heat/water tarnish blotches
  for (let i = 0; i < 45; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = 20 + rand() * 75;
    const g = colCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    const warm = fbm(cx * 0.02, cy * 0.02, 2);
    g.addColorStop(0, warm > 0.5 ? 'rgba(115,98,74,0.12)' : 'rgba(55,60,65,0.11)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    colCtx.fillStyle = g;
    colCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }

  return {
    map: finalizeTex(colC, { repeatX: 2, repeatY: 2, srgb: true }),
    roughnessMap: finalizeTex(roughC, { repeatX: 2, repeatY: 2, srgb: false }),
    bumpMap: finalizeTex(bumpC, { repeatX: 2, repeatY: 2, srgb: false }),
  };
}

/**
 * Hammered / spun vintage aluminum pot (雪平/寸胴大鍋)
 */
export function createHammeredAluminumTextures() {
  const size = 512;
  const colC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const roughCtx = roughC.getContext('2d');
  const bumpCtx = bumpC.getContext('2d');
  const rand = mulberry32(5501);

  colCtx.fillStyle = '#aeb0b2';
  colCtx.fillRect(0, 0, size, size);
  roughCtx.fillStyle = '#5c5c5c';
  roughCtx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  // Subtle hammered dimples
  const cols = 22;
  const rows = 14;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + (r % 2) * 0.5 + (rand() - 0.5) * 0.25) * (size / cols);
      const cy = (r + (rand() - 0.5) * 0.25) * (size / rows);
      const rad = 12 + rand() * 8;
      const g = bumpCtx.createRadialGradient(cx, cy, 1, cx, cy, rad);
      g.addColorStop(0, 'rgba(62,62,62,0.52)');
      g.addColorStop(0.7, 'rgba(135,135,135,0.22)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      bumpCtx.fillStyle = g;
      bumpCtx.beginPath();
      bumpCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      bumpCtx.fill();

      const cg = colCtx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, rad);
      cg.addColorStop(0, 'rgba(218,218,215,0.16)');
      cg.addColorStop(0.75, 'rgba(110,106,98,0.10)');
      cg.addColorStop(1, 'rgba(150,150,150,0)');
      colCtx.fillStyle = cg;
      colCtx.beginPath();
      colCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      colCtx.fill();
    }
  }

  // Spun lathe circular sheen lines + scorch darkening near bottom
  for (let y = 0; y < size; y += 2) {
    colCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(40,38,35,0.04)';
    colCtx.fillRect(0, y, size, 1);
  }
  const scorch = colCtx.createLinearGradient(0, size * 0.55, 0, size);
  scorch.addColorStop(0, 'rgba(80,62,40,0)');
  scorch.addColorStop(1, 'rgba(54,42,28,0.45)');
  colCtx.fillStyle = scorch;
  colCtx.fillRect(0, size * 0.55, size, size * 0.45);

  return {
    map: finalizeTex(colC, { repeatX: 2, repeatY: 1, srgb: true }),
    roughnessMap: finalizeTex(roughC, { repeatX: 2, repeatY: 1, srgb: false }),
    bumpMap: finalizeTex(bumpC, { repeatX: 2, repeatY: 1, srgb: false }),
  };
}

/**
 * Woven bamboo zaru texture with real drainage holes (albedo + bump + alpha)
 */
export function createBambooZaruTextures() {
  const size = 512;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const alphaC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const bumpCtx = bumpC.getContext('2d');
  const alphaCtx = alphaC.getContext('2d');
  const rand = mulberry32(6601);

  // Gaps between bamboo strips are semi-transparent / dark holes
  colCtx.fillStyle = '#241a0d';
  colCtx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = '#080808';
  bumpCtx.fillRect(0, 0, size, size);
  alphaCtx.fillStyle = '#262626';
  alphaCtx.fillRect(0, 0, size, size);

  const strips = 16;
  const step = size / strips;
  const stripW = step * 0.80;

  for (let i = 0; i < strips; i++) {
    for (let j = 0; j < strips; j++) {
      const horizOnTop = (i + j) % 2 === 0;
      const x = j * step;
      const y = i * step;

      const drawStrip = (isHoriz, shadowAmt) => {
        const tone = 0.86 + rand() * 0.24;
        const r = Math.floor(146 * tone * shadowAmt);
        const g = Math.floor(112 * tone * shadowAmt);
        const b = Math.floor(62 * tone * shadowAmt);

        if (isHoriz) {
          const sy = y + (step - stripW) * 0.5;
          const grad = colCtx.createLinearGradient(x, sy, x, sy + stripW);
          grad.addColorStop(0, `rgb(${Math.floor(r * 0.72)},${Math.floor(g * 0.72)},${Math.floor(b * 0.72)})`);
          grad.addColorStop(0.5, `rgb(${r},${g},${b})`);
          grad.addColorStop(1, `rgb(${Math.floor(r * 0.68)},${Math.floor(g * 0.68)},${Math.floor(b * 0.68)})`);
          colCtx.fillStyle = grad;
          colCtx.fillRect(x, sy, step + 1, stripW);

          bumpCtx.fillStyle = shadowAmt > 0.9 ? '#e8e8e8' : '#8a8a8a';
          bumpCtx.fillRect(x, sy + 1, step + 1, stripW - 2);

          alphaCtx.fillStyle = '#ffffff';
          alphaCtx.fillRect(x, sy, step + 1, stripW);
        } else {
          const sx = x + (step - stripW) * 0.5;
          const grad = colCtx.createLinearGradient(sx, y, sx + stripW, y);
          grad.addColorStop(0, `rgb(${Math.floor(r * 0.72)},${Math.floor(g * 0.72)},${Math.floor(b * 0.72)})`);
          grad.addColorStop(0.5, `rgb(${r},${g},${b})`);
          grad.addColorStop(1, `rgb(${Math.floor(r * 0.68)},${Math.floor(g * 0.68)},${Math.floor(b * 0.68)})`);
          colCtx.fillStyle = grad;
          colCtx.fillRect(sx, y, stripW, step + 1);

          bumpCtx.fillStyle = shadowAmt > 0.9 ? '#e8e8e8' : '#8a8a8a';
          bumpCtx.fillRect(sx + 1, y, stripW - 2, step + 1);

          alphaCtx.fillStyle = '#ffffff';
          alphaCtx.fillRect(sx, y, stripW, step + 1);
        }
      };

      if (horizOnTop) {
        drawStrip(false, 0.70);
        drawStrip(true, 1.0);
      } else {
        drawStrip(true, 0.70);
        drawStrip(false, 1.0);
      }
    }
  }

  return {
    map: finalizeTex(colC, { repeatX: 3, repeatY: 2, srgb: true }),
    bumpMap: finalizeTex(bumpC, { repeatX: 3, repeatY: 2, srgb: false }),
    alphaMap: finalizeTex(alphaC, { repeatX: 3, repeatY: 2, srgb: false }),
  };
}

/**
 * Showa ceramic donburi bowl textures (hand-thrown iron-flecked stoneware + indigo brush bands + hidden bottom emblem)
 */
export function createDonburiTextures() {
  const size = 512;
  const colC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const roughCtx = roughC.getContext('2d');
  const bumpCtx = bumpC.getContext('2d');
  const rand = mulberry32(7701);

  // UV v=0 is bottom center, v=0.5 is rim, v=1.0 is outer bottom (we map LatheGeometry accordingly)
  // Let's make a dedicated texture for inside+outside where v=0..0.52 is inner, v=0.52..1 is outer
  const grad = colCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#ddd6c5');   // inner bottom warm stoneware cream
  grad.addColorStop(0.46, '#e2dac9');  // inner wall
  grad.addColorStop(0.51, '#5d4a3a');  // rusty brown glazed rim edge (口紅/鉄釉)
  grad.addColorStop(0.56, '#27313d');  // dark indigo Showa exterior glaze
  grad.addColorStop(0.88, '#1f2630');  // deep cobalt-charcoal lower exterior
  grad.addColorStop(1.0, '#6a5f53');   // unglazed stoneware foot ring
  colCtx.fillStyle = grad;
  colCtx.fillRect(0, 0, size, size);

  // Classic indigo brush lines (呉須の線) along inner upper wall & outer body
  const drawBrushBand = (yPos, thickness, color) => {
    colCtx.strokeStyle = color;
    colCtx.lineWidth = thickness;
    colCtx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const wobble = Math.sin(x * 0.045) * 1.4 + (rand() - 0.5) * 1.3;
      if (x === 0) colCtx.moveTo(x, yPos + wobble);
      else colCtx.lineTo(x, yPos + wobble);
    }
    colCtx.stroke();
  };
  drawBrushBand(size * 0.42, 6, 'rgba(34, 58, 96, 0.85)');
  drawBrushBand(size * 0.455, 2.8, 'rgba(34, 58, 96, 0.72)');
  drawBrushBand(size * 0.62, 5, 'rgba(130, 150, 172, 0.25)');
  drawBrushBand(size * 0.70, 3, 'rgba(130, 150, 172, 0.20)');

  // Subtle vertical hand-painted tokusa / brushwork on exterior
  colCtx.strokeStyle = 'rgba(165, 175, 185, 0.14)';
  for (let x = 0; x < size; x += 14) {
    colCtx.lineWidth = 1.6 + rand() * 1.2;
    colCtx.beginPath();
    colCtx.moveTo(x, size * 0.55);
    colCtx.lineTo(x + (rand() - 0.5) * 3, size * 0.90);
    colCtx.stroke();
  }

  // Iron flecks (鉄粉) typical of real Japanese stoneware
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 0.5 + rand() * 1.4;
    colCtx.fillStyle = y < size * 0.5 ? 'rgba(68, 52, 38, 0.28)' : 'rgba(18, 16, 15, 0.35)';
    colCtx.beginPath();
    colCtx.arc(x, y, rad, 0, Math.PI * 2);
    colCtx.fill();
  }

  // Roughness: glossy glaze (0.14–0.22), matte unglazed foot (0.85)
  const rGrad = roughCtx.createLinearGradient(0, 0, 0, size);
  rGrad.addColorStop(0, '#2c2c2c');
  rGrad.addColorStop(0.5, '#343434');
  rGrad.addColorStop(0.9, '#3a3a3a');
  rGrad.addColorStop(0.95, '#d8d8d8');
  roughCtx.fillStyle = rGrad;
  roughCtx.fillRect(0, 0, size, size);

  // Fine lathe wheel-throwing horizontal rings in bump map
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 3) {
    const v = 118 + Math.floor(Math.sin(y * 0.45) * 14 + (rand() - 0.5) * 8);
    bumpCtx.fillStyle = `rgb(${v},${v},${v})`;
    bumpCtx.fillRect(0, y, size, 2);
  }

  // Dedicated bottom medallion texture (revealed when finishing the bowl!)
  const medC = makeCanvas(256, 256);
  const mCtx = medC.getContext('2d');
  mCtx.fillStyle = '#ddd6c5';
  mCtx.fillRect(0, 0, 256, 256);
  // Subtle ceramic speckles
  for (let i = 0; i < 180; i++) {
    mCtx.fillStyle = 'rgba(72, 56, 40, 0.22)';
    mCtx.beginPath();
    mCtx.arc(rand() * 256, rand() * 256, 0.7 + rand() * 1.1, 0, Math.PI * 2);
    mCtx.fill();
  }
  // Vintage hand-painted Showa cobalt + vermilion swirl & blossom medallion (zero text!)
  mCtx.save();
  mCtx.translate(128, 128);
  mCtx.strokeStyle = 'rgba(34, 58, 96, 0.85)';
  mCtx.lineWidth = 7;
  mCtx.beginPath();
  mCtx.arc(0, 0, 96, 0, Math.PI * 2);
  mCtx.stroke();
  mCtx.lineWidth = 3;
  mCtx.beginPath();
  mCtx.arc(0, 0, 82, 0, Math.PI * 2);
  mCtx.stroke();

  // Traditional red plum / flower crest + spiral center
  mCtx.fillStyle = 'rgba(176, 56, 42, 0.82)';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    mCtx.beginPath();
    mCtx.arc(Math.cos(a) * 34, Math.sin(a) * 34, 21, 0, Math.PI * 2);
    mCtx.fill();
  }
  mCtx.fillStyle = '#ddd6c5';
  mCtx.beginPath();
  mCtx.arc(0, 0, 15, 0, Math.PI * 2);
  mCtx.fill();
  mCtx.fillStyle = 'rgba(202, 154, 62, 0.88)';
  mCtx.beginPath();
  mCtx.arc(0, 0, 8, 0, Math.PI * 2);
  mCtx.fill();

  // Indigo wave accents around outer ring
  mCtx.strokeStyle = 'rgba(34, 58, 96, 0.70)';
  mCtx.lineWidth = 3.5;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    mCtx.beginPath();
    mCtx.arc(Math.cos(a) * 66, Math.sin(a) * 66, 9, a + 0.5, a + 2.6);
    mCtx.stroke();
  }
  mCtx.restore();

  return {
    map: finalizeTex(colC, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: finalizeTex(roughC, { repeatX: 1, repeatY: 1, srgb: false, wrap: THREE.ClampToEdgeWrapping }),
    bumpMap: finalizeTex(bumpC, { repeatX: 1, repeatY: 1, srgb: false, wrap: THREE.ClampToEdgeWrapping }),
    medallionMap: finalizeTex(medC, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping }),
  };
}

/**
 * Vintage Showa woven cotton kitchen dishcloth (ふきん - muted indigo stripes on unbleached cotton)
 */
export function createFukinClothTexture() {
  const size = 256;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const rand = mulberry32(8801);

  ctx.fillStyle = '#c8beaa';
  ctx.fillRect(0, 0, size, size);

  // Subtle woven linen grid
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(90,82,68,0.09)' : 'rgba(255,250,240,0.07)';
    ctx.fillRect(0, y, size, 1.5);
  }
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? 'rgba(90,82,68,0.08)' : 'rgba(255,250,240,0.06)';
    ctx.fillRect(x, 0, 1.5, size);
  }

  // Traditional indigo stripes along edges
  ctx.fillStyle = 'rgba(42, 58, 86, 0.72)';
  ctx.fillRect(22, 0, 10, size);
  ctx.fillRect(38, 0, 4, size);
  ctx.fillRect(size - 32, 0, 10, size);
  ctx.fillRect(size - 42, 0, 4, size);

  // Slight dampness darkening
  const damp = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  damp.addColorStop(0, 'rgba(65, 58, 45, 0.18)');
  damp.addColorStop(1, 'rgba(65, 58, 45, 0)');
  ctx.fillStyle = damp;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 3) {
    for (let x = 0; x < size; x += 3) {
      const v = ((x + y) % 6 === 0 ? 155 : 105) + Math.floor((rand() - 0.5) * 16);
      bCtx.fillStyle = `rgb(${v},${v},${v})`;
      bCtx.fillRect(x, y, 2, 2);
    }
  }

  return {
    map: finalizeTex(colC, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    bumpMap: finalizeTex(bumpC, { srgb: false, wrap: THREE.ClampToEdgeWrapping }),
  };
}

/**
 * Sliced Japanese green onion (刻みねぎ) cross-section ring texture
 */
export function createNegiTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;

  // Outer lush dark green leaf wall
  ctx.fillStyle = '#2d6a2e';
  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.fill();

  // Mid bright spring green inner flesh
  ctx.fillStyle = '#5da143';
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();

  // Crisp pale yellow-white inner layer
  ctx.fillStyle = '#d6e3be';
  ctx.beginPath();
  ctx.arc(cx, cy, 37, 0, Math.PI * 2);
  ctx.fill();

  // Inner faint green ring
  ctx.strokeStyle = '#6da84e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 29, 0, Math.PI * 2);
  ctx.stroke();

  // Hollow dark center
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 1, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  return finalizeTex(c, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Crispy fried tenkasu batter bump/albedo
 */
export function createTenkasuTextures() {
  const size = 128;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const { fbm } = createNoise2D(9102);

  const cImg = ctx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 9, (y / size) * 9, 4);
      const crisp = Math.pow(n, 1.35);
      const idx = (y * size + x) * 4;
      // Golden fried tempura batter tones
      cImg.data[idx] = Math.min(255, 175 + crisp * 75);
      cImg.data[idx + 1] = Math.min(255, 122 + crisp * 78);
      cImg.data[idx + 2] = Math.min(255, 48 + crisp * 54);
      cImg.data[idx + 3] = 255;

      const bv = Math.floor(crisp * 255);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return {
    map: finalizeTex(colC, { srgb: true }),
    bumpMap: finalizeTex(bumpC, { srgb: false }),
  };
}

/**
 * Cozy Showa winter ribbed wool sweater texture for the wrist sleeve
 */
export function createWinterKnitTextures() {
  const size = 256;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const rand = mulberry32(4123);

  // Cozy deep Showa winter slate-charcoal / dark indigo-brown ribbed wool sweater
  ctx.fillStyle = '#332d2b';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const ribs = 18;
  const rw = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * rw;
    const g = ctx.createLinearGradient(x, 0, x + rw, 0);
    g.addColorStop(0, '#1d1a19');
    g.addColorStop(0.35, '#3f3734');
    g.addColorStop(0.55, '#4c423e');
    g.addColorStop(1, '#1a1716');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rw, size);

    const bg = bCtx.createLinearGradient(x, 0, x + rw, 0);
    bg.addColorStop(0, '#242424');
    bg.addColorStop(0.5, '#e8e8e8');
    bg.addColorStop(1, '#242424');
    bCtx.fillStyle = bg;
    bCtx.fillRect(x, 0, rw, size);

    // Subtle knit stitch V-chevrons
    ctx.strokeStyle = 'rgba(185, 170, 155, 0.11)';
    bCtx.strokeStyle = 'rgba(240, 240, 240, 0.24)';
    ctx.lineWidth = 1.4;
    bCtx.lineWidth = 1.4;
    for (let y = 0; y < size; y += 8) {
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + rw * 0.5, y + 5);
      ctx.lineTo(x + rw - 2, y);
      ctx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(x + 2, y);
      bCtx.lineTo(x + rw * 0.5, y + 5);
      bCtx.lineTo(x + rw - 2, y);
      bCtx.stroke();
    }
  }
  // Fuzzy wool flecks
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(155,142,130,0.10)' : 'rgba(14,12,12,0.16)';
    ctx.fillRect(rand() * size, rand() * size, 2, 1.5);
  }

  return {
    map: finalizeTex(colC, { repeatX: 2, repeatY: 2, srgb: true }),
    bumpMap: finalizeTex(bumpC, { repeatX: 2, repeatY: 2, srgb: false }),
  };
}

/**
 * Wispy organic billowing steam sprite texture (delicate curling tendrils & negative space, never solid fog)
 */
export function createSteamSpriteTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const { fbm } = createNoise2D(12345);
  const { fbm: fbmW } = createNoise2D(54321);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const radial = Math.max(0, 1 - dist);
      const softMask = Math.pow(radial, 2.2);

      // Strong domain-warped curling steam tendrils with crisp airy gaps
      const wx = (fbmW(nx * 2.2 + 3.1, ny * 2.2 + 1.4, 4) - 0.5) * 1.45;
      const wy = (fbmW(nx * 2.2 + 8.3, ny * 2.2 + 5.9, 4) - 0.5) * 1.45;
      const cloud = fbm((nx + wx) * 2.8 + 4.0, (ny + wy) * 2.8 + 4.0, 5);
      const ridge = 1.0 - Math.abs(fbm((nx - wx * 0.7) * 3.6 + 1.2, (ny + wy * 0.7) * 3.6 + 6.4, 4) * 2.0 - 1.0);
      const tendril = Math.pow(Math.max(0, ridge - 0.32) / 0.68, 1.5);
      const wisp = Math.max(0, Math.min(1, (cloud * 0.45 + tendril * 0.78 - 0.34) * 1.85));

      const alpha = Math.floor(softMask * wisp * 215);
      const idx = (y * size + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 249;
      img.data[idx + 2] = 240;
      img.data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finalizeTex(c, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Natural human skin micro-texture with realistic dorsal hand anatomy shading
 * (subtle knuckle rosy blush, warm flesh pores, gentle side & wrist contour falloff).
 * Calibrated for warm tungsten bare-bulb lighting so skin looks photographic, never orange or flat!
 */
export function createSkinTextures() {
  const size = 256;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const { fbm } = createNoise2D(7123);
  const { noise } = createNoise2D(7129);

  const cImg = ctx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const blotch = fbm(u * 6.0, v * 6.0, 4);
      const pore = noise(u * 60, v * 60);
      const subTint = fbm(u * 3.5 + 4.2, v * 3.5 + 1.9, 3);
      const fineLine = Math.pow(Math.abs(Math.sin((v * 18 + u * 2.2 + blotch * 1.4) * Math.PI)), 24) * 10;

      // Subtle anatomical shading across hand dorsum (planar UV: u=0.5 center, v=0.15 knuckles, v=0.85 wrist)
      const edgeDist = Math.abs(u - 0.5) * 2.0;
      const sideShade = 1.0 - Math.pow(Math.min(1.0, edgeDist), 2.2) * 0.14;
      // Soft rosy-warm knuckle band near top of dorsum (v ~ 0.15..0.32)
      const knuckleBand = Math.exp(-Math.pow((v - 0.22) / 0.14, 2.0)) * (1.0 - edgeDist * 0.5);
      // Faint cool-blue subcutaneous vein whisper on back of hand
      const veinWave = Math.sin(u * 14.0 + fbm(u * 4.0, v * 4.0, 3) * 3.2);
      const vein = Math.pow(Math.max(0, 1.0 - Math.abs(veinWave)), 14.0) * Math.exp(-Math.pow((v - 0.52) / 0.26, 2.0)) * 0.08;

      const idx = (y * size + x) * 4;
      let r = (194 + (blotch - 0.5) * 16 + (subTint - 0.5) * 10 + knuckleBand * 14 - pore * 5 - fineLine - vein * 18) * sideShade;
      let g = (158 + (blotch - 0.5) * 14 + (subTint - 0.5) * 6 - knuckleBand * 5 - pore * 5 - fineLine * 0.9 - vein * 6) * sideShade;
      let b = (139 + (blotch - 0.5) * 13 - knuckleBand * 6 - pore * 4 - fineLine * 0.8 + vein * 10) * sideShade;

      cImg.data[idx] = Math.min(255, Math.max(0, r));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, g));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, b));
      cImg.data[idx + 3] = 255;

      const bv = Math.floor(Math.max(0, Math.min(255, 126 + pore * 26 + (blotch - 0.5) * 16 - fineLine * 2.4)));
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  return {
    map: finalizeTex(colC, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    bumpMap: finalizeTex(bumpC, { repeatX: 1, repeatY: 1, srgb: false, wrap: THREE.ClampToEdgeWrapping }),
  };
}

/**
 * Delicate scattered wheat flour dusting (打ち粉) for the raw udon cedar plate
 */
export function createFlourDustTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const { fbm } = createNoise2D(6061);
  const { noise } = createNoise2D(6067);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const mask = Math.pow(Math.max(0, 1 - dist), 1.9);
      const patch = fbm(nx * 3.8 + 2.1, ny * 3.8 + 4.3, 4);
      const specks = Math.pow(noise(nx * 28 + 1, ny * 28 + 3), 3.0);
      const dust = Math.max(0, (patch - 0.44) * 1.55) + specks * 0.55;
      const a = Math.floor(Math.min(1, mask * dust) * 185);
      const idx = (y * size + x) * 4;
      img.data[idx] = 242;
      img.data[idx + 1] = 236;
      img.data[idx + 2] = 222;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finalizeTex(c, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Subtle handmade Sanuki udon dough grain & wet stretch texture
 */
export function createUdonTextures() {
  const size = 256;
  const colC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const { fbm } = createNoise2D(8191);
  const cImg = ctx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const stretch = fbm(u * 24, v * 4, 3);
      const wheat = fbm(u * 9 + 2, v * 9 + 5, 3);
      const idx = (y * size + x) * 4;
      // Creamy wheat-ivory udon color (not dead sterile white)
      cImg.data[idx] = Math.min(255, 224 + stretch * 16 + (wheat - 0.5) * 12);
      cImg.data[idx + 1] = Math.min(255, 212 + stretch * 15 + (wheat - 0.5) * 12);
      cImg.data[idx + 2] = Math.min(255, 184 + stretch * 14 + (wheat - 0.5) * 10);
      cImg.data[idx + 3] = 255;

      const bv = Math.floor(105 + stretch * 48);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  return {
    map: finalizeTex(colC, { repeatX: 4, repeatY: 1, srgb: true }),
    bumpMap: finalizeTex(bumpC, { repeatX: 4, repeatY: 1, srgb: false }),
  };
}

/**
 * Soft wet splash / puddle ring texture
 */
export function createSoftGlowTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finalizeTex(c, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Procedural Midwinter-Night Bare-Bulb Kitchen PMREM Environment Map.
 * Creates authentic single tungsten overhead bulb specular glints + cold winter night ambient rim.
 */
export function createShowaEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#090d14'); // Cold midwinter night interior base

  // Overhead warm bare incandescent bulb (high HDR emissive for sharp glints on wet noodles & ceramic)
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9.0, 6.2, 3.0) });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), bulbMat);
  bulb.position.set(-0.3, 6.0, -0.4);
  envScene.add(bulb);

  // Soft warm ceiling bounce halo around the bare bulb
  const ceilingHaloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 0.92, 0.45), side: THREE.DoubleSide });
  const ceilingHalo = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), ceilingHaloMat);
  ceilingHalo.position.set(-0.3, 6.8, -0.4);
  ceilingHalo.rotation.x = Math.PI / 2;
  envScene.add(ceilingHalo);

  // Faint cold frosted winter-night window reflection far off to the upper-left
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.40, 0.62), side: THREE.DoubleSide });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.2), windowMat);
  win.position.set(-6.5, 3.4, -5.5);
  win.lookAt(0, 0, 0);
  envScene.add(win);

  // Subtle warm timber bounce from lower surroundings
  const bounceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.14, 0.08), side: THREE.DoubleSide });
  const bounce = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), bounceMat);
  bounce.position.set(0, -4.5, 0);
  bounce.rotation.x = -Math.PI / 2;
  envScene.add(bounce);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}
