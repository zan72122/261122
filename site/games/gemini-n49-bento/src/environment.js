import * as THREE from '../lib/three.module.js';

// Build a procedural Japanese kitchen morning room environment for PMREM reflections.
// Bright 2x2 morning kitchen window panes create crisp glossy window reflections on cherry tomatoes & glazed plates!
function buildEnvTexture(pmremGenerator, stageT) {
  const envScene = new THREE.Scene();

  // Dramatic early morning cool blue dawn (0.0) -> soft rosy sunrise (0.45) -> warm honey golden sun (1.0)
  const skyCool = new THREE.Color(0x5d96e0);
  const skyBlush = new THREE.Color(0xf4b28a);
  const skyWarm = new THREE.Color(0xffdfa2);
  const skyCol = stageT < 0.45
    ? skyCool.clone().lerp(skyBlush, stageT / 0.45)
    : skyBlush.clone().lerp(skyWarm, (stageT - 0.45) / 0.55);

  const wallCool = new THREE.Color(0x203148);
  const wallWarm = new THREE.Color(0x6b513e);
  const wallCol = wallCool.clone().lerp(wallWarm, stageT);

  const floorCool = new THREE.Color(0x181e28);
  const floorWarm = new THREE.Color(0x4e3725);
  const floorCol = floorCool.clone().lerp(floorWarm, stageT);

  const roomGeo = new THREE.BoxGeometry(24, 16, 24);
  const roomMat = new THREE.MeshBasicMaterial({ color: wallCol, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: floorCol })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  envScene.add(floor);

  const ceilCol = new THREE.Color(0x76a2d8).lerp(new THREE.Color(0xffecd0), stageT);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: ceilCol })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 7.8;
  envScene.add(ceil);

  // Crisp bright 2x2 Japanese morning kitchen window on upper-left wall
  const winGroup = new THREE.Group();
  winGroup.position.set(-7.2, 4.6, -3.2);
  winGroup.lookAt(0, 0, 0);

  const paneColor = skyCol.clone().multiplyScalar(5.8 + stageT * 2.4);
  const paneMat = new THREE.MeshBasicMaterial({ color: paneColor });
  const paneW = 3.0;
  const paneH = 2.6;
  const gap = 0.44;
  for (let ix = -1; ix <= 1; ix += 2) {
    for (let iy = -1; iy <= 1; iy += 2) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(paneW, paneH), paneMat);
      pane.position.set(ix * (paneW * 0.5 + gap * 0.5), iy * (paneH * 0.5 + gap * 0.5), 0);
      winGroup.add(pane);
    }
  }
  envScene.add(winGroup);

  // Secondary soft overhead kitchen light reflection
  const overheadCol = new THREE.Color(0x8db8ea).lerp(new THREE.Color(0xfff2d8), stageT).multiplyScalar(1.9 + stageT * 0.6);
  const overhead = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 4.8),
    new THREE.MeshBasicMaterial({ color: overheadCol })
  );
  overhead.position.set(1.2, 7.6, 1.4);
  overhead.rotation.x = Math.PI / 2;
  envScene.add(overhead);

  // Opposite warm/cool bounce panel
  const fillPanelCol = new THREE.Color(0x41648c).lerp(new THREE.Color(0xffbe80), stageT).multiplyScalar(1.3);
  const fillPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshBasicMaterial({ color: fillPanelCol })
  );
  fillPanel.position.set(9.5, 2.5, 3.5);
  fillPanel.lookAt(0, 0, 0);
  envScene.add(fillPanel);

  return pmremGenerator.fromScene(envScene, 0.025);
}

