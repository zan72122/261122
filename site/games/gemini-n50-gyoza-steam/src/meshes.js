import * as THREE from '../vendor/three.module.js';

// =========================================================================
// 1. Deformable Hand-Pleated 3D Gyoza (High-Res Sculpted Organic Pleats, Seamless Ridge!)
// =========================================================================
export function createGyoza(materials) {
  const group = new THREE.Group();
  group.name = 'gyoza';

  // High-smoothness structured grid (54x26 = ~2800 tris per gyoza -> silky organic folds!)
  const segS = 54;
  const segT = 26;
  const cols = segS + 1;
  const rows = segT + 1;
  const vertCount = cols * rows;

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let j = 0; j <= segT; j++) {
    for (let i = 0; i <= segS; i++) {
      const idx = j * cols + i;
      uvs[idx * 2] = i / segS;
      uvs[idx * 2 + 1] = j / segT;
    }
  }
  for (let j = 0; j < segT; j++) {
    for (let i = 0; i < segS; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const doughMat = materials.dough.clone();
  const wrapperMesh = new THREE.Mesh(geo, doughMat);
  wrapperMesh.castShadow = true;
  wrapperMesh.receiveShadow = true;
  group.add(wrapperMesh);

  // Smooth organic filling mound (high-detail bump texture gives fine minced grain, zero spiky artifacts!)
  const fillingGeo = new THREE.SphereGeometry(0.175, 24, 16);
  const fPos = fillingGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const vx = fPos.getX(i);
    const vy = fPos.getY(i);
    const vz = fPos.getZ(i);
    const bump = 1 + 0.045 * Math.sin(vx * 18 + vy * 15) * Math.cos(vz * 16);
    fPos.setXYZ(i, vx * 1.46 * bump, Math.max(-0.008, vy * 0.68 * bump + 0.045), vz * 0.9 * bump);
  }
  fillingGeo.computeVertexNormals();
  const fillingMesh = new THREE.Mesh(fillingGeo, materials.filling);
  fillingMesh.position.set(0, 0.022, 0);
  fillingMesh.scale.setScalar(0.001);
  fillingMesh.visible = false;
  fillingMesh.castShadow = true;
  fillingMesh.receiveShadow = true;
  group.add(fillingMesh);

  // Dedicated Seared Maillard Sole (sits cleanly outside the flat sole at y = 0.001 -> faces straight UP when flipped!)
  const soleGeo = new THREE.CircleGeometry(0.32, 32);
  soleGeo.rotateX(Math.PI / 2); // Normal faces -Y (becomes +Y when gyoza flips onto plate!)
  const sPos = soleGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i);
    const z = sPos.getZ(i);
    const rNorm = Math.min(1, Math.hypot(x, z) / 0.32);
    const nx = x * 1.34;
    const nz = z * 0.56 - 0.07 * (1 - Math.min(1, (x / 0.32) ** 2));
    // Strictly below wrapper sole (y = 0.006) across entire flat face, gently kissing outer rim!
    const ny = -0.004 + Math.pow(Math.max(0, rNorm - 0.72) / 0.28, 2.0) * 0.012;
    sPos.setXYZ(i, nx, ny, nz);
  }
  soleGeo.computeVertexNormals();
  const soleMat = materials.searSole.clone();
  soleMat.transparent = true;
  soleMat.opacity = 0;
  const soleMesh = new THREE.Mesh(soleGeo, soleMat);
  soleMesh.receiveShadow = true;
  group.add(soleMesh);

  // Inner juicy bite-reveal core (shown when bitten during reward stage!)
  const biteCore = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12), materials.filling);
  biteCore.scale.set(0.88, 0.72, 0.8);
  biteCore.position.set(0.14, 0.14, -0.02);
  biteCore.visible = false;
  group.add(biteCore);

  const state = {
    fold: 0,
    pleats: [0, 0, 0, 0, 0, 0],
    fillingAmount: 0,
    steamCook: 0,
    sear: 0,
    bitten: 0,
    plumpSeed: 0.95 + Math.random() * 0.12,
  };

  function updateGeometry() {
    const R = 0.46;
    const fold = state.fold;
    const plump = (0.86 + state.fillingAmount * 0.24) * state.plumpSeed;
    const posAttr = geo.attributes.position;

    for (let j = 0; j <= segT; j++) {
      const t = (j / segT) * 2 - 1; // -1 back rim -> +1 front pleated rim
      const absT = Math.abs(t);
      const signT = t >= 0 ? 1 : -1;

      for (let i = 0; i <= segS; i++) {
        const s = (i / segS) * 2 - 1; // -1 left -> +1 right
        const idx = j * cols + i;

        // 1. Flat thin circular dough wrapper with subtle organic wave
        const chord = Math.sqrt(Math.max(0.0001, 1 - s * s * 0.99));
        const flatX = s * R;
        const flatZ = t * chord * R;
        const edgeDist = Math.min(1, Math.hypot(flatX, flatZ) / R);
        const flatY =
          0.008 +
          Math.pow(edgeDist, 3.5) * (0.015 + state.fillingAmount * 0.018) +
          Math.sin(s * 7 + t * 5) * 0.003 * edgeDist;

        // 2. Authentic plump Japanese crescent gyoza (seamless closed pinched top ridge!)
        const arch = Math.sqrt(Math.max(0.0001, 1 - s * s * 0.975));
        const crescentCurve = -0.115 * (1 - s * s);

        const theta = absT * Math.PI; // 0 = flat sole center, PI = welded pinched crest!
        const bellyH = 0.315 * arch * plump;
        const bellyW = 0.225 * arch * plump;

        // Smooth flat sole contact against skillet/board
        const soleFlat = Math.pow(Math.max(0, 1 - absT / 0.36), 1.6);
        const yRaw = (1 - Math.cos(theta)) * 0.5 * bellyH;
        let fy = 0.006 + yRaw * (1 - soleFlat * 0.78);

        // Plump asymmetric belly meeting EXACTLY at crescentCurve when absT = 1 (zero seam gap!)
        const zProfile = Math.sin(theta) * bellyW;
        const asymZ = signT > 0 ? zProfile * 1.18 : zProfile * 0.86;
        // Pinch flange narrows smoothly into a thin sealed dough crest above absT > 0.76
        const sealPinch = THREE.MathUtils.smoothstep(absT, 0.72, 1.0);
        let fz = crescentCurve + asymZ * (1 - sealPinch * 0.96);
        let fx = s * R * 1.02;

        // Graceful thin crimped fin rising along top sealed ridge
        fy += sealPinch * 0.052 * arch;

        // 3. SILKY HAND-PINCHED 6 PLEATS (organic scalloped dough waves, NOT harsh angular stripes!)
        if (t > 0.18 && fold > 0.25) {
          const foldActive = Math.min(1, (fold - 0.25) / 0.65);
          const pleatZoneS = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s) / 0.85, 4)), 1.2);
          const pleatZoneT = Math.sin(THREE.MathUtils.clamp((t - 0.18) / 0.82, 0, 1) * Math.PI * 0.88);
          const crestBoost = THREE.MathUtils.smoothstep(t, 0.65, 1.0);

          // Sum 6 smooth overlapping Gaussian-windowed pleats centered along [-0.66..+0.66]
          let dzPleat = 0;
          let dxPleat = 0;
          let dyPleat = 0;
          for (let k = 0; k < 6; k++) {
            const pWeight = state.pleats[k] || 0;
            if (pWeight < 0.001) continue;
            const centerS = -0.66 + (k / 5) * 1.32;
            const d = (s - centerS) / 0.125;
            if (Math.abs(d) > 2.6) continue;
            const env = Math.exp(-d * d * 0.95);
            // Asymmetric pillowy dough tuck leaning slightly toward center!
            const tuck = Math.sin(d * 2.2) * env;
            const ridge = Math.cos(d * 1.55) * env;
            dzPleat += (ridge * 0.024 + tuck * 0.014) * pWeight;
            dxPleat += tuck * 0.012 * pWeight;
            dyPleat += env * 0.016 * pWeight;
          }

          const amp = foldActive * pleatZoneS;
          fz += dzPleat * (pleatZoneT * 0.85 + crestBoost * 0.35) * amp;
          fx += dxPleat * pleatZoneT * amp;
          fy += dyPleat * (0.35 + crestBoost * 0.65) * amp;
        }

        // Blend flat -> crescent
        const k = THREE.MathUtils.smoothstep(fold, 0, 1);
        let vx = THREE.MathUtils.lerp(flatX, fx, k);
        let vy = THREE.MathUtils.lerp(flatY, fy, k);
        let vz = THREE.MathUtils.lerp(flatZ, fz, k);

        // Crispy bite cutout during reward stage
        if (state.bitten > 0.01 && s > 0.22) {
          const bMask = THREE.MathUtils.smoothstep(s, 0.22, 0.55) * state.bitten;
          vx = THREE.MathUtils.lerp(vx, 0.12 + Math.sin(t * 7) * 0.015, bMask);
          vy *= 1 - bMask * 0.22;
        }

        posAttr.setXYZ(idx, vx, vy, vz);
      }
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    if (state.fillingAmount > 0.01) {
      fillingMesh.visible = fold < 0.85;
      const fs = Math.min(1.22, state.fillingAmount) * (1 - THREE.MathUtils.smoothstep(fold, 0.5, 0.88) * 0.5);
      fillingMesh.scale.set(fs, fs, fs);
      fillingMesh.position.y = 0.025 + fold * 0.068;
    } else {
      fillingMesh.visible = false;
    }

    // Raw powdery wheat -> warm glossy translucent steamed skin -> golden oil-kissed sheen
    const rawCol = new THREE.Color(0xf3e7cf);
    const steamedCol = new THREE.Color(0xebd2a4);
    const searedCol = new THREE.Color(0xdca760);
    doughMat.color.copy(rawCol).lerp(steamedCol, state.steamCook).lerp(searedCol, state.sear * 0.34);
    doughMat.roughness = THREE.MathUtils.lerp(0.86, 0.28, state.steamCook);
    doughMat.clearcoat = THREE.MathUtils.lerp(0.04, 0.72, Math.max(state.steamCook * 0.78, state.sear));
    doughMat.clearcoatRoughness = THREE.MathUtils.lerp(0.65, 0.14, state.sear);
    // Subtle warm subsurface translucency as dough steams!
    doughMat.emissive.setHex(0x3a240e);
    doughMat.emissiveIntensity = state.steamCook * 0.16;

    soleMat.opacity = THREE.MathUtils.smoothstep(state.sear, 0.08, 0.95);
    soleMesh.visible = state.sear > 0.05 && state.fold > 0.7;

    biteCore.visible = state.bitten > 0.35;
  }

  updateGeometry();

  return { group, wrapperMesh, fillingMesh, soleMesh, state, updateGeometry };
}

