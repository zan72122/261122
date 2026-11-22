import * as THREE from '../vendor/three.module.js';

/**
 * Helper: create thick organic hand-cut udon noodle mound (naturally folded overlapping S-curves & drapes, never geometric coils)
 */
export function buildNoodleBundleMesh(strandCount, {
  radius = 0.42,
  height = 0.24,
  thickness = 0.044,
  turns = 1.65,
  seedOffset = 0,
  material,
} = {}) {
  const group = new THREE.Group();
  const phi = 2.3999632;

  for (let i = 0; i < strandCount; i++) {
    const pts = [];
    const segs = 22;
    const hFrac = i / Math.max(1, strandCount - 1);
    const seed = i * 3.71 + seedOffset * 11.3;
    const baseAngle = i * phi + seedOffset;

    // Mix of sweeping figure-8 folds, U-bends, and relaxed outer drapes (authentic hand-folded Sanuki udon!)
    const mode = i % 3;
    const radialReach = radius * (0.48 + 0.50 * Math.pow(((i * 0.6180339) % 1), 0.72));
    const yBase = hFrac * height;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const u = t * 2 - 1; // -1 .. +1
      let x, z, y;

      if (mode === 0) {
        // Sweeping folded S-ribbon draping across the mound
        const sweep = u * radialReach * 0.96;
        const bend = Math.sin(u * Math.PI * 1.15 + seed) * radialReach * 0.46;
        const rot = baseAngle;
        x = sweep * Math.cos(rot) - bend * Math.sin(rot);
        z = sweep * Math.sin(rot) + bend * Math.cos(rot);
      } else if (mode === 1) {
        // Gentle U-fold tucked over earlier strands
        const ang = baseAngle + u * Math.PI * (0.62 + 0.22 * Math.sin(seed));
        const r = radialReach * (0.42 + 0.56 * Math.cos(u * Math.PI * 0.42) + 0.14 * Math.sin(t * Math.PI * 3 + seed));
        x = Math.cos(ang) * r;
        z = Math.sin(ang) * r;
      } else {
        // Relaxed undulating outer wave with natural overlap
        const ang = baseAngle + t * Math.PI * (1.2 + turns * 0.35);
        const r = radialReach * (0.34 + 0.62 * Math.sin(t * Math.PI * 0.85 + 0.2) + 0.16 * Math.cos(t * Math.PI * 3.5 + seed));
        x = Math.cos(ang) * r;
        z = Math.sin(ang) * r;
      }

      // Clamp cleanly inside mound radius and dome the center organically
      const dist = Math.hypot(x, z);
      const maxR = radius * 0.97;
      if (dist > maxR) {
        x *= maxR / dist;
        z *= maxR / dist;
      }
      const normD = Math.min(1, Math.hypot(x, z) / Math.max(0.01, radius));
      const dome = Math.cos(normD * Math.PI * 0.5) * height * 0.55;
      const weave = Math.sin(t * Math.PI * 4.0 + seed) * thickness * 0.55;
      y = Math.max(0.015, yBase * 0.62 + dome + weave + Math.sin(t * Math.PI) * thickness * 0.85);
      pts.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    const strandRad = thickness * (0.88 + (i % 4) * 0.06);
    const geo = new THREE.TubeGeometry(curve, 28, strandRad, 8, false);
    // Subtle hand-cut Sanuki udon slightly flattened cross-section along Y
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      // Gently flatten top/bottom slightly for plump authentic udon feel
      const ny = norm.getY(k);
      pos.setY(k, pos.getY(k) - ny * strandRad * 0.14);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/**
 * Build the complete Showa Kitchen Environment (Stainless Gas Stove, Aged Wood Counter, Showa Ceramic Tiles)
 */
export function buildShowaKitchen(textures) {
  const group = new THREE.Group();

  // Right + full base: Aged darkened Showa cedar wooden countertop
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    roughnessMap: textures.wood.roughnessMap,
    bumpMap: textures.wood.bumpMap,
    bumpScale: 0.025,
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.85,
  });
  const woodCounter = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 18), woodMat);
  woodCounter.position.set(1.2, -0.15, 1.5);
  woodCounter.receiveShadow = true;
  group.add(woodCounter);

  // Left: Vintage brushed stainless-steel gas range deck (ガス台)
  const steelMat = new THREE.MeshStandardMaterial({
    map: textures.steel.map,
    roughnessMap: textures.steel.roughnessMap,
    bumpMap: textures.steel.bumpMap,
    bumpScale: 0.012,
    roughness: 0.42,
    metalness: 0.78,
    envMapIntensity: 1.15,
  });
  const stoveDeck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 5.4), steelMat);
  stoveDeck.position.set(-2.65, 0.01, -0.15);
  stoveDeck.receiveShadow = true;
  stoveDeck.castShadow = true;
  group.add(stoveDeck);

  // Metal trim lip separating stainless gas stove from wooden counter
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5c5c5a, roughness: 0.38, metalness: 0.8 });
  const trimBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 5.42), trimMat);
  trimBar.position.set(-0.05, 0.02, -0.15);
  group.add(trimBar);

  // Far-top strip: Classic Showa square ceramic kitchen tiles along the back counter ledge (tall for portrait phones!)
  const tileMat = new THREE.MeshStandardMaterial({
    map: textures.tile.map,
    roughnessMap: textures.tile.roughnessMap,
    bumpMap: textures.tile.bumpMap,
    bumpScale: 0.032,
    roughness: 0.38,
    metalness: 0.04,
    envMapIntensity: 0.95,
  });
  const tileLedge = new THREE.Mesh(new THREE.BoxGeometry(16, 0.14, 7.6), tileMat);
  tileLedge.position.set(0.0, 0.04, -5.95);
  tileLedge.receiveShadow = true;
  group.add(tileLedge);

  // Dark aged timber trim rail in front of tiles
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2d1e13, roughness: 0.62, metalness: 0.05 });
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.16, 0.12), darkWoodMat);
  backRail.position.set(0, 0.06, -2.18);
  backRail.receiveShadow = true;
  backRail.castShadow = true;
  group.add(backRail);

  // Recessed burner well + matte black cast-iron 6-prong trivet (五徳)
  const castIronMat = new THREE.MeshStandardMaterial({
    color: 0x1d1d1f,
    roughness: 0.78,
    metalness: 0.55,
  });
  const burnerCenter = new THREE.Vector3(-1.68, 0.045, -0.35);

  const burnerWell = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.96, 0.03, 32), new THREE.MeshStandardMaterial({
    color: 0x141517,
    roughness: 0.85,
    metalness: 0.4,
  }));
  burnerWell.position.copy(burnerCenter);
  group.add(burnerWell);

  const trivetRing = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.048, 10, 36), castIronMat);
  trivetRing.rotation.x = Math.PI / 2;
  trivetRing.position.set(burnerCenter.x, 0.085, burnerCenter.z);
  trivetRing.castShadow = true;
  trivetRing.receiveShadow = true;
  group.add(trivetRing);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.075, 0.065), castIronMat);
    prong.position.set(
      burnerCenter.x + Math.cos(a) * 1.18,
      0.10,
      burnerCenter.z + Math.sin(a) * 1.18
    );
    prong.rotation.y = -a;
    prong.castShadow = true;
    group.add(prong);
  }

  // Animated blue-with-warm-amber-tip Gas Flame Ring peeking beneath pot rim
  const flameUniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0.55 },
  };
  const flameMat = new THREE.ShaderMaterial({
    uniforms: flameUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uTime;
      uniform float uLevel;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float ang = atan(p.y, p.x);
        float jets = pow(0.5 + 0.5 * sin(ang * 28.0 + sin(uTime * 11.0 + ang * 4.0) * 0.35), 1.8);
        float flicker = 0.88 + 0.12 * sin(uTime * 21.0 + ang * 7.0);
        float outerR = 0.80 + uLevel * 0.14 + jets * 0.05 * uLevel;
        float ring = smoothstep(0.66, 0.80, r) * (1.0 - smoothstep(outerR - 0.08, outerR, r));
        float intensity = ring * (0.28 + 0.72 * jets) * flicker * (0.18 + uLevel * 0.65);
        // Authentic crisp cobalt-blue Showa gas burner jets with subtle warm amber flicker only at high tips
        vec3 blueCore = vec3(0.06, 0.28, 1.05);
        vec3 amberTip = vec3(0.85, 0.32, 0.04);
        float tipMix = smoothstep(0.87, 0.96, r) * pow(uLevel, 1.8) * 0.55;
        vec3 col = mix(blueCore, amberTip, tipMix);
        gl_FragColor = vec4(col * intensity, intensity);
      }
    `,
  });
  const flameRing = new THREE.Mesh(new THREE.PlaneGeometry(2.68, 2.68), flameMat);
  flameRing.rotation.x = -Math.PI / 2;
  flameRing.position.set(burnerCenter.x, 0.082, burnerCenter.z);
  group.add(flameRing);

  // Retro Showa Gas Stove Rotary Dial (コンロのつまみ) - tactile & interactive!
  const knobGroup = new THREE.Group();
  knobGroup.position.set(-2.62, 0.06, 1.56);
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.06, 24), new THREE.MeshStandardMaterial({
    color: 0x3b3d40,
    roughness: 0.45,
    metalness: 0.72,
  }));
  bezel.position.y = 0.03;
  knobGroup.add(bezel);

  // Small colored dot markers around bezel (zero text, pure physical dial affordance)
  const dotColors = [0x4c78a8, 0xd48e3b, 0xc9492c];
  dotColors.forEach((hex, idx) => {
    const ang = -Math.PI * 0.75 + idx * (Math.PI * 0.5);
    const dot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.015, 10),
      new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35, emissive: hex, emissiveIntensity: 0.25 })
    );
    dot.position.set(Math.cos(ang) * 0.34, 0.04, Math.sin(ang) * 0.34);
    knobGroup.add(dot);
  });

  const dialBody = new THREE.Group();
  const knobCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.14, 24), new THREE.MeshStandardMaterial({
    color: 0xded3be, // Retro Showa bakelite cream
    roughness: 0.28,
    metalness: 0.04,
  }));
  knobCyl.position.y = 0.11;
  knobCyl.castShadow = true;
  dialBody.add(knobCyl);

  const knobGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.38), new THREE.MeshStandardMaterial({
    color: 0x433b35, // Dark bakelite ridge
    roughness: 0.35,
  }));
  knobGrip.position.y = 0.16;
  knobGrip.castShadow = true;
  dialBody.add(knobGrip);

  // Red pointer notch on grip
  const knobTip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), new THREE.MeshStandardMaterial({
    color: 0xc94228,
    roughness: 0.3,
  }));
  knobTip.position.set(0, 0.21, -0.14);
  dialBody.add(knobTip);

  knobGroup.add(dialBody);
  group.add(knobGroup);

  // Folded Showa cotton dishcloth (ふきん) under the raw udon prep area
  const clothMat = new THREE.MeshStandardMaterial({
    map: textures.cloth.map,
    bumpMap: textures.cloth.bumpMap,
    bumpScale: 0.018,
    roughness: 0.88,
    metalness: 0.0,
  });
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.032, 1.18), clothMat);
  cloth.position.set(-1.35, 0.032, 1.56);
  cloth.rotation.y = 0.07;
  cloth.receiveShadow = true;
  cloth.castShadow = true;
  group.add(cloth);

  return { group, burnerCenter, flameUniforms, knobGroup, dialBody };
}

/**
 * Big Vintage Hammered Aluminum Boiling Pot (大鍋) with animated boiling water & swirling udon noodles
 */
export function buildBoilingPot(textures, udonMaterial) {
  const group = new THREE.Group();
  group.position.set(-1.68, 0.08, -0.35);

  // Pot body Lathe profile (thick rolled rim, authentic Japanese aluminum pot)
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.06, 0.0),
    new THREE.Vector2(1.13, 0.08),
    new THREE.Vector2(1.18, 0.96),
    new THREE.Vector2(1.24, 1.04),
    new THREE.Vector2(1.26, 1.09),
    new THREE.Vector2(1.19, 1.11),
    new THREE.Vector2(1.13, 1.04),
    new THREE.Vector2(1.10, 0.14),
    new THREE.Vector2(0.0, 0.12),
  ];
  const potGeo = new THREE.LatheGeometry(pts, 48);
  const potMat = new THREE.MeshStandardMaterial({
    map: textures.aluminum.map,
    roughnessMap: textures.aluminum.roughnessMap,
    bumpMap: textures.aluminum.bumpMap,
    bumpScale: 0.015,
    roughness: 0.34,
    metalness: 0.84,
    envMapIntensity: 1.25,
  });
  const potMesh = new THREE.Mesh(potGeo, potMat);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  group.add(potMesh);

  // Twin riveted loop handles on left & right sides
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x8f9294,
    roughness: 0.36,
    metalness: 0.86,
  });
  [-1, 1].forEach((side) => {
    const hCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.17, 0.84, -0.22),
      new THREE.Vector3(side * 1.42, 0.92, -0.14),
      new THREE.Vector3(side * 1.44, 0.95, 0.0),
      new THREE.Vector3(side * 1.42, 0.92, 0.14),
      new THREE.Vector3(side * 1.17, 0.84, 0.22),
    ]);
    const hMesh = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 18, 0.042, 8, false), handleMat);
    hMesh.castShadow = true;
    group.add(hMesh);
  });

  // Animated Boiling Water Surface Shader (warm tungsten glints, milky udon starch, frothy boil ring)
  const waterUniforms = {
    uTime: { value: 0 },
    uBoil: { value: 0.45 },
    uStarch: { value: 0.0 },
    uSwirl: { value: 0.0 },
    uSplashWave: { value: 0.0 },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uBoil;
      uniform float uSplashWave;
      varying vec2 vPos;
      varying float vElev;
      void main() {
        vec3 p = position;
        float r = length(p.xz);
        float ang = atan(p.z, p.x);
        float w1 = sin(r * 13.0 - uTime * (4.0 + uBoil * 5.0)) * 0.014 * (0.4 + uBoil);
        float w2 = sin(p.x * 9.0 + uTime * 5.2) * cos(p.z * 9.0 - uTime * 4.5) * 0.012 * (0.3 + uBoil);
        float splash = sin(r * 18.0 - uTime * 14.0) * 0.045 * uSplashWave * (1.0 - r * 0.6);
        p.y += w1 + w2 + splash;
        vElev = w1 + w2 + splash;
        vPos = p.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uBoil;
      uniform float uStarch;
      uniform float uSwirl;
      varying vec2 vPos;
      varying float vElev;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float r = length(vPos) / 1.13;
        float ang = atan(vPos.y, vPos.x) + uSwirl * 0.45;

        // Swirled coordinates for boiling convection turbulence
        vec2 swirlUv = vec2(cos(ang), sin(ang)) * r * 3.8;
        float turb1 = fbm(swirlUv + vec2(uTime * 0.45, -uTime * 0.35));
        float turb2 = fbm(swirlUv * 2.1 - vec2(uTime * 0.65, uTime * 0.52));

        // Realistic deep dark aluminum-pot interior water (LINEAR color space!) -> subtle milky starch when udon boils
        vec3 deepWater = mix(vec3(0.011, 0.014, 0.017), vec3(0.062, 0.055, 0.040), uStarch * 0.78);
        vec3 rimWater  = mix(vec3(0.032, 0.030, 0.028), vec3(0.110, 0.096, 0.072), uStarch * 0.68);
        vec3 col = mix(deepWater, rimWater, smoothstep(0.32, 0.98, r));

        // Perturbed surface normal from concentric boiling ripples + convection turbulence (crisp shimmering liquid highlights!)
        float radWave = cos(r * 22.0 - uTime * (4.5 + uBoil * 4.0)) * 0.14 * (0.4 + uBoil * 0.6);
        vec2 radDir = vPos / max(0.04, length(vPos));
        float nx = (turb1 - 0.5) * (0.62 + uBoil * 0.65) + radDir.x * radWave + vElev * 4.5;
        float nz = (turb2 - 0.5) * (0.62 + uBoil * 0.65) + radDir.y * radWave - vElev * 4.5;
        vec3 N = normalize(vec3(nx, 1.0, nz));
        vec3 V = normalize(vec3(-vPos.x * 0.16, 1.0, -vPos.y * 0.16 + 0.08));
        // Overhead bare bulb sits to the upper-right of the left-side boiling pot
        vec3 L = normalize(vec3(1.85 - vPos.x, 3.0, 0.15 - vPos.y));
        vec3 H = normalize(L + V);

        float specSharp = pow(max(0.0, dot(N, H)), 190.0);
        float specMid   = pow(max(0.0, dot(N, H)), 64.0);
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.2);

        vec3 warmBulb = vec3(1.10, 0.68, 0.30);
        col += warmBulb * (specSharp * 0.85 + specMid * 0.055);
        col += vec3(0.035, 0.045, 0.065) * fresnel * 0.35;

        // Delicate authentic bubbling starch foam: hugs inner rim tightly, grows noticeably once udon starch cooks in!
        float lace = smoothstep(0.60, 0.88, turb2 * 0.72 + turb1 * 0.38);
        float rimFoam = smoothstep(0.76, 0.98, r) * (0.14 + uBoil * 0.42 + uStarch * 0.42) * (0.30 + 0.70 * lace);
        float boilPockets = smoothstep(0.74, 0.93, turb1 * turb2 * 1.90) * uBoil * (0.06 + uStarch * 0.72);
        float foam = clamp(rimFoam + boilPockets, 0.0, 0.85);

        col = mix(col, vec3(0.32, 0.28, 0.21), foam * 0.72);

        // Translucent in the center so simmering white udon noodles show realistically beneath the water!
        float alpha = clamp(mix(0.46, 0.74, uStarch * 0.58 + r * 0.24) + foam * 0.26 + specSharp * 0.35, 0.0, 0.94);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const waterGeo = new THREE.CircleGeometry(1.12, 40);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.88;
  group.add(waterMesh);

  // Swirling thick udon noodles inside the pot (hidden until raw udon is dropped in!)
  const potNoodles = buildNoodleBundleMesh(18, {
    radius: 0.78,
    height: 0.22,
    thickness: 0.048,
    turns: 1.5,
    seedOffset: 0.4,
    material: udonMaterial,
  });
  potNoodles.position.y = 0.66;
  potNoodles.visible = false;
  group.add(potNoodles);

  return { group, waterMesh, waterUniforms, potNoodles };
}

/**
 * Raw Udon Bundle (生うどん玉) resting on a small cedar wooden prep plate
 */
export function buildRawUdonPrep(textures) {
  const group = new THREE.Group();
  group.position.set(-1.35, 0.06, 1.56);

  // Small oval wooden prep tray (木皿)
  const trayPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.54, 0.0),
    new THREE.Vector2(0.64, 0.07),
    new THREE.Vector2(0.62, 0.10),
    new THREE.Vector2(0.50, 0.04),
    new THREE.Vector2(0, 0.03),
  ];
  const trayMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    roughness: 0.65,
    color: 0xc29e72,
  });
  const tray = new THREE.Mesh(new THREE.LatheGeometry(trayPts, 32), trayMat);
  tray.castShadow = true;
  tray.receiveShadow = true;
  group.add(tray);

  // Matte floury raw udon bundle material (with subtle dough texture)
  const rawMat = new THREE.MeshStandardMaterial({
    color: 0xe6decb,
    map: textures.udon.map,
    bumpMap: textures.udon.bumpMap,
    bumpScale: 0.014,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.35,
  });

  // Delicate scattered wheat flour dusting (打ち粉) on the rustic wooden prep plate
  const flourDust = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 24).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: textures.flourDust,
      roughness: 0.96,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  flourDust.position.y = 0.036;
  group.add(flourDust);

  const rawBundle = buildNoodleBundleMesh(18, {
    radius: 0.43,
    height: 0.28,
    thickness: 0.047,
    turns: 1.5,
    seedOffset: 1.2,
    material: rawMat,
  });
  rawBundle.position.y = 0.06;
  group.add(rawBundle);

  return { group, tray, rawBundle };
}

/**
 * Woven Bamboo Zaru / Tebo Colander (竹ざる) with bouncing glistening drained udon mound
 */
export function buildBambooZaru(textures, udonMaterial) {
  const group = new THREE.Group();

  // Deep woven bamboo basket
  const basketPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.02),
    new THREE.Vector2(0.56, 0.16),
    new THREE.Vector2(0.67, 0.42),
    new THREE.Vector2(0.71, 0.54),
  ];
  const basketGeo = new THREE.LatheGeometry(basketPts, 36);
  const bambooMat = new THREE.MeshStandardMaterial({
    map: textures.bamboo.map,
    bumpMap: textures.bamboo.bumpMap,
    bumpScale: 0.03,
    alphaMap: textures.bamboo.alphaMap,
    alphaTest: 0.12,
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const basket = new THREE.Mesh(basketGeo, bambooMat);
  basket.castShadow = true;
  basket.receiveShadow = true;
  group.add(basket);

  // Sturdy aged smoked-bamboo braided rim hoop
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x8a6737,
    roughness: 0.62,
    metalness: 0.02,
    bumpMap: textures.bamboo.bumpMap,
    bumpScale: 0.015,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.036, 10, 36), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.54;
  rim.castShadow = true;
  group.add(rim);

  // Rattan-wrapped seasoned bamboo handle sticking out cleanly for easy gripping
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.69, 0.52, 0.0),
    new THREE.Vector3(1.18, 0.66, 0.0),
    new THREE.Vector3(1.66, 0.72, 0.0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 16, 0.054, 10, false), new THREE.MeshStandardMaterial({
    color: 0x6f5029,
    roughness: 0.64,
  }));
  handle.castShadow = true;
  group.add(handle);

  // Dark rattan wrap bindings at basket-handle joint
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x452d17, roughness: 0.72 });
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 6, 12), wrapMat);
    ring.position.set(0.74 + i * 0.032, 0.53 + i * 0.008, 0);
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
  }

  // Lush glistening mound of cooked udon inside the zaru (bounces physically on yugiri!)
  const zaruNoodles = buildNoodleBundleMesh(18, {
    radius: 0.52,
    height: 0.34,
    thickness: 0.048,
    turns: 1.6,
    seedOffset: 2.1,
    material: udonMaterial,
  });
  zaruNoodles.position.y = 0.14;
  zaruNoodles.visible = false;
  group.add(zaruNoodles);

  return { group, zaruNoodles };
}

/**
 * Hero Showa Ceramic Donburi Bowl (どんぶり) with inner bottom medallion,
 * served udon mound, translucent animated amber dashi surface, and overflow puddle.
 */
export function buildDonburiBowl(textures, udonMaterial) {
  const group = new THREE.Group();
  group.position.set(0.94, 0.02, 0.44);

  // Thick-walled stoneware bowl profile: v=0 inner bottom -> v=0.5 rim -> v=1 outer foot
  const pts = [
    new THREE.Vector2(0.0, 0.14),
    new THREE.Vector2(0.42, 0.15),
    new THREE.Vector2(0.76, 0.32),
    new THREE.Vector2(0.98, 0.62),
    new THREE.Vector2(1.08, 0.88),
    new THREE.Vector2(1.13, 0.94), // inner rim
    new THREE.Vector2(1.17, 0.94), // glazed rim lip
    new THREE.Vector2(1.16, 0.85), // outer wall
    new THREE.Vector2(1.04, 0.54),
    new THREE.Vector2(0.80, 0.22),
    new THREE.Vector2(0.56, 0.10),
    new THREE.Vector2(0.54, 0.0),  // foot ring
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.45, 0.07),
    new THREE.Vector2(0.0, 0.08),
  ];
  const bowlGeo = new THREE.LatheGeometry(pts, 48);
  const bowlMat = new THREE.MeshStandardMaterial({
    map: textures.donburi.map,
    roughnessMap: textures.donburi.roughnessMap,
    bumpMap: textures.donburi.bumpMap,
    bumpScale: 0.012,
    roughness: 0.22,
    metalness: 0.05,
    envMapIntensity: 1.35,
  });
  const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  group.add(bowlMesh);

  // Hidden charming painted Showa medallion at inner bottom (revealed when eating!)
  const medGeo = new THREE.CircleGeometry(0.43, 32);
  medGeo.rotateX(-Math.PI / 2);
  const medMat = new THREE.MeshStandardMaterial({
    map: textures.donburi.medallionMap,
    roughness: 0.20,
    metalness: 0.04,
    envMapIntensity: 1.15,
  });
  const medallion = new THREE.Mesh(medGeo, medMat);
  medallion.position.y = 0.155;
  medallion.receiveShadow = true;
  group.add(medallion);

  // Served glistening udon mound inside bowl (fuller & peeking invitingly at the amber broth waterline!)
  const bowlNoodles = buildNoodleBundleMesh(22, {
    radius: 0.74,
    height: 0.44,
    thickness: 0.052,
    turns: 1.55,
    seedOffset: 3.1,
    material: udonMaterial,
  });
  bowlNoodles.position.y = 0.28;
  bowlNoodles.visible = false;
  group.add(bowlNoodles);

  // Translucent Golden-Amber Dashi Broth Surface (custom ripple + specular shader)
  const brothUniforms = {
    uTime: { value: 0 },
    uRipple: { value: 0 },
    uRippleCenter: { value: new THREE.Vector2(0, 0) },
    uSwirl: { value: 0 },
    uOpacity: { value: 0.0 },
  };
  const brothMat = new THREE.ShaderMaterial({
    uniforms: brothUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uRipple;
      uniform vec2 uRippleCenter;
      varying vec2 vPos;
      varying float vWave;
      void main() {
        vec3 p = position;
        float d = length(p.xz - uRippleCenter);
        float rip = sin(d * 22.0 - uTime * 11.0) * exp(-d * 1.8) * uRipple * 0.022;
        float gentle = sin(p.x * 6.0 + uTime * 2.4) * cos(p.z * 6.0 - uTime * 2.0) * 0.004;
        p.y += rip + gentle;
        vWave = rip * 14.0 + gentle * 8.0;
        vPos = p.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uSwirl;
      uniform float uOpacity;
      varying vec2 vPos;
      varying float vWave;

      float hash2(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      void main() {
        if (uOpacity <= 0.005) discard;
        float r = length(vPos);

        // Authentic LINEAR translucent Showa soy-dashi amber broth (rich soy-honey depth after sRGB gamma!)
        vec3 deepAmber = vec3(0.028, 0.007, 0.0010);
        vec3 warmEdge  = vec3(0.105, 0.034, 0.0045);
        vec3 col = mix(deepAmber, warmEdge, smoothstep(0.14, 0.94, r));

        // Organic circular concentric soup ripples (never grid-aligned!) for crisp liquid bare-bulb reflection
        float ang = atan(vPos.y, vPos.x) + uSwirl;
        vec2 radDir = vPos / max(0.04, r);
        float cWave = cos(r * 18.0 - uTime * 2.1 + sin(ang * 3.0) * 0.6) * 0.032 + vWave * 0.24;
        float gx = radDir.x * cWave + sin(ang * 5.0 + uTime * 1.4) * 0.012;
        float gz = radDir.y * cWave + cos(ang * 4.0 - uTime * 1.6) * 0.012;
        vec3 N = normalize(vec3(gx, 1.0, gz));
        vec3 V = normalize(vec3(-vPos.x * 0.16, 1.0, -vPos.y * 0.16 + 0.08));
        // Overhead bare bulb sits upper-left relative to the right-side bowl
        vec3 L = normalize(vec3(-0.92 - vPos.x, 2.75, -0.62 - vPos.y));
        vec3 H = normalize(L + V);

        // Crisp round mirror-like bare-bulb specular glint on hot soup (zero blocky/milky glare!)
        float specPin = pow(max(0.0, dot(N, H)), 380.0);
        float specHalo = pow(max(0.0, dot(N, H)), 95.0);
        float fres = pow(1.0 - max(0.0, dot(N, V)), 3.6);

        // Subtle shimmering golden dashi oil micro-beads drifting on surface
        vec2 swirlP = vec2(cos(ang), sin(ang)) * r * 12.0;
        vec2 cell = floor(swirlP);
        vec2 f = fract(swirlP) - 0.5;
        float rnd = hash2(cell);
        float oilSpot = step(0.86, rnd) * smoothstep(0.22, 0.06, length(f)) * (0.5 + 0.5 * sin(uTime * 2.0 + rnd * 20.0));

        col += vec3(1.10, 0.68, 0.30) * (specPin * 0.95 + specHalo * 0.085);
        col += vec3(0.16, 0.085, 0.022) * oilSpot * 0.55;
        col += vec3(0.05, 0.026, 0.009) * fres * 0.35;

        // Clear amber translucency so plump gleaming white udon strands shine right through beneath the broth!
        float edgeAlpha = smoothstep(1.01, 0.90, r);
        float alpha = clamp((mix(0.40, 0.58, 1.0 - r * 0.45) + specPin * 0.42 + oilSpot * 0.14) * uOpacity * edgeAlpha, 0.0, 0.86);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const brothGeo = new THREE.CircleGeometry(1.0, 40);
  brothGeo.rotateX(-Math.PI / 2);
  const brothMesh = new THREE.Mesh(brothGeo, brothMat);
  brothMesh.position.y = 0.22;
  brothMesh.visible = false;
  brothMesh.renderOrder = 8;
  group.add(brothMesh);

  // Overflow golden dashi puddle on wooden counter around bowl base (for playful overfill discovery!)
  const puddleGeo = new THREE.CircleGeometry(1.48, 32);
  puddleGeo.rotateX(-Math.PI / 2);
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x5c3612,
    roughness: 0.05,
    metalness: 0.12,
    transparent: true,
    opacity: 0.0,
    alphaMap: textures.softGlow,
    depthWrite: false,
    envMapIntensity: 2.0,
  });
  const overflowPuddle = new THREE.Mesh(puddleGeo, puddleMat);
  overflowPuddle.position.set(0.1, 0.015, 0.08);
  group.add(overflowPuddle);

  return { group, bowlMesh, medallion, bowlNoodles, brothMesh, brothUniforms, overflowPuddle };
}

/**
 * Dashi Saucepan (おつゆ鍋) + Curved Ladle (お玉) + Animated Pouring Amber Stream
 */
export function buildDashiPotAndLadle(textures) {
  const potGroup = new THREE.Group();
  potGroup.position.set(1.42, 0.04, -1.32);

  // Vintage dark-patinated aluminum yukihira saucepan
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.64, 0.0),
    new THREE.Vector2(0.75, 0.62),
    new THREE.Vector2(0.79, 0.68),
    new THREE.Vector2(0.73, 0.70),
    new THREE.Vector2(0.69, 0.60),
    new THREE.Vector2(0.60, 0.08),
    new THREE.Vector2(0.0, 0.08),
  ];
  const mat = new THREE.MeshStandardMaterial({
    map: textures.aluminum.map,
    bumpMap: textures.aluminum.bumpMap,
    bumpScale: 0.018,
    color: 0xc2b6a2,
    roughness: 0.36,
    metalness: 0.78,
    envMapIntensity: 1.2,
  });
  const potMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), mat);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  potGroup.add(potMesh);

  // Wooden saucepan handle extending upper-right
  const woodHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.072, 1.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x7c5330, roughness: 0.68 })
  );
  woodHandle.rotation.z = -Math.PI / 2;
  woodHandle.rotation.y = 0.42;
  woodHandle.position.set(1.12, 0.62, -0.48);
  woodHandle.castShadow = true;
  potGroup.add(woodHandle);

  // Rich simmering translucent dark soy-amber dashi surface inside saucepan
  const dashiUniforms = { uTime: { value: 0 } };
  const dashiSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.70, 36).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: dashiUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main() {
          vPos = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          float r = length(vPos) / 0.70;
          // LINEAR deep rich simmering Showa soy-dashi (warm dark amber-brown after gamma, never flat gold!)
          vec3 deepSoy = vec3(0.020, 0.005, 0.0008);
          vec3 amberRim = vec3(0.068, 0.022, 0.0032);
          vec3 col = mix(deepSoy, amberRim, smoothstep(0.32, 0.98, r));

          // Gentle simmering convection micro-ripples
          float gx = sin(vPos.x * 18.0 + uTime * 2.5) * 0.055;
          float gz = cos(vPos.y * 18.0 - uTime * 2.1) * 0.055;
          vec3 N = normalize(vec3(gx, 1.0, gz));
          vec3 V = normalize(vec3(-vPos.x * 0.22, 1.0, -vPos.y * 0.22));
          vec3 L = normalize(vec3(-1.35 - vPos.x, 2.8, 1.05 - vPos.y));
          vec3 H = normalize(L + V);
          float spec = pow(max(0.0, dot(N, H)), 220.0) * 1.15 + pow(max(0.0, dot(N, H)), 48.0) * 0.055;
          col += vec3(1.2, 0.76, 0.34) * spec;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  dashiSurface.position.y = 0.56;
  potGroup.add(dashiSurface);

  // Ladle (お玉)
  const ladleGroup = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xc6c8ca,
    roughness: 0.24,
    metalness: 0.90,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  });
  const cupGeo = new THREE.SphereGeometry(0.28, 22, 14, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52);
  const cup = new THREE.Mesh(cupGeo, metalMat);
  cup.position.y = 0.24;
  cup.castShadow = true;
  ladleGroup.add(cup);

  // Amber dashi liquid inside ladle scoop (deep realistic dark soy-amber)
  const ladleLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 20).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x3b1a06,
      roughness: 0.06,
      clearcoat: 1.0,
      envMapIntensity: 1.4,
    })
  );
  ladleLiquid.position.y = 0.21;
  ladleGroup.add(ladleLiquid);

  // Curved ladle handle with wooden grip tip
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.26, 0.24, 0.0),
    new THREE.Vector3(-0.34, 0.52, 0.08),
    new THREE.Vector3(-0.62, 0.88, 0.24),
    new THREE.Vector3(-0.92, 1.12, 0.38),
  ]);
  const shaft = new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 16, 0.028, 8, false), metalMat);
  shaft.castShadow = true;
  ladleGroup.add(shaft);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.036, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b4222, roughness: 0.62 })
  );
  grip.position.set(-0.98, 1.16, 0.41);
  grip.rotation.z = 0.88;
  grip.rotation.y = 0.42;
  grip.castShadow = true;
  ladleGroup.add(grip);

  // Translucent glossy curved pouring amber dashi stream (fast custom Fresnel shader — zero extra render pass!)
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, -0.35, 0.04),
    new THREE.Vector3(0.08, -0.82, 0.06),
    new THREE.Vector3(0.08, -1.25, 0.06),
  ]);
  const streamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPos);
        vec3 L = normalize(vec3(-0.3, 0.9, -0.2));
        vec3 H = normalize(L + V);
        float fres = pow(1.0 - max(0.0, dot(N, V)), 2.0);
        float spec = pow(max(0.0, dot(N, H)), 90.0);
        vec3 amber = mix(vec3(0.09, 0.032, 0.004), vec3(0.32, 0.14, 0.025), fres);
        vec3 col = amber + vec3(1.25, 0.85, 0.42) * spec * 1.2;
        gl_FragColor = vec4(col, clamp(0.62 + fres * 0.25 + spec * 0.35, 0.0, 0.95));
      }
    `,
  });
  const pourStream = new THREE.Mesh(new THREE.TubeGeometry(streamCurve, 16, 0.042, 10, false), streamMat);
  pourStream.visible = false;
  pourStream.renderOrder = 12;

  return { potGroup, ladleGroup, ladleLiquid, pourStream, dashiUniforms };
}

