// foods.js — food types, instanced rendering, packing rule, sprinkles and picks.
(function () {
  'use strict';
  const T = THREE;
  const G = window.G;
  const TAU = Math.PI * 2;

  const TYPES = [
    { key: 'onigiri', mat: 'rice', top: 4 },
    { key: 'tamago', mat: 'matte', top: 6 },
    { key: 'karaage', mat: 'matte', top: 2 },
    { key: 'sausage', mat: 'glossy', top: 2 },
    { key: 'broccoli', mat: 'matte', top: 2 },
    { key: 'tomato', mat: 'glossy', top: 2 },
    { key: 'strawberry', mat: 'glossy', top: 2 },
    { key: 'hamburg', mat: 'glossy', top: 4 },
  ];
  const CAP = 48; // instances per food type (box + tray + flying)
  const PICK_COLORS = [0xff5a8a, 0xffc94a, 0x5ac8ff, 0x7be07b, 0xb98cff, 0xff8a4a];
  const SPR_COLORS = [0xffe14d, 0x2f6b2a, 0xff9fb0, 0xfff6e0, 0xffb347];

  const F = (G.food = {
    TYPES, items: [], display: [], sprinkles: [], falling: [], picks: [], loosePicks: [],
  });
  let mats = {}, meshes = [], pickMeshes = [], sprMesh = null;
  const _m = new T.Matrix4(), _m2 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _v = new T.Vector3();
  let nextId = 1;

  F.init = function (scene, riceTex) {
    mats.rice = new T.MeshStandardMaterial({ map: riceTex, vertexColors: true, roughness: 0.85, metalness: 0 });
    mats.matte = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
    mats.glossy = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0 });
    for (const t of TYPES) {
      const g = G.geo.foods[t.key]();
      g.computeBoundingBox();
      const b = g.boundingBox;
      t.r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.5 * 0.88;
      t.h = b.max.y - b.min.y;
      t.geo = g;
      t.tris = g.index.count / 3;
      const m = new T.InstancedMesh(g, mats[t.mat], CAP);
      m.count = 0; m.frustumCulled = false;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(m);
      meshes.push(m);
    }
    for (let k = 0; k < 3; k++) {
      const pm = new T.InstancedMesh(G.geo.pickGeo(k), mats.glossy, 40);
      pm.count = 0; pm.frustumCulled = false;
      pm.instanceColor = new T.InstancedBufferAttribute(new Float32Array(40 * 3), 3);
      scene.add(pm); pickMeshes.push(pm);
    }
    // picks: the shared vertex-colour material is white for picks, tinted by instance colour
    const sg = new T.TetrahedronGeometry(0.035, 0); // 4 triangles per grain
    sg.scale(1.2, 0.5, 0.9);
    G.geo.prep(sg, [1, 1, 1]);
    sprMesh = new T.InstancedMesh(sg, mats.matte, G.tier.sprinkles + 160);
    sprMesh.count = 0; sprMesh.frustumCulled = false;
    sprMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array((G.tier.sprinkles + 160) * 3), 3);
    scene.add(sprMesh);
  };

  // ---------- entities ----------
  F.make = function (type, opt) {
    const t = TYPES[type];
    const it = {
      id: nextId++, type, r: t.r, h: t.h,
      x: 0, y: 0, z: 0, rot: Math.random() * TAU, f: 1, squash: 1,
      px: 0, py: 0, pz: 0, pf: 1, prot: 0, tilt: 0,
      state: 'box', wobT: 9, wobA: 0, hopT: 9, scale: 1, fly: null, pick: null, glowT: 0,
    };
    Object.assign(it, opt || {});
    it.prot = it.rot;
    return it;
  };
  F.addDisplay = function (type, x, y, z, rot, scale) {
    const d = F.make(type, { space: 'world', x, y, z, px: x, py: y, pz: z, rot, scale: scale || 1, state: 'display' });
    F.display.push(d);
    return d;
  };
  F.wobble = function (it, a) { it.wobT = 0; it.wobA = a || 0.18; };
  F.hop = function (it) { it.hopT = 0; };

  // ---------- box shape (box-local, inner rounded rect) ----------
  // signed distance to the inner rounded rect shrunk by m
  function sdBox(x, z, B, m) {
    const ax = Math.max(0.01, B.ax - m), az = Math.max(0.01, B.az - m), rc = Math.max(0, Math.min(B.r - m, ax, az));
    const qx = Math.abs(x) - (ax - rc), qz = Math.abs(z) - (az - rc);
    const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
    return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - rc;
  }
  function clampInside(p, B, m) {
    const d = sdBox(p.x, p.z, B, m);
    if (d <= 0) return;
    const e = 1e-3;
    let gx = sdBox(p.x + e, p.z, B, m) - sdBox(p.x - e, p.z, B, m);
    let gz = sdBox(p.x, p.z + e, B, m) - sdBox(p.x, p.z - e, B, m);
    const gl = Math.hypot(gx, gz);
    if (gl < 1e-9) { p.x = 0; p.z = 0; return; }
    p.x -= (gx / gl) * d; p.z -= (gz / gl) * d;
  }
  F.sdBox = sdBox;
  F.inBox = function (x, z, margin) { return sdBox(x, z, G.bento.inner, 0) < (margin || 0); };

  // ---------- packing (no physics: overlap rule + relaxation) ----------
  // newcomer moves little, neighbours get pushed: "ぎゅっ".
  F.settle = function (newcomer) {
    const B = G.bento.inner;
    const items = F.items.filter((i) => i.state === 'box' || i === newcomer);
    if (!items.length) return 0;
    const area = Math.PI * B.r * B.r + (2 * B.ax) * (2 * B.az) - (4 - Math.PI) * B.r * B.r - Math.PI * B.r * B.r;
    let sum = 0;
    for (const i of items) sum += Math.PI * i.r * i.r;
    const f = G.clamp(Math.sqrt((0.82 * area) / Math.max(sum, 1e-6)), 0.66, 1);
    const before = items.map((i) => [i.x, i.z]);
    for (const i of items) i.f = f;
    for (let it = 0; it < 36; it++) {
      for (let a = 0; a < items.length; a++) {
        const A = items[a];
        for (let b = a + 1; b < items.length; b++) {
          const Bq = items[b];
          const need = (A.r + Bq.r) * f * 0.9;
          let dx = Bq.x - A.x, dz = Bq.z - A.z;
          let d = Math.hypot(dx, dz);
          if (d >= need) continue;
          if (d < 1e-5) { const ang = Math.random() * TAU; dx = Math.cos(ang); dz = Math.sin(ang); d = 1; }
          else { dx /= d; dz /= d; }
          const o = need - d;
          const wa = A === newcomer ? 0.15 : 1, wb = Bq === newcomer ? 0.15 : 1;
          const sa = (o * wa) / (wa + wb), sb = (o * wb) / (wa + wb);
          A.x -= dx * sa; A.z -= dz * sa; Bq.x += dx * sb; Bq.z += dz * sb;
        }
      }
      for (const i of items) clampInside(i, B, i.r * f * 0.82);
    }
    // stacking where it is still crowded (later items sit on earlier ones)
    const order = items.slice().sort((p, q) => p.id - q.id);
    for (let a = 0; a < order.length; a++) {
      const A = order[a];
      let y = 0;
      for (let b = 0; b < a; b++) {
        const Bq = order[b];
        const lim = (A.r + Bq.r) * f * 0.72;
        const d = Math.hypot(A.x - Bq.x, A.z - Bq.z);
        if (d < lim) y = Math.max(y, Bq.y + Bq.h * f * 0.5 * (1 - d / lim));
      }
      A.y = y;
    }
    // neighbours that moved wobble
    let moved = 0;
    items.forEach((i, k) => {
      if (i === newcomer) return;
      const m = Math.hypot(i.x - before[k][0], i.z - before[k][1]);
      if (m > 0.03) { F.wobble(i, Math.min(0.25, 0.08 + m * 0.6)); moved++; }
    });
    return moved;
  };

  // find a roomy spot in the box for a tapped food
  F.freeSpot = function (r) {
    const B = G.bento.inner;
    let best = null, bestScore = -1e9;
    for (let k = 0; k < 40; k++) {
      const p = { x: G.rand(-B.ax, B.ax), z: G.rand(-B.az, B.az) };
      clampInside(p, B, r * 0.8);
      let near = 9;
      for (const i of F.items) if (i.state === 'box') near = Math.min(near, Math.hypot(i.x - p.x, i.z - p.z) - i.r * i.f);
      const score = near - Math.hypot(p.x, p.z) * 0.08 + Math.random() * 0.05;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  };

  // height of the food's top at a normalised radius (0 centre .. 1 edge)
  function topAt(it, rn) {
    const e = TYPES[it.type].top;
    return it.h * Math.pow(Math.max(0, 1 - Math.pow(Math.min(rn, 1), e)), 1 / e) * 0.96;
  }
  F.topAt = topAt;

  // ---------- picks ----------
  F.newPick = function () { return { kind: (Math.random() * 3) | 0, color: G.pick(PICK_COLORS), tilt: G.rand(-0.25, 0.25), yaw: G.rand(-0.4, 0.4) }; };

  // ---------- sprinkles ----------
  // land a sprinkle at box-local (x,z): attach to the highest food there, else the floor
  F.landSprinkle = function (x, z, color) {
    let host = null, best = -1;
    for (const it of F.items) {
      if (it.state !== 'box') continue;
      const d = Math.hypot(x - it.x, z - it.z), rr = it.r * it.f;
      if (d < rr * 0.95) { const top = it.y + topAt(it, d / rr) * it.f * it.squash; if (top > best) { best = top; host = it; } }
    }
    const s = { color, rot: Math.random() * TAU, tilt: G.rand(-0.4, 0.4) };
    if (host) {
      const dx = x - host.x, dz = z - host.z, c = Math.cos(-host.rot), sn = Math.sin(-host.rot);
      s.host = host;
      s.ox = (dx * c + dz * sn) / host.f; s.oz = (-dx * sn + dz * c) / host.f;
      s.oy = topAt(host, Math.hypot(dx, dz) / (host.r * host.f)) + 0.006;
    } else { s.host = null; s.x = x; s.z = z; s.y = G.bento.floorY + 0.01; }
    F.sprinkles.push(s);
    if (F.sprinkles.length > G.tier.sprinkles) F.sprinkles.shift();
  };
  F.dropSprinkles = function (wx, wy, wz, n, spread) {
    // falling grains in world space, landing later in box-local space
    for (let i = 0; i < n; i++) {
      if (F.falling.length > 160) break;
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (spread || 0.35);
      F.falling.push({ x: wx + Math.cos(a) * r * 0.25, y: wy, z: wz + Math.sin(a) * r * 0.25, tx: wx + Math.cos(a) * r, tz: wz + Math.sin(a) * r, vy: -G.rand(0.5, 1.5), t: 0, color: G.pick(SPR_COLORS), rot: Math.random() * TAU });
    }
  };
  F.removeFor = function (it) {
    F.sprinkles = F.sprinkles.filter((s) => s.host !== it);
  };
  F.clearAll = function () {
    F.items.length = 0; F.sprinkles.length = 0; F.falling.length = 0;
    F.loosePicks = F.loosePicks.filter((lp) => lp.inCup);
  };

  // ---------- per-frame ----------
  const boxM = new T.Matrix4();
  const tmpColor = new T.Color();
  function itemMatrix(it, out) {
    // wobble: squash & stretch, decays
    let sx = it.pf * it.scale, sy = it.pf * it.scale * it.squash;
    if (it.wobT < 1.2) {
      const w = it.wobA * Math.sin(it.wobT * 22) * Math.exp(-it.wobT * 5);
      sx *= 1 + w; sy *= 1 - w * 1.2;
    }
    let hy = 0;
    if (it.hopT < 0.6) { const t = it.hopT / 0.6; hy = Math.sin(t * Math.PI) * 0.35; sy *= 1 + 0.15 * Math.sin(t * Math.PI * 2); }
    _e.set(it.tilt * 0.6, it.prot, it.tilt, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(it.px, it.py + hy, it.pz);
    _s.set(sx, Math.max(0.05, sy), sx);
    out.compose(_p, _q, _s);
    if (it.space !== 'world') out.premultiply(boxM);
    return out;
  }
  F.itemMatrix = itemMatrix;

  F.update = function (dt) {
    if (!G.bento) return;
    G.bento.group.updateMatrixWorld(true);
    boxM.copy(G.bento.group.matrixWorld);
    const counts = new Array(TYPES.length).fill(0);
    const pc = [0, 0, 0];
    const k = G.damp(16, dt);
    const showDisplay = G.state.scene === 'kitchen';
    const all = showDisplay ? F.display.concat(F.items) : F.items;
    for (const it of all) {
      it.wobT += dt; it.hopT += dt;
      if (it.state === 'box') {
        it.px += (it.x - it.px) * k; it.pz += (it.z - it.pz) * k;
        it.py += (G.bento.floorY + it.y - it.py) * k;
        it.pf += (it.f - it.pf) * k;
        it.prot += (it.rot - it.prot) * k;
        it.tilt *= 1 - k;
      } else if (it.state === 'drag') {
        it.px += (it.x - it.px) * G.damp(28, dt); it.pz += (it.z - it.pz) * G.damp(28, dt);
        it.py += (it.y - it.py) * G.damp(20, dt);
        it.pf += (1 - it.pf) * k;
      } else if (it.state === 'fly' && it.fly) {
        const fl = it.fly;
        fl.t += dt / fl.dur;
        const t = G.clamp(fl.t, 0, 1), e = t * t * (3 - 2 * t);
        it.px = G.lerp(fl.fx, fl.tx, e); it.pz = G.lerp(fl.fz, fl.tz, e);
        it.py = G.lerp(fl.fy, fl.ty, e) + Math.sin(t * Math.PI) * fl.arc;
        it.prot += dt * (fl.spin || 0);
        if (fl.shrink) it.scale = Math.max(0.01, 1 - G.smooth((t - 0.6) / 0.4));
        if (fl.t >= 1) { it.fly = null; const cb = fl.done; it.state = fl.after || 'box'; if (cb) cb(it); }
      } else if (it.state === 'display') {
        // static on the tray
      }
      if (it.state === 'gone') continue;
      const ti = it.type;
      if (counts[ti] >= CAP) continue;
      itemMatrix(it, _m);
      meshes[ti].setMatrixAt(counts[ti]++, _m);
      if (it.pick && pc[it.pick.kind] < 40) {
        // stick the pick into the food's top
        _v.set(0, it.h * 0.55, 0).applyMatrix4(_m);
        // keep picks under a closing lid (they pop back up when it opens)
        if (it.space !== 'world' && G.bento.lidP > 0.35) {
          const lim = G.bento.group.position.y + G.bento.V.H - 0.42;
          const k2 = G.smooth((G.bento.lidP - 0.35) / 0.3);
          if (_v.y > lim) _v.y = G.lerp(_v.y, lim, k2);
        }
        writePick(it.pick, _v.x, _v.y, _v.z, pc, it.space === 'world' ? 0 : G.bento.yaw);
      }
    }
    F.items = F.items.filter((i) => i.state !== 'gone');
    // loose picks (in the cup, dragged, or standing on the box floor)
    for (const lp of F.loosePicks) {
      if (pc[lp.pick.kind] >= 40) continue;
      if (lp.space === 'box') { _v.set(lp.x, lp.y, lp.z).applyMatrix4(boxM); writePick(lp.pick, _v.x, _v.y, _v.z, pc, G.bento.yaw); }
      else writePick(lp.pick, lp.x, lp.y, lp.z, pc, 0);
    }
    meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    pickMeshes.forEach((m, i) => { m.count = pc[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });

    // sprinkles: falling then settled
    let n = 0;
    const cap = G.tier.sprinkles + 160;
    for (let i = F.falling.length - 1; i >= 0; i--) {
      const s = F.falling[i];
      s.t += dt; s.vy -= 9 * dt; s.y += s.vy * dt;
      s.x += (s.tx - s.x) * G.damp(4, dt); s.z += (s.tz - s.z) * G.damp(4, dt);
      // convert target to box-local to find the landing height
      _v.set(s.x, s.y, s.z);
      const inv = _m2.copy(boxM).invert();
      _v.applyMatrix4(inv);
      let ground = G.bento.floorY;
      if (F.inBox(_v.x, _v.z, 0)) {
        for (const it of F.items) {
          if (it.state !== 'box') continue;
          const d = Math.hypot(_v.x - it.x, _v.z - it.z), rr = it.r * it.f;
          if (d < rr * 0.95) ground = Math.max(ground, G.bento.floorY + it.y + topAt(it, d / rr) * it.f * it.squash);
        }
      } else ground = -0.2;
      if (_v.y <= ground || s.t > 2) {
        F.falling.splice(i, 1);
        if (F.inBox(_v.x, _v.z, 0)) F.landSprinkle(_v.x, _v.z, s.color);
        continue;
      }
      if (n < cap) {
        _e.set(s.t * 9, s.rot, s.t * 7); _q.setFromEuler(_e);
        _m.compose(_p.set(s.x, s.y, s.z), _q, _s.set(1, 1, 1));
        sprMesh.setMatrixAt(n, _m); sprMesh.instanceColor.setXYZ(n, ...hexRGB(s.color)); n++;
      }
    }
    for (const s of F.sprinkles) {
      if (n >= cap) break;
      if (s.host) {
        const h = s.host;
        if (h.state === 'gone' || h.scale < 0.05) continue;
        itemMatrix(h, _m2);
        _v.set(s.ox, s.oy, s.oz).applyMatrix4(_m2);
        _e.set(s.tilt, h.prot + s.rot + (h.space === 'world' ? 0 : G.bento.yaw), 0);
      } else {
        _v.set(s.x, s.y, s.z).applyMatrix4(boxM);
        _e.set(s.tilt * 0.2, s.rot + G.bento.yaw, 0);
      }
      _q.setFromEuler(_e);
      _m.compose(_v, _q, _s.set(1, 1, 1));
      sprMesh.setMatrixAt(n, _m); sprMesh.instanceColor.setXYZ(n, ...hexRGB(s.color)); n++;
    }
    sprMesh.count = n;
    sprMesh.instanceMatrix.needsUpdate = true;
    sprMesh.instanceColor.needsUpdate = true;
  };

  const rgbCache = {};
  function hexRGB(h) {
    if (!rgbCache[h]) { tmpColor.setHex(h); rgbCache[h] = [tmpColor.r, tmpColor.g, tmpColor.b]; }
    return rgbCache[h];
  }
  function writePick(pk, x, y, z, pc, yaw) {
    const m = pickMeshes[pk.kind];
    _e.set(pk.tilt * 0.5, (pk.yaw || 0) + (G.state.scene === 'kitchen' ? 0 : 0), pk.tilt, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y - 0.15, z), _q, _s.set(1.45, 1.1, 1.45));
    m.setMatrixAt(pc[pk.kind], _m);
    m.instanceColor.setXYZ(pc[pk.kind], ...hexRGB(pk.color));
    pc[pk.kind]++;
  }
  F.PICK_COLORS = PICK_COLORS;
  F.meshes = () => meshes;
})();
