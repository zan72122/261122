import * as THREE from 'three';
import {
  createWoodCounterTextures,
  createKitchenTileTextures,
  createBrushedMetalTextures,
  createInnerPotTextures,
  createCeramicBowlTextures,
  createLinenTextures,
  createSteamTexture,
  createSkinTexture,
  createContactShadowTexture,
  createRiceBedTextures,
  createSesameBedTexture,
  createSoftSplashPoolTexture,
  createUmeboshiBumpTexture,
} from './textures.js';

/**
 * Smooth, plump, organic Japanese short-grain (Koshihikari) rice grain geometry (~108 tris).
 * Silky rounded teardrop/ovoid silhouette with subtle embryo indent — zero polygon faceting even in macro close-ups!
 */
export function createRiceGrainGeometry() {
  const geo = new THREE.SphereGeometry(1, 9, 7);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Real-world short-grain Koshihikari proportions (~5.8mm x 3.2mm x 2.6mm in decimeter scale)
    const len = 0.058;
    const wid = 0.032;
    const thk = 0.026;

    // Soft rounded ends (never pointy crystals!)
    const endRound = 1.0 - 0.10 * (x * x);
    x *= len;
    y *= thk * endRound;
    z *= wid * endRound;

    // Gentle embryo indent on one side near one tip
    if (x > 0.015 && z > 0.004) {
      const notch = Math.exp(-Math.pow((x - 0.034) / 0.018, 2)) * Math.max(0, z / wid);
      z -= notch * 0.0065;
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Translucent Rice Grain Physical Material with custom subsurface translucency & wet gloss.
 */
export function createRiceMaterial(initialCooked = 0.0) {
  const uniforms = {
    uCooked: { value: initialCooked },
    uWetness: { value: 0.85 },
    uLightDir: { value: new THREE.Vector3(-0.72, 0.58, 0.35).normalize() },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialCooked > 0.5 ? 0xf2eee4 : 0xe4dfd3),
    roughness: initialCooked > 0.5 ? 0.18 : 0.34,
    metalness: 0.0,
    clearcoat: initialCooked > 0.5 ? 0.85 : 0.45,
    clearcoatRoughness: initialCooked > 0.5 ? 0.15 : 0.24,
    sheen: 0.16,
    sheenRoughness: 0.60,
    sheenColor: new THREE.Color(0xfff8ea),
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCooked = uniforms.uCooked;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uLightDir = uniforms.uLightDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vRiceWorldPos;
         varying vec3 vRiceWorldNormal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 riceWp = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           riceWp = instanceMatrix * riceWp;
         #endif
         riceWp = modelMatrix * riceWp;
         vRiceWorldPos = riceWp.xyz;
         vec3 riceN = normal;
         #ifdef USE_INSTANCING
           riceN = mat3(instanceMatrix) * riceN;
         #endif
         vRiceWorldNormal = normalize(mat3(modelMatrix) * riceN);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uCooked;
         uniform float uWetness;
         uniform vec3 uLightDir;
         varying vec3 vRiceWorldPos;
         varying vec3 vRiceWorldNormal;`
      )
      .replace(
        '#include <dithering_fragment>',
        `
         vec3 rN = normalize(vRiceWorldNormal);
         vec3 rV = normalize(cameraPosition - vRiceWorldPos);
         vec3 rL = normalize(uLightDir);

         // Subsurface translucency with preserved micro-shadow contrast between individual grains!
         float ndotl = dot(rN, rL);
         float crevice = smoothstep(-0.6, 0.75, rN.y);
         gl_FragColor.rgb *= mix(0.68, 1.02, crevice);

         float backScatter = pow(clamp(dot(-rV, rL + rN * 0.42), 0.0, 1.0), 2.8);
         float rim = pow(1.0 - clamp(dot(rN, rV), 0.0, 1.0), 2.6);

         // Raw grain = semi-translucent cool crystal-pearl edge; cooked = luminous moist ivory translucency
         vec3 rawSssColor = vec3(0.84, 0.89, 0.94);
         vec3 cookedSssColor = vec3(0.98, 0.96, 0.91);
         vec3 sssTint = mix(rawSssColor, cookedSssColor, uCooked);

         float sssStrength = mix(0.16, 0.21, uCooked);
         gl_FragColor.rgb += sssTint * (backScatter * 0.34 + rim * 0.22) * sssStrength * crevice;

         // Crisp tiny overcast-window wet specular glint on grain crown
         vec3 halfVec = normalize(rL + rV);
         float wetSpec = pow(max(dot(rN, halfVec), 0.0), mix(52.0, 88.0, uCooked));
         gl_FragColor.rgb += vec3(0.96, 0.99, 1.0) * wetSpec * (0.14 + uWetness * 0.22 + uCooked * 0.14);

         #include <dithering_fragment>
        `
      );
  };

  mat.userData.riceUniforms = uniforms;
  return mat;
}

/**
 * Dynamic Water & Swirling Milky Starch ("とぎ汁") Surface Mesh
 */
export function createWaterSurface(starchTexture, radius = 0.945) {
  const geo = new THREE.CircleGeometry(radius, 48, 0, Math.PI * 2);
  // Subdivide concentrically for smooth vertex ripple & vortex depression
  const ringGeo = buildPolarDiscGeometry(radius, 24, 48);
  geo.dispose();

  const uniforms = {
    uTime: { value: 0 },
    uTurbidity: { value: 0.04 },
    uStarchMap: { value: starchTexture },
    uHandPos: { value: new THREE.Vector2(0, 0) },
    uSwirlSpeed: { value: 0 },
    uSwirlAngle: { value: 0 },
    uSplashPos: { value: new THREE.Vector2(0, 0) },
    uSplashAmt: { value: 0 },
    uLevel: { value: 1.0 },
    uLightDir: { value: new THREE.Vector3(-0.72, 0.58, 0.35).normalize() },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform vec2 uHandPos;
      uniform float uSwirlSpeed;
      uniform float uSwirlAngle;
      uniform vec2 uSplashPos;
      uniform float uSplashAmt;
      varying vec2 vUv;
      varying vec2 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vWave;

      float waveHeight(vec2 p) {
        float r = length(p);
        float a = atan(p.y, p.x);

        // Gentle idle micro-shimmer
        float h = sin(p.x * 9.0 + uTime * 1.6) * cos(p.y * 8.5 - uTime * 1.3) * 0.004;

        // Swirl vortex & helical ripples when hand washes rice
        float spiral = sin(a * 3.0 - r * 14.0 + uSwirlAngle * 2.2) * 0.016 * uSwirlSpeed;
        float vortexDip = -exp(-r * r * 3.2) * 0.048 * uSwirlSpeed + smoothstep(0.35, 0.92, r) * 0.028 * uSwirlSpeed;

        // Local bow wake around hand position
        float dh = length(p - uHandPos);
        float wake = sin(dh * 24.0 - uTime * 9.5) * exp(-dh * 3.4) * 0.022 * (0.2 + uSwirlSpeed);

        // Concentric faucet splash ripples
        float ds = length(p - uSplashPos);
        float splash = sin(ds * 32.0 - uTime * 14.0) * exp(-ds * 2.8) * 0.026 * uSplashAmt;

        return h + spiral + vortexDip + wake + splash;
      }

      void main() {
        vUv = uv;
        vec2 p = position.xy; // Circle in XY before rotation to XZ
        vLocalPos = p;
        float h = waveHeight(p);
        float eps = 0.022;
        float hx = waveHeight(p + vec2(eps, 0.0));
        float hy = waveHeight(p + vec2(0.0, eps));

        vec3 displaced = vec3(p.x, p.y, h);
        vec3 nLocal = normalize(vec3(h - hx, h - hy, eps));

        vec4 wp = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * nLocal);
        vWave = h;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTurbidity;
      uniform sampler2D uStarchMap;
      uniform float uSwirlSpeed;
      uniform float uSplashAmt;
      uniform vec3 uLightDir;
      varying vec2 vUv;
      varying vec2 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vWave;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        float r = length(vLocalPos) / 0.945;
        float a = atan(vLocalPos.y, vLocalPos.x);
        vec2 starchUv = vLocalPos / (0.945 * 2.0) + 0.5;
        float plume = texture2D(uStarchMap, starchUv).r;

        // Organic fluid starch streaks swirling inside the liquid ("とぎ汁の揺らぎ")
        float swirlRibbon = 0.5 + 0.5 * sin(a * 3.0 - r * 11.0 + uTime * 1.4 + plume * 5.0);
        float fineCloud = 0.5 + 0.5 * sin(vLocalPos.x * 7.5 + sin(vLocalPos.y * 6.0 - uTime * 0.9));
        float cloudPattern = mix(swirlRibbon, fineCloud, 0.45);

        // Combine overall milkiness with real-time swirling starch plumes
        float milky = clamp(uTurbidity * (0.68 + cloudPattern * 0.24) + plume * 0.58, 0.0, 1.0);

        // Clear cool water tint -> opalescent milky rice-washing water with subtle depth shading near pot walls
        vec3 clearCol = vec3(0.72, 0.81, 0.87);
        vec3 milkyCol = mix(vec3(0.84, 0.87, 0.89), vec3(0.95, 0.96, 0.97), 0.35 + cloudPattern * 0.65);
        vec3 waterBody = mix(clearCol, milkyCol, milky);
        // Subtle darker rim meniscus where water meets dark charcoal pot wall
        waterBody *= mix(1.0, 0.78, smoothstep(0.72, 1.0, r));

        // Soft north-window sky reflection via Fresnel
        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = 0.06 + 0.94 * pow(1.0 - ndotv, 3.6);

        vec3 R = reflect(-V, N);
        // Overcast north window reflection on the left (-X, +Y) with subtle sash bar contrast
        float windowMask = smoothstep(-0.18, 0.68, -R.x) * smoothstep(-0.08, 0.62, R.y);
        float sashBar = 1.0 - 0.35 * exp(-pow((R.z - 0.12) * 14.0, 2.0));
        vec3 skyRefl = mix(vec3(0.46, 0.52, 0.58), vec3(1.18, 1.24, 1.32) * sashBar, windowMask);

        // Crisp overcast specular glint on ripple crests
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 120.0) * 1.15;
        float broadSpec = pow(max(dot(N, H), 0.0), 22.0) * 0.24;

        // Subtle white micro-foam at swirl crests and faucet splash impact
        float foam = smoothstep(0.010, 0.028, vWave) * (uSwirlSpeed * 0.62 + uSplashAmt * 0.80);
        foam += smoothstep(0.86, 0.99, r) * (0.12 + milky * 0.18);
        foam = clamp(foam, 0.0, 0.78);

        // Soft diffuse shading on milky starch suspension
        float diff = clamp(dot(N, L) * 0.45 + 0.64, 0.45, 1.04);
        vec3 col = waterBody * diff;
        col = mix(col, skyRefl, fresnel * (0.76 - milky * 0.28));
        col += vec3(0.96, 0.985, 1.0) * (spec + broadSpec);
        col = mix(col, vec3(0.97, 0.985, 1.0), foam * 0.58);

        // Clear water stays crystal-transparent so every translucent rice grain gleams below;
        // milky togi-jiru turns lush opalescent white while retaining fluid translucency at edges!
        float baseAlpha = mix(0.14, 0.78, pow(milky, 0.85));
        float alpha = clamp(baseAlpha + fresnel * 0.34 + foam * 0.28 + spec * 0.45, 0.12, 0.91);

        // Soft edge meniscus blend at pot wall
        alpha *= smoothstep(1.01, 0.95, r);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(ringGeo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 3;
  return { mesh, uniforms };
}

function buildPolarDiscGeometry(radius, rings, segments) {
  const positions = [];
  const uvs = [];
  const indices = [];

  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= rings; r++) {
    const frac = r / rings;
    const rad = radius * frac;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      positions.push(x, y, 0);
      uvs.push(0.5 + (x / radius) * 0.5, 0.5 + (y / radius) * 0.5);
    }
  }

  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    indices.push(0, 1 + s, 1 + next);
  }
  for (let r = 1; r < rings; r++) {
    const rowStart = 1 + (r - 1) * segments;
    const nextRow = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const next = (s + 1) % segments;
      const a = rowStart + s;
      const b = rowStart + next;
      const c = nextRow + s;
      const d = nextRow + next;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Kitchen Environment: Pale Oak Countertop, Recessed Brushed Stainless Sink,
 * Glazed Japanese Subway Tile Backsplash, Architectural North-Facing Overcast Window.
 */
export function createKitchenEnvironment() {
  const group = new THREE.Group();
  const oakTex = createWoodCounterTextures(101, 'oak');
  oakTex.map.repeat.set(3.2, 2.0);
  oakTex.bumpMap.repeat.set(3.2, 2.0);
  oakTex.roughnessMap.repeat.set(3.2, 2.0);

  const counterMat = new THREE.MeshStandardMaterial({
    map: oakTex.map,
    bumpMap: oakTex.bumpMap,
    bumpScale: 0.012,
    roughnessMap: oakTex.roughnessMap,
    roughness: 0.62,
    metalness: 0.02,
  });

  const steelTex = createBrushedMetalTextures(505);
  const sinkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb6bec6),
    metalness: 0.86,
    roughness: 0.26,
    bumpMap: steelTex.bumpMap,
    bumpScale: 0.006,
    roughnessMap: steelTex.roughnessMap,
    side: THREE.DoubleSide,
  });

  // Countertop pieces surrounding the recessed stainless sink at x in [-5.3, -2.5], z in [-1.5, 1.25]
  const addCounterSlab = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), counterMat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Main right-to-center counter (starts cleanly outside right sink rim at x = -2.42)
  addCounterSlab(11.6, 0.42, 6.2, 3.38, -0.21, 0.35);
  // Left strip cleanly outside left sink rim at x = -5.38
  addCounterSlab(2.4, 0.42, 6.2, -6.58, -0.21, 0.35);
  // Back strip cleanly behind sink back wall (z = -1.52)
  addCounterSlab(3.0, 0.42, 1.24, -3.9, -0.21, -2.14);
  // Front strip cleanly in front of sink front wall (z = +1.24)
  addCounterSlab(3.0, 0.42, 2.20, -3.9, -0.21, 2.34);

  // Recessed stainless steel sink basin
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(-3.9, 0.0, -0.14);

  // Outer stainless steel top lip (non-overlapping mitered rectangles)
  const rimThick = 0.095;
  const sinkW = 2.8;
  const sinkD = 2.68;
  const sinkDepth = 1.15;

  const rimPieces = [
    [sinkW + rimThick * 2, 0.024, rimThick, 0, 0.012, -sinkD / 2 - rimThick / 2],
    [sinkW + rimThick * 2, 0.024, rimThick, 0, 0.012, sinkD / 2 + rimThick / 2],
    [rimThick, 0.024, sinkD, -sinkW / 2 - rimThick / 2, 0.012, 0],
    [rimThick, 0.024, sinkD, sinkW / 2 + rimThick / 2, 0.012, 0],
  ];
  rimPieces.forEach(([w, h, d, x, y, z]) => {
    const rm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sinkMat);
    rm.position.set(x, y, z);
    rm.receiveShadow = true;
    sinkGroup.add(rm);
  });

  // Sink basin walls & floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(sinkW, sinkD), sinkMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -sinkDepth;
  floor.receiveShadow = true;
  sinkGroup.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(sinkW, sinkDepth), sinkMat);
  backWall.position.set(0, -sinkDepth / 2, -sinkD / 2);
  backWall.receiveShadow = true;
  sinkGroup.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(sinkW, sinkDepth), sinkMat);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, -sinkDepth / 2, sinkD / 2);
  sinkGroup.add(frontWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(sinkD, sinkDepth), sinkMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-sinkW / 2, -sinkDepth / 2, 0);
  leftWall.receiveShadow = true;
  sinkGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(sinkD, sinkDepth), sinkMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(sinkW / 2, -sinkDepth / 2, 0);
  rightWall.receiveShadow = true;
  sinkGroup.add(rightWall);

  // Stainless steel circular drain strainer basket
  const drainRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.34, 32),
    new THREE.MeshStandardMaterial({ color: 0xa6adb4, metalness: 0.9, roughness: 0.25 })
  );
  drainRing.rotation.x = -Math.PI / 2;
  drainRing.position.set(-0.22, -sinkDepth + 0.008, -0.25);
  sinkGroup.add(drainRing);

  const drainHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 24),
    new THREE.MeshStandardMaterial({ color: 0x262a2e, roughness: 0.75, metalness: 0.3 })
  );
  drainHole.rotation.x = -Math.PI / 2;
  drainHole.position.set(-0.22, -sinkDepth + 0.006, -0.25);
  sinkGroup.add(drainHole);

  // Organic feathered milky-water splash pool in sink bottom when draining
  const sinkPoolMat = new THREE.MeshPhysicalMaterial({
    map: createSoftSplashPoolTexture(),
    color: new THREE.Color(0xf0f4f7),
    roughness: 0.14,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    clearcoat: 0.9,
  });
  const sinkPool = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.15), sinkPoolMat);
  sinkPool.rotation.x = -Math.PI / 2;
  sinkPool.position.set(0.24, -sinkDepth + 0.02, 0.12);
  sinkGroup.add(sinkPool);

  group.add(sinkGroup);

  // White Glazed Japanese Ceramic Tile Backsplash Wall
  const tileTex = createKitchenTileTextures();
  const tileMat = new THREE.MeshStandardMaterial({
    map: tileTex.map,
    bumpMap: tileTex.bumpMap,
    bumpScale: 0.018,
    roughnessMap: tileTex.roughnessMap,
    roughness: 0.32,
    metalness: 0.04,
  });

  const backsplash = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 6.2), tileMat);
  backsplash.position.set(0.8, 2.85, -2.72);
  backsplash.receiveShadow = true;
  group.add(backsplash);

  // Subtle silicone caulk trim & oak rail along backsplash base
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(18.5, 0.09, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.45 })
  );
  trim.position.set(0.8, 0.045, -2.68);
  group.add(trim);

  // Natural pale wood upper shelf far in background for architectural depth
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.16, 0.72), counterMat);
  shelf.position.set(2.8, 3.15, -2.38);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  group.add(shelf);

  // Architectural Overcast North Window on Left Wall (visible light source!)
  const winGroup = new THREE.Group();
  winGroup.position.set(-6.9, 2.35, -0.4);
  winGroup.rotation.y = Math.PI / 2;

  const sideWall = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.85 })
  );
  sideWall.position.set(0, 0, -0.05);
  winGroup.add(sideWall);

  // Luminous overcast sky pane
  const skyPane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.42, 1.48, 1.56) })
  );
  skyPane.position.set(0, 0.35, 0.02);
  winGroup.add(skyPane);

  // Thin white-painted wood window sash
  const sashMat = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.55 });
  const sashPieces = [
    [5.0, 0.16, 0.14, 0, 2.25, 0.04],
    [5.0, 0.16, 0.14, 0, -1.55, 0.04],
    [0.16, 3.9, 0.14, -2.42, 0.35, 0.04],
    [0.16, 3.9, 0.14, 2.42, 0.35, 0.04],
    [0.08, 3.8, 0.08, 0, 0.35, 0.05],
  ];
  sashPieces.forEach(([w, h, d, x, y, z]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sashMat);
    p.position.set(x, y, z);
    winGroup.add(p);
  });
  group.add(winGroup);

  return { group, sinkPool, sinkPoolMat };
}

/**
 * Brushed Chrome Japanese Gooseneck Faucet ("蛇口") with animated lever & clear water stream.
 */
export function createFaucet() {
  const group = new THREE.Group();
  const metalTex = createBrushedMetalTextures(611);
  const chromeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xe6ebf0),
    metalness: 0.94,
    roughness: 0.15,
    bumpMap: metalTex.bumpMap,
    bumpScale: 0.002,
  });

  // Base flange
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.14, 28), chromeMat);
  base.position.y = 0.07;
  base.castShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.62, 28), chromeMat);
  stem.position.y = 0.42;
  stem.castShadow = true;
  group.add(stem);

  // Articulated spout pivot (swivels gracefully over pot or sink)
  const spoutPivot = new THREE.Group();
  spoutPivot.position.y = 0.66;
  group.add(spoutPivot);

  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.95, 0.08),
    new THREE.Vector3(0, 1.62, 0.68),
    new THREE.Vector3(0, 1.56, 1.38),
    new THREE.Vector3(0, 1.18, 1.62),
  ]);
  const spoutGeo = new THREE.TubeGeometry(spoutCurve, 32, 0.068, 18, false);
  const spoutMesh = new THREE.Mesh(spoutGeo, chromeMat);
  spoutMesh.castShadow = true;
  spoutPivot.add(spoutMesh);

  // Aerator nozzle collar
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.075, 0.14, 24), chromeMat);
  nozzle.position.set(0, 1.14, 1.63);
  nozzle.rotation.x = 0.12;
  spoutPivot.add(nozzle);

  // Single-lever handle (right side of faucet body)
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.13, 0.44, 0.0);
  group.add(leverPivot);

  const leverHub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 20), chromeMat);
  leverHub.rotation.z = Math.PI / 2;
  leverPivot.add(leverHub);

  const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.42), chromeMat);
  leverArm.position.set(0.06, 0.0, 0.18);
  leverArm.castShadow = true;
  leverPivot.add(leverArm);

  // Glistening running water stream from aerator nozzle
  const streamUniforms = {
    uTime: { value: 0 },
    uFlow: { value: 0 },
  };
  const streamGeo = new THREE.CylinderGeometry(0.044, 0.068, 1.62, 18, 18, true);
  streamGeo.translate(0, -0.81, 0);
  const streamMat = new THREE.ShaderMaterial({
    uniforms: streamUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform float uFlow;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 p = position;
        float ripple = sin(p.y * 22.0 + uTime * 26.0) * 0.008 * uFlow;
        float wobble = cos(p.y * 14.0 - uTime * 19.0) * 0.005 * uFlow;
        p.x += normal.x * (ripple + wobble);
        p.z += normal.z * (ripple - wobble);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlow;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
        float streak = 0.55 + 0.45 * sin(vUv.y * 44.0 + uTime * 34.0 + vUv.x * 12.56);
        vec3 col = mix(vec3(0.84, 0.90, 0.95), vec3(1.15, 1.2, 1.25), fres * 0.8 + streak * 0.25);
        float alpha = uFlow * clamp(0.28 + fres * 0.58 + streak * 0.14, 0.0, 0.88);
        alpha *= smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const waterStream = new THREE.Mesh(streamGeo, streamMat);
  waterStream.position.set(0, 1.08, 1.63);
  waterStream.visible = false;
  spoutPivot.add(waterStream);

  // Invisible generous hit mesh for easy 5-year-old tap on faucet
  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.85, 1.95),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.set(0.08, 1.0, 0.78);
  hitMesh.userData.interactId = 'faucet';
  group.add(hitMesh);

  return { group, spoutPivot, leverPivot, waterStream, streamUniforms };
}

/**
 * Heavy Japanese IH Rice Cooker Inner Pot ("内釜")
 * Thick dark fluoropolymer-coated interior with concentric turning grooves,
 * warm metallic bronze-graphite exterior, rolled rim, and pouring fluid stream.
 */
export function createInnerPot() {
  const group = new THREE.Group();
  const potTex = createInnerPotTextures();

  // Inner surface profile (LatheGeometry, y=0 at outer bottom, rim at y=1.12, inner radius ~0.95)
  const innerPts = [
    new THREE.Vector2(0.001, 0.09),
    new THREE.Vector2(0.45, 0.10),
    new THREE.Vector2(0.68, 0.17),
    new THREE.Vector2(0.84, 0.34),
    new THREE.Vector2(0.925, 0.62),
    new THREE.Vector2(0.955, 0.96),
    new THREE.Vector2(0.962, 1.08),
    new THREE.Vector2(1.005, 1.12),
    new THREE.Vector2(1.058, 1.115),
  ];
  const innerGeo = new THREE.LatheGeometry(innerPts, 56);
  const innerMat = new THREE.MeshStandardMaterial({
    map: potTex.map,
    bumpMap: potTex.bumpMap,
    bumpScale: 0.008,
    roughnessMap: potTex.roughnessMap,
    roughness: 0.36,
    metalness: 0.42,
    side: THREE.DoubleSide,
  });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.castShadow = true;
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  // Outer warm brushed dark bronze-copper IH thermal coating (bottom-to-top for outward normals!)
  const outerPts = [
    new THREE.Vector2(0.001, 0.01),
    new THREE.Vector2(0.50, 0.02),
    new THREE.Vector2(0.74, 0.11),
    new THREE.Vector2(0.915, 0.30),
    new THREE.Vector2(0.995, 0.62),
    new THREE.Vector2(1.015, 0.98),
    new THREE.Vector2(1.062, 1.06),
    new THREE.Vector2(1.058, 1.115),
  ];
  const outerGeo = new THREE.LatheGeometry(outerPts, 56);
  const metalTex = createBrushedMetalTextures(777);
  const outerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x4b3f36),
    metalness: 0.80,
    roughness: 0.28,
    bumpMap: metalTex.bumpMap,
    bumpScale: 0.004,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  group.add(outerMesh);

  // Subtle soft contact shadow underneath pot
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.35), shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.006;
  group.add(contactShadow);

  // Gravity-aligned world-space milky "とぎ汁" pouring stream (attached to scene, tracks tilted rim!)
  const pourCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(-0.24, -0.14, 0.0),
    new THREE.Vector3(-0.38, -0.58, 0.0),
    new THREE.Vector3(-0.44, -1.25, 0.0),
    new THREE.Vector3(-0.47, -1.92, 0.0),
  ]);
  const pourGeo = new THREE.TubeGeometry(pourCurve, 28, 0.092, 16, false);
  const pourUniforms = {
    uTime: { value: 0 },
    uFlow: { value: 0 },
    uTurbidity: { value: 0.85 },
  };
  const pourMat = new THREE.ShaderMaterial({
    uniforms: pourUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vec3 p = position;
        float taper = mix(1.22, 0.58, uv.x);
        float pulse = 1.0 + sin(uv.x * 20.0 - uTime * 24.0) * 0.09;
        p += normal * (taper * pulse - 1.0) * 0.055;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlow;
      uniform float uTurbidity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
        float flowLines = 0.58 + 0.42 * sin(vUv.x * 42.0 - uTime * 30.0 + vUv.y * 12.56);
        vec3 col = mix(vec3(0.80, 0.87, 0.92), vec3(0.95, 0.96, 0.97), uTurbidity);
        col += vec3(0.24, 0.27, 0.30) * (fres * 0.85 + flowLines * 0.32);
        float alpha = uFlow * mix(0.42, 0.90, uTurbidity) * smoothstep(0.0, 0.06, vUv.x);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const pourStream = new THREE.Mesh(pourGeo, pourMat);
  pourStream.visible = false;

  // Generous hit cylinder for dragging/washing pot
  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.1, 1.25, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.62;
  hitMesh.userData.interactId = 'pot';
  group.add(hitMesh);

  return { group, contactShadow, pourStream, pourUniforms };
}

/**
 * Modern Minimalist Japanese IH Rice Cooker ("炊飯器")
 * Ceramic matte off-white sculpted body, brushed dark titanium top ring,
 * gleaming stainless steam vent, recessed IH heating well, and ZERO text/numbers —
 * only tactile concave start button with glowing LED ring + status LED dot.
 */
export function createRiceCooker() {
  const group = new THREE.Group();
  const metalTex = createBrushedMetalTextures(808);

  const ceramicWhiteMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xefede8),
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.38,
    clearcoatRoughness: 0.26,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x282b30),
    roughness: 0.32,
    metalness: 0.45,
  });

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd2d7dc),
    metalness: 0.88,
    roughness: 0.24,
    bumpMap: metalTex.bumpMap,
    bumpScale: 0.003,
  });

  // Sculpted outer rounded cylindrical-ovoid body (bottom-to-top for outward normals!)
  const bodyPts = [
    new THREE.Vector2(0.01, 0.02),
    new THREE.Vector2(1.12, 0.02),
    new THREE.Vector2(1.24, 0.08),
    new THREE.Vector2(1.38, 0.38),
    new THREE.Vector2(1.42, 0.96),
    new THREE.Vector2(1.36, 1.26),
    new THREE.Vector2(1.22, 1.32),
    new THREE.Vector2(1.06, 1.28),
  ];
  const bodyGeo = new THREE.LatheGeometry(bodyPts, 52);
  // Subtle Japanese IH squircle elongation along Z
  bodyGeo.scale(1.02, 1.0, 1.12);
  const bodyMesh = new THREE.Mesh(bodyGeo, ceramicWhiteMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Inner dark recessed heating chamber
  const chamberGeo = new THREE.CylinderGeometry(1.055, 0.98, 1.08, 44, 1, true);
  const chamberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x222529),
    metalness: 0.55,
    roughness: 0.48,
    side: THREE.BackSide,
  });
  const chamberMesh = new THREE.Mesh(chamberGeo, chamberMat);
  chamberMesh.position.y = 0.74;
  group.add(chamberMesh);

  // Inner heating plate floor + copper thermal sensor dome
  const heaterFloor = new THREE.Mesh(
    new THREE.CircleGeometry(0.98, 36),
    new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.72, roughness: 0.35 })
  );
  heaterFloor.rotation.x = -Math.PI / 2;
  heaterFloor.position.y = 0.21;
  group.add(heaterFloor);

  const sensorButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.21, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0xb68a64, metalness: 0.82, roughness: 0.28 })
  );
  sensorButton.position.y = 0.24;
  group.add(sensorButton);

  // Brushed stainless steel top rim collar around pot well
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.10, 0.065, 16, 48), stainlessMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.30;
  group.add(collar);

  // Sleek curved flush dark smoked-glass front fascia (hugs the cooker's rounded contour seamlessly!)
  const fasciaGeo = new THREE.CylinderGeometry(1.445, 1.445, 0.34, 32, 1, true, -0.44, 0.88);
  fasciaGeo.scale(1.02, 1.0, 1.12);
  const fasciaMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x181b20),
    roughness: 0.08,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  });
  const glassPlate = new THREE.Mesh(fasciaGeo, fasciaMat);
  glassPlate.position.set(0, 1.02, 0.0);
  group.add(glassPlate);

  // Tactile concave circular Start Button + glowing LED ring mounted cleanly on curved front fascia (ZERO text/digits)
  const startBtnGroup = new THREE.Group();
  startBtnGroup.position.set(0, 1.02, 1.622);
  group.add(startBtnGroup);

  const startBtnCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.132, 0.032, 28),
    new THREE.MeshStandardMaterial({ color: 0x262a31, roughness: 0.32, metalness: 0.35 })
  );
  startBtnCap.rotation.x = Math.PI / 2;
  startBtnGroup.add(startBtnCap);

  const startRingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x4b4f56),
    emissive: new THREE.Color(0xff9a3c),
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const startRing = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.015, 12, 32), startRingMat);
  startRing.position.z = 0.014;
  startBtnGroup.add(startRing);

  // 3 tiny minimalist progress LED dots beside start button (zero numbers!)
  const ledDots = [];
  for (let i = 0; i < 3; i++) {
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x333840,
      emissive: new THREE.Color(0xffa94d),
      emissiveIntensity: 0.0,
      roughness: 0.2,
    });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.023, 16), ledMat);
    dot.position.set(-0.33 + i * 0.082, 0.0, 0.016);
    startBtnGroup.add(dot);
    ledDots.push(ledMat);
  }

  // Front brushed-chrome contoured lid release latch button
  const latchMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd2d7dd),
    metalness: 0.86,
    roughness: 0.20,
    emissive: new THREE.Color(0xffe2b8),
    emissiveIntensity: 0.0,
  });
  const latchBtn = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.30, 8, 14), latchMat);
  latchBtn.rotation.z = Math.PI / 2;
  latchBtn.position.set(0, 1.245, 1.54);
  group.add(latchBtn);

  // Hinged Insulated Lid Pivot at back rim
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.32, -1.32);
  group.add(lidPivot);

  const lidBodyPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(1.04, 0.0),
    new THREE.Vector2(1.38, 0.02),
    new THREE.Vector2(1.36, 0.18),
    new THREE.Vector2(1.18, 0.34),
    new THREE.Vector2(0.75, 0.41),
    new THREE.Vector2(0.01, 0.42),
  ];
  const lidGeo = new THREE.LatheGeometry(lidBodyPts, 48);
  lidGeo.scale(1.02, 1.0, 1.12);
  const lidMesh = new THREE.Mesh(lidGeo, ceramicWhiteMat);
  lidMesh.position.set(0, 0, 1.32);
  lidMesh.castShadow = true;
  lidMesh.receiveShadow = true;
  lidPivot.add(lidMesh);

  // Inner aluminum condensation plate on underside of lid (visible when lid opens!)
  const innerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.96, 0.04, 36), stainlessMat);
  innerPlate.position.set(0, -0.01, 1.32);
  lidPivot.add(innerPlate);

  // Silicone gasket ring around underside of lid
  const gasket = new THREE.Mesh(
    new THREE.TorusGeometry(0.99, 0.032, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.65 })
  );
  gasket.rotation.x = Math.PI / 2;
  gasket.position.set(0, -0.025, 1.32);
  lidPivot.add(gasket);

  // Gleaming stainless steam vent cap on top of lid
  const ventBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.09, 32), stainlessMat);
  ventBase.position.set(0, 0.43, 0.85);
  lidPivot.add(ventBase);

  const ventSlot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.05, 20),
    new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7 })
  );
  ventSlot.position.set(0, 0.46, 0.85);
  lidPivot.add(ventSlot);

  // Subtle contact shadow underneath rice cooker
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.45, 3.65),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.008;
  group.add(contactShadow);

  // Hit areas (generous for 5-year-old touch)
  const bodyHit = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.48, 1.55, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bodyHit.position.set(0, 0.78, 0.08);
  bodyHit.userData.interactId = 'cooker_body';
  group.add(bodyHit);

  const lidHit = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 0.55, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  lidHit.position.set(0, 0.22, 1.32);
  lidHit.userData.interactId = 'cooker_lid';
  lidPivot.add(lidHit);

  const startBtnHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.58, 0.55),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  startBtnHit.position.set(0, 1.08, 1.65);
  startBtnHit.userData.interactId = 'cooker_start';
  group.add(startBtnHit);

  return {
    group,
    lidPivot,
    startRingMat,
    ledDots,
    latchMat,
    startBtnGroup,
    ventWorldOffset: new THREE.Vector3(0, 1.82, -0.45),
  };
}

/**
 * Artisanal Hand-Thrown Ceramic Rice Bowl ("茶碗") + Serving Tray ("お盆") + Toppings + Fresh-Rice Masu Cup
 */
export function createServingSet() {
  const group = new THREE.Group();

  // Dark walnut wooden tray ("お盆")
  const trayTex = createWoodCounterTextures(222, 'tray');
  const trayMat = new THREE.MeshStandardMaterial({
    map: trayTex.map,
    bumpMap: trayTex.bumpMap,
    bumpScale: 0.01,
    roughness: 0.54,
    metalness: 0.02,
  });

  const trayGroup = new THREE.Group();
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.08, 2.58), trayMat);
  trayBase.position.y = 0.04;
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  trayGroup.add(trayBase);

  // Raised beveled tray walls
  const tw = 3.45, td = 2.58, th = 0.16, thick = 0.09;
  [
    [tw, th, thick, 0, 0.10, -td / 2 + thick / 2],
    [tw, th, thick, 0, 0.10, td / 2 - thick / 2],
    [thick, th, td - thick * 2, -tw / 2 + thick / 2, 0.10, 0],
    [thick, th, td - thick * 2, tw / 2 - thick / 2, 0.10, 0],
  ].forEach(([w, h, d, x, y, z]) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trayMat);
    edge.position.set(x, y, z);
    edge.castShadow = true;
    edge.receiveShadow = true;
    trayGroup.add(edge);
  });

  // Woven flax linen mat inside tray
  const linenTex = createLinenTextures();
  const linenMat = new THREE.MeshStandardMaterial({
    map: linenTex.map,
    bumpMap: linenTex.bumpMap,
    bumpScale: 0.015,
    roughness: 0.92,
  });
  const linen = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.018, 2.28), linenMat);
  linen.position.y = 0.088;
  linen.receiveShadow = true;
  trayGroup.add(linen);

  // Tray contact shadow
  const trayShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.95, 3.05),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  trayShadow.rotation.x = -Math.PI / 2;
  trayShadow.position.y = 0.004;
  trayGroup.add(trayShadow);
  group.add(trayGroup);

  // Artisanal Hand-Thrown Ceramic Rice Bowl ("茶碗")
  const bowlGroup = new THREE.Group();
  bowlGroup.position.set(-0.46, 0.098, 0.04);

  const bowlTex = createCeramicBowlTextures();
  const bowlMat = new THREE.MeshPhysicalMaterial({
    map: bowlTex.map,
    bumpMap: bowlTex.bumpMap,
    bumpScale: 0.012,
    roughnessMap: bowlTex.roughnessMap,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
  });

  // Classic Japanese chawan profile with high foot ring ("高台")
  const bowlPts = [
    new THREE.Vector2(0.001, 0.12),
    new THREE.Vector2(0.32, 0.12),
    new THREE.Vector2(0.34, 0.00),
    new THREE.Vector2(0.39, 0.00),
    new THREE.Vector2(0.41, 0.14),
    new THREE.Vector2(0.56, 0.25),
    new THREE.Vector2(0.71, 0.44),
    new THREE.Vector2(0.79, 0.66),
    new THREE.Vector2(0.81, 0.78),
    new THREE.Vector2(0.765, 0.79),
    new THREE.Vector2(0.725, 0.65),
    new THREE.Vector2(0.62, 0.42),
    new THREE.Vector2(0.42, 0.23),
    new THREE.Vector2(0.001, 0.18),
  ];
  const bowlGeo = new THREE.LatheGeometry(bowlPts, 52);
  const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  bowlGroup.add(bowlMesh);

  // Soft contact shadow under ceramic bowl
  const bowlShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 1.42),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    })
  );
  bowlShadow.rotation.x = -Math.PI / 2;
  bowlShadow.position.y = 0.005;
  bowlGroup.add(bowlShadow);

  const bowlHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.75, 1.05, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bowlHit.position.y = 0.52;
  bowlHit.userData.interactId = 'bowl';
  bowlGroup.add(bowlHit);

  group.add(bowlGroup);

  // Small ceramic condiment dishes on right side of tray
  const makeSmallDish = (x, z, color, rimColor) => {
    const dGroup = new THREE.Group();
    dGroup.position.set(x, 0.098, z);
    const pts = [
      new THREE.Vector2(0.001, 0.02),
      new THREE.Vector2(0.22, 0.02),
      new THREE.Vector2(0.32, 0.09),
      new THREE.Vector2(0.35, 0.16),
      new THREE.Vector2(0.31, 0.16),
      new THREE.Vector2(0.22, 0.07),
      new THREE.Vector2(0.001, 0.055),
    ];
    const dMesh = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 32),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        roughness: 0.24,
        clearcoat: 0.72,
      })
    );
    dMesh.castShadow = true;
    dMesh.receiveShadow = true;
    dGroup.add(dMesh);

    if (rimColor) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.33, 0.015, 10, 32),
        new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.35 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.155;
      dGroup.add(rim);
    }
    group.add(dGroup);
    return dGroup;
  };

  // 1. Umeboshi ("梅干し") dish (front right)
  const umeDish = makeSmallDish(0.92, 0.62, 0xf2eee6, 0x8b6f5c);
  const umeGeo = new THREE.SphereGeometry(0.155, 20, 16);
  // Natural organic dimpled/wrinkled umeboshi silhouette
  const upos = umeGeo.attributes.position;
  for (let i = 0; i < upos.count; i++) {
    const x = upos.getX(i), y = upos.getY(i), z = upos.getZ(i);
    const wrinkle = 1.0 + Math.sin(x * 36 + y * 24) * 0.06 + Math.cos(z * 32 - y * 28) * 0.05;
    upos.setXYZ(i, x * wrinkle * 1.08, y * wrinkle * 0.84, z * wrinkle * 1.02);
  }
  umeGeo.computeVertexNormals();
  const umeBump = createUmeboshiBumpTexture();
  const umeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x8e1920),
    bumpMap: umeBump,
    bumpScale: 0.028,
    roughness: 0.34,
    clearcoat: 0.72,
    clearcoatRoughness: 0.28,
    sheen: 0.28,
    sheenColor: new THREE.Color(0xd24a4a),
  });
  const umeboshiInDish = new THREE.Mesh(umeGeo, umeMat);
  umeboshiInDish.position.set(0, 0.16, 0);
  umeboshiInDish.castShadow = true;
  umeDish.add(umeboshiInDish);

  const umeHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.45, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  umeHit.position.y = 0.2;
  umeHit.userData.interactId = 'topping_umeboshi';
  umeDish.add(umeHit);

  // 2. Black Sesame ("ごま塩") dish (mid right) — authentic granular sesame & sea-salt texture!
  const sesameDish = makeSmallDish(1.06, -0.06, 0xe8e4dc, 0x3b485c);
  const sesameTex = createSesameBedTexture();
  const sesameMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.50),
    new THREE.MeshStandardMaterial({ map: sesameTex, roughness: 0.62, metalness: 0.04 })
  );
  sesameMound.scale.set(1, 0.42, 1);
  sesameMound.position.y = 0.055;
  sesameDish.add(sesameMound);

  // Tiny white sea-salt & sesame 3D grains on top of mound
  const saltGeo = new THREE.OctahedronGeometry(0.014, 0);
  const saltMat = new THREE.MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.2 });
  const seedGeoDish = new THREE.SphereGeometry(0.015, 6, 4);
  seedGeoDish.scale(1.5, 0.6, 0.9);
  const seedMatDish = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.45 });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + i * 1.1;
    const r = 0.02 + Math.sqrt((i + 0.5) / 28) * 0.17;
    const isSalt = i % 3 === 0;
    const s = new THREE.Mesh(isSalt ? saltGeo : seedGeoDish, isSalt ? saltMat : seedMatDish);
    s.position.set(Math.cos(a) * r, 0.145 - r * 0.28, Math.sin(a) * r);
    s.rotation.set(Math.random() * 2, Math.random() * 6, 0);
    sesameDish.add(s);
  }
  const sesameHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.45, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  sesameHit.position.y = 0.2;
  sesameHit.userData.interactId = 'topping_sesame';
  sesameDish.add(sesameHit);

  // 3. Crispy Shredded Nori ("刻み海苔") dish (back right)
  const noriDish = makeSmallDish(0.84, -0.72, 0xd8dfd8, 0x455849);
  const noriMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x132217),
    roughness: 0.44,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 14; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.008, 0.036), noriMat);
    strip.position.set(
      ((i % 5) - 2) * 0.04,
      0.08 + Math.floor(i / 5) * 0.016,
      (Math.sin(i * 2.1)) * 0.08
    );
    strip.rotation.set(0.08 * Math.sin(i), i * 0.62, 0.06 * Math.cos(i));
    noriDish.add(strip);
  }
  const noriHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.45, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  noriHit.position.y = 0.2;
  noriHit.userData.interactId = 'topping_nori';
  noriDish.add(noriHit);

  // 4. Diegetic Hinoki Wooden 1-Go Measuring Cup ("一合枡") filled with raw dry rice
  // Sits quietly front-left of tray — tapping it at finale pours fresh raw rice to start a new batch!
  const masuGroup = new THREE.Group();
  masuGroup.position.set(-1.12, 0.098, 0.72);
  masuGroup.rotation.y = 0.22;
  const shamojiWood = createWoodCounterTextures(333, 'shamoji');
  const masuMat = new THREE.MeshStandardMaterial({
    map: shamojiWood.map,
    bumpMap: shamojiWood.bumpMap,
    bumpScale: 0.008,
    roughness: 0.62,
  });
  const mw = 0.50, mh = 0.34, mt = 0.055;
  const masuFloor = new THREE.Mesh(new THREE.BoxGeometry(mw, 0.05, mw), masuMat);
  masuFloor.position.y = 0.025;
  masuGroup.add(masuFloor);
  [
    [mw, mh, mt, 0, mh / 2, -mw / 2 + mt / 2],
    [mw, mh, mt, 0, mh / 2, mw / 2 - mt / 2],
    [mt, mh, mw - mt * 2, -mw / 2 + mt / 2, mh / 2, 0],
    [mt, mh, mw - mt * 2, mw / 2 - mt / 2, mh / 2, 0],
  ].forEach(([w, h, d, x, y, z]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), masuMat);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    masuGroup.add(wall);
  });

  // Mound of textured raw dry pearl rice inside the wooden masu
  const masuRiceTex = createRiceBedTextures(3131);
  const masuRice = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    new THREE.MeshPhysicalMaterial({
      map: masuRiceTex.map,
      bumpMap: masuRiceTex.bumpMap,
      bumpScale: 0.022,
      roughness: 0.42,
      clearcoat: 0.24,
    })
  );
  masuRice.scale.set(1.0, 0.48, 1.0);
  masuRice.position.y = 0.255;
  masuGroup.add(masuRice);

  const masuHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.6, 0.75),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  masuHit.position.y = 0.25;
  masuHit.userData.interactId = 'masu_reset';
  masuGroup.add(masuHit);

  group.add(masuGroup);

  // Decorative toppings container mounted on the bowl (filled when player adds toppings)
  const bowlToppingsGroup = new THREE.Group();
  bowlGroup.add(bowlToppingsGroup);

  return {
    group,
    bowlGroup,
    bowlToppingsGroup,
    umeDish,
    umeboshiInDish,
    umeGeo,
    umeMat,
    sesameDish,
    noriDish,
    noriMat,
    masuGroup,
  };
}

/**
 * Ergonomic Japanese Hinoki Wood Shamoji ("しゃもじ") Rice Paddle
 */
export function createShamoji() {
  const group = new THREE.Group();
  const woodTex = createWoodCounterTextures(444, 'shamoji');
  const mat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.01,
    roughness: 0.44,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38,
  });

  // Sculpted paddle silhouette via ExtrudeGeometry
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.82);
  shape.bezierCurveTo(0.08, -0.82, 0.11, -0.58, 0.11, -0.25);
  shape.bezierCurveTo(0.11, 0.02, 0.34, 0.14, 0.36, 0.44);
  shape.bezierCurveTo(0.37, 0.68, 0.22, 0.84, 0.0, 0.85);
  shape.bezierCurveTo(-0.22, 0.84, -0.37, 0.68, -0.36, 0.44);
  shape.bezierCurveTo(-0.34, 0.14, -0.11, 0.02, -0.11, -0.25);
  shape.bezierCurveTo(-0.11, -0.58, -0.08, -0.82, 0, -0.82);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: 0.018,
    bevelThickness: 0.018,
  });
  geo.center();

  // Gentle ergonomic spoon curve along Y and slight cup across X on the scoop face
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    if (y > 0.0) {
      const scoop = Math.min(1, y / 0.85);
      z += scoop * scoop * 0.11 - (x * x) * 0.22 * scoop;
    }
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Orient with -Math.PI/2 so the BROAD cupped paddle face (+Y in 2D shape) points forward (-Z) into the pot & bowl!
  mesh.rotation.x = -Math.PI / 2;
  group.add(mesh);

  // Heaped rice clump carried squarely on the broad cupped paddle face (-Z)!
  const scoopRiceGroup = new THREE.Group();
  scoopRiceGroup.position.set(0, 0.09, -0.44);
  scoopRiceGroup.visible = false;
  group.add(scoopRiceGroup);

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.35, 1.9),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.userData.interactId = 'shamoji';
  group.add(hitMesh);

  return { group, mesh, scoopRiceGroup };
}

/**
 * Realistic Articulated 3D Human Hand ("手")
 * Sculpted warm natural hand with smooth skin subsurface wrap lighting,
 * natural tapered fingers, subtle fingernails, and curved washing pose.
 */
export function createRealisticHand() {
  const group = new THREE.Group();
  const skinTex = createSkinTexture();

  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTex,
    color: new THREE.Color(0xe6bfa4),
    roughness: 0.56,
    metalness: 0.0,
    sheen: 0.22,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color(0xf7d8c6),
    clearcoat: 0.14, // subtle wet sheen when washing rice
    clearcoatRoughness: 0.34,
  });

  // Subtle subsurface skin wrap lighting for lifelike warmth under cool north-window light
  skinMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
       float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
       float midShadow = smoothstep(0.06, 0.50, lum) * (1.0 - smoothstep(0.42, 0.85, lum));
       gl_FragColor.rgb += vec3(0.075, 0.022, 0.014) * midShadow;
       #include <dithering_fragment>
      `
    );
  };

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe0b6a5),
    roughness: 0.24,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });

  // Smooth organic tapered forearm -> wrist -> palm bridge (sleek continuous silhouette, zero bulge!)
  const armPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.18, 0.06),
    new THREE.Vector2(0.17, 0.38),
    new THREE.Vector2(0.165, 0.68), // natural tapered wrist
    new THREE.Vector2(0.195, 1.05),
    new THREE.Vector2(0.22, 1.48),
  ];
  const armGeo = new THREE.LatheGeometry(armPts, 24);
  armGeo.scale(1.18, 1.0, 0.66); // naturally flat-oval human wrist/forearm cross-section!
  const wrist = new THREE.Mesh(armGeo, skinMat);
  wrist.rotation.x = Math.PI / 2 - 0.12;
  wrist.position.set(0.01, 0.09, 0.14);
  wrist.castShadow = true;
  group.add(wrist);

  // Natural woven flax-oatmeal cotton sleeve extending smoothly off-frame (never shows a cut end-cap!)
  const cuffLinen = createLinenTextures();
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.30, 1.95, 22, 1, true),
    new THREE.MeshStandardMaterial({
      map: cuffLinen.map,
      bumpMap: cuffLinen.bumpMap,
      bumpScale: 0.012,
      color: 0xbcb6ac,
      roughness: 0.90,
      side: THREE.DoubleSide,
    })
  );
  sleeve.scale.set(1.12, 1.0, 0.78);
  sleeve.rotation.x = Math.PI / 2 - 0.12;
  sleeve.position.set(0.01, 0.34, 2.22);
  sleeve.castShadow = true;
  group.add(sleeve);

  // Sculpted organic rounded palm (back of hand faces +Y, palm faces -Y down into pot!)
  const palmGeo = new THREE.SphereGeometry(0.32, 24, 18);
  palmGeo.scale(1.08, 0.44, 1.15);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0, 0.07, 0.06);
  palm.castShadow = true;
  palm.receiveShadow = true;
  group.add(palm);

  // Smooth heel of palm / thumb mound (thenar eminence)
  const thumbPad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 14), skinMat);
  thumbPad.scale.set(0.90, 0.62, 1.22);
  thumbPad.position.set(-0.22, 0.01, 0.08);
  group.add(thumbPad);

  // Build articulated curved fingers (4 fingers + thumb)
  // NOTE: Fingers extend along -Z; NEGATIVE rotation.x curls fingers DOWNWARD (-Y) naturally!
  const fingers = [];
  const fingerSpecs = [
    { x: -0.24, z: -0.20, len: 0.23, rad: 0.074, spread: -0.10 }, // Index
    { x: -0.08, z: -0.23, len: 0.25, rad: 0.076, spread: -0.03 }, // Middle
    { x: 0.08, z: -0.21, len: 0.23, rad: 0.073, spread: 0.05 },   // Ring
    { x: 0.22, z: -0.16, len: 0.19, rad: 0.064, spread: 0.12 },   // Pinky
  ];

  fingerSpecs.forEach((spec) => {
    const root = new THREE.Group();
    root.position.set(spec.x, 0.08, spec.z);
    root.rotation.y = spec.spread;
    group.add(root);

    // Smooth dorsal knuckle bridge
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(spec.rad * 1.04, 12, 10), skinMat);
    root.add(knuckle);

    // Segment 1 (proximal phalanx)
    const seg1 = new THREE.Mesh(
      new THREE.CapsuleGeometry(spec.rad * 0.90, spec.len * 0.92, 8, 14),
      skinMat
    );
    seg1.rotation.x = Math.PI / 2;
    seg1.position.z = -spec.len * 0.56;
    seg1.castShadow = true;
    root.add(seg1);

    // Segment 2 (middle phalanx)
    const midJoint = new THREE.Group();
    midJoint.position.set(0, 0, -spec.len * 1.06);
    root.add(midJoint);

    const seg2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(spec.rad * 0.78, spec.len * 0.78, 8, 14),
      skinMat
    );
    seg2.rotation.x = Math.PI / 2;
    seg2.position.z = -spec.len * 0.42;
    seg2.castShadow = true;
    midJoint.add(seg2);

    // Segment 3 (distal fingertip)
    const tipJoint = new THREE.Group();
    tipJoint.position.set(0, 0, -spec.len * 0.80);
    midJoint.add(tipJoint);

    const seg3 = new THREE.Mesh(
      new THREE.CapsuleGeometry(spec.rad * 0.66, spec.len * 0.52, 8, 14),
      skinMat
    );
    seg3.rotation.x = Math.PI / 2;
    seg3.position.z = -spec.len * 0.28;
    seg3.castShadow = true;
    tipJoint.add(seg3);

    // Subtle natural fingernail on dorsal (+Y) side of fingertip
    const nail = new THREE.Mesh(new THREE.SphereGeometry(spec.rad * 0.52, 10, 8), nailMat);
    nail.scale.set(0.92, 0.20, 1.22);
    nail.position.set(0, spec.rad * 0.58, -spec.len * 0.36);
    tipJoint.add(nail);

    fingers.push({ root, midJoint, tipJoint });
  });

  // Articulated Thumb on left (-X) side, curving gracefully inward & down
  const thumbRoot = new THREE.Group();
  thumbRoot.position.set(-0.32, 0.02, 0.02);
  thumbRoot.rotation.set(-0.22, 0.46, 0.32);
  group.add(thumbRoot);

  const thumbSeg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.21, 8, 14), skinMat);
  thumbSeg1.rotation.x = Math.PI / 2;
  thumbSeg1.position.z = -0.12;
  thumbSeg1.castShadow = true;
  thumbRoot.add(thumbSeg1);

  const thumbTip = new THREE.Group();
  thumbTip.position.set(0, 0, -0.24);
  thumbRoot.add(thumbTip);

  const thumbSeg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.17, 8, 14), skinMat);
  thumbSeg2.rotation.x = Math.PI / 2;
  thumbSeg2.position.z = -0.10;
  thumbSeg2.castShadow = true;
  thumbTip.add(thumbSeg2);

  const thumbNail = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), nailMat);
  thumbNail.scale.set(0.92, 0.20, 1.22);
  thumbNail.position.set(0, 0.062, -0.13);
  thumbTip.add(thumbNail);

  /**
   * Smoothly pose the hand for washing (downward curved "猫の手" claw), rim-holding, or shamoji grip.
   */
  function setPose(mode, curlExtra = 0) {
    if (mode === 'wash') {
      // Classic Japanese rice-washing downward-cupped fingers ("猫の手")
      fingers.forEach((f, i) => {
        const wave = Math.sin(i * 0.55) * 0.05;
        f.root.rotation.x = -(0.50 + curlExtra * 0.20 + wave);
        f.midJoint.rotation.x = -(0.56 + curlExtra * 0.24);
        f.tipJoint.rotation.x = -(0.34 + curlExtra * 0.14);
      });
      thumbRoot.rotation.set(-0.42, 0.42, 0.32);
      thumbTip.rotation.x = -0.34;
    } else if (mode === 'hold_shamoji') {
      fingers.forEach((f, i) => {
        f.root.rotation.x = -(0.78 + i * 0.04);
        f.midJoint.rotation.x = -0.88;
        f.tipJoint.rotation.x = -0.40;
      });
      thumbRoot.rotation.set(-0.28, 0.26, 0.36);
      thumbTip.rotation.x = -0.22;
    } else {
      // Relaxed gently curved open hand
      fingers.forEach((f, i) => {
        f.root.rotation.x = -(0.22 + i * 0.03);
        f.midJoint.rotation.x = -0.26;
        f.tipJoint.rotation.x = -0.16;
      });
      thumbRoot.rotation.set(-0.18, 0.48, 0.22);
      thumbTip.rotation.x = -0.15;
    }
  }

  setPose('wash', 0);

  return { group, fingers, thumbRoot, thumbTip, skinMat, setPose };
}

