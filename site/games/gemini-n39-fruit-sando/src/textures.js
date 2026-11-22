import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Fast deterministic PRNG for rich organic procedural textures
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

function configureTex(canvas, { srgb = true, repeatX = 1, repeatY = 1, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Convert a height canvas into a crisp tangent-space normal map
function heightToNormalCanvas(heightCanvas, strength = 2.5) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d');
  const src = hCtx.getImageData(0, 0, w, h).data;
  const outCanvas = makeCanvas(w, h);
  const oCtx = outCanvas.getContext('2d');
  const outImg = oCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const ix = ((x % w) + w) % w;
    const iy = ((y % h) + h) % h;
    return src[(iy * w + ix) * 4] / 255;
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

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  oCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

// 1. Shokupan Crumb (Japanese pillowy milk bread interior)
export function createBreadCrumbTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(1042);

  // Soft warm milk-bread base (slightly warmer creamy-wheat so pure snow-white whipped cream pops!)
  cCtx.fillStyle = '#f2e3c8';
  cCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#dcdcdc';
  hCtx.fillRect(0, 0, size, size);

  // Soft cloudy flour variation
  for (let i = 0; i < 160; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 18 + rng() * 55;
    const g = cCtx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rng() > 0.5 ? 'rgba(228, 204, 168, 0.28)' : 'rgba(252, 244, 228, 0.28)';
    g.addColorStop(0, warm);
    g.addColorStop(1, 'rgba(242, 227, 200, 0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
  }

  // Fine spongy air pores (small to medium organic ellipses with rich ambient occlusion)
  for (let i = 0; i < 2800; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 0.8 + Math.pow(rng(), 2.2) * 5.2;
    const ry = rx * (0.55 + rng() * 0.9);
    const rot = rng() * Math.PI;
    const depth = 0.2 + rng() * 0.6;

    cCtx.save();
    cCtx.translate(x, y);
    cCtx.rotate(rot);
    cCtx.fillStyle = `rgba(192, 160, 118, ${depth * 0.72})`;
    cCtx.beginPath();
    cCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();

    hCtx.save();
    hCtx.translate(x, y);
    hCtx.rotate(rot);
    const v = Math.round(215 - depth * 175);
    hCtx.fillStyle = `rgb(${v},${v},${v})`;
    hCtx.beginPath();
    hCtx.ellipse(0, 0, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
    hCtx.fill();
    hCtx.restore();
  }

  // Delicate silky bread fibers
  cCtx.strokeStyle = 'rgba(255, 253, 248, 0.35)';
  cCtx.lineWidth = 1.0;
  for (let i = 0; i < 260; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 8 + rng() * 20;
    const a = rng() * Math.PI * 2;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    cCtx.stroke();
  }

  const norm = heightToNormalCanvas(hgt, 2.8);
  return {
    map: configureTex(col, { srgb: true, repeatX: 1.4, repeatY: 1.4 }),
    normalMap: configureTex(norm, { srgb: false, repeatX: 1.4, repeatY: 1.4 }),
    roughnessMap: configureTex(hgt, { srgb: false, repeatX: 1.4, repeatY: 1.4 }),
  };
}

// 2. Shokupan Crust (golden warm baked Japanese milk-bread edge)
export function createBreadCrustTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(2048);

  const grad = cCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#c8833d');
  grad.addColorStop(0.5, '#b66e2c');
  grad.addColorStop(1, '#c98642');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#909090';
  hCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 3 + rng() * 16;
    const dark = rng() > 0.45;
    cCtx.fillStyle = dark ? 'rgba(130, 68, 22, 0.14)' : 'rgba(232, 178, 108, 0.14)';
    cCtx.beginPath();
    cCtx.ellipse(x, y, r, r * (0.4 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2);
    cCtx.fill();

    const v = dark ? 110 : 175;
    hCtx.fillStyle = `rgba(${v},${v},${v},0.25)`;
    hCtx.beginPath();
    hCtx.ellipse(x, y, r, r * 0.6, rng() * Math.PI, 0, Math.PI * 2);
    hCtx.fill();
  }

  const norm = heightToNormalCanvas(hgt, 2.2);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 3. Strawberry Exterior (deep glossy crimson + recessed golden achenes/seeds)
export function createStrawberryOuterTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');

  // Deep velvety ripe Japanese Amaou strawberry crimson gradient
  const g = cCtx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0.0, '#b81a1e');
  g.addColorStop(0.18, '#a00d15');
  g.addColorStop(0.58, '#840710');
  g.addColorStop(0.92, '#62030a');
  g.addColorStop(1.0, '#4e0208');
  cCtx.fillStyle = g;
  cCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  // Fine authentic Fibonacci rows of recessed dimples + tiny golden-amber achenes
  const rows = 20;
  const cols = 22;
  const rng = mulberry32(3301);
  for (let r = 1; r < rows; r++) {
    const vNorm = r / rows;
    const y = vNorm * size;
    const offset = (r % 2) * (size / cols) * 0.5;
    for (let c = 0; c < cols; c++) {
      const x = ((c / cols) * size + offset + (rng() - 0.5) * 3.5 + size) % size;
      const rad = (4.0 + (1 - vNorm) * 1.8) * (0.9 + rng() * 0.2);

      // Soft translucent ruby dimple cavity
      const dg = cCtx.createRadialGradient(x, y, 0, x, y, rad * 1.25);
      dg.addColorStop(0, 'rgba(52, 3, 7, 0.72)');
      dg.addColorStop(0.55, 'rgba(92, 6, 12, 0.25)');
      dg.addColorStop(1, 'rgba(130, 10, 16, 0)');
      cCtx.fillStyle = dg;
      cCtx.beginPath();
      cCtx.ellipse(x, y, rad * 0.95, rad * 1.2, 0, 0, Math.PI * 2);
      cCtx.fill();

      // Subtle smooth dimple depression in heightmap (avoids harsh ring speculars!)
      const hg = hCtx.createRadialGradient(x, y, 0, x, y, rad * 1.2);
      hg.addColorStop(0, 'rgb(122,122,122)');
      hg.addColorStop(0.7, 'rgb(185,185,185)');
      hg.addColorStop(1, 'rgb(200,200,200)');
      hCtx.fillStyle = hg;
      hCtx.beginPath();
      hCtx.ellipse(x, y, rad * 1.05, rad * 1.25, 0, 0, Math.PI * 2);
      hCtx.fill();

      // Tiny delicate golden-amber achene seed nestled inside dimple
      cCtx.fillStyle = '#c8942e';
      cCtx.beginPath();
      cCtx.ellipse(x, y + 0.4, rad * 0.19, rad * 0.34, (rng() - 0.5) * 0.2, 0, Math.PI * 2);
      cCtx.fill();
    }
  }

  const norm = heightToNormalCanvas(hgt, 1.55);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 4. Strawberry Cut Cross-Section (vivid crimson rim, delicate pale-pink heart & radial vascular veins)
export function createStrawberryCutTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.52;

  // Deep juicy crimson edge
  cCtx.fillStyle = '#b9121e';
  cCtx.fillRect(0, 0, size, size);

  // Outer luscious crimson flesh
  const g1 = cCtx.createRadialGradient(cx, cy, 18, cx, cy, size * 0.49);
  g1.addColorStop(0.0, '#fff1ec');
  g1.addColorStop(0.24, '#ffd2ca');
  g1.addColorStop(0.45, '#f0575a');
  g1.addColorStop(0.72, '#d11824');
  g1.addColorStop(0.94, '#aa0b16');
  g1.addColorStop(1.0, '#850710');
  cCtx.fillStyle = g1;
  cCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#c0c0c0';
  hCtx.fillRect(0, 0, size, size);

  // Heart-shaped lighter core & central tiny hollow cavity
  cCtx.save();
  cCtx.translate(cx, cy - 12);
  cCtx.beginPath();
  cCtx.moveTo(0, -105);
  cCtx.bezierCurveTo(75, -135, 118, -35, 68, 52);
  cCtx.bezierCurveTo(35, 108, 12, 138, 0, 148);
  cCtx.bezierCurveTo(-12, 138, -35, 108, -68, 52);
  cCtx.bezierCurveTo(-118, -35, -75, -135, 0, -105);
  const coreG = cCtx.createRadialGradient(0, -10, 10, 0, 10, 145);
  coreG.addColorStop(0, 'rgba(255, 245, 240, 0.92)');
  coreG.addColorStop(0.5, 'rgba(255, 198, 192, 0.72)');
  coreG.addColorStop(1, 'rgba(230, 58, 66, 0.0)');
  cCtx.fillStyle = coreG;
  cCtx.fill();
  cCtx.restore();

  // Delicate white-pink vascular filaments radiating toward the edge
  const rng = mulberry32(4410);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const len = 120 + rng() * 105;
    cCtx.strokeStyle = 'rgba(255, 224, 218, 0.42)';
    cCtx.lineWidth = 1.6 + rng() * 2.2;
    cCtx.beginPath();
    cCtx.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
    cCtx.quadraticCurveTo(
      cx + Math.cos(a + 0.14) * len * 0.55,
      cy + Math.sin(a + 0.14) * len * 0.55,
      cx + Math.cos(a) * len,
      cy + Math.sin(a) * len
    );
    cCtx.stroke();

    hCtx.strokeStyle = 'rgba(235,235,235,0.45)';
    hCtx.lineWidth = 2;
    hCtx.beginPath();
    hCtx.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
    hCtx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    hCtx.stroke();
  }

  // Subtle central teardrop pith recess
  cCtx.fillStyle = 'rgba(225, 115, 118, 0.45)';
  cCtx.beginPath();
  cCtx.ellipse(cx, cy - 6, 12, 26, 0, 0, Math.PI * 2);
  cCtx.fill();
  hCtx.fillStyle = 'rgb(70,70,70)';
  hCtx.beginPath();
  hCtx.ellipse(cx, cy - 6, 14, 28, 0, 0, Math.PI * 2);
  hCtx.fill();

  // Juicy micro cellular sparkle
  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1.2 + rng() * 2.5;
    cCtx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(155, 10, 20, 0.09)';
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
    const v = rng() > 0.5 ? 220 : 165;
    hCtx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  const norm = heightToNormalCanvas(hgt, 2.1);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 5. Kiwi Cut Cross-Section (radiant translucent emerald green, creamy starburst core, black seed ring)
export function createKiwiCutTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  const rng = mulberry32(5521);

  // Rich emerald-jade translucent flesh
  const g = cCtx.createRadialGradient(cx, cy, 16, cx, cy, size * 0.5);
  g.addColorStop(0.0, '#f4f8d2');
  g.addColorStop(0.20, '#e3efb0');
  g.addColorStop(0.32, '#9ed438');
  g.addColorStop(0.58, '#66b51e');
  g.addColorStop(0.86, '#489316');
  g.addColorStop(0.97, '#347412');
  g.addColorStop(1.0, '#2a5f10');
  cCtx.fillStyle = g;
  cCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  // Creamy starburst rays radiating out from center
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const outer = 165 + (i % 2) * 58 + rng() * 20;
    const sg = cCtx.createLinearGradient(
      cx + Math.cos(a) * 28,
      cy + Math.sin(a) * 28,
      cx + Math.cos(a) * outer,
      cy + Math.sin(a) * outer
    );
    sg.addColorStop(0, 'rgba(248, 252, 214, 0.78)');
    sg.addColorStop(0.45, 'rgba(218, 240, 146, 0.32)');
    sg.addColorStop(1, 'rgba(120, 195, 45, 0)');
    cCtx.strokeStyle = sg;
    cCtx.lineWidth = i % 2 === 0 ? 3.2 : 1.7;
    cCtx.beginPath();
    cCtx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    cCtx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    cCtx.stroke();

    hCtx.strokeStyle = 'rgba(240,240,240,0.45)';
    hCtx.lineWidth = 2.5;
    hCtx.beginPath();
    hCtx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    hCtx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    hCtx.stroke();
  }

  // Soft elliptical white core
  const cg = cCtx.createRadialGradient(cx, cy, 4, cx, cy, 62);
  cg.addColorStop(0, 'rgba(252, 253, 224, 0.96)');
  cg.addColorStop(0.65, 'rgba(235, 244, 178, 0.85)');
  cg.addColorStop(1, 'rgba(182, 224, 88, 0)');
  cCtx.fillStyle = cg;
  cCtx.beginPath();
  cCtx.ellipse(cx, cy, 64, 52, 0.15, 0, Math.PI * 2);
  cCtx.fill();

  // Iconic ring of glistening black kiwi seeds
  const seedCount = 46;
  for (let i = 0; i < seedCount; i++) {
    const a = (i / seedCount) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const dist = 76 + (i % 2) * 16 + rng() * 14;
    const sx = cx + Math.cos(a) * dist;
    const sy = cy + Math.sin(a) * dist * 0.92;

    // Subtle dark-green juicy halo around seed
    cCtx.fillStyle = 'rgba(32, 72, 10, 0.38)';
    cCtx.beginPath();
    cCtx.ellipse(sx, sy, 6.5, 4.2, a, 0, Math.PI * 2);
    cCtx.fill();

    // Jet-black teardrop seed
    cCtx.fillStyle = '#141210';
    cCtx.beginPath();
    cCtx.ellipse(sx, sy, 4.6, 2.6, a, 0, Math.PI * 2);
    cCtx.fill();

    // Glossy specular dot on seed
    cCtx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    cCtx.beginPath();
    cCtx.arc(sx - Math.cos(a) * 1.2, sy - Math.sin(a) * 1.2, 1.0, 0, Math.PI * 2);
    cCtx.fill();

    // Raised seed bump
    hCtx.fillStyle = 'rgb(250,250,250)';
    hCtx.beginPath();
    hCtx.ellipse(sx, sy, 4.6, 2.8, a, 0, Math.PI * 2);
    hCtx.fill();
  }

  const norm = heightToNormalCanvas(hgt, 2.8);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 6. Mikan (Mandarin Orange) Cut Cross-Section & Peeled Juice Vesicles
