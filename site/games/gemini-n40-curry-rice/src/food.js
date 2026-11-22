import * as THREE from '../vendor/three.module.js';

// =========================================================================
// PHOTOREALISTIC ORGANIC 3D FOOD MODELS & PHYSICAL TRANSFORMATIONS
// 1. Peelable Carrot & Potato (multi-strip real outer skin curls off into ribbons!)
// 2. Cuttable Carrot & Potato (splits into real chunky 3D slices with core cross-section!)
// 3. Pot Chunks (carrots, potatoes, onion petals, seared beef cubes that brown & glaze in curry!)
// 4. Breakable 4-Square Curry Roux Slab (crisp snap, splashes into pot, shrinks & melts!)
// 5. Steaming Ceramic Curry Plate (sculpted Koshihikari rice mound + growing glossy curry pool + bites!)
// =========================================================================

// Helper: organic slight vertex jitter so no vegetable ever looks like a primitive cylinder/sphere
function jitterGeometry(geo, amp = 0.0025, seed = 1) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      Math.sin(x * 73 + seed * 11) * Math.cos(y * 59 + seed * 7) * Math.sin(z * 67 + seed * 13);
    pos.setXYZ(i, x + n * amp, y + n * amp * 0.5, z + n * amp);
  }
  geo.computeVertexNormals();
  return geo;
}

// -------------------------------------------------------------------------
// 1. PEELABLE & CUTTABLE CARROT (laid horizontally along X on cutting board)
// -------------------------------------------------------------------------
export class CarrotModel {
  constructor(carrotTex) {
    this.group = new THREE.Group();
    this.tex = carrotTex;

    this.skinMat = new THREE.MeshStandardMaterial({
      map: carrotTex.skinMap,
      bumpMap: carrotTex.skinBump,
      bumpScale: 0.0032,
      roughness: 0.68,
      metalness: 0.0,
    });
    this.innerMat = new THREE.MeshPhysicalMaterial({
      map: carrotTex.innerMap,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.62,
      clearcoatRoughness: 0.18,
    });
    this.coreMat = new THREE.MeshPhysicalMaterial({
      map: carrotTex.coreMap,
      roughness: 0.26,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
    });
    this.stemMat = new THREE.MeshStandardMaterial({
      color: 0x4b6826,
      roughness: 0.78,
    });

    this.length = 0.175;
    this.rThick = 0.026;
    this.rThin = 0.011;

    // Peel phase group (inner core + 5 removable angular skin strips + green stem)
    this.peelGroup = new THREE.Group();
    this.group.add(this.peelGroup);

    // Tapered organic inner carrot body using one seamless LatheGeometry (rounded crown -> smooth root tip!)
    const cPts = [
      new THREE.Vector2(0.001, -this.length * 0.52),
      new THREE.Vector2(this.rThick * 0.72, -this.length * 0.51),
      new THREE.Vector2(this.rThick, -this.length * 0.45),
      new THREE.Vector2(this.rThick * 0.90, -this.length * 0.15),
      new THREE.Vector2(this.rThick * 0.72, this.length * 0.18),
      new THREE.Vector2(this.rThin * 1.15, this.length * 0.44),
      new THREE.Vector2(this.rThin * 0.55, this.length * 0.52),
      new THREE.Vector2(0.001, this.length * 0.54),
    ];
    const innerGeo = new THREE.LatheGeometry(cPts, 24);
    innerGeo.rotateZ(-Math.PI * 0.5);
    jitterGeometry(innerGeo, 0.0012, 2);
    const innerMesh = new THREE.Mesh(innerGeo, this.innerMat);
    innerMesh.castShadow = true;
    innerMesh.receiveShadow = true;
    this.peelGroup.add(innerMesh);

    // Short trimmed leafy top stub (authentic supermarket carrot!)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0095, 0.013, 10), this.stemMat);
    stem.rotation.z = Math.PI * 0.5;
    stem.position.x = -this.length * 0.52 - 0.006;
    this.peelGroup.add(stem);

    // 5 longitudinal outer skin shells matching the EXACT curved lathe profile (+0.0018m outward — ZERO z-fighting!)
    const skinPts = cPts.slice(1, -1).map((p) => new THREE.Vector2(p.x + 0.0019, p.y));
    this.skinStrips = [];
    const stripCount = 5;
    const arc = (Math.PI * 2) / stripCount;
    for (let i = 0; i < stripCount; i++) {
      const thetaStart = -Math.PI * 0.15 + i * arc;
      const stripGeo = new THREE.LatheGeometry(skinPts, 8, thetaStart, arc + 0.06);
      stripGeo.rotateZ(-Math.PI * 0.5);
      const strip = new THREE.Mesh(stripGeo, this.skinMat);
      strip.castShadow = true;
      strip.receiveShadow = true;
      strip.userData = { peeled: false, progress: 0 };
      this.peelGroup.add(strip);
      this.skinStrips.push(strip);
    }

    // Cut phase group (5 chunky segments that physically split apart as knife slices!)
    this.cutGroup = new THREE.Group();
    this.cutGroup.visible = false;
    this.group.add(this.cutGroup);
    this.segments = [];
    this._buildCutSegments();

    // Curled fallen peel ribbons on board
    this.ribbons = [];
  }

