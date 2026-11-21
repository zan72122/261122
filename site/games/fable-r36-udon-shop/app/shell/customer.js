// お客さん：丸くて顔が単純な動物（たぬき・きつね・ねこ・うさぎ）。
// 動く部分ごとに頂点色で結合して draw call を抑える（1体 約13）。
import { THREE } from './three.js';
import { L } from './layout.js';
import { mergeColored, clamp, smooth, damp, disposeTree } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z) => new THREE.Euler(x, y, z);

export const SPECIES = [
  { id: 'tanuki',  fur: '#8f6e50', light: '#f3e2ca', dark: '#4b3729', ear: 'round',  tail: 'tanuki', nose: '#2b2018', cheek: '#f4a3a0', mask: true },
  { id: 'kitsune', fur: '#ee9440', light: '#fff4e6', dark: '#5a3018', ear: 'pointy', tail: 'fox',    nose: '#2b2018', cheek: '#f7a59a' },
  { id: 'neko',    fur: '#f7efe2', light: '#ffffff', dark: '#e9a85e', ear: 'cat',    tail: 'cat',    nose: '#f08a9a', cheek: '#f7b0b8', whisker: true },
  { id: 'usagi',   fur: '#fbf6f2', light: '#ffffff', dark: '#f2b8c2', ear: 'bunny',  tail: 'bunny',  nose: '#f08a9a', cheek: '#f7aab4' },
];

const G = {};   // 共有の基本形（unit）
function geo() {
  if (G.s) return G;
  G.s = new THREE.SphereGeometry(1, 20, 14);
  G.ss = new THREE.SphereGeometry(1, 10, 8);
  G.cone = new THREE.ConeGeometry(1, 1, 12);
  G.cap = new THREE.CapsuleGeometry(1, 2, 4, 10);
  G.arc = new THREE.TorusGeometry(1, 0.24, 5, 12, Math.PI);
  G.box = new THREE.BoxGeometry(1, 1, 1);
  return G;
}

// 頭（動かない部分）の部品表。gift（おみやげ人形）にも使う
function headParts(sp, { happy = false } = {}) {
  const g = geo();
  const P = [];
  P.push({ geo: g.s, color: sp.fur, scale: V(0.12, 0.11, 0.114) });
  if (sp.mask) for (const sx of [-1, 1]) P.push({ geo: g.s, color: sp.dark, pos: V(sx * 0.046, 0.006, 0.088), scale: V(0.038, 0.03, 0.02), rot: E(0, 0, sx * 0.3) });
  const muzzleZ = sp.id === 'kitsune' ? 0.094 : 0.085;
  P.push({ geo: g.s, color: sp.light, pos: V(0, -0.035, muzzleZ), scale: V(0.063, 0.043, 0.041) });
  P.push({ geo: g.s, color: sp.nose, pos: V(0, -0.014, muzzleZ + 0.04), scale: V(0.016, 0.012, 0.011) });
  if (sp.whisker) for (const sx of [-1, 1]) for (const k of [-1, 1]) P.push({ geo: g.box, color: '#b9a98f', pos: V(sx * 0.085, -0.03 + k * 0.008, 0.1), scale: V(0.05, 0.0016, 0.0016), rot: E(0, 0, sx * k * 0.15) });
  if (happy) {
    for (const sx of [-1, 1]) P.push({ geo: g.arc, color: '#2a1d16', pos: V(sx * 0.045, 0.004, 0.106), scale: V(0.016, 0.016, 0.016) });
    P.push({ geo: g.arc, color: '#7a2b2b', pos: V(0, -0.054, 0.122), scale: V(0.013, 0.013, 0.013), rot: E(-0.3, 0, Math.PI) });
    for (const sx of [-1, 1]) P.push({ geo: g.s, color: sp.cheek, pos: V(sx * 0.078, -0.035, 0.085), scale: V(0.024, 0.016, 0.009) });
  }
  return P;
}
function earParts(sp, sx) {
  const g = geo();
  switch (sp.ear) {
    case 'round': return [{ geo: g.s, color: sp.dark, scale: V(0.04, 0.038, 0.02) }, { geo: g.s, color: sp.light, pos: V(0, -0.004, 0.012), scale: V(0.022, 0.02, 0.01) }];
    case 'pointy': return [{ geo: g.cone, color: sp.fur, scale: V(0.045, 0.1, 0.022) }, { geo: g.cone, color: sp.dark, pos: V(0, 0.032, 0.002), scale: V(0.022, 0.036, 0.016) }, { geo: g.cone, color: sp.light, pos: V(0, -0.01, 0.01), scale: V(0.025, 0.06, 0.008) }];
    case 'cat': return [{ geo: g.cone, color: sp.dark, scale: V(0.04, 0.07, 0.02) }, { geo: g.cone, color: '#f6b0bb', pos: V(0, -0.006, 0.01), scale: V(0.022, 0.045, 0.008) }];
    case 'bunny': return [{ geo: g.cap, color: sp.fur, pos: V(0, 0.06, 0), scale: V(0.026, 0.045, 0.016) }, { geo: g.cap, color: '#f6b8c4', pos: V(0, 0.06, 0.01), scale: V(0.014, 0.036, 0.008) }];
  }
  return [];
}
function earPlace(sp, sx) {
  switch (sp.ear) {
    case 'round': return { pos: V(sx * 0.082, 0.085, -0.01), rot: E(0, 0, -sx * 0.4) };
    case 'pointy': return { pos: V(sx * 0.072, 0.12, -0.005), rot: E(0, 0, -sx * 0.35) };
    case 'cat': return { pos: V(sx * 0.07, 0.1, -0.005), rot: E(0, 0, -sx * 0.3) };
    case 'bunny': return { pos: V(sx * 0.04, 0.1, -0.01), rot: E(0, 0, -sx * 0.15) };
  }
  return { pos: V(), rot: E() };
}
function tailParts(sp) {
  const g = geo();
  switch (sp.tail) {
    case 'tanuki': return [{ geo: g.s, color: sp.fur, pos: V(0.05, 0, 0), scale: V(0.06, 0.04, 0.04) }, { geo: g.s, color: sp.dark, pos: V(0.1, 0, 0), scale: V(0.035, 0.032, 0.032) }];
    case 'fox': return [{ geo: g.s, color: sp.fur, pos: V(0.07, 0.02, 0), scale: V(0.08, 0.04, 0.04) }, { geo: g.s, color: sp.light, pos: V(0.14, 0.03, 0), scale: V(0.035, 0.03, 0.03) }];
    case 'cat': return [{ geo: g.cap, color: sp.fur, pos: V(0.05, 0.03, 0), scale: V(0.012, 0.04, 0.012), rot: E(0, 0, -1.0) }, { geo: g.s, color: sp.dark, pos: V(0.095, 0.075, 0), scale: V(0.015, 0.015, 0.015) }];
    case 'bunny': return [{ geo: g.s, color: '#ffffff', pos: V(0.02, 0, 0), scale: V(0.03, 0.03, 0.03) }];
  }
  return [];
}