/**
 * Small Showa Ceramic Dishes for Chopped Negi (刻みねぎ) and Crispy Tenkasu (天かす)
 */
export function buildToppingDishes(textures) {
  function makePlate(colorHex) {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.36, 0.0),
      new THREE.Vector2(0.52, 0.13),
      new THREE.Vector2(0.55, 0.16),
      new THREE.Vector2(0.51, 0.17),
      new THREE.Vector2(0.35, 0.05),
      new THREE.Vector2(0, 0.045),
    ];
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.24,
      metalness: 0.04,
      envMapIntensity: 1.25,
    });
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // 1. Negi small dish (muted celadon-grey stoneware)
  const negiDish = new THREE.Group();
  negiDish.position.set(2.62, 0.03, -0.06);
  negiDish.add(makePlate(0x88948a));

  const negiRingGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.022, 14);
  const negiRingMat = new THREE.MeshStandardMaterial({
    map: textures.negi,
    transparent: true,
    alphaTest: 0.25,
    roughness: 0.34,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Mound of chopped negi in the dish
  const dishNegiCount = 58;
  const dishNegi = new THREE.InstancedMesh(negiRingGeo, negiRingMat, dishNegiCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < dishNegiCount; i++) {
    const t = i / dishNegiCount;
    const ang = i * 2.39996;
    const r = Math.sqrt(t) * 0.34;
    const h = 0.07 + (1 - t) * 0.16 + Math.sin(i * 3.1) * 0.02;
    dummy.position.set(Math.cos(ang) * r, h, Math.sin(ang) * r);
    dummy.rotation.set((Math.sin(i * 5) * 0.55), i * 1.3, (Math.cos(i * 4) * 0.55));
    const s = 0.8 + (i % 5) * 0.09;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    dishNegi.setMatrixAt(i, dummy.matrix);
  }
  dishNegi.castShadow = true;
  negiDish.add(dishNegi);

  // 2. Tenkasu small dish (dark iron-brown stoneware)
  const tenkasuDish = new THREE.Group();
  tenkasuDish.position.set(2.58, 0.03, 1.12);
  tenkasuDish.add(makePlate(0x47382e));

  const tenkasuGeo = new THREE.IcosahedronGeometry(0.056, 1);
  // Organically roughen tenkasu vertices for realistic crispy fried batter bits
  const posAttr = tenkasuGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const n = 0.78 + 0.42 * Math.sin(vx * 35 + vy * 28) * Math.cos(vz * 31);
    posAttr.setXYZ(i, vx * n, vy * n * 0.72, vz * n);
  }
  tenkasuGeo.computeVertexNormals();

  const tenkasuMat = new THREE.MeshStandardMaterial({
    map: textures.tenkasu.map,
    bumpMap: textures.tenkasu.bumpMap,
    bumpScale: 0.028,
    roughness: 0.58,
    metalness: 0.02,
    envMapIntensity: 0.85,
  });

  const dishTenkasuCount = 64;
  const dishTenkasu = new THREE.InstancedMesh(tenkasuGeo, tenkasuMat, dishTenkasuCount);
  for (let i = 0; i < dishTenkasuCount; i++) {
    const t = i / dishTenkasuCount;
    const ang = i * 2.39996 + 0.7;
    const r = Math.sqrt(t) * 0.34;
    const h = 0.07 + (1 - t) * 0.17 + Math.cos(i * 2.7) * 0.02;
    dummy.position.set(Math.cos(ang) * r, h, Math.sin(ang) * r);
    dummy.rotation.set(i * 0.7, i * 1.1, i * 0.5);
    const s = 0.72 + (i % 4) * 0.18;
    dummy.scale.set(s * 1.1, s * 0.85, s);
    dummy.updateMatrix();
    dishTenkasu.setMatrixAt(i, dummy.matrix);
  }
  dishTenkasu.castShadow = true;
  tenkasuDish.add(dishTenkasu);

  return { negiDish, tenkasuDish, negiRingGeo, negiRingMat, tenkasuGeo, tenkasuMat };
}

