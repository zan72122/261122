import * as THREE from 'three';
import { BALCONY } from './balcony.js';

// High-resolution deformable closed-volume Japanese quilted cotton futon
// Supports:
//  1) Folded rest on balcony deck/stool edge
//  2) Natural catenary cloth drape over the balcony handrail (front & back sides, flippable!)
//  3) Laid flat on sunlit indoor tatami, then puffing up plump & cloud-like!
//  4) Real-time 2D spring-wave surface indentation for PAN-PAN beats and fluffy squishes!

const SEG_U = 54; // across width (X)
const SEG_V = 42; // along length (draped front-to-back)
const FUTON_W = 1.16; // real Japanese single futon width (~1.1m)
const FUTON_L = 1.48; // real visible drape length (~1.5m)

// 2D wave & cleanliness simulation grid
const GRID_U = 22;
const GRID_V = 18;

export class Futon {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;

    // Macro pose state: 'folded' | 'hanging' | 'indoors'
    this.pose = 'folded';
    this.hangBlend = 0;      // 0 = folded, 1 = hanging on rail
    this.indoorBlend = 0;    // 0 = outdoor, 1 = indoors on tatami
    this.dragLift = 0;       // 0..1 manual one-finger lift/pull feedback
    this.dragX = 0;
    this.flipProgress = 0;   // 0 = front side facing camera, 1 = back side facing camera
    this.targetFlip = 0;

    // Fluffiness & beating state
    this.beatsCount = 0;
    this.fluffCharge = 0.0;  // 0..1 built up by beating & airing
    this.displayLoft = 0.45; // real-time physical thickness multiplier
    this.indoorPuffTimer = 0;
    this.hasPuffed = false;
    this.sunWarmth = 0.0;    // 0..1 warmth glow & crease relaxation
    this.nudgePulse = 0;     // subtle gentle breathing hint after long idle

    // 2D spring-wave simulation arrays
    const gLen = GRID_U * GRID_V;
    this.waveH = new Float32Array(gLen);
    this.waveV = new Float32Array(gLen);
    this.dustGrid = new Float32Array(gLen).fill(1.0); // 1 = dusty/creased, 0 = clean/plump
    this.backDustGrid = new Float32Array(gLen).fill(1.0);

