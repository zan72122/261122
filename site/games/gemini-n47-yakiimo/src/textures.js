import * as THREE from '../vendor/three.module.js';

function hash2(x, y, seed = 1) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x, y, seed = 1) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4, seed = 1) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return val / norm;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function heightToNormalTexture(heightBuf, w, h, strength = 2.5, repeat = 1) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (heightBuf[y * w + xp] - heightBuf[y * w + xm]) * strength;
      const dy = (heightBuf[yp * w + x] - heightBuf[ym * w + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const idx = (y * w + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/**
 * Cinema Magic-Hour Backlit Autumn Sunset Environment & Sky Dome.
 * Warm golden-apricot zenith-to-horizon transition ensures silver aluminum foil
 * reflects lush natural silver, warm peach sky, and golden firelight (never dark blue!).
 */
export function createMagicHourEnvironment(renderer) {
  const w = 1024;
  const h = 512;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Rich luminous autumn sunset sky
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#3a4263');   // soft twilight slate-blue zenith (luminous for foil!)
  grad.addColorStop(0.16, '#65516d');  // warm dusty lavender
  grad.addColorStop(0.28, '#b96958');  // rose-coral dusk sky
  grad.addColorStop(0.39, '#e98945');  // glowing autumn tangerine
  grad.addColorStop(0.46, '#ffbd66');  // golden magic-hour band
  grad.addColorStop(0.505, '#ffe8ae'); // radiant backlit horizon mist
  grad.addColorStop(0.54, '#6d4029');  // warm hazy autumn treeline bounce
  grad.addColorStop(0.68, '#3d2418');  // warm sunlit earth bounce
  grad.addColorStop(1.0, '#22140d');   // deep earth shadow
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.5;
  const sunY = h * 0.455;

  // Wispy backlit golden-rose sunset stratocumulus clouds
  for (let i = 0; i < 65; i++) {
    const cx = hash2(i, 1, 9) * w;
    const cy = h * (0.14 + hash2(i, 2, 9) * 0.31);
    const rx = 45 + hash2(i, 3, 9) * 165;
    const ry = 6 + hash2(i, 4, 9) * 18;
    const nearSun = Math.exp(-Math.pow((cx - sunX) / 260, 2));
    const cGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
    const r = Math.round(215 + nearSun * 40);
    const g = Math.round(126 + nearSun * 96);
    const b = Math.round(88 + nearSun * 64);
    cGrad.addColorStop(0, `rgba(${r},${g},${b},${0.24 + nearSun * 0.28})`);
    cGrad.addColorStop(0.55, `rgba(${Math.round(r * 0.8)},${Math.round(g * 0.65)},${Math.round(b * 0.68)},0.12)`);
    cGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Broad atmospheric golden sun haze
  const halo1 = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 310);
  halo1.addColorStop(0, 'rgba(255, 253, 240, 1.0)');
  halo1.addColorStop(0.09, 'rgba(255, 234, 178, 0.94)');
  halo1.addColorStop(0.25, 'rgba(255, 172, 92, 0.56)');
  halo1.addColorStop(0.55, 'rgba(235, 114, 58, 0.20)');
  halo1.addColorStop(1, 'rgba(220, 90, 45, 0)');
  ctx.fillStyle = halo1;
  ctx.fillRect(0, 0, w, h);

  // Crisp glowing setting sun disc
  const sunCore = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 24);
  sunCore.addColorStop(0, '#ffffff');
  sunCore.addColorStop(0.55, '#fffbe8');
  sunCore.addColorStop(1, 'rgba(255, 224, 145, 0)');
  ctx.fillStyle = sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
  ctx.fill();

  // Warm bright campfire bounce in lower reflection hemisphere so metallic foil glints warm amber
  const fireBounce = ctx.createRadialGradient(w * 0.5, h * 0.72, 10, w * 0.5, h * 0.72, 220);
  fireBounce.addColorStop(0, 'rgba(255, 165, 82, 0.85)');
  fireBounce.addColorStop(0.45, 'rgba(225, 105, 42, 0.35)');
  fireBounce.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fireBounce;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  // Soft warm golden horizon mist (smooth gradient ONLY — distant hills are now smooth 3D silhouettes, ZERO pixel stair-stepping!)
  const mistGrad = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.56);
  mistGrad.addColorStop(0, 'rgba(255, 206, 132, 0)');
  mistGrad.addColorStop(0.45, 'rgba(255, 190, 110, 0.42)');
  mistGrad.addColorStop(0.75, 'rgba(135, 68, 36, 0.55)');
  mistGrad.addColorStop(1, 'rgba(58, 32, 20, 0.95)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, h * 0.44, w, h * 0.13);

  const skyTex = new THREE.CanvasTexture(canvas);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.minFilter = THREE.LinearFilter;
  skyTex.magFilter = THREE.LinearFilter;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(skyTex);
  pmrem.dispose();

  return { envMap: envRT.texture, skyTex };
}

/**
 * Fine-grained damp autumn park earth, crushed leaf humus, pine needles, wood-ash ring & glowing ember core.
 * Smooth natural normal scale (no cratered dots!).
 */
export function createGroundTextures() {
  const size = 512;
  const colorCanvas = makeCanvas(size, size);
  const cCtx = colorCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);

  const roughCanvas = makeCanvas(size, size);
  const rCtx = roughCanvas.getContext('2d');
  const rImg = rCtx.createImageData(size, size);

  const emissiveCanvas = makeCanvas(size, size);
  const eCtx = emissiveCanvas.getContext('2d');
  const eImg = eCtx.createImageData(size, size);

  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size - 0.5) * 2;
      const ny = (y / size - 0.5) * 2;
      const dist = Math.sqrt(nx * nx + ny * ny);

      const nBroad = fbm(x * 0.012, y * 0.012, 4, 3);
      const nMed = fbm(x * 0.045, y * 0.045, 3, 11);
      const nFine = fbm(x * 0.24, y * 0.24, 3, 29);
      const grit = hash2(x, y, 47);
      const pebble = grit > 0.985 ? 0.28 : 0;

      // Rich natural autumn park dirt & dry leaf litter humus
      let r = 52 + nBroad * 28 + nMed * 16 + nFine * 14 + pebble * 42;
      let g = 37 + nBroad * 20 + nMed * 11 + nFine * 10 + pebble * 38;
      let b = 26 + nBroad * 13 + nMed * 7 + nFine * 6 + pebble * 32;

      // Natural autumn moss / dry grass patches farther from the pit
      const grassPatch = Math.max(0, Math.min(1, (dist - 0.26) * 2.5)) * Math.max(0, nBroad - 0.42) * 1.4;
      r = r * (1 - grassPatch * 0.35) + 76 * grassPatch * 0.35;
      g = g * (1 - grassPatch * 0.35) + 68 * grassPatch * 0.35;
      b = b * (1 - grassPatch * 0.35) + 30 * grassPatch * 0.35;

      // Soft warm wood-ash & charred center inside firepit
      const pitMask = Math.max(0, Math.min(1, (0.195 - dist) / 0.065));
      const ashHalo = Math.exp(-Math.pow((dist - 0.125) / 0.042, 2)) * (0.4 + 0.6 * nMed);
      r = r * (1 - pitMask * 0.76) + 20 * pitMask * 0.76;
      g = g * (1 - pitMask * 0.76) + 18 * pitMask * 0.76;
      b = b * (1 - pitMask * 0.76) + 18 * pitMask * 0.76;

      r = r * (1 - ashHalo * 0.52) + 124 * ashHalo * 0.52;
      g = g * (1 - ashHalo * 0.52) + 116 * ashHalo * 0.52;
      b = b * (1 - ashHalo * 0.52) + 112 * ashHalo * 0.52;

      // Fine glowing ember fissures under ash inside pit
      const emberZone = Math.max(0, Math.min(1, (0.125 - dist) / 0.055));
      const crack = fbm(x * 0.14, y * 0.14, 3, 71);
      const emberHot = emberZone * Math.pow(Math.max(0, crack - 0.44) / 0.56, 1.75);

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      cImg.data[idx + 3] = 255;

      const roughVal = Math.min(0.98, Math.max(0.72, 0.90 - nBroad * 0.1 + ashHalo * 0.08));
      const rv = Math.round(roughVal * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;

      eImg.data[idx] = Math.min(255, Math.round(emberHot * 255 * 1.45));
      eImg.data[idx + 1] = Math.min(255, Math.round(Math.pow(emberHot, 1.45) * 145));
      eImg.data[idx + 2] = Math.min(255, Math.round(Math.pow(emberHot, 2.3) * 32));
      eImg.data[idx + 3] = 255;

      // Subtle micro-height (smooth fine dirt grain, no pockmarked craters!)
      heightBuf[y * size + x] = nBroad * 0.25 + nFine * 0.55 + grit * 0.2;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  // Paint delicate organic dry pine needles & fallen twigs directly onto earth albedo for ultra-realism!
  cCtx.save();
  for (let i = 0; i < 420; i++) {
    const px = hash2(i, 1, 901) * size;
    const py = hash2(i, 2, 901) * size;
    const dx = (px / size - 0.5) * 2;
    const dy = (py / size - 0.5) * 2;
    if (Math.hypot(dx, dy) < 0.18) continue;
    const ang = hash2(i, 3, 901) * Math.PI * 2;
    const len = 4 + hash2(i, 4, 901) * 11;
    cCtx.strokeStyle =
      hash2(i, 5, 901) > 0.4
        ? 'rgba(118, 72, 36, 0.42)'
        : 'rgba(148, 92, 40, 0.34)';
    cCtx.lineWidth = 1.0 + hash2(i, 6, 901) * 0.8;
    cCtx.beginPath();
    cCtx.moveTo(px, py);
    cCtx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    cCtx.stroke();
  }
  cCtx.restore();

  rCtx.putImageData(rImg, 0, 0);
  eCtx.putImageData(eImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 1.35, 1);

  return { map, normalMap, roughnessMap, emissiveMap };
}

/**
 * Natural weathered granite & river stone texture with subtle moss/lichen
 */
export function createStoneTextures() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = fbm(x * 0.035, y * 0.035, 4, 15);
      const n2 = fbm(x * 0.13, y * 0.13, 3, 27);
      const speck = hash2(x, y, 61);
      const grain = (speck - 0.5) * 26;

      let r = 84 + n1 * 48 + n2 * 20 + grain;
      let g = 79 + n1 * 44 + n2 * 18 + grain;
      let b = 74 + n1 * 38 + n2 * 16 + grain;

      // Subtle forest moss in rock hollows
      if (n1 < 0.36 && n2 > 0.52) {
        r -= 14;
        g += 12;
        b -= 16;
      }

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      heightBuf[y * size + x] = n1 * 0.5 + n2 * 0.35 + speck * 0.15;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 2.2, 1);
  return { map, normalMap };
}

