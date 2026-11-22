import * as THREE from 'three';

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

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Overcast North-Window Kitchen PMREM Environment
 * Soft, cool-neutral diffused sky light coming from a wide window on the left (-X, +Y),
 * muted plaster ceiling, warm natural oak bounce from below, and subtle dark cabinetry on the right
 * for authentic photographic contrast in metallic, water, ceramic, and wet rice reflections.
 */
export function createNorthWindowEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xc5cdd6);

  // Outer soft overcast room enclosure (darker neutral contrast so chrome & glass reflect richly)
  const roomGeo = new THREE.BoxGeometry(24, 14, 24);
  const roomMat = new THREE.MeshBasicMaterial({
    color: 0x5c646d,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Warm oak floor/counter bounce plane (bottom)
  const bounceFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: 0x7b654d, side: THREE.DoubleSide })
  );
  bounceFloor.rotation.x = -Math.PI / 2;
  bounceFloor.position.y = -4.2;
  envScene.add(bounceFloor);

  // Soft matte plaster ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: 0xb6c0ca, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 6.8;
  envScene.add(ceiling);

  // Cool-white overcast horizon softbox strip on front-left so chrome faucet & wet steel gleam silver!
  const horizonGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 3.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.85, 1.92, 2.02) })
  );
  horizonGlow.position.set(-2.5, 2.2, 11.2);
  horizonGlow.rotation.y = Math.PI;
  envScene.add(horizonGlow);

  // Large North-Facing Overcast Window (Left wall, slightly behind)
  // Soft cool-white diffused sky radiance with subtle vertical window frame muntins
  const winCanvas = makeCanvas(512, 512);
  const wctx = winCanvas.getContext('2d');
  const grad = wctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#eef5ff');
  grad.addColorStop(0.45, '#e2ebf5');
  grad.addColorStop(0.85, '#cfdbe8');
  grad.addColorStop(1.0, '#b5c1ce');
  wctx.fillStyle = grad;
  wctx.fillRect(0, 0, 512, 512);

  // Soft overcast cloud mottling inside window
  const rand = mulberry32(4219);
  for (let i = 0; i < 24; i++) {
    const x = rand() * 512;
    const y = rand() * 440;
    const r = 60 + rand() * 140;
    const g = wctx.createRadialGradient(x, y, 4, x, y, r);
    const bright = rand() > 0.45 ? 'rgba(255,255,255,0.18)' : 'rgba(175,192,210,0.14)';
    g.addColorStop(0, bright);
    g.addColorStop(1, 'rgba(220,230,240,0)');
    wctx.fillStyle = g;
    wctx.fillRect(0, 0, 512, 512);
  }

  // Subtle architectural window mullion bars (gives real photographic reflection lines in water & chrome)
  wctx.fillStyle = 'rgba(72, 80, 90, 0.72)';
  wctx.fillRect(0, 0, 512, 22);
  wctx.fillRect(0, 490, 512, 22);
  wctx.fillRect(0, 0, 22, 512);
  wctx.fillRect(490, 0, 22, 512);
  wctx.fillRect(248, 0, 16, 512);
  wctx.fillRect(0, 310, 512, 12);

  const winTex = new THREE.CanvasTexture(winCanvas);
  winTex.colorSpace = THREE.SRGBColorSpace;

  const mainWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 8.2),
    new THREE.MeshBasicMaterial({
      map: winTex,
      color: new THREE.Color(2.4, 2.48, 2.6), // HDR-like bright overcast sky panel
    })
  );
  mainWindow.position.set(-10.5, 2.3, -1.2);
  mainWindow.rotation.y = Math.PI / 2 - 0.15;
  envScene.add(mainWindow);

  // Secondary soft high skylight bounce strip (overcast cloud reflection from upper-front-left)
  const skyStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 4.5),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.45, 1.52, 1.62),
    })
  );
  skyStrip.position.set(-4.5, 6.2, 4.5);
  skyStrip.rotation.x = Math.PI / 2.6;
  skyStrip.rotation.z = -0.2;
  envScene.add(skyStrip);

  // Subtle warm kitchen interior bounce on the right (real rooms have darker/warmer contrast opposite the window)
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 10),
    new THREE.MeshBasicMaterial({ color: 0x5c5852 })
  );
  rightWall.position.set(11.2, 1.5, 0);
  rightWall.rotation.y = -Math.PI / 2;
  envScene.add(rightWall);

  // Dark walnut cabinet strip on far right for crisp metallic contrast
  const cabinet = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 5),
    new THREE.MeshBasicMaterial({ color: 0x2f2b27 })
  );
  cabinet.position.set(10.8, 0.5, -3.5);
  cabinet.rotation.y = -Math.PI / 2;
  envScene.add(cabinet);

  // Soft warm ambient reflection card behind viewer (subtle room bounce)
  const backSoft = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 7),
    new THREE.MeshBasicMaterial({ color: 0x8d8882 })
  );
  backSoft.position.set(0.5, 2.0, 11.4);
  backSoft.rotation.y = Math.PI;
  envScene.add(backSoft);

  const envRT = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  winTex.dispose();
  return envRT.texture;
}

