import * as THREE from '../vendor/three.module.min.js';

// Large, warm, expressive 3D companion girl standing right across the sunlit kitchen counter.
// Communicates curiosity, aroma, excitement, surprise, and delight purely through face, eyes, and hands!
export class CompanionCharacter {
  constructor(scene) {
    this.root = new THREE.Group();
    // Standing naturally BEHIND the oak counter (y = -0.52 so waist sits behind counter top at y = 0!)
    this.root.position.set(-1.58, -0.52, -0.96);
    scene.add(this.root);

    this.targetX = -1.58;
    this.lookTarget = new THREE.Vector3(-1.58, 0.28, 0.32);
    this.currentLook = new THREE.Vector3(-1.58, 0.28, 0.32);

    this.mood = 'curious'; // curious | excited | surprised | sniffing | hungry | blowing | eating
    this.moodTimer = 0;
    this.time = 0;
    this.blinkTimer = 2.6;
    this.blinkAmount = 0;
    this.bounceEnergy = 0;

    // Warm realistic PBR materials
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xf7cbb0,
      roughness: 0.52,
      metalness: 0.0,
    });
    this.cheekMat = new THREE.MeshStandardMaterial({
      color: 0xed8379,
      roughness: 0.6,
      transparent: true,
      opacity: 0.36,
    });
    this.hairMat = new THREE.MeshStandardMaterial({
      color: 0x3f2518,
      roughness: 0.54,
      metalness: 0.06,
    });
    this.shirtMat = new THREE.MeshStandardMaterial({
      color: 0xd97d6a,
      roughness: 0.84,
    });
    this.apronMat = new THREE.MeshStandardMaterial({
      color: 0xf6efe4,
      roughness: 0.88,
    });
    this.lipMat = new THREE.MeshStandardMaterial({
      color: 0xd46762,
      roughness: 0.36,
    });
    this.mouthInsideMat = new THREE.MeshStandardMaterial({
      color: 0x8a3034,
      roughness: 0.65,
    });

    this._buildBody();
    this._buildHead();
    this._buildArms();
  }

  _buildBody() {
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 0, 0);
    this.root.add(this.torsoPivot);

    // Natural tapered shoulders & upper torso rising smoothly behind counter
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.72, 24), this.shirtMat);
    torso.scale.set(1.18, 1.0, 0.74);
    torso.position.set(0, 0.44, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.torsoPivot.add(torso);

    // Smooth rounded shoulder cap
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.275, 22, 16), this.shirtMat);
    shoulders.scale.set(1.22, 0.58, 0.78);
    shoulders.position.set(0, 0.77, 0);
    shoulders.castShadow = true;
    this.torsoPivot.add(shoulders);

    // Soft white collar trim
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.115, 0.022, 10, 22),
      this.apronMat
    );
    collar.rotation.x = Math.PI * 0.5 + 0.15;
    collar.position.set(0, 0.88, 0.03);
    this.torsoPivot.add(collar);

    // Fitted linen chef apron draped cleanly over chest & waist
    const apronBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.305, 0.62, 22, 1, true, -Math.PI * 0.34, Math.PI * 0.68),
      this.apronMat
    );
    apronBody.scale.set(1.18, 1.0, 0.78);
    apronBody.position.set(0, 0.46, 0.015);
    apronBody.castShadow = true;
    this.torsoPivot.add(apronBody);

    // Apron pocket
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.02), this.apronMat);
    pocket.position.set(0, 0.56, 0.232);
    this.torsoPivot.add(pocket);

    // Apron straps curving cleanly over shoulders
    [-0.13, 0.13].forEach((sx) => {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.018, 8, 16, Math.PI * 0.85),
        this.apronMat
      );
      strap.rotation.y = Math.PI * 0.5;
      strap.rotation.z = 0.2;
      strap.position.set(sx, 0.81, 0.05);
      this.torsoPivot.add(strap);
    });

    // Warm sculpted neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.098, 0.18, 18), this.skinMat);
    neck.position.set(0, 0.94, 0.02);
    neck.castShadow = true;
    this.torsoPivot.add(neck);
  }

  _buildHead() {
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.01, 0.03);
    this.torsoPivot.add(this.headPivot);

    // Smooth sculpted natural head (clean gentle egg-ovoid, no lumpy cheek spheres!)
    const headPts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const ang = t * Math.PI;
      const y = 0.25 - Math.cos(ang) * 0.275;
      // Slightly fuller warm cheeks on lower half, soft rounded chin
      const chinSoft = 1 - 0.12 * Math.pow(Math.max(0, Math.cos(ang)), 1.6);
      const r = Math.sin(ang) * 0.268 * chinSoft;
      headPts.push(new THREE.Vector2(r, y));
    }
    const headGeo = new THREE.LatheGeometry(headPts, 32);
    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.scale.set(1.0, 1.0, 0.95);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headPivot.add(headMesh);

    // Subtle flush warm rosy cheeks
    [-0.132, 0.132].forEach((cx) => {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), this.cheekMat);
      blush.position.set(cx, 0.175, 0.214);
      blush.scale.set(1.15, 0.68, 0.18);
      blush.rotation.y = cx < 0 ? -0.45 : 0.45;
      this.headPivot.add(blush);
    });

    // Delicate ears
    [-0.258, 0.258].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.050, 12, 10), this.skinMat);
      ear.scale.set(0.52, 1.02, 0.78);
      ear.position.set(ex, 0.23, -0.01);
      this.headPivot.add(ear);
    });

    // Delicate soft nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 12), this.skinMat);
    nose.scale.set(0.95, 0.78, 1.15);
    nose.position.set(0, 0.21, 0.258);
    this.headPivot.add(nose);

    this._buildHair();
    this._buildFaceFeatures();
  }

  _buildHair() {
    // Smooth chestnut bob haircut — strictly crown ABOVE forehead, back curtain, and side-locks behind cheeks (face 100% open!)
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.286, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.36),
      this.hairMat
    );
    crown.scale.set(1.03, 1.04, 1.03);
    crown.position.set(0, 0.275, -0.015);
    crown.castShadow = true;
    this.headPivot.add(crown);

    // Back hair dome + curtain strictly behind ears & neck (leaving entire +Z face completely open!)
    const backDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.292, 24, 18, Math.PI * 0.92, Math.PI * 1.16, Math.PI * 0.16, Math.PI * 0.62),
      this.hairMat
    );
    backDome.position.set(0, 0.255, -0.025);
    this.headPivot.add(backDome);

    const backHair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.270, 0.298, 0.30, 24, 1, false, Math.PI * 0.42, Math.PI * 1.16),
      this.hairMat
    );
    backHair.position.set(0, 0.145, -0.045);
    backHair.castShadow = true;
    this.headPivot.add(backHair);

    // Soft side framing bob locks cleanly beside ears (bridging seamlessly into crown!)
    [-0.244, 0.244].forEach((sx) => {
      const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.26, 10, 16), this.hairMat);
      sideLock.position.set(sx, 0.20, 0.015);
      sideLock.rotation.z = sx < 0 ? 0.14 : -0.14;
      sideLock.castShadow = true;
      this.headPivot.add(sideLock);

      // Temple bridge tuft so hair silhouette is 100% seamless
      const temple = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), this.hairMat);
      temple.scale.set(0.85, 1.05, 0.92);
      temple.position.set(sx * 0.86, 0.34, 0.10);
      this.headPivot.add(temple);
    });

    // Cute soft parted forehead bangs strictly ABOVE eyebrows (y ~ 0.38..0.48, leaving eyes & brows 100% visible!)
    const bangSpecs = [
      { x: -0.145, y: 0.405, z: 0.190, rz: 0.32, sx: 0.088, sy: 0.072 },
      { x: -0.048, y: 0.422, z: 0.215, rz: 0.10, sx: 0.092, sy: 0.068 },
      { x: 0.056, y: 0.422, z: 0.215, rz: -0.12, sx: 0.092, sy: 0.068 },
      { x: 0.148, y: 0.402, z: 0.188, rz: -0.34, sx: 0.088, sy: 0.072 },
    ];
    for (const b of bangSpecs) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), this.hairMat);
      tuft.scale.set(b.sx, b.sy, 0.055);
      tuft.position.set(b.x, b.y, b.z);
      tuft.rotation.z = b.rz;
      tuft.rotation.x = -0.22;
      this.headPivot.add(tuft);
    }

    // Sweet coral hair clip pinned on her bangs
    const clipMat = new THREE.MeshStandardMaterial({
      color: 0xf27d66,
      roughness: 0.24,
      metalness: 0.12,
    });
    const clip = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.056, 6, 10), clipMat);
    clip.position.set(-0.18, 0.405, 0.195);
    clip.rotation.z = 1.25;
    clip.rotation.y = -0.45;
    this.headPivot.add(clip);
  }

  _buildFaceFeatures() {
    this.eyes = [];
    this.brows = [];
    this.happyEyeArcs = [];

    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xfffdf9, roughness: 0.14 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x3c2315, roughness: 0.08, metalness: 0.06 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0e0805, roughness: 0.05 });
    const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x26150d, roughness: 0.45 });

    [-0.098, 0.098].forEach((ex, idx) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(ex, 0.248, 0.214);
      this.headPivot.add(eyeGroup);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.048, 18, 16), scleraMat);
      sclera.scale.set(1.06, 1.0, 0.82);
      eyeGroup.add(sclera);

      const gazeGroup = new THREE.Group();
      eyeGroup.add(gazeGroup);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 14), irisMat);
      iris.position.set(0, 0, 0.022);
      iris.scale.set(1.0, 1.06, 0.62);
      gazeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 12), pupilMat);
      pupil.position.set(0, 0, 0.036);
      pupil.scale.set(1.0, 1.0, 0.5);
      gazeGroup.add(pupil);

      const catch1 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), catchMat);
      catch1.position.set(-0.011, 0.013, 0.044);
      gazeGroup.add(catch1);

      const catch2 = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 8), catchMat);
      catch2.position.set(0.010, -0.008, 0.044);
      gazeGroup.add(catch2);

      // Upper lash line
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(0.049, 0.006, 8, 16, Math.PI * 0.90),
        lashMat
      );
      lash.position.set(0, 0.005, 0.012);
      lash.rotation.z = 0.16;
      eyeGroup.add(lash);

      // Animated eyelid for natural blinks
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        this.skinMat
      );
      lid.position.set(0, 0.004, 0.003);
      lid.rotation.x = -0.84;
      eyeGroup.add(lid);

      // Joyful curved upward crescent eye (shown during blissful sniffing/eating!)
      const happyArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.040, 0.007, 8, 16, Math.PI * 0.82),
        lashMat
      );
      happyArc.position.set(ex, 0.242, 0.252);
      happyArc.rotation.z = 0.28;
      happyArc.visible = false;
      this.headPivot.add(happyArc);
      this.happyEyeArcs.push(happyArc);

      // Gentle warm arched eyebrow (slightly raised outer arch for friendly joyful look!)
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.052, 6, 10), this.hairMat);
      brow.rotation.z = Math.PI * 0.5 + (idx === 0 ? 0.14 : -0.14);
      brow.position.set(ex, 0.324, 0.234);
      this.headPivot.add(brow);
      this.brows.push(brow);

      this.eyes.push({ group: eyeGroup, gaze: gazeGroup, lid });
    });

    // Expressive animated mouth assembly
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, 0.132, 0.238);
    this.headPivot.add(this.mouthGroup);

    // Warm HAPPY U-shaped smile (arc spans bottom half PI..2*PI!)
    this.smileArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.042, 0.0082, 8, 18, Math.PI * 0.78),
      this.lipMat
    );
    this.smileArc.rotation.z = Math.PI + 0.35; // Wait: torus 0..0.78*PI is upper arch; rotating by PI+0.35 puts arch at BOTTOM (happy U-smile!)
    // Verify: angle a in [0, 0.78*PI] -> after +PI+0.35, angle is [1.11*PI, 1.89*PI] -> sin < 0 -> bottom U-curve!
    this.smileArc.position.y = 0.022;
    this.mouthGroup.add(this.smileArc);

    // Open joyful/surprised/eating mouth cavity + cute rosy tongue
    this.openMouth = new THREE.Group();
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 14), this.mouthInsideMat);
    cavity.scale.set(1.22, 0.90, 0.48);
    this.openMouth.add(cavity);

    const lipRing = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 8, 18), this.lipMat);
    lipRing.scale.set(1.18, 0.86, 0.65);
    lipRing.position.z = 0.011;
    this.openMouth.add(lipRing);

    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe67c7c, roughness: 0.45 })
    );
    tongue.position.set(0, -0.016, 0.009);
    tongue.scale.set(1.1, 0.58, 0.68);
    this.openMouth.add(tongue);

    this.openMouth.visible = false;
    this.mouthGroup.add(this.openMouth);
  }

  _buildArms() {
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.30, 0.74, 0.02);
    this.torsoPivot.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.30, 0.74, 0.02);
    this.torsoPivot.add(this.rightArm);

    // Seamless continuous articulated arm (shoulder -> sleeve -> forearm -> warm hand)
    const buildArm = (armGroup, side) => {
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.060, 0.16, 8, 14), this.shirtMat);
      upper.position.set(side * 0.01, -0.07, 0.06);
      upper.rotation.x = 0.56;
      upper.rotation.z = side * -0.14;
      upper.castShadow = true;
      armGroup.add(upper);

      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.21, 8, 14), this.skinMat);
      fore.position.set(side * 0.005, -0.165, 0.20);
      fore.rotation.x = 1.28;
      fore.castShadow = true;
      armGroup.add(fore);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), this.skinMat);
      hand.scale.set(0.95, 0.68, 1.15);
      hand.position.set(side * 0.0, -0.20, 0.32);
      hand.castShadow = true;
      armGroup.add(hand);
    };

    buildArm(this.leftArm, -1);
    buildArm(this.rightArm, 1);

    // Pair of wooden chopsticks held up when eating!
    this.eatChopsticks = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xbd854e, roughness: 0.52 });
    for (let i = 0; i < 2; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.010, 0.38, 8), stickMat);
      stick.rotation.x = Math.PI * 0.45 + i * 0.07;
      stick.position.set(0.01 + i * 0.012, -0.19, 0.46);
      this.eatChopsticks.add(stick);
    }
    this.eatChopsticks.visible = false;
    this.rightArm.add(this.eatChopsticks);
  }

  setTargetX(x) {
    this.targetX = x;
  }

  setLookTarget(vec3) {
    this.lookTarget.copy(vec3);
  }

  setMood(mood, duration = 2.4) {
    this.mood = mood;
    this.moodTimer = duration;
    if (mood === 'excited' || mood === 'surprised' || mood === 'eating') {
      this.bounceEnergy = 1.0;
    }
  }

  pulseJoy() {
    this.bounceEnergy = Math.min(1.4, this.bounceEnergy + 0.85);
  }

  getMouthWorldPosition(out = new THREE.Vector3()) {
    this.mouthGroup.getWorldPosition(out);
    return out;
  }

  update(dt) {
    this.time += dt;

    // Smooth horizontal step behind counter
    const dx = this.targetX - this.root.position.x;
    this.root.position.x += dx * Math.min(1, dt * 3.6);
    const walkBob = Math.min(1, Math.abs(dx) * 2.5) * Math.abs(Math.sin(this.time * 9.5)) * 0.028;

    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && this.mood !== 'hungry') {
        this.mood = 'curious';
      }
    }

    this.bounceEnergy = Math.max(0, this.bounceEnergy - dt * 2.2);
    const joyBounce = Math.sin(this.time * 12) * 0.032 * this.bounceEnergy;

    const breath = Math.sin(this.time * 2.3) * 0.010;
    this.torsoPivot.position.y = breath + walkBob + Math.abs(joyBounce);

    const leanTarget =
      this.mood === 'sniffing'
        ? 0.16
        : this.mood === 'hungry' || this.mood === 'blowing'
        ? 0.12
        : this.mood === 'excited' || this.mood === 'eating'
        ? 0.09
        : 0.04;
    this.torsoPivot.rotation.x += (leanTarget - this.torsoPivot.rotation.x) * Math.min(1, dt * 5);

    // Smooth gaze tracking with head & eyes
    this.currentLook.lerp(this.lookTarget, Math.min(1, dt * 6.0));
    const headWorld = new THREE.Vector3();
    this.headPivot.getWorldPosition(headWorld);
    const toTarget = this.currentLook.clone().sub(headWorld);

    const yaw = THREE.MathUtils.clamp(Math.atan2(toTarget.x, Math.max(0.35, toTarget.z)), -0.48, 0.48);
    const pitch = THREE.MathUtils.clamp(-Math.atan2(toTarget.y, Math.max(0.65, Math.hypot(toTarget.x, toTarget.z))) - 0.18, -0.18, 0.28);

    const tiltIdle =
      this.mood === 'curious'
        ? Math.sin(this.time * 1.4) * 0.06
        : this.mood === 'eating'
        ? Math.sin(this.time * 7.5) * 0.10
        : this.mood === 'sniffing'
        ? 0.09
        : 0;

    this.headPivot.rotation.y += (yaw * 0.68 - this.headPivot.rotation.y) * Math.min(1, dt * 6.5);
    this.headPivot.rotation.x += (pitch * 0.65 - this.headPivot.rotation.x) * Math.min(1, dt * 6.5);
    this.headPivot.rotation.z += (tiltIdle - this.headPivot.rotation.z) * Math.min(1, dt * 6.5);

    // Natural blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.4 + Math.random() * 2.6;
      this.blinkAmount = 1.0;
    }
    if (this.blinkAmount > 0) {
      this.blinkAmount = Math.max(0, this.blinkAmount - dt * 7.5);
    }

    const useHappyCrescent = this.mood === 'sniffing' || this.mood === 'eating';
    for (let i = 0; i < this.eyes.length; i++) {
      const e = this.eyes[i];
      e.group.visible = !useHappyCrescent;
      this.happyEyeArcs[i].visible = useHappyCrescent;

      e.gaze.rotation.y = THREE.MathUtils.clamp(yaw * 0.40, -0.32, 0.32);
      e.gaze.rotation.x = THREE.MathUtils.clamp(pitch * 0.40, -0.22, 0.28);

      const blinkCurve = Math.sin(this.blinkAmount * Math.PI);
      e.lid.rotation.x = -0.84 + blinkCurve * 0.94;
    }

    const browY =
      this.mood === 'surprised'
        ? 0.340
        : this.mood === 'excited' || this.mood === 'hungry'
        ? 0.330
        : 0.318;
    this.brows.forEach((b) => {
      b.position.y += (browY - b.position.y) * Math.min(1, dt * 9);
    });

    const targetBlush = this.mood === 'eating' || this.mood === 'excited' ? 0.60 : 0.34;
    this.cheekMat.opacity += (targetBlush - this.cheekMat.opacity) * Math.min(1, dt * 5);

    // Mouth expressions
    if (this.mood === 'surprised') {
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      this.openMouth.scale.set(0.82, 1.15, 1);
    } else if (this.mood === 'blowing') {
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      const puff = 0.52 + 0.14 * Math.sin(this.time * 12);
      this.openMouth.scale.set(puff, puff, 1.1);
    } else if (this.mood === 'excited' || this.mood === 'hungry') {
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      this.openMouth.scale.set(1.22, 0.85, 1);
    } else if (this.mood === 'eating') {
      this.smileArc.visible = false;
      this.openMouth.visible = true;
      const chew = 0.55 + 0.45 * Math.abs(Math.sin(this.time * 11));
      this.openMouth.scale.set(1.05, chew * 0.85, 1);
    } else {
      this.smileArc.visible = true;
      this.openMouth.visible = false;
      this.smileArc.scale.set(this.mood === 'sniffing' ? 1.15 : 1.0, 1.0, 1.0);
    }

    // Arms resting naturally near counter edge or clapping joyfully!
    if (this.mood === 'excited' || this.mood === 'eating') {
      const clap = Math.sin(this.time * 14);
      this.leftArm.rotation.x = -0.32 + clap * 0.10;
      this.leftArm.rotation.y = 0.36 + clap * 0.20;
      this.rightArm.rotation.x = -0.32 - clap * 0.10;
      this.rightArm.rotation.y = -0.36 - clap * 0.20;
      this.eatChopsticks.visible = this.mood === 'eating';
    } else if (this.mood === 'surprised') {
      this.leftArm.rotation.x = -0.52;
      this.leftArm.rotation.y = 0.18;
      this.rightArm.rotation.x = -0.52;
      this.rightArm.rotation.y = -0.18;
      this.eatChopsticks.visible = false;
    } else {
      const sway = Math.sin(this.time * 2.0) * 0.035;
      this.leftArm.rotation.x += (-0.08 + sway - this.leftArm.rotation.x) * Math.min(1, dt * 6);
      this.leftArm.rotation.y += (0.14 - this.leftArm.rotation.y) * Math.min(1, dt * 6);
      this.rightArm.rotation.x += (-0.08 - sway - this.rightArm.rotation.x) * Math.min(1, dt * 6);
      this.rightArm.rotation.y += (-0.14 - this.rightArm.rotation.y) * Math.min(1, dt * 6);
      this.eatChopsticks.visible = false;
    }
  }
}
