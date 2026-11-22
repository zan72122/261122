import * as THREE from 'three';

// Deterministic PRNG for consistent photorealistic procedural textures
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

function hash2(x, y, seed = 0) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm2D(x, y, octaves = 4, seed = 0) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += valueNoise2D(x * freq, y * freq, seed + i * 31) * amp;
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

// Convert a grayscale height canvas into a tangent-space normal map texture
function heightCanvasToNormalTexture(heightCanvas, strength = 2.0, repeatX = 1, repeatY = 1) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d');
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = makeCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

function finalizeTexture(canvas, { srgb = true, repeatX = 1, repeatY = 1, clamp = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

// 1. Dark Walnut / Warm Oak Dining Table PBR (1024x1024)
export function createWoodTableTextures() {
  const size = 1024;
  const colorC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const rCtx = roughC.getContext('2d');
  const hCtx = heightC.getContext('2d');

  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  const plankCount = 5;
  const plankH = size / plankCount;

  for (let y = 0; y < size; y++) {
    const plankIdx = Math.floor(y / plankH);
    const localY = (y % plankH) / plankH;
    const seamDist = Math.min(localY, 1 - localY) * plankH;
    const seamFactor = Math.min(1, seamDist / 3.5);
    const plankTone = 0.88 + hash2(plankIdx, 7, 11) * 0.22;
    const offsetX = hash2(plankIdx, 3, 19) * 40;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = fbm2D(u * 4.5 + offsetX, v * 14.0, 3, 101) * 2.2;
      const ring = Math.sin((v * 42 + warp * 3.8 + plankIdx * 5.7) * Math.PI);
      const grain = 0.5 + 0.5 * ring;
      const fineFibers = fbm2D(u * 60 + offsetX, v * 180, 2, 202);
      const pore = fbm2D(u * 120, v * 35, 2, 303);

      const t = (grain * 0.62 + fineFibers * 0.28 + pore * 0.1) * plankTone;
      const darkSeam = 0.42 + 0.58 * seamFactor;

      const r = Math.min(255, Math.max(0, Math.round((48 + t * 44) * darkSeam)));
      const g = Math.min(255, Math.max(0, Math.round((30 + t * 28) * darkSeam)));
      const b = Math.min(255, Math.max(0, Math.round((19 + t * 17) * darkSeam)));

      const idx = (y * size + x) * 4;
      cImg.data[idx] = r;
      cImg.data[idx + 1] = g;
      cImg.data[idx + 2] = b;
      cImg.data[idx + 3] = 255;

      // Satin oil-rubbed walnut: natural matte-satin sheen (0.42 - 0.68), no harsh plastic streaks
      const roughVal = Math.round((0.44 + (1 - grain) * 0.14 + (1 - pore) * 0.12 + (1 - seamFactor) * 0.25) * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = Math.min(255, roughVal);
      rImg.data[idx + 3] = 255;

      const hVal = Math.round(((grain * 0.4 + fineFibers * 0.35 + pore * 0.25) * seamFactor) * 255);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hVal;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true }),
    roughnessMap: finalizeTexture(roughC, { srgb: false }),
    normalMap: heightCanvasToNormalTexture(heightC, 1.8),
  };
}

// 2. Authentic Banko-yaki / Shigaraki-yaki Donabe Ceramic PBR (1024x1024)
export function createDonabeTextures(variant = 'body') {
  const size = 1024;
  const colorC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const rCtx = roughC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const rng = mulberry32(variant === 'body' ? 4011 : 4099);

  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size; // Lathe UV v: 0 bottom -> 1 top
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wheelRings = Math.sin(v * 210 + fbm2D(u * 4, v * 12, 2, 12) * 2.5) * 0.5 + 0.5;
      const clayGrain = fbm2D(u * 48, v * 48, 4, 71);
      const mottle = fbm2D(u * 10, v * 10, 4, 83);
      const ironSpeck = hash2(Math.floor(x / 2), Math.floor(y / 2), 91);
      const hasSpeck = ironSpeck > 0.965 ? (ironSpeck - 0.965) / 0.035 : 0;

      let r, g, b, rough, h;

      if (variant === 'body') {
        // Dark roasted iron-brown & charcoal earthen glaze, slightly warmer unglazed terracotta foot near bottom
        const glazeMask = Math.min(1, Math.max(0, (v - 0.14) / 0.12));
        const rimGlow = Math.pow(Math.max(0, (v - 0.72) / 0.28), 1.6);

        // Unglazed warm clay foot
        const footR = 128 + clayGrain * 34;
        const footG = 94 + clayGrain * 26;
        const footB = 72 + clayGrain * 20;

        // Glazed deep Banko-yaki dark espresso-chestnut with mineral variation
        const glR = 46 + mottle * 36 + rimGlow * 34 - hasSpeck * 24;
        const glG = 35 + mottle * 26 + rimGlow * 26 - hasSpeck * 18;
        const glB = 30 + mottle * 20 + rimGlow * 18 - hasSpeck * 14;

        r = footR * (1 - glazeMask) + glR * glazeMask;
        g = footG * (1 - glazeMask) + glG * glazeMask;
        b = footB * (1 - glazeMask) + glB * glazeMask;

        // Glaze is glossy (0.14-0.28), foot is matte stoneware (0.85)
        rough = 0.86 * (1 - glazeMask) + (0.15 + (1 - mottle) * 0.14 + hasSpeck * 0.25) * glazeMask;
        h = clayGrain * 0.45 + wheelRings * 0.32 + mottle * 0.23 - hasSpeck * 0.18;
      } else {
        // Donabe Lid: warm ivory/ash-cream speckled ceramic glaze with chestnut-brown rim band & subtle kiln blush
        const rimBand = v < 0.14 ? 1 - Math.max(0, (v - 0.08) / 0.06) : 0;
        const warmBlush = fbm2D(u * 6, v * 6, 3, 155);
        const creamR = 222 + (warmBlush - 0.5) * 28 - hasSpeck * 115;
        const creamG = 211 + (warmBlush - 0.5) * 24 - hasSpeck * 110;
        const creamB = 192 + (warmBlush - 0.5) * 20 - hasSpeck * 100;

        const bandR = 68 + mottle * 28;
        const bandG = 48 + mottle * 20;
        const bandB = 36 + mottle * 16;

        r = creamR * (1 - rimBand) + bandR * rimBand;
        g = creamG * (1 - rimBand) + bandG * rimBand;
        b = creamB * (1 - rimBand) + bandB * rimBand;

        rough = 0.16 + (1 - mottle) * 0.12 + hasSpeck * 0.28;
        h = clayGrain * 0.35 + wheelRings * 0.38 + mottle * 0.27 - hasSpeck * 0.2;
      }

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      cImg.data[idx + 3] = 255;

      const rv = Math.min(255, Math.max(0, Math.round(rough * 255)));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;

      const hv = Math.min(255, Math.max(0, Math.round(h * 255)));
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  // Add subtle Kannyu (ceramic glaze crackle lines) to color and height
  cCtx.strokeStyle = variant === 'lid' ? 'rgba(115, 92, 68, 0.14)' : 'rgba(20, 14, 10, 0.16)';
  hCtx.strokeStyle = 'rgba(70, 70, 70, 0.25)';
  cCtx.lineWidth = 1.0;
  hCtx.lineWidth = 1.2;
  for (let i = 0; i < 65; i++) {
    let cx = rng() * size;
    let cy = rng() * size;
    let angle = rng() * Math.PI * 2;
    cCtx.beginPath();
    hCtx.beginPath();
    cCtx.moveTo(cx, cy);
    hCtx.moveTo(cx, cy);
    for (let s = 0; s < 7; s++) {
      angle += (rng() - 0.5) * 0.9;
      cx += Math.cos(angle) * (14 + rng() * 24);
      cy += Math.sin(angle) * (14 + rng() * 24);
      cCtx.lineTo(cx, cy);
      hCtx.lineTo(cx, cy);
    }
    cCtx.stroke();
    hCtx.stroke();
  }

  return {
    map: finalizeTexture(colorC, { srgb: true }),
    roughnessMap: finalizeTexture(roughC, { srgb: false }),
    normalMap: heightCanvasToNormalTexture(heightC, 2.2),
  };
}

// 3. Napa Cabbage (白菜) Leaf PBR (512x512)
export function createCabbageTextures() {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');

  // Base gradient: crisp translucent ivory-white stem (bottom v=0) -> rich crinkled jade-green leaf (top v=1)
  const grad = cCtx.createLinearGradient(0, size, 0, 0);
  grad.addColorStop(0.0, '#eae8d4');
  grad.addColorStop(0.28, '#dfe5ba');
  grad.addColorStop(0.52, '#a9cb68');
  grad.addColorStop(0.78, '#6aa336');
  grad.addColorStop(1.0, '#447a22');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#707070';
  hCtx.fillRect(0, 0, size, size);

  // Crinkled organic savoy-like leaf cellular dimples
  const cImg = cCtx.getImageData(0, 0, size, size);
  const hImg = hCtx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const v = 1 - y / size; // 0 stem -> 1 tip
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const distCenter = Math.abs(u - 0.5) * 2;
      const crinkle = fbm2D(u * 26, v * 26, 4, 512);
      const micro = fbm2D(u * 68, v * 68, 2, 521);
      const leafMask = Math.min(1, Math.max(0, (v - 0.22) * 1.45 + distCenter * 0.45));

      // Center fleshy white midrib
      const ribWidth = Math.max(0.04, 0.32 * (1 - v * 0.85));
      const rib = Math.exp(-Math.pow((u - 0.5) / ribWidth, 2));

      const idx = (y * size + x) * 4;
      const shade = 0.86 + crinkle * 0.24;
      let r = cImg.data[idx] * shade;
      let g = cImg.data[idx + 1] * shade;
      let b = cImg.data[idx + 2] * shade;

      // Blend crisp translucent white midrib
      r = r * (1 - rib * 0.82) + 247 * (rib * 0.82);
      g = g * (1 - rib * 0.82) + 246 * (rib * 0.82);
      b = b * (1 - rib * 0.82) + 231 * (rib * 0.82);

      cImg.data[idx] = Math.min(255, Math.round(r));
      cImg.data[idx + 1] = Math.min(255, Math.round(g));
      cImg.data[idx + 2] = Math.min(255, Math.round(b));

      const hVal = Math.min(255, Math.max(0, Math.round((0.35 + rib * 0.42 + crinkle * 0.35 * leafMask + micro * 0.12) * 255)));
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hVal;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  // Branching white-pale-green leaf veins radiating from central midrib
  for (let side of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const startY = size * (0.88 - i * 0.072);
      const startX = size * 0.5;
      const endX = size * (0.5 + side * (0.44 + (i % 3) * 0.04));
      const endY = startY - size * (0.12 + (i % 2) * 0.04);

      cCtx.strokeStyle = 'rgba(242, 245, 224, 0.65)';
      cCtx.lineWidth = Math.max(1.6, 5.2 - i * 0.32);
      cCtx.lineCap = 'round';
      cCtx.beginPath();
      cCtx.moveTo(startX, startY);
      cCtx.quadraticCurveTo(size * (0.5 + side * 0.22), startY - 12, endX, endY);
      cCtx.stroke();

      hCtx.strokeStyle = 'rgba(235, 235, 235, 0.72)';
      hCtx.lineWidth = cCtx.lineWidth + 1.2;
      hCtx.beginPath();
      hCtx.moveTo(startX, startY);
      hCtx.quadraticCurveTo(size * (0.5 + side * 0.22), startY - 12, endX, endY);
      hCtx.stroke();
    }
  }

  return {
    map: finalizeTexture(colorC, { srgb: true, clamp: true }),
    normalMap: heightCanvasToNormalTexture(heightC, 2.8),
  };
}