/**
 * Volumetric-Style Backlit Steam System
 */
export function createSteamSystem(count = 68) {
  const group = new THREE.Group();
  const tex = createSteamTexture();
  const particles = [];

  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(0xf6faff),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 6;
    group.add(sprite);
    particles.push({
      sprite,
      mat,
      age: 99,
      life: 2.0,
      vx: 0,
      vy: 0,
      vz: 0,
      baseScale: 0.4,
      maxScale: 1.5,
      peakOpacity: 0.26,
      spin: 0,
    });
  }

  let cursor = 0;

  function emit(x, y, z, opts = {}) {
    const p = particles[cursor];
    cursor = (cursor + 1) % particles.length;
    p.age = 0;
    p.life = (opts.life ?? 2.4) * (0.8 + Math.random() * 0.4);
    p.sprite.position.set(
      x + (Math.random() - 0.5) * (opts.spread ?? 0.35),
      y + (Math.random() - 0.5) * 0.08,
      z + (Math.random() - 0.5) * (opts.spread ?? 0.35)
    );
    p.vx = (opts.driftX ?? 0.14) + (Math.random() - 0.5) * 0.16;
    p.vy = (opts.rise ?? 0.72) * (0.8 + Math.random() * 0.45);
    p.vz = (opts.driftZ ?? -0.04) + (Math.random() - 0.5) * 0.14;
    p.baseScale = opts.baseScale ?? 0.42;
    p.maxScale = opts.maxScale ?? 1.85;
    p.peakOpacity = opts.opacity ?? 0.24;
    p.mat.rotation = Math.random() * Math.PI * 2;
    p.spin = (Math.random() - 0.5) * 0.45;
    p.sprite.visible = true;
  }

  function update(dt) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.sprite.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.sprite.position.x += p.vx * dt + Math.sin(p.age * 2.2 + i) * 0.08 * dt;
      p.sprite.position.y += p.vy * (1.0 - t * 0.35) * dt;
      p.sprite.position.z += p.vz * dt;
      const sc = THREE.MathUtils.lerp(p.baseScale, p.maxScale, Math.pow(t, 0.72));
      p.sprite.scale.set(sc, sc, 1);
      p.mat.rotation += p.spin * dt;
      // Smooth fade-in then soft dissipation
      const fadeIn = Math.min(1, t / 0.18);
      const fadeOut = Math.pow(1.0 - t, 1.5);
      p.mat.opacity = p.peakOpacity * fadeIn * fadeOut;
    }
  }

  return { group, emit, update };
}

