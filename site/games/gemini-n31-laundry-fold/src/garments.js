import * as THREE from '../vendor/three.module.min.js';
import {
  createFeltMaterial,
  createWoodMaterial,
  create3DStitchLine,
  createCraftButton,
  getStitchMaterial,
} from './textures.js';
import { FAMILY } from './config.js';

const T = 0.056; // Plush wool-felt single layer thickness

function makeRoundedPanelGeo(w, d, r = 0.08, thickness = T) {
  const rr = Math.min(r, w * 0.42, d * 0.42);
  const s = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  s.moveTo(-hw + rr, -hd);
  s.lineTo(hw - rr, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + rr);
  s.lineTo(hw, hd - rr);
  s.quadraticCurveTo(hw, hd, hw - rr, hd);
  s.lineTo(-hw + rr, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - rr);
  s.lineTo(-hw, -hd + rr);
  s.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();

  // Smooth world-scale UVs so patterns stay crisp & unstretched
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) * 0.65 + 0.5, pos.getZ(i) * 0.65 + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Cute wooden clothespin (洗濯バサミ) that clings to freshly sun-dried laundry!
 */
export function createClothespinMesh() {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial('#dca870');
  const springMat = new THREE.MeshStandardMaterial({ color: '#b8b0a4', roughness: 0.4, metalness: 0.6 });

  for (const sy of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.42), woodMat);
    leg.position.set(0, sy * 0.038, 0);
    leg.rotation.x = sy * 0.06;
    leg.castShadow = true;
    group.add(leg);
  }
  const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 10), springMat);
  coil.rotation.z = Math.PI / 2;
  coil.position.set(0, 0, -0.02);
  group.add(coil);

  // Cute painted pastel felt tip on top of clothespin
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.116, 0.095, 0.10),
    createFeltMaterial('#e67b72', { seed: 2101 })
  );
  tip.position.set(0, 0, -0.17);
  group.add(tip);

  // Generous invisible touch sphere
  const col = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  col.userData = { kind: 'clothespin' };
  group.add(col);
  group.userData = { kind: 'clothespin' };
  return group;
}

/**
 * Cute handmade felt pocket treasure (strawberry, star button, acorn, felt flower)!
 */
export function createTreasureMesh(kind = 'strawberry') {
  const g = new THREE.Group();
  if (kind === 'strawberry') {
    const berry = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.24, 14),
      createFeltMaterial('#e34f5d', { pattern: 'polka', accentHex: '#fde49c', seed: 2201 })
    );
    berry.rotation.x = Math.PI;
    berry.position.y = 0.08;
    berry.castShadow = true;
    g.add(berry);
    const leaf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.05, 0.05, 7),
      createFeltMaterial('#66a868', { seed: 2202 })
    );
    leaf.position.y = 0.20;
    g.add(leaf);
  } else if (kind === 'acorn') {
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 12, 10),
      createWoodMaterial('#c5874c')
    );
    nut.scale.set(0.95, 1.2, 0.95);
    nut.position.y = 0.11;
    nut.castShadow = true;
    g.add(nut);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.128, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      createFeltMaterial('#7a5337', { pattern: 'waffle', seed: 2203 })
    );
    cap.position.y = 0.16;
    g.add(cap);
  } else if (kind === 'felt_flower') {
    const petalMat = createFeltMaterial('#f28ca0', { seed: 2204 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), petalMat);
      p.position.set(Math.cos(a) * 0.09, 0.08, Math.sin(a) * 0.09);
      p.scale.y = 0.55;
      p.castShadow = true;
      g.add(p);
    }
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 8),
      createFeltMaterial('#f6ca45', { seed: 2205 })
    );
    c.position.y = 0.10;
    g.add(c);
  } else {
    // star_button
    const btn = createCraftButton({ radius: 0.15, thickness: 0.06, color: '#f4c747', threadColor: '#df657a', isWood: false });
    btn.position.y = 0.07;
    g.add(btn);
  }
  return g;
}

/**
 * Creates a rich 3D multi-panel hinged felt garment that physically folds with 1 finger!
 *
 * Each fold step defines:
 *   - name: string
 *   - applyAngle(angle0to1): updates hinge rotation(s) & layer lifting
 *   - dragDirWorld: THREE.Vector3 (unit direction in XZ plane that completes the fold!)
 *   - dragDist: number (world units for 0->1 full fold drag)
 *   - flapCenterLocal: THREE.Vector3 (center of the lifted flap for tap/hint/hit testing)
 *   - flapHalfSize: { x, z } (generous hitbox on the garment for starting this fold)
 *   - creaseLine: THREE.Object3D (subtle stitched crease dots visible during this step)
 */
export class FoldableGarment {
  constructor(spec) {
    this.spec = spec;
    this.familyDef = FAMILY[spec.familyId];
    this.root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    this.steps = [];
    this.currentStepIdx = 0;
    this.stepProgress = 0; // 0..1 for current step
    this.isFolded = false;

    // Clothespin & pocket surprise extras
    this.clothespin = null;
    this.clothespinDetached = false;
    this.pocketGroup = null;
    this.pocketPopped = false;
    this.pocketTip = null;

    // Squish & spring animation state
    this.squish = 0;
    this.squishVel = 0;
    this.wobbleTiltX = 0;
    this.wobbleTiltZ = 0;

    // Materials for this garment
    this.mainMat = createFeltMaterial(this.familyDef.color, {
      pattern: spec.pattern || 'solid',
      accentHex: this.familyDef.accent,
      seed: 3000 + spec.familyId * 113 + (spec.type.charCodeAt(0) * 19),
    });
    this.trimMat = createFeltMaterial(this.familyDef.colorLight, {
      pattern: 'solid',
      seed: 3100 + spec.familyId * 53,
    });
    this.deepMat = createFeltMaterial(this.familyDef.colorDeep, {
      pattern: 'solid',
      seed: 3200 + spec.familyId * 71,
    });
    this.creamMat = createFeltMaterial('#fff7e8', { seed: 3300 });

    this._buildByType(spec.type);
    this._attachExtras();
    this._updateCreaseVisibility();
  }

