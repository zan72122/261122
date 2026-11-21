import * as THREE from 'three';

// All procedural textures strictly <= 1024px for iPhone/iPad performance

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Soft pastel studio PMREM environment for clean glossy vinyl/enamel toy look
export function createPastelStudioEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xe8d0de);

  const panelMat1 = new THREE.MeshBasicMaterial({ color: 0xfff8fa });
  const panelMat2 = new THREE.MeshBasicMaterial({ color: 0xf2b8d2 });
  const panelMat3 = new THREE.MeshBasicMaterial({ color: 0xbde8db });
  const panelMat4 = new THREE.MeshBasicMaterial({ color: 0xfae4b4 });

  // Softbox overhead
  const topBox = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), panelMat1);
  topBox.position.set(0, 7, 1);
  topBox.rotation.x = Math.PI / 2;
  envScene.add(topBox);

  // Warm left fill
  const leftBox = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), panelMat4);
  leftBox.position.set(-7, 2.5, 3);
  leftBox.rotation.y = Math.PI / 2;
  envScene.add(leftBox);

  // Mint right rim
  const rightBox = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), panelMat3);
  rightBox.position.set(7, 2.5, 2);
  rightBox.rotation.y = -Math.PI / 2;
  envScene.add(rightBox);

  // Pink warm bounce floor
  const floorBox = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), panelMat2);
  floorBox.position.set(0, -5, 0);
  floorBox.rotation.x = -Math.PI / 2;
  envScene.add(floorBox);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

// Golden fluffy sponge base + dynamic real-time whipped cream painting canvas
export class FrostingCanvas {
  constructor() {
    // Top canvas: 512x512, Side canvas: 1024x256 (both <= 1024px)
    this.topCanvas = makeCanvas(512, 512);
    this.topCtx = this.topCanvas.getContext('2d');
    this.sideCanvas = makeCanvas(1024, 256);
    this.sideCtx = this.sideCanvas.getContext('2d');

    this.topTex = new THREE.CanvasTexture(this.topCanvas);
    this.topTex.colorSpace = THREE.SRGBColorSpace;
    this.topTex.anisotropy = 2;

    this.sideTex = new THREE.CanvasTexture(this.sideCanvas);
    this.sideTex.colorSpace = THREE.SRGBColorSpace;
    this.sideTex.wrapS = THREE.RepeatWrapping;
    this.sideTex.anisotropy = 2;

    // Low-res coverage grid for fast accurate progress tracking
    this.topGridSize = 14; // circular cells on top
    this.sideGridW = 24;
    this.sideGridH = 4;
    this.topCovered = new Uint8Array(this.topGridSize * this.topGridSize);
    this.sideCovered = new Uint8Array(this.sideGridW * this.sideGridH);
    this.totalCells = 0;
    this.coveredCells = 0;

    this.reset();
  }

  reset() {
    this.topCovered.fill(0);
    this.sideCovered.fill(0);
    this.coveredCells = 0;

    // Count valid cells inside top circle + side grid
    let count = 0;
    const half = (this.topGridSize - 1) * 0.5;
    for (let y = 0; y < this.topGridSize; y++) {
      for (let x = 0; x < this.topGridSize; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        if (dx * dx + dy * dy <= 0.96) count++;
      }
    }
    this.totalCells = count + this.sideGridW * this.sideGridH;

    this._drawSpongeTop();
    this._drawSpongeSide();
    this.topTex.needsUpdate = true;
    this.sideTex.needsUpdate = true;
  }

  _drawSpongeTop() {
    const ctx = this.topCtx;
    const w = 512, h = 512;
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 24, w * 0.5, h * 0.5, w * 0.52);
    grad.addColorStop(0, '#ffe394');
    grad.addColorStop(0.76, '#f6c86e');
    grad.addColorStop(1, '#e6ae54');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle soft fluffy sponge pores (toy-like, clean, not noisy)
    for (let i = 0; i < 360; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const r = 1.6 + Math.random() * 3.8;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 246, 210, 0.45)' : 'rgba(205, 138, 48, 0.16)';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawSpongeSide() {
    const ctx = this.sideCtx;
    const w = 1024, h = 256;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f7cb74');
    grad.addColorStop(0.18, '#fbe098');
    grad.addColorStop(0.42, '#f9d47f');
    grad.addColorStop(0.58, '#f9d47f');
    grad.addColorStop(0.84, '#f2c164');
    grad.addColorStop(1, '#e5ad52');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Delicious middle cream & pink strawberry jam sandwich stripe!
    ctx.fillStyle = '#fff9f2';
    ctx.fillRect(0, h * 0.43, w, h * 0.14);
    ctx.fillStyle = '#ff7ca8';
    ctx.fillRect(0, h * 0.485, w, h * 0.045);