/**
 * Glowing charred charcoal / wood-ember chunks (black ashy crust + incandescent orange-red fissures!)
 */
export function createCharcoalTextures() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  const emCanvas = makeCanvas(size, size);
  const emCtx = emCanvas.getContext('2d');
  const emImg = emCtx.createImageData(size, size);

  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = fbm(x * 0.08, y * 0.08, 4, 211);
      const n2 = fbm(x * 0.22, y * 0.22, 3, 229);
      const ash = Math.max(0, n1 - 0.58) * 2.2;

      // Dark charred carbon + pale grey wood-ash dusting on raised edges
      const base = 20 + n2 * 18 + ash * 78;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(180, Math.round(base));
      img.data[idx + 1] = Math.min(175, Math.round(base * 0.96));
      img.data[idx + 2] = Math.min(172, Math.round(base * 0.94));
      img.data[idx + 3] = 255;

      // Glowing incandescent ember veins ONLY inside deep cracks (never flat solid orange!)
      const crackGlow = Math.pow(Math.max(0, 0.46 - n1) / 0.46, 1.55) * (0.55 + 0.45 * n2);
      emImg.data[idx] = Math.min(255, Math.round(crackGlow * 255 * 1.65));
      emImg.data[idx + 1] = Math.min(255, Math.round(Math.pow(crackGlow, 1.4) * 145));
      emImg.data[idx + 2] = Math.min(255, Math.round(Math.pow(crackGlow, 2.3) * 32));
      emImg.data[idx + 3] = 255;

      heightBuf[y * size + x] = n1 * 0.65 + n2 * 0.35;
    }
  }
  ctx.putImageData(img, 0, 0);
  emCtx.putImageData(emImg, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 3.2, 1);
  return { map, normalMap, emissiveMap };
}