// 4. Silken Tofu (絹ごし豆腐) PBR (512x512)
export function createTofuTextures() {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const subtle = fbm2D(u * 18, v * 18, 3, 610);
      const fine = fbm2D(u * 75, v * 75, 2, 620);
      // Faint cotton-cloth grid imprint on tofu sides
      const cloth = (Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64)) * 0.5 + 0.5;
      // Rare tiny silken tofu micro-pores
      const poreNoise = valueNoise2D(u * 55, v * 55, 633);
      const pore = poreNoise > 0.93 ? (poreNoise - 0.93) / 0.07 : 0;

      const idx = (y * size + x) * 4;
      const warm = 0.96 + subtle * 0.04 - pore * 0.06;
      cImg.data[idx] = Math.round(252 * warm);
      cImg.data[idx + 1] = Math.round(248 * warm);
      cImg.data[idx + 2] = Math.round(236 * warm);
      cImg.data[idx + 3] = 255;

      const h = Math.min(255, Math.max(0, Math.round((0.55 + subtle * 0.14 + cloth * 0.07 + fine * 0.06 - pore * 0.45) * 255)));
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true }),
    normalMap: heightCanvasToNormalTexture(heightC, 1.1),
  };
}

// 5. Shiitake Mushroom Cap with Decorative Star Cut (花切りしいたけ) PBR (512x512)
export function createShiitakeTextures() {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);

      const n1 = fbm2D(x * 0.035, y * 0.035, 4, 701);
      const radialFib = fbm2D(Math.cos(ang) * 6 + dist * 12, Math.sin(ang) * 6 + dist * 12, 3, 719);

      // Decorative 3-line star cut (花切り) right in the center of the cap
      let cut = 0;
      if (dist < 0.54) {
        for (let k = 0; k < 3; k++) {
          const theta = (k * Math.PI) / 3 + 0.2;
          const perp = Math.abs(dx * Math.sin(theta) - dy * Math.cos(theta));
          const along = Math.abs(dx * Math.cos(theta) + dy * Math.sin(theta));
          const maxW = 0.10 * Math.max(0, 1 - along / 0.54);
          if (perp < maxW) {
            const depth = 1 - perp / Math.max(0.001, maxW);
            cut = Math.max(cut, depth);
          }
        }
      }

      // Rich roasted chestnut-brown shiitake skin, paler near curled rim
      const edgeLight = Math.pow(Math.min(1, dist), 2.2) * 35;
      let r = 82 + n1 * 42 + radialFib * 20 + edgeLight;
      let g = 54 + n1 * 30 + radialFib * 14 + edgeLight * 0.8;
      let b = 36 + n1 * 20 + radialFib * 10 + edgeLight * 0.6;

      // Creamy white inner flesh exposed by the decorative star cut
      const cutBlend = Math.min(1, cut * 1.45);
      r = r * (1 - cutBlend) + (242 - (1 - cut) * 22) * cutBlend;
      g = g * (1 - cutBlend) + (232 - (1 - cut) * 25) * cutBlend;
      b = b * (1 - cutBlend) + (208 - (1 - cut) * 28) * cutBlend;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      cImg.data[idx + 3] = 255;

      const h = Math.min(255, Math.max(0, Math.round((0.72 + n1 * 0.18 + radialFib * 0.1 - cut * 0.68) * 255)));
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  // Underside radial gills texture
  const gillC = makeCanvas(256, 256);
  const gCtx = gillC.getContext('2d');
  gCtx.fillStyle = '#e6d8be';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    gCtx.strokeStyle = i % 2 === 0 ? 'rgba(155, 132, 98, 0.55)' : 'rgba(248, 240, 224, 0.55)';
    gCtx.lineWidth = 1.6;
    gCtx.beginPath();
    gCtx.moveTo(128 + Math.cos(a) * 18, 128 + Math.sin(a) * 18);
    gCtx.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126);
    gCtx.stroke();
  }

  return {
    capMap: finalizeTexture(colorC, { srgb: true, clamp: true }),
    capNormal: heightCanvasToNormalTexture(heightC, 2.8),
    gillMap: finalizeTexture(gillC, { srgb: true, clamp: true }),
  };
}

