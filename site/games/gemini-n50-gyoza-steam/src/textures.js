import * as THREE from '../vendor/three.module.js';

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

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function createSRGBTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (repeatX > 1 || repeatY > 1) tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createLinearTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (repeatX > 1 || repeatY > 1) tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// =========================================================================
// 1. Photorealistic Japanese Kitchen PMREM Environment Map
// =========================================================================
export function createKitchenEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x161412);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(22, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x221e1a, side: THREE.BackSide })
  );
  envScene.add(dome);

  // Warm tungsten range-hood overhead light box (crisp photographic highlights on glass & oil!)
  const hoodLight = new THREE.Mesh(
    new THREE.PlaneGeometry(10.5, 4.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.4, 4.2, 2.9), side: THREE.DoubleSide })
  );
  hoodLight.position.set(0.6, 9.2, -1.2);
  hoodLight.rotation.x = Math.PI / 2;
  envScene.add(hoodLight);

  // Warm dining pendant reflection off to the right
  const pendant = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 3.0, 2.0), side: THREE.DoubleSide })
  );
  pendant.position.set(6.8, 7.6, 4.8);
  pendant.lookAt(0, 0, 0);
  envScene.add(pendant);

  // Cool soft northern daylight kitchen window on the left with dark mullions
  const windowLight = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 8.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 3.3, 4.0), side: THREE.DoubleSide })
  );
  windowLight.position.set(-12.0, 4.2, 3.2);
  windowLight.lookAt(0, 0.5, 0);
  envScene.add(windowLight);

  const mullionMat = new THREE.MeshBasicMaterial({ color: 0x151517 });
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.2, 0.2), mullionMat);
  vBar.position.set(-11.7, 4.2, 3.2);
  vBar.lookAt(0, 0.5, 0);
  envScene.add(vBar);
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 0.2), mullionMat);
  hBar.position.set(-11.7, 4.2, 3.2);
  hBar.lookAt(0, 0.5, 0);
  envScene.add(hBar);

  // Warm counter bounce below
  const counterBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: 0x2e2319, side: THREE.DoubleSide })
  );
  counterBounce.position.set(0, -6.5, 0);
  counterBounce.rotation.x = -Math.PI / 2;
  envScene.add(counterBounce);

  // Warm rim highlight strip on back-right for glistening glass & oil edges
  const rimStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 7.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.9, 2.2, 1.45), side: THREE.DoubleSide })
  );
  rimStrip.position.set(10.5, 3.5, -4.5);
  rimStrip.lookAt(0, 0, 0);
  envScene.add(rimStrip);

  const envRT = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  return envRT.texture;
}

// =========================================================================
// 2. Warm Aged Hinoki / Walnut Cutting Board Texture (512x512)
// =========================================================================
export function createWoodBoardTextures() {
  const size = 512;
  const rng = mulberry32(101);
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  // Richer natural warm cypress/oak tone so creamy white gyoza wrapper pops clearly!
  cCtx.fillStyle = '#9d744a';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#b4b4b4';
  rCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const wave = Math.sin(y * 0.042) * 10 + Math.sin(y * 0.13) * 3.5;
    const tone = Math.sin((y + wave) * 0.24) * 0.5 + 0.5;
    const fine = Math.sin(y * 1.1 + wave * 0.3) * 0.5 + 0.5;
    const r = Math.round(132 + tone * 34 + fine * 10 + (rng() - 0.5) * 6);
    const g = Math.round(96 + tone * 28 + fine * 8 + (rng() - 0.5) * 5);
    const b = Math.round(62 + tone * 20 + fine * 5 + (rng() - 0.5) * 4);
    cCtx.fillStyle = `rgb(${r},${g},${b})`;
    cCtx.fillRect(0, y, size, 1.5);

    const bv = Math.round(108 + tone * 30 + fine * 12);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(0, y, size, 1.5);
  }

  // Butcher-block plank join seams
  for (let i = 1; i < 4; i++) {
    const py = Math.round((size / 4) * i);
    cCtx.fillStyle = 'rgba(54, 34, 18, 0.34)';
    cCtx.fillRect(0, py, size, 2);
    bCtx.fillStyle = 'rgba(45, 45, 45, 0.65)';
    bCtx.fillRect(0, py, size, 2);
  }

  // Fine authentic knife-score patina
  for (let i = 0; i < 110; i++) {
    const x1 = size * 0.12 + rng() * size * 0.76;
    const y1 = size * 0.12 + rng() * size * 0.76;
    const len = 18 + rng() * 58;
    const ang = (rng() - 0.5) * 0.32;
    cCtx.strokeStyle = `rgba(62, 40, 22, ${0.09 + rng() * 0.1})`;
    cCtx.lineWidth = 0.8;
    cCtx.beginPath();
    cCtx.moveTo(x1, y1);
    cCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    cCtx.stroke();
  }

  // Delicate dusty katakuriko flour smudge around working center (soft & powdery, NOT polka dots!)
  const flourGrad = cCtx.createRadialGradient(size * 0.54, size * 0.5, 16, size * 0.54, size * 0.5, size * 0.36);
  flourGrad.addColorStop(0, 'rgba(246, 240, 228, 0.34)');
  flourGrad.addColorStop(0.55, 'rgba(246, 240, 228, 0.12)');
  flourGrad.addColorStop(1, 'rgba(246, 240, 228, 0)');
  cCtx.fillStyle = flourGrad;
  cCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 650; i++) {
    const a = rng() * Math.PI * 2;
    const rad = Math.pow(rng(), 0.75) * size * 0.34;
    const fx = size * 0.54 + Math.cos(a) * rad;
    const fy = size * 0.5 + Math.sin(a) * rad;
    cCtx.fillStyle = `rgba(250, 246, 238, ${0.06 + rng() * 0.14})`;
    cCtx.beginPath();
    cCtx.arc(fx, fy, 0.5 + rng() * 1.3, 0, Math.PI * 2);
    cCtx.fill();
  }

  // Subtle edge vignette on wood board
  const vig = cCtx.createRadialGradient(size * 0.5, size * 0.5, size * 0.34, size * 0.5, size * 0.5, size * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(32,20,10,0.28)');
  cCtx.fillStyle = vig;
  cCtx.fillRect(0, 0, size, size);

  return {
    map: createSRGBTexture(col),
    bumpMap: createLinearTexture(bump),
    roughnessMap: createLinearTexture(rough),
  };
}

