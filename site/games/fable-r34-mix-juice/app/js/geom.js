/* geom: parametric shapes — fruits, animals, blender, cups. All built from formulas. */
(function () {
  'use strict';
  var MJ = window.MJ, M = MJ.M;
  var G = (MJ.G = {});
  var V3 = THREE.Vector3;
  var _c = new THREE.Color();

  // ---------- generic helpers ----------
  // Make sure a geometry has position, normal, uv, color, texMix (fruit layout) or drop uv/texMix (plain layout).
  G.prep = function (geo, color, texMix, keepUv) {
    var n = geo.attributes.position.count;
    if (!keepUv) { geo.deleteAttribute('uv'); geo.deleteAttribute('uv1'); geo.deleteAttribute('uv2'); }
    else if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.color) {
      var col = new Float32Array(n * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    if (color !== undefined && color !== null) G.paint(geo, color);
    if (keepUv) {
      var tm = new Float32Array(n); tm.fill(texMix || 0);
      geo.setAttribute('texMix', new THREE.BufferAttribute(tm, 1));
    }
    return geo;
  };
  // colour: hex, THREE.Color, or fn(p:V3, n:V3) -> hex/Color
  G.paint = function (geo, color) {
    var pos = geo.attributes.position, nor = geo.attributes.normal, col = geo.attributes.color;
    var p = new V3(), nn = new V3();
    for (var i = 0; i < pos.count; i++) {
      var c = color;
      if (typeof color === 'function') { p.fromBufferAttribute(pos, i); nn.fromBufferAttribute(nor, i); c = color(p, nn, i); }
      if (c && c.isColor) _c.copy(c); else _c.setHex(c);
      col.setXYZ(i, _c.r, _c.g, _c.b);
    }
    col.needsUpdate = true;
    return geo;
  };
  G.xf = function (geo, o) {
    o = o || {};
    if (o.s) geo.scale(o.s[0], o.s[1], o.s[2]);
    if (o.r) { var m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.r[0], o.r[1], o.r[2], o.order || 'XYZ')); geo.applyMatrix4(m); }
    if (o.p) geo.translate(o.p[0], o.p[1], o.p[2]);
    return geo;
  };
  // average normals of vertices that share a position (fixes lathe seams/poles after deformation)
  G.weldNormals = function (geo) {
    var pos = geo.attributes.position, nor = geo.attributes.normal, map = new Map();
    for (var i = 0; i < pos.count; i++) {
      var k = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
      var e = map.get(k); if (!e) { e = [0, 0, 0, []]; map.set(k, e); }
      e[0] += nor.getX(i); e[1] += nor.getY(i); e[2] += nor.getZ(i); e[3].push(i);
    }
    map.forEach(function (e) {
      var l = Math.hypot(e[0], e[1], e[2]) || 1;
      for (var j = 0; j < e[3].length; j++) nor.setXYZ(e[3][j], e[0] / l, e[1] / l, e[2] / l);
    });
    nor.needsUpdate = true;
    return geo;
  };
  G.merge = function (list) {
    var g = THREE.mergeGeometries(list, false);
    list.forEach(function (x) { x.dispose(); });
    return g;
  };
  function tri(x) { var f = x - Math.floor(x); return 1 - Math.abs(1 - 2 * f); }

  // Lathe with atlas-aware, seamless (mirrored) UVs and an optional deform(p, phi, t).
  // pts: array of [r, y] from bottom to top.
  G.lathe = function (pts, segs, o) {
    o = o || {};
    var rows = pts.length, cols = segs + 1;
    var pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2);
    var lens = [0];
    for (var j = 1; j < rows; j++) lens.push(lens[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    var L = lens[rows - 1] || 1, rect = o.uvRect || [0, 0, 1, 1], K = o.mirrorK || 1;
    var p = new V3();
    for (var i = 0; i < cols; i++) {
      var phi = (i / segs) * Math.PI * 2, s = Math.sin(phi), c = Math.cos(phi);
      for (j = 0; j < rows; j++) {
        var idx = i * rows + j;
        p.set(pts[j][0] * s, pts[j][1], pts[j][0] * c);
        if (o.deform) o.deform(p, phi, lens[j] / L, j);
        pos[idx * 3] = p.x; pos[idx * 3 + 1] = p.y; pos[idx * 3 + 2] = p.z;
        var u = o.uvMode === 'plain' ? i / segs : tri((i / segs) * K);
        uv[idx * 2] = rect[0] + (rect[2] - rect[0]) * u;
        uv[idx * 2 + 1] = rect[1] + (rect[3] - rect[1]) * (lens[j] / L);
      }
    }
    var index = [];
    for (i = 0; i < segs; i++) for (j = 0; j < rows - 1; j++) {
      var a = j + i * rows, b = j + i * rows + rows, cc = j + i * rows + rows + 1, d = j + i * rows + 1;
      index.push(a, b, d, cc, d, b);
    }
    var g = new THREE.BufferGeometry();
    g.setIndex(index);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    G.weldNormals(g);
    return g;
  };
  // 2D spline profile helper: control points [[r,y],...] -> n points
  G.spline = function (ctrl, n) {
    var curve = new THREE.SplineCurve(ctrl.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
    return curve.getPoints(n).map(function (v) { return [Math.max(v.x, 0), v.y]; });
  };
  G.ellip = function (r, ws, hs) { return new THREE.SphereGeometry(r || 1, ws || 16, hs || 12); };

  // ---------- fruits ----------
  var Q = 0.012;
  var RECT = {
    strawberry: [Q, 0.5 + Q, 0.5 - Q, 1 - Q], banana: [0.5 + Q, 0.5 + Q, 1 - Q, 1 - Q],
    mikan: [Q, Q, 0.5 - Q, 0.5 - Q], kiwi: [0.5 + Q, Q, 1 - Q, 0.5 - Q]
  };
  // flesh = juice colour (sRGB hex). tray: display rotation; size: hit radius
  G.FRUITS = {
    strawberry: { flesh: 0xff2f55, chunk: 0xff4a6a, pitch: 1.15, rot: [0.25, 0.4, -0.5], hit: 0.7, lift: 0.18 },
    banana: { flesh: 0xffe27a, chunk: 0xfff1b8, pitch: 0.9, rot: [0.2, 0, 0.0], hit: 0.85, lift: 0.18 },
    mikan: { flesh: 0xff9a12, chunk: 0xffae3a, pitch: 1.0, rot: [0.15, 0.3, 0], hit: 0.7, lift: 0 },
    kiwi: { flesh: 0x7fd23c, chunk: 0x8fdc4f, pitch: 1.25, rot: [0.95, 0, 0], hit: 0.7, lift: 0.36 },
    grape: { flesh: 0x8a35c9, chunk: 0x9b4fd6, pitch: 0.8, rot: [0.2, 0, 0], hit: 0.75, lift: 0 },
    peach: { flesh: 0xff9a86, chunk: 0xffc0a0, pitch: 1.05, rot: [0.1, -0.5, 0], hit: 0.7, lift: 0 }
  };
  G.FRUIT_ORDER = ['strawberry', 'banana', 'mikan', 'kiwi', 'grape', 'peach'];

  function leaf(len, wid, thick, color, ws) {
    var g = G.ellip(1, ws || 8, 5); G.xf(g, { s: [len, thick, wid], p: [len * 0.95, 0, 0] });
    return G.prep(g, color, 0, true);
  }
  function cyl(r0, r1, h, seg, color) { return G.prep(new THREE.CylinderGeometry(r1, r0, h, seg || 8, 1), color, 0, true); }

  function strawberry(d) {
    var prof = G.spline([[0, 0], [0.14, 0.09], [0.33, 0.33], [0.5, 0.68], [0.53, 0.86], [0.42, 1.0], [0.2, 1.06], [0, 1.07]], Math.round(18 * d) + 6);
    var body = G.lathe(prof, 4 * Math.round(5 * d + 3), { uvRect: RECT.strawberry, mirrorK: 2 });
    G.prep(body, 0xffffff, 1, true);
    var parts = [body];
    var n = 7;
    for (var i = 0; i < n; i++) {
      var l = leaf(0.27, 0.1, 0.03, 0x3e9e3a);
      G.xf(l, { r: [0, (i / n) * Math.PI * 2, -0.28], order: 'YXZ' }); G.xf(l, { p: [0, 1.04, 0] });
      parts.push(l);
    }
    parts.push(G.xf(cyl(0.04, 0.03, 0.24, 6, 0x4f8a2a), { r: [0, 0, 0.2], p: [0.02, 1.15, 0] }));
    return G.merge(parts);
  }
  function banana(d) {
    var nA = Math.round(20 * d) + 8, nC = 10, rows = nA + 1, cols = nC + 1;
    var pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), col = new Float32Array(rows * cols * 3), tm = new Float32Array(rows * cols);
    var rect = RECT.banana, brown = new THREE.Color(0x6b4a26), white = new THREE.Color(0xffffff), cc = new THREE.Color();
    for (var a = 0; a < rows; a++) {
      var t = a / nA, ang = M.lerp(-0.95, 0.95, t), Rc = 0.95;
      var cx = Rc * Math.sin(ang), cy = Rc * (1 - Math.cos(ang));
      var nx = -Math.sin(ang), ny = Math.cos(ang);
      var rad = 0.21 * Math.pow(Math.max(Math.sin(Math.PI * t), 0), 0.42);
      var dark = Math.max(M.smooth(0.1, 0.0, t), M.smooth(0.9, 1.0, t));
      cc.copy(white).lerp(brown, dark);
      for (var c = 0; c < cols; c++) {
        var phi = (c / nC) * Math.PI * 2, rr = rad * (1 - 0.07 * Math.cos(5 * phi));
        var k = a * cols + c;
        pos[k * 3] = cx + rr * Math.cos(phi) * nx; pos[k * 3 + 1] = cy + rr * Math.cos(phi) * ny; pos[k * 3 + 2] = rr * Math.sin(phi);
        uv[k * 2] = rect[0] + (rect[2] - rect[0]) * tri(c / nC); uv[k * 2 + 1] = rect[1] + (rect[3] - rect[1]) * t;
        col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b; tm[k] = 1 - dark;
      }
    }
    var index = [];
    for (a = 0; a < nA; a++) for (c = 0; c < nC; c++) {
      var i0 = a * cols + c, i1 = i0 + 1, i2 = i0 + cols, i3 = i2 + 1;
      index.push(i0, i2, i1, i1, i2, i3);
    }
    var g = new THREE.BufferGeometry(); g.setIndex(index);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('texMix', new THREE.BufferAttribute(tm, 1));
    g.computeVertexNormals(); G.weldNormals(g);
    // make normals face outward (winding check on a mid vertex)
    var mid = Math.floor(rows / 2) * cols, n0 = new V3().fromBufferAttribute(g.attributes.normal, mid);
    if (n0.dot(new V3(-Math.sin(0) * 1, Math.cos(0), 0)) < 0) {
      for (var ii = 0; ii < index.length; ii += 3) { var tmp = index[ii + 1]; index[ii + 1] = index[ii + 2]; index[ii + 2] = tmp; }
      g.setIndex(index); g.computeVertexNormals(); G.weldNormals(g);
    }
    var stemAng = 0.95, sx = 0.95 * Math.sin(stemAng), sy = 0.95 * (1 - Math.cos(stemAng));
    var stem = G.xf(cyl(0.055, 0.045, 0.26, 6, 0x7a5a2e), { r: [0, 0, -stemAng + 0.15], p: [sx + 0.1, sy + 0.09, 0] });
    var g2 = G.merge([g, stem]);
    g2.translate(0, 0.2, 0);
    return g2;
  }
  function mikan(d) {
    var n = Math.round(14 * d) + 6, pts = [];
    for (var i = 0; i <= n; i++) {
      var th = (i / n) * Math.PI, r = 0.55 * Math.sin(th), y = 0.47 * (1 - Math.cos(th));
      y -= 0.05 * Math.exp(-Math.pow(Math.sin(th), 2) / 0.03) * (th > 1.5 ? 1 : 0);
      pts.push([r, y]);
    }
    var body = G.prep(G.lathe(pts, 4 * Math.round(5 * d + 3), { uvRect: RECT.mikan, mirrorK: 2 }), 0xffffff, 1, true);
    var l = leaf(0.22, 0.11, 0.03, 0x3f9a3c); G.xf(l, { r: [0, 0.6, 0.25], p: [0.02, 0.9, 0] });
    var st = cyl(0.035, 0.03, 0.1, 6, 0x5b7d2c); G.xf(st, { p: [0, 0.92, 0] });
    return G.merge([body, l, st]);
  }
  function kiwi(d) {
    // dome (skin) below a cut face (y=0) — built face-up, unit radius, scaled at the end
    var n = Math.round(10 * d) + 5, pts = [];
    for (var i = 0; i <= n; i++) { var th = (1 - i / n) * Math.PI / 2; pts.push([Math.cos(th), -0.85 * Math.sin(th)]); }
    var dome = G.prep(G.lathe(pts, 4 * Math.round(5 * d + 3), { uvRect: RECT.kiwi, mirrorK: 2 }), 0xffffff, 1, true);
    // face: polar disc with ring colours
    var rings = [0, 0.2, 0.33, 0.5, 0.7, 0.84, 0.93, 1.0];
    var cols = [0xf6f3cf, 0xeef4bf, 0xb5e06b, 0x72c23a, 0x6cbd35, 0x93d257, 0xd3ea96, 0x8a6a3a];
    var segs = Math.round(32 * d) + 8, P = [], C = [], idx = [];
    for (var r = 0; r < rings.length; r++) for (var s = 0; s <= segs; s++) {
      var ph = (s / segs) * Math.PI * 2;
      P.push(rings[r] * Math.sin(ph), 0, rings[r] * Math.cos(ph));
      _c.setHex(cols[r]);
      if (r === 3 || r === 4) { var v = 0.9 + 0.12 * Math.sin(ph * 14 + r); _c.multiplyScalar(v); }
      C.push(_c.r, _c.g, _c.b);
    }
    for (r = 0; r < rings.length - 1; r++) for (s = 0; s < segs; s++) {
      var a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
    var face = new THREE.BufferGeometry(); face.setIndex(idx);
    face.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    face.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    face.computeVertexNormals();
    if (face.attributes.normal.getY(segs + 2) < 0) { // ensure the face looks up
      for (var k = 0; k < idx.length; k += 3) { var tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
      face.setIndex(idx); face.computeVertexNormals();
    }
    var nn = face.attributes.normal; for (k = 0; k < nn.count; k++) nn.setXYZ(k, 0, 1, 0);
    face.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nn.count * 2), 2));
    face.setAttribute('texMix', new THREE.BufferAttribute(new Float32Array(nn.count), 1));
    var parts = [dome, face];
    for (i = 0; i < 18; i++) {
      var ang = (i / 18) * Math.PI * 2 + (i % 2) * 0.12, rad = 0.4 + (i % 3) * 0.05;
      var sd = G.prep(G.ellip(1, 6, 4), 0x231c12, 0, true);
      G.xf(sd, { s: [0.035, 0.012, 0.065], r: [0, ang, 0], p: [rad * Math.sin(ang), 0.006, rad * Math.cos(ang)] });
      parts.push(sd);
    }
    var g = G.merge(parts);
    g.scale(0.5, 0.48, 0.42);
    return g;
  }
  function grape(d) {
    var ws = Math.round(10 * d) + 4, hs = Math.round(7 * d) + 3;
    var spots = [[0, 1.0, 0], [0.25, 0.94, 0], [-0.25, 0.94, 0], [0, 0.94, 0.25], [0, 0.94, -0.25],
      [0.17, 0.66, 0.17], [-0.17, 0.66, 0.17], [0.17, 0.66, -0.17], [-0.17, 0.66, -0.17],
      [0.14, 0.4, 0.05], [-0.12, 0.4, 0.09], [0.0, 0.4, -0.14], [0, 0.17, 0.02]];
    var base = [0x7b36ad, 0x8c45bf, 0x6b2b9a, 0x9a52c9];
    var parts = spots.map(function (s, i) {
      var g = G.ellip(0.175 * (0.94 + 0.12 * ((i * 7) % 5) / 5), ws, hs);
      var bc = new THREE.Color(base[i % 4]);
      G.prep(g, function (p, n) {
        var hl = M.smooth(-0.1, 0.95, n.y * 0.55 + n.z * 0.45);
        return new THREE.Color().copy(bc).multiplyScalar(0.7 + 0.55 * hl);
      }, 0, true);
      return G.xf(g, { p: s });
    });
    parts.push(G.xf(cyl(0.035, 0.028, 0.3, 6, 0x6b5a2a), { r: [0, 0, -0.25], p: [0.04, 1.25, 0] }));
    var l = leaf(0.26, 0.16, 0.025, 0x4fa64a); G.xf(l, { r: [0, -0.5, 0.35], p: [0.06, 1.25, 0] }); parts.push(l);
    var g = G.merge(parts); g.scale(0.92, 0.92, 0.92);
    return g;
  }
  function peach(d) {
    var n = Math.round(14 * d) + 6, pts = [];
    for (var i = 0; i <= n; i++) {
      var th = (i / n) * Math.PI;
      pts.push([0.56 * Math.sin(th), 0.55 * (1 - Math.cos(th)) + 0.05 * Math.exp(-Math.pow(th - Math.PI, 2) / 0.15)]);
    }
    var blushDir = new V3(0.35, 0.45, 0.82).normalize();
    var body = G.lathe(pts, 4 * Math.round(5 * d + 3), {
      uvMode: 'plain', deform: function (p, phi, t) {
        var dphi = Math.atan2(Math.sin(phi - 0.45), Math.cos(phi - 0.45));
        var k = 0.075 * Math.exp(-dphi * dphi / 0.02) * Math.sin(t * Math.PI);
        var r = Math.hypot(p.x, p.z), nr = Math.max(r - k, 0);
        if (r > 1e-5) { p.x *= nr / r; p.z *= nr / r; }
      }
    });
    var base = new THREE.Color(0xffd49a), blush = new THREE.Color(0xff6f86), bottom = new THREE.Color(0xfff0c8);
    G.prep(body, function (p, nn) {
      var b = M.smooth(-0.2, 0.85, nn.dot(blushDir));
      var c = new THREE.Color().copy(base).lerp(blush, b * 0.85);
      return c.lerp(bottom, M.smooth(-0.4, -0.95, nn.y) * 0.5);
    }, 0, true);
    var l = leaf(0.26, 0.12, 0.03, 0x46a043); G.xf(l, { r: [0, -0.4, 0.3], p: [0.02, 1.08, 0] });
    var st = cyl(0.035, 0.03, 0.12, 6, 0x6b4f2a); G.xf(st, { p: [0, 1.1, 0] });
    return G.merge([body, l, st]);
  }
  var BUILD = { strawberry: strawberry, banana: banana, mikan: mikan, kiwi: kiwi, grape: grape, peach: peach };
  var cache = {};
  G.fruitGeo = function (type, lod) {
    var key = type + lod;
    if (!cache[key]) {
      var d = (lod === 'hi' ? 1 : 0.5) * MJ.tier.detail;
      var g = BUILD[type](Math.max(d, 0.35));
      g.computeBoundingSphere();
      cache[key] = g;
    }
    return cache[key];
  };

  // crushed fruit chunk: lumpy blob
  G.chunkGeo = function () {
    var g = new THREE.IcosahedronGeometry(0.13, 1);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = THREE.mergeVertices(g);
    var p = g.attributes.position, v = new V3();
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      var k = 1 + 0.25 * Math.sin(v.x * 31 + v.y * 17) * Math.cos(v.z * 23 - v.x * 11);
      v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * 0.8, v.z);
    }
    g.computeVertexNormals();
    return g;
  };

  // ---------- animals ----------
  G.ANIMALS = {
    bear: { fur: 0xb8845a, light: 0xf5dcc0, inner: 0xe9a98a, ears: 'round', muzzle: 0xf5dcc0, nose: 0x4a2e22, pitch: 0.85 },
    rabbit: { fur: 0xf7f2ef, light: 0xffffff, inner: 0xffb0c4, ears: 'long', nose: 0xff7f9a, pitch: 1.3 },
    cat: { fur: 0xf6b66c, light: 0xfff0dc, inner: 0xffb1a3, ears: 'tri', nose: 0xff8a8a, pitch: 1.15, whisk: true },
    pig: { fur: 0xffbccb, light: 0xffd6df, inner: 0xff9fb4, ears: 'flop', snout: 0xff9fb6, pitch: 1.0 },
    panda: { fur: 0xfbfbfb, light: 0xffffff, inner: 0x333333, ears: 'round', earCol: 0x2d2d2d, patches: true, nose: 0x2d2d2d, armCol: 0x2d2d2d, muzzle: 0xffffff, pitch: 0.95 },
    chick: { fur: 0xffdf4d, light: 0xfff2a6, inner: 0xffc94d, ears: 'tuft', beak: 0xff9a3c, pitch: 1.5 }
  };
  G.ANIMAL_ORDER = ['bear', 'rabbit', 'cat', 'pig', 'panda', 'chick'];
  G.HEAD = { y: 1.78, R: 0.74 };

  function sp(r, ws, hs, o, color) { var g = G.ellip(r, ws || 14, hs || 10); G.xf(g, o); return G.prep(g, color); }
  // point on the (scaled) head surface facing forward
  function headPt(x, y, R, out) { var z = Math.sqrt(Math.max(R * R - x * x - y * y, 0.01)) * 0.95; return [x, y, z + (out || 0)]; }

  G.animal = function (type) {
    var A = G.ANIMALS[type], R = G.HEAD.R, d = MJ.tier.detail;
    var hw = Math.round(24 * d) + 6, hh = Math.round(18 * d) + 4;
    var head = [], eyes = [], happy = [], body, armG, mouthOpen;
    // head
    head.push(sp(R, hw, hh, { s: [1.0, 0.92, 0.95] }, A.fur));
    var earCol = A.earCol || A.fur;
    if (A.ears === 'round') {
      [-1, 1].forEach(function (s) {
        head.push(sp(0.27, 12, 9, { s: [1, 1, 0.75], p: [s * 0.52, 0.52, -0.05] }, earCol));
        head.push(sp(0.15, 10, 7, { s: [1, 1, 0.4], p: [s * 0.52, 0.5, 0.11] }, A.patches ? 0x444444 : A.inner));
      });
    } else if (A.ears === 'long') {
      [-1, 1].forEach(function (s) {
        head.push(sp(0.2, 12, 10, { s: [0.85, 3.0, 0.55], r: [0, 0, -s * 0.13], p: [s * 0.27, 1.12, -0.08] }, A.fur));
        head.push(sp(0.12, 10, 8, { s: [0.8, 3.4, 0.3], r: [0, 0, -s * 0.13], p: [s * 0.28, 1.12, 0.0] }, A.inner));
      });
    } else if (A.ears === 'tri') {
      [-1, 1].forEach(function (s) {
        var c = G.prep(new THREE.ConeGeometry(0.27, 0.46, 10), A.fur); G.xf(c, { s: [1, 1, 0.6], r: [0, 0, -s * 0.32], p: [s * 0.46, 0.66, -0.05] }); head.push(c);
        var c2 = G.prep(new THREE.ConeGeometry(0.16, 0.3, 8), A.inner); G.xf(c2, { s: [1, 1, 0.3], r: [0, 0, -s * 0.32], p: [s * 0.45, 0.62, 0.07] }); head.push(c2);
      });
    } else if (A.ears === 'flop') {
      [-1, 1].forEach(function (s) {
        var c = G.prep(new THREE.ConeGeometry(0.24, 0.38, 10), A.fur); G.xf(c, { s: [1, 1, 0.45], r: [0.6, 0, -s * 0.5], p: [s * 0.48, 0.6, 0.05] }); head.push(c);
      });
    } else if (A.ears === 'tuft') {
      [-0.12, 0, 0.12].forEach(function (x, i) { head.push(sp(0.11, 8, 6, { s: [0.7, 1.4, 0.7], r: [0, 0, -x * 2], p: [x, 0.72 + (i === 1 ? 0.05 : 0), 0] }, A.fur)); });
    }
    // face
    var eyeY = -0.02, eyeX = 0.27;
    if (A.patches) [-1, 1].forEach(function (s) { var p = headPt(s * eyeX, eyeY, R * 0.95, -0.02); head.push(sp(0.16, 12, 9, { s: [0.95, 1.15, 0.5], r: [0, 0, s * 0.5], p: p }, 0x2d2d2d)); });
    if (A.muzzle) { var mp = headPt(0, -0.25, R * 0.92); head.push(sp(0.3, 14, 10, { s: [1.1, 0.78, 0.6], p: mp }, A.muzzle)); }
    if (A.snout) { var sp0 = headPt(0, -0.22, R * 0.93); head.push(sp(0.2, 14, 8, { s: [1.25, 0.9, 0.55], p: sp0 }, A.snout));
      [-1, 1].forEach(function (s) { head.push(sp(0.04, 6, 4, { s: [0.8, 1.2, 0.4], p: [s * 0.08 + sp0[0], sp0[1], sp0[2] + 0.1] }, 0x9c4b5c)); }); }
    if (A.beak) { var bp = headPt(0, -0.18, R); var b = G.prep(new THREE.ConeGeometry(0.11, 0.2, 8), A.beak); G.xf(b, { r: [Math.PI / 2, 0, 0], s: [1, 1, 0.8], p: [bp[0], bp[1], bp[2] + 0.06] }); head.push(b); }
    if (A.nose) { var np = headPt(0, A.muzzle ? -0.12 : -0.13, R * (A.muzzle ? 1.12 : 0.98)); head.push(sp(0.07, 10, 7, { s: [1.3, 0.85, 0.7], p: np }, A.nose)); }
    // cheeks
    [-1, 1].forEach(function (s) { var cp = headPt(s * 0.47, -0.2, R * 0.97, -0.03); head.push(sp(0.12, 12, 8, { s: [1.2, 0.75, 0.35], r: [0, s * 0.55, 0], p: cp }, 0xff8fa8)); });
    // small smile
    var my = A.beak ? -0.33 : (A.muzzle ? -0.3 : -0.28);
    var mp2 = headPt(0, my, R * (A.muzzle ? 1.08 : 0.99));
    var smile = G.prep(new THREE.TorusGeometry(0.065, 0.017, 5, 10, Math.PI), 0x5a2f2a);
    G.xf(smile, { r: [0, 0, Math.PI], p: [mp2[0], mp2[1] + 0.05, mp2[2] + 0.01] }); head.push(smile);
    if (A.whisk) [-1, 1].forEach(function (s) { [0, 1].forEach(function (k) {
      var w = G.prep(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4), 0x8a6a5a);
      G.xf(w, { r: [0, 0, Math.PI / 2 + s * (k ? 0.15 : -0.08)], p: [s * 0.52, -0.18 - k * 0.07, 0.6] }); head.push(w); }); });
    // eyes (open) + highlights
    [-1, 1].forEach(function (s) {
      var ep = headPt(s * eyeX, eyeY, R * 0.96);
      eyes.push(sp(0.085, 12, 9, { s: [0.9, 1.08, 0.55], p: ep }, 0x1c1418));
      eyes.push(sp(0.03, 6, 4, { p: [ep[0] + 0.025, ep[1] + 0.035, ep[2] + 0.04] }, 0xffffff));
      var h = G.prep(new THREE.TorusGeometry(0.07, 0.02, 5, 10, Math.PI), 0x1c1418);
      G.xf(h, { p: [ep[0], ep[1] - 0.03, ep[2] + 0.02] }); happy.push(h);
    });
    var mo = sp(0.085, 10, 8, { s: [1, 0.8, 0.5], p: [mp2[0], mp2[1] + 0.01, mp2[2] + 0.03] }, 0xb83a4a);
    mouthOpen = mo;
    // body
    var light = new THREE.Color(A.light), fur = new THREE.Color(A.fur);
    body = G.ellip(1, Math.round(18 * d) + 6, Math.round(12 * d) + 4);
    G.xf(body, { s: [0.86, 1.0, 0.72], p: [0, 0.45, 0] });
    G.prep(body, function (p, n) { var k = M.smooth(0.45, 0.8, n.z) * M.smooth(1.3, 0.8, p.y); return new THREE.Color().copy(fur).lerp(light, k); });
    if (A.ears === 'tuft') G.paint(body, A.fur);
    // arm (pivot at shoulder, hangs down -y)
    armG = new THREE.CapsuleGeometry(0.15, 0.42, 4, 10);
    armG.translate(0, -0.33, 0);
    G.prep(armG, A.armCol || A.fur);
    return {
      head: G.merge(head), eyes: G.merge(eyes), happy: G.merge(happy), mouth: mouthOpen,
      body: body, arm: armG, cfg: A
    };
  };

  // ---------- blender / cups / props ----------
  G.JUG = { r0: 0.66, r1: 0.88, h: 2.25, spoutY: 2.25, spoutR: 1.02, liqY0: 0.2, liqY1: 2.1 };
  G.jugProfile = function (inset) {
    var J = G.JUG, pts = [];
    for (var i = 0; i <= 14; i++) {
      var t = i / 14, y = t * J.h;
      var r = M.lerp(J.r0, J.r1, Math.pow(t, 0.9)) - (inset || 0);
      pts.push([r, y]);
    }
    return pts;
  };
  G.spoutDeform = function (p, phi, t) {
    var y = p.y, k = M.smooth(1.65, 2.25, y) * Math.pow(Math.max(Math.sin(phi), 0), 10);
    var r = Math.hypot(p.x, p.z); if (r < 1e-5) return;
    var nr = r + 0.16 * k; p.x *= nr / r; p.z *= nr / r; p.y += 0.04 * k;
  };
  G.CUP = { r0: 0.47, r1: 0.59, h: 1.2, liqY0: 0.19, liqY1: 1.12 };
  G.cupProfile = function () {
    var C = G.CUP, pts = [[0, C.liqY0 - 0.01], [C.r0 - 0.03, C.liqY0 - 0.01]]; // glass floor (seen from above through BackSide)
    for (var i = 0; i <= 8; i++) { var t = i / 8; pts.push([M.lerp(C.r0, C.r1, t), t * C.h]); }
    return pts;
  };

  // Polar disc for liquid surfaces: attribute "polar" = (rn, theta)
  G.polarDisc = function (rings, segs) {
    var P = [], idx = [], pol = [];
    for (var r = 0; r <= rings; r++) for (var s = 0; s <= segs; s++) {
      var rn = r / rings, th = (s / segs) * Math.PI * 2;
      P.push(rn * Math.cos(th), 0, rn * Math.sin(th)); pol.push(rn, th);
    }
    for (r = 0; r < rings; r++) for (s = 0; s < segs; s++) {
      var a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    var g = new THREE.BufferGeometry(); g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('polar', new THREE.Float32BufferAttribute(pol, 2));
    g.boundingSphere = new THREE.Sphere(new V3(0, 1, 0), 3);
    return g;
  };
  // open tube for liquid side walls: attribute polar = (v 0..1, theta)
  G.polarTube = function (segs, rows) {
    var P = [], idx = [], pol = [];
    for (var r = 0; r <= rows; r++) for (var s = 0; s <= segs; s++) {
      var v = r / rows, th = (s / segs) * Math.PI * 2;
      P.push(Math.cos(th), v, Math.sin(th)); pol.push(v, th);
    }
    for (r = 0; r < rows; r++) for (s = 0; s < segs; s++) {
      var a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
    var g = new THREE.BufferGeometry(); g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('polar', new THREE.Float32BufferAttribute(pol, 2));
    g.boundingSphere = new THREE.Sphere(new V3(0, 1, 0), 3);
    return g;
  };
})();
