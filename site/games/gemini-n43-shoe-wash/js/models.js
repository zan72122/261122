import * as THREE from 'three';

/**
 * Photorealistic Summer Sky Dome with vivid Rayleigh azure sky, blazing August sun,
 * and sculptural towering Japanese cumulonimbus clouds (入道雲).
 */
export function buildSummerSky(sunDir) {
  const skyGeo = new THREE.SphereGeometry(55, 36, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vWorldDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.04 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float y = max(d.y, 0.0);

        // Deep radiant August sky gradient
        vec3 zenith = vec3(0.06, 0.34, 0.85);
        vec3 midSky = vec3(0.24, 0.62, 0.96);
        vec3 horizon = vec3(0.76, 0.91, 1.0);

        vec3 sky = mix(horizon, midSky, smoothstep(0.0, 0.26, y));
        sky = mix(sky, zenith, smoothstep(0.18, 0.78, y));

        // Intense summer sun scatter & glowing disc
        float sunDot = max(dot(d, uSunDir), 0.0);
        sky += vec3(1.0, 0.93, 0.76) * pow(sunDot, 12.0) * 0.36;
        sky += vec3(1.0, 0.98, 0.90) * pow(sunDot, 96.0) * 0.92;
        sky += vec3(1.6, 1.54, 1.38) * smoothstep(0.9984, 0.9995, sunDot);

        // Sculptural towering summer cumulonimbus (入道雲) with crisp sunlit tops & cool blue-gray bases
        if (d.y > 0.01) {
          vec2 uv = d.xz / (d.y + 0.28);
          vec2 drift = vec2(uTime * 0.007, uTime * 0.002);
          float baseN = fbm(uv * 0.75 + drift);
          float cauliflower = fbm(uv * 2.4 - drift * 1.2);
          float billow = baseN * 0.70 + cauliflower * 0.30;

          float band = smoothstep(0.02, 0.14, d.y) * (1.0 - smoothstep(0.42, 0.78, d.y));
          float cloudMask = smoothstep(0.46, 0.63, billow) * band;

          // Directional sunlight shading across cloud billow puffs
          float litN = fbm((uv + uSunDir.xz * 0.11) * 0.75 + drift);
          float litEdge = clamp((litN - baseN) * 3.8 + d.y * 1.45 + 0.32, 0.0, 1.0);
          vec3 cloudShadow = vec3(0.62, 0.75, 0.91);
          vec3 cloudLit = vec3(1.0, 0.99, 0.96) * (1.02 + pow(sunDot, 4.0) * 0.22);
          vec3 cloudCol = mix(cloudShadow, cloudLit, smoothstep(0.15, 0.85, litEdge));

          sky = mix(sky, cloudCol, cloudMask * 0.94);
        }

        if (d.y < 0.0) {
          sky = mix(horizon, vec3(0.66, 0.74, 0.82), smoothstep(0.0, -0.25, d.y));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(skyGeo, skyMat);
  mesh.frustumCulled = false;
  return { mesh, material: skyMat };
}

/**
 * Photorealistic Japanese Veranda Environment:
 * Weathered concrete with wet puddles, recessed drain grate, aluminum railing casting razor-sharp shadows,
 * tiled wall faucet mount + glittering refractive water stream, stainless laundry pole,
 * uwabaki shoe-hanger, Edo glass wind chime (江戸風鈴), realistic botanical potted plant,
 * and atmospheric distant Japanese neighborhood panorama (zero low-poly toy blocks!).
 */
export function buildVeranda(textures) {
  const group = new THREE.Group();

  // 1. Concrete Veranda Floor
  const floorGeo = new THREE.PlaneGeometry(5.6, 3.6);
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.concrete.map,
    roughnessMap: textures.concrete.roughnessMap,
    bumpMap: textures.concrete.bumpMap,
    bumpScale: 0.009,
    roughness: 0.96,
    metalness: 0.06
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -0.15);
  floor.receiveShadow = true;
  floor.name = 'verandaFloor';
  group.add(floor);

  // Recessed drainage channel & brushed metal drain strip
  const gutterMat = new THREE.MeshStandardMaterial({
    color: 0x8a877f,
    roughness: 0.84,
    metalness: 0.08
  });
  const gutter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.036, 0.16), gutterMat);
  gutter.position.set(0, -0.014, -1.24);
  gutter.receiveShadow = true;
  group.add(gutter);

  // 2. Concrete Parapet & Brushed Aluminum Railing (casts dramatic crisp August parallel shadows!)
  const parapetMat = new THREE.MeshStandardMaterial({
    map: textures.stucco,
    color: 0xe8e2d6,
    roughness: 0.88,
    metalness: 0.02
  });
  const lowParapet = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.36, 0.16), parapetMat);
  lowParapet.position.set(0, 0.18, -1.38);
  lowParapet.castShadow = true;
  lowParapet.receiveShadow = true;
  group.add(lowParapet);

  // Dark anodized aluminum coping cap along parapet top
  const copingMat = new THREE.MeshStandardMaterial({
    color: 0xbac4cc,
    roughness: 0.34,
    metalness: 0.78
  });
  const parapetCap = new THREE.Mesh(new THREE.BoxGeometry(5.82, 0.024, 0.18), copingMat);
  parapetCap.position.set(0, 0.37, -1.38);
  parapetCap.castShadow = true;
  parapetCap.receiveShadow = true;
  group.add(parapetCap);

  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0xcfd7de,
    roughness: 0.28,
    metalness: 0.84
  });

  // Top & mid rails (slightly lower top rail = more sweeping summer sky visible in wide-angle lens!)
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.050, 0.080), aluminumMat);
  topRail.position.set(0, 1.02, -1.38);
  topRail.castShadow = true;
  topRail.receiveShadow = true;
  group.add(topRail);

  const midRail = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.028, 0.044), aluminumMat);
  midRail.position.set(0, 0.42, -1.38);
  midRail.castShadow = true;
  group.add(midRail);

  const balusterCount = 31;
  const balGeo = new THREE.BoxGeometry(0.020, 0.60, 0.022);
  const balusters = new THREE.InstancedMesh(balGeo, aluminumMat, balusterCount);
  balusters.castShadow = true;
  balusters.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < balusterCount; i++) {
    const x = -2.7 + (i / (balusterCount - 1)) * 5.4;
    dummy.position.set(x, 0.72, -1.38);
    dummy.updateMatrix();
    balusters.setMatrixAt(i, dummy.matrix);
  }
  balusters.instanceMatrix.needsUpdate = true;
  group.add(balusters);

  for (const px of [-2.4, -0.95, 0.95, 2.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.65, 0.058), aluminumMat);
    post.position.set(px, 0.70, -1.38);
    post.castShadow = true;
    group.add(post);
  }

  // 3. Left Exterior Veranda Wall + Grounded Standpipe Column & Chrome Outdoor Faucet (立水栓)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.2, 3.6), parapetMat);
  leftWall.position.set(-1.55, 1.5, 0.1);
  leftWall.receiveShadow = true;
  leftWall.castShadow = true;
  group.add(leftWall);

  // Realistic vertical Japanese veranda water column (立水栓) anchored cleanly against the left wall!
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0xd8d3c8,
    roughness: 0.72,
    metalness: 0.08
  });
  const waterPillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.78, 0.11), pillarMat);
  waterPillar.position.set(-1.38, 0.39, -0.34);
  waterPillar.castShadow = true;
  waterPillar.receiveShadow = true;
  group.add(waterPillar);

  const faucetGroup = new THREE.Group();
  faucetGroup.position.set(-1.33, 0.66, -0.34);

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    roughness: 0.12,
    metalness: 0.95
  });

  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.022, 16), chromeMat);
  flange.rotation.z = Math.PI / 2;
  faucetGroup.add(flange);

  // Extension swing-arm faucet pipe reaching cleanly over the bucket rinsing zone
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 14), chromeMat);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0.31, 0, 0);
  pipe.castShadow = true;
  faucetGroup.add(pipe);

  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.085, 14), chromeMat);
  valve.position.set(0.62, 0.02, 0);
  valve.castShadow = true;
  faucetGroup.add(valve);

  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.62, 0.01, 0),
    new THREE.Vector3(0.80, 0.04, 0.06),
    new THREE.Vector3(0.91, 0.01, 0.14),
    new THREE.Vector3(0.94, -0.07, 0.18)
  ]);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 18, 0.014, 12, false), chromeMat);
  spout.castShadow = true;
  faucetGroup.add(spout);

  // Aerator nozzle collar
  const aerator = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.016, 0.022, 14), chromeMat);
  aerator.position.set(0.942, -0.078, 0.184);
  faucetGroup.add(aerator);

  // Cross faucet handle
  const faucetHandle = new THREE.Group();
  faucetHandle.position.set(0.62, 0.082, 0);
  faucetHandle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.013, 0.024, 12), chromeMat));
  const hCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.010, 0.008, 12),
    new THREE.MeshStandardMaterial({ color: 0x2679e0, roughness: 0.25 })
  );
  hCap.position.y = 0.014;
  faucetHandle.add(hCap);
  for (let a = 0; a < 4; a++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0085, 0.052, 8), chromeMat);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = (a * Math.PI) / 2;
    spoke.position.set(Math.cos((a * Math.PI) / 2) * 0.024, 0, Math.sin((a * Math.PI) / 2) * 0.024);
    faucetHandle.add(spoke);
  }
  faucetGroup.add(faucetHandle);

  // Dynamic glistening refractive faucet waterfall stream
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.942, -0.08, 0.184),
    new THREE.Vector3(0.985, -0.23, 0.22),
    new THREE.Vector3(1.025, -0.44, 0.25),
    new THREE.Vector3(1.055, -0.66, 0.27)
  ]);
  const streamGeo = new THREE.TubeGeometry(streamCurve, 28, 0.015, 14, false);
  const streamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 0 }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlow;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(uv.x * 28.0 - uTime * 24.0) * 0.0032 + cos(uv.x * 46.0 - uTime * 34.0) * 0.0018;
        float radiusScale = mix(0.2, 1.0, uFlow) * (1.0 - uv.x * 0.12);
        pos += normal * (wave * uFlow - (1.0 - radiusScale) * 0.011);
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlow;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        if (uFlow < 0.02) discard;
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.1);
        float streak = sin(vUv.x * 42.0 - uTime * 30.0 + vUv.y * 14.0) * 0.5 + 0.5;
        float sparkle = pow(streak, 4.5) * 0.85;
        vec3 waterCol = mix(vec3(0.74, 0.93, 1.0), vec3(1.0, 1.0, 1.0), fresnel * 0.72 + sparkle * 0.55);
        float alpha = (0.36 + fresnel * 0.52 + sparkle * 0.36) * uFlow;
        gl_FragColor = vec4(waterCol, clamp(alpha, 0.0, 0.94));
      }
    `
  });
  const waterStream = new THREE.Mesh(streamGeo, streamMat);
  waterStream.visible = false;
  faucetGroup.add(waterStream);
  group.add(faucetGroup);

  const streamWorldTip = new THREE.Vector3(-1.33 + 0.942, 0.66 - 0.08, -0.34 + 0.184);
  const streamWorldMid = new THREE.Vector3(-1.33 + 1.005, 0.66 - 0.33, -0.34 + 0.24);

  // 4. Overhead Stainless Laundry Pole (物干し竿) & Twin Uwabaki Shoe Hanger
  const poleY = 1.40;
  const poleZ = -0.62;
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xe6ecf0,
    roughness: 0.20,
    metalness: 0.90
  });
  const laundryPole = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 4.2, 16), poleMat);
  laundryPole.rotation.z = Math.PI / 2;
  laundryPole.position.set(0.3, poleY, poleZ);
  laundryPole.castShadow = true;
  group.add(laundryPole);

  const poleBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 0.22), aluminumMat);
  poleBracket.position.set(-1.42, poleY - 0.02, poleZ);
  group.add(poleBracket);

  const hangerPivot = new THREE.Group();
  hangerPivot.position.set(0.04, poleY, poleZ);

  const hangerBlueMat = new THREE.MeshStandardMaterial({
    color: 0x3b92e6,
    roughness: 0.30,
    metalness: 0.06
  });
  const hangerWireMat = new THREE.MeshStandardMaterial({
    color: 0xdce4ea,
    roughness: 0.20,
    metalness: 0.88
  });

  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.026, 0.02),
    new THREE.Vector3(0, 0.030, -0.022),
    new THREE.Vector3(0, -0.02, -0.024),
    new THREE.Vector3(0, -0.09, 0)
  ]);
  const hookMesh = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 16, 0.0075, 10, false), hangerBlueMat);
  hookMesh.castShadow = true;
  hangerPivot.add(hookMesh);

  const hubBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.36, 6, 12), hangerBlueMat);
  hubBar.rotation.z = Math.PI / 2;
  hubBar.position.set(0, -0.095, 0);
  hubBar.castShadow = true;
  hangerPivot.add(hubBar);

  const hangerSlots = [];
  for (const side of [-1, 1]) {
    const sx = side * 0.19;
    const prongCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.72, -0.095, 0),
      new THREE.Vector3(sx, -0.25, 0.02),
      new THREE.Vector3(sx * 1.05, -0.32, 0.05),
      new THREE.Vector3(sx * 0.94, -0.18, 0.08)
    ]);
    const prong = new THREE.Mesh(new THREE.TubeGeometry(prongCurve, 18, 0.0065, 10, false), hangerWireMat);
    prong.castShadow = true;
    hangerPivot.add(prong);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), hangerBlueMat);
    cap.position.set(sx * 0.94, -0.18, 0.08);
    hangerPivot.add(cap);

    const slotAnchor = new THREE.Group();
    slotAnchor.position.set(sx * 0.98, -0.275, 0.098);
    hangerPivot.add(slotAnchor);
    hangerSlots.push(slotAnchor);
  }
  group.add(hangerPivot);

  // 5. Interactive Edo Glass Wind Chime (江戸風鈴) — crystal glass with delicate hand-painted motif!
  const windChimePivot = new THREE.Group();
  windChimePivot.position.set(0.72, poleY, poleZ + 0.05);

  const cordMat = new THREE.MeshStandardMaterial({ color: 0xd93a46, roughness: 0.85 });
  const topCord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.16, 6), cordMat);
  topCord.position.y = -0.08;
  windChimePivot.add(topCord);

  const bellPts = [
    new THREE.Vector2(0.002, 0.0),
    new THREE.Vector2(0.028, -0.005),
    new THREE.Vector2(0.048, -0.028),
    new THREE.Vector2(0.053, -0.060),
    new THREE.Vector2(0.047, -0.090),
    new THREE.Vector2(0.042, -0.096)
  ];
  const bellGeo = new THREE.LatheGeometry(bellPts, 28);
  const bellGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8f1ff,
    roughness: 0.04,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide
  });
  const bellMesh = new THREE.Mesh(bellGeo, bellGlassMat);
  bellMesh.position.y = -0.155;
  bellMesh.name = 'windChime';
  windChimePivot.add(bellMesh);

  const rimBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.048, 0.0038, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xe24250, roughness: 0.22, transparent: true, opacity: 0.88 })
  );
  rimBand.rotation.x = Math.PI / 2;
  rimBand.position.y = -0.232;
  windChimePivot.add(rimBand);

  const chimeHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  chimeHit.position.y = -0.27;
  chimeHit.name = 'windChimeHit';
  windChimePivot.add(chimeHit);

  const stripPivot = new THREE.Group();
  stripPivot.position.y = -0.21;

  const clapper = new THREE.Mesh(
    new THREE.SphereGeometry(0.0085, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.12, metalness: 0.15 })
  );
  clapper.position.y = -0.032;
  stripPivot.add(clapper);

  const lowerCord = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.10, 6), cordMat);
  lowerCord.position.y = -0.08;
  stripPivot.add(lowerCord);

  const tanzakuCanvas = document.createElement('canvas');
  tanzakuCanvas.width = 64;
  tanzakuCanvas.height = 192;
  const tCtx = tanzakuCanvas.getContext('2d');
  tCtx.fillStyle = '#fcfaf2';
  tCtx.fillRect(0, 0, 64, 192);
  // Subtle indigo summer wave motif (zero text)
  tCtx.fillStyle = '#2c7fd6';
  tCtx.fillRect(0, 152, 64, 40);
  tCtx.fillStyle = '#e24656';
  tCtx.beginPath();
  tCtx.arc(32, 84, 13, 0, Math.PI * 2);
  tCtx.fill();
  tCtx.fillStyle = '#73bcf7';
  for (let i = 0; i < 3; i++) {
    tCtx.fillRect(10, 122 + i * 7, 44, 2.5);
  }
  const tanzakuTex = new THREE.CanvasTexture(tanzakuCanvas);
  tanzakuTex.colorSpace = THREE.SRGBColorSpace;

  const tanzaku = new THREE.Mesh(
    new THREE.PlaneGeometry(0.044, 0.18, 1, 6),
    new THREE.MeshStandardMaterial({
      map: tanzakuTex,
      roughness: 0.86,
      side: THREE.DoubleSide
    })
  );
  tanzaku.position.y = -0.205;
  tanzaku.castShadow = true;
  stripPivot.add(tanzaku);
  windChimePivot.add(stripPivot);
  group.add(windChimePivot);

  // 6. Realistic Botanical Potted Plant in Far-Right Corner (alpha-cutout veined leaves + curved stems!)
  const potGroup = new THREE.Group();
  potGroup.position.set(1.22, 0, -1.04);

  const potMat = new THREE.MeshStandardMaterial({
    color: 0xb06342,
    roughness: 0.84,
    bumpMap: textures.stucco,
    bumpScale: 0.004
  });
  const potPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.095, 0.0),
    new THREE.Vector2(0.135, 0.21),
    new THREE.Vector2(0.148, 0.215),
    new THREE.Vector2(0.148, 0.242),
    new THREE.Vector2(0.128, 0.242),
    new THREE.Vector2(0.122, 0.20)
  ];
  const potMesh = new THREE.Mesh(new THREE.LatheGeometry(potPts, 20), potMat);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  potGroup.add(potMesh);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.126, 0.126, 0.015, 16),
    new THREE.MeshStandardMaterial({ color: 0x423326, roughness: 0.96 })
  );
  soil.position.y = 0.205;
  potGroup.add(soil);

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f6e2d, roughness: 0.72 });
  const leafCardMat = new THREE.MeshStandardMaterial({
    map: textures.leaf,
    alphaTest: 0.35,
    roughness: 0.44,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  // Curved botanical leaf card geometry (slightly arched for realistic 3D light catch)
  const leafPlane = new THREE.PlaneGeometry(0.105, 0.125, 2, 3);
  const lpPos = leafPlane.attributes.position;
  for (let i = 0; i < lpPos.count; i++) {
    const lx = lpPos.getX(i);
    const ly = lpPos.getY(i);
    const bend = -Math.pow(ly / 0.065, 2) * 0.014 - Math.abs(lx) * 0.12;
    lpPos.setZ(i, bend);
  }
  leafPlane.computeVertexNormals();

  for (let s = 0; s < 5; s++) {
    const ang = (s / 5) * Math.PI * 2 + 0.3;
    const spread = 0.055 + (s % 2) * 0.035;
    const hTop = 0.38 + (s % 3) * 0.065;
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 0.02, 0.20, Math.sin(ang) * 0.02),
      new THREE.Vector3(Math.cos(ang) * spread * 0.7, 0.29, Math.sin(ang) * spread * 0.7),
      new THREE.Vector3(Math.cos(ang) * spread, hTop, Math.sin(ang) * spread)
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 8, 0.004, 6, false), stemMat);
    stem.castShadow = true;
    potGroup.add(stem);

    for (let k = 0; k < 4; k++) {
      const t = 0.42 + (k / 3) * 0.56;
      const pt = stemCurve.getPoint(t);
      const leaf = new THREE.Mesh(leafPlane, leafCardMat);
      leaf.position.copy(pt);
      const leafAng = ang + (k % 2 === 0 ? 0.65 : -0.65);
      leaf.rotation.set(0.68 + (k % 2) * 0.22, leafAng, (k % 2 === 0 ? 0.2 : -0.2));
      const sc = 0.78 + (1 - t * 0.3) * 0.38;
      leaf.scale.setScalar(sc);
      leaf.castShadow = true;
      potGroup.add(leaf);
    }
  }
  group.add(potGroup);

  // 7. Photorealistic Distant Japanese Summer Neighborhood Panorama Arc (ideal horizon balance: treetops + roofs + huge blue sky!)
  const bgArcGeo = new THREE.CylinderGeometry(16, 16, 5.4, 40, 1, true, Math.PI * 0.65, Math.PI * 0.70);
  const bgArcMat = new THREE.MeshBasicMaterial({
    map: textures.backdrop,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false
  });
  const bgArc = new THREE.Mesh(bgArcGeo, bgArcMat);
  bgArc.position.set(0, 0.72, -0.5);
  group.add(bgArc);

  // Subtle glossy sunlit wet puddle sheen around the washing zone (reflects bright summer sky!)
  const puddleGeo = new THREE.CircleGeometry(0.56, 36);
  puddleGeo.rotateX(-Math.PI / 2);
  const puddleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uWetness: { value: 0.65 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWetness;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float ang = atan(p.y, p.x);
        float wobble = 0.78 + 0.14 * sin(ang * 3.0 + 0.8) + 0.08 * cos(ang * 5.0 - 0.4);
        float dist = length(p) / wobble;
        float mask = 1.0 - smoothstep(0.58, 0.98, dist);
        if (mask < 0.01) discard;

        vec3 V = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(V.y, 0.0), 2.4);
        float ripple = sin(dist * 24.0 - uTime * 2.5) * 0.04;
        vec3 skyRefl = mix(vec3(0.46, 0.72, 0.96), vec3(0.92, 0.97, 1.0), clamp(fresnel + ripple, 0.0, 1.0));
        float alpha = mask * (0.14 + fresnel * 0.34) * clamp(uWetness, 0.0, 1.0);
        gl_FragColor = vec4(skyRefl, alpha);
      }
    `
  });
  const wetPuddle = new THREE.Mesh(puddleGeo, puddleMat);
  wetPuddle.position.set(-0.22, 0.0025, 0.08);
  group.add(wetPuddle);

  return {
    group,
    floor,
    faucetHandle,
    waterStream,
    streamMat,
    streamWorldTip,
    streamWorldMid,
    hangerPivot,
    hangerSlots,
    windChimePivot,
    stripPivot,
    chimeHit,
    bellMesh,
    puddleMat
  };
}

