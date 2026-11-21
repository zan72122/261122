import * as THREE from 'three';

const CUSTOMER_PROFILES = [
  {
    name: 'ichigo_ribbon_girl',
    skin: 0xffe0c8,
    hair: 0x3b2316,
    outfit: 0xff4768,
    trim: 0xfff5f7,
    accent: 0xff2248,
    hairStyle: 'twin_buns_ribbon',
  },
  {
    name: 'straw_hat_boy',
    skin: 0xfad4b6,
    hair: 0x2c1b12,
    outfit: 0x2ca2f5,
    trim: 0xffffff,
    accent: 0xf4c44e,
    hairStyle: 'straw_hat',
  },
  {
    name: 'asagao_yukata_girl',
    skin: 0xffe4d1,
    hair: 0x241822,
    outfit: 0x3f54b5,
    trim: 0xff82a9,
    accent: 0x9b5de5,
    hairStyle: 'yukata_flowers',
  },
  {
    name: 'sunflower_bob_girl',
    skin: 0xfcd9bf,
    hair: 0x56321b,
    outfit: 0xffbe1e,
    trim: 0xfff9e6,
    accent: 0x25c45a,
    hairStyle: 'bob_sunflower',
  },
  {
    name: 'matsuri_happi_kid',
    skin: 0xf9d1ab,
    hair: 0x2a1c17,
    outfit: 0xf25c3c,
    trim: 0xffe394,
    accent: 0x16b8c4,
    hairStyle: 'spiky_festival',
  },
];

// Large Crafted Miniature Stop-Motion Doll Customer right across the wooden counter!
export class CustomerManager {
  constructor(textures) {
    this.textures = textures;
    this.group = new THREE.Group();
    this.homePos = new THREE.Vector3(0.72, 0.0, -0.22);
    this.group.position.copy(this.homePos);

    this.customerIndex = 0;
    this.state = 'waiting';
    this.stateTimer = 0;
    this.reactionKind = 'happy';
    this.lookTarget = new THREE.Vector3(-0.08, 1.3, 1.54);
    this.blinkTimer = 2.4;

    this._buildCharacterRig();
    this.applyProfile(0);
  }

