import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { makeSoft3DMaterial, addPencilOutline } from './materials.js';

// Large, expressive 5-year-old girl seated right across the warm wooden kitchen counter.
// Pure anime-film watercolor-friendly 3D sculpt + high-resolution curved anime face canvas.

export class ChefGirl {
  constructor(kerchiefTex) {
    this.group = new THREE.Group();
    this.basePos = new THREE.Vector3(0, -0.06, -1.18);
    this.group.position.copy(this.basePos);

    this.emotion = 'expectant';
    this.emotionTimer = 0;
    this.time = 0;
    this.blinkTimer = 2.2;
    this.blinkProgress = 0;
    this.lookTarget = new THREE.Vector3(0, 0.5, 0.48);
    this.smoothLook = new THREE.Vector2(0, -0.12);
    this.bounceAmt = 0;
    this.chewPhase = 0;

    // 512x512 <= 1024px crisp hand-painted anime face canvas
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 512;
    this.faceCanvas.height = 512;
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.lastFaceKey = '';

    this._buildBody(kerchiefTex);
    this._drawFace(0, -0.1, false);
  }

  _buildBody(kerchiefTex) {
    const skinMat = makeSoft3DMaterial({
      color: 0xffe6d2,
      roughness: 0.68,
      emissive: 0x7d371e,
      emissiveIntensity: 0.16
    });
    const hairMat = makeSoft3DMaterial({
      color: 0x6e3f2b,
      roughness: 0.56,
      emissive: 0x2e140a,
      emissiveIntensity: 0.14
    });
    const blouseMat = makeSoft3DMaterial({
      color: 0xfffaf2,
      roughness: 0.74,
      emissive: 0x422b18,
      emissiveIntensity: 0.08
    });
    const apronMat = makeSoft3DMaterial({
      color: 0xffd678,
      roughness: 0.68,
      emissive: 0x522e08,
      emissiveIntensity: 0.10
    });
    const buttonMat = makeSoft3DMaterial({
      color: 0xe36255,
      roughness: 0.45
    });
    const kerchiefMat = makeSoft3DMaterial({
      color: 0xffffff,
      map: kerchiefTex,
      roughness: 0.64,
      emissive: 0x42120e,
      emissiveIntensity: 0.10
    });

    // Upper torso
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.34, 0);
    this.group.add(this.torsoGroup);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.56, 14, 24), blouseMat);
    torso.scale.set(1.12, 1.0, 0.72);
    torso.position.set(0, 0.18, 0);
    addPencilOutline(torso, 0.02, 0x6b4433, 0.45);
    this.torsoGroup.add(torso);

    // Sunny pinafore apron front bib + shoulder straps + cute pocket
    const bib = new THREE.Mesh(
      new RoundedBoxGeometry(0.68, 0.64, 0.16, 3, 0.06),
      apronMat
    );
    bib.position.set(0, 0.15, 0.30);
    this.torsoGroup.add(bib);

    [-1, 1].forEach((side) => {
      const strap = new THREE.Mesh(
        new RoundedBoxGeometry(0.13, 0.42, 0.14, 2, 0.04),
        apronMat
      );
      strap.position.set(side * 0.24, 0.52, 0.24);
      strap.rotation.z = side * -0.14;
      strap.rotation.x = -0.28;
      this.torsoGroup.add(strap);

      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 14), buttonMat);
      btn.rotation.x = Math.PI * 0.5;
      btn.position.set(side * 0.23, 0.39, 0.38);
      this.torsoGroup.add(btn);

      // Soft puff sleeves on outer shoulders
      const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), blouseMat);
      sleeve.scale.set(1.0, 0.95, 0.92);
      sleeve.position.set(side * 0.58, 0.46, 0.04);
      addPencilOutline(sleeve, 0.024, 0x6b4433, 0.42);
      this.torsoGroup.add(sleeve);
    });

    // Cute Peter-Pan rounded collar around neck
    const collarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.055, 10, 24, Math.PI * 0.88),
      blouseMat
    );
    collarRing.rotation.set(Math.PI * 0.55, 0, Math.PI * 0.06);
    collarRing.position.set(0, 0.63, 0.08);
    this.torsoGroup.add(collarRing);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.28, 16), skinMat);
    neck.position.set(0, 0.74, 0.02);
    this.torsoGroup.add(neck);

    // Graceful little arms & hands
    this.leftArm = this._createArm(-1, skinMat);
    this.rightArm = this._createArm(1, skinMat);
    this.torsoGroup.add(this.leftArm);
    this.torsoGroup.add(this.rightArm);

    // LARGE expressive 3D head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.38, 0.06);
    this.torsoGroup.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.68, 36, 28);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.scale.set(1.05, 0.97, 0.90);
    headMesh.userData.hitKind = 'girl';
    addPencilOutline(headMesh, 0.02, 0x683f2d, 0.52);
    this.headGroup.add(headMesh);

    // Ears & subtle tiny anime nose highlight bump
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), skinMat);
      ear.scale.set(0.55, 0.92, 0.72);
      ear.position.set(side * 0.69, -0.04, 0.02);
      ear.raycast = () => {};
      addPencilOutline(ear, 0.028, 0x683f2d, 0.45);
      this.headGroup.add(ear);
    });

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), skinMat);
    nose.scale.set(0.9, 0.8, 1.15);
    nose.position.set(0, -0.06, 0.625);
    nose.raycast = () => {};
    this.headGroup.add(nose);

    // Curved front anime face patch!
    // In Three.js SphereGeometry, phi = PI/2 points directly along +Z (toward camera)!
    const facePatchGeo = new THREE.SphereGeometry(
      0.692,
      32,
      24,
      Math.PI * 0.5 - 0.78,
      1.56,
      Math.PI * 0.5 - 0.58,
      1.18
    );
    const faceMat = new THREE.MeshBasicMaterial({
      map: this.faceTex,
      transparent: true,
      depthWrite: false
    });
    const faceMesh = new THREE.Mesh(facePatchGeo, faceMat);
    faceMesh.scale.set(1.05, 0.97, 0.905);
    faceMesh.renderOrder = 3;
    faceMesh.raycast = () => {};
    this.headGroup.add(faceMesh);

    // Back-of-head bob hair cap (strictly tilted BACKWARD onto -Z so front face is 100% clear!)
    const hairBackGeo = new THREE.SphereGeometry(0.715, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.scale.set(1.06, 1.02, 0.96);
    // Negative X rotation tips +Y pole toward -Z (back of head)!
    // Wait: let's verify! For (0, R, 0), Rx(a) gives y' = R cos(a), z' = R sin(a).
    // For z' to be NEGATIVE (-Z, back of head), sin(a) must be NEGATIVE => a = -0.68!
    // Wait why did a = -0.24 cover the front earlier? Because thetaLength was 0.68*PI (122 deg!),
    // so 122 deg - 14 deg = 108 deg > 90 deg, reaching down past the equator on the front!
    // With thetaLength = 0.52*PI (93 deg) and a = -0.62 (-35 deg), front edge is at 93 - 35 = 58 deg from top (high forehead only)!
    hairBack.rotation.x = -0.64;
    hairBack.position.set(0, 0.04, -0.05);
    hairBack.raycast = () => {};
    addPencilOutline(hairBack, 0.02, 0x3d2014, 0.52);
    this.headGroup.add(hairBack);

    // Soft rounded anime bangs tucked cleanly under the polka-dot kerchief!
    const bangConfigs = [
      { x: -0.35, y: 0.43, z: 0.46, sx: 1.05, sy: 0.95, rz: 0.34 },
      { x: -0.17, y: 0.47, z: 0.52, sx: 1.08, sy: 0.96, rz: 0.14 },
      { x: 0.01, y: 0.48, z: 0.54, sx: 1.08, sy: 0.95, rz: -0.02 },
      { x: 0.19, y: 0.47, z: 0.52, sx: 1.08, sy: 0.96, rz: -0.15 },
      { x: 0.36, y: 0.43, z: 0.46, sx: 1.05, sy: 0.95, rz: -0.34 }
    ];
    bangConfigs.forEach((b) => {
      const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.15, 10, 14), hairMat);
      bang.scale.set(b.sx, b.sy, 0.62);
      bang.position.set(b.x, b.y, b.z);
      bang.rotation.set(-0.34, 0, b.rz);
      bang.raycast = () => {};
      addPencilOutline(bang, 0.024, 0x3d2014, 0.42);
      this.headGroup.add(bang);
    });

    // Bouncy bob side locks framing cheeks (outside x = +-0.64 so face stays wide open!)
    this.sideLocks = [];
    [-1, 1].forEach((side) => {
      const lockPivot = new THREE.Group();
      lockPivot.position.set(side * 0.63, 0.14, 0.16);
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.38, 10, 14), hairMat);
      lock.scale.set(0.82, 1.0, 0.92);
      lock.position.set(side * 0.04, -0.22, 0.0);
      lock.rotation.z = side * -0.10;
      lock.raycast = () => {};
      addPencilOutline(lock, 0.025, 0x3d2014, 0.48);
      lockPivot.add(lock);
      this.headGroup.add(lockPivot);
      this.sideLocks.push({ pivot: lockPivot, side });
    });

    // Red polka-dot kerchief headband + top ribbon knot (kept well within top frustum!)
    const topCloth = new THREE.Mesh(
      new THREE.SphereGeometry(0.735, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
      kerchiefMat
    );
    topCloth.scale.set(1.06, 0.98, 0.94);
    topCloth.rotation.x = -0.46;
    topCloth.position.set(0, 0.06, -0.03);
    topCloth.raycast = () => {};
    addPencilOutline(topCloth, 0.02, 0x6b201c, 0.48);
    this.headGroup.add(topCloth);

    // Cute side-top kerchief bow!
    this.bowGroup = new THREE.Group();
    this.bowGroup.position.set(-0.34, 0.64, 0.18);
    this.bowGroup.rotation.z = 0.35;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), kerchiefMat);
    this.bowGroup.add(knot);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.23, 12), kerchiefMat);
      ear.scale.set(1.1, 1.0, 0.55);
      ear.position.set(s * 0.12, 0.11, 0);
      ear.rotation.z = s * -0.55;
      addPencilOutline(ear, 0.028, 0x6b201c, 0.45);
      this.bowGroup.add(ear);
    });
    this.headGroup.add(this.bowGroup);
  }

  _createArm(side, skinMat) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.56, 0.38, 0.06);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.40, 10, 14), skinMat);
    arm.position.set(side * 0.04, -0.22, 0.14);
    arm.rotation.set(0.45, 0, side * -0.15);
    arm.raycast = () => {};
    addPencilOutline(arm, 0.026, 0x683f2d, 0.42);
    pivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), skinMat);
    hand.scale.set(1.05, 0.85, 1.1);
    hand.position.set(side * 0.06, -0.42, 0.26);
    hand.raycast = () => {};
    addPencilOutline(hand, 0.026, 0x683f2d, 0.42);
    pivot.add(hand);

    return pivot;
  }

  setEmotion(emotion, duration = 1.6) {
    this.emotion = emotion;
    this.emotionTimer = duration;
    this.bounceAmt = Math.max(this.bounceAmt, 0.14);
  }

  triggerBounce(strength = 0.15) {
    this.bounceAmt = Math.max(this.bounceAmt, strength);
  }

  setLookTarget(vec3) {
    this.lookTarget.copy(vec3);
  }

  _drawFace(gx, gy, blinking) {
    const key = `${this.emotion}_${(gx * 25) | 0}_${(gy * 25) | 0}_${blinking ? 1 : 0}_${(this.chewPhase * 6) | 0}`;
    if (key === this.lastFaceKey) return;
    this.lastFaceKey = key;

    const w = 512, h = 512;
    const ctx = this.faceCtx;
    ctx.clearRect(0, 0, w, h);

    const happyClosed = this.emotion === 'bliss' || (this.emotion === 'giggling' && blinking);
    const isBlink = blinking || happyClosed;

    // Soft watercolor coral cheek blushes
    const blushAlpha = (this.emotion === 'bliss' || this.emotion === 'amazed' || this.emotion === 'mouthOpen') ? 0.62 : 0.44;
    [134, 378].forEach((bx) => {
      const g = ctx.createRadialGradient(bx, 314, 6, bx, 314, 60);
      g.addColorStop(0, `rgba(255, 114, 108, ${blushAlpha})`);
      g.addColorStop(1, 'rgba(255, 114, 108, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, 314, 60, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 236, 230, 0.7)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - 12, 318);
      ctx.lineTo(bx - 2, 308);
      ctx.moveTo(bx + 4, 320);
      ctx.lineTo(bx + 14, 310);
      ctx.stroke();
    });

    // Expressive Eyebrows
    ctx.strokeStyle = '#4e291b';
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    const browLift = (this.emotion === 'amazed' || this.emotion === 'mouthOpen') ? -14
      : (this.emotion === 'bliss' ? -8 : 0);

    [-1, 1].forEach((side) => {
      const cx = 256 + side * 104;
      const cy = 166 + browLift;
      ctx.beginPath();
      ctx.moveTo(cx - side * 36, cy + 5);
      ctx.quadraticCurveTo(cx, cy - 16, cx + side * 36, cy + 9);
      ctx.stroke();
    });

    // Large, Round, Sparkling 5-Year-Old Anime Eyes!
    [-1, 1].forEach((side) => {
      const ex = 256 + side * 102;
      const ey = 248;

      if (this.emotion === 'bliss' || (this.emotion === 'crunch' && Math.sin(this.chewPhase * 4) > 0)) {
        ctx.strokeStyle = '#3d1d12';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - 44, ey + 12);
        ctx.quadraticCurveTo(ex, ey - 38, ex + 44, ey + 14);
        ctx.stroke();

        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(ex + side * 38, ey + 8);
        ctx.lineTo(ex + side * 50, ey - 4);
        ctx.stroke();
      } else if (isBlink) {
        ctx.strokeStyle = '#3d1d12';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - 42, ey + 8);
        ctx.quadraticCurveTo(ex, ey + 24, ex + 42, ey + 8);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, 48, 63, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fffaf4';
        ctx.fill();
        ctx.clip();

        const ix = ex + gx * 15;
        const iy = ey + gy * 14 + 3;
        const irisScale = (this.emotion === 'amazed' || this.emotion === 'mouthOpen') ? 1.08 : 1.0;

        const irisGrad = ctx.createLinearGradient(ix, iy - 46, ix, iy + 48);
        irisGrad.addColorStop(0, '#4a2416');
        irisGrad.addColorStop(0.45, '#8a4a28');
        irisGrad.addColorStop(1, '#e3984f');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ix, iy, 35 * irisScale, 47 * irisScale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2b120a';
        ctx.beginPath();
        ctx.ellipse(ix, iy + 2, 17 * irisScale, 23 * irisScale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 218, 148, 0.62)';
        ctx.beginPath();
        ctx.ellipse(ix, iy + 23, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dual glossy anime catchlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ix - 12, iy - 16, 11, 13, 0, 0, Math.PI * 2);
        ctx.ellipse(ix + 13, iy + 13, 5.5, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.emotion === 'amazed' || this.emotion === 'sniffing') {
          ctx.fillStyle = '#fffbe0';
          this._drawTinyStar(ctx, ix + 11, iy - 12, 10);
        }

        ctx.restore();

        ctx.strokeStyle = '#381a10';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - 48, ey + 6);
        ctx.quadraticCurveTo(ex, ey - 68, ex + 49, ey + 8);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(92, 48, 32, 0.48)';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(ex - 25, ey + 58);
        ctx.quadraticCurveTo(ex, ey + 66, ex + 25, ey + 58);
        ctx.stroke();
      }
    });

    // Expressive Anime Mouth
    const mx = 256, my = 358;
    ctx.save();
    if (this.emotion === 'mouthOpen') {
      ctx.fillStyle = '#7d2828';
      ctx.beginPath();
      ctx.ellipse(mx, my + 8, 38, 42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(mx, my + 8, 38, 42, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#ff8b8e';
      ctx.beginPath();
      ctx.arc(mx, my + 34, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = '#4e2418';
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.ellipse(mx, my + 8, 38, 42, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.emotion === 'amazed') {
      ctx.fillStyle = '#8b2f2f';
      ctx.beginPath();
      ctx.moveTo(mx - 34, my - 4);
      ctx.quadraticCurveTo(mx, my - 10, mx + 34, my - 4);
      ctx.quadraticCurveTo(mx + 28, my + 38, mx, my + 40);
      ctx.quadraticCurveTo(mx - 28, my + 38, mx - 34, my - 4);
      ctx.fill();

      ctx.fillStyle = '#ff9294';
      ctx.beginPath();
      ctx.ellipse(mx, my + 24, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#4e2418';
      ctx.lineWidth = 6;
      ctx.stroke();
    } else if (this.emotion === 'giggling' || this.emotion === 'bliss') {
      ctx.fillStyle = '#ff8589';
      ctx.beginPath();
      ctx.moveTo(mx - 36, my - 4);
      ctx.quadraticCurveTo(mx, my + 4, mx + 36, my - 4);
      ctx.quadraticCurveTo(mx + 24, my + 32, mx, my + 32);
      ctx.quadraticCurveTo(mx - 24, my + 32, mx - 36, my - 4);
      ctx.fill();

      ctx.strokeStyle = '#4e2418';
      ctx.lineWidth = 6.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (this.emotion === 'chewing' || this.emotion === 'crunch') {
      const chewY = Math.sin(this.chewPhase * 12) * 5;
      ctx.strokeStyle = '#4e2418';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx - 28, my + chewY);
      ctx.quadraticCurveTo(mx - 12, my + 16 - chewY, mx, my + 4 + chewY);
      ctx.quadraticCurveTo(mx + 12, my + 16 - chewY, mx + 28, my + chewY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(180, 92, 76, 0.55)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(mx + 38, my + 4, 12, -0.9, 0.9);
      ctx.stroke();
    } else if (this.emotion === 'sniffing' || this.emotion === 'curious') {
      ctx.fillStyle = '#e57373';
      ctx.beginPath();
      ctx.ellipse(mx, my + 6, 14, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4e2418';
      ctx.lineWidth = 6;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#4e2418';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx - 30, my - 2);
      ctx.quadraticCurveTo(mx, my + 22, mx + 30, my - 2);
      ctx.stroke();
    }
    ctx.restore();

    this.faceTex.needsUpdate = true;
  }

  _drawTinyStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.3;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  update(dt, activeStage = 0) {
    this.time += dt;

    if (this.emotionTimer > 0) {
      this.emotionTimer -= dt;
      if (this.emotionTimer <= 0) {
        this.emotion = activeStage === 2 ? 'sniffing' : 'expectant';
      }
    }

    if (this.emotion === 'chewing' || this.emotion === 'crunch') {
      this.chewPhase += dt;
    }

    this.blinkTimer -= dt;
    let blinking = false;
    if (this.blinkTimer <= 0) {
      this.blinkProgress += dt * 7.5;
      blinking = this.blinkProgress < 1.0;
      if (this.blinkProgress >= 1.0) {
        this.blinkProgress = 0;
        this.blinkTimer = 2.4 + Math.random() * 2.6;
      }
    }

    const headWorld = new THREE.Vector3(this.basePos.x, this.basePos.y + 1.72, this.basePos.z + 0.06);
    const dx = this.lookTarget.x - headWorld.x;
    const dy = this.lookTarget.y - headWorld.y;
    const dz = Math.max(0.6, this.lookTarget.z - headWorld.z);

    const targetYaw = Math.max(-0.40, Math.min(0.40, Math.atan2(dx, dz)));
    const targetPitch = Math.max(-0.30, Math.min(0.26, -Math.atan2(dy, dz)));

    this.smoothLook.x += (targetYaw - this.smoothLook.x) * Math.min(1, dt * 7.5);
    this.smoothLook.y += (targetPitch - this.smoothLook.y) * Math.min(1, dt * 7.5);

    this.bounceAmt = Math.max(0, this.bounceAmt - dt * 0.42);
    const happySway = (this.emotion === 'bliss' || this.emotion === 'giggling')
      ? Math.sin(this.time * 8.5) * 0.08
      : Math.sin(this.time * 1.9) * 0.022;
    const hopY = Math.abs(Math.sin(this.time * 9.5)) * this.bounceAmt;

    const leanForward = this.emotion === 'mouthOpen' ? 0.11
      : (this.emotion === 'sniffing' ? 0.07 : 0.02);

    this.torsoGroup.position.y = 0.34 + Math.sin(this.time * 2.2) * 0.015 + hopY;
    this.torsoGroup.rotation.x = leanForward;
    this.torsoGroup.rotation.z = happySway * 0.5;

    this.headGroup.rotation.y = this.smoothLook.x * 0.60;
    // Notice: positive X rotation pitches face DOWN toward the food on the table!
    // Wait: let's check! With face on +Z and top of head on +Y, Rx(+theta):
    // y' = y cos - z sin, z' = y sin + z cos => +Y moves toward +Z (nodding DOWN!).
    // Earlier targetPitch was -atan2(dy, dz) which was POSITIVE when dy < 0 (food below eyes)!
    // Keep gentle nod <= 0.14 so eyes stay big and directly visible to camera!
    this.headGroup.rotation.x = Math.min(0.14, Math.max(-0.14, this.smoothLook.y * 0.35));
    this.headGroup.rotation.z = happySway + this.smoothLook.x * -0.10;

    this.sideLocks.forEach(({ pivot, side }) => {
      pivot.rotation.z = side * (0.04 + hopY * 0.45) - happySway * 0.5;
    });
    this.bowGroup.rotation.z = 0.35 + Math.sin(this.time * 4.5) * 0.05 + hopY * 0.5;

    // Natural graceful arm animations
    if (this.emotion === 'bliss') {
      this.leftArm.rotation.set(-1.35, 0.35, 0.45 + Math.sin(this.time * 10) * 0.08);
      this.rightArm.rotation.set(-1.35, -0.35, -0.45 - Math.sin(this.time * 10) * 0.08);
    } else if (this.emotion === 'giggling' || this.emotion === 'amazed') {
      const wave = Math.sin(this.time * 11) * 0.18;
      this.leftArm.rotation.set(-0.95 + wave, 0.25, 0.30);
      this.rightArm.rotation.set(-0.95 - wave, -0.25, -0.30);
    } else if (this.emotion === 'mouthOpen') {
      this.leftArm.rotation.set(-0.65, 0.15, 0.15);
      this.rightArm.rotation.set(-0.65, -0.15, -0.15);
    } else {
      this.leftArm.rotation.set(-0.10 + Math.sin(this.time * 2.1) * 0.03, 0, 0.06);
      this.rightArm.rotation.set(-0.10 + Math.cos(this.time * 2.1) * 0.03, 0, -0.06);
    }

    this._drawFace(
      Math.max(-1, Math.min(1, this.smoothLook.x * 2.0)),
      Math.max(-1, Math.min(1, this.smoothLook.y * 1.4)),
      blinking
    );
  }
}