export function createMikanCutTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  const rng = mulberry32(6619);

  // Translucent bright tangerine-orange base
  const g = cCtx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.49);
  g.addColorStop(0.0, '#fff3dc');
  g.addColorStop(0.11, '#ffd9a0');
  g.addColorStop(0.22, '#ff9818');
  g.addColorStop(0.75, '#f67306');
  g.addColorStop(0.92, '#e25c04');
  g.addColorStop(0.97, '#fff2df');
  g.addColorStop(1.0, '#f4e0c2');
  cCtx.fillStyle = g;
  cCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#a8a8a8';
  hCtx.fillRect(0, 0, size, size);

  // 10 plump juicy citrus segments filled with shimmering juice sacs (vesicles)
  const segments = 10;
  for (let s = 0; s < segments; s++) {
    const a0 = (s / segments) * Math.PI * 2 + 0.04;
    const a1 = ((s + 1) / segments) * Math.PI * 2 - 0.04;
    const aMid = (a0 + a1) * 0.5;

    // Individual juice vesicles inside each segment
    for (let v = 0; v < 46; v++) {
      const t = 0.16 + rng() * 0.76;
      const a = a0 + (a1 - a0) * (0.08 + rng() * 0.84);
      const r = t * 224;
      const vx = cx + Math.cos(a) * r;
      const vy = cy + Math.sin(a) * r;
      const len = 10 + rng() * 14;
      const wid = 3.2 + rng() * 3.4;

      const bright = rng();
      cCtx.fillStyle =
        bright > 0.65
          ? 'rgba(255, 206, 78, 0.72)'
          : bright > 0.3
            ? 'rgba(255, 134, 12, 0.65)'
            : 'rgba(222, 82, 2, 0.55)';
      cCtx.beginPath();
      cCtx.ellipse(vx, vy, len, wid, aMid + (rng() - 0.5) * 0.3, 0, Math.PI * 2);
      cCtx.fill();

      // Plump shiny sac height
      hCtx.fillStyle = 'rgba(240,240,240,0.65)';
      hCtx.beginPath();
      hCtx.ellipse(vx, vy, len * 0.85, wid * 0.85, aMid, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  // Delicate white fibrous radial segment membranes + fluffy white center pith
  cCtx.strokeStyle = 'rgba(255, 245, 228, 0.88)';
  cCtx.lineWidth = 4.2;
  hCtx.strokeStyle = 'rgb(210,210,210)';
  hCtx.lineWidth = 4.5;
  for (let s = 0; s < segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    cCtx.beginPath();
    cCtx.moveTo(cx, cy);
    cCtx.lineTo(cx + Math.cos(a) * 246, cy + Math.sin(a) * 246);
    cCtx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(cx, cy);
    hCtx.lineTo(cx + Math.cos(a) * 246, cy + Math.sin(a) * 246);
    hCtx.stroke();
  }

  // Outer delicate white pith ring
  cCtx.strokeStyle = 'rgba(255, 244, 225, 0.9)';
  cCtx.lineWidth = 10;
  cCtx.beginPath();
  cCtx.arc(cx, cy, 246, 0, Math.PI * 2);
  cCtx.stroke();

  // Fluffy center star pith
  const pg = cCtx.createRadialGradient(cx, cy, 2, cx, cy, 34);
  pg.addColorStop(0, '#fffaf0');
  pg.addColorStop(0.65, 'rgba(255, 242, 218, 0.92)');
  pg.addColorStop(1, 'rgba(255, 224, 175, 0)');
  cCtx.fillStyle = pg;
  cCtx.beginPath();
  cCtx.arc(cx, cy, 34, 0, Math.PI * 2);
  cCtx.fill();

  const norm = heightToNormalCanvas(hgt, 3.2);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 7. Peeled Mikan Outer Texture (plump orange segments with delicate white pith fibers)
export function createMikanOuterTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(7731);

  cCtx.fillStyle = '#ee6e08';
  cCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  // Soft translucent vertical segment seams (deep warm orange valleys, subtle pith)
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const x = (i / segs) * size;
    const g = cCtx.createLinearGradient(x - 12, 0, x + 12, 0);
    g.addColorStop(0, 'rgba(238, 110, 8, 0)');
    g.addColorStop(0.5, 'rgba(255, 224, 182, 0.34)');
    g.addColorStop(1, 'rgba(238, 110, 8, 0)');
    cCtx.fillStyle = g;
    cCtx.fillRect(x - 12, 0, 24, size);

    const hg = hCtx.createLinearGradient(x - 9, 0, x + 9, 0);
    hg.addColorStop(0, 'rgba(200,200,200,0)');
    hg.addColorStop(0.5, 'rgba(72,72,72,0.75)');
    hg.addColorStop(1, 'rgba(200,200,200,0)');
    hCtx.fillStyle = hg;
    hCtx.fillRect(x - 9, 0, 18, size);
  }

  // Fine glistening translucent juice membrane mottling
  for (let i = 0; i < 650; i++) {
    const x = rng() * size;
    const y = rng() * size;
    cCtx.fillStyle = rng() > 0.5 ? 'rgba(255, 178, 52, 0.25)' : 'rgba(204, 68, 2, 0.24)';
    cCtx.beginPath();
    cCtx.ellipse(x, y, 4 + rng() * 10, 2 + rng() * 5, rng() * Math.PI, 0, Math.PI * 2);
    cCtx.fill();
  }

  // Delicate wispy organic white pith threads (subtle, realistic!)
  cCtx.strokeStyle = 'rgba(255, 245, 228, 0.34)';
  for (let i = 0; i < 36; i++) {
    const x = rng() * size;
    cCtx.lineWidth = 0.8 + rng() * 1.6;
    cCtx.beginPath();
    cCtx.moveTo(x, rng() * size * 0.35);
    cCtx.bezierCurveTo(
      x + (rng() - 0.5) * 30,
      size * 0.35,
      x + (rng() - 0.5) * 30,
      size * 0.65,
      x + (rng() - 0.5) * 18,
      size * (0.65 + rng() * 0.35)
    );
    cCtx.stroke();
  }

  const norm = heightToNormalCanvas(hgt, 3.0);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 8. Whipped Cream Normal & Micro-Sheen (velvety smooth spatula-swirl strokes)
export function createCreamTextures() {
  const size = 512;
  const hgt = makeCanvas(size, size);
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(8812);

  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  // Smooth creamy spatula ridges
  for (let i = 0; i < 42; i++) {
    const y = (i / 42) * size;
    const g = hCtx.createLinearGradient(0, y - 9, 0, y + 9);
    g.addColorStop(0, 'rgba(180,180,180,0)');
    g.addColorStop(0.5, i % 2 === 0 ? 'rgba(248,248,248,0.45)' : 'rgba(142,142,142,0.35)');
    g.addColorStop(1, 'rgba(180,180,180,0)');
    hCtx.fillStyle = g;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) {
      hCtx.lineTo(x, y + Math.sin(x * 0.025 + i * 0.7) * 8);
    }
    hCtx.lineTo(size, y + 18);
    hCtx.lineTo(0, y + 18);
    hCtx.closePath();
    hCtx.fill();
  }

  // Tiny soft dairy micro-bubbles
  for (let i = 0; i < 240; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 1.8;
    hCtx.fillStyle = 'rgba(120,120,120,0.35)';
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  const norm = heightToNormalCanvas(hgt, 1.5);
  return {
    normalMap: configureTex(norm, { srgb: false, repeatX: 2, repeatY: 2 }),
  };
}

// 9. Natural Pale Oak / Hinoki Wood Cutting Board
export function createWoodTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(9904);

  // Warm sunlit pale hinoki/oak tone
  cCtx.fillStyle = '#d7b589';
  cCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  // Wood grain streaks
  for (let i = 0; i < 190; i++) {
    const y = rng() * size;
    const thick = 1.5 + rng() * 9;
    const dark = rng() > 0.4;
    cCtx.strokeStyle = dark
      ? `rgba(158, 112, 66, ${0.08 + rng() * 0.16})`
      : `rgba(235, 206, 165, ${0.08 + rng() * 0.14})`;
    cCtx.lineWidth = thick;
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    const amp = 3 + rng() * 10;
    const freq = 0.008 + rng() * 0.012;
    const phase = rng() * Math.PI * 2;
    for (let x = 0; x <= size; x += 24) {
      cCtx.lineTo(x, y + Math.sin(x * freq + phase) * amp);
    }
    cCtx.stroke();

    hCtx.strokeStyle = dark ? 'rgba(155,155,155,0.22)' : 'rgba(225,225,225,0.22)';
    hCtx.lineWidth = thick * 0.7;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    for (let x = 0; x <= size; x += 24) {
      hCtx.lineTo(x, y + Math.sin(x * freq + phase) * amp);
    }
    hCtx.stroke();
  }

  // Subtle fine wood pores
  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 6 + rng() * 24;
    cCtx.fillStyle = 'rgba(135, 92, 52, 0.12)';
    cCtx.fillRect(x, y, len, 1);
  }

  const norm = heightToNormalCanvas(hgt, 1.4);
  return {
    map: configureTex(col, { srgb: true, repeatX: 1.5, repeatY: 1.5 }),
    normalMap: configureTex(norm, { srgb: false, repeatX: 1.5, repeatY: 1.5 }),
  };
}

