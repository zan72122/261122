// Real-Time Deformable 3D Tamagoyaki Sheet/Roll, Custom Spiral Slices, Melted Cheese & Volumetric Steam

import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { createCookedEggPainter, createSpiralCutTexture, createSteamSpriteTexture } from './textures.js';

// Soft Multi-Puff Rising Kitchen Steam System
export class SteamSystem {
  constructor(scene, maxPuffs = 56) {
    this.maxPuffs = maxPuffs;
    this.texture = createSteamSpriteTexture();
    this.puffs = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < maxPuffs; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0xfffcf6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 12;
      this.group.add(mesh);
      this.puffs.push({
        mesh,
        mat,
        active: false,
        age: 0,
        life: 1.8,
        vx: 0,
        vy: 0.4,
        vz: 0,
        s0: 0.2,
        s1: 0.85,
        maxAlpha: 0.35,
        rotSpeed: 0,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.cursor = 0;
  }

  emit(x, y, z, { count = 1, spread = 0.25, speedY = 0.36, scale0 = 0.18, scale1 = 0.72, alpha = 0.34, life = 2.0 } = {}) {
    for (let n = 0; n < count; n++) {
      const p = this.puffs[this.cursor];
      this.cursor = (this.cursor + 1) % this.maxPuffs;
      p.active = true;
      p.age = 0;
      p.life = life * (0.82 + Math.random() * 0.38);
      p.mesh.visible = true;
      p.mesh.position.set(
        x + (Math.random() - 0.5) * spread,
        y + Math.random() * 0.05,
        z + (Math.random() - 0.5) * spread * 0.8
      );
      p.vx = (Math.random() - 0.45) * 0.08;
      p.vy = speedY * (0.82 + Math.random() * 0.38);
      p.vz = (Math.random() - 0.5) * 0.06;
      p.s0 = scale0 * (0.85 + Math.random() * 0.3);
      p.s1 = scale1 * (0.85 + Math.random() * 0.35);
      p.maxAlpha = alpha * (0.8 + Math.random() * 0.35);
      p.rotSpeed = (Math.random() - 0.5) * 0.55;
      p.mesh.rotation.z = Math.random() * Math.PI * 2;
    }
  }

  update(dt, camera) {
    for (let i = 0; i < this.maxPuffs; i++) {
      const p = this.puffs[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const u = p.age / p.life;
      const curl = Math.sin(p.age * 2.3 + p.phase) * 0.09;
      p.mesh.position.x += (p.vx + curl) * dt;
      p.mesh.position.y += p.vy * (1 - u * 0.35) * dt;
      p.mesh.position.z += p.vz * dt;

      const sc = p.s0 + (p.s1 - p.s0) * Math.pow(u, 0.72);
      p.mesh.scale.setScalar(sc);
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.rotateZ(p.age * p.rotSpeed);

      const fadeIn = Math.min(1, u / 0.18);
      const fadeOut = Math.pow(1 - u, 1.45);
      p.mat.opacity = p.maxAlpha * fadeIn * fadeOut;
    }
  }
}

// Deformable 3D Tamagoyaki Sheet & Multi-Layer Roll inside the Makiyakinabe Pan
export class PanTamagoyakiMesh {
  constructor() {
    this.group = new THREE.Group();
    this.painter = createCookedEggPainter();

    // Pan interior usable span: X in [-0.76, +0.76], Z in [-0.52, +0.52]
    this.panHalfW = 0.76;
    this.panHalfD = 0.51;

    this.uSegs = 56;
    this.vSegs = 20;

    // Materials: Top (glossy moist golden egg) & Bottom/Outer (baked golden-brown sear "yaki-iro"!)
    this.topMat = new THREE.MeshPhysicalMaterial({
      map: this.painter.topTexture,
      bumpMap: this.painter.bumpTexture,
      bumpScale: 0.008,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    });

    this.searMat = new THREE.MeshPhysicalMaterial({
      map: this.painter.bottomTexture,
      bumpMap: this.painter.bumpTexture,
      bumpScale: 0.014,
      roughness: 0.38,
      metalness: 0.0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.28,
    });

    this.sheetMesh = this._buildSlabMesh();
    this.sheetMesh.castShadow = true;
    this.sheetMesh.receiveShadow = true;
    this.sheetMesh.visible = false;
    this.group.add(this.sheetMesh);

    // Inner rolled core from Pass 1 (stays visible during Pass 2 pour & rides inside the new roll!)
    const coreGeo = new RoundedBoxGeometry(0.34, 0.24, this.panHalfD * 1.94, 4, 0.085);
    this.coreRollMesh = new THREE.Mesh(coreGeo, this.searMat);
    this.coreRollMesh.castShadow = true;
    this.coreRollMesh.receiveShadow = true;
    this.coreRollMesh.visible = false;
    this.group.add(this.coreRollMesh);

    // Pouring stream ribbon from bowl into pan
    const streamGeo = new THREE.CylinderGeometry(0.028, 0.052, 0.72, 14, 8, false);
    this.streamMat = new THREE.MeshPhysicalMaterial({
      color: 0xf9b529,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.94,
    });
    this.streamMesh = new THREE.Mesh(streamGeo, this.streamMat);
    this.streamMesh.visible = false;
    this.group.add(this.streamMesh);

    // Bubble seeds on sheet
    this.bubbles = [];
    for (let i = 0; i < 18; i++) {
      this.bubbles.push({
        u: 0.08 + Math.random() * 0.84,
        v: 0.1 + Math.random() * 0.8,
        r: 0.055 + Math.random() * 0.055,
        amp: 0.014 + Math.random() * 0.018,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.state = {
      pourProgress: 0,
      setProgress: 0,
      searLevel: 0.22,
      rollProgress: 0,
      passIndex: 0, // 0 = first layer, 1 = second layer wrapping first!
      eggCount: 2,
      mixIns: {},
      time: 0,
      jiggle: 0,
    };
  }

  _buildSlabMesh() {
    // Build a thick double-sided deformable sheet: top grid + bottom grid + stitched perimeter!
    const U = this.uSegs;
    const V = this.vSegs;
    const cols = U + 1;
    const rows = V + 1;
    const topCount = cols * rows;
    const totalVerts = topCount * 2;

    const positions = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indicesTop = [];
    const indicesBottomAndRim = [];

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idxTop = j * cols + i;
        const idxBot = topCount + idxTop;
        const u = i / U;
        const v = j / V;
        uvs[idxTop * 2] = u;
        uvs[idxTop * 2 + 1] = v;
        uvs[idxBot * 2] = u;
        uvs[idxBot * 2 + 1] = v;
      }
    }

    // Top faces (+Y normal when flat)
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < U; i++) {
        const a = j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indicesTop.push(a, c, b, b, c, d);
      }
    }

    // Bottom faces (-Y normal when flat, flips to OUTSIDE normal when rolled over +X!)
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < U; i++) {
        const a = topCount + j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indicesBottomAndRim.push(a, b, c, b, d, c);
      }
    }

    // Stitch 4 perimeter edges between top & bottom so thickness looks plush and solid!
    // Front edge (j = V) & Back edge (j = 0)
    for (let i = 0; i < U; i++) {
      const t0 = V * cols + i, t1 = t0 + 1;
      const b0 = topCount + t0, b1 = topCount + t1;
      indicesBottomAndRim.push(t0, b0, t1, t1, b0, b1);

      const bt0 = i, bt1 = i + 1;
      const bb0 = topCount + bt0, bb1 = topCount + bt1;
      indicesBottomAndRim.push(bt1, bb1, bt0, bt0, bb1, bb0);
    }
    // Left edge (i = 0) & Right edge (i = U)
    for (let j = 0; j < V; j++) {
      const lt0 = j * cols, lt1 = (j + 1) * cols;
      const lb0 = topCount + lt0, lb1 = topCount + lt1;
      indicesBottomAndRim.push(lt0, lb0, lt1, lt1, lb0, lb1);

      const rt0 = j * cols + U, rt1 = (j + 1) * cols + U;
      const rb0 = topCount + rt0, rb1 = topCount + rt1;
      indicesBottomAndRim.push(rt1, rb1, rt0, rt0, rb1, rb0);
    }

    const allIndices = [...indicesTop, ...indicesBottomAndRim];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(allIndices);
    geo.addGroup(0, indicesTop.length, 0);
    geo.addGroup(indicesTop.length, indicesBottomAndRim.length, 1);

    return new THREE.Mesh(geo, [this.topMat, this.searMat]);
  }