export class Customer {
  constructor(sp, mats, sfx) {
    const g = geo();
    this.sp = sp; this.sfx = sfx;
    this.root = new THREE.Group();
    this.root.position.copy(L.customer);
    const M = (geom, mat = mats.body) => { const m = new THREE.Mesh(geom, mat); return m; };
    this.own = [];   // この個体だけの geometry（dispose 用）
    const own = (geom) => { this.own.push(geom); return geom; };

    this.body = new THREE.Group(); this.root.add(this.body);
    this.body.add(M(own(mergeColored([
      { geo: g.s, color: sp.fur, pos: V(0, 0.05, 0), scale: V(0.135, 0.13, 0.11) },
      { geo: g.s, color: sp.light, pos: V(0, 0.055, 0.07), scale: V(0.09, 0.1, 0.045) },
    ]))));
    this.head = new THREE.Group(); this.head.position.set(0, 0.29, 0.01); this.body.add(this.head);
    this.head.add(M(own(mergeColored(headParts(sp)))));
    this.ears = [-1, 1].map((sx) => {
      const p = earPlace(sp, sx);
      const e = M(own(mergeColored(earParts(sp, sx))));
      e.position.copy(p.pos); e.rotation.copy(p.rot); e.userData.baseZ = p.rot.z;
      this.head.add(e); return e;
    });
    this.eyes = [-1, 1].map((sx) => {
      const e = M(own(mergeColored([
        { geo: g.s, color: '#22170f', scale: V(0.016, 0.019, 0.01) },
        { geo: g.ss, color: '#ffffff', pos: V(0.005, 0.007, 0.008), scale: V(0.0055, 0.0055, 0.004) },
      ])), mats.eye);
      e.position.set(sx * 0.045, 0.012, 0.103); this.head.add(e); return e;
    });
    this.happyEyes = M(own(mergeColored([-1, 1].map((sx) => ({ geo: g.arc, color: '#2a1d16', pos: V(sx * 0.045, 0.004, 0.106), scale: V(0.016, 0.016, 0.016) })))));
    this.happyEyes.visible = false; this.head.add(this.happyEyes);
    this.cheeks = M(own(mergeColored([-1, 1].map((sx) => ({ geo: g.s, color: sp.cheek, pos: V(sx * 0.078, 0, 0), scale: V(0.024, 0.016, 0.009) })))));
    this.cheeks.position.set(0, -0.035, 0.087); this.head.add(this.cheeks);
    this.smile = M(own(mergeColored([{ geo: g.arc, color: '#7a2b2b', scale: V(0.012, 0.012, 0.012), rot: E(0, 0, Math.PI) }])));
    this.smile.position.set(0, -0.052, 0.123); this.smile.rotation.x = -0.3; this.head.add(this.smile);
    this.mouthO = M(own(mergeColored([{ geo: g.s, color: '#8a2a2a', scale: V(0.012, 0.014, 0.006) }])));
    this.mouthO.position.set(0, -0.056, 0.121); this.mouthO.visible = false; this.head.add(this.mouthO);
    this.mouth = new THREE.Object3D(); this.mouth.position.set(0, -0.056, 0.13); this.head.add(this.mouth);
    this.paws = [-1, 1].map((sx) => {
      const p = M(own(mergeColored([{ geo: g.s, color: sp.light, scale: V(0.034, 0.026, 0.04) }])));
      p.position.set(sx * 0.115, 0.02, 0.13); p.userData.base = p.position.clone(); this.body.add(p); return p;
    });
    this.tail = new THREE.Group(); this.tail.position.set(0.11, 0.0, -0.06); this.tail.rotation.y = -0.5; this.body.add(this.tail);
    this.tail.add(M(own(mergeColored(tailParts(sp)))));

    this.state = 'gone'; this.t = 0; this.time = Math.random() * 10;
    this.blinkT = 2; this.giggleT = 0; this.beckon = false; this.lookX = 0;
    this.root.visible = false;
  }
  setState(s) {
    this.state = s; this.t = 0;
    if (s === 'enter') { this.root.visible = true; }
  }
  giggle() { this.giggleT = 0.6; if (this.sfx) this.sfx.play('giggle'); }
  update(dt) {
    this.time += dt; this.t += dt;
    const t = this.time, st = this.state, k = this.t;
    let x = 0, y = 0, lean = 0, headX = 0, headZ = Math.sin(t * 0.7) * 0.05, eyeS = 1, happy = false, oMouth = false, cheek = 1, smileS = 1, wag = 1.5, wagAmp = 0.25;
    let pawUp = [0, 0];
    if (st === 'enter') {
      const u = clamp(k / 1.1, 0, 1);
      x = (1 - smooth(u)) * 0.95; y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.06 * (1 - u * 0.4);
      if (u >= 1) this.setState('idle');
    } else if (st === 'want') {
      lean = 0.12 * smooth(k / 0.4); eyeS = 1 + 0.25 * smooth(k / 0.3); headX = 0.12; wag = 5; wagAmp = 0.35;
    } else if (st === 'eat') {
      lean = 0.18; headX = 0.32 + Math.sin(t * 13) * 0.03; oMouth = true; eyeS = 0.35; wag = 5;
      cheek = 1 + 0.35 * smooth((k - 1.2) / 0.3);
    } else if (st === 'happy') {
      happy = true; smileS = 1.5; cheek = 1.25; wag = 10; wagAmp = 0.45;
      if (k < 1.4) y = Math.abs(Math.sin(k * Math.PI * 1.45)) * 0.055;
      pawUp = [0.05 * smooth(k / 0.3), 0.05 * smooth(k / 0.3)];
      headZ = Math.sin(t * 5) * 0.08;
    } else if (st === 'leave') {
      happy = true; smileS = 1.3;
      if (k < 0.8) pawUp = [0, 0.06 + Math.sin(k * 18) * 0.02];
      const u = clamp((k - 0.8) / 1.0, 0, 1);
      x = -smooth(u) * 0.95; y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.06;
      if (u >= 1) { this.root.visible = false; this.state = 'gone'; }
    } else if (st === 'idle') {
      headX = 0.04; if (this.beckon) { pawUp = [0, 0.04 + Math.sin(t * 9) * 0.025]; wag = 4; }
    }
    if (this.giggleT > 0) {
      this.giggleT -= dt;
      const g = this.giggleT / 0.6;
      happy = true; headZ += Math.sin(g * 30) * 0.12 * g;
      this.body.scale.set(1 + 0.06 * g, 1 - 0.07 * g, 1);
    } else this.body.scale.set(1, 1 + Math.sin(t * 2.2) * 0.012, 1);
    // まばたき
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0) { blink = 0.12; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 2.5; }
    this.root.position.set(L.customer.x + x, L.customer.y + y, L.customer.z);
    this.body.rotation.x = damp(this.body.rotation.x, lean, 8, dt);
    this.head.rotation.x = damp(this.head.rotation.x, headX, 8, dt);
    this.head.rotation.z = damp(this.head.rotation.z, headZ, 10, dt);
    this.head.rotation.y = damp(this.head.rotation.y, clamp(this.lookX * 0.6, -0.35, 0.35), 3, dt);
    for (const e of this.eyes) { e.visible = !happy; e.scale.set(eyeS, eyeS * blink, eyeS); }
    this.happyEyes.visible = happy;
    this.mouthO.visible = oMouth; this.smile.visible = !oMouth;
    this.smile.scale.setScalar(smileS);
    const ch = damp(this.cheeks.scale.x, cheek, 10, dt); this.cheeks.scale.set(ch, ch, 1);
    this.ears.forEach((e, i) => { e.rotation.z = e.userData.baseZ + Math.sin(t * 3 + i) * 0.04 + (happy ? Math.sin(t * 14 + i * 3) * 0.08 : 0); });
    this.paws.forEach((p, i) => { p.position.y = damp(p.position.y, p.userData.base.y + pawUp[i], 14, dt); });
    this.tail.rotation.z = Math.sin(t * wag) * wagAmp;
  }
  dispose() {
    this.root.parent && this.root.parent.remove(this.root);
    for (const g of this.own) g.dispose();
  }
}

