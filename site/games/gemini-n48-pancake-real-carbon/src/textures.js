import * as THREE from 'three';

// Deterministic fast value-noise + fBm for procedural photorealistic surfaces
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2D(x, y, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

// Builds a rich HDR-like morning kitchen environment cubemap/PMREM (max <= 512px)
export function createMorningKitchenEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();

  // Warm morning interior shell
  const roomGeo = new THREE.SphereGeometry(8, 32, 24);
  const pos = roomGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = y / 8;
    if (ny > 0.15) {
      // Warm sunlit plaster ceiling
      c.setRGB(1.15, 1.04, 0.90).multiplyScalar(0.75 + ny * 0.45);
    } else if (ny > -0.25) {
      // Soft cream & natural wood kitchen mid-walls
      c.setRGB(0.88, 0.74, 0.58);
    } else {
      // Warm honey-oak countertop & floor bounce
      c.setRGB(0.62, 0.42, 0.25);
    }
    // Dark stove / range hood contrast on right-back for realistic metallic reflections
    if (x > 1.5 && z < -1.5 && ny > -0.1) {
      c.multiplyScalar(0.35);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  roomGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const roomMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Bright morning window light panel on upper-left-back (creates crisp natural catchlights in eyes, syrup, batter & pan!)
  const winGroup = new THREE.Group();
  const winGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.45, 1.95), side: THREE.DoubleSide })
  );
  winGroup.add(winGlow);

  // Sun core hot-spot inside window for sharp specular glint on maple syrup & eyes
  const sunCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(7.5, 6.0, 4.2), side: THREE.DoubleSide })
  );
  sunCore.position.set(-0.5, 0.6, 0.05);
  winGroup.add(sunCore);

  // Window wooden mullions so reflections have real window-pane structure!
  const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.35, 0.26), side: THREE.DoubleSide });
  const vBar = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 4.3), barMat);
  vBar.position.z = 0.08;
  const hBar = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 0.18), barMat);
  hBar.position.z = 0.08;
  winGroup.add(vBar, hBar);

  winGroup.position.set(-5.2, 3.1, -3.2);
  winGroup.lookAt(0, 0, 0);
  envScene.add(winGroup);

  // Soft cool-sky fill bounce from high window top
  const skyFill = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 2.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 2.3, 2.9), side: THREE.DoubleSide })
  );
  skyFill.position.set(-3.5, 5.8, -1.5);
  skyFill.lookAt(0, 0, 0);
  envScene.add(skyFill);

  // Warm overhead breakfast pendant glow
  const pendant = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 2.6, 1.5) })
  );
  pendant.position.set(2.2, 4.8, 1.6);
  envScene.add(pendant);

  const rt = pmrem.fromScene(envScene, 0.025, 0.1, 20);
  pmrem.dispose();
  roomGeo.dispose();
  return rt.texture;
}

// Oak wood countertop texture set (1024x512, strictly <= 1024px)
export function createOakWoodTextures() {
  const w = 1024, h = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rCtx = roughCanvas.getContext('2d');

  const img = ctx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);
  const d = img.data;
  const rd = rImg.data;

  const plankCount = 5;
  const plankH = h / plankCount;

  for (let y = 0; y < h; y++) {
    const plankIdx = Math.floor(y / plankH);
    const py = (y % plankH) / plankH;
    const seamDist = Math.min(py, 1 - py) * plankH;
    const seedX = plankIdx * 37.4;
    const plankTint = (hash2(plankIdx, 9.1) - 0.5) * 18;

    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const warp = fbm2D(nx * 3.5 + seedX, y * 0.012, 3) * 4.5;
      const ring = Math.sin((y * 0.22 + warp * 5.2 + plankIdx * 11.0)) * 0.5 + 0.5;
      const fineGrain = fbm2D(nx * 48 + seedX, y * 0.65, 3);
      const pore = noise2D(nx * 220 + seedX, y * 1.8);

      let grain = Math.pow(ring, 2.2) * 0.55 + fineGrain * 0.35 + pore * 0.1;
      let r = 178 + plankTint - grain * 54;
      let g = 126 + plankTint * 0.72 - grain * 46;
      let b = 79 + plankTint * 0.45 - grain * 34;

      let rough = 105 + grain * 65;

      // Subtle bevel plank seam
      if (seamDist < 2.2) {
        const s = seamDist / 2.2;
        r *= 0.55 + 0.45 * s;
        g *= 0.52 + 0.48 * s;
        b *= 0.50 + 0.50 * s;
        rough = 215;
      }

      const idx = (y * w + x) * 4;
      d[idx] = Math.max(0, Math.min(255, r));
      d[idx + 1] = Math.max(0, Math.min(255, g));
      d[idx + 2] = Math.max(0, Math.min(255, b));
      d[idx + 3] = 255;

      const rv = Math.max(55, Math.min(240, rough));
      rd[idx] = rv;
      rd[idx + 1] = rv;
      rd[idx + 2] = rv;
      rd[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, bumpMap: roughnessMap };
}