  _buildCutSegments() {
    const count = 5;
    const segLen = this.length / count;
    for (let i = 0; i < count; i++) {
      // Index 0 = rightmost tip (cut first!), Index 4 = leftmost thick end
      const t0 = 1 - i / count; // 1.0 -> 0.2
      const t1 = 1 - (i + 1) / count; // 0.8 -> 0.0
      const rRight = THREE.MathUtils.lerp(this.rThick, this.rThin, t0);
      const rLeft = THREE.MathUtils.lerp(this.rThick, this.rThin, t1);
      const xCenter = THREE.MathUtils.lerp(-this.length * 0.5, this.length * 0.5, (t0 + t1) * 0.5);

      const segGroup = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(rRight, rLeft, segLen * 0.996, 20, 2);
      bodyGeo.rotateZ(-Math.PI * 0.5);
      const mats = [this.innerMat, this.coreMat, this.coreMat];
      const mesh = new THREE.Mesh(bodyGeo, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      segGroup.add(mesh);

      segGroup.position.set(xCenter, 0, 0);
      segGroup.userData = {
        homePos: segGroup.position.clone(),
        cut: false,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        isCarrot: true,
        cutX: xCenter - segLen * 0.5,
      };
      this.cutGroup.add(segGroup);
      this.segments.push(segGroup);
    }
  }

  // Create a realistic curling translucent carrot peel ribbon that drops onto the cutting board!
  spawnPeelRibbon(parentGroup, startWorldPos) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.035, 0.008, 0.006),
      new THREE.Vector3(0.068, 0.018, -0.008),
      new THREE.Vector3(0.088, 0.005, 0.012),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 14, 0.0065, 6, false);
    tubeGeo.scale(1, 0.18, 1.35);
    const mat = this.skinMat.clone();
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(tubeGeo, mat);
    mesh.position.copy(startWorldPos);
    mesh.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    mesh.castShadow = true;
    parentGroup.add(mesh);
    const obj = {
      mesh,
      vel: new THREE.Vector3(0.08 + Math.random() * 0.07, 0.05 + Math.random() * 0.04, 0.06 + Math.random() * 0.08),
      rotVel: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4),
      settled: false,
    };
    this.ribbons.push(obj);
    return obj;
  }

  enterCutMode() {
    this.peelGroup.visible = false;
    this.cutGroup.visible = true;
  }

  reset() {
    this.peelGroup.visible = true;
    this.cutGroup.visible = false;
    for (const s of this.skinStrips) {
      s.visible = true;
      s.scale.set(1, 1, 1);
      s.position.set(0, 0, 0);
      s.userData.peeled = false;
      s.userData.progress = 0;
    }
    for (const seg of this.segments) {
      seg.visible = true;
      seg.position.copy(seg.userData.homePos);
      seg.rotation.set(0, 0, 0);
      seg.userData.cut = false;
      seg.userData.vel.set(0, 0, 0);
      seg.userData.rotVel.set(0, 0, 0);
    }
  }
}

