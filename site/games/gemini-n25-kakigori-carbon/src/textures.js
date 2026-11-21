import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.min(1024, w);
  c.height = Math.min(1024, h);
  return c;
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
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

export function createMiniatureTextures() {
  // 1. Warm Hinoki / Cedar Wood Counter (512x512)
  const woodColorCanvas = makeCanvas(512, 512);
  const woodBumpCanvas = makeCanvas(512, 512);
  const wCtx = woodColorCanvas.getContext('2d');
  const wbCtx = woodBumpCanvas.getContext('2d');
  const wImg = wCtx.createImageData(512, 512);
  const wbImg = wbCtx.createImageData(512, 512);

  for (let y = 0; y < 512; y++) {
    // Subtle plank seam across counter
    const plankSeam = (Math.abs((y % 170) - 85) > 83.5) ? 0.68 : 1.0;
    const plankShift = Math.floor(y / 170) * 19.7;
    for (let x = 0; x < 512; x++) {
      const nx = x / 512;
      const ny = y / 512;
      const warp = fbm(nx * 3.5 + plankShift, ny * 10.0, 4) * 0.35;
      const rings = Math.sin((ny * 26.0 + warp * 8.0) * Math.PI * 2) * 0.5 + 0.5;
      const fine = fbm(nx * 48.0, ny * 12.0, 3);
      const grain = rings * 0.58 + fine * 0.42;

      const r = Math.min(255, Math.floor((198 + grain * 42) * plankSeam));
      const g = Math.min(255, Math.floor((142 + grain * 36) * plankSeam));
      const b = Math.min(255, Math.floor((92 + grain * 26) * plankSeam));

      const idx = (y * 512 + x) * 4;
      wImg.data[idx] = r;
      wImg.data[idx + 1] = g;
      wImg.data[idx + 2] = b;
      wImg.data[idx + 3] = 255;

      const bv = Math.floor((grain * 210 + 30) * plankSeam);
      wbImg.data[idx] = bv;
      wbImg.data[idx + 1] = bv;
      wbImg.data[idx + 2] = bv;
      wbImg.data[idx + 3] = 255;
    }
  }
  wCtx.putImageData(wImg, 0, 0);
  wbCtx.putImageData(wbImg, 0, 0);

  const woodMap = new THREE.CanvasTexture(woodColorCanvas);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.repeat.set(2, 1.5);

  const woodBump = new THREE.CanvasTexture(woodBumpCanvas);
  woodBump.wrapS = woodBump.wrapT = THREE.RepeatWrapping;
  woodBump.repeat.set(2, 1.5);

  // 2. Dark Roasted Walnut Wood for Coasters & Caddy (256x256)
  const darkWoodCanvas = makeCanvas(256, 256);
  const dwCtx = darkWoodCanvas.getContext('2d');
  const dwImg = dwCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const g = fbm(x / 32, y / 8, 4);
      const ring = Math.sin((y / 14 + g * 2.4) * Math.PI) * 0.5 + 0.5;
      const v = ring * 0.6 + g * 0.4;
      const idx = (y * 256 + x) * 4;
      dwImg.data[idx] = Math.floor(84 + v * 46);
      dwImg.data[idx + 1] = Math.floor(52 + v * 30);
      dwImg.data[idx + 2] = Math.floor(33 + v * 20);
      dwImg.data[idx + 3] = 255;
    }
  }
  dwCtx.putImageData(dwImg, 0, 0);
  const darkWoodMap = new THREE.CanvasTexture(darkWoodCanvas);
  darkWoodMap.colorSpace = THREE.SRGBColorSpace;
  darkWoodMap.wrapS = darkWoodMap.wrapT = THREE.RepeatWrapping;

  // 3. Cast-Iron Micro-Dimple Bump for Shaver Machine (256x256)
  const ironCanvas = makeCanvas(256, 256);
  const irCtx = ironCanvas.getContext('2d');
  const irImg = irCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const v = fbm(x * 0.25, y * 0.25, 4);
      const c = Math.floor(95 + v * 135);
      const idx = (y * 256 + x) * 4;
      irImg.data[idx] = c;
      irImg.data[idx + 1] = c;
      irImg.data[idx + 2] = c;
      irImg.data[idx + 3] = 255;
    }
  }
  irCtx.putImageData(irImg, 0, 0);
  const ironBump = new THREE.CanvasTexture(ironCanvas);
  ironBump.wrapS = ironBump.wrapT = THREE.RepeatWrapping;
  ironBump.repeat.set(3, 3);

  // 4. Shaved Snow Crystal Bump & Sparkle Roughness Map (512x512)
  const snowBumpCanvas = makeCanvas(512, 512);
  const snowRoughCanvas = makeCanvas(512, 512);
  const sbCtx = snowBumpCanvas.getContext('2d');
  const srCtx = snowRoughCanvas.getContext('2d');
  const sbImg = sbCtx.createImageData(512, 512);
  const srImg = srCtx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const fluffy = fbm(x * 0.08, y * 0.08, 4);
      const micro = hash2(x * 1.7, y * 1.7);
      const sparkle = micro > 0.93 ? 25 : Math.floor(155 + fluffy * 75);
      const bVal = Math.floor(fluffy * 185 + micro * 70);
      const idx = (y * 512 + x) * 4;
      sbImg.data[idx] = bVal;
      sbImg.data[idx + 1] = bVal;
      sbImg.data[idx + 2] = bVal;
      sbImg.data[idx + 3] = 255;

      srImg.data[idx] = sparkle;
      srImg.data[idx + 1] = sparkle;
      srImg.data[idx + 2] = sparkle;
      srImg.data[idx + 3] = 255;
    }
  }
  sbCtx.putImageData(sbImg, 0, 0);
  srCtx.putImageData(srImg, 0, 0);
  const snowBump = new THREE.CanvasTexture(snowBumpCanvas);
  snowBump.wrapS = snowBump.wrapT = THREE.RepeatWrapping;
  snowBump.repeat.set(4, 4);
  const snowRough = new THREE.CanvasTexture(snowRoughCanvas);
  snowRough.wrapS = snowRough.wrapT = THREE.RepeatWrapping;
  snowRough.repeat.set(4, 4);

  // 5. Strawberry Seed-Dimple Albedo & Bump (256x256)
  const strawCanvas = makeCanvas(256, 256);
  const strawBumpCanvas = makeCanvas(256, 256);
  const stCtx = strawCanvas.getContext('2d');
  const stbCtx = strawBumpCanvas.getContext('2d');

  const grad = stCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff4d6a');
  grad.addColorStop(0.25, '#ea1738');
  grad.addColorStop(0.85, '#c80c28');
  grad.addColorStop(1, '#dc1c38');
  stCtx.fillStyle = grad;
  stCtx.fillRect(0, 0, 256, 256);

  stbCtx.fillStyle = '#d8d8d8';
  stbCtx.fillRect(0, 0, 256, 256);

  for (let row = 0; row < 12; row++) {
    const py = 24 + row * 19;
    const cols = 14;
    for (let col = 0; col < cols; col++) {
      const px = ((col + (row % 2) * 0.5) / cols) * 256;
      // Dimple pit in bump
      const bg = stbCtx.createRadialGradient(px, py, 1, px, py, 6.5);
      bg.addColorStop(0, '#353535');
      bg.addColorStop(0.55, '#8a8a8a');
      bg.addColorStop(1, 'rgba(216,216,216,0)');
      stbCtx.fillStyle = bg;
      stbCtx.beginPath();
      stbCtx.arc(px, py, 6.5, 0, Math.PI * 2);
      stbCtx.fill();

      // Tiny golden-yellow strawberry seed
      stCtx.save();
      stCtx.translate(px, py);
      stCtx.fillStyle = 'rgba(130, 8, 22, 0.45)';
      stCtx.beginPath();
      stCtx.ellipse(0, 0, 3.2, 4.4, 0, 0, Math.PI * 2);
      stCtx.fill();
      stCtx.fillStyle = '#ffe17d';
      stCtx.beginPath();
      stCtx.ellipse(0, 0.3, 1.5, 2.5, 0, 0, Math.PI * 2);
      stCtx.fill();
      stCtx.restore();
    }
  }
  const strawberryMap = new THREE.CanvasTexture(strawCanvas);
  strawberryMap.colorSpace = THREE.SRGBColorSpace;
  const strawberryBump = new THREE.CanvasTexture(strawBumpCanvas);

  // 6. Woven Indigo & Coral Noren Textile — Pure Pictorial Motifs, ZERO Text (512x256)
  const norenCanvas = makeCanvas(512, 256);
  const nCtx = norenCanvas.getContext('2d');
  nCtx.fillStyle = '#1f3b68';
  nCtx.fillRect(0, 0, 512, 256);

  // Linen fabric weave threads
  nCtx.strokeStyle = 'rgba(255,248,235,0.06)';
  nCtx.lineWidth = 1;
  for (let x = 0; x < 512; x += 3) {
    nCtx.beginPath();
    nCtx.moveTo(x, 0);
    nCtx.lineTo(x, 256);
    nCtx.stroke();
  }
  for (let y = 0; y < 256; y += 3) {
    nCtx.beginPath();
    nCtx.moveTo(0, y);
    nCtx.lineTo(512, y);
    nCtx.stroke();
  }

  // Dyed Seigaiha waves along bottom edge
  nCtx.strokeStyle = '#f4efe4';
  nCtx.lineWidth = 3.2;
  for (let row = 0; row < 3; row++) {
    const cy = 205 + row * 22;
    for (let cx = -16; cx <= 544; cx += 48) {
      const ox = cx + (row % 2) * 24;
      for (let r = 22; r >= 8; r -= 7) {
        nCtx.beginPath();
        nCtx.arc(ox, cy, r, Math.PI, Math.PI * 2);
        nCtx.stroke();
      }
    }
  }

  // Pictorial dyed crest in center of each panel (Shaved Ice Mountain + Snowflake Crest, zero text!)
  for (let p = 0; p < 3; p++) {
    const cx = 85 + p * 171;
    const cy = 104;
    nCtx.strokeStyle = '#f6f1e6';
    nCtx.lineWidth = 4;
    nCtx.beginPath();
    nCtx.arc(cx, cy, 46, 0, Math.PI * 2);
    nCtx.stroke();

    // Cute dyed kakigori silhouette motif inside circle
    nCtx.fillStyle = '#f6f1e6';
    nCtx.beginPath();
    nCtx.arc(cx, cy - 2, 24, Math.PI, 0);
    nCtx.fill();
    // Coral syrup cap motif
    nCtx.fillStyle = '#ff6075';
    nCtx.beginPath();
    nCtx.arc(cx, cy - 5, 20, Math.PI * 1.12, Math.PI * 1.88);
    nCtx.fill();
    // Footed bowl motif
    nCtx.fillStyle = '#bfe7ff';
    nCtx.beginPath();
    nCtx.moveTo(cx - 28, cy - 2);
    nCtx.lineTo(cx + 28, cy - 2);
    nCtx.lineTo(cx + 15, cy + 16);
    nCtx.lineTo(cx - 15, cy + 16);
    nCtx.closePath();
    nCtx.fill();
    nCtx.fillRect(cx - 11, cy + 18, 22, 5);
  }
  const norenMap = new THREE.CanvasTexture(norenCanvas);
  norenMap.colorSpace = THREE.SRGBColorSpace;

  // 7. Soft Ambient Occlusion Contact Shadow Disc (128x128)
  const aoCanvas = makeCanvas(128, 128);
  const aoCtx = aoCanvas.getContext('2d');
  const aoGrad = aoCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  aoGrad.addColorStop(0, 'rgba(28, 15, 6, 0.62)');
  aoGrad.addColorStop(0.48, 'rgba(28, 15, 6, 0.28)');
  aoGrad.addColorStop(1, 'rgba(28, 15, 6, 0.0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(aoCanvas);

  // 8. Pictorial Condensed Milk Bottle Wrap — Zero Text (256x128)
  const milkWrapCanvas = makeCanvas(256, 128);
  const mCtx = milkWrapCanvas.getContext('2d');
  mCtx.fillStyle = '#fff9ec';
  mCtx.fillRect(0, 0, 256, 128);
  // Red wavy ribbon + pictorial strawberry & cream splash
  mCtx.fillStyle = '#e82942';
  mCtx.fillRect(0, 0, 256, 20);
  mCtx.fillRect(0, 108, 256, 20);
  for (let i = 0; i < 2; i++) {
    const cx = 64 + i * 128;
    // White milk drop splash
    mCtx.fillStyle = '#ffe5b8';
    mCtx.beginPath();
    mCtx.arc(cx, 66, 30, 0, Math.PI * 2);
    mCtx.fill();
    // Pictorial red strawberry icon
    mCtx.fillStyle = '#ef233c';
    mCtx.beginPath();
    mCtx.moveTo(cx, 84);
    mCtx.bezierCurveTo(cx - 18, 70, cx - 16, 46, cx, 48);
    mCtx.bezierCurveTo(cx + 16, 46, cx + 18, 70, cx, 84);
    mCtx.fill();
    // Green leaves
    mCtx.fillStyle = '#2ea844';
    mCtx.beginPath();
    mCtx.ellipse(cx - 6, 46, 7, 3.5, -0.35, 0, Math.PI * 2);
    mCtx.ellipse(cx + 6, 46, 7, 3.5, 0.35, 0, Math.PI * 2);
    mCtx.fill();
  }
  const milkLabelMap = new THREE.CanvasTexture(milkWrapCanvas);
  milkLabelMap.colorSpace = THREE.SRGBColorSpace;

  return {
    woodMap,
    woodBump,
    darkWoodMap,
    ironBump,
    snowBump,
    snowRough,
    strawberryMap,
    strawberryBump,
    norenMap,
    contactShadowMap,
    milkLabelMap,
  };
}
