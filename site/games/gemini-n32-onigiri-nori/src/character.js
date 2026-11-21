import * as THREE from '../vendor/three.module.min.js';
import { createWatercolorMaterial, addPencilOutline } from './materials.js';
import { WatercolorFaceCanvas } from './textures.js';

// Big, warm Japanese picture-book 5-year-old girl character
export class GirlCharacter {
  constructor(assets) {
    this.assets = assets;
    this.group = new THREE.Group();

    this.faceCanvas = new WatercolorFaceCanvas();
    this.expression = 'happy';
    this.expressionTimer = 0;
    this.lookTarget = new THREE.Vector2(0, -0.25);
    this.lookCurrent = new THREE.Vector2(0, -0.25);
    this.blinkTimer = 2.8;
    this.blinkVal = 0;
    this.chewTimer = 0;
    this.bounceEnergy = 0;
    this.cheerTimer = 0;
    this.waveTimer = 0;
    this.sipTimer = 0;
    this.time = 0;

    // Materials
    const skinMat = createWatercolorMaterial({
      color: 0xfde3cc,
      emissive: 0x4a2e1e,
      emissiveIntensity: 0.14
    });
    const hairMat = createWatercolorMaterial({
      map: assets.hairTex,
      emissive: 0x261710,
      emissiveIntensity: 0.14
    });
    const dressMat = createWatercolorMaterial({
      map: assets.dressTex,
      emissive: 0x382018,
      emissiveIntensity: 0.12
    });
    const apronMat = createWatercolorMaterial({
      map: assets.ginghamSmall,
      emissive: 0x351a18,
      emissiveIntensity: 0.12
    });
    const ribbonMat = createWatercolorMaterial({
      color: 0xe35f59,
      emissive: 0x451212,
      emissiveIntensity: 0.15
    });

    // Body pivot for gentle breathing & joyful bounces
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    // Torso (warm cream-apricot sweater + gingham kitchen apron)
    const torsoGeo = new THREE.CylinderGeometry(0.68, 0.96, 1.55, 20);
    const torso = new THREE.Mesh(torsoGeo, dressMat);
    torso.position.set(0, -0.78, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    addPencilOutline(torso, 1.032, 0x5c4337, 0.65);
    this.bodyGroup.add(torso);

    // Apron bib curving smoothly around front of torso (zero clipping!)
    const bibGeo = new THREE.CylinderGeometry(0.73, 1.01, 1.25, 16, 1, true, -0.58, 1.16);
    const bibMat = createWatercolorMaterial({
      map: assets.ginghamSmall,
      emissive: 0x351a18,
      emissiveIntensity: 0.12,
      side: THREE.DoubleSide
    });
    const bib = new THREE.Mesh(bibGeo, bibMat);
    bib.position.set(0, -0.82, 0.02);
    this.bodyGroup.add(bib);

    // Cute apron straps over shoulders
    const strapGeo = new THREE.TorusGeometry(0.32, 0.065, 8, 16, Math.PI);
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(strapGeo, apronMat);
      strap.position.set(side * 0.42, -0.08, 0.15);
      strap.rotation.y = Math.PI / 2;
      this.bodyGroup.add(strap);
    }

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.34, 14), skinMat);
    neck.position.set(0, 0.06, 0.02);
    this.bodyGroup.add(neck);

    // Head Pivot (nods, tilts curiously, looks at food!)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.96, 0.06);
    this.bodyGroup.add(this.headGroup);

    // Big adorable rounded head with dynamic watercolor face texture
    const headGeo = new THREE.SphereGeometry(1.06, 28, 22);
    const faceMat = createWatercolorMaterial({
      color: 0xffffff,
      map: this.faceCanvas.texture,
      emissive: 0x3b2418,
      emissiveIntensity: 0.14
    });
    this.headMesh = new THREE.Mesh(headGeo, faceMat);
    // Rotate so UV u=0.5 (canvas center) faces +Z directly toward the camera!
    this.headMesh.rotation.y = -Math.PI / 2;
    this.headMesh.scale.set(1.04, 0.96, 0.98);
    this.headMesh.castShadow = true;
    addPencilOutline(this.headMesh, 1.03, 0x5c4337, 0.65);
    this.headGroup.add(this.headMesh);

    // Cute ears
    const earGeo = new THREE.SphereGeometry(0.19, 12, 10);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(side * 1.04, -0.04, 0.0);
      ear.scale.set(0.65, 1.0, 0.8);
      addPencilOutline(ear, 1.07, 0x6b4b3d, 0.6);
      this.headGroup.add(ear);
    }

    // Warm chestnut hair cap (back & crown)
    const hairBackGeo = new THREE.SphereGeometry(1.12, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.68);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.position.set(0, 0.08, -0.08);
    hairBack.rotation.x = -0.34;
    addPencilOutline(hairBack, 1.028, 0x452d22, 0.68);
    this.headGroup.add(hairBack);

    // Soft side hair framing cheeks
    const sideLockGeo = new THREE.SphereGeometry(0.32, 12, 10);
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(sideLockGeo, hairMat);
      lock.position.set(side * 0.88, -0.18, 0.36);
      lock.scale.set(0.75, 1.55, 0.78);
      lock.rotation.z = side * 0.16;
      addPencilOutline(lock, 1.045, 0x452d22, 0.6);
      this.headGroup.add(lock);
    }

    // Fluffy picture-book bangs across forehead
    const bangPositions = [
      [-0.56, 0.64, 0.78, 0.34, 0.35],
      [-0.24, 0.74, 0.88, 0.36, 0.12],
      [0.08, 0.75, 0.9, 0.35, -0.06],
      [0.38, 0.7, 0.84, 0.35, -0.22],
      [0.62, 0.58, 0.72, 0.3, -0.38]
    ];
    const bangGeo = new THREE.SphereGeometry(1, 12, 10);
    for (const [bx, by, bz, s, rz] of bangPositions) {
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(bx, by, bz);
      bang.scale.set(s * 0.95, s * 0.72, s * 0.68);
      bang.rotation.z = rz;
      addPencilOutline(bang, 1.05, 0x452d22, 0.55);
      this.headGroup.add(bang);
    }

    // Twin cute hair buns (odango) + coral-red bows!
    const bunGeo = new THREE.SphereGeometry(0.36, 14, 12);
    const bowLoopGeo = new THREE.SphereGeometry(0.15, 10, 8);
    this.buns = [];
    for (const side of [-1, 1]) {
      const bunGroup = new THREE.Group();
      bunGroup.position.set(side * 0.96, 0.76, -0.08);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      addPencilOutline(bun, 1.05, 0x452d22, 0.62);
      bunGroup.add(bun);

      // Cute bow knot + 2 loops
      const bow = new THREE.Group();
      bow.position.set(-side * 0.14, 0.16, 0.24);
      bow.rotation.z = -side * 0.45;
      const b1 = new THREE.Mesh(bowLoopGeo, ribbonMat);
      b1.position.x = -0.11;
      b1.scale.set(1.2, 0.8, 0.6);
      const b2 = new THREE.Mesh(bowLoopGeo, ribbonMat);
      b2.position.x = 0.11;
      b2.scale.set(1.2, 0.8, 0.6);
      addPencilOutline(b1, 1.07, 0x6e2420, 0.55);
      addPencilOutline(b2, 1.07, 0x6e2420, 0.55);
      bow.add(b1, b2);
      bunGroup.add(bow);

      this.buns.push(bunGroup);
      this.headGroup.add(bunGroup);
    }

    // Cozy gingham kitchen headscarf band on top of head
    const scarfGeo = new THREE.TorusGeometry(0.96, 0.15, 10, 24, Math.PI * 1.08);
    const scarf = new THREE.Mesh(scarfGeo, apronMat);
    scarf.position.set(0, 0.22, 0.16);
    scarf.rotation.z = -0.04;
    scarf.rotation.x = -0.22;
    addPencilOutline(scarf, 1.045, 0x6b3a36, 0.58);
    this.headGroup.add(scarf);

    // Expressive Arms (used for cheering, clapping, waving, and picnic snacking!)
    this.leftArm = this._makeArm(dressMat, skinMat, -1);
    this.rightArm = this._makeArm(dressMat, skinMat, 1);
    this.leftArm.position.set(-0.88, -0.34, 0.18);
    this.rightArm.position.set(0.88, -0.34, 0.18);
    this.bodyGroup.add(this.leftArm, this.rightArm);

    // Invisible generous hitbox sphere for playful poking
    const hitGeo = new THREE.SphereGeometry(1.45, 10, 8);
    this.hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.hitMesh.position.set(0, 0.65, 0.15);
    this.hitMesh.userData.interact = 'girl';
    this.group.add(this.hitMesh);
  }

  _makeArm(dressMat, skinMat, side) {
    const pivot = new THREE.Group();
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), dressMat);
    shoulder.position.set(-side * 0.04, 0.0, 0.02);
    addPencilOutline(shoulder, 1.05, 0x5c4337, 0.55);
    pivot.add(shoulder);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.48, 8, 12), dressMat);
    sleeve.position.set(side * 0.1, -0.32, 0.12);
    sleeve.rotation.z = side * 0.22;
    sleeve.rotation.x = -0.35;
    addPencilOutline(sleeve, 1.05, 0x5c4337, 0.6);
    pivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skinMat);
    hand.position.set(side * 0.2, -0.66, 0.34);
    addPencilOutline(hand, 1.06, 0x6b4b3d, 0.6);
    pivot.add(hand);

    return pivot;
  }

  setExpression(expr, duration = 2.0) {
    this.expression = expr;
    this.expressionTimer = duration;
    if (expr === 'cheer' || expr === 'sparkle') {
      this.bounceEnergy = 1.0;
    }
    if (expr === 'cheer') {
      this.cheerTimer = Math.max(this.cheerTimer, 1.45);
    }
    if (expr === 'munch') {
      this.chewTimer = Math.max(duration, 1.2);
    }
  }

  triggerWave() {
    this.waveTimer = 1.3;
    this.bounceEnergy = 0.85;
    this.setExpression('cheer', 1.4);
  }

  triggerSip() {
    this.sipTimer = 1.35;
    this.setExpression('bliss', 1.8);
  }

  lookAtNormalized(nx, ny) {
    this.lookTarget.set(THREE.MathUtils.clamp(nx, -1, 1), THREE.MathUtils.clamp(ny, -1, 1));
  }

  tick(dt) {
    this.time += dt;

    // Expression auto-decay back to warm happy smile
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) {
        this.expression = 'happy';
      }
    }

    // Natural gentle blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkVal = Math.min(1, this.blinkVal + dt * 11);
      if (this.blinkVal >= 1) {
        this.blinkTimer = 2.4 + Math.random() * 2.6;
      }
    } else if (this.blinkVal > 0) {
      this.blinkVal = Math.max(0, this.blinkVal - dt * 10);
    }

    // Smooth eye tracking
    this.lookCurrent.lerp(this.lookTarget, Math.min(1, dt * 6));

    // Chew phase
    let chewPhase = 0;
    if (this.chewTimer > 0) {
      this.chewTimer = Math.max(0, this.chewTimer - dt);
      chewPhase = (this.time * 3.8) % 1;
    } else if (this.expression === 'focus') {
      chewPhase = 0.25;
    }

    // Update Canvas2D watercolor face
    this.faceCanvas.draw({
      expression: this.expression,
      lookX: this.lookCurrent.x,
      lookY: this.lookCurrent.y,
      blink: this.blinkVal,
      chewPhase
    });

    // Gentle living breathing + joyful bounce
    this.bounceEnergy = Math.max(0, this.bounceEnergy - dt * 2.2);
    const hop = Math.sin(this.bounceEnergy * Math.PI * 3) * this.bounceEnergy * 0.22;
    const breath = Math.sin(this.time * 2.3) * 0.035;
    this.bodyGroup.position.y = breath + Math.max(0, hop);

    // Expressive head tilt & follow
    const sourWiggle = this.expression === 'sour' ? Math.sin(this.time * 24) * 0.14 : 0;
    const munchNod = this.chewTimer > 0 ? Math.sin(this.time * 16) * 0.07 : 0;
    const sipTilt = this.sipTimer > 0 ? -0.18 * Math.sin((this.sipTimer / 1.35) * Math.PI) : 0;
    this.headGroup.rotation.y = this.lookCurrent.x * 0.22;
    this.headGroup.rotation.x = 0.08 + this.lookCurrent.y * 0.14 + munchNod + sipTilt;
    this.headGroup.rotation.z =
      Math.sin(this.time * 1.4) * 0.035 - this.lookCurrent.x * 0.07 + sourWiggle;

    // Hair buns bounce adorably with movement!
    for (let i = 0; i < this.buns.length; i++) {
      const side = i === 0 ? -1 : 1;
      this.buns[i].rotation.z = side * (Math.sin(this.time * 2.3) * 0.05 + this.bounceEnergy * 0.2);
    }

    // Arms animation
    if (this.cheerTimer > 0) {
      this.cheerTimer = Math.max(0, this.cheerTimer - dt);
      const flap = Math.sin(this.time * 14) * 0.28;
      this.leftArm.rotation.z = -2.2 + flap;
      this.rightArm.rotation.z = 2.2 - flap;
      this.leftArm.rotation.x = -0.35;
      this.rightArm.rotation.x = -0.35;
    } else if (this.waveTimer > 0) {
      this.waveTimer = Math.max(0, this.waveTimer - dt);
      this.rightArm.rotation.z = 2.3 + Math.sin(this.time * 16) * 0.35;
      this.rightArm.rotation.x = -0.45;
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -0.2, dt * 8);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, dt * 8);
    } else if (this.sipTimer > 0) {
      this.sipTimer = Math.max(0, this.sipTimer - dt);
      const lift = Math.sin((this.sipTimer / 1.35) * Math.PI);
      this.leftArm.rotation.x = -1.2 * lift;
      this.rightArm.rotation.x = -1.2 * lift;
      this.leftArm.rotation.z = 0.45 * lift;
      this.rightArm.rotation.z = -0.45 * lift;
    } else {
      const idleSway = Math.sin(this.time * 2.1) * 0.06;
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -0.18 + idleSway, dt * 7);
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0.18 - idleSway, dt * 7);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -0.12, dt * 7);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.12, dt * 7);
    }
  }
}

