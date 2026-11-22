import * as THREE from '../vendor/three.module.js';

/**
 * Photorealistic fire, glowing embers, turbulent sparks, backlit autumn smoke,
 * and dense backlit macro steam for the broken sweet potato.
 */
export class BonfireParticles {
  constructor(scene, particleSprites) {
    this.scene = scene;
    this.sprites = particleSprites;
    this.time = 0;

    // 1. Volumetric Layered GLSL Flame Plumes
    this.flameUniforms = {
      uTime: { value: 0 },
      uIntensity: { value: 0.25 },
      uWind: { value: new THREE.Vector2(0.08, 0.0) },
    };

    const flameVert = /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      uniform vec2 uWind;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float h = uv.y;
        float sway = sin(uTime * 5.2 + pos.x * 3.1 + h * 4.5) * 0.11 * h * (0.5 + uIntensity);
        float flutter = cos(uTime * 8.4 + pos.z * 4.2 + h * 6.0) * 0.06 * h;
        pos.x += sway + uWind.x * h * h * 0.42;
        pos.z += flutter + uWind.y * h * h * 0.42;
        pos.y *= (0.35 + uIntensity * 0.92);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const flameFrag = /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv;
        float cx = (uv.x - 0.5) * 2.0;
        float h = uv.y;

        // Rising turbulent flame distortion
        vec2 nUv = vec2(cx * 1.9, h * 2.8 - uTime * 2.85);
        float n1 = fbm(nUv);
        float n2 = fbm(nUv * 2.1 + vec2(3.7, -uTime * 1.9));

        float distort = (n1 - 0.5) * 0.65 + (n2 - 0.5) * 0.35;
        float width = mix(0.88, 0.05, pow(h, 0.78));
        float dist = abs(cx + distort * (0.25 + h * 0.95));

        float shape = smoothstep(width, width * 0.14, dist);
        shape *= smoothstep(0.0, 0.16, h) * smoothstep(1.0, 0.25, h + (n1 - 0.45) * 0.45);

        float core = smoothstep(0.55, 0.0, dist) * smoothstep(0.68, 0.04, h) * (0.6 + 0.4 * n2);

        // Filmic natural wood-fire blackbody color ramp
        vec3 deepRed = vec3(0.85, 0.14, 0.02);
        vec3 richOrange = vec3(1.0, 0.44, 0.06);
        vec3 brightGold = vec3(1.0, 0.82, 0.28);
        vec3 hotWhite = vec3(1.0, 0.98, 0.88);

        vec3 col = mix(deepRed, richOrange, smoothstep(0.05, 0.48, shape));
        col = mix(col, brightGold, smoothstep(0.42, 0.82, shape + core * 0.35));
        col = mix(col, hotWhite, smoothstep(0.52, 0.95, core));

        float alpha = shape * smoothstep(0.02, 0.28, uIntensity) * 0.92;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * (1.05 + uIntensity * 0.45), alpha);
      }
    `;

    this.flameGroup = new THREE.Group();
    const flameMat = new THREE.ShaderMaterial({
      uniforms: this.flameUniforms,
      vertexShader: flameVert,
      fragmentShader: flameFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 7 intersecting organic flame curtains at varied angles & offsets so fire looks 3D from every camera angle
    const flameSpecs = [
      { x: 0, z: 0, w: 0.96, h: 1.48, rotY: 0 },
      { x: 0.02, z: -0.02, w: 0.92, h: 1.42, rotY: Math.PI / 3 },
      { x: -0.02, z: 0.02, w: 0.92, h: 1.42, rotY: -Math.PI / 3 },
      { x: -0.24, z: 0.12, w: 0.62, h: 0.98, rotY: 0.4 },
      { x: 0.26, z: -0.08, w: 0.58, h: 0.94, rotY: -0.7 },
      { x: 0.08, z: 0.22, w: 0.54, h: 0.85, rotY: 1.1 },
      { x: -0.14, z: -0.22, w: 0.56, h: 0.9, rotY: -1.2 },
    ];
    flameSpecs.forEach((fs) => {
      const geo = new THREE.PlaneGeometry(fs.w, fs.h, 4, 8);
      geo.translate(0, fs.h * 0.5 - 0.04, 0);
      const m = new THREE.Mesh(geo, flameMat);
      m.position.set(fs.x, 0.0, fs.z);
      m.rotation.y = fs.rotY;
      this.flameGroup.add(m);
    });
    scene.add(this.flameGroup);

    // 2. Turbulent Rising Sparks / Embers (火の粉) — 200 GPU Points
    this.sparkCount = 200;
    this.sparks = [];
    const sparkPos = new Float32Array(this.sparkCount * 3);
    const sparkCol = new Float32Array(this.sparkCount * 3);
    const sparkSize = new Float32Array(this.sparkCount);

    for (let i = 0; i < this.sparkCount; i++) {
      this.sparks.push({
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        seed: Math.random() * 100,
        size: 0.08 + Math.random() * 0.12,
      });
      sparkPos[i * 3 + 1] = -10;
      sparkCol[i * 3] = 1;
      sparkCol[i * 3 + 1] = 0.6;
      sparkCol[i * 3 + 2] = 0.15;
      sparkSize[i] = 0.1;
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1));

    const sparkMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: particleSprites.sparkTex },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (340.0 / max(0.5, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.02) discard;
          gl_FragColor = vec4(vColor * tex.rgb * 1.45, tex.a);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    scene.add(this.sparkPoints);

    // 3. Backlit Autumn Smoke Plumes (煙) — soft swirling sprite pool
    this.smokePool = [];
    for (let i = 0; i < 42; i++) {
      const mat = new THREE.SpriteMaterial({
        map: particleSprites.vaporTex,
        color: '#e5b89d', // magic-hour sunlit peach-lavender smoke
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.smokePool.push({
        sprite: sp,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        baseScale: 0.4, grow: 1.4,
        rotSpeed: 0,
        maxOpacity: 0.25,
      });
    }

    // 4. HERO MACRO STEAM POOL (ほかほか湯気) — backlit golden cream vapor curls
    // Dedicated pool for both roasting foil wisps and dramatic macro broken-potato cross-section steam!
    this.steamPool = [];
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.SpriteMaterial({
        map: particleSprites.vaporTex,
        color: '#fff2dc', // bright magic-hour backlit cream-gold steam
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.steamPool.push({
        sprite: sp,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        baseScale: 0.14, grow: 0.45,
        rotSpeed: 0,
        maxOpacity: 0.42,
        seed: Math.random() * 50,
      });
    }

    this._sparkCursor = 0;
    this._smokeCursor = 0;
    this._steamCursor = 0;
    this._smokeTimer = 0;
    this._sparkTimer = 0;
    this._steamTimer = 0;
    this.blowWind = new THREE.Vector3();
  }

  spawnSpark(origin, speedScale = 1.0) {
    const s = this.sparks[this._sparkCursor];
    this._sparkCursor = (this._sparkCursor + 1) % this.sparkCount;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.42;
    s.x = origin.x + Math.cos(ang) * rad;
    s.y = origin.y + Math.random() * 0.18;
    s.z = origin.z + Math.sin(ang) * rad;
    s.vx = (Math.random() - 0.5) * 0.65 * speedScale;
    s.vy = (0.95 + Math.random() * 1.45) * speedScale;
    s.vz = (Math.random() - 0.5) * 0.65 * speedScale;
    s.life = 0.001;
    s.maxLife = 0.8 + Math.random() * 1.4;
    s.size = 0.065 + Math.random() * 0.11;
  }

  burstSparks(origin, count = 24, speedScale = 1.3) {
    for (let i = 0; i < count; i++) {
      this.spawnSpark(origin, speedScale * (0.7 + Math.random() * 0.65));
    }
  }

  spawnSmoke(origin, intensity = 0.6) {
    const p = this.smokePool[this._smokeCursor];
    this._smokeCursor = (this._smokeCursor + 1) % this.smokePool.length;
    p.sprite.position.set(
      origin.x + (Math.random() - 0.5) * 0.42,
      origin.y + 0.38 + Math.random() * 0.28,
      origin.z + (Math.random() - 0.5) * 0.42
    );
    p.vx = 0.16 + (Math.random() - 0.5) * 0.22;
    p.vy = 0.58 + Math.random() * 0.42 + intensity * 0.36;
    p.vz = (Math.random() - 0.5) * 0.16;
    p.life = 0.001;
    p.maxLife = 2.8 + Math.random() * 2.1;
    p.baseScale = 0.48 + Math.random() * 0.34;
    p.grow = 1.85 + Math.random() * 1.05;
    p.rotSpeed = (Math.random() - 0.5) * 0.55;
    p.maxOpacity = 0.24 + intensity * 0.20;
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
  }

  spawnSteam(origin, scaleMul = 1.0, opacityMul = 1.0) {
    const p = this.steamPool[this._steamCursor];
    this._steamCursor = (this._steamCursor + 1) % this.steamPool.length;
    p.sprite.position.set(
      origin.x + (Math.random() - 0.5) * 0.12 * scaleMul,
      origin.y + 0.05 + Math.random() * 0.09 * scaleMul,
      origin.z + (Math.random() - 0.5) * 0.08 * scaleMul
    );
    p.vx = (Math.random() - 0.5) * 0.09;
    p.vy = (0.34 + Math.random() * 0.28) * (0.8 + scaleMul * 0.25);
    p.vz = (Math.random() - 0.5) * 0.07;
    p.life = 0.001;
    p.maxLife = 1.85 + Math.random() * 1.15;
    p.baseScale = (0.14 + Math.random() * 0.10) * scaleMul;
    p.grow = (0.56 + Math.random() * 0.34) * scaleMul;
    p.rotSpeed = (Math.random() - 0.5) * 0.85;
    // Lush luminous backlit cream-gold steam curls clearly visible against the dusky autumn backdrop!
    p.maxOpacity = Math.min(0.68, (0.38 + Math.random() * 0.20) * opacityMul);
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
  }

  // Interactive ふーふー breeze impulse on macro steam
  applySteamBlow(dirX, dirZ, strength = 1.0) {
    this.blowWind.x += dirX * strength * 1.4;
    this.blowWind.z += dirZ * strength * 1.4;
    this.blowWind.clampLength(0, 2.8);
  }

  update(dt, fireIntensity, steamSources = []) {
    this.time += dt;
    this.flameUniforms.uTime.value = this.time;
    this.flameUniforms.uIntensity.value = fireIntensity;
    this.flameUniforms.uWind.value.set(
      0.16 + Math.sin(this.time * 0.9) * 0.12 + this.blowWind.x * 0.4,
      Math.cos(this.time * 0.7) * 0.08 + this.blowWind.z * 0.4
    );

    // Decay interactive blow wind smoothly
    this.blowWind.multiplyScalar(Math.exp(-dt * 2.8));

    // Continuous sparks proportional to fire intensity
    this._sparkTimer -= dt;
    const sparkRate = 0.018 / Math.max(0.12, fireIntensity * 1.25);
    if (this._sparkTimer <= 0) {
      this._sparkTimer = Math.min(0.25, sparkRate);
      const count = fireIntensity > 0.7 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.spawnSpark({ x: 0, y: 0.08, z: 0 }, 0.65 + fireIntensity * 0.75);
      }
    }

    // Continuous backlit smoke from bonfire
    this._smokeTimer -= dt;
    if (this._smokeTimer <= 0) {
      this._smokeTimer = 0.16 / Math.max(0.28, fireIntensity + 0.2);
      this.spawnSmoke({ x: 0, y: 0.12, z: 0 }, fireIntensity);
    }

    // Emit billowing macro steam from active hot sweet potato sources
    this._steamTimer -= dt;
    if (steamSources.length > 0 && this._steamTimer <= 0) {
      this._steamTimer = 0.052;
      for (const src of steamSources) {
        if (Math.random() < (src.rate ?? 1.0)) {
          this.spawnSteam(src.pos, src.scale ?? 1.0, src.opacity ?? 1.0);
        }
      }
    }

    // Update sparks buffer
    const posArr = this.sparkPoints.geometry.attributes.position.array;
    const colArr = this.sparkPoints.geometry.attributes.color.array;
    const sizeArr = this.sparkPoints.geometry.attributes.aSize.array;

    for (let i = 0; i < this.sparkCount; i++) {
      const s = this.sparks[i];
      if (s.life <= 0) {
        posArr[i * 3 + 1] = -10;
        sizeArr[i] = 0;
        continue;
      }
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.life = 0;
        posArr[i * 3 + 1] = -10;
        sizeArr[i] = 0;
        continue;
      }
      const u = s.life / s.maxLife;
      // Swirling thermal updraft curl
      const curlX = Math.sin(this.time * 3.8 + s.seed + u * 5.0) * 0.55;
      const curlZ = Math.cos(this.time * 3.3 + s.seed + u * 4.5) * 0.55;
      s.x += (s.vx + curlX + 0.15 + this.blowWind.x * 0.6) * dt;
      s.y += s.vy * dt;
      s.z += (s.vz + curlZ + this.blowWind.z * 0.6) * dt;
      s.vy *= 1 - dt * 0.22;

      posArr[i * 3] = s.x;
      posArr[i * 3 + 1] = s.y;
      posArr[i * 3 + 2] = s.z;

      // Hot white-gold -> glowing orange -> fading ember red
      const fade = Math.sin(u * Math.PI);
      colArr[i * 3] = 1.0;
      colArr[i * 3 + 1] = Math.max(0.18, 0.92 - u * 0.72);
      colArr[i * 3 + 2] = Math.max(0.02, 0.45 - u * 0.55);
      sizeArr[i] = s.size * (0.4 + fade * 0.95);
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.sparkPoints.geometry.attributes.color.needsUpdate = true;
    this.sparkPoints.geometry.attributes.aSize.needsUpdate = true;

    // Update smoke sprites
    for (const p of this.smokePool) {
      if (p.life <= 0) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.sprite.visible = false;
        continue;
      }
      const u = p.life / p.maxLife;
      p.sprite.position.x += (p.vx + Math.sin(this.time * 0.8 + u * 3) * 0.12 + this.blowWind.x * 0.35) * dt;
      p.sprite.position.y += p.vy * (1 - u * 0.35) * dt;
      p.sprite.position.z += (p.vz + this.blowWind.z * 0.35) * dt;
      const sc = p.baseScale + p.grow * Math.pow(u, 0.75);
      p.sprite.scale.set(sc, sc, 1);
      p.sprite.material.rotation += p.rotSpeed * dt;
      // Smooth fade in & long backlit dissipation
      const env = Math.min(1, u * 4.5) * Math.pow(1 - u, 1.35);
      p.sprite.material.opacity = env * p.maxOpacity;
    }

    // Update macro steam sprites (sensitive to ふーふー breeze!)
    for (const p of this.steamPool) {
      if (p.life <= 0) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.sprite.visible = false;
        continue;
      }
      const u = p.life / p.maxLife;
      const curlX = Math.sin(this.time * 2.4 + p.seed + u * 4.2) * 0.08;
      const curlZ = Math.cos(this.time * 2.1 + p.seed + u * 3.8) * 0.08;
      p.sprite.position.x += (p.vx + curlX + this.blowWind.x * (0.45 + u * 0.9)) * dt;
      p.sprite.position.y += p.vy * (1 - u * 0.28) * dt;
      p.sprite.position.z += (p.vz + curlZ + this.blowWind.z * (0.45 + u * 0.9)) * dt;

      const sc = p.baseScale + p.grow * Math.pow(u, 0.82);
      p.sprite.scale.set(sc, sc * 1.12, 1);
      p.sprite.material.rotation += p.rotSpeed * dt;
      const env = Math.min(1, u * 5.2) * Math.pow(1 - u, 1.25);
      p.sprite.material.opacity = env * p.maxOpacity;
    }
  }
}
