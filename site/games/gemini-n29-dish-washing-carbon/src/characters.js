// Large, Expressive, Lifelike 3D Characters & Foreground Player Hand:
// 1. HelperGirl: Warm, close-up upper-body 3D girl across the sunlit open kitchen counter.
//    Expresses the story wordlessly through eye-tracking, big smiles, eating big treats,
//    clapping, giggling at popped bubbles, and opening wide ("Aaan!") during the Strawberry Cake Party!
// 2. PlayerHand: Large articulated 3D foreground hand extending naturally from bottom edge
//    (forearm extends off-screen bottom so cut end is never visible), holding & squeezing the sponge,
//    pressing soap pumps, flicking the faucet, lifting clean dishes, and serving strawberries.

import * as THREE from 'three';

function createIrisTexture() {
  // Dedicated front-facing eye decal texture mapped cleanly on an eye disc + glossy cornea dome!
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Warm natural sclera with soft edge shading
  const sclGrad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  sclGrad.addColorStop(0, '#ffffff');
  sclGrad.addColorStop(0.78, '#faf6f2');
  sclGrad.addColorStop(1, '#dfd4cc');
  ctx.fillStyle = sclGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Rich warm hazel-chestnut iris
  const cx = 128, cy = 128, ir = 76;
  const irisGrad = ctx.createRadialGradient(cx, cy - 10, 14, cx, cy, ir);
  irisGrad.addColorStop(0, '#3a1f10');
  irisGrad.addColorStop(0.48, '#7d4925');
  irisGrad.addColorStop(0.82, '#593218');
  irisGrad.addColorStop(1, '#241208');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, ir, 0, Math.PI * 2);
  ctx.fill();

  // Amber lower-iris bounce glow (lifelike warmth!)
  const bounce = ctx.createRadialGradient(cx, cy + 28, 4, cx, cy + 24, 44);
  bounce.addColorStop(0, 'rgba(238, 168, 92, 0.55)');
  bounce.addColorStop(1, 'rgba(238, 168, 92, 0)');
  ctx.fillStyle = bounce;
  ctx.beginPath();
  ctx.arc(cx, cy, ir - 4, 0, Math.PI * 2);
  ctx.fill();

  // Fine radial iris fibers
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(235,175,110,0.24)' : 'rgba(30,14,6,0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28);
    ctx.lineTo(cx + Math.cos(a) * (ir - 5), cy + Math.sin(a) * (ir - 5));
    ctx.stroke();
  }

  // Deep velvety pupil
  ctx.fillStyle = '#100805';
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  ctx.fill();

  // Crisp sunlit kitchen window catchlights!
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.beginPath();
  ctx.arc(cx - 24, cy - 26, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,248,235,0.88)';
  ctx.beginPath();
  ctx.arc(cx + 24, cy + 24, 8.5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class HelperGirl {
  constructor(scene, textures) {
    this.root = new THREE.Group();
    this.basePos = new THREE.Vector3(0.46, -0.34, -1.76);
    this.root.position.copy(this.basePos);
    scene.add(this.root);

    this.mood = 'smile'; // 'smile' | 'yummy' | 'ooh' | 'oops' | 'sparkle' | 'giggle' | 'aaan'
    this.moodTimer = 0;
    this.clapTimer = 0;
    this.chewTimer = 0;
    this.blinkTimer = 2.4;
    this.blinkAmount = 0;
    this.lookTarget = new THREE.Vector3(0, -0.2, 0.3);

    this.irisTex = createIrisTexture();
    this._buildCharacter(textures);
  }

  _buildCharacter(textures) {
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xfac8ad,
      roughness: 0.44,
      metalness: 0.0,
      sheen: 0.42,
      sheenColor: new THREE.Color(0xffb094),
      clearcoat: 0.08,
      envMapIntensity: 0.48,
    });

    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xff7b88,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    const hairMat = new THREE.MeshPhysicalMaterial({
      color: 0x452819,
      roughness: 0.36,
      metalness: 0.03,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      sheen: 0.45,
      sheenColor: new THREE.Color(0x875438),
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0xfffaf2,
      roughness: 0.78,
    });

    const apronMat = new THREE.MeshStandardMaterial({
      map: textures.apronMap,
      roughness: 0.68,
    });

    const scrunchieMat = new THREE.MeshStandardMaterial({
      color: 0xe83454,
      roughness: 0.42,
    });

    // Upper Torso & Shoulders
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.68, 0);
    this.root.add(this.torso);

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.50, 12, 20), shirtMat);
    chest.scale.set(1.20, 1.0, 0.78);
    chest.castShadow = true;
    this.torso.add(chest);

    // Peter-pan rounded collar
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.036, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    );
    collar.rotation.x = Math.PI * 0.5 + 0.15;
    collar.position.set(0, 0.39, 0.06);
    this.torso.add(collar);

    // Woven Linen Kitchen Apron Bib + Straps + Pocket
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.56, 0.06), apronMat);
    bib.position.set(0, -0.02, 0.27);
    this.torso.add(bib);

    [-0.19, 0.19].forEach((sx) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.36, 0.26), apronMat);
      strap.position.set(sx, 0.30, 0.16);
      strap.rotation.x = -0.45;
      this.torso.add(strap);
    });

    // Cute 3D strawberry brooch on apron (zero text!)
    const pin = new THREE.Mesh(
      new THREE.ConeGeometry(0.048, 0.075, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xe62948, roughness: 0.18, clearcoat: 0.8 })
    );
    pin.rotation.x = Math.PI;
    pin.position.set(0, 0.08, 0.31);
    this.torso.add(pin);
    const pinLeaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x34a249, roughness: 0.45 })
    );
    pinLeaf.scale.set(1.6, 0.45, 0.6);
    pinLeaf.position.set(0, 0.12, 0.31);
    this.torso.add(pinLeaf);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.22, 16), skinMat);
    neck.position.set(0, 0.48, 0.02);
    this.torso.add(neck);

    // Large Expressive Head (diameter ~0.82 units — warm, open, bright rosy skin!)
    this.head = new THREE.Group();
    this.head.position.set(0, 0.90, 0.05);
    this.torso.add(this.head);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.405, 32, 26), skinMat);
    cranium.scale.set(1.0, 1.02, 0.95);
    cranium.castShadow = true;
    this.head.add(cranium);

    // Soft chubby lower-cheek contour (kept clear of eye sockets!)
    [-0.19, 0.19].forEach((cx) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), skinMat);
      puff.position.set(cx, -0.14, 0.185);
      this.head.add(puff);
    });

    // Ears
    [-0.395, 0.395].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), skinMat);
      ear.scale.set(0.52, 0.92, 0.68);
      ear.position.set(ex, -0.03, -0.02);
      this.head.add(ear);
    });

    // Soft sculpted child nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), skinMat);
    nose.scale.set(1.0, 0.80, 0.92);
    nose.position.set(0, -0.052, 0.395);
    this.head.add(nose);

    // Rosy cheeks
    this.cheeks = [];
    [-0.225, 0.225].forEach((cx) => {
      const ch = new THREE.Mesh(new THREE.CircleGeometry(0.082, 18), cheekMat);
      ch.position.set(cx, -0.105, 0.368);
      ch.rotation.y = cx < 0 ? -0.42 : 0.42;
      this.head.add(ch);
      this.cheeks.push(ch);
    });

    // Lifelike Planar-Iris + Wet Cornea Dome Eyes (positioned cleanly in front of cranium at z=0.376!)
    this.eyes = [];
    this.eyelids = [];
    this.brows = [];

    const irisMat = new THREE.MeshBasicMaterial({ map: this.irisTex });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.01,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      envMapIntensity: 2.2,
      depthWrite: false,
    });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x26140c, roughness: 0.45 });

    [-0.146, 0.146].forEach((ex, idx) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(ex, 0.032, 0.376);
      eyeSocket.rotation.y = idx === 0 ? -0.18 : 0.18;
      this.head.add(eyeSocket);

      const eyePivot = new THREE.Group();
      eyeSocket.add(eyePivot);

      // Crisp forward-facing iris & sclera disc
      const irisDisc = new THREE.Mesh(new THREE.CircleGeometry(0.078, 24), irisMat);
      eyePivot.add(irisDisc);

      // Curved wet cornea dome for real 3D specular reflections
      const cornea = new THREE.Mesh(
        new THREE.SphereGeometry(0.079, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
        corneaMat
      );
      cornea.rotation.x = Math.PI * 0.5;
      cornea.scale.z = 0.38;
      eyePivot.add(cornea);

      this.eyes.push(eyePivot);

      // Upper eyelid crescent for blinking & happy squinting
      const lid = new THREE.Mesh(
        new THREE.CircleGeometry(0.083, 20, 0, Math.PI),
        skinMat
      );
      lid.position.set(0, 0.082, 0.018);
      lid.scale.set(1.04, 0.01, 1);
      eyeSocket.add(lid);
      this.eyelids.push(lid);

      // Upper eyelash arch
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(0.078, 0.010, 8, 18, Math.PI * 0.88),
        lashMat
      );
      lash.position.set(0, 0.004, 0.014);
      lash.rotation.z = Math.PI * 0.06;
      eyeSocket.add(lash);

      // Expressive eyebrow well above eye
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.095, 6, 8), lashMat);
      brow.rotation.z = Math.PI * 0.5 + (idx === 0 ? 0.08 : -0.08);
      brow.position.set(ex, 0.155, 0.365);
      this.head.add(brow);
      this.brows.push(brow);
    });

    // Expressive 3D Mouth
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, -0.175, 0.368);
    this.head.add(this.mouthGroup);

    const lipSmileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.092, 0.024, -0.008),
      new THREE.Vector3(-0.042, -0.014, 0.014),
      new THREE.Vector3(0.042, -0.014, 0.014),
      new THREE.Vector3(0.092, 0.024, -0.008),
    ]);
    this.smileLips = new THREE.Mesh(
      new THREE.TubeGeometry(lipSmileCurve, 14, 0.013, 8, false),
      new THREE.MeshStandardMaterial({ color: 0xe05868, roughness: 0.35 })
    );
    this.mouthGroup.add(this.smileLips);

    this.openMouth = new THREE.Group();
    this.openMouth.visible = false;
    this.mouthGroup.add(this.openMouth);

    const cavity = new THREE.Mesh(
      new THREE.CircleGeometry(0.078, 20),
      new THREE.MeshBasicMaterial({ color: 0x731d2b })
    );
    this.openMouth.add(cavity);

    const tongue = new THREE.Mesh(
      new THREE.CircleGeometry(0.050, 14),
      new THREE.MeshBasicMaterial({ color: 0xf77e8e })
    );
    tongue.position.set(0, -0.022, 0.003);
    this.openMouth.add(tongue);

    // Cute tiny dab of whipped cream on her cheek during Dish 1!
    this.creamDab = new THREE.Mesh(
      new THREE.SphereGeometry(0.030, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfffef9, roughness: 0.22 })
    );
    this.creamDab.scale.set(1.1, 0.85, 0.55);
    this.creamDab.position.set(0.175, -0.155, 0.368);
    this.head.add(this.creamDab);

    // FIXED Hair Cap: Tilted BACKWARD (+0.62 rad) so her entire face & forehead stay 100% open & bright!
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.422, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairBack.position.set(0, 0.04, -0.035);
    hairBack.rotation.x = -0.62; // Wait: verify! At theta=0 vertex is (0, +r, 0). Rotating around +X by -0.62 moves (0, +r, 0) to (0, r*cos, -r*sin) -> BACKWARD (-Z)! YES!!
    // WAIT: Let's double check right-hand rule around +X!
    // In Three.js right-handed coords (+X right, +Y up, +Z toward viewer):
    // Thumb along +X (right): fingers curl from +Y TOWARD +Z!
    // So positive rotation.x (+0.62) moves +Y toward +Z (FORWARD onto face!),
    // while NEGATIVE rotation.x (-0.68) moves +Y toward -Z (BACKWARD behind head)!!
    // Let's verify our previous bug: earlier we had thetaLength = 0.62*PI (>90°!) and rotation.x = -0.18,
    // so the front rim was at 0.62*180° - 10° = 101° from top (below eye level!).
    // With thetaLength = 0.50 * Math.PI (90°) AND rotation.x = -0.58 (-33°), the front rim of hairBack
    // sits at 90° - 33° = 57° from top -> y = r*cos(57°) = +0.23 (high on forehead, well above brows at y=0.155)!
    hairBack.geometry.dispose();
    hairBack.geometry = new THREE.SphereGeometry(0.424, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.49);
    hairBack.rotation.x = -0.56;
    hairBack.position.set(0, 0.03, -0.02);
    this.head.add(hairBack);

    // Side hair locks framing temples softly beside ears
    [-0.36, 0.36].forEach((sx) => {
      const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 8, 10), hairMat);
      sideLock.position.set(sx, 0.04, 0.14);
      sideLock.rotation.z = sx < 0 ? 0.18 : -0.18;
      sideLock.rotation.x = 0.15;
      this.head.add(sideLock);
    });

    // Soft sculpted bangs high on forehead (y = 0.27..0.31, NEVER touching eyebrows at y = 0.155!)
    [-0.22, -0.11, 0.0, 0.11, 0.22].forEach((bx, i) => {
      const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.12, 8, 10), hairMat);
      bang.scale.set(1.05, 1.0, 0.46);
      bang.position.set(bx, 0.295 - (i === 2 ? 0.01 : 0), 0.315 - bx * bx * 0.55);
      bang.rotation.z = -bx * 0.55;
      bang.rotation.x = -0.32;
      this.head.add(bang);
    });

    // Cute Red Polka-Dot / Strawberry Hairband + Twin Side Buns!
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.415, 0.026, 10, 28, Math.PI * 1.15),
      scrunchieMat
    );
    band.rotation.z = -Math.PI * 0.075;
    band.rotation.x = -0.22;
    band.position.set(0, 0.05, -0.01);
    this.head.add(band);

    [-0.43, 0.43].forEach((hx) => {
      const dir = Math.sign(hx);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 14), hairMat);
      bun.position.set(hx, 0.20, -0.06);
      this.head.add(bun);

      const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.038, 10, 18), scrunchieMat);
      scrunchie.position.set(hx * 0.83, 0.18, -0.05);
      scrunchie.rotation.y = dir * 1.15;
      this.head.add(scrunchie);
    });

    // Articulated Arms & Expressive Hands
    this.leftArm = this._createArm(skinMat, shirtMat, -1);
    this.leftArm.position.set(-0.42, 0.24, 0.06);
    this.torso.add(this.leftArm);

    this.rightArm = this._createArm(skinMat, shirtMat, 1);
    this.rightArm.position.set(0.42, 0.24, 0.06);
    this.torso.add(this.rightArm);

    this.handTreat = new THREE.Group();
    this.handTreat.position.set(-0.08, -0.48, 0.26);
    this.rightArm.add(this.handTreat);
    this._populateIntroStrawberryBite();
  }

  _createArm(skinMat, shirtMat, side) {
    const arm = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.28, 8, 12), shirtMat);
    sleeve.position.set(0, -0.16, 0.05);
    arm.add(sleeve);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.22, 8, 12), skinMat);
    forearm.position.set(-side * 0.04, -0.36, 0.14);
    forearm.rotation.x = -0.55;
    forearm.rotation.z = side * 0.22;
    arm.add(forearm);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.096, 14, 12), skinMat);
    palm.scale.set(0.95, 1.08, 0.65);
    palm.position.set(-side * 0.08, -0.48, 0.24);
    arm.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.06, 6, 8), skinMat);
    thumb.position.set(-side * 0.14, -0.46, 0.27);
    thumb.rotation.z = side * 0.6;
    arm.add(thumb);

    return arm;
  }

  _populateIntroStrawberryBite() {
    const forkSilver = new THREE.MeshStandardMaterial({ color: 0xeef3f8, metalness: 0.95, roughness: 0.08 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.26, 10), forkSilver);
    handle.rotation.z = 0.85;
    this.handTreat.add(handle);

    const berry = new THREE.Mesh(
      new THREE.ConeGeometry(0.095, 0.16, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xe82542, roughness: 0.12, clearcoat: 0.95 })
    );
    berry.position.set(-0.11, 0.10, 0);
    berry.rotation.z = 0.4;
    this.handTreat.add(berry);

    const cream = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfffef9, roughness: 0.22 })
    );
    cream.position.set(-0.08, 0.05, 0.03);
    this.handTreat.add(cream);
  }

  adaptLayout(aspect) {
    if (aspect < 0.86) {
      this.basePos.set(0.26, -0.24, -1.72);
      this.root.scale.setScalar(1.04);
    } else {
      this.basePos.set(0.46, -0.34, -1.76);
      this.root.scale.setScalar(1.0);
    }
    this.root.position.copy(this.basePos);
  }

  setMood(mood, duration = 1.8) {
    this.mood = mood;
    this.moodTimer = duration;
    if (mood === 'sparkle') this.clapTimer = duration;
    if (mood === 'yummy') this.chewTimer = duration;
  }

  getMouthWorldPos(out = new THREE.Vector3()) {
    return this.mouthGroup.getWorldPosition(out);
  }

  update(dt, elapsed, focusPoint, introEatTimer = 0) {
    if (focusPoint) {
      this.lookTarget.lerp(focusPoint, Math.min(1, dt * 6));
    }

    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && this.mood !== 'aaan') {
        this.mood = 'smile';
      }
    }
    if (this.clapTimer > 0) this.clapTimer = Math.max(0, this.clapTimer - dt);
    if (this.chewTimer > 0) this.chewTimer = Math.max(0, this.chewTimer - dt);

    this.handTreat.visible = introEatTimer > 0;
    this.creamDab.visible = introEatTimer > -4;

    // Natural blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAmount = 1.0;
      this.blinkTimer = 2.6 + Math.random() * 2.8;
    }
    this.blinkAmount = Math.max(0, this.blinkAmount - dt * 9.5);

    const sway = this.mood === 'sparkle' || this.mood === 'giggle'
      ? Math.sin(elapsed * 8.5) * 0.05
      : Math.sin(elapsed * 2.2) * 0.018;
    this.torso.rotation.z = sway;
    this.torso.position.y = 0.68 + Math.sin(elapsed * 3.2) * 0.014
      + (this.clapTimer > 0 ? Math.abs(Math.sin(elapsed * 11)) * 0.038 : 0);

    // Head & Eye gaze tracking
    const headWorld = new THREE.Vector3();
    this.head.getWorldPosition(headWorld);
    const dx = THREE.MathUtils.clamp((this.lookTarget.x - headWorld.x) * 0.14, -0.28, 0.28);
    const dy = THREE.MathUtils.clamp((this.lookTarget.y - headWorld.y) * 0.10 + 0.10, -0.18, 0.20);
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, dx, Math.min(1, dt * 6));
    this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, -dy * 0.45 + 0.10, Math.min(1, dt * 6));
    this.head.rotation.z = sway * 1.1;

    this.eyes.forEach((eyePivot) => {
      eyePivot.position.x = dx * 0.035;
      eyePivot.position.y = dy * 0.025;
    });

    // Smooth upper eyelid drop for blink & happy smile squint
    const happySquint = (this.mood === 'yummy' || this.mood === 'giggle') ? 0.55 : 0.0;
    const lidClose = Math.max(this.blinkAmount, happySquint);
    this.eyelids.forEach((lid) => {
      lid.scale.y = Math.max(0.01, lidClose * 1.95);
      lid.position.y = 0.082 - lidClose * 0.075;
    });

    const browLift = (this.mood === 'ooh' || this.mood === 'sparkle' || this.mood === 'aaan') ? 0.038
      : (this.mood === 'oops' ? -0.012 : 0.0);
    this.brows.forEach((brow, idx) => {
      brow.position.y = 0.155 + browLift;
      const tilt = this.mood === 'oops' ? (idx === 0 ? 0.26 : -0.26) : (idx === 0 ? 0.08 : -0.08);
      brow.rotation.z = Math.PI * 0.5 + tilt;
    });

    // Mouth expressions
    const isOpenMouth = this.mood === 'ooh' || this.mood === 'sparkle' || this.mood === 'aaan' || this.mood === 'oops' || this.chewTimer > 0;
    this.openMouth.visible = isOpenMouth;
    this.smileLips.visible = !isOpenMouth;

    if (this.mood === 'aaan') {
      this.openMouth.scale.set(1.22, 1.32 + Math.sin(elapsed * 8) * 0.08, 1);
    } else if (this.chewTimer > 0) {
      const munch = 0.35 + Math.abs(Math.sin(elapsed * 14)) * 0.52;
      this.openMouth.scale.set(0.85, munch, 1);
    } else if (this.mood === 'ooh') {
      this.openMouth.scale.set(0.68, 0.85, 1);
    } else if (this.mood === 'oops') {
      this.openMouth.scale.set(0.55, 0.48, 1);
    } else if (this.mood === 'sparkle') {
      this.openMouth.scale.set(1.12, 1.02, 1);
    }

    const blush = (this.mood === 'sparkle' || this.mood === 'yummy' || this.mood === 'giggle') ? 0.48 : 0.28;
    this.cheeks.forEach((c) => { c.material.opacity = blush; });

    // Arm poses
    if (introEatTimer > 0) {
      this.rightArm.rotation.x = -1.22 + Math.sin(elapsed * 9) * 0.08;
      this.rightArm.rotation.z = 0.40;
      this.leftArm.rotation.x = -0.35;
      this.leftArm.rotation.z = -0.15;
    } else if (this.clapTimer > 0) {
      const clap = Math.abs(Math.sin(elapsed * 15));
      this.leftArm.rotation.x = -1.05;
      this.rightArm.rotation.x = -1.05;
      this.leftArm.rotation.z = -0.42 + clap * 0.32;
      this.rightArm.rotation.z = 0.42 - clap * 0.32;
    } else if (this.mood === 'ooh' || this.mood === 'giggle') {
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -1.10, Math.min(1, dt * 8));
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -1.10, Math.min(1, dt * 8));
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -0.34, Math.min(1, dt * 8));
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0.34, Math.min(1, dt * 8));
    } else {
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -0.48, Math.min(1, dt * 6));
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.48, Math.min(1, dt * 6));
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -0.12, Math.min(1, dt * 6));
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0.12, Math.min(1, dt * 6));
    }
  }
}

