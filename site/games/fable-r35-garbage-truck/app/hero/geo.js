// Geometry helpers for the hero (garbage truck). No three import: everything goes through the THREE
// object handed to createHero. Every geometry produced here carries position / normal / uv / color so
// that parts sharing a material can be merged into one draw call.
//
// Colour model: the "colour" material is Lambert + vertexColors + the hero atlas (a small canvas).
// Flat coloured parts point their UVs at the atlas' white cell; decals keep real UVs.

export const ATLAS_SIZE = 512;
const CELL = 64;
/** atlas rect [u0, v0, u1, v1] for a block of cells (cx, cy from the top-left, w × h cells), inset px */
export function atlasRect(cx, cy, w = 1, h = 1, inset = 2) {
  const x0 = cx * CELL + inset, x1 = (cx + w) * CELL - inset;
  const y0 = cy * CELL + inset, y1 = (cy + h) * CELL - inset;
  return [x0 / ATLAS_SIZE, 1 - y1 / ATLAS_SIZE, x1 / ATLAS_SIZE, 1 - y0 / ATLAS_SIZE];
}
export const UV = {
  white: [0.5 * CELL / ATLAS_SIZE, 1 - 0.5 * CELL / ATLAS_SIZE],
  flower: atlasRect(1, 0, 2, 2),
  glass: atlasRect(0, 1, 1, 1),
  chevron: atlasRect(0, 2, 4, 1),
  arrow: atlasRect(3, 0, 1, 1),
  dots: atlasRect(3, 1, 1, 1),
  crumple: atlasRect(4, 0, 4, 4, 3),
};