// =========================================================================
// 2. Heavy Seasoned Cast-Iron Skillet + Glossy Oil + Boiling Slurry + Hanetsuki Lace
// =========================================================================
export function createSkillet(textures, gyozaCount = 5) {
  const group = new THREE.Group();
  group.name = 'skillet';

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.44, 0.0),
    new THREE.Vector2(1.52, 0.045),
    new THREE.Vector2(1.68, 0.43),
    new THREE.Vector2(1.74, 0.46),
    new THREE.Vector2(1.65, 0.475),
    new THREE.Vector2(1.60, 0.43),
    new THREE.Vector2(1.45, 0.072),
    new THREE.Vector2(1.38, 0.052),
    new THREE.Vector2(0.0, 0.052),
  ];
  const panGeo = new THREE.LatheGeometry(pts, 52);
  const ironMat = new THREE.MeshStandardMaterial({
    map: textures.castIron.map,
    bumpMap: textures.castIron.bumpMap,
    bumpScale: 0.016,
    roughnessMap: textures.castIron.roughnessMap,
    roughness: 0.48,
    metalness: 0.72,
    envMapIntensity: 1.3,
  });
  const panMesh = new THREE.Mesh(panGeo, ironMat);
  panMesh.castShadow = true;
  panMesh.receiveShadow = true;
  group.add(panMesh);

  // Heavy Ergonomic Cast-Iron Handle + Stainless Rivet Bracket
  const handleGroup = new THREE.Group();
  handleGroup.rotation.y = Math.PI * 0.78;

  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.13, 0.26),
    new THREE.MeshStandardMaterial({ color: 0xc2c7cd, roughness: 0.24, metalness: 0.92 })
  );
  bracket.position.set(1.72, 0.40, 0);
  bracket.rotation.z = 0.2;
  handleGroup.add(bracket);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.74, 0.42, 0),
    new THREE.Vector3(2.25, 0.54, 0),
    new THREE.Vector3(2.85, 0.63, 0),
    new THREE.Vector3(3.15, 0.65, 0),
  ]);
  const handleGeo = new THREE.TubeGeometry(handleCurve, 18, 0.086, 12, false);
  handleGeo.scale(1, 0.75, 1.18);
  const handleMesh = new THREE.Mesh(
    handleGeo,
    new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.42, metalness: 0.16 })
  );
  handleMesh.castShadow = true;
  handleGroup.add(handleMesh);

  const cap = new THREE.Mesh(
    new THREE.TorusGeometry(0.056, 0.017, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xc8cdd3, roughness: 0.22, metalness: 0.94 })
  );
  // Welded cleanly at scaled handle tip (0.65 * 0.75 = 0.488)!
  cap.position.set(3.15, 0.488, 0);
  cap.rotation.x = Math.PI / 2;
  handleGroup.add(cap);
  group.add(handleGroup);

  // Authentic glistening thin sesame-oil sheen on dark cast-iron floor (clear & shiny, NOT brown pudding!)
  const oilMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a150e,
    roughness: 0.03,
    metalness: 0.12,
    transparent: true,
    opacity: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.6,
  });
  const oilPool = new THREE.Mesh(new THREE.CircleGeometry(1.41, 36), oilMat);
  oilPool.rotation.x = -Math.PI / 2;
  oilPool.position.y = 0.056;
  group.add(oilPool);

  // Dynamic Boiling Katakuriko-Water Slurry Surface
  const lRings = 10;
  const lSegs = 36;
  const lPos = [];
  const lUvs = [];
  const lIdx = [];
  for (let r = 0; r <= lRings; r++) {
    const rad = (r / lRings) * 1.44;
    for (let s = 0; s <= lSegs; s++) {
      const th = (s / lSegs) * Math.PI * 2;
      lPos.push(Math.cos(th) * rad, 0, Math.sin(th) * rad);
      lUvs.push(0.5 + (Math.cos(th) * rad) / 2.9, 0.5 + (Math.sin(th) * rad) / 2.9);
    }
  }
  for (let r = 0; r < lRings; r++) {
    for (let s = 0; s < lSegs; s++) {
      const a = r * (lSegs + 1) + s;
      const b = a + 1;
      const c = a + (lSegs + 1);
      const d = c + 1;
      lIdx.push(a, c, b, b, c, d);
    }
  }
  const waveLiquidGeo = new THREE.BufferGeometry();
  waveLiquidGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
  waveLiquidGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lUvs, 2));
  waveLiquidGeo.setIndex(lIdx);
  waveLiquidGeo.computeVertexNormals();

  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f2e6,
    roughness: 0.12,
    metalness: 0.02,
    transparent: true,
    opacity: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    depthWrite: false,
  });
  const liquidMesh = new THREE.Mesh(waveLiquidGeo, liquidMat);
  liquidMesh.position.y = 0.062;
  liquidMesh.visible = false;
  group.add(liquidMesh);

  // HERO HANETSUKI CRISPY LACE SKIRT ("Hane") — 5 breakable radial wedges sharing 1024px PBR texture!
  const haneGroup = new THREE.Group();
  haneGroup.position.y = 0.064;
  group.add(haneGroup);

  const haneWedges = [];
  const haneRadius = 1.44;
  const sectorAngle = (Math.PI * 2) / gyozaCount;
  const haneBaseMat = new THREE.MeshPhysicalMaterial({
    map: textures.hane.map,
    alphaMap: textures.hane.alphaMap,
    bumpMap: textures.hane.bumpMap,
    bumpScale: 0.065,
    roughnessMap: textures.hane.roughnessMap,
    roughness: 0.48,
    metalness: 0.05,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14,
    alphaTest: 0.34,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
  });

  for (let w = 0; w < gyozaCount; w++) {
    const startA = w * sectorAngle - Math.PI / 2 - sectorAngle * 0.5;
    const wSegs = 14;
    const wRings = 7;
    const wPos = [];
    const wUvs = [];
    const wIdx = [];
    for (let r = 0; r <= wRings; r++) {
      const frac = r / wRings;
      const rad = frac * haneRadius;
      for (let s = 0; s <= wSegs; s++) {
        const a = startA + (s / wSegs) * sectorAngle;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        // Authentic thin crispy curled outer edge!
        const curlY = Math.pow(frac, 2.8) * 0.042 * (0.65 + 0.35 * Math.sin(a * 11));
        wPos.push(x, curlY, z);
        wUvs.push(0.5 + x / (haneRadius * 2.06), 0.5 - z / (haneRadius * 2.06));
      }
    }
    for (let r = 0; r < wRings; r++) {
      for (let s = 0; s < wSegs; s++) {
        const a = r * (wSegs + 1) + s;
        const b = a + 1;
        const c = a + (wSegs + 1);
        const d = c + 1;
        wIdx.push(a, c, b, b, c, d);
      }
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    wGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUvs, 2));
    wGeo.setIndex(wIdx);
    wGeo.computeVertexNormals();

    const wMat = haneBaseMat.clone();
    const wMesh = new THREE.Mesh(wGeo, wMat);
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    wMesh.visible = false;
    wMesh.userData = { wedgeIndex: w, cracked: false, crackAnim: 0 };
    haneGroup.add(wMesh);
    haneWedges.push(wMesh);
  }

  function updateLiquid(time, waterLevel, boilIntensity) {
    if (waterLevel <= 0.005) {
      liquidMesh.visible = false;
      return;
    }
    liquidMesh.visible = true;
    liquidMesh.position.y = 0.058 + waterLevel * 0.145;
    liquidMat.opacity = Math.min(0.86, 0.32 + waterLevel * 0.44 + boilIntensity * 0.18);
    const pos = waveLiquidGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const wave =
        (Math.sin(r * 10 - time * 9.5) * 0.015 +
          Math.cos(x * 7 + z * 8 + time * 12.2) * 0.012) *
        (0.2 + boilIntensity * 1.15) *
        Math.min(1, waterLevel * 3);
      pos.setY(i, wave);
    }
    pos.needsUpdate = true;
    waveLiquidGeo.computeVertexNormals();
  }

  function updateHane(crispProgress) {
    const show = crispProgress > 0.04;
    const pale = new THREE.Color(0xf4e8ce);
    const gold = new THREE.Color(0xffffff);
    for (const w of haneWedges) {
      if (w.userData.cracked && w.userData.crackAnim >= 1) {
        w.visible = false;
        continue;
      }
      w.visible = show;
      w.material.opacity = Math.min(1, crispProgress * 1.4) * (1 - w.userData.crackAnim);
      w.material.color.copy(pale).lerp(gold, THREE.MathUtils.smoothstep(crispProgress, 0.22, 0.92));
      w.material.clearcoat = THREE.MathUtils.lerp(0.18, 0.9, crispProgress);
    }
  }

  return {
    group, panMesh, handleGroup, oilPool, liquidMesh, haneGroup, haneWedges, updateLiquid, updateHane,
  };
}

