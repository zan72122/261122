// Photorealistic 3D Soap Suds, Rainbow Iridescent Floating Bubbles,
// Water Splash Droplets, and Squeaky-Clean Sunbeam Sparkles.
// Uses GPU InstancedMesh for rich density at minimal draw calls & triangles.

import * as THREE from 'three';

export class FoamAndWaterFX {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();

    // 1. Creamy Dense 3D Micro-Foam Clusters (on Dish, on Sponge, & Floating in Sink!)
    this.maxSuds = 320;
    const sudsGeo = new THREE.SphereGeometry(1, 10, 8);
    const sudsMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xeef9ff),
      envMapIntensity: 1.25,
    });
    this.sudsMesh = new THREE.InstancedMesh(sudsGeo, sudsMat, this.maxSuds);
    this.sudsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sudsMesh.castShadow = false;
    this.sudsMesh.receiveShadow = true;
    scene.add(this.sudsMesh);

    this.sudsPool = Array.from({ length: this.maxSuds }, () => ({
      active: false,
      mode: 'dish', // 'dish' | 'sponge' | 'sink' | 'fall'
      localPos: new THREE.Vector3(),
      worldPos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      scale: 0.06,
      targetScale: 0.06,
      squish: 0.65,
      phase: Math.random() * Math.PI * 2,
      color: new THREE.Color(0xffffff),
      life: 1,
    }));

    // 2. Iridescent Thin-Film Soap Bubbles (Clinging & Floating Upward - tappable to POP!)
    this.maxBubbles = 110;
    const bubGeo = new THREE.SphereGeometry(1, 14, 10);
    const bubMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      roughness: 0.02,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      iridescence: 1.0,
      iridescenceIOR: 1.33,
      iridescenceThicknessRange: [130, 560],
      envMapIntensity: 2.35,
      depthWrite: false,
    });
    this.bubbleMesh = new THREE.InstancedMesh(bubGeo, bubMat, this.maxBubbles);
    this.bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.bubbleMesh);

    this.bubbles = Array.from({ length: this.maxBubbles }, () => ({
      active: false,
      floating: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      radius: 0.08,
      wobblePhase: Math.random() * Math.PI * 2,
      life: 0,
      maxLife: 4,
    }));

    // 3. Sparkling Water Droplets & Splash Arcs
    this.maxDrops = 140;
    const dropGeo = new THREE.SphereGeometry(1, 8, 6);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f8ff,
      transparent: true,
      opacity: 0.72,
      roughness: 0.03,
      metalness: 0.05,
      clearcoat: 1.0,
      envMapIntensity: 2.1,
      depthWrite: false,
    });
    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, this.maxDrops);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.dropMesh);

    this.drops = Array.from({ length: this.maxDrops }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      radius: 0.022,
      life: 0,
    }));

    // 4. Sunlit Sparkle Glints (Squeaky-clean dish celebration & popped bubble stars)
    this.maxSparkles = 36;
    const spkGeo = new THREE.PlaneGeometry(1, 1);
    const spkMat = new THREE.MeshBasicMaterial({
      map: textures.sparkleMap,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.sparkleMesh = new THREE.InstancedMesh(spkGeo, spkMat, this.maxSparkles);
    this.sparkleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.sparkleMesh);

    this.sparkles = Array.from({ length: this.maxSparkles }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      scale: 0.25,
      life: 0,
      maxLife: 0.7,
    }));

    // Pre-allocate sponge foam crown slots (first 28 slots of sudsPool)
    this.spongeFoamCount = 28;
    for (let i = 0; i < this.spongeFoamCount; i++) {
      const s = this.sudsPool[i];
      s.mode = 'sponge';
      const angle = (i / this.spongeFoamCount) * Math.PI * 2;
      const ring = i < 10 ? 0.11 : 0.22;
      s.localPos.set(
        Math.cos(angle) * ring * 1.15 + (Math.random() - 0.5) * 0.06,
        0.09 + (i < 10 ? 0.05 : 0.01) + Math.random() * 0.04,
        Math.sin(angle) * ring * 0.8 + (Math.random() - 0.5) * 0.05
      );
      s.targetScale = 0.055 + Math.random() * 0.045;
    }
  }

  _allocSud() {
    for (let i = this.spongeFoamCount; i < this.maxSuds; i++) {
      if (!this.sudsPool[i].active) return this.sudsPool[i];
    }
    // Recycle oldest sink/fall puff
    for (let i = this.spongeFoamCount; i < this.maxSuds; i++) {
      if (this.sudsPool[i].mode !== 'dish') return this.sudsPool[i];
    }
    return this.sudsPool[this.spongeFoamCount + Math.floor(Math.random() * (this.maxSuds - this.spongeFoamCount))];
  }

  spawnDishSuds(dishGroup, localPoint, count = 4, tintHex = 0xffffff) {
    for (let i = 0; i < count; i++) {
      const s = this._allocSud();
      s.active = true;
      s.mode = 'dish';
      s.dishRef = dishGroup;
      s.localPos.set(
        localPoint.x + (Math.random() - 0.5) * 0.19,
        localPoint.y + 0.025 + Math.random() * 0.035,
        localPoint.z + (Math.random() - 0.5) * 0.19
      );
      s.scale = 0.01;
      s.targetScale = 0.055 + Math.random() * 0.055;
      s.squish = 0.58 + Math.random() * 0.22;
      s.color.setHex(tintHex).lerp(this.tmpColor.setHex(0xffffff), 0.72);
      s.life = 1;
    }

    // Also attach occasional iridescent glossy bubble right on top of the foam!
    if (Math.random() < 0.45) {
      const wp = localPoint.clone();
      dishGroup.localToWorld(wp);
      this.spawnBubble(wp.add(new THREE.Vector3(0, 0.06, 0)), false, 0.045 + Math.random() * 0.05);
    }
  }

  spawnSinkBubbleMountain(centerPos, count = 6, tintHex = 0xffffff) {
    for (let i = 0; i < count; i++) {
      const s = this._allocSud();
      s.active = true;
      s.mode = 'sink';
      s.worldPos.set(
        centerPos.x + (Math.random() - 0.5) * 0.85,
        centerPos.y + Math.random() * 0.14,
        centerPos.z + (Math.random() - 0.5) * 0.72
      );
      s.vel.set((Math.random() - 0.5) * 0.35, 0.12 + Math.random() * 0.18, (Math.random() - 0.5) * 0.35);
      s.scale = 0.02;
      s.targetScale = 0.09 + Math.random() * 0.09;
      s.squish = 0.78;
      s.color.setHex(tintHex).lerp(this.tmpColor.setHex(0xffffff), 0.78);
      s.life = 1;
    }
    if (Math.random() < 0.65) {
      this.spawnBubble(centerPos, true, 0.08 + Math.random() * 0.09);
    }
  }

  rinseDishSudsNear(dishGroup, worldHitPoint, radius = 0.45, strength = 1.0) {
    let remaining = 0;
    const wp = new THREE.Vector3();
    for (let i = this.spongeFoamCount; i < this.maxSuds; i++) {
      const s = this.sudsPool[i];
      if (!s.active || s.mode !== 'dish' || s.dishRef !== dishGroup) continue;
      wp.copy(s.localPos);
      dishGroup.localToWorld(wp);
      const dist = wp.distanceTo(worldHitPoint);
      if (dist < radius) {
        // Detach into falling water-washed foam sliding down into sink!
        s.mode = 'fall';
        s.worldPos.copy(wp);
        s.vel.set((wp.x - worldHitPoint.x) * 1.4, -0.6 - Math.random() * 0.5, 0.35 + Math.random() * 0.3);
        s.life = 0.55;
      } else if (strength > 0.35 && Math.random() < 0.09 * strength) {
        s.targetScale *= 0.82;
        if (s.targetScale < 0.022) {
          s.mode = 'fall';
          s.worldPos.copy(wp);
          s.vel.set(0, -0.8, 0.2);
          s.life = 0.35;
        } else {
          remaining++;
        }
      } else {
        remaining++;
      }
    }
    return remaining;
  }

  clearAllDishSuds(dishGroup) {
    for (let i = this.spongeFoamCount; i < this.maxSuds; i++) {
      const s = this.sudsPool[i];
      if (s.active && s.mode === 'dish' && (!dishGroup || s.dishRef === dishGroup)) {
        s.active = false;
      }
    }
  }

  countDishSuds(dishGroup) {
    let n = 0;
    for (let i = this.spongeFoamCount; i < this.maxSuds; i++) {
      const s = this.sudsPool[i];
      if (s.active && s.mode === 'dish' && s.dishRef === dishGroup) n++;
    }
    return n;
  }

  spawnBubble(origin, floating = true, radius = 0.08) {
    let slot = this.bubbles.find((b) => !b.active);
    if (!slot) slot = this.bubbles[Math.floor(Math.random() * this.maxBubbles)];
    slot.active = true;
    slot.floating = floating;
    slot.pos.copy(origin).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.16,
      Math.random() * 0.08,
      (Math.random() - 0.5) * 0.16
    ));
    slot.vel.set(
      (Math.random() - 0.5) * 0.42,
      floating ? (0.36 + Math.random() * 0.42) : 0.02,
      (Math.random() - 0.5) * 0.28
    );
    slot.radius = radius;
    slot.life = 0;
    slot.maxLife = floating ? (4.5 + Math.random() * 3.5) : (2.2 + Math.random() * 1.8);
  }

  // Check if player tapped/swiped a floating iridescent soap bubble!
  tryPopFloatingBubble(raycaster, onPop) {
    let poppedCount = 0;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < this.maxBubbles; i++) {
      const b = this.bubbles[i];
      if (!b.active || !b.floating) continue;
      raycaster.ray.closestPointToPoint(b.pos, tmp);
      if (tmp.distanceTo(b.pos) <= b.radius * 1.9 + 0.09) {
        b.active = false;
        this.spawnSplashDrops(b.pos, 8, 1.1);
        this.spawnSparkles(b.pos, 2);
        if (onPop) onPop(b.pos);
        poppedCount++;
        if (poppedCount >= 2) break;
      }
    }
    return poppedCount > 0;
  }

  spawnSplashDrops(origin, count = 6, speedScale = 1.0) {
    for (let i = 0; i < count; i++) {
      let d = this.drops.find((item) => !item.active);
      if (!d) d = this.drops[Math.floor(Math.random() * this.maxDrops)];
      d.active = true;
      d.pos.copy(origin).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.12,
        Math.random() * 0.04,
        (Math.random() - 0.5) * 0.12
      ));
      const a = Math.random() * Math.PI * 2;
      const sp = (0.55 + Math.random() * 0.95) * speedScale;
      d.vel.set(Math.cos(a) * sp, (0.65 + Math.random() * 0.9) * speedScale, Math.sin(a) * sp);
      d.radius = 0.016 + Math.random() * 0.020;
      d.life = 0.45 + Math.random() * 0.25;
    }
  }

  spawnSparkles(origin, count = 6) {
    for (let i = 0; i < count; i++) {
      let sp = this.sparkles.find((s) => !s.active);
      if (!sp) sp = this.sparkles[Math.floor(Math.random() * this.maxSparkles)];
      sp.active = true;
      sp.pos.copy(origin).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.65,
        (Math.random() - 0.2) * 0.45,
        (Math.random() - 0.5) * 0.35 + 0.12
      ));
      sp.vel.set((Math.random() - 0.5) * 0.25, 0.25 + Math.random() * 0.35, 0);
      sp.scale = 0.22 + Math.random() * 0.24;
      sp.life = 0;
      sp.maxLife = 0.55 + Math.random() * 0.45;
    }
  }

  update(dt, elapsed, spongeGroup, spongeFoamLevel, spongeTintHex, world, camera) {
    const dummy = this.dummy;
    const sinkSurfaceY = world.waterLevel > 0.02
      ? THREE.MathUtils.lerp(world.basinBounds.floorY + 0.02, -0.02, Math.min(1.02, world.waterLevel))
      : world.basinBounds.floorY + 0.03;

    // 1. Update Sponge Crown Suds (slots 0 .. spongeFoamCount - 1)
    const activeSpongeSlots = Math.floor(spongeFoamLevel * this.spongeFoamCount);
    for (let i = 0; i < this.spongeFoamCount; i++) {
      const s = this.sudsPool[i];
      if (i < activeSpongeSlots) {
        s.active = true;
        s.scale = THREE.MathUtils.lerp(s.scale, s.targetScale * (0.65 + spongeFoamLevel * 0.65), Math.min(1, dt * 12));
        s.worldPos.copy(s.localPos);
        spongeGroup.localToWorld(s.worldPos);
        s.color.setHex(spongeTintHex).lerp(this.tmpColor.setHex(0xffffff), 0.72);

        const pulse = 1 + Math.sin(elapsed * 7 + s.phase) * 0.07;
        dummy.position.copy(s.worldPos);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s.scale * pulse, s.scale * 0.78 * pulse, s.scale * pulse);
        dummy.updateMatrix();
        this.sudsMesh.setMatrixAt(i, dummy.matrix);
        this.sudsMesh.setColorAt(i, s.color);
      } else {
        s.active = false;
        s.scale = 0.001;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.sudsMesh.setMatrixAt(i, dummy.matrix);
      }
    }

    // 2. Update Dish, Sink & Falling Suds
    for (let i = this.spongeFoamCount; i < this.maxSuds; i++) {
      const s = this.sudsPool[i];
      if (!s.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.sudsMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      if (s.mode === 'dish') {
        if (!s.dishRef || !s.dishRef.parent) {
          s.active = false;
          continue;
        }
        s.scale = THREE.MathUtils.lerp(s.scale, s.targetScale, Math.min(1, dt * 11));
        s.worldPos.copy(s.localPos);
        s.dishRef.localToWorld(s.worldPos);
        dummy.position.copy(s.worldPos);
        dummy.quaternion.copy(s.dishRef.quaternion);
        const breathe = 1 + Math.sin(elapsed * 5 + s.phase) * 0.05;
        dummy.scale.set(s.scale * breathe, s.scale * s.squish, s.scale * breathe);
      } else if (s.mode === 'fall') {
        s.vel.y -= 3.8 * dt;
        s.worldPos.addScaledVector(s.vel, dt);
        s.life -= dt;
        if (s.worldPos.y <= sinkSurfaceY) {
          if (world.waterLevel > 0.08) {
            // Lands on filled sink water and floats!
            s.mode = 'sink';
            s.worldPos.y = sinkSurfaceY + 0.02;
            s.vel.set((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15);
            s.life = 6.0;
          } else {
            s.active = false;
          }
        }
        if (s.life <= 0) s.active = false;
        dummy.position.copy(s.worldPos);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.max(0, s.scale * Math.min(1, s.life * 2)));
      } else if (s.mode === 'sink') {
        s.scale = THREE.MathUtils.lerp(s.scale, s.targetScale, Math.min(1, dt * 7));
        // Buoyantly ride the sink water level (and swirl into drain whirlpool when unplugged!)
        const targetY = sinkSurfaceY + 0.02 + Math.sin(elapsed * 3.5 + s.phase) * 0.018;
        s.worldPos.y = THREE.MathUtils.lerp(s.worldPos.y, targetY, Math.min(1, dt * 8));
        s.worldPos.x += s.vel.x * dt;
        s.worldPos.z += s.vel.z * dt;
        s.vel.multiplyScalar(0.95);

        if (world.whirlpoolSpin > 0.1) {
          const dx = world.drainPos.x - s.worldPos.x;
          const dz = world.drainPos.z - s.worldPos.z;
          const dist = Math.max(0.06, Math.hypot(dx, dz));
          // Swirl tangentially + pull inward toward drain!
          s.worldPos.x += (dx / dist * 0.75 - dz / dist * 1.35) * dt * world.whirlpoolSpin;
          s.worldPos.z += (dz / dist * 0.75 + dx / dist * 1.35) * dt * world.whirlpoolSpin;
          if (dist < 0.14) s.active = false;
        } else if (world.waterLevel < 0.02) {
          s.life -= dt * 0.5;
          if (s.life <= 0) s.active = false;
        }

        // Clamp gently inside sink or spill slightly over front rim when overflowing!
        const spill = world.overflowRipple > 0.2 ? 0.18 : -0.06;
        s.worldPos.x = THREE.MathUtils.clamp(s.worldPos.x, world.basinBounds.minX + 0.08, world.basinBounds.maxX - 0.08);
        s.worldPos.z = THREE.MathUtils.clamp(s.worldPos.z, world.basinBounds.minZ + 0.08, world.basinBounds.maxZ + spill);

        dummy.position.copy(s.worldPos);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s.scale, s.scale * 0.72, s.scale);
      }

      if (!s.active) {
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      this.sudsMesh.setMatrixAt(i, dummy.matrix);
      this.sudsMesh.setColorAt(i, s.color);
    }
    this.sudsMesh.instanceMatrix.needsUpdate = true;
    if (this.sudsMesh.instanceColor) this.sudsMesh.instanceColor.needsUpdate = true;

    // 3. Update Iridescent Soap Bubbles
    for (let i = 0; i < this.maxBubbles; i++) {
      const b = this.bubbles[i];
      if (!b.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.bubbleMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      b.life += dt;
      if (b.life >= b.maxLife) {
        b.active = false;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.bubbleMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      if (b.floating) {
        b.pos.x += (b.vel.x + Math.sin(elapsed * 2.4 + b.wobblePhase) * 0.22) * dt;
        b.pos.y += b.vel.y * dt;
        b.pos.z += (b.vel.z + Math.cos(elapsed * 2.1 + b.wobblePhase) * 0.14) * dt;
      }

      const grow = Math.min(1, b.life * 6);
      const sqx = 1 + Math.sin(elapsed * 8 + b.wobblePhase) * 0.06;
      const sqy = 1 - Math.sin(elapsed * 8 + b.wobblePhase) * 0.06;
      dummy.position.copy(b.pos);
      dummy.rotation.set(0, elapsed * 0.5, 0);
      dummy.scale.set(b.radius * grow * sqx, b.radius * grow * sqy, b.radius * grow * sqx);
      dummy.updateMatrix();
      this.bubbleMesh.setMatrixAt(i, dummy.matrix);
    }
    this.bubbleMesh.instanceMatrix.needsUpdate = true;

    // 4. Update Water Splash Droplets
    if (world.faucetFlow > 0.25 && Math.random() < 0.75) {
      const splashOrigin = new THREE.Vector3(
        world.spoutWorldPos.x + (Math.random() - 0.5) * (world.showerMode ? 0.36 : 0.08),
        Math.max(sinkSurfaceY, -0.34),
        world.spoutWorldPos.z + (Math.random() - 0.5) * (world.showerMode ? 0.36 : 0.08)
      );
      this.spawnSplashDrops(splashOrigin, world.showerMode ? 3 : 2, world.showerMode ? 0.75 : 0.9);
    }

    for (let i = 0; i < this.maxDrops; i++) {
      const d = this.drops[i];
      if (!d.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.dropMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      d.vel.y -= 5.8 * dt;
      d.pos.addScaledVector(d.vel, dt);
      d.life -= dt;
      if (d.life <= 0 || d.pos.y < sinkSurfaceY - 0.05) {
        d.active = false;
        dummy.scale.setScalar(0);
      } else {
        dummy.position.copy(d.pos);
        // Stretch slightly along velocity for realistic droplet motion blur
        dummy.scale.set(d.radius, d.radius * 1.35, d.radius);
      }
      dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, dummy.matrix);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;

    // 5. Update Sparkles (billboarded toward camera)
    for (let i = 0; i < this.maxSparkles; i++) {
      const sp = this.sparkles[i];
      if (!sp.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.sparkleMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        dummy.scale.setScalar(0);
      } else {
        sp.pos.addScaledVector(sp.vel, dt);
        const t = sp.life / sp.maxLife;
        const pulse = Math.sin(t * Math.PI) * sp.scale;
        dummy.position.copy(sp.pos);
        if (camera) dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(elapsed * 2.5 + i);
        dummy.scale.setScalar(pulse);
      }
      dummy.updateMatrix();
      this.sparkleMesh.setMatrixAt(i, dummy.matrix);
    }
    this.sparkleMesh.instanceMatrix.needsUpdate = true;
  }
}