/**
 * Builds an anatomically accurate, smooth rounded Japanese Uwabaki (うわばき) school shoe!
 * Uses a true stadium/pill shoe-last footprint (round heel + gentle arch + wide round toe box),
 * clean smooth canvas upper with open U-collar (NO pinched ridges!), flush woven elastic instep band,
 * curved glossy-matte rubber toe cap, textured foxing sole, and organic multi-scale frothy foam clusters!
 */
export function buildUwabakiShoe({
  side = 'left',
  bandColor = 0xd9363c,
  surface,
  weaveBumpMap,
  foamBumpMap
}) {
  const root = new THREE.Group();
  const mirror = side === 'right' ? -1 : 1;

  // Generous foreground uwabaki dimensions (~31cm for great visual clarity)
  const L = 0.305;
  const W = 0.122;

  // Smooth anatomical shoe-last outline point at angle theta in [0, 2*PI]
  // theta = 0 -> toe tip (+Z), theta = PI -> heel back (-Z), smooth round ends!
  function outlineXZ(theta) {
    const c = Math.cos(theta); // +1 = toe, -1 = heel
    const s = Math.sin(theta); // +1/-1 = sides

    // Superellipse-like smooth fullness so toe & heel are genuinely ROUND, never pointy!
    const powC = Math.sign(c) * Math.pow(Math.abs(c), 0.82);
    const z = powC * (L * 0.5);

    // Width profile along length: wider rounded toe box, subtle midfoot waist, snug rounded heel
    const t = 0.5 + 0.5 * c; // 0=heel, 1=toe
    let widthScale;
    if (t > 0.52) {
      widthScale = 1.02; // generous rounded toe box
    } else if (t > 0.28) {
      // gentle arch waist
      const k = (t - 0.28) / 0.24;
      widthScale = 0.86 + 0.16 * k;
    } else {
      widthScale = 0.86; // snug rounded heel
    }

    // Smoothly fill shoulders using superellipse sin power 0.78
    const powS = Math.sign(s) * Math.pow(Math.abs(s), 0.78);
    // Subtle anatomical inward curve toward big toe
    const centerShift = mirror * Math.sin(t * Math.PI) * 0.006;
    const x = centerShift + powS * (W * 0.5) * widthScale;
    return { x, z, t };
  }

  // 1. Rubber Outsole & White Foxing Tape
  const soleShape = new THREE.Shape();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const ang = (i / steps) * Math.PI * 2;
    const pt = outlineXZ(ang);
    if (i === 0) soleShape.moveTo(pt.x, pt.z);
    else soleShape.lineTo(pt.x, pt.z);
  }
  soleShape.closePath();

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.0035,
    bevelSegments: 3,
    curveSegments: 24
  });
  soleGeo.rotateX(Math.PI / 2);
  soleGeo.translate(0, 0.024, 0);

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0xf4f2ea,
    roughness: 0.44,
    metalness: 0.02
  });
  const soleMesh = new THREE.Mesh(soleGeo, rubberMat);
  soleMesh.castShadow = true;
  soleMesh.receiveShadow = true;
  root.add(soleMesh);

  // Subtle natural gum/white textured bottom outsole
  const outsoleBaseGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.005,
    bevelEnabled: false
  });
  outsoleBaseGeo.rotateX(Math.PI / 2);
  outsoleBaseGeo.translate(0, 0.004, 0);
  const outsoleBase = new THREE.Mesh(
    outsoleBaseGeo,
    new THREE.MeshStandardMaterial({ color: 0xe3ded0, roughness: 0.68 })
  );
  root.add(outsoleBase);

  // 2. Smooth Sculpted Cotton-Canvas Upper (outer collar wall + smooth closed rounded vamp dome!)
  // Part A: Side/Heel/Front Canvas Wall forming the open foot collar cleanly without pinching
  const segU = 48;
  const segV = 14;
  const wallPos = [];
  const wallUV = [];
  const wallIdx = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = sole line, 1 = collar rim
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const ang = u * Math.PI * 2;
      const pt = outlineXZ(ang);
      const c = Math.cos(ang); // +1 = toe, -1 = heel
      const s = Math.sin(ang);

      // Collar height: taller at heel (0.088), gently scooped around ankle sides (0.062), rising slightly at instep/toe (0.072)
      const heelRise = Math.pow(Math.max(0, -c), 1.6) * 0.028;
      const toeLower = Math.pow(Math.max(0, c), 1.8) * 0.018;
      const colH = 0.064 + heelRise - toeLower;

      // Gentle inward curve as canvas rises from sole to ankle/toe top
      const inset = 1.0 - v * (0.12 + Math.max(0, c) * 0.24);
      const x = pt.x * inset;
      const z = pt.z * (1.0 - v * (0.06 + Math.max(0, c) * 0.14));
      const y = 0.020 + colH * Math.sin(v * Math.PI * 0.5);

      wallPos.push(x, y, z);
      wallUV.push(u, v * 0.65);
    }
  }
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = (iv + 1) * (segU + 1) + iu;
      const d = c + 1;
      wallIdx.push(a, c, b, b, c, d);
    }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUV, 2));
  wallGeo.setIndex(wallIdx);
  wallGeo.computeVertexNormals();

  // Part B: Smooth Closed Rounded Canvas Vamp / Toe Box Dome (sits cleanly forward of instep opening z > 0.025!)
  const vampGeo = new THREE.SphereGeometry(0.062, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const vp = vampGeo.attributes.position;
  const vuv = vampGeo.attributes.uv;
  for (let i = 0; i < vp.count; i++) {
    let x = vp.getX(i);
    let y = vp.getY(i);
    let z = vp.getZ(i);
    const zNorm = z / 0.062;
    x *= 0.94;
    z = z * 1.18 + 0.072;
    y = y * (0.94 - Math.max(0, zNorm) * 0.28) + 0.021;
    vp.setXYZ(i, x, y, z);
    vuv.setXY(i, 0.5 + x * 4.5, 0.45 + (z - 0.05) * 3.2);
  }
  vampGeo.computeVertexNormals();

  const canvasMat = new THREE.MeshStandardMaterial({
    map: surface.map,
    roughnessMap: surface.roughnessMap,
    bumpMap: weaveBumpMap,
    bumpScale: 0.0045,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const wallMesh = new THREE.Mesh(wallGeo, canvasMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.name = 'shoeCanvas';
  root.add(wallMesh);

  const vampMesh = new THREE.Mesh(vampGeo, canvasMat);
  vampMesh.castShadow = true;
  vampMesh.receiveShadow = true;
  vampMesh.name = 'shoeVamp';
  root.add(vampMesh);

  // 3. Cushioned Interior Insole (warm off-white sockliner inside the U-opening)
  const insoleGeo = new THREE.ExtrudeGeometry(soleShape, { depth: 0.006, bevelEnabled: false });
  insoleGeo.rotateX(Math.PI / 2);
  insoleGeo.scale(0.84, 1, 0.88);
  insoleGeo.translate(0, 0.030, -0.008);
  const insole = new THREE.Mesh(
    insoleGeo,
    new THREE.MeshStandardMaterial({ map: surface.map, roughness: 0.88, color: 0xeae6dc })
  );
  insole.receiveShadow = true;
  root.add(insole);

  // 4. Iconic Japanese Uwabaki Curved White Rubber Toe Cap (つま先ゴム) — cleanly matched to rounded toe!
  const toeCapGeo = new THREE.SphereGeometry(0.056, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.54);
  toeCapGeo.scale(1.04, 0.78, 1.12);
  const toeCapMat = new THREE.MeshStandardMaterial({
    color: 0xf7f6f0,
    roughness: 0.34,
    metalness: 0.02
  });
  const toeCap = new THREE.Mesh(toeCapGeo, toeCapMat);
  toeCap.position.set(0, 0.023, L * 0.295);
  toeCap.castShadow = true;
  toeCap.receiveShadow = true;
  root.add(toeCap);

  // Smooth rounded rubber toe bumper rim
  const bumperPts = [];
  for (let i = -10; i <= 10; i++) {
    const ang = (i / 10) * 1.12;
    const pt = outlineXZ(ang);
    bumperPts.push(new THREE.Vector3(pt.x * 1.01, 0.026, pt.z * 1.01));
  }
  const bumper = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bumperPts), 24, 0.0075, 8, false),
    rubberMat
  );
  bumper.castShadow = true;
  root.add(bumper);

  // 5. Classic Bold Flush Woven Colored Elastic Instep Band (ゴムバンド — cleanly visible over the foot opening!)
  const bandMat = new THREE.MeshStandardMaterial({
    color: bandColor,
    bumpMap: weaveBumpMap,
    bumpScale: 0.006,
    roughness: 0.76,
    metalness: 0.0
  });

  // Build crisp arched flat woven elastic band directly (NO origin Y-crush!)
  const bandW = 0.026; // authentic ~2.6cm wide Japanese uwabaki elastic strap
  const bandThick = 0.0055;
  const bSegs = 22;
  const bPos = [];
  const bIdx = [];
  for (let i = 0; i <= bSegs; i++) {
    const f = (i / bSegs) * 2 - 1; // -1..+1 left-to-right across instep
    const sx = f * (W * 0.455);
    const arch = Math.cos(f * Math.PI * 0.5);
    const syTop = 0.052 + arch * 0.036;
    const syBot = syTop - bandThick;
    const szCenter = 0.022 + arch * 0.006;
    // 4 cross-section vertices per slice: top-front, top-back, bot-back, bot-front
    bPos.push(
      sx, syTop, szCenter + bandW * 0.5,
      sx, syTop, szCenter - bandW * 0.5,
      sx, syBot, szCenter - bandW * 0.5,
      sx, syBot, szCenter + bandW * 0.5
    );
  }
  for (let i = 0; i < bSegs; i++) {
    const o = i * 4;
    const n = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      bIdx.push(o + k, n + k, o + k2, o + k2, n + k, n + k2);
    }
  }
  const strapGeo = new THREE.BufferGeometry();
  strapGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  strapGeo.setIndex(bIdx);
  strapGeo.computeVertexNormals();
  const strap = new THREE.Mesh(strapGeo, bandMat);
  strap.castShadow = true;
  strap.receiveShadow = true;
  root.add(strap);

  // Subtle colored piping along the upper collar edge (classic Japanese uwabaki red/blue/pink trim!)
  const trimPts = [];
  for (let i = 0; i <= 24; i++) {
    const ang = Math.PI * 0.38 + (i / 24) * Math.PI * 1.24; // around heel & ankle sides
    const pt = outlineXZ(ang);
    const c = Math.cos(ang);
    const colH = 0.064 + Math.pow(Math.max(0, -c), 1.6) * 0.028;
    trimPts.push(new THREE.Vector3(pt.x * 0.88, 0.022 + colH, pt.z * 0.94));
  }
  const collarTrim = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts), 28, 0.0038, 6, false),
    bandMat
  );
  root.add(collarTrim);

  // Matching heel pull loop
  const heelLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.013, 0.004, 8, 14, Math.PI * 1.2),
    bandMat
  );
  heelLoop.position.set(0, 0.106, -L * 0.455);
  heelLoop.rotation.y = Math.PI / 2;
  heelLoop.rotation.z = -0.35;
  heelLoop.castShadow = true;
  root.add(heelLoop);

  // 6. Frothy Clinging 3D Soap Suds Clusters on the Shoe (dense small-medium micro-froth, NOT giant marbles!)
  const puffCount = 96;
  const puffGeo = new THREE.IcosahedronGeometry(0.0115, 2);
  const puffMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.92,
    clearcoatRoughness: 0.12,
    bumpMap: foamBumpMap,
    bumpScale: 0.005,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xd2f0ff)
  });
  const shoeFoamMesh = new THREE.InstancedMesh(puffGeo, puffMat, puffCount);

  const puffAnchors = [];
  const dObj = new THREE.Object3D();
  for (let i = 0; i < puffCount; i++) {
    const ang = (i * 2.39996) % (Math.PI * 2);
    const v = 0.18 + ((i * 0.61803) % 0.78);
    const pt = outlineXZ(ang);
    const c = Math.cos(ang);
    // Cluster densely on the toe dome, sides & along the strap!
    const isTop = i % 3 === 0 && c > -0.1;
    const x = isTop ? pt.x * (0.25 + (i % 5) * 0.13) : pt.x * (0.94 - v * 0.16);
    const z = isTop ? 0.02 + (i % 7) * 0.018 : pt.z * (0.94 - v * 0.10);
    const y = isTop ? 0.072 + Math.cos(x * 16) * 0.016 : 0.030 + v * 0.048;
    const baseScale = 0.45 + (i % 5) * 0.18;
    puffAnchors.push({ pos: new THREE.Vector3(x, y, z), scale: baseScale, level: 0 });
    dObj.position.set(x, y, z);
    dObj.scale.setScalar(0.0001);
    dObj.updateMatrix();
    shoeFoamMesh.setMatrixAt(i, dObj.matrix);
  }
  shoeFoamMesh.instanceMatrix.needsUpdate = true;
  root.add(shoeFoamMesh);

  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.20, 0.42),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.set(0, 0.06, 0);
  hitProxy.name = 'shoeHit';
  root.add(hitProxy);

  function setWetAppearance(wetAvg) {
    rubberMat.roughness = THREE.MathUtils.lerp(0.46, 0.10, wetAvg);
    toeCapMat.roughness = THREE.MathUtils.lerp(0.36, 0.08, wetAvg);
    bandMat.roughness = THREE.MathUtils.lerp(0.80, 0.30, wetAvg);
    const tint = THREE.MathUtils.lerp(1.0, 0.80, wetAvg);
    rubberMat.color.setRGB(0.96 * tint, 0.95 * tint, 0.92 * tint);
    toeCapMat.color.setRGB(0.97 * tint, 0.96 * tint, 0.94 * tint);
  }

  function setBandColor(hex) {
    bandMat.color.setHex(hex);
  }

  function updateShoeFoam(globalFoamBoost = 0) {
    for (let i = 0; i < puffCount; i++) {
      const p = puffAnchors[i];
      const s = Math.max(0, Math.min(1.25, p.level + globalFoamBoost));
      if (s < 0.02) {
        dObj.scale.setScalar(0.0001);
      } else {
        dObj.position.copy(p.pos);
        dObj.position.y += s * 0.005;
        dObj.scale.set(p.scale * s * 1.1, p.scale * s * 0.72, p.scale * s * 1.1);
      }
      dObj.updateMatrix();
      shoeFoamMesh.setMatrixAt(i, dObj.matrix);
    }
    shoeFoamMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    upperMesh: wallMesh,
    hitProxy,
    surface,
    puffAnchors,
    setWetAppearance,
    setBandColor,
    updateShoeFoam
  };
}

