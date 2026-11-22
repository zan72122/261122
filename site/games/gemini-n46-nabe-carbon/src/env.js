import * as THREE from '../lib/three.module.js';

// Builds HDR PMREM environment, rainy winter night bokeh window, dining table & lighting
export function createDiningEnvironment(scene, renderer, textures) {
  // 1. Procedural HDR PMREM Environment Map for realistic wet specular highlights
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x120d0a);

  // Warm wood room shell in probe
  const roomGeo = new THREE.SphereGeometry(10, 32, 24);
  const roomMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true,
  });
  const posAttr = roomGeo.attributes.position;
  const cols = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const ny = y / 10;
    // Warm amber ceiling/table bounce vs cool night window on -Z
    let r = 0.24, g = 0.15, b = 0.09;
    if (ny > 0.2) {
      r = 0.42; g = 0.27; b = 0.15;
    } else if (ny < -0.2) {
      r = 0.28; g = 0.17; b = 0.10;
    }
    if (z < -3.0 && Math.abs(x) < 7.0 && ny > -0.25 && ny < 0.65) {
      // Cool winter night window wash
      r = 0.16; g = 0.28; b = 0.52;
    }
    cols[i * 3] = r;
    cols[i * 3 + 1] = g;
    cols[i * 3 + 2] = b;
  }
  roomGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Bright HDR Overhead Pendant Lamp disc (gives crisp wet highlights on tofu/mushrooms/broth/ceramic!)
  const bulbMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(11.0, 8.2, 4.8), side: THREE.DoubleSide })
  );
  bulbMesh.position.set(0, 8.2, 1.2);
  bulbMesh.rotation.x = Math.PI / 2;
  envScene.add(bulbMesh);

  // Soft warm ring halo around pendant
  const haloMesh = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 3.6, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.9), side: THREE.DoubleSide })
  );
  haloMesh.position.set(0, 8.15, 1.2);
  haloMesh.rotation.x = Math.PI / 2;
  envScene.add(haloMesh);

  // HDR Bokeh discs on the -Z night window side for realistic multi-colored rim glints
  const bokehPalette = [
    new THREE.Color(5.5, 3.2, 1.1),
    new THREE.Color(5.0, 1.1, 0.8),
    new THREE.Color(1.6, 3.2, 5.8),
    new THREE.Color(6.2, 4.6, 2.0),
  ];
  for (let i = 0; i < 18; i++) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.28 + (i % 4) * 0.14, 16),
      new THREE.MeshBasicMaterial({ color: bokehPalette[i % bokehPalette.length] })
    );
    disc.position.set(((i * 37) % 100 - 50) * 0.12, 0.4 + ((i * 53) % 100) * 0.045, -8.8);
    envScene.add(disc);
  }

  const envRT = pmrem.fromScene(envScene, 0.025);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.95;
  pmrem.dispose();

  // 2. Scene Lights
  const lights = {};

  // Warm interior ambient hemisphere (toned for cinematic chiaroscuro depth)
  const hemi = new THREE.HemisphereLight(0xffe0b8, 0x26160c, 0.38);
  scene.add(hemi);

  // Main Overhead Dining Pendant SpotLight (casts soft shadows & sculpts faces/food from above!)
  const pendantSpot = new THREE.SpotLight(0xffddb4, 5.2, 5.5, Math.PI * 0.45, 0.68, 1.35);
  pendantSpot.position.set(0.08, 1.48, 0.24);
  pendantSpot.target.position.set(0, 0.06, -0.06);
  pendantSpot.castShadow = true;
  pendantSpot.shadow.mapSize.set(1024, 1024);
  pendantSpot.shadow.camera.near = 0.4;
  pendantSpot.shadow.camera.far = 3.2;
  pendantSpot.shadow.bias = -0.0006;
  pendantSpot.shadow.normalBias = 0.012;
  scene.add(pendantSpot);
  scene.add(pendantSpot.target);
  lights.pendantSpot = pendantSpot;

  // Subtle soft bounce fill so faces keep rich 3D nose/cheek/jaw shadow modeling!
  const faceWarmLight = new THREE.PointLight(0xffcfa0, 0.48, 3.0, 1.5);
  faceWarmLight.position.set(-0.22, 0.72, 0.45);
  scene.add(faceWarmLight);
  lights.faceWarmLight = faceWarmLight;

  // Cool Rainy Night Window Rim Light from behind the family
  const windowRim = new THREE.DirectionalLight(0x74a2dc, 1.15);
  windowRim.position.set(-0.2, 0.95, -1.5);
  windowRim.target.position.set(0, 0.2, 0.1);
  scene.add(windowRim);
  scene.add(windowRim.target);
  lights.windowRim = windowRim;

  // Warm Broth & Stove Upward Bounce Light right at the pot
  const potGlow = new THREE.PointLight(0xff9f4a, 0.95, 1.4, 1.6);
  potGlow.position.set(0, 0.24, 0.08);
  scene.add(potGlow);
  lights.potGlow = potGlow;

  // 3. Solid Walnut/Keyaki Dining Table (rounded live-edge slab)
  const tableGroup = new THREE.Group();
  const tableW = 1.76, tableD = 1.14, tableH = 0.052;
  const shape = new THREE.Shape();
  const hw = tableW / 2, hd = tableD / 2, rad = 0.16;
  shape.moveTo(-hw + rad, -hd);
  shape.lineTo(hw - rad, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + rad);
  shape.lineTo(hw, hd - rad);
  shape.quadraticCurveTo(hw, hd, hw - rad, hd);
  shape.lineTo(-hw + rad, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - rad);
  shape.lineTo(-hw, -hd + rad);
  shape.quadraticCurveTo(-hw, -hd, -hw + rad, -hd);

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: tableH,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  extrudeGeo.rotateX(Math.PI / 2);
  // Normalize UVs across tabletop so 1024px wood grain maps cleanly
  const uv = extrudeGeo.attributes.uv;
  const p = extrudeGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getX(i) + hw) / tableW, (p.getZ(i) + hd) / tableD);
  }
  const tableMat = new THREE.MeshPhysicalMaterial({
    map: textures.woodMap,
    normalMap: textures.woodNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: textures.woodRough,
    roughness: 0.85,
    clearcoat: 0.42,
    clearcoatRoughness: 0.24,
  });
  const tableMesh = new THREE.Mesh(extrudeGeo, tableMat);
  tableMesh.position.y = -0.012;
  tableMesh.receiveShadow = true;
  tableGroup.add(tableMesh);

  // Subtle dark woven runner mat under the center stove/pot
  const matGeo = new THREE.CylinderGeometry(0.245, 0.25, 0.005, 40);
  const matMesh = new THREE.Mesh(
    matGeo,
    new THREE.MeshStandardMaterial({
      map: textures.bambooMap,
      normalMap: textures.bambooNormal,
      color: 0x5c422c,
      roughness: 0.85,
    })
  );
  matMesh.position.set(0, 0.0025, 0.08);
  matMesh.receiveShadow = true;
  tableGroup.add(matMesh);
  scene.add(tableGroup);

  // 4. Winter Rainy Night Window with Bokeh City Lights & Interactive Condensation Wipe!
  // Interactive wipe mask (64x64 DataTexture: 0 = foggy, 255 = wiped clear)
  const wipeSize = 64;
  const wipeData = new Uint8Array(wipeSize * wipeSize * 4);
  const wipeTex = new THREE.DataTexture(wipeData, wipeSize, wipeSize, THREE.RGBAFormat);
  wipeTex.minFilter = THREE.LinearFilter;
  wipeTex.magFilter = THREE.LinearFilter;
  wipeTex.needsUpdate = true;

  const windowUniforms = {
    uTime: { value: 0 },
    uSnowAmount: { value: 0.0 },
    uWarmthBoost: { value: 0.0 },
    uWipeTex: { value: wipeTex },
  };

  const windowGlassMat = new THREE.ShaderMaterial({
    uniforms: windowUniforms,
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
      uniform float uSnowAmount;
      uniform float uWarmthBoost;
      uniform sampler2D uWipeTex;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      vec3 hash23(vec2 p) {
        vec3 a = fract(p.xyx * vec3(123.34, 234.34, 345.65));
        a += dot(a, a + 34.45);
        return fract(vec3(a.x * a.y, a.y * a.z, a.z * a.x));
      }

      // Out-of-focus night street & multi-colored bokeh city lights
      vec3 sampleNightBokeh(vec2 uv, float blurExtra) {
        // Deep winter midnight-indigo sky to wet asphalt street gradient
        vec3 col = mix(vec3(0.022, 0.042, 0.088), vec3(0.008, 0.016, 0.040), smoothstep(0.0, 0.95, uv.y));
        // Distant misty city horizon glow
        float horizon = exp(-pow((uv.y - 0.28) * 4.8, 2.0));
        col += vec3(0.08, 0.09, 0.13) * horizon;

        // Wet street vertical shimmer streaks in lower third
        if (uv.y < 0.34) {
          float s = sin(uv.x * 62.0) * 0.5 + 0.5;
          float s2 = sin(uv.x * 145.0 + 1.4) * 0.5 + 0.5;
          float wet = (0.34 - uv.y) * 2.2;
          col += vec3(0.18, 0.11, 0.05) * pow(s * s2, 3.2) * wet;
        }

        // Dark silhouette of distant winter trees / neighboring eaves
        float roof = step(uv.y, 0.20 + 0.04 * sin(uv.x * 9.0) + 0.02 * sin(uv.x * 27.0));
        col *= mix(1.0, 0.58, roof * 0.5);

        // 44 layered realistic optical bokeh circles (smaller, airy, golden/cream/cyan/ruby balance!)
        vec2 aspectUv = vec2(uv.x * 2.1, uv.y);
        for (int i = 0; i < 44; i++) {
          float fi = float(i);
          vec3 rnd = hash23(vec2(fi * 1.37 + 0.4, fi * 7.91 + 1.1));
          vec2 bPos = vec2(rnd.x * 2.1, 0.12 + rnd.y * 0.72);

          // Slowly moving traffic lights on the lower street (i < 10)
          if (i < 10) {
            float dir = (mod(fi, 2.0) < 0.5) ? 1.0 : -1.0;
            bPos.x = mod(rnd.x * 2.1 + uTime * (0.024 + rnd.z * 0.022) * dir + 4.2, 2.3) - 0.1;
            bPos.y = 0.14 + rnd.y * 0.15;
          }

          float rad = (0.016 + pow(rnd.z, 1.6) * 0.044) * (1.0 + blurExtra * 0.35);
          float d = length(aspectUv - bPos) / rad;
          if (d < 1.12) {
            // Optical bokeh disc with soft luminous center & delicate spherical-aberration ring
            float disc = smoothstep(1.05, 0.72, d);
            float rim = smoothstep(0.66, 0.94, d) * smoothstep(1.08, 0.94, d);
            float twinkle = 0.68 + 0.32 * sin(uTime * (0.8 + rnd.x * 1.6) + fi);
            float intensity = (disc * 0.65 + rim * 0.55) * twinkle;

            vec3 bCol;
            float m = mod(fi, 7.0);
            if (m < 2.0) bCol = vec3(1.0, 0.68, 0.28);       // Warm sodium streetlamp
            else if (m < 4.0) bCol = vec3(1.0, 0.88, 0.62);  // Cozy apartment tungsten
            else if (m < 5.0) bCol = vec3(0.42, 0.76, 1.0);  // Cool winter station/street LED
            else if (m < 6.0) bCol = vec3(0.95, 0.24, 0.18); // Subtle car taillight
            else bCol = vec3(0.95, 0.52, 0.22);              // Izakaya warm lantern

            col += bCol * intensity * (0.78 + uWarmthBoost * 0.24);
          }
        }

        // Soft drifting winter snow bokeh in the finale stage
        if (uSnowAmount > 0.01) {
          for (int s = 0; s < 18; s++) {
            float fs = float(s);
            vec3 sr = hash23(vec2(fs * 5.1, 19.3));
            vec2 sp = vec2(
              mod(sr.x * 2.1 + sin(uTime * 0.6 + fs) * 0.08, 2.1),
              mod(1.1 - uTime * (0.06 + sr.y * 0.05) + sr.z * 1.1, 1.15)
            );
            float sd = length(aspectUv - sp) / (0.018 + sr.z * 0.022);
            float flake = smoothstep(1.0, 0.1, sd);
            col += vec3(0.78, 0.86, 1.0) * flake * 0.42 * uSnowAmount;
          }
        }

        return col;
      }

      // Procedural trickling raindrop layer returning vec3(offset.xy, trailMask)
      vec4 rainLayer(vec2 uv, float t, float scale) {
        vec2 aspect = vec2(2.6, 1.0);
        vec2 st = uv * aspect * scale;
        vec2 id = floor(st);
        st.y += t * 0.22;
        float colShift = hash21(vec2(id.x, 0.0));
        st.y += colShift * 6.28;
        id = floor(st);
        vec3 n = hash23(id);
        vec2 gv = fract(st) - 0.5;

        // Spasmodic gravity trickle + gentle meander
        float phase = t * (0.85 + n.z * 0.55) + n.x * 6.2831;
        float y = -sin(phase + sin(phase + sin(phase) * 0.55)) * 0.41;
        float x = (n.y - 0.5) * 0.56;
        x += (0.35 - abs(x)) * sin(3.0 * uv.y * scale + n.x * 10.0) * 0.25;

        vec2 dropPos = (gv - vec2(x, y)) / vec2(1.0, 1.35);
        float d = length(dropPos);
        float mainDrop = smoothstep(0.11, 0.02, d);

        // Trailing micro-beads left behind the falling drop
        vec2 trailPos = (gv - vec2(x, t * 0.22)) / vec2(1.0, 2.0);
        trailPos.y = (fract(trailPos.y * 7.0) - 0.5) / 7.0;
        float td = length(trailPos);
        float droplets = smoothstep(0.055, 0.01, td) * smoothstep(-0.04, 0.04, gv.y - y) * smoothstep(0.46, y, gv.y);

        // Wet condensation-clearing wake above drop
        float trailWake = smoothstep(0.10, 0.01, abs(gv.x - x)) * smoothstep(-0.02, 0.05, gv.y - y) * smoothstep(0.49, y, gv.y);

        vec2 normalOff = dropPos * mainDrop * 2.6 + trailPos * droplets * 1.6;
        return vec4(normalOff, max(mainDrop, droplets), max(mainDrop, trailWake));
      }

      void main() {
        float t = uTime;

        // Delicate millimeter-scale trickling raindrops & fine wet streaks (photorealistic scale!)
        vec4 r1 = rainLayer(vUv, t * 0.95, 13.5);
        vec4 r2 = rainLayer(vUv * 1.41 + vec2(0.31, 0.17), t * 0.72 + 11.0, 22.0);
        vec4 r3 = rainLayer(vUv * 2.15 + vec2(0.67, 0.43), t * 0.52 + 23.0, 32.0);

        // Fine static micro-mist beads clinging to cold glass
        vec2 beadSt = vUv * vec2(150.0, 72.0);
        vec2 beadId = floor(beadSt);
        vec3 bn = hash23(beadId);
        vec2 bgv = fract(beadSt) - 0.5 - (bn.xy - 0.5) * 0.45;
        float bd = length(bgv);
        float staticBead = smoothstep(0.18, 0.03, bd) * step(0.52, bn.z);

        vec2 refractOff = r1.xy * 0.55 + r2.xy * 0.38 + r3.xy * 0.24 + bgv * staticBead * 0.18;
        float wetClear = clamp(r1.w + r2.w * 0.85 + r3.w * 0.65, 0.0, 1.0);
        float dropMask = clamp(r1.z + r2.z + r3.z + staticBead * 0.45, 0.0, 1.0);

        // Condensation mist (cleared by raindrops & player finger wipe!)
        float wiped = texture2D(uWipeTex, vUv).r;
        float edgeFog = smoothstep(0.55, 0.02, vUv.y) * 0.52 + pow(abs(vUv.x - 0.5) * 2.0, 2.2) * 0.32 + 0.18;
        float fogAmount = clamp(edgeFog * (1.0 - wetClear * 0.92) * (1.0 - wiped * 0.95), 0.0, 0.72);

        // Optical refraction of night bokeh inside droplets (pure glass-water look, zero cartoon outlines!)
        vec2 sampleUv = clamp(vUv + refractOff * 0.48, 0.02, 0.98);
        vec3 sceneCol = sampleNightBokeh(sampleUv, fogAmount * 1.35 * (1.0 - dropMask));
        if (dropMask > 0.04) {
          vec3 refractedBright = sampleNightBokeh(clamp(vUv - refractOff * 0.95, 0.03, 0.97), 0.0);
          sceneCol = mix(sceneCol, refractedBright * 1.55 + vec3(0.03, 0.05, 0.09), dropMask * 0.82);
        }

        // Soft condensation scatter on fogged glass
        vec3 mistTint = mix(vec3(0.07, 0.11, 0.18), vec3(0.17, 0.13, 0.10), 0.35);
        sceneCol = mix(sceneCol, mistTint + sceneCol * 0.72, fogAmount * 0.45);

        // Pinprick warm pendant glint on curved top of each water droplet + glistening bokeh-lit rain streaks!
        float dropSpec = pow(max(0.0, dot(normalize(vec3(refractOff * 5.2, 1.0)), normalize(vec3(0.12, 0.75, 0.65)))), 22.0);
        sceneCol += vec3(1.0, 0.90, 0.72) * dropSpec * dropMask * 1.45;
        sceneCol += (vec3(0.28, 0.40, 0.60) + sceneCol * 0.55) * wetClear * (1.0 - dropMask) * 0.24;

        // Subtle warm indoor reflection near edges of glass pane
        float indoorRefl = smoothstep(0.1, 0.9, vUv.y) * 0.045;
        sceneCol += vec3(0.95, 0.72, 0.45) * indoorRefl * (1.0 - dropMask * 0.5);

        gl_FragColor = vec4(sceneCol, 1.0);
      }
    `,
  });

  const windowGroup = new THREE.Group();
  windowGroup.position.set(0, 0.56, -0.96);

  const winW = 2.65, winH = 1.38;
  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), windowGlassMat);
  glassMesh.name = 'rainyWindowGlass';
  windowGroup.add(glassMesh);

  // Warm dark cedar wooden window frame, sill, and vertical mullions
  const frameWoodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    normalMap: textures.woodNormal,
    color: 0x563822,
    roughness: 0.58,
  });

  const borderThick = 0.055, borderDepth = 0.08;
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(winW + borderThick * 2, borderThick, borderDepth), frameWoodMat);
  topBar.position.set(0, winH / 2 + borderThick / 2, 0.02);
  const sillBar = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.18, 0.045, 0.14), frameWoodMat);
  sillBar.position.set(0, -winH / 2 - 0.02, 0.04);
  const leftBar = new THREE.Mesh(new THREE.BoxGeometry(borderThick, winH, borderDepth), frameWoodMat);
  leftBar.position.set(-winW / 2 - borderThick / 2, 0, 0.02);
  const rightBar = new THREE.Mesh(new THREE.BoxGeometry(borderThick, winH, borderDepth), frameWoodMat);
  rightBar.position.set(winW / 2 + borderThick / 2, 0, 0.02);
  windowGroup.add(topBar, sillBar, leftBar, rightBar);

  // Elegant wooden sliding-pane mullions (2 main vertical dividers + subtle lower transom)
  [-0.58, 0.58].forEach((mx) => {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.028, winH, 0.035), frameWoodMat);
    mullion.position.set(mx, 0, 0.016);
    windowGroup.add(mullion);
  });
  const transom = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.022, 0.03), frameWoodMat);
  transom.position.set(0, -0.34, 0.015);
  windowGroup.add(transom);

  // Cozy warm plaster/wood dining room wall surrounding the window so wide look-around never sees void
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3b2c22,
    roughness: 0.9,
  });
  const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.9, 0.06), wallMat);
  lowerWall.position.set(0, -winH / 2 - 0.46, -0.02);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 0.06), wallMat);
  leftWall.position.set(-winW / 2 - 0.72, 0, -0.02);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 0.06), wallMat);
  rightWall.position.set(winW / 2 + 0.72, 0, -0.02);
  const upperWall = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.9, 0.06), wallMat);
  upperWall.position.set(0, winH / 2 + 0.46, -0.02);
  windowGroup.add(lowerWall, leftWall, rightWall, upperWall);

  // Soft pleated linen curtains framing left & right edges of the window
  const curtainMat = new THREE.MeshPhysicalMaterial({
    color: 0xcabaa4,
    roughness: 0.88,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffe8cc),
  });
  [-1, 1].forEach((side) => {
    for (let f = 0; f < 5; f++) {
      const pleat = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, winH + 0.06, 12), curtainMat);
      pleat.position.set(side * (winW / 2 - 0.05 - f * 0.052), 0, 0.045 + (f % 2) * 0.012);
      windowGroup.add(pleat);
    }
  });

  scene.add(windowGroup);

  // 5. Warm Japanese Pendant Lamp hovering above the table (visible when looking slightly up)
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0, 1.18, 0.08);
  const shadePoints = [
    new THREE.Vector2(0.02, 0.14),
    new THREE.Vector2(0.09, 0.12),
    new THREE.Vector2(0.22, 0.04),
    new THREE.Vector2(0.26, 0.0),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadePoints, 32);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xe8d7be,
    emissive: 0xffb86b,
    emissiveIntensity: 0.45,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  lampGroup.add(new THREE.Mesh(shadeGeo, shadeMat));
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.8, 8),
    new THREE.MeshBasicMaterial({ color: 0x221812 })
  );
  cord.position.y = 0.54;
  lampGroup.add(cord);
  scene.add(lampGroup);

  // Helper to wipe condensation at UV (0..1, 0..1)
  function wipeWindowAtUV(u, v) {
    const cx = Math.floor(u * wipeSize);
    const cy = Math.floor(v * wipeSize);
    const r = 5;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < wipeSize && y >= 0 && y < wipeSize) {
          const dist = Math.hypot(dx, dy) / r;
          if (dist < 1) {
            const idx = (y * wipeSize + x) * 4;
            const add = Math.round((1 - dist * dist) * 230);
            wipeData[idx] = Math.min(255, wipeData[idx] + add);
          }
        }
      }
    }
    wipeTex.needsUpdate = true;
  }

  function update(dt, elapsed, boilLevel, snowAmount = 0) {
    windowUniforms.uTime.value = elapsed;
    windowUniforms.uSnowAmount.value += (snowAmount - windowUniforms.uSnowAmount.value) * Math.min(1, dt * 0.8);
    windowUniforms.uWarmthBoost.value = boilLevel * 0.6 + snowAmount * 0.4;

    // Slowly re-condense wiped spots on the cold winter window
    if (Math.floor(elapsed * 10) !== Math.floor((elapsed - dt) * 10)) {
      let dirty = false;
      for (let i = 0; i < wipeData.length; i += 4) {
        if (wipeData[i] > 0) {
          wipeData[i] = Math.max(0, wipeData[i] - 2);
          dirty = true;
        }
      }
      if (dirty) wipeTex.needsUpdate = true;
    }

    // Subtle living warmth flicker on pot bounce light
    lights.potGlow.intensity = 0.85 + boilLevel * 0.65 + Math.sin(elapsed * 9.5) * 0.05 * boilLevel;
  }

  return {
    lights,
    tableMesh,
    glassMesh,
    windowGroup,
    wipeWindowAtUV,
    update,
  };
}