  _addCreaseDots(parent, a, b) {
    const line = create3DStitchLine([a, b], {
      color: '#fffbf2',
      spacing: 0.14,
      scale: 0.72,
    });
    parent.add(line);
    return line;
  }

  _buildByType(type) {
    if (type === 'towel') this._buildTowel();
    else if (type === 'pants') this._buildPants();
    else if (type === 'dress') this._buildDress();
    else if (type === 'socks') this._buildSocks();
    else if (type === 'apron') this._buildApron();
    else this._buildShirt();
  }

  // 1. FLUFFY BATH TOWEL (2 big crisp origami folds: Bottom->Top, then Right->Left!)
  _buildTowel() {
    const halfW = 1.02;
    const halfD = 0.68;

    const addTowelDetails = (panel, isLeft, isTop) => {
      // Stitched decorative stripe band near outer short edge
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, T + 0.012, halfD - 0.06),
        this.trimMat
      );
      stripe.position.set(isLeft ? -halfW * 0.34 : halfW * 0.34, 0, 0);
      panel.add(stripe);

      // Cute felt fringe tassels on outer left/right edges!
      const edgeX = isLeft ? -halfW * 0.5 - 0.04 : halfW * 0.5 + 0.04;
      for (let i = -2; i <= 2; i++) {
        const tassel = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.022, 0.08, 3, 5),
          this.creamMat
        );
        tassel.rotation.z = Math.PI / 2;
        tassel.position.set(edgeX, 0, i * 0.12);
        panel.add(tassel);
      }

      // 3D hem stitches along outer top/bottom edge
      const hz = isTop ? -halfD * 0.42 : halfD * 0.42;
      panel.add(
        create3DStitchLine(
          [[-halfW * 0.45, T * 0.55, hz], [halfW * 0.45, T * 0.55, hz]],
          { color: '#fff8ec', spacing: 0.14, scale: 0.85 }
        )
      );
    };

    // Left Half (fixed base)
    const leftHalf = new THREE.Group();
    this.bodyGroup.add(leftHalf);

    const topLeft = new THREE.Mesh(makeRoundedPanelGeo(halfW, halfD, 0.08), this.mainMat);
    topLeft.position.set(-halfW / 2, T * 0.5, -halfD / 2);
    topLeft.castShadow = true;
    topLeft.receiveShadow = true;
    addTowelDetails(topLeft, true, true);
    leftHalf.add(topLeft);

    const bottomLeftPivot = new THREE.Group();
    bottomLeftPivot.position.set(0, T, 0);
    leftHalf.add(bottomLeftPivot);

    const bottomLeft = new THREE.Mesh(makeRoundedPanelGeo(halfW, halfD, 0.08), this.mainMat);
    bottomLeft.position.set(-halfW / 2, -T * 0.5, halfD / 2);
    bottomLeft.castShadow = true;
    bottomLeft.receiveShadow = true;
    addTowelDetails(bottomLeft, true, false);
    bottomLeftPivot.add(bottomLeft);

    // Right Half (hinged at X = 0 for Step 2!)
    const rightHalfPivot = new THREE.Group();
    rightHalfPivot.position.set(0, T, 0);
    this.bodyGroup.add(rightHalfPivot);

    const topRight = new THREE.Mesh(makeRoundedPanelGeo(halfW, halfD, 0.08), this.mainMat);
    topRight.position.set(halfW / 2, -T * 0.5, -halfD / 2);
    topRight.castShadow = true;
    topRight.receiveShadow = true;
    addTowelDetails(topRight, false, true);
    rightHalfPivot.add(topRight);

    const bottomRightPivot = new THREE.Group();
    bottomRightPivot.position.set(0, 0, 0);
    rightHalfPivot.add(bottomRightPivot);

    const bottomRight = new THREE.Mesh(makeRoundedPanelGeo(halfW, halfD, 0.08), this.mainMat);
    bottomRight.position.set(halfW / 2, -T * 0.5, halfD / 2);
    bottomRight.castShadow = true;
    bottomRight.receiveShadow = true;
    addTowelDetails(bottomRight, false, false);
    bottomRightPivot.add(bottomRight);

    const crease1 = this._addCreaseDots(this.bodyGroup, [-halfW + 0.08, T + 0.015, 0], [halfW - 0.08, T + 0.015, 0]);
    const crease2 = this._addCreaseDots(this.bodyGroup, [0, T * 2.15, -halfD + 0.06], [0, T * 2.15, -0.06]);

    // Step 1: Fold bottom half UP onto top half
    this.steps.push({
      name: 'bottom_up',
      dragDirWorld: new THREE.Vector3(0, 0, -1),
      dragDist: 1.15,
      flapCenterLocal: new THREE.Vector3(0, T, halfD * 0.55),
      flapHalfSize: { x: halfW * 1.1, z: halfD * 0.72 },
      creaseLine: crease1,
      applyAngle: (p) => {
        const a = -p * Math.PI;
        bottomLeftPivot.rotation.x = a;
        bottomRightPivot.rotation.x = a;
        bottomLeftPivot.position.y = T + p * 0.012;
        bottomRightPivot.position.y = p * 0.012;
      },
    });

    // Step 2: Fold right half LEFT onto left half (carrying bottomRight cleanly!)
    this.steps.push({
      name: 'right_to_left',
      dragDirWorld: new THREE.Vector3(-1, 0, 0),
      dragDist: 1.25,
      flapCenterLocal: new THREE.Vector3(halfW * 0.52, T * 2, -halfD * 0.5),
      flapHalfSize: { x: halfW * 0.72, z: halfD * 0.75 },
      creaseLine: crease2,
      applyAngle: (p) => {
        rightHalfPivot.rotation.z = p * Math.PI;
        // Lift hinge smoothly so double-folded right half lands cleanly ON TOP of double-folded left half
        rightHalfPivot.position.y = T + p * (T * 1.18);
      },
    });

    // Keep bundle centered neatly on mat when done
    this.foldedCenterOffset = new THREE.Vector3(halfW * 0.5, 0, halfD * 0.5);
    this.pinAnchor = new THREE.Vector3(-0.65, T + 0.05, -halfD + 0.05);
  }

  // 2. COLLARED SHIRT / T-SHIRT (3 crisp folds: Left sleeve in, Right sleeve in, Bottom up!)
  _buildShirt() {
    const coreW = 1.06;
    const topD = 0.76;
    const botD = 0.74;

    // Upper torso (fixed center)
    const upperTorso = new THREE.Mesh(makeRoundedPanelGeo(coreW, topD, 0.09), this.mainMat);
    upperTorso.position.set(0, T * 0.5, -topD / 2);
    upperTorso.castShadow = true;
    upperTorso.receiveShadow = true;
    this.bodyGroup.add(upperTorso);

    // Cute felt shirt collar + wooden buttons down the chest!
    const collarL = new THREE.Mesh(makeRoundedPanelGeo(0.26, 0.16, 0.04, 0.03), this.creamMat);
    collarL.position.set(-0.14, T + 0.015, -topD + 0.09);
    collarL.rotation.y = 0.25;
    this.bodyGroup.add(collarL);
    const collarR = collarL.clone();
    collarR.position.x = 0.14;
    collarR.rotation.y = -0.25;
    this.bodyGroup.add(collarR);

    for (let i = 0; i < 3; i++) {
      const btn = createCraftButton({ radius: 0.068, thickness: 0.03, color: '#e2ab6d', threadColor: this.familyDef.color });
      btn.position.set(0, T + 0.016, -topD + 0.26 + i * 0.21);
      this.bodyGroup.add(btn);
    }

    // Left sleeve + side flap (hinged at x = -coreW/2)
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-coreW / 2, T, 0);
    this.bodyGroup.add(leftPivot);

    const leftSleeve = new THREE.Mesh(makeRoundedPanelGeo(0.68, 0.52, 0.09), this.mainMat);
    leftSleeve.position.set(-0.33, -T * 0.5, -topD * 0.62);
    leftSleeve.rotation.y = 0.14;
    leftSleeve.castShadow = true;
    leftSleeve.receiveShadow = true;
    leftPivot.add(leftSleeve);

    const leftCuff = new THREE.Mesh(makeRoundedPanelGeo(0.12, 0.48, 0.03, T + 0.01), this.trimMat);
    leftCuff.position.set(-0.62, -T * 0.5, -topD * 0.58);
    leftCuff.rotation.y = 0.14;
    leftPivot.add(leftCuff);

    // Left side strip
    const leftSide = new THREE.Mesh(makeRoundedPanelGeo(0.20, 0.85, 0.04), this.mainMat);
    leftSide.position.set(-0.09, -T * 0.5, 0.04);
    leftSide.castShadow = true;
    leftPivot.add(leftSide);

    // Right sleeve + side flap (hinged at x = +coreW/2)
    const rightPivot = new THREE.Group();
    rightPivot.position.set(coreW / 2, T, 0);
    this.bodyGroup.add(rightPivot);

    const rightSleeve = new THREE.Mesh(makeRoundedPanelGeo(0.68, 0.52, 0.09), this.mainMat);
    rightSleeve.position.set(0.33, -T * 0.5, -topD * 0.62);
    rightSleeve.rotation.y = -0.14;
    rightSleeve.castShadow = true;
    rightSleeve.receiveShadow = true;
    rightPivot.add(rightSleeve);

    const rightCuff = new THREE.Mesh(makeRoundedPanelGeo(0.12, 0.48, 0.03, T + 0.01), this.trimMat);
    rightCuff.position.set(0.62, -T * 0.5, -topD * 0.58);
    rightCuff.rotation.y = -0.14;
    rightPivot.add(rightCuff);

    const rightSide = new THREE.Mesh(makeRoundedPanelGeo(0.20, 0.85, 0.04), this.mainMat);
    rightSide.position.set(0.09, -T * 0.5, 0.04);
    rightSide.castShadow = true;
    rightPivot.add(rightSide);

    // Lower torso hem (hinged at z = 0)
    const bottomPivot = new THREE.Group();
    bottomPivot.position.set(0, T, 0);
    this.bodyGroup.add(bottomPivot);

    const lowerTorso = new THREE.Mesh(makeRoundedPanelGeo(coreW, botD, 0.09), this.mainMat);
    lowerTorso.position.set(0, -T * 0.5, botD / 2);
    lowerTorso.castShadow = true;
    lowerTorso.receiveShadow = true;
    bottomPivot.add(lowerTorso);

    lowerTorso.add(
      create3DStitchLine(
        [[-coreW * 0.44, T * 0.55, botD * 0.38], [coreW * 0.44, T * 0.55, botD * 0.38]],
        { color: '#fff8ec', spacing: 0.14, scale: 0.85 }
      )
    );

    const creaseL = this._addCreaseDots(this.bodyGroup, [-coreW / 2, T + 0.016, -topD + 0.08], [-coreW / 2, T + 0.016, botD * 0.6]);
    const creaseR = this._addCreaseDots(this.bodyGroup, [coreW / 2, T + 0.016, -topD + 0.08], [coreW / 2, T + 0.016, botD * 0.6]);
    const creaseB = this._addCreaseDots(this.bodyGroup, [-coreW * 0.46, T * 2.15, 0], [coreW * 0.46, T * 2.15, 0]);

    this.steps.push({
      name: 'left_sleeve',
      dragDirWorld: new THREE.Vector3(1, 0, 0),
      dragDist: 1.0,
      flapCenterLocal: new THREE.Vector3(-coreW * 0.5 - 0.38, T, -0.35),
      flapHalfSize: { x: 0.65, z: 0.8 },
      creaseLine: creaseL,
      applyAngle: (p) => {
        leftPivot.rotation.z = -p * Math.PI;
        leftPivot.position.y = T + p * 0.015;
      },
    });

    this.steps.push({
      name: 'right_sleeve',
      dragDirWorld: new THREE.Vector3(-1, 0, 0),
      dragDist: 1.0,
      flapCenterLocal: new THREE.Vector3(coreW * 0.5 + 0.38, T, -0.35),
      flapHalfSize: { x: 0.65, z: 0.8 },
      creaseLine: creaseR,
      applyAngle: (p) => {
        rightPivot.rotation.z = p * Math.PI;
        rightPivot.position.y = T + p * (T * 0.55);
      },
    });

    this.steps.push({
      name: 'bottom_up',
      dragDirWorld: new THREE.Vector3(0, 0, -1),
      dragDist: 1.15,
      flapCenterLocal: new THREE.Vector3(0, T, botD * 0.55),
      flapHalfSize: { x: coreW * 0.72, z: botD * 0.75 },
      creaseLine: creaseB,
      applyAngle: (p) => {
        bottomPivot.rotation.x = -p * Math.PI;
        bottomPivot.position.y = T + p * (T * 1.45);
      },
    });

    this.foldedCenterOffset = new THREE.Vector3(0, 0, topD * 0.5);
    this.pinAnchor = new THREE.Vector3(-0.32, T + 0.05, -topD + 0.05);
    this.pocketParent = lowerTorso;
    this.pocketLocalPos = new THREE.Vector3(0.24, T * 0.55, 0.05);
  }

  // 3. GIRL'S FLARED FELT DRESS (3 folds: Left flared skirt wing in, Right wing in, Bottom up!)
  _buildDress() {
    const coreW = 0.96;
    const topD = 0.76;
    const botD = 0.82;

    const bodice = new THREE.Mesh(makeRoundedPanelGeo(coreW, topD, 0.1), this.mainMat);
    bodice.position.set(0, T * 0.5, -topD / 2);
    bodice.castShadow = true;
    bodice.receiveShadow = true;
    this.bodyGroup.add(bodice);

    // Cute cream peter-pan collar & waist ribbon!
    const waistRibbon = new THREE.Mesh(new THREE.BoxGeometry(coreW + 0.02, T + 0.016, 0.14), this.trimMat);
    waistRibbon.position.set(0, T * 0.55, -0.08);
    this.bodyGroup.add(waistRibbon);

    // Ribbon bow center
    const bowBtn = createCraftButton({ radius: 0.09, thickness: 0.04, color: this.familyDef.colorDeep, threadColor: '#fff8ec', isWood: false });
    bowBtn.position.set(0, T + 0.025, -0.08);
    this.bodyGroup.add(bowBtn);

    // Short puffed shoulder sleeves
    for (const s of [-1, 1]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), this.mainMat);
      puff.scale.set(1.1, 0.4, 1.0);
      puff.position.set(s * (coreW * 0.52), T * 0.5, -topD + 0.18);
      this.bodyGroup.add(puff);
    }

    // Left flared skirt wing
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-coreW / 2, T, 0);
    this.bodyGroup.add(leftPivot);

    const wingShapeL = new THREE.Shape();
    wingShapeL.moveTo(0, -0.15);
    wingShapeL.lineTo(-0.56, botD);
    wingShapeL.lineTo(0, botD);
    wingShapeL.closePath();
    const wingGeoL = new THREE.ExtrudeGeometry(wingShapeL, { depth: T, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    wingGeoL.rotateX(Math.PI / 2);
    const leftWing = new THREE.Mesh(wingGeoL, this.mainMat);
    leftWing.position.set(0, 0, 0);
    leftWing.castShadow = true;
    leftPivot.add(leftWing);

    // Right flared skirt wing
    const rightPivot = new THREE.Group();
    rightPivot.position.set(coreW / 2, T, 0);
    this.bodyGroup.add(rightPivot);

    const wingShapeR = new THREE.Shape();
    wingShapeR.moveTo(0, -0.15);
    wingShapeR.lineTo(0, botD);
    wingShapeR.lineTo(0.56, botD);
    wingShapeR.closePath();
    const wingGeoR = new THREE.ExtrudeGeometry(wingShapeR, { depth: T, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    wingGeoR.rotateX(Math.PI / 2);
    const rightWing = new THREE.Mesh(wingGeoR, this.mainMat);
    rightWing.position.set(0, 0, 0);
    rightWing.castShadow = true;
    rightPivot.add(rightWing);

    // Center skirt bottom panel
    const bottomPivot = new THREE.Group();
    bottomPivot.position.set(0, T, 0);
    this.bodyGroup.add(bottomPivot);

    const skirtCenter = new THREE.Mesh(makeRoundedPanelGeo(coreW, botD, 0.08), this.mainMat);
    skirtCenter.position.set(0, -T * 0.5, botD / 2);
    skirtCenter.castShadow = true;
    skirtCenter.receiveShadow = true;
    bottomPivot.add(skirtCenter);

    // Cute scalloped lace trim along skirt hem!
    for (let i = -3; i <= 3; i++) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, T * 0.7, 10), this.creamMat);
      sc.position.set(i * 0.135, -T * 0.5, botD + 0.02);
      bottomPivot.add(sc);
    }

    const creaseL = this._addCreaseDots(this.bodyGroup, [-coreW / 2, T + 0.016, -0.05], [-coreW / 2, T + 0.016, botD - 0.06]);
    const creaseR = this._addCreaseDots(this.bodyGroup, [coreW / 2, T + 0.016, -0.05], [coreW / 2, T + 0.016, botD - 0.06]);
    const creaseB = this._addCreaseDots(this.bodyGroup, [-coreW * 0.45, T * 2.15, 0], [coreW * 0.45, T * 2.15, 0]);

    this.steps.push({
      name: 'left_wing',
      dragDirWorld: new THREE.Vector3(1, 0, 0),
      dragDist: 0.95,
      flapCenterLocal: new THREE.Vector3(-coreW * 0.5 - 0.28, T, botD * 0.55),
      flapHalfSize: { x: 0.58, z: 0.72 },
      creaseLine: creaseL,
      applyAngle: (p) => {
        leftPivot.rotation.z = -p * Math.PI;
        leftPivot.position.y = T + p * 0.015;
      },
    });

    this.steps.push({
      name: 'right_wing',
      dragDirWorld: new THREE.Vector3(-1, 0, 0),
      dragDist: 0.95,
      flapCenterLocal: new THREE.Vector3(coreW * 0.5 + 0.28, T, botD * 0.55),
      flapHalfSize: { x: 0.58, z: 0.72 },
      creaseLine: creaseR,
      applyAngle: (p) => {
        rightPivot.rotation.z = p * Math.PI;
        rightPivot.position.y = T + p * (T * 0.45);
      },
    });

    this.steps.push({
      name: 'skirt_up',
      dragDirWorld: new THREE.Vector3(0, 0, -1),
      dragDist: 1.15,
      flapCenterLocal: new THREE.Vector3(0, T, botD * 0.55),
      flapHalfSize: { x: coreW * 0.72, z: botD * 0.72 },
      creaseLine: creaseB,
      applyAngle: (p) => {
        bottomPivot.rotation.x = -p * Math.PI;
        bottomPivot.position.y = T + p * (T * 1.45);
      },
    });

    this.foldedCenterOffset = new THREE.Vector3(0, 0, topD * 0.5);
    this.pinAnchor = new THREE.Vector3(0.28, T + 0.05, -topD + 0.05);
    this.pocketParent = skirtCenter;
    this.pocketLocalPos = new THREE.Vector3(-0.22, T * 0.55, 0.02);
  }

  // 4. COZY STITCHED PANTS (2 clean folds: Left leg onto Right leg, then Cuffs UP to waist!)
  _buildPants() {
    const legW = 0.58;
    const topD = 0.76;
    const botD = 0.76;

    // Right half (fixed base)
    const rightHalf = new THREE.Group();
    this.bodyGroup.add(rightHalf);

    const rightUpper = new THREE.Mesh(makeRoundedPanelGeo(legW, topD, 0.07), this.mainMat);
    rightUpper.position.set(legW / 2, T * 0.5, -topD / 2);
    rightUpper.castShadow = true;
    rightUpper.receiveShadow = true;
    rightHalf.add(rightUpper);

    // Waistband trim + button
    const waistR = new THREE.Mesh(new THREE.BoxGeometry(legW, T + 0.012, 0.14), this.deepMat);
    waistR.position.set(legW / 2, T * 0.52, -topD + 0.07);
    rightHalf.add(waistR);

    const waistBtn = createCraftButton({ radius: 0.07, thickness: 0.032, color: '#dfa468', threadColor: '#fff8ec' });
    waistBtn.position.set(0.08, T + 0.02, -topD + 0.08);
    rightHalf.add(waistBtn);

    const rightCuffPivot = new THREE.Group();
    rightCuffPivot.position.set(0, T, 0);
    rightHalf.add(rightCuffPivot);

    const rightLower = new THREE.Mesh(makeRoundedPanelGeo(legW * 0.88, botD, 0.07), this.mainMat);
    rightLower.position.set(legW * 0.52, -T * 0.5, botD / 2);
    rightLower.castShadow = true;
    rightLower.receiveShadow = true;
    rightCuffPivot.add(rightLower);

    const cuffTrimR = new THREE.Mesh(new THREE.BoxGeometry(legW * 0.88, T + 0.012, 0.13), this.trimMat);
    cuffTrimR.position.set(legW * 0.52, -T * 0.5, botD - 0.07);
    rightCuffPivot.add(cuffTrimR);

    // Left half (hinged at X = 0 to fold RIGHT onto Right half!)
    const leftPivot = new THREE.Group();
    leftPivot.position.set(0, T, 0);
    this.bodyGroup.add(leftPivot);

    const leftUpper = new THREE.Mesh(makeRoundedPanelGeo(legW, topD, 0.07), this.mainMat);
    leftUpper.position.set(-legW / 2, -T * 0.5, -topD / 2);
    leftUpper.castShadow = true;
    leftUpper.receiveShadow = true;
    leftPivot.add(leftUpper);

    const waistL = new THREE.Mesh(new THREE.BoxGeometry(legW, T + 0.012, 0.14), this.deepMat);
    waistL.position.set(-legW / 2, -T * 0.48, -topD + 0.07);
    leftPivot.add(waistL);

    const leftCuffPivot = new THREE.Group();
    leftCuffPivot.position.set(0, 0, 0);
    leftPivot.add(leftCuffPivot);

    const leftLower = new THREE.Mesh(makeRoundedPanelGeo(legW * 0.88, botD, 0.07), this.mainMat);
    leftLower.position.set(-legW * 0.52, -T * 0.5, botD / 2);
    leftLower.castShadow = true;
    leftLower.receiveShadow = true;
    leftCuffPivot.add(leftLower);

    const cuffTrimL = new THREE.Mesh(new THREE.BoxGeometry(legW * 0.88, T + 0.012, 0.13), this.trimMat);
    cuffTrimL.position.set(-legW * 0.52, -T * 0.5, botD - 0.07);
    leftCuffPivot.add(cuffTrimL);

    const creaseCenter = this._addCreaseDots(this.bodyGroup, [0, T + 0.016, -topD + 0.08], [0, T + 0.016, botD - 0.08]);
    const creaseKnee = this._addCreaseDots(this.bodyGroup, [0.05, T * 2.18, 0], [legW - 0.05, T * 2.18, 0]);

    this.steps.push({
      name: 'left_leg_over',
      dragDirWorld: new THREE.Vector3(1, 0, 0),
      dragDist: 1.0,
      flapCenterLocal: new THREE.Vector3(-legW * 0.55, T, 0.0),
      flapHalfSize: { x: legW * 0.85, z: 0.9 },
      creaseLine: creaseCenter,
      applyAngle: (p) => {
        leftPivot.rotation.z = -p * Math.PI;
        leftPivot.position.y = T + p * 0.014;
      },
    });

    this.steps.push({
      name: 'cuffs_up',
      dragDirWorld: new THREE.Vector3(0, 0, -1),
      dragDist: 1.1,
      flapCenterLocal: new THREE.Vector3(legW * 0.5, T * 2, botD * 0.55),
      flapHalfSize: { x: legW * 0.9, z: botD * 0.78 },
      creaseLine: creaseKnee,
      applyAngle: (p) => {
        rightCuffPivot.rotation.x = -p * Math.PI;
        rightCuffPivot.position.y = T + p * (T * 1.15);
        // Because leftPivot is rotated by -PI around Z, +p*PI folds leftCuff UP in world space!
        leftCuffPivot.rotation.x = p * Math.PI;
        leftCuffPivot.position.y = -p * (T * 1.15);
      },
    });

    this.foldedCenterOffset = new THREE.Vector3(-legW * 0.5, 0, topD * 0.5);
    this.pinAnchor = new THREE.Vector3(legW * 0.5, T + 0.05, -topD + 0.05);
    this.pocketParent = rightUpper;
    this.pocketLocalPos = new THREE.Vector3(0.05, T * 0.55, -0.05);
  }

  // 5. PAIR OF STRIPED FELT SOCKS (Pair left sock onto right sock, then fold toe up!)
  _buildSocks() {
    const sockW = 0.44;
    const topD = 0.64;
    const botD = 0.62;

    const addSockDetails = (upper, lower, sideSign) => {
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(sockW + 0.01, T + 0.014, 0.16), this.trimMat);
      cuff.position.set(0, 0, -topD * 0.36);
      upper.add(cuff);
      const toe = new THREE.Mesh(makeRoundedPanelGeo(sockW * 0.92, 0.24, 0.11, T + 0.01), this.deepMat);
      toe.position.set(sideSign * 0.08, 0, botD * 0.32);
      lower.add(toe);
      const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, T + 0.01, 12), this.trimMat);
      heel.position.set(-sideSign * 0.14, 0, -botD * 0.22);
      lower.add(heel);
    };

    const gap = 0.08;
    const rightHalf = new THREE.Group();
    this.bodyGroup.add(rightHalf);

    const rUpper = new THREE.Mesh(makeRoundedPanelGeo(sockW, topD, 0.11), this.mainMat);
    rUpper.position.set(gap + sockW / 2, T * 0.5, -topD / 2);
    rUpper.castShadow = true;
    rightHalf.add(rUpper);

    const rToePivot = new THREE.Group();
    rToePivot.position.set(0, T, 0);
    rightHalf.add(rToePivot);

    const rLower = new THREE.Mesh(makeRoundedPanelGeo(sockW, botD, 0.12), this.mainMat);
    rLower.position.set(gap + sockW / 2, -T * 0.5, botD / 2);
    rLower.castShadow = true;
    rToePivot.add(rLower);
    addSockDetails(rUpper, rLower, 1);

    const leftPivot = new THREE.Group();
    leftPivot.position.set(0, T, 0);
    this.bodyGroup.add(leftPivot);

    const lUpper = new THREE.Mesh(makeRoundedPanelGeo(sockW, topD, 0.11), this.mainMat);
    lUpper.position.set(-(gap + sockW / 2), -T * 0.5, -topD / 2);
    lUpper.castShadow = true;
    leftPivot.add(lUpper);

    const lToePivot = new THREE.Group();
    lToePivot.position.set(0, 0, 0);
    leftPivot.add(lToePivot);

    const lLower = new THREE.Mesh(makeRoundedPanelGeo(sockW, botD, 0.12), this.mainMat);
    lLower.position.set(-(gap + sockW / 2), -T * 0.5, botD / 2);
    lLower.castShadow = true;
    lToePivot.add(lLower);
    addSockDetails(lUpper, lLower, -1);

    const crease1 = this._addCreaseDots(this.bodyGroup, [0, T + 0.016, -topD * 0.7], [0, T + 0.016, botD * 0.7]);
    const crease2 = this._addCreaseDots(this.bodyGroup, [gap, T * 2.15, 0], [gap + sockW, T * 2.15, 0]);

    this.steps.push({
      name: 'pair_socks',
      dragDirWorld: new THREE.Vector3(1, 0, 0),
      dragDist: 0.9,
      flapCenterLocal: new THREE.Vector3(-(gap + sockW * 0.5), T, 0),
      flapHalfSize: { x: 0.55, z: 0.78 },
      creaseLine: crease1,
      applyAngle: (p) => {
        leftPivot.rotation.z = -p * Math.PI;
        leftPivot.position.y = T + p * 0.014;
      },
    });

    this.steps.push({
      name: 'fold_toes',
      dragDirWorld: new THREE.Vector3(0, 0, -1),
      dragDist: 1.0,
      flapCenterLocal: new THREE.Vector3(gap + sockW * 0.5, T * 2, botD * 0.55),
      flapHalfSize: { x: 0.58, z: 0.65 },
      creaseLine: crease2,
      applyAngle: (p) => {
        rToePivot.rotation.x = -p * Math.PI;
        rToePivot.position.y = T + p * (T * 1.15);
        lToePivot.rotation.x = p * Math.PI;
        lToePivot.position.y = -p * (T * 1.15);
      },
    });

    this.foldedCenterOffset = new THREE.Vector3(-(gap + sockW * 0.5), 0, topD * 0.5);
    this.pinAnchor = new THREE.Vector3(gap + sockW * 0.5, T + 0.05, -topD + 0.05);
  }

  // 6. POCKET APRON (3 crisp folds: Left tie-side in, Right tie-side in, Bottom up!)
  _buildApron() {
    this._buildShirt();
    // Add big cute contrast front heart patch on apron chest!
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.14);
    heartShape.bezierCurveTo(0.22, 0.0, 0.22, 0.2, 0.09, 0.2);
    heartShape.bezierCurveTo(0.02, 0.2, 0, 0.13, 0, 0.1);
    heartShape.bezierCurveTo(0, 0.13, -0.02, 0.2, -0.09, 0.2);
    heartShape.bezierCurveTo(-0.22, 0.2, -0.22, 0.0, 0, -0.14);
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.024, bevelEnabled: false });
    heartGeo.rotateX(-Math.PI / 2);
    const heart = new THREE.Mesh(heartGeo, this.creamMat);
    heart.position.set(0, T + 0.015, -0.34);
    this.bodyGroup.add(heart);
  }

  _attachExtras() {
    if (this.spec.hasPin && this.pinAnchor) {
      this.clothespin = createClothespinMesh();
      this.clothespin.position.copy(this.pinAnchor);
      this.clothespin.rotation.y = 0.22;
      this.bodyGroup.add(this.clothespin);
    }

    if (this.spec.hasPocket && this.pocketParent && this.pocketLocalPos) {
      this.pocketGroup = new THREE.Group();
      this.pocketGroup.position.copy(this.pocketLocalPos);

      // Cute slightly bulging stitched felt pocket!
      const pocketMesh = new THREE.Mesh(
        makeRoundedPanelGeo(0.32, 0.30, 0.06, 0.045),
        this.trimMat
      );
      pocketMesh.position.y = 0.022;
      this.pocketGroup.add(pocketMesh);

      this.pocketGroup.add(
        create3DStitchLine(
          [[-0.13, 0.052, -0.10], [-0.13, 0.052, 0.11], [0.13, 0.052, 0.11], [0.13, 0.052, -0.10]],
          { color: '#fff8ec', spacing: 0.09, scale: 0.65 }
        )
      );

      // Little colorful tip peeking playfully out of the pocket!
      this.pocketTip = createTreasureMesh(this.spec.treasure || 'strawberry');
      this.pocketTip.scale.setScalar(0.68);
      this.pocketTip.position.set(0, 0.02, -0.13);
      this.pocketTip.rotation.x = -0.7;
      this.pocketGroup.add(this.pocketTip);

      // Touch collider for poking the bulging pocket directly!
      const col = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      col.userData = { kind: 'pocket' };
      this.pocketGroup.add(col);

      this.pocketParent.add(this.pocketGroup);
    }
  }

  getActiveStep() {
    if (this.isFolded) return null;
    return this.steps[this.currentStepIdx] || null;
  }

  _updateCreaseVisibility() {
    this.steps.forEach((st, idx) => {
      if (st.creaseLine) {
        st.creaseLine.visible = !this.isFolded && idx === this.currentStepIdx;
      }
    });
  }

  setStepProgress(p) {
    const st = this.getActiveStep();
    if (!st) return;
    this.stepProgress = THREE.MathUtils.clamp(p, 0, 1);
    st.applyAngle(this.stepProgress);
  }

  completeCurrentStep() {
    const st = this.getActiveStep();
    if (!st) return false;
    st.applyAngle(1);
    this.stepProgress = 0;
    this.currentStepIdx += 1;
    this.squishVel = 4.0;

    if (this.currentStepIdx >= this.steps.length) {
      this.isFolded = true;
    }
    this._updateCreaseVisibility();
    return this.isFolded;
  }

  detachClothespin() {
    if (!this.clothespin || this.clothespinDetached) return null;
    this.clothespinDetached = true;
    const worldPos = new THREE.Vector3();
    this.clothespin.getWorldPosition(worldPos);
    this.bodyGroup.remove(this.clothespin);
    const pin = this.clothespin;
    this.clothespin = null;
    return { mesh: pin, worldPos };
  }

  popPocketTreasure() {
    if (!this.pocketGroup || this.pocketPopped) return null;
    this.pocketPopped = true;
    const worldPos = new THREE.Vector3();
    if (this.pocketTip) {
      this.pocketTip.getWorldPosition(worldPos);
      this.pocketGroup.remove(this.pocketTip);
      this.pocketTip = null;
    } else {
      this.pocketGroup.getWorldPosition(worldPos);
    }
    const treasure = createTreasureMesh(this.spec.treasure || 'strawberry');
    return { mesh: treasure, worldPos };
  }

  patSquish() {
    this.squishVel = 4.6;
  }

  update(dt, elapsed, isDraggingFlap = false) {
    // Plush squish spring
    this.squishVel += (-42 * this.squish - 7.5 * this.squishVel) * dt;
    this.squish += this.squishVel * dt;
    const sy = Math.max(0.72, 1 - this.squish * 0.08);
    const sxz = 1 / Math.sqrt(sy);
    this.bodyGroup.scale.set(sxz, sy, sxz);

    // Gentle breeze curl on the active flap — clear physical affordance (no arrows!)
    if (!this.isFolded && !isDraggingFlap) {
      const st = this.getActiveStep();
      if (st) {
        const curl = 0.145 + Math.sin(elapsed * 3.2) * 0.045;
        st.applyAngle(curl);
      }
    }

    // Subtle pocket peek wiggle if treasure is still hidden inside!
    if (this.pocketTip && !this.pocketPopped) {
      this.pocketTip.rotation.z = Math.sin(elapsed * 4.5) * 0.14;
    }

    // Smoothly center folded bundle so it sits cleanly under the player's finger when picked up
    if (this.isFolded && this.foldedCenterOffset) {
      this.bodyGroup.position.lerp(this.foldedCenterOffset, Math.min(1, dt * 8));
    }
  }
}

