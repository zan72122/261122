import * as THREE from 'three';

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

function hash2D(x, y, seed = 1337) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, y, seed = 1337) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2D(xi, yi, seed);
  const b = hash2D(xi + 1, yi, seed);
  const c = hash2D(xi, yi + 1, seed);
  const d = hash2D(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm2D(x, y, octaves = 4, seed = 1337) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq, seed + i * 71);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return val / norm;
}

/**
 * Generates a high-contrast sunlit Japanese summer outdoor environment map via PMREMGenerator.
 */
export function createSummerEnvironmentMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const sunDir = new THREE.Vector3(0.58, 0.72, -0.38).normalize();
  const dir = new THREE.Vector3();

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const theta = u * Math.PI * 2;
      dir.set(Math.cos(theta) * sinPhi, cosPhi, Math.sin(theta) * sinPhi);

      let r, g, b;
      if (dir.y >= 0) {
        const t = Math.pow(dir.y, 0.52);
        r = THREE.MathUtils.lerp(0.86, 0.10, t);
        g = THREE.MathUtils.lerp(0.94, 0.42, t);
        b = THREE.MathUtils.lerp(1.0, 0.94, t);

        if (dir.y > 0.03 && dir.y < 0.65) {
          const n = fbm2D(theta * 2.8, dir.y * 5.4, 4, 404);
          const cloudMask = THREE.MathUtils.smoothstep(n, 0.48, 0.72) *
            THREE.MathUtils.smoothstep(dir.y, 0.03, 0.14) *
            (1 - THREE.MathUtils.smoothstep(dir.y, 0.36, 0.64));
          const sunAlign = Math.max(0, dir.dot(sunDir));
          const cBright = 0.98 + 0.32 * sunAlign;
          r = THREE.MathUtils.lerp(r, cBright, cloudMask * 0.92);
          g = THREE.MathUtils.lerp(g, 0.99 * cBright, cloudMask * 0.92);
          b = THREE.MathUtils.lerp(b, 0.96 * cBright, cloudMask * 0.88);
        }

        const sunDot = Math.max(0, dir.dot(sunDir));
        const halo = Math.pow(sunDot, 14) * 0.85 + Math.pow(sunDot, 160) * 4.5;
        r += halo * 1.18;
        g += halo * 1.06;
        b += halo * 0.86;
      } else {
        // Warm sunlit veranda concrete bounce + subtle foliage green near horizon
        const gT = Math.pow(-dir.y, 0.45);
        const concreteN = fbm2D(theta * 5, dir.y * 5, 3, 912);
        const grain = 0.88 + concreteN * 0.20;
        r = THREE.MathUtils.lerp(0.68, 0.44, gT) * grain;
        g = THREE.MathUtils.lerp(0.69, 0.43, gT) * grain;
        b = THREE.MathUtils.lerp(0.64, 0.40, gT) * grain;
      }

      const idx = (y * w + x) * 4;
      data[idx] = Math.min(255, Math.round((r / (1 + r * 0.22)) * 255));
      data[idx + 1] = Math.min(255, Math.round((g / (1 + g * 0.22)) * 255));
      data[idx + 2] = Math.min(255, Math.round((b / (1 + b * 0.22)) * 255));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const equirect = new THREE.CanvasTexture(canvas);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;
  const envRT = pmrem.fromEquirectangular(equirect);
  equirect.dispose();
  pmrem.dispose();
  return envRT.texture;
}

/**
 * Generates a realistic distant Japanese summer neighborhood & leafy tree backdrop panorama (1024x384).
 * Replaces low-poly geometric house/tree primitives with atmospheric real-feeling depth,
 * tiled roofs, sunlit walls, dappled green treetops, utility poles, and summer power lines!
 */
