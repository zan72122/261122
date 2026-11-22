import * as THREE from '../vendor/three.module.min.js';

// Deterministic pseudo-random helper for crisp procedural organic textures
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

// Warm morning Japanese kitchen studio HDRI-like environment map via PMREM
export function createKitchenEnvMap(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Vertical gradient: warm sunlit ceiling -> soft cream kitchen walls -> rich oak counter bounce
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#fff9ee');
  grad.addColorStop(0.28, '#f8e9d2');
  grad.addColorStop(0.48, '#e8d4b8');
  grad.addColorStop(0.55, '#a88158');
  grad.addColorStop(0.80, '#6d4d31');
  grad.addColorStop(1.0, '#3e2b1c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Bright morning window light patch on upper-left for realistic specular catchlights on yolk, steel, ceramic
  const winGrad = ctx.createRadialGradient(115, 78, 12, 115, 78, 95);
  winGrad.addColorStop(0, 'rgba(255, 253, 244, 1.0)');
  winGrad.addColorStop(0.45, 'rgba(255, 246, 224, 0.85)');
  winGrad.addColorStop(1, 'rgba(255, 240, 210, 0.0)');
  ctx.fillStyle = winGrad;
  ctx.fillRect(0, 0, 250, 180);

  // Soft overhead kitchen pendant lamp specular highlight
  const lampGrad = ctx.createRadialGradient(340, 55, 6, 340, 55, 58);
  lampGrad.addColorStop(0, 'rgba(255, 242, 214, 0.95)');
  lampGrad.addColorStop(0.5, 'rgba(255, 225, 178, 0.45)');
  lampGrad.addColorStop(1, 'rgba(255, 225, 178, 0.0)');
  ctx.fillStyle = lampGrad;
  ctx.fillRect(260, 0, 180, 140);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return rt.texture;
}

// Realistic wood grain textures (variant: 'oak' | 'hinoki' | 'walnut' | 'bento')
export function createWoodTextures(variant = 'oak') {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const palettes = {
    oak: { base: '#c69868', dark: '#9e6f42', light: '#d8b184', seed: 101 },
    hinoki: { base: '#ead1a8', dark: '#d2b07d', light: '#f5e3c3', seed: 202 },
    walnut: { base: '#6f482b', dark: '#4a2e1a', light: '#8c603e', seed: 303 },
    bento: { base: '#d9ae78', dark: '#b5844c', light: '#e8c596', seed: 404 },
  };
  const pal = palettes[variant] || palettes.oak;
  const rand = mulberry32(pal.seed);

  ctx.fillStyle = pal.base;
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Wood fibers & subtle growth rings
  for (let y = 0; y < size; y++) {
    const wave =
      Math.sin(y * 0.055) * 0.45 +
      Math.sin(y * 0.14 + 1.3) * 0.3 +
      Math.sin(y * 0.022) * 0.25;
    const alpha = 0.06 + Math.abs(wave) * 0.16;
    ctx.fillStyle = wave > 0 ? pal.dark : pal.light;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, y, size, 1.5);

    const bVal = Math.floor(128 + wave * 34);
    bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.fillRect(0, y, size, 1);
  }
  ctx.globalAlpha = 1.0;

  // Fine longitudinal grain streaks
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 50 + rand() * 240;
    const h = 0.7 + rand() * 2.1;
    ctx.fillStyle = rand() > 0.45 ? pal.dark : pal.light;
    ctx.globalAlpha = 0.05 + rand() * 0.11;
    ctx.fillRect(x - len * 0.5, y, len, h);

    bCtx.fillStyle = rand() > 0.5 ? '#666666' : '#9a9a9a';
    bCtx.globalAlpha = 0.18;
    bCtx.fillRect(x - len * 0.5, y, len, h);
  }
  ctx.globalAlpha = 1.0;
  bCtx.globalAlpha = 1.0;

  // Subtle plank seams for countertop oak
  if (variant === 'oak') {
    for (let p = 1; p < 4; p++) {
      const py = Math.floor((p / 4) * size);
      ctx.fillStyle = 'rgba(72,44,22,0.22)';
      ctx.fillRect(0, py, size, 2);
      bCtx.fillStyle = '#383838';
      bCtx.fillRect(0, py, size, 2);
    }
  }

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

