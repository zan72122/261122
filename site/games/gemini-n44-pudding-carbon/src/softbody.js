import * as THREE from 'three';

/**
 * Builds a 100% seam-free, welded revolution geometry for the hero custard pudding.
 * Features classic 12-flute scalloped mold ribs, rounded crown & fillet base,
 * seam-free planar-blended UVs, and aPuddingMeta attribute (hNorm, theta, scoopCutMask).
 */
export function createPuddingGeometry({
  radiusBottom = 0.34,
  radiusTop = 0.235,
  height = 0.35,
  fluteCount = 12,
  fluteAmp = 0.019,
  radialSegs = 72,
  heightSegs = 36,
  capSegs = 12,
  baseSegs = 6,
} = {}) {
  const rings = [];

  // 1. Bottom center -> base rings (y = 0)
  for (let b = 1; b <= baseSegs; b++) {
    const f = b / baseSegs;
    rings.push({ r: radiusBottom * 0.94 * f, y: 0.0, hNorm: 0.0, fluteWeight: 0.0 });
  }

  // 2. Continuous C2-smooth side wall + luscious rounded crown shoulder + gentle dome!
  const profileSteps = heightSegs + capSegs;
  for (let i = 0; i <= profileSteps; i++) {
    const u = i / profileSteps; // 0 bottom foot .. 1 top center
    if (u <= 0.76) {
      // Fluted custard side wall with soft basal fillet & gentle belly
      const t = u / 0.76; // 0 .. 1 up to shoulder start
      const footFillet = Math.sin(Math.min(1, t / 0.10) * Math.PI * 0.5);
      let r = THREE.MathUtils.lerp(radiusBottom, radiusTop, Math.pow(t, 0.90));
      r += Math.sin(t * Math.PI) * 0.013;
      r *= 0.94 + 0.06 * footFillet;
      const y = t * height * 0.90;
      const fluteWeight = Math.sin(t * Math.PI) * 0.95;
      rings.push({ r, y, hNorm: y / height, fluteWeight });
    } else if (i < profileSteps) {
      // Smooth superellipse rounded shoulder curving seamlessly into domed caramel crown!
      const k = (u - 0.76) / 0.24; // 0 at shoulder .. 1 at center apex
      const ang = k * Math.PI * 0.5;
      const r = radiusTop * Math.pow(Math.cos(ang), 0.88);
      const y = height * (0.90 + 0.115 * Math.pow(Math.sin(ang), 0.78));
      const fluteWeight = Math.pow(1 - k, 2.5) * 0.22;
      rings.push({ r, y, hNorm: Math.min(1.0, y / height), fluteWeight });
    }
  }

  const ringCount = rings.length;
  // Total vertices: 1 bottom center + ringCount * radialSegs + 1 top center apex
  const totalVerts = 2 + ringCount * radialSegs;
  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const meta = new Float32Array(totalVerts * 3);
  const indices = [];

  // Vertex 0: bottom center
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 0.5;
  meta[0] = 0;
  meta[1] = 0;
  meta[2] = 0;

  // Ring vertices
  for (let ri = 0; ri < ringCount; ri++) {
    const { r, y, hNorm, fluteWeight } = rings[ri];
    for (let si = 0; si < radialSegs; si++) {
      const theta = (si / radialSegs) * Math.PI * 2 - Math.PI;
      const flute = 1.0 + fluteAmp * fluteWeight * Math.cos(fluteCount * theta);
      const rad = r * flute;
      const vx = Math.cos(theta) * rad;
      const vz = Math.sin(theta) * rad;

      const vIdx = 1 + ri * radialSegs + si;
      positions[vIdx * 3] = vx;
      positions[vIdx * 3 + 1] = y;
      positions[vIdx * 3 + 2] = vz;

      // Seam-free top-down radial UV expanded with height so vanilla specks never have a seam!
      const uvRad = (rad + (1 - hNorm) * 0.14) / (radiusBottom * 1.45);
      uvs[vIdx * 2] = 0.5 + Math.cos(theta) * uvRad * 0.46;
      uvs[vIdx * 2 + 1] = 0.5 + Math.sin(theta) * uvRad * 0.46;

      meta[vIdx * 3] = hNorm;
      meta[vIdx * 3 + 1] = theta;
      meta[vIdx * 3 + 2] = 0.0;
    }
  }

  // Last vertex: top apex
  const topApexIdx = totalVerts - 1;
  positions[topApexIdx * 3] = 0;
  positions[topApexIdx * 3 + 1] = height + 0.014;
  positions[topApexIdx * 3 + 2] = 0;
  uvs[topApexIdx * 2] = 0.5;
  uvs[topApexIdx * 2 + 1] = 0.5;
  meta[topApexIdx * 3] = 1.0;
  meta[topApexIdx * 3 + 1] = 0.0;
  meta[topApexIdx * 3 + 2] = 0.0;

  // Bottom center fan (facing downward: outward normal -Y)
  for (let si = 0; si < radialSegs; si++) {
    const next = (si + 1) % radialSegs;
    indices.push(0, 1 + next, 1 + si);
  }

  // Ring-to-ring quads (facing outward/upward: theta increases clockwise in XZ, so (a, c, d) & (a, d, b) face OUTWARD!)
  for (let ri = 0; ri < ringCount - 1; ri++) {
    const rowA = 1 + ri * radialSegs;
    const rowB = 1 + (ri + 1) * radialSegs;
    for (let si = 0; si < radialSegs; si++) {
      const next = (si + 1) % radialSegs;
      const a = rowA + si;
      const b = rowA + next;
      const c = rowB + si;
      const d = rowB + next;
      indices.push(a, c, d);
      indices.push(a, d, b);
    }
  }

  // Top apex fan (facing upward +Y!)
  const lastRow = 1 + (ringCount - 1) * radialSegs;
  for (let si = 0; si < radialSegs; si++) {
    const next = (si + 1) % radialSegs;
    indices.push(lastRow + si, topApexIdx, lastRow + next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aPuddingMeta', new THREE.BufferAttribute(meta, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  geo.userData.basePositions = new Float32Array(positions);
  geo.userData.baseMeta = new Float32Array(meta);
  geo.userData.height = height;
  geo.userData.radiusBottom = radiusBottom;
  return geo;
}

/**
 * Multi-Mode Continuum Soft-Body Physics for the Hero Custard Pudding!
 * Supports:
 * - Volume-preserving squash & stretch
 * - S-curve shear + lagging crown whip harmonic
 * - Quadrupole elliptical wobble
 * - Direct raycast finger poke dimples & elastic pull
 * - Traveling capillary surface ripples
 * - Real 3D spoon bite subtraction!
 */
export class PuddingSoftBody {
  constructor(mesh) {
    this.mesh = mesh;
    this.geo = mesh.geometry;
    this.basePos = this.geo.userData.basePositions;
    this.baseMeta = this.geo.userData.baseMeta;
    this.baseHeight = this.geo.userData.height;

    // Tunable physical constants (updated by egg richness & fill size!)
    this.stiffness = 380;
    this.damping = 4.6;
    this.shearStiffness = 260;
    this.shearDamping = 3.6;
    this.heightScale = 1.0;

    // Dynamic modal state
    this.squash = 0;
    this.squashVel = 0;

    this.shearX = 0;
    this.shearZ = 0;
    this.shearVelX = 0;
    this.shearVelZ = 0;

    this.whipX = 0;
    this.whipZ = 0;
    this.whipVelX = 0;
    this.whipVelZ = 0;

    this.ellipA = 0;
    this.ellipB = 0;
    this.ellipVelA = 0;
    this.ellipVelB = 0;

    this.ripples = []; // { x, y, z, age, amp }
    this.scoops = [];  // { x, y, z, radius }

    // Finger direct tactile interaction
    this.pokeActive = false;
    this.pokeLocal = new THREE.Vector3();
    this.pullOffset = new THREE.Vector3();
    this.pokeDepth = 0;

    this._tmpVec = new THREE.Vector3();
    this._needsRestReset = true;
  }

  configureByRecipe(eggCount = 1, fillScale = 1.0) {
    this.heightScale = THREE.MathUtils.clamp(fillScale, 0.82, 1.24);
    // More eggs = firmer, bouncier royal custard; 1 egg = extra delicate wobbly purin!
    const rich = THREE.MathUtils.clamp((eggCount - 1) / 2, 0, 1);
    this.stiffness = THREE.MathUtils.lerp(310, 460, rich) / Math.sqrt(this.heightScale);
    this.damping = THREE.MathUtils.lerp(3.7, 4.9, rich);
    this.shearStiffness = THREE.MathUtils.lerp(205, 315, rich) / this.heightScale;
    this.shearDamping = THREE.MathUtils.lerp(2.9, 4.0, rich);
  }

  resetClean() {
    this.squash = 0;
    this.squashVel = 0;
    this.shearX = this.shearZ = 0;
    this.shearVelX = this.shearVelZ = 0;
    this.whipX = this.whipZ = 0;
    this.whipVelX = this.whipVelZ = 0;
    this.ellipA = this.ellipB = 0;
    this.ellipVelA = this.ellipVelB = 0;
    this.ripples.length = 0;
    this.scoops.length = 0;
    this.pokeActive = false;
    this.pokeDepth = 0;
    this.pullOffset.set(0, 0, 0);

    const metaAttr = this.geo.attributes.aPuddingMeta;
    metaAttr.array.set(this.baseMeta);
    metaAttr.needsUpdate = true;
    this.updateGeometry(0);
  }

  impulse({ squashVel = 0, shearVelX = 0, shearVelZ = 0, ellipA = 0, ellipB = 0 } = {}) {
    this.squashVel += squashVel;
    this.shearVelX += shearVelX;
    this.shearVelZ += shearVelZ;
    this.whipVelX -= shearVelX * 0.65;
    this.whipVelZ -= shearVelZ * 0.65;
    this.ellipVelA += ellipA;
    this.ellipVelB += ellipB;
  }

  addRipple(localPoint, amp = 0.028) {
    if (this.ripples.length >= 5) this.ripples.shift();
    this.ripples.push({
      x: localPoint.x,
      y: localPoint.y,
      z: localPoint.z,
      age: 0,
      amp,
    });
  }

  setFingerTouch(active, worldPoint = null, worldDelta = null) {
    this.pokeActive = active;
    if (active && worldPoint) {
      this._tmpVec.copy(worldPoint);
      this.mesh.worldToLocal(this._tmpVec);
      this.pokeLocal.copy(this._tmpVec);
      if (worldDelta) {
        this.pullOffset.x = THREE.MathUtils.clamp(worldDelta.x * 0.55, -0.14, 0.14);
        this.pullOffset.y = THREE.MathUtils.clamp(worldDelta.y * 0.35, -0.09, 0.08);
        this.pullOffset.z = THREE.MathUtils.clamp(worldDelta.z * 0.55, -0.14, 0.14);
      }
    } else if (!active && this.pokeDepth > 0.01) {
      // Elastic snap-back purun when finger releases!
      this.shearVelX -= this.pullOffset.x * 16.0;
      this.shearVelZ -= this.pullOffset.z * 16.0;
      this.squashVel += (0.85 - this.pullOffset.y * 8.0);
      this.addRipple(this.pokeLocal, 0.024);
      this.pullOffset.set(0, 0, 0);
    }
  }

  addScoopBite(worldPoint, radius = 0.105) {
    if (this.scoops.length >= 8) return false;
    const loc = this._tmpVec.copy(worldPoint);
    this.mesh.worldToLocal(loc);
    // Keep bite near outer surface/crown so it looks appetizing and clean
    loc.y = THREE.MathUtils.clamp(loc.y, this.baseHeight * 0.28, this.baseHeight * this.heightScale * 1.02);
    this.scoops.push({
      x: loc.x,
      y: loc.y / this.heightScale,
      z: loc.z,
      radius,
    });
    this.impulse({
      squashVel: -1.35,
      shearVelX: -loc.x * 7.5,
      shearVelZ: -loc.z * 7.5,
      ellipA: 1.4,
    });
    this.addRipple(loc, 0.032);
    return true;
  }

  getEnergy() {
    return (
      Math.abs(this.squashVel) +
      Math.hypot(this.shearVelX, this.shearVelZ) +
      Math.hypot(this.whipVelX, this.whipVelZ) * 0.5
    );
  }

  step(dt) {
    const subSteps = 2;
    const h = Math.min(dt, 0.05) / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // Vertical squash spring
      const targetSquash = this.pokeActive ? -0.08 + this.pullOffset.y * 0.6 : 0;
      const fSquash = -this.stiffness * (this.squash - targetSquash) - this.damping * this.squashVel;
      this.squashVel += fSquash * h;
      this.squash += this.squashVel * h;
      this.squash = THREE.MathUtils.clamp(this.squash, -0.46, 0.38);

      // Primary shear spring
      const targetSX = this.pokeActive ? this.pullOffset.x * 1.15 : 0;
      const targetSZ = this.pokeActive ? this.pullOffset.z * 1.15 : 0;
      this.shearVelX += (-this.shearStiffness * (this.shearX - targetSX) - this.shearDamping * this.shearVelX) * h;
      this.shearVelZ += (-this.shearStiffness * (this.shearZ - targetSZ) - this.shearDamping * this.shearVelZ) * h;
      this.shearX += this.shearVelX * h;
      this.shearZ += this.shearVelZ * h;

      // Secondary crown whip spring (higher freq, driven by shear acceleration)
      const whipK = this.shearStiffness * 1.85;
      const whipD = this.shearDamping * 0.92;
      this.whipVelX += (-whipK * (this.whipX - this.shearX * 0.35) - whipD * this.whipVelX) * h;
      this.whipVelZ += (-whipK * (this.whipZ - this.shearZ * 0.35) - whipD * this.whipVelZ) * h;
      this.whipX += this.whipVelX * h;
      this.whipZ += this.whipVelZ * h;

      // Quadrupole elliptical mode
      const ellipK = this.stiffness * 0.88;
      const ellipD = this.damping * 0.95;
      this.ellipVelA += (-ellipK * this.ellipA - ellipD * this.ellipVelA) * h;
      this.ellipVelB += (-ellipK * this.ellipB - ellipD * this.ellipVelB) * h;
      this.ellipA += this.ellipVelA * h;
      this.ellipB += this.ellipVelB * h;
    }

    // Poke dimple smoothing
    const targetPoke = this.pokeActive ? 1.0 : 0.0;
    this.pokeDepth += (targetPoke - this.pokeDepth) * Math.min(1, dt * 18);

    // Advance capillary surface ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += dt;
      if (this.ripples[i].age > 1.35) {
        this.ripples.splice(i, 1);
      }
    }

    this.updateGeometry(dt);
  }

  updateGeometry() {
    const posAttr = this.geo.attributes.position;
    const metaAttr = this.geo.attributes.aPuddingMeta;
    const pos = posAttr.array;
    const meta = metaAttr.array;
    const base = this.basePos;
    const count = posAttr.count;

    const sy = Math.max(0.52, 1.0 + this.squash);
    // Exact volume-preserving radial expansion: r_scale = 1 / sqrt(sy)
    const invSqrtSy = 1.0 / Math.sqrt(sy);
    const hScale = this.heightScale;
    const hasScoops = this.scoops.length > 0;
    const hasRipples = this.ripples.length > 0;
    const doPoke = this.pokeDepth > 0.002;

    let metaDirty = false;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let bx = base[i3];
      let by = base[i3 + 1];
      let bz = base[i3 + 2];
      const hNorm = this.baseMeta[i3];
      const theta = this.baseMeta[i3 + 1];

      // 3D Spoon bite cavities (in rest space so bites jiggle naturally with the pudding!)
      let cutMask = 0.0;
      if (hasScoops && by > 0.005) {
        for (let s = 0; s < this.scoops.length; s++) {
          const sc = this.scoops[s];
          const dx = bx - sc.x;
          const dy = by - sc.y;
          const dz = bz - sc.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < sc.radius) {
            // Pull vertex smoothly inward toward pudding core to carve concave spoon scoop!
            const indent = Math.cos((dist / sc.radius) * Math.PI * 0.5);
            const carve = indent * sc.radius * 0.78;
            const rLen = Math.hypot(bx, bz) || 1;
            bx -= (bx / rLen) * carve * 0.82;
            bz -= (bz / rLen) * carve * 0.82;
            by = Math.max(0.015, by - carve * 0.48);
            cutMask = Math.max(cutMask, THREE.MathUtils.smoothstep(indent, 0.08, 0.38));
          }
        }
      }
      if (meta[i3 + 2] !== cutMask) {
        meta[i3 + 2] = cutMask;
        metaDirty = true;
      }

      // Volume-preserving vertical squash + juicy lower-belly bulge
      const bellyProfile = Math.sin(Math.pow(hNorm, 0.72) * Math.PI * 0.88 + 0.12);
      const radialScale = 1.0 + (invSqrtSy - 1.0) * (0.35 + 0.88 * bellyProfile);

      // Quadrupole elliptical mode
      const ellip = 1.0 + (this.ellipA * Math.cos(2 * theta) + this.ellipB * Math.sin(2 * theta)) * 0.08 * hNorm;

      let x = bx * radialScale * ellip;
      let z = bz * radialScale * ellip;
      let y = by * hScale * sy;

      // S-curve primary shear + crown whip harmonic
      const hQuad = hNorm * hNorm;
      const hCubic = hQuad * hNorm;
      const dxShear = this.shearX * hQuad + (this.whipX - this.shearX * 0.35) * hCubic * 1.45;
      const dzShear = this.shearZ * hQuad + (this.whipZ - this.shearZ * 0.35) * hCubic * 1.45;
      x += dxShear;
      z += dzShear;

      // Slight rotational tilt of crown when shearing (realistic continuum bending!)
      y -= (bx * dxShear + bz * dzShear) * 0.52 * hNorm;

      // Localized finger poke dimple
      if (doPoke && y > 0.01) {
        const pdx = x - this.pokeLocal.x;
        const pdy = y - this.pokeLocal.y;
        const pdz = z - this.pokeLocal.z;
        const pDistSq = pdx * pdx + pdy * pdy + pdz * pdz;
        const dimple = Math.exp(-pDistSq / 0.013) * this.pokeDepth;
        const rLen = Math.hypot(x, z) || 1;
        x -= (x / rLen) * dimple * 0.022;
        z -= (z / rLen) * dimple * 0.022;
        y = Math.max(0.0, y - dimple * 0.042);
      }

      // Concentric capillary surface ripples
      if (hasRipples && y > 0.005) {
        for (let r = 0; r < this.ripples.length; r++) {
          const rp = this.ripples[r];
          const rdx = x - rp.x;
          const rdy = y - rp.y;
          const rdz = z - rp.z;
          const d = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
          const wavePhase = d * 34.0 - rp.age * 24.0;
          const env = Math.exp(-d * 5.5 - rp.age * 3.1) * (wavePhase < 1.5 ? 1.0 : 0.4);
          const disp = Math.sin(wavePhase) * rp.amp * env;
          const rLen = Math.hypot(x, z) || 1;
          x += (x / rLen) * disp * 0.72;
          z += (z / rLen) * disp * 0.72;
          y = Math.max(0.0, y + disp * 0.55 * hNorm);
        }
      }

      pos[i3] = x;
      pos[i3 + 1] = Math.max(0, y);
      pos[i3 + 2] = z;
    }

    posAttr.needsUpdate = true;
    if (metaDirty) metaAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/**
 * Plump, glossy Soft-Body Raw Egg Yolk with poke wobble & membrane pop!
 */
