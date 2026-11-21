import * as THREE from '../vendor/three.module.js';

// Lightweight pooled 3D sprite particle system (steam, air puffs, oil sparkles, meat juice, salt, petals)
export class ParticleSystem {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.particles = [];
    this.pool = [];
    this.maxParticles = 140;

    // Pre-create lightweight sprite materials by kind
    this.materials = {
      steam: () => new THREE.SpriteMaterial({ map: textures.steam, transparent: true, opacity: 0.7, depthWrite: false }),
      airPuff: () => new THREE.SpriteMaterial({ map: textures.airPuff, transparent: true, opacity: 0.85, depthWrite: false }),
      sparkle: () => new THREE.SpriteMaterial({ map: textures.sparkle, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
      juice: () => new THREE.SpriteMaterial({ map: textures.juice, transparent: true, opacity: 0.95, depthWrite: false }),
      salt: () => new THREE.SpriteMaterial({ map: textures.sparkle, color: 0xfffdf6, transparent: true, opacity: 0.9, depthWrite: false }),
      petal: () => new THREE.SpriteMaterial({ map: textures.petal, transparent: true, opacity: 0.92, depthWrite: false }),
    };
  }

  emit({
    kind = 'steam',
    position = new THREE.Vector3(),
    velocity = new THREE.Vector3(0, 1, 0),
    gravity = 0,
    drag = 0.98,
    sizeStart = 0.25,
    sizeEnd = 0.6,
    life = 1.0,
    opacity = 0.85,
    color = null,
    swirl = 0,
  }) {
    if (this.particles.length >= this.maxParticles) {
      const oldest = this.particles.shift();
      this.scene.remove(oldest.sprite);
      oldest.sprite.material.dispose();
    }

    const mat = (this.materials[kind] || this.materials.steam)();
    if (color !== null) mat.color.setHex(color);
    mat.opacity = opacity;
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(sizeStart, sizeStart, 1);
    sprite.renderOrder = 10;
    this.scene.add(sprite);

    this.particles.push({
      sprite,
      vel: velocity.clone(),
      gravity,
      drag,
      sizeStart,
      sizeEnd,
      life,
      age: 0,
      maxOpacity: opacity,
      swirl,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Convenience bursts
  emitSteam(pos, count = 1, scale = 1.0) {
    for (let i = 0; i < count; i++) {
      this.emit({
        kind: 'steam',
        position: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.7 * scale,
          pos.y + Math.random() * 0.15,
          pos.z + (Math.random() - 0.5) * 0.5 * scale
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.28,
          0.65 + Math.random() * 0.45,
          (Math.random() - 0.5) * 0.22
        ),
        gravity: 0.12,
        drag: 0.985,
        sizeStart: 0.28 * scale,
        sizeEnd: 0.95 * scale,
        life: 1.15 + Math.random() * 0.55,
        opacity: 0.48,
        swirl: 0.45,
      });
    }
  }

  emitAirPuffs(pos, count = 5) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd = 1.1 + Math.random() * 0.8;
      this.emit({
        kind: 'airPuff',
        position: new THREE.Vector3(
          pos.x + Math.cos(a) * 0.25,
          pos.y + (Math.random() - 0.3) * 0.25,
          pos.z + Math.sin(a) * 0.2
        ),
        velocity: new THREE.Vector3(Math.cos(a) * spd, 0.4 + Math.random() * 0.6, Math.sin(a) * spd * 0.4),
        gravity: 0.2,
        drag: 0.92,
        sizeStart: 0.18,
        sizeEnd: 0.46,
        life: 0.55 + Math.random() * 0.25,
        opacity: 0.85,
      });
    }
  }

  emitSizzleSparkles(pos, count = 4, power = 1.0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.7 + Math.random() * 1.1) * power;
      this.emit({
        kind: 'sparkle',
        position: new THREE.Vector3(
          pos.x + Math.cos(a) * (0.45 + Math.random() * 0.4),
          pos.y + 0.08,
          pos.z + Math.sin(a) * (0.45 + Math.random() * 0.4)
        ),
        velocity: new THREE.Vector3(Math.cos(a) * spd, (1.2 + Math.random() * 1.4) * power, Math.sin(a) * spd),
        gravity: -4.2,
        drag: 0.96,
        sizeStart: 0.18 * power,
        sizeEnd: 0.04,
        life: 0.38 + Math.random() * 0.25,
        opacity: 0.95,
      });
    }
  }

  emitMeatJuiceBurst(pos, big = true) {
    const count = big ? 22 : 12;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.9 + Math.random() * 1.6) * (big ? 1.25 : 0.85);
      this.emit({
        kind: i % 3 === 0 ? 'sparkle' : 'juice',
        position: new THREE.Vector3(pos.x, pos.y + 0.12, pos.z),
        velocity: new THREE.Vector3(Math.cos(a) * spd, 1.8 + Math.random() * 1.9, Math.sin(a) * spd),
        gravity: -5.4,
        drag: 0.96,
        sizeStart: 0.18 + Math.random() * 0.14,
        sizeEnd: 0.05,
        life: 0.62 + Math.random() * 0.32,
        opacity: 0.96,
      });
    }
  }

  emitSaltShower(pos) {
    for (let i = 0; i < 16; i++) {
      this.emit({
        kind: 'salt',
        position: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.5,
          pos.y + Math.random() * 0.25,
          pos.z + (Math.random() - 0.5) * 0.45
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.55,
          -1.6 - Math.random() * 0.8,
          (Math.random() - 0.5) * 0.45
        ),
        gravity: -3.2,
        drag: 0.98,
        sizeStart: 0.11,
        sizeEnd: 0.06,
        life: 0.55 + Math.random() * 0.25,
        opacity: 0.95,
      });
    }
  }

  emitHappyBlossoms(pos, count = 14) {
    const colors = [0xffb7b2, 0xffe29a, 0xffd1dc, 0xfff5d6, 0xc7e9b0];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.4;
      this.emit({
        kind: i % 2 === 0 ? 'petal' : 'sparkle',
        position: new THREE.Vector3(
          pos.x + Math.cos(a) * r,
          pos.y + Math.random() * 1.1,
          pos.z + (Math.random() - 0.5) * 0.7
        ),
        velocity: new THREE.Vector3(
          Math.cos(a) * (0.4 + Math.random() * 0.7),
          0.7 + Math.random() * 0.9,
          (Math.random() - 0.5) * 0.4
        ),
        gravity: -0.35,
        drag: 0.97,
        sizeStart: 0.22 + Math.random() * 0.16,
        sizeEnd: 0.14,
        life: 1.4 + Math.random() * 0.8,
        opacity: 0.92,
        color: colors[i % colors.length],
        swirl: 0.8,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.swirl > 0) {
        p.sprite.position.x += Math.sin(p.age * 3.5 + p.phase) * p.swirl * dt;
      }
      const s = THREE.MathUtils.lerp(p.sizeStart, p.sizeEnd, t);
      p.sprite.scale.set(s, s, 1);
      // Smooth fade-in then fade-out
      const fadeIn = Math.min(1, t * 5);
      const fadeOut = 1 - Math.pow(t, 1.5);
      p.sprite.material.opacity = p.maxOpacity * fadeIn * fadeOut;
    }
  }
}
