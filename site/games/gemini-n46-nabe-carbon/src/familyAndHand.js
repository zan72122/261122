import * as THREE from '../lib/three.module.js';

// Subsurface-scattering human skin material (warm dermal wrap lighting, zero plastic glare)
function createSkinMaterial(textures, baseHex = 0xf0c2a2, blushBoost = 0.0) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(baseHex),
    normalMap: textures.skinNormal,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughness: 0.50,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.52,
    sheen: 0.28,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xffbfa6),
    vertexColors: true,
  });

  const uniforms = { uRosy: { value: blushBoost } };
  mat.userData.skinUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRosy = uniforms.uRosy;
    shader.vertexShader = `
      attribute float aCheekMask;
      varying float vCheekMask;
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vCheekMask = aCheekMask;`
    );
    shader.fragmentShader = `
      uniform float uRosy;
      varying float vCheekMask;
    ` + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.40, 0.34), clamp(vCheekMask * (0.28 + uRosy * 0.42), 0.0, 0.65));`
    ).replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       reflectedLight.indirectDiffuse += vec3(0.09, 0.032, 0.018) * diffuseColor.rgb;`
    );
  };
  return mat;
}

// Continuous anatomically-sculpted Head + Neck mesh with natural facial AO & lip/nostril/eyelid shading!
function buildSculptedHeadAndNeck(profile, skinMat, textures) {
  const segU = 52, segV = 42;
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const cheekMask = [];
  const uvs = [];
  const indices = [];

  const cf = profile.childFactor || 0;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const theta = (u - 0.5) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      let rx, rz, y;
      if (v < 0.25) {
        const nt = v / 0.25;
        // Exact C0/C1 match with hv=0 (phi = -0.32*PI -> cosP = 0.5358, sinP = -0.8443): zero neck shelf!
        const neckEndRx = 0.5358 * 0.065 * profile.jawWidth;
        const neckEndRz = 0.5358 * 0.088 * 0.96;
        const neckEndY  = -0.8443 * (0.108 - cf * 0.011) + 0.012;
        const baseNeckR = 0.034 - cf * 0.006;
        const blend = nt * nt * (3 - 2 * nt);
        rx = baseNeckR * (1 - blend) + neckEndRx * blend;
        rz = baseNeckR * (1 - blend) + neckEndRz * blend;
        y = -0.148 + nt * (neckEndY - (-0.148));
        const x = sinT * rx;
        const z = cosT * (cosT > 0 ? rz * 0.95 : rz * 1.04);
        positions.push(x, y, z);
      } else {
        const hv = (v - 0.25) / 0.75;
        const phi = -0.32 * Math.PI + hv * 0.82 * Math.PI; // -0.32*PI (jaw/neck) .. +0.50*PI (crown)
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        const heightScale = 0.108 - cf * 0.011;
        const widthProfile = hv < 0.48
          ? (0.065 * profile.jawWidth + (0.079 - 0.065 * profile.jawWidth) * Math.sin((hv / 0.48) * Math.PI * 0.5))
          : (0.079 - Math.pow((hv - 0.48) / 0.52, 1.8) * 0.012);
        const depthProfile = 0.088 - cf * 0.006;

        let x = sinT * cosP * widthProfile;
        y = sinP * heightScale + 0.012;
        let z = cosT * cosP * depthProfile;

        if (cosT > 0) z *= 0.91;
        else z *= 1.06;

        if (cosT > 0.1) {
          const ax = Math.abs(x);
          const eyeX = 0.028 - cf * 0.0025;
          const eyeY = 0.012 - cf * 0.004;

          const dEye = Math.hypot((ax - eyeX) / 0.021, (y - eyeY) / 0.015);
          if (dEye < 1.2) {
            const socket = Math.pow(Math.max(0, 1 - dEye / 1.2), 1.8);
            z -= socket * (0.0095 - cf * 0.002);
          }

          const dBrow = Math.hypot((ax - eyeX * 0.95) / 0.026, (y - (eyeY + 0.017)) / 0.008);
          if (dBrow < 1.0) {
            z += Math.pow(1 - dBrow, 1.6) * (0.0055 * (1 - cf * 0.45));
          }

          const noseTopY = eyeY + 0.006;
          const noseTipY = eyeY - (0.024 - cf * 0.005);
          if (y < noseTopY + 0.008 && y > noseTipY - 0.010 && ax < 0.022) {
            const ny = (noseTopY - y) / (noseTopY - noseTipY);
            const bridgeW = 0.0075 + Math.pow(Math.max(0, ny), 1.6) * 0.0065;
            if (ax < bridgeW * 1.7) {
              const across = Math.max(0, 1 - Math.pow(ax / (bridgeW * 1.45), 2.0));
              const bridgeProfile = ny <= 1.0
                ? Math.pow(Math.max(0, ny), 0.78)
                : Math.max(0, 1 - Math.pow((ny - 1.0) * 3.8, 1.6));
              z += across * bridgeProfile * (0.0195 * profile.noseLen);
            }
            const dAlar = Math.hypot((ax - 0.010) / 0.0065, (y - (noseTipY + 0.002)) / 0.0055);
            if (dAlar < 1.0) {
              z += Math.pow(1 - dAlar, 1.5) * 0.006;
            }
          }

          const cheekX = 0.038 - cf * 0.003;
          const cheekY = eyeY - 0.022;
          const dCheek = Math.hypot((ax - cheekX) / 0.028, (y - cheekY) / 0.024);
          if (dCheek < 1.15) {
            const c = Math.pow(1 - dCheek / 1.15, 1.7);
            z += c * 0.010 * profile.cheekFullness;
            x += Math.sign(x) * c * 0.0055 * profile.cheekFullness;
          }

          const mouthY = noseTipY - 0.015;
          const mouthW = 0.022 - cf * 0.003;
          if (ax < mouthW * 1.3 && Math.abs(y - mouthY) < 0.014) {
            const mx = 1 - Math.pow(ax / (mouthW * 1.25), 2.0);
            const upperLip = Math.exp(-Math.pow((y - (mouthY + 0.0040)) / 0.0035, 2.0));
            const lowerLip = Math.exp(-Math.pow((y - (mouthY - 0.0044)) / 0.0040, 2.0));
            const lipPart = Math.exp(-Math.pow((y - mouthY) / 0.0016, 2.0));
            z += mx * (upperLip * 0.0058 + lowerLip * 0.0065 - lipPart * 0.0045);
          }

          const chinY = mouthY - 0.020;
          const dChin = Math.hypot(ax / 0.020, (y - chinY) / 0.013);
          if (dChin < 1.0) {
            z += Math.pow(1 - dChin, 1.6) * 0.0058;
          }
        }
        positions.push(x, y, z);
      }

      const px = positions[positions.length - 3];
      const py = positions[positions.length - 2];
      const pz = positions[positions.length - 1];

      // Natural skin shading & anatomical AO so faces have true human depth!
      let cr = 1.0, cg = 0.965, cb = 0.94;
      let cMask = 0.0;

      // Neck under-chin warm shadow AO
      if (v < 0.26) {
        const neckAO = 0.72 + (v / 0.26) * 0.24;
        cr *= neckAO; cg *= neckAO * 0.98; cb *= neckAO * 0.96;
      }

      if (pz > 0.02) {
        const ax = Math.abs(px);
        const eyeX = 0.028 - cf * 0.0025;
        const eyeY = 0.012 - cf * 0.004;
        const noseTipY = eyeY - (0.024 - cf * 0.005);
        const mouthY = noseTipY - 0.015;

        // Soft orbital / double-eyelid warm crease
        const dSocket = Math.hypot((ax - eyeX) / 0.019, (py - (eyeY + 0.004)) / 0.012);
        if (dSocket < 1.0) {
          const s = (1 - dSocket) * 0.14;
          cr -= s * 0.6; cg -= s * 0.9; cb -= s * 1.0;
        }

        // Subtle nostril & under-nose AO shadow (critical so nose doesn't vanish into face!)
        const dNostril = Math.hypot((ax - 0.0065) / 0.0055, (py - (noseTipY - 0.0035)) / 0.0038);
        if (dNostril < 1.0) {
          const ns = Math.pow(1 - dNostril, 1.3) * 0.34;
          cr -= ns * 0.85; cg -= ns * 1.0; cb -= ns * 1.05;
        }
        const dNoseSide = Math.hypot((ax - 0.0125) / 0.0048, (py - (noseTipY + 0.004)) / 0.011);
        if (dNoseSide < 1.0) {
          const al = (1 - dNoseSide) * 0.11;
          cr -= al * 0.7; cg -= al * 0.95; cb -= al * 1.0;
        }

        // Cheek blush mask
        const dc = Math.hypot((ax - (0.036 - cf * 0.003)) / 0.025, (py - (eyeY - 0.022)) / 0.020);
        if (dc < 1.0) cMask = Math.pow(1 - dc, 1.5);

        const dn = Math.hypot(ax / 0.012, (py - noseTipY) / 0.009);
        if (dn < 1.0) cMask = Math.max(cMask, Math.pow(1 - dn, 1.8) * 0.42);

        // Hydrated natural two-tone lips + subtle warm smile corner line!
        const mouthW = 0.021 - cf * 0.003;
        const dm = Math.hypot(ax / mouthW, (py - mouthY) / 0.0075);
        if (dm < 1.0) {
          const lt = Math.pow(1 - dm, 1.15);
          const isUpper = py > mouthY ? 1.18 : 0.95;
          cr -= lt * 0.16 * isUpper;
          cg -= lt * 0.54 * isUpper;
          cb -= lt * 0.54 * isUpper;
        }
        // Mouth parting line
        const dLine = Math.hypot(ax / (mouthW * 1.12), (py - (mouthY + ax * 0.14)) / 0.0020);
        if (dLine < 1.0) {
          const ml = (1 - dLine) * 0.48;
          cr -= ml * 0.85; cg -= ml * 1.1; cb -= ml * 1.1;
        }
      }

      // Soft bangs root shadow on upper forehead right under hairline
      if (pz > 0.03 && py > 0.034) {
        const browShade = Math.min(0.28, (py - 0.034) * 9.0);
        cr -= browShade; cg -= browShade * 1.05; cb -= browShade * 1.1;
      }

      colors.push(Math.max(0.1, cr), Math.max(0.1, cg), Math.max(0.1, cb));
      cheekMask.push(cMask);
      uvs.push(u * 2.0, v * 2.0);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + segU + 1;
      indices.push(a, a + 1, b);
      indices.push(b, a + 1, b + 1);
    }
  }

  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aCheekMask', new THREE.Float32BufferAttribute(cheekMask, 1));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const headGroup = new THREE.Group();
  const headMesh = new THREE.Mesh(geo, skinMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // Sculpted Ears
  [-1, 1].forEach((side) => {
    const earGeo = new THREE.SphereGeometry(0.017, 10, 8);
    earGeo.scale(0.36, 1.15, 0.68);
    earGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(earGeo.attributes.position.count * 3).fill(0.92), 3));
    earGeo.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(earGeo.attributes.position.count).fill(0.35), 1));
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * (0.077 - cf * 0.005), 0.005, -0.006);
    ear.rotation.y = -side * 0.24;
    headGroup.add(ear);
  });

  // Natural Almond Eyes + Warm Dark-Brown Iris + Eyelids + Eyebrows + Mouth!
  const eyeY = 0.012 - cf * 0.004;
  const eyeX = 0.028 - cf * 0.0025;
  const eyeZ = 0.066 - cf * 0.003;
  const eyeR = 0.0116 + cf * 0.0012;

  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: textures.eyeMap,
    roughness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
  });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1b120e, roughness: 0.7 });

  const eyes = [];
  const upperLids = [];
  const lowerLids = [];

  [-1, 1].forEach((side) => {
    const socketGrp = new THREE.Group();
    socketGrp.position.set(side * eyeX, eyeY, eyeZ);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 18, 14), eyeMat);
    const ep = eyeball.geometry.attributes.position;
    const euv = eyeball.geometry.attributes.uv;
    for (let i = 0; i < ep.count; i++) {
      // Larger warm Japanese dark-brown iris ratio (0.44 divisor -> fuller warm iris, zero startled white ring!)
      euv.setXY(i, (ep.getX(i) / eyeR) * 0.43 + 0.5, (ep.getY(i) / eyeR) * 0.43 + 0.5);
    }
    socketGrp.add(eyeball);
    eyes.push(eyeball);

    // Gentle almond upper eyelid (-0.78 rad covers upper sclera rim naturally without looking startled!)
    const uLidGeo = new THREE.SphereGeometry(eyeR * 1.09, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
    uLidGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(uLidGeo.attributes.position.count * 3).fill(0.92), 3));
    uLidGeo.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(uLidGeo.attributes.position.count).fill(0.18), 1));
    const upperLid = new THREE.Mesh(uLidGeo, skinMat);
    upperLid.rotation.x = -0.78;
    socketGrp.add(upperLid);
    upperLids.push(upperLid);

    const lash = new THREE.Mesh(new THREE.TorusGeometry(eyeR * 1.0, 0.0016, 6, 14, Math.PI * 0.88), lashMat);
    lash.rotation.z = Math.PI * 0.06;
    lash.position.set(0, 0.0015, eyeR * 0.36);
    upperLid.add(lash);

    const lLidGeo = new THREE.SphereGeometry(eyeR * 1.07, 14, 6, 0, Math.PI * 2, Math.PI * 0.54, Math.PI * 0.46);
    lLidGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lLidGeo.attributes.position.count * 3).fill(0.95), 3));
    lLidGeo.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(lLidGeo.attributes.position.count).fill(0.22), 1));
    const lowerLid = new THREE.Mesh(lLidGeo, skinMat);
    lowerLid.rotation.x = 0.52;
    socketGrp.add(lowerLid);
    lowerLids.push(lowerLid);

    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.012, eyeY + 0.0175, eyeZ + 0.007),
      new THREE.Vector3(side * eyeX, eyeY + 0.0205, eyeZ + 0.006),
      new THREE.Vector3(side * (eyeX + 0.016), eyeY + 0.0155, eyeZ + 0.000),
    ]);
    const brow = new THREE.Mesh(
      new THREE.TubeGeometry(browCurve, 8, 0.0024 * (profile.browThick || 1), 6, false),
      new THREE.MeshStandardMaterial({ color: 0x221712, roughness: 0.82 })
    );
    headGroup.add(brow);
    headGroup.add(socketGrp);
  });

  const noseTipY = eyeY - (0.024 - cf * 0.005);
  const mouthY = noseTipY - 0.015;

  // Delicate warm natural smile lip curve & subtle under-nose shadow accent so facial expressions read warmly!
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-(0.016 - cf * 0.003), mouthY + 0.0022, 0.073 - cf * 0.004),
    new THREE.Vector3(0, mouthY - 0.0005, 0.0765 - cf * 0.004),
    new THREE.Vector3((0.016 - cf * 0.003), mouthY + 0.0022, 0.073 - cf * 0.004),
  ]);
  const smileLips = new THREE.Mesh(
    new THREE.TubeGeometry(smileCurve, 12, 0.0022, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x9e4b42, roughness: 0.42 })
  );
  headGroup.add(smileLips);

  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, mouthY, 0.0745 - cf * 0.004);
  const mouthCavity = new THREE.Mesh(
    new THREE.SphereGeometry(0.0115, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x621c1a, roughness: 0.65 })
  );
  mouthCavity.scale.set(1.15, 0.06, 0.45);
  mouthGroup.add(mouthCavity);
  headGroup.add(mouthGroup);

  headGroup.scale.setScalar(profile.scale || 1.0);

  return { headGroup, eyes, upperLids, lowerLids, mouthCavity };
}

