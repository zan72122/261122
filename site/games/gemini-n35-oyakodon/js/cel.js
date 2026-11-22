import * as THREE from '../vendor/three.module.js';

export const INK_COLOR = 0x241612;

function createGradientMap(stops) {
  const data = new Uint8Array(stops.length * 4);
  for (let i = 0; i < stops.length; i++) {
    const v = stops[i];
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// Classic crisp 3-step and 4-step Japanese anime cel ramps
export const TOON_GRADIENT_3 = createGradientMap([118, 198, 255]);
export const TOON_GRADIENT_4 = createGradientMap([108, 168, 224, 255]);
export const TOON_GRADIENT_SKIN = createGradientMap([175, 228, 255]);

export function createCelMaterial(color, opts = {}) {
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: opts.gradientMap || TOON_GRADIENT_3,
    map: opts.map || null,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity || 0,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
  });
  return mat;
}

/**
 * Computes averaged smooth normals by quantized vertex position so inverted-hull
 * cel-anime outlines stay continuous even across box/cylinder hard seams.
 */
export function buildSmoothNormalGeometry(sourceGeom) {
  const geom = sourceGeom.clone();
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  if (!pos || !norm) return geom;

  const accum = new Map();
  const keyOf = (x, y, z) =>
    `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;

  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(pos.getX(i), pos.getY(i), pos.getZ(i));
    let v = accum.get(k);
    if (!v) {
      v = [0, 0, 0];
      accum.set(k, v);
    }
    v[0] += norm.getX(i);
    v[1] += norm.getY(i);
    v[2] += norm.getZ(i);
  }

  const smooth = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(pos.getX(i), pos.getY(i), pos.getZ(i));
    const v = accum.get(k);
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    smooth[i * 3] = v[0] / len;
    smooth[i * 3 + 1] = v[1] / len;
    smooth[i * 3 + 2] = v[2] / len;
  }

  geom.setAttribute('aSmoothNormal', new THREE.BufferAttribute(smooth, 3));
  return geom;
}

const outlineMatCache = new Map();

export function createOutlineMaterial(thickness = 0.032, color = INK_COLOR) {
  const key = `${thickness.toFixed(4)}_${color}`;
  if (outlineMatCache.has(key)) return outlineMatCache.get(key);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      attribute vec3 aSmoothNormal;
      uniform float uThickness;
      void main() {
        vec3 n = length(aSmoothNormal) > 0.001 ? normalize(aSmoothNormal) : normalize(normal);
        vec3 displaced = position + n * uThickness;
        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
  });
  outlineMatCache.set(key, mat);
  return mat;
}

/**
 * Adds a crisp hand-inked cel-anime outline child mesh to any THREE.Mesh.
 */
export function addOutline(mesh, thickness = 0.034, color = INK_COLOR) {
  const smoothGeom = buildSmoothNormalGeometry(mesh.geometry);
  const outlineMat = createOutlineMaterial(thickness, color);
  const outline = new THREE.Mesh(smoothGeom, outlineMat);
  outline.name = 'celOutline';
  outline.renderOrder = -1;
  outline.raycast = () => {}; // Never interfere with raycasting
  mesh.add(outline);
  return outline;
}

/**
 * Helper: creates a cel-shaded mesh with bold ink outline in one call.
 */
export function makeCelMesh(geometry, color, opts = {}) {
  const mat = opts.material || createCelMaterial(color, opts);
  const mesh = new THREE.Mesh(geometry, mat);
  if (opts.outline !== false) {
    addOutline(mesh, opts.outlineThickness ?? 0.035, opts.outlineColor ?? INK_COLOR);
  }
  if (opts.castShadow) mesh.castShadow = true;
  if (opts.receiveShadow) mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates an anime white gloss highlight spot (flat pure white cel glint).
 */
export function makeCelHighlight(rx = 0.14, ry = 0.08, opacity = 0.92) {
  const geom = new THREE.CircleGeometry(1, 14);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.scale.set(rx, ry, 1);
  mesh.raycast = () => {};
  return mesh;
}

/* ================= PROCEDURAL ANIME CANVAS TEXTURES (all <= 512px) ================= */

export function createWoodTexture(base = '#e4a96b', grain = '#b5743c', ink = '#6b3e1b') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  // Warm plank bands
  const planks = 4;
  const ph = 512 / planks;
  for (let p = 0; p < planks; p++) {
    ctx.fillStyle = p % 2 === 0 ? 'rgba(255,244,220,0.14)' : 'rgba(130,68,24,0.08)';
    ctx.fillRect(0, p * ph, 512, ph);

    // Anime hand-drawn wood grain waves
    ctx.strokeStyle = grain;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y0 = p * ph + 14 + i * 19;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 32) {
        const y = y0 + Math.sin(x * 0.018 + p * 1.9 + i) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Crisp plank seam ink line
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, p * ph);
    ctx.lineTo(512, p * ph);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createTileWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Warm sunlit anime kitchen cream base
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#fff7e2');
  grad.addColorStop(0.55, '#fcebd0');
  grad.addColorStop(1, '#f4dab4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tile tint variation
  const cols = 8;
  const rows = 8;
  const tw = 512 / cols;
  const th = 512 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if ((r + col) % 3 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(col * tw + 2, r * th + 2, tw - 4, th - 4);
      } else if ((r + col) % 5 === 0) {
        ctx.fillStyle = 'rgba(235, 190, 140, 0.15)';
        ctx.fillRect(col * tw + 2, r * th + 2, tw - 4, th - 4);
      }
    }
  }

  // Crisp anime grout lines
  ctx.strokeStyle = '#c8a787';
  ctx.lineWidth = 3.5;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tw, 0);
    ctx.lineTo(i * tw, 512);
    ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * th);
    ctx.lineTo(512, j * th);
    ctx.stroke();
  }

  // Soft diagonal anime morning sunbeam
  ctx.save();
  ctx.fillStyle = 'rgba(255, 253, 232, 0.34)';
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.lineTo(250, 0);
  ctx.lineTo(440, 512);
  ctx.lineTo(220, 512);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createDonburiTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Deep classic Japanese donburi cream-indigo-vermilion band design
  ctx.fillStyle = '#fff5e4';
  ctx.fillRect(0, 0, 512, 256);

  // Lower indigo-blue base
  ctx.fillStyle = '#254a7c';
  ctx.fillRect(0, 128, 512, 128);

  // Bold vermilion band near upper rim
  ctx.fillStyle = '#d94532';
  ctx.fillRect(0, 22, 512, 34);

  // Golden accent stripe
  ctx.fillStyle = '#f5b83d';
  ctx.fillRect(0, 62, 512, 14);

  // Traditional Japanese anime wave arcs (Seigaiha-inspired) along lower half
  ctx.strokeStyle = '#fff5e4';
  ctx.lineWidth = 4;
  for (let row = 0; row < 2; row++) {
    const y = 165 + row * 48;
    const offset = row * 32;
    for (let x = -32; x <= 544; x += 64) {
      ctx.beginPath();
      ctx.arc(x + offset, y, 28, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + offset, y, 16, Math.PI, 0);
      ctx.stroke();
    }
  }

  // Cute vermilion blossom dots along cream band
  for (let x = 32; x < 512; x += 64) {
    ctx.fillStyle = '#e04f3a';
    ctx.beginPath();
    ctx.arc(x, 102, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#241612';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffdf6b';
    ctx.beginPath();
    ctx.arc(x, 102, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp ink separator lines
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 5;
  [22, 56, 76, 128].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createBowlBottomEmblemTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fff9ee';
  ctx.fillRect(0, 0, 256, 256);

  // Outer indigo ring
  ctx.strokeStyle = '#28528a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  // Happy ceramic blossom flower in center (zero text!)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? '#e85b48' : '#f48c72';
    ctx.strokeStyle = '#241612';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * 44, 128 + Math.sin(a) * 44, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd44d';
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cute tiny smile inside flower!
  ctx.fillStyle = '#241612';
  ctx.beginPath();
  ctx.arc(116, 122, 4.5, 0, Math.PI * 2);
  ctx.arc(140, 122, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 130, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEggBowlTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fff5df';
  ctx.fillRect(0, 0, 256, 128);

  // Cute ochre-orange hand-drawn vertical stripes
  ctx.fillStyle = '#f29e4c';
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 22, 14, 106);
  }
  // Rim band
  ctx.fillStyle = '#d96b38';
  ctx.fillRect(0, 0, 256, 20);
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(256, 20);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createApronTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fff8ee';
  ctx.fillRect(0, 0, 256, 256);

  // Cheerful anime red vertical stripes
  ctx.fillStyle = '#ef5348';
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 14, 256);
  }
  // Pocket front
  ctx.fillStyle = '#fff8ee';
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(78, 126, 100, 74, [0, 0, 26, 26]);
  ctx.fill();
  ctx.stroke();

  // Cute tiny golden egg icon stitched on pocket (zero text)
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(128, 164, 24, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb72b';
  ctx.beginPath();
  ctx.arc(128, 164, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlateTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#3b6ea5';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 110, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLidWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#e8b679';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle cedar planks
  ctx.strokeStyle = '#bc8244';
  ctx.lineWidth = 3;
  for (let i = 1; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 22);
    ctx.bezierCurveTo(80, i * 22 + 5, 170, i * 22 - 5, 256, i * 22);
    ctx.stroke();
  }
  ctx.strokeStyle = '#8b5426';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 86);
  ctx.lineTo(256, 86);
  ctx.moveTo(0, 170);
  ctx.lineTo(256, 170);
  ctx.stroke();

  // Outer rim ring
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Hand-drawn cel-shaded anime puffy steam cloud sprite texture (zero backface artifacts!).
 */
export function createSteamCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  const blobs = [
    [128, 134, 62],
    [82, 146, 46],
    [174, 146, 46],
    [104, 102, 46],
    [154, 104, 44],
  ];

  // Crisp cel-anime warm-brown outline pass
  ctx.fillStyle = '#6c4d3c';
  blobs.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r + 9, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft warm cream shadow belly
  ctx.fillStyle = '#f5eadb';
  blobs.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Bright pure-white anime sunlit top puff
  ctx.fillStyle = '#ffffff';
  blobs.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x - 4, y - 8, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Hand-drawn cel-anime 4-point sparkle star sprite texture.
 */
export function createSparkleStarTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');

  const drawStar = (outer, inner) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / 4;
      const x = 64 + Math.cos(a) * r;
      const y = 64 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  drawStar(54, 18);
  ctx.fillStyle = '#ffdf4d';
  ctx.fill();
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.stroke();

  drawStar(28, 9);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