// =========================================================================
// 3. SIGNATURE HERO PROP: Domed Tempered Glass Lid with Live Condensation & Vent
// =========================================================================
export function createGlassLid(condensationSim) {
  const group = new THREE.Group();
  group.name = 'glassLid';

  const R = 1.66;
  const H = 0.78;
  const segU = 52;
  const segV = 22;

  function buildDomeGeo(radius, height) {
    const pos = [];
    const uvs = [];
    const idx = [];
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const phi = v * (Math.PI * 0.485);
      const r = Math.cos(phi) * radius;
      const y = Math.sin(phi) * height;
      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        const th = u * Math.PI * 2;
        pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
        uvs.push(u, v);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = j * (segU + 1) + i;
        const b = a + 1;
        const c = a + (segU + 1);
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Outer crystal-clear tempered glass dome catching realistic kitchen window & hood reflections!
  const outerGlass = new THREE.Mesh(
    buildDomeGeo(R, H),
    new THREE.MeshPhysicalMaterial({
      color: 0xeaf4fa,
      roughness: 0.03,
      metalness: 0.08,
      transparent: true,
      opacity: 0.19,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.9,
      depthWrite: false,
      side: THREE.FrontSide,
    })
  );
  outerGlass.renderOrder = 18;
  group.add(outerGlass);

  // Inner Condensation & Rolling Crystal Droplets Shell (FrontSide ONLY, clean luminous backlit steam!)
  const innerCond = new THREE.Mesh(
    buildDomeGeo(R * 0.986, H * 0.986),
    new THREE.MeshPhysicalMaterial({
      map: condensationSim.map,
      bumpMap: condensationSim.bumpMap,
      bumpScale: 0.018,
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: new THREE.Color(0xfff6ea),
      emissiveIntensity: 0.18,
      envMapIntensity: 1.6,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      side: THREE.FrontSide,
    })
  );
  innerCond.renderOrder = 16;
  innerCond.name = 'lidCondensation';
  group.add(innerCond);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xd6dbe2,
    roughness: 0.2,
    metalness: 0.94,
    envMapIntensity: 1.6,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.046, 12, 56), steelMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.01;
  rim.castShadow = true;
  group.add(rim);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.015, R - 0.045, 0.075, 48, 1, true),
    steelMat
  );
  skirt.position.y = -0.025;
  group.add(skirt);

  // Steam Vent Metal Grommet (front-right upper slope — visible in low-angle hero shot!)
  const ventAngle = 0.58;
  const ventPhi = 0.72;
  const vx = Math.cos(ventAngle) * Math.cos(ventPhi) * R;
  const vy = Math.sin(ventPhi) * H;
  const vz = Math.sin(ventAngle) * Math.cos(ventPhi) * R;
  const ventGroup = new THREE.Group();
  ventGroup.position.set(vx, vy, vz);
  ventGroup.lookAt(vx * 2, vy * 2 + 0.6, vz * 2);
  const ventRing = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.017, 8, 18), steelMat);
  ventGroup.add(ventRing);
  const ventHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.044, 14),
    new THREE.MeshBasicMaterial({ color: 0x0b0c0e })
  );
  ventHole.position.z = -0.004;
  ventGroup.add(ventHole);
  group.add(ventGroup);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.04, 24), steelMat);
  collar.position.y = H - 0.01;
  group.add(collar);

  const knobPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.11, 0.12),
    new THREE.Vector2(0.25, 0.22),
    new THREE.Vector2(0.26, 0.27),
    new THREE.Vector2(0.19, 0.30),
    new THREE.Vector2(0.0, 0.31),
  ];
  const knob = new THREE.Mesh(
    new THREE.LatheGeometry(knobPts, 28),
    new THREE.MeshStandardMaterial({ color: 0x19181a, roughness: 0.32, metalness: 0.14 })
  );
  knob.position.y = H + 0.01;
  knob.castShadow = true;
  knob.name = 'lidKnob';
  group.add(knob);

  const knobCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 20), steelMat);
  knobCap.position.y = H + 0.318;
  group.add(knobCap);

  return { group, outerGlass, innerCond, knob, ventGroup };
}

