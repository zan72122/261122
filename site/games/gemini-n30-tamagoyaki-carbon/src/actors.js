// Large, Expressive Realistic 3D Girl & Articulated Foreground Cooking Hands
// Story told purely through facial expressions, gaze, body language & realistic tactile hand movements.

import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import {
  createFabricTexture,
  createHairTexture,
  createIrisTexture,
  createKeyakiWoodTexture,
} from './textures.js';

// 1. Expressive Lifelike 3D Girl Standing Across the Sunlit Kitchen Counter
export class KitchenGirl {
  constructor(scene) {
    this.root = new THREE.Group();
    // Positioned close & warm right behind the countertop so her face & upper body are large and unmistakable!
    this.root.position.set(0.0, 0.62, -1.48);
    scene.add(this.root);

    this.skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xeeb292,
      roughness: 0.48,
      metalness: 0.0,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xff9d82),
      clearcoat: 0.06,
      clearcoatRoughness: 0.45,
    });

    this.cheekBlushMat = new THREE.MeshBasicMaterial({
      color: 0xe86862,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });

    const apronTex = createFabricTexture([204, 98, 72], [178, 78, 54]);
    this.apronMat = new THREE.MeshStandardMaterial({
      map: apronTex.map,
      bumpMap: apronTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.82,
    });

    const shirtTex = createFabricTexture([242, 232, 214], [222, 210, 190]);
    this.shirtMat = new THREE.MeshStandardMaterial({
      map: shirtTex.map,
      bumpMap: shirtTex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.78,
    });

    const hairTex = createHairTexture();
    this.hairMat = new THREE.MeshPhysicalMaterial({
      map: hairTex.map,
      bumpMap: hairTex.bumpMap,
      bumpScale: 0.01,
      roughness: 0.44,
      clearcoat: 0.22,
      clearcoatRoughness: 0.38,
      sheen: 0.3,
      sheenColor: new THREE.Color(0x8c583a),
    });

    this._buildBody();
    this._buildHead();

    this.lookTarget = new THREE.Vector3(0, 0.85, 0.3);
    this.currentLook = new THREE.Vector3(0, 0.85, 0.3);

    this.mood = 'curious'; // 'curious' | 'excited' | 'openMouth' | 'munching' | 'celebrate' | 'sparkle'
    this.moodTimer = 0;
    this.blinkTimer = 2.4;
    this.blinkPhase = 0;
    this.time = 0;
    this.nodAmount = 0;
    this.mouthOpenVal = 0.08;
    this.smileVal = 0.55;
    this.cheekPuff = 0;
  }

  _buildBody() {
    this.torsoPivot = new THREE.Group();
    this.root.add(this.torsoPivot);

    // Cream cotton knit top
    const chestGeo = new THREE.CapsuleGeometry(0.39, 0.52, 12, 24);
    chestGeo.scale(1.18, 1.0, 0.76);
    const chest = new THREE.Mesh(chestGeo, this.shirtMat);
    chest.position.set(0, 0.35, 0);
    chest.castShadow = true;
    chest.receiveShadow = true;
    this.torsoPivot.add(chest);

    // Terracotta linen kitchen apron bib & straps
    const bibGeo = new RoundedBoxGeometry(0.58, 0.62, 0.08, 4, 0.04);
    const bib = new THREE.Mesh(bibGeo, this.apronMat);
    bib.position.set(0, 0.28, 0.28);
    bib.castShadow = true;
    this.torsoPivot.add(bib);

    [-1, 1].forEach((side) => {
      const strapGeo = new RoundedBoxGeometry(0.085, 0.48, 0.06, 3, 0.02);
      const strap = new THREE.Mesh(strapGeo, this.apronMat);
      strap.position.set(side * 0.22, 0.62, 0.19);
      strap.rotation.x = -0.34;
      strap.rotation.z = -side * 0.08;
      this.torsoPivot.add(strap);
    });

    // Shoulders & expressive arms (clapping / leaning / cheering!)
    this.leftArm = this._createArm(-1);
    this.rightArm = this._createArm(1);
    this.torsoPivot.add(this.leftArm.pivot, this.rightArm.pivot);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.125, 0.145, 0.26, 20);
    const neck = new THREE.Mesh(neckGeo, this.skinMat);
    neck.position.set(0, 0.82, 0.03);
    neck.castShadow = true;
    this.torsoPivot.add(neck);
  }

  _createArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.38, 0.66, 0.04);

    // Seamless knit shoulder cap
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), this.shirtMat);
    pivot.add(shoulder);

    const upperGeo = new THREE.CapsuleGeometry(0.11, 0.34, 8, 16);
    const upper = new THREE.Mesh(upperGeo, this.shirtMat);
    upper.position.set(side * 0.07, -0.17, 0.06);
    upper.rotation.z = side * 0.24;
    upper.rotation.x = 0.28;
    upper.castShadow = true;
    pivot.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(side * 0.14, -0.35, 0.15);
    pivot.add(elbow);

    const foreGeo = new THREE.CapsuleGeometry(0.082, 0.28, 8, 16);
    const fore = new THREE.Mesh(foreGeo, this.skinMat);
    fore.position.set(-side * 0.05, -0.05, 0.15);
    fore.rotation.x = 1.22;
    fore.rotation.z = -side * 0.26;
    fore.castShadow = true;
    elbow.add(fore);

    const handGeo = new THREE.SphereGeometry(0.088, 16, 14);
    handGeo.scale(0.95, 0.70, 1.18);
    const hand = new THREE.Mesh(handGeo, this.skinMat);
    hand.position.set(-side * 0.11, -0.09, 0.29);
    hand.castShadow = true;
    elbow.add(hand);

    return { pivot, elbow, hand };
  }

  _buildHead() {
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.14, 0.06);
    this.headGroup.userData.kind = 'girlFace';
    this.torsoPivot.add(this.headGroup);

    // Sculpted lifelike cranial + soft jawline contour
    const craniumGeo = new THREE.SphereGeometry(0.35, 32, 28);
    craniumGeo.scale(0.95, 1.06, 0.95);
    const cranium = new THREE.Mesh(craniumGeo, this.skinMat);
    cranium.castShadow = true;
    cranium.receiveShadow = true;
    cranium.userData.kind = 'girlFace';
    this.headGroup.add(cranium);

    // Subtle integrated lower-cheek fullness (inflates gently when munching "mogu-mogu"!)
    this.cheeks = [];
    [-1, 1].forEach((side) => {
      const chGeo = new THREE.SphereGeometry(0.135, 18, 16);
      chGeo.scale(1.0, 0.85, 0.78);
      const ch = new THREE.Mesh(chGeo, this.skinMat);
      ch.position.set(side * 0.155, -0.105, 0.205);
      this.headGroup.add(ch);
      this.cheeks.push(ch);

      // Warm rosy blush disc over cheekbones
      const blGeo = new THREE.CircleGeometry(0.075, 18);
      const bl = new THREE.Mesh(blGeo, this.cheekBlushMat);
      bl.position.set(side * 0.19, -0.068, 0.308);
      bl.rotation.y = side * 0.42;
      bl.rotation.x = 0.10;
      this.headGroup.add(bl);
    });

    // Soft sculpted nose
    const noseGeo = new THREE.SphereGeometry(0.036, 16, 14);
    noseGeo.scale(0.84, 1.06, 1.12);
    const nose = new THREE.Mesh(noseGeo, this.skinMat);
    nose.position.set(0, -0.042, 0.342);
    this.headGroup.add(nose);

    // Ears
    [-1, 1].forEach((side) => {
      const earGeo = new THREE.SphereGeometry(0.075, 14, 12);
      earGeo.scale(0.45, 0.95, 0.72);
      const ear = new THREE.Mesh(earGeo, this.skinMat);
      ear.position.set(side * 0.345, -0.02, 0.01);
      this.headGroup.add(ear);
    });

    // Layered Lifelike 3D Eyes (sclera + iris fibers + wet corneal highlight + eyelids + happy crescents + brows)
    const irisTex = createIrisTexture();
    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: 0xfcfaf7,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const irisMat = new THREE.MeshBasicMaterial({ map: irisTex });
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x26150d, roughness: 0.5 });

    this.eyes = [];
    this.brows = [];
    [-1, 1].forEach((side) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.138, 0.042, 0.295);
      this.headGroup.add(eyeSocket);

      const ballGeo = new THREE.SphereGeometry(0.068, 20, 18);
      ballGeo.scale(1.04, 1.0, 0.65);
      const ball = new THREE.Mesh(ballGeo, scleraMat);
      eyeSocket.add(ball);

      const pupilPivot = new THREE.Group();
      eyeSocket.add(pupilPivot);

      const irisGeo = new THREE.CircleGeometry(0.044, 24);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(0, 0, 0.045);
      pupilPivot.add(iris);

      // Corneal catchlights (large morning window catchlight + secondary sparkle)
      const hl1 = new THREE.Mesh(new THREE.CircleGeometry(0.013, 12), highlightMat);
      hl1.position.set(-0.014, 0.015, 0.047);
      pupilPivot.add(hl1);

      const hl2 = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 10), highlightMat);
      hl2.position.set(0.015, -0.012, 0.047);
      pupilPivot.add(hl2);

      // Upper eyelid for smooth natural blinking
      const lidGeo = new THREE.SphereGeometry(0.073, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
      lidGeo.scale(1.06, 1.02, 0.72);
      const upperLid = new THREE.Mesh(lidGeo, this.skinMat);
      upperLid.rotation.x = -0.95; // open rest
      eyeSocket.add(upperLid);

      // Eyelash arc
      const lashGeo = new THREE.TorusGeometry(0.062, 0.0085, 8, 20, Math.PI * 0.88);
      const lash = new THREE.Mesh(lashGeo, lashMat);
      lash.position.set(0, 0.008, 0.038);
      lash.rotation.z = Math.PI * 0.06;
      eyeSocket.add(lash);

      // Happy smiling crescent arc (visible when beaming ^_^)
      const happyArcGeo = new THREE.TorusGeometry(0.052, 0.0095, 8, 20, Math.PI * 0.85);
      const happyArc = new THREE.Mesh(happyArcGeo, lashMat);
      happyArc.position.set(0, -0.004, 0.052);
      happyArc.rotation.z = Math.PI * 0.08;
      happyArc.visible = false;
      eyeSocket.add(happyArc);

      this.eyes.push({ eyeSocket, pupilPivot, upperLid, lash, happyArc, ball, side });

      // Expressive Eyebrow
      const browGeo = new THREE.CapsuleGeometry(0.013, 0.095, 6, 10);
      browGeo.rotateZ(Math.PI * 0.5);
      const brow = new THREE.Mesh(browGeo, lashMat);
      brow.position.set(side * 0.142, 0.148, 0.318);
      brow.rotation.y = side * 0.25;
      this.headGroup.add(brow);
      this.brows.push({ mesh: brow, side });
    });

    // Sculpted 3D Mouth Cavity (opens wide for "A-nn!", curves into radiant smile, chews "mogu-mogu"!)
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, -0.158, 0.316);
    this.headGroup.add(this.mouthGroup);

    const cavityMat = new THREE.MeshBasicMaterial({ color: 0x6e1f24 });
    const cavityGeo = new THREE.SphereGeometry(0.065, 18, 14);
    cavityGeo.scale(1.15, 0.85, 0.45);
    this.mouthCavity = new THREE.Mesh(cavityGeo, cavityMat);
    this.mouthGroup.add(this.mouthCavity);

    const tongueMat = new THREE.MeshStandardMaterial({ color: 0xee787c, roughness: 0.35 });
    const tongueGeo = new THREE.SphereGeometry(0.044, 14, 12);
    tongueGeo.scale(1.05, 0.55, 0.65);
    this.tongue = new THREE.Mesh(tongueGeo, tongueMat);
    this.tongue.position.set(0, -0.022, 0.012);
    this.mouthGroup.add(this.tongue);

    const teethMat = new THREE.MeshStandardMaterial({ color: 0xfdfbf7, roughness: 0.2 });
    const teethGeo = new RoundedBoxGeometry(0.072, 0.018, 0.02, 2, 0.005);
    this.teeth = new THREE.Mesh(teethGeo, teethMat);
    this.teeth.position.set(0, 0.028, 0.018);
    this.mouthGroup.add(this.teeth);

    const lipMat = new THREE.MeshPhysicalMaterial({
      color: 0xe37a76,
      roughness: 0.32,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
    });
    const smileLipGeo = new THREE.TorusGeometry(0.062, 0.012, 10, 24, Math.PI * 0.92);
    this.closedSmileLip = new THREE.Mesh(smileLipGeo, lipMat);
    this.closedSmileLip.rotation.z = Math.PI * 1.04;
    this.closedSmileLip.position.set(0, 0.02, 0.024);
    this.mouthGroup.add(this.closedSmileLip);

    // Glossy Chestnut Hair Cap tilted backward (-0.60 rad) so front hairline sits high at y=+0.24 above brows & eyes!
    const hairCapGeo = new THREE.SphereGeometry(0.368, 28, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    hairCapGeo.scale(0.98, 1.05, 1.0);
    const hairCap = new THREE.Mesh(hairCapGeo, this.hairMat);
    hairCap.position.set(0, 0.04, -0.02);
    hairCap.rotation.x = -0.60;
    hairCap.castShadow = true;
    this.headGroup.add(hairCap);

    // Soft swept side-curtain bangs framing temples while leaving forehead, eyebrows & big eyes 100% open!
    [-1, 1].forEach((side) => {
      for (let k = 0; k < 2; k++) {
        const sweepGeo = new THREE.CapsuleGeometry(0.048 - k * 0.008, 0.14, 8, 12);
        sweepGeo.scale(1.15, 1.0, 0.45);
        const sweep = new THREE.Mesh(sweepGeo, this.hairMat);
        sweep.position.set(side * (0.16 + k * 0.085), 0.21 - k * 0.055, 0.275 - k * 0.045);
        sweep.rotation.z = side * (0.48 + k * 0.18);
        sweep.rotation.y = side * (0.25 + k * 0.15);
        sweep.rotation.x = -0.18;
        this.headGroup.add(sweep);
      }
    });

    // Twin side braids resting over shoulders
    [-1, 1].forEach((side) => {
      const braidGroup = new THREE.Group();
      braidGroup.position.set(side * 0.32, -0.12, 0.02);
      this.headGroup.add(braidGroup);
      for (let k = 0; k < 4; k++) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.075 - k * 0.008, 14, 12), this.hairMat);
        bead.scale.set(0.9, 1.15, 0.85);
        bead.position.set(side * k * 0.015, -k * 0.095, k * 0.038);
        bead.castShadow = true;
        braidGroup.add(bead);
      }
      // Cute terracotta ribbon tie
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.014, 8, 16), this.apronMat);
      tie.position.set(side * 0.045, -0.32, 0.13);
      tie.rotation.x = Math.PI * 0.45;
      braidGroup.add(tie);
    });

    // Cute linen kitchen kerchief headband arched high over the crown!
    const bandGeo = new THREE.TorusGeometry(0.358, 0.048, 12, 32, Math.PI * 1.08);
    const band = new THREE.Mesh(bandGeo, this.apronMat);
    band.position.set(0, 0.08, -0.02);
    band.rotation.x = -Math.PI * 0.42;
    band.rotation.z = -Math.PI * 0.04;
    band.castShadow = true;
    this.headGroup.add(band);
  }

  setLookTarget(vec3) {
    this.lookTarget.copy(vec3);
  }

  setMood(mood, duration = 1.6) {
    this.mood = mood;
    this.moodTimer = duration;
    if (mood === 'excited' || mood === 'celebrate' || mood === 'sparkle') {
      this.nodAmount = 1.0;
    }
  }

  update(dt) {
    this.time += dt;
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && (this.mood === 'excited' || this.mood === 'munching' || this.mood === 'sparkle')) {
        this.mood = 'curious';
      }
    }

    // Natural gentle breathing & warm sway
    const breath = Math.sin(this.time * 2.1);
    this.torsoPivot.position.y = breath * 0.012;
    this.torsoPivot.rotation.z = Math.sin(this.time * 1.1) * 0.018;

    this.nodAmount *= Math.exp(-5.0 * dt);

    // Smooth eye & head tracking toward the active food/action
    this.currentLook.lerp(this.lookTarget, Math.min(1, dt * 6.5));
    const headWorld = new THREE.Vector3();
    this.headGroup.getWorldPosition(headWorld);
    const dx = this.currentLook.x - headWorld.x;
    const dy = this.currentLook.y - headWorld.y;
    const dz = Math.max(0.4, this.currentLook.z - headWorld.z);

    const targetYaw = Math.max(-0.38, Math.min(0.38, Math.atan2(dx, dz) * 0.68));
    const targetPitch = Math.max(-0.22, Math.min(0.38, -Math.atan2(dy, dz) * 0.62)) + Math.sin(this.time * 16) * this.nodAmount * 0.06;

    this.headGroup.rotation.y += (targetYaw - this.headGroup.rotation.y) * Math.min(1, dt * 7);
    this.headGroup.rotation.x += (targetPitch - this.headGroup.rotation.x) * Math.min(1, dt * 7);
    const headTilt = this.mood === 'curious' ? Math.sin(this.time * 1.4) * 0.035 : (this.mood === 'sparkle' ? 0.08 : 0);
    this.headGroup.rotation.z += (headTilt - this.headGroup.rotation.z) * Math.min(1, dt * 5);

    // Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.8;
      this.blinkPhase = 1.0;
    }
    if (this.blinkPhase > 0) {
      this.blinkPhase = Math.max(0, this.blinkPhase - dt * 7.5);
    }
    const blinkAmt = Math.sin(this.blinkPhase * Math.PI);

    // Facial expression targets by mood
    let targetMouthOpen = 0.04;
    let targetCheekPuff = 0.0;
    let targetBlush = 0.24;
    let happySquint = false;
    let browLift = 0.0;

    if (this.mood === 'openMouth') {
      targetMouthOpen = 0.92; // Big clear "A-nn!!" open mouth when slice approaches!
      browLift = 0.024;
      targetBlush = 0.36;
    } else if (this.mood === 'munching') {
      const chew = Math.sin(this.time * 13.5) * 0.5 + 0.5;
      targetMouthOpen = 0.06 + chew * 0.22;
      targetCheekPuff = 0.35 + chew * 0.65;
      targetBlush = 0.46;
      happySquint = true;
    } else if (this.mood === 'celebrate' || this.mood === 'sparkle') {
      targetMouthOpen = 0.52;
      targetCheekPuff = 0.22;
      targetBlush = 0.48;
      happySquint = true;
      browLift = 0.022;
    } else if (this.mood === 'excited') {
      targetMouthOpen = 0.38;
      browLift = 0.02;
      targetBlush = 0.34;
    }

    this.mouthOpenVal += (targetMouthOpen - this.mouthOpenVal) * Math.min(1, dt * 12);
    this.cheekPuff += (targetCheekPuff - this.cheekPuff) * Math.min(1, dt * 12);
    this.cheekBlushMat.opacity += (targetBlush - this.cheekBlushMat.opacity) * Math.min(1, dt * 6);

    // Apply cheek puff
    this.cheeks.forEach((ch) => {
      const s = 1 + this.cheekPuff * 0.16;
      ch.scale.set(1.05 * s, 0.88 * s, 0.85 * s);
    });

    // Apply eye gaze, eyelids & happy crescents
    const eyeGx = Math.max(-0.016, Math.min(0.016, dx * 0.022));
    const eyeGy = Math.max(-0.014, Math.min(0.014, dy * 0.018));
    this.eyes.forEach((e) => {
      e.pupilPivot.position.set(eyeGx, eyeGy, 0);
      e.happyArc.visible = happySquint;
      e.ball.visible = !happySquint;
      e.pupilPivot.visible = !happySquint;
      e.lash.visible = !happySquint;
      e.upperLid.visible = !happySquint;
      e.upperLid.rotation.x = -0.95 + blinkAmt * 0.92;
    });

    this.brows.forEach((b) => {
      b.mesh.position.y = 0.148 + browLift;
      b.mesh.rotation.z = b.side * (happySquint ? -0.14 : -0.05);
    });

    // Apply sculpted 3D mouth
    if (this.mouthOpenVal > 0.14) {
      this.mouthCavity.visible = true;
      this.tongue.visible = true;
      this.teeth.visible = this.mouthOpenVal > 0.25;
      this.closedSmileLip.visible = false;
      const openS = 0.35 + this.mouthOpenVal * 0.95;
      this.mouthCavity.scale.set(1.05 + this.mouthOpenVal * 0.22, openS, 0.45);
      this.tongue.position.y = -0.016 - this.mouthOpenVal * 0.024;
      this.teeth.position.y = 0.014 + this.mouthOpenVal * 0.026;
    } else {
      this.mouthCavity.visible = false;
      this.tongue.visible = false;
      this.teeth.visible = false;
      this.closedSmileLip.visible = true;
    }

    // Arm animation: gentle counter-resting vs joyful clapping in 'celebrate' / 'sparkle'!
    if (this.mood === 'celebrate' || this.mood === 'sparkle') {
      const clap = Math.abs(Math.sin(this.time * 9.5));
      this.leftArm.pivot.rotation.x = -0.52;
      this.rightArm.pivot.rotation.x = -0.52;
      this.leftArm.pivot.rotation.z = -0.22 - clap * 0.26;
      this.rightArm.pivot.rotation.z = 0.22 + clap * 0.26;
    } else if (this.mood === 'openMouth') {
      // Leaning forward eagerly with hands clasped near cheeks!
      this.leftArm.pivot.rotation.x = -0.38;
      this.rightArm.pivot.rotation.x = -0.38;
      this.leftArm.pivot.rotation.z = -0.18;
      this.rightArm.pivot.rotation.z = 0.18;
    } else {
      this.leftArm.pivot.rotation.x += (-0.08 - this.leftArm.pivot.rotation.x) * Math.min(1, dt * 6);
      this.rightArm.pivot.rotation.x += (-0.08 - this.rightArm.pivot.rotation.x) * Math.min(1, dt * 6);
      this.leftArm.pivot.rotation.z += (0.04 - this.leftArm.pivot.rotation.z) * Math.min(1, dt * 6);
      this.rightArm.pivot.rotation.z += (-0.04 - this.rightArm.pivot.rotation.z) * Math.min(1, dt * 6);
    }
  }
}

