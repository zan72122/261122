// 演出の粒（湯気・泡・打ち粉・キラキラ・ハート）。プールごとに InstancedMesh 1つ＝ draw call 1つ。
// 板ポリゴンはシェーダーで常にカメラを向ける（毎フレームの回転計算なし）。
import { THREE } from './three.js';
import { drawSparkle, drawHeart } from './textures.js';

const VERT = /* glsl */`
attribute float aAlpha;
varying vec2 vUv; varying float vA; varying vec3 vC;
void main() {
  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float s = length(instanceMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
  vUv = uv; vA = aAlpha;
#ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
#else
  vC = vec3(1.0);
#endif
}`;
const FRAG = /* glsl */`
uniform sampler2D map;
varying vec2 vUv; varying float vA; varying vec3 vC;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vC * t.rgb, t.a * clamp(vA, 0.0, 1.0));
  if (gl_FragColor.a < 0.004) discard;
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(tex, max, additive) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.alpha = new Float32Array(max);
    geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.renderOrder = 10;
    this.max = max;
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.02, grow: 0, g: 0, a: 1, sway: 0, ph: 0, color: new THREE.Color() });
    this.m = new THREE.Matrix4();
    this.count = 0;
  }
  spawn(pos, vel, o) {
    let q = this.p.find((x) => !x.on);
    if (!q) q = this.p.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    q.on = true; q.pos.copy(pos); q.vel.copy(vel); q.age = 0;
    q.life = o.life || 1; q.size = o.size || 0.02; q.grow = o.grow || 0; q.g = o.g || 0;
    q.a = o.alpha == null ? 1 : o.alpha; q.sway = o.sway || 0; q.ph = Math.random() * 6.28;
    q.color.set(o.color || '#ffffff');
    return q;
  }
  update(dt) {
    let n = 0;
    for (const q of this.p) {
      if (!q.on) continue;
      q.age += dt;
      if (q.age >= q.life) { q.on = false; continue; }
      q.vel.y -= q.g * dt;
      q.pos.addScaledVector(q.vel, dt);
      if (q.sway) q.pos.x += Math.sin(q.age * 4 + q.ph) * q.sway * dt;
      const k = q.age / q.life;
      const s = Math.max(0.0001, q.size + q.grow * q.age);
      this.m.makeScale(s, s, s); this.m.setPosition(q.pos);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, q.color);
      this.alpha[n] = q.a * Math.min(1, k * 6) * (1 - k * k);
      n++;
    }
    this.count = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

export class Fx {
  constructor(scene, bank, tierFx, soft) {
    const spark = bank.canvas('fx-sparkle', 64, 64, drawSparkle);
    const heart = bank.canvas('fx-heart', 64, 64, drawHeart);
    this.scale = tierFx;
    this.soft = new Pool(soft, Math.round(28 * tierFx) + 4, false);
    this.spark = new Pool(spark, Math.round(40 * tierFx) + 6, true);
    this.heart = new Pool(heart, 8, false);
    for (const p of [this.soft, this.spark, this.heart]) scene.add(p.mesh);
    this.v = new THREE.Vector3(); this.w = new THREE.Vector3();
    this.steamRate = 0; this.steamAcc = 0; this.steamAt = new THREE.Vector3(); this.steamR = 0.1;
    this.bubbleRate = 0; this.bubbleAcc = 0; this.bubbleY = 0;
    this.onBubble = null;
  }
  sparkle(pos, n = 8, color = '#fff6b0', spread = 0.35) {
    n = Math.max(2, Math.round(n * this.scale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.8 + 0.2;
      this.v.set(Math.cos(a) * spread * u, 0.25 + Math.random() * 0.35, Math.sin(a) * spread * u * 0.6);
      this.spark.spawn(pos, this.v, { life: 0.6 + Math.random() * 0.4, size: 0.022 + Math.random() * 0.02, grow: -0.02, g: 0.6, color });
    }
  }
  puff(pos, n = 5) {   // 打ち粉がふわっと舞う
    n = Math.max(2, Math.round(n * this.scale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.v.set(Math.cos(a) * 0.08, 0.05 + Math.random() * 0.08, Math.sin(a) * 0.08);
      this.soft.spawn(pos, this.v, { life: 0.6, size: 0.02, grow: 0.06, color: '#fffaf0', alpha: 0.7 });
    }
  }
  hearts(pos, n = 3) {
    for (let i = 0; i < n; i++) {
      this.w.copy(pos); this.w.x += (i - (n - 1) / 2) * 0.09; this.w.y += Math.random() * 0.03;
      this.v.set((i - (n - 1) / 2) * 0.03, 0.16 + Math.random() * 0.06, 0.02);
      const q = this.heart.spawn(this.w, this.v, { life: 1.8, size: 0.055, grow: 0.015, color: i % 2 ? '#ff7aa8' : '#ff9cc0', sway: 0.05 });
      q.age = -i * 0.18;   // 少しずつ時間差で出る
    }
  }
  setSteam(at, radius, rate) { this.steamAt.copy(at); this.steamR = radius; this.steamRate = rate; }
  setBubbles(rate, y) { this.bubbleRate = rate; this.bubbleY = y; }
  update(dt) {
    this.steamAcc += dt * this.steamRate * this.scale;
    while (this.steamAcc > 1) {
      this.steamAcc -= 1;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.steamR;
      this.w.set(this.steamAt.x + Math.cos(a) * r, this.steamAt.y + 0.01, this.steamAt.z + Math.sin(a) * r);
      this.v.set(0, 0.07 + Math.random() * 0.04, 0);
      this.soft.spawn(this.w, this.v, { life: 2.2, size: 0.05, grow: 0.06, color: '#ffffff', alpha: 0.22, sway: 0.03 });
    }
    this.bubbleAcc += dt * this.bubbleRate * this.scale;
    while (this.bubbleAcc > 1) {
      this.bubbleAcc -= 1;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.steamR * 0.9;
      this.w.set(this.steamAt.x + Math.cos(a) * r, this.bubbleY + 0.002, this.steamAt.z + Math.sin(a) * r);
      this.v.set(0, 0.01, 0);
      this.soft.spawn(this.w, this.v, { life: 0.45, size: 0.008, grow: 0.03, color: '#ffffff', alpha: 0.8 });
      if (this.onBubble && Math.random() < 0.3) this.onBubble();
    }
    for (const p of [this.soft, this.spark]) p.update(dt);
    this.heart.update(dt);   // age<0 のハートは alpha 0 で待機（時間差で出る）
  }
  stats() {
    return { draw: [this.soft, this.spark, this.heart].filter((p) => p.count > 0).length,
      tri: (this.soft.count + this.spark.count + this.heart.count) * 2 };
  }
}
