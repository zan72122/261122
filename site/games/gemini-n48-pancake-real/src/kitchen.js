import * as THREE from 'three';

/**
 * Helper: creates a softly beveled organic box (for authentic sliced butter block & pat!)
 */
function createChamferedBoxGeometry(w, h, d, bevel = 0.018, segs = 6) {
  const geo = new THREE.BoxGeometry(w, h, d, segs, segs, segs);
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
 * Photorealistic Jewel-Amber Grade-A Maple Syrup Material:
 * Deep mahogany-amber internal absorption + fiery honey-gold sunlit grazing rim + mirror wet clearcoat!
 * Never looks milky, pink, or opaque peanut-butter!
 */
export function createAmberSyrupMaterial({ opacity = 0.86, depthWrite = true, rimBoost = 1.0 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0e0200,
    roughness: 0.012,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    envMapIntensity: 2.8,
    transparent: true,
    opacity,
    depthWrite,
  });

  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       vec3 sView = normalize(vViewPosition);
       vec3 sNorm = normalize(normal);
       float ndv = abs(dot(sNorm, sView));
       float fres = pow(1.0 - ndv, 1.85);
       // Authentic backlit maple syrup: deep dark-amber mahogany core glowing luminous honey-gold at edges!
       vec3 deepAmber = vec3(0.095, 0.022, 0.001);
       vec3 honeyGold = vec3(0.84, 0.30, 0.006);
       totalEmissiveRadiance += mix(deepAmber, honeyGold, clamp(fres * 0.92 + 0.08, 0.0, 1.0)) * ${rimBoost.toFixed(2)};`
    );
  };

  return mat;
}

/**
 * Builds the sunlit weekend-morning kitchen environment (Round 2 Photorealism Upgrade):
 * - Wide-plank oiled oak countertop + handmade glazed ceramic subway tile backsplash
 * - Left sunlit morning window with wooden mullions casting REAL diagonal sunlight & shadow bars!
 * - Swaying sheer linen morning curtain + delicate golden volumetric sunbeams + floating dust motes
 * - Grounded soft contact AO shadows beneath every countertop prop
 * - Recessed gas stove burner with live blue/amber flame glow + tactile heat control dial
 * - Seasoned heavy cast-iron skillet with walnut handle & brass ferrule
 * - Ceramic batter bowl with creamy batter & stainless steel ladle
 * - Artisanal Japanese stoneware plate + linen placemat + interactive stainless dessert fork
 * - Ceramic butter dish with softly chamfered butter block, sliced pat & stainless butter knife
 * - Sparkling crystal-clear borosilicate glass carafe with golden-amber maple syrup
 * - Small ceramic bowl of glossy seeded strawberries
 */
export function createKitchen(scene, textures) {
  const root = new THREE.Group();
  scene.add(root);

  // Soft contact AO shadow helper (grounds every object physically on the counter!)
  const contactMatBase = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.62,
  });
  function addContactShadow(parent, rx, rz, y = 0.004, opacity = 0.62, ox = 0.04, oz = 0.03) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(rx * 2, rz * 2),
      opacity === 0.62 ? contactMatBase : Object.assign(contactMatBase.clone(), { opacity })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(ox, y, oz);
    parent.add(m);
    return m;
  }

  // =========================================================================
  // 1. COUNTERTOP, BACKSPLASH & SUNLIT MORNING WINDOW ARCHITECTURE
  // =========================================================================
  const counterMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    roughnessMap: textures.wood.roughnessMap,
    bumpMap: textures.wood.bumpMap,
    bumpScale: 0.016,
    roughness: 0.78,
    metalness: 0.02,
  });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.56, 7.6), counterMat);
  counter.position.set(0.2, -0.28, 0.85);
  counter.receiveShadow = true;
  root.add(counter);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.08, 0.08), counterMat);
  frontLip.position.set(0.2, -0.04, 4.65);
  root.add(frontLip);

  const tileMat = new THREE.MeshStandardMaterial({
    map: textures.tile.map,
    roughnessMap: textures.tile.roughnessMap,
    bumpMap: textures.tile.bumpMap,
    bumpScale: 0.024,
    roughness: 0.44,
    metalness: 0.04,
  });
  // Flush with rear edge of oak counter (z = -2.95) — zero grey gap strip!
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9.5), tileMat);
  backWall.position.set(0.6, 4.2, -2.95);
  backWall.receiveShadow = true;
  root.add(backWall);

  // Subtle solid oak backsplash trim molding right at counter-wall joint!
  const wallTrim = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.14, 0.09), counterMat);
  wallTrim.position.set(0.2, 0.07, -2.91);
  wallTrim.receiveShadow = true;
  root.add(wallTrim);

  // Left sunlit kitchen window frame & mullions positioned directly in the sunLight ray path
  // so REAL crisp-soft morning window-bar shadows sweep diagonally across wall & counter!
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8ded0, roughness: 0.90 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xd4c2aa, roughness: 0.68 });

  const winGroup = new THREE.Group();
  winGroup.position.set(-4.35, 2.75, -0.35);
  root.add(winGroup);

  // Lower wall & sill
  const leftWallLower = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.4, 8.2), wallMat);
  leftWallLower.position.set(-0.18, -2.55, 0.1);
  leftWallLower.castShadow = true;
  winGroup.add(leftWallLower);

  const leftWallUpper = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 8.2), wallMat);
  leftWallUpper.position.set(-0.18, 3.25, 0.1);
  leftWallUpper.castShadow = true;
  winGroup.add(leftWallUpper);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 5.4), frameMat);
  sill.position.set(0.08, -1.36, 0);
  sill.castShadow = true;
  sill.receiveShadow = true;
  winGroup.add(sill);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 5.4), frameMat);
  topFrame.position.set(0, 1.82, 0);
  topFrame.castShadow = true;
  winGroup.add(topFrame);

  // Authentic wooden window mullions casting diagonal morning window shadows!
  const mullionV1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.3, 0.13), frameMat);
  mullionV1.position.set(0.02, 0.22, -1.15);
  mullionV1.castShadow = true;
  winGroup.add(mullionV1);

  const mullionV2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.3, 0.13), frameMat);
  mullionV2.position.set(0.02, 0.22, 0.85);
  mullionV2.castShadow = true;
  winGroup.add(mullionV2);

  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 5.2), frameMat);
  mullionH.position.set(0.02, 0.42, 0);
  mullionH.castShadow = true;
  winGroup.add(mullionH);

  // Sunlit outdoor sky + soft green foliage glow outside window
  const skyPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 5.4),
    new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec3 low = vec3(1.65, 1.44, 1.05);
          vec3 mid = vec3(1.95, 1.78, 1.48);
          vec3 top = vec3(1.30, 1.54, 1.85);
          vec3 col = mix(low, mid, smoothstep(0.0, 0.48, vUv.y));
          col = mix(col, top, smoothstep(0.48, 1.0, vUv.y));
          float d = length(vUv - vec2(0.45, 0.64));
          col += vec3(1.5, 1.18, 0.68) * exp(-d * 3.6);
          float leaf = smoothstep(0.38, 0.0, vUv.y) * (0.55 + 0.45 * sin(vUv.x * 19.0) * cos(vUv.y * 14.0));
          col = mix(col, vec3(0.64, 0.82, 0.44), leaf * 0.42);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  skyPlane.position.set(-0.42, 0.2, 0);
  skyPlane.rotation.y = Math.PI / 2;
  winGroup.add(skyPlane);

  // Translucent morning linen curtain gently swaying at window edge
  const curtainGeo = new THREE.PlaneGeometry(1.45, 4.1, 10, 14);
  const curtainBasePos = new Float32Array(curtainGeo.attributes.position.array);
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e8,
    roughness: 0.94,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    emissive: 0xffe9c2,
    emissiveIntensity: 0.26,
  });
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  curtain.position.set(-3.98, 2.75, -2.35);
  curtain.rotation.y = Math.PI / 2 - 0.22;
  root.add(curtain);

  // Warm oak kitchen wall shelf with ceramic morning mug & lush rosemary herb pot (flush to wall z = -2.95)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.11, 0.62), counterMat);
  shelf.position.set(-1.1, 2.68, -2.65);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  root.add(shelf);

  // Terracotta herb pot with layered organic leaves
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb26242, roughness: 0.84 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 20), potMat);
  pot.position.set(-2.65, 2.90, -2.60);
  pot.castShadow = true;
  root.add(pot);

  const potRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.23, 0.06, 20), potMat);
  potRim.position.set(-2.65, 3.04, -2.60);
  root.add(potRim);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x456e38, roughness: 0.62 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.25;
    const rad = 0.08 + (i % 3) * 0.065;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), leafMat);
    leaf.scale.set(1.3, 0.42, 0.78);
    leaf.position.set(-2.65 + Math.cos(a) * rad, 3.12 + (i % 3) * 0.065, -2.60 + Math.sin(a) * rad);
    leaf.rotation.set(0.35 * Math.sin(a), a, 0.45 * Math.cos(a));
    root.add(leaf);
  }

  // Handcrafted stoneware coffee mug with handle on shelf
  const mugMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6dcd0,
    map: textures.stoneware.map,
    roughness: 0.26,
    clearcoat: 0.58,
    clearcoatRoughness: 0.22,
  });
  const mugGroup = new THREE.Group();
  mugGroup.position.set(-1.75, 2.92, -2.60);
  root.add(mugGroup);
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.17, 0.36, 22), mugMat);
  mugBody.castShadow = true;
  mugGroup.add(mugBody);
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16, Math.PI * 1.15), mugMat);
  mugHandle.position.set(0.17, 0.0, 0);
  mugHandle.rotation.z = -Math.PI * 0.55;
  mugGroup.add(mugHandle);

  // =========================================================================
  // 2. DIAGONAL VOLUMETRIC MORNING SUNBEAMS & FLOATING DUST MOTES
  // =========================================================================
  const rayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float along = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.14, vUv.x);
        float across = pow(max(sin(vUv.y * 3.14159265), 0.0), 1.9);
        // Subtle sunlit window-pane shaft bands
        float panes = 0.52 + 0.48 * pow(max(0.0, sin(vUv.y * 12.5 + 0.5 + sin(uTime * 0.2) * 0.18)), 1.6);
        float facing = pow(abs(dot(vNormal, vViewDir)), 0.45);
        float alpha = along * across * panes * facing * 0.105;
        vec3 col = vec3(1.0, 0.88, 0.62);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const sunbeamGroup = new THREE.Group();
  const rayConfigs = [
    { pos: [-1.15, 2.25, -0.45], rotZ: -0.58, rotY: 0.14, scale: [8.4, 2.4, 1] },
    { pos: [-0.85, 1.92, 0.42], rotZ: -0.56, rotY: 0.22, scale: [8.0, 2.0, 1] },
    { pos: [-1.45, 2.48, -1.25], rotZ: -0.60, rotY: 0.06, scale: [8.2, 2.2, 1] },
  ];
  rayConfigs.forEach((cfg) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), rayMat);
    plane.position.set(...cfg.pos);
    plane.rotation.set(0.18, cfg.rotY, cfg.rotZ);
    plane.scale.set(...cfg.scale);
    sunbeamGroup.add(plane);
  });
  root.add(sunbeamGroup);

  // Floating golden sunlit dust motes gleaming inside the diagonal window sunbeam!
  const moteCount = 190;
  const moteGeo = new THREE.BufferGeometry();
  const motePositions = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount);
  const moteSizes = new Float32Array(moteCount);

  for (let i = 0; i < moteCount; i++) {
    const x = -3.8 + Math.random() * 7.2;
    const y = 0.25 + Math.random() * 3.6;
    const z = -2.2 + Math.random() * 4.0;
    motePositions[i * 3] = x;
    motePositions[i * 3 + 1] = y;
    motePositions[i * 3 + 2] = z;
    moteSeeds[i] = Math.random() * Math.PI * 2;
    moteSizes[i] = 3.2 + Math.pow(Math.random(), 2.3) * 10.5;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeeds, 1));
  moteGeo.setAttribute('aSize', new THREE.BufferAttribute(moteSizes, 1));

  const moteMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: textures.dustMote },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.24 + aSeed * 1.7) * 0.20 + cos(uTime * 0.11 + aSeed) * 0.10;
        p.y += sin(uTime * 0.18 + aSeed * 2.3) * 0.14 + mod(uTime * 0.022 + aSeed, 1.0) * 0.16 - 0.08;
        p.z += cos(uTime * 0.21 + aSeed * 1.3) * 0.16;

        float beamDist = abs(p.y - (1.62 - 0.50 * p.x));
        float inBeam = smoothstep(1.85, 0.18, beamDist) * smoothstep(3.2, -2.2, p.x);
        float twinkle = 0.52 + 0.48 * sin(uTime * 1.9 + aSeed * 5.3);
        vAlpha = (0.06 + 0.84 * inBeam) * twinkle;

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (4.4 / max(-mvPos.z, 1.0));
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(t.rgb * vec3(1.0, 0.92, 0.72), t.a * vAlpha * 0.78);
      }
    `,
  });
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  root.add(dustMotes);

  // =========================================================================
  // 3. RECESSED STOVE BURNER, LIVE GAS FLAME & INTERACTIVE HEAT DIAL
  // =========================================================================
  const stovePos = new THREE.Vector3(-0.34, 0, 0.06);
  const stoveGroup = new THREE.Group();
  stoveGroup.position.copy(stovePos);
  root.add(stoveGroup);

  addContactShadow(stoveGroup, 1.56, 1.48, 0.003, 0.48, 0.06, 0.20);

  const stoveGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x161619,
    roughness: 0.14,
    metalness: 0.18,
    clearcoat: 0.88,
    clearcoatRoughness: 0.10,
  });
  const stovePlate = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.055, 2.58), stoveGlassMat);
  stovePlate.position.set(0, 0.028, 0.16);
  stovePlate.receiveShadow = true;
  stoveGroup.add(stovePlate);

  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: 0xc2beb8,
    roughness: 0.28,
    metalness: 0.86,
  });
  const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.024, 10, 42), metalTrimMat);
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.set(0, 0.072, -0.04);
  stoveGroup.add(trimRing);

  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x201e1c,
    roughness: 0.74,
    metalness: 0.46,
  });
  const grateRing = new THREE.Mesh(new THREE.TorusGeometry(0.81, 0.034, 8, 32), grateMat);
  grateRing.rotation.x = Math.PI / 2;
  grateRing.position.set(0, 0.135, -0.04);
  grateRing.castShadow = true;
  stoveGroup.add(grateRing);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.082, 0.052), grateMat);
    prong.position.set(Math.cos(a) * 0.70, 0.125, -0.04 + Math.sin(a) * 0.70);
    prong.rotation.y = -a;
    prong.castShadow = true;
    stoveGroup.add(prong);
  }

  const burnerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.39, 0.075, 24), grateMat);
  burnerHead.position.set(0, 0.088, -0.04);
  stoveGroup.add(burnerHead);

  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0.112, -0.04);
  stoveGroup.add(flameGroup);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x3f9eff,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameTipsMat = new THREE.MeshBasicMaterial({
    color: 0xff9a38,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameCones = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 6), i % 4 === 0 ? flameTipsMat : flameMat);
    f.position.set(Math.cos(a) * 0.41, 0.02, Math.sin(a) * 0.41);
    f.rotation.z = -Math.cos(a) * 1.1;
    f.rotation.x = Math.sin(a) * 1.1;
    flameGroup.add(f);
    flameCones.push(f);
  }

  const flameLight = new THREE.PointLight(0xff8e42, 0.85, 2.8, 2.0);
  flameLight.position.set(0, 0.16, -0.04);
  stoveGroup.add(flameLight);

  // Interactive Stove Heat Dial
  const knobPivot = new THREE.Group();
  knobPivot.position.set(-0.92, 0.075, 1.14);
  stoveGroup.add(knobPivot);

  const knobBase = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.185, 0.048, 24), metalTrimMat);
  knobPivot.add(knobBase);

  const knobDial = new THREE.Group();
  knobDial.position.y = 0.062;
  knobPivot.add(knobDial);

  const knobBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.138, 0.15, 0.088, 24),
    new THREE.MeshStandardMaterial({ color: 0x262422, roughness: 0.34, metalness: 0.46 })
  );
  knobBody.castShadow = true;
  knobDial.add(knobBody);

  const knobRidge = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.044, 0.24), metalTrimMat);
  knobRidge.position.y = 0.044;
  knobDial.add(knobRidge);

  const knobDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff6b28 })
  );
  knobDot.position.set(0, 0.066, -0.086);
  knobDial.add(knobDot);

  // =========================================================================
  // 4. SEASONED HEAVY CAST-IRON SKILLET (ANIMATED PIVOT FOR FLIPPING!)
  // =========================================================================
  const skilletAnchor = new THREE.Group();
  skilletAnchor.position.set(stovePos.x, 0.182, stovePos.z - 0.04);
  root.add(skilletAnchor);

  const skilletGroup = new THREE.Group();
  skilletAnchor.add(skilletGroup);

  const castIronMat = new THREE.MeshPhysicalMaterial({
    map: textures.castIron.map,
    roughnessMap: textures.castIron.roughnessMap,
    bumpMap: textures.castIron.bumpMap,
    bumpScale: 0.013,
    roughness: 0.58,
    metalness: 0.64,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34,
  });

  const panProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.82, 0.0),
    new THREE.Vector2(0.93, 0.045),
    new THREE.Vector2(1.03, 0.205),
    new THREE.Vector2(1.05, 0.235),
    new THREE.Vector2(1.00, 0.24),
    new THREE.Vector2(0.96, 0.195),
    new THREE.Vector2(0.86, 0.062),
    new THREE.Vector2(0.80, 0.045),
    new THREE.Vector2(0.0, 0.045),
  ];
  const skilletMesh = new THREE.Mesh(new THREE.LatheGeometry(panProfile, 48), castIronMat);
  skilletMesh.castShadow = true;
  skilletMesh.receiveShadow = true;
  skilletGroup.add(skilletMesh);

  const panOilMat = new THREE.MeshPhysicalMaterial({
    color: 0x181513,
    map: textures.castIron.map,
    roughnessMap: textures.castIron.roughnessMap,
    bumpMap: textures.castIron.bumpMap,
    bumpScale: 0.008,
    roughness: 0.26,
    metalness: 0.48,
    clearcoat: 0.60,
    clearcoatRoughness: 0.20,
  });
  const panFloor = new THREE.Mesh(new THREE.CircleGeometry(0.81, 40), panOilMat);
  panFloor.rotation.x = -Math.PI / 2;
  panFloor.position.y = 0.048;
  panFloor.receiveShadow = true;
  skilletGroup.add(panFloor);

  const handleGroup = new THREE.Group();
  handleGroup.position.set(0.45, 0.205, 0.85);
  handleGroup.rotation.y = -1.08;
  skilletGroup.add(handleGroup);

  const tang = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.062, 0.135), castIronMat);
  tang.position.set(0.13, 0.02, 0);
  tang.rotation.z = 0.16;
  tang.castShadow = true;
  handleGroup.add(tang);

  const walnutMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    roughnessMap: textures.wood.roughnessMap,
    color: 0x6f4328,
    roughness: 0.42,
    metalness: 0.04,
  });
  const handleWoodGeo = new THREE.CylinderGeometry(0.066, 0.084, 0.96, 18);
  handleWoodGeo.rotateZ(-Math.PI / 2);
  const handleWood = new THREE.Mesh(handleWoodGeo, walnutMat);
  handleWood.position.set(0.71, 0.115, 0);
  handleWood.rotation.z = 0.16;
  handleWood.castShadow = true;
  handleGroup.add(handleWood);

  const brassFerrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.070, 0.070, 0.078, 18).rotateZ(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xc99c52, roughness: 0.26, metalness: 0.88 })
  );
  brassFerrule.position.set(0.26, 0.040, 0);
  brassFerrule.rotation.z = 0.16;
  handleGroup.add(brassFerrule);

  const handleGripPoint = new THREE.Object3D();
  handleGripPoint.position.set(0.68, 0.12, 0);
  handleGroup.add(handleGripPoint);

  // =========================================================================
  // 5. CERAMIC BATTER BOWL & STAINLESS LADLE (LEFT FOREGROUND - INVITING!)
  // =========================================================================
  const bowlPos = new THREE.Vector3(-1.88, 0, 0.56);
  const bowlGroup = new THREE.Group();
  bowlGroup.position.copy(bowlPos);
  root.add(bowlGroup);

  addContactShadow(bowlGroup, 0.76, 0.72, 0.004, 0.68, 0.08, 0.05);

  const ceramicOutsideMat = new THREE.MeshPhysicalMaterial({
    color: 0xede4d6,
    map: textures.stoneware.map,
    roughnessMap: textures.stoneware.roughnessMap,
    roughness: 0.28,
    clearcoat: 0.68,
    clearcoatRoughness: 0.18,
  });
  const bowlProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.43, 0.0),
    new THREE.Vector2(0.62, 0.15),
    new THREE.Vector2(0.71, 0.42),
    new THREE.Vector2(0.74, 0.60),
    new THREE.Vector2(0.68, 0.62),
    new THREE.Vector2(0.63, 0.43),
    new THREE.Vector2(0.52, 0.15),
    new THREE.Vector2(0.35, 0.052),
    new THREE.Vector2(0.0, 0.052),
  ];
  const bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 36), ceramicOutsideMat);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  bowlGroup.add(bowlMesh);

  const batterLiquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2c17d,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
  });
  const bowlBatter = new THREE.Mesh(new THREE.CircleGeometry(0.64, 32), batterLiquidMat);
  bowlBatter.rotation.x = -Math.PI / 2;
  bowlBatter.position.y = 0.44;
  bowlBatter.receiveShadow = true;
  bowlGroup.add(bowlBatter);

  const ladleGroup = new THREE.Group();
  const ladleRestPos = new THREE.Vector3(bowlPos.x + 0.06, 0.42, bowlPos.z - 0.02);
  ladleGroup.position.copy(ladleRestPos);
  ladleGroup.rotation.set(0.18, 0.35, -0.58);
  root.add(ladleGroup);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe6e8ea,
    roughness: 0.16,
    metalness: 0.94,
  });

  const ladleCup = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 24, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    steelMat
  );
  ladleCup.castShadow = true;
  ladleGroup.add(ladleCup);

  const ladleBatter = new THREE.Mesh(new THREE.CircleGeometry(0.21, 22), batterLiquidMat);
  ladleBatter.rotation.x = -Math.PI / 2;
  ladleBatter.position.y = 0.015;
  ladleGroup.add(ladleBatter);

  const ladleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.90, 12), steelMat);
  ladleStem.position.set(-0.20, 0.44, 0);
  ladleStem.rotation.z = 0.26;
  ladleStem.castShadow = true;
  ladleGroup.add(ladleStem);

  const ladleWoodGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.40, 14), walnutMat);
  ladleWoodGrip.position.set(-0.33, 0.95, 0);
  ladleWoodGrip.rotation.z = 0.26;
  ladleWoodGrip.castShadow = true;
  ladleGroup.add(ladleWoodGrip);

  const batterPourGeo = new THREE.CylinderGeometry(0.042, 0.064, 1.0, 14, 10, false);
  batterPourGeo.translate(0, -0.5, 0);
  const batterPourStream = new THREE.Mesh(batterPourGeo, batterLiquidMat);
  batterPourStream.visible = false;
  root.add(batterPourStream);

  // =========================================================================
  // 6. ARTISANAL JAPANESE STONEWARE PLATE & INTERACTIVE FORK (RIGHT HERO!)
  // =========================================================================
  const platePos = new THREE.Vector3(1.42, 0, 0.16);
  const plateGroup = new THREE.Group();
  plateGroup.position.copy(platePos);
  root.add(plateGroup);

  addContactShadow(plateGroup, 1.08, 1.04, 0.025, 0.58, 0.06, 0.04);

  const plateMat = new THREE.MeshPhysicalMaterial({
    map: textures.stoneware.map,
    roughnessMap: textures.stoneware.roughnessMap,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.50,
    clearcoatRoughness: 0.24,
  });
  const plateProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.72, 0.0),
    new THREE.Vector2(0.80, 0.04),
    new THREE.Vector2(0.99, 0.14),
    new THREE.Vector2(1.02, 0.16),
    new THREE.Vector2(0.97, 0.17),
    new THREE.Vector2(0.80, 0.084),
    new THREE.Vector2(0.68, 0.066),
    new THREE.Vector2(0.0, 0.066),
  ];
  const plateMesh = new THREE.Mesh(new THREE.LatheGeometry(plateProfile, 48), plateMat);
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  plateGroup.add(plateMesh);

  // Woven oatmeal linen placemat under plate
  const matLinen = new THREE.Mesh(
    new THREE.BoxGeometry(2.38, 0.020, 2.12),
    new THREE.MeshStandardMaterial({
      map: textures.linen.map,
      bumpMap: textures.linen.bumpMap,
      bumpScale: 0.010,
      color: 0xd5c4b0,
      roughness: 0.92,
    })
  );
  matLinen.position.set(0.08, 0.010, 0.04);
  matLinen.receiveShadow = true;
  plateGroup.add(matLinen);

  // Shiny stainless dessert fork resting beside the plate (interactive tasting reward!)
  const forkRestPos = new THREE.Vector3(platePos.x + 1.06, 0.042, platePos.z + 0.10);
  const forkGroup = new THREE.Group();
  forkGroup.position.copy(forkRestPos);
  forkGroup.rotation.y = 0.08;
  root.add(forkGroup);

  const forkHandle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.020, 0.78), steelMat);
  forkHandle.position.z = 0.22;
  forkHandle.castShadow = true;
  forkGroup.add(forkHandle);

  const forkHead = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.016, 0.13), steelMat);
  forkHead.position.set(0, 0.005, -0.19);
  forkGroup.add(forkHead);
  for (let t = -1.5; t <= 1.5; t += 1) {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.013, 0.24), steelMat);
    tine.position.set(t * 0.034, 0.007, -0.35);
    forkGroup.add(tine);
  }

  // =========================================================================
  // 7. CERAMIC BUTTER DISH WITH CHAMFERED BUTTER PATS & BUTTER KNIFE
  // =========================================================================
  const butterDishPos = new THREE.Vector3(0.96, 0, 1.38);
  const butterDishGroup = new THREE.Group();
  butterDishGroup.position.copy(butterDishPos);
  butterDishGroup.rotation.y = -0.16;
  root.add(butterDishGroup);

  addContactShadow(butterDishGroup, 0.56, 0.42, 0.004, 0.60, 0.05, 0.04);

  // Softly chamfered stoneware butter tray with recessed inner well
  const butterTray = new THREE.Mesh(createChamferedBoxGeometry(0.84, 0.068, 0.58, 0.024, 5), ceramicOutsideMat);
  butterTray.position.y = 0.034;
  butterTray.castShadow = true;
  butterTray.receiveShadow = true;
  butterDishGroup.add(butterTray);

  const coldButterMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4dc7a,
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.32,
    sheen: 0.36,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0xfff4c2),
  });

  // Softly chamfered authentic stick of cold Hokkaido butter (no harsh CG cube corners!)
  const butterStick = new THREE.Mesh(createChamferedBoxGeometry(0.38, 0.165, 0.31, 0.022, 6), coldButterMat);
  butterStick.position.set(-0.15, 0.15, -0.01);
  butterStick.castShadow = true;
  butterStick.receiveShadow = true;
  butterDishGroup.add(butterStick);

  // Ready-to-grab sliced square pat with rounded butter-knife edges
  const readyButterPat = new THREE.Mesh(createChamferedBoxGeometry(0.20, 0.098, 0.20, 0.018, 5), coldButterMat);
  readyButterPat.position.set(0.18, 0.118, 0.02);
  readyButterPat.rotation.y = 0.16;
  readyButterPat.castShadow = true;
  butterDishGroup.add(readyButterPat);

  // Small brushed-stainless butter spreader knife resting on right front rim of dish
  const knifeGroup = new THREE.Group();
  knifeGroup.position.set(0.18, 0.088, 0.21);
  knifeGroup.rotation.set(0, -0.15, 0);
  butterDishGroup.add(knifeGroup);
  const knifeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.012, 0.056), steelMat);
  knifeBlade.position.x = -0.10;
  knifeBlade.castShadow = true;
  knifeGroup.add(knifeBlade);
  const knifeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.28, 12).rotateZ(Math.PI / 2), walnutMat);
  knifeHandle.position.x = 0.18;
  knifeHandle.castShadow = true;
  knifeGroup.add(knifeHandle);

  // =========================================================================
  // 8. CRYSTAL-CLEAR GLASS MAPLE SYRUP CARAFE WITH GOLDEN-AMBER SYRUP
  // =========================================================================
  const syrupRestPos = new THREE.Vector3(2.04, 0, 1.08);
  const syrupGroup = new THREE.Group();
  syrupGroup.position.copy(syrupRestPos);
  root.add(syrupGroup);

  addContactShadow(syrupGroup, 0.44, 0.42, 0.004, 0.65, 0.06, 0.04);

  // Sparkling crystal-clear borosilicate glass (ultra-clean transparency + crisp grazing edge refraction!)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.015,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.012,
    envMapIntensity: 1.85,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
  });
  glassMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `float gFres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.4);
       gl_FragColor.a = clamp(gl_FragColor.a + gFres * 0.56, 0.0, 0.72);
       gl_FragColor.rgb += vec3(1.0, 0.96, 0.88) * gFres * 0.32;
       #include <dithering_fragment>`
    );
  };

  const pitcherProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.30, 0.0),
    new THREE.Vector2(0.36, 0.15),
    new THREE.Vector2(0.34, 0.44),
    new THREE.Vector2(0.22, 0.68),
    new THREE.Vector2(0.26, 0.84),
    new THREE.Vector2(0.29, 0.88),
    new THREE.Vector2(0.25, 0.88),
    new THREE.Vector2(0.19, 0.68),
    new THREE.Vector2(0.31, 0.43),
    new THREE.Vector2(0.32, 0.15),
    new THREE.Vector2(0.26, 0.042),
    new THREE.Vector2(0.0, 0.042),
  ];
  const pitcherGlass = new THREE.Mesh(new THREE.LatheGeometry(pitcherProfile, 32), glassMat);
  pitcherGlass.renderOrder = 4;
  syrupGroup.add(pitcherGlass);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.22, 0.70, 0),
    new THREE.Vector3(0.45, 0.64, 0),
    new THREE.Vector3(0.47, 0.36, 0),
    new THREE.Vector3(0.33, 0.22, 0),
  ]);
  const pitcherHandle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 16, 0.032, 10, false), glassMat);
  pitcherHandle.renderOrder = 4;
  syrupGroup.add(pitcherHandle);

  // Authentic deep golden-amber backlit Grade-A maple syrup inside carafe!
  const amberSyrupMat = createAmberSyrupMaterial({ opacity: 0.91, depthWrite: true });
  const syrupInnerProfile = [
    new THREE.Vector2(0.0, 0.045),
    new THREE.Vector2(0.255, 0.045),
    new THREE.Vector2(0.312, 0.15),
    new THREE.Vector2(0.302, 0.42),
    new THREE.Vector2(0.245, 0.54),
    new THREE.Vector2(0.0, 0.54),
  ];
  const syrupLiquidMesh = new THREE.Mesh(new THREE.LatheGeometry(syrupInnerProfile, 28), amberSyrupMat);
  syrupLiquidMesh.renderOrder = 3;
  syrupLiquidMesh.castShadow = true;
  syrupGroup.add(syrupLiquidMesh);

  const pitcherSpout = new THREE.Object3D();
  pitcherSpout.position.set(-0.29, 0.86, 0);
  syrupGroup.add(pitcherSpout);

  // =========================================================================
  // 9. SMALL BOWL OF GLOSSY FRESH STRAWBERRIES (RIGHT MIDGROUND)
  // =========================================================================
  const berryDishPos = new THREE.Vector3(2.08, 0, -0.58);
  const berryDishGroup = new THREE.Group();
  berryDishGroup.position.copy(berryDishPos);
  root.add(berryDishGroup);

  addContactShadow(berryDishGroup, 0.44, 0.42, 0.004, 0.60, 0.05, 0.04);

  const berryBowlProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.26, 0.0),
    new THREE.Vector2(0.39, 0.11),
    new THREE.Vector2(0.42, 0.26),
    new THREE.Vector2(0.38, 0.27),
    new THREE.Vector2(0.34, 0.13),
    new THREE.Vector2(0.22, 0.042),
    new THREE.Vector2(0.0, 0.042),
  ];
  const berryBowl = new THREE.Mesh(new THREE.LatheGeometry(berryBowlProfile, 28), ceramicOutsideMat);
  berryBowl.castShadow = true;
  berryBowl.receiveShadow = true;
  berryDishGroup.add(berryBowl);

  const berryMat = new THREE.MeshPhysicalMaterial({
    map: textures.strawberry.map,
    bumpMap: textures.strawberry.bumpMap,
    bumpScale: 0.016,
    roughness: 0.22,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14,
  });
  const calyxMat = new THREE.MeshStandardMaterial({ color: 0x377228, roughness: 0.56 });

  function buildStrawberryMesh() {
    const g = new THREE.Group();
    const bGeo = new THREE.SphereGeometry(0.128, 16, 14);
    const pos = bGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const t = (y + 0.128) / 0.256;
      const taper = 0.52 + 0.62 * Math.sin(t * Math.PI * 0.78);
      x *= taper;
      z *= taper;
      y *= 1.18;
      pos.setXYZ(i, x, y, z);
    }
    bGeo.computeVertexNormals();
    const body = new THREE.Mesh(bGeo, berryMat);
    body.castShadow = true;
    g.add(body);

    for (let l = 0; l < 5; l++) {
      const a = (l / 5) * Math.PI * 2;
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.030, 0.090, 5), calyxMat);
      lf.position.set(Math.cos(a) * 0.042, 0.148, Math.sin(a) * 0.042);
      lf.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      g.add(lf);
    }
    return g;
  }

  const dishBerries = [];
  const berryOffsets = [
    [-0.13, 0.19, 0.08, 0.35, 0.4],
    [0.13, 0.20, 0.08, -0.3, -0.35],
    [0.0, 0.21, -0.13, -0.25, 0.2],
    [0.02, 0.30, 0.03, 0.15, -0.2],
    [-0.11, 0.26, -0.05, 0.4, -0.45],
  ];
  berryOffsets.forEach(([x, y, z, rx, rz]) => {
    const b = buildStrawberryMesh();
    b.position.set(x, y, z);
    b.rotation.set(rx, Math.random() * Math.PI, rz);
    berryDishGroup.add(b);
    dishBerries.push(b);
  });

  function update(time, heatLevel) {
    rayMat.uniforms.uTime.value = time;
    moteMat.uniforms.uTime.value = time;

    const cPos = curtainGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const bx = curtainBasePos[i * 3];
      const by = curtainBasePos[i * 3 + 1];
      const sway = Math.max(0, 1 - (by + 2.05) / 4.1);
      const z = Math.sin(time * 1.15 + bx * 2.2 + by * 0.8) * 0.085 * sway + Math.cos(time * 0.65 + by) * 0.045 * sway;
      cPos.setZ(i, z);
    }
    cPos.needsUpdate = true;

    const fScale = 0.55 + heatLevel * 0.65;
    flameLight.intensity = 0.38 + heatLevel * 0.72 + Math.sin(time * 24) * 0.06;
    for (let i = 0; i < flameCones.length; i++) {
      const f = flameCones[i];
      const pulse = 0.86 + 0.18 * Math.sin(time * 28 + i * 1.9);
      f.scale.set(0.85 + heatLevel * 0.25, fScale * pulse, 0.85 + heatLevel * 0.25);
    }

    const targetKnobAngle = -(heatLevel - 0.85) * 1.45;
    knobDial.rotation.y += (targetKnobAngle - knobDial.rotation.y) * 0.14;
  }

  return {
    root,
    stovePos,
    skilletAnchor,
    skilletGroup,
    skilletMesh,
    handleGroup,
    handleGripPoint,
    knobPivot,
    bowlPos,
    bowlGroup,
    bowlBatter,
    ladleGroup,
    ladleRestPos,
    ladleBatter,
    batterPourStream,
    platePos,
    plateGroup,
    plateMesh,
    forkGroup,
    forkRestPos,
    butterDishPos,
    butterDishGroup,
    readyButterPat,
    syrupRestPos,
    syrupGroup,
    syrupLiquidMesh,
    pitcherSpout,
    berryDishPos,
    berryDishGroup,
    dishBerries,
    buildStrawberryMesh,
    amberSyrupMat,
    coldButterMat,
    createAmberSyrupMaterial,
    update,
  };
}