// =========================================================================
// 4. Gas Stove, Cast-Iron Trivet (Gotoku), Live Blue Flames & Interactive Rotary Dial
// =========================================================================
export function createGasStove(textures) {
  const group = new THREE.Group();
  group.name = 'gasStove';

  // Brushed stainless steel cooktop deck (cleanly sized so foreground serving counter never clips!)
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.26, 3.1),
    new THREE.MeshStandardMaterial({
      map: textures.steel.map,
      roughnessMap: textures.steel.roughnessMap,
      roughness: 0.3,
      metalness: 0.86,
      envMapIntensity: 1.3,
    })
  );
  deck.position.set(0, -0.14, -0.2);
  deck.receiveShadow = true;
  group.add(deck);

  // Recessed black enamel drip well
  const dripRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.44, 1.26, 0.05, 36),
    new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.34, metalness: 0.68 })
  );
  dripRing.position.y = 0.01;
  group.add(dripRing);

  // Burner crown
  const burnerCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.88, 0.14, 32),
    new THREE.MeshStandardMaterial({ color: 0x35383e, roughness: 0.4, metalness: 0.8 })
  );
  burnerCrown.position.y = 0.075;
  group.add(burnerCrown);

  // Taller 6-prong Cast-Iron Trivet (五徳) so the glowing blue gas flames show crisply under the skillet!
  const trivetMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.65, metalness: 0.58 });
  const trivetRing = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.055, 8, 36), trivetMat);
  trivetRing.rotation.x = Math.PI / 2;
  trivetRing.position.y = 0.13;
  group.add(trivetRing);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.075), trivetMat);
    prong.position.set(Math.cos(a) * 1.06, 0.19, Math.sin(a) * 1.06);
    prong.rotation.y = -a;
    prong.castShadow = true;
    group.add(prong);
  }

  // LIVE BLUE-VIOLET GAS FLAME RING (licks horizontally strictly underneath cast-iron skillet, never pokes inside pan!)
  const flameGroup = new THREE.Group();
  flameGroup.position.y = 0.12;
  group.add(flameGroup);

  const flameGeo = new THREE.ConeGeometry(0.072, 0.36, 7);
  flameGeo.translate(0, 0.17, 0);
  const blueFlameMat = new THREE.MeshBasicMaterial({
    color: 0x2288ff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreFlameMat = new THREE.MeshBasicMaterial({
    color: 0xaaf2ff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const orangeTipMat = new THREE.MeshBasicMaterial({
    color: 0xff9226,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const flames = [];
  const flameCount = 28;
  for (let i = 0; i < flameCount; i++) {
    const a = (i / flameCount) * Math.PI * 2;
    const fg = new THREE.Group();
    fg.position.set(Math.cos(a) * 0.92, 0, Math.sin(a) * 0.92);
    fg.rotation.y = -a;

    const outer = new THREE.Mesh(flameGeo, blueFlameMat);
    outer.rotation.z = -1.34; // nearly horizontal right below cast-iron base!
    fg.add(outer);

    const inner = new THREE.Mesh(flameGeo, coreFlameMat);
    inner.rotation.z = -1.30;
    inner.scale.set(0.56, 0.68, 0.56);
    fg.add(inner);

    const tip = new THREE.Mesh(flameGeo, orangeTipMat);
    tip.rotation.z = -1.36;
    tip.position.set(0.24, 0.04, 0);
    tip.scale.set(0.42, 0.52, 0.42);
    fg.add(tip);

    flameGroup.add(fg);
    flames.push({ group: fg, tip, phase: i * 0.93 });
  }

  // Tight short-range blue burner bounce light strictly below the iron pan
  const flameLight = new THREE.PointLight(0x3a9bff, 0, 2.3, 2.5);
  flameLight.position.set(0, 0.12, 0.72);
  group.add(flameLight);

  // Interactive Front Rotary Gas Stove Dial (framed cleanly inside lower-right of STEAM_COOK shot!)
  const panelBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.30, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.36, metalness: 0.62 })
  );
  panelBezel.position.set(1.02, -0.02, 1.38);
  panelBezel.rotation.x = -0.22;
  group.add(panelBezel);

  const dialGroup = new THREE.Group();
  dialGroup.position.set(1.02, 0.0, 1.52);
  dialGroup.rotation.x = Math.PI / 2 - 0.22;
  dialGroup.name = 'stoveDial';

  const dialBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.21, 0.14, 28),
    new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.2, metalness: 0.9 })
  );
  dialGroup.add(dialBody);

  const dialBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.17, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x191b1e, roughness: 0.34, metalness: 0.25 })
  );
  dialBar.position.y = 0.04;
  dialGroup.add(dialBar);

  const dialDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6b26 })
  );
  dialDot.position.set(0, 0.128, -0.13);
  dialGroup.add(dialDot);
  group.add(dialGroup);

  function updateFlames(time, heatLevel) {
    flameGroup.visible = heatLevel > 0.03;
    flameLight.intensity = heatLevel * 1.45 + Math.sin(time * 28) * 0.15 * heatLevel;
    dialGroup.rotation.y = -heatLevel * Math.PI * 0.72;
    dialDot.material.color.setHex(heatLevel > 0.65 ? 0xff5a1f : heatLevel > 0.2 ? 0x4ca6ff : 0x555860);

    if (!flameGroup.visible) return;
    for (const f of flames) {
      const flick = 0.88 + Math.sin(time * 24 + f.phase) * 0.12 + Math.cos(time * 37 + f.phase * 1.7) * 0.07;
      const sc = (0.4 + heatLevel * 1.1) * flick;
      f.group.scale.set(sc * 0.92, sc, sc * 0.92);
      f.tip.visible = heatLevel > 0.52 && Math.sin(time * 19 + f.phase * 2) > 0.15;
    }
  }

  return { group, dialGroup, flameLight, updateFlames };
}

