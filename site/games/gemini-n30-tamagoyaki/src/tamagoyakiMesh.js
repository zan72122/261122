import * as THREE from '../vendor/three.module.min.js';
import {
  createPanEggSheetController,
  createTamagoyakiOuterTexture,
  createTamagoyakiCrossSectionTexture,
} from './textures.js';

// Builds a smooth rounded-rectangle Shape for authentic Japanese tamagoyaki cross-section
function createRoundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const rr = Math.min(r, hw * 0.85, hh * 0.85);
  s.moveTo(-hw + rr, -hh);
  s.lineTo(hw - rr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rr);
  s.lineTo(hw, hh - rr);
  s.quadraticCurveTo(hw, hh, hw - rr, hh);
  s.lineTo(-hw + rr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rr);
  s.lineTo(-hw, -hh + rr);
  s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
  return s;
}

// Normalizes UVs on ExtrudeGeometry cleanly so cap cross-sections show crisp spirals
// and outer skin perimeter has smooth unstretched Maillard browning!
function normalizeExtrudeUVs(geo, width, height, depth) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nz = Math.abs(norm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (nz > 0.72) {
      // Front/back cross-section spiral end caps
      uv.setXY(i, x / width + 0.5, y / height + 0.5);
    } else {
      // Smooth continuous perimeter UV (no angular seam stretching!)
      const u = (z + depth * 0.5) / Math.max(0.01, depth);
      const v = (x / width + y / height) * 0.45 + 0.5;
      uv.setXY(i, u, v);
    }
  }
  uv.needsUpdate = true;
}

