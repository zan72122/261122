import * as THREE from 'three';

/**
 * Generates a custom HDR-feeling PMREM environment map modeling a warm Japanese
 * dining room with an overhead tungsten pendant lamp and a cool rainy winter window
 * filled with warm/cool bokeh city lights behind the table.
 * This gives wet cabbage, tofu, ceramic donabe glaze, and stainless ladle genuine
 * photographic specular reflections.
 */
export function buildDiningEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0b0d14);

  // Soft interior room enclosure
  const roomGeo = new THREE.BoxGeometry(10, 6, 10);
  const roomMat = new THREE.MeshBasicMaterial({
    color: 0x1a1412,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Warm overhead dining pendant lamp — main bright specular key
  const lampDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 3.2, 1.9), side: THREE.DoubleSide })
  );
  lampDisc.position.set(0, 2.35, 0.15);
  lampDisc.rotation.x = Math.PI / 2;
  envScene.add(lampDisc);

  // Soft warm ceiling bounce halo around lamp
  const ceilingBounce = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.62, 0.34), side: THREE.DoubleSide })
  );
  ceilingBounce.position.set(0, 2.85, 0.2);
  ceilingBounce.rotation.x = Math.PI / 2;
  envScene.add(ceilingBounce);

  // Warm side kitchen/living room soft fill (left & right)
  const sideWarmL = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.56, 0.34), side: THREE.DoubleSide })
  );
  sideWarmL.position.set(-4.5, 0.6, 0.6);
  sideWarmL.rotation.y = Math.PI / 2;
  envScene.add(sideWarmL);

  const sideWarmR = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 2.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.65, 0.45, 0.30), side: THREE.DoubleSide })
  );
  sideWarmR.position.set(4.5, 0.5, 0.8);
  sideWarmR.rotation.y = -Math.PI / 2;
  envScene.add(sideWarmR);

  // Cool rainy winter window behind the family (z = -4.6)
  const windowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.52, 0.92), side: THREE.DoubleSide })
  );
  windowGlow.position.set(0, 0.9, -4.6);
  envScene.add(windowGlow);

  // Colorful out-of-focus city bokeh spots embedded in the window reflection
  const bokehDefs = [
    [-1.9, 0.6, 0.28, new THREE.Color(3.2, 2.0, 0.8)],
    [-0.9, 1.1, 0.22, new THREE.Color(2.8, 2.3, 1.4)],
    [-0.2, 0.4, 0.24, new THREE.Color(3.0, 1.2, 0.7)],
    [0.65, 1.25, 0.25, new THREE.Color(1.4, 2.3, 3.4)],
    [1.45, 0.55, 0.30, new THREE.Color(3.5, 2.1, 0.85)],
    [2.1, 1.0, 0.19, new THREE.Color(2.5, 2.4, 1.8)],
    [-1.3, 1.5, 0.18, new THREE.Color(1.2, 2.0, 3.2)],
  ];
  const bokehGeo = new THREE.CircleGeometry(1, 20);
  for (const [bx, by, br, col] of bokehDefs) {
    const m = new THREE.Mesh(bokehGeo, new THREE.MeshBasicMaterial({ color: col }));
    m.scale.setScalar(br);
    m.position.set(bx, by, -4.45);
    envScene.add(m);
  }

  // Warm wooden table bounce below
  const tableBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.28, 0.16), side: THREE.DoubleSide })
  );
  tableBounce.position.set(0, -1.6, 0.2);
  tableBounce.rotation.x = -Math.PI / 2;
  envScene.add(tableBounce);

  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.95;

  pmrem.dispose();

  // ---- Physical Cinematic Lighting Rig ----
  // 1. Warm overhead pendant spotlight (cinematic pool on donabe & food, velvety shadows)
  const pendantLight = new THREE.SpotLight(0xffcc8c, 3.8, 5.5, Math.PI * 0.38, 0.68, 1.45);
  pendantLight.position.set(0.02, 1.48, 0.12);
  pendantLight.target.position.set(0.0, 0.06, 0.0);
  pendantLight.castShadow = true;
  pendantLight.shadow.mapSize.set(1024, 1024);
  pendantLight.shadow.camera.near = 0.35;
  pendantLight.shadow.camera.far = 2.8;
  pendantLight.shadow.bias = -0.0005;
  pendantLight.shadow.normalBias = 0.015;
  pendantLight.shadow.radius = 3.2;
  scene.add(pendantLight);
  scene.add(pendantLight.target);

  // 2. Gentle warm bounce fill from table/broth onto family faces (keeps photographic shadow depth!)
  const warmFaceFill = new THREE.PointLight(0xffb46e, 0.92, 2.6, 1.7);
  warmFaceFill.position.set(0, 0.38, 0.36);
  scene.add(warmFaceFill);

  // 3. Cool winter rainy window backlight / rim light (cinematic warm-vs-cool contrast!)
  const windowRim = new THREE.DirectionalLight(0x5e8ee0, 1.45);
  windowRim.position.set(-0.25, 0.95, -2.2);
  windowRim.target.position.set(0, 0.22, 0.15);
  scene.add(windowRim);
  scene.add(windowRim.target);

  // 4. Soft warm/cool ambient hemisphere fill
  const hemi = new THREE.HemisphereLight(0xc9ae90, 0x2b1b12, 0.52);
  scene.add(hemi);

  // 5. Dynamic gas burner blue-orange underglow light under the donabe
  const flameLight = new THREE.PointLight(0x4aa8ff, 0.6, 0.85, 2.0);
  flameLight.position.set(0, 0.085, 0.05);
  scene.add(flameLight);

  return {
    envRT,
    pendantLight,
    warmFaceFill,
    windowRim,
    flameLight,
  };
}