export function createMorningEnvironment(renderer, scene, textures) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envStages = [0.0, 0.34, 0.68, 1.0].map((t) => buildEnvTexture(pmrem, t));
  pmrem.dispose();

  scene.environment = envStages[0].texture;

  // 1. Primary Morning Window Sun Directional Light (tight 1024x1024 soft shadow frustum)
  const sunLight = new THREE.DirectionalLight(0xa6ceff, 2.25);
  sunLight.position.set(-6.0, 7.4, -3.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1.5;
  sunLight.shadow.camera.far = 22;
  const d = 6.2;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.022;
  sunLight.shadow.radius = 3.4;
  scene.add(sunLight);

  // 2. Sky-to-Wood Counter Hemisphere Light
  const hemiLight = new THREE.HemisphereLight(0x7aaee8, 0x2a3342, 0.92);
  scene.add(hemiLight);

  // 3. Soft Kitchen Bounce Fill
  const fillLight = new THREE.DirectionalLight(0x80a8d8, 0.52);
  fillLight.position.set(5.5, 4.2, 4.8);
  scene.add(fillLight);

  // 4. Crisp Specular Rim Light
  const rimLight = new THREE.DirectionalLight(0xc2dfff, 0.78);
  rimLight.position.set(-2.5, 3.6, -6.2);
  scene.add(rimLight);

  // 5. Realistic Japanese Kitchen Backdrop Wall + Subtle Sunlit Window Frame (eliminates empty void in low-angle macro shots!)
  const backdropGroup = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd8cfc2,
    roughness: 0.92,
    metalness: 0.0
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(34, 14), wallMat);
  backWall.position.set(0, 6.2, -7.8);
  backWall.receiveShadow = true;
  backdropGroup.add(backWall);

  // Subtle horizontal oak wainscot / kitchen backsplash rail along the back of the counter
  const railMat = new THREE.MeshStandardMaterial({
    map: textures.tableMap,
    roughness: 0.75
  });
  const counterBackRail = new THREE.Mesh(new THREE.BoxGeometry(34, 0.55, 0.35), railMat);
  counterBackRail.position.set(0, 0.25, -7.65);
  backdropGroup.add(counterBackRail);

  // Soft glowing frosted kitchen window recessed on upper-left of the back wall
  const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xb6d6ff });
  const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 5.2), windowGlowMat);
  winGlow.position.set(-5.8, 4.2, -7.72);
  backdropGroup.add(winGlow);

  // Warm cedar window mullions across the distant frosted window
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6e4e35, roughness: 0.72 });
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.4, 0.16), frameMat);
  vBar.position.set(-5.8, 4.2, -7.66);
  backdropGroup.add(vBar);
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.22, 0.16), frameMat);
  hBar.position.set(-5.8, 4.2, -7.66);
  backdropGroup.add(hBar);
  scene.add(backdropGroup);

  // 6. Dappled Morning Sunlight Gobo Overlay Plane across the wooden counter
  const goboCanvas = document.createElement('canvas');
  goboCanvas.width = 512;
  goboCanvas.height = 512;
  const gCtx = goboCanvas.getContext('2d');
  gCtx.clearRect(0, 0, 512, 512);
  const grad = gCtx.createRadialGradient(210, 220, 40, 256, 256, 250);
  grad.addColorStop(0, 'rgba(255, 240, 210, 0.36)');
  grad.addColorStop(0.65, 'rgba(255, 228, 180, 0.16)');
  grad.addColorStop(1, 'rgba(255, 220, 170, 0.0)');
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, 512, 512);
  gCtx.globalCompositeOperation = 'destination-out';
  gCtx.fillStyle = 'rgba(0,0,0,0.68)';
  gCtx.fillRect(244, 0, 22, 512);
  gCtx.fillRect(0, 244, 512, 22);
  const goboTex = new THREE.CanvasTexture(goboCanvas);
  goboTex.colorSpace = THREE.SRGBColorSpace;
  const sunPatchMat = new THREE.MeshBasicMaterial({
    map: goboTex,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 12.5), sunPatchMat);
  sunPatch.rotation.x = -Math.PI / 2;
  sunPatch.rotation.z = -0.32;
  sunPatch.position.set(-0.6, 0.008, -0.3);
  scene.add(sunPatch);

  // 7. Soft Circular Bokeh Sunbeam Dust Motes (using soft radial sprite map — zero harsh squares!)
  const moteCount = 36;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 9.5;
    motePos[i * 3 + 1] = 0.7 + Math.random() * 3.8;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 7.5;
    moteSeeds[i] = Math.random() * Math.PI * 2;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffe8ba,
    map: textures.steamMap,
    size: 0.16,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  // Strong, unmistakable Dawn Blue (5:45 AM) -> Warm Golden Sun (7:15 AM) color palettes!
  const bgCool = new THREE.Color(0x1b2638);
  const bgMid = new THREE.Color(0x2e2928);
  const bgWarm = new THREE.Color(0x3b2c20);

  const sunCoolCol = new THREE.Color(0x96c4ff); // Unmistakable pale early-morning blue light!
  const sunRoseCol = new THREE.Color(0xffcca0);
  const sunGoldCol = new THREE.Color(0xffd482); // Warm golden honey morning sun!

  const hemiSkyCool = new THREE.Color(0x699ee2);
  const hemiSkyWarm = new THREE.Color(0xffe6bd);
  const hemiGndCool = new THREE.Color(0x222e42);
  const hemiGndWarm = new THREE.Color(0x755034);

  const fillCoolCol = new THREE.Color(0x76a2d8);
  const fillWarmCol = new THREE.Color(0xffc992);

  const rimCoolCol = new THREE.Color(0xb4d8ff);
  const rimWarmCol = new THREE.Color(0xffe0a4);

  const patchCoolCol = new THREE.Color(0x88b8f5);
  const patchWarmCol = new THREE.Color(0xffcd72);

  const winCoolCol = new THREE.Color(0x9ac6f8);
  const winWarmCol = new THREE.Color(0xfff0c8);

  const wallCoolTint = new THREE.Color(0xbfcbe0);
  const wallWarmTint = new THREE.Color(0xefe1ce);

  let currentEnvIdx = 0;

  function update(progress, elapsed) {
    const t = Math.max(0, Math.min(1, progress));

    const desiredIdx = t < 0.22 ? 0 : t < 0.55 ? 1 : t < 0.85 ? 2 : 3;
    if (desiredIdx !== currentEnvIdx) {
      currentEnvIdx = desiredIdx;
      scene.environment = envStages[currentEnvIdx].texture;
    }

    const bg = t < 0.45
      ? bgCool.clone().lerp(bgMid, t / 0.45)
      : bgMid.clone().lerp(bgWarm, (t - 0.45) / 0.55);
    scene.background = bg;

    const sunCol = t < 0.45
      ? sunCoolCol.clone().lerp(sunRoseCol, t / 0.45)
      : sunRoseCol.clone().lerp(sunGoldCol, (t - 0.45) / 0.55);
    sunLight.color.copy(sunCol);
    sunLight.intensity = 2.0 + t * 1.48;
    sunLight.position.set(-6.4 + t * 1.8, 7.6 - t * 1.4, -3.8 + t * 2.1);

    hemiLight.color.copy(hemiSkyCool).lerp(hemiSkyWarm, t);
    hemiLight.groundColor.copy(hemiGndCool).lerp(hemiGndWarm, t);
    hemiLight.intensity = 0.86 + t * 0.34;

    fillLight.color.copy(fillCoolCol).lerp(fillWarmCol, t);
    fillLight.intensity = 0.46 + t * 0.34;

    rimLight.color.copy(rimCoolCol).lerp(rimWarmCol, t);
    rimLight.intensity = 0.72 + t * 0.44;

    windowGlowMat.color.copy(winCoolCol).lerp(winWarmCol, t);
    wallMat.color.copy(wallCoolTint).lerp(wallWarmTint, t);

    sunPatchMat.color.copy(patchCoolCol).lerp(patchWarmCol, t);
    sunPatchMat.opacity = 0.08 + t * 0.32;
    sunPatch.position.x = -1.1 + t * 1.25;
    sunPatch.position.z = -0.6 + t * 0.85;

    renderer.toneMappingExposure = 1.03 + t * 0.11;

    moteMat.opacity = 0.02 + t * 0.34;
    const pos = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      const s = moteSeeds[i];
      pos[i * 3] += Math.sin(elapsed * 0.25 + s) * 0.0014;
      pos[i * 3 + 1] += Math.cos(elapsed * 0.32 + s * 1.3) * 0.001;
    }
    moteGeo.attributes.position.needsUpdate = true;
  }

  update(0, 0);

  return {
    update,
    sunLight,
    dispose() {
      envStages.forEach((rt) => rt.dispose());
    }
  };
}