export class YolkSoftBody {
  constructor(material, radius = 0.096) {
    const geo = new THREE.SphereGeometry(radius, 40, 28);
    // Rest shape: gravity-flattened luscious yolk dome sitting on base y=0
    const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const ny = pos[i + 1] / radius; // -1 .. 1
      const flatten = ny < 0 ? 0.45 : 0.74;
      const spread = 1.0 + (1.0 - Math.abs(ny)) * 0.12;
      pos[i] *= spread;
      pos[i + 1] = (ny * flatten + 0.45) * radius;
      pos[i + 2] *= spread;
    }
    geo.computeVertexNormals();
    geo.userData.basePositions = new Float32Array(pos);

    this.geo = geo;
    this.basePos = geo.userData.basePositions;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.squash = 0;
    this.squashVel = 0;
    this.shearX = 0;
    this.shearZ = 0;
    this.velX = 0;
    this.velZ = 0;
    this.popped = false;
    this.popProgress = 0;
    this.pokeCount = 0;
  }

  impulse(syVel = -1.8, sxVel = 0, szVel = 0) {
    this.squashVel += syVel;
    this.velX += sxVel;
    this.velZ += szVel;
  }

  poke(dx = 0, dz = 0) {
    this.pokeCount++;
    this.impulse(-2.2, dx * 3.5, dz * 3.5);
    if (this.pokeCount >= 3 && !this.popped) {
      this.popped = true;
      return true; // Membrane popped!
    }
    return false;
  }

  step(dt) {
    const h = Math.min(dt, 0.04);
    this.squashVel += (-260 * this.squash - 3.6 * this.squashVel) * h;
    this.squash = THREE.MathUtils.clamp(this.squash + this.squashVel * h, -0.48, 0.42);

    this.velX += (-190 * this.shearX - 3.2 * this.velX) * h;
    this.velZ += (-190 * this.shearZ - 3.2 * this.velZ) * h;
    this.shearX += this.velX * h;
    this.shearZ += this.velZ * h;

    if (this.popped) {
      this.popProgress = Math.min(1, this.popProgress + dt * 2.6);
    }

    const sy = Math.max(0.22, (1 + this.squash) * THREE.MathUtils.lerp(1.0, 0.26, this.popProgress));
    const sxz = (1 / Math.sqrt(Math.max(0.35, 1 + this.squash))) * THREE.MathUtils.lerp(1.0, 1.72, this.popProgress);

    const posAttr = this.geo.attributes.position;
    const pos = posAttr.array;
    const base = this.basePos;
    for (let i = 0; i < pos.length; i += 3) {
      const bx = base[i];
      const by = base[i + 1];
      const bz = base[i + 2];
      const hNorm = THREE.MathUtils.clamp(by / 0.12, 0, 1);
      pos[i] = bx * sxz + this.shearX * hNorm * hNorm;
      pos[i + 1] = Math.max(0.002, by * sy);
      pos[i + 2] = bz * sxz + this.shearZ * hNorm * hNorm;
    }
    posAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}