// 6. Knit Wool Sweater PBR for Family (512x512)
export function createKnitSweaterTextures(baseHex, accentHex, seed = 900) {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');

  const base = new THREE.Color(baseHex);
  const accent = new THREE.Color(accentHex);

  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  const stitchX = 28;
  const stitchY = 34;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // V-shaped knitted yarn stitches + gentle vertical rib
      const sx = (u * stitchX) % 1;
      const sy = (v * stitchY) % 1;
      const half = Math.abs(sx - 0.5) * 2; // 0 center, 1 edge
      const vShift = (sy + half * 0.45) % 1;
      const stitchBump = Math.sin(vShift * Math.PI) * Math.sin(Math.min(1, half * 1.15) * Math.PI);
      const rib = 0.5 + 0.5 * Math.cos(u * Math.PI * 14);
      const fuzz = fbm2D(u * 90, v * 90, 3, seed);

      const mix = Math.min(1, Math.max(0, 0.35 + stitchBump * 0.45 + (fuzz - 0.5) * 0.28));
      const shade = 0.72 + stitchBump * 0.24 + rib * 0.1;

      const r = (base.r * (1 - mix * 0.25) + accent.r * (mix * 0.25)) * shade;
      const g = (base.g * (1 - mix * 0.25) + accent.g * (mix * 0.25)) * shade;
      const b = (base.b * (1 - mix * 0.25) + accent.b * (mix * 0.25)) * shade;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, Math.round(r * 255)));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
      cImg.data[idx + 3] = 255;

      const h = Math.min(255, Math.max(0, Math.round((0.25 + stitchBump * 0.48 + rib * 0.16 + fuzz * 0.14) * 255)));
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true, repeatX: 2.5, repeatY: 2.5 }),
    normalMap: heightCanvasToNormalTexture(heightC, 2.6, 2.5, 2.5),
  };
}