/**
 * Natural Hinoki / Pale White Oak Countertop PBR Texture Set (512x512)
 */
export function createWoodCounterTextures(seed = 101, tone = 'oak') {
  const size = 512;
  const rand = mulberry32(seed);

  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);

  const cctx = colorCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rctx = roughCanvas.getContext('2d');

  // Base wood tone (rich photographic Japanese white oak / hinoki or darker walnut tray)
  const base = tone === 'tray'
    ? { r: 92, g: 66, b: 46 }
    : tone === 'shamoji'
      ? { r: 196, g: 162, b: 118 }
      : { r: 176, g: 150, b: 118 };

  cctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  cctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = tone === 'tray' ? '#9c9c9c' : '#b2b2b2';
  rctx.fillRect(0, 0, size, size);

  // Subtle plank join lines for countertop
  if (tone === 'oak') {
    const planks = 4;
    const ph = size / planks;
    for (let p = 0; p < planks; p++) {
      const shift = (rand() - 0.5) * 14;
      cctx.fillStyle = `rgba(${shift > 0 ? 255 : 70}, ${shift > 0 ? 242 : 52}, ${shift > 0 ? 225 : 35}, ${Math.abs(shift) / 140})`;
      cctx.fillRect(0, p * ph, size, ph);
      // Fine seam
      cctx.fillStyle = 'rgba(80, 62, 44, 0.28)';
      cctx.fillRect(0, p * ph, size, 1.5);
      bctx.fillStyle = '#505050';
      bctx.fillRect(0, p * ph, size, 1.5);
    }
  }

  // Organic wood fibers & cathedral grain
  for (let i = 0; i < 420; i++) {
    const y0 = rand() * size;
    const amp = 2 + rand() * 8;
    const freq = (1 + Math.floor(rand() * 3)) * ((Math.PI * 2) / size);
    const phase = rand() * Math.PI * 2;
    const dark = rand() > 0.35;
    const alpha = 0.04 + rand() * 0.11;
    const lw = 0.7 + rand() * 2.2;

    cctx.beginPath();
    bctx.beginPath();
    rctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) {
        cctx.moveTo(x, y);
        bctx.moveTo(x, y);
        rctx.moveTo(x, y);
      } else {
        cctx.lineTo(x, y);
        bctx.lineTo(x, y);
        rctx.lineTo(x, y);
      }
    }
    cctx.strokeStyle = dark
      ? `rgba(${Math.max(20, base.r - 58)}, ${Math.max(15, base.g - 52)}, ${Math.max(10, base.b - 44)}, ${alpha})`
      : `rgba(${Math.min(255, base.r + 26)}, ${Math.min(255, base.g + 22)}, ${Math.min(255, base.b + 18)}, ${alpha * 0.8})`;
    cctx.lineWidth = lw;
    cctx.stroke();

    bctx.strokeStyle = dark ? `rgba(92,92,92,${alpha * 1.4})` : `rgba(155,155,155,${alpha})`;
    bctx.lineWidth = lw * 0.8;
    bctx.stroke();

    rctx.strokeStyle = dark ? `rgba(195,195,195,${alpha * 1.3})` : `rgba(145,145,145,${alpha})`;
    rctx.lineWidth = lw;
    rctx.stroke();
  }

  // Fine pore speckles
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 2 + rand() * 10;
    cctx.fillStyle = `rgba(60, 42, 26, ${0.03 + rand() * 0.06})`;
    cctx.fillRect(x, y, w, 1);
    bctx.fillStyle = `rgba(65, 65, 65, ${0.08 + rand() * 0.08})`;
    bctx.fillRect(x, y, w, 1);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap, roughnessMap };
}

