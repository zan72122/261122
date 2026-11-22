import * as THREE from '../vendor/three.module.min.js';
import { createSteamTexture } from './textures.js';

export class KitchenParticles {
  constructor(scene) {
    this.scene = scene;

    // 1. Soft wispy kitchen steam pool (Sprites)
    this.steamTex = createSteamTexture();
    this.steamPool = [];
    const STEAM_COUNT = 54;
    for (let i = 0; i < STEAM_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.steamTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0xfffaf2,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.steamPool.push({
        sprite,
        active: false,
        age: 0,
        life: 1.5,
        vel: new THREE.Vector3(),
        startScale: 0.14,
        endScale: 0.55,
        maxOpacity: 0.36,
        swirlSeed: Math.random() * Math.PI * 2,
      });
    }

    // 2. Glossy liquid droplets / egg splash / ingredient sprinkle pool (small low-poly spheres)
    this.dropGeo = new THREE.SphereGeometry(0.018, 8, 8);
    this.dropPool = [];
    const DROP_COUNT = 64;
    for (let i = 0; i < DROP_COUNT; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffc636,
        roughness: 0.18,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(this.dropGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.dropPool.push({
        mesh,
        active: false,
        age: 0,
        life: 0.7,
        vel: new THREE.Vector3(),
        gravity: -4.2,
        rotSpeed: new THREE.Vector3(),
      });
    }

    // 3. Subtle warm sunlit bokeh sparkles (for tasting delight / double yolk)
    this.bokehTex = this._createBokehTexture();
    this.bokehPool = [];
    const BOKEH_COUNT = 22;
    for (let i = 0; i < BOKEH_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.bokehTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffe49e,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.bokehPool.push({
        sprite,
        active: false,
        age: 0,
        life: 1.4,
        vel: new THREE.Vector3(),
        scale: 0.12,
      });
    }
  }

  _createBokehTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,252,230,1)');
    g.addColorStop(0.35, 'rgba(255,226,142,0.75)');
    g.addColorStop(0.75, 'rgba(255,204,105,0.2)');
    g.addColorStop(1, 'rgba(255,204,105,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  spawnSteam(pos, opts = {}) {
    const p = this.steamPool.find((s) => !s.active);
    if (!p) return;
    p.active = true;
    p.age = 0;
    p.life = opts.life ?? (1.4 + Math.random() * 1.1);
    p.startScale = opts.startScale ?? (0.12 + Math.random() * 0.08);
    p.endScale = opts.endScale ?? (0.46 + Math.random() * 0.28);
    p.maxOpacity = opts.opacity ?? 0.34;
    p.swirlSeed = Math.random() * Math.PI * 2;

    p.sprite.position.set(
      pos.x + (Math.random() - 0.5) * (opts.spreadX ?? 0.28),
      pos.y + (Math.random() - 0.2) * 0.06,
      pos.z + (Math.random() - 0.5) * (opts.spreadZ ?? 0.28)
    );
    p.vel.set(
      (Math.random() - 0.5) * 0.08,
      opts.riseSpeed ?? (0.34 + Math.random() * 0.24),
      (Math.random() - 0.5) * 0.08
    );
    p.sprite.scale.setScalar(p.startScale);
    p.sprite.material.opacity = 0;
    p.sprite.visible = true;
  }

  spawnSplash(pos, count = 8, opts = {}) {
    const color = opts.color ?? 0xffc636;
    const speed = opts.speed ?? 0.9;
    const scale = opts.scale ?? 1.0;
    const flat = opts.flat ?? false;
    let spawned = 0;
    for (const p of this.dropPool) {
      if (p.active) continue;
      p.active = true;
      p.age = 0;
      p.life = opts.life ?? (0.45 + Math.random() * 0.35);
      p.gravity = opts.gravity ?? -4.8;
      p.mesh.material.color.setHex(color);
      p.mesh.material.roughness = opts.roughness ?? 0.22;
      p.mesh.position.set(
        pos.x + (Math.random() - 0.5) * (opts.spread ?? 0.12),
        pos.y + Math.random() * 0.04,
        pos.z + (Math.random() - 0.5) * (opts.spread ?? 0.12)
      );
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      p.vel.set(
        Math.cos(ang) * spd,
        (opts.upSpeed ?? (0.65 + Math.random() * 0.9)) * speed,
        Math.sin(ang) * spd
      );
      p.rotSpeed.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
      const s = scale * (0.65 + Math.random() * 0.6);
      if (flat) {
        p.mesh.scale.set(s * 1.4, s * 0.35, s * 0.9);
      } else {
        p.mesh.scale.setScalar(s);
      }
      p.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  spawnBokehBurst(pos, count = 10) {
    let spawned = 0;
    for (const p of this.bokehPool) {
      if (p.active) continue;
      p.active = true;
      p.age = 0;
      p.life = 1.0 + Math.random() * 0.7;
      p.scale = 0.08 + Math.random() * 0.11;
      p.sprite.position.set(
        pos.x + (Math.random() - 0.5) * 0.55,
        pos.y + (Math.random() - 0.3) * 0.35,
        pos.z + (Math.random() - 0.5) * 0.25
      );
      p.vel.set(
        (Math.random() - 0.5) * 0.26,
        0.24 + Math.random() * 0.32,
        (Math.random() - 0.5) * 0.14
      );
      p.sprite.scale.setScalar(p.scale);
      p.sprite.material.opacity = 0;
      p.sprite.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  update(dt) {
    // Update steam
    for (const p of this.steamPool) {
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.x += (p.vel.x + Math.sin(p.age * 2.6 + p.swirlSeed) * 0.12) * dt;
      p.sprite.position.y += p.vel.y * dt;
      p.sprite.position.z += (p.vel.z + Math.cos(p.age * 2.1 + p.swirlSeed) * 0.08) * dt;
      const sc = p.startScale + (p.endScale - p.startScale) * Math.pow(t, 0.75);
      p.sprite.scale.setScalar(sc);
      const fadeIn = Math.min(1, t / 0.22);
      const fadeOut = Math.pow(1 - t, 1.35);
      p.sprite.material.opacity = p.maxOpacity * fadeIn * fadeOut;
    }

    // Update droplets/sprinkles
    for (const p of this.dropPool) {
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1 || p.mesh.position.y < -0.05) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;
      if (t > 0.75) {
        const shrink = 1 - (t - 0.75) / 0.25;
        p.mesh.scale.multiplyScalar(Math.max(0.01, Math.pow(shrink, 0.2)));
      }
    }

    // Update warm bokeh
    for (const p of this.bokehPool) {
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.addScaledVector(p.vel, dt);
      const pulse = Math.sin(t * Math.PI);
      p.sprite.material.opacity = 0.72 * pulse;
      p.sprite.scale.setScalar(p.scale * (0.7 + 0.55 * pulse));
    }
  }
}