// 7. Realistic Human Skin PBR (512x512) — optional face-mapped natural cheek blush & soft shading
export function createSkinTextures(baseHex = '#eec3a8', blushHex = '#e69484', seed = 1200, isFace = false) {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const base = new THREE.Color(baseHex);
  const blush = new THREE.Color(blushHex);

  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size; // 0 top of head -> 1 bottom of chin
      const mottle = fbm2D(u * 10, v * 10, 3, seed);
      const pores = fbm2D(u * 95, v * 95, 2, seed + 55);
      const warmVar = (mottle - 0.5) * 0.055;

      let blushAmt = mottle * 0.09;
      let shade = 1.0;

      if (isFace) {
        // SphereGeometry UV: +Z (front face) is at u = 0.25, v = 0.50
        const du = Math.atan2(Math.sin((u - 0.25) * Math.PI * 2), Math.cos((u - 0.25) * Math.PI * 2)) / Math.PI;
        const dv = (v - 0.50) * 2.0; // -1 top, 0 equator, +1 bottom

        // Soft rose winter blush on cheeks & subtle warmth on nose bridge
        const cheekL = Math.exp(-Math.pow((du + 0.145) / 0.088, 2) - Math.pow((dv - 0.11) / 0.11, 2));
        const cheekR = Math.exp(-Math.pow((du - 0.145) / 0.088, 2) - Math.pow((dv - 0.11) / 0.11, 2));
        const noseTip = Math.exp(-Math.pow(du / 0.042, 2) - Math.pow((dv - 0.04) / 0.055, 2)) * 0.28;
        blushAmt += (cheekL + cheekR + noseTip) * 0.26;

        // Soft warm natural lip shading baked smoothly around mouth area
        const lipZone = Math.exp(-Math.pow(du / 0.068, 2) - Math.pow((dv - 0.24) / 0.032, 2));
        blushAmt += lipZone * 0.42;

        // Subtle warm portrait shading in eye sockets, under nose, & under jaw
        const sockL = Math.exp(-Math.pow((du + 0.11) / 0.058, 2) - Math.pow((dv + 0.08) / 0.065, 2));
        const sockR = Math.exp(-Math.pow((du - 0.11) / 0.058, 2) - Math.pow((dv + 0.08) / 0.065, 2));
        const underNose = Math.exp(-Math.pow(du / 0.045, 2) - Math.pow((dv - 0.12) / 0.025, 2));
        shade -= (sockL + sockR) * 0.10 + underNose * 0.08;
        shade -= Math.max(0, dv - 0.42) * 0.22;
      }

      const bMix = Math.min(0.65, blushAmt);
      const r = Math.min(1, Math.max(0, (base.r * (1 - bMix) + blush.r * bMix + warmVar) * shade));
      const g = Math.min(1, Math.max(0, (base.g * (1 - bMix) + blush.g * bMix + warmVar * 0.8) * shade));
      const b = Math.min(1, Math.max(0, (base.b * (1 - bMix) + blush.b * bMix + warmVar * 0.6) * shade));

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.round(r * 255);
      cImg.data[idx + 1] = Math.round(g * 255);
      cImg.data[idx + 2] = Math.round(b * 255);
      cImg.data[idx + 3] = 255;

      const h = Math.round((0.45 + pores * 0.24 + mottle * 0.14) * 255);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true }),
    normalMap: heightCanvasToNormalTexture(heightC, 0.55),
  };
}

