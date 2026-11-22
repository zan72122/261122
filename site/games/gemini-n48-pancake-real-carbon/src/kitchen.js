import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createOakWoodTextures,
  createCastIronTextures,
  createFabricTextures,
  createAtmosphereTextures,
  createStrawberryTextures,
} from './textures.js';

export class MorningKitchen {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.sunDir = new THREE.Vector3(-0.68, 0.56, -0.47).normalize();
    this.panBasePos = new THREE.Vector3(-0.095, 0.030, 0.068);
    this.platePos = new THREE.Vector3(0.195, 0.012, 0.078);

    this.panOffset = new THREE.Vector3();
    this.panVel = new THREE.Vector3();
    this.panTilt = new THREE.Euler();
    this.flameIntensity = 1.0;
    this.panButterMelt = 0.65;
    this.turbulence = 0;

    this._buildLighting();
    this._buildRoomAndWindow();
    this._buildStoveAndSkillet();
    this._buildPlateAndProps();
    this._buildSunbeamsAndDust();
    this._buildSteam();
  }

  _buildLighting() {
    // Rich photographic contrast: warm sunlit key + deep natural oak/plaster shadow tones!
    this.hemiLight = new THREE.HemisphereLight(0xfff3e2, 0x4f301a, 0.30);
    this.hemiLight.position.set(0, 2.0, 0);
    this.scene.add(this.hemiLight);

    // Main slanted weekend morning sunlight through the left-back window
    this.sunLight = new THREE.DirectionalLight(0xffe0ae, 2.45);
    this.sunLight.position.set(-1.55, 1.28, -1.05);
    this.sunLight.target.position.set(0.05, 0.05, 0.08);
    this.sunLight.castShadow = true;
    // Strictly <= 1024px shadow map covering back subway-tile wall + Mom + oak countertop for diagonal window shadows!
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 0.35;
    this.sunLight.shadow.camera.far = 4.2;
    const d = 0.88;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.012;
    this.sunLight.shadow.radius = 2.2;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Soft cool sky fill so shadow side of Mom's face & pancake has natural 3D sculpting
    this.windowFill = new THREE.DirectionalLight(0xcfe0ff, 0.22);
    this.windowFill.position.set(-0.85, 0.95, 0.75);
    this.scene.add(this.windowFill);

    // Subtle warm bounce light reflecting off oak countertop up onto Mom's chin & hands
    this.counterBounce = new THREE.PointLight(0xffb46e, 0.28, 1.2, 1.8);
    this.counterBounce.position.set(0.05, 0.06, 0.24);
    this.scene.add(this.counterBounce);

    // Subtle warm stove burner glow under skillet
    this.burnerLight = new THREE.PointLight(0xff7a2f, 0.28, 0.50, 2.0);
    this.burnerLight.position.set(this.panBasePos.x, 0.018, this.panBasePos.z);
    this.scene.add(this.burnerLight);
  }

  _buildRoomAndWindow() {
    const oak = createOakWoodTextures();
    oak.map.repeat.set(2.2, 1.4);
    oak.roughnessMap.repeat.set(2.2, 1.4);

    // Butcher-block solid oak kitchen counter / island
    const counterMat = new THREE.MeshStandardMaterial({
      map: oak.map,
      roughnessMap: oak.roughnessMap,
      bumpMap: oak.bumpMap,
      bumpScale: 0.0025,
      roughness: 0.52,
      metalness: 0.02,
    });
    const counter = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.08, 1.05, 4, 0.012), counterMat);
    counter.position.set(0.02, -0.04, 0.08);
    counter.receiveShadow = true;
    this.group.add(counter);

    // Soft warm plaster/tile kitchen back wall (warm midtone so sunlit beams & characters pop!)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xc8b9a6,
      roughness: 0.88,
      metalness: 0.0,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), wallMat);
    backWall.position.set(0.1, 0.72, -0.78);
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // Subtle ceramic subway tiles along lower backsplash
    const tileMat = new THREE.MeshPhysicalMaterial({
      color: 0xded4c6,
      roughness: 0.26,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
    });
    const tileRows = 3;
    const tileCols = 9;
    const tileGeo = new RoundedBoxGeometry(0.195, 0.092, 0.016, 2, 0.005);
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, tileRows * tileCols);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let r = 0; r < tileRows; r++) {
      for (let c = 0; c < tileCols; c++) {
        dummy.position.set(-0.68 + c * 0.202 + (r % 2) * 0.098, 0.06 + r * 0.098, -0.768);
        dummy.updateMatrix();
        tiles.setMatrixAt(idx++, dummy.matrix);
      }
    }
    tiles.receiveShadow = true;
    this.group.add(tiles);

    // Wooden kitchen shelf in soft background with warm ceramic canister & small potted morning herb
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.024, 0.16, 2, 0.004), counterMat);
    shelf.position.set(0.42, 0.50, -0.70);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    this.group.add(shelf);

    const jarMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7f1e6,
      roughness: 0.24,
      clearcoat: 0.7,
    });
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.12, 24), jarMat);
    canister.position.set(0.32, 0.57, -0.69);
    canister.castShadow = true;
    this.group.add(canister);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.018, 24), counterMat);
    lid.position.set(0.32, 0.638, -0.69);
    this.group.add(lid);

    // Small terracotta herb pot catching morning light
    const potMat = new THREE.MeshStandardMaterial({ color: 0xb96846, roughness: 0.78 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.033, 0.075, 20), potMat);
    pot.position.set(0.50, 0.55, -0.69);
    this.group.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5c8a3e, roughness: 0.52, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), leafMat);
      leaf.scale.set(1.2, 0.32, 0.75);
      leaf.position.set(0.50 + Math.cos(a) * 0.024, 0.60 + (i % 3) * 0.012, -0.69 + Math.sin(a) * 0.024);
      leaf.rotation.set(0.3 * Math.sin(a), a, 0.35);
      this.group.add(leaf);
    }

    // Left-back sunlit morning window (source of diagonal sunlight & window mullions!)
    const winGroup = new THREE.Group();
    winGroup.position.set(-0.82, 0.54, -0.34);
    winGroup.rotation.y = Math.PI * 0.34;

    // Bright morning outdoor glow (overexposed warm sunlit trees + morning sky)
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 256;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    const sg = sctx.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, '#fff9eb');
    sg.addColorStop(0.52, '#fff2cf');
    sg.addColorStop(0.78, '#d9e5b4');
    sg.addColorStop(1.0, '#b5cc8e');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 256, 256);
    // Soft out-of-focus sunlit foliage bokeh outside window
    for (let i = 0; i < 28; i++) {
      const bx = (Math.sin(i * 17.3) * 0.5 + 0.5) * 256;
      const by = 110 + (Math.cos(i * 9.7) * 0.5 + 0.5) * 140;
      const br = 14 + (i % 5) * 8;
      const fg = sctx.createRadialGradient(bx, by, 1, bx, by, br);
      fg.addColorStop(0, i % 3 === 0 ? 'rgba(255,250,220,0.85)' : 'rgba(138,176,92,0.45)');
      fg.addColorStop(1, 'rgba(255,248,220,0)');
      sctx.fillStyle = fg;
      sctx.beginPath();
      sctx.arc(bx, by, br, 0, Math.PI * 2);
      sctx.fill();
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;

    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.96),
      new THREE.MeshBasicMaterial({ map: skyTex })
    );
    // Boost brightness slightly for HDR bloom feel without blowing out everything
    glassPane.material.color.setRGB(1.45, 1.36, 1.20);
    winGroup.add(glassPane);

    // Warm painted timber window frame & mullions (cast real window-pane shadows!)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2eadc, roughness: 0.55 });
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.98, 0.04), frameMat);
    mullionV.position.z = 0.02;
    mullionV.castShadow = true;
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.028, 0.04), frameMat);
    mullionH.position.set(0, 0.06, 0.02);
    mullionH.castShadow = true;
    const borderTop = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.055, 0.06), frameMat);
    borderTop.position.set(0, 0.49, 0.02);
    const borderBot = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.045, 0.09), frameMat);
    borderBot.position.set(0, -0.49, 0.03);
    const borderL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.98, 0.06), frameMat);
    borderL.position.set(-0.44, 0, 0.02);
    const borderR = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.98, 0.06), frameMat);
    borderR.position.set(0.44, 0, 0.02);
    winGroup.add(mullionV, mullionH, borderTop, borderBot, borderL, borderR);

    // Sheer translucent morning linen curtain softly swaying at window edge
    const curtainGeo = new THREE.PlaneGeometry(0.28, 0.96, 16, 18);
    this.curtainBasePos = curtainGeo.attributes.position.array.slice();
    const curtainMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf0,
      roughness: 0.72,
      transmission: 0.55,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    this.curtainMesh = new THREE.Mesh(curtainGeo, curtainMat);
    this.curtainMesh.position.set(0.31, -0.01, 0.065);
    winGroup.add(this.curtainMesh);

    // Real shadow-casting offscreen window mullions between sunLight (-1.55, 1.28, -1.05) and kitchen so diagonal window light & shadows fall across wall & counter!
    const goboGroup = new THREE.Group();
    goboGroup.position.set(-0.92, 0.78, -0.58);
    goboGroup.lookAt(0.05, 0.05, 0.08);
    const gBarV = new THREE.Mesh(new THREE.BoxGeometry(0.065, 1.6, 0.04), frameMat);
    gBarV.castShadow = true;
    const gBarH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.065, 0.04), frameMat);
    gBarH.position.y = 0.12;
    gBarH.castShadow = true;
    const gTopHeader = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 0.04), frameMat);
    gTopHeader.position.y = 0.56;
    gTopHeader.castShadow = true;
    const gSideWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.8, 0.04), frameMat);
    gSideWall.position.x = -0.62;
    gSideWall.castShadow = true;
    goboGroup.add(gBarV, gBarH, gTopHeader, gSideWall);
    this.group.add(goboGroup);

    this.group.add(winGroup);
  }

  _buildStoveAndSkillet() {
    // Sleek recessed brushed-stainless / dark-enamel gas cooktop on left-center of island
    const cooktopGroup = new THREE.Group();
    cooktopGroup.position.set(this.panBasePos.x, 0.002, this.panBasePos.z);

    const basePlateMat = new THREE.MeshStandardMaterial({
      color: 0x26282b,
      roughness: 0.34,
      metalness: 0.78,
    });
    const cooktopPlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.38, 0.010, 0.36, 3, 0.004),
      basePlateMat
    );
    cooktopPlate.receiveShadow = true;
    cooktopGroup.add(cooktopPlate);

    // Matte cast-iron stove grate prongs
    const grateMat = new THREE.MeshStandardMaterial({
      color: 0x1e1d1c,
      roughness: 0.68,
      metalness: 0.45,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.006, 10, 36), grateMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.011;
    cooktopGroup.add(ring);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.014, 0.009), grateMat);
      prong.position.set(Math.cos(a) * 0.095, 0.013, Math.sin(a) * 0.095);
      prong.rotation.y = -a;
      prong.castShadow = true;
      cooktopGroup.add(prong);
    }

    // Subtle gas burner cap & realistic morning blue-orange flame crown
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.012, 24), grateMat);
    cap.position.y = 0.009;
    cooktopGroup.add(cap);

    this.flameBeads = [];
    const flameGeo = new THREE.ConeGeometry(0.0045, 0.015, 6);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x4da6ff,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.set(Math.cos(a) * 0.046, 0.014, Math.sin(a) * 0.046);
      f.rotation.z = -Math.cos(a) * 0.75;
      f.rotation.x = Math.sin(a) * 0.75;
      cooktopGroup.add(f);
      this.flameBeads.push(f);
    }
    this.group.add(cooktopGroup);

    // 26cm Seasoned Cast-Iron Skillet (Lathe profile + integral handle + warm walnut grip)
    this.skilletGroup = new THREE.Group();
    this.skilletGroup.position.copy(this.panBasePos);
    this.group.add(this.skilletGroup);

    const ironTex = createCastIronTextures();
    const ironMat = new THREE.MeshStandardMaterial({
      map: ironTex.map,
      roughnessMap: ironTex.roughnessMap,
      bumpMap: ironTex.bumpMap,
      bumpScale: 0.0016,
      roughness: 0.44,
      metalness: 0.62,
    });

    // Smooth curved cast-iron skillet cross-section
    const pts = [
      new THREE.Vector2(0.000, -0.004),
      new THREE.Vector2(0.106, -0.004),
      new THREE.Vector2(0.116, 0.002),
      new THREE.Vector2(0.132, 0.036),
      new THREE.Vector2(0.134, 0.040),
      new THREE.Vector2(0.129, 0.041),
      new THREE.Vector2(0.125, 0.037),
      new THREE.Vector2(0.111, 0.005),
      new THREE.Vector2(0.098, 0.001),
      new THREE.Vector2(0.000, 0.000),
    ];
    const panBodyGeo = new THREE.LatheGeometry(pts, 56);
    // Fix planar top-down UVs on inner pan floor so oil seasoning & bump map read cleanly
    const uv = panBodyGeo.attributes.uv;
    const pos = panBodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * 3.5 + 0.5, pos.getZ(i) * 3.5 + 0.5);
    }
    const panBody = new THREE.Mesh(panBodyGeo, ironMat);
    panBody.castShadow = true;
    panBody.receiveShadow = true;
    this.skilletGroup.add(panBody);

    // Skillet handle pointing toward screen-left foreground (-X, +Z) well inside camera frame!
    this.handleAnchor = new THREE.Group();
    this.handleAnchor.rotation.y = 0.88; // brings walnut grip comfortably inside left frame for Mom's right hand!
    this.skilletGroup.add(this.handleAnchor);

    // Cast-iron neck + turned walnut wood handle with brass ferrule
    const neckGeo = new RoundedBoxGeometry(0.055, 0.011, 0.026, 2, 0.004);
    const neck = new THREE.Mesh(neckGeo, ironMat);
    neck.position.set(-0.145, 0.034, 0);
    neck.rotation.z = -0.14;
    neck.castShadow = true;
    this.handleAnchor.add(neck);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd8a85a,
      roughness: 0.26,
      metalness: 0.88,
    });
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.018, 20), brassMat);
    ferrule.rotation.z = Math.PI / 2 - 0.16;
    ferrule.position.set(-0.172, 0.039, 0);
    this.handleAnchor.add(ferrule);

    const walnutMat = new THREE.MeshStandardMaterial({
      color: 0x5c361e,
      roughness: 0.42,
      metalness: 0.05,
    });
    const woodGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0135, 0.135, 24), walnutMat);
    woodGrip.rotation.z = Math.PI / 2 - 0.16;
    woodGrip.position.set(-0.242, 0.050, 0);
    woodGrip.castShadow = true;
    this.handleAnchor.add(woodGrip);
    this.handleGripMesh = woodGrip;

    // Simmering melted butter sheen layer inside the hot skillet!
    const panButterMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7d560,
      roughness: 0.06,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.panButterSheen = new THREE.Mesh(new THREE.CircleGeometry(0.082, 40), panButterMat);
    this.panButterSheen.rotation.x = -Math.PI / 2;
    this.panButterSheen.position.y = 0.0012;
    this.skilletGroup.add(this.panButterSheen);

    // Small sizzling solid sliver of pan butter that melts at start
    this.panStarterButter = new THREE.Mesh(
      new RoundedBoxGeometry(0.022, 0.006, 0.018, 3, 0.002),
      new THREE.MeshPhysicalMaterial({ color: 0xfff0aa, roughness: 0.24, clearcoat: 0.6 })
    );
    this.panStarterButter.position.set(0.008, 0.003, -0.005);
    this.skilletGroup.add(this.panStarterButter);
  }

  _buildPlateAndProps() {
    // Soft woven oatmeal linen placemat under the plate
    const linenTex = createFabricTextures('#e6dac8', 1.4);
    const matMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.004, 0.27, 2, 0.002),
      new THREE.MeshStandardMaterial({
        map: linenTex.map,
        bumpMap: linenTex.bumpMap,
        bumpScale: 0.0018,
        roughness: 0.88,
      })
    );
    matMesh.position.set(this.platePos.x, 0.002, this.platePos.z);
    matMesh.receiveShadow = true;
    this.group.add(matMesh);

    // Warm artisanal glazed stoneware plate (23cm)
    this.plateGroup = new THREE.Group();
    this.plateGroup.position.copy(this.platePos);
    this.group.add(this.plateGroup);

    const platePts = [
      new THREE.Vector2(0.000, 0.000),
      new THREE.Vector2(0.078, 0.000),
      new THREE.Vector2(0.083, -0.002),
      new THREE.Vector2(0.088, 0.002),
      new THREE.Vector2(0.116, 0.018),
      new THREE.Vector2(0.118, 0.021),
      new THREE.Vector2(0.113, 0.022),
      new THREE.Vector2(0.084, 0.007),
      new THREE.Vector2(0.000, 0.006),
    ];
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0xe3d8c6,
      roughness: 0.20,
      metalness: 0.0,
      clearcoat: 0.88,
      clearcoatRoughness: 0.12,
    });
    const plateMesh = new THREE.Mesh(new THREE.LatheGeometry(platePts, 56), plateMat);
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    this.plateGroup.add(plateMesh);
    this.plateMesh = plateMesh;

    // Artisanal toasted stoneware potter's rim band so golden pancakes & butter pop crisply!
    const rimBand = new THREE.Mesh(
      new THREE.RingGeometry(0.106, 0.116, 56),
      new THREE.MeshBasicMaterial({ color: 0x8f6d4f, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    rimBand.rotation.x = -Math.PI / 2;
    rimBand.position.y = 0.0216;
    this.plateGroup.add(rimBand);

    // --- Wide-mouthed Stoneware Batter Pitcher (with real dynamic batter level!) ---
    this.pitcherGroup = new THREE.Group();
    this.pitcherRestPos = new THREE.Vector3(0.068, 0.010, -0.095);
    this.pitcherGroup.position.copy(this.pitcherRestPos);
    this.group.add(this.pitcherGroup);

    const pitcherPts = [
      new THREE.Vector2(0.000, 0.000),
      new THREE.Vector2(0.048, 0.000),
      new THREE.Vector2(0.058, 0.045),
      new THREE.Vector2(0.053, 0.108),
      new THREE.Vector2(0.058, 0.126),
      new THREE.Vector2(0.053, 0.128),
      new THREE.Vector2(0.048, 0.108),
      new THREE.Vector2(0.052, 0.045),
      new THREE.Vector2(0.042, 0.008),
      new THREE.Vector2(0.000, 0.008),
    ];
    const pitcherMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8cbb8,
      roughness: 0.28,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
    });
    const pitcherBody = new THREE.Mesh(new THREE.LatheGeometry(pitcherPts, 40), pitcherMat);
    // Slightly pull out pouring lip toward -X so spout clearly points into skillet!
    const pPos = pitcherBody.geometry.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      const x = pPos.getX(i);
      const y = pPos.getY(i);
      const z = pPos.getZ(i);
      if (y > 0.095 && x < -0.015) {
        const lipFactor = ((y - 0.095) / 0.033) * Math.max(0, (-x - 0.015) / 0.045);
        pPos.setX(i, x - lipFactor * 0.019);
        pPos.setY(i, y - lipFactor * 0.005);
        pPos.setZ(i, z * (1 - lipFactor * 0.35));
      }
    }
    pitcherBody.geometry.computeVertexNormals();
    pitcherBody.castShadow = true;
    pitcherBody.receiveShadow = true;
    this.pitcherGroup.add(pitcherBody);
    this.pitcherHitMesh = pitcherBody;

    // Ceramic handle on +X side of pitcher (where Mom's left hand holds it!)
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.050, 0.105, 0),
      new THREE.Vector3(0.084, 0.096, 0),
      new THREE.Vector3(0.085, 0.052, 0),
      new THREE.Vector3(0.052, 0.034, 0),
    ]);
    const pitcherHandle = new THREE.Mesh(
      new THREE.TubeGeometry(handleCurve, 20, 0.0075, 12, false),
      pitcherMat
    );
    pitcherHandle.castShadow = true;
    this.pitcherGroup.add(pitcherHandle);

    // Spout tip & outer handle grip local references for pitcher
    this.pitcherSpoutLocal = new THREE.Vector3(-0.072, 0.121, 0);
    this.pitcherHandleLocal = new THREE.Vector3(0.088, 0.072, -0.018);

    // Creamy pancake batter liquid surface inside pitcher (physically drops as you pour!)
    const batterPoolMat = new THREE.MeshPhysicalMaterial({
      color: 0xf9ebb8,
      roughness: 0.12,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    });
    this.pitcherBatterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.049, 32), batterPoolMat);
    this.pitcherBatterDisc.rotation.x = -Math.PI / 2;
    this.pitcherBatterDisc.position.y = 0.096;
    this.pitcherGroup.add(this.pitcherBatterDisc);

    // --- Porcelain Butter Dish with Cultured Butter Pat ---
    this.butterDishGroup = new THREE.Group();
    this.butterDishRestPos = new THREE.Vector3(0.205, 0.004, -0.155);
    this.butterDishGroup.position.copy(this.butterDishRestPos);
    this.group.add(this.butterDishGroup);

    const dishMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.096, 0.010, 0.074, 3, 0.004),
      plateMat
    );
    dishMesh.position.y = 0.005;
    dishMesh.castShadow = true;
    dishMesh.receiveShadow = true;
    this.butterDishGroup.add(dishMesh);

    const butterMat = new THREE.MeshPhysicalMaterial({
      color: 0xffefa6,
      roughness: 0.28,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      sheen: 0.2,
      sheenColor: 0xfffbe0,
    });
    this.dishButterBlock = new THREE.Mesh(
      new RoundedBoxGeometry(0.044, 0.020, 0.036, 3, 0.004),
      butterMat
    );
    this.dishButterBlock.position.set(-0.008, 0.019, 0);
    this.dishButterBlock.castShadow = true;
    this.butterDishGroup.add(this.dishButterBlock);

    // Ready-cut square pat on dish waiting to be dropped onto the pancake stack
    this.readyButterPat = new THREE.Mesh(
      new RoundedBoxGeometry(0.030, 0.014, 0.030, 3, 0.0035),
      butterMat
    );
    this.readyButterPat.position.set(0.024, 0.016, 0.005);
    this.readyButterPat.rotation.y = 0.24;
    this.readyButterPat.castShadow = true;
    this.butterDishGroup.add(this.readyButterPat);

    // --- Blown-Glass Maple Syrup Cruet (glowing amber in morning sun!) ---
    this.syrupCruetGroup = new THREE.Group();
    this.syrupCruetRestPos = new THREE.Vector3(0.325, 0.004, -0.125);
    this.syrupCruetGroup.position.copy(this.syrupCruetRestPos);
    this.group.add(this.syrupCruetGroup);

    const glassPts = [
      new THREE.Vector2(0.000, 0.000),
      new THREE.Vector2(0.036, 0.000),
      new THREE.Vector2(0.044, 0.034),
      new THREE.Vector2(0.026, 0.082),
      new THREE.Vector2(0.022, 0.106),
      new THREE.Vector2(0.028, 0.118),
      new THREE.Vector2(0.025, 0.120),
      new THREE.Vector2(0.019, 0.105),
      new THREE.Vector2(0.023, 0.080),
      new THREE.Vector2(0.039, 0.034),
      new THREE.Vector2(0.031, 0.006),
      new THREE.Vector2(0.000, 0.006),
    ];
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.90,
      ior: 1.51,
      thickness: 0.012,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.95,
    });
    const cruetBody = new THREE.Mesh(new THREE.LatheGeometry(glassPts, 36), glassMat);
    // Pull spout toward -X
    const gPos = cruetBody.geometry.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const x = gPos.getX(i);
      const y = gPos.getY(i);
      if (y > 0.098 && x < -0.008) {
        const f = ((y - 0.098) / 0.022) * Math.max(0, (-x - 0.008) / 0.022);
        gPos.setX(i, x - f * 0.014);
      }
    }
    cruetBody.geometry.computeVertexNormals();
    cruetBody.castShadow = true;
    this.syrupCruetGroup.add(cruetBody);
    this.syrupCruetHitMesh = cruetBody;

    const glassHandleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.023, 0.102, 0),
      new THREE.Vector3(0.052, 0.095, 0),
      new THREE.Vector3(0.054, 0.052, 0),
      new THREE.Vector3(0.038, 0.030, 0),
    ]);
    const glassHandle = new THREE.Mesh(
      new THREE.TubeGeometry(glassHandleCurve, 18, 0.0048, 10, false),
      glassMat
    );
    this.syrupCruetGroup.add(glassHandle);

    // Rich amber maple syrup liquid inside the glass cruet
    const innerSyrupPts = [
      new THREE.Vector2(0.000, 0.007),
      new THREE.Vector2(0.030, 0.007),
      new THREE.Vector2(0.038, 0.034),
      new THREE.Vector2(0.024, 0.075),
      new THREE.Vector2(0.000, 0.075),
    ];
    const innerSyrupMat = new THREE.MeshPhysicalMaterial({
      color: 0x6e2002,
      emissive: 0x2c0a00,
      emissiveIntensity: 0.42,
      roughness: 0.04,
      clearcoat: 1.0,
    });
    this.innerSyrupMesh = new THREE.Mesh(new THREE.LatheGeometry(innerSyrupPts, 32), innerSyrupMat);
    this.syrupCruetGroup.add(this.innerSyrupMesh);
    this.syrupSpoutLocal = new THREE.Vector3(-0.040, 0.118, 0);
    this.syrupHandleLocal = new THREE.Vector3(0.062, 0.068, -0.018);

    // --- Small Bowl of Glossy Red Strawberries (touchable bonus discovery!) ---
    this.berryBowlGroup = new THREE.Group();
    this.berryBowlGroup.position.set(0.365, 0.004, 0.045);
    this.group.add(this.berryBowlGroup);

    const bowlPts = [
      new THREE.Vector2(0.000, 0.000),
      new THREE.Vector2(0.032, 0.000),
      new THREE.Vector2(0.056, 0.034),
      new THREE.Vector2(0.052, 0.036),
      new THREE.Vector2(0.029, 0.006),
      new THREE.Vector2(0.000, 0.006),
    ];
    const bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 32), plateMat);
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    this.berryBowlGroup.add(bowlMesh);

    const berryTex = createStrawberryTextures();
    this.berryMat = new THREE.MeshPhysicalMaterial({
      map: berryTex.map,
      bumpMap: berryTex.bumpMap,
      bumpScale: 0.0014,
      roughness: 0.18,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
    });
    this.calyxMat = new THREE.MeshStandardMaterial({
      color: 0x3f7a26,
      roughness: 0.48,
      side: THREE.DoubleSide,
    });

    this.bowlBerries = [];
    const bOffsets = [
      [-0.015, 0.025, 0.008, 0.3, 0.2],
      [0.017, 0.026, 0.006, -0.35, -0.2],
      [0.001, 0.029, -0.015, 0.15, -0.4],
    ];
    bOffsets.forEach(([bx, by, bz, rx, rz]) => {
      const b = this.createStrawberryMesh();
      b.position.set(bx, by, bz);
      b.rotation.set(rx, Math.random() * 2, rz);
      this.berryBowlGroup.add(b);
      this.bowlBerries.push(b);
    });

    // --- Polished Stainless Dessert Fork beside the plate ---
    this.forkGroup = new THREE.Group();
    this.forkRestPos = new THREE.Vector3(0.338, 0.010, 0.165);
    this.forkGroup.position.copy(this.forkRestPos);
    this.forkGroup.rotation.y = 0.22;
    this.group.add(this.forkGroup);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xf4f6f8,
      roughness: 0.14,
      metalness: 0.94,
    });
    const forkStem = new THREE.Mesh(new RoundedBoxGeometry(0.011, 0.003, 0.125, 2, 0.0012), steelMat);
    forkStem.position.z = 0.02;
    forkStem.castShadow = true;
    this.forkGroup.add(forkStem);

    const forkHead = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.0028, 0.022, 2, 0.001), steelMat);
    forkHead.position.z = -0.048;
    this.forkGroup.add(forkHead);

    for (let t = 0; t < 4; t++) {
      const tine = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.0024, 0.032), steelMat);
      tine.position.set(-0.0081 + t * 0.0054, 0.001, -0.072);
      tine.rotation.x = 0.06;
      this.forkGroup.add(tine);
    }
  }

  createStrawberryMesh() {
    const g = new THREE.Group();
    // Conical plump berry profile
    const geo = new THREE.SphereGeometry(0.0165, 22, 18);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ny = y / 0.0165;
      // Taper gently toward bottom tip (-Y), plump shoulder near top (+Y)
      const taper = ny < 0 ? 1.0 + ny * 0.48 : 1.0 - ny * 0.15;
      pos.setXYZ(i, x * taper, y * 1.18, z * taper);
    }
    geo.computeVertexNormals();
    const berry = new THREE.Mesh(geo, this.berryMat);
    berry.castShadow = true;
    g.add(berry);

    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const sepal = new THREE.Mesh(new THREE.ConeGeometry(0.0048, 0.013, 4), this.calyxMat);
      sepal.scale.set(1.0, 1.0, 0.25);
      sepal.position.set(Math.cos(a) * 0.006, 0.019, Math.sin(a) * 0.006);
      sepal.rotation.z = -Math.PI / 2 - 0.25;
      sepal.rotation.y = -a;
      g.add(sepal);
    }
    return g;
  }

  _buildSunbeamsAndDust() {
    const { dustTex } = createAtmosphereTextures();

    // Volumetric slanted morning sunbeam shafts from upper-left window across stove & plate
    const beamShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(1.0, 0.91, 0.72) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        uniform float uTime;
        uniform vec3 uColor;
        void main() {
          // Soft horizontal bell curve + longitudinal fade from window to countertop
          float across = sin(vUv.x * 3.14159265);
          across = pow(max(0.0, across), 1.85);
          float along = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
          // Subtle mullion shadow bands inside sunbeam
          float shaftDetail = 0.78 + 0.22 * sin(vUv.x * 16.0 + uTime * 0.18);
          // Grazing fade so ribbon edges never show hard planes
          float viewFade = pow(abs(dot(vNormalW, vViewDir)), 0.75);
          float alpha = across * along * shaftDetail * viewFade * 0.048;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    this.beamUniforms = beamShaderMat.uniforms;

    // Warm diagonal morning sunbeam shafts streaming from upper-left window!
    const beamConfigs = [
      { pos: [-0.42, 0.44, -0.22], rotY: 0.25, w: 0.36, len: 1.30 },
      { pos: [-0.26, 0.40, -0.18], rotY: -0.15, w: 0.32, len: 1.25 },
    ];
    beamConfigs.forEach((cfg) => {
      const geo = new THREE.PlaneGeometry(cfg.w, cfg.len);
      const m = new THREE.Mesh(geo, beamShaderMat);
      m.position.set(...cfg.pos);
      // Align plane +Y axis with sunDir (-0.68, 0.56, -0.47)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.sunDir);
      const spin = new THREE.Quaternion().setFromAxisAngle(this.sunDir, cfg.rotY);
      m.quaternion.multiplyQuaternions(spin, q);
      m.renderOrder = 8;
      this.group.add(m);
    });

    // Airborne Dust Motes catching forward-scattered morning sunlight!
    const moteCount = 175;
    const moteGeo = new THREE.BufferGeometry();
    const mPos = new Float32Array(moteCount * 3);
    const mSeed = new Float32Array(moteCount * 3);
    const mSize = new Float32Array(moteCount);
    this.moteVel = new Float32Array(moteCount * 3);

    for (let i = 0; i < moteCount; i++) {
      mPos[i * 3] = -0.52 + Math.random() * 1.02;
      mPos[i * 3 + 1] = 0.04 + Math.random() * 0.62;
      mPos[i * 3 + 2] = -0.32 + Math.random() * 0.68;

      mSeed[i * 3] = Math.random() * 100;
      mSeed[i * 3 + 1] = Math.random() * 100;
      mSeed[i * 3 + 2] = 0.35 + Math.random() * 0.65;
      mSize[i] = 4.5 + Math.pow(Math.random(), 2.4) * 14.0;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(mSeed, 3));
    moteGeo.setAttribute('aSize', new THREE.BufferAttribute(mSize, 1));

    const moteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: dustTex },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
      },
      vertexShader: `
        attribute vec3 aSeed;
        attribute float aSize;
        varying float vBright;
        uniform float uTime;
        uniform float uPixelRatio;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          // Brighten motes dramatically when inside the slanted window sunbeam corridor!
          // Sunbeam center passes roughly through (0.02, 0.16, 0.06) along (-0.68, 0.56, -0.47)
          vec3 beamOrigin = vec3(0.02, 0.16, 0.06);
          vec3 beamDir = normalize(vec3(-0.68, 0.56, -0.47));
          vec3 rel = wp.xyz - beamOrigin;
          float perpDist = length(rel - beamDir * dot(rel, beamDir));
          float inBeam = smoothstep(0.36, 0.06, perpDist);
          float twinkle = 0.55 + 0.45 * sin(uTime * (1.8 + aSeed.z * 2.2) + aSeed.x);
          vBright = (0.08 + inBeam * 0.85) * twinkle * aSeed.z;

          vec4 mv = viewMatrix * wp;
          gl_PointSize = clamp(aSize * uPixelRatio * (0.55 / max(0.18, -mv.z)), 1.5, 22.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying float vBright;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * tex.rgb, tex.a * vBright);
        }
      `,
    });

    this.dustPoints = new THREE.Points(moteGeo, moteMat);
    this.dustPoints.renderOrder = 9;
    this.group.add(this.dustPoints);
  }

  _buildSteam() {
    const { steamTex } = createAtmosphereTextures();
    this.steamPuffs = [];
    const geo = new THREE.PlaneGeometry(0.11, 0.11);
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: steamTex,
        color: 0xfff8ee,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 7;
      this.group.add(m);
      this.steamPuffs.push({
        mesh: m,
        life: 0,
        maxLife: 1,
        vel: new THREE.Vector3(),
        spin: 0,
        baseScale: 1,
      });
    }
    this.steamTimer = 0;
  }

  spawnSteam(worldPos, strength = 1.0) {
    const p = this.steamPuffs.find((s) => s.life <= 0);
    if (!p) return;
    p.life = 0.001;
    p.maxLife = 1.4 + Math.random() * 0.9;
    p.mesh.visible = true;
    p.mesh.position.set(
      worldPos.x + (Math.random() - 0.5) * 0.055,
      worldPos.y + 0.01,
      worldPos.z + (Math.random() - 0.5) * 0.055
    );
    p.vel.set(
      (Math.random() - 0.35) * 0.025,
      0.065 + Math.random() * 0.045 * strength,
      (Math.random() - 0.5) * 0.02
    );
    p.spin = (Math.random() - 0.5) * 0.9;
    p.baseScale = (0.55 + Math.random() * 0.55) * strength;
  }

  swirlDustNear(pos, strength = 1.0) {
    const attr = this.dustPoints.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const dx = attr.getX(i) - pos.x;
      const dy = attr.getY(i) - pos.y;
      const dz = attr.getZ(i) - pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 0.28 && dist > 0.001) {
        const push = ((0.28 - dist) / 0.28) * 0.22 * strength;
        this.moteVel[i * 3] += (dx / dist) * push + (Math.random() - 0.5) * 0.06;
        this.moteVel[i * 3 + 1] += 0.08 * strength;
        this.moteVel[i * 3 + 2] += (dz / dist) * push;
      }
    }
  }

  getSkilletHandleWorldPos(target = new THREE.Vector3()) {
    this.handleGripMesh.getWorldPosition(target);
    return target;
  }

  getPitcherSpoutWorldPos(target = new THREE.Vector3()) {
    target.copy(this.pitcherSpoutLocal);
    this.pitcherGroup.localToWorld(target);
    return target;
  }

  getPitcherHandleWorldPos(target = new THREE.Vector3()) {
    target.copy(this.pitcherHandleLocal);
    this.pitcherGroup.localToWorld(target);
    return target;
  }

  getSyrupSpoutWorldPos(target = new THREE.Vector3()) {
    target.copy(this.syrupSpoutLocal);
    this.syrupCruetGroup.localToWorld(target);
    return target;
  }

  getSyrupHandleWorldPos(target = new THREE.Vector3()) {
    target.copy(this.syrupHandleLocal);
    this.syrupCruetGroup.localToWorld(target);
    return target;
  }

  update(dt, elapsed, camera, { steamSourcePos = null, steamRate = 0.5, batterRemaining = 1.0 } = {}) {
    this.beamUniforms.uTime.value = elapsed;
    this.dustPoints.material.uniforms.uTime.value = elapsed;

    // Gentle morning breeze on sheer window curtain
    const cPos = this.curtainMesh.geometry.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const bx = this.curtainBasePos[i * 3];
      const by = this.curtainBasePos[i * 3 + 1];
      const pinFactor = Math.max(0, (0.48 - by) / 0.96); // pinned at top rod
      const pleat = Math.sin(bx * 42.0) * 0.012;
      const breeze = Math.sin(elapsed * 1.15 - by * 3.2 + bx * 5.0) * 0.022 * pinFactor;
      cPos.setZ(i, pleat + breeze + pinFactor * 0.018);
    }
    cPos.needsUpdate = true;

    // Subtle living flicker on blue morning gas flame beads
    for (let i = 0; i < this.flameBeads.length; i++) {
      const f = this.flameBeads[i];
      const flick = 0.85 + 0.22 * Math.sin(elapsed * 24 + i * 2.1);
      f.scale.set(1, flick * this.flameIntensity, 1);
      f.visible = this.flameIntensity > 0.05;
    }
    this.burnerLight.intensity = (0.28 + 0.06 * Math.sin(elapsed * 19)) * this.flameIntensity;

    // Starter pan butter melts gently into oiled cast-iron sheen
    if (this.panStarterButter.visible) {
      this.panButterMelt = Math.min(1, this.panButterMelt + dt * 0.08);
      const s = Math.max(0.01, 1 - this.panButterMelt * 0.85);
      this.panStarterButter.scale.set(1 + this.panButterMelt * 0.4, s, 1 + this.panButterMelt * 0.4);
      if (s <= 0.16) this.panStarterButter.visible = false;
    }

    // Update physical batter level inside stoneware pitcher!
    if (this.pitcherBatterDisc) {
      this.pitcherBatterDisc.visible = batterRemaining > 0.02;
      const levelY = 0.018 + batterRemaining * 0.080;
      const rad = 0.043 + Math.sin(batterRemaining * Math.PI * 0.7) * 0.008;
      this.pitcherBatterDisc.position.y = levelY;
      this.pitcherBatterDisc.scale.setScalar(rad / 0.049);
    }

    // Spring-damper skillet physics return
    const springK = 52;
    const damp = 10.5;
    this.panVel.x += (-this.panOffset.x * springK - this.panVel.x * damp) * dt;
    this.panVel.y += (-this.panOffset.y * springK - this.panVel.y * damp) * dt;
    this.panVel.z += (-this.panOffset.z * springK - this.panVel.z * damp) * dt;
    this.panOffset.addScaledVector(this.panVel, dt);

    this.skilletGroup.position.copy(this.panBasePos).add(this.panOffset);
    this.panTilt.x += (0 - this.panTilt.x) * Math.min(1, dt * 10);
    this.panTilt.z += (0 - this.panTilt.z) * Math.min(1, dt * 10);
    this.skilletGroup.rotation.set(this.panTilt.x, 0, this.panTilt.z);

    // Floating dust motes lazy convection + swirl damping
    const dAttr = this.dustPoints.geometry.attributes.position;
    const sAttr = this.dustPoints.geometry.attributes.aSeed;
    for (let i = 0; i < dAttr.count; i++) {
      let x = dAttr.getX(i);
      let y = dAttr.getY(i);
      let z = dAttr.getZ(i);
      const sx = sAttr.getX(i);
      const sy = sAttr.getY(i);

      const vx = Math.sin(elapsed * 0.45 + sx) * 0.011 + this.moteVel[i * 3];
      const vy = 0.007 + Math.cos(elapsed * 0.38 + sy) * 0.006 + this.moteVel[i * 3 + 1];
      const vz = Math.cos(elapsed * 0.41 + sx * 0.7) * 0.009 + this.moteVel[i * 3 + 2];

      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      this.moteVel[i * 3] *= Math.max(0, 1 - dt * 2.5);
      this.moteVel[i * 3 + 1] *= Math.max(0, 1 - dt * 2.5);
      this.moteVel[i * 3 + 2] *= Math.max(0, 1 - dt * 2.5);

      if (y > 0.68) y = 0.04;
      if (x > 0.52) x = -0.52;
      if (x < -0.52) x = 0.52;
      if (z > 0.38) z = -0.32;
      if (z < -0.32) z = 0.38;

      dAttr.setXYZ(i, x, y, z);
    }
    dAttr.needsUpdate = true;

    // Steam emission & billboard update
    if (steamSourcePos && steamRate > 0.02) {
      this.steamTimer += dt * steamRate * 5.5;
      while (this.steamTimer >= 1) {
        this.steamTimer -= 1;
        this.spawnSteam(steamSourcePos, 0.8 + steamRate * 0.5);
      }
    }

    for (const p of this.steamPuffs) {
      if (p.life <= 0) continue;
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.life = 0;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.x += Math.sin(elapsed * 2.2 + p.spin * 5) * 0.012 * dt;
      const sc = p.baseScale * (0.55 + t * 1.45);
      p.mesh.scale.setScalar(sc);
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.rotateZ(p.life * p.spin);
      const fade = Math.sin(t * Math.PI);
      p.mesh.material.opacity = fade * 0.14;
    }
  }
}
