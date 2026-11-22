import * as THREE from '../vendor/three.module.js';

// Zero-GC pooled sprite particle system for steam clouds, pechi-pechi air bubbles,
// sizzling golden droplets, juicy cut sparkles, and watercolor hearts!

export class ParticleSystem {
  constructor(scene, spriteTextures) {
    this.scene = scene;
    this.tex = spriteTextures;
    this.pool = [];
    this.maxCount = 90;

    for (let i = 0; i < this.maxCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: spriteTextures.steam,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.raycast = () => {};
      scene.add(sprite);
      this.pool.push({
        sprite,
        mat,
        active: false,
        age: 0,
        life: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 0,
        startScale: 0.2,
        endScale: 0.5,
        maxOpacity: 0.8,
        swirl: 0
      });
    }
  }

  _acquire() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    return this.pool[(Math.random() * this.pool.length) | 0];
  }

  emit({
    kind = 'steam',
    pos,
    vx = 0,
    vy = 0.6,
    vz = 0,
    gravity = 0,
    life = 1.1,
    startScale = 0.2,
    endScale = 0.65,
    opacity = 0.78,
    color = 0xffffff,
    swirl = 0
  }) {
    const p = this._acquire();
    p.active = true;
    p.age = 0;
    p.life = life;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.gravity = gravity;
    p.startScale = startScale;
    p.endScale = endScale;
    p.maxOpacity = opacity;
    p.swirl = swirl;

    p.mat.map = this.tex[kind] || this.tex.steam;
    p.mat.color.setHex(color);
    p.mat.opacity = 0.01;
    p.mat.needsUpdate = true;

    p.sprite.position.copy(pos);
    p.sprite.scale.setScalar(startScale);
    p.sprite.visible = true;
  }

  burstBubbles(center, count = 5) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.7 + Math.random() * 1.1;
      this.emit({
        kind: 'bubble',
        pos: center.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.3) * 0.25,
          (Math.random() - 0.5) * 0.35
        )),
        vx: Math.cos(ang) * spd,
        vy: 0.85 + Math.random() * 0.9,
        vz: Math.sin(ang) * spd * 0.6,
        gravity: -0.35,
        life: 0.65 + Math.random() * 0.3,
        startScale: 0.14,
        endScale: 0.32,
        opacity: 0.92,
        swirl: 2.5
      });
    }
  }

  burstSteamCloud(center, count = 10, big = false) {
    for (let i = 0; i < count; i++) {
      this.emit({
        kind: 'steam',
        pos: center.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * (big ? 0.8 : 0.45),
          Math.random() * 0.2,
          (Math.random() - 0.5) * (big ? 0.6 : 0.35)
        )),
        vx: (Math.random() - 0.5) * 0.45,
        vy: (big ? 1.05 : 0.68) + Math.random() * 0.55,
        vz: (Math.random() - 0.5) * 0.35 - 0.18, // Curls gently toward the girl!
        gravity: 0.12,
        life: (big ? 1.5 : 1.15) + Math.random() * 0.45,
        startScale: big ? 0.34 : 0.22,
        endScale: big ? 1.15 : 0.72,
        opacity: big ? 0.75 : 0.52,
        swirl: 1.8
      });
    }
  }

  burstSizzleDrops(center, count = 6, color = 0xffd269) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.25;
      this.emit({
        kind: 'droplet',
        pos: center.clone().add(new THREE.Vector3(
          Math.cos(ang) * 0.35,
          0.08,
          Math.sin(ang) * 0.35
        )),
        vx: Math.cos(ang) * spd,
        vy: 1.4 + Math.random() * 1.2,
        vz: Math.sin(ang) * spd,
        gravity: -5.2,
        life: 0.48 + Math.random() * 0.22,
        startScale: 0.11,
        endScale: 0.06,
        opacity: 0.95,
        color
      });
    }
  }

  burstCelebration(center, count = 10, withHearts = false) {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 0.55 + Math.random() * 0.95;
      const isHeart = withHearts && i % 2 === 0;
      this.emit({
        kind: isHeart ? 'heart' : 'sparkle',
        pos: center.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.3) * 0.4,
          (Math.random() - 0.5) * 0.3
        )),
        vx: Math.cos(ang) * spd,
        vy: 0.75 + Math.random() * 0.85,
        vz: Math.sin(ang) * spd * 0.4,
        gravity: -0.35,
        life: 0.95 + Math.random() * 0.45,
        startScale: isHeart ? 0.18 : 0.16,
        endScale: isHeart ? 0.42 : 0.38,
        opacity: 0.96
      });
    }
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.vy += p.gravity * dt;
      p.sprite.position.x += (p.vx + Math.sin(p.age * 5.2 + i) * p.swirl * 0.08) * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;

      const s = p.startScale + (p.endScale - p.startScale) * t;
      p.sprite.scale.setScalar(s);

      // Smooth fade-in then fade-out
      const fadeIn = Math.min(1, t * 5.0);
      const fadeOut = 1 - Math.pow(t, 1.6);
      p.mat.opacity = p.maxOpacity * fadeIn * fadeOut;
    }
  }
}