  resetForNewCook(eggCount = 2, mixIns = {}) {
    this.state.pourProgress = 0;
    this.state.setProgress = 0;
    this.state.searLevel = 0.16;
    this.state.rollProgress = 0;
    this.state.passIndex = 0;
    this.state.eggCount = eggCount;
    this.state.mixIns = { ...mixIns };
    this.state.jiggle = 0;
    this.sheetMesh.visible = false;
    this.coreRollMesh.visible = false;
    this.streamMesh.visible = false;
    this.painter.update({ setProgress: 0, searLevel: 0.16, mixIns: this.state.mixIns, force: true });
  }

  startPass(passIndex = 0) {
    this.state.passIndex = passIndex;
    this.state.pourProgress = 0.02;
    this.state.setProgress = 0;
    this.state.rollProgress = 0;
    if (passIndex === 0) {
      this.state.searLevel = 0.16;
      this.coreRollMesh.visible = false;
    } else {
      // Keep first rolled log nestled at the left side of the pan, ready to roll over the 2nd sheet!
      this.coreRollMesh.visible = true;
    }
    this.sheetMesh.visible = true;
    this.updateGeometry(0);
  }

  triggerJiggle(amount = 1) {
    this.state.jiggle = Math.min(1.6, this.state.jiggle + amount);
  }

