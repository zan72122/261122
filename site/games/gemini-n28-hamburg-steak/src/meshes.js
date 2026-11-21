import * as THREE from '../vendor/three.module.js';

// Warm anime-film soft material helper (prevents harsh dark shadows, keeps warm painterly shading)
export function softMat(opts = {}) {
  const {
    color = 0xffffff,
    map = null,
    roughness = 0.68,
    metalness = 0.02,
    emissive = 0x3b2416,
    emissiveIntensity = 0.08,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
  } = opts;
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    side,
  });
}

/**
 * Watercolor Kitchen Environment (sunlit Ghibli-style watercolor backdrop + warm honey-oak counter + sunlit motes)
 */
export function createEnvironment(backdropTex, woodTex) {
  const group = new THREE.Group();

  // Gently curved watercolor kitchen backdrop positioned so the sunlit window & wooden shelves frame the counter!
  const bgGeo = new THREE.CylinderGeometry(12.2, 12.2, 8.2, 32, 1, true, Math.PI * 0.66, Math.PI * 0.68);
  const bgMat = new THREE.MeshBasicMaterial({
    map: backdropTex,
    side: THREE.BackSide,
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 2.35, 3.6);
  group.add(bgMesh);

  // Warm honey-oak wooden counter / dining table surface
  const counterGeo = new THREE.BoxGeometry(16, 0.6, 8.5);
  const counterMat = softMat({
    map: woodTex,
    roughness: 0.72,
    emissive: 0x4a2c16,
    emissiveIntensity: 0.09,
  });
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.set(0, -0.3, 0.4);
  counter.receiveShadow = true;
  group.add(counter);

  // Soft beveled front edge trim of wooden counter
  const trimGeo = new THREE.CylinderGeometry(0.3, 0.3, 16, 12);
  trimGeo.rotateZ(Math.PI / 2);
  const trim = new THREE.Mesh(trimGeo, counterMat);
  trim.position.set(0, -0.3, 4.65);
  group.add(trim);

  // Diagonal warm afternoon window light-beam plane (subtle painterly atmosphere)
  const beamGeo = new THREE.PlaneGeometry(5.5, 7.5);
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 128;
  beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d');
  const bgrad = bctx.createLinearGradient(0, 0, 128, 128);
  bgrad.addColorStop(0, 'rgba(255, 245, 200, 0.24)');
  bgrad.addColorStop(0.55, 'rgba(255, 232, 175, 0.08)');
  bgrad.addColorStop(1, 'rgba(255, 224, 160, 0)');
  bctx.fillStyle = bgrad;
  bctx.fillRect(0, 0, 128, 128);
  const beamTex = new THREE.CanvasTexture(beamCanvas);
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(-1.4, 3.2, -3.5);
  beam.rotation.z = -0.32;
  group.add(beam);

  // Soft floating golden sunlight dust motes
  const dustCount = 24;
  const dustGroup = new THREE.Group();
  const dustGeo = new THREE.SphereGeometry(0.025, 6, 6);
  const dustMat = new THREE.MeshBasicMaterial({
    color: 0xfff5c2,
    transparent: true,
    opacity: 0.65,
  });
  const dustItems = [];
  for (let i = 0; i < dustCount; i++) {
    const m = new THREE.Mesh(dustGeo, dustMat);
    const base = new THREE.Vector3(
      (Math.random() - 0.5) * 9,
      0.7 + Math.random() * 4.5,
      -2.5 + Math.random() * 4.5
    );
    m.position.copy(base);
    dustGroup.add(m);
    dustItems.push({ mesh: m, base, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.5 });
  }
  group.add(dustGroup);

  return {
    group,
    update(t) {
      for (const d of dustItems) {
        d.mesh.position.x = d.base.x + Math.sin(t * d.speed + d.phase) * 0.35;
        d.mesh.position.y = d.base.y + Math.cos(t * d.speed * 0.8 + d.phase) * 0.25;
      }
    },
  };
}

/**
 * Large Expressive 3D Anime-Film Girl Character
 * Peeks eagerly over the kitchen counter during cooking; sits LARGE and front-and-center at the dining table!
 */
export function createGirlCharacter(faceController, skinTex) {
  const root = new THREE.Group();

  const hairMat = softMat({ color: 0x6b3f29, roughness: 0.72, emissive: 0x2c140a, emissiveIntensity: 0.12 });
  const ribbonMat = softMat({ color: 0xee6b5b, roughness: 0.55, emissive: 0x661a14, emissiveIntensity: 0.1 });
  const blouseMat = softMat({ color: 0xfff6e8, roughness: 0.78, emissive: 0x4c3a28, emissiveIntensity: 0.08 });
  const apronMat = softMat({ color: 0xf4978e, roughness: 0.74, emissive: 0x5c221d, emissiveIntensity: 0.1 });
  const skinMat = softMat({ map: skinTex, roughness: 0.66, emissive: 0x5c2e20, emissiveIntensity: 0.1 });

  // Torso / Shoulders (soft rounded cozy sweater + coral apron)
  const torsoGroup = new THREE.Group();
  root.add(torsoGroup);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 0.75, 12, 20), blouseMat);
  body.position.set(0, -0.78, 0);
  body.scale.set(1.08, 1.0, 0.85);
  body.castShadow = true;
  torsoGroup.add(body);

  // Apron front bib & straps (soft curved silhouette wrapping cleanly around torso)
  const apronBib = new THREE.Mesh(
    new THREE.CylinderGeometry(0.69, 0.72, 0.92, 18, 1, false, -Math.PI * 0.34, Math.PI * 0.68),
    apronMat
  );
  apronBib.position.set(0, -0.82, 0.02);
  apronBib.scale.set(1.06, 1.0, 0.86);
  torsoGroup.add(apronBib);
  [-0.34, 0.34].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 8, 16, Math.PI), apronMat);
    strap.position.set(sx, -0.35, 0.06);
    strap.rotation.y = Math.PI / 2;
    torsoGroup.add(strap);
  });

  // Cute round Peter Pan collar nestled softly around neck
  [-0.22, 0.22].forEach((cx) => {
    const col = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), blouseMat);
    col.scale.set(1.15, 0.24, 0.85);
    col.position.set(cx, -0.25, 0.38);
    col.rotation.x = 0.25;
    torsoGroup.add(col);
  });

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 16), skinMat);
  neck.position.set(0, -0.1, 0);
  torsoGroup.add(neck);

  // Expressive Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.72, 0);
  torsoGroup.add(headGroup);

  // Custom isotropic front-projected UV head sphere so the 512x512 hand-drawn anime face maps 1:1 undistorted!
  const headGeo = new THREE.SphereGeometry(0.84, 32, 24);
  const posAttr = headGeo.attributes.position;
  const uvAttr = headGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const r = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    const nx = vx / r;
    const ny = vy / r;
    const nz = vz / r;
    if (nz > -0.05) {
      const u = THREE.MathUtils.clamp(0.5 + Math.atan2(nx, Math.max(0.05, nz)) / (Math.PI * 0.74), 0.02, 0.98);
      const v = THREE.MathUtils.clamp(0.5 + Math.asin(THREE.MathUtils.clamp(ny, -1, 1)) / (Math.PI * 0.74), 0.02, 0.98);
      uvAttr.setXY(i, u, v);
    } else {
      uvAttr.setXY(i, 0.04, 0.04);
    }
  }
  uvAttr.needsUpdate = true;

  const faceMat = softMat({
    map: faceController.texture,
    roughness: 0.65,
    emissive: 0x4d281a,
    emissiveIntensity: 0.14,
  });
  const headMesh = new THREE.Mesh(headGeo, faceMat);
  headMesh.scale.set(1.03, 0.98, 0.95);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Subtle 3D puffing cheek meshes (invisible at rest, scale softly when chewing!)
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMat);
  cheekL.position.set(-0.44, -0.18, 0.62);
  cheekL.scale.set(0.01, 0.01, 0.01);
  headGroup.add(cheekL);
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.44;
  headGroup.add(cheekR);

  // Cute ears
  [-0.84, 0.84].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinMat);
    ear.position.set(ex, -0.06, -0.02);
    ear.scale.set(0.6, 1.0, 0.75);
    headGroup.add(ear);
  });

  // Soft anime bob hair cap — tilted BACK so her forehead, brows & huge sparkling eyes are 100% clear!
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.48), hairMat);
  hairCap.position.set(0, 0.12, -0.14);
  hairCap.rotation.x = -0.52;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Back hair fullness
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.89, 20, 16), hairMat);
  backHair.position.set(0, -0.02, -0.26);
  backHair.scale.set(1.03, 1.05, 0.88);
  headGroup.add(backHair);

  // Soft curved anime bangs high across forehead (keeping eyebrows & eyes completely open and expressive!)
  const bangConfigs = [
    { x: -0.48, y: 0.62, z: 0.5, sx: 0.24, sy: 0.24, rz: 0.32 },
    { x: -0.18, y: 0.69, z: 0.56, sx: 0.26, sy: 0.22, rz: 0.12 },
    { x: 0.16, y: 0.69, z: 0.56, sx: 0.26, sy: 0.22, rz: -0.1 },
    { x: 0.48, y: 0.62, z: 0.5, sx: 0.24, sy: 0.24, rz: -0.32 },
  ];
  for (const b of bangConfigs) {
    const bang = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), hairMat);
    bang.scale.set(b.sx, b.sy, 0.16);
    bang.position.set(b.x, b.y, b.z);
    bang.rotation.z = b.rz;
    bang.rotation.x = -0.32;
    headGroup.add(bang);
  }

  // Side cheek-framing hair locks (swept softly to outer cheeks, never blocking eyes!)
  [-0.82, 0.82].forEach((sx) => {
    const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.52, 8, 12), hairMat);
    lock.position.set(sx, -0.06, 0.18);
    lock.rotation.z = sx > 0 ? 0.14 : -0.14;
    headGroup.add(lock);
  });

  // Bouncy side pigtails with coral-red hair ribbons!
  const pigtails = [];
  [-1, 1].forEach((side) => {
    const pigRoot = new THREE.Group();
    pigRoot.position.set(side * 0.88, 0.36, -0.12);
    headGroup.add(pigRoot);

    // Ribbon knot + twin bows
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ribbonMat);
    pigRoot.add(knot);
    [-1, 1].forEach((b) => {
      const bow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), ribbonMat);
      bow.scale.set(1.2, 0.72, 0.55);
      bow.position.set(side * 0.08, b * 0.12, 0.08);
      bow.rotation.z = b * side * 0.45;
      pigRoot.add(bow);
    });

    // Bouncy fluffy hair puff pigtail
    const tail1 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), hairMat);
    tail1.scale.set(0.95, 1.25, 0.92);
    tail1.position.set(side * 0.24, -0.14, -0.06);
    tail1.rotation.z = side * 0.38;
    pigRoot.add(tail1);

    const tail2 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), hairMat);
    tail2.position.set(side * 0.38, -0.45, -0.08);
    pigRoot.add(tail2);

    pigtails.push({ group: pigRoot, side });
  });

  // Expressive Arms & Hands (for clapping, waving, excited bouncing!)
  const arms = [];
  [-1, 1].forEach((side) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.72, -0.45, 0.15);
    torsoGroup.add(armPivot);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.35, 8, 12), blouseMat);
    sleeve.position.set(side * 0.12, -0.22, 0.18);
    sleeve.rotation.x = -0.65;
    sleeve.rotation.z = side * 0.3;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat);
    hand.scale.set(1.0, 0.85, 1.15);
    hand.position.set(side * 0.22, -0.44, 0.48);
    armPivot.add(hand);

    arms.push({ pivot: armPivot, side });
  });

  return {
    root,
    headGroup,
    torsoGroup,
    pigtails,
    arms,
    cheekL,
    cheekR,
    mouthWorldPos(target = new THREE.Vector3()) {
      target.set(0, -0.26, 0.85);
      headGroup.localToWorld(target);
      return target;
    },
    animate(t, mode = 'curious', excitement = 0, chewPhase = 0) {
      // Gentle living breath & joyful bob
      const bobSpeed = mode === 'bliss' || mode === 'excited' ? 5.5 : 2.1;
      const bobAmp = mode === 'bliss' ? 0.08 : mode === 'excited' ? 0.06 : 0.025;
      torsoGroup.position.y = Math.sin(t * bobSpeed) * bobAmp + excitement * 0.12;

      // Expressive head tilt
      const tiltAmp = mode === 'chewing' ? 0.14 : mode === 'bliss' ? 0.12 : 0.05;
      const tiltSpeed = mode === 'chewing' ? 4.8 : 1.7;
      headGroup.rotation.z = Math.sin(t * tiltSpeed) * tiltAmp;
      headGroup.rotation.x =
        mode === 'anticipating' ? 0.12 :
        mode === 'amazed' ? -0.1 :
        0.04 + Math.sin(t * 1.4) * 0.03;

      // Bouncy pigtails!
      for (const p of pigtails) {
        p.group.rotation.z = Math.sin(t * bobSpeed - 0.5) * (0.1 + bobAmp * 1.6) * p.side;
      }

      // Puffy cheeks during chewing
      if (mode === 'chewing') {
        const puffL = 0.72 + Math.max(0, Math.sin(chewPhase)) * 0.45;
        const puffR = 0.72 + Math.max(0, -Math.sin(chewPhase)) * 0.45;
        cheekL.scale.set(puffL, puffL * 0.85, puffL * 0.75);
        cheekR.scale.set(puffR, puffR * 0.85, puffR * 0.75);
      } else {
        cheekL.scale.set(0.01, 0.01, 0.01);
        cheekR.scale.set(0.01, 0.01, 0.01);
      }

      // Expressive arms!
      for (const a of arms) {
        if (mode === 'bliss') {
          // Clapping happily!
          a.pivot.rotation.x = -0.95;
          a.pivot.rotation.y = -a.side * (0.45 + Math.sin(t * 11) * 0.25);
          a.pivot.rotation.z = a.side * 0.25;
        } else if (mode === 'excited' || mode === 'amazed') {
          // Arms lifted happily near cheeks!
          a.pivot.rotation.x = -1.1 + Math.sin(t * 7) * 0.12;
          a.pivot.rotation.y = -a.side * 0.2;
          a.pivot.rotation.z = a.side * 0.15;
        } else if (mode === 'anticipating') {
          // Leaning forward eagerly!
          a.pivot.rotation.x = -0.55 + Math.sin(t * 5) * 0.08;
          a.pivot.rotation.y = -a.side * 0.15;
          a.pivot.rotation.z = 0;
        } else {
          a.pivot.rotation.x = -0.2 + Math.sin(t * 2 + a.side) * 0.06;
          a.pivot.rotation.y = 0;
          a.pivot.rotation.z = a.side * 0.08;
        }
      }
    },
  };
}