// 7b. Brushed Dark Metal Texture for Cassette Stove (512x512)
export function createBrushedMetalTextures() {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const rCtx = roughC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const streak = fbm2D(0.5, y * 0.45, 3, 2901);
    for (let x = 0; x < size; x++) {
      const fine = hash2(x >> 2, y, 2909);
      const t = streak * 0.7 + fine * 0.3;
      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.round(44 + t * 24);
      cImg.data[idx + 1] = Math.round(41 + t * 22);
      cImg.data[idx + 2] = Math.round(39 + t * 20);
      cImg.data[idx + 3] = 255;

      const rv = Math.round((0.28 + t * 0.20) * 255);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  return {
    map: finalizeTexture(colorC, { srgb: true }),
    roughnessMap: finalizeTexture(roughC, { srgb: false }),
  };
}

// 8. Natural Hair Strand PBR (512x512)
export function createHairTextures(baseHex = '#231915', highlightHex = '#48342a', seed = 1400) {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const base = new THREE.Color(baseHex);
  const hi = new THREE.Color(highlightHex);
  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const wave = Math.sin(v * 14 + fbm2D(u * 6, v * 4, 2, seed) * 2.5) * 0.015;
      const strands = fbm2D((u + wave) * 140, v * 10, 3, seed + 17);
      const sheenBand = Math.exp(-Math.pow((v - 0.38) / 0.18, 2)) * 0.35;

      const t = Math.min(1, strands * 0.7 + sheenBand);
      const r = base.r * (1 - t) + hi.r * t;
      const g = base.g * (1 - t) + hi.g * t;
      const b = base.b * (1 - t) + hi.b * t;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.round(r * 255);
      cImg.data[idx + 1] = Math.round(g * 255);
      cImg.data[idx + 2] = Math.round(b * 255);
      cImg.data[idx + 3] = 255;

      const h = Math.round(strands * 255);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true, repeatX: 2, repeatY: 1 }),
    normalMap: heightCanvasToNormalTexture(heightC, 1.8, 2, 1),
  };
}