// BIG, clear, warm picture-book shaping hands in the foreground ("にぎにぎ"!)
export class BigShapingHands {
  constructor(assets) {
    this.group = new THREE.Group();
    this.mode = 'rest'; // 'rest' | 'cradle' | 'squeeze' | 'proud' | 'nori' | 'hidden'
    this.squeezePulse = 0;
    this.hintPulse = 0;
    this.time = 0;

    const skinMat = createWatercolorMaterial({
      color: 0xfde2ca,
      emissive: 0x4d3020,
      emissiveIntensity: 0.16
    });
    const cuffMat = createWatercolorMaterial({
      map: assets.dressTex,
      emissive: 0x351e16,
      emissiveIntensity: 0.12
    });

    this.leftHand = this._buildHand(skinMat, cuffMat, -1);
    this.rightHand = this._buildHand(skinMat, cuffMat, 1);
    this.group.add(this.leftHand, this.rightHand);
  }

  _buildHand(skinMat, cuffMat, side) {
    const h = new THREE.Group();

    // Soft plump palm (cupped shape!)
    const palmGeo = new THREE.SphereGeometry(0.56, 16, 14);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.scale.set(0.55, 0.96, 1.18);
    palm.castShadow = true;
    addPencilOutline(palm, 1.045, 0x6b4b3c, 0.65);
    h.add(palm);

    // 4 softly curved plump fingers hugging inward
    const fingerGeo = new THREE.CapsuleGeometry(0.125, 0.44, 6, 10);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(fingerGeo, skinMat);
      const t = (i - 1.5) / 1.5; // -1..+1
      f.position.set(-side * 0.14, 0.42 - Math.abs(t) * 0.08, t * 0.34);
      f.rotation.z = side * 0.52;
      f.rotation.x = t * 0.08;
      f.castShadow = true;
      addPencilOutline(f, 1.06, 0x6b4b3c, 0.58);
      h.add(f);
    }