/**
 * Large Warm Soft 3D Anime Cooking Hand (Left or Right)
 * Rounded palm, 4 soft curved articulated fingers, warm thumb, cozy linen cuff sleeve!
 */
export function createCookingHand(side = 1, skinTex, translucent = false) {
  const root = new THREE.Group();

  const skinMat = softMat({
    map: translucent ? null : skinTex,
    color: translucent ? 0xffe8d6 : 0xffffff,
    roughness: 0.62,
    emissive: 0x5c2e1f,
    emissiveIntensity: translucent ? 0.25 : 0.11,
    transparent: translucent,
    opacity: translucent ? 0.48 : 1.0,
  });

  const cuffMat = softMat({
    color: 0xfff3e2,
    roughness: 0.8,
    transparent: translucent,
    opacity: translucent ? 0.35 : 1.0,
  });

  const trimMat = softMat({
    color: 0xf08c7e,
    roughness: 0.72,
    transparent: translucent,
    opacity: translucent ? 0.35 : 1.0,
  });

  // Soft sculpted palm
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), skinMat);
  palm.scale.set(1.05, 0.42, 1.15);
  palm.castShadow = !translucent;
  root.add(palm);

  // Soft forearm & cozy rounded linen cuff (rounded capsule so no harsh flat cylinder cap ever shows!)
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.45, 8, 14), skinMat);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, -0.02, 0.72);
  wrist.scale.set(1.0, 1.0, 0.78);
  root.add(wrist);

  const cuff = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 10, 18), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, -0.02, 1.24);
  cuff.scale.set(1.05, 1.0, 0.85);
  root.add(cuff);

  const cuffTrim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.052, 8, 18), trimMat);
  cuffTrim.position.set(0, -0.02, 0.88);
  cuffTrim.scale.set(1.05, 0.85, 1.0);
  root.add(cuffTrim);

  // 4 softly articulated fingers
  const fingers = [];
  const fingerSpecs = [
    { x: -0.36 * side, len: 0.42, r: 0.115, spread: 0.14 * side },
    { x: -0.12 * side, len: 0.49, r: 0.12, spread: 0.04 * side },
    { x: 0.12 * side, len: 0.46, r: 0.115, spread: -0.04 * side },
    { x: 0.34 * side, len: 0.37, r: 0.105, spread: -0.13 * side },
  ];
  for (const fs of fingerSpecs) {
    const fPivot = new THREE.Group();
    fPivot.position.set(fs.x, 0.02, -0.46);
    fPivot.rotation.y = fs.spread;
    root.add(fPivot);

    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(fs.r, fs.len * 0.58, 8, 12), skinMat);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.set(0, 0, -fs.len * 0.34);
    seg1.castShadow = !translucent;
    fPivot.add(seg1);

    const tipPivot = new THREE.Group();
    tipPivot.position.set(0, 0, -fs.len * 0.68);
    fPivot.add(tipPivot);

    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(fs.r * 0.92, fs.len * 0.42, 8, 12), skinMat);
    seg2.rotation.x = Math.PI / 2;
    seg2.position.set(0, 0, -fs.len * 0.22);
    seg2.castShadow = !translucent;
    tipPivot.add(seg2);

    fingers.push({ base: fPivot, tip: tipPivot });
  }

  // Warm rounded thumb (inner side)
  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-0.48 * side, 0.02, -0.05);
  thumbPivot.rotation.y = 0.52 * side;
  root.add(thumbPivot);

  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.38, 8, 12), skinMat);
  thumbMesh.rotation.x = Math.PI / 2;
  thumbMesh.position.set(0, 0, -0.25);
  thumbMesh.castShadow = !translucent;
  thumbPivot.add(thumbMesh);

  return {
    root,
    fingers,
    thumbPivot,
    setCurl(curl = 0.35, thumbCurl = 0.25) {
      for (const f of fingers) {
        f.base.rotation.x = -curl * 0.72;
        f.tip.rotation.x = -curl * 0.85;
      }
      thumbPivot.rotation.x = -thumbCurl * 0.65;
    },
  };
}

