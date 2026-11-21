// Texture loading (photo JPEGs + procedural canvases) and GPU-memory estimation.
// file:// note: some browsers refuse to upload file:// images to WebGL, so index.html loads
// classic/textures.data.js (base64) on file:// and we prefer those data URLs when present.
import * as THREE from '../vendor/three.module.min.js';

function loadImage(name) {
  const data = (typeof window !== 'undefined' && window.__TEX_DATA__) || null;
  const src = (data && data[name]) || 'assets/' + name;
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn('texture missing', name); resolve(null); };
    img.src = src;
  });
}

function photoTexture(img, { repeat = false, mirror = false, anisotropy = 1 } = {}) {
  if (!img) return null;
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

function canvasTex(size, draw, { repeat = false, srgb = true, w = size, h = size } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Load everything the first scene needs. Returns {photo:{...}, canvas:{...}, images:{...}}. */
export async function loadTextures(anisotropy) {
  const names = ['town_512.jpg', 'asphalt_512.jpg', 'paint_512.jpg', 'steel_1024.jpg', 'trash_1024.jpg'];
  const imgs = await Promise.all(names.map(loadImage));
  const [town, asphalt, paint, steel, trash] = imgs;
  const photo = {
    town: photoTexture(town, { mirror: true, anisotropy: 1 }),
    asphalt: photoTexture(asphalt, { repeat: true, anisotropy }),
    paint: photoTexture(paint, { repeat: true, anisotropy }),
    steel: photoTexture(steel, { repeat: true, anisotropy }),
    trash: photoTexture(trash, { repeat: true, anisotropy }),
  };
  const canvas = {
    atlas: makeAtlas(),
    tile: makeTile(),
    grass: makeGrass(),
    shadow: makeBlob(),
    sparkle: makeSparkle(),
    heart: makeHeart(),
  };
  canvas.tile.anisotropy = anisotropy;
  return { photo, canvas, images: { trash } };
}

// ---------- procedural canvases ----------

/** 256² UI atlas, 4×4 cells of 64². (0,0)=white. Bin pictograms: (1,0) paper (2,0) box (3,0) bottle (0,1) can (1,1) bag. (2,1) house. */
export const ATLAS = {
  cell(col, row) { return [col / 4, 1 - (row + 1) / 4, (col + 1) / 4, 1 - row / 4]; },
  icon: { paper: [1, 0], box: [2, 0], bottle: [3, 0], can: [0, 1], bag: [1, 1], house: [2, 1] },
};

function makeAtlas() {
  return canvasTex(256, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    const cell = (c, r, fn) => { g.save(); g.translate(c * 64 + 32, r * 64 + 32); fn(); g.restore(); };
    const disc = (col) => { g.fillStyle = col; g.beginPath(); g.arc(0, 0, 29, 0, Math.PI * 2); g.fill(); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    // paper: crumpled ball
    cell(1, 0, () => {
      disc('#fffbe8');
      g.fillStyle = '#ffffff'; g.strokeStyle = '#8a8a8a'; g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = i % 2 ? 15 : 19; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-8, -4); g.lineTo(2, 3); g.lineTo(9, -6); g.stroke();
    });
    // box: cardboard
    cell(2, 0, () => {
      disc('#fff4e0');
      g.fillStyle = '#c98b4a'; g.strokeStyle = '#7a4f22'; g.lineWidth = 3;
      g.beginPath(); g.rect(-17, -12, 34, 26); g.fill(); g.stroke();
      g.fillStyle = '#e8c08a'; g.fillRect(-3, -12, 6, 26);
    });
    // bottle
    cell(3, 0, () => {
      disc('#e8f5ff');
      g.fillStyle = '#5ab4ff'; g.strokeStyle = '#1f6fb8'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-5, -22); g.lineTo(5, -22); g.lineTo(5, -14); g.quadraticCurveTo(12, -10, 12, -2);
      g.lineTo(12, 20); g.lineTo(-12, 20); g.lineTo(-12, -2); g.quadraticCurveTo(-12, -10, -5, -14); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(-12, 2, 24, 7);
    });
    // can
    cell(0, 1, () => {
      disc('#ffecec');
      g.fillStyle = '#ff5a5a'; g.strokeStyle = '#a82424'; g.lineWidth = 3;
      g.beginPath(); g.rect(-11, -17, 22, 34); g.fill(); g.stroke();
      g.fillStyle = '#d9d9d9'; g.fillRect(-11, -17, 22, 6); g.fillRect(-11, 11, 22, 6);
    });
    // bag
    cell(1, 1, () => {
      disc('#eafff0');
      g.fillStyle = '#ff7ac6'; g.strokeStyle = '#a8357a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-6, -14); g.quadraticCurveTo(-20, 0, -14, 16); g.lineTo(14, 16); g.quadraticCurveTo(20, 0, 6, -14); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-6, -14); g.lineTo(-9, -21); g.moveTo(6, -14); g.lineTo(9, -21); g.stroke();
    });
    // house pictogram (home button)
    cell(2, 1, () => {
      disc('#39b86a');
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(0, -24); g.lineTo(26, 0); g.lineTo(19, 0); g.lineTo(19, 22); g.lineTo(-19, 22); g.lineTo(-19, 0); g.lineTo(-26, 0); g.closePath(); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(-6, 7, 12, 15);
    });
  });
}

