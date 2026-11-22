import * as THREE from 'three';

// Deterministic fast PRNG for crisp procedural textures
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

function hash2D(ix, iy, seed) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x, y, octaves, seed) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise2D(x * freq, y * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return v / norm;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function heightToNormalTexture(heightData, w, h, strength = 2.0, repeatX = 1, repeatY = 1) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (heightData[y * w + xp] - heightData[y * w + xm]) * strength;
      const dy = (heightData[yp * w + x] - heightData[ym * w + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
      const idx = (y * w + x) * 4;
      d[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

// 1. Cast-iron takoyaki plate textures (grainy dark iron + glistening oil sheen variation)
export function createCastIronTextures() {
  const size = 512;
  const height = new Float32Array(size * size);
  const colorC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);
  const cCtx = colorC.getContext('2d');
  const rCtx = roughC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Sand-cast micro pitting + brushed oil streaks
      const micro = fbm2D(nx * 46, ny * 46, 3, 11);
      const medium = fbm2D(nx * 14, ny * 14, 3, 29);
      const oilPatch = fbm2D(nx * 5.5, ny * 5.5, 3, 73);
      const h = micro * 0.62 + medium * 0.38;
      height[y * size + x] = h;

      // Dark seasoned cast iron: slightly warmer oil tint in shiny patches
      const base = 24 + h * 18 + (oilPatch > 0.52 ? 5 : 0);
      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, base + 4);
      cImg.data[idx + 1] = Math.min(255, base + 2);
      cImg.data[idx + 2] = Math.min(255, base);
      cImg.data[idx + 3] = 255;

      // Oil sheen lowers roughness drastically in oiled patches
      const rough = Math.max(0.14, Math.min(0.68, 0.52 - oilPatch * 0.36 + (h - 0.5) * 0.16));
      const rv = Math.round(rough * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colorC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  const normalMap = heightToNormalTexture(height, size, size, 3.2, 2, 2);

  return { map, roughnessMap, normalMap };
}

// 2. Warm Japanese walnut wood dining table textures
export function createWalnutWoodTextures() {
  const w = 512, h = 512;
  const height = new Float32Array(w * h);
  const cC = makeCanvas(w, h);
  const rC = makeCanvas(w, h);
  const cCtx = cC.getContext('2d');
  const rCtx = rC.getContext('2d');
  const cImg = cCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const warp = fbm2D(u * 4, v * 12, 3, 101) * 0.35;
      const rings = Math.sin((v * 26 + warp * 8) * Math.PI * 2) * 0.5 + 0.5;
      const fine = fbm2D(u * 48, v * 8, 2, 137);
      const grain = rings * 0.65 + fine * 0.35;
      height[y * w + x] = grain;

      // Rich dark satin oiled Japanese walnut (refined low-contrast photographic grain)
      const r = 64 + grain * 24;
      const g = 42 + grain * 16;
      const b = 27 + grain * 10;
      const idx = (y * w + x) * 4;
      cImg.data[idx] = Math.round(r);
      cImg.data[idx + 1] = Math.round(g);
      cImg.data[idx + 2] = Math.round(b);
      cImg.data[idx + 3] = 255;

      const rough = Math.round((0.40 + (1 - grain) * 0.22) * 255);
      rImg.data[idx] = rough;
      rImg.data[idx + 1] = rough;
      rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(cC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);

  const roughnessMap = new THREE.CanvasTexture(rC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 2);

  const normalMap = heightToNormalTexture(height, w, h, 1.8, 3, 2);
  return { map, roughnessMap, normalMap };
}

// 3. Takoyaki porous crispy crust normal + mottling textures
export function createTakoyakiTextures() {
  const size = 512;
  const height = new Float32Array(size * size);
  const cC = makeCanvas(size, size);
  const rC = makeCanvas(size, size);
  const cCtx = cC.getContext('2d');
  const rCtx = rC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const rng = mulberry32(4207);

  // Base dough pores & crispy blisters
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = fbm2D(u * 16, v * 16, 4, 211);
      const n2 = fbm2D(u * 40, v * 40, 2, 239);
      const blister = Math.pow(n1, 1.4) * 0.72 + n2 * 0.28;
      height[y * size + x] = blister;
    }
  }
  // Carve tiny realistic air-bubble pinholes from cooking steam
  for (let i = 0; i < 420; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const rad = 1.6 + rng() * 3.8;
    const x0 = Math.max(0, Math.floor(cx - rad - 1));
    const x1 = Math.min(size - 1, Math.ceil(cx + rad + 1));
    const y0 = Math.max(0, Math.floor(cy - rad - 1));
    const y1 = Math.min(size - 1, Math.ceil(cy + rad + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < rad) {
          const dip = Math.cos((d / rad) * Math.PI * 0.5);
          height[y * size + x] = Math.max(0, height[y * size + x] - dip * 0.45);
        }
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = height[y * size + x];
      const mottle = fbm2D((x / size) * 7, (y / size) * 7, 3, 307);
      const idx = (y * size + x) * 4;
      // Neutral warm crust detail multiplier (tinted dynamically by shader/vertex colors)
      const val = Math.round(Math.max(150, Math.min(255, 195 + (h - 0.45) * 95 + (mottle - 0.5) * 45)));
      cImg.data[idx] = val;
      cImg.data[idx + 1] = Math.round(val * 0.96);
      cImg.data[idx + 2] = Math.round(val * 0.90);
      cImg.data[idx + 3] = 255;

      const rough = Math.round(Math.max(0.26, Math.min(0.75, 0.56 - h * 0.24)) * 255);
      rImg.data[idx] = rough;
      rImg.data[idx + 1] = rough;
      rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(cC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(rC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  const normalMap = heightToNormalTexture(height, size, size, 3.6, 1, 1);

  return { map, roughnessMap, normalMap };
}

// 4. Boiled octopus chunk texture (crimson-burgundy outer skin + white flesh + suction-cup bumps)
export function createOctopusTextures() {
  const size = 256;
  const height = new Float32Array(size * size);
  const cC = makeCanvas(size, size);
  const cCtx = cC.getContext('2d');
  const cImg = cCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const flesh = fbm2D(u * 8, v * 8, 3, 503);
      const skinBand = v < 0.44 + (flesh - 0.5) * 0.22;
      const mottle = fbm2D(u * 22, v * 22, 3, 521);
      height[y * size + x] = 0.5 + mottle * 0.35;

      const idx = (y * size + x) * 4;
      if (skinBand) {
        // Boiled Japanese madako crimson-plum skin
        cImg.data[idx] = Math.round(145 + mottle * 60);
        cImg.data[idx + 1] = Math.round(32 + mottle * 28);
        cImg.data[idx + 2] = Math.round(44 + mottle * 32);
      } else {
        // Firm glossy white octopus flesh
        cImg.data[idx] = Math.round(238 - mottle * 22);
        cImg.data[idx + 1] = Math.round(224 - mottle * 24);
        cImg.data[idx + 2] = Math.round(218 - mottle * 22);
      }
      cImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);

  // Paint a few suction-cup rings on the red skin border
  cCtx.strokeStyle = 'rgba(248, 232, 224, 0.85)';
  cCtx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const sx = 24 + i * 40;
    const sy = 96 + (i % 2) * 18;
    cCtx.beginPath();
    cCtx.arc(sx, sy, 9, 0, Math.PI * 2);
    cCtx.fillStyle = 'rgba(180, 62, 70, 0.7)';
    cCtx.fill();
    cCtx.stroke();
  }

  const map = new THREE.CanvasTexture(cC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(height, size, size, 2.2);
  return { map, normalMap };
}

// 5. Katsuobushi (bonito shaving) translucent pinkish-amber paper-thin fiber texture
export function createKatsuobushiTexture() {
  const w = 128, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Irregular organic shaved-flake silhouette
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.04);
  ctx.bezierCurveTo(w * 0.82, h * 0.08, w * 0.94, h * 0.35, w * 0.84, h * 0.66);
  ctx.bezierCurveTo(w * 0.78, h * 0.92, w * 0.52, h * 0.98, w * 0.28, h * 0.91);
  ctx.bezierCurveTo(w * 0.08, h * 0.76, w * 0.06, h * 0.38, w * 0.18, h * 0.14);
  ctx.closePath();
  ctx.clip();

  // Warm translucent amber-pink gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(232, 186, 152, 0.92)');
  grad.addColorStop(0.45, 'rgba(210, 146, 114, 0.88)');
  grad.addColorStop(0.85, 'rgba(176, 108, 82, 0.86)');
  grad.addColorStop(1, 'rgba(224, 174, 142, 0.80)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Fine dried bonito muscle grain streaks
  const rng = mulberry32(889);
  for (let i = 0; i < 55; i++) {
    const x = rng() * w;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(145, 76, 54, 0.32)' : 'rgba(255, 224, 198, 0.30)';
    ctx.lineWidth = 0.8 + rng() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rng() - 0.5) * 18, h * 0.35, x + (rng() - 0.5) * 18, h * 0.7, x + (rng() - 0.5) * 10, h);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 6. Photorealistic Japanese face & skin PBR textures (albedo + pore normal + roughness)
// UV convention matches our sculpted head sphere: u=0.5 is center of face, v=0.5 is eye-nose band (top v=1, bottom v=0)
export function createFaceSkinTextures(variant = 'mom') {
  const w = 1024, h = 1024;
  const cC = makeCanvas(w, h);
  const rC = makeCanvas(w, h);
  const cCtx = cC.getContext('2d');
  const rCtx = rC.getContext('2d');

  // Base warm natural Japanese skin tone
  const baseSkin = variant === 'mom'
    ? { r: 232, g: 186, b: 158 }
    : variant === 'dad'
      ? { r: 214, g: 166, b: 136 }
      : { r: 234, g: 189, b: 161 };

  cCtx.fillStyle = `rgb(${baseSkin.r},${baseSkin.g},${baseSkin.b})`;
  cCtx.fillRect(0, 0, w, h);

  // Subtle organic skin tone mottling & micro-pores
  const img = cCtx.getImageData(0, 0, w, h);
  const d = img.data;
  const rImg = rCtx.createImageData(w, h);
  const rd = rImg.data;
  const height = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const v = 1 - y / h; // v=1 top of head, v=0 bottom
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const mottle = fbm2D(u * 10, v * 10, 3, variant === 'mom' ? 701 : 733) - 0.5;
      const pore = valueNoise2D(u * 160, v * 160, 751) - 0.5;
      height[y * w + x] = 0.5 + pore * 0.25 + mottle * 0.2;

      const idx = (y * w + x) * 4;
      d[idx] = Math.max(0, Math.min(255, baseSkin.r + mottle * 14 + pore * 5));
      d[idx + 1] = Math.max(0, Math.min(255, baseSkin.g + mottle * 11 + pore * 4));
      d[idx + 2] = Math.max(0, Math.min(255, baseSkin.b + mottle * 10 + pore * 3));
      d[idx + 3] = 255;

      // Skin roughness: oilier T-zone (forehead/nose/lips) vs matte cheeks
      const distNose = Math.hypot((u - 0.5) * 4.5, (v - 0.49) * 3.0);
      const tZone = Math.max(0, 1 - distNose * 1.15);
      const rough = Math.max(0.32, Math.min(0.68, 0.56 - tZone * 0.16 + pore * 0.05));
      const rv = Math.round(rough * 255);
      rd[idx] = rv;
      rd[idx + 1] = rv;
      rd[idx + 2] = rv;
      rd[idx + 3] = 255;
    }
  }
  cCtx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // Canvas-space facial vascularity & anatomical shading (u=0.5 -> x=512, v=0.5 -> y=512)
  // Warm rosy flush across cheeks & nose bridge (from warm dining room & hot takoyaki steam)
  const addSoftBlush = (cx, cy, rx, ry, color) => {
    cCtx.save();
    cCtx.translate(cx, cy);
    cCtx.scale(1, ry / rx);
    const g = cCtx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(210, 115, 98, 0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(0, 0, rx, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();
  };

  const blushAlpha = variant === 'mom' ? 0.25 : 0.16;
  addSoftBlush(w * 0.415, h * 0.548, 66, 44, `rgba(214, 110, 98, ${blushAlpha})`);
  addSoftBlush(w * 0.585, h * 0.548, 66, 44, `rgba(214, 110, 98, ${blushAlpha})`);
  addSoftBlush(w * 0.50, h * 0.532, 34, 22, `rgba(210, 120, 104, ${blushAlpha * 0.65})`);

  // Soft warm cheekbone-under-eye shading & nose-side warmth for photographic depth
  addSoftBlush(w * 0.478, h * 0.518, 18, 34, 'rgba(155, 102, 78, 0.12)');
  addSoftBlush(w * 0.522, h * 0.518, 18, 34, 'rgba(155, 102, 78, 0.12)');
  addSoftBlush(w * 0.50, h * 0.578, 22, 12, 'rgba(148, 96, 74, 0.14)');
  if (variant === 'dad') {
    addSoftBlush(w * 0.50, h * 0.675, 84, 46, 'rgba(104, 88, 78, 0.08)');
  }

  // Natural warm gently-arched eyebrows
  const drawBrow = (dir) => {
    cCtx.save();
    const startX = w * (0.5 + dir * 0.022);
    const endX = w * (0.5 + dir * 0.088);
    const baseY = h * (variant === 'mom' ? 0.426 : 0.420);
    const thickness = variant === 'mom' ? 7 : 10.5;
    const rng = mulberry32(dir > 0 ? 901 : 907);
    for (let i = 0; i < 110; i++) {
      const t = i / 109;
      const bx = startX + (endX - startX) * t;
      const arch = Math.sin(t * Math.PI) * (variant === 'mom' ? -12 : -7);
      const by = baseY + arch + (rng() - 0.5) * thickness * (1 - t * 0.45);
      cCtx.strokeStyle = variant === 'mom'
        ? `rgba(44, 30, 22, ${0.28 + (1 - Math.abs(t - 0.42)) * 0.34})`
        : `rgba(30, 22, 17, ${0.34 + (1 - Math.abs(t - 0.42)) * 0.38})`;
      cCtx.lineWidth = 1.2 + rng() * 1.1;
      cCtx.beginPath();
      cCtx.moveTo(bx, by);
      cCtx.lineTo(bx + dir * (5 + rng() * 4), by - 1.5 + t * 4);
      cCtx.stroke();
    }
    cCtx.restore();
  };
  drawBrow(-1);
  drawBrow(1);

  // Warm upturned smiling lips (clear friendly warmth even at table distance)
  const lipY = h * 0.625;
  const lipW = variant === 'mom' ? 42 : 46;
  cCtx.save();
  const lipGrad = cCtx.createRadialGradient(w * 0.5, lipY, 4, w * 0.5, lipY, lipW * 1.12);
  if (variant === 'mom') {
    lipGrad.addColorStop(0, 'rgba(196, 92, 88, 0.78)');
    lipGrad.addColorStop(0.75, 'rgba(188, 96, 92, 0.48)');
    lipGrad.addColorStop(1, 'rgba(188, 96, 92, 0)');
  } else {
    lipGrad.addColorStop(0, 'rgba(170, 94, 84, 0.62)');
    lipGrad.addColorStop(0.75, 'rgba(162, 98, 88, 0.36)');
    lipGrad.addColorStop(1, 'rgba(162, 98, 88, 0)');
  }
  cCtx.fillStyle = lipGrad;
  cCtx.beginPath();
  cCtx.ellipse(w * 0.5, lipY + 2, lipW, 18, 0, 0, Math.PI * 2);
  cCtx.fill();
  // Warm upturned smile crease
  cCtx.strokeStyle = 'rgba(118, 52, 48, 0.58)';
  cCtx.lineWidth = 2.6;
  cCtx.beginPath();
  cCtx.moveTo(w * 0.5 - lipW * 0.85, lipY - 2);
  cCtx.quadraticCurveTo(w * 0.5, lipY + 9, w * 0.5 + lipW * 0.85, lipY - 2);
  cCtx.stroke();
  cCtx.restore();

  // Slightly glossier lips in roughness map
  rCtx.fillStyle = 'rgba(92, 92, 92, 0.7)';
  rCtx.beginPath();
  rCtx.ellipse(w * 0.5, lipY + 2, lipW * 0.85, 13, 0, 0, Math.PI * 2);
  rCtx.fill();

  const map = new THREE.CanvasTexture(cC);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rC);
  // Downsample normal calculation to 512 for speed & crispness
  const normalMap = heightToNormalTexture(height, w, h, 0.55);

  return { map, roughnessMap, normalMap };
}

// 7. Realistic multi-layer eye texture (sclera + deep warm brown Japanese iris + limbal ring + pupil)
export function createRealisticEyeTexture() {
  const size = 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  // Warm off-white sclera with very subtle corner shading
  const sGrad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.14, size * 0.5, size * 0.5, size * 0.5);
  sGrad.addColorStop(0, '#f7f3ee');
  sGrad.addColorStop(0.7, '#efe6df');
  sGrad.addColorStop(1, '#d8beb6');
  ctx.fillStyle = sGrad;
  ctx.fillRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;
  const irisR = size * 0.255;

  // Soft limbal shadow ring
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 1.07, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(26, 18, 15, 0.72)';
  ctx.fill();

  // Deep warm espresso-brown iris base
  const iGrad = ctx.createRadialGradient(cx, cy, irisR * 0.25, cx, cy, irisR);
  iGrad.addColorStop(0, '#5a361e');
  iGrad.addColorStop(0.55, '#422514');
  iGrad.addColorStop(0.88, '#26140b');
  iGrad.addColorStop(1, '#140b06');
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fillStyle = iGrad;
  ctx.fill();

  // Radial iris fibers for photorealism
  const rng = mulberry32(1337);
  for (let i = 0; i < 160; i++) {
    const ang = (i / 160) * Math.PI * 2 + (rng() - 0.5) * 0.03;
    const r0 = irisR * (0.38 + rng() * 0.1);
    const r1 = irisR * (0.85 + rng() * 0.12);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(148, 94, 52, 0.30)' : 'rgba(28, 15, 8, 0.35)';
    ctx.lineWidth = 1.4 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.stroke();
  }

  // Deep black pupil
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#070504';
  ctx.fill();

  // Crisp warm overhead pendant-lamp catchlight glint in the cornea (instant lifelike humanity!)
  ctx.beginPath();
  ctx.arc(cx - irisR * 0.26, cy - irisR * 0.26, irisR * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 246, 228, 0.92)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + irisR * 0.24, cy + irisR * 0.24, irisR * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 234, 200, 0.55)';
  ctx.fill();

  // Soft natural upper-eyelid shadow band across top of sclera/iris
  const lidShadow = ctx.createLinearGradient(0, size * 0.18, 0, size * 0.42);
  lidShadow.addColorStop(0, 'rgba(60, 42, 34, 0.38)');
  lidShadow.addColorStop(1, 'rgba(60, 42, 34, 0)');
  ctx.fillStyle = lidShadow;
  ctx.fillRect(0, 0, size, size * 0.45);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 8. Hair strand anisotropic color + bump texture
export function createHairTextures(tint = '#1e1612') {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const height = new Float32Array(w * h);

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(4111);
  for (let i = 0; i < 320; i++) {
    const x = rng() * w;
    const bright = rng() > 0.5;
    ctx.strokeStyle = bright ? 'rgba(72, 52, 42, 0.32)' : 'rgba(8, 6, 5, 0.42)';
    ctx.lineWidth = 1 + rng() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rng() - 0.5) * 6, h * 0.33, x + (rng() - 0.5) * 6, h * 0.66, x, h);
    ctx.stroke();
  }

  const img = ctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) {
    height[i] = img[i * 4] / 255;
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(height, w, h, 2.5);
  return { map, normalMap };
}

