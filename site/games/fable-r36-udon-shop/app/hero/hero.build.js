/* generated from app/hero/hero.js by `npm run build:hero` — 直接編集しない */
var UdonHero = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // app/hero/hero.js
  var hero_exports = {};
  __export(hero_exports, {
    createHero: () => createHero
  });

  // app/hero/params.js
  var PARAMS = {
    // 品質ごとの分割：生地の格子 nx×nz、麺チューブ seg（長さ方向）×rad（断面）
    quality: {
      low: { nx: 32, nz: 24, seg: 24, rad: 6 },
      mid: { nx: 48, nz: 36, seg: 40, rad: 8 },
      high: { nx: 64, nz: 48, seg: 56, rad: 10 }
    },
    g: 9.8,
    dough: {
      edgeRound: 0.012,
      // 側面の丸み（肩の幅 = edgeRound × 1.8）
      mound: 0.2,
      // 上面の盛り上がり（縁の高さは中央の 1-mound 倍）
      minFactor: 0.12,
      // 元の厚さのこの割合より薄くはならない
      texScale: 0.3,
      // テクスチャ1枚が覆う長さ
      blob: [0.05, 0.035],
      // 外形のゆらぎ（reset の seed で変わる）
      sizeJitter: 0.14,
      // 大きさのゆらぎ
      edgeBias: 0.75,
      // 格子を縁へ寄せる度合い（0 で均等）
      boardMargin: 0.012,
      // まな板の端からの余白
      boardSoft: 0.025,
      // 端でやわらかく止まる幅
      jelly: { period: 0.26, zeta: 0.2 },
      // ぷるん（全体のつぶれ・のびのばね）
      breathe: { amp: 0.012, period: 3.4 },
      // 息をするような揺れ
      drop: { height: 0.22, fall: 0.25, total: 0.6 },
      // reset の「ぽよん」
      dentShade: 0.34,
      // へこみを暗くして見やすくする量
      baseShade: 0.2
      // 板に接する根元を暗くする量（接地の影の代わり）
    },
    dent: {
      radius: 0.03,
      depthMax: 0.014,
      keep: 0.7,
      // 残る割合（30% だけゆっくり戻る）
      recoverTau: 0.6,
      growTime: 0.1,
      tapDepth: 0.85,
      // タップ直後の深さ（depthMax 比）。押し続けると 1 まで深くなる
      holdTime: 0.6,
      bulge: 0.35,
      pinchDent: 0.5
      // 引っ張りになった時、跡の深さに掛ける倍率
    },
    pull: {
      maxStretch: 1.8,
      // 局所の伸び率の上限。式では使わず、limit と widen の組で守る（0.607·D/(falloff+widen·D) ≤ 0.8）
      keep: 0.65,
      falloff: 0.06,
      widen: 0.55,
      // 引くほど巻き込む範囲が広がる（falloff + widen × 引いた量）
      limit: 0.2,
      // 引ける量の上限（ここへなめらかに近づく）
      period: 0.25,
      decay: 0.4,
      settle: 1,
      moveThreshold: 0.012,
      thin: 0.5,
      neck: 0.28,
      // 伸びた所が薄く・細くなる量
      pinch: 5e-3
      // つまんだ所の小さな盛り上がり
    },
    pin: {
      minThickness: 0.012,
      perStroke: 0.78,
      // 1往復ごとに一番厚い所の何倍まで押すか
      spread: 0.6,
      spreadX: 0.15,
      // 減った厚さのうち広がりになる割合、x に回る割合
      smoothDents: 0.9
    },
    cut: { minPieceWidth: 8e-3, gap: 3e-3, zMargin: 0.05 },
    noodle: {
      K: 10,
      // 制御点の数（偶数。とぐろを 1.8 周まで巻けるよう 6 → 10）
      wMin: 6e-3,
      wMax: 0.032,
      // 麺の幅 = 切った間隔（wMax まで。超えた分は長さになる）
      hMin: 7e-3,
      hMax: 0.016,
      hScale: 0.5,
      // 麺の厚さ = 生地の厚さ × hScale（お椀に入る太さへ）
      lMin: 0.05,
      lMax: 0.46,
      lMaxPerWidth: 6,
      // 長さの上限（幅が広いほど短く：lMax − lMaxPerWidth × (幅 − 0.012)）
      lenScale: 1.5,
      // 麺の長さ = 生地の z の長さ × lenScale（細くなったぶん伸びる）
      morphTime: 0.3,
      // 生地の切り身 → 麺の断面へ変わる時間
      texScale: 0.25
    },
    hang: {
      damping: 3,
      splay: [0.5, 0.22, 0.08, 0.03],
      // 指に掛かった所から先へ、外へ開く傾き（tan）
      topGap: 3e-3,
      bundle: 0.014,
      // つまんだ所の束の半径
      uneven: 0.24,
      // つまむ位置のずれ（麺の長さ比。両端の高さがそろわない）
      floorDip: 0.035
      // 鍋の上では先が湯にこれだけ浸かる
    },
    pot: {
      rimAbove: 0.06,
      // 湯面から鍋のふちまで
      waveAmp: 0.01,
      waveLen: 0.08,
      wavePeriod: 1.6,
      bobAmp: 8e-3,
      depthMin: 0.014,
      depthVar: 0.03,
      drift: 0.14,
      omegaMax: 3,
      omegaDecay: 1.5,
      stirGain: 1.5,
      plunge: 0.03
    },
    // 網のかご（shell の形に合わせた値：半径・縁の高さ）。inCup = かごの中に残る長さの上限
    net: { radius: 0.062, rimY: 0.012, inCup: 0.1, inCupFrac: 0.42, hangTime: 0.35 },
    bowl: {
      r0: 0.012,
      rimFill: 0.75,
      // とぐろの内側・外側（外 = innerRadius × rimFill）
      maxTurns: 1.7,
      // 1本が巻く周の上限（K = 10 のとき。超えるなら次の層へ）
      floatAbove: 4e-3,
      // つゆの面より上に出る量（一番上の層の中心）
      fillRate: 2.5,
      // shell のつゆが満ちる速さ（麺が一緒に浮き上がる）
      feedBase: 0.4,
      feedPerMeter: 1,
      feedStagger: 0.035
    },
    eat: { duration: 1.6, lift: 0.05, wobble: 8e-3 },
    shadow: { dough: 0.3, laid: 0.2, hang: 0.34 },
    // 疑似影の濃さ
    hint: { period: 1.2, hopEvery: 2, hopTime: 0.35, hopHeight: 0.01, glow: [0.35, 0.28, 0.12] },
    move: { hand: 0.22, board: 0.38, pot: 0.5, net: 0.32, bowlBlend: 0.3 }
  };

  // app/hero/math.js
  var clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  var lerp = (a, b, t) => a + (b - a) * t;
  var smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  var easeOutCubic = (t) => {
    t = 1 - clamp(t, 0, 1);
    return 1 - t * t * t;
  };
  var easeOutBack = (t) => {
    t = clamp(t, 0, 1) - 1;
    return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
  };
  var hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  var softHi = (x, L, k) => x <= L - k ? x : L - k * Math.exp(-(x - (L - k)) / k);
  var softLo = (x, L, k) => x >= L + k ? x : L + k * Math.exp((x - (L + k)) / k);
  function spring(s, target, w, zeta, dt) {
    const n = dt > 0.02 ? 2 : 1, h = dt / n;
    for (let i = 0; i < n; i++) {
      s.v += (-w * w * (s.x - target) - 2 * zeta * w * s.v) * h;
      s.x += s.v * h;
    }
    if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) {
      s.x = target;
      s.v = 0;
    }
  }
  function crWeights(t, out, o) {
    const t2 = t * t, t3 = t2 * t;
    out[o] = 0.5 * (-t + 2 * t2 - t3);
    out[o + 1] = 0.5 * (2 - 5 * t2 + 3 * t3);
    out[o + 2] = 0.5 * (t + 4 * t2 - 3 * t3);
    out[o + 3] = 0.5 * (-t2 + t3);
  }

  // app/hero/dough.js
  function createDough(THREE, Q, P, LY, material, MAXN) {
    const NX = Q.nx, NZ = Q.nz, NT = NX * NZ;
    const PD = P.dough, PP = P.pull, PE = P.dent, PC = P.cut;
    const OX = LY.doughStart.center.x, OY = LY.board.center.y, OZ = LY.doughStart.center.z;
    const bd = LY.board;
    const LX0 = bd.center.x - bd.sizeX / 2 + PD.boardMargin - OX, LX1 = bd.center.x + bd.sizeX / 2 - PD.boardMargin - OX;
    const LZ0 = bd.center.z - bd.sizeZ / 2 + PD.boardMargin - OZ, LZ1 = bd.center.z + bd.sizeZ / 2 - PD.boardMargin - OZ;
    const SOFT = PD.boardSoft, BASE_H = 0.012, BASE_AO = PD.baseShade;
    const group = new THREE.Group();
    group.name = "hero-dough";
    const pos = new Float32Array(NT * 3), nor = new Float32Array(NT * 3), col = new Float32Array(NT * 3), uv = new Float32Array(NT * 2);
    const PX = new Float32Array(NT), PZ = new Float32Array(NT), TH = new Float32Array(NT);
    const F = new Float32Array(NT), DN = new Float32Array(NT), DR = new Float32Array(NT), R2 = new Float32Array(NT);
    const geo = new THREE.BufferGeometry();
    {
      const idx = new Uint16Array((NX - 1) * (NZ - 1) * 6);
      let o = 0;
      for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
        idx[o++] = a;
        idx[o++] = c;
        idx[o++] = b;
        idx[o++] = b;
        idx[o++] = c;
        idx[o++] = d;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    const TRIS = (NX - 1) * (NZ - 1) * 2;
    const loop = [];
    for (let i = 0; i < NX; i++) loop.push(i);
    for (let j = 1; j < NZ; j++) loop.push(j * NX + NX - 1);
    for (let i = NX - 2; i >= 0; i--) loop.push((NZ - 1) * NX + i);
    for (let j = NZ - 2; j >= 1; j--) loop.push(j * NX);
    let mode = "dough";
    let thick0 = 0.035;
    let pull = null;
    let dent = null;
    let recT = 0;
    let dirty = true;
    let rollAcc = 0, rollSign = 0, rollRide = 0, rollIdle = 9;
    const jel = { x: 0, v: 0 };
    let dropT = 1, dropY = 0, landedKick = false;
    const st = { x0: 0, x1: 0, z0: 0, z1: 0, maxH: 0.03, sumH: 1, cx: 0, cz: 0 };
    const WJ = 2 * Math.PI / PD.jelly.period;
    const grabPos = new THREE.Vector3();
    const bounds = { x0: 0, x1: 0, z0: 0, z1: 0, h: 0.03 };
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
        PX[n] = ux * SX * m;
        PZ[n] = uz * SZ * m;
        TH[n] = thick0 * (1 - PD.mound * r * r) * Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)));
        F[n] = 1;
        DN[n] = 0;
        DR[n] = 0;
        R2[n] = 1;
        uv[n * 2] = PX[n] / PD.texScale + 0.5;
        uv[n * 2 + 1] = PZ[n] / PD.texScale + 0.5;
      }
      geo.attributes.uv.needsUpdate = true;
      pull = null;
      dent = null;
      recT = 0;
      rollAcc = 0;
      rollSign = 0;
      rollIdle = 9;
      cuts.length = 0;
      frozen = false;
      mode = "dough";
      mesh.visible = true;
      slabMesh.visible = false;
      jel.x = 0.1;
      jel.v = 0;
      dropT = 0;
      landedKick = false;
      write(false);
      place();
    }
    const pullFactor = (pl) => pl.active ? 1 : PP.keep + (1 - PP.keep) * Math.exp(-pl.t / PP.decay) * Math.cos(2 * Math.PI * pl.t / PP.period);
    function write(commit) {
      const pl = pull, de = dent;
      let hasPull = false, dxE = 0, dzE = 0, inv2s = 0, thinK = 0, neckK = 0, ux = 0, uz = 0, pinchK = 0, gx = 0, gz = 0;
      if (pl) {
        const Dm = Math.hypot(pl.dx, pl.dz);
        if (Dm > 1e-6) {
          const f = pullFactor(pl), sig = PP.falloff + PP.widen * Dm;
          hasPull = true;
          inv2s = 1 / (2 * sig * sig);
          dxE = pl.dx * f;
          dzE = pl.dz * f;
          thinK = PP.thin * (Dm / sig) * f;
          neckK = PP.neck * Math.min(1, Dm / 0.1) * f;
          ux = pl.dx / Dm;
          uz = pl.dz / Dm;
          gx = pl.gx;
          gz = pl.gz;
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
          const q = -(x - gx) * uz + (z - gz) * ux, c2 = neckK * g * q;
          x += uz * c2 + dxE * w;
          z += -ux * c2 + dzE * w;
          const tf = 1 / (1 + thinK * g);
          if (commit) F[n] = f * tf;
          f *= tf;
          lift = pinchK * Math.exp(-r2 * invPinch);
        }
        x = softLo(softHi(x, LX1, SOFT), LX0, SOFT);
        z = softLo(softHi(z, LZ1, SOFT), LZ0, SOFT);
        if (commit) {
          PX[n] = x;
          PZ[n] = z;
        }
        const th = TH[n];
        let dsum = DN[n] + DR[n];
        if (dl !== 0) dsum += dl * ((1 + bul) * Math.exp(-r2 * invD) - bul * Math.exp(-r2 * invD2));
        let y = th * f - dsum;
        const ymin = th * minF;
        if (y < ymin) y = ymin;
        y += lift * (th > 0 ? 1 : 0);
        const o = n * 3;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        const c = (1 - clamp(dsum * shade, -0.04, 0.4)) * (y < BASE_H ? 1 - BASE_AO * (1 - y / BASE_H) * (1 - y / BASE_H) : 1);
        col[o] = c;
        col[o + 1] = c * (0.985 + 0.015 * c);
        col[o + 2] = c * (0.96 + 0.04 * c);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (z < z0) z0 = z;
        if (z > z1) z1 = z;
        if (y > maxH) maxH = y;
        sumH += y;
        sx += x * y;
        sz += z * y;
      }
      if (commit && pl) pull = null;
      st.x0 = x0;
      st.x1 = x1;
      st.z0 = z0;
      st.z1 = z1;
      st.maxH = Math.max(maxH, 4e-3);
      st.sumH = Math.max(sumH, 1e-6);
      st.cx = sx / st.sumH;
      st.cz = sz / st.sumH;
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
          if (!(l > 1e-12)) {
            nx = pos[o] - st.cx;
            ny = 0.3 * Math.hypot(nx, pos[o + 2] - st.cz);
            nz = pos[o + 2] - st.cz;
            l = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (!(l > 1e-9)) {
              nx = 0;
              ny = 1;
              nz = 0;
              l = 1;
            }
          }
          nor[o] = nx / l;
          nor[o + 1] = ny / l;
          nor[o + 2] = nz / l;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      dirty = false;
    }
    function commitDent() {
      if (!dent) return;
      const dl = dent.depth * Math.max(dent.a, 1);
      const sd = PE.radius * 0.5, invD = 1 / (2 * sd * sd), invD2 = invD / (2.2 * 2.2), bul = PE.bulge;
      for (let n = 0; n < NT; n++) {
        const v = dl * ((1 + bul) * Math.exp(-R2[n] * invD) - bul * Math.exp(-R2[n] * invD2));
        DN[n] += PE.keep * v;
        DR[n] += (1 - PE.keep) * v;
      }
      recT = PE.recoverTau * 4;
      dent = null;
      dirty = true;
    }
    function commitAll() {
      if (dent) commitDent();
      if (pull) {
        pull.active = false;
        write(true);
      }
    }
    function grab(ray) {
      if (mode !== "dough") return false;
      commitAll();
      if (dirty) write(false);
      const gp = group.position, gs = group.scale;
      const ox = (ray.origin.x - gp.x) / gs.x, oy = (ray.origin.y - gp.y) / gs.y, oz = (ray.origin.z - gp.z) / gs.z;
      let dx = ray.direction.x / gs.x, dy = ray.direction.y / gs.y, dz = ray.direction.z / gs.z;
      const dl = Math.hypot(dx, dy, dz);
      if (!(dl > 1e-9) || !Number.isFinite(ox + oy + oz)) return false;
      dx /= dl;
      dy /= dl;
      dz /= dl;
      let best = -1, bd2 = 1e18;
      for (let n = 0; n < NT; n++) {
        const o = n * 3, px = pos[o] - ox, py = pos[o + 1] - oy, pz = pos[o + 2] - oz;
        const t = px * dx + py * dy + pz * dz;
        const d = px * px + py * py + pz * pz - t * t + (TH[n] <= 0 ? 4e-5 : 0);
        if (d < bd2) {
          bd2 = d;
          best = n;
        }
      }
      if (best < 0) return false;
      const gx = PX[best], gz = PZ[best];
      for (let n = 0; n < NT; n++) {
        const ax = PX[n] - gx, az = PZ[n] - gz;
        R2[n] = ax * ax + az * az;
      }
      pull = { active: true, gx, gz, sx: 0, sz: 0, has: false, dx: 0, dz: 0, t: 0, moved: false, amount: 0 };
      dent = { t: 0, a: 0, depth: PE.depthMax * PE.tapDepth, hold: 0, released: false };
      grabPos.set(gp.x + pos[best * 3] * gs.x, gp.y + pos[best * 3 + 1] * gs.y, gp.z + pos[best * 3 + 2] * gs.z);
      jel.v -= 1.2;
      dirty = true;
      return true;
    }
    function drag(bx, bz, dt) {
      const pl = pull;
      if (!pl || !pl.active || !Number.isFinite(bx + bz)) return -1;
      if (!pl.has) {
        pl.sx = bx;
        pl.sz = bz;
        pl.has = true;
      }
      const rx = bx - pl.sx, rz = bz - pl.sz, len = Math.hypot(rx, rz);
      if (len > PP.moveThreshold && !pl.moved) {
        pl.moved = true;
        if (dent) dent.depth *= PE.pinchDent;
      }
      if (!pl.moved) {
        if (dent && !dent.released) {
          dent.hold += dt;
          dent.depth = PE.depthMax * lerp(PE.tapDepth, 1, Math.min(1, dent.hold / PE.holdTime));
          dirty = true;
        }
        return -1;
      }
      const eff = PP.limit * (1 - Math.exp(-len / PP.limit));
      pl.dx = rx / len * eff;
      pl.dz = rz / len * eff;
      pl.amount = clamp(eff / (PP.limit * 0.8), 0, 1);
      dirty = true;
      return pl.amount;
    }
    function release() {
      const pl = pull;
      if (dent) dent.released = true;
      if (!pl || !pl.active) return -1;
      pl.active = false;
      pl.t = 0;
      if (!pl.moved) {
        pull = null;
        return -1;
      }
      jel.v += 1.5 * pl.amount;
      dirty = true;
      return pl.amount;
    }
    function roll(pin) {
      if (mode !== "dough" || dropT < 1) return -1;
      const dz = pin.dz;
      if (!Number.isFinite(dz + pin.center.x + pin.center.z) || Math.abs(dz) < 1e-6) return -1;
      commitAll();
      if (dirty) write(false);
      const r = Math.max(5e-3, pin.radius), px = pin.center.x - OX, pz = pin.center.z - OZ, half = pin.length / 2 - 0.03;
      const sgn = dz > 0 ? 1 : -1;
      if (sgn !== rollSign || rollIdle > 0.25) {
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
          if (nf < F[n]) {
            dH += (F[n] - nf) * th;
            F[n] = nf;
            hit++;
          }
        }
        if (dzv === 0) {
          DN[n] *= P.pin.smoothDents;
          DR[n] *= P.pin.smoothDents;
        }
      }
      if (!hit) {
        dirty = true;
        return -1;
      }
      const eps = P.pin.spread * dH / st.sumH, ez = eps * (1 - P.pin.spreadX), ex = eps * P.pin.spreadX;
      for (let n = 0; n < NT; n++) {
        PX[n] = softLo(softHi(PX[n] + (PX[n] - st.cx) * ex, LX1, SOFT), LX0, SOFT);
        PZ[n] = softLo(softHi(PZ[n] + (PZ[n] - st.cz) * ez, LZ1, SOFT), LZ0, SOFT);
      }
      rollAcc += (st.z1 - st.z0) * ez;
      dirty = true;
      let ev = 0;
      while (rollAcc > 0.01) {
        rollAcc -= 0.01;
        ev++;
      }
      return ev;
    }
    const flatness = () => clamp((thick0 - st.maxH) / Math.max(1e-4, thick0 - P.pin.minThickness), 0, 1);
    const NCOL = NX + 2 * MAXN + 4 * (MAXN - 1), SV = NCOL * NZ;
    const fX = new Float32Array(NT), fY = new Float32Array(NT), fZ = new Float32Array(NT), fD = new Float32Array(NT);
    const sBase = new Float32Array(SV * 3), sPos = new Float32Array(SV * 3), sNor = new Float32Array(SV * 3), sCol = new Float32Array(SV * 3), sUv = new Float32Array(SV * 2);
    const sIdx = new Uint16Array((NCOL - 1) * (NZ - 1) * 6);
    const colKind = new Uint8Array(NCOL), colFrac = new Float32Array(NCOL);
    const slabGeo = new THREE.BufferGeometry();
    slabGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
    slabGeo.setAttribute("normal", new THREE.BufferAttribute(sNor, 3));
    slabGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
    slabGeo.setAttribute("uv", new THREE.BufferAttribute(sUv, 2));
    slabGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
    slabGeo.setDrawRange(0, 0);
    const slabMesh = new THREE.Mesh(slabGeo, material);
    slabMesh.frustumCulled = false;
    slabMesh.visible = false;
    group.add(slabMesh);
    const cuts = [];
    const cutQ = [];
    for (let i = 0; i < MAXN; i++) cutQ.push(new Float32Array(6));
    const pieces = [];
    for (let i = 0; i < MAXN; i++) pieces.push({ a: 0, b: 0, cx: 0, w: 0.01, z0: 0, z1: 0.1, th: 0.02, prof: new Float32Array(8), c0: 0, c1: 0, s0: 0, s1: 0, off: { x: 0, v: 0 }, sq: { x: 0, v: 0 }, hop: 0 });
    let frozen = false, X0 = 0, X1 = 0, slabTris = 0, slabDirty = false, slabAnim = 0;
    const S = { x: 0, y: 0, z: 0, d: 0, u: 0, v: 0 };
    const zs = new Float32Array(NZ), ys = new Float32Array(NZ);
    function sampleRow(j, x) {
      const o = j * NX;
      let lo = 0, hi = NX - 1;
      if (x <= fX[o]) {
        hi = 1;
        x = fX[o];
      } else if (x >= fX[o + hi]) {
        lo = hi - 1;
        x = fX[o + hi];
      } else {
        while (hi - lo > 1) {
          const m = lo + hi >> 1;
          if (fX[o + m] <= x) lo = m;
          else hi = m;
        }
      }
      const a = o + lo, b = o + lo + 1, den = fX[b] - fX[a], t = den > 1e-9 ? clamp((x - fX[a]) / den, 0, 1) : 0;
      S.x = x;
      S.y = fY[a] + (fY[b] - fY[a]) * t;
      S.z = fZ[a] + (fZ[b] - fZ[a]) * t;
      S.d = fD[a] + (fD[b] - fD[a]) * t;
      S.u = uv[a * 2] + (uv[b * 2] - uv[a * 2]) * t;
      S.v = uv[a * 2 + 1] + (uv[b * 2 + 1] - uv[a * 2 + 1]) * t;
    }
    function findQ(c, q) {
      let zl = 1e9, zh = -1e9;
      const NB = loop.length;
      for (let k = 0; k < NB; k++) {
        const n0 = loop[k], n1 = loop[(k + 1) % NB], xa = fX[n0], xb = fX[n1];
        if ((xa - c) * (xb - c) > 0 || xa === xb) continue;
        const t = clamp((c - xa) / (xb - xa), 0, 1), z = fZ[n0] + (fZ[n1] - fZ[n0]) * t;
        const u = uv[n0 * 2] + (uv[n1 * 2] - uv[n0 * 2]) * t, v = uv[n0 * 2 + 1] + (uv[n1 * 2 + 1] - uv[n0 * 2 + 1]) * t;
        if (z < zl) {
          zl = z;
          q[0] = z;
          q[1] = u;
          q[2] = v;
        }
        if (z > zh) {
          zh = z;
          q[3] = z;
          q[4] = u;
          q[5] = v;
        }
      }
      if (zl > zh) {
        q[0] = q[3] = st.cz;
        q[1] = q[4] = 0.5;
        q[2] = q[5] = 0.5;
      }
    }
    function freeze() {
      if (frozen) return;
      commitAll();
      recT = 0;
      for (let n = 0; n < NT; n++) {
        DN[n] += DR[n];
        DR[n] = 0;
      }
      write(false);
      X0 = 1e9;
      X1 = -1e9;
      for (let j = 0; j < NZ; j++) {
        let prev = -1e9;
        for (let i = 0; i < NX; i++) {
          const n = j * NX + i;
          let x = pos[n * 3];
          if (x < prev + 1e-6) x = prev + 1e-6;
          prev = x;
          fX[n] = x;
          fY[n] = pos[n * 3 + 1];
          fZ[n] = pos[n * 3 + 2];
          fD[n] = DN[n];
        }
        if (fX[j * NX] < X0) X0 = fX[j * NX];
        if (fX[j * NX + NX - 1] > X1) X1 = fX[j * NX + NX - 1];
      }
      frozen = true;
      cuts.length = 0;
      for (const p of pieces) {
        p.off.x = 0;
        p.off.v = 0;
        p.sq.x = 0;
        p.sq.v = 0;
        p.hop = 0;
      }
      rebuild();
    }
    function setV(vi, x, y, z, u, v, c, nx) {
      const o = vi * 3;
      sBase[o] = x;
      sBase[o + 1] = y;
      sBase[o + 2] = z;
      sUv[vi * 2] = u;
      sUv[vi * 2 + 1] = v + y / PD.texScale;
      sCol[o] = c;
      sCol[o + 1] = c * (0.985 + 0.015 * c);
      sCol[o + 2] = c * (0.96 + 0.04 * c);
      sNor[o] = nx;
      sNor[o + 1] = nx === 0 ? 1 : 0;
      sNor[o + 2] = 0;
    }
    function rebuild() {
      const m = cuts.length, np = m + 1, total = Math.max(1e-6, X1 - X0), free = NX - np;
      for (let k = 0; k < m; k++) findQ(cuts[k], cutQ[k]);
      let colN = 0;
      for (let p = 0; p < np; p++) {
        const pc = pieces[p];
        pc.a = p ? cuts[p - 1] : X0;
        pc.b = p < m ? cuts[p] : X1;
        const ni = 1 + Math.max(0, Math.floor(free * (pc.b - pc.a) / total));
        pc.c0 = colN;
        if (p > 0) {
          colKind[colN++] = 3;
          colKind[colN++] = 2;
        }
        pc.s0 = colN;
        colKind[colN] = 1;
        colFrac[colN++] = 0;
        for (let k = 1; k <= ni; k++) {
          let t = k / (ni + 1);
          if (np === 1) t = lerp(t, 0.5 - 0.5 * Math.cos(Math.PI * t), 0.6);
          else if (p === 0) t = Math.pow(t, 1.5);
          else if (p === m) t = 1 - Math.pow(1 - t, 1.5);
          colKind[colN] = 0;
          colFrac[colN++] = t;
        }
        pc.s1 = colN;
        colKind[colN] = 1;
        colFrac[colN++] = 1;
        if (p < m) {
          colKind[colN++] = 2;
          colKind[colN++] = 3;
        }
        pc.c1 = colN - 1;
      }
      const shade = PD.dentShade / PE.depthMax;
      for (let j = 0; j < NZ; j++) {
        const o = j * NX, xl = fX[o], xr = fX[o + NX - 1], zmid = (fZ[o] + fZ[o + NX - 1]) / 2;
        for (let p = 0; p < np; p++) {
          const pc = pieces[p], a = pc.a, b = pc.b;
          const crossA = p > 0 && xl <= a && a <= xr, crossB = p < m && xl <= b && b <= xr;
          const inter = (p === 0 || xr >= a) && (p === m || xl <= b);
          let qa = p > 0 ? cutQ[p - 1] : null, qb = p < m ? cutQ[p] : null;
          let qaO = 0, qbO = 0;
          if (qa) qaO = zmid < (qa[0] + qa[3]) / 2 ? 0 : 3;
          if (qb) qbO = zmid < (qb[0] + qb[3]) / 2 ? 0 : 3;
          if (!qa) {
            qa = qb;
            qaO = qbO;
          }
          if (!qb) {
            qb = qa;
            qbO = qaO;
          }
          const xqa = p > 0 ? a : b, xqb = p < m ? b : a;
          const A = Math.max(a, xl), B = Math.min(b, xr);
          for (let c = pc.c0; c <= pc.c1; c++) {
            const kind = colKind[c], vi = c * NZ + j, left = c < pc.s0, right = c > pc.s1;
            if (left || right) {
              const cross = left ? crossA : crossB, xc = left ? a : b, q = left ? qa : qb, qo = left ? qaO : qbO;
              if (cross) {
                sampleRow(j, xc);
                setV(vi, xc, kind === 3 ? 0 : S.y, S.z, S.u, S.v, kind === 3 ? 0.58 : 0.98, left ? -1 : 1);
              } else setV(vi, xc, 0, q[qo], q[qo + 1], q[qo + 2], kind === 3 ? 0.58 : 0.98, left ? -1 : 1);
              continue;
            }
            const t = colFrac[c];
            if (!inter) {
              if (!qa) {
                setV(vi, xl, 0, fZ[o], uv[o * 2], uv[o * 2 + 1], 1, 0);
                continue;
              }
              setV(vi, lerp(xqa, xqb, t), 0, lerp(qa[qaO], qb[qbO], t), lerp(qa[qaO + 1], qb[qbO + 1], t), lerp(qa[qaO + 2], qb[qbO + 2], t), 1, 0);
              continue;
            }
            sampleRow(j, kind === 1 ? c === pc.s0 ? crossA ? a : xl : crossB ? b : xr : lerp(A, B, t));
            let cc = (1 - clamp(S.d * shade, -0.04, 0.4)) * (S.y < BASE_H ? 1 - BASE_AO * (1 - S.y / BASE_H) * (1 - S.y / BASE_H) : 1);
            if (kind === 1 && (c === pc.s0 && crossA || c === pc.s1 && crossB)) cc *= 0.93;
            setV(vi, S.x, S.y, S.z, S.u, S.v, cc, 0);
            sUv[vi * 2 + 1] = S.v;
          }
        }
      }
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
            if (!(l > 1e-12)) {
              nx = 0;
              ny = 1;
              nz = 0;
              l = 1;
            }
            const o = (c * NZ + j) * 3;
            sNor[o] = nx / l;
            sNor[o + 1] = ny / l;
            sNor[o + 2] = nz / l;
          }
        }
      }
      let io = 0;
      for (let p = 0; p < np; p++) {
        const pc = pieces[p];
        for (let c = pc.c0; c < pc.c1; c++) for (let j = 0; j < NZ - 1; j++) {
          const a = c * NZ + j, b = a + NZ, cc = a + 1, d = b + 1;
          sIdx[io++] = a;
          sIdx[io++] = cc;
          sIdx[io++] = b;
          sIdx[io++] = b;
          sIdx[io++] = cc;
          sIdx[io++] = d;
        }
      }
      slabTris = io / 3;
      slabGeo.setDrawRange(0, io);
      slabGeo.index.needsUpdate = true;
      slabGeo.attributes.normal.needsUpdate = true;
      slabGeo.attributes.color.needsUpdate = true;
      slabGeo.attributes.uv.needsUpdate = true;
      for (let p = 0; p < np; p++) {
        const pc = pieces[p];
        pc.cx = (pc.a + pc.b) / 2;
        pc.w = pc.b - pc.a;
        let cnt = 0;
        for (let j = 0; j < NZ; j++) {
          const o = j * NX;
          if (fX[o] > pc.cx || fX[o + NX - 1] < pc.cx) continue;
          sampleRow(j, pc.cx);
          zs[cnt] = S.z;
          ys[cnt] = S.y;
          cnt++;
        }
        if (cnt < 2) {
          pc.z0 = st.cz - 0.03;
          pc.z1 = st.cz + 0.03;
          pc.th = st.maxH * 0.5;
          pc.prof.fill(pc.th);
          continue;
        }
        let z0 = 1e9, z1 = -1e9;
        for (let k = 0; k < cnt; k++) {
          if (zs[k] < z0) z0 = zs[k];
          if (zs[k] > z1) z1 = zs[k];
        }
        pc.z0 = z0;
        pc.z1 = z1;
        let acc = 0;
        for (let q = 0; q < 8; q++) {
          const z = z0 + (z1 - z0) * (q + 0.5) / 8;
          let k = 0;
          while (k < cnt - 2 && zs[k + 1] < z) k++;
          const den = zs[k + 1] - zs[k], t = Math.abs(den) > 1e-9 ? clamp((z - zs[k]) / den, 0, 1) : 0;
          pc.prof[q] = Math.max(2e-3, ys[k] + (ys[k + 1] - ys[k]) * t);
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
          sPos[o] = sBase[o] + off;
          sPos[o + 1] = sBase[o + 1] * sy + hop;
          sPos[o + 2] = sBase[o + 2];
        }
      }
      slabGeo.attributes.position.needsUpdate = true;
      slabDirty = false;
    }
    function cut(xw, zw) {
      if (mode === "hidden" || dropT < 1 || !Number.isFinite(xw + zw)) return -1;
      const x = xw - OX, z = zw - OZ;
      if (!frozen) {
        if (dirty) write(false);
        if (x < st.x0 + PC.minPieceWidth || x > st.x1 - PC.minPieceWidth || z < st.z0 - PC.zMargin || z > st.z1 + PC.zMargin) return -1;
        freeze();
      }
      const m = cuts.length;
      let p = 0;
      while (p < m && cuts[p] < x) p++;
      const xc = x - pieces[p].off.x;
      const a = p ? cuts[p - 1] : X0, b = p < m ? cuts[p] : X1;
      if (m + 1 >= MAXN || z < st.z0 - PC.zMargin || z > st.z1 + PC.zMargin || xc - a < PC.minPieceWidth || b - xc < PC.minPieceWidth) {
        if (mode === "dough") frozen = false;
        return -1;
      }
      cuts.splice(p, 0, xc);
      for (let q = m + 1; q > p; q--) {
        const s = pieces[q - 1], d = pieces[q];
        d.off.x = s.off.x;
        d.off.v = s.off.v;
        d.sq.x = s.sq.x;
        d.sq.v = s.sq.v;
      }
      pieces[p].sq.v -= 2.2;
      pieces[p + 1].sq.v -= 2.2;
      pieces[p].off.v -= 0.12;
      pieces[p + 1].off.v += 0.12;
      mode = "slab";
      mesh.visible = false;
      slabMesh.visible = true;
      rebuild();
      slabAnim = 0.8;
      jel.v -= 0.5;
      return Math.min(xc - a, b - xc);
    }
    function place() {
      const j = clamp(jel.x, -0.4, 0.3), sxz = 1 - 0.45 * j, sy = 1 + j;
      group.scale.set(sxz, sy, sxz);
      group.position.set(OX + st.cx * (1 - sxz), OY + dropY, OZ + st.cz * (1 - sxz));
      group.updateMatrixWorld(true);
    }
    function update(dt, time, hinting, hopAt) {
      if (mode === "hidden") return;
      if (dropT < 1) {
        const D = PD.drop;
        dropT = Math.min(1, dropT + dt / D.total);
        const tf = dropT * D.total / D.fall;
        if (tf < 1) {
          dropY = D.height * (1 - tf * tf);
          jel.x = 0.1;
          jel.v = 0;
        } else {
          dropY = 0;
          if (!landedKick) {
            landedKick = true;
            jel.v = -9;
          }
        }
      } else dropY = 0;
      spring(jel, 0, WJ, PD.jelly.zeta, dt);
      jel.x = clamp(jel.x, -0.4, 0.3);
      rollIdle += dt;
      if (mode === "dough") {
        if (dent) {
          dent.t += dt;
          dent.a = easeOutBack(dent.t / PE.growTime);
          dirty = true;
          if (dent.released && dent.t >= PE.growTime) commitDent();
        }
        if (pull && !pull.active) {
          pull.t += dt;
          dirty = true;
          if (pull.t >= PP.settle) write(true);
        }
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
        bounds.x0 = OX + st.x0;
        bounds.x1 = OX + st.x1;
        bounds.z0 = OZ + st.z0;
        bounds.z1 = OZ + st.z1;
        bounds.h = st.maxH;
      } else {
        const np = cuts.length + 1;
        const w1 = 2 * Math.PI / 0.2, w2 = 2 * Math.PI / 0.22;
        let moving = slabAnim > 0;
        slabAnim -= dt;
        for (let p = 0; p < np; p++) {
          const pc = pieces[p], target = PC.gap * (p - (np - 1) / 2);
          if (moving || Math.abs(pc.off.x - target) > 1e-5) {
            spring(pc.off, target, w1, 0.5, dt);
            spring(pc.sq, 0, w2, 0.28, dt);
            pc.sq.x = clamp(pc.sq.x, -0.3, 0.3);
            slabDirty = true;
          }
          const hop = hinting ? hopAt(p * 0.06) * P.hint.hopHeight * 1.3 : 0;
          if (hop !== pc.hop) {
            pc.hop = hop;
            slabDirty = true;
          }
        }
        if (slabDirty) writeSlab();
        const sxz = 1 - 0.45 * jel.x, sy = 1 + jel.x;
        group.scale.set(sxz, sy, sxz);
        group.position.set(OX + st.cx * (1 - sxz), OY, OZ + st.cz * (1 - sxz));
        bounds.x0 = OX + X0 + pieces[0].off.x;
        bounds.x1 = OX + X1 + pieces[np - 1].off.x;
        bounds.z0 = OZ + st.z0;
        bounds.z1 = OZ + st.z1;
        bounds.h = st.maxH;
      }
      group.updateMatrixWorld(true);
    }
    function pieceOut(p, out) {
      const pc = pieces[p];
      out.x = OX + pc.cx + pc.off.x;
      out.z0 = OZ + pc.z0;
      out.z1 = OZ + pc.z1;
      out.y = OY;
      out.w = pc.w;
      out.th = pc.th;
      out.prof = pc.prof;
      return out;
    }
    reset(0);
    return {
      group,
      bounds,
      grabPos,
      get mode() {
        return mode;
      },
      get lift() {
        return dropY;
      },
      get cx() {
        return OX + st.cx;
      },
      get cz() {
        return OZ + st.cz;
      },
      get count() {
        return frozen ? cuts.length + 1 : 1;
      },
      get cutCount() {
        return cuts.length;
      },
      get landed() {
        return dropT >= 1 || landedKick;
      },
      get dropping() {
        return dropT < 1;
      },
      get stretching() {
        return !!(pull && pull.active && pull.moved);
      },
      reset,
      grab,
      drag,
      release,
      roll,
      flatness,
      cut,
      freeze,
      pieceOut,
      update,
      finishDrop() {
        dropT = 1;
        dropY = 0;
      },
      hide() {
        mode = "hidden";
        mesh.visible = false;
        slabMesh.visible = false;
        pull = null;
        dent = null;
      },
      kick(v) {
        jel.v += v;
      },
      tris() {
        return mode === "dough" ? TRIS : mode === "slab" ? slabTris : 0;
      },
      bytes() {
        return pos.byteLength * 3 + uv.byteLength + geo.index.array.byteLength + sPos.byteLength * 3 + sUv.byteLength + sIdx.byteLength;
      },
      dispose() {
        geo.dispose();
        slabGeo.dispose();
        if (group.parent) group.parent.remove(group);
      }
    };
  }

  // app/hero/noodles.js
  function createNoodles(THREE, Q, P, LY, material, MAXN, env) {
    const PN = P.noodle, K = Math.max(6, PN.K & ~1), M = K - 2 >> 1, SEG = Q.seg, RAD = Q.rad, RING = RAD + 1;
    const VPN = (SEG + 1) * RING + 2, IPN = SEG * RAD * 6 + RAD * 6;
    const TOP = LY.board.center.y, G = P.g, TAU = Math.PI * 2;
    const potC = LY.pot.center, potR = LY.pot.radius;
    const nPos = new Float32Array(MAXN * VPN * 3), nNor = new Float32Array(MAXN * VPN * 3), nUv = new Float32Array(MAXN * VPN * 2);
    const nIdx = new Uint16Array(MAXN * IPN);
    for (let m = 0; m < MAXN; m++) {
      const vo = m * VPN;
      let io = m * IPN;
      for (let s = 0; s < SEG; s++) for (let r = 0; r < RAD; r++) {
        const a = vo + s * RING + r, b = a + 1, c = a + RING, d = c + 1;
        nIdx[io++] = a;
        nIdx[io++] = c;
        nIdx[io++] = b;
        nIdx[io++] = b;
        nIdx[io++] = c;
        nIdx[io++] = d;
      }
      const c0 = vo + (SEG + 1) * RING, c1 = c0 + 1, e = vo + SEG * RING;
      for (let r = 0; r < RAD; r++) {
        nIdx[io++] = c0;
        nIdx[io++] = vo + r;
        nIdx[io++] = vo + r + 1;
      }
      for (let r = 0; r < RAD; r++) {
        nIdx[io++] = c1;
        nIdx[io++] = e + r + 1;
        nIdx[io++] = e + r;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(nPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("normal", new THREE.BufferAttribute(nNor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(nUv, 2));
    geo.setIndex(new THREE.BufferAttribute(nIdx, 1));
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.name = "hero-noodles";
    const EXP = 0.55;
    const cxr = new Float32Array(RING), cyr = new Float32Array(RING), ncr = new Float32Array(RING), nsr = new Float32Array(RING);
    for (let r = 0; r <= RAD; r++) {
      const a = r % RAD / RAD * TAU, c = Math.cos(a), s = Math.sin(a);
      cxr[r] = Math.sign(c) * Math.pow(Math.abs(c), EXP);
      cyr[r] = Math.sign(s) * Math.pow(Math.abs(s), EXP);
      ncr[r] = Math.sign(c) * Math.pow(Math.abs(c), 2 - EXP);
      nsr[r] = Math.sign(s) * Math.pow(Math.abs(s), 2 - EXP);
    }
    const crW = new Float32Array((SEG + 1) * 4), crI = new Uint8Array((SEG + 1) * 4);
    for (let s = 0; s <= SEG; s++) {
      const f = s / SEG * (K - 1), k = Math.min(K - 2, Math.floor(f));
      crWeights(f - k, crW, s * 4);
      crI[s * 4] = Math.max(0, k - 1);
      crI[s * 4 + 1] = k;
      crI[s * 4 + 2] = k + 1;
      crI[s * 4 + 3] = Math.min(K - 1, k + 2);
    }
    const C = new Float32Array((SEG + 1) * 3);
    const mk = (i) => ({
      w: 0.01,
      h: 0.01,
      L: 0.18,
      pw: 0.01,
      prof: new Float32Array(8),
      morph: 1,
      vis: 1,
      uvDirty: true,
      pts: new Float32Array(K * 3),
      from: new Float32Array(K * 3),
      tgt: new Float32Array(K * 3),
      wref: new Float32Array([0, 1, 0]),
      wfrom: new Float32Array([0, 1, 0]),
      wcur: new Float32Array([0, 1, 0]),
      w0: new Float32Array([0, 1, 0]),
      bob: new Float32Array(2 * M * 4),
      bobInit: false,
      r1: hash(i * 3.1 + 1),
      r2: hash(i * 5.3 + 2),
      r3: hash(i * 7.7 + 3),
      layX: 0,
      potR: 0.06,
      potPhi: 0,
      potD: 0.02,
      potSp: 0,
      potT: 9,
      netA: 0,
      netB: 3,
      feed: 1,
      bwR: 0.05,
      bwTh: 0,
      bwP: 2e-3,
      bwLayer: 0,
      bwMax: 0.06,
      bwRise: 0
    });
    const list = [];
    for (let i = 0; i < MAXN; i++) list.push(mk(i));
    let count = 0, hAvg = 0.012;
    let place = "board", trans = null, force = true;
    const lay = { cx: LY.board.center.x, cz: LY.board.center.z, ph: 0, span: 0.3, amp: 0 };
    let DT = 0, TIME = 0, potOmega = 0, netHang = 1, wasInWater = false, fill = 0, fillOn = false, cook = 0, splashed = false, dropped = false;
    let hopOn = false, hopFn = null, eating = false, mouth = null;
    const hold = new Float32Array(3), netP = new Float32Array(3), mouthP = new Float32Array(3), tmpA = new Float32Array(K * 3), v3 = new Float32Array(3);
    let netInWater = false;
    const bowlE = new Float32Array(16), bowlLast = new Float32Array(3);
    const center = new THREE.Vector3(), bounds = { x0: 0, x1: 0, z0: 0, z1: 0, y: TOP };
    const evPos = () => center.clone();
    const set = (a, k, x, y, z) => {
      const o = k * 3;
      a[o] = x;
      a[o + 1] = y;
      a[o + 2] = z;
    };
    function calcAvg() {
      let s = 0;
      for (let i = 0; i < count; i++) s += list[i].h;
      hAvg = count ? s / count : 0.012;
    }
    function clear() {
      count = 0;
      trans = null;
      place = "board";
      fill = 0;
      fillOn = false;
      cook = 0;
      eating = false;
      mouth = null;
      potOmega = 0;
      geo.setDrawRange(0, 0);
      force = true;
    }
    function addFromPiece(pc) {
      if (count >= MAXN) return;
      const nd = list[count], i = count++;
      nd.pw = Math.max(PN.wMin, pc.w);
      nd.w = clamp(pc.w, PN.wMin, PN.wMax);
      nd.h = Math.min(clamp(pc.th * PN.hScale, PN.hMin, PN.hMax), nd.w);
      const L0 = Math.max(PN.lMin, pc.z1 - pc.z0);
      nd.L = Math.min(L0 * PN.lenScale * Math.sqrt(nd.pw / nd.w), Math.max(L0, PN.lMax - PN.lMaxPerWidth * Math.max(0, nd.w - 0.012)));
      nd.prof.set(pc.prof);
      nd.morph = 0;
      nd.vis = 1;
      nd.uvDirty = true;
      nd.bobInit = false;
      nd.feed = 1;
      nd.potT = 9;
      nd.r1 = hash(i * 3.1 + nd.L * 91);
      nd.r2 = hash(i * 5.3 + nd.w * 173);
      nd.r3 = hash(i * 7.7 + nd.L * 37);
      const zc = (pc.z0 + pc.z1) / 2;
      for (let k = 0; k < K; k++) set(nd.pts, k, pc.x, pc.y + nd.h / 2, zc + (k / (K - 1) - 0.5) * L0);
      nd.layX = pc.x;
      nd.wref[0] = 0;
      nd.wref[1] = 1;
      nd.wref[2] = 0;
      nd.wcur.set(nd.wref);
      nd.w0.set(nd.wref);
      lay.cz = zc;
      calcAvg();
      force = true;
    }
    function layout(cx, cz) {
      const b = LY.board, gap = P.cut.gap, m = 0.012;
      let W = 0, Lmax = 0;
      for (let i = 0; i < count; i++) {
        W += list[i].w;
        if (list[i].L > Lmax) Lmax = list[i].L;
      }
      W += Math.max(0, count - 1) * gap;
      const x0 = b.center.x - b.sizeX / 2 + m, x1 = b.center.x + b.sizeX / 2 - m, z0 = b.center.z - b.sizeZ / 2 + m, z1 = b.center.z + b.sizeZ / 2 - m;
      lay.span = Math.min(Lmax, z1 - z0);
      const amp = lay.span > 1e-4 ? Math.min(0.05, lay.span / 1.5 / Math.PI * Math.sqrt(Math.max(0, Lmax / lay.span - 1))) : 0;
      lay.amp = amp;
      cx = W + 2 * amp < x1 - x0 ? clamp(cx, x0 + W / 2 + amp, x1 - W / 2 - amp) : (x0 + x1) / 2;
      cz = lay.span < z1 - z0 ? clamp(cz, z0 + lay.span / 2, z1 - lay.span / 2) : (z0 + z1) / 2;
      let x = cx - W / 2;
      for (let i = 0; i < count; i++) {
        const nd = list[i];
        nd.layX = x + nd.w / 2;
        x += nd.w + gap;
      }
      lay.cx = cx;
      lay.cz = cz;
    }
    function cutLaid(x, z) {
      if (place !== "board" || trans && !trans.quiet || count === 0 || count >= MAXN) return -1;
      for (let i = 0; i < count; i++) {
        const nd = list[i], a = nd.layX - nd.w / 2, b = nd.layX + nd.w / 2;
        if (x <= a || x >= b) continue;
        if (z < lay.cz - lay.span / 2 - P.cut.zMargin || z > lay.cz + lay.span / 2 + P.cut.zMargin) return -1;
        const wl = x - a, wr = b - x;
        if (wl < P.cut.minPieceWidth || wr < P.cut.minPieceWidth) return -1;
        const nw = list[count];
        for (let q = count; q > i + 1; q--) list[q] = list[q - 1];
        list[i + 1] = nw;
        count++;
        nw.L = nd.L;
        nw.h = Math.min(nd.h, wr);
        nw.w = nw.pw = wr;
        nw.morph = 1;
        nw.vis = 1;
        nw.uvDirty = true;
        nw.bobInit = false;
        nw.feed = 1;
        nw.potT = 9;
        nw.r1 = hash(nd.r1 * 13.7 + 0.31);
        nw.r2 = hash(nd.r2 * 17.3 + 0.57);
        nw.r3 = hash(nd.r3 * 11.1 + 0.83);
        nd.w = nd.pw = wl;
        nd.h = Math.min(nd.h, wl);
        nd.morph = 1;
        nd.uvDirty = true;
        for (let k = 0; k < K; k++) {
          const o = k * 3;
          nw.pts[o] = nd.pts[o] + wl / 2;
          nw.pts[o + 1] = nd.pts[o + 1];
          nw.pts[o + 2] = nd.pts[o + 2];
          nd.pts[o] -= wr / 2;
        }
        nw.wcur.set(nd.wcur);
        nw.wref.set(nd.wref);
        nw.w0.set(nd.w0);
        calcAvg();
        layout(lay.cx, lay.cz);
        snapshot();
        trans = { kind: "lerp", t: 0, dur: 0.16, stg: 0, arc: 0, quiet: true };
        force = true;
        return Math.min(wl, wr);
      }
      return -1;
    }
    function shapeBoard(i, nd) {
      const kz = lay.span > 1e-4 ? TAU * 1.5 / lay.span : 0, amp = lay.amp, ak = amp * kz;
      const len = Math.min(nd.L / (1 + ak * ak / 4), lay.span), z0 = lay.cz - len / 2, hop = hopOn ? hopFn(i * 0.06) * P.hint.hopHeight * 1.3 : 0;
      for (let k = 0; k < K; k++) {
        const s = k / (K - 1), z = z0 + s * len;
        set(nd.tgt, k, nd.layX + 3e-3 * Math.sin(z * 38 + lay.ph) + amp * Math.sin((z - lay.cz) * kz + lay.ph), TOP + nd.h / 2 + hop, z);
      }
      nd.wref[0] = 0;
      nd.wref[1] = 1;
      nd.wref[2] = 0;
    }
    function stepBobs(nd, leg, ax, az, seg, levels) {
      const bob = nd.bob, c = P.hang.damping;
      const n = DT > 0.034 ? 3 : DT > 0.017 ? 2 : 1, h = DT / n;
      for (let m = 0; m < levels; m++) {
        const o = (leg * M + m) * 4, lm = Math.max(0.02, seg * (m + 1)) * (leg ? 1.12 : 1), w2 = G / lm, maxD = lm * 1.3;
        if (!nd.bobInit) {
          bob[o] = ax;
          bob[o + 1] = az;
          bob[o + 2] = 0;
          bob[o + 3] = 0;
          continue;
        }
        let bx = bob[o], bz = bob[o + 1], vx = bob[o + 2], vz = bob[o + 3];
        for (let s = 0; s < n; s++) {
          vx += (-w2 * (bx - ax) - c * vx) * h;
          vz += (-w2 * (bz - az) - c * vz) * h;
          bx += vx * h;
          bz += vz * h;
        }
        const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
        if (d > maxD) {
          bx = ax + dx / d * maxD;
          bz = az + dz / d * maxD;
          vx *= 0.5;
          vz *= 0.5;
        }
        if (!Number.isFinite(bx + bz + vx + vz)) {
          bx = ax;
          bz = az;
          vx = 0;
          vz = 0;
        }
        bob[o] = bx;
        bob[o + 1] = bz;
        bob[o + 2] = vx;
        bob[o + 3] = vz;
      }
    }
    function dropLeg(nd, leg, px, py, pz, ex, ez, seg, levels, first, splay0) {
      const side = leg ? 1 : -1, ax = px, az = pz, sp = P.hang.splay;
      for (let m = 0; m < levels; m++) {
        const o = (leg * M + m) * 4, lm = Math.max(0.02, seg * (m + 1)) * (leg ? 1.12 : 1);
        const spl = m === 0 ? splay0 : sp[Math.min(m, sp.length - 1)];
        const hx = clamp((nd.bob[o] - ax) / lm, -1.5, 1.5) + side * ex * spl, hz = clamp((nd.bob[o + 1] - az) / lm, -1.5, 1.5) + side * ez * spl;
        const inv = seg / Math.sqrt(hx * hx + 1 + hz * hz);
        px += hx * inv;
        py -= inv;
        pz += hz * inv;
        const fl = env.floorAt(px, pz) + nd.h / 2;
        if (py < fl) {
          const lost = (fl - py) * 0.8;
          py = fl;
          px += side * ex * lost;
          pz += side * ez * lost;
        }
        set(nd.tgt, leg ? first + m : first - m, px, py, pz);
      }
    }
    function shapeHang(i, nd) {
      const yaw = i * 2.4 + nd.r1 * 1.5, ex = Math.cos(yaw), ez = Math.sin(yaw), PH = P.hang;
      const rho = PH.bundle * (0.3 + 0.7 * Math.sqrt((i + 0.5) / count)), oa = yaw + 1.3;
      const a = PH.topGap + nd.h * 0.5, dl = (nd.r2 - 0.5) * PH.uneven;
      const tx = hold[0] + Math.cos(oa) * rho, ty = hold[1] + (i % 3 - 1) * 2e-3, tz = hold[2] + Math.sin(oa) * rho;
      const segA = Math.max(6e-3, (nd.L * (0.5 + dl) - a) / M), segB = Math.max(6e-3, (nd.L * (0.5 - dl) - a) / M);
      set(nd.tgt, M, tx - ex * a, ty, tz - ez * a);
      set(nd.tgt, M + 1, tx + ex * a, ty, tz + ez * a);
      stepBobs(nd, 0, tx - ex * a, tz - ez * a, segA, M);
      stepBobs(nd, 1, tx + ex * a, tz + ez * a, segB, M);
      nd.bobInit = true;
      const sp0 = PH.splay[0] * (0.6 + 0.8 * nd.r3);
      dropLeg(nd, 0, tx - ex * a, ty, tz - ez * a, ex, ez, segA, M, M - 1, sp0);
      dropLeg(nd, 1, tx + ex * a, ty, tz + ez * a, ex, ez, segB, M, M + 2, sp0);
      nd.wref[0] = -ex;
      nd.wref[1] = 0;
      nd.wref[2] = -ez;
    }
    function shapeNet(i, nd) {
      const nx = netP[0], ny = netP[1], nz = netP[2], hg = smooth(netHang), PNt = P.net;
      if (hg < 1) {
        const span = Math.min(nd.L / 0.03, TAU * 1.2), a0 = nd.r1 * TAU + TIME * 0.7;
        for (let k = 0; k < K; k++) {
          const s = k / (K - 1), ang = a0 + s * span, r = 0.014 + 0.026 * s + 4e-3 * Math.sin(TIME * 2.2 + i + s * 5);
          set(tmpA, k, nx + Math.cos(ang) * r, ny - 0.016 - 0.016 * nd.r2 + 4e-3 * Math.sin(TIME * 2.6 + s * 6 + i), nz + Math.sin(ang) * r);
        }
      }
      const al = nd.netA, be = nd.netB, ca = Math.cos(al), sa = Math.sin(al), cb = Math.cos(be), sb = Math.sin(be);
      const Lin = Math.min(PNt.inCup, nd.L * PNt.inCupFrac), seg = Math.max(6e-3, (nd.L - Lin) / 2 / Math.max(1, M - 1));
      const rr = PNt.radius + nd.h * 0.3, ry = ny + PNt.rimY + nd.h / 2 + i % 4 * 15e-4, dip = Math.min(0.032, Lin * 0.33);
      const ax = nx + ca * rr, az = nz + sa * rr, bx = nx + cb * rr, bz = nz + sb * rr;
      set(nd.tgt, M - 1, ax, ry, az);
      set(nd.tgt, M, nx + ca * rr * 0.3, ny - dip, nz + sa * rr * 0.3);
      set(nd.tgt, M + 1, nx + cb * rr * 0.3, ny - dip, nz + sb * rr * 0.3);
      set(nd.tgt, M + 2, bx, ry, bz);
      stepBobs(nd, 0, ax, az, seg, M - 1);
      stepBobs(nd, 1, bx, bz, seg, M - 1);
      nd.bobInit = true;
      dropLeg(nd, 0, ax, ry, az, -ca, -sa, seg, M - 1, M - 2, 0.75);
      dropLeg(nd, 1, bx, ry, bz, cb, sb, seg, M - 1, M + 3, 0.75);
      if (hg < 1) for (let q = 0; q < K * 3; q++) nd.tgt[q] = tmpA[q] + (nd.tgt[q] - tmpA[q]) * hg;
      nd.wref[0] = ca * hg;
      nd.wref[1] = 1 - hg;
      nd.wref[2] = sa * hg;
    }
    function assignPot() {
      for (let i = 0; i < count; i++) {
        const nd = list[i];
        const rmax = Math.max(0.03, potR - 0.022 - nd.w / 2), rmin = Math.min(rmax, Math.max(0.03, nd.L / (TAU * 0.85)));
        nd.potR = lerp(rmin, rmax, (i * 0.618 + nd.r1 * 0.2) % 1);
        nd.potPhi = i * 2.4 + nd.r2 * 2;
        nd.potD = P.pot.depthMin + P.pot.depthVar * nd.r3;
        nd.potSp = (nd.r2 - 0.5) * 0.03;
        nd.potT = 0;
      }
    }
    function shapePot(i, nd) {
      const PT = P.pot, sw = Math.min(1, Math.abs(potOmega) / PT.omegaMax);
      nd.potPhi += (potOmega * (1.25 - 0.5 * nd.potR / potR) + PT.drift * (0.7 + 0.6 * nd.r1)) * DT;
      if (nd.potPhi > 1e3) nd.potPhi -= Math.floor(nd.potPhi / TAU) * TAU;
      const rho = Math.min(nd.potR + 0.012 * sw * sw, potR - 0.014 - nd.w / 2), span = Math.min(nd.L / Math.max(0.02, rho), TAU * 0.92);
      const lam = Math.max(PT.waveLen, nd.L / 2.2), kw = TAU * nd.L / lam, wt = TAU * TIME / PT.wavePeriod, amp = PT.waveAmp * (1 - 0.5 * sw);
      const plunge = PT.plunge * Math.exp(-nd.potT / 0.3) * Math.cos(nd.potT * 8);
      const yMax = potC.y - 6e-3 - nd.h / 2;
      for (let k = 0; k < K; k++) {
        const s = k / (K - 1), ang = nd.potPhi + (s - 0.5) * span;
        const r = clamp(rho + amp * Math.sin(kw * s - wt + nd.r2 * TAU) + (s - 0.5) * (nd.potSp + 0.02 * sw), 0.012, potR - 0.012 - nd.w / 2);
        const y = Math.min(yMax, potC.y - nd.potD * (1 - 0.5 * sw) - plunge + PT.bobAmp * Math.sin(kw * 0.73 * s + wt * 0.76 + nd.r3 * TAU));
        set(nd.tgt, k, potC.x + Math.cos(ang) * r, y, potC.z + Math.sin(ang) * r);
      }
      nd.wref[0] = 0;
      nd.wref[1] = 1;
      nd.wref[2] = 0;
    }
    const coilC = { cy: 0, rs: 0.05, th0: 0, p: 2e-3, L: 0.1, k: 1, i: 0, rise: 0 };
    let bowlLayers = 1, bowlDy = 0;
    const bowlD = { depth: 0.07, bl: 0.045, rB: 0.04, rI: 0.085 };
    function bowlDims() {
      const u = LY.bowl.userData || {}, d = bowlD;
      d.depth = u.depth > 0 ? u.depth : 0.07;
      d.bl = u.brothLevel > 0 ? u.brothLevel : 0.045;
      d.rB = u.bottomRadius > 0 ? u.bottomRadius : 0.04;
      d.rI = u.innerRadius > 0 ? u.innerRadius : 0.085;
      return d;
    }
    const bowlRin = (d, y) => d.rB + (d.rI - d.rB) * (1 - Math.pow(1 - clamp(y / d.depth, 0, 1), 2.2));
    function packBowl() {
      const d = bowlDims(), PB = P.bowl, yBot = hAvg / 2 + 4e-3, yFloat = d.bl + PB.floatAbove + 0.4 * hAvg, gap = 15e-4;
      const maxTh = TAU * PB.maxTurns * (K - 1) / 9;
      let dy = hAvg * 0.9;
      for (let pass = 0; pass < 2; pass++) {
        let layer = 0, r = 0, th = 0, prevW = 0;
        for (let i = 0; i < count; i++) {
          const nd = list[i], w = nd.w, rmin = Math.max(PB.r0, w / 2 + 3e-3);
          const pNat = (w + gap) / TAU;
          let p = pNat, rs = r - Math.max(0, (w - prevW) / 2);
          const room = rs * rs - 2 * p * nd.L;
          if (i === 0 || room < rmin * rmin || (rs - Math.sqrt(room)) / p > maxTh) {
            if (i > 0) layer++;
            const yl = pass === 0 ? yBot + layer * dy : yFloat - (bowlLayers - 1 - layer) * dy;
            nd.bwMax = Math.max(0.02, Math.min(bowlRin(d, Math.max(yl, yBot)) - 4e-3, d.rI * PB.rimFill));
            rs = nd.bwMax - w / 2;
            if (rs < rmin + 4e-3) rs = rmin + 4e-3;
            if (rs * rs - 2 * p * nd.L < rmin * rmin) p = Math.max(1e-5, (rs * rs - rmin * rmin) / (2 * nd.L));
            th = layer * 2.1 + nd.r1;
          } else nd.bwMax = list[i - 1].bwMax;
          nd.bwR = rs;
          nd.bwTh = th;
          nd.bwP = p;
          nd.bwLayer = layer;
          nd.bwRise = nd.h * 0.9 * (1 - p / pNat) / TAU;
          const dth = (rs - Math.sqrt(Math.max(0, rs * rs - 2 * p * nd.L))) / p;
          r = rs - p * dth;
          th += dth + (4e-3 + w * 0.3) / Math.max(r, 0.012);
          prevW = w;
        }
        bowlLayers = layer + 1;
        dy = bowlLayers > 1 ? Math.min(hAvg * 0.9, Math.max(2e-3, (yFloat - yBot) / (bowlLayers - 1))) : 0;
      }
      bowlDy = dy;
    }
    function coilSetup(i, nd) {
      const d = bowlDims(), yBot = hAvg / 2 + 4e-3;
      const yTop = Math.max(yBot + (bowlLayers - 1) * bowlDy, d.bl * fill + P.bowl.floatAbove + 0.4 * hAvg);
      const c = coilC;
      c.cy = yTop - (bowlLayers - 1 - nd.bwLayer) * bowlDy;
      c.rs = nd.bwR;
      c.th0 = nd.bwTh;
      c.p = nd.bwP;
      c.L = nd.L;
      c.i = i;
      c.rise = nd.bwRise;
      c.k = Math.min(1, Math.max(0.3, (bowlRin(d, c.cy) - 4e-3) / nd.bwMax));
    }
    function coil(s, out, k) {
      const c = coilC, dth = c.p > 1e-7 ? (c.rs - Math.sqrt(Math.max(0, c.rs * c.rs - 2 * c.p * s * c.L))) / c.p : s * c.L / c.rs;
      const r = (c.rs - c.p * dth) * c.k, th = c.th0 + dth;
      set(out, k, Math.cos(th) * r, c.cy + c.rise * dth + 2e-3 * Math.sin(2 * th + c.i), Math.sin(th) * r);
    }
    function shapeBowl(i, nd) {
      coilSetup(i, nd);
      const p = nd.feed, e = bowlE;
      for (let k = 0; k < K; k++) {
        const s = k / (K - 1), o = k * 3;
        if (s <= p) coil(s, nd.tgt, k);
        else {
          coil(p, nd.tgt, k);
          const up = (s - p) * nd.L;
          nd.tgt[o] += 0.1 * up * Math.sin(TIME * 7 + i * 1.3 + s * 5);
          nd.tgt[o + 1] += up;
          nd.tgt[o + 2] += 0.1 * up * Math.cos(TIME * 6 + i * 1.7 + s * 4);
        }
        const x = nd.tgt[o], y = nd.tgt[o + 1], z = nd.tgt[o + 2];
        nd.tgt[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        nd.tgt[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        nd.tgt[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      nd.wref[0] = e[4];
      nd.wref[1] = e[5];
      nd.wref[2] = e[6];
    }
    function evalFrom(nd, t, out) {
      const f = clamp(t, 0, 1) * (K - 1), k = Math.min(K - 2, Math.floor(f));
      crWeights(f - k, v3w, 0);
      const a = Math.max(0, k - 1) * 3, b = k * 3, c = (k + 1) * 3, d = Math.min(K - 1, k + 2) * 3, p = nd.from;
      out[0] = v3w[0] * p[a] + v3w[1] * p[b] + v3w[2] * p[c] + v3w[3] * p[d];
      out[1] = v3w[0] * p[a + 1] + v3w[1] * p[b + 1] + v3w[2] * p[c + 1] + v3w[3] * p[d + 1];
      out[2] = v3w[0] * p[a + 2] + v3w[1] * p[b + 2] + v3w[2] * p[c + 2] + v3w[3] * p[d + 2];
    }
    const v3w = new Float32Array(4);
    function shapeEat(i, nd, q) {
      const hx = nd.from[(K - 1) * 3], hy = nd.from[(K - 1) * 3 + 1], hz = nd.from[(K - 1) * 3 + 2];
      const mx = mouthP[0], my = mouthP[1], mz = mouthP[2];
      const LB = Math.max(0.02, Math.hypot(mx - hx, my - hy, mz - hz) * 1.1), L = nd.L, adv = q * (L + LB) * 1.03;
      const cxm = (hx + mx) / 2, cym = Math.max(hy, my) + P.eat.lift, czm = (hz + mz) / 2;
      const wob = P.eat.wobble * Math.sin(TIME * 26 + i * 2.1) * (q > 0 && q < 1 ? 1 : 0);
      for (let k = 0; k < K; k++) {
        const s = k / (K - 1), a = s * L + adv;
        if (a <= L) {
          evalFrom(nd, a / L, v3);
          set(nd.pts, k, v3[0], v3[1], v3[2]);
        } else if (a < L + LB) {
          const u = (a - L) / LB, iu = 1 - u, w = wob * Math.sin(u * Math.PI);
          set(nd.pts, k, iu * iu * hx + 2 * iu * u * cxm + u * u * mx + w, iu * iu * hy + 2 * iu * u * cym + u * u * my, iu * iu * hz + 2 * iu * u * czm + u * u * mz);
        } else set(nd.pts, k, mx, my, mz);
      }
      nd.vis = q >= 1 ? 0 : 1;
    }
    function profAt(nd, sa) {
      const q = sa * 8 - 0.5, q0 = clamp(Math.floor(q), 0, 7), q1 = Math.min(7, q0 + 1), t = clamp(q - q0, 0, 1);
      const e = Math.min(1, Math.min(sa, 1 - sa) * 16);
      return (nd.prof[q0] + (nd.prof[q1] - nd.prof[q0]) * t) * (0.35 + 0.65 * Math.sqrt(e));
    }
    function writeTube(m, nd) {
      const pts = nd.pts, vo = m * VPN;
      for (let s = 0; s <= SEG; s++) {
        const o = s * 4, a = crI[o] * 3, b = crI[o + 1] * 3, c = crI[o + 2] * 3, d = crI[o + 3] * 3, w0 = crW[o], w1 = crW[o + 1], w2 = crW[o + 2], w3 = crW[o + 3];
        C[s * 3] = w0 * pts[a] + w1 * pts[b] + w2 * pts[c] + w3 * pts[d];
        C[s * 3 + 1] = w0 * pts[a + 1] + w1 * pts[b + 1] + w2 * pts[c + 1] + w3 * pts[d + 1];
        C[s * 3 + 2] = w0 * pts[a + 2] + w1 * pts[b + 2] + w2 * pts[c + 2] + w3 * pts[d + 2];
      }
      const morph = nd.morph, wd = morph >= 1 ? nd.w : lerp(nd.pw, nd.w, morph), h = nd.h, L = nd.L, vis = nd.vis;
      let Tx = 0, Ty = 0, Tz = 1, Wx = nd.wcur[0], Wy = nd.wcur[1], Wz = nd.wcur[2];
      for (let s = 0; s <= SEG; s++) {
        const ia = (s > 0 ? s - 1 : 0) * 3, ib = (s < SEG ? s + 1 : SEG) * 3, ic = s * 3;
        const tx = C[ib] - C[ia], ty = C[ib + 1] - C[ia + 1], tz = C[ib + 2] - C[ia + 2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tl > 1e-8) {
          Tx = tx / tl;
          Ty = ty / tl;
          Tz = tz / tl;
        }
        let d = Wx * Tx + Wy * Ty + Wz * Tz;
        Wx -= Tx * d;
        Wy -= Ty * d;
        Wz -= Tz * d;
        let wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz);
        if (wl < 1e-4) {
          Wx = nd.w0[0];
          Wy = nd.w0[1];
          Wz = nd.w0[2];
          d = Wx * Tx + Wy * Ty + Wz * Tz;
          Wx -= Tx * d;
          Wy -= Ty * d;
          Wz -= Tz * d;
          wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz);
          if (wl < 1e-4) {
            if (Math.abs(Ty) < 0.9) {
              Wx = -Tx * Ty;
              Wy = 1 - Ty * Ty;
              Wz = -Tz * Ty;
            } else {
              Wx = 1 - Tx * Tx;
              Wy = -Ty * Tx;
              Wz = -Tz * Tx;
            }
            wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz) || 1;
          }
        }
        Wx /= wl;
        Wy /= wl;
        Wz /= wl;
        if (s === 0) {
          nd.w0[0] = Wx;
          nd.w0[1] = Wy;
          nd.w0[2] = Wz;
        }
        const Ux = Ty * Wz - Tz * Wy, Uy = Tz * Wx - Tx * Wz, Uz = Tx * Wy - Ty * Wx;
        const sa = s / SEG, th = morph >= 1 ? h : lerp(profAt(nd, sa), h, morph);
        const dEnd = Math.min(sa, 1 - sa) * L, re = Math.min(th, wd) * 0.6 + 1e-5, q = 1 - dEnd / re;
        let sc = (dEnd >= re ? 1 : 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - q * q))) * vis;
        if (eating) sc *= smooth(Math.hypot(C[ic] - mouthP[0], C[ic + 1] - mouthP[1], C[ic + 2] - mouthP[2]) / 0.03);
        const hw = wd / 2 * sc, hh = th / 2 * sc, off = (th - h) / 2;
        const px = C[ic] + Wx * off, py = C[ic + 1] + Wy * off, pz = C[ic + 2] + Wz * off;
        let o = (vo + s * RING) * 3;
        for (let r = 0; r <= RAD; r++, o += 3) {
          const a = cxr[r] * hw, b = cyr[r] * hh;
          nPos[o] = px + Ux * a + Wx * b;
          nPos[o + 1] = py + Uy * a + Wy * b;
          nPos[o + 2] = pz + Uz * a + Wz * b;
          const na = ncr[r] * hh, nb = nsr[r] * hw;
          let nx = Ux * na + Wx * nb, ny = Uy * na + Wy * nb, nz = Uz * na + Wz * nb;
          const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nl > 1e-9) {
            nx /= nl;
            ny /= nl;
            nz /= nl;
          } else {
            nx = Wx;
            ny = Wy;
            nz = Wz;
          }
          nNor[o] = nx;
          nNor[o + 1] = ny;
          nNor[o + 2] = nz;
        }
        if (s === 0 || s === SEG) {
          const sg = s === 0 ? -1 : 1, bulge = Math.min(th, wd) * 0.3 * sc, c = (vo + (SEG + 1) * RING + (s === 0 ? 0 : 1)) * 3;
          nPos[c] = px + Tx * sg * bulge;
          nPos[c + 1] = py + Ty * sg * bulge;
          nPos[c + 2] = pz + Tz * sg * bulge;
          nNor[c] = Tx * sg;
          nNor[c + 1] = Ty * sg;
          nNor[c + 2] = Tz * sg;
        }
      }
      if (nd.uvDirty) {
        nd.uvDirty = false;
        const us = clamp((nd.w + nd.h) * 2 / PN.texScale, 0.08, 0.6), u0 = nd.r1 * 0.9, vs = L / PN.texScale, v0 = nd.r2;
        for (let s = 0; s <= SEG; s++) for (let r = 0; r <= RAD; r++) {
          const q2 = (vo + s * RING + r) * 2;
          nUv[q2] = u0 + r / RAD * us;
          nUv[q2 + 1] = v0 + s / SEG * vs;
        }
        const q = (vo + (SEG + 1) * RING) * 2;
        nUv[q] = u0;
        nUv[q + 1] = v0;
        nUv[q + 2] = u0;
        nUv[q + 3] = v0 + vs;
        geo.attributes.uv.needsUpdate = true;
      }
    }
    function measure() {
      let sx = 0, sy = 0, sz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, nvis = 0;
      for (let i = 0; i < count; i++) {
        const nd = list[i], p = nd.pts, hw = nd.w / 2;
        if (nd.vis <= 0) continue;
        for (let q = 0; q < K * 3; q += 3) {
          sx += p[q];
          sy += p[q + 1];
          sz += p[q + 2];
          nvis++;
          if (p[q] - hw < x0) x0 = p[q] - hw;
          if (p[q] + hw > x1) x1 = p[q] + hw;
          if (p[q + 2] < z0) z0 = p[q + 2];
          if (p[q + 2] > z1) z1 = p[q + 2];
        }
      }
      if (nvis) {
        center.set(sx / nvis, sy / nvis, sz / nvis);
        bounds.x0 = x0;
        bounds.x1 = x1;
        bounds.z0 = z0;
        bounds.z1 = z1;
        bounds.y = sy / nvis;
      }
    }
    function snapshot() {
      for (let i = 0; i < count; i++) {
        const nd = list[i];
        nd.from.set(nd.pts);
        nd.wfrom.set(nd.wcur);
      }
    }
    function begin(p, opts) {
      snapshot();
      measure();
      const fromY = center.y, PM = P.move, prev = place;
      place = p;
      eating = false;
      splashed = false;
      dropped = false;
      const tr = trans = { kind: "lerp", t: 0, dur: PM[p] || 0.3, stg: 0, arc: 0, quiet: false, ease: 0 };
      const arcTo = (toY, clearY) => {
        if (prev === "pot" || p === "pot") clearY = Math.max(clearY, potC.y + P.pot.rimAbove + 0.07);
        tr.arc = fromY < clearY - 0.02 ? Math.max(0, clearY - Math.min(fromY, toY)) * 1.4 : 0;
      };
      if (p === "hand") {
        for (let i = 0; i < count; i++) list[i].bobInit = false;
        tr.stg = 6e-3;
        tr.ease = 1;
        arcTo(hold[1] - 0.05, 0);
      } else if (p === "net") {
        for (let i = 0; i < count; i++) {
          const nd = list[i];
          nd.bobInit = false;
          nd.netA = i * 2.4 + nd.r1;
          nd.netB = nd.netA + Math.PI + (nd.r2 - 0.5) * 1.3;
        }
        netHang = netInWater ? 0 : 1;
        wasInWater = netInWater;
        if (!netInWater) arcTo(netP[1], netP[1] + 0.05);
        env.emit("scoop", { position: evPos() });
      } else if (p === "pot") {
        assignPot();
        tr.stg = 0.02;
        tr.ease = 2;
        arcTo(potC.y, potC.y + P.pot.rimAbove + 0.07);
      } else if (p === "board") {
        layout(center.x, center.z);
        lay.ph = (lay.ph + 1.7) % TAU;
        tr.stg = 0.012;
        arcTo(TOP, TOP + 0.05);
      } else if (p === "bowl") {
        tr.kind = "bowl";
        tr.stg = Math.min(P.bowl.feedStagger, 0.4 / Math.max(1, count));
        for (let i = 0; i < count; i++) list[i].feed = 0;
        packBowl();
        const by = LY.bowl.matrixWorld.elements[13] + bowlDims().depth;
        if (Number.isFinite(by)) arcTo(by, by + 0.05);
      } else if (p === "eaten") {
        tr.kind = "eat";
        tr.dur = Math.max(0.2, opts && opts.duration || P.eat.duration);
        mouth = opts && opts.mouth && opts.mouth.matrixWorld ? opts.mouth : null;
        eating = true;
        mouthP[0] = center.x;
        mouthP[1] = center.y + 0.25;
        mouthP[2] = center.z - 0.2;
      }
      force = true;
    }
    function update(dt, input, hinting, hopAt) {
      if (count === 0) {
        geo.setDrawRange(0, 0);
        return;
      }
      DT = dt;
      TIME = input.time;
      const ih = input.hold, inn = input.net;
      if (ih && Number.isFinite(ih.x + ih.y + ih.z)) {
        hold[0] = ih.x;
        hold[1] = ih.y;
        hold[2] = ih.z;
      }
      if (inn && Number.isFinite(inn.x + inn.y + inn.z)) {
        netP[0] = inn.x;
        netP[1] = inn.y;
        netP[2] = inn.z;
      }
      netInWater = !!input.netInWater;
      hopOn = hinting && place === "board" && !trans;
      hopFn = hopAt;
      const st = input.stir;
      if (st && st.active && place === "pot") {
        const rx = st.point.x - potC.x, rz = st.point.z - potC.z, r = Math.max(0.03, Math.hypot(rx, rz));
        const tang = (rx * st.velocity.z - rz * st.velocity.x) / r;
        if (Number.isFinite(tang)) potOmega = clamp(potOmega + tang / r * dt * P.pot.stirGain, -P.pot.omegaMax, P.pot.omegaMax);
      }
      potOmega *= Math.exp(-dt / P.pot.omegaDecay);
      if (place === "net") {
        netHang = clamp(netHang + (netInWater ? -dt / 0.25 : dt / P.net.hangTime), 0, 1);
        if (wasInWater && !netInWater) env.emit("scoop", { position: evPos() });
        wasInWater = netInWater;
      }
      if (fillOn) fill += (1 - fill) * (1 - Math.exp(-P.bowl.fillRate * dt));
      if (place === "pot" && splashed) cook = Math.min(1, cook + dt / 1.5);
      let bowlMoved = false;
      if (place === "bowl") {
        LY.bowl.updateWorldMatrix(true, false);
        const e = LY.bowl.matrixWorld.elements;
        let ok = true;
        for (let q = 0; q < 16; q++) if (!Number.isFinite(e[q])) ok = false;
        if (ok) for (let q = 0; q < 16; q++) bowlE[q] = e[q];
        bowlMoved = bowlE[12] !== bowlLast[0] || bowlE[13] !== bowlLast[1] || bowlE[14] !== bowlLast[2];
        bowlLast[0] = bowlE[12];
        bowlLast[1] = bowlE[13];
        bowlLast[2] = bowlE[14];
      }
      if (eating && mouth) {
        const e = mouth.matrixWorld.elements;
        if (Number.isFinite(e[12] + e[13] + e[14])) {
          mouthP[0] = e[12];
          mouthP[1] = e[13];
          mouthP[2] = e[14];
        }
      }
      const tr = trans;
      if (tr) tr.t += dt;
      let morphing = false, done = true;
      const still = !tr && !force && (place === "board" && !hopOn || place === "bowl" && !bowlMoved && fill > 0.995);
      if (!still || morphingAny()) {
        for (let i = 0; i < count; i++) {
          const nd = list[i];
          if (nd.morph < 1) {
            nd.morph = Math.min(1, nd.morph + dt / PN.morphTime);
            morphing = true;
          }
          if (tr && tr.kind === "eat") {
            const D = tr.dur, q = clamp((tr.t - (count - 1 - i) / count * 0.45 * D) / (0.55 * D), 0, 1);
            shapeEat(i, nd, q);
            if (q < 1) done = false;
          } else {
            if (place === "pot") {
              if (!tr) nd.potT += dt;
            }
            if (tr && tr.kind === "bowl") {
              nd.feed = clamp((tr.t - 0.08 - i * tr.stg) / (P.bowl.feedBase + nd.L * P.bowl.feedPerMeter), 0, 1);
              if (nd.feed < 1) done = false;
            }
            switch (place) {
              case "hand":
                shapeHang(i, nd);
                break;
              case "net":
                shapeNet(i, nd);
                break;
              case "pot":
                shapePot(i, nd);
                break;
              case "bowl":
                shapeBowl(i, nd);
                break;
              default:
                shapeBoard(i, nd);
            }
            if (tr) {
              let e;
              if (tr.kind === "bowl") e = smooth(tr.t / P.move.bowlBlend);
              else {
                const x = clamp((tr.t - i * tr.stg) / tr.dur, 0, 1);
                e = tr.ease === 1 ? easeOutCubic(x) : tr.ease === 2 ? x * x * (3 - 2 * x) * (0.6 + 0.4 * x) : smooth(x);
                if (x < 1) done = false;
              }
              if (tr.kind === "bowl" && e < 1) done = false;
              const arc = tr.arc * Math.sin(Math.PI * e), f = nd.from, t = nd.tgt, p = nd.pts;
              for (let q = 0; q < K * 3; q += 3) {
                p[q] = f[q] + (t[q] - f[q]) * e;
                p[q + 1] = f[q + 1] + (t[q + 1] - f[q + 1]) * e + arc;
                p[q + 2] = f[q + 2] + (t[q + 2] - f[q + 2]) * e;
              }
              for (let q = 0; q < 3; q++) nd.wcur[q] = nd.wfrom[q] + (nd.wref[q] - nd.wfrom[q]) * e;
            } else {
              nd.pts.set(nd.tgt);
              nd.wcur.set(nd.wref);
            }
          }
          for (let q = 0; q < K * 3; q++) if (!Number.isFinite(nd.pts[q])) {
            nd.pts.set(nd.from);
            break;
          }
          writeTube(i, nd);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.normal.needsUpdate = true;
        geo.setDrawRange(0, count * IPN);
        force = morphing;
        measure();
      }
      if (tr) {
        if (place === "pot" && !splashed && tr.kind === "lerp" && tr.t / tr.dur > 0.72) {
          splashed = true;
          v3[0] = clamp(center.x, potC.x - potR * 0.6, potC.x + potR * 0.6);
          v3[2] = clamp(center.z, potC.z - potR * 0.6, potC.z + potR * 0.6);
          env.emit("splash", { position: new THREE.Vector3(v3[0], potC.y, v3[2]) });
        }
        if (place === "bowl" && !dropped && tr.t > 0.22) {
          dropped = true;
          fillOn = true;
          env.emit("drop", { position: new THREE.Vector3(bowlE[12], bowlE[13], bowlE[14]) });
        }
        if (done) {
          trans = null;
          force = true;
          if (tr.kind === "eat") {
            count = 0;
            eating = false;
            geo.setDrawRange(0, 0);
          }
          if (!tr.quiet) env.emit("settled", { place });
        }
      }
    }
    function morphingAny() {
      for (let i = 0; i < count; i++) if (list[i].morph < 1) return true;
      return false;
    }
    return {
      mesh,
      center,
      bounds,
      get count() {
        return count;
      },
      get place() {
        return place;
      },
      get busy() {
        return !!trans && !trans.quiet;
      },
      get cook() {
        return cook;
      },
      get swinging() {
        return place === "hand" || place === "net" && netHang > 0.5;
      },
      clear,
      addFromPiece,
      layout,
      cutLaid,
      begin,
      update,
      width(i) {
        return list[i].w;
      },
      tris() {
        return count * (IPN / 3);
      },
      bytes() {
        return nPos.byteLength * 2 + nUv.byteLength + nIdx.byteLength;
      },
      dispose() {
        geo.dispose();
        if (mesh.parent) mesh.parent.remove(mesh);
      }
    };
  }

  // app/hero/hero.js
  var PLACES = ["board", "hand", "pot", "net", "bowl", "eaten"];
  function createHero(THREE, opts) {
    const P = PARAMS;
    const Q = P.quality[opts.tier] || P.quality.mid;
    const LY = opts.layout;
    const MAXN = clamp(Math.round(opts.maxNoodles || 12), 1, 16);
    const TOP = LY.board.center.y;
    if (LY.net && Number.isFinite(LY.net.radius)) P.net.radius = LY.net.radius;
    if (LY.net && Number.isFinite(LY.net.rimY)) P.net.rimY = LY.net.rimY;
    if (LY.pot && Number.isFinite(LY.pot.rimAbove)) P.pot.rimAbove = LY.pot.rimAbove;
    const emit = (type, data) => {
      try {
        if (opts.onEvent) opts.onEvent(type, data);
      } catch (e) {
        console.warn("[hero] onEvent", e);
      }
    };
    const root = new THREE.Group();
    root.name = "hero";
    const tex = opts.textures && opts.textures.dough ? opts.textures.dough : null;
    const doughMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, vertexColors: true });
    const noodleMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 });
    const RAW = new THREE.Color().setRGB(1.08, 1.14, 1.36), COOKED = new THREE.Color().setRGB(1.14, 1.24, 1.56);
    doughMat.color.setRGB(1.1, 1.17, 1.42);
    noodleMat.color.copy(RAW);
    const BASE = [0.035, 0.03, 0.02];
    function floorAt(x, z) {
      const pc = LY.pot.center, pr = LY.pot.radius;
      let dx = x - pc.x, dz = z - pc.z, d2 = dx * dx + dz * dz;
      if (d2 < (pr - 8e-3) * (pr - 8e-3)) return pc.y - P.hang.floorDip;
      if (d2 < (pr + 0.02) * (pr + 0.02)) return pc.y + P.pot.rimAbove;
      const e = LY.bowl.matrixWorld.elements, u = LY.bowl.userData || {}, ri = u.innerRadius || 0.085;
      dx = x - e[12];
      dz = z - e[14];
      d2 = dx * dx + dz * dz;
      if (d2 < ri * ri * 0.72) return e[13] + 4e-3;
      if (d2 < (ri + 0.014) * (ri + 0.014)) return e[13] + (u.depth || 0.07);
      const b = LY.board;
      if (Math.abs(x - b.center.x) < b.sizeX / 2 && Math.abs(z - b.center.z) < b.sizeZ / 2) return TOP;
      return 0;
    }
    const dough = createDough(THREE, Q, P, LY, doughMat, MAXN);
    const noodles = createNoodles(THREE, Q, P, LY, noodleMat, MAXN, { floorAt, emit });
    root.add(dough.group, noodles.mesh);
    const SH = 32, shData = new Uint8Array(SH * SH * 4);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SH; x++) {
      const r = Math.hypot((x + 0.5) / SH * 2 - 1, (y + 0.5) / SH * 2 - 1), a = clamp((1 - r) / 0.5, 0, 1);
      const o = (y * SH + x) * 4;
      shData[o] = shData[o + 1] = shData[o + 2] = 0;
      shData[o + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
    const shTex = new THREE.DataTexture(shData, SH, SH, THREE.RGBAFormat);
    shTex.magFilter = THREE.LinearFilter;
    shTex.minFilter = THREE.LinearFilter;
    shTex.needsUpdate = true;
    const shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.3 });
    const shadow = new THREE.Mesh(shGeo, shMat);
    shadow.visible = false;
    shadow.renderOrder = 3;
    shadow.frustumCulled = false;
    root.add(shadow);
    const proxyGeo = new THREE.BoxGeometry(1, 1, 1);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const doughProxy = new THREE.Mesh(proxyGeo, proxyMat);
    doughProxy.userData = { heroPart: "dough", enabled: false };
    const noodleProxy = new THREE.Mesh(proxyGeo, proxyMat);
    noodleProxy.userData = { heroPart: "noodles", enabled: false };
    root.add(doughProxy, noodleProxy);
    let mode = "dough", place = "board", cutCount = 0, grabbing = false, stretchT = 0, resetPending = false, disposed = false;
    let hint = null, hintT = 0;
    const touched = { pressed: false, stretched: false, rolled: false };
    const center = new THREE.Vector3();
    const state = { place: "board", cutCount: 0, noodleCount: 0, touched, busy: false, center };
    const piece = { x: 0, y: 0, z0: 0, z1: 0, w: 0, th: 0, prof: null };
    const HP = P.hint;
    const hopAt = (delay) => {
      const t = hintT - delay;
      if (t < 0) return 0;
      const ph = t % HP.hopEvery;
      return ph < HP.hopTime ? Math.sin(ph / HP.hopTime * Math.PI) : 0;
    };
    function endGrab() {
      if (!grabbing) return;
      grabbing = false;
      const a = dough.release();
      if (a >= 0) emit("stretch-release", { amount: a });
    }
    function toTubes() {
      if (dough.dropping) {
        dough.finishDrop();
        if (resetPending) {
          resetPending = false;
          emit("settled", { place: "board" });
        }
      }
      endGrab();
      dough.freeze();
      noodles.clear();
      const n = dough.count;
      for (let i = 0; i < n; i++) noodles.addFromPiece(dough.pieceOut(i, piece));
      dough.hide();
      mode = "tubes";
    }
    function setPlace(p, o) {
      if (disposed || PLACES.indexOf(p) < 0 || mode === "none") return;
      if (mode === "dough" || mode === "slab") {
        if (p === "board") return;
        toTubes();
      } else if (p === place) return;
      place = p;
      noodles.begin(p, o || null);
    }
    function reset(o) {
      if (disposed) return;
      noodles.clear();
      endGrab();
      mode = "dough";
      place = "board";
      cutCount = 0;
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
      if (grabbing && mode !== "dough") endGrab();
      if (pt && mode === "dough" && place === "board") {
        if (pt.phase === "down" && pt.part === "dough" && dough.landed) {
          endGrab();
          grabbing = dough.grab(pt.ray);
          if (grabbing) {
            touched.pressed = true;
            stretchT = 0;
            dough.drag(pt.boardPoint.x, pt.boardPoint.z, 0);
            emit("press", { strength: 0.6, position: dough.grabPos.clone() });
          }
        } else if (grabbing && pt.active && pt.phase !== "up") {
          const a = dough.drag(pt.boardPoint.x, pt.boardPoint.z, dt);
          if (a >= 0) {
            touched.stretched = true;
            stretchT -= dt;
            if (stretchT <= 0) {
              stretchT = 0.1;
              emit("stretch", { amount: a });
            }
          }
        }
        if (pt.phase === "up" || !pt.active && pt.phase !== "down") endGrab();
      }
      const pin = input.pin;
      if (pin && pin.active && mode === "dough" && place === "board" && !grabbing) {
        const n = dough.roll(pin);
        if (n >= 0) {
          touched.rolled = true;
          for (let i = 0; i < Math.min(n, 2); i++) emit("roll", { amount: dough.flatness() });
        }
      }
      const chops = input.chops;
      if (chops) for (let i = 0; i < chops.length; i++) {
        const c = chops[i];
        let w = -1;
        if (c && place === "board") {
          if (mode === "dough" || mode === "slab") {
            endGrab();
            w = dough.cut(c.x, c.z);
            if (w >= 0) mode = "slab";
          } else if (mode === "tubes") w = noodles.cutLaid(c.x, c.z);
        }
        if (w >= 0) {
          cutCount++;
          emit("cut", { count: mode === "slab" ? dough.count : noodles.count, width: w, position: c.clone() });
        } else if (c) emit("cut-miss", { position: c.clone() });
      }
      const hintOn = hint !== null;
      if (mode === "dough" || mode === "slab") {
        dough.update(dt, time, hintOn, hopAt);
        if (resetPending && !dough.dropping) {
          resetPending = false;
          emit("settled", { place: "board" });
        }
      } else if (mode === "tubes") {
        noodles.update(dt, input, hintOn, hopAt);
        if (noodles.count === 0) mode = "none";
      }
      const pulse = hintOn ? 0.5 - 0.5 * Math.cos(hintT * 2 * Math.PI / HP.period) : 0;
      const gd = mode === "dough" || mode === "slab" ? pulse : 0, gn = mode === "tubes" ? pulse : 0, k = noodles.cook;
      doughMat.emissive.setRGB(BASE[0] + HP.glow[0] * gd, BASE[1] + HP.glow[1] * gd, BASE[2] + HP.glow[2] * gd);
      noodleMat.emissive.setRGB(BASE[0] + HP.glow[0] * gn + 0.04 * k, BASE[1] + HP.glow[1] * gn + 0.035 * k, BASE[2] + HP.glow[2] * gn + 0.025 * k);
      noodleMat.roughness = lerp(0.62, 0.34, k);
      noodleMat.color.copy(RAW).lerp(COOKED, k);
      sync();
    }
    function sync() {
      let de = false, ne = false;
      if (mode === "dough" || mode === "slab") {
        const b = dough.bounds, h = Math.max(0.012, b.h);
        center.set(dough.cx, TOP + h * 0.9, dough.cz);
        const px = mode === "dough" ? doughProxy : noodleProxy;
        px.position.set((b.x0 + b.x1) / 2, TOP + h / 2, (b.z0 + b.z1) / 2);
        px.scale.set(Math.max(0.03, b.x1 - b.x0 + 0.012), h + 0.012, Math.max(0.03, b.z1 - b.z0 + 0.012));
        if (mode === "dough") de = place === "board" && dough.landed;
        else ne = true;
        const lift = clamp(dough.lift / 0.25, 0, 1), sk = 1 - 0.35 * lift;
        shadow.visible = true;
        shadow.position.set((b.x0 + b.x1) / 2, TOP + 15e-4, (b.z0 + b.z1) / 2 + 4e-3);
        shadow.scale.set((b.x1 - b.x0) * 1.3 * sk, 1, (b.z1 - b.z0) * 1.34 * sk);
        shMat.opacity = P.shadow.dough * (1 - 0.6 * lift);
      } else if (mode === "tubes") {
        const b = noodles.bounds;
        center.copy(noodles.center);
        if (place === "board") {
          noodleProxy.position.set((b.x0 + b.x1) / 2, Math.max(TOP + 0.015, b.y), (b.z0 + b.z1) / 2);
          noodleProxy.scale.set(Math.max(0.05, b.x1 - b.x0 + 0.02), 0.045, Math.max(0.05, b.z1 - b.z0 + 0.02));
          ne = noodles.count > 0;
        }
        const fl = floorAt(center.x, center.z), hgt = center.y - fl;
        if (place === "board" && noodles.count > 0 && Number.isFinite(hgt)) {
          shadow.visible = true;
          shadow.position.set((b.x0 + b.x1) / 2, TOP + 15e-4, (b.z0 + b.z1) / 2 + 4e-3);
          shadow.scale.set((b.x1 - b.x0) * 1.2 + 0.02, 1, (b.z1 - b.z0) * 1.2 + 0.02);
          shMat.opacity = P.shadow.laid * clamp(1.2 - hgt / 0.15, 0.3, 1);
        } else if (noodles.swinging && hgt > 0.012 && Number.isFinite(hgt)) {
          const s = clamp(0.1 + (b.x1 - b.x0 + b.z1 - b.z0) * 0.5, 0.1, 0.3);
          shadow.visible = true;
          shadow.position.set(center.x, fl + 25e-4, center.z);
          shadow.scale.set(s, 1, s);
          shMat.opacity = P.shadow.hang * clamp(1.15 - hgt / 0.3, 0.25, 1);
        } else shadow.visible = false;
      } else shadow.visible = false;
      doughProxy.userData.enabled = de;
      noodleProxy.userData.enabled = ne;
      doughProxy.updateMatrixWorld();
      noodleProxy.updateMatrixWorld();
    }
    function getState() {
      state.place = place;
      state.cutCount = cutCount;
      state.noodleCount = mode === "slab" ? dough.count : mode === "tubes" ? noodles.count : 0;
      state.busy = mode === "tubes" ? noodles.busy : mode === "none" ? false : dough.dropping;
      return state;
    }
    function getStats() {
      const tubes = mode === "tubes" && noodles.count > 0;
      return {
        triangles: dough.tris() + (tubes ? noodles.tris() : 0) + (shadow.visible ? 2 : 0),
        drawCalls: (dough.tris() > 0 ? 1 : 0) + (tubes ? 1 : 0) + (shadow.visible ? 1 : 0),
        textures: [{ name: "hero-shadow", width: SH, height: SH }],
        geometryBytes: dough.bytes() + noodles.bytes() + 4 * 20 + 24 * 32
      };
    }
    reset({ seed: 0 });
    return {
      root,
      hitTargets: [doughProxy, noodleProxy],
      update,
      setPlace,
      getState,
      setHint(part) {
        const h = part === "dough" || part === "noodles" ? part : null;
        if (h !== hint) {
          hint = h;
          hintT = 0;
        }
      },
      reset,
      getStats,
      onContextRestored() {
        shTex.needsUpdate = true;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        dough.dispose();
        noodles.dispose();
        proxyGeo.dispose();
        proxyMat.dispose();
        doughMat.dispose();
        noodleMat.dispose();
        shGeo.dispose();
        shMat.dispose();
        shTex.dispose();
        if (root.parent) root.parent.remove(root);
      },
      params: P
    };
  }
  return __toCommonJS(hero_exports);
})();
