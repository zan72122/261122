import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Beer-Lambert Translucent Amber Maple Syrup Material:
// Thin films look bright golden honey; thick pooled areas & hanging droplets look deep mahogany-amber!
function createMapleSyrupMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xc86408),
    emissive: new THREE.Color(0x301100),
    emissiveIntensity: 0.24,
    roughness: 0.015,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.012,
    ior: 1.50,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       attribute float aThickness;
       varying float vThickness;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vThickness = aThickness;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying float vThickness;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
       // Authentic Canadian golden-to-deep-amber Beer-Lambert absorption (warm honey gold -> dark amber)!
       float depthFactor = clamp(vThickness * 155.0, 0.0, 1.0);
       vec3 thinHoney = vec3(1.12, 0.82, 0.22);
       vec3 deepAmber = vec3(0.44, 0.16, 0.012);
       vec3 beerTint = mix(thinHoney, deepAmber, pow(depthFactor, 0.72));
       gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * beerTint * 1.32, 0.76);
       gl_FragColor.a = step(0.00018, vThickness) * clamp(0.58 + pow(depthFactor, 0.5) * 0.39, 0.0, 0.96);
       if (gl_FragColor.a < 0.02) discard;
       #include <dithering_fragment>
      `
    );
  };
  return mat;
}

export class StackToppingsSystem {
  constructor(plateGroup) {
    this.plateGroup = plateGroup;
    this.group = new THREE.Group();
    plateGroup.add(this.group);

    this.syrupMat = createMapleSyrupMaterial();

    this._buildMeltingButter();
    this._buildViscousSyrupFluid();
    this._buildPouringSyrupStream();
    this._buildStackBerries();

    this.active = false;
    this.stackTopY = 0.04;
    this.stackRadius = 0.082;
    this.pancakeLayers = []; // [{ yTop, radius }]
  }

  _buildMeltingButter() {
    this.butterGroup = new THREE.Group();
    this.butterGroup.visible = false;
    this.group.add(this.butterGroup);

    // Solid cultured butter pat that softens, rounds & shrinks as heat melts it!
    this.butterSolidMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff0a5,
      roughness: 0.24,
      clearcoat: 0.52,
      clearcoatRoughness: 0.18,
      sheen: 0.3,
      sheenColor: 0xfffce6,
    });
    const patGeo = new RoundedBoxGeometry(0.033, 0.014, 0.033, 4, 0.0045);
    this.butterPatMesh = new THREE.Mesh(patGeo, this.butterSolidMat);
    this.butterPatMesh.castShadow = true;
    this.butterPatMesh.position.y = 0.007;
    this.butterGroup.add(this.butterPatMesh);

    // Glistening melted golden-milkfat puddle around & beneath the butter pat!
    const meltGeo = new THREE.CircleGeometry(1, 36);
    meltGeo.rotateX(-Math.PI / 2);
    // Add organic wavy puddle lobes
    const mp = meltGeo.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i);
      const z = mp.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 0.1) {
        const a = Math.atan2(z, x);
        const lobe = 1 + 0.12 * Math.sin(a * 5 + 0.7) + 0.08 * Math.cos(a * 8 - 1.2);
        mp.setXYZ(i, x * lobe, Math.max(0, (1 - r) * 0.0018), z * lobe);
      }
    }
    meltGeo.computeVertexNormals();
    this.butterPoolMat = new THREE.MeshPhysicalMaterial({
      color: 0xfad85a,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.butterPoolMesh = new THREE.Mesh(meltGeo, this.butterPoolMat);
    this.butterPoolMesh.position.y = 0.0008;
    this.butterPoolMesh.scale.set(0.016, 1, 0.016);
    this.butterGroup.add(this.butterPoolMesh);

    // Tiny white milk-solid foam beads along melting butter rim for extreme close-up realism!
    const foamGeo = new THREE.SphereGeometry(0.0014, 8, 6);
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xfffdf2,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
    });
    this.butterFoam = new THREE.InstancedMesh(foamGeo, foamMat, 22);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const rr = 0.017 + (i % 3) * 0.0025;
      dummy.position.set(Math.cos(a) * rr, 0.0012, Math.sin(a) * rr);
      dummy.scale.set(1.1, 0.55, 1.1);
      dummy.updateMatrix();
      this.butterFoam.setMatrixAt(i, dummy.matrix);
    }
    this.butterGroup.add(this.butterFoam);

    // Butter physics state (in plate local XZ)
    this.hasButter = false;
    this.butterMelt = 0; // 0 crisp cold block -> 1 luscious melted pool
    this.butterX = 0;
    this.butterZ = 0;
    this.butterVelX = 0;
    this.butterVelZ = 0;
    this.butterBounceY = 0;
    this.butterBounceVel = 0;
  }

  _buildViscousSyrupFluid() {
    // 1. Top Pancake 3D Viscous Heightfield Cap (36 angular sectors x 14 radial rings)
    this.angCount = 32;
    this.ringCount = 13;
    const vertCount = 1 + this.angCount * this.ringCount;
    const capGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(vertCount * 3);
    const thicknessAttr = new Float32Array(vertCount);
    const indices = [];

    // Center fan (CCW winding when viewed from +Y so normals point UPWARD!)
    for (let a = 0; a < this.angCount; a++) {
      const nextA = (a + 1) % this.angCount;
      indices.push(0, 1 + nextA, 1 + a);
    }
    // Outer rings (CCW winding from +Y!)
    for (let r = 0; r < this.ringCount - 1; r++) {
      const row0 = 1 + r * this.angCount;
      const row1 = 1 + (r + 1) * this.angCount;
      for (let a = 0; a < this.angCount; a++) {
        const nextA = (a + 1) % this.angCount;
        indices.push(row0 + a, row1 + nextA, row1 + a);
        indices.push(row0 + a, row0 + nextA, row1 + nextA);
      }
    }
    capGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    capGeo.setAttribute('aThickness', new THREE.BufferAttribute(thicknessAttr, 1));
    capGeo.setIndex(indices);

    this.syrupCapMesh = new THREE.Mesh(capGeo, this.syrupMat);
    this.syrupCapMesh.visible = false;
    this.syrupCapMesh.renderOrder = 4;
    this.group.add(this.syrupCapMesh);

    this.capHeights = new Float32Array(vertCount);
    this.capTemp = new Float32Array(vertCount);

    // 2. 14 Lush Organic Viscous Side-Drip Tendrils ("シロップがとろりと垂れる流体") cascading down stacked pancakes!
    this.dripCount = 14;
    this.dripSegs = 18;
    this.drips = [];
    for (let i = 0; i < this.dripCount; i++) {
      const angle = (i / this.dripCount) * Math.PI * 2 + Math.sin(i * 2.7) * 0.14;
      const geo = this._createEmptyRibbonTube(this.dripSegs, 10);
      const mesh = new THREE.Mesh(geo, this.syrupMat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.drips.push({
        angle,
        supply: 0,       // accumulated syrup overflowing this sector
        progress: 0,     // 0 at top rim -> 1.0 reaches ceramic plate!
        width: 0.0068 + (i % 3) * 0.0024,
        speed: 0.22 + (i % 4) * 0.065,
        mesh,
      });
    }

    // 3. Expanding Glossy Amber Plate Pool Ring around base of stack
    const poolGeo = new THREE.RingGeometry(0.035, 1.0, 48, 4);
    poolGeo.rotateX(-Math.PI / 2);
    const pVerts = poolGeo.attributes.position.count;
    const poolThick = new Float32Array(pVerts);
    const pPos = poolGeo.attributes.position;
    for (let i = 0; i < pVerts; i++) {
      const rx = pPos.getX(i);
      const rz = pPos.getZ(i);
      const rr = Math.hypot(rx, rz);
      const a = Math.atan2(rz, rx);
      const wave = 1 + 0.06 * Math.sin(a * 6) + 0.04 * Math.cos(a * 9);
      pPos.setXYZ(i, rx * wave, (1 - rr) * 0.0015, rz * wave);
      poolThick[i] = Math.max(0.001, (1.05 - rr) * 0.0065);
    }
    poolGeo.setAttribute('aThickness', new THREE.BufferAttribute(poolThick, 1));
    poolGeo.computeVertexNormals();

    this.plateSyrupPool = new THREE.Mesh(poolGeo, this.syrupMat);
    this.plateSyrupPool.position.y = 0.0072;
    this.plateSyrupPool.visible = false;
    this.plateSyrupPool.renderOrder = 3;
    this.group.add(this.plateSyrupPool);

    this.platePoolAmount = 0;
    this.totalSyrupPoured = 0;
  }

  _createEmptyRibbonTube(segs, radial) {
    const count = (segs + 1) * (radial + 1);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const thick = new Float32Array(count);
    const indices = [];
    for (let s = 0; s < segs; s++) {
      for (let r = 0; r < radial; r++) {
        const a = s * (radial + 1) + r;
        const b = (s + 1) * (radial + 1) + r;
        const c = (s + 1) * (radial + 1) + (r + 1);
        const d = s * (radial + 1) + (r + 1);
        indices.push(a, b, d, b, c, d);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aThickness', new THREE.BufferAttribute(thick, 1));
    geo.setIndex(indices);
    return geo;
  }

  _buildPouringSyrupStream() {
    const segs = 22;
    const radial = 10;
    const geo = this._createEmptyRibbonTube(segs, radial);
    this.streamMesh = new THREE.Mesh(geo, this.syrupMat);
    this.streamMesh.visible = false;
    this.streamMesh.renderOrder = 6;
    this.group.add(this.streamMesh);
    this.streamFlow = 0;
    this.streamSegs = segs;
    this.streamRadial = radial;
  }

  _buildStackBerries() {
    this.placedBerries = [];
  }

  reset() {
    this.hasButter = false;
    this.butterMelt = 0;
    this.butterGroup.visible = false;
    this.capHeights.fill(0);
    this.syrupCapMesh.visible = false;
    this.drips.forEach((d) => {
      d.supply = 0;
      d.progress = 0;
      d.mesh.visible = false;
    });
    this.platePoolAmount = 0;
    this.plateSyrupPool.visible = false;
    this.totalSyrupPoured = 0;
    this.streamFlow = 0;
    this.streamMesh.visible = false;
    this.placedBerries.forEach((b) => this.group.remove(b.mesh));
    this.placedBerries.length = 0;
  }

  configureStack(pancakes) {
    // pancakes ordered bottom -> top on plateGroup
    this.pancakeLayers = pancakes.map((p) => ({
      yCenter: p.group.position.y,
      yTop: p.group.position.y + p.thickness * 0.48,
      halfH: p.thickness * 0.48,
      radius: p.radius,
      item: p,
    }));
    const top = this.pancakeLayers[this.pancakeLayers.length - 1];
    if (top) {
      this.stackTopY = top.yTop;
      this.stackRadius = top.radius;
    }
  }

  dropButter(localX = 0, localZ = 0) {
    this.hasButter = true;
    this.butterGroup.visible = true;
    this.butterX = THREE.MathUtils.clamp(localX, -this.stackRadius * 0.48, this.stackRadius * 0.48);
    this.butterZ = THREE.MathUtils.clamp(localZ, -this.stackRadius * 0.48, this.stackRadius * 0.48);
    this.butterBounceY = 0.055;
    this.butterBounceVel = -0.18;
  }

  slideButterTo(localX, localZ, dt) {
    if (!this.hasButter) return;
    const maxR = this.stackRadius * 0.62;
    const r = Math.hypot(localX, localZ);
    const tx = r > maxR ? (localX / r) * maxR : localX;
    const tz = r > maxR ? (localZ / r) * maxR : localZ;
    this.butterX = THREE.MathUtils.lerp(this.butterX, tx, Math.min(1, dt * 12));
    this.butterZ = THREE.MathUtils.lerp(this.butterZ, tz, Math.min(1, dt * 12));
    // Rubbing cold butter on warm pancake accelerates melting & stamps glistening butter trail!
    this.butterMelt = Math.min(0.88, this.butterMelt + dt * 0.14);
    const topLayer = this.pancakeLayers[this.pancakeLayers.length - 1];
    if (topLayer && Math.random() < 0.35) {
      topLayer.item.stampButterSoak(
        this.butterX / Math.max(0.04, this.stackRadius),
        this.butterZ / Math.max(0.04, this.stackRadius),
        0.24
      );
    }
  }

  addStrawberry(berryMesh, localX, localZ) {
    const maxR = this.stackRadius * 0.58;
    const r = Math.hypot(localX, localZ);
    const bx = r > maxR ? (localX / r) * maxR : localX;
    const bz = r > maxR ? (localZ / r) * maxR : localZ;
    this.group.add(berryMesh);
    berryMesh.position.set(bx, this.stackTopY + 0.055, bz);
    this.placedBerries.push({
      mesh: berryMesh,
      x: bx,
      z: bz,
      vy: -0.15,
      yOff: 0.055,
    });
  }

  // Pour viscous maple syrup at local plate coordinates (lx, lz)
  pourSyrupAt(lx, lz, dt) {
    const R = Math.max(0.045, this.stackRadius * 0.96);
    this.totalSyrupPoured += dt * 0.52;

    // Wide luscious radial deposit so syrup glazes across the top pancake cleanly!
    const spreadR = 0.068;
    const dist0 = Math.hypot(lx, lz);
    if (dist0 < spreadR) {
      const w0 = 1 - dist0 / spreadR;
      this.capHeights[0] = Math.min(0.0068, this.capHeights[0] + dt * 0.014 * w0);
    }

    for (let r = 0; r < this.ringCount; r++) {
      const rr = ((r + 1) / this.ringCount) * R;
      const row = 1 + r * this.angCount;
      for (let a = 0; a < this.angCount; a++) {
        const ang = (a / this.angCount) * Math.PI * 2;
        const vx = Math.cos(ang) * rr;
        const vz = Math.sin(ang) * rr;
        const d = Math.hypot(vx - lx, vz - lz);
        if (d < spreadR) {
          const w = 1 - d / spreadR;
          this.capHeights[row + a] = Math.min(0.0068, this.capHeights[row + a] + dt * 0.014 * w * (0.4 + 0.6 * w));
        }
      }
    }

    // Feed angular side-drip sectors so thick amber tendrils cascade over the rim!
    const pourAngle = Math.atan2(lz, lx);
    const edgeProximity = THREE.MathUtils.clamp(dist0 / R, 0.45, 1.3);
    this.drips.forEach((drip, idx) => {
      let da = Math.abs(Math.atan2(Math.sin(drip.angle - pourAngle), Math.cos(drip.angle - pourAngle)));
      if (da < 1.15 && (this.totalSyrupPoured > 0.16 || dist0 > R * 0.35)) {
        const focus = (1 - da / 1.15) * edgeProximity;
        drip.supply += dt * 0.95 * focus;
      } else if (this.totalSyrupPoured > 0.34 && idx % 2 === 0) {
        drip.supply += dt * 0.35;
      }
    });
  }

  // Poke squish on stack squeezes out a fresh bead of viscous syrup!
  triggerSqueezeDrip() {
    if (this.totalSyrupPoured < 0.08) return;
    this.drips.forEach((d, idx) => {
      if (idx % 3 === 0) d.supply += 0.22;
    });
  }

  _surfaceDomeY(rNorm) {
    // Matches top pancake's pillowy dome profile!
    const top = this.pancakeLayers[this.pancakeLayers.length - 1];
    if (!top) return this.stackTopY;
    const uy = Math.sqrt(Math.max(0, 1 - Math.min(0.995, rNorm * rNorm)));
    const dome = Math.pow(uy, 0.52);
    return top.yCenter + dome * top.halfH;
  }

  _updateSyrupCapAndDrips(dt, elapsed) {
    if (this.pancakeLayers.length === 0) return;

    // 1. Viscous Laplacian smoothing across top polar grid so syrup spreads silkily ("とろ〜り")
    if (this.totalSyrupPoured > 0.002) {
      this.syrupCapMesh.visible = true;
      this.capTemp.set(this.capHeights);
      const visc = Math.min(0.32, dt * 3.8);

      for (let r = 0; r < this.ringCount; r++) {
        const row = 1 + r * this.angCount;
        for (let a = 0; a < this.angCount; a++) {
          const idx = row + a;
          const prevA = row + ((a - 1 + this.angCount) % this.angCount);
          const nextA = row + ((a + 1) % this.angCount);
          const inner = r === 0 ? 0 : 1 + (r - 1) * this.angCount + a;
          const outer = r === this.ringCount - 1 ? idx : 1 + (r + 1) * this.angCount + a;
          const avg = (this.capTemp[prevA] + this.capTemp[nextA] + this.capTemp[inner] + this.capTemp[outer]) * 0.25;
          // Gentle outward gravity drift + surface tension meniscus bead at outer ring!
          let nextH = THREE.MathUtils.lerp(this.capTemp[idx], avg, visc);
          if (r === this.ringCount - 1 && nextH > 0.0022) {
            // Spill excess over the rim into nearest drip tendril!
            const dripIdx = Math.floor((a / this.angCount) * this.dripCount) % this.dripCount;
            this.drips[dripIdx].supply += (nextH - 0.0022) * 18 * dt;
          }
          this.capHeights[idx] = nextH;
        }
      }
      // Center average
      let sumRing0 = 0;
      for (let a = 0; a < this.angCount; a++) sumRing0 += this.capTemp[1 + a];
      this.capHeights[0] = THREE.MathUtils.lerp(this.capTemp[0], sumRing0 / this.angCount, visc);

      // Update cap geometry vertices
      const pos = this.syrupCapMesh.geometry.attributes.position;
      const th = this.syrupCapMesh.geometry.attributes.aThickness;
      const R = this.stackRadius * 0.965;

      const cH = this.capHeights[0];
      pos.setXYZ(0, 0, this._surfaceDomeY(0) + 0.0020 + cH, 0);
      th.setX(0, cH);

      for (let r = 0; r < this.ringCount; r++) {
        const rNorm = (r + 1) / this.ringCount;
        const rr = rNorm * R;
        const row = 1 + r * this.angCount;
        for (let a = 0; a < this.angCount; a++) {
          const idx = row + a;
          const ang = (a / this.angCount) * Math.PI * 2;
          const h = this.capHeights[idx];
          const rimTaper = r === this.ringCount - 1 ? 0.55 : 1.0;
          const baseDome = this._surfaceDomeY(rNorm * 0.96);
          // Keep syrup film cleanly above pancake crust so zero polygon z-clipping occurs!
          const y = baseDome + 0.0018 + h * rimTaper;
          pos.setXYZ(idx, Math.cos(ang) * rr, y, Math.sin(ang) * rr);
          th.setX(idx, h * (r === this.ringCount - 1 ? 1.3 : 1.0));
        }
      }
      pos.needsUpdate = true;
      th.needsUpdate = true;
      this.syrupCapMesh.geometry.computeVertexNormals();
    }

    // 2. Update cascading viscous 3D drip tendrils along the stacked pancake profile!
    const radial = 10;
    for (let i = 0; i < this.drips.length; i++) {
      const d = this.drips[i];
      if (d.supply < 0.05) continue;

      d.mesh.visible = true;
      const targetProg = Math.min(1.0, (d.supply - 0.05) * 1.55);
      // Viscous slow creep downward ("とろり〜")
      d.progress = THREE.MathUtils.lerp(d.progress, targetProg, Math.min(1, dt * d.speed * 2.2));

      if (d.progress > 0.90) {
        this.platePoolAmount = Math.min(1.0, this.platePoolAmount + dt * 0.18 * d.supply);
      }

      const pos = d.mesh.geometry.attributes.position;
      const th = d.mesh.geometry.attributes.aThickness;
      const ca = Math.cos(d.angle);
      const sa = Math.sin(d.angle);

      for (let s = 0; s <= this.dripSegs; s++) {
        const sNorm = s / this.dripSegs;
        const u = sNorm * Math.max(0.08, d.progress);
        // Trace exact multi-pancake side profile from top rim (u=0) down to plate floor (u=1)!
        const pt = this._sampleStackSideProfile(u, d.angle, elapsed);
        // Wide meniscus root at u=0 merging seamlessly with top syrup cap, tapering into bulbous teardrop tip!
        const rootFlare = (1 - sNorm) * 0.0045;
        const tipBulb = sNorm > 0.72 ? Math.sin(((sNorm - 0.72) / 0.28) * Math.PI) * 0.0048 : 0;
        const rad = (d.width * (1.0 - sNorm * 0.35) + rootFlare + tipBulb) * Math.min(1.3, 0.65 + d.supply * 0.45);

        // Narrow vertical syrup tendril with CCW outward normals (flows DOWNWARD, never sideways!)
        for (let r = 0; r <= radial; r++) {
          const phi = -(r / radial) * Math.PI * 2;
          const outR = Math.cos(phi) * rad * 0.42;
          const tangR = Math.sin(phi) * rad * 0.65;
          const vx = (pt.r + Math.max(0.0, outR)) * ca - tangR * sa;
          const vz = (pt.r + Math.max(0.0, outR)) * sa + tangR * ca;
          const vy = pt.y + Math.cos(phi) * rad * 0.12;
          const vi = s * (radial + 1) + r;
          pos.setXYZ(vi, vx, vy, vz);
          th.setX(vi, rad * 1.5);
        }
      }
      pos.needsUpdate = true;
      th.needsUpdate = true;
      d.mesh.geometry.computeVertexNormals();
    }

    // 3. Expanding glossy amber pool on white ceramic plate
    if (this.platePoolAmount > 0.01) {
      this.plateSyrupPool.visible = true;
      const bottomR = this.pancakeLayers[0].radius;
      const outerR = bottomR * 0.96 + this.platePoolAmount * 0.036;
      this.plateSyrupPool.scale.set(outerR, 1, outerR);
    }
  }

  _sampleStackSideProfile(u, angle, elapsed) {
    // u = 0 starts cleanly inside top syrup cap (0.88*R) and arcs smoothly over rounded hotcake lip!
    const layers = this.pancakeLayers;
    const top = layers[layers.length - 1];
    const plateY = 0.0085;

    if (u < 0.18) {
      const k = u / 0.18;
      const rNorm = THREE.MathUtils.lerp(0.86, 1.03, Math.sin(k * Math.PI * 0.5));
      const y = this._surfaceDomeY(Math.min(0.98, rNorm)) + 0.0020 * (1 - k * 0.4);
      return { r: top.radius * rNorm + 0.0018, y };
    }

    const v = (u - 0.18) / 0.82;
    const rimY = this._surfaceDomeY(0.98) + 0.0010;
    const y = THREE.MathUtils.lerp(rimY, plateY, v);

    let rProfile = top.radius * 1.02;
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const dy = (y - L.yCenter) / Math.max(0.005, L.halfH * 1.12);
      if (Math.abs(dy) < 1.08) {
        const bulge = Math.sqrt(Math.max(0, 1 - Math.pow(dy * 0.88, 2)));
        const lr = L.radius * (0.95 + 0.105 * bulge) + 0.0022;
        rProfile = Math.max(rProfile, lr);
      }
    }
    const wobble = Math.sin(v * 7 + angle * 3) * 0.0008;
    const flareAtPlate = v > 0.86 ? ((v - 0.86) / 0.14) * 0.015 : 0;
    return { r: rProfile + wobble + flareAtPlate, y };
  }

  updatePouringStream(dt, elapsed, active, spoutWorldPos, hitLocalX, hitLocalZ) {
    this.streamFlow = THREE.MathUtils.lerp(this.streamFlow, active ? 1 : 0, Math.min(1, dt * 15));
    if (this.streamFlow < 0.03) {
      this.streamMesh.visible = false;
      return;
    }
    this.streamMesh.visible = true;

    const localSpout = spoutWorldPos.clone();
    this.group.worldToLocal(localSpout);

    const rNorm = Math.min(0.95, Math.hypot(hitLocalX, hitLocalZ) / Math.max(0.04, this.stackRadius));
    const hitY = this._surfaceDomeY(rNorm) + 0.0015;
    const hitPos = new THREE.Vector3(hitLocalX, hitY, hitLocalZ);

    const pos = this.streamMesh.geometry.attributes.position;
    const th = this.streamMesh.geometry.attributes.aThickness;
    const segs = this.streamSegs;
    const radial = this.streamRadial;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Smooth gravity curve from spout lip down to pancake top + viscous coiling wobble near bottom!
      const cx = THREE.MathUtils.lerp(localSpout.x, hitPos.x, Math.pow(t, 0.72));
      const cz = THREE.MathUtils.lerp(localSpout.z, hitPos.z, Math.pow(t, 0.72));
      const cy = THREE.MathUtils.lerp(localSpout.y, hitPos.y, t * t);

      const coil = Math.sin(t * Math.PI) * (t > 0.55 ? 1 : 0.25);
      const wx = cx + Math.sin(elapsed * 18 + t * 9) * 0.0028 * coil;
      const wz = cz + Math.cos(elapsed * 18 + t * 9) * 0.0028 * coil;

      const footSpread = t > 0.88 ? 1 + ((t - 0.88) / 0.12) * 0.9 : 1.0 - t * 0.42;
      const rad = 0.0042 * this.streamFlow * footSpread;

      for (let r = 0; r <= radial; r++) {
        const phi = (r / radial) * Math.PI * 2;
        const vi = s * (radial + 1) + r;
        pos.setXYZ(vi, wx + Math.cos(phi) * rad, cy, wz + Math.sin(phi) * rad);
        th.setX(vi, rad * 1.6);
      }
    }
    pos.needsUpdate = true;
    th.needsUpdate = true;
    this.streamMesh.geometry.computeVertexNormals();
  }

  update(dt, elapsed) {
    if (this.pancakeLayers.length > 0) {
      const top = this.pancakeLayers[this.pancakeLayers.length - 1];
      this.stackTopY = top.yCenter + top.halfH;
      this.stackRadius = top.radius;
    }

    // Melting butter physics on warm pancake stack!
    if (this.hasButter) {
      this.butterBounceVel += (-this.butterBounceY * 140 - this.butterBounceVel * 11) * dt;
      this.butterBounceY += this.butterBounceVel * dt;
      if (this.butterBounceY < 0) {
        this.butterBounceY = 0;
        this.butterBounceVel *= -0.35;
      }

      // Gradually melt ("バターが溶けて") into a wide glistening golden puddle!
      this.butterMelt = Math.min(0.86, this.butterMelt + dt * 0.055);
      const rNorm = Math.min(0.92, Math.hypot(this.butterX, this.butterZ) / Math.max(0.04, this.stackRadius));
      const surfY = this._surfaceDomeY(rNorm);

      // Slight natural slide down dome slope as butter melts!
      if (this.butterMelt > 0.12 && rNorm > 0.05 && rNorm < 0.48) {
        this.butterX += (this.butterX / Math.max(0.01, this.stackRadius)) * dt * 0.0035;
        this.butterZ += (this.butterZ / Math.max(0.01, this.stackRadius)) * dt * 0.0035;
      }

      this.butterGroup.position.set(this.butterX, surfY + Math.max(0, this.butterBounceY), this.butterZ);
      // Tilt slightly along dome normal
      this.butterGroup.rotation.z = -(this.butterX / Math.max(0.05, this.stackRadius)) * 0.18;
      this.butterGroup.rotation.x = (this.butterZ / Math.max(0.05, this.stackRadius)) * 0.18;

      const patH = Math.max(0.18, 1 - this.butterMelt * 0.78);
      const patW = 1 + this.butterMelt * 0.18;
      this.butterPatMesh.scale.set(patW, patH, patW);
      this.butterPatMesh.position.y = 0.007 * patH;

      const poolR = 0.016 + this.butterMelt * 0.046;
      this.butterPoolMesh.scale.set(poolR, 1, poolR);
      this.butterFoam.scale.set(1 + this.butterMelt * 1.45, 1, 1 + this.butterMelt * 1.45);
    }

    // Placed strawberries bounce & settle into syrup pool!
    for (const b of this.placedBerries) {
      b.vy -= 1.4 * dt;
      b.yOff += b.vy * dt;
      if (b.yOff < 0.013) {
        b.yOff = 0.013;
        b.vy *= -0.32;
      }
      const rNorm = Math.min(0.92, Math.hypot(b.x, b.z) / Math.max(0.04, this.stackRadius));
      b.mesh.position.set(b.x, this._surfaceDomeY(rNorm) + b.yOff, b.z);
    }

    this._updateSyrupCapAndDrips(dt, elapsed);
  }
}
