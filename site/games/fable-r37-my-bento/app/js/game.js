// game.js — flow, input (one finger: tap or drag), hints, scene changes.
(function () {
  'use strict';
  const T = THREE;
  const G = window.G;
  const F = () => G.food;
  const TAU = Math.PI * 2;
  const S = (G.state = { scene: 'boot', round: 0, busy: false, knotted: false, opened: false, celebrated: false, fed: 0, againShown: false });
  const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3();
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  let drag = null;
  let idle = 0, hintClock = 0, hintIdx = 0, sinceStart = 0;

  // ---------- screen helpers ----------
  function toScreen(p) {
    v1.copy(p).project(G.camera);
    return { x: (v1.x * 0.5 + 0.5) * G.viewW, y: (-v1.y * 0.5 + 0.5) * G.viewH, z: v1.z };
  }
  function pxRadius(p, r) {
    const a = toScreen(p);
    v2.copy(G.camera.position).sub(p).normalize();
    v3.set(0, 1, 0).cross(v2).normalize(); // a horizontal offset at the same depth
    if (v3.lengthSq() < 1e-6) v3.set(1, 0, 0);
    const b = toScreen(v3.multiplyScalar(r).add(p));
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function rayPlane(x, y, planeY, out) {
    ndc.set((x / G.viewW) * 2 - 1, -(y / G.viewH) * 2 + 1);
    ray.setFromCamera(ndc, G.camera);
    const d = ray.ray.direction, o = ray.ray.origin;
    if (Math.abs(d.y) < 1e-5) return null;
    const t = (planeY - o.y) / d.y;
    if (t < 0) return null;
    return out.copy(o).addScaledVector(d, t);
  }
  const boxToWorld = (x, y, z, out) => G.bento.group.localToWorld(out.set(x, y, z));
  const worldToBox = (p, out) => G.bento.group.worldToLocal(out.copy(p));

  // ---------- kitchen actions ----------
  const boxItems = () => F().items.filter((i) => i.state === 'box');
  function boxIsOpen() { return G.bento.lidP < 0.15 && G.bento.lidTo < 0.5 && !G.bentoApi.anyFolded(); }

  // Undo the wrapping / lid so food can go in (never blocks the child).
  function reopen() {
    const B = G.bento;
    let wait = 0;
    if (G.bentoApi.anyFolded()) { for (let i = 0; i < 4; i++) G.bentoApi.foldCorner(i, 0); B.knotTo = 0; S.knotted = false; G.sfx.play('fold'); wait = 0.4; }
    if (B.lidP > 0.05 || B.lidTo > 0.05) {
      B.onLidDone = [];
      setTimeout(() => { G.bentoApi.animateLid(0, 0.5); G.sfx.play('boop'); }, wait * 1000);
      wait += 0.5;
    }
    return wait;
  }
  function squashUnderLid() {
    const lim = G.bento.V.H - 0.08;
    for (const it of boxItems()) {
      const top = it.y + it.h * it.f;
      it.squash = top > lim ? Math.max(0.55, (lim - it.y) / (it.h * it.f)) : 1;
      F().wobble(it, 0.12);
    }
  }
  function closeLid(then) {
    const B = G.bento;
    if (B.lidP > 0.98 && B.lidTo === 1) { then && then(); return; }
    if (!(B.lidTo === 1 && B.lidAnimT < 1)) {
      G.bentoApi.animateLid(1, 0.55);
      B.onLidDone = [() => { G.sfx.play('lidClose'); squashUnderLid(); G.bentoApi.bounce(); }];
    }
    if (then) B.onLidDone.push(then);
  }
  function foldCorner(i) {
    closeLid(() => {
      const api = G.bentoApi;
      if (G.bento.cornerTo[i] > 0) {
        const j = [0, 1, 2, 3].find((k) => G.bento.cornerTo[k] === 0);
        if (j === undefined) { tieKnot(); return; }
        i = j;
      }
      api.foldCorner(i, 1);
      G.sfx.play('fold');
    });
  }
  function nextWrapStep(nearX, nearZ) {
    const B = G.bento;
    if (B.lidP < 0.98 || B.lidTo < 1) { closeLid(); return; }
    if (!G.bentoApi.allFolded()) {
      // fold the unfolded corner nearest to the finger
      let best = -1, bd = 1e9;
      for (let i = 0; i < 4; i++) {
        if (B.cornerTo[i] > 0) continue;
        const sx = i % 2 ? 1 : -1, sz = i >= 2 ? 1 : -1;
        const d = Math.hypot(sx * B.NX - (nearX || 0), sz * B.NZ - (nearZ || 0));
        if (d < bd) { bd = d; best = i; }
      }
      foldCorner(best);
      return;
    }
    tieKnot();
  }
  function tieKnot() {
    const B = G.bento;
    if (S.knotted || S.busy) return;
    // wait for the corners to finish folding
    const ready = B.corners.every((c) => c > 0.95);
    if (!ready) { setTimeout(tieKnot, 200); return; }
    S.knotted = true;
    B.knotTo = 1;
    G.sfx.play('knot');
    G.bentoApi.bounce();
    v1.set(0, B.wrapH + 0.3, 0);
    G.fx.burst('star', B.group.localToWorld(v1.clone()), 10, { colors: [0xffe066, 0xffffff, 0xff9fc0], speed: 1.6, up: 2 });
    setTimeout(goPicnic, 1000);
  }

  function placeFood(it, x, z) {
    // drop into the box at (x,z) box-local; neighbours get pushed
    const wait = boxIsOpen() ? 0 : reopen();
    const land = () => {
      it.state = 'box';
      it.squash = 1;
      const moved = F().settle(it);
      F().wobble(it, 0.22);
      G.sfx.play('drop');
      if (moved) setTimeout(() => G.sfx.play('squish'), 60);
      G.fx.burst('star', boxToWorld(it.x, 0.6, it.z, new T.Vector3()), 4, { colors: [0xffffff, 0xfff0a0], speed: 1, up: 1.4, size: 0.6, life: 0.6 });
    };
    it.x = x; it.z = z;
    if (wait > 0 || it.state === 'fly') {
      it.state = 'fly';
      it.fly = { fx: it.px, fy: it.py, fz: it.pz, tx: x, ty: G.bento.floorY + 0.1, tz: z, t: 0, dur: Math.max(0.5, wait + 0.25), arc: 1.2, done: land, after: 'box' };
    } else land();
  }
  function sendBack(it) {
    // fly back to its tray and vanish
    const K = G.kitchen;
    const tray = K.trays[it.type];
    worldToBox(v1.set(tray.pos.x, 0.3, tray.pos.z), v2);
    it.state = 'fly';
    it.fly = { fx: it.px, fy: it.py, fz: it.pz, tx: v2.x, ty: v2.y, tz: v2.z, t: 0, dur: 0.45, arc: 0.6, shrink: true, after: 'gone', done: () => F().removeFor(it) };
    G.sfx.play('boop');
  }

  // ---------- picnic actions ----------
  function untie() {
    const B = G.bento;
    S.knotted = false;
    B.knotTo = 0;
    for (let i = 0; i < 4; i++) G.bentoApi.foldCorner(i, 0);
    G.sfx.play('untie');
    G.bentoApi.bounce();
    G.picnic.animals.forEach((a, i) => setTimeout(() => { a.hopT = 0; }, i * 120));
  }
  function openLid() {
    if (S.opened) return;
    if (S.knotted) { untie(); return; }
    S.opened = true;
    G.bentoApi.animateLid(0, 0.7);
    G.sfx.play('open');
    G.fx.burst('star', boxToWorld(0, 0.8, 0, new T.Vector3()), 22, { colors: [0xffe066, 0xffffff, 0xff9fc0, 0x9fe0ff], speed: 3, up: 3.2 });
    for (const it of boxItems()) F().wobble(it, 0.15);
    G.picnic.animals.forEach((a, i) => setTimeout(() => { a.hopT = 0; a.state = 'cheer'; a.until = a.t + 1.3; }, 250 + i * 110));
    setTimeout(() => showAgain(false), 5000);
  }
  function hungriest() {
    const as = G.picnic.animals.slice();
    const min = Math.min(...as.map((a) => a.fed + (a.busy ? 0.5 : 0)));
    const c = as.filter((a) => a.fed + (a.busy ? 0.5 : 0) === min);
    return G.pick(c);
  }
  function feed(it, a) {
    const B = G.bento;
    G.animalMouthWorld(a, v1);
    worldToBox(v1, v2);
    a.busy = true;
    a.want = 1;
    it.state = 'fly';
    it.fly = {
      fx: it.px, fy: it.py, fz: it.pz, tx: v2.x, ty: v2.y - 0.1, tz: v2.z, t: 0, dur: 0.5, arc: 0.7, shrink: true, after: 'gone',
      done: () => {
        F().removeFor(it);
        a.chewT = 0; a.want = 0;
        G.sfx.play('munch');
        setTimeout(() => {
          a.busy = false;
          a.fed++; S.fed++;
          a.state = 'happy'; a.until = a.t + 2.2; a.smile = 1; a.hopT = 0;
          G.animalMouthWorld(a, v3);
          G.fx.burst('heart', v3.clone().add(new T.Vector3(0, 0.4, 0)), 7, { colors: [0xff5a8a, 0xff8fb1, 0xffb3c8], speed: 1.4, up: 2.4, g: 1.2, life: 1.4 });
          G.sfx.play('happy');
          showAgain(false);
          checkCelebrate();
        }, 1200);
      },
    };
    G.sfx.play('pick');
    void B;
  }
  function checkCelebrate() {
    if (S.celebrated) return;
    const P = G.picnic;
    const all = P.animals.every((a) => a.fed > 0);
    const empty = boxItems().length === 0 && !F().items.some((i) => i.state === 'fly' || i.state === 'drag');
    if (all || (empty && S.fed > 0)) {
      S.celebrated = true;
      setTimeout(celebrate, 700);
    }
  }
  function celebrate() {
    const P = G.picnic;
    G.sfx.play('fanfare');
    P.animals.forEach((a, i) => setTimeout(() => {
      a.state = 'cheer'; a.until = a.t + 2.5; a.hopT = 0; a.smile = 1;
      G.animalMouthWorld(a, v3);
      G.fx.burst('heart', v3.clone().add(new T.Vector3(0, 0.6, 0)), 6, { colors: [0xff5a8a, 0xff8fb1], speed: 1.2, up: 2.2, g: 1.0, life: 1.6 });
    }, i * 180));
    G.fx.burst('conf', boxToWorld(0, 2.2, -1, new T.Vector3()), 50, { colors: [0xff5a8a, 0xffd84a, 0x5ac8ff, 0x7be07b, 0xb98cff], speed: 3.5, up: 3.5, g: 2.2, life: 2.2, flat: true });
    setTimeout(() => showAgain(true), 900);
  }
  function giveAll() {
    const items = boxItems();
    G.bentoApi.bounce();
    if (!items.length) {
      // an empty box is still a present: everyone cheers
      S.fed++;
      G.picnic.animals.forEach((a) => (a.fed = Math.max(a.fed, 1)));
      checkCelebrate();
      return;
    }
    items.forEach((it, k) => setTimeout(() => { if (it.state === 'box') feed(it, hungriest()); }, k * 280));
  }

  // ---------- again button ----------
  const againBtn = document.getElementById('again');
  function showAgain(big) {
    if (S.scene !== 'picnic') return;
    S.againShown = true;
    againBtn.classList.add('show');
    if (big) againBtn.classList.add('big');
  }
  function hideAgain() { againBtn.classList.remove('show', 'big'); S.againShown = false; }
  againBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    G.sfx.unlock();
    if (S.busy || S.scene !== 'picnic') return;
    G.sfx.play('tap');
    goKitchen();
  });

  // ---------- scene changes (iris wipe, ~2s, camera never moves inside a scene) ----------
  const iris = document.getElementById('iris');
  function wipe(mid, done) {
    S.busy = true;
    iris.classList.add('on');
    iris.style.transition = 'width 0.85s ease-in, height 0.85s ease-in';
    requestAnimationFrame(() => { iris.style.width = iris.style.height = '0px'; });
    setTimeout(() => {
      try { mid(); } catch (e) { G.logError(e.message); }
      setTimeout(() => {
        iris.style.transition = 'width 0.9s ease-out, height 0.9s ease-out';
        iris.style.width = iris.style.height = '300vmax';
        setTimeout(() => { iris.classList.remove('on'); S.busy = false; done && done(); }, 920);
      }, 260);
    }, 880);
  }
  function goPicnic() {
    if (S.scene !== 'kitchen') return;
    G.sfx.play('whoosh');
    wipe(() => {
      const P = G.buildPicnic();
      const B = G.bento;
      G.kitchen.group.visible = false;
      P.group.visible = true;
      B.group.position.set(P.origin.x, 0, P.origin.z + 0.85);
      G.bentoApi.setLidHome('picnic');
      G.kitchen.shaker.visible = false;
      S.scene = 'picnic'; S.opened = false; S.celebrated = false; S.fed = 0;
      G.scene.background.setHex(P.sky.bg);
      G.lights.hemi.color.setHex(P.sky.hemi); G.lights.dir.color.setHex(P.sky.dir);
      G.fitPicnicCam();
      for (const it of F().items) if (it.state !== 'box') it.state = 'gone';
    }, () => { G.sfx.play('chime'); idle = 0; hintClock = 0; });
  }
  function goKitchen() {
    G.sfx.play('whoosh');
    hideAgain();
    wipe(() => {
      S.round++;
      F().clearAll();
      const B = G.bento;
      B.lidMode = 'kitchen';
      G.bentoApi.setVariant(S.round);
      G.bentoApi.setLidHome('kitchen');
      B.group.position.set(0, 0, 0);
      B.lidP = 0; B.lidTo = 0; B.lidAnimT = 1; B.onLidDone = [];
      for (let i = 0; i < 4; i++) { B.corners[i] = 0; G.bentoApi.foldCorner(i, 0); }
      B.knot = 0; B.knotTo = 0; B.foldCount = 0;
      if (G.picnic) { G.picnic.group.visible = false; G.picnic.setRound(S.round); }
      G.kitchen.group.visible = true;
      G.kitchen.shaker.visible = true;
      G.kitchen.shaker.position.copy(G.kitchen.shakerHome); G.kitchen.shaker.rotation.set(0, 0, 0);
      S.scene = 'kitchen'; S.knotted = false; S.opened = false; S.celebrated = false; S.fed = 0;
      G.scene.background.setHex(0xf6e7d2);
      G.lights.hemi.color.setHex(0xfff4e6); G.lights.dir.color.setHex(0xffffff);
      G.layoutKitchen();
    }, () => { idle = 0; hintClock = 0; sinceStart = 0; });
  }

  // ---------- input ----------
  function candidatesKitchen(x, y) {
    const K = G.kitchen, B = G.bento, list = [];
    const add = (kind, p, r, extra, bias) => {
      const s = toScreen(p), pr = Math.max(28, pxRadius(p, r));
      const d = Math.hypot(s.x - x, s.y - y) / pr;
      if (d < 1) list.push(Object.assign({ kind, score: d * (bias || 1) }, extra));
    };
    const open = boxIsOpen();
    if (open) for (const it of boxItems()) add('boxFood', boxToWorld(it.x, it.y + it.h * 0.5, it.z, new T.Vector3()), Math.max(0.3, it.r * it.f), { item: it }, 0.7);
    K.trays.forEach((t, i) => add('tray', t.pos, 0.78, { i }));
    add('shaker', v3.copy(K.shaker.position).setY(0.4), 0.65, {});
    add('cup', v3.copy(K.cupPos).setY(0.3), 0.65, {});
    if (B.lidP < 0.5) add('lid', B.lid.localToWorld(new T.Vector3(0, 0.1, 0)), Math.max(B.V.ax, B.V.az) * 0.95, {}, 1.1);
    for (let i = 0; i < 4; i++) if (B.cornerTo[i] === 0) add('corner', G.bentoApi.cornerWorld(i, new T.Vector3()), 0.75, { i }, 0.9);
    add('bundle', boxToWorld(0, B.V.H * 0.6, 0, new T.Vector3()), Math.max(B.V.ax, B.V.az) * 1.05, {}, 1.3);
    list.sort((a, b) => a.score - b.score);
    return list[0] || null;
  }
  function candidatesPicnic(x, y) {
    const B = G.bento, P = G.picnic, list = [];
    const add = (kind, p, r, extra, bias) => {
      const s = toScreen(p), pr = Math.max(30, pxRadius(p, r));
      const d = Math.hypot(s.x - x, s.y - y) / pr;
      if (d < 1) list.push(Object.assign({ kind, score: d * (bias || 1) }, extra));
    };
    if (S.opened) for (const it of boxItems()) add('feedFood', boxToWorld(it.x, it.y + it.h * 0.5, it.z, new T.Vector3()), Math.max(0.32, it.r * it.f), { item: it }, 0.6);
    P.animals.forEach((a, i) => { a.root.updateMatrixWorld(true); add('animal', a.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 0.2, 0)), 0.75, { a, i }); add('animal', a.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 0.6, 0)), 0.6, { a, i }, 1.1); });
    add('bundle', boxToWorld(0, B.V.H * 0.6, 0, new T.Vector3()), Math.max(B.V.ax, B.V.az) * 1.15, {}, 1.2);
    if (S.opened) add('lidAside', B.lid.position.clone(), 1.2, {}, 1.4);
    list.sort((a, b) => a.score - b.score);
    return list[0] || null;
  }

  function onDown(e) {
    if (drag && drag.pid !== e.pointerId) return; // one finger at a time
    G.sfx.unlock();
    idle = 0;
    G.fx.stopHalo();
    if (S.busy || S.scene === 'boot') return;
    const x = e.clientX, y = e.clientY;
    const c = S.scene === 'kitchen' ? candidatesKitchen(x, y) : candidatesPicnic(x, y);
    if (!c) return;
    try { G.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    drag = { pid: e.pointerId, kind: c.kind, c, sx: x, sy: y, moved: false, t: 0 };
    const B = G.bento;
    if (c.kind === 'tray') {
      const t = G.kitchen.trays[c.i];
      t.items.forEach((d) => F().hop(d));
      if (boxItems().length >= G.tier.maxFoods) { boxItems().forEach((it) => F().wobble(it, 0.15)); G.sfx.play('squish'); drag = null; return; }
      worldToBox(v1.set(t.pos.x, 0.4, t.pos.z), v2);
      const it = F().make(c.i, { state: 'drag', x: v2.x, y: 1.0, z: v2.z, px: v2.x, py: v2.y, pz: v2.z });
      F().items.push(it);
      drag.item = it; drag.fromTray = true;
      G.sfx.play('pick');
    } else if (c.kind === 'boxFood' || c.kind === 'feedFood') {
      const it = c.item;
      drag.home = { x: it.x, z: it.z, y: it.y };
      it.state = 'drag'; it.y = (S.scene === 'kitchen' ? 1.0 : 1.1);
      drag.item = it;
      F().wobble(it, 0.2);
      G.sfx.play('pick');
    } else if (c.kind === 'shaker') {
      G.kitchen.shakerHop = 0;
      G.sfx.play('tap');
    } else if (c.kind === 'cup') {
      const K = G.kitchen;
      const lp = { pick: F().newPick(), space: 'world', x: K.cupPos.x, y: 0.5, z: K.cupPos.z, tx: K.cupPos.x, tz: K.cupPos.z };
      F().loosePicks.push(lp);
      drag.lp = lp;
      G.sfx.play('pick');
    } else if (c.kind === 'lid') {
      drag.p0 = B.lidP;
      B.lidHopT = 0;
      G.sfx.play('tap');
    } else if (c.kind === 'animal') {
      const a = c.a;
      a.waveT = 0; a.hopT = 0;
      G.sfx.play('boing');
      G.animalMouthWorld(a, v3);
      G.fx.burst('heart', v3.clone().add(new T.Vector3(0, 0.5, 0)), 3, { speed: 0.8, up: 1.8, g: 1, size: 0.8 });
    } else if (c.kind === 'corner') {
      B.flutterI = c.i; B.flutterT = 0;
    } else if (c.kind === 'bundle') {
      G.bentoApi.bounce();
    }
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const x = e.clientX, y = e.clientY;
    if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 12) drag.moved = true;
    drag.lx = x; drag.ly = y;
    const B = G.bento;
    if (drag.item) {
      const planeY = S.scene === 'kitchen' ? 1.0 : 1.1;
      if (rayPlane(x, y, planeY, v1)) {
        worldToBox(v1, v2);
        drag.item.x = v2.x; drag.item.z = v2.z; drag.item.y = v2.y;
      }
    } else if (drag.kind === 'shaker' && drag.moved) {
      if (rayPlane(x, y, 1.3, v1)) drag.shakerTo = v1.clone();
    } else if (drag.lp && drag.moved) {
      if (rayPlane(x, y, 1.0, v1)) { drag.lp.x = v1.x; drag.lp.y = 1.0; drag.lp.z = v1.z; }
    } else if (drag.kind === 'lid' && drag.moved) {
      if (rayPlane(x, y, 0.6, v1)) {
        worldToBox(v1, v2);
        const z0 = -(B.V.az + 0.4);
        const p = G.clamp((v2.z - z0) / (0 - z0), 0, 0.97);
        B.lidAnimT = 1; B.lidP = p; B.lidTo = p;
      }
    }
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    try { G.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const B = G.bento;
    if (S.busy && d.kind !== 'feedFood') { if (d.item && d.fromTray) d.item.state = 'gone'; return; }
    if (S.scene === 'kitchen') {
      if (d.kind === 'tray') {
        const it = d.item;
        if (!d.moved) {
          const spot = F().freeSpot(it.r);
          it.state = 'fly';
          placeFood(it, spot.x, spot.z);
        } else if (F().inBox(it.x, it.z, 0.55)) {
          placeFood(it, it.x, it.z);
        } else sendBack(it);
      } else if (d.kind === 'boxFood') {
        const it = d.item;
        if (!d.moved) { it.x = d.home.x; it.z = d.home.z; it.y = d.home.y; it.state = 'box'; F().hop(it); G.sfx.play('boop'); }
        else if (F().inBox(it.x, it.z, 0.55)) placeFood(it, it.x, it.z);
        else sendBack(it);
      } else if (d.kind === 'shaker') {
        shakerAuto(d.moved ? null : true);
      } else if (d.kind === 'cup') {
        dropPick(d.lp, d.moved);
      } else if (d.kind === 'lid') {
        if (!d.moved) { if (B.lidP < 0.5) closeLid(); else nextWrapStep(); }
        else if (B.lidP > 0.45) closeLid(); else { G.bentoApi.animateLid(0, 0.35); }
      } else if (d.kind === 'corner') {
        foldCorner(d.c.i);
      } else if (d.kind === 'bundle') {
        if (boxIsOpen()) {
          // tapping the open box: everything inside jiggles
          boxItems().forEach((it, k) => setTimeout(() => F().hop(it), k * 40));
          G.sfx.play('boop');
        } else {
          worldToBox(rayPlane(d.sx, d.sy, 0.3, v1) || v1.set(0, 0, 0), v2);
          nextWrapStep(v2.x, v2.z);
        }
      }
    } else if (S.scene === 'picnic') {
      if (d.kind === 'feedFood') {
        const it = d.item;
        const P = G.picnic;
        let target = null;
        if (d.moved) {
          let best = 1e9;
          for (const a of P.animals) {
            a.head.getWorldPosition(v1);
            const s = toScreen(v1), r = pxRadius(v1, 1.0);
            const dd = Math.hypot(s.x - d.lx, s.y - d.ly) / r;
            if (dd < 1.3 && dd < best) { best = dd; target = a; }
          }
        } else target = hungriest();
        if (target) feed(it, target);
        else { it.x = d.home.x; it.z = d.home.z; it.y = d.home.y; it.state = 'box'; F().wobble(it, 0.2); G.sfx.play('boop'); }
        G.picnic.animals.forEach((a) => { if (!a.busy) a.want = 0; });
      } else if (d.kind === 'bundle') {
        if (S.knotted) untie();
        else if (!S.opened) openLid();
        else giveAll();
      } else if (d.kind === 'lidAside') {
        G.bentoApi.bounce();
        G.sfx.play('boop');
      }
    }
  }
  G.canvas.addEventListener('pointerdown', onDown);
  G.canvas.addEventListener('pointermove', onMove);
  G.canvas.addEventListener('pointerup', onUp);
  G.canvas.addEventListener('pointercancel', onUp);
  G.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  // iOS unlocks audio most reliably on touchend / pointerup
  document.addEventListener('touchend', () => G.sfx.unlock(), { passive: true });
  document.addEventListener('pointerup', () => G.sfx.unlock());

  // ---------- shaker & picks ----------
  let shake = null; // auto sprinkle sequence
  function shakerAuto(auto) {
    const K = G.kitchen;
    if (!auto) { shake = { phase: 'home', t: 0 }; return; }
    if (!boxIsOpen()) {
      const w = reopen();
      setTimeout(() => shakerAuto(true), (w + 0.1) * 1000);
      return;
    }
    const B = G.bento.inner;
    const spot = new T.Vector3(G.rand(-B.ax * 0.7, B.ax * 0.7), 0, G.rand(-B.az * 0.6, B.az * 0.6));
    const its = boxItems();
    if (its.length && Math.random() < 0.75) { const it = G.pick(its); spot.set(it.x, 0, it.z); }
    boxToWorld(spot.x, 1.5, spot.z, spot);
    shake = { phase: 'go', t: 0, from: K.shaker.position.clone(), to: spot };
  }
  function updateShaker(dt) {
    const K = G.kitchen;
    if (!K) return;
    const sh = K.shaker;
    // held & dragged: follow finger, sprinkle while over the box
    if (drag && drag.kind === 'shaker' && drag.moved && drag.shakerTo) {
      sh.position.lerp(drag.shakerTo, G.damp(18, dt));
      shakeTilt(sh, dt, true);
      worldToBox(sh.position, v2);
      drag.spr = (drag.spr || 0) + dt;
      if (F().inBox(v2.x, v2.z, 0.2) && drag.spr > 0.07) {
        if (!boxIsOpen()) { reopen(); }
        else { drag.spr = 0; capDrop(sh, 5); if (Math.random() < 0.4) G.sfx.play('sprinkle'); }
      }
    } else if (shake) {
      shake.t += dt;
      if (shake.phase === 'go') {
        const t = Math.min(1, shake.t / 0.45);
        sh.position.lerpVectors(shake.from, shake.to, G.smooth(t)); sh.position.y += Math.sin(t * Math.PI) * 0.6;
        if (t >= 1) { shake.phase = 'shake'; shake.t = 0; shake.n = 0; }
      } else if (shake.phase === 'shake') {
        shakeTilt(sh, dt, true);
        if (shake.t > shake.n * 0.12 && shake.n < 7) { shake.n++; capDrop(sh, 10); if (shake.n % 2) G.sfx.play('shake'); }
        if (shake.t > 0.95) { shake = { phase: 'home', t: 0 }; }
      } else if (shake.phase === 'home') {
        sh.position.lerp(K.shakerHome, G.damp(10, dt));
        shakeTilt(sh, dt, false);
        if (sh.position.distanceTo(K.shakerHome) < 0.01) { sh.position.copy(K.shakerHome); shake = null; }
      }
    } else {
      // little hop when hinted
      K.shakerHop = (K.shakerHop === undefined ? 9 : K.shakerHop) + dt;
      const h = K.shakerHop < 0.5 ? Math.sin(K.shakerHop / 0.5 * Math.PI) * 0.3 : 0;
      sh.position.set(K.shakerHome.x, h, K.shakerHome.z);
      shakeTilt(sh, dt, false);
    }
    K.shakerShadow.position.set(sh.position.x, 0.003, sh.position.z);
  }
  function shakeTilt(sh, dt, on) {
    const tz = on ? 2.4 + Math.sin(G.time * 30) * 0.25 : 0;
    sh.rotation.z += (tz - sh.rotation.z) * G.damp(14, dt);
  }
  function capDrop(sh, n) {
    // grains fall from the cap (cap is at local y 0.6, tilted)
    v1.set(0, 0.62, 0).applyMatrix4(sh.matrixWorld);
    F().dropSprinkles(v1.x, v1.y - 0.1, v1.z, n, 0.4);
  }
  function dropPick(lp, moved) {
    const its = boxItems();
    const finish = () => { F().loosePicks.splice(F().loosePicks.indexOf(lp), 1); };
    if (!moved) {
      if (!boxIsOpen()) { const w = reopen(); setTimeout(() => dropPick(lp, false), (w + 0.1) * 1000); return; }
      const free = its.filter((i) => !i.pick);
      const host = free.length ? G.pick(free) : its.length ? G.pick(its) : null;
      if (host) { flyPickTo(lp, host); return; }
      // empty box: the pick stands on the floor
      const sp = F().freeSpot(0.1);
      boxToWorld(sp.x, 0, sp.z, v1);
      animatePick(lp, v1.x, v1.z, () => { finish(); F().loosePicks.push({ pick: lp.pick, space: 'box', x: sp.x, y: G.bento.floorY + 0.12, z: sp.z }); G.sfx.play('stick'); });
      return;
    }
    worldToBox(v1.set(lp.x, 0, lp.z), v2);
    let host = null, bd = 1e9;
    for (const it of its) { const dd = Math.hypot(it.x - v2.x, it.z - v2.z); if (dd < it.r * it.f * 1.2 && dd < bd) { bd = dd; host = it; } }
    if (host && boxIsOpen()) { finish(); host.pick = lp.pick; F().wobble(host, 0.2); G.sfx.play('stick'); return; }
    if (F().inBox(v2.x, v2.z, 0.2) && boxIsOpen()) { finish(); F().loosePicks.push({ pick: lp.pick, space: 'box', x: v2.x, y: G.bento.floorY + 0.12, z: v2.z }); G.sfx.play('stick'); return; }
    // back to the cup
    animatePick(lp, G.kitchen.cupPos.x, G.kitchen.cupPos.z, finish);
    G.sfx.play('boop');
  }
  const pickAnims = [];
  function animatePick(lp, tx, tz, done) { pickAnims.push({ lp, fx: lp.x, fy: lp.y, fz: lp.z, tx, tz, t: 0, done }); }
  function flyPickTo(lp, host) {
    pickAnims.push({ lp, fx: lp.x, fy: lp.y, fz: lp.z, host, t: 0, done: () => { F().loosePicks.splice(F().loosePicks.indexOf(lp), 1); host.pick = lp.pick; F().wobble(host, 0.2); G.sfx.play('stick'); } });
  }
  function updatePickAnims(dt) {
    for (let i = pickAnims.length - 1; i >= 0; i--) {
      const a = pickAnims[i];
      a.t += dt / 0.45;
      let tx = a.tx, tz = a.tz, ty = 0.3;
      if (a.host) { boxToWorld(a.host.x, a.host.y + a.host.h, a.host.z, v1); tx = v1.x; tz = v1.z; ty = v1.y; }
      const t = Math.min(1, a.t), e = G.smooth(t);
      a.lp.x = G.lerp(a.fx, tx, e); a.lp.z = G.lerp(a.fz, tz, e); a.lp.y = G.lerp(a.fy, ty, e) + Math.sin(t * Math.PI) * 0.8;
      if (a.t >= 1) { pickAnims.splice(i, 1); a.done && a.done(); }
    }
  }

  // ---------- hints: when the child stops, the next thing glows and hops ----------
  function hint() {
    const B = G.bento, K = G.kitchen;
    hintIdx++;
    if (S.scene === 'kitchen') {
      const n = boxItems().length;
      if (n < 3 || (B.lidP < 0.5 && hintIdx % 5 === 0)) {
        const t = K.trays[(hintIdx * 3) % 8];
        t.items.forEach((d, k) => setTimeout(() => F().hop(d), k * 90));
        G.fx.halo(() => t.pos, 0.85);
        return;
      }
      if (B.lidP < 0.5) {
        const pick = hintIdx % 4;
        if (pick === 1) { K.shakerHop = 0; G.fx.halo(() => K.shakerHome, 0.55); return; }
        if (pick === 2) { F().loosePicks.forEach((lp) => { if (lp.inCup) lp.hop = 0; }); G.fx.halo(() => K.cupPos, 0.55); return; }
        B.lidHopT = 0; G.fx.halo(() => v3.copy(B.lid.position).setY(0.02), Math.max(B.V.ax, B.V.az) * 1.05); return;
      }
      if (!G.bentoApi.allFolded()) {
        const i = [0, 1, 2, 3].find((k) => B.cornerTo[k] === 0);
        B.flutterI = i; B.flutterT = 0;
        G.fx.halo(() => G.bentoApi.cornerWorld(i, new T.Vector3()), 0.7);
        return;
      }
      G.bentoApi.bounce();
      G.fx.halo(() => boxToWorld(0, 0.02, 0, new T.Vector3()), Math.max(B.V.ax, B.V.az) * 1.3);
      return;
    }
    // picnic
    if (S.knotted || !S.opened) {
      G.bentoApi.bounce();
      G.fx.halo(() => boxToWorld(0, 0.02, 0, new T.Vector3()), Math.max(B.V.ax, B.V.az) * 1.4);
      return;
    }
    const its = boxItems();
    if (its.length && !S.celebrated) {
      const it = G.pick(its);
      F().hop(it);
      G.fx.halo(() => boxToWorld(it.x, 0.1, it.z, new T.Vector3()), 0.55);
      const a = hungriest();
      a.waveT = 0;
      return;
    }
    showAgain(true);
    againBtn.classList.remove('nudge'); void againBtn.offsetWidth; againBtn.classList.add('nudge');
    setTimeout(() => againBtn.classList.remove('nudge'), 1300);
  }

  // ---------- frame ----------
  const dragShadow = G.shadowPlane(0.8, 0.8);
  dragShadow.visible = false;
  function update(dt) {
    if (S.scene === 'boot') return;
    sinceStart += dt;
    if (!drag && !S.busy) {
      idle += dt;
      hintClock += dt;
      const first = sinceStart < 6 ? 1.2 : 2.6;
      if (idle > first && hintClock > 3.0) { hintClock = 0; hint(); }
    } else hintClock = 2.0;
    updateShaker(dt);
    updatePickAnims(dt);
    // cup picks hop
    for (const lp of F().loosePicks) if (lp.inCup) {
      lp.hop = (lp.hop === undefined ? 9 : lp.hop) + dt;
      lp.y = 0.2 + (lp.hop < 0.5 ? Math.sin(lp.hop / 0.5 * Math.PI) * 0.25 : 0);
    }
    // napkin corner flutter hint
    const B = G.bento;
    if (B.flutterT !== undefined && B.flutterT < 0.8) {
      B.flutterT += dt;
      const i = B.flutterI;
      if (B.cornerTo[i] === 0) { B.corners[i] = Math.max(0, Math.sin(B.flutterT / 0.8 * Math.PI) * 0.12); B.napkinDirty = true; }
    }
    // lid hop hint
    if (B.lidHopT !== undefined && B.lidHopT < 0.5) { B.lidHopT += dt; }
    // animals want the food being dragged toward them
    if (S.scene === 'picnic' && G.picnic) {
      for (const a of G.picnic.animals) {
        let w = 0;
        if (drag && drag.item && drag.moved) {
          a.head.getWorldPosition(v1);
          const s = toScreen(v1);
          const dd = Math.hypot(s.x - drag.lx, s.y - drag.ly) / Math.max(40, pxRadius(v1, 1.6));
          w = G.clamp(1.4 - dd, 0, 1);
        }
        if (!a.busy) a.want += (w - a.want) * G.damp(8, dt);
      }
    }
    // shadow under a dragged food
    if (drag && drag.item && drag.item.state === 'drag') {
      const it = drag.item;
      boxToWorld(it.px, 0, it.pz, v1);
      dragShadow.visible = true;
      dragShadow.position.set(v1.x, (F().inBox(it.px, it.pz, 0) ? G.bento.floorY + 0.01 : 0.01), v1.z);
      const s = it.r * 2.2;
      dragShadow.scale.set(s, 1, s);
    } else dragShadow.visible = false;
  }

  // ---------- boot ----------
  async function boot() {
    const lac = G.loadTex('bento_lacquer'), rice = G.loadTex('rice_grains'), wood = G.loadTex('wood_counter');
    await Promise.race([Promise.all([lac.ready, rice.ready, wood.ready]), new Promise((r) => setTimeout(r, 3000))]);
    G.food.init(G.scene, rice.tex.image ? rice.tex : null);
    G.fx.init(G.scene);
    G.buildKitchen({ wood: wood.tex.image ? wood.tex : null, lacquer: lac.tex.image ? lac.tex : null });
    G.scene.add(dragShadow);
    G.updaters.push(update, (dt) => G.bentoApi.update(dt), (dt) => G.food.update(dt), (dt) => G.animalUpdate(dt), (dt) => G.fx.update(dt));
    S.scene = 'kitchen';
    G.resize();
    G.startLoop();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      G.firstInteractiveMs = performance.now();
      G.started = true;
      document.getElementById('boot').classList.add('gone');
      // build the second scene in idle time, after the first one is playable
      const later = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
      setTimeout(() => later(() => { try { G.buildPicnic(); } catch (e) { G.logError(e.message); } }), 2500);
    }));
    // ambient birds at the picnic
    setInterval(() => { if (S.scene === 'picnic' && Math.random() < 0.5) G.sfx.play('bird'); }, 2600);
  }
  boot().catch((e) => G.logError('boot: ' + e.message));

  // ---------- test / debug hooks (used by the smoke test; harmless otherwise) ----------
  G.test = {
    screen(kind, i) {
      const B = G.bento, K = G.kitchen;
      switch (kind) {
        case 'tray': return toScreen(K.trays[i].pos);
        case 'box': return toScreen(boxToWorld(0, 0.3, 0, new T.Vector3()));
        case 'boxSpot': { const s = [[-0.8, -0.4], [0.7, 0.3], [0, 0], [-0.4, 0.5], [0.9, -0.5]][i % 5]; return toScreen(boxToWorld(s[0], 0.3, s[1], new T.Vector3())); }
        case 'lid': return toScreen(B.lid.localToWorld(new T.Vector3(0, 0.1, 0)));
        case 'corner': return toScreen(G.bentoApi.cornerWorld(i, new T.Vector3()));
        case 'shaker': return toScreen(v3.copy(K.shaker.position).setY(0.4));
        case 'cup': return toScreen(v3.copy(K.cupPos).setY(0.3));
        case 'animal': { const a = G.picnic.animals[i]; return toScreen(a.head.getWorldPosition(new T.Vector3())); }
        case 'item': { const it = boxItems()[i]; return it ? toScreen(boxToWorld(it.x, it.y + it.h * 0.5, it.z, new T.Vector3())) : null; }
        default: return null;
      }
    },
    items: () => boxItems().map((i) => ({ type: i.type, x: i.x, z: i.z, y: i.y, f: i.f, squash: i.squash, pick: !!i.pick })),
    sprinkles: () => F().sprinkles.length,
    // perf measurement helper: fill the box up to the food cap
    fill(n) {
      for (let k = 0; k < n && boxItems().length < G.tier.maxFoods; k++) {
        const it = F().make(k % 8, { state: 'box' });
        const sp = F().freeSpot(it.r); it.x = it.px = sp.x; it.z = it.pz = sp.z;
        if (k % 2 === 0) it.pick = F().newPick();
        F().items.push(it); F().settle(it);
      }
      for (let k = 0; k < 40; k++) F().dropSprinkles(G.rand(-1.4, 1.4), 1.5, G.rand(-0.9, 0.9), 12, 0.3);
      return boxItems().length;
    },
    checkNaN() {
      let bad = 0;
      G.scene.traverse((o) => {
        if (!isFinite(o.position.x + o.position.y + o.position.z)) bad++;
        if (o.geometry && o.geometry.attributes.normal) {
          const a = o.geometry.attributes.normal.array;
          for (let k = 0; k < a.length; k += 3) { const l = a[k] * a[k] + a[k + 1] * a[k + 1] + a[k + 2] * a[k + 2]; if (!(l > 0.5)) { bad++; break; } }
        }
        if (o.isInstancedMesh) { const a = o.instanceMatrix.array; for (let k = 0; k < o.count * 16; k++) if (!isFinite(a[k])) { bad++; break; } }
      });
      return bad;
    },
  };
})();
