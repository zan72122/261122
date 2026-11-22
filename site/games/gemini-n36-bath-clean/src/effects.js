import * as THREE from '../vendor/three.module.min.js';
import { TUB, tubInnerY, tubSuperellipseR } from './diorama.js';
import { createSparkleTexture, createSteamTexture } from './textures.js';

const DUMMY = new THREE.Object3D();
const TMP_COLOR = new THREE.Color();

/**
 * 3D Tactile Visual Effects Engine:
 * - Instanced 3D creamy soap foam puffs (pile up when scrubbing, slide & swirl into drain when rinsed!)
 * - Iridescent floating soap bubbles (pop with musical chimes when tapped!)
 * - Parabolic shower spray droplets + faucet pouring stream + overflow waterfall droplets
 * - Animated rippling translucent warm bathwater surface with caustics & bath-bomb tinting!
 * - Sparkle stars + warm rising steam wisps + floor overflow puddles
 */
export class BathEffects {
  constructor(scene) {
    this.scene = scene;

    this._initFoamPuffs();
    this._initFloatingBubbles();
    this._initWaterDrops();
    this._initWaterSurface();
    this._initFaucetStream();
    this._initSparklesAndSteam();
    this._initFloorPuddles();
  }

  _initFoamPuffs() {
    this.maxPuffs = 300;
    const geo = new THREE.IcosahedronGeometry(1, 1); // 80 tris per puff -> super lightweight!
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    this.puffMesh = new THREE.InstancedMesh(geo, mat, this.maxPuffs);
    this.puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffMesh.castShadow = false;
    this.puffMesh.receiveShadow = true;
    this.scene.add(this.puffMesh);

    this.puffs = [];
    for (let i = 0; i < this.maxPuffs; i++) {
      this.puffs.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        radius: 0.1,
        targetRadius: 0.1,
        swirling: false,
        floatingOnWater: false,
        color: new THREE.Color(0xffffff),
      });
      DUMMY.scale.set(0, 0, 0);
      DUMMY.updateMatrix();
      this.puffMesh.setMatrixAt(i, DUMMY.matrix);
      this.puffMesh.setColorAt(i, TMP_COLOR.set(0xffffff));
    }
    this.puffCursor = 0;
  }

  spawnFoamPuff(x, z, rainbowBoost = 0, floatingOnWater = false) {
    // Avoid overlapping too densely at the exact same spot
    for (let i = 0; i < this.maxPuffs; i++) {
      const p = this.puffs[i];
      if (!p.active || p.swirling) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < 0.022) {
        p.targetRadius = Math.min(0.23, p.targetRadius + 0.025);
        return;
      }
    }

    const idx = this.puffCursor;
    this.puffCursor = (this.puffCursor + 1) % this.maxPuffs;
    const p = this.puffs[idx];
    p.active = true;
    p.swirling = false;
    p.floatingOnWater = floatingOnWater;
    p.x = x + (Math.random() - 0.5) * 0.14;
    p.z = z + (Math.random() - 0.5) * 0.14;
    p.y = floatingOnWater ? this.waterLevelY + 0.02 : tubInnerY(p.x, p.z) + 0.05;
    p.vx = 0;
    p.vz = 0;
    p.radius = 0.02;
    p.targetRadius = 0.095 + Math.random() * 0.11 + rainbowBoost * 0.05;

    if (rainbowBoost > 0.1) {
      const pastelHues = [0xffeaf2, 0xebf6ff, 0xf4ecff, 0xfff6e5, 0xe8fff4];
      p.color.setHex(pastelHues[Math.floor(Math.random() * pastelHues.length)]);
    } else {
      p.color.setHex(Math.random() > 0.35 ? 0xffffff : 0xf2faff);
    }
    this.puffMesh.setColorAt(idx, p.color);
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;
  }

  /**
   * Rinse 3D foam puffs near (hitX, hitZ): push & swirl them down toward the brass drain!
   */
  rinseFoamNear(hitX, hitZ, radius = 0.72) {
    let hitCount = 0;
    const r2 = radius * radius;
    for (let i = 0; i < this.maxPuffs; i++) {
      const p = this.puffs[i];
      if (!p.active) continue;
      const dx = p.x - hitX;
      const dz = p.z - hitZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        p.swirling = true;
        p.targetRadius *= 0.86;
        hitCount++;
      }
    }
    return hitCount;
  }

  flushAllFoamToDrain() {
    for (let i = 0; i < this.maxPuffs; i++) {
      if (this.puffs[i].active && !this.puffs[i].floatingOnWater) {
        this.puffs[i].swirling = true;
      }
    }
  }

  clearAllFoam() {
    for (let i = 0; i < this.maxPuffs; i++) {
      this.puffs[i].active = false;
      this.puffs[i].radius = 0;
    }
  }

  _initFloatingBubbles() {
    this.maxBubbles = 55;
    const geo = new THREE.SphereGeometry(1, 14, 10);
    // Avoids extra full-scene transmission render pass for 2x mobile FPS while keeping iridescent studio gloss!
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xdff7ff,
      roughness: 0.04,
      metalness: 0.12,
      transparent: true,
      opacity: 0.48,
      iridescence: 1.0,
      iridescenceIOR: 1.38,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.8,
      depthWrite: false,
    });
    this.bubbleMesh = new THREE.InstancedMesh(geo, mat, this.maxBubbles);
    this.bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.bubbleMesh);

    this.bubbles = [];
    for (let i = 0; i < this.maxBubbles; i++) {
      this.bubbles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vy: 0.5,
        phase: Math.random() * 6.28,
        radius: 0.1,
        life: 0,
        maxLife: 4,
      });
      DUMMY.scale.set(0, 0, 0);
      DUMMY.updateMatrix();
      this.bubbleMesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.bubbleCursor = 0;
  }

  spawnFloatingBubble(x, y, z, big = false, tintHex = null) {
    const idx = this.bubbleCursor;
    this.bubbleCursor = (this.bubbleCursor + 1) % this.maxBubbles;
    const b = this.bubbles[idx];
    b.active = true;
    b.x = x + (Math.random() - 0.5) * 0.25;
    b.y = y;
    b.z = z + (Math.random() - 0.5) * 0.25;
    b.vy = (big ? 0.34 : 0.48) + Math.random() * 0.32;
    b.phase = Math.random() * Math.PI * 2;
    b.radius = (big ? 0.15 : 0.075) + Math.random() * (big ? 0.11 : 0.065);
    b.life = 0;
    b.maxLife = 3.2 + Math.random() * 2.4;

    if (tintHex) {
      this.bubbleMesh.setColorAt(idx, TMP_COLOR.setHex(tintHex));
    } else {
      const hues = [0xe8f9ff, 0xffeef8, 0xf2eeff, 0xe8fff5];
      this.bubbleMesh.setColorAt(idx, TMP_COLOR.setHex(hues[idx % hues.length]));
    }
    if (this.bubbleMesh.instanceColor) this.bubbleMesh.instanceColor.needsUpdate = true;
  }

  /**
   * Check if a world ray passes close to any floating soap bubble and pop it!
   */
  tryPopBubbleWithRay(ray) {
    let bestIdx = -1;
    let bestDist = 0.38;
    const pt = new THREE.Vector3();
    for (let i = 0; i < this.maxBubbles; i++) {
      const b = this.bubbles[i];
      if (!b.active) continue;
      pt.set(b.x, b.y, b.z);
      const d = ray.distanceToPoint(pt);
      if (d < b.radius + 0.18 && d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const b = this.bubbles[bestIdx];
      b.active = false;
      this.spawnSparkle(b.x, b.y, b.z, 0xffffff, 0.38);
      return { x: b.x, y: b.y, z: b.z };
    }
    return null;
  }

  _initWaterDrops() {
    this.maxDrops = 240;
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xc2f0ff,
      roughness: 0.05,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82,
      clearcoat: 1.0,
    });
    this.dropMesh = new THREE.InstancedMesh(geo, mat, this.maxDrops);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.dropMesh);

    this.drops = [];
    for (let i = 0; i < this.maxDrops; i++) {
      this.drops.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.04,
        stretch: 1.6,
        life: 0,
        maxLife: 0.7,
        isFizz: false,
      });
      DUMMY.scale.set(0, 0, 0);
      DUMMY.updateMatrix();
      this.dropMesh.setMatrixAt(i, DUMMY.matrix);
      this.dropMesh.setColorAt(i, TMP_COLOR.setHex(0xc2f0ff));
    }
    this.dropCursor = 0;
  }

  spawnWaterDrop(x, y, z, vx, vy, vz, size = 0.045, colorHex = 0xc5f2ff, stretch = 1.8, maxLife = 0.75) {
    const idx = this.dropCursor;
    this.dropCursor = (this.dropCursor + 1) % this.maxDrops;
    const d = this.drops[idx];
    d.active = true;
    d.x = x;
    d.y = y;
    d.z = z;
    d.vx = vx;
    d.vy = vy;
    d.vz = vz;
    d.size = size;
    d.stretch = stretch;
    d.life = 0;
    d.maxLife = maxLife;
    this.dropMesh.setColorAt(idx, TMP_COLOR.setHex(colorHex));
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }

  spawnSplashBurst(x, y, z, count = 18, power = 2.6, colorHex = 0xc5f2ff) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = (0.55 + Math.random() * 0.85) * power;
      this.spawnWaterDrop(
        x + Math.cos(a) * 0.12,
        y + 0.05,
        z + Math.sin(a) * 0.12,
        Math.cos(a) * spd * 0.65,
        spd * (0.85 + Math.random() * 0.55),
        Math.sin(a) * spd * 0.65,
        0.045 + Math.random() * 0.035,
        colorHex,
        1.4,
        0.65
      );
    }
  }

  _initWaterSurface() {
    // Parametric disk grid molded to the exact superellipse shape of the tub!
    const segs = 40;
    const rings = 14;
    const positions = [];
    const baseXZ = [];
    const indices = [];

    positions.push(0, 0, 0);
    baseXZ.push(0, 0);

    for (let ri = 1; ri <= rings; ri++) {
      const r = ri / rings;
      for (let si = 0; si <= segs; si++) {
        const theta = (si / segs) * Math.PI * 2;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const nx = Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.8) * r;
        const nz = Math.sign(s) * Math.pow(Math.abs(s), 2 / 2.4) * r;
        positions.push(nx, 0, nz);
        baseXZ.push(nx, nz);
      }
    }

    for (let si = 0; si < segs; si++) {
      indices.push(0, 1 + si + 1, 1 + si);
    }
    const stride = segs + 1;
    for (let ri = 1; ri < rings; ri++) {
      const rowA = 1 + (ri - 1) * stride;
      const rowB = 1 + ri * stride;
      for (let si = 0; si < segs; si++) {
        const a = rowA + si;
        const b = rowA + si + 1;
        const c = rowB + si;
        const d = rowB + si + 1;
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    this.waterGeo = new THREE.BufferGeometry();
    this.waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.waterGeo.setIndex(indices);
    this.waterGeo.computeVertexNormals();
    this.waterBaseXZ = baseXZ;

    this.waterColor = new THREE.Color(0x64d6f4);
    this.waterTargetColor = new THREE.Color(0x64d6f4);

    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: this.waterColor,
      roughness: 0.06,
      metalness: 0.08,
      transparent: true,
      opacity: 0.76,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.45,
      side: THREE.DoubleSide,
    });

    this.waterMesh = new THREE.Mesh(this.waterGeo, this.waterMat);
    this.waterMesh.position.set(TUB.centerX, TUB.floorY, TUB.centerZ);
    this.waterMesh.visible = false;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    this.waterFill = 0; // 0..1.08 (1.0+ overflows!)
    this.waterLevelY = TUB.floorY;
    this.ripples = []; // { x, z, t, amp }
    this.drainVortex = 0;
  }

  addWaterRipple(worldX, worldZ, amp = 0.065) {
    this.ripples.push({ x: worldX - TUB.centerX, z: worldZ - TUB.centerZ, t: 0, amp });
    if (this.ripples.length > 10) this.ripples.shift();
  }

  setWaterTargetColor(hex) {
    this.waterTargetColor.setHex(hex);
  }

  _initFaucetStream() {
    // Thick glossy curved tube representing pouring faucet water
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.52, 1.64, 0.25),
      new THREE.Vector3(1.36, 1.44, 0.25),
      new THREE.Vector3(1.24, 0.96, 0.25),
      new THREE.Vector3(1.18, 0.30, 0.25),
    ]);
    this.faucetStreamGeo = new THREE.TubeGeometry(curve, 18, 0.065, 12, false);
    this.faucetStreamMat = new THREE.MeshPhysicalMaterial({
      color: 0xbaf0ff,
      roughness: 0.05,
      metalness: 0.08,
      transparent: true,
      opacity: 0.78,
      clearcoat: 1.0,
      envMapIntensity: 1.5,
    });
    this.faucetStream = new THREE.Mesh(this.faucetStreamGeo, this.faucetStreamMat);
    this.faucetStream.visible = false;
    this.scene.add(this.faucetStream);
  }

  setFaucetStreamActive(active, spoutPos, waterY, time) {
    this.faucetStream.visible = active;
    if (!active) return;
    const hitY = Math.max(TUB.floorY + 0.02, waterY);
    const wobble = Math.sin(time * 26) * 0.015;
    const curve = new THREE.CatmullRomCurve3([
      spoutPos.clone(),
      new THREE.Vector3(spoutPos.x - 0.14, spoutPos.y - 0.22, spoutPos.z + wobble),
      new THREE.Vector3(spoutPos.x - 0.24, (spoutPos.y + hitY) * 0.48, spoutPos.z - wobble),
      new THREE.Vector3(spoutPos.x - 0.28, hitY, spoutPos.z),
    ]);
    const newGeo = new THREE.TubeGeometry(curve, 14, 0.068 + Math.sin(time * 32) * 0.008, 10, false);
    this.faucetStream.geometry.dispose();
    this.faucetStream.geometry = newGeo;
  }

  _initSparklesAndSteam() {
    this.sparkleTex = createSparkleTexture();
    this.steamTex = createSteamTexture();

    this.sparkles = [];
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.sparkleTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.scene.add(sp);
      this.sparkles.push({ sprite: sp, active: false, life: 0, maxLife: 0.7, baseScale: 0.35, vy: 0.3 });
    }
    this.sparkleCursor = 0;

    this.steamPuffs = [];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.steamTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.scene.add(sp);
      this.steamPuffs.push({
        sprite: sp,
        x: TUB.centerX + (Math.random() - 0.5) * 2.6,
        y: 1.1 + Math.random() * 0.8,
        z: TUB.centerZ + (Math.random() - 0.5) * 1.2,
        phase: Math.random() * 6.28,
        life: Math.random(),
      });
    }
  }

  spawnSparkle(x, y, z, colorHex = 0xfff8d6, scale = 0.36) {
    const s = this.sparkles[this.sparkleCursor];
    this.sparkleCursor = (this.sparkleCursor + 1) % this.sparkles.length;
    s.active = true;
    s.life = 0;
    s.maxLife = 0.55 + Math.random() * 0.35;
    s.baseScale = scale * (0.75 + Math.random() * 0.5);
    s.vy = 0.18 + Math.random() * 0.25;
    s.sprite.position.set(x, y, z);
    s.sprite.material.color.setHex(colorHex);
    s.sprite.visible = true;
  }

  _initFloorPuddles() {
    // Glossy translucent puddles on the floor tiles that grow when the tub overflows!
    this.puddleGroup = new THREE.Group();
    this.scene.add(this.puddleGroup);
    this.puddleScale = 0;

    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x8be2fa,
      roughness: 0.04,
      metalness: 0.05,
      transparent: true,
      opacity: 0.62,
      clearcoat: 1.0,
    });

    const specs = [
      [1.35, 1.56, 0.52, 0.36],
      [-1.18, 1.58, 0.44, 0.30],
      [2.15, 0.88, 0.42, 0.48],
      [-0.35, 1.48, 0.38, 0.24],
    ];
    this.puddles = specs.map(([x, z, sx, sz]) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 22), puddleMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.036, z);
      m.scale.set(0.001, 0.001, 1);
      m.visible = false;
      this.puddleGroup.add(m);
      return { mesh: m, sx, sz };
    });
  }

  growOverflowPuddles(amount = 0.04) {
    this.puddleScale = Math.min(1.25, this.puddleScale + amount);
  }

  resetPuddles() {
    this.puddleScale = 0;
    for (const p of this.puddles) {
      p.mesh.visible = false;
    }
  }

  /**
   * Update all particle & water animations each frame
   */
  update(dt, time, { waterFill = 0, draining = false, duckPositions = [] } = {}) {
    this.waterFill = waterFill;
    this.waterLevelY = TUB.floorY + 0.02 + Math.min(1.03, waterFill) * (TUB.rimY - TUB.floorY - 0.05);

    // 1. Update 3D Foam Puffs
    for (let i = 0; i < this.maxPuffs; i++) {
      const p = this.puffs[i];
      if (!p.active) {
        DUMMY.scale.set(0, 0, 0);
        DUMMY.updateMatrix();
        this.puffMesh.setMatrixAt(i, DUMMY.matrix);
        continue;
      }

      if (p.swirling) {
        // Swirl toward the brass drain in a fun visible spiral!
        const dx = TUB.drainX - p.x;
        const dz = TUB.drainZ - p.z;
        const dist = Math.hypot(dx, dz) + 0.001;
        const pull = 2.4;
        const tangent = 1.65;
        p.x += ((dx / dist) * pull - (dz / dist) * tangent) * dt;
        p.z += ((dz / dist) * pull + (dx / dist) * tangent) * dt;
        p.y = tubInnerY(p.x, p.z) + 0.035;
        p.radius = Math.max(0, p.radius - dt * 0.24);
        if (dist < 0.16 || p.radius <= 0.01) {
          p.active = false;
        }
      } else {
        p.radius += (p.targetRadius - p.radius) * Math.min(1, dt * 10);
        if (p.floatingOnWater && waterFill > 0.05) {
          // Gently pushed aside by swimming rubber ducks!
          for (const dp of duckPositions) {
            const dx = p.x - dp.x;
            const dz = p.z - dp.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.55 && d > 0.01) {
              p.vx += (dx / d) * dt * 2.2;
              p.vz += (dz / d) * dt * 2.2;
            }
          }
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.vx *= 0.92;
          p.vz *= 0.92;
          if (tubSuperellipseR(p.x, p.z) > 0.85) {
            p.x *= 0.96;
            p.z = TUB.centerZ + (p.z - TUB.centerZ) * 0.96;
          }
          p.y = this.waterLevelY + 0.02 + Math.sin(time * 2.6 + i) * 0.012;
        } else {
          p.y = tubInnerY(p.x, p.z) + p.radius * 0.55;
        }
      }

      const breathe = 1 + Math.sin(time * 2.4 + i * 0.7) * 0.04;
      DUMMY.position.set(p.x, p.y, p.z);
      DUMMY.rotation.set(i * 0.5, i * 0.8, 0);
      DUMMY.scale.set(p.radius * breathe * 1.15, p.radius * breathe * 0.82, p.radius * breathe * 1.15);
      DUMMY.updateMatrix();
      this.puffMesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.puffMesh.instanceMatrix.needsUpdate = true;

    // 2. Update Floating Iridescent Bubbles
    for (let i = 0; i < this.maxBubbles; i++) {
      const b = this.bubbles[i];
      if (!b.active) {
        DUMMY.scale.set(0, 0, 0);
        DUMMY.updateMatrix();
        this.bubbleMesh.setMatrixAt(i, DUMMY.matrix);
        continue;
      }
      b.life += dt;
      if (b.life >= b.maxLife) {
        b.active = false;
        DUMMY.scale.set(0, 0, 0);
        DUMMY.updateMatrix();
        this.bubbleMesh.setMatrixAt(i, DUMMY.matrix);
        continue;
      }
      b.y += b.vy * dt;
      b.x += Math.sin(time * 2.2 + b.phase) * 0.16 * dt;
      b.z += Math.cos(time * 1.8 + b.phase) * 0.12 * dt;

      const fade = b.life < 0.2 ? b.life / 0.2 : b.life > b.maxLife - 0.25 ? (b.maxLife - b.life) / 0.25 : 1;
      const wob = 1 + Math.sin(time * 6 + b.phase) * 0.08;
      DUMMY.position.set(b.x, b.y, b.z);
      DUMMY.rotation.set(0, 0, 0);
      DUMMY.scale.set(b.radius * fade * wob, b.radius * fade / wob, b.radius * fade * wob);
      DUMMY.updateMatrix();
      this.bubbleMesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.bubbleMesh.instanceMatrix.needsUpdate = true;

    // 3. Update Water Spray / Splash / Overflow Drops
    for (let i = 0; i < this.maxDrops; i++) {
      const d = this.drops[i];
      if (!d.active) {
        DUMMY.scale.set(0, 0, 0);
        DUMMY.updateMatrix();
        this.dropMesh.setMatrixAt(i, DUMMY.matrix);
        continue;
      }
      d.life += dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      const floorLimit = tubSuperellipseR(d.x, d.z) < 0.96 ? Math.max(tubInnerY(d.x, d.z), this.waterLevelY) : 0.03;
      if (d.life >= d.maxLife || d.y < floorLimit) {
        d.active = false;
        DUMMY.scale.set(0, 0, 0);
        DUMMY.updateMatrix();
        this.dropMesh.setMatrixAt(i, DUMMY.matrix);
        continue;
      }

      DUMMY.position.set(d.x, d.y, d.z);
      DUMMY.lookAt(d.x + d.vx, d.y + d.vy, d.z + d.vz);
      DUMMY.scale.set(d.size, d.size, d.size * d.stretch);
      DUMMY.updateMatrix();
      this.dropMesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;

    // 4. Update Animated Bathwater Surface Mesh
    this.waterColor.lerp(this.waterTargetColor, Math.min(1, dt * 1.4));
    this.waterMat.color.copy(this.waterColor);

    if (waterFill > 0.015) {
      this.waterMesh.visible = true;
      this.waterMesh.position.y = this.waterLevelY;

      // Exact inner superellipse radius at this water height so water never pokes outside the porcelain!
      const hRatio = Math.min(1, Math.max(0, (this.waterLevelY - TUB.floorY - 0.04) / (TUB.rimY - TUB.floorY - 0.04)));
      const radFrac = 0.64 + 0.355 * Math.pow(hRatio, 1 / 1.55);
      const sx = TUB.innerHalfX * radFrac;
      const sz = TUB.innerHalfZ * radFrac;

      // Update active ripples
      for (let r = this.ripples.length - 1; r >= 0; r--) {
        this.ripples[r].t += dt;
        if (this.ripples[r].t > 2.2) this.ripples.splice(r, 1);
      }

      this.drainVortex += ((draining ? 1 : 0) - this.drainVortex) * Math.min(1, dt * 4);

      const posAttr = this.waterGeo.attributes.position;
      const arr = posAttr.array;
      const vCount = posAttr.count;
      for (let i = 0; i < vCount; i++) {
        const bx = this.waterBaseXZ[i * 2];
        const bz = this.waterBaseXZ[i * 2 + 1];
        const wx = bx * sx;
        const wz = bz * sz;

        // Ambient gentle bath waves
        let wy =
          Math.sin(wx * 2.8 + time * 2.4) * 0.014 +
          Math.cos(wz * 3.4 - time * 2.1) * 0.012;

        // Concentric expanding ripples from splashes, ducks, and faucet
        for (let r = 0; r < this.ripples.length; r++) {
          const rp = this.ripples[r];
          const dist = Math.hypot(wx - rp.x, wz - rp.z);
          const waveFront = rp.t * 2.6;
          const env = Math.exp(-Math.abs(dist - waveFront) * 3.2) * Math.exp(-rp.t * 1.45);
          wy += Math.sin((dist - waveFront) * 14) * rp.amp * env;
        }

        // Swirling dimple funnel when drain plug is pulled!
        if (this.drainVortex > 0.02) {
          const dDrain = Math.hypot(wx - (TUB.drainX - TUB.centerX), wz - (TUB.drainZ - TUB.centerZ));
          const funnel = -Math.exp(-dDrain * 3.2) * 0.14 * this.drainVortex;
          const spiral = Math.sin(Math.atan2(wz, wx - (TUB.drainX - TUB.centerX)) * 3 - time * 12) * 0.012 * this.drainVortex;
          wy += funnel + spiral;
        }

        // Slight surface-tension bulge when brim-full!
        if (waterFill > 0.96) {
          const rNorm = Math.hypot(bx, bz);
          wy += (1 - rNorm * rNorm) * (waterFill - 0.96) * 0.35;
        }

        arr[i * 3] = wx;
        arr[i * 3 + 1] = wy;
        arr[i * 3 + 2] = wz;
      }
      posAttr.needsUpdate = true;
      this.waterGeo.computeVertexNormals();
    } else {
      this.waterMesh.visible = false;
    }

    // 5. Update Sparkles
    for (const s of this.sparkles) {
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        s.sprite.visible = false;
        continue;
      }
      const p = s.life / s.maxLife;
      const scale = Math.sin(p * Math.PI) * s.baseScale;
      s.sprite.scale.set(scale, scale, 1);
      s.sprite.position.y += s.vy * dt;
      s.sprite.material.opacity = Math.sin(p * Math.PI);
    }

    // 6. Update Warm Rising Steam when tub has warm water
    const steamVis = waterFill > 0.25 ? Math.min(1, (waterFill - 0.25) * 1.6) : 0;
    for (const st of this.steamPuffs) {
      if (steamVis <= 0.02) {
        st.sprite.visible = false;
        continue;
      }
      st.sprite.visible = true;
      st.life = (st.life + dt * 0.22) % 1;
      const y = this.waterLevelY + 0.15 + st.life * 1.45;
      const x = st.x + Math.sin(time * 0.9 + st.phase) * 0.18;
      st.sprite.position.set(x, y, st.z);
      const sc = 0.55 + st.life * 0.95;
      st.sprite.scale.set(sc, sc, 1);
      st.sprite.material.opacity = Math.sin(st.life * Math.PI) * 0.28 * steamVis;
    }

    // 7. Update Overflow Floor Puddles
    if (this.puddleScale > 0.01) {
      for (const p of this.puddles) {
        p.mesh.visible = true;
        p.mesh.scale.set(p.sx * this.puddleScale, p.sz * this.puddleScale, 1);
      }
    }
  }
}