/**
 * Weathered natural Japanese cedar wood slab texture
 */
export function createWoodTextures() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = fbm(x * 0.012, y * 0.036, 3, 5) * 12;
      const ring = Math.sin((y * 0.14 + warp) * 1.1) * 0.5 + 0.5;
      const grain = fbm(x * 0.01, y * 0.16, 4, 19);
      const fiber = fbm(x * 0.035, y * 0.55, 2, 43);

      const gVal = ring * 0.38 + grain * 0.40 + fiber * 0.22;
      const r = 92 + gVal * 66;
      const g = 62 + gVal * 44;
      const b = 40 + gVal * 26;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.round(r));
      img.data[idx + 1] = Math.min(255, Math.round(g));
      img.data[idx + 2] = Math.min(255, Math.round(b));
      img.data[idx + 3] = 255;

      heightBuf[y * size + x] = gVal;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 2.0, 1);
  return { map, normalMap };
}

/**
 * Charred firewood bark with glowing ember fissures
 */
export function createBarkTextures() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  const emCanvas = makeCanvas(size, size);
  const emCtx = emCanvas.getContext('2d');
  const emImg = emCtx.createImageData(size, size);

  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ridge = fbm(x * 0.16, y * 0.03, 4, 7);
      const crack = fbm(x * 0.28, y * 0.14, 3, 88);
      const char = Math.max(0, Math.min(1, (y / size) * 1.15 - 0.15));

      let r = (74 + ridge * 46) * (1 - char * 0.78) + 20 * char * 0.78;
      let g = (52 + ridge * 32) * (1 - char * 0.80) + 18 * char * 0.80;
      let b = (38 + ridge * 22) * (1 - char * 0.80) + 16 * char * 0.80;

      const glow = char * Math.pow(Math.max(0, 0.44 - crack) / 0.44, 1.55);

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round(r);
      img.data[idx + 1] = Math.round(g);
      img.data[idx + 2] = Math.round(b);
      img.data[idx + 3] = 255;

      emImg.data[idx] = Math.min(255, Math.round(glow * 255 * 1.4));
      emImg.data[idx + 1] = Math.min(255, Math.round(Math.pow(glow, 1.4) * 135));
      emImg.data[idx + 2] = Math.min(255, Math.round(Math.pow(glow, 2.2) * 28));
      emImg.data[idx + 3] = 255;

      heightBuf[y * size + x] = ridge * 0.7 + crack * 0.3;
    }
  }
  ctx.putImageData(img, 0, 0);
  emCtx.putImageData(emImg, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 3.4, 1);
  return { map, normalMap, emissiveMap };
}

