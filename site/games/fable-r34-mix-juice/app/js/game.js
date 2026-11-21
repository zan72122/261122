/* game: state, input, animation. Everything moves by formulas (easing, damping, arcs, vortex). */
(function () {
  'use strict';
  var MJ = window.MJ, M = MJ.M, G = MJ.G, L = MJ.L, A = MJ.Audio;
  var V3 = THREE.Vector3;
  var W, S;
  var J = G.JUG, CUP = G.CUP;
  var FRUIT_VOL = 0.13, CUP_CAP = 0.3, MAX_TILT = 1.45;
  var SP = new V3(J.r1 + 0.16, J.h + 0.04, 0); // spout tip (jug local)
  var CUP_TOP = CUP.h;
  var tmp = new V3(), tmp2 = new V3(), tmpQ = new THREE.Quaternion(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  var UP = new V3(0, 1, 0);

  function labAcc() { return { L: 0, A: 0, B: 0, C: 0, W: 0 }; }
  function accAdd(acc, lab, w) { acc.L += lab[0] * w; acc.A += lab[1] * w; acc.B += lab[2] * w; acc.C += Math.hypot(lab[1], lab[2]) * w; acc.W += w; }
  function accColor(acc, out) {
    if (acc.W <= 1e-6) return out;
    // reuse MJ.mixLab on one synthetic item carrying the averaged values
    var lab = [acc.L / acc.W, acc.A / acc.W, acc.B / acc.W], c = Math.hypot(lab[1], lab[2]), C = acc.C / acc.W;
    if (c > 1e-4 && c < C) { lab[1] *= C / c; lab[2] *= C / c; }
    return MJ.mixLab([{ lab: lab, w: 1 }], out);
  }
  function hexLab(hex) { return MJ.toLab(new THREE.Color(hex)); }

  // ---------------------------------------------------------------- init
  MJ.Game = {};
  MJ.Game.init = function () {
    W = MJ.W;
    S = MJ.S = {
      time: 0, idle: 1.7, round: 1, kanpaiCount: 0, nextAnimal: 3,
      tray: [], flying: [], drag: null, pointer: null,
      jug: { volume: 0, pending: 0, acc: labAcc(), colA: new THREE.Color(0xffc070), target: new THREE.Color(0xffc070), colNew: new THREE.Color(0xffc070),
        newAmt: 0, spin: 0, motorOn: false, runIdle: 0, phase: 0, fruits: [], crushT: 0, state: 'home', pos: new V3(L.base.x, L.baseTop, L.base.z),
        vis: new V3(L.base.x, L.baseTop, L.base.z), tilt: 0, visTilt: 0, lock: 0, lockCup: -1, hover: 0, ref: 0, t: 0, from: new V3(), fromTilt: 0,
        kick: 0, foam: 0, rate: 0, glugT: 0, ray: null, grab: new V3(), wob: 0, btn: 0, swWob: 0 },
      chunks: [],
      cups: [], animals: [], kanpai: { active: false, t: 0, flags: {} },
      hint: { target: null, t: 0, cycle: 0, a: 0 },
      bottles: [], lastGive: -9, particles: []
    };
    var order = G.FRUIT_ORDER.slice();
    for (var i = 0; i < 6; i++) {
      var sl = { i: i, type: order[i], x: L.slots[i][0], z: L.slots[i][1], fruit: null, respawn: 0 };
      S.tray.push(sl); spawnTrayFruit(sl, 0.15 + i * 0.07);
    }
    for (i = 0; i < 3; i++) {
      S.cups.push({ i: i, w: W.cups[i], fill: 0, acc: labAcc(), color: new THREE.Color(0xffc070), state: 'table', t: 0,
        pos: W.cups[i].home.clone(), rotX: 0, wig: 0, bounce: 0, full: false, from: new V3(), fill0: 0 });
      S.animals.push(createAnimal(G.ANIMAL_ORDER[i], i, false));
    }
    setCupColors();
    initInput();
  };

  // ---------------------------------------------------------------- tray fruit
  function spawnTrayFruit(sl, delay) {
    var m = MJ.makeFruit(sl.type, 'hi'), cfg = G.FRUITS[sl.type];
    m.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
    m.position.set(sl.x, 0.11 + cfg.lift, sl.z);
    m.scale.setScalar(0.001);
    W.scene.add(m);
    var f = { type: sl.type, mesh: m, state: 'spawn', t: -(delay || 0), slot: sl, pos: m.position.clone(), vel: new V3(), wob: 0, bob: 0 };
    sl.fruit = f;
    return f;
  }
  function slotPos(sl, out) { return out.set(sl.x, 0.11 + G.FRUITS[sl.type].lift, sl.z); }

  // ---------------------------------------------------------------- animals
  function createAnimal(type, i, entering) {
    var a = MJ.makeAnimal(type);
    a.root.position.set(L.cupX[i], entering ? -2.6 : 0, L.animalZ);
    W.animalRoot.add(a.root);
    return { a: a, type: type, i: i, x: L.cupX[i], happyT: 0, hop: 0, wig: 0, blink: 1 + Math.random() * 3, blinkT: 0, cheer: 0,
      enter: entering ? 0 : 1, leaving: null, arm: 0, armZ: 0, lean: 0, yaw: 0, pitch: 0, pitchP: G.ANIMALS[type].pitch };
  }
  function setCupColors() {
    S.cups.forEach(function (c, i) { c.w.deco.color.setHex(MJ.CUP_COLORS[S.animals[i].type]); });
  }

  // ---------------------------------------------------------------- particles
  var _pc = new THREE.Color();
  function emit(o) {
    var P = S.particles; if (P.length >= W.fx.max) P.shift();
    _pc.set(o.color !== undefined ? o.color : 0xffffff);
    P.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g === undefined ? -6 : o.g, life: 0, max: o.life || 0.8,
      s0: o.size || 0.2, s1: o.size1 === undefined ? (o.size || 0.2) * 0.3 : o.size1, r: _pc.r, gg: _pc.g, b: _pc.b, shape: o.shape || 0, rot: o.rot || 0, vr: o.vr || 0, drag: o.drag || 0 });
  }
  function burst(p, n, o) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = M.rand(o.sp0 || 1, o.sp1 || 3), up = M.rand(o.up0 || 1, o.up1 || 3);
      emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * (o.zs === undefined ? 0.6 : o.zs), vy: up, g: o.g, life: M.rand(o.l0 || 0.5, o.l1 || 1.0),
        size: M.rand(o.s0 || 0.12, o.s1 || 0.22), size1: o.size1, color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color, shape: o.shape, rot: Math.random() * 6, vr: M.rand(-4, 4), drag: o.drag });
    }
  }
  function updateParticles(dt) {
    var P = S.particles, fx = W.fx, n = 0;
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.life += dt;
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      var dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    }
    for (i = 0; i < P.length && n < fx.max; i++, n++) {
      p = P[i];
      var k = p.life / p.max, s = M.lerp(p.s0, p.s1, k) * (k < 0.12 ? M.easeOutBack(k / 0.12) : 1);
      fx.aPos.setXYZ(n, p.x, p.y, p.z); fx.aCol.setXYZ(n, p.r, p.gg, p.b);
      fx.aMisc.setXYZW(n, s, p.shape, k > 0.7 ? (1 - k) / 0.3 : 1, p.rot);
    }
    fx.geo.instanceCount = n;
    if (n) { fx.aPos.needsUpdate = fx.aCol.needsUpdate = fx.aMisc.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- screen helpers
  function toScreen(v, out) {
    tmp2.copy(v).project(W.camera);
    var r = MJ.canvasRect;
    out = out || {};
    out.x = (tmp2.x * 0.5 + 0.5) * r.width; out.y = (-tmp2.y * 0.5 + 0.5) * r.height; out.z = tmp2.z;
    return out;
  }
  var _right = new V3();
  function pxRadius(center, r) {
    _right.setFromMatrixColumn(W.camera.matrixWorld, 0).multiplyScalar(r).add(center);
    var a = toScreen(center, {}), b = toScreen(_right, {});
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function setRay(x, y) {
    var r = MJ.canvasRect; ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
    ray.setFromCamera(ndc, W.camera); return ray.ray;
  }
  function rayPlaneZ(r, z, out) {
    var dz = r.direction.z; if (Math.abs(dz) < 1e-5) dz = -1e-5;
    var t = (z - r.origin.z) / dz; return out.copy(r.direction).multiplyScalar(t).add(r.origin);
  }
  function rayPlaneY(r, y, out) {
    var dy = r.direction.y; if (Math.abs(dy) < 1e-5) dy = -1e-5;
    var t = (y - r.origin.y) / dy; if (t < 0) t = 12; return out.copy(r.direction).multiplyScalar(t).add(r.origin);
  }
  function segDist(px, py, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y, l = vx * vx + vy * vy || 1;
    var t = M.sat(((px - a.x) * vx + (py - a.y) * vy) / l);
    return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
  }
  function jugPoint(y, out) { return W.jug.localToWorld(out.set(0, y, 0)); }

  // ---------------------------------------------------------------- picking
  function candidates() {
    var list = [];
    S.tray.forEach(function (sl) {
      var f = sl.fruit; if (!f || (f.state !== 'tray' && f.state !== 'spawn')) return;
      list.push({ kind: 'fruit', f: f, c: tmp.copy(f.mesh.position).add(new V3(0, 0.4, 0)).clone(), r: G.FRUITS[f.type].hit });
    });
    list.push({ kind: 'switch', c: W.switchGroup.getWorldPosition(new V3()), r: 0.62, pri: 0.85 });
    list.push({ kind: 'jug', seg: [jugPoint(0.4, new V3()), jugPoint(2.1, new V3())], r: 1.0 });
    S.cups.forEach(function (c) { list.push({ kind: 'cup', cup: c, c: c.pos.clone().add(new V3(0, 0.55, 0)), r: 0.68 }); });
    S.animals.forEach(function (an) { if (an.enter >= 1 && !an.leaving) list.push({ kind: 'animal', an: an, c: an.a.head.getWorldPosition(new V3()), r: 0.85, pri: 1.15 }); });
    S.bottles.forEach(function (b) { list.push({ kind: 'bottle', b: b, c: b.pos.clone().add(new V3(0, 0.4, 0)), r: 0.4 }); });
    return list;
  }
  function pick(x, y) {
    var best = null, bs = 1;
    candidates().forEach(function (c) {
      var d, rp;
      if (c.seg) {
        var a = toScreen(c.seg[0], {}), b = toScreen(c.seg[1], {});
        d = segDist(x, y, a, b); rp = pxRadius(c.seg[0], c.r);
      } else { var s = toScreen(c.c, {}); d = Math.hypot(x - s.x, y - s.y); rp = pxRadius(c.c, c.r); }
      var score = (d / Math.max(rp, 8)) * (c.pri || 1);
      if (score < bs) { bs = score; best = c; }
    });
    return best;
  }

  // ---------------------------------------------------------------- input
  function initInput() {
    var cv = MJ.renderer.domElement;
    cv.addEventListener('pointerdown', onDown, { passive: false });
    cv.addEventListener('pointermove', onMove, { passive: false });
    cv.addEventListener('pointerup', onUp, { passive: false });
    cv.addEventListener('pointercancel', onUp, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var again = document.getElementById('again');
    if (again) again.addEventListener('pointerdown', function (e) { e.preventDefault(); A.unlock(); S.idle = 0; newRound(); });
  }
  function local(e) { var r = MJ.canvasRect; return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function onDown(e) {
    e.preventDefault();
    A.unlock();
    S.idle = 0;
    if (S.pointer !== null) return;
    var p = local(e);
    S.pointer = e.pointerId;
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var hit = pick(p.x, p.y);
    S.drag = { kind: hit ? hit.kind : 'none', sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false, t0: S.time };
    if (!hit) { touchSparkle(p); return; }
    if (hit.kind === 'fruit') { S.drag.f = hit.f; grabFruit(hit.f, p); }
    else if (hit.kind === 'switch') toggleMotor();
    else if (hit.kind === 'jug') grabJug(p);
    else if (hit.kind === 'cup') touchCup(hit.cup);
    else if (hit.kind === 'animal') tickle(hit.an);
    else if (hit.kind === 'bottle') { hit.b.wig = 1; A.tink(); }
  }
  function onMove(e) {
    if (e.pointerId !== S.pointer || !S.drag) return;
    e.preventDefault();
    S.idle = 0;
    var p = local(e), d = S.drag;
    d.x = p.x; d.y = p.y;
    if (Math.hypot(p.x - d.sx, p.y - d.sy) > 10) d.moved = true;
    if (d.kind === 'fruit' && d.f) dragFruit(d.f, p);
    if (d.kind === 'jug') S.jug.ray = setRay(p.x, p.y).clone();
  }
  function onUp(e) {
    if (e.pointerId !== S.pointer) return;
    S.pointer = null;
    var d = S.drag; S.drag = null;
    if (!d) return;
    if (d.kind === 'fruit' && d.f) releaseFruit(d.f, d);
    if (d.kind === 'jug') {
      // a quick tap on the jug pours by itself into the next cup (dragging gives full control)
      if (!d.moved && S.time - d.t0 < 0.45 && S.jug.volume > 0.02) startAutoPour(); else releaseJug();
    }
  }
  function touchSparkle(p) {
    var r = setRay(p.x, p.y), hp = rayPlaneY(r, 0.05, new V3());
    if (hp.z < -3.0) hp = rayPlaneZ(r, -6.3, new V3());
    burst(hp, 6, { color: [0xffe066, 0xffffff, 0xff9ec6], shape: 2, sp0: 0.5, sp1: 1.5, up0: 0.8, up1: 2, g: -2, s0: 0.12, s1: 0.2, l0: 0.4, l1: 0.7 });
    A.sparkle();
  }

  // ---------------------------------------------------------------- fruit
  function grabFruit(f, p) {
    f.state = 'drag'; f.t = 0; f.mesh.scale.setScalar(1);
    f.grabPlaneN = new V3().setFromMatrixColumn(W.camera.matrixWorld, 2); // towards camera
    f.grabPoint = f.mesh.position.clone().add(new V3(0, 0.6, 0));
    f.target = f.grabPoint.clone(); f.wob = 1;
    A.pick();
  }
  function dragFruit(f, p) {
    var r = setRay(p.x, p.y);
    var plane = new THREE.Plane().setFromNormalAndCoplanarPoint(f.grabPlaneN, f.grabPoint);
    var hit = r.intersectPlane(plane, new V3());
    if (hit) { hit.y = Math.max(hit.y, 0.25); f.target.copy(hit).add(new V3(0, -0.2, 0)); }
  }
  function nearJug(f) {
    var s = toScreen(f.mesh.position, {});
    var a = toScreen(jugPoint(0.0, new V3()), {}), b = toScreen(jugPoint(J.h + 0.8, new V3()), {});
    return segDist(s.x, s.y, a, b) < pxRadius(jugPoint(1.2, new V3()), 1.6);
  }
  function releaseFruit(f, d) {
    if (!d.moved || nearJug(f)) flyToJug(f);
    else { f.state = 'return'; f.t = 0; f.from = f.mesh.position.clone(); A.boing(); }
  }
  function flyToJug(f) {
    f.state = 'fly'; f.t = 0; f.from = f.mesh.position.clone(); f.wob = 1;
    f.dur = M.clamp(f.from.distanceTo(W.jug.position) * 0.075 + 0.32, 0.35, 0.7);
    var sl = f.slot; sl.fruit = null; sl.respawn = 0.4; f.slot = null;
    S.flying.push(f);
    A.pop(G.FRUITS[f.type].pitch);
  }
  function updateTray(dt) {
    S.tray.forEach(function (sl, idx) {
      if (!sl.fruit) {
        sl.respawn -= dt;
        if (sl.respawn <= 0) { spawnTrayFruit(sl, 0); A.pop(1.6); burst(slotPos(sl, new V3()).add(new V3(0, 0.5, 0)), 5, { color: 0xffffff, shape: 2, sp0: 0.6, sp1: 1.4, up0: 1, up1: 2, g: -3, s0: 0.1, s1: 0.16, l0: 0.35, l1: 0.6 }); }
        return;
      }
      var f = sl.fruit, m = f.mesh, cfg = G.FRUITS[f.type], home = slotPos(sl, tmp);
      if (f.state === 'spawn') {
        f.t += dt; var k = M.sat(f.t / 0.42);
        m.scale.setScalar(Math.max(M.easeOutBack(k), 0.001));
        m.position.copy(home);
        if (k >= 1) f.state = 'tray';
      } else if (f.state === 'tray') {
        var hb = S.hint.target && S.hint.target.kind === 'fruit' && S.hint.target.f === f ? S.hint.a : 0;
        var hop = Math.abs(Math.sin(S.time * 7)) * 0.28 * hb;
        f.wob = Math.max(0, f.wob - dt * 1.5);
        m.position.set(home.x, home.y + hop, home.z);
        var sq = 1 + Math.sin(S.time * 14) * 0.08 * hb;
        m.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        m.rotation.set(cfg.rot[0], cfg.rot[1] + Math.sin(S.time * 1.3 + idx) * 0.06, cfg.rot[2] + M.boing(1 - f.wob, 3) * 0.3);
      } else if (f.state === 'drag') {
        m.position.x = M.damp(m.position.x, f.target.x, 22, dt);
        m.position.y = M.damp(m.position.y, f.target.y, 22, dt);
        m.position.z = M.damp(m.position.z, f.target.z, 22, dt);
        f.t += dt;
        m.rotation.z = cfg.rot[2] + Math.sin(f.t * 9) * 0.15;
        m.scale.setScalar(1.12);
      } else if (f.state === 'return') {
        f.t += dt / 0.35; var e = M.easeOut(f.t);
        m.position.lerpVectors(f.from, home, e); m.position.y += Math.sin(Math.min(f.t, 1) * Math.PI) * 0.5;
        m.scale.setScalar(M.lerp(1.12, 1, e));
        if (f.t >= 1) { f.state = 'tray'; f.wob = 1; m.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]); }
      }
    });
  }
  function updateFlying(dt) {
    for (var i = S.flying.length - 1; i >= 0; i--) {
      var f = S.flying[i], m = f.mesh;
      f.t += dt / f.dur;
      var mouth = jugPoint(J.h + 0.75, tmp);
      var e = M.sat(f.t);
      m.position.lerpVectors(f.from, mouth, M.easeInOut(e));
      m.position.y += Math.sin(e * Math.PI) * 1.3;
      m.rotation.x += dt * 6; m.rotation.z += dt * 3;
      m.scale.setScalar(M.lerp(1.1, 0.62, e));
      if (f.t >= 1) { S.flying.splice(i, 1); enterJug(f); }
    }
  }
  function enterJug(f) {
    var m = f.mesh;
    W.jug.updateMatrixWorld(true);
    var lp = W.jug.worldToLocal(m.position.clone());
    W.scene.remove(m);
    m.geometry = G.fruitGeo(f.type, 'lo');
    m.scale.setScalar(0.62);
    m.position.copy(lp);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    W.jugFruitRoot.add(m);
    f.state = 'fall'; f.vy = -1.5; f.t = 0;
    S.jug.fruits.push(f);
    S.jug.runIdle = 0;
  }
  function jugLevel() { return J.liqY0 + M.sat(S.jug.volume) * (J.liqY1 - J.liqY0); }
  function restTarget(k, out) {
    var ang = k * 2.4, rad = (k % 3 === 0) ? 0.06 : 0.3;
    var y = 0.5 + Math.floor(k / 3) * 0.3;
    var lv = jugLevel() - 0.12;
    if (S.jug.volume > 0.02 && lv > y) y = lv + Math.sin(S.time * 2 + k) * 0.03;
    return out.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
  }
  function updateJugFruits(dt) {
    var jug = S.jug, k = 0;
    for (var i = jug.fruits.length - 1; i >= 0; i--) {
      var f = jug.fruits[i];
      if (f.state === 'crush') {
        f.t += dt;
        var m = f.mesh, e = M.sat(f.t / 0.34);
        f.ang = (f.ang || Math.atan2(m.position.z, m.position.x)) + dt * (6 + 14 * e);
        var rr = M.lerp(Math.hypot(m.position.x, m.position.z), 0.15, e * 0.3);
        m.position.x = Math.cos(f.ang) * rr + (Math.random() - 0.5) * 0.06;
        m.position.z = Math.sin(f.ang) * rr + (Math.random() - 0.5) * 0.06;
        m.position.y = M.damp(m.position.y, 0.45, 6, dt);
        m.rotation.y += dt * 20;
        m.scale.setScalar(0.62 * (1 - e * 0.6));
        if (f.t >= 0.34) { jug.fruits.splice(i, 1); finishCrush(f); }
      }
    }
    // order of resting fruits = order of arrival
    for (i = 0; i < jug.fruits.length; i++) {
      f = jug.fruits[i]; m = f.mesh;
      if (f.state === 'fall') {
        var tgt = restTarget(k, tmp);
        f.vy -= 14 * dt; m.position.y += f.vy * dt;
        m.position.x = M.damp(m.position.x, tgt.x, 6, dt); m.position.z = M.damp(m.position.z, tgt.z, 6, dt);
        var wet = jug.volume > 0.02 && m.position.y < jugLevel();
        if (m.position.y <= tgt.y || wet) {
          f.state = 'rest'; f.t = 0;
          A.plop(wet);
          var wp = W.jug.localToWorld(new V3(m.position.x, Math.max(m.position.y, jugLevel()), m.position.z));
          if (wet) { burst(wp, 8, { color: jug.colA.getHex(), shape: 3, sp0: 0.6, sp1: 1.6, up0: 2, up1: 3.5, g: -9, s0: 0.08, s1: 0.14, l0: 0.4, l1: 0.6 }); A.splash(); }
          f.squash = 1;
        }
        k++;
      } else if (f.state === 'rest') {
        tgt = restTarget(k, tmp);
        m.position.x = M.damp(m.position.x, tgt.x, 8, dt); m.position.y = M.damp(m.position.y, tgt.y, 8, dt); m.position.z = M.damp(m.position.z, tgt.z, 8, dt);
        f.squash = Math.max(0, (f.squash || 0) - dt * 3);
        var sq = 1 - M.boing(1 - f.squash, 2) * 0.25;
        m.scale.set(0.62 / Math.sqrt(sq), 0.62 * sq, 0.62 / Math.sqrt(sq));
        if (jug.spin > 0.2) { m.rotation.y += dt * jug.spin * 6; }
        k++;
      }
    }
    // crushing while the motor runs on the base
    if (jug.spin > 0.55 && jug.state === 'home') {
      jug.crushT -= dt;
      if (jug.crushT <= 0) {
        for (i = 0; i < jug.fruits.length; i++) if (jug.fruits[i].state === 'rest' || jug.fruits[i].state === 'fall') {
          jug.fruits[i].state = 'crush'; jug.fruits[i].t = 0; jug.crushT = 0.3; jug.runIdle = 0; break;
        }
      }
    }
    // too many whole fruits without blending: the oldest one gets squashed into juice anyway
    var resting = jug.fruits.filter(function (x) { return x.state === 'rest'; });
    if (resting.length > 12) { resting[0].state = 'crush'; resting[0].t = 0; }
  }
  function finishCrush(f) {
    var jug = S.jug, cfg = G.FRUITS[f.type], m = f.mesh;
    W.jugFruitRoot.remove(m);
    jug.pending += FRUIT_VOL;
    accAdd(jug.acc, hexLab(cfg.flesh), FRUIT_VOL);
    accColor(jug.acc, jug.target);
    jug.colNew.setHex(cfg.flesh);
    jug.newAmt = 1; jug.kick = 1;
    if (jug.volume < 0.01) jug.colA.setHex(cfg.flesh);
    A.crunch();
    for (var i = 0; i < 5; i++) {
      if (S.chunks.length >= 36) S.chunks.shift();
      S.chunks.push({ ang: Math.random() * 6.28, r: M.rand(0.15, 0.5), y: M.rand(0.4, 0.8), life: 0, max: M.rand(1.0, 1.8), s: M.rand(0.7, 1.2), col: new THREE.Color(cfg.chunk), spin: M.rand(2, 6) });
    }
    var top = W.jug.localToWorld(new V3(0, Math.max(jugLevel(), 0.8), 0));
    burst(top, 6, { color: cfg.flesh, shape: 3, sp0: 0.5, sp1: 1.3, up0: 1.5, up1: 3, g: -9, s0: 0.07, s1: 0.13, l0: 0.35, l1: 0.55 });
  }
  function updateChunks(dt) {
    var jug = S.jug, im = W.chunks, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
    var lv = jugLevel();
    for (var i = S.chunks.length - 1; i >= 0; i--) {
      var c = S.chunks[i]; c.life += dt;
      if (c.life > c.max) { S.chunks.splice(i, 1); continue; }
      c.ang += dt * (3 + jug.spin * 9) * (1.2 - c.r);
      c.r = M.damp(c.r, 0.2 + 0.25 * Math.sin(c.life * 3 + i), 2, dt);
      c.y = M.damp(c.y, Math.min(lv - 0.1, 0.4 + c.r * 1.4), 3, dt);
    }
    for (i = 0; i < S.chunks.length; i++) {
      c = S.chunks[i];
      var sc = c.s * (1 - M.smooth(0.3, 1, c.life / c.max)) + 0.001;
      e.set(c.life * c.spin, c.ang, 0); q.setFromEuler(e); s.set(sc, sc, sc);
      mtx.compose(tmp.set(Math.cos(c.ang) * c.r, c.y, Math.sin(c.ang) * c.r), q, s);
      im.setMatrixAt(i, mtx); im.setColorAt(i, c.col);
    }
    im.count = S.chunks.length;
    if (im.count) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- motor
  function toggleMotor() {
    var jug = S.jug;
    jug.btn = 1;
    if (jug.state !== 'home') { A.boing(); jug.swWob = 1; return; }
    jug.motorOn = !jug.motorOn; jug.runIdle = 0;
    A.click(); A.motor(jug.motorOn);
  }
  function stopMotor() { if (S.jug.motorOn) { S.jug.motorOn = false; A.motor(false); } }

  // ---------------------------------------------------------------- jug drag & pour
  function grabJug(p) {
    var jug = S.jug;
    stopMotor();
    jug.state = 'held'; jug.lock = 0; jug.lockCup = -1; jug.hover = 0;
    var r = setRay(p.x, p.y);
    jug.ray = r.clone();
    var hp = rayPlaneZ(r, jug.pos.z, new V3());
    jug.grab.set(jug.pos.x - hp.x, jug.pos.y - hp.y, 0);
    A.pick();
  }
  function releaseJug() {
    var jug = S.jug;
    jug.state = 'return'; jug.t = 0; jug.from.copy(jug.vis); jug.fromTilt = jug.visTilt;
    jug.lock = 0; jug.lockCup = -1;
  }
  function spoutRel(th, out) { // R(-th) * SP
    var c = Math.cos(th), s = Math.sin(th);
    return out.set(SP.x * c + SP.y * s, -SP.x * s + SP.y * c, 0);
  }
  var free = new V3(), lockP = new V3(), sr = new V3();
  function updateJugHeld(dt) {
    var jug = S.jug, home = L.base;
    if (!jug.ray) return;
    var r = jug.ray;
    var hp = rayPlaneZ(r, home.z, tmp);
    var fx = hp.x + jug.grab.x;
    var s = M.smooth(home.x + 0.6, L.cupX[0] - 2.2, fx);
    var zT = M.lerp(home.z, L.cupZ, s);
    hp = rayPlaneZ(r, zT, tmp);
    free.set(M.clamp(hp.x + jug.grab.x, -2.6, 5.2), hp.y + jug.grab.y, zT);
    var rawY = free.y;
    free.y = Math.max(free.y, M.lerp(L.baseTop + 0.02, 1.3, s));
    free.y = Math.min(free.y, 4.2);
    // nearest waiting cup under the spout
    var best = -1, bd = 9;
    S.cups.forEach(function (c, i) { if (c.state !== 'table') return; var d = Math.abs(free.x + SP.x - c.pos.x); if (d < bd) { bd = d; best = i; } });
    var cur = jug.lockCup >= 0 && S.cups[jug.lockCup].state === 'table' ? Math.abs(free.x + SP.x - S.cups[jug.lockCup].pos.x) : 99;
    var keep = cur < 1.05 && rawY < jug.ref + 1.4;
    if (keep && best >= 0 && best !== jug.lockCup && bd < cur - 0.35) keep = false; // slid over to the next cup
    var capture = keep || (s > 0.7 && best >= 0 && bd < 0.85);
    if (capture && !keep) { jug.lockCup = best; jug.ref = rawY; jug.hover = 0; }
    if (!capture) { jug.lockCup = -1; jug.hover = 0; }
    jug.lock = M.damp(jug.lock, capture ? 1 : 0, 9, dt);
    var th = 0;
    if (jug.lockCup >= 0) {
      jug.hover += dt;
      var push = M.sat((jug.ref - rawY) / 1.5);
      var thStart = Math.atan2(Math.max(J.h + 0.04 - jugLevel(), 0.01), SP.x);
      var auto = jug.volume > 0.01 ? M.smooth(0.25, 0.9, jug.hover) * Math.min(thStart + 0.14, MAX_TILT) : M.smooth(0.25, 0.9, jug.hover) * 0.5;
      th = Math.max(auto, push * MAX_TILT);
      var cup = S.cups[jug.lockCup];
      spoutRel(th, sr);
      var oy = Math.max(CUP_TOP + 0.85 - sr.y, M.lerp(1.6, 0.5, M.sat(th / 0.9)));
      lockP.set(cup.pos.x - 0.02 - sr.x, oy, cup.pos.z);
    }
    jug.tilt = M.damp(jug.tilt, th * (jug.lockCup >= 0 ? 1 : 0), 8, dt);
    if (jug.lockCup >= 0) {
      spoutRel(jug.tilt, sr);
      var cupL = S.cups[jug.lockCup];
      var oy2 = Math.max(CUP_TOP + 0.85 - sr.y, M.lerp(1.6, 0.5, M.sat(jug.tilt / 0.9)));
      lockP.set(cupL.pos.x - 0.02 - sr.x, oy2, cupL.pos.z);
      jug.pos.lerpVectors(free, lockP, M.sat(jug.lock));
    } else jug.pos.copy(free);
  }
  function startAutoPour() {
    var jug = S.jug, pick = -1;
    var h = S.hint.target && S.hint.target.kind === 'cup' ? S.hint.target.cup.i : -1;
    S.cups.forEach(function (c, i) { if (pick < 0 && c.state === 'table' && c.fill < 0.9) pick = i; });
    if (pick < 0) { releaseJug(); return; }
    jug.state = 'auto'; jug.t = 0; jug.lockCup = pick; jug.lock = 0; jug.from.copy(jug.pos);
  }
  function lockedPose(cup, th, out) {
    spoutRel(th, sr);
    return out.set(cup.pos.x - 0.02 - sr.x, Math.max(CUP_TOP + 0.85 - sr.y, M.lerp(1.6, 0.5, M.sat(th / 0.9))), cup.pos.z);
  }
  function updateAutoPour(dt) {
    var jug = S.jug, cup = S.cups[jug.lockCup];
    jug.t += dt;
    if (!cup || cup.state !== 'table') { releaseJug(); return; }
    var thStart = Math.atan2(Math.max(J.h + 0.04 - jugLevel(), 0.01), SP.x);
    var th = jug.t < 0.55 ? 0 : Math.min(thStart + 0.3, MAX_TILT);
    jug.tilt = M.damp(jug.tilt, th, 5, dt);
    jug.lock = M.sat(jug.t / 0.55);
    var e = M.easeInOut(jug.lock);
    lockedPose(cup, jug.tilt, lockP);
    jug.pos.lerpVectors(jug.from, lockP, e);
    jug.pos.y += Math.sin(e * Math.PI) * 0.6;
    if (jug.t > 2.1 || cup.fill >= 0.999 || (jug.volume <= 0.001 && jug.t > 0.8)) releaseJug();
  }
  function updateJug(dt) {
    var jug = S.jug, home = tmp2.set(L.base.x, L.baseTop, L.base.z);
    if (jug.state === 'held') updateJugHeld(dt);
    else if (jug.state === 'auto') updateAutoPour(dt);
    else if (jug.state === 'return') {
      jug.t += dt / 0.5; var e = M.easeInOut(jug.t);
      jug.pos.lerpVectors(jug.from, home, e); jug.pos.y += Math.sin(Math.min(jug.t, 1) * Math.PI) * 0.35;
      jug.tilt = M.lerp(jug.fromTilt, 0, M.easeOut(jug.t));
      if (jug.t >= 1) { jug.state = 'home'; jug.pos.copy(home); jug.tilt = 0; jug.kick = 0.6; A.click(); }
    } else { jug.pos.copy(home); jug.tilt = 0; }

    // motor & vortex
    jug.spin = M.damp(jug.spin, jug.motorOn ? 1 : 0, jug.motorOn ? 4 : 2.2, dt);
    if (jug.motorOn) {
      jug.runIdle += dt;
      var busy = jug.fruits.some(function (f) { return f.state !== 'rest' || true; }) && jug.fruits.length > 0;
      if (!busy && jug.runIdle > 4.5) stopMotor();
      if (busy) jug.runIdle = Math.min(jug.runIdle, 1);
    }
    A.motorLoad(jug.fruits.some(function (f) { return f.state === 'crush'; }) ? 1 : 0.15 * jug.spin);
    jug.phase += dt * (0.25 + jug.spin * 7.5);
    W.blades.rotation.y += dt * jug.spin * 48;
    jug.kick = Math.max(0, jug.kick - dt * 3);
    jug.foam = M.damp(jug.foam, jug.spin, 2, dt);

    // volume grows as fruit is crushed
    if (jug.pending > 0) {
      var add = Math.min(jug.pending, dt * 0.45); jug.pending -= add;
      jug.volume = Math.min(1, jug.volume + add);
    }
    jug.colA.r = M.damp(jug.colA.r, jug.target.r, jug.spin > 0.1 ? 2.6 : 1.2, dt);
    jug.colA.g = M.damp(jug.colA.g, jug.target.g, jug.spin > 0.1 ? 2.6 : 1.2, dt);
    jug.colA.b = M.damp(jug.colA.b, jug.target.b, jug.spin > 0.1 ? 2.6 : 1.2, dt);
    jug.newAmt = Math.max(0, jug.newAmt - dt * (jug.spin > 0.2 ? 0.38 : 0.6));

    // pour
    jug.rate = 0;
    if ((jug.state === 'held' || jug.state === 'auto') && jug.lockCup >= 0 && jug.lock > 0.8 && jug.volume > 0.001) {
      var cup = S.cups[jug.lockCup];
      var excess = jugLevel() + Math.tan(Math.min(jug.tilt, 1.45)) * SP.x - (J.h + 0.04);
      if (excess > 0 && cup.fill < 1) {
        jug.rate = M.clamp(0.05 + excess * 0.22, 0.05, 0.4);
        var d = Math.min(jug.rate * dt, jug.volume, (1 - cup.fill) * CUP_CAP);
        jug.volume -= d; cup.fill += d / CUP_CAP;
        accAdd(cup.acc, MJ.toLab(jug.colA), d); accColor(cup.acc, cup.color);
        jug.glugT -= dt;
        if (jug.glugT <= 0) { jug.glugT = M.clamp(0.24 - jug.rate * 0.3, 0.1, 0.24); A.glug(0.8 + cup.fill * 0.7); }
        if (cup.fill >= 0.999 && !cup.full) { cup.full = true; A.sparkle(); burst(cup.pos.clone().add(new V3(0, 1.3, 0)), 8, { color: [0xffffff, 0xffe066], shape: 2, sp0: 0.5, sp1: 1.4, up0: 1, up1: 2.5, g: -3, s0: 0.1, s1: 0.18 }); }
      }
      if (jug.volume <= 0.001) { jug.volume = 0; }
    }
    if (jug.volume <= 0.001 && jug.pending <= 0) { jug.volume = 0; jug.acc = labAcc(); }

    // visual pose
    var shake = 0.012 * jug.spin + 0.05 * jug.kick;
    jug.vis.x = M.damp(jug.vis.x, jug.pos.x, 20, dt); jug.vis.y = M.damp(jug.vis.y, jug.pos.y, 20, dt); jug.vis.z = M.damp(jug.vis.z, jug.pos.z, 20, dt);
    if (jug.state !== 'held' && jug.state !== 'auto') jug.vis.copy(jug.pos);
    jug.visTilt = (jug.state === 'held' || jug.state === 'auto') ? M.damp(jug.visTilt, jug.tilt, 18, dt) : jug.tilt;
    var hintJ = S.hint.target && S.hint.target.kind === 'jug' ? S.hint.a : 0;
    W.jug.position.set(jug.vis.x + (Math.random() - 0.5) * shake, jug.vis.y + (Math.random() - 0.5) * shake * 0.5 + Math.abs(Math.sin(S.time * 7)) * 0.18 * hintJ, jug.vis.z);
    W.jug.rotation.set(0, 0, -jug.visTilt + Math.sin(S.time * 9) * 0.05 * hintJ);
    W.blender.position.set(L.base.x + (Math.random() - 0.5) * shake * 0.5, 0, L.base.z);
    W.jugFrontMat.uniforms.uGlow.value = hintJ * (0.6 + 0.4 * Math.sin(S.time * 6));

    // switch look
    jug.btn = Math.max(0, jug.btn - dt * 4); jug.swWob = Math.max(0, jug.swWob - dt * 2);
    var hintS = S.hint.target && S.hint.target.kind === 'switch' ? S.hint.a : 0;
    W.switchBtn.position.z = (jug.motorOn ? -0.07 : 0) - jug.btn * 0.06;
    var glow = jug.motorOn ? 0.45 + 0.25 * Math.sin(S.time * 14) : hintS * (0.35 + 0.35 * Math.sin(S.time * 6));
    W.switchMat.emissive.setRGB(glow, glow * 0.75, glow * 0.15);
    var ps = 1 + hintS * 0.12 * Math.abs(Math.sin(S.time * 6)) + M.boing(1 - jug.swWob, 4) * 0.15;
    W.switchGroup.scale.setScalar(ps);

    // liquid uniforms
    var lq = W.liquid, u = lq.u;
    lq.group.visible = jug.volume > 0.004;
    u.uLevel.value = jugLevel(); u.uSpin.value = jug.spin; u.uPhase.value = jug.phase; u.uTime.value = S.time;
    u.uColA.value.copy(jug.colA); u.uColNew.value.copy(jug.colNew); u.uNewAmt.value = jug.newAmt; u.uFoam.value = jug.foam;
    u.uDepth.value = Math.min(0.6, jug.volume * 0.9);
    setSlope(u, W.jug);

    // stream
    var st = W.stream;
    if (jug.rate > 0) {
      var cupS = S.cups[jug.lockCup];
      W.jug.updateMatrixWorld(true);
      var p0 = W.jug.localToWorld(st.u.uP0.value.set(SP.x - 0.02, SP.y - 0.02, 0));
      var ly = cupS.pos.y + CUP.liqY0 + cupS.fill * (CUP.liqY1 - CUP.liqY0);
      st.u.uP1.value.set(cupS.pos.x, ly, cupS.pos.z);
      st.u.uC.value.set(p0.x + 0.18, p0.y + 0.05, p0.z);
      st.u.uW.value = M.damp(st.u.uW.value, 0.035 + jug.rate * 0.22, 10, dt);
      st.u.uCol.value.copy(jug.colA); st.u.uTime.value = S.time;
      st.mesh.visible = true;
      if (Math.random() < dt * 12) emit({ x: cupS.pos.x + M.rand(-0.15, 0.15), y: ly + 0.05, z: cupS.pos.z + M.rand(-0.1, 0.1), vx: M.rand(-0.8, 0.8), vy: M.rand(1, 2), vz: M.rand(-0.3, 0.3), g: -9, life: 0.35, size: 0.07, size1: 0.05, color: jug.colA.getHex(), shape: 3 });
    } else { st.u.uW.value = M.damp(st.u.uW.value, 0, 14, dt); st.mesh.visible = st.u.uW.value > 0.006 && jug.lockCup >= 0; }
  }
  var _qi = new THREE.Quaternion(), _up = new V3();
  function setSlope(u, obj) {
    obj.updateMatrixWorld(true);
    obj.getWorldQuaternion(_qi).invert();
    _up.copy(UP).applyQuaternion(_qi);
    var uy = Math.max(_up.y, 0.25);
    u.uSlope.value.set(M.clamp(-_up.x / uy, -4, 4), M.clamp(-_up.z / uy, -4, 4));
  }

  // ---------------------------------------------------------------- cups, giving, kanpai
  function touchCup(c) {
    if (c.state === 'table' && c.fill > 0.04) giveCup(c);
    else { c.wig = 1; A.tink(); var an = S.animals[c.i]; an.wig = 0.6; }
  }
  function giveCup(c) {
    c.state = 'give'; c.t = 0; c.from.copy(c.pos);
    A.pick(); A.whoosh();
  }
  function holdPos(c, out) { var an = S.animals[c.i]; return out.set(an.x, L.holdY + Math.sin(S.time * 2 + c.i) * 0.02, L.holdZ); }
  function updateCups(dt) {
    var K = S.kanpai;
    S.cups.forEach(function (c, i) {
      var an = S.animals[i];
      c.wig = Math.max(0, c.wig - dt * 2.2); c.bounce = Math.max(0, c.bounce - dt);
      if (c.state === 'give') {
        c.t += dt / 0.55; var e = M.easeInOut(c.t);
        var hpos = holdPos(c, tmp);
        c.pos.lerpVectors(c.from, hpos, e); c.pos.y += Math.sin(Math.min(c.t, 1) * Math.PI) * 0.7;
        if (c.t >= 1) {
          c.state = 'held'; S.lastGive = S.time;
          an.happyT = 2.2; an.hop = 1;
          A.chirp(an.pitchP);
          var hp = an.a.head.getWorldPosition(new V3()).add(new V3(0, 0.6, 0.3));
          burst(hp, 7, { color: [0xff5c8a, 0xff8fb1, 0xffb3c8], shape: 1, sp0: 0.4, sp1: 1.2, up0: 1.2, up1: 2.4, g: -0.6, s0: 0.22, s1: 0.34, size1: 0.3, l0: 0.9, l1: 1.4, drag: 1.2 });
        }
      } else if (c.state === 'held') {
        holdPos(c, c.pos);
      } else if (c.state === 'table') {
        var hb = S.hint.target && S.hint.target.kind === 'cup' && S.hint.target.cup === c ? S.hint.a : 0;
        c.pos.copy(c.w.home);
        c.pos.y += Math.abs(Math.sin(S.time * 7)) * 0.22 * hb;
        c.rotX = M.damp(c.rotX, 0, 8, dt);
      } else if (c.state === 'back') {
        c.t += dt / 0.6; e = M.easeInOut(c.t);
        c.pos.lerpVectors(c.from, c.w.home, e); c.pos.y += Math.sin(Math.min(c.t, 1) * Math.PI) * 0.4;
        c.rotX = M.lerp(c.rotX, 0, e);
        if (c.t >= 1) { c.state = 'table'; c.pos.copy(c.w.home); c.rotX = 0; }
      }
      // kanpai choreography handled in updateKanpai (raise / drink)
      var g = c.w.group, wig = M.boing(1 - c.wig, 4) * 0.18;
      g.position.copy(c.pos);
      g.rotation.set(c.rotX, 0, wig);
      var lq = c.w.liquid;
      lq.group.visible = c.fill > 0.01;
      lq.u.uLevel.value = CUP.liqY0 + M.sat(c.fill) * (CUP.liqY1 - CUP.liqY0);
      lq.u.uColA.value.copy(c.color); lq.u.uColNew.value.copy(c.color); lq.u.uTime.value = S.time;
      lq.u.uPhase.value = S.time * 0.3;
      setSlope(lq.u, g);
      var hb2 = S.hint.target && S.hint.target.kind === 'cup' && S.hint.target.cup === c ? S.hint.a : 0;
      var ready = c.state === 'table' && c.fill > 0.04;
      c.w.front.uniforms.uGlow.value = Math.max(hb2, ready ? 0.35 : 0) * (0.6 + 0.4 * Math.sin(S.time * 6)) + (S.jug.lockCup === i ? 0.4 : 0);
    });
  }
  function startKanpai() {
    var K = S.kanpai; K.active = true; K.t = 0; K.flags = {};
    K.cups = S.cups.filter(function (c) { return c.state === 'held'; });
    K.cups.forEach(function (c) { c.state = 'kanpai'; c.from.copy(c.pos); c.fill0 = c.fill; });
    var cx = 0; K.cups.forEach(function (c) { cx += S.animals[c.i].x; }); K.cx = cx / K.cups.length;
    var acc = labAcc(); K.cups.forEach(function (c) { var l = MJ.toLab(c.color); accAdd(acc, l, Math.max(c.fill, 0.05)); });
    K.color = accColor(acc, new THREE.Color());
  }
  function updateKanpai(dt) {
    var K = S.kanpai;
    if (!K.active) {
      var held = S.cups.filter(function (c) { return c.state === 'held'; }).length;
      var moving = S.cups.some(function (c) { return c.state === 'give'; });
      var jugBusy = S.jug.state === 'held';
      if (held > 0 && !moving && !jugBusy && (held === S.cups.length || (S.idle > 2.4 && S.time - S.lastGive > 1.5))) startKanpai();
      return;
    }
    K.t += dt; var t = K.t, F = K.flags;
    K.cups.forEach(function (c) {
      var an = S.animals[c.i];
      var raise = tmp.set(M.lerp(an.x, K.cx, 0.3), 1.05, L.holdZ + 0.25);
      var mouth = tmp2.set(an.x, 0.95, -2.05);
      if (t < 0.6) { c.pos.lerpVectors(c.from, raise, M.easeInOut(t / 0.6)); }
      else if (t < 1.0) { c.pos.copy(raise); c.pos.x += Math.sin((t - 0.6) * 30) * 0.03 * (1 - (t - 0.6) / 0.4); }
      else if (t < 2.2) {
        var e = M.easeInOut((t - 1.0) / 0.35);
        c.pos.lerpVectors(raise, mouth, e); c.rotX = M.lerp(0, -1.05, e);
        c.fill = c.fill0 * (1 - M.sat((t - 1.2) / 0.9));
      } else if (!F['back' + c.i]) {
        F['back' + c.i] = true; c.state = 'back'; c.t = 0; c.from.copy(c.pos); c.fill = 0; c.acc = labAcc(); c.full = false;
      }
    });
    if (t >= 0.6 && !F.clink) {
      F.clink = true; A.clink();
      var mid = new V3(K.cx, 2.4, L.holdZ + 0.4);
      burst(mid, 14, { color: [0xffe066, 0xffffff, 0xffb3c8, 0x9be7ff], shape: 2, sp0: 1, sp1: 3, up0: 1, up1: 3, g: -3, s0: 0.15, s1: 0.28, l0: 0.6, l1: 1.1 });
    }
    if (t >= 1.25 && !F.g1) { F.g1 = true; A.gulp(0); A.gulp(0.28); A.gulp(0.56); }
    if (t >= 2.2 && !F.happy) {
      F.happy = true;
      S.animals.forEach(function (an) { an.happyT = 3.0; an.hop = 1; an.cheer = 1.6;
        var hp = an.a.head.getWorldPosition(new V3()).add(new V3(0, 0.7, 0.3));
        burst(hp, 6, { color: [0xff5c8a, 0xff8fb1], shape: 1, sp0: 0.3, sp1: 1, up0: 1.2, up1: 2.2, g: -0.5, s0: 0.24, s1: 0.34, size1: 0.3, l0: 1.0, l1: 1.6, drag: 1.2 }); });
      A.chirp(1.2);
      for (var i = 0; i < 26; i++) emit({ x: M.rand(-2, 7), y: M.rand(4.5, 6), z: M.rand(-2.5, -1), vx: M.rand(-0.5, 0.5), vy: M.rand(-0.5, 0.5), vz: 0, g: -1.5, drag: 1.5, life: M.rand(1.6, 2.4), size: M.rand(0.16, 0.24), size1: 0.18, color: [0xff7aa8, 0xffd23f, 0x7fd3ff, 0x9be564, 0xc59bff][i % 5], shape: i % 2 ? 2 : 0, rot: Math.random() * 6, vr: M.rand(-5, 5) });
      addBottle(K.color);
    }
    if (t >= 2.9) {
      K.active = false; S.kanpaiCount++;
      var btn = document.getElementById('again'); if (btn) btn.classList.add('show');
    }
  }
  function addBottle(color) {
    var i = S.bottles.length;
    if (i >= 7) { S.bottles.shift(); S.bottles.forEach(function (b, k) { b.slot = k; }); i = 6; }
    var b = { slot: i, color: color.clone(), t: 0, wig: 0, pos: new V3() };
    S.bottles.push(b);
    A.pop(1.3);
  }
  function updateBottles(dt) {
    var im = W.bottles, ic = W.caps, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
    S.bottles.forEach(function (b, k) {
      b.t += dt; b.wig = Math.max(0, b.wig - dt * 1.8);
      b.pos.set(L.shelf.x - 1.5 + b.slot * 0.5, L.shelf.y + 0.08, L.shelf.z + 0.1);
      var s = Math.max(M.easeOutBack(M.sat(b.t / 0.5)), 0.001) * 1.55;
      e.set(0, 0, M.boing(1 - b.wig, 4) * 0.25); q.setFromEuler(e); sc.set(s, s, s);
      mtx.compose(b.pos, q, sc);
      im.setMatrixAt(k, mtx); ic.setMatrixAt(k, mtx); im.setColorAt(k, b.color);
    });
    im.count = ic.count = S.bottles.length;
    im.instanceMatrix.needsUpdate = ic.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- animals
  function tickle(an) { an.wig = 1; an.happyT = Math.max(an.happyT, 0.9); an.hop = 0.6; A.giggle(an.pitchP); }
  function updateAnimals(dt) {
    var jug = S.jug, K = S.kanpai;
    var look = jug.state === 'held' ? W.jug.position : (jug.spin > 0.3 ? W.jug.position : null);
    S.animals.forEach(function (an, i) {
      var a = an.a, c = S.cups[i];
      // enter / leave
      if (an.enter < 1) { an.enter = Math.min(1, an.enter + dt / 0.7); }
      var baseY = an.enter < 1 ? M.lerp(-2.6, 0, M.easeOutBack(an.enter)) : 0;
      an.happyT = Math.max(0, an.happyT - dt); an.hop = Math.max(0, an.hop - dt * 1.8); an.wig = Math.max(0, an.wig - dt * 1.6); an.cheer = Math.max(0, an.cheer - dt);
      an.blink -= dt; if (an.blink < 0) { an.blinkT = 0.14; an.blink = M.rand(2, 5); }
      an.blinkT = Math.max(0, an.blinkT - dt);
      var hop = Math.abs(Math.sin((1 - an.hop) * Math.PI * 2)) * an.hop * 0.4;
      var want = c.state === 'table' && c.fill > 0.04;
      var bob = Math.sin(S.time * 2.2 + i * 1.7) * 0.03 + (want ? Math.abs(Math.sin(S.time * 5 + i)) * 0.08 : 0);
      a.root.position.set(an.x, baseY + hop + bob, L.animalZ);
      an.lean = M.damp(an.lean, want ? 0.14 : (c.state === 'held' ? 0.08 : 0), 4, dt);
      a.root.rotation.x = an.lean;
      a.body.scale.set(1, 1 + Math.sin(S.time * 2.2 + i) * 0.015, 1);
      // head: look + wiggle
      var tx = 0, ty = 0;
      if (look) { tx = Math.atan2(look.x - an.x, 4.5) * 0.6; ty = -0.15; }
      else if (c.state === 'table' && c.fill > 0) { tx = 0; ty = -0.2; }
      else { tx = Math.sin(S.time * 0.5 + i * 2) * 0.12; ty = 0.05; }
      an.yaw = M.damp(an.yaw, M.clamp(tx, -0.5, 0.5), 4, dt); an.pitch = M.damp(an.pitch, ty, 4, dt);
      a.head.rotation.set(an.pitch, an.yaw, Math.sin((1 - an.wig) * 18) * an.wig * 0.25 + Math.sin(S.time * 1.1 + i) * 0.04);
      var happy = an.happyT > 0;
      a.eyes.visible = !happy; a.happy.visible = happy;
      a.eyes.scale.y = an.blinkT > 0 ? 0.15 : 1;
      a.eyes.position.y = an.blinkT > 0 ? -0.01 : 0;
      a.mouth.visible = happy && an.happyT > 0.4 && c.state !== 'kanpai';
      // arms
      var armX = 0, armZ = 0.25;
      if (c.state === 'give' || c.state === 'held') { armX = -1.25; armZ = 0.02; }
      else if (c.state === 'kanpai') { armX = K.t < 1.0 ? -2.3 : -1.75; armZ = 0.0; }
      else if (want) { armX = -0.9 + Math.sin(S.time * 6) * 0.15; armZ = 0.15; }
      if (an.cheer > 0 || (K.active && c.state !== 'kanpai' && K.t > 0.6)) { armX = -2.7 + Math.sin(S.time * 10 + i) * 0.25; armZ = 0.35; }
      an.arm = M.damp(an.arm, armX, 8, dt); an.armZ = M.damp(an.armZ, armZ, 8, dt);
      a.arms[0].rotation.set(an.arm, 0, -an.armZ); a.arms[1].rotation.set(an.arm, 0, an.armZ);
      if (an.leaving) {
        an.leaving.t += dt / 0.45;
        a.root.position.y = M.lerp(0, -2.8, M.easeIn(an.leaving.t));
        if (an.leaving.t >= 1) { W.animalRoot.remove(a.root); a.dispose(); S.animals[i] = an.leaving.next; an.leaving = null; }
      }
    });
  }

  // ---------------------------------------------------------------- new round
  function newRound() {
    var jug = S.jug;
    A.again(); A.whoosh();
    stopMotor();
    if (jug.state === 'held') releaseJug();
    jug.fruits.forEach(function (f) { var wp = W.jug.localToWorld(f.mesh.position.clone()); W.jugFruitRoot.remove(f.mesh); burst(wp, 3, { color: 0xffffff, shape: 2, s0: 0.1, s1: 0.16, l0: 0.3, l1: 0.5 }); });
    jug.fruits = []; S.chunks = []; jug.pending = 0;
    jug.drain = jug.volume; jug.acc = labAcc(); jug.newAmt = 0;
    S.flying.forEach(function (f) { W.scene.remove(f.mesh); }); S.flying = [];
    S.kanpai.active = false;
    S.cups.forEach(function (c) { c.fill = 0; c.acc = labAcc(); c.full = false; c.state = 'back'; c.t = 0; c.from.copy(c.pos); });
    // a new guest joins the family
    S.round++;
    var idx = (S.round - 2) % 3, old = S.animals[idx];
    var type = G.ANIMAL_ORDER[S.nextAnimal % G.ANIMAL_ORDER.length]; S.nextAnimal++;
    if (S.animals.some(function (x) { return x.type === type; })) { type = G.ANIMAL_ORDER[S.nextAnimal % G.ANIMAL_ORDER.length]; S.nextAnimal++; }
    var nw = createAnimal(type, idx, true); nw.enter = -0.6;
    old.leaving = { t: 0, next: nw };
    setTimeout(function () { setCupColorsSoon(); }, 480);
    // shuffle fruit positions
    var types = S.tray.map(function (s) { return s.type; });
    for (var i = types.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = types[i]; types[i] = types[j]; types[j] = t; }
    S.tray.forEach(function (sl, k) {
      if (sl.fruit && sl.fruit.state !== 'fly') { W.scene.remove(sl.fruit.mesh); }
      sl.type = types[k]; sl.fruit = null; sl.respawn = 0.15 + k * 0.08;
    });
    var btn = document.getElementById('again'); if (btn) btn.classList.remove('show');
    S.hint.target = null;
  }
  function setCupColorsSoon() { S.cups.forEach(function (c, i) { var an = S.animals[i]; var tp = an.leaving ? an.leaving.next.type : an.type; c.w.deco.color.setHex(MJ.CUP_COLORS[tp]); }); }

  // ---------------------------------------------------------------- hints
  function chooseHint() {
    var jug = S.jug, c;
    for (var i = 0; i < 3; i++) { c = S.cups[i]; if (c.state === 'table' && c.fill > 0.04) return { kind: 'cup', cup: c }; }
    var cupFree = S.cups.some(function (x) { return x.state === 'table' && x.fill < 0.95; });
    if (jug.volume > 0.04 && cupFree && jug.state === 'home') return { kind: 'jug' };
    if (jug.fruits.length && !jug.motorOn && jug.state === 'home') return { kind: 'switch' };
    if (S.kanpaiCount > 0 && jug.volume < 0.04 && !jug.fruits.length && S.hint.cycle % 2 === 0) return { kind: 'again' };
    var slots = S.tray.filter(function (s) { return s.fruit && s.fruit.state === 'tray'; });
    if (!slots.length) return null;
    var sl = slots[S.hint.cycle % slots.length];
    return { kind: 'fruit', f: sl.fruit };
  }
  function hintPos(h, out) {
    if (h.kind === 'fruit') return out.copy(h.f.mesh.position).add(tmp.set(0, 0.45, 0));
    if (h.kind === 'switch') return W.switchGroup.getWorldPosition(out);
    if (h.kind === 'jug') return jugPoint(1.3, out);
    if (h.kind === 'cup') return out.copy(h.cup.pos).add(tmp.set(0, 0.55, 0));
    return null;
  }
  var HSIZE = { fruit: 1.7, switch: 1.4, jug: 2.2, cup: 1.6 };
  function updateHint(dt) {
    var H = S.hint, active = S.idle > 2.5 && !S.drag && !S.kanpai.active;
    if (active) {
      H.t -= dt;
      if (!H.target || H.t <= 0) { H.cycle++; H.target = chooseHint(); H.t = 3.0; }
      H.a = M.damp(H.a, 1, 4, dt);
    } else { H.a = M.damp(H.a, 0, 10, dt); if (H.a < 0.02) H.target = null; H.t = 0; }
    var btn = document.getElementById('again');
    if (btn) btn.classList.toggle('pulse', !!(H.target && H.target.kind === 'again' && H.a > 0.3));
    var g = W.glow;
    var hp = H.target ? hintPos(H.target, new V3()) : null;
    if (hp && H.a > 0.02) {
      g.visible = true; g.quaternion.copy(W.camera.quaternion);
      g.position.copy(hp).add(tmp.setFromMatrixColumn(W.camera.matrixWorld, 2).multiplyScalar(-0.9));
      var sz = HSIZE[H.target.kind] * (1 + 0.08 * Math.sin(S.time * 6));
      g.scale.set(sz, sz, 1);
      g.material.uniforms.uA.value = H.a * (H.target.kind === 'jug' ? 0.45 : 0.85); g.material.uniforms.uT.value = S.time;
    } else g.visible = false;
  }

  // ---------------------------------------------------------------- shadows
  function updateShadows() {
    var sh = W.shadows, n = 0;
    function put(x, z, sx, sz, y, a) { if (n >= sh.max) return; sh.a.setXYZW(n, x, z, sx, sz); sh.a2.setXY(n, y, a); n++; }
    S.tray.forEach(function (sl) { var f = sl.fruit; if (!f) return; var m = f.mesh, h = Math.max(m.position.y - 0.11, 0);
      var s = 1.1 * m.scale.x; put(m.position.x, m.position.z + 0.05, s, s * 0.8, m.position.z > -0.3 && Math.abs(m.position.x - L.tray.x) < 2.4 ? 0.11 : 0, 0.4 * M.sat(1 - h / 3)); });
    S.flying.forEach(function (f) { var m = f.mesh; put(m.position.x, m.position.z, 0.8, 0.6, 0, 0.25 * M.sat(1 - m.position.y / 5)); });
    put(L.base.x, L.base.z + 0.1, 2.8, 2.3, 0, 0.45);
    var jp = W.jug.position; if (S.jug.state !== 'home') put(jp.x + 0.2, jp.z, 2.0, 1.4, 0, 0.3 * M.sat(1 - jp.y / 4));
    S.cups.forEach(function (c) { put(c.pos.x, c.pos.z + 0.05, 1.3, 1.0, 0, 0.35 * M.sat(1 - c.pos.y / 2.5)); });
    sh.geo.instanceCount = n; sh.a.needsUpdate = sh.a2.needsUpdate = true;
  }

  // ---------------------------------------------------------------- frame
  MJ.Game.update = function (dt) {
    S.time += dt; S.idle += dt;
    var jug = S.jug;
    if (jug.drain > 0) { jug.volume = Math.max(0, jug.volume - dt * 2.5); if (jug.volume <= 0) jug.drain = 0; }
    updateTray(dt);
    updateFlying(dt);
    updateJug(dt);
    updateJugFruits(dt);
    updateChunks(dt);
    updateCups(dt);
    updateKanpai(dt);
    updateAnimals(dt);
    updateBottles(dt);
    updateHint(dt);
    updateShadows();
    updateParticles(dt);
    checkNaN();
  };
  var nanT = 0;
  function checkNaN() {
    nanT++; if (nanT % 30) return;
    var bad = false;
    [W.jug.position, W.jug.rotation].forEach(function (v) { if (!isFinite(v.x + v.y + v.z)) bad = true; });
    var u = W.liquid.u; if (!isFinite(u.uLevel.value + u.uSlope.value.x + u.uSlope.value.y + S.jug.volume)) bad = true;
    S.cups.forEach(function (c) { if (!isFinite(c.pos.x + c.pos.y + c.pos.z + c.fill)) bad = true; });
    if (bad) {
      MJ.nanCount = (MJ.nanCount || 0) + 1; MJ.pushErr('NaN state repaired');
      S.jug.pos.set(L.base.x, L.baseTop, L.base.z); S.jug.vis.copy(S.jug.pos); S.jug.tilt = S.jug.visTilt = 0; S.jug.state = 'home';
      if (!isFinite(S.jug.volume)) S.jug.volume = 0;
      S.cups.forEach(function (c) { if (!isFinite(c.pos.x + c.pos.y + c.pos.z + c.fill)) { c.pos.copy(c.w.home); c.fill = 0; c.state = 'table'; } });
    }
  }

  // ---------------------------------------------------------------- test / debug API (used by the smoke test)
  MJ.api = {
    screen: function (name) {
      var v = new V3();
      if (/^fruit\d$/.test(name)) { var sl = S.tray[+name[5]]; if (!sl.fruit) return null; v.copy(sl.fruit.mesh.position).add(new V3(0, 0.4, 0)); }
      else if (name === 'switch') W.switchGroup.getWorldPosition(v);
      else if (name === 'jug') jugPoint(1.4, v);
      else if (/^cup\d$/.test(name)) v.copy(S.cups[+name[3]].pos).add(new V3(0, 0.55, 0));
      else if (/^cupPour\d$/.test(name)) { var c = S.cups[+name[7]]; v.set(c.pos.x - 1.2, 2.6, c.pos.z); }
      else if (/^animal\d$/.test(name)) S.animals[+name[6]].a.head.getWorldPosition(v);
      else return null;
      var s = toScreen(v, {}), r = MJ.canvasRect;
      return { x: s.x + r.left, y: s.y + r.top };
    },
    state: function () {
      return { volume: S.jug.volume, fruitsInJug: S.jug.fruits.length, motorOn: S.jug.motorOn, spin: S.jug.spin, jugState: S.jug.state, lockCup: S.jug.lockCup, tilt: S.jug.tilt,
        cups: S.cups.map(function (c) { return { fill: +c.fill.toFixed(3), state: c.state }; }), kanpaiCount: S.kanpaiCount, round: S.round,
        bottles: S.bottles.length, animals: S.animals.map(function (a) { return a.type; }), errors: MJ.errors.slice(), nan: MJ.nanCount || 0, hint: S.hint.target && S.hint.target.kind };
    }
  };
})();