// =========================================================================
// 3. Translucent Wheat Gyoza Wrapper Dough Texture (512x512)
// =========================================================================
export function createDoughTextures() {
  const size = 512;
  const rng = mulberry32(202);
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  // Authentic creamy unbleached gyoza wrapper (slightly warmer center, powdery edge)
  const radGrad = cCtx.createRadialGradient(size * 0.5, size * 0.5, 16, size * 0.5, size * 0.5, size * 0.52);
  radGrad.addColorStop(0, '#e5d3b2');
  radGrad.addColorStop(0.62, '#ece0c7');
  radGrad.addColorStop(0.9, '#f3ebd8');
  radGrad.addColorStop(1, '#e6d8be');
  cCtx.fillStyle = radGrad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, size, size);

  // Rolled dough cloudy sheen & katakuriko dust patches
  for (let i = 0; i < 200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 12 + rng() * 38;
    const g = cCtx.createRadialGradient(x, y, 1, x, y, r);
    const bright = rng() > 0.4;
    g.addColorStop(0, bright ? 'rgba(255, 251, 243, 0.18)' : 'rgba(196, 174, 138, 0.14)');
    g.addColorStop(1, 'rgba(255, 251, 243, 0)');
    cCtx.fillStyle = g;
    cCtx.fillRect(x - r, y - r, r * 2, r * 2);

    const bg = bCtx.createRadialGradient(x, y, 1, x, y, r);
    bg.addColorStop(0, bright ? 'rgba(162,162,162,0.28)' : 'rgba(98,98,98,0.22)');
    bg.addColorStop(1, 'rgba(128,128,128,0)');
    bCtx.fillStyle = bg;
    bCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 0.6 + rng() * 1.4;
    cCtx.fillStyle = rng() > 0.28 ? 'rgba(255,253,248,0.26)' : 'rgba(178,154,116,0.18)';
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();

    const bv = rng() > 0.5 ? 176 : 92;
    bCtx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    bCtx.fillRect(x, y, rad * 1.5, rad * 1.5);
  }

  return {
    map: createSRGBTexture(col),
    bumpMap: createLinearTexture(bump),
    roughnessMap: createLinearTexture(rough),
  };
}

