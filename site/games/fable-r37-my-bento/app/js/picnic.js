// picnic.js — leisure sheet, park backdrop and the animal family (built lazily).
(function () {
  'use strict';
  const T = THREE;
  const G = window.G;
  const TAU = Math.PI * 2;
  const ORIGIN = new T.Vector3(60, 0, 0);

  // ---------- animals: spheres merged per moving part, vertex coloured ----------
  function sph(r, sx, sy, sz, x, y, z, col, ws, hs) {
    const g = new T.SphereGeometry(r, ws || 18, hs || 12);
    g.scale(sx, sy, sz); g.translate(x, y, z);
    return G.geo.prep(g, col);
  }
  const SPECIES = {
    bear: { body: [0.62, 0.40, 0.24], belly: [0.93, 0.80, 0.62], muzzle: [0.95, 0.85, 0.70], ear: 'round', inner: [0.85, 0.6, 0.45], scale: 1.12 },
    rabbit: { body: [0.98, 0.96, 0.94], belly: [1, 1, 1], muzzle: [1, 1, 1], ear: 'long', inner: [1.0, 0.72, 0.78], scale: 0.98 },
    chick: { body: [1.0, 0.86, 0.28], belly: [1.0, 0.93, 0.55], muzzle: null, ear: 'tuft', inner: [1.0, 0.6, 0.2], scale: 0.92 },
    panda: { body: [0.98, 0.98, 0.96], belly: [1, 1, 1], muzzle: [1, 1, 1], ear: 'round', inner: [0.12, 0.12, 0.14], scale: 1.05, patches: true },
  };
  const BLACK = [0.07, 0.06, 0.07], PINK = [1.0, 0.55, 0.62], MOUTH = [0.55, 0.12, 0.16];

  function buildAnimal(kind, mat) {
    const S = SPECIES[kind];
    const root = new T.Group();
    const dark = S.patches ? [0.12, 0.12, 0.14] : S.body;
    // body + feet + belly
    const body = [
      sph(0.55, 1, 1.0, 0.9, 0, 0.55, 0, S.body),
      sph(0.36, 1, 1.05, 0.5, 0, 0.5, 0.3, S.belly),
      sph(0.2, 1, 0.7, 1.3, -0.26, 0.12, 0.38, dark), sph(0.2, 1, 0.7, 1.3, 0.26, 0.12, 0.38, dark),
    ];
    if (kind === 'rabbit') body.push(sph(0.14, 1, 1, 1, 0, 0.35, -0.5, [1, 1, 1], 10, 8));
    const bodyM = new T.Mesh(G.geo.merge(body), mat);
    root.add(bodyM);
    // head (pivot at neck)
    const head = new T.Group();
    head.position.set(0, 1.02, 0);
    root.add(head);
    const hp = [sph(0.5, 1.05, 0.92, 0.95, 0, 0.36, 0, S.body, 22, 16)];
    if (S.ear === 'round') {
      for (const s of [-1, 1]) { hp.push(sph(0.17, 1, 1, 0.6, s * 0.36, 0.76, -0.04, dark, 12, 8)); hp.push(sph(0.1, 1, 1, 0.5, s * 0.36, 0.76, 0.03, S.inner, 10, 6)); }
    } else if (S.ear === 'long') {
      for (const s of [-1, 1]) {
        const e = sph(0.13, 1, 3.3, 0.6, 0, 0, 0, S.body, 12, 10); e.rotateZ(-s * 0.18); e.translate(s * 0.2, 0.98, -0.05); hp.push(e);
        const ei = sph(0.07, 1, 3.0, 0.45, 0, 0, 0, S.inner, 10, 8); ei.rotateZ(-s * 0.18); ei.translate(s * 0.2, 0.98, 0.0); hp.push(ei);
      }
    } else {
      for (let k = -1; k <= 1; k++) { const t = sph(0.07, 0.8, 1.8, 0.8, 0, 0, 0, S.body, 8, 6); t.rotateZ(k * 0.5); t.translate(k * 0.06, 0.86, 0.05); hp.push(t); }
    }
    if (S.muzzle) hp.push(sph(0.2, 1.25, 0.85, 0.8, 0, 0.22, 0.38, S.muzzle, 14, 10));
    if (kind === 'chick') {
      hp.push(sph(0.1, 1.3, 0.55, 1.1, 0, 0.3, 0.48, [1.0, 0.55, 0.15], 12, 8));
    } else {
      hp.push(sph(0.065, 1.3, 0.9, 0.9, 0, 0.3, 0.53, kind === 'rabbit' ? PINK : BLACK, 10, 8));
    }
    if (S.patches) for (const s of [-1, 1]) hp.push(sph(0.12, 0.9, 1.25, 0.5, s * 0.19, 0.42, 0.38, BLACK, 12, 8));
    const headM = new T.Mesh(G.geo.merge(hp), mat);
    head.add(headM);
    // eyes (open), happy eyes (^ ^), cheeks, mouth
    const eyeCol = S.patches ? [1, 1, 1] : BLACK;
    const eyes = new T.Mesh(G.geo.merge([sph(0.055, 0.85, 1.15, 0.6, -0.18, 0.44, 0.44, BLACK, 10, 8), sph(0.055, 0.85, 1.15, 0.6, 0.18, 0.44, 0.44, BLACK, 10, 8),
      sph(0.018, 1, 1, 0.5, -0.165, 0.47, 0.475, [1, 1, 1], 6, 4), sph(0.018, 1, 1, 0.5, 0.195, 0.47, 0.475, [1, 1, 1], 6, 4)]), mat);
    head.add(eyes);
    const happyParts = [];
    for (const s of [-1, 1]) {
      const tg = new T.TorusGeometry(0.06, 0.017, 5, 10, Math.PI);
      tg.translate(s * 0.18, 0.43, 0.45);
      happyParts.push(G.geo.prep(tg, eyeCol === BLACK ? BLACK : [0.1, 0.1, 0.1]));
    }
    const happy = new T.Mesh(G.geo.merge(happyParts), mat);
    happy.visible = false; head.add(happy);
    const cheeks = new T.Mesh(G.geo.merge([sph(0.08, 1.2, 0.8, 0.4, -0.3, 0.26, 0.4, PINK, 10, 6), sph(0.08, 1.2, 0.8, 0.4, 0.3, 0.26, 0.4, PINK, 10, 6)]), mat);
    cheeks.visible = kind !== 'panda';
    head.add(cheeks);
    const mouth = new T.Mesh(G.geo.merge([sph(0.075, 1.25, 1, 0.5, 0, 0, 0, MOUTH, 12, 8)]), mat);
    mouth.position.set(0, kind === 'chick' ? 0.2 : 0.12, kind === 'chick' ? 0.5 : 0.52);
    head.add(mouth);
    // arms (pivot at shoulder)
    const armG = sph(0.14, 1, 2.0, 1, 0, -0.2, 0, dark, 12, 8);
    const arms = [];
    for (const s of [-1, 1]) {
      const pivot = new T.Group();
      pivot.position.set(s * 0.45, 0.82, 0.12);
      const a = new T.Mesh(armG, mat);
      pivot.add(a); pivot.rotation.z = s * 0.35;
      root.add(pivot); arms.push(pivot);
    }
    const shadow = G.shadowPlane(1.6, 1.3);
    shadow.position.y = 0.004;
    root.add(shadow);
    root.scale.setScalar(S.scale);
    return {
      kind, root, head, eyes, happy, cheeks, mouth, arms, scale: S.scale,
      state: 'idle', t: 0, fed: 0, blinkT: G.rand(1, 3), want: 0, smile: 0, hopT: 9, waveT: 9, chewT: 9, phase: Math.random() * TAU,
    };
  }

  const LINEUPS = [['rabbit', 'bear', 'chick'], ['chick', 'panda', 'rabbit'], ['panda', 'bear', 'rabbit'], ['bear', 'chick', 'panda']];
  const SKIES = [
    { hemi: 0xfff6ea, dir: 0xffffff, bg: 0xbfe3ff },
    { hemi: 0xfff0dc, dir: 0xfff1d6, bg: 0xffe2c4 },
    { hemi: 0xf2f6ff, dir: 0xffffff, bg: 0xd6ecff },
  ];

  G.buildPicnic = function () {
    if (G.picnic) return G.picnic;
    const P = (G.picnic = { group: new T.Group(), origin: ORIGIN.clone(), animals: [], all: {} });
    P.group.position.copy(ORIGIN);
    P.group.visible = false;
    G.scene.add(P.group);
    const gingham = G.loadTex('gingham'), park = G.loadTex('park_view', { mirror: true });
    // ground: low-poly with vertex colour variation
    const gg = new T.PlaneGeometry(40, 30, 12, 8); gg.rotateX(-Math.PI / 2);
    G.geo.prep(gg);
    { const c = gg.attributes.color.array, p = gg.attributes.position.array;
      for (let i = 0; i < c.length / 3; i++) { const n = 0.5 + 0.5 * Math.sin(p[i * 3] * 0.7) * Math.cos(p[i * 3 + 2] * 0.9); c[i * 3] = 0.36 + n * 0.1; c[i * 3 + 1] = 0.6 + n * 0.08; c[i * 3 + 2] = 0.2 + n * 0.05; } }
    gg.translate(0, -0.01, -10);
    P.group.add(new T.Mesh(gg, new T.MeshLambertMaterial({ vertexColors: true })));
    // sheet: one plane with the gingham photo (512²)
    const sheetMat = new T.MeshLambertMaterial({ color: 0xffffff });
    const sheet = new T.Mesh(new T.PlaneGeometry(9, 6.6), sheetMat);
    sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0.0, -0.2);
    P.group.add(sheet);
    gingham.ready.then((t) => { if (!t) return; t.repeat.set(2.2, 1.6); sheetMat.map = t; sheetMat.needsUpdate = true; });
    // backdrop: half cylinder, unlit, park photo mirrored-repeated (512²)
    const bd = new T.CylinderGeometry(15, 15, 11, 24, 1, true, -Math.PI * 0.45 + Math.PI, Math.PI * 0.9);
    const bdMat = new T.MeshBasicMaterial({ color: 0xbfe3ff, side: T.BackSide });
    const back = new T.Mesh(bd, bdMat);
    back.position.set(0, 4.2, 3);
    P.group.add(back);
    park.ready.then((t) => { if (!t) return; t.repeat.set(-3, 1); bdMat.map = t; bdMat.color.setHex(0xffffff); bdMat.needsUpdate = true; });
    // animals (all four built once; three shown)
    P.animalMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    for (const k of Object.keys(SPECIES)) {
      const a = buildAnimal(k, P.animalMat);
      a.root.visible = false;
      P.group.add(a.root);
      P.all[k] = a;
    }
    P.setRound = setRound;
    P.setRound(0);
    G.resizeHooks.push(() => { if (G.state.scene === 'picnic') fitPicnicCam(); });
    return P;
  };

  function setRound(round) {
    const P = G.picnic;
    Object.values(P.all).forEach((a) => (a.root.visible = false));
    const line = LINEUPS[round % LINEUPS.length];
    P.animals = line.map((k, i) => {
      const a = P.all[k];
      a.root.visible = true;
      a.home = new T.Vector3((i - 1) * 2.25, 0, -1.75 + (i === 1 ? -0.25 : 0));
      a.root.position.copy(a.home);
      a.root.rotation.set(0, (1 - i) * 0.22, 0);
      a.fed = 0; a.state = 'idle'; a.smile = 0; a.want = 0;
      a.happy.visible = false; a.eyes.visible = true;
      return a;
    });
    P.sky = SKIES[round % SKIES.length];
  }

  function fitPicnicCam() {
    const P = G.picnic;
    const o = P.origin;
    const pts = [];
    const add = (x, y, z) => pts.push(new T.Vector3(o.x + x, y, o.z + z));
    add(-3.3, 0, 2.5); add(3.3, 0, 2.5); add(-3.1, 2.5, -2.0); add(3.1, 2.5, -2.0); add(-3.6, 0, 0.6); add(4.2, 0, 0.6); add(0, 2.8, -2.1);
    const target = new T.Vector3(o.x, 0.75, o.z + 0.1);
    const dir = new T.Vector3(0, Math.sin(0.5), Math.cos(0.5));
    G.fitCamera(target, dir, pts, 40, { x: 0.94, top: 0.62, bottom: 0.95 });
    P.camPos = G.camera.position.clone();
  }
  G.fitPicnicCam = fitPicnicCam;

  // ---------- animal animation ----------
  G.animalUpdate = function (dt) {
    const P = G.picnic;
    if (!P || !P.group.visible) return;
    for (const a of P.animals) {
      a.t += dt; a.hopT += dt; a.waveT += dt; a.chewT += dt;
      const S = a.scale;
      // idle breathing + sway
      const br = Math.sin(a.t * 2.2 + a.phase) * 0.02;
      let hop = 0;
      if (a.hopT < 0.55) hop = Math.sin(a.hopT / 0.55 * Math.PI) * 0.45;
      a.root.position.y = a.home.y + hop * S;
      a.root.scale.set(S * (1 - br * 0.5), S * (1 + br), S * (1 - br * 0.5));
      // lean toward a food being offered
      const lean = a.want * 0.25;
      a.root.position.z = a.home.z + lean * 0.6;
      a.head.rotation.x = -lean * 0.6 + (a.chewT < 1.5 ? Math.sin(a.chewT * 18) * 0.06 : 0);
      a.head.rotation.z = Math.sin(a.t * 1.3 + a.phase) * 0.06;
      // mouth: open when wanting / chewing
      let mo = 0.12 + a.want * 0.8;
      if (a.chewT < 1.5) mo = 0.2 + Math.abs(Math.sin(a.chewT * 9)) * 0.7;
      if (a.state === 'happy') mo = Math.max(mo, 0.55);
      a.mouth.scale.set(1 + a.smile * 0.25, Math.max(0.12, mo), 1);
      // arms: wave, cheer, or reach
      const wave = a.waveT < 1.2 ? Math.sin(a.waveT * 14) * 0.5 : 0;
      const up = a.state === 'happy' || a.state === 'cheer' ? 1 : a.want;
      a.arms[0].rotation.z = -(0.35 + up * 1.5) - (a.waveT < 1.2 ? 0 : 0);
      a.arms[1].rotation.z = 0.35 + up * 1.5 + wave;
      a.arms[0].rotation.x = -a.want * 0.6; a.arms[1].rotation.x = -a.want * 0.6;
      // eyes: blink, or happy arcs
      a.blinkT -= dt;
      if (a.blinkT < 0) { a.blinkT = G.rand(2, 4.5); a.blinking = 0.12; }
      if (a.blinking > 0) a.blinking -= dt;
      const isHappy = a.state === 'happy' || a.state === 'cheer' || a.smile > 0.5;
      a.happy.visible = isHappy;
      a.eyes.visible = !isHappy;
      a.eyes.scale.y = a.blinking > 0 ? 0.15 : 1;
      if (a.state === 'happy' && a.t > a.until) a.state = 'idle';
      if (a.state === 'cheer' && a.t > a.until) a.state = 'idle';
    }
  };
  G.animalMouthWorld = function (a, out) {
    a.root.updateMatrixWorld(true);
    return a.mouth.getWorldPosition(out);
  };

})();