// 2. Large, Articulated Realistic 3D Foreground Cooking Hands + Tools (Saibashi Chopsticks, Santoku Knife)
export class CookingHands {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xeeb08e,
      roughness: 0.46,
      metalness: 0.0,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xff9a7e),
      clearcoat: 0.08,
      clearcoatRoughness: 0.42,
    });

    this.nailMat = new THREE.MeshPhysicalMaterial({
      color: 0xfadbd2,
      roughness: 0.22,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
    });

    // Soft warm oatmeal-chambray cotton sleeve (distinct from food & extends smoothly offscreen!)
    const cuffTex = createFabricTexture([218, 206, 188], [198, 184, 166]);
    this.cuffMat = new THREE.MeshStandardMaterial({
      map: cuffTex.map,
      bumpMap: cuffTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.82,
    });

    this.left = this._buildHand(-1);
    this.right = this._buildHand(1);
    this.root.add(this.left.group, this.right.group);

    // Long wooden cooking chopsticks ("Saibashi") attached to Right Hand
    this.chopsticks = this._buildChopsticks();
    this.right.toolMount.add(this.chopsticks);
    this.chopsticks.visible = false;

    // Gleaming Japanese Santoku Chef Knife attached to Right Hand
    this.knife = this._buildSantokuKnife();
    this.right.toolMount.add(this.knife);
    this.knife.visible = false;

    // Pose targets (damped spring so hand motion always feels weighty, big & natural!)
    this.leftTargetPos = new THREE.Vector3(-1.35, 0.55, 1.85);
    this.leftTargetRot = new THREE.Euler(0.25, 0.35, 0);
    this.rightTargetPos = new THREE.Vector3(1.35, 0.55, 1.85);
    this.rightTargetRot = new THREE.Euler(0.25, -0.35, 0);

    this.left.group.position.copy(this.leftTargetPos);
    this.right.group.position.copy(this.rightTargetPos);

    this.leftCurl = 0.25;
    this.rightCurl = 0.25;
    this.chopstickPinch = 0.08;
  }

  _buildHand(side) {
    // side: -1 = left hand, +1 = right hand
    // Local coordinates: palm faces -Y, fingers extend toward -Z (into the counter!)
    const group = new THREE.Group();
    group.scale.setScalar(1.16); // Large, clear, unmistakable hands on screen!

    // Contoured palm
    const palmGeo = new RoundedBoxGeometry(0.24, 0.088, 0.25, 4, 0.042);
    const palm = new THREE.Mesh(palmGeo, this.skinMat);
    palm.castShadow = true;
    palm.receiveShadow = true;
    group.add(palm);

    // Soft wrist & warm rolled knit sleeve cuff extending toward viewer (+Z)
    const wristGeo = new THREE.CapsuleGeometry(0.092, 0.24, 8, 16);
    wristGeo.rotateX(Math.PI * 0.5);
    wristGeo.scale(1.12, 0.82, 1.0);
    const wrist = new THREE.Mesh(wristGeo, this.skinMat);
    wrist.position.set(0, 0.01, 0.20);
    wrist.castShadow = true;
    group.add(wrist);

    const cuffGeo = new THREE.CylinderGeometry(0.118, 0.155, 1.38, 20);
    cuffGeo.rotateX(Math.PI * 0.5);
    cuffGeo.scale(1.12, 0.86, 1.0);
    const cuff = new THREE.Mesh(cuffGeo, this.cuffMat);
    cuff.position.set(side * 0.08, -0.02, 0.90);
    cuff.rotation.y = -side * 0.08;
    cuff.castShadow = true;
    group.add(cuff);

    // 4 sculpted articulated fingers with knuckles & glossy fingernails
    const fingerSpecs = [
      { x: -side * 0.084, len: 0.19, r: 0.030 }, // index
      { x: -side * 0.028, len: 0.21, r: 0.031 }, // middle
      { x: side * 0.028, len: 0.195, r: 0.029 }, // ring
      { x: side * 0.082, len: 0.155, r: 0.026 }, // pinky
    ];
    const fingers = [];
    fingerSpecs.forEach((sp) => {
      const knuckle = new THREE.Group();
      knuckle.position.set(sp.x, -0.004, -0.115);
      group.add(knuckle);

      const proxGeo = new THREE.CapsuleGeometry(sp.r, sp.len * 0.48, 6, 12);
      proxGeo.rotateX(Math.PI * 0.5);
      const prox = new THREE.Mesh(proxGeo, this.skinMat);
      prox.position.set(0, 0, -sp.len * 0.28);
      prox.castShadow = true;
      knuckle.add(prox);

      const midJoint = new THREE.Group();
      midJoint.position.set(0, 0, -sp.len * 0.56);
      knuckle.add(midJoint);

      const distGeo = new THREE.CapsuleGeometry(sp.r * 0.88, sp.len * 0.42, 6, 12);
      distGeo.rotateX(Math.PI * 0.5);
      const dist = new THREE.Mesh(distGeo, this.skinMat);
      dist.position.set(0, 0, -sp.len * 0.24);
      dist.castShadow = true;
      midJoint.add(dist);

      // Subtle glossy fingernail
      const nailGeo = new THREE.SphereGeometry(sp.r * 0.72, 10, 8);
      nailGeo.scale(1.0, 0.22, 1.25);
      const nail = new THREE.Mesh(nailGeo, this.nailMat);
      nail.position.set(0, sp.r * 0.76, -sp.len * 0.38);
      midJoint.add(nail);

      fingers.push({ knuckle, midJoint });
    });

    // Opposable Thumb on the inner side (-side * X)
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-side * 0.118, -0.018, -0.02);
    thumbPivot.rotation.y = side * 0.52;
    group.add(thumbPivot);

    const thGeo = new THREE.CapsuleGeometry(0.034, 0.13, 6, 12);
    thGeo.rotateX(Math.PI * 0.5);
    const thMesh = new THREE.Mesh(thGeo, this.skinMat);
    thMesh.position.set(0, 0, -0.085);
    thMesh.castShadow = true;
    thumbPivot.add(thMesh);

    const thNail = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), this.nailMat);
    thNail.scale.set(1.0, 0.22, 1.2);
    thNail.position.set(0, 0.026, -0.135);
    thumbPivot.add(thNail);

    const toolMount = new THREE.Group();
    toolMount.position.set(-side * 0.055, -0.055, -0.14);
    group.add(toolMount);

    return { group, fingers, thumbPivot, toolMount, side };
  }

  _buildChopsticks() {
    const grp = new THREE.Group();
    const woodTex = createKeyakiWoodTexture(false);
    const mat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.42,
    });
    const tipRedMat = new THREE.MeshStandardMaterial({ color: 0xb63628, roughness: 0.35 });

    // Two tapered saibashi sticks gripped naturally in the thumb-index web, extending down-forward!
    this.stickA = new THREE.Group();
    this.stickB = new THREE.Group();
    [this.stickA, this.stickB].forEach((st, idx) => {
      const shaftGeo = new THREE.CylinderGeometry(0.008, 0.0145, 0.88, 12);
      shaftGeo.rotateX(Math.PI * 0.5);
      const shaft = new THREE.Mesh(shaftGeo, mat);
      shaft.position.set(0, 0, -0.18);
      shaft.castShadow = true;
      st.add(shaft);

      // Decorative lacquer band at upper rear end (above thumb web, never poking through palm!)
      const bandGeo = new THREE.CylinderGeometry(0.0148, 0.0152, 0.11, 12);
      bandGeo.rotateX(Math.PI * 0.5);
      const band = new THREE.Mesh(bandGeo, tipRedMat);
      band.position.set(0, 0, 0.20);
      st.add(band);

      st.position.set(idx === 0 ? -0.020 : 0.020, idx === 0 ? 0.012 : -0.012, 0);
      grp.add(st);
    });

    this.chopstickTipAnchor = new THREE.Group();
    this.chopstickTipAnchor.position.set(0, -0.01, -0.62);
    grp.add(this.chopstickTipAnchor);

    grp.position.set(-0.04, 0.045, 0.05);
    grp.rotation.x = -0.52;
    grp.rotation.y = 0.22;
    return grp;
  }

  _buildSantokuKnife() {
    const grp = new THREE.Group();
    const handleTex = createKeyakiWoodTexture(true);
    const handleMat = new THREE.MeshStandardMaterial({ map: handleTex, roughness: 0.48 });
    const steelMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6eaee,
      metalness: 0.92,
      roughness: 0.14,
      clearcoat: 0.35,
    });

    // Wooden riveted handle
    const hGeo = new RoundedBoxGeometry(0.048, 0.072, 0.34, 3, 0.018);
    const handle = new THREE.Mesh(hGeo, handleMat);
    handle.position.set(0, 0.01, 0.08);
    handle.castShadow = true;
    grp.add(handle);

    // Stainless bolster
    const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.074, 0.04, 2, 0.008), steelMat);
    bolster.position.set(0, 0.01, -0.10);
    grp.add(bolster);

    // Wide Santoku blade with curved sheepsfoot tip
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.045);
    shape.lineTo(-0.56, 0.038);
    shape.quadraticCurveTo(-0.66, 0.022, -0.68, -0.088);
    shape.quadraticCurveTo(-0.35, -0.098, 0, -0.092);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 0.009,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    // Rotate so blade extends forward (-Z) and cutting edge faces down (-Y)
    extrude.rotateY(-Math.PI * 0.5);
    const blade = new THREE.Mesh(extrude, steelMat);
    blade.position.set(0.0045, 0.01, -0.11);
    blade.castShadow = true;
    grp.add(blade);

    grp.rotation.x = -0.14;
    return grp;
  }

  setTool(toolName = 'none') {
    this.chopsticks.visible = toolName === 'chopsticks';
    this.knife.visible = toolName === 'knife';
  }

  setPose({
    leftPos,
    leftRot,
    rightPos,
    rightRot,
    leftCurl = 0.25,
    rightCurl = 0.35,
    pinch = 0.08,
  }) {
    if (leftPos) this.leftTargetPos.copy(leftPos);
    if (leftRot) this.leftTargetRot.set(leftRot.x, leftRot.y, leftRot.z);
    if (rightPos) this.rightTargetPos.copy(rightPos);
    if (rightRot) this.rightTargetRot.set(rightRot.x, rightRot.y, rightRot.z);
    this.leftCurl = leftCurl;
    this.rightCurl = rightCurl;
    this.chopstickPinch = pinch;
  }

  update(dt) {
    const k = Math.min(1, dt * 13.5);
    this.left.group.position.lerp(this.leftTargetPos, k);
    this.right.group.position.lerp(this.rightTargetPos, k);

    this.left.group.rotation.x += (this.leftTargetRot.x - this.left.group.rotation.x) * k;
    this.left.group.rotation.y += (this.leftTargetRot.y - this.left.group.rotation.y) * k;
    this.left.group.rotation.z += (this.leftTargetRot.z - this.left.group.rotation.z) * k;

    this.right.group.rotation.x += (this.rightTargetRot.x - this.right.group.rotation.x) * k;
    this.right.group.rotation.y += (this.rightTargetRot.y - this.right.group.rotation.y) * k;
    this.right.group.rotation.z += (this.rightTargetRot.z - this.right.group.rotation.z) * k;

    // Apply smooth finger curl (e.g. "cat-paw" safe grip when slicing, gripping chopsticks when stirring!)
    const applyCurl = (hand, curl) => {
      hand.fingers.forEach((f, idx) => {
        const c = curl * (0.9 + idx * 0.06);
        f.knuckle.rotation.x += (-c * 0.95 - f.knuckle.rotation.x) * k;
        f.midJoint.rotation.x += (-c * 1.15 - f.midJoint.rotation.x) * k;
      });
      hand.thumbPivot.rotation.x += (-curl * 0.55 - hand.thumbPivot.rotation.x) * k;
    };
    applyCurl(this.left, this.leftCurl);
    applyCurl(this.right, this.rightCurl);

    // Chopstick pinch spread
    if (this.chopsticks.visible) {
      this.stickA.rotation.y = -this.chopstickPinch;
      this.stickB.rotation.y = this.chopstickPinch;
    }
  }
}
