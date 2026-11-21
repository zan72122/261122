// Shell: boot, renderer, the play flow (town → plant → give → town), input, sound, debug.
// The hero (garbage truck mechanism) is loaded from ../hero/hero.js — see docs/HERO-SPEC.md.
import * as THREE from '../vendor/three.module.min.js';
import { detectTier, fitPixelRatio } from './tier.js';
import { loadTextures, makeStripes } from './textures.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createTown, TOWN, mulberry } from './town.js';
import { createBins, refillBin, BIN_SIZE } from './bins.js';
import { createPlant, PLANT } from './plant.js';
import { createAnimal, ANIMAL_KINDS } from './animals.js';
import { createGift } from './gifts.js';
import { createInput } from './input.js';
import { createDebug } from './debug.js';
import { Tweens, clamp, lerp, smoothstep, easeInOut, easeOutBack, easeOut, damp, shuffle } from './util.js';

const SKY = 0xa8dcff;
const CAPACITY = 3;

async function main() {
  const params = new URLSearchParams(location.search);
  const tier = detectTier(params);
  const debugOn = params.get('debug') === '1';
  const timescale = clamp(parseFloat(params.get('timescale') || '1') || 1, 0.1, 8);
  const bootMode = window.__BOOT_MODE__ || 'module';
  // boot timings (ms since navigation start): shown in ?debug=1, read by the measurement scripts
  const BOOT = { textures: 0, hero: 0, town: 0, firstFrame: 0, lost: 0, restored: 0 };
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.message || String(e.error || e)));
  window.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + (e.reason && e.reason.message || e.reason)));

  // ---------------- renderer ----------------
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.msaa, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(tier.dpr);
  renderer.setClearColor(SKY, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.3, 140);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8b896, 2.0);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.7);
  sun.position.set(6, 12, 9);
  scene.add(hemi, sun);

  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const tex = await loadTextures(anisotropy);
  BOOT.textures = performance.now();
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.canvas.atlas });

  const audio = createAudio();
  const fx = createFx(scene, tex.canvas, tier);
  const tweens = new Tweens();
  const rnd = mulberry((Date.now() & 0xffff) + 1);

  // ---------------- hero ----------------
  const heroMod = window.__HERO__ || (await import('../hero/hero.js'));
  const heroEvents = [];
  const hero = heroMod.createHero(THREE, {
    tier: tier.name,
    textures: { paint: tex.photo.paint, steel: tex.photo.steel, trash: tex.photo.trash, shadow: tex.canvas.shadow },
    capacity: CAPACITY,
    binSize: { ...BIN_SIZE },
    anisotropy,
    onEvent: (ev) => heroEvents.push(ev),
    onSound: (name, p) => audio.play(name, p),
  });
  scene.add(hero.root);
  BOOT.hero = performance.now();
  const dims = hero.dims;
  const binSpot = dims.binSpot.clone();

  // ---------------- town (scene A) ----------------
  const markerXs = [-2.2, 0, 2.2].map((d) => clamp(binSpot.x + d, -4.2, 4.2));
  const town = createTown(tex, propMat, markerXs);
  scene.add(town.group);
  const truckZ = TOWN.markerZ - binSpot.z;
  const truckHomeX = markerXs[1] - binSpot.x;
  const bins = createBins(propMat, rnd);
  const homeSlots = TOWN.binXs.map((x) => new THREE.Vector3(x, 0, TOWN.binRowZ));
  shuffle(bins.slice(), rnd).forEach((b, i) => { b.home.copy(homeSlots[i]); b.rest.copy(b.home); b.root.position.copy(b.home); town.group.add(b.root); refillBin(b, rnd); });
  const friends = []; // {animal, gift, slot}
  BOOT.town = performance.now();

  // ---------------- plant (scene B) – built on first visit ----------------
  let plant = null;
  const pressZ = truckZ + dims.dumpSpot.z;
  let plantTruckX = -3.4 - dims.dumpSpot.x;
  plantTruckX = Math.min(plantTruckX, 6.4 - dims.frontX);
  const pressX = plantTruckX + dims.dumpSpot.x;

  // ---------------- shared hint ring ----------------
  const hintMat = new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const hintRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 40), hintMat);
  hintRing.rotation.x = -Math.PI / 2; hintRing.renderOrder = 2;
  scene.add(hintRing);

  const fade = document.getElementById('fade');
  let fadeLevel = 0;
  const setFade = (v) => { fadeLevel = v; fade.style.opacity = String(v); };

  // ---------------- game state ----------------
  const G = {
    scene: 'town', sub: 'arrive', clock: 0, idle: 0, lastGlove: -99, round: 0,
    truck: { x: -17, vx: 0, drive: null, attention: 0, beepT: 0, reversing: false },
    drag: null, activeBin: null, layers: [], animal: null, gift: null, stripes: null, pendingDump: false, pendingPress: false, autoGive: false,
  };
  const ray = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();

  function driveTo(x, dur, onArrive, reversing = false) {
    G.truck.drive = { from: G.truck.x, to: x, t: 0, dur: Math.max(0.3, dur), onArrive };
    G.truck.reversing = reversing;
  }
  function updateTruck(dt) {
    const tr = G.truck;
    if (tr.drive) {
      const d = tr.drive;
      d.t += dt;
      const k = clamp(d.t / d.dur, 0, 1);
      const nx = lerp(d.from, d.to, easeInOut(k));
      tr.vx = dt > 0 ? (nx - tr.x) / dt : 0;
      tr.x = nx;
      if (tr.reversing) { tr.beepT -= dt; if (tr.beepT <= 0) { tr.beepT = 0.55; audio.play('beep'); } }
      if (k >= 1) { tr.drive = null; tr.vx = 0; tr.reversing = false; d.onArrive && d.onArrive(); }
    } else tr.vx = 0;
    hero.root.position.set(tr.x, 0, truckZ);
    audio.engine(clamp(Math.abs(tr.vx) / 5, 0, 1));
  }

  // ---------------- camera ----------------
  let camPose = TOWN.camera;
  function applyCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(fitPixelRatio(tier, w, h)); // DPR 1.0 on mobile; lowered on huge desktop windows to stay in the GPU budget
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.position.set(...camPose.pos);
    camera.lookAt(...camPose.look);
    const needTanH = camPose.fitHalfWidth / camPose.fitDepth;
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(needTanH / camera.aspect));
    camera.fov = clamp(vfov, 38, 76);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', applyCamera);
  applyCamera();

  // ---------------- helpers ----------------
  function hop(obj, to, dur, height, onDone, hops = 1) {
    const from = obj.position.clone();
    return tweens.add(dur, (k) => {
      obj.position.x = lerp(from.x, to.x, k);
      obj.position.z = lerp(from.z, to.z, k);
      const hk = (k * hops) % 1;
      obj.position.y = lerp(from.y, to.y, k) + Math.sin(Math.PI * hk) * height * (k < 1 ? 1 : 0);
    }, onDone);
  }
  function popIn(obj, dur = 0.45, target = 1) {
    obj.visible = true;
    return tweens.add(dur, (k) => obj.scale.setScalar(Math.max(0.001, easeOutBack(k) * target)));
  }
  function popOut(obj, dur = 0.3) {
    const s0 = obj.scale.x;
    return tweens.add(dur, (k) => obj.scale.setScalar(Math.max(0.001, s0 * (1 - easeOut(k)))), () => { obj.visible = false; });
  }
  function worldOf(obj, out = new THREE.Vector3()) { obj.updateWorldMatrix(true, false); return obj.getWorldPosition(out); }
  function groundPoint(ndc) {
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(groundPlane, new THREE.Vector3());
  }
  function hitTest(ndc, objects) {
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(objects, true);
    return hits.length ? hits[0] : null;
  }
  function pulse(mat, on, base = 0x000000) {
    if (!mat || !mat.emissive) return;
    if (on) { const k = 0.25 + 0.25 * Math.sin(G.clock * 6); mat.emissive.setRGB(k, k * 0.9, k * 0.4); }
    else mat.emissive.setHex(base);
  }

  // ======================= TOWN =======================
  function townBinsAvailable() { return bins.filter((b) => b.full && (b.state === 'home' || b.state === 'placed')); }
  function freeMarkers() { return town.markers.filter((m) => m.free); }
  function truckAccepting() { return G.scene === 'town' && (G.sub === 'play' || G.sub === 'arrive'); }

  function placeOnMarker(bin, marker) {
    marker.bin = bin; bin.marker = marker; bin.state = 'hop';
    hop(bin.root, marker.pos, 0.32, 0.6, () => {
      bin.state = 'waiting'; bin.rest.copy(marker.pos); bin.placedAt = G.clock;
      marker.burst = 1; audio.play('snap'); fx.sparkleBurst(v.copy(marker.pos).setY(0.3), 10, 0.7);
    });
    audio.play('hop');
  }
  function nearestFreeMarker(p, maxDist = Infinity) {
    let best = null, bd = maxDist;
    for (const m of town.markers) { if (!m.free) continue; const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  function binHome(bin, empty) {
    bin.state = 'returning';
    if (bin.marker) { bin.marker.bin = null; bin.marker = null; }
    hop(bin.root, bin.home, 1.1, 0.45, () => {
      bin.rest.copy(bin.home);
      bin.state = empty ? 'empty' : 'home';
      if (empty) { bin.lid.rotation.x = -0.75; fx.sparkleBurst(v.copy(bin.home).setY(1.2), 10, 0.6); audio.play('sparkle'); }
    }, 3);
  }

  function townScheduler() {
    if (G.sub !== 'play' && G.sub !== 'arrive') return;
    if (G.truck.drive || G.activeBin) return;
    const st = hero.getStatus();
    if (!st.canLoad) return;
    let next = null;
    for (const b of bins) if (b.state === 'waiting' && (!next || b.placedAt < next.placedAt)) next = b;
    if (!next) return;
    const marker = next.marker;
    G.activeBin = next;
    const tx = marker.x - binSpot.x;
    const go = () => {
      if (next.state !== 'waiting' || next.marker !== marker) { G.activeBin = null; return; }
      next.root.position.copy(marker.pos); next.root.rotation.set(0, 0, 0); next.root.scale.set(1, 1, 1);
      next.lid.rotation.x = 0;
      next.state = 'truck';
      if (!hero.loadBin(next)) { next.state = 'waiting'; G.activeBin = null; }
    };
    if (Math.abs(tx - G.truck.x) < 0.02) go();
    else driveTo(tx, clamp(Math.abs(tx - G.truck.x) / 3.2, 0.6, 2.2), go);
  }

  function townDown(ndc) {
    const candidates = bins.filter((b) => ['home', 'placed', 'waiting', 'empty'].includes(b.state)).map((b) => b.hit);
    const h = hitTest(ndc, candidates);
    if (h) {
      const bin = h.object.userData.bin;
      if (!bin.full || !truckAccepting()) { bin.wiggle = 1; audio.play('tap'); return; }
      if (bin.marker) { bin.marker.bin = null; bin.marker = null; }
      bin.state = 'held';
      G.drag = { kind: 'bin', bin, start: bin.root.position.clone(), target: bin.root.position.clone(), moved: false };
      audio.play('pick');
      return;
    }
    const th = hitTest(ndc, hero.hitTargets.map((t) => t.object));
    if (th) { truckTapped(th.point); return; }
    const p = groundPoint(ndc);
    if (p) {
      const m = nearestFreeMarker(p, 1.0);
      const avail = townBinsAvailable();
      if (m && avail.length && truckAccepting()) {
        avail.sort((a, b) => a.root.position.distanceTo(m.pos) - b.root.position.distanceTo(m.pos));
        placeOnMarker(avail[0], m);
        return;
      }
      fx.sparkleBurst(p.setY(0.1), 5, 0.4); audio.play('tap');
    }
  }
  function townMove(ndc) {
    const d = G.drag;
    if (!d) return;
    const p = groundPoint(ndc);
    if (!p) return;
    const S = TOWN.sidewalk;
    d.target.set(clamp(p.x, S.xMin, S.xMax), 0, clamp(p.z, S.zMin, S.zMax));
    if (d.target.distanceTo(d.start) > 0.2) d.moved = true;
    for (const m of town.markers) m.hover = false;
    const m = truckAccepting() ? nearestFreeMarker(d.target, 1.15) : null;
    if (m) m.hover = true;
  }
  function townUp(ndc, info) {
    const d = G.drag;
    if (!d) return;
    G.drag = null;
    for (const m of town.markers) m.hover = false;
    const bin = d.bin;
    if (!d.moved || info.tap) {
      const m = truckAccepting() ? nearestFreeMarker(bin.root.position) : null;
      if (m) { placeOnMarker(bin, m); return; }
      bin.state = 'hop'; hop(bin.root, d.start, 0.25, 0.3, () => { bin.state = bin.rest.equals(bin.home) ? 'home' : 'placed'; });
      return;
    }
    const m = truckAccepting() ? nearestFreeMarker(d.target, 1.15) : null;
    if (m) { placeOnMarker(bin, m); return; }
    bin.state = 'hop';
    const to = d.target.clone().setY(0);
    hop(bin.root, to, 0.18, 0.05, () => { bin.rest.copy(to); bin.state = 'placed'; audio.play('drop'); });
  }

  function truckTapped(point) {
    hero.poke('truck', point || worldOf(hero.root));
    audio.play('honk');
    if (G.scene === 'town' && G.sub === 'full' && !G.truck.drive) {
      G.sub = 'leave'; G.truck.attention = 0;
      driveTo(19, 2.6, null);
      tweens.wait(1.5, () => fadeTo(1, 0.45, enterPlant));
    } else if (G.scene === 'plant' && G.animal) {
      G.animal.cheer();
    }
  }

  function updateBinsTown(dt) {
    const S = TOWN.sidewalk;
    for (const b of bins) {
      const r = b.root;
      b.wiggle = Math.max(0, b.wiggle - dt * 2.5);
      if (b.state === 'held') {
        const d = G.drag;
        r.position.x = damp(r.position.x, d.target.x, 22, dt);
        r.position.z = damp(r.position.z, d.target.z, 22, dt);
        r.position.y = damp(r.position.y, 0.45, 18, dt);
        r.rotation.z = Math.sin(G.clock * 9) * 0.06; r.rotation.x = 0;
        r.scale.setScalar(damp(r.scale.x, 1.1, 12, dt));
        continue;
      }
      if (b.state === 'hop' || b.state === 'returning') { r.scale.setScalar(damp(r.scale.x, 1, 10, dt)); r.rotation.set(0, 0, 0); continue; }
      if (b.state === 'truck') continue;
      // resting: little hop now and then (stronger when hinted), wiggle on touch
      b.bob += dt;
      const hinted = G.hintBin === b;
      const period = hinted ? 1.0 : 4.5;
      const ph = (b.bob % period) / period;
      const hopK = b.full && b.state !== 'waiting' && truckAccepting() ? Math.max(0, Math.sin(Math.min(1, ph * (hinted ? 2.2 : 6)) * Math.PI)) : 0;
      const hopH = hinted ? 0.35 : 0.12;
      r.position.set(b.rest.x, hopK * hopH, b.rest.z);
      const squash = 1 + 0.06 * Math.sin(b.bob * 3) * (b.full ? 1 : 0.3);
      r.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      r.rotation.set(0, 0, Math.sin(G.clock * 30) * 0.08 * b.wiggle);
      if (b.state === 'waiting') r.position.y = Math.abs(Math.sin(G.clock * 3 + b.id)) * 0.06;
      if (b.full && b.state !== 'waiting') b.lid.rotation.x = -0.2 - 0.25 * hopK;
    }
    // keep resting bins from overlapping
    for (let i = 0; i < bins.length; i++) for (let j = i + 1; j < bins.length; j++) {
      const a = bins[i], c = bins[j];
      if (!['home', 'placed', 'empty'].includes(a.state) || !['home', 'placed', 'empty'].includes(c.state)) continue;
      const dx = c.rest.x - a.rest.x, dz = c.rest.z - a.rest.z, dd = Math.hypot(dx, dz);
      if (dd < 1.0 && dd > 1e-4) {
        const push = (1.0 - dd) * 0.5 * Math.min(1, dt * 8), nx = dx / dd, nz = dz / dd;
        a.rest.x = clamp(a.rest.x - nx * push, S.xMin, S.xMax); a.rest.z = clamp(a.rest.z - nz * push, S.zMin, S.zMax);
        c.rest.x = clamp(c.rest.x + nx * push, S.xMin, S.xMax); c.rest.z = clamp(c.rest.z + nz * push, S.zMin, S.zMax);
        if (a.state === 'home') a.state = 'placed';
        if (c.state === 'home') c.state = 'placed';
      }
    }
  }

  function updateTown(dt) {
    updateBinsTown(dt);
    townScheduler();
    const st = hero.getStatus();
    const mode = G.sub === 'full' || G.sub === 'leave' ? 'off' : st.canLoad && !G.activeBin ? 'on' : 'dim';
    town.update(dt, G.clock, mode);
    G.truck.attention = G.sub === 'full' ? 1 : 0;
    for (const f of friends) { f.animal.update(dt); f.gift.update(dt); }
    // hints
    G.hintBin = null;
    let hintPos = null;
    if (G.sub === 'play' || G.sub === 'arrive') {
      const avail = townBinsAvailable(), free = freeMarkers();
      if (avail.length && free.length && G.idle > 3 && !G.drag) {
        avail.sort((a, b) => a.root.position.x - b.root.position.x);
        const b = avail[Math.floor(G.round + G.clock / 8) % avail.length];
        G.hintBin = b;
        hintPos = b.rest;
        if (G.idle > 6 && G.clock - G.lastGlove > 7 && !fx.glove.active) {
          G.lastGlove = G.clock;
          const m = nearestFreeMarker(b.rest);
          fx.glove.show('drag', v.copy(b.rest).setY(1.3), v2.copy(m.pos).setY(0.3));
        }
      }
    } else if (G.sub === 'full') {
      if (G.idle > 5 && G.clock - G.lastGlove > 6 && !fx.glove.active) {
        G.lastGlove = G.clock;
        fx.glove.show('tap', v.set(G.truck.x + dims.frontX - 0.8, 2.2, truckZ + dims.width / 2 + 0.3));
      }
    }
    showHint(hintPos, 0.85, dt);
  }

  function showHint(pos, scale, dt) {
    const on = !!pos;
    hintMat.opacity = on ? damp(hintMat.opacity, 0.55 + 0.25 * Math.sin(G.clock * 6), 8, dt) : Math.max(0, hintMat.opacity - dt * 4);
    if (on) { hintRing.position.set(pos.x, 0.04, pos.z); hintRing.scale.setScalar(scale * (1 + 0.08 * Math.sin(G.clock * 6))); }
    hintRing.visible = hintMat.opacity > 0.02;
  }

  // ======================= PLANT =======================
  function enterPlant() {
    G.scene = 'plant'; G.sub = 'arrive'; G.idle = 0; G.pendingDump = false; G.pendingPress = false; G.autoGive = false;
    fx.clear();
    town.group.visible = false;
    if (!plant) { plant = createPlant(tex, propMat, pressX, pressZ); scene.add(plant.group); warmUp(plant.group); }
    plant.group.visible = true;
    plant.cube.visible = false;
    plant.press.setHeadY(plant.press.topY);
    for (const m of plant.molds) { m.root.visible = false; m.root.scale.setScalar(0.001); }
    plant.home.root.visible = false; plant.home.root.scale.setScalar(0.001);
    camPose = PLANT.camera; applyCamera();
    // the friend who is waiting this time
    const kind = ANIMAL_KINDS[G.round % ANIMAL_KINDS.length];
    G.animal = createAnimal(kind, propMat);
    G.animal.root.position.set(...PLANT.animalPos);
    G.animal.root.scale.setScalar(PLANT.animalScale);
    G.animal.root.rotation.y = -0.3;
    G.animal.setMode('wait');
    plant.group.add(G.animal.root);
    // truck reverses in from the right
    G.truck.x = plantTruckX + 12;
    driveTo(plantTruckX, 2.8, () => { G.sub = 'button'; if (G.pendingDump) doDump(); }, true);
    popIn(plant.button.root, 0.5);
    fadeTo(0, 0.45);
  }

  function doDump() {
    if (hero.dump()) { G.sub = 'dumping'; tweens.wait(0.6, () => popOut(plant.button.root)); }
  }

  function plantDown(ndc) {
    const P = plant;
    if (G.sub === 'arrive' || G.sub === 'button') {
      if (hitTest(ndc, [P.button.hit])) {
        audio.play('boing');
        tweens.add(0.35, (k) => { P.button.top.position.y = P.button.topY - 0.16 * Math.sin(Math.PI * k); });
        if (G.sub === 'button') doDump(); else G.pendingDump = true;
        return;
      }
    }
    if (hitTest(ndc, [P.press.hit, P.press.bed])) {
      if (G.sub === 'press') { doPress(); return; }
      if (G.sub !== 'pressing') {
        // not its turn yet: still answer at once (a little bob + clunk); while dumping, remember it and press right after
        audio.play('clank');
        tweens.add(0.3, (k) => P.press.setHeadY(P.press.topY - 0.08 * Math.sin(Math.PI * k)));
        if (G.sub === 'dumping' || G.sub === 'button' || G.sub === 'arrive') G.pendingPress = true;
        if (G.sub === 'button' || G.sub === 'arrive') { if (G.sub === 'button') doDump(); else G.pendingDump = true; }
        return;
      }
    }
    if (G.sub === 'mold') {
      // the block first: the moulds' tall hit cylinders stand in front of it on screen and would steal the touch
      if (hitTest(ndc, [P.cubeHit])) {
        G.drag = { kind: 'cube', obj: P.cube, start: P.cube.position.clone(), target: P.cube.position.clone(), moved: false };
        audio.play('pick');
        return;
      }
      const mh = hitTest(ndc, P.molds.map((m) => m.hit));
      if (mh) { const m = P.molds.find((mm) => mm.hit === mh.object); doMold(m); return; }
    }
    if (G.sub === 'give' && G.gift) {
      if (hitTest(ndc, [G.gift.root])) {
        G.drag = { kind: 'gift', obj: G.gift.root, start: G.gift.root.position.clone(), target: G.gift.root.position.clone(), moved: false };
        audio.play('pick');
        return;
      }
      if (hitTest(ndc, [G.animal.root])) { giveGift(); return; }
    }
    if (G.sub === 'home' && hitTest(ndc, [P.home.hit])) { goHome(); return; }
    if (G.animal && hitTest(ndc, [G.animal.root])) { G.animal.poke(); audio.play('giggle'); return; }
    { const th = hitTest(ndc, hero.hitTargets.map((t) => t.object)); if (th) { truckTapped(th.point); return; } }
    const p = groundPoint(ndc);
    if (p) { fx.sparkleBurst(p.setY(0.1), 5, 0.4); audio.play('tap'); }
  }
  function plantMove(ndc) {
    const d = G.drag;
    if (!d) return;
    const p = groundPoint(ndc);
    if (!p) return;
    d.target.set(clamp(p.x, -6, 6), 0, clamp(p.z, -0.5, 4.6));
    if (d.target.distanceTo(d.start) > 0.2) d.moved = true;
  }
  function plantUp(ndc, info) {
    const d = G.drag;
    if (!d) return;
    G.drag = null;
    if (d.kind === 'cube') {
      if (!d.moved) { // tap on the block: it hops into the middle mold
        doMold(plant.molds[1]);
        return;
      }
      const mh = hitTest(ndc, plant.molds.filter((mm) => mm.root.visible).map((mm) => mm.hit));
      const ap = G.animal.root.position;
      if (!mh && (hitTest(ndc, [G.animal.root]) || Math.hypot(d.target.x - ap.x, d.target.z - ap.z) < 1.8)) {
        // straight to the friend (skipping the moulds) is fine too: a mould is chosen and the gift goes over by itself
        G.autoGive = true;
        doMold(plant.molds[Math.floor(Math.random() * plant.molds.length)]);
        return;
      }
      const m = mh ? plant.molds.find((mm) => mm.hit === mh.object) : nearestMold(d.target, 1.6);
      if (m) { doMold(m); return; }
      const to = d.target.clone().setY(PLANT.cubeSize / 2);
      hop(d.obj, to, 0.2, 0.1, () => audio.play('drop'));
      return;
    }
    if (d.kind === 'gift') {
      const ap = G.animal.root.position;
      const overAnimal = !!hitTest(ndc, [G.animal.root]);
      if (!d.moved || overAnimal || Math.hypot(d.target.x - ap.x, d.target.z - ap.z) < 2.6) { giveGift(); return; }
      hop(d.obj, d.target.clone().setY(0), 0.2, 0.1, () => audio.play('drop'));
    }
  }
  function nearestMold(p, maxD) {
    let best = null, bd = maxD;
    for (const m of plant.molds) { if (!m.root.visible) continue; const d = Math.hypot(m.root.position.x - p.x, m.root.position.z - p.z); if (d < bd) { bd = d; best = m; } }
    return best;
  }

  function doPress() {
    G.sub = 'pressing';
    const P = plant.press;
    const y0 = P.topY, y1 = P.bottomY + 0.06;
    tweens.add(0.38, (k) => P.setHeadY(lerp(y0, y1, k * k)), () => {
      hero.clearDump();
      // stripes = the child's loads in order
      G.stripes = makeStripes(G.layers.length ? G.layers : [0xcccccc], tex.images.trash);
      plant.cubeMat.map = G.stripes; plant.cubeMat.needsUpdate = true;
      plant.cube.position.set(pressX, PLANT.cubeSize / 2 + 0.06, pressZ);
      plant.cube.scale.setScalar(1); plant.cube.rotation.set(0, 0, 0);
      plant.cube.visible = true;
      audio.play('slam');
      fx.dust(v.set(pressX, 0, pressZ), 14, 1.4);
      tweens.wait(0.3, () => {
        tweens.add(0.9, (k) => P.setHeadY(lerp(y1, y0, easeInOut(k))), () => {
          fx.sparkleBurst(v.set(pressX, PLANT.cubeSize + 0.3, pressZ), 14, 1);
          audio.play('sparkle');
          G.sub = 'mold';
          plant.molds.forEach((m, i) => tweens.wait(i * 0.15, () => { popIn(m.root, 0.45); audio.play('hop'); }));
        });
      });
    });
  }

  function doMold(m) {
    if (G.sub !== 'mold') return;
    G.sub = 'molding';
    const cube = plant.cube;
    const to = v2.copy(m.root.position).setY(1.1).clone();
    hop(cube, to, 0.5, 1.2, () => {
      tweens.add(0.15, (k) => cube.scale.setScalar(1 - k * 0.9), () => {
        cube.visible = false;
        audio.play('poof');
        fx.dust(v.copy(m.root.position), 12, 1.0);
        fx.sparkleBurst(v.copy(m.root.position).setY(1), 16, 1);
        const gift = createGift(m.type, G.stripes, propMat);
        G.gift = gift;
        gift.root.position.copy(m.root.position).setY(0.38);
        plant.group.add(gift.root);
        gift.root.scale.setScalar(0.001);
        popIn(gift.root, 0.6);
        for (const o of plant.molds) {
          if (o === m) tweens.wait(0.7, () => { popOut(o.root, 0.35); tweens.add(0.35, (k) => { gift.root.position.y = 0.38 * (1 - k); }); });
          else popOut(o.root, 0.3);
        }
        tweens.wait(1.1, () => {
          G.sub = 'give'; G.animal.setMode('reach'); audio.play('giggle');
          if (G.autoGive) { G.autoGive = false; tweens.wait(0.35, giveGift); }
        });
      });
    });
    audio.play('hop');
  }

  function giveGift() {
    if (G.sub !== 'give' || !G.gift) return;
    G.sub = 'happy';
    const gift = G.gift, animal = G.animal;
    const hp = worldOf(animal.holdPoint);
    plant.group.worldToLocal(hp);
    hop(gift.root, hp.clone().setY(hp.y - 0.4), 0.55, 1.0, () => {
      animal.holdPoint.attach(gift.root);
      tweens.add(0.25, (k) => { gift.root.scale.setScalar(lerp(1, 0.6, k)); gift.root.position.lerp(v.set(0, -0.35, 0), k); });
      animal.setMode('happy');
      audio.play('happy'); audio.play('giggle');
      fx.hearts(worldOf(animal.head, v).setY(v.y + 0.6), 7);
      fx.sparkleBurst(worldOf(animal.root, v).setY(1.4), 14, 1);
      tweens.wait(1.9, () => startPlay());
    });
    gift.setMode('carried');
  }

  function arrangeFriend(animal, gift, parent) {
    // put the gift next to the friend and let them "use" it
    parent.attach(gift.root);
    gift.root.rotation.set(0, 0, 0);
    gift.root.scale.setScalar(1);
    const ap = animal.root.position;
    if (gift.type === 'bench') {
      gift.root.position.set(ap.x, 0, ap.z - 0.15);
      animal.setSit(1);
    } else if (gift.type === 'ball') {
      gift.root.position.set(ap.x - 1.0, 0, ap.z + 0.3);
    } else {
      gift.root.position.set(ap.x - 0.95, 0, ap.z + 0.1);
    }
  }

  function startPlay() {
    const gift = G.gift, animal = G.animal;
    arrangeFriend(animal, gift, plant.group);
    gift.setMode('play');
    animal.setMode('friend');
    animal.cheer();
    audio.play(gift.type === 'pot' ? 'grow' : gift.type === 'ball' ? 'bounce' : 'boing');
    fx.hearts(worldOf(animal.head, v).setY(v.y + 0.6), 5);
    tweens.wait(0.9, () => { G.sub = 'home'; popIn(plant.home.root, 0.5); audio.play('hop'); }); // "again" comes quickly
  }

  function goHome() {
    G.sub = 'leaving';
    audio.play('boing');
    tweens.add(0.3, (k) => { plant.home.top.position.y = plant.home.topY - 0.15 * Math.sin(Math.PI * k); });
    fadeTo(1, 0.45, enterTown);
  }

  function updatePlant(dt) {
    const P = plant;
    pulse(P.button.topMat, G.sub === 'button' || G.sub === 'arrive');
    pulse(P.press.headMat, G.sub === 'press');
    for (const m of P.molds) {
      pulse(m.topMat, G.sub === 'mold');
      if (m.root.visible) m.top.rotation.y += dt * 0.8;
    }
    pulse(P.home.topMat, G.sub === 'home');
    if (P.cube.visible) {
      pulse(P.cubeMat, G.sub === 'mold');
      if (G.drag && G.drag.kind === 'cube') {
        const d = G.drag, c = P.cube;
        c.position.x = damp(c.position.x, d.target.x, 20, dt);
        c.position.z = damp(c.position.z, d.target.z, 20, dt);
        c.position.y = damp(c.position.y, PLANT.cubeSize / 2 + 0.5, 15, dt);
        const m = nearestMold(d.target, 1.5);
        for (const o of P.molds) o.root.scale.setScalar(damp(o.root.scale.x, o === m ? 1.18 : 1, 10, dt));
      } else if (G.sub === 'mold') {
        P.cube.rotation.y = Math.sin(G.clock * 2) * 0.15;
      }
    }
    if (G.sub === 'press') P.press.setHeadY(P.press.topY + Math.sin(G.clock * 5) * 0.12);
    if (G.sub === 'button') P.button.top.position.y = P.button.topY + Math.abs(Math.sin(G.clock * 4)) * 0.06;
    if (G.sub === 'home') P.home.root.position.y = Math.abs(Math.sin(G.clock * 4)) * 0.15;
    if (G.gift) {
      if (G.drag && G.drag.kind === 'gift') {
        const d = G.drag, r = G.gift.root;
        r.position.x = damp(r.position.x, d.target.x, 20, dt);
        r.position.z = damp(r.position.z, d.target.z, 20, dt);
        r.position.y = damp(r.position.y, 0.5, 15, dt);
      }
      G.gift.update(dt);
    }
    if (G.animal) {
      const focus = G.sub === 'give' && G.gift ? worldOf(G.gift.root, v) : G.sub === 'mold' || G.sub === 'molding' ? worldOf(P.cube, v) : G.sub === 'dumping' || G.sub === 'press' || G.sub === 'pressing' ? v.set(pressX, 1, pressZ) : v.set(0, 1.5, 12);
      G.animal.lookAt(focus);
      G.animal.update(dt);
    }
    // halo + glove hints for the one active thing
    let target = null, gloveFrom = null, gloveTo = null, kind = 'tap', scale = 1.1;
    if (G.sub === 'button') { target = P.button.root.position; scale = 1.15; }
    else if (G.sub === 'press') { target = P.pressPos; scale = 1.8; }
    else if (G.sub === 'mold' && P.cube.visible && !G.drag) { target = P.cube.position; gloveFrom = P.cube.position; gloveTo = P.molds[1].root.position; kind = 'drag'; scale = 1.2; }
    else if (G.sub === 'give' && G.gift && !G.drag) { target = G.gift.root.position; gloveFrom = G.gift.root.position; gloveTo = G.animal.root.position; kind = 'drag'; }
    else if (G.sub === 'home') { target = P.home.root.position; }
    showHint(target, scale, dt);
    if (target && G.idle > 6 && G.clock - G.lastGlove > 7 && !fx.glove.active) {
      G.lastGlove = G.clock;
      const from = (gloveFrom || target).clone(); from.y = G.sub === 'press' ? 4.8 : 1.0;
      if (G.sub === 'press') from.z += 1.3;
      fx.glove.show(kind, from, gloveTo ? gloveTo.clone().setY(0.6) : null);
    }
  }

  // ======================= back to TOWN =======================
  function enterTown() {
    const P = plant;
    // the friend moves into town with the gift (the result stays!)
    if (G.animal && G.gift) {
      const slotIdx = G.round % TOWN.friendSlots.length;
      const old = friends.findIndex((f) => f.slot === slotIdx);
      if (old >= 0) { const f = friends[old]; f.animal.root.removeFromParent(); f.gift.root.removeFromParent(); f.animal.dispose(); f.gift.dispose(); friends.splice(old, 1); }
      const [fxp, fzp] = TOWN.friendSlots[slotIdx];
      town.group.add(G.animal.root);
      G.animal.root.position.set(fxp, 0, fzp);
      G.animal.root.scale.setScalar(1);
      G.animal.root.rotation.y = fxp < 0 ? 0.3 : -0.3;
      G.animal.setSit(0);
      arrangeFriend(G.animal, G.gift, town.group);
      if (G.gift.type !== 'bench') G.gift.root.position.x = fxp + (fxp < 0 ? 1.0 : -1.0);
      G.gift.setMode('friend');
      G.animal.setMode('friend');
      G.animal.lookAt(v.set(0, 1.5, 12));
      friends.push({ animal: G.animal, gift: G.gift, slot: slotIdx });
    } else if (G.animal) { G.animal.root.removeFromParent(); G.animal.dispose(); }
    G.animal = null; G.gift = null; G.stripes = null; G.layers = [];
    P.cubeMat.map = null; P.cubeMat.needsUpdate = true;
    P.group.visible = false;
    hero.clearDump();
    hero.reset();
    fx.clear();
    G.round++;
    // bins: refill, new order
    const slots = shuffle(homeSlots.slice(), rnd);
    bins.forEach((b, i) => {
      b.home.copy(slots[i]); b.rest.copy(b.home); b.root.position.copy(b.home);
      b.root.rotation.set(0, 0, 0); b.root.scale.set(1, 1, 1);
      b.marker = null; b.state = 'home'; refillBin(b, rnd);
      if (b.root.parent !== town.group) town.group.add(b.root);
    });
    for (const m of town.markers) { m.bin = null; m.hover = false; }
    G.activeBin = null;
    town.group.visible = true;
    camPose = TOWN.camera; applyCamera();
    G.scene = 'town'; G.sub = 'arrive'; G.idle = 0;
    G.truck.x = -17;
    driveTo(truckHomeX, 2.6, () => { if (G.sub === 'arrive') G.sub = 'play'; });
    fadeTo(0, 0.45);
  }

  function fadeTo(target, dur, onDone) {
    const from = fadeLevel;
    if (target > 0) audio.play('whoosh');
    tweens.add(dur, (k) => setFade(lerp(from, target, easeInOut(k))), onDone);
  }

  // ---------------- hero events ----------------
  function handleHeroEvents() {
    while (heroEvents.length) {
      const ev = heroEvents.shift();
      const bin = ev.binId != null ? bins.find((b) => b.id === ev.binId) : null;
      switch (ev.type) {
        case 'binEmptied': if (bin) bin.full = false; break;
        case 'binReleased':
          if (bin) {
            G.activeBin = G.activeBin === bin ? null : G.activeBin;
            if (G.scene === 'town') binHome(bin, true); else { bin.state = 'empty'; }
          }
          break;
        case 'loadStart': if (bin) G.layers.push(bin.load.layerColor); break;
        case 'compacted': {
          const wx = G.truck.x + (dims.rearX + dims.frontX) / 2 - 0.8;
          fx.sparkleBurst(v.set(wx, dims.height * 0.65, truckZ + dims.width / 2 + 0.3), 10, 0.8);
          audio.play('sparkle');
          break;
        }
        case 'ready': if (G.activeBin && G.activeBin.state !== 'truck') G.activeBin = null; break;
        case 'full':
          if (G.scene === 'town') {
            G.sub = 'full'; G.idle = 0;
            fx.glove.hide();
            audio.play('honk');
            for (const b of bins) if (b.state === 'waiting') { binHome(b, false); }
          }
          break;
        case 'dumpLanded': {
          const p = ev.pointLocal ? hero.root.localToWorld(ev.pointLocal.clone()) : v.set(pressX, 0, pressZ);
          fx.dust(p, 16, 1.6);
          break;
        }
        case 'dumpDone':
          if (G.scene === 'plant') {
            G.sub = 'press'; G.idle = 0;
            if (G.pendingPress) { G.pendingPress = false; tweens.wait(0.35, () => { if (G.sub === 'press') doPress(); }); }
          }
          break;
        default: break;
      }
    }
  }

  // ---------------- input ----------------
  createInput(canvas, {
    down(ndc) {
      audio.unlock();
      G.idle = 0;
      if (fx.glove.active) fx.glove.hide();
      if (fadeLevel > 0.5) return;
      if (G.scene === 'town') townDown(ndc); else if (plant) plantDown(ndc);
    },
    move(ndc) { if (G.scene === 'town') townMove(ndc); else plantMove(ndc); },
    up(ndc, info) { if (G.scene === 'town') townUp(ndc, info); else plantUp(ndc, info); },
  });

  // Compile every material now (also hidden ones: falling trash, dump chunks, sparkles, hearts) and upload the
  // photo textures, so Safari does not stall for a shader compile / texture upload in the middle of an animation.
  // Called before the first frame (town + hero) and when the plant is built (under the fade).
  function warmUp(root) {
    try {
      renderer.compile(root, camera, scene);
      if (root === scene) for (const k in tex.photo) if (tex.photo[k]) renderer.initTexture(tex.photo[k]);
    } catch (err) { errors.push('warmup: ' + (err && err.message)); }
  }

  // ---------------- context loss ----------------
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; BOOT.lost++; }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    // three.js re-initialises its GL state; mark textures dirty so they are re-uploaded. Game state is untouched.
    scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) { for (const k in m) { const t = m[k]; if (t && t.isTexture) t.needsUpdate = true; } m.needsUpdate = true; }
    });
    try { hero.onContextRestored && hero.onContextRestored(); } catch (err) { errors.push('hero restore: ' + err.message); }
    contextLost = false; BOOT.restored++;
  }, false);

  // ---------------- debug ----------------
  const debug = debugOn ? createDebug({ renderer, scene, camera, tier, getBoot: () => BOOT, getHeroRoot: () => hero.root, getState: () => `${G.scene}:${G.sub} round ${G.round} fill ${hero.getStatus().fill.toFixed(2)}`, errors, bootMode }) : null;

  // ---------------- loop ----------------
  let last = performance.now();
  function step(dt) {
    G.clock += dt; G.idle += dt;
    tweens.update(dt);
    updateTruck(dt);
    hero.update(dt, { time: G.clock, drive: G.truck.vx, attention: G.truck.attention, camera });
    handleHeroEvents();
    if (G.scene === 'town') updateTown(dt); else if (plant) updatePlant(dt);
    fx.update(dt, camera);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    // iPad Pro has a 120 Hz screen: draw at most ~60 times a second (half the GPU/CPU work and battery; nothing here needs more)
    if (now - last < 12) return;
    const raw = Math.min(0.05, Math.max(0, (now - last) / 1000));
    const ms = now - last;
    last = now;
    if (contextLost) return;
    try {
      const total = raw * timescale;
      const n = Math.max(1, Math.ceil(total / 0.05 - 1e-6));
      const t0 = performance.now();
      for (let i = 0; i < n; i++) step(total / n);
      const t1 = performance.now();
      renderer.render(scene, camera);
      if (!BOOT.firstFrame) BOOT.firstFrame = performance.now();
      if (debug) { debug.frame(ms, t1 - t0, performance.now() - t1); debug.update(raw); }
    } catch (err) {
      errors.push(err && err.message || String(err));
      console.error(err);
    }
  }

  // ---------------- test / debug hooks (used by tools/smoke.cjs) ----------------
  const proj = (p) => { const q = p.clone().project(camera); return { x: ((q.x + 1) / 2) * window.innerWidth, y: ((1 - q.y) / 2) * window.innerHeight }; };
  window.__game = {
    get state() { return `${G.scene}:${G.sub}`; },
    get round() { return G.round; },
    errors,
    targets() {
      const out = {};
      if (G.scene === 'town') {
        townBinsAvailable().forEach((b, i) => { out['bin' + i] = proj(v.copy(b.rest).setY(0.7)); });
        freeMarkers().forEach((m, i) => { out['marker' + i] = proj(m.pos); });
        out.truck = proj(v.set(G.truck.x + dims.frontX - 0.8, 1.8, truckZ + dims.width / 2));
      } else if (plant) {
        out.button = proj(worldOf(plant.button.top, v).setY(0.9));
        out.press = proj(v.set(pressX, plant.press.head.position.y + 0.3, pressZ));
        if (plant.cube.visible) out.cube = proj(worldOf(plant.cube, v));
        plant.molds.forEach((m, i) => { if (m.root.visible) out['mold' + i] = proj(v.copy(m.root.position).setY(0.7)); });
        if (G.gift) out.gift = proj(worldOf(G.gift.root, v).setY(0.4));
        if (G.animal) out.animal = proj(worldOf(G.animal.root, v).setY(0.8));
        out.home = proj(worldOf(plant.home.root, v).setY(0.5));
      }
      return out;
    },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) { ext.loseContext(); window.__loseExt = ext; } return !!ext; },
    restoreContext() { if (window.__loseExt) window.__loseExt.restoreContext(); },
    get contextLost() { return contextLost; },
    /** measurement only (?debug=1): fill every friend slot so the worst-case town can be measured */
    debugFillFriends() {
      if (!debugOn) return false;
      TOWN.friendSlots.forEach(([fxp, fzp], slot) => {
        if (friends.some((f) => f.slot === slot)) return;
        const animal = createAnimal(ANIMAL_KINDS[slot % ANIMAL_KINDS.length], propMat);
        const gift = createGift(['ball', 'bench', 'pot'][slot % 3], makeStripes([0xff8a8a, 0x7fd0ff, 0xfff08a], tex.images.trash), propMat);
        town.group.add(animal.root, gift.root);
        animal.root.position.set(fxp, 0, fzp);
        arrangeFriend(animal, gift, town.group);
        gift.setMode('friend'); animal.setMode('friend');
        friends.push({ animal, gift, slot });
      });
      return friends.length;
    },
    renderer, scene, boot: BOOT,
  };

  G.sub = 'arrive';
  driveTo(truckHomeX, 2.6, () => { if (G.sub === 'arrive') G.sub = 'play'; });
  warmUp(scene);
  requestAnimationFrame(frame);
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
  window.__game.ready = true;
}

main().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.classList.add('failed');
  window.__bootError = String(err && err.stack || err);
});