/**
 * Builds a sunlit glossy Japanese plastic household bucket (バケツ)
 * WITHOUT transmission occlusion bug, so the HUGE billowing 3D Foam Mountain (泡の山)
 * rises dramatically above the rim and spills over onto the wet concrete!
 */
export function buildBucket(foamBumpMap) {
  const group = new THREE.Group();

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.165, 0.0),
    new THREE.Vector2(0.175, 0.015),
    new THREE.Vector2(0.228, 0.315),
    new THREE.Vector2(0.245, 0.332),
    new THREE.Vector2(0.245, 0.345),
    new THREE.Vector2(0.226, 0.347),
    new THREE.Vector2(0.214, 0.328),
    new THREE.Vector2(0.164, 0.024),
    new THREE.Vector2(0.0, 0.022)
  ];
  const bucketGeo = new THREE.LatheGeometry(pts, 44);
  // Real glossy molded Japanese polypropylene bucket (opaque with realistic specular clearcoat & sky sheen!)
  const bucketMat = new THREE.MeshPhysicalMaterial({
    color: 0x56a8e2,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xbce6ff),
    side: THREE.DoubleSide
  });
  const bucketMesh = new THREE.Mesh(bucketGeo, bucketMat);
  bucketMesh.castShadow = true;
  bucketMesh.receiveShadow = true;
  bucketMesh.name = 'bucketBody';
  group.add(bucketMesh);

  for (const ry of [0.285, 0.305]) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(0.225 + (ry - 0.285) * 0.22, 0.004, 8, 36),
      bucketMat
    );
    rib.rotation.x = Math.PI / 2;
    rib.position.y = ry;
    group.add(rib);
  }

  // Stainless steel bail handle + molded white grip
  const bailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.236, 0.32, 0),
    new THREE.Vector3(-0.252, 0.26, 0.12),
    new THREE.Vector3(-0.15, 0.19, 0.255),
    new THREE.Vector3(0, 0.175, 0.29),
    new THREE.Vector3(0.15, 0.19, 0.255),
    new THREE.Vector3(0.252, 0.26, 0.12),
    new THREE.Vector3(0.236, 0.32, 0)
  ]);
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0xe8eff5,
    roughness: 0.16,
    metalness: 0.94
  });
  const bail = new THREE.Mesh(new THREE.TubeGeometry(bailCurve, 28, 0.0045, 8, false), wireMat);
  bail.castShadow = true;
  group.add(bail);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.095, 12),
    new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.32 })
  );
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0, 0.175, 0.29);
  grip.castShadow = true;
  group.add(grip);

  // Animated sunlit water surface with dancing underwater caustics & Fresnel sky reflection
  const waterGeo = new THREE.CircleGeometry(0.214, 36);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uRippleAmp: { value: 0.004 },
      uRippleCenter: { value: new THREE.Vector2(0, 0) },
      uSoapiness: { value: 0.0 },
      uMurkiness: { value: 0.0 },
      uSunDir: { value: new THREE.Vector3(0.58, 0.72, -0.38).normalize() }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uRippleAmp;
      uniform vec2 uRippleCenter;
      varying vec2 vPosXZ;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;

      void main() {
        vec3 p = position;
        vPosXZ = p.xz;
        float dist = length(p.xz - uRippleCenter);
        float ring = sin(dist * 46.0 - uTime * 11.0) * exp(-dist * 5.0) * uRippleAmp;
        float slosh = (sin(p.x * 16.0 + uTime * 3.8) + cos(p.z * 18.0 - uTime * 3.2)) * (0.002 + uRippleAmp * 0.45);
        p.y += ring + slosh;

        float dx = cos(dist * 46.0 - uTime * 11.0) * (p.x - uRippleCenter.x) * 14.0 * uRippleAmp
                 + cos(p.x * 16.0 + uTime * 3.8) * 0.12;
        float dz = cos(dist * 46.0 - uTime * 11.0) * (p.z - uRippleCenter.y) * 14.0 * uRippleAmp
                 - sin(p.z * 18.0 - uTime * 3.2) * 0.12;
        vec3 n = normalize(vec3(-dx, 1.0, -dz));

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSoapiness;
      uniform float uMurkiness;
      uniform vec3 uSunDir;
      varying vec2 vPosXZ;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(uSunDir + V);

        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
        float spec = pow(max(dot(N, H), 0.0), 110.0);

        float c1 = sin(vPosXZ.x * 38.0 + uTime * 3.2) * cos(vPosXZ.y * 36.0 - uTime * 2.6);
        float c2 = sin((vPosXZ.x + vPosXZ.y) * 30.0 - uTime * 4.1);
        float caustic = smoothstep(0.42, 0.94, (c1 + c2) * 0.5 + 0.5) * (1.0 - uSoapiness * 0.72);

        vec3 clearWater = vec3(0.20, 0.60, 0.88) + vec3(0.38, 0.50, 0.55) * caustic;
        vec3 soapyWater = vec3(0.88, 0.95, 0.99);
        vec3 col = mix(clearWater, soapyWater, clamp(uSoapiness, 0.0, 1.0));
        col = mix(col, vec3(0.64, 0.60, 0.52), clamp(uMurkiness * 0.55, 0.0, 0.45));

        vec3 skyRefl = vec3(0.68, 0.88, 1.0);
        col = mix(col, skyRefl, fresnel * 0.68);
        col += vec3(1.0, 0.98, 0.92) * spec * 1.65;

        float alpha = mix(0.78, 0.96, clamp(uSoapiness + fresnel * 0.35, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.278;
  waterMesh.name = 'bucketWater';
  group.add(waterMesh);

  // 3D Billowing Mountain of Creamy Soap Foam (泡の山 — 320 multi-scale organic froth clusters, fast geometry!)
  const foamCount = 320;
  const foamGeo = new THREE.IcosahedronGeometry(0.026, 1);
  const foamMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.16,
    bumpMap: foamBumpMap,
    bumpScale: 0.0095,
    sheen: 0.68,
    sheenRoughness: 0.24,
    sheenColor: new THREE.Color(0xc2ecff)
  });
  const foamMesh = new THREE.InstancedMesh(foamGeo, foamMat, foamCount);
  foamMesh.castShadow = true;
  foamMesh.receiveShadow = true;
  foamMesh.frustumCulled = false;

  const foamNodes = [];
  const d = new THREE.Object3D();
  for (let i = 0; i < foamCount; i++) {
    const isOverflow = i >= 260;
    const golden = i * 2.3999632;
    let r, yBase, scale, threshold;

    if (!isOverflow) {
      const frac = i / 260;
      r = Math.sqrt(frac) * 0.222;
      const dome = Math.pow(Math.cos((r / 0.232) * Math.PI * 0.5), 0.78);
      // Organic billowy mound rising naturally over the rim (wide & frothy, not an ice-cream cone!)
      yBase = 0.285 + dome * 0.125 * (0.64 + (i % 7) * 0.085);
      scale = (0.48 + (1 - frac * 0.35) * 0.92) * (0.72 + (i % 6) * 0.12);
      threshold = frac * 0.86;
    } else {
      const k = (i - 260) / 60;
      const dropPhase = (i % 4) / 3;
      r = 0.232 + dropPhase * 0.105;
      yBase = dropPhase < 0.42 ? 0.335 - dropPhase * 0.16 : 0.022 + (1 - dropPhase) * 0.12;
      scale = 0.52 + (i % 5) * 0.22;
      threshold = 0.84 + k * 0.56;
    }

    foamNodes.push({
      ang: golden,
      r,
      yBase,
      scale,
      threshold,
      isOverflow,
      phase: (i * 1.37) % (Math.PI * 2)
    });
    d.position.set(0, -10, 0);
    d.scale.setScalar(0.0001);
    d.updateMatrix();
    foamMesh.setMatrixAt(i, d.matrix);
  }
  foamMesh.instanceMatrix.needsUpdate = true;
  group.add(foamMesh);

  function updateFoamMound(foamLevel, swirlAngle, time) {
    for (let i = 0; i < foamCount; i++) {
      const n = foamNodes[i];
      const grow = THREE.MathUtils.clamp((foamLevel - n.threshold) * 2.6, 0, 1);
      if (grow <= 0.005) {
        d.position.set(0, -10, 0);
        d.scale.setScalar(0.0001);
      } else {
        const ang = n.isOverflow ? n.ang : n.ang + swirlAngle * (1.0 - n.r * 2.0);
        const bob = Math.sin(time * 2.4 + n.phase) * 0.0045 * grow;
        const lift = n.isOverflow ? 0 : Math.min(0.11, Math.max(0, foamLevel - 0.30) * 0.11) * (1 - n.r / 0.25);
        d.position.set(Math.cos(ang) * n.r, n.yBase + lift + bob, Math.sin(ang) * n.r);
        const s = n.scale * grow * (0.94 + 0.06 * Math.sin(time * 3.1 + n.phase));
        d.scale.set(s * 1.12, s * 0.85, s * 1.12);
        d.rotation.set(n.phase * 0.3, ang, 0);
      }
      d.updateMatrix();
      foamMesh.setMatrixAt(i, d.matrix);
    }
    foamMesh.instanceMatrix.needsUpdate = true;
  }

  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 0.46, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = 0.24;
  hitProxy.name = 'bucketHit';
  group.add(hitProxy);

  return {
    group,
    waterMesh,
    waterMat,
    foamMesh,
    hitProxy,
    updateFoamMound
  };
}