// -------------------------------------------------------------------------
// 2. PEELABLE & CUTTABLE POTATO (organic Danshaku shape)
// -------------------------------------------------------------------------
export class PotatoModel {
  constructor(potatoTex) {
    this.group = new THREE.Group();
    this.skinMat = new THREE.MeshStandardMaterial({
      map: potatoTex.skinMap,
      bumpMap: potatoTex.skinBump,
      bumpScale: 0.0038,
      roughness: 0.78,
      metalness: 0.0,
    });
    this.innerMat = new THREE.MeshPhysicalMaterial({
      map: potatoTex.innerMap,
      roughness: 0.30,
      clearcoat: 0.52,
      clearcoatRoughness: 0.22,
    });

    this.peelGroup = new THREE.Group();
    this.group.add(this.peelGroup);

    // Organic lumpy potato core
    const innerGeo = new THREE.SphereGeometry(0.044, 22, 16);
    innerGeo.scale(1.38, 0.86, 0.96);
    jitterGeometry(innerGeo, 0.0036, 9);
    const innerMesh = new THREE.Mesh(innerGeo, this.innerMat);
    innerMesh.castShadow = true;
    innerMesh.receiveShadow = true;
    this.peelGroup.add(innerMesh);

    // 4 large outer skin patches covering the potato (peel off cleanly!)
    this.skinStrips = [];
    const stripCount = 4;
    const phiStep = (Math.PI * 2) / stripCount;
    for (let i = 0; i < stripCount; i++) {
      const geo = new THREE.SphereGeometry(0.0458, 12, 14, i * phiStep - 0.15, phiStep + 0.12, 0.12, Math.PI - 0.24);
      geo.scale(1.39, 0.87, 0.97);
      jitterGeometry(geo, 0.0034, 9);
      const strip = new THREE.Mesh(geo, this.skinMat);
      strip.castShadow = true;
      strip.receiveShadow = true;
      strip.userData = { peeled: false, progress: 0 };
      this.peelGroup.add(strip);
      this.skinStrips.push(strip);
    }

    // Cut phase group: 4 chunky organic potato wedges!
    this.cutGroup = new THREE.Group();
    this.cutGroup.visible = false;
    this.group.add(this.cutGroup);
    this.segments = [];
    const positions = [
      { x: 0.036, z: 0.006, sx: 0.62, sy: 0.82, sz: 0.88 },
      { x: 0.012, z: -0.005, sx: 0.66, sy: 0.88, sz: 0.95 },
      { x: -0.014, z: 0.004, sx: 0.66, sy: 0.88, sz: 0.94 },
      { x: -0.038, z: -0.004, sx: 0.58, sy: 0.80, sz: 0.84 },
    ];
    positions.forEach((p, idx) => {
      const g = new THREE.Group();
      const chunkGeo = new THREE.DodecahedronGeometry(0.034, 2);
      chunkGeo.scale(p.sx, p.sy, p.sz);
      jitterGeometry(chunkGeo, 0.0022, 20 + idx);
      const m = new THREE.Mesh(chunkGeo, this.innerMat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      g.position.set(p.x, 0, p.z);
      g.userData = {
        homePos: g.position.clone(),
        cut: false,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        isCarrot: false,
        cutX: p.x - 0.012,
      };
      this.cutGroup.add(g);
      this.segments.push(g);
    });
    this.ribbons = [];
  }

  spawnPeelRibbon(parentGroup, startWorldPos) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.028, 0.007, 0.009),
      new THREE.Vector3(0.056, 0.015, -0.005),
      new THREE.Vector3(0.072, 0.004, 0.010),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.0075, 6, false);
    tubeGeo.scale(1, 0.16, 1.4);
    const mat = this.skinMat.clone();
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(tubeGeo, mat);
    mesh.position.copy(startWorldPos);
    mesh.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    mesh.castShadow = true;
    parentGroup.add(mesh);
    const obj = {
      mesh,
      vel: new THREE.Vector3(0.07 + Math.random() * 0.06, 0.05 + Math.random() * 0.04, 0.06 + Math.random() * 0.07),
      rotVel: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4),
      settled: false,
    };
    this.ribbons.push(obj);
    return obj;
  }

  enterCutMode() {
    this.peelGroup.visible = false;
    this.cutGroup.visible = true;
  }

  reset() {
    this.peelGroup.visible = true;
    this.cutGroup.visible = false;
    for (const s of this.skinStrips) {
      s.visible = true;
      s.scale.set(1, 1, 1);
      s.userData.peeled = false;
      s.userData.progress = 0;
    }
    for (const seg of this.segments) {
      seg.visible = true;
      seg.position.copy(seg.userData.homePos);
      seg.rotation.set(0, 0, 0);
      seg.userData.cut = false;
      seg.userData.vel.set(0, 0, 0);
      seg.userData.rotVel.set(0, 0, 0);
    }
  }
}