/**
 * Deformable Sculpted 3D Hamburg Patty + Raw Mixing Ingredients + Sauce Glaze + Toppings + Sliceable Wedges
 */
export function createHamburgPatty(meatTexController) {
  const root = new THREE.Group();

  // Main deformable body (32x22 = ~1,400 tris, super smooth & mobile-friendly!)
  const geo = new THREE.SphereGeometry(1, 32, 22);
  const basePos = new Float32Array(geo.attributes.position.array);
  const mat = softMat({
    map: meatTexController.texture,
    roughness: 0.58,
    metalness: 0.03,
    emissive: 0x451c12,
    emissiveIntensity: 0.08,
  });
  const mainMesh = new THREE.Mesh(geo, mat);
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  root.add(mainMesh);

  // Stage 1: Raw mixing ingredients nestled on/in the meat mound (egg yolk + onion bits + breadcrumbs)
  const rawGroup = new THREE.Group();
  root.add(rawGroup);

  // Glossy wobbly golden egg yolk right on top!
  const yolkMat = softMat({
    color: 0xffb71c,
    roughness: 0.14,
    metalness: 0.05,
    emissive: 0x994a00,
    emissiveIntensity: 0.18,
  });
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), yolkMat);
  yolk.scale.set(1.12, 0.62, 1.12);
  yolk.position.set(0.05, 0.72, 0.06);
  yolk.castShadow = true;
  rawGroup.add(yolk);

  // Glossy translucent egg white pool around yolk
  const eggWhiteMat = softMat({
    color: 0xfff8e6,
    roughness: 0.12,
    transparent: true,
    opacity: 0.65,
  });
  const eggWhite = new THREE.Mesh(new THREE.SphereGeometry(0.58, 18, 12), eggWhiteMat);
  eggWhite.scale.set(1.0, 0.18, 1.0);
  eggWhite.position.set(0.04, 0.62, 0.05);
  rawGroup.add(eggWhite);

  // Chunky diced golden sautéed onions & creamy breadcrumb bits that swirl into the meat!
  const onionMat = softMat({ color: 0xf4dca0, roughness: 0.35, emissive: 0x5c3e12, emissiveIntensity: 0.1 });
  const crumbMat = softMat({ color: 0xfae7c4, roughness: 0.82 });
  const rawBits = [];
  for (let i = 0; i < 28; i++) {
    const isOnion = i < 16;
    const bitGeo = isOnion
      ? new THREE.BoxGeometry(0.15, 0.08, 0.13)
      : new THREE.SphereGeometry(0.075, 8, 6);
    const bit = new THREE.Mesh(bitGeo, isOnion ? onionMat : crumbMat);
    const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.4;
    const rad = 0.32 + (i % 5) * 0.14;
    bit.position.set(Math.cos(angle) * rad, 0.56 + (i % 3) * 0.07, Math.sin(angle) * rad);
    bit.rotation.set(i * 0.5, i * 0.7, i * 0.3);
    rawGroup.add(bit);
    rawBits.push({ mesh: bit, angle, rad, baseY: bit.position.y });
  }

  // Stage 4 & 5: Ultra-Smooth Glossy Demi-Glace Sauce Cap (zero z-fighting, sits cleanly atop the patty!)
  const sauceGeo = new THREE.SphereGeometry(1.06, 44, 18, 0, Math.PI * 2, 0, Math.PI * 0.44);
  const sauceMat = softMat({
    color: 0x5c220f,
    roughness: 0.09,
    metalness: 0.08,
    emissive: 0x3b1307,
    emissiveIntensity: 0.24,
  });
  const sauceCap = new THREE.Mesh(sauceGeo, sauceMat);
  sauceCap.position.y = 0.03;
  sauceCap.scale.set(0.001, 0.001, 0.001);
  sauceCap.visible = false;
  root.add(sauceCap);

  // Stage 4 & 5: Playful Glossy Red Ketchup Zigzag Ribbon!
  const ketchupPoints = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = (t - 0.5) * 1.45;
    const z = Math.sin(t * Math.PI * 4.5) * 0.42;
    const y = 0.54 - (x * x * 0.1 + z * z * 0.15);
    ketchupPoints.push(new THREE.Vector3(x, y, z));
  }
  const ketchupCurve = new THREE.CatmullRomCurve3(ketchupPoints);
  const ketchupGeo = new THREE.TubeGeometry(ketchupCurve, 32, 0.052, 8, false);
  const ketchupMat = softMat({
    color: 0xd92b24,
    roughness: 0.16,
    emissive: 0x610b08,
    emissiveIntensity: 0.18,
  });
  const ketchupMesh = new THREE.Mesh(ketchupGeo, ketchupMat);
  ketchupMesh.visible = false;
  root.add(ketchupMesh);

  // Stage 4 & 5: Cute Sunny-Side-Up Fried Egg (organic scalloped egg white!) + Green Parsley Topping!
  const eggTopping = new THREE.Group();
  eggTopping.visible = false;
  const eggWhiteGeo = new THREE.SphereGeometry(0.68, 28, 12);
  const ewPos = eggWhiteGeo.attributes.position;
  for (let i = 0; i < ewPos.count; i++) {
    const x = ewPos.getX(i);
    const z = ewPos.getZ(i);
    const a = Math.atan2(z, x);
    const scallop = 1 + Math.sin(a * 5) * 0.08 + Math.cos(a * 3 + 1.2) * 0.07;
    ewPos.setX(i, x * scallop);
    ewPos.setZ(i, z * scallop);
  }
  eggWhiteGeo.computeVertexNormals();
  const friedWhite = new THREE.Mesh(
    eggWhiteGeo,
    softMat({ color: 0xfffdf5, roughness: 0.25, emissive: 0x3b3528, emissiveIntensity: 0.09 })
  );
  friedWhite.scale.set(1.06, 0.14, 0.94);
  eggTopping.add(friedWhite);

  const friedYolk = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 18, 12),
    softMat({ color: 0xffae19, roughness: 0.1, emissive: 0x8c3f00, emissiveIntensity: 0.24 })
  );
  friedYolk.scale.set(1.0, 0.68, 1.0);
  friedYolk.position.set(0.04, 0.13, 0.02);
  eggTopping.add(friedYolk);

  // Tiny cheerful parsley sprig
  const parsleyMat = softMat({ color: 0x4ca64c, roughness: 0.65, emissive: 0x154015, emissiveIntensity: 0.12 });
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), parsleyMat);
    leaf.scale.set(1.2, 0.45, 1.0);
    leaf.position.set(-0.28 + i * 0.09, 0.15 + (i === 1 ? 0.04 : 0), 0.18 - i * 0.05);
    eggTopping.add(leaf);
  }
  eggTopping.position.set(0, 0.56, 0);
  root.add(eggTopping);

  // Stage 5: 4 Solid Watertight Beveled Juicy Bite Wedges (zero hollow gaps or protruding fins!)
  const wedgesGroup = new THREE.Group();
  wedgesGroup.visible = false;
  root.add(wedgesGroup);
  const wedges = [];
  const searedCrustMat = softMat({
    color: 0x7c3e20,
    roughness: 0.42,
    emissive: 0x381609,
    emissiveIntensity: 0.14,
  });
  const juicyInsideMat = softMat({
    color: 0x9c5538,
    roughness: 0.28,
    emissive: 0x4f2012,
    emissiveIntensity: 0.18,
  });

  for (let q = 0; q < 4; q++) {
    const wGroup = new THREE.Group();
    const a0 = (q * Math.PI) / 2 + 0.04;
    const a1 = ((q + 1) * Math.PI) / 2 - 0.04;
    const r = 1.02;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    shape.absarc(0, 0, r, a0, a1, false);
    shape.lineTo(0, 0);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.12,
      bevelSegments: 4,
      curveSegments: 16,
    });
    extrudeGeo.rotateX(-Math.PI / 2);
    extrudeGeo.translate(0, -0.14, 0);

    const wMesh = new THREE.Mesh(extrudeGeo, [searedCrustMat, juicyInsideMat]);
    wMesh.scale.set(1.1, 1.0, 0.94);
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    wGroup.add(wMesh);

    // Matching glossy demi-glace sauce layer neatly hugging top of each wedge!
    const sShape = new THREE.Shape();
    const sr = 0.88;
    sShape.moveTo(0, 0);
    sShape.lineTo(Math.cos(a0 + 0.03) * sr, Math.sin(a0 + 0.03) * sr);
    sShape.absarc(0, 0, sr, a0 + 0.03, a1 - 0.03, false);
    sShape.lineTo(0, 0);
    const sGeo = new THREE.ExtrudeGeometry(sShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 14,
    });
    sGeo.rotateX(-Math.PI / 2);
    sGeo.translate(0, 0.28, 0);
    const wSauce = new THREE.Mesh(sGeo, sauceMat);
    wSauce.scale.set(1.1, 1.0, 0.94);
    wGroup.add(wSauce);

    wedgesGroup.add(wGroup);
    const midA = (a0 + a1) * 0.5;
    wedges.push({
      group: wGroup,
      sauce: wSauce,
      eaten: false,
      dir: new THREE.Vector3(Math.cos(midA), 0, -Math.sin(midA)),
    });
  }

  // Real-time soft vertex deformer!
  function updateShape({
    flatten = 0, // 0 = round ball/mound, 1 = smooth oval hamburg patty
    dimple = 0, // 0..1 center thumb dimple
    puff = 0, // 0..1 steam-puffed extra juiciness
    squashY = 1.0, // dynamic bounce squash
    lumpiness = 0, // 1 = rough raw minced mound in bowl, 0 = smooth shaped
    indentX = 0,
    indentZ = 0,
    indentStrength = 0,
    time = 0,
  }) {
    const pos = geo.attributes.position;
    const rx = THREE.MathUtils.lerp(1.0, 1.24, flatten) * (1 / Math.sqrt(Math.max(0.55, squashY)));
    const rz = THREE.MathUtils.lerp(1.0, 1.04, flatten) * (1 / Math.sqrt(Math.max(0.55, squashY)));
    const ry = THREE.MathUtils.lerp(0.84, 0.46 + puff * 0.14, flatten) * squashY;

    for (let i = 0; i < pos.count; i++) {
      const bx = basePos[i * 3];
      const by = basePos[i * 3 + 1];
      const bz = basePos[i * 3 + 2];

      let x = bx * rx;
      let y = by * ry;
      let z = bz * rz;

      // Soft bumpy minced-meat organic look when raw in bowl
      if (lumpiness > 0.01) {
        const lump =
          (Math.sin(bx * 5.2 + time * 0.4) * Math.cos(bz * 5.2) * 0.11 +
            Math.sin(bx * 9.0 + bz * 7.5) * 0.045) *
          lumpiness;
        x *= 1 + lump;
        y *= 1 + lump * 1.1;
        z *= 1 + lump;
      }

      // Live finger kneading indent in Stage 1!
      if (indentStrength > 0.01 && by > 0) {
        const dx = x - indentX;
        const dz = z - indentZ;
        const d2 = dx * dx + dz * dz;
        const press = Math.exp(-d2 * 3.8) * indentStrength * 0.34;
        y -= press;
      }

      // Real 3D center thumb dimple (真ん中のくぼみ!) on top face!
      if (dimple > 0.01 && by > 0.1) {
        const r2 = bx * bx + bz * bz;
        const bowlIndent = Math.exp(-r2 * 5.2) * dimple * 0.24 * (1 - puff * 0.55);
        y -= bowlIndent;
      }

      // Slight flat underside when resting on pan or plate
      if (flatten > 0.5 && by < -0.55) {
        y = Math.max(y, -ry * 0.86);
      }

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Sync sauce cap scale cleanly OUTSIDE patty surface (zero z-fighting at any pour amount!)
    if (sauceCap.visible) {
      const sc = sauceCap.userData.amount || 0;
      const spread = 0.42 + sc * 0.58;
      sauceCap.scale.set(rx * spread, ry * (1.06 + sc * 0.05), rz * spread);
    }

    // Keep fried egg & ketchup sitting cleanly ON TOP of puffed patty & sauce cap (zero clipping!)
    const topY = sauceCap.visible ? ry * 1.12 + 0.04 : ry * 1.02 + 0.02;
    eggTopping.position.y = topY;
    ketchupMesh.position.y = topY - 0.52;
  }

  return {
    root,
    mainMesh,
    rawGroup,
    yolk,
    eggWhite,
    rawBits,
    sauceCap,
    ketchupMesh,
    eggTopping,
    friedYolk,
    wedgesGroup,
    wedges,
    updateShape,
  };
}