// Natural Multi-Layer Soft Hair (full crown + gentle feathered bangs across upper forehead, ZERO triangular bald wedge!)
function buildRealisticHair(style, hairColor, textures) {
  const grp = new THREE.Group();
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: hairColor,
    map: textures.hairStrandMap,
    normalMap: textures.hairNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.68, // soft matte-silky real hair, NEVER shiny plastic helmet!
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    sheen: 0.48,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(0x6e523e),
    side: THREE.DoubleSide,
  });

  const segU = 52, segV = 28;
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const theta = (u - 0.5) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const absTheta = Math.abs(theta);

      // Natural bangs sitting 7mm ABOVE eyebrows & glasses (phi ~ 0.395*PI -> y ~ +0.046m, ZERO eye/brow cover & ZERO V-wedge!)
      let maxPhi;
      if (style === 'dad') {
        const frontMask = Math.pow(Math.max(0, cosT), 1.3);
        const sideSweep = Math.sin(theta * 1.5 + 0.5) * 0.018 * frontMask;
        const bangsTex = Math.sin(theta * 21.0) * 0.010 * frontMask;
        maxPhi = Math.PI * (0.68 - frontMask * 0.295 + sideSweep + bangsTex);
      } else if (style === 'sister') {
        const frontMask = Math.pow(Math.max(0, (cosT - 0.32) / 0.68), 1.4);
        const airyFringe = Math.sin(theta * 26.0) * 0.011 * frontMask;
        maxPhi = Math.PI * (0.85 - frontMask * 0.455 + airyFringe);
      } else {
        const frontMask = Math.pow(Math.max(0, (cosT - 0.28) / 0.72), 1.35);
        const gentlePart = Math.exp(-Math.pow((theta + 0.30) * 4.0, 2.0)) * 0.030;
        const wisp = Math.sin(theta * 19.0) * 0.010 * frontMask;
        maxPhi = Math.PI * (0.76 - frontMask * 0.365 - gentlePart + wisp);
      }

      const phi = v * maxPhi;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const lockWave = Math.sin(theta * 16.0 + v * 2.2) * 0.0032 + Math.cos(theta * 8.0 - v * 1.5) * 0.0028;
      let rx = 0.086 + lockWave;
      let ry = 0.113;
      let rz = 0.095 + lockWave;

      // Add fluffy crown lift near top of skull
      const crownLift = Math.sin(v * Math.PI * 0.85) * 0.007;
      ry += crownLift;

      if (style === 'sister' && absTheta > 0.85) {
        const bobBell = Math.sin(v * Math.PI) * 0.013;
        rx += bobBell;
        rz += bobBell * 0.5;
      } else if (style === 'dad') {
        rx += Math.sin(v * Math.PI) * 0.007;
      } else if (style === 'mom') {
        rx += Math.sin(v * Math.PI) * 0.009;
      }

      let x = sinT * sinP * rx;
      let y = cosP * ry + 0.017;
      let z = cosT * sinP * rz - 0.004;

      if (v > 0.82 && absTheta > 0.82) {
        const tuck = (v - 0.82) / 0.18;
        x *= 1 - tuck * 0.09;
      }

      pos.push(x, y, z);
      uvs.push(u * 3.5, v * 1.6);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + segU + 1;
      idx.push(a, b, a + 1);
      idx.push(b, b + 1, a + 1);
    }
  }

  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const mainHair = new THREE.Mesh(geo, hairMat);
  mainHair.castShadow = true;
  grp.add(mainHair);

  if (style === 'mom') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 12), hairMat);
    bun.position.set(0, -0.022, -0.098);
    bun.scale.set(1.15, 0.92, 0.92);
    grp.add(bun);
  } else if (style === 'sister') {
    const clip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0038, 0.016, 6, 8),
      new THREE.MeshPhysicalMaterial({ color: 0xe25845, roughness: 0.25, clearcoat: 0.8 })
    );
    clip.position.set(0.068, 0.048, 0.050);
    clip.rotation.set(0.2, 0.55, 0.45);
    grp.add(clip);
  }

  return grp;
}

