import * as THREE from 'three';

/**
 * Thick, organically pillowed Japanese kissaten hotcake geometry.
 */
function createPancakeGeometry(radius = 0.62, thickness = 0.155) {
  const geo = new THREE.CylinderGeometry(radius, radius, thickness, 48, 8, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const rn = r / radius;
    const ny = y / (thickness * 0.5);

    const edgeRound = Math.sqrt(Math.max(0.08, 1 - ny * ny * 0.78));
    const ang = Math.atan2(z, x);
    const organic = 1 + 0.022 * Math.sin(ang * 3.0 + 0.6) + 0.013 * Math.cos(ang * 5.0 - 0.3);
    if (rn > 0.7) {
      const blend = (rn - 0.7) / 0.3;
      const radialScale = THREE.MathUtils.lerp(1.0, edgeRound, blend * 0.62) * organic;
      x *= radialScale;
      z *= radialScale;
    } else {
      x *= organic;
      z *= organic;
    }
    const dome = (1 - Math.min(1, rn * rn)) * 0.022 * Math.sign(y || 1);
    y += dome;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Integrated batter bubble dome with flaring base skirt (merges organically into batter — NO floating marbles!)
 */
function createOrganicBubbleGeometry() {
  const pts = [
    new THREE.Vector2(0.0001, 0.042),
    new THREE.Vector2(0.018, 0.039),
    new THREE.Vector2(0.032, 0.028),
    new THREE.Vector2(0.042, 0.012),
    new THREE.Vector2(0.052, 0.002),
    new THREE.Vector2(0.062, -0.005),
  ];
  return new THREE.LatheGeometry(pts, 14);
}

/**
 * Recessed popped-bubble batter crater with soft raised dough lip
 */
function createOrganicCraterGeometry() {
  const pts = [
    new THREE.Vector2(0.0001, -0.008),
    new THREE.Vector2(0.014, -0.007),
    new THREE.Vector2(0.020, 0.005),
    new THREE.Vector2(0.027, 0.008),
    new THREE.Vector2(0.036, 0.002),
    new THREE.Vector2(0.044, -0.004),
  ];
  return new THREE.LatheGeometry(pts, 14);
}

/**
 * Softly chamfered butter pat geometry that deforms organically as it melts.
 */
function createChamferedButterPatGeometry(w = 0.26, h = 0.125, d = 0.26, bevel = 0.024) {
  const geo = new THREE.BoxGeometry(w, h, d, 8, 5, 8);
  const pos = geo.attributes.position;
  const hw = w * 0.5 - bevel;
  const hh = h * 0.5 - bevel;
  const hd = d * 0.5 - bevel;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const cx = THREE.MathUtils.clamp(x, -hw, hw);
    const cy = THREE.MathUtils.clamp(y, -hh, hh);
    const cz = THREE.MathUtils.clamp(z, -hd, hd);
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-5) {
      const s = bevel / len;
      pos.setXYZ(i, cx + dx * s, cy + dy * s, cz + dz * s);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Custom PBR Material for a Photorealistic Japanese Kissaten Hotcake:
 * - Accurate linear-space Maillard caramel-gold browning ramp
 * - Authentic pale creamy-golden perimeter ring framing deep velvety golden-brown center
 * - Fluffy porous sponge-cake side wall with fine air holes
 * - Glossy butter-soaked darkening & specular wetness where melted butter spreads
 */
function createPancakeMaterial(noiseTex, seedOffset = 0) {
  const uniforms = {
    uNoise: { value: noiseTex },
    uCookTop: { value: 0.0 },
    uCookBot: { value: 0.0 },
    uPoreStrength: { value: 0.0 },
    uButterWet: { value: 0.0 },
    uSeed: { value: seedOffset },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.40,
    sheen: 0.24,
    sheenColor: new THREE.Color(0xdca25c),
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vCakePos;
         varying vec3 vCakeNorm;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vCakePos = position;
         vCakeNorm = normal;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uNoise;
         uniform float uCookTop;
         uniform float uCookBot;
         uniform float uPoreStrength;
         uniform float uButterWet;
         uniform float uSeed;
         varying vec3 vCakePos;
         varying vec3 vCakeNorm;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec2 pUv = vCakePos.xz * 0.80 + vec2(0.5 + uSeed * 0.17, 0.5 - uSeed * 0.13);
         vec4 nSample = texture2D(uNoise, pUv);
         vec4 nDetail = texture2D(uNoise, pUv * 3.3 + vec2(0.31, 0.67));
         vec4 nSide   = texture2D(uNoise, vec2(atan(vCakePos.z, vCakePos.x) * 0.68 + uSeed, vCakePos.y * 5.6));

         float rad = length(vCakePos.xz) / 0.62;
         float isTop = smoothstep(-0.12, 0.38, vCakeNorm.y);
         float isBot = smoothstep(0.12, -0.38, vCakeNorm.y);
         float isSide = 1.0 - max(isTop, isBot);

         float cookFace = mix(uCookBot, uCookTop, isTop);
         // Signature Japanese kissaten hotcake pale golden ring framing rich browned center
         float ringZone = smoothstep(0.73, 0.93, rad + (nSample.a - 0.5) * 0.08);
         float effectiveCook = cookFace * (1.0 - ringZone * 0.74) * (0.86 + 0.28 * nSample.r);

         // Rich linear-space photographic hotcake Maillard palette
         vec3 rawBatter  = vec3(0.70, 0.54, 0.29);   // Creamy egg-vanilla raw batter
         vec3 paleSet    = vec3(0.62, 0.41, 0.16);   // Setting golden edge ring
         vec3 goldenCake = vec3(0.34, 0.125, 0.024); // Deep appetizing kissaten caramel-gold
         vec3 richToast  = vec3(0.14, 0.042, 0.008); // Rich warm toasted chestnut
         vec3 sideSponge = vec3(0.64, 0.43, 0.19);   // Fluffy baked cream-golden sponge wall

         vec3 faceCol = mix(rawBatter, paleSet, smoothstep(0.02, 0.24, effectiveCook));
         faceCol = mix(faceCol, goldenCake, smoothstep(0.19, 0.58, effectiveCook));
         faceCol = mix(faceCol, richToast, smoothstep(0.58, 1.04, effectiveCook));

         // Authentic baked micro-pores & velvety crumb mottling
         float pores = smoothstep(0.54, 0.85, nSample.g * 0.58 + nDetail.g * 0.42);
         faceCol *= 1.0 - pores * (0.20 + uPoreStrength * 0.28) * smoothstep(0.08, 0.44, cookFace);
         faceCol *= 0.86 + 0.26 * nDetail.b;

         // Warm golden edge-browning halo while raw batter cooks from underneath
         float edgeWarm = smoothstep(0.60, 0.95, rad) * smoothstep(0.10, 0.48, uCookBot) * (1.0 - smoothstep(0.3, 0.6, cookFace));
         faceCol = mix(faceCol, goldenCake * 1.2, edgeWarm * 0.56);

         // Melted butter soaking & darkening top hotcake pores into rich glistening gold
         float butterMask = isTop * uButterWet * smoothstep(0.86, 0.08, rad + (nSample.r - 0.5) * 0.18);
         faceCol = mix(faceCol, faceCol * vec3(0.74, 0.60, 0.36), butterMask * 0.58);

         // Fluffy porous baked sponge side wall with subtle bottom-to-top warmth gradient
         float sideCook = max(uCookTop, uCookBot);
         vec3 edgeCol = mix(rawBatter * 0.96, sideSponge, smoothstep(0.05, 0.44, sideCook));
         float sidePores = smoothstep(0.50, 0.82, nSide.g * 0.55 + nSide.b * 0.45);
         edgeCol *= 1.0 - sidePores * 0.32;
         // Subtle soft shadow darkening right at stack crevices (top & bottom curve of side)
         edgeCol *= 0.88 + 0.14 * (1.0 - abs(vCakePos.y / 0.08));

         diffuseColor.rgb *= mix(faceCol, edgeCol, isSide);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float isTopR = smoothstep(-0.12, 0.38, vCakeNorm.y);
         float isSideR = 1.0 - max(isTopR, smoothstep(0.12, -0.38, vCakeNorm.y));
         float cookR = mix(uCookBot, uCookTop, isTopR);
         float baseRough = mix(0.17, 0.82, smoothstep(0.04, 0.38, cookR));
         baseRough = mix(baseRough, 0.90, isSideR);
         float radR = length(vCakePos.xz) / 0.62;
         float wetB = isTopR * uButterWet * smoothstep(0.84, 0.1, radR);
         roughnessFactor = mix(baseRough, 0.09, wetB);`
      );
  };

  mat.userData.uniforms = uniforms;
  return mat;
}

/**
 * Organic irregular poured-liquid puddle shape
 */
function createOrganicPuddleGeometry(baseRadius = 0.54, lobes = 7, amp = 0.12) {
  const shape = new THREE.Shape();
  const segs = 48;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const r = baseRadius * (1 + amp * Math.sin(a * lobes + 0.5) + amp * 0.55 * Math.cos(a * (lobes - 2) - 1.1));
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(shape, 16);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Dynamic contoured 3D maple syrup rivulet that hugs the actual rounded side contours
 * and crevices of stacked pancakes (replaces stiff floating vertical sticks!)
 */
function createContouredDrip(material, segs = 16, radialSegs = 8) {
  const ringV = radialSegs + 1;
  const vCount = (segs + 1) * ringV;
  const positions = new Float32Array(vCount * 3);
  const normals = new Float32Array(vCount * 3);
  const indices = [];
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringV + j;
      const b = (i + 1) * ringV + j;
      const c = (i + 1) * ringV + (j + 1);
      const d = i * ringV + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, material);
  mesh.visible = false;
  mesh.frustumCulled = false;

  const pCur = new THREE.Vector3();
  const pNext = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const radOut = new THREE.Vector3();
  const sideVec = new THREE.Vector3();

  function updateContour(angle, stack, topY, dripLen, widthScale, wobbleX, wobbleZ) {
    if (dripLen < 0.025 || stack.length === 0) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    radOut.set(cosA, 0, sinA);

    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;

    function evalPoint(t, out) {
      const y = Math.max(0.018, topY - t * dripLen);
      // Sample actual pancake radius at height y (hugs rounded edges & tucks softly into crevices!)
      let r = 0.60;
      let ox = 0;
      let oz = 0;
      for (let k = 0; k < stack.length; k++) {
        const c = stack[k];
        if (y >= c.baseY - 0.01 && y <= c.baseY + c.thickness + 0.03) {
          const localNy = THREE.MathUtils.clamp((y - (c.baseY + c.thickness * 0.5)) / (c.thickness * 0.5), -1, 1);
          const pillow = Math.sqrt(Math.max(0.45, 1 - localNy * localNy * 0.48));
          const organic = 1 + 0.022 * Math.sin(angle * 3.0 + 0.6) + 0.013 * Math.cos(angle * 5.0 - 0.3);
          r = 0.62 * c.sizeScale * organic * THREE.MathUtils.lerp(0.95, 1.0, pillow) + 0.005;
          const hRatio = (k + 1) / Math.max(1, stack.length);
          ox = c.offsetX + wobbleX * hRatio * 0.42;
          oz = c.offsetZ + wobbleZ * hRatio * 0.42;
          break;
        }
      }
      // Smooth curved roll-over right at the top rim (t < 0.14)
      if (t < 0.14) {
        const rt = t / 0.14;
        r -= (1 - rt) * (1 - rt) * 0.085;
      }
      // Tiny organic lateral meander down the hotcake side
      const meander = Math.sin(t * 7.0 + angle * 5.0) * 0.014 * t;
      const mx = -sinA * meander;
      const mz = cosA * meander;
      out.set(ox + cosA * r + mx, y, oz + sinA * r + mz);
    }

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      evalPoint(t, pCur);
      evalPoint(Math.min(1, t + 0.04), pNext);
      if (i === segs) {
        evalPoint(Math.max(0, t - 0.04), pNext);
        tan.subVectors(pCur, pNext).normalize();
      } else {
        tan.subVectors(pNext, pCur).normalize();
      }
      if (tan.lengthSq() < 1e-5) tan.set(0, -1, 0);

      sideVec.crossVectors(tan, radOut).normalize();
      const outN = new THREE.Vector3().crossVectors(sideVec, tan).normalize();

      // Natural viscous syrup profile: flared top lip -> sleek hugging rivulet -> plump glossy teardrop tip!
      let rThick = 0.014 * widthScale;
      if (t < 0.18) {
        rThick *= 1.0 + (1 - t / 0.18) * 1.15;
      } else if (t > 0.78) {
        const dt = (t - 0.78) / 0.22;
        rThick *= 0.85 + Math.sin(dt * Math.PI) * 1.05;
      } else {
        rThick *= 0.82 + 0.18 * Math.sin(t * 14.0 + angle * 3.0);
      }
      if (i === segs) rThick *= 0.15; // Close droplet tip cleanly!

      for (let j = 0; j <= radialSegs; j++) {
        const theta = (j / radialSegs) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        // Slightly flattened ribbon hugging the pancake surface (wider laterally, sleeker radially!)
        const rx = sideVec.x * cosT * 1.38 + outN.x * sinT * 0.78;
        const ry = sideVec.y * cosT * 1.38 + outN.y * sinT * 0.78;
        const rz = sideVec.z * cosT * 1.38 + outN.z * sinT * 0.78;
        const nx = sideVec.x * cosT + outN.x * sinT;
        const ny = sideVec.y * cosT + outN.y * sinT;
        const nz = sideVec.z * cosT + outN.z * sinT;
        const idx = i * ringV + j;
        posAttr.setXYZ(idx, pCur.x + rx * rThick, pCur.y + ry * rThick, pCur.z + rz * rThick);
        normAttr.setXYZ(idx, nx, ny, nz);
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  }

  return { mesh, updateContour };
}

/**
 * Manages the active cooking pancake (integrated organic batter bubbles + flip physics),
 * growing stoneware plate stack (with spring wobble & tasting bites),
 * chamfered melting butter pats + spreading golden oil puddles,
 * crystal golden-amber maple syrup pouring ribbon + contoured clinging 3D rivulets,
 * and glossy fresh strawberries.
 */
export function createPancakeSystem(scene, kitchen, textures, audio) {
  const sharedGeo = createPancakeGeometry(0.62, 0.155);

  // =========================================================================
  // 1. LIVE COOKING PANCAKE IN SKILLET + 28 INTEGRATED BATTER BUBBLES
  // =========================================================================
  const activeGroup = new THREE.Group();
  activeGroup.visible = false;
  scene.add(activeGroup);

  const activeMat = createPancakeMaterial(textures.pancakeNoise, 0.0);
  const activeMesh = new THREE.Mesh(sharedGeo, activeMat);
  activeMesh.castShadow = true;
  activeMesh.receiveShadow = true;
  activeGroup.add(activeMesh);

  // Exact raw-batter color matched translucent bubble domes (NO white floating marbles!)
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6c47f,
    roughness: 0.10,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.92,
  });
  const craterRimMat = new THREE.MeshStandardMaterial({
    color: 0xd4ad64,
    roughness: 0.56,
  });
  const craterHoleMat = new THREE.MeshStandardMaterial({
    color: 0xa67438,
    roughness: 0.84,
  });

  const bubbleGeo = createOrganicBubbleGeometry();
  const craterGeo = createOrganicCraterGeometry();
  const craterHoleGeo = new THREE.CircleGeometry(0.012, 10);
  craterHoleGeo.rotateX(-Math.PI / 2);

  const bubbles = [];
  const bubbleGroup = new THREE.Group();
  activeGroup.add(bubbleGroup);

  for (let i = 0; i < 28; i++) {
    const angle = i * 2.39996 + Math.random() * 0.35;
    const r = Math.sqrt((i + 0.5) / 28) * 0.49;
    const bx = Math.cos(angle) * r;
    const bz = Math.sin(angle) * r;

    // Slight radial dome height match with pancake geometry
    const rn = r / 0.62;
    const surfY = 0.0775 + (1 - Math.min(1, rn * rn)) * 0.022;

    const dome = new THREE.Mesh(bubbleGeo, bubbleMat);
    dome.position.set(bx, surfY - 0.002, bz);
    dome.visible = false;
    bubbleGroup.add(dome);

    const crater = new THREE.Group();
    crater.position.set(bx, surfY, bz);
    const rimMesh = new THREE.Mesh(craterGeo, craterRimMat);
    const holeMesh = new THREE.Mesh(craterHoleGeo, craterHoleMat);
    holeMesh.position.y = 0.001;
    crater.add(rimMesh, holeMesh);
    crater.visible = false;
    bubbleGroup.add(crater);

    bubbles.push({
      x: bx,
      z: bz,
      dome,
      crater,
      delay: 0.1 + (i / 28) * 0.42 + Math.random() * 0.12,
      maxScale: 0.62 + Math.random() * 0.92,
      growth: 0,
      popped: false,
      popTime: 0.65 + Math.random() * 0.35,
    });
  }

  const active = {
    exists: false,
    pouring: false,
    pourProgress: 0,
    sizeScale: 1.0,
    cookBot: 0,
    cookTop: 0,
    flipped: false,
    flipAnim: 0,
    isFlipping: false,
    flipStartY: 0,
    flipSquash: 0,
    slidingToPlate: false,
    slideAnim: 0,
    slideStart: new THREE.Vector3(),
    slideTarget: new THREE.Vector3(),
    readyToFlip: false,
    readyToPlate: false,
    seed: 1,
    poppedCount: 0,
  };

  // =========================================================================
  // 2. RISING STEAM PARTICLES
  // =========================================================================
  const steamCount = 46;
  const steamSprites = [];
  const steamMatBase = new THREE.SpriteMaterial({
    map: textures.steam,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    color: 0xfff6e8,
  });
  for (let i = 0; i < steamCount; i++) {
    const sp = new THREE.Sprite(steamMatBase.clone());
    sp.visible = false;
    scene.add(sp);
    steamSprites.push({
      sprite: sp,
      life: 0,
      maxLife: 1.8,
      vel: new THREE.Vector3(),
      scale0: 0.18,
      scale1: 0.64,
      maxOpacity: 0.24,
    });
  }
  let nextSteamIdx = 0;

  function spawnSteam(pos, { big = false, opacity = 0.22 } = {}) {
    const s = steamSprites[nextSteamIdx];
    nextSteamIdx = (nextSteamIdx + 1) % steamCount;
    s.life = 0.001;
    s.maxLife = big ? 2.1 + Math.random() * 0.7 : 1.15 + Math.random() * 0.5;
    s.sprite.position.copy(pos);
    s.sprite.position.x += (Math.random() - 0.5) * 0.20;
    s.sprite.position.z += (Math.random() - 0.5) * 0.20;
    s.vel.set(0.06 + Math.random() * 0.06, 0.34 + Math.random() * 0.18, (Math.random() - 0.5) * 0.06);
    s.scale0 = big ? 0.28 : 0.12;
    s.scale1 = big ? 0.90 : 0.40;
    s.maxOpacity = opacity;
    s.sprite.visible = true;
  }

  // =========================================================================
  // 3. STACKED PANCAKES ON STONEWARE PLATE (WITH SPRING WOBBLE PHYSICS!)
  // =========================================================================
  const stackGroup = new THREE.Group();
  stackGroup.position.set(kitchen.platePos.x, 0.068, kitchen.platePos.z);
  scene.add(stackGroup);

  const stack = [];
  let stackWobbleVel = new THREE.Vector2(0, 0);
  let stackWobblePos = new THREE.Vector2(0, 0);
  let bitesTaken = 0;

  function getStackTopWorldPos() {
    let h = 0.068;
    for (const c of stack) h += c.thickness;
    return new THREE.Vector3(kitchen.platePos.x + stackWobblePos.x * 0.3, h, kitchen.platePos.z + stackWobblePos.y * 0.3);
  }

  function pokeStack(dx = 0.08, dz = 0.05) {
    stackWobbleVel.x += dx;
    stackWobbleVel.y += dz;
    if (stack.length > 0) audio.playSoftClick(340);
  }

  // =========================================================================
  // 4. MELTING CHAMFERED BUTTER PATS & SPREADING GLOSSY GOLDEN OIL PUDDLE
  // =========================================================================
  const butterPats = [];

  const meltedPuddleMat = new THREE.MeshPhysicalMaterial({
    color: 0xdca41c,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const butterPuddleGeo = createOrganicPuddleGeometry(0.35, 5, 0.13);

  function createMeltingButterPat(worldStart, targetLocalPos, pancakeRef) {
    const bGeo = createChamferedButterPatGeometry(0.26, 0.125, 0.26, 0.024);
    const basePos = new Float32Array(bGeo.attributes.position.array);
    const bMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4da72,
      roughness: 0.26,
      metalness: 0.0,
      clearcoat: 0.48,
      clearcoatRoughness: 0.20,
      transparent: true,
      opacity: 0.98,
    });
    const mesh = new THREE.Mesh(bGeo, bMat);
    mesh.castShadow = true;
    mesh.position.copy(worldStart).sub(stackGroup.position);
    stackGroup.add(mesh);

    const puddle = new THREE.Mesh(butterPuddleGeo, meltedPuddleMat.clone());
    puddle.position.set(targetLocalPos.x, targetLocalPos.y + 0.021, targetLocalPos.z);
    puddle.scale.setScalar(0.01);
    puddle.visible = false;
    stackGroup.add(puddle);

    butterPats.push({
      mesh,
      geo: bGeo,
      basePos,
      mat: bMat,
      puddle,
      melt: 0,
      landed: false,
      startPos: mesh.position.clone(),
      targetPos: targetLocalPos.clone(),
      flightT: 0,
      pancakeRef,
      rotY: 0.35 + (Math.random() - 0.5) * 0.4,
    });
  }

  // =========================================================================
  // 5. GOLDEN-AMBER MAPLE SYRUP POUR & CONTOURED 3D CLINGING RIVULETS
  // =========================================================================
  // Translucent glossy amber glaze so the browned kissaten hotcake crust gleams RIGHT THROUGH!
  const syrupGlazeMat = kitchen.createAmberSyrupMaterial({ opacity: 0.44, depthWrite: false, rimBoost: 0.78 });
  const syrupStreamMat = kitchen.createAmberSyrupMaterial({ opacity: 0.86, depthWrite: true, rimBoost: 1.15 });
  const syrupDripMat = kitchen.createAmberSyrupMaterial({ opacity: 0.88, depthWrite: true, rimBoost: 1.08 });

  const pourStreamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.032, 1, 12, 12), syrupStreamMat);
  pourStreamMesh.visible = false;
  scene.add(pourStreamMesh);

  const syrupTopCap = new THREE.Mesh(createOrganicPuddleGeometry(0.52, 7, 0.14), syrupGlazeMat);
  syrupTopCap.visible = false;
  syrupTopCap.renderOrder = 2;
  stackGroup.add(syrupTopCap);

  const syrupPlatePool = new THREE.Mesh(createOrganicPuddleGeometry(0.76, 6, 0.12), syrupGlazeMat.clone());
  syrupPlatePool.position.y = 0.008;
  syrupPlatePool.scale.setScalar(0.01);
  syrupPlatePool.visible = false;
  syrupPlatePool.renderOrder = 2;
  stackGroup.add(syrupPlatePool);

  // 16 contoured organic 3D maple syrup rivulets hugging the stacked hotcake crevices!
  const syrupDrips = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
    const contour = createContouredDrip(syrupDripMat, 16, 8);
    stackGroup.add(contour.mesh);
    syrupDrips.push({
      angle,
      contour,
      progress: 0,
      speed: 0.14 + Math.random() * 0.18,
      threshold: 0.10 + (i / 16) * 0.46,
      width: 0.72 + Math.random() * 0.56,
      maxDropFrac: 0.42 + Math.random() * 0.58,
    });
  }

  let syrupAmount = 0;

  // =========================================================================
  // 6. FRESH STRAWBERRIES ON STACK
  // =========================================================================
  const platedBerries = [];

  function dropStrawberry(worldStart) {
    if (stack.length === 0) return;
    const berry = kitchen.buildStrawberryMesh();
    const topCake = stack[stack.length - 1];
    const presetAngles = [-2.25, -0.75, 0.9, 2.35, -1.5];
    const angle =
      presetAngles[platedBerries.length % presetAngles.length] +
      (platedBerries.length > 4 ? platedBerries.length * 0.6 : 0);
    const rad = 0.26 + (platedBerries.length % 2) * 0.06;
    const target = new THREE.Vector3(
      topCake.offsetX + Math.cos(angle) * rad,
      topCake.baseY + topCake.thickness + 0.092,
      topCake.offsetZ + Math.sin(angle) * rad
    );
    berry.position.copy(worldStart).sub(stackGroup.position);
    berry.rotation.set(0.32 * Math.cos(angle), angle, 0.32 * Math.sin(angle));
    stackGroup.add(berry);

    platedBerries.push({
      mesh: berry,
      startPos: berry.position.clone(),
      targetPos: target,
      t: 0,
      landed: false,
    });
  }

  // =========================================================================
  // PUBLIC GAMEPLAY ACTIONS
  // =========================================================================
  function startBatterPour(sizeScale = 1.0) {
    if (active.exists) return false;
    active.exists = true;
    active.pouring = true;
    active.pourProgress = 0.02;
    active.sizeScale = THREE.MathUtils.clamp(sizeScale, 0.8, 1.15);
    active.cookBot = 0;
    active.cookTop = 0;
    active.flipped = false;
    active.isFlipping = false;
    active.flipAnim = 0;
    active.flipSquash = 0;
    active.slidingToPlate = false;
    active.slideAnim = 0;
    active.readyToFlip = false;
    active.readyToPlate = false;
    active.poppedCount = 0;
    active.seed += 1.37;

    activeMat.userData.uniforms.uSeed.value = active.seed;
    activeMat.userData.uniforms.uCookBot.value = 0;
    activeMat.userData.uniforms.uCookTop.value = 0;
    activeMat.userData.uniforms.uPoreStrength.value = 0;
    activeMat.userData.uniforms.uButterWet.value = 0;

    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      b.growth = 0;
      b.popped = false;
      b.delay = 0.1 + (i / bubbles.length) * 0.42 + Math.random() * 0.12;
      b.dome.visible = false;
      b.crater.visible = false;
    }

    activeGroup.visible = true;
    activeMesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    audio.playBatterPour();
    return true;
  }

  function finishBatterPour() {
    active.pouring = false;
  }

  function popBubbleAtWorldPoint(worldPt) {
    if (!active.exists || active.flipped || active.isFlipping) return false;
    const localPt = activeGroup.worldToLocal(worldPt.clone());
    for (const b of bubbles) {
      if (!b.popped && b.growth > 0.22) {
        const d = Math.hypot(localPt.x - b.x, localPt.z - b.z);
        if (d < 0.24) {
          b.popped = true;
          b.dome.visible = false;
          b.crater.visible = true;
          b.crater.scale.setScalar(b.maxScale * 1.12);
          active.poppedCount++;
          audio.playBubblePop(b.maxScale * 0.7);
          spawnSteam(activeGroup.localToWorld(new THREE.Vector3(b.x, 0.12, b.z)), { opacity: 0.28 });
          return true;
        }
      }
    }
    return false;
  }

  function triggerFlip() {
    if (!active.exists || active.isFlipping || active.slidingToPlate) return false;
    active.pouring = false;
    active.isFlipping = true;
    active.flipAnim = 0;
    active.flipStartY = activeGroup.position.y;
    audio.playFlipToss();
    return true;
  }

  function triggerSlideToPlate() {
    if (!active.exists || active.isFlipping || active.slidingToPlate) return false;
    active.pouring = false;
    active.slidingToPlate = true;
    active.slideAnim = 0;
    active.slideStart.copy(activeGroup.position);
    const nextH = getStackTopWorldPos().y;
    const offX = stack.length === 0 ? 0 : (Math.random() - 0.5) * 0.068;
    const offZ = stack.length === 0 ? 0 : (Math.random() - 0.5) * 0.068;
    active.slideTarget.set(kitchen.platePos.x + offX, nextH + 0.078, kitchen.platePos.z + offZ);
    active.pendingOffsetX = offX;
    active.pendingOffsetZ = offZ;
    audio.playFlipToss();
    return true;
  }

  function commitActiveToStack() {
    const mat = createPancakeMaterial(textures.pancakeNoise, active.seed);
    mat.userData.uniforms.uCookTop.value = active.flipped ? Math.max(0.58, active.cookBot) : Math.max(0.52, active.cookTop);
    mat.userData.uniforms.uCookBot.value = active.flipped ? Math.max(0.55, active.cookTop) : Math.max(0.58, active.cookBot);
    mat.userData.uniforms.uPoreStrength.value = 0.85;

    const mesh = new THREE.Mesh(sharedGeo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const cakeThick = 0.155 * (0.94 + Math.min(0.2, active.cookBot * 0.16));
    mesh.scale.set(active.sizeScale, cakeThick / 0.155, active.sizeScale);
    mesh.rotation.y = activeMesh.rotation.y;

    let baseY = 0;
    for (const c of stack) baseY += c.thickness;

    const cakeHolder = new THREE.Group();
    cakeHolder.position.set(active.pendingOffsetX || 0, baseY + cakeThick * 0.5, active.pendingOffsetZ || 0);
    cakeHolder.add(mesh);
    stackGroup.add(cakeHolder);

    stack.push({
      group: cakeHolder,
      mesh,
      mat,
      sizeScale: active.sizeScale,
      thickness: cakeThick,
      baseY,
      offsetX: active.pendingOffsetX || 0,
      offsetZ: active.pendingOffsetZ || 0,
      heat: 1.0,
      squash: 0.24,
    });

    active.exists = false;
    active.slidingToPlate = false;
    activeGroup.visible = false;
    bitesTaken = 0;

    stackWobbleVel.x += (Math.random() - 0.5) * 0.15;
    stackWobbleVel.y += 0.08;
    audio.playPlateStack(stack.length);
    spawnSteam(getStackTopWorldPos(), { big: true, opacity: 0.32 });
  }

  function addButterToStack(worldStart) {
    if (stack.length === 0) return false;
    const topCake = stack[stack.length - 1];
    const jitterX = butterPats.length === 0 ? 0.0 : (Math.random() - 0.5) * 0.16;
    const jitterZ = butterPats.length === 0 ? 0.04 : (Math.random() - 0.5) * 0.16;
    const targetLocal = new THREE.Vector3(
      topCake.offsetX + jitterX,
      topCake.baseY + topCake.thickness + 0.015,
      topCake.offsetZ + jitterZ
    );
    createMeltingButterPat(worldStart, targetLocal, topCake);
    return true;
  }

  function pourSyrupStep(dt, spoutWorldPos) {
    if (stack.length === 0) {
      pourStreamMesh.visible = false;
      return;
    }
    const topPos = getStackTopWorldPos();
    const dist = spoutWorldPos.distanceTo(topPos);
    pourStreamMesh.visible = true;
    const mid = spoutWorldPos.clone().lerp(topPos, 0.5);
    pourStreamMesh.position.copy(mid);
    pourStreamMesh.scale.set(1.0, Math.max(0.05, dist), 1.0);
    pourStreamMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      topPos.clone().sub(spoutWorldPos).normalize()
    );

    syrupAmount = Math.min(1.4, syrupAmount + dt * 0.44);
    syrupTopCap.visible = true;
  }

  function stopSyrupPour() {
    pourStreamMesh.visible = false;
  }

  function takeHappyBite() {
    if (stack.length === 0) return false;
    bitesTaken++;
    pokeStack((Math.random() - 0.5) * 0.16, 0.12);
    audio.playHappyBite();
    spawnSteam(getStackTopWorldPos(), { big: true, opacity: 0.28 });

    // Remove a strawberry or top layer happily on repeated bites so kids can "eat" & cook a fresh breakfast!
    if (platedBerries.length > 0 && bitesTaken <= platedBerries.length) {
      const sb = platedBerries.pop();
      stackGroup.remove(sb.mesh);
    } else if (bitesTaken >= 4) {
      clearPlateForFreshBatch();
      audio.playWarmDelight(true);
    }
    return true;
  }

  function clearPlateForFreshBatch() {
    while (stack.length > 0) {
      const c = stack.pop();
      stackGroup.remove(c.group);
      c.mat.dispose();
    }
    while (butterPats.length > 0) {
      const b = butterPats.pop();
      stackGroup.remove(b.mesh);
      stackGroup.remove(b.puddle);
      b.geo.dispose();
      b.mat.dispose();
      b.puddle.material.dispose();
    }
    while (platedBerries.length > 0) {
      const sb = platedBerries.pop();
      stackGroup.remove(sb.mesh);
    }
    syrupAmount = 0;
    bitesTaken = 0;
    syrupTopCap.visible = false;
    syrupPlatePool.visible = false;
    for (const d of syrupDrips) {
      d.progress = 0;
      d.contour.mesh.visible = false;
    }
  }

  // =========================================================================
  // PER-FRAME SIMULATION UPDATE
  // =========================================================================
  let steamTick = 0;

  function update(dt, time, heatLevel) {
    steamTick += dt;

    // 1. ACTIVE SKILLET PANCAKE SIMULATION
    if (active.exists) {
      const panWorld = new THREE.Vector3();
      kitchen.skilletGroup.getWorldPosition(panWorld);

      if (active.pouring) {
        active.pourProgress = Math.min(1.0, active.pourProgress + dt * 0.85);
      } else if (active.pourProgress < 1.0) {
        active.pourProgress = Math.min(1.0, active.pourProgress + dt * 1.4);
      }

      const spread = THREE.MathUtils.smoothstep(active.pourProgress, 0, 1);

      if (!active.isFlipping && !active.slidingToPlate) {
        const cookRate = (0.115 + heatLevel * 0.085) * dt;
        if (!active.flipped) {
          active.cookBot = Math.min(1.18, active.cookBot + cookRate);
          active.cookTop = Math.min(0.24, active.cookTop + cookRate * 0.2);
        } else {
          active.cookTop = Math.min(1.15, active.cookTop + cookRate * 1.15);
        }

        if (!active.flipped && spread > 0.45) {
          for (const b of bubbles) {
            if (!b.popped && active.cookBot > b.delay) {
              b.growth = Math.min(1.0, b.growth + dt * (0.48 + heatLevel * 0.35));
              b.dome.visible = true;
              const s = b.growth * b.maxScale;
              const wobble = 1 + Math.sin(time * 9 + b.x * 20) * 0.05;
              b.dome.scale.set(s * wobble, s * (0.65 + b.growth * 0.55), s * wobble);

              if (active.cookBot > b.delay + b.popTime * 0.42 && b.growth >= 0.96) {
                b.popped = true;
                b.dome.visible = false;
                b.crater.visible = true;
                b.crater.scale.setScalar(b.maxScale * 1.06);
                active.poppedCount++;
                audio.playBubblePop(b.maxScale * 0.65);
                spawnSteam(activeGroup.localToWorld(new THREE.Vector3(b.x, 0.1, b.z)), { opacity: 0.20 });
              }
            }
          }
          activeMat.userData.uniforms.uPoreStrength.value = Math.min(1, active.poppedCount / 9);
        }

        active.readyToFlip = !active.flipped && active.cookBot >= 0.42;
        active.readyToPlate = active.flipped && active.cookTop >= 0.34;

        if (steamTick > 0.14) {
          spawnSteam(new THREE.Vector3(panWorld.x, panWorld.y + 0.18, panWorld.z), {
            opacity: active.flipped ? 0.24 : 0.17,
          });
        }
      }

      activeMat.userData.uniforms.uCookBot.value = active.cookBot;
      activeMat.userData.uniforms.uCookTop.value = active.cookTop;

      const riseFactor = 0.56 + 0.46 * THREE.MathUtils.smoothstep(Math.max(active.cookBot, active.cookTop), 0.05, 0.75);
      const squashY = 1 - active.flipSquash * 0.24;
      const squashXZ = 1 + active.flipSquash * 0.12;
      active.flipSquash = Math.max(0, active.flipSquash - dt * 3.8);

      const curXZ = active.sizeScale * (0.28 + 0.72 * spread) * squashXZ;
      const curY = (0.35 + 0.65 * spread) * riseFactor * squashY;
      activeMesh.scale.set(curXZ, curY, curXZ);
      bubbleGroup.scale.set(curXZ, curY, curXZ);
      bubbleGroup.visible = !active.flipped;

      if (active.isFlipping) {
        active.flipAnim += dt * 1.48;
        const t = Math.min(1, active.flipAnim);
        const arcH = 4 * t * (1 - t) * 1.62;
        activeGroup.position.set(panWorld.x, active.flipStartY + arcH, panWorld.z);
        activeGroup.rotation.z = (active.flipped ? Math.PI : 0) + t * Math.PI;
        activeGroup.rotation.x = Math.sin(t * Math.PI) * 0.28;

        if (t >= 1) {
          active.isFlipping = false;
          active.flipped = !active.flipped;
          activeGroup.rotation.set(0, 0, active.flipped ? Math.PI : 0);
          active.flipSquash = 1.0;
          audio.playFlipLand();
          spawnSteam(new THREE.Vector3(panWorld.x, panWorld.y + 0.22, panWorld.z), { big: true, opacity: 0.34 });
        }
      } else if (active.slidingToPlate) {
        active.slideAnim += dt * 1.65;
        const t = Math.min(1, active.slideAnim);
        const ease = 1 - Math.pow(1 - t, 3);
        activeGroup.position.lerpVectors(active.slideStart, active.slideTarget, ease);
        activeGroup.position.y += Math.sin(t * Math.PI) * 0.85;
        activeGroup.rotation.z = (active.flipped ? Math.PI : 0) + Math.sin(t * Math.PI) * 0.22;
        if (t >= 1) {
          commitActiveToStack();
        }
      } else {
        const restLocalY = 0.056 + 0.077 * curY;
        const worldSeated = new THREE.Vector3(0, restLocalY, 0);
        kitchen.skilletGroup.localToWorld(worldSeated);
        activeGroup.position.copy(worldSeated);
        activeGroup.quaternion.copy(kitchen.skilletGroup.quaternion);
        if (active.flipped) activeGroup.rotateZ(Math.PI);
      }
    }

    // 2. STACK SPRING WOBBLE
    const stiffness = 42;
    const damping = 5.4;
    stackWobbleVel.x += (-stackWobblePos.x * stiffness - stackWobbleVel.x * damping) * dt;
    stackWobbleVel.y += (-stackWobblePos.y * stiffness - stackWobbleVel.y * damping) * dt;
    stackWobblePos.x += stackWobbleVel.x * dt;
    stackWobblePos.y += stackWobbleVel.y * dt;

    for (let i = 0; i < stack.length; i++) {
      const c = stack[i];
      c.heat = Math.max(0.25, c.heat - dt * 0.015);
      c.squash = Math.max(0, c.squash - dt * 3.5);
      const heightRatio = (i + 1) / Math.max(1, stack.length);
      c.group.position.x = c.offsetX + stackWobblePos.x * heightRatio * 0.42;
      c.group.position.z = c.offsetZ + stackWobblePos.y * heightRatio * 0.42;
      c.group.rotation.z = -stackWobblePos.x * heightRatio * 0.25;
      c.group.rotation.x = stackWobblePos.y * heightRatio * 0.25;
      const sy = (c.thickness / 0.155) * (1 - c.squash * 0.28);
      const sxz = c.sizeScale * (1 + c.squash * 0.11);
      c.mesh.scale.set(sxz, sy, sxz);
    }

    if (stack.length > 0 && steamTick > 0.26) {
      const topHeat = stack[stack.length - 1].heat;
      if (topHeat > 0.35) {
        spawnSteam(getStackTopWorldPos(), { opacity: 0.16 * topHeat });
      }
    }
    if (steamTick > 0.26) steamTick = 0;

    // 3. REAL-TIME MELTING BUTTER PATS & GLOSSY GOLDEN PUDDLE
    for (const bp of butterPats) {
      if (!bp.landed) {
        bp.flightT = Math.min(1, bp.flightT + dt * 2.5);
        const t = bp.flightT;
        bp.mesh.position.lerpVectors(bp.startPos, bp.targetPos, t);
        bp.mesh.position.y += Math.sin(t * Math.PI) * 0.72 + 0.062;
        bp.mesh.rotation.y = bp.rotY * t;
        if (t >= 1) {
          bp.landed = true;
          bp.mesh.position.set(bp.targetPos.x, bp.targetPos.y + 0.062, bp.targetPos.z);
          bp.puddle.visible = true;
          audio.playButterDrop();
          pokeStack(0.05, -0.04);
          spawnSteam(stackGroup.localToWorld(bp.targetPos.clone()), { opacity: 0.28 });
        }
      } else {
        const meltSpeed = 0.075 + (bp.pancakeRef ? bp.pancakeRef.heat * 0.085 : 0.05);
        bp.melt = Math.min(0.86, bp.melt + dt * meltSpeed);

        const posAttr = bp.geo.attributes.position;
        const m = bp.melt;
        const hShrink = 1 - m * 0.54;
        const spreadOut = 1 + m * 0.44;
        for (let i = 0; i < posAttr.count; i++) {
          const bx = bp.basePos[i * 3];
          const by = bp.basePos[i * 3 + 1];
          const bz = bp.basePos[i * 3 + 2];
          const topFactor = (by + 0.0625) / 0.125;
          const cornerDist = Math.hypot(bx, bz) / 0.185;
          const droop = topFactor * cornerDist * m * 0.038;
          const bulge = (1 - topFactor * 0.46) * spreadOut;
          posAttr.setXYZ(i, bx * bulge, by * hShrink - droop, bz * bulge);
        }
        posAttr.needsUpdate = true;
        bp.geo.computeVertexNormals();

        bp.mesh.position.y = bp.targetPos.y + 0.062 * hShrink + 0.012;
        bp.mat.roughness = THREE.MathUtils.lerp(0.26, 0.06, m);
        bp.mat.clearcoat = THREE.MathUtils.lerp(0.48, 1.0, m);
        bp.mat.color.setRGB(
          THREE.MathUtils.lerp(0.96, 0.95, m),
          THREE.MathUtils.lerp(0.86, 0.72, m),
          THREE.MathUtils.lerp(0.45, 0.16, m)
        );

        const puddleScale = 0.30 + Math.pow(m, 0.72) * 0.94;
        bp.puddle.scale.setScalar(puddleScale);
        bp.puddle.material.opacity = 0.24 + m * 0.44;

        if (bp.pancakeRef) {
          const u = bp.pancakeRef.mat.userData.uniforms;
          u.uButterWet.value = Math.max(u.uButterWet.value, m * 0.95);
        }
      }
    }

    // 4. GOLDEN-AMBER VISCOUS MAPLE SYRUP TOP POOL & CONTOURED 3D RIVULETS
    if (stack.length > 0 && syrupAmount > 0.01) {
      const topCake = stack[stack.length - 1];
      const topY = topCake.baseY + topCake.thickness + 0.022;

      syrupTopCap.visible = true;
      syrupTopCap.position.set(
        topCake.offsetX + stackWobblePos.x * 0.38,
        topY,
        topCake.offsetZ + stackWobblePos.y * 0.38
      );
      const capScale = Math.min(0.98, 0.28 + syrupAmount * 0.85) * topCake.sizeScale;
      syrupTopCap.scale.setScalar(capScale);

      let maxDripProgress = 0;
      for (const d of syrupDrips) {
        if (syrupAmount > d.threshold) {
          const targetP = Math.min(d.maxDropFrac, (syrupAmount - d.threshold) * 1.48);
          d.progress += (targetP - d.progress) * Math.min(1, dt * d.speed * 2.4);
          maxDripProgress = Math.max(maxDripProgress, d.progress);

          const dripLen = d.progress * topY;
          d.contour.updateContour(d.angle, stack, topY - 0.008, dripLen, d.width, stackWobblePos.x, stackWobblePos.y);
        }
      }

      if (maxDripProgress > 0.52) {
        syrupPlatePool.visible = true;
        const poolS = THREE.MathUtils.clamp((maxDripProgress - 0.52) * 2.5 * Math.min(1.05, syrupAmount), 0.14, 1.04);
        syrupPlatePool.scale.lerp(new THREE.Vector3(poolS, poolS, poolS), Math.min(1, dt * 1.8));
      }
    }

    // 5. STRAWBERRY DROP BOUNCE
    for (const sb of platedBerries) {
      if (!sb.landed) {
        sb.t = Math.min(1, sb.t + dt * 2.4);
        sb.mesh.position.lerpVectors(sb.startPos, sb.targetPos, sb.t);
        sb.mesh.position.y += Math.sin(sb.t * Math.PI) * 0.68;
        if (sb.t >= 1) {
          sb.landed = true;
          sb.mesh.position.copy(sb.targetPos);
          audio.playSoftClick(420);
          pokeStack(-0.04, 0.05);
        }
      }
    }

    // 6. RISING STEAM SPRITES
    for (const s of steamSprites) {
      if (s.life > 0) {
        s.life += dt;
        const t = s.life / s.maxLife;
        if (t >= 1) {
          s.life = 0;
          s.sprite.visible = false;
        } else {
          s.sprite.position.addScaledVector(s.vel, dt);
          s.sprite.position.x += Math.sin(time * 1.8 + t * 5.0) * 0.002;
          const sc = THREE.MathUtils.lerp(s.scale0, s.scale1, t);
          s.sprite.scale.set(sc, sc * 1.15, 1);
          const fade = Math.sin(t * Math.PI);
          s.sprite.material.opacity = fade * s.maxOpacity;
        }
      }
    }
  }

  return {
    active,
    activeGroup,
    activeMesh,
    stack,
    stackGroup,
    butterPats,
    platedBerries,
    get syrupAmount() {
      return syrupAmount;
    },
    startBatterPour,
    finishBatterPour,
    popBubbleAtWorldPoint,
    triggerFlip,
    triggerSlideToPlate,
    addButterToStack,
    pourSyrupStep,
    stopSyrupPour,
    dropStrawberry,
    takeHappyBite,
    pokeStack,
    getStackTopWorldPos,
    clearPlateForFreshBatch,
    spawnSteam,
    update,
  };
}
