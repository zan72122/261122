import * as THREE from '../vendor/three.module.js';

/**
 * High-performance single-draw-call billowing steam wisps,
 * glossy ballistic water-splash droplets (for 湯切り!), boiling bubbles,
 * and wet counter splash marks.
 */
export class KitchenParticles {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;

    this._initSteam();
    this._initWaterDroplets();
    this._initBoilingBubbles();
    this._initWetMarks();
  }

  _initSteam() {
    const MAX = 160;
    this.steamMax = MAX;
    this.steamData = [];
    for (let i = 0; i < MAX; i++) {
      this.steamData.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        age: 0, life: 1,
        startScale: 0.4, endScale: 1.6,
        rot: 0, vrot: 0,
        maxOpacity: 0.35,
      });
    }
    this.steamCursor = 0;

    const baseGeo = new THREE.PlaneGeometry(1, 1);
    baseGeo.rotateX(-Math.PI / 2); // Horizontal plane facing directly toward overhead camera

    const geo = new THREE.InstancedBufferGeometry();
    geo.index = baseGeo.index;
    geo.attributes.position = baseGeo.attributes.position;
    geo.attributes.uv = baseGeo.attributes.uv;

    this.steamPos = new Float32Array(MAX * 3);
    this.steamScaleRotAlpha = new Float32Array(MAX * 4); // scale, rot, alpha, warmth

    this.steamPosAttr = new THREE.InstancedBufferAttribute(this.steamPos, 3);
    this.steamMetaAttr = new THREE.InstancedBufferAttribute(this.steamScaleRotAlpha, 4);
    this.steamPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.steamMetaAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('aOffset', this.steamPosAttr);
    geo.setAttribute('aMeta', this.steamMetaAttr);
    geo.instanceCount = MAX;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.textures.steam },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aOffset;
        attribute vec4 aMeta; // x=scale, y=rot, z=alpha, w=warmth
        varying vec2 vUv;
        varying float vAlpha;
        varying float vWarmth;
        void main() {
          vUv = uv;
          vAlpha = aMeta.z;
          vWarmth = aMeta.w;
          float s = aMeta.x;
          float c = cos(aMeta.y);
          float sn = sin(aMeta.y);
          vec3 p = position * s;
          vec3 rotated = vec3(p.x * c - p.z * sn, p.y, p.x * sn + p.z * c);
          vec4 mvPosition = modelViewMatrix * vec4(rotated + aOffset, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vWarmth;
        void main() {
          if (vAlpha <= 0.004) discard;
          vec4 tex = texture2D(uMap, vUv);
          float a = tex.a * vAlpha;
          if (a <= 0.004) discard;
          // Warm backlit tungsten steam near bare bulb, slightly cooler misty edge high up
          vec3 warmCol = vec3(1.0, 0.90, 0.74);
          vec3 coolCol = vec3(0.76, 0.80, 0.85);
          vec3 col = mix(coolCol, warmCol, vWarmth);
          gl_FragColor = vec4(col, a);
        }
      `,
    });

    this.steamMesh = new THREE.Mesh(geo, mat);
    this.steamMesh.frustumCulled = false;
    this.steamMesh.renderOrder = 20;
    this.scene.add(this.steamMesh);
  }

  spawnSteam(x, y, z, {
    spread = 0.4,
    vy = 0.85,
    startScale = 0.45,
    endScale = 2.0,
    life = 2.1,
    opacity = 0.36,
    driftX = 0.06,
    driftZ = -0.05,
  } = {}) {
    const p = this.steamData[this.steamCursor];
    this.steamCursor = (this.steamCursor + 1) % this.steamMax;

    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    p.active = true;
    p.x = x + Math.cos(ang) * r;
    p.y = y + Math.random() * 0.12;
    p.z = z + Math.sin(ang) * r;
    p.vx = driftX + (Math.random() - 0.5) * 0.22;
    p.vy = vy * (0.8 + Math.random() * 0.42);
    p.vz = driftZ + (Math.random() - 0.5) * 0.22;
    p.age = 0;
    p.life = life * (0.8 + Math.random() * 0.4);
    p.startScale = startScale * (0.85 + Math.random() * 0.3);
    p.endScale = endScale * (0.85 + Math.random() * 0.35);
    p.rot = Math.random() * Math.PI * 2;
    p.vrot = (Math.random() - 0.5) * 0.55;
    p.maxOpacity = opacity;
  }

  _initWaterDroplets() {
    const MAX = 220;
    this.dropMax = MAX;
    this.drops = [];
    for (let i = 0; i < MAX; i++) {
      this.drops.push({
        active: false,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        size: 0.04,
        age: 0, life: 1,
        amber: false,
      });
    }
    this.dropCursor = 0;

    const geo = new THREE.SphereGeometry(1, 10, 8);
    // Custom Fresnel glistening translucent water droplet shader (fixes opaque transmission bug on InstancedMesh!)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vColor;
        void main() {
          #ifdef USE_INSTANCING_COLOR
            vColor = instanceColor;
          #else
            vColor = vec3(1.0, 0.96, 0.88);
          #endif
          vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec4 mvPos = viewMatrix * worldPos;
          vViewPos = -mvPos.xyz;
          vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vColor;
        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);
          vec3 L = normalize(vec3(-0.22, 0.92, -0.18));
          vec3 H = normalize(L + V);

          float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.2);
          float spec = pow(max(0.0, dot(N, H)), 42.0);
          float specSoft = pow(max(0.0, dot(N, H)), 9.0);

          // Crystal clear dark-refracted body, luminous warm tungsten specular rim & pinpoint glint
          vec3 bodyCol = vColor * (0.28 + specSoft * 0.45);
          vec3 rimCol = vColor * 1.15;
          vec3 glint = vec3(1.55, 1.32, 0.95) * spec * 1.6;
          vec3 col = mix(bodyCol, rimCol, fresnel * 0.78) + glint;
          float alpha = clamp(0.16 + fresnel * 0.58 + spec * 0.92, 0.0, 0.92);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.dropMesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dropMesh.frustumCulled = false;
    this.dropMesh.renderOrder = 16;

    const white = new THREE.Color(0xfff4e0);
    for (let i = 0; i < MAX; i++) this.dropMesh.setColorAt(i, white);
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;

    this.scene.add(this.dropMesh);
    this._dummy = new THREE.Object3D();
    this._up = new THREE.Vector3(0, 1, 0);
    this._velDir = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  }

  spawnSplashBurst(x, y, z, count = 34, {
    speed = 2.6,
    upBias = 1.8,
    spreadRadius = 0.38,
    size = 0.020,
    dirX = 0,
    dirZ = 0,
    amber = false,
  } = {}) {
    const col = amber ? new THREE.Color(0xd18a32) : new THREE.Color(0xfff4e2);
    for (let i = 0; i < count; i++) {
      const idx = this.dropCursor;
      this.dropCursor = (this.dropCursor + 1) % this.dropMax;
      const d = this.drops[idx];

      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRadius;
      const spd = speed * (0.42 + Math.random() * 0.98);
      d.active = true;
      d.x = x + Math.cos(ang) * r;
      d.y = y + (Math.random() - 0.3) * 0.14;
      d.z = z + Math.sin(ang) * r;
      d.vx = Math.cos(ang) * spd + dirX * (0.55 + Math.random() * 0.85);
      d.vy = upBias * (0.35 + Math.random() * 0.85);
      d.vz = Math.sin(ang) * spd + dirZ * (0.55 + Math.random() * 0.85);
      // Organic spray distribution: mostly fine sparkling droplets + a few medium beads
      const sizeMix = Math.random() < 0.72 ? (0.48 + Math.random() * 0.55) : (0.95 + Math.random() * 0.45);
      d.size = size * sizeMix;
      d.age = 0;
      d.life = 0.48 + Math.random() * 0.52;
      d.amber = amber;
      this.dropMesh.setColorAt(idx, col);
    }
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }

  _initBoilingBubbles() {
    const MAX = 64;
    this.bubbleMax = MAX;
    this.bubbles = [];
    for (let i = 0; i < MAX; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.98;
      this.bubbles.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        phase: Math.random(),
        speed: 0.9 + Math.random() * 1.6,
        maxR: 0.016 + Math.random() * 0.032,
        rimBias: Math.random() > 0.52,
      });
    }
    const geo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
    // Translucent thin-walled soap/boiling water bubble Fresnel shader!
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec4 mvPos = viewMatrix * worldPos;
          vViewPos = -mvPos.xyz;
          vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);
          vec3 L = normalize(vec3(0.32, 0.90, -0.25));
          vec3 H = normalize(L + V);
          float fres = pow(1.0 - max(0.0, dot(N, V)), 2.4);
          float spec = pow(max(0.0, dot(N, H)), 55.0);
          vec3 col = mix(vec3(0.45, 0.42, 0.38), vec3(0.98, 0.90, 0.76), fres) + vec3(1.5, 1.25, 0.9) * spec * 1.4;
          float alpha = clamp(0.05 + fres * 0.62 + spec * 0.9, 0.0, 0.85);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.bubbleMesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bubbleMesh.renderOrder = 10;
    this.scene.add(this.bubbleMesh);
  }

  _initWetMarks() {
    const MAX = 32;
    this.wetMax = MAX;
    this.wetMarks = [];
    for (let i = 0; i < MAX; i++) {
      this.wetMarks.push({ active: false, x: 0, z: 0, scale: 0.1, age: 0, life: 16 });
    }
    this.wetCursor = 0;

    const geo = new THREE.CircleGeometry(1, 14);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x261d14,
      roughness: 0.06,
      metalness: 0.08,
      transparent: true,
      opacity: 0.42,
      map: this.textures.softGlow,
      alphaMap: this.textures.softGlow,
      depthWrite: false,
      envMapIntensity: 1.8,
    });
    this.wetMesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.wetMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wetMesh.renderOrder = 2;
    this.scene.add(this.wetMesh);
  }

  spawnWetMark(x, z, scale = 0.09) {
    // Only land on counter area outside the pots
    const m = this.wetMarks[this.wetCursor];
    this.wetCursor = (this.wetCursor + 1) % this.wetMax;
    m.active = true;
    m.x = x;
    m.z = z;
    m.scale = scale * (0.7 + Math.random() * 0.7);
    m.age = 0;
    m.life = 14 + Math.random() * 10;
  }

  update(dt, potCenter, waterY, boilIntensity, boilOverAmount, time) {
    // 1. Update billowing steam
    for (let i = 0; i < this.steamMax; i++) {
      const p = this.steamData[i];
      if (!p.active) {
        this.steamScaleRotAlpha[i * 4 + 2] = 0;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this.steamScaleRotAlpha[i * 4 + 2] = 0;
        continue;
      }
      const t = p.age / p.life;
      // Gentle swirling winter indoor convection
      const curlX = Math.sin(time * 1.4 + i * 1.7 + p.y * 1.6) * 0.16;
      const curlZ = Math.cos(time * 1.1 + i * 2.1 + p.y * 1.4) * 0.16;
      p.x += (p.vx + curlX) * dt;
      p.y += p.vy * dt * (1.0 - t * 0.25);
      p.z += (p.vz + curlZ) * dt;
      p.rot += p.vrot * dt;

      const fadeIn = Math.min(1, t / 0.18);
      const fadeOut = Math.pow(Math.max(0, 1 - t), 1.35);
      const alpha = fadeIn * fadeOut * p.maxOpacity;
      const scale = p.startScale + (p.endScale - p.startScale) * Math.pow(t, 0.72);
      // Warmth highest near bare bulb center (-0.15, -0.25), cools as it rises & drifts
      const distBulb = Math.hypot(p.x + 0.15, p.z + 0.25);
      const warmth = Math.max(0.15, Math.min(1.0, 1.0 - distBulb * 0.22 - t * 0.35));

      this.steamPos[i * 3] = p.x;
      this.steamPos[i * 3 + 1] = p.y;
      this.steamPos[i * 3 + 2] = p.z;
      this.steamScaleRotAlpha[i * 4] = scale;
      this.steamScaleRotAlpha[i * 4 + 1] = p.rot;
      this.steamScaleRotAlpha[i * 4 + 2] = alpha;
      this.steamScaleRotAlpha[i * 4 + 3] = warmth;
    }
    this.steamPosAttr.needsUpdate = true;
    this.steamMetaAttr.needsUpdate = true;

    // 2. Update glossy water droplets with ballistic velocity stretching
    const gravity = 8.4;
    for (let i = 0; i < this.dropMax; i++) {
      const d = this.drops[i];
      if (!d.active) {
        this._dummy.position.set(0, -20, 0);
        this._dummy.scale.setScalar(0.0001);
        this._dummy.updateMatrix();
        this.dropMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      d.age += dt;
      d.vy -= gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      if (d.y <= 0.035 || d.age >= d.life) {
        if (d.y <= 0.045 && Math.random() < 0.35) {
          this.spawnWetMark(d.x, d.z, 0.055 + d.size * 1.4);
        }
        d.active = false;
        this._dummy.position.set(0, -20, 0);
        this._dummy.scale.setScalar(0.0001);
        this._dummy.updateMatrix();
        this.dropMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      const spd = Math.hypot(d.vx, d.vy, d.vz);
      const stretch = Math.min(3.4, 1.0 + spd * 0.38);
      this._velDir.set(d.vx, d.vy, d.vz).normalize();
      this._quat.setFromUnitVectors(this._up, this._velDir);

      this._dummy.position.set(d.x, d.y, d.z);
      this._dummy.quaternion.copy(this._quat);
      const fade = d.age > d.life * 0.75 ? (1 - (d.age - d.life * 0.75) / (d.life * 0.25)) : 1;
      this._dummy.scale.set(d.size * fade, d.size * stretch * fade, d.size * fade);
      this._dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;

    // 3. Update boiling bubbles on pot water surface
    for (let i = 0; i < this.bubbleMax; i++) {
      const b = this.bubbles[i];
      b.phase += dt * b.speed * (0.45 + boilIntensity * 1.65);
      if (b.phase >= 1) {
        b.phase -= 1;
        const ang = Math.random() * Math.PI * 2;
        const r = b.rimBias ? (0.72 + Math.random() * 0.32) : Math.sqrt(Math.random()) * 0.92;
        b.x = Math.cos(ang) * r;
        b.z = Math.sin(ang) * r;
      }
      const activeRatio = i / this.bubbleMax;
      if (activeRatio > 0.2 + boilIntensity * 0.85) {
        this._dummy.position.set(0, -10, 0);
        this._dummy.scale.setScalar(0.0001);
      } else {
        const pop = Math.sin(b.phase * Math.PI);
        const rad = b.maxR * (0.55 + boilIntensity * 0.75 + boilOverAmount * 0.6) * pop;
        const swirl = time * (0.5 + boilIntensity * 1.1);
        const cx = b.x * Math.cos(swirl * 0.15) - b.z * Math.sin(swirl * 0.15);
        const cz = b.x * Math.sin(swirl * 0.15) + b.z * Math.cos(swirl * 0.15);
        this._dummy.position.set(
          potCenter.x + cx,
          waterY + boilOverAmount * 0.11 + rad * 0.15,
          potCenter.z + cz
        );
        this._dummy.quaternion.identity();
        this._dummy.scale.set(rad, rad * 0.65, rad);
      }
      this._dummy.updateMatrix();
      this.bubbleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.bubbleMesh.instanceMatrix.needsUpdate = true;

    // 4. Update glossy damp splash marks on counter
    for (let i = 0; i < this.wetMax; i++) {
      const m = this.wetMarks[i];
      if (!m.active) {
        this._dummy.position.set(0, -10, 0);
        this._dummy.scale.setScalar(0.0001);
      } else {
        m.age += dt;
        if (m.age >= m.life) {
          m.active = false;
          this._dummy.scale.setScalar(0.0001);
        } else {
          const fade = Math.max(0, 1 - m.age / m.life);
          this._dummy.position.set(m.x, 0.028, m.z);
          this._dummy.quaternion.identity();
          this._dummy.scale.setScalar(m.scale * (0.65 + 0.35 * fade));
        }
      }
      this._dummy.updateMatrix();
      this.wetMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.wetMesh.instanceMatrix.needsUpdate = true;
  }
}
