import * as THREE from 'three';
import { fbm2D } from './textures.js';

// High-craft deformable dual-sided 3D Pancake + Swelling/Popping Bubbles + Batter Pour Stream
export class PancakeItem {
  constructor(index = 0) {
    this.index = index;
    this.group = new THREE.Group();

    // Physical properties (meters)
    this.radius = 0.022;
    this.targetRadius = 0.022;
    this.maxRadius = 0.094;
    this.thickness = 0.0045;
    this.targetThickness = 0.0045;

    // Cooking state per face:
    // sideNegY starts touching hot skillet (cooks first -> golden brown!)
    // sidePosY starts raw facing up (bubbles swell & pop -> craters; cooks after flip!)
    this.brownNegY = 0.0; // 0 raw cream -> 0.65 classic golden -> 1.0 deep amber caramel
    this.brownPosY = 0.0;
    this.setAmount = 0.0; // 0 glossy liquid -> 1 matte fluffy baked sponge
    this.flipCount = 0;   // odd = NegY is now on TOP facing camera!
    this.poppedCount = 0;

    // Elastic deformation states
    this.shearX = 0;
    this.shearZ = 0;
    this.shearVelX = 0;
    this.shearVelZ = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.airBend = 0;
    this.biteProgress = 0; // 0 intact -> 1 eaten

    this.seed = index * 19.37 + 3.1;

    this._initCanvases();
    this._buildMesh();
    this._buildBubbles();

    this.canvasDirty = true;
    this.canvasTimer = 0;
    this._redrawBakingAtlas(true);
  }