// Sculpted continuous natural raglan wool sweater torso (sloping human shoulders, ZERO ball-joint spheres!)
function buildSlopingSweaterTorso(torsoScale, knitMat) {
  const segU = 36, segV = 22;
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = waist below table, 1 = cozy ribbed collar rim
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const a = u * Math.PI * 2;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);

      // Natural human shoulder slope: wide across chest/deltoids around v=0.68, tapering smoothly into neck at v=1.0!
      let wCurve;
      if (v < 0.68) {
        wCurve = 0.145 + Math.sin((v / 0.68) * Math.PI * 0.5) * 0.038;
      } else {
        const t = (v - 0.68) / 0.32;
        wCurve = 0.183 * (1 - Math.pow(t, 1.65)) + 0.048 * Math.pow(t, 1.65);
      }
      const dCurve = v < 0.72
        ? 0.098 + Math.sin((v / 0.72) * Math.PI * 0.5) * 0.016
        : 0.114 * (1 - Math.pow((v - 0.72) / 0.28, 1.6)) + 0.048 * Math.pow((v - 0.72) / 0.28, 1.6);

      // Subtle natural sweater folds
      const fold = Math.sin(v * Math.PI * 5.0 + Math.cos(a * 2.0)) * 0.003 * (1 - v);
      const x = sinA * (wCurve + fold) * torsoScale.x;
      const y = (-0.04 + v * 0.315) * torsoScale.y;
      const z = cosA * (dCurve + fold) * torsoScale.z;

      pos.push(x, y, z);
      uvs.push(u * 2.5, v * 2.0);
    }
  }

  // Outward-facing triangle winding (a, a+1, b) matching CapsuleGeometry arm normals & shading!
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + segU + 1;
      idx.push(a, a + 1, b);
      idx.push(b, a + 1, b + 1);
    }
  }

  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, knitMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Sculpted 5-fingered realistic human hand (organic rounded ellipsoid palm — ZERO rectangular corners!)
