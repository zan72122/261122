// Parametric geometry helpers for the shell (low poly, vertex-coloured, mergeable).
// All shell props share one material (Lambert + vertexColors + the UI atlas map). Parts that
// should not show the atlas get their UVs pointed at the atlas' white cell.
import * as THREE from '../vendor/three.module.min.js';

export const WHITE_UV = [0.125, 0.875]; // centre of atlas cell (0,0), which is pure white

/** Rounded box: (w,h,d) with edge radius r and `seg` segments per rounded edge. Centered at origin. */
export function roundedBox(w, h, d, r, seg = 2) {
  const n = seg * 2 + 1;
  const g = new THREE.BoxGeometry(2, 2, 2, n, n, n);
  const H = [w / 2, h / 2, d / 2];
  const R = Math.min(r, H[0] * 0.999, H[1] * 0.999, H[2] * 0.999);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const remap = (c, half) => {
    const i = Math.round(((c + 1) * n) / 2);
    if (i <= seg) return -half + (R * i) / seg;
    if (i >= n - seg) return half - (R * (n - i)) / seg;
    const t = (i - seg) / (n - 2 * seg);
    return -half + R + t * (2 * half - 2 * R);
  };
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), off = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.set(remap(pos.getX(k), H[0]), remap(pos.getY(k), H[1]), remap(pos.getZ(k), H[2]));
    inner.set(
      THREE.MathUtils.clamp(v.x, -H[0] + R, H[0] - R),
      THREE.MathUtils.clamp(v.y, -H[1] + R, H[1] - R),
      THREE.MathUtils.clamp(v.z, -H[2] + R, H[2] - R)
    );
    off.subVectors(v, inner);
    const len = off.length();
    if (len > 1e-6) {
      off.multiplyScalar(1 / len);
      v.copy(inner).addScaledVector(off, R);
      nor.setXYZ(k, off.x, off.y, off.z);
    }
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  return g;
}

/** Ensure geometry has an index (needed by merge). */
function ensureIndex(g) {
  if (g.index) return g;
  const n = g.attributes.position.count;
  const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const _c = new THREE.Color();
/** Fill a per-vertex colour attribute (hex is sRGB; stored linear like three expects). */
export function paint(g, hex, uvMode = 'white') {
  _c.set(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uvMode === 'white' || !g.attributes.uv) {
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { uv[i * 2] = WHITE_UV[0]; uv[i * 2 + 1] = WHITE_UV[1]; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  return g;
}

/** Remap the geometry's existing 0..1 UVs into an atlas rectangle [u0,v0,u1,v1]. */
export function uvRect(g, rect) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1]));
  }
  return g;
}

/** Bake a transform into the geometry (position, rotation (Euler xyz), scale). Returns g. */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  return g;
}

/** Merge geometries that all have position/normal/uv/color. Disposes the inputs. */
export function merge(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) { ensureIndex(g); vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2), col = new Float32Array(vCount * 3);
  const idx = new (vCount > 65535 ? Uint32Array : Uint16Array)(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    const a = g.attributes;
    pos.set(a.position.array, vo * 3);
    nor.set(a.normal.array, vo * 3);
    uv.set(a.uv.array, vo * 2);
    col.set(a.color.array, vo * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += a.position.count; io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

// Short-hands for coloured primitives (already painted, white-UV).
export const sphere = (r, hex, ws = 12, hs = 8) => paint(new THREE.SphereGeometry(r, ws, hs), hex);
export const cyl = (rt, rb, h, hex, seg = 12) => paint(new THREE.CylinderGeometry(rt, rb, h, seg), hex);
export const box = (w, h, d, hex) => paint(new THREE.BoxGeometry(w, h, d), hex);
export const rbox = (w, h, d, r, hex, seg = 2) => paint(roundedBox(w, h, d, r, seg), hex);
export const torus = (r, t, hex, arc = Math.PI * 2, rs = 6, ts = 14) => paint(new THREE.TorusGeometry(r, t, rs, ts, arc), hex);
export const cone = (r, h, hex, seg = 10) => paint(new THREE.ConeGeometry(r, h, seg), hex);

/** Triangle count of a geometry (indexed or not). */
export function triCount(g) {
  if (!g) return 0;
  if (g.index) return g.index.count / 3;
  return g.attributes.position ? g.attributes.position.count / 3 : 0;
}
