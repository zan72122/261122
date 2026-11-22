import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Sculpted Boiled Octopus Tentacle Chunk with 3D White-Rimmed Suction Cups ("タコ")
function buildOctopusChunkGeometry() {
  const group = new THREE.Group();
  return group;
}

function createOctopusChunkMesh(textures, scale = 1.0) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: textures.octopusMap,
    normalMap: textures.octopusNormalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.22,
    clearcoat: 0.86,
    clearcoatRoughness: 0.14,
  });
  const suckerMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7ece8,
    roughness: 0.28,
    clearcoat: 0.75,
  });

  // Plump tapered cut tentacle segment
  const segGeo = new THREE.CylinderGeometry(0.0095, 0.0125, 0.021, 18, 8);
  const pos = segGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const bend = (y / 0.0105) * (y / 0.0105) * 0.0028;
    pos.setX(i, pos.getX(i) + bend);
  }
  segGeo.computeVertexNormals();
  const body = new THREE.Mesh(segGeo, bodyMat);
  body.rotation.z = 0.45;
  body.rotation.x = 0.25;
  body.castShadow = true;
  g.add(body);

  // 3 realistic suction cups along outer curve
  for (let i = -1; i <= 1; i++) {
    const cup = new THREE.Mesh(new THREE.TorusGeometry(0.0032, 0.0013, 8, 14), suckerMat);
    cup.position.set(0.0095 + Math.abs(i) * 0.001, i * 0.0055, 0.003 * i);
    cup.rotation.y = Math.PI / 2 - i * 0.2;
    body.add(cup);
  }

  g.scale.setScalar(scale);
  return g;
}

// Custom PBR Takoyaki Crust Material: raw creamy batter -> golden Maillard blistered sphere!
function createTakoyakiBallMaterial(textures) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: textures.takoRawMap,
    normalMap: textures.takoNormalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.20,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xffe1a8),
    envMapIntensity: 0.95,
  });

  const uniforms = {
    uBakedMap: { value: textures.takoBakedMap },
    uBakeTop: { value: 0.0 },
    uBakeBottom: { value: 0.0 },
    uCrispness: { value: 0.0 },
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBakedMap = uniforms.uBakedMap;
    shader.uniforms.uBakeTop = uniforms.uBakeTop;
    shader.uniforms.uBakeBottom = uniforms.uBakeBottom;
    shader.uniforms.uCrispness = uniforms.uCrispness;

    shader.vertexShader =
      'varying vec3 vLocalPos;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vLocalPos = position;
        `
      );

    shader.fragmentShader =
      'uniform sampler2D uBakedMap;\nuniform float uBakeTop;\nuniform float uBakeBottom;\nuniform float uCrispness;\nvarying vec3 vLocalPos;\n' +
      shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec4 bakedSample = texture2D(uBakedMap, vMapUv);
          float hemiMix = smoothstep(-0.018, 0.018, vLocalPos.y);
          float localBake = mix(uBakeBottom, uBakeTop, hemiMix);
          // Rim toasting ring around equator when cooking in hot cast-iron well
          float rimRing = exp(-pow(vLocalPos.y / 0.012, 2.0)) * clamp((uBakeBottom + uBakeTop) * 0.65, 0.0, 1.0);
          float finalBake = clamp(localBake + rimRing * 0.28, 0.0, 1.35);
          vec3 goldenCol = bakedSample.rgb;
          // Extra savory caramelization if turned crispy
          vec3 extraToast = goldenCol * vec3(0.76, 0.56, 0.38);
          vec3 cookedRgb = mix(goldenCol, extraToast, clamp(finalBake - 0.92, 0.0, 0.45) * 1.4 + uCrispness * 0.25);
          diffuseColor.rgb = mix(diffuseColor.rgb, cookedRgb, smoothstep(0.0, 0.92, finalBake));
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float hemiR = smoothstep(-0.018, 0.018, vLocalPos.y);
          float bAmt = clamp(mix(uBakeBottom, uBakeTop, hemiR), 0.0, 1.0);
          // Wet glossy liquid batter (0.14) -> crispy porous golden crust (0.48)
          roughnessFactor = mix(0.14, 0.48 - uCrispness * 0.08, bAmt);
          `
        );
  };

  mat.userData.uniforms = uniforms;
  return mat;
}

