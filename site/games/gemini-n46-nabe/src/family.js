import * as THREE from 'three';
import {
  createSkinTextures,
  createHairTextures,
  createEyeTexture,
  createKnitSweaterTextures,
  createBowlTextures,
} from './textures.js';

/**
 * Builds 3 large, warm, lifelike seated Japanese family members around the dining table
 * with natural sloping knit-sweater shoulders (NO puppet spheres!), smoothly sculpted
 * organic layered hair shells (NO sausage capsules!), clearly visible warm smiling lips,
 * almond-framed glossy eyes with catchlights, and unobstructed ceramic bowls (とんすい).
 */
export function createFamilySystem(scene) {
  const root = new THREE.Group();

  const configs = [
    {
      id: 'mom',
      name: 'Mom',
      favorite: 'cabbage',
      seatPos: new THREE.Vector3(-0.52, 0.0, -0.32),
      seatYaw: 0.46,
      bowlLocal: new THREE.Vector3(0.06, 0.0, 0.22),
      scale: 0.96,
      skinHex: '#efc3a7',
      blushHex: '#de7f75',
      hairHex: '#221610',
      hairHi: '#523424',
      hairStyle: 'mom',
      sweaterBase: '#d6c6b2',
      sweaterAccent: '#ad977e',
      bowlBase: '#e8e0d2',
      bowlRim: '#7a5c44',
      irisHex: '#3c2112',
      panAngle: -0.44,
    },
    {
      id: 'dad',
      name: 'Dad',
      favorite: 'mushroom',
      seatPos: new THREE.Vector3(-0.02, 0.0, -0.54),
      seatYaw: 0.0,
      bowlLocal: new THREE.Vector3(0.25, 0.0, 0.30), // completely unobstructed in gap between donabe & sister!
      scale: 1.07,
      skinHex: '#e1b294',
      blushHex: '#cf7968',
      hairHex: '#161210',
      hairHi: '#382e28',
      hairStyle: 'dad',
      sweaterBase: '#223644',
      sweaterAccent: '#13212b',
      bowlBase: '#374857',
      bowlRim: '#b59c7e',
      irisHex: '#28160d',
      panAngle: 0.0,
    },
    {
      id: 'sister',
      name: 'Sister',
      favorite: 'tofu',
      seatPos: new THREE.Vector3(0.55, 0.0, -0.27),
      seatYaw: -0.50,
      bowlLocal: new THREE.Vector3(-0.04, 0.0, 0.20),
      scale: 0.82,
      skinHex: '#f4c8b0',
      blushHex: '#ea8078',
      hairHex: '#1d130f',
      hairHi: '#482e22',
      hairStyle: 'kid',
      sweaterBase: '#b44832',
      sweaterAccent: '#822f1e',
      bowlBase: '#eed8c4',
      bowlRim: '#b66b4c',
      irisHex: '#381e11',
      panAngle: 0.46,
    },
  ];

  // Sculpted organic head geometry (refined jaw, brow, cheekbones, gentle chin)
  function createSculptedHeadGeo() {
    const geo = new THREE.SphereGeometry(0.098, 36, 26);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      y *= 1.13;
      // Natural tapering jaw & soft rounded chin
      if (y < 0) {
        const chinT = Math.min(1, -y / 0.112);
        x *= 1.0 - chinT * 0.28;
        z *= 1.0 - chinT * 0.14;
        if (z > 0) z += chinT * 0.008;
      }
      // Subtle cheek fullness
      if (z > 0.02 && y < 0.015 && y > -0.058) {
        const cheek = Math.exp(-Math.pow((Math.abs(x) - 0.048) / 0.032, 2)) * Math.exp(-Math.pow((y + 0.018) / 0.034, 2));
        z += cheek * 0.0075;
        x += Math.sign(x) * cheek * 0.003;
      }
      // Natural eye socket recess
      if (z > 0.04 && y > -0.005 && y < 0.038) {
        const socket = Math.exp(-Math.pow((Math.abs(x) - 0.032) / 0.021, 2)) * Math.exp(-Math.pow((y - 0.016) / 0.017, 2));
        z -= socket * 0.0095;
      }
      // Subtle soft brow ridge
      if (z > 0.04 && y > 0.032 && y < 0.056) {
        const brow = Math.exp(-Math.pow((Math.abs(x) - 0.032) / 0.026, 2)) * Math.exp(-Math.pow((y - 0.042) / 0.012, 2));
        z += brow * 0.004;
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Smooth sculpted single-piece knit hair shell per hairstyle (NO blocky capsules!)
  function createSculptedHairGeo(style, s) {
    const geo = new THREE.SphereGeometry(0.106 * s, 36, 26);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Normalize directional ratios
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const nx = x / r;
      const ny = y / r;
      const nz = z / r;

      // Natural head oval scale
      y *= 1.12;
      z *= 1.05;

      // Carve clean face opening on the front (+Z) so forehead, brows, eyes & cheeks are naturally framed!
      const isFront = nz > 0.12;
      let faceCut = 0;
      if (isFront) {
        // Style-specific hairline height on forehead
        let hairlineY = 0.44; // Mom: soft side-parted hairline
        if (style === 'mom') {
          hairlineY = 0.42 + Math.sin(nx * 2.8 + 0.5) * 0.12;
        } else if (style === 'dad') {
          hairlineY = 0.50 - Math.abs(nx) * 0.08;
        } else {
          // Little sister: gentle soft bangs curve just above eyebrows
          hairlineY = 0.38 + Math.pow(Math.abs(nx), 1.6) * 0.08;
        }

        // Width of face opening
        const faceHalfW = style === 'dad' ? 0.80 : 0.72;
        const inFaceX = 1.0 - THREE.MathUtils.smoothstep(Math.abs(nx), faceHalfW - 0.18, faceHalfW + 0.12);
        const inFaceY = 1.0 - THREE.MathUtils.smoothstep(ny, hairlineY - 0.08, hairlineY + 0.14);
        faceCut = inFaceX * inFaceY * THREE.MathUtils.smoothstep(nz, 0.12, 0.42);
      }

      // Pull vertices inside the face opening gently INSIDE the skull so hair wraps cleanly around the face!
      if (faceCut > 0.001) {
        const shrink = 1.0 - faceCut * 0.24;
        x *= shrink;
        y *= shrink;
        z *= shrink;
      } else {
        // Add natural volume & style silhouette outside the face opening!
        const wave = Math.sin(Math.atan2(x, z) * 7.0 + y * 35.0) * 0.0025 * s;
        if (style === 'mom') {
          // Soft full side waves tapering down to jaw + warm crown volume
          if (ny < 0.0 && nz < 0.45) {
            y -= Math.max(0, -ny) * 0.048 * s;
            x *= 1.0 + Math.max(0, -ny) * 0.10;
          }
          if (ny > 0.35) y += 0.009 * s;
        } else if (style === 'dad') {
          // Crisp tapered sides & neat layered top volume
          if (ny < -0.18) {
            // Pull lower back hair cleanly inward at nape
            const nape = Math.min(1, (-ny - 0.18) / 0.5);
            x *= 1.0 - nape * 0.16;
            z *= 1.0 - nape * 0.14;
          }
          if (ny > 0.42) {
            y += 0.014 * s * Math.max(0, ny - 0.42);
            z += 0.008 * s * Math.max(0, nz);
          }
        } else {
          // Fluffy rounded bob framing sister's cheeks & curving gently inward at chin
          if (ny < 0.05 && nz < 0.55) {
            y -= Math.max(0, 0.05 - ny) * 0.032 * s;
            x *= 1.0 + Math.sin(Math.max(0, 0.2 - ny) * 3.0) * 0.12;
          }
          if (ny > 0.3) y += 0.008 * s;
        }
        x += wave;
        z += wave;
      }

      pos.setXYZ(i, x, y + 0.006 * s, z - 0.004 * s);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // C2-smooth natural knit sweater torso with soft organic sloping shoulders (NO sharp ridge!)
  function createNaturalTorsoGeo(s) {
    const geo = new THREE.CylinderGeometry(0.068 * s, 0.165 * s, 0.46 * s, 36, 26, false);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i); // -0.23*s .. +0.23*s
      let z = pos.getZ(i);
      const t = (y / (0.23 * s) + 1) * 0.5; // 0 bottom -> 1 neck top

      // Smooth super-elliptical trapezius-to-shoulder curve (completely continuous slope!)
      const shoulderFade = Math.pow(Math.max(0.0, 1.0 - Math.pow(t, 4.2)), 0.42);
      const widthX = 0.44 + shoulderFade * 0.88 + Math.sin(t * Math.PI) * 0.08;
      const depthZ = 0.42 + Math.pow(Math.max(0.0, 1.0 - Math.pow(t, 3.6)), 0.48) * 0.42;

      const rBase = Math.sqrt(x * x + z * z) || 1;
      const nx = x / rBase;
      const nz = z / rBase;
      const baseR = 0.156 * s;

      pos.setXYZ(i, nx * baseR * widthX, y + 0.055 * s, nz * baseR * depthZ);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const headGeo = createSculptedHeadGeo();
  const eyeGeo = new THREE.SphereGeometry(0.0145, 20, 14);
  const chopstickMat = new THREE.MeshPhysicalMaterial({
    color: 0x5d391e,
    roughness: 0.34,
    clearcoat: 0.48,
  });

  const members = [];

  configs.forEach((cfg, index) => {
    const memberGroup = new THREE.Group();
    memberGroup.position.copy(cfg.seatPos);
    memberGroup.rotation.y = cfg.seatYaw;

    const s = cfg.scale;
    const faceTex = createSkinTextures(cfg.skinHex, cfg.blushHex, 1200 + index * 73, true);
    const bodySkinTex = createSkinTextures(cfg.skinHex, cfg.blushHex, 1230 + index * 73, false);
    const hairTex = createHairTextures(cfg.hairHex, cfg.hairHi, 1400 + index * 97);
    const eyeTex = createEyeTexture(cfg.irisHex);
    const knitTex = createKnitSweaterTextures(cfg.sweaterBase, cfg.sweaterAccent, 900 + index * 111);
    const bowlTex = createBowlTextures(cfg.bowlBase, cfg.bowlRim, 1800 + index * 61);

    const faceMat = new THREE.MeshPhysicalMaterial({
      map: faceTex.map,
      normalMap: faceTex.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.48,
      metalness: 0.0,
      sheen: 0.44,
      sheenColor: new THREE.Color(0xffbfa0),
      sheenRoughness: 0.72,
    });

    const skinMat = new THREE.MeshPhysicalMaterial({
      map: bodySkinTex.map,
      normalMap: bodySkinTex.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.50,
      metalness: 0.0,
      sheen: 0.38,
      sheenColor: new THREE.Color(0xffbfa0),
      sheenRoughness: 0.72,
    });

    const hairMat = new THREE.MeshPhysicalMaterial({
      map: hairTex.map,
      normalMap: hairTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.42,
      metalness: 0.03,
      clearcoat: 0.34,
      clearcoatRoughness: 0.36,
      sheen: 0.48,
      sheenColor: new THREE.Color(cfg.hairHi),
    });

    const sweaterMat = new THREE.MeshPhysicalMaterial({
      map: knitTex.map,
      normalMap: knitTex.normalMap,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.62,
      sheenColor: new THREE.Color(cfg.sweaterBase).lerp(new THREE.Color(0xffffff), 0.16),
      sheenRoughness: 0.86,
    });

    // =========================================================================
    // Seated Body (Natural Sloping Knit Sweater — ZERO puff-ball joints!)
    // =========================================================================
    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0.0, -0.10);
    memberGroup.add(bodyPivot);

    const torsoMesh = new THREE.Mesh(createNaturalTorsoGeo(s), sweaterMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    bodyPivot.add(torsoMesh);

    // Cozy ribbed crew-neck collar resting cleanly at base of neck
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.064 * s, 0.017 * s, 12, 26), sweaterMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.278 * s, 0.005);
    collar.castShadow = true;
    bodyPivot.add(collar);

    if (cfg.id === 'dad') {
      const shirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055 * s, 0.061 * s, 0.045 * s, 16),
        new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.88 })
      );
      shirt.position.set(0, 0.272 * s, 0.012);
      bodyPivot.add(shirt);
    }

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.040 * s, 0.047 * s, 0.082 * s, 18), skinMat);
    neck.position.set(0, 0.308 * s, 0.005);
    neck.castShadow = true;
    bodyPivot.add(neck);

    // =========================================================================
    // Head + Expressive Photorealistic Face
    // =========================================================================
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.415 * s, 0.012);
    bodyPivot.add(headPivot);

    const headMesh = new THREE.Mesh(headGeo, faceMat);
    headMesh.scale.setScalar(s);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headPivot.add(headMesh);

    // Sculpted subtle natural nose (soft bridge + gentle nostrils, never a tiny ball!)
    const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068 * s, 0.020 * s, 6, 10), skinMat);
    noseBridge.scale.set(0.85, 1.0, 0.92);
    noseBridge.position.set(0, 0.005 * s, 0.091 * s);
    noseBridge.rotation.x = -0.26;
    headPivot.add(noseBridge);

    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.0098 * s, 12, 10), skinMat);
    noseTip.scale.set(1.22, 0.78, 0.82);
    noseTip.position.set(0, -0.008 * s, 0.096 * s);
    headPivot.add(noseTip);

    // Ears
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.0165 * s, 10, 8), skinMat);
      ear.scale.set(0.42, 1.15, 0.72);
      ear.position.set(sx * 0.094 * s, 0.002 * s, -0.006 * s);
      headPivot.add(ear);
    }

    // Glossy Realistic Eyes + Animated Upper/Lower Eyelids + Eyebrows
    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });

    const lids = [];
    const brows = [];
    const browMat = new THREE.MeshStandardMaterial({ color: cfg.hairHex, roughness: 0.80 });

    for (const sx of [-1, 1]) {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(sx * 0.032 * s, 0.016 * s, 0.081 * s);
      headPivot.add(eyeSocket);

      const eyeScale = s * (cfg.id === 'sister' ? 1.12 : 1.0);
      const eyeball = new THREE.Mesh(eyeGeo, eyeMat);
      eyeball.scale.setScalar(eyeScale);
      eyeball.rotation.y = -Math.PI / 2;
      eyeSocket.add(eyeball);

      // Upper eyelid cap (open bright friendly gaze, never sleepy!)
      const lidGeo = new THREE.SphereGeometry(0.0156 * eyeScale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.50);
      const lid = new THREE.Mesh(lidGeo, skinMat);
      lid.rotation.x = -1.06;
      eyeSocket.add(lid);
      lids.push(lid);

      // Subtle lower eyelid rim framing bottom of eye gently
      const lowerLidCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.014 * eyeScale, -0.003 * eyeScale, 0.011 * eyeScale),
        new THREE.Vector3(0, -0.009 * eyeScale, 0.014 * eyeScale),
        new THREE.Vector3(0.014 * eyeScale, -0.003 * eyeScale, 0.011 * eyeScale)
      );
      const lowerLid = new THREE.Mesh(new THREE.TubeGeometry(lowerLidCurve, 10, 0.0018 * eyeScale, 6, false), skinMat);
      eyeSocket.add(lowerLid);

      // Delicate upper lash line
      const lashCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.0145 * eyeScale, 0.001 * eyeScale, 0.011 * eyeScale),
        new THREE.Vector3(0, 0.009 * eyeScale, 0.0155 * eyeScale),
        new THREE.Vector3(0.0145 * eyeScale, 0.001 * eyeScale, 0.011 * eyeScale)
      );
      const lash = new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 10, 0.0015 * eyeScale, 6, false), browMat);
      eyeSocket.add(lash);

      // Expressive gently arched eyebrow
      const browCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.016 * s, -0.002 * s, 0),
        new THREE.Vector3(0, 0.0045 * s, 0.004 * s),
        new THREE.Vector3(0.016 * s, -0.001 * s, 0)
      );
      const brow = new THREE.Mesh(new THREE.TubeGeometry(browCurve, 10, 0.0024 * s, 6, false), browMat);
      brow.position.set(sx * 0.033 * s, 0.040 * s, 0.088 * s);
      brow.rotation.y = sx * 0.24;
      headPivot.add(brow);
      brows.push(brow);
    }

    // Clearly Visible Warm Smiling Lips on the Front Face Surface! (z = 0.092 * s)
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: cfg.id === 'dad' ? 0xb86d60 : 0xd6746b,
      roughness: 0.38,
      clearcoat: 0.30,
    });
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.038 * s, 0.092 * s);
    headPivot.add(mouthGroup);

    const upperLipCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.020 * s, 0.0055 * s, -0.006 * s),
      new THREE.Vector3(0, 0.0005 * s, 0.005 * s),
      new THREE.Vector3(0.020 * s, 0.0055 * s, -0.006 * s)
    );
    const lowerLipCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.018 * s, 0.0035 * s, -0.006 * s),
      new THREE.Vector3(0, -0.0065 * s, 0.005 * s),
      new THREE.Vector3(0.018 * s, 0.0035 * s, -0.006 * s)
    );
    const smileLineCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.020 * s, 0.005 * s, -0.005 * s),
      new THREE.Vector3(0, -0.003 * s, 0.006 * s),
      new THREE.Vector3(0.020 * s, 0.005 * s, -0.005 * s)
    );
    const lipMesh = new THREE.Group();
    lipMesh.add(new THREE.Mesh(new THREE.TubeGeometry(upperLipCurve, 14, 0.0030 * s, 8, false), lipMat));
    lipMesh.add(new THREE.Mesh(new THREE.TubeGeometry(lowerLipCurve, 14, 0.0038 * s, 8, false), lipMat));
    lipMesh.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(smileLineCurve, 14, 0.0011 * s, 6, false),
        new THREE.MeshStandardMaterial({ color: 0x7c3c36, roughness: 0.7 })
      )
    );
    mouthGroup.add(lipMesh);

    const openMouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.0115 * s, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b2826, roughness: 0.65 })
    );
    openMouth.scale.set(1.15, 0.01, 0.45);
    openMouth.position.set(0, -0.002 * s, 0.002 * s);
    openMouth.visible = false;
    mouthGroup.add(openMouth);

    // =========================================================================
    // Smooth Sculpted Hair Shell (One continuous natural sculpted silhouette!)
    // =========================================================================
    const hairShell = new THREE.Mesh(createSculptedHairGeo(cfg.hairStyle, s), hairMat);
    hairShell.castShadow = true;
    hairShell.receiveShadow = true;
    headPivot.add(hairShell);

    // Mom's warm soft low bun at back of head
    if (cfg.hairStyle === 'mom') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.044 * s, 16, 12), hairMat);
      bun.position.set(0, -0.015 * s, -0.106 * s);
      headPivot.add(bun);
    }

    // =========================================================================
    // Seamless Articulated Knit Arms & Hands Resting Warmly at the Table
    // =========================================================================
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.148 * s, 0.195 * s, 0.005);
    bodyPivot.add(leftArmPivot);

    const lUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.044 * s, 0.14 * s, 8, 12), sweaterMat);
    lUpper.position.set(-0.006 * s, -0.075 * s, 0.052 * s);
    lUpper.rotation.set(-0.58, 0, -0.08);
    lUpper.castShadow = true;
    leftArmPivot.add(lUpper);

    const lForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.036 * s, 0.13 * s, 8, 12), sweaterMat);
    lForearm.position.set(0.036 * s, -0.148 * s, 0.152 * s);
    lForearm.rotation.set(Math.PI * 0.44, 0, -0.35);
    lForearm.castShadow = true;
    leftArmPivot.add(lForearm);

    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.027 * s, 12, 10), skinMat);
    lHand.scale.set(1.0, 0.72, 1.25);
    lHand.position.set(0.074 * s, -0.158 * s, 0.224 * s);
    leftArmPivot.add(lHand);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.148 * s, 0.195 * s, 0.005);
    bodyPivot.add(rightArmPivot);

    const rUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.044 * s, 0.14 * s, 8, 12), sweaterMat);
    rUpper.position.set(0.006 * s, -0.075 * s, 0.052 * s);
    rUpper.rotation.set(-0.58, 0, 0.08);
    rUpper.castShadow = true;
    rightArmPivot.add(rUpper);

    const rForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.036 * s, 0.13 * s, 8, 12), sweaterMat);
    rForearm.position.set(-0.036 * s, -0.148 * s, 0.152 * s);
    rForearm.rotation.set(Math.PI * 0.44, 0, 0.35);
    rForearm.castShadow = true;
    rightArmPivot.add(rForearm);

    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.027 * s, 12, 10), skinMat);
    rHand.scale.set(1.0, 0.72, 1.25);
    rHand.position.set(-0.074 * s, -0.158 * s, 0.224 * s);
    rightArmPivot.add(rHand);

    // Held chopsticks attached to right hand (visible when eating!)
    const heldChopsticks = new THREE.Group();
    for (const off of [-0.005, 0.005]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0036, 0.19, 8), chopstickMat);
      stick.rotation.z = Math.PI / 2 + off * 8;
      stick.position.set(-0.06, off, 0.01);
      heldChopsticks.add(stick);
    }
    heldChopsticks.position.set(-0.075 * s, -0.150 * s, 0.232 * s);
    heldChopsticks.visible = false;
    rightArmPivot.add(heldChopsticks);

    // =========================================================================
    // Ceramic Serving Bowl (とんすい) + Table Chopsticks
    // =========================================================================
    const bowlPivot = new THREE.Group();
    const bowlRestLocal = cfg.bowlLocal.clone();
    bowlPivot.position.copy(bowlRestLocal);
    memberGroup.add(bowlPivot);

    const bowlMat = new THREE.MeshPhysicalMaterial({
      map: bowlTex.map,
      normalMap: bowlTex.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.20,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
    });

    const bowlProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.036, 0.0),
      new THREE.Vector2(0.044, 0.010),
      new THREE.Vector2(0.068, 0.034),
      new THREE.Vector2(0.074, 0.056),
      new THREE.Vector2(0.069, 0.058),
      new THREE.Vector2(0.062, 0.034),
      new THREE.Vector2(0.038, 0.014),
      new THREE.Vector2(0.0, 0.011),
    ];
    const bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 32), bowlMat);
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    bowlMesh.name = 'familyBowl';
    bowlPivot.add(bowlMesh);

    const tonsuiEar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.009, 0.024), bowlMat);
    tonsuiEar.position.set(0.075, 0.056, 0);
    tonsuiEar.rotation.z = 0.25;
    bowlPivot.add(tonsuiEar);

    const bowlBroth = new THREE.Mesh(
      new THREE.CircleGeometry(0.062, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xdca54b,
        roughness: 0.06,
        transparent: true,
        opacity: 0.90,
        clearcoat: 1.0,
      })
    );
    bowlBroth.rotation.x = -Math.PI / 2;
    bowlBroth.position.y = 0.015;
    bowlBroth.scale.setScalar(0.001);
    bowlBroth.visible = false;
    bowlPivot.add(bowlBroth);

    const bowlHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.118, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bowlHit.position.set(0, 0.045, 0);
    bowlHit.name = 'familyBowlHit';
    bowlPivot.add(bowlHit);

    // Table chopsticks resting neatly beside the bowl
    const tableChopsticks = new THREE.Group();
    const restBlock = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.009, 0.036), bowlMat);
    restBlock.position.set(0.095, 0.005, 0.02);
    tableChopsticks.add(restBlock);
    for (const zOff of [-0.005, 0.005]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0036, 0.20, 8), chopstickMat);
      st.rotation.z = Math.PI / 2;
      st.position.set(0.035, 0.012, 0.02 + zOff);
      tableChopsticks.add(st);
    }
    tableChopsticks.position.set(bowlRestLocal.x, 0, bowlRestLocal.z + 0.07);
    memberGroup.add(tableChopsticks);

    // Subtle woven cloth placemat
    const matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.003, 0.19),
      new THREE.MeshStandardMaterial({ color: 0x362b26, roughness: 0.96 })
    );
    matMesh.position.set(bowlRestLocal.x, 0.0015, bowlRestLocal.z + 0.02);
    matMesh.receiveShadow = true;
    memberGroup.add(matMesh);

    root.add(memberGroup);

    const member = {
      index,
      cfg,
      group: memberGroup,
      bodyPivot,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      bowlPivot,
      bowlRestLocal,
      bowlMesh,
      bowlBroth,
      bowlHit,
      lids,
      brows,
      lipMesh,
      openMouth,
      heldChopsticks,
      tableChopsticks,

      brothFill: 0,
      bowlItems: [],
      mood: 'expectant',
      moodTimer: 0,
      isFavoriteServing: false,
      serveCount: 0,
      blinkTimer: 1.5 + Math.random() * 3.0,
      blinkAmt: 0,
      steamTimer: 0,

      getBowlWorldPos(out = new THREE.Vector3()) {
        bowlPivot.updateMatrixWorld(true);
        out.set(0, 0.04, 0).applyMatrix4(bowlPivot.matrixWorld);
        return out;
      },

      receiveServing(items, audio, potSystem) {
        this.brothFill = Math.min(1, this.brothFill + 0.58);
        bowlBroth.visible = true;
        this.serveCount++;

        let hitFavorite = false;
        const typesPresent = new Set();
        for (const it of items) {
          it.state = 'bowl';
          it.bowlOwner = this;
          it.bowlLocalOffset.set(
            (Math.random() - 0.5) * 0.040,
            0.032 + this.bowlItems.length * 0.008,
            (Math.random() - 0.5) * 0.036
          );
          it.mesh.scale.setScalar(0.76);
          this.bowlItems.push(it);
          typesPresent.add(it.category);
          if (it.category === cfg.favorite) hitFavorite = true;
        }
        for (const it of this.bowlItems) typesPresent.add(it.category);
        const fullCombo = typesPresent.has('cabbage') && typesPresent.has('tofu') && typesPresent.has('mushroom');

        this.isFavoriteServing = hitFavorite || fullCombo;
        this.mood = 'blowing';
        this.moodTimer = 0;

        if (potSystem) {
          potSystem.emitLocalSteam(this.getBowlWorldPos(), 0.095);
        }
        if (audio) {
          setTimeout(() => audio.playFamilyBlow(), 320);
        }
      },

      nudgeReact(audio) {
        if (this.mood === 'expectant') {
          this.mood = 'eager';
          this.moodTimer = 0.6;
        }
        if (audio) audio.playCeramicClink(0.14, 1.1 + index * 0.14);
      },
    };

    bowlHit.userData.familyMember = member;
    bowlMesh.userData.familyMember = member;
    members.push(member);
  });

  scene.add(root);

  let familyCelebrationTimer = 0;

  return {
    root,
    members,
    getBowlHitMeshes() {
      return members.map((m) => m.bowlHit);
    },
    onAnyServed() {
      const allWarm = members.every((m) => m.brothFill > 0.15);
      if (allWarm) familyCelebrationTimer = 3.5;
    },
    update(dt, elapsed, { lookTarget, hoveredMember, potSystem, ingredientSystem, audio }) {
      if (familyCelebrationTimer > 0) familyCelebrationTimer -= dt;
      const boil = potSystem ? potSystem.state.boilLevel : 0;
      const nearOverflow = potSystem && potSystem.state.lidOn && boil > 1.02;

      for (const m of members) {
        const s = m.cfg.scale;

        m.blinkTimer -= dt;
        if (m.blinkTimer <= 0) {
          m.blinkTimer = 2.4 + Math.random() * 3.4;
          m.blinkAmt = 1.0;
        }
        if (m.blinkAmt > 0) {
          m.blinkAmt = Math.max(0, m.blinkAmt - dt * 6.5);
        }

        m.moodTimer += dt;
        if (m.mood === 'blowing') {
          if (m.moodTimer > 1.35) {
            m.mood = 'eating';
            m.moodTimer = 0;
            if (audio) audio.playFamilyHappy(m.index, m.isFavoriteServing);
          } else if (potSystem && Math.random() < dt * 4.5) {
            potSystem.emitLocalSteam(m.getBowlWorldPos(), 0.08);
          }
        } else if (m.mood === 'eating') {
          if (m.moodTimer > 1.8) {
            m.mood = 'delighted';
            m.moodTimer = 0;
            if (m.bowlItems.length > 0 && ingredientSystem) {
              const eaten = m.bowlItems.shift();
              ingredientSystem.removeEaten(eaten);
            }
            m.brothFill = Math.max(0, m.brothFill - 0.34);
          }
        } else if (m.mood === 'delighted') {
          if (m.moodTimer > (m.isFavoriteServing ? 3.2 : 2.2)) {
            m.mood = 'expectant';
            m.moodTimer = 0;
            m.isFavoriteServing = false;
          }
        } else if (m.mood === 'eager' && hoveredMember !== m && m.moodTimer > 1.2) {
          m.mood = 'expectant';
        }

        const isHovered = hoveredMember === m;
        const happyLevel =
          m.mood === 'delighted'
            ? (m.isFavoriteServing ? 1.0 : 0.78)
            : m.mood === 'eating'
              ? 0.55
              : isHovered || familyCelebrationTimer > 0
                ? 0.45
                : 0.0;

        const breath = Math.sin(elapsed * (1.85 + m.index * 0.2) + m.index * 2.1) * 0.0055;
        let leanX = 0.03 + (boil > 0.55 ? 0.05 : 0);
        let swayZ = 0;

        if (nearOverflow) {
          leanX = -0.09;
        } else if (m.mood === 'blowing') {
          leanX = 0.16;
        } else if (m.mood === 'eating') {
          leanX = 0.13 + Math.sin(elapsed * 5.2) * 0.03;
        } else if (m.mood === 'delighted' || familyCelebrationTimer > 0) {
          swayZ = Math.sin(elapsed * (m.isFavoriteServing ? 6.2 : 4.0) + m.index) * (m.isFavoriteServing ? 0.085 : 0.045);
          leanX = 0.07;
        } else if (isHovered) {
          leanX = 0.10;
        }

        m.bodyPivot.position.y = breath;
        m.bodyPivot.rotation.x += (leanX - m.bodyPivot.rotation.x) * Math.min(1, dt * 6);
        m.bodyPivot.rotation.z += (swayZ - m.bodyPivot.rotation.z) * Math.min(1, dt * 6);

        const desiredLook =
          m.mood === 'blowing' || m.mood === 'eating'
            ? m.getBowlWorldPos()
            : m.mood === 'delighted'
              ? new THREE.Vector3(0, 0.48, 0.85)
              : lookTarget || new THREE.Vector3(0, 0.18, 0.0);

        const localTarget = desiredLook.clone();
        m.group.worldToLocal(localTarget);
        const targetYaw = THREE.MathUtils.clamp(Math.atan2(localTarget.x, Math.max(0.2, localTarget.z + 0.1)) * 0.58, -0.42, 0.42);
        let targetPitch = THREE.MathUtils.clamp(-(localTarget.y - 0.36 * s) * 0.42, -0.16, 0.26);

        if (m.mood === 'delighted') {
          targetPitch += Math.sin(elapsed * 7.0) * 0.06;
        }

        m.headPivot.rotation.y += (targetYaw - m.headPivot.rotation.y) * Math.min(1, dt * 5.5);
        m.headPivot.rotation.x += (targetPitch - m.headPivot.rotation.x) * Math.min(1, dt * 5.5);
        m.headPivot.rotation.z += (swayZ * 0.7 - m.headPivot.rotation.z) * Math.min(1, dt * 6.0);

        const squintHappy = m.mood === 'delighted' ? (m.isFavoriteServing ? 0.85 : 0.65) : 0;
        const blinkClose = Math.sin(m.blinkAmt * Math.PI);
        const lidAngle = -1.06 + Math.max(blinkClose * 1.18, squintHappy * 0.82);
        for (const lid of m.lids) {
          lid.rotation.x = lidAngle;
        }
        for (const brow of m.brows) {
          const lift = (isHovered || nearOverflow ? 0.006 : happyLevel * 0.005) * s;
          brow.position.y = 0.040 * s + lift;
        }

        if (m.mood === 'blowing') {
          m.openMouth.visible = true;
          m.openMouth.scale.set(0.62, 0.72, 0.5);
          m.lipMesh.scale.set(0.55, 0.6, 1.0);
        } else if (m.mood === 'delighted') {
          m.openMouth.visible = true;
          const grin = m.isFavoriteServing ? 1.25 : 0.98;
          m.openMouth.scale.set(1.22 * grin, 0.78 * grin, 0.5);
          m.lipMesh.scale.set(1.22 * grin, 1.15, 1.0);
        } else if (m.mood === 'eating') {
          m.openMouth.visible = true;
          const chew = 0.35 + 0.35 * Math.sin(elapsed * 11.0);
          m.openMouth.scale.set(0.85, chew, 0.5);
          m.lipMesh.scale.set(0.95, 1.0, 1.0);
        } else {
          m.openMouth.visible = false;
          m.lipMesh.scale.set(1.0 + happyLevel * 0.18, 1.0, 1.0);
        }

        const liftBowl = isHovered || m.mood === 'blowing' || m.mood === 'eating';
        const targetBowlY = isHovered ? 0.042 : m.mood === 'blowing' || m.mood === 'eating' ? 0.072 : 0.0;
        const targetBowlZ = isHovered ? m.bowlRestLocal.z + 0.032 : m.bowlRestLocal.z;
        m.bowlPivot.position.y += (targetBowlY - m.bowlPivot.position.y) * Math.min(1, dt * 8);
        m.bowlPivot.position.z += (targetBowlZ - m.bowlPivot.position.z) * Math.min(1, dt * 8);

        const targetLArmX = liftBowl ? -0.30 : 0.0;
        const targetRArmX =
          m.mood === 'eating'
            ? -0.42 + Math.sin(elapsed * 6.5) * 0.14
            : m.mood === 'delighted' && m.isFavoriteServing
              ? -0.24 + Math.sin(elapsed * 8.0) * 0.12
              : liftBowl
                ? -0.24
                : 0.0;
        m.leftArmPivot.rotation.x += (targetLArmX - m.leftArmPivot.rotation.x) * Math.min(1, dt * 8);
        m.rightArmPivot.rotation.x += (targetRArmX - m.rightArmPivot.rotation.x) * Math.min(1, dt * 8);

        const usingSticks = m.mood === 'eating' || m.mood === 'blowing';
        m.heldChopsticks.visible = usingSticks;
        m.tableChopsticks.visible = !usingSticks;

        if (m.brothFill > 0.02) {
          m.bowlBroth.visible = true;
          const rScale = 0.65 + m.brothFill * 0.35;
          m.bowlBroth.scale.setScalar(rScale);
          m.bowlBroth.position.y = 0.018 + m.brothFill * 0.022;
          m.steamTimer += dt;
          if (m.steamTimer > 0.42 && potSystem) {
            m.steamTimer = 0;
            potSystem.emitLocalSteam(m.getBowlWorldPos(), 0.068);
          }
        } else {
          m.bowlBroth.visible = false;
        }

        if (m.bowlItems.length > 0) {
          m.bowlPivot.updateMatrixWorld(true);
          for (const it of m.bowlItems) {
            const wp = it.bowlLocalOffset.clone().applyMatrix4(m.bowlPivot.matrixWorld);
            it.mesh.position.lerp(wp, Math.min(1, dt * 16));
          }
        }
      }
    },
  };
}