/**
 * Lacquered Showa Wooden Chopsticks (お箸) on Ceramic Rest + Lifted Glistening Udon Bite Bundle
 */
export function buildChopsticks(udonMaterial, negiRingGeo, negiRingMat) {
  const restGroup = new THREE.Group();
  restGroup.position.set(0.32, 0.03, 1.92);

  // Small cobalt ceramic chopstick rest (箸置き)
  const rest = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.075, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x354b6b, roughness: 0.22, metalness: 0.05 })
  );
  rest.position.y = 0.035;
  rest.castShadow = true;
  rest.receiveShadow = true;
  restGroup.add(rest);

  // Chopsticks pair group (moves with hand when stirring pot or lifting noodles to eat!)
  const sticksGroup = new THREE.Group();
  const woodStickMat = new THREE.MeshStandardMaterial({
    color: 0x3b1f13, // Deep lacquered Showa chestnut wood
    roughness: 0.28,
    metalness: 0.05,
    envMapIntensity: 1.1,
  });

  const makeStick = () => {
    const geo = new THREE.CylinderGeometry(0.017, 0.034, 2.2, 10);
    geo.rotateZ(Math.PI / 2); // Tip points toward -X, butt toward +X
    const m = new THREE.Mesh(geo, woodStickMat);
    m.castShadow = true;
    return m;
  };
  const stickA = makeStick();
  stickA.position.set(0, 0.02, -0.055);
  stickA.rotation.y = 0.035;
  const stickB = makeStick();
  stickB.position.set(0, 0.02, 0.055);
  stickB.rotation.y = -0.035;
  sticksGroup.add(stickA, stickB);

  // Draping glistening lifted udon strands hanging from the chopstick tips during eating!
  const liftedBite = new THREE.Group();
  liftedBite.position.set(-0.98, 0.0, 0.0);
  for (let i = 0; i < 6; i++) {
    const ox = (i - 2.5) * 0.042;
    const oz = Math.sin(i * 1.9) * 0.045;
    const dropLen = 0.72 + (i % 3) * 0.14;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ox, 0.02, oz),
      new THREE.Vector3(ox + Math.sin(i) * 0.07, -dropLen * 0.35, oz + 0.04),
      new THREE.Vector3(ox - Math.cos(i) * 0.06, -dropLen * 0.72, oz - 0.03),
      new THREE.Vector3(ox * 0.7, -dropLen, oz * 0.6),
    ]);
    const strand = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.038, 7, false), udonMaterial);
    strand.castShadow = true;
    liftedBite.add(strand);
  }
  // A couple clinging negi rings on the lifted noodles for mouthwatering realism!
  for (let k = 0; k < 3; k++) {
    const n = new THREE.Mesh(negiRingGeo, negiRingMat);
    n.position.set((k - 1) * 0.07, -0.18 - k * 0.14, 0.045);
    n.rotation.set(0.9, k, 0.5);
    n.scale.setScalar(0.85);
    liftedBite.add(n);
  }
  liftedBite.visible = false;
  sticksGroup.add(liftedBite);

  return { restGroup, sticksGroup, liftedBite };
}

