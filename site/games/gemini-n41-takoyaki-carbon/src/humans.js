import * as THREE from 'three';

function createSkinMaterial(textures, baseHex, flushStrength = 1.0, useVertexColors = true) {
  const skinDetail = textures.skinDetailMap;
  const skinNorm = textures.skinNormalMap;
  skinDetail.repeat.set(4, 4);
  skinNorm.repeat.set(5, 5);

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(baseHex),
    vertexColors: useVertexColors,
    map: skinDetail,
    normalMap: skinNorm,
    normalScale: new THREE.Vector2(0.20, 0.20),
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.11,
    clearcoatRoughness: 0.42,
    sheen: 0.30,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0xffc4ad),
    envMapIntensity: 0.58,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlush = { value: flushStrength };
    shader.fragmentShader =
      'uniform float uFlush;\n' +
      shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float directLum = dot(reflectedLight.directDiffuse, vec3(0.333));
        float sssBand = smoothstep(0.01, 0.38, directLum) * (1.0 - smoothstep(0.30, 0.90, directLum));
        reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.28, 0.070, 0.038) * sssBand * uFlush;
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.065, 0.020, 0.012) * uFlush;
        `
      );
    mat.userData.shader = shader;
  };
  return mat;
}

// Continuous single-surface parametric anatomical human head & seamless neck (ZERO pinch!)
function buildAnatomicalHeadGeometry(opts = {}) {
  const {
    isFemale = true,
    lipColor = new THREE.Color(0xb8524e),
    cheekColor = new THREE.Color(0xdc7568),
  } = opts;

  const segU = 96;
  const segV = 76;
  const vertCount = (segU + 1) * (segV + 1);

  const basePos = new Float32Array(vertCount * 3);
  const smilePos = new Float32Array(vertCount * 3);
  const openPos = new Float32Array(vertCount * 3);
  const fuuPos = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  const jawWidth = isFemale ? 0.86 : 0.96;
  const chinSharp = isFemale ? 1.0 : 0.82;
  const noseScale = isFemale ? 0.96 : 1.08;
  const browScale = isFemale ? 0.55 : 1.05;
  const neckR = isFemale ? 0.043 : 0.051;

  const gauss = (dx, dy, rx, ry) => Math.exp(-((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)));

  function evalPoint(u, v, mode) {
    const phi = (u - 0.5) * Math.PI * 2; // 0 at +Z front
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    const frontMask = Math.max(0, cosP);
    let x, y, z;

    // Natural oval human jawline & slender neck (full rounded chin + jaw, zero V-pinch!)
    const neckR = isFemale ? 0.035 : 0.042;
    y = -0.145 + v * 0.263; // -0.145 (inside collar) -> +0.118 (crown)

    // Head ovoid starts with rounded chin fullness (theta0 = 0.18*PI at chin y = -0.082 -> PI at crown y = +0.118)
    const rawH = THREE.MathUtils.clamp((y - -0.082) / 0.200, 0.0, 1.0);
    const theta = (0.19 + rawH * 0.81) * Math.PI;
    const sinT = Math.sin(theta);

    // Full soft cheeks & jawline on lower face, tapering gently only near crown
    const jawFullness = THREE.MathUtils.smoothstep(rawH, 0.0, 0.30);
    const rxHead = (isFemale ? 0.052 : 0.058) + (isFemale ? 0.019 : 0.020) * jawFullness;
    const rzHead = 0.068 + 0.020 * jawFullness;
    const crownCap = rawH > 0.55 ? Math.pow(Math.max(0, sinT / Math.sin(0.64 * Math.PI)), 0.68) : 1.0;

    const backDepth = cosP < 0 ? 1.04 : 1.0;
    const chinPad = Math.exp(-Math.pow((rawH - 0.04) / 0.09, 2)) * 0.006 * frontMask * chinSharp;

    const xHead = sinP * rxHead * crownCap;
    const zHead = cosP * rzHead * backDepth * crownCap + chinPad - 0.004;

    // Slender human neck tucked gracefully behind chin
    const xNeck = sinP * neckR;
    const zNeck = cosP * neckR - 0.014;

    // Smooth submental jawline curve at y = -0.088 .. -0.072
    const jawBlend = THREE.MathUtils.smootherstep(y, -0.092, -0.070);
    x = THREE.MathUtils.lerp(xNeck, xHead, jawBlend);
    z = THREE.MathUtils.lerp(zNeck, zHead, jawBlend);

    if (cosP > -0.15 && y > -0.105 && y < 0.085) {
      const ax = Math.abs(x);
      const fWeight = THREE.MathUtils.smoothstep(cosP, -0.1, 0.38);

      // 1. Almond Orbital Eye Sockets (allows 3D eyeball & eyelids to emerge cleanly with full almond width!)
      const eyeX = isFemale ? 0.030 : 0.0315;
      const eyeY = 0.010;
      const almondOpen = gauss(ax - eyeX, y - eyeY, 0.0155, 0.0082);
      const socketOuter = gauss(ax - eyeX, y - eyeY, 0.024, 0.016);
      z -= (almondOpen * 0.0165 + socketOuter * 0.0045) * fWeight;

      // 2. Brow ridge & forehead
      const brow = gauss(ax - 0.026, y - 0.028, 0.022, 0.007) * 0.0045 * browScale;
      const forehead = gauss(x, y - 0.054, 0.054, 0.030) * 0.0038;
      z += (brow + forehead) * fWeight;

      // 3. Cheekbones & warm smile lift
      let cheekLiftY = 0;
      let cheekPuffZ = 0;
      if (mode === 1) {
        cheekLiftY = 0.0048;
        cheekPuffZ = 0.0045;
      } else if (mode === 2) {
        cheekLiftY = 0.0028;
        cheekPuffZ = 0.0025;
      } else if (mode === 3) {
        cheekPuffZ = 0.0042;
      }
      const malar = gauss(ax - 0.041, y - (-0.011 + cheekLiftY), 0.024, 0.021);
      const lowerCheek = gauss(ax - 0.033, y - (-0.042 + cheekLiftY * 0.5), 0.023, 0.021);
      z += (malar * (0.0075 + cheekPuffZ) + lowerCheek * (0.0036 + cheekPuffZ * 0.7)) * fWeight;
      x += Math.sign(x) * malar * (0.0024 + cheekPuffZ * 0.4) * fWeight;

      // 4. Sculpted Nose
      const bridgeT = THREE.MathUtils.clamp((0.020 - y) / 0.043, 0, 1);
      const bridgeProfile = Math.sin(bridgeT * Math.PI * 0.88);
      const bridgeMask = Math.exp(-Math.pow(x / 0.0095, 2)) * (y < 0.023 && y > -0.030 ? 1 : 0);
      const noseTip = gauss(x, y - -0.023, 0.0108, 0.0092);
      const nostrilWing = gauss(ax - 0.0112, y - -0.0265, 0.0062, 0.0058);
      const nostrilHole = gauss(ax - 0.0065, y - -0.0305, 0.0038, 0.0026);
      const alarGroove = gauss(ax - 0.016, y - -0.026, 0.0042, 0.0075);

      z +=
        (bridgeProfile * bridgeMask * 0.0155 +
          noseTip * 0.0135 +
          nostrilWing * 0.0065 -
          alarGroove * 0.0032) *
        noseScale *
        fWeight;
      y -= nostrilHole * 0.0024 * fWeight;
      z -= nostrilHole * 0.0034 * fWeight;

      if (mode === 1 || mode === 2) {
        const foldLine = gauss(ax - (0.018 + (-0.026 - y) * 0.35), y - -0.040, 0.0045, 0.016);
        z -= foldLine * (mode === 1 ? 0.0022 : 0.0014) * fWeight;
      }

      // 5. Mouth & Lips
      let mouthHalfW = isFemale ? 0.020 : 0.0225;
      let cornerLift = 0.0026;
      let jawDrop = 0.0;
      let mouthOpenGap = 0.0;
      let lipPuckerZ = 0.0;

      if (mode === 1) {
        mouthHalfW *= 1.24;
        cornerLift = 0.0078;
      } else if (mode === 2) {
        mouthHalfW *= 1.08;
        cornerLift = 0.0038;
        jawDrop = 0.019;
        mouthOpenGap = 0.014;
      } else if (mode === 3) {
        mouthHalfW *= 0.54;
        cornerLift = 0.0005;
        jawDrop = 0.005;
        mouthOpenGap = 0.0042;
        lipPuckerZ = 0.0085;
      }

      if (jawDrop > 0 && y < -0.047 && y > -0.105) {
        const jawWeight =
          THREE.MathUtils.smoothstep(-0.047 - y, 0.0, 0.020) *
          THREE.MathUtils.smoothstep(y - -0.105, 0.0, 0.018) *
          fWeight;
        y -= jawDrop * jawWeight;
        z -= jawDrop * 0.20 * jawWeight;
      }

      const normMouthX = ax / mouthHalfW;
      const smileArc = cornerLift * Math.min(1.3, normMouthX * normMouthX);

      const philtrum = gauss(x, y - -0.039, 0.0048, 0.0072);
      z -= philtrum * 0.0022 * fWeight;

      const mouthHoriz = Math.exp(-Math.pow(ax / (mouthHalfW * 1.05), 2.4));
      const cupidsBow = -0.0012 * Math.cos(Math.min(Math.PI, (ax / 0.0075) * Math.PI));
      const upperLipY = -0.0475 + smileArc * 0.85 + cupidsBow;
      const lowerLipY = -0.0585 + smileArc * 0.65 - jawDrop * 0.82;

      const upperLip = Math.exp(-Math.pow((y - upperLipY) / 0.0046, 2)) * mouthHoriz;
      const lowerLip = Math.exp(-Math.pow((y - lowerLipY) / 0.0054, 2)) * mouthHoriz;

      if (mode === 3 && y < -0.037 && y > -0.072) {
        const puckerMask = gauss(x, y - -0.054, 0.032, 0.016) * fWeight;
        x *= 1.0 - 0.36 * puckerMask;
      }

      z += (upperLip * (0.0062 + lipPuckerZ) + lowerLip * (0.0068 + lipPuckerZ)) * fWeight;

      const seamCenterY = (upperLipY + lowerLipY) * 0.5;
      const halfGap = 0.0012 + mouthOpenGap * 0.55 * Math.max(0, 1.0 - Math.pow(normMouthX, 2));
      const distToSeam = Math.abs(y - seamCenterY);
      if (normMouthX < 0.98) {
        const seamFactor = Math.exp(-Math.pow(distToSeam / (halfGap + 0.0020), 2)) * (1.0 - Math.pow(normMouthX, 2.2));
        const depthPush = mouthOpenGap > 0.002 ? 0.019 : 0.0038;
        z -= seamFactor * depthPush * fWeight;
      }

      const chinGroove = gauss(x, y - (-0.067 - jawDrop * 0.80), 0.018, 0.0048);
      z -= chinGroove * 0.0026 * fWeight;
    }

    // Anatomical ears
    if (Math.abs(Math.abs(phi) - Math.PI * 0.48) < 0.28 && y > -0.026 && y < 0.026) {
      const earPhi = (Math.abs(phi) - Math.PI * 0.48) / 0.14;
      const earY = (y - 0.001) / 0.022;
      const earMask = Math.exp(-(earPhi * earPhi + earY * earY));
      const earCup = Math.exp(-((earPhi * 1.8) ** 2 + (earY * 1.6) ** 2));
      x += Math.sign(x) * (earMask * 0.0095 - earCup * 0.0032);
      z -= earMask * 0.0035;
    }

    return [x, y, z];
  }

  const white = new THREE.Color(1, 1, 1);
  const shadowTint = new THREE.Color(0xdcb09e);
  const nostrilDark = new THREE.Color(0x52281e);
  const lipCreaseDark = new THREE.Color(0x6e2a28);
  const tmpCol = new THREE.Color();

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const idx = iv * (segU + 1) + iu;
      const i3 = idx * 3;

      const p0 = evalPoint(u, v, 0);
      const p1 = evalPoint(u, v, 1);
      const p2 = evalPoint(u, v, 2);
      const p3 = evalPoint(u, v, 3);

      basePos[i3] = p0[0];
      basePos[i3 + 1] = p0[1];
      basePos[i3 + 2] = p0[2];

      smilePos[i3] = p1[0];
      smilePos[i3 + 1] = p1[1];
      smilePos[i3 + 2] = p1[2];

      openPos[i3] = p2[0];
      openPos[i3 + 1] = p2[1];
      openPos[i3 + 2] = p2[2];

      fuuPos[i3] = p3[0];
      fuuPos[i3 + 1] = p3[1];
      fuuPos[i3 + 2] = p3[2];

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = v;

      const x = p0[0];
      const y = p0[1];
      const z = p0[2];
      const ax = Math.abs(x);
      tmpCol.copy(white);

      if (z > 0.01) {
        const cheekFlush = gauss(ax - 0.039, y - -0.014, 0.024, 0.020) * (isFemale ? 0.38 : 0.22);
        const noseFlush = gauss(x, y - -0.023, 0.013, 0.010) * 0.22;
        tmpCol.lerp(cheekColor, Math.min(0.48, cheekFlush + noseFlush));

        const nHole = gauss(ax - 0.0065, y - -0.0305, 0.0040, 0.0028);
        tmpCol.lerp(nostrilDark, Math.min(0.75, nHole * 0.8));

        const mouthW = isFemale ? 0.0205 : 0.023;
        const baseSmileLift = 0.0042 * Math.min(1.3, (ax / mouthW) * (ax / mouthW));
        const lipCenterY = -0.0535 + baseSmileLift;
        const lipMask =
          Math.exp(-Math.pow(Math.abs(ax / (mouthW * 1.04)), 2.4)) *
          Math.exp(-Math.pow(Math.abs((y - lipCenterY) / 0.0078), 2.2));
        tmpCol.lerp(lipColor, Math.min(0.88, lipMask * 0.96));

        const lipSeam =
          Math.exp(-Math.pow(Math.abs(ax / (mouthW * 0.98)), 2.2)) *
          Math.exp(-Math.pow(Math.abs((y - lipCenterY) / 0.0018), 2.0));
        tmpCol.lerp(lipCreaseDark, Math.min(0.76, lipSeam * 0.82));

        const eyeShade = gauss(ax - 0.030, y - 0.010, 0.019, 0.013) * 0.24;
        tmpCol.lerp(shadowTint, eyeShade);
      } else {
        // Subtle warm neck & jaw shadow tint so neck blends naturally into collar
        const neckShade = THREE.MathUtils.clamp((-0.085 - y) / 0.08, 0, 1) * 0.16;
        tmpCol.lerp(shadowTint, neckShade);
      }

      colors[i3] = tmpCol.r;
      colors[i3 + 1] = tmpCol.g;
      colors[i3 + 2] = tmpCol.b;
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(basePos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const makeMorphNormals = (posArr) => {
    const tmpGeo = new THREE.BufferGeometry();
    tmpGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    tmpGeo.setIndex(indices);
    tmpGeo.computeVertexNormals();
    return tmpGeo.getAttribute('normal');
  };

  geo.morphAttributes.position = [
    new THREE.BufferAttribute(smilePos, 3),
    new THREE.BufferAttribute(openPos, 3),
    new THREE.BufferAttribute(fuuPos, 3),
  ];
  geo.morphAttributes.normal = [
    makeMorphNormals(smilePos),
    makeMorphNormals(openPos),
    makeMorphNormals(fuuPos),
  ];

  return geo;
}

// Sculpted continuous human sweater shoulders, clavicles & snug crew collar (hugs neck with zero gap!)
function buildSweaterTorsoGeometry(isFemale = true) {
  const segU = 56;
  const segV = 30;
  const positions = [];
  const uvs = [];
  const indices = [];

  const shoulderHalfW = isFemale ? 0.162 : 0.192;
  const neckHalfW = isFemale ? 0.044 : 0.052; // Snug around neck cylinder!
  const chestDepth = isFemale ? 0.082 : 0.092;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = waist (-0.24), 1 = snug collar rim (-0.005)
    const y = -0.245 + v * 0.242;

    let halfW, halfD;
    if (v > 0.72) {
      const st = (v - 0.72) / 0.28;
      const curve = Math.pow(1.0 - st, 0.72);
      halfW = THREE.MathUtils.lerp(neckHalfW, shoulderHalfW, curve);
      halfD = THREE.MathUtils.lerp(neckHalfW * 0.98, chestDepth, curve);
    } else {
      const wt = v / 0.72;
      halfW = shoulderHalfW * (0.86 + 0.14 * Math.sin(wt * Math.PI * 0.5));
      halfD = chestDepth * (0.88 + 0.12 * wt);
    }

    const collarRoll = v > 0.88 ? Math.sin(((v - 0.88) / 0.12) * Math.PI) * 0.006 : 0;

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);

      const sqFactor = 1.0 - 0.12 * Math.pow(Math.sin(phi * 2), 2);
      let x = sp * (halfW + collarRoll) * sqFactor;
      let z = cp * (halfD + collarRoll) * sqFactor - (v > 0.8 ? ((v - 0.8) / 0.2) * 0.006 : 0);

      if (cp > 0 && v > 0.25 && v < 0.70) {
        const chestFull = Math.sin(((v - 0.25) / 0.45) * Math.PI) * Math.pow(cp, 1.6);
        z += chestFull * (isFemale ? 0.018 : 0.011);
      }
      let dy = 0;
      if (cp > 0.2 && v > 0.80) {
        dy = -Math.pow((cp - 0.2) / 0.8, 1.4) * ((v - 0.80) / 0.20) * (isFemale ? 0.016 : 0.010);
      }

      positions.push(x, y + dy, z);
      uvs.push(u * 4, v * 3);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Anatomical Eyeball UV: maps irisR (118/256 = 0.46) to ~56% of palpebral width (natural warm Japanese iris, NO startled sclera!)
function buildEyeballGeometry(radius = 0.0122) {
  const geo = new THREE.SphereGeometry(radius, 32, 24);
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / radius;
    const y = pos.getY(i) / radius;
    const z = pos.getZ(i) / radius;
    const scale = z > 0 ? 0.44 : 0.22;
    uv.setXY(i, 0.5 + x * scale, 0.5 + y * scale);
  }
  uv.needsUpdate = true;
  return geo;
}

// Procedural fine tapered hair fringe alpha texture (hundreds of silky antialiased strands, ZERO polygon jaggies!)
let cachedFringeMap = null;
function getHairFringeTexture() {
  if (cachedFringeMap) return cachedFringeMap;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);

  // Solid opaque top root tucked inside crown cap -> seamless transition with zero horizontal band!
  const rootGrad = ctx.createLinearGradient(0, 0, 0, 182);
  rootGrad.addColorStop(0, 'rgba(255,255,255,1)');
  rootGrad.addColorStop(0.68, 'rgba(255,255,255,1)');
  rootGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rootGrad;
  ctx.fillRect(0, 0, 512, 182);

  // 420 fine tapered silky hair locks with natural side-part opening around x = 210
  for (let i = 0; i < 420; i++) {
    const u = (i + 0.5) / 420;
    const x0 = u * 512;
    const distPart = (x0 - 210) / 512;
    // Parting shorter right around x = 210, longer framing sides at edges!
    const sideLenBoost = Math.pow(Math.abs(u - 0.5) * 2.0, 1.8) * 62;
    const partShorten = Math.exp(-Math.pow(distPart / 0.07, 2)) * 34;
    const tipY = 188 + Math.sin(i * 1.9) * 14 + Math.cos(i * 0.7) * 10 + sideLenBoost - partShorten;
    const curveX = x0 + (distPart < 0 ? -14 : 18) * (0.4 + Math.abs(distPart));

    ctx.strokeStyle = `rgba(255,255,255,${0.72 + (i % 5) * 0.06})`;
    ctx.lineWidth = 1.6 + (i % 3) * 0.85;
    ctx.beginPath();
    ctx.moveTo(x0, 95);
    ctx.quadraticCurveTo((x0 + curveX) * 0.5, (95 + tipY) * 0.5, curveX, Math.min(254, tipY));
    ctx.stroke();
  }

  cachedFringeMap = new THREE.CanvasTexture(c);
  cachedFringeMap.wrapS = cachedFringeMap.wrapT = THREE.ClampToEdgeWrapping;
  return cachedFringeMap;
}

function buildHairGroup(textures, isFemale = true) {
  const group = new THREE.Group();
  textures.hairNormalMap.repeat.set(6, 2);

  const hairMat = new THREE.MeshPhysicalMaterial({
    color: isFemale ? 0x1e120c : 0x150e0a,
    normalMap: textures.hairNormalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.42,
    metalness: 0.03,
    clearcoat: 0.26,
    clearcoatRoughness: 0.36,
    sheen: 0.48,
    sheenRoughness: 0.44,
    sheenColor: new THREE.Color(0x78492a),
    side: THREE.DoubleSide,
  });

  const fringeMat = new THREE.MeshPhysicalMaterial({
    color: isFemale ? 0x1e120c : 0x150e0a,
    alphaMap: getHairFringeTexture(),
    transparent: true,
    alphaTest: 0.06,
    normalMap: textures.hairNormalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.42,
    clearcoat: 0.26,
    clearcoatRoughness: 0.36,
    sheen: 0.48,
    sheenColor: new THREE.Color(0x78492a),
    side: THREE.DoubleSide,
  });

  // 1. Smooth un-notched back/crown cranial hair cap (NEVER creates polygon jaggies on forehead!)
  const capGeo = new THREE.SphereGeometry(0.080, 48, 36);
  const capPos = capGeo.attributes.position;
  for (let i = 0; i < capPos.count; i++) {
    let x = capPos.getX(i);
    let y = capPos.getY(i);
    let z = capPos.getZ(i);

    x *= isFemale ? 1.09 : 1.05;
    y = y * 1.23 + 0.025;
    // Slightly tucked back on lower front so forehead skin sits smoothly ahead of back cap
    const lowerFront = z > 0 && y < 0.07 ? THREE.MathUtils.smoothstep(0.07 - y, 0, 0.05) : 0;
    z = z * (1.10 - lowerFront * 0.28) - 0.010;

    if (!isFemale && y < -0.055) {
      y = -0.055 + (y + 0.055) * 0.15;
    } else if (isFemale && y < -0.112) {
      // Gently curve bob tips inward around neck!
      const bobIn = THREE.MathUtils.smoothstep(-0.04 - y, 0, 0.07);
      x *= 1.0 - bobIn * 0.16;
      y = Math.max(-0.112, y);
    }
    capPos.setXYZ(i, x, y, z);
  }
  capGeo.computeVertexNormals();
  const capMesh = new THREE.Mesh(capGeo, hairMat);
  capMesh.castShadow = true;
  group.add(capMesh);

  // 2. Smooth high-resolution Silky Front Bangs & Side-Framing Shell using antialiased fringe alphaMap!
  const fringeSegU = 56;
  const fringeSegV = 20;
  const fVerts = [];
  const fUvs = [];
  const fIdx = [];
  const arcHalf = isFemale ? Math.PI * 0.56 : Math.PI * 0.50;

  for (let iv = 0; iv <= fringeSegV; iv++) {
    const v = iv / fringeSegV; // 0 = crown top, 1 = soft tapered bang tips
    const yTop = 0.123;
    const yBot = isFemale ? 0.016 : 0.028;
    const yBase = THREE.MathUtils.lerp(yTop, yBot, Math.pow(v, 0.88));

    for (let iu = 0; iu <= fringeSegU; iu++) {
      const u = iu / fringeSegU;
      const phi = (u - 0.5) * 2.0 * arcHalf;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);

      // Longer face-framing sides on Mom's bob!
      const sideDrop = isFemale ? Math.pow(Math.abs(u - 0.5) * 2.0, 2.2) * 0.095 * v : Math.pow(Math.abs(u - 0.5) * 2.0, 2.2) * 0.025 * v;
      const y = yBase - sideDrop;

      // Tuck root (v=0) 3mm inside capMesh, emerging smoothly (+3.5mm) over forehead so ZERO crown seam shows!
      const emerge = THREE.MathUtils.smoothstep(v, 0.0, 0.35);
      const headFrac = THREE.MathUtils.clamp((y - -0.082) / 0.200, 0.05, 0.995);
      const sinH = Math.sin(headFrac * Math.PI);
      const rx = (isFemale ? 0.073 : 0.076) * Math.pow(sinH, 0.66) + THREE.MathUtils.lerp(-0.003, 0.0038, emerge);
      const rz = 0.088 * Math.pow(sinH, 0.68) + THREE.MathUtils.lerp(-0.004, 0.0042, emerge);

      fVerts.push(sp * rx, y, cp * rz - 0.003);
      fUvs.push(u, 1.0 - v); // Canvas top (v_canvas=0 -> UV.y=1) = root, bottom (UV.y=0) = wispy tips!
    }
  }
  for (let iv = 0; iv < fringeSegV; iv++) {
    for (let iu = 0; iu < fringeSegU; iu++) {
      const a = iv * (fringeSegU + 1) + iu;
      const b = a + 1;
      const c = a + (fringeSegU + 1);
      const d = c + 1;
      fIdx.push(a, c, d, a, d, b);
    }
  }
  const fringeGeo = new THREE.BufferGeometry();
  fringeGeo.setAttribute('position', new THREE.Float32BufferAttribute(fVerts, 3));
  fringeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUvs, 2));
  fringeGeo.setIndex(fIdx);
  fringeGeo.computeVertexNormals();

  const fringeMesh = new THREE.Mesh(fringeGeo, fringeMat);
  fringeMesh.castShadow = true;
  group.add(fringeMesh);

  return group;
}

function createFamilyMember(textures, config) {
  const { id, isFemale, posX, posZ, yaw, skinHex, sweaterHex } = config;

  const root = new THREE.Group();
  root.position.set(posX, 0.0, posZ);
  root.rotation.y = yaw;

  // Vertex-colored skin for face; plain skin (vertexColors: false) for eyelids & hands so they NEVER turn dark!
  const faceSkinMat = createSkinMaterial(textures, skinHex, isFemale ? 1.05 : 0.92, true);
  const plainSkinMat = createSkinMaterial(textures, skinHex, isFemale ? 1.05 : 0.92, false);

  const knitNorm = textures.knitNormalMap;
  knitNorm.repeat.set(6, 5);
  const sweaterMat = new THREE.MeshPhysicalMaterial({
    color: sweaterHex,
    normalMap: knitNorm,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.86,
    sheen: 0.45,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xffdfc8),
  });

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.172, -0.03);
  torsoPivot.rotation.x = 0.06;
  root.add(torsoPivot);

  const torsoMesh = new THREE.Mesh(buildSweaterTorsoGeometry(isFemale), sweaterMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoPivot.add(torsoMesh);

  const arms = [];
  for (const s of [-1, 1]) {
    // Tuck upperArm 100% smoothly inside sloping sweater shoulder so ZERO capsule bump shows!
    const shoulder = new THREE.Group();
    shoulder.position.set(s * (isFemale ? 0.094 : 0.116), -0.102, 0.005);
    torsoPivot.add(shoulder);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(isFemale ? 0.030 : 0.035, 0.125, 10, 16),
      sweaterMat
    );
    upperArm.position.set(s * 0.032, -0.044, 0.026);
    upperArm.rotation.x = -0.36;
    upperArm.rotation.z = -s * 0.34;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(s * 0.062, -0.088, 0.068);
    shoulder.add(forearmGroup);

    const sleeveForearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(isFemale ? 0.028 : 0.033, 0.105, 10, 16),
      sweaterMat
    );
    sleeveForearm.rotation.x = Math.PI / 2 - 0.08;
    sleeveForearm.rotation.z = s * 0.34;
    sleeveForearm.position.set(-s * 0.028, 0.008, 0.052);
    forearmGroup.add(sleeveForearm);

    const handPalm = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), plainSkinMat);
    handPalm.scale.set(0.95, 0.52, 1.22);
    handPalm.position.set(-s * 0.058, 0.004, 0.115);
    forearmGroup.add(handPalm);

    arms.push({ side: s, shoulder, forearmGroup });
  }

  // Natural human neck proportion above snug sweater collar!
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.084, 0.010);
  torsoPivot.add(headPivot);

  const headGeo = buildAnatomicalHeadGeometry({
    isFemale,
    lipColor: new THREE.Color(isFemale ? 0xb8524e : 0xa1554f),
    cheekColor: new THREE.Color(isFemale ? 0xdc7568 : 0xca7567),
  });
  const headMesh = new THREE.Mesh(headGeo, faceSkinMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Oral cavity recessed cleanly behind lips (z = 0.045 vs lip z = 0.074) and only visible when mouth parts!
  const oralCavity = new THREE.Group();
  oralCavity.position.set(0, -0.054, 0.045);
  oralCavity.visible = false;
  headPivot.add(oralCavity);

  const throatBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x260909, side: THREE.BackSide })
  );
  oralCavity.add(throatBack);

  const upperTeeth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.005, 14, 1, true, -Math.PI * 0.4, Math.PI * 0.8),
    new THREE.MeshPhysicalMaterial({ color: 0xf4ede2, roughness: 0.2, clearcoat: 0.8, side: THREE.DoubleSide })
  );
  upperTeeth.position.set(0, 0.005, 0.010);
  oralCavity.add(upperTeeth);

  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.0085, 12, 8),
    new THREE.MeshPhysicalMaterial({ color: 0xb84c4c, roughness: 0.3, clearcoat: 0.7 })
  );
  tongue.scale.set(1.0, 0.42, 1.2);
  tongue.position.set(0, -0.006, 0.008);
  oralCavity.add(tongue);

  // Glossy 3D Eyes + Warm Plain-Skin Eyelids + Lashes + Full Sculpted Eyebrows!
  const eyeBallGeo = buildEyeballGeometry(0.0122);
  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: textures.eyeMap,
    roughness: 0.02,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 2.5,
  });

  const lashMat = new THREE.MeshStandardMaterial({
    color: 0x120a07,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const browMat = new THREE.MeshStandardMaterial({
    color: isFemale ? 0x291911 : 0x180f0a,
    roughness: 0.72,
  });

  const eyes = [];
  const eyeSpacing = isFemale ? 0.030 : 0.0315;
  for (const s of [-1, 1]) {
    // Positioned right in the almond socket (z = 0.0685) so full glossy iris, sclera corners & eyelids shine!
    const eyeSocketGroup = new THREE.Group();
    eyeSocketGroup.position.set(s * eyeSpacing, 0.010, 0.0685);
    eyeSocketGroup.rotation.y = s * 0.08;
    headPivot.add(eyeSocketGroup);

    const eyeball = new THREE.Mesh(eyeBallGeo, eyeMat);
    eyeSocketGroup.add(eyeball);

    // Upper eyelid using plainSkinMat (luminous warm skin!) gently framing top of iris
    const upperLidPivot = new THREE.Group();
    eyeSocketGroup.add(upperLidPivot);

    const upperLidGeo = new THREE.SphereGeometry(0.0128, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
    upperLidGeo.rotateX(-0.46);
    const upperLid = new THREE.Mesh(upperLidGeo, plainSkinMat);
    upperLidPivot.add(upperLid);

    const lashRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.0126, isFemale ? 0.0012 : 0.0009, 6, 20, Math.PI * 0.80),
      lashMat
    );
    lashRim.rotation.z = Math.PI * 0.10;
    lashRim.rotation.x = 1.12;
    upperLidPivot.add(lashRim);

    const lowerLidPivot = new THREE.Group();
    eyeSocketGroup.add(lowerLidPivot);

    const lowerLidGeo = new THREE.SphereGeometry(0.0127, 22, 10, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44);
    lowerLidGeo.rotateX(0.36);
    const lowerLid = new THREE.Mesh(lowerLidGeo, plainSkinMat);
    lowerLidPivot.add(lowerLid);

    // Full expressive natural Eyebrows curving cleanly 3.5mm ahead of brow ridge from inner to outer arch!
    const browGroup = new THREE.Group();
    browGroup.position.set(s * (eyeSpacing * 0.96), 0.0265, 0.0815);
    headPivot.add(browGroup);

    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-s * 0.013, -0.0008, 0.0028),
      new THREE.Vector3(s * 0.002, 0.0026, 0.0018),
      new THREE.Vector3(s * 0.016, -0.0022, -0.0055),
    ]);
    const browGeo = new THREE.TubeGeometry(browCurve, 14, isFemale ? 0.0021 : 0.0031, 6, false);
    browGeo.scale(1, 0.75, 0.60);
    browGroup.add(new THREE.Mesh(browGeo, browMat));

    eyes.push({ side: s, eyeball, upperLidPivot, lowerLidPivot, browGroup });
  }

  const hairGroup = buildHairGroup(textures, isFemale);
  headPivot.add(hairGroup);

  return {
    id,
    isFemale,
    root,
    torsoPivot,
    headPivot,
    headMesh,
    skinMat: faceSkinMat,
    eyes,
    arms,
    oralCavity,
    tongue,
    lookTarget: new THREE.Vector3(0, 0.14, 0.18),
    smoothLook: new THREE.Vector3(0, 0.14, 0.18),
    excitement: 0.32,
    blinkTimer: 1.5 + Math.random() * 2.5,
    blinkPhase: 0,
    mode: 'watch',
    modeTimer: 0,
    isHotFanning: false,
    extraDelight: false,
    onBitePending: null,
    breathPuffCount: 0,
    leanAmount: 0,
  };
}

// Build Realistic Articulated Player 3D Right Hand (plainSkinMat -> warm luminous child skin!)
function createPlayerHandAndTools(scene, textures) {
  const handRoot = new THREE.Group();
  scene.add(handRoot);

  const otsKnitNorm = textures.knitNormalMap;
  const childSweaterMat = new THREE.MeshPhysicalMaterial({
    color: 0xc97b6d, // warm berry-terracotta knit sleeve (rich evening contrast, never blinding white!)
    normalMap: otsKnitNorm,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.86,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xffdfd6),
  });

  // Subtle foreground left-shoulder silhouette at bottom-left corner for true OTS depth
  const otsShoulder = new THREE.Group();
  otsShoulder.position.set(-0.31, 0.13, 0.44);
  otsShoulder.rotation.set(0.22, 0.45, -0.28);
  scene.add(otsShoulder);
  const otsSlope = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.15, 12, 18), childSweaterMat);
  otsShoulder.add(otsSlope);

  // IMPORTANT: useVertexColors = false so child palm & 5 articulated fingers render in warm peach skin!
  const skinMat = createSkinMaterial(textures, 0xe4b598, 1.08, false);
  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2cabf,
    roughness: 0.22,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
  });

  const wristGroup = new THREE.Group();
  handRoot.add(wristGroup);

  // Snug knitted cuff flush against wrist skin (zero floating ring gap!)
  const forearmGeo = new THREE.CylinderGeometry(0.022, 0.032, 1.0, 20, 1);
  const forearmMesh = new THREE.Mesh(forearmGeo, childSweaterMat);
  forearmMesh.castShadow = true;
  scene.add(forearmMesh);

  const cuffRib = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0045, 12, 24), childSweaterMat);
  cuffRib.position.set(0, 0.001, 0.052);
  wristGroup.add(cuffRib);

  const wristBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.020, 0.026, 10, 14), skinMat);
  wristBridge.rotation.x = Math.PI / 2;
  wristBridge.position.set(0, 0.001, 0.044);
  wristGroup.add(wristBridge);

  const palmMesh = new THREE.Mesh(new THREE.SphereGeometry(0.029, 22, 18), skinMat);
  palmMesh.scale.set(1.02, 0.54, 1.15);
  palmMesh.position.set(0, 0, 0.020);
  palmMesh.castShadow = true;
  wristGroup.add(palmMesh);

  const thenarPad = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 12), skinMat);
  thenarPad.scale.set(0.9, 0.76, 1.2);
  thenarPad.position.set(-0.019, -0.005, 0.018);
  wristGroup.add(thenarPad);

  function buildFinger(radius, len1, len2, len3) {
    const base = new THREE.Group();

    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len1, 8, 12), skinMat);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.z = -len1 * 0.5;
    base.add(seg1);

    const midJoint = new THREE.Group();
    midJoint.position.z = -len1 - radius * 0.22;
    base.add(midJoint);

    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.88, len2, 8, 12), skinMat);
    seg2.rotation.x = Math.PI / 2;
    seg2.position.z = -len2 * 0.5;
    midJoint.add(seg2);

    const tipJoint = new THREE.Group();
    tipJoint.position.z = -len2 - radius * 0.20;
    midJoint.add(tipJoint);

    const seg3 = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.78, len3, 8, 12), skinMat);
    seg3.rotation.x = Math.PI / 2;
    seg3.position.z = -len3 * 0.5;
    tipJoint.add(seg3);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.60, 10, 8), nailMat);
    nail.scale.set(0.86, 0.22, 1.12);
    nail.position.set(0, radius * 0.64, -len3 * 0.56);
    tipJoint.add(nail);

    return { base, midJoint, tipJoint };
  }

  const thumb = buildFinger(0.0074, 0.019, 0.015, 0.012);
  thumb.base.position.set(-0.024, -0.005, 0.015);
  thumb.base.rotation.set(0.25, 0.58, 0.32);
  wristGroup.add(thumb.base);

  const fingerSpecs = [
    { x: -0.017, y: 0.002, z: -0.007, r: 0.0064, l1: 0.021, l2: 0.014, l3: 0.011, splay: 0.05 },
    { x: -0.005, y: 0.003, z: -0.010, r: 0.0066, l1: 0.023, l2: 0.016, l3: 0.011, splay: 0.0 },
    { x: 0.007,  y: 0.002, z: -0.008, r: 0.0062, l1: 0.021, l2: 0.014, l3: 0.010, splay: -0.05 },
    { x: 0.018,  y: 0.000, z: -0.004, r: 0.0054, l1: 0.017, l2: 0.012, l3: 0.009, splay: -0.10 },
  ];
  const fingers = fingerSpecs.map((fs) => {
    const f = buildFinger(fs.r, fs.l1, fs.l2, fs.l3);
    f.base.position.set(fs.x, fs.y, fs.z);
    f.base.rotation.y = fs.splay;
    wristGroup.add(f.base);
    return f;
  });

  const toolMount = new THREE.Group();
  toolMount.position.set(-0.013, -0.011, -0.030);
  wristGroup.add(toolMount);

  const heldTools = {};
  const woodHandleMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    roughness: 0.45,
    color: 0xc98d55,
  });
  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8edf2,
    metalness: 0.94,
    roughness: 0.14,
    envMapIntensity: 1.4,
  });

  // 1. Pick
  const pickGroup = new THREE.Group();
  const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0058, 0.082, 16), woodHandleMat);
  pickHandle.position.y = 0.028;
  pickGroup.add(pickHandle);
  const pickSpike = new THREE.Mesh(new THREE.CylinderGeometry(0.0020, 0.0006, 0.076, 12), steelMat);
  pickSpike.position.y = -0.048;
  pickGroup.add(pickSpike);
  pickGroup.rotation.x = 0.55;
  pickGroup.rotation.z = 0.15;
  heldTools.pick = pickGroup;
  toolMount.add(pickGroup);

  // 2. Sauce Brush
  const brushGroup = new THREE.Group();
  const brushHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0060, 0.0072, 0.076, 14), woodHandleMat);
  brushHandle.position.y = 0.028;
  brushGroup.add(brushHandle);
  const bristles = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.028, 0.008),
    new THREE.MeshPhysicalMaterial({ color: 0x2b0e04, roughness: 0.08, clearcoat: 1.0 })
  );
  bristles.position.y = -0.020;
  brushGroup.add(bristles);
  brushGroup.rotation.x = 0.48;
  heldTools.sauce = brushGroup;
  toolMount.add(brushGroup);

  // 3. Oil Brush
  const oilGroup = new THREE.Group();
  const oilBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.060, 16),
    new THREE.MeshStandardMaterial({ color: 0xb83b2b, roughness: 0.35 })
  );
  oilBody.position.y = 0.018;
  oilGroup.add(oilBody);
  const oilCotton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.024, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xf4dca8, roughness: 0.20, clearcoat: 0.95 })
  );
  oilCotton.position.y = -0.022;
  oilGroup.add(oilCotton);
  oilGroup.rotation.x = 0.42;
  heldTools.oil = oilGroup;
  toolMount.add(oilGroup);

  // 4. Mayo Bottle
  const mayoGroup = new THREE.Group();
  const mayoBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.084, 18),
    new THREE.MeshPhysicalMaterial({ color: 0xfbf4dc, roughness: 0.32, clearcoat: 0.35 })
  );
  mayoBody.position.y = 0.022;
  mayoGroup.add(mayoBody);
  const mayoCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.010, 0.024, 14),
    new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.35 })
  );
  mayoCap.rotation.x = Math.PI;
  mayoCap.position.y = -0.032;
  mayoGroup.add(mayoCap);
  mayoGroup.rotation.x = 0.30;
  heldTools.mayo = mayoGroup;
  toolMount.add(mayoGroup);

  // 5. Octopus Pinch
  const octoPinch = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 16, 14),
    new THREE.MeshPhysicalMaterial({
      map: textures.octopusMap,
      normalMap: textures.octopusNormalMap,
      roughness: 0.22,
      clearcoat: 0.88,
    })
  );
  octoPinch.scale.set(1.15, 0.92, 1.25);
  octoPinch.position.set(-0.004, -0.016, -0.014);
  heldTools.octopus = octoPinch;
  toolMount.add(octoPinch);

  // 6. Bonito Pinch
  const bonitoPinch = new THREE.Group();
  const kMat = new THREE.MeshStandardMaterial({
    map: textures.katsuobushiMap,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    roughness: 0.65,
  });
  for (let i = 0; i < 4; i++) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.012), kMat);
    fl.position.set((i - 1.5) * 0.005, -0.016 - (i % 2) * 0.004, -0.014);
    fl.rotation.set(0.4 * i, 0.5 * i, 0.3);
    bonitoPinch.add(fl);
  }
  heldTools.bonito = bonitoPinch;
  toolMount.add(bonitoPinch);

  // 7. Bamboo Toothpick ("爪楊枝") angled upward-left so hand stays gracefully below-right of Mom/Dad's face!
  const serveGroup = new THREE.Group();
  const toothpick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0016, 0.0007, 0.105, 10),
    new THREE.MeshStandardMaterial({ color: 0xe6cfa3, roughness: 0.55 })
  );
  toothpick.rotation.z = Math.PI * 0.34;
  toothpick.position.set(-0.044, 0.012, -0.012);
  serveGroup.add(toothpick);

  const liftedBallAnchor = new THREE.Group();
  liftedBallAnchor.position.set(-0.092, 0.026, -0.020);
  serveGroup.add(liftedBallAnchor);
  heldTools.servePick = serveGroup;
  toolMount.add(serveGroup);

  function setHeldTool(toolKey) {
    for (const [k, obj] of Object.entries(heldTools)) {
      obj.visible = k === toolKey;
    }
  }
  setHeldTool('none');

  return {
    handRoot,
    wristGroup,
    forearmMesh,
    cuffRib,
    otsShoulder,
    thumb,
    fingers,
    toolMount,
    heldTools,
    liftedBallAnchor,
    setHeldTool,
    mode: 'idle',
    targetPos: new THREE.Vector3(0.24, 0.115, 0.28),
    currentPos: new THREE.Vector3(0.24, 0.115, 0.28),
    targetRot: new THREE.Euler(-0.20, 0.28, -0.10),
    actionPulse: 0,
    flickAngle: 0,
  };
}

export function createHumans(scene, textures, fx, audio) {
  const mom = createFamilyMember(textures, {
    id: 'mom',
    isFemale: true,
    posX: -0.142,
    posZ: -0.345,
    yaw: 0.13,
    skinHex: 0xdba588,
    sweaterHex: 0xb86848,
  });
  scene.add(mom.root);

  const dad = createFamilyMember(textures, {
    id: 'dad',
    isFemale: false,
    posX: 0.148,
    posZ: -0.355,
    yaw: -0.14,
    skinHex: 0xcf9475,
    sweaterHex: 0x364739,
  });
  scene.add(dad.root);

  const family = [mom, dad];
  const playerHand = createPlayerHandAndTools(scene, textures);

  const tmpMouthPos = new THREE.Vector3();
  const tmpHeadWorld = new THREE.Vector3();
  const tmpCuffWorld = new THREE.Vector3();
  const shoulderOrigin = new THREE.Vector3(0.36, -0.06, 0.54); // Lower-right off-screen elbow/shoulder so sleeve slopes naturally!
  const tmpArmMid = new THREE.Vector3();
  const tmpArmDir = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);

  function getMouthWorldPosition(member) {
    member.oralCavity.getWorldPosition(tmpMouthPos);
    return tmpMouthPos.clone();
  }

  function setInterestTarget(worldVec, excitement = 0.4) {
    for (const m of family) {
      if (m.mode === 'watch' || m.mode === 'anticipate') {
        m.lookTarget.copy(worldVec);
        m.excitement = Math.max(m.excitement, excitement);
      }
    }
  }

  function triggerFeedSequence(member, ballInfo, onBiteConsumed) {
    if (member.mode === 'fuu' || member.mode === 'eat') return false;
    member.mode = 'fuu';
    member.modeTimer = 0;
    member.breathPuffCount = 0;
    member.isHotFanning = Boolean(ballInfo && ballInfo.heat > 0.72);
    member.extraDelight = Boolean(ballInfo && (ballInfo.octopusCount >= 2 || ballInfo.hasCheese));
    member.onBitePending = onBiteConsumed;
    audio.playFuuFuuAndBite(member.isFemale);
    return true;
  }

  function celebratePlatter() {
    for (const m of family) {
      if (m.mode === 'watch') {
        m.mode = 'celebrate';
        m.modeTimer = 0;
      }
    }
  }

  function updateMember(m, dt, time, offeredBallWorldPos) {
    m.blinkTimer -= dt;
    if (m.blinkTimer <= 0) {
      m.blinkTimer = 2.8 + Math.random() * 3.4;
      m.blinkPhase = 1.0;
    }
    if (m.blinkPhase > 0) {
      m.blinkPhase = Math.max(0, m.blinkPhase - dt * 5.2);
    }
    const blinkAmt = m.blinkPhase > 0 ? Math.sin(m.blinkPhase * Math.PI) : 0;

    m.excitement = THREE.MathUtils.lerp(m.excitement, 0.30, dt * 1.2);
    if (m.mode === 'watch' && !offeredBallWorldPos) {
      const glanceUp = Math.sin(time * 0.45 + (m.isFemale ? 0 : 1.8)) > 0.25;
      if (glanceUp) {
        m.lookTarget.lerp(new THREE.Vector3(0, 0.26, 0.42), dt * 1.8);
      }
    }

    const mouthPos = getMouthWorldPosition(m);
    let distToOffer = 999;
    if (offeredBallWorldPos) {
      distToOffer = mouthPos.distanceTo(offeredBallWorldPos);
      if (distToOffer < 0.30 && m.mode === 'watch') {
        m.mode = 'anticipate';
      }
    } else if (m.mode === 'anticipate') {
      m.mode = 'watch';
    }

    let targetSmile = 0.48 + m.excitement * 0.40;
    let targetOpen = 0.0;
    let targetFuu = 0.0;
    let targetSquint = 0.22 + m.excitement * 0.20;
    let targetBrow = m.excitement * 0.22;
    let targetLean = 0.0;
    let headNod = 0.0;
    let headTiltZ = Math.sin(time * 0.85 + (m.isFemale ? 0 : 2.1)) * 0.022;

    if (m.mode === 'anticipate' && offeredBallWorldPos) {
      m.lookTarget.copy(offeredBallWorldPos);
      const closeness = 1.0 - THREE.MathUtils.clamp((distToOffer - 0.08) / 0.24, 0, 1);
      targetLean = closeness * 0.11;
      targetSmile = 0.62;
      targetOpen = closeness * 0.52;
      targetBrow = 0.50;
      if (distToOffer > 0.34) m.mode = 'watch';
    } else if (m.mode === 'fuu') {
      m.modeTimer += dt;
      targetLean = 0.12;
      if (offeredBallWorldPos) m.lookTarget.copy(offeredBallWorldPos);

      if (m.modeTimer < 0.52) {
        const puffWave = Math.abs(Math.sin(m.modeTimer * Math.PI * 3.8));
        targetFuu = 0.72 + puffWave * 0.28;
        targetSmile = 0.15;
        targetBrow = 0.35;

        if ((m.modeTimer > 0.05 && m.breathPuffCount === 0) || (m.modeTimer > 0.30 && m.breathPuffCount === 1)) {
          m.breathPuffCount++;
          fx.spawnSteam(mouthPos.x, mouthPos.y - 0.004, mouthPos.z + 0.035, {
            vx: m.isFemale ? 0.025 : -0.025,
            vy: -0.015,
            vz: 0.26,
            size0: 0.020,
            size1: 0.082,
            alpha: 0.18,
            life: 0.65,
          });
          fx.addWindGust(0, 0.04, 0.45);
        }
      } else if (m.modeTimer < 0.72) {
        targetFuu = 0.0;
        const chomp = Math.sin(((m.modeTimer - 0.52) / 0.20) * Math.PI);
        targetOpen = chomp * 0.95;
        targetSmile = 0.48;
        if (m.modeTimer >= 0.60 && m.onBitePending) {
          const cb = m.onBitePending;
          m.onBitePending = null;
          cb(mouthPos);
        }
      } else {
        m.mode = 'savor';
        m.modeTimer = 0;
      }
    } else if (m.mode === 'savor') {
      m.modeTimer += dt;
      targetLean = 0.06 * Math.max(0, 1.0 - m.modeTimer * 0.5);
      const chew = Math.sin(m.modeTimer * 13.5);
      if (m.isHotFanning && m.modeTimer < 0.85) {
        targetOpen = 0.22 + Math.abs(chew) * 0.22;
        targetFuu = 0.26;
        targetBrow = 0.58;
        headTiltZ = Math.sin(m.modeTimer * 18) * 0.045;
      } else {
        targetSmile = m.extraDelight ? 1.0 : 0.92;
        targetOpen = Math.max(0, chew) * 0.12;
        targetSquint = m.extraDelight ? 0.78 : 0.65;
        targetBrow = 0.42;
        headNod = Math.sin(m.modeTimer * 6.5) * 0.045;
        headTiltZ = (m.isFemale ? 1 : -1) * 0.058;
      }
      if (m.modeTimer > 2.35) {
        m.mode = 'watch';
        m.isHotFanning = false;
        m.extraDelight = false;
      }
    } else if (m.mode === 'celebrate') {
      m.modeTimer += dt;
      targetSmile = 0.95;
      targetSquint = 0.68;
      targetBrow = 0.45;
      headNod = Math.sin(m.modeTimer * 7.0) * 0.04;
      if (m.modeTimer > 2.2) m.mode = 'watch';
    }

    m.leanAmount = THREE.MathUtils.lerp(m.leanAmount, targetLean, Math.min(1, dt * 6));
    const breath = Math.sin(time * 1.65 + (m.isFemale ? 0 : 1.4)) * 0.0035;
    m.torsoPivot.rotation.x = 0.06 + m.leanAmount + breath;
    m.torsoPivot.position.y = 0.172 + breath * 0.8;

    const inf = m.headMesh.morphTargetInfluences;
    inf[0] = THREE.MathUtils.lerp(inf[0], targetSmile, Math.min(1, dt * 10));
    inf[1] = THREE.MathUtils.lerp(inf[1], targetOpen, Math.min(1, dt * 16));
    inf[2] = THREE.MathUtils.lerp(inf[2], targetFuu, Math.min(1, dt * 14));
    m.oralCavity.visible = inf[1] > 0.12;

    if (m.skinMat.userData.shader) {
      const targetFlush = m.mode === 'savor' ? 1.35 : 1.0;
      m.skinMat.userData.shader.uniforms.uFlush.value = THREE.MathUtils.lerp(
        m.skinMat.userData.shader.uniforms.uFlush.value,
        targetFlush,
        dt * 4
      );
    }

    m.smoothLook.lerp(m.lookTarget, Math.min(1, dt * 6.5));
    m.headPivot.getWorldPosition(tmpHeadWorld);
    const dx = m.smoothLook.x - tmpHeadWorld.x;
    const dy = m.smoothLook.y - tmpHeadWorld.y;
    const dz = Math.max(0.18, m.smoothLook.z - tmpHeadWorld.z);

    const worldYaw = Math.atan2(dx, dz) - m.root.rotation.y;
    const worldPitch = -Math.atan2(dy, Math.hypot(dx, dz));

    m.headPivot.rotation.y = THREE.MathUtils.clamp(worldYaw * 0.42, -0.34, 0.34);
    m.headPivot.rotation.x = THREE.MathUtils.clamp(worldPitch * 0.22 - m.leanAmount * 0.60 + headNod, -0.18, 0.12);
    m.headPivot.rotation.z = THREE.MathUtils.lerp(m.headPivot.rotation.z, headTiltZ, Math.min(1, dt * 7));

    const eyeYaw = THREE.MathUtils.clamp(worldYaw * 0.45, -0.22, 0.22);
    const eyePitch = THREE.MathUtils.clamp(worldPitch * 0.35, -0.14, 0.14);

    for (const e of m.eyes) {
      e.eyeball.rotation.y = eyeYaw;
      e.eyeball.rotation.x = eyePitch;

      const lidClose = Math.max(blinkAmt, targetSquint * 0.26);
      e.upperLidPivot.rotation.x = lidClose * 0.78 + Math.max(0, eyePitch) * 0.18;
      e.lowerLidPivot.rotation.x = -targetSquint * 0.30 - blinkAmt * 0.16;
      e.browGroup.position.y = 0.027 + targetBrow * 0.0038;
    }

    for (const arm of m.arms) {
      if (m.mode === 'savor' && m.isHotFanning && m.modeTimer < 0.85 && arm.side === 1) {
        arm.forearmGroup.position.y = -0.02 + Math.sin(m.modeTimer * 24) * 0.012;
        arm.forearmGroup.position.z = 0.05;
        arm.forearmGroup.rotation.x = -0.75;
        arm.forearmGroup.rotation.z = 0.30 + Math.sin(m.modeTimer * 28) * 0.16;
      } else if (m.mode === 'celebrate') {
        const clap = Math.abs(Math.sin(m.modeTimer * 9.5));
        arm.forearmGroup.position.y = THREE.MathUtils.lerp(arm.forearmGroup.position.y, -0.07, dt * 8);
        arm.forearmGroup.position.x = arm.side * (0.005 + clap * 0.025);
        arm.forearmGroup.rotation.x = THREE.MathUtils.lerp(arm.forearmGroup.rotation.x, -0.28, dt * 8);
      } else {
        arm.forearmGroup.position.x = THREE.MathUtils.lerp(arm.forearmGroup.position.x, arm.side * 0.062, dt * 6);
        arm.forearmGroup.position.y = THREE.MathUtils.lerp(arm.forearmGroup.position.y, -0.088, dt * 6);
        arm.forearmGroup.position.z = THREE.MathUtils.lerp(arm.forearmGroup.position.z, 0.068, dt * 6);
        arm.forearmGroup.rotation.x = THREE.MathUtils.lerp(arm.forearmGroup.rotation.x, 0, dt * 6);
        arm.forearmGroup.rotation.z = THREE.MathUtils.lerp(arm.forearmGroup.rotation.z, 0, dt * 6);
      }
    }
  }

  function updatePlayerHand(dt, time) {
    const h = playerHand;
    h.currentPos.lerp(h.targetPos, Math.min(1, dt * 16));
    h.actionPulse = Math.max(0, h.actionPulse - dt * 4.5);
    h.flickAngle = THREE.MathUtils.lerp(h.flickAngle, 0, Math.min(1, dt * 11));

    const idleBob = h.mode === 'idle' ? Math.sin(time * 2.1) * 0.004 : 0;
    h.handRoot.position.set(h.currentPos.x, h.currentPos.y + idleBob, h.currentPos.z);

    let fingerCurl = 0.42;
    let pinch = 0.0;
    let rx = h.targetRot.x;
    let ry = h.targetRot.y;
    let rz = h.targetRot.z;

    if (h.mode === 'pitcher') {
      fingerCurl = 0.92;
      rx = -0.15;
      ry = 0.35;
      rz = -0.52 - h.actionPulse * 0.20;
    } else if (h.mode === 'pick') {
      fingerCurl = 0.68;
      pinch = 0.85;
      rx = -0.35 + Math.sin(h.flickAngle) * 0.30;
      ry = 0.32;
      rz = -0.12 + h.flickAngle * 0.80;
    } else if (h.mode === 'octopus' || h.mode === 'topping' || h.mode === 'bonito') {
      fingerCurl = 0.62;
      pinch = 0.90 - h.actionPulse * 0.50;
      rx = -0.42;
      ry = 0.28;
      rz = -0.08 + Math.sin(time * 14) * 0.06 * h.actionPulse;
    } else if (h.mode === 'sauce' || h.mode === 'oil') {
      fingerCurl = 0.74;
      pinch = 0.6;
      rx = -0.32;
      ry = 0.28;
      rz = -0.16 + Math.sin(time * 16) * 0.10 * h.actionPulse;
    } else if (h.mode === 'mayo') {
      fingerCurl = 0.90 + h.actionPulse * 0.14;
      rx = -0.40;
      ry = 0.25;
      rz = -0.12;
    } else if (h.mode === 'servePick') {
      fingerCurl = 0.68;
      pinch = 0.88;
      rx = -0.08;
      ry = 0.36;
      rz = -0.06;
    }

    h.wristGroup.rotation.x = THREE.MathUtils.lerp(h.wristGroup.rotation.x, rx, Math.min(1, dt * 14));
    h.wristGroup.rotation.y = THREE.MathUtils.lerp(h.wristGroup.rotation.y, ry, Math.min(1, dt * 14));
    h.wristGroup.rotation.z = THREE.MathUtils.lerp(h.wristGroup.rotation.z, rz, Math.min(1, dt * 14));

    h.cuffRib.getWorldPosition(tmpCuffWorld);
    tmpArmMid.copy(shoulderOrigin).add(tmpCuffWorld).multiplyScalar(0.5);
    tmpArmDir.copy(tmpCuffWorld).sub(shoulderOrigin);
    const armLen = tmpArmDir.length();
    h.forearmMesh.position.copy(tmpArmMid);
    h.forearmMesh.scale.set(1, armLen, 1);
    h.forearmMesh.quaternion.setFromUnitVectors(upAxis, tmpArmDir.normalize());

    h.fingers.forEach((f, idx) => {
      const c = idx < 2 && pinch > 0.4 ? 0.34 + (1 - pinch) * 0.24 : fingerCurl + idx * 0.05;
      f.base.rotation.x = THREE.MathUtils.lerp(f.base.rotation.x, c * 0.62, dt * 14);
      f.midJoint.rotation.x = THREE.MathUtils.lerp(f.midJoint.rotation.x, c * 0.80, dt * 14);
      f.tipJoint.rotation.x = THREE.MathUtils.lerp(f.tipJoint.rotation.x, c * 0.50, dt * 14);
    });
    h.thumb.base.rotation.y = THREE.MathUtils.lerp(h.thumb.base.rotation.y, 0.45 + pinch * 0.32, dt * 14);
    h.thumb.midJoint.rotation.x = THREE.MathUtils.lerp(h.thumb.midJoint.rotation.x, 0.32 + fingerCurl * 0.32, dt * 14);
  }

  function update(dt, time, offeredBallWorldPos = null) {
    for (const m of family) {
      updateMember(m, dt, time, offeredBallWorldPos);
    }
    updatePlayerHand(dt, time);
  }

  return {
    mom,
    dad,
    family,
    playerHand,
    getMouthWorldPosition,
    setInterestTarget,
    triggerFeedSequence,
    celebratePlatter,
    update,
  };
}