/**
 * White Japanese Glazed Kitchen Tile Backsplash (512x512)
 */
export function createKitchenTileTextures() {
  const size = 512;
  const rand = mulberry32(303);
  const cCanvas = makeCanvas(size, size);
  const bCanvas = makeCanvas(size, size);
  const rCanvas = makeCanvas(size, size);

  const cctx = cCanvas.getContext('2d');
  const bctx = bCanvas.getContext('2d');
  const rctx = rCanvas.getContext('2d');

  // Soft warm-gray grout background
  cctx.fillStyle = '#c5c7c9';
  cctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#383838';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#e5e5e5';
  rctx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const tw = size / cols;
  const th = size / rows;
  const gap = 4;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset + gap * 0.5;
      const y = r * th + gap * 0.5;
      const w = tw - gap;
      const h = th - gap;

      const v = 232 + Math.floor((rand() - 0.5) * 10);
      const warm = Math.floor((rand() - 0.5) * 4);
      const grad = cctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, `rgb(${v + warm}, ${v + 1}, ${v - 2})`);
      grad.addColorStop(1, `rgb(${v - 4 + warm}, ${v - 3}, ${v - 5})`);
      cctx.fillStyle = grad;
      cctx.fillRect(x, y, w, h);

      // Subtle ceramic bevel in bump map
      bctx.fillStyle = '#d4d4d4';
      bctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      bctx.strokeStyle = '#9a9a9a';
      bctx.lineWidth = 2;
      bctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Subtle hand-glazed surface waviness
      const rv = 48 + Math.floor(rand() * 24);
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.fillRect(x, y, w, h);
    }
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.2, 2.0);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.2, 2.0);

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.2, 2.0);

  return { map, bumpMap, roughnessMap };
}

/**
 * Brushed Stainless Steel Texture (512x512)
 */
export function createBrushedMetalTextures(seed = 505) {
  const size = 512;
  const rand = mulberry32(seed);
  const bCanvas = makeCanvas(size, size);
  const rCanvas = makeCanvas(size, size);
  const bctx = bCanvas.getContext('2d');
  const rctx = rCanvas.getContext('2d');

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#565656';
  rctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2400; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 30 + rand() * 220;
    const v = Math.floor(90 + rand() * 75);
    bctx.fillStyle = `rgba(${v},${v},${v},0.16)`;
    bctx.fillRect(x, y, len, 1);

    const rv = Math.floor(60 + rand() * 75);
    rctx.fillStyle = `rgba(${rv},${rv},${rv},0.2)`;
    rctx.fillRect(x, y, len, 1);
  }

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  return { bumpMap, roughnessMap };
}

/**
 * Dark Fluoropolymer Non-stick Inner Pot Interior (512x512)
 * Includes subtle diamond-speckle fluoropolymer coating and clean horizontal
 * water-level guide marks (ZERO text/digits!).
 */