// 9. Realistic Human Iris / Eye Texture (256x256)
export function createEyeTexture(irisHex = '#3c2416') {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  // Sclera with slight warm natural tint at edges
  const bg = ctx.createRadialGradient(128, 128, 36, 128, 128, 128);
  bg.addColorStop(0, '#fcfaf7');
  bg.addColorStop(0.65, '#f6efe9');
  bg.addColorStop(1, '#dec9be');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Limbal ring + rich warm dark brown iris (slightly larger & livelier with crisp twin catchlights)
  const irisR = 54;
  const irisGrad = ctx.createRadialGradient(128, 128, 12, 128, 128, irisR);
  irisGrad.addColorStop(0, '#140c08');
  irisGrad.addColorStop(0.35, irisHex);
  irisGrad.addColorStop(0.84, '#24140c');
  irisGrad.addColorStop(1, '#100906');
  ctx.beginPath();
  ctx.arc(128, 128, irisR, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Subtle iris radial fibers
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(138, 86, 50, 0.28)' : 'rgba(20, 10, 6, 0.25)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 18, 128 + Math.sin(a) * 18);
    ctx.lineTo(128 + Math.cos(a) * (irisR - 4), 128 + Math.sin(a) * (irisR - 4));
    ctx.stroke();
  }

  // Pupil
  ctx.beginPath();
  ctx.arc(128, 128, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#090707';
  ctx.fill();

  // Crisp twin photographic catchlights
  ctx.beginPath();
  ctx.arc(113, 112, 9.0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 250, 240, 0.96)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(144, 138, 4.0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(205, 228, 255, 0.72)';
  ctx.fill();

  return finalizeTexture(c, { srgb: true, clamp: true });
}

// 10. Japanese Ceramic Serving Bowl (とんすい) Glaze (512x512)
export function createBowlTextures(baseHex, rimHex, seed = 1800) {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const base = new THREE.Color(baseHex);
  const rim = new THREE.Color(rimHex);
  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rimMask = Math.pow(Math.max(0, (v - 0.80) / 0.20), 1.5);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const mottle = fbm2D(u * 14, v * 14, 3, seed);
      const speck = hash2(Math.floor(x / 2), Math.floor(y / 2), seed + 9) > 0.972 ? 1 : 0;
      const ring = Math.sin(v * 140) * 0.5 + 0.5;

      const r = (base.r * (1 - rimMask) + rim.r * rimMask) * (0.88 + mottle * 0.2) - speck * 0.22;
      const g = (base.g * (1 - rimMask) + rim.g * rimMask) * (0.88 + mottle * 0.2) - speck * 0.22;
      const b = (base.b * (1 - rimMask) + rim.b * rimMask) * (0.88 + mottle * 0.2) - speck * 0.20;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, Math.max(0, Math.round(r * 255)));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
      cImg.data[idx + 3] = 255;

      const h = Math.round((0.45 + ring * 0.22 + mottle * 0.25 - speck * 0.2) * 255);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true }),
    normalMap: heightCanvasToNormalTexture(heightC, 1.2),
  };
}