  _buildCharacterRig() {
    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0c8, roughness: 0.48 });
    this.outfitMat = new THREE.MeshStandardMaterial({ color: 0xff4768, roughness: 0.56 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    this.hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2316, roughness: 0.44 });
    this.accentMat = new THREE.MeshStandardMaterial({ color: 0xff2248, roughness: 0.34 });

    // Rounded Stop-Motion Doll Torso + Soft Rounded Shoulders
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.40, 0.68, 12, 20), this.outfitMat);
    torso.position.y = 1.24;
    torso.castShadow = true;
    this.bodyRoot.add(torso);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.068, 12, 24), this.trimMat);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.05, 1.05, 0.55);
    collar.position.y = 1.66;
    this.bodyRoot.add(collar);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.22, 14), this.skinMat);
    neck.position.y = 1.84;
    this.bodyRoot.add(neck);

    // LARGE Expressive Crafted Doll Head (completely clear & unobstructed!)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.28, 0.06);
    this.bodyRoot.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.45, 28, 22);
    headGeo.scale(1.05, 0.98, 0.95);
    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    const earGeo = new THREE.SphereGeometry(0.095, 12, 10);
    const earL = new THREE.Mesh(earGeo, this.skinMat);
    earL.position.set(-0.46, -0.02, 0.02);
    const earR = new THREE.Mesh(earGeo, this.skinMat);
    earR.position.set(0.46, -0.02, 0.02);
    this.headGroup.add(earL, earR);

    // Cute tiny button nose in warm skin tone
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), this.skinMat);
    nose.position.set(0, -0.03, 0.435);
    this.headGroup.add(nose);

    // Rosy porcelain cheeks
    this.cheekMat = new THREE.MeshStandardMaterial({
      color: 0xff738e,
      roughness: 0.52,
      transparent: true,
      opacity: 0.65,
    });
    const cheekGeo = new THREE.SphereGeometry(0.095, 12, 10);
    cheekGeo.scale(1.25, 0.80, 0.32);
    this.cheekL = new THREE.Mesh(cheekGeo, this.cheekMat);
    this.cheekL.position.set(-0.26, -0.09, 0.39);
    this.cheekL.rotation.y = -0.35;
    this.cheekR = new THREE.Mesh(cheekGeo, this.cheekMat);
    this.cheekR.position.set(0.26, -0.09, 0.39);
    this.cheekR.rotation.y = 0.35;
    this.headGroup.add(this.cheekL, this.cheekR);

    // Glossy Stop-Motion Eyes with dual catchlights
    this.eyeL = this._makeEye();
    this.eyeL.position.set(-0.17, 0.045, 0.405);
    this.eyeR = this._makeEye();
    this.eyeR.position.set(0.17, 0.045, 0.405);
    this.headGroup.add(this.eyeL, this.eyeR);

    // Happy arched crescent smile-eyes
    const smileEyeMat = new THREE.MeshStandardMaterial({ color: 0x261510, roughness: 0.4 });
    const smileArcGeo = new THREE.TorusGeometry(0.076, 0.018, 8, 14, Math.PI);
    this.happyEyeL = new THREE.Mesh(smileArcGeo, smileEyeMat);
    this.happyEyeL.position.set(-0.17, 0.035, 0.425);
    this.happyEyeL.visible = false;
    this.happyEyeR = new THREE.Mesh(smileArcGeo, smileEyeMat);
    this.happyEyeR.position.set(0.17, 0.035, 0.425);
    this.happyEyeR.visible = false;
    this.headGroup.add(this.happyEyeL, this.happyEyeR);

    // Sweet gentle arched eyebrows
    const browGeo = new THREE.TorusGeometry(0.085, 0.014, 8, 12, Math.PI * 0.65);
    this.browL = new THREE.Mesh(browGeo, this.hairMat);
    this.browL.rotation.z = Math.PI * 0.18;
    this.browL.position.set(-0.175, 0.13, 0.405);
    this.browR = new THREE.Mesh(browGeo, this.hairMat);
    this.browR.rotation.z = Math.PI * 0.17;
    this.browR.position.set(0.175, 0.13, 0.405);
    this.headGroup.add(this.browL, this.browR);

    // 3D Mouth
    const mouthArcGeo = new THREE.TorusGeometry(0.072, 0.018, 8, 16, Math.PI);
    const mouthLineMat = new THREE.MeshStandardMaterial({ color: 0xb8283e, roughness: 0.42 });
    this.mouthSmile = new THREE.Mesh(mouthArcGeo, mouthLineMat);
    this.mouthSmile.rotation.z = Math.PI;
    this.mouthSmile.position.set(0, -0.145, 0.425);
    this.headGroup.add(this.mouthSmile);

    this.mouthOpen = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xc9223b, roughness: 0.42 })
    );
    this.mouthOpen.scale.set(1.05, 0.85, 0.45);
    this.mouthOpen.position.set(0, -0.17, 0.41);
    this.mouthOpen.visible = false;
    this.headGroup.add(this.mouthOpen);

    this.hairContainer = new THREE.Group();
    this.headGroup.add(this.hairContainer);

    // Seamless Rounded Arms & Plump Hands resting naturally on the counter!
    this.armL = this._makeArm(-1);
    this.armR = this._makeArm(1);
    this.bodyRoot.add(this.armL.pivot, this.armR.pivot);

    this.customerCollider = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 2.35, 1.35),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.customerCollider.position.set(0, 1.65, 0.35);
    this.customerCollider.userData.hitRole = 'customer';
    this.bodyRoot.add(this.customerCollider);
  }

  _makeEye() {
    const g = new THREE.Group();
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.074, 14, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x1c110d, roughness: 0.06, clearcoat: 1.0 })
    );
    iris.scale.set(1, 1.12, 0.55);
    g.add(iris);

    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), glintMat);
    glint1.position.set(-0.022, 0.026, 0.042);
    const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), glintMat);
    glint2.position.set(0.022, -0.020, 0.042);
    g.add(glint1, glint2);
    return g;
  }

  _makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.40, 1.56, 0.06);

    // Continuous curved sleeve -> forearm -> plump hand (no flat open cylinder caps!)
    const puffShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), this.outfitMat);
    puffShoulder.castShadow = true;
    pivot.add(puffShoulder);

    const armCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.08, -0.36, 0.22),
      new THREE.Vector3(-side * 0.04, -0.68, 0.56)
    );
    const sleeveCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.06, -0.18, 0.10),
      new THREE.Vector3(side * 0.04, -0.34, 0.22)
    );
    const sleeveTube = new THREE.Mesh(new THREE.TubeGeometry(sleeveCurve, 8, 0.135, 12, false), this.outfitMat);
    sleeveTube.castShadow = true;
    pivot.add(sleeveTube);

    const armTube = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.088, 12, false), this.skinMat);
    armTube.castShadow = true;
    pivot.add(armTube);

    const hand = new THREE.Group();
    hand.position.set(-side * 0.04, -0.68, 0.58);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 12), this.skinMat);
    palm.scale.set(1.08, 0.72, 1.22);
    palm.castShadow = true;
    hand.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.065, 6, 8), this.skinMat);
    thumb.position.set(-side * 0.09, 0.02, 0.02);
    thumb.rotation.z = side * 0.6;
    hand.add(thumb);

    pivot.add(hand);
    return { pivot, hand };
  }

  applyProfile(index) {
    const p = CUSTOMER_PROFILES[index % CUSTOMER_PROFILES.length];
    this.skinMat.color.setHex(p.skin);
    this.hairMat.color.setHex(p.hair);
    this.outfitMat.color.setHex(p.outfit);
    this.trimMat.color.setHex(p.trim);
    this.accentMat.color.setHex(p.accent);

    while (this.hairContainer.children.length > 0) {
      this.hairContainer.remove(this.hairContainer.children[0]);
    }

    // FIXED: Tilt hair cap backward (-0.68 rad) so it covers top & back of head while face is 100% clean & uncovered!
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.478, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      this.hairMat
    );
    cap.rotation.x = -0.68;
    cap.position.set(0, 0.04, -0.02);
    cap.castShadow = true;
    this.hairContainer.add(cap);

    // Cute soft bangs high on the forehead above the eyebrows!
    for (let i = -2; i <= 2; i++) {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), this.hairMat);
      bang.scale.set(0.95, 1.25, 0.48);
      bang.position.set(i * 0.11, 0.30 - Math.abs(i) * 0.012, 0.35 - Math.abs(i) * 0.035);
      bang.rotation.x = -0.28;
      bang.rotation.z = i * -0.12;
      this.hairContainer.add(bang);
    }

    if (p.hairStyle === 'twin_buns_ribbon') {
      for (const s of [-1, 1]) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), this.hairMat);
        bun.position.set(s * 0.42, 0.28, -0.04);
        this.hairContainer.add(bun);

        const bowL = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.17, 10), this.accentMat);
        bowL.rotation.z = Math.PI / 2;
        bowL.position.set(s * 0.32 - 0.06, 0.27, 0.15);
        const bowR = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.17, 10), this.accentMat);
        bowR.rotation.z = -Math.PI / 2;
        bowR.position.set(s * 0.32 + 0.06, 0.27, 0.15);
        this.hairContainer.add(bowL, bowR);
      }
    } else if (p.hairStyle === 'straw_hat') {
      const strawMat = new THREE.MeshStandardMaterial({
        map: this.textures.woodMap,
        color: 0xf4cf76,
        roughness: 0.65,
      });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.045, 26), strawMat);
      brim.position.set(0, 0.35, -0.05);
      brim.rotation.x = -0.22;
      brim.castShadow = true;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.47, 0.28, 22), strawMat);
      crown.position.set(0, 0.49, -0.08);
      crown.rotation.x = -0.22;
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.465, 0.475, 0.065, 22), this.outfitMat);
      ribbon.position.set(0, 0.40, -0.065);
      ribbon.rotation.x = -0.22;
      this.hairContainer.add(brim, crown, ribbon);
    } else if (p.hairStyle === 'yukata_flowers') {
      const upBun = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), this.hairMat);
      upBun.position.set(0, 0.48, -0.12);
      this.hairContainer.add(upBun);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), this.trimMat);
        petal.position.set(-0.42 + Math.cos(a) * 0.065, 0.22 + Math.sin(a) * 0.065, 0.14);
        this.hairContainer.add(petal);
      }
    } else if (p.hairStyle === 'bob_sunflower') {
      for (const s of [-1, 1]) {
        const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.28, 8, 10), this.hairMat);
        sideLock.position.set(s * 0.44, -0.04, 0.02);
        this.hairContainer.add(sideLock);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), this.hairMat);
      center.position.set(0.40, 0.25, 0.20);
      this.hairContainer.add(center);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const ptl = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), this.outfitMat);
        ptl.position.set(0.40 + Math.cos(a) * 0.075, 0.25 + Math.sin(a) * 0.075, 0.19);
        this.hairContainer.add(ptl);
      }
    } else {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.042, 10, 24), this.trimMat);
      band.rotation.x = Math.PI / 2 - 0.22;
      band.position.set(0, 0.28, 0.01);
      this.hairContainer.add(band);
    }
  }

  setResponsivePosition(isPortrait) {
    this.homePos.set(isPortrait ? 0.54 : 0.72, 0.0, -0.20);
    if (this.state !== 'entering' && this.state !== 'leaving') {
      this.group.position.copy(this.homePos);
    }
  }

  getServingTargetWorldPos(out = new THREE.Vector3()) {
    return out.set(this.homePos.x - 0.06, 0.76, 0.62);
  }

  setBeckoning(ready) {
    if (this.state === 'waiting' && ready) {
      this.state = 'beckoning';
    } else if (this.state === 'beckoning' && !ready) {
      this.state = 'waiting';
    }
  }

  beginEating(recipe, bowl, audio, particles, onFinishedServing) {
    this.state = 'eating';
    this.stateTimer = 0;
    this.currentRecipe = recipe;
    this.servedBowl = bowl;
    this.audio = audio;
    this.particles = particles;
    this.onFinishedServing = onFinishedServing;
    this.biteDone = false;
    this.reactionPlayed = false;

    if (recipe.isRainbow) {
      this.reactionKind = 'rainbow';
    } else if (recipe.isMegaMountain) {
      this.reactionKind = 'brainfreeze';
    } else if (recipe.hasStrawberry && recipe.hasMilk) {
      this.reactionKind = 'sweetheart';
    } else {
      this.reactionKind = 'happy';
    }
  }

  triggerBellWave() {
    this.bellWaveTimer = 0.9;
  }

  update(dt, elapsed) {
    const localLook = this.headGroup.worldToLocal(this.lookTarget.clone());
    const yaw = THREE.MathUtils.clamp(localLook.x * 0.24, -0.32, 0.32);
    const pitch = THREE.MathUtils.clamp(-localLook.y * 0.16 + 0.08, -0.18, 0.28);
    this.headGroup.rotation.y += (yaw - this.headGroup.rotation.y) * Math.min(1, dt * 7);
    this.headGroup.rotation.x += (pitch - this.headGroup.rotation.x) * Math.min(1, dt * 7);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) this.blinkTimer = 2.6 + Math.random() * 2.4;
    const isBlinking = this.blinkTimer < 0.11;
    const showHappyArcs =
      (this.state === 'reacting' && !(this.reactionKind === 'brainfreeze' && this.stateTimer < 0.65)) ||
      (this.state === 'eating' && this.stateTimer > 0.85);

    this.eyeL.visible = !showHappyArcs;
    this.eyeR.visible = !showHappyArcs;
    this.happyEyeL.visible = showHappyArcs;
    this.happyEyeR.visible = showHappyArcs;
    if (!showHappyArcs) {
      const sy = isBlinking ? 0.12 : 1.12;
      this.eyeL.scale.y = sy;
      this.eyeR.scale.y = sy;
    }

    let bodyY = 0;
    let bodyLeanX = 0.04;
    let bodySwayZ = Math.sin(elapsed * 2.1) * 0.028;
    let armLX = 0, armLZ = 0, armRX = 0, armRZ = 0;
    this.mouthOpen.visible = false;
    this.mouthSmile.visible = true;
    this.cheekMat.opacity = 0.65;

    if (this.bellWaveTimer > 0) {
      this.bellWaveTimer -= dt;
      armRX = -0.92;
      armRZ = Math.sin(elapsed * 16) * 0.35;
      bodyY = Math.abs(Math.sin(elapsed * 10)) * 0.06;
    }

    if (this.state === 'entering') {
      this.stateTimer += dt;
      const t = Math.min(1, this.stateTimer / 0.55);
      const ease = 1 - Math.pow(1 - t, 3);
      this.group.position.x = this.homePos.x + (1 - ease) * 1.45;
      bodyY = Math.abs(Math.sin(t * Math.PI * 2)) * 0.08 * (1 - t);
      if (t >= 1) {
        this.state = 'waiting';
        this.stateTimer = 0;
      }
    } else if (this.state === 'waiting') {
      bodyY = Math.sin(elapsed * 2.6) * 0.024;
    } else if (this.state === 'beckoning') {
      bodyLeanX = 0.15 + Math.sin(elapsed * 4.5) * 0.03;
      bodyY = Math.abs(Math.sin(elapsed * 4.5)) * 0.045;
      armLX = -0.22;
      armLZ = 0.16;
      armRX = -0.22;
      armRZ = -0.16;
      this.mouthOpen.visible = true;
      this.mouthOpen.scale.set(0.85, 0.58, 0.4);
      this.mouthSmile.visible = false;
    } else if (this.state === 'eating') {
      this.stateTimer += dt;
      bodyLeanX = 0.14;

      if (this.servedBowl) {
        const spoon = this.servedBowl.spoonGroup;
        spoon.visible = true;
        if (this.stateTimer < 0.52) {
          const u = this.stateTimer / 0.52;
          spoon.position.set(
            THREE.MathUtils.lerp(0.42, 0.12, u),
            THREE.MathUtils.lerp(0.22, 0.78, u),
            THREE.MathUtils.lerp(0.20, -0.05, u)
          );
          spoon.rotation.set(THREE.MathUtils.lerp(1.3, 0.35, u), 0.1, -0.2);
          armRX = -0.55 * u;
          this.mouthOpen.visible = true;
          this.mouthOpen.scale.set(1.15, 1.05, 0.48);
          this.mouthSmile.visible = false;
        } else if (this.stateTimer < 1.05) {
          if (!this.biteDone) {
            this.biteDone = true;
            this.servedBowl.takeSpoonBite(1.0);
            this.servedBowl.spoonBiteIce.visible = true;
            this.audio.playSpoonBite();
          }
          const u = (this.stateTimer - 0.52) / 0.53;
          spoon.position.set(0.06, THREE.MathUtils.lerp(0.78, 1.32, u), THREE.MathUtils.lerp(-0.05, -0.62, u));
          spoon.rotation.set(0.95, 0, 0);
          armRX = -0.82;
          armRZ = 0.25;
          this.mouthOpen.visible = u < 0.72;
          this.mouthSmile.visible = u >= 0.72;
          if (u >= 0.72) {
            this.servedBowl.spoonBiteIce.visible = false;
            bodyY = Math.abs(Math.sin(elapsed * 18)) * 0.04;
          }
        } else {
          this.state = 'reacting';
          this.stateTimer = 0;
        }
      }
    } else if (this.state === 'reacting') {
      this.stateTimer += dt;
      if (!this.reactionPlayed) {
        this.reactionPlayed = true;
        this.audio.playReaction(this.reactionKind);

        const headWorld = new THREE.Vector3();
        this.headGroup.getWorldPosition(headWorld);
        if (this.reactionKind === 'brainfreeze') {
          this.particles.spawnBurst(
            headWorld.add(new THREE.Vector3(0, 0.35, 0.2)),
            [new THREE.Color(0xb8f2ff), new THREE.Color(0xffffff), new THREE.Color(0x5cd6ff)],
            24,
            2.2
          );
        } else if (this.reactionKind === 'rainbow') {
          this.particles.spawnBurst(
            headWorld.add(new THREE.Vector3(0, 0.4, 0.2)),
            [
              new THREE.Color(0xff2e55),
              new THREE.Color(0xffbe14),
              new THREE.Color(0x1ce065),
              new THREE.Color(0x1ca8ff),
              new THREE.Color(0xb14cff),
            ],
            36,
            3.2
          );
        } else {
          this.particles.spawnBurst(
            headWorld.add(new THREE.Vector3(0, 0.35, 0.2)),
            [new THREE.Color(0xff5e84), new THREE.Color(0xffe066), new THREE.Color(0xffffff)],
            22,
            2.6
          );
        }
      }

      if (this.reactionKind === 'brainfreeze' && this.stateTimer < 0.65) {
        this.headGroup.position.x = Math.sin(elapsed * 58) * 0.045;
        armLX = -0.95;
        armLZ = -0.32;
        armRX = -0.95;
        armRZ = 0.32;
        this.mouthOpen.visible = true;
        this.mouthOpen.scale.set(0.65, 0.85, 0.45);
        this.mouthSmile.visible = false;
      } else {
        this.headGroup.position.x = 0;
        bodyY = Math.abs(Math.sin(this.stateTimer * 9.5)) * 0.11;
        bodySwayZ = Math.sin(this.stateTimer * 8.0) * 0.09;
        armLX = -0.72 - Math.sin(this.stateTimer * 10) * 0.22;
        armRX = -0.72 + Math.sin(this.stateTimer * 10) * 0.22;
        this.cheekMat.opacity = 0.92;
      }

      if (this.stateTimer >= 1.75) {
        this.state = 'leaving';
        this.stateTimer = 0;
      }
    } else if (this.state === 'leaving') {
      this.stateTimer += dt;
      const t = Math.min(1, this.stateTimer / 0.48);
      this.group.position.x = this.homePos.x - t * 1.65;
      bodyY = Math.abs(Math.sin(t * Math.PI * 2)) * 0.06;
      if (t >= 1) {
        if (this.onFinishedServing) {
          const cb = this.onFinishedServing;
          this.onFinishedServing = null;
          cb(this.reactionKind);
        }
        this.customerIndex = (this.customerIndex + 1) % CUSTOMER_PROFILES.length;
        this.applyProfile(this.customerIndex);
        this.group.position.x = this.homePos.x + 1.45;
        this.state = 'entering';
        this.stateTimer = 0;
      }
    }

    this.bodyRoot.position.y = bodyY;
    this.bodyRoot.rotation.x = bodyLeanX;
    this.bodyRoot.rotation.z = bodySwayZ;

    this.armL.pivot.rotation.x += (armLX - this.armL.pivot.rotation.x) * Math.min(1, dt * 11);
    this.armL.pivot.rotation.z += (armLZ - this.armL.pivot.rotation.z) * Math.min(1, dt * 11);
    this.armR.pivot.rotation.x += (armRX - this.armR.pivot.rotation.x) * Math.min(1, dt * 11);
    this.armR.pivot.rotation.z += (armRZ - this.armR.pivot.rotation.z) * Math.min(1, dt * 11);
  }
}

