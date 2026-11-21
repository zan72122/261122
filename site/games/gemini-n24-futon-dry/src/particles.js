import * as THREE from 'three';

// Volumetric sunlit dust motes, cotton lint wisps & warm sunbeam shimmer
// Uses a lightweight GPU point-sprite ShaderMaterial with Mie sunlit sparkle

const MAX_PARTICLES = 900;

export class DustParticles {
  constructor(scene) {
    this.scene = scene;
    this.cursor = 0;

    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.ages = new Float32Array(MAX_PARTICLES);
    this.lifetimes = new Float32Array(MAX_PARTICLES);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.kinds = new Float32Array(MAX_PARTICLES); // 0 = dust mote, 1 = cotton lint, 2 = warm golden puff
    this.seeds = new Float32Array(MAX_PARTICLES);

    // Initialize dead
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.ages[i] = 99;
      this.lifetimes[i] = 1;
      this.positions[i * 3 + 1] = -20;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(this.kinds, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1));

    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) }
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        attribute float aKind;
        attribute float aSeed;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vKind;
        varying float vSparkle;
        varying float vAngle;

        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          float dist = max(0.35, -mvPos.z);
          gl_PointSize = clamp((aSize * uPixelRatio * 290.0) / dist, 1.5, 42.0);
          vAlpha = aAlpha;
          vKind = aKind;
          // Sunlit Tyndall shimmer as tiny cotton fibers tumble in sunlight
          vSparkle = 0.72 + 0.28 * sin(uTime * 5.2 + aSeed * 37.0);
          vAngle = aSeed * 6.2831 + uTime * (0.8 + fract(aSeed * 7.3));
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vKind;
        varying float vSparkle;
        varying float vAngle;

        void main() {
          if (vAlpha <= 0.004) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);

          float shape = 0.0;
          vec3 col = vec3(1.0, 0.97, 0.89);

          if (vKind < 0.5) {
            // Soft sunlit bokeh dust mote (bright warm core + delicate halo)
            shape = smoothstep(0.5, 0.06, r);
            shape = pow(shape, 1.45);
            col = mix(vec3(0.96, 0.93, 0.86), vec3(1.0, 0.99, 0.93), shape);
          } else if (vKind < 1.5) {
            // Tiny tumbling cotton lint wisp (soft elongated fiber)
            float ca = cos(vAngle);
            float sa = sin(vAngle);
            vec2 rot = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);
            float d = length(vec2(rot.x * 1.0, rot.y * 3.1));
            shape = smoothstep(0.46, 0.05, d);
            col = vec3(0.99, 0.97, 0.94);
          } else {
            // Cozy sunlit warmth shimmer rising from freshly puffed futon
            shape = smoothstep(0.5, 0.02, r);
            shape = pow(shape, 2.0);
            col = vec3(1.0, 0.95, 0.80);
          }

          float alpha = shape * vAlpha * vSparkle;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Seed a subtle living handful of sunlit motes always floating in the sunny veranda air
    this.ambientTimer = 0;
  }

  _spawnOne(x, y, z, vx, vy, vz, life, size, kind) {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;

    this.positions[idx * 3] = x;
    this.positions[idx * 3 + 1] = y;
    this.positions[idx * 3 + 2] = z;

    this.velocities[idx * 3] = vx;
    this.velocities[idx * 3 + 1] = vy;
    this.velocities[idx * 3 + 2] = vz;

    this.ages[idx] = 0;
    this.lifetimes[idx] = life;
    this.sizes[idx] = size;
    this.kinds[idx] = kind;
    this.seeds[idx] = Math.random();
  }

  // Burst of sunlit dust & cotton lint erupting from a futon beat!
  spawnDustBurst(worldPos, intensity = 1.0, dustAmount = 1.0) {
    const count = Math.round((34 + dustAmount * 48) * Math.min(1.3, intensity));
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const spreadR = Math.pow(Math.random(), 0.65) * 0.24;
      const ox = Math.cos(theta) * spreadR;
      const oy = Math.sin(theta) * spreadR * 0.78;
      const oz = (Math.random() - 0.2) * 0.06;

      // Ejects outward toward sunlight & drifts upward in the warm breeze
      const speed = 0.22 + Math.random() * 0.52;
      const vx = ox * 1.7 + (Math.random() - 0.35) * 0.22;
      const vy = 0.14 + Math.random() * 0.32 + oy * 0.6;
      const vz = speed * (0.45 + Math.random() * 0.65);

      const isLint = Math.random() < 0.24;
      const size = isLint
        ? 0.022 + Math.random() * 0.026
        : 0.011 + Math.random() * 0.028;
      const life = 1.6 + Math.random() * 2.4;

      this._spawnOne(
        worldPos.x + ox,
        worldPos.y + oy,
        worldPos.z + 0.04 + oz,
        vx, vy, vz,
        life, size,
        isLint ? 1.0 : 0.0
      );
    }

    // Soft fine dust cloud halo right at the impact spot (large subtle low-alpha motes)
    for (let i = 0; i < 10; i++) {
      this._spawnOne(
        worldPos.x + (Math.random() - 0.5) * 0.18,
        worldPos.y + (Math.random() - 0.5) * 0.16,
        worldPos.z + 0.06,
        (Math.random() - 0.4) * 0.18,
        0.08 + Math.random() * 0.14,
        0.16 + Math.random() * 0.18,
        1.1 + Math.random() * 0.9,
        0.065 + Math.random() * 0.05,
        0.0
      );
    }
  }

  // Gentle sunlit warmth shimmer when the futon puffs up indoors or is squished
  spawnWarmthPuff(worldPos, count = 26) {
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * 0.92;
      const rz = (Math.random() - 0.5) * 1.12;
      this._spawnOne(
        worldPos.x + rx,
        worldPos.y + 0.06 + Math.random() * 0.08,
        worldPos.z + rz,
        (Math.random() - 0.5) * 0.06,
        0.12 + Math.random() * 0.18,
        (Math.random() - 0.5) * 0.06,
        1.5 + Math.random() * 1.8,
        0.014 + Math.random() * 0.022,
        2.0
      );
    }
  }

  update(dt, elapsed) {
    this.mat.uniforms.uTime.value = elapsed;

    // Subtle ambient sunlit motes floating in the bright veranda air
    this.ambientTimer += dt;
    if (this.ambientTimer > 0.22) {
      this.ambientTimer = 0;
      this._spawnOne(
        (Math.random() - 0.5) * 1.9,
        0.35 + Math.random() * 1.1,
        -0.75 + Math.random() * 1.8,
        0.04 + Math.random() * 0.05,
        0.02 + Math.random() * 0.03,
        (Math.random() - 0.5) * 0.03,
        3.5 + Math.random() * 2.5,
        0.010 + Math.random() * 0.014,
        2.0
      );
    }

    const alphas = this.geo.attributes.aAlpha.array;
    const drag = Math.exp(-dt * 2.1);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const age = this.ages[i];
      const life = this.lifetimes[i];
      if (age >= life) {
        alphas[i] = 0;
        continue;
      }

      const nextAge = age + dt;
      this.ages[i] = nextAge;
      const t = nextAge / life;

      const i3 = i * 3;
      const seed = this.seeds[i];

      // Air resistance + gentle sunny outdoor breeze curl
      this.velocities[i3] *= drag;
      this.velocities[i3 + 1] *= drag;
      this.velocities[i3 + 2] *= drag;

      const curlX = Math.sin(elapsed * 1.3 + seed * 19.0) * 0.075 + 0.045;
      const curlY = Math.cos(elapsed * 1.1 + seed * 13.0) * 0.035 + 0.025;
      const curlZ = Math.sin(elapsed * 0.9 + seed * 23.0) * 0.04;

      this.positions[i3] += (this.velocities[i3] + curlX) * dt;
      this.positions[i3 + 1] += (this.velocities[i3 + 1] + curlY) * dt;
      this.positions[i3 + 2] += (this.velocities[i3 + 2] + curlZ) * dt;

      // Smooth fade-in then long airy fade-out
      const fadeIn = Math.min(1, t / 0.08);
      const fadeOut = Math.pow(Math.max(0, 1 - t), 1.45);
      const baseAlpha = this.kinds[i] > 1.5 ? 0.55 : this.sizes[i] > 0.05 ? 0.24 : 0.78;
      alphas[i] = fadeIn * fadeOut * baseAlpha;
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aKind.needsUpdate = true;
    this.geo.attributes.aSeed.needsUpdate = true;
  }
}