// =========================================================================
// 5. Handcrafted Ceramic Filling Bowl + Smooth Organic Minced Filling + Steel Spoon
// =========================================================================
export function createFillingBowl(textures) {
  const group = new THREE.Group();
  group.name = 'fillingBowl';

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.48, 0.0),
    new THREE.Vector2(0.76, 0.22),
    new THREE.Vector2(0.84, 0.54),
    new THREE.Vector2(0.78, 0.56),
    new THREE.Vector2(0.71, 0.25),
    new THREE.Vector2(0.42, 0.07),
    new THREE.Vector2(0.0, 0.07),
  ];
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 40),
    new THREE.MeshPhysicalMaterial({
      color: 0xe2d9ca,
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.86,
      clearcoatRoughness: 0.12,
    })
  );
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  // Smooth rounded filling mound cleanly recessed INSIDE the ceramic bowl (r = 0.66 < inner rim 0.72!)
  const fillGeo = new THREE.SphereGeometry(0.66, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const fPos = fillGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const x = fPos.getX(i);
    const y = fPos.getY(i);
    const z = fPos.getZ(i);
    const radFrac = Math.min(1, Math.hypot(x, z) / 0.66);
    // Gentle organic mound undulation ONLY in the interior, tapering smoothly to zero at bowl wall!
    const softBump = (1 - radFrac * radFrac) * (0.042 * Math.sin(x * 9 + z * 8) + 0.028 * Math.cos(x * 13 - z * 11));
    fPos.setXYZ(i, x, y * 0.36 + softBump, z);
  }
  fillGeo.computeVertexNormals();
  const fillingMound = new THREE.Mesh(
    fillGeo,
    new THREE.MeshPhysicalMaterial({
      map: textures.filling.map,
      bumpMap: textures.filling.bumpMap,
      bumpScale: 0.045,
      roughnessMap: textures.filling.roughnessMap,
      roughness: 0.38,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
    })
  );
  fillingMound.position.y = 0.29;
  fillingMound.receiveShadow = true;
  group.add(fillingMound);

  // Realistic Brushed Stainless Spoon
  const spoonGroup = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdce1e7,
    roughness: 0.16,
    metalness: 0.94,
    envMapIntensity: 1.6,
  });
  const scoopGeo = new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
  scoopGeo.scale(1.25, 0.55, 0.85);
  const scoopHead = new THREE.Mesh(scoopGeo, steelMat);
  scoopHead.castShadow = true;
  spoonGroup.add(scoopHead);

  const spoonHandle = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.022, 0.065), steelMat);
  spoonHandle.position.set(-0.62, 0.06, 0);
  spoonHandle.rotation.z = -0.14;
  spoonHandle.castShadow = true;
  spoonGroup.add(spoonHandle);

  const spoonFilling = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), fillingMound.material);
  spoonFilling.scale.set(1.25, 0.72, 0.95);
  spoonFilling.position.set(0.02, 0.02, 0);
  spoonFilling.visible = false;
  spoonGroup.add(spoonFilling);

  return { group, bowl, fillingMound, spoonGroup, spoonFilling };
}