export function createPanAndFood(scene, textures, fx, audio) {
  const root = new THREE.Group();
  scene.add(root);

  // Pan layout constants: 4 columns x 2 rows = 8 large clear wells!
  const COLS = 4;
  const ROWS = 2;
  const PAN_Z = 0.025;
  const PAN_TOP_Y = 0.068;
  const PAN_W = 0.344;
  const PAN_D = 0.188;
  const WELL_R = 0.0365;
  const WELL_DEPTH = 0.034;

  const wellCenters = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const wx = (c - (COLS - 1) * 0.5) * 0.080;
      const wz = PAN_Z + (r - (ROWS - 1) * 0.5) * 0.082;
      wellCenters.push({ col: c, row: r, x: wx, z: wz });
    }
  }

  // 1. Gas Takoyaki Stove Body ("炎たこ" style dark bronze stove with glowing burner vents!)
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(0, 0, PAN_Z);
  root.add(stoveGroup);

  const stoveMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c221d,
    metalness: 0.68,
    roughness: 0.34,
    clearcoat: 0.25,
  });
  // Base stove height kept BELOW carved well bottoms (PAN_TOP_Y - WELL_DEPTH = 0.034) so it NEVER covers the 8 deep cavities!
  const stoveBase = new THREE.Mesh(new RoundedBoxGeometry(PAN_W + 0.026, 0.032, PAN_D + 0.024, 4, 0.006), stoveMat);
  stoveBase.position.y = 0.016;
  stoveBase.castShadow = true;
  stoveBase.receiveShadow = true;
  stoveGroup.add(stoveBase);

  // Warm glowing gas burner slots recessed underneath stove edge (authentic subtle amber glow, NOT a flat white strip!)
  const flameStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(PAN_W * 0.72, 0.0040),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 0.52, 0.12) })
  );
  flameStrip.position.set(0, 0.030, (PAN_D + 0.022) * 0.5 + 0.0005);
  stoveGroup.add(flameStrip);

  // Classic Japanese Brass/Black Gas Ignition Knob on front-right of stove
  const knobDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.014, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a1614, metalness: 0.3, roughness: 0.4 })
  );
  knobDial.rotation.x = Math.PI / 2;
  knobDial.position.set(PAN_W * 0.38, 0.018, (PAN_D + 0.026) * 0.5 + 0.005);
  stoveGroup.add(knobDial);

  // 2. Continuous Sculpted Cast-Iron Takoyaki Plate with 8 Carved Wells & Grid Grooves ("溝")
  textures.ironMap.repeat.set(2.5, 1.5);
  textures.ironRoughnessMap.repeat.set(2.5, 1.5);
  textures.ironNormalMap.repeat.set(3.0, 1.8);

  const ironMat = new THREE.MeshPhysicalMaterial({
    map: textures.ironMap,
    roughnessMap: textures.ironRoughnessMap,
    normalMap: textures.ironNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    metalness: 0.72,
    roughness: 0.36,
    clearcoat: 0.84, // glistening hot oil coat!
    clearcoatRoughness: 0.09,
    clearcoatNormalMap: textures.ironNormalMap,
    clearcoatNormalScale: new THREE.Vector2(0.22, 0.22),
    envMapIntensity: 1.35,
  });

  const gridX = 116;
  const gridZ = 68;
  const plateGeo = new THREE.PlaneGeometry(PAN_W, PAN_D, gridX, gridZ);
  plateGeo.rotateX(-Math.PI / 2);
  const pAttr = plateGeo.attributes.position;

  for (let i = 0; i < pAttr.count; i++) {
    const vx = pAttr.getX(i);
    const vz = pAttr.getZ(i) + PAN_Z;
    let vy = PAN_TOP_Y;

    // Raised outer containment rim around the iron plate so batter overflow pools realistically!
    const edgeX = Math.max(0, (Math.abs(vx) - (PAN_W * 0.5 - 0.013)) / 0.013);
    const edgeZ = Math.max(0, (Math.abs(vz - PAN_Z) - (PAN_D * 0.5 - 0.013)) / 0.013);
    const rim = Math.min(1, Math.max(edgeX, edgeZ));
    vy += Math.sin(rim * Math.PI * 0.5) * 0.0075;

    // Etched cross-grid batter score lines ("溝") between wells
    for (const gx of [-0.079, 0.0, 0.079]) {
      const dg = Math.abs(vx - gx);
      if (dg < 0.0035 && rim < 0.2) {
        vy -= Math.cos((dg / 0.0035) * Math.PI * 0.5) * 0.0016;
      }
    }
    const dgz = Math.abs(vz - PAN_Z);
    if (dgz < 0.0035 && rim < 0.2) {
      vy -= Math.cos((dgz / 0.0035) * Math.PI * 0.5) * 0.0016;
    }

    // Carve smooth hemispherical wells with rounded lip bevel
    for (let w = 0; w < wellCenters.length; w++) {
      const wc = wellCenters[w];
      const dist = Math.hypot(vx - wc.x, vz - wc.z);
      if (dist < WELL_R * 1.08) {
        if (dist < WELL_R) {
          const normR = dist / WELL_R;
          const sphereProfile = Math.sqrt(Math.max(0, 1.0 - normR * normR));
          const smoothLip = THREE.MathUtils.smoothstep(normR, 0.85, 1.0);
          vy -= sphereProfile * WELL_DEPTH * (1.0 - smoothLip * 0.12);
        } else {
          // Subtle raised bead lip right around cavity edge
          const lipT = (dist - WELL_R) / (WELL_R * 0.08);
          vy += Math.sin(lipT * Math.PI) * 0.0009;
        }
      }
    }

    pAttr.setY(i, vy);
  }
  plateGeo.computeVertexNormals();

  const plateMesh = new THREE.Mesh(plateGeo, ironMat);
  plateMesh.position.z = PAN_Z;
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  root.add(plateMesh);

  // Cast-iron outer side walls ONLY around perimeter (hollow inside so all 8 carved wells are 100% open!)
  const borderWallGroup = new THREE.Group();
  root.add(borderWallGroup);
  const wallH = 0.040;
  const wallY = PAN_TOP_Y - wallH * 0.5 + 0.004;
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(PAN_W + 0.008, wallH, 0.008), ironMat);
  frontWall.position.set(0, wallY, PAN_Z + PAN_D * 0.5 + 0.002);
  borderWallGroup.add(frontWall);
  const backWallPan = new THREE.Mesh(new THREE.BoxGeometry(PAN_W + 0.008, wallH, 0.008), ironMat);
  backWallPan.position.set(0, wallY, PAN_Z - PAN_D * 0.5 - 0.002);
  borderWallGroup.add(backWallPan);
  for (const s of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.008, wallH, PAN_D + 0.008), ironMat);
    sideWall.position.set(s * (PAN_W * 0.5 + 0.002), wallY, PAN_Z);
    borderWallGroup.add(sideWall);
  }

  // 3. Per-Well Dynamic Takoyaki Assemblies (Liquid Batter + Overflow Skirt + Octopus + Toppings + Ball + Sauce + Mayo + Dancing Bonito!)
  const ballBaseGeo = new THREE.SphereGeometry(WELL_R * 1.01, 36, 28);
  // Subtle organic hand-cooked asymmetry so spheres never look like plastic billiard balls!
  const bPos = ballBaseGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const x = bPos.getX(i);
    const y = bPos.getY(i);
    const z = bPos.getZ(i);
    const bump = 1.0 + 0.028 * Math.sin(x * 95 + y * 70) * Math.cos(z * 85 - x * 60);
    bPos.setXYZ(i, x * bump, y * bump, z * bump);
  }
  ballBaseGeo.computeVertexNormals();

  // Sauce cap geometry hugging upper crown (0.44 PI) so warm golden-brown baked crust glows visibly underneath drips!
  const sauceGeo = new THREE.SphereGeometry(WELL_R * 1.032, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.44);
  const sPos = sauceGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i);
    const y = sPos.getY(i);
    const z = sPos.getZ(i);
    const ang = Math.atan2(z, x);
    const drip = Math.sin(ang * 5.0 + 0.6) * 0.0042 + Math.cos(ang * 9.0) * 0.0024;
    const edgeMask = THREE.MathUtils.smoothstep(WELL_R * 0.68 - y, 0, WELL_R * 0.55);
    sPos.setY(i, y + drip * edgeMask);
  }
  sauceGeo.computeVertexNormals();

  const sauceMat = new THREE.MeshPhysicalMaterial({
    color: 0x260b03,
    roughness: 0.055,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.85,
  });

  const overflowMat = new THREE.MeshPhysicalMaterial({
    map: textures.takoRawMap,
    normalMap: textures.takoNormalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.18,
    clearcoat: 0.72,
    transparent: true,
    opacity: 0.96,
  });

  const cheeseMat = new THREE.MeshPhysicalMaterial({
    color: 0xffcf54,
    roughness: 0.22,
    clearcoat: 0.75,
  });
  const negiMat = new THREE.MeshStandardMaterial({
    color: 0x3b8c2a,
    roughness: 0.45,
  });
  const aonoriMat = new THREE.MeshStandardMaterial({
    color: 0x21521a,
    roughness: 0.85,
  });
  const mayoMat = new THREE.MeshPhysicalMaterial({
    color: 0xfdf5dc,
    roughness: 0.16,
    clearcoat: 0.88,
    clearcoatRoughness: 0.10,
  });

  // Build curved ribbon geometry for dancing katsuobushi flakes!
  function createBonitoFlakeMesh(seed = 0) {
    const geo = new THREE.PlaneGeometry(0.036, 0.015, 7, 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      map: textures.katsuobushiMap,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      roughness: 0.62,
      color: new THREE.Color().setHSL(0.065 + (seed % 3) * 0.008, 0.48, 0.84),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.basePositions = Float32Array.from(geo.attributes.position.array);
    mesh.userData.phase = seed * 1.73;
    return mesh;
  }

  function createTakoyakiVisualRig() {
    const rig = new THREE.Group();
    const ballMat = createTakoyakiBallMaterial(textures);
    const ballMesh = new THREE.Mesh(ballBaseGeo, ballMat);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    rig.add(ballMesh);

    // Toppings attached to ball so they rotate together when flipped!
    const embeddedGroup = new THREE.Group();
    ballMesh.add(embeddedGroup);

    // Upright toppings attached to rig above sphere (sauce, mayo, aonori, dancing bonito!)
    const uprightToppings = new THREE.Group();
    rig.add(uprightToppings);

    const sauceMesh = new THREE.Mesh(sauceGeo, sauceMat);
    sauceMesh.visible = false;
    sauceMesh.scale.setScalar(0.01);
    uprightToppings.add(sauceMesh);

    // Creamy 3D Mayo Lattice Drizzle (3 organic wavy ribbons across crown)
    const mayoGroup = new THREE.Group();
    mayoGroup.visible = false;
    const mayoPts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const mx = (t - 0.5) * WELL_R * 1.45;
      const mz = Math.sin(t * Math.PI * 3.5) * WELL_R * 0.52;
      const r2 = mx * mx + mz * mz;
      const my = Math.sqrt(Math.max(0.0001, (WELL_R * 1.045) ** 2 - r2));
      mayoPts.push(new THREE.Vector3(mx, my, mz));
    }
    const mayoTube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mayoPts), 28, 0.0024, 8, false),
      mayoMat
    );
    mayoGroup.add(mayoTube);
    uprightToppings.add(mayoGroup);

    // Emerald Aonori flecks sprinkled on sauce (merged into 1 single draw call!)
    const aonoriGeos = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.4;
      const rad = 0.005 + ((i * 7) % 11) * 0.0022;
      const sy = Math.sqrt(Math.max(0.0001, (WELL_R * 1.045) ** 2 - rad * rad));
      const g = new THREE.PlaneGeometry(0.0038, 0.0026);
      const m4 = new THREE.Matrix4();
      const eul = new THREE.Euler(-Math.PI / 2 + Math.sin(a) * 0.3, a, Math.cos(a) * 0.3);
      m4.compose(
        new THREE.Vector3(Math.cos(a) * rad, sy + 0.0005, Math.sin(a) * rad),
        new THREE.Quaternion().setFromEuler(eul),
        new THREE.Vector3(1, 1, 1)
      );
      g.applyMatrix4(m4);
      aonoriGeos.push(g);
    }
    const aonoriGroup = new THREE.Mesh(mergeGeometries(aonoriGeos), aonoriMat);
    aonoriGroup.visible = false;
    uprightToppings.add(aonoriGroup);

    // 7 Dancing Katsuobushi Shavings ("ゆらゆら踊るかつお節")
    const bonitoGroup = new THREE.Group();
    bonitoGroup.visible = false;
    const bonitoFlakes = [];
    for (let k = 0; k < 7; k++) {
      const fl = createBonitoFlakeMesh(k + Math.random() * 5);
      const ang = (k / 7) * Math.PI * 2 + 0.3;
      const rOff = k === 0 ? 0.0 : 0.009 + (k % 2) * 0.008;
      fl.position.set(Math.cos(ang) * rOff, WELL_R * 1.03 + k * 0.0014, Math.sin(ang) * rOff);
      fl.rotation.y = ang + 0.7;
      bonitoGroup.add(fl);
      bonitoFlakes.push(fl);
    }
    uprightToppings.add(bonitoGroup);

    return {
      rig,
      ballMesh,
      ballMat,
      embeddedGroup,
      uprightToppings,
      sauceMesh,
      mayoGroup,
      aonoriGroup,
      bonitoGroup,
      bonitoFlakes,
    };
  }

  // Shimmering hot cooking oil puddle & rim ring inside each well so empty wells read unmistakably at first glance!
  const oilPuddleMat = new THREE.MeshPhysicalMaterial({
    color: 0x261a0e,
    roughness: 0.03,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.4,
  });
  const wellRimHighlightMat = new THREE.MeshPhysicalMaterial({
    color: 0x302925,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 0.95,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.1,
  });

  const wells = wellCenters.map((wc, idx) => {
    const wellGroup = new THREE.Group();
    wellGroup.position.set(wc.x, PAN_TOP_Y, wc.z);
    root.add(wellGroup);

    // Specular seasoned bevel ring + glistening oil pool at cavity bottom
    const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(WELL_R * 1.01, 0.0022, 10, 28), wellRimHighlightMat);
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = 0.0006;
    wellGroup.add(rimTorus);

    const oilPool = new THREE.Mesh(new THREE.CircleGeometry(WELL_R * 0.52, 20), oilPuddleMat);
    oilPool.rotation.x = -Math.PI / 2;
    oilPool.position.y = -WELL_DEPTH + 0.004;
    wellGroup.add(oilPool);

    // Square-rounded overflowing batter skirt ("耳") on flat gridded iron around well!
    const skirtGeo = new THREE.CircleGeometry(WELL_R * 1.48, 28);
    skirtGeo.rotateX(-Math.PI / 2);
    const skirtMeshWell = new THREE.Mesh(skirtGeo, overflowMat.clone());
    skirtMeshWell.position.y = 0.0014;
    skirtMeshWell.visible = false;
    wellGroup.add(skirtMeshWell);

    // Invisible generous touch hit-sphere per well
    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(WELL_R * 1.32, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.userData = { kind: 'well', wellIndex: idx };
    wellGroup.add(hitMesh);

    const visual = createTakoyakiVisualRig();
    visual.rig.visible = false;
    wellGroup.add(visual.rig);

    return {
      index: idx,
      x: wc.x,
      z: wc.z,
      wellGroup,
      skirtMesh: skirtMeshWell,
      hitMesh,
      visual,
      // Simulation state
      fill: 0.0,         // 0..1 well batter volume
      overflow: 0.0,     // 0..1 brimming overflow onto gridded plate ("満杯・溢れ")
      oilBoost: 0.45,    // 0..1 oil gloss & crispness
      octopusCount: 0,   // 0..3 chunks
      hasCheese: false,
      hasNegi: false,
      bakeBottom: 0.0,   // 0..1.3 Maillard browning on initial bottom
      bakeTop: 0.0,      // 0..1.3 Maillard browning on flipped side
      flipCount: 0,      // 0 = unflipped flat batter, 1 = 90deg half-turn, 2+ = 180deg+ round sphere!
      targetRotX: 0,
      targetRotZ: 0,
      sauceAmount: 0.0,  // 0..1
      hasMayo: false,
      bonitoAmount: 0.0, // 0..1
      heat: 0.0,         // 0..1 thermal steam & bonito dance energy
      wobble: 0.0,
      steamTimer: Math.random() * 0.4,
    };
  });

  // 4. Interactive Physical Side Bowls, Utensils & Bamboo Serving Boat (all visible in 1 screen!)
  const propsHitables = [];
  function registerProp(group, propName, radius = 0.068) {
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.04;
    hit.userData = { kind: 'prop', propName };
    group.add(hit);
    propsHitables.push(hit);
    return hit;
  }

  // (A) Brushed Stainless Steel Batter Pitcher ("生地ポット") at right-front (pulled comfortably in-frame!)
  const pitcherRestPos = new THREE.Vector3(0.228, 0.0, 0.118);
  const pitcherGroup = new THREE.Group();
  pitcherGroup.position.copy(pitcherRestPos);
  root.add(pitcherGroup);

  const stainlessMat = new THREE.MeshPhysicalMaterial({
    color: 0xdce2e8,
    metalness: 0.90,
    roughness: 0.22,
    clearcoat: 0.3,
    envMapIntensity: 1.45,
  });
  const pitcherBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.038, 0.105, 28, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xdce2e8,
      metalness: 0.90,
      roughness: 0.22,
      side: THREE.DoubleSide,
      envMapIntensity: 1.45,
    })
  );
  pitcherBody.position.y = 0.053;
  pitcherBody.castShadow = true;
  pitcherGroup.add(pitcherBody);

  const pitcherBottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), stainlessMat);
  pitcherBottom.rotation.x = Math.PI / 2;
  pitcherBottom.position.y = 0.002;
  pitcherGroup.add(pitcherBottom);

  // Creamy liquid batter visible inside the stainless pitcher!
  const pitcherBatterLevel = new THREE.Mesh(
    new THREE.CircleGeometry(0.041, 24),
    new THREE.MeshPhysicalMaterial({ map: textures.takoRawMap, roughness: 0.12, clearcoat: 0.85 })
  );
  pitcherBatterLevel.rotation.x = -Math.PI / 2;
  pitcherBatterLevel.position.y = 0.088;
  pitcherGroup.add(pitcherBatterLevel);

  // Pouring spout pointing toward pan (-X)
  const spout = new THREE.Mesh(
    new THREE.ConeGeometry(0.014, 0.028, 16, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xdce2e8, metalness: 0.9, roughness: 0.22, side: THREE.DoubleSide })
  );
  spout.rotation.z = Math.PI * 0.65;
  spout.position.set(-0.046, 0.102, 0);
  pitcherGroup.add(spout);

  // Warm wooden handle on +X side
  const handleWoodMat = new THREE.MeshStandardMaterial({ map: textures.woodMap, color: 0xb87b46, roughness: 0.48 });
  const pHandle = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0065, 10, 20, Math.PI), handleWoodMat);
  pHandle.rotation.z = -Math.PI / 2;
  pHandle.position.set(0.040, 0.058, 0);
  pitcherGroup.add(pHandle);
  registerProp(pitcherGroup, 'pitcher', 0.072);

  // Dynamic 3D Pouring Batter Stream Mesh (connects spout smoothly to target well!)
  const pourStreamGeo = new THREE.CylinderGeometry(0.0048, 0.0072, 1.0, 14, 10, true);
  const pourStreamMat = new THREE.MeshPhysicalMaterial({
    map: textures.takoRawMap,
    color: 0xfff8e6,
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const pourStreamMesh = new THREE.Mesh(pourStreamGeo, pourStreamMat);
  pourStreamMesh.visible = false;
  root.add(pourStreamMesh);

  // (B) Glazed Ceramic Bowl of Plump Boiled Octopus ("タコ鉢") at left-front
  const octoBowlGroup = new THREE.Group();
  octoBowlGroup.position.set(-0.225, 0, 0.112);
  root.add(octoBowlGroup);

  const indigoCeramicMat = new THREE.MeshPhysicalMaterial({
    color: 0x23384e,
    roughness: 0.16,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  });
  const bowlPts = [
    new THREE.Vector2(0.0, 0.002),
    new THREE.Vector2(0.032, 0.002),
    new THREE.Vector2(0.054, 0.026),
    new THREE.Vector2(0.058, 0.048),
  ];
  const bowlGeo = new THREE.LatheGeometry(bowlPts, 28);
  const octoBowlMesh = new THREE.Mesh(bowlGeo, indigoCeramicMat);
  octoBowlMesh.castShadow = true;
  octoBowlMesh.receiveShadow = true;
  octoBowlGroup.add(octoBowlMesh);

  for (let i = 0; i < 9; i++) {
    const oc = createOctopusChunkMesh(textures, 0.98);
    const a = (i / 8) * Math.PI * 2;
    const r = i === 8 ? 0 : 0.020 + (i % 2) * 0.011;
    oc.position.set(Math.cos(a) * r, 0.032 + (i === 8 ? 0.014 : (i % 2) * 0.006), Math.sin(a) * r);
    oc.rotation.set(i * 0.7, a, i * 0.4);
    octoBowlGroup.add(oc);
  }
  registerProp(octoBowlGroup, 'octopus', 0.072);

  // (C) Ceramic Dish of Melty Cheese Cubes & Chopped Green Negi ("チーズ・ねぎ皿") at left-mid
  const toppingDishGroup = new THREE.Group();
  toppingDishGroup.position.set(-0.262, 0, -0.015);
  root.add(toppingDishGroup);

  const creamCeramicMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8dfd1,
    roughness: 0.20,
    clearcoat: 0.85,
    side: THREE.DoubleSide,
  });
  const dishMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.050, 0.038, 0.022, 24),
    creamCeramicMat
  );
  dishMesh.position.y = 0.011;
  dishMesh.castShadow = true;
  toppingDishGroup.add(dishMesh);

  for (let i = 0; i < 8; i++) {
    const ch = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.010, 0.012, 2, 0.002), cheeseMat);
    ch.position.set(-0.015 + (i % 3) * 0.011, 0.026 + (i > 4 ? 0.007 : 0), -0.012 + Math.floor(i / 3) * 0.011);
    ch.rotation.set(i * 0.3, i * 0.8, 0.2);
    toppingDishGroup.add(ch);
  }
  for (let i = 0; i < 12; i++) {
    const ng = new THREE.Mesh(new THREE.TorusGeometry(0.0052, 0.0018, 6, 12), negiMat);
    ng.rotation.x = Math.PI / 2 + (i % 3) * 0.2;
    ng.position.set(0.014 + ((i * 7) % 10) * 0.0022, 0.025 + (i % 3) * 0.003, -0.015 + ((i * 5) % 10) * 0.003);
    toppingDishGroup.add(ng);
  }
  registerProp(toppingDishGroup, 'topping', 0.064);

  // (D) Oil Brush ("油引き") in small copper saucer at front-left
  const oilPropGroup = new THREE.Group();
  oilPropGroup.position.set(-0.205, 0, 0.195);
  root.add(oilPropGroup);
  const oilSaucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.022, 0.018, 20),
    new THREE.MeshPhysicalMaterial({ color: 0xb56535, metalness: 0.78, roughness: 0.25 })
  );
  oilSaucer.position.y = 0.009;
  oilSaucer.castShadow = true;
  oilPropGroup.add(oilSaucer);
  const restingOilBrush = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.058, 16),
    new THREE.MeshStandardMaterial({ color: 0xb83b2b, roughness: 0.38 })
  );
  restingOilBrush.position.y = 0.038;
  restingOilBrush.rotation.z = -0.15;
  oilPropGroup.add(restingOilBrush);
  registerProp(oilPropGroup, 'oil', 0.055);

  // (E) Resting Takoyaki Pick ("千枚通し") on ceramic rest at front-right
  const pickPropGroup = new THREE.Group();
  pickPropGroup.position.set(0.185, 0, 0.195);
  root.add(pickPropGroup);
  const pickRest = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.010, 0.014, 3, 0.003), creamCeramicMat);
  pickRest.position.y = 0.005;
  pickPropGroup.add(pickRest);
  const restingPickVisual = new THREE.Group();
  const rPickH = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.082, 14), handleWoodMat);
  rPickH.rotation.z = Math.PI / 2;
  rPickH.position.set(0.032, 0.013, 0);
  restingPickVisual.add(rPickH);
  const rPickS = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0006, 0.075, 10), stainlessMat);
  rPickS.rotation.z = Math.PI / 2;
  rPickS.position.set(-0.042, 0.012, 0);
  restingPickVisual.add(rPickS);
  restingPickVisual.rotation.y = 0.35;
  pickPropGroup.add(restingPickVisual);
  registerProp(pickPropGroup, 'pick', 0.062);

  // (F) Dark Glazed Sauce Tsubo & Brush ("特製ソース壺") + Mayo Squeeze Bottle at right-mid
  const saucePropGroup = new THREE.Group();
  saucePropGroup.position.set(0.258, 0, -0.010);
  root.add(saucePropGroup);
  const saucePot = new THREE.Mesh(bowlGeo, new THREE.MeshPhysicalMaterial({
    color: 0x30170c,
    roughness: 0.14,
    clearcoat: 0.95,
    side: THREE.DoubleSide,
  }));
  saucePot.scale.set(0.84, 0.95, 0.84);
  saucePot.castShadow = true;
  saucePropGroup.add(saucePot);
  const potSaucePool = new THREE.Mesh(new THREE.CircleGeometry(0.042, 20), sauceMat);
  potSaucePool.rotation.x = -Math.PI / 2;
  potSaucePool.position.y = 0.036;
  saucePropGroup.add(potSaucePool);
  const restingBrushStick = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0065, 0.075, 12), handleWoodMat);
  restingBrushStick.position.set(0.012, 0.058, 0);
  restingBrushStick.rotation.z = -0.35;
  saucePropGroup.add(restingBrushStick);
  registerProp(saucePropGroup, 'sauce', 0.062);

  // Mayo Squeeze Bottle beside sauce
  const mayoPropGroup = new THREE.Group();
  mayoPropGroup.position.set(0.322, 0, 0.042);
  root.add(mayoPropGroup);
  const mayoBottleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.021, 0.088, 18),
    new THREE.MeshPhysicalMaterial({ color: 0xfbf4dc, roughness: 0.3, clearcoat: 0.4 })
  );
  mayoBottleMesh.position.y = 0.044;
  mayoBottleMesh.castShadow = true;
  mayoPropGroup.add(mayoBottleMesh);
  const mayoNozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.011, 0.024, 14),
    new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.35 })
  );
  mayoNozzle.position.y = 0.100;
  mayoPropGroup.add(mayoNozzle);
  registerProp(mayoPropGroup, 'mayo', 0.054);

  // (G) Wooden Bowl of Fluffy Katsuobushi ("かつお節鉢") at right-back
  const bonitoPropGroup = new THREE.Group();
  bonitoPropGroup.position.set(0.242, 0, -0.112);
  root.add(bonitoPropGroup);
  const woodBowl = new THREE.Mesh(bowlGeo, handleWoodMat);
  woodBowl.scale.set(0.88, 0.85, 0.88);
  woodBowl.castShadow = true;
  bonitoPropGroup.add(woodBowl);
  for (let i = 0; i < 18; i++) {
    const fl = createBonitoFlakeMesh(i);
    const a = (i / 18) * Math.PI * 2;
    const rad = (i % 3) * 0.012;
    fl.position.set(Math.cos(a) * rad, 0.032 + (i % 4) * 0.004, Math.sin(a) * rad);
    fl.rotation.set((Math.random() - 0.5) * 0.5, a, (Math.random() - 0.5) * 0.5);
    bonitoPropGroup.add(fl);
  }
  registerProp(bonitoPropGroup, 'bonito', 0.064);

  // (H) Traditional Curved Natural Bamboo Serving Boat ("たこ焼き舟皿") right in front of Mom & Dad!
  const boatGroup = new THREE.Group();
  boatGroup.position.set(0, 0.0, -0.125);
  root.add(boatGroup);

  const bambooMat = new THREE.MeshPhysicalMaterial({
    color: 0xe4c794,
    roughness: 0.56,
    clearcoat: 0.15,
    side: THREE.DoubleSide,
  });
  // Sculpted canoe-like thin curved wood veneer boat
  const boatGeo = new THREE.PlaneGeometry(0.235, 0.105, 32, 16);
  boatGeo.rotateX(-Math.PI / 2);
  const bp = boatGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const z = bp.getZ(i);
    const nx = x / 0.1175; // -1..1
    const nz = z / 0.0525; // -1..1
    // Taper ends like a wooden takoyaki boat!
    const widthScale = Math.max(0.18, 1.0 - Math.pow(Math.abs(nx), 2.1) * 0.82);
    const sz = z * widthScale;
    const lift = Math.pow(nz, 2) * 0.018 + Math.pow(nx, 2) * 0.014;
    bp.setXYZ(i, x, 0.004 + lift, sz);
  }
  boatGeo.computeVertexNormals();
  const boatMesh = new THREE.Mesh(boatGeo, bambooMat);
  boatMesh.castShadow = true;
  boatMesh.receiveShadow = true;
  boatGroup.add(boatMesh);
  registerProp(boatGroup, 'boat', 0.048);

  // Pool of up to 6 plated takoyaki slots on the bamboo boat
  const boatSlots = [];
  for (let i = 0; i < 6; i++) {
    const bx = (i - 2.5) * 0.032;
    const bz = (i % 2 === 0 ? -0.008 : 0.008);
    const vis = createTakoyakiVisualRig();
    vis.rig.position.set(bx, 0.034, bz);
    vis.rig.visible = false;
    boatGroup.add(vis.rig);
    boatSlots.push({ occupied: false, vis, heat: 0, hasCheese: false, octopusCount: 1 });
  }

  // Dynamic 3D Elastic Melted Cheese Strand ("とろ〜り伸びるチーズ"!)
  const cheeseStrandGeo = new THREE.CylinderGeometry(0.0022, 0.0038, 1.0, 10, 8);
  const cheeseStrandMesh = new THREE.Mesh(cheeseStrandGeo, cheeseMat);
  cheeseStrandMesh.visible = false;
  root.add(cheeseStrandMesh);

  // Also a dedicated visual rig for the Takoyaki currently lifted on the player's bamboo toothpick!
  const liftedVisual = createTakoyakiVisualRig();
  liftedVisual.rig.visible = false;

  // Prop subtle wobble timers (when tapped out-of-turn, responds gently!)
  const propWobbles = {
    pitcher: 0,
    octopus: 0,
    topping: 0,
    oil: 0,
    pick: 0,
    sauce: 0,
    mayo: 0,
    bonito: 0,
    boat: 0,
  };

  function pulseProp(name) {
    if (propWobbles[name] !== undefined) propWobbles[name] = 1.0;
  }

  function syncVisualFromData(vis, data) {
    const u = vis.ballMat.userData.uniforms;
    if (u) {
      u.uBakeBottom.value = data.bakeBottom;
      u.uBakeTop.value = data.bakeTop;
      u.uCrispness.value = data.oilBoost;
    }
    if (data.sauceAmount > 0.02) {
      vis.sauceMesh.visible = true;
      // Keep X/Z radius strictly >= 1.02 so glossy mahogany sauce cap ALWAYS wraps outside the golden crust!
      const cov = Math.min(1, data.sauceAmount);
      vis.sauceMesh.scale.set(1.015, THREE.MathUtils.lerp(0.45, 1.02, cov), 1.015);
      vis.sauceMesh.position.y = (1.0 - cov) * 0.008;
    } else {
      vis.sauceMesh.visible = false;
    }
    vis.mayoGroup.visible = Boolean(data.hasMayo);
    vis.aonoriGroup.visible = data.sauceAmount > 0.45;
    vis.bonitoGroup.visible = data.bonitoAmount > 0.05;
  }

  // Actions on Wells
  function pourBatterIntoWell(wIdx, dt) {
    const w = wells[wIdx];
    const prevFill = w.fill;
    w.fill = Math.min(1.0, w.fill + dt * 1.65);

    if (prevFill >= 0.92) {
      // Overflow across gridded iron ("満杯に貯める・溢れさせる")!
      w.overflow = Math.min(1.0, w.overflow + dt * 1.15);
      // Spill naturally into immediate neighboring empty/low wells!
      if (w.overflow > 0.45) {
        for (const nb of wells) {
          if (nb.index !== wIdx && Math.hypot(nb.x - w.x, nb.z - w.z) < 0.095 && nb.fill < 0.85) {
            nb.fill = Math.min(0.85, nb.fill + dt * 0.55);
          }
        }
      }
    }

    w.heat = Math.min(1.0, w.heat + dt * 1.4);
    if (Math.random() < 0.45) {
      fx.spawnSteam(w.x, PAN_TOP_Y + 0.015, w.z, {
        size0: 0.025,
        size1: 0.095,
        vy: 0.11,
        alpha: 0.22,
      });
    }
    if (Math.random() < 0.35) {
      fx.spawnOilSplatter(w.x, PAN_TOP_Y + 0.005, w.z, 2, 0.85);
    }
  }

  function dropOctopusIntoWell(wIdx) {
    const w = wells[wIdx];
    if (w.fill < 0.15) {
      // Auto-splash a generous base of batter if child drops octopus into an empty well so causality never breaks!
      w.fill = 0.82;
    }
    if (w.octopusCount >= 3) return false;
    w.octopusCount++;
    w.wobble = 1.0;
    w.heat = Math.min(1.0, w.heat + 0.35);

    const chunk = createOctopusChunkMesh(textures, w.octopusCount === 1 ? 1.08 : 0.96);
    const angle = (w.octopusCount - 1) * 2.1;
    const rad = w.octopusCount === 1 ? 0.0 : 0.013;
    chunk.position.set(
      Math.cos(angle) * rad,
      w.flipCount >= 2 ? WELL_R * 0.65 : WELL_R * 0.38,
      Math.sin(angle) * rad
    );
    chunk.rotation.set(0.35 * w.octopusCount, angle, 0.25);
    w.visual.embeddedGroup.add(chunk);

    audio.playOctopusDrop();
    fx.spawnSteam(w.x, PAN_TOP_Y + 0.02, w.z, { size0: 0.035, size1: 0.12, alpha: 0.26 });
    fx.spawnOilSplatter(w.x, PAN_TOP_Y + 0.01, w.z, 6, 1.15);
    return true;
  }

  function sprinkleToppingIntoWell(wIdx) {
    const w = wells[wIdx];
    if (w.fill < 0.15) w.fill = 0.80;
    w.hasCheese = true;
    w.hasNegi = true;
    w.wobble = 0.8;

    for (let i = 0; i < 3; i++) {
      const ch = new THREE.Mesh(new RoundedBoxGeometry(0.009, 0.007, 0.009, 2, 0.002), cheeseMat);
      const a = i * 2.1 + 0.5;
      ch.position.set(Math.cos(a) * 0.014, WELL_R * 0.42, Math.sin(a) * 0.014);
      w.visual.embeddedGroup.add(ch);
    }
    for (let i = 0; i < 4; i++) {
      const ng = new THREE.Mesh(new THREE.TorusGeometry(0.0045, 0.0015, 5, 10), negiMat);
      ng.rotation.x = Math.PI / 2;
      const a = i * 1.55;
      ng.position.set(Math.cos(a) * 0.018, WELL_R * 0.44, Math.sin(a) * 0.018);
      w.visual.embeddedGroup.add(ng);
    }
    audio.playToppingSprinkle();
    fx.spawnOilSplatter(w.x, PAN_TOP_Y + 0.01, w.z, 4, 0.9);
  }

  function brushOilOnWell(wIdx) {
    const w = wells[wIdx];
    w.oilBoost = Math.min(1.0, w.oilBoost + 0.45);
    ironMat.clearcoat = Math.min(0.98, ironMat.clearcoat + 0.03);
    ironMat.clearcoatRoughness = Math.max(0.04, ironMat.clearcoatRoughness - 0.01);
    audio.playOilBrush();
    fx.spawnSteam(w.x, PAN_TOP_Y + 0.012, w.z, { size0: 0.03, size1: 0.10, alpha: 0.22 });
    fx.spawnOilSplatter(w.x, PAN_TOP_Y + 0.006, w.z, 7, 1.1);
  }

  function flipWellWithPick(wIdx, dragDX = 0, dragDZ = -1) {
    const w = wells[wIdx];
    if (w.fill < 0.2) return false;

    // Ensure at least modest crust before rounding so child sees real golden-brown underside appear!
    w.bakeBottom = Math.max(w.bakeBottom, 0.52);
    w.flipCount++;
    w.wobble = 1.0;

    // Tuck overflowing crispy batter skirt ("耳") into the ball!
    if (w.overflow > 0) {
      w.fill = Math.min(1.12, w.fill + w.overflow * 0.22);
      w.overflow *= 0.25;
      if (w.overflow < 0.08) w.overflow = 0;
    }

    // Rotate ball in direction of player's finger swipe!
    const len = Math.hypot(dragDX, dragDZ) || 1;
    const nx = dragDX / len;
    const nz = dragDZ / len;
    const stepAngle = w.flipCount === 1 ? Math.PI * 0.55 : Math.PI * 0.52;
    w.targetRotX += nz * stepAngle;
    w.targetRotZ -= nx * stepAngle;

    if (w.flipCount >= 2) {
      w.bakeBottom = Math.max(w.bakeBottom, 0.88);
      w.bakeTop = Math.max(w.bakeTop, 0.72);
    }

    const isFullRound = w.flipCount >= 2;
    audio.playPickTurn(isFullRound);
    fx.spawnSteam(w.x, PAN_TOP_Y + 0.025, w.z, {
      size0: 0.04,
      size1: 0.135,
      vy: 0.13,
      alpha: 0.28,
    });
    fx.spawnOilSplatter(w.x, PAN_TOP_Y + 0.012, w.z, 5, 1.05);
    return true;
  }

  function applySauceToWell(wIdx) {
    const w = wells[wIdx];
    if (w.fill < 0.3) return false;
    if (w.flipCount < 2) {
      // Gently round it if child eagerly brushes sauce early so it looks appetizing!
      w.flipCount = 2;
      w.bakeBottom = Math.max(w.bakeBottom, 0.85);
      w.bakeTop = Math.max(w.bakeTop, 0.82);
      w.targetRotX += Math.PI;
    }
    const prev = w.sauceAmount;
    w.sauceAmount = Math.min(1.0, w.sauceAmount + 0.65);
    w.wobble = 0.55;
    if (prev < 0.85) {
      audio.playSauceGlaze();
      fx.spawnSteam(w.x, PAN_TOP_Y + 0.03, w.z, { size0: 0.032, size1: 0.11, alpha: 0.24 });
    }
    return true;
  }

  function applyMayoToWell(wIdx) {
    const w = wells[wIdx];
    if (w.fill < 0.3) return false;
    if (!w.hasMayo) {
      w.hasMayo = true;
      w.wobble = 0.45;
      audio.playMayoSqueeze();
    }
    return true;
  }

  function sprinkleBonitoOnWell(wIdx) {
    const w = wells[wIdx];
    if (w.fill < 0.3) return false;
    if (w.sauceAmount < 0.2) w.sauceAmount = 0.85; // Auto-glaze if skipped so bonito sticks deliciously
    const prev = w.bonitoAmount;
    w.bonitoAmount = 1.0;
    w.heat = Math.max(w.heat, 0.92);
    if (prev < 0.5) {
      audio.playBonitoRustle();
      fx.spawnSteam(w.x, PAN_TOP_Y + 0.035, w.z, { size0: 0.03, size1: 0.11, alpha: 0.20 });
    }
    return true;
  }

  function extractBallFromWell(wIdx) {
    const w = wells[wIdx];
    if (w.fill < 0.5 || w.flipCount < 2) return null;
    const ballData = {
      bakeBottom: Math.max(0.88, w.bakeBottom),
      bakeTop: Math.max(0.85, w.bakeTop),
      oilBoost: w.oilBoost,
      octopusCount: w.octopusCount,
      hasCheese: w.hasCheese,
      sauceAmount: Math.max(0.85, w.sauceAmount),
      hasMayo: w.hasMayo,
      bonitoAmount: Math.max(0.85, w.bonitoAmount),
      heat: Math.max(0.85, w.heat),
      originPos: new THREE.Vector3(w.x, PAN_TOP_Y + 0.02, w.z),
    };

    // Reset well cleanly for next batch!
    w.fill = 0;
    w.overflow = 0;
    w.octopusCount = 0;
    w.hasCheese = false;
    w.hasNegi = false;
    w.bakeBottom = 0;
    w.bakeTop = 0;
    w.flipCount = 0;
    w.targetRotX = 0;
    w.targetRotZ = 0;
    w.sauceAmount = 0;
    w.hasMayo = false;
    w.bonitoAmount = 0;
    w.heat = 0.15;
    while (w.visual.embeddedGroup.children.length > 0) {
      w.visual.embeddedGroup.remove(w.visual.embeddedGroup.children[0]);
    }
    w.visual.rig.visible = false;
    w.skirtMesh.visible = false;

    syncVisualFromData(liftedVisual, ballData);
    liftedVisual.rig.visible = true;
    return ballData;
  }

  function placeBallOnBoat(ballData) {
    let slot = boatSlots.find((s) => !s.occupied);
    let boatFull = false;
    if (!slot) {
      // Cycle oldest slot if all 6 full
      slot = boatSlots[0];
    }
    slot.occupied = true;
    slot.heat = ballData.heat * 0.75;
    slot.hasCheese = ballData.hasCheese;
    slot.octopusCount = ballData.octopusCount;
    syncVisualFromData(slot.vis, ballData);
    slot.vis.rig.visible = true;
    audio.playBoatPlace();

    const occupiedCount = boatSlots.filter((s) => s.occupied).length;
    if (occupiedCount >= 6) {
      boatFull = true;
      // After celebratory family moment, Mom & Dad happily eat 2 from the boat so space stays open!
      setTimeout(() => {
        if (boatSlots[0]) { boatSlots[0].occupied = false; boatSlots[0].vis.rig.visible = false; }
        if (boatSlots[5]) { boatSlots[5].occupied = false; boatSlots[5].vis.rig.visible = false; }
      }, 2400);
    }
    return boatFull;
  }

  // Update dancing katsuobushi ribbon vertices from rising heat + air gusts!
  function animateDancingBonito(flakes, time, heat, windVec) {
    const danceAmp = 0.25 + heat * 0.85 + Math.min(1.2, windVec.length() * 2.2);
    for (let k = 0; k < flakes.length; k++) {
      const fl = flakes[k];
      const base = fl.userData.basePositions;
      const pos = fl.geometry.attributes.position;
      const ph = fl.userData.phase;

      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const bz = base[i * 3 + 2];
        const distFromCenter = Math.abs(bx) / 0.018; // 0 at spine, 1 at tips

        // Hygroscopic upward curl + rising steam flutter!
        const curlUp =
          Math.pow(distFromCenter, 1.7) *
          0.0085 *
          (0.65 + 0.55 * Math.sin(time * (3.1 + k * 0.35) + ph + bx * 85)) *
          danceAmp;
        const twistZ =
          Math.sin(time * 4.4 + ph + bx * 110) * 0.0028 * distFromCenter * danceAmp;
        const windShift = windVec.z * 0.012 * distFromCenter + windVec.x * 0.012 * distFromCenter;

        pos.setXYZ(i, bx + windShift * 0.5, by + Math.max(0, curlUp), bz + twistZ + windShift);
      }
      pos.needsUpdate = true;
      fl.geometry.computeVertexNormals();
      fl.rotation.z = Math.sin(time * 2.3 + ph) * 0.14 * danceAmp;
      fl.rotation.x = Math.cos(time * 2.7 + ph) * 0.11 * danceAmp;
    }
  }

  const tmpSpoutWorld = new THREE.Vector3();
  const tmpStreamMid = new THREE.Vector3();
  const tmpUp = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();

  function updatePourVisual(isPouring, targetWorldPos) {
    if (!isPouring || !targetWorldPos) {
      pitcherGroup.position.lerp(pitcherRestPos, 0.18);
      pitcherGroup.rotation.z = THREE.MathUtils.lerp(pitcherGroup.rotation.z, 0, 0.18);
      pourStreamMesh.visible = false;
      return;
    }
    // Position pitcher right above-right of target well & tilt spout!
    pitcherGroup.position.lerp(
      new THREE.Vector3(targetWorldPos.x + 0.075, 0.105, targetWorldPos.z + 0.015),
      0.24
    );
    pitcherGroup.rotation.z = THREE.MathUtils.lerp(pitcherGroup.rotation.z, 0.68, 0.22);

    spout.getWorldPosition(tmpSpoutWorld);
    tmpStreamMid.copy(tmpSpoutWorld).add(targetWorldPos).multiplyScalar(0.5);
    tmpDir.copy(targetWorldPos).sub(tmpSpoutWorld);
    const len = tmpDir.length();
    pourStreamMesh.visible = true;
    pourStreamMesh.position.copy(tmpStreamMid);
    pourStreamMesh.scale.set(1, len, 1);
    pourStreamMesh.quaternion.setFromUnitVectors(tmpUp, tmpDir.normalize());
  }

  function updateCheeseStretch(active, fromPos, toPos) {
    if (!active || !fromPos || !toPos) {
      cheeseStrandMesh.visible = false;
      return;
    }
    const dist = fromPos.distanceTo(toPos);
    if (dist < 0.015 || dist > 0.34) {
      cheeseStrandMesh.visible = false;
      return;
    }
    cheeseStrandMesh.visible = true;
    tmpStreamMid.copy(fromPos).add(toPos).multiplyScalar(0.5);
    tmpDir.copy(toPos).sub(fromPos);
    const thin = Math.max(0.28, 1.0 - dist * 2.4);
    cheeseStrandMesh.position.copy(tmpStreamMid);
    cheeseStrandMesh.scale.set(thin, dist, thin);
    cheeseStrandMesh.quaternion.setFromUnitVectors(tmpUp, tmpDir.normalize());
  }

  function update(dt, time, liftedBallData = null) {
    let totalHeatActivity = 0.08;

    // Animate gas burner subtle recessed amber glow
    flameStrip.material.color.setRGB(
      1.35 + Math.sin(time * 17) * 0.15,
      0.48 + Math.cos(time * 23) * 0.06,
      0.10
    );

    // Update all 8 wells
    for (let i = 0; i < wells.length; i++) {
      const w = wells[i];
      w.wobble = Math.max(0, w.wobble - dt * 3.8);

      if (w.fill > 0.02) {
        w.visual.rig.visible = true;
        // Continuous thermal Maillard baking on hot cast iron!
        const oilFactor = 0.85 + w.oilBoost * 0.45;
        if (w.flipCount === 0) {
          w.bakeBottom = Math.min(1.08, w.bakeBottom + dt * 0.13 * oilFactor);
        } else if (w.flipCount === 1) {
          w.bakeBottom = Math.min(1.12, w.bakeBottom + dt * 0.09 * oilFactor);
          w.bakeTop = Math.min(0.95, w.bakeTop + dt * 0.14 * oilFactor);
        } else {
          w.bakeBottom = Math.min(1.18, w.bakeBottom + dt * 0.06 * oilFactor);
          w.bakeTop = Math.min(1.15, w.bakeTop + dt * 0.11 * oilFactor);
        }

        w.heat = Math.min(1.0, Math.max(w.heat, 0.35 + (w.bakeBottom + w.bakeTop) * 0.32));
        totalHeatActivity += w.fill * (0.10 + w.heat * 0.09);

        // Shape morph: flat liquid pool in cavity -> half-turned -> plump golden sphere sitting high in well!
        const roundness = w.flipCount === 0 ? 0.0 : w.flipCount === 1 ? 0.58 : 1.0;
        const puff = 1.0 + (w.fill > 1.0 ? 0.08 : 0.0) + (w.octopusCount >= 2 ? 0.06 : 0.0);
        const sy = THREE.MathUtils.lerp(0.32 * w.fill, 0.98 * puff, roundness);
        const sxz = THREE.MathUtils.lerp(0.55 + 0.44 * w.fill, 0.99 * puff, roundness);
        const wobbleScale = Math.sin(time * 28 + i) * 0.055 * w.wobble;

        w.visual.ballMesh.scale.set(sxz + wobbleScale, sy - wobbleScale * 0.7, sxz + wobbleScale);
        // Scale upright toppings (glossy dark sauce cap, mayo drizzle, aonori & dancing bonito) with puffed ball radius!
        w.visual.uprightToppings.scale.copy(w.visual.ballMesh.scale);

        const targetY = THREE.MathUtils.lerp(
          -WELL_DEPTH + sy * WELL_R + 0.004,
          -WELL_DEPTH * 0.36 + WELL_R * 0.52,
          roundness
        );
        w.visual.rig.position.y = THREE.MathUtils.lerp(w.visual.rig.position.y, targetY, Math.min(1, dt * 12));

        // Smooth ball flip rotation
        w.visual.ballMesh.rotation.x = THREE.MathUtils.lerp(w.visual.ballMesh.rotation.x, w.targetRotX, Math.min(1, dt * 11));
        w.visual.ballMesh.rotation.z = THREE.MathUtils.lerp(w.visual.ballMesh.rotation.z, w.targetRotZ, Math.min(1, dt * 11));

        // Overflowing batter skirt ("耳")
        if (w.overflow > 0.02 && w.flipCount < 2) {
          w.skirtMesh.visible = true;
          const os = 0.72 + w.overflow * 0.42;
          w.skirtMesh.scale.set(os, 1, os);
          // Tint overflow skirt slightly golden at edges as it bakes!
          const toastTint = THREE.MathUtils.clamp(w.bakeBottom * 0.55, 0, 0.6);
          w.skirtMesh.material.color.setRGB(1.0, 1.0 - toastTint * 0.18, 1.0 - toastTint * 0.42);
        } else {
          w.skirtMesh.visible = false;
        }

        syncVisualFromData(w.visual, w);

        if (w.bonitoAmount > 0.05) {
          animateDancingBonito(w.visual.bonitoFlakes, time, w.heat, fx.windImpulse);
        }

        // Ambient rising steam & occasional oil pop from cooking wells!
        w.steamTimer -= dt * (0.6 + w.heat * 1.4);
        if (w.steamTimer <= 0) {
          w.steamTimer = 0.35 + Math.random() * 0.55;
          fx.spawnSteam(w.x, PAN_TOP_Y + 0.02, w.z, {
            size0: 0.024,
            size1: 0.095,
            vy: 0.075 + w.heat * 0.045,
            alpha: 0.14 + w.heat * 0.06,
          });
          if (Math.random() < 0.25 * w.oilBoost && w.flipCount < 2) {
            fx.spawnOilSplatter(w.x, PAN_TOP_Y + 0.008, w.z, 1, 0.75);
          }
        }
      } else {
        w.visual.rig.visible = false;
        w.skirtMesh.visible = false;
      }
    }

    // Animate dancing bonito & gentle steam on Bamboo Boat takoyaki!
    for (let s = 0; s < boatSlots.length; s++) {
      const slot = boatSlots[s];
      if (!slot.occupied) continue;
      slot.heat = Math.max(0.28, slot.heat - dt * 0.02);
      animateDancingBonito(slot.vis.bonitoFlakes, time + s * 0.5, slot.heat, fx.windImpulse);
      if (Math.random() < dt * 0.85) {
        const wp = new THREE.Vector3();
        slot.vis.rig.getWorldPosition(wp);
        fx.spawnSteam(wp.x, wp.y + 0.025, wp.z, {
          size0: 0.02,
          size1: 0.075,
          vy: 0.065,
          alpha: 0.13,
        });
      }
    }

    // Animate dancing bonito on lifted toothpick takoyaki!
    if (liftedVisual.rig.visible && liftedBallData) {
      animateDancingBonito(liftedVisual.bonitoFlakes, time + 1.2, liftedBallData.heat, fx.windImpulse);
    }

    // Subtle non-active prop wobble feedback
    const applyWobble = (grp, key) => {
      if (propWobbles[key] > 0) {
        propWobbles[key] = Math.max(0, propWobbles[key] - dt * 4.5);
        grp.rotation.x = Math.sin(time * 26) * 0.08 * propWobbles[key];
      } else {
        grp.rotation.x = 0;
      }
    };
    applyWobble(octoBowlGroup, 'octopus');
    applyWobble(toppingDishGroup, 'topping');
    applyWobble(oilPropGroup, 'oil');
    applyWobble(pickPropGroup, 'pick');
    applyWobble(saucePropGroup, 'sauce');
    applyWobble(mayoPropGroup, 'mayo');
    applyWobble(bonitoPropGroup, 'bonito');
    applyWobble(boatGroup, 'boat');

    return Math.min(1.0, totalHeatActivity);
  }

  return {
    root,
    wells,
    PAN_TOP_Y,
    PAN_Z,
    propsHitables,
    wellHitables: wells.map((w) => w.hitMesh),
    pitcherGroup,
    restingPickVisual,
    restingOilBrush,
    restingBrushStick,
    mayoPropGroup,
    boatGroup,
    boatSlots,
    liftedVisual,
    pulseProp,
    pourBatterIntoWell,
    dropOctopusIntoWell,
    sprinkleToppingIntoWell,
    brushOilOnWell,
    flipWellWithPick,
    applySauceToWell,
    applyMayoToWell,
    sprinkleBonitoOnWell,
    extractBallFromWell,
    placeBallOnBoat,
    updatePourVisual,
    updateCheeseStretch,
    update,
  };
}
