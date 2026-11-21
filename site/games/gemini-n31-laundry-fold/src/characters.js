import * as THREE from '../vendor/three.module.min.js';
import {
  createFeltMaterial,
  createWoodMaterial,
  create3DStitchLine,
  createCraftButton,
  getStitchMaterial,
} from './textures.js';
import { FAMILY, LAYOUT } from './config.js';

function createArcCurveMesh(radius, arcAngle, tube, mat) {
  const pts = [];
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const a = -arcAngle * 0.5 + (i / segs) * arcAngle;
    pts.push(new THREE.Vector3(Math.sin(a) * radius, -Math.cos(a) * radius + radius, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 12, tube, 6, false), mat);
}

/**
 * A big, tactile handmade felt plush family doll perched behind their drawer!
 */
export class FeltFamilyDoll {
  constructor(familyDef) {
    this.def = familyDef;
    this.root = new THREE.Group();
    this.root.position.set(familyDef.matX, LAYOUT.dollBaseY, LAYOUT.dollZ);

    this.mood = 'idle'; // idle | eager | happy | surprised | beaming
    this.moodTimer = 0;
    this.bounceVel = 0;
    this.bounceY = 0;
    this.wobbleZ = 0;
    this.wobbleVel = 0;
    this.lookTarget = new THREE.Vector3(0, 0.2, 1.7);
    this.dressedLevel = 0;

    this._buildDoll();
  }

