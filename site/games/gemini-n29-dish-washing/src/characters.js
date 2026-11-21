import * as THREE from 'three';
import { createApronFabricTexture } from './textures.js';

// 1. Large, warm, expressive player Hand in foreground that grabs the sponge,
// presses the soap pump, flips the faucet, and carries shiny dishes to the rack!
export function createPlayerHand(scene) {
  const handRoot = new THREE.Group();
  scene.add(handRoot);

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xeec0a6,
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.7,
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xf9dcd2,
    roughness: 0.24,
    clearcoat: 0.65,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0xd97d78,
    roughness: 0.82,
  });

  const handGroup = new THREE.Group();
  handRoot.add(handGroup);

  // Compact natural palm
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 14), skinMat);
  palm.scale.set(1.02, 0.48, 1.18);
  palm.castShadow = true;
  handGroup.add(palm);

  // Forearm & sleeve angled diagonally toward bottom-right (4-5 o'clock) so it enters naturally
  // from foreground without crossing horizontally over the dish rack!
  const armPivot = new THREE.Group();
  armPivot.position.set(0.012, -0.004, 0.042);
  armPivot.rotation.set(0.16, 0.24, 0.0);
  handGroup.add(armPivot);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.24, 14), skinMat);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, 0, 0.12);
  wrist.castShadow = true;
  armPivot.add(wrist);

  const sleeveCuff = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 10, 16), sleeveMat);
  sleeveCuff.position.set(0, 0, 0.235);
  armPivot.add(sleeveCuff);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.052, 0.72, 16), sleeveMat);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0, 0, 0.59);
  armPivot.add(sleeve);

  // 4 fingers + opposable thumb (articulated groups for gripping/pointing!)
  const fingers = [];
  const fingerSpecs = [
    { x: -0.03, z: -0.042, len: 0.056, rad: 0.011 }, // index
    { x: -0.009, z: -0.047, len: 0.062, rad: 0.0115 }, // middle
    { x: 0.012, z: -0.044, len: 0.056, rad: 0.011 }, // ring
    { x: 0.031, z: -0.035, len: 0.045, rad: 0.01 }, // pinky
  ];

  for (const fs of fingerSpecs) {
    const fg = new THREE.Group();
    fg.position.set(fs.x, 0.0, fs.z);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(fs.rad, fs.len, 6, 12), skinMat);
    seg.rotation.x = Math.PI / 2;
    seg.position.set(0, 0, -fs.len * 0.45);
    seg.castShadow = true;
    fg.add(seg);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(fs.rad * 0.72, 10, 8), nailMat);
    nail.scale.set(0.95, 0.35, 1.15);
    nail.position.set(0, fs.rad * 0.65, -fs.len * 0.85);
    fg.add(nail);

    handGroup.add(fg);
    fingers.push(fg);
  }

  const thumbGroup = new THREE.Group();
  thumbGroup.position.set(-0.042, -0.004, 0.004);
  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.042, 6, 12), skinMat);
  thumbMesh.rotation.x = Math.PI / 2;
  thumbMesh.rotation.z = 0.55;
  thumbMesh.position.set(-0.018, -0.005, -0.019);
  thumbMesh.castShadow = true;
  thumbGroup.add(thumbMesh);
  handGroup.add(thumbGroup);

  const state = {
    targetPos: new THREE.Vector3(0.56, 0.02, 0.56),
    currentPos: new THREE.Vector3(0.56, 0.02, 0.56),
    pose: 'rest', // 'rest' | 'grip' | 'press' | 'carry' | 'hint'
    targetRot: new THREE.Euler(-0.12, 0.25, 0.04),
  };

  handRoot.position.copy(state.currentPos);

  return {
    root: handRoot,
    setTarget(pos, pose = 'grip', rotEuler = null) {
      state.targetPos.copy(pos);
      state.pose = pose;
      if (rotEuler) {
        state.targetRot.copy(rotEuler);
      } else if (pose === 'grip') {
        state.targetRot.set(-0.18, 0.16, -0.08);
      } else if (pose === 'press') {
        state.targetRot.set(0.14, 0.28, 0.08);
      } else if (pose === 'carry') {
        state.targetRot.set(-0.1, -0.15, 0.24);
      } else if (pose === 'hint') {
        state.targetRot.set(0.1, 0.2, 0.04);
      } else {
        state.targetRot.set(-0.12, 0.28, 0.06);
      }
    },
    rest() {
      state.pose = 'rest';
      state.targetPos.set(0.58, 0.01, 0.58);
      state.targetRot.set(-0.12, 0.28, 0.08);
    },
    update(dt, time) {
      const lerpSpeed = state.pose === 'rest' ? 6 : 18;
      state.currentPos.lerp(state.targetPos, Math.min(1, dt * lerpSpeed));
      handRoot.position.copy(state.currentPos);
      if (state.pose === 'rest') {
        handRoot.position.y += Math.sin(time * 2.1) * 0.006;
      }

      handGroup.rotation.x = THREE.MathUtils.lerp(handGroup.rotation.x, state.targetRot.x, Math.min(1, dt * 12));
      handGroup.rotation.y = THREE.MathUtils.lerp(handGroup.rotation.y, state.targetRot.y, Math.min(1, dt * 12));
      handGroup.rotation.z = THREE.MathUtils.lerp(handGroup.rotation.z, state.targetRot.z, Math.min(1, dt * 12));

      // Finger articulation by pose
      fingers.forEach((fg, idx) => {
        let curl = -0.3;
        if (state.pose === 'grip') curl = -0.68;
        else if (state.pose === 'press') curl = idx === 0 ? -0.1 : -0.95;
        else if (state.pose === 'carry') curl = -0.52;
        else if (state.pose === 'hint') curl = idx === 0 ? -0.08 : -0.78;
        fg.rotation.x = THREE.MathUtils.lerp(fg.rotation.x, curl, Math.min(1, dt * 14));
      });
      const thumbRot = state.pose === 'grip' ? -0.45 : -0.15;
      thumbGroup.rotation.z = THREE.MathUtils.lerp(thumbGroup.rotation.z, thumbRot, Math.min(1, dt * 14));
    },
  };
}

