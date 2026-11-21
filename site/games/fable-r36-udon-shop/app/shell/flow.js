// 遊びの流れ：何をつかんだか → 道具を動かす → hero に入力を渡す → 場所を決める（setPlace）。
// 手順は強制しない。どの順で触っても先へ進める。失敗も時間制限もない。
import { THREE } from './three.js';
import { L } from './layout.js';
import { clamp, lerp, smooth, damp, dampV, easeInOut } from './util.js';

const TOP = L.board.center.y;             // まな板の上面の高さ
const HINT_DELAY = 4.0;                   // 触らずにいたらヒントを出すまでの秒
const CAM_DUR = 1.6;                      // カメラ移動の秒（ゆっくり）
const MAX_PER_TOPPING = 3;
const HOLD_ABOVE = 0.20;                  // 麺の束をつまむ高さ（下の物から）。長い麺（片足 0.23）も宙に垂れるよう 0.16 → 0.20
const TAP_TIME = 0.35;                    // これより短く、動かさずに離したら「タップ」
const V3 = () => new THREE.Vector3();

export class Flow {
  constructor({ world, hero, customers, fx, sfx, camera, pointer }) {
    this.w = world; this.o = world.objs; this.hero = hero; this.cust = customers;
    this.fx = fx; this.sfx = sfx; this.camera = camera; this.pointer = pointer;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.time = 0; this.mode = 'play'; this.round = 0;
    this.grab = null; this.lastTouch = -HINT_DELAY + 1.2; this.hint = null; this.hintT = 0;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = V3(); this.tmp2 = V3(); this.tmp3 = V3();

    // hero への入力（毎フレーム書き換える同じオブジェクト）
    this.hin = {
      time: 0,
      pointer: { phase: 'none', active: false, part: null, hitPoint: V3(), boardPoint: V3(), ray: new THREE.Ray() },
      chops: [],
      pin: { active: false, center: V3(), radius: L.pin.radius, length: L.pin.length, dz: 0 },
      stir: { active: false, point: V3(), velocity: V3() },
      hold: V3(), net: V3(), netInWater: false,
    };
    this._chopPool = [V3(), V3(), V3()];

    this.knife = { pos: L.knifeRest.clone(), target: L.knifeRest.clone(), up: 0, onBoard: false, chopT: -1, lastChopX: null, lastChopTime: -1, hover: 0.05, hop: 0 };
    this.pin = { pos: L.pinRest.clone(), target: L.pinRest.clone(), angle: 0, prevZ: L.pinRest.z, hop: 0, ride: 0, auto: null };
    this.net = { pos: L.netRest.clone(), target: L.netRest.clone(), dwell: 0, hop: 0, auto: null };
    this.bowl = { pos: L.bowlRest.clone(), target: L.bowlRest.clone(), fill: 0, fillTarget: 0, toppings: [], counts: { negi: 0, kamaboko: 0, ebiten: 0, oage: 0 }, color: 0, wiggle: 0, hop: 0, serveFrom: V3() };
    this.flying = [];
    this.water = { omega: 0, swirlT: 0, prev: V3(), has: false };
    this.hold = { pos: V3(), init: false };
    this.cam = { from: null, to: 'work', t: CAM_DUR, fov: { work: 45, serve: 45 }, targets: {}, pos: V3(), target: V3() };
    this.camScratch = new THREE.PerspectiveCamera();
    this.serveT = 0; this.served = null;
    this.stats = { serves: 0, cuts: 0 };
  }

  // ---------- カメラ ----------
  resize(aspect) {
    for (const k of ['work', 'serve']) this.cam.fov[k] = this.fitFov(L.camera[k], aspect, k);
    this.applyCamera(true);
  }
  // 決めた点が全部入る画角を求め、上下左右の余白がそろうよう注視点を少し回す
  fitFov(preset, aspect, key) {
    const c = this.camScratch;
    const target = (this.cam.targets[key] || (this.cam.targets[key] = new THREE.Vector3())).copy(preset.target);
    let need = 0.2;
    for (let it = 0; it < 3; it++) {
      c.position.copy(preset.pos); c.lookAt(target); c.updateMatrixWorld(true);
      const inv = c.matrixWorldInverse.copy(c.matrixWorld).invert();
      let ymin = 9, ymax = -9, xmin = 9, xmax = -9;
      for (const p of preset.fit) {
        const q = this.tmp.copy(p).applyMatrix4(inv), d = Math.max(0.05, -q.z);
        ymin = Math.min(ymin, Math.atan2(q.y, d)); ymax = Math.max(ymax, Math.atan2(q.y, d));
        xmin = Math.min(xmin, Math.atan2(q.x, d)); xmax = Math.max(xmax, Math.atan2(q.x, d));
      }
      const tanY = Math.tan((ymax - ymin) / 2), tanX = Math.tan((xmax - xmin) / 2);
      need = Math.max(tanY, tanX / aspect);
      // 注視点を中央へ（カメラ座標で回してワールドへ戻す）
      const dist = target.distanceTo(preset.pos);
      const ay = (ymax + ymin) / 2, ax = (xmax + xmin) / 2;
      this.tmp2.set(Math.tan(ax) * dist, Math.tan(ay) * dist, -dist).applyMatrix4(c.matrixWorld);
      target.copy(this.tmp2);
    }
    return clamp(2 * Math.atan(need * 1.05) * 180 / Math.PI, 26, 80);
  }
  goCamera(name) {
    if (this.cam.to === name) return;
    this.cam.from = { pos: this.camera.position.clone(), target: this.cam.target.clone(), fov: this.camera.fov };
    this.cam.to = name; this.cam.t = 0;
  }
  applyCamera(force, dt = 0) {
    const c = this.cam, P = L.camera[c.to];
    if (c.t < CAM_DUR && c.from) {
      c.t += dt;
      const e = easeInOut(c.t / CAM_DUR);
      this.camera.position.lerpVectors(c.from.pos, P.pos, e);
      c.target.lerpVectors(c.from.target, c.targets[c.to] || P.target, e);
      this.camera.fov = lerp(c.from.fov, c.fov[c.to], e);
    } else if (force || c.t >= CAM_DUR) {
      this.camera.position.copy(P.pos); c.target.copy(c.targets[c.to] || P.target); this.camera.fov = c.fov[c.to];
    }
    this.camera.lookAt(c.target);
    this.camera.updateProjectionMatrix();
  }