export class TamagoyakiSystem {
  constructor(scene, panInteriorGroup, boardGroup) {
    this.scene = scene;
    this.panInteriorGroup = panInteriorGroup;
    this.boardGroup = boardGroup;

    // 1. Dynamic sizzling egg sheet inside rectangular pan
    this.sheetCtrl = createPanEggSheetController();
    const sheetGeo = new THREE.PlaneGeometry(0.70, 0.88, 12, 18);
    sheetGeo.rotateX(-Math.PI * 0.5);
    this.sheetBasePos = new Float32Array(sheetGeo.attributes.position.array);
    this.sheetMat = new THREE.MeshStandardMaterial({
      map: this.sheetCtrl.texture,
      roughness: 0.22,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.sheetMesh = new THREE.Mesh(sheetGeo, this.sheetMat);
    this.sheetMesh.position.set(0, 0.014, 0);
    this.sheetMesh.receiveShadow = true;
    this.sheetMesh.visible = false;
    this.panInteriorGroup.add(this.sheetMesh);

    // Interactive popping sizzling air bubbles on the flat egg sheet
    this.bubbles = [];
    const bubGeo = new THREE.SphereGeometry(0.032, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const bubMat = new THREE.MeshStandardMaterial({
      color: 0xffe478,
      roughness: 0.25,
      metalness: 0.02,
    });
    const bubCoords = [
      [-0.18, -0.16],
      [0.14, -0.10],
      [-0.06, 0.08],
      [0.19, 0.18],
      [-0.17, 0.22],
    ];
    for (const [bx, bz] of bubCoords) {
      const m = new THREE.Mesh(bubGeo, bubMat.clone());
      m.position.set(bx, 0.015, bz);
      m.visible = false;
      m.userData = { hitType: 'bubble' };
      this.panInteriorGroup.add(m);
      this.bubbles.push({
        mesh: m,
        bx,
        bz,
        popped: false,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 2. Growing 3D rolled tamagoyaki log inside the pan
    this.outerTex = createTamagoyakiOuterTexture({ sear: 0.5 });
    this.crossTex = createTamagoyakiCrossSectionTexture({ sear: 0.5, layers: 1 });

    this.crossMat = new THREE.MeshStandardMaterial({
      map: this.crossTex,
      roughness: 0.62,
      metalness: 0.0,
    });
    this.outerMat = new THREE.MeshStandardMaterial({
      map: this.outerTex,
      roughness: 0.44,
      metalness: 0.02,
    });

    const rollW = 0.23;
    const rollH = 0.17;
    const rollLen = 0.66;
    const rollShape = createRoundedRectShape(rollW, rollH, 0.062);
    const rollGeo = new THREE.ExtrudeGeometry(rollShape, {
      depth: rollLen,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.014,
      bevelSegments: 3,
      curveSegments: 10,
    });
    rollGeo.center();
    normalizeExtrudeUVs(rollGeo, rollW + 0.03, rollH + 0.03, rollLen + 0.032);
    // Align length along X so rolling forward (+Z) spins cleanly around X
    rollGeo.rotateY(Math.PI * 0.5);

    this.panRollMesh = new THREE.Mesh(rollGeo, [this.crossMat, this.outerMat]);
    this.panRollMesh.castShadow = true;
    this.panRollMesh.receiveShadow = true;
    this.panRollMesh.visible = false;
    this.panInteriorGroup.add(this.panRollMesh);

    // 3. Sliceable 5-piece Tamagoyaki on the cutting board (and later moved into bento!)
    this.slices = [];
    this.sliceCount = 5;
    this._buildSlices();
  }

  _buildSlices() {
    const sliceW = 0.245;
    const sliceH = 0.185;
    const sliceThick = 0.128;
    const shape = createRoundedRectShape(sliceW, sliceH, 0.064);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: sliceThick,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.011,
      bevelSegments: 3,
      curveSegments: 10,
    });
    geo.center();
    normalizeExtrudeUVs(geo, sliceW + 0.025, sliceH + 0.025, sliceThick + 0.024);
    geo.rotateY(Math.PI * 0.5);

    for (let i = 0; i < this.sliceCount; i++) {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geo, [this.crossMat, this.outerMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { hitType: 'slice', sliceIndex: i };
      group.add(mesh);

      // Optional shiny red ketchup squiggle/heart (hidden until player taps ketchup bottle!)
      const ketchup = this._createKetchupDrizzle();
      ketchup.position.set(0, sliceH * 0.52, 0);
      ketchup.visible = false;
      group.add(ketchup);

      // Optional cute wooden bento flag pick (hidden until player taps flag picks!)
      const pick = this._createFlagPick(i);
      pick.position.set(0, sliceH * 0.52, 0);
      pick.visible = false;
      group.add(pick);

      group.visible = false;
      this.scene.add(group);

      this.slices.push({
        index: i,
        group,
        mesh,
        ketchup,
        pick,
        state: 'hidden', // hidden | board | carried | bento | eaten
        bentoSlot: -1,
        basePos: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
        targetRot: new THREE.Euler(),
        squash: 0,
        squashVel: 0,
      });
    }
  }

  _createKetchupDrizzle() {
    const g = new THREE.Group();
    const kMat = new THREE.MeshStandardMaterial({
      color: 0xd62b1f,
      roughness: 0.14,
      metalness: 0.05,
    });
    // Smooth organic glossy wavy ketchup drizzle across the slice top
    const pts = [
      new THREE.Vector3(-0.038, 0.005, -0.068),
      new THREE.Vector3(0.032, 0.009, -0.036),
      new THREE.Vector3(-0.032, 0.009, -0.002),
      new THREE.Vector3(0.032, 0.009, 0.034),
      new THREE.Vector3(-0.026, 0.006, 0.068),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0095, 8, false), kMat);
    g.add(tube);
    return g;
  }

  _createFlagPick(idx) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.004, 0.19, 8),
      new THREE.MeshStandardMaterial({ color: 0xe6c89a, roughness: 0.65 })
    );
    stick.position.y = 0.075;
    g.add(stick);

    const flagColors = [0xe85a4f, 0x4ea86a, 0xf2a93b, 0x5d8fd6, 0xe87ea1];
    const flagMat = new THREE.MeshStandardMaterial({
      color: flagColors[idx % flagColors.length],
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(0.095, 0.026);
    flagShape.lineTo(0, 0.055);
    flagShape.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), flagMat);
    flag.position.set(0.003, 0.115, 0);
    g.add(flag);
    return g;
  }

  refreshTextures(config) {
    if (this.outerTex) this.outerTex.dispose();
    if (this.crossTex) this.crossTex.dispose();
    this.outerTex = createTamagoyakiOuterTexture(config);
    this.crossTex = createTamagoyakiCrossSectionTexture(config);
    this.outerMat.map = this.outerTex;
    this.outerMat.needsUpdate = true;
    this.crossMat.map = this.crossTex;
    this.crossMat.needsUpdate = true;
  }

  updateSheet(opts) {
    // opts: { visible, pourFill, cook, sear, rollProgress, layerIndex, hasNegi, hasNori, hasDashi, marbled, time, puffiness }
    this.sheetMesh.visible = !!opts.visible;
    if (opts.visible) {
      this.sheetCtrl.render(opts);
      // Glossy wet when raw -> velvety cooked matte when set
      this.sheetMat.roughness = 0.16 + opts.cook * 0.44;

      // Deform flat sheet: spreads smoothly on pour, peels & shortens from far side (-Z) as you roll forward (+Z)!
      const pos = this.sheetMesh.geometry.attributes.position;
      const base = this.sheetBasePos;
      const fill = Math.max(0.06, Math.min(1, opts.pourFill));
      const roll = Math.max(0, Math.min(1, opts.rollProgress));
      // Z ranges from -0.44 (far) to +0.44 (near)
      const cutZ = -0.44 + roll * 0.84;

      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const bz = base[i * 3 + 2];
        const sx = bx * (0.28 + 0.72 * Math.pow(fill, 0.55));
        let sz = bz * (0.25 + 0.75 * fill);
        let sy = 0;

        if (roll > 0.005) {
          if (sz < cutZ) {
            // Part already rolled up tucks cleanly inside the rolling log
            sz = cutZ;
            sy = 0.025;
          } else if (sz < cutZ + 0.11) {
            // Smooth upward curling lip right where spatula lifts & folds!
            const u = 1 - (sz - cutZ) / 0.11;
            sy = u * u * 0.065;
          }
        } else if (opts.cook > 0.65 && bz < -0.34) {
          // Subtle inviting lifted far edge once cooked so child sees it can be rolled!
          const edgeU = (-0.34 - bz) / 0.10;
          const flutter = 0.5 + 0.5 * Math.sin((opts.time || 0) * 3.8);
          sy = edgeU * (0.018 + flutter * 0.014);
        }

        pos.setXYZ(i, sx, sy, sz);
      }
      pos.needsUpdate = true;
      this.sheetMesh.geometry.computeVertexNormals();
    }

    // Update interactive bubbling air pockets
    const showBubbles = opts.visible && opts.pourFill > 0.88 && opts.cook > 0.12 && opts.rollProgress < 0.08;
    for (const b of this.bubbles) {
      if (!showBubbles || b.popped) {
        b.mesh.visible = false;
      } else {
        b.mesh.visible = true;
        const grow = Math.min(1, (opts.cook - 0.12) * 2.2);
        const pulse = 0.82 + 0.24 * Math.sin((opts.time || 0) * 6.5 + b.phase);
        b.mesh.scale.set(grow * pulse, grow * pulse * 1.15, grow * pulse);
      }
    }

    // Update growing 3D rolled tamagoyaki log in pan!
    const layer = opts.layerIndex || 0; // 0, 1, 2
    const roll = Math.max(0, Math.min(1, opts.rollProgress || 0));
    const showRoll = layer > 0 || roll > 0.03;
    this.panRollMesh.visible = showRoll && (opts.showRollOverride !== false);

    if (this.panRollMesh.visible) {
      const puff = 1 + (opts.puffiness || 0) * 0.16;
      const baseGrowth = (layer + roll) / 3; // 0 -> 1 across 3 layers
      const thickY = (0.36 + 0.68 * Math.pow(baseGrowth, 0.72)) * puff;
      const thickZ = (0.42 + 0.64 * Math.pow(baseGrowth, 0.72)) * puff;
      this.panRollMesh.scale.set(1.0, thickY, thickZ);

      // Position travels from far end (-0.33) to near end (+0.32) during roll!
      const zPos =
        opts.rollZOverride !== undefined
          ? opts.rollZOverride
          : -0.34 + roll * 0.66;
      const halfH = 0.085 * thickY;
      this.panRollMesh.position.set(0, 0.018 + halfH, zPos);

      // Rotate forward (kuru-kuru!) proportional to roll distance
      this.panRollMesh.rotation.x = layer * Math.PI * 2 + roll * Math.PI * 2.15;
    }
  }