// =========================================================================
// 6. Clear Glass Katakuriko-Water Cup & Animated Pouring Stream
// =========================================================================
export function createWaterCup() {
  const group = new THREE.Group();
  group.name = 'waterCup';

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.45, 0.86),
    new THREE.Vector2(0.41, 0.88),
    new THREE.Vector2(0.35, 0.08),
    new THREE.Vector2(0.0, 0.08),
  ];
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef7fc,
    roughness: 0.04,
    metalness: 0.06,
    transparent: true,
    opacity: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.4,
    depthWrite: false,
  });
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), glassMat);
  glassMesh.renderOrder = 12;
  group.add(glassMesh);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.038, 10, 20, Math.PI * 1.1),
    glassMat
  );
  handle.position.set(-0.42, 0.48, 0);
  handle.rotation.z = Math.PI * 0.45;
  group.add(handle);

  const waterInside = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.30, 0.54, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f1e8,
      roughness: 0.08,
      metalness: 0.02,
      transparent: true,
      opacity: 0.78,
      clearcoat: 1.0,
      depthWrite: false,
    })
  );
  waterInside.position.y = 0.37;
  waterInside.renderOrder = 10;
  group.add(waterInside);

  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.42, 0.82, 0),
    new THREE.Vector3(0.84, 0.62, 0),
    new THREE.Vector3(1.14, 0.12, 0),
    new THREE.Vector3(1.26, -0.58, 0),
  ]);
  const streamMesh = new THREE.Mesh(
    new THREE.TubeGeometry(streamCurve, 18, 0.046, 10, false),
    new THREE.MeshPhysicalMaterial({
      color: 0xfaf9f5,
      roughness: 0.06,
      transparent: true,
      opacity: 0.86,
      clearcoat: 1.0,
      depthWrite: false,
    })
  );
  streamMesh.visible = false;
  streamMesh.renderOrder = 15;
  group.add(streamMesh);

  return { group, glassMesh, waterInside, streamMesh };
}