// Warm cream Japanese kitchen subway tile backsplash
export function createTileTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(777);

  // Soft warm mortar grout base
  ctx.fillStyle = '#b4a592';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const th = size / rows;
  const tw = size / cols;
  const grout = 4;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * tw + offset + grout * 0.5;
      const y = r * th + grout * 0.5;
      const w = tw - grout;
      const h = th - grout;

      // Warm glazed stoneware tile tone so bright sunlit steam plumes pop dramatically!
      const tone = 208 + Math.floor((rand() - 0.5) * 12);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, `rgb(${tone}, ${tone - 11}, ${tone - 22})`);
      grad.addColorStop(1, `rgb(${tone - 12}, ${tone - 22}, ${tone - 33})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Subtle glossy bevel top highlight
      ctx.fillStyle = 'rgba(255,250,240,0.34)';
      ctx.fillRect(x + 2, y + 2, w - 4, 3);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.6, 1.8);
  return tex;
}

// Handcrafted Japanese speckled stoneware ceramic texture
export function createCeramicTexture(baseHex = '#efe8db', speckleHex = '#6b5542', seed = 512) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Soft pottery wheel glaze bands
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(110,85,60,0.04)';
    ctx.fillRect(0, y, size, 3);
  }

  // Authentic iron-speckle dots
  ctx.fillStyle = speckleHex;
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 2.1;
    ctx.globalAlpha = 0.14 + rand() * 0.38;
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

// Seasoned dark cast-iron / nonstick rectangular tamagoyaki pan interior texture
export function createPanSurfaceTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(909);

  ctx.fillStyle = '#252427';
  ctx.fillRect(0, 0, size, size);

  // Subtle metallic micro-grain + warm oil sheen in center
  for (let i = 0; i < 3500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = 30 + Math.floor(rand() * 28);
    ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const oil = ctx.createRadialGradient(size * 0.5, size * 0.5, 25, size * 0.5, size * 0.5, size * 0.48);
  oil.addColorStop(0, 'rgba(95, 76, 42, 0.24)');
  oil.addColorStop(0.7, 'rgba(60, 52, 42, 0.10)');
  oil.addColorStop(1, 'rgba(20, 20, 22, 0.0)');
  ctx.fillStyle = oil;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Realistic eggshell canvas texture (supports live crack drawing!)
export function createEggshellController(baseColor = '#d9a47c', seed = 11) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);

  function drawBase() {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Warm organic mottling
    for (let i = 0; i < 45; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 10 + rand() * 34;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(175,112,72,0.12)');
      g.addColorStop(1, 'rgba(175,112,72,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Fine eggshell pores & natural speckles
    for (let i = 0; i < 360; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.5 + rand() * 1.4;
      ctx.fillStyle = rand() > 0.35 ? 'rgba(122,74,44,0.28)' : 'rgba(255,244,230,0.26)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBase();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  function drawCrack(severity = 1) {
    ctx.save();
    ctx.strokeStyle = '#3a2216';
    ctx.lineWidth = severity > 1 ? 3.4 : 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const yMid = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(size * 0.14, yMid + 4);
    const pts = [
      [0.24, -6],
      [0.34, 8],
      [0.45, -9],
      [0.54, 7],
      [0.65, -7],
      [0.76, 6],
      [0.86, -3],
    ];
    for (const [px, dy] of pts) {
      ctx.lineTo(size * px, yMid + dy);
    }
    ctx.stroke();

    // Fine branching micro-cracks
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(size * 0.45, yMid - 9);
    ctx.lineTo(size * 0.48, yMid - 28);
    ctx.moveTo(size * 0.54, yMid + 7);
    ctx.lineTo(size * 0.59, yMid + 26);
    ctx.stroke();

    // White inner shell edge highlight
    ctx.strokeStyle = 'rgba(255,250,240,0.65)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(size * 0.24, yMid - 4);
    ctx.lineTo(size * 0.45, yMid - 7);
    ctx.lineTo(size * 0.65, yMid - 5);
    ctx.stroke();
    ctx.restore();
    tex.needsUpdate = true;
  }

  function reset() {
    drawBase();
    tex.needsUpdate = true;
  }

  return { texture: tex, drawCrack, reset };
}

// Plump glossy steamed Japanese white rice texture for bento box
export function createRiceTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(4242);

  ctx.fillStyle = '#ece8df';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 950; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const ang = rand() * Math.PI;
    const rx = 7 + rand() * 4;
    const ry = 3.2 + rand() * 1.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // Grain shadow
    ctx.fillStyle = 'rgba(170,162,148,0.45)';
    ctx.beginPath();
    ctx.ellipse(1.2, 1.5, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grain body
    const shade = 244 + Math.floor(rand() * 11);
    ctx.fillStyle = `rgb(${shade},${shade - 2},${shade - 6})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wet steam specular glint
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.25, -ry * 0.28, rx * 0.35, ry * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Scattered toasted black sesame seeds (kurogoma)
  for (let i = 0; i < 38; i++) {
    const x = 60 + rand() * (size - 120);
    const y = 60 + rand() * (size - 120);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = '#24201e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.2, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft layered wispy steam texture for kitchen steam particles
export function createSteamTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(8080);

  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 20; i++) {
    const ox = size * 0.5 + (rand() - 0.5) * 58;
    const oy = size * 0.5 + (rand() - 0.5) * 58;
    const r = 48 + rand() * 52;
    const g = ctx.createRadialGradient(ox, oy, 2, ox, oy, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.58)');
    g.addColorStop(0.45, 'rgba(255, 253, 248, 0.30)');
    g.addColorStop(1, 'rgba(255, 252, 245, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dynamic mixing bowl liquid canvas (shows yolk ribbons -> glossy golden emulsion + foam + mix-ins!)
export function createBowlLiquidController() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  function render(state) {
    // state: { mixProgress: 0..1, swirlAngle, froth: 0..1, hasNegi, hasNori, hasDashi, eggCount }
    const m = Math.max(0, Math.min(1, state.mixProgress || 0));
    const cx = size * 0.5;
    const cy = size * 0.5;

    // Base color blends from translucent albumen pale -> rich golden custard yellow
    const r = Math.round(244 + (252 - 244) * m - (state.hasDashi ? 5 : 0));
    const g = Math.round(224 + (192 - 224) * m - (state.hasDashi ? 10 : 0));
    const b = Math.round(166 + (46 - 166) * m);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, size, size);

    // Subtle radial depth toward center
    const depth = ctx.createRadialGradient(cx, cy, 20, cx, cy, size * 0.5);
    depth.addColorStop(0, `rgba(255, 182, 28, ${0.15 + m * 0.35})`);
    depth.addColorStop(0.75, `rgba(235, 165, 26, ${0.08 + m * 0.16})`);
    depth.addColorStop(1, 'rgba(180, 120, 20, 0.22)');
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, size, size);

    // Swirling yolk ribbons during mixing!
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.swirlAngle || 0);

    if (m > 0.02 && m < 0.96) {
      const ribbonAlpha = Math.sin(m * Math.PI) * 0.72;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i / 6) * Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0
          ? `rgba(255, 146, 14, ${ribbonAlpha})`
          : `rgba(255, 246, 212, ${ribbonAlpha * 0.85})`;
        ctx.lineWidth = 22 * (1 - m * 0.45);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let a = 0; a < 4.5; a += 0.25) {
          const rad = 22 + a * 38;
          const x = Math.cos(a) * rad;
          const y = Math.sin(a) * rad;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Dashi golden amber swirl
    if (state.hasDashi) {
      ctx.strokeStyle = `rgba(182, 112, 24, ${0.32 - m * 0.16})`;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 96, 0, Math.PI * 1.45);
      ctx.stroke();
    }

    // Chopped green negi flecks floating in the egg
    if (state.hasNegi) {
      const rand = mulberry32(1337);
      for (let i = 0; i < 58; i++) {
        const ang = rand() * Math.PI * 2;
        const rad = 18 + Math.sqrt(rand()) * 195;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rand() * Math.PI);
        ctx.fillStyle = rand() > 0.35 ? '#488c34' : '#78b84c';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7 + rand() * 4, 4 + rand() * 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Dark roasted nori strips
    if (state.hasNori) {
      const rand = mulberry32(2448);
      for (let i = 0; i < 34; i++) {
        const ang = rand() * Math.PI * 2;
        const rad = 20 + Math.sqrt(rand()) * 185;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rand() * Math.PI);
        ctx.fillStyle = '#1e2c1c';
        ctx.fillRect(-10, -3.5, 20, 7);
        ctx.restore();
      }
    }

    // Frothy glossy micro-bubbles around rim & swirl
    const bubbleCount = Math.floor(14 + (m + (state.froth || 0)) * 55);
    const bRand = mulberry32(9191);
    for (let i = 0; i < bubbleCount; i++) {
      const ang = bRand() * Math.PI * 2;
      const rad = 60 + bRand() * 175;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      const br = 2.2 + bRand() * 5.2;
      ctx.fillStyle = 'rgba(255, 250, 224, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(x - br * 0.3, y - br * 0.3, br * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    tex.needsUpdate = true;
  }

  render({ mixProgress: 0, swirlAngle: 0, froth: 0 });
  return { texture: tex, render };
}

