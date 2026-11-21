import { THREE } from './three.js';

// 頂点色つきでいくつもの形を1つの geometry に結合する（draw call を減らす）。
// parts: [{ geo, color?, pos?, rot?, scale?, matrix?, uv?: [u, v], alpha? }]
//   color を省くと geo の頂点色をそのまま使う。matrix を渡すと pos/rot/scale の代わりに使う。
// opts.uv：uv も結合する（part.uv を渡すとその part は全頂点がその uv＝テクスチャの1点の色）。
// opts.alpha：頂点色を RGBA にして part.alpha（既定 1）を入れる（疑似影の濃さを1つの material で変える）。
export function mergeColored(parts, opts = {}) {
  let nv = 0, ni = 0;
  const prepared = parts.map((p) => {
    const g = p.geo.index ? p.geo : indexed(p.geo);
    const m = p.matrix ? p.matrix.clone() : new THREE.Matrix4().compose(
      p.pos || new THREE.Vector3(),
      new THREE.Quaternion().setFromEuler(p.rot || new THREE.Euler()),
      p.scale instanceof THREE.Vector3 ? p.scale : new THREE.Vector3(1, 1, 1).multiplyScalar(p.scale || 1));
    nv += g.attributes.position.count; ni += g.index.count;
    return { g, m, c: p.color == null ? null : new THREE.Color(p.color), uv: p.uv || null, a: p.alpha == null ? 1 : p.alpha, src: p.geo };
  });
  const cs = opts.alpha ? 4 : 3;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * cs);
  const uvs = opts.uv ? new Float32Array(nv * 2) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { g, m, c, uv, a } of prepared) {
    nm.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); v.toArray(pos, (vo + i) * 3);
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm); const l = v.length(); if (l > 1e-6) v.multiplyScalar(1 / l); else v.set(0, 1, 0); v.toArray(nor, (vo + i) * 3); }
      const o = (vo + i) * cs;
      if (c) { col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; }
      else if (C) { col[o] = C.getX(i); col[o + 1] = C.getY(i); col[o + 2] = C.getZ(i); }
      else { col[o] = col[o + 1] = col[o + 2] = 1; }
      if (cs === 4) col[o + 3] = a;
      if (uvs) {
        if (uv) { uvs[(vo + i) * 2] = uv[0]; uvs[(vo + i) * 2 + 1] = uv[1]; }
        else if (U) { uvs[(vo + i) * 2] = U.getX(i); uvs[(vo + i) * 2 + 1] = U.getY(i); }
      }
    }
    const I = g.index.array;
    for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
    vo += P.count; io += I.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, cs));
  if (uvs) out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  for (const p of prepared) if (p.g !== p.geo) p.g.dispose();
  return out;
}
function indexed(g) {
  const n = g.attributes.position.count;
  const c = g.clone();
  const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i;
  c.setIndex(new THREE.BufferAttribute(a, 1));
  return c;
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// 指数的に近づける（フレームレートに依存しない）
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export function dampV(v, target, k, dt) { return v.lerp(target, 1 - Math.exp(-k * dt)); }

// ジオメトリ・マテリアル・テクスチャをまとめて捨てる
export function disposeTree(obj, keepTextures) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) {
      if (!keepTextures) for (const k of ['map', 'emissiveMap', 'alphaMap']) if (m[k] && !keepTextures) m[k].dispose();
      m.dispose();
    }
  });
}

// 光らせる（ヒント）ためのマテリアル束
export class Glow {
  constructor(materials) { this.mats = materials.filter((m) => m && m.emissive); this.base = this.mats.map((m) => m.emissive.clone()); this.v = 0; }
  set(v) {
    if (Math.abs(v - this.v) < 1e-3) return;
    this.v = v;
    this.mats.forEach((m, i) => { m.emissive.copy(this.base[i]).lerp(GLOW_COLOR, v); });
  }
}
const GLOW_COLOR = new THREE.Color('#ffd9a0');
