// fx.js — hearts / stars / confetti (one InstancedMesh each) and the hint halo.
(function () {
  'use strict';
  const T = THREE;
  const G = window.G;
  const TAU = Math.PI * 2;
  const CAP = 64;
  const parts = [];
  let meshes = {}, halo = null, haloT = 9, haloGet = null, haloR = 1;
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _z = new T.Vector3(0, 0, 1), _c = new T.Color();

  G.fx = {
    init(scene) {
      const mat = new T.MeshBasicMaterial({ side: T.DoubleSide, transparent: false });
      const heart = new T.ShapeGeometry(G.geo.heartShape(0.16), 6); heart.rotateZ(Math.PI);
      const star = new T.ShapeGeometry(G.geo.starShape(5, 0.16, 0.07), 1);
      const conf = new T.PlaneGeometry(0.12, 0.07);
      for (const [k, g] of [['heart', heart], ['star', star], ['conf', conf]]) {
        G.geo.prep(g, [1, 1, 1]);
        const m = new T.InstancedMesh(g, mat, CAP);
        m.count = 0; m.frustumCulled = false; m.renderOrder = 5;
        m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
        scene.add(m); meshes[k] = m;
      }
      // halo: ring glow texture, additive, flat on the ground
      const tex = G.canvasTex(128, (g, s) => {
        const gr = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s / 2);
        gr.addColorStop(0, 'rgba(255,255,200,0)'); gr.addColorStop(0.55, 'rgba(255,240,150,0.85)'); gr.addColorStop(0.75, 'rgba(255,220,120,0.5)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
        g.fillStyle = gr; g.fillRect(0, 0, s, s);
      }, 'halo', false);
      const hg = new T.PlaneGeometry(2, 2); hg.rotateX(-Math.PI / 2);
      halo = new T.Mesh(hg, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
      halo.renderOrder = 4; halo.visible = false;
      scene.add(halo);
    },
    burst(kind, pos, n, opt) {
      opt = opt || {};
      for (let i = 0; i < n; i++) {
        if (parts.length >= CAP * 3) parts.shift();
        const a = Math.random() * TAU, sp = G.rand(0.6, 1.0) * (opt.speed || 2.2);
        parts.push({
          kind, x: pos.x, y: pos.y, z: pos.z,
          vx: Math.cos(a) * sp * (opt.flat ? 1 : 0.6), vy: G.rand(0.6, 1.2) * (opt.up || 2.5), vz: Math.sin(a) * sp * 0.6,
          t: 0, life: G.rand(0.9, 1.5) * (opt.life || 1), g: opt.g === undefined ? 3.5 : opt.g,
          size: G.rand(0.7, 1.2) * (opt.size || 1), spin: G.rand(-6, 6), rot: Math.random() * TAU,
          color: opt.colors ? G.pick(opt.colors) : 0xff6f9a,
        });
      }
    },
    // glowing ring that follows getPos() for a short time
    halo(getPos, radius) { haloGet = getPos; haloR = radius; haloT = 0; },
    stopHalo() { haloT = 9; },
    update(dt) {
      const cnt = { heart: 0, star: 0, conf: 0 };
      const cq = G.camera.quaternion;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t > p.life) { parts.splice(i, 1); continue; }
        p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
        p.rot += p.spin * dt;
        const m = meshes[p.kind];
        if (cnt[p.kind] >= CAP) continue;
        const life = p.t / p.life;
        const s = p.size * (life < 0.15 ? life / 0.15 : life > 0.75 ? Math.max(0.01, (1 - life) / 0.25) : 1);
        _q2.setFromAxisAngle(_z, p.kind === 'heart' ? Math.sin(p.rot) * 0.3 : p.rot);
        _q.copy(cq).multiply(_q2);
        _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(s, s, s));
        m.setMatrixAt(cnt[p.kind], _m);
        _c.setHex(p.color);
        m.instanceColor.setXYZ(cnt[p.kind], _c.r, _c.g, _c.b);
        cnt[p.kind]++;
      }
      for (const k in meshes) { const m = meshes[k]; m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      // halo
      haloT += dt;
      if (haloT < 1.8 && haloGet) {
        const p = haloGet();
        if (p) {
          halo.visible = true;
          halo.position.set(p.x, p.y + 0.02, p.z);
          const k = Math.sin(Math.min(1, haloT / 1.8) * Math.PI);
          const pulse = 1 + 0.12 * Math.sin(haloT * 9);
          halo.scale.setScalar(Math.max(0.01, haloR * pulse));
          halo.material.opacity = k * 0.95;
        }
      } else if (halo) halo.visible = false;
    },
  };
})();