  updateGeometry(dt) {
    this.state.time += dt;
    this.state.jiggle *= Math.exp(-6.5 * dt);

    // Update top wetness & sear textures smoothly
    const wetness = 1 - this.state.setProgress * 0.75;
    this.topMat.roughness = 0.10 + (1 - wetness) * 0.24;
    this.topMat.clearcoat = 0.35 + wetness * 0.65;
    this.painter.update({
      setProgress: this.state.setProgress,
      searLevel: this.state.searLevel,
      mixIns: this.state.mixIns,
    });

    if (!this.sheetMesh.visible) return;

    const U = this.uSegs;
    const V = this.vSegs;
    const cols = U + 1;
    const rows = V + 1;
    const topCount = cols * rows;
    const pos = this.sheetMesh.geometry.attributes.position.array;

    const plumpScale = 0.85 + this.state.eggCount * 0.16; // 1 egg = neat, 3 eggs = extra thick & plump!
    const pour = Math.max(0.08, Math.min(1, this.state.pourProgress));
    const spreadEase = 1 - Math.pow(1 - pour, 2.4);

    const halfW = this.panHalfW * spreadEase;
    const halfD = this.panHalfD * (0.45 + 0.55 * spreadEase);
    const baseThick = (0.036 + 0.012 * this.state.setProgress) * plumpScale;

    const rProg = Math.max(0, Math.min(1, this.state.rollProgress));
    const isPass2 = this.state.passIndex === 1;

    // Subtle inviting edge-curl at the left (-X) once cooked & ready to roll!
    const readyInvite = (this.state.setProgress > 0.65 && rProg < 0.06)
      ? Math.min(1, (this.state.setProgress - 0.65) * 3.0) * (0.78 + 0.22 * Math.sin(this.state.time * 4.2))
      : 0;

    // Rolling spiral parameters (rolls from left -halfW toward right +halfW)
    const totalLength = halfW * 2;
    const rolledLength = rProg * totalLength * 0.94;
    const rollFrontX = -halfW + rolledLength;

    // Base core radius (larger on Pass 2 because Pass 1 log is inside!)
    const r0X = isPass2 ? 0.17 * plumpScale : 0.065 * plumpScale;
    const r0Y = isPass2 ? 0.125 * plumpScale : 0.052 * plumpScale;
    const avgRadius = (r0X + r0Y) * 0.5 + 0.05 * rProg;

    // Position the inner Pass-1 core mesh so it rolls smoothly inside Pass 2!
    if (isPass2 && this.coreRollMesh.visible) {
      const coreX = -this.panHalfW + 0.20 + rProg * (this.panHalfW * 2 - 0.42);
      const curRx = r0X + rProg * 0.04;
      const curRy = r0Y + rProg * 0.035;
      const jig = Math.sin(this.state.time * 24) * this.state.jiggle * 0.04;
      this.coreRollMesh.position.set(coreX, curRy * (1 - jig * 0.4) + 0.012, 0);
      this.coreRollMesh.scale.set(1 + jig * 0.5, (0.9 + plumpScale * 0.16) * (1 - jig * 0.45), 1);
      this.coreRollMesh.rotation.z = -rProg * Math.PI * 2.5;
    }

    for (let j = 0; j < rows; j++) {
      const v = j / V;
      // Round corners slightly while pouring puddle spreads into rectangular pan
      const zNorm = (v - 0.5) * 2;
      const cornerRound = (1 - spreadEase) * 0.35 * zNorm * zNorm;
      const curHalfW = halfW * (1 - cornerRound);
      const z = zNorm * halfD;

      // Slight pillow crowning across Z near ends
      const zPillow = Math.cos(zNorm * 1.15) * 0.012 * rProg;

      for (let i = 0; i < cols; i++) {
        const u = i / U;
        const flatX = -curHalfW + u * (curHalfW * 2);

        // Sizzling 3D air blisters on unrolled portion
        let blisterH = 0;
        if (this.state.pourProgress > 0.65) {
          for (let b = 0; b < this.bubbles.length; b++) {
            const bb = this.bubbles[b];
            const du = u - bb.u;
            const dv = v - bb.v;
            const d2 = (du * du + dv * dv * 0.65) / (bb.r * bb.r);
            if (d2 < 1) {
              const pulse = 0.65 + 0.35 * Math.sin(this.state.time * 5.2 + bb.phase);
              blisterH += (1 - d2) * (1 - d2) * bb.amp * this.state.setProgress * pulse;
            }
          }
        }

        let tx, ty, nx, ny;

        if (rProg <= 0.001 || flatX >= rollFrontX) {
          // Flat sizzling sheet on pan (with inviting subtle left-lip curl when ready!)
          tx = flatX;
          ty = 0.008 + blisterH * 0.25;
          nx = 0;
          ny = 1;

          if (readyInvite > 0 && u < 0.16) {
            const lip = (0.16 - u) / 0.16;
            const liftAng = lip * lip * 0.95 * readyInvite;
            tx = flatX + (1 - Math.cos(liftAng)) * 0.11;
            ty += Math.sin(liftAng) * 0.11;
            nx = Math.sin(liftAng);
            ny = Math.cos(liftAng);
          }
        } else {
          // Rolled spiral portion! Wraps clockwise (up at back/left, over top toward +X, tucking under!)
          // Distance behind the rolling front: s = 0 RIGHT AT rollFrontX (tangent at bottom of cylinder!),
          // increasing toward the inner tip (u = 0).
          const s = rollFrontX - flatX;
          const theta = s / Math.max(0.085, avgRadius * 1.18);
          const layerGrow = Math.max(0, 1 - (theta / (Math.PI * 2)) * 0.14);
          const rx = (r0X + rProg * 0.095 * plumpScale) * Math.max(0.42, layerGrow);
          const ry = (r0Y + rProg * 0.078 * plumpScale) * Math.max(0.42, layerGrow) + zPillow;

          const centerY = (r0Y + rProg * 0.078 * plumpScale) + baseThick + 0.008;
          const centerX = rollFrontX;

          // At theta = 0 (tangent contact with pan): angle = -PI/2 (bottom of roll).
          // As theta increases, wraps up left (-X), over top (+Y), down right (+X)!
          const ang = -Math.PI * 0.5 - theta;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);

          // Squircle shaping so the rolled log has authentic rectangular-pan tamagoyaki silhouette!
          const sq = 1 / Math.pow(Math.pow(Math.abs(ca), 2.8) + Math.pow(Math.abs(sa), 2.8), 1 / 2.8);
          const shape = 0.55 + 0.45 * sq;

          const jig = Math.sin(this.state.time * 22) * this.state.jiggle * 0.05;
          tx = centerX + ca * rx * shape * (1 + jig);
          ty = Math.max(0.008, centerY + sa * ry * shape * (1 - jig * 0.7));

          // Inward normal for top surface (so bottom/seared surface faces OUTWARD on the roll!)
          nx = -ca;
          ny = -sa;
        }

        const topThickness = baseThick + blisterH;
        const idxTop = (j * cols + i) * 3;
        const idxBot = (topCount + j * cols + i) * 3;

        // Note: When flat, nx=0, ny=1 -> top is at ty + topThickness, bottom is at ty!
        // When rolled over the top (ang = +PI/2, ca=0, sa=1), nx=0, ny=-1 ->
        // bottom (ty) is on the OUTSIDE top of the roll, and top (ty - topThickness) is tucked INSIDE!
        // That means the golden-brown seared underside naturally faces OUTWARD!
        pos[idxTop] = tx + nx * topThickness;
        pos[idxTop + 1] = ty + ny * topThickness;
        pos[idxTop + 2] = z;

        pos[idxBot] = tx;
        pos[idxBot + 1] = ty;
        pos[idxBot + 2] = z;
      }
    }