// Dynamic sizzling egg sheet texture inside the rectangular pan
export function createPanEggSheetController() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  function render(opts) {
    // opts: { cook: 0..1, sear: 0..1, hasNegi, hasNori, hasDashi, marbled }
    const cook = Math.max(0, Math.min(1, opts.cook || 0));
    const sear = Math.max(0, Math.min(1, opts.sear || 0));

    // Raw glossy bright orange-gold -> fluffy warm cooked yellow
    const r = Math.round(252 - cook * 3);
    const g = Math.round(196 + cook * 20 - (opts.hasDashi ? 6 : 0));
    const b = Math.round(44 + cook * 34);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, size, size);

    // Optional marbled egg-white ribbons if player mixed gently
    if (opts.marbled) {
      const mRand = mulberry32(601);
      ctx.strokeStyle = `rgba(255, 252, 240, ${0.42 + cook * 0.25})`;
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        ctx.lineWidth = 10 + mRand() * 14;
        ctx.beginPath();
        const sx = mRand() * size;
        const sy = mRand() * size;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + (mRand() - 0.5) * 180, sy + (mRand() - 0.5) * 180, sx + (mRand() - 0.5) * 260, sy + (mRand() - 0.5) * 160);
        ctx.stroke();
      }
    }

    // Cooked lacy golden edges & organic Maillard sear patches
    const edgeGrad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.18, size * 0.5, size * 0.5, size * 0.62);
    edgeGrad.addColorStop(0, 'rgba(255, 224, 96, 0.0)');
    edgeGrad.addColorStop(0.8, `rgba(222, 152, 42, ${cook * 0.24})`);
    edgeGrad.addColorStop(1, `rgba(176, 98, 22, ${cook * (0.28 + sear * 0.35)})`);
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, size, size);

    if (sear > 0.05) {
      const sRand = mulberry32(3141);
      for (let i = 0; i < 24; i++) {
        const x = 40 + sRand() * (size - 80);
        const y = 40 + sRand() * (size - 80);
        const rad = 22 + sRand() * 58;
        const g2 = ctx.createRadialGradient(x, y, 4, x, y, rad);
        g2.addColorStop(0, `rgba(174, 96, 22, ${sear * 0.38})`);
        g2.addColorStop(0.6, `rgba(204, 130, 38, ${sear * 0.20})`);
        g2.addColorStop(1, 'rgba(204, 130, 38, 0.0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tiny sizzling air bubbles & soft cooked pores
    const bRand = mulberry32(5522);
    for (let i = 0; i < 75; i++) {
      const x = 24 + bRand() * (size - 48);
      const y = 24 + bRand() * (size - 48);
      const br = 2 + bRand() * 6.5;
      ctx.fillStyle = `rgba(255, 246, 198, ${0.22 + cook * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(195, 135, 34, ${0.18 + cook * 0.22})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Embedded green negi bits
    if (opts.hasNegi) {
      const rand = mulberry32(1337);
      for (let i = 0; i < 55; i++) {
        const x = 26 + rand() * (size - 52);
        const y = 26 + rand() * (size - 52);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rand() * Math.PI);
        ctx.fillStyle = rand() > 0.3 ? '#468c32' : '#73b349';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 + rand() * 4, 4 + rand() * 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Embedded nori flecks / ribbon
    if (opts.hasNori) {
      const rand = mulberry32(2448);
      for (let i = 0; i < 32; i++) {
        const x = 30 + rand() * (size - 60);
        const y = 30 + rand() * (size - 60);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rand() * Math.PI);
        ctx.fillStyle = '#1e2c1b';
        ctx.fillRect(-11, -3.5, 22, 7);
        ctx.restore();
      }
    }

    tex.needsUpdate = true;
  }

  render({ cook: 0, sear: 0 });
  return { texture: tex, render };
}

// Appetizing photorealistic golden seared outer skin of the rolled tamagoyaki
export function createTamagoyakiOuterTexture(config = {}) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(8881);

  const sear = Math.max(0.15, Math.min(1.0, config.sear ?? 0.55));
  const dashiBoost = config.hasDashi ? 0.14 : 0;

  // Base rich golden custard yellow
  ctx.fillStyle = '#f6c945';
  ctx.fillRect(0, 0, size, size);

  // Subtle marbled egg-white streaks if gently whisked
  if (config.marbled) {
    ctx.strokeStyle = 'rgba(255, 250, 232, 0.52)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = 10 + rand() * 14;
      ctx.beginPath();
      const x = rand() * size;
      const y = rand() * size;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 60, y + 30, x - 40, y + 90, x + 90, y + 110);
      ctx.stroke();
    }
  }

  // Soft uneven appetizing golden-brown Maillard yakiiro sear clouds!
  const spots = 28 + Math.floor((sear + dashiBoost) * 28);
  for (let i = 0; i < spots; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 28 + rand() * 76;
    const ry = 20 + rand() * 54;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, rx);
    const intensity = (0.18 + sear * 0.42 + dashiBoost * 0.25) * (0.65 + rand() * 0.5);
    g.addColorStop(0, `rgba(154, 78, 16, ${Math.min(0.75, intensity)})`);
    g.addColorStop(0.55, `rgba(196, 118, 28, ${Math.min(0.5, intensity * 0.65)})`);
    g.addColorStop(1, 'rgba(220, 155, 42, 0)');
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Tiny fluffy dimples & seared micro-bubbles on skin
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.2 + rand() * 3.8;
    ctx.fillStyle = rand() > 0.4 ? 'rgba(176,104,24,0.22)' : 'rgba(255,244,186,0.34)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Negi peeking just under the golden translucent egg skin
  if (config.hasNegi) {
    for (let i = 0; i < 42; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI);
      ctx.fillStyle = 'rgba(72, 138, 52, 0.72)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7 + rand() * 4, 3.5 + rand() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Iconic layered spiral cross-section texture for cut ends of Tamagoyaki!
export function createTamagoyakiCrossSectionTexture(config = {}) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = mulberry32(9912);
  const cx = size * 0.5;
  const cy = size * 0.5;

  const sear = Math.max(0.2, Math.min(1.0, config.sear ?? 0.55));
  const layers = Math.max(1, config.layers ?? 3);

  // Soft bright juicy custard interior
  const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.55);
  bg.addColorStop(0, '#ffe16b');
  bg.addColorStop(0.75, '#f9cc42');
  bg.addColorStop(1, '#dc9d28');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Fluffy porous steamed-egg micro-texture
  for (let i = 0; i < 240; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.5 + rand() * 4.5;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,248,205,0.42)' : 'rgba(210,145,32,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Authentic folded spiral layer lines (toasted golden-brown inside spiral!)
  const turns = 1.6 + layers * 0.85;
  ctx.save();
  ctx.translate(cx, cy);

  // Soft outer golden crust frame
  ctx.strokeStyle = `rgba(176, 98, 22, ${0.45 + sear * 0.4})`;
  ctx.lineWidth = 22;
  ctx.strokeRect(-size * 0.46, -size * 0.46, size * 0.92, size * 0.92);

  // Main golden-brown rolled spiral crease
  ctx.beginPath();
  const maxR = size * 0.43;
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * Math.PI * 2 * turns;
    // Squarish-oval spiral matching rectangular tamagoyaki cross-section!
    const rad = 14 + t * maxR;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const sqBoost = 1 + 0.14 * Math.pow(Math.sin(2 * ang), 2);
    const x = cosA * rad * 1.05 * sqBoost;
    const y = sinA * rad * 0.88 * sqBoost;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `rgba(184, 106, 26, ${0.42 + sear * 0.36})`;
  ctx.lineWidth = 9.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // If nori was added: dramatic appetizing dark-green roasted nori spiral right inside!
  if (config.hasNori) {
    ctx.beginPath();
    for (let i = 8; i <= steps - 14; i++) {
      const t = i / steps;
      const ang = t * Math.PI * 2 * turns;
      const rad = 14 + t * maxR;
      const sqBoost = 1 + 0.14 * Math.pow(Math.sin(2 * ang), 2);
      const x = Math.cos(ang) * rad * 1.05 * sqBoost;
      const y = Math.sin(ang) * rad * 0.88 * sqBoost;
      if (i === 8) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#1b2c19';
    ctx.lineWidth = 10.5;
    ctx.stroke();
  }

  // If marbled: soft creamy white swirl accompanying the spiral
  if (config.marbled) {
    ctx.beginPath();
    for (let i = 10; i <= steps - 8; i++) {
      const t = i / steps;
      const ang = t * Math.PI * 2 * turns + 0.7;
      const rad = 18 + t * (maxR * 0.92);
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad * 0.86;
      if (i === 10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 252, 238, 0.78)';
    ctx.lineWidth = 13;
    ctx.stroke();
  }

  // Chopped green negi cross-section specks embedded throughout the layers!
  if (config.hasNegi) {
    for (let i = 0; i < 34; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 22 + Math.sqrt(rand()) * (size * 0.38);
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad * 0.88;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI);
      ctx.fillStyle = rand() > 0.35 ? '#3f842c' : '#6db344';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 + rand() * 5, 5 + rand() * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(225,245,190,0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