// 9. Cozy knit sweater / cardigan garment texture (seamless anatomical shading + knit weave + natural front placket!)
export function createGarmentTextures(variant = 'mom') {
  const w = 512, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const height = new Float32Array(w * h);

  const isDad = variant === 'dad';
  const baseHex = isDad ? '#364250' : '#bfa090';
  const darkHex = isDad ? '#28323e' : '#a48676';

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle organic vertical knit rib weave
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = (x % 8 === 0) ? 'rgba(0,0,0,0.09)' : 'rgba(255,245,235,0.04)';
    ctx.fillRect(x, 0, 2, h);
  }
  ctx.strokeStyle = darkHex;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.2;
  for (let x = 0; x < w; x += 6) {
    for (let y = 0; y < h; y += 6) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3, y + 4.5);
      ctx.lineTo(x + 6, y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Natural garment front detail at UV u = 0.5 (front center of torso!)
  const cx = w * 0.5;
  if (!isDad) {
    // Mom: soft open oatmeal-rose cardigan revealing warm ivory ribbed inner tee + natural lapel folds
    ctx.fillStyle = '#e8dfd4';
    ctx.beginPath();
    ctx.moveTo(cx - 46, 0);
    ctx.lineTo(cx + 46, 0);
    ctx.lineTo(cx + 32, h);
    ctx.lineTo(cx - 32, h);
    ctx.closePath();
    ctx.fill();
    // Soft knit shadow along cardigan opening edges
    for (const dir of [-1, 1]) {
      const gx = cx + dir * 40;
      const g = ctx.createLinearGradient(gx - dir * 12, 0, gx + dir * 14, 0);
      g.addColorStop(0, 'rgba(65, 42, 32, 0.28)');
      g.addColorStop(0.45, 'rgba(191, 160, 144, 0.9)');
      g.addColorStop(1, 'rgba(191, 160, 144, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(gx - dir * 12, gx + dir * 14), 0, 26, h);
    }
  } else {
    // Dad: cozy textured charcoal-navy waffle Henley with stitched placket & 2 walnut buttons
    ctx.fillStyle = '#29333f';
    ctx.fillRect(cx - 14, 0, 28, h * 0.42);
    ctx.strokeStyle = 'rgba(18, 22, 28, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 14, 0, 28, h * 0.42);
    for (const by of [h * 0.14, h * 0.28]) {
      ctx.beginPath();
      ctx.arc(cx, by, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2b1e16';
      ctx.fill();
      ctx.strokeStyle = '#5c4638';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Soft shoulder/armpit drape shading baked subtly for realistic cloth depth
  const addDrapeShadow = (px, py, rx, ry, alpha) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(22, 16, 14, ${alpha})`);
    g.addColorStop(1, 'rgba(22, 16, 14, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  addDrapeShadow(w * 0.30, h * 0.52, 26, 130, 0.26);
  addDrapeShadow(w * 0.70, h * 0.52, 26, 130, 0.26);

  const img = ctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) {
    height[i] = img[i * 4] / 255;
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightToNormalTexture(height, w, h, 1.8, 1, 1);
  return { map, normalMap };
}

// Keep simple repeating fabric texture for player's foreground sleeve
export function createFabricTextures(baseHex = '#bfa899', darkHex = '#9a8476') {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = darkHex;
  ctx.lineWidth = 2;
  for (let x = 0; x < size; x += 8) {
    for (let y = 0; y < size; y += 8) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 6);
      ctx.lineTo(x + 8, y);
      ctx.stroke();
    }
  }
  const img = ctx.getImageData(0, 0, size, size).data;
  for (let i = 0; i < size * size; i++) {
    height[i] = img[i * 4] / 255;
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);

  const normalMap = heightToNormalTexture(height, size, size, 2.0, 8, 8);
  return { map, normalMap };
}

// 10. Japanese stoneware ceramic speckled glaze texture
export function createCeramicTexture(baseColor = '#ede5d8', speckleColor = '#6b5c4d') {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Horizontal potter's wheel ridges
  for (let y = 0; y < size; y += 3) {
    const a = 0.03 + Math.sin(y * 0.25) * 0.025;
    ctx.fillStyle = `rgba(80, 62, 46, ${a})`;
    ctx.fillRect(0, y, size, 1.5);
  }
  const rng = mulberry32(6029);
  ctx.fillStyle = speckleColor;
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.5 + rng() * 1.4;
    ctx.globalAlpha = 0.25 + rng() * 0.45;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 11. Soft volumetric Perlin steam puff sprite
export function createSteamSpriteTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const r = Math.hypot(dx, dy);
      const radial = Math.max(0, 1 - r);
      const smooth = radial * radial * (3 - 2 * radial);
      const n = fbm2D((x / size) * 4.5, (y / size) * 4.5, 4, 991);
      const alpha = Math.max(0, Math.min(1, smooth * (0.45 + n * 0.85)));
      const idx = (y * size + x) * 4;
      d[idx] = 255;
      d[idx + 1] = 247;
      d[idx + 2] = 236;
      d[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 12. Cozy Night Japanese Dining Room PMREM Environment Map (procedural, zero external HDR)
export function createNightDiningEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0c0b10);

  // Warm overhead pendant bulb reflection spot (gives sharp golden highlights in oil, sauce, & eyes!)
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 4.6, 2.5) });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), bulbMat);
  bulb.position.set(0, 2.2, 0.15);
  envScene.add(bulb);

  // Warm pendant shade inner bounce ring
  const shadeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 1.05, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.45, 0.72), side: THREE.DoubleSide })
  );
  shadeRing.position.set(0, 2.15, 0.15);
  shadeRing.rotation.x = Math.PI / 2;
  envScene.add(shadeRing);

  // Soft warm dining-room wall glow behind
  const warmWall = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.34, 0.2) })
  );
  warmWall.position.set(0, 0.8, -3.5);
  envScene.add(warmWall);

  // Soft distant kitchen counter warm lamp
  const kitchenLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.35, 0.75) })
  );
  kitchenLamp.position.set(-2.4, 1.1, -2.2);
  envScene.add(kitchenLamp);

  // Subtle cool moonlit night window panel on right side (gives photographic cool rim reflection)
  const nightWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.34, 0.56) })
  );
  nightWindow.position.set(3.2, 1.0, -0.5);
  nightWindow.rotation.y = -Math.PI / 2;
  envScene.add(nightWindow);

  // Warm table surface bounce underneath
  const tableBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.18, 0.11) })
  );
  tableBounce.position.set(0, -1.5, 0);
  tableBounce.rotation.x = -Math.PI / 2;
  envScene.add(tableBounce);

  const rt = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return rt.texture;
}