    // Clip clamp state from balcony
    this.leftClamped = false;
    this.rightClamped = false;

    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildClosedQuiltedGeometry();
    this._updateVertices(0, 0);
  }

  _buildClosedQuiltedGeometry() {
    // We build TWO stitched surfaces (front quilted face & back ivory face) joined seamlessly along their rounded edges
    // This guarantees distinct realistic front/back fabric materials AND real solid rounded thickness!
    const frontGeo = new THREE.BufferGeometry();
    const backGeo = new THREE.BufferGeometry();

    const vCount = (SEG_U + 1) * (SEG_V + 1);
    const fPos = new Float32Array(vCount * 3);
    const bPos = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);

    for (let j = 0; j <= SEG_V; j++) {
      for (let i = 0; i <= SEG_U; i++) {
        const idx = j * (SEG_U + 1) + i;
        uvs[idx * 2] = i / SEG_U;
        uvs[idx * 2 + 1] = j / SEG_V;
      }
    }

    const fIdx = [];
    const bIdx = [];
    for (let j = 0; j < SEG_V; j++) {
      for (let i = 0; i < SEG_U; i++) {
        const a = j * (SEG_U + 1) + i;
        const b = a + 1;
        const c = a + (SEG_U + 1);
        const d = c + 1;
        // Front face outward normal (+side)
        fIdx.push(a, c, b, b, c, d);
        // Back face outward normal (-side)
        bIdx.push(a, b, c, b, d, c);
      }
    }

    frontGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    frontGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    frontGeo.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
    frontGeo.setIndex(fIdx);

    backGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    backGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    backGeo.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
    backGeo.setIndex(bIdx);

    this.frontMesh = new THREE.Mesh(frontGeo, this.mats.futonFront);
    this.frontMesh.castShadow = true;
    this.frontMesh.receiveShadow = true;
    this.frontMesh.userData.interactiveType = 'futon';

    this.backMesh = new THREE.Mesh(backGeo, this.mats.futonBack);
    this.backMesh.castShadow = true;
    this.backMesh.receiveShadow = true;
    this.backMesh.userData.interactiveType = 'futon';

    this.group.add(this.frontMesh, this.backMesh);

    // Precompute static quilted baffle profile & rounded edge falloff per vertex
    this.quiltFactor = new Float32Array(vCount);
    this.edgePillow = new Float32Array(vCount);
    this.creaseNoise = new Float32Array(vCount);

    for (let j = 0; j <= SEG_V; j++) {
      const v = j / SEG_V;
      for (let i = 0; i <= SEG_U; i++) {
        const u = i / SEG_U;
        const idx = j * (SEG_U + 1) + i;

        // Smooth pillowed edge falloff (0 right at stitched perimeter seam -> 1 inside)
        const du = Math.min(u, 1 - u);
        const dv = Math.min(v, 1 - v);
        const edgeU = Math.pow(Math.min(1, du / 0.075), 0.52);
        const edgeV = Math.pow(Math.min(1, dv / 0.065), 0.52);
        this.edgePillow[idx] = edgeU * edgeV;

        // Traditional Japanese curved-wave 4x5 quilted pockets
        const waveX = u * 4.0 + Math.sin(v * Math.PI * 10.0) * 0.055;
        const waveY = v * 5.0 + Math.sin(u * Math.PI * 8.0) * 0.045;
        const qx = Math.abs(Math.sin(waveX * Math.PI));
        const qy = Math.abs(Math.sin(waveY * Math.PI));
        // Plump domed pockets with tucked stitch channels
        const pocket = Math.pow(qx, 0.35) * Math.pow(qy, 0.35);
        this.quiltFactor[idx] = 0.52 + 0.48 * pocket;

        // Subtle organic sleep-wrinkle frequency (relaxes as futon is beaten & sun-warmed!)
        this.creaseNoise[idx] =
          Math.sin(u * 19.0 + v * 11.0) * 0.45 +
          Math.cos(u * 13.0 - v * 23.0) * 0.35 +
          Math.sin((u + v) * 31.0) * 0.2;
      }
    }
  }

  getActiveDustGrid() {
    return this.targetFlip > 0.5 ? this.backDustGrid : this.dustGrid;
  }

  // Trigger a localized beat impact at UV (u, v in 0..1)
  // Returns { dustReleased, centerFactor, worldPos }
  beatAtUV(u, v, strength = 1.0) {
    const cu = Math.max(0, Math.min(1, u));
    const cv = Math.max(0, Math.min(1, v));
    const gu = cu * (GRID_U - 1);
    const gv = cv * (GRID_V - 1);

    const grid = this.getActiveDustGrid();
    let dustReleased = 0;

    // Radius of rattan beater paddle in grid space
    const rad = 3.2;
    for (let j = 0; j < GRID_V; j++) {
      for (let i = 0; i < GRID_U; i++) {
        const dx = i - gu;
        const dy = j - gv;
        const dist = Math.hypot(dx, dy);
        if (dist < rad) {
          const falloff = Math.cos((dist / rad) * Math.PI * 0.5);
          const idx = j * GRID_U + i;
          // Push surface inward along normal (creates real springy dimple & traveling ripple)
          this.waveV[idx] -= 1.85 * strength * falloff * falloff;

          // Knock out dust & fluff up this region
          const removed = Math.min(grid[idx], 0.42 * falloff);
          grid[idx] = Math.max(0, grid[idx] - removed);
          dustReleased += removed;
        }
      }
    }

    this.beatsCount += 1;
    // Build fluff charge smoothly over ~7-10 good beats (still rewarding even after 3 beats!)
    const gain = 0.085 + Math.min(0.08, dustReleased * 0.018);
    this.fluffCharge = Math.min(1.0, this.fluffCharge + gain);
    this.sunWarmth = Math.min(1.0, this.sunWarmth + 0.09);

    // Center factor for deeper resonant bass sound
    const centerFactor = 1.0 - Math.min(1.0, Math.hypot((cu - 0.5) * 2.0, (cv - 0.32) * 2.2));
    return { dustReleased, centerFactor };
  }

  // Soft squish/pat press when futon is puffy indoors
  pressAtUV(u, v, strength = 0.85) {
    const cu = Math.max(0, Math.min(1, u));
    const cv = Math.max(0, Math.min(1, v));
    const gu = cu * (GRID_U - 1);
    const gv = cv * (GRID_V - 1);
    const rad = 3.5;

    for (let j = 0; j < GRID_V; j++) {
      for (let i = 0; i < GRID_U; i++) {
        const dist = Math.hypot(i - gu, j - gv);
        if (dist < rad) {
          const f = Math.cos((dist / rad) * Math.PI * 0.5);
          const idx = j * GRID_U + i;
          this.waveV[idx] -= 1.25 * strength * f * f;
        }
      }
    }
  }

  // Flip futon over on the rail to air & beat the opposite side
  flip() {
    if (this.pose !== 'hanging') return false;
    this.targetFlip = this.targetFlip < 0.5 ? 1.0 : 0.0;
    // Add lively cloth ripple across whole futon
    for (let k = 0; k < this.waveV.length; k++) {
      this.waveV[k] += (Math.random() - 0.5) * 0.65;
    }
    return true;
  }

  setPose(nextPose) {
    if (this.pose === nextPose) return;
    this.pose = nextPose;
    if (nextPose === 'indoors') {
      this.indoorPuffTimer = 0;
      this.hasPuffed = false;
    } else if (nextPose === 'hanging') {
      // Fresh gentle sun warmth starts accruing on the sunny rail
      this.hasPuffed = false;
    } else if (nextPose === 'folded') {
      // Reset for a fresh sunny airing cycle
      this.dustGrid.fill(0.9);
      this.backDustGrid.fill(0.9);
      this.fluffCharge = 0.0;
      this.beatsCount = 0;
      this.sunWarmth = 0.0;
      this.hasPuffed = false;
    }
  }

  // Compute exact 3D centerline point & normal for a given (u, v) in each macro pose
  // Winding convention: (+v) x (+u) MUST align with +outNorm so frontMesh is always outward-facing!
  _sampleFolded(u, v, elapsed, outPos, outNorm) {
    // Cozy, plumply folded Japanese futon resting cleanly on the sunlit wooden duckboard!
    // v = 0..0.42: bottom layer resting on slats (z goes front->back so +v = -Z, (+v)x(+u) = -Y = outNorm!)
    // v = 0.42..0.58: smooth rounded U-fold at back edge (toward railing)
    // v = 0.58..1.0: top layer facing camera/sky (z goes back->front so +v = +Z, (+v)x(+u) = +Y = outNorm!)
    const x = (u - 0.5) * (FUTON_W * 0.84);
    const baseZ = 0.06;
    const baseY = 0.064;
    const foldR = 0.066;

    let y, z, ny, nz;
    if (v <= 0.42) {
      // Bottom layer resting flat on oak duckboard (+v goes from front +0.26 to back -0.18)
      const t = v / 0.42;
      z = baseZ + 0.22 - t * 0.42;
      y = baseY + 0.036;
      ny = -0.995;
      nz = 0.10;
    } else if (v < 0.58) {
      // Smooth semicircle U-bend at the far edge (bottom -> back -> top)
      const a = ((v - 0.42) / 0.16) * Math.PI; // 0 (bottom) -> PI/2 (back) -> PI (top)
      z = baseZ - 0.20 - Math.sin(a) * foldR;
      y = baseY + 0.036 + foldR - Math.cos(a) * foldR;
      ny = -Math.cos(a);
      nz = -Math.sin(a);
    } else {
      // Top folded layer facing upward & slightly toward camera (+v goes from back -0.18 to front +0.26)
      const t = (v - 0.58) / 0.42;
      z = baseZ - 0.20 + t * 0.42;
      y = baseY + 0.036 + foldR * 2.0 + Math.sin(t * Math.PI) * 0.024;
      ny = 0.985;
      nz = 0.17;
    }

    const lift = this.dragLift;
    const archLift = lift * 0.55 + Math.sin(elapsed * 2.2) * 0.004 * this.nudgePulse;
    y += archLift * (1.0 - Math.abs(u - 0.5) * 0.35);
    z -= lift * 0.35;

    outPos.set(x + this.dragX * 0.18, y, z);
    outNorm.set(0, ny, nz).normalize();
  }

  _sampleHanging(u, v, elapsed, outPos, outNorm) {
    // Draped cleanly OVER the brushed aluminum handrail & IN FRONT of the concrete parapet/coping!
    // v = 0..0.33: back flap hanging outside balcony (+v goes UP so (+v)x(+u) = -Z = outNorm!)
    // v = 0.33..0.55: smooth rounded pillowed arch over the top of the handrail (+v goes back->front so (+v)x(+u) = +Y = outNorm!)
    // v = 0.55..1.0: front sunlit flap hanging inside balcony (+v goes DOWN so (+v)x(+u) = +Z = outNorm!)
    const apexV = 0.44;
    const xBase = (u - 0.5) * FUTON_W;
    const railR_Y = 0.095;  // clean clearance above handrail top
    const railR_Z = 0.168;  // clean clearance in front of parapet coping cap

    let y, z, ny, nz;
    const bendHalf = 0.11;

    if (v < apexV - bendHalf) {
      // Back flap hanging outside balcony (-Z side)
      const distDown = (apexV - bendHalf - v) * (FUTON_L * 0.96);
      const hangFrac = Math.min(1, distDown / (FUTON_L * 0.42));
      const sway = Math.sin(elapsed * 1.5 + u * 2.1 + 1.2) * 0.020 * hangFrac * hangFrac;
      y = BALCONY.railY - distDown;
      z = BALCONY.railZ - railR_Z - sway - hangFrac * 0.015;
      ny = 0.05;
      nz = -0.998;
    } else if (v <= apexV + bendHalf) {
      // Smooth rounded elliptical arch curving over top of handrail (back -> top -> front)
      const t = (v - (apexV - bendHalf)) / (bendHalf * 2.0); // 0 (back) -> 0.5 (top) -> 1 (front)
      const theta = (1.0 - t) * Math.PI; // PI (back) -> PI/2 (top) -> 0 (front)
      y = BALCONY.railY + Math.sin(theta) * railR_Y;
      z = BALCONY.railZ + Math.cos(theta) * railR_Z;
      ny = Math.sin(theta) * (railR_Z / railR_Y);
      nz = Math.cos(theta);
      const invLen = 1.0 / Math.hypot(ny, nz);
      ny *= invLen;
      nz *= invLen;
    } else {
      // Front sunlit face hanging down inside balcony (+Z side facing viewer!)
      const distDown = (v - (apexV + bendHalf)) * (FUTON_L * 0.96);
      const hangFrac = Math.min(1, distDown / (FUTON_L * 0.46));
      const bow = Math.sin(hangFrac * Math.PI) * 0.028;
      const cornerFactor = 0.45 + 0.55 * Math.abs(u - 0.5) * 2.0;
      const clampDamp =
        (u < 0.5 && this.leftClamped ? 0.25 : 1.0) *
        (u >= 0.5 && this.rightClamped ? 0.25 : 1.0);
      const sway =
        (Math.sin(elapsed * 1.4 + u * 2.4) * 0.016 + Math.sin(elapsed * 2.6 + u * 4.0) * 0.006) *
        hangFrac * hangFrac * cornerFactor * clampDamp;

      y = BALCONY.railY - distDown;
      z = BALCONY.railZ + railR_Z + bow + sway + hangFrac * 0.018;
      ny = 0.06;
      nz = 0.998;
    }

    const xPinch = 1.0 - Math.max(0, 1.0 - Math.abs(v - apexV) * 4.5) * 0.02;
    const cornerDroop = Math.pow(Math.abs(u - 0.5) * 2.0, 2.2) * 0.018;
    const pullDown = this.pose === 'hanging' ? Math.max(0, -this.dragLift) : 0;

    outPos.set(xBase * xPinch, y - cornerDroop - pullDown * 0.16, z + pullDown * 0.14);
    outNorm.set(0, ny, nz).normalize();
  }

  _sampleIndoors(u, v, elapsed, outPos, outNorm) {
    // Laid flat & plump completely on the sunlit indoor tatami mat!
    const x = (u - 0.5) * (FUTON_W * 0.96);
    const z = BALCONY.indoorCenterZ + (v - 0.5) * (FUTON_L * 0.88);
    const y = BALCONY.tatamiY + 0.022 + this.displayLoft * 0.056;
    outPos.set(x, y, z);
    outNorm.set(0, 1, 0);
  }

  _sampleWave(u, v) {
    const fu = Math.max(0, Math.min(GRID_U - 1.001, u * (GRID_U - 1)));
    const fv = Math.max(0, Math.min(GRID_V - 1.001, v * (GRID_V - 1)));
    const i0 = Math.floor(fu);
    const j0 = Math.floor(fv);
    const tx = fu - i0;
    const ty = fv - j0;
    const i1 = i0 + 1;
    const j1 = j0 + 1;

    const h00 = this.waveH[j0 * GRID_U + i0];
    const h10 = this.waveH[j0 * GRID_U + i1];
    const h01 = this.waveH[j1 * GRID_U + i0];
    const h11 = this.waveH[j1 * GRID_U + i1];

    const h0 = h00 + (h10 - h00) * tx;
    const h1 = h01 + (h11 - h01) * tx;
    return h0 + (h1 - h0) * ty;
  }

  _sampleLocalClean(u, v) {
    const i = Math.min(GRID_U - 1, Math.max(0, Math.round(u * (GRID_U - 1))));
    const j = Math.min(GRID_V - 1, Math.max(0, Math.round(v * (GRID_V - 1))));
    return 1.0 - this.getActiveDustGrid()[j * GRID_U + i];
  }

  _stepWavePhysics(dt) {
    const subDt = Math.min(dt, 0.025);
    const stiffness = 135.0;
    const damping = 9.2;
    const spread = 34.0;

    // Temporary copy of heights for neighbor coupling
    const prevH = this._prevH || (this._prevH = new Float32Array(this.waveH.length));
    prevH.set(this.waveH);

    for (let j = 0; j < GRID_V; j++) {
      for (let i = 0; i < GRID_U; i++) {
        const idx = j * GRID_U + i;
        const h = prevH[idx];
        let lap = 0;
        let cnt = 0;
        if (i > 0) { lap += prevH[idx - 1]; cnt++; }
        if (i < GRID_U - 1) { lap += prevH[idx + 1]; cnt++; }
        if (j > 0) { lap += prevH[idx - GRID_U]; cnt++; }
        if (j < GRID_V - 1) { lap += prevH[idx + GRID_U]; cnt++; }
        const avg = cnt > 0 ? lap / cnt : h;

        const acc = -stiffness * h + spread * (avg - h) - damping * this.waveV[idx];
        this.waveV[idx] += acc * subDt;
        this.waveH[idx] += this.waveV[idx] * subDt;
        // Clamp extreme displacements
        if (this.waveH[idx] > 0.12) this.waveH[idx] = 0.12;
        if (this.waveH[idx] < -0.14) this.waveH[idx] = -0.14;
      }
    }
  }

  _updateVertices(dt, elapsed) {
    const fPos = this.frontMesh.geometry.attributes.position.array;
    const bPos = this.backMesh.geometry.attributes.position.array;

    const pFold = new THREE.Vector3();
    const nFold = new THREE.Vector3();
    const pHang = new THREE.Vector3();
    const nHang = new THREE.Vector3();
    const pIn = new THREE.Vector3();
    const nIn = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const norm = new THREE.Vector3();

    // Smooth S-curves for pose transitions
    const hb = this.hangBlend * this.hangBlend * (3 - 2 * this.hangBlend);
    const ib = this.indoorBlend * this.indoorBlend * (3 - 2 * this.indoorBlend);

    // Flip arc (lifts slightly & rotates smoothly around the rail bar)
    const flipAngle = this.flipProgress * Math.PI;
    const flipLift = Math.sin(flipAngle) * 0.22;

    // Base half-thickness of cotton futon (flat 0.028m -> sun-baked ultra-fluffy 0.095m!)
    const baseHalfThick = 0.026 + this.displayLoft * 0.056;
    const wrinkleAmp = (1.0 - this.sunWarmth * 0.82) * 0.0085;

    // Slight smooth bounce when transferring over the handrail or into the room
    const arcHang = Math.sin(hb * Math.PI) * 0.22;
    const arcIn = Math.sin(ib * Math.PI) * 0.34;

    for (let j = 0; j <= SEG_V; j++) {
      const vRaw = j / SEG_V;
      // When flipped 180°, swap front/back drape direction seamlessly
      const v = this.flipProgress > 0.5 ? 1.0 - vRaw : vRaw;

      for (let i = 0; i <= SEG_U; i++) {
        const u = i / SEG_U;
        const idx = j * (SEG_U + 1) + i;

        this._sampleFolded(u, v, elapsed, pFold, nFold);
        this._sampleHanging(u, v, elapsed, pHang, nHang);
        this._sampleIndoors(u, v, elapsed, pIn, nIn);

        // Blend folded -> hanging -> indoors
        pos.copy(pFold).lerp(pHang, hb);
        norm.copy(nFold).lerp(nHang, hb).normalize();
        pos.y += arcHang;

        if (ib > 0.0001) {
          pos.lerp(pIn, ib);
          norm.lerp(nIn, ib).normalize();
          pos.y += arcIn;
        }

        // Apply mid-flip lift & flutter
        if (flipLift > 0.001) {
          pos.y += flipLift * (1.0 - Math.abs(v - 0.5) * 0.7);
          pos.z += Math.sin(flipAngle * 2.0) * 0.09 * (v - 0.5);
        }

        // Local puffiness boost where the child beat the futon!
        const localClean = this._sampleLocalClean(u, vRaw);
        const waveDisp = this._sampleWave(u, vRaw);

        // Quilted baffle pillowing (dramatically plumper when puffed indoors!)
        const quilt = this.quiltFactor[idx];
        const pillow = this.edgePillow[idx];
        const wrinkle = this.creaseNoise[idx] * wrinkleAmp * (1.0 - localClean * 0.55);

        const localThick =
          baseHalfThick *
          (0.84 + 0.30 * localClean) *
          (0.65 + 0.55 * quilt) *
          pillow;

        // Flip normal sign when flipped so frontMesh stays on the front cotton side & backMesh on ivory side
        const sideSign = this.flipProgress > 0.5 ? -1 : 1;

        // Apply wave displacement to shared centerline so front & back seams stay 100% airtight at perimeter!
        // Clamp inward impact wave so hanging futon compresses realistically against parapet without ever clipping through!
        const clampedWave = this.pose === 'hanging' ? Math.max(-0.048, waveDisp) : waveDisp;
        const centerShift = clampedWave * 0.55 * (0.25 + 0.75 * pillow);
        const wrinkleOff = wrinkle * pillow;
        const outFront = centerShift + (localThick + wrinkleOff) * sideSign;
        const outBack = centerShift - (localThick + wrinkleOff * 0.65) * sideSign;

        let fx = pos.x + norm.x * outFront;
        let fy = pos.y + norm.y * outFront;
        let fz = pos.z + norm.z * outFront;
        let bx = pos.x + norm.x * outBack;
        let by = pos.y + norm.y * outBack;
        let bz = pos.z + norm.z * outBack;

        // Hard physical collision barrier: front flap (v > 0.52) never penetrates coping/parapet wall (Z >= -0.57)
        if (this.pose === 'hanging' && this.indoorBlend < 0.05 && v > 0.52 && fy < 0.92) {
          if (bz < -0.568) {
            const push = -0.568 - bz;
            bz += push;
            fz += push * 0.75;
          }
        }

        const i3 = idx * 3;
        fPos[i3] = fx;
        fPos[i3 + 1] = fy;
        fPos[i3 + 2] = fz;

        bPos[i3] = bx;
        bPos[i3 + 1] = by;
        bPos[i3 + 2] = bz;
      }
    }

    this.frontMesh.geometry.attributes.position.needsUpdate = true;
    this.backMesh.geometry.attributes.position.needsUpdate = true;
    this.frontMesh.geometry.computeVertexNormals();
    this.backMesh.geometry.computeVertexNormals();
    this.frontMesh.geometry.computeBoundingSphere();
    this.backMesh.geometry.computeBoundingSphere();
  }

  update(dt, elapsed, onPuffTrigger) {
    // 1. Macro pose blend interpolation
    const targetHang = this.pose === 'hanging' ? 1 : this.pose === 'indoors' ? 1 : 0;
    const targetIndoor = this.pose === 'indoors' ? 1 : 0;

    this.hangBlend += (targetHang - this.hangBlend) * Math.min(1, dt * 4.8);
    this.indoorBlend += (targetIndoor - this.indoorBlend) * Math.min(1, dt * 3.8);
    this.flipProgress += (this.targetFlip - this.flipProgress) * Math.min(1, dt * 4.5);

    // 2. Loft / fluffiness dynamics
    let targetLoft = 0.38; // flat & compressed initially
    if (this.pose === 'hanging') {
      // Gently warms & gains airiness as you beat it on the sunny rail
      this.sunWarmth = Math.min(1.0, this.sunWarmth + dt * 0.018);
      targetLoft = 0.42 + this.fluffCharge * 0.42 + this.sunWarmth * 0.14;
    } else if (this.pose === 'indoors') {
      if (this.indoorBlend > 0.85) {
        this.indoorPuffTimer += dt;
        if (!this.hasPuffed && this.indoorPuffTimer > 0.18) {
          this.hasPuffed = true;
          if (onPuffTrigger) onPuffTrigger();
        }
        // Dramatic, deeply satisfying cloud-like puff-up!
        const puffEase = Math.min(1, this.indoorPuffTimer / 1.55);
        const smoothPuff = 1 - Math.pow(1 - puffEase, 3);
        const maxFluff = 1.05 + this.fluffCharge * 0.62;
        targetLoft = 0.44 + (maxFluff - 0.44) * smoothPuff;
      } else {
        targetLoft = 0.44;
      }
    }

    this.displayLoft += (targetLoft - this.displayLoft) * Math.min(1, dt * 3.5);

    // 3. Step 2D cloth wave simulation
    this._stepWavePhysics(dt);

    // 4. Update mesh vertices & normals
    this._updateVertices(dt, elapsed);
  }
}