  _initCanvases() {
    // 1024x512 dual-face baking atlas (strictly <= 1024px!)
    // Left 512x512 = +Y local face (bubble pore side), Right 512x512 = -Y local face (smooth golden griddle side)
    this.atlasW = 1024;
    this.atlasH = 512;
    this.albedoCanvas = document.createElement('canvas');
    this.albedoCanvas.width = this.atlasW;
    this.albedoCanvas.height = this.atlasH;
    this.aCtx = this.albedoCanvas.getContext('2d');

    this.bumpCanvas = document.createElement('canvas');
    this.bumpCanvas.width = 512;
    this.bumpCanvas.height = 256;
    this.bCtx = this.bumpCanvas.getContext('2d');

    // Persistent detail overlay canvases (stamped bubble craters + butter soak stains!)
    this.poresCanvas = document.createElement('canvas');
    this.poresCanvas.width = 512;
    this.poresCanvas.height = 512;
    this.pCtx = this.poresCanvas.getContext('2d');

    this.poresBumpCanvas = document.createElement('canvas');
    this.poresBumpCanvas.width = 256;
    this.poresBumpCanvas.height = 256;
    this.pbCtx = this.poresBumpCanvas.getContext('2d');

    // Pre-generate subtle griddle heat mottling mask so golden browning looks 100% photographic!
    this.mottleCanvas = document.createElement('canvas');
    this.mottleCanvas.width = 256;
    this.mottleCanvas.height = 256;
    const mCtx = this.mottleCanvas.getContext('2d');
    const mImg = mCtx.createImageData(256, 256);
    const md = mImg.data;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const dx = (x / 256 - 0.5) * 2;
        const dy = (y / 256 - 0.5) * 2;
        const r = Math.hypot(dx, dy);
        const macro = fbm2D(x * 0.032 + this.seed, y * 0.032 + this.seed, 4);
        const lace = fbm2D(x * 0.16 + this.seed, y * 0.16, 3);
        // Authentic butter-fried halo ring near outer 78% radius + paler soft edge lip!
        const butterRing = Math.exp(-Math.pow((r - 0.76) / 0.11, 2)) * 0.32;
        const paleLip = r > 0.87 ? (r - 0.87) / 0.13 : 0;
        const heat = Math.max(0, Math.min(1, 0.56 + (macro - 0.5) * 0.42 + (lace - 0.5) * 0.24 + butterRing - paleLip * 0.78));
        const idx = (y * 256 + x) * 4;
        const v = Math.floor(heat * 255);
        md[idx] = v;
        md[idx + 1] = v;
        md[idx + 2] = v;
        md[idx + 3] = 255;
      }
    }
    mCtx.putImageData(mImg, 0, 0);

    this.albedoTex = new THREE.CanvasTexture(this.albedoCanvas);
    this.albedoTex.colorSpace = THREE.SRGBColorSpace;
    this.albedoTex.anisotropy = 4;

    this.bumpTex = new THREE.CanvasTexture(this.bumpCanvas);
  }

  _buildMesh() {
    // Smooth organic pillowed disc built from deformed SphereGeometry(1, 64, 28)
    // ~3,584 triangles per pancake -> ultra-smooth silhouette & vertex flexing!
    const geo = new THREE.SphereGeometry(1, 64, 28);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;

    this.unitDirs = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const ux = pos.getX(i);
      const uy = pos.getY(i);
      const uz = pos.getZ(i);

      // Slight organic hand-poured roundness variation
      const angle = Math.atan2(uz, ux);
      const wobble =
        1.0 +
        0.028 * Math.sin(angle * 3 + this.seed) +
        0.016 * Math.cos(angle * 5 - this.seed * 1.7);

      this.unitDirs[i * 3] = ux * wobble;
      this.unitDirs[i * 3 + 1] = uy;
      this.unitDirs[i * 3 + 2] = uz * wobble;

      // Map UVs cleanly to left half (+Y face) or right half (-Y face)
      const px = ux * 0.46 + 0.5;
      const pz = uz * 0.46 + 0.5;
      if (uy >= 0) {
        uv.setXY(i, px * 0.5, pz);
      } else {
        uv.setXY(i, 0.5 + px * 0.5, pz);
      }
    }

    this.material = new THREE.MeshPhysicalMaterial({
      map: this.albedoTex,
      bumpMap: this.bumpTex,
      bumpScale: 0.0022,
      roughness: 0.12, // starts glossy raw batter, rises to 0.72 velvety baked hotcake!
      metalness: 0.0,
      clearcoat: 0.78, // wet batter sheen -> fades to 0 as batter sets
      clearcoatRoughness: 0.14,
      sheen: 0.25,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0xfff0d2),
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this._updateGeometryVertices(0);
  }

  _buildBubbles() {
    // Real 3D swelling & popping batter bubbles on the +Y raw surface!
    this.maxBubbles = 42;
    const domeGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    this.bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6c173,
      roughness: 0.07,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.96,
    });
    this.bubbleInst = new THREE.InstancedMesh(domeGeo, this.bubbleMat, this.maxBubbles);
    this.bubbleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.bubbleInst);

    this.bubbles = [];
    for (let i = 0; i < this.maxBubbles; i++) {
      this.bubbles.push({
        active: false,
        nx: 0,
        nz: 0,
        age: 0,
        life: 2.5,
        maxSize: 0.004,
        curSize: 0,
      });
    }

    // Tiny pop-droplet particles when bubbles burst ("ぷつっ！")
    this.maxDrops = 32;
    const dropGeo = new THREE.SphereGeometry(0.0016, 6, 6);
    this.dropInst = new THREE.InstancedMesh(dropGeo, this.bubbleMat, this.maxDrops);
    this.dropInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.dropInst);
    this.drops = Array.from({ length: this.maxDrops }, () => ({
      life: 0,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
    }));

    this._dummy = new THREE.Object3D();
    this._syncBubbleInstances(0);
  }

  spawnBubble() {
    const slot = this.bubbles.find((b) => !b.active);
    if (!slot) return false;
    // Uniform disc distribution inside 84% of pancake radius
    const r = Math.sqrt(Math.random()) * 0.82;
    const theta = Math.random() * Math.PI * 2;
    slot.active = true;
    slot.nx = Math.cos(theta) * r;
    slot.nz = Math.sin(theta) * r;
    slot.age = 0;
    slot.life = 2.0 + Math.random() * 2.4;
    slot.maxSize = 0.0028 + Math.random() * 0.0044;
    slot.curSize = 0.0005;
    return true;
  }

  popBubble(slot, onPopCallback) {
    if (!slot.active) return;
    slot.active = false;
    this.poppedCount++;

    // Stamp realistic recessed pore crater onto +Y face canvas!
    const px = (slot.nx * 0.46 + 0.5) * 512;
    const py = (slot.nz * 0.46 + 0.5) * 512;
    const pr = Math.max(2.6, (slot.maxSize / Math.max(0.04, this.radius)) * 215);

    const g = this.pCtx.createRadialGradient(px, py, pr * 0.15, px, py, pr * 1.35);
    g.addColorStop(0.0, 'rgba(155, 108, 52, 0.52)');
    g.addColorStop(0.55, 'rgba(182, 134, 72, 0.32)');
    g.addColorStop(0.82, 'rgba(255, 248, 224, 0.38)');
    g.addColorStop(1.0, 'rgba(255, 248, 224, 0.0)');
    this.pCtx.fillStyle = g;
    this.pCtx.beginPath();
    this.pCtx.arc(px, py, pr * 1.35, 0, Math.PI * 2);
    this.pCtx.fill();

    // Recessed crater in bump map
    const bx = px * 0.5;
    const by = py * 0.5;
    const br = pr * 0.65;
    const bg = this.pbCtx.createRadialGradient(bx, by, 0.2, bx, by, br * 1.3);
    bg.addColorStop(0.0, 'rgba(25, 25, 25, 0.85)');
    bg.addColorStop(0.65, 'rgba(95, 95, 95, 0.45)');
    bg.addColorStop(0.88, 'rgba(220, 220, 220, 0.35)');
    bg.addColorStop(1.0, 'rgba(128, 128, 128, 0.0)');
    this.pbCtx.fillStyle = bg;
    this.pbCtx.beginPath();
    this.pbCtx.arc(bx, by, br * 1.3, 0, Math.PI * 2);
    this.pbCtx.fill();

    this.canvasDirty = true;

    // Emit 3 tiny batter pop droplets
    const wx = slot.nx * this.radius;
    const wz = slot.nz * this.radius;
    for (let k = 0; k < 3; k++) {
      const d = this.drops.find((dr) => dr.life <= 0);
      if (!d) break;
      d.life = 0.24 + Math.random() * 0.12;
      d.pos.set(wx, this.thickness * 0.55, wz);
      d.vel.set((Math.random() - 0.5) * 0.09, 0.16 + Math.random() * 0.12, (Math.random() - 0.5) * 0.09);
    }

    if (onPopCallback) onPopCallback(slot.maxSize / 0.0072);
  }

  // Allows 5-year-old to poke bubbles directly with one finger!
  popBubblesNearLocal(lx, lz, hitRadius = 0.032, onPopCallback) {
    let popped = 0;
    for (const b of this.bubbles) {
      if (!b.active || b.age < 0.15) continue;
      const bx = b.nx * this.radius;
      const bz = b.nz * this.radius;
      if (Math.hypot(bx - lx, bz - lz) < hitRadius) {
        this.popBubble(b, onPopCallback);
        popped++;
      }
    }
    return popped;
  }

  // Stamp warm melted-butter soak darkening onto whichever face is currently on TOP!
  stampButterSoak(normX, normZ, normRad = 0.22) {
    // Draw subtle warm golden translucent soak onto active top face
    const ctx = this.aCtx;
    const isNegTop = this.flipCount % 2 === 1;
    const halfOffset = isNegTop ? 512 : 0;
    const cx = halfOffset + (normX * 0.46 + 0.5) * 512;
    const cy = (normZ * 0.46 + 0.5) * 512;
    const r = normRad * 230;
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(135, 68, 12, 0.09)');
    g.addColorStop(0.65, 'rgba(185, 108, 22, 0.05)');
    g.addColorStop(1, 'rgba(185, 108, 22, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    this.albedoTex.needsUpdate = true;
  }

  _drawFaceColor(ctx, offsetX, brownAmount, isPoreSide) {
    const w = 512;
    const h = 512;
    const cx = offsetX + w * 0.5;
    const cy = h * 0.5;

    // Base warm egg-custard pancake sponge / raw batter color
    const rawR = 244, rawG = 222, rawB = 166;
    // Rich toasted golden-amber Maillard center color
    const goldR = 148, goldG = 66, goldB = 14;
    // Deep caramelized mahogany color for well-done cooking
    const deepR = 96, deepG = 36, deepB = 6;

    let cR, cG, cB;
    if (brownAmount <= 0.65) {
      const t = brownAmount / 0.65;
      cR = THREE.MathUtils.lerp(rawR, goldR, t);
      cG = THREE.MathUtils.lerp(rawG, goldG, t);
      cB = THREE.MathUtils.lerp(rawB, goldB, t);
    } else {
      const t = (brownAmount - 0.65) / 0.35;
      cR = THREE.MathUtils.lerp(goldR, deepR, t);
      cG = THREE.MathUtils.lerp(goldG, deepG, t);
      cB = THREE.MathUtils.lerp(goldB, deepB, t);
    }

    // Creamy-pale fluffy outer belt (real hotcakes always keep a pale golden-cream outer edge!)
    const beltR = THREE.MathUtils.lerp(250, 241, Math.min(1, brownAmount * 1.2));
    const beltG = THREE.MathUtils.lerp(236, 212, Math.min(1, brownAmount * 1.2));
    const beltB = THREE.MathUtils.lerp(192, 152, Math.min(1, brownAmount * 1.2));

    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, 0, w, h);
    ctx.clip();

    ctx.fillStyle = `rgb(${beltR | 0}, ${beltG | 0}, ${beltB | 0})`;
    ctx.fillRect(offsetX, 0, w, h);

    if (brownAmount > 0.015) {
      // Rich radial Maillard browned disc with crisp butter-fried ring and soft pale outer lip!
      const radGrad = ctx.createRadialGradient(cx, cy, w * 0.04, cx, cy, w * 0.455);
      radGrad.addColorStop(0.0, `rgb(${cR | 0}, ${cG | 0}, ${cB | 0})`);
      radGrad.addColorStop(0.68, `rgb(${(cR * 0.96) | 0}, ${(cG * 0.94) | 0}, ${(cB * 0.90) | 0})`);
      // Crispy golden-butter ring right inside the edge!
      radGrad.addColorStop(0.81, `rgb(${Math.max(0, cR - 22) | 0}, ${Math.max(0, cG - 18) | 0}, ${Math.max(0, cB - 8) | 0})`);
      radGrad.addColorStop(0.91, `rgb(${beltR | 0}, ${beltG | 0}, ${beltB | 0})`);
      radGrad.addColorStop(1.0, `rgb(${beltR | 0}, ${beltG | 0}, ${beltB | 0})`);
      ctx.fillStyle = radGrad;
      ctx.fillRect(offsetX, 0, w, h);

      // Multiply natural griddle mottle & lacy ring texture!
      ctx.globalAlpha = Math.min(0.46, brownAmount * 0.58);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(this.mottleCanvas, offsetX, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
    }

    // Overlay stamped popped-bubble pores on +Y side
    if (isPoreSide) {
      ctx.drawImage(this.poresCanvas, offsetX, 0, w, h);
    }

    ctx.restore();
  }

  _redrawBakingAtlas(force = false) {
    if (!this.canvasDirty && !force) return;
    this.canvasDirty = false;

    // Left 512x512 = +Y face (bubble pores), Right 512x512 = -Y face (smooth golden griddle)
    this._drawFaceColor(this.aCtx, 0, this.brownPosY, true);
    this._drawFaceColor(this.aCtx, 512, this.brownNegY, false);
    this.albedoTex.needsUpdate = true;

    // Bump map: sponge grain + popped pores on left half, fine lacy griddle grain on right half
    this.bCtx.fillStyle = '#808080';
    this.bCtx.fillRect(0, 0, 512, 256);
    this.bCtx.globalAlpha = 0.35 + this.setAmount * 0.45;
    this.bCtx.drawImage(this.mottleCanvas, 0, 0, 256, 256);
    this.bCtx.drawImage(this.mottleCanvas, 256, 0, 256, 256);
    this.bCtx.globalAlpha = 1.0;
    this.bCtx.drawImage(this.poresBumpCanvas, 0, 0, 256, 256);
    this.bumpTex.needsUpdate = true;
  }

  _updateGeometryVertices(elapsed) {
    const pos = this.mesh.geometry.attributes.position;
    const r = this.radius * (1 + this.squash * 0.16);
    const halfH = this.thickness * 0.5 * Math.max(0.35, 1 - this.squash * 0.36);

    for (let i = 0; i < pos.count; i++) {
      const ux = this.unitDirs[i * 3];
      const uy = this.unitDirs[i * 3 + 1];
      const uz = this.unitDirs[i * 3 + 2];

      const horizR = Math.hypot(ux, uz);
      // Plump pillowy hotcake cross-section: flat-domed center, rounded cushion rim!
      const signY = Math.sign(uy);
      const absY = Math.abs(uy);
      const dome = Math.pow(absY, 0.52);

      let vx = ux * r;
      let vz = uz * r;
      let vy = signY * dome * halfH;

      // Subtle liquid meniscus rim while raw & pouring
      if (this.setAmount < 0.5 && uy > 0.15) {
        const rimWave = Math.exp(-Math.pow((horizR - 0.82) / 0.14, 2)) * (1 - this.setAmount * 2);
        vy += rimWave * 0.0016 + Math.sin(horizR * 18 - elapsed * 6) * 0.0004 * (1 - this.setAmount * 2);
      }

      // Elastic pan-jiggle shear (top shears more than bottom!)
      const topFactor = (uy + 1) * 0.5;
      vx += this.shearX * topFactor;
      vz += this.shearZ * topFactor;

      // Mid-air flexible pancake saddle bend during flip!
      if (Math.abs(this.airBend) > 0.0002) {
        vy -= (ux * ux + uz * uz * 0.65) * this.airBend;
      }

      // Bite cut-away wedge on +X/+Z side during eating climax!
      if (this.biteProgress > 0.01) {
        // Carve neat curved bite chunks progressively
        if (this.biteProgress < 0.45) {
          const dx = vx - r * 0.58;
          const dz = vz - r * 0.35;
          const biteR = 0.048;
          const d = Math.hypot(dx, dz);
          if (d < biteR) {
            const push = (biteR - d) / biteR;
            vx -= (dx / Math.max(0.001, d)) * push * 0.038;
            vz -= (dz / Math.max(0.001, d)) * push * 0.038;
          }
        } else if (this.biteProgress < 0.85) {
          const dx = vx - r * 0.12;
          const dz = vz - r * 0.42;
          const biteR = 0.068;
          const d = Math.hypot(dx, dz);
          if (d < biteR) {
            const push = (biteR - d) / biteR;
            vx -= (dx / Math.max(0.001, d)) * push * 0.055;
            vz -= (dz / Math.max(0.001, d)) * push * 0.055;
          }
        }
      }

      pos.setXYZ(i, vx, vy, vz);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  _syncBubbleInstances(elapsed) {
    const hideScale = 0.00001;
    // Hide raw bubbles once flipped face-down or fully baked
    const showBubbles = this.flipCount === 0 && this.biteProgress === 0;

    for (let i = 0; i < this.maxBubbles; i++) {
      const b = this.bubbles[i];
      if (!b.active || !showBubbles) {
        this._dummy.position.set(0, 0, 0);
        this._dummy.scale.setScalar(hideScale);
      } else {
        const bx = b.nx * this.radius + this.shearX;
        const bz = b.nz * this.radius + this.shearZ;
        const pulse = 1 + Math.sin(elapsed * 9 + i) * 0.06;
        this._dummy.position.set(bx, this.thickness * 0.46, bz);
        this._dummy.scale.set(b.curSize * pulse, b.curSize * 0.82 * pulse, b.curSize * pulse);
      }
      this._dummy.updateMatrix();
      this.bubbleInst.setMatrixAt(i, this._dummy.matrix);
    }
    this.bubbleInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.maxDrops; i++) {
      const d = this.drops[i];
      if (d.life <= 0) {
        this._dummy.position.set(0, 0, 0);
        this._dummy.scale.setScalar(hideScale);
      } else {
        this._dummy.position.copy(d.pos);
        this._dummy.scale.setScalar(0.85);
      }
      this._dummy.updateMatrix();
      this.dropInst.setMatrixAt(i, this._dummy.matrix);
    }
    this.dropInst.instanceMatrix.needsUpdate = true;
  }

  update(dt, elapsed, { isCookingInPan = false, isPouring = false, onBubblePop = null } = {}) {
    // Smoothly grow radius while pouring & puff up thickness while cooking
    this.radius = THREE.MathUtils.lerp(this.radius, this.targetRadius, Math.min(1, dt * 7.5));
    this.thickness = THREE.MathUtils.lerp(this.thickness, this.targetThickness, Math.min(1, dt * 3.5));

    // Elastic shear & squash-bounce physics
    this.shearVelX += (-this.shearX * 95 - this.shearVelX * 9.5) * dt;
    this.shearVelZ += (-this.shearZ * 95 - this.shearVelZ * 9.5) * dt;
    this.shearX += this.shearVelX * dt;
    this.shearZ += this.shearVelZ * dt;

    this.squashVel += (-this.squash * 120 - this.squashVel * 8.5) * dt;
    this.squash += this.squashVel * dt;
    this.airBend = THREE.MathUtils.lerp(this.airBend, 0, Math.min(1, dt * 9));

    if (isCookingInPan && !isPouring) {
      const sideOneDown = this.flipCount % 2 === 0;
      if (sideOneDown) {
        // Side -Y cooks against hot buttered skillet; Side +Y sets & sprouts swelling bubbles!
        const prevBrown = this.brownNegY;
        // Reaches golden 0.62 in ~6.5s, rich caramel 0.92 in ~15s (never burns black!)
        const rate = this.brownNegY < 0.65 ? 0.095 : 0.028;
        this.brownNegY = Math.min(0.95, this.brownNegY + dt * rate);
        this.setAmount = Math.min(0.88, this.setAmount + dt * 0.11);
        this.targetThickness = Math.max(this.targetThickness, 0.006 + this.setAmount * 0.0085);

        if (Math.abs(this.brownNegY - prevBrown) > 0.012) {
          this.canvasDirty = true;
        }

        // Spawn lively swelling bubbles across raw top ("ぷくぷく泡が出たら")
        if (this.brownNegY > 0.03 && Math.random() < dt * 13.5) {
          this.spawnBubble();
        }
      } else {
        // Side +Y is now face-down on hot skillet -> puffs up into full 2.1cm fluffy hotcake!
        const prevBrown = this.brownPosY;
        this.brownPosY = Math.min(0.88, this.brownPosY + dt * 0.14);
        this.setAmount = Math.min(1.0, this.setAmount + dt * 0.25);
        this.targetThickness = Math.max(this.targetThickness, 0.0205 * (0.75 + 0.25 * (this.radius / 0.085)));
        if (Math.abs(this.brownPosY - prevBrown) > 0.015) {
          this.canvasDirty = true;
        }
      }
    }

    // Update active bubbles & pop droplets
    for (const b of this.bubbles) {
      if (!b.active) continue;
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1.0) {
        this.popBubble(b, onBubblePop);
      } else {
        // Smoothly swell up ("ぷく〜っ")
        b.curSize = b.maxSize * Math.pow(Math.sin(t * Math.PI * 0.5), 0.72);
      }
    }

    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vel.y -= 1.8 * dt;
      d.pos.addScaledVector(d.vel, dt);
    }

    // Transition surface sheen from glossy wet batter to soft matte-velvet hotcake!
    const baked = this.flipCount > 0 ? 1.0 : this.setAmount;
    this.material.roughness = THREE.MathUtils.lerp(0.11, 0.72, baked);
    this.material.clearcoat = THREE.MathUtils.lerp(0.85, 0.06, baked);

    this.canvasTimer += dt;
    if (this.canvasDirty && this.canvasTimer > 0.08) {
      this.canvasTimer = 0;
      this._redrawBakingAtlas(false);
    }

    this._updateGeometryVertices(elapsed);
    this._syncBubbleInstances(elapsed);
  }
}

