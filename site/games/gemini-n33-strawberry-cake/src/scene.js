import * as THREE from 'three';
import { createTableclothTexture, createWallpaperTexture } from './textures.js';

// Dreamy Pastel Kawaii Toy Patisserie environment, lighting, twilight glow, and 3D particles

export class ToyPatisserieEnv {
  constructor(scene) {
    this.scene = scene;
    this.twilightAmount = 0;
    this.targetTwilight = 0;

    this.dayBg = new THREE.Color(0xfcd9ea);
    this.twilightBg = new THREE.Color(0x412e66);

    this.buntingFlags = [];
    this.twinkleStars = [];
    this.balloons = [];

    this._setupLights();
    this._buildRoom();
    this._buildParticles();
  }

  _setupLights() {
    // Balanced warm pastel studio hemisphere — keeps pastel saturation lush & 3D shading velvety!
    this.hemi = new THREE.HemisphereLight(0xfff7fa, 0xe8a8c6, 0.68);
    this.scene.add(this.hemi);

    // Key soft studio light casting clean, readable pastel shadows
    this.keyLight = new THREE.DirectionalLight(0xfff4e6, 1.18);
    this.keyLight.position.set(4.5, 8.5, 5.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 22;
    const d = 5.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.radius = 3.2;
    this.scene.add(this.keyLight);

    // Subtle pastel mint-lavender rim light
    this.rimLight = new THREE.DirectionalLight(0xc8f0ff, 0.42);
    this.rimLight.position.set(-5.2, 4.8, -3.5);
    this.scene.add(this.rimLight);

    // Warm candlelight glow over the cake (activated in Stage 4 & 5!)
    this.candleLight = new THREE.PointLight(0xffb85c, 0, 9.5, 1.45);
    this.candleLight.position.set(0, 2.75, 0.2);
    this.scene.add(this.candleLight);
  }

  _buildRoom() {
    // 1. Chunky pastel tabletop counter with scalloped front apron
    const tableGroup = new THREE.Group();
    const tableTex = createTableclothTexture();

    const tableTopMat = new THREE.MeshStandardMaterial({
      map: tableTex,
      roughness: 0.42,
      metalness: 0.02
    });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(16, 0.45, 9), tableTopMat);
    tableTop.position.set(0, -0.225, 0.4);
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    // Pastel mint countertop lip
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc2f2e0,
      roughness: 0.3,
      metalness: 0.05
    });
    const frontTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 16, 12), trimMat);
    frontTrim.rotation.z = Math.PI / 2;
    frontTrim.position.set(0, -0.05, 4.9);
    tableGroup.add(frontTrim);

    // Soft pastel circular lace doily under the cake stand
    const doilyGroup = new THREE.Group();
    const doilyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0
    });
    const doilyDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.02, 32), doilyMat);
    doilyDisc.position.y = 0.01;
    doilyDisc.receiveShadow = true;
    doilyGroup.add(doilyDisc);

    // Cute scalloped lace petals around doily edge
    const petalGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.018, 12);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const p = new THREE.Mesh(petalGeo, doilyMat);
      p.position.set(Math.cos(a) * 2.12, 0.009, Math.sin(a) * 2.12);
      p.receiveShadow = true;
      doilyGroup.add(p);
    }
    tableGroup.add(doilyGroup);
    this.scene.add(tableGroup);

    // 2. Cozy pastel patisserie back wall
    const wallTex = createWallpaperTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.72,
      metalness: 0
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), wallMat);
    wall.position.set(0, 4.4, -4.4);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Pastel mint wainscoting lower panel (creates crisp contrast behind cake & character!)
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0xc9f0e2,
      roughness: 0.48
    });
    const wainscot = new THREE.Mesh(new THREE.BoxGeometry(24, 2.35, 0.2), wainscotMat);
    wainscot.position.set(0, 0.65, -4.25);
    this.scene.add(wainscot);

    // Cute white cream chair-rail molding between wainscoting and striped wallpaper
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.14, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xfffaf6, roughness: 0.35 })
    );
    rail.position.set(0, 1.85, -4.2);
    this.scene.add(rail);

    // 3. Soft scalloped patisserie awning high in the background
    const awningGroup = new THREE.Group();
    awningGroup.position.set(0, 4.95, -3.7);
    const awningColors = [0xffb7d2, 0xfff8f2, 0xc3f2e2, 0xfff8f2, 0xffe49e, 0xfff8f2, 0xd9c2ff, 0xfff8f2];
    const segGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.9, 14, 1, false, 0, Math.PI);
    for (let i = -6; i <= 6; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: awningColors[Math.abs(i + 12) % awningColors.length],
        roughness: 0.35
      });
      const scallop = new THREE.Mesh(segGeo, mat);
      scallop.rotation.z = Math.PI / 2;
      scallop.rotation.y = Math.PI / 2;
      scallop.position.set(i * 1.08, 0, 0);
      awningGroup.add(scallop);
    }
    this.scene.add(awningGroup);

    // 4. Pastel bunting garland strung softly across upper background
    const flagColors = [0xff9ec5, 0xffe58f, 0xb2f0da, 0xd5bfff, 0xffb899];
    const flagGeo = new THREE.ConeGeometry(0.24, 0.42, 3);
    for (let i = -5; i <= 5; i++) {
      const x = i * 0.85;
      const y = 4.65 - Math.cos((i / 5) * Math.PI * 0.5) * 0.48;
      const mat = new THREE.MeshStandardMaterial({
        color: flagColors[Math.abs(i + 10) % flagColors.length],
        roughness: 0.38
      });
      const flag = new THREE.Mesh(flagGeo, mat);
      flag.position.set(x, y, -3.2);
      flag.rotation.z = Math.PI;
      flag.userData.baseRotX = 0;
      flag.userData.phase = i * 0.6;
      this.buntingFlags.push(flag);
      this.scene.add(flag);
    }

    // 5. Soft background pastel shelves with subtle macaron jars (Tier D atmosphere — never competes)
    this._buildShelfDecor(-4.2, 2.35, -3.95);
    this._buildShelfDecor(4.2, 2.35, -3.95);

    // 6. Twinkling dreamy stars (glow gently during twilight candlelight!)
    const starGeo = new THREE.OctahedronGeometry(0.14, 0);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xfff3a8 : 0xffd1ec,
        transparent: true,
        opacity: 0
      });
      const star = new THREE.Mesh(starGeo, mat);
      star.position.set(
        (Math.random() - 0.5) * 10,
        2.4 + Math.random() * 3.0,
        -3.1 - Math.random() * 0.8
      );
      star.userData.phase = Math.random() * Math.PI * 2;
      this.twinkleStars.push(star);
      this.scene.add(star);
    }
  }

  _buildShelfDecor(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xfff8fa, roughness: 0.36 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 0.65), shelfMat);
    g.add(plank);

    // Cute pastel macaron stack (pure soft toy silhouette)
    const macColors = [0xffb4d0, 0xffe69c, 0xbaf2de];
    const macGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14);
    macColors.forEach((col, i) => {
      const m = new THREE.Mesh(macGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.42 }));
      m.position.set(-0.55, 0.14 + i * 0.15, 0);
      g.add(m);
    });

    // Cute pastel candy jar
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.55, 14),
      new THREE.MeshStandardMaterial({ color: 0xe9ddff, roughness: 0.2, metalness: 0.05 })
    );
    jar.position.set(0.55, 0.34, 0);
    g.add(jar);
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffb3cf, roughness: 0.25 })
    );
    lid.position.set(0.55, 0.66, 0);
    g.add(lid);

    this.scene.add(g);
  }

  _buildParticles() {
    this.particles = [];
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.sphereGeo = new THREE.SphereGeometry(0.08, 8, 6);
    this.starGeo = new THREE.OctahedronGeometry(0.1, 0);
    this.confettiGeo = new THREE.BoxGeometry(0.11, 0.025, 0.11);
    this.heartGeo = this._makeHeartGeo();
    this.balloonGeo = new THREE.SphereGeometry(0.38, 16, 14);

    this.pastelPalette = [0xff9ec6, 0xffe28a, 0xaef0d8, 0xd4bcff, 0xffb79a, 0xffffff];
  }

  _makeHeartGeo() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.09);
    shape.bezierCurveTo(0.12, 0.02, 0.13, 0.14, 0.05, 0.15);
    shape.bezierCurveTo(0.01, 0.16, 0, 0.11, 0, 0.09);
    shape.bezierCurveTo(0, 0.11, -0.01, 0.16, -0.05, 0.15);
    shape.bezierCurveTo(-0.13, 0.14, -0.12, 0.02, 0, -0.09);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 8 });
  }

  spawnBurst(pos, count = 12, kind = 'star', customColor = null) {
    for (let i = 0; i < count; i++) {
      let geo = this.starGeo;
      if (kind === 'cream') geo = this.sphereGeo;
      else if (kind === 'confetti') geo = this.confettiGeo;
      else if (kind === 'heart') geo = this.heartGeo;
      else if (kind === 'smoke') geo = this.sphereGeo;

      const color = customColor !== null
        ? customColor
        : (kind === 'cream' ? 0xfffaf4 : kind === 'smoke' ? 0xf6ecff : this.pastelPalette[i % this.pastelPalette.length]);

      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: kind === 'star' || kind === 'heart' ? color : 0x000000,
        emissiveIntensity: kind === 'star' ? 0.35 : kind === 'heart' ? 0.22 : 0,
        roughness: 0.3,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      if (kind === 'confetti') {
        mesh.position.x += (Math.random() - 0.5) * 2.2;
        mesh.position.y += Math.random() * 0.6;
      }

      const angle = Math.random() * Math.PI * 2;
      const speed = kind === 'smoke' ? 0.4 + Math.random() * 0.4
        : kind === 'heart' ? 0.6 + Math.random() * 0.7
        : kind === 'confetti' ? 1.2 + Math.random() * 2.2
        : 1.0 + Math.random() * 1.9;

      const vy = kind === 'smoke' ? 1.1 + Math.random() * 0.7
        : kind === 'heart' ? 1.6 + Math.random() * 0.9
        : kind === 'confetti' ? 2.8 + Math.random() * 2.4
        : 1.4 + Math.random() * 1.8;

      const scale = kind === 'cream' ? 0.65 + Math.random() * 0.5
        : kind === 'smoke' ? 0.8 + Math.random() * 0.6
        : 0.75 + Math.random() * 0.65;
      mesh.scale.setScalar(scale);

      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * speed, vy, Math.sin(angle) * speed),
        rotVel: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5),
        gravity: kind === 'smoke' ? -0.35 : kind === 'heart' ? -0.25 : kind === 'confetti' ? 2.6 : 4.2,
        life: 0,
        maxLife: kind === 'confetti' ? 2.2 + Math.random() * 1.0 : kind === 'heart' ? 1.35 : 0.75 + Math.random() * 0.45,
        kind
      });
    }
  }

  // Cute breath wind puffs flowing from girl's mouth across the candles
  spawnWindRibbon(origin, target) {
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat);
      mesh.position.copy(origin).addScaledVector(dir, i * 0.14);
      mesh.position.x += (Math.random() - 0.5) * 0.25;
      mesh.position.y += (Math.random() - 0.5) * 0.18;
      mesh.scale.set(1.2, 0.7, 1.5);
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vel: dir.clone().multiplyScalar(3.2 + Math.random() * 1.4),
        rotVel: new THREE.Vector3(0, 0, 3),
        gravity: -0.2,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.2,
        kind: 'wind'
      });
    }
  }

  // Celebration pastel floating balloons!
  spawnCelebrationBalloons() {
    this.clearBalloons();
    const cols = [0xffa3c8, 0xffe48f, 0xb2f2dd, 0xd8c2ff, 0xffbe99, 0xa8e0ff];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: cols[i % cols.length],
        roughness: 0.2,
        metalness: 0.05
      });
      const body = new THREE.Mesh(this.balloonGeo, mat);
      body.scale.set(1, 1.16, 1);
      g.add(body);
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      string.position.y = -0.9;
      g.add(string);

      const side = i % 2 === 0 ? -1 : 1;
      g.position.set(
        side * (2.25 + (i % 3) * 0.65),
        1.6 + (i * 0.42),
        -2.2 - (i % 2) * 0.7
      );
      g.userData = {
        speed: 0.75 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        baseX: g.position.x
      };
      this.balloons.push(g);
      this.scene.add(g);
    }
  }

  clearBalloons() {
    for (const b of this.balloons) {
      this.scene.remove(b);
    }
    this.balloons.length = 0;
  }

  setTwilight(level, instant = false) {
    this.targetTwilight = Math.max(0, Math.min(1, level));
    if (instant) {
      this.twilightAmount = this.targetTwilight;
    }
  }

  update(dt, time, litCandleCount = 0) {
    // Smooth dreamy twilight transition when birthday candles glow
    this.twilightAmount += (this.targetTwilight - this.twilightAmount) * Math.min(1, dt * 2.5);
    const t = this.twilightAmount;
    this.scene.background.lerpColors(this.dayBg, this.twilightBg, t);

    this.hemi.intensity = THREE.MathUtils.lerp(0.68, 0.22, t);
    this.keyLight.intensity = THREE.MathUtils.lerp(1.18, 0.22, t);
    this.rimLight.intensity = THREE.MathUtils.lerp(0.42, 0.26, t);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.45, 0.14, t);

    // Warm dancing candlelight glow
    const targetCandleIntensity = litCandleCount > 0 ? 2.4 + litCandleCount * 0.62 : 0;
    const flicker = Math.sin(time * 13.5) * 0.16 + Math.cos(time * 21.0) * 0.08;
    const desired = targetCandleIntensity > 0 ? targetCandleIntensity + flicker : 0;
    this.candleLight.intensity += (desired - this.candleLight.intensity) * Math.min(1, dt * 8);

    // Gentle bunting sway
    for (const flag of this.buntingFlags) {
      flag.rotation.x = Math.sin(time * 1.6 + flag.userData.phase) * 0.08;
    }

    // Twinkle stars in twilight
    for (const s of this.twinkleStars) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.0 + s.userData.phase);
      s.material.opacity = t * (0.35 + pulse * 0.65);
      s.rotation.y = time * 0.8 + s.userData.phase;
      s.scale.setScalar(0.75 + pulse * 0.45);
    }

    // Float celebration balloons
    for (const b of this.balloons) {
      b.position.y += b.userData.speed * dt;
      b.position.x = b.userData.baseX + Math.sin(time * 1.4 + b.userData.phase) * 0.25;
      if (b.position.y > 7.5) {
        b.position.y = -1.6;
      }
    }

    // Update 3D particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      if (p.kind === 'confetti') {
        p.vel.x *= 0.985;
        p.vel.z *= 0.985;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      const u = p.life / p.maxLife;
      if (p.kind === 'smoke' || p.kind === 'wind') {
        p.mesh.scale.multiplyScalar(1 + dt * 1.1);
        p.mesh.material.opacity = (1 - u) * 0.75;
      } else if (u > 0.65) {
        const fade = 1 - (u - 0.65) / 0.35;
        p.mesh.material.opacity = Math.max(0, fade);
      }
    }
  }
}
