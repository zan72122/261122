// geom.js — parametric geometry helpers and the procedural food shapes.
(function () {
  'use strict';
  const T = THREE;
  const G = window.G;
  const TAU = Math.PI * 2;

  const sgnpow = (x, e) => (x < 0 ? -Math.pow(-x, e) : Math.pow(x, e));

  // Parametric surface P(u,v) with u around (closed) and v from bottom pole to top pole.
  // Normals come from finite differences of P (seamless), with a fallback at poles,
  // so normalize() in the shader never sees a zero vector (no NaN).
  function surface(fn, nu, nv, colorFn, opt) {
    opt = opt || {};
    const closed = opt.closed !== false;
    const u0 = opt.u0 || 0, u1 = opt.u1 === undefined ? 1 : opt.u1;
    const cols = nu + 1, rows = nv + 1;
    const pos = new Float32Array(cols * rows * 3);
    const nor = new Float32Array(cols * rows * 3);
    const col = new Float32Array(cols * rows * 3);
    const uv = new Float32Array(cols * rows * 2);
    const P = new T.Vector3(), Pu = new T.Vector3(), Pv = new T.Vector3(), A = new T.Vector3(), B = new T.Vector3(), N = new T.Vector3();
    const eps = 1e-3;
    const c = [1, 1, 1];
    for (let j = 0; j < rows; j++) {
      const v = j / nv;
      for (let i = 0; i < cols; i++) {
        const u = u0 + (u1 - u0) * (i / nu);
        const k = j * cols + i;
        fn(u, v, P);
        fn(u + eps, v, A); fn(u - eps, v, B); Pu.subVectors(A, B);
        const va = Math.min(1, v + eps), vb = Math.max(0, v - eps);
        fn(u, va, A); fn(u, vb, B); Pv.subVectors(A, B);
        N.crossVectors(Pu, Pv);
        if (N.lengthSq() < 1e-14) {
          // pole: point straight up/down, or away from the axis
          N.set(P.x * 0.2, v > 0.5 ? 1 : -1, P.z * 0.2);
        }
        N.normalize();
        // outward: compare with direction from the local axis point
        A.set(P.x - (opt.cx || 0), P.y - (opt.cy !== undefined ? opt.cy : P.y * 0.5), P.z - (opt.cz || 0));
        if (A.lengthSq() > 1e-10 && N.dot(A) < 0) N.negate();
        pos[k * 3] = P.x; pos[k * 3 + 1] = P.y; pos[k * 3 + 2] = P.z;
        nor[k * 3] = N.x; nor[k * 3 + 1] = N.y; nor[k * 3 + 2] = N.z;
        if (colorFn) colorFn(P, u, v, N, c); else { c[0] = c[1] = c[2] = 1; }
        col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
        uv[k * 2] = (opt.uvU || 1) * (i / nu); uv[k * 2 + 1] = (opt.uvV || 1) * v;
      }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setIndex(idx);
    fixWinding(g);
    return g;
  }

  // Make triangle winding agree with the vertex normals (front faces outward).
  function fixWinding(g) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
    let score = 0;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), f = new T.Vector3();
    for (let t = 0; t < ix.length; t += 3) {
      const i0 = ix[t] * 3, i1 = ix[t + 1] * 3, i2 = ix[t + 2] * 3;
      a.set(p[i0], p[i0 + 1], p[i0 + 2]); b.set(p[i1], p[i1 + 1], p[i1 + 2]); c.set(p[i2], p[i2 + 1], p[i2 + 2]);
      f.subVectors(b, a).cross(c.sub(a));
      score += Math.sign(f.x * n[i0] + f.y * n[i0 + 1] + f.z * n[i0 + 2]);
    }
    if (score < 0) {
      const arr = g.index.array;
      for (let t = 0; t < arr.length; t += 3) { const tmp = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = tmp; }
      g.index.needsUpdate = true;
    }
  }

  // Replace any zero / NaN normal with a safe up vector.
  function safeNormals(g) {
    const n = g.attributes.normal;
    if (!n) return g;
    const a = n.array;
    for (let i = 0; i < a.length; i += 3) {
      const l = a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2];
      if (!(l > 1e-12)) { a[i] = 0; a[i + 1] = 1; a[i + 2] = 0; }
      else if (Math.abs(l - 1) > 1e-3) { const s = 1 / Math.sqrt(l); a[i] *= s; a[i + 1] *= s; a[i + 2] *= s; }
    }
    n.needsUpdate = true;
    return g;
  }

  // Ensure a geometry has position/normal/uv/color and an index (for merging).
  function prep(g, color) {
    if (!g.index) {
      const n = g.attributes.position.count, ix = new Array(n);
      for (let i = 0; i < n; i++) ix[i] = i;
      g.setIndex(ix);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color || color) {
      const cnt = g.attributes.position.count, a = new Float32Array(cnt * 3);
      const cc = color || [1, 1, 1];
      for (let i = 0; i < cnt; i++) { a[i * 3] = cc[0]; a[i * 3 + 1] = cc[1]; a[i * 3 + 2] = cc[2]; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
    }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    safeNormals(g);
    return g;
  }
  function merge(list) {
    const out = T.mergeGeometries(list.map((g) => prep(g)), false);
    list.forEach((g) => g.dispose());
    return safeNormals(out);
  }
  // Move so bottom is at y=0 and centred in xz; returns geometry.
  function ground(g) {
    g.computeBoundingBox();
    const b = g.boundingBox;
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }

  // Generic blob: superellipsoid with radial modulation and displacement.
  function blob(o) {
    const e1 = o.e1 || 1, e2 = o.e2 || 1;
    const fn = (u, v, P) => {
      const th = u * TAU, ph = -Math.PI / 2 + Math.PI * v;
      const cp = sgnpow(Math.cos(ph), e1), sp = sgnpow(Math.sin(ph), e1);
      const ct = sgnpow(Math.cos(th), e2), st = sgnpow(Math.sin(th), e2);
      const R = o.radial ? o.radial(th, v) : 1;
      let x = o.rx * cp * ct * R, y = o.ry * sp, z = o.rz * cp * st * R;
      if (o.disp) {
        const d = o.disp(th, ph, v);
        const l = Math.sqrt(x * x + y * y + z * z) || 1;
        x += (x / l) * d; y += (y / l) * d; z += (z / l) * d;
      }
      P.set(x, y + (o.y || 0), z);
    };
    return surface(fn, o.nu, o.nv, o.color, { cy: o.y || 0, uvU: o.uvU, uvV: o.uvV });
  }

  // cheap value noise from sines (deterministic per seed)
  function wob(a, b, s) {
    return Math.sin(a * 3.1 + s) * Math.sin(b * 2.7 + s * 1.7) * 0.5 + Math.sin(a * 7.3 + b * 5.1 + s * 3.3) * 0.3 + Math.sin(a * 13.1 - b * 11.7 + s) * 0.2;
  }
  const mix3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; };

  function starShape(n, r0, r1) {
    const s = new T.Shape();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU + Math.PI / 2, r = i % 2 ? r1 : r0;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
  }
  function heartShape(r) {
    const s = new T.Shape();
    s.moveTo(0, -r);
    s.bezierCurveTo(r * 0.2, -r * 0.6, r * 1.1, -r * 0.3, r * 1.0, r * 0.25);
    s.bezierCurveTo(r * 0.95, r * 0.8, r * 0.25, r * 0.95, 0, r * 0.45);
    s.bezierCurveTo(-r * 0.25, r * 0.95, -r * 0.95, r * 0.8, -r * 1.0, r * 0.25);
    s.bezierCurveTo(-r * 1.1, -r * 0.3, -r * 0.2, -r * 0.6, 0, -r);
    return s;
  }
  function roundRectShape(ax, az, r) {
    r = Math.min(r, ax, az);
    const s = new T.Shape();
    s.moveTo(-ax + r, -az);
    s.lineTo(ax - r, -az); s.absarc(ax - r, -az + r, r, -Math.PI / 2, 0, false);
    s.lineTo(ax, az - r); s.absarc(ax - r, az - r, r, 0, Math.PI / 2, false);
    s.lineTo(-ax + r, az); s.absarc(-ax + r, az - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-ax, -az + r); s.absarc(-ax + r, -az + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function roundRectPath(ax, az, r) {
    r = Math.min(r, ax, az);
    const p = new T.Path();
    p.moveTo(-ax + r, -az);
    p.lineTo(ax - r, -az); p.absarc(ax - r, -az + r, r, -Math.PI / 2, 0, false);
    p.lineTo(ax, az - r); p.absarc(ax - r, az - r, r, 0, Math.PI / 2, false);
    p.lineTo(-ax + r, az); p.absarc(-ax + r, az - r, r, Math.PI / 2, Math.PI, false);
    p.lineTo(-ax, -az + r); p.absarc(-ax + r, -az + r, r, Math.PI, Math.PI * 1.5, false);
    return p;
  }

  // ================= foods =================
  // Each builder returns a grounded geometry (bottom y=0, centred) with vertex colours.
  const F = {};

  F.onigiri = function () {
    // rounded triangle, lying flat; nori band wraps one flat side (vertex colour x rice texture)
    const nori = [0.10, 0.16, 0.11], rice = [1, 1, 1];
    const g = blob({
      rx: 0.5, ry: 0.19, rz: 0.5, e1: 0.55, e2: 1, nu: 32, nv: 10,
      radial: (th) => 1 / (1 + 0.2 * Math.cos(3 * th)) * 0.86,
      disp: (th, ph) => 0.006 * Math.sin(th * 23) * Math.cos(ph * 9),
      color: (P, u, v, N, c) => mix3(rice, rice, 0, c),
    });
    // planar uv from above: no pinching at the pole
    const p = g.attributes.position.array, uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = p[i * 3] * 1.3 + 0.5; uv[i * 2 + 1] = p[i * 3 + 2] * 1.3 + 0.5 + p[i * 3 + 1] * 0.6; }
    // nori: a thin rounded slab wrapping the flat side at +x (crisp edges, same material)
    const nb = blob({ rx: 0.1, ry: 0.198, rz: 0.22, e1: 0.45, e2: 0.25, nu: 12, nv: 6, color: (P, u, v, N, c) => mix3(nori, nori, 0, c) });
    nb.translate(0.29, 0, 0);
    const nuv = nb.attributes.uv.array, np = nb.attributes.position.array;
    for (let i = 0; i < nuv.length / 2; i++) { nuv[i * 2] = np[i * 3 + 2] * 2 + 0.3; nuv[i * 2 + 1] = np[i * 3 + 1] * 2 + 0.3; }
    return ground(merge([g, nb]));
  };

  F.tamago = function () {
    // rolled omelette: superellipsoid around the long axis; spiral on the ends
    const yel = [1.0, 0.74, 0.12], light = [1.0, 0.95, 0.62], brown = [0.86, 0.5, 0.12];
    const g = blob({
      rx: 0.24, ry: 0.42, rz: 0.21, e1: 0.28, e2: 0.42, nu: 24, nv: 14,
      color: (P, u, v, N, c) => {
        const th = u * TAU;
        const endness = Math.abs(N.y);
        const rho = Math.sqrt(P.x * P.x / 0.0576 + P.z * P.z / 0.0441);
        const sp = G.smooth(0.5 + 0.9 * Math.sin(th + rho * 15));
        mix3(yel, light, sp * G.smooth((endness - 0.5) / 0.25), c);
        const top = G.smooth(P.z / 0.21 * 0.5 + 0.2) * (1 - endness);
        const n = 0.5 + 0.5 * wob(th * 2, v * 6, 1.3);
        mix3(c, brown, 0.35 * top * n, c);
      },
    });
    g.rotateZ(Math.PI / 2); // long axis -> x
    g.rotateX(-Math.PI / 2);
    return ground(g);
  };

  F.karaage = function () {
    const a = [0.80, 0.47, 0.16], b = [0.55, 0.27, 0.07], hi = [0.95, 0.68, 0.30];
    const g = blob({
      rx: 0.34, ry: 0.24, rz: 0.31, nu: 22, nv: 12,
      disp: (th, ph) => 0.045 * wob(th * 1.3, ph * 1.6, 2.0) + 0.02 * Math.sin(th * 9 + ph * 5),
      color: (P, u, v, N, c) => {
        const n = wob(u * 9, v * 7, 4.2);
        mix3(a, b, G.clamp(0.5 + n * 0.8, 0, 1), c);
        if (n > 0.55) mix3(c, hi, 0.5, c);
      },
    });
    return ground(g);
  };

  F.sausage = function () {
    const red = [0.93, 0.27, 0.20], cut = [1.0, 0.62, 0.50], black = [0.08, 0.05, 0.05];
    const parts = [];
    // body: cylinder + dome (lathe style surface)
    const body = surface((u, v, P) => {
      const th = u * TAU;
      const y = 0.2 + v * 0.38;
      let r = 0.17;
      if (v > 0.55) { const t = (v - 0.55) / 0.45; r = 0.17 * Math.sqrt(Math.max(0, 1 - t * t)); }
      P.set(Math.cos(th) * r, v > 0.55 ? 0.2 + 0.55 * 0.38 + (v - 0.55) / 0.45 * 0.16 : y, Math.sin(th) * r);
    }, 14, 8, (P, u, v, N, c) => { c[0] = red[0]; c[1] = red[1]; c[2] = red[2]; }, { cy: 0.3 });
    parts.push(body);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(ca * 0.12, 0.24, sa * 0.12),
        new T.Vector3(ca * 0.2, 0.1, sa * 0.2),
        new T.Vector3(ca * 0.33, 0.05, sa * 0.33),
        new T.Vector3(ca * 0.42, 0.13, sa * 0.42),
      ]);
      const leg = new T.TubeGeometry(curve, 5, 0.05, 4, false);
      prep(leg);
      const cc = leg.attributes.color.array, pp = leg.attributes.position.array;
      for (let i = 0; i < cc.length / 3; i++) {
        const r = Math.hypot(pp[i * 3], pp[i * 3 + 2]);
        const t = G.smooth((r - 0.2) / 0.22) * 0.55;
        cc[i * 3] = red[0] + (cut[0] - red[0]) * t; cc[i * 3 + 1] = red[1] + (cut[1] - red[1]) * t; cc[i * 3 + 2] = red[2] + (cut[2] - red[2]) * t;
      }
      parts.push(leg);
    }
    for (const s of [-1, 1]) {
      const e = new T.SphereGeometry(0.028, 6, 4);
      e.translate(s * 0.065, 0.4, 0.165);
      prep(e, black); parts.push(e);
    }
    return ground(merge(parts));
  };

  F.broccoli = function () {
    // stem + a dome of knobbly florets
    const stem = [0.70, 0.85, 0.46], dark = [0.13, 0.42, 0.12], lite = [0.34, 0.64, 0.22];
    const s = new T.CylinderGeometry(0.08, 0.11, 0.3, 8, 1, true);
    s.translate(0, 0.15, 0); prep(s, stem);
    const parts = [s];
    const fl = [[0, 0.42, 0, 0.17], [0.17, 0.33, 0.06, 0.14], [-0.16, 0.34, 0.08, 0.14], [0.04, 0.33, -0.17, 0.14], [-0.06, 0.31, 0.18, 0.13], [-0.13, 0.3, -0.12, 0.12]];
    fl.forEach((f, k) => {
      const b = blob({
        rx: f[3], ry: f[3] * 0.85, rz: f[3], y: 0, nu: 10, nv: 6,
        disp: (th, ph) => 0.022 * Math.abs(Math.sin(th * 4 + k) * Math.sin(ph * 4 + 0.3)),
        color: (P, u, v, N, c) => { mix3(dark, lite, Math.abs(Math.sin(u * 40 + k) * Math.sin(v * 25)) * 0.7, c); if (v < 0.35) mix3(c, stem, (0.35 - v) * 2, c); },
      });
      b.translate(f[0], f[1], f[2]);
      parts.push(b);
    });
    return ground(merge(parts));
  };

  F.tomato = function () {
    const red = [0.95, 0.12, 0.10], grn = [0.22, 0.55, 0.15];
    const body = blob({
      rx: 0.25, ry: 0.22, rz: 0.25, nu: 20, nv: 10,
      radial: (th) => 1 + 0.025 * Math.cos(5 * th),
      color: (P, u, v, N, c) => { c[0] = red[0]; c[1] = red[1]; c[2] = red[2]; },
    });
    const cal = new T.ExtrudeGeometry(starShape(5, 0.12, 0.045), { depth: 0.015, bevelEnabled: false, curveSegments: 2 });
    cal.rotateX(-Math.PI / 2); cal.translate(0, 0.205, 0); prep(cal, grn);
    const st = new T.CylinderGeometry(0.014, 0.018, 0.07, 5, 1);
    st.translate(0, 0.25, 0); prep(st, grn);
    return ground(merge([body, cal, st]));
  };

  F.strawberry = function () {
    const red = [0.92, 0.10, 0.16], seed = [1.0, 0.86, 0.45], grn = [0.25, 0.6, 0.18], white = [1.0, 0.85, 0.80];
    const body = surface((u, v, P) => {
      const th = u * TAU;
      const r = 0.25 * Math.pow(Math.sin(Math.PI * v), 0.55) * (0.55 + 0.45 * v) * (1 + 0.02 * Math.cos(th * 6));
      const y = -0.28 + 0.5 * v + (v > 0.85 ? -(v - 0.85) * 0.3 : 0);
      P.set(Math.cos(th) * r, y, Math.sin(th) * r);
    }, 20, 12, (P, u, v, N, c) => {
      mix3(red, white, G.smooth((v - 0.8) / 0.2) * 0.35, c);
      const fu = (u * 12 + (Math.floor(v * 9) % 2) * 0.5) % 1, fv = (v * 9) % 1;
      if (v > 0.12 && v < 0.85 && Math.abs(fu - 0.5) < 0.2 && Math.abs(fv - 0.5) < 0.25) mix3(c, seed, 0.85, c);
    }, { cy: 0 });
    const lv = new T.ExtrudeGeometry(starShape(6, 0.17, 0.06), { depth: 0.012, bevelEnabled: false, curveSegments: 2 });
    lv.rotateX(-Math.PI / 2); lv.translate(0, 0.21, 0); prep(lv, grn);
    const g = merge([body, lv]);
    g.rotateZ(Math.PI / 2 - 0.25); // lying on its side, tip pointing +x and a bit down
    return ground(g);
  };

  F.hamburg = function () {
    const meat = [0.50, 0.29, 0.15], dark = [0.36, 0.18, 0.08], sauce = [0.36, 0.11, 0.04], shine = [0.62, 0.25, 0.10];
    const patty = blob({
      rx: 0.42, ry: 0.13, rz: 0.38, e1: 0.55, y: 0.13, nu: 24, nv: 8,
      disp: (th, ph) => 0.012 * wob(th * 2, ph * 2, 5.1),
      color: (P, u, v, N, c) => mix3(meat, dark, G.clamp(0.5 + wob(u * 11, v * 9, 1.1), 0, 1) * 0.7, c),
    });
    const sau = blob({
      rx: 0.36, ry: 0.06, rz: 0.32, e1: 0.6, y: 0.235, nu: 24, nv: 5,
      radial: (th) => 1 + 0.08 * Math.sin(th * 5) + 0.05 * Math.sin(th * 9 + 1),
      color: (P, u, v, N, c) => mix3(sauce, shine, G.smooth((N.y - 0.9) / 0.1) * 0.35, c),
    });
    return ground(merge([patty, sau]));
  };

  // ================= picks =================
  function pickGeo(kind) {
    const stick = new T.CylinderGeometry(0.012, 0.012, 0.42, 5, 1);
    stick.translate(0, 0.21, 0); prep(stick, [1, 1, 1]);
    let top;
    if (kind === 0) top = new T.ExtrudeGeometry(heartShape(0.1), { depth: 0.035, bevelEnabled: false, curveSegments: 5 });
    else if (kind === 1) top = new T.ExtrudeGeometry(starShape(5, 0.12, 0.055), { depth: 0.035, bevelEnabled: false, curveSegments: 2 });
    else top = new T.SphereGeometry(0.07, 10, 8);
    if (kind !== 2) top.translate(0, 0, -0.0175);
    top.translate(0, 0.46, 0);
    prep(top, [1, 1, 1]);
    return merge([stick, top]);
  }

  // ================= box =================
  // Variant: {ax, az, r, H, wall}. Returns walls+floor geometry with lacquer-style uv.
  function boxGeo(V) {
    const outer = roundRectShape(V.ax, V.az, V.r);
    outer.holes.push(roundRectPath(V.ax - V.wall, V.az - V.wall, Math.max(0.02, V.r - V.wall)));
    const walls = new T.ExtrudeGeometry(outer, { depth: V.H, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
    walls.rotateX(-Math.PI / 2);
    const floor = new T.ExtrudeGeometry(roundRectShape(V.ax - 0.01, V.az - 0.01, V.r), { depth: 0.06, bevelEnabled: false, curveSegments: 10 });
    floor.rotateX(-Math.PI / 2);
    const g = merge([walls, floor]);
    const uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i++) uv[i] *= 0.35;
    return g;
  }
  function lidGeo(V) {
    const t = 0.12;
    const top = new T.ExtrudeGeometry(roundRectShape(V.ax + 0.04, V.az + 0.04, V.r + 0.04), { depth: t, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
    top.rotateX(-Math.PI / 2);
    const g = merge([top]);
    const uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i++) uv[i] *= 0.35;
    return g;
  }

  G.geo = { surface, blob, prep, merge, ground, safeNormals, starShape, heartShape, roundRectShape, roundRectPath, pickGeo, boxGeo, lidGeo, foods: F, wob };
})();
