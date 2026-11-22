import * as THREE from '../vendor/three.module.js';

// Shared soft-3D warm anime-watercolor materials & outline helpers.
// Shadows are warm apricot/terracotta rather than cold grey, matching hand-painted anime film backgrounds.

let sharedToonRamp = null;

export function getWarmToonRamp() {
  if (sharedToonRamp) return sharedToonRamp;
  // 4-step soft cel/watercolor ramp (<= 1024px: 256x4)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, '#b98972');
  grad.addColorStop(0.32, '#d8aa90');
  grad.addColorStop(0.42, '#f0d8c4');
  grad.addColorStop(0.78, '#fbf1e6');
  grad.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  sharedToonRamp = tex;
  return tex;
}

export function makeSoft3DMaterial({
  color = 0xffffff,
  roughness = 0.62,
  metalness = 0.02,
  emissive = 0x2b1408,
  emissiveIntensity = 0.08,
  map = null,
  transparent = false,
  opacity = 1.0,
  clearcoat = 0.0,
  clearcoatRoughness = 0.25,
  side = THREE.FrontSide
} = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    map,
    transparent,
    opacity,
    clearcoat,
    clearcoatRoughness,
    side
  });
  return mat;
}

// Adds a delicate warm-sepia hand-drawn pencil contour around key 3D forms
export function addPencilOutline(mesh, thickness = 0.022, color = 0x6b4433, opacity = 0.55) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    transparent: opacity < 1.0,
    opacity,
    depthWrite: false
  });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(1 + thickness);
  outline.renderOrder = -1;
  outline.raycast = () => {}; // Never intercept touch raycasts
  mesh.add(outline);
  return outline;
}
