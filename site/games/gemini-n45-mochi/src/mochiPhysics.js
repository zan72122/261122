import * as THREE from 'three';
import { BOARD_Y } from './environment.js';

export const MOUND_POS = new THREE.Vector3(-1.42, BOARD_Y, 0.56);
export const WORK_POS = new THREE.Vector3(0.68, BOARD_Y, 0.80);

const SUN_DIR = new THREE.Vector3(-0.56, 0.65, -0.51).normalize();

// Photorealistic freshly pounded mochi MeshPhysicalMaterial:
// Warm creamy ivory shading with sculpted 3D volume (never blown out flat white!),
// moist glutinous sheen, backlit subsurface glow (stronger on thin stretched mochi!),
// and smooth organic Kinako powder blend.
export function createMochiMaterial(mochiTex, kinakoTex) {
  const uniforms = {
    uKinako: { value: 0.0 },
    uStretchThin: { value: 0.0 },
    uKinakoMap: { value: kinakoTex.map },
    uSunDir: { value: SUN_DIR.clone() },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf4efe4),
    map: mochiTex.map,
    normalMap: mochiTex.normalMap,
    normalScale: new THREE.Vector2(0.50, 0.50),
    roughnessMap: mochiTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.26,
    sheen: 0.22,
    sheenRoughness: 0.60,
    sheenColor: new THREE.Color(0xfff1d6),
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uKinako = uniforms.uKinako;
    shader.uniforms.uStretchThin = uniforms.uStretchThin;
    shader.uniforms.uKinakoMap = uniforms.uKinakoMap;
    shader.uniforms.uSunDir = uniforms.uSunDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMochiWorldPos;
        varying vec3 vMochiWorldNormal;
        varying vec2 vMochiUv;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vMochiUv = uv;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 mWp = modelMatrix * vec4(transformed, 1.0);
        vMochiWorldPos = mWp.xyz;
        vMochiWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uKinako;
        uniform float uStretchThin;
        uniform sampler2D uKinakoMap;
        uniform vec3 uSunDir;
        varying vec3 vMochiWorldPos;
        varying vec3 vMochiWorldNormal;
        varying vec2 vMochiUv;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Subtle warm ambient occlusion near the base contact with the wooden board
        float baseAO = smoothstep(0.14, 0.42, vMochiWorldPos.y);
        diffuseColor.rgb *= mix(0.86, 1.0, baseAO);

        if (uKinako > 0.001) {
          vec4 kSample = texture2D(uKinakoMap, vMochiUv * 2.4);
          float noiseEdge = fract(sin(dot(floor(vMochiUv * 120.0), vec2(12.9898, 78.233))) * 43758.5453);
          float topBias = clamp(vMochiWorldNormal.y * 0.35 + 0.72, 0.25, 1.0);
          float kinMask = smoothstep(0.05, 0.95, uKinako * 1.32 * topBias + (noiseEdge - 0.5) * 0.24);
          diffuseColor.rgb = mix(diffuseColor.rgb, kSample.rgb * 1.02, kinMask * 0.95);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        if (uKinako > 0.001) {
          roughnessFactor = mix(roughnessFactor, 0.95, clamp(uKinako * 1.15, 0.0, 0.96));
        }`
      )
      .replace(
        '#include <clearcoat_roughness_fragment>',
        `#include <clearcoat_roughness_fragment>
        if (uKinako > 0.001) {
          clearcoatRoughnessFactor = mix(clearcoatRoughnessFactor, 1.0, clamp(uKinako * 1.2, 0.0, 1.0));
        }`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 viewDirW = normalize(cameraPosition - vMochiWorldPos);
        vec3 nW = normalize(vMochiWorldNormal);
        float backLight = pow(clamp(dot(viewDirW, -uSunDir + nW * 0.35), 0.0, 1.0), 2.8);
        float rim = pow(1.0 - max(0.0, dot(nW, viewDirW)), 2.5);
        float sssWeight = (1.0 - uKinako * 0.85) * (0.12 + uStretchThin * 0.45);
        vec3 sssTint = mix(vec3(1.0, 0.94, 0.80), vec3(1.0, 0.88, 0.68), uStretchThin);
        gl_FragColor.rgb += sssTint * (backLight * 0.28 + rim * 0.14) * sssWeight;
        #include <dithering_fragment>`
      );
  };

  mat.userData.mochiUniforms = uniforms;
  return mat;
}