/** deterministic random (mulberry32) */
export function rng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeGeo(THREE) {
  const _c = new THREE.Color();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

  /** per-vertex colour (hex is sRGB, stored linear). uv: 'white' → atlas white cell, 'keep' → untouched */
  function paint(g, hex, uv = 'white') {
    _c.set(hex);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv === 'white' || !g.attributes.uv) {
      const a = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { a[i * 2] = UV.white[0]; a[i * 2 + 1] = UV.white[1]; }
      g.setAttribute('uv', new THREE.BufferAttribute(a, 2));
    }
    return g;
  }

  /** multiply the vertex colours by fn(x, y, z) (cheap shading / two-tone parts) */
  function shade(g, fn) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const k = fn(p.getX(i), p.getY(i), p.getZ(i));
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
    return g;
  }

  /** remap existing 0..1 UVs into an atlas rect */
  function uvRect(g, r) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
    return g;
  }

  /** UVs from positions (metres × scale), picking the plane by the dominant normal axis → even texel density */
  function worldUV(g, scale = 0.5) {
    const p = g.attributes.position, n = g.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let u, v;
      if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
      else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
      else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }

  /** bake a transform into the geometry */
  function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    return g;
  }

  function ensure(g) {
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (!g.index) {
      const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    return g;
  }

  /** merge geometries (position/normal/uv/color); disposes the inputs */
  function merge(list) {
    let vc = 0, ic = 0;
    for (const g of list) { ensure(g); vc += g.attributes.position.count; ic += g.index.count; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), col = new Float32Array(vc * 3);
    const idx = new (vc > 65535 ? Uint32Array : Uint16Array)(ic);
    let vo = 0, io = 0;
    for (const g of list) {
      const a = g.attributes, n = a.position.count;
      for (let i = 0; i < n; i++) {
        pos[(vo + i) * 3] = a.position.getX(i); pos[(vo + i) * 3 + 1] = a.position.getY(i); pos[(vo + i) * 3 + 2] = a.position.getZ(i);
        nor[(vo + i) * 3] = a.normal.getX(i); nor[(vo + i) * 3 + 1] = a.normal.getY(i); nor[(vo + i) * 3 + 2] = a.normal.getZ(i);
        uv[(vo + i) * 2] = a.uv.getX(i); uv[(vo + i) * 2 + 1] = a.uv.getY(i);
        col[(vo + i) * 3] = a.color.getX(i); col[(vo + i) * 3 + 1] = a.color.getY(i); col[(vo + i) * 3 + 2] = a.color.getZ(i);
      }
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += n; io += gi.length;
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

  /** rounded box centred at the origin */
  function roundedBox(w, h, d, r, seg = 2) {
    const n = seg * 2 + 1;
    const g = new THREE.BoxGeometry(2, 2, 2, n, n, n);
    const H = [w / 2, h / 2, d / 2];
    const R = Math.max(1e-4, Math.min(r, H[0] * 0.999, H[1] * 0.999, H[2] * 0.999));
    const pos = g.attributes.position, nor = g.attributes.normal;
    const remap = (c, half) => {
      const i = Math.round(((c + 1) * n) / 2);
      if (i <= seg) return -half + (R * i) / seg;
      if (i >= n - seg) return half - (R * (n - i)) / seg;
      return -half + R + ((i - seg) / (n - 2 * seg)) * (2 * half - 2 * R);
    };
    const v = new THREE.Vector3(), inner = new THREE.Vector3(), off = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.set(remap(pos.getX(k), H[0]), remap(pos.getY(k), H[1]), remap(pos.getZ(k), H[2]));
      inner.set(Math.min(H[0] - R, Math.max(-H[0] + R, v.x)), Math.min(H[1] - R, Math.max(-H[1] + R, v.y)), Math.min(H[2] - R, Math.max(-H[2] + R, v.z)));
      off.subVectors(v, inner);
      const len = off.length();
      if (len > 1e-6) { off.multiplyScalar(1 / len); v.copy(inner).addScaledVector(off, R); nor.setXYZ(k, off.x, off.y, off.z); }
      pos.setXYZ(k, v.x, v.y, v.z);
    }
    return g;
  }

  // ---- painted primitives (white-cell UVs) ----
  const box = (w, h, d, hex) => paint(new THREE.BoxGeometry(w, h, d), hex);
  /** box given by its min/max corners */
  const boxAt = (x0, x1, y0, y1, z0, z1, hex) => place(box(x1 - x0, y1 - y0, z1 - z0, hex), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const rbox = (w, h, d, r, hex, seg = 2) => paint(roundedBox(w, h, d, r, seg), hex);
  const rboxAt = (x0, x1, y0, y1, z0, z1, r, hex, seg = 2) => place(rbox(x1 - x0, y1 - y0, z1 - z0, r, hex, seg), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const cyl = (rt, rb, h, hex, seg = 12, open = false) => paint(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), hex);
  /** cylinder whose axis is the x axis (pins, bosses) */
  const pinX = (r, len, hex, seg = 12) => place(cyl(r, r, len, hex, seg), 0, 0, 0, 0, 0, Math.PI / 2);
  const sphere = (r, hex, ws = 10, hs = 8) => paint(new THREE.SphereGeometry(r, ws, hs), hex);

  /** rounded rectangle outline into a Shape or Path */
  function roundRect(target, x0, y0, x1, y1, r) {
    r = Math.max(1e-3, Math.min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3));
    target.moveTo(x0 + r, y0);
    target.lineTo(x1 - r, y0); target.quadraticCurveTo(x1, y0, x1, y0 + r);
    target.lineTo(x1, y1 - r); target.quadraticCurveTo(x1, y1, x1 - r, y1);
    target.lineTo(x0 + r, y1); target.quadraticCurveTo(x0, y1, x0, y1 - r);
    target.lineTo(x0, y0 + r); target.quadraticCurveTo(x0, y0, x0 + r, y0);
    return target;
  }

  /** polygon with rounded corners (pts: [[x, y, r?], ...] counter-clockwise) into a Shape */
  function roundPoly(pts, rDefault = 0.05) {
    const s = new THREE.Shape();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
      const r0 = b[2] != null ? b[2] : rDefault;
      const d1x = a[0] - b[0], d1y = a[1] - b[1], d2x = c[0] - b[0], d2y = c[1] - b[1];
      const l1 = Math.hypot(d1x, d1y) || 1, l2 = Math.hypot(d2x, d2y) || 1;
      const r = Math.min(r0, l1 * 0.45, l2 * 0.45);
      const p1x = b[0] + (d1x / l1) * r, p1y = b[1] + (d1y / l1) * r;
      const p2x = b[0] + (d2x / l2) * r, p2y = b[1] + (d2y / l2) * r;
      if (i === 0) s.moveTo(p1x, p1y); else s.lineTo(p1x, p1y);
      if (r > 1e-4) s.quadraticCurveTo(b[0], b[1], p2x, p2y);
    }
    s.closePath();
    return s;
  }

  /** extrude a Shape (in its x-y plane) along +z; the result spans z ∈ [0, depth] including the bevels */
  function extrude(shape, depth, bevel = 0, curveSegments = 5) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(1e-3, depth - 2 * bevel), curveSegments, steps: 1,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: bevel > 0 ? 2 : 0,
    });
    if (bevel > 0) g.translate(0, 0, bevel);
    return g;
  }

  /** lumpy flat-shaded blob (crumpled paper, crushed chunks) */
  function lump(radius, detail, jitter, seed, sy = 1) {
    const r = rng(seed);
    let g = new THREE.IcosahedronGeometry(radius, detail);
    // jitter by direction so that duplicated vertices stay welded
    const p = g.attributes.position;
    const key = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = `${Math.round(p.getX(i) * 1e3)},${Math.round(p.getY(i) * 1e3)},${Math.round(p.getZ(i) * 1e3)}`;
      let f = key.get(k);
      if (f === undefined) { f = 1 + (r() - 0.5) * 2 * jitter; key.set(k, f); }
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * sy, p.getZ(i) * f);
    }
    g.computeVertexNormals(); // non-indexed → flat facets
    return g;
  }

  /** triangle count */
  const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

  return { paint, shade, uvRect, worldUV, place, merge, roundedBox, box, boxAt, rbox, rboxAt, cyl, pinX, sphere, roundRect, roundPoly, extrude, lump, tris };
}