/**
 * Photorealistic Anatomically Sculpted 3D Right Hand with Cozy Showa Winter Ribbed Wool Sweater Cuff.
 * Seamless lofted wrist-to-palm mesh (planar UVs, zero pole rings!), balanced skin tone under tungsten,
 * and slender organically tapered articulated fingers.
 */
export function buildRealisticHand(textures) {
  const root = new THREE.Group();

  // IMPORTANT: color = 0xffffff so skin albedo map is NOT double-multiplied into orange!
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: textures.skin.map,
    bumpMap: textures.skin.bumpMap,
    bumpScale: 0.006,
    roughness: 0.64,
    metalness: 0.0,
    sheen: 0.16,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color(0xd8b4a6),
    clearcoat: 0.04,
    clearcoatRoughness: 0.68,
    envMapIntensity: 0.42,
  });

  const tipSkinMat = skinMat.clone();
  tipSkinMat.color = new THREE.Color(0xf7e8e2); // ultra-subtle natural rosy warmth at fingertips
  tipSkinMat.roughness = 0.58;

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xc2a398,
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.65,
  });

  const knitMat = new THREE.MeshStandardMaterial({
    map: textures.knit.map,
    bumpMap: textures.knit.bumpMap,
    bumpScale: 0.036,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.30,
  });

  // Helper: assign smooth planar top-down UVs matched cleanly to the dorsum anatomy map
  function applyPlanarUVs(geo, scaleX = 1.65, scaleZ = 1.15, offsetZ = 0.38) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(
        i,
        THREE.MathUtils.clamp(pos.getX(i) * scaleX + 0.5, 0.02, 0.98),
        THREE.MathUtils.clamp(pos.getZ(i) * scaleZ + offsetZ, 0.02, 0.98)
      );
    }
    uv.needsUpdate = true;
  }

  // Organic creased wool winter sweater sleeve (long enough for tall portrait screens, soft rounded cuff rim)
  const sleeveGeo = new THREE.CylinderGeometry(0.195, 0.31, 3.6, 28, 20, false);
  const sPos = sleeveGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const vx = sPos.getX(i);
    const vy = sPos.getY(i);
    const vz = sPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const yNorm = (vy + 1.8) / 3.6; // 0 = far forearm (+Z), 1 = cuff edge toward wrist
    // Softly round inward right at the cuff opening so there is never a hard flat tube cut!
    const cuffRound = yNorm > 0.94 ? (1.0 - Math.pow((yNorm - 0.94) / 0.06, 2.0) * 0.24) : 1.0;
    const crease = 1.0 + Math.sin(ang * 5.0 + yNorm * 3.8) * 0.042 + Math.sin(yNorm * 16.0 + ang * 2.0) * 0.022;
    sPos.setXYZ(i, vx * crease * cuffRound * 1.06, vy, vz * crease * cuffRound * 0.72);
  }
  sleeveGeo.computeVertexNormals();
  sleeveGeo.rotateX(Math.PI / 2);
  const sleeve = new THREE.Mesh(sleeveGeo, knitMat);
  sleeve.position.set(0.05, 0.01, 2.34);
  sleeve.castShadow = true;
  sleeve.receiveShadow = true;
  root.add(sleeve);

  // Soft plush ribbed wool cuff band hugging the wrist organically
  const cuffGeo = new THREE.TorusGeometry(0.178, 0.048, 12, 24);
  cuffGeo.scale(1.12, 0.72, 1.45);
  const cuff = new THREE.Mesh(cuffGeo, knitMat);
  cuff.position.set(0.02, 0.015, 0.56);
  cuff.castShadow = true;
  cuff.receiveShadow = true;
  root.add(cuff);

  // SEAMLESS LOFTED WRIST + BACK OF HAND (single continuous sculpted surface, zero hard joint seams!)
  const handGeo = new THREE.BoxGeometry(0.48, 0.16, 0.84, 20, 10, 26);
  const hPos = handGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    // Normalize box coords to [-1, 1]
    const nx = hPos.getX(i) / 0.24;
    const ny = hPos.getY(i) / 0.08;
    const nz = hPos.getZ(i) / 0.42; // -1 = knuckle edge, +1 = wrist inside cuff

    // Round box cross-section into an organic superellipsoid / pillowed anatomical oval
    const r2 = Math.min(1.0, nx * nx * 0.78 + ny * ny * 0.85);
    const roundProfile = Math.sqrt(Math.max(0.02, 1.0 - r2 * 0.45));

    // Smooth anatomical width curve: narrow wrist (nz=+1) -> widens across palm -> subtly tapers at outer knuckle edge
    let halfW;
    if (nz > 0.18) {
      // Wrist region
      const wt = (nz - 0.18) / 0.82;
      halfW = THREE.MathUtils.lerp(0.225, 0.162, Math.pow(wt, 0.72));
    } else {
      // Palm to knuckle bridge (-1 .. 0.18)
      const pt = (0.18 - nz) / 1.18;
      // Slight rounded knuckle arch at very front (pt near 1)
      const knuckleRound = pt > 0.82 ? Math.sqrt(Math.max(0.05, 1.0 - Math.pow((pt - 0.82) / 0.18, 2.0))) : 1.0;
      halfW = (0.225 + Math.sin(pt * Math.PI * 0.85) * 0.042) * (0.35 + 0.65 * knuckleRound);
    }

    // Anatomical thickness (flatter toward knuckles, rounded oval at wrist)
    const thickY = THREE.MathUtils.lerp(0.068, 0.105, (nz + 1) * 0.5);
    let x = nx * halfW;
    let y = ny * thickY * roundProfile;
    let z = nz * 0.42 + 0.14; // spans z = -0.28 (knuckles) to z = +0.56 (inside cuff)

    // Natural slight diagonal slant of the 4 MCP knuckles (index/middle forward, pinky slightly back)
    if (nz < 0) {
      z += Math.max(0, nx) * 0.055 * (-nz);
    }
    // Subtle dorsal arch & delicate extensor tendon contours on top of hand
    if (ny > 0) {
      const arch = Math.cos(nx * Math.PI * 0.45) * 0.018 * (1.0 - Math.max(0, nz));
      const tendons = Math.pow(Math.max(0, Math.cos(nx * Math.PI * 2.1)), 6.0) * 0.005 * (1.0 - Math.abs(nz));
      y += arch + tendons;
    }

    hPos.setXYZ(i, x, y, z);
  }
  handGeo.computeVertexNormals();
  applyPlanarUVs(handGeo, 1.6);
  const handBody = new THREE.Mesh(handGeo, skinMat);
  handBody.position.set(0, 0.015, 0);
  handBody.castShadow = true;
  handBody.receiveShadow = true;
  root.add(handBody);

  // Soft sculpted thumb muscle pad (thenar web) blended seamlessly into left side of palm
  const thumbWebGeo = new THREE.SphereGeometry(0.125, 16, 12);
  thumbWebGeo.scale(0.85, 0.52, 1.35);
  applyPlanarUVs(thumbWebGeo, 1.8);
  const thumbWeb = new THREE.Mesh(thumbWebGeo, skinMat);
  thumbWeb.position.set(-0.185, -0.008, 0.10);
  thumbWeb.rotation.y = 0.36;
  thumbWeb.castShadow = true;
  root.add(thumbWeb);

  // Helper: smooth seamless 3-phalanx articulated finger (overlapping capsules, NO protruding joint balls!)
  function makeFinger(totalLen, baseRad, xOffset, zOffset, yRot = 0, isThumb = false) {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.012, zOffset);
    pivot.rotation.y = yRot;

    const l1 = totalLen * (isThumb ? 0.52 : 0.44);
    const l2 = totalLen * (isThumb ? 0.48 : 0.30);
    const l3 = isThumb ? 0 : totalLen * 0.26;

    // Phalanx 1 (smooth tapered capsule tucked slightly into knuckle arch for zero gap)
    const g1 = new THREE.CapsuleGeometry(baseRad * 0.90, l1 * 0.78, 8, 12);
    g1.scale(1.0, 1.0, 0.84);
    g1.rotateX(Math.PI / 2);
    applyPlanarUVs(g1, 2.2);
    const m1 = new THREE.Mesh(g1, skinMat);
    m1.position.set(0, 0, -l1 * 0.46);
    m1.castShadow = true;
    m1.receiveShadow = true;
    pivot.add(m1);

    // PIP joint
    const j2 = new THREE.Group();
    j2.position.set(0, 0, -l1 * 0.95);
    pivot.add(j2);

    if (isThumb) {
      const g2 = new THREE.CapsuleGeometry(baseRad * 0.78, l2 * 0.68, 8, 12);
      g2.scale(1.0, 1.0, 0.82);
      g2.rotateX(Math.PI / 2);
      applyPlanarUVs(g2, 2.2);
      const m2 = new THREE.Mesh(g2, tipSkinMat);
      m2.position.set(0, 0, -l2 * 0.45);
      m2.castShadow = true;
      j2.add(m2);

      // Flush subtle natural thumbnail
      const nail = new THREE.Mesh(new THREE.SphereGeometry(baseRad * 0.54, 10, 8), nailMat);
      nail.scale.set(0.90, 0.16, 1.22);
      nail.position.set(0, baseRad * 0.56, -l2 * 0.68);
      j2.add(nail);

      return { pivot, j2, j3: null };
    }

    // Phalanx 2 (middle)
    const g2 = new THREE.CapsuleGeometry(baseRad * 0.80, l2 * 0.75, 8, 12);
    g2.scale(1.0, 1.0, 0.82);
    g2.rotateX(Math.PI / 2);
    applyPlanarUVs(g2, 2.2);
    const m2 = new THREE.Mesh(g2, skinMat);
    m2.position.set(0, 0, -l2 * 0.48);
    m2.castShadow = true;
    m2.receiveShadow = true;
    j2.add(m2);

    // DIP joint
    const j3 = new THREE.Group();
    j3.position.set(0, 0, -l2 * 0.95);
    j2.add(j3);

    // Phalanx 3 (distal fingertip)
    const g3 = new THREE.CapsuleGeometry(baseRad * 0.70, l3 * 0.62, 8, 12);
    g3.scale(0.96, 1.0, 0.78);
    g3.rotateX(Math.PI / 2);
    applyPlanarUVs(g3, 2.2);
    const m3 = new THREE.Mesh(g3, tipSkinMat);
    m3.position.set(0, -0.002, -l3 * 0.46);
    m3.castShadow = true;
    j3.add(m3);

    // Flush subtle natural fingernail
    const nail = new THREE.Mesh(new THREE.SphereGeometry(baseRad * 0.50, 10, 8), nailMat);
    nail.scale.set(0.86, 0.15, 1.24);
    nail.position.set(0, baseRad * 0.50, -l3 * 0.56);
    j3.add(nail);

    return { pivot, j2, j3 };
  }

  // Slender, gracefully proportioned human fingers anchored along natural knuckle arch
  const indexFinger = makeFinger(0.49, 0.052, -0.155, -0.23, 0.06);
  const middleFinger = makeFinger(0.55, 0.054, -0.048, -0.25, 0.01);
  const ringFinger = makeFinger(0.50, 0.051, 0.058, -0.23, -0.04);
  const pinkyFinger = makeFinger(0.39, 0.043, 0.158, -0.18, -0.11);
  const thumb = makeFinger(0.37, 0.060, -0.225, 0.04, 0.58, true);

  root.add(indexFinger.pivot, middleFinger.pivot, ringFinger.pivot, pinkyFinger.pivot, thumb.pivot);

  const fingers = { indexFinger, middleFinger, ringFinger, pinkyFinger, thumb };

  function setPose(poseName, curlExtra = 0) {
    let i1 = -0.18, i2 = -0.22, i3 = -0.16;
    let m1 = -0.22, r1 = -0.28, p1 = -0.34, t1 = -0.18;
    if (poseName === 'pinch') {
      i1 = -0.56; i2 = -0.54; i3 = -0.40;
      m1 = -0.46; r1 = -0.72; p1 = -0.84; t1 = -0.54;
    } else if (poseName === 'grip') {
      i1 = -0.84; i2 = -0.88; i3 = -0.68;
      m1 = -0.88; r1 = -0.92; p1 = -0.98; t1 = -0.58;
    } else if (poseName === 'chopsticks') {
      i1 = -0.42; i2 = -0.38; i3 = -0.28;
      m1 = -0.52; r1 = -0.82; p1 = -0.92; t1 = -0.38;
    }
    i1 -= curlExtra; m1 -= curlExtra; r1 -= curlExtra; p1 -= curlExtra;

    indexFinger.pivot.rotation.x = i1;
    indexFinger.j2.rotation.x = i2;
    indexFinger.j3.rotation.x = i3;

    middleFinger.pivot.rotation.x = m1;
    middleFinger.j2.rotation.x = m1 * 0.90;
    middleFinger.j3.rotation.x = m1 * 0.72;

    ringFinger.pivot.rotation.x = r1;
    ringFinger.j2.rotation.x = r1 * 0.90;
    ringFinger.j3.rotation.x = r1 * 0.72;

    pinkyFinger.pivot.rotation.x = p1;
    pinkyFinger.j2.rotation.x = p1 * 0.90;
    pinkyFinger.j3.rotation.x = p1 * 0.72;

    thumb.pivot.rotation.x = t1;
    thumb.j2.rotation.x = t1 * 0.70;
  }

  setPose('open');
  return { root, fingers, setPose };
}