export function createInnerPotTextures() {
  const size = 512;
  const rand = mulberry32(707);
  const cCanvas = makeCanvas(size, size);
  const bCanvas = makeCanvas(size, size);
  const rCanvas = makeCanvas(size, size);

  const cctx = cCanvas.getContext('2d');
  const bctx = bCanvas.getContext('2d');
  const rctx = rCanvas.getContext('2d');

  // Deep charcoal-graphite base
  const grad = cctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#2a2d31');
  grad.addColorStop(0.55, '#1f2226');
  grad.addColorStop(1.0, '#181a1d');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#727272';
  rctx.fillRect(0, 0, size, size);

  // Subtle concentric machined turning lines
  for (let y = 0; y < size; y += 2) {
    const a = 0.04 + rand() * 0.05;
    cctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a * 0.4})` : `rgba(0,0,0,${a})`;
    cctx.fillRect(0, y, size, 1);
    bctx.fillStyle = rand() > 0.5 ? `rgba(155,155,155,0.22)` : `rgba(105,105,105,0.22)`;
    bctx.fillRect(0, y, size, 1);
  }

  // Fine mineral/diamond fluoropolymer micro-speckles
  for (let i = 0; i < 4000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const b = 120 + Math.floor(rand() * 120);
    cctx.fillStyle = `rgba(${b},${b + 4},${b + 8},${0.06 + rand() * 0.14})`;
    cctx.fillRect(x, y, 1.3, 1.3);
    rctx.fillStyle = `rgba(${70 + Math.floor(rand() * 80)},${70 + Math.floor(rand() * 80)},${70 + Math.floor(rand() * 80)},0.25)`;
    rctx.fillRect(x, y, 1.5, 1.5);
  }

  // Purely geometric water-level tick lines on one inner face (ZERO numbers, ZERO letters!)
  const markX = size * 0.44;
  const levels = [0.42, 0.53, 0.64];
  levels.forEach((lv, idx) => {
    const y = size * lv;
    const w = idx === 1 ? 66 : 44;
    cctx.fillStyle = idx === 1 ? 'rgba(225, 232, 238, 0.72)' : 'rgba(200, 208, 216, 0.42)';
    cctx.fillRect(markX, y, w, idx === 1 ? 3 : 2);
    // Small dot beside the main water line
    if (idx === 1) {
      cctx.beginPath();
      cctx.arc(markX - 10, y + 1.5, 3, 0, Math.PI * 2);
      cctx.fill();
    }
  });

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap, roughnessMap };
}

/**
 * Artisanal Japanese Ceramic Rice Bowl (Chawan) Glaze Texture (512x512)
 * Warm speckled oatmeal-stoneware body with indigo-slate kiln-fired rim drip.
 */
export function createCeramicBowlTextures() {
  const size = 512;
  const rand = mulberry32(909);
  const cCanvas = makeCanvas(size, size);
  const bCanvas = makeCanvas(size, size);
  const rCanvas = makeCanvas(size, size);

  const cctx = cCanvas.getContext('2d');
  const bctx = bCanvas.getContext('2d');
  const rctx = rCanvas.getContext('2d');

  // Vertical gradient along V (0 = foot ring clay, 0.16..0.88 = warm oatmeal glaze, 0.90..1.0 = kiln indigo rim)
  const grad = cctx.createLinearGradient(0, size, 0, 0);
  grad.addColorStop(0.0, '#b59d84'); // unglazed stoneware clay foot
  grad.addColorStop(0.14, '#c3ac93');
  grad.addColorStop(0.18, '#e3ddd2'); // warm creamy stoneware glaze
  grad.addColorStop(0.74, '#ece7dd');
  grad.addColorStop(0.87, '#dfd9ce');
  grad.addColorStop(0.92, '#47556b'); // subtle hand-dipped indigo-slate rim
  grad.addColorStop(0.97, '#344156');
  grad.addColorStop(1.0, '#624b3a');  // iron-oxide kiln rim edge
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, size, size);

  // Subtle organic rim glaze drip wave
  cctx.beginPath();
  cctx.moveTo(0, 0);
  for (let x = 0; x <= size; x += 4) {
    const drip = 46 + Math.sin(x * 0.036) * 7 + Math.sin(x * 0.095 + 1.2) * 4;
    cctx.lineTo(x, drip);
  }
  cctx.lineTo(size, 0);
  cctx.closePath();
  const rimGrad = cctx.createLinearGradient(0, 0, 0, 58);
  rimGrad.addColorStop(0, 'rgba(56, 68, 88, 0.85)');
  rimGrad.addColorStop(0.75, 'rgba(72, 86, 108, 0.55)');
  rimGrad.addColorStop(1, 'rgba(72, 86, 108, 0)');
  cctx.fillStyle = rimGrad;
  cctx.fill();

  // Potter's wheel subtle horizontal throwing rings
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 3) {
    const wave = Math.sin(y * 0.22) * 16 + (rand() - 0.5) * 10;
    const v = Math.max(40, Math.min(215, 128 + wave));
    bctx.fillStyle = `rgb(${v},${v},${v})`;
    bctx.fillRect(0, y, size, 2.5);
  }

  // Roughness: unglazed foot is matte, glazed body is satin-glossy
  const rGrad = rctx.createLinearGradient(0, size, 0, 0);
  rGrad.addColorStop(0.0, '#d8d8d8');
  rGrad.addColorStop(0.15, '#c8c8c8');
  rGrad.addColorStop(0.19, '#444444');
  rGrad.addColorStop(0.92, '#3a3a3a');
  rGrad.addColorStop(1.0, '#5a5a5a');
  rctx.fillStyle = rGrad;
  rctx.fillRect(0, 0, size, size);

  // Authentic stoneware iron-oxide micro speckles (鉄粉)
  for (let i = 0; i < 2200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 0.5 + rand() * 1.6;
    const a = 0.08 + rand() * 0.28;
    cctx.fillStyle = `rgba(68, 52, 40, ${a})`;
    cctx.beginPath();
    cctx.arc(x, y, rad, 0, Math.PI * 2);
    cctx.fill();
  }

  // Soft hand-painted indigo botanical brush stroke band around mid-outer belly
  for (let i = 0; i < 6; i++) {
    const cx = (i + 0.5) * (size / 6);
    const cy = size * 0.42;
    cctx.strokeStyle = 'rgba(58, 76, 102, 0.24)';
    cctx.lineWidth = 4;
    cctx.beginPath();
    cctx.arc(cx, cy, 18, 0.2, Math.PI * 0.85);
    cctx.stroke();
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap, roughnessMap };
}

/**
 * Woven Flax Linen Place Mat Texture (512x512)
 */
export function createLinenTextures() {
  const size = 512;
  const rand = mulberry32(1212);
  const cCanvas = makeCanvas(size, size);
  const bCanvas = makeCanvas(size, size);

  const cctx = cCanvas.getContext('2d');
  const bctx = bCanvas.getContext('2d');

  cctx.fillStyle = '#ddd6ca';
  cctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#787878';
  bctx.fillRect(0, 0, size, size);

  const step = 4;
  for (let y = 0; y < size; y += step) {
    const tone = (rand() - 0.5) * 14;
    cctx.fillStyle = `rgba(${210 + tone}, ${202 + tone}, ${190 + tone}, 0.55)`;
    cctx.fillRect(0, y, size, 2);
    bctx.fillStyle = 'rgba(160,160,160,0.45)';
    bctx.fillRect(0, y, size, 2);
  }
  for (let x = 0; x < size; x += step) {
    const tone = (rand() - 0.5) * 14;
    cctx.fillStyle = `rgba(${200 + tone}, ${192 + tone}, ${180 + tone}, 0.45)`;
    cctx.fillRect(x, 0, 2, size);
    bctx.fillStyle = 'rgba(135,135,135,0.45)';
    bctx.fillRect(x, 0, 2, size);
  }

  // Subtle woven dark indigo edge stripe
  cctx.fillStyle = 'rgba(65, 76, 92, 0.35)';
  cctx.fillRect(0, 24, size, 6);
  cctx.fillRect(0, size - 30, size, 6);

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

/**
 * Soft Volumetric-Style Steam Cloud Puff Sprite (256x256)
 */
export function createSteamTexture() {
  const size = 256;
  const rand = mulberry32(4404);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  // Layer soft wispy cloud lobes for organic steam
  for (let i = 0; i < 16; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = rand() * 44;
    const cx = size * 0.5 + Math.cos(angle) * dist;
    const cy = size * 0.5 + Math.sin(angle) * dist;
    const r = 42 + rand() * 58;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    const a = 0.08 + rand() * 0.09;
    g.addColorStop(0.0, `rgba(248, 251, 255, ${a})`);
    g.addColorStop(0.5, `rgba(242, 247, 253, ${a * 0.55})`);
    g.addColorStop(1.0, 'rgba(240, 246, 252, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // Master radial feather so edges are completely seamless
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(size / 2, size / 2, 16, size / 2, size / 2, size * 0.48);
  mask.addColorStop(0.0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.6, 'rgba(255,255,255,0.65)');
  mask.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Real-time Dynamic Starch Turbidity Swirl Map (256x256)
 * Used by the water shader so swirling the hand visibly blooms milky white
 * rice-starch clouds ("とぎ汁") trailing behind the fingers and diffusing smoothly.
 */
export class StarchFluidMap {
  constructor() {
    this.size = 256;
    this.canvas = makeCanvas(this.size, this.size);
    this.ctx = this.canvas.getContext('2d');
    this.tempCanvas = makeCanvas(this.size, this.size);
    this.tctx = this.tempCanvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.clear();
  }

  clear() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.texture.needsUpdate = true;
  }

  /**
   * Stamp a soft cloud of milky starch at normalized pot coordinates (-1..1, -1..1)
   */
  addStarchPlume(nx, nz, intensity, radius = 0.24) {
    const s = this.size;
    const cx = (nx * 0.5 + 0.5) * s;
    const cy = (nz * 0.5 + 0.5) * s;
    const r = radius * s;

    const g = this.ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    const a = Math.min(0.42, Math.max(0.02, intensity));
    g.addColorStop(0.0, `rgba(255, 255, 255, ${a})`);
    g.addColorStop(0.48, `rgba(235, 235, 235, ${a * 0.55})`);
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Dilute slightly (e.g., when fresh water pours from faucet)
   */
  dilute(amount = 0.08) {
    this.ctx.fillStyle = `rgba(0, 0, 0, ${amount})`;
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.texture.needsUpdate = true;
  }

  /**
   * Gently rotate/swirl and diffuse the milky starch fluid each frame
   */
  advect(swirlRad, baseTurbidity) {
    const s = this.size;
    const half = s * 0.5;
    this.tctx.clearRect(0, 0, s, s);
    this.tctx.drawImage(this.canvas, 0, 0);

    this.ctx.save();
    this.ctx.fillStyle = `rgb(${Math.floor(baseTurbidity * 215)},${Math.floor(baseTurbidity * 215)},${Math.floor(baseTurbidity * 215)})`;
    this.ctx.fillRect(0, 0, s, s);
    this.ctx.translate(half, half);
    this.ctx.rotate(swirlRad);
    this.ctx.scale(1.004, 1.004);
    this.ctx.globalAlpha = 0.965;
    this.ctx.drawImage(this.tempCanvas, -half, -half);
    this.ctx.restore();

    this.texture.needsUpdate = true;
  }
}

/**
 * Realistic Soft Skin Micro-Detail Texture (256x256)
 */
export function createSkinTexture() {
  const size = 256;
  const rand = mulberry32(818);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Natural warm Japanese skin base under cool overcast north light (avoids bleached mannequin look)
  ctx.fillStyle = '#d6a485';
  ctx.fillRect(0, 0, size, size);

  // Subtle organic warm blush, knuckle crease & tonal mottling
  for (let i = 0; i < 85; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 40;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const pinkish = rand() > 0.42;
    g.addColorStop(0, pinkish ? 'rgba(196, 122, 104, 0.11)' : 'rgba(232, 190, 158, 0.09)');
    g.addColorStop(1, 'rgba(214, 164, 133, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // Micro skin pores
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = `rgba(176, 128, 108, ${0.03 + rand() * 0.05})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Contact Shadow Soft Radial Blob Texture (128x128)
 */