/**
 * Photorealistic dry autumn leaf textures (maple / ginkgo / oak) with veins, mottling & cutout alpha.
 */
export function createLeafTextureSet() {
  function drawLeaf(species, palette) {
    const size = 256;
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size * 0.5, size * 0.54);

    ctx.beginPath();
    if (species === 'maple') {
      const steps = 160;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const a = t - Math.PI / 2;
        const lobes =
          Math.pow(Math.max(0, Math.cos(a * 2.5)), 2.2) * 0.62 +
          Math.pow(Math.max(0, Math.cos((a - 0.95) * 3.1)), 2.5) * 0.35 +
          Math.pow(Math.max(0, Math.cos((a + 0.95) * 3.1)), 2.5) * 0.35;
        const baseMask = Math.cos(a) > -0.78 ? 1 : 0.22;
        const serration = 1 + Math.sin(a * 28) * 0.045;
        const r = (26 + lobes * 92) * baseMask * serration;
        const px = Math.sin(a) * r;
        const py = -Math.cos(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (species === 'ginkgo') {
      ctx.moveTo(0, 72);
      ctx.quadraticCurveTo(-56, 22, -88, -32);
      ctx.quadraticCurveTo(-76, -86, -24, -84);
      ctx.quadraticCurveTo(-4, -80, 0, -56);
      ctx.quadraticCurveTo(4, -80, 24, -84);
      ctx.quadraticCurveTo(76, -86, 88, -32);
      ctx.quadraticCurveTo(56, 22, 0, 72);
      ctx.closePath();
    } else {
      ctx.moveTo(0, 90);
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const y = 88 - u * 182;
        const width = Math.sin(u * Math.PI) * 62 * (0.75 + 0.25 * Math.sin(u * Math.PI * 0.9));
        const lobe = 1 + Math.sin(u * Math.PI * 9) * 0.14;
        ctx.lineTo(width * lobe, y);
      }
      for (let i = steps; i >= 0; i--) {
        const u = i / steps;
        const y = 88 - u * 182;
        const width = Math.sin(u * Math.PI) * 62 * (0.75 + 0.25 * Math.sin(u * Math.PI * 0.9));
        const lobe = 1 + Math.sin(u * Math.PI * 9 + 0.4) * 0.14;
        ctx.lineTo(-width * lobe, y);
      }
      ctx.closePath();
    }

    ctx.save();
    ctx.clip();

    const grad = ctx.createRadialGradient(0, 12, 8, 0, -10, 118);
    grad.addColorStop(0, palette.inner);
    grad.addColorStop(0.58, palette.mid);
    grad.addColorStop(0.88, palette.edge);
    grad.addColorStop(1, palette.dryTip);
    ctx.fillStyle = grad;
    ctx.fillRect(-128, -138, 256, 256);

    for (let i = 0; i < 65; i++) {
      const sx = (hash2(i, 1, palette.seed) - 0.5) * 185;
      const sy = (hash2(i, 2, palette.seed) - 0.5) * 195;
      const sr = 6 + hash2(i, 3, palette.seed) * 24;
      const sg = ctx.createRadialGradient(sx, sy, 1, sx, sy, sr);
      const darkSpot = hash2(i, 4, palette.seed) > 0.55;
      sg.addColorStop(0, darkSpot ? 'rgba(62, 28, 14, 0.34)' : palette.mottle);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = palette.vein;
    ctx.lineCap = 'round';
    if (species === 'maple') {
      const angles = [-1.35, -0.72, 0, 0.72, 1.35];
      angles.forEach((ang, idx) => {
        const len = idx === 2 ? 98 : (idx === 1 || idx === 3 ? 82 : 52);
        ctx.lineWidth = idx === 2 ? 2.6 : 1.9;
        ctx.beginPath();
        ctx.moveTo(0, 26);
        ctx.lineTo(Math.sin(ang) * len, 26 - Math.cos(ang) * len);
        ctx.stroke();
      });
    } else if (species === 'ginkgo') {
      ctx.lineWidth = 1.1;
      for (let i = -11; i <= 11; i++) {
        const ang = i * 0.095;
        ctx.beginPath();
        ctx.moveTo(0, 68);
        ctx.quadraticCurveTo(Math.sin(ang) * 44, 6, Math.sin(ang) * 116, -86);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, 88);
      ctx.lineTo(0, -86);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const y0 = 66 - i * 19;
        const span = 48 * Math.sin(((i + 1) / 9) * Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(span, y0 - 16);
        ctx.moveTo(0, y0);
        ctx.lineTo(-span, y0 - 16);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.strokeStyle = '#4e2a16';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, species === 'maple' ? 22 : 70);
    ctx.quadraticCurveTo(4, 96, 10, 114);
    ctx.stroke();
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  return [
    drawLeaf('maple', {
      inner: '#dc4a21', mid: '#ba2619', edge: '#7d1912', dryTip: '#4d1b0e',
      mottle: 'rgba(238, 126, 36, 0.34)', vein: 'rgba(72, 16, 10, 0.45)', seed: 101,
    }),
    drawLeaf('ginkgo', {
      inner: '#ebc034', mid: '#daa01f', edge: '#b57115', dryTip: '#6b3b12',
      mottle: 'rgba(252, 218, 86, 0.38)', vein: 'rgba(130, 78, 16, 0.34)', seed: 202,
    }),
    drawLeaf('oak', {
      inner: '#d07126', mid: '#a84b19', edge: '#723013', dryTip: '#441e0d',
      mottle: 'rgba(226, 140, 48, 0.34)', vein: 'rgba(65, 28, 12, 0.44)', seed: 303,
    }),
    drawLeaf('maple', {
      inner: '#f28b26', mid: '#d44c1a', edge: '#902512', dryTip: '#511c0e',
      mottle: 'rgba(250, 180, 56, 0.36)', vein: 'rgba(84, 24, 10, 0.42)', seed: 404,
    }),
  ];
}

/**
 * Organic jittered Beni-Haruka sweet potato skin (raw & blistered caramelized roasted)
 * ZERO mechanical grid dots!
 */
export function createPotatoSkinTextures() {
  const size = 512;

  // Pre-generate organic randomly scattered root lenticel dimples
  const dimples = [];
  for (let i = 0; i < 110; i++) {
    dimples.push({
      x: hash2(i, 1, 777) * size,
      y: hash2(i, 2, 777) * size,
      rx: 2.2 + hash2(i, 3, 777) * 3.8,
      ry: 1.0 + hash2(i, 4, 777) * 1.6,
    });
  }

  function build(roasted) {
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);

    const roughCanvas = makeCanvas(size, size);
    const rCtx = roughCanvas.getContext('2d');
    const rImg = rCtx.createImageData(size, size);

    const heightBuf = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nBroad = fbm(x * 0.014, y * 0.025, 4, 13);
        const nRidge = fbm(x * 0.065, y * 0.020, 3, 29);
        const nFine = fbm(x * 0.22, y * 0.22, 2, 53);

        // Authentic Japanese Beni-Haruka burgundy-plum skin
        let r = 132 + nBroad * 36 + nRidge * 16;
        let g = 38 + nBroad * 20 + nRidge * 11;
        let b = 62 + nBroad * 22 + nRidge * 12;

        // Subtle dry sandy soil specks
        const soil = Math.max(0, nFine - 0.66) * 1.3;
        r = r * (1 - soil * 0.25) + 96 * soil * 0.25;
        g = g * (1 - soil * 0.25) + 74 * soil * 0.25;
        b = b * (1 - soil * 0.25) + 52 * soil * 0.25;

        let rough = 0.66 + nFine * 0.16 - nBroad * 0.08;
        let hVal = nBroad * 0.45 + nRidge * 0.35 + nFine * 0.2;

        if (roasted) {
          // Blistered papery roasted yakiimo skin with rich caramelized honey sheen!
          const charPatch = Math.max(0, Math.min(1, (fbm(x * 0.024, y * 0.024, 4, 91) - 0.36) * 2.2));
          const blister = Math.max(0, fbm(x * 0.07, y * 0.07, 3, 113) - 0.56) * 2.3;
          const honeyGlaze = Math.max(0, Math.min(1, (fbm(x * 0.042, y * 0.058, 3, 137) - 0.60) * 3.2));

          r = r * 0.58 * (1 - charPatch * 0.68) + 32 * charPatch * 0.68;
          g = g * 0.60 * (1 - charPatch * 0.72) + 22 * charPatch * 0.72;
          b = b * 0.50 * (1 - charPatch * 0.76) + 20 * charPatch * 0.76;

          // Rich dark-amber caramelized mitsu syrup glistening in patches
          r = r * (1 - honeyGlaze * 0.68) + 176 * honeyGlaze * 0.68;
          g = g * (1 - honeyGlaze * 0.68) + 92 * honeyGlaze * 0.68;
          b = b * (1 - honeyGlaze * 0.68) + 18 * honeyGlaze * 0.68;

          hVal += blister * 0.45;
          rough = Math.max(0.12, Math.min(0.92, 0.72 + charPatch * 0.16 - honeyGlaze * 0.62));
        }

        const idx = (y * size + x) * 4;
        img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
        img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        img.data[idx + 3] = 255;

        const rv = Math.round(rough * 255);
        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        heightBuf[y * size + x] = hVal;
      }
    }

    ctx.putImageData(img, 0, 0);

    // Paint subtle organic scattered root lenticels & papery horizontal creases
    ctx.save();
    for (const d of dimples) {
      ctx.fillStyle = roasted ? 'rgba(28, 12, 10, 0.45)' : 'rgba(68, 18, 34, 0.36)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    rCtx.putImageData(rImg, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    const normalMap = heightToNormalTexture(heightBuf, size, size, roasted ? 3.2 : 1.9, 1);

    return { map, normalMap, roughnessMap };
  }

  return { raw: build(false), roasted: build(true) };
}

/**
 * HERO MACRO TEXTURE: Steaming hot broken roasted sweet potato cross-section!
 * Vibrant honey-gold moist fibrous interior, caramelized amber vascular ring,
 * starchy fluffy crumbs, and glossy wet mitsu honey pockets.
 */
export function createPotatoFleshTextures() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  const roughCanvas = makeCanvas(size, size);
  const rCtx = roughCanvas.getContext('2d');
  const rImg = rCtx.createImageData(size, size);

  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ux = (x / size - 0.5) * 2;
      const uy = (y / size - 0.5) * 2;
      const rDist = Math.sqrt(ux * ux + uy * uy);
      const ang = Math.atan2(uy, ux);

      const nMacro = fbm(x * 0.026, y * 0.026, 4, 31);
      const nFiber = fbm(x * 0.13 + Math.cos(ang) * 2.6, y * 0.13 + Math.sin(ang) * 2.6, 4, 67);
      const nMicro = fbm(x * 0.34, y * 0.34, 2, 109);
      const radialStrands = fbm(Math.cos(ang) * 5.2 + rDist * 3.2, Math.sin(ang) * 5.2 + rDist * 3.2, 3, 151);

      // Delicious golden-yellow roasted Beni-Haruka flesh -> warm caramelized amber outer ring
      const edgeDarken = Math.pow(Math.min(1, rDist * 1.05), 2.1);
      const cambiumRing = Math.exp(-Math.pow((rDist - 0.77 + (nMacro - 0.5) * 0.08) / 0.075, 2));

      let r = 252 - edgeDarken * 24 + (nMacro - 0.5) * 24 + (nFiber - 0.5) * 16;
      let g = 198 - edgeDarken * 62 + (nMacro - 0.5) * 32 + (radialStrands - 0.5) * 26 - cambiumRing * 30;
      let b = 42 - edgeDarken * 22 + (nFiber - 0.5) * 18;

      // Moist translucent golden-amber honey (蜜) veins & pockets
      const mitsu = Math.max(0, Math.min(1, (nMacro * 0.55 + radialStrands * 0.45 - 0.46) * 2.7));
      r = r * (1 - mitsu * 0.2) + 242 * mitsu * 0.2;
      g = g * (1 - mitsu * 0.30) + 148 * mitsu * 0.30;
      b = b * (1 - mitsu * 0.45) + 14 * mitsu * 0.45;

      // Thin dark caramelized skin border at outer 7% edge
      const skinRim = Math.max(0, Math.min(1, (rDist - 0.91) / 0.085));
      r = r * (1 - skinRim) + 64 * skinRim;
      g = g * (1 - skinRim) + 26 * skinRim;
      b = b * (1 - skinRim) + 26 * skinRim;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rough = Math.max(0.14, Math.min(0.64, 0.50 - mitsu * 0.34 + (nMicro - 0.5) * 0.14));
      const rv = Math.round(rough * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;

      heightBuf[y * size + x] = nMacro * 0.44 + nFiber * 0.34 + nMicro * 0.22;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const normalMap = heightToNormalTexture(heightBuf, size, size, 4.4, 1);

  return { map, normalMap, roughnessMap };
}

/**
 * Multi-scale crinkled silver aluminum foil textures
 */
export function createFoilTextures() {
  const size = 512;
  const heightBuf = new Float32Array(size * size);

  const roughCanvas = makeCanvas(size, size);
  const rCtx = roughCanvas.getContext('2d');
  const rImg = rCtx.createImageData(size, size);

  const sootCanvas = makeCanvas(size, size);
  const sCtx = sootCanvas.getContext('2d');
  const sImg = sCtx.createImageData(size, size);

  const numPts = 46;
  const pts = [];
  for (let i = 0; i < numPts; i++) {
    pts.push([hash2(i, 1, 55) * size, hash2(i, 2, 55) * size]);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (let i = 0; i < numPts; i++) {
        let dx = Math.abs(x - pts[i][0]);
        let dy = Math.abs(y - pts[i][1]);
        if (dx > size * 0.5) dx = size - dx;
        if (dy > size * 0.5) dy = size - dy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const crease = Math.min(1, (d2 - d1) / 42);
      const crinkle = Math.abs(fbm(x * 0.042, y * 0.042, 3, 73) - 0.5) * 2;
      const micro = fbm(x * 0.16, y * 0.16, 2, 97);

      heightBuf[y * size + x] = crease * 0.56 + crinkle * 0.30 + micro * 0.14;

      const idx = (y * size + x) * 4;
      const rough = Math.min(0.42, Math.max(0.16, 0.22 + (1 - crease) * 0.12 + micro * 0.07));
      const rv = Math.round(rough * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;

      const soot = fbm(x * 0.024, y * 0.024, 4, 141);
      const baseSilver = 238 - Math.max(0, soot - 0.38) * 210;
      const warmTint = Math.max(0, soot - 0.44) * 52;
      sImg.data[idx] = Math.min(255, Math.max(62, Math.round(baseSilver + warmTint * 0.6)));
      sImg.data[idx + 1] = Math.min(255, Math.max(54, Math.round(baseSilver + warmTint * 0.18)));
      sImg.data[idx + 2] = Math.min(255, Math.max(48, Math.round(baseSilver - warmTint * 0.28)));
      sImg.data[idx + 3] = 255;
    }
  }

  rCtx.putImageData(rImg, 0, 0);
  sCtx.putImageData(sImg, 0, 0);

  const normalMap = heightToNormalTexture(heightBuf, size, size, 3.0, 1.35);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1.35, 1.35);

  const sootMap = new THREE.CanvasTexture(sootCanvas);
  sootMap.colorSpace = THREE.SRGBColorSpace;
  sootMap.wrapS = sootMap.wrapT = THREE.RepeatWrapping;

  return { normalMap, roughnessMap, sootMap };
}

/**
 * Cozy ribbed wool knit sweater cuff texture (warm autumn cranberry-oatmeal weave)
 */
export function createKnitTextures() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rib = Math.sin((x / size) * Math.PI * 22) * 0.5 + 0.5;
      const stitch = Math.sin((y / size) * Math.PI * 34 + Math.abs((x % 12) - 6) * 0.42) * 0.5 + 0.5;
      const fuzz = fbm(x * 0.25, y * 0.25, 2, 161);
      const hVal = rib * 0.55 + stitch * 0.3 + fuzz * 0.15;

      // Cozy warm camel-cinnamon autumn knit sweater
      const r = 178 + hVal * 44;
      const g = 122 + hVal * 36;
      const b = 92 + hVal * 28;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.round(r));
      img.data[idx + 1] = Math.min(255, Math.round(g));
      img.data[idx + 2] = Math.min(255, Math.round(b));
      img.data[idx + 3] = 255;
      heightBuf[y * size + x] = hVal;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 3.2, 1);
  return { map, normalMap };
}

