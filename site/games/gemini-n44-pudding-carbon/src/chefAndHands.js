import * as THREE from 'three';

/**
 * Builds an anatomically sculpted, seamless human hand & long linen-cuffed forearm.
 * side: +1 for Right Hand, -1 for Left Hand.
 * Scaled generously (1.16x) so hands feel bold, warm, and close-up on screen!
 */
export function createSculptedHand(materials, side = 1) {
  const root = new THREE.Group();

  const wrist = new THREE.Group();
  wrist.scale.setScalar(1.16);
  root.add(wrist);

  // Continuous Single-Mesh Sculpted Palm-to-Wrist-to-Forearm Skin Envelope!
  // Eliminates any cylindrical seam between forearm and palm!
  const armSegs = 28;
  const armRings = 22;
  const armVerts = [];
  const armUvs = [];
  const armIndices = [];

  for (let r = 0; r <= armRings; r++) {
    const t = r / armRings; // 0 knuckle line (z = -0.105) -> 1 forearm inside cuff (z = +0.26)
    const z = THREE.MathUtils.lerp(-0.105, 0.26, t);
    // Smooth anatomical width & thickness profile from wide flat metacarpal palm -> oval wrist -> round forearm!
    const isPalm = 1.0 - THREE.MathUtils.smoothstep(t, 0.06, 0.36);
    const wristPinch = Math.exp(-Math.pow((t - 0.36) / 0.12, 2)) * 0.009;
    const forearmGrow = THREE.MathUtils.smoothstep(t, 0.36, 1.0);

    const rx = THREE.MathUtils.lerp(0.052, 0.078, isPalm) - wristPinch + forearmGrow * 0.008;
    const ry = THREE.MathUtils.lerp(0.042, 0.028, isPalm) - wristPinch * 0.5 + forearmGrow * 0.010;
    const cx = side * forearmGrow * 0.042;
    const cy = forearmGrow * 0.032 - isPalm * 0.003;

    for (let s = 0; s <= armSegs; s++) {
      const theta = (s / armSegs) * Math.PI * 2;
      let vx = cx + Math.cos(theta) * rx;
      let vy = cy + Math.sin(theta) * ry;
      // Gentle dorsal arch on back of hand & subtle palm hollow underneath
      if (isPalm > 0.1) {
        if (Math.sin(theta) > 0) vy += Math.pow(Math.sin(theta), 2) * 0.006 * isPalm;
        else vy += Math.pow(Math.sin(theta), 2) * 0.005 * isPalm;
      }
      // Close front knuckle edge smoothly at t = 0
      const capScale = r === 0 ? 0.15 : 1.0;
      armVerts.push(cx + (vx - cx) * capScale, cy + (vy - cy) * capScale, z);
      armUvs.push(s / armSegs, t);
    }
  }
  const cols = armSegs + 1;
  for (let r = 0; r < armRings; r++) {
    for (let s = 0; s < armSegs; s++) {
      const a = r * cols + s;
      const b = a + 1;
      const c = (r + 1) * cols + s;
      const d = c + 1;
      armIndices.push(a, b, d);
      armIndices.push(a, d, c);
    }
  }
  const handEnvelopeGeo = new THREE.BufferGeometry();
  handEnvelopeGeo.setAttribute('position', new THREE.Float32BufferAttribute(armVerts, 3));
  handEnvelopeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(armUvs, 2));
  handEnvelopeGeo.setIndex(armIndices);
  handEnvelopeGeo.computeVertexNormals();

  const handEnvelope = new THREE.Mesh(handEnvelopeGeo, materials.skin);
  handEnvelope.castShadow = true;
  handEnvelope.receiveShadow = true;
  wrist.add(handEnvelope);

  // Soft Rolled Charcoal Linen Cuff + Long Off-Screen Sleeve
  const cuffFold1 = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.021, 16, 32), materials.chefCoat);
  cuffFold1.scale.set(1.06, 0.88, 1.0);
  cuffFold1.position.set(side * 0.042, 0.032, 0.245);
  cuffFold1.rotation.set(-0.12, side * 0.14, 0);
  cuffFold1.castShadow = true;
  wrist.add(cuffFold1);

  const cuffFold2 = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.018, 14, 28), materials.chefCoat);
  cuffFold2.scale.set(1.06, 0.88, 1.0);
  cuffFold2.position.set(side * 0.048, 0.036, 0.275);
  cuffFold2.rotation.set(-0.12, side * 0.14, 0);
  wrist.add(cuffFold2);

  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.046, 0.035, 0.255),
    new THREE.Vector3(side * 0.15, 0.09, 0.65),
    new THREE.Vector3(side * 0.36, 0.16, 1.45),
  ]);
  const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 20, 0.088, 20, false);
  const sleeve = new THREE.Mesh(sleeveGeo, materials.chefCoat);
  sleeve.castShadow = true;
  wrist.add(sleeve);

  const palmGroup = new THREE.Group();
  wrist.add(palmGroup);

  // Soft blended thumb web / thenar muscle
  const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16), materials.skin);
  thenar.scale.set(0.95, 0.58, 1.35);
  thenar.position.set(-side * 0.050, -0.010, -0.042);
  thenar.rotation.y = side * 0.34;
  palmGroup.add(thenar);

  function buildFinger({ lengthScale = 1.0, radiusScale = 1.0, isThumb = false }) {
    const basePivot = new THREE.Group();

    const r1 = 0.0178 * radiusScale;
    const r2 = 0.0152 * radiusScale;
    const r3 = 0.0128 * radiusScale;
    const l1 = (isThumb ? 0.045 : 0.051) * lengthScale;
    const l2 = (isThumb ? 0.037 : 0.036) * lengthScale;
    const l3 = (isThumb ? 0.031 : 0.028) * lengthScale;

    const j1 = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.04, 16, 14), materials.skin);
    j1.scale.set(1.02, 0.88, 1.04);
    basePivot.add(j1);

    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, l1, 16), materials.skin);
    seg1.scale.set(1.0, 1.0, 0.90);
    seg1.rotation.x = Math.PI * 0.5;
    seg1.position.z = -l1 * 0.5;
    seg1.castShadow = true;
    basePivot.add(seg1);

    const midPivot = new THREE.Group();
    midPivot.position.z = -l1;
    basePivot.add(midPivot);

    const j2 = new THREE.Mesh(new THREE.SphereGeometry(r2 * 1.03, 16, 14), materials.skin);
    j2.scale.set(1.0, 0.90, 1.02);
    midPivot.add(j2);

    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(r3, r2, l2, 16), materials.skin);
    seg2.scale.set(1.0, 1.0, 0.90);
    seg2.rotation.x = Math.PI * 0.5;
    seg2.position.z = -l2 * 0.5;
    seg2.castShadow = true;
    midPivot.add(seg2);

    const tipPivot = new THREE.Group();
    tipPivot.position.z = -l2;
    midPivot.add(tipPivot);

    const j3 = new THREE.Mesh(new THREE.SphereGeometry(r3 * 1.01, 14, 12), materials.skin);
    tipPivot.add(j3);

    const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(r3 * 0.84, r3, l3 * 0.72, 16), materials.skin);
    seg3.rotation.x = Math.PI * 0.5;
    seg3.position.z = -l3 * 0.36;
    seg3.castShadow = true;
    tipPivot.add(seg3);

    const padTip = new THREE.Mesh(new THREE.SphereGeometry(r3 * 0.86, 16, 14), materials.skin);
    padTip.scale.set(1.0, 0.84, 1.24);
    padTip.position.z = -l3 * 0.74;
    tipPivot.add(padTip);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(r3 * 0.70, 14, 10), materials.nail);
    nail.scale.set(0.86, 0.20, 1.16);
    nail.position.set(0, r3 * 0.70, -l3 * 0.68);
    nail.rotation.x = -0.08;
    tipPivot.add(nail);

    return { basePivot, midPivot, tipPivot };
  }

  const fingerSpecs = [
    { x: -side * 0.046, z: -0.104, splay: side * 0.065, len: 0.95, rad: 0.96 },
    { x: -side * 0.015, z: -0.110, splay: side * 0.015, len: 1.04, rad: 1.0 },
    { x: side * 0.016, z: -0.107, splay: -side * 0.03, len: 0.96, rad: 0.95 },
    { x: side * 0.045, z: -0.098, splay: -side * 0.08, len: 0.79, rad: 0.86 },
  ];

  const fingers = fingerSpecs.map((sp) => {
    const f = buildFinger({ lengthScale: sp.len, radiusScale: sp.rad, isThumb: false });
    f.basePivot.position.set(sp.x, 0.002, sp.z);
    f.basePivot.rotation.y = sp.splay;
    palmGroup.add(f.basePivot);
    return f;
  });

  const thumb = buildFinger({ lengthScale: 0.86, radiusScale: 1.12, isThumb: true });
  thumb.basePivot.position.set(-side * 0.064, -0.012, -0.044);
  thumb.basePivot.rotation.set(0.24, side * 0.62, side * 0.42);
  palmGroup.add(thumb.basePivot);

  const poses = {
    relaxed: { curls: [0.34, 0.42, 0.48, 0.56], thumb: [0.28, 0.22] },
    pinchEgg: { curls: [0.58, 0.64, 0.76, 0.88], thumb: [0.55, 0.42] },
    gripHandle: { curls: [1.18, 1.25, 1.30, 1.35], thumb: [0.85, 0.65] },
    cradleCup: { curls: [0.48, 0.54, 0.58, 0.64], thumb: [0.48, 0.35] },
    pokeIndex: { curls: [0.14, 0.98, 1.08, 1.15], thumb: [0.72, 0.52] },
    flatFlip: { curls: [0.18, 0.22, 0.25, 0.28], thumb: [0.22, 0.15] },
  };

  const curCurls = [0.34, 0.42, 0.48, 0.56];
  const curThumb = [0.28, 0.22];
  const targetPos = new THREE.Vector3(side * 0.65, 0.42, 0.45);
  const targetRot = new THREE.Euler(0, 0, 0);
  let targetPose = 'relaxed';

  function setTarget(pos, rotEuler, poseName = 'relaxed') {
    targetPos.copy(pos);
    targetRot.copy(rotEuler);
    targetPose = poses[poseName] ? poseName : 'relaxed';
  }

  function snapToTarget() {
    wrist.position.copy(targetPos);
    wrist.rotation.copy(targetRot);
  }

  function update(dt) {
    const lerpF = Math.min(1, dt * 13.5);
    wrist.position.lerp(targetPos, lerpF);
    wrist.rotation.x = THREE.MathUtils.lerp(wrist.rotation.x, targetRot.x, lerpF);
    wrist.rotation.y = THREE.MathUtils.lerp(wrist.rotation.y, targetRot.y, lerpF);
    wrist.rotation.z = THREE.MathUtils.lerp(wrist.rotation.z, targetRot.z, lerpF);

    const p = poses[targetPose];
    for (let i = 0; i < 4; i++) {
      curCurls[i] = THREE.MathUtils.lerp(curCurls[i], p.curls[i], lerpF);
      const c = curCurls[i];
      fingers[i].basePivot.rotation.x = -c * 0.72;
      fingers[i].midPivot.rotation.x = -c * 0.85;
      fingers[i].tipPivot.rotation.x = -c * 0.58;
    }
    curThumb[0] = THREE.MathUtils.lerp(curThumb[0], p.thumb[0], lerpF);
    curThumb[1] = THREE.MathUtils.lerp(curThumb[1], p.thumb[1], lerpF);
    thumb.midPivot.rotation.x = -curThumb[0];
    thumb.tipPivot.rotation.x = -curThumb[1];
  }

  return { root, wrist, fingers, thumb, setTarget, snapToTarget, update };
}

