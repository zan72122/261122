import * as THREE from 'three';
import { createSparkleTexture } from './textures.js';

// High-realism, low-draw-call water stream, sink basin water with ripples,
// instanced 3D soap suds, splashes, iridescent floating bubbles, and clean sparkles.
export class WaterFoamSystem {
  constructor(scene, kitchen) {
    this.scene = scene;
    this.kitchen = kitchen;
    this.dummy = new THREE.Object3D();

    // ----------------------------------------------------------------
    // 1. Realistic Running Water Stream (inner aerated core + outer glassy cylinder)
    // ----------------------------------------------------------------
    this.streamGroup = new THREE.Group();
    this.streamGroup.position.copy(kitchen.waterNozzleWorld);
    this.streamGroup.visible = false;
    scene.add(this.streamGroup);

    // Animated water streak canvas texture with vivid aqua refraction & crisp specular streaks
    const wc = document.createElement('canvas');
    wc.width = 128;
    wc.height = 256;
    const wctx = wc.getContext('2d');
    const grad = wctx.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(95,195,240,0.68)');
    grad.addColorStop(0.24, 'rgba(255,255,255,0.96)');
    grad.addColorStop(0.5, 'rgba(115,212,248,0.75)');
    grad.addColorStop(0.76, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(95,195,240,0.68)');
    wctx.fillStyle = grad;
    wctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 80; i++) {
      wctx.fillStyle = i % 3 === 0 ? 'rgba(130,218,255,0.78)' : 'rgba(255,255,255,0.85)';
      wctx.fillRect(Math.random() * 128, Math.random() * 256, 2 + Math.random() * 5, 22 + Math.random() * 60);
    }
    this.streamTex = new THREE.CanvasTexture(wc);
    this.streamTex.wrapS = this.streamTex.wrapT = THREE.RepeatWrapping;

    const outerGeo = new THREE.CylinderGeometry(0.015, 0.025, 1.0, 16, 12, true);
    outerGeo.translate(0, -0.5, 0);
    this.streamOuter = new THREE.Mesh(
      outerGeo,
      new THREE.MeshPhysicalMaterial({
        map: this.streamTex,
        color: 0xbdeaff,
        roughness: 0.05,
        metalness: 0.02,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
      })
    );
    this.streamGroup.add(this.streamOuter);

    const innerGeo = new THREE.CylinderGeometry(0.008, 0.014, 1.0, 12, 8, true);
    innerGeo.translate(0, -0.5, 0);
    this.streamInner = new THREE.Mesh(
      innerGeo,
      new THREE.MeshStandardMaterial({
        map: this.streamTex,
        color: 0xffffff,
        roughness: 0.12,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      })
    );
    this.streamGroup.add(this.streamInner);

    // ----------------------------------------------------------------
    // 2. Sink Basin Standing Water (fills up when plugged, overflows with foam!)
    // ----------------------------------------------------------------
    const sb = kitchen.sinkBounds;
    const waterW = sb.maxX - sb.minX - 0.006;
    const waterD = sb.maxZ - sb.minZ - 0.006;
    this.sinkWaterGeo = new THREE.PlaneGeometry(waterW, waterD, 18, 14);
    this.sinkWaterGeo.rotateX(-Math.PI / 2);
    this.sinkWaterBaseY = new Float32Array(this.sinkWaterGeo.attributes.position.count);

    this.sinkWaterMat = new THREE.MeshPhysicalMaterial({
      color: 0x8cd8f5,
      roughness: 0.05,
      metalness: 0.06,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.66,
      ior: 1.33,
    });
    this.sinkWater = new THREE.Mesh(this.sinkWaterGeo, this.sinkWaterMat);
    this.sinkWater.position.set(0, sb.bottomY + 0.004, 0);
    this.sinkWater.visible = false;
    this.sinkWater.userData.interactive = 'sinkWater';
    scene.add(this.sinkWater);

    this.waterFill = 0; // 0 .. 1.08 (can brim & overflow!)
    this.waterRipples = []; // { x, z, t, amp }
    this.basinSoapLevel = 0; // 0 .. 1 (makes sink water soapy & bubbly!)

    // ----------------------------------------------------------------
    // 3. Flying Green Detergent Drop (bottle nozzle -> sponge arc)
    // ----------------------------------------------------------------
    this.soapDrop = new THREE.Mesh(
      new THREE.SphereGeometry(0.017, 14, 14),
      new THREE.MeshPhysicalMaterial({
        color: 0x4be674,
        roughness: 0.08,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.92,
      })
    );
    this.soapDrop.visible = false;
    scene.add(this.soapDrop);
    this.soapDropAnim = { active: false, t: 0, start: new THREE.Vector3(), end: new THREE.Vector3(), onArrive: null };

    // ----------------------------------------------------------------
    // 4. Instanced 3D Fluffy Suds (sponge foam + dish foam + basin foam bath!)
    // ----------------------------------------------------------------
    this.maxSuds = 200;
    const sudGeo = new THREE.IcosahedronGeometry(1, 1);
    const sudMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4fcff,
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 1.0,
      iridescenceIOR: 1.33,
      sheen: 0.85,
      sheenColor: new THREE.Color(0xa6e5ff),
    });
    this.sudsMesh = new THREE.InstancedMesh(sudGeo, sudMat, this.maxSuds);
    this.sudsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sudsMesh.frustumCulled = false;
    scene.add(this.sudsMesh);

    this.suds = [];
    for (let i = 0; i < this.maxSuds; i++) {
      this.suds.push({
        active: false,
        kind: 'world', // 'sponge' | 'dish' | 'basin' | 'overflow'
        pos: new THREE.Vector3(),
        localOffset: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        radius: 0.015,
        targetRadius: 0.02,
        life: 0,
        maxLife: 5,
        phase: Math.random() * Math.PI * 2,
      });
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.sudsMesh.setMatrixAt(i, this.dummy.matrix);
    }

    // ----------------------------------------------------------------
    // 5. Instanced Water Splashes & Droplets
    // ----------------------------------------------------------------
    this.maxSplashes = 120;
    const splashGeo = new THREE.SphereGeometry(1, 8, 6);
    const splashMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f9ff,
      roughness: 0.06,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.82,
    });
    this.splashMesh = new THREE.InstancedMesh(splashGeo, splashMat, this.maxSplashes);
    this.splashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splashMesh.frustumCulled = false;
    scene.add(this.splashMesh);

    this.splashes = [];
    for (let i = 0; i < this.maxSplashes; i++) {
      this.splashes.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        size: 0.008,
        life: 0,
      });
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.splashMesh.setMatrixAt(i, this.dummy.matrix);
    }

    // ----------------------------------------------------------------
    // 6. Floating Iridescent Soap Bubbles (tappable -> musical pop!)
    // ----------------------------------------------------------------
    this.floatingBubbles = [];
    const bubbleGeo = new THREE.SphereGeometry(1, 18, 16);
    const bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff6ff,
      emissive: 0x3b7699,
      emissiveIntensity: 0.16,
      roughness: 0.03,
      metalness: 0.08,
      clearcoat: 1.0,
      iridescence: 1.0,
      iridescenceIOR: 1.38,
      iridescenceThicknessRange: [180, 520],
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(bubbleGeo, bubbleMat);
      m.visible = false;
      m.userData.interactive = 'floatingBubble';
      m.userData.bubbleIndex = i;
      scene.add(m);
      this.floatingBubbles.push({
        mesh: m,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        radius: 0.045,
        age: 0,
        maxAge: 9,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // ----------------------------------------------------------------
    // 7. Gleaming Sparkle Sprites (when dish becomes spotless!)
    // ----------------------------------------------------------------
    const sparkTex = createSparkleTexture();
    this.sparkles = [];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.SpriteMaterial({
        map: sparkTex,
        color: 0xfffef2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.sparkles.push({
        sprite: sp,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 1.1,
        maxScale: 0.09,
      });
    }
  }

  launchSoapDrop(startWorld, endWorld, onArrive) {
    this.soapDropAnim.active = true;
    this.soapDropAnim.t = 0;
    this.soapDropAnim.start.copy(startWorld);
    this.soapDropAnim.end.copy(endWorld);
    this.soapDropAnim.onArrive = onArrive;
    this.soapDrop.visible = true;
    this.soapDrop.position.copy(startWorld);
  }

  addRipple(worldX, worldZ, amp = 0.012) {
    if (this.waterRipples.length > 8) this.waterRipples.shift();
    this.waterRipples.push({ x: worldX, z: worldZ, t: 0, amp });
  }

  spawnSud(kind, posOrOffset, targetRadius = 0.022, maxLife = 8) {
    // Find free slot or recycle oldest non-sponge sud
    let slot = this.suds.find((s) => !s.active);
    if (!slot) {
      slot = this.suds.find((s) => s.kind !== 'sponge') || this.suds[0];
    }
    slot.active = true;
    slot.kind = kind;
    if (kind === 'sponge') {
      slot.localOffset.copy(posOrOffset);
    } else {
      slot.pos.copy(posOrOffset);
    }
    slot.vel.set((Math.random() - 0.5) * 0.06, Math.random() * 0.05, (Math.random() - 0.5) * 0.06);
    slot.radius = targetRadius * 0.25;
    slot.targetRadius = targetRadius;
    slot.life = 0;
    slot.maxLife = maxLife;
    return slot;
  }

  spawnSplashBurst(origin, count = 8, speed = 0.7) {
    let spawned = 0;
    for (let i = 0; i < this.maxSplashes && spawned < count; i++) {
      const p = this.splashes[i];
      if (p.active) continue;
      p.active = true;
      p.pos.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      p.vel.set(Math.cos(a) * spd, 0.35 + Math.random() * 0.65 * speed, Math.sin(a) * spd);
      p.size = 0.005 + Math.random() * 0.007;
      p.life = 0.45 + Math.random() * 0.35;
      spawned++;
    }
  }

  spawnFloatingBubble(origin, radius = 0.042) {
    const slot = this.floatingBubbles.find((b) => !b.active);
    if (!slot) return;
    slot.active = true;
    slot.pos.copy(origin);
    slot.vel.set((Math.random() - 0.5) * 0.14, 0.15 + Math.random() * 0.13, (Math.random() - 0.5) * 0.08);
    slot.radius = radius * (0.8 + Math.random() * 0.55);
    slot.age = 0;
    slot.maxAge = 7 + Math.random() * 4;
    slot.mesh.visible = true;
    slot.mesh.position.copy(slot.pos);
    slot.mesh.scale.setScalar(0.01);
  }

  popFloatingBubble(index) {
    const b = this.floatingBubbles[index];
    if (!b || !b.active) return false;
    b.active = false;
    b.mesh.visible = false;
    this.spawnSplashBurst(b.pos, 7, 0.55);
    this.spawnSparkles(b.pos, 2, 0.07);
    return true;
  }

  spawnSparkles(center, count = 8, spread = 0.18) {
    let spawned = 0;
    for (let i = 0; i < this.sparkles.length && spawned < count; i++) {
      const s = this.sparkles[i];
      if (s.active) continue;
      s.active = true;
      s.age = 0;
      s.maxAge = 0.85 + Math.random() * 0.5;
      s.maxScale = 0.055 + Math.random() * 0.042;
      s.pos.set(
        center.x + (Math.random() - 0.5) * spread * 2,
        center.y + (Math.random() - 0.3) * spread * 1.4,
        center.z + (Math.random() - 0.5) * spread * 1.2 + 0.04
      );
      s.vel.set((Math.random() - 0.5) * 0.06, 0.09 + Math.random() * 0.08, 0.02);
      s.sprite.visible = true;
      spawned++;
    }
  }

  clearDishSuds() {
    for (const s of this.suds) {
      if (s.active && s.kind === 'dish') {
        s.active = false;
      }
    }
  }

  getWaterSurfaceY() {
    const sb = this.kitchen.sinkBounds;
    return sb.bottomY + 0.008 + this.waterFill * (sb.rimY - sb.bottomY - 0.012);
  }

  update(dt, time, { waterFlow, isPlugged, spongeWorldPos, spongeFoamLevel, streamHitY, onDrainGlug }) {
    const sb = this.kitchen.sinkBounds;

    // 1. Update running water stream
    this.streamGroup.visible = waterFlow > 0.03;
    if (this.streamGroup.visible) {
      const nozzleY = this.kitchen.waterNozzleWorld.y;
      const targetY = Math.max(this.getWaterSurfaceY(), streamHitY);
      const length = Math.max(0.06, nozzleY - targetY);
      const widthScale = 0.45 + waterFlow * 0.65;
      const pulse = 1.0 + Math.sin(time * 28) * 0.06;
      this.streamOuter.scale.set(widthScale * pulse, length, widthScale * pulse);
      this.streamInner.scale.set(widthScale * 0.85, length, widthScale * 0.85);
      this.streamTex.offset.y += dt * (4.2 + waterFlow * 2.5);

      // Continuous splash at water impact point
      if (Math.random() < dt * 28 * waterFlow) {
        this.spawnSplashBurst(
          new THREE.Vector3(this.kitchen.waterNozzleWorld.x, targetY + 0.01, this.kitchen.waterNozzleWorld.z),
          2,
          0.55 + waterFlow * 0.3
        );
      }
      if (this.waterFill > 0.04 && Math.random() < dt * 4) {
        this.addRipple(this.kitchen.waterNozzleWorld.x, this.kitchen.waterNozzleWorld.z, 0.008 * waterFlow);
      }
    }

    // 2. Sink basin water fill, drain & overflow physics!
    if (isPlugged) {
      if (waterFlow > 0.05) {
        this.waterFill = Math.min(1.06, this.waterFill + dt * 0.145 * waterFlow);
        // Overflowing! Spawn dramatic foam & splash bubbles spilling over the sink rim!
        if (this.waterFill > 0.96 && Math.random() < dt * 16) {
          const side = Math.random();
          const ox = side < 0.5 ? (Math.random() - 0.5) * 0.7 : (Math.random() > 0.5 ? 0.44 : -0.44);
          const oz = side < 0.5 ? 0.29 : (Math.random() - 0.5) * 0.46;
          this.spawnSud('overflow', new THREE.Vector3(ox, 0.02, oz), 0.024 + Math.random() * 0.024, 5.5);
          this.spawnSplashBurst(new THREE.Vector3(ox, 0.02, oz), 3, 0.45);
        }
      }
    } else if (this.waterFill > 0) {
      const prev = this.waterFill;
      this.waterFill = Math.max(0, this.waterFill - dt * 0.28);
      if (prev > 0.08 && Math.random() < dt * 6.5 && onDrainGlug) {
        onDrainGlug();
      }
      if (this.waterFill <= 0.01) {
        this.basinSoapLevel = Math.max(0, this.basinSoapLevel - dt * 0.6);
      }
    }

    // If soap is in basin water & water is flowing, generate fluffy bubble bath on surface!
    if (this.waterFill > 0.12 && this.basinSoapLevel > 0.15 && waterFlow > 0.05 && Math.random() < dt * 10) {
      this.spawnSud(
        'basin',
        new THREE.Vector3((Math.random() - 0.5) * 0.68, this.getWaterSurfaceY() + 0.01, (Math.random() - 0.5) * 0.42),
        0.02 + Math.random() * 0.028,
        9.0
      );
      if (Math.random() < 0.35) {
        this.spawnFloatingBubble(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, this.getWaterSurfaceY() + 0.04, (Math.random() - 0.5) * 0.2),
          0.048
        );
      }
    }

    // Update standing water mesh & vertex ripples
    this.sinkWater.visible = this.waterFill > 0.01;
    if (this.sinkWater.visible) {
      const surfY = this.getWaterSurfaceY();
      this.sinkWater.position.y = surfY;
      // Cloudier turquoise-white when soapy
      this.sinkWaterMat.color.setRGB(
        0.74 + this.basinSoapLevel * 0.2,
        0.92 + this.basinSoapLevel * 0.06,
        0.98
      );
      this.sinkWaterMat.opacity = 0.55 + this.basinSoapLevel * 0.28;

      for (let i = this.waterRipples.length - 1; i >= 0; i--) {
        this.waterRipples[i].t += dt;
        if (this.waterRipples[i].t > 1.8) this.waterRipples.splice(i, 1);
      }

      const posAttr = this.sinkWaterGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        let h = Math.sin(vx * 9 + time * 2.8) * 0.0025 + Math.cos(vz * 11 - time * 2.4) * 0.0025;
        for (const rip of this.waterRipples) {
          const dist = Math.hypot(vx - rip.x, vz - rip.z);
          const wave = Math.sin(dist * 26 - rip.t * 11) * Math.exp(-dist * 3.5 - rip.t * 1.6);
          h += wave * rip.amp;
        }
        // Subtle vortex dimple over drain while draining
        if (!isPlugged && this.waterFill > 0.05) {
          const dd = Math.hypot(vx - this.kitchen.drainPos.x, vz - this.kitchen.drainPos.z);
          h -= Math.exp(-dd * 14) * 0.025;
        }
        posAttr.setY(i, h);
      }
      posAttr.needsUpdate = true;
      this.sinkWaterGeo.computeVertexNormals();
    }

    // 3. Flying detergent drop arc
    if (this.soapDropAnim.active) {
      this.soapDropAnim.t += dt * 3.6;
      const u = Math.min(1, this.soapDropAnim.t);
      this.soapDrop.position.lerpVectors(this.soapDropAnim.start, this.soapDropAnim.end, u);
      this.soapDrop.position.y += Math.sin(u * Math.PI) * 0.14;
      this.soapDrop.scale.set(0.85, 1.25 - Math.abs(u - 0.5) * 0.4, 0.85);
      if (u >= 1) {
        this.soapDropAnim.active = false;
        this.soapDrop.visible = false;
        if (this.soapDropAnim.onArrive) this.soapDropAnim.onArrive();
      }
    }

    // 4. Maintain fluffy suds on the sponge when soapy
    if (spongeFoamLevel > 0.15) {
      const spongeSudsCount = this.suds.filter((s) => s.active && s.kind === 'sponge').length;
      const desired = Math.floor(6 + spongeFoamLevel * 18);
      if (spongeSudsCount < desired) {
        this.spawnSud(
          'sponge',
          new THREE.Vector3((Math.random() - 0.5) * 0.13, 0.024 + Math.random() * 0.022, (Math.random() - 0.5) * 0.085),
          0.015 + Math.random() * 0.018 * (0.6 + spongeFoamLevel * 0.6),
          12
        );
      }
    }

    // Update all 3D suds instances
    for (let i = 0; i < this.maxSuds; i++) {
      const s = this.suds[i];
      if (!s.active) {
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.sudsMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      s.life += dt;
      if (s.kind === 'sponge') {
        if (spongeFoamLevel < 0.08) {
          s.targetRadius = 0;
          s.radius = THREE.MathUtils.lerp(s.radius, 0, dt * 6);
          if (s.radius < 0.002) s.active = false;
        } else {
          s.radius = THREE.MathUtils.lerp(s.radius, s.targetRadius, dt * 8);
        }
        this.dummy.position.copy(spongeWorldPos).add(s.localOffset);
        this.dummy.position.y += Math.sin(time * 3 + s.phase) * 0.002;
      } else if (s.kind === 'basin') {
        s.pos.x += Math.sin(time * 1.2 + s.phase) * dt * 0.025;
        s.pos.z += Math.cos(time * 1.1 + s.phase) * dt * 0.02;
        s.pos.x = THREE.MathUtils.clamp(s.pos.x, sb.minX + 0.04, sb.maxX - 0.04);
        s.pos.z = THREE.MathUtils.clamp(s.pos.z, sb.minZ + 0.04, sb.maxZ - 0.04);
        s.pos.y = this.getWaterSurfaceY() + s.radius * 0.45;
        if (this.waterFill < 0.03) s.life += dt * 4;
        const fade = s.life > s.maxLife - 1 ? Math.max(0, s.maxLife - s.life) : 1;
        s.radius = THREE.MathUtils.lerp(s.radius, s.targetRadius * fade, dt * 6);
        if (s.life >= s.maxLife) s.active = false;
        this.dummy.position.copy(s.pos);
      } else if (s.kind === 'overflow') {
        s.vel.y -= 0.45 * dt;
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.y < 0.015) {
          s.pos.y = 0.015;
          s.vel.multiplyScalar(0.85);
        }
        const fade = s.life > s.maxLife - 1 ? Math.max(0, s.maxLife - s.life) : 1;
        s.radius = THREE.MathUtils.lerp(s.radius, s.targetRadius * fade, dt * 7);
        if (s.life >= s.maxLife) s.active = false;
        this.dummy.position.copy(s.pos);
      } else {
        // Dish suds: gently shrink under water stream
        if (waterFlow > 0.15) {
          s.life += dt * (2.6 + waterFlow * 3.5);
          s.pos.y -= dt * 0.08 * waterFlow;
        }
        const fade = s.life > s.maxLife - 0.8 ? Math.max(0, (s.maxLife - s.life) / 0.8) : 1;
        s.radius = THREE.MathUtils.lerp(s.radius, s.targetRadius * fade, dt * 10);
        if (s.life >= s.maxLife || s.radius < 0.002) s.active = false;
        this.dummy.position.copy(s.pos);
      }

      this.dummy.scale.set(s.radius, s.radius * 0.88, s.radius);
      this.dummy.rotation.set(0, s.phase, 0);
      this.dummy.updateMatrix();
      this.sudsMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.sudsMesh.instanceMatrix.needsUpdate = true;

    // 5. Update water splash droplets
    for (let i = 0; i < this.maxSplashes; i++) {
      const p = this.splashes[i];
      if (!p.active) {
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.splashMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.life -= dt;
      p.vel.y -= 3.2 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.life <= 0 || p.pos.y < sb.bottomY - 0.05) {
        p.active = false;
        this.dummy.scale.set(0, 0, 0);
      } else {
        this.dummy.position.copy(p.pos);
        const s = p.size * Math.min(1, p.life * 3);
        this.dummy.scale.set(s, s * 1.4, s);
      }
      this.dummy.updateMatrix();
      this.splashMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.splashMesh.instanceMatrix.needsUpdate = true;

    // 6. Floating tappable rainbow soap bubbles
    for (const b of this.floatingBubbles) {
      if (!b.active) continue;
      b.age += dt;
      b.pos.x += b.vel.x * dt + Math.sin(time * 2.1 + b.wobble) * dt * 0.09;
      b.pos.y += b.vel.y * dt;
      b.pos.z += b.vel.z * dt;
      b.mesh.position.copy(b.pos);

      const grow = Math.min(1, b.age * 3.5);
      const squash = 1 + Math.sin(time * 5.2 + b.wobble) * 0.06;
      b.mesh.scale.set(b.radius * grow * squash, b.radius * grow / squash, b.radius * grow * squash);

      if (b.age > b.maxAge || b.pos.y > 1.25) {
        b.active = false;
        b.mesh.visible = false;
      }
    }

    // 7. Gleaming clean sparkles
    for (const sp of this.sparkles) {
      if (!sp.active) continue;
      sp.age += dt;
      sp.pos.addScaledVector(sp.vel, dt);
      sp.sprite.position.copy(sp.pos);
      const u = sp.age / sp.maxAge;
      const pulse = Math.sin(u * Math.PI);
      const sc = sp.maxScale * pulse;
      sp.sprite.scale.set(sc, sc, 1);
      sp.sprite.material.opacity = pulse;
      if (sp.age >= sp.maxAge) {
        sp.active = false;
        sp.sprite.visible = false;
      }
    }
  }
}