/**
 * Soft photorealistic wispy smoke/steam puff, spark, sun glow, and backlit autumn canopy cluster sprites
 */
export function createParticleSprites() {
  // 1. Billowing organic noise-sculpted smoke / steam puff
  const wSize = 256;
  const wCanvas = makeCanvas(wSize, wSize);
  const wCtx = wCanvas.getContext('2d');
  const wImg = wCtx.createImageData(wSize, wSize);
  for (let y = 0; y < wSize; y++) {
    for (let x = 0; x < wSize; x++) {
      const dx = (x / wSize - 0.5) * 2;
      const dy = (y / wSize - 0.5) * 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      const n1 = fbm(x * 0.032, y * 0.032, 4, 17);
      const n2 = fbm(x * 0.075, y * 0.075, 3, 41);
      const radial = Math.max(0, 1 - Math.pow(r, 1.55));
      const alpha = Math.max(0, Math.min(1, radial * (0.42 + n1 * 0.72 + n2 * 0.25) - 0.16));

      const rim = Math.min(1, 0.80 + (1 - y / wSize) * 0.20 + n2 * 0.12);
      const idx = (y * wSize + x) * 4;
      wImg.data[idx] = Math.min(255, Math.round(255 * rim));
      wImg.data[idx + 1] = Math.min(255, Math.round(244 * rim));
      wImg.data[idx + 2] = Math.min(255, Math.round(228 * rim));
      wImg.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  wCtx.putImageData(wImg, 0, 0);
  const vaporTex = new THREE.CanvasTexture(wCanvas);
  vaporTex.colorSpace = THREE.SRGBColorSpace;

  // 2. Incandescent glowing ember / spark sprite
  const sSize = 64;
  const sCanvas = makeCanvas(sSize, sSize);
  const sCtx = sCanvas.getContext('2d');
  const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
  sGrad.addColorStop(0.0, 'rgba(255, 255, 235, 1.0)');
  sGrad.addColorStop(0.22, 'rgba(255, 210, 95, 0.95)');
  sGrad.addColorStop(0.52, 'rgba(255, 102, 18, 0.55)');
  sGrad.addColorStop(1.0, 'rgba(220, 40, 0, 0.0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, sSize, sSize);
  const sparkTex = new THREE.CanvasTexture(sCanvas);
  sparkTex.colorSpace = THREE.SRGBColorSpace;

  // 3. Soft golden magic-hour sun glow
  const gSize = 256;
  const gCanvas = makeCanvas(gSize, gSize);
  const gCtx = gCanvas.getContext('2d');
  const gGrad = gCtx.createRadialGradient(128, 128, 2, 128, 128, 126);
  gGrad.addColorStop(0.0, 'rgba(255, 248, 224, 0.95)');
  gGrad.addColorStop(0.18, 'rgba(255, 206, 126, 0.58)');
  gGrad.addColorStop(0.52, 'rgba(255, 144, 68, 0.18)');
  gGrad.addColorStop(1.0, 'rgba(255, 110, 40, 0.0)');
  gCtx.fillStyle = gGrad;
  gCtx.fillRect(0, 0, gSize, gSize);
  const sunGlowTex = new THREE.CanvasTexture(gCanvas);
  sunGlowTex.colorSpace = THREE.SRGBColorSpace;

  // 4. Photographic fine-leaf backlit autumn canopy bough texture (hundreds of tiny real maple/ginkgo leaves, dark inner twigs & golden sky filtering through!)
  const fSize = 512;
  const fCanvas = makeCanvas(fSize, fSize);
  const fCtx = fCanvas.getContext('2d');
  fCtx.clearRect(0, 0, fSize, fSize);

  // Subtle dark gnarled branch skeleton inside canopy
  fCtx.strokeStyle = 'rgba(34, 17, 11, 0.72)';
  fCtx.lineCap = 'round';
  for (let b = 0; b < 9; b++) {
    const ang = -Math.PI * 0.85 + (b / 8) * Math.PI * 0.7;
    const len = 110 + hash2(b, 1, 611) * 95;
    fCtx.lineWidth = 4.5 - (b % 3);
    fCtx.beginPath();
    fCtx.moveTo(256, 360);
    fCtx.quadraticCurveTo(
      256 + Math.cos(ang) * len * 0.55 + (hash2(b, 2, 611) - 0.5) * 40,
      300 + Math.sin(ang) * len * 0.5,
      256 + Math.cos(ang) * len,
      260 + Math.sin(ang) * len
    );
    fCtx.stroke();
  }

  // Paint 1,200 tiny individual backlit autumn leaves (dark shadowed core -> glowing translucent golden/crimson edges!)
  for (let i = 0; i < 1200; i++) {
    const clusterIdx = i % 10;
    const cx = 256 + (hash2(clusterIdx, 1, 709) - 0.5) * 210;
    const cy = 245 + (hash2(clusterIdx, 2, 709) - 0.5) * 165;
    const a = hash2(i, 1, 515) * Math.PI * 2;
    const rad = Math.pow(hash2(i, 2, 515), 0.65) * 98;
    const lx = cx + Math.cos(a) * rad;
    const ly = cy + Math.sin(a) * rad * 0.78;
    const distCenter = Math.hypot((lx - 256) / 220, (ly - 245) / 185);
    if (distCenter > 1.05) continue;

    // Tiny photographic leaf size (4..11px!)
    const lr = 4.0 + hash2(i, 3, 515) * 6.8;
    // Deep backlit shadow inside bough, glowing sunlit rim on outer & lower sunlit edges!
    const backlit = Math.max(0, Math.min(1, distCenter * 0.85 + (ly / fSize) * 0.35 - 0.15));
    const shade = 0.28 + backlit * 0.72 + (hash2(i, 4, 515) - 0.5) * 0.22;
    const r = Math.min(255, Math.max(20, Math.round((155 + backlit * 100) * shade)));
    const g = Math.min(255, Math.max(12, Math.round((78 + backlit * 115) * shade)));
    const b = Math.min(255, Math.max(8, Math.round((34 + backlit * 36) * shade)));

    fCtx.save();
    fCtx.translate(lx, ly);
    fCtx.rotate(hash2(i, 5, 515) * Math.PI);
    fCtx.fillStyle = `rgba(${r},${g},${b},${0.68 + hash2(i, 6, 515) * 0.28})`;
    // Pointed miniature leaf silhouette
    fCtx.beginPath();
    fCtx.moveTo(-lr * 1.1, 0);
    fCtx.quadraticCurveTo(0, -lr * 0.7, lr * 1.1, 0);
    fCtx.quadraticCurveTo(0, lr * 0.7, -lr * 1.1, 0);
    fCtx.fill();
    fCtx.restore();
  }
  const foliageClusterTex = new THREE.CanvasTexture(fCanvas);
  foliageClusterTex.colorSpace = THREE.SRGBColorSpace;

  return { vaporTex, sparkTex, sunGlowTex, foliageClusterTex };
}

/**
 * Natural photorealistic human skin texture (warm subtle pores, rosy fingertip & knuckle blush, micro-normal)
 */
export function createSkinTextures() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nBroad = fbm(x * 0.03, y * 0.03, 3, 401);
      const nPore = fbm(x * 0.28, y * 0.28, 2, 419);
      const crease = Math.sin(y * 0.22 + nBroad * 2.5) * 0.5 + 0.5;

      // Natural warm Japanese skin tone catching golden evening light
      const r = 216 + (nBroad - 0.5) * 20 + (nPore - 0.5) * 8;
      const g = 158 + (nBroad - 0.5) * 18 + (nPore - 0.5) * 7;
      const b = 128 + (nBroad - 0.5) * 16 + (nPore - 0.5) * 6;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      heightBuf[y * size + x] = nPore * 0.6 + crease * 0.25 + nBroad * 0.15;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(heightBuf, size, size, 0.85, 2);
  return { map, normalMap };
}