function buildSculptedHand(skinMat, isLeft = false, scale = 1.0) {
  const hand = new THREE.Group();
  const s = isLeft ? -1 : 1;

  const palmGeo = new THREE.SphereGeometry(0.032, 16, 12);
  palmGeo.scale(0.92, 0.38, 1.06);
  const pp = palmGeo.attributes.position;
  palmGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pp.count * 3).fill(0.96), 3));
  palmGeo.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(pp.count).fill(0.22), 1));
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.castShadow = true;
  hand.add(palm);

  const fingerSpecs = [
    [-0.020 * s, -0.030, 0.044, 0.0058],
    [-0.007 * s, -0.032, 0.049, 0.0060],
    [0.007 * s, -0.031, 0.046, 0.0058],
    [0.020 * s, -0.028, 0.038, 0.0052],
  ];
  const fingerPivots = [];
  fingerSpecs.forEach(([fx, fz, len, rad]) => {
    const piv = new THREE.Group();
    piv.position.set(fx, 0, fz);
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len * 0.45, 5, 7), skinMat);
    seg1.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seg1.geometry.attributes.position.count * 3).fill(0.96), 3));
    seg1.geometry.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(seg1.geometry.attributes.position.count).fill(0.28), 1));
    seg1.rotation.x = Math.PI / 2;
    seg1.position.z = -len * 0.28;
    piv.add(seg1);

    const tipPiv = new THREE.Group();
    tipPiv.position.z = -len * 0.52;
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(rad * 0.88, len * 0.38, 5, 7), skinMat);
    seg2.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seg2.geometry.attributes.position.count * 3).fill(0.95), 3));
    seg2.geometry.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(seg2.geometry.attributes.position.count).fill(0.38), 1));
    seg2.rotation.x = Math.PI / 2;
    seg2.position.z = -len * 0.22;
    tipPiv.add(seg2);
    piv.add(tipPiv);
    piv.userData.tipPiv = tipPiv;

    piv.rotation.x = -0.35;
    tipPiv.rotation.x = -0.38;
    hand.add(piv);
    fingerPivots.push(piv);
  });

  const thumbPiv = new THREE.Group();
  thumbPiv.position.set(-0.028 * s, -0.003, 0.012);
  thumbPiv.rotation.set(-0.25, 0.55 * s, -0.35 * s);
  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.028, 5, 7), skinMat);
  thumbMesh.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(thumbMesh.geometry.attributes.position.count * 3).fill(0.96), 3));
  thumbMesh.geometry.setAttribute('aCheekMask', new THREE.BufferAttribute(new Float32Array(thumbMesh.geometry.attributes.position.count).fill(0.28), 1));
  thumbMesh.rotation.x = Math.PI / 2;
  thumbMesh.position.z = -0.018;
  thumbPiv.add(thumbMesh);
  hand.add(thumbPiv);

  hand.scale.setScalar(scale);
  return { hand, fingerPivots, thumbPiv };
}

export class FamilyAndHandSystem {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.members = [];