/**
 * Compact neat folded bundle mesh (for stacking into tall color mountains & inside drawers!)
 */
export function createStackedBundleMesh(spec) {
  const familyDef = FAMILY[spec.familyId];
  const g = new THREE.Group();

  const mainMat = createFeltMaterial(familyDef.color, {
    pattern: spec.pattern || 'solid',
    accentHex: familyDef.accent,
    seed: 3000 + spec.familyId * 113 + (spec.type.charCodeAt(0) * 19),
  });
  const trimMat = createFeltMaterial(familyDef.colorLight, { seed: 3100 + spec.familyId * 53 });

  const w = 1.05;
  const d = 0.78;
  const layerH = 0.072;

  // 3 plush stacked felt layers so you can SEE the folded cloth edges from the side!
  for (let i = 0; i < 3; i++) {
    const layer = new THREE.Mesh(
      makeRoundedPanelGeo(w - i * 0.02, d - i * 0.02, 0.1, layerH),
      i === 1 && spec.type === 'towel' ? trimMat : mainMat
    );
    layer.position.y = layerH * 0.5 + i * (layerH * 0.96);
    layer.castShadow = true;
    layer.receiveShadow = true;
    g.add(layer);
  }

  const topY = layerH * 3.0;
  // Visible stitched detail on top face of the neat folded bundle!
  g.add(
    create3DStitchLine(
      [
        [-w * 0.39, topY + 0.008, -d * 0.36],
        [w * 0.39, topY + 0.008, -d * 0.36],
        [w * 0.39, topY + 0.008, d * 0.36],
        [-w * 0.39, topY + 0.008, d * 0.36],
      ],
      { color: '#fff8ec', spacing: 0.14, closed: true, scale: 0.8 }
    )
  );

  // Little signature button or ribbon on top so every garment type stays recognizable!
  if (spec.type === 'shirt' || spec.type === 'pants') {
    const btn = createCraftButton({ radius: 0.075, thickness: 0.03, color: '#dfa468', threadColor: familyDef.color });
    btn.position.set(0, topY + 0.015, 0);
    g.add(btn);
  } else if (spec.type === 'dress' || spec.type === 'apron') {
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.024, 0.13), trimMat);
    ribbon.position.set(0, topY + 0.012, 0);
    g.add(ribbon);
  } else if (spec.type === 'towel') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, d * 0.94), trimMat);
    band.position.set(0.24, topY + 0.012, 0);
    g.add(band);
  }

  g.userData = {
    familyId: spec.familyId,
    spec,
    height: layerH * 3.05,
  };
  return g;
}