/**
 * Large Foreground 3D Player Hand:
 * Forearm slopes downward toward the bottom-right screen edge so you ALWAYS see
 * the top/side of the hand, wrist, thumb & 5 fingers cleanly — NEVER a severed cylinder end!
 */
export class PlayerHand {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.restPos = new THREE.Vector3(1.18, 0.16, 1.48);
    this.targetPos = this.restPos.clone();
    this.currentPos = this.restPos.clone();
    this.gripAmount = 0.20;
    this.targetGrip = 0.20;
    this.pressPulse = 0;
    this.pointMode = false;

    this._buildHand();
  }

  _buildHand() {
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7c3a5,
      roughness: 0.42,
      metalness: 0.0,
      sheen: 0.38,
      sheenColor: new THREE.Color(0xffad90),
      clearcoat: 0.10,
      envMapIntensity: 0.55,
    });

    const nailMat = new THREE.MeshPhysicalMaterial({
      color: 0xffece8,
      roughness: 0.16,
      clearcoat: 0.9,
    });

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0xfef4ee,
      roughness: 0.72,
    });

    this.wristPivot = new THREE.Group();
    // Angled downward at the wrist (+X pitch tilts fingers slightly down into sink, forearm goes DOWN & back off-screen!)
    this.wristPivot.rotation.set(-0.28, 0.34, -0.12);
    this.root.add(this.wristPivot);

    // Sculpted back-of-hand / palm
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 16), skinMat);
    palm.scale.set(1.04, 0.48, 1.16);
    palm.castShadow = true;
    this.wristPivot.add(palm);

    // Long forearm + cozy rolled-up sweater sleeve extending DOWNWARD (-Y, +Z) below bottom of viewport!
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.132, 0.95, 10, 14), skinMat);
    forearm.position.set(0.12, -0.44, 0.48);
    forearm.lookAt(0.24, -1.25, 1.25);
    forearm.rotateX(Math.PI * 0.5);
    this.wristPivot.add(forearm);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.156, 0.85, 10, 14), sleeveMat);
    sleeve.position.set(0.16, -0.68, 0.72);
    sleeve.lookAt(0.28, -1.48, 1.48);
    sleeve.rotateX(Math.PI * 0.5);
    this.wristPivot.add(sleeve);

    // 4 Articulated Fingers (Index, Middle, Ring, Little)
    this.fingers = [];
    const specs = [
      { x: -0.128, z: -0.19, len: 0.19, r: 0.042 },
      { x: -0.042, z: -0.21, len: 0.21, r: 0.044 },
      { x: 0.046, z: -0.20, len: 0.195, r: 0.042 },
      { x: 0.126, z: -0.16, len: 0.155, r: 0.038 },
    ];
    specs.forEach((sp) => {
      const knuckle = new THREE.Group();
      knuckle.position.set(sp.x, 0.01, sp.z);
      this.wristPivot.add(knuckle);

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r, sp.len * 0.55, 8, 10), skinMat);
      seg1.rotation.x = Math.PI * 0.5;
      seg1.position.z = -sp.len * 0.32;
      seg1.castShadow = true;
      knuckle.add(seg1);

      const tipJoint = new THREE.Group();
      tipJoint.position.z = -sp.len * 0.62;
      knuckle.add(tipJoint);

      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r * 0.9, sp.len * 0.42, 8, 10), skinMat);
      seg2.rotation.x = Math.PI * 0.5;
      seg2.position.z = -sp.len * 0.24;
      seg2.castShadow = true;
      tipJoint.add(seg2);

      const nail = new THREE.Mesh(new THREE.SphereGeometry(sp.r * 0.68, 8, 6), nailMat);
      nail.scale.set(0.95, 0.26, 1.15);
      nail.position.set(0, sp.r * 0.78, -sp.len * 0.36);
      tipJoint.add(nail);

      this.fingers.push({ knuckle, tipJoint });
    });

    // Articulated Thumb on inner (-X) side of right hand
    this.thumbJoint = new THREE.Group();
    this.thumbJoint.position.set(-0.185, -0.02, -0.04);
    this.thumbJoint.rotation.y = 0.58;
    this.wristPivot.add(this.thumbJoint);

    const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.15, 8, 10), skinMat);
    thumbMesh.rotation.x = Math.PI * 0.5;
    thumbMesh.position.z = -0.10;
    thumbMesh.castShadow = true;
    this.thumbJoint.add(thumbMesh);
  }

  adaptLayout(aspect) {
    if (aspect < 0.86) {
      this.restPos.set(0.88, 0.14, 1.65);
    } else {
      this.restPos.set(1.18, 0.16, 1.48);
    }
  }

  moveTo(pos, grip = 0.65, pointMode = false) {
    this.targetPos.copy(pos);
    this.targetGrip = grip;
    this.pointMode = pointMode;
  }

  returnToRest() {
    this.targetPos.copy(this.restPos);
    this.targetGrip = 0.20;
    this.pointMode = false;
  }

  pulseSqueeze() {
    this.pressPulse = 1.0;
  }

  update(dt, elapsed) {
    this.currentPos.lerp(this.targetPos, Math.min(1, dt * 16));
    this.gripAmount = THREE.MathUtils.lerp(this.gripAmount, this.targetGrip, Math.min(1, dt * 14));
    if (this.pressPulse > 0) {
      this.pressPulse = Math.max(0, this.pressPulse - dt * 5.5);
    }

    const squeeze = Math.min(1.15, this.gripAmount + Math.sin(this.pressPulse * Math.PI) * 0.42);
    this.root.position.copy(this.currentPos);
    this.root.position.y -= Math.sin(this.pressPulse * Math.PI) * 0.07;
    this.root.position.y += Math.sin(elapsed * 2.4) * 0.010;

    // Subtle dynamic wrist turn toward reach side
    this.wristPivot.rotation.y = THREE.MathUtils.lerp(
      this.wristPivot.rotation.y,
      THREE.MathUtils.clamp((0.4 - this.currentPos.x) * 0.18, -0.25, 0.52),
      Math.min(1, dt * 10)
    );

    this.fingers.forEach((f, idx) => {
      const curl = (this.pointMode && idx === 0) ? 0.10 : squeeze;
      f.knuckle.rotation.x = -curl * 0.72;
      f.tipJoint.rotation.x = -curl * 0.68;
    });

    this.thumbJoint.rotation.x = -squeeze * 0.45;
    this.thumbJoint.rotation.z = -squeeze * 0.32;
  }
}
