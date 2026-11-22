import * as THREE from '../vendor/three.module.js';

// =========================================================================
// SIGNATURE FLUID SYSTEM:
// 1. Custom GLSL Simmering Broth -> Melting Roux Marbling -> Thick Viscous Glossy Curry
//    - Real-time convection swirls, ladle stir vortex & viscous trailing wake
//    - Animated rising & popping boiling domes (high-frequency watery -> slow thick volcanic curry bubbles!)
//    - Sunset western specular highlights & glossy oil sheen
// 2. 3D Physical Popping Bubble Domes (catch western sunlight rim!)
// 3. Stretchy Viscous Curry Dripping Ribbon from Ladle to Rice
// 4. Backlit Evening Steam & Hot Oil Sizzle Sparkles
// =========================================================================

const FLUID_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSimmer;
  uniform float uViscosity;
  uniform float uStirSpeed;
  uniform vec2 uStirPos;
  uniform float uSwirlAngle;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vHeight;
  varying float vWake;
  varying float vBubbleMask;

  // Fast 2D hash & smooth noise in GLSL
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 p = pos.xz; // -radius..radius
    float r = length(p);

    // Rotated polar coordinates following ladle swirl
    float ca = cos(uSwirlAngle);
    float sa = sin(uSwirlAngle);
    vec2 pr = mat2(ca, -sa, sa, ca) * p;

    // Gentle convection waves (slower, thicker folds as viscosity rises)
    float speed = mix(2.8, 0.95, uViscosity);
    float n1 = noise(pr * 18.0 + vec2(uTime * speed * 0.45, -uTime * speed * 0.32));
    float n2 = noise(pr * 34.0 - vec2(uTime * speed * 0.65, uTime * speed * 0.55));
    float convect = (n1 - 0.5) * 0.0055 + (n2 - 0.5) * 0.0024 * (1.0 - uViscosity * 0.55);

    // Viscous thick ridges trailing behind ladle stir position!
    float dStir = length(p - uStirPos);
    float stirRing = sin(dStir * 52.0 - uTime * 9.5) * exp(-dStir * 11.0);
    float wakeRidge = exp(-dStir * 18.0) * (0.003 + uViscosity * 0.0065) * uStirSpeed;
    float wake = (stirRing * 0.0035 * (1.0 - uViscosity * 0.45) + wakeRidge) * uStirSpeed;

    // Simmering bubble domes pushing up through surface
    float bSpeed = mix(3.4, 1.15, uViscosity);
    float bCell = noise(p * mix(30.0, 19.0, uViscosity) + vec2(0.0, uTime * bSpeed * 0.3));
    float bPulse = pow(max(0.0, sin(uTime * bSpeed + bCell * 18.0)), mix(5.0, 3.0, uViscosity));
    float bMask = smoothstep(0.62, 0.88, bCell) * bPulse * uSimmer * smoothstep(0.165, 0.11, r);
    float bubbleLift = bMask * mix(0.0045, 0.0085, uViscosity);

    // Meniscus climb slightly along pot inner wall
    float meniscus = smoothstep(0.115, 0.155, r) * (0.003 + uViscosity * 0.0045);

    float h = (convect * (0.4 + uSimmer * 0.85) + wake + bubbleLift + meniscus);
    pos.y += h;

    vHeight = h;
    vWake = clamp(abs(wake) * 140.0 + bMask * 0.5, 0.0, 1.0);
    vBubbleMask = bMask;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FLUID_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSimmer;
  uniform float uViscosity;   // 0 = clear golden broth, 1 = thick mahogany Japanese curry
  uniform float uRouxMelt;    // 0 -> 1 drives dramatic marbling ribbons of dark roux!
  uniform float uSwirlAngle;
  uniform float uOpacity;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vHeight;
  varying float vWake;
  varying float vBubbleMask;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
    vec2 centered = (vUv - 0.5) * 2.0;
    float rad = length(centered);
    if (rad > 1.0) discard;

    // Swirl UV distortion (strong spiral ribbons as roux melts!)
    float ang = atan(centered.y, centered.x);
    float spiral = ang + uSwirlAngle * 1.45 + (1.0 - rad) * (2.6 + uViscosity * 3.4);
    vec2 swirled = vec2(cos(spiral), sin(spiral)) * rad;

    // Domain-warped fBm for liquid convection & dark roux marbling streaks
    float tFlow = uTime * mix(0.28, 0.08, uViscosity);
    vec2 q = vec2(
      fbm(swirled * 3.4 + vec2(tFlow, -tFlow * 0.6)),
      fbm(swirled * 3.4 + vec2(-tFlow * 0.7, tFlow * 0.9) + 4.3)
    );
    float marble = fbm(swirled * 5.2 + q * 2.4);
    float fineSpice = noise(swirled * 38.0 + q * 4.0);

    // Rich culinary palette progression:
    // 1. Translucent golden vegetable broth
    vec3 brothDeep = vec3(0.46, 0.27, 0.09);
    vec3 brothLight = vec3(0.76, 0.52, 0.20);
    vec3 brothCol = mix(brothDeep, brothLight, smoothstep(0.25, 0.8, marble));

    // 2. Dark melting curry roux ribbons (visible during mid-melt!)
    vec3 rouxRibbon = vec3(0.16, 0.065, 0.02);

    // 3. Finished glossy Japanese home-style mahogany-amber curry!
    vec3 curryDeep = vec3(0.25, 0.105, 0.028);
    vec3 curryWarm = vec3(0.42, 0.195, 0.048);
    vec3 curryBase = mix(curryDeep, curryWarm, smoothstep(0.22, 0.78, marble));
    // Micro spice flecks (turmeric/garam masala warmth)
    curryBase += vec3(0.055, 0.032, 0.008) * smoothstep(0.68, 0.92, fineSpice);

    // Dramatic marbling blend while roux is dissolving (peaks around uRouxMelt = 0.2..0.75)
    float marbleBand = sin(clamp(uRouxMelt, 0.0, 1.0) * 3.14159);
    float ribbonMask = smoothstep(0.42, 0.70, marble + (q.x - 0.5) * 0.45) * marbleBand;
    vec3 baseCol = mix(brothCol, curryBase, smoothstep(0.05, 0.95, uViscosity));
    baseCol = mix(baseCol, rouxRibbon, ribbonMask * 0.72);

    // Subtle pot wall depth darkening
    baseCol *= mix(1.0, 0.62, smoothstep(0.68, 1.0, rad));

    // Smooth analytical surface normal (ZERO triangle faceting!) from domain-warped viscous ridges & simmering domes
    float eps = 0.025;
    float h0 = fbm(swirled * 6.5 + vec2(tFlow * 1.2, -tFlow * 0.8)) + vBubbleMask * 0.65;
    float hx = fbm((swirled + vec2(eps, 0.0)) * 6.5 + vec2(tFlow * 1.2, -tFlow * 0.8));
    float hy = fbm((swirled + vec2(0.0, eps)) * 6.5 + vec2(tFlow * 1.2, -tFlow * 0.8));
    // Thick viscous wake & bubble crater gradient
    float waveAmp = mix(0.55, 0.42, uViscosity) * (0.6 + uSimmer * 0.55 + vWake * 1.15);
    vec3 N = normalize(vec3((h0 - hx) * waveAmp, 0.35, (h0 - hy) * waveAmp));
    // Gentle meniscus curve near pot edge
    N = normalize(mix(N, normalize(vec3(-centered.x * 0.45, 1.0, -centered.y * 0.45)), smoothstep(0.75, 1.0, rad) * 0.55));

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(L + V);

    // Evening western sunlight diffuse + warm grazing subsurface glow on thick curry ridges
    float NdotL = max(dot(N, L), 0.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.6);

    // Glossy oil-and-roux specular highlight (silky warm sunset glint!)
    float shininess = mix(110.0, 56.0, uViscosity);
    float spec = pow(max(dot(N, H), 0.0), shininess) * mix(1.35, 1.05, uViscosity);

    // Secondary soft overhead kitchen pendant catchlight
    vec3 L2 = normalize(vec3(0.2, 1.0, 0.3));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(dot(N, H2), 0.0), 36.0) * 0.38;

    // Simmering bubble foam rim (delicate amber-cream collar around simmering pockets & pot edge)
    float rimFoam = smoothstep(0.76, 0.96, rad) * smoothstep(0.42, 0.78, marble) * uSimmer * (1.0 - uViscosity * 0.5);
    float bubbleRim = smoothstep(0.22, 0.82, vBubbleMask) * (0.42 + 0.42 * (1.0 - uViscosity * 0.35));
    vec3 foamCol = mix(vec3(0.97, 0.87, 0.68), vec3(0.72, 0.45, 0.20), uViscosity);

    vec3 col = baseCol * (0.48 + 0.78 * NdotL);
    // Warm amber western sky reflection via Fresnel
    col += vec3(1.0, 0.58, 0.22) * fresnel * (0.30 + uViscosity * 0.14);
    // Bright crisp sunset specular glints
    col += vec3(1.0, 0.80, 0.50) * spec;
    col += vec3(1.0, 0.92, 0.82) * spec2;
    // Foam & simmering bubble collars
    col = mix(col, foamCol, clamp(rimFoam * 0.48 + bubbleRim * 0.52, 0.0, 0.75));

    // Oil droplets glistening on top of broth/curry!
    float oilCell = noise(swirled * 20.0 + q * 1.4);
    float oilRing = smoothstep(0.75, 0.81, oilCell) * (1.0 - smoothstep(0.83, 0.88, oilCell));
    col += vec3(1.0, 0.76, 0.40) * oilRing * (0.28 + fresnel * 0.55);

    // Opacity: clear-ish golden broth when viscosity=0, rich opaque velvety curry when viscosity=1
    float alpha = mix(0.78, 0.99, smoothstep(0.0, 0.65, uViscosity)) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