// =========================================================================
// 4. Photorealistic Minced Pork, Cabbage & Nira Filling Texture (512x512)
// =========================================================================
export function createFillingTextures() {
  const size = 512;
  const rng = mulberry32(303);
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  // Deep savory seasoned pork mince base (not cartoonish bright pink!)
  cCtx.fillStyle = '#7e4d3d';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#585858';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#545454';
  rCtx.fillRect(0, 0, size, size);

  // Finely ground pork mince grains & marbled fat (small organic scale!)
  for (let i = 0; i < 1900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 2.5 + rng() * 6.5;
    const ry = 2.0 + rng() * 5.2;
    const ang = rng() * Math.PI;
    const shade = rng();
    if (shade < 0.56) {
      // Natural seasoned ground pork
      cCtx.fillStyle = `rgb(${Math.round(138 + rng() * 34)}, ${Math.round(82 + rng() * 24)}, ${Math.round(66 + rng() * 20)})`;
    } else if (shade < 0.76) {
      // Translucent marbled pork fat
      cCtx.fillStyle = `rgb(${Math.round(205 + rng() * 26)}, ${Math.round(178 + rng() * 22)}, ${Math.round(152 + rng() * 20)})`;
    } else {
      // Finely minced pale cabbage bits
      cCtx.fillStyle = `rgb(${Math.round(172 + rng() * 32)}, ${Math.round(188 + rng() * 28)}, ${Math.round(132 + rng() * 24)})`;
    }
    cCtx.save();
    cCtx.translate(x, y);
    cCtx.rotate(ang);
    cCtx.beginPath();
    cCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();

    const bv = Math.round(70 + rng() * 170);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.beginPath();
    bCtx.arc(x, y, rx * 0.72, 0, Math.PI * 2);
    bCtx.fill();

    const rv = Math.round(26 + rng() * 68);
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.beginPath();
    rCtx.arc(x, y, rx * 0.85, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Finely chopped fresh dark emerald nira (garlic chives) & ginger specks
  for (let i = 0; i < 720; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 3.5 + rng() * 7.5;
    const h = 1.8 + rng() * 3.2;
    const ang = rng() * Math.PI;
    cCtx.save();
    cCtx.translate(x, y);
    cCtx.rotate(ang);
    cCtx.fillStyle = rng() > 0.35
      ? `rgb(${Math.round(32 + rng() * 28)}, ${Math.round(78 + rng() * 38)}, ${Math.round(28 + rng() * 20)})`
      : `rgb(${Math.round(64 + rng() * 34)}, ${Math.round(112 + rng() * 34)}, ${Math.round(44 + rng() * 22)})`;
    cCtx.fillRect(-w * 0.5, -h * 0.5, w, h);
    cCtx.restore();

    bCtx.fillStyle = 'rgba(225,225,225,0.5)';
    bCtx.fillRect(x - 2, y - 2, 4, 4);
  }

  // Subtle dark shadows between minced clumps + glossy sesame oil moisture spots
  for (let i = 0; i < 360; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1.5 + rng() * 4.5;
    cCtx.fillStyle = 'rgba(42, 22, 14, 0.24)';
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();

    rCtx.fillStyle = 'rgba(14, 14, 14, 0.8)';
    rCtx.beginPath();
    rCtx.arc(x + 2, y - 2, r * 1.1, 0, Math.PI * 2);
    rCtx.fill();
  }

  return {
    map: createSRGBTexture(col, 2, 2),
    bumpMap: createLinearTexture(bump, 2, 2),
    roughnessMap: createLinearTexture(rough, 2, 2),
  };
}

// =========================================================================
// 5. Seasoned Cast-Iron Skillet Texture (512x512)
// =========================================================================
export function createCastIronTextures() {
  const size = 512;
  const rng = mulberry32(404);
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  cCtx.fillStyle = '#18191c';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#5c5c5c';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 5200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.6 + rng() * 1.9;
    const v = Math.round(18 + rng() * 22);
    cCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    cCtx.fillRect(x, y, r, r);

    const bv = Math.round(86 + rng() * 82);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(x, y, r, r);
  }

  // Subtle seasoned circular oil sheen rings
  for (let i = 0; i < 16; i++) {
    const rad = 28 + i * 15;
    cCtx.strokeStyle = `rgba(38, 34, 30, ${0.07 + (i % 2) * 0.04})`;
    cCtx.lineWidth = 4;
    cCtx.beginPath();
    cCtx.arc(size * 0.5, size * 0.5, rad, 0, Math.PI * 2);
    cCtx.stroke();

    rCtx.strokeStyle = 'rgba(26, 26, 26, 0.34)';
    rCtx.lineWidth = 6;
    rCtx.beginPath();
    rCtx.arc(size * 0.5, size * 0.5, rad, 0, Math.PI * 2);
    rCtx.stroke();
  }

  return {
    map: createSRGBTexture(col),
    bumpMap: createLinearTexture(bump),
    roughnessMap: createLinearTexture(rough),
  };
}

// =========================================================================
// 6. HERO ASSET: Hanetsuki Crispy Lace Skirt ("Hane") PBR Textures (1024x1024)
//    Deep golden-chestnut Maillard gradient + delicate lace holes + glossy oil sheen!
// =========================================================================
export function createHaneTextures(gyozaCount = 5) {
  const size = 1024;
  const cx = size * 0.5;
  const cy = size * 0.5;
  const maxR = size * 0.475;
  const rng = mulberry32(505);

  const col = makeCanvas(size, size);
  const alpha = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const aCtx = alpha.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  aCtx.fillStyle = '#000000';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#505050';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  // Mouthwatering caramelized golden-brown Maillard gradient
  const baseGrad = cCtx.createRadialGradient(cx, cy, 24, cx, cy, maxR);
  baseGrad.addColorStop(0, '#853c11');
  baseGrad.addColorStop(0.28, '#ab5718');
  baseGrad.addColorStop(0.62, '#cb7c28');
  baseGrad.addColorStop(0.84, '#dfa44d');
  baseGrad.addColorStop(1, '#ecc781');
  cCtx.fillStyle = baseGrad;
  cCtx.fillRect(0, 0, size, size);

  // Organic crispy feathered outer skirt perimeter
  aCtx.save();
  aCtx.beginPath();
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const wobble =
      Math.sin(th * 5) * 16 +
      Math.cos(th * 13 + 1.1) * 10 +
      Math.sin(th * 27 - 0.5) * 5;
    const rr = maxR - 12 + wobble;
    const x = cx + Math.cos(th) * rr;
    const y = cy + Math.sin(th) * rr;
    if (i === 0) aCtx.moveTo(x, y);
    else aCtx.lineTo(x, y);
  }
  aCtx.closePath();
  aCtx.fillStyle = '#ffffff';
  aCtx.fill();
  aCtx.restore();

  // Deep toasted sear halos directly around each of the 5 radial gyoza bases!
  for (let i = 0; i < gyozaCount; i++) {
    const th = (i / gyozaCount) * Math.PI * 2 - Math.PI / 2;
    const gx = cx + Math.cos(th) * (size * 0.25);
    const gy = cy + Math.sin(th) * (size * 0.25);

    cCtx.save();
    cCtx.translate(gx, gy);
    cCtx.rotate(th + Math.PI / 2);
    const searGrad = cCtx.createRadialGradient(0, 0, 14, 0, 0, 162);
    searGrad.addColorStop(0, 'rgba(72, 24, 5, 0.92)');
    searGrad.addColorStop(0.42, 'rgba(122, 48, 12, 0.68)');
    searGrad.addColorStop(0.8, 'rgba(176, 94, 24, 0.28)');
    searGrad.addColorStop(1, 'rgba(176, 94, 24, 0)');
    cCtx.fillStyle = searGrad;
    cCtx.scale(1.38, 0.72);
    cCtx.beginPath();
    cCtx.arc(0, 0, 162, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();

    bCtx.save();
    bCtx.translate(gx, gy);
    bCtx.rotate(th + Math.PI / 2);
    bCtx.scale(1.38, 0.72);
    bCtx.fillStyle = 'rgba(232, 232, 232, 0.72)';
    bCtx.beginPath();
    bCtx.arc(0, 0, 122, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.restore();
  }

  // Organic roasted Maillard mottling
  for (let i = 0; i < 460; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.56) * (maxR - 18);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const r = 10 + rng() * 34;
    const g = cCtx.createRadialGradient(x, y, 2, x, y, r);
    const dark = rng() > 0.36;
    g.addColorStop(0, dark ? 'rgba(84, 34, 8, 0.38)' : 'rgba(246, 214, 142, 0.28)');
    g.addColorStop(1, 'rgba(150, 80, 25, 0)');
    cCtx.fillStyle = g;
    cCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // SIGNATURE LACY BOILING-STARCH PERFORATIONS (delicate organic crispy web clusters, realistic translucent film!)
  const holes = [];
  // Create 56 organic foaming lace clusters across the crispy skillet skirt (rich delicate lacy crunch!)
  for (let cl = 0; cl < 56; cl++) {
    const ca = rng() * Math.PI * 2;
    const cd = Math.pow(rng(), 0.56) * (maxR - 36);
    const clX = cx + Math.cos(ca) * cd;
    const clY = cy + Math.sin(ca) * cd;
    const subCount = 16 + Math.floor(rng() * 20);
    for (let s = 0; s < subCount; s++) {
      const sa = rng() * Math.PI * 2;
      const sd = Math.pow(rng(), 0.78) * 58;
      const x = clX + Math.cos(sa) * sd;
      const y = clY + Math.sin(sa) * sd;
      if (Math.hypot(x - cx, y - cy) > maxR - 12) continue;

      let nearFootprint = false;
      for (let k = 0; k < gyozaCount; k++) {
        const th = (k / gyozaCount) * Math.PI * 2 - Math.PI / 2;
        const gx = cx + Math.cos(th) * (size * 0.25);
        const gy = cy + Math.sin(th) * (size * 0.25);
        if (Math.hypot(x - gx, y - gy) < 92) {
          nearFootprint = true;
          break;
        }
      }
      if (nearFootprint && rng() < 0.68) continue;
      const r = nearFootprint
        ? (1.5 + rng() * 2.8)
        : (1.8 + Math.pow(rng(), 2.2) * 10.2);
      holes.push({
        x, y, r,
        aspect: 0.54 + rng() * 0.66,
        rot: rng() * Math.PI,
        thinFilm: rng() < 0.44,
      });
    }
  }

  for (const h of holes) {
    // Rich caramelized golden-brown crisp filament around every bubble pore
    cCtx.save();
    cCtx.translate(h.x, h.y);
    cCtx.rotate(h.rot);
    cCtx.strokeStyle = h.thinFilm ? 'rgba(132, 62, 14, 0.44)' : 'rgba(102, 42, 8, 0.64)';
    cCtx.lineWidth = Math.max(1.5, h.r * 0.36);
    cCtx.beginPath();
    cCtx.ellipse(0, 0, h.r + 0.9, h.r * h.aspect + 0.9, 0, 0, Math.PI * 2);
    cCtx.stroke();
    if (h.thinFilm) {
      // Translucent toasted golden sugar-starch film inside bubble!
      cCtx.fillStyle = 'rgba(214, 142, 54, 0.38)';
      cCtx.fill();
    }
    cCtx.restore();

    bCtx.save();
    bCtx.translate(h.x, h.y);
    bCtx.rotate(h.rot);
    bCtx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    bCtx.lineWidth = Math.max(1.8, h.r * 0.42);
    bCtx.beginPath();
    bCtx.ellipse(0, 0, h.r + 1.1, h.r * h.aspect + 1.1, 0, 0, Math.PI * 2);
    bCtx.stroke();
    bCtx.restore();

    if (!h.thinFilm) {
      aCtx.save();
      aCtx.translate(h.x, h.y);
      aCtx.rotate(h.rot);
      aCtx.fillStyle = '#000000';
      aCtx.beginPath();
      aCtx.ellipse(0, 0, h.r * 0.82, h.r * h.aspect * 0.82, 0, 0, Math.PI * 2);
      aCtx.fill();
      aCtx.restore();
    }
  }

  // Warm golden caramel Maillard glaze over entire lace web
  cCtx.save();
  cCtx.globalCompositeOperation = 'multiply';
  const warmWash = cCtx.createRadialGradient(cx, cy, 40, cx, cy, maxR);
  warmWash.addColorStop(0, '#c68238');
  warmWash.addColorStop(0.65, '#db9d4e');
  warmWash.addColorStop(1, '#e8b96a');
  cCtx.fillStyle = warmWash;
  cCtx.fillRect(0, 0, size, size);
  cCtx.restore();

  // Fine crispy blister texture
  for (let i = 0; i < 1400; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * (maxR - 14);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const r = 1.2 + rng() * 4.2;
    bCtx.fillStyle = rng() > 0.35 ? 'rgba(242,242,242,0.65)' : 'rgba(58,58,58,0.52)';
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Glistening sesame-oil pools in roughness map (dark = mirror-like hot oil glint!)
  for (let i = 0; i < 420; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * (maxR - 16);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const r = 7 + rng() * 26;
    const rg = rCtx.createRadialGradient(x, y, 1, x, y, r);
    rg.addColorStop(0, 'rgba(14, 14, 14, 0.88)');
    rg.addColorStop(0.55, 'rgba(46, 46, 46, 0.5)');
    rg.addColorStop(1, 'rgba(140, 140, 140, 0)');
    rCtx.fillStyle = rg;
    rCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  return {
    map: createSRGBTexture(col),
    alphaMap: createLinearTexture(alpha),
    bumpMap: createLinearTexture(bump),
    roughnessMap: createLinearTexture(rough),
  };
}

// =========================================================================
// 7. Seared Caramelized Gyoza Sole Texture (512x512)
// =========================================================================
export function createSearSoleTextures() {
  const size = 512;
  const rng = mulberry32(606);
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  // Deep golden-chestnut Maillard sear crust fading softly to creamy dough rim
  const g = cCtx.createRadialGradient(size * 0.5, size * 0.5, 22, size * 0.5, size * 0.5, size * 0.49);
  g.addColorStop(0, '#5e2306');
  g.addColorStop(0.38, '#93410f');
  g.addColorStop(0.68, '#c46f22');
  g.addColorStop(0.88, '#dfb164');
  g.addColorStop(1, '#ecd9b2');
  cCtx.fillStyle = g;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#363636'; // glossy sizzling oil sheen!
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 620; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.72) * size * 0.43;
    const x = size * 0.5 + Math.cos(a) * d;
    const y = size * 0.5 + Math.sin(a) * d;
    const r = 3 + rng() * 14;
    cCtx.fillStyle = rng() > 0.42
      ? `rgba(62, 20, 4, ${0.22 + rng() * 0.28})`
      : `rgba(218, 146, 56, ${0.15 + rng() * 0.22})`;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();

    const bv = rng() > 0.5 ? 225 : 62;
    bCtx.fillStyle = `rgba(${bv},${bv},${bv},0.52)`;
    bCtx.beginPath();
    bCtx.arc(x, y, r * 0.52, 0, Math.PI * 2);
    bCtx.fill();

    const rv = Math.round(14 + rng() * 64);
    rCtx.fillStyle = `rgba(${rv},${rv},${rv},0.55)`;
    rCtx.beginPath();
    rCtx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    rCtx.fill();
  }

  return {
    map: createSRGBTexture(col),
    bumpMap: createLinearTexture(bump),
    roughnessMap: createLinearTexture(rough),
  };
}

// =========================================================================
// 8. Handcrafted Japanese Stoneware Plate Texture (512x512)
// =========================================================================
export function createStonewareTextures() {
  const size = 512;
  const rng = mulberry32(707);
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');

  const g = cCtx.createRadialGradient(size * 0.5, size * 0.5, 20, size * 0.5, size * 0.5, size * 0.5);
  g.addColorStop(0, '#232830');
  g.addColorStop(0.65, '#1d2229');
  g.addColorStop(0.88, '#171b21');
  g.addColorStop(0.95, '#594433');
  g.addColorStop(1, '#3a2c22');
  cCtx.fillStyle = g;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#4c4c4c';
  rCtx.fillRect(0, 0, size, size);

  for (let r = 18; r < size * 0.49; r += 5) {
    cCtx.strokeStyle = `rgba(255, 255, 255, ${0.014 + (r % 10 === 0 ? 0.016 : 0)})`;
    cCtx.lineWidth = 1.6;
    cCtx.beginPath();
    cCtx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2);
    cCtx.stroke();

    bCtx.strokeStyle = 'rgba(155,155,155,0.22)';
    bCtx.lineWidth = 1.5;
    bCtx.beginPath();
    bCtx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2);
    bCtx.stroke();
  }

  for (let i = 0; i < 720; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 0.7 + rng() * 1.9;
    cCtx.fillStyle = rng() > 0.4 ? 'rgba(10, 12, 15, 0.58)' : 'rgba(135, 118, 98, 0.24)';
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();
  }

  return {
    map: createSRGBTexture(col),
    bumpMap: createLinearTexture(bump),
    roughnessMap: createLinearTexture(rough),
  };
}