// お客さんの入れ替えと、おみやげ人形の棚
export class Customers {
  constructor(scene, sfx) {
    this.scene = scene; this.sfx = sfx;
    this.mats = { body: new THREE.MeshLambertMaterial({ vertexColors: true }), eye: new THREE.MeshPhongMaterial({ vertexColors: true, specular: '#ffffff', shininess: 90 }) };
    this.index = -1; this.current = null; this.leaving = null;
    this.gifts = []; this.giftGeo = {}; this.maxGifts = 8;
  }
  next() {
    if (this.current) this.leaving = this.current;
    this.index++;
    const sp = SPECIES[this.index % SPECIES.length];
    this.current = new Customer(sp, this.mats, this.sfx);
    this.scene.add(this.current.root);
    this.current.setState('enter');
    if (this.sfx) this.sfx.play('hop');
    return this.current;
  }
  addGift() {
    const sp = this.current.sp;
    if (!this.giftGeo[sp.id]) {
      const parts = headParts(sp, { happy: true });
      for (const sx of [-1, 1]) {
        const p = earPlace(sp, sx);
        for (const q of earParts(sp, sx)) {
          const m = new THREE.Matrix4().compose(p.pos, new THREE.Quaternion().setFromEuler(p.rot), new THREE.Vector3(1, 1, 1));
          const local = new THREE.Matrix4().compose(q.pos || V(), new THREE.Quaternion().setFromEuler(q.rot || E()), q.scale || V(1, 1, 1));
          m.multiply(local);
          const pos = V(), quat = new THREE.Quaternion(), scl = V(); m.decompose(pos, quat, scl);
          parts.push({ geo: q.geo, color: q.color, pos, rot: new THREE.Euler().setFromQuaternion(quat), scale: scl });
        }
      }
      parts.push({ geo: geo().s, color: '#d8c2a0', pos: V(0, -0.115, 0), scale: V(0.1, 0.02, 0.1) });   // 台座
      this.giftGeo[sp.id] = mergeColored(parts);
    }
    const m = new THREE.Mesh(this.giftGeo[sp.id], this.mats.body);
    m.scale.setScalar(0.42);
    if (this.gifts.length >= this.maxGifts) { const old = this.gifts.shift(); this.scene.remove(old); }
    this.gifts.forEach((g, i) => g.position.x = L.giftShelf.start.x + i * L.giftShelf.step);
    m.position.set(L.giftShelf.start.x + this.gifts.length * L.giftShelf.step, L.giftShelf.start.y + 0.05, L.giftShelf.start.z);
    m.rotation.y = 0.25;
    m.userData.pop = 0;
    this.gifts.push(m); this.scene.add(m);
    return m.position;
  }
  update(dt) {
    if (this.current) this.current.update(dt);
    if (this.leaving) { this.leaving.update(dt); if (this.leaving.state === 'gone') { this.leaving.dispose(); this.leaving = null; } }
    for (const g of this.gifts) if (g.userData.pop < 1) { g.userData.pop = Math.min(1, g.userData.pop + dt * 3); const s = 0.42 * (1 + Math.sin(g.userData.pop * Math.PI) * 0.4) * smooth(g.userData.pop * 2); g.scale.setScalar(Math.max(0.001, s)); }
  }
  dispose() {
    if (this.current) this.current.dispose(); if (this.leaving) this.leaving.dispose();
    for (const g of Object.values(this.giftGeo)) g.dispose();
    for (const g of this.gifts) this.scene.remove(g);
    this.mats.body.dispose(); this.mats.eye.dispose();
  }
}
