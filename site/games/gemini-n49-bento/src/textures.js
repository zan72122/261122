import * as THREE from '../lib/three.module.js';

// Deterministic seeded PRNG + 2D smooth value noise / fBM for photorealistic procedural PBR maps (all <= 1024px)
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

function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  const sample = (x, y) => {
    const xi = ((Math.floor(x) % size) + size) % size;
    const yi = ((Math.floor(y) % size) + size) % size;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const x1 = (xi + 1) % size;
    const y1 = (yi + 1) % size;
    const a = grid[yi * size + xi];
    const b = grid[yi * size + x1];
    const c = grid[y1 * size + xi];
    const d = grid[y1 * size + x1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };

  return (x, y, octaves = 4) => {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      val += sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.02;
    }
    return val / norm;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTex(canvas, isColor = true, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function heightToNormal(heightCanvas, strength = 2.4) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const ctx = heightCanvas.getContext('2d');
  const src = ctx.getImageData(0, 0, w, h).data;
  const outCanvas = makeCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const out = outCtx.createImageData(w, h);
  const dst = out.data;

  const getH = (x, y) => {
    const xx = ((x % w) + w) % w;
    const yy = ((y % h) + h) % h;
    return src[(yy * w + xx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = getH(x - 1, y);
      const hR = getH(x + 1, y);
      const hU = getH(x, y - 1);
      const hD = getH(x, y + 1);
      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * w + x) * 4;
      dst[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(out, 0, 0);
  return outCanvas;
}

export function createTextures() {
  const textures = {};

  // 1. Kitchen Counter Warm Walnut/Oak Wood (1024x1024)
  {
    const size = 1024;
    const fbm = makeNoise2D(101);
    const colC = makeCanvas(size, size);
    const roughC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const rCtx = roughC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Horizontal wood grain planks along X (natural kitchen counter orientation)
        const warp = fbm(u * 10, v * 3.2, 4) * 0.42;
        const ring = Math.sin((v * 14 + warp * 4.8) * Math.PI * 2) * 0.5 + 0.5;
        const fine = fbm(u * 10, v * 65, 3);
        const pore = fbm(u * 22, v * 140, 2);
        const plankIdx = Math.floor(v * 3);
        const plankGap = Math.abs(((v * 3) % 1) - 0.5) > 0.495 ? 0.42 : 1.0;
        const plankTint = 0.93 + (plankIdx % 2) * 0.09;

        const g = (ring * 0.42 + fine * 0.42 + pore * 0.16) * plankGap;
        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.min(255, Math.round((86 + g * 58) * plankTint));
        cImg.data[idx + 1] = Math.min(255, Math.round((58 + g * 44) * plankTint));
        cImg.data[idx + 2] = Math.min(255, Math.round((38 + g * 30) * plankTint));
        cImg.data[idx + 3] = 255;

        const rough = Math.round(138 + (1 - g) * 65 + (pore < 0.34 ? 32 : 0));
        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = Math.min(255, rough);
        rImg.data[idx + 3] = 255;

        const hv = Math.round((ring * 0.28 + fine * 0.48 + pore * 0.24) * 255 * plankGap);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.tableMap = toTex(colC, true, 1.8, 1.4);
    textures.tableRough = toTex(roughC, false, 1.8, 1.4);
    textures.tableNormal = toTex(heightToNormal(hC, 1.5), false, 1.8, 1.4);
  }

  // 2. Hinoki / Akita Cedar Magewappa Bento Wood (512x512) — straight fine vertical sugi grain!
  {
    const size = 512;
    const fbm = makeNoise2D(202);
    const colC = makeCanvas(size, size);
    const roughC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const rCtx = roughC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Authentic Akita-sugi masame (straight fine vertical cedar grain)
        const subtleDrift = fbm(u * 2.5, v * 1.8, 3) * 0.45;
        const grain = Math.sin((u * 34 + subtleDrift) * Math.PI * 2) * 0.5 + 0.5;
        const fineGrain = Math.sin((u * 96 + subtleDrift * 1.6) * Math.PI * 2) * 0.5 + 0.5;
        const fiber = fbm(u * 85, v * 6, 3);
        const mix = grain * 0.45 + fineGrain * 0.25 + fiber * 0.3;

        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.round(198 + mix * 42);
        cImg.data[idx + 1] = Math.round(156 + mix * 44);
        cImg.data[idx + 2] = Math.round(108 + mix * 36);
        cImg.data[idx + 3] = 255;

        const rv = Math.round(155 + (1 - mix) * 58);
        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        const hv = Math.round((grain * 0.35 + fineGrain * 0.25 + fiber * 0.4) * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.cedarMap = toTex(colC, true);
    textures.cedarRough = toTex(roughC, false);
    textures.cedarNormal = toTex(heightToNormal(hC, 1.15), false);
  }

  // 3. KARAAGE Crispy Fried Batter PBR (512x512) — bubbly crispy blistered golden batter + pale katakuriko starch dust + sizzling oil highlights!
  {
    const size = 512;
    const rand = mulberry32(311);
    const fbm = makeNoise2D(303);
    const fineNoise = makeNoise2D(307);
    const colC = makeCanvas(size, size);
    const roughC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const rCtx = roughC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const macro = fbm(u * 7, v * 7, 4);
        const blister = fbm(u * 22 + macro * 1.1, v * 22 - macro * 1.1, 4);
        const micro = fineNoise(u * 64, v * 64, 3);
        // Ridged crispy flake height
        const flake = 1 - Math.abs(blister * 2 - 1);
        const h = Math.pow(Math.max(0, blister * 0.48 + flake * 0.3 + micro * 0.22), 1.18);

        // Rich Japanese soy-ginger karaage palette: deep caramelized amber crevices -> juicy golden fried crust -> pale crispy potato-starch crunch speckles
        let r, g, b;
        if (h < 0.34) {
          const t = h / 0.34;
          r = 104 + t * 72;
          g = 48 + t * 50;
          b = 18 + t * 20;
        } else if (h < 0.74) {
          const t = (h - 0.34) / 0.4;
          r = 176 + t * 48;
          g = 98 + t * 56;
          b = 38 + t * 26;
        } else {
          const t = (h - 0.74) / 0.26;
          r = 224 + t * 22;
          g = 154 + t * 48;
          b = 64 + t * 62;
        }

        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.min(255, Math.round(r));
        cImg.data[idx + 1] = Math.min(255, Math.round(g));
        cImg.data[idx + 2] = Math.min(255, Math.round(b));
        cImg.data[idx + 3] = 255;

        // Oily crispy mid-ridges have low roughness (glistening hot oil!), valleys & flour flecks are crisp-matte
        const rough = h > 0.8 ? 205 : Math.round(78 + (1 - h) * 145);
        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = Math.min(255, rough);
        rImg.data[idx + 3] = 255;

        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = Math.min(255, Math.round(h * 255));
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);

    // Paint hundreds of tiny crispy fried batter bubbles & pale katakuriko crunch crumbs on top!
    for (let i = 0; i < 650; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rad = 2.2 + rand() * 5.8;
      const isPaleStarch = rand() > 0.72;
      const grad = cCtx.createRadialGradient(cx - rad * 0.25, cy - rad * 0.25, rad * 0.1, cx, cy, rad);
      if (isPaleStarch) {
        grad.addColorStop(0, 'rgba(246, 212, 148, 0.72)');
        grad.addColorStop(0.7, 'rgba(214, 146, 72, 0.35)');
        grad.addColorStop(1, 'rgba(130, 68, 26, 0.0)');
      } else {
        grad.addColorStop(0, 'rgba(228, 152, 62, 0.65)');
        grad.addColorStop(0.65, 'rgba(168, 86, 30, 0.38)');
        grad.addColorStop(1, 'rgba(92, 40, 14, 0.0)');
      }
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      cCtx.fill();

      const hg = hCtx.createRadialGradient(cx, cy, 0.5, cx, cy, rad);
      hg.addColorStop(0, 'rgba(255,255,255,0.82)');
      hg.addColorStop(1, 'rgba(128,128,128,0.0)');
      hCtx.fillStyle = hg;
      hCtx.beginPath();
      hCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      hCtx.fill();
    }

    textures.karaageMap = toTex(colC, true);
    textures.karaageRough = toTex(roughC, false);
    textures.karaageNormal = toTex(heightToNormal(hC, 4.4), false);
    textures.karaageBump = toTex(hC, false);
  }

  // 4. TAMAGOYAKI Cut Face (delicate moist golden dashimaki layers — natural soft seams, NOT cartoon rings!) & Outer Seared Skin
  {
    const size = 512;
    const fbm = makeNoise2D(404);
    const poreNoise = makeNoise2D(409);

    const cutC = makeCanvas(size, size);
    const cutHC = makeCanvas(size, size);
    const cutRC = makeCanvas(size, size);
    const cCtx = cutC.getContext('2d');
    const hCtx = cutHC.getContext('2d');
    const rCtx = cutRC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Authentic horizontal/oval folded omelette layers (subtle 3-4 soft golden-tan fold seams)
        const dx = (u - 0.5) * 1.15;
        const dy = (v - 0.5) * 1.65;
        const warp = (fbm(u * 4.5, v * 4.5, 3) - 0.5) * 0.16;
        // Rounded-rectangle distance for folded pan layers
        const dist = Math.pow(Math.pow(Math.abs(dx), 2.8) + Math.pow(Math.abs(dy), 2.4), 1 / 2.6) + warp;
        const layerWave = Math.sin(dist * 4.6 * Math.PI * 2);
        // Very subtle, warm caramel-amber fold seam (not harsh dark lines!)
        const seam = Math.pow(Math.max(0, -layerWave), 8.0) * (0.45 + fbm(u * 14, v * 14, 2) * 0.55);
        const micro = poreNoise(u * 68, v * 68, 3);
        const pore = micro < 0.18 ? (0.18 - micro) * 2.6 : 0;
        const cloud = fbm(u * 9, v * 9, 3);

        // Rich warm golden Japanese free-range egg yolk interior (stays warm & appetizing even in cool dawn light!)
        let r = 254 - seam * 26 - pore * 20 + (cloud - 0.5) * 8;
        let g = 198 - seam * 46 - pore * 26 + (cloud - 0.5) * 10;
        let b = 46 - seam * 20 - pore * 14 + (cloud - 0.5) * 8;

        // Soft warm toasted outer rim blending into skin
        const edge = Math.max(0, (dist - 0.52) / 0.24);
        const edgeSear = edge * (0.65 + fbm(u * 10, v * 10, 2) * 0.5);
        r -= edgeSear * 38;
        g -= edgeSear * 68;
        b -= edgeSear * 24;

        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        cImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        cImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        cImg.data[idx + 3] = 255;

        const hv = Math.max(0, Math.min(255, Math.round((0.76 - seam * 0.32 - pore * 0.35 + cloud * 0.1) * 255)));
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;

        // Juicy dashi-maki sheen
        const rv = Math.max(0, Math.min(255, Math.round(78 + seam * 40 + pore * 75)));
        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    textures.tamagoCutMap = toTex(cutC, true);
    textures.tamagoCutNormal = toTex(heightToNormal(cutHC, 1.5), false);
    textures.tamagoCutRough = toTex(cutRC, false);

    // Outer seared golden-brown tamagoyaki crust
    const skinC = makeCanvas(size, size);
    const skinHC = makeCanvas(size, size);
    const scCtx = skinC.getContext('2d');
    const shCtx = skinHC.getContext('2d');
    const scImg = scCtx.createImageData(size, size);
    const shImg = shCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const sear = fbm(u * 5.2, v * 4.5, 4);
        const mottling = poreNoise(u * 26, v * 26, 3);
        const brown = Math.pow(Math.max(0, sear - 0.36) / 0.64, 1.35);
        const r = 248 - brown * 66 + (mottling - 0.5) * 12;
        const g = 196 - brown * 96 + (mottling - 0.5) * 12;
        const b = 52 - brown * 28;
        const idx = (y * size + x) * 4;
        scImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        scImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        scImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        scImg.data[idx + 3] = 255;

        const hv = Math.round((0.5 + mottling * 0.3 + sear * 0.15) * 255);
        shImg.data[idx] = shImg.data[idx + 1] = shImg.data[idx + 2] = hv;
        shImg.data[idx + 3] = 255;
      }
    }
    scCtx.putImageData(scImg, 0, 0);
    shCtx.putImageData(shImg, 0, 0);
    textures.tamagoSkinMap = toTex(skinC, true);
    textures.tamagoSkinNormal = toTex(heightToNormal(skinHC, 1.4), false);
  }

  // 5. BROCCOLI Ultra-Fine Micro-Bud Botanical Texture (512x512)
  {
    const size = 512;
    const rand = mulberry32(505);
    const fbm = makeNoise2D(509);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');

    cCtx.fillStyle = '#173c18';
    cCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#181818';
    hCtx.fillRect(0, 0, size, size);

    // 4200 ultra-fine overlapping botanical broccoli buds for jaw-dropping macro detail!
    for (let i = 0; i < 4200; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rad = 2.4 + rand() * 3.8;
      const n = fbm(cx / 130, cy / 130, 3);
      const rCol = Math.round(34 + n * 48 + rand() * 18);
      const gCol = Math.round(92 + n * 66 + rand() * 26);
      const bCol = Math.round(24 + n * 24 + rand() * 14);

      const drawBud = (ox, oy) => {
        const grad = cCtx.createRadialGradient(ox - rad * 0.25, oy - rad * 0.25, rad * 0.08, ox, oy, rad);
        grad.addColorStop(0, `rgb(${Math.min(255, rCol + 28)},${Math.min(255, gCol + 36)},${Math.min(255, bCol + 14)})`);
        grad.addColorStop(0.75, `rgb(${rCol},${gCol},${bCol})`);
        grad.addColorStop(1, `rgb(${Math.max(0, rCol - 24)},${Math.max(0, gCol - 40)},${Math.max(0, bCol - 14)})`);
        cCtx.fillStyle = grad;
        cCtx.beginPath();
        cCtx.arc(ox, oy, rad, 0, Math.PI * 2);
        cCtx.fill();

        const hGrad = hCtx.createRadialGradient(ox, oy, rad * 0.05, ox, oy, rad);
        hGrad.addColorStop(0, '#ffffff');
        hGrad.addColorStop(0.7, '#999999');
        hGrad.addColorStop(1, '#1a1a1a');
        hCtx.fillStyle = hGrad;
        hCtx.beginPath();
        hCtx.arc(ox, oy, rad, 0, Math.PI * 2);
        hCtx.fill();
      };

      drawBud(cx, cy);
      if (cx < rad) drawBud(cx + size, cy);
      if (cx > size - rad) drawBud(cx - size, cy);
      if (cy < rad) drawBud(cx, cy + size);
      if (cy > size - rad) drawBud(cx, cy - size);
    }

    textures.broccoliMap = toTex(colC, true);
    textures.broccoliNormal = toTex(heightToNormal(hC, 3.8), false);
    textures.broccoliBump = toTex(hC, false);
  }

  // 6. CHERRY TOMATO Glossy Ruby Skin (512x512)
  {
    const size = 512;
    const fbm = makeNoise2D(606);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const organic = fbm(u * 6, v * 6, 3);
        const speck = fbm(u * 80, v * 80, 2);
        const shoulder = Math.max(0, 1 - v * 4.8);
        // Deep ripe cherry tomato crimson with warm glowing translucent bottom & subtle golden micro-freckles
        const r = 192 + organic * 38 - shoulder * 18;
        const g = 18 + organic * 14 + shoulder * 36 + (speck > 0.8 ? 16 : 0);
        const b = 12 + organic * 8 + (speck > 0.8 ? 8 : 0);

        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        cImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        cImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        cImg.data[idx + 3] = 255;

        const hv = Math.round((0.5 + organic * 0.2 + speck * 0.08) * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.tomatoMap = toTex(colC, true);
    textures.tomatoNormal = toTex(heightToNormal(hC, 0.35), false);
  }

  // 7. NATURAL CRISP LEAF LETTUCE / SHISO BED (512x512) — veined botanical leaf texture (replaces shiny plastic green!)
  {
    const size = 512;
    const fbm = makeNoise2D(741);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const cx = Math.abs(u - 0.5) * 2; // distance from central midrib
        const crinkle = fbm(u * 14, v * 14, 4);
        const midrib = Math.exp(-cx * cx * 45) * (1 - v * 0.65);
        // Diagonal branching leaf veins
        const veinWave = Math.sin((v * 9.5 - cx * 4.2 + crinkle * 0.8) * Math.PI * 2);
        const veins = Math.pow(Math.max(0, veinWave), 12) * 0.45 * (1 - cx * 0.5);
        const rib = Math.min(1, midrib + veins);

        // Fresh Japanese leaf-lettuce green: lush mid-green leaf blade -> crisp pale yellow-green veins & curled rim
        const r = 74 + crinkle * 34 + rib * 82 + cx * 24;
        const g = 138 + crinkle * 36 + rib * 68 + cx * 18;
        const b = 46 + crinkle * 18 + rib * 42;

        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.min(255, Math.round(r));
        cImg.data[idx + 1] = Math.min(255, Math.round(g));
        cImg.data[idx + 2] = Math.min(255, Math.round(b));
        cImg.data[idx + 3] = 255;

        const hv = Math.min(255, Math.round((crinkle * 0.55 + rib * 0.45) * 255));
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.lettuceMap = toTex(colC, true);
    textures.lettuceNormal = toTex(heightToNormal(hC, 2.2), false);
  }

  // 8. WRINKLED PICKLED UMEBOSHI PLUM TEXTURE (256x256)
  {
    const size = 256;
    const fbm = makeNoise2D(777);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const w1 = fbm(u * 8, v * 8, 4);
        const crease = Math.abs(w1 * 2 - 1);
        const h = Math.pow(crease, 0.72);
        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.round(118 + h * 76);
        cImg.data[idx + 1] = Math.round(18 + h * 26);
        cImg.data[idx + 2] = Math.round(24 + h * 24);
        cImg.data[idx + 3] = 255;
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = Math.round(h * 255);
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.umeMap = toTex(colC, true);
    textures.umeNormal = toTex(heightToNormal(hC, 3.6), false);
  }

  // 9. STEAMED WHITE RICE BED (512x512) — hundreds of glistening plump koshihikari grains!
  {
    const size = 512;
    const rand = mulberry32(707);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const rC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const rCtx = rC.getContext('2d');

    cCtx.fillStyle = '#ddd7c9';
    cCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#202020';
    hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#888888';
    rCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2000; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const angle = rand() * Math.PI * 2;
      const rx = 9.5 + rand() * 4.8;
      const ry = 4.4 + rand() * 2.1;
      const shade = 236 + Math.floor(rand() * 19);

      const drawGrain = (ox, oy) => {
        cCtx.save();
        cCtx.translate(ox, oy);
        cCtx.rotate(angle);
        const grad = cCtx.createRadialGradient(-rx * 0.2, -ry * 0.2, 1, 0, 0, rx);
        grad.addColorStop(0, `rgb(${Math.min(255, shade + 8)},${Math.min(255, shade + 6)},${Math.min(255, shade + 2)})`);
        grad.addColorStop(0.75, `rgb(${shade},${shade - 3},${shade - 10})`);
        grad.addColorStop(1, `rgb(${shade - 40},${shade - 44},${shade - 52})`);
        cCtx.fillStyle = grad;
        cCtx.beginPath();
        cCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        cCtx.fill();
        cCtx.restore();

        hCtx.save();
        hCtx.translate(ox, oy);
        hCtx.rotate(angle);
        const hg = hCtx.createRadialGradient(0, 0, 1, 0, 0, rx);
        hg.addColorStop(0, '#ffffff');
        hg.addColorStop(0.72, '#a8a8a8');
        hg.addColorStop(1, '#262626');
        hCtx.fillStyle = hg;
        hCtx.beginPath();
        hCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        hCtx.fill();
        hCtx.restore();

        rCtx.save();
        rCtx.translate(ox, oy);
        rCtx.rotate(angle);
        const rg = rCtx.createRadialGradient(0, 0, 1, 0, 0, rx);
        rg.addColorStop(0, '#2a2a2a');
        rg.addColorStop(0.7, '#707070');
        rg.addColorStop(1, '#c0c0c0');
        rCtx.fillStyle = rg;
        rCtx.beginPath();
        rCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        rCtx.fill();
        rCtx.restore();
      };

      drawGrain(cx, cy);
      if (cx < rx * 1.2) drawGrain(cx + size, cy);
      if (cx > size - rx * 1.2) drawGrain(cx - size, cy);
      if (cy < rx * 1.2) drawGrain(cx, cy + size);
      if (cy > size - rx * 1.2) drawGrain(cx, cy - size);
    }

    textures.riceMap = toTex(colC, true, 1.5, 1.5);
    textures.riceNormal = toTex(heightToNormal(hC, 3.2), false, 1.5, 1.5);
    textures.riceRough = toTex(rC, false, 1.5, 1.5);
  }

  // 10. Glazed Speckled Stoneware Ceramic Dish (512x512)
  {
    const size = 512;
    const rand = mulberry32(808);
    const fbm = makeNoise2D(809);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n = fbm(u * 8, v * 8, 3);
        const glaze = 232 + (n - 0.5) * 18;
        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.round(glaze + 2);
        cImg.data[idx + 1] = Math.round(glaze - 2);
        cImg.data[idx + 2] = Math.round(glaze - 10);
        cImg.data[idx + 3] = 255;

        const hv = Math.round((0.5 + n * 0.22) * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);

    for (let i = 0; i < 420; i++) {
      const sx = rand() * size;
      const sy = rand() * size;
      const sr = 0.7 + rand() * 1.8;
      cCtx.fillStyle = `rgba(92, 74, 58, ${0.22 + rand() * 0.42})`;
      cCtx.beginPath();
      cCtx.arc(sx, sy, sr, 0, Math.PI * 2);
      cCtx.fill();
    }

    textures.ceramicMap = toTex(colC, true);
    textures.ceramicNormal = toTex(heightToNormal(hC, 0.7), false);
  }

  // 11. Furoshiki Woven Japanese Linen Cloth (512x512)
  {
    const size = 512;
    const fbm = makeNoise2D(909);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const warp = Math.sin(x * 1.45) * 0.5 + 0.5;
        const weft = Math.sin(y * 1.45) * 0.5 + 0.5;
        const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? warp * 0.7 + weft * 0.3 : weft * 0.7 + warp * 0.3;
        const slub = fbm(u * 22, v * 22, 3);

        const gx = Math.floor(u * 8) % 2;
        const gy = Math.floor(v * 8) % 2;
        const thinLineX = Math.abs(((u * 8) % 1) - 0.5) < 0.036;
        const thinLineY = Math.abs(((v * 8) % 1) - 0.5) < 0.036;

        let r = 240, g = 228, b = 212;
        if (gx === 1 && gy === 1) {
          r = 210; g = 104; b = 96;
        } else if (gx === 1 || gy === 1) {
          r = 228; g = 176; b = 164;
        }
        if (thinLineX || thinLineY) {
          r = r * 0.72 + 44 * 0.28;
          g = g * 0.72 + 64 * 0.28;
          b = b * 0.72 + 96 * 0.28;
        }

        const threadMod = 0.88 + weave * 0.16 + (slub - 0.5) * 0.08;
        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.min(255, Math.round(r * threadMod));
        cImg.data[idx + 1] = Math.min(255, Math.round(g * threadMod));
        cImg.data[idx + 2] = Math.min(255, Math.round(b * threadMod));
        cImg.data[idx + 3] = 255;

        const hv = Math.round((weave * 0.75 + slub * 0.25) * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.clothMap = toTex(colC, true, 1.5, 1.5);
    textures.clothNormal = toTex(heightToNormal(hC, 2.0), false, 1.5, 1.5);
  }

  // 11b. Natural Human Skin Micro-Texture (256x256) — warm realistic pores & subtle tone variation (no plastic balloon!)
  {
    const size = 256;
    const fbm = makeNoise2D(945);
    const pore = makeNoise2D(949);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const blotch = fbm(u * 6, v * 6, 3);
        const micro = pore(u * 48, v * 48, 2);
        const crease = Math.sin(u * 38 + blotch * 2.2) * 0.5 + 0.5;
        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.min(255, Math.round(226 + (blotch - 0.5) * 18 + (micro - 0.5) * 6));
        cImg.data[idx + 1] = Math.min(255, Math.round(176 + (blotch - 0.5) * 16 + (micro - 0.5) * 6));
        cImg.data[idx + 2] = Math.min(255, Math.round(145 + (blotch - 0.5) * 14 + (micro - 0.5) * 5));
        cImg.data[idx + 3] = 255;

        const hv = Math.round((0.5 + (micro - 0.5) * 0.25 + (crease - 0.5) * 0.12) * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.skinMap = toTex(colC, true, 2, 2);
    textures.skinNormal = toTex(heightToNormal(hC, 0.9), false, 2, 2);
  }

  // 11c. Woven Slate-Indigo Japanese Linen Kitchen Placemat (512x512)
  {
    const size = 512;
    const fbm = makeNoise2D(971);
    const colC = makeCanvas(size, size);
    const hC = makeCanvas(size, size);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const cImg = cCtx.createImageData(size, size);
    const hImg = hCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const warp = Math.sin(x * 1.6) * 0.5 + 0.5;
        const weft = Math.sin(y * 1.6) * 0.5 + 0.5;
        const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? warp * 0.72 + weft * 0.28 : weft * 0.72 + warp * 0.28;
        const slub = fbm(u * 16, v * 16, 3);
        const borderX = Math.min(u, 1 - u);
        const borderY = Math.min(v, 1 - v);
        const stitchLine =
          (borderX > 0.032 && borderX < 0.044) || (borderY > 0.042 && borderY < 0.056) ? 1.0 : 0.0;

        // Muted warm charcoal-taupe Japanese linen (makes pale cedar bento & red tomato POP!)
        let r = 82 + weave * 22 + (slub - 0.5) * 14;
        let g = 80 + weave * 22 + (slub - 0.5) * 14;
        let b = 78 + weave * 22 + (slub - 0.5) * 14;
        if (stitchLine > 0.5) {
          r += 34;
          g += 30;
          b += 24;
        }
        const idx = (y * size + x) * 4;
        cImg.data[idx] = Math.min(255, Math.round(r));
        cImg.data[idx + 1] = Math.min(255, Math.round(g));
        cImg.data[idx + 2] = Math.min(255, Math.round(b));
        cImg.data[idx + 3] = 255;

        const hv = Math.round((weave * 0.75 + slub * 0.25) * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    textures.matMap = toTex(colC, true);
    textures.matNormal = toTex(heightToNormal(hC, 2.2), false);
  }

  // 12. Soft Contact AO & Steam/Bokeh Sprite (256x256)
  {
    const aoC = makeCanvas(256, 256);
    const ctx = aoC.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 22, 128, 128, 124);
    g.addColorStop(0, 'rgba(12, 8, 5, 0.76)');
    g.addColorStop(0.55, 'rgba(12, 8, 5, 0.34)');
    g.addColorStop(1, 'rgba(12, 8, 5, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    textures.contactAO = toTex(aoC, true);

    const steamC = makeCanvas(256, 256);
    const sCtx = steamC.getContext('2d');
    const sg = sCtx.createRadialGradient(128, 128, 8, 128, 128, 120);
    sg.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    sg.addColorStop(0.45, 'rgba(248, 250, 255, 0.2)');
    sg.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    sCtx.fillStyle = sg;
    sCtx.fillRect(0, 0, 256, 256);
    textures.steamMap = toTex(steamC, true);
  }

  return textures;
}