// =========================================================================
// 9. Kitchen Ceramic Subway Tile Backsplash & Brushed Stainless Cooktop
// =========================================================================
export function createKitchenTileTextures() {
  const size = 512;
  const col = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');
  const rng = mulberry32(808);

  // Subtle warm charcoal-taupe grout & muted warm-grey ceramic tiles (keeps backlit steam super visible!)
  cCtx.fillStyle = '#4e4a45';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#dedede';
  rCtx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const tileH = size / rows;
  const tileW = size / cols;
  const gap = 4;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tileW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tileW + offset + gap * 0.5;
      const y = r * tileH + gap * 0.5;
      const w = tileW - gap;
      const h = tileH - gap;
      const tint = Math.round((rng() - 0.5) * 10);
      // Warm moody stone-ceramic backsplash (food & bright white steam POP dramatically against this!)
      cCtx.fillStyle = `rgb(${112 + tint}, ${108 + tint}, ${102 + tint})`;
      cCtx.fillRect(x, y, w, h);

      bCtx.fillStyle = '#d4d4d4';
      bCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
      rCtx.fillStyle = '#343434';
      rCtx.fillRect(x, y, w, h);
    }
  }

  return {
    map: createSRGBTexture(col, 3, 2),
    bumpMap: createLinearTexture(bump, 3, 2),
    roughnessMap: createLinearTexture(rough, 3, 2),
  };
}