// Viscous Creamy Batter Pouring Stream from Stoneware Pitcher Spout into Skillet
export class BatterStream {
  constructor(scene) {
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf0c4,
      roughness: 0.09,
      clearcoat: 0.96,
      clearcoatRoughness: 0.06,
    });
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0, 0.14, 0),
      new THREE.Vector3(0, 0.07, 0),
      new THREE.Vector3(0, 0.01, 0),
    ]);
    this.mesh = new THREE.Mesh(new THREE.TubeGeometry(this.curve, 20, 0.006, 12, false), this.mat);
    this.mesh.visible = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.flow = 0;
  }

  update(dt, elapsed, active, startWorld, endWorld) {
    this.flow = THREE.MathUtils.lerp(this.flow, active ? 1 : 0, Math.min(1, dt * 14));
    if (this.flow < 0.03) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const p0 = startWorld;
    const p3 = endWorld;
    const mid1 = p0.clone().lerp(p3, 0.32);
    mid1.x -= 0.014;
    mid1.y += 0.012;

    const mid2 = p0.clone().lerp(p3, 0.70);
    // Subtle viscous batter ribbon coil at impact!
    mid2.x += Math.sin(elapsed * 14) * 0.0045;
    mid2.z += Math.cos(elapsed * 14) * 0.0045;

    this.curve.points[0].copy(p0);
    this.curve.points[1].copy(mid1);
    this.curve.points[2].copy(mid2);
    this.curve.points[3].copy(p3);

    const segs = 20;
    const radial = 10;
    const newGeo = new THREE.TubeGeometry(this.curve, segs, 1, radial, false);
    const pos = newGeo.attributes.position;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const center = this.curve.getPointAt(t);
      // Thick at spout lip, narrows slightly under gravity, flares slightly at puddle foot!
      const footFlare = t > 0.85 ? 1 + ((t - 0.85) / 0.15) * 0.65 : 1.0 - t * 0.32;
      const rad = 0.0068 * this.flow * footFlare;
      for (let r = 0; r <= radial; r++) {
        const vi = s * (radial + 1) + r;
        pos.setXYZ(
          vi,
          center.x + (pos.getX(vi) - center.x) * rad,
          center.y + (pos.getY(vi) - center.y) * rad,
          center.z + (pos.getZ(vi) - center.z) * rad
        );
      }
    }
    pos.needsUpdate = true;
    newGeo.computeVertexNormals();
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeo;
  }
}
