// hero：うどんの生地と麺（docs/HERO-SPEC.md の createHero）。
// THREE は引数で受け取る（import しない）。編集したら `npm run build:hero` で hero.build.js を作り直す。
//
//   dough.js   … 生地（押す・引っ張る・めん棒）と、切ったあとの切り身
//   noodles.js … 麺のチューブと、場所ごとの形・移り変わり
//   params.js  … パラメータ（全部ここ）
//
// 状態は3つ：'dough'（切っていない生地）→ 'slab'（切った切り身がまな板にある）→ 'tubes'（麺。持ち上げた後）。
// どの状態・どの場所からでも setPlace / reset / 包丁 / 指 を受けて破綻しない。

import { PARAMS } from './params.js';
import { clamp, lerp } from './math.js';
import { createDough } from './dough.js';
import { createNoodles } from './noodles.js';

const PLACES = ['board', 'hand', 'pot', 'net', 'bowl', 'eaten'];

export function createHero(THREE, opts) {
  const P = PARAMS;
  const Q = P.quality[opts.tier] || P.quality.mid;
  const LY = opts.layout;
  const MAXN = clamp(Math.round(opts.maxNoodles || 12), 1, 16);
  const TOP = LY.board.center.y;
  // shell が寸法を渡したらそれを使う（無ければ params.js の値。今は同じ値なので形は変わらない）
  if (LY.net && Number.isFinite(LY.net.radius)) P.net.radius = LY.net.radius;
  if (LY.net && Number.isFinite(LY.net.rimY)) P.net.rimY = LY.net.rimY;
  if (LY.pot && Number.isFinite(LY.pot.rimAbove)) P.pot.rimAbove = LY.pot.rimAbove;
  const emit = (type, data) => { try { if (opts.onEvent) opts.onEvent(type, data); } catch (e) { console.warn('[hero] onEvent', e); } };

  const root = new THREE.Group(); root.name = 'hero';

  // ---- 材質（テクスチャは shell の持ち物） ----
  const tex = opts.textures && opts.textures.dough ? opts.textures.dough : null;
  // 写真は小麦色なので、色の倍率（リニア値。1 を超えてよい）で白い生地の色へ寄せる
  const doughMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, vertexColors: true });
  const noodleMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 });
  const RAW = new THREE.Color().setRGB(1.08, 1.14, 1.36), COOKED = new THREE.Color().setRGB(1.14, 1.24, 1.56);
  doughMat.color.setRGB(1.1, 1.17, 1.42); noodleMat.color.copy(RAW);
  const BASE = [0.035, 0.03, 0.02];   // 影の側が沈みすぎないための、ごく弱い自己発光

  // 麺の先が下の物に着く高さ（鍋では湯に浸かる、お椀では底、まな板、作業台）
  function floorAt(x, z) {
    const pc = LY.pot.center, pr = LY.pot.radius;
    let dx = x - pc.x, dz = z - pc.z, d2 = dx * dx + dz * dz;
    if (d2 < (pr - 0.008) * (pr - 0.008)) return pc.y - P.hang.floorDip;
    if (d2 < (pr + 0.02) * (pr + 0.02)) return pc.y + P.pot.rimAbove;
    const e = LY.bowl.matrixWorld.elements, u = LY.bowl.userData || {}, ri = u.innerRadius || 0.085;
    dx = x - e[12]; dz = z - e[14]; d2 = dx * dx + dz * dz;
    if (d2 < ri * ri * 0.72) return e[13] + 0.004;
    if (d2 < (ri + 0.014) * (ri + 0.014)) return e[13] + (u.depth || 0.07);
    const b = LY.board;
    if (Math.abs(x - b.center.x) < b.sizeX / 2 && Math.abs(z - b.center.z) < b.sizeZ / 2) return TOP;
    return 0;
  }

  const dough = createDough(THREE, Q, P, LY, doughMat, MAXN);
  const noodles = createNoodles(THREE, Q, P, LY, noodleMat, MAXN, { floorAt, emit });
  root.add(dough.group, noodles.mesh);

  // ---- 疑似影：生地・並んだ麺・ぶら下がった麺の下の暗い板（影マップは使わない） ----
  const SH = 32, shData = new Uint8Array(SH * SH * 4);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SH; x++) {
    const r = Math.hypot((x + 0.5) / SH * 2 - 1, (y + 0.5) / SH * 2 - 1), a = clamp((1 - r) / 0.5, 0, 1);
    const o = (y * SH + x) * 4; shData[o] = shData[o + 1] = shData[o + 2] = 0; shData[o + 3] = Math.round(255 * a * a * (3 - 2 * a));
  }
  const shTex = new THREE.DataTexture(shData, SH, SH, THREE.RGBAFormat);
  shTex.magFilter = THREE.LinearFilter; shTex.minFilter = THREE.LinearFilter; shTex.needsUpdate = true;
  const shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.3 });
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.visible = false; shadow.renderOrder = 3; shadow.frustumCulled = false;
  root.add(shadow);

  // ---- 触り判定の代理形状 ----
  const proxyGeo = new THREE.BoxGeometry(1, 1, 1);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const doughProxy = new THREE.Mesh(proxyGeo, proxyMat); doughProxy.userData = { heroPart: 'dough', enabled: false };
  const noodleProxy = new THREE.Mesh(proxyGeo, proxyMat); noodleProxy.userData = { heroPart: 'noodles', enabled: false };
  root.add(doughProxy, noodleProxy);

  // ---- 状態 ----
  let mode = 'dough', place = 'board', cutCount = 0, grabbing = false, stretchT = 0, resetPending = false, disposed = false;
  let hint = null, hintT = 0;
  const touched = { pressed: false, stretched: false, rolled: false };
  const center = new THREE.Vector3();
  const state = { place: 'board', cutCount: 0, noodleCount: 0, touched, busy: false, center };
  const piece = { x: 0, y: 0, z0: 0, z1: 0, w: 0, th: 0, prof: null };
  const HP = P.hint;
  // ぴょこっ：hopEvery 秒に1回、hopTime 秒の小さな跳ね（delay で順番にずらせる）
  const hopAt = (delay) => {
    const t = hintT - delay;
    if (t < 0) return 0;
    const ph = t % HP.hopEvery;
    return ph < HP.hopTime ? Math.sin(ph / HP.hopTime * Math.PI) : 0;
  };

  // つかんでいる指を終わらせる（引っ張っていたら stretch-release を必ず出す）
  function endGrab() {
    if (!grabbing) return;
    grabbing = false;
    const a = dough.release();
    if (a >= 0) emit('stretch-release', { amount: a });
  }

  function toTubes() {
    if (dough.dropping) { dough.finishDrop(); if (resetPending) { resetPending = false; emit('settled', { place: 'board' }); } }
    endGrab();
    dough.freeze();
    noodles.clear();
    const n = dough.count;
    for (let i = 0; i < n; i++) noodles.addFromPiece(dough.pieceOut(i, piece));
    dough.hide();
    mode = 'tubes';
  }

  function setPlace(p, o) {
    if (disposed || PLACES.indexOf(p) < 0 || mode === 'none') return;
    if (mode === 'dough' || mode === 'slab') {
      if (p === 'board') return;
      toTubes();   // 切っていない生地は太い1本の麺になる
    } else if (p === place) return;
    place = p;
    noodles.begin(p, o || null);
  }

  function reset(o) {
    if (disposed) return;
    noodles.clear();
    endGrab();
    mode = 'dough'; place = 'board'; cutCount = 0;
    touched.pressed = touched.stretched = touched.rolled = false;
    dough.reset(o && Number.isFinite(o.seed) ? o.seed : 0);
    resetPending = true;
    shadow.visible = false;
    sync();
  }

  function update(dt, input) {
    if (disposed || !input) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
    const time = Number.isFinite(input.time) ? input.time : 0;
    hintT += dt;
    const pt = input.pointer;

    // ---- 生地：押す・つまんで引っ張る ----
    if (grabbing && mode !== 'dough') endGrab();
    if (pt && mode === 'dough' && place === 'board') {
      if (pt.phase === 'down' && pt.part === 'dough' && dough.landed) {
        endGrab();
        grabbing = dough.grab(pt.ray);
        if (grabbing) {
          touched.pressed = true; stretchT = 0;
          dough.drag(pt.boardPoint.x, pt.boardPoint.z, 0);
          emit('press', { strength: 0.6, position: dough.grabPos.clone() });
        }
      } else if (grabbing && pt.active && pt.phase !== 'up') {
        const a = dough.drag(pt.boardPoint.x, pt.boardPoint.z, dt);
        if (a >= 0) {
          touched.stretched = true;
          stretchT -= dt;
          if (stretchT <= 0) { stretchT = 0.1; emit('stretch', { amount: a }); }
        }
      }
      if (pt.phase === 'up' || (!pt.active && pt.phase !== 'down')) endGrab();
    }
    // ---- めん棒 ----
    const pin = input.pin;
    if (pin && pin.active && mode === 'dough' && place === 'board' && !grabbing) {
      const n = dough.roll(pin);
      if (n >= 0) {
        touched.rolled = true;
        for (let i = 0; i < Math.min(n, 2); i++) emit('roll', { amount: dough.flatness() });
      }
    }
    // ---- 包丁 ----
    const chops = input.chops;
    if (chops) for (let i = 0; i < chops.length; i++) {
      const c = chops[i];
      let w = -1;
      if (c && place === 'board') {
        if (mode === 'dough' || mode === 'slab') { endGrab(); w = dough.cut(c.x, c.z); if (w >= 0) mode = 'slab'; }
        else if (mode === 'tubes') w = noodles.cutLaid(c.x, c.z);
      }
      if (w >= 0) { cutCount++; emit('cut', { count: mode === 'slab' ? dough.count : noodles.count, width: w, position: c.clone() }); }
      else if (c) emit('cut-miss', { position: c.clone() });
    }

    // ---- 動かす ----
    const hintOn = hint !== null;
    if (mode === 'dough' || mode === 'slab') {
      dough.update(dt, time, hintOn, hopAt);
      if (resetPending && !dough.dropping) { resetPending = false; emit('settled', { place: 'board' }); }
    } else if (mode === 'tubes') {
      noodles.update(dt, input, hintOn, hopAt);
      if (noodles.count === 0) mode = 'none';   // 食べられた
    }

    // ---- ヒントの光（明るさの脈動）と、茹でた麺のつや ----
    const pulse = hintOn ? 0.5 - 0.5 * Math.cos(hintT * 2 * Math.PI / HP.period) : 0;
    const gd = mode === 'dough' || mode === 'slab' ? pulse : 0, gn = mode === 'tubes' ? pulse : 0, k = noodles.cook;
    doughMat.emissive.setRGB(BASE[0] + HP.glow[0] * gd, BASE[1] + HP.glow[1] * gd, BASE[2] + HP.glow[2] * gd);
    noodleMat.emissive.setRGB(BASE[0] + HP.glow[0] * gn + 0.04 * k, BASE[1] + HP.glow[1] * gn + 0.035 * k, BASE[2] + HP.glow[2] * gn + 0.025 * k);
    noodleMat.roughness = lerp(0.62, 0.34, k);
    noodleMat.color.copy(RAW).lerp(COOKED, k);

    sync();
  }

  // 代理形状・中心・影を今の形に合わせる
  function sync() {
    let de = false, ne = false;
    if (mode === 'dough' || mode === 'slab') {
      const b = dough.bounds, h = Math.max(0.012, b.h);
      center.set(dough.cx, TOP + h * 0.9, dough.cz);
      const px = mode === 'dough' ? doughProxy : noodleProxy;
      px.position.set((b.x0 + b.x1) / 2, TOP + h / 2, (b.z0 + b.z1) / 2);
      px.scale.set(Math.max(0.03, b.x1 - b.x0 + 0.012), h + 0.012, Math.max(0.03, b.z1 - b.z0 + 0.012));
      if (mode === 'dough') de = place === 'board' && dough.landed; else ne = true;
      const lift = clamp(dough.lift / 0.25, 0, 1), sk = 1 - 0.35 * lift;
      shadow.visible = true;
      shadow.position.set((b.x0 + b.x1) / 2, TOP + 0.0015, (b.z0 + b.z1) / 2 + 0.004);
      shadow.scale.set((b.x1 - b.x0) * 1.3 * sk, 1, (b.z1 - b.z0) * 1.34 * sk);
      shMat.opacity = P.shadow.dough * (1 - 0.6 * lift);
    } else if (mode === 'tubes') {
      const b = noodles.bounds;
      center.copy(noodles.center);
      if (place === 'board') {
        noodleProxy.position.set((b.x0 + b.x1) / 2, Math.max(TOP + 0.015, b.y), (b.z0 + b.z1) / 2);
        noodleProxy.scale.set(Math.max(0.05, b.x1 - b.x0 + 0.02), 0.045, Math.max(0.05, b.z1 - b.z0 + 0.02));
        ne = noodles.count > 0;
      }
      // 影：まな板に並んでいる間と、指や網からぶら下がっている間
      const fl = floorAt(center.x, center.z), hgt = center.y - fl;
      if (place === 'board' && noodles.count > 0 && Number.isFinite(hgt)) {
        shadow.visible = true;
        shadow.position.set((b.x0 + b.x1) / 2, TOP + 0.0015, (b.z0 + b.z1) / 2 + 0.004);
        shadow.scale.set((b.x1 - b.x0) * 1.2 + 0.02, 1, (b.z1 - b.z0) * 1.2 + 0.02);
        shMat.opacity = P.shadow.laid * clamp(1.2 - hgt / 0.15, 0.3, 1);
      } else if (noodles.swinging && hgt > 0.012 && Number.isFinite(hgt)) {
        const s = clamp(0.1 + (b.x1 - b.x0 + b.z1 - b.z0) * 0.5, 0.1, 0.3);
        shadow.visible = true;
        shadow.position.set(center.x, fl + 0.0025, center.z);
        shadow.scale.set(s, 1, s);
        shMat.opacity = P.shadow.hang * clamp(1.15 - hgt / 0.3, 0.25, 1);
      } else shadow.visible = false;
    } else shadow.visible = false;
    doughProxy.userData.enabled = de; noodleProxy.userData.enabled = ne;
    doughProxy.updateMatrixWorld(); noodleProxy.updateMatrixWorld();
  }

  function getState() {
    state.place = place; state.cutCount = cutCount;
    state.noodleCount = mode === 'slab' ? dough.count : mode === 'tubes' ? noodles.count : 0;
    state.busy = mode === 'tubes' ? noodles.busy : mode === 'none' ? false : dough.dropping;
    return state;
  }

  function getStats() {
    const tubes = mode === 'tubes' && noodles.count > 0;
    return {
      triangles: dough.tris() + (tubes ? noodles.tris() : 0) + (shadow.visible ? 2 : 0),
      drawCalls: (dough.tris() > 0 ? 1 : 0) + (tubes ? 1 : 0) + (shadow.visible ? 1 : 0),
      textures: [{ name: 'hero-shadow', width: SH, height: SH }],
      geometryBytes: dough.bytes() + noodles.bytes() + 4 * 20 + 24 * 32,
    };
  }

  reset({ seed: 0 });

  return {
    root,
    hitTargets: [doughProxy, noodleProxy],
    update,
    setPlace,
    getState,
    setHint(part) { const h = part === 'dough' || part === 'noodles' ? part : null; if (h !== hint) { hint = h; hintT = 0; } },
    reset,
    getStats,
    onContextRestored() { shTex.needsUpdate = true; },
    dispose() {
      if (disposed) return;
      disposed = true;
      dough.dispose(); noodles.dispose();
      proxyGeo.dispose(); proxyMat.dispose(); doughMat.dispose(); noodleMat.dispose();
      shGeo.dispose(); shMat.dispose(); shTex.dispose();
      if (root.parent) root.parent.remove(root);
    },
    params: P,
  };
}
