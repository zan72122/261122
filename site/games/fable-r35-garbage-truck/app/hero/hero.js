// Hero: the garbage truck's "grab → lift → tip → squeeze → dump" mechanism.
// API: docs/HERO-SPEC.md (createHero). three is never imported here: the THREE argument is used.
// Everything is driven by update(dt): no timers, no performance.now(), no physics engine.
//
// How the pieces hang together (all in the truck's local frame, +x cab, +z camera side):
//  - arm: 2 links in the y-z plane (shoulder P0 on a tower between cab and body) + wrist. The wrist
//    follows a path (reach → lift → over the hopper); joint angles come from inverse kinematics and the
//    three cylinders are drawn between their two pins, so their stroke always matches the pose.
//  - bin: attached to the gripper between binGrabbed and binReleased. Its lid is a damped pendulum.
//  - trash: instanced pieces leave the bin mouth, fall with p' = v, v' = g onto a height field in the
//    hopper, get shoved by the packer plate and squeezed against the stack, then become one layer.
//  - dump: the body tilts, the gate swings up, the stack slides out (a = g·(sin φ − μ·cos φ)) and breaks
//    into chunks that fly on parabolas to a pile height field around dims.dumpSpot.
import { makeParams, makeAtlas, buildTruck } from './model.js';

export const HERO_API_VERSION = 1;