export function createNeighborhoodBackdropTexture() {
  const w = 1024;
  const h = 384;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const rand = mulberry32(8842);

  // 1. Far misty blue-green summer mountains / distant tree ridge along horizon
  ctx.fillStyle = 'rgba(138, 174, 198, 0.58)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 16) {
    const ridge = h * 0.56 - Math.sin(x * 0.008) * 26 - fbm2D(x * 0.012, 1.5, 3, 12) * 34;
    ctx.lineTo(x, ridge);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // 2. Distant sunlit Japanese suburban roofs & low-rise apartments (soft atmospheric perspective)
  const houseCount = 18;
  for (let i = 0; i < houseCount; i++) {
    const hx = (i / houseCount) * w + (rand() - 0.5) * 32;
    const hw = 48 + rand() * 54;
    const hh = 72 + rand() * 68;
    const hy = h - hh + 24;

    // Warm sunlit exterior stucco wall + shadowed side
    const wallTone = 212 + Math.floor(rand() * 28);
    ctx.fillStyle = `rgb(${wallTone}, ${wallTone - 4}, ${wallTone - 12})`;
    ctx.fillRect(hx, hy, hw, hh);
    // Crisp shadow side on left (sun comes from upper right!)
    ctx.fillStyle = `rgba(92, 114, 142, 0.28)`;
    ctx.fillRect(hx, hy, hw * 0.34, hh);

    // Subtle shuttered windows / balcony lines
    ctx.fillStyle = 'rgba(72, 86, 106, 0.52)';
    const cols = Math.max(1, Math.floor(hw / 24));
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillRect(hx + 8 + col * 20, hy + 16 + r * 24, 11, 13);
      }
    }

    // Classic Japanese kawara tiled pitched roof (slate blue-gray / warm clay)
    const roofPalettes = [
      ['#556272', '#3c4755'],
      ['#6b5d56', '#4d423d'],
      ['#4d5b68', '#35404a'],
      ['#786455', '#58483c']
    ];
    const pal = roofPalettes[i % roofPalettes.length];
    const roofH = 22 + rand() * 16;
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy + 2);
    ctx.lineTo(hx + hw * 0.52, hy - roofH);
    ctx.lineTo(hx + hw + 8, hy + 2);
    ctx.closePath();
    ctx.fill();

    // Shadow slope on left half of roof
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy + 2);
    ctx.lineTo(hx + hw * 0.52, hy - roofH);
    ctx.lineTo(hx + hw * 0.36, hy + 2);
    ctx.closePath();
    ctx.fill();

    // Subtle tile ridge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy + 1);
    ctx.lineTo(hx + hw + 6, hy + 1);
    ctx.stroke();
  }

  // 3. Detailed layered leafy summer tree crowns (fine photographic stippled foliage — NOT big circles!)
  function drawLeafyTree(cx, cy, radius) {
    // Deep shaded inner canopy base
    for (let i = 0; i < 36; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * radius * 0.85;
      const lx = cx + Math.cos(ang) * dist * 1.15;
      const ly = cy + Math.sin(ang) * dist * 0.78 + radius * 0.12;
      const lr = 5 + rand() * 8;
      ctx.fillStyle = `rgba(38, 76, 44, ${0.55 + rand() * 0.3})`;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine multi-tone sunlit summer leaves (tiny 2.5..7px dapple clusters!)
    for (let i = 0; i < 150; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * radius;
      const lx = cx + Math.cos(ang) * dist * 1.18;
      const ly = cy + Math.sin(ang) * dist * 0.80;
      const lr = 2.4 + rand() * 5.2;

      const sunFactor = clamp01((Math.cos(ang - 0.85) * 0.5 + 0.5) * (1 - (ly - (cy - radius)) / (radius * 1.9)));
      const rCol = Math.round(42 + sunFactor * 86 + (rand() - 0.5) * 18);
      const gCol = Math.round(86 + sunFactor * 94 + (rand() - 0.5) * 20);
      const bCol = Math.round(46 + sunFactor * 36 + (rand() - 0.5) * 14);

      ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${0.72 + rand() * 0.28})`;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr * 1.2, lr * 0.85, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crisp sun-rim specular leaf tips on upper-right edge
    for (let i = 0; i < 45; i++) {
      const lx = cx + (rand() - 0.15) * radius * 1.05;
      const ly = cy - rand() * radius * 0.74;
      ctx.fillStyle = `rgba(182, 218, 122, ${0.38 + rand() * 0.35})`;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.8 + rand() * 3.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  const treeSpots = [
    [95, h - 62, 46],
    [255, h - 52, 54],
    [430, h - 68, 50],
    [545, h - 48, 44],
    [715, h - 60, 56],
    [885, h - 55, 48],
    [985, h - 66, 42]
  ];
  for (const [tx, ty, tr] of treeSpots) {
    drawLeafyTree(tx, ty, tr);
  }

  // 4. Iconic Japanese concrete utility poles & delicate catenary summer power lines!
  const poleXs = [180, 625, 920];
  ctx.strokeStyle = 'rgba(84, 96, 112, 0.55)';
  ctx.fillStyle = 'rgba(132, 140, 150, 0.68)';
  for (const px of poleXs) {
    ctx.fillRect(px - 3, 62, 6, h - 62);
    // Cross-arms
    ctx.fillRect(px - 18, 86, 36, 3);
    ctx.fillRect(px - 14, 108, 28, 3);
  }
  // Delicate sagging power cables across the bright sky
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = 'rgba(65, 78, 96, 0.36)';
  for (const wy of [88, 109]) {
    ctx.beginPath();
    ctx.moveTo(0, wy + 12);
    ctx.quadraticCurveTo(90, wy + 26, 180, wy);
    ctx.quadraticCurveTo(402, wy + 34, 625, wy);
    ctx.quadraticCurveTo(772, wy + 26, 920, wy);
    ctx.quadraticCurveTo(975, wy + 18, w, wy + 8);
    ctx.stroke();
  }

  // 5. Soft sunlit summer aerial-perspective haze wash at bottom so it blends seamlessly behind veranda
  const haze = ctx.createLinearGradient(0, h * 0.25, 0, h);
  haze.addColorStop(0, 'rgba(195, 226, 252, 0.0)');
  haze.addColorStop(0.55, 'rgba(205, 232, 252, 0.22)');
  haze.addColorStop(1, 'rgba(218, 236, 250, 0.44)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.25, w, h * 0.75);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates a realistic botanical green leaf texture with midrib, veins, serrated silhouette & alpha cutout.
 */
export function createBotanicalLeafTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Leaf silhouette
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(128, 238);
  ctx.bezierCurveTo(46, 205, 36, 105, 128, 18);
  ctx.bezierCurveTo(220, 105, 210, 205, 128, 238);
  ctx.closePath();

  // Natural summer green gradient
  const grad = ctx.createLinearGradient(60, 20, 196, 236);
  grad.addColorStop(0, '#6bb846');
  grad.addColorStop(0.45, '#469635');
  grad.addColorStop(1, '#2f6e25');
  ctx.fillStyle = grad;
  ctx.fill();

  // Crisp botanical veins
  ctx.clip();
  ctx.strokeStyle = 'rgba(178, 224, 118, 0.55)';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(128, 238);
  ctx.lineTo(128, 28);
  ctx.stroke();

  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const y = 205 - i * 28;
    const span = 62 - Math.abs(i - 2) * 10;
    ctx.beginPath();
    ctx.moveTo(128, y);
    ctx.quadraticCurveTo(128 - span * 0.5, y - 10, 128 - span, y - 26);
    ctx.moveTo(128, y);
    ctx.quadraticCurveTo(128 + span * 0.5, y - 10, 128 + span, y - 26);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates weathered sunlit Japanese veranda concrete textures + high-contrast glossy wet puddle layer.
 */
export function createVerandaConcreteTextures() {
  const size = 1024;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = size;
  baseCanvas.height = size;
  const bCtx = baseCanvas.getContext('2d');
  const bImg = bCtx.createImageData(size, size);
  const bData = bImg.data;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');
  const bumpImg = bumpCtx.createImageData(size, size);
  const bumpData = bumpImg.data;

  const dryRough = new Uint8Array(size * size);
  const rand = mulberry32(2026);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;

      const macro = fbm2D(nx * 6.0, ny * 6.0, 4, 101);
      const mid = fbm2D(nx * 28, ny * 28, 3, 202);
      const fine = hash2D(x, y, 303);

      // Sun-baked Japanese veranda concrete: warm light stone gray with authentic micro-aggregate
      let lum = 186 + (macro - 0.5) * 38 + (mid - 0.5) * 26 + (fine - 0.5) * 24;

      // Recessed control joint grooves
      const jointY = Math.abs(ny - 0.52);
      const jointX = Math.abs(nx - 0.50);
      let groove = 0;
      if (jointY < 0.0042) groove = Math.max(groove, 1 - jointY / 0.0042);
      if (jointX < 0.0038) groove = Math.max(groove, 1 - jointX / 0.0038);
      lum -= groove * 62;

      // Fine dark sand specks & mineral flecks
      const speck = rand();
      if (speck > 0.98) lum -= 36;
      else if (speck < 0.015) lum += 24;

      const idx = (y * size + x) * 4;
      bData[idx] = Math.max(0, Math.min(255, Math.round(lum * 1.02)));
      bData[idx + 1] = Math.max(0, Math.min(255, Math.round(lum * 0.99)));
      bData[idx + 2] = Math.max(0, Math.min(255, Math.round(lum * 0.94)));
      bData[idx + 3] = 255;

      const bVal = Math.max(0, Math.min(255, Math.round(128 + (mid - 0.5) * 98 + (fine - 0.5) * 78 - groove * 120)));
      bumpData[idx] = bVal;
      bumpData[idx + 1] = bVal;
      bumpData[idx + 2] = bVal;
      bumpData[idx + 3] = 255;

      dryRough[y * size + x] = Math.max(165, Math.min(250, Math.round(226 + (macro - 0.5) * 28 - (fine - 0.5) * 16)));
    }
  }
  bCtx.putImageData(bImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext('2d');
  colorCtx.drawImage(baseCanvas, 0, 0);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');
  const rImg = roughCtx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = dryRough[i];
    rImg.data[i * 4] = v;
    rImg.data[i * 4 + 1] = v;
    rImg.data[i * 4 + 2] = v;
    rImg.data[i * 4 + 3] = 255;
  }
  roughCtx.putImageData(rImg, 0, 0);

  const dryRoughCanvas = document.createElement('canvas');
  dryRoughCanvas.width = size;
  dryRoughCanvas.height = size;
  dryRoughCanvas.getContext('2d').drawImage(roughCanvas, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 4;

  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.anisotropy = 4;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.anisotropy = 4;

  const wetSize = 256;
  const wetGrid = new Float32Array(wetSize * wetSize);
  let dirty = false;

  function addWetSplash(uvX, uvY, radiusUv, strength = 0.85) {
    const cx = Math.floor(uvX * wetSize);
    const cy = Math.floor((1 - uvY) * wetSize);
    const rad = Math.max(2, Math.floor(radiusUv * wetSize));
    const r2 = rad * rad;
    for (let dy = -rad; dy <= rad; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= wetSize) continue;
      for (let dx = -rad; dx <= rad; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= wetSize) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) {
          const falloff = 1 - Math.sqrt(d2) / rad;
          const organic = 0.72 + 0.55 * hash2D(px, py, 777);
          const idx = py * wetSize + px;
          wetGrid[idx] = Math.min(1, wetGrid[idx] + Math.pow(falloff, 1.4) * strength * organic);
        }
      }
    }
    dirty = true;
  }

  // Realistic glistening damp ring & splashes right around the bucket
  addWetSplash(0.455, 0.445, 0.085, 0.82);
  addWetSplash(0.495, 0.415, 0.055, 0.68);
  addWetSplash(0.405, 0.405, 0.048, 0.62);

  const wetMaskCanvas = document.createElement('canvas');
  wetMaskCanvas.width = wetSize;
  wetMaskCanvas.height = wetSize;
  const wetMaskCtx = wetMaskCanvas.getContext('2d');
  const wetMaskImg = wetMaskCtx.createImageData(wetSize, wetSize);

  function flushWetness(dt = 0) {
    if (dt > 0) {
      let any = false;
      const evap = dt * 0.006;
      for (let i = 0; i < wetGrid.length; i++) {
        if (wetGrid[i] > 0.001) {
          wetGrid[i] = Math.max(0, wetGrid[i] - evap);
          any = true;
        }
      }
      if (any) dirty = true;
    }
    if (!dirty) return;
    dirty = false;

    colorCtx.globalCompositeOperation = 'source-over';
    colorCtx.drawImage(baseCanvas, 0, 0);

    const md = wetMaskImg.data;
    for (let i = 0; i < wetGrid.length; i++) {
      const w = wetGrid[i];
      // Strong realistic wet concrete darkening!
      md[i * 4] = 36;
      md[i * 4 + 1] = 44;
      md[i * 4 + 2] = 56;
      md[i * 4 + 3] = Math.round(Math.min(1, w * 1.25) * 185);
    }
    wetMaskCtx.putImageData(wetMaskImg, 0, 0);
    colorCtx.globalCompositeOperation = 'multiply';
    colorCtx.drawImage(wetMaskCanvas, 0, 0, size, size);
    colorCtx.globalCompositeOperation = 'source-over';

    roughCtx.drawImage(dryRoughCanvas, 0, 0);
    for (let i = 0; i < wetGrid.length; i++) {
      const w = wetGrid[i];
      md[i * 4] = 8;
      md[i * 4 + 1] = 8;
      md[i * 4 + 2] = 8;
      md[i * 4 + 3] = Math.round(Math.pow(w, 0.65) * 248);
    }
    wetMaskCtx.putImageData(wetMaskImg, 0, 0);
    roughCtx.drawImage(wetMaskCanvas, 0, 0, size, size);

    colorTex.needsUpdate = true;
    roughTex.needsUpdate = true;
  }

  flushWetness(0);

  return {
    map: colorTex,
    roughnessMap: roughTex,
    bumpMap: bumpTex,
    addWetSplash,
    flushWetness
  };
}

/**
 * Generates cotton-canvas twill weave bump map for uwabaki upper.
 */
export function createCanvasWeaveMaps() {
  const size = 512;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const ctx = bumpCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin(x * 0.65) * 0.5 + 0.5;
      const weft = Math.sin(y * 0.65) * 0.5 + 0.5;
      const diag = Math.sin((x + y) * 0.45) * 0.5 + 0.5;
      const micro = hash2D(x, y, 505) * 0.14;
      const h = (warp * 0.35 + weft * 0.35 + diag * 0.30) * 0.86 + micro;
      const v = Math.max(0, Math.min(255, Math.round(h * 255)));
      const idx = (y * size + x) * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(4, 3);
  bumpTex.anisotropy = 4;
  return { bumpMap: bumpTex };
}

/**
 * Dynamic per-shoe Uwabaki fabric surface system:
 * Dirt (schoolyard mud & gray gym floor scuffs), Wetness (strong darkening & specular gloss),
 * Soap foam coating, and Sun-bleached drying back to dazzling warm cotton white!
 */
export function createDynamicUwabakiSurface(seed = 1) {
  const texSize = 512;
  const gridSize = 128;

  const dirt = new Float32Array(gridSize * gridSize);
  const wet = new Float32Array(gridSize * gridSize);
  const foam = new Float32Array(gridSize * gridSize);

  const rand = mulberry32(seed * 997 + 13);

  const weaveBase = new Float32Array(gridSize * gridSize);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = y * gridSize + x;
      const w = 0.965 + 0.035 * Math.sin((x + y) * 1.5) * Math.cos((x - y) * 1.3);
      const grain = 0.985 + 0.03 * hash2D(x, y, 71 + seed);
      weaveBase[idx] = w * grain;
    }
  }

  function resetMud(intensity = 1.0) {
    dirt.fill(0);
    wet.fill(0);
    foam.fill(0);

    // Realistic muddy uwabaki splotches concentrated on toe vamp, lower sides & heel!
    const blobs = 32;
    for (let i = 0; i < blobs; i++) {
      const bx = 0.08 + rand() * 0.84;
      const by = 0.08 + rand() * 0.78;
      const br = 0.07 + rand() * 0.14;
      const strength = (0.55 + rand() * 0.55) * intensity;

      for (let y = 0; y < gridSize; y++) {
        const v = y / gridSize;
        for (let x = 0; x < gridSize; x++) {
          const u = x / gridSize;
          const dx = u - bx;
          const dy = v - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < br) {
            const n = fbm2D(u * 15, v * 15, 3, seed * 37 + i * 11);
            const f = (1 - dist / br) * (0.58 + n * 0.85);
            const idx = y * gridSize + x;
            dirt[idx] = Math.min(1, dirt[idx] + f * strength);
          }
        }
      }
    }

    for (let i = 0; i < dirt.length; i++) {
      const x = i % gridSize;
      const y = (i - x) / gridSize;
      const baseGrime = 0.22 + 0.24 * fbm2D((x / gridSize) * 7, (y / gridSize) * 7, 3, seed * 89);
      dirt[i] = Math.min(1, Math.max(dirt[i], baseGrime * intensity));
    }
    dirtyFlag = true;
  }

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = texSize;
  colorCanvas.height = texSize;
  const colorCtx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = texSize;
  roughCanvas.height = texSize;
  const roughCtx = roughCanvas.getContext('2d');

  const gridColorCanvas = document.createElement('canvas');
  gridColorCanvas.width = gridSize;
  gridColorCanvas.height = gridSize;
  const gColorCtx = gridColorCanvas.getContext('2d');
  const gColorImg = gColorCtx.createImageData(gridSize, gridSize);

  const gridRoughCanvas = document.createElement('canvas');
  gridRoughCanvas.width = gridSize;
  gridRoughCanvas.height = gridSize;
  const gRoughCtx = gridRoughCanvas.getContext('2d');
  const gRoughImg = gRoughCtx.createImageData(gridSize, gridSize);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 4;

  let dirtyFlag = true;

  function scrubAt(u, v, radiusUv = 0.22, cleanPower = 0.28, foamPower = 0.35) {
    const cx = u * gridSize;
    const cy = (1 - v) * gridSize;
    const rad = radiusUv * gridSize;
    const minX = Math.max(0, Math.floor(cx - rad));
    const maxX = Math.min(gridSize - 1, Math.ceil(cx + rad));
    const minY = Math.max(0, Math.floor(cy - rad));
    const maxY = Math.min(gridSize - 1, Math.ceil(cy + rad));

    let removed = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < rad) {
          const f = 1 - d / rad;
          const smooth = f * f * (3 - 2 * f);
          const idx = y * gridSize + x;
          const prevDirt = dirt[idx];
          dirt[idx] = Math.max(0, dirt[idx] - smooth * cleanPower);
          removed += prevDirt - dirt[idx];
          wet[idx] = Math.min(1, wet[idx] + smooth * 0.62);
          foam[idx] = Math.min(1, foam[idx] + smooth * foamPower * (0.72 + 0.5 * hash2D(x, y, 91)));
        }
      }
    }
    dirtyFlag = true;
    return removed;
  }

  function rinseAt(u, v, radiusUv = 0.34, power = 0.32) {
    const cx = u * gridSize;
    const cy = (1 - v) * gridSize;
    const rad = radiusUv * gridSize;
    const minX = Math.max(0, Math.floor(cx - rad));
    const maxX = Math.min(gridSize - 1, Math.ceil(cx + rad));
    const minY = Math.max(0, Math.floor(cy - rad));
    const maxY = Math.min(gridSize - 1, Math.ceil(cy + rad));

    let washedFoam = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < rad) {
          const f = 1 - d / rad;
          const idx = y * gridSize + x;
          const prevF = foam[idx];
          foam[idx] = Math.max(0, foam[idx] - f * power);
          washedFoam += prevF - foam[idx];
          dirt[idx] = Math.max(0, dirt[idx] - f * power * 0.35);
          wet[idx] = Math.min(1, wet[idx] + f * 0.72);
        }
      }
    }
    dirtyFlag = true;
    return washedFoam;
  }

  function wetAll(amount = 0.45, foamAmount = 0) {
    for (let i = 0; i < wet.length; i++) {
      wet[i] = Math.min(1, wet[i] + amount);
      if (foamAmount > 0) {
        foam[i] = Math.min(1, foam[i] + foamAmount * (0.6 + 0.6 * hash2D(i & 127, i >> 7, 31)));
      }
    }
    dirtyFlag = true;
  }

  function dryStep(amount = 0.05) {
    let changed = false;
    for (let i = 0; i < wet.length; i++) {
      if (wet[i] > 0) {
        const yNorm = (i >> 7) / gridSize;
        const speed = amount * (1.28 - 0.48 * yNorm);
        wet[i] = Math.max(0, wet[i] - speed);
        changed = true;
      }
      if (foam[i] > 0) {
        foam[i] = Math.max(0, foam[i] - amount * 0.85);
        changed = true;
      }
    }
    if (changed) dirtyFlag = true;
  }

  function getStats() {
    let totalDirt = 0;
    let totalFoam = 0;
    let totalWet = 0;
    const n = dirt.length;
    for (let i = 0; i < n; i++) {
      totalDirt += dirt[i];
      totalFoam += foam[i];
      totalWet += wet[i];
    }
    return {
      dirtAvg: totalDirt / n,
      foamAvg: totalFoam / n,
      wetAvg: totalWet / n
    };
  }

  function updateTexture() {
    if (!dirtyFlag) return;
    dirtyFlag = false;

    const cd = gColorImg.data;
    const rd = gRoughImg.data;

    for (let i = 0; i < dirt.length; i++) {
      const d = dirt[i];
      const w = wet[i];
      const f = foam[i];
      const weave = weaveBase[i];

      // 1. Crisp sun-dried Japanese white cotton canvas
      let r = 250 * weave;
      let g = 248 * weave;
      let b = 244 * weave;

      // 2. Unmistakable wet cotton darkening & cool water-soaked tint!
      const wetDarken = 1 - w * 0.28;
      r *= wetDarken * (1 - w * 0.06);
      g *= wetDarken * (1 - w * 0.02);
      b *= wetDarken * (1 + w * 0.04);

      // 3. Playground brown mud & classroom gray scuffs
      if (d > 0.002) {
        const x = i & 127;
        const y = i >> 7;
        const mudTone = hash2D(x, y, 42 + seed);
        let mudR = 114 + mudTone * 38;
        let mudG = 93 + mudTone * 30;
        let mudB = 72 + mudTone * 22;
        const mudWet = 1 - w * 0.36;
        mudR *= mudWet;
        mudG *= mudWet;
        mudB *= mudWet;

        const dBlend = Math.min(1, d * 1.18);
        r = r * (1 - dBlend) + mudR * dBlend;
        g = g * (1 - dBlend) + mudG * dBlend;
        b = b * (1 - dBlend) + mudB * dBlend;
      }

      // 4. Frothy white soap lather clinging to wet fabric
      if (f > 0.005) {
        const fBlend = Math.min(0.95, Math.pow(f, 0.7) * 0.96);
        r = r * (1 - fBlend) + 253 * fBlend;
        g = g * (1 - fBlend) + 254 * fBlend;
        b = b * (1 - fBlend) + 255 * fBlend;
      }

      const p = i * 4;
      cd[p] = Math.max(0, Math.min(255, Math.round(r)));
      cd[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      cd[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      cd[p + 3] = 255;

      let rough = 238 - w * 155;
      rough = rough * (1 - f * 0.65) + 52 * (f * 0.65);
      const rv = Math.max(38, Math.min(248, Math.round(rough)));
      rd[p] = rv;
      rd[p + 1] = rv;
      rd[p + 2] = rv;
      rd[p + 3] = 255;
    }

    gColorCtx.putImageData(gColorImg, 0, 0);
    gRoughCtx.putImageData(gRoughImg, 0, 0);

    colorCtx.imageSmoothingEnabled = true;
    colorCtx.drawImage(gridColorCanvas, 0, 0, texSize, texSize);

    // Fine stitched collar binding & heel seam detail
    colorCtx.strokeStyle = 'rgba(180, 175, 166, 0.48)';
    colorCtx.lineWidth = 2;
    colorCtx.setLineDash([6, 4]);
    colorCtx.beginPath();
    colorCtx.moveTo(0, texSize * 0.09);
    colorCtx.lineTo(texSize, texSize * 0.09);
    colorCtx.moveTo(0, texSize * 0.92);
    colorCtx.lineTo(texSize, texSize * 0.92);
    colorCtx.stroke();
    colorCtx.setLineDash([]);

    roughCtx.imageSmoothingEnabled = true;
    roughCtx.drawImage(gridRoughCanvas, 0, 0, texSize, texSize);

    map.needsUpdate = true;
    roughnessMap.needsUpdate = true;
  }

  resetMud(1.0);
  updateTexture();

  return {
    map,
    roughnessMap,
    resetMud,
    scrubAt,
    rinseAt,
    wetAll,
    dryStep,
    getStats,
    updateTexture
  };
}

/**
 * Generates warm natural Japanese beechwood grain texture for the uwabaki scrub brush.
 */
export function createWoodTextures() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const bc = document.createElement('canvas');
  bc.width = size;
  bc.height = size;
  const bCtx = bc.getContext('2d');
  const bImg = bCtx.createImageData(size, size);
  const bd = bImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = fbm2D(u * 4, v * 1.4, 3, 606) * 0.24;
      const rings = Math.sin((u * 18 + warp * 16) * Math.PI) * 0.5 + 0.5;
      const fibers = valueNoise2D(u * 96, v * 14, 607);
      const t = rings * 0.62 + fibers * 0.38;

      const r = Math.round(176 + t * 48);
      const g = Math.round(132 + t * 40);
      const b = Math.round(88 + t * 28);

      const p = (y * size + x) * 4;
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = 255;

      const bv = Math.round(112 + t * 72);
      bd[p] = bv;
      bd[p + 1] = bv;
      bd[p + 2] = bv;
      bd[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bc);
  return { map, bumpMap };
}

/**
 * Generates warm, natural sun-kissed child human skin texture (not pale doll plastic!).
 */
export function createSkinTextures() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const bc = document.createElement('canvas');
  bc.width = size;
  bc.height = size;
  const bCtx = bc.getContext('2d');
  const bImg = bCtx.createImageData(size, size);
  const bd = bImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const blotch = fbm2D(u * 5, v * 5, 3, 808);
      const fine = hash2D(x, y, 809);
      // Warm peach-apricot summer skin with rosy undertone & fine skin micro-grain
      const warm = (blotch - 0.5) * 16 + (fine - 0.5) * 6;
      const rosy = Math.sin(v * Math.PI) * 10;

      const r = Math.max(0, Math.min(255, Math.round(234 + warm + rosy * 0.4)));
      const g = Math.max(0, Math.min(255, Math.round(176 + warm * 0.85 - rosy * 0.15)));
      const b = Math.max(0, Math.min(255, Math.round(142 + warm * 0.72 - rosy * 0.25)));

      const p = (y * size + x) * 4;
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = 255;

      const bv = Math.round(120 + fine * 34);
      bd[p] = bv;
      bd[p + 1] = bv;
      bd[p + 2] = bv;
      bd[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bc);
  return { map, bumpMap };
}

/**
 * Generates crisp dense micro-bubble froth texture for realistic creamy soap suds.
 */
export function createFoamBumpTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c2c2c2';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(4321);
  for (let i = 0; i < 620; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 2 + rand() * 11;
    const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.08, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.96)');
    grad.addColorStop(0.70, 'rgba(218,218,218,0.68)');
    grad.addColorStop(1, 'rgba(72,72,72,0.92)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Generates realistic Japanese exterior spray-textured stucco wall (吹き付けタイル / リシン壁).
 */
export function createWallStuccoTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2D((x / size) * 32, (y / size) * 32, 3, 991);
      const grain = hash2D(x, y, 992);
      const lum = 228 + (n - 0.5) * 20 + (grain - 0.5) * 18;
      const p = (y * size + x) * 4;
      d[p] = Math.min(255, Math.round(lum * 1.01));
      d[p + 1] = Math.min(255, Math.round(lum * 0.99));
      d[p + 2] = Math.min(255, Math.round(lum * 0.93));
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}