// =========================================================================
// 7. Japanese Stoneware Serving Plate, Soy-Chili Dipping Dish & Bamboo Chopsticks
// =========================================================================
export function createServingSet(textures) {
  const plateGroup = new THREE.Group();
  plateGroup.name = 'servingPlate';

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.22, 0.0),
    new THREE.Vector2(1.36, 0.06),
    new THREE.Vector2(1.90, 0.25),
    new THREE.Vector2(1.94, 0.30),
    new THREE.Vector2(1.85, 0.31),
    new THREE.Vector2(1.32, 0.12),
    new THREE.Vector2(0.0, 0.10),
  ];
  const plateGeo = new THREE.LatheGeometry(pts, 52);
  const pPos = plateGeo.attributes.position;
  const pUvs = plateGeo.attributes.uv;
  for (let i = 0; i < pPos.count; i++) {
    pUvs.setXY(i, 0.5 + pPos.getX(i) / 3.92, 0.5 + pPos.getZ(i) / 3.92);
  }
  const plateMesh = new THREE.Mesh(
    plateGeo,
    new THREE.MeshPhysicalMaterial({
      map: textures.stoneware.map,
      bumpMap: textures.stoneware.bumpMap,
      bumpScale: 0.014,
      roughnessMap: textures.stoneware.roughnessMap,
      roughness: 0.3,
      metalness: 0.08,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    })
  );
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  plateGroup.add(plateMesh);

  const sauceGroup = new THREE.Group();
  sauceGroup.name = 'sauceDish';

  const dPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.56, 0.19),
    new THREE.Vector2(0.52, 0.21),
    new THREE.Vector2(0.36, 0.06),
    new THREE.Vector2(0.0, 0.06),
  ];
  const dishMesh = new THREE.Mesh(
    new THREE.LatheGeometry(dPts, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0xeae4d9,
      roughness: 0.2,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
    })
  );
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  sauceGroup.add(dishMesh);

  const soyLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0x220903,
      roughness: 0.03,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.4,
    })
  );
  soyLiquid.rotation.x = -Math.PI / 2;
  soyLiquid.position.y = 0.135;
  sauceGroup.add(soyLiquid);

  const rayuMat = new THREE.MeshPhysicalMaterial({
    color: 0xe03a0a,
    roughness: 0.04,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
  });
  const rayuSpots = [
    [0.14, 0.08, 0.075], [-0.12, 0.14, 0.055], [-0.18, -0.09, 0.068],
    [0.06, -0.17, 0.048], [0.22, -0.05, 0.04], [-0.02, 0.03, 0.06],
  ];
  for (const [rx, rz, rr] of rayuSpots) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(rr, 14), rayuMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(rx, 0.138, rz);
    sauceGroup.add(spot);
  }

  const rippleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.085, 24),
    new THREE.MeshBasicMaterial({ color: 0xebb07a, transparent: true, opacity: 0, depthWrite: false })
  );
  rippleRing.rotation.x = -Math.PI / 2;
  rippleRing.position.y = 0.141;
  sauceGroup.add(rippleRing);

  const chopsticks = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d5b32, roughness: 0.42, metalness: 0.04 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.28, metalness: 0.08 });
  for (const side of [-1, 1]) {
    const stick = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.036, 2.5, 10), woodMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 1.25;
    shaft.castShadow = true;
    stick.add(shaft);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.038, 0.65, 10), tipMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.x = 2.18;
    stick.add(grip);

    stick.position.z = side * 0.095;
    stick.rotation.y = side * -0.055;
    chopsticks.add(stick);
  }
  chopsticks.visible = false;

  return { plateGroup, plateMesh, sauceGroup, rippleRing, chopsticks };
}

