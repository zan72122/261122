import * as THREE from 'three';
import { createHumanSkinTextures, createEyeTexture, createHairTexture, createFabricTextures } from './textures.js';

// Smooth Gaussian helper for organic craniofacial sculpting
function gauss(dx, dy, sx, sy) {
  const q = (dx * dx) / (sx * sx) + (dy * dy) / (sy * sy);
  return q > 9.0 ? 0.0 : Math.exp(-q);
}

// Photorealistic Subsurface-Scattered Human Skin Material
function createSkinMaterial(skinTex, sunDir) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.00055,
    roughness: 0.47,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.42,
    sheen: 0.28,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffdfd0),
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: sunDir.clone().normalize() };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform vec3 uSunDir;`
    );
    // Warm dermal subsurface wrap scatter at shadow terminator & backlit ear/finger glow
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
       vec3 sssNormal = normalize(vNormal);
       vec3 viewSun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
       float ndl = dot(sssNormal, viewSun);
       // Terminator red-peach dermal scatter band
       float terminator = exp(-pow((ndl + 0.12) / 0.42, 2.0)) * 0.11;
       // Backlit ear/nose/finger translucency
       float backGlow = pow(clamp(dot(-normalize(vViewPosition), viewSun), 0.0, 1.0), 3.2) *
                        pow(1.0 - abs(dot(sssNormal, normalize(vViewPosition))), 1.5) * 0.16;
       gl_FragColor.rgb += vec3(0.95, 0.34, 0.20) * (terminator + backGlow);
       #include <dithering_fragment>
      `
    );
  };
  return mat;
}