    this.sheetMesh.geometry.attributes.position.needsUpdate = true;
    this.sheetMesh.geometry.computeVertexNormals();
  }
}

// Plump Steaming Tamagoyaki Log on the Hinoki Cutting Board -> Custom-Sliced Spiral Pieces!
export class BoardTamagoyakiSlices {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    this.slices = [];
    this.cheeseStrands = [];
    this.cutTexture = null;
    this.searMat = null;
    this.logLength = 1.44;
    this.logHeight = 0.38;
    this.logDepth = 0.56;
    this.mixIns = {};
    this.eggCount = 2;
    this.searLevel = 0.35;
  }

  clear() {
    this.slices.forEach((s) => {
      s.mesh.removeFromParent();
      s.mesh.geometry.dispose();
    });
    this.cheeseStrands.forEach((c) => {
      c.mesh.removeFromParent();
      c.mesh.geometry.dispose();
    });
    this.slices = [];
    this.cheeseStrands = [];
  }

  // Spawn an uncut plump golden tamagoyaki log on the cutting board!
  spawnWholeLog({ searTexture, bumpTexture, searLevel = 0.38, eggCount = 2, mixIns = {} }) {
    this.clear();
    this.eggCount = eggCount;
    this.searLevel = searLevel;
    this.mixIns = { ...mixIns };

    const plump = 0.84 + eggCount * 0.14;
    this.logLength = 1.42;
    this.logHeight = 0.35 * plump;
    this.logDepth = 0.54 * Math.min(1.15, 0.92 + eggCount * 0.08);

    this.cutTexture = createSpiralCutTexture({ searLevel, eggCount, mixIns });

    this.searMat = new THREE.MeshPhysicalMaterial({
      map: searTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.012,
      roughness: 0.36,
      clearcoat: 0.28,
      clearcoatRoughness: 0.25,
    });

    this.spiralMat = new THREE.MeshPhysicalMaterial({
      map: this.cutTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.007,
      roughness: 0.26,
      clearcoat: 0.48,
      clearcoatRoughness: 0.18,
    });

    // Start with 1 whole block spanning [-logLength/2, +logLength/2]
    const whole = this._makeSegment(-this.logLength * 0.5, this.logLength * 0.5, false, false);
    whole.jiggle = 1.2;
    this.slices.push(whole);
  }

  _makeSegment(x0, x1, cutLeft, cutRight) {
    const w = Math.max(0.14, x1 - x0);
    const geo = new RoundedBoxGeometry(w, this.logHeight, this.logDepth, 4, Math.min(0.065, w * 0.24));
    // Box material groups: 0:+X (right), 1:-X (left), 2:+Y, 3:-Y, 4:+Z, 5:-Z
    const mats = [
      cutRight ? this.spiralMat : this.searMat,
      cutLeft ? this.spiralMat : this.searMat,
      this.searMat,
      this.searMat,
      this.searMat,
      this.searMat,
    ];
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const cx = (x0 + x1) * 0.5;
    mesh.position.set(cx, this.logHeight * 0.5, 0);
    mesh.userData.kind = 'tamagoSlice';
    this.group.add(mesh);

    const seg = {
      mesh,
      x0,
      x1,
      width: w,
      cutLeft,
      cutRight,
      baseX: cx,
      targetX: cx,
      baseY: this.logHeight * 0.5,
      baseZ: 0,
      jiggle: 0.6,
      phase: Math.random() * Math.PI * 2,
      packed: false,
      eaten: false,
      grabbed: false,
    };
    mesh.userData.sliceRef = seg;
    return seg;
  }

  // Slice at local board X! Snaps gently so every slice is chunky & satisfying (never paper-thin).
  sliceAtX(localX) {
    // Find segment containing localX (or closest splittable segment >= 0.34 wide)
    let targetIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.slices.length; i++) {
      const s = this.slices[i];
      if (s.packed || s.eaten || s.width < 0.33) continue;
      const clamped = Math.max(s.x0 + 0.16, Math.min(s.x1 - 0.16, localX));
      const d = Math.abs(localX - clamped);
      if (d < bestDist) {
        bestDist = d;
        targetIdx = i;
      }
    }
    if (targetIdx === -1) return null;

    const seg = this.slices[targetIdx];
    let splitX = Math.max(seg.x0 + 0.18, Math.min(seg.x1 - 0.18, localX));
    // Gentle magnet toward neat fractions if wide log so even casual taps make gorgeous slices
    if (seg.width > 0.95 && Math.abs(localX - seg.baseX) > 0.42) {
      splitX = localX < seg.baseX ? seg.x0 + 0.34 : seg.x1 - 0.34;
    }

    // Remove old segment and spawn Left + Right spiral-revealed segments!
    const offsetShift = seg.targetX - seg.baseX;
    this.group.remove(seg.mesh);
    seg.mesh.geometry.dispose();

    const leftSeg = this._makeSegment(seg.x0, splitX, seg.cutLeft, true);
    const rightSeg = this._makeSegment(splitX, seg.x1, true, seg.cutRight);

    // Part all slices outward from the cut & angle bite-sized slices so the layered spiral cross-section shines!
    const gap = 0.065;
    leftSeg.targetX = leftSeg.baseX + offsetShift - gap * 0.6;
    rightSeg.targetX = rightSeg.baseX + offsetShift + gap * 0.6;
    leftSeg.mesh.position.x = leftSeg.baseX + offsetShift;
    rightSeg.mesh.position.x = rightSeg.baseX + offsetShift;
    leftSeg.jiggle = 1.1;
    rightSeg.jiggle = 1.1;
    if (leftSeg.width <= 0.45) {
      leftSeg.mesh.rotation.z = 0.34;
      leftSeg.mesh.rotation.y = 0.16;
    }
    if (rightSeg.width <= 0.45) {
      rightSeg.mesh.rotation.z = -0.34;
      rightSeg.mesh.rotation.y = -0.16;
    }

    this.slices.splice(targetIdx, 1, leftSeg, rightSeg);

    for (let i = 0; i < this.slices.length; i++) {
      if (i < targetIdx) this.slices[i].targetX -= gap * 0.35;
      if (i > targetIdx + 1) this.slices[i].targetX += gap * 0.35;
      this.slices[i].jiggle = Math.max(this.slices[i].jiggle, 0.45);
    }

    // Melted cheese stretch strands if cheese mix-in was used!
    if (this.mixIns.cheese) {
      this._spawnCheeseStretch((leftSeg.targetX + rightSeg.targetX) * 0.5, leftSeg, rightSeg);
    }

    const cutWorldPos = new THREE.Vector3(splitX + offsetShift, this.logHeight * 0.72, 0);
    this.group.localToWorld(cutWorldPos);

    return {
      cutWorldPos,
      sliceCount: this.slices.length,
      canSliceMore: this.hasSplittableSlice(),
    };
  }

  _spawnCheeseStretch(midX, leftSeg, rightSeg) {
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.CylinderGeometry(0.012, 0.012, 1, 8);
      geo.rotateZ(Math.PI * 0.5);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffe885,
        roughness: 0.18,
        clearcoat: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const yOff = this.logHeight * (0.36 + k * 0.22);
      const zOff = (k === 0 ? 0.08 : -0.07);
      mesh.position.set(midX, yOff, zOff);
      this.group.add(mesh);
      this.cheeseStrands.push({ mesh, leftSeg, rightSeg, yOff, zOff });
    }
  }

  hasSplittableSlice() {
    return this.slices.some((s) => !s.packed && !s.eaten && s.width >= 0.36);
  }

  getAvailableSlices() {
    return this.slices.filter((s) => !s.packed && !s.eaten);
  }

  update(dt, time) {
    for (let i = 0; i < this.slices.length; i++) {
      const s = this.slices[i];
      if (s.eaten) continue;
      s.jiggle *= Math.exp(-6.0 * dt);
      if (!s.grabbed && !s.packed) {
        s.mesh.position.x += (s.targetX - s.mesh.position.x) * Math.min(1, dt * 11);
        const sq = Math.sin(time * 24 + s.phase) * s.jiggle * 0.09;
        s.mesh.scale.set(1 + sq * 0.7, 1 - sq, 1 + sq * 0.5);
        s.mesh.position.y = s.baseY * (1 - sq * 0.5);
      } else if (s.packed) {
        const sq = Math.sin(time * 20 + s.phase) * s.jiggle * 0.08;
        s.mesh.scale.set(1 + sq * 0.5, 1 - sq * 0.6, 1 + sq * 0.5);
      }
    }

    // Update melted cheese bridges between adjacent un-grabbed slices
    for (let i = this.cheeseStrands.length - 1; i >= 0; i--) {
      const c = this.cheeseStrands[i];
      if (c.leftSeg.grabbed || c.rightSeg.grabbed || c.leftSeg.packed || c.rightSeg.packed || c.leftSeg.eaten || c.rightSeg.eaten) {
        c.mesh.visible = false;
        continue;
      }
      const lx = c.leftSeg.mesh.position.x + c.leftSeg.width * 0.48;
      const rx = c.rightSeg.mesh.position.x - c.rightSeg.width * 0.48;
      const span = Math.max(0.01, rx - lx);
      if (span > 0.24) {
        c.mesh.visible = false;
      } else {
        c.mesh.visible = true;
        c.mesh.position.x = (lx + rx) * 0.5;
        c.mesh.scale.set(span, Math.max(0.35, 1 - span * 2.5), Math.max(0.35, 1 - span * 2.5));
      }
    }
  }
}