/**
 * Classic Japanese laundry soap bar (smooth rounded emerald-cream waxiness, ZERO text).
 */
export function buildSoapBar() {
  const group = new THREE.Group();

  const barGeo = new THREE.BoxGeometry(0.102, 0.038, 0.062, 8, 5, 5);
  const pos = barGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / 0.051;
    const ny = y / 0.019;
    const nz = z / 0.031;
    const mag = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const pull = mag > 1.0 ? 1.0 - (mag - 1.0) * 0.20 : 1.0;
    pos.setXYZ(i, x * pull, y * pull, z * pull);
  }
  barGeo.computeVertexNormals();

  const soapMat = new THREE.MeshPhysicalMaterial({
    color: 0x90dcb0,
    roughness: 0.20,
    metalness: 0.0,
    clearcoat: 0.90,
    clearcoatRoughness: 0.14,
    sheen: 0.42,
    sheenColor: new THREE.Color(0xe6fff0)
  });

  const bar = new THREE.Mesh(barGeo, soapMat);
  bar.castShadow = true;
  bar.receiveShadow = true;
  bar.name = 'soapBar';
  group.add(bar);

  return { group, bar };
}

/**
 * Crisp, ergonomic beechwood Japanese Uwabaki Scrub Brush (うわばきブラシ)
 * built from a clean beveled extruded wood block (no lumpy pinched tubes!) + dense angled bristles!
 */