  resetBubbles() {
    for (const b of this.bubbles) b.popped = false;
  }

  // Place whole uncut tamagoyaki onto the hinoki cutting board (as 5 snugly aligned slices!)
  placeOnCuttingBoard(boardCenter, config) {
    this.refreshTextures(config);
    const puff = 1 + (config.puffiness || 0) * 0.15;
    const sliceStep = 0.138;
    const startX = boardCenter.x - ((this.sliceCount - 1) * sliceStep) * 0.5;
    const baseY = boardCenter.y + 0.094 * puff;

    for (let i = 0; i < this.sliceCount; i++) {
      const s = this.slices[i];
      s.state = 'board';
      s.bentoSlot = -1;
      s.ketchup.visible = false;
      s.pick.visible = false;
      s.group.visible = true;
      s.group.scale.set(1.0, puff, puff);
      s.basePos.set(startX + i * sliceStep, baseY, boardCenter.z);
      s.targetPos.copy(s.basePos);
      s.targetRot.set(0, 0, 0);
      s.group.position.copy(s.basePos);
      s.group.rotation.set(0, 0, 0);
      s.squash = 0.25;
      s.squashVel = 0;
    }
  }

  // Spread & slightly tilt cut slices on the board so the golden spiral cross-section shines!
  applyCutReveal(cutsDone, boardCenter, puffiness = 0) {
    const puff = 1 + puffiness * 0.15;
    const baseStep = 0.138;
    const startX = boardCenter.x - ((this.sliceCount - 1) * baseStep) * 0.5;
    const baseY = boardCenter.y + 0.094 * puff;

    for (let i = 0; i < this.sliceCount; i++) {
      const s = this.slices[i];
      if (s.state !== 'board') continue;
      // Cuts happen right-to-left or left-to-right; let's slice right-to-left (natural right-handed chef!)
      // Cut 1 separates slice 4, Cut 2 separates slice 3, Cut 3 separates slice 2, Cut 4 separates slice 1!
      const isCutPiece = i >= this.sliceCount - cutsDone;
      const gapOffset = isCutPiece ? (i - (this.sliceCount - 1 - cutsDone)) * 0.052 + 0.03 : -0.02 * cutsDone;
      s.targetPos.set(startX + i * baseStep + gapOffset, baseY, boardCenter.z + (isCutPiece ? 0.04 * (i % 2 ? 1 : -0.3) : 0));
      // Dramatic natural presentation tilt revealing the steaming golden spiral cross-section clearly!
      s.targetRot.set(0.08, isCutPiece ? -0.62 : 0, isCutPiece ? -0.10 : 0);
      if (i === this.sliceCount - cutsDone) {
        s.squash = 0.28;
      }
    }
  }

