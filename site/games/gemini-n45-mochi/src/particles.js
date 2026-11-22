import * as THREE from 'three';
import { createParticleSprite } from './textures.js';
import { BOARD_Y } from './environment.js';

// Photorealistic GPU Particle System:
// Dual-layer Kinako flour dust (fine crisp swirling specks + billowing sunlit airy powder mist)
// + white rice-starch flour puffs + gentle warm mochi/tea steam + ambient shoji motes

export class MochiParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.grainTex = createParticleSprite('powder');
    this.cloudTex = createParticleSprite('powder_cloud');
    this.steamTex = createParticleSprite('steam');

    this.grainPool = this._createPool(680, this.grainTex, false, false);
    this.cloudPool = this._createPool(180, this.cloudTex, false, true);
    this.steamPool = this._createPool(100, this.steamTex, true, false);
    this.motePool = this._createAmbientMotes(55);

    this.steamTimer = 0;
  }

  _createPool(maxCount, texture, isSteam, isCloud) {
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const sizes = new Float32Array(maxCount);
    const alphas = new Float32Array(maxCount);
    const rotations = new Float32Array(maxCount);

    const velocities = new Float32Array(maxCount * 3);
    const ages = new Float32Array(maxCount);
    const lives = new Float32Array(maxCount);
    const baseSizes = new Float32Array(maxCount);
    const drags = new Float32Array(maxCount);
    const gravities = new Float32Array(maxCount);
    const seeds = new Float32Array(maxCount);
    const active = new Uint8Array(maxCount);

    for (let i = 0; i < maxCount; i++) {
      positions[i * 3 + 1] = -999;
      alphas[i] = 0;
      rotations[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rotations, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        attribute float aRot;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vRot;
        uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vRot = aRot;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (180.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vRot;
        void main() {
          if (vAlpha <= 0.004) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float c = cos(vRot);
          float s = sin(vRot);
          vec2 ruv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
          vec4 tex = texture2D(uMap, ruv);
          float a = tex.a * vAlpha;
          if (a <= 0.004) discard;
          gl_FragColor = vec4(vColor * tex.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = isSteam ? 8 : (isCloud ? 9 : 10);
    this.scene.add(points);

    return {
      maxCount,
      cursor: 0,
      isSteam,
      isCloud,
      geo,
      mat,
      points,
      positions,
      colors,
      sizes,
      alphas,
      rotations,
      velocities,
      ages,
      lives,
      baseSizes,
      drags,
      gravities,
      seeds,
      active,
    };
  }

  _createAmbientMotes(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11.0;
      positions[i * 3 + 1] = 0.6 + Math.random() * 4.2;
      positions[i * 3 + 2] = -4.5 + Math.random() * 7.5;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.96;
      colors[i * 3 + 2] = 0.86;
      sizes[i] = 0.11 + Math.random() * 0.15;
      alphas[i] = 0.16;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.grainTex },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (155.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float a = tex.a * vAlpha;
          if (a <= 0.004) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 11;
    this.scene.add(points);

    return { count, geo, positions, alphas, phases };
  }

  _spawn(pool, x, y, z, vx, vy, vz, r, g, b, size, life, drag, gravity) {
    const i = pool.cursor;
    pool.cursor = (pool.cursor + 1) % pool.maxCount;
    pool.active[i] = 1;
    pool.ages[i] = 0;
    pool.lives[i] = life;
    pool.baseSizes[i] = size;
    pool.drags[i] = drag;
    pool.gravities[i] = gravity;
    pool.seeds[i] = Math.random() * 6.283;
    pool.rotations[i] = Math.random() * 6.283;

    const i3 = i * 3;
    pool.positions[i3] = x;
    pool.positions[i3 + 1] = y;
    pool.positions[i3 + 2] = z;
    pool.velocities[i3] = vx;
    pool.velocities[i3 + 1] = vy;
    pool.velocities[i3 + 2] = vz;
    pool.colors[i3] = r;
    pool.colors[i3 + 1] = g;
    pool.colors[i3 + 2] = b;
    pool.sizes[i] = size;
    pool.alphas[i] = 0.01;
  }

  // Photorealistic sunlit golden Kinako powder cloud:
  // Layer 1 = wispy backlit golden-ochre flour haze puffs
  // Layer 2 = hundreds of tiny crisp individual toasted soybean powder grains!
  burstKinako(origin, intensity = 1.0) {
    // 1. Billowing airy golden flour haze puffs catching the white shoji backlight
    const puffCount = Math.round(28 * intensity);
    for (let i = 0; i < puffCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.42;
      const spd = (0.35 + Math.random() * 1.15) * intensity;
      const v = (Math.random() - 0.5) * 0.08;
      this._spawn(
        this.cloudPool,
        origin.x + Math.cos(ang) * rad,
        origin.y + 0.12 + Math.random() * 0.25,
        origin.z + Math.sin(ang) * rad,
        Math.cos(ang) * spd + 0.14, // subtle drift in shoji morning air
        (0.65 + Math.random() * 1.25) * intensity,
        Math.sin(ang) * spd,
        Math.min(1.0, 0.84 + v),
        Math.min(1.0, 0.64 + v * 0.8),
        Math.min(1.0, 0.30 + v * 0.5),
        1.15 + Math.random() * 1.05,
        1.9 + Math.random() * 1.6,
        2.4,
        -0.18
      );
    }

    // 2. Hundreds of ultra-fine crisp toasted kinako powder specks catching the white shoji backlight!
    const grainCount = Math.round(180 * intensity);
    for (let i = 0; i < grainCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.52;
      const isFloating = Math.random() < 0.60;
      const spd = (isFloating ? 0.50 + Math.random() * 1.45 : 0.85 + Math.random() * 1.95) * intensity;
      const v = (Math.random() - 0.5) * 0.14;
      const r = Math.min(1.0, 0.92 + v);
      const g = Math.min(1.0, 0.70 + v * 0.8);
      const b = Math.min(1.0, 0.30 + v * 0.5);

      this._spawn(
        this.grainPool,
        origin.x + Math.cos(ang) * rad,
        origin.y + 0.12 + Math.random() * 0.34,
        origin.z + Math.sin(ang) * rad,
        Math.cos(ang) * spd + 0.12,
        (isFloating ? 0.90 + Math.random() * 1.65 : 0.65 + Math.random() * 1.3) * intensity,
        Math.sin(ang) * spd,
        r, g, b,
        isFloating ? (0.11 + Math.random() * 0.16) : (0.08 + Math.random() * 0.12),
        isFloating ? (1.8 + Math.random() * 1.6) : (0.75 + Math.random() * 0.7),
        isFloating ? 2.4 : 1.3,
        isFloating ? -0.24 : -2.5
      );
    }
  }

  // Soft white rice-starch flour (もちとり粉) puff when tearing or rolling mochi
  burstFlour(origin, intensity = 1.0) {
    const puffCount = Math.round(10 * intensity);
    for (let i = 0; i < puffCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.28 + Math.random() * 0.85) * intensity;
      this._spawn(
        this.cloudPool,
        origin.x + (Math.random() - 0.5) * 0.35,
        origin.y + 0.08 + Math.random() * 0.16,
        origin.z + (Math.random() - 0.5) * 0.35,
        Math.cos(ang) * spd,
        (0.45 + Math.random() * 0.75) * intensity,
        Math.sin(ang) * spd,
        0.96, 0.95, 0.92,
        0.85 + Math.random() * 0.75,
        1.2 + Math.random() * 0.9,
        2.5,
        -0.16
      );
    }

    const grainCount = Math.round(35 * intensity);
    for (let i = 0; i < grainCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 1.15) * intensity;
      this._spawn(
        this.grainPool,
        origin.x + (Math.random() - 0.5) * 0.4,
        origin.y + 0.08 + Math.random() * 0.18,
        origin.z + (Math.random() - 0.5) * 0.4,
        Math.cos(ang) * spd,
        (0.55 + Math.random() * 1.0) * intensity,
        Math.sin(ang) * spd,
        0.98, 0.96, 0.92,
        0.07 + Math.random() * 0.10,
        0.8 + Math.random() * 0.8,
        1.8,
        -1.6
      );
    }
  }

  emitSteam(origin, scale = 1.0) {
    this._spawn(
      this.steamPool,
      origin.x + (Math.random() - 0.5) * 0.42 * scale,
      origin.y + 0.15,
      origin.z + (Math.random() - 0.5) * 0.42 * scale,
      (Math.random() - 0.5) * 0.12 + 0.08,
      0.42 + Math.random() * 0.28,
      (Math.random() - 0.5) * 0.12,
      1.0, 0.99, 0.97,
      (0.75 + Math.random() * 0.65) * scale,
      2.2 + Math.random() * 1.3,
      0.35,
      0.06
    );
  }

  update(dt, time, steamSources = []) {
    this.steamTimer += dt;
    if (this.steamTimer > 0.17) {
      this.steamTimer = 0;
      for (const src of steamSources) {
        if (Math.random() < (src.chance ?? 0.65)) {
          this.emitSteam(src.pos, src.scale ?? 1.0);
        }
      }
    }

    this._updatePool(this.grainPool, dt, time);
    this._updatePool(this.cloudPool, dt, time);
    this._updatePool(this.steamPool, dt, time);

    const m = this.motePool;
    for (let i = 0; i < m.count; i++) {
      const i3 = i * 3;
      const ph = m.phases[i];
      m.positions[i3] += Math.sin(time * 0.35 + ph) * 0.07 * dt + 0.03 * dt;
      m.positions[i3 + 1] += Math.cos(time * 0.28 + ph * 1.3) * 0.04 * dt;
      m.positions[i3 + 2] += Math.sin(time * 0.31 + ph * 0.7) * 0.05 * dt;
      if (m.positions[i3] > 6.0) m.positions[i3] = -5.8;
      m.alphas[i] = 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(time * 1.1 + ph));
    }
    m.geo.attributes.position.needsUpdate = true;
    m.geo.attributes.aAlpha.needsUpdate = true;
  }

  _updatePool(pool, dt, time) {
    const n = pool.maxCount;
    let changed = false;

    for (let i = 0; i < n; i++) {
      if (!pool.active[i]) continue;
      changed = true;
      pool.ages[i] += dt;
      const age = pool.ages[i];
      const life = pool.lives[i];
      if (age >= life) {
        pool.active[i] = 0;
        pool.alphas[i] = 0;
        pool.positions[i * 3 + 1] = -999;
        continue;
      }

      const t = age / life;
      const i3 = i * 3;
      const drag = Math.exp(-pool.drags[i] * dt);
      const seed = pool.seeds[i];

      const swirlX = Math.sin(time * 2.0 + seed + pool.positions[i3 + 1] * 2.0) * (pool.isSteam ? 0.18 : 0.24);
      const swirlZ = Math.cos(time * 1.8 + seed * 1.3 + pool.positions[i3] * 1.8) * (pool.isSteam ? 0.15 : 0.22);

      pool.velocities[i3] = pool.velocities[i3] * drag + swirlX * dt;
      pool.velocities[i3 + 1] = pool.velocities[i3 + 1] * drag + pool.gravities[i] * dt;
      pool.velocities[i3 + 2] = pool.velocities[i3 + 2] * drag + swirlZ * dt;

      pool.positions[i3] += pool.velocities[i3] * dt;
      pool.positions[i3 + 1] += pool.velocities[i3 + 1] * dt;
      pool.positions[i3 + 2] += pool.velocities[i3 + 2] * dt;
      pool.rotations[i] += (pool.isCloud ? 0.35 : 0.9) * dt;

      const floorY = pool.positions[i3] < 2.2 && pool.positions[i3] > -2.7 && pool.positions[i3 + 2] > -0.8 && pool.positions[i3 + 2] < 2.2
        ? BOARD_Y + 0.02
        : 0.02;
      if (!pool.isSteam && !pool.isCloud && pool.positions[i3 + 1] < floorY) {
        pool.positions[i3 + 1] = floorY;
        pool.velocities[i3] *= 0.45;
        pool.velocities[i3 + 1] = 0;
        pool.velocities[i3 + 2] *= 0.45;
      }

      if (pool.isSteam) {
        const fadeIn = Math.min(1, t / 0.20);
        const fadeOut = Math.pow(1 - t, 1.35);
        pool.alphas[i] = fadeIn * fadeOut * 0.36;
        pool.sizes[i] = pool.baseSizes[i] * (0.75 + t * 1.65);
      } else if (pool.isCloud) {
        const fadeIn = Math.min(1, t / 0.10);
        const fadeOut = Math.pow(1 - t, 1.30);
        pool.alphas[i] = fadeIn * fadeOut * 0.74;
        pool.sizes[i] = pool.baseSizes[i] * (0.70 + t * 1.50);
      } else {
        const fadeIn = Math.min(1, t / 0.05);
        const fadeOut = Math.pow(1 - t, 1.12);
        pool.alphas[i] = fadeIn * fadeOut * 0.92;
        pool.sizes[i] = pool.baseSizes[i] * 1.15;
      }
    }

    if (changed) {
      pool.geo.attributes.position.needsUpdate = true;
      pool.geo.attributes.aColor.needsUpdate = true;
      pool.geo.attributes.aSize.needsUpdate = true;
      pool.geo.attributes.aAlpha.needsUpdate = true;
      pool.geo.attributes.aRot.needsUpdate = true;
    }
  }
}