/**
 * Water Droplet Splash Particle Pool (InstancedMesh)
 */
export function createSplashSystem(count = 40) {
  const geo = new THREE.SphereGeometry(0.024, 8, 6);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xeef5fb),
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.78,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const drops = [];
  for (let i = 0; i < count; i++) {
    drops.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.5, scale: 0 });
    dummy.position.set(0, -10, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  let idx = 0;
  function spawn(x, y, z, vx, vy, vz, scale = 1.0) {
    const d = drops[idx];
    idx = (idx + 1) % count;
    d.x = x;
    d.y = y;
    d.z = z;
    d.vx = vx;
    d.vy = vy;
    d.vz = vz;
    d.life = 0.001;
    d.maxLife = 0.35 + Math.random() * 0.32;
    d.scale = scale * (0.7 + Math.random() * 0.65);
  }

  function update(dt) {
    let dirty = false;
    for (let i = 0; i < count; i++) {
      const d = drops[i];
      if (d.life <= 0) continue;
      dirty = true;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.life = 0;
        dummy.position.set(0, -10, 0);
        dummy.scale.set(0, 0, 0);
      } else {
        d.vy -= 9.5 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        const s = d.scale * (1.0 - d.life / d.maxLife);
        dummy.position.set(d.x, d.y, d.z);
        dummy.scale.set(s, s * (1 + Math.abs(d.vy) * 0.14), s);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, spawn, update };
}

/**
 * Child-sized warm wooden tasting spoon for the Serve finale
 */
export function createWoodenSpoon() {
  const group = new THREE.Group();
  const wood = createWoodCounterTextures(555, 'shamoji');
  const mat = new THREE.MeshPhysicalMaterial({
    map: wood.map,
    roughness: 0.42,
    clearcoat: 0.25,
  });

  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.95, 6, 12), mat);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.45;
  handle.castShadow = true;
  group.add(handle);

  const bowlGeo = new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
  bowlGeo.scale(0.88, 0.58, 1.25);
  const bowl = new THREE.Mesh(bowlGeo, mat);
  bowl.position.set(0, 0.04, -0.18);
  bowl.castShadow = true;
  group.add(bowl);

  // Small steaming rice bite resting on spoon
  const biteGroup = new THREE.Group();
  biteGroup.position.set(0, 0.05, -0.18);
  biteGroup.visible = false;
  group.add(biteGroup);

  group.visible = false;
  return { group, biteGroup };
}