  _buildDoll() {
    const def = this.def;
    const skinMat = createFeltMaterial(def.skin, { seed: 100 + def.id * 31, bumpScale: 0.025 });
    const clothMat = createFeltMaterial(def.color, {
      pattern: def.id === 2 ? 'gingham' : 'solid',
      accentHex: def.accent,
      seed: 200 + def.id * 37,
    });
    const sleeveMat = createFeltMaterial(def.color, {
      pattern: def.id === 1 ? 'polka' : def.id === 2 ? 'gingham' : 'solid',
      accentHex: def.accent,
      seed: 240 + def.id * 37,
    });
    const hairMat = createFeltMaterial(def.hair, { pattern: 'knit', accentHex: '#8d5b3e', seed: 300 + def.id * 41 });
    const cheekMat = createFeltMaterial(def.cheek, { seed: 400 + def.id });
    const whiteStitchMat = getStitchMaterial('#fff8ec');
    const threadDarkMat = getStitchMaterial('#4d3324');
    const buttonEyeMat = new THREE.MeshStandardMaterial({ color: '#3b261b', roughness: 0.32, metalness: 0.05 });

    // Torso / plush shoulders
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    const bodyScale = def.id === 0 ? 0.88 : def.id === 1 ? 0.96 : 1.04;
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.46 * bodyScale, 0.36 * bodyScale, 8, 16),
      clothMat
    );
    torso.position.set(0, 0.32 * bodyScale, 0);
    torso.scale.set(1.12, 1.0, 0.78);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyPivot.add(torso);

    // Cream felt collar on torso
    const collarMat = createFeltMaterial(def.accent, { seed: 505 + def.id });
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.32 * bodyScale, 0.068, 8, 20),
      collarMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.62 * bodyScale, 0.06);
    this.bodyPivot.add(collar);

    // Front wooden craft button on shirt
    const shirtBtn = createCraftButton({ radius: 0.09, color: '#d89b62', threadColor: def.color });
    shirtBtn.rotation.x = Math.PI / 2;
    shirtBtn.position.set(0, 0.40 * bodyScale, 0.37 * bodyScale);
    this.bodyPivot.add(shirtBtn);

    // Visible front vertical stitch line on plush body
    const bodyStitch = create3DStitchLine(
      [
        [-0.36 * bodyScale, 0.14, 0.25],
        [-0.38 * bodyScale, 0.50 * bodyScale, 0.24],
      ],
      { color: '#fff8ec', spacing: 0.11, scale: 0.85 }
    );
    this.bodyPivot.add(bodyStitch);
    const bodyStitchR = create3DStitchLine(
      [
        [0.36 * bodyScale, 0.14, 0.25],
        [0.38 * bodyScale, 0.50 * bodyScale, 0.24],
      ],
      { color: '#fff8ec', spacing: 0.11, scale: 0.85 }
    );
    this.bodyPivot.add(bodyStitchR);

    // Plush felt arms / mitten hands resting forward so they wave & clap visibly!
    const buildArm = (side) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.48 * bodyScale, 0.44 * bodyScale, 0.14);

      const sleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14 * bodyScale, 0.26 * bodyScale, 6, 12),
        sleeveMat
      );
      sleeve.position.set(side * 0.08, -0.04, 0.16);
      sleeve.rotation.x = Math.PI * 0.36;
      sleeve.rotation.z = -side * 0.28;
      sleeve.castShadow = true;
      armPivot.add(sleeve);

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.155 * bodyScale, 14, 12),
        skinMat
      );
      hand.position.set(side * 0.15, -0.10, 0.36);
      hand.scale.set(1.0, 0.88, 1.05);
      hand.castShadow = true;
      armPivot.add(hand);

      return armPivot;
    };

    this.leftArm = buildArm(-1);
    this.rightArm = buildArm(1);
    this.bodyPivot.add(this.leftArm, this.rightArm);

    // HEAD PIVOT (big, expressive!)
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.08 * bodyScale + 0.04, 0.05);
    this.bodyPivot.add(this.headPivot);

    const headR = def.id === 0 ? 0.54 : def.id === 1 ? 0.56 : 0.59;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(headR, 24, 18),
      skinMat
    );
    head.scale.set(1.06, 0.96, 0.92);
    head.castShadow = true;
    head.receiveShadow = true;
    this.headPivot.add(head);

    // Visible blanket-stitch seam along lower jaw & cheeks (cleanly stops at hairline!)
    const seamPts = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 1.08 + (i / 12) * Math.PI * 0.84;
      seamPts.push([
        Math.cos(a) * headR * 1.05,
        Math.sin(a) * headR * 0.95,
        0.04,
      ]);
    }
    this.headPivot.add(create3DStitchLine(seamPts, { color: '#e6c5a3', spacing: 0.15, scale: 0.78 }));

    // Plush felt ears
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat);
      ear.position.set(side * headR * 1.03, -0.02, 0.02);
      ear.scale.set(0.65, 1.0, 0.75);
      this.headPivot.add(ear);
    }

    // --- DISTINCT HAIR & CRAFT HEADWEAR FOR EACH FAMILY MEMBER ---
    if (def.id === 0) {
      // GIRL: Cute felt hair cap tilted back so full face shines + scalloped bangs + twin yarn puffs & yellow bows!
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.05, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
        hairMat
      );
      cap.position.set(0, 0.06, -0.05);
      cap.rotation.x = -0.34;
      cap.scale.set(1.06, 0.96, 0.98);
      cap.castShadow = true;
      this.headPivot.add(cap);

      // High cute scalloped front bangs above eyes!
      for (let i = -2; i <= 2; i++) {
        const bang = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), hairMat);
        bang.position.set(i * 0.145, headR * 0.56 - Math.abs(i) * 0.03, headR * 0.68 - Math.abs(i) * 0.07);
        bang.scale.set(1.1, 0.85, 0.65);
        this.headPivot.add(bang);
      }

      // Twin yarn puffs + yellow felt bows
      const bowMat = createFeltMaterial(def.color, { seed: 701 });
      for (const side of [-1, 1]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), hairMat);
        puff.position.set(side * (headR * 1.12), 0.22, -0.08);
        puff.castShadow = true;
        this.headPivot.add(puff);

        const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), bowMat);
        bowL.scale.set(1.25, 0.75, 0.55);
        bowL.position.set(side * (headR * 0.94), 0.38, 0.06);
        bowL.rotation.z = side * 0.4;
        this.headPivot.add(bowL);
      }
    } else if (def.id === 1) {
      // MOM: Cozy stitched bob hair tilted cleanly behind face + side curls + rose polka headband!
      const bob = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.06, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.54),
        hairMat
      );
      bob.position.set(0, 0.05, -0.08);
      bob.rotation.x = -0.42;
      bob.scale.set(1.1, 1.0, 1.0);
      bob.castShadow = true;
      this.headPivot.add(bob);

      // Side hair curls framing cheeks cleanly on the outer sides
      for (const side of [-1, 1]) {
        const curl = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.26, 6, 10), hairMat);
        curl.position.set(side * (headR * 0.98), -0.08, -0.06);
        curl.rotation.z = side * 0.14;
        this.headPivot.add(curl);
      }

      // High gentle side-part bangs well above button eyes
      for (let i = -2; i <= 2; i++) {
        const bang = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), hairMat);
        bang.position.set(i * 0.155, headR * 0.58 - Math.abs(i) * 0.035, headR * 0.64 - Math.abs(i) * 0.07);
        bang.scale.set(1.18, 0.8, 0.58);
        this.headPivot.add(bang);
      }

      // Rose headband + bow knot perched on top!
      const bandMat = createFeltMaterial(def.color, { pattern: 'polka', accentHex: '#fff5f0', seed: 702 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.98, 0.075, 8, 24, Math.PI * 1.12), bandMat);
      band.position.set(0, 0.16, 0.06);
      band.rotation.z = -Math.PI * 0.06;
      band.rotation.x = -0.45;
      this.headPivot.add(band);

      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), bandMat);
      knot.position.set(0.24, headR * 0.96, 0.18);
      knot.scale.set(1.3, 0.8, 0.8);
      this.headPivot.add(knot);
    } else {
      // DAD: Warm tufted felt hair behind + friendly stitched denim newsboy cap + cute embroidered mustache!
      const backHair = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.03, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.50),
        hairMat
      );
      backHair.position.set(0, 0.05, -0.08);
      backHair.rotation.x = -0.38;
      backHair.scale.set(1.06, 0.95, 0.95);
      this.headPivot.add(backHair);

      // Denim stitched craft cap perched cleanly on top of forehead!
      const capMat = createFeltMaterial(def.color, { pattern: 'solid', seed: 703 });
      const capDome = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.07, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.44),
        capMat
      );
      capDome.position.set(0, 0.19, -0.02);
      capDome.rotation.x = -0.18;
      capDome.scale.set(1.08, 0.84, 1.02);
      capDome.castShadow = true;
      this.headPivot.add(capDome);

      const capBrim = new THREE.Mesh(
        new THREE.CylinderGeometry(headR * 0.72, headR * 0.82, 0.07, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
        createFeltMaterial(def.colorDeep, { seed: 704 })
      );
      capBrim.position.set(0, 0.40, headR * 0.44);
      capBrim.rotation.x = 0.08;
      this.headPivot.add(capBrim);

      // Little wooden button on top of cap
      const capBtn = createCraftButton({ radius: 0.07, color: '#d89b62', threadColor: '#fff8ec' });
      capBtn.position.set(0, headR * 1.02, -0.04);
      this.headPivot.add(capBtn);

      // Cute plush stitched mustache!
      this.mustache = new THREE.Group();
      this.mustache.position.set(0, -0.14, headR * 0.93);
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.14, 6, 8), hairMat);
        m.rotation.z = Math.PI / 2 - side * 0.25;
        m.position.set(side * 0.105, 0, 0);
        this.mustache.add(m);
      }
      this.headPivot.add(this.mustache);
    }

    // --- FACE FEATURES (BIG, READABLE EXPRESSIONS!) ---
    const eyeY = 0.05;
    const eyeX = 0.21;
    const eyeZ = headR * 0.89;

    // Normal glossy button eyes (with stitched white highlight dot!)
    this.openEyesGroup = new THREE.Group();
    this.headPivot.add(this.openEyesGroup);

    this.eyeMeshes = [];
    for (const side of [-1, 1]) {
      const eyeHolder = new THREE.Group();
      eyeHolder.position.set(side * eyeX, eyeY, eyeZ);

      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.042, 16), buttonEyeMat);
      btn.rotation.x = Math.PI / 2;
      eyeHolder.add(btn);

      // Stitched white cross-gleam inside button eye
      const gleam = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), whiteStitchMat);
      gleam.position.set(-0.025, 0.025, 0.026);
      eyeHolder.add(gleam);

      // Cute stitched eyelashes for Mom & Girl
      if (def.id !== 2) {
        const lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.05, 3, 5), threadDarkMat);
        lash.position.set(side * 0.075, 0.055, 0.01);
        lash.rotation.z = -side * 0.6;
        eyeHolder.add(lash);
      }

      this.openEyesGroup.add(eyeHolder);
      this.eyeMeshes.push(eyeHolder);
    }

    // Happy beaming `^ ^` embroidered eyes (shown on celebration / beaming!)
    this.happyEyesGroup = new THREE.Group();
    this.happyEyesGroup.visible = false;
    this.headPivot.add(this.happyEyesGroup);
    for (const side of [-1, 1]) {
      const arc = createArcCurveMesh(0.095, Math.PI * 0.9, 0.024, threadDarkMat);
      arc.rotation.z = Math.PI;
      arc.position.set(side * eyeX, eyeY + 0.06, eyeZ + 0.01);
      this.happyEyesGroup.add(arc);
    }

    // Rosy stitched felt cheeks!
    this.cheeks = [];
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.026, 14), cheekMat);
      cheek.rotation.x = Math.PI / 2;
      cheek.position.set(side * 0.34, -0.09, headR * 0.78);
      cheek.rotation.y = side * 0.38;
      this.headPivot.add(cheek);
      this.cheeks.push(cheek);
    }

    // Embroidered mouths (swap visibility cleanly by mood!)
    const mouthY = def.id === 2 ? -0.23 : -0.18;
    const mouthZ = headR * 0.89;

    this.mouthSmile = createArcCurveMesh(0.12, Math.PI * 0.85, 0.022, threadDarkMat);
    this.mouthSmile.position.set(0, mouthY, mouthZ);
    this.headPivot.add(this.mouthSmile);

    // Big joyful open laugh mouth
    this.mouthHappy = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 14, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#c4525a', roughness: 0.9, side: THREE.DoubleSide })
    );
    this.mouthHappy.position.set(0, mouthY + 0.05, mouthZ + 0.01);
    this.mouthHappy.visible = false;
    this.headPivot.add(this.mouthHappy);

    // Surprised cute `o` mouth (for mismatch giggle!)
    this.mouthSurprised = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.02, 8, 16),
      threadDarkMat
    );
    this.mouthSurprised.position.set(0, mouthY + 0.01, mouthZ + 0.01);
    this.mouthSurprised.visible = false;
    this.headPivot.add(this.mouthSurprised);

    // --- WEARABLE REWARD ACCESSORY (pops onto doll when their drawer is filled!) ---
    this.rewardOutfit = new THREE.Group();
    this.rewardOutfit.visible = false;
    this.rewardOutfit.scale.setScalar(0.001);
    this.bodyPivot.add(this.rewardOutfit);

    this.headReward = new THREE.Group();
    this.headReward.visible = false;
    this.headReward.scale.setScalar(0.001);
    this.headPivot.add(this.headReward);

    const rewardMat = createFeltMaterial(def.colorLight, {
      pattern: 'stripe',
      accentHex: def.color,
      seed: 880 + def.id,
    });

    if (def.id === 0) {
      // Girl gets a big cheerful felt star crown on her head + sunny striped scarf!
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.37 * bodyScale, 0.095, 8, 20), rewardMat);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 0.62 * bodyScale, 0.06);
      this.rewardOutfit.add(scarf);

      const starShape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.21 : 0.10;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      starShape.closePath();
      const crownStar = new THREE.Mesh(
        new THREE.ExtrudeGeometry(starShape, { depth: 0.06, bevelEnabled: false }),
        createFeltMaterial('#ffe055', { seed: 901 })
      );
      crownStar.position.set(0, headR * 1.08, 0.12);
      this.headReward.add(crownStar);
    } else if (def.id === 1) {
      // Mom gets a stitched rose flower brooch & cozy scalloped shawl!
      const shawl = new THREE.Mesh(new THREE.TorusGeometry(0.43 * bodyScale, 0.105, 8, 20), rewardMat);
      shawl.rotation.x = Math.PI / 2;
      shawl.position.set(0, 0.56 * bodyScale, 0.07);
      this.rewardOutfit.add(shawl);

      const flowerGroup = new THREE.Group();
      flowerGroup.position.set(0.24, 0.48 * bodyScale, 0.42);
      const petalMat = createFeltMaterial('#ff9eb0', { seed: 902 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), petalMat);
        p.position.set(Math.cos(a) * 0.082, Math.sin(a) * 0.082, 0);
        p.scale.z = 0.5;
        flowerGroup.add(p);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), createFeltMaterial('#f8d552', { seed: 903 }));
      center.position.z = 0.03;
      flowerGroup.add(center);
      this.rewardOutfit.add(flowerGroup);
    } else {
      // Dad gets a dapper stitched yellow polka bowtie + cozy striped scarf!
      const bowMat = createFeltMaterial('#f8d24b', { pattern: 'polka', accentHex: '#fff8ec', seed: 904 });
      const bowGroup = new THREE.Group();
      bowGroup.position.set(0, 0.56 * bodyScale, 0.44);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.21, 10), bowMat);
        wing.rotation.z = side * Math.PI * 0.5;
        wing.scale.z = 0.5;
        wing.position.x = side * 0.10;
        bowGroup.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bowMat);
      bowGroup.add(knot);
      this.rewardOutfit.add(bowGroup);

      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42 * bodyScale, 0.09, 8, 20), rewardMat);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 0.62 * bodyScale, 0.04);
      this.rewardOutfit.add(scarf);
    }

    // Invisible generous touch collider for poking the doll!
    const hitGeo = new THREE.SphereGeometry(0.85, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitCollider = new THREE.Mesh(hitGeo, hitMat);
    this.hitCollider.position.set(0, 0.95, 0.1);
    this.hitCollider.userData = { kind: 'doll', familyId: def.id };
    this.root.add(this.hitCollider);
  }

  setMood(mood, duration = 2.0) {
    this.mood = mood;
    this.moodTimer = duration;
    if (mood === 'happy' || mood === 'beaming') {
      this.bounceVel = 3.2;
    } else if (mood === 'surprised') {
      this.wobbleVel = 6.5;
      this.bounceVel = 2.1;
    } else if (mood === 'eager') {
      this.bounceVel = 1.6;
    }
    this._applyFace();
  }

  poke() {
    this.bounceVel = 3.4;
    this.wobbleVel = (Math.random() > 0.5 ? 1 : -1) * 5.0;
    this.setMood('beaming', 1.4);
  }

  equipReward() {
    this.dressedLevel += 1;
    this.rewardOutfit.visible = true;
    this.headReward.visible = true;
    this.setMood('beaming', 3.4);
    this.bounceVel = 4.2;
  }

  _applyFace() {
    const beaming = this.mood === 'beaming';
    const happy = this.mood === 'happy' || this.mood === 'eager';
    const surprised = this.mood === 'surprised';

    this.openEyesGroup.visible = !beaming;
    this.happyEyesGroup.visible = beaming;

    this.mouthSmile.visible = !happy && !beaming && !surprised;
    this.mouthHappy.visible = happy || beaming;
    this.mouthSurprised.visible = surprised;

    // Scale cheeks slightly warmer when happy/beaming
    const cs = beaming || happy ? 1.2 : 1.0;
    for (const c of this.cheeks) c.scale.set(cs, 1, cs);

    // Wide eyes when surprised!
    const es = surprised ? 1.24 : 1.0;
    for (const e of this.eyeMeshes) e.scale.setScalar(es);
  }

  update(dt, elapsed, focusWorldPos) {
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && this.mood !== 'idle') {
        this.mood = 'idle';
        this._applyFace();
      }
    }

    // Spring bounce
    const kB = 28;
    const dB = 6.5;
    this.bounceVel += (-kB * this.bounceY - dB * this.bounceVel) * dt;
    this.bounceY += this.bounceVel * dt;
    if (this.bounceY < 0) {
      this.bounceY = 0;
      this.bounceVel = Math.max(0, -this.bounceVel * 0.35);
    }

    // Spring wobble
    const kW = 32;
    const dW = 5.5;
    this.wobbleVel += (-kW * this.wobbleZ - dW * this.wobbleVel) * dt;
    this.wobbleZ += this.wobbleVel * dt;

    // Gentle breathing
    const breath = Math.sin(elapsed * 2.1 + this.def.id * 1.7) * 0.025;
    this.bodyPivot.position.y = this.bounceY + breath;
    this.bodyPivot.rotation.z = this.wobbleZ * 0.14;

    // Smooth look toward active laundry / finger
    if (focusWorldPos) {
      this.lookTarget.lerp(focusWorldPos, Math.min(1, dt * 5));
    }
    const dx = this.lookTarget.x - this.root.position.x;
    const dz = Math.max(1.2, this.lookTarget.z - this.root.position.z);
    const desiredYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz) * 0.42, -0.45, 0.45);
    const desiredPitch = this.mood === 'beaming' ? -0.08 : 0.16;
    this.headPivot.rotation.y += (desiredYaw - this.headPivot.rotation.y) * Math.min(1, dt * 6);
    this.headPivot.rotation.x += (desiredPitch - this.headPivot.rotation.x) * Math.min(1, dt * 6);

    // Cute head tilt on surprised / happy
    let targetHeadRoll = Math.sin(elapsed * 1.4 + this.def.id) * 0.04;
    if (this.mood === 'surprised') targetHeadRoll = Math.sin(elapsed * 12) * 0.24;
    else if (this.mood === 'beaming' || this.mood === 'happy') targetHeadRoll = Math.sin(elapsed * 7 + this.def.id) * 0.12;
    this.headPivot.rotation.z += (targetHeadRoll - this.headPivot.rotation.z) * Math.min(1, dt * 8);

    // Mustache wiggle for Dad!
    if (this.mustache) {
      this.mustache.rotation.z =
        this.mood === 'beaming' || this.mood === 'happy'
          ? Math.sin(elapsed * 18) * 0.12
          : Math.sin(elapsed * 2.5) * 0.02;
    }

    // Arm animation (idle sway / eager wave / happy clap!)
    if (this.mood === 'eager') {
      const wave = Math.sin(elapsed * 11) * 0.45;
      this.leftArm.rotation.x = -0.8 + wave;
      this.rightArm.rotation.x = -0.8 - wave;
      this.leftArm.rotation.z = 0.25;
      this.rightArm.rotation.z = -0.25;
    } else if (this.mood === 'beaming' || this.mood === 'happy') {
      const clap = Math.abs(Math.sin(elapsed * 10));
      this.leftArm.rotation.x = -0.65;
      this.rightArm.rotation.x = -0.65;
      this.leftArm.rotation.z = -0.15 - clap * 0.35;
      this.rightArm.rotation.z = 0.15 + clap * 0.35;
    } else if (this.mood === 'surprised') {
      this.leftArm.rotation.x = -1.05;
      this.rightArm.rotation.x = -1.05;
      this.leftArm.rotation.z = 0.38;
      this.rightArm.rotation.z = -0.38;
    } else {
      const sway = Math.sin(elapsed * 2.0 + this.def.id * 2.1) * 0.06;
      this.leftArm.rotation.x += (sway - this.leftArm.rotation.x) * Math.min(1, dt * 6);
      this.rightArm.rotation.x += (-sway - this.rightArm.rotation.x) * Math.min(1, dt * 6);
      this.leftArm.rotation.z += (0 - this.leftArm.rotation.z) * Math.min(1, dt * 6);
      this.rightArm.rotation.z += (0 - this.rightArm.rotation.z) * Math.min(1, dt * 6);
    }

    // Pop-in animation for wearable reward outfit
    if (this.rewardOutfit.visible) {
      const cur = this.rewardOutfit.scale.x;
      const next = cur + (1 - cur) * Math.min(1, dt * 9);
      this.rewardOutfit.scale.setScalar(next);
      this.headReward.scale.setScalar(next);
    }
  }
}