  // ---------- 入力 ----------
  setRay(ev) {
    this.ndc.set((ev.x / ev.w) * 2 - 1, -(ev.y / ev.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }
  planeHit(y, out = this.tmp) {
    this.plane.constant = -y;
    const r = this.raycaster.ray.intersectPlane(this.plane, out);
    if (!r) out.set(0, y, 0);
    return out;
  }
  pick() {
    const list = [];
    for (const p of this.w.proxies) if (p.userData.enabled !== false) list.push(p);
    for (const p of this.hero.hitTargets) if (p.userData.enabled !== false) list.push(p);
    const hits = this.raycaster.intersectObjects(list, false);
    if (!hits.length) return null;
    const h = hits[0];
    return { kind: h.object.userData.kind || h.object.userData.heroPart, object: h.object, point: h.point.clone() };
  }
  handleEvents(dt) {
    const evs = this.pointer.drain();
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      this.setRay(ev);
      if (ev.type === 'down') this.onDown(ev);
      else if (ev.type === 'move') this.onMove(ev);
      else this.onUp(ev);
      // hero に down と up を同じフレームで渡さない（素早いタップでも「へこむ」が見えるように）
      if (ev.type === 'down' && this.hin.pointer.phase === 'down' && i + 1 < evs.length) {
        this.pointer.events.unshift(...evs.slice(i + 1));
        break;
      }
    }
    this.lastEv = this.lastEv || null;
  }
  onDown(ev) {
    this.sfx.unlock();
    this.lastTouch = this.time; this.setHint(null);
    this.lastEv = ev;
    const hit = this.pick();
    if (this.mode !== 'play') {
      if (hit && hit.kind === 'customer' && this.cust.current) this.cust.current.giggle();
      return;
    }
    if (!hit) return;
    const g = this.grab = { kind: hit.kind, data: hit.object.userData, point: hit.point, t0: this.time, sx: ev.x, sy: ev.y, moved: false, piece: null };
    const st = this.hero.getState();
    switch (hit.kind) {
      case 'dough': {
        const hp = this.hin.pointer;
        hp.phase = 'down'; hp.active = true; hp.part = 'dough'; hp.hitPoint.copy(hit.point);
        this.planeHit(TOP, hp.boardPoint); hp.ray.copy(this.raycaster.ray);
        break;
      }
      case 'noodles':
        if (st.place === 'board') { this.hero.setPlace('hand'); this.sfx.play('pick'); this.hold.init = false; this.updateHold(0, true); }
        else this.grab = null;
        break;
      case 'knife': {   // つかんだ点と包丁のずれを保つ（タップしても包丁が跳ばない）
        const k = this.knife, q = this.planeHit(TOP, this.tmp2);
        g.offX = clamp(k.target.x - q.x, -0.12, 0.12); g.offZ = clamp(k.target.z - q.z, -0.2, 0.2);
        this.sfx.play('grab'); k.onBoard = false; k.step = 0; break;
      }
      case 'pin': this.sfx.play('grab'); this.pin.auto = null; break;
      case 'net': this.sfx.play('grab'); this.net.auto = null; break;
      case 'dish': this.o.dishes[g.data.index].wig = 1; break;
      case 'bowl':
        if (!this.servable()) {
          this.bowl.wiggle = 1; this.sfx.play('putdown'); this.grab = null;
          if (st.place === 'net') this.netAuto('deliver');   // 網に麺があれば、お椀を触ると網が入れに来る
        } else this.sfx.play('grab');
        break;
      case 'water':   // 触っただけでも湯がくるっと回って泡が立つ
        this.water.has = false; this.water.omega += this.water.omega >= 0 ? 1.2 : -1.2;
        this.fx.sparkle(hit.point, 4, '#e9fbff', 0.12); this.sfx.play('swirl');
        // まな板に切った麺があれば、光っている鍋を触るだけで麺が「じゃぽん」と入る
        if (st.place === 'board' && st.cutCount > 0 && !st.busy) this.hero.setPlace('pot');
        break;
      case 'customer':
        if (this.servable()) this.serve(); else if (this.cust.current) this.cust.current.giggle();
        this.grab = null; break;
      case 'table': this.fx.puff(hit.point, 3); this.grab = null; break;
      default: this.grab = null;
    }
  }
  onMove(ev) {
    this.lastEv = ev;
    const g = this.grab; if (!g) return;
    if (!g.moved && Math.hypot(ev.x - g.sx, ev.y - g.sy) > 10) g.moved = true;
  }
  onUp(ev) {
    this.lastTouch = this.time;
    const g = this.grab; this.grab = null;
    if (!g) return;
    const st = this.hero.getState();
    const tap = !g.moved && this.time - g.t0 < TAP_TIME;
    switch (g.kind) {
      case 'dough': { const hp = this.hin.pointer; hp.phase = 'up'; hp.active = false; this.planeHit(TOP, hp.boardPoint); break; }
      case 'noodles': {
        if (st.place !== 'hand') break;
        // タップ（つまんですぐ離す）なら麺は鍋へ「じゃぽん」。ドラッグなら離した所へ
        const where = tap ? 'pot' : this.rayOver();
        this.hero.setPlace(where === 'pot' ? 'pot' : where === 'bowl' ? 'bowl' : 'board');
        if (where !== 'pot' && where !== 'bowl') this.sfx.play('putdown');
        break;
      }
      case 'knife': {
        const k = this.knife;
        if (tap && k.up > 0.5) { this.startChop(); k.step = 0.018 + Math.random() * 0.016; }   // とん → 少し右へ進む（太さはばらばら）
        if (this.inBoard(k.target.x, k.target.z, 0.0)) { k.onBoard = true; } else { k.onBoard = false; k.target.copy(L.knifeRest); this.sfx.play('putdown'); }
        if (tap && !k.onBoard) {
          // 置き場の包丁をタップ → 生地の左はしの上へ「ひょい」と乗る（あとはタップするたびに とん）
          const b = st.place === 'board' && this.heroBounds();
          if (b) { k.target.set(b.x0 + 0.022, 0, clamp((b.z0 + b.z1) / 2 - 0.03, -0.26, 0.42)); k.onBoard = true; k.hop = 1; this.sfx.play('grab'); }
          else k.hop = 1;
        }
        break;
      }
      case 'pin':
        this.pin.target.copy(L.pinRest); this.hin.pin.active = false;
        if (tap) { if (!this.pinAuto()) this.pin.hop = 1; }   // タップ → 生地の上をごろごろ1往復
        break;
      case 'net':
        if (st.place === 'net' && (this.rayOver() === 'bowl' || this.whereOver(this.net.pos.x, this.net.pos.z) === 'bowl')) this.hero.setPlace('bowl');
        this.net.target.copy(L.netRest);
        if (tap) {   // タップ → 鍋の麺をすくう／網の麺をお椀へ
          if (st.place === 'pot') this.netAuto('scoop');
          else if (st.place === 'net') this.netAuto('deliver');
          else this.net.hop = 1;
        }
        break;
      case 'dish': {
        const type = g.data.type;
        if (g.piece) {
          if (this.rayOver() === 'bowl' && this.bowl.counts[type] < MAX_PER_TOPPING) this.launchTopping(type, g.piece, true);
          else this.flyBack(g.piece, g.data.index);
        } else if (this.bowl.counts[type] < MAX_PER_TOPPING) {
          const piece = this.makePiece(type);
          piece.position.copy(this.o.dishes[g.data.index].base); piece.position.y += 0.02;
          this.launchTopping(type, piece, false);
        } else { this.o.dishes[g.data.index].wig = 1.5; this.sfx.play('hop'); }
        break;
      }
      case 'bowl':
        if (this.mode !== 'play') break;
        if (tap && this.servable()) { this.serve(); break; }   // 中身のあるお椀をタップ → お客さんへ
        this.bowl.target.copy(L.bowlRest); this.sfx.play('putdown');
        break;
      case 'water': this.hin.stir.active = false; break;
    }
  }

  // ---------- 場所 ----------
  inBoard(x, z, m) { const b = L.board; return Math.abs(x - b.center.x) < b.sizeX / 2 + m && Math.abs(z - b.center.z) < b.sizeZ / 2 + m; }
  whereOver(x, z) {
    const P = L.pot.base, B = this.bowl.pos;
    if (Math.hypot(x - P.x, z - P.z) < L.pot.radius + 0.03) return 'pot';
    if (Math.hypot(x - B.x, z - B.z) < L.bowl.outerR + 0.06) return 'bowl';
    if (this.inBoard(x, z, 0.02)) return 'board';
    return 'counter';
  }
  surfaceAt(x, z) {
    const w = this.whereOver(x, z);
    return w === 'pot' ? L.pot.stove + L.pot.height + 0.01 : w === 'bowl' ? this.bowl.pos.y + L.bowl.height : w === 'board' ? TOP : 0;
  }
  heroBounds() {
    for (const p of this.hero.hitTargets) {
      if (p.userData.enabled === false) continue;
      const q = p.position, s = p.scale;
      return { x0: q.x - s.x / 2, x1: q.x + s.x / 2, z0: q.z - s.z / 2, z1: q.z + s.z / 2, top: q.y + s.y / 2, part: p.userData.heroPart };
    }
    return null;
  }
  // 網が自分で動く（タップしたとき）：鍋に沈めてすくう／お椀の上へ運んで入れる
  netAuto(kind) {
    const P = L.pot.base, n = this.net, B = this.bowl.pos;
    if (kind === 'scoop') {
      n.auto = { i: 0, t: 0, steps: [
        { p: new THREE.Vector3(P.x + 0.02, 0.27, P.z + 0.01), dur: 0.35 },
        { p: new THREE.Vector3(P.x + 0.02, L.pot.water - 0.035, P.z + 0.01), dur: 0.55, act: () => { if (this.hero.getState().place === 'pot') this.hero.setPlace('net'); } },
        { p: new THREE.Vector3(P.x + 0.02, 0.29, P.z + 0.01), dur: 0.45 },
        { p: L.netRest, dur: 0.3 },
      ] };
    } else {
      const top = B.y + L.bowl.height + 0.08;
      n.auto = { i: 0, t: 0, steps: [
        { p: new THREE.Vector3(B.x, top + 0.05, B.z - 0.02), dur: 0.6, act: () => { if (this.hero.getState().place === 'net') this.hero.setPlace('bowl'); } },
        { p: new THREE.Vector3(B.x, top + 0.05, B.z - 0.02), dur: 0.5 },
        { p: L.netRest, dur: 0.3 },
      ] };
    }
    this.sfx.play('grab');
  }
  // めん棒が自分で転がる（タップしたとき）：生地の奥へ → 手前へ → 置き場
  pinAuto() {
    const st = this.hero.getState(), b = this.heroBounds();
    if (st.place !== 'board' || !b || b.part !== 'dough') return false;
    const x = clamp((b.x0 + b.x1) / 2, L.board.center.x - 0.06, L.board.center.x + 0.06), bz = L.board;
    const zN = clamp(b.z1 + 0.03, bz.center.z - bz.sizeZ / 2 + 0.03, L.pinRest.z), zF = clamp(b.z0 + 0.01, bz.center.z - bz.sizeZ / 2 + 0.03, L.pinRest.z);
    this.pin.auto = { i: 0, t: 0, steps: [
      { p: new THREE.Vector3(x, 0, zN), dur: 0.35 },
      { p: new THREE.Vector3(x, 0, zF), dur: 0.7, roll: true },
      { p: new THREE.Vector3(x, 0, zN), dur: 0.7, roll: true },
      { p: L.pinRest, dur: 0.3 },
    ] };
    this.sfx.play('grab');
    return true;
  }
  stepAuto(o, dt) {   // 自動の動きを1歩すすめる（target を書き換える）。戻り値は今の段
    const a = o.auto; if (!a) return null;
    const s = a.steps[a.i];
    o.target.copy(s.p);
    a.t += dt;
    if (a.t >= s.dur) { if (s.act) s.act(); a.i++; a.t = 0; if (a.i >= a.steps.length) o.auto = null; }
    return s;
  }
  servable() { return this.hero.getState().place === 'bowl' || this.bowl.toppings.length > 0; }

  // ---------- 毎フレーム ----------
  update(dt) {
    this.time += dt;
    this.handleEvents(dt);
    const st = this.hero.getState();
    const g = this.grab;
    const hin = this.hin;
    hin.time = this.time;

    // つかんでいる物を指に合わせる
    if (g) {
      if (g.kind === 'dough') {
        const hp = hin.pointer;
        if (hp.phase === 'none') hp.phase = 'move';
        this.planeHit(TOP, hp.boardPoint); hp.ray.copy(this.raycaster.ray);
      } else if (g.kind === 'noodles') this.updateHold(dt, false);
      else if (g.kind === 'knife') this.dragKnife(dt, g);
      else if (g.kind === 'pin') this.dragPin(g);
      else if (g.kind === 'net') this.dragNet(dt, st);
      else if (g.kind === 'dish') this.dragTopping(g);
      else if (g.kind === 'bowl') this.dragBowl();
      else if (g.kind === 'water') this.stir(dt);
    }
    if (!g || g.kind !== 'water') { hin.stir.active = false; }
    if (!g || g.kind !== 'pin') hin.pin.active = false;

    this.animateTools(dt, st);
    this.animateToppings(dt);
    this.updatePot(dt, st);

    // 生きた錨（お椀・お客さんの口）を hero が読む前に更新
    this.o.bowl.updateMatrixWorld(true);
    if (this.cust.current) this.cust.current.root.updateMatrixWorld(true);

    // hero
    hin.net.copy(this.net.pos);
    const P = L.pot.base;
    hin.netInWater = Math.hypot(this.net.pos.x - P.x, this.net.pos.z - P.z) < L.pot.inner * 0.85 && this.net.pos.y < L.pot.water;
    this.hero.update(dt, hin);
    hin.pointer.phase = 'none'; hin.chops.length = 0; hin.pin.dz = 0;
    if (!hin.pointer.active) hin.pointer.part = null;

    if (this.mode === 'serving') this.updateServe(dt);
    this.updateHint(dt);
    // お客さんは触っている所を見る
    if (this.cust.current) this.cust.current.lookX = g ? (this.lastEv ? (this.lastEv.x / this.lastEv.w - 0.5) : 0) : (st.center.x - L.customer.x) * 0.8;
    this.applyCamera(false, dt);
  }

  // 指の光線が今どの物の上にあるか（物の高さの面で判定する）
  rayOver() {
    const P = L.pot.base, B = this.bowl.pos, q = this.tmp3;
    this.planeHit(L.pot.water, q);
    if (Math.hypot(q.x - P.x, q.z - P.z) < L.pot.radius + 0.03) return 'pot';
    this.planeHit(B.y + L.bowl.height * 0.7, q);
    if (Math.hypot(q.x - B.x, q.z - B.z) < L.bowl.outerR + 0.05) return 'bowl';
    this.planeHit(TOP, q);
    if (this.inBoard(q.x, q.z, 0.02)) return 'board';
    return 'counter';
  }
  // 麺の束をつまむ点：指の下、下にある物の 0.16 上（束が指からぶら下がって見える）
  updateHold(dt, snap) {
    const w = this.rayOver();
    const base = w === 'pot' ? L.pot.stove + L.pot.height : w === 'bowl' ? this.bowl.pos.y + L.bowl.height : TOP;
    const p = this.planeHit(base + HOLD_ABOVE, this.tmp2);
    this.tmp2.set(clamp(p.x, -0.75, 0.8), p.y, clamp(p.z, -0.28, 0.44));
    if (snap || !this.hold.init) { this.hold.pos.copy(this.tmp2); this.hold.init = true; }
    else dampV(this.hold.pos, this.tmp2, 22, dt);
    this.hin.hold.copy(this.hold.pos);
  }
  dragKnife(dt, g) {
    const k = this.knife;
    const p = this.planeHit(TOP, this.tmp2);
    k.target.set(clamp(p.x + (g.offX || 0), -0.62, 0.78), 0, clamp(p.z + (g.offZ == null ? -0.03 : g.offZ), -0.26, 0.42));
    // 刃が自動で「とんとん」下りる：動かした距離と間隔で太さが決まる
    if (g.moved && k.up > 0.8 && k.chopT < 0 && this.inBoard(k.pos.x, k.pos.z, -0.01) && this.time - k.lastChopTime >= 0.15 &&
        (k.lastChopX === null || Math.abs(k.pos.x - k.lastChopX) >= 0.010)) this.startChop();
  }
  startChop() { const k = this.knife; if (k.chopT >= 0) return; k.chopT = 0; k.chopX = k.pos.x; k.lastChopX = k.pos.x; k.lastChopTime = this.time; }
  dragPin(g) {
    const r = L.pin.radius, b = L.board;
    const p = this.planeHit(TOP + r, this.tmp2);
    this.pin.target.set(clamp(p.x, b.center.x - 0.06, b.center.x + 0.06), 0, clamp(p.z, b.center.z - b.sizeZ / 2 + 0.03, L.pinRest.z));
    const pi = this.hin.pin;
    pi.active = this.inBoard(this.pin.pos.x, this.pin.pos.z, -0.02);
    pi.center.copy(this.pin.pos);
  }
  dragNet(dt, st) {
    const n = this.net;
    const w = this.rayOver();
    const y = w === 'pot' ? L.pot.water - 0.035 : w === 'board' ? TOP + 0.05 : w === 'bowl' ? this.bowl.pos.y + L.bowl.height + 0.06 : 0.22;
    const p = this.planeHit(w === 'pot' ? L.pot.water : y, this.tmp2);
    n.target.set(clamp(p.x, -0.6, 0.8), y, clamp(p.z, -0.28, 0.44));
    // すくう：鍋の湯に沈めた／まな板の麺に近づけた
    if (st.place === 'pot' && this.hin.netInWater) { n.dwell += dt; if (n.dwell > 0.15) { this.hero.setPlace('net'); n.dwell = 0; } }
    else n.dwell = 0;
    if (st.place === 'board' && !st.busy && Math.hypot(n.pos.x - st.center.x, n.pos.z - st.center.z) < 0.12 && n.pos.y < TOP + 0.09) this.hero.setPlace('net');
  }
  dragTopping(g) {
    if (!g.moved) return;
    if (!g.piece) {
      if (this.bowl.counts[g.data.type] >= MAX_PER_TOPPING) { this.o.dishes[g.data.index].wig = 1.5; return; }
      g.piece = this.makePiece(g.data.type); this.sfx.play('pick');
    }
    const p = this.planeHit(0.05, this.tmp2);
    g.piece.position.set(clamp(p.x, -0.7, 0.8), 0.1, clamp(p.z, -0.28, 0.44));
    g.piece.rotation.y += 0.02;
  }
  dragBowl() {
    const p = this.planeHit(0, this.tmp2);
    this.bowl.target.set(clamp(p.x, -0.6, 0.75), 0, clamp(p.z, -0.4, 0.4));
    if (this.bowl.pos.z < L.counter.minZ + 0.04) { this.grab = null; this.serve(); }   // お客さんの方へ引いたら渡す
  }
  stir(dt) {
    const p = this.planeHit(L.pot.water, this.tmp2), s = this.hin.stir, w = this.water, P = L.pot.base;
    if (w.has && dt > 0) {
      s.velocity.subVectors(p, w.prev).divideScalar(Math.max(dt, 1 / 120));
      // 渦の角速度 = 接線方向の速さ / 半径
      const rx = p.x - P.x, rz = p.z - P.z, r = Math.max(0.03, Math.hypot(rx, rz));
      const tang = (rx * s.velocity.z - rz * s.velocity.x) / r;
      w.omega = clamp(w.omega + (tang / r) * dt * 1.5, -3, 3);
      w.swirlT -= dt;
      if (w.swirlT < 0 && s.velocity.length() > 0.1) { this.sfx.play('swirl'); w.swirlT = 0.3; }
    } else s.velocity.set(0, 0, 0);
    w.prev.copy(p); w.has = true;
    s.active = true; s.point.copy(p);
  }

  // ---------- 道具の動き ----------
  animateTools(dt, st) {
    const k = this.knife, o = this.o;
    const grabbing = this.grab && this.grab.kind === 'knife';
    const upT = grabbing || k.onBoard ? 1 : 0;
    k.up = damp(k.up, upT, 14, dt);
    if (!grabbing && !k.onBoard) k.target.copy(L.knifeRest);
    const overBoard = this.inBoard(k.pos.x, k.pos.z, 0.01);
    const base = overBoard ? TOP : 0;
    const hover = base + (k.up > 0.5 ? 0.05 : 0.002);
    k.pos.x = damp(k.pos.x, k.target.x, 25, dt); k.pos.z = damp(k.pos.z, k.target.z, 25, dt);
    let y = damp(k.pos.y, hover, 18, dt);
    if (k.chopT >= 0) {
      const t = k.chopT; k.chopT += dt;
      const down = 0.05, upd = 0.09;
      const prevT = t, f = t < down ? t / down : Math.max(0, 1 - (t - down) / upd);
      y = hover - (hover - base) * f;
      if (prevT < down && k.chopT >= down) {   // 刃がまな板に触れた瞬間
        this.sfx.play('ton');
        if (overBoard) { const c = this._chopPool[this.hin.chops.length % 3]; c.set(k.pos.x, TOP, k.pos.z); this.hin.chops.push(c); }
      }
      if (k.chopT > down + upd) {
        k.chopT = -1;
        if (k.step && !grabbing && k.onBoard) {   // タップで切った：次の「とん」の場所へ少し進む
          const b = this.heroBounds();
          if (b && k.target.x + k.step < b.x1 - 0.006) k.target.x += k.step;
          else { k.onBoard = false; k.hop = 1; this.sfx.play('putdown'); }   // 端まで切ったら置き場へ戻る
        }
        k.step = 0;
      }
    }
    k.pos.y = y;
    k.hop = Math.max(0, k.hop - dt * 3);
    o.knife.position.set(k.pos.x, k.pos.y + this.hintHop('knife') + Math.sin(k.hop * Math.PI) * 0.02, k.pos.z);
    o.knife.rotation.z = (1 - k.up) * (-Math.PI / 2);
    o.knifeShadow.position.set(k.pos.x + 0.02 * (1 - k.up), base + 0.0015, k.pos.z);
    o.knifeShadow.scale.set(0.04 + 0.05 * (1 - k.up), 1, 0.3);

    // めん棒
    const p = this.pin, r = L.pin.radius;
    const pinStep = this.grab && this.grab.kind === 'pin' ? null : this.stepAuto(p, dt);
    if (!(this.grab && this.grab.kind === 'pin') && !pinStep) p.target.copy(L.pinRest);
    if (pinStep && pinStep.roll) { this.hin.pin.active = this.inBoard(p.pos.x, p.pos.z, -0.02); this.hin.pin.center.copy(p.pos); }
    p.pos.x = damp(p.pos.x, p.target.x, pinStep ? 8 : 18, dt); p.pos.z = damp(p.pos.z, p.target.z, pinStep ? 8 : 18, dt);
    // 生地の上では、生地の厚さぶん持ち上げて乗せる（板の高さのままだと生地に沈んで見える）
    const hb = this.heroBounds();
    const onDough = hb && hb.part === 'dough' && this.hero.getState().place === 'board' &&
      p.pos.z > hb.z0 - r && p.pos.z < hb.z1 + r && p.pos.x + L.pin.length / 2 > hb.x0 && p.pos.x - L.pin.length / 2 < hb.x1;
    p.ride = damp(p.ride, onDough ? Math.max(0, hb.top - TOP - 0.006) * 0.85 : 0, 16, dt);
    const py = (this.inBoard(p.pos.x, p.pos.z, -0.01) ? TOP + p.ride : 0) + r;
    p.pos.y = damp(p.pos.y, py, 20, dt);
    const dz = p.pos.z - p.prevZ; p.prevZ = p.pos.z;
    p.angle += dz / r;
    if (this.hin.pin.active) this.hin.pin.dz += dz;
    this.hin.pin.center.copy(p.pos);
    p.hop = Math.max(0, p.hop - dt * 3);
    o.pin.position.set(p.pos.x, p.pos.y + this.hintHop('pin') + Math.sin(p.hop * Math.PI) * 0.02, p.pos.z);
    o.pinMesh.rotation.x = p.angle;
    o.pinShadow.position.set(p.pos.x, p.pos.y - r + 0.0015, p.pos.z);

    // 網
    const n = this.net;
    const netStep = this.grab && this.grab.kind === 'net' ? null : this.stepAuto(n, dt);
    if (!(this.grab && this.grab.kind === 'net') && !netStep) n.target.copy(L.netRest);
    dampV(n.pos, n.target, 14, dt);
    n.hop = Math.max(0, n.hop - dt * 3);
    o.net.position.set(n.pos.x, n.pos.y + this.hintHop('net') + Math.sin(n.hop * Math.PI) * 0.02, n.pos.z);

    // お椀
    const b = this.bowl;
    if (this.mode === 'play') {
      if (!(this.grab && this.grab.kind === 'bowl')) b.target.copy(L.bowlRest);
      dampV(b.pos, b.target, 16, dt);
    }
    b.wiggle = Math.max(0, b.wiggle - dt * 2.5);
    o.bowl.position.set(b.pos.x, b.pos.y + this.hintHop('bowl'), b.pos.z);
    o.bowl.rotation.z = Math.sin(b.wiggle * 18) * 0.08 * b.wiggle;
    o.bowlShadow.position.set(b.pos.x, b.pos.y > 0.05 ? L.serve.top + 0.001 : 0.001, b.pos.z);
    b.fill = damp(b.fill, b.fillTarget, 2.5, dt);
    const lvl = L.bowl.brothLevel * b.fill;
    o.broth.visible = b.fill > 0.02;
    o.broth.position.y = lvl;
    o.broth.scale.setScalar(this.w.brothRadiusAt(lvl));

    // 小皿のぴょこっ
    o.dishes.forEach((d, i) => {
      d.wig = Math.max(0, (d.wig || 0) - dt * 3);
      const hh = this.hint === 'dishes' ? this.hintHop('dish' + i) : 0;
      d.group.position.y = d.base.y + Math.sin(Math.min(1, d.wig) * Math.PI) * 0.015 + hh;
      d.group.rotation.z = Math.sin(d.wig * 20) * 0.05 * Math.min(1, d.wig);
    });
  }

  // ---------- 鍋（湯気・泡・渦） ----------
  updatePot(dt, st) {
    const w = this.water, P = L.pot.base;
    w.omega = damp(w.omega, 0, 0.7, dt);
    this.o.water.rotation.y += w.omega * dt * 0.6 + dt * 0.05;
    this.tmp3.set(P.x, L.pot.water, P.z);
    const inPot = st.place === 'pot';
    this.fx.setSteam(this.tmp3, 0.11, inPot ? 4 : 2);
    this.fx.setBubbles(inPot ? 7 : 2, L.pot.water);
    this.fx.onBubble = inPot ? () => this.sfx.play('bubble') : null;
  }

  // ---------- 具 ----------
  makePiece(type) {
    const t = this.o.toppings;
    const m = new THREE.Mesh(t.geos[type], t.mats[type]);
    m.userData.type = type;
    this.w.scene.add(m);
    return m;
  }
  // 具をお椀へ飛ばす（dragged=true なら指を離した場所から）
  launchTopping(type, piece, dragged) {
    const b = this.bowl;
    const n = b.toppings.length;
    const a = n * 2.39996 + Math.random() * 0.4, r = n === 0 ? 0.0 : 0.022 + (n % 3) * 0.012;
    const local = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    if (dragged) {   // 離した場所の近くに置く
      this.tmp.copy(piece.position); this.o.bowlAnchor.worldToLocal(this.tmp);
      local.x = clamp(this.tmp.x, -0.05, 0.05); local.z = clamp(this.tmp.z, -0.05, 0.05);
    }
    b.counts[type]++;
    b.toppings.push({ type, mesh: piece, local, landed: false });
    this.flying.push({ mesh: piece, from: piece.position.clone(), local, t: 0, dur: dragged ? 0.25 : 0.5, mode: 'toBowl', spin: (Math.random() - 0.5) * 6, rot0: piece.rotation.y });
    this.sfx.play('pon');
  }
  flyBack(piece, idx) {
    this.flying.push({ mesh: piece, from: piece.position.clone(), to: this.o.dishes[idx].base.clone().setY(0.02), t: 0, dur: 0.3, mode: 'toDish' });
    this.sfx.play('putdown');
  }
  toppingY() { return Math.max(0.006, L.bowl.brothLevel * this.bowl.fill + 0.004) + (this.hero.getState().place === 'bowl' ? 0.016 : 0); }   // 麺のいちばん上はつゆ面 + 0.015〜0.02
  animateToppings(dt) {
    const anchor = this.o.bowlAnchor;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      const u = clamp(f.t / f.dur, 0, 1), e = smooth(u);
      if (f.mode === 'toBowl') {
        this.tmp.set(f.local.x, this.toppingY(), f.local.z); anchor.localToWorld(this.tmp);
        f.mesh.position.lerpVectors(f.from, this.tmp, e);
        f.mesh.position.y += Math.sin(u * Math.PI) * (f.dur > 0.3 ? 0.13 : 0.04);
        f.mesh.rotation.y = f.rot0 + f.spin * u;
        if (u >= 1) {
          anchor.add(f.mesh); f.mesh.position.set(f.local.x, this.toppingY(), f.local.z);
          f.mesh.rotation.set(0, f.rot0 + f.spin, 0);
          const tp = this.bowl.toppings.find((x) => x.mesh === f.mesh); if (tp) tp.landed = true;
          this.fx.sparkle(this.tmp, 4); this.sfx.play('drop', {});
          this.flying.splice(i, 1);
        }
      } else if (f.mode === 'toDish') {
        f.mesh.position.lerpVectors(f.from, f.to, e);
        f.mesh.scale.setScalar(Math.max(0.001, 1 - e));
        if (u >= 1) { this.w.scene.remove(f.mesh); this.flying.splice(i, 1); }
      } else if (f.mode === 'toMouth') {
        if (f.t < 0) continue;
        f.target.getWorldPosition(this.tmp);
        f.mesh.position.lerpVectors(f.from, this.tmp, e);
        f.mesh.scale.setScalar(Math.max(0.001, 1 - e * 0.9));
        if (u >= 1) { this.w.scene.remove(f.mesh); this.flying.splice(i, 1); }
      }
    }
    // お椀の中の具はつゆに浮く
    const y = this.toppingY();
    for (const t of this.bowl.toppings) if (t.landed && t.mesh.parent === anchor) t.mesh.position.y = damp(t.mesh.position.y, y, 6, dt);
  }