/**
 * True-Scale Live-Action Studio Patissier ("人物" — Chef's Table Tabletop Framing!)
 * Scaled to authentic human proportions (shoulder width ~1.72 units across the table!),
 * featuring a tailored dark linen patissier jacket with double-breasted lapel & buttons,
 * black canvas bib apron, warm human neck & collarbones, and a SINGLE seamless sculpted
 * anatomical lower-face/jawline/chin & warm smiling lips framed naturally at the top of the shot!
 * ZERO doll-like stuck-on sphere balls!
 */
export function createStudioPatissier(materials) {
  const root = new THREE.Group();
  // True human scale positioned cleanly behind the dessert plate (Chef's Table framing: smiling lips, chin, neck, shoulders & apron!)
  root.position.set(0, -1.17, -1.20);
  root.scale.setScalar(1.78);

  const torsoPivot = new THREE.Group();
  root.add(torsoPivot);

  // Smooth Organic Human Shoulders & Chest (single continuous sculpted envelope, no separate arm balls!)
  const bodySegs = 56;
  const bodyRings = 24;
  const bPos = [];
  const bUv = [];
  const bIdx = [];

  for (let r = 0; r <= bodyRings; r++) {
    const t = r / bodyRings; // 0 waist -> 1 collar base
    const y = t * 1.06;
    // Natural human trapezius & deltoid shoulder slope!
    let rx, rz;
    if (t < 0.72) {
      const k = t / 0.72;
      rx = THREE.MathUtils.lerp(0.38, 0.49, Math.pow(k, 0.75));
      rz = THREE.MathUtils.lerp(0.21, 0.25, k);
    } else {
      const k = (t - 0.72) / 0.28; // Slope smoothly from deltoids into neck collar!
      rx = THREE.MathUtils.lerp(0.49, 0.115, Math.pow(k, 1.35));
      rz = THREE.MathUtils.lerp(0.25, 0.105, Math.pow(k, 1.25));
    }

    for (let s = 0; s <= bodySegs; s++) {
      const phi = (s / bodySegs) * Math.PI * 2;
      // Squircle cross-section for realistic broad chest & sloping shoulders
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      const chestCurve = 1.0 + 0.08 * Math.pow(Math.abs(cosP), 3) * Math.sin(t * Math.PI);
      const vx = cosP * rx * chestCurve;
      const vz = sinP * rz;
      bPos.push(vx, y, vz);
      bUv.push((s / bodySegs) * 2, t * 2);
    }
  }
  const bCols = bodySegs + 1;
  for (let r = 0; r < bodyRings; r++) {
    for (let s = 0; s < bodySegs; s++) {
      const a = r * bCols + s;
      const b = a + 1;
      const c = (r + 1) * bCols + s;
      const d = c + 1;
      bIdx.push(a, c, d);
      bIdx.push(a, d, b);
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
  bodyGeo.setIndex(bIdx);
  bodyGeo.computeVertexNormals();

  const torsoMesh = new THREE.Mesh(bodyGeo, materials.chefCoat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoPivot.add(torsoMesh);

  // Sleeves draping smoothly all the way down past the tabletop level (no floating ends!)
  [-1, 1].forEach((side) => {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.42, 0.78, 0.0),
      new THREE.Vector3(side * 0.51, 0.44, 0.04),
      new THREE.Vector3(side * 0.56, -0.10, 0.08),
    ]);
    const armGeo = new THREE.TubeGeometry(armCurve, 16, 0.108, 20, false);
    const armMesh = new THREE.Mesh(armGeo, materials.chefCoat);
    armMesh.castShadow = true;
    torsoPivot.add(armMesh);
  });

  // Open Mandarin Patissier Collar (openEnded = true so NO flat grey cap across the throat!)
  const collarMat = materials.chefCoat.clone();
  collarMat.side = THREE.DoubleSide;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.128, 0.055, 36, 1, true, -Math.PI * 0.80, Math.PI * 1.60),
    collarMat
  );
  collar.rotation.y = Math.PI;
  collar.position.set(0, 1.065, 0.005);
  torsoPivot.add(collar);

  // Heavy Black Canvas Bib Apron + Woven Neck Strap + Brass Grommets
  const apronGeo = new THREE.BoxGeometry(0.42, 0.64, 0.022, 12, 8, 1);
  // Curve the apron softly around the chest!
  const apArr = apronGeo.attributes.position.array;
  for (let i = 0; i < apArr.length; i += 3) {
    const x = apArr[i];
    apArr[i + 2] -= x * x * 0.42;
  }
  apronGeo.computeVertexNormals();
  const apronBib = new THREE.Mesh(apronGeo, materials.chefApron);
  apronBib.position.set(0, 0.58, 0.252);
  apronBib.rotation.x = -0.05;
  apronBib.castShadow = true;
  torsoPivot.add(apronBib);

  [-1, 1].forEach((side) => {
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.155, 0.87, 0.252),
      new THREE.Vector3(side * 0.145, 0.99, 0.14),
      new THREE.Vector3(side * 0.115, 1.07, 0.01),
    ]);
    const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 12, 0.012, 10, false), materials.chefApron);
    torsoPivot.add(strap);

    const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0035, 8, 18), materials.brass);
    grommet.position.set(side * 0.155, 0.865, 0.264);
    torsoPivot.add(grommet);
  });

  // Warm Sculpted Human Neck + Clavicle / Throat Hollow
  const neckPts = [
    new THREE.Vector2(0.106, 0.0),
    new THREE.Vector2(0.086, 0.08),
    new THREE.Vector2(0.082, 0.17),
    new THREE.Vector2(0.088, 0.22),
  ];
  const neck = new THREE.Mesh(new THREE.LatheGeometry(neckPts, 36), materials.skin);
  neck.position.set(0, 1.03, 0.012);
  neck.castShadow = true;
  torsoPivot.add(neck);

  // Seamless Single-Mesh Anatomical Lower/Mid Face & Jawline (Chef's Table Cinema Framing!)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.21, 0.035);
  torsoPivot.add(headPivot);

  const fSegs = 56;
  const fRings = 28;
  const fPos = [];
  const fUv = [];
  const fIdx = [];

  for (let r = 0; r <= fRings; r++) {
    const t = r / fRings; // 0 chin bottom -> 1 upper cranium
    const y = THREE.MathUtils.lerp(-0.045, 0.28, t);

    // Smooth human cranium/jaw base radius
    let baseRx, baseRz;
    if (t < 0.16) {
      const k = t / 0.16;
      const s = Math.sin(k * Math.PI * 0.5);
      baseRx = 0.096 * s;
      baseRz = 0.112 * s;
    } else if (t < 0.56) {
      const k = (t - 0.16) / 0.40;
      baseRx = THREE.MathUtils.lerp(0.096, 0.124, Math.sin(k * Math.PI * 0.6));
      baseRz = THREE.MathUtils.lerp(0.112, 0.134, Math.sin(k * Math.PI * 0.6));
    } else {
      const k = (t - 0.56) / 0.44;
      baseRx = Math.cos(k * Math.PI * 0.5) * 0.124;
      baseRz = Math.cos(k * Math.PI * 0.5) * 0.134;
    }

    for (let s = 0; s <= fSegs; s++) {
      const phi = (s / fSegs) * Math.PI * 2; // phi = PI/2 is +Z (front face!)
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi); // +1 at front center (+Z)

      let vx = cosP * baseRx;
      let vz = sinP * baseRz;

      // Continuous harmonic facial anatomy sculpted right into the single mesh:
      if (sinP > 0) {
        // 1. Soft chin prominence (t ~ 0.10, center front)
        const chin = Math.exp(-Math.pow((t - 0.10) / 0.07, 2)) * Math.pow(sinP, 6) * 0.014;
        // 2. Labiomental fold (natural dip between chin and lower lip, t ~ 0.17)
        const mentFold = -Math.exp(-Math.pow((t - 0.17) / 0.04, 2)) * Math.pow(sinP, 8) * 0.006;
        // 3. Soft warm cheeks (t ~ 0.34, phi offset +-32 deg)
        const cheekSide = Math.exp(-Math.pow((Math.abs(cosP) - 0.52) / 0.28, 2));
        const cheek = Math.exp(-Math.pow((t - 0.34) / 0.14, 2)) * cheekSide * sinP * 0.012;
        // 4. Smooth nose contour (t ~ 0.34..0.52, center front)
        const noseTip = Math.exp(-Math.pow((t - 0.36) / 0.055, 2)) * Math.pow(sinP, 26) * 0.024;
        const noseBridge = Math.exp(-Math.pow((t - 0.46) / 0.08, 2)) * Math.pow(sinP, 22) * 0.015;

        vz += chin + mentFold + cheek + noseTip + noseBridge;
      }

      fPos.push(vx, y, vz);
      fUv.push(s / fSegs, t);
    }
  }
  const fCols = fSegs + 1;
  for (let r = 0; r < fRings; r++) {
    for (let s = 0; s < fSegs; s++) {
      const a = r * fCols + s;
      const b = a + 1;
      const c = (r + 1) * fCols + s;
      const d = c + 1;
      fIdx.push(a, c, d);
      fIdx.push(a, d, b);
    }
  }
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  faceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUv, 2));
  faceGeo.setIndex(fIdx);
  faceGeo.computeVertexNormals();

  const faceMesh = new THREE.Mesh(faceGeo, materials.skin);
  faceMesh.castShadow = true;
  faceMesh.receiveShadow = false;
  headPivot.add(faceMesh);

  // Subtle soft natural lips integrated cleanly at the mouth contour
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.022, 0.114);
  headPivot.add(mouthGroup);

  const mouthInterior = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x220706 })
  );
  mouthInterior.scale.set(1.08, 0.08, 0.4);
  mouthInterior.position.set(0, 0, -0.006);
  mouthGroup.add(mouthInterior);

  const upperLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.0052, 10, 22, Math.PI * 0.82),
    materials.lips
  );
  upperLip.rotation.set(Math.PI * 0.42, 0, Math.PI * 0.09);
  upperLip.position.set(0, 0.003, 0);
  mouthGroup.add(upperLip);

  const lowerLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0060, 10, 22, Math.PI * 0.78),
    materials.lips
  );
  lowerLip.rotation.set(-Math.PI * 0.42, 0, Math.PI * 0.11);
  lowerLip.position.set(0, -0.004, 0.001);
  mouthGroup.add(lowerLip);

  // Classic Dark Patissier Beret + Soft Hair Bangs & Serene Downcast Eyelashes (for tall Portrait viewports!)
  [-1, 1].forEach((side) => {
    // Gentle curved eyelash/eyelid crease looking warmly down at the table
    const lash = new THREE.Mesh(
      new THREE.TorusGeometry(0.019, 0.0020, 8, 18, Math.PI * 0.78),
      materials.darkWood
    );
    lash.rotation.set(-Math.PI * 0.36, side * 0.22, Math.PI * 0.11);
    lash.position.set(side * 0.044, 0.095, 0.118);
    headPivot.add(lash);

    const brow = new THREE.Mesh(
      new THREE.TorusGeometry(0.023, 0.0024, 8, 16, Math.PI * 0.70),
      materials.darkWood
    );
    brow.rotation.set(Math.PI * 0.40, -side * 0.18, Math.PI * 0.15);
    brow.position.set(side * 0.046, 0.118, 0.116);
    headPivot.add(brow);

    const sideHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.095, 8, 12), materials.chefApron);
    sideHair.position.set(side * 0.112, 0.092, 0.02);
    sideHair.rotation.set(0.14, 0, side * 0.12);
    headPivot.add(sideHair);
  });

  const capGroup = new THREE.Group();
  capGroup.position.set(0, 0.155, 0.008);
  capGroup.rotation.x = 0.16;
  headPivot.add(capGroup);

  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.124, 0.038, 40), materials.chefApron);
  capGroup.add(capBand);

  const beretCrown = new THREE.Mesh(new THREE.SphereGeometry(0.155, 32, 22), materials.chefCoat);
  beretCrown.scale.set(1.06, 0.56, 1.12);
  beretCrown.position.set(-0.01, 0.042, -0.01);
  capGroup.add(beretCrown);

  let time = 0;
  let leanForward = 0;
  let targetLean = 0;
  let mouthOpen = 0;
  let targetMouthOpen = 0;
  let smileLift = 0.28;
  let targetSmile = 0.28;
  let delightTimer = 0;
  let chewTimer = 0;
  const mouthWorldPos = new THREE.Vector3();

  function setMood(mood) {
    if (mood === 'attentive') {
      targetLean = 0.06;
      targetSmile = 0.32;
      targetMouthOpen = 0.02;
    } else if (mood === 'awe') {
      targetLean = 0.12;
      targetSmile = 0.65;
      targetMouthOpen = 0.48;
      delightTimer = 1.6;
    } else if (mood === 'openForBite') {
      targetLean = 0.15;
      targetSmile = 0.55;
      targetMouthOpen = 0.85;
    } else if (mood === 'chewHappy') {
      targetLean = 0.09;
      targetSmile = 0.85;
      chewTimer = 1.8;
      delightTimer = 1.8;
    } else {
      targetLean = 0.04;
      targetSmile = 0.28;
      targetMouthOpen = 0.0;
    }
  }

  function getMouthWorldPosition(outVec) {
    mouthGroup.getWorldPosition(outVec || mouthWorldPos);
    return outVec || mouthWorldPos;
  }

  function update(dt, lookTargetWorld = null) {
    time += dt;
    if (delightTimer > 0) {
      delightTimer -= dt;
      if (delightTimer <= 0 && chewTimer <= 0) setMood('attentive');
    }
    if (chewTimer > 0) {
      chewTimer -= dt;
      targetMouthOpen = 0.12 + Math.abs(Math.sin(time * 9.5)) * 0.28;
    }

    const f = Math.min(1, dt * 7.5);
    leanForward = THREE.MathUtils.lerp(leanForward, targetLean, f);
    mouthOpen = THREE.MathUtils.lerp(mouthOpen, targetMouthOpen, Math.min(1, dt * 12));
    smileLift = THREE.MathUtils.lerp(smileLift, targetSmile, f);

    const breath = Math.sin(time * 1.9) * 0.005;
    torsoPivot.position.y = breath;
    torsoPivot.rotation.x = leanForward + breath * 0.4;

    let headYaw = Math.sin(time * 0.7) * 0.025;
    if (lookTargetWorld) {
      headYaw += THREE.MathUtils.clamp(lookTargetWorld.x * 0.18, -0.18, 0.18);
    }
    const nod = delightTimer > 0 ? Math.sin(time * 7.5) * 0.032 * Math.min(1, delightTimer) : 0;
    headPivot.rotation.y = THREE.MathUtils.lerp(headPivot.rotation.y, headYaw, f);
    headPivot.rotation.x = 0.06 + leanForward * 0.35 + nod;
    headPivot.rotation.z = delightTimer > 0 ? Math.sin(time * 4.2) * 0.028 : Math.sin(time * 0.55) * 0.012;

    upperLip.position.y = 0.003 + mouthOpen * 0.006 + smileLift * 0.0025;
    lowerLip.position.y = -0.004 - mouthOpen * 0.016;
    mouthInterior.scale.set(1.04, Math.max(0.06, mouthOpen * 0.75), 0.4);
    mouthGroup.scale.x = 1.0 + smileLift * 0.15 - mouthOpen * 0.06;
  }

  return { root, torsoPivot, headPivot, mouthGroup, setMood, getMouthWorldPosition, update };
}