// 2. Warm, Expressive Mom standing across the kitchen counter (large bust-up, zero text — tells the story via face & gestures!)
function drawMomFace(ctx, mood, blinkAmount) {
  const w = 512;
  const h = 512;
  ctx.clearRect(0, 0, w, h);

  // Soft warm realistic skin base with subtle cheek & forehead warmth (balanced for ACES exposure)
  const skinGrad = ctx.createRadialGradient(256, 250, 30, 256, 260, 255);
  skinGrad.addColorStop(0, '#f3d0ba');
  skinGrad.addColorStop(0.7, '#e7bc9f');
  skinGrad.addColorStop(1, '#d4a082');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft healthy rose blush on cheeks
  for (const cx of [172, 340]) {
    const blush = ctx.createRadialGradient(cx, 294, 4, cx, 294, 48);
    blush.addColorStop(0, mood === 'joy' ? 'rgba(232,126,118,0.44)' : 'rgba(226,136,126,0.28)');
    blush.addColorStop(1, 'rgba(226,136,126,0)');
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.arc(cx, 294, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes (centered on front of face UV: x = 204 and 308, y = 236)
  const eyeXs = [206, 306];
  const eyeY = 236;
  const happyArcEyes = mood === 'joy' || blinkAmount > 0.75;

  for (let i = 0; i < 2; i++) {
    const ex = eyeXs[i];
    const dir = i === 0 ? -1 : 1;

    if (happyArcEyes) {
      // Warm joyful smiling eyes (crescent curve)
      ctx.strokeStyle = '#3b2419';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 8, 22, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      const openScale = Math.max(0.15, 1 - blinkAmount) * (mood === 'amazed' ? 1.18 : 1.0);
      // Sclera (soft natural white)
      ctx.fillStyle = '#fcf9f5';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 24, 17 * openScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warm dark-brown iris
      const irisR = 13.5 * Math.min(1.08, openScale);
      const irisG = ctx.createRadialGradient(ex, eyeY + 2, 2, ex, eyeY, irisR);
      irisG.addColorStop(0, '#5a3520');
      irisG.addColorStop(0.75, '#3b2113');
      irisG.addColorStop(1, '#24130a');
      ctx.fillStyle = irisG;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1, irisR, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#140b06';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1, irisR * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Crisp bright window catchlights (makes eyes alive & natural!)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 5, eyeY - 4, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + 5, eyeY + 4, 2.1, 0, Math.PI * 2);
      ctx.fill();

      // Upper lash line
      ctx.strokeStyle = '#341e13';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 2, 25, 17 * openScale, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    }

    // Expressive warm brown eyebrows
    ctx.strokeStyle = '#5c3b27';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    const browLift = mood === 'amazed' ? -14 : mood === 'joy' ? -8 : mood === 'curious' ? -5 : 0;
    ctx.beginPath();
    ctx.moveTo(ex - 23 * dir, eyeY - 30 + browLift);
    ctx.quadraticCurveTo(ex, eyeY - 40 + browLift, ex + 22 * dir, eyeY - 26 + browLift);
    ctx.stroke();
  }

  // Gentle nose highlight & soft shadow
  ctx.fillStyle = 'rgba(205,148,122,0.45)';
  ctx.beginPath();
  ctx.ellipse(256, 282, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,244,234,0.45)';
  ctx.beginPath();
  ctx.ellipse(256, 272, 6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Expressive Mouth (clearly communicates emotion!)
  const my = 326;
  ctx.lineCap = 'round';
  if (mood === 'joy') {
    // Big radiant open smile!
    ctx.fillStyle = '#c85b5e';
    ctx.beginPath();
    ctx.moveTo(216, my - 4);
    ctx.quadraticCurveTo(256, my + 2, 296, my - 4);
    ctx.quadraticCurveTo(286, my + 38, 256, my + 38);
    ctx.quadraticCurveTo(226, my + 38, 216, my - 4);
    ctx.fill();
    // Bright white upper teeth
    ctx.fillStyle = '#fffdf8';
    ctx.beginPath();
    ctx.moveTo(222, my - 2);
    ctx.quadraticCurveTo(256, my + 3, 290, my - 2);
    ctx.lineTo(286, my + 10);
    ctx.quadraticCurveTo(256, my + 13, 226, my + 10);
    ctx.closePath();
    ctx.fill();
  } else if (mood === 'amazed') {
    // Delighted "Ooooh!" O-smile (when bubbles float or water overflows!)
    ctx.fillStyle = '#c96265';
    ctx.beginPath();
    ctx.ellipse(256, my + 10, 17, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d9817e';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (mood === 'curious') {
    // Gentle encouraging smile
    ctx.strokeStyle = '#bd5f5c';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(224, my + 2);
    ctx.quadraticCurveTo(256, my + 22, 288, my + 2);
    ctx.stroke();
  } else {
    // Warm everyday smile
    ctx.strokeStyle = '#c46360';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(220, my);
    ctx.quadraticCurveTo(256, my + 26, 292, my);
    ctx.stroke();
  }
}

export function createMomCharacter(scene) {
  const root = new THREE.Group();
  // Positioned naturally behind the peninsula counter — full head, eyes, smile, apron & hands framed clearly!
  root.position.set(-0.34, -0.17, -0.88);
  root.rotation.y = 0.24;
  scene.add(root);

  const apronTex = createApronFabricTexture();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xeac2a8,
    roughness: 0.54,
    clearcoat: 0.06,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x42291c,
    roughness: 0.74,
    metalness: 0.02,
  });

  // Rich sage-green knit sweater so Mom pops cleanly from the sunlit white kitchen backdrop!
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0x5c7f6c,
    roughness: 0.84,
  });

  const apronMat = new THREE.MeshStandardMaterial({
    map: apronTex,
    roughness: 0.86,
  });

  // Torso (linen apron over warm white knit top)
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.185, 0.42, 24), shirtMat);
  torso.position.y = 0.21;
  torso.scale.set(1.22, 1, 0.74);
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Apron front bib & straps
  const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.04), apronMat);
  apronBib.position.set(0, 0.22, 0.115);
  bodyGroup.add(apronBib);
  for (const sx of [-0.095, 0.095]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.15, 0.18), apronMat);
    strap.position.set(sx, 0.4, 0.02);
    bodyGroup.add(strap);
  }

  // Shoulders
  for (const sx of [-0.18, 0.18]) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 14), shirtMat);
    sh.position.set(sx, 0.38, 0);
    bodyGroup.add(sh);
  }

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.1, 18), skinMat);
  neck.position.set(0, 0.45, 0.01);
  bodyGroup.add(neck);

  // Head with dynamic Canvas face texture
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.59, 0.02);
  bodyGroup.add(headGroup);

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 512;
  faceCanvas.height = 512;
  const faceCtx = faceCanvas.getContext('2d');
  drawMomFace(faceCtx, 'smile', 0);

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: faceTex,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.08,
  });

  // Sphere UV: rotate so center of texture (u=0.5) faces +Z directly toward the child!
  const headGeo = new THREE.SphereGeometry(0.142, 28, 24);
  headGeo.rotateY(-Math.PI / 2);
  const headMesh = new THREE.Mesh(headGeo, faceMat);
  headMesh.scale.set(0.95, 1.08, 0.96);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Subtle sculpted 3D nose bridge so lighting catches naturally
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 10), skinMat);
  nose.scale.set(0.8, 1.1, 0.9);
  nose.position.set(0, -0.015, 0.136);
  headGroup.add(nose);

  // Ears
  for (const sx of [-0.132, 0.132]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), skinMat);
    ear.scale.set(0.45, 1.0, 0.7);
    ear.position.set(sx, -0.01, -0.005);
    headGroup.add(ear);
  }

  // Soft realistic layered chestnut hair (crown + side waves + cozy low bun)
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.152, 22, 18), hairMat);
  hairBack.position.set(0, 0.02, -0.025);
  hairBack.scale.set(1.03, 1.07, 1.0);
  hairBack.castShadow = true;
  headGroup.add(hairBack);

  // Soft parted bangs framing forehead (leaves eyebrows & eyes 100% visible!)
  const bangL = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), hairMat);
  bangL.scale.set(1.25, 0.72, 0.72);
  bangL.position.set(-0.072, 0.105, 0.082);
  bangL.rotation.z = 0.35;
  headGroup.add(bangL);

  const bangR = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), hairMat);
  bangR.scale.set(1.25, 0.72, 0.72);
  bangR.position.set(0.072, 0.105, 0.082);
  bangR.rotation.z = -0.35;
  headGroup.add(bangR);

  // Side hair locks
  for (const sx of [-0.128, 0.128]) {
    const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.12, 6, 12), hairMat);
    lock.position.set(sx, -0.02, 0.015);
    lock.rotation.z = sx < 0 ? 0.14 : -0.14;
    headGroup.add(lock);
  }

  // Cozy kitchen ponytail / bun at back with coral ribbon tie
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 14), hairMat);
  bun.position.set(0, 0.04, -0.165);
  headGroup.add(bun);

  const ribbon = new THREE.Mesh(
    new THREE.TorusGeometry(0.056, 0.014, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xdf7c78, roughness: 0.6 })
  );
  ribbon.position.set(0, 0.04, -0.13);
  headGroup.add(ribbon);

  // Expressive Arms & Hands (wave / clap happily when dishes shine!)
  const armL = new THREE.Group();
  armL.position.set(-0.19, 0.36, 0.04);
  bodyGroup.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.19, 0.36, 0.04);
  bodyGroup.add(armR);

  for (const [arm, side] of [[armL, -1], [armR, 1]]) {
    const sleevePart = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.12, 6, 12), shirtMat);
    sleevePart.position.set(0, -0.07, 0.05);
    sleevePart.rotation.x = -0.6;
    arm.add(sleevePart);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.12, 6, 12), skinMat);
    forearm.position.set(-side * 0.03, -0.11, 0.15);
    forearm.rotation.x = -1.2;
    forearm.rotation.z = -side * 0.35;
    arm.add(forearm);

    const handBall = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), skinMat);
    handBall.scale.set(0.85, 0.65, 1.15);
    handBall.position.set(-side * 0.06, -0.09, 0.23);
    arm.add(handBall);
  }

  let currentMood = 'smile';
  let moodTimer = 0;
  let clapTimer = 0;
  let blinkTimer = 2.8;
  let blinkVal = 0;
  let lastDrawnMood = 'smile';
  let lastDrawnBlink = 0;

  return {
    root,
    setMood(mood, duration = 2.2, clap = false) {
      currentMood = mood;
      moodTimer = duration;
      if (clap) clapTimer = Math.max(clapTimer, 1.6);
    },
    update(dt, time, lookTargetPos) {
      // Revert special mood back to warm smile gently
      if (moodTimer > 0) {
        moodTimer -= dt;
        if (moodTimer <= 0) currentMood = 'smile';
      }
      if (clapTimer > 0) clapTimer = Math.max(0, clapTimer - dt);

      // Natural blinking
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        blinkTimer = 2.6 + Math.random() * 2.8;
      }
      const targetBlink = blinkTimer < 0.14 ? 1 : 0;
      blinkVal = THREE.MathUtils.lerp(blinkVal, targetBlink, Math.min(1, dt * 28));

      if (currentMood !== lastDrawnMood || Math.abs(blinkVal - lastDrawnBlink) > 0.18) {
        drawMomFace(faceCtx, currentMood, blinkVal);
        faceTex.needsUpdate = true;
        lastDrawnMood = currentMood;
        lastDrawnBlink = blinkVal;
      }

      // Gentle breathing & joyful bounce
      const bounce = clapTimer > 0 ? Math.abs(Math.sin(time * 9.5)) * 0.025 : Math.sin(time * 1.9) * 0.008;
      bodyGroup.position.y = bounce;

      // Head gently tracks the action in the sink!
      if (lookTargetPos) {
        const dx = lookTargetPos.x - root.position.x;
        const targetYaw = THREE.MathUtils.clamp(dx * 0.35 - 0.18, -0.35, 0.35);
        const targetPitch = currentMood === 'joy' ? -0.05 + Math.sin(time * 9) * 0.08 : 0.12;
        headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetYaw, dt * 4);
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetPitch, dt * 5);
        headGroup.rotation.z = Math.sin(time * 1.6) * 0.04;
      }

      // Arm clapping / cheering vs relaxed leaning on counter
      if (clapTimer > 0) {
        const c = Math.sin(time * 15) * 0.5 + 0.5;
        armL.rotation.set(-0.55, 0.35 + c * 0.42, 0.25);
        armR.rotation.set(-0.55, -0.35 - c * 0.42, -0.25);
      } else if (currentMood === 'amazed') {
        armL.rotation.set(-0.7, 0.15, 0.4);
        armR.rotation.set(-0.7, -0.15, -0.4);
      } else {
        armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, 0.05, dt * 6);
        armL.rotation.y = THREE.MathUtils.lerp(armL.rotation.y, 0.05, dt * 6);
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, 0.08, dt * 6);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, 0.05, dt * 6);
        armR.rotation.y = THREE.MathUtils.lerp(armR.rotation.y, -0.05, dt * 6);
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, -0.08, dt * 6);
      }
    },
  };
}