  // ---------- 渡す ----------
  serve() {
    if (this.mode !== 'play') return;
    if (this.grab && this.grab.kind === 'dough') { this.hin.pointer.phase = 'up'; this.hin.pointer.active = false; }
    this.grab = null;
    this.mode = 'serving'; this.serveT = 0; this.setHint(null);
    this.bowl.serveFrom.copy(this.bowl.pos);
    this.served = { noodles: this.hero.getState().place === 'bowl', ate: false, happy: false, gift: false, leave: false, next: false };
    this.goCamera('serve');
    if (this.cust.current) this.cust.current.setState('want');
    this.sfx.play('slide');
    this.stats.serves++;
  }
  updateServe(dt) {
    const t = (this.serveT += dt), s = this.served, b = this.bowl, c = this.cust.current;
    // お椀がカウンターを滑ってお客さんの前へ
    if (t < 0.8) {
      const u = easeInOut(t / 0.8);
      b.pos.lerpVectors(b.serveFrom, L.serveSpot, u);
      b.pos.y = lerp(b.serveFrom.y, L.serveSpot.y, smooth(t / 0.5)) + Math.sin(u * Math.PI) * 0.04;
    } else b.pos.copy(L.serveSpot);
    if (!s.ate && t > 1.0) {
      s.ate = true;
      if (c) c.setState('eat');
      if (s.noodles && c) { this.hero.setPlace('eaten', { mouth: c.mouth, duration: 1.6 }); this.sfx.play('zuzu'); }
      // 具も口へ
      b.toppings.forEach((tp, i) => {
        tp.mesh.getWorldPosition(this.tmp); this.w.scene.attach(tp.mesh);
        this.flying.push({ mesh: tp.mesh, from: this.tmp.clone(), target: c ? c.mouth : this.o.bowlAnchor, t: -0.3 * i - (s.noodles ? 0.9 : 0), dur: 0.35, mode: 'toMouth' });
      });
      if (b.toppings.length) this.sfx.play('mogu');
      b.toppings = [];
      b.fillTarget = 0;
    }
    if (!s.happy && t > 2.9) {
      s.happy = true;
      if (c) { c.setState('happy'); c.head.getWorldPosition(this.tmp); this.tmp.y += 0.14; this.fx.hearts(this.tmp, 3); this.fx.sparkle(this.tmp, 12, '#fff3a0', 0.4); }
      this.sfx.play('happy');
    }
    if (!s.gift && t > 4.0) {
      s.gift = true;
      const p = this.cust.addGift(); this.fx.sparkle(p, 10); this.sfx.play('kira');
    }
    if (!s.leave && t > 4.7) {
      s.leave = true;
      if (c) c.setState('leave');
      this.goCamera('work');
    }
    if (!s.next && t > 5.5) {
      s.next = true;
      this.round++;
      this.cust.next();
      b.counts = { negi: 0, kamaboko: 0, ebiten: 0, oage: 0 };
      b.color++; this.w.setBowlColor(b.color);
      b.target.copy(L.bowlRest); b.serveFrom.copy(b.pos); b.back = 0;
      if (this.hero.getState().place === 'eaten') { this._resetPending = true; this.hero.reset({ seed: this.round }); }
    }
    if (s.next) {   // 空のお椀が手前に戻る
      b.back = (b.back || 0) + dt;
      const u = easeInOut(b.back / 0.7);
      b.pos.lerpVectors(b.serveFrom, L.bowlRest, u);
      b.pos.y = lerp(b.serveFrom.y, 0, u) + Math.sin(u * Math.PI) * 0.04;
    }
    if (t > 6.3) { this.mode = 'play'; this.lastTouch = this.time; b.pos.copy(L.bowlRest); b.target.copy(L.bowlRest); }
  }