    this._buildFamily();
    this._buildForegroundPlayerHand();
  }

  _createTonsuiBowl(glazeColor) {
    const grp = new THREE.Group();
    const pts = [
      new THREE.Vector2(0.0, 0.002),
      new THREE.Vector2(0.036, 0.002),
      new THREE.Vector2(0.042, 0.010),
      new THREE.Vector2(0.064, 0.032),
      new THREE.Vector2(0.072, 0.052),
      new THREE.Vector2(0.068, 0.054),
      new THREE.Vector2(0.059, 0.032),
      new THREE.Vector2(0.034, 0.012),
      new THREE.Vector2(0.0, 0.010),
    ];
    const bGeo = new THREE.LatheGeometry(pts, 36);
    const bMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.ceramicKohiki,
      color: glazeColor,
      roughness: 0.16,
      clearcoat: 0.92,
      clearcoatRoughness: 0.06,
    });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    grp.add(bMesh);

    const tab = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), bMat);
    tab.scale.set(1.1, 0.35, 0.85);
    tab.position.set(0.070, 0.050, 0);
    tab.rotation.z = 0.25;
    grp.add(tab);

    const soupMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.058, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xdc8c22,
        roughness: 0.04,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.90,
      })
    );
    soupMesh.rotation.x = -Math.PI / 2;
    soupMesh.position.y = 0.014;
    soupMesh.visible = false;
    grp.add(soupMesh);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.098, 0.09, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.04;
    hit.name = 'familyBowlHit';
    grp.add(hit);

    return { grp, soupMesh, hit };
  }

  _buildFamily() {
    const tex = this.textures;

    const specs = [
      {
        id: 'dad',
        seatPos: new THREE.Vector3(-0.36, -0.05, -0.34),
        seatYaw: 0.38,
        bowlHome: new THREE.Vector3(-0.24, 0.002, -0.15),
        sweaterColor: 0x2b3c52, // Deep slate-navy wool rib knit
        bowlColor: 0x3d6448,    // Oribe green ceramic glaze
        skinHex: 0xcf9473,      // Natural PBR skin reflectance (prevents ACES blowout!)
        hairStyle: 'dad',
        hairColor: 0x181311,
        favType: 'shiitake',
        hasGlasses: true,
        headProfile: { scale: 1.04, jawWidth: 1.03, cheekFullness: 0.92, noseLen: 1.08, childFactor: 0, browThick: 1.2 },
        torsoScale: new THREE.Vector3(1.08, 1.06, 1.02),
      },
      {
        id: 'sister',
        seatPos: new THREE.Vector3(0.0, -0.07, -0.38),
        seatYaw: 0.0,
        bowlHome: new THREE.Vector3(0.0, 0.002, -0.185),
        sweaterColor: 0xa83e33, // Cozy berry-terracotta cable knit
        bowlColor: 0xf4e8dc,    // Warm Kohiki cream glaze
        skinHex: 0xdca486,
        hairStyle: 'sister',
        hairColor: 0x241812,
        favType: 'tofu',
        hasGlasses: false,
        headProfile: { scale: 0.92, jawWidth: 0.95, cheekFullness: 1.30, noseLen: 0.82, childFactor: 1.0, browThick: 0.82 },
        torsoScale: new THREE.Vector3(0.80, 0.82, 0.80),
      },
      {
        id: 'mom',
        seatPos: new THREE.Vector3(0.36, -0.05, -0.34),
        seatYaw: -0.38,
        bowlHome: new THREE.Vector3(0.24, 0.002, -0.15),
        sweaterColor: 0xcfc0aa, // Warm oatmeal wool knit
        bowlColor: 0xd8a462,    // Warm amber-ochre glaze
        skinHex: 0xd79d7e,
        hairStyle: 'mom',
        hairColor: 0x201611,
        favType: 'hakusai',
        hasGlasses: false,
        headProfile: { scale: 0.98, jawWidth: 0.92, cheekFullness: 1.04, noseLen: 0.98, childFactor: 0.12, browThick: 0.85 },
        torsoScale: new THREE.Vector3(0.95, 0.98, 0.94),
      },
    ];

    specs.forEach((sp, idx) => {
      const root = new THREE.Group();
      root.position.copy(sp.seatPos);
      root.rotation.y = sp.seatYaw;

      const skinMat = createSkinMaterial(tex, sp.skinHex, sp.id === 'sister' ? 0.18 : 0.06);
      const knitMat = new THREE.MeshPhysicalMaterial({
        color: sp.sweaterColor,
        aoMap: tex.knitAO,
        normalMap: tex.knitNormal,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughness: 0.90,
        sheen: 0.75,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color(0xffe8d0),
      });

      const upperBody = new THREE.Group();
      upperBody.position.y = 0.04;
      root.add(upperBody);

      // Sloping continuous knit sweater torso (ZERO ball-joint shoulder spheres!)
      const torso = buildSlopingSweaterTorso(sp.torsoScale, knitMat);
      upperBody.add(torso);

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.048 * sp.torsoScale.x, 0.015, 10, 24),
        knitMat
      );
      collar.rotation.x = Math.PI / 2 - 0.08;
      collar.position.set(0, 0.272 * sp.torsoScale.y, 0.004);
      upperBody.add(collar);

      // Sculpted Head + Neck seated naturally into the crewneck sweater collar!
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.352 * sp.torsoScale.y + 0.012, 0.010);
      const headParts = buildSculptedHeadAndNeck(sp.headProfile, skinMat, tex);
      headPivot.add(headParts.headGroup);

      const hair = buildRealisticHair(sp.hairStyle, sp.hairColor, tex);
      headParts.headGroup.add(hair);

      // Dad's Thin Wire-Rim Glasses
      let glassesLensesMat = null;
      if (sp.hasGlasses) {
        const gGrp = new THREE.Group();
        gGrp.position.set(0, 0.012, 0.076);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2d22, metalness: 0.85, roughness: 0.28 });
        glassesLensesMat = new THREE.MeshPhysicalMaterial({
          color: 0xfafcff,
          roughness: 0.05,
          transmission: 0.90,
          transparent: true,
          opacity: 0.12,
          clearcoat: 1.0,
        });
        [-1, 1].forEach((side) => {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0012, 8, 22), frameMat);
          rim.scale.set(1.18, 0.92, 1);
          rim.position.x = side * 0.0285;
          gGrp.add(rim);

          const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 18), glassesLensesMat);
          lens.scale.set(1.18, 0.92, 1);
          lens.position.set(side * 0.0285, 0, 0.0005);
          gGrp.add(lens);

          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0010, 0.0010, 0.078, 6), frameMat);
          arm.rotation.x = Math.PI / 2;
          arm.position.set(side * 0.050, 0.002, -0.038);
          gGrp.add(arm);
        });
        const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.013, 6), frameMat);
        bridge.rotation.z = Math.PI / 2;
        bridge.position.y = 0.003;
        gGrp.add(bridge);
        headParts.headGroup.add(gGrp);
      }

      upperBody.add(headPivot);

      // Hands + Flush Ribbed Wrist Cuffs + Smooth Curved Sleeve Arms!
      const handScale = sp.id === 'sister' ? 0.78 : (sp.id === 'mom' ? 0.90 : 1.0);
      const leftHandObj = buildSculptedHand(skinMat, true, handScale);
      const rightHandObj = buildSculptedHand(skinMat, false, handScale);

      const leftHandAnchor = new THREE.Group();
      const rightHandAnchor = new THREE.Group();
      leftHandAnchor.add(leftHandObj.hand);
      rightHandAnchor.add(rightHandObj.hand);

      const lCuff = new THREE.Mesh(new THREE.TorusGeometry(0.029 * handScale, 0.010 * handScale, 8, 16), knitMat);
      lCuff.position.set(0, 0.002, 0.035 * handScale);
      leftHandAnchor.add(lCuff);
      const rCuff = new THREE.Mesh(new THREE.TorusGeometry(0.029 * handScale, 0.010 * handScale, 8, 16), knitMat);
      rCuff.position.set(0, 0.002, 0.035 * handScale);
      rightHandAnchor.add(rCuff);

      this.scene.add(leftHandAnchor, rightHandAnchor);

      const chopMat = new THREE.MeshStandardMaterial({ color: 0x9c6434, roughness: 0.35 });
      const chopsticks = new THREE.Group();
      for (let c = 0; c < 2; c++) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0030, 0.19, 6), chopMat);
        stick.rotation.z = Math.PI / 2 + (c === 0 ? 0.04 : -0.04);
        stick.rotation.y = 0.35;
        stick.position.set(-0.04, 0.008 + c * 0.006, -0.02);
        chopsticks.add(stick);
      }
      rightHandAnchor.add(chopsticks);

      // Smooth tucked-in raglan arms (shoulder nested inside torso slope -> subtle elbow -> wrist)
      const makeArmRig = () => {
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.037 * handScale, 0.13, 8, 12), knitMat);
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.036 * handScale, 10, 8), knitMat);
        const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.033 * handScale, 0.13, 8, 12), knitMat);
        upper.geometry.setAttribute('uv2', upper.geometry.attributes.uv);
        fore.geometry.setAttribute('uv2', fore.geometry.attributes.uv);
        this.scene.add(upper, elbow, fore);
        return { upper, elbow, fore };
      };
      const leftArm = makeArmRig();
      const rightArm = makeArmRig();

      const bowlObj = this._createTonsuiBowl(sp.bowlColor);
      bowlObj.grp.position.copy(sp.bowlHome);
      bowlObj.hit.userData.memberIndex = idx;
      this.scene.add(bowlObj.grp);

      const hashioki = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.006, 0.020, 6, 8),
        new THREE.MeshPhysicalMaterial({ color: 0xd85838, roughness: 0.2, clearcoat: 0.9 })
      );
      hashioki.rotation.z = Math.PI / 2;
      hashioki.position.set(sp.bowlHome.x + 0.092, 0.006, sp.bowlHome.z + 0.02);
      this.scene.add(hashioki);

      this.scene.add(root);

      this.members.push({
        idx,
        spec: sp,
        root,
        upperBody,
        headPivot,
        headParts,
        skinMat,
        glassesLensesMat,
        glassesFog: 0.0,
        leftHandAnchor,
        rightHandAnchor,
        leftArm,
        rightArm,
        chopsticks,
        bowl: bowlObj,
        bowlFill: 0.0,
        servedItems: [],
        bowlsEnjoyed: 0,
        eatTimer: 0,
        eatDuration: 4.8,
        favoriteBonus: false,
        blinkTimer: 1.5 + Math.random() * 3.0,
        blinkDur: 0,
        rosyWarmth: 0.0,
      });
    });
  }

  _buildForegroundPlayerHand() {
    // Realistic foreground Player Right Hand entering cleanly from lower-right!
    const skinMat = createSkinMaterial(this.textures, 0xd89c7c, 0.16);
    const cuffMat = new THREE.MeshPhysicalMaterial({
      color: 0x7d3c28, // Deep warm chestnut-terracotta wool knit sleeve (rich contrast, never distracting!)
      aoMap: this.textures.knitAO,
      normalMap: this.textures.knitNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.90,
      sheen: 0.75,
      sheenColor: new THREE.Color(0xffdfc2),
    });

    this.playerHandRoot = new THREE.Group();
    const handBuilt = buildSculptedHand(skinMat, false, 1.08);
    // Orient fingers wrapping around target (0,0,0) from the right side so all 5 fingers & knuckles read clearly!
    handBuilt.hand.position.set(0.026, 0.008, 0.022);
    handBuilt.hand.rotation.set(0.28, 0.68, -0.45);
    this.playerHandRoot.add(handBuilt.hand);
    this.playerHandFingers = handBuilt.fingerPivots;
    this.playerHandThumb = handBuilt.thumbPiv;

    // Slim natural knit sleeve sweeping downward-right toward bottom-right corner
    const sleeveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.052, 0.002, 0.052),
      new THREE.Vector3(0.145, -0.068, 0.155),
      new THREE.Vector3(0.290, -0.175, 0.310),
    ]);
    const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 16, 0.026, 12, false);
    sleeveGeo.setAttribute('uv2', sleeveGeo.attributes.uv);
    const sleeveMesh = new THREE.Mesh(sleeveGeo, cuffMat);
    sleeveMesh.castShadow = true;
    this.playerHandRoot.add(sleeveMesh);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 18), cuffMat);
    cuff.position.set(0.052, 0.002, 0.052);
    cuff.lookAt(0.145, -0.068, 0.155);
    this.playerHandRoot.add(cuff);

    this.playerHandHome = new THREE.Vector3(0.45, -0.22, 0.78);
    this.playerHandTarget = this.playerHandHome.clone();
    this.playerHandActive = false;
    this.playerGripAmount = 0.0;

    this.playerHandRoot.position.copy(this.playerHandHome);
    this.scene.add(this.playerHandRoot);
  }

  serveBowl(memberIdx, itemsServed, potSystem, audio) {
    const m = this.members[memberIdx];
    if (!m) return;

    m.bowlFill = Math.min(1.0, m.bowlFill + 0.65);
    m.bowl.soupMesh.visible = true;
    m.eatTimer = m.eatDuration;
    m.bowlsEnjoyed += 1;
    m.rosyWarmth = Math.min(1.0, m.rosyWarmth + 0.35);

    let hasFav = false;
    itemsServed.forEach((it, k) => {
      it.state = 'bowl';
      if (it.type === m.spec.favType || it.type === 'udon' || it.type === 'mochi') {
        hasFav = true;
      }
      m.bowl.grp.add(it.mesh);
      const a = (k * 2.1) + m.servedItems.length;
      it.mesh.position.set(Math.cos(a) * 0.018, 0.024 + k * 0.005, Math.sin(a) * 0.018);
      it.mesh.rotation.set(0.1, a, 0.05);
      it.baseScale = 0.72;
      it.jiggleAmp = 0.7;
      m.servedItems.push(it);
    });
    m.favoriteBonus = hasFav;

    if (m.spec.hasGlasses && (potSystem.boilLevel > 0.55 || potSystem.highFlame)) {
      m.glassesFog = 1.0;
    }

    if (audio) {
      if (m.spec.id === 'sister') {
        setTimeout(() => audio.playBlowSteam(), 320);
      }
      setTimeout(() => audio.playHappyEat(memberIdx, hasFav), m.spec.id === 'sister' ? 950 : 450);
    }
  }

  setPlayerHandTarget(worldPos, grip = 0.6, active = true) {
    this.playerHandActive = active;
    if (active && worldPos) {
      this.playerHandTarget.copy(worldPos);
      this.playerGripAmount = grip;
    } else {
      this.playerHandTarget.copy(this.playerHandHome);
      this.playerGripAmount = 0.1;
    }
  }

  update(dt, elapsed, potSystem, focusWorldPos) {
    const handLerp = Math.min(1, dt * 16);
    this.playerHandRoot.position.lerp(this.playerHandTarget, handLerp);
    this.playerHandFingers.forEach((piv) => {
      const targetCurl = -0.32 - this.playerGripAmount * 0.85;
      piv.rotation.x += (targetCurl - piv.rotation.x) * handLerp;
      piv.userData.tipPiv.rotation.x = piv.rotation.x * 0.9;
    });

    for (const m of this.members) {
      const sp = m.spec;

      if (m.skinMat.userData.skinUniforms) {
        m.skinMat.userData.skinUniforms.uRosy.value = m.rosyWarmth;
      }

      if (m.glassesLensesMat) {
        if (m.glassesFog > 0) m.glassesFog = Math.max(0, m.glassesFog - dt * 0.28);
        const fogCurve = Math.sin(Math.min(1, m.glassesFog) * Math.PI * 0.5);
        m.glassesLensesMat.opacity = 0.12 + fogCurve * 0.84;
        m.glassesLensesMat.roughness = 0.05 + fogCurve * 0.85;
        m.glassesLensesMat.transmission = 0.90 * (1 - fogCurve * 0.88);
      }

      m.blinkTimer -= dt;
      if (m.blinkTimer <= 0) {
        m.blinkDur = 0.13;
        m.blinkTimer = 2.8 + Math.random() * 3.8;
      }
      let blinkFactor = 0;
      if (m.blinkDur > 0) {
        m.blinkDur -= dt;
        blinkFactor = Math.sin((m.blinkDur / 0.13) * Math.PI);
      }

      const breath = Math.sin(elapsed * 2.1 + m.idx * 1.9);
      let leanForward = 0.04 + breath * 0.015;
      let headPitch = 0.10;
      let headYaw = 0;
      let happySquint = 0;
      let mouthScaleX = 1.0, mouthScaleY = 0.08;
      let bounceY = 0;

      if (m.bowlFill > 0.03) {
        m.bowl.soupMesh.visible = true;
        m.bowl.soupMesh.position.y = 0.014 + m.bowlFill * 0.020;
        m.bowl.soupMesh.scale.setScalar(0.76 + m.bowlFill * 0.24);
        if (Math.random() < dt * 4.5) {
          const bp = new THREE.Vector3();
          m.bowl.grp.getWorldPosition(bp);
          bp.y += 0.05;
          potSystem.emitSteamPuff(bp, new THREE.Vector3(0, 0.045, 0), 0.52, 0.17);
        }
      } else {
        m.bowl.soupMesh.visible = false;
      }

      let leftHandTarget = new THREE.Vector3();
      let rightHandTarget = new THREE.Vector3();
      const cosY = Math.cos(sp.seatYaw);

      if (m.eatTimer > 0) {
        m.eatTimer = Math.max(0, m.eatTimer - dt);
        const phase = 1.0 - m.eatTimer / m.eatDuration;

        const liftArc = Math.sin(Math.min(1, phase * 1.15) * Math.PI);
        const liftHeight = Math.max(0, liftArc) * 0.115;
        m.bowl.grp.position.set(
          sp.bowlHome.x * (1 - liftArc * 0.18),
          sp.bowlHome.y + liftHeight,
          sp.bowlHome.z - liftArc * 0.055
        );
        m.bowl.grp.rotation.x = liftArc * 0.22;

        if (phase < 0.34 && sp.id === 'sister') {
          leanForward = 0.20;
          headPitch = 0.24;
          mouthScaleX = 0.48;
          mouthScaleY = 0.45 + Math.sin(phase * 38) * 0.15;
          if (Math.random() < dt * 16) {
            const mp = new THREE.Vector3();
            m.headParts.mouthCavity.getWorldPosition(mp);
            potSystem.emitSteamPuff(mp, new THREE.Vector3(0, -0.02, 0.18), 0.48, 0.24);
          }
        } else if (phase < 0.72) {
          leanForward = 0.15;
          const chew = Math.sin(elapsed * 12.5);
          headPitch = 0.10 + chew * 0.055;
          happySquint = 0.76;
          mouthScaleX = 1.15;
          mouthScaleY = 0.28 + Math.max(0, chew) * 0.55;
          if (m.favoriteBonus) {
            bounceY = Math.abs(Math.sin(elapsed * 8.5)) * 0.024;
            headYaw = Math.sin(elapsed * 5.5) * 0.14;
          }
        } else {
          happySquint = 0.88;
          headPitch = 0.03;
          headYaw = Math.sin(elapsed * 4.0) * 0.10;
          mouthScaleX = 1.35;
          mouthScaleY = 0.32;
        }

        if (m.eatTimer <= 0.05) {
          m.bowl.grp.position.copy(sp.bowlHome);
          m.bowl.grp.rotation.set(0, 0, 0);
          m.bowlFill = 0.08;
          while (m.servedItems.length > 0) {
            const eaten = m.servedItems.pop();
            m.bowl.grp.remove(eaten.mesh);
            eaten.mesh.visible = false;
          }
        }

        leftHandTarget.copy(m.bowl.grp.position).add(new THREE.Vector3(-0.055 * cosY, 0.022, 0.015));
        const chopBite = phase > 0.28 && phase < 0.72 ? Math.sin(((phase - 0.28) / 0.44) * Math.PI) : 0;
        const mouthWorld = new THREE.Vector3();
        m.headParts.mouthCavity.getWorldPosition(mouthWorld);
        rightHandTarget.copy(m.bowl.grp.position).lerp(mouthWorld, chopBite * 0.72).add(new THREE.Vector3(0.062, -0.01, 0.025));
        m.chopsticks.visible = true;
      } else {
        m.bowl.grp.position.lerp(sp.bowlHome, Math.min(1, dt * 8));
        m.bowl.grp.rotation.x *= 0.85;

        if (focusWorldPos) {
          const headWorld = new THREE.Vector3();
          m.headPivot.getWorldPosition(headWorld);
          const dx = focusWorldPos.x - headWorld.x;
          const dy = focusWorldPos.y - headWorld.y;
          const dz = Math.max(0.15, focusWorldPos.z - headWorld.z);
          const worldYaw = Math.atan2(dx, dz);
          headYaw = THREE.MathUtils.clamp(worldYaw - sp.seatYaw, -0.42, 0.42);
          headPitch = THREE.MathUtils.clamp(-dy * 0.42, -0.12, 0.22);

          const dBowl = focusWorldPos.distanceTo(sp.bowlHome);
          if (dBowl < 0.26) {
            const eager = 1 - dBowl / 0.26;
            leanForward += eager * 0.15;
            mouthScaleY = 0.08 + eager * 0.38;
            happySquint = eager * 0.32;
          }
        }

        leftHandTarget.set(sp.bowlHome.x - 0.105 * cosY - 0.025, 0.015, sp.bowlHome.z - 0.045);
        rightHandTarget.set(sp.bowlHome.x + 0.105 * cosY + 0.025, 0.015, sp.bowlHome.z - 0.045);
        m.chopsticks.visible = false;
      }

      m.upperBody.position.y = 0.04 + bounceY;
      m.upperBody.rotation.x += (leanForward - m.upperBody.rotation.x) * Math.min(1, dt * 7);
      m.headPivot.rotation.y += (headYaw - m.headPivot.rotation.y) * Math.min(1, dt * 7);
      m.headPivot.rotation.x += (headPitch - m.headPivot.rotation.x) * Math.min(1, dt * 7);

      const lidClose = Math.max(blinkFactor, happySquint * 0.72);
      m.headParts.upperLids.forEach((ul) => {
        ul.rotation.x = -0.78 + lidClose * 0.92;
      });
      m.headParts.lowerLids.forEach((ll) => {
        ll.rotation.x = 0.52 - happySquint * 0.32;
      });
      m.headParts.mouthCavity.scale.set(mouthScaleX, mouthScaleY, 0.45);

      m.leftHandAnchor.position.lerp(leftHandTarget, Math.min(1, dt * 10));
      m.rightHandAnchor.position.lerp(rightHandTarget, Math.min(1, dt * 10));
      m.leftHandAnchor.rotation.set(0.12, sp.seatYaw + 0.38 + Math.PI, 0);
      m.rightHandAnchor.rotation.set(0.12, sp.seatYaw - 0.38 + Math.PI, 0);

      // Shoulder anchor nested deeply inside sloping knit torso so upper arm caps blend seamlessly!
      const shoulderL = new THREE.Vector3(-0.105 * sp.torsoScale.x, 0.165 * sp.torsoScale.y, 0.005);
      const shoulderR = new THREE.Vector3(0.105 * sp.torsoScale.x, 0.165 * sp.torsoScale.y, 0.005);
      m.upperBody.localToWorld(shoulderL);
      m.upperBody.localToWorld(shoulderR);

      this._updateBentArm(m.leftArm, shoulderL, m.leftHandAnchor.position, -1, sp.seatYaw);
      this._updateBentArm(m.rightArm, shoulderR, m.rightHandAnchor.position, 1, sp.seatYaw);
    }
  }

  _updateBentArm(rig, shoulder, wrist, side, yaw) {
    const mid = shoulder.clone().add(wrist).multiplyScalar(0.5);
    const outVec = new THREE.Vector3(side * 0.052, -0.050, -0.030).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const elbowPos = mid.add(outVec);
    elbowPos.y = Math.max(0.032, elbowPos.y);

    rig.elbow.position.copy(elbowPos);

    const alignSeg = (mesh, a, b) => {
      const m = a.clone().add(b).multiplyScalar(0.5);
      const d = b.clone().sub(a);
      const len = d.length();
      mesh.position.copy(m);
      mesh.scale.set(1, Math.max(0.25, (len - 0.035) / 0.13), 1);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    };
    alignSeg(rig.upper, shoulder, elbowPos);
    alignSeg(rig.fore, elbowPos, wrist);
  }
}
