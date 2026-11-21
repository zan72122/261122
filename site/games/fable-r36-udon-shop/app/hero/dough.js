// 生地：1枚の格子メッシュの頂点変形（押す・引っ張る・めん棒）と、切ったあとの「切り身」メッシュ。
//
// 切る前（mode 'dough'）  … 格子の頂点が材料といっしょに動く（ラグランジュ格子）。
//   位置 = PX,PZ（残った形）＋ 今の引っ張り（ガウス形の重み × 指の動き）、高さ = TH × F − へこみ。
// 切ったあと（mode 'slab'）… 形を凍らせ、格子の各行を「切れ目の x」で分け直した別メッシュにする。
//   切れ目は本当に割れていて（断面の壁つき）、切り身ごとに横へ開く・つぶれて弾む・跳ねる。
//
// 座標は生地ローカル（原点＝生地の初期中心・まな板上面）。group がワールドへ置く。

import { clamp, lerp, smooth, easeOutBack, hash, softHi, softLo, spring } from './math.js';

export function createDough(THREE, Q, P, LY, material, MAXN) {
  const NX = Q.nx, NZ = Q.nz, NT = NX * NZ;
  const PD = P.dough, PP = P.pull, PE = P.dent, PC = P.cut;
  const OX = LY.doughStart.center.x, OY = LY.board.center.y, OZ = LY.doughStart.center.z;
  const bd = LY.board;
  const LX0 = bd.center.x - bd.sizeX / 2 + PD.boardMargin - OX, LX1 = bd.center.x + bd.sizeX / 2 - PD.boardMargin - OX;
  const LZ0 = bd.center.z - bd.sizeZ / 2 + PD.boardMargin - OZ, LZ1 = bd.center.z + bd.sizeZ / 2 - PD.boardMargin - OZ;
  const SOFT = PD.boardSoft, BASE_H = 0.012, BASE_AO = PD.baseShade;

  const group = new THREE.Group(); group.name = 'hero-dough';

  // ================= 切る前の格子 =================
  const pos = new Float32Array(NT * 3), nor = new Float32Array(NT * 3), col = new Float32Array(NT * 3), uv = new Float32Array(NT * 2);
  const PX = new Float32Array(NT), PZ = new Float32Array(NT), TH = new Float32Array(NT);
  const F = new Float32Array(NT), DN = new Float32Array(NT), DR = new Float32Array(NT), R2 = new Float32Array(NT);
  const geo = new THREE.BufferGeometry();
  {
    const idx = new Uint16Array((NX - 1) * (NZ - 1) * 6);
    let o = 0;
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  group.add(mesh);
  const TRIS = (NX - 1) * (NZ - 1) * 2;

  // 外周の頂点（ぐるり一周）
  const loop = [];
  for (let i = 0; i < NX; i++) loop.push(i);
  for (let j = 1; j < NZ; j++) loop.push(j * NX + NX - 1);
  for (let i = NX - 2; i >= 0; i--) loop.push((NZ - 1) * NX + i);
  for (let j = NZ - 2; j >= 1; j--) loop.push(j * NX);

  // ---- 状態 ----
  let mode = 'dough';
  let thick0 = 0.035;
  let pull = null;       // { active, gx, gz, sx, sz, dx, dz, t, moved, amount }
  let dent = null;       // { t, a, depth, hold, released }
  let recT = 0;          // へこみが少し戻る残り時間
  let dirty = true;
  let rollAcc = 0, rollSign = 0, rollRide = 0, rollIdle = 9;
  const jel = { x: 0, v: 0 };
  let dropT = 1, dropY = 0, landedKick = false;
  const st = { x0: 0, x1: 0, z0: 0, z1: 0, maxH: 0.03, sumH: 1, cx: 0, cz: 0 };   // ローカルの外接と重心
  const WJ = 2 * Math.PI / PD.jelly.period;
  const grabPos = new THREE.Vector3();
  const bounds = { x0: 0, x1: 0, z0: 0, z1: 0, h: 0.03 };   // ワールド

  const map1 = (t) => Math.sin((t - 0.5) * Math.PI * PD.edgeBias) / Math.sin(Math.PI * PD.edgeBias / 2);

  function reset(seed) {
    const ds = LY.doughStart;
    const rnd = (k) => hash((seed || 0) * 7.13 + k * 1.37);
    const SX = ds.sizeX / 2 * (1 + (rnd(1) - 0.5) * PD.sizeJitter), SZ = ds.sizeZ / 2 * (1 + (rnd(2) - 0.5) * PD.sizeJitter);
    const ph2 = rnd(3) * 6.2832, ph3 = rnd(4) * 6.2832, b2 = PD.blob[0] * (0.4 + rnd(5)), b3 = PD.blob[1] * (0.4 + rnd(6));
    thick0 = ds.thickness;
    const sw = PD.edgeRound * 1.8, rmin = Math.min(SX, SZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const n = j * NX + i;
      const ax = map1(i / (NX - 1)), az = map1(j / (NZ - 1));
      const ux = ax * Math.sqrt(Math.max(0, 1 - az * az / 2)), uz = az * Math.sqrt(Math.max(0, 1 - ax * ax / 2));
      const r = Math.min(1, Math.hypot(ux, uz)), th = Math.atan2(uz, ux);
      const m = 1 + b2 * Math.sin(2 * th + ph2) + b3 * Math.sin(3 * th + ph3);
      const edge = i === 0 || j === 0 || i === NX - 1 || j === NZ - 1;
      const e = edge ? 0 : Math.min((1 - r) * rmin * m / sw, 1);
      PX[n] = ux * SX * m; PZ[n] = uz * SZ * m;
      TH[n] = thick0 * (1 - PD.mound * r * r) * Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)));
      F[n] = 1; DN[n] = 0; DR[n] = 0; R2[n] = 1;
      uv[n * 2] = PX[n] / PD.texScale + 0.5; uv[n * 2 + 1] = PZ[n] / PD.texScale + 0.5;
    }
    geo.attributes.uv.needsUpdate = true;
    pull = null; dent = null; recT = 0; rollAcc = 0; rollSign = 0; rollIdle = 9;
    cuts.length = 0; frozen = false;
    mode = 'dough'; mesh.visible = true; slabMesh.visible = false;
    jel.x = 0.1; jel.v = 0; dropT = 0; landedKick = false;
    write(false);
    place();
  }

  const pullFactor = (pl) => (pl.active ? 1 : PP.keep + (1 - PP.keep) * Math.exp(-pl.t / PP.decay) * Math.cos(2 * Math.PI * pl.t / PP.period));

  // 今の形を頂点へ書く。commit=true なら引っ張りの結果を「残った形」に取り込む
  function write(commit) {
    const pl = pull, de = dent;
    let hasPull = false, dxE = 0, dzE = 0, inv2s = 0, thinK = 0, neckK = 0, ux = 0, uz = 0, pinchK = 0, gx = 0, gz = 0;
    if (pl) {
      const Dm = Math.hypot(pl.dx, pl.dz);
      if (Dm > 1e-6) {
        const f = pullFactor(pl), sig = PP.falloff + PP.widen * Dm;
        hasPull = true; inv2s = 1 / (2 * sig * sig);
        dxE = pl.dx * f; dzE = pl.dz * f;
        thinK = PP.thin * (Dm / sig) * f; neckK = PP.neck * Math.min(1, Dm / 0.1) * f;
        ux = pl.dx / Dm; uz = pl.dz / Dm; gx = pl.gx; gz = pl.gz;
        pinchK = PP.pinch * smooth(Dm / 0.03) * (pl.active ? 1 : clamp((f - PP.keep) / (1 - PP.keep), 0, 1));
      }
    }
    const dl = de ? de.depth * de.a : 0;
    const sd = PE.radius * 0.5, invD = 1 / (2 * sd * sd), invD2 = invD / (2.2 * 2.2), bul = PE.bulge;
    const invPinch = 1 / (2 * 0.016 * 0.016);
    const shade = PD.dentShade / PE.depthMax, minF = PD.minFactor;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, maxH = 0, sumH = 0, sx = 0, sz = 0;
    for (let n = 0; n < NT; n++) {
      let x = PX[n], z = PZ[n], f = F[n], lift = 0;
      const r2 = R2[n];
      if (hasPull) {
        const w = Math.exp(-r2 * inv2s), g = 4 * w * (1 - w);
        const q = -(x - gx) * uz + (z - gz) * ux, c = neckK * g * q;   // 引く向きに直角な成分を寄せる（細くなる）
        x += uz * c + dxE * w; z += -ux * c + dzE * w;
        const tf = 1 / (1 + thinK * g);
        if (commit) F[n] = f * tf;
        f *= tf;
        lift = pinchK * Math.exp(-r2 * invPinch);
      }
      x = softLo(softHi(x, LX1, SOFT), LX0, SOFT); z = softLo(softHi(z, LZ1, SOFT), LZ0, SOFT);
      if (commit) { PX[n] = x; PZ[n] = z; }
      const th = TH[n];
      let dsum = DN[n] + DR[n];
      if (dl !== 0) dsum += dl * ((1 + bul) * Math.exp(-r2 * invD) - bul * Math.exp(-r2 * invD2));
      let y = th * f - dsum; const ymin = th * minF;
      if (y < ymin) y = ymin;
      y += lift * (th > 0 ? 1 : 0);
      const o = n * 3;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      const c = (1 - clamp(dsum * shade, -0.04, 0.4)) * (y < BASE_H ? 1 - BASE_AO * (1 - y / BASE_H) * (1 - y / BASE_H) : 1);   // へこみと、板に接する根元を少し暗く
      col[o] = c; col[o + 1] = c * (0.985 + 0.015 * c); col[o + 2] = c * (0.96 + 0.04 * c);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (y > maxH) maxH = y; sumH += y; sx += x * y; sz += z * y;
    }
    if (commit && pl) pull = null;
    st.x0 = x0; st.x1 = x1; st.z0 = z0; st.z1 = z1; st.maxH = Math.max(maxH, 0.004); st.sumH = Math.max(sumH, 1e-6);
    st.cx = sx / st.sumH; st.cz = sz / st.sumH;
    // 法線：格子の差分（中心差分。端は片側）
    for (let j = 0; j < NZ; j++) {
      const jd = (j > 0 ? j - 1 : j) * NX, ju = (j < NZ - 1 ? j + 1 : j) * NX;
      for (let i = 0; i < NX; i++) {
        const il = i > 0 ? i - 1 : i, ir = i < NX - 1 ? i + 1 : i;
        const a = (j * NX + il) * 3, b = (j * NX + ir) * 3, c = (jd + i) * 3, d = (ju + i) * 3;
        const dux = pos[b] - pos[a], duy = pos[b + 1] - pos[a + 1], duz = pos[b + 2] - pos[a + 2];
        const dvx = pos[d] - pos[c], dvy = pos[d + 1] - pos[c + 1], dvz = pos[d + 2] - pos[c + 2];
        let nx = dvy * duz - dvz * duy, ny = dvz * dux - dvx * duz, nz = dvx * duy - dvy * dux;
        let l = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const o = (j * NX + i) * 3;
        if (!(l > 1e-12)) {   // つぶれた角：外向き
          nx = pos[o] - st.cx; ny = 0.3 * Math.hypot(nx, pos[o + 2] - st.cz); nz = pos[o + 2] - st.cz;
          l = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (!(l > 1e-9)) { nx = 0; ny = 1; nz = 0; l = 1; }
        }
        nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    dirty = false;
  }

  function commitDent() {
    if (!dent) return;
    const dl = dent.depth * Math.max(dent.a, 1);
    const sd = PE.radius * 0.5, invD = 1 / (2 * sd * sd), invD2 = invD / (2.2 * 2.2), bul = PE.bulge;
    for (let n = 0; n < NT; n++) {
      const v = dl * ((1 + bul) * Math.exp(-R2[n] * invD) - bul * Math.exp(-R2[n] * invD2));
      DN[n] += PE.keep * v; DR[n] += (1 - PE.keep) * v;
    }
    recT = PE.recoverTau * 4;
    dent = null; dirty = true;
  }
  function commitAll() {
    if (dent) commitDent();
    if (pull) { pull.active = false; write(true); }
  }

  // 指で触った：光線にいちばん近い頂点をつかむ。押した所はへこみ始める
  function grab(ray) {
    if (mode !== 'dough') return false;
    commitAll();
    if (dirty) write(false);
    const gp = group.position, gs = group.scale;
    const ox = (ray.origin.x - gp.x) / gs.x, oy = (ray.origin.y - gp.y) / gs.y, oz = (ray.origin.z - gp.z) / gs.z;
    let dx = ray.direction.x / gs.x, dy = ray.direction.y / gs.y, dz = ray.direction.z / gs.z;
    const dl = Math.hypot(dx, dy, dz);
    if (!(dl > 1e-9) || !Number.isFinite(ox + oy + oz)) return false;
    dx /= dl; dy /= dl; dz /= dl;
    let best = -1, bd = 1e18;
    for (let n = 0; n < NT; n++) {
      const o = n * 3, px = pos[o] - ox, py = pos[o + 1] - oy, pz = pos[o + 2] - oz;
      const t = px * dx + py * dy + pz * dz;
      const d = px * px + py * py + pz * pz - t * t + (TH[n] <= 0 ? 4e-5 : 0);   // 縁より面を選ぶ
      if (d < bd) { bd = d; best = n; }
    }
    if (best < 0) return false;
    const gx = PX[best], gz = PZ[best];
    for (let n = 0; n < NT; n++) { const ax = PX[n] - gx, az = PZ[n] - gz; R2[n] = ax * ax + az * az; }
    pull = { active: true, gx, gz, sx: 0, sz: 0, has: false, dx: 0, dz: 0, t: 0, moved: false, amount: 0 };
    dent = { t: 0, a: 0, depth: PE.depthMax * PE.tapDepth, hold: 0, released: false };
    grabPos.set(gp.x + pos[best * 3] * gs.x, gp.y + pos[best * 3 + 1] * gs.y, gp.z + pos[best * 3 + 2] * gs.z);
    jel.v -= 1.2;
    dirty = true;
    return true;
  }
  // 指が動いた：引っ張る。戻り値は伸び率 0..1（まだ引っ張りになっていなければ -1）
  function drag(bx, bz, dt) {
    const pl = pull;
    if (!pl || !pl.active || !Number.isFinite(bx + bz)) return -1;
    if (!pl.has) { pl.sx = bx; pl.sz = bz; pl.has = true; }
    const rx = bx - pl.sx, rz = bz - pl.sz, len = Math.hypot(rx, rz);
    if (len > PP.moveThreshold && !pl.moved) { pl.moved = true; if (dent) dent.depth *= PE.pinchDent; }   // つまんで引くときは跡を浅く
    if (!pl.moved) {
      if (dent && !dent.released) { dent.hold += dt; dent.depth = PE.depthMax * lerp(PE.tapDepth, 1, Math.min(1, dent.hold / PE.holdTime)); dirty = true; }
      return -1;
    }
    const eff = PP.limit * (1 - Math.exp(-len / PP.limit));
    pl.dx = rx / len * eff; pl.dz = rz / len * eff;
    pl.amount = clamp(eff / (PP.limit * 0.8), 0, 1);
    dirty = true;
    return pl.amount;
  }
  // 指を離した：びよーんと戻る（keep の割合は残る）。戻り値は伸び率（引っ張っていなければ -1）
  function release() {
    const pl = pull;
    if (dent) dent.released = true;
    if (!pl || !pl.active) return -1;
    pl.active = false; pl.t = 0;
    if (!pl.moved) { pull = null; return -1; }
    jel.v += 1.5 * pl.amount;
    dirty = true;
    return pl.amount;
  }

  // めん棒：通った帯を薄くし、減った分だけ広げる。戻り値は roll イベントの回数（薄くならなければ -1）
  function roll(pin) {
    if (mode !== 'dough' || dropT < 1) return -1;
    const dz = pin.dz;
    if (!Number.isFinite(dz + pin.center.x + pin.center.z) || Math.abs(dz) < 1e-6) return -1;
    commitAll();
    if (dirty) write(false);
    const r = Math.max(0.005, pin.radius), px = pin.center.x - OX, pz = pin.center.z - OZ, half = pin.length / 2 - 0.03;
    const sgn = dz > 0 ? 1 : -1;
    if (sgn !== rollSign || rollIdle > 0.25) {   // 新しいひと転がし：今いちばん厚い所の perStroke 倍まで押す
      rollSign = sgn;
      rollRide = Math.max(P.pin.minThickness, st.maxH * P.pin.perStroke);
    }
    rollIdle = 0;
    const zA = Math.min(pz - dz, pz), zB = Math.max(pz - dz, pz);
    let dH = 0, hit = 0;
    for (let n = 0; n < NT; n++) {
      const o = n * 3, th = TH[n];
      if (th <= 1e-6 || Math.abs(pos[o] - px) > half) continue;
      const z = pos[o + 2], dzv = z < zA ? zA - z : z > zB ? z - zB : 0;
      if (dzv >= r) continue;
      const cap = rollRide + r - Math.sqrt(r * r - dzv * dzv), cur = pos[o + 1];
      if (cur > cap) {
        const nf = Math.max(PD.minFactor, (cap + DN[n] + DR[n]) / th);
        if (nf < F[n]) { dH += (F[n] - nf) * th; F[n] = nf; hit++; }
      }
      if (dzv === 0) { DN[n] *= P.pin.smoothDents; DR[n] *= P.pin.smoothDents; }   // 指の跡は転がすとならされる
    }
    if (!hit) { dirty = true; return -1; }
    const eps = P.pin.spread * dH / st.sumH, ez = eps * (1 - P.pin.spreadX), ex = eps * P.pin.spreadX;
    for (let n = 0; n < NT; n++) {
      PX[n] = softLo(softHi(PX[n] + (PX[n] - st.cx) * ex, LX1, SOFT), LX0, SOFT);
      PZ[n] = softLo(softHi(PZ[n] + (PZ[n] - st.cz) * ez, LZ1, SOFT), LZ0, SOFT);
    }
    rollAcc += (st.z1 - st.z0) * ez;
    dirty = true;
    let ev = 0;
    while (rollAcc > 0.01) { rollAcc -= 0.01; ev++; }
    return ev;
  }
  const flatness = () => clamp((thick0 - st.maxH) / Math.max(1e-4, thick0 - P.pin.minThickness), 0, 1);

  // ================= 切ったあとの切り身メッシュ =================
  const NCOL = NX + 2 * MAXN + 4 * (MAXN - 1), SV = NCOL * NZ;
  const fX = new Float32Array(NT), fY = new Float32Array(NT), fZ = new Float32Array(NT), fD = new Float32Array(NT);
  const sBase = new Float32Array(SV * 3), sPos = new Float32Array(SV * 3), sNor = new Float32Array(SV * 3), sCol = new Float32Array(SV * 3), sUv = new Float32Array(SV * 2);
  const sIdx = new Uint16Array((NCOL - 1) * (NZ - 1) * 6);
  const colKind = new Uint8Array(NCOL), colFrac = new Float32Array(NCOL);   // kind: 0 面, 1 面の縁, 2 壁の上, 3 壁の下
  const slabGeo = new THREE.BufferGeometry();
  slabGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  slabGeo.setAttribute('normal', new THREE.BufferAttribute(sNor, 3));
  slabGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  slabGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2));
  slabGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
  slabGeo.setDrawRange(0, 0);
  const slabMesh = new THREE.Mesh(slabGeo, material);
  slabMesh.frustumCulled = false; slabMesh.visible = false;
  group.add(slabMesh);

  const cuts = [];           // 切れ目の x（ローカル、昇順）
  const cutQ = [];           // 切れ目ごと：外形との交点 [zLo,uLo,vLo, zHi,uHi,vHi]
  for (let i = 0; i < MAXN; i++) cutQ.push(new Float32Array(6));
  const pieces = [];
  for (let i = 0; i < MAXN; i++) pieces.push({ a: 0, b: 0, cx: 0, w: 0.01, z0: 0, z1: 0.1, th: 0.02, prof: new Float32Array(8), c0: 0, c1: 0, s0: 0, s1: 0, off: { x: 0, v: 0 }, sq: { x: 0, v: 0 }, hop: 0 });
  let frozen = false, X0 = 0, X1 = 0, slabTris = 0, slabDirty = false, slabAnim = 0;
  const S = { x: 0, y: 0, z: 0, d: 0, u: 0, v: 0 };   // 行をなぞった結果
  const zs = new Float32Array(NZ), ys = new Float32Array(NZ);

  // 行 j を x でなぞる（fX は行ごとに単調）
  function sampleRow(j, x) {
    const o = j * NX;
    let lo = 0, hi = NX - 1;
    if (x <= fX[o]) { hi = 1; x = fX[o]; } else if (x >= fX[o + hi]) { lo = hi - 1; x = fX[o + hi]; } else {
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fX[o + m] <= x) lo = m; else hi = m; }
    }
    const a = o + lo, b = o + lo + 1, den = fX[b] - fX[a], t = den > 1e-9 ? clamp((x - fX[a]) / den, 0, 1) : 0;
    S.x = x; S.y = fY[a] + (fY[b] - fY[a]) * t; S.z = fZ[a] + (fZ[b] - fZ[a]) * t; S.d = fD[a] + (fD[b] - fD[a]) * t;
    S.u = uv[a * 2] + (uv[b * 2] - uv[a * 2]) * t; S.v = uv[a * 2 + 1] + (uv[b * 2 + 1] - uv[a * 2 + 1]) * t;
  }
  // 切れ目 c と外形の交点（z の小さい側・大きい側）
  function findQ(c, q) {
    let zl = 1e9, zh = -1e9;
    const NB = loop.length;
    for (let k = 0; k < NB; k++) {
      const n0 = loop[k], n1 = loop[(k + 1) % NB], xa = fX[n0], xb = fX[n1];
      if ((xa - c) * (xb - c) > 0 || xa === xb) continue;
      const t = clamp((c - xa) / (xb - xa), 0, 1), z = fZ[n0] + (fZ[n1] - fZ[n0]) * t;
      const u = uv[n0 * 2] + (uv[n1 * 2] - uv[n0 * 2]) * t, v = uv[n0 * 2 + 1] + (uv[n1 * 2 + 1] - uv[n0 * 2 + 1]) * t;
      if (z < zl) { zl = z; q[0] = z; q[1] = u; q[2] = v; }
      if (z > zh) { zh = z; q[3] = z; q[4] = u; q[5] = v; }
    }
    if (zl > zh) { q[0] = q[3] = st.cz; q[1] = q[4] = 0.5; q[2] = q[5] = 0.5; }
  }

  // 形を凍らせる（最初に切る時・切らずに運ぶ時）
  function freeze() {
    if (frozen) return;
    commitAll();
    recT = 0;
    for (let n = 0; n < NT; n++) { DN[n] += DR[n]; DR[n] = 0; }
    write(false);
    X0 = 1e9; X1 = -1e9;
    for (let j = 0; j < NZ; j++) {
      let prev = -1e9;
      for (let i = 0; i < NX; i++) {
        const n = j * NX + i;
        let x = pos[n * 3]; if (x < prev + 1e-6) x = prev + 1e-6; prev = x;   // 行を x について単調にしておく
        fX[n] = x; fY[n] = pos[n * 3 + 1]; fZ[n] = pos[n * 3 + 2]; fD[n] = DN[n];
      }
      if (fX[j * NX] < X0) X0 = fX[j * NX];
      if (fX[j * NX + NX - 1] > X1) X1 = fX[j * NX + NX - 1];
    }
    frozen = true; cuts.length = 0;
    for (const p of pieces) { p.off.x = 0; p.off.v = 0; p.sq.x = 0; p.sq.v = 0; p.hop = 0; }
    rebuild();
  }

  function setV(vi, x, y, z, u, v, c, nx) {
    const o = vi * 3;
    sBase[o] = x; sBase[o + 1] = y; sBase[o + 2] = z;
    sUv[vi * 2] = u; sUv[vi * 2 + 1] = v + y / PD.texScale;
    sCol[o] = c; sCol[o + 1] = c * (0.985 + 0.015 * c); sCol[o + 2] = c * (0.96 + 0.04 * c);
    sNor[o] = nx; sNor[o + 1] = nx === 0 ? 1 : 0; sNor[o + 2] = 0;
  }
  // 切り身メッシュを組み直す（切るたびに1回。毎フレームではない）
  function rebuild() {
    const m = cuts.length, np = m + 1, total = Math.max(1e-6, X1 - X0), free = NX - np;
    for (let k = 0; k < m; k++) findQ(cuts[k], cutQ[k]);
    // 列の割り当て
    let colN = 0;
    for (let p = 0; p < np; p++) {
      const pc = pieces[p];
      pc.a = p ? cuts[p - 1] : X0; pc.b = p < m ? cuts[p] : X1;
      const ni = 1 + Math.max(0, Math.floor(free * (pc.b - pc.a) / total));
      pc.c0 = colN;
      if (p > 0) { colKind[colN++] = 3; colKind[colN++] = 2; }
      pc.s0 = colN; colKind[colN] = 1; colFrac[colN++] = 0;
      for (let k = 1; k <= ni; k++) {
        let t = k / (ni + 1);
        if (np === 1) t = lerp(t, 0.5 - 0.5 * Math.cos(Math.PI * t), 0.6);   // 丸い縁に列を寄せる
        else if (p === 0) t = Math.pow(t, 1.5); else if (p === m) t = 1 - Math.pow(1 - t, 1.5);
        colKind[colN] = 0; colFrac[colN++] = t;
      }
      pc.s1 = colN; colKind[colN] = 1; colFrac[colN++] = 1;
      if (p < m) { colKind[colN++] = 2; colKind[colN++] = 3; }
      pc.c1 = colN - 1;
    }
    const shade = PD.dentShade / PE.depthMax;
    // 頂点
    for (let j = 0; j < NZ; j++) {
      const o = j * NX, xl = fX[o], xr = fX[o + NX - 1], zmid = (fZ[o] + fZ[o + NX - 1]) / 2;
      for (let p = 0; p < np; p++) {
        const pc = pieces[p], a = pc.a, b = pc.b;
        const crossA = p > 0 && xl <= a && a <= xr, crossB = p < m && xl <= b && b <= xr;
        const inter = (p === 0 || xr >= a) && (p === m || xl <= b);
        // この行に近い側の「切れ目と外形の交点」
        let qa = p > 0 ? cutQ[p - 1] : null, qb = p < m ? cutQ[p] : null;
        let qaO = 0, qbO = 0;
        if (qa) qaO = zmid < (qa[0] + qa[3]) / 2 ? 0 : 3;
        if (qb) qbO = zmid < (qb[0] + qb[3]) / 2 ? 0 : 3;
        if (!qa) { qa = qb; qaO = qbO; }
        if (!qb) { qb = qa; qbO = qaO; }
        const xqa = p > 0 ? a : b, xqb = p < m ? b : a;
        const A = Math.max(a, xl), B = Math.min(b, xr);
        for (let c = pc.c0; c <= pc.c1; c++) {
          const kind = colKind[c], vi = c * NZ + j, left = c < pc.s0, right = c > pc.s1;
          if (left || right) {   // 断面の壁（上と下）
            const cross = left ? crossA : crossB, xc = left ? a : b, q = left ? qa : qb, qo = left ? qaO : qbO;
            if (cross) { sampleRow(j, xc); setV(vi, xc, kind === 3 ? 0 : S.y, S.z, S.u, S.v, kind === 3 ? 0.58 : 0.98, left ? -1 : 1); }
            else setV(vi, xc, 0, q[qo], q[qo + 1], q[qo + 2], kind === 3 ? 0.58 : 0.98, left ? -1 : 1);
            continue;
          }
          const t = colFrac[c];
          if (!inter) {   // この行は切り身に掛からない：外形の上（高さ 0）へたたむ
            if (!qa) { setV(vi, xl, 0, fZ[o], uv[o * 2], uv[o * 2 + 1], 1, 0); continue; }
            setV(vi, lerp(xqa, xqb, t), 0, lerp(qa[qaO], qb[qbO], t), lerp(qa[qaO + 1], qb[qbO + 1], t), lerp(qa[qaO + 2], qb[qbO + 2], t), 1, 0);
            continue;
          }
          sampleRow(j, kind === 1 ? (c === pc.s0 ? (crossA ? a : xl) : (crossB ? b : xr)) : lerp(A, B, t));
          let cc = (1 - clamp(S.d * shade, -0.04, 0.4)) * (S.y < BASE_H ? 1 - BASE_AO * (1 - S.y / BASE_H) * (1 - S.y / BASE_H) : 1);
          if (kind === 1 && ((c === pc.s0 && crossA) || (c === pc.s1 && crossB))) cc *= 0.93;   // 切れ目の縁を少し暗く
          setV(vi, S.x, S.y, S.z, S.u, S.v, cc, 0);
          sUv[vi * 2 + 1] = S.v;
        }
      }
    }
    // 面の法線（切り身の中だけで差分を取る。切れ目をまたがない）
    for (let p = 0; p < np; p++) {
      const pc = pieces[p];
      for (let c = pc.s0; c <= pc.s1; c++) {
        const cl = c > pc.s0 ? c - 1 : c, cr = c < pc.s1 ? c + 1 : c;
        for (let j = 0; j < NZ; j++) {
          const jd = j > 0 ? j - 1 : j, ju = j < NZ - 1 ? j + 1 : j;
          const a = (cl * NZ + j) * 3, b = (cr * NZ + j) * 3, e = (c * NZ + jd) * 3, d = (c * NZ + ju) * 3;
          const dux = sBase[b] - sBase[a], duy = sBase[b + 1] - sBase[a + 1], duz = sBase[b + 2] - sBase[a + 2];
          const dvx = sBase[d] - sBase[e], dvy = sBase[d + 1] - sBase[e + 1], dvz = sBase[d + 2] - sBase[e + 2];
          let nx = dvy * duz - dvz * duy, ny = dvz * dux - dvx * duz, nz = dvx * duy - dvy * dux;
          let l = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (!(l > 1e-12)) { nx = 0; ny = 1; nz = 0; l = 1; }
          const o = (c * NZ + j) * 3;
          sNor[o] = nx / l; sNor[o + 1] = ny / l; sNor[o + 2] = nz / l;
        }
      }
    }
    // 三角形（切り身ごとに 左の壁→上面→右の壁 のひと続き）
    let io = 0;
    for (let p = 0; p < np; p++) {
      const pc = pieces[p];
      for (let c = pc.c0; c < pc.c1; c++) for (let j = 0; j < NZ - 1; j++) {
        const a = c * NZ + j, b = a + NZ, cc = a + 1, d = b + 1;
        sIdx[io++] = a; sIdx[io++] = cc; sIdx[io++] = b; sIdx[io++] = b; sIdx[io++] = cc; sIdx[io++] = d;
      }
    }
    slabTris = io / 3;
    slabGeo.setDrawRange(0, io);
    slabGeo.index.needsUpdate = true;
    slabGeo.attributes.normal.needsUpdate = true; slabGeo.attributes.color.needsUpdate = true; slabGeo.attributes.uv.needsUpdate = true;
    // 切り身ごとの寸法（麺になる時に使う）：中心線の z の範囲と厚さの並び
    for (let p = 0; p < np; p++) {
      const pc = pieces[p];
      pc.cx = (pc.a + pc.b) / 2; pc.w = pc.b - pc.a;
      let cnt = 0;
      for (let j = 0; j < NZ; j++) {
        const o = j * NX;
        if (fX[o] > pc.cx || fX[o + NX - 1] < pc.cx) continue;
        sampleRow(j, pc.cx); zs[cnt] = S.z; ys[cnt] = S.y; cnt++;
      }
      if (cnt < 2) { pc.z0 = st.cz - 0.03; pc.z1 = st.cz + 0.03; pc.th = st.maxH * 0.5; pc.prof.fill(pc.th); continue; }
      let z0 = 1e9, z1 = -1e9;
      for (let k = 0; k < cnt; k++) { if (zs[k] < z0) z0 = zs[k]; if (zs[k] > z1) z1 = zs[k]; }
      pc.z0 = z0; pc.z1 = z1;
      let acc = 0;
      for (let q = 0; q < 8; q++) {
        const z = z0 + (z1 - z0) * (q + 0.5) / 8;
        let k = 0; while (k < cnt - 2 && zs[k + 1] < z) k++;
        const den = zs[k + 1] - zs[k], t = Math.abs(den) > 1e-9 ? clamp((z - zs[k]) / den, 0, 1) : 0;
        pc.prof[q] = Math.max(0.002, ys[k] + (ys[k + 1] - ys[k]) * t);
        if (q >= 2 && q <= 5) acc += pc.prof[q];
      }
      pc.th = acc / 4;
    }
    slabDirty = true;
  }
  function writeSlab() {
    const np = cuts.length + 1;
    for (let p = 0; p < np; p++) {
      const pc = pieces[p], off = pc.off.x, sy = 1 + pc.sq.x, hop = pc.hop;
      for (let o = pc.c0 * NZ * 3, e = (pc.c1 + 1) * NZ * 3; o < e; o += 3) {
        sPos[o] = sBase[o] + off; sPos[o + 1] = sBase[o + 1] * sy + hop; sPos[o + 2] = sBase[o + 2];
      }
    }
    slabGeo.attributes.position.needsUpdate = true;
    slabDirty = false;
  }

  // 包丁：ワールドの x で切る。戻り値は今できた麺の幅（切れなければ -1）
  function cut(xw, zw) {
    if (mode === 'hidden' || dropT < 1 || !Number.isFinite(xw + zw)) return -1;
    const x = xw - OX, z = zw - OZ;
    if (!frozen) {
      if (dirty) write(false);
      if (x < st.x0 + PC.minPieceWidth || x > st.x1 - PC.minPieceWidth || z < st.z0 - PC.zMargin || z > st.z1 + PC.zMargin) return -1;
      freeze();
    }
    const m = cuts.length;
    let p = 0; while (p < m && cuts[p] < x) p++;
    const xc = x - pieces[p].off.x;   // 開いた分を戻して、凍らせた形の x へ
    const a = p ? cuts[p - 1] : X0, b = p < m ? cuts[p] : X1;
    if (m + 1 >= MAXN || z < st.z0 - PC.zMargin || z > st.z1 + PC.zMargin || xc - a < PC.minPieceWidth || b - xc < PC.minPieceWidth) {
      if (mode === 'dough') frozen = false;   // 切れなかった：生地のまま
      return -1;
    }
    cuts.splice(p, 0, xc);
    for (let q = m + 1; q > p; q--) {   // 右側の切り身の動きの状態を1つずらす
      const s = pieces[q - 1], d = pieces[q];
      d.off.x = s.off.x; d.off.v = s.off.v; d.sq.x = s.sq.x; d.sq.v = s.sq.v;
    }
    pieces[p].sq.v -= 2.2; pieces[p + 1].sq.v -= 2.2;   // 切った両側が「ぷるん」
    pieces[p].off.v -= 0.12; pieces[p + 1].off.v += 0.12;
    mode = 'slab'; mesh.visible = false; slabMesh.visible = true;
    rebuild();
    slabAnim = 0.8;
    jel.v -= 0.5;
    return Math.min(xc - a, b - xc);
  }

  // ================= 毎フレーム =================
  function place() {
    const j = clamp(jel.x, -0.4, 0.3), sxz = 1 - 0.45 * j, sy = 1 + j;
    group.scale.set(sxz, sy, sxz);
    group.position.set(OX + st.cx * (1 - sxz), OY + dropY, OZ + st.cz * (1 - sxz));
    group.updateMatrixWorld(true);
  }
  // hop: ヒントの跳ね（0..1 を返す関数 hopAt(遅れ) を受け取る）
  function update(dt, time, hinting, hopAt) {
    if (mode === 'hidden') return;
    // 落ちてくる生地
    if (dropT < 1) {
      const D = PD.drop;
      dropT = Math.min(1, dropT + dt / D.total);
      const tf = dropT * D.total / D.fall;
      if (tf < 1) { dropY = D.height * (1 - tf * tf); jel.x = 0.1; jel.v = 0; }
      else { dropY = 0; if (!landedKick) { landedKick = true; jel.v = -9; } }
    } else dropY = 0;
    spring(jel, 0, WJ, PD.jelly.zeta, dt);
    jel.x = clamp(jel.x, -0.4, 0.3);
    rollIdle += dt;

    if (mode === 'dough') {
      if (dent) {
        dent.t += dt; dent.a = easeOutBack(dent.t / PE.growTime); dirty = true;
        if (dent.released && dent.t >= PE.growTime) commitDent();
      }
      if (pull && !pull.active) { pull.t += dt; dirty = true; if (pull.t >= PP.settle) write(true); }
      if (recT > 0) {
        recT -= dt;
        const k = recT > 0 ? Math.exp(-dt / PE.recoverTau) : 0;
        for (let n = 0; n < NT; n++) DR[n] *= k;
        dirty = true;
      }
      if (dirty) write(false);
      const idle = !pull && !dent && dropT >= 1;
      const br = idle ? PD.breathe.amp * Math.sin(time * 2 * Math.PI / PD.breathe.period) : 0;
      const hop = hinting ? hopAt(0) * P.hint.hopHeight : 0;
      const j = jel.x + br, sxz = 1 - 0.45 * j, sy = 1 + j;
      group.scale.set(sxz, sy, sxz);
      group.position.set(OX + st.cx * (1 - sxz), OY + dropY + hop, OZ + st.cz * (1 - sxz));
      bounds.x0 = OX + st.x0; bounds.x1 = OX + st.x1; bounds.z0 = OZ + st.z0; bounds.z1 = OZ + st.z1; bounds.h = st.maxH;
    } else {   // slab：切り身が開く・弾む・（ヒントで）順番に跳ねる
      const np = cuts.length + 1;
      const w1 = 2 * Math.PI / 0.2, w2 = 2 * Math.PI / 0.22;
      let moving = slabAnim > 0;
      slabAnim -= dt;
      for (let p = 0; p < np; p++) {
        const pc = pieces[p], target = PC.gap * (p - (np - 1) / 2);
        if (moving || Math.abs(pc.off.x - target) > 1e-5) { spring(pc.off, target, w1, 0.5, dt); spring(pc.sq, 0, w2, 0.28, dt); pc.sq.x = clamp(pc.sq.x, -0.3, 0.3); slabDirty = true; }
        const hop = hinting ? hopAt(p * 0.06) * P.hint.hopHeight * 1.3 : 0;
        if (hop !== pc.hop) { pc.hop = hop; slabDirty = true; }
      }
      if (slabDirty) writeSlab();
      const sxz = 1 - 0.45 * jel.x, sy = 1 + jel.x;
      group.scale.set(sxz, sy, sxz);
      group.position.set(OX + st.cx * (1 - sxz), OY, OZ + st.cz * (1 - sxz));
      bounds.x0 = OX + X0 + pieces[0].off.x; bounds.x1 = OX + X1 + pieces[np - 1].off.x; bounds.z0 = OZ + st.z0; bounds.z1 = OZ + st.z1; bounds.h = st.maxH;
    }
    group.updateMatrixWorld(true);
  }

  // 切り身 p を麺にするための寸法（ワールド）
  function pieceOut(p, out) {
    const pc = pieces[p];
    out.x = OX + pc.cx + pc.off.x; out.z0 = OZ + pc.z0; out.z1 = OZ + pc.z1; out.y = OY;
    out.w = pc.w; out.th = pc.th; out.prof = pc.prof;
    return out;
  }

  reset(0);

  return {
    group, bounds, grabPos,
    get mode() { return mode; },
    get lift() { return dropY; },
    get cx() { return OX + st.cx; },
    get cz() { return OZ + st.cz; },
    get count() { return frozen ? cuts.length + 1 : 1; },
    get cutCount() { return cuts.length; },
    get landed() { return dropT >= 1 || landedKick; },
    get dropping() { return dropT < 1; },
    get stretching() { return !!(pull && pull.active && pull.moved); },
    reset, grab, drag, release, roll, flatness, cut, freeze, pieceOut, update,
    finishDrop() { dropT = 1; dropY = 0; },
    hide() { mode = 'hidden'; mesh.visible = false; slabMesh.visible = false; pull = null; dent = null; },
    kick(v) { jel.v += v; },
    tris() { return mode === 'dough' ? TRIS : mode === 'slab' ? slabTris : 0; },
    bytes() { return pos.byteLength * 3 + uv.byteLength + geo.index.array.byteLength + sPos.byteLength * 3 + sUv.byteLength + sIdx.byteLength; },
    dispose() { geo.dispose(); slabGeo.dispose(); if (group.parent) group.parent.remove(group); },
  };
}
