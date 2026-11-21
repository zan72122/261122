// Cheap effects: one InstancedMesh per particle kind (billboards), and the white glove hint hand.
import * as THREE from '../vendor/three.module.min.js';
import { sphere, rbox, merge, place, cyl } from './geo.js';
import { clamp, smoothstep, easeInOut } from './util.js';

const _q2 = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

class Pool {
  constructor(scene, tex, max, blending = THREE.NormalBlending) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.max = max;
    this.items = [];
  }
  spawn(o) { if (this.items.length >= this.max) this.items.shift(); this.items.push(o); }
  update(dt, camQuat) {
    const it = this.items;
    let w = 0;
    for (let i = 0; i < it.length; i++) {
      const p = it[i];
      p.t += dt;
      if (p.t < p.life) it[w++] = p;
    }
    it.length = w;
    for (let i = 0; i < it.length; i++) {
      const p = it[i];
      const k = p.t / p.life;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const sz = p.size * (p.grow ? 0.4 + 0.6 * smoothstep(0, 0.3, k) + p.grow * k : 1) * (1 - smoothstep(0.65, 1, k));
      _q.copy(camQuat);
      if (p.spin) _q.multiply(_q2.setFromAxisAngle(_z, p.spin * p.t));
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(sz, sz, sz));
      this.mesh.setMatrixAt(i, _m);
      _c.set(p.color);
      this.mesh.setColorAt(i, _c);
    }
    this.mesh.count = it.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.items.length = 0; }
}

export function createFx(scene, tex, tier) {
  const max = tier.fxCount;
  const sparkles = new Pool(scene, tex.sparkle, max, THREE.AdditiveBlending);
  const hearts = new Pool(scene, tex.heart, Math.round(max / 2));
  const dust = new Pool(scene, tex.shadow, Math.round(max / 2));
  const glove = createGlove();
  scene.add(glove.root);

  const COLORS = [0xfff27a, 0xffffff, 0x9ef0ff, 0xffb3e6];
  return {
    sparkleBurst(pos, n = 12, spread = 1, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (1.2 + Math.random() * 2) * spread;
        sparkles.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * s, vy: 1.5 + Math.random() * 2.5 * spread, vz: Math.sin(a) * s * 0.6,
          g: -5, t: 0, life: 0.6 + Math.random() * 0.4, size: 0.35 + Math.random() * 0.25, color: color || COLORS[i % COLORS.length], spin: 4 });
      }
    },
    hearts(pos, n = 6) {
      const hc = [0xff5c9d, 0xff86b8, 0xff3d6e];
      for (let i = 0; i < n; i++) {
        hearts.spawn({ x: pos.x + (Math.random() - 0.5) * 0.8, y: pos.y + Math.random() * 0.3, z: pos.z + (Math.random() - 0.5) * 0.3,
          vx: (Math.random() - 0.5) * 0.6, vy: 1.0 + Math.random() * 0.8, vz: 0, g: 0.2, t: -i * 0.12, life: 1.6, size: 0.45 + Math.random() * 0.2, color: hc[i % 3], grow: 0.3 });
      }
    },
    dust(pos, n = 10, radius = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        dust.spawn({ x: pos.x + Math.cos(a) * radius * 0.5, y: pos.y + 0.2, z: pos.z + Math.sin(a) * radius * 0.5,
          vx: Math.cos(a) * 1.6 * radius, vy: 0.6 + Math.random() * 0.8, vz: Math.sin(a) * 1.0 * radius, g: -0.5, t: 0, life: 0.9, size: 0.9 + Math.random() * 0.7, color: 0xd9cbb8, grow: 1 });
      }
    },
    glove,
    update(dt, camera) {
      sparkles.update(dt, camera.quaternion);
      hearts.update(dt, camera.quaternion);
      dust.update(dt, camera.quaternion);
      glove.update(dt, camera);
    },
    clear() { sparkles.clear(); hearts.clear(); dust.clear(); glove.hide(); },
  };
}

/** White cartoon glove: shows "drag from A to B" or "tap here". Drawn on top of everything. */
function createGlove() {
  const parts = [
    place(rbox(0.36, 0.42, 0.16, 0.08, 0xffffff), 0, 0, 0),
    place(rbox(0.11, 0.36, 0.11, 0.05, 0xffffff), -0.06, 0.34, 0.02), // index finger
    place(rbox(0.12, 0.2, 0.11, 0.05, 0xffffff), 0.16, 0.04, 0.04, 0, 0, -0.6), // thumb
    place(cyl(0.2, 0.2, 0.12, 0xf0f0f0, 14), 0, -0.26, 0, 0, 0, 0, 1, 1, 0.7), // cuff
  ];
  const geo = merge(parts);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, depthTest: false, transparent: true, emissive: 0x666666 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 20;
  const root = new THREE.Group();
  root.add(mesh);
  mesh.rotation.z = 0.35; mesh.rotation.x = -0.2;
  mesh.position.y = 0.2; // fingertip ends near the root origin + up
  root.visible = false;
  let t = 0, plan = null;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  return {
    root,
    /** demo: kind 'drag' (from→to) or 'tap' (at from) */
    show(kind, from, to) {
      plan = { kind, dur: kind === 'drag' ? 2.4 : 1.6 };
      a.copy(from); b.copy(to || from);
      t = 0; root.visible = true;
    },
    hide() { plan = null; root.visible = false; },
    get active() { return !!plan; },
    update(dt) {
      if (!plan) return;
      t += dt;
      const k = t / plan.dur;
      if (k >= 1) { this.hide(); return; }
      const appear = smoothstep(0, 0.12, k) * (1 - smoothstep(0.88, 1, k));
      mat.opacity = appear;
      let lift = 0.6, x = a.x, y = a.y, z = a.z;
      if (plan.kind === 'drag') {
        const press = smoothstep(0.12, 0.22, k) * (1 - smoothstep(0.78, 0.86, k));
        const m = easeInOut(clamp((k - 0.25) / 0.5, 0, 1));
        x = a.x + (b.x - a.x) * m; y = a.y + (b.y - a.y) * m; z = a.z + (b.z - a.z) * m;
        lift = 0.6 - 0.45 * press;
      } else {
        const tapK = (k * 2) % 1;
        lift = 0.55 - 0.4 * Math.sin(Math.PI * clamp(tapK * 1.6 - 0.3, 0, 1));
      }
      root.position.set(x, y + lift, z + 0.3);
      const s = 1.3 * (0.6 + 0.4 * appear);
      root.scale.set(s, s, s);
    },
  };
}