export function buildScrubBrush(woodTextures) {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTextures.map,
    bumpMap: woodTextures.bumpMap,
    bumpScale: 0.004,
    roughness: 0.52,
    metalness: 0.02
  });

  // Clean smooth paddle-shaped ergonomic wooden handle outline in XZ
  const shape = new THREE.Shape();
  shape.moveTo(-0.014, -0.14);
  shape.quadraticCurveTo(0, -0.155, 0.014, -0.14);
  shape.lineTo(0.017, -0.02);
  shape.quadraticCurveTo(0.028, 0.02, 0.027, 0.08);
  shape.quadraticCurveTo(0.025, 0.125, 0, 0.13);
  shape.quadraticCurveTo(-0.025, 0.125, -0.027, 0.08);
  shape.quadraticCurveTo(-0.028, 0.02, -0.017, -0.02);
  shape.closePath();

  const handleGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3
  });
  handleGeo.rotateX(Math.PI / 2);
  handleGeo.translate(0, 0.007, 0);

  const handleMesh = new THREE.Mesh(handleGeo, woodMat);
  handleMesh.castShadow = true;
  handleMesh.receiveShadow = true;
  group.add(handleMesh);

  // Dense translucent white nylon bristle tufts
  const bristleMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8fc,
    roughness: 0.28,
    metalness: 0.04
  });
  const tuftGeo = new THREE.CylinderGeometry(0.0024, 0.0038, 0.032, 6);
  const rows = 9;
  const cols = 5;
  const tufts = new THREE.InstancedMesh(tuftGeo, bristleMat, rows * cols);
  tufts.castShadow = true;

  const d = new THREE.Object3D();
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rz = 0.025 + (r / (rows - 1)) * 0.092;
      const rx = ((c / (cols - 1)) - 0.5) * 0.038;
      d.position.set(rx, -0.022, rz);
      d.rotation.set((r / (rows - 1) - 0.45) * 0.22, 0, -rx * 4.0);
      d.updateMatrix();
      tufts.setMatrixAt(idx++, d.matrix);
    }
  }
  tufts.instanceMatrix.needsUpdate = true;
  group.add(tufts);

  // Frothy lather clinging to brush bristles
  const brushFoam = new THREE.Group();
  const fMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.22, clearcoat: 0.88 });
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.013 + (i % 3) * 0.004, 2), fMat);
    b.position.set(((i % 3) - 1) * 0.016, -0.032 - (i % 2) * 0.005, 0.04 + Math.floor(i / 3) * 0.028);
    brushFoam.add(b);
  }
  brushFoam.visible = false;
  group.add(brushFoam);

  return { group, brushFoam };
}

