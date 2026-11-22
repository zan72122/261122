import * as THREE from 'three';

// Deterministic fast PRNG & value noise for procedural photorealistic studio maps (all <= 1024px)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed = 1337) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise2(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbmTile(u, v, baseFreq, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothNoise2(u * freq, v * freq, freq, seed + i * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function makeCanvasTexture(canvas, { srgb = false, repeat = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  } else {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createStudioTextures() {
  // 1. Honed Black Basalt Studio Tabletop (1024x1024)
  const slateSize = 1024;
  const slateCanvas = document.createElement('canvas');
  slateCanvas.width = slateCanvas.height = slateSize;
  const sCtx = slateCanvas.getContext('2d');
  const sImg = sCtx.createImageData(slateSize, slateSize);

  const slateRoughCanvas = document.createElement('canvas');
  slateRoughCanvas.width = slateRoughCanvas.height = slateSize;
  const srCtx = slateRoughCanvas.getContext('2d');
  const srImg = srCtx.createImageData(slateSize, slateSize);

  const slateBumpCanvas = document.createElement('canvas');
  slateBumpCanvas.width = slateBumpCanvas.height = slateSize;
  const sbCtx = slateBumpCanvas.getContext('2d');
  const sbImg = sbCtx.createImageData(slateSize, slateSize);

  for (let y = 0; y < slateSize; y++) {
    const v = y / slateSize;
    const ny = v * 2 - 1;
    for (let x = 0; x < slateSize; x++) {
      const u = x / slateSize;
      const nx = u * 2 - 1;
      const rad = Math.hypot(nx, ny);
      // Radial studio cyclorama falloff so tabletop melts seamlessly into pitch-black infinity backdrop!
      const studioFade = 1.0 - THREE.MathUtils.smoothstep(rad, 0.42, 0.96);

      const n1 = fbmTile(u, v, 6, 4, 101);
      const n2 = fbmTile(u + n1 * 0.08, v - n1 * 0.06, 20, 3, 211);
      const vein = Math.pow(1.0 - Math.abs(fbmTile(u * 1.2, v * 0.8, 5, 4, 307) * 2.0 - 1.0), 12.0);
      const micro = hash2(x, y, 409) * 0.05;

      const lum = (5.5 + n1 * 6.5 + n2 * 4.5 + vein * 11.0 + micro * 6.0) * studioFade + 1.5;
      const idx = (y * slateSize + x) * 4;
      sImg.data[idx] = Math.min(255, lum * 0.96);
      sImg.data[idx + 1] = Math.min(255, lum * 0.97);
      sImg.data[idx + 2] = Math.min(255, lum * 1.04);
      sImg.data[idx + 3] = 255;

      // Low-mid roughness in hero center catches lush warm rim-light reflection; outer edge goes matte black
      const wipe = fbmTile(u, v, 4, 3, 509);
      const centerRough = 46 + wipe * 48 + (1.0 - vein) * 14 - n2 * 16;
      const rough = Math.max(32, Math.min(248, THREE.MathUtils.lerp(245, centerRough, studioFade)));
      srImg.data[idx] = srImg.data[idx + 1] = srImg.data[idx + 2] = rough;
      srImg.data[idx + 3] = 255;

      const bump = Math.max(0, Math.min(255, 128 + ((n2 - 0.5) * 60 - vein * 26 + (micro - 0.025) * 140) * studioFade));
      sbImg.data[idx] = sbImg.data[idx + 1] = sbImg.data[idx + 2] = bump;
      sbImg.data[idx + 3] = 255;
    }
  }
  sCtx.putImageData(sImg, 0, 0);
  srCtx.putImageData(srImg, 0, 0);
  sbCtx.putImageData(sbImg, 0, 0);

  // 2. Custard Pudding Albedo with Madagascar Vanilla Bean Specks + Micro-Bump (1024x1024)
  const custSize = 1024;
  const custCanvas = document.createElement('canvas');
  custCanvas.width = custCanvas.height = custSize;
  const cCtx = custCanvas.getContext('2d');
  cCtx.fillStyle = '#f8d77e';
  cCtx.fillRect(0, 0, custSize, custSize);

  const custImg = cCtx.getImageData(0, 0, custSize, custSize);
  const custBumpCanvas = document.createElement('canvas');
  custBumpCanvas.width = custBumpCanvas.height = custSize;
  const cbCtx = custBumpCanvas.getContext('2d');
  const cbImg = cbCtx.createImageData(custSize, custSize);

  for (let y = 0; y < custSize; y++) {
    const v = y / custSize;
    for (let x = 0; x < custSize; x++) {
      const u = x / custSize;
      const silk = fbmTile(u, v, 16, 3, 701);
      const microPore = smoothNoise2(u * 128, v * 128, 128, 809);
      const poreIndent = microPore > 0.87 ? (microPore - 0.87) * 5.0 : 0.0;
      const idx = (y * custSize + x) * 4;
      const shade = 0.965 + silk * 0.055 - poreIndent * 0.05;
      custImg.data[idx] = Math.min(255, 250 * shade);
      custImg.data[idx + 1] = Math.min(255, 217 * shade);
      custImg.data[idx + 2] = Math.min(255, 132 * shade);
      custImg.data[idx + 3] = 255;

      const bVal = Math.max(0, Math.min(255, 136 + (silk - 0.5) * 22 - poreIndent * 95));
      cbImg.data[idx] = cbImg.data[idx + 1] = cbImg.data[idx + 2] = bVal;
      cbImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(custImg, 0, 0);
  cbCtx.putImageData(cbImg, 0, 0);

  // Scatter realistic delicate Madagascar vanilla bean specks suspended inside custard
  const rng = mulberry32(4401);
  for (let i = 0; i < 680; i++) {
    const px = rng() * custSize;
    const py = rng() * custSize;
    const r = 0.48 + rng() * 0.88;
    const alpha = 0.16 + rng() * 0.28;
    cCtx.save();
    cCtx.translate(px, py);
    cCtx.rotate(rng() * Math.PI);
    cCtx.scale(1.0 + rng() * 0.5, 0.78 + rng() * 0.3);
    cCtx.fillStyle = `rgba(52, 28, 10, ${alpha.toFixed(3)})`;
    cCtx.beginPath();
    cCtx.arc(0, 0, r, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();
  }

  // 3. Handcrafted Artisan Stoneware Plate (1024x1024 radial UV)
  // Center warm sand-ivory glaze so translucent amber caramel glows richly; dark iron-clay rim!
  const plateSize = 1024;
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = plateCanvas.height = plateSize;
  const pCtx = plateCanvas.getContext('2d');
  const pImg = pCtx.createImageData(plateSize, plateSize);

  const plateBumpCanvas = document.createElement('canvas');
  plateBumpCanvas.width = plateBumpCanvas.height = plateSize;
  const pbCtx = plateBumpCanvas.getContext('2d');
  const pbImg = pbCtx.createImageData(plateSize, plateSize);

  for (let y = 0; y < plateSize; y++) {
    const ny = (y / plateSize) * 2 - 1;
    for (let x = 0; x < plateSize; x++) {
      const nx = (x / plateSize) * 2 - 1;
      const rad = Math.sqrt(nx * nx + ny * ny);
      const ang = Math.atan2(ny, nx);
      const wheel = Math.sin(rad * 115 + fbmTile(x / plateSize, y / plateSize, 8, 2, 911) * 3.5) * 0.5 + 0.5;
      const glazeVar = fbmTile(x / plateSize, y / plateSize, 10, 4, 953);
      const speckle = hash2(x >> 1, y >> 1, 977);
      // Rim transition from ivory ceramic well -> toasted iron stoneware edge
      const rimMix = THREE.MathUtils.smoothstep(rad, 0.70, 0.95);
      let r = THREE.MathUtils.lerp(228, 38, rimMix);
      let g = THREE.MathUtils.lerp(218, 31, rimMix);
      let b = THREE.MathUtils.lerp(200, 27, rimMix);

      const tone = 0.94 + glazeVar * 0.09 + wheel * 0.025;
      r *= tone;
      g *= tone;
      b *= tone;

      if (speckle > 0.986) {
        r *= 0.42;
        g *= 0.36;
        b *= 0.32;
      }

      const idx = (y * plateSize + x) * 4;
      pImg.data[idx] = Math.min(255, r);
      pImg.data[idx + 1] = Math.min(255, g);
      pImg.data[idx + 2] = Math.min(255, b);
      pImg.data[idx + 3] = 255;

      const bump = 128 + wheel * 16 + (glazeVar - 0.5) * 24 + rimMix * (speckle - 0.5) * 38;
      pbImg.data[idx] = pbImg.data[idx + 1] = pbImg.data[idx + 2] = Math.max(0, Math.min(255, bump));
      pbImg.data[idx + 3] = 255;
    }
  }
  pCtx.putImageData(pImg, 0, 0);
  pbCtx.putImageData(pbImg, 0, 0);

  // 4. Brown Farm Eggshell Albedo + Calcified Pore Bump (512x512)
  const eggSize = 512;
  const eggCanvas = document.createElement('canvas');
  eggCanvas.width = eggCanvas.height = eggSize;
  const eCtx = eggCanvas.getContext('2d');
  eCtx.fillStyle = '#cf9166';
  eCtx.fillRect(0, 0, eggSize, eggSize);
  const eImg = eCtx.getImageData(0, 0, eggSize, eggSize);

  const eggBumpCanvas = document.createElement('canvas');
  eggBumpCanvas.width = eggBumpCanvas.height = eggSize;
  const ebCtx = eggBumpCanvas.getContext('2d');
  const ebImg = ebCtx.createImageData(eggSize, eggSize);

  for (let y = 0; y < eggSize; y++) {
    const v = y / eggSize;
    for (let x = 0; x < eggSize; x++) {
      const u = x / eggSize;
      const mottling = fbmTile(u, v, 8, 4, 1201);
      const pores = smoothNoise2(u * 140, v * 140, 140, 1231);
      const idx = (y * eggSize + x) * 4;
      const warmth = 0.92 + mottling * 0.14 - (pores > 0.8 ? 0.04 : 0);
      eImg.data[idx] = Math.min(255, 212 * warmth);
      eImg.data[idx + 1] = Math.min(255, 148 * warmth);
      eImg.data[idx + 2] = Math.min(255, 106 * warmth);
      eImg.data[idx + 3] = 255;

      const b = 132 + (pores - 0.5) * 46 + (mottling - 0.5) * 18;
      ebImg.data[idx] = ebImg.data[idx + 1] = ebImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      ebImg.data[idx + 3] = 255;
    }
  }
  eCtx.putImageData(eImg, 0, 0);
  ebCtx.putImageData(ebImg, 0, 0);
  // Add organic darker brown hen speckles
  for (let i = 0; i < 240; i++) {
    const px = rng() * eggSize;
    const py = rng() * eggSize;
    const rr = 0.8 + rng() * 2.3;
    eCtx.fillStyle = `rgba(118, 62, 34, ${(0.18 + rng() * 0.35).toFixed(2)})`;
    eCtx.beginPath();
    eCtx.arc(px, py, rr, 0, Math.PI * 2);
    eCtx.fill();
  }

  // 5. Realistic Skin Micro-Pore Bump & Warm Tone Variation (512x512)
  const skinSize = 512;
  const skinCanvas = document.createElement('canvas');
  skinCanvas.width = skinCanvas.height = skinSize;
  const skCtx = skinCanvas.getContext('2d');
  const skImg = skCtx.createImageData(skinSize, skinSize);

  const skinBumpCanvas = document.createElement('canvas');
  skinBumpCanvas.width = skinBumpCanvas.height = skinSize;
  const skbCtx = skinBumpCanvas.getContext('2d');
  const skbImg = skbCtx.createImageData(skinSize, skinSize);

  for (let y = 0; y < skinSize; y++) {
    const v = y / skinSize;
    for (let x = 0; x < skinSize; x++) {
      const u = x / skinSize;
      const sub = fbmTile(u, v, 8, 4, 1501);
      const blush = fbmTile(u + 0.3, v + 0.2, 4, 3, 1523);
      const pore = smoothNoise2(u * 130, v * 130, 130, 1553);
      const crease = Math.sin(v * Math.PI * 22 + sub * 2.4) * 0.5 + 0.5;
      const idx = (y * skinSize + x) * 4;
      skImg.data[idx] = Math.min(255, 220 + (sub - 0.5) * 16 + (blush - 0.5) * 12);
      skImg.data[idx + 1] = Math.min(255, 166 + (sub - 0.5) * 16 - (blush - 0.5) * 6);
      skImg.data[idx + 2] = Math.min(255, 138 + (sub - 0.5) * 15 - (blush - 0.5) * 8);
      skImg.data[idx + 3] = 255;

      const sb = 128 + (pore - 0.5) * 42 - (crease > 0.88 ? 22 : 0);
      skbImg.data[idx] = skbImg.data[idx + 1] = skbImg.data[idx + 2] = Math.max(0, Math.min(255, sb));
      skbImg.data[idx + 3] = 255;
    }
  }
  skCtx.putImageData(skImg, 0, 0);
  skbCtx.putImageData(skbImg, 0, 0);

  // 6. Dark Charcoal Chef Linen Weave Bump (512x512)
  const linenSize = 512;
  const linenBumpCanvas = document.createElement('canvas');
  linenBumpCanvas.width = linenBumpCanvas.height = linenSize;
  const lbCtx = linenBumpCanvas.getContext('2d');
  const lbImg = lbCtx.createImageData(linenSize, linenSize);
  for (let y = 0; y < linenSize; y++) {
    for (let x = 0; x < linenSize; x++) {
      const warp = Math.sin((x / linenSize) * Math.PI * 160) * 0.5 + 0.5;
      const weft = Math.sin((y / linenSize) * Math.PI * 160) * 0.5 + 0.5;
      const slub = fbmTile(x / linenSize, y / linenSize, 16, 3, 1709);
      const v = 100 + ((x + y) % 2 === 0 ? warp : weft) * 45 + slub * 25;
      const idx = (y * linenSize + x) * 4;
      lbImg.data[idx] = lbImg.data[idx + 1] = lbImg.data[idx + 2] = v;
      lbImg.data[idx + 3] = 255;
    }
  }
  lbCtx.putImageData(lbImg, 0, 0);

  // 7. Hammered Copper Bump (512x512) for Caramel Saucier
  const copSize = 512;
  const copBumpCanvas = document.createElement('canvas');
  copBumpCanvas.width = copBumpCanvas.height = copSize;
  const cpCtx = copBumpCanvas.getContext('2d');
  cpCtx.fillStyle = 'rgb(148,148,148)';
  cpCtx.fillRect(0, 0, copSize, copSize);
  for (let i = 0; i < 320; i++) {
    const cx = rng() * copSize;
    const cy = rng() * copSize;
    const cr = 14 + rng() * 18;
    const grad = cpCtx.createRadialGradient(cx, cy, 1, cx, cy, cr);
    grad.addColorStop(0, 'rgba(95,95,95,0.42)');
    grad.addColorStop(0.75, 'rgba(138,138,138,0.22)');
    grad.addColorStop(1, 'rgba(165,165,165,0)');
    cpCtx.fillStyle = grad;
    cpCtx.beginPath();
    cpCtx.arc(cx, cy, cr, 0, Math.PI * 2);
    cpCtx.fill();
  }

  // 8. Fresh Ruby Strawberry Albedo + Seed Dimple Bump (512x512)
  const berrySize = 512;
  const berryCanvas = document.createElement('canvas');
  berryCanvas.width = berryCanvas.height = berrySize;
  const bCtx = berryCanvas.getContext('2d');
  const bGrad = bCtx.createLinearGradient(0, 0, 0, berrySize);
  bGrad.addColorStop(0.0, '#d81b28');
  bGrad.addColorStop(0.78, '#b30d1d');
  bGrad.addColorStop(0.95, '#e85d56');
  bGrad.addColorStop(1.0, '#f3c6a8');
  bCtx.fillStyle = bGrad;
  bCtx.fillRect(0, 0, berrySize, berrySize);

  const berryBumpCanvas = document.createElement('canvas');
  berryBumpCanvas.width = berryBumpCanvas.height = berrySize;
  const bbCtx = berryBumpCanvas.getContext('2d');
  bbCtx.fillStyle = 'rgb(165,165,165)';
  bbCtx.fillRect(0, 0, berrySize, berrySize);

  const rows = 14;
  const cols = 20;
  for (let r = 1; r < rows; r++) {
    const py = (r / rows) * berrySize * 0.92 + 12;
    const offset = (r % 2) * 0.5;
    for (let c = 0; c < cols; c++) {
      const px = ((c + offset) / cols) * berrySize;
      // Sunken dimple in bump map
      const dGrad = bbCtx.createRadialGradient(px, py, 1, px, py, 11);
      dGrad.addColorStop(0, 'rgb(45,45,45)');
      dGrad.addColorStop(0.55, 'rgb(105,105,105)');
      dGrad.addColorStop(1, 'rgba(165,165,165,0)');
      bbCtx.fillStyle = dGrad;
      bbCtx.beginPath();
      bbCtx.arc(px, py, 11, 0, Math.PI * 2);
      bbCtx.fill();

      // Golden-yellow achene seed inside dimple
      bCtx.fillStyle = 'rgba(72, 6, 12, 0.38)';
      bCtx.beginPath();
      bCtx.ellipse(px, py, 5.2, 6.8, 0, 0, Math.PI * 2);
      bCtx.fill();

      bCtx.fillStyle = '#e6bd53';
      bCtx.beginPath();
      bCtx.ellipse(px, py, 2.1, 3.4, 0, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // 9. Soft Volumetric Steam / Mist Particle Texture (256x256)
  const steamSize = 256;
  const steamCanvas = document.createElement('canvas');
  steamCanvas.width = steamCanvas.height = steamSize;
  const stCtx = steamCanvas.getContext('2d');
  const stImg = stCtx.createImageData(steamSize, steamSize);
  for (let y = 0; y < steamSize; y++) {
    const ny = (y / steamSize) * 2 - 1;
    for (let x = 0; x < steamSize; x++) {
      const nx = (x / steamSize) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const radial = Math.max(0, 1 - dist);
      const turb = fbmTile(x / steamSize, y / steamSize, 6, 4, 2003);
      const alpha = Math.pow(radial, 2.1) * (0.45 + turb * 0.75);
      const idx = (y * steamSize + x) * 4;
      stImg.data[idx] = 255;
      stImg.data[idx + 1] = 252;
      stImg.data[idx + 2] = 247;
      stImg.data[idx + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }
  stCtx.putImageData(stImg, 0, 0);

  // 10. Dynamic Swirling Batter Canvas Texture (512x512) updated live during whisking!
  const batterSize = 512;
  const batterCanvas = document.createElement('canvas');
  batterCanvas.width = batterCanvas.height = batterSize;
  const batCtx = batterCanvas.getContext('2d');
  batCtx.fillStyle = '#fffdf8';
  batCtx.fillRect(0, 0, batterSize, batterSize);
  const batterTex = makeCanvasTexture(batterCanvas, { srgb: true });
  batterTex.wrapS = THREE.ClampToEdgeWrapping;
  batterTex.wrapT = THREE.ClampToEdgeWrapping;

  return {
    slateColor: makeCanvasTexture(slateCanvas, { srgb: true, repeat: 2 }),
    slateRoughness: makeCanvasTexture(slateRoughCanvas, { srgb: false, repeat: 2 }),
    slateBump: makeCanvasTexture(slateBumpCanvas, { srgb: false, repeat: 2 }),
    custardColor: makeCanvasTexture(custCanvas, { srgb: true, repeat: 1 }),
    custardBump: makeCanvasTexture(custBumpCanvas, { srgb: false, repeat: 1 }),
    plateColor: (() => {
      const t = makeCanvasTexture(plateCanvas, { srgb: true, repeat: 1 });
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    })(),
    plateBump: (() => {
      const t = makeCanvasTexture(plateBumpCanvas, { srgb: false, repeat: 1 });
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    })(),
    eggColor: makeCanvasTexture(eggCanvas, { srgb: true, repeat: 1 }),
    eggBump: makeCanvasTexture(eggBumpCanvas, { srgb: false, repeat: 1 }),
    skinColor: makeCanvasTexture(skinCanvas, { srgb: true, repeat: 2 }),
    skinBump: makeCanvasTexture(skinBumpCanvas, { srgb: false, repeat: 2 }),
    linenBump: makeCanvasTexture(linenBumpCanvas, { srgb: false, repeat: 4 }),
    copperBump: makeCanvasTexture(copBumpCanvas, { srgb: false, repeat: 2 }),
    berryColor: makeCanvasTexture(berryCanvas, { srgb: true, repeat: 1 }),
    berryBump: makeCanvasTexture(berryBumpCanvas, { srgb: false, repeat: 1 }),
    steamSprite: (() => {
      const t = makeCanvasTexture(steamCanvas, { srgb: true, repeat: 1 });
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    })(),
    batterCanvas,
    batterCtx: batCtx,
    batterTex,
    maxTextureSize: 1024,
  };
}

// Updates the live swirling marble of milk + golden egg yolk ribbons in the mixing bowl!
export function updateBatterSwirlTexture(textures, mixProgress, swirlAngle, eggCount, foamAmount) {
  const { batterCanvas, batterCtx, batterTex } = textures;
  const w = batterCanvas.width;
  const h = batterCanvas.height;
  const cx = w * 0.5;
  const cy = h * 0.5;

  // Base transitions from pure creamy milk (#fffcf5) to silky golden custard batter
  const richBoost = Math.min(1, (eggCount - 1) * 0.42);
  const targetR = THREE.MathUtils.lerp(251, 248, richBoost);
  const targetG = THREE.MathUtils.lerp(226, 198, richBoost);
  const targetB = THREE.MathUtils.lerp(154, 96, richBoost);

  const curR = Math.round(THREE.MathUtils.lerp(254, targetR, mixProgress));
  const curG = Math.round(THREE.MathUtils.lerp(251, targetG, mixProgress));
  const curB = Math.round(THREE.MathUtils.lerp(242, targetB, mixProgress));

  batterCtx.fillStyle = `rgb(${curR},${curG},${curB})`;
  batterCtx.fillRect(0, 0, w, h);

  // Draw stretched spiral yolk/cream ribbons while partially mixed (0.01 < mixProgress < 0.97)
  if (mixProgress > 0.01 && mixProgress < 0.98) {
    const ribbonAlpha = Math.sin(Math.min(1, mixProgress) * Math.PI) * 0.85;
    const ribbonCount = 5 + eggCount * 3;
    for (let i = 0; i < ribbonCount; i++) {
      const baseA = (i / ribbonCount) * Math.PI * 2 + swirlAngle * (0.8 + (i % 3) * 0.25);
      batterCtx.beginPath();
      const turns = 1.2 + mixProgress * 3.8;
      for (let s = 0; s <= 36; s++) {
        const t = s / 36;
        const rad = (0.08 + t * 0.39) * w;
        const ang = baseA + t * turns * Math.PI * 1.4;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (s === 0) batterCtx.moveTo(px, py);
        else batterCtx.lineTo(px, py);
      }
      batterCtx.strokeStyle = i % 2 === 0
        ? `rgba(255, 145, 18, ${(ribbonAlpha * (1 - mixProgress * 0.72)).toFixed(3)})`
        : `rgba(255, 252, 244, ${(ribbonAlpha * 0.55 * (1 - mixProgress * 0.65)).toFixed(3)})`;
      batterCtx.lineWidth = Math.max(2.5, (1 - mixProgress * 0.78) * 18);
      batterCtx.lineCap = 'round';
      batterCtx.stroke();
    }
  }

  // Subtle vanilla specks & micro-foam bubbles along rim when vigorously whisked
  if (mixProgress > 0.25 || foamAmount > 0.05) {
    const bubbleCount = Math.floor(18 + foamAmount * 65);
    for (let i = 0; i < bubbleCount; i++) {
      const ang = i * 2.39996 + swirlAngle * 0.35;
      const rad = (0.28 + ((i * 37) % 100) / 100 * 0.19) * w;
      const bx = cx + Math.cos(ang) * rad;
      const by = cy + Math.sin(ang) * rad;
      const br = 1.5 + (i % 4) * 1.1;
      batterCtx.fillStyle = 'rgba(255, 254, 248, 0.55)';
      batterCtx.beginPath();
      batterCtx.arc(bx, by, br, 0, Math.PI * 2);
      batterCtx.fill();
    }
  }

  batterTex.needsUpdate = true;
}