export function createContactShadowTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  g.addColorStop(0.0, 'rgba(18, 22, 28, 0.52)');
  g.addColorStop(0.58, 'rgba(22, 26, 32, 0.24)');
  g.addColorStop(1.0, 'rgba(22, 26, 32, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Dense Micro-Rice Grain Bed PBR Texture (512x512)
 * Used on the underlying rice volume cushions (pot bed, bowl core, scoop core, masu cup)
 * so thousands of subtle shaded rice grains fill every micro-gap behind the sculpted 3D hero grains!
 */
export function createRiceBedTextures(seed = 1919) {
  const size = 512;
  const rand = mulberry32(seed);
  const cCanvas = makeCanvas(size, size);
  const bCanvas = makeCanvas(size, size);
  const cctx = cCanvas.getContext('2d');
  const bctx = bCanvas.getContext('2d');

  // Soft warm-gray crevice base between rice grains
  cctx.fillStyle = '#aba69c';
  cctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#383838';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 6.5 + rand() * 4.5;
    const ry = 3.2 + rand() * 2.2;
    const rot = rand() * Math.PI * 2;
    const tone = 212 + Math.floor(rand() * 36);

    // Draw wrapped across edges for seamless tiling
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        const px = x + ox;
        const py = y + oy;
        if (px < -16 || px > size + 16 || py < -16 || py > size + 16) continue;

        cctx.save();
        cctx.translate(px, py);
        cctx.rotate(rot);
        const grad = cctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 0.6, 0, 0, rx);
        grad.addColorStop(0, `rgb(${Math.min(252, tone + 12)}, ${Math.min(249, tone + 9)}, ${Math.min(242, tone + 2)})`);
        grad.addColorStop(0.75, `rgb(${tone - 14}, ${tone - 16}, ${tone - 22})`);
        grad.addColorStop(1, `rgb(${tone - 56}, ${tone - 58}, ${tone - 62})`);
        cctx.fillStyle = grad;
        cctx.beginPath();
        cctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        cctx.fill();
        cctx.restore();

        bctx.save();
        bctx.translate(px, py);
        bctx.rotate(rot);
        const bgrad = bctx.createRadialGradient(0, 0, 0.5, 0, 0, rx);
        bgrad.addColorStop(0, '#efefef');
        bgrad.addColorStop(0.7, '#9c9c9c');
        bgrad.addColorStop(1, '#323232');
        bctx.fillStyle = bgrad;
        bctx.beginPath();
        bctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        bctx.fill();
        bctx.restore();
      }
    }
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 2.2);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.2, 2.2);

  return { map, bumpMap };
}

