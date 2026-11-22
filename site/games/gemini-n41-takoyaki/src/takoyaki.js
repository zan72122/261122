import * as THREE from 'three';
import {
  createTakoyakiTextures,
  createSteamSpriteTexture
} from './textures.js';
import { WELL_OFFSETS, WELL_RADIUS, PLATE_Y } from './scene.js';

const COLOR_RAW = new THREE.Color(0xf8ecc8);     // Glossy pale cream batter
const COLOR_BLONDE = new THREE.Color(0xe3b868);  // Setting warm golden blonde
const COLOR_GOLDEN = new THREE.Color(0xc27b30);  // Authentic crispy golden-brown Japanese takoyaki
const COLOR_DEEP = new THREE.Color(0x8a4c1b);    // Rich toasty savory crust

// Reusable color scratch objects
const _cTmp = new THREE.Color();
const _cTop = new THREE.Color();
const _cBot = new THREE.Color();

// Single takoyaki well with physically evolving PBR dough, visible octopus/negi,
// dynamic glossy sauce glaze, optional mayo + aonori, and 14 dancing katsuobushi flakes!
export class TakoyakiBall {
  constructor(index, wellOffset, sharedAssets, scene) {
    this.index = index;
    this.homePos = new THREE.Vector3(wellOffset.x, PLATE_Y - 0.004, wellOffset.z);

    this.root = new THREE.Group();
    this.root.position.copy(this.homePos);
    scene.add(this.root);

    // State machine (strictly continuous physical properties, zero failure!)
    this.reset();

    // 1. Deformable Takoyaki Sphere Mesh (with per-vertex dynamic browning colors!)
    this.ballGeo = new THREE.SphereGeometry(WELL_RADIUS * 0.97, 26, 20);
    const count = this.ballGeo.attributes.position.count;
    this.basePositions = new Float32Array(this.ballGeo.attributes.position.array);
    const colors = new Float32Array(count * 3);
    colors.fill(1);
    this.ballGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.ballMat = new THREE.MeshPhysicalMaterial({
      map: sharedAssets.takoTex.map,
      normalMap: sharedAssets.takoTex.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughnessMap: sharedAssets.takoTex.roughnessMap,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      vertexColors: true,
      envMapIntensity: 1.25
    });

    this.ballPivot = new THREE.Group();
    this.root.add(this.ballPivot);

    this.ballMesh = new THREE.Mesh(this.ballGeo, this.ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.receiveShadow = true;
    this.ballMesh.userData.wellIndex = index;
    this.ballPivot.add(this.ballMesh);

    // 2. Overflow batter lacy skirt on the iron rim (visible when pouring generously, tucks in on flip!)
    const skirtGeo = new THREE.RingGeometry(WELL_RADIUS * 0.82, WELL_RADIUS * 1.38, 22);
    skirtGeo.rotateX(-Math.PI / 2);
    // Slight organic wavy outer edge
    const sp = skirtGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const sx = sp.getX(i);
      const sz = sp.getZ(i);
      const r = Math.hypot(sx, sz);
      if (r > WELL_RADIUS * 1.05) {
        const ang = Math.atan2(sz, sx);
        const wave = 1 + Math.sin(ang * 5 + index * 2.1) * 0.12 + Math.cos(ang * 3 - index) * 0.08;
        sp.setX(i, sx * wave);
        sp.setZ(i, sz * wave);
      }
    }
    this.skirtMat = new THREE.MeshPhysicalMaterial({
      color: COLOR_RAW.clone(),
      roughness: 0.22,
      clearcoat: 0.65,
      side: THREE.DoubleSide
    });
    this.skirtMesh = new THREE.Mesh(skirtGeo, this.skirtMat);
    this.skirtMesh.position.y = 0.0055;
    this.skirtMesh.visible = false;
    this.root.add(this.skirtMesh);

    // 3. Octopus chunks & green negi tucked right into the dough!
    this.octoGroup = new THREE.Group();
    this.ballPivot.add(this.octoGroup);

    this.octoMeshes = [];
    for (let i = 0; i < 2; i++) {
      const ch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.0115, 1), sharedAssets.octoMat);
      ch.position.set(i === 0 ? 0.002 : -0.008, 0.008 + i * 0.003, i === 0 ? 0.001 : 0.007);
      ch.scale.set(1.15, 0.85, 1.05);
      ch.rotation.set(i * 1.4, index * 0.8, 0.4);
      ch.visible = false;
      this.octoGroup.add(ch);
      this.octoMeshes.push(ch);
    }

    // Green negi flecks & red beni-shoga specks scattered on top of wet batter
    this.negiMeshes = [];
    for (let i = 0; i < 6; i++) {
      const isGinger = i === 5;
      const mat = isGinger ? sharedAssets.gingerMat : sharedAssets.negiMat;
      const m = new THREE.Mesh(
        isGinger ? new THREE.BoxGeometry(0.004, 0.0016, 0.007) : new THREE.TorusGeometry(0.0032, 0.0012, 5, 8),
        mat
      );
      const ang = (i / 6) * Math.PI * 2 + index;
      m.position.set(Math.cos(ang) * 0.013, 0.008, Math.sin(ang) * 0.013);
      m.rotation.set(Math.PI * 0.5, 0, ang);
      m.visible = false;
      this.octoGroup.add(m);
      this.negiMeshes.push(m);
    }

    // 4. Glossy Dark Takoyaki Sauce Cap (sized outside ball cleanly so rich dark mahogany glaze never clips!)
    this.toppingGroup = new THREE.Group();
    this.root.add(this.toppingGroup);

    const sauceGeo = new THREE.SphereGeometry(WELL_RADIUS * 1.042, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.39);
    // Organic drippy sauce hem
    const sap = sauceGeo.attributes.position;
    for (let i = 0; i < sap.count; i++) {
      const x = sap.getX(i);
      const y = sap.getY(i);
      const z = sap.getZ(i);
      if (y < WELL_RADIUS * 0.45) {
        const ang = Math.atan2(z, x);
        const drip = Math.sin(ang * 6 + index * 1.7) * 0.0038 + Math.cos(ang * 4) * 0.0025;
        sap.setY(i, y - drip);
      }
    }
    sauceGeo.computeVertexNormals();
    this.sauceMat = new THREE.MeshPhysicalMaterial({
      color: 0x260c03,
      roughness: 0.05,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.1,
      transparent: true,
      opacity: 0.98
    });
    this.sauceMesh = new THREE.Mesh(sauceGeo, this.sauceMat);
    this.sauceMesh.visible = false;
    this.sauceMesh.userData.wellIndex = index;
    this.toppingGroup.add(this.sauceMesh);

    // 5. Creamy Mayo Zigzag Lattice + Emerald Aonori Seaweed Flecks (bonus 2nd sauce squeeze!)
    this.mayoGroup = new THREE.Group();
    this.mayoGroup.visible = false;
    this.toppingGroup.add(this.mayoGroup);

    const mayoMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf0cc,
      roughness: 0.22,
      clearcoat: 0.65
    });
    for (let s = -2; s <= 2; s++) {
      const pts = [];
      for (let t = -4; t <= 4; t++) {
        const x = (t / 4) * WELL_RADIUS * 0.72;
        const z = s * 0.0072 + Math.sin(t * 1.2) * 0.0012;
        const r2 = WELL_RADIUS * WELL_RADIUS * 1.13 - x * x - z * z;
        if (r2 > 0.00004) {
          pts.push(new THREE.Vector3(x, Math.sqrt(r2), z));
        }
      }
      if (pts.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.0016, 6, false), mayoMat);
        this.mayoGroup.add(tube);
      }
    }
    // Emerald aonori specks
    const aonoriMat = new THREE.MeshStandardMaterial({ color: 0x1e5c24, roughness: 0.85 });
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996 + index;
      const r = Math.sqrt(i / 16) * WELL_RADIUS * 0.72;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sqrt(Math.max(0.0001, WELL_RADIUS * WELL_RADIUS * 1.15 - x * x - z * z));
      const speck = new THREE.Mesh(new THREE.PlaneGeometry(0.0028, 0.0019), aonoriMat);
      speck.position.set(x, y, z);
      speck.lookAt(x * 2, y * 2, z * 2);
      this.mayoGroup.add(speck);
    }

    // 6. 14 DANCING KATSUOBUSHI (BONITO) FLAKES anchored cleanly to top of ball!
    this.katsuoGroup = new THREE.Group();
    this.toppingGroup.add(this.katsuoGroup);
    this.flakes = [];
    for (let i = 0; i < 14; i++) {
      const fGeo = new THREE.PlaneGeometry(0.015, 0.028, 1, 5);
      fGeo.translate(0, 0.014, 0);
      const baseArr = new Float32Array(fGeo.attributes.position.array);
      const flake = new THREE.Mesh(fGeo, sharedAssets.katsuoFlakeMat);
      const a = (i / 14) * Math.PI * 2 + index * 0.7;
      const rad = (0.12 + (i % 3) * 0.24) * WELL_RADIUS * 0.82;
      const fx = Math.cos(a) * rad;
      const fz = Math.sin(a) * rad;
      const fy = Math.sqrt(Math.max(0.0001, WELL_RADIUS * WELL_RADIUS * 1.12 - fx * fx - fz * fz));

      const basePos = new THREE.Vector3(fx, fy - 0.0015, fz);
      flake.position.copy(basePos);
      flake.rotation.set(0.28 + (i % 4) * 0.16, a + (i % 2) * 1.1, (i % 3 - 1) * 0.35);
      flake.visible = false;
      this.katsuoGroup.add(flake);

      this.flakes.push({
        mesh: flake,
        geo: fGeo,
        baseArr,
        basePos,
        phase: i * 1.37 + index * 2.1,
        speed: 2.3 + (i % 5) * 0.55,
        curlAmp: 0.0068 + (i % 3) * 0.0028,
        fallProgress: 0
      });
    }

    // Invisible generous touch hitbox cylinder covering the well (for effortless 5-year-old tapping!)
    const hitGeo = new THREE.CylinderGeometry(WELL_RADIUS * 1.28, WELL_RADIUS * 1.28, 0.045, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitbox = new THREE.Mesh(hitGeo, hitMat);
    this.hitbox.position.y = 0.016;
    this.hitbox.userData.wellIndex = index;
    this.root.add(this.hitbox);

    this.root.visible = false;
    this.hitbox.visible = true; // Keep raycastable even when empty!
  }

  reset() {
    this.stage = 'empty'; // empty -> batter -> octopus -> cooking -> half_flipped -> round -> sauced -> topped -> plated / carried
    this.fillLevel = 0;       // 0..1.35 (over 1.0 creates fun crispy overflow skirt!)
    this.octopusCount = 0;    // 0, 1, or 2 (double-octopus jumbo discovery!)
    this.cookBottom = 0;      // 0..1 Maillard browning of underside
    this.cookTop = 0;         // 0..1 Maillard browning of upper hemisphere
    this.roundness = 0;       // 0 = flat liquid well pool, 1 = plump spherical ball
    this.flipCount = 0;       // 0, 1 (half-turned), 2+ (fully round, can keep spinning!)
    this.sauceLevel = 0;      // 0 -> 1 (dark sauce) -> 2 (mayo + aonori!)
    this.katsuoAmount = 0;    // 0..1
    this.steamWind = 0;       // Extra flurry when blown or swiped!
    this.rotX = 0;
    this.targetRotX = 0;
    this.rotZ = 0;
    this.targetRotZ = 0;
    this.spinVel = 0;
    this.bounce = 0;
    this.isOnPlate = false;
    this.isCarried = false;
    this.plateSlot = -1;
    this.root.position.copy(this.homePos);
    this.root.scale.set(1, 1, 1);

    if (this.ballMesh) {
      this.ballMesh.visible = false;
      this.skirtMesh.visible = false;
      this.sauceMesh.visible = false;
      this.mayoGroup.visible = false;
      this.octoMeshes.forEach(m => (m.visible = false));
      this.negiMeshes.forEach(m => (m.visible = false));
      this.flakes.forEach(f => { f.mesh.visible = false; f.fallProgress = 0; });
    }
  }

  pourBatter(amount = 1.0) {
    if (this.isOnPlate || this.isCarried) return false;
    if (this.flipCount > 0) return false;
    this.root.visible = true;
    this.ballMesh.visible = true;
    this.fillLevel = Math.min(1.38, this.fillLevel + amount);
    if (this.stage === 'empty') {
      this.stage = 'batter';
    }
    this.bounce = 0.35;
    if (this.fillLevel > 1.02) {
      this.skirtMesh.visible = true;
    }
    return true;
  }

  addOctopus() {
    if (this.isOnPlate || this.isCarried) return false;
    if (this.fillLevel < 0.3 || this.flipCount >= 2) return false;
    if (this.octopusCount >= 2) return false;
    this.octopusCount++;
    this.octoMeshes[this.octopusCount - 1].visible = true;
    this.negiMeshes.forEach(m => (m.visible = true));
    if (this.stage === 'batter') this.stage = 'octopus';
    this.bounce = 0.55;
    return true;
  }

  flip(dirX = 1, dirZ = 0) {
    if (this.isOnPlate || this.isCarried) return false;
    if (this.fillLevel < 0.3) return false;

    this.flipCount++;
    // First flip: big 145 deg roll (shows seared golden half + wet batter pouring below!)
    // Second flip: full 360 deg smooth tuck into plump sphere!
    // Further flips: fun takoyaki-master spinning!
    const angleStep = this.flipCount === 1 ? Math.PI * 0.78 : Math.PI * 0.92;
    this.targetRotX += angleStep * (dirZ >= 0 ? 1 : -1);
    this.targetRotZ += (Math.random() - 0.5) * 0.55 + dirX * 0.25;
    this.spinVel = 2.6;
    this.bounce = 0.7;

    // Tuck overflow skirt cleanly into the round ball on flip!
    if (this.flipCount >= 1) {
      this.skirtMesh.visible = false;
    }
    // Give immediate satisfying golden-brown visual lift so child feels instant mastery
    if (this.flipCount === 1) {
      this.cookBottom = Math.max(this.cookBottom, 0.58);
      this.stage = 'half_flipped';
    } else {
      this.cookBottom = Math.max(this.cookBottom, 0.88);
      this.cookTop = Math.max(this.cookTop, 0.78);
      if (this.stage !== 'sauced' && this.stage !== 'topped') {
        this.stage = 'round';
      }
    }
    return true;
  }

  addSauce() {
    if (this.flipCount < 1 && this.fillLevel < 0.5) return false;
    // Allow saucing once flipped/round (or even half-flipped if a curious kid tries!)
    if (this.sauceLevel === 0) {
      this.sauceLevel = 1;
      this.sauceMesh.visible = true;
      this.sauceMesh.scale.set(0.3, 0.3, 0.3);
      if (this.stage !== 'topped') this.stage = 'sauced';
      this.bounce = 0.35;
      return 'sauce';
    } else if (this.sauceLevel === 1) {
      this.sauceLevel = 2;
      this.mayoGroup.visible = true;
      this.mayoGroup.scale.set(0.2, 0.2, 0.2);
      this.bounce = 0.35;
      return 'mayo';
    }
    this.bounce = 0.2;
    return 'extra';
  }

  addKatsuobushi() {
    if (this.flipCount < 1) return false;
    const isFirst = this.katsuoAmount < 0.5;
    this.katsuoAmount = Math.min(1.5, this.katsuoAmount + 0.85);
    this.stage = 'topped';
    this.steamWind = 1.4;
    this.flakes.forEach((f, idx) => {
      if (idx < (this.katsuoAmount > 1.0 ? 14 : 10)) {
        f.mesh.visible = true;
        if (f.fallProgress === 0) f.fallProgress = 0.01;
      }
    });
    this.bounce = 0.32;
    return isFirst ? 'first' : 'more';
  }

  blowSteam() {
    this.steamWind = 2.5;
  }

  isReadyToServe() {
    return this.flipCount >= 2 && (this.sauceLevel >= 1 || this.katsuoAmount > 0);
  }

  isCookedEnoughToFlip() {
    return this.fillLevel >= 0.4 && this.cookBottom >= 0.22;
  }

  update(dt, time, particleSystem) {
    if (this.stage === 'empty') return;

    // 1. Continuous cooking progression while sitting in the sizzling iron well
    if (!this.isOnPlate && !this.isCarried) {
      const heatRate = 0.21; // Snappy 5-year-old friendly pace (~2.5-3.5s per side)
      if (this.flipCount === 0) {
        this.cookBottom = Math.min(1.0, this.cookBottom + dt * heatRate);
      } else if (this.flipCount === 1) {
        this.cookBottom = Math.min(1.0, this.cookBottom + dt * heatRate * 0.4);
        this.cookTop = Math.min(1.0, this.cookTop + dt * heatRate * 1.15);
      } else {
        this.cookBottom = Math.min(1.0, this.cookBottom + dt * heatRate * 0.6);
        this.cookTop = Math.min(1.0, this.cookTop + dt * heatRate * 0.8);
      }
    }

    // Smooth roundness morphing: flat batter pool -> half-turned -> plump sphere
    const targetRound = this.flipCount === 0 ? 0.08 : this.flipCount === 1 ? 0.68 : 1.0;
    this.roundness += (targetRound - this.roundness) * Math.min(1, dt * 6.5);

    // Smooth bounce & flip rotation
    this.bounce = Math.max(0, this.bounce - dt * 3.8);
    this.rotX += (this.targetRotX - this.rotX) * Math.min(1, dt * 10);
    this.rotZ += (this.targetRotZ - this.rotZ) * Math.min(1, dt * 10);
    this.steamWind = Math.max(0, this.steamWind - dt * 1.1);

    const jumboScale = this.octopusCount >= 2 ? 1.12 : 1.0;
    const bounceSquash = Math.sin(this.bounce * Math.PI * 2) * 0.08 * this.bounce;
    const fillScale = Math.min(1.04, 0.35 + this.fillLevel * 0.68);
    this.ballPivot.rotation.set(this.rotX, 0, this.rotZ);
    this.ballPivot.scale.set(
      fillScale * jumboScale * (1 + bounceSquash),
      fillScale * jumboScale * (1 - bounceSquash * 0.7),
      fillScale * jumboScale * (1 + bounceSquash)
    );

    // Deform vertices: raw batter sits flat on top surface of well & gently bubbles; cooked ball swells round!
    const pos = this.ballGeo.attributes.position;
    const col = this.ballGeo.attributes.color;
    const flatBlend = 1 - this.roundness;
    const avgCook = (this.cookBottom + this.cookTop) * 0.5;

    // Interpolate bottom & top Maillard browning colors
    _cBot.copy(COLOR_RAW);
    if (this.cookBottom < 0.45) _cBot.lerp(COLOR_BLONDE, this.cookBottom / 0.45);
    else if (this.cookBottom < 0.82) _cBot.copy(COLOR_BLONDE).lerp(COLOR_GOLDEN, (this.cookBottom - 0.45) / 0.37);
    else _cBot.copy(COLOR_GOLDEN).lerp(COLOR_DEEP, (this.cookBottom - 0.82) / 0.18);

    _cTop.copy(COLOR_RAW);
    if (this.cookTop < 0.45) _cTop.lerp(COLOR_BLONDE, this.cookTop / 0.45);
    else if (this.cookTop < 0.82) _cTop.copy(COLOR_BLONDE).lerp(COLOR_GOLDEN, (this.cookTop - 0.45) / 0.37);
    else _cTop.copy(COLOR_GOLDEN).lerp(COLOR_DEEP, (this.cookTop - 0.82) / 0.18);

    for (let i = 0; i < pos.count; i++) {
      const bx = this.basePositions[i * 3];
      const by = this.basePositions[i * 3 + 1];
      const bz = this.basePositions[i * 3 + 2];

      let y = by;
      // Flatten upper dome while raw batter fills the concave cast-iron well
      if (by > 0.002 && flatBlend > 0.01) {
        const bubble = Math.sin(bx * 180 + time * 7.5 + this.index) * Math.cos(bz * 180 - time * 6.2) * 0.0014 * (1 - avgCook);
        const flatY = 0.004 + bubble;
        y = by * (1 - flatBlend) + flatY * flatBlend;
      }
      pos.setXYZ(i, bx, y, bz);

      // Blend bottom vs top cooked color smoothly across equator
      const t = Math.max(0, Math.min(1, (by / WELL_RADIUS) * 0.65 + 0.5));
      _cTmp.copy(_cBot).lerp(_cTop, t);
      col.setXYZ(i, _cTmp.r, _cTmp.g, _cTmp.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // Dynamic PBR sheen & crust micro-roughness (glossy raw batter -> crispy oiled golden crust!)
    this.ballMat.roughness = 0.16 + avgCook * 0.32;
    this.ballMat.clearcoat = 0.88 - avgCook * 0.48; // Still keeps realistic hot-oil sheen at 0.40!
    this.ballMat.normalScale.setScalar(0.2 + avgCook * 0.95);

    // Overflow batter skirt browns crisply at the edges too!
    if (this.skirtMesh.visible) {
      this.skirtMat.color.copy(COLOR_RAW).lerp(COLOR_GOLDEN, Math.min(1, this.cookBottom * 1.15));
      this.skirtMat.roughness = 0.22 + this.cookBottom * 0.38;
    }

    // Match topping group scale cleanly to ball scale so sauce/mayo/katsuo sit flush on crust!
    const topTargetScale = fillScale * jumboScale;
    this.toppingGroup.scale.set(
      topTargetScale * (1 + bounceSquash),
      topTargetScale * (1 - bounceSquash * 0.7),
      topTargetScale * (1 + bounceSquash)
    );

    // Smooth sauce & mayo bloom-in animation
    if (this.sauceMesh.visible) {
      const s = this.sauceMesh.scale.x + (1.0 - this.sauceMesh.scale.x) * Math.min(1, dt * 8);
      this.sauceMesh.scale.setScalar(s);
    }
    if (this.mayoGroup.visible) {
      const ms = this.mayoGroup.scale.x + (1.0 - this.mayoGroup.scale.x) * Math.min(1, dt * 8);
      this.mayoGroup.scale.setScalar(ms);
    }

    // 7. ANIMATE DANCING KATSUOBUSHI (ゆらゆら踊る鰹節 — anchored strictly on top of each ball!)
    if (this.katsuoAmount > 0) {
      const heatDance = (this.isOnPlate ? 0.85 : 1.25) + this.steamWind * 0.9;
      for (const f of this.flakes) {
        if (!f.mesh.visible) continue;
        if (f.fallProgress < 1) {
          f.fallProgress = Math.min(1, f.fallProgress + dt * 2.6);
        }
        // Absolute position relative to basePos (NEVER accumulates upward!)
        f.mesh.position.set(
          f.basePos.x,
          f.basePos.y + Math.pow(1 - f.fallProgress, 2) * 0.032,
          f.basePos.z
        );
        f.mesh.scale.setScalar(0.55 + f.fallProgress * 0.45);
        const fPos = f.geo.attributes.position;
        const base = f.baseArr;
        for (let k = 0; k < fPos.count; k++) {
          const bx = base[k * 3];
          const by = base[k * 3 + 1];
          const bz = base[k * 3 + 2];
          const flex = (by / 0.028);
          const flex2 = flex * flex;
          const wave1 = Math.sin(time * f.speed + f.phase + flex * 2.6);
          const wave2 = Math.cos(time * (f.speed * 1.65) + f.phase * 1.7 + flex * 3.1);
          const curlZ = bz + (wave1 * 0.65 + wave2 * 0.35) * f.curlAmp * flex2 * heatDance;
          const swayX = bx + wave2 * f.curlAmp * 0.55 * flex2 * heatDance;
          const liftY = by - Math.abs(curlZ) * 0.25;
          fPos.setXYZ(k, swayX, liftY, curlZ);
        }
        fPos.needsUpdate = true;
      }
    }

    // 8. Spawn rising steam puffs & occasional glistening oil pops while cooking!
    if (particleSystem && !this.isCarried) {
      const steamChance = this.isOnPlate ? 0.055 : (0.09 + this.cookBottom * 0.08 + (this.flipCount > 0 ? 0.05 : 0));
      if (Math.random() < steamChance * dt * 60) {
        const worldPos = this.root.position;
        particleSystem.spawnSteam(
          worldPos.x + (Math.random() - 0.5) * 0.025,
          worldPos.y + 0.024,
          worldPos.z + (Math.random() - 0.5) * 0.025,
          this.isOnPlate ? 0.75 : 1.0,
          this.steamWind
        );
      }
      if (!this.isOnPlate && Math.random() < (0.045 + (1 - avgCook) * 0.06) * dt * 60) {
        const w = this.root.position;
        particleSystem.spawnOilDrop(
          w.x + (Math.random() - 0.5) * 0.036,
          PLATE_Y + 0.004,
          w.z + (Math.random() - 0.5) * 0.036,
          0.55
        );
      }
    }
  }
}

// High-performance GPU-friendly Steam Plumes + Oil Splatter Droplets particle system
export class CookingParticles {
  constructor(scene) {
    this.steamTex = createSteamSpriteTexture();

    // 1. Soft backlit volumetric steam sprites in dedicated group (hidden during SSAO pass so ZERO ghost quads!)
    this.steamGroup = new THREE.Group();
    scene.add(this.steamGroup);
    this.maxSteam = 46;
    this.steamPool = [];
    for (let i = 0; i < this.maxSteam; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.steamTex,
        color: new THREE.Color(0xfff1dc),
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.steamGroup.add(sp);
      this.steamPool.push({
        sprite: sp,
        mat,
        life: 0,
        maxLife: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 0.04,
        rotSpeed: 0
      });
    }
    this.steamCursor = 0;

    // 2. Glistening golden oil-splatter micro-droplets (InstancedMesh = 1 draw call!)
    this.maxOil = 64;
    const oilGeo = new THREE.SphereGeometry(0.0022, 6, 5);
    const oilMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd78a,
      emissive: 0x66380a,
      emissiveIntensity: 0.4,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0
    });
    this.oilMesh = new THREE.InstancedMesh(oilGeo, oilMat, this.maxOil);
    this.oilMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.oilMesh);

    this.oilPool = [];
    this.dummy = new THREE.Object3D();
    for (let i = 0; i < this.maxOil; i++) {
      this.oilPool.push({ life: 0, maxLife: 0.5, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, scale: 1 });
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.oilMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.oilCursor = 0;
  }

  spawnSteam(x, y, z, intensity = 1.0, windX = 0) {
    const p = this.steamPool[this.steamCursor];
    this.steamCursor = (this.steamCursor + 1) % this.maxSteam;
    p.life = 0.001;
    p.maxLife = 1.6 + Math.random() * 1.1;
    p.sprite.position.set(x, y, z);
    p.vx = (Math.random() - 0.5) * 0.025 + windX * 0.05;
    p.vy = (0.065 + Math.random() * 0.045) * intensity;
    p.vz = (Math.random() - 0.5) * 0.022;
    p.baseScale = (0.036 + Math.random() * 0.026) * intensity;
    p.intensity = intensity;
    p.mat.rotation = Math.random() * Math.PI * 2;
    p.rotSpeed = (Math.random() - 0.5) * 0.6;
    p.sprite.visible = true;
  }

  spawnSteamBurst(x, y, z, count = 6, windX = 0) {
    for (let i = 0; i < count; i++) {
      this.spawnSteam(
        x + (Math.random() - 0.5) * 0.032,
        y + Math.random() * 0.018,
        z + (Math.random() - 0.5) * 0.032,
        1.15,
        windX
      );
    }
  }

  spawnOilDrop(x, y, z, strength = 1.0) {
    const p = this.oilPool[this.oilCursor];
    this.oilCursor = (this.oilCursor + 1) % this.maxOil;
    p.life = 0.001;
    p.maxLife = 0.28 + Math.random() * 0.24;
    p.x = x;
    p.y = y;
    p.z = z;
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.08 + Math.random() * 0.16) * strength;
    p.vx = Math.cos(ang) * spd;
    p.vy = (0.28 + Math.random() * 0.25) * strength;
    p.vz = Math.sin(ang) * spd;
    p.scale = 0.65 + Math.random() * 0.9;
  }

  spawnOilBurst(x, y, z, count = 10, strength = 1.0) {
    for (let i = 0; i < count; i++) {
      this.spawnOilDrop(
        x + (Math.random() - 0.5) * 0.026,
        y,
        z + (Math.random() - 0.5) * 0.026,
        strength
      );
    }
  }

  update(dt, time) {
    // Update steam plumes (soft fade-in, buoyant curl toward overhead pendant light, gentle disperse)
    for (const p of this.steamPool) {
      if (p.life <= 0) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.maxLife;
      const swirl = Math.sin(time * 2.2 + p.life * 3.1) * 0.018;
      p.sprite.position.x += (p.vx + swirl) * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.mat.rotation += p.rotSpeed * dt;

      const s = p.baseScale * (0.75 + t * 2.65);
      p.sprite.scale.set(s, s, 1);

      // Soft photographic opacity curve (never blocks faces, glows warmly in pendant beam)
      const alpha = Math.sin(t * Math.PI) * 0.24 * p.intensity;
      p.mat.opacity = alpha;
    }

    // Update glistening oil-splatter droplets with crisp gravity arc
    let dirty = false;
    for (let i = 0; i < this.maxOil; i++) {
      const p = this.oilPool[i];
      if (p.life <= 0) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife || p.y < 0.002) {
        p.life = 0;
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.oilMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.vy -= 1.85 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = 1 - p.life / p.maxLife;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(p.scale * (0.4 + fade * 0.7));
      this.dummy.updateMatrix();
      this.oilMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dirty) {
      this.oilMesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export function createTakoyakiSystem(scene, interactiveProps) {
  const sharedAssets = {
    takoTex: createTakoyakiTextures(),
    octoMat: interactiveProps.octopus.octoMat,
    negiMat: interactiveProps.octopus.negiMat,
    gingerMat: new THREE.MeshStandardMaterial({ color: 0xc82436, roughness: 0.45 }),
    katsuoFlakeMat: interactiveProps.katsuobushi.katsuoFlakeMat
  };

  const balls = WELL_OFFSETS.map((off, i) => new TakoyakiBall(i, off, sharedAssets, scene));
  const particles = new CookingParticles(scene);

  return { balls, particles };
}