function makeTile() {
  return canvasTex(256, (g) => {
    g.fillStyle = '#eadbc8'; g.fillRect(0, 0, 256, 256);
    const cols = ['#f2e4d0', '#e6d2bb', '#efdcc6', '#f5e9da'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = cols[(x * 3 + y * 5) % 4];
      g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
    }
  }, { repeat: true });
}

function makeGrass() {
  return canvasTex(256, (g) => {
    g.fillStyle = '#7fcf5a'; g.fillRect(0, 0, 256, 256);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(70,150,50,0.35)' : 'rgba(170,230,120,0.35)';
      g.fillRect(r() * 256, r() * 256, 2, 5);
    }
  }, { repeat: true });
}

function makeBlob() {
  return canvasTex(64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, { srgb: false });
}

function makeSparkle() {
  return canvasTex(64, (g) => {
    g.translate(32, 32);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 7 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
  });
}

function makeHeart() {
  return canvasTex(64, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(32, 56);
    g.bezierCurveTo(4, 36, 4, 10, 20, 10); g.bezierCurveTo(28, 10, 32, 18, 32, 22);
    g.bezierCurveTo(32, 18, 36, 10, 44, 10); g.bezierCurveTo(60, 10, 60, 36, 32, 56);
    g.fill();
  });
}

/** Stripe texture for the pressed block and the gift: one band per load, overlaid with the trash photo. */
export function makeStripes(layerColors, trashImg) {
  return canvasTex(256, (g) => {
    const cols = layerColors.length ? layerColors : ['#cccccc'];
    const bh = 256 / cols.length;
    cols.forEach((c, i) => { g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillRect(0, i * bh, 256, Math.ceil(bh)); });
    if (trashImg) {
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.35;
      g.drawImage(trashImg, 0, 0, 256, 256);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    // soft white seams between bands
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 1; i < cols.length; i++) g.fillRect(0, i * bh - 2, 256, 4);
  });
}

/** Plant wall: friendly building facade (no text). */
export function makePlantWall() {
  return canvasTex(256, (g) => {
    g.fillStyle = '#9fd8e8'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#7cc3d8'; g.fillRect(0, 150, 256, 106);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(32 + i * 64, 70, 20, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#5fb0c8';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(32 + i * 64, 70, 14, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd54a'; g.fillRect(0, 140, 256, 10);
    g.fillStyle = '#f7f7f7';
    for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 6, 170, 20, 60);
  });
}

// ---------- memory estimate ----------

/** Rough GPU memory (bytes) of textures referenced by the scene + geometry buffers. */
export function estimateSceneGPU(scene) {
  const texSeen = new Set(), geoSeen = new Set();
  let texBytes = 0, geoBytes = 0, texCount = 0;
  const addTex = (t) => {
    if (!t || texSeen.has(t)) return;
    texSeen.add(t);
    const img = t.image;
    const w = (img && (img.width || img.videoWidth)) || 0, h = (img && (img.height || img.videoHeight)) || 0;
    if (!w || !h) return;
    texCount++;
    const mip = t.generateMipmaps !== false ? 4 / 3 : 1;
    texBytes += w * h * 4 * mip;
  };
  const addAttr = (a) => { if (a && a.array) geoBytes += a.array.byteLength; };
  scene.traverse((o) => {
    if (o.geometry && !geoSeen.has(o.geometry)) {
      geoSeen.add(o.geometry);
      const g = o.geometry;
      for (const k in g.attributes) addAttr(g.attributes[k]);
      addAttr(g.index);
    }
    if (o.isInstancedMesh) { addAttr(o.instanceMatrix); addAttr(o.instanceColor); }
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const k in m) { const v = m[k]; if (v && v.isTexture) addTex(v); }
  });
  if (scene.background && scene.background.isTexture) addTex(scene.background);
  return { texBytes, geoBytes, texCount };
}
