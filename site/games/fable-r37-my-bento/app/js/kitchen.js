// kitchen.js — the counter scene and the bento set (box, lid, napkin, knot).
(function () {
  'use strict';
  const T = THREE;
  const G = window.G;
  const TAU = Math.PI * 2;

  // Box variants cycle with "もう1回".
  const VARIANTS = [
    { ax: 1.6, az: 1.1, r: 0.28, H: 0.55, wall: 0.1, lacquer: true, color: 0xffffff, inside: 0x7a1a12, napkin: ['#ff8fb1', '#ffffff', 'dots'], lidDeco: null },
    { ax: 1.62, az: 1.08, r: 1.0, H: 0.55, wall: 0.1, lacquer: false, color: 0xff9ec0, inside: 0xfff3f6, napkin: ['#7cc8ff', '#ffffff', 'stars'], lidDeco: 'heart' },
    { ax: 1.6, az: 1.1, r: 0.62, H: 0.55, wall: 0.1, lacquer: false, color: 0x8fd0ff, inside: 0xf2fbff, napkin: ['#ffd84a', '#ff9f43', 'flowers'], lidDeco: 'star' },
  ];

  let shadowTex = null;
  function getShadowTex() {
    if (shadowTex) return shadowTex;
    shadowTex = G.canvasTex(64, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(60,30,10,0.55)'); gr.addColorStop(0.55, 'rgba(60,30,10,0.28)'); gr.addColorStop(1, 'rgba(60,30,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }, 'shadow', false);
    return shadowTex;
  }
  let shadowMat = null;
  G.shadowMat = function () {
    if (!shadowMat) shadowMat = new T.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false });
    return shadowMat;
  };
  G.shadowPlane = function (sx, sz) {
    const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, G.shadowMat());
    m.scale.set(sx, 1, sz); m.renderOrder = 1;
    return m;
  };

  function napkinTex(spec) {
    const [base, fg, kind] = spec;
    const tex = G.canvasTex(256, (g, s) => {
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      g.fillStyle = fg;
      const n = 6;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = (i + 0.5 + (j % 2) * 0.5) * (s / n), y = (j + 0.5) * (s / n);
        g.save(); g.translate(x % s, y);
        if (kind === 'dots') { g.beginPath(); g.arc(0, 0, s / n * 0.18, 0, TAU); g.fill(); }
        else if (kind === 'stars') {
          g.beginPath();
          for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, r = (k % 2 ? 0.09 : 0.22) * s / n; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          g.fill();
        } else {
          for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(Math.cos(a) * s / n * 0.13, Math.sin(a) * s / n * 0.13, s / n * 0.1, 0, TAU); g.fill(); }
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, s / n * 0.08, 0, TAU); g.fill(); g.fillStyle = fg;
        }
        g.restore();
      }
    }, 'napkin');
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    return tex;
  }

  // ================= bento set =================
  function buildBento(scene, lacquerTex) {
    const B = (G.bento = {
      group: new T.Group(), variant: -1, yaw: 0, floorY: 0.072,
      lidP: 0, lidFrom: 0, lidTo: 0, lidAnimT: 1, lidHome: new T.Vector3(0, 0, -3.35), lidHomeYaw: 0,
      corners: [0, 0, 0, 0], cornerTo: [0, 0, 0, 0], cornerRank: [0, 0, 0, 0], foldCount: 0,
      knot: 0, knotTo: 0, napkinDirty: true, lacquerTex, onLidDone: [],
    });
    scene.add(B.group);
    B.boxMat = new T.MeshStandardMaterial({ roughness: 0.32, metalness: 0 });
    B.insideMat = new T.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    B.lidMat = new T.MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
    B.napMat = new T.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: T.DoubleSide });
    B.boxMesh = new T.Mesh(new T.BufferGeometry(), B.boxMat);
    B.boxMesh.position.y = 0.012;
    B.floorMesh = new T.Mesh(new T.BufferGeometry(), B.insideMat);
    B.lid = new T.Group();
    B.lidMesh = new T.Mesh(new T.BufferGeometry(), B.lidMat);
    B.lid.add(B.lidMesh);
    B.lidShadow = G.shadowPlane(1, 1);
    B.group.add(B.lidShadow);
    B.boxShadow = G.shadowPlane(1, 1);
    B.boxShadow.position.y = 0.002;
    B.nap = new T.Mesh(new T.BufferGeometry(), B.napMat);
    B.knotG = new T.Group();
    B.group.add(B.boxShadow, B.nap, B.boxMesh, B.floorMesh, B.lid, B.knotG);
    setVariant(0);
    return B;
  }

  function setVariant(i) {
    const B = G.bento;
    const V = VARIANTS[i % VARIANTS.length];
    if (B.variant === i % VARIANTS.length && B.V) return;
    B.variant = i % VARIANTS.length; B.V = V;
    // dispose the old shapes (variants are rebuilt on demand)
    [B.boxMesh, B.floorMesh, B.lidMesh, B.nap].forEach((m) => m.geometry.dispose());
    B.knotG.children.forEach((c) => c.geometry.dispose());
    B.knotG.clear();
    if (B.napTex) B.napTex.dispose();
    if (B.decoMesh) { B.decoMesh.geometry.dispose(); B.lid.remove(B.decoMesh); B.decoMesh = null; }

    B.boxMesh.geometry = G.geo.boxGeo(V);
    B.lidMesh.geometry = G.geo.lidGeo(V);
    const fl = new T.ShapeGeometry(G.geo.roundRectShape(V.ax - V.wall, V.az - V.wall, Math.max(0.02, V.r - V.wall)), 8);
    fl.rotateX(-Math.PI / 2);
    B.floorMesh.geometry = G.geo.prep(fl);
    B.floorMesh.position.y = 0.012 + 0.061;
    const useTex = V.lacquer && B.lacquerTex;
    B.boxMat.map = useTex ? B.lacquerTex : null; B.boxMat.color.setHex(V.color); B.boxMat.needsUpdate = true;
    B.lidMat.map = useTex ? B.lacquerTex : null; B.lidMat.color.setHex(V.color); B.lidMat.needsUpdate = true;
    B.insideMat.color.setHex(V.inside);
    B.boxShadow.scale.set(V.ax * 2 + 0.9, 1, V.az * 2 + 0.9);
    if (V.lidDeco) {
      const sh = V.lidDeco === 'heart' ? G.geo.heartShape(0.42) : G.geo.starShape(5, 0.5, 0.22);
      const dg = new T.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 6 });
      dg.rotateX(-Math.PI / 2);
      G.geo.prep(dg, [1, 1, 1]);
      B.decoMesh = new T.Mesh(dg, B.decoMat || (B.decoMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })));
      B.decoMesh.position.y = 0.15;
      B.lid.add(B.decoMesh);
    }
    B.inner = { ax: V.ax - V.wall, az: V.az - V.wall, r: Math.max(0.02, V.r - V.wall) };
    B.wrapH = V.H + 0.012 + 0.2;
    // napkin grid
    B.NX = V.ax + 1.25; B.NZ = V.az + 1.25;
    const pg = new T.PlaneGeometry(B.NX * 2, B.NZ * 2, 30, 24);
    pg.rotateX(-Math.PI / 2);
    G.geo.prep(pg, [1, 1, 1]);
    const uv = pg.attributes.uv.array;
    for (let k = 0; k < uv.length; k++) uv[k] *= 3.2;
    pg.attributes.position.setUsage(T.DynamicDrawUsage);
    pg.attributes.normal.setUsage(T.DynamicDrawUsage);
    B.napFlat = Float32Array.from(pg.attributes.position.array);
    B.nap.geometry = pg;
    B.nap.position.y = 0.004;
    B.napTex = napkinTex(V.napkin);
    B.napMat.map = B.napTex; B.napMat.needsUpdate = true;
    // knot (bow) in napkin colour
    const kc = new T.Color(V.napkin[0]);
    B.knotMat = B.knotMat || new T.MeshStandardMaterial({ roughness: 0.9 });
    B.knotMat.color.copy(kc);
    const center = new T.SphereGeometry(0.16, 12, 8); center.scale(1, 0.8, 1);
    const loopL = new T.SphereGeometry(0.2, 12, 8); loopL.scale(1.5, 0.75, 0.9); loopL.rotateZ(0.5); loopL.translate(-0.33, 0.12, 0);
    const loopR = new T.SphereGeometry(0.2, 12, 8); loopR.scale(1.5, 0.75, 0.9); loopR.rotateZ(-0.5); loopR.translate(0.33, 0.12, 0);
    const tail1 = new T.SphereGeometry(0.12, 8, 6); tail1.scale(0.9, 0.35, 2.0); tail1.rotateY(0.6); tail1.translate(0.18, -0.06, 0.3);
    const tail2 = new T.SphereGeometry(0.12, 8, 6); tail2.scale(0.9, 0.35, 2.0); tail2.rotateY(-0.6); tail2.translate(-0.18, -0.06, 0.3);
    const kg = G.geo.merge([center, loopL, loopR, tail1, tail2]);
    kg.scale(1.6, 1.6, 1.6);
    const knot = new T.Mesh(kg, B.knotMat);
    B.knotG.add(knot);
    B.knotG.position.set(0, B.wrapH + 0.08, 0);
    B.napkinDirty = true;
    setLidHome(B.lidMode || 'kitchen');
  }

  // ---- lid path: p=0 at home (beside the box), p=1 closed on top ----
  // home poses: kitchen = standing behind the box (drag it toward you to close),
  // picnic = put aside on the right, turned sideways.
  function setLidHome(mode) {
    const B = G.bento, V = B.V;
    const az = V.az + 0.07, th = 1.31;
    if (mode === 'kitchen') {
      const baseZ = -(V.az + 0.4);
      B.lidHome.set(0, Math.sin(th) * az + 0.01, baseZ - Math.cos(th) * az);
      B.lidHomeRotX = th; B.lidHomeYaw = 0;
      B.lidShadowHome = { x: 0, z: baseZ - 0.15, sx: V.ax * 2 + 0.5, sz: 0.9 };
    } else {
      B.lidHome.set(V.ax + 0.3 + az, 0.01, 0.05);
      B.lidHomeRotX = 0; B.lidHomeYaw = Math.PI / 2 - 0.1;
      B.lidShadowHome = { x: B.lidHome.x, z: 0.05, sx: V.az * 2 + 0.6, sz: V.ax * 2 + 0.6 };
    }
    B.lidMode = mode;
  }
  function lidPose(p) {
    const B = G.bento, H = B.V.H + 0.012;
    const e = G.smooth(p);
    const h = B.lidHome;
    B.lid.position.set(G.lerp(h.x, 0, e), G.lerp(h.y, H, e) + Math.sin(Math.PI * e) * 0.9, G.lerp(h.z, 0, e));
    B.lid.rotation.set(G.lerp(B.lidHomeRotX, 0, e), G.lerp(B.lidHomeYaw, 0, e), 0);
    const sh = B.lidShadowHome;
    B.lidShadow.position.set(G.lerp(sh.x, 0, e), 0.003, G.lerp(sh.z, 0, e));
    const full = B.lidMode === 'kitchen';
    B.lidShadow.scale.set(G.lerp(sh.sx, B.V.ax * 2 + 0.6, full ? e : 0), 1, G.lerp(sh.sz, B.V.az * 2 + 0.6, full ? e : 0));
    B.lidShadow.visible = p < 0.97;
  }

  // ---- napkin wrap: per-vertex blend between flat and wrapped ----
  // returns travel on top (0..1) in out[k+2]
  function wrapAxis(a, b, D, H, out, k) {
    const d = Math.abs(a) - b, s = a < 0 ? -1 : 1;
    out[k + 2] = 0;
    if (d <= 0) { out[k] = a; out[k + 1] = 0; return 0; }
    if (d <= H) { out[k] = s * (b + 0.03); out[k + 1] = d; return d; }
    const t = Math.min(1, (d - H) / Math.max(0.05, D - H));
    out[k] = s * (b + 0.03) * (1 - 1.04 * t); out[k + 1] = H; out[k + 2] = t; return d;
  }
  const wx3 = [0, 0, 0], wz3 = [0, 0, 0];
  function updateNapkin() {
    const B = G.bento, V = B.V;
    const geo = B.nap.geometry, pos = geo.attributes.position.array, flat = B.napFlat;
    const bx = V.ax + 0.02, bz = V.az + 0.02, H = B.wrapH;
    const Dx = B.NX - bx, Dz = B.NZ - bz;
    const ranks = B.cornerRank;
    const c = B.corners;
    for (let i = 0; i < pos.length; i += 3) {
      const x = flat[i], z = flat[i + 2];
      const wx = G.smooth((x / bx) * 0.5 + 0.5), wz = G.smooth((z / bz) * 0.5 + 0.5);
      // corners: 0 back-left, 1 back-right, 2 front-left, 3 front-right
      const w0 = (1 - wx) * (1 - wz), w1 = wx * (1 - wz), w2 = (1 - wx) * wz, w3 = wx * wz;
      const t = w0 * c[0] + w1 * c[1] + w2 * c[2] + w3 * c[3];
      if (t <= 0.0005) { pos[i] = x; pos[i + 1] = 0; pos[i + 2] = z; continue; }
      const dx = wrapAxis(x, bx, Dx, H, wx3, 0);
      const dz = wrapAxis(z, bz, Dz, H, wz3, 0);
      const X = wx3[0], Z = wz3[0];
      let y = Math.max(wx3[1], wz3[1]);
      if (y >= H - 1e-4) {
        // on top: gathered folds converging to the knot, puffing up near the middle
        const tr = Math.max(wx3[2], wz3[2]);
        const ang = Math.atan2(Z, X);
        y += 0.014 * (w0 * ranks[0] + w1 * ranks[1] + w2 * ranks[2] + w3 * ranks[3]);
        y += tr * (0.05 * Math.sin(ang * 16) + 0.16 * tr);
      }
      const e = t * t * (3 - 2 * t);
      const lift = Math.sin(Math.PI * e) * 0.45 * Math.min(1, (dx + dz) / 1.2);
      pos[i] = x + (X - x) * e;
      pos[i + 1] = y * e + lift;
      pos[i + 2] = z + (Z - z) * e;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    G.geo.safeNormals(geo);
  }

  B_api();
  function B_api() {
    G.bentoApi = {
      setVariant, lidPose, updateNapkin, setLidHome, VARIANTS,
      animateLid(to, dur) { const B = G.bento; B.lidFrom = B.lidP; B.lidTo = to; B.lidAnimT = 0; B.lidDur = dur || 0.55; },
      foldCorner(i, to) {
        const B = G.bento;
        if (to > 0 && B.cornerTo[i] === 0) { B.foldCount++; B.cornerRank[i] = B.foldCount; }
        B.cornerTo[i] = to;
        if (to === 0) { B.cornerRank[i] = 0; }
        B.napkinDirty = true;
      },
      cornerWorld(i, out) {
        const B = G.bento;
        const sx = i % 2 ? 1 : -1, sz = i >= 2 ? 1 : -1;
        out.set(sx * B.NX * 0.86, 0.02, sz * B.NZ * 0.86);
        return B.group.localToWorld(out);
      },
      allFolded() { return G.bento.cornerTo.every((c) => c > 0); },
      anyFolded() { return G.bento.cornerTo.some((c) => c > 0); },
      update(dt) {
        const B = G.bento;
        if (B.lidAnimT < 1) {
          B.lidAnimT = Math.min(1, B.lidAnimT + dt / B.lidDur);
          B.lidP = G.lerp(B.lidFrom, B.lidTo, G.smooth(B.lidAnimT));
          if (B.lidAnimT >= 1 && B.onLidDone && B.onLidDone.length) { const fs = B.onLidDone; B.onLidDone = []; fs.forEach((f) => f()); }
        }
        lidPose(B.lidP);
        if (B.lidHopT !== undefined && B.lidHopT < 0.5) B.lid.position.y += Math.sin(B.lidHopT / 0.5 * Math.PI) * 0.3;
        let moving = false;
        for (let i = 0; i < 4; i++) {
          const d = B.cornerTo[i] - B.corners[i];
          if (Math.abs(d) > 1e-4) { B.corners[i] += Math.sign(d) * Math.min(Math.abs(d), dt / 0.5); moving = true; }
        }
        if (moving || B.napkinDirty) { updateNapkin(); B.napkinDirty = false; }
        B.knot += (B.knotTo - B.knot) * G.damp(10, dt);
        const ks = B.knotTo > 0 ? G.easeOutBack(B.knot) : B.knot;
        B.knotG.scale.setScalar(Math.max(0.001, ks));
        B.knotG.visible = B.knot > 0.01;
        // bundle bounce
        if (B.bounceT !== undefined && B.bounceT < 0.6) {
          B.bounceT += dt;
          const t = B.bounceT / 0.6;
          const s = 1 + Math.sin(t * Math.PI * 2) * 0.06 * (1 - t);
          B.group.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
        } else B.group.scale.set(1, 1, 1);
      },
      bounce() { G.bento.bounceT = 0; },
    };
  }

  // ================= kitchen scene =================
  function plateGeo() {
    const pts = [
      new T.Vector2(0.0, 0.0), new T.Vector2(0.42, 0.0), new T.Vector2(0.5, 0.02), new T.Vector2(0.62, 0.08),
      new T.Vector2(0.7, 0.12), new T.Vector2(0.72, 0.11), new T.Vector2(0.64, 0.06), new T.Vector2(0.5, 0.035), new T.Vector2(0.0, 0.035),
    ];
    const g = new T.LatheGeometry(pts, 28);
    return g;
  }

  G.buildKitchen = function (tex) {
    const scene = G.scene;
    const K = (G.kitchen = { group: new T.Group(), trays: [], hot: {} });
    scene.add(K.group);
    // lights (shared by both scenes)
    const hemi = new T.HemisphereLight(0xfff4e6, 0xa88a6a, 1.5);
    const dir = new T.DirectionalLight(0xffffff, 1.9);
    dir.position.set(3, 9, 5);
    scene.add(hemi, dir);
    G.lights = { hemi, dir };

    // counter: one low-poly plane, 512² wood photo texture
    const wood = tex.wood;
    if (wood) { wood.repeat.set(5, 5); }
    const counter = new T.Mesh(new T.PlaneGeometry(44, 44), new T.MeshLambertMaterial({ map: wood || null, color: wood ? 0xffffff : 0xd9a66b }));
    counter.rotation.x = -Math.PI / 2;
    K.group.add(counter);

    buildBento(scene, tex.lacquer);

    // trays: merged plates (1 draw call) with pastel rims
    K.plateMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: T.DoubleSide });
    K.platesMesh = new T.Mesh(new T.BufferGeometry(), K.plateMat);
    K.group.add(K.platesMesh);
    K.staticShadow = new T.Mesh(new T.BufferGeometry(), G.shadowMat());
    K.staticShadow.renderOrder = 1;
    K.group.add(K.staticShadow);

    // shaker (furikake) and pick cup
    const sb = new T.CylinderGeometry(0.22, 0.24, 0.5, 18, 1); sb.translate(0, 0.25, 0);
    G.geo.prep(sb);
    { const c = sb.attributes.color.array, p = sb.attributes.position.array;
      for (let i = 0; i < c.length / 3; i++) { const y = p[i * 3 + 1]; const band = y > 0.14 && y < 0.36; c[i * 3] = band ? 0.35 : 1.0; c[i * 3 + 1] = band ? 0.75 : 0.86; c[i * 3 + 2] = band ? 0.35 : 0.35; } }
    const cap = new T.CylinderGeometry(0.235, 0.235, 0.14, 18, 1); cap.translate(0, 0.57, 0); G.geo.prep(cap, [0.95, 0.3, 0.35]);
    const holes = [];
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, r = k ? 0.12 : 0; const h = new T.CylinderGeometry(0.025, 0.025, 0.01, 6); h.translate(Math.cos(a) * r, 0.645, Math.sin(a) * r); G.geo.prep(h, [0.3, 0.1, 0.1]); holes.push(h); }
    K.shaker = new T.Mesh(G.geo.merge([sb, cap, ...holes]), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
    K.shakerShadow = G.shadowPlane(1.2, 1.2);
    K.group.add(K.shaker, K.shakerShadow);
    K.shakerHome = new T.Vector3();
    K.shakerT = 9;

    const cupPts = [new T.Vector2(0, 0), new T.Vector2(0.22, 0), new T.Vector2(0.26, 0.04), new T.Vector2(0.28, 0.32), new T.Vector2(0.25, 0.32), new T.Vector2(0.23, 0.05), new T.Vector2(0, 0.05)];
    const cg = new T.LatheGeometry(cupPts, 18); G.geo.prep(cg, [0.6, 0.85, 1.0]);
    K.cup = new T.Mesh(cg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, side: T.DoubleSide }));
    K.group.add(K.cup);
    K.cupPicks = [];

    G.layoutKitchen();
    G.resizeHooks.push(() => { if (G.state.scene === 'kitchen') G.layoutKitchen(); });
    return K;
  };

  // Landscape: trays in two columns on each side. Portrait: rows above and below.
  G.layoutKitchen = function () {
    const K = G.kitchen, F = G.food;
    const portrait = G.viewW / G.viewH < 1.05;
    if (K.portrait === portrait && K.laidOut) { fitKitchenCam(); return; }
    K.portrait = portrait; K.laidOut = true;
    const slots = [];
    if (!portrait) {
      for (let s = 0; s < 2; s++) for (let r = 0; r < 4; r++) {
        const side = s ? 1 : -1;
        slots.push(new T.Vector3(side * 3.95, 0, -2.45 + r * 1.6));
      }
    } else {
      for (let row = 0; row < 2; row++) for (let c = 0; c < 4; c++) slots.push(new T.Vector3(-2.7 + c * 1.8, 0, row ? 4.75 : -4.45));
    }
    // order: onigiri, tamago, karaage, sausage | broccoli, tomato, strawberry, hamburg
    F.display.length = 0;
    K.trays = [];
    const plates = [];
    const shadows = [];
    const rims = [[1, 0.72, 0.8], [1, 0.9, 0.55], [0.7, 0.9, 1], [0.75, 0.95, 0.7], [0.95, 0.8, 1], [1, 0.8, 0.6], [0.7, 0.95, 0.9], [1, 0.75, 0.75]];
    const counts = [1, 2, 3, 3, 3, 3, 3, 2];
    for (let i = 0; i < 8; i++) {
      const p = slots[i];
      const pg = plateGeo(); G.geo.prep(pg);
      const c = pg.attributes.color.array, pp = pg.attributes.position.array;
      for (let k = 0; k < c.length / 3; k++) { const r = Math.hypot(pp[k * 3], pp[k * 3 + 2]); const t = G.smooth((r - 0.56) / 0.08); c[k * 3] = 1 + (rims[i][0] - 1) * t; c[k * 3 + 1] = 1 + (rims[i][1] - 1) * t; c[k * 3 + 2] = 1 + (rims[i][2] - 1) * t; }
      pg.translate(p.x, 0, p.z);
      plates.push(pg);
      const sh = new T.PlaneGeometry(1.7, 1.7); sh.rotateX(-Math.PI / 2); sh.translate(p.x, 0.003, p.z); shadows.push(sh);
      const tray = { type: i, pos: p.clone(), items: [] };
      const n = counts[i];
      const ty = F.TYPES[i];
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU + 0.6;
        const rr = n === 1 ? 0 : Math.min(0.3, 0.62 - ty.r * 0.8);
        const d = F.addDisplay(i, p.x + Math.cos(a) * rr, 0.035, p.z + Math.sin(a) * rr * 0.9, G.rand(0, TAU), 0.92);
        tray.items.push(d);
      }
      K.trays.push(tray);
    }
    // shaker / cup
    K.shakerHome.set(-1.3, 0, 3.15);
    K.cupPos = new T.Vector3(1.3, 0, 3.15);
    K.shaker.position.copy(K.shakerHome);
    K.shaker.scale.setScalar(1.35); K.cup.scale.setScalar(1.5);
    K.shakerShadow.position.set(K.shakerHome.x, 0.003, K.shakerHome.z);
    K.cup.position.copy(K.cupPos);
    const cs = new T.PlaneGeometry(1.3, 1.3); cs.rotateX(-Math.PI / 2); cs.translate(K.cupPos.x, 0.003, K.cupPos.z); shadows.push(cs);
    K.platesMesh.geometry.dispose(); K.platesMesh.geometry = G.geo.merge(plates);
    K.staticShadow.geometry.dispose(); K.staticShadow.geometry = G.geo.merge(shadows);
    // cup picks (decoration you can pull from)
    F.loosePicks = F.loosePicks.filter((lp) => !lp.inCup);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU;
      const pk = { kind: k % 3, color: F.PICK_COLORS[k], tilt: Math.cos(a) * 0.25, yaw: a };
      F.loosePicks.push({ pick: pk, space: 'world', x: K.cupPos.x + Math.cos(a) * 0.12, y: 0.2, z: K.cupPos.z + Math.sin(a) * 0.12, inCup: true });
    }
    fitKitchenCam();
  };

  function fitKitchenCam() {
    const K = G.kitchen;
    const pts = [];
    const add = (x, z, y) => pts.push(new T.Vector3(x, y || 0, z));
    for (const t of K.trays) { add(t.pos.x - 0.75, t.pos.z - 0.75); add(t.pos.x + 0.75, t.pos.z + 0.75, 0.5); add(t.pos.x - 0.75, t.pos.z + 0.75); add(t.pos.x + 0.75, t.pos.z - 0.75, 0.5); }
    const V = G.bento.V; add(-V.ax, -2.1, 2.3); add(V.ax, -2.1, 2.3); add(-1.7, 3.7, 0.9); add(1.7, 3.7, 0.9);
    const B = G.bento;
    add(-B.NX, B.NZ); add(B.NX, B.NZ); add(-B.NX, -B.NZ); add(B.NX, -B.NZ);
    const target = new T.Vector3(0, 0, K.portrait ? 0.4 : 0.35);
    const el = K.portrait ? 1.17 : 1.0;
    const dir = new T.Vector3(0, Math.sin(el), Math.cos(el));
    G.fitCamera(target, dir, pts, 36, { x: 0.96, top: 0.95, bottom: 0.96 });
    K.camPos = G.camera.position.clone(); K.camTarget = target.clone();
  }
  G.fitKitchenCam = fitKitchenCam;
})();