    // Warm plump thumb on the front side
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.34, 6, 10), skinMat);
    thumb.position.set(-side * 0.18, 0.06, 0.62);
    thumb.rotation.x = 0.62;
    thumb.rotation.z = side * 0.38;
    thumb.castShadow = true;
    addPencilOutline(thumb, 1.06, 0x6b4b3c, 0.58);
    h.add(thumb);

    // Cozy wrist + rolled sleeve cuff angled forward toward player (never clips side props!)
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 12), skinMat);
    wrist.position.set(side * 0.08, -0.52, 0.36);
    wrist.rotation.z = side * 0.16;
    wrist.rotation.x = 0.68;
    addPencilOutline(wrist, 1.05, 0x6b4b3c, 0.58);
    h.add(wrist);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.42, 14), cuffMat);
    cuff.position.set(side * 0.15, -0.78, 0.62);
    cuff.rotation.z = side * 0.18;
    cuff.rotation.x = 0.72;
    addPencilOutline(cuff, 1.045, 0x5c4337, 0.6);
    h.add(cuff);

    return h;
  }

  triggerSqueeze() {
    this.squeezePulse = 1.0;
  }

  triggerIdlePat() {
    this.hintPulse = 1.0;
  }

  setMode(mode) {
    this.mode = mode;
  }

  tick(dt) {
    this.time += dt;
    this.squeezePulse = Math.max(0, this.squeezePulse - dt * 3.1);
    this.hintPulse = Math.max(0, this.hintPulse - dt * 1.1);

    const visible = this.mode !== 'hidden';
    this.group.visible = visible;
    if (!visible) return;

    const sq = Math.sin(this.squeezePulse * Math.PI); // 0 -> 1 -> 0 crisp squeeze arc!
    const hint = Math.sin(this.hintPulse * Math.PI * 2) * this.hintPulse * 0.28;
    const gentle = Math.sin(this.time * 2.4) * 0.04;

    let lx = -1.48,
      ly = 0.48,
      lz = 0.35,
      lrz = -0.28,
      lrx = -0.18;
    let rx = 1.48,
      ry = 0.48,
      rz = 0.35,
      rrz = 0.28,
      rrx = -0.18;

    if (this.mode === 'rest') {
      lx = -1.48;
      rx = 1.48;
      ly = 0.34 + gentle;
      ry = 0.34 + gentle;
      lz = 0.42;
      rz = 0.42;
      lrz = -0.4;
      rrz = 0.4;
    } else if (this.mode === 'cradle' || this.mode === 'squeeze') {
      // Cup closely around the warm rice, and dramatically press inward on squeeze!
      const closeIn = sq * 0.48 + Math.max(0, hint);
      lx = -1.28 + closeIn;
      rx = 1.28 - closeIn;
      // Classic Japanese triangle shaping angle: one hand slightly higher cupping apex, one lower supporting base!
      ly = 0.66 + sq * 0.14 + gentle;
      ry = 0.8 + sq * 0.22 + gentle;
      lz = 0.26 - sq * 0.1;
      rz = 0.26 - sq * 0.1;
      lrz = -0.26 - sq * 0.32;
      rrz = 0.32 + sq * 0.34;
      lrx = -0.14 - sq * 0.12;
      rrx = -0.14 - sq * 0.12;
    } else if (this.mode === 'proud') {
      // Open warmly on either side showing off the finished triangle!
      lx = -1.46;
      rx = 1.46;
      ly = 0.56 + gentle * 1.4;
      ry = 0.56 + gentle * 1.4;
      lz = 0.38;
      rz = 0.38;
      lrz = -0.52;
      rrz = 0.52;
    } else if (this.mode === 'nori') {
      lx = -1.42;
      rx = 1.42;
      ly = 0.52 + gentle;
      ry = 0.52 + gentle;
      lz = 0.35;
      rz = 0.35;
      lrz = -0.35;
      rrz = 0.35;
    }

    const k = Math.min(1, dt * 12);
    this.leftHand.position.x = THREE.MathUtils.lerp(this.leftHand.position.x, lx, k);
    this.leftHand.position.y = THREE.MathUtils.lerp(this.leftHand.position.y, ly, k);
    this.leftHand.position.z = THREE.MathUtils.lerp(this.leftHand.position.z, lz, k);
    this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, lrz, k);
    this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, lrx, k);

    this.rightHand.position.x = THREE.MathUtils.lerp(this.rightHand.position.x, rx, k);
    this.rightHand.position.y = THREE.MathUtils.lerp(this.rightHand.position.y, ry, k);
    this.rightHand.position.z = THREE.MathUtils.lerp(this.rightHand.position.z, rz, k);
    this.rightHand.rotation.z = THREE.MathUtils.lerp(this.rightHand.rotation.z, rrz, k);
    this.rightHand.rotation.x = THREE.MathUtils.lerp(this.rightHand.rotation.x, rrx, k);
  }
}