export function createBrushedSteelTextures() {
  const size = 512;
  const rng = mulberry32(909);
  const col = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const cCtx = col.getContext('2d');
  const rCtx = rough.getContext('2d');

  cCtx.fillStyle = '#8b9096';
  cCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#585858';
  rCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const v = Math.round(130 + (rng() - 0.5) * 26);
    cCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    cCtx.fillRect(0, y, size, 1);

    const rv = Math.round(62 + rng() * 46);
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.fillRect(0, y, size, 1);
  }

  return {
    map: createSRGBTexture(col, 2, 2),
    roughnessMap: createLinearTexture(rough, 2, 2),
  };
}

// =========================================================================
// 10. Soft Wispy Volumetric Steam Cloud Sprite (256x256)
// =========================================================================
export function createSteamSpriteTexture() {
  const size = 256;
  const rng = mulberry32(1010);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * size * 0.17;
    const x = size * 0.5 + Math.cos(a) * d;
    const y = size * 0.5 + Math.sin(a) * d;
    const r = size * (0.2 + rng() * 0.24);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255, 253, 250, 0.28)');
    g.addColorStop(0.5, 'rgba(248, 246, 243, 0.12)');
    g.addColorStop(1, 'rgba(245, 245, 245, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  return createSRGBTexture(c);
}