// -------------------------------------------------------------------------
// 3. POT INGREDIENTS (cut carrots + potatoes + onion petals + seared meat chunks)
// -------------------------------------------------------------------------
export class PotIngredients {
  constructor(potCenter, potRadius, carrotTex, potatoTex) {
    this.potCenter = potCenter.clone();
    this.potRadius = potRadius;
    this.group = new THREE.Group();
    this.group.position.copy(potCenter);
    this.group.visible = false;

    this.items = [];
    this.searProgress = 0; // 0 raw -> 1 golden seared
    this.curryGlaze = 0;   // 0 clean -> 1 coated in glossy mahogany curry

    // Shared base materials that morph dynamically during sautéing & roux melting!
    this.carrotMat = new THREE.MeshPhysicalMaterial({
      map: carrotTex.innerMap,
      color: 0xffffff,
      roughness: 0.28,
      clearcoat: 0.45,
    });
    this.potatoMat = new THREE.MeshPhysicalMaterial({
      map: potatoTex.innerMap,
      color: 0xffffff,
      roughness: 0.34,
      clearcoat: 0.35,
    });
    this.onionMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6ebd8,
      roughness: 0.22,
      clearcoat: 0.65,
      transparent: true,
      opacity: 0.90,
    });
    this.meatMat = new THREE.MeshPhysicalMaterial({
      color: 0x8f432b,
      roughness: 0.42,
      clearcoat: 0.45,
    });

    // 7 Carrot rounds/wedges with core cross-section caps!
    const coreMat = new THREE.MeshPhysicalMaterial({
      map: carrotTex.coreMap,
      roughness: 0.24,
      clearcoat: 0.6,
    });
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.CylinderGeometry(0.017, 0.020, 0.020, 18);
      jitterGeometry(geo, 0.0014, 40 + i);
      this._addItem(new THREE.Mesh(geo, [this.carrotMat, coreMat, coreMat]), 'carrot', i);
    }
    // 7 Smooth organically-rounded Potato chunks (no low-poly facets!)
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.SphereGeometry(0.022, 18, 14);
      geo.scale(1.15, 0.82, 0.94);
      // Soft flat cut plane on one side like real hand-chopped potato chunks
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        if (p.getY(k) < -0.012) p.setY(k, -0.012 + (p.getY(k) + 0.012) * 0.25);
      }
      jitterGeometry(geo, 0.0022, 60 + i);
      this._addItem(new THREE.Mesh(geo, this.potatoMat), 'potato', i);
    }
    // 7 Translucent Onion crescents
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.TorusGeometry(0.020, 0.0042, 8, 16, Math.PI * 0.72);
      const m = new THREE.Mesh(geo, this.onionMat);
      this._addItem(m, 'onion', i);
    }
    // 5 Smooth seared Beef/Pork chunks (soft rounded edges, not sharp cubes!)
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(0.019, 14, 12);
      geo.scale(1.25, 0.80, 1.05);
      jitterGeometry(geo, 0.0026, 90 + i);
      this._addItem(new THREE.Mesh(geo, this.meatMat), 'meat', i);
    }
  }

  _addItem(mesh, kind, idx) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const angle = (idx * 2.39996 + (kind.charCodeAt(0) % 7)) % (Math.PI * 2);
    const radius = 0.020 + (idx % 4) * 0.024;
    mesh.position.set(Math.cos(angle) * radius, 0.026 + (idx % 2) * 0.010, Math.sin(angle) * radius);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    this.group.add(mesh);
    this.items.push({
      mesh,
      kind,
      angle,
      radius,
      baseY: 0.024 + Math.random() * 0.012,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      spin: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
    });
  }

  dropIn() {
    this.group.visible = true;
    for (const it of this.items) {
      it.mesh.position.y = 0.12 + Math.random() * 0.06;
      it.vy = -0.35 - Math.random() * 0.2;
    }
  }

  settleInPot(liquidLevel = 0) {
    this.group.visible = true;
    const base = liquidLevel > 0.1 ? 0.02 + liquidLevel * 0.070 : 0.026;
    for (const it of this.items) {
      const r = Math.min(this.potRadius * 0.70, it.radius);
      it.mesh.position.set(
        Math.cos(it.angle) * r,
        base + (it.kind === 'carrot' || it.kind === 'potato' ? 0.003 : -0.004),
        Math.sin(it.angle) * r
      );
      it.vy = 0;
    }
  }

  // Stir/toss veggies physically with spatula or ladle!
  applyStir(dt, stirSpeed, stirLocalPos, liquidLevel) {
    const maxR = this.potRadius * 0.72;
    const floatY = liquidLevel > 0.1 ? 0.02 + liquidLevel * 0.072 : 0.026;
    const time = performance.now() * 0.001;

    for (const it of this.items) {
      // Gravity drop into pot
      if (it.mesh.position.y > floatY + 0.02) {
        it.vy -= 1.6 * dt;
        it.mesh.position.y = Math.max(floatY, it.mesh.position.y + it.vy * dt);
      }

      // Tangential swirl + gentle bobbing in simmering liquid
      const angularVel = stirSpeed * (2.2 - this.curryGlaze * 0.7) * (0.7 + 0.5 * (it.radius / maxR));
      it.angle += angularVel * dt;

      // Push slightly away from spatula/ladle tip & hop when sautéed!
      const lx = Math.cos(it.angle) * it.radius;
      const lz = Math.sin(it.angle) * it.radius;
      if (stirLocalPos && stirSpeed > 0.15) {
        const dx = lx - stirLocalPos.x;
        const dz = lz - stirLocalPos.y;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.065) {
          it.vy = Math.max(it.vy, (0.28 + Math.random() * 0.16) * Math.min(1, stirSpeed));
          it.mesh.rotation.x += dt * 4.5 * stirSpeed;
          it.mesh.rotation.z += dt * 3.8 * stirSpeed;
        }
      }

      const targetX = Math.cos(it.angle) * Math.min(maxR, it.radius);
      const targetZ = Math.sin(it.angle) * Math.min(maxR, it.radius);
      it.mesh.position.x += (targetX - it.mesh.position.x) * Math.min(1, dt * 8);
      it.mesh.position.z += (targetZ - it.mesh.position.z) * Math.min(1, dt * 8);

      // Bobbing near surface when simmering so chunks peek appetizingly through the glossy curry!
      const bob = liquidLevel > 0.15
        ? Math.sin(time * (2.6 - this.curryGlaze * 1.1) + it.phase) * 0.008
        : 0;
      const floorY = floatY + (it.kind === 'carrot' || it.kind === 'potato' ? 0.002 : -0.003) + bob;
      if (it.mesh.position.y <= floorY + 0.002 && it.vy <= 0) {
        it.mesh.position.y += (floorY - it.mesh.position.y) * Math.min(1, dt * 7);
        it.vy = 0;
      } else {
        it.vy -= 1.8 * dt;
        it.mesh.position.y = Math.max(floorY, it.mesh.position.y + it.vy * dt);
      }

      if (stirSpeed > 0.1) {
        it.mesh.rotation.x += it.spin.x * stirSpeed * dt * 1.4;
        it.mesh.rotation.y += it.spin.y * stirSpeed * dt * 1.4;
      }
    }
  }

  updateAppearance(sear, curryGlaze) {
    this.searProgress = sear;
    this.curryGlaze = curryGlaze;
    // Carrots deepen & get super glossy with oil + curry glaze
    const cRaw = new THREE.Color(0xffffff);
    const cGlazed = new THREE.Color(0xc97b42);
    this.carrotMat.color.copy(cRaw).lerp(cGlazed, curryGlaze * 0.55);
    this.carrotMat.clearcoat = 0.45 + sear * 0.3 + curryGlaze * 0.25;

    // Potatoes acquire golden sear & curry amber tint
    const pRaw = new THREE.Color(0xffffff);
    const pSear = new THREE.Color(0xf2d7a0);
    const pCurry = new THREE.Color(0xb67b3c);
    this.potatoMat.color.copy(pRaw).lerp(pSear, sear).lerp(pCurry, curryGlaze * 0.65);
    this.potatoMat.clearcoat = 0.35 + sear * 0.35 + curryGlaze * 0.3;

    // Onions turn translucent golden caramelized!
    const oRaw = new THREE.Color(0xf6ebd8);
    const oGold = new THREE.Color(0xc88d3a);
    this.onionMat.color.copy(oRaw).lerp(oGold, Math.min(1, sear * 0.8 + curryGlaze * 0.4));
    this.onionMat.opacity = 0.90 - sear * 0.25;

    // Meat browns richly
    const mRaw = new THREE.Color(0x9a4830);
    const mSeared = new THREE.Color(0x4a2311);
    this.meatMat.color.copy(mRaw).lerp(mSeared, Math.min(1, sear * 0.85 + curryGlaze * 0.3));
    this.meatMat.clearcoat = 0.45 + curryGlaze * 0.5;
  }

  reset() {
    this.group.visible = false;
    this.updateAppearance(0, 0);
  }
}

