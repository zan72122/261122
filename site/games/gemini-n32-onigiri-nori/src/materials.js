import * as THREE from '../vendor/three.module.min.js';

let cachedGradientMap = null;

function getWatercolorGradientMap() {
  if (cachedGradientMap) return cachedGradientMap;
  // Soft painterly 4-tone watercolor light ramp (warm highlight -> gentle pastel shadow)
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 16, 0);
  grad.addColorStop(0.0, '#b5a29c');
  grad.addColorStop(0.28, '#d4c3b8');
  grad.addColorStop(0.55, '#ede2d5');
  grad.addColorStop(0.78, '#faf4ea');
  grad.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  cachedGradientMap = tex;
  return tex;
}

export function createWatercolorMaterial({
  color = 0xffffff,
  map = null,
  bumpMap = null,
  bumpScale = 0.02,
  emissive = 0x261a14,
  emissiveIntensity = 0.12,
  transparent = false,
  opacity = 1.0,
  side = THREE.FrontSide,
  depthWrite = true
} = {}) {
  const mat = new THREE.MeshToonMaterial({
    color,
    map,
    bumpMap,
    bumpScale,
    gradientMap: getWatercolorGradientMap(),
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    side,
    depthWrite
  });
  return mat;
}

const outlineMatCache = new Map();

export function getOutlineMaterial(colorHex = 0x5c4337, opacity = 0.72) {
  const key = `${colorHex}_${opacity}`;
  if (outlineMatCache.has(key)) return outlineMatCache.get(key);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.BackSide,
    transparent: opacity < 1,
    opacity
  });
  outlineMatCache.set(key, mat);
  return mat;
}

// Colored-pencil soft sepia outline using lightweight inverted hull
export function addPencilOutline(mesh, scale = 1.035, colorHex = 0x5c4337, opacity = 0.68) {
  const outline = new THREE.Mesh(mesh.geometry, getOutlineMaterial(colorHex, opacity));
  outline.scale.setScalar(scale);
  outline.renderOrder = -1;
  outline.userData.isOutline = true;
  mesh.add(outline);
  return outline;
}