  // ---------- ヒント（止まったら次に触れる物が光る・揺れる） ----------
  chooseHint() {
    const s = this.hero.getState();
    const touched = s.touched.pressed || s.touched.stretched || s.touched.rolled;
    if (s.place === 'board' && s.cutCount === 0 && !touched) return 'dough';
    if (s.place === 'board' && s.cutCount === 0) return 'knife';
    if (s.place === 'board') return 'noodles';
    if (s.place === 'pot') return 'net';
    if (s.place === 'net' || s.place === 'hand') return 'bowl';
    if (s.place === 'bowl' && this.bowl.toppings.length === 0) return 'dishes';
    if (this.servable()) return 'serve';
    return null;
  }
  setHint(h) {
    if (h === this.hint) return;
    const gl = this.w.glows;
    for (const k of Object.keys(gl)) gl[k].set(0);
    for (const d of this.o.dishes) d.glow.set(0);
    this.hero.setHint(null);
    if (this.cust.current) this.cust.current.beckon = false;
    this.hint = h; this.hintT = 0;
    if (h === 'dough' || h === 'noodles') this.hero.setHint(h);
  }
  updateHint(dt) {
    let want = null;
    if (this.mode === 'play' && !this.grab && this.time - this.lastTouch > HINT_DELAY && this.flying.length === 0 && !this.net.auto && !this.pin.auto && !this.hero.getState().busy) want = this.chooseHint();
    // 止まってヒントを出す時、包丁が生地の上に置きっぱなしなら置き場へ片付ける（麺を触る邪魔をしない）
    if (want && want !== 'knife' && this.knife.onBoard) { this.knife.onBoard = false; this.knife.hop = 1; this.sfx.play('putdown'); }
    this.setHint(want);
    if (!this.hint) return;
    this.hintT += dt;
    const pulse = 0.5 - 0.5 * Math.cos(this.hintT * Math.PI * 2 / 1.2);
    const gl = this.w.glows, h = this.hint;
    if (h === 'knife') gl.knife.set(pulse * 0.6);
    if (h === 'net') gl.net.set(pulse * 0.6);
    if (h === 'noodles') gl.pot.set(pulse * 0.35);
    if (h === 'bowl' || h === 'serve') gl.bowl.set(pulse * 0.5);
    if (h === 'serve' && this.cust.current) this.cust.current.beckon = true;
    if (h === 'dishes') this.o.dishes.forEach((d, i) => d.glow.set((0.5 - 0.5 * Math.cos((this.hintT - i * 0.25) * Math.PI * 2 / 1.2)) * 0.6));
  }
  // ぴょこっ（2秒に1回、0.35秒の小さな跳ね）
  hintHop(name) {
    if (!this.hint) return 0;
    const h = this.hint;
    let on = (h === name) || (name === 'bowl' && (h === 'bowl' || h === 'serve'));
    let off = 0;
    if (name.startsWith('dish') && h === 'dishes') { on = true; off = +name.slice(4) * 0.25; }
    if (!on) return 0;
    const ph = ((this.hintT - off) % 2 + 2) % 2;
    return ph < 0.35 ? Math.sin(ph / 0.35 * Math.PI) * 0.014 : 0;
  }