/**
 * Stage 1 Props: Warm Speckled Ceramic Mixing Bowl + Tactile Wooden Salt Shaker
 */
export function createMixingBowl(ceramicTex) {
  const group = new THREE.Group();

  // Lathe profile for thick cozy handmade stoneware bowl
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.95, 0.02),
    new THREE.Vector2(1.48, 0.32),
    new THREE.Vector2(1.78, 0.95),
    new THREE.Vector2(1.86, 1.38),
    new THREE.Vector2(1.74, 1.41),
    new THREE.Vector2(1.63, 0.95),
    new THREE.Vector2(1.32, 0.38),
    new THREE.Vector2(0.82, 0.14),
    new THREE.Vector2(0.0, 0.12),
  ];
  const bowlGeo = new THREE.LatheGeometry(pts, 32);
  const bowlMat = softMat({
    map: ceramicTex,
    roughness: 0.34,
    metalness: 0.03,
    emissive: 0x402d1f,
    emissiveIntensity: 0.08,
  });
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  return group;
}

export function createSaltShaker() {
  const group = new THREE.Group();
  const woodMat = softMat({ color: 0xd9a16c, roughness: 0.65 });
  const capMat = softMat({ color: 0xe6e0d4, roughness: 0.35, metalness: 0.25 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.72, 18), woodMat);
  body.position.y = 0.36;
  body.castShadow = true;
  group.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 16), woodMat);
  neck.position.y = 0.76;
  group.add(neck);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), capMat);
  cap.position.y = 0.8;
  group.add(cap);

  return group;
}