    // Cute sponge crumb dots top & bottom layers
    for (let i = 0; i < 420; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      if (py > h * 0.41 && py < h * 0.59) continue;
      const r = 1.4 + Math.random() * 3.2;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 220, 0.4)' : 'rgba(196, 128, 42, 0.17)';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Paint a lush whipped cream dab on the top surface (nx, nz in [-1, 1])
  paintTop(nx, nz, radiusNorm = 0.22, loaded = false) {
    const cx = (nx * 0.5 + 0.5) * 512;
    const cy = (nz * 0.5 + 0.5) * 512;
    const r = radiusNorm * 256 * (loaded ? 1.25 : 1.0);
    const ctx = this.topCtx;

    // Creamy soft shadow halo + bright glossy cream fill + swirl ridge
    const g = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, r * 0.15, cx, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.68, '#fffaf3');
    g.addColorStop(0.88, '#fae9e0');
    g.addColorStop(1, 'rgba(255, 245, 238, 0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle whipped swirl highlight arc
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(4, r * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.48, Math.random() * Math.PI, Math.random() * Math.PI + 1.8);
    ctx.stroke();

    this.topTex.needsUpdate = true;

    // Mark grid cells
    const half = (this.topGridSize - 1) * 0.5;
    const radCells = radiusNorm * half * 1.15;
    const gxCenter = (nx * 0.5 + 0.5) * (this.topGridSize - 1);
    const gyCenter = (nz * 0.5 + 0.5) * (this.topGridSize - 1);
    for (let y = 0; y < this.topGridSize; y++) {
      for (let x = 0; x < this.topGridSize; x++) {
        const dx0 = (x - half) / half;
        const dy0 = (y - half) / half;
        if (dx0 * dx0 + dy0 * dy0 > 0.96) continue;
        const dx = x - gxCenter;
        const dy = y - gyCenter;
        if (dx * dx + dy * dy <= radCells * radCells) {
          const idx = y * this.topGridSize + x;
          if (!this.topCovered[idx]) {
            this.topCovered[idx] = 1;
            this.coveredCells++;
          }
        }
      }
    }
  }

  // Paint cream on the side cylinder (u in [0, 1], v in [0, 1] bottom-to-top)
  paintSide(u, v, radiusU = 0.085, loaded = false) {
    const wrappedU = ((u % 1) + 1) % 1;
    const cx = wrappedU * 1024;
    const cy = (1 - Math.min(1, Math.max(0, v))) * 256;
    const rx = radiusU * 1024 * (loaded ? 1.28 : 1.0);
    const ry = rx * 0.95;
    const ctx = this.sideCtx;

    // Draw wrapped across seam
    [-1024, 0, 1024].forEach((offset) => {
      const px = cx + offset;
      if (px < -rx * 1.2 || px > 1024 + rx * 1.2) return;
      const g = ctx.createRadialGradient(px, cy - ry * 0.12, ry * 0.14, px, cy, Math.max(rx, ry));
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.66, '#fffaf4');
      g.addColorStop(0.88, '#f8e7de');
      g.addColorStop(1, 'rgba(255, 245, 238, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle horizontal spatula stroke sheen
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px - rx * 0.45, cy);
      ctx.lineTo(px + rx * 0.45, cy);
      ctx.stroke();
    });

    this.sideTex.needsUpdate = true;

