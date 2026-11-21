// 麺：制御点 K 個の曲線（Catmull-Rom）に沿ったチューブ。全部で1つの geometry（最大 MAXN 本ぶんを確保）。
// 場所ごとの形は数式で決める（物理エンジンなし）：
//   board … まな板に z 方向へ並ぶ          hand … 指から U 字にぶら下がり、振り子で揺れる
//   pot   … 湯の中で弧になって波打ち、渦で回る  net  … かごの中でゆらゆら／上げると縁から垂れて揺れる
//   bowl  … 上からするする落ちて渦巻きに巻く    eaten … 自分の形をなぞって口へ吸い込まれる
// 場所の移り変わりは「今の形の写し → 行き先の形」の補間なので、途中で行き先が変わっても形は飛ばない。

import { clamp, lerp, smooth, easeOutCubic, hash, crWeights } from './math.js';

export function createNoodles(THREE, Q, P, LY, material, MAXN, env) {
  const PN = P.noodle, K = Math.max(6, PN.K & ~1), M = (K - 2) >> 1, SEG = Q.seg, RAD = Q.rad, RING = RAD + 1;
  const VPN = (SEG + 1) * RING + 2, IPN = SEG * RAD * 6 + RAD * 6;
  const TOP = LY.board.center.y, G = P.g, TAU = Math.PI * 2;
  const potC = LY.pot.center, potR = LY.pot.radius;

  // ---------- geometry ----------
  const nPos = new Float32Array(MAXN * VPN * 3), nNor = new Float32Array(MAXN * VPN * 3), nUv = new Float32Array(MAXN * VPN * 2);
  const nIdx = new Uint16Array(MAXN * IPN);
  for (let m = 0; m < MAXN; m++) {
    const vo = m * VPN; let io = m * IPN;
    for (let s = 0; s < SEG; s++) for (let r = 0; r < RAD; r++) {
      const a = vo + s * RING + r, b = a + 1, c = a + RING, d = c + 1;
      nIdx[io++] = a; nIdx[io++] = c; nIdx[io++] = b; nIdx[io++] = b; nIdx[io++] = c; nIdx[io++] = d;
    }
    const c0 = vo + (SEG + 1) * RING, c1 = c0 + 1, e = vo + SEG * RING;
    for (let r = 0; r < RAD; r++) { nIdx[io++] = c0; nIdx[io++] = vo + r; nIdx[io++] = vo + r + 1; }
    for (let r = 0; r < RAD; r++) { nIdx[io++] = c1; nIdx[io++] = e + r + 1; nIdx[io++] = e + r; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(nPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nNor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(nUv, 2));
  geo.setIndex(new THREE.BufferAttribute(nIdx, 1));
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false; mesh.name = 'hero-noodles';

  // 断面：角を丸めた長方形（超楕円）。位置と法線の係数
  const EXP = 0.55;
  const cxr = new Float32Array(RING), cyr = new Float32Array(RING), ncr = new Float32Array(RING), nsr = new Float32Array(RING);
  for (let r = 0; r <= RAD; r++) {
    const a = (r % RAD) / RAD * TAU, c = Math.cos(a), s = Math.sin(a);
    cxr[r] = Math.sign(c) * Math.pow(Math.abs(c), EXP); cyr[r] = Math.sign(s) * Math.pow(Math.abs(s), EXP);
    ncr[r] = Math.sign(c) * Math.pow(Math.abs(c), 2 - EXP); nsr[r] = Math.sign(s) * Math.pow(Math.abs(s), 2 - EXP);
  }
  // 曲線の重み（輪ごとに固定）
  const crW = new Float32Array((SEG + 1) * 4), crI = new Uint8Array((SEG + 1) * 4);
  for (let s = 0; s <= SEG; s++) {
    const f = s / SEG * (K - 1), k = Math.min(K - 2, Math.floor(f));
    crWeights(f - k, crW, s * 4);
    crI[s * 4] = Math.max(0, k - 1); crI[s * 4 + 1] = k; crI[s * 4 + 2] = k + 1; crI[s * 4 + 3] = Math.min(K - 1, k + 2);
  }
  const C = new Float32Array((SEG + 1) * 3);

  // ---------- 麺の記録 ----------
  const mk = (i) => ({
    w: 0.01, h: 0.01, L: 0.18, pw: 0.01, prof: new Float32Array(8), morph: 1, vis: 1, uvDirty: true,
    pts: new Float32Array(K * 3), from: new Float32Array(K * 3), tgt: new Float32Array(K * 3),
    wref: new Float32Array([0, 1, 0]), wfrom: new Float32Array([0, 1, 0]), wcur: new Float32Array([0, 1, 0]), w0: new Float32Array([0, 1, 0]),
    bob: new Float32Array(2 * M * 4), bobInit: false,
    r1: hash(i * 3.1 + 1), r2: hash(i * 5.3 + 2), r3: hash(i * 7.7 + 3),
    layX: 0, potR: 0.06, potPhi: 0, potD: 0.02, potSp: 0, potT: 9, netA: 0, netB: 3, feed: 1,
    bwR: 0.05, bwTh: 0, bwP: 0.002, bwLayer: 0, bwMax: 0.06, bwRise: 0,
  });
  const list = [];
  for (let i = 0; i < MAXN; i++) list.push(mk(i));
  let count = 0, hAvg = 0.012;
  let place = 'board', trans = null, force = true;
  const lay = { cx: LY.board.center.x, cz: LY.board.center.z, ph: 0, span: 0.3, amp: 0 };
  let DT = 0, TIME = 0, potOmega = 0, netHang = 1, wasInWater = false, fill = 0, fillOn = false, cook = 0, splashed = false, dropped = false;
  let hopOn = false, hopFn = null, eating = false, mouth = null;
  const hold = new Float32Array(3), netP = new Float32Array(3), mouthP = new Float32Array(3), tmpA = new Float32Array(K * 3), v3 = new Float32Array(3);
  let netInWater = false;
  const bowlE = new Float32Array(16), bowlLast = new Float32Array(3);
  const center = new THREE.Vector3(), bounds = { x0: 0, x1: 0, z0: 0, z1: 0, y: TOP };
  const evPos = () => center.clone();

  const set = (a, k, x, y, z) => { const o = k * 3; a[o] = x; a[o + 1] = y; a[o + 2] = z; };
  function calcAvg() { let s = 0; for (let i = 0; i < count; i++) s += list[i].h; hAvg = count ? s / count : 0.012; }

  // ---------- 麺を作る／切る ----------
  function clear() { count = 0; trans = null; place = 'board'; fill = 0; fillOn = false; cook = 0; eating = false; mouth = null; potOmega = 0; geo.setDrawRange(0, 0); force = true; }
  // 生地の切り身から麺を1本足す（まな板の上の、切り身と同じ位置・同じ大きさで始まる）
  function addFromPiece(pc) {
    if (count >= MAXN) return;
    const nd = list[count], i = count++;
    nd.pw = Math.max(PN.wMin, pc.w);
    nd.w = clamp(pc.w, PN.wMin, PN.wMax);
    nd.h = Math.min(clamp(pc.th * PN.hScale, PN.hMin, PN.hMax), nd.w);
    const L0 = Math.max(PN.lMin, pc.z1 - pc.z0);
    // 持ち上げると細くなったぶん伸びる（lenScale）。幅が wMax を超える切り身は、さらに長い麺になる（極太うどんは長い）
    nd.L = Math.min(L0 * PN.lenScale * Math.sqrt(nd.pw / nd.w), Math.max(L0, PN.lMax - PN.lMaxPerWidth * Math.max(0, nd.w - 0.012)));
    nd.prof.set(pc.prof); nd.morph = 0; nd.vis = 1; nd.uvDirty = true; nd.bobInit = false; nd.feed = 1; nd.potT = 9;
    nd.r1 = hash(i * 3.1 + nd.L * 91); nd.r2 = hash(i * 5.3 + nd.w * 173); nd.r3 = hash(i * 7.7 + nd.L * 37);
    const zc = (pc.z0 + pc.z1) / 2;
    for (let k = 0; k < K; k++) set(nd.pts, k, pc.x, pc.y + nd.h / 2, zc + (k / (K - 1) - 0.5) * L0);
    nd.layX = pc.x;
    nd.wref[0] = 0; nd.wref[1] = 1; nd.wref[2] = 0; nd.wcur.set(nd.wref); nd.w0.set(nd.wref);
    lay.cz = zc;
    calcAvg(); force = true;
  }
  // まな板に並べる位置を決める（cx, cz を中心に、まな板からはみ出さないように）
  function layout(cx, cz) {
    const b = LY.board, gap = P.cut.gap, m = 0.012;
    let W = 0, Lmax = 0;
    for (let i = 0; i < count; i++) { W += list[i].w; if (list[i].L > Lmax) Lmax = list[i].L; }
    W += Math.max(0, count - 1) * gap;
    const x0 = b.center.x - b.sizeX / 2 + m, x1 = b.center.x + b.sizeX / 2 - m, z0 = b.center.z - b.sizeZ / 2 + m, z1 = b.center.z + b.sizeZ / 2 - m;
    // まな板より長い麺は S 字に寝かせて収める（となり同士は同じ波なので重ならない）
    lay.span = Math.min(Lmax, z1 - z0);
    const amp = lay.span > 1e-4 ? Math.min(0.05, lay.span / 1.5 / Math.PI * Math.sqrt(Math.max(0, Lmax / lay.span - 1))) : 0;
    lay.amp = amp;
    cx = W + 2 * amp < x1 - x0 ? clamp(cx, x0 + W / 2 + amp, x1 - W / 2 - amp) : (x0 + x1) / 2;
    cz = lay.span < z1 - z0 ? clamp(cz, z0 + lay.span / 2, z1 - lay.span / 2) : (z0 + z1) / 2;
    let x = cx - W / 2;
    for (let i = 0; i < count; i++) { const nd = list[i]; nd.layX = x + nd.w / 2; x += nd.w + gap; }
    lay.cx = cx; lay.cz = cz;
  }
  // まな板に並んだ麺を包丁で縦に割る。戻り値は今できた麺の幅（切れなければ -1）
  function cutLaid(x, z) {
    if (place !== 'board' || (trans && !trans.quiet) || count === 0 || count >= MAXN) return -1;
    for (let i = 0; i < count; i++) {
      const nd = list[i], a = nd.layX - nd.w / 2, b = nd.layX + nd.w / 2;
      if (x <= a || x >= b) continue;
      if (z < lay.cz - lay.span / 2 - P.cut.zMargin || z > lay.cz + lay.span / 2 + P.cut.zMargin) return -1;
      const wl = x - a, wr = b - x;
      if (wl < P.cut.minPieceWidth || wr < P.cut.minPieceWidth) return -1;
      // 右半分を新しい麺として i+1 に差し込む（記録を1つずつ後ろへ回す）
      const nw = list[count];
      for (let q = count; q > i + 1; q--) list[q] = list[q - 1];
      list[i + 1] = nw; count++;
      nw.L = nd.L; nw.h = Math.min(nd.h, wr); nw.w = nw.pw = wr; nw.morph = 1; nw.vis = 1; nw.uvDirty = true; nw.bobInit = false; nw.feed = 1; nw.potT = 9;
      nw.r1 = hash(nd.r1 * 13.7 + 0.31); nw.r2 = hash(nd.r2 * 17.3 + 0.57); nw.r3 = hash(nd.r3 * 11.1 + 0.83);
      nd.w = nd.pw = wl; nd.h = Math.min(nd.h, wl); nd.morph = 1; nd.uvDirty = true;
      for (let k = 0; k < K; k++) {
        const o = k * 3;
        nw.pts[o] = nd.pts[o] + wl / 2; nw.pts[o + 1] = nd.pts[o + 1]; nw.pts[o + 2] = nd.pts[o + 2];
        nd.pts[o] -= wr / 2;
      }
      nw.wcur.set(nd.wcur); nw.wref.set(nd.wref); nw.w0.set(nd.w0);
      calcAvg();
      layout(lay.cx, lay.cz);
      snapshot();
      trans = { kind: 'lerp', t: 0, dur: 0.16, stg: 0, arc: 0, quiet: true };   // 開く動き（settled は出さない）
      force = true;
      return Math.min(wl, wr);
    }
    return -1;
  }

  // ---------- 場所ごとの形（nd.tgt と nd.wref に書く） ----------
  function shapeBoard(i, nd) {
    // 全部の麺が同じ波（振幅 lay.amp）に乗る。波のぶん z の長さが縮む：len = L / (1 + (A·k)²/4)
    const kz = lay.span > 1e-4 ? TAU * 1.5 / lay.span : 0, amp = lay.amp, ak = amp * kz;
    const len = Math.min(nd.L / (1 + ak * ak / 4), lay.span), z0 = lay.cz - len / 2, hop = hopOn ? hopFn(i * 0.06) * P.hint.hopHeight * 1.3 : 0;
    for (let k = 0; k < K; k++) {
      const s = k / (K - 1), z = z0 + s * len;
      set(nd.tgt, k, nd.layX + 0.003 * Math.sin(z * 38 + lay.ph) + amp * Math.sin((z - lay.cz) * kz + lay.ph), TOP + nd.h / 2 + hop, z);
    }
    nd.wref[0] = 0; nd.wref[1] = 1; nd.wref[2] = 0;
  }

  // 振り子（先ほど長い＝遅い）。おもりの水平位置が、動く支点を追いかける：b'' = -(g/ℓ)(b - a) - c·b'
  function stepBobs(nd, leg, ax, az, seg, levels) {
    const bob = nd.bob, c = P.hang.damping;
    const n = DT > 0.034 ? 3 : DT > 0.017 ? 2 : 1, h = DT / n;
    for (let m = 0; m < levels; m++) {
      const o = (leg * M + m) * 4, lm = Math.max(0.02, seg * (m + 1)) * (leg ? 1.12 : 1), w2 = G / lm, maxD = lm * 1.3;
      if (!nd.bobInit) { bob[o] = ax; bob[o + 1] = az; bob[o + 2] = 0; bob[o + 3] = 0; continue; }
      let bx = bob[o], bz = bob[o + 1], vx = bob[o + 2], vz = bob[o + 3];
      for (let s = 0; s < n; s++) {
        vx += (-w2 * (bx - ax) - c * vx) * h; vz += (-w2 * (bz - az) - c * vz) * h;
        bx += vx * h; bz += vz * h;
      }
      const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
      if (d > maxD) { bx = ax + dx / d * maxD; bz = az + dz / d * maxD; vx *= 0.5; vz *= 0.5; }
      if (!Number.isFinite(bx + bz + vx + vz)) { bx = ax; bz = az; vx = 0; vz = 0; }
      bob[o] = bx; bob[o + 1] = bz; bob[o + 2] = vx; bob[o + 3] = vz;
    }
  }
  // 支点 (px,py,pz) から片側の足を下ろす。start: 最初に使う振り子の段、idx(m): 書き込む制御点
  function dropLeg(nd, leg, px, py, pz, ex, ez, seg, levels, first, splay0) {
    const side = leg ? 1 : -1, ax = px, az = pz, sp = P.hang.splay;
    for (let m = 0; m < levels; m++) {
      const o = (leg * M + m) * 4, lm = Math.max(0.02, seg * (m + 1)) * (leg ? 1.12 : 1);
      const spl = m === 0 ? splay0 : sp[Math.min(m, sp.length - 1)];
      const hx = clamp((nd.bob[o] - ax) / lm, -1.5, 1.5) + side * ex * spl, hz = clamp((nd.bob[o + 1] - az) / lm, -1.5, 1.5) + side * ez * spl;
      const inv = seg / Math.sqrt(hx * hx + 1 + hz * hz);
      px += hx * inv; py -= inv; pz += hz * inv;
      const fl = env.floorAt(px, pz) + nd.h / 2;
      if (py < fl) { const lost = (fl - py) * 0.8; py = fl; px += side * ex * lost; pz += side * ez * lost; }   // 下に着いた分は外へ寝る
      set(nd.tgt, leg ? first + m : first - m, px, py, pz);
    }
  }
  // 指から：束の真ん中あたりをつまんだ U 字。両端がだらーんと垂れる。
  // 1本ずつ少し違う（つまむ位置・向き・開き方）ので、束がばらけて見え、長さの違いで揺れ方もずれる
  function shapeHang(i, nd) {
    const yaw = i * 2.4 + nd.r1 * 1.5, ex = Math.cos(yaw), ez = Math.sin(yaw), PH = P.hang;
    const rho = PH.bundle * (0.3 + 0.7 * Math.sqrt((i + 0.5) / count)), oa = yaw + 1.3;
    const a = PH.topGap + nd.h * 0.5, dl = (nd.r2 - 0.5) * PH.uneven;
    const tx = hold[0] + Math.cos(oa) * rho, ty = hold[1] + ((i % 3) - 1) * 0.002, tz = hold[2] + Math.sin(oa) * rho;
    const segA = Math.max(0.006, (nd.L * (0.5 + dl) - a) / M), segB = Math.max(0.006, (nd.L * (0.5 - dl) - a) / M);
    set(nd.tgt, M, tx - ex * a, ty, tz - ez * a); set(nd.tgt, M + 1, tx + ex * a, ty, tz + ez * a);
    stepBobs(nd, 0, tx - ex * a, tz - ez * a, segA, M); stepBobs(nd, 1, tx + ex * a, tz + ez * a, segB, M);
    nd.bobInit = true;
    const sp0 = PH.splay[0] * (0.6 + 0.8 * nd.r3);
    dropLeg(nd, 0, tx - ex * a, ty, tz - ez * a, ex, ez, segA, M, M - 1, sp0);
    dropLeg(nd, 1, tx + ex * a, ty, tz + ez * a, ex, ez, segB, M, M + 2, sp0);
    nd.wref[0] = -ex; nd.wref[1] = 0; nd.wref[2] = -ez;
  }
  // 網：湯の中ではかごの中で渦、上げると真ん中がかごに残って両端が縁から垂れる
  function shapeNet(i, nd) {
    const nx = netP[0], ny = netP[1], nz = netP[2], hg = smooth(netHang), PNt = P.net;
    if (hg < 1) {
      const span = Math.min(nd.L / 0.03, TAU * 1.2), a0 = nd.r1 * TAU + TIME * 0.7;
      for (let k = 0; k < K; k++) {
        const s = k / (K - 1), ang = a0 + s * span, r = 0.014 + 0.026 * s + 0.004 * Math.sin(TIME * 2.2 + i + s * 5);
        set(tmpA, k, nx + Math.cos(ang) * r, ny - 0.016 - 0.016 * nd.r2 + 0.004 * Math.sin(TIME * 2.6 + s * 6 + i), nz + Math.sin(ang) * r);
      }
    }
    const al = nd.netA, be = nd.netB, ca = Math.cos(al), sa = Math.sin(al), cb = Math.cos(be), sb = Math.sin(be);
    const Lin = Math.min(PNt.inCup, nd.L * PNt.inCupFrac), seg = Math.max(0.006, (nd.L - Lin) / 2 / Math.max(1, M - 1));
    const rr = PNt.radius + nd.h * 0.3, ry = ny + PNt.rimY + nd.h / 2 + (i % 4) * 0.0015, dip = Math.min(0.032, Lin * 0.33);
    const ax = nx + ca * rr, az = nz + sa * rr, bx = nx + cb * rr, bz = nz + sb * rr;
    set(nd.tgt, M - 1, ax, ry, az); set(nd.tgt, M, nx + ca * rr * 0.3, ny - dip, nz + sa * rr * 0.3);
    set(nd.tgt, M + 1, nx + cb * rr * 0.3, ny - dip, nz + sb * rr * 0.3); set(nd.tgt, M + 2, bx, ry, bz);
    stepBobs(nd, 0, ax, az, seg, M - 1); stepBobs(nd, 1, bx, bz, seg, M - 1);
    nd.bobInit = true;
    // 縁から外へ掛かって垂れる（dropLeg は side×(ex,ez) の向きへ開くので、足ごとに外向きを渡す）
    dropLeg(nd, 0, ax, ry, az, -ca, -sa, seg, M - 1, M - 2, 0.75);
    dropLeg(nd, 1, bx, ry, bz, cb, sb, seg, M - 1, M + 3, 0.75);
    if (hg < 1) for (let q = 0; q < K * 3; q++) nd.tgt[q] = tmpA[q] + (nd.tgt[q] - tmpA[q]) * hg;
    nd.wref[0] = ca * hg; nd.wref[1] = 1 - hg; nd.wref[2] = sa * hg;
  }
  // 鍋：弧になって沈み、ゆらゆら波打つ。渦（potOmega）に乗って回る
  function assignPot() {
    for (let i = 0; i < count; i++) {
      const nd = list[i];
      const rmax = Math.max(0.03, potR - 0.022 - nd.w / 2), rmin = Math.min(rmax, Math.max(0.03, nd.L / (TAU * 0.85)));
      nd.potR = lerp(rmin, rmax, (i * 0.618 + nd.r1 * 0.2) % 1);
      nd.potPhi = i * 2.4 + nd.r2 * 2; nd.potD = P.pot.depthMin + P.pot.depthVar * nd.r3; nd.potSp = (nd.r2 - 0.5) * 0.03; nd.potT = 0;
    }
  }
  function shapePot(i, nd) {
    const PT = P.pot, sw = Math.min(1, Math.abs(potOmega) / PT.omegaMax);
    nd.potPhi += (potOmega * (1.25 - 0.5 * nd.potR / potR) + PT.drift * (0.7 + 0.6 * nd.r1)) * DT;
    if (nd.potPhi > 1000) nd.potPhi -= Math.floor(nd.potPhi / TAU) * TAU;
    const rho = Math.min(nd.potR + 0.012 * sw * sw, potR - 0.014 - nd.w / 2), span = Math.min(nd.L / Math.max(0.02, rho), TAU * 0.92);
    const lam = Math.max(PT.waveLen, nd.L / 2.2), kw = TAU * nd.L / lam, wt = TAU * TIME / PT.wavePeriod, amp = PT.waveAmp * (1 - 0.5 * sw);
    const plunge = PT.plunge * Math.exp(-nd.potT / 0.3) * Math.cos(nd.potT * 8);
    const yMax = potC.y - 0.006 - nd.h / 2;
    for (let k = 0; k < K; k++) {
      const s = k / (K - 1), ang = nd.potPhi + (s - 0.5) * span;
      const r = clamp(rho + amp * Math.sin(kw * s - wt + nd.r2 * TAU) + (s - 0.5) * (nd.potSp + 0.02 * sw), 0.012, potR - 0.012 - nd.w / 2);
      const y = Math.min(yMax, potC.y - nd.potD * (1 - 0.5 * sw) - plunge + PT.bobAmp * Math.sin(kw * 0.73 * s + wt * 0.76 + nd.r3 * TAU));
      set(nd.tgt, k, potC.x + Math.cos(ang) * r, y, potC.z + Math.sin(ang) * r);
    }
    nd.wref[0] = 0; nd.wref[1] = 1; nd.wref[2] = 0;
  }
  // お椀：とぐろ。層ごとに1本の渦巻きの道（外 → 内、1周で麺の幅ぶん内へ）を作り、麺を順に道へ並べる。
  //   r(θ) = rs − p·(θ − θs)   （p = (幅 + すき間) / 2π）
  //   道のり s(Δθ) = rs·Δθ − p·Δθ²/2  →  Δθ(s) = (rs − √(rs² − 2ps)) / p
  // 内側まで来たら次の層へ（+h）。つゆが満ちると全体が一緒に浮き上がる。
  const coilC = { cy: 0, rs: 0.05, th0: 0, p: 0.002, L: 0.1, k: 1, i: 0, rise: 0 };
  let bowlLayers = 1, bowlDy = 0;
  const bowlD = { depth: 0.07, bl: 0.045, rB: 0.04, rI: 0.085 };
  function bowlDims() {   // お椀の寸法（userData）。毎回同じ物を書き換えて返す
    const u = LY.bowl.userData || {}, d = bowlD;
    d.depth = u.depth > 0 ? u.depth : 0.07; d.bl = u.brothLevel > 0 ? u.brothLevel : 0.045;
    d.rB = u.bottomRadius > 0 ? u.bottomRadius : 0.04; d.rI = u.innerRadius > 0 ? u.innerRadius : 0.085;
    return d;
  }
  const bowlRin = (d, y) => d.rB + (d.rI - d.rB) * (1 - Math.pow(1 - clamp(y / d.depth, 0, 1), 2.2));
  function packBowl() {
    const d = bowlDims(), PB = P.bowl, yBot = hAvg / 2 + 0.004, yFloat = d.bl + PB.floatAbove + 0.4 * hAvg, gap = 0.0015;
    const maxTh = TAU * PB.maxTurns * (K - 1) / 9;
    let dy = hAvg * 0.9;
    for (let pass = 0; pass < 2; pass++) {
      let layer = 0, r = 0, th = 0, prevW = 0;
      for (let i = 0; i < count; i++) {
        const nd = list[i], w = nd.w, rmin = Math.max(PB.r0, w / 2 + 0.003);
        const pNat = (w + gap) / TAU;
        let p = pNat, rs = r - Math.max(0, (w - prevW) / 2);
        const room = rs * rs - 2 * p * nd.L;
        // 道が足りない／巻き数が多すぎて曲線が角ばる：次の層の外側から
        if (i === 0 || room < rmin * rmin || (rs - Math.sqrt(room)) / p > maxTh) {
          if (i > 0) layer++;
          const yl = pass === 0 ? yBot + layer * dy : yFloat - (bowlLayers - 1 - layer) * dy;
          nd.bwMax = Math.max(0.02, Math.min(bowlRin(d, Math.max(yl, yBot)) - 0.004, d.rI * PB.rimFill));
          rs = nd.bwMax - w / 2;
          if (rs < rmin + 0.004) rs = rmin + 0.004;
          if (rs * rs - 2 * p * nd.L < rmin * rmin) p = Math.max(1e-5, (rs * rs - rmin * rmin) / (2 * nd.L));   // 長すぎる麺は重なって巻く
          th = layer * 2.1 + nd.r1;
        } else nd.bwMax = list[i - 1].bwMax;
        nd.bwR = rs; nd.bwTh = th; nd.bwP = p; nd.bwLayer = layer;
        nd.bwRise = nd.h * 0.9 * (1 - p / pNat) / TAU;   // 重なって巻く分は上へ（蛇のとぐろ）
        const dth = (rs - Math.sqrt(Math.max(0, rs * rs - 2 * p * nd.L))) / p;
        r = rs - p * dth; th += dth + (0.004 + w * 0.3) / Math.max(r, 0.012); prevW = w;
      }
      bowlLayers = layer + 1;
      dy = bowlLayers > 1 ? Math.min(hAvg * 0.9, Math.max(0.002, (yFloat - yBot) / (bowlLayers - 1))) : 0;
    }
    bowlDy = dy;
  }
  function coilSetup(i, nd) {
    const d = bowlDims(), yBot = hAvg / 2 + 0.004;
    const yTop = Math.max(yBot + (bowlLayers - 1) * bowlDy, d.bl * fill + P.bowl.floatAbove + 0.4 * hAvg);
    const c = coilC;
    c.cy = yTop - (bowlLayers - 1 - nd.bwLayer) * bowlDy;
    c.rs = nd.bwR; c.th0 = nd.bwTh; c.p = nd.bwP; c.L = nd.L; c.i = i; c.rise = nd.bwRise;
    c.k = Math.min(1, Math.max(0.3, (bowlRin(d, c.cy) - 0.004) / nd.bwMax));   // 低い所ではお椀が細いので内へ寄せる
  }
  function coil(s, out, k) {
    const c = coilC, dth = c.p > 1e-7 ? (c.rs - Math.sqrt(Math.max(0, c.rs * c.rs - 2 * c.p * s * c.L))) / c.p : s * c.L / c.rs;
    const r = (c.rs - c.p * dth) * c.k, th = c.th0 + dth;
    set(out, k, Math.cos(th) * r, c.cy + c.rise * dth + 0.002 * Math.sin(2 * th + c.i), Math.sin(th) * r);
  }
  function shapeBowl(i, nd) {
    coilSetup(i, nd);
    const p = nd.feed, e = bowlE;
    for (let k = 0; k < K; k++) {
      const s = k / (K - 1), o = k * 3;
      if (s <= p) coil(s, nd.tgt, k);
      else {   // まだ落ちてきていない部分：巻いている所の真上にぶら下がる
        coil(p, nd.tgt, k);
        const up = (s - p) * nd.L;
        nd.tgt[o] += 0.1 * up * Math.sin(TIME * 7 + i * 1.3 + s * 5); nd.tgt[o + 1] += up; nd.tgt[o + 2] += 0.1 * up * Math.cos(TIME * 6 + i * 1.7 + s * 4);
      }
      const x = nd.tgt[o], y = nd.tgt[o + 1], z = nd.tgt[o + 2];   // お椀の座標 → ワールド
      nd.tgt[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; nd.tgt[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; nd.tgt[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    nd.wref[0] = e[4]; nd.wref[1] = e[5]; nd.wref[2] = e[6];
  }
  // すする：写しておいた自分の形（nd.from）をなぞって進み、口への橋を渡って吸い込まれる
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
      if (a <= L) { evalFrom(nd, a / L, v3); set(nd.pts, k, v3[0], v3[1], v3[2]); }
      else if (a < L + LB) {
        const u = (a - L) / LB, iu = 1 - u, w = wob * Math.sin(u * Math.PI);
        set(nd.pts, k, iu * iu * hx + 2 * iu * u * cxm + u * u * mx + w, iu * iu * hy + 2 * iu * u * cym + u * u * my, iu * iu * hz + 2 * iu * u * czm + u * u * mz);
      } else set(nd.pts, k, mx, my, mz);
    }
    nd.vis = q >= 1 ? 0 : 1;
  }

  // ---------- チューブを書く ----------
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
      if (tl > 1e-8) { Tx = tx / tl; Ty = ty / tl; Tz = tz / tl; }
      // 厚み方向 W を接線に直交させて運ぶ（ねじれを抑える平行移動）
      let d = Wx * Tx + Wy * Ty + Wz * Tz;
      Wx -= Tx * d; Wy -= Ty * d; Wz -= Tz * d;
      let wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz);
      if (wl < 1e-4) {
        Wx = nd.w0[0]; Wy = nd.w0[1]; Wz = nd.w0[2];
        d = Wx * Tx + Wy * Ty + Wz * Tz; Wx -= Tx * d; Wy -= Ty * d; Wz -= Tz * d;
        wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz);
        if (wl < 1e-4) { if (Math.abs(Ty) < 0.9) { Wx = -Tx * Ty; Wy = 1 - Ty * Ty; Wz = -Tz * Ty; } else { Wx = 1 - Tx * Tx; Wy = -Ty * Tx; Wz = -Tz * Tx; } wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz) || 1; }
      }
      Wx /= wl; Wy /= wl; Wz /= wl;
      if (s === 0) { nd.w0[0] = Wx; nd.w0[1] = Wy; nd.w0[2] = Wz; }
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
        nPos[o] = px + Ux * a + Wx * b; nPos[o + 1] = py + Uy * a + Wy * b; nPos[o + 2] = pz + Uz * a + Wz * b;
        const na = ncr[r] * hh, nb = nsr[r] * hw;
        let nx = Ux * na + Wx * nb, ny = Uy * na + Wy * nb, nz = Uz * na + Wz * nb;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nl > 1e-9) { nx /= nl; ny /= nl; nz /= nl; } else { nx = Wx; ny = Wy; nz = Wz; }
        nNor[o] = nx; nNor[o + 1] = ny; nNor[o + 2] = nz;
      }
      if (s === 0 || s === SEG) {   // 端のふた（少しふくらませる）
        const sg = s === 0 ? -1 : 1, bulge = Math.min(th, wd) * 0.3 * sc, c = (vo + (SEG + 1) * RING + (s === 0 ? 0 : 1)) * 3;
        nPos[c] = px + Tx * sg * bulge; nPos[c + 1] = py + Ty * sg * bulge; nPos[c + 2] = pz + Tz * sg * bulge;
        nNor[c] = Tx * sg; nNor[c + 1] = Ty * sg; nNor[c + 2] = Tz * sg;
      }
    }
    if (nd.uvDirty) {
      nd.uvDirty = false;
      const us = clamp((nd.w + nd.h) * 2 / PN.texScale, 0.08, 0.6), u0 = nd.r1 * 0.9, vs = L / PN.texScale, v0 = nd.r2;
      for (let s = 0; s <= SEG; s++) for (let r = 0; r <= RAD; r++) { const q = (vo + s * RING + r) * 2; nUv[q] = u0 + r / RAD * us; nUv[q + 1] = v0 + s / SEG * vs; }
      const q = (vo + (SEG + 1) * RING) * 2; nUv[q] = u0; nUv[q + 1] = v0; nUv[q + 2] = u0; nUv[q + 3] = v0 + vs;
      geo.attributes.uv.needsUpdate = true;
    }
  }

  // 中心と外接（まな板の当たり判定用）
  function measure() {
    let sx = 0, sy = 0, sz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, nvis = 0;
    for (let i = 0; i < count; i++) {
      const nd = list[i], p = nd.pts, hw = nd.w / 2;
      if (nd.vis <= 0) continue;
      for (let q = 0; q < K * 3; q += 3) {
        sx += p[q]; sy += p[q + 1]; sz += p[q + 2]; nvis++;
        if (p[q] - hw < x0) x0 = p[q] - hw; if (p[q] + hw > x1) x1 = p[q] + hw; if (p[q + 2] < z0) z0 = p[q + 2]; if (p[q + 2] > z1) z1 = p[q + 2];
      }
    }
    if (nvis) { center.set(sx / nvis, sy / nvis, sz / nvis); bounds.x0 = x0; bounds.x1 = x1; bounds.z0 = z0; bounds.z1 = z1; bounds.y = sy / nvis; }
  }

  // ---------- 場所を移す ----------
  function snapshot() { for (let i = 0; i < count; i++) { const nd = list[i]; nd.from.set(nd.pts); nd.wfrom.set(nd.wcur); } }
  function begin(p, opts) {
    snapshot(); measure();
    const fromY = center.y, PM = P.move, prev = place;
    place = p; eating = false; splashed = false; dropped = false;
    const tr = trans = { kind: 'lerp', t: 0, dur: PM[p] || 0.3, stg: 0, arc: 0, quiet: false, ease: 0 };
    // 山なりに越える高さ：行き先のふち、鍋に出入りするなら鍋のふち
    const arcTo = (toY, clearY) => {
      if (prev === 'pot' || p === 'pot') clearY = Math.max(clearY, potC.y + P.pot.rimAbove + 0.07);
      tr.arc = fromY < clearY - 0.02 ? Math.max(0, clearY - Math.min(fromY, toY)) * 1.4 : 0;
    };
    if (p === 'hand') { for (let i = 0; i < count; i++) list[i].bobInit = false; tr.stg = 0.006; tr.ease = 1; arcTo(hold[1] - 0.05, 0); }
    else if (p === 'net') {
      for (let i = 0; i < count; i++) { const nd = list[i]; nd.bobInit = false; nd.netA = i * 2.4 + nd.r1; nd.netB = nd.netA + Math.PI + (nd.r2 - 0.5) * 1.3; }
      netHang = netInWater ? 0 : 1; wasInWater = netInWater;
      if (!netInWater) arcTo(netP[1], netP[1] + 0.05);
      env.emit('scoop', { position: evPos() });
    } else if (p === 'pot') { assignPot(); tr.stg = 0.02; tr.ease = 2; arcTo(potC.y, potC.y + P.pot.rimAbove + 0.07); }
    else if (p === 'board') { layout(center.x, center.z); lay.ph = (lay.ph + 1.7) % TAU; tr.stg = 0.012; arcTo(TOP, TOP + 0.05); }
    else if (p === 'bowl') {
      tr.kind = 'bowl'; tr.stg = Math.min(P.bowl.feedStagger, 0.4 / Math.max(1, count));
      for (let i = 0; i < count; i++) list[i].feed = 0;
      packBowl();
      const by = LY.bowl.matrixWorld.elements[13] + bowlDims().depth;
      if (Number.isFinite(by)) arcTo(by, by + 0.05);
    } else if (p === 'eaten') {
      tr.kind = 'eat'; tr.dur = Math.max(0.2, (opts && opts.duration) || P.eat.duration);
      mouth = opts && opts.mouth && opts.mouth.matrixWorld ? opts.mouth : null;
      eating = true;
      mouthP[0] = center.x; mouthP[1] = center.y + 0.25; mouthP[2] = center.z - 0.2;   // 口が無いときは奥の上へ
    }
    force = true;
  }

  // ---------- 毎フレーム ----------
  function update(dt, input, hinting, hopAt) {
    if (count === 0) { geo.setDrawRange(0, 0); return; }
    DT = dt; TIME = input.time;
    const ih = input.hold, inn = input.net;
    if (ih && Number.isFinite(ih.x + ih.y + ih.z)) { hold[0] = ih.x; hold[1] = ih.y; hold[2] = ih.z; }
    if (inn && Number.isFinite(inn.x + inn.y + inn.z)) { netP[0] = inn.x; netP[1] = inn.y; netP[2] = inn.z; }
    netInWater = !!input.netInWater;
    hopOn = hinting && place === 'board' && !trans; hopFn = hopAt;
    // 鍋の渦：指の接線方向の速さ / 半径 → 角速度（最大 omegaMax、離すとゆっくり止まる）
    const st = input.stir;
    if (st && st.active && place === 'pot') {
      const rx = st.point.x - potC.x, rz = st.point.z - potC.z, r = Math.max(0.03, Math.hypot(rx, rz));
      const tang = (rx * st.velocity.z - rz * st.velocity.x) / r;
      if (Number.isFinite(tang)) potOmega = clamp(potOmega + tang / r * dt * P.pot.stirGain, -P.pot.omegaMax, P.pot.omegaMax);
    }
    potOmega *= Math.exp(-dt / P.pot.omegaDecay);
    // 網：湯から上がると垂れる
    if (place === 'net') {
      netHang = clamp(netHang + (netInWater ? -dt / 0.25 : dt / P.net.hangTime), 0, 1);
      if (wasInWater && !netInWater) env.emit('scoop', { position: evPos() });
      wasInWater = netInWater;
    }
    if (fillOn) fill += (1 - fill) * (1 - Math.exp(-P.bowl.fillRate * dt));
    if (place === 'pot' && splashed) cook = Math.min(1, cook + dt / 1.5);
    // お椀（生きた錨）と口
    let bowlMoved = false;
    if (place === 'bowl') {
      LY.bowl.updateWorldMatrix(true, false);
      const e = LY.bowl.matrixWorld.elements;
      let ok = true; for (let q = 0; q < 16; q++) if (!Number.isFinite(e[q])) ok = false;
      if (ok) for (let q = 0; q < 16; q++) bowlE[q] = e[q];
      bowlMoved = bowlE[12] !== bowlLast[0] || bowlE[13] !== bowlLast[1] || bowlE[14] !== bowlLast[2];
      bowlLast[0] = bowlE[12]; bowlLast[1] = bowlE[13]; bowlLast[2] = bowlE[14];
    }
    if (eating && mouth) { const e = mouth.matrixWorld.elements; if (Number.isFinite(e[12] + e[13] + e[14])) { mouthP[0] = e[12]; mouthP[1] = e[13]; mouthP[2] = e[14]; } }

    const tr = trans;
    if (tr) tr.t += dt;
    let morphing = false, done = true;
    const still = !tr && !force && ((place === 'board' && !hopOn) || (place === 'bowl' && !bowlMoved && fill > 0.995));
    if (!still || morphingAny()) {
      for (let i = 0; i < count; i++) {
        const nd = list[i];
        if (nd.morph < 1) { nd.morph = Math.min(1, nd.morph + dt / PN.morphTime); morphing = true; }
        if (tr && tr.kind === 'eat') {
          const D = tr.dur, q = clamp((tr.t - (count - 1 - i) / count * 0.45 * D) / (0.55 * D), 0, 1);
          shapeEat(i, nd, q);
          if (q < 1) done = false;
        } else {
          if (place === 'pot') { if (!tr) nd.potT += dt; }
          if (tr && tr.kind === 'bowl') {
            nd.feed = clamp((tr.t - 0.08 - i * tr.stg) / (P.bowl.feedBase + nd.L * P.bowl.feedPerMeter), 0, 1);
            if (nd.feed < 1) done = false;
          }
          switch (place) {
            case 'hand': shapeHang(i, nd); break;
            case 'net': shapeNet(i, nd); break;
            case 'pot': shapePot(i, nd); break;
            case 'bowl': shapeBowl(i, nd); break;
            default: shapeBoard(i, nd);
          }
          if (tr) {
            let e;
            if (tr.kind === 'bowl') e = smooth(tr.t / P.move.bowlBlend);
            else {
              const x = clamp((tr.t - i * tr.stg) / tr.dur, 0, 1);
              e = tr.ease === 1 ? easeOutCubic(x) : tr.ease === 2 ? x * x * (3 - 2 * x) * (0.6 + 0.4 * x) : smooth(x);
              if (x < 1) done = false;
            }
            if (tr.kind === 'bowl' && e < 1) done = false;
            const arc = tr.arc * Math.sin(Math.PI * e), f = nd.from, t = nd.tgt, p = nd.pts;
            for (let q = 0; q < K * 3; q += 3) { p[q] = f[q] + (t[q] - f[q]) * e; p[q + 1] = f[q + 1] + (t[q + 1] - f[q + 1]) * e + arc; p[q + 2] = f[q + 2] + (t[q + 2] - f[q + 2]) * e; }
            for (let q = 0; q < 3; q++) nd.wcur[q] = nd.wfrom[q] + (nd.wref[q] - nd.wfrom[q]) * e;
          } else { nd.pts.set(nd.tgt); nd.wcur.set(nd.wref); }
        }
        for (let q = 0; q < K * 3; q++) if (!Number.isFinite(nd.pts[q])) { nd.pts.set(nd.from); break; }   // NaN 防止
        writeTube(i, nd);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
      geo.setDrawRange(0, count * IPN);
      force = morphing;
      measure();
    }

    // イベント
    if (tr) {
      if (place === 'pot' && !splashed && tr.kind === 'lerp' && tr.t / tr.dur > 0.72) {
        splashed = true;
        v3[0] = clamp(center.x, potC.x - potR * 0.6, potC.x + potR * 0.6); v3[2] = clamp(center.z, potC.z - potR * 0.6, potC.z + potR * 0.6);
        env.emit('splash', { position: new THREE.Vector3(v3[0], potC.y, v3[2]) });
      }
      if (place === 'bowl' && !dropped && tr.t > 0.22) {
        dropped = true; fillOn = true;
        env.emit('drop', { position: new THREE.Vector3(bowlE[12], bowlE[13], bowlE[14]) });
      }
      if (done) {
        trans = null; force = true;
        if (tr.kind === 'eat') { count = 0; eating = false; geo.setDrawRange(0, 0); }
        if (!tr.quiet) env.emit('settled', { place });
      }
    }
  }
  function morphingAny() { for (let i = 0; i < count; i++) if (list[i].morph < 1) return true; return false; }

  return {
    mesh, center, bounds,
    get count() { return count; },
    get place() { return place; },
    get busy() { return !!trans && !trans.quiet; },
    get cook() { return cook; },
    get swinging() { return place === 'hand' || (place === 'net' && netHang > 0.5); },
    clear, addFromPiece, layout, cutLaid, begin, update,
    width(i) { return list[i].w; },
    tris() { return count * (IPN / 3); },
    bytes() { return nPos.byteLength * 2 + nUv.byteLength + nIdx.byteLength; },
    dispose() { geo.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
}