  hideAll() {
    this.sheetMesh.visible = false;
    this.panRollMesh.visible = false;
    for (const b of this.bubbles) b.mesh.visible = false;
    for (const s of this.slices) {
      s.state = 'hidden';
      s.group.visible = false;
    }
  }

  bounceSlice(idx, impulse = 0.3) {
    const s = this.slices[idx];
    if (!s) return;
    s.squash = Math.max(s.squash, impulse);
  }

  updateSlices(dt, puffiness = 0) {
    const puff = 1 + puffiness * 0.15;
    for (const s of this.slices) {
      if (!s.group.visible) continue;
      if (s.state === 'board' || s.state === 'bento') {
        s.group.position.lerp(s.targetPos, Math.min(1, dt * 10));
        s.group.rotation.x += (s.targetRot.x - s.group.rotation.x) * Math.min(1, dt * 10);
        s.group.rotation.y += (s.targetRot.y - s.group.rotation.y) * Math.min(1, dt * 10);
        s.group.rotation.z += (s.targetRot.z - s.group.rotation.z) * Math.min(1, dt * 10);
      }

      // Soft pillowy egg spring jiggle!
      const springK = 95;
      const damp = 9.5;
      s.squashVel += (-springK * s.squash - damp * s.squashVel) * dt;
      s.squash += s.squashVel * dt;
      const sy = Math.max(0.65, 1 - s.squash * 0.45) * puff;
      const sxz = 1 + s.squash * 0.22;
      s.group.scale.set(sxz, sy, sxz * puff);
    }
  }
}