  // ---------- hero のイベント → 音・演出 ----------
  onHeroEvent(type, d) {
    const fx = this.fx, sfx = this.sfx;
    switch (type) {
      case 'press': sfx.play('munyu'); if (d && d.position) fx.puff(d.position, 3); break;
      case 'stretch': sfx.stretch(d ? d.amount : 0.5); break;
      case 'stretch-release': sfx.stretchEnd(); sfx.play('boyon'); break;
      case 'roll': if (this.time - (this._rollT || 0) > 0.09) { sfx.play('goro'); this._rollT = this.time; } break;
      case 'cut': sfx.play('suton'); this.stats.cuts++; if (d && d.position) { fx.puff(d.position, 4); fx.sparkle(d.position, 2, '#ffffff', 0.15); } break;
      case 'splash': sfx.play('splash'); if (d && d.position) fx.sparkle(d.position, 8, '#e9fbff', 0.3); break;
      case 'scoop': sfx.play('scoop'); break;
      case 'drop': sfx.play('drop'); if (this.bowl.fillTarget < 1) { this.bowl.fillTarget = 1; sfx.play('broth'); } break;
      case 'settled':
        if (d && d.place === 'board' && this._resetPending) { sfx.play('poyon'); this._resetPending = false; }
        if (d && d.place === 'bowl' && this.bowl.fillTarget < 1) this.bowl.fillTarget = 1;
        break;
    }
  }
}
