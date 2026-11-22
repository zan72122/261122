import * as THREE from 'three';
import { createDonabeTextures, createSteamTexture, createBrushedMetalTextures } from './textures.js';

/**
 * Builds the centerpiece of the nabe dinner:
 * - Tabletop cassette gas stove (カセットコンロ) with cast-iron trivet, interactive rotary
 *   heat dial, and animated flickering blue gas burner ring
 * - Photorealistic Banko-yaki earthenware Donabe (土鍋) with ceramic lug handles & wet glaze PBR
 * - Interactive ceramic Donabe Lid (土鍋の蓋) with steam vent hole & boiling rattle (コトコト)
 * - Custom GLSL shimmering golden dashi broth with organic fBm ripples, convection waves,
 *   translucent 3D boiling bubbles, splash droplets, & volumetric rising steam plumes
 */
export function createPotSystem(scene) {
  const root = new THREE.Group();
  const POT_X = 0.0;
  const POT_Z = -0.02;
  const BROTH_BASE_Y = 0.168;
  const BROTH_RADIUS = 0.128;

  // =========================================================================
  // 1. Tabletop Cassette Gas Stove (カセットコンロ) — Brushed Dark Metallic Finish
  // =========================================================================
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(POT_X, 0, POT_Z);

  const metalTex = createBrushedMetalTextures();
  const stoveBodyMat = new THREE.MeshPhysicalMaterial({
    map: metalTex.map,
    roughnessMap: metalTex.roughnessMap,
    color: 0x3b3835,
    roughness: 0.72,
    metalness: 0.62,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
  });

  // Sleek low-profile stove chassis (compact so donabe stays the unmistakable hero!)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.052, 0.26), stoveBodyMat);
  chassis.position.set(0.018, 0.030, 0.0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  stoveGroup.add(chassis);

  // Subtle dark brushed gunmetal top plate
  const bezelMat = new THREE.MeshStandardMaterial({
    map: metalTex.map,
    roughnessMap: metalTex.roughnessMap,
    color: 0x544e48,
    roughness: 0.55,
    metalness: 0.74,
  });
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.308, 0.008, 0.248), bezelMat);
  topPlate.position.set(0.018, 0.058, 0);
  topPlate.receiveShadow = true;
  stoveGroup.add(topPlate);

  // Dark enamel recessed drip well under burner
  const wellMat = new THREE.MeshStandardMaterial({ color: 0x161515, roughness: 0.35, metalness: 0.3 });
  const burnerWell = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.102, 0.014, 32), wellMat);
  burnerWell.position.set(0, 0.063, 0);
  stoveGroup.add(burnerWell);

  // Cast-iron matte black trivet (五徳)
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1b1a1a,
    roughness: 0.78,
    metalness: 0.35,
  });
  const trivetRing = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 10, 32), ironMat);
  trivetRing.rotation.x = Math.PI / 2;
  trivetRing.position.set(0, 0.074, 0);
  stoveGroup.add(trivetRing);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.009), ironMat);
    prong.position.set(Math.cos(a) * 0.086, 0.079, Math.sin(a) * 0.086);
    prong.rotation.y = -a;
    stoveGroup.add(prong);
  }

  // Rubber feet
  const footGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12);
  for (const fx of [-0.125, 0.175]) {
    for (const fz of [-0.115, 0.115]) {
      const f = new THREE.Mesh(footGeo, ironMat);
      f.position.set(fx, 0.004, fz);
      stoveGroup.add(f);
    }
  }

  // Interactive rotary heat knob on front-right of stove (chunky, tactile, zero text!)
  const knobPivot = new THREE.Group();
  knobPivot.position.set(0.142, 0.034, 0.132);
  const knobBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.026, 0.016, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x201e1d, roughness: 0.25, metalness: 0.4, clearcoat: 0.6 })
  );
  knobBase.rotation.x = Math.PI / 2;
  knobPivot.add(knobBase);

  const knobBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.011, 0.044, 0.018),
    new THREE.MeshPhysicalMaterial({ color: 0xc2492d, roughness: 0.28, metalness: 0.15, clearcoat: 0.75 })
  );
  knobBar.position.set(0, 0, 0.012);
  knobPivot.add(knobBar);

  // Subtle brass indicator dot on top of knob bar
  const knobDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.0038, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf6d39c, emissive: 0xff7722, emissiveIntensity: 0.4, roughness: 0.2 })
  );
  knobDot.position.set(0, 0.014, 0.021);
  knobPivot.add(knobDot);

  // Generous invisible touch hitbox for easy 5yo tapping/turning
  const knobHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  knobHit.name = 'stoveKnob';
  knobPivot.add(knobHit);
  stoveGroup.add(knobPivot);

  // Animated Blue Gas Ring Flame Shader under the donabe
  const flameUniforms = {
    uTime: { value: 0 },
    uHeat: { value: 0.55 },
  };
  const flameMat = new THREE.ShaderMaterial({
    uniforms: flameUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uHeat;
      void main() {
        vUv = uv;
        vec3 p = position;
        float flick = sin(uv.x * 58.0 + uTime * 22.0) * 0.0028 + sin(uv.x * 110.0 - uTime * 35.0) * 0.0014;
        p.y += flick * uHeat * uv.y;
        p.xz *= 1.0 + uv.y * 0.28 * uHeat;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uHeat;
      void main() {
        // 24 distinct gas burner jet tongues around the ring
        float jets = pow(0.5 + 0.5 * sin(vUv.x * 6.28318 * 24.0 + sin(uTime * 15.0 + vUv.x * 40.0) * 0.4), 1.7);
        float heightMask = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
        float flicker = 0.85 + 0.15 * sin(uTime * 28.0 + vUv.x * 90.0);
        float alpha = jets * heightMask * flicker * (0.25 + uHeat * 0.85);

        vec3 coreBlue = vec3(0.22, 0.62, 1.0);
        vec3 hotCyan = vec3(0.62, 0.90, 1.0);
        vec3 tipOrange = vec3(1.0, 0.48, 0.12);
        vec3 col = mix(coreBlue, hotCyan, smoothstep(0.0, 0.45, vUv.y));
        float orangeSpark = smoothstep(0.68, 0.98, vUv.y) * smoothstep(0.4, 0.9, sin(uTime * 19.0 + vUv.x * 73.0) * 0.5 + 0.5);
        col = mix(col, tipOrange, orangeSpark * 0.55 * uHeat);

        gl_FragColor = vec4(col * (1.2 + uHeat * 1.1), alpha);
      }
    `,
  });

  const flameRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.056, 0.022, 48, 4, true),
    flameMat
  );
  flameRing.position.set(0, 0.078, 0);
  stoveGroup.add(flameRing);

  root.add(stoveGroup);

  // =========================================================================
  // 2. Authentic Banko-yaki Earthenware Donabe (土鍋)
  // =========================================================================
  const donabeGroup = new THREE.Group();
  donabeGroup.position.set(POT_X, 0.082, POT_Z);

  const bodyTex = createDonabeTextures('body');
  const donabeMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex.map,
    normalMap: bodyTex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: bodyTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.02,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
  });

  // Sculpted thick-walled donabe profile (outer -> rim lip -> recessed lid ledge -> deep interior!)
  const potProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.088, 0.0),
    new THREE.Vector2(0.108, 0.012),
    new THREE.Vector2(0.138, 0.036),
    new THREE.Vector2(0.152, 0.072),
    new THREE.Vector2(0.155, 0.098),
    new THREE.Vector2(0.161, 0.108), // flared outer lip
    new THREE.Vector2(0.156, 0.116), // top rounded rim
    new THREE.Vector2(0.144, 0.116),
    new THREE.Vector2(0.139, 0.104), // inner lid seat ledge
    new THREE.Vector2(0.132, 0.102),
    new THREE.Vector2(0.128, 0.072), // inner ceramic wall descending into broth
    new THREE.Vector2(0.114, 0.036),
    new THREE.Vector2(0.082, 0.016),
    new THREE.Vector2(0.0, 0.014),
  ];
  const donabeGeo = new THREE.LatheGeometry(potProfile, 56);
  const donabeMesh = new THREE.Mesh(donabeGeo, donabeMat);
  donabeMesh.castShadow = true;
  donabeMesh.receiveShadow = true;
  donabeMesh.name = 'donabePot';
  donabeGroup.add(donabeMesh);

  // Two traditional curved stoneware lug handles (土鍋の耳) on left & right
  const earCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.144, 0.086, -0.044),
    new THREE.Vector3(0.184, 0.098, -0.026),
    new THREE.Vector3(0.188, 0.101, 0.0),
    new THREE.Vector3(0.184, 0.098, 0.026),
    new THREE.Vector3(0.144, 0.086, 0.044),
  ]);
  const earGeo = new THREE.TubeGeometry(earCurve, 20, 0.0125, 12, false);
  const earRight = new THREE.Mesh(earGeo, donabeMat);
  earRight.castShadow = true;
  earRight.receiveShadow = true;
  donabeGroup.add(earRight);

  const earLeft = earRight.clone();
  earLeft.rotation.y = Math.PI;
  donabeGroup.add(earLeft);

  root.add(donabeGroup);

  // =========================================================================
  // 3. Simmering Golden Dashi Broth Surface Shader
  // =========================================================================
  const MAX_RIPPLES = 6;
  const rippleData = [];
  for (let i = 0; i < MAX_RIPPLES; i++) {
    rippleData.push(new THREE.Vector4(0, 0, -10, 0)); // x, z, startTime, strength
  }
  let rippleCursor = 0;

  const brothUniforms = {
    uTime: { value: 0 },
    uBoil: { value: 0.15 },
    uSwirl: { value: 0.0 },
    uFoam: { value: 0.0 },
    uRipples: { value: rippleData },
  };

  const brothMat = new THREE.ShaderMaterial({
    uniforms: brothUniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uBoil;
      uniform float uSwirl;
      uniform vec4 uRipples[6];
      varying vec2 vLocalPos;
      varying float vElev;
      varying float vRippleWave;

      void main() {
        vec3 pos = position;
        // Disc lies in XY before rotation; transform to local XZ radius
        vec2 p = pos.xy;
        float r = length(p) / 0.128;

        // Boiling convection heave & micro-bubbles
        float b1 = sin(p.x * 58.0 + uTime * 7.5) * cos(p.y * 54.0 - uTime * 6.8);
        float b2 = sin((p.x - p.y) * 92.0 + uTime * 11.2) * 0.5;
        float centerBoil = (1.0 - smoothstep(0.55, 1.0, r));
        float elev = (b1 * 0.0024 + b2 * 0.0014) * uBoil * (0.45 + 0.55 * centerBoil);

        // Rising dome swell when vigorous rolling boil / near overflow
        elev += uBoil * uBoil * 0.0065 * (1.0 - r * r * 0.5);

        // Concentric splash ripples
        float ripTotal = 0.0;
        for (int i = 0; i < 6; i++) {
          float age = uTime - uRipples[i].z;
          if (age > 0.0 && age < 2.2) {
            float d = length(p - uRipples[i].xy);
            float wave = sin(d * 115.0 - age * 14.0) * exp(-age * 2.2) * exp(-d * 10.0);
            ripTotal += wave * uRipples[i].w;
          }
        }
        elev += ripTotal * 0.0055 * (1.0 - smoothstep(0.85, 1.0, r));

        pos.z += elev;
        vLocalPos = p;
        vElev = elev;
        vRippleWave = ripTotal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uBoil;
      uniform float uSwirl;
      uniform float uFoam;
      uniform vec4 uRipples[6];
      varying vec2 vLocalPos;
      varying float vElev;
      varying float vRippleWave;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
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
        mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = m * p * 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 p = vLocalPos;
        float r = length(p) / 0.128;
        if (r > 1.0) discard;

        // Swirl coordinates subtly for fluid convection
        float ang = atan(p.y, p.x) + uSwirl * (1.0 - r * 0.4);
        vec2 sw = vec2(cos(ang), sin(ang)) * length(p);

        // Rich golden kombu-katsuo dashi depth gradient (darker clear amber center, golden rim)
        vec3 deepDashi = vec3(0.34, 0.20, 0.075);
        vec3 warmDashi = vec3(0.64, 0.44, 0.18);
        vec3 rimDashi = vec3(0.80, 0.62, 0.34);
        vec3 col = mix(deepDashi, warmDashi, smoothstep(0.08, 0.82, r));
        col = mix(col, rimDashi, smoothstep(0.80, 1.0, r) * 0.48);

        // Organic fluid wave heightfield using domain-warped fBm (NO regular grid artifacts!)
        vec2 flow1 = sw * 28.0 + vec2(uTime * 0.45, -uTime * 0.38);
        vec2 flow2 = sw * 52.0 - vec2(uTime * 0.82, uTime * 0.65);
        float h0 = fbm(flow1) * 0.65 + fbm(flow2) * 0.35;
        float eps = 0.004;
        float hx = fbm((sw + vec2(eps, 0.0)) * 28.0 + vec2(uTime * 0.45, -uTime * 0.38)) * 0.65
                 + fbm((sw + vec2(eps, 0.0)) * 52.0 - vec2(uTime * 0.82, uTime * 0.65)) * 0.35;
        float hy = fbm((sw + vec2(0.0, eps)) * 28.0 + vec2(uTime * 0.45, -uTime * 0.38)) * 0.65
                 + fbm((sw + vec2(0.0, eps)) * 52.0 - vec2(uTime * 0.82, uTime * 0.65)) * 0.35;

        // Subtle shimmering golden oil droplets floating organically on the dashi
        float oilMask = smoothstep(0.66, 0.78, h0);
        col += vec3(0.16, 0.11, 0.04) * oilMask;

        // Organic tangent normal from fBm gradient + dynamic concentric splash ripples
        vec2 grad = vec2((hx - h0), (hy - h0)) * (4.2 + uBoil * 7.5);
        grad += vec2(vRippleWave * 0.85, -vRippleWave * 0.75);
        vec3 N = normalize(vec3(-grad.x, -grad.y, 1.0));

        vec3 L1 = normalize(vec3(0.06, -0.22, 0.96)); // warm overhead pendant lamp
        vec3 L2 = normalize(vec3(-0.18, 0.68, 0.70)); // cool rainy window rim reflection
        vec3 V = normalize(vec3(0.0, -0.56, 0.83));

        float specWarm = pow(max(0.0, dot(N, normalize(L1 + V))), 96.0);
        float specSheen = pow(max(0.0, dot(N, normalize(L1 + V))), 18.0);
        float specCool = pow(max(0.0, dot(N, normalize(L2 + V))), 32.0);
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.0);

        col += vec3(1.0, 0.90, 0.72) * (specWarm * 1.15 + specSheen * 0.16);
        col += vec3(0.45, 0.72, 1.0) * (specCool * 0.28 + fresnel * 0.12);

        // Delicate lacy simmering foam/froth clusters around ceramic rim & boiling eddies
        float foamNoise = fbm(sw * 64.0 + vec2(uTime * 0.6, uTime * 0.45));
        float fineBubble = noise(sw * 175.0 - vec2(uTime * 1.6, -uTime * 1.2));
        float rimFoam = smoothstep(0.72, 0.99, r) * smoothstep(0.50 - uBoil * 0.18, 0.76, foamNoise);
        float boilFoam = smoothstep(0.68 - uBoil * 0.24 - uFoam * 0.16, 0.86, foamNoise) * smoothstep(0.32, 0.85, fineBubble) * uBoil;
        float foamAmt = clamp(rimFoam * (0.22 + uBoil * 0.72) + boilFoam * 0.85, 0.0, 0.88);
        vec3 foamCol = vec3(0.98, 0.93, 0.82);
        col = mix(col, foamCol, foamAmt);

        float alpha = clamp(0.86 + r * 0.08 + foamAmt * 0.12, 0.84, 0.98);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const brothGeo = new THREE.CircleGeometry(BROTH_RADIUS, 48, 0, Math.PI * 2);
  // Subdivide rings for smooth vertex waves
  const brothPlane = new THREE.Mesh(
    new THREE.RingGeometry(0.001, BROTH_RADIUS, 48, 12),
    brothMat
  );
  brothPlane.rotation.x = -Math.PI / 2;
  brothPlane.position.set(POT_X, BROTH_BASE_Y, POT_Z);
  brothPlane.name = 'brothSurface';
  root.add(brothPlane);
  brothGeo.dispose();

  // =========================================================================
  // 4. Interactive Ceramic Donabe Lid (土鍋の蓋)
  // =========================================================================
  const lidTex = createDonabeTextures('lid');
  const lidMat = new THREE.MeshPhysicalMaterial({
    map: lidTex.map,
    normalMap: lidTex.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: lidTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.02,
    clearcoat: 0.82,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
  });

  const lidGroup = new THREE.Group();
  const lidProfile = [
    new THREE.Vector2(0.143, 0.0),
    new THREE.Vector2(0.145, 0.009),
    new THREE.Vector2(0.132, 0.024),
    new THREE.Vector2(0.104, 0.044),
    new THREE.Vector2(0.068, 0.059),
    new THREE.Vector2(0.032, 0.066),
    new THREE.Vector2(0.018, 0.067),
    new THREE.Vector2(0.015, 0.082),
    new THREE.Vector2(0.028, 0.094), // ceramic top handle knob
    new THREE.Vector2(0.026, 0.100),
    new THREE.Vector2(0.008, 0.101),
    new THREE.Vector2(0.0, 0.096),
  ];
  const lidMesh = new THREE.Mesh(new THREE.LatheGeometry(lidProfile, 48), lidMat);
  lidMesh.castShadow = true;
  lidMesh.receiveShadow = true;
  lidMesh.name = 'donabeLid';
  lidGroup.add(lidMesh);

  // Authentic tiny dark steam vent hole (蒸気穴) on dome of lid
  const ventRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.0065, 0.0018, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.4 })
  );
  ventRim.position.set(0.046, 0.063, 0.024);
  ventRim.rotation.set(Math.PI / 2 - 0.28, 0, -0.35);
  lidGroup.add(ventRim);

  const ventHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.0056, 12),
    new THREE.MeshBasicMaterial({ color: 0x0b0806 })
  );
  ventHole.position.set(0.046, 0.0625, 0.024);
  ventHole.rotation.set(-Math.PI / 2 - 0.28, 0, 0);
  lidGroup.add(ventHole);

  // Lid rests cleanly to the far-left of the stove so it never obscures Mom's bowl OR the platter
  const lidRestPos = new THREE.Vector3(-0.44, 0.008, 0.06);
  const lidOnPos = new THREE.Vector3(POT_X, 0.190, POT_Z);

  // Small cork mat where the lid rests
  const lidMatPad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.115, 0.008, 28),
    new THREE.MeshStandardMaterial({ color: 0x8b6745, roughness: 0.92 })
  );
  lidMatPad.position.set(lidRestPos.x, 0.004, lidRestPos.z);
  lidMatPad.receiveShadow = true;
  root.add(lidMatPad);

  lidGroup.position.copy(lidRestPos);
  root.add(lidGroup);

  // =========================================================================
  // 5. 3D Rising Translucent Dashi Boiling Bubbles & Splash Droplets
  // =========================================================================
  const BUBBLE_COUNT = 38;
  const bubbleGeo = new THREE.SphereGeometry(1, 12, 10);
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2b66c,
    roughness: 0.04,
    metalness: 0.0,
    transparent: true,
    opacity: 0.36,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    depthWrite: false,
  });
  const bubbleInst = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLE_COUNT);
  bubbleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(bubbleInst);

  const bubbles = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    bubbles.push({
      x: 0,
      z: 0,
      age: Math.random() * 2,
      life: 0.5 + Math.random() * 0.9,
      maxR: 0.004 + Math.random() * 0.008,
      active: false,
    });
  }

  // Splash droplets when ingredients drop into broth
  const DROPLET_COUNT = 26;
  const dropletMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4dca8,
    roughness: 0.08,
    transparent: true,
    opacity: 0.85,
    clearcoat: 1.0,
  });
  const dropletInst = new THREE.InstancedMesh(bubbleGeo, dropletMat, DROPLET_COUNT);
  dropletInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(dropletInst);

  const droplets = [];
  for (let i = 0; i < DROPLET_COUNT; i++) {
    droplets.push({
      pos: new THREE.Vector3(0, -10, 0),
      vel: new THREE.Vector3(),
      age: 10,
      life: 0.5,
      size: 0.004,
    });
  }

  // =========================================================================
  // 6. Volumetric-style Soft Rising Steam Plumes
  // =========================================================================
  const steamTex = createSteamTexture();
  const STEAM_COUNT = 36;
  const steamGroup = new THREE.Group();
  const steamParticles = [];

  for (let i = 0; i < STEAM_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: new THREE.Color(0xfff5e8),
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(POT_X, -5, POT_Z);
    steamGroup.add(sprite);
    steamParticles.push({
      sprite,
      mat,
      pos: new THREE.Vector3(POT_X, -5, POT_Z),
      vel: new THREE.Vector3(),
      age: Math.random() * 3.0,
      life: 2.2 + Math.random() * 1.4,
      baseScale: 0.09 + Math.random() * 0.08,
      rotSpeed: (Math.random() - 0.5) * 0.45,
      kind: 'pot', // 'pot' | 'burst' | 'bowl'
    });
  }
  root.add(steamGroup);

  scene.add(root);

  const dummy = new THREE.Object3D();

  // State
  const state = {
    potCenter: new THREE.Vector3(POT_X, BROTH_BASE_Y, POT_Z),
    brothRadius: BROTH_RADIUS,
    heatLevel: 0.58, // 0.18 (low), 0.58 (med), 1.0 (high)
    heatStep: 1,     // 0=low, 1=medium, 2=high
    boilLevel: 0.22, // 0..1.25 (above 1.0 = playful foam-up!)
    lidOn: false,
    lidDragging: false,
    lidTarget: lidRestPos.clone(),
    swirlAngle: 0,
    swirlVel: 0,
    ingredientCount: 0,
    foamAmount: 0,
  };

  function spawnRipple(worldX, worldZ, strength = 1.0, time = brothUniforms.uTime.value) {
    const lx = THREE.MathUtils.clamp(worldX - POT_X, -BROTH_RADIUS * 0.85, BROTH_RADIUS * 0.85);
    const lz = THREE.MathUtils.clamp(-(worldZ - POT_Z), -BROTH_RADIUS * 0.85, BROTH_RADIUS * 0.85);
    rippleData[rippleCursor].set(lx, lz, time, strength);
    rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
  }

  function spawnSplash(worldX, worldZ, count = 10, strength = 1.0) {
    spawnRipple(worldX, worldZ, strength * 1.15);
    let spawned = 0;
    for (let i = 0; i < DROPLET_COUNT && spawned < count; i++) {
      const d = droplets[i];
      if (d.age >= d.life) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.14 + Math.random() * 0.24) * strength;
        d.pos.set(worldX + (Math.random() - 0.5) * 0.025, BROTH_BASE_Y + 0.008, worldZ + (Math.random() - 0.5) * 0.025);
        d.vel.set(Math.cos(ang) * spd, (0.36 + Math.random() * 0.34) * strength, Math.sin(ang) * spd);
        d.age = 0;
        d.life = 0.38 + Math.random() * 0.22;
        d.size = (0.0032 + Math.random() * 0.0038) * Math.min(1.3, strength);
        spawned++;
      }
    }
  }

  function triggerSteamBurst(originPos, count = 12, speed = 1.0) {
    let used = 0;
    for (let i = 0; i < STEAM_COUNT && used < count; i++) {
      const p = steamParticles[i];
      if (p.age > p.life * 0.65 || p.pos.y < -1) {
        const a = Math.random() * Math.PI * 2;
        const rad = Math.random() * 0.08;
        p.pos.set(originPos.x + Math.cos(a) * rad, originPos.y + 0.02, originPos.z + Math.sin(a) * rad);
        p.vel.set(Math.cos(a) * 0.06 * speed, (0.19 + Math.random() * 0.14) * speed, Math.sin(a) * 0.06 * speed);
        p.age = 0;
        p.life = 1.6 + Math.random() * 0.9;
        p.baseScale = 0.14 + Math.random() * 0.09;
        p.kind = 'burst';
        used++;
      }
    }
  }

  function emitLocalSteam(worldPos, scale = 0.075) {
    for (let i = 0; i < STEAM_COUNT; i++) {
      const p = steamParticles[i];
      if (p.age >= p.life || p.pos.y < -1) {
        p.pos.set(
          worldPos.x + (Math.random() - 0.5) * 0.03,
          worldPos.y + 0.015,
          worldPos.z + (Math.random() - 0.5) * 0.03
        );
        p.vel.set((Math.random() - 0.5) * 0.022, 0.09 + Math.random() * 0.05, (Math.random() - 0.5) * 0.022);
        p.age = 0;
        p.life = 1.5 + Math.random() * 0.8;
        p.baseScale = scale;
        p.kind = 'bowl';
        break;
      }
    }
  }

  function cycleHeat() {
    state.heatStep = (state.heatStep + 1) % 3;
    const levels = [0.22, 0.62, 1.0];
    state.heatLevel = levels[state.heatStep];
    return state.heatLevel;
  }

  function setLidOn(on, audio) {
    const wasOn = state.lidOn;
    state.lidOn = on;
    state.lidTarget.copy(on ? lidOnPos : lidRestPos);
    if (audio) {
      audio.playCeramicClink(0.28, on ? 0.95 : 1.12);
    }
    if (wasOn && !on && state.boilLevel > 0.35) {
      // Dramatic warm steam cloud when uncovering simmering donabe!
      triggerSteamBurst(new THREE.Vector3(POT_X, BROTH_BASE_Y + 0.03, POT_Z), 16, 1.25);
      if (audio) audio.playSteamWhoosh(0.8 + state.boilLevel * 0.45);
    }
  }

  return {
    root,
    state,
    donabeGroup,
    donabeMesh,
    brothPlane,
    lidGroup,
    lidMesh,
    lidRestPos,
    lidOnPos,
    knobPivot,
    knobHit,
    spawnRipple,
    spawnSplash,
    triggerSteamBurst,
    emitLocalSteam,
    cycleHeat,
    setLidOn,
    addSwirl(delta) {
      state.swirlVel = THREE.MathUtils.clamp(state.swirlVel + delta, -4.5, 4.5);
    },
    update(dt, elapsed, { flameLight, ingredientCount = 0 }) {
      state.ingredientCount = ingredientCount;

      // Target boiling level increases naturally with heat, ingredients, and lid trapping heat
      const ingBonus = Math.min(0.28, ingredientCount * 0.045);
      const lidBonus = state.lidOn ? 0.36 : 0.0;
      const targetBoil = Math.min(1.22, 0.14 + state.heatLevel * 0.72 + ingBonus + lidBonus);
      const riseRate = targetBoil > state.boilLevel ? (state.lidOn ? 0.34 : 0.18) : 0.25;
      state.boilLevel += (targetBoil - state.boilLevel) * Math.min(1, dt * riseRate);

      // Broth rises slightly when lots of ingredients & foam are inside
      const overfillLift = Math.min(0.018, ingredientCount * 0.0018) + Math.max(0, state.boilLevel - 0.85) * 0.016;
      const curBrothY = BROTH_BASE_Y + overfillLift;
      brothPlane.position.y = curBrothY;
      state.potCenter.y = curBrothY;

      state.foamAmount = Math.max(0, state.boilLevel - 0.65) + Math.max(0, ingredientCount - 6) * 0.08;

      // Swirl decay
      state.swirlAngle += state.swirlVel * dt;
      state.swirlVel *= Math.exp(-dt * 2.2);

      // Update shaders
      brothUniforms.uTime.value = elapsed;
      brothUniforms.uBoil.value = state.boilLevel;
      brothUniforms.uSwirl.value = state.swirlAngle;
      brothUniforms.uFoam.value = state.foamAmount;

      flameUniforms.uTime.value = elapsed;
      flameUniforms.uHeat.value = state.heatLevel;

      // Rotate stove knob smoothly
      const targetKnobZ = -(state.heatLevel - 0.15) * 1.45;
      knobPivot.rotation.z += (targetKnobZ - knobPivot.rotation.z) * Math.min(1, dt * 12);
      knobDot.material.emissiveIntensity = 0.25 + state.heatLevel * 1.1;

      // Dynamic blue/orange flame under-light flicker
      if (flameLight) {
        const flick = 0.88 + 0.12 * Math.sin(elapsed * 29.0) * Math.cos(elapsed * 17.3);
        flameLight.intensity = (0.28 + state.heatLevel * 0.95) * flick;
      }

      // Smooth lid movement + boiling ceramic rattle (コトコト) when covered & hot
      if (!state.lidDragging) {
        lidGroup.position.lerp(state.lidTarget, Math.min(1, dt * 9.5));
        if (state.lidOn && state.boilLevel > 0.55) {
          const rattleAmt = Math.min(1, (state.boilLevel - 0.55) / 0.55);
          const hop = Math.max(0, Math.sin(elapsed * 22.0) * Math.sin(elapsed * 7.3)) * 0.0055 * rattleAmt;
          lidGroup.position.y = lidOnPos.y + hop;
          lidGroup.rotation.z = Math.sin(elapsed * 19.0) * 0.028 * rattleAmt;
          lidGroup.rotation.x = Math.cos(elapsed * 16.0) * 0.022 * rattleAmt;
        } else {
          lidGroup.rotation.x *= Math.exp(-dt * 10);
          lidGroup.rotation.z *= Math.exp(-dt * 10);
        }
      }

      // Update 3D rising boiling bubbles on broth surface
      const visibleBubbles = Math.floor(BUBBLE_COUNT * Math.min(1, state.boilLevel * 1.05));
      for (let i = 0; i < BUBBLE_COUNT; i++) {
        const b = bubbles[i];
        b.age += dt * (0.75 + state.boilLevel * 1.15);
        if (b.age >= b.life) {
          if (i < visibleBubbles && !state.lidOn) {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * (BROTH_RADIUS * 0.88);
            b.x = POT_X + Math.cos(ang) * rad;
            b.z = POT_Z + Math.sin(ang) * rad;
            b.age = 0;
            b.life = 0.32 + Math.random() * 0.58;
            b.maxR = (0.0038 + Math.random() * 0.0075) * (0.7 + state.boilLevel * 0.65);
            b.active = true;
          } else {
            b.active = false;
          }
        }
        if (b.active && !state.lidOn) {
          const t = b.age / b.life;
          // Grow quickly, dome out, pop!
          const grow = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.65);
          const pop = t > 0.88 ? Math.max(0.001, (1 - t) / 0.12) : 1.0;
          const r = b.maxR * grow * pop;
          dummy.position.set(b.x, curBrothY + r * 0.32, b.z);
          dummy.scale.set(r * 1.18, r * 0.72, r * 1.18);
          dummy.rotation.set(0, 0, 0);
        } else {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.0001);
        }
        dummy.updateMatrix();
        bubbleInst.setMatrixAt(i, dummy.matrix);
      }
      bubbleInst.instanceMatrix.needsUpdate = true;

      // Update splash droplets
      for (let i = 0; i < DROPLET_COUNT; i++) {
        const d = droplets[i];
        d.age += dt;
        if (d.age < d.life) {
          d.vel.y -= 2.4 * dt;
          d.pos.addScaledVector(d.vel, dt);
          if (d.pos.y < curBrothY - 0.01) {
            d.age = d.life;
          }
          const s = d.size * (1 - (d.age / d.life) * 0.4);
          dummy.position.copy(d.pos);
          dummy.scale.set(s, s * 1.35, s);
          dummy.rotation.set(0, 0, 0);
        } else {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.0001);
        }
        dummy.updateMatrix();
        dropletInst.setMatrixAt(i, dummy.matrix);
      }
      dropletInst.instanceMatrix.needsUpdate = true;

      // Update rising volumetric steam plumes
      for (let i = 0; i < STEAM_COUNT; i++) {
        const p = steamParticles[i];
        p.age += dt;
        if (p.age >= p.life) {
          // Respawn pot steam continuously based on boilLevel
          if (i < 22 && state.boilLevel > 0.12) {
            p.kind = 'pot';
            p.age = 0;
            if (state.lidOn) {
              // Tight steam jet escaping the lid's tiny vent hole!
              p.pos.set(POT_X + 0.046, lidGroup.position.y + 0.068, POT_Z + 0.024);
              p.vel.set(0.022 + (Math.random() - 0.5) * 0.018, 0.24 + state.boilLevel * 0.14, (Math.random() - 0.5) * 0.018);
              p.life = 1.2 + Math.random() * 0.6;
              p.baseScale = 0.055 + state.boilLevel * 0.045;
            } else {
              const ang = Math.random() * Math.PI * 2;
              const rad = Math.sqrt(Math.random()) * (BROTH_RADIUS * 0.78);
              p.pos.set(POT_X + Math.cos(ang) * rad, curBrothY + 0.015, POT_Z + Math.sin(ang) * rad);
              p.vel.set((Math.random() - 0.5) * 0.032, 0.11 + state.boilLevel * 0.11 + Math.random() * 0.04, (Math.random() - 0.5) * 0.032);
              p.life = 1.9 + Math.random() * 1.1;
              p.baseScale = 0.095 + state.boilLevel * 0.075;
            }
          } else {
            p.pos.y = -5;
            p.mat.opacity = 0;
            continue;
          }
        }

        const t = p.age / p.life;
        // Organic upward curl & gentle air draft drift
        p.pos.x += (p.vel.x + Math.sin(elapsed * 1.7 + i * 2.1) * 0.016) * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += (p.vel.z + Math.cos(elapsed * 1.3 + i * 1.7) * 0.012) * dt;
        p.vel.x *= Math.exp(-dt * 0.9);
        p.vel.z *= Math.exp(-dt * 0.9);

        const fadeIn = Math.min(1, t * 4.5);
        const fadeOut = Math.pow(Math.max(0, 1 - t), 1.45);
        const maxAlpha =
          p.kind === 'burst'
            ? 0.62
            : p.kind === 'bowl'
              ? 0.38
              : (0.26 + state.boilLevel * 0.38) * (state.lidOn ? 1.18 : 1.0);

        p.mat.opacity = fadeIn * fadeOut * maxAlpha;
        p.mat.rotation += p.rotSpeed * dt;
        const sc = p.baseScale * (0.85 + t * 2.25);
        p.sprite.position.copy(p.pos);
        p.sprite.scale.set(sc, sc * 1.12, 1);
      }
    },
  };
}