// 11. Light Hinoki Cypress Wood Platter Texture (512x512)
export function createPlatterWoodTextures() {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = fbm2D(u * 3.5, v * 8, 3, 2100);
      const grain = Math.sin((v * 34 + warp * 4.5) * Math.PI) * 0.5 + 0.5;
      const fine = fbm2D(u * 50, v * 120, 2, 2110);
      const t = grain * 0.65 + fine * 0.35;

      const idx = (y * size + x) * 4;
      // Rich warm handcrafted keyaki/cedar platter tone so white tofu & cabbage pop vividly!
      cImg.data[idx] = Math.round(138 + t * 40);
      cImg.data[idx + 1] = Math.round(98 + t * 32);
      cImg.data[idx + 2] = Math.round(62 + t * 22);
      cImg.data[idx + 3] = 255;

      const h = Math.round(t * 255);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true }),
    normalMap: heightCanvasToNormalTexture(heightC, 1.3),
  };
}

// 12. Soft Volumetric Steam Wisps Sprite Texture (256x256)
export function createSteamTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radial = Math.max(0, 1 - dist);
      const soft = radial * radial * (3 - 2 * radial);

      const n = fbm2D(x * 0.025 + 4.2, y * 0.025 + 1.7, 4, 2401);
      const n2 = fbm2D(x * 0.055 + 9.1, y * 0.055 + 6.3, 3, 2411);
      const alpha = Math.min(1, Math.max(0, soft * (0.45 + n * 0.72) * (0.65 + n2 * 0.45)));

      const idx = (y * size + x) * 4;
      // Slightly warm top-lit steam tint
      img.data[idx] = 255;
      img.data[idx + 1] = 248;
      img.data[idx + 2] = 238;
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return finalizeTexture(c, { srgb: true, clamp: true });
}

// 13. Woven Japanese Linen Curtain / Wall Plaster Texture (512x512)
export function createPlasterWallTexture() {
  const size = 512;
  const colorC = makeCanvas(size, size);
  const heightC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const hCtx = heightC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = fbm2D(u * 12, v * 12, 4, 2700);
      const n2 = fbm2D(u * 48, v * 48, 2, 2711);
      const idx = (y * size + x) * 4;
      const t = 0.85 + n1 * 0.16 + (n2 - 0.5) * 0.06;
      cImg.data[idx] = Math.min(255, Math.round(92 * t));
      cImg.data[idx + 1] = Math.min(255, Math.round(78 * t));
      cImg.data[idx + 2] = Math.min(255, Math.round(66 * t));
      cImg.data[idx + 3] = 255;

      const h = Math.round((n1 * 0.6 + n2 * 0.4) * 255);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = h;
      hImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  return {
    map: finalizeTexture(colorC, { srgb: true, repeatX: 3, repeatY: 2 }),
    normalMap: heightCanvasToNormalTexture(heightC, 1.4, 3, 2),
  };
}