export class CurryFluidSystem {
  constructor(potCenter, potRadius, steamTex) {
    this.potCenter = potCenter.clone();
    this.potRadius = potRadius;
    this.group = new THREE.Group();
    this.group.position.copy(potCenter);

    // 1. Main custom-shader liquid surface disc (high-res concentric ring geometry for smooth bubbles!)
    const segsR = 40;
    const segsT = 22;
    const discGeo = new THREE.CircleGeometry(potRadius * 0.955, segsR);
    // Subdivide radial rings manually for smooth vertex bubble displacement
    const customGeo = new THREE.RingGeometry(0.001, potRadius * 0.955, segsR, segsT);
    customGeo.rotateX(-Math.PI * 0.5);
    discGeo.dispose();

    this.uniforms = {
      uTime: { value: 0 },
      uSimmer: { value: 0 },
      uViscosity: { value: 0 },
      uRouxMelt: { value: 0 },
      uStirSpeed: { value: 0 },
      uStirPos: { value: new THREE.Vector2(0, 0) },
      uSwirlAngle: { value: 0 },
      uOpacity: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.78, 0.34, -0.52).normalize() },
    };

    this.fluidMat = new THREE.ShaderMaterial({
      vertexShader: FLUID_VERT,
      fragmentShader: FLUID_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
    });

    this.surfaceMesh = new THREE.Mesh(customGeo, this.fluidMat);
    this.surfaceMesh.position.y = 0.02;
    this.surfaceMesh.visible = false;
    this.group.add(this.surfaceMesh);

    // 2. Physical 3D Rising & Popping Glossy Bubbles + Delicate Simmering Foam Collars!
    this.bubbles = [];
    this.bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0x8a4e1e,
      roughness: 0.05,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.88,
    });
    this.foamRingMat = new THREE.MeshBasicMaterial({
      map: steamTex,
      color: 0xf4dab0,
      transparent: true,
      opacity: 0.50,
      depthWrite: false,
    });
    const bGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const ringGeo = new THREE.PlaneGeometry(3.2, 3.2);
    ringGeo.rotateX(-Math.PI * 0.5);
    for (let i = 0; i < 28; i++) {
      const grp = new THREE.Group();
      const m = new THREE.Mesh(bGeo, this.bubbleMat);
      const rRing = new THREE.Mesh(ringGeo, this.foamRingMat);
      rRing.position.y = 0.08;
      grp.add(m, rRing);
      grp.visible = false;
      this.group.add(grp);
      this.bubbles.push({
        mesh: grp,
        ring: rRing,
        active: false,
        age: 0,
        life: 0.9,
        maxR: 0.015,
        x: 0,
        z: 0,
      });
    }
    this.bubbleSpawnTimer = 0;

    // 3. Glossy Oil Film on pot bottom during Sautéing stage
    this.oilMesh = new THREE.Mesh(
      new THREE.CircleGeometry(potRadius * 0.91, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xd49b38,
        roughness: 0.09,
        metalness: 0.05,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.42,
      })
    );
    this.oilMesh.rotation.x = -Math.PI * 0.5;
    this.oilMesh.position.y = 0.016;
    this.group.add(this.oilMesh);

    // 4. Backlit Evening Steam Particles (warm amber-gold rim glow from western sunlight!)
    this.steamParticles = [];
    const steamMatBase = new THREE.SpriteMaterial({
      map: steamTex,
      color: 0xffe4c4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 36; i++) {
      const sp = new THREE.Sprite(steamMatBase.clone());
      sp.visible = false;
      this.group.add(sp);
      this.steamParticles.push({
        sprite: sp,
        age: Math.random() * 2.5,
        life: 1.8 + Math.random() * 1.4,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 0.08 + Math.random() * 0.08,
        active: false,
      });
    }

    // 5. Stretchy Viscous Curry Drip Ribbon (world space, connects ladle bowl to rice/pot during pouring!)
    this.dripGroup = new THREE.Group();
    const dripMat = new THREE.MeshPhysicalMaterial({
      color: 0x522509,
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    this.dripMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.011, 1.0, 10, 6), dripMat);
    this.dripMesh.visible = false;
    this.dripGroup.add(this.dripMesh);

    // State values
    this.level = 0; // 0..1 liquid height in pot
    this.simmer = 0;
    this.viscosity = 0;
    this.rouxMelt = 0;
    this.stirSpeed = 0;
    this.swirlAngle = 0;
    this.steamIntensity = 0;
    this.steamOriginWorld = potCenter.clone();
  }

  getSurfaceWorldY() {
    return this.potCenter.y + 0.022 + this.level * 0.082;
  }

  triggerSplash(localX, localZ, strength = 1.0) {
    this.uniforms.uStirPos.value.set(localX, localZ);
    this.stirSpeed = Math.min(1.8, this.stirSpeed + strength);
    // Spawn 2-3 instant splash bubbles around impact
    for (let k = 0; k < 3; k++) {
      const slot = this.bubbles.find((b) => !b.active);
      if (slot) {
        const a = Math.random() * Math.PI * 2;
        const d = 0.01 + Math.random() * 0.03;
        slot.active = true;
        slot.age = 0;
        slot.life = 0.35 + Math.random() * 0.25;
        slot.maxR = 0.008 + Math.random() * 0.009;
        slot.x = localX + Math.cos(a) * d;
        slot.z = localZ + Math.sin(a) * d;
        slot.mesh.visible = true;
      }
    }
  }

  // Show stretchy glossy viscous curry stream from startWorld to endWorld
  setDripRibbon(visible, startWorld, endWorld, thickness = 1.0) {
    this.dripMesh.visible = visible;
    if (!visible) return;
    const mid = startWorld.clone().add(endWorld).multiplyScalar(0.5);
    const len = Math.max(0.01, startWorld.distanceTo(endWorld));
    this.dripMesh.position.copy(mid);
    this.dripMesh.scale.set(thickness, len, thickness);
    const dir = endWorld.clone().sub(startWorld).normalize();
    this.dripMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }

  update(dt, { level = 0, simmer = 0, viscosity = 0, rouxMelt = 0, stirInput = 0, stirLocal = null, steam = 0 } = {}) {
    this.uniforms.uTime.value += dt;
    this.level += (level - this.level) * Math.min(1, dt * 6);
    this.simmer += (simmer - this.simmer) * Math.min(1, dt * 4);
    this.viscosity += (viscosity - this.viscosity) * Math.min(1, dt * 3);
    this.rouxMelt += (rouxMelt - this.rouxMelt) * Math.min(1, dt * 3.5);
    this.steamIntensity += (steam - this.steamIntensity) * Math.min(1, dt * 4);

    if (stirLocal) {
      this.uniforms.uStirPos.value.lerp(stirLocal, Math.min(1, dt * 14));
    }
    this.stirSpeed = Math.max(stirInput, this.stirSpeed * Math.exp(-dt * 3.5));
    // Swirl rotates fluid slowly from convection + rapidly when stirring!
    this.swirlAngle += dt * (0.14 * this.simmer + this.stirSpeed * (2.6 - this.viscosity * 0.9));

    this.uniforms.uSimmer.value = this.simmer;
    this.uniforms.uViscosity.value = this.viscosity;
    this.uniforms.uRouxMelt.value = this.rouxMelt;
    this.uniforms.uStirSpeed.value = this.stirSpeed;
    this.uniforms.uSwirlAngle.value = this.swirlAngle;

    const hasLiquid = this.level > 0.02;
    this.surfaceMesh.visible = hasLiquid;
    this.uniforms.uOpacity.value = Math.min(1, this.level * 5);
    const surfY = 0.022 + this.level * 0.082;
    this.surfaceMesh.position.y = surfY;
    this.oilMesh.visible = !hasLiquid;

    // Update 3D glossy bubble color & opacity to match liquid state (translucent amber -> thick glossy curry!)
    const colBroth = new THREE.Color(0xc98b3a);
    const colCurry = new THREE.Color(0x52250b);
    this.bubbleMat.color.copy(colBroth).lerp(colCurry, this.viscosity);
    this.bubbleMat.opacity = 0.58 + this.viscosity * 0.39;

    // Spawn & animate 3D rising simmering domes (bigger, juicier, unmistakable kotokoto & viscous curry blisters!)
    if (hasLiquid && this.simmer > 0.12) {
      this.bubbleSpawnTimer -= dt;
      if (this.bubbleSpawnTimer <= 0) {
        const slot = this.bubbles.find((b) => !b.active);
        if (slot) {
          const r = Math.sqrt(Math.random()) * this.potRadius * 0.80;
          const a = Math.random() * Math.PI * 2;
          slot.active = true;
          slot.age = 0;
          slot.life = (0.55 + Math.random() * 0.55) * (1.0 + this.viscosity * 1.15);
          slot.maxR = (0.0085 + Math.random() * 0.0105) * (1.0 + this.viscosity * 0.55);
          slot.x = Math.cos(a) * r;
          slot.z = Math.sin(a) * r;
          slot.mesh.visible = true;
        }
        this.bubbleSpawnTimer = (0.045 + Math.random() * 0.09) * (1.0 + this.viscosity * 0.65) / Math.max(0.3, this.simmer);
      }
    }

    this.foamRingMat.opacity = 0.42 - this.viscosity * 0.18;
    for (const b of this.bubbles) {
      if (!b.active) continue;
      b.age += dt;
      const p = b.age / b.life;
      if (p >= 1 || !hasLiquid) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      const swell = p < 0.78 ? Math.sin((p / 0.78) * Math.PI * 0.5) : Math.max(0, 1 - (p - 0.78) / 0.22);
      const rad = b.maxR * Math.max(0.08, swell);
      b.mesh.position.set(b.x, surfY - rad * 0.16, b.z);
      b.mesh.scale.set(rad, rad * (0.78 + this.viscosity * 0.25), rad);
    }

    // Update backlit evening steam wisps
    for (const s of this.steamParticles) {
      if (!s.active && this.steamIntensity > 0.05 && Math.random() < dt * 8.5 * this.steamIntensity) {
        s.active = true;
        s.age = 0;
        s.life = 1.6 + Math.random() * 1.4;
        const r = Math.sqrt(Math.random()) * this.potRadius * 0.72;
        const a = Math.random() * Math.PI * 2;
        s.sprite.position.set(Math.cos(a) * r, surfY + 0.015, Math.sin(a) * r);
        s.vx = 0.025 + (Math.random() - 0.35) * 0.03; // Gentle kitchen breeze drifting rightward away from window
        s.vy = 0.12 + Math.random() * 0.08;
        s.vz = (Math.random() - 0.5) * 0.03;
        s.sprite.visible = true;
      }
      if (!s.active) continue;
      s.age += dt;
      const p = s.age / s.life;
      if (p >= 1) {
        s.active = false;
        s.sprite.visible = false;
        continue;
      }
      s.sprite.position.x += s.vx * dt + Math.sin(this.uniforms.uTime.value * 1.8 + s.baseScale * 40) * 0.012 * dt;
      s.sprite.position.y += s.vy * dt;
      s.sprite.position.z += s.vz * dt;
      const sc = s.baseScale * (0.75 + p * 2.1);
      s.sprite.scale.set(sc, sc * 1.18, 1);
      const fade = Math.sin(p * Math.PI);
      s.sprite.material.opacity = fade * 0.26 * Math.min(1.2, this.steamIntensity);
    }
  }
}