export function createHero(THREE, opts = {}) {
  const P = makeParams(opts);
  const T = opts.textures || {};
  const capacity = P.capacity;
  const D2R = Math.PI / 180;
  const emit = (type, extra) => { try { opts.onEvent && opts.onEvent(Object.assign({ type }, extra)); } catch (e) { console.error(e); } };
  const sound = (name, p) => { try { opts.onSound && opts.onSound(name, p || {}); } catch (e) { console.error(e); } };

  // ---------------- materials (hero-owned; shared textures are never disposed) ----------------
  const atlas = makeAtlas(THREE, T.trash);
  atlas.anisotropy = Math.max(1, Math.min(4, opts.anisotropy || 1));
  const L = (o) => new THREE.MeshLambertMaterial(o);
  const mats = {
    paint: L({ map: T.paint || null, color: T.paint ? 0xffffff : 0x35b53c, vertexColors: true }),
    steel: L({ map: T.steel || null, color: T.steel ? 0xe6eaed : 0xb9c2ca, vertexColors: true }),
    color: L({ map: atlas, vertexColors: true }),
    inst: L({ color: 0xffffff }),
    piece: L({ vertexColors: true }),
    chunk: L({ map: T.trash || null, color: 0xffffff }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    shadow: new THREE.MeshBasicMaterial({ map: T.shadow || null, color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false }),
  };
  mats.layer = mats.color;
  const geos = [];
  const M = buildTruck(THREE, P, mats, geos);
  const { root, sprung, tilt, body, gate, plate, boom, stick, gripper } = M;

  const binSpot = new THREE.Vector3(P.binX, 0, P.binZ);
  const dumpSpot = new THREE.Vector3(P.rearX - P.dumpDX, 0, 0);

  // ---------------- small maths ----------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sm = (a, b, x) => { const k = clamp((x - a) / (b - a || 1e-6), 0, 1); return k * k * (3 - 2 * k); };
  const easeOut3 = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const easeIO = (k) => { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  let seed = ((opts.seed | 0) || 12345) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const finite = (v, d) => (v === v && v !== Infinity && v !== -Infinity ? v : d);

  // temps (never allocate inside update)
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4(), mB = new THREE.Matrix4(), rootInv = new THREE.Matrix4(), bodyInv = new THREE.Matrix4();
  const q4 = new THREE.Quaternion(), q5 = new THREE.Quaternion(), s4 = new THREE.Vector3(1, 1, 1), eul = new THREE.Euler(), col = new THREE.Color();
  const evPoint = new THREE.Vector3();

  // ---------------- state ----------------
  const S = {
    state: 'idle', loads: 0, readyPending: true, time: 0,
    wz: P.stow.z, wy: P.stow.y, beta: 0, claw: -1, // arm pose: wrist (z, y), bin tilt (rad, toward the truck), claws
    plateX: P.plateHome, plateFrom: P.plateHome, plateTo: P.plateHome, plateT: 1, plateDur: 1, // background plate moves
    phi: 0, gateSway: 0,
    bob: 0, bobV: 0, pitch: 0, pitchV: 0, roll: 0, lastDrive: 0, wheelA: 0,
    flash: 0, wave: 0, waveAmp: 0, idleT: 0, shudder: 0, pressure: 0,
    pieceKind: 'paper', pieceN: 0,
    chunkN: 0,
  };
  // one load cycle (pre-allocated)
  const cyc = {
    active: false, bin: null, parent: null, t: 0, grabbed: false, released: false, emptied: false,
    origPos: new THREE.Vector3(), gz: 0, gy: 0, pourT: -1, lidV: 0, lidSnd: false, lastBeta: 0, lastBetaV: 0,
    squash: 0, compT: -1, compDone: false, armDone: false, snd: 0, lp0: 1, hold: 0, landedAll: false, squeeze: 1, plate0: 0,
  };
  const dmp = { active: false, t: 0, slide: 0, slideV: 0, moving: false, outT: -1, downT: -1, landed: false, snd: 0, done: false };
  // layers (stack of compressed loads, rear first)
  const layTh = new Float32Array(capacity), layV = new Float32Array(capacity), layCol = new Float32Array(capacity * 3);
  const laySpawn = new Uint8Array(capacity), layBits = new Float32Array(capacity * 12); // up to 4 piece colours per layer
  // pieces (struct of arrays)
  const N = P.pieceMax;
  const pp = new Float32Array(N * 3), pv = new Float32Array(N * 3), pr = new Float32Array(N * 3), pw = new Float32Array(N * 3);
  const pcol = new Float32Array(N * 3), prad = new Float32Array(N), psize = new Float32Array(N), prel = new Float32Array(N);
  const pd0 = new Float32Array(N), py0 = new Float32Array(N), plift = new Float32Array(N), pst = new Uint8Array(N), phop = new Uint8Array(N);
  // hopper height field (pieces pile up on it)
  const HX0 = -0.52, HNX = 5, HNZ = 8, HCX = (P.plateHome - HX0) / HNX, HCZ = (P.inZ * 2) / HNZ;
  const hf = new Float32Array(HNX * HNZ);
  // chunks (dump)
  const CN = P.chunkMax;
  const cp = new Float32Array(CN * 3), cv = new Float32Array(CN * 3), ct = new Float32Array(CN * 3), cr = new Float32Array(CN * 3), cs = new Float32Array(CN * 3);
  const ccol = new Float32Array(CN * 3), ctime = new Float32Array(CN), cdur = new Float32Array(CN), cst = new Uint8Array(CN), cspin = new Float32Array(CN);
  const PN = 9, PC = (P.pileR * 2 + 0.1) / PN;
  const pile = new Float32Array(PN * PN);

  const KIND_R = { paper: 0.2, box: 0.2, bottle: 0.16, can: 0.13, bag: 0.19 };
  const G = -9.8 * 0.8;

  // ---------------- arm ----------------
  const WPn = 5;
  const wpU = [0, 0.3, 0.58, 0.8, 1], wpZ = new Float32Array(WPn), wpY = new Float32Array(WPn);
  function setPath(gz, gy) {
    wpZ[0] = gz; wpY[0] = gy;
    wpZ[1] = gz + 0.09; wpY[1] = gy + 0.78;
    wpZ[2] = gz + 0.13; wpY[2] = gy + 1.75;
    wpZ[3] = gz + 0.03; wpY[3] = 3.2;
    wpZ[4] = 1.32; wpY[4] = 3.4;
  }
  const crom = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  function pathAt(u) {
    u = clamp(u, 0, 1);
    let i = 0;
    while (i < WPn - 2 && u > wpU[i + 1]) i++;
    const i0 = Math.max(0, i - 1), i3 = Math.min(WPn - 1, i + 2);
    const t = (u - wpU[i]) / (wpU[i + 1] - wpU[i]);
    S.wz = crom(wpZ[i0], wpZ[i], wpZ[i + 1], wpZ[i3], t);
    S.wy = crom(wpY[i0], wpY[i], wpY[i + 1], wpY[i3], t);
    S.beta = (25 * sm(0.4, 0.8, u) + 125 * sm(0.74, 1, u)) * D2R;
  }
  /** inverse kinematics of the 2-link arm, then the wrist keeps the bin at the wanted tilt */
  function poseArm() {
    const dz = S.wz - P.P0.z, dy = S.wy - P.P0.y;
    const r = clamp(Math.hypot(dz, dy), Math.abs(P.L1 - P.L2) + 0.02, P.L1 + P.L2 - 0.02);
    const c = clamp((r * r - P.L1 * P.L1 - P.L2 * P.L2) / (2 * P.L1 * P.L2), -1, 1);
    const t2 = Math.acos(c);
    const t1 = Math.atan2(dy, dz) - Math.atan2(P.L2 * Math.sin(t2), P.L1 + P.L2 * Math.cos(t2));
    boom.rotation.x = -t1;
    stick.rotation.x = -t2;
    gripper.rotation.x = -(S.beta - t1 - t2);
    // claws: -1 folded flat, 0 closed on the bin, +1 wide open
    const a = S.claw >= 0 ? lerp(-0.08, 0.62, S.claw) : lerp(-0.08, -1.31, -S.claw);
    q4.setFromAxisAngle(yAxis, a);
    m4.compose(v1.set(P.gripX + 0.56, 0.09, 0.15), q4, s4.set(1, 1, 1));
    M.claws.setMatrixAt(0, m4);
    q4.setFromAxisAngle(yAxis, -a); q5.setFromAxisAngle(v2.set(0, 0, 1), Math.PI); q4.multiply(q5);
    m4.compose(v1.set(P.gripX - 0.56, -0.09, 0.15), q4, s4);
    M.claws.setMatrixAt(1, m4);
    M.claws.instanceMatrix.needsUpdate = true;
  }

  // ---------------- hydraulics: every tube is drawn from pin to pin ----------------
  const cylQ = M.cyls.map(() => new THREE.Quaternion());
  function drawCylinders() {
    for (let i = 0; i < M.cyls.length; i++) {
      const c = M.cyls[i];
      v1.copy(c.a[1]).applyMatrix4(c.a[0].matrixWorld).applyMatrix4(rootInv);
      v2.copy(c.b[1]).applyMatrix4(c.b[0].matrixWorld).applyMatrix4(rootInv);
      v3.subVectors(v2, v1);
      const len = finite(v3.length(), 0);
      if (len > 1e-4) cylQ[i].setFromUnitVectors(yAxis, v3.multiplyScalar(1 / len));
      const q = cylQ[i], r = c.r;
      // barrel (fixed length), optional middle stage, rod (reaches the far pin)
      m4.compose(v1, q, s4.set(r, Math.max(0.02, Math.min(c.barrel, len * 0.97)), r));
      M.tubes.setMatrixAt(c.tube0, m4);
      if (c.stages === 3) {
        const mid = len > c.barrel ? (len + c.barrel) / 2 : len * 0.985;
        m4.compose(v1, q, s4.set(r * 0.76, Math.max(0.02, mid), r * 0.76));
        M.tubes.setMatrixAt(c.tube0 + 1, m4);
      }
      const rr = c.stages === 3 ? r * 0.52 : r * 0.55;
      m4.compose(v1, q, s4.set(rr, Math.max(0.02, len), rr));
      M.tubes.setMatrixAt(c.tube0 + c.stages - 1, m4);
      m4.compose(v1, q, s4.set(r * 1.3, r * 1.3, r * 1.3));
      M.eyes.setMatrixAt(i * 2, m4);
      m4.compose(v2, q, s4.set(r * 1.15, r * 1.15, r * 1.15));
      M.eyes.setMatrixAt(i * 2 + 1, m4);
    }
    M.tubes.instanceMatrix.needsUpdate = true;
    M.eyes.instanceMatrix.needsUpdate = true;
  }

  // ---------------- lamps ----------------
  const lampScale = new Float32Array(M.lampDefs.length).fill(1);
  function setLamp(i, hex, k, scale) {
    col.setHex(hex).multiplyScalar(k);
    M.lamps.setColorAt(i, col);
    lampScale[i] = scale;
  }
  function drawLamps() {
    q4.identity();
    for (let i = 0; i < M.lampDefs.length; i++) {
      const d = M.lampDefs[i];
      v1.copy(d.at[1]).applyMatrix4(d.at[0].matrixWorld).applyMatrix4(rootInv);
      const r = d.r * lampScale[i];
      m4.compose(v1, q4, s4.set(r * (d.sx || 1), r * (d.sy || 1), r * (d.sz || 1)));
      M.lamps.setMatrixAt(i, m4);
    }
    M.lamps.instanceMatrix.needsUpdate = true;
    M.lamps.instanceColor.needsUpdate = true;
  }

  // ---------------- body parts ----------------
  function setHoist(phi) {
    S.phi = phi;
    tilt.rotation.z = phi;
    const k = phi / P.hoistMax;
    gate.rotation.z = -((100 * D2R + phi) * sm(0.08, 0.45, k) + S.gateSway * sm(0.2, 0.6, k));
  }
  function movePlate(to, dur) { S.plateFrom = S.plateX; S.plateTo = to; S.plateT = 0; S.plateDur = Math.max(0.05, dur); }
  function stackFront(n) { let x = P.rearIn + 0.02; for (let k = 0; k < n; k++) x += layTh[k]; return x; }

  function drawLayers() {
    const n = S.loads;
    const lip = P.rearIn - 0.02;
    let x = P.rearIn + 0.02 - (dmp.active ? dmp.slide : 0);
    let shown = 0;
    q4.identity();
    for (let k = 0; k < n; k++) {
      const th = layTh[k];
      let xa = x, xb = x + th;
      x = xb;
      if (xb <= lip + 0.01) continue; // already out of the gate
      if (xa < lip) xa = lip;
      const h = clamp(P.layerH * Math.sqrt(P.tau / Math.max(0.05, th)), 1.2, P.layerMaxH);
      m4.compose(v1.set(xa, P.floorY, 0), q4, s4.set(Math.max(0.01, xb - xa), h, P.inZ * 2 - 0.05));
      M.layers.setMatrixAt(shown, m4);
      M.layers.setColorAt(shown, col.setRGB(layCol[k * 3], layCol[k * 3 + 1], layCol[k * 3 + 2]));
      shown++;
    }
    M.layers.count = shown;
    M.layers.instanceMatrix.needsUpdate = true;
    M.layers.instanceColor.needsUpdate = true;
  }

  function stepLayers(dt) {
    // each layer is a little spring around its rest thickness; the plate can only hold them shorter
    const n = S.loads;
    const target = P.tau * (1 - 0.07 * S.pressure);
    for (let k = 0; k < n; k++) {
      layV[k] += (150 * (target - layTh[k]) - 11 * layV[k]) * dt;
      layTh[k] = clamp(layTh[k] + layV[k] * dt, P.tau * 0.5, P.tau * 1.08);
    }
    if (n > 0 && !dmp.active) {
      const room = S.plateX - (P.rearIn + 0.02);
      let total = 0;
      for (let k = 0; k < n; k++) total += layTh[k];
      if (total > room) { // squeezed by the plate: the newest layer gives first
        const over = total - room, k = n - 1;
        const give = Math.min(over, layTh[k] - P.tau * 0.5);
        layTh[k] -= give; if (layV[k] > 0) layV[k] = 0;
        const rest = over - give;
        if (rest > 1e-4 && n > 1) { const f = 1 - rest / Math.max(1e-3, total - layTh[k] - give); for (let j = 0; j < n - 1; j++) layTh[j] *= clamp(f, 0.6, 1); }
      }
    }
  }

  // ---------------- pieces ----------------
  function clearPieces() {
    S.pieceN = 0;
    pst.fill(0);
    hf.fill(0);
    for (const k in M.pools) M.pools[k].count = 0;
  }
  function preparePieces(b) {
    const load = b.load || {};
    S.pieceKind = M.pools[load.kind] ? load.kind : 'paper';
    const want = Math.round((load.count || 8) * (P.low ? 2 : 4.5));
    const n = clamp(want, 4, N);
    S.pieceN = n;
    hf.fill(0);
    const colors = load.colors && load.colors.length ? load.colors : [0xffffff];
    const baseR = KIND_R[S.pieceKind] || 0.2;
    for (let i = 0; i < n; i++) {
      pst[i] = 1; phop[i] = 0;
      psize[i] = 1.1 + rnd() * 0.45;
      prad[i] = baseR * psize[i];
      col.set(colors[i % colors.length]);
      pcol[i * 3] = col.r; pcol[i * 3 + 1] = col.g; pcol[i * 3 + 2] = col.b;
      // most of it rushes out as the bin tips; the rest comes with the shakes
      const f = i / n;
      prel[i] = f < 0.62 ? rnd() * 0.36 : f < 0.85 ? 0.52 + rnd() * 0.12 : 0.84 + rnd() * 0.12;
      plift[i] = rnd();
    }
    // remember the colours for the bits that fly out at the dump
    const k = S.loads;
    if (k < capacity) for (let j = 0; j < 4; j++) { col.set(colors[j % colors.length]); layBits[k * 12 + j * 3] = col.r; layBits[k * 12 + j * 3 + 1] = col.g; layBits[k * 12 + j * 3 + 2] = col.b; }
  }
  function hfIndex(x, z) {
    const ix = clamp(Math.floor((x - HX0) / HCX), 0, HNX - 1), iz = clamp(Math.floor((z + P.inZ) / HCZ), 0, HNZ - 1);
    return ix * HNZ + iz;
  }
  function releasePiece(i, b) {
    // from the bin's mouth, in the body frame
    mB.multiplyMatrices(bodyInv, b.root.matrixWorld);
    const h = (b.size && b.size.h) || P.bin.h;
    v1.set((rnd() - 0.5) * 0.5, h - 0.12, (rnd() - 0.5) * 0.5).applyMatrix4(mB);
    v2.set((rnd() - 0.5) * 0.9, 1.3 + rnd() * 1.5, (rnd() - 0.5) * 0.7).transformDirection(mB).multiplyScalar(1.6 + rnd() * 0.9);
    pp[i * 3] = v1.x; pp[i * 3 + 1] = v1.y; pp[i * 3 + 2] = Math.min(v1.z, P.inZ - 0.2);
    pv[i * 3] = v2.x; pv[i * 3 + 1] = v2.y; pv[i * 3 + 2] = Math.min(v2.z, 0.2) - 0.4;
    pr[i * 3] = rnd() * 6; pr[i * 3 + 1] = rnd() * 6; pr[i * 3 + 2] = rnd() * 6;
    pw[i * 3] = (rnd() - 0.5) * 12; pw[i * 3 + 1] = (rnd() - 0.5) * 8; pw[i * 3 + 2] = (rnd() - 0.5) * 12;
    pst[i] = 2;
  }
  function stepPieces(dt) {
    const n = S.pieceN;
    let landedNow = 0;
    const xMin = Math.max(stackFront(S.loads), HX0) + 0.05;
    for (let i = 0; i < n; i++) {
      if (pst[i] !== 2) continue;
      const a = i * 3, r = prad[i];
      pv[a + 1] += G * dt;
      pp[a] += pv[a] * dt; pp[a + 1] += pv[a + 1] * dt; pp[a + 2] += pv[a + 2] * dt;
      pr[a] += pw[a] * dt; pr[a + 1] += pw[a + 1] * dt; pr[a + 2] += pw[a + 2] * dt;
      // hopper walls (only below the rim), plate face in front, stack behind
      const zl = P.inZ - r * 0.8;
      if (pp[a + 2] > zl) { pp[a + 2] = zl; if (pv[a + 2] > 0) pv[a + 2] *= -0.35; }
      if (pp[a + 2] < -zl) { pp[a + 2] = -zl; if (pv[a + 2] < 0) pv[a + 2] *= -0.35; }
      const xh = S.plateX - r * 0.8;
      if (pp[a] > xh) { pp[a] = xh; if (pv[a] > 0) pv[a] *= -0.35; }
      if (pp[a] < xMin + r) { pp[a] = xMin + r; if (pv[a] < 0) pv[a] *= -0.35; }
      const idx = hfIndex(pp[a], pp[a + 2]);
      const ground = P.floorY + hf[idx] + r * 0.75;
      if (pp[a + 1] <= ground && pv[a + 1] < 0) {
        pp[a + 1] = ground;
        if (pv[a + 1] < -3.2 && phop[i] === 0) { // one soft bounce
          phop[i] = 1; pv[a + 1] *= -0.26; pv[a] *= 0.55; pv[a + 2] *= 0.55;
          pw[a] *= 0.5; pw[a + 2] *= 0.5;
          continue;
        }
        // roll down to a clearly lower neighbour cell, else stay
        const ix = Math.floor(idx / HNZ), iz = idx % HNZ;
        let best = -1, bh = hf[idx] - 0.2;
        if (ix > 0 && hf[idx - HNZ] < bh) { best = idx - HNZ; bh = hf[best]; }
        if (ix < HNX - 1 && hf[idx + HNZ] < bh) { best = idx + HNZ; bh = hf[best]; }
        if (iz > 0 && hf[idx - 1] < bh) { best = idx - 1; bh = hf[best]; }
        if (iz < HNZ - 1 && hf[idx + 1] < bh) { best = idx + 1; bh = hf[best]; }
        if (best >= 0 && phop[i] < 3) {
          phop[i]++;
          const cx = HX0 + (Math.floor(best / HNZ) + 0.5) * HCX, cz = -P.inZ + ((best % HNZ) + 0.5) * HCZ;
          pv[a] = (cx - pp[a]) / 0.22; pv[a + 2] = (cz - pp[a + 2]) / 0.22; pv[a + 1] = 1.1;
          continue;
        }
        pst[i] = 3; landedNow++;
        hf[idx] = Math.min(1.5, hf[idx] + r * 1.25);
        pv[a] = pv[a + 1] = pv[a + 2] = 0;
      }
    }
    if (landedNow) { sound('land'); S.bobV -= 0.05 * landedNow; }
  }
  function drawPieces() {
    const im = M.pools[S.pieceKind];
    for (const k in M.pools) if (M.pools[k] !== im) M.pools[k].count = 0;
    let c = 0;
    const n = S.pieceN;
    // squeeze: flatten along the push direction (world x), bulge up and sideways
    const s = cyc.active && cyc.compT >= 0 ? cyc.squeeze : 1;
    const sx = Math.max(0.3, s), sy = 1 + 0.25 * (1 - s), sz = 1 + 0.15 * (1 - s);
    for (let i = 0; i < n; i++) {
      if (pst[i] < 2) continue;
      const a = i * 3, k = psize[i];
      m4.makeRotationFromEuler(eul.set(pr[a], pr[a + 1], pr[a + 2]));
      const e = m4.elements;
      e[0] *= sx * k; e[4] *= sx * k; e[8] *= sx * k;
      e[1] *= sy * k; e[5] *= sy * k; e[9] *= sy * k;
      e[2] *= sz * k; e[6] *= sz * k; e[10] *= sz * k;
      e[12] = pp[a]; e[13] = pp[a + 1]; e[14] = pp[a + 2];
      im.setMatrixAt(c, m4);
      im.setColorAt(c, col.setRGB(pcol[a], pcol[a + 1], pcol[a + 2]));
      c++;
    }
    im.count = c;
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  }

  // ---------------- load cycle ----------------
  const TL = { reach: 0.55, close0: 0.55, close1: 0.74, grab: 0.7, lift0: 0.82, lift1: 2.55, shake1: 3.4, ret1: 4.8, rel0: 4.9, release: 5.0, rel1: 5.08, stow0: 5.1, stow1: 5.7 };

  function startLoad(b) {
    root.updateWorldMatrix(true, false);
    b.root.updateWorldMatrix(true, false);
    v1.setFromMatrixPosition(b.root.matrixWorld);
    root.worldToLocal(v1);
    cyc.active = true; cyc.bin = b; cyc.parent = b.root.parent; cyc.t = 0;
    cyc.grabbed = cyc.released = cyc.emptied = false;
    cyc.origPos.copy(b.root.position);
    cyc.gz = clamp(v1.z - P.seat.z, 1.45, 2.0); cyc.gy = P.seat.y + clamp(v1.y, 0, 0.3);
    cyc.pourT = -1; cyc.lidV = 0; cyc.lidSnd = false; cyc.lastBeta = 0; cyc.lastBetaV = 0; cyc.squash = 0;
    cyc.compT = -1; cyc.compDone = false; cyc.armDone = false; cyc.snd = 0; cyc.squeeze = 1; cyc.hold = 0; cyc.landedAll = false;
    setPath(cyc.gz, cyc.gy);
    preparePieces(b);
    col.set((b.load && b.load.layerColor) != null ? b.load.layerColor : 0xcccccc);
    const k = S.loads;
    layCol[k * 3] = col.r; layCol[k * 3 + 1] = col.g; layCol[k * 3 + 2] = col.b;
    S.state = 'loading';
    S.bobV -= 0.25; S.wave = 0; S.waveAmp = 0;
    sound('hydraulic', { dur: 0.6 });
    emit('loadStart', { binId: b.id });
  }

  function returnBin() {
    const b = cyc.bin;
    if (!b || !cyc.grabbed || cyc.released) return;
    cyc.released = true;
    b.lid.rotation.x = 0;
    if (cyc.parent) cyc.parent.attach(b.root); else root.parent && root.parent.attach(b.root);
    b.root.position.copy(cyc.origPos);
    b.root.rotation.set(0, 0, 0);
    b.root.scale.set(1, 1, 1);
    emit('binReleased', { binId: b.id });
  }

  function stepLoad(dt) {
    const b = cyc.bin;
    cyc.t += dt;
    const t = cyc.t;
    // ---- arm keyframes ----
    if (t < TL.lift0) {
      const k = easeOut3(t / TL.reach); // moves at once: the hand-response
      S.wz = lerp(P.stow.z, cyc.gz, k); S.wy = lerp(P.stow.y, cyc.gy, k); S.beta = 0;
      S.claw = t < TL.close0 ? lerp(-1, 1, easeOut3(t / 0.3)) : 1 - sm(TL.close0, TL.close1, t);
    } else if (t < TL.lift1) {
      const k = (t - TL.lift0) / (TL.lift1 - TL.lift0);
      pathAt(k * k * (3 - 2 * k)); S.claw = 0;
    } else if (t < TL.shake1) {
      // over the hopper: shake the last bits out
      const u = t - TL.lift1, env = Math.exp(-2.0 * u) * (1 - sm(0.7, 0.85, u));
      pathAt(1);
      S.beta += 10 * D2R * env * Math.sin(Math.PI * 2 * 3.3 * u);
      S.wy += 0.06 * env * Math.sin(Math.PI * 2 * 3.3 * u + 1.2);
      S.claw = 0;
    } else if (t < TL.ret1) {
      const k = (t - TL.shake1) / (TL.ret1 - TL.shake1);
      pathAt(1 - k * k * (3 - 2 * k)); S.claw = 0;
    } else if (t < TL.stow0) {
      S.wz = cyc.gz; S.wy = cyc.gy; S.beta = 0;
      S.claw = sm(TL.rel0, TL.rel1, t);
    } else {
      const k = easeIO((t - TL.stow0) / (TL.stow1 - TL.stow0));
      S.wz = lerp(cyc.gz, P.stow.z, k); S.wy = lerp(cyc.gy, P.stow.y, k); S.beta = 0;
      S.claw = lerp(1, -1, sm(0.15, 1, k));
    }
    // ---- sounds on the way ----
    if (cyc.snd === 0 && t >= TL.lift0) { cyc.snd = 1; sound('hydraulic', { dur: 1.7 }); }
    if (cyc.snd === 1 && t >= TL.lift1) { cyc.snd = 2; sound('clank'); S.bobV -= 0.5; }
    if (cyc.snd === 2 && t >= TL.lift1 + 0.3) { cyc.snd = 3; sound('clank'); S.bobV -= 0.3; }
    if (cyc.snd === 3 && t >= TL.shake1) { cyc.snd = 4; sound('hydraulic', { dur: 1.4 }); }
    if (cyc.snd === 4 && t >= TL.ret1) { cyc.snd = 5; sound('thump'); cyc.squash = 1; }
    if (cyc.snd === 5 && t >= TL.stow0) { cyc.snd = 6; sound('hydraulic', { dur: 0.6 }); }
    // ---- grab / release ----
    poseArm();
    if (!cyc.grabbed && t >= TL.grab) {
      cyc.grabbed = true;
      b.root.rotation.set(0, 0, 0); b.root.scale.set(1, 1, 1);
      gripper.attach(b.root);
      cyc.squash = 1;
      S.bobV -= 0.4;
      sound('grab');
      emit('binGrabbed', { binId: b.id });
    }
    if (cyc.grabbed && !cyc.released) {
      // squeeze-pulse of the bin when the claws bite / when it lands back on the ground
      cyc.squash = Math.max(0, cyc.squash - dt * 5);
      const q = cyc.squash * cyc.squash, landing = t >= TL.ret1;
      b.root.scale.x = landing ? 1 + 0.05 * q : 1 - 0.07 * q;
      b.root.scale.y = landing ? 1 - 0.07 * q : 1 + 0.05 * q;
      stepLid(dt, b);
      if (t >= TL.release) returnBin();
    }
    if (!cyc.armDone && t >= TL.stow1) { cyc.armDone = true; S.wz = P.stow.z; S.wy = P.stow.y; S.claw = -1; }
  }

  /** the lid hangs on its hinge: θ'' = k·cos θ (gravity) − damping, limited to the bin's stops */
  function stepLid(dt, b) {
    const bv = dt > 1e-5 ? (S.beta - cyc.lastBeta) / dt : 0;
    const ba = dt > 1e-5 ? clamp((bv - cyc.lastBetaV) / dt, -60, 60) : 0;
    cyc.lastBeta = S.beta; cyc.lastBetaV = bv;
    let r = b.lid.rotation.x;
    const theta = -S.beta + r;
    cyc.lidV += (13 * Math.cos(theta) + ba * 0.6 - 3.2 * cyc.lidV) * dt;
    r += cyc.lidV * dt;
    if (r > 0) { r = 0; if (cyc.lidV > 0) cyc.lidV *= -0.3; }
    // the stop: fully open (1.9 rad) while the bin is over, pushed shut again as the bin comes back upright
    const stop = -1.9 * sm(12 * D2R, 95 * D2R, S.beta);
    if (r < stop) { r = stop; if (cyc.lidV < 0) cyc.lidV *= -0.35; }
    b.lid.rotation.x = finite(r, 0);
    if (!cyc.lidSnd && r < -0.35) { cyc.lidSnd = true; sound('lid'); }
  }

  /** runs after the world matrices are fresh: pieces leave the bin's mouth and fall into the hopper */
  function stepPour(dt) {
    const b = cyc.bin, t = cyc.t, n = S.pieceN;
    if (cyc.pourT < 0 && cyc.grabbed && !cyc.released && S.beta >= 100 * D2R) {
      cyc.pourT = 0;
      if (b.contents) b.contents.visible = false;
      sound('pour', { count: n });
    }
    if (cyc.pourT >= 0 && !cyc.emptied) {
      cyc.pourT += dt;
      let waiting = 0;
      for (let i = 0; i < n; i++) {
        if (pst[i] !== 1) continue;
        if (cyc.pourT >= prel[i] && !cyc.released) releasePiece(i, b); else waiting++;
      }
      if (waiting === 0 || cyc.released) {
        for (let i = 0; i < n; i++) if (pst[i] === 1) pst[i] = 0;
        cyc.emptied = true;
        emit('binEmptied', { binId: b.id });
      }
    }
    stepPieces(dt);
    if (cyc.emptied && !cyc.landedAll) {
      let fly = 0;
      for (let i = 0; i < n; i++) if (pst[i] === 2) fly++;
      if (fly === 0) cyc.landedAll = true;
    }
  }

  /** packer: push the heap along the floor, squeeze it against the stack, turn it into one layer */
  function stepPacker(dt) {
    const t = cyc.t, n = S.pieceN;
    if (cyc.compT < 0 && cyc.landedAll && t >= TL.shake1) {
      cyc.compT = 0;
      S.state = 'compacting';
      let far = 0.3;
      for (let i = 0; i < n; i++) {
        if (pst[i] !== 3) continue;
        pd0[i] = Math.max(prad[i] * 0.8, S.plateX - pp[i * 3]);
        py0[i] = pp[i * 3 + 1];
        if (pd0[i] + prad[i] > far) far = pd0[i] + prad[i];
      }
      cyc.lp0 = far;
      S.plateT = 1; // take the plate over from any background move
      cyc.plate0 = S.plateX;
      sound('squeeze', { dur: 1.5 });
    }
    if (cyc.compT >= 0 && !cyc.compDone) {
      cyc.compT += dt;
      const DUR = 1.5, HOLD = 0.3;
      const p = clamp(cyc.compT / DUR, 0, 1);
      const e = Math.pow(Math.sin((p * Math.PI) / 2), 1.35); // strong start, grinding finish
      S.pressure = sm(0.72, 1, p);
      const xStack = stackFront(S.loads);
      const xEnd = xStack + P.tau * 0.62;
      let xp = lerp(cyc.plate0, xEnd, e);
      if (p >= 1) { cyc.hold += dt; xp += 0.012 * Math.sin(cyc.hold * 70); S.shudder = 1; }
      const speed = dt > 1e-5 ? (S.plateX - xp) / dt : 0;
      S.plateX = xp;
      const lp = cyc.lp0 * (1 + 0.3 * sm(0, 0.5, p));
      const s = clamp((xp - xStack) / lp, 0.2, 1);
      cyc.squeeze = s;
      const grow = 1 + 0.6 * (1 / s - 1), topY = P.bodyTop - 0.55; // stay under the roof
      for (let i = 0; i < n; i++) {
        if (pst[i] !== 3) continue;
        const a = i * 3, d = pd0[i] * (lp / cyc.lp0) * s;
        const x = Math.max(xStack + prad[i] * s * 0.6, xp - d);
        if (x < pp[a]) {
          pp[a] = x;
          if (s > 0.99) { pr[a + 2] += (speed / Math.max(0.08, prad[i])) * dt * 0.45; pr[a] += speed * dt * (plift[i] - 0.5); }
        }
        const y = P.floorY + (py0[i] - P.floorY) * grow + plift[i] * (1 - s) * 1.5 + (s > 0.99 ? 0.03 * Math.abs(Math.sin(cyc.compT * 17 + i)) * clamp(speed, 0, 1) : 0);
        pp[a + 1] = Math.min(topY - plift[i] * 0.25, y);
      }
      if (cyc.hold >= HOLD) {
        // the squeezed heap becomes one layer (it springs back a little when the plate lets go)
        const k = S.loads;
        layTh[k] = clamp(xp - xStack, P.tau * 0.5, P.tau); layV[k] = 0;
        S.loads = k + 1;
        clearPieces();
        cyc.compDone = true;
        S.pressure = 0; S.shudder = 0; S.bobV += 0.6;
        const full = S.loads >= capacity;
        movePlate(full ? P.rearIn + 0.02 + capacity * P.tau + 0.015 : P.plateHome, full ? 0.5 : 1.0);
        sound('clank');
        sound('hydraulic', { dur: full ? 0.5 : 1.0 });
        emit('compacted', { fill: S.loads / capacity, loads: S.loads });
      }
    }
    if (cyc.compDone && cyc.armDone && cyc.released) {
      cyc.active = false; cyc.bin = null;
      if (S.loads >= capacity) { S.state = 'full'; emit('full'); } else { S.state = 'idle'; emit('ready'); }
    }
  }

  // ---------------- dump ----------------
  function clearChunks() { S.chunkN = 0; cst.fill(0); pile.fill(0); M.chunks.count = 0; }
  function pileIndex(x, z) {
    const ix = clamp(Math.floor((x + P.pileR + 0.05) / PC), 0, PN - 1), iz = clamp(Math.floor((z + P.pileR + 0.05) / PC), 0, PN - 1);
    return ix * PN + iz;
  }
  function spawnChunk(k, big) {
    if (S.chunkN >= CN) return;
    const i = S.chunkN++, a = i * 3;
    const size = big ? 1.0 + rnd() * 0.4 : 0.36 + rnd() * 0.24;
    const rad = 0.3 * size;
    // start: somewhere on the layer's cross-section at the lip (body frame → root frame)
    const h = clamp(P.layerH * Math.sqrt(P.tau / Math.max(0.05, layTh[k])), 1.2, P.layerMaxH);
    v1.set(P.rearIn - 0.12, P.floorY + 0.15 + rnd() * (h - 0.3), (rnd() - 0.5) * 2 * (P.inZ - 0.3)).applyMatrix4(body.matrixWorld).applyMatrix4(rootInv);
    cp[a] = v1.x; cp[a + 1] = v1.y; cp[a + 2] = v1.z;
    // landing spot: of a few tries, the one that is furthest below a cone-shaped heap
    let bx = 0, bz = 0, best = -99;
    for (let tr = 0; tr < 3; tr++) {
      const r = P.pileR * 0.95 * Math.pow(rnd(), 0.7) * (big ? 0.8 : 1), an = rnd() * Math.PI * 2;
      const x = Math.cos(an) * r, z = Math.sin(an) * r * 0.92;
      const lack = P.pileH * (1 - Math.pow(r / P.pileR, 1.6)) - pile[pileIndex(x, z)];
      if (lack > best) { best = lack; bx = x; bz = z; }
    }
    const idx = pileIndex(bx, bz), ix = Math.floor(idx / PN), iz = idx % PN;
    const y = Math.min(P.pileH - rad, pile[idx] + rad * 0.6);
    const hNew = Math.min(P.pileH - 0.05, pile[idx] + rad * 0.95), hSide = hNew - rad * 0.55;
    pile[idx] = hNew;
    if (ix > 0 && pile[idx - PN] < hSide) pile[idx - PN] = hSide;
    if (ix < PN - 1 && pile[idx + PN] < hSide) pile[idx + PN] = hSide;
    if (iz > 0 && pile[idx - 1] < hSide) pile[idx - 1] = hSide;
    if (iz < PN - 1 && pile[idx + 1] < hSide) pile[idx + 1] = hSide;
    ct[a] = dumpSpot.x + bx; ct[a + 1] = P.pileBaseY + y; ct[a + 2] = dumpSpot.z + bz;
    const Tf = 0.45 + rnd() * 0.3;
    cdur[i] = Tf; ctime[i] = 0; cst[i] = 1;
    cv[a] = (ct[a] - cp[a]) / Tf; cv[a + 2] = (ct[a + 2] - cp[a + 2]) / Tf;
    cv[a + 1] = (ct[a + 1] - cp[a + 1] - 0.5 * G * Tf * Tf) / Tf;
    cs[a] = size * (0.85 + rnd() * 0.4); cs[a + 1] = size * (0.75 + rnd() * 0.35); cs[a + 2] = size * (0.85 + rnd() * 0.4);
    cr[a] = rnd() * 6; cr[a + 1] = rnd() * 6; cr[a + 2] = rnd() * 6;
    cspin[i] = (rnd() - 0.5) * 14;
    if (big) { // layer colour, lifted toward white so the photo still reads
      ccol[a] = lerp(layCol[k * 3], 1, 0.3); ccol[a + 1] = lerp(layCol[k * 3 + 1], 1, 0.3); ccol[a + 2] = lerp(layCol[k * 3 + 2], 1, 0.3);
    } else {
      const j = Math.floor(rnd() * 4) % 4;
      ccol[a] = layBits[k * 12 + j * 3]; ccol[a + 1] = layBits[k * 12 + j * 3 + 1]; ccol[a + 2] = layBits[k * 12 + j * 3 + 2];
    }
  }
  function stepChunks(dt) {
    const n = S.chunkN;
    let flying = 0;
    for (let i = 0; i < n; i++) {
      const a = i * 3;
      if (cst[i] === 1) {
        ctime[i] += dt;
        if (ctime[i] >= cdur[i]) {
          cst[i] = 2; ctime[i] = 0;
          cp[a] = ct[a]; cp[a + 1] = ct[a + 1]; cp[a + 2] = ct[a + 2];
          if (!dmp.landed) { dmp.landed = true; sound('dumpThud'); emit('dumpLanded', { pointLocal: evPoint.copy(dumpSpot) }); }
          else sound('land');
        } else {
          flying++;
          cv[a + 1] += G * dt;
          cp[a] += cv[a] * dt; cp[a + 1] += cv[a + 1] * dt; cp[a + 2] += cv[a + 2] * dt;
          cr[a] += cspin[i] * dt; cr[a + 2] += cspin[i] * 0.6 * dt;
        }
      } else if (cst[i] === 2 && ctime[i] < 1) ctime[i] += dt * 4; // landing squash 0 → 1
      const q = cst[i] === 2 ? Math.min(1, ctime[i]) : 1;
      const sq = cst[i] === 2 ? 1 - 0.3 * Math.sin(Math.PI * q) * (1 - q) : 1;
      q4.setFromEuler(eul.set(cr[a], cr[a + 1], cr[a + 2]));
      m4.compose(v1.set(cp[a], cp[a + 1] - (1 - sq) * 0.1, cp[a + 2]), q4, s4.set(cs[a], cs[a + 1] * sq, cs[a + 2]));
      M.chunks.setMatrixAt(i, m4);
      M.chunks.setColorAt(i, col.setRGB(ccol[a], ccol[a + 1], ccol[a + 2]));
    }
    M.chunks.count = n;
    if (n) { M.chunks.instanceMatrix.needsUpdate = true; M.chunks.instanceColor.needsUpdate = true; }
    return flying;
  }

  function stepDump(dt) {
    dmp.t += dt;
    const t = dmp.t, UP = 1.6, DOWN = 1.3;
    // hoist: up, a couple of shakes once the load has left, down
    let k = easeIO(t / UP);
    if (dmp.outT >= 0) {
      const u = t - dmp.outT;
      if (u < 0.6) k -= 0.05 * Math.sin(Math.PI * 2 * 3.3 * u) * Math.sin((Math.PI * u) / 0.6);
    }
    if (dmp.downT >= 0) k *= 1 - easeIO((t - dmp.downT) / DOWN);
    S.gateSway = 0.07 * Math.sin(t * 5.5) * Math.exp(-0.5 * t);
    setHoist(P.hoistMax * clamp(k, 0, 1));
    if (dmp.snd === 0 && t > 0.2) { dmp.snd = 1; sound('clank'); }
    // the stack slides on the tilted floor: sticks until tan φ > μs, then a = g(sin φ − μk cos φ)
    const phi = S.phi;
    if (!dmp.moving && Math.tan(phi) > 0.5 && dmp.outT < 0) { dmp.moving = true; sound('dumpPour', { dur: 1.5 }); S.bobV += 0.5; }
    if (dmp.moving) {
      const acc = 9.8 * (Math.sin(phi) - 0.42 * Math.cos(phi));
      dmp.slideV = Math.max(0, dmp.slideV + acc * dt);
      dmp.slide += dmp.slideV * dt;
      // whatever has passed the lip breaks off as chunks
      const lip = P.rearIn - 0.02, per = P.chunkBig + P.chunkSmall;
      let x = P.rearIn + 0.02 - dmp.slide, allOut = true;
      for (let j = 0; j < S.loads; j++) {
        const th = layTh[j], gone = clamp((lip - x) / Math.max(0.05, th), 0, 1);
        while (laySpawn[j] < per && gone >= (laySpawn[j] + 0.5) / per) { const c = laySpawn[j]++; spawnChunk(j, Math.floor(((c + 1) * P.chunkBig) / per) > Math.floor((c * P.chunkBig) / per)); }
        if (gone < 1) allOut = false;
        x += th;
      }
      if (allOut) { dmp.moving = false; dmp.outT = t; S.bobV += 1.2; sound('clank'); }
    }
    const flying = stepChunks(dt);
    if (dmp.outT >= 0 && dmp.downT < 0 && t >= Math.max(dmp.outT + 0.7, UP + 0.6)) { dmp.downT = t; sound('hydraulic', { dur: DOWN }); }
    if (dmp.downT >= 0 && t >= dmp.downT + DOWN && flying === 0) {
      S.gateSway = 0;
      setHoist(0);
      dmp.active = false;
      S.loads = 0; layTh.fill(0); layV.fill(0);
      S.state = 'idle';
      S.bobV -= 0.5;
      sound('clank');
      emit('dumpDone');
      emit('ready');
    }
  }

  // ---------------- wheels ----------------
  function drawWheels() {
    let i = 0;
    q4.setFromAxisAngle(v2.set(0, 0, 1), S.wheelA);
    for (let a = 0; a < P.wheelXs.length; a++) for (let s = -1; s <= 1; s += 2) {
      m4.compose(v1.set(P.wheelXs[a], P.wheelR, s * P.wheelZ), q4, s4.set(1, 1, 1));
      M.wheels.setMatrixAt(i++, m4);
    }
    M.wheels.instanceMatrix.needsUpdate = true;
  }

  // ---------------- per-frame ----------------
  function update(dt, input) {
    dt = clamp(finite(dt, 0), 0, 0.1);
    input = input || {};
    S.time += dt;
    if (S.readyPending) { S.readyPending = false; emit('ready'); }
    const drive = finite(input.drive, 0), att = clamp(finite(input.attention, 0), 0, 1);

    // wheels roll with the shell's drive speed; the sprung mass pitches on acceleration
    S.wheelA -= (drive / P.wheelR) * dt;
    if (S.wheelA > 1e4 || S.wheelA < -1e4) S.wheelA = 0;
    const acc = dt > 1e-5 ? clamp((drive - S.lastDrive) / dt, -12, 12) : 0;
    S.lastDrive = drive;
    S.pitchV += (-90 * (S.pitch - acc * 0.0022) - 9 * S.pitchV) * dt;
    S.pitch = clamp(S.pitch + S.pitchV * dt, -0.05, 0.05);
    S.bobV += (-130 * S.bob - 10 * S.bobV) * dt;
    S.bob = clamp(S.bob + S.bobV * dt, -0.12, 0.12);

    // the arm
    if (cyc.active) { stepLoad(dt); stepPacker(dt); }
    else {
      // resting: claws folded; a little "come on" flex now and then, a wave when poked
      S.idleT += dt;
      if (S.wave > 0) S.wave = Math.max(0, S.wave - dt * 2.2);
      const canLoad = S.state === 'idle' && S.loads < capacity && !dmp.active;
      const flex = canLoad && S.idleT > 2.5 ? Math.max(0, Math.sin((S.idleT - 2.5) * 2.0)) ** 6 * 0.3 : 0;
      S.wz = P.stow.z + 0.05 * flex; S.wy = P.stow.y; S.beta = 0;
      S.claw = -1 + flex + S.waveAmp * Math.sin(Math.PI * (1 - S.wave)) * (S.wave > 0 ? 1 : 0);
      poseArm();
    }
    // background plate move (returning home after a squeeze, parking against a full stack)
    if (S.plateT < 1 && !(cyc.active && cyc.compT >= 0 && !cyc.compDone)) {
      S.plateT = Math.min(1, S.plateT + dt / S.plateDur);
      S.plateX = lerp(S.plateFrom, S.plateTo, easeIO(S.plateT));
    }
    stepLayers(dt);
    plate.position.x = S.plateX;
    if (dmp.active) stepDump(dt);

    // suspension: bob (pokes, landings, attention hop), pitch, roll when the bin hangs out on the arm
    const hop = att * Math.abs(Math.sin(S.time * 5.2)) * 0.07;
    const shud = S.shudder > 0 ? 0.006 * Math.sin(S.time * 90) : 0;
    const rollT = cyc.active && cyc.grabbed && !cyc.released ? 0.014 * sm(0.9, 2.2, S.wy) : 0;
    S.roll += (rollT - S.roll) * Math.min(1, dt * 6);
    sprung.position.y = S.bob + hop + shud;
    sprung.rotation.z = S.pitch + att * 0.012 * Math.sin(S.time * 5.2);
    sprung.rotation.x = S.roll;

    // world matrices are needed for pin-to-pin cylinders, lamps and for the bin's mouth
    root.updateWorldMatrix(false, true);
    rootInv.copy(root.matrixWorld).invert();
    bodyInv.copy(body.matrixWorld).invert();
    if (cyc.active) stepPour(dt);
    if (S.pieceN > 0) drawPieces();
    drawLayers();
    drawWheels();
    drawCylinders();

    // lamps: green + pulsing pads = "ready, bring a bin"; amber = working; pink bouncing = "tap me to go"
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 4);
    const canLoad = S.state === 'idle' && S.loads < capacity && !cyc.active && !dmp.active;
    const beat = 0.5 + 0.5 * Math.sin(S.time * (att > 0 ? 10.4 : 7));
    const soft = 0.5 + 0.5 * Math.sin(S.time * 4.2);
    if (att > 0) setLamp(0, 0xff5aa0, 0.75 + 0.5 * beat, 1 + 0.55 * beat);
    else if (canLoad) setLamp(0, 0x5dff8a, 0.85 + 0.15 * soft, 1 + 0.06 * soft);
    else setLamp(0, 0xffc23c, 0.55 + 0.6 * beat, 1 + 0.1 * beat);
    if (S.flash > 0) { col.setHex(0xffffff).multiplyScalar(1.2); M.lamps.setColorAt(0, col); lampScale[0] = 1 + 0.5 * S.flash; }
    const padK = canLoad ? 0.75 + 0.45 * soft : 0.5;
    setLamp(1, canLoad ? 0xff8fc6 : 0x9a6a80, padK, canLoad ? 1 + 0.4 * soft : 1);
    setLamp(2, canLoad ? 0xff8fc6 : 0x9a6a80, padK, canLoad ? 1 + 0.4 * soft : 1);
    const head = 0.9 + 0.5 * S.flash + (att > 0 ? 0.3 * beat : 0);
    setLamp(3, 0xfff3c0, head, 1 + 0.25 * S.flash); setLamp(4, 0xfff3c0, head, 1 + 0.25 * S.flash);
    const blinkOn = att > 0 || Math.abs(drive) > 0.05 ? (Math.sin(S.time * 12) > 0 ? 1.25 : 0.35) : 0.6;
    setLamp(5, 0xffa51f, blinkOn, att > 0 ? 1.3 : 1);
    const tail = dmp.active ? (Math.sin(S.time * 14) > 0 ? 1.3 : 0.45) : 0.8;
    setLamp(6, 0xff4a4a, tail, 1); setLamp(7, 0xff4a4a, tail, 1);
    drawLamps();
  }

  function reset() {
    if (cyc.active) returnBin();
    cyc.active = false; cyc.bin = null; cyc.compT = -1; cyc.compDone = false;
    dmp.active = false;
    S.loads = 0; layTh.fill(0); layV.fill(0); laySpawn.fill(0);
    clearPieces(); clearChunks();
    S.wz = P.stow.z; S.wy = P.stow.y; S.beta = 0; S.claw = -1;
    S.plateX = P.plateHome; S.plateT = 1; S.pressure = 0; S.shudder = 0; S.gateSway = 0;
    S.wave = 0; S.idleT = 0;
    plate.position.x = S.plateX;
    setHoist(0);
    poseArm();
    M.layers.count = 0;
    S.state = 'idle'; S.readyPending = true;
  }

  // ---------------- first pose ----------------
  poseArm(); setHoist(0); drawWheels();
  root.updateWorldMatrix(false, true);
  rootInv.copy(root.matrixWorld).invert();
  bodyInv.copy(body.matrixWorld).invert();
  drawCylinders();
  for (let i = 0; i < M.lampDefs.length; i++) setLamp(i, 0xffffff, 1, 1);
  drawLamps();

  return {
    root,
    dims: { length: P.frontX - P.rearX, width: P.halfW * 2, height: P.height, frontX: P.frontX, rearX: P.rearX, binSpot, dumpSpot },
    params: P,
    hitTargets: [{ name: 'truck', object: M.hit }],
    update,
    loadBin(b) {
      if (S.state !== 'idle' || cyc.active || dmp.active || S.loads >= capacity || !b || !b.root || !b.lid) return false;
      startLoad(b);
      return true;
    },
    dump() {
      if (cyc.active || dmp.active || S.loads <= 0) return false;
      dmp.active = true; dmp.t = 0; dmp.slide = 0; dmp.slideV = 0; dmp.moving = false; dmp.outT = -1; dmp.downT = -1; dmp.landed = false; dmp.snd = 0;
      laySpawn.fill(0);
      clearChunks();
      S.state = 'dumping';
      movePlate(P.plateHome, 0.9);
      S.bobV -= 0.3;
      sound('hydraulic', { dur: 1.5 });
      emit('dumpStart');
      return true;
    },
    clearDump() { clearChunks(); },
    poke() {
      // answer at once: the whole truck dips, the lamps flash, the claws wave if they are free
      S.bobV -= 1.5; S.flash = 1;
      if (!cyc.active) { S.wave = 1; S.waveAmp = 0.9; S.idleT = 0; }
    },
    getStatus() {
      return {
        state: S.state,
        canLoad: S.state === 'idle' && S.loads < capacity && !cyc.active && !dmp.active,
        fill: S.loads / capacity, loads: S.loads,
        busy: cyc.active || dmp.active || S.plateT < 1,
      };
    },
    reset,
    onContextRestored() { atlas.needsUpdate = true; },
    dispose() {
      if (cyc.active) returnBin();
      root.removeFromParent();
      for (const g of geos) g.dispose();
      for (const im of M.instanced) im.dispose();
      for (const k in mats) if (k !== 'layer') mats[k].dispose();
      atlas.dispose();
    },
  };
}