/**
 * Seamless, organically sculpted foreground child hand + wrist + tapered forearm + soft summer T-shirt sleeve!
 * Built with a continuous organic loft from forearm -> slender wrist -> contoured metacarpal palm (NO doll cylinder seam!).
 */
export function buildChildHand(side = 'right', skinTextures) {
  const mirror = side === 'left' ? -1 : 1;
  const root = new THREE.Group();

  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTextures.map,
    bumpMap: skinTextures.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.34,
    sheen: 0.45,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffb499)
  });

  const nailMat = new THREE.MeshStandardMaterial({
    color: 0xf7cfc4,
    roughness: 0.20,
    metalness: 0.02
  });

  // 1. Continuous Organic Loft: Forearm -> Slender Wrist -> Contoured Back-of-Hand/Palm!
  const rings = [
    // [z, halfW, halfH, yOffset]
    [0.40, 0.044, 0.041, -0.012], // upper forearm near sleeve
    [0.28, 0.038, 0.035, -0.010], // mid forearm
    [0.16, 0.032, 0.028, -0.006], // tapering wrist
    [0.085, 0.031, 0.023, -0.002], // wrist crease
    [0.040, 0.042, 0.022, 0.001], // heel of palm
    [-0.005, 0.049, 0.021, 0.002], // wide metacarpal palm
    [-0.046, 0.047, 0.017, 0.001], // knuckle line
    [-0.056, 0.032, 0.011, 0.000]  // rounded cap between fingers
  ];
  const segR = 24;
  const lPos = [];
  const lUV = [];
  const lIdx = [];

  for (let ir = 0; ir < rings.length; ir++) {
    const [z, hw, hh, yo] = rings[ir];
    const v = ir / (rings.length - 1);
    for (let is = 0; is <= segR; is++) {
      const u = is / segR;
      const ang = u * Math.PI * 2;
      // Slightly flatter palm/back at the hand, rounder along forearm
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const flat = ir >= 4 ? 0.84 : 0.96;
      const x = Math.sign(c) * Math.pow(Math.abs(c), flat) * hw;
      const y = yo + Math.sign(s) * Math.pow(Math.abs(s), flat) * hh;
      lPos.push(x, y, z);
      lUV.push(u, v);
    }
  }
  for (let ir = 0; ir < rings.length - 1; ir++) {
    for (let is = 0; is < segR; is++) {
      const a = ir * (segR + 1) + is;
      const b = a + 1;
      const c = (ir + 1) * (segR + 1) + is;
      const d = c + 1;
      // Outward-facing counter-clockwise winding!
      lIdx.push(a, c, b, b, c, d);
    }
  }
  const handBodyGeo = new THREE.BufferGeometry();
  handBodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
  handBodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lUV, 2));
  handBodyGeo.setIndex(lIdx);
  handBodyGeo.computeVertexNormals();

  const handBody = new THREE.Mesh(handBodyGeo, skinMat);
  handBody.castShadow = true;
  handBody.receiveShadow = true;
  root.add(handBody);

  // Smooth rounded knuckle bridge cap closing the front edge seamlessly
  const knuckleCap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), skinMat);
  knuckleCap.scale.set(1.22, 0.42, 0.46);
  knuckleCap.position.set(0, 0.001, -0.048);
  root.add(knuckleCap);

  // Soft sunlit cotton summer T-shirt cuff at the upper forearm
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0xf07d72,
    roughness: 0.90
  });
  const sleeveGeo = new THREE.CylinderGeometry(0.052, 0.062, 0.16, 20, 1, true);
  sleeveGeo.rotateX(Math.PI / 2);
  const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeve.position.set(0, -0.012, 0.45);
  sleeve.castShadow = true;
  root.add(sleeve);

  // Subtle folded sleeve cuff ring
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 8, 20), sleeveMat);
  cuff.position.set(0, -0.012, 0.372);
  root.add(cuff);

  // Subtle anatomical thenar pad tucked smoothly underneath the palm (NEVER poking out the top!)
  const thumbPad = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), skinMat);
  thumbPad.scale.set(0.92, 0.62, 1.32);
  thumbPad.position.set(-mirror * 0.030, -0.012, 0.012);
  root.add(thumbPad);

  // Articulated 2-segment tapered fingers with knuckle blends & natural fingernails
  const fingers = [];
  const fingerSpecs = [
    { x: -mirror * 0.032, z: -0.046, len: 0.062, rad: 0.0102, splay: mirror * 0.08 },
    { x: -mirror * 0.010, z: -0.051, len: 0.068, rad: 0.0106, splay: mirror * 0.02 },
    { x: mirror * 0.013, z: -0.048, len: 0.063, rad: 0.0100, splay: -mirror * 0.04 },
    { x: mirror * 0.034, z: -0.039, len: 0.050, rad: 0.0088, splay: -mirror * 0.10 }
  ];

  for (const spec of fingerSpecs) {
    const basePivot = new THREE.Group();
    basePivot.position.set(spec.x, 0.002, spec.z);
    basePivot.rotation.y = spec.splay;

    const seg1Len = spec.len * 0.54;
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(spec.rad, seg1Len * 0.62, 6, 10), skinMat);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.z = -seg1Len * 0.48;
    seg1.castShadow = true;
    basePivot.add(seg1);

    const midPivot = new THREE.Group();
    midPivot.position.set(0, 0, -seg1Len);

    const seg2Len = spec.len * 0.48;
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(spec.rad * 0.86, seg2Len * 0.54, 6, 10), skinMat);
    seg2.rotation.x = Math.PI / 2;
    seg2.position.z = -seg2Len * 0.48;
    seg2.castShadow = true;
    midPivot.add(seg2);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(spec.rad * 0.72, 8, 6), nailMat);
    nail.scale.set(0.92, 0.20, 1.18);
    nail.position.set(0, spec.rad * 0.72, -seg2Len * 0.76);
    midPivot.add(nail);

    basePivot.add(midPivot);
    root.add(basePivot);
    fingers.push({ basePivot, midPivot });
  }

  // Articulated Thumb
  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-mirror * 0.045, -0.004, 0.006);
  thumbPivot.rotation.set(0.14, mirror * 0.56, mirror * 0.22);

  const thumbSeg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0118, 0.024, 6, 10), skinMat);
  thumbSeg1.rotation.x = Math.PI / 2;
  thumbSeg1.position.z = -0.020;
  thumbSeg1.castShadow = true;
  thumbPivot.add(thumbSeg1);

  const thumbTipPivot = new THREE.Group();
  thumbTipPivot.position.set(0, 0, -0.036);
  const thumbSeg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0102, 0.016, 6, 10), skinMat);
  thumbSeg2.rotation.x = Math.PI / 2;
  thumbSeg2.position.z = -0.014;
  thumbSeg2.castShadow = true;
  thumbTipPivot.add(thumbSeg2);

  const thumbNail = new THREE.Mesh(new THREE.SphereGeometry(0.0082, 8, 6), nailMat);
  thumbNail.scale.set(0.92, 0.20, 1.18);
  thumbNail.position.set(0, 0.0078, -0.020);
  thumbTipPivot.add(thumbNail);

  thumbPivot.add(thumbTipPivot);
  root.add(thumbPivot);

  function setPose(curl = 0.25, thumbCurl = 0.2, wetness = 0.0) {
    for (let i = 0; i < fingers.length; i++) {
      const f = fingers[i];
      const extra = i * 0.05;
      f.basePivot.rotation.x = -(curl * 0.85 + extra * curl);
      f.midPivot.rotation.x = -(curl * 0.92);
    }
    thumbPivot.rotation.x = 0.14 - thumbCurl * 0.45;
    thumbTipPivot.rotation.x = -thumbCurl * 0.70;
    skinMat.clearcoat = THREE.MathUtils.lerp(0.14, 0.72, wetness);
    skinMat.roughness = THREE.MathUtils.lerp(0.50, 0.26, wetness);
  }

  setPose(0.28, 0.25, 0.15);

  return {
    root,
    setPose
  };
}
