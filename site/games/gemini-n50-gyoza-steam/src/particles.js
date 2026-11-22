import * as THREE from '../vendor/three.module.js';

// Pooled Particle System for Photorealistic Steam, Rapid Water Evaporation Droplets,
// Boiling Bubbles, Flour Dust Puffs & Crispy Hane Crumbs (low draw calls for 30+ fps mobile!)

export class KitchenParticles {
  constructor(scene, steamTexture) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();

    // 1. Billowing Steam Puffs (camera-facing soft wispy sprites — max 110)
    this.steamPool = [];
    this.steamGroup = new THREE.Group();
    this.steamGroup.renderOrder = 14;
    scene.add(this.steamGroup);

    const steamMatBase = new THREE.SpriteMaterial({
      map: steamTexture,
      color: 0xfffaf2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 110; i++) {
      const sp = new THREE.Sprite(steamMatBase.clone());
      sp.visible = false;
      this.steamGroup.add(sp);
      this.steamPool.push({
        sprite: sp,
        active: false,
        age: 0,
        life: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        startScale: 0.2,
        endScale: 0.8,
        maxOpacity: 0.35,
        trappedUnderLid: false,
        panCenter: new THREE.Vector3(),
        lidHeight: 1.0,
        lidRadius: 1.45,
      });
    }

    // 2. Rapidly Evaporating Boiling Water Droplets & Oil Splatter Micro-Particles (translucent liquid streaks!)
    const dropGeo = new THREE.SphereGeometry(0.013, 6, 5);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.02,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1.0,
      depthWrite: false,
    });
    this.dropCount = 160;
    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, this.dropCount);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dropMesh.frustumCulled = false;
    scene.add(this.dropMesh);
    this.drops = [];
    for (let i = 0; i < this.dropCount; i++) {
      this.drops.push({
        active: false,
        age: 0,
        life: 0.6,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        scale: 1,
        gravity: 5.5,
      });
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this.dummy.matrix);
    }

    // 3. Boiling Pan Foam / Sizzle Bubbles on Liquid Surface (InstancedMesh: 85)
    const bubbleGeo = new THREE.SphereGeometry(0.048, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf7ee,
      roughness: 0.12,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1.0,
    });
    this.bubbleCount = 85;
    this.bubbleMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, this.bubbleCount);
    this.bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bubbleMesh.frustumCulled = false;
    scene.add(this.bubbleMesh);
    this.bubbles = [];
    for (let i = 0; i < this.bubbleCount; i++) {
      this.bubbles.push({
        active: false,
        age: 0,
        life: 0.4,
        x: 0, y: -10, z: 0,
        maxScale: 1,
      });
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.bubbleMesh.setMatrixAt(i, this.dummy.matrix);
    }

    // 4. Crispy Golden Hane Crumbs (InstancedMesh: 60)
    const crumbGeo = new THREE.DodecahedronGeometry(0.032, 0);
    const crumbMat = new THREE.MeshStandardMaterial({
      color: 0xc97b2c,
      roughness: 0.42,
      metalness: 0.04,
    });
    this.crumbCount = 60;
    this.crumbMesh = new THREE.InstancedMesh(crumbGeo, crumbMat, this.crumbCount);
    this.crumbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crumbMesh.frustumCulled = false;
    scene.add(this.crumbMesh);
    this.crumbs = [];
    for (let i = 0; i < this.crumbCount; i++) {
      this.crumbs.push({
        active: false,
        age: 0,
        life: 1.4,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        vrx: 0, vry: 0,
        scale: 1,
        floorY: 0.1,
      });
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.crumbMesh.setMatrixAt(i, this.dummy.matrix);
    }
  }

  spawnSteam(pos, opts = {}) {
    const p = this.steamPool.find((s) => !s.active);
    if (!p) return;
    p.active = true;
    p.age = 0;
    p.life = opts.life ?? (1.1 + Math.random() * 0.9);
    p.sprite.position.copy(pos);
    p.vx = opts.vx ?? (Math.random() - 0.5) * 0.24;
    p.vy = opts.vy ?? (0.55 + Math.random() * 0.55);
    p.vz = opts.vz ?? (Math.random() - 0.5) * 0.24;
    p.startScale = opts.startScale ?? 0.26;
    p.endScale = opts.endScale ?? 1.05;
    p.maxOpacity = opts.opacity ?? 0.34;
    p.trappedUnderLid = Boolean(opts.trappedUnderLid);
    if (opts.panCenter) p.panCenter.copy(opts.panCenter);
    p.lidHeight = opts.lidHeight ?? 0.85;
    p.lidRadius = opts.lidRadius ?? 1.38;
    p.sprite.material.color.setHex(opts.color ?? 0xfffaf2);
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
  }

  // Explosive burst when water hits the hot skillet!
  spawnEvaporationBurst(panCenter, count = 28, strength = 1.0) {
    for (let i = 0; i < count; i++) {
      const d = this.drops.find((item) => !item.active);
      if (!d) break;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.15;
      d.active = true;
      d.age = 0;
      d.life = 0.35 + Math.random() * 0.45;
      d.x = panCenter.x + Math.cos(a) * r;
      d.y = panCenter.y + 0.08 + Math.random() * 0.08;
      d.z = panCenter.z + Math.sin(a) * r;
      const spd = (0.45 + Math.random() * 1.15) * strength;
      d.vx = Math.cos(a) * spd * 0.75 + (Math.random() - 0.5) * 0.4;
      d.vy = (1.3 + Math.random() * 1.9) * strength;
      d.vz = Math.sin(a) * spd * 0.75 + (Math.random() - 0.5) * 0.4;
      d.scale = 0.65 + Math.random() * 1.1;
      d.gravity = 5.4;
    }

    // Immediate dense steam eruption
    const puffs = Math.min(18, Math.ceil(count * 0.5));
    for (let i = 0; i < puffs; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.05;
      this.spawnSteam(
        new THREE.Vector3(panCenter.x + Math.cos(a) * r, panCenter.y + 0.14, panCenter.z + Math.sin(a) * r),
        {
          life: 0.9 + Math.random() * 0.85,
          vx: Math.cos(a) * (0.35 + Math.random() * 0.45),
          vy: (1.1 + Math.random() * 1.1) * strength,
          vz: Math.sin(a) * (0.35 + Math.random() * 0.45),
          startScale: 0.32,
          endScale: 1.45,
          opacity: 0.46,
        }
      );
    }
  }

  spawnBoilingBubble(panCenter, liquidY, maxRadius = 1.3) {
    const b = this.bubbles.find((item) => !item.active);
    if (!b) return;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * maxRadius;
    b.active = true;
    b.age = 0;
    b.life = 0.24 + Math.random() * 0.34;
    b.x = panCenter.x + Math.cos(a) * r;
    b.y = liquidY;
    b.z = panCenter.z + Math.sin(a) * r;
    b.maxScale = 0.55 + Math.random() * 1.45;
  }

  spawnFlourPuff(pos, count = 6) {
    for (let i = 0; i < count; i++) {
      this.spawnSteam(
        new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.22,
          pos.y + 0.04,
          pos.z + (Math.random() - 0.5) * 0.22
        ),
        {
          life: 0.5 + Math.random() * 0.35,
          vx: (Math.random() - 0.5) * 0.32,
          vy: 0.18 + Math.random() * 0.2,
          vz: (Math.random() - 0.5) * 0.32,
          startScale: 0.1,
          endScale: 0.36,
          opacity: 0.28,
          color: 0xffffff,
        }
      );
    }
  }

  spawnHaneCrumbs(pos, floorY = 0.22, count = 16) {
    for (let i = 0; i < count; i++) {
      const c = this.crumbs.find((item) => !item.active);
      if (!c) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 0.45 + Math.random() * 1.15;
      c.active = true;
      c.age = 0;
      c.life = 1.6 + Math.random() * 1.0;
      c.x = pos.x + (Math.random() - 0.5) * 0.22;
      c.y = pos.y + 0.04;
      c.z = pos.z + (Math.random() - 0.5) * 0.22;
      c.vx = Math.cos(a) * spd;
      c.vy = 0.8 + Math.random() * 1.4;
      c.vz = Math.sin(a) * spd;
      c.rx = Math.random() * Math.PI;
      c.ry = Math.random() * Math.PI;
      c.rz = Math.random() * Math.PI;
      c.vrx = (Math.random() - 0.5) * 12;
      c.vry = (Math.random() - 0.5) * 12;
      c.scale = 0.45 + Math.random() * 0.95;
      c.floorY = floorY;
    }
  }

  update(dt) {
    // 1. Update Steam Puffs
    for (const p of this.steamPool) {
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.material.rotation += dt * 0.35;

      // If trapped under domed glass lid, deflect smoothly along the curved interior ceiling!
      if (p.trappedUnderLid) {
        const dx = p.sprite.position.x - p.panCenter.x;
        const dz = p.sprite.position.z - p.panCenter.z;
        const r = Math.hypot(dx, dz);
        const normR = Math.min(1, r / p.lidRadius);
        const domeY = p.panCenter.y + 0.14 + Math.sqrt(Math.max(0.01, 1 - normR * normR)) * p.lidHeight;
        if (p.sprite.position.y > domeY) {
          p.sprite.position.y = domeY;
          p.vy *= 0.2;
          // Swirl outward/around inside the glass dome
          const ang = Math.atan2(dz, dx) + 0.8;
          p.vx += Math.cos(ang) * dt * 0.65;
          p.vz += Math.sin(ang) * dt * 0.65;
        }
        if (r > p.lidRadius * 0.92) {
          const pull = (p.lidRadius * 0.92) / r;
          p.sprite.position.x = p.panCenter.x + dx * pull;
          p.sprite.position.z = p.panCenter.z + dz * pull;
        }
      } else {
        // Free-rising steam drifts gently & decelerates
        p.vx *= 1 - dt * 0.45;
        p.vz *= 1 - dt * 0.45;
      }

      const sc = THREE.MathUtils.lerp(p.startScale, p.endScale, Math.pow(t, 0.72));
      p.sprite.scale.set(sc, sc, 1);
      const fadeIn = Math.min(1, t * 5.0);
      const fadeOut = Math.pow(1 - t, 1.35);
      p.sprite.material.opacity = p.maxOpacity * fadeIn * fadeOut;
    }

    // 2. Update Evaporating Water Droplets
    let dropDirty = false;
    for (let i = 0; i < this.dropCount; i++) {
      const d = this.drops[i];
      if (!d.active) continue;
      dropDirty = true;
      d.age += dt;
      const t = d.age / d.life;
      if (t >= 1) {
        d.active = false;
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.dropMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      d.vy -= d.gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      // Droplets shrink swiftly as they evaporate mid-air!
      const s = d.scale * (1 - t * 0.88);
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(s, s * (1 + Math.abs(d.vy) * 0.25), s);
      this.dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dropDirty) this.dropMesh.instanceMatrix.needsUpdate = true;

    // 3. Update Boiling Bubbles
    let bubbleDirty = false;
    for (let i = 0; i < this.bubbleCount; i++) {
      const b = this.bubbles[i];
      if (!b.active) continue;
      bubbleDirty = true;
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        b.active = false;
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.bubbleMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const grow = t < 0.82 ? Math.sin((t / 0.82) * Math.PI * 0.5) : Math.max(0, 1 - (t - 0.82) / 0.18);
      const s = b.maxScale * grow;
      this.dummy.position.set(b.x, b.y, b.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(s, s * 0.72, s);
      this.dummy.updateMatrix();
      this.bubbleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (bubbleDirty) this.bubbleMesh.instanceMatrix.needsUpdate = true;

    // 4. Update Crispy Hane Crumbs
    let crumbDirty = false;
    for (let i = 0; i < this.crumbCount; i++) {
      const c = this.crumbs[i];
      if (!c.active) continue;
      crumbDirty = true;
      c.age += dt;
      const t = c.age / c.life;
      if (t >= 1) {
        c.active = false;
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.crumbMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      c.vy -= 6.8 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < c.floorY) {
        c.y = c.floorY;
        c.vy *= -0.25;
        c.vx *= 0.65;
        c.vz *= 0.65;
      }
      c.rx += c.vrx * dt;
      c.ry += c.vry * dt;
      const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      const s = c.scale * fade;
      this.dummy.position.set(c.x, c.y, c.z);
      this.dummy.rotation.set(c.rx, c.ry, c.rz);
      this.dummy.scale.set(s * 1.4, s * 0.32, s);
      this.dummy.updateMatrix();
      this.crumbMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (crumbDirty) this.crumbMesh.instanceMatrix.needsUpdate = true;
  }
}