// 10. Natural Woven Morning Linen Cloth
export function createLinenTextures() {
  const size = 256;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(1122);

  cCtx.fillStyle = '#efe6d8';
  cCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#b0b0b0';
  hCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    const shade = 228 + Math.round((rng() - 0.5) * 16);
    cCtx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 20}, 0.5)`;
    cCtx.fillRect(0, y, size, 2);
    hCtx.fillStyle = 'rgba(230,230,230,0.45)';
    hCtx.fillRect(0, y, size, 2);
  }
  for (let x = 0; x < size; x += 4) {
    const shade = 232 + Math.round((rng() - 0.5) * 14);
    cCtx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 22}, 0.45)`;
    cCtx.fillRect(x, 0, 2, size);
    hCtx.fillStyle = 'rgba(215,215,215,0.4)';
    hCtx.fillRect(x, 0, 2, size);
  }

  // Delicate warm beige café stripe
  cCtx.fillStyle = 'rgba(196, 170, 140, 0.32)';
  cCtx.fillRect(0, 36, size, 10);
  cCtx.fillRect(0, 52, size, 3);

  const norm = heightToNormalCanvas(hgt, 1.5);
  return {
    map: configureTex(col, { srgb: true, repeatX: 4, repeatY: 4 }),
    normalMap: configureTex(norm, { srgb: false, repeatX: 4, repeatY: 4 }),
  };
}

