import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createEnvironmentAndFX(scene, textures) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. Warm Walnut Dining Table (rich wood grain & subtle clearcoat lacquer)
  textures.woodMap.repeat.set(2.2, 1.6);
  textures.woodRoughnessMap.repeat.set(2.2, 1.6);
  textures.woodNormalMap.repeat.set(2.2, 1.6);

  const tableMat = new THREE.MeshPhysicalMaterial({
    map: textures.woodMap,
    roughnessMap: textures.woodRoughnessMap,
    normalMap: textures.woodNormalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34,
    envMapIntensity: 0.85,
  });

  const tableTop = new THREE.Mesh(
    new RoundedBoxGeometry(1.48, 0.055, 0.92, 4, 0.012),
    tableMat
  );
  tableTop.position.set(0, -0.0275, -0.03);
  tableTop.receiveShadow = true;
  root.add(tableTop);

  // Woven dark-linen / bamboo runner mat beneath stove for grounded tactile realism
  const matGeo = new THREE.BoxGeometry(0.46, 0.004, 0.31);
  const matMat = new THREE.MeshStandardMaterial({
    color: 0x261d17,
    roughness: 0.92,
    bumpMap: textures.knitNormalMap,
    bumpScale: 0.002,
  });
  const trivetMat = new THREE.Mesh(matGeo, matMat);
  trivetMat.position.set(0, 0.002, 0.02);
  trivetMat.receiveShadow = true;
  root.add(trivetMat);

  // 2. Cozy Evening Japanese Living-Dining Room Background (kept dark & warm so foreground pops!)
  const roomGroup = new THREE.Group();
  root.add(roomGroup);

  // Warm plastered back wall in soft shadow
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x221711, roughness: 0.95 })
  );
  backWall.position.set(0, 0.65, -1.55);
  roomGroup.add(backWall);

  // Left-back warm Shoji / Kumiko wooden screen backlit by cozy floor lamp
  const shojiGroup = new THREE.Group();
  shojiGroup.position.set(-0.98, 0.48, -1.42);
  shojiGroup.rotation.y = 0.16;
  roomGroup.add(shojiGroup);

  const shojiPaper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.45),
    new THREE.MeshStandardMaterial({
      color: 0x3b2616,
      emissive: new THREE.Color(0xd9843b),
      emissiveIntensity: 0.34,
      roughness: 0.9,
    })
  );
  shojiGroup.add(shojiPaper);

  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x2a180d, roughness: 0.72 });
  for (let i = -2; i <= 2; i++) {
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.48, 0.022), cedarMat);
    vBar.position.set(i * 0.22, 0, 0.01);
    shojiGroup.add(vBar);
  }
  for (let j = -3; j <= 3; j++) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.016, 0.022), cedarMat);
    hBar.position.set(0, j * 0.22, 0.01);
    shojiGroup.add(hBar);
  }

  // Right-back Night Window with deep evening indigo glass & soft distant warm bokeh lights
  const winGroup = new THREE.Group();
  winGroup.position.set(1.05, 0.56, -1.44);
  winGroup.rotation.y = -0.14;
  roomGroup.add(winGroup);

  const nightGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.25),
    new THREE.MeshPhysicalMaterial({
      color: 0x091122,
      emissive: new THREE.Color(0x101e38),
      emissiveIntensity: 0.42,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 0.85,
    })
  );
  winGroup.add(nightGlass);

  // Soft out-of-focus warm evening neighborhood bokeh sprites behind window (feathered radial falloff, NOT flat disks!)
  const bokehColors = [0xffb86c, 0xffd599, 0xff9452, 0x7ea8eb, 0xffe2b0];
  for (let i = 0; i < 9; i++) {
    const s = 0.09 + (i % 3) * 0.05;
    const bMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({
        map: textures.steamMap,
        color: bokehColors[i % bokehColors.length],
        transparent: true,
        opacity: 0.22 + (i % 3) * 0.06,
        depthWrite: false,
      })
    );
    bMesh.position.set(-0.38 + ((i * 0.21) % 0.78), -0.32 + ((i * 0.29) % 0.72), 0.003);
    winGroup.add(bMesh);
  }

  // Window wooden mullions
  for (const xOff of [-0.52, 0, 0.52]) {
    const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.028, 1.28, 0.035), cedarMat);
    frameV.position.set(xOff, 0, 0.015);
    winGroup.add(frameV);
  }
  for (const yOff of [-0.62, 0.02, 0.62]) {
    const frameH = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.028, 0.035), cedarMat);
    frameH.position.set(0, yOff, 0.015);
    winGroup.add(frameH);
  }

  // Warm wooden dining chair backs behind Mom & Dad
  const chairMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    roughness: 0.58,
    color: 0x6e472b,
  });
  for (const cx of [-0.18, 0.18]) {
    const chairBack = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.42, 0.026, 3, 0.008),
      chairMat
    );
    chairBack.position.set(cx, 0.22, -0.58);
    root.add(chairBack);
  }

  // Ceramic Yunomi Teacups on back corners of table (adds lived-in Japanese dinner realism)
  const cupOuterMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b493f,
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });
  const teaMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b5618,
    roughness: 0.06,
    clearcoat: 1.0,
  });
  const teacupPositions = [
    [-0.42, 0.0, -0.22],
    [0.42, 0.0, -0.20],
  ];
  for (const [tx, ty, tz] of teacupPositions) {
    const cup = new THREE.Group();
    cup.position.set(tx, ty, tz);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.026, 0.072, 24, 1, false), cupOuterMat);
    body.position.y = 0.036;
    body.castShadow = true;
    body.receiveShadow = true;
    cup.add(body);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.029, 20), teaMat);
    tea.rotation.x = -Math.PI / 2;
    tea.position.y = 0.064;
    cup.add(tea);
    root.add(cup);
  }

  // 3. Hanging Warm Pendant Lamp ("ペンダントライト" — visible warm rim at top of frame!)
  const pendantGroup = new THREE.Group();
  pendantGroup.position.set(0.0, 0.48, -0.10);
  root.add(pendantGroup);

  // Braided cord
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.85 })
  );
  cord.position.y = 0.34;
  pendantGroup.add(cord);

  // Brushed brass socket collar
  const brassSocket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.048, 20),
    new THREE.MeshStandardMaterial({ color: 0xc89b54, metalness: 0.85, roughness: 0.26 })
  );
  brassSocket.position.y = 0.065;
  pendantGroup.add(brassSocket);

  // Pleated matte cream-ceramic / enamel wide shade with glowing warm interior
  const shadePoints = [
    new THREE.Vector2(0.026, 0.052),
    new THREE.Vector2(0.085, 0.038),
    new THREE.Vector2(0.165, 0.005),
    new THREE.Vector2(0.195, -0.018),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadePoints, 36);
  const shadeOuterMat = new THREE.MeshStandardMaterial({
    color: 0x2b231d,
    roughness: 0.45,
    metalness: 0.15,
    side: THREE.FrontSide,
  });
  const shadeInnerMat = new THREE.MeshStandardMaterial({
    color: 0xffdfaf,
    emissive: new THREE.Color(0xffb45e),
    emissiveIntensity: 0.85,
    roughness: 0.35,
    side: THREE.BackSide,
  });
  pendantGroup.add(new THREE.Mesh(shadeGeo, shadeOuterMat));
  pendantGroup.add(new THREE.Mesh(shadeGeo, shadeInnerMat));

  // Glowing warm tungsten-amber diffuser bulb
  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 20, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.65, 0.92) })
  );
  bulbMesh.position.y = 0.012;
  pendantGroup.add(bulbMesh);

  // 4. Cinematic Evening Lighting Rig (balanced exposure so faces & crust have rich 3D modeling!)
  const pendantSpot = new THREE.SpotLight(0xffcb92, 2.55, 3.2, Math.PI * 0.46, 0.82, 1.35);
  pendantSpot.position.set(0.02, 0.66, 0.08);
  pendantSpot.target.position.set(0, 0.04, -0.08);
  pendantSpot.castShadow = true;
  pendantSpot.shadow.mapSize.set(1024, 1024);
  pendantSpot.shadow.camera.near = 0.18;
  pendantSpot.shadow.camera.far = 2.0;
  pendantSpot.shadow.bias = -0.00045;
  pendantSpot.shadow.normalBias = 0.012;
  pendantSpot.shadow.radius = 3.5;
  scene.add(pendantSpot);
  scene.add(pendantSpot.target);

  const tableBounceLight = new THREE.PointLight(0xffa458, 0.68, 1.35, 1.5);
  tableBounceLight.position.set(0, 0.14, 0.02);
  scene.add(tableBounceLight);

  const frontSoftFill = new THREE.DirectionalLight(0xffdfc2, 0.36);
  frontSoftFill.position.set(-0.28, 0.38, 0.78);
  scene.add(frontSoftFill);

  const nightRimLight = new THREE.DirectionalLight(0x6b8fd4, 0.52);
  nightRimLight.position.set(0.95, 0.65, -0.85);
  scene.add(nightRimLight);

  const hemiLight = new THREE.HemisphereLight(0xffd5ab, 0x361d0f, 0.38);
  scene.add(hemiLight);

  // 5. Volumetric-feeling Sizzling Steam Particle Pool (billboarded soft sprites)
  const MAX_STEAM = 95;
  const steamParticles = [];
  const steamGeo = new THREE.PlaneGeometry(1, 1);
  const steamGroup = new THREE.Group();
  root.add(steamGroup);

  for (let i = 0; i < MAX_STEAM; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: textures.steamMap,
      color: 0xfff2e2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(steamGeo, mat);
    mesh.visible = false;
    steamGroup.add(mesh);
    steamParticles.push({
      mesh,
      mat,
      active: false,
      age: 0,
      life: 1.4,
      vx: 0,
      vy: 0,
      vz: 0,
      size0: 0.04,
      size1: 0.14,
      peakAlpha: 0.22,
      rot: 0,
      rotVel: 0,
    });
  }

  let steamCursor = 0;
  function spawnSteam(x, y, z, opts = {}) {
    const p = steamParticles[steamCursor];
    steamCursor = (steamCursor + 1) % MAX_STEAM;
    p.active = true;
    p.age = 0;
    p.life = opts.life || (1.1 + Math.random() * 0.85);
    p.mesh.position.set(
      x + (Math.random() - 0.5) * (opts.spread || 0.022),
      y,
      z + (Math.random() - 0.5) * (opts.spread || 0.022)
    );
    p.vx = (opts.vx || 0) + (Math.random() - 0.5) * 0.035;
    p.vy = opts.vy || (0.085 + Math.random() * 0.065);
    p.vz = (opts.vz || 0) + (Math.random() - 0.5) * 0.035;
    p.size0 = opts.size0 || 0.032;
    p.size1 = opts.size1 || (0.11 + Math.random() * 0.055);
    p.peakAlpha = opts.alpha || 0.21;
    p.rot = Math.random() * Math.PI * 2;
    p.rotVel = (Math.random() - 0.5) * 1.1;
    p.mesh.visible = true;
  }

  // 6. Hot Oil Splatter Droplet InstancedMesh ("油はね粒子")
  const MAX_DROPS = 110;
  const dropGeo = new THREE.SphereGeometry(0.0022, 6, 6);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xffe49e,
    emissive: new THREE.Color(0xffb84d),
    emissiveIntensity: 0.35,
    roughness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
  });
  const dropInst = new THREE.InstancedMesh(dropGeo, dropMat, MAX_DROPS);
  dropInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(dropInst);

  const drops = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < MAX_DROPS; i++) {
    drops.push({
      active: false,
      age: 0,
      life: 0.45,
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    dummy.position.set(0, -10, 0);
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    dropInst.setMatrixAt(i, dummy.matrix);
  }
  let dropCursor = 0;

  function spawnOilSplatter(x, y, z, count = 4, power = 1.0) {
    for (let k = 0; k < count; k++) {
      const d = drops[dropCursor];
      dropCursor = (dropCursor + 1) % MAX_DROPS;
      d.active = true;
      d.age = 0;
      d.life = 0.28 + Math.random() * 0.26;
      d.x = x + (Math.random() - 0.5) * 0.025;
      d.y = y + 0.004;
      d.z = z + (Math.random() - 0.5) * 0.025;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.14 + Math.random() * 0.28) * power;
      d.vx = Math.cos(ang) * spd;
      d.vz = Math.sin(ang) * spd;
      d.vy = (0.36 + Math.random() * 0.42) * power;
    }
  }

  // Interactive air/wind gust state (triggered when player swipes through steam or Mom/Dad blows "ふーっ")
  const windImpulse = new THREE.Vector3();

  function addWindGust(vx, vy, vz) {
    windImpulse.x += vx;
    windImpulse.y += vy;
    windImpulse.z += vz;
  }

  let teaTimer = 0;

  function update(dt, time, camera, heatLevel = 0.3) {
    // Subtle organic sway of pendant lamp & warm firelight flicker on bounce light
    pendantGroup.rotation.z = Math.sin(time * 0.55) * 0.006;
    tableBounceLight.intensity = 0.92 + Math.sin(time * 9.3) * 0.035 * heatLevel + Math.cos(time * 14.7) * 0.025 * heatLevel;

    // Decay wind gust
    windImpulse.multiplyScalar(Math.pow(0.04, dt));

    // Gentle teacup steam wisps
    teaTimer -= dt;
    if (teaTimer <= 0) {
      teaTimer = 0.55 + Math.random() * 0.5;
      const cupPick = teacupPositions[Math.random() < 0.5 ? 0 : 1];
      spawnSteam(cupPick[0], 0.075, cupPick[2], {
        size0: 0.018,
        size1: 0.055,
        vy: 0.045,
        alpha: 0.09,
        life: 1.5,
      });
    }

    // Update steam billboards
    for (let i = 0; i < MAX_STEAM; i++) {
      const p = steamParticles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = p.age / p.life;
      // Curl turbulence + wind gust
      const swirl = Math.sin(time * 2.6 + i * 0.7) * 0.028;
      p.mesh.position.x += (p.vx + swirl + windImpulse.x * (0.4 + t * 0.8)) * dt;
      p.mesh.position.y += (p.vy * (1 - t * 0.35) + windImpulse.y * 0.3) * dt;
      p.mesh.position.z += (p.vz + Math.cos(time * 2.1 + i) * 0.02 + windImpulse.z * (0.4 + t * 0.8)) * dt;

      const s = p.size0 + (p.size1 - p.size0) * Math.pow(t, 0.72);
      p.mesh.scale.set(s, s * (1 + t * 0.25), 1);
      p.rot += p.rotVel * dt;
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.rotateZ(p.rot);

      const fadeIn = THREE.MathUtils.smoothstep(t, 0.0, 0.16);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(t, 0.28, 1.0);
      p.mat.opacity = p.peakAlpha * fadeIn * fadeOut;
    }

    // Update oil splatter droplets
    let dropsDirty = false;
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = drops[i];
      if (!d.active) continue;
      dropsDirty = true;
      d.age += dt;
      if (d.age >= d.life || d.y < 0.01) {
        d.active = false;
        dummy.position.set(0, -10, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        dropInst.setMatrixAt(i, dummy.matrix);
        continue;
      }
      d.vy -= 2.35 * dt; // scaled close-up gravity so oil pops are clearly visible!
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      const stretch = 1.0 + Math.min(1.6, Math.hypot(d.vx, d.vy, d.vz) * 1.4);
      const shrink = 1.0 - (d.age / d.life) * 0.55;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(shrink, shrink * stretch, shrink);
      dummy.updateMatrix();
      dropInst.setMatrixAt(i, dummy.matrix);
    }
    if (dropsDirty) {
      dropInst.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    root,
    pendantSpot,
    tableBounceLight,
    windImpulse,
    spawnSteam,
    spawnOilSplatter,
    addWindGust,
    update,
  };
}