/**
 * Stage 3 Props: Retro Cream Gas Stove + Animated Flame + Dial + Heavy Cast-Iron Pan + Butter + Glass Lid + Wooden Spatula
 */
export function createStoveAndPan() {
  const root = new THREE.Group();

  // Cozy cream-enamel Japanese tabletop gas stove
  const stoveMat = softMat({ color: 0xf4e8d4, roughness: 0.38, emissive: 0x3b2c1e, emissiveIntensity: 0.07 });
  const ironMat = softMat({ color: 0x322d2b, roughness: 0.62, metalness: 0.22, emissive: 0x1a1210, emissiveIntensity: 0.08 });
  const woodHandleMat = softMat({ color: 0xc2834b, roughness: 0.62, emissive: 0x381f0c, emissiveIntensity: 0.08 });

  const stoveBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.42, 3.6), stoveMat);
  stoveBase.position.set(0, 0.21, 0);
  stoveBase.receiveShadow = true;
  stoveBase.castShadow = true;
  root.add(stoveBase);

  // Dark burner ring & grate prongs
  const burnerWell = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.08, 24), ironMat);
  burnerWell.position.set(-0.15, 0.44, -0.05);
  root.add(burnerWell);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.1), ironMat);
    prong.position.set(-0.15 + Math.cos(a) * 0.9, 0.5, -0.05 + Math.sin(a) * 0.9);
    prong.rotation.y = -a;
    root.add(prong);
  }

  // Animated 3D Flame Ring (licking warmly UNDER the outer pan curve — never poking through pan floor!)
  const flameGroup = new THREE.Group();
  flameGroup.position.set(-0.15, 0.45, -0.05);
  root.add(flameGroup);
  const flamePetals = [];
  const blueFlameMat = new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.88 });
  const orangeFlameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.92 });

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 6), i % 3 === 0 ? orangeFlameMat : blueFlameMat);
    f.position.set(Math.cos(a) * 1.25, 0.04, Math.sin(a) * 1.25);
    f.rotation.z = -Math.cos(a) * 0.92;
    f.rotation.x = Math.sin(a) * 0.92;
    flameGroup.add(f);
    flamePetals.push({ mesh: f, phase: i * 0.7 });
  }

  // Chunky Tactile Stove Flame Dial Knob (front-right, bright coral-red indicator!)
  const knobGroup = new THREE.Group();
  knobGroup.position.set(1.62, 0.24, 1.82);
  root.add(knobGroup);
  const knobBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.22, 18), softMat({ color: 0xe66855, roughness: 0.35 }));
  knobBody.rotation.x = Math.PI / 2;
  knobGroup.add(knobBody);
  const knobBar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.12), softMat({ color: 0xfff4e0, roughness: 0.4 }));
  knobBar.position.z = 0.1;
  knobGroup.add(knobBar);

  // Heavy Cast-Iron Skillet / Frying Pan
  const panGroup = new THREE.Group();
  panGroup.position.set(-0.15, 0.62, -0.05);
  root.add(panGroup);

  const panPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.48, 0.02),
    new THREE.Vector2(1.75, 0.14),
    new THREE.Vector2(1.92, 0.54),
    new THREE.Vector2(1.82, 0.56),
    new THREE.Vector2(1.66, 0.18),
    new THREE.Vector2(1.42, 0.09),
    new THREE.Vector2(0.0, 0.09),
  ];
  const panMesh = new THREE.Mesh(new THREE.LatheGeometry(panPts, 32), ironMat);
  panMesh.castShadow = true;
  panMesh.receiveShadow = true;
  panGroup.add(panMesh);

  // Subtle shimmering dark-amber cooking oil sheen inside cast-iron pan (keeps dark iron richness!)
  const oilMat = softMat({
    color: 0x8f5d24,
    roughness: 0.08,
    metalness: 0.18,
    transparent: true,
    opacity: 0.28,
  });
  const oilPool = new THREE.Mesh(new THREE.CircleGeometry(1.42, 24), oilMat);
  oilPool.rotation.x = -Math.PI / 2;
  oilPool.position.y = 0.105;
  panGroup.add(oilPool);

  // Translucent golden simmering butter foam ring texture (delicate frothy golden sizzle!)
  const foamCanvas = document.createElement('canvas');
  foamCanvas.width = 256;
  foamCanvas.height = 256;
  const fctx = foamCanvas.getContext('2d');
  const fgrad = fctx.createRadialGradient(128, 128, 36, 128, 128, 122);
  fgrad.addColorStop(0, 'rgba(235, 178, 56, 0.22)');
  fgrad.addColorStop(0.6, 'rgba(255, 208, 86, 0.48)');
  fgrad.addColorStop(0.84, 'rgba(255, 232, 146, 0.42)');
  fgrad.addColorStop(1, 'rgba(255, 224, 120, 0)');
  fctx.fillStyle = fgrad;
  fctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 65; i++) {
    const a = (i / 65) * Math.PI * 2 + (i % 5) * 0.14;
    const rad = 74 + (i % 6) * 8;
    fctx.fillStyle = 'rgba(255, 246, 204, 0.45)';
    fctx.beginPath();
    fctx.arc(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad, 2.2 + (i % 3) * 1.6, 0, Math.PI * 2);
    fctx.fill();
  }
  const foamTex = new THREE.CanvasTexture(foamCanvas);
  foamTex.colorSpace = THREE.SRGBColorSpace;

  const butterFoamMat = new THREE.MeshBasicMaterial({
    map: foamTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const butterFoam = new THREE.Mesh(new THREE.CircleGeometry(1.38, 28), butterFoamMat);
  butterFoam.rotation.x = -Math.PI / 2;
  butterFoam.position.y = 0.115;
  butterFoam.scale.set(0.01, 0.01, 0.01);
  butterFoam.visible = false;
  panGroup.add(butterFoam);

  // Warm beechwood pan handle sticking out toward bottom-right
  const handleGroup = new THREE.Group();
  handleGroup.position.set(1.72, 0.42, 0.62);
  handleGroup.rotation.y = -0.35;
  panGroup.add(handleGroup);

  const handleNeck = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.22), ironMat);
  handleNeck.position.set(0.16, 0.02, 0);
  handleGroup.add(handleNeck);

  const handleWood = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.35, 8, 12), woodHandleMat);
  handleWood.rotation.z = Math.PI / 2 - 0.12;
  handleWood.position.set(0.95, 0.12, 0);
  handleWood.castShadow = true;
  handleGroup.add(handleWood);

  // Cute Butter Dish with creamy yellow butter pat (comfortably inside left frame!)
  const butterDishGroup = new THREE.Group();
  butterDishGroup.position.set(-2.55, 0.02, 0.85);
  root.add(butterDishGroup);

  const dishMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.45, 0.12, 18), softMat({ color: 0xf7ecd9, roughness: 0.35 }));
  dishMesh.position.y = 0.06;
  dishMesh.castShadow = true;
  butterDishGroup.add(dishMesh);

  const butterPat = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.26, 0.38),
    softMat({ color: 0xffe478, roughness: 0.32, emissive: 0x6b4c08, emissiveIntensity: 0.12 })
  );
  butterPat.position.set(0, 0.24, 0);
  butterPat.castShadow = true;
  butterDishGroup.add(butterPat);

  // Domed Translucent Glass Pan Lid with wooden knob (right of stove!)
  const lidGroup = new THREE.Group();
  lidGroup.position.set(2.55, 0.05, -0.35);
  root.add(lidGroup);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5fbff,
    roughness: 0.14,
    metalness: 0.02,
    transparent: true,
    opacity: 0.46,
    transmission: 0.25,
    side: THREE.DoubleSide,
  });
  const lidDome = new THREE.Mesh(new THREE.SphereGeometry(1.86, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.38), glassMat);
  lidDome.scale.set(1, 0.65, 1);
  lidDome.position.y = -0.36;
  lidGroup.add(lidDome);

  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.055, 8, 30), softMat({ color: 0xd0d4d8, roughness: 0.28, metalness: 0.55 }));
  lidRim.rotation.x = Math.PI / 2;
  lidRim.position.y = 0.04;
  lidGroup.add(lidRim);

  const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), woodHandleMat);
  lidKnob.scale.set(1.1, 0.78, 1.1);
  lidKnob.position.y = 0.88;
  lidKnob.castShadow = true;
  lidGroup.add(lidKnob);

  // Warm Wooden Spatula / Turner (front-left/right ready to scoop & flip!)
  const spatulaGroup = new THREE.Group();
  spatulaGroup.position.set(2.35, 0.14, 1.45);
  spatulaGroup.rotation.y = 0.65;
  root.add(spatulaGroup);

  const spatBlade = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.92), woodHandleMat);
  spatBlade.position.set(0, 0, -0.58);
  spatBlade.castShadow = true;
  spatulaGroup.add(spatBlade);

  const spatStem = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 1.3, 6, 10), woodHandleMat);
  spatStem.rotation.x = Math.PI / 2;
  spatStem.position.set(0, 0.06, 0.5);
  spatulaGroup.add(spatStem);

  return {
    root,
    panGroup,
    handleGroup,
    flameGroup,
    flamePetals,
    knobGroup,
    butterDishGroup,
    butterPat,
    butterFoam,
    lidGroup,
    spatulaGroup,
    animateFlame(t, heatLevel) {
      const s = 0.65 + heatLevel * 0.42;
      for (const fp of flamePetals) {
        const flicker = 0.85 + Math.sin(t * 17 + fp.phase) * 0.22;
        fp.mesh.scale.set(s, s * flicker, s);
      }
      knobGroup.rotation.z = -(heatLevel - 1) * 0.75;
    },
  };
}