// --- 1. Main Freshly Pounded Mochi Mound ---
export class MochiMound {
  constructor(scene, mochiTex, kinakoTex) {
    this.mochiTex = mochiTex;
    this.kinakoTex = kinakoTex;
    this.material = createMochiMaterial(mochiTex, kinakoTex);

    this.basePos = MOUND_POS.clone();
    this.mass = 1.0;
    this.targetMass = 1.0;

    this.wobble = new THREE.Vector3();
    this.wobbleVel = new THREE.Vector3();
    this.pullTarget = new THREE.Vector3();
    this.pullStrength = 0;

    const geo = new THREE.SphereGeometry(1.0, 38, 26);
    const pos = geo.attributes.position;
    this.baseVerts = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Organic soft freshly-pounded pillow with subtle handmade folds & flat contact base
      const flatBottom = y < 0 ? y * 0.22 : y * 0.72;
      const spread = 1.0 + Math.max(0, -y) * 0.18;
      const organic = 1.0 + Math.sin(x * 3.1 + z * 2.4) * 0.045 + Math.cos(z * 4.2 - x * 2.1) * 0.03;
      const softDimple = y > 0.25 ? Math.sin(x * 6.5) * Math.cos(z * 5.8) * 0.018 : 0;
      x = x * 1.14 * spread * organic;
      z = z * 1.05 * spread * organic;
      y = (flatBottom + 0.22) * 0.86 + softDimple;

      this.baseVerts[i * 3] = x;
      this.baseVerts[i * 3 + 1] = Math.max(0.0, y);
      this.baseVerts[i * 3 + 2] = z;
      pos.setXYZ(i, x, Math.max(0.0, y), z);
    }
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.copy(this.basePos);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  poke(dx, dy, dz) {
    this.wobbleVel.x += dx;
    this.wobbleVel.y += dy;
    this.wobbleVel.z += dz;
  }

  consumePiece() {
    this.targetMass = Math.max(0.58, this.targetMass - 0.08);
  }

  replenish() {
    this.targetMass = 1.04;
    this.poke(0, -2.4, 0);
  }

  setPull(worldPoint, strength) {
    if (worldPoint && strength > 0.001) {
      this.pullTarget.copy(worldPoint).sub(this.basePos);
      this.pullStrength = strength;
    } else {
      this.pullStrength = 0;
    }
  }

  update(dt, time) {
    this.mass += (this.targetMass - this.mass) * Math.min(1, dt * 4.5);

    const k = 42.0;
    const damp = 5.4;
    this.wobbleVel.x += (-k * this.wobble.x - damp * this.wobbleVel.x) * dt;
    this.wobbleVel.y += (-k * this.wobble.y - damp * this.wobbleVel.y) * dt;
    this.wobbleVel.z += (-k * this.wobble.z - damp * this.wobbleVel.z) * dt;
    this.wobble.addScaledVector(this.wobbleVel, dt);

    const pos = this.mesh.geometry.attributes.position;
    const base = this.baseVerts;
    const s = Math.pow(this.mass, 0.36);

    const breathe = Math.sin(time * 2.1) * 0.012;
    const px = this.pullTarget.x;
    const py = this.pullTarget.y;
    const pz = this.pullTarget.z;
    const pLen = Math.hypot(px, py, pz) || 1;
    const pDirX = px / pLen;
    const pDirY = py / pLen;
    const pDirZ = pz / pLen;
    const pStr = this.pullStrength;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3] * s;
      const by = base[i * 3 + 1] * s;
      const bz = base[i * 3 + 2] * s;