    // Mark side coverage grid
    const guCenter = wrappedU * this.sideGridW;
    const gvCenter = Math.min(1, Math.max(0, v)) * (this.sideGridH - 1);
    const radU = radiusU * this.sideGridW * 1.25;
    for (let y = 0; y < this.sideGridH; y++) {
      for (let x = 0; x < this.sideGridW; x++) {
        let du = Math.abs(x + 0.5 - guCenter);
        if (du > this.sideGridW * 0.5) du = this.sideGridW - du;
        const dv = Math.abs(y - gvCenter);
        if ((du / radU) * (du / radU) + (dv / 1.55) * (dv / 1.55) <= 1.0) {
          const idx = y * this.sideGridW + x;
          if (!this.sideCovered[idx]) {
            this.sideCovered[idx] = 1;
            this.coveredCells++;
          }
        }
      }
    }
  }

  // Smoothly finish any tiny remaining spots into gleaming snowy cream!
  finishSmooth() {
    const tCtx = this.topCtx;
    const tg = tCtx.createRadialGradient(240, 220, 30, 256, 256, 260);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.75, '#fffaf5');
    tg.addColorStop(1, '#fbeee7');
    tCtx.fillStyle = tg;
    tCtx.fillRect(0, 0, 512, 512);

    // Soft glossy concentric spatula swirl sheen on top
    tCtx.strokeStyle = 'rgba(255, 232, 240, 0.45)';
    tCtx.lineWidth = 6;
    for (let r = 46; r <= 210; r += 40) {
      tCtx.beginPath();
      tCtx.arc(256, 256, r, 0, Math.PI * 2);
      tCtx.stroke();
    }

    const sCtx = this.sideCtx;
    const sg = sCtx.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.6, '#fffaf4');
    sg.addColorStop(1, '#f9e8e0');
    sCtx.fillStyle = sg;
    sCtx.fillRect(0, 0, 1024, 256);

    // Subtle soft horizontal buttercream grooves
    sCtx.strokeStyle = 'rgba(255, 234, 240, 0.45)';
    sCtx.lineWidth = 5;
    for (let y = 32; y < 240; y += 36) {
      sCtx.beginPath();
      sCtx.moveTo(0, y);
      sCtx.lineTo(1024, y);
      sCtx.stroke();
    }

    this.topTex.needsUpdate = true;
    this.sideTex.needsUpdate = true;
    this.coveredCells = this.totalCells;
  }

  getCoverage() {
    return this.totalCells > 0 ? this.coveredCells / this.totalCells : 0;
  }
}

// Glossy toy strawberry texture (red or special pearl-pink!)
export function createStrawberryTexture(isPearl = false) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  if (isPearl) {
    g.addColorStop(0, '#ffdce9');
    g.addColorStop(0.4, '#ffacc9');
    g.addColorStop(1, '#ff8cb7');
  } else {
    g.addColorStop(0, '#ff6b8b');
    g.addColorStop(0.32, '#ff355e');
    g.addColorStop(0.82, '#eb1e4b');
    g.addColorStop(1, '#cf1540');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Cute tidy staggered strawberry seeds
  const rows = 9;
  const cols = 12;
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * 244 + 6;
    const offset = (r % 2) * (256 / cols) * 0.5;
    for (let col = 0; col < cols; col++) {
      const x = (col / cols) * 256 + offset;
      // Subtle dimple shadow
      ctx.fillStyle = isPearl ? 'rgba(235, 110, 160, 0.35)' : 'rgba(150, 12, 42, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 1.5, 4.2, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cute golden-cream seed
      ctx.fillStyle = isPearl ? '#fff6d6' : '#ffe89c';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.7, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Pastel candy-striped birthday candle texture
export function createCandleTexture(stripeHex, baseHex = '#fffdf8') {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = stripeHex;
  for (let i = -256; i < 512; i += 44) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 20, 0);
    ctx.lineTo(i + 20 + 256, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Pastel lavender & pink striped piping bag texture
export function createPipingBagTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff5fa';
  ctx.fillRect(0, 0, 256, 256);

  const stripes = ['#ffb5d2', '#d7c2ff', '#b8f0dc', '#ffe299'];
  const stripeW = 32;
  for (let x = 0; x < 256; x += stripeW) {
    ctx.fillStyle = stripes[(x / stripeW) % stripes.length];
    ctx.fillRect(x, 0, stripeW * 0.55, 256);
  }
  // Tiny glossy pastel polka dots overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let y = 16; y < 256; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Soft pastel gingham tabletop texture (rich enough so white cake pops crisply!)
export function createTableclothTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fde4ee';
  ctx.fillRect(0, 0, 512, 512);

  const cell = 64;
  ctx.fillStyle = 'rgba(248, 165, 200, 0.42)';
  for (let y = 0; y < 512; y += cell * 2) {
    ctx.fillRect(0, y, 512, cell);
  }
  for (let x = 0; x < 512; x += cell * 2) {
    ctx.fillRect(x, 0, cell, 512);
  }
  // Delicate cream stitch dots
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  for (let y = cell * 0.5; y < 512; y += cell) {
    for (let x = cell * 0.5; x < 512; x += cell) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.5, 2.5);
  return tex;
}

// Soft dreamy pastel striped wallpaper for the toy patisserie backdrop
export function createWallpaperTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fdd8ea';
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = x % 128 === 0 ? '#f7bfd9' : '#fee8f2';
    ctx.fillRect(x, 0, 32, 512);
  }
  // Soft subtle pastel polka dots on wallpaper
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  for (let y = 40; y < 512; y += 96) {
    for (let x = 48; x < 512; x += 128) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}
