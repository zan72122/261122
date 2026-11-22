import * as THREE from '../vendor/three.module.js';

/**
 * Create a physically curled, dry 3D autumn leaf geometry (never a flat cardboard quad!).
 * Upturned crisp edges catch golden magic-hour rim backlighting naturally.
 */
function createCurledLeafGeometry() {
  const geo = new THREE.PlaneGeometry(0.28, 0.28, 3, 3);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Natural dry leaf cup & slight organic twist
    const cup = (x * x * 1.45 + z * z * 0.72) * 1.65;
    const twist = x * z * 1.1;
    pos.setY(i, cup + twist);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Real-time 3D aerodynamic fallen leaf physics system:
 * - ~148 interactive ground leaves around the bonfire clearing (4 natural species/color sets via InstancedMesh!)
 * - ~28 ambient autumn leaves continuously drifting down from the sunlit trees
 * - Single-finger sweeping kicks up tactile fluttering bursts, swirls leaves in air, and piles them into the stone firepit!
 */
export class FallenLeavesSystem {
  constructor(scene, leafTextures) {
    this.scene = scene;
    this.numSpecies = leafTextures.length;
    this.leavesPerSpecies = 68; // 4 * 68 = 272 lush curled 3D autumn leaves (still just 4 draw calls!)
    this.totalLeaves = this.numSpecies * this.leavesPerSpecies;

    const leafGeo = createCurledLeafGeometry();
    this.meshes = [];
    this.leaves = [];

    for (let s = 0; s < this.numSpecies; s++) {
      const mat = new THREE.MeshStandardMaterial({
        map: leafTextures[s],
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.68,
        metalness: 0.02,
        // Subtle warm backlit translucency glow
        emissive: new THREE.Color('#6b2808'),
        emissiveMap: leafTextures[s],
        emissiveIntensity: 0.14,
      });

      const im = new THREE.InstancedMesh(leafGeo, mat, this.leavesPerSpecies);
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      this.meshes.push(im);
    }

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this.pitCount = 0;
    this.time = 0;

    this.resetAllLeaves();
  }

  _groundHeight(x, z) {
    const r = Math.sqrt(x * x + z * z);
    const pitDip = -0.13 * Math.exp(-Math.pow(r / 1.15, 2));
    const berm = 0.055 * Math.exp(-Math.pow((r - 1.55) / 0.55, 2));
    return pitDip + berm + 0.018;
  }

  resetAllLeaves() {
    this.leaves.length = 0;
    this.pitCount = 0;

    let idx = 0;
    for (let s = 0; s < this.numSpecies; s++) {
      const im = this.meshes[s];
      for (let i = 0; i < this.leavesPerSpecies; i++) {
        const isAmbientFalling = i >= this.leavesPerSpecies - 7; // 28 ambient falling leaves total
        let x, y, z;

        if (isAmbientFalling) {
          x = (Math.random() - 0.5) * 9.5;
          y = 1.6 + Math.random() * 4.8;
          z = -3.8 + Math.random() * 6.5;
        } else {
          // Scatter richly around the stone firepit ring (avoiding right on top of the wooden board!)
          let attempts = 0;
          do {
            const ang = Math.random() * Math.PI * 2;
            const rad = 1.48 + Math.pow(Math.random(), 0.72) * 2.55;
            x = Math.cos(ang) * rad;
            z = Math.sin(ang) * rad;
            attempts++;
          } while (
            attempts < 12 &&
            ((x > -0.25 && x < 2.15 && z > 1.2 && z < 2.95) || (x < -1.35 && z > 1.0 && z < 2.2))
          );
          y = this._groundHeight(x, z) + Math.random() * 0.025;
        }

        const scale = 0.78 + Math.random() * 0.52;
        const leaf = {
          species: s,
          instIdx: i,
          x, y, z,
          vx: 0, vy: 0, vz: 0,
          rx: (Math.random() - 0.5) * 0.35,
          ry: Math.random() * Math.PI * 2,
          rz: (Math.random() - 0.5) * 0.35,
          vrx: 0, vry: 0, vrz: 0,
          scale,
          state: isAmbientFalling ? 'falling' : 'ground', // 'ground' | 'air' | 'pit' | 'falling'
          char: 0, // 0 fresh -> 1 charred in fire
          flutterPhase: Math.random() * Math.PI * 2,
          pitSlotY: 0,
        };
        this.leaves.push(leaf);

        // Slight individual natural color variation per leaf
        const tint = 0.86 + Math.random() * 0.24;
        this._color.setRGB(tint, tint * (0.94 + Math.random() * 0.1), tint * 0.9);
        im.setColorAt(i, this._color);
        idx++;
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this._syncMatrices();
  }

  /**
   * Replenish a fresh scatter of crisp autumn leaves around the clearing (for replayability!)
   */
  scatterFreshBatch(count = 36) {
    let spawned = 0;
    for (const lf of this.leaves) {
      if (spawned >= count) break;
      if (lf.state === 'pit' && lf.char > 0.65) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 1.65 + Math.random() * 2.1;
        lf.x = Math.cos(ang) * rad;
        lf.z = Math.sin(ang) * rad;
        lf.y = 2.8 + Math.random() * 2.4;
        lf.vx = (Math.random() - 0.5) * 0.5;
        lf.vy = -0.35;
        lf.vz = (Math.random() - 0.5) * 0.5;
        lf.state = 'air';
        lf.char = 0;
        this._color.setRGB(1, 0.98, 0.94);
        this.meshes[lf.species].setColorAt(lf.instIdx, this._color);
        if (this.meshes[lf.species].instanceColor) {
          this.meshes[lf.species].instanceColor.needsUpdate = true;
        }
        spawned++;
      }
    }
  }

  /**
   * Single-finger tactile sweep/gust across the ground!
   * Scatters and lifts leaves physically with aerodynamics, gently helping inward swipes
   * arc cleanly into the stone firepit while letting outward swipes scatter them playfully!
   */
  applySweep(worldPoint, worldVel, attractToPit = true) {
    let disturbed = 0;
    const speed = Math.min(8.5, Math.hypot(worldVel.x, worldVel.z));
    const radius = 1.48 + Math.min(0.55, speed * 0.10);

    for (const lf of this.leaves) {
      if (lf.state === 'pit') continue;
      if (lf.state === 'falling' && lf.y > 1.8) continue;

      const dx = lf.x - worldPoint.x;
      const dz = lf.z - worldPoint.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;

      const d = Math.sqrt(d2) + 0.001;
      const falloff = Math.pow(1 - d / radius, 1.15);

      // Compute swipe direction vs direction toward firepit center (0, 0)
      const toPitX = -lf.x;
      const toPitZ = -lf.z;
      const pitDist = Math.hypot(toPitX, toPitZ) + 0.001;
      const pitNx = toPitX / pitDist;
      const pitNz = toPitZ / pitDist;

      let pushX = worldVel.x * 0.65;
      let pushZ = worldVel.z * 0.65;

      if (speed < 0.4) {
        // Tap on ground: joyful burst upward & arc toward pit
        pushX = (dx / d) * 0.8 + (attractToPit ? pitNx * 2.8 : 0);
        pushZ = (dz / d) * 0.8 + (attractToPit ? pitNz * 2.8 : 0);
      } else if (attractToPit) {
        // Generous inward arc assist so a 5-year-old's broad swipes land crisp autumn leaves right in the firepit!
        const dot = (worldVel.x * pitNx + worldVel.z * pitNz) / (speed + 0.001);
        if (dot > -0.25) {
          const assist = Math.max(0.52, dot) * Math.min(4.6, 2.3 + speed * 0.52);
          pushX = pushX * 0.42 + pitNx * assist;
          pushZ = pushZ * 0.42 + pitNz * assist;
        }
      }

      // Tangential swirl makes leaves dance & spin photorealistically!
      const swirlX = (-dz / d) * (0.45 + speed * 0.12);
      const swirlZ = (dx / d) * (0.45 + speed * 0.12);

      lf.vx += (pushX + swirlX + (Math.random() - 0.5) * 0.7) * falloff * 0.78;
      lf.vz += (pushZ + swirlZ + (Math.random() - 0.5) * 0.7) * falloff * 0.78;
      lf.vy = Math.max(lf.vy, (1.15 + Math.random() * 1.1 + speed * 0.18) * (0.45 + falloff * 0.65));

      lf.vrx = (Math.random() - 0.5) * 11;
      lf.vry = (Math.random() - 0.5) * 12;
      lf.vrz = (Math.random() - 0.5) * 11;
      lf.state = 'air';
      disturbed++;
    }

    return disturbed;
  }

  /**
   * Playful celebration swirl gust across the whole clearing
   */
  triggerWindSwirl(strength = 1.0) {
    for (const lf of this.leaves) {
      if (lf.state === 'pit') continue;
      const ang = Math.atan2(lf.z, lf.x);
      lf.vx += (-Math.sin(ang) * 1.6 + 0.6) * strength * (0.6 + Math.random() * 0.6);
      lf.vz += Math.cos(ang) * 1.6 * strength * (0.6 + Math.random() * 0.6);
      lf.vy = Math.max(lf.vy, (0.9 + Math.random() * 1.4) * strength);
      lf.vrx = (Math.random() - 0.5) * 9;
      lf.vry = (Math.random() - 0.5) * 9;
      lf.vrz = (Math.random() - 0.5) * 9;
      if (lf.state === 'ground') lf.state = 'air';
    }
  }

  update(dt, fireIntensity, onLeafEnterPit) {
    this.time += dt;
    let colorDirty = false;
    let newlyEntered = 0;

    const breezeX = 0.22 + Math.sin(this.time * 0.55) * 0.14;
    const breezeZ = Math.cos(this.time * 0.42) * 0.08;

    for (const lf of this.leaves) {
      if (lf.state === 'falling') {
        // Gentle sunlit autumn leaves drifting down from the canopy
        const flutter = Math.sin(this.time * 2.4 + lf.flutterPhase);
        lf.x += (breezeX + flutter * 0.45) * dt;
        lf.z += (breezeZ + Math.cos(this.time * 1.9 + lf.flutterPhase) * 0.35) * dt;
        lf.y -= (0.42 + Math.abs(flutter) * 0.16) * dt;
        lf.rx = Math.sin(this.time * 2.8 + lf.flutterPhase) * 0.65;
        lf.ry += 0.95 * dt;
        lf.rz = Math.cos(this.time * 2.5 + lf.flutterPhase) * 0.55;

        if (lf.y <= this._groundHeight(lf.x, lf.z)) {
          // Respawn overhead so autumn leaves continuously drift through sunset rays
          lf.x = (Math.random() - 0.5) * 9.5;
          lf.y = 4.6 + Math.random() * 2.2;
          lf.z = -4.2 + Math.random() * 6.5;
        }
      } else if (lf.state === 'air') {
        // Real aerodynamic dry-leaf flight: slow fluttering descent + air drag + thermal updraft above fire!
        const rCenter = Math.hypot(lf.x, lf.z);
        const flutter = Math.sin(this.time * 6.2 + lf.flutterPhase);

        lf.vx += (breezeX * 0.6 + flutter * 0.85) * dt;
        lf.vz += (breezeZ * 0.6 + Math.cos(this.time * 5.4 + lf.flutterPhase) * 0.85) * dt;

        // Air drag
        const drag = Math.exp(-dt * 1.75);
        lf.vx *= drag;
        lf.vz *= drag;

        // Gravity with light leaf terminal lift
        let grav = -3.4;
        if (lf.vy < -0.75) {
          grav = -0.6; // crisp fluttering terminal speed
        }
        lf.vy += grav * dt;

        lf.x += lf.vx * dt;
        lf.y += lf.vy * dt;
        lf.z += lf.vz * dt;

        lf.rx += lf.vrx * dt;
        lf.ry += lf.vry * dt;
        lf.rz += lf.vrz * dt;
        lf.vrx *= 0.96;
        lf.vry *= 0.97;
        lf.vrz *= 0.96;

        // Keep within clearing bounds
        if (rCenter > 4.6) {
          const pull = (4.6 - rCenter) * 0.4;
          lf.x += (lf.x / rCenter) * pull;
          lf.z += (lf.z / rCenter) * pull;
        }

        const gy = this._groundHeight(lf.x, lf.z);
        if (lf.y <= gy) {
          if (rCenter < 1.08) {
            // Landed inside the stone firepit! Pile up naturally
            lf.state = 'pit';
            this.pitCount++;
            newlyEntered++;
            const pileHeight = Math.min(0.42, 0.04 + (this.pitCount / 36) * 0.34) * (1 - rCenter * 0.65);
            lf.pitSlotY = gy + Math.max(0.02, pileHeight) + Math.random() * 0.04;
            lf.y = lf.pitSlotY;
            lf.vx = lf.vy = lf.vz = 0;
            lf.rx = (Math.random() - 0.5) * 0.6;
            lf.rz = (Math.random() - 0.5) * 0.6;
          } else {
            // Landed on autumn earth
            lf.y = gy + Math.random() * 0.015;
            lf.vx = lf.vy = lf.vz = 0;
            lf.rx *= 0.25;
            lf.rz *= 0.25;
            lf.state = 'ground';
          }
        }
      } else if (lf.state === 'ground') {
        // Subtle gentle rustle in the evening breeze
        lf.rz += Math.sin(this.time * 1.8 + lf.flutterPhase) * 0.002;
      } else if (lf.state === 'pit') {
        // Slowly char and settle into glowing ash as fire burns hotter!
        if (fireIntensity > 0.32 && lf.char < 1) {
          lf.char = Math.min(1, lf.char + dt * (0.04 + fireIntensity * 0.09));
          lf.y = lf.pitSlotY - lf.char * 0.14;
          // Darken to crisp charred black with faint ember edge
          const c = Math.max(0.14, 1 - lf.char * 0.86);
          this._color.setRGB(c + (lf.char > 0.4 && lf.char < 0.85 ? 0.25 : 0), c * 0.82, c * 0.72);
          this.meshes[lf.species].setColorAt(lf.instIdx, this._color);
          colorDirty = true;
        }
      }
    }

    if (colorDirty) {
      for (const im of this.meshes) {
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }

    if (newlyEntered > 0 && onLeafEnterPit) {
      onLeafEnterPit(newlyEntered, this.pitCount);
    }

    this._syncMatrices();
  }

  _syncMatrices() {
    for (const lf of this.leaves) {
      this._dummy.position.set(lf.x, lf.y, lf.z);
      this._dummy.rotation.set(lf.rx, lf.ry, lf.rz);
      const shrink = lf.state === 'pit' ? 1 - lf.char * 0.35 : 1;
      this._dummy.scale.setScalar(lf.scale * shrink);
      this._dummy.updateMatrix();
      this.meshes[lf.species].setMatrixAt(lf.instIdx, this._dummy.matrix);
    }
    for (const im of this.meshes) {
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
