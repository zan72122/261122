import * as THREE from 'three';

// Big, super-expressive Pastel Kawaii Toy Patissiere Girl + Gentle Idle Demo Hand
// Communicates the whole story through eyes, cheeks, mouth, head tilt, and big toy hands!

export class ToyCharacter {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.position.set(0, -0.18, -2.18);
    this.scene.add(this.root);

    this.mood = 'eager'; // eager | amazed | happy | heart | blow | eat | cheer | giggle
    this.moodTimer = 0;
    this.blinkTimer = 2.2;
    this.blinkProgress = 0;
    this.bounceAmp = 0;
    this.clapTimer = 0;
    this.eatTimer = 0;
    this.blowTimer = 0;
    this.noseCreamTimer = 0;

    this.lookTarget = new THREE.Vector3(0, 1.5, 0.5);
    this.smoothLook = new THREE.Vector3(0, 1.5, 0.5);

    this._buildBody();
    this._buildHelperHand();
  }

  _buildBody() {
    // Materials — clean pastel satin-vinyl toy finish
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe4d6, roughness: 0.42, metalness: 0.02 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffa6c9, roughness: 0.36, metalness: 0.04 });
    const dressMat = new THREE.MeshStandardMaterial({ color: 0xbaf0de, roughness: 0.4, metalness: 0.02 });
    const apronMat = new THREE.MeshStandardMaterial({ color: 0xfffaf6, roughness: 0.42, metalness: 0.02 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xff77a8, roughness: 0.3, metalness: 0.05 });
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xff85ad, roughness: 0.5, transparent: true, opacity: 0.65 });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x5c3148, roughness: 0.12, metalness: 0.08 });
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mouthInnerMat = new THREE.MeshStandardMaterial({ color: 0xff6e96, roughness: 0.35 });
    const starEyeMat = new THREE.MeshBasicMaterial({ color: 0xffdf6b });
    const heartEyeMat = new THREE.MeshBasicMaterial({ color: 0xff6b9e });

    this.blushMat = blushMat;

    // Torso group (bounces happily!)
    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    // Rounded cute chibi torso + mint dress
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 1.45, 22), dressMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    // Frilly white patissiere apron front (clear radial offset so zero z-fighting!)
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.67, 0.96, 1.12, 18, 1, false, -Math.PI * 0.35, Math.PI * 0.70),
      apronMat
    );
    apron.position.y = 1.02;
    this.bodyGroup.add(apron);

    // Big cute pink bow at collar
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, 1.66, 0.64);
    const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), ribbonMat);
    bowGroup.add(bowCenter);
    const wingGeo = new THREE.SphereGeometry(0.17, 12, 10);
    wingGeo.scale(1.25, 0.78, 0.55);
    const leftWing = new THREE.Mesh(wingGeo, ribbonMat);
    leftWing.position.set(-0.18, 0.02, 0);
    leftWing.rotation.z = 0.25;
    const rightWing = new THREE.Mesh(wingGeo, ribbonMat);
    rightWing.position.set(0.18, 0.02, 0);
    rightWing.rotation.z = -0.25;
    bowGroup.add(leftWing, rightWing);
    this.bodyGroup.add(bowGroup);

    // Cute ruffled collar beads
    const collarGeo = new THREE.SphereGeometry(0.13, 10, 8);
    for (let i = -3; i <= 3; i++) {
      const a = (i / 3.5) * 1.15;
      const bead = new THREE.Mesh(collarGeo, apronMat);
      bead.position.set(Math.sin(a) * 0.54, 1.76, Math.cos(a) * 0.54);
      this.bodyGroup.add(bead);
    }

    // --- HEAD GROUP (HUGE, expressive, tilted & nodding!) ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.72, 0.08);
    this.bodyGroup.add(this.headGroup);

    // Plump kawaii vinyl doll head
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 24), skinMat);
    headMesh.scale.set(1.06, 0.98, 0.96);
    headMesh.castShadow = true;
    headMesh.userData.interact = 'character-face';
    this.headMesh = headMesh;
    this.headGroup.add(headMesh);

    // Cute rounded ears
    const earGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.96, -0.05, 0.0);
    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.position.set(0.96, -0.05, 0.0);
    this.headGroup.add(leftEar, rightEar);

    // Tiny adorable button nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), skinMat);
    nose.position.set(0, -0.05, 0.92);
    nose.userData.interact = 'character-face';
    this.headGroup.add(nose);

    // Silly discovery: tiny dab of whipped cream on her nose!
    this.noseCream = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.25 })
    );
    this.noseCream.position.set(0.02, -0.02, 0.99);
    this.noseCream.scale.set(1.15, 0.85, 0.9);
    this.noseCream.visible = false;
    this.headGroup.add(this.noseCream);

    // Rosy glowing blush cheeks
    const blushGeo = new THREE.SphereGeometry(0.19, 14, 10);
    blushGeo.scale(1.25, 0.72, 0.35);
    this.leftBlush = new THREE.Mesh(blushGeo, blushMat);
    this.leftBlush.position.set(-0.54, -0.18, 0.76);
    this.leftBlush.rotation.y = -0.35;
    this.rightBlush = new THREE.Mesh(blushGeo, blushMat);
    this.rightBlush.position.set(0.54, -0.18, 0.76);
    this.rightBlush.rotation.y = 0.35;
    this.headGroup.add(this.leftBlush, this.rightBlush);

    // --- EYES (normal glossy + happy crescent + starry + heart overlays) ---
    this.eyes = [];
    [-1, 1].forEach((side) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.37, 0.08, 0.79);
      eyeSocket.rotation.y = side * 0.16;

      // Normal big kawaii glossy eye
      const normalEye = new THREE.Group();
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), eyeWhiteMat);
      sclera.scale.set(1.0, 1.12, 0.55);
      normalEye.add(sclera);

      const pupilGroup = new THREE.Group();
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), irisMat);
      iris.scale.set(1.0, 1.12, 0.55);
      iris.position.z = 0.048;
      pupilGroup.add(iris);

      // Twin anime-toy glossy catchlights
      const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), catchlightMat);
      glint1.position.set(-0.055, 0.065, 0.125);
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), catchlightMat);
      glint2.position.set(0.055, -0.05, 0.122);
      pupilGroup.add(glint1, glint2);

      // Starlight sparkle glint inside iris (clean 4-point kawaii sparkle!)
      const starOverlay = new THREE.Group();
      const sBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.02), starEyeMat);
      const sBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.02), starEyeMat);
      starOverlay.add(sBar1, sBar2);
      starOverlay.position.set(0.02, 0.02, 0.132);
      starOverlay.visible = false;
      pupilGroup.add(starOverlay);

      // Heart overlay inside iris
      const heartOverlay = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), heartEyeMat);
      heartOverlay.scale.set(1.15, 0.95, 0.45);
      heartOverlay.position.set(0.02, -0.01, 0.132);
      heartOverlay.visible = false;
      pupilGroup.add(heartOverlay);

      normalEye.add(pupilGroup);
      eyeSocket.add(normalEye);

      // Happy laughing crescent eye (^ ^)
      const happyArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.036, 8, 16, Math.PI),
        irisMat
      );
      happyArc.position.set(0, -0.02, 0.09);
      happyArc.visible = false;
      eyeSocket.add(happyArc);

      // Cute pastel eyebrows
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.028, 0.14, 6, 8),
        hairMat
      );
      brow.rotation.z = Math.PI / 2 - side * 0.14;
      brow.position.set(0, 0.30, 0.04);
      eyeSocket.add(brow);

      this.headGroup.add(eyeSocket);
      this.eyes.push({ eyeSocket, normalEye, pupilGroup, starOverlay, heartOverlay, happyArc, brow, side });
    });

    // --- MOUTH STATES ---
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, -0.29, 0.87);
    this.headGroup.add(this.mouthGroup);

    // 1. Sweet smile curve
    this.smileMouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.028, 8, 16, Math.PI),
      mouthInnerMat
    );
    this.smileMouth.rotation.z = Math.PI;
    this.smileMouth.position.y = 0.05;
    this.mouthGroup.add(this.smileMouth);

    // 2. Open joyful "D" smile / eating mouth with cute pink tongue!
    this.openMouth = new THREE.Group();
    const dShape = new THREE.Shape();
    dShape.moveTo(-0.14, 0.04);
    dShape.lineTo(0.14, 0.04);
    dShape.quadraticCurveTo(0.14, -0.14, 0, -0.14);
    dShape.quadraticCurveTo(-0.14, -0.14, -0.14, 0.04);
    const dMouthMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(dShape, { depth: 0.04, bevelEnabled: false, curveSegments: 10 }),
      mouthInnerMat
    );
    dMouthMesh.position.z = -0.01;
    const tongueMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffa8c2, roughness: 0.35 })
    );
    tongueMesh.scale.set(1.15, 0.65, 0.45);
    tongueMesh.position.set(0, -0.075, 0.032);
    this.openMouth.add(dMouthMesh, tongueMesh);
    this.openMouth.visible = false;
    this.mouthGroup.add(this.openMouth);

    // 3. Cute "O" amazed / blowing mouth
    this.oMouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.032, 8, 16),
      mouthInnerMat
    );
    this.oMouth.visible = false;
    this.mouthGroup.add(this.oMouth);

    // --- PASTEL STRAWBERRY-MILK HAIR & TWIN BUNS ---
    // Back hair dome
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(1.02, 24, 20), hairMat);
    hairBack.position.set(0, 0.08, -0.14);
    hairBack.scale.set(1.06, 1.02, 1.0);
    hairBack.castShadow = true;
    this.headGroup.add(hairBack);

    // Fluffy swept bangs across forehead
    const bangGeo = new THREE.SphereGeometry(0.32, 14, 12);
    const bangPositions = [
      [-0.64, 0.54, 0.62, 1.0, 1.25, 0.72, 0.25],
      [-0.32, 0.68, 0.74, 1.05, 1.05, 0.65, 0.12],
      [0.0, 0.72, 0.78, 1.15, 0.95, 0.62, 0],
      [0.32, 0.68, 0.74, 1.05, 1.05, 0.65, -0.12],
      [0.64, 0.54, 0.62, 1.0, 1.25, 0.72, -0.25]
    ];
    bangPositions.forEach(([x, y, z, sx, sy, sz, rz]) => {
      const b = new THREE.Mesh(bangGeo, hairMat);
      b.position.set(x, y, z);
      b.scale.set(sx, sy, sz);
      b.rotation.z = rz;
      this.headGroup.add(b);
    });

    // Side hair locks framing cheeks
    const lockGeo = new THREE.CapsuleGeometry(0.18, 0.52, 8, 10);
    [-1, 1].forEach((side) => {
      const lock = new THREE.Mesh(lockGeo, hairMat);
      lock.position.set(side * 0.92, -0.25, 0.26);
      lock.rotation.z = side * 0.16;
      this.headGroup.add(lock);
    });

    // Twin big glossy pastel hair buns (odango) with berry ribbons!
    this.buns = [];
    const bunGeo = new THREE.SphereGeometry(0.44, 18, 16);
    const berryOrnMat = new THREE.MeshStandardMaterial({ color: 0xff456e, roughness: 0.22 });
    const leafOrnMat = new THREE.MeshStandardMaterial({ color: 0x7be0a0, roughness: 0.35 });
    [-1, 1].forEach((side) => {
      const bunGroup = new THREE.Group();
      bunGroup.position.set(side * 0.92, 0.78, -0.05);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.castShadow = true;
      bunGroup.add(bun);

      // Ribbon ring around bun base
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.065, 8, 18), ribbonMat);
      ring.rotation.y = Math.PI / 2;
      ring.rotation.x = side * 0.5;
      ring.position.set(-side * 0.2, -0.15, 0.15);
      bunGroup.add(ring);

      // Cute tiny toy strawberry hairclip!
      const clip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 10), berryOrnMat);
      clip.rotation.z = Math.PI - side * 0.4;
      clip.position.set(-side * 0.18, -0.04, 0.34);
      bunGroup.add(clip);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), leafOrnMat);
      leaf.scale.set(1.4, 0.5, 1.4);
      leaf.position.set(-side * 0.22, 0.04, 0.34);
      bunGroup.add(leaf);

      this.headGroup.add(bunGroup);
      this.buns.push(bunGroup);
    });

    // Cute mini tilted pastel patissiere chef hat!
    this.chefHat = new THREE.Group();
    this.chefHat.position.set(0, 1.0, 0.06);
    this.chefHat.rotation.z = -0.08;
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.24, 20), apronMat);
    const hatRibbon = new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.485, 0.08, 20), ribbonMat);
    hatRibbon.position.y = -0.06;
    this.chefHat.add(hatBand, hatRibbon);

    // Puffy cloud-like chef toque crown
    const puffGeo = new THREE.SphereGeometry(0.32, 14, 12);
    const puffCenter = new THREE.Mesh(new THREE.SphereGeometry(0.39, 16, 14), apronMat);
    puffCenter.position.set(0, 0.32, 0);
    this.chefHat.add(puffCenter);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(puffGeo, apronMat);
      p.position.set(Math.cos(a) * 0.28, 0.25, Math.sin(a) * 0.28);
      this.chefHat.add(p);
    }
    this.headGroup.add(this.chefHat);

    // --- BIG EXPRESSIVE TOY ARMS & MITTEN HANDS ---
    this.leftArm = this._buildArm(-1, dressMat, apronMat, skinMat);
    this.rightArm = this._buildArm(1, dressMat, apronMat, skinMat);
    this.bodyGroup.add(this.leftArm, this.rightArm);
  }

  _buildArm(side, sleeveMat, cuffMat, skinMat) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.72, 1.48, 0.12);

    // Puffy pastel puff-sleeve
    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), sleeveMat);
    arm.add(sleeve);

    // Forearm capsule
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.42, 8, 12), skinMat);
    fore.position.set(side * 0.24, -0.32, 0.38);
    fore.rotation.x = 0.85;
    fore.rotation.z = -side * 0.35;
    arm.add(fore);

    // Cute lace cuff
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 8, 14), cuffMat);
    cuff.position.set(side * 0.14, -0.18, 0.2);
    cuff.rotation.x = 0.85;
    arm.add(cuff);

    // Big chunky rounded kawaii toy hand + thumb!
    const hand = new THREE.Group();
    hand.position.set(side * 0.38, -0.52, 0.68);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
    palm.scale.set(1.05, 0.9, 1.12);
    palm.castShadow = true;
    hand.add(palm);

    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), skinMat);
    thumb.position.set(-side * 0.16, 0.04, 0.08);
    hand.add(thumb);
    arm.add(hand);

    arm.userData.side = side;
    arm.userData.basePos = arm.position.clone();
    return arm;
  }

  // Gentle idle demo hand (only shown once after 9s inactivity — soft pastel mitten hand)
  _buildHelperHand() {
    this.helperHand = new THREE.Group();
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9
    });
    const cuffMat = new THREE.MeshStandardMaterial({
      color: 0xffb3cf,
      roughness: 0.35,
      transparent: true,
      opacity: 0.9
    });

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), gloveMat);
    palm.scale.set(1.0, 0.72, 1.15);
    this.helperHand.add(palm);

    // Index finger pointing gently
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 6, 10), gloveMat);
    finger.rotation.x = Math.PI / 2;
    finger.position.set(-0.07, -0.02, -0.28);
    this.helperHand.add(finger);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.15, 6, 8), gloveMat);
    thumb.rotation.z = 0.85;
    thumb.rotation.x = 0.4;
    thumb.position.set(-0.22, -0.02, 0.02);
    this.helperHand.add(thumb);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), cuffMat);
    cuff.position.set(0, 0, 0.26);
    this.helperHand.add(cuff);

    this.helperHand.visible = false;
    this.helperHand.rotation.x = 0.35;
    this.scene.add(this.helperHand);

    this.hintState = {
      active: false,
      t: 0,
      duration: 1.9,
      from: new THREE.Vector3(),
      to: new THREE.Vector3()
    };
  }

  playIdleHint(fromPos, toPos) {
    this.hintState.active = true;
    this.hintState.t = 0;
    this.hintState.from.copy(fromPos);
    this.hintState.to.copy(toPos);
    this.helperHand.visible = true;
  }

  cancelIdleHint() {
    this.hintState.active = false;
    this.helperHand.visible = false;
  }

  setLookTarget(vec3) {
    this.lookTarget.copy(vec3);
  }

  setMood(mood, duration = 1.6) {
    this.mood = mood;
    this.moodTimer = duration;
    if (mood === 'happy' || mood === 'cheer' || mood === 'heart') {
      this.bounceAmp = 0.24;
      this.clapTimer = duration;
    } else if (mood === 'amazed') {
      this.bounceAmp = 0.14;
    } else if (mood === 'eat') {
      this.eatTimer = duration;
      this.bounceAmp = 0.18;
    } else if (mood === 'blow') {
      this.blowTimer = duration;
    } else if (mood === 'giggle') {
      this.bounceAmp = 0.2;
    }
  }

  dabNoseCream() {
    this.noseCream.visible = true;
    this.noseCreamTimer = 3.2;
    this.setMood('giggle', 2.0);
  }

  getMouthWorldPos(out = new THREE.Vector3()) {
    return this.mouthGroup.getWorldPosition(out);
  }

  update(dt, time) {
    // Decay temporary moods back to eager/cheerful
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && this.mood !== 'cheer') {
        this.mood = 'eager';
      }
    }
    if (this.clapTimer > 0) this.clapTimer -= dt;
    if (this.eatTimer > 0) this.eatTimer -= dt;
    if (this.blowTimer > 0) this.blowTimer -= dt;
    if (this.noseCreamTimer > 0) {
      this.noseCreamTimer -= dt;
      if (this.noseCreamTimer <= 0) this.noseCream.visible = false;
    }

    this.bounceAmp = Math.max(0, this.bounceAmp - dt * 0.42);

    // Lively breathing + happy bounce
    const idleBob = Math.sin(time * 2.4) * 0.045;
    const happyBounce = Math.abs(Math.sin(time * 9.5)) * this.bounceAmp;
    this.bodyGroup.position.y = idleBob + happyBounce;

    // Smooth look-at head tilt + pupil tracking
    this.smoothLook.lerp(this.lookTarget, Math.min(1, dt * 6));
    const dx = this.smoothLook.x - this.root.position.x;
    const dy = this.smoothLook.y - (this.root.position.y + 2.7);
    const dz = Math.max(1.2, this.smoothLook.z - this.root.position.z);

    const targetYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz) * 0.42, -0.34, 0.34);
    const targetPitch = THREE.MathUtils.clamp(-Math.atan2(dy, dz) * 0.32, -0.18, 0.28);
    const cuteTilt = Math.sin(time * 1.45) * 0.065 + (this.mood === 'giggle' ? Math.sin(time * 14) * 0.1 : 0);

    this.headGroup.rotation.y += (targetYaw - this.headGroup.rotation.y) * Math.min(1, dt * 7);
    this.headGroup.rotation.x += (targetPitch - this.headGroup.rotation.x) * Math.min(1, dt * 7);
    this.headGroup.rotation.z += (cuteTilt - this.headGroup.rotation.z) * Math.min(1, dt * 7);

    // Lean forward slightly when blowing or eating!
    const targetZ = (this.blowTimer > 0 || this.eatTimer > 0) ? 0.35 : 0.08;
    this.headGroup.position.z += (targetZ - this.headGroup.position.z) * Math.min(1, dt * 6);

    // Springy hair buns & chef hat wiggle
    this.chefHat.rotation.z = -0.08 + Math.sin(time * 3.1) * 0.045 + this.bounceAmp * 0.3;
    this.buns.forEach((b, idx) => {
      const s = 1 + Math.sin(time * 6 + idx) * (0.015 + this.bounceAmp * 0.18);
      b.scale.set(s, 2 - s, s);
    });

    // Natural eye blink
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkProgress += dt * 11;
      if (this.blinkProgress >= Math.PI) {
        this.blinkProgress = 0;
        this.blinkTimer = 2.4 + Math.random() * 2.6;
      }
    }
    const blinkScaleY = 1 - Math.sin(this.blinkProgress) * 0.9;

    // Update eyes & expressions
    const isHappyArc = this.mood === 'happy' || this.mood === 'giggle' || (this.eatTimer > 0 && Math.sin(time * 14) > 0);
    const isStarry = this.mood === 'amazed' || this.mood === 'cheer';
    const isHeart = this.mood === 'heart';

    for (const e of this.eyes) {
      e.normalEye.visible = !isHappyArc;
      e.happyArc.visible = isHappyArc;
      e.normalEye.scale.y = blinkScaleY;
      e.starOverlay.visible = isStarry;
      e.heartOverlay.visible = isHeart;
      if (isStarry) e.starOverlay.rotation.z = time * 4;

      // Subtle pupil tracking toward lookTarget
      const px = THREE.MathUtils.clamp(dx * 0.018, -0.045, 0.045);
      const py = THREE.MathUtils.clamp(dy * 0.016, -0.035, 0.035);
      e.pupilGroup.position.set(px, py, 0);
    }

    // Rosy cheeks puff up when blowing or extra happy!
    const cheekScale = this.blowTimer > 0 ? 1.42 : (this.mood === 'heart' || this.mood === 'eat' ? 1.25 : 1.0);
    this.leftBlush.scale.set(1.25 * cheekScale, 0.72 * cheekScale, 0.35 * cheekScale);
    this.rightBlush.scale.set(1.25 * cheekScale, 0.72 * cheekScale, 0.35 * cheekScale);
    this.blushMat.opacity = (this.mood === 'heart' || this.mood === 'eat' || this.mood === 'giggle') ? 0.85 : 0.6;

    // Mouth animation
    const chewing = this.eatTimer > 0;
    const blowing = this.blowTimer > 0;
    this.smileMouth.visible = !chewing && !blowing && (this.mood === 'eager' || this.mood === 'happy');
    this.oMouth.visible = blowing || this.mood === 'amazed';
    this.openMouth.visible = chewing || this.mood === 'cheer' || this.mood === 'heart' || this.mood === 'giggle';
    if (chewing) {
      const chomp = 0.55 + Math.abs(Math.sin(time * 15)) * 0.75;
      this.openMouth.scale.set(1.15, chomp, 0.45);
    } else if (this.openMouth.visible) {
      this.openMouth.scale.set(1.2, 0.95, 0.45);
    }

    // Expressive Arms: clapping / waving / cheering / resting eagerly!
    const cheering = this.mood === 'cheer' || this.clapTimer > 0;
    [this.leftArm, this.rightArm].forEach((arm) => {
      const s = arm.userData.side;
      if (cheering) {
        arm.rotation.z = s * (0.65 + Math.sin(time * 15) * 0.25);
        arm.rotation.x = -0.35 + Math.cos(time * 15) * 0.15;
        arm.rotation.y = -s * (0.25 + Math.abs(Math.sin(time * 15)) * 0.28);
      } else if (this.mood === 'eat' || this.mood === 'heart') {
        // Hands raised happily near cheeks!
        arm.rotation.z = s * 0.45;
        arm.rotation.x = -0.5 + Math.sin(time * 8) * 0.1;
        arm.rotation.y = -s * 0.35;
      } else if (this.mood === 'blow') {
        arm.rotation.z = s * 0.18;
        arm.rotation.x = 0.15;
        arm.rotation.y = 0;
      } else {
        // Eager playful sway resting near table
        arm.rotation.z = s * (0.08 + Math.sin(time * 2.4 + s) * 0.06);
        arm.rotation.x = Math.sin(time * 2.0 + s) * 0.07;
        arm.rotation.y = 0;
      }
    });

    // Gentle single-pass idle demo hand
    if (this.hintState.active) {
      this.hintState.t += dt / this.hintState.duration;
      const u = this.hintState.t;
      if (u >= 1) {
        this.cancelIdleHint();
      } else {
        // Smooth ease-in-out arc from tool to cake
        const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        this.helperHand.position.lerpVectors(this.hintState.from, this.hintState.to, ease);
        this.helperHand.position.y += Math.sin(ease * Math.PI) * 0.65 + 0.35;
        const alpha = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
        this.helperHand.scale.setScalar(0.85 + alpha * 0.22);
      }
    }
  }
}