// -------------------------------------------------------------------------
// 4. BREAKABLE 4-SQUARE CURRY ROUX SLAB & MELTING FLOATING CUBES
// -------------------------------------------------------------------------
export class CurryRouxSystem {
  constructor(rouxTex, potCenter) {
    this.potCenter = potCenter.clone();
    this.trayGroup = new THREE.Group(); // Attached near left hand during Stage 5A
    this.floatingGroup = new THREE.Group(); // Lives in pot world space
    this.floatingGroup.position.copy(potCenter);

    this.rouxMat = new THREE.MeshPhysicalMaterial({
      map: rouxTex.map,
      bumpMap: rouxTex.bumpMap,
      bumpScale: 0.0025,
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.38,
      clearcoatRoughness: 0.28,
    });

    // Small translucent plastic/ceramic roux tray backing
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.105, 0.008, 0.088),
      new THREE.MeshPhysicalMaterial({ color: 0xf2ece1, roughness: 0.32, clearcoat: 0.4 })
    );
    tray.position.set(0, -0.011, 0);
    tray.castShadow = true;
    tray.receiveShadow = true;
    this.trayGroup.add(tray);

    // 4 scored bevelled chocolate-bar-like roux squares (2x2 grid)
    this.blocks = [];
    const offsets = [
      [0.022, -0.019],
      [0.022, 0.019],
      [-0.022, -0.019],
      [-0.022, 0.019],
    ];
    offsets.forEach(([ox, oz], idx) => {
      const geo = new THREE.BoxGeometry(0.039, 0.017, 0.034);
      const mesh = new THREE.Mesh(geo, this.rouxMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(ox, 0, oz);
      this.trayGroup.add(mesh);

      // Corresponding melting cube in pot
      const fMesh = new THREE.Mesh(geo.clone(), this.rouxMat);
      fMesh.castShadow = true;
      fMesh.visible = false;
      this.floatingGroup.add(fMesh);

      this.blocks.push({
        idx,
        trayMesh: mesh,
        floatMesh: fMesh,
        state: 'tray', // 'tray' | 'flying' | 'melting' | 'gone'
        flyT: 0,
        startWorld: new THREE.Vector3(),
        targetLocal: new THREE.Vector3(
          Math.cos(idx * 1.57 + 0.4) * 0.045,
          0.10,
          Math.sin(idx * 1.57 + 0.4) * 0.045
        ),
        melt: 0, // 0 full -> 1 melted
        angle: idx * 1.57 + 0.4,
        radius: 0.048 + (idx % 2) * 0.018,
      });
    });
    this.trayGroup.visible = false;
  }

  breakNextBlock(onSplash) {
    const blk = this.blocks.find((b) => b.state === 'tray');
    if (!blk) return null;
    blk.state = 'flying';
    blk.flyT = 0;
    blk.trayMesh.getWorldPosition(blk.startWorld);
    blk.trayMesh.visible = false;
    blk.floatMesh.visible = true;
    blk.floatMesh.scale.set(1, 1, 1);
    blk.onSplash = onSplash;
    return blk;
  }

  remainingOnTray() {
    return this.blocks.filter((b) => b.state === 'tray').length;
  }

  getAverageMelt() {
    let sum = 0;
    for (const b of this.blocks) {
      if (b.state === 'gone') sum += 1;
      else if (b.state === 'melting') sum += b.melt;
    }
    return sum / this.blocks.length;
  }

  update(dt, surfaceLocalY, stirSpeed, meltRate) {
    const time = performance.now() * 0.001;
    for (const b of this.blocks) {
      if (b.state === 'flying') {
        b.flyT += dt * 2.7;
        const t = Math.min(1, b.flyT);
        const startLocal = b.startWorld.clone().sub(this.potCenter);
        const pos = startLocal.lerp(b.targetLocal, t);
        pos.y = THREE.MathUtils.lerp(startLocal.y, surfaceLocalY, t) + Math.sin(t * Math.PI) * 0.095;
        b.floatMesh.position.copy(pos);
        b.floatMesh.rotation.set(t * 3.8, t * 2.6, t * 2.1);
        if (t >= 1) {
          b.state = 'melting';
          b.melt = 0;
          if (b.onSplash) b.onSplash(b.targetLocal.x, b.targetLocal.z);
        }
      } else if (b.state === 'melting') {
        // Stirring rapidly dissolves & shrinks the bobbing glossy roux cubes!
        b.melt = Math.min(1, b.melt + dt * (0.04 + meltRate * 0.42));
        b.angle += dt * (0.4 + stirSpeed * 2.4);
        const r = b.radius * (1 - b.melt * 0.45);
        b.floatMesh.position.set(
          Math.cos(b.angle) * r,
          surfaceLocalY - 0.003 + Math.sin(time * 3.4 + b.idx) * 0.003,
          Math.sin(b.angle) * r
        );
        b.floatMesh.rotation.y += dt * (0.8 + stirSpeed * 2.0);
        const s = Math.max(0.01, 1 - b.melt * 0.96);
        b.floatMesh.scale.set(s * (1 + b.melt * 0.25), s * (1 - b.melt * 0.35), s * (1 + b.melt * 0.25));
        if (b.melt >= 0.99) {
          b.state = 'gone';
          b.floatMesh.visible = false;
        }
      }
    }
  }

  reset() {
    this.trayGroup.visible = false;
    for (const b of this.blocks) {
      b.state = 'tray';
      b.melt = 0;
      b.trayMesh.visible = true;
      b.floatMesh.visible = false;
      b.floatMesh.scale.set(1, 1, 1);
    }
  }
}