// Large Foreground Miniature Shopkeeper Hands — rests cleanly off-bottom when idle, reaches in big & clear!
export class ShopkeeperHands {
  constructor() {
    this.group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdcc2, roughness: 0.45 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.60 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2274b5, roughness: 0.55 });

    this.rightHand = this._createHand(1, skinMat, cuffMat, stripeMat);
    this.leftHand = this._createHand(-1, skinMat, cuffMat, stripeMat);

    // Parked cleanly behind/below camera view when idle!
    this.rightRest = new THREE.Vector3(1.35, -0.85, 4.65);
    this.leftRest = new THREE.Vector3(-1.35, -0.85, 4.65);

    this.rightTarget = this.rightRest.clone();
    this.leftTarget = this.leftRest.clone();
    this.rightRotTarget = new THREE.Euler(-0.35, 0.15, 0);
    this.leftRotTarget = new THREE.Euler(-0.35, -0.15, 0);

    this.rightHand.position.copy(this.rightRest);
    this.leftHand.position.copy(this.leftRest);
    this.group.add(this.rightHand, this.leftHand);
  }

  _createHand(side, skinMat, cuffMat, stripeMat) {
    const g = new THREE.Group();

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), skinMat);
    palm.scale.set(1.06, 0.68, 1.24);
    palm.castShadow = true;
    g.add(palm);

    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.13, 6, 8), skinMat);
      f.rotation.x = Math.PI / 2 + 0.22;
      f.position.set((i - 1.5) * 0.068, -0.01, -0.17);
      f.castShadow = true;
      g.add(f);
    }

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.11, 6, 8), skinMat);
    thumb.position.set(-side * 0.145, -0.01, -0.05);
    thumb.rotation.set(0.4, side * 0.55, side * 0.45);
    thumb.castShadow = true;
    g.add(thumb);

    // Long natural forearm & sleeve extending above counter toward camera edge so it never clips into the wood!
    const armCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.0, 0.06),
      new THREE.Vector3(side * 0.22, 0.06, 0.62),
      new THREE.Vector3(side * 0.62, 0.12, 1.55)
    );
    const cuffCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * 0.09, 0.02, 0.26),
      new THREE.Vector3(side * 0.26, 0.07, 0.68),
      new THREE.Vector3(side * 0.62, 0.12, 1.55)
    );
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.112, 12, false), skinMat);
    arm.castShadow = true;
    g.add(arm);

    const cuff = new THREE.Mesh(new THREE.TubeGeometry(cuffCurve, 10, 0.148, 14, false), cuffMat);
    g.add(cuff);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.150, 0.018, 8, 16), stripeMat);
    trim.rotation.x = 0.08;
    trim.rotation.y = side * 0.32;
    trim.position.set(side * 0.10, 0.025, 0.27);
    g.add(trim);

    return g;
  }

  poseCranking(knobWorldPos) {
    // Left hand reaches naturally from bottom-left to grip the left-side wheel knob!
    this.leftTarget.copy(knobWorldPos).add(new THREE.Vector3(-0.04, -0.03, 0.22));
    this.leftRotTarget.set(-0.12, -0.22, 0.22);
    this.rightTarget.copy(this.rightRest);
  }

  poseHoldingBottle(bottleWorldPos, side = 1) {
    if (side >= 0) {
      this.rightTarget.copy(bottleWorldPos).add(new THREE.Vector3(0.20, 0.10, 0.14));
      this.rightRotTarget.set(-0.18, 0.42, 0.35);
      this.leftTarget.copy(this.leftRest);
    } else {
      this.leftTarget.copy(bottleWorldPos).add(new THREE.Vector3(-0.20, 0.10, 0.14));
      this.leftRotTarget.set(-0.18, -0.42, -0.35);
      this.rightTarget.copy(this.rightRest);
    }
  }

  posePinchingFruit(fruitWorldPos) {
    this.rightTarget.copy(fruitWorldPos).add(new THREE.Vector3(0.09, 0.11, 0.22));
    this.rightRotTarget.set(-0.45, 0.18, -0.12);
    this.leftTarget.copy(this.leftRest);
  }

  poseServingBowl(bowlWorldPos) {
    this.leftTarget.copy(bowlWorldPos).add(new THREE.Vector3(-0.52, 0.42, 0.28));
    this.rightTarget.copy(bowlWorldPos).add(new THREE.Vector3(0.52, 0.42, 0.28));
    this.leftRotTarget.set(-0.08, -0.36, -0.18);
    this.rightRotTarget.set(-0.08, 0.36, 0.18);
  }

  poseRest() {
    this.rightTarget.copy(this.rightRest);
    this.leftTarget.copy(this.leftRest);
    this.rightRotTarget.set(-0.35, 0.15, 0);
    this.leftRotTarget.set(-0.35, -0.15, 0);
  }

  update(dt) {
    const k = Math.min(1, dt * 14);
    this.rightHand.position.lerp(this.rightTarget, k);
    this.leftHand.position.lerp(this.leftTarget, k);

    this.rightHand.rotation.x += (this.rightRotTarget.x - this.rightHand.rotation.x) * k;
    this.rightHand.rotation.y += (this.rightRotTarget.y - this.rightHand.rotation.y) * k;
    this.rightHand.rotation.z += (this.rightRotTarget.z - this.rightHand.rotation.z) * k;

    this.leftHand.rotation.x += (this.leftRotTarget.x - this.leftHand.rotation.x) * k;
    this.leftHand.rotation.y += (this.leftRotTarget.y - this.leftHand.rotation.y) * k;
    this.leftHand.rotation.z += (this.leftRotTarget.z - this.leftHand.rotation.z) * k;
  }
}
