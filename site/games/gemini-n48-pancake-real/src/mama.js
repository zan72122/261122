import * as THREE from 'three';

/**
 * Helper: builds a smoothly swept dynamic tubular mesh updated from 4 control points each frame.
 * Eliminates ALL toy-doll cylinder caps & ball-joint seams!
 */
function createDynamicTubeMesh(material, lengthSegs = 22, radialSegs = 14) {
  const ringVerts = radialSegs + 1;
  const vertCount = (lengthSegs + 1) * ringVerts;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const v = i / lengthSegs;
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const idx = i * ringVerts + j;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = v * 2.2;
    }
  }
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      // Outward CCW winding matching outward radial normals!
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const curvePts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const curve = new THREE.CatmullRomCurve3(curvePts, false, 'centripetal', 0.5);
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const prevTan = new THREE.Vector3();
  const norm = new THREE.Vector3();
  const binorm = new THREE.Vector3();
  const rotAxis = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  function updateFromPoints(p0, p1, p2, p3, radiusFn) {
    curvePts[0].copy(p0);
    curvePts[1].copy(p1);
    curvePts[2].copy(p2);
    curvePts[3].copy(p3);

    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;

    for (let i = 0; i <= lengthSegs; i++) {
      const t = i / lengthSegs;
      curve.getPoint(t, pt);
      curve.getTangent(t, tan).normalize();

      if (i === 0) {
        // Stable initial reference normal
        if (Math.abs(tan.y) < 0.9) norm.set(0, 1, 0);
        else norm.set(1, 0, 0);
        binorm.crossVectors(tan, norm).normalize();
        norm.crossVectors(binorm, tan).normalize();
      } else {
        // Parallel transport frame (twist-free!)
        rotAxis.crossVectors(prevTan, tan);
        const sinA = rotAxis.length();
        if (sinA > 1e-5) {
          rotAxis.divideScalar(sinA);
          const cosA = THREE.MathUtils.clamp(prevTan.dot(tan), -1, 1);
          const angle = Math.atan2(sinA, cosA);
          quat.setFromAxisAngle(rotAxis, angle);
          norm.applyQuaternion(quat).normalize();
        }
        binorm.crossVectors(tan, norm).normalize();
        norm.crossVectors(binorm, tan).normalize();
      }
      prevTan.copy(tan);

      const rad = radiusFn(t);
      for (let j = 0; j <= radialSegs; j++) {
        const theta = (j / radialSegs) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const nx = norm.x * cosT + binorm.x * sinT;
        const ny = norm.y * cosT + binorm.y * sinT;
        const nz = norm.z * cosT + binorm.z * sinT;
        const idx = i * ringVerts + j;
        posAttr.setXYZ(idx, pt.x + nx * rad, pt.y + ny * rad, pt.z + nz * rad);
        normAttr.setXYZ(idx, nx, ny, nz);
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  }

  return { mesh, updateFromPoints };
}

/**
 * Photorealistic Mama (Round 2 Overhaul):
 * - Warm natural matte human skin (ZERO porcelain/plastic shine!)
 * - Sculpted natural Japanese mother's face with properly recessed eyes,
 *   clean double-sided eyelids + crisp lashline + natural soft eyebrows (ZERO white clipping strips!)
 * - Lush dark-chestnut layered hair with solid root under-cap, parted soft bangs,
 *   face-framing sunlit wisps, and relaxed low bun
 * - Seamless continuous dynamically-deformed knitted sweater sleeves + bare forearms
 *   (ZERO ball joints, ZERO cylinder end-cap seams!)
 * - Warm natural draped oatmeal linen apron with hem & straps
 * - Close, warm framing so Mama's face, sunlit shoulder & expressive hands anchor the morning kitchen!
 */
export function createMama(scene, textures) {
  const root = new THREE.Group();
  // Warm, intimate proximity right behind-right of the stove so face & hands read large & cinematic
  root.position.set(0.46, -0.76, -1.68);
  root.rotation.y = -0.22;
  scene.add(root);

  // Velvety matte photographic human skin (NO clearcoat plastic shine!)
  const skinFaceMat = new THREE.MeshPhysicalMaterial({
    map: textures.skinFace.map,
    roughnessMap: textures.skinFace.roughnessMap,
    bumpMap: textures.skinFace.bumpMap,
    bumpScale: 0.0028,
    roughness: 0.72,
    metalness: 0.0,
    sheen: 0.28,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(0xe69578),
    clearcoat: 0.0,
    side: THREE.DoubleSide,
  });

  const skinHandMat = new THREE.MeshPhysicalMaterial({
    map: textures.skinHand.map,
    roughnessMap: textures.skinHand.roughnessMap,
    bumpMap: textures.skinHand.bumpMap,
    bumpScale: 0.0032,
    roughness: 0.74,
    metalness: 0.0,
    sheen: 0.24,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(0xe09074),
    clearcoat: 0.0,
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2b7a6,
    roughness: 0.26,
    clearcoat: 0.58,
    clearcoatRoughness: 0.22,
  });

  // Soft heather-terracotta ribbed cotton knit sweater
  const sweaterMat = new THREE.MeshPhysicalMaterial({
    map: textures.sweater.map,
    bumpMap: textures.sweater.bumpMap,
    bumpScale: 0.022,
    color: 0xac6d59,
    roughness: 0.94,
    sheen: 0.42,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(0xdca992),
  });

  // Natural unbleached oatmeal linen apron
  const apronMat = new THREE.MeshPhysicalMaterial({
    map: textures.linen.map,
    bumpMap: textures.linen.bumpMap,
    bumpScale: 0.016,
    color: 0xd6c8b4,
    roughness: 0.92,
    sheen: 0.24,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color(0xf0e4d2),
    side: THREE.DoubleSide,
  });

  // Warm dark-chestnut hair catching golden morning rim sheen
  const hairMat = new THREE.MeshPhysicalMaterial({
    map: textures.hair.map,
    bumpMap: textures.hair.bumpMap,
    bumpScale: 0.015,
    color: 0x2a1911,
    roughness: 0.52,
    metalness: 0.02,
    sheen: 0.58,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(0x9e6c42),
  });

  // =========================================================================
  // 1. CONTINUOUS ORGANIC TORSO, SLOPED SHOULDERS & DRAPED LINEN APRON
  // =========================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.90, 0);
  torsoGroup.rotation.x = 0.14;
  root.add(torsoGroup);

  const torsoGeo = new THREE.CylinderGeometry(0.42, 0.70, 1.88, 36, 22);
  const tPos = torsoGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    let x = tPos.getX(i);
    let y = tPos.getY(i);
    let z = tPos.getZ(i);
    const yn = (y + 0.94) / 1.88; // 0 waist .. 1 neck base

    const shoulderBell = Math.exp(-(((yn - 0.75) / 0.22) ** 2));
    const widthScale = 1.06 + shoulderBell * 0.74 - Math.pow(Math.max(0, yn - 0.80) / 0.20, 1.75) * 1.18;
    const depthScale = 0.76 + Math.sin(yn * Math.PI) * 0.22 - Math.pow(Math.max(0, yn - 0.83) / 0.17, 1.75) * 0.44;
    x *= widthScale;
    z *= depthScale;

    // Natural graceful downward slope of feminine shoulders
    if (yn > 0.70) {
      y -= Math.abs(x) * 0.16 * ((yn - 0.70) / 0.30);
    }
    if (z > 0) {
      z += Math.exp(-(((yn - 0.54) / 0.24) ** 2)) * 0.11 * Math.max(0, 1 - (x * x) / 0.95);
    }
    // Subtle soft fabric drape folds across lower chest/waist
    z += Math.sin(x * 8.0 + yn * 6.0) * 0.008 * (1 - yn);
    tPos.setXYZ(i, x, y, z);
  }
  torsoGeo.computeVertexNormals();
  const torsoMesh = new THREE.Mesh(torsoGeo, sweaterMat);
  torsoMesh.position.set(0, 0.18, 0);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Draped oatmeal linen apron with subtle fold ripples & front pocket
  const apronGeo = new THREE.CylinderGeometry(0.65, 0.74, 1.36, 30, 14, true, -Math.PI * 0.33, Math.PI * 0.66);
  const aPos = apronGeo.attributes.position;
  for (let i = 0; i < aPos.count; i++) {
    let x = aPos.getX(i);
    let y = aPos.getY(i);
    let z = aPos.getZ(i);
    const yn = (y + 0.68) / 1.36;
    x *= 1.08;
    z = z * 0.86 + 0.085 + Math.exp(-(((yn - 0.56) / 0.30) ** 2)) * 0.105;
    // Soft organic fabric wave
    z += Math.sin(x * 11.0) * 0.007 * (1.1 - yn * 0.5);
    aPos.setXYZ(i, x, y, z);
  }
  apronGeo.computeVertexNormals();
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.set(0, 0.06, 0.04);
  apronMesh.castShadow = true;
  apronMesh.receiveShadow = true;
  torsoGroup.add(apronMesh);

  // Flat soft linen apron shoulder straps
  for (const side of [-1, 1]) {
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.43, 0.72, 0.48),
      new THREE.Vector3(side * 0.45, 1.02, 0.17),
      new THREE.Vector3(side * 0.40, 0.94, -0.32),
    ]);
    const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 14, 0.042, 8, false), apronMat);
    strap.scale.set(1.22, 0.28, 1.0);
    torsoGroup.add(strap);
  }

  // Refined soft ribbed boat/crew sweater neckline (thin seamless knitted band)
  const collarCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 0.99, 0.32),
      new THREE.Vector3(0.25, 1.03, 0.17),
      new THREE.Vector3(0.23, 1.08, -0.14),
      new THREE.Vector3(0.0, 1.10, -0.21),
      new THREE.Vector3(-0.23, 1.08, -0.14),
      new THREE.Vector3(-0.25, 1.03, 0.17),
    ],
    true
  );
  const collar = new THREE.Mesh(new THREE.TubeGeometry(collarCurve, 28, 0.028, 10, true), sweaterMat);
  torsoGroup.add(collar);

  // Smooth anatomical upper chest / collarbone skin visible cleanly inside boat neckline
  const chestSkin = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 16), skinHandMat);
  chestSkin.scale.set(1.02, 0.50, 0.82);
  chestSkin.position.set(0, 0.98, 0.05);
  torsoGroup.add(chestSkin);

  // Shoulder anchor markers tucked cleanly DEEP inside the sculpted shoulder volume for seamless knit drape!
  const rightShoulderInner = new THREE.Object3D();
  rightShoulderInner.position.set(-0.36, 0.70, -0.02);
  torsoGroup.add(rightShoulderInner);

  const rightShoulderOuter = new THREE.Object3D();
  rightShoulderOuter.position.set(-0.70, 0.66, 0.04);
  torsoGroup.add(rightShoulderOuter);

  const leftShoulderInner = new THREE.Object3D();
  leftShoulderInner.position.set(0.36, 0.70, -0.02);
  torsoGroup.add(leftShoulderInner);

  const leftShoulderOuter = new THREE.Object3D();
  leftShoulderOuter.position.set(0.70, 0.66, 0.04);
  torsoGroup.add(leftShoulderOuter);

  // =========================================================================
  // 2. NATURAL NECK & ANATOMICALLY SCULPTED PHOTOREALISTIC HEAD
  // =========================================================================
  const neckGeo = new THREE.CylinderGeometry(0.195, 0.255, 0.56, 24, 8);
  const nPos = neckGeo.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    let x = nPos.getX(i);
    let y = nPos.getY(i);
    let z = nPos.getZ(i);
    const yn = THREE.MathUtils.clamp((y + 0.28) / 0.56, 0, 1);
    const flare = 1 + Math.pow(Math.max(0, 1 - yn), 2.2) * 0.24;
    x *= flare;
    z *= flare * 0.94;
    nPos.setXYZ(i, x, y, z);
  }
  neckGeo.computeVertexNormals();
  const neck = new THREE.Mesh(neckGeo, skinHandMat);
  neck.position.set(0, 1.24, 0.04);
  neck.castShadow = true;
  neck.receiveShadow = true;
  torsoGroup.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.82, 0.11);
  torsoGroup.add(headPivot);

  const headGeo = new THREE.SphereGeometry(0.64, 52, 42);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);

    // Refined naturalistic adult Japanese woman facial proportions
    x *= 0.86;
    y *= 1.11;
    z *= 0.94;

    // Tapered natural oval jawline & delicate rounded chin
    if (y < 0.04) {
      const jawT = Math.min(1, (0.04 - y) / 0.75);
      x *= 1 - Math.pow(jawT, 1.55) * 0.43;
      if (z > -0.05) {
        const chinSpot = Math.exp(-((x / 0.18) ** 2 + ((y + 0.58) / 0.14) ** 2));
        z += chinSpot * 0.058;
        // Subtle chin crease below lower lip
        const mento = Math.exp(-((x / 0.14) ** 2 + ((y + 0.44) / 0.06) ** 2));
        z -= mento * 0.022;
      }
    }

    // Subtle temple plane narrowing
    if (y > 0.05 && Math.abs(x) > 0.34) {
      const temple = Math.exp(-(((Math.abs(x) - 0.46) / 0.16) ** 2 + ((y - 0.18) / 0.22) ** 2));
      x -= Math.sign(x) * temple * 0.022;
    }

    // Anatomical front facial planes (z > 0.10)
    if (z > 0.10) {
      // Deeper, natural orbital eye sockets so eyeballs sit authentically inside the face
      const eyeL = Math.exp(-(((x + 0.195) / 0.135) ** 2 + ((y - 0.055) / 0.092) ** 2));
      const eyeR = Math.exp(-(((x - 0.195) / 0.135) ** 2 + ((y - 0.055) / 0.092) ** 2));
      z -= (eyeL + eyeR) * 0.088;

      // Soft warm cheekbones & apple of cheeks
      const cheekL = Math.exp(-(((x + 0.28) / 0.19) ** 2 + ((y + 0.10) / 0.15) ** 2));
      const cheekR = Math.exp(-(((x - 0.28) / 0.19) ** 2 + ((y + 0.10) / 0.15) ** 2));
      z += (cheekL + cheekR) * 0.068;

      // Natural sloped nose bridge, rounded tip, and delicate nostril wings (alae)
      const bridge = Math.exp(-((x / 0.052) ** 2 + ((y - 0.01) / 0.155) ** 2));
      const noseTip = Math.exp(-((x / 0.068) ** 2 + ((y + 0.135) / 0.064) ** 2));
      const alaL = Math.exp(-(((x + 0.065) / 0.042) ** 2 + ((y + 0.16) / 0.036) ** 2));
      const alaR = Math.exp(-(((x - 0.065) / 0.042) ** 2 + ((y + 0.16) / 0.036) ** 2));
      z += bridge * 0.072 + noseTip * 0.108 + (alaL + alaR) * 0.032;

      // Gentle brow arch
      const brow = Math.exp(-((x / 0.38) ** 2 + ((y - 0.195) / 0.062) ** 2));
      z += brow * 0.026;

      // Soft integrated mouth/lip cushion + philtrum dimple
      const muzzle = Math.exp(-((x / 0.19) ** 2 + ((y + 0.305) / 0.11) ** 2));
      const philtrum = Math.exp(-((x / 0.032) ** 2 + ((y + 0.225) / 0.048) ** 2));
      z += muzzle * 0.042 - philtrum * 0.012;
    }
    hPos.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, skinFaceMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.108, 14, 12), skinFaceMat);
    ear.scale.set(0.36, 1.10, 0.65);
    ear.position.set(side * 0.535, -0.04, -0.02);
    ear.rotation.y = side * 0.24;
    headPivot.add(ear);
  }

  // =========================================================================
  // 3. EXPRESSIVE PHOTOREALISTIC EYES (ZERO WHITE EYELID CLIPPING!)
  // =========================================================================
  const eyeMat = new THREE.MeshStandardMaterial({
    map: textures.eye,
    roughness: 0.08,
    metalness: 0.0,
  });
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.015,
    metalness: 0.0,
    transparent: true,
    opacity: 0.20,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
  });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1e120c, roughness: 0.85 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x3b261b, roughness: 0.92 });
  const creaseMat = new THREE.MeshStandardMaterial({ color: 0x9e6a56, roughness: 0.85 });

  const eyes = [];
  const upperLids = [];
  const lowerLids = [];

  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    // Recessed naturally inside the sculpted orbital sockets
    eyeSocket.position.set(side * 0.192, 0.055, 0.478);
    headPivot.add(eyeSocket);

    const eyeball = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(0.088, 22, 18);
    ballGeo.rotateY(-Math.PI / 2);
    const ball = new THREE.Mesh(ballGeo, eyeMat);
    eyeball.add(ball);

    const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.091, 16, 12), corneaMat);
    eyeball.add(cornea);
    eyeSocket.add(eyeball);
    eyes.push(eyeball);

    // Natural warm upper eyelid hood resting cleanly across the upper iris margin (eyes clearly open & expressive!)
    const upLid = new THREE.Group();
    const lidGeo = new THREE.SphereGeometry(0.098, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const lidMesh = new THREE.Mesh(lidGeo, skinFaceMat);
    lidMesh.rotation.x = -0.54;
    upLid.add(lidMesh);

    // Delicate dark lash ribbon framing the open upper eyelid cleanly
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.078, 0.012, 0.062),
      new THREE.Vector3(-side * 0.032, 0.038, 0.092),
      new THREE.Vector3(0.0, 0.045, 0.098),
      new THREE.Vector3(side * 0.042, 0.036, 0.088),
      new THREE.Vector3(side * 0.082, 0.010, 0.056),
    ]);
    const lash = new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 14, 0.008, 6, false), lashMat);
    upLid.add(lash);

    // Subtle soft double-eyelid crease line just above lashline
    const creaseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.064, 0.044, 0.068),
      new THREE.Vector3(0.0, 0.066, 0.090),
      new THREE.Vector3(side * 0.068, 0.040, 0.064),
    ]);
    const crease = new THREE.Mesh(new THREE.TubeGeometry(creaseCurve, 10, 0.0030, 5, false), creaseMat);
    upLid.add(crease);

    eyeSocket.add(upLid);
    upperLids.push(upLid);

    // Full wrapping lower eyelid cushion hugging lower edge cleanly
    const lowLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 18, 10, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44),
      skinFaceMat
    );
    lowLid.rotation.x = 0.24;
    eyeSocket.add(lowLid);
    lowerLids.push(lowLid);

    // Natural tapered soft eyebrow (tapered ribbon rather than blunt cylinder!)
    const browPts = [
      new THREE.Vector3(-side * 0.088, 0.122, 0.072),
      new THREE.Vector3(-side * 0.02, 0.146, 0.095),
      new THREE.Vector3(side * 0.05, 0.144, 0.082),
      new THREE.Vector3(side * 0.112, 0.116, 0.045),
    ];
    const browCurve = new THREE.CatmullRomCurve3(browPts);
    const browGeo = new THREE.TubeGeometry(browCurve, 14, 0.011, 6, false);
    const bp = browGeo.attributes.position;
    const bRing = 7;
    const bRings = Math.floor(bp.count / bRing);
    for (let r = 0; r < bRings; r++) {
      const t = r / Math.max(1, bRings - 1);
      const c = browCurve.getPoint(t);
      const taper = 0.28 + 0.72 * Math.sin(Math.pow(t, 0.65) * Math.PI);
      for (let j = 0; j < bRing; j++) {
        const idx = r * bRing + j;
        bp.setXYZ(
          idx,
          c.x + (bp.getX(idx) - c.x) * taper,
          c.y + (bp.getY(idx) - c.y) * taper * 0.52,
          c.z + (bp.getZ(idx) - c.z) * taper * 0.42
        );
      }
    }
    browGeo.computeVertexNormals();
    const brow = new THREE.Mesh(browGeo, browMat);
    eyeSocket.add(brow);
  }

  // =========================================================================
  // 4. SOFT NATURAL SMILING LIPS
  // =========================================================================
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: 0xb6655c,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.42,
  });
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.302, 0.558);
  headPivot.add(mouthGroup);

  function buildTaperedLip(pts, radius) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 18, radius, 8, false);
    const pos = geo.attributes.position;
    const ringV = 9;
    const rings = Math.floor(pos.count / ringV);
    for (let r = 0; r < rings; r++) {
      const t = r / Math.max(1, rings - 1);
      const c = curve.getPoint(t);
      const taper = 0.25 + 0.75 * Math.sin(t * Math.PI);
      for (let j = 0; j < ringV; j++) {
        const idx = r * ringV + j;
        pos.setXYZ(
          idx,
          c.x + (pos.getX(idx) - c.x) * taper,
          c.y + (pos.getY(idx) - c.y) * taper * 0.78,
          c.z + (pos.getZ(idx) - c.z) * taper * 0.72
        );
      }
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, lipMat);
  }

  const upperLip = buildTaperedLip(
    [
      new THREE.Vector3(-0.125, 0.010, -0.048),
      new THREE.Vector3(-0.052, 0.018, 0.012),
      new THREE.Vector3(0.0, 0.012, 0.022),
      new THREE.Vector3(0.052, 0.018, 0.012),
      new THREE.Vector3(0.125, 0.010, -0.048),
    ],
    0.021
  );
  mouthGroup.add(upperLip);

  const lowerLip = buildTaperedLip(
    [
      new THREE.Vector3(-0.120, 0.006, -0.048),
      new THREE.Vector3(-0.050, -0.024, 0.008),
      new THREE.Vector3(0.0, -0.032, 0.018),
      new THREE.Vector3(0.050, -0.024, 0.008),
      new THREE.Vector3(0.120, 0.006, -0.048),
    ],
    0.024
  );
  mouthGroup.add(lowerLip);

  const teethMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.145, 0.024, 0.014),
    new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.30 })
  );
  teethMesh.position.set(0, -0.003, -0.008);
  mouthGroup.add(teethMesh);

  // =========================================================================
  // 5. LUSH NATURAL LAYERED HAIR (ZERO WHITE SCALP GAPS, ZERO PLASTIC HELMET!)
  // =========================================================================
  const hairGroup = new THREE.Group();
  headPivot.add(hairGroup);

  // Precision-sculpted full hair crown & side cap: covers ENTIRE scalp behind a curved feminine hairline
  // while cleanly recessing below the forehead hairline so eyes & brows are 100% unobstructed and ZERO bald patches exist!
  const rootCapGeo = new THREE.SphereGeometry(0.675, 44, 34);
  const rcPos = rootCapGeo.attributes.position;
  for (let i = 0; i < rcPos.count; i++) {
    let x = rcPos.getX(i) * 0.90;
    let y = rcPos.getY(i) * 1.135;
    let z = rcPos.getZ(i) * 0.975 - 0.015;

    // Natural curved feminine forehead hairline (graceful open forehead above brows, sweeps softly around temples!)
    const nx = Math.min(1, Math.abs(x) / 0.55);
    const hairlineY = 0.43 - nx * nx * 0.32;
    if (z > 0.04 && y < hairlineY) {
      // Smoothly tuck front-face region cleanly INSIDE skull so it NEVER covers forehead/eyes!
      const tuck = Math.min(1, (hairlineY - y) / 0.14);
      const scaleIn = THREE.MathUtils.lerp(1.0, 0.74, tuck);
      x *= scaleIn;
      y = THREE.MathUtils.lerp(y, y + 0.06, tuck * 0.4);
      z *= scaleIn;
    } else if (z > -0.10 && y > hairlineY) {
      // Soft natural volume above hairline & at temples
      const vol = 1.0 + Math.min(1, (y - hairlineY) / 0.25) * 0.04;
      x *= vol;
      y *= vol;
      z *= vol;
    }
    rcPos.setXYZ(i, x, y, z);
  }
  rootCapGeo.computeVertexNormals();
  const rootCap = new THREE.Mesh(rootCapGeo, hairMat);
  rootCap.castShadow = true;
  hairGroup.add(rootCap);

  // Full soft volume at back & sides of head
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.65, 28, 22), hairMat);
  backHair.scale.set(0.95, 1.05, 0.92);
  backHair.position.set(0, -0.08, -0.22);
  backHair.castShadow = true;
  hairGroup.add(backHair);

  // Relaxed casual low morning bun at nape + linen hair tie
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.35, 22, 16), hairMat);
  bun.scale.set(1.12, 0.92, 0.96);
  bun.position.set(0, -0.18, -0.80);
  bun.castShadow = true;
  hairGroup.add(bun);

  const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.058, 10, 20), apronMat);
  scrunchie.position.set(0, -0.17, -0.63);
  scrunchie.rotation.x = 0.18;
  hairGroup.add(scrunchie);

  function addHairRibbon(pts, radius, flatZ = 0.52) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, 18, radius, 8, false);
    const pos = geo.attributes.position;
    const radialSegs = 8;
    const ringVerts = radialSegs + 1;
    const totalRings = Math.floor(pos.count / ringVerts);
    for (let r = 0; r < totalRings; r++) {
      const t = r / Math.max(1, totalRings - 1);
      const center = curve.getPoint(t);
      const taper = 0.25 + 0.75 * Math.sin(Math.pow(t, 0.68) * Math.PI);
      for (let j = 0; j < ringVerts; j++) {
        const idx = r * ringVerts + j;
        const vx = pos.getX(idx) - center.x;
        const vy = pos.getY(idx) - center.y;
        const vz = pos.getZ(idx) - center.z;
        pos.setXYZ(idx, center.x + vx * taper, center.y + vy * taper, center.z + vz * taper * flatZ);
      }
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, hairMat);
    m.castShadow = true;
    hairGroup.add(m);
  }

  // Lush layered right-sweeping locks from natural 6:4 morning part
  for (let i = 0; i < 8; i++) {
    const f = i / 7;
    const zLift = 0.40 - f * 0.22;
    const yDip = 0.44 - f * 0.08;
    addHairRibbon(
      [
        [-0.12 + f * 0.04, 0.72 - f * 0.02, 0.14 - f * 0.10],
        [0.14 + f * 0.07, 0.65 - f * 0.04, zLift + 0.10],
        [0.43 + f * 0.05, yDip, 0.34 - f * 0.16],
        [0.58, 0.05 - f * 0.05, 0.14 - f * 0.18],
        [0.48 - f * 0.06, -0.28, -0.36 - f * 0.10],
      ],
      0.074 + (i % 2) * 0.016,
      0.56
    );
  }
  // Lush layered left-sweeping locks from natural part
  for (let i = 0; i < 8; i++) {
    const f = i / 7;
    const zLift = 0.40 - f * 0.22;
    const yDip = 0.43 - f * 0.08;
    addHairRibbon(
      [
        [-0.12 - f * 0.04, 0.72 - f * 0.02, 0.14 - f * 0.10],
        [-0.27 - f * 0.06, 0.64 - f * 0.04, zLift + 0.09],
        [-0.46 - f * 0.05, yDip, 0.32 - f * 0.16],
        [-0.58, 0.05 - f * 0.05, 0.14 - f * 0.18],
        [-0.48 + f * 0.06, -0.28, -0.36 - f * 0.10],
      ],
      0.072 + (i % 2) * 0.016,
      0.56
    );
  }
  // Soft wispy side-swept morning fringe (frames forehead softly, keeps eyes wide open!)
  addHairRibbon([[-0.11, 0.70, 0.22], [0.06, 0.56, 0.47], [0.27, 0.39, 0.47], [0.46, 0.20, 0.35]], 0.052, 0.48);
  addHairRibbon([[-0.08, 0.69, 0.24], [0.15, 0.52, 0.47], [0.36, 0.32, 0.42], [0.51, 0.10, 0.28]], 0.042, 0.46);
  addHairRibbon([[-0.11, 0.70, 0.22], [-0.24, 0.54, 0.46], [-0.41, 0.34, 0.42], [-0.53, 0.12, 0.27]], 0.048, 0.48);
  addHairRibbon([[-0.14, 0.68, 0.23], [-0.32, 0.49, 0.43], [-0.48, 0.26, 0.36], [-0.56, 0.04, 0.22]], 0.038, 0.46);
  // Delicate face-framing cheek wisps catching golden morning sunlight!
  addHairRibbon([[-0.52, 0.28, 0.24], [-0.59, -0.04, 0.20], [-0.54, -0.36, 0.14], [-0.45, -0.58, 0.09]], 0.025, 0.62);
  addHairRibbon([[0.52, 0.28, 0.24], [0.59, -0.04, 0.20], [0.54, -0.36, 0.14], [0.45, -0.58, 0.09]], 0.025, 0.62);
  // Soft crown top fullness
  addHairRibbon([[-0.20, 0.72, 0.02], [-0.04, 0.77, -0.03], [0.20, 0.72, 0.02]], 0.105, 0.72);

  // =========================================================================
  // 6. SEAMLESS CONTINUOUS 2-BONE IK ARMS (DYNAMIC TUBULAR SLEEVES + HANDS)
  // =========================================================================
  function createSeamlessArm(side = 1) {
    const armRoot = new THREE.Group();
    scene.add(armRoot);

    // Continuous dynamic knitted sweater sleeve (shoulder inside torso -> elbow -> rolled cuff!)
    const sleeveTube = createDynamicTubeMesh(sweaterMat, 22, 14);
    armRoot.add(sleeveTube.mesh);

    // Continuous smooth bare forearm (inside rolled cuff -> wrist!)
    const forearmTube = createDynamicTubeMesh(skinHandMat, 14, 12);
    armRoot.add(forearmTube.mesh);

    // Sculpted naturalistic warm human hand at wrist
    const handGroup = new THREE.Group();
    armRoot.add(handGroup);

    const wristBlend = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 10), skinHandMat);
    wristBlend.scale.set(1.04, 0.76, 1.08);
    handGroup.add(wristBlend);

    const palmGeo = new THREE.SphereGeometry(0.155, 18, 14);
    palmGeo.scale(1.02, 0.50, 1.15);
    const palm = new THREE.Mesh(palmGeo, skinHandMat);
    palm.position.set(0, 0, 0.105);
    palm.castShadow = true;
    handGroup.add(palm);

    const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), skinHandMat);
    thenar.scale.set(0.95, 0.70, 1.18);
    thenar.position.set(side * 0.095, -0.018, 0.075);
    handGroup.add(thenar);

    const fingers = [];
    const fSpecs = [
      { x: side * 0.098, len: 0.21, r: 0.035, z: 0.235 },
      { x: side * 0.033, len: 0.232, r: 0.036, z: 0.25 },
      { x: -side * 0.033, len: 0.22, r: 0.034, z: 0.24 },
      { x: -side * 0.096, len: 0.175, r: 0.031, z: 0.21 },
    ];
    fSpecs.forEach((fs) => {
      const fBase = new THREE.Group();
      fBase.position.set(fs.x, 0.008, fs.z);
      handGroup.add(fBase);

      const s1 = fs.len * 0.55;
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(fs.r, s1, 6, 10), skinHandMat);
      seg1.rotation.x = Math.PI / 2;
      seg1.position.z = s1 * 0.50;
      seg1.castShadow = true;
      fBase.add(seg1);

      const fMid = new THREE.Group();
      fMid.position.z = s1 + fs.r * 0.28;
      fBase.add(fMid);

      const s2 = fs.len * 0.47;
      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(fs.r * 0.86, s2, 6, 10), skinHandMat);
      seg2.rotation.x = Math.PI / 2;
      seg2.position.z = s2 * 0.46;
      seg2.castShadow = true;
      fMid.add(seg2);

      const nail = new THREE.Mesh(new THREE.SphereGeometry(fs.r * 0.66, 8, 6), nailMat);
      nail.scale.set(0.84, 0.22, 1.16);
      nail.position.set(0, fs.r * 0.70, s2 + fs.r * 0.06);
      fMid.add(nail);

      fingers.push({ base: fBase, mid: fMid });
    });

    const thumbBase = new THREE.Group();
    thumbBase.position.set(side * 0.138, -0.015, 0.105);
    thumbBase.rotation.set(0.22, side * 0.56, -side * 0.34);
    handGroup.add(thumbBase);

    const tSeg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.039, 0.125, 6, 10), skinHandMat);
    tSeg1.rotation.x = Math.PI / 2;
    tSeg1.position.z = 0.066;
    tSeg1.castShadow = true;
    thumbBase.add(tSeg1);

    const thumbTip = new THREE.Group();
    thumbTip.position.z = 0.132;
    thumbBase.add(thumbTip);

    const tSeg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.09, 6, 10), skinHandMat);
    tSeg2.rotation.x = Math.PI / 2;
    tSeg2.position.z = 0.048;
    thumbTip.add(tSeg2);

    function setCurl(curl) {
      for (let i = 0; i < fingers.length; i++) {
        const c = curl * (0.94 + i * 0.04);
        fingers[i].base.rotation.x = 0.26 + c * 0.94;
        fingers[i].mid.rotation.x = 0.22 + c * 1.04;
      }
      thumbBase.rotation.x = 0.16 + curl * 0.44;
      thumbTip.rotation.x = 0.14 + curl * 0.46;
    }

    const vDir = new THREE.Vector3();
    const vPole = new THREE.Vector3();
    const vPerp = new THREE.Vector3();
    const elbowPos = new THREE.Vector3();
    const cuffPos = new THREE.Vector3();
    const foreMid1 = new THREE.Vector3();
    const foreMid2 = new THREE.Vector3();

    function solveIK(shInnerWorld, shOuterWorld, wristWorld, poleDir, handLookAt, rollZ, curl) {
      const L1 = 1.14;
      const L2 = 1.12;
      vDir.copy(wristWorld).sub(shOuterWorld);
      let d = vDir.length();
      const maxReach = L1 + L2 - 0.04;
      const minReach = 0.35;
      if (d > maxReach) d = maxReach;
      if (d < minReach) d = minReach;
      vDir.normalize();

      const cosA = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

      vPole.copy(poleDir).normalize();
      vPerp.copy(vPole).addScaledVector(vDir, -vPole.dot(vDir));
      if (vPerp.lengthSq() < 0.001) vPerp.set(0, -1, 0);
      vPerp.normalize();

      elbowPos
        .copy(shOuterWorld)
        .addScaledVector(vDir, cosA * L1)
        .addScaledVector(vPerp, sinA * L1);

      // Rolled-up knit sweater cuff sits ~44% down the forearm
      cuffPos.lerpVectors(elbowPos, wristWorld, 0.44);

      // Update continuous seamless knitted sleeve: torso interior -> deltoid -> elbow -> folded cuff!
      sleeveTube.updateFromPoints(shInnerWorld, shOuterWorld, elbowPos, cuffPos, (t) => {
        // Organic sweater sleeve silhouette blending seamlessly into upper shoulder
        let r = THREE.MathUtils.lerp(0.235, 0.130, Math.pow(t, 0.72));
        r += Math.exp(-(((t - 0.20) / 0.18) ** 2)) * 0.018;
        r += Math.sin(t * 28.0) * 0.004 * Math.exp(-(((t - 0.66) / 0.18) ** 2));
        if (t > 0.88) {
          const ct = (t - 0.88) / 0.12;
          r += Math.sin(ct * Math.PI) * 0.020;
        }
        return r;
      });

      // Update continuous smooth bare forearm emerging from inside sleeve cuff to wrist!
      foreMid1.lerpVectors(elbowPos, wristWorld, 0.36); // Tucked smoothly inside sleeve cuff
      foreMid2.lerpVectors(elbowPos, wristWorld, 0.70);
      forearmTube.updateFromPoints(foreMid1, cuffPos, foreMid2, wristWorld, (t) => {
        return THREE.MathUtils.lerp(0.116, 0.088, t);
      });

      handGroup.position.copy(wristWorld);
      handGroup.lookAt(handLookAt);
      handGroup.rotateZ(rollZ);
      handGroup.scale.setScalar(1.06);
      setCurl(curl);
    }

    return { armRoot, handGroup, solveIK };
  }

  const rightArm = createSeamlessArm(1);
  const leftArm = createSeamlessArm(-1);

  // =========================================================================
  // ANIMATION STATE
  // =========================================================================
  const state = {
    smile: 0.44,
    targetSmile: 0.44,
    blinkTimer: 2.6,
    blinkVal: 0,
    lookTarget: new THREE.Vector3(-0.32, 0.3, 0.1),
    smoothLook: new THREE.Vector3(-0.32, 0.3, 0.1),
    cheerTimer: 0,
    tasteTimer: 0,
    panWristSmooth: new THREE.Vector3(0.42, 0.45, 0.2),
    plateWristSmooth: new THREE.Vector3(1.68, 0.62, -0.78),
    inited: false,
  };

  const tmpShRIn = new THREE.Vector3();
  const tmpShROut = new THREE.Vector3();
  const tmpShLIn = new THREE.Vector3();
  const tmpShLOut = new THREE.Vector3();
  const tmpWorldGrip = new THREE.Vector3();
  const tmpHeadWorld = new THREE.Vector3();
  const tmpLocalLook = new THREE.Vector3();

  function triggerCheer(duration = 1.8) {
    state.cheerTimer = Math.max(state.cheerTimer, duration);
  }

  function triggerTaste(duration = 2.6) {
    state.tasteTimer = duration;
    state.cheerTimer = Math.max(state.cheerTimer, duration);
  }

  function update(dt, time, ctx) {
    const breath = Math.sin(time * 1.55);
    torsoGroup.position.y = 0.90 + breath * 0.016;
    torsoGroup.rotation.x = 0.14 + breath * 0.011;
    root.updateMatrixWorld(true);

    if (ctx.lookTarget) state.lookTarget.copy(ctx.lookTarget);
    state.smoothLook.lerp(state.lookTarget, Math.min(1, dt * 5.0));

    headPivot.getWorldPosition(tmpHeadWorld);
    tmpLocalLook.copy(state.smoothLook).sub(tmpHeadWorld);
    const targetYaw = THREE.MathUtils.clamp(Math.atan2(tmpLocalLook.x, tmpLocalLook.z) + 0.22, -0.50, 0.50);
    const targetPitch = THREE.MathUtils.clamp(-Math.atan2(tmpLocalLook.y, Math.hypot(tmpLocalLook.x, tmpLocalLook.z)), -0.26, 0.42);

    headPivot.rotation.y += (targetYaw * 0.64 - headPivot.rotation.y) * Math.min(1, dt * 4.5);
    headPivot.rotation.x += (targetPitch * 0.62 - headPivot.rotation.x) * Math.min(1, dt * 4.5);
    const tiltTarget = state.cheerTimer > 0 ? 0.088 : 0.028 + Math.sin(time * 0.68) * 0.016;
    headPivot.rotation.z += (tiltTarget - headPivot.rotation.z) * Math.min(1, dt * 3.5);

    for (const eye of eyes) {
      eye.rotation.y = THREE.MathUtils.clamp(targetYaw * 0.30, -0.22, 0.22);
      eye.rotation.x = THREE.MathUtils.clamp(targetPitch * 0.26, -0.18, 0.20);
    }

    state.blinkTimer -= dt;
    if (state.blinkTimer <= 0) {
      state.blinkVal = 1.0;
      state.blinkTimer = 2.8 + Math.random() * 3.4;
    }
    if (state.blinkVal > 0) state.blinkVal = Math.max(0, state.blinkVal - dt * 7.5);
    const blinkCurve = Math.sin(state.blinkVal * Math.PI);

    if (state.cheerTimer > 0) state.cheerTimer = Math.max(0, state.cheerTimer - dt);
    if (state.tasteTimer > 0) state.tasteTimer = Math.max(0, state.tasteTimer - dt);

    state.targetSmile = state.cheerTimer > 0 ? 1.0 : ctx.isFlipping ? 0.92 : ctx.isPouring ? 0.72 : 0.46;
    state.smile += (state.targetSmile - state.smile) * Math.min(1, dt * 5.0);

    mouthGroup.scale.set(0.98 + state.smile * 0.16, 0.92 + state.smile * 0.24, 1.0);
    upperLip.position.y = state.smile * 0.008;
    lowerLip.position.y = -state.smile * 0.018;
    teethMesh.scale.set(0.82, Math.max(0.05, (state.smile - 0.54) * 1.25), 1);
    teethMesh.visible = state.smile > 0.56;

    // Subtle natural upper eyelid tracking on downward gaze (keeps warm brown eyes clearly open & expressive!)
    const gazeLidTrack = Math.max(0, targetPitch) * 0.24;
    const happySquint = state.tasteTimer > 0 ? 0.32 : state.smile * 0.04;
    for (let i = 0; i < upperLids.length; i++) {
      upperLids[i].rotation.x = blinkCurve * 0.62 + happySquint + gazeLidTrack;
      lowerLids[i].position.y = state.smile * 0.012 + (state.tasteTimer > 0 ? 0.01 : 0);
    }

    rightShoulderInner.getWorldPosition(tmpShRIn);
    rightShoulderOuter.getWorldPosition(tmpShROut);
    leftShoulderInner.getWorldPosition(tmpShLIn);
    leftShoulderOuter.getWorldPosition(tmpShLOut);

    ctx.handleGripPoint.getWorldPosition(tmpWorldGrip);
    const panWristTarget = tmpWorldGrip.clone().add(new THREE.Vector3(0.06, 0.08, -0.26));
    const panLookAt = tmpWorldGrip.clone().add(new THREE.Vector3(-0.08, -0.04, 0.25));

    let plateWristTarget;
    let plateLookAt;
    let plateCurl = 0.25;
    if (state.tasteTimer > 0 && ctx.stackTopPos) {
      const wave = Math.sin(time * 7.5) * 0.09;
      plateWristTarget = new THREE.Vector3(ctx.stackTopPos.x + 0.38, ctx.stackTopPos.y + 0.68 + wave, -0.68);
      plateLookAt = ctx.stackTopPos.clone().add(new THREE.Vector3(-0.1, 0.22, 0.2));
      plateCurl = 0.16;
    } else if (ctx.idleHintPos && ctx.idleHintAlpha > 0.05) {
      const bob = Math.sin(time * 3.0) * 0.06;
      plateWristTarget = ctx.idleHintPos.clone().add(new THREE.Vector3(0.28, 0.54 + bob, -0.44));
      plateLookAt = ctx.idleHintPos.clone();
      plateCurl = 0.22;
    } else {
      plateWristTarget = new THREE.Vector3(1.66, 0.52 + Math.sin(time * 1.5 + 1.0) * 0.014, -0.84);
      plateLookAt = new THREE.Vector3(1.45, 0.26, 0.12);
      plateCurl = 0.30;
    }

    if (!state.inited) {
      state.panWristSmooth.copy(panWristTarget);
      state.plateWristSmooth.copy(plateWristTarget);
      state.inited = true;
    } else {
      state.panWristSmooth.lerp(panWristTarget, Math.min(1, dt * 15));
      state.plateWristSmooth.lerp(plateWristTarget, Math.min(1, dt * 6.5));
    }

    rightArm.solveIK(
      tmpShRIn,
      tmpShROut,
      state.panWristSmooth,
      new THREE.Vector3(-0.75, -0.65, 0.18),
      panLookAt,
      -0.35,
      ctx.isFlipping ? 0.96 : 0.78
    );

    leftArm.solveIK(
      tmpShLIn,
      tmpShLOut,
      state.plateWristSmooth,
      new THREE.Vector3(0.82, -0.58, 0.18),
      plateLookAt,
      0.22,
      plateCurl
    );
  }

  return {
    root,
    headPivot,
    triggerCheer,
    triggerTaste,
    update,
  };
}