/**
 * Stage 4 & 5 Props: Hand-Painted Ceramic Dinner Plate with Glazed Carrots & Fluffy Broccoli
 */
export function createDinnerPlate(plateTex) {
  const root = new THREE.Group();

  const platePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.45, 0.02),
    new THREE.Vector2(2.22, 0.24),
    new THREE.Vector2(2.32, 0.34),
    new THREE.Vector2(2.24, 0.38),
    new THREE.Vector2(1.42, 0.12),
    new THREE.Vector2(0.0, 0.1),
  ];
  const plateGeo = new THREE.LatheGeometry(platePts, 36);
  // Top-down planar UV projection so painted sky-blue border & floral dots frame the rim cleanly!
  const pAttr = plateGeo.attributes.position;
  const uAttr = plateGeo.attributes.uv;
  for (let i = 0; i < pAttr.count; i++) {
    const x = pAttr.getX(i);
    const z = pAttr.getZ(i);
    uAttr.setXY(i, 0.5 + x / 4.7, 0.5 + z / 4.7);
  }
  uAttr.needsUpdate = true;

  const plateMat = softMat({
    map: plateTex,
    roughness: 0.26,
    metalness: 0.04,
    emissive: 0x3b3228,
    emissiveIntensity: 0.08,
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.receiveShadow = true;
  plateMesh.castShadow = true;
  root.add(plateMesh);

  // Glossy Glazed Orange Carrots (3 cute chunky slices, edible in Stage 5!)
  const carrotMat = softMat({
    color: 0xf47a2a,
    roughness: 0.22,
    emissive: 0x702604,
    emissiveIntensity: 0.15,
  });
  const garnishItems = [];

  const carrotPositions = [
    { x: -1.25, y: 0.24, z: -0.68, rot: 0.25 },
    { x: -0.82, y: 0.24, z: -1.05, rot: -0.2 },
    { x: -1.35, y: 0.24, z: -0.18, rot: 0.15 },
  ];
  carrotPositions.forEach((cp) => {
    const cg = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.18, 14), carrotMat);
    c.castShadow = true;
    cg.add(c);
    cg.position.set(cp.x, cp.y, cp.z);
    cg.rotation.z = cp.rot;
    root.add(cg);
    garnishItems.push({ group: cg, type: 'carrot', eaten: false });
  });

  // Lush Fluffy Green Broccoli Florets (2 cute clusters, edible in Stage 5!)
  const brocStemMat = softMat({ color: 0x7ab859, roughness: 0.65 });
  const brocHeadMat = softMat({ color: 0x3f8f41, roughness: 0.72, emissive: 0x103812, emissiveIntensity: 0.12 });
  const brocPositions = [
    { x: 1.18, y: 0.24, z: -0.78 },
    { x: 1.38, y: 0.24, z: -0.22 },
  ];
  brocPositions.forEach((bp) => {
    const bg = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.34, 10), brocStemMat);
    stem.position.y = 0.08;
    bg.add(stem);
    const puffs = [
      [0, 0.3, 0, 0.25],
      [-0.18, 0.24, 0.1, 0.19],
      [0.18, 0.24, 0.08, 0.19],
      [0.02, 0.24, -0.17, 0.2],
    ];
    for (const [px, py, pz, pr] of puffs) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), brocHeadMat);
      f.position.set(px, py, pz);
      f.castShadow = true;
      bg.add(f);
    }
    bg.position.set(bp.x, bp.y, bp.z);
    root.add(bg);
    garnishItems.push({ group: bg, type: 'broccoli', eaten: false });
  });

  return { root, garnishItems };
}