      const hFactor = Math.min(1.0, by / (0.65 * s));
      const squashY = 1.0 + this.wobble.y * 0.32 + breathe;
      const squashXZ = 1.0 / Math.sqrt(Math.max(0.65, squashY));

      let x = bx * squashXZ + this.wobble.x * 0.32 * hFactor;
      let y = by * squashY;
      let z = bz * squashXZ + this.wobble.z * 0.32 * hFactor;

      if (pStr > 0.005) {
        const vLen = Math.hypot(bx, by - 0.35 * s, bz) || 1;
        const align = Math.max(0, (bx * pDirX + (by - 0.35 * s) * pDirY + bz * pDirZ) / vLen);
        // Smooth clamp prevents polar seam creasing on top of the mound!
        const cone = Math.pow(align, 1.8) * Math.min(0.85, pStr) * hFactor * Math.min(1.0, Math.hypot(bx, bz) * 1.4);
        x += px * cone * 0.22;
        y += Math.max(0, py - 0.22) * cone * 0.20;
        z += pz * cone * 0.22;
      }

      pos.setXYZ(i, x, Math.max(0.0, y), z);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

// --- 2. Viscoelastic Stretch Bridge (びよーんと伸びる粘弾性の橋) ---
export class ViscoelasticBridge {
  constructor(scene, mochiTex, kinakoTex) {
    this.rings = 38;
    this.segs = 22;
    this.material = createMochiMaterial(mochiTex, kinakoTex);

    const vertCount = (this.rings + 1) * (this.segs + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    for (let r = 0; r <= this.rings; r++) {
      const v = r / this.rings;
      for (let s = 0; s <= this.segs; s++) {
        const u = s / this.segs;
        const idx = r * (this.segs + 1) + s;
        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;
      }
    }
    for (let r = 0; r < this.rings; r++) {
      for (let s = 0; s < this.segs; s++) {
        const a = r * (this.segs + 1) + s;
        const b = a + 1;
        const c = (r + 1) * (this.segs + 1) + s;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._side = new THREE.Vector3();
    this._binorm = new THREE.Vector3();
    this._center = new THREE.Vector3();
  }

  hide() {
    this.mesh.visible = false;
  }

  updateStretch(pointA, pointB, radiusA, radiusB, stretchRatio, time, kinako = 0) {
    const dist = pointA.distanceTo(pointB);
    if (dist < 0.08) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const u = this.material.userData.mochiUniforms;
    u.uStretchThin.value = Math.min(1.0, stretchRatio * 1.25);
    u.uKinako.value = kinako;

    this._dir.subVectors(pointB, pointA).normalize();
    if (Math.abs(this._dir.y) > 0.96) {
      this._up.set(1, 0, 0);
    } else {
      this._up.set(0, 1, 0);
    }
    this._side.crossVectors(this._dir, this._up).normalize();
    this._binorm.crossVectors(this._side, this._dir).normalize();

    const pos = this.mesh.geometry.attributes.position;

    // Luscious, chewy, unmistakably thick viscoelastic mochi ribbon with realistic gravity drape!
    // Vertical radius is flattened (0.64) so t=0 stays smoothly embedded inside the mound with ZERO protruding cap!
    const sagAmount = Math.min(0.36, dist * 0.13 * (0.35 + stretchRatio * 0.78));
    const neckFactor = 1.0 / (1.0 + Math.pow(stretchRatio * 1.48, 1.85) * 1.45);
    const quiver = stretchRatio > 0.76
      ? (stretchRatio - 0.76) * 0.032 * Math.sin(time * 52.0)
      : 0;

    for (let r = 0; r <= this.rings; r++) {
      const t = r / this.rings;
      const sag = Math.sin(t * Math.PI) * sagAmount;
      this._center.lerpVectors(pointA, pointB, t);
      this._center.y = Math.max(BOARD_Y + 0.06, this._center.y - sag);

      const endR = radiusA * (1 - t) + radiusB * t;
      const distFromMid = Math.abs(t - 0.5) * 2.0;
      const bell = Math.pow(distFromMid, 2.05);
      const baseR = endR * (neckFactor + (1 - neckFactor) * bell);

      const pinchBias = Math.exp(-Math.pow((t - 0.55) * 3.8, 2)) * stretchRatio * 0.12;
      const ringR = Math.max(0.085, baseR * (1 - pinchBias) + quiver * Math.sin(t * Math.PI));

      for (let s = 0; s <= this.segs; s++) {
        const theta = (s / this.segs) * Math.PI * 2;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);

        // Glutinous longitudinal pull ridges along stretched mochi
        const striation = 1.0 + Math.sin(theta * 7.0 + t * 2.4) * 0.04 * stretchRatio * (1 - bell);
        // Slightly wide ribbon cross-section (1.12 horizontal, 0.68 vertical) like real hand-pulled mochi!
        const rx = ringR * striation * 1.12;
        const ry = ringR * striation * 0.68;

        const vx = this._center.x + this._side.x * (ct * rx) + this._binorm.x * (st * ry);
        const vy = this._center.y + this._side.y * (ct * rx) + this._binorm.y * (st * ry);
        const vz = this._center.z + this._side.z * (ct * rx) + this._binorm.z * (st * ry);

        const idx = r * (this.segs + 1) + s;
        pos.setXYZ(idx, vx, Math.max(BOARD_Y + 0.01, vy), vz);
      }
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

// --- 3. Individual Mochi Piece (Torn -> Rolled Round -> Decorated -> Served!) ---
export class MochiPiece {
  constructor(scene, mochiTex, kinakoTex, toppingMats, sizeScale = 1.0) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.sizeScale = sizeScale;
    this.baseRadius = 0.44 * sizeScale;

    this.material = createMochiMaterial(mochiTex, kinakoTex);
    this.roundness = 0.0;
    this.flatten = 0.0;
    this.kinakoAmount = 0.0;
    this.ankoAmount = 0.0;
    this.noriAmount = 0.0;
    this.hasMikan = false;

    this.squash = new THREE.Vector3();
    this.squashVel = new THREE.Vector3();
    this.shearX = 0;
    this.shearZ = 0;

    const geo = new THREE.SphereGeometry(this.baseRadius, 28, 20);
    const pos = geo.attributes.position;
    this.roundVerts = new Float32Array(pos.count * 3);
    this.tornVerts = new Float32Array(pos.count * 3);
    const seed = Math.random() * 100;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = this.baseRadius;
      const nx = x / r;
      const ny = y / r;
      const nz = z / r;

      const ry = ny < 0 ? y * 0.44 : y * 0.68;
      const rx = x * 1.12;
      const rz = z * 1.10;
      this.roundVerts[i * 3] = rx;
      this.roundVerts[i * 3 + 1] = ry + r * 0.44;
      this.roundVerts[i * 3 + 2] = rz;

      const lobe1 = Math.sin(nx * 3.4 + seed) * Math.cos(nz * 2.9 - seed * 0.5) * 0.22;
      const lobe2 = Math.sin((nx + ny) * 5.2 + seed) * 0.10;
      const tail = nx < -0.25 ? Math.pow(-nx - 0.25, 1.5) * 0.42 : 0;
      const disp = 1.0 + lobe1 + lobe2 + tail;
      this.tornVerts[i * 3] = rx * disp * (1.06 - ny * 0.10);
      this.tornVerts[i * 3 + 1] = Math.max(0.0, (ry + r * 0.44) * (0.94 + lobe2 * 0.6));
      this.tornVerts[i * 3 + 2] = rz * disp * 0.94;
    }

    this.bodyMesh = new THREE.Mesh(geo, this.material);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // --- Layer A: Thick Glossy Tsubu-an Anko Dollop (sits proudly on top with ZERO white clipping!) ---
    const ankoGeo = new THREE.SphereGeometry(this.baseRadius * 0.84, 24, 16);
    const aPos = ankoGeo.attributes.position;
    for (let i = 0; i < aPos.count; i++) {
      const ax = aPos.getX(i);
      const ay = aPos.getY(i);
      const az = aPos.getZ(i);
      const bumps = 1.0 + Math.sin(ax * 22 + seed) * Math.cos(az * 20) * 0.08 + Math.sin((ax - az) * 30) * 0.045;
      // Drape gently over the rounded crown of the mochi
      const r2 = (ax * ax + az * az) / (this.baseRadius * this.baseRadius);
      const drape = -r2 * 0.08;
      const yFlat = ay < 0 ? ay * 0.30 : ay * 0.68;
      aPos.setXYZ(i, ax * 1.12 * bumps, yFlat * bumps + drape, az * 1.08 * bumps);
    }
    ankoGeo.computeVertexNormals();
    this.ankoMesh = new THREE.Mesh(ankoGeo, toppingMats.ankoMat);
    this.ankoMesh.position.y = this.baseRadius * 0.96;
    this.ankoMesh.scale.setScalar(0.001);
    this.ankoMesh.visible = false;
    this.ankoMesh.castShadow = true;
    this.ankoMesh.receiveShadow = true;
    this.group.add(this.ankoMesh);

    // --- Layer B: Crisp Curved Roasted Nori Wrap (磯辺焼き海苔) ---
    const noriGeo = new THREE.PlaneGeometry(this.baseRadius * 1.40, this.baseRadius * 3.15, 10, 24);
    const nPos = noriGeo.attributes.position;
    const rx = this.baseRadius * 1.18;
    const ry = this.baseRadius * 0.64;
    for (let i = 0; i < nPos.count; i++) {
      const u = nPos.getX(i);
      const v = nPos.getY(i) / (this.baseRadius * 3.15);
      const ang = v * Math.PI * 1.52;
      const crinkle = Math.sin(u * 16 + v * 20) * 0.012;
      const wx = u;
      const wy = Math.cos(ang) * (ry + 0.028) + this.baseRadius * 0.56 + crinkle;
      const wz = Math.sin(ang) * (rx + 0.028) + crinkle;
      nPos.setXYZ(i, wx, Math.max(0.02, wy), wz);
    }
    noriGeo.computeVertexNormals();
    this.noriMesh = new THREE.Mesh(noriGeo, toppingMats.noriMat);
    this.noriMesh.scale.setScalar(0.001);
    this.noriMesh.visible = false;
    this.noriMesh.castShadow = true;
    this.noriMesh.receiveShadow = true;
    this.group.add(this.noriMesh);

    // --- Bonus Layer C: Tiny Orange Mikan (ミニ鏡餅 surprise) ---
    this.mikanGroup = new THREE.Group();
    const mikanFruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xd9600e, roughness: 0.36, clearcoat: 0.38 })
    );
    mikanFruit.scale.set(1.08, 0.86, 1.08);
    mikanFruit.castShadow = true;
    const mikanLeaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x265222, roughness: 0.65 })
    );
    mikanLeaf.scale.set(1.3, 0.16, 0.6);
    mikanLeaf.position.set(0.08, 0.12, 0);
    mikanLeaf.rotation.z = 0.25;
    this.mikanGroup.add(mikanFruit, mikanLeaf);
    this.mikanGroup.position.y = this.baseRadius * 1.16;
    this.mikanGroup.scale.setScalar(0.001);
    this.mikanGroup.visible = false;
    this.group.add(this.mikanGroup);

    this.scene.add(this.group);
    this._rebuildShape();
  }

  impulse(sx, sy, sz) {
    this.squashVel.x += sx;
    this.squashVel.y += sy;
    this.squashVel.z += sz;
  }

  addRollingProgress(amount, velX, velZ) {
    this.roundness = Math.min(1.0, this.roundness + amount);
    this.shearX = THREE.MathUtils.clamp(velX * 0.08, -0.22, 0.22);
    this.shearZ = THREE.MathUtils.clamp(velZ * 0.08, -0.22, 0.22);
    this.impulse(0, -1.6 * Math.min(1, amount * 12), 0);
  }

  addKinako(amount = 0.68) {
    this.kinakoAmount = Math.min(1.0, this.kinakoAmount + amount);
    this.material.userData.mochiUniforms.uKinako.value = this.kinakoAmount;
    this.impulse(0, -2.2, 0);
  }

  addAnko() {
    this.ankoAmount = Math.min(1.0, this.ankoAmount + 0.85);
    this.ankoMesh.visible = true;
    this.impulse(0, -2.5, 0);
  }

  addNori() {
    this.noriAmount = 1.0;
    this.noriMesh.visible = true;
    this.impulse(0, -1.8, 0);
  }

  addBonusMikan() {
    this.hasMikan = true;
    this.mikanGroup.visible = true;
  }

  _rebuildShape() {
    const pos = this.bodyMesh.geometry.attributes.position;
    const t = this.roundness * this.roundness * (3 - 2 * this.roundness);
    const squashY = 1.0 + this.squash.y * 0.30 - this.flatten * 0.20;
    const squashXZ = 1.0 / Math.sqrt(Math.max(0.62, squashY));

    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      const bx = this.tornVerts[i3] * (1 - t) + this.roundVerts[i3] * t;
      const by = this.tornVerts[i3 + 1] * (1 - t) + this.roundVerts[i3 + 1] * t;
      const bz = this.tornVerts[i3 + 2] * (1 - t) + this.roundVerts[i3 + 2] * t;

      const hNorm = Math.min(1.0, by / (this.baseRadius * 1.1));
      const x = bx * squashXZ + (this.squash.x * 0.18 + this.shearX) * hNorm;
      const y = by * squashY;
      const z = bz * squashXZ + (this.squash.z * 0.18 + this.shearZ) * hNorm;

      pos.setXYZ(i, x, Math.max(0.0, y), z);
    }
    pos.needsUpdate = true;
    this.bodyMesh.geometry.computeVertexNormals();
  }

  update(dt) {
    const k = 58.0;
    const damp = 7.2;
    this.squashVel.x += (-k * this.squash.x - damp * this.squashVel.x) * dt;
    this.squashVel.y += (-k * this.squash.y - damp * this.squashVel.y) * dt;
    this.squashVel.z += (-k * this.squash.z - damp * this.squashVel.z) * dt;
    this.squash.addScaledVector(this.squashVel, dt);
    this.shearX *= Math.exp(-9.0 * dt);
    this.shearZ *= Math.exp(-9.0 * dt);

    const activeDeform =
      this.squash.lengthSq() > 0.00008 ||
      this.squashVel.lengthSq() > 0.0008 ||
      Math.abs(this.shearX) > 0.002 ||
      Math.abs(this.shearZ) > 0.002;
    if (activeDeform || this._lastRound !== this.roundness) {
      this._lastRound = this.roundness;
      this._rebuildShape();
    }

    if (this.ankoMesh.visible) {
      const targetS = 0.72 + this.ankoAmount * 0.30;
      const cur = this.ankoMesh.scale.x;
      this.ankoMesh.scale.setScalar(cur + (targetS - cur) * Math.min(1, dt * 11));
    }
    if (this.noriMesh.visible) {
      const cur = this.noriMesh.scale.x;
      this.noriMesh.scale.setScalar(cur + (1.0 - cur) * Math.min(1, dt * 12));
    }
    if (this.mikanGroup.visible) {
      const cur = this.mikanGroup.scale.x;
      this.mikanGroup.scale.setScalar(cur + (1.0 - cur) * Math.min(1, dt * 9));
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.bodyMesh.geometry.dispose();
    this.ankoMesh.geometry.dispose();
    this.noriMesh.geometry.dispose();
    this.material.dispose();
  }
}