export class MomAndChild {
  constructor(scene, sunDir) {
    this.scene = scene;
    this.sunDir = sunDir;

    const skinTex = createHumanSkinTextures();
    this.skinMat = createSkinMaterial(skinTex, sunDir);
    this.nailMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7d5cb,
      roughness: 0.18,
      clearcoat: 0.88,
      clearcoatRoughness: 0.10,
    });

    const sweaterTex = createFabricTextures('#d9ccb8', 1.25);
    this.sweaterMat = new THREE.MeshStandardMaterial({
      map: sweaterTex.map,
      bumpMap: sweaterTex.bumpMap,
      bumpScale: 0.0028,
      roughness: 0.88,
    });

    const apronTex = createFabricTextures('#7d917b', 1.6);
    this.apronMat = new THREE.MeshStandardMaterial({
      map: apronTex.map,
      bumpMap: apronTex.bumpMap,
      bumpScale: 0.0022,
      roughness: 0.86,
    });

    const childKnitTex = createFabricTextures('#f2b8a2', 1.3);
    this.childSweaterMat = new THREE.MeshStandardMaterial({
      map: childKnitTex.map,
      bumpMap: childKnitTex.bumpMap,
      bumpScale: 0.0028,
      roughness: 0.88,
    });

    this.root = new THREE.Group();
    // Mom leans warmly at comfortable child-eye height behind the stove so her full face & hair stay in frame!
    this.baseMomPos = new THREE.Vector3(-0.075, -0.032, -0.335);
    this.root.position.copy(this.baseMomPos);
    scene.add(this.root);

    // Animation states
    this.smile = 0.42;
    this.targetSmile = 0.42;
    this.mouthOpen = 0.05;
    this.targetMouthOpen = 0.05;
    this.browLift = 0.08;
    this.targetBrowLift = 0.08;
    this.blink = 0;
    this.blinkTimer = 2.6;
    this.nodOffset = 0;
    this.nodVel = 0;

    this.lookTarget = new THREE.Vector3(-0.06, 0.06, 0.08);
    this.smoothLookTarget = this.lookTarget.clone();

    // Right hand (anatomical right, on -X / screen-left side!) & Left hand (anatomical left, on +X / screen-right side!)
    this.rightHandTarget = new THREE.Vector3(-0.24, 0.075, 0.18);
    this.leftHandTarget = new THREE.Vector3(0.08, 0.14, -0.06);
    this.rightHandRot = new THREE.Euler(0, 0, 0);
    this.leftHandRot = new THREE.Euler(0, 0, 0);
    this.rightGrip = 0.78;
    this.leftGrip = 0.65;

    this._buildTorso();
    this._buildSculptedHeadAndHair();
    this._buildArmsAndHands();
    this._buildChildOverTheShoulder();
  }

  _buildTorso() {
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.035, 0);
    // Gentle natural forward lean toward skillet & child
    this.torsoGroup.rotation.x = 0.14;
    this.torsoGroup.rotation.y = 0.16;
    this.root.add(this.torsoGroup);

    // Continuous organic sculpted female upper torso & sloping shoulders (SphereGeometry -> zero flat cylinder caps!)
    const torsoGeo = new THREE.SphereGeometry(1, 42, 32);
    const tPos = torsoGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const ux = tPos.getX(i);
      const uy = tPos.getY(i);
      const uz = tPos.getZ(i);

      // Map uy [-1..1] to torso height [-0.16 .. +0.235]
      // Wide rounded shoulders near uy=0.55, sloping smoothly inward to neck base at uy=1.0!
      const waistTaper = uy < 0 ? 1.0 + uy * 0.20 : 1.0;
      // Smooth feminine trapezius & shoulder slope (no puffy shoulder pads!)
      const shoulderFlare = uy > -0.15 && uy < 0.65 ? 1.0 + Math.sin(((uy + 0.15) / 0.80) * Math.PI) * 0.18 : 1.0 - Math.max(0, uy - 0.65) * 0.35;

      let px = ux * 0.158 * waistTaper * shoulderFlare;
      let py = uy * 0.192 + 0.042;
      let pz = uz * 0.096 * (0.88 + 0.12 * waistTaper);

      // Subtle bust & ribcage contour in front (+Z)
      if (uz > 0 && uy > -0.35 && uy < 0.42) {
        const chest = Math.cos(((uy - 0.05) / 0.38) * Math.PI * 0.5);
        pz += chest * chest * 0.016 * uz;
      }
      tPos.setXYZ(i, px, py, pz);
    }
    torsoGeo.computeVertexNormals();
    const sweaterBody = new THREE.Mesh(torsoGeo, this.sweaterMat);
    sweaterBody.castShadow = true;
    sweaterBody.receiveShadow = true;
    this.torsoGroup.add(sweaterBody);

    // Subtle natural shoulder-joint rounding tucked smoothly along trapezius line (never puffy!)
    [-1, 1].forEach((side) => {
      const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.044, 18, 14), this.sweaterMat);
      deltoid.scale.set(1.02, 0.82, 0.90);
      deltoid.position.set(side * 0.148, 0.148, 0.005);
      deltoid.castShadow = true;
      deltoid.receiveShadow = true;
      this.torsoGroup.add(deltoid);
    });

    // Cozy ribbed crew-neck collar hugging neck base
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 14, 36), this.sweaterMat);
    collar.rotation.x = Math.PI / 2 + 0.12;
    collar.scale.set(1.08, 0.95, 1.0);
    collar.position.set(0, 0.228, 0.010);
    this.torsoGroup.add(collar);

    // Sage-olive linen kitchen apron bib with soft draped folds & stitched front pocket
    const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.195, 0.24, 16, 16), this.apronMat);
    const bPos = bib.geometry.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const bx = bPos.getX(i);
      const by = bPos.getY(i);
      const ny = (by + 0.12) / 0.24;
      const widthTaper = 1.0 - ny * 0.12;
      const tx = bx * widthTaper;
      // Wrap smoothly around sculpted sweater front without clipping!
      const curveZ = Math.sqrt(Math.max(0.001, 0.128 * 0.128 - tx * tx * 0.55)) + Math.sin(ny * Math.PI) * 0.012;
      const fold = Math.sin(tx * 55.0) * 0.0016 * (1 - ny);
      bPos.setXYZ(i, tx, by, curveZ + fold);
    }
    bib.geometry.computeVertexNormals();
    bib.position.set(0, 0.048, 0.004);
    bib.receiveShadow = true;
    this.torsoGroup.add(bib);

    // Apron neck halter straps staying cleanly outside sweater surface up around collar!
    [-1, 1].forEach((side) => {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.078, 0.162, 0.112),
        new THREE.Vector3(side * 0.072, 0.198, 0.086),
        new THREE.Vector3(side * 0.060, 0.232, 0.042),
        new THREE.Vector3(side * 0.044, 0.238, -0.015),
      ]);
      const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 16, 0.0068, 8, false), this.apronMat);
      this.torsoGroup.add(strap);
    });

    // Smooth anatomical neck + warm collar shadow
    const neckGeo = new THREE.CylinderGeometry(0.043, 0.052, 0.105, 32, 6);
    const neck = new THREE.Mesh(neckGeo, this.skinMat);
    neck.position.set(0, 0.262, 0.008);
    neck.rotation.x = -0.05;
    neck.castShadow = true;
    neck.receiveShadow = true;
    this.torsoGroup.add(neck);

    // Shoulder sockets inside the rounded deltoid caps (zero gap!)
    this.rightShoulderAnchor = new THREE.Object3D();
    this.rightShoulderAnchor.position.set(-0.148, 0.148, 0.006);
    this.torsoGroup.add(this.rightShoulderAnchor);

    this.leftShoulderAnchor = new THREE.Object3D();
    this.leftShoulderAnchor.position.set(0.148, 0.148, 0.006);
    this.torsoGroup.add(this.leftShoulderAnchor);
  }

  _buildSculptedHeadAndHair() {
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.305, 0.014);
    this.torsoGroup.add(this.headPivot);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.045, 0.006);
    this.headPivot.add(this.headGroup);

    // High-resolution continuous craniofacial mesh (84x84 smooth organic topology)
    const headGeo = new THREE.SphereGeometry(1, 84, 84);
    const pos = headGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // Store rest positions & morph deltas for smile, mouthOpen, browLift, blink!
    this.faceRest = new Float32Array(pos.count * 3);
    this.morphSmile = new Float32Array(pos.count * 3);
    this.morphMouth = new Float32Array(pos.count * 3);
    this.morphBlink = new Float32Array(pos.count * 3);

    const baseSkinTint = new THREE.Color(1, 1, 1);

    for (let i = 0; i < pos.count; i++) {
      const ux = pos.getX(i);
      const uy = pos.getY(i);
      const uz = pos.getZ(i);

      // Base feminine cranial proportions (meters)
      let x = ux * 0.077;
      let y = uy * 0.099;
      let z = uz * 0.088;

      const front = Math.max(0, uz);
      const ax = Math.abs(ux);

      // 1. Cranium fullness at back/crown + tapered feminine oval jawline & chin
      if (uy < 0.08) {
        const jawT = Math.min(1, (0.08 - uy) / 1.08);
        const chinNarrow = 1.0 - Math.pow(jawT, 1.35) * (0.34 * front + 0.18 * (1 - front));
        x *= chinNarrow;
        z *= 1.0 - Math.pow(jawT, 1.8) * 0.14;
      }
      // Subtle chin pad projection
      const chinLobe = gauss(ux, uy + 0.76, 0.28, 0.18) * front;
      z += chinLobe * 0.0085;
      y -= chinLobe * 0.003;

      // Submental tuck under chin/jaw so jawline has crisp natural portrait shadow!
      if (uy < -0.58 && uz > -0.25 && uz < 0.62) {
        const underJaw = gauss(uy + 0.85, uz - 0.18, 0.22, 0.35);
        y += underJaw * 0.009;
      }

      // 2. Forehead & gentle supraorbital brow arch
      const forehead = gauss(ux, uy - 0.48, 0.75, 0.38) * front;
      z += forehead * 0.0055;
      const brow = gauss(ax - 0.36, uy - 0.20, 0.26, 0.085) * front;
      z += brow * 0.0045;

      // 3. Deep clean eye sockets so spherical eyeballs + sculpted 3D eyelids sit with zero polygon Z-fighting!
      const eyeCx = 0.355;
      const eyeCy = 0.065;
      const socket = gauss(ax - eyeCx, uy - eyeCy, 0.21, 0.145) * front;
      z -= socket * 0.0195;

      // Subtle infraorbital / supraorbital transition
      const upperLid = gauss(ax - eyeCx, uy - (eyeCy + 0.075), 0.175, 0.045) * front;
      const lowerLid = gauss(ax - eyeCx, uy - (eyeCy - 0.075), 0.165, 0.040) * front;
      z += upperLid * 0.0045 + lowerLid * 0.0038;

      // 4. Malar cheekbones & soft warm cheeks (essential for warm motherly look!)
      const cheek = gauss(ax - 0.48, uy + 0.17, 0.30, 0.24) * front;
      z += cheek * 0.0078;
      x += Math.sign(ux) * cheek * 0.0038;

      // 5. Delicate feminine nose: gentle bridge -> soft petite rounded tip -> subtle alar wings
      const bridge = gauss(ux, uy + 0.03, 0.088, 0.20) * front;
      const noseTip = gauss(ux, uy + 0.185, 0.105, 0.095) * front;
      const nostrilWing = gauss(ax - 0.125, uy + 0.215, 0.065, 0.058) * front;
      const nostrilHole = gauss(ax - 0.078, uy + 0.248, 0.038, 0.028) * front;
      z += bridge * 0.0105 + noseTip * 0.0165 + nostrilWing * 0.0065 - nostrilHole * 0.0038;
      y -= noseTip * 0.0015;

      // 6. Philtrum & Sculpted Vermilion Lips (Cupid's bow upper lip + soft lower lip + oral fissure)
      const philtrum = gauss(ux, uy + 0.33, 0.065, 0.065) * front;
      z -= philtrum * 0.0018;

      const cupidsDip = gauss(ux, uy + 0.395, 0.045, 0.028) * front;
      const upperLip = gauss(ux, uy + 0.418, 0.21, 0.042) * front;
      const lowerLip = gauss(ux, uy + 0.485, 0.185, 0.048) * front;
      const mouthSeam = gauss(ux, uy + 0.448, 0.215, 0.018) * front;
      const mouthCorner = gauss(ax - 0.215, uy + 0.445, 0.055, 0.045) * front;

      z += upperLip * 0.0082 - cupidsDip * 0.0018 + lowerLip * 0.0086 - mouthSeam * 0.0062 - mouthCorner * 0.0032;

      // 7. Soft sculpted ears on sides (backlit by morning sun!)
      const earSide = gauss(uz + 0.06, uy + 0.04, 0.14, 0.22) * (ax > 0.92 ? 1 : 0);
      x += Math.sign(ux) * earSide * 0.0105;
      z -= earSide * 0.004;

      this.faceRest[i * 3] = x;
      this.faceRest[i * 3 + 1] = y;
      this.faceRest[i * 3 + 2] = z;

      // --- Precompute smooth facial expression morph deltas ---
      // Smile: lifts mouth corners & cheeks, gently narrows lower eyelid ("eye smile" Duchenne warmth!)
      const cornerInfluence = gauss(ax - 0.20, uy + 0.44, 0.14, 0.12) * front;
      const cheekLift = gauss(ax - 0.45, uy + 0.20, 0.24, 0.18) * front;
      const eyeSmile = gauss(ax - eyeCx, uy - (eyeCy - 0.055), 0.15, 0.045) * front;
      this.morphSmile[i * 3] = Math.sign(ux) * cornerInfluence * 0.0055;
      this.morphSmile[i * 3 + 1] = cornerInfluence * 0.0078 + cheekLift * 0.0038 + eyeSmile * 0.0026;
      this.morphSmile[i * 3 + 2] = cheekLift * 0.0025 - cornerInfluence * 0.0015;

      // Mouth open ("わぁ!" / happy "あーん"): lowers jaw & lower lip smoothly
      const lowerJawMask = uy < -0.43 ? gauss(ux, uy + 0.62, 0.38, 0.28) * front : 0;
      const lowerLipDrop = gauss(ux, uy + 0.49, 0.22, 0.08) * front;
      this.morphMouth[i * 3] = 0;
      this.morphMouth[i * 3 + 1] = -(lowerJawMask * 0.009 + lowerLipDrop * 0.0065);
      this.morphMouth[i * 3 + 2] = -lowerJawMask * 0.0025;

      // Natural blink: sweeps upper eyelid smoothly down & slightly forward over cornea
      const blinkMask = gauss(ax - eyeCx, uy - (eyeCy + 0.045), 0.155, 0.055) * front;
      this.morphBlink[i * 3] = 0;
      this.morphBlink[i * 3 + 1] = -blinkMask * 0.0115;
      this.morphBlink[i * 3 + 2] = blinkMask * 0.0038;

      // Subtle natural complexion vertex tint (rose blush on cheeks, natural coral-pink lips, soft eyelid warmth, dark nostril/mouth interior)
      baseSkinTint.setRGB(1.0, 1.0, 1.0);
      // Cheek blush
      const blush = gauss(ax - 0.46, uy + 0.16, 0.24, 0.16) * front;
      baseSkinTint.r += blush * 0.03;
      baseSkinTint.g -= blush * 0.065;
      baseSkinTint.b -= blush * 0.075;

      // Natural rosy-pink vermilion lips + crisp warm smile seam
      const lipTint = Math.min(1, (upperLip * 1.25 + lowerLip * 1.20));
      baseSkinTint.r = THREE.MathUtils.lerp(baseSkinTint.r, 0.84, lipTint * 0.72);
      baseSkinTint.g = THREE.MathUtils.lerp(baseSkinTint.g, 0.38, lipTint * 0.78);
      baseSkinTint.b = THREE.MathUtils.lerp(baseSkinTint.b, 0.40, lipTint * 0.76);

      // Soft upper lash-line shadow & clean mouth seam crease
      const lashLine = gauss(ax - eyeCx, uy - (eyeCy + 0.045), 0.135, 0.020) * front;
      baseSkinTint.multiplyScalar(1.0 - lashLine * 0.25);
      baseSkinTint.multiplyScalar(1.0 - mouthSeam * 0.52 - mouthCorner * 0.38 - nostrilHole * 0.45);

      colors[i * 3] = baseSkinTint.r;
      colors[i * 3 + 1] = baseSkinTint.g;
      colors[i * 3 + 2] = baseSkinTint.b;
    }

    headGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.headSkinMat = this.skinMat.clone();
    this.headSkinMat.vertexColors = true;

    this.headMesh = new THREE.Mesh(headGeo, this.headSkinMat);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headGroup.add(this.headMesh);

    // Warm dark oral interior recessed safely INSIDE head behind parted lips (never pokes through chin!)
    this.mouthInterior = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x4a1919 })
    );
    this.mouthInterior.scale.set(1.15, 0.55, 0.45);
    this.mouthInterior.position.set(0, -0.043, 0.057);
    this.headGroup.add(this.mouthInterior);

    // Subtle upper teeth tucked cleanly behind upper lip when mouth opens
    this.teethMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.0045, 14, 1, true, -0.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xf7efe6, roughness: 0.25, side: THREE.DoubleSide })
    );
    this.teethMesh.position.set(0, -0.0405, 0.054);
    this.headGroup.add(this.teethMesh);

    // --- Realistic Wet Refractive Eyes + Lashes + Feathered Eyebrows ---
    const eyeTex = createEyeTexture();
    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.03,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.38,
    });

    // Orient SphereGeometry UV so center (0.5, 0.5) faces +Z directly!
    const eyeGeo = new THREE.SphereGeometry(0.0128, 28, 24);
    eyeGeo.rotateY(-Math.PI / 2);

    this.eyes = [];
    this.upperLids = [];
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x1d110c, roughness: 0.48 });
    const browMat = new THREE.MeshStandardMaterial({
      color: 0x4d3324,
      roughness: 0.78,
      transparent: true,
      opacity: 0.80,
    });
    this.brows = [];

    // Smooth 3D spherical upper & lower eyelid shells hugging each eyeball cleanly (zero jagged edges!)
    const upperLidGeo = new THREE.SphereGeometry(0.0135, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.46);
    const lowerLidGeo = new THREE.SphereGeometry(0.0133, 24, 12, 0, Math.PI * 2, Math.PI * 0.60, Math.PI * 0.40);

    [-1, 1].forEach((side) => {
      const eyeHolder = new THREE.Group();
      eyeHolder.position.set(side * 0.0272, 0.0064, 0.0712);
      this.headGroup.add(eyeHolder);

      const eyePivot = new THREE.Group();
      const eyeBall = new THREE.Mesh(eyeGeo, eyeMat);
      eyePivot.add(eyeBall);
      eyeHolder.add(eyePivot);
      this.eyes.push(eyePivot);

      // Upper eyelid shell opens brightly (-0.42) & sweeps down cleanly when blinking!
      const uLid = new THREE.Mesh(upperLidGeo, this.skinMat);
      uLid.rotation.x = -0.42;
      uLid.rotation.z = -side * 0.06;
      eyeHolder.add(uLid);
      this.upperLids.push(uLid);

      // Attach upper eyelash arch right along outer rim of uLid (theta = 0.46*PI -> y = 0.0017, r_xz = 0.0134)
      const lashCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * -0.0105, 0.0016, 0.0092),
        new THREE.Vector3(0, 0.0017, 0.0139),
        new THREE.Vector3(side * 0.0112, 0.0012, 0.0086),
      ]);
      const lash = new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 14, 0.0012, 6, false), lashMat);
      uLid.add(lash);

      // Lower eyelid cushion
      const lLid = new THREE.Mesh(lowerLidGeo, this.skinMat);
      lLid.rotation.x = 0.24;
      eyeHolder.add(lLid);

      // Natural soft tapered eyebrow ON forehead skin surface
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.0145, 0.0245, 0.0862),
        new THREE.Vector3(side * 0.0268, 0.0292, 0.0870),
        new THREE.Vector3(side * 0.0395, 0.0268, 0.0825),
        new THREE.Vector3(side * 0.0475, 0.0218, 0.0762),
      ]);
      const browGeo = new THREE.TubeGeometry(browCurve, 16, 0.0019, 6, false);
      const brow = new THREE.Mesh(browGeo, browMat);
      this.headGroup.add(brow);
      this.brows.push({ mesh: brow, baseY: 0 });
    });

    // --- Layered Photorealistic Hair (Scalp Volume + Swept Locks + Morning Bun + Sunlit Wisps) ---
    const hairTex = createHairTexture();
    const hairMat = new THREE.MeshPhysicalMaterial({
      map: hairTex,
      bumpMap: hairTex,
      bumpScale: 0.0012,
      color: 0x3b2519,
      roughness: 0.36,
      metalness: 0.04,
      sheen: 0.65,
      sheenRoughness: 0.32,
      sheenColor: new THREE.Color(0xc98a55), // golden morning sun rim sheen on hair!
      clearcoat: 0.18,
      clearcoatRoughness: 0.45,
    });

    this.hairGroup = new THREE.Group();
    this.headGroup.add(this.hairGroup);

    // Base cranial hair volume covering crown, temples & nape seamlessly
    const scalpGeo = new THREE.SphereGeometry(0.0825, 42, 36);
    const sPos = scalpGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      let sx = sPos.getX(i) * 0.99;
      let sy = sPos.getY(i) * 1.21 + 0.008;
      let sz = sPos.getZ(i) * 1.11 - 0.008;
      // Carve away front facial oval cleanly so forehead & cheeks show naturally
      if (sz > 0.02 && sy < 0.058) {
        const pushBack = smoothStep(0.058, -0.02, sy) * smoothStep(0.02, 0.075, sz);
        sz -= pushBack * 0.058;
      }
      sPos.setXYZ(i, sx, sy, sz);
    }
    scalpGeo.computeVertexNormals();
    const scalpMesh = new THREE.Mesh(scalpGeo, hairMat);
    scalpMesh.castShadow = true;
    this.hairGroup.add(scalpMesh);

    // Relaxed morning low bun gathered at nape (-Z, slightly visible in 3/4 view catching rim sun!)
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.046, 24, 20), hairMat);
    bun.scale.set(1.08, 0.92, 0.95);
    bun.position.set(-0.008, -0.026, -0.098);
    bun.castShadow = true;
    this.hairGroup.add(bun);

    // Soft fabric hair scrunchie around morning bun
    const scrunchie = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.009, 10, 24),
      this.apronMat
    );
    scrunchie.position.set(-0.006, -0.024, -0.082);
    scrunchie.rotation.x = 0.25;
    this.hairGroup.add(scrunchie);

    // Sculpted flowing hair locks: side-swept soft bangs & face-framing temple tendrils
    const addHairLock = (pts, rStart, rEnd) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      const segs = 22;
      const geo = new THREE.TubeGeometry(curve, segs, 1, 8, false);
      const gp = geo.attributes.position;
      const frames = curve.computeFrenetFrames(segs, false);
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const pCenter = curve.getPointAt(t);
        // Taper lock smoothly to fine tip!
        const rad = THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 1.3)) * (0.85 + 0.35 * Math.sin(t * Math.PI));
        for (let r = 0; r <= 8; r++) {
          const vi = s * 9 + r;
          const vx = gp.getX(vi) - pCenter.x;
          const vy = gp.getY(vi) - pCenter.y;
          const vz = gp.getZ(vi) - pCenter.z;
          // Slightly ribbon-flatten along normal for natural layered hair look
          const nDot = vx * frames.normals[s].x + vy * frames.normals[s].y + vz * frames.normals[s].z;
          gp.setXYZ(
            vi,
            pCenter.x + (vx - frames.normals[s].x * nDot * 0.42) * rad,
            pCenter.y + (vy - frames.normals[s].y * nDot * 0.42) * rad,
            pCenter.z + (vz - frames.normals[s].z * nDot * 0.42) * rad
          );
        }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, hairMat);
      m.castShadow = true;
      this.hairGroup.add(m);
    };

    // Crown part at x = -0.018 sweeping gently across forehead & both temples
    const locks = [
      // Soft airy side-swept bangs (right-to-left across upper forehead, never covering eyes!)
      [[-0.016, 0.098, 0.032], [0.018, 0.088, 0.068], [0.052, 0.056, 0.072], [0.074, 0.015, 0.048], [0.078, -0.035, 0.012]],
      [[-0.018, 0.096, 0.040], [0.004, 0.078, 0.079], [0.034, 0.050, 0.081], [0.058, 0.018, 0.064]],
      [[-0.020, 0.096, 0.036], [-0.046, 0.076, 0.072], [-0.068, 0.038, 0.062], [-0.079, -0.012, 0.036], [-0.076, -0.064, 0.022]],
      [[-0.024, 0.095, 0.024], [-0.062, 0.065, 0.052], [-0.082, 0.015, 0.028], [-0.078, -0.042, -0.018], [-0.042, -0.042, -0.078]],
      // Left side swept lock into low bun + soft cheek tendril
      [[0.015, 0.098, 0.018], [0.066, 0.062, 0.042], [0.083, 0.008, 0.016], [0.076, -0.045, -0.026], [0.028, -0.038, -0.084]],
      [[0.048, 0.052, 0.062], [0.075, 0.006, 0.054], [0.078, -0.048, 0.038], [0.069, -0.086, 0.028]],
      // Right cheek sunlit tendril (catches golden window light!)
      [[-0.052, 0.052, 0.058], [-0.077, 0.004, 0.048], [-0.081, -0.050, 0.032], [-0.071, -0.088, 0.024]],
      // Crown volume sweeps back into bun
      [[-0.012, 0.106, 0.010], [-0.045, 0.092, -0.048], [-0.042, 0.032, -0.092], [-0.015, -0.022, -0.096]],
      [[0.012, 0.105, 0.010], [0.045, 0.090, -0.048], [0.040, 0.030, -0.092], [0.010, -0.022, -0.096]],
      [[0.0, 0.108, -0.010], [0.0, 0.075, -0.078], [-0.005, 0.012, -0.102], [-0.008, -0.024, -0.098]],
    ];
    locks.forEach((pts, idx) => {
      const thin = idx === 5 || idx === 6;
      addHairLock(pts, thin ? 0.009 : 0.018, thin ? 0.0022 : 0.006);
    });

    this._applyFaceMorphs();
  }

  _applyFaceMorphs() {
    const pos = this.headMesh.geometry.attributes.position;
    const n = pos.count;
    const sm = this.smile;
    const mo = this.mouthOpen;
    const bl = this.blink;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      pos.setXYZ(
        i,
        this.faceRest[i3] + this.morphSmile[i3] * sm + this.morphMouth[i3] * mo + this.morphBlink[i3] * bl,
        this.faceRest[i3 + 1] + this.morphSmile[i3 + 1] * sm + this.morphMouth[i3 + 1] * mo + this.morphBlink[i3 + 1] * bl,
        this.faceRest[i3 + 2] + this.morphSmile[i3 + 2] * sm + this.morphMouth[i3 + 2] * mo + this.morphBlink[i3 + 2] * bl
      );
    }
    pos.needsUpdate = true;
    this.headMesh.geometry.computeVertexNormals();
  }

  _buildArmsAndHands() {
    // Upper arm + cozy rolled-up knit sleeve + sculpted bare forearm + detailed 5-finger anatomical hand!
    this.rightArm = this._createArticulatedArm('right'); // -X side (screen-left)
    this.leftArm = this._createArticulatedArm('left');   // +X side (screen-right)
  }

  _createArticulatedArm(side) {
    const isRight = side === 'right'; // Mom's anatomical right is on -X; thumb is on +X/up inner side when palm faces inward
    const group = new THREE.Group();
    this.scene.add(group);

    // Knit upper sleeve with rounded hemisphere shoulder & elbow caps (zero flat cylinder seams!)
    const upperGroup = new THREE.Group();
    const upperTubeGeo = new THREE.CylinderGeometry(0.042, 0.047, 0.265, 20, 4, true);
    upperTubeGeo.translate(0, 0.1325, 0);
    upperTubeGeo.rotateX(Math.PI / 2);
    const upperTube = new THREE.Mesh(upperTubeGeo, this.sweaterMat);
    upperTube.castShadow = true;
    upperTube.receiveShadow = true;
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.0475, 18, 14), this.sweaterMat);
    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), this.sweaterMat);
    elbowCap.position.z = 0.265;
    upperGroup.add(shoulderCap, upperTube, elbowCap);
    group.add(upperGroup);
    const upperMesh = upperGroup;

    // Rolled-up cozy knit cuff just past the elbow (shows Mom's bare forearms & wrists clearly!)
    const cuffMesh = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.012, 12, 24), this.sweaterMat);
    cuffMesh.castShadow = true;
    group.add(cuffMesh);

    // Sculpted bare skin forearm tapering organically to rounded wrist
    const foreGroup = new THREE.Group();
    const foreGeo = new THREE.CylinderGeometry(0.024, 0.036, 0.245, 22, 4, true);
    foreGeo.translate(0, 0.1225, 0);
    foreGeo.rotateX(Math.PI / 2); // +Z from elbow toward wrist
    const foreTube = new THREE.Mesh(foreGeo, this.skinMat);
    foreTube.castShadow = true;
    foreTube.receiveShadow = true;
    const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.0245, 16, 12), this.skinMat);
    wristCap.scale.set(1.15, 0.82, 1.0);
    wristCap.position.z = 0.245;
    foreGroup.add(foreTube, wristCap);
    group.add(foreGroup);
    const foreMesh = foreGroup;

    // Wrist & Hand root (+Z = finger direction, -Y = palmar side, thumb on radial side!)
    // Let's verify radial thumb side when +Z points forward from wrist and -Y is palm-down:
    // For Mom's RIGHT hand (palm down -Y, fingers +Z): thumb is on HER left (+X)!
    // For Mom's LEFT hand (palm down -Y, fingers +Z): thumb is on HER right (-X)!
    const thumbSign = isRight ? 1 : -1;

    const handRoot = new THREE.Group();
    group.add(handRoot);

    // Continuous organic sculpted palm (metacarpal arch + soft dorsal tendons + palmar heel & thenar pad)
    const palmGeo = new THREE.SphereGeometry(1, 28, 24);
    const pp = palmGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const ux = pp.getX(i);
      const uy = pp.getY(i);
      const uz = pp.getZ(i);
      // Width ~ 7.4cm, thickness ~ 2.4cm, length ~ 8.2cm
      const z01 = uz * 0.5 + 0.5; // 0 wrist -> 1 knuckles
      const widthFlare = 0.84 + z01 * 0.24;
      let px = ux * 0.037 * widthFlare;
      let py = uy * 0.0125 * (1.08 - z01 * 0.18);
      let pz = z01 * 0.080;

      // Soft palmar hollow (-Y) & gentle dorsal arch (+Y)
      if (uy < 0) {
        const hollow = gauss(ux, uz, 0.55, 0.55);
        py += hollow * 0.0035;
      }
      // Muscular thumb thenar pad on radial palmar side
      const thenar = gauss(ux - thumbSign * 0.65, uz + 0.25, 0.45, 0.48) * (uy < 0.2 ? 1 : 0);
      py -= thenar * 0.0065;
      px += thumbSign * thenar * 0.0055;

      pp.setXYZ(i, px, py, pz);
    }
    palmGeo.computeVertexNormals();
    const palmMesh = new THREE.Mesh(palmGeo, this.skinMat);
    palmMesh.castShadow = true;
    palmMesh.receiveShadow = true;
    handRoot.add(palmMesh);

    // 4 Articulated 3-phalange fingers (Index, Middle, Ring, Little) with glossy fingernails!
    const fingerSpecs = [
      { x: thumbSign * 0.027, z: 0.074, len: 0.068, rad: 0.0076, splay: thumbSign * 0.07 },  // Index
      { x: thumbSign * 0.009, z: 0.077, len: 0.074, rad: 0.0080, splay: thumbSign * 0.015 }, // Middle
      { x: -thumbSign * 0.009, z: 0.075, len: 0.070, rad: 0.0075, splay: -thumbSign * 0.03 }, // Ring
      { x: -thumbSign * 0.026, z: 0.070, len: 0.057, rad: 0.0066, splay: -thumbSign * 0.08 }, // Little
    ];

    const fingers = fingerSpecs.map((spec) => this._createFingerChain(spec.len, spec.rad, false));
    fingers.forEach((f, idx) => {
      f.base.position.set(fingerSpecs[idx].x, 0.001, fingerSpecs[idx].z);
      f.base.rotation.y = fingerSpecs[idx].splay;
      handRoot.add(f.base);
    });

    // Articulated opposable Thumb on radial side
    const thumb = this._createFingerChain(0.056, 0.0088, true);
    thumb.base.position.set(thumbSign * 0.033, -0.004, 0.024);
    thumb.base.rotation.y = thumbSign * 0.62;
    thumb.base.rotation.z = -thumbSign * 0.45;
    handRoot.add(thumb.base);

    return {
      isRight,
      thumbSign,
      group,
      upperMesh,
      cuffMesh,
      foreMesh,
      handRoot,
      fingers,
      thumb,
    };
  }

  _createFingerChain(totalLen, baseRad, isThumb) {
    const base = new THREE.Group();
    const ratios = isThumb ? [0.52, 0.48] : [0.45, 0.31, 0.24];
    const joints = [];
    let parent = base;
    let rPrev = baseRad;

    ratios.forEach((ratio, idx) => {
      const j = new THREE.Group();
      if (idx > 0) {
        j.position.z = totalLen * ratios[idx - 1];
      }
      parent.add(j);
      joints.push(j);

      const segLen = totalLen * ratio;
      const rNext = baseRad * (1 - (idx + 1) * 0.14);

      // Smooth capsule-like phalanx segment with joint rounding
      const segGeo = new THREE.CylinderGeometry(rNext, rPrev, segLen, 12, 1);
      segGeo.rotateX(Math.PI / 2);
      segGeo.translate(0, 0, segLen * 0.5);
      const segMesh = new THREE.Mesh(segGeo, this.skinMat);
      j.add(segMesh);

      const knuckleSphere = new THREE.Mesh(new THREE.SphereGeometry(rPrev * 0.99, 10, 8), this.skinMat);
      knuckleSphere.scale.set(1.02, 0.92, 1.02);
      j.add(knuckleSphere);

      // Rounded fingertip pad + glossy pale-pink fingernail on distal phalanx!
      if (idx === ratios.length - 1) {
        const tipSphere = new THREE.Mesh(new THREE.SphereGeometry(rNext * 0.98, 14, 12), this.skinMat);
        tipSphere.scale.set(0.96, 0.88, 1.12);
        tipSphere.position.z = segLen;
        j.add(tipSphere);

        const nail = new THREE.Mesh(new THREE.SphereGeometry(rNext * 0.84, 12, 10), this.nailMat);
        nail.scale.set(0.86, 0.22, 1.18);
        nail.position.set(0, rNext * 0.72, segLen * 0.74);
        nail.rotation.x = -0.08;
        j.add(nail);
      }

      rPrev = rNext;
      parent = j;
    });

    return { base, joints };
  }

  _solveArmIK(arm, shoulderWorld, wristWorld, handEuler, gripAmount) {
    const upperLen = 0.265;
    const foreLen = 0.245;

    const dir = new THREE.Vector3().subVectors(wristWorld, shoulderWorld);
    const dist = Math.min(upperLen + foreLen - 0.008, Math.max(0.10, dir.length()));
    const dirNorm = dir.clone().normalize();

    // Law of cosines for natural elbow bend pointing downward & slightly outward
    const cosShoulder = THREE.MathUtils.clamp(
      (upperLen * upperLen + dist * dist - foreLen * foreLen) / (2 * upperLen * dist),
      -0.98,
      0.98
    );
    const angle = Math.acos(cosShoulder);

    // Outward-downward pole vector so elbows rest naturally at Mom's sides, never upwards!
    const pole = new THREE.Vector3(arm.isRight ? -0.42 : 0.42, -0.88, -0.15).normalize();
    const ortho = pole.clone().addScaledVector(dirNorm, -pole.dot(dirNorm)).normalize();

    const elbowDir = dirNorm.clone().multiplyScalar(Math.cos(angle)).addScaledVector(ortho, Math.sin(angle));
    const elbowWorld = shoulderWorld.clone().addScaledVector(elbowDir, upperLen);

    // Position upper sleeve (shoulder -> elbow; built at exact 0.265m length!)
    arm.upperMesh.position.copy(shoulderWorld);
    arm.upperMesh.lookAt(elbowWorld);
    arm.upperMesh.scale.set(1, 1, 1);

    // Rolled cuff slightly below elbow
    const cuffPos = shoulderWorld.clone().lerp(elbowWorld, 0.96).lerp(wristWorld, 0.14);
    arm.cuffMesh.position.copy(cuffPos);
    arm.cuffMesh.lookAt(wristWorld);

    // Bare forearm (elbow -> wrist; scale along Z relative to 0.245m rest length)
    const foreVec = new THREE.Vector3().subVectors(wristWorld, elbowWorld);
    arm.foreMesh.position.copy(elbowWorld);
    arm.foreMesh.lookAt(wristWorld);
    arm.foreMesh.scale.set(1, 1, foreVec.length() / 0.245);

    // Wrist & Hand orientation
    arm.handRoot.position.copy(wristWorld);
    arm.handRoot.rotation.copy(handEuler);

    // Natural staggered finger curl (pinky curls slightly tighter than index, just like real human hands!)
    arm.fingers.forEach((f, idx) => {
      const curl = gripAmount * (0.88 + idx * 0.08);
      f.joints[0].rotation.x = 0.18 + curl * 0.92;
      f.joints[1].rotation.x = 0.22 + curl * 1.02;
      f.joints[2].rotation.x = 0.14 + curl * 0.72;
    });
    arm.thumb.joints[0].rotation.x = 0.18 + gripAmount * 0.55;
    arm.thumb.joints[1].rotation.x = 0.15 + gripAmount * 0.62;
  }

  _buildChildOverTheShoulder() {
    // Attached to camera later or positioned in foreground bottom-right to frame the Over-The-Shoulder POV!
    this.childOTSGroup = new THREE.Group();

    // Soft coral-pink morning rib-knit shoulder & collar edge in bottom-right foreground
    const shoulderGeo = new THREE.SphereGeometry(0.085, 24, 20);
    shoulderGeo.scale(1.35, 0.78, 1.05);
    const shoulder = new THREE.Mesh(shoulderGeo, this.childSweaterMat);
    shoulder.receiveShadow = true;
    this.childOTSGroup.add(shoulder);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.056, 0.013, 10, 24),
      this.childSweaterMat
    );
    collar.position.set(-0.045, 0.045, -0.01);
    collar.rotation.set(1.2, 0.3, -0.35);
    this.childOTSGroup.add(collar);

    this.scene.add(this.childOTSGroup);
  }

  triggerHappyReaction(intensity = 1.0) {
    this.targetSmile = Math.min(1.0, 0.78 + intensity * 0.22);
    this.targetMouthOpen = Math.min(0.85, 0.32 + intensity * 0.35);
    this.targetBrowLift = 0.35;
    this.nodVel = -0.32 * intensity;
  }

  triggerSurprise(intensity = 1.0) {
    this.targetSmile = 0.65;
    this.targetMouthOpen = Math.min(0.95, 0.55 + intensity * 0.35);
    this.targetBrowLift = 0.55;
  }

  relaxExpression() {
    this.targetSmile = 0.44;
    this.targetMouthOpen = 0.06;
    this.targetBrowLift = 0.08;
  }

  update(dt, elapsed, camera) {
    // Gentle living breathing motion on Mom's shoulders & torso
    const breath = Math.sin(elapsed * 1.65) * 0.0035;
    this.torsoGroup.position.y = 0.04 + breath;
    this.torsoGroup.rotation.z = Math.sin(elapsed * 0.7) * 0.015;

    // Nod spring physics
    this.nodVel += (-this.nodOffset * 28 - this.nodVel * 6.5) * dt;
    this.nodOffset += this.nodVel * dt;

    // Smooth head & eye gaze tracking toward active point of interest
    this.smoothLookTarget.lerp(this.lookTarget, Math.min(1, dt * 5.5));

    const headWorld = new THREE.Vector3();
    this.headPivot.getWorldPosition(headWorld);
    const toTarget = new THREE.Vector3().subVectors(this.smoothLookTarget, headWorld);

    const desiredYaw = THREE.MathUtils.clamp(Math.atan2(toTarget.x, toTarget.z) - 0.16, -0.32, 0.34);
    const horizDist = Math.hypot(toTarget.x, toTarget.z);
    // Keep Mom's face warmly upright toward the child (eyes look down at pan rather than dropping her crown!)
    const desiredPitch = THREE.MathUtils.clamp((-Math.atan2(toTarget.y, horizDist) - 0.14) * 0.35 + this.nodOffset, -0.14, 0.16);

    this.headPivot.rotation.y = THREE.MathUtils.lerp(this.headPivot.rotation.y, desiredYaw * 0.62, Math.min(1, dt * 5));
    this.headPivot.rotation.x = THREE.MathUtils.lerp(this.headPivot.rotation.x, desiredPitch, Math.min(1, dt * 5));
    this.headPivot.rotation.z = THREE.MathUtils.lerp(
      this.headPivot.rotation.z,
      Math.sin(elapsed * 0.85) * 0.035 + this.smile * 0.04,
      Math.min(1, dt * 4)
    );

    // Fine eyeball convergence + natural micro-saccade life
    this.eyes.forEach((eyePivot) => {
      const eyeW = new THREE.Vector3();
      eyePivot.getWorldPosition(eyeW);
      const localTarget = this.smoothLookTarget.clone();
      this.headGroup.worldToLocal(localTarget);
      const dx = localTarget.x - eyePivot.position.x;
      const dy = localTarget.y - eyePivot.position.y;
      const dz = Math.max(0.12, localTarget.z - eyePivot.position.z);
      eyePivot.rotation.y = THREE.MathUtils.clamp(Math.atan2(dx, dz), -0.30, 0.30);
      eyePivot.rotation.x = THREE.MathUtils.clamp(-Math.atan2(dy, dz), -0.24, 0.24);
    });

    // Natural blinking cycle
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.8 + Math.random() * 2.8;
    }
    const blinkWindow = 0.17;
    if (this.blinkTimer < blinkWindow) {
      this.blink = Math.sin((1 - this.blinkTimer / blinkWindow) * Math.PI);
    } else {
      this.blink = 0;
    }

    // Smooth expression blend & slowly relax after reactions
    this.targetSmile = THREE.MathUtils.lerp(this.targetSmile, 0.44, dt * 0.55);
    this.targetMouthOpen = THREE.MathUtils.lerp(this.targetMouthOpen, 0.06, dt * 0.85);
    this.targetBrowLift = THREE.MathUtils.lerp(this.targetBrowLift, 0.08, dt * 0.9);

    const prevSm = this.smile;
    const prevMo = this.mouthOpen;
    const prevBl = this.blink;
    this.smile = THREE.MathUtils.lerp(this.smile, this.targetSmile, Math.min(1, dt * 8));
    this.mouthOpen = THREE.MathUtils.lerp(this.mouthOpen, this.targetMouthOpen, Math.min(1, dt * 10));
    this.browLift = THREE.MathUtils.lerp(this.browLift, this.targetBrowLift, Math.min(1, dt * 8));

    this.brows.forEach((b) => {
      b.mesh.position.y = b.baseY + this.browLift * 0.0045;
    });
    this.upperLids.forEach((lid) => {
      lid.rotation.x = -0.42 + this.blink * 0.92 - this.smile * 0.05;
    });

    if (
      Math.abs(this.smile - prevSm) > 0.001 ||
      Math.abs(this.mouthOpen - prevMo) > 0.001 ||
      Math.abs(this.blink - prevBl) > 0.002 ||
      this.blink > 0.001
    ) {
      this._applyFaceMorphs();
    }

    // Solve both arms IK in world space
    const rShoulder = new THREE.Vector3();
    const lShoulder = new THREE.Vector3();
    this.rightShoulderAnchor.getWorldPosition(rShoulder);
    this.leftShoulderAnchor.getWorldPosition(lShoulder);

    this._solveArmIK(this.rightArm, rShoulder, this.rightHandTarget, this.rightHandRot, this.rightGrip);
    this._solveArmIK(this.leftArm, lShoulder, this.leftHandTarget, this.leftHandRot, this.leftGrip);

    // Keep child's Over-The-Shoulder silhouette tucked cleanly in bottom-right corner of camera view!
    if (camera) {
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const aspect = camera.aspect || 1.33;
      const rightOff = aspect < 1 ? 0.115 : 0.185;
      const downOff = aspect < 1 ? -0.215 : -0.138;
      this.childOTSGroup.position
        .copy(camera.position)
        .addScaledVector(camFwd, 0.25)
        .addScaledVector(camRight, rightOff)
        .addScaledVector(camUp, downOff);
      this.childOTSGroup.quaternion.copy(camera.quaternion);
    }
  }
}

function smoothStep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
