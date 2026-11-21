import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

export { THREE, RoundedBoxGeometry };

let sharedClayBump = null;
let sharedWoodMap = null;

/**
 * Generates a tileable 512x512 procedural clay bump texture with soft
 * overlapping thumbprint smudges and subtle plasticine grain.
 */
export function getClayBumpTexture() {
  if (sharedClayBump) return sharedClayBump;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Deterministic PRNG so look is consistent every load
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Large soft hand-molded clay undulations (wrapped across edges for seamlessness)
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 22 + rand() * 44;
    const ry = 16 + rand() * 34;
    const rot = rand() * Math.PI;
    const bright = rand() > 0.5 ? 152 : 104;
    const alpha = 0.08 + rand() * 0.08;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        ctx.save();
        ctx.translate(x + ox * size, y + oy * size);
        ctx.rotate(rot);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
        grad.addColorStop(0, `rgba(${bright},${bright},${bright},${alpha})`);
        grad.addColorStop(1, 'rgba(128,128,128,0)');
        ctx.fillStyle = grad;
        ctx.scale(1, ry / rx);
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Subtle sculpted thumbprint ridge arcs
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 85; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rot = rand() * Math.PI * 2;
    const r = 10 + rand() * 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    for (let ring = 0; ring < 4; ring++) {
      ctx.strokeStyle = ring % 2 === 0 ? 'rgba(165,165,165,0.06)' : 'rgba(92,92,92,0.06)';
      ctx.beginPath();
      ctx.arc(0, 0, r + ring * 3.2, -0.75, 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Fine matte plasticine speckle
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    const v = Math.max(0, Math.min(255, d[i] + n));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  sharedClayBump = tex;
  return tex;
}

/**
 * Generates a warm hand-sculpted wooden counter clay texture (512x512).
 */
export function getWoodClayTexture() {
  if (sharedWoodMap) return sharedWoodMap;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d9a473';
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 42; i++) {
    const y = (i / 42) * size;
    const h = 8 + rand() * 14;
    const shade = rand() > 0.5 ? 'rgba(201, 142, 91, 0.22)' : 'rgba(235, 190, 142, 0.20)';
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 + i) * 3.5);
    }
    ctx.lineTo(size, y + h);
    ctx.lineTo(0, y + h);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  sharedWoodMap = tex;
  return tex;
}

/**
 * Creates a plump, warm, matte-satin stop-motion polymer clay material.
 * Uses a subtle wrap-light + warm subsurface glow tweak so shadows stay cozy and sculpted.
 */
export function clayMat(hexColor, opts = {}) {
  const bump = opts.noBump ? null : getClayBumpTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexColor),
    roughness: opts.roughness ?? 0.74,
    metalness: opts.metalness ?? 0.0,
    bumpMap: bump,
    bumpScale: opts.bumpScale ?? 0.042,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    side: opts.side ?? THREE.FrontSide,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0.0,
    depthWrite: opts.depthWrite ?? true,
  });

  const warmGlow = opts.warmth ?? 0.16;
  const rimStrength = opts.rim ?? 0.18;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uClayWarmth = { value: warmGlow };
    shader.uniforms.uClayRim = { value: rimStrength };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uClayWarmth;
       uniform float uClayRim;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
       // Soft clay rim & warm subsurface lift so dark crevices stay cozy plasticine
       float clayRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.2);
       outgoingLight += diffuseColor.rgb * uClayWarmth;
       outgoingLight += mix(diffuseColor.rgb, vec3(1.0, 0.94, 0.85), 0.45) * clayRim * uClayRim;
       #include <opaque_fragment>
      `
    );
  };
  mat.customProgramCacheKey = () => `clay_${warmGlow.toFixed(2)}_${rimStrength.toFixed(2)}`;

  return mat;
}

/**
 * Applies smooth, continuous spatial organic clay wobble to geometry vertices.
 * Displacement depends ONLY on spatial position (x,y,z), keeping UV seams 100% watertight!
 */
export function sculptClayGeo(geo, amount = 0.025, freq = 3.2, phase = 0) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  geo.computeVertexNormals();
  const norm = geo.attributes.normal;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(norm, i);
    const wave =
      Math.sin(v.x * freq + phase) * Math.cos(v.y * (freq * 1.13) + phase * 0.7) +
      0.5 * Math.sin(v.z * (freq * 1.37) - phase * 1.2) * Math.cos(v.x * (freq * 0.85));
    v.addScaledVector(n, wave * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Volume-preserving clay squash & stretch spring animator.
 */
export class SquashSpring {
  constructor(stiffness = 210, damping = 14) {
    this.value = 1;
    this.vel = 0;
    this.target = 1;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  impulse(velDelta = -2.6) {
    this.vel += velDelta;
  }

  setSquash(v) {
    this.value = v;
  }

  update(dt, obj3d = null, baseScale = 1) {
    const clampedDt = Math.min(dt, 0.05);
    const force = (this.target - this.value) * this.stiffness;
    this.vel += force * clampedDt;
    this.vel *= Math.exp(-this.damping * clampedDt);
    this.value += this.vel * clampedDt;
    const sy = Math.max(0.58, Math.min(1.45, this.value));
    if (obj3d) {
      const sxz = 1 / Math.sqrt(sy);
      obj3d.scale.set(sxz * baseScale, sy * baseScale, sxz * baseScale);
    }
    return sy;
  }
}