// -------------------------------------------------------------------------
// 5. STEAMING CERAMIC CURRY PLATE (White Koshihikari Rice + Glossy Curry Pool + Bites!)
// -------------------------------------------------------------------------
export class CurryPlateModel {
  constructor(riceTex, carrotTex, potatoTex, steamTex) {
    this.group = new THREE.Group();

    // Warm cream handmade stoneware oval curry plate with subtle speckled rim
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0e8db,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    });
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0x9c7b5c,
      roughness: 0.38,
      clearcoat: 0.55,
    });

    // Sculpted lathe profile for deep Japanese curry oval plate
    const pts = [
      new THREE.Vector2(0.0, 0.003),
      new THREE.Vector2(0.115, 0.004),
      new THREE.Vector2(0.145, 0.016),
      new THREE.Vector2(0.168, 0.036),
      new THREE.Vector2(0.172, 0.038),
      new THREE.Vector2(0.162, 0.039),
      new THREE.Vector2(0.140, 0.020),
      new THREE.Vector2(0.110, 0.011),
      new THREE.Vector2(0.0, 0.010),
    ];
    const plateGeo = new THREE.LatheGeometry(pts, 40);
    plateGeo.scale(1.14, 1.0, 0.90);
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    this.group.add(plateMesh);

    // Earthy ceramic rim accent
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.167, 0.0035, 8, 42), rimMat);
    rimRing.rotation.x = Math.PI * 0.5;
    rimRing.scale.set(1.14, 0.90, 1.0);
    rimRing.position.y = 0.038;
    this.group.add(rimRing);

    // Steaming mound of glossy Koshihikari white rice on the RIGHT half of the plate
    // Uses matte-moist starch base + 360 sculpted 3D individual plump rice grains blanketing the mound!
    const riceMat = new THREE.MeshStandardMaterial({
      map: riceTex.map,
      bumpMap: riceTex.bumpMap,
      bumpScale: 0.0055,
      roughnessMap: riceTex.roughnessMap,
      roughness: 0.52,
      metalness: 0.0,
    });
    const grainMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf8f1,
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.32,
    });
    const riceGeo = new THREE.SphereGeometry(0.086, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    riceGeo.scale(0.98, 0.52, 1.05);
    jitterGeometry(riceGeo, 0.0038, 77);
    this.riceMesh = new THREE.Mesh(riceGeo, riceMat);
    this.riceMesh.position.set(0.056, 0.009, 0.0);
    this.riceMesh.castShadow = true;
    this.riceMesh.receiveShadow = true;
    this.group.add(this.riceMesh);

    // 920 densely packed plump 3D Koshihikari rice grains carpeting the entire dome seamlessly!
    const grainGeo = new THREE.SphereGeometry(0.0046, 6, 5);
    grainGeo.scale(1.62, 0.72, 0.88);
    const grainCount = 920;
    this.riceGrains = new THREE.InstancedMesh(grainGeo, grainMat, grainCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < grainCount; i++) {
      const u = (i + 0.5) / grainCount;
      const phi = Math.acos(1 - u * 0.97);
      const theta = i * 2.3999632;
      const rx = 0.085 * Math.sin(phi) * 0.98;
      const ry = 0.085 * Math.cos(phi) * 0.52;
      const rz = 0.085 * Math.sin(phi) * 1.05;
      const jitter = 0.93 + ((i * 37) % 13) * 0.009;
      dummy.position.set(0.056 + Math.cos(theta) * rx * jitter, 0.0085 + ry * jitter, Math.sin(theta) * rz * jitter);
      dummy.rotation.set(((i * 19) % 10) * 0.25, theta + ((i * 7) % 11) * 0.35, ((i * 23) % 10) * 0.22);
      const sc = 0.90 + ((i * 13) % 7) * 0.045;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      this.riceGrains.setMatrixAt(i, dummy.matrix);
    }
    this.riceGrains.castShadow = true;
    this.riceGrains.receiveShadow = true;
    this.group.add(this.riceGrains);

    // Glossy poured Curry Pool on the LEFT half (rich warm amber-mahogany with organic wavy edge & oil sheen!)
    this.curryPoolGroup = new THREE.Group();
    this.group.add(this.curryPoolGroup);

    // Procedural mottled warm-spice curry sauce texture for plated pool
    const sc = document.createElement('canvas');
    sc.width = 256;
    sc.height = 256;
    const sctx = sc.getContext('2d');
    const sg = sctx.createRadialGradient(128, 128, 18, 128, 128, 128);
    sg.addColorStop(0, '#6b3412');
    sg.addColorStop(0.55, '#59280d');
    sg.addColorStop(1, '#431c08');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 650; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      const r = 1 + (i % 4);
      sctx.fillStyle = i % 3 === 0 ? 'rgba(180,104,36,0.16)' : 'rgba(54,22,8,0.18)';
      sctx.beginPath();
      sctx.arc(x, y, r, 0, Math.PI * 2);
      sctx.fill();
    }
    const sauceTex = new THREE.CanvasTexture(sc);
    sauceTex.colorSpace = THREE.SRGBColorSpace;

    const curryPoolMat = new THREE.MeshPhysicalMaterial({
      map: sauceTex,
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.09,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xd87b2c),
    });
    const poolGeo = new THREE.SphereGeometry(0.118, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    poolGeo.scale(1.02, 0.19, 0.96);
    jitterGeometry(poolGeo, 0.0028, 51);
    this.curryPoolMesh = new THREE.Mesh(poolGeo, curryPoolMat);
    this.curryPoolMesh.position.set(-0.044, 0.009, 0.0);
    this.curryPoolMesh.receiveShadow = true;
    this.curryPoolGroup.add(this.curryPoolMesh);

    // Rich appetizing chunks partially submerged in the thick glossy curry!
    this.platedChunks = [];
    const cMat = new THREE.MeshPhysicalMaterial({ map: carrotTex.innerMap, color: 0xf29044, roughness: 0.20, clearcoat: 0.85 });
    const cCoreMat = new THREE.MeshPhysicalMaterial({ map: carrotTex.coreMap, color: 0xf69a50, roughness: 0.22, clearcoat: 0.82 });
    const pMat = new THREE.MeshPhysicalMaterial({ map: potatoTex.innerMap, color: 0xdfb26b, roughness: 0.26, clearcoat: 0.72 });
    const mMat = new THREE.MeshPhysicalMaterial({ color: 0x522510, roughness: 0.24, clearcoat: 0.86 });
    const oMat = new THREE.MeshPhysicalMaterial({ color: 0xc98c3e, roughness: 0.18, clearcoat: 0.9, transparent: true, opacity: 0.82 });

    const chunkSpecs = [
      { kind: 'c', x: -0.072, z: -0.028, y: 0.022, ladles: 1 },
      { kind: 'p', x: -0.036, z: 0.032, y: 0.022, ladles: 1 },
      { kind: 'o', x: -0.056, z: 0.004, y: 0.024, ladles: 1 },
      { kind: 'm', x: -0.094, z: 0.018, y: 0.021, ladles: 2 },
      { kind: 'c', x: -0.018, z: -0.042, y: 0.023, ladles: 2 },
      { kind: 'p', x: -0.068, z: 0.046, y: 0.022, ladles: 2 },
      { kind: 'o', x: -0.032, z: -0.016, y: 0.026, ladles: 2 },
      { kind: 'c', x: -0.046, z: -0.004, y: 0.026, ladles: 3 },
      { kind: 'p', x: -0.096, z: -0.018, y: 0.021, ladles: 3 },
      { kind: 'm', x: -0.024, z: 0.016, y: 0.025, ladles: 3 },
    ];
    chunkSpecs.forEach((sp, i) => {
      let mesh;
      if (sp.kind === 'c') {
        const g = new THREE.CylinderGeometry(0.014, 0.016, 0.016, 16);
        jitterGeometry(g, 0.001, 10 + i);
        mesh = new THREE.Mesh(g, [cMat, cCoreMat, cCoreMat]);
      } else if (sp.kind === 'p') {
        const g = new THREE.SphereGeometry(0.018, 16, 12);
        g.scale(1.18, 0.78, 0.96);
        jitterGeometry(g, 0.002, 20 + i);
        mesh = new THREE.Mesh(g, pMat);
      } else if (sp.kind === 'o') {
        mesh = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0032, 6, 12, Math.PI * 0.7), oMat);
      } else {
        const g = new THREE.SphereGeometry(0.017, 14, 10);
        g.scale(1.22, 0.76, 1.04);
        jitterGeometry(g, 0.0022, 30 + i);
        mesh = new THREE.Mesh(g, mMat);
      }
      mesh.position.set(sp.x, sp.y, sp.z);
      mesh.rotation.set(0.35 + i * 0.5, i * 1.1, 0.25 + i * 0.3);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      mesh.userData = { minLadle: sp.ladles, eaten: false };
      this.curryPoolGroup.add(mesh);
      this.platedChunks.push(mesh);
    });

    // Jewel-like ruby-red Fukujinzuke pickles tucked prominently on upper-left/front ceramic rim!
    this.fukujinzuke = new THREE.Group();
    const pickleMat = new THREE.MeshPhysicalMaterial({
      color: 0xa81b12,
      roughness: 0.14,
      clearcoat: 0.92,
    });
    for (let i = 0; i < 9; i++) {
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0045, 0.009), pickleMat);
      const a = (i / 9) * Math.PI * 2;
      const rr = 0.008 + (i % 3) * 0.006;
      pk.position.set(-0.005 + Math.cos(a) * rr, 0.018 + (i % 2) * 0.004, -0.095 + Math.sin(a) * rr);
      pk.rotation.set(0.22 * i, 0.65 * i, 0.14 * i);
      pk.castShadow = true;
      this.fukujinzuke.add(pk);
    }
    this.fukujinzuke.visible = false;
    this.group.add(this.fukujinzuke);

    // Delicate rising steam above warm rice & hot plated curry!
    this.steamSprites = [];
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: steamTex,
          color: 0xffebd2,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      this.group.add(sp);
      this.steamSprites.push({
        sprite: sp,
        age: Math.random() * 2.2,
        life: 1.8 + Math.random() * 1.1,
        x: (Math.random() - 0.5) * 0.14,
        z: (Math.random() - 0.5) * 0.10,
      });
    }

    this.ladleCount = 0;
    this.fillLevel = 0;
    this.targetFill = 0;
    this.bitesTaken = 0;
    this.curryPoolMesh.scale.set(0.01, 0.01, 0.01);
    this.curryPoolMesh.visible = false;
  }

  addLadle() {
    this.ladleCount = Math.min(3, this.ladleCount + 1);
    this.targetFill = this.ladleCount / 3;
    this.curryPoolMesh.visible = true;
    for (const ch of this.platedChunks) {
      if (ch.userData.minLadle <= this.ladleCount && !ch.userData.eaten) {
        ch.visible = true;
      }
    }
    if (this.ladleCount >= 3) {
      this.fukujinzuke.visible = true;
    }
  }

  takeBite() {
    this.bitesTaken = Math.min(5, this.bitesTaken + 1);
    // Hide 1-2 chunks and gently reduce rice & curry volume so child visibly sees her bites!
    const remaining = Math.max(0.18, 1 - this.bitesTaken * 0.17);
    this.targetFill = remaining;
    let hidden = 0;
    for (const ch of this.platedChunks) {
      if (ch.visible && !ch.userData.eaten && hidden < 2) {
        ch.userData.eaten = true;
        ch.visible = false;
        hidden++;
      }
    }
    return this.bitesTaken;
  }

  update(dt, steamActive = true) {
    this.fillLevel += (this.targetFill - this.fillLevel) * Math.min(1, dt * 4.5);
    if (this.fillLevel > 0.02) {
      const s = 0.42 + this.fillLevel * 0.62;
      const sy = 0.28 + this.fillLevel * 0.78;
      this.curryPoolMesh.scale.set(s, sy, s);
      this.curryPoolMesh.visible = true;
    } else {
      this.curryPoolMesh.visible = false;
    }

    const riceRemain = Math.max(0.32, 1 - this.bitesTaken * 0.14);
    this.riceMesh.scale.lerp(new THREE.Vector3(riceRemain, riceRemain, riceRemain), Math.min(1, dt * 5));
    this.riceGrains.scale.copy(this.riceMesh.scale);

    // Gentle backlit steam wisps rising off warm rice & hot curry
    for (const s of this.steamSprites) {
      s.age += dt;
      if (s.age >= s.life) {
        s.age = 0;
        s.x = (this.fillLevel > 0.2 ? (Math.random() - 0.5) * 0.16 : 0.04 + (Math.random() - 0.5) * 0.08);
        s.z = (Math.random() - 0.5) * 0.10;
      }
      const p = s.age / s.life;
      s.sprite.position.set(s.x + p * 0.03, 0.042 + p * 0.18, s.z);
      const sc = 0.045 + p * 0.085;
      s.sprite.scale.set(sc, sc * 1.15, 1);
      const intensity = steamActive ? (0.11 + this.fillLevel * 0.11) : 0;
      s.sprite.material.opacity = Math.sin(p * Math.PI) * intensity;
    }
  }

  reset() {
    this.ladleCount = 0;
    this.fillLevel = 0;
    this.targetFill = 0;
    this.bitesTaken = 0;
    this.curryPoolMesh.visible = false;
    this.fukujinzuke.visible = false;
    this.riceMesh.scale.set(1, 1, 1);
    this.riceGrains.scale.set(1, 1, 1);
    for (const ch of this.platedChunks) {
      ch.visible = false;
      ch.userData.eaten = false;
    }
  }
}