/**
 * Stage 4 Tools: Demi-Glace Sauce Boat & Pouring Stream + Cheerful Red Ketchup Bottle + Egg Topping Dish
 */
export function createSauceTools(ceramicTex) {
  const root = new THREE.Group();

  // 1. Ceramic Demi-Glace Sauce Boat (right side, cleanly clear of the plate rim!)
  const boatGroup = new THREE.Group();
  boatGroup.position.set(2.72, 0.02, -0.18);
  root.add(boatGroup);

  const boatMat = softMat({ map: ceramicTex, roughness: 0.28 });
  const boatBody = new THREE.Mesh(new THREE.SphereGeometry(0.58, 22, 14, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), boatMat);
  boatBody.scale.set(1.25, 0.88, 0.86);
  boatBody.position.y = 0.54;
  boatBody.castShadow = true;
  boatGroup.add(boatBody);

  // Cute boat handle on right
  const boatHandle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 16, Math.PI * 1.25), boatMat);
  boatHandle.position.set(0.7, 0.4, 0);
  boatHandle.rotation.z = -Math.PI * 0.55;
  boatGroup.add(boatHandle);

  // Rich glossy wobbling demi-glace sauce pool inside boat
  const sauceLiquidMat = softMat({
    color: 0x5c2310,
    roughness: 0.09,
    metalness: 0.08,
    emissive: 0x3a1207,
    emissiveIntensity: 0.22,
  });
  const boatSauce = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), sauceLiquidMat);
  boatSauce.rotation.x = -Math.PI / 2;
  boatSauce.scale.set(1.2, 0.82, 1);
  boatSauce.position.y = 0.52;
  boatGroup.add(boatSauce);

  // Dynamic glossy pouring sauce stream ribbon (visible while pouring!)
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.35, -0.35, 0),
    new THREE.Vector3(-0.45, -1.05, 0),
  ]);
  const streamMesh = new THREE.Mesh(new THREE.TubeGeometry(streamCurve, 16, 0.085, 8, false), sauceLiquidMat);
  streamMesh.position.set(-0.74, 0.5, 0);
  streamMesh.visible = false;
  boatGroup.add(streamMesh);

  // 2. Cheerful Red Squeeze Ketchup Bottle (left-back, cleanly clear of the plate!)
  const ketchupGroup = new THREE.Group();
  ketchupGroup.position.set(-2.62, 0.02, -0.58);
  root.add(ketchupGroup);

  const kMat = softMat({ color: 0xe33a2d, roughness: 0.3, emissive: 0x61100a, emissiveIntensity: 0.12 });
  const kBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.65, 10, 18), kMat);
  kBody.position.y = 0.62;
  kBody.castShadow = true;
  ketchupGroup.add(kBody);

  // Cream decorative label band (zero text!) with cute red tomato circle!
  const kLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.34, 18), softMat({ color: 0xfff6e5, roughness: 0.6 }));
  kLabel.position.y = 0.6;
  ketchupGroup.add(kLabel);
  const kTomato = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), kMat);
  kTomato.position.set(0, 0.6, 0.3);
  kTomato.scale.set(1, 0.9, 0.3);
  ketchupGroup.add(kTomato);

  const kCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 14), softMat({ color: 0xffd24c, roughness: 0.32 }));
  kCap.position.y = 1.26;
  ketchupGroup.add(kCap);

  // 3. Cute Small Dish with Sunny-Side-Up Fried Egg (left-front, cleanly clear of the plate!)
  const eggDishGroup = new THREE.Group();
  eggDishGroup.position.set(-2.58, 0.02, 0.95);
  root.add(eggDishGroup);

  const miniPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.6, 0.12, 20), softMat({ color: 0xfff3de, roughness: 0.3 }));
  miniPlate.position.y = 0.06;
  miniPlate.castShadow = true;
  eggDishGroup.add(miniPlate);

  const dishEgg = new THREE.Group();
  const dw = new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 10), softMat({ color: 0xfffdf5, roughness: 0.28 }));
  dw.scale.set(1.08, 0.15, 0.95);
  dishEgg.add(dw);
  const dy = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), softMat({ color: 0xffae19, roughness: 0.12, emissive: 0x803a00, emissiveIntensity: 0.2 }));
  dy.scale.set(1, 0.68, 1);
  dy.position.set(0.02, 0.1, 0);
  dishEgg.add(dy);
  dishEgg.position.y = 0.18;
  eggDishGroup.add(dishEgg);

  return {
    root,
    boatGroup,
    streamMesh,
    ketchupGroup,
    eggDishGroup,
    dishEgg,
  };
}

/**
 * Stage 4/5: Cozy Child-Sized Wood & Silver Fork
 */
export function createFork() {
  const group = new THREE.Group();
  const metalMat = softMat({ color: 0xe6eaee, roughness: 0.22, metalness: 0.72 });
  const handleMat = softMat({ color: 0xf48c7a, roughness: 0.45, emissive: 0x5c1f16, emissiveIntensity: 0.1 });

  // Rounded cozy coral-pink handle
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.95, 8, 12), handleMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.68;
  handle.castShadow = true;
  group.add(handle);

  // Silver neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 10), metalMat);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = -0.1;
  group.add(neck);

  // Fork head + 3 cute rounded tines
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.18), metalMat);
  head.position.z = -0.4;
  group.add(head);

  [-0.12, 0, 0.12].forEach((tx) => {
    const tine = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.34, 6, 8), metalMat);
    tine.rotation.x = Math.PI / 2;
    tine.position.set(tx, 0, -0.66);
    group.add(tine);
  });

  // Holder slot for food bite on fork tines!
  const biteSlot = new THREE.Group();
  biteSlot.position.set(0, 0.1, -0.65);
  group.add(biteSlot);

  return { group, biteSlot };
}