/**
 * Granular Black Sesame + Sea Salt Texture ("ごま塩", 256x256)
 */
export function createSesameBedTexture() {
  const size = 256;
  const rand = mulberry32(2323);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141518';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 950; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const isSalt = rand() < 0.14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    if (isSalt) {
      ctx.fillStyle = `rgba(240,242,246,${0.65 + rand() * 0.3})`;
      ctx.fillRect(-2, -2, 4, 4);
    } else {
      const v = 22 + Math.floor(rand() * 34);
      ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Soft radial alpha mask for organic wet milky sink pool & subtle ripples
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

export function createSoftSplashPoolTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, size * 0.06, cx, cx, size * 0.48);
  g.addColorStop(0.0, 'rgba(248, 251, 253, 0.92)');
  g.addColorStop(0.52, 'rgba(240, 245, 249, 0.72)');
  g.addColorStop(0.82, 'rgba(232, 238, 244, 0.30)');
  g.addColorStop(1.0, 'rgba(232, 238, 244, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Delicate concentric splash ripple rings
  for (let r = 34; r < 108; r += 24) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Fine organic pickled-plum wrinkle bump map for realistic Kishu Umeboshi ("梅干し")
 */
export function createUmeboshiBumpTexture() {
  const size = 256;
  const rand = mulberry32(4848);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 18 + rand() * 44;
    const a = rand() * Math.PI * 2;
    ctx.strokeStyle = rand() > 0.45 ? 'rgba(42,42,42,0.45)' : 'rgba(215,215,215,0.42)';
    ctx.lineWidth = 2 + rand() * 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.5, y + Math.sin(a + 0.5) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
