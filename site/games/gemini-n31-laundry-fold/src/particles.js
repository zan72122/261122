import * as THREE from '../vendor/three.module.min.js';

// Handmade felt stars, fabric hearts, cotton fluff puffs & golden sunlit motes
function makeStarGeo() {
  const shape = new THREE.Shape();
  const outer = 0.085;
  const inner = 0.042;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: false });
  geo.center();
  return geo;
}

function makeHeartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.055);
  s.bezierCurveTo(0.08, 0.0, 0.085, 0.075, 0.035, 0.075);
  s.bezierCurveTo(0.01, 0.075, 0, 0.05, 0, 0.04);
  s.bezierCurveTo(0, 0.05, -0.01, 0.075, -0.035, 0.075);
  s.bezierCurveTo(-0.085, 0.075, -0.08, 0.0, 0, -0.055);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
  geo.center();
  return geo;
}

export class CraftParticles {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.starGeo = makeStarGeo();
    this.heartGeo = makeHeartGeo();
    this.puffGeo = new THREE.IcosahedronGeometry(0.055, 1);
    this.active = [];

    // Ambient sunlit dust motes floating lazily through the room
    const moteCount = 26;
    this.motes = [];
    const moteGeo = new THREE.SphereGeometry(0.026, 6, 6);
    const moteMat = new THREE.MeshBasicMaterial({
      color: '#fff6da',
      transparent: true,
      opacity: 0.55,
    });
    for (let i = 0; i < moteCount; i++) {
      const m = new THREE.Mesh(moteGeo, moteMat);
      m.position.set(
        (Math.random() - 0.5) * 7.5,
        0.5 + Math.random() * 3.4,
        -2.5 + Math.random() * 5.2
      );
      m.userData = {
        baseY: m.position.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5,
        drift: 0.12 + Math.random() * 0.16,
      };
      this.group.add(m);
      this.motes.push(m);
    }
  }

  burst(pos, options = {}) {
    const {
      count = 10,
      colors = ['#f5c344', '#f07d8e', '#6da2d8', '#fff8eb'],
      kind = 'star', // star | heart | puff | mixed
      speed = 2.0,
      upward = 2.2,
      scale = 1.0,
      life = 0.9,
    } = options;

    for (let i = 0; i < count; i++) {
      const chosenKind =
        kind === 'mixed' ? (i % 3 === 0 ? 'heart' : i % 3 === 1 ? 'star' : 'puff') : kind;
      const geo =
        chosenKind === 'heart' ? this.heartGeo : chosenKind === 'puff' ? this.puffGeo : this.starGeo;
      const color = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.position.x += (Math.random() - 0.5) * 0.25;
      mesh.position.z += (Math.random() - 0.5) * 0.25;
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd = speed * (0.55 + Math.random() * 0.7);
      const s = scale * (0.75 + Math.random() * 0.55);
      mesh.scale.setScalar(s);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.group.add(mesh);

      this.active.push({
        mesh,
        vx: Math.cos(ang) * spd,
        vy: upward * (0.65 + Math.random() * 0.65),
        vz: Math.sin(ang) * spd,
        rx: (Math.random() - 0.5) * 7,
        ry: (Math.random() - 0.5) * 7,
        age: 0,
        life: life * (0.8 + Math.random() * 0.4),
        baseScale: s,
        gravity: chosenKind === 'puff' ? 1.2 : 4.2,
      });
    }
  }

  puff(pos, color = '#fff7ea', count = 7) {
    this.burst(pos, {
      count,
      colors: [color, '#fffaf0'],
      kind: 'puff',
      speed: 1.15,
      upward: 1.1,
      scale: 0.9,
      life: 0.55,
    });
  }

  update(dt, elapsed) {
    for (const m of this.motes) {
      const u = m.userData;
      m.position.y = u.baseY + Math.sin(elapsed * u.speed + u.phase) * u.drift;
      m.position.x += Math.cos(elapsed * 0.3 + u.phase) * 0.0008;
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.group.remove(p.mesh);
        p.mesh.material.dispose();
        this.active.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;

      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      p.mesh.scale.setScalar(p.baseScale * (0.3 + 0.7 * fade));
      p.mesh.material.opacity = fade;
    }
  }
}