// =========================================================================
// 11. SIGNATURE REAL-TIME GLASS LID CONDENSATION & DRIPPING DROPLET SIMULATOR
//     Aspect-corrected for spherical dome UVs so every condensation bead is
//     a crisp crystal-round/teardrop water droplet with real gravity trails!
// =========================================================================
export class CondensationSimulator {
  constructor(width = 1024, height = 512) {
    // 2:1 aspect texture matches dome circumference vs arc height cleanly (<= 1024px!)
    this.w = width;
    this.h = height;
    this.rng = mulberry32(2026);

    this.fogCanvas = makeCanvas(this.w, this.h);
    this.fogCtx = this.fogCanvas.getContext('2d');

    this.colCanvas = makeCanvas(this.w, this.h);
    this.colCtx = this.colCanvas.getContext('2d');
    this.bumpCanvas = makeCanvas(this.w, this.h);
    this.bumpCtx = this.bumpCanvas.getContext('2d');

    // Fine sparkling micro-condensation mist grain (aspect-corrected tiny beads!)
    this.grainCanvas = makeCanvas(this.w, this.h);
    const gCtx = this.grainCanvas.getContext('2d');
    for (let i = 0; i < 4200; i++) {
      const u = this.rng();
      const v = 0.04 + this.rng() * 0.9;
      const x = u * this.w;
      const y = (1 - v) * this.h;
      const phi = v * Math.PI * 0.485;
      const aspectU = Math.max(0.28, 0.38 / Math.max(0.25, Math.cos(phi)));
      const r = 0.8 + this.rng() * 2.4;
      gCtx.fillStyle = `rgba(255, 254, 250, ${0.14 + this.rng() * 0.34})`;
      gCtx.beginPath();
      gCtx.ellipse(x, y, r * aspectU, r, 0, 0, Math.PI * 2);
      gCtx.fill();
    }

    // 180 crisp crystal condensation droplets coalescing & rolling straight down the curved inner glass!
    this.drops = [];
    for (let i = 0; i < 180; i++) {
      this.drops.push({
        u: this.rng(),
        v: 0.08 + this.rng() * 0.84,
        r: 1.3 + Math.pow(this.rng(), 1.3) * 4.8,
        vy: 0,
        sliding: this.rng() < 0.28,
        growRate: 0.25 + this.rng() * 0.55,
      });
    }

    this.fogLevel = 0;
    this.map = new THREE.CanvasTexture(this.colCanvas);
    this.map.colorSpace = THREE.SRGBColorSpace;
    this.map.wrapS = THREE.RepeatWrapping;
    this.map.wrapT = THREE.ClampToEdgeWrapping;

    this.bumpMap = new THREE.CanvasTexture(this.bumpCanvas);
    this.bumpMap.colorSpace = THREE.NoColorSpace;
    this.bumpMap.wrapS = THREE.RepeatWrapping;
    this.bumpMap.wrapT = THREE.ClampToEdgeWrapping;

    this.clear();
  }