// Seasoned Cast-Iron Skillet Texture (512x512)
export function createCastIronTextures() {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = cCanvas.height = size;
  const ctx = cCanvas.getContext('2d');

  const rCanvas = document.createElement('canvas');
  rCanvas.width = rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');

  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const d = img.data;
  const rd = rImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const dist = Math.hypot(dx, dy);

      const sand = noise2D(x * 0.55, y * 0.55) * 0.6 + noise2D(x * 1.3, y * 1.3) * 0.4;
      const oilPatch = fbm2D(x * 0.018, y * 0.018, 4);
      // Center of pan is slightly smoother & darker with warm oil seasoning
      const centerOil = Math.max(0, 1 - dist * 1.05);

      const base = 24 + sand * 14 - centerOil * 7 + oilPatch * 8;
      const idx = (y * size + x) * 4;
      d[idx] = base + 2;
      d[idx + 1] = base + 1;
      d[idx + 2] = base;
      d[idx + 3] = 255;

      // Lower roughness in oiled center so pan glints warmly in morning sun
      const rough = 148 - centerOil * 62 - oilPatch * 26 + sand * 34;
      const rv = Math.max(48, Math.min(220, rough));
      rd[idx] = rv;
      rd[idx + 1] = rv;
      rd[idx + 2] = rv;
      rd[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  return { map, roughnessMap, bumpMap: roughnessMap };
}

// Human Skin Albedo & Micro-pore Bump Texture (512x512)
export function createHumanSkinTextures() {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = cCanvas.height = size;
  const ctx = cCanvas.getContext('2d');

  const bCanvas = document.createElement('canvas');
  bCanvas.width = bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');

  // Warm lifelike Japanese female skin base (rich natural midtone so sunlight never blows it out)
  ctx.fillStyle = '#e0aa8c';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const bImg = bCtx.createImageData(size, size);
  const d = img.data;
  const bd = bImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mottle = fbm2D(x * 0.03, y * 0.03, 3);
      const pore = noise2D(x * 0.85, y * 0.85);
      const idx = (y * size + x) * 4;
      // Subtle dermal hemoglobin/melanin variation so skin never looks flat plastic
      d[idx] = Math.min(255, 224 + (mottle - 0.5) * 16 + (pore - 0.5) * 6);
      d[idx + 1] = Math.min(255, 168 + (mottle - 0.5) * 13 + (pore - 0.5) * 5);
      d[idx + 2] = Math.min(255, 138 + (mottle - 0.5) * 13 + (pore - 0.5) * 5);
      d[idx + 3] = 255;

      const bv = Math.max(0, Math.min(255, 128 + (pore - 0.5) * 70 + (mottle - 0.5) * 30));
      bd[idx] = bv;
      bd[idx + 1] = bv;
      bd[idx + 2] = bv;
      bd[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

// Realistic Human Eye Iris + Sclera Texture (512x256 equirectangular sphere UV!)
export function createEyeTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const cx = w / 2;
  const cy = h / 2;

  // Warm hydrated white sclera with subtle pink corner warmth
  const scleraGrad = ctx.createRadialGradient(cx, cy, h * 0.14, cx, cy, h * 0.58);
  scleraGrad.addColorStop(0.0, '#fbf9f6');
  scleraGrad.addColorStop(0.45, '#f4ede6');
  scleraGrad.addColorStop(1.0, '#dfb9ae');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, w, h);

  // Equirectangular sphere has 2:1 horizontal circumference vs meridian height;
  // keeping circle in pixel space on 512x256 maps to exact circular iris on 3D sphere!
  // Real human iris subtends ~27 deg half-angle -> radius = (27/180)*256 = 38.4px!
  const irisR = 39;

  const limbalGrad = ctx.createRadialGradient(cx, cy, irisR * 0.22, cx, cy, irisR);
  limbalGrad.addColorStop(0.0, '#180b05');
  limbalGrad.addColorStop(0.36, '#63361a');
  limbalGrad.addColorStop(0.74, '#4d2812');
  limbalGrad.addColorStop(0.92, '#1f0e06');
  limbalGrad.addColorStop(1.0, 'rgba(31,14,6,0)');
  ctx.fillStyle = limbalGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  // Delicate radial iris stroma fibers
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const len = irisR * (0.82 + hash2(i, 3.1) * 0.14);
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(156, 96, 48, 0.38)' : 'rgba(38, 18, 8, 0.30)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * irisR * 0.30, Math.sin(a) * irisR * 0.30);
    ctx.lineTo(Math.cos(a + 0.03) * len, Math.sin(a + 0.03) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Deep centered pupil + crisp window catchlight glint
  const pupilGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, irisR * 0.38);
  pupilGrad.addColorStop(0, '#040201');
  pupilGrad.addColorStop(0.84, '#0c0604');
  pupilGrad.addColorStop(1.0, 'rgba(15,8,5,0)');
  ctx.fillStyle = pupilGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Subtle baked window specular highlight for lively motherly gaze even in soft light
  ctx.fillStyle = 'rgba(255, 252, 244, 0.92)';
  ctx.beginPath();
  ctx.arc(cx - irisR * 0.28, cy - irisR * 0.26, irisR * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 248, 235, 0.45)';
  ctx.beginPath();
  ctx.arc(cx + irisR * 0.24, cy + irisR * 0.22, irisR * 0.07, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Hair Strand Texture (512x512)
export function createHairTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#231610';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = hash2(i, 1.7) * size;
    const shade = hash2(i, 5.3);
    ctx.strokeStyle = shade > 0.72
      ? `rgba(112, 72, 46, ${0.22 + shade * 0.22})`
      : shade > 0.35
        ? `rgba(58, 36, 24, 0.35)`
        : `rgba(18, 10, 7, 0.45)`;
    ctx.lineWidth = 0.8 + hash2(i, 8.9) * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(
      x + (hash2(i, 2.2) - 0.5) * 12, size * 0.33,
      x + (hash2(i, 4.4) - 0.5) * 12, size * 0.66,
      x + (hash2(i, 6.6) - 0.5) * 8, size
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Cozy Knit & Linen Fabric Weave Textures (512x512)
export function createFabricTextures(baseHex = '#efe5d8', ribScale = 1.0) {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = cCanvas.height = size;
  const ctx = cCanvas.getContext('2d');

  const bCanvas = document.createElement('canvas');
  bCanvas.width = bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');

  const baseColor = new THREE.Color(baseHex);
  const br = baseColor.r * 255;
  const bg = baseColor.g * 255;
  const bb = baseColor.b * 255;

  const img = ctx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const d = img.data;
  const bd = bImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x * 0.22 * ribScale;
      const v = y * 0.32 * ribScale;
      const stitch = (Math.sin(u + Math.sin(v) * 0.8) * 0.5 + 0.5) * (Math.cos(v * 1.4) * 0.35 + 0.65);
      const fuzz = noise2D(x * 0.7, y * 0.7) * 0.25;
      const k = 0.86 + stitch * 0.16 + fuzz * 0.08;
      const idx = (y * size + x) * 4;
      d[idx] = Math.min(255, br * k);
      d[idx + 1] = Math.min(255, bg * k);
      d[idx + 2] = Math.min(255, bb * k);
      d[idx + 3] = 255;

      const bv = Math.max(0, Math.min(255, 110 + stitch * 110 + fuzz * 35));
      bd[idx] = bv;
      bd[idx + 1] = bv;
      bd[idx + 2] = bv;
      bd[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  return { map, bumpMap };
}

// Soft Bokeh Dust Mote Sprite & Steam Puff Sprite (128x128)
export function createAtmosphereTextures() {
  // Dust bokeh disc with gentle airy bright rim
  const dSize = 128;
  const dCanvas = document.createElement('canvas');
  dCanvas.width = dCanvas.height = dSize;
  const dCtx = dCanvas.getContext('2d');
  const cx = dSize / 2;
  const dGrad = dCtx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  dGrad.addColorStop(0.0, 'rgba(255, 250, 236, 0.92)');
  dGrad.addColorStop(0.58, 'rgba(255, 244, 216, 0.76)');
  dGrad.addColorStop(0.78, 'rgba(255, 248, 228, 0.95)');
  dGrad.addColorStop(1.0, 'rgba(255, 244, 214, 0.0)');
  dCtx.fillStyle = dGrad;
  dCtx.fillRect(0, 0, dSize, dSize);
  const dustTex = new THREE.CanvasTexture(dCanvas);
  dustTex.colorSpace = THREE.SRGBColorSpace;

  // Soft cloudy steam wisp
  const sSize = 128;
  const sCanvas = document.createElement('canvas');
  sCanvas.width = sCanvas.height = sSize;
  const sCtx = sCanvas.getContext('2d');
  const sImg = sCtx.createImageData(sSize, sSize);
  const sd = sImg.data;
  for (let y = 0; y < sSize; y++) {
    for (let x = 0; x < sSize; x++) {
      const dx = (x / sSize - 0.5) * 2;
      const dy = (y / sSize - 0.5) * 2;
      const r = Math.hypot(dx, dy);
      const falloff = Math.max(0, 1 - r);
      const wisp = fbm2D(x * 0.055 + 3.1, y * 0.055 + 7.4, 4);
      const alpha = Math.pow(falloff, 1.8) * Math.max(0, wisp * 1.25 - 0.18);
      const idx = (y * sSize + x) * 4;
      sd[idx] = 255;
      sd[idx + 1] = 250;
      sd[idx + 2] = 242;
      sd[idx + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }
  sCtx.putImageData(sImg, 0, 0);
  const steamTex = new THREE.CanvasTexture(sCanvas);
  steamTex.colorSpace = THREE.SRGBColorSpace;

  return { dustTex, steamTex };
}

// Strawberry Seed & Glossy Berry Texture (256x256)
export function createStrawberryTextures() {
  const size = 256;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = cCanvas.height = size;
  const ctx = cCanvas.getContext('2d');

  const bCanvas = document.createElement('canvas');
  bCanvas.width = bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#e83a2d');
  grad.addColorStop(0.28, '#c9141b');
  grad.addColorStop(0.85, '#a30b14');
  grad.addColorStop(1.0, '#880810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, size, size);

  // Recessed golden achenes (strawberry seeds) in staggered rows
  const rows = 11;
  const cols = 16;
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * size;
    const rowCols = cols;
    for (let c = 0; c < rowCols; c++) {
      const x = ((c + (r % 2) * 0.5) / rowCols) * size;
      // Dimple shadow on bump
      const bg = bCtx.createRadialGradient(x, y, 0.5, x, y, 7.5);
      bg.addColorStop(0, '#282828');
      bg.addColorStop(0.45, '#585858');
      bg.addColorStop(1, 'rgba(200,200,200,0)');
      bCtx.fillStyle = bg;
      bCtx.beginPath();
      bCtx.arc(x, y, 7.5, 0, Math.PI * 2);
      bCtx.fill();

      // Seed speck
      ctx.fillStyle = '#e7be62';
      ctx.beginPath();
      ctx.ellipse(x, y, 1.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  return { map, bumpMap };
}