// =========================================================================
// 8. Authentic Japanese Kitchen Backdrop, Counter, Hinoki Board & Wrapper Stack
// =========================================================================
export function createKitchenEnvironment(textures) {
  const group = new THREE.Group();

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x23201d, roughness: 0.5, metalness: 0.08 })
  );
  counter.position.set(0, -0.32, 0.5);
  counter.receiveShadow = true;
  group.add(counter);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 8.5),
    new THREE.MeshStandardMaterial({
      map: textures.tile.map,
      bumpMap: textures.tile.bumpMap,
      bumpScale: 0.025,
      roughnessMap: textures.tile.roughnessMap,
      roughness: 0.38,
      metalness: 0.06,
    })
  );
  backWall.position.set(0, 3.4, -3.25);
  backWall.receiveShadow = true;
  group.add(backWall);

  const hoodLip = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.35, 2.2),
    new THREE.MeshStandardMaterial({ map: textures.steel.map, roughness: 0.28, metalness: 0.85 })
  );
  hoodLip.position.set(0.85, 5.1, -2.1);
  group.add(hoodLip);

  // Warm Hinoki Cutting Board positioned cleanly in front-left (zero overlap with gas stove!)
  const cuttingBoard = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.11, 1.65),
    new THREE.MeshStandardMaterial({
      map: textures.wood.map,
      bumpMap: textures.wood.bumpMap,
      bumpScale: 0.016,
      roughnessMap: textures.wood.roughnessMap,
      roughness: 0.68,
      metalness: 0.02,
    })
  );
  cuttingBoard.position.set(-0.78, 0.035, 1.48);
  cuttingBoard.rotation.y = 0.04;
  cuttingBoard.castShadow = true;
  cuttingBoard.receiveShadow = true;
  group.add(cuttingBoard);

  // Fresh flour-dusted wrapper stack on left corner of board
  const stackGroup = new THREE.Group();
  stackGroup.position.set(-1.58, 0.095, 1.86);
  stackGroup.name = 'wrapperStack';
  const rawDoughMat = new THREE.MeshStandardMaterial({ map: textures.dough.map, roughness: 0.88 });
  for (let i = 0; i < 6; i++) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.014, 24), rawDoughMat);
    disc.position.set((i % 2) * 0.012, i * 0.015, (i % 3 - 1) * 0.01);
    disc.receiveShadow = true;
    disc.castShadow = true;
    stackGroup.add(disc);
  }
  group.add(stackGroup);

  // Subtle background sesame oil bottle for photographic depth
  const bottleGroup = new THREE.Group();
  bottleGroup.position.set(3.65, 0.0, -2.2);
  const amberGlass = new THREE.MeshPhysicalMaterial({
    color: 0x5c2e0a,
    roughness: 0.08,
    metalness: 0.06,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.86,
  });
  const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 1.15, 20), amberGlass);
  bBody.position.y = 0.58;
  bBody.castShadow = true;
  bottleGroup.add(bBody);
  const bNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.19, 0.45, 16), amberGlass);
  bNeck.position.y = 1.32;
  bottleGroup.add(bNeck);
  const bCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.16, 14),
    new THREE.MeshStandardMaterial({ color: 0xa62c1c, roughness: 0.35 })
  );
  bCap.position.y = 1.62;
  bottleGroup.add(bCap);
  group.add(bottleGroup);

  return { group, cuttingBoard, stackGroup };
}

// =========================================================================
// 9. Subtle Realistic Articulated 3D Idle Demo Hand
// =========================================================================
export function createDemoHand() {
  const group = new THREE.Group();
  group.visible = false;

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xe9bfa4,
    roughness: 0.48,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffd7c2),
    transparent: true,
    opacity: 0.0,
  });

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skinMat);
  palm.scale.set(1.05, 0.58, 1.2);
  palm.position.set(0.08, 0.14, 0.28);
  group.add(palm);

  const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.28, 8, 14), skinMat);
  finger.rotation.x = Math.PI * 0.42;
  finger.position.set(0, 0.08, 0.04);
  group.add(finger);

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 8, 12), skinMat);
  thumb.rotation.set(0.6, 0, 0.7);
  thumb.position.set(-0.08, 0.12, 0.22);
  group.add(thumb);

  const curled1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.15, 6, 10), skinMat);
  curled1.rotation.x = Math.PI * 0.65;
  curled1.position.set(0.11, 0.09, 0.18);
  group.add(curled1);

  const curled2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.13, 6, 10), skinMat);
  curled2.rotation.x = Math.PI * 0.7;
  curled2.position.set(0.19, 0.1, 0.22);
  group.add(curled2);

  return { group, skinMat };
}