// 11. Translucent Crinkled Bakery Parchment / Wax Paper
export function createParchmentTextures() {
  const size = 256;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(4212);

  cCtx.fillStyle = '#fcf8f0';
  cCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 45; i++) {
    const x1 = rng() * size;
    const y1 = rng() * size;
    const x2 = x1 + (rng() - 0.5) * 140;
    const y2 = y1 + (rng() - 0.5) * 140;
    hCtx.strokeStyle = rng() > 0.5 ? 'rgba(245,245,245,0.35)' : 'rgba(145,145,145,0.35)';
    hCtx.lineWidth = 2 + rng() * 5;
    hCtx.beginPath();
    hCtx.moveTo(x1, y1);
    hCtx.lineTo(x2, y2);
    hCtx.stroke();
  }

  const norm = heightToNormalCanvas(hgt, 1.2);
  return {
    map: configureTex(col, { srgb: true }),
    normalMap: configureTex(norm, { srgb: false }),
  };
}

// 12. Soft Bokeh Sprite Texture (for floating backlit dust motes / sparkle orbs)
export function createBokehOrbTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  // Real optical lens bokeh disc: soft glowing interior with very subtle luminous outer edge ring!
  g.addColorStop(0.0, 'rgba(255, 250, 236, 0.85)');
  g.addColorStop(0.68, 'rgba(255, 245, 222, 0.72)');
  g.addColorStop(0.84, 'rgba(255, 252, 240, 0.95)');
  g.addColorStop(0.94, 'rgba(255, 244, 215, 0.35)');
  g.addColorStop(1.0, 'rgba(255, 240, 200, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 13. Photorealistic Human Skin Micro-Pore & Warm Sub-Dermal Tonal Variation Texture
export function createSkinTextures() {
  const size = 256;
  const col = makeCanvas(size, size);
  const hgt = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const hCtx = hgt.getContext('2d');
  const rng = mulberry32(7104);

  cCtx.fillStyle = '#e5b79c';
  cCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(0, 0, size, size);

  // Warm soft rosy sub-dermal mottling (authentic lifelike skin!)
  for (let i = 0; i < 180; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 10 + rng() * 30;
    const g = cCtx.createRadialGradient(x, y, 0, x, y, r);
    const tint = rng() > 0.45 ? 'rgba(218, 138, 118, 0.12)' : 'rgba(245, 210, 185, 0.14)';
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(229, 183, 156, 0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
  }

  // Ultra-fine skin micro-texture creases & pores
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const v = rng() > 0.5 ? 182 : 216;
    hCtx.fillStyle = `rgba(${v},${v},${v},0.28)`;
    hCtx.fillRect(x, y, 1 + rng() * 2.5, 1);
  }

  const norm = heightToNormalCanvas(hgt, 0.9);
  return {
    map: configureTex(col, { srgb: true, repeatX: 2, repeatY: 2 }),
    normalMap: configureTex(norm, { srgb: false, repeatX: 2, repeatY: 2 }),
  };
}