  _aspectUForV(v) {
    // World circumference at latitude phi is 2*PI*R*cos(phi) (~10.4*cos(phi)), arc height is ~1.95
    // Texture is 1024x512 (2:1), so pixel-X per world unit is ~2.6x smaller than pixel-Y.
    // Compensating rx = ry * aspectU keeps droplets perfectly spherical/teardrop in 3D space!
    const phi = v * Math.PI * 0.485;
    const cosPhi = Math.max(0.22, Math.cos(phi));
    return Math.min(1.6, 0.38 / cosPhi);
  }

  clear() {
    this.fogLevel = 0;
    this.fogCtx.clearRect(0, 0, this.w, this.h);
    this.colCtx.clearRect(0, 0, this.w, this.h);
    this.bumpCtx.fillStyle = '#808080';
    this.bumpCtx.fillRect(0, 0, this.w, this.h);
    for (const d of this.drops) {
      d.r = 1.6 + this.rng() * 3.8;
      d.v = 0.12 + this.rng() * 0.8;
      d.vy = 0;
      d.sliding = false;
    }
    this.map.needsUpdate = true;
    this.bumpMap.needsUpdate = true;
  }

  // Interactive finger wipe directly on the curved glass lid!
  wipe(u, v, radiusPx = 46) {
    const x = u * this.w;
    const y = (1 - v) * this.h;
    const aspectU = this._aspectUForV(v);
    const rx = radiusPx * aspectU;
    const ry = radiusPx;

    const ctx = this.fogCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const ox of [-this.w, 0, this.w]) {
      ctx.save();
      ctx.translate(x + ox, y);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0.25, 0, 0, 1);
      g.addColorStop(0, 'rgba(0,0,0,0.98)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    for (const d of this.drops) {
      let du = Math.abs(d.u - u);
      if (du > 0.5) du = 1 - du;
      const dv = Math.abs(d.v - v);
      if (Math.hypot(du / (rx / this.w), dv / (ry / this.h)) < 1.1) {
        d.r = Math.max(0.8, d.r * 0.35);
        d.sliding = true;
        d.vy = Math.max(d.vy, 0.16);
      }
    }
  }

  update(dt, steamIntensity, active) {
    const w = this.w;
    const h = this.h;
    const fCtx = this.fogCtx;

    if (active && steamIntensity > 0.02) {
      this.fogLevel = Math.min(1, this.fogLevel + dt * 0.25 * steamIntensity);
      const deposit = Math.min(0.14, dt * 0.32 * steamIntensity);
      const grad = fCtx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.0, `rgba(255, 253, 248, ${deposit * 0.95})`);
      grad.addColorStop(0.45, `rgba(254, 251, 246, ${deposit * 1.25})`);
      grad.addColorStop(0.84, `rgba(250, 248, 243, ${deposit * 0.78})`);
      grad.addColorStop(1.0, `rgba(246, 245, 242, ${deposit * 0.2})`);
      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, w, h);
    } else if (!active && this.fogLevel > 0.005) {
      this.fogLevel = Math.max(0, this.fogLevel - dt * 0.2);
      fCtx.save();
      fCtx.globalCompositeOperation = 'destination-out';
      fCtx.fillStyle = `rgba(0,0,0,${Math.min(0.08, dt * 0.24)})`;
      fCtx.fillRect(0, 0, w, h);
      fCtx.restore();
    }

    // Update coalescing & sliding crystal droplets
    for (const d of this.drops) {
      if (active && steamIntensity > 0.05) {
        d.r += dt * d.growRate * steamIntensity * 0.95;
        if (d.r > 6.2 && !d.sliding) {
          d.sliding = true;
          d.vy = 0.045 + this.rng() * 0.055;
        }
      }
      if (d.sliding) {
        const prevY = (1 - d.v) * h;
        d.vy = Math.min(0.28, d.vy + dt * 0.16);
        d.v -= d.vy * dt;
        const aspectU = this._aspectUForV(d.v);
        const dx = d.u * w;
        const dy = (1 - d.v) * h;

        // Carve SILKY CONTINUOUS vertical clear drip-channel through the milky condensation fog!
        fCtx.save();
        fCtx.globalCompositeOperation = 'destination-out';
        fCtx.strokeStyle = 'rgba(0,0,0,0.92)';
        fCtx.lineCap = 'round';
        fCtx.lineWidth = Math.max(2.2, d.r * aspectU * 2.15);
        fCtx.beginPath();
        fCtx.moveTo(dx, prevY);
        fCtx.lineTo(dx, dy);
        fCtx.stroke();
        fCtx.restore();

        if (d.v < 0.04) {
          d.v = 0.45 + this.rng() * 0.46;
          d.u = this.rng();
          d.r = 1.5 + this.rng() * 2.1;
          d.vy = 0;
          d.sliding = false;
        }
      }
    }

    const cCtx = this.colCtx;
    const bCtx = this.bumpCtx;
    cCtx.clearRect(0, 0, w, h);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, w, h);

    if (this.fogLevel > 0.01) {
      // Richer backlit milky warm-white condensation veil (makes wiped peek-window & rolling drip trails POP!)
      cCtx.save();
      cCtx.globalAlpha = 0.74;
      cCtx.drawImage(this.fogCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'source-in';
      cCtx.fillStyle = '#fffdf7';
      cCtx.fillRect(0, 0, w, h);
      cCtx.restore();

      // Fine sparkling mist micro-beads masked to fogged regions
      cCtx.save();
      cCtx.globalAlpha = Math.min(0.85, this.fogLevel * 0.9);
      cCtx.drawImage(this.grainCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'destination-in';
      cCtx.drawImage(this.fogCanvas, 0, 0);
      cCtx.restore();

      // Luminous photographic crystal water beads (bright white backlit meniscus + pinpoint glint!)
      for (const d of this.drops) {
        if (d.r < 1.35) continue;
        const x = d.u * w;
        const y = (1 - d.v) * h;
        const aspectU = this._aspectUForV(d.v);
        const ry = Math.min(6.8, d.r) * (d.sliding ? 1.6 : 1.04);
        const rx = Math.min(6.8, d.r) * aspectU * 0.9;

        // Luminous crystal droplet fill
        cCtx.save();
        cCtx.translate(x, y);
        cCtx.scale(rx, ry);
        const dg = cCtx.createRadialGradient(-0.34, -0.4, 0.04, 0, 0, 1);
        dg.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        dg.addColorStop(0.32, 'rgba(255, 254, 250, 0.82)');
        dg.addColorStop(0.75, 'rgba(248, 250, 252, 0.28)');
        dg.addColorStop(1, 'rgba(255, 255, 255, 0.85)');
        cCtx.fillStyle = dg;
        cCtx.beginPath();
        cCtx.arc(0, 0, 1, 0, Math.PI * 2);
        cCtx.fill();
        cCtx.restore();

        // Crisp upper specular glint dot
        cCtx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        cCtx.beginPath();
        cCtx.ellipse(x - rx * 0.28, y - ry * 0.3, Math.max(0.8, rx * 0.3), Math.max(0.8, ry * 0.25), 0, 0, Math.PI * 2);
        cCtx.fill();

        // Gentle bump relief (no dark smudge!)
        bCtx.save();
        bCtx.translate(x, y);
        bCtx.scale(rx * 1.05, ry * 1.05);
        const bg = bCtx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
        bg.addColorStop(0, 'rgba(220, 220, 220, 0.85)');
        bg.addColorStop(1, 'rgba(128, 128, 128, 0)');
        bCtx.fillStyle = bg;
        bCtx.beginPath();
        bCtx.arc(0, 0, 1, 0, Math.PI * 2);
        bCtx.fill();
        bCtx.restore();
      }
    }

    this.map.needsUpdate = true;
    this.bumpMap.needsUpdate = true;
  }
}
