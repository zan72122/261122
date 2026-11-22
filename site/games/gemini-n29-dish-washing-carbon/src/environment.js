// Photorealistic Kitchen Studio HDRI, Brushed Stainless Sink, Dynamic Water Basin,
// Chrome Gooseneck Faucet (Stream + Shower), Translucent Soap Pumps & Drying Rack.

import * as THREE from 'three';

/**
 * Generates a realistic sunlit kitchen studio environment map via PMREMGenerator
 * so chrome, stainless steel, wet porcelain, glass, water & soap bubbles have lifelike reflections.
 */
export function buildKitchenEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xd8cfc4);

  // Warm wood floor / lower bounce hemisphere
  const floorGeo = new THREE.SphereGeometry(20, 24, 16);
  const floorMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      void main() {
        vec3 n = normalize(vWorldPos);
        vec3 ceiling = vec3(1.25, 1.22, 1.16);
        vec3 horizon = vec3(0.82, 0.76, 0.68);
        vec3 counter = vec3(0.42, 0.30, 0.20);
        vec3 col = n.y > 0.0
          ? mix(horizon, ceiling, pow(n.y, 0.6))
          : mix(horizon, counter, pow(-n.y, 0.55));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(floorGeo, floorMat));

  // Bright sunlit kitchen window panel (creates crisp realistic specular window panes on plates & bubbles!)
  const winGroup = new THREE.Group();
  winGroup.position.set(-8, 6.5, 6);
  winGroup.lookAt(0, 0, 0);
  const paneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.8, 4.5, 4.0) });
  for (let gx = -1; gx <= 1; gx += 2) {
    for (let gy = -1; gy <= 1; gy += 2) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.4), paneMat);
      pane.position.set(gx * 1.75, gy * 1.9, 0);
      winGroup.add(pane);
    }
  }
  envScene.add(winGroup);

  // Warm overhead kitchen pendant softbox
  const pendant = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 2.9, 2.1) })
  );
  pendant.position.set(3.5, 11, 3.5);
  envScene.add(pendant);

  // Cool sky fill panel on right for realistic chrome contrast
  const skyFill = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.3), side: THREE.DoubleSide })
  );
  skyFill.position.set(10, 4.5, 2);
  skyFill.lookAt(0, 0, 0);
  envScene.add(skyFill);

  // Dark cabinet contrast strips so stainless steel gets crisp realistic dark-light banding
  const darkBand = new THREE.Mesh(
    new THREE.BoxGeometry(16, 2.2, 0.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.14, 0.12, 0.11) })
  );
  darkBand.position.set(0, 1.5, -12);
  envScene.add(darkBand);

  const envRT = pmrem.fromScene(envScene, 0.025);
  pmrem.dispose();
  floorGeo.dispose();
  floorMat.dispose();
  return envRT.texture;
}

export class KitchenWorld {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.isPortrait = false;

    // Interactive state
    this.faucetOn = false;
    this.showerMode = false;
    this.faucetFlow = 0; // smoothed 0..1
    this.drainPlugged = false;
    this.waterLevel = 0; // 0..1 inside sink basin
    this.whirlpoolSpin = 0;
    this.overflowRipple = 0;
    this.berrySoapUnlocked = false;
    this.partyMode = false;
    this.partyProgress = 0;

    // Wobble feedback timers for gentle non-active affordance bounce
    this.rackWobble = 0;
    this.citrusPumpAnim = 0;
    this.berryPumpAnim = 0;
    this.faucetWobble = 0;

    this._buildMaterials();
    this._buildKitchenBackdrop();
    this._buildCounterAndSink();
    this._buildDrainAndWater();
    this._buildFaucet();
    this._buildSoapBottles();
    this._buildSponge();
    this._buildDryingRack();
    this._buildPartyPlacemat();
  }

  _buildMaterials() {
    const t = this.textures;
    this.steelMat = new THREE.MeshPhysicalMaterial({
      color: 0xdce2e8,
      map: t.steelMap,
      roughnessMap: t.steelRoughMap,
      metalness: 0.92,
      roughness: 0.22,
      clearcoat: 0.25,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.45,
    });

    this.sinkInnerWallMat = new THREE.MeshPhysicalMaterial({
      color: 0xc2cbd4,
      map: t.steelMap,
      roughnessMap: t.steelRoughMap,
      metalness: 0.93,
      roughness: 0.24,
      envMapIntensity: 1.35,
    });

    this.chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7faff,
      metalness: 0.98,
      roughness: 0.05,
      clearcoat: 0.5,
      envMapIntensity: 1.75,
    });

    this.woodMat = new THREE.MeshPhysicalMaterial({
      color: 0xd7a372,
      map: t.woodMap,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.32,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.75,
    });

    this.tileMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: t.tileMap,
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
      envMapIntensity: 0.95,
    });
  }

  _buildKitchenBackdrop() {
    const bg = new THREE.Group();
    this.root.add(bg);

    // Warm sunlit dining/kitchen back wall behind the open counter
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 7.5),
      new THREE.MeshStandardMaterial({ color: 0xece0cf, roughness: 0.86 })
    );
    backWall.position.set(0, 2.2, -4.2);
    bg.add(backWall);

    // Subtle ceramic tile Wainscot / Backsplash on the far kitchen wall too for architectural realism!
    const farTile = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.8), this.tileMat);
    farTile.position.set(0, 2.2, -4.16);
    bg.add(farTile);

    // Sunlit Kitchen Window on back-left (framed in warm oak wood + outdoor garden foliage + sky!)
    const winFrame = new THREE.Group();
    winFrame.position.set(-1.62, 2.95, -4.08);
    bg.add(winFrame);

    const skyPane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 1.85),
      new THREE.MeshBasicMaterial({ color: 0xdff2ff })
    );
    winFrame.add(skyPane);

    // Warm sunlit garden trees outside window
    const foliageColors = [0x7ec868, 0x9bd97c, 0x62b252, 0xb6e693];
    for (let i = 0; i < 5; i++) {
      const bush = new THREE.Mesh(
        new THREE.CircleGeometry(0.42 + (i % 2) * 0.12, 18),
        new THREE.MeshBasicMaterial({ color: foliageColors[i % foliageColors.length] })
      );
      bush.position.set(-0.78 + i * 0.40, -0.45 + (i % 2) * 0.18, 0.01);
      winFrame.add(bush);
    }

    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf7f2ea, roughness: 0.42 });
    const outerBars = [
      [0, 0.94, 2.32, 0.11],
      [0, -0.94, 2.38, 0.14],
      [-1.10, 0, 0.11, 1.98],
      [1.10, 0, 0.11, 1.98],
      [0, 0.04, 2.18, 0.06],
      [0, 0, 0.06, 1.88],
    ];
    outerBars.forEach(([bx, by, bw, bh]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.09), trimMat);
      m.position.set(bx, by, 0.04);
      winFrame.add(m);
    });

    // Warm Wooden Open Kitchen Shelf visible in upper-right behind Helper Girl!
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(1.72, 2.68, -3.88);
    bg.add(shelfGroup);

    const shelfPlank = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.38), this.woodMat);
    shelfGroup.add(shelfPlank);

    // Stacked white porcelain plates & copper kettle on background shelf
    const canisterMat = new THREE.MeshPhysicalMaterial({ color: 0xf8f4ec, roughness: 0.14, clearcoat: 0.85 });
    for (let p = 0; p < 3; p++) {
      const stPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.035, 20), canisterMat);
      stPlate.position.set(-0.56, 0.06 + p * 0.04, 0);
      shelfGroup.add(stPlate);
    }

    // Warm copper tea kettle on shelf
    const copperMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97b48,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 0.4,
    });
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), copperMat);
    kettle.scale.y = 0.82;
    kettle.position.set(-0.04, 0.17, 0);
    shelfGroup.add(kettle);
    const kettleLid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.04, 14), copperMat);
    kettleLid.position.set(-0.04, 0.31, 0);
    shelfGroup.add(kettleLid);

    // Small terracotta herb pot with fresh green basil leaves
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.10, 0.25, 18),
      new THREE.MeshStandardMaterial({ color: 0xc96f4b, roughness: 0.72 })
    );
    pot.position.set(0.52, 0.17, 0);
    shelfGroup.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x46a049, roughness: 0.40 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), leafMat);
      leaf.scale.set(1.2, 0.55, 0.85);
      leaf.position.set(0.52 + Math.cos(a) * 0.09, 0.34 + (i % 2) * 0.05, Math.sin(a) * 0.08);
      shelfGroup.add(leaf);
    }

    // Open-counter low subway-tile riser behind faucet deck
    const riser = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.34, 0.22), this.tileMat);
    riser.position.set(0, 0.14, -1.26);
    riser.receiveShadow = true;
    this.root.add(riser);

    const sillCap = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.06, 0.30), this.woodMat);
    sillCap.position.set(0, 0.33, -1.26);
    sillCap.receiveShadow = true;
    this.root.add(sillCap);
  }

  _buildCounterAndSink() {
    const sinkGroup = new THREE.Group();
    this.root.add(sinkGroup);
    this.sinkGroup = sinkGroup;

    // Sink interior bounds: x in [-1.50, +1.30] (width 2.80), z in [-0.78, +1.18] (depth 1.96), floor y = -0.78
    this.basinBounds = {
      minX: -1.50,
      maxX: 1.30,
      minZ: -0.78,
      maxZ: 1.18,
      floorY: -0.78,
    };

    // Surrounding wooden countertop slabs — carefully flush OUTSIDE stainless walls (zero overlap!)
    const counterDepth = 2.96;
    // Left counter deck: right face at -1.52 (outside minX = -1.50)
    const leftDeck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, counterDepth), this.woodMat);
    leftDeck.position.set(-2.82, -0.475, 0.20);
    leftDeck.receiveShadow = true;
    sinkGroup.add(leftDeck);

    // Right counter deck: left face at +1.32 (outside maxX = +1.30)
    const rightDeck = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.95, counterDepth), this.woodMat);
    rightDeck.position.set(2.67, -0.475, 0.20);
    rightDeck.receiveShadow = true;
    sinkGroup.add(rightDeck);

    // Back counter strip (faucet deck): front face at -0.80 (behind minZ = -0.78 so inner sink wall is 100% stainless!)
    const backDeck = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.95, 0.56), this.woodMat);
    backDeck.position.set(-0.10, -0.475, -1.08);
    backDeck.receiveShadow = true;
    sinkGroup.add(backDeck);

    // Front counter apron: back face at +1.20 (in front of maxZ = +1.18!)
    const frontDeck = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.95, 0.52), this.woodMat);
    frontDeck.position.set(-0.10, -0.475, 1.46);
    frontDeck.receiveShadow = true;
    sinkGroup.add(frontDeck);

    // Brushed Stainless Steel Sink Rim Flange
    const rimThickness = 0.095;
    const rimY = 0.012;
    const rimBars = [
      [-0.10, rimY, -0.81, 3.00, 0.032, rimThickness],
      [-0.10, rimY, 1.21, 3.00, 0.032, rimThickness],
      [-1.535, rimY, 0.20, rimThickness, 0.032, 2.11],
      [1.335, rimY, 0.20, rimThickness, 0.032, 2.11],
    ];
    rimBars.forEach(([x, y, z, w, h, d]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.steelMat);
      bar.position.set(x, y, z);
      bar.receiveShadow = true;
      sinkGroup.add(bar);
    });

    // Stainless Steel Basin Walls & Sloped Floor
    const b = this.basinBounds;
    const wX = b.maxX - b.minX;
    const wZ = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    const wallH = -b.floorY;

    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(wX + 0.04, wZ + 0.04), this.steelMat);
    floorMesh.rotation.x = -Math.PI * 0.5;
    floorMesh.position.set(cx, b.floorY, cz);
    floorMesh.receiveShadow = true;
    sinkGroup.add(floorMesh);

    const wallSpecs = [
      [cx, b.floorY + wallH * 0.5, b.minZ, 0, wX + 0.04, wallH],
      [cx, b.floorY + wallH * 0.5, b.maxZ, Math.PI, wX + 0.04, wallH],
      [b.minX, b.floorY + wallH * 0.5, cz, Math.PI * 0.5, wZ + 0.04, wallH],
      [b.maxX, b.floorY + wallH * 0.5, cz, -Math.PI * 0.5, wZ + 0.04, wallH],
    ];
    wallSpecs.forEach(([x, y, z, ry, pw, ph]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), this.sinkInnerWallMat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      sinkGroup.add(m);
    });
  }

  _buildDrainAndWater() {
    const b = this.basinBounds;
    const drainX = -0.96;
    const drainZ = -0.34;
    this.drainPos = new THREE.Vector3(drainX, b.floorY + 0.01, drainZ);

    // Perforated Stainless Drain Strainer Ring
    const drainRing = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.21, 24),
      this.chromeMat
    );
    drainRing.rotation.x = -Math.PI * 0.5;
    drainRing.position.copy(this.drainPos);
    this.root.add(drainRing);

    const drainHole = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 20),
      new THREE.MeshBasicMaterial({ color: 0x171a1d })
    );
    drainHole.rotation.x = -Math.PI * 0.5;
    drainHole.position.set(drainX, b.floorY + 0.006, drainZ);
    this.root.add(drainHole);

    // Interactive Rubber Drain Stopper (with brass pull-ring & beaded chain!)
    // Tapping this plugs the sink so water fills to the brim & makes a giant bubble bath!
    this.stopperGroup = new THREE.Group();
    this.root.add(this.stopperGroup);

    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x2c353d,
      roughness: 0.42,
      metalness: 0.08,
    });
    const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.125, 0.055, 24), rubberMat);
    this.stopperGroup.add(plugBody);

    const pullRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.014, 10, 20),
      this.chromeMat
    );
    pullRing.position.y = 0.065;
    this.stopperGroup.add(pullRing);

    //Invisible generous hit sphere for easy 1-finger tapping on the drain stopper!
    this.stopperHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.stopperGroup.add(this.stopperHit);
    this.stopperGroup.position.set(drainX - 0.24, b.floorY + 0.05, drainZ - 0.16);
    this.stopperGroup.rotation.z = 0.35;

    // Beaded metal chain from back sink wall to stopper
    this.chainPoints = [];
    this.chainBeads = [];
    for (let i = 0; i < 9; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), this.chromeMat);
      this.root.add(bead);
      this.chainBeads.push(bead);
    }

    // Dynamic Undulating Sink Water Surface
    const wX = b.maxX - b.minX - 0.02;
    const wZ = b.maxZ - b.minZ - 0.02;
    this.waterGeo = new THREE.PlaneGeometry(wX, wZ, 28, 22);
    this.waterGeo.rotateX(-Math.PI * 0.5);
    this.waterBasePos = Float32Array.from(this.waterGeo.attributes.position.array);

    this.waterSurfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8f4ff,
      transparent: true,
      opacity: 0.52,
      roughness: 0.05,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      bumpMap: this.textures.waterBumpMap,
      bumpScale: 0.02,
      envMapIntensity: 1.85,
    });

    this.sinkWaterMesh = new THREE.Mesh(this.waterGeo, this.waterSurfaceMat);
    this.sinkWaterMesh.position.set((b.minX + b.maxX) * 0.5, b.floorY + 0.02, (b.minZ + b.maxZ) * 0.5);
    this.sinkWaterMesh.visible = false;
    this.root.add(this.sinkWaterMesh);
  }

  _buildFaucet() {
    this.faucetGroup = new THREE.Group();
    // Placed slightly left-of-center so center-right view of Helper Girl is 100% open!
    this.faucetGroup.position.set(-0.68, 0.0, -0.98);
    this.root.add(this.faucetGroup);

    // Deck escutcheon & cylindrical body
    const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 24), this.chromeMat);
    baseCollar.position.y = 0.03;
    this.faucetGroup.add(baseCollar);

    const riserBody = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.42, 24), this.chromeMat);
    riserBody.position.y = 0.24;
    riserBody.castShadow = true;
    this.faucetGroup.add(riserBody);

    // Graceful Curved Gooseneck Spout arching to (-0.10, 0.90, 0.16) in world space
    // Relative to faucet base (-0.68, 0, -0.98), target spout tip is (+0.58, 0.90, +1.14)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.42, 0),
      new THREE.Vector3(0.08, 1.02, 0.16),
      new THREE.Vector3(0.34, 1.24, 0.68),
      new THREE.Vector3(0.56, 1.04, 1.08),
      new THREE.Vector3(0.58, 0.86, 1.14),
    ]);
    const neckGeo = new THREE.TubeGeometry(curve, 32, 0.058, 16, false);
    const neckMesh = new THREE.Mesh(neckGeo, this.chromeMat);
    neckMesh.castShadow = true;
    this.faucetGroup.add(neckMesh);

    // Pull-down Spray Head / Aerator Collar (with tactile blue/aqua ring signifying Stream ⇄ Shower!)
    this.spoutHead = new THREE.Group();
    this.spoutHead.position.set(0.58, 0.83, 1.14);
    this.faucetGroup.add(this.spoutHead);

    const headBell = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.088, 0.14, 20), this.chromeMat);
    this.spoutHead.add(headBell);

    this.modeRingMat = new THREE.MeshStandardMaterial({
      color: 0x36b5ff,
      roughness: 0.25,
      emissive: 0x0a3854,
    });
    const modeRing = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.014, 10, 24), this.modeRingMat);
    modeRing.rotation.x = Math.PI * 0.5;
    modeRing.position.y = -0.02;
    this.spoutHead.add(modeRing);

    // Generous hit target on spout head to toggle Stream <-> Shower (or turn water on!)
    this.spoutHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.spoutHead.add(this.spoutHit);

    // Ergonomic Single-Lever Handle on left side of faucet body
    this.leverPivot = new THREE.Group();
    this.leverPivot.position.set(-0.11, 0.34, 0.04);
    this.faucetGroup.add(this.leverPivot);

    const leverCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 16), this.chromeMat);
    leverCap.rotation.z = Math.PI * 0.5;
    this.leverPivot.add(leverCap);

    const leverStick = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.24, 8, 12), this.chromeMat);
    leverStick.position.set(-0.06, 0.14, 0.05);
    leverStick.rotation.z = 0.25;
    leverStick.rotation.x = 0.25;
    this.leverPivot.add(leverStick);

    // Generous hit box covering lever + faucet body so any tap/pull easily toggles water!
    this.faucetHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.85, 0.65),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.faucetHit.position.set(-0.08, 0.42, 0.12);
    this.faucetGroup.add(this.faucetHit);

    // World position of water origin
    this.spoutWorldPos = new THREE.Vector3(-0.10, 0.76, 0.16);

    // Realistic 3D Flowing Water Stream Column + Shower Cone
    this.waterStreamMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f8ff,
      transparent: true,
      opacity: 0.64,
      roughness: 0.04,
      metalness: 0.05,
      clearcoat: 1.0,
      bumpMap: this.textures.waterBumpMap,
      bumpScale: 0.03,
      envMapIntensity: 2.0,
      depthWrite: false,
    });

    const colGeo = new THREE.CylinderGeometry(0.048, 0.078, 1.0, 18, 8, true);
    colGeo.translate(0, -0.5, 0);
    this.waterColumnMesh = new THREE.Mesh(colGeo, this.waterStreamMat);
    this.waterColumnMesh.position.copy(this.spoutWorldPos);
    this.waterColumnMesh.visible = false;
    this.root.add(this.waterColumnMesh);

    // Shower Spray Cone (12 shimmering water jets fanning outward!)
    this.showerGroup = new THREE.Group();
    this.showerGroup.position.copy(this.spoutWorldPos);
    this.showerGroup.visible = false;
    this.root.add(this.showerGroup);

    const jetGeo = new THREE.CylinderGeometry(0.008, 0.016, 1.05, 8, 1, true);
    jetGeo.translate(0, -0.525, 0);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const ringR = i % 2 === 0 ? 0.22 : 0.13;
      const jet = new THREE.Mesh(jetGeo, this.waterStreamMat);
      jet.rotation.z = Math.cos(angle) * ringR;
      jet.rotation.x = Math.sin(angle) * ringR;
      this.showerGroup.add(jet);
    }
  }

  _createSoapBottle(liquidHex, labelTex) {
    const group = new THREE.Group();

    // Inner vibrant translucent dish soap liquid
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: liquidHex,
      roughness: 0.12,
      metalness: 0.0,
      transparent: true,
      opacity: 0.86,
      clearcoat: 0.6,
      emissive: liquidHex,
      emissiveIntensity: 0.12,
    });
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.195, 0.48, 22), liquidMat);
    liquid.position.y = 0.26;
    group.add(liquid);

    // Outer clear PET glossy bottle shell
    const bottleShellMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      roughness: 0.05,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.8,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.56, 24), bottleShellMat);
    body.position.y = 0.29;
    body.castShadow = true;
    group.add(body);

    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
      bottleShellMat
    );
    shoulder.position.y = 0.56;
    shoulder.scale.y = 0.55;
    group.add(shoulder);

    // Waterproof pictorial fruit label wrapped on front
    const labelGeo = new THREE.CylinderGeometry(0.209, 0.217, 0.38, 24, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
    const labelMat = new THREE.MeshStandardMaterial({
      map: labelTex,
      transparent: true,
      roughness: 0.22,
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = 0.29;
    group.add(label);

    // White ribbed collar + spring pump head + angled dispenser nozzle
    const whitePlastic = new THREE.MeshPhysicalMaterial({
      color: 0xfcfcfc,
      roughness: 0.18,
      clearcoat: 0.5,
    });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.10, 18), whitePlastic);
    collar.position.y = 0.69;
    group.add(collar);

    const pumpHead = new THREE.Group();
    pumpHead.position.y = 0.84;
    group.add(pumpHead);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.14, 12), whitePlastic);
    stem.position.y = -0.06;
    pumpHead.add(stem);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.075, 20), whitePlastic);
    pumpHead.add(topCap);

    // Nozzle pointing toward sink/sponge!
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.035, 0.22, 12), whitePlastic);
    nozzle.rotation.z = -Math.PI * 0.42;
    nozzle.rotation.y = -0.45;
    nozzle.position.set(0.13, 0.0, 0.07);
    pumpHead.add(nozzle);

    const nozzleTip = new THREE.Object3D();
    nozzleTip.position.set(0.23, -0.03, 0.12);
    pumpHead.add(nozzleTip);

    // Generous hit box for 1-finger tap
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.02, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.48;
    group.add(hit);

    return { group, pumpHead, nozzleTip, hit, liquid };
  }

  _buildSoapBottles() {
    this.citrusSoap = this._createSoapBottle(0xffb41f, this.textures.citrusLabel);
    this.citrusSoap.group.position.set(-1.98, 0.0, -0.32);
    this.root.add(this.citrusSoap.group);

    this.berrySoap = this._createSoapBottle(0xf54784, this.textures.berryLabel);
    this.berrySoap.group.position.set(-2.36, 0.0, 0.18);
    this.berrySoap.group.scale.setScalar(0.001);
    this.berrySoap.group.visible = false;
    this.root.add(this.berrySoap.group);
  }

  _buildSponge() {
    // Large, tactile Two-Layer Kitchen Sponge (Yellow Porous Cellulose + Green Scour Pad)
    this.spongeGroup = new THREE.Group();
    this.root.add(this.spongeGroup);

    this.spongeHome = new THREE.Vector3(-1.94, 0.13, 0.72);
    this.spongeGroup.position.copy(this.spongeHome);

    // Subtle ceramic soap/sponge dish tray at home spot
    this.spongeTray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.31, 0.05, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xf7f4ee, roughness: 0.15, clearcoat: 0.8 })
    );
    this.spongeTray.scale.set(1.15, 1, 0.88);
    this.spongeTray.position.set(-1.94, 0.025, 0.72);
    this.spongeTray.receiveShadow = true;
    this.root.add(this.spongeTray);

    this.spongeBody = new THREE.Group();
    this.spongeGroup.add(this.spongeBody);

    // Rounded bevel sponge geometry (0.52 x 0.19 x 0.36 — large & unmistakable!)
    this.spongeYellowMat = new THREE.MeshStandardMaterial({
      color: 0xffd642,
      map: this.textures.spongeMap,
      bumpMap: this.textures.spongeBumpMap,
      bumpScale: 0.028,
      roughness: 0.82,
      metalness: 0.0,
    });

    const yellowGeo = this._createRoundedBlockGeometry(0.54, 0.16, 0.37, 0.045);
    const yellowMesh = new THREE.Mesh(yellowGeo, this.spongeYellowMat);
    yellowMesh.position.y = 0.04;
    yellowMesh.castShadow = true;
    yellowMesh.receiveShadow = true;
    this.spongeBody.add(yellowMesh);

    const scourMat = new THREE.MeshStandardMaterial({
      color: 0x22703e,
      map: this.textures.scourMap,
      bumpMap: this.textures.scourMap,
      bumpScale: 0.02,
      roughness: 0.92,
    });
    const greenGeo = this._createRoundedBlockGeometry(0.53, 0.06, 0.36, 0.02);
    const greenMesh = new THREE.Mesh(greenGeo, scourMat);
    greenMesh.position.y = -0.055;
    greenMesh.castShadow = true;
    this.spongeBody.add(greenMesh);

    // Glossy translucent soap gel blob sitting on top of sponge when freshly pumped!
    this.soapGelMat = new THREE.MeshPhysicalMaterial({
      color: 0xffb824,
      transparent: true,
      opacity: 0.88,
      roughness: 0.06,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    });
    this.soapGelMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), this.soapGelMat);
    this.soapGelMesh.scale.set(1.25, 0.52, 1.05);
    this.soapGelMesh.position.set(0, 0.13, 0);
    this.soapGelMesh.visible = false;
    this.spongeBody.add(this.soapGelMesh);

    // Generous touch target around sponge
    this.spongeHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.spongeGroup.add(this.spongeHit);
  }

  _createRoundedBlockGeometry(w, h, d, radius) {
    const shape = new THREE.Shape();
    const hw = w * 0.5 - radius;
    const hd = d * 0.5 - radius;
    shape.moveTo(-hw, -hd - radius);
    shape.lineTo(hw, -hd - radius);
    shape.quadraticCurveTo(hw + radius, -hd - radius, hw + radius, -hd);
    shape.lineTo(hw + radius, hd);
    shape.quadraticCurveTo(hw + radius, hd + radius, hw, hd + radius);
    shape.lineTo(-hw, hd + radius);
    shape.quadraticCurveTo(-hw - radius, hd + radius, -hw - radius, hd);
    shape.lineTo(-hw - radius, -hd);
    shape.quadraticCurveTo(-hw - radius, -hd - radius, -hw, -hd - radius);

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, h - radius * 1.2),
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: radius * 0.65,
      bevelThickness: radius * 0.6,
    });
    extrude.rotateX(Math.PI * 0.5);
    extrude.center();
    return extrude;
  }

  _buildDryingRack() {
    // Stainless Steel & Wood Dish Drying Rack on the right side of the sink!
    this.rackGroup = new THREE.Group();
    this.rackHome = new THREE.Vector3(1.98, 0.02, 0.18);
    this.rackGroup.position.copy(this.rackHome);
    this.rackGroup.rotation.y = -0.10;
    this.root.add(this.rackGroup);

    // Angled Stainless Drainboard Tray underneath rack
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.035, 1.62), this.steelMat);
    tray.position.set(-0.04, 0.02, 0);
    tray.rotation.z = 0.045; // slopes gently toward sink basin!
    tray.receiveShadow = true;
    this.rackGroup.add(tray);

    // Side wooden accent handles
    [-0.56, 0.52].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.56, 12), this.woodMat);
      rail.rotation.x = Math.PI * 0.5;
      rail.position.set(rx, 0.28, 0);
      rail.castShadow = true;
      this.rackGroup.add(rail);

      // Corner legs
      [-0.74, 0.74].forEach((rz) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 10), this.chromeMat);
        post.position.set(rx, 0.14, rz);
        this.rackGroup.add(post);
      });
    });

    // Front & back wire crossbars
    [-0.74, 0.74].forEach((rz) => {
      const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.08, 10), this.chromeMat);
      cross.rotation.z = Math.PI * 0.5;
      cross.position.set(-0.02, 0.26, rz);
      this.rackGroup.add(cross);
    });

    // 5 Arched Stainless Dish Divider Ribs creating 4 clear upright Dish Slots!
    const slotZs = [-0.56, -0.20, 0.16, 0.52];
    const ribZs = [-0.72, -0.38, -0.02, 0.34, 0.70];
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.48, 0.05, 0),
      new THREE.Vector3(-0.32, 0.34, 0),
      new THREE.Vector3(0.0, 0.38, 0),
      new THREE.Vector3(0.30, 0.34, 0),
      new THREE.Vector3(0.46, 0.05, 0),
    ]);
    const ribGeo = new THREE.TubeGeometry(archCurve, 18, 0.014, 8, false);
    ribZs.forEach((rz) => {
      const rib = new THREE.Mesh(ribGeo, this.chromeMat);
      rib.position.z = rz;
      rib.castShadow = true;
      this.rackGroup.add(rib);
    });

    // Slot anchor nodes for racked dishes
    this.rackSlots = slotZs.map((sz) => {
      const node = new THREE.Object3D();
      node.position.set(-0.02, 0.36, sz);
      this.rackGroup.add(node);
      return node;
    });

    // Generous hit box for dropping/tapping dishes into rack
    this.rackHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.85, 1.78),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.rackHit.position.set(0, 0.38, 0);
    this.rackGroup.add(this.rackHit);
  }

  _buildPartyPlacemat() {
    // Unfurls smoothly across the sink during the Grand Reward Strawberry Cake Party!
    this.partyBoard = new THREE.Group();
    this.partyBoard.position.set(-0.08, 0.05, 0.24);
    this.partyBoard.scale.set(0.001, 1, 0.001);
    this.partyBoard.visible = false;
    this.root.add(this.partyBoard);

    // Warm wooden sink bridge board
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.06, 1.82), this.woodMat);
    board.receiveShadow = true;
    board.castShadow = true;
    this.partyBoard.add(board);

    // Cute pink-and-white gingham linen cloth on top
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.018, 1.48),
      new THREE.MeshStandardMaterial({
        map: this.textures.ginghamMap,
        roughness: 0.78,
      })
    );
    cloth.position.y = 0.038;
    cloth.receiveShadow = true;
    this.partyBoard.add(cloth);
  }

  adaptLayout(aspect) {
    const portrait = aspect < 0.86;
    this.isPortrait = portrait;

    if (portrait) {
      // Compact horizontal span so everything stays HUGE and thumb-friendly on iPhone Portrait!
      this.citrusSoap.group.position.set(-1.34, 0.0, -0.96);
      this.berrySoap.group.position.set(-1.74, 0.0, -0.82);
      this.spongeHome.set(-1.26, 0.13, 1.34);
      this.spongeTray.position.set(-1.26, 0.025, 1.34);

      this.rackHome.set(1.36, 0.02, -0.35);
      this.rackGroup.scale.setScalar(0.84);
      this.rackGroup.rotation.y = -0.22;
    } else {
      // Spacious classic kitchen counter layout for iPad Landscape & 4:3!
      this.citrusSoap.group.position.set(-1.98, 0.0, -0.32);
      this.berrySoap.group.position.set(-2.34, 0.0, 0.22);
      this.spongeHome.set(-1.94, 0.13, 0.72);
      this.spongeTray.position.set(-1.94, 0.025, 0.72);

      this.rackHome.set(1.98, 0.02, 0.18);
      this.rackGroup.scale.setScalar(1.0);
      this.rackGroup.rotation.y = -0.10;
    }
    this.rackGroup.position.copy(this.rackHome);
  }

  unlockBerrySoap() {
    if (this.berrySoapUnlocked) return;
    this.berrySoapUnlocked = true;
    this.berrySoap.group.visible = true;
  }

  getRackSlotWorldPos(index, out = new THREE.Vector3()) {
    const slot = this.rackSlots[index % this.rackSlots.length];
    return slot.getWorldPosition(out);
  }

  update(dt, elapsed, dishImpactY = -0.36) {
    // 1. Unlock berry soap spring-in
    if (this.berrySoapUnlocked && this.berrySoap.group.scale.x < 0.999) {
      const s = THREE.MathUtils.lerp(this.berrySoap.group.scale.x, 1.0, Math.min(1, dt * 8));
      this.berrySoap.group.scale.setScalar(s);
    }

    // 2. Party placemat board transition
    const targetParty = this.partyMode ? 1 : 0;
    this.partyProgress = THREE.MathUtils.lerp(this.partyProgress, targetParty, Math.min(1, dt * 6.5));
    if (this.partyProgress > 0.01) {
      this.partyBoard.visible = true;
      const ease = this.partyProgress;
      this.partyBoard.scale.set(Math.max(0.001, ease), 1, Math.max(0.001, ease));
    } else {
      this.partyBoard.visible = false;
    }

    // 3. Pump animations
    if (this.citrusPumpAnim > 0) {
      this.citrusPumpAnim = Math.max(0, this.citrusPumpAnim - dt * 4.5);
      this.citrusSoap.pumpHead.position.y = 0.84 - Math.sin(this.citrusPumpAnim * Math.PI) * 0.09;
    }
    if (this.berryPumpAnim > 0) {
      this.berryPumpAnim = Math.max(0, this.berryPumpAnim - dt * 4.5);
      this.berrySoap.pumpHead.position.y = 0.84 - Math.sin(this.berryPumpAnim * Math.PI) * 0.09;
    }

    // 4. Rack gentle metallic wobble
    if (this.rackWobble > 0) {
      this.rackWobble = Math.max(0, this.rackWobble - dt * 3.5);
      this.rackGroup.rotation.z = Math.sin(elapsed * 32) * 0.035 * this.rackWobble;
    } else {
      this.rackGroup.rotation.z = 0;
    }

    // 5. Faucet lever & water stream physics
    const targetLeverRot = this.faucetOn ? -0.52 : 0.0;
    this.leverPivot.rotation.z = THREE.MathUtils.lerp(this.leverPivot.rotation.z, targetLeverRot, Math.min(1, dt * 14));
    this.modeRingMat.color.setHex(this.showerMode ? 0x45f0b6 : 0x36b5ff);

    this.faucetFlow = THREE.MathUtils.lerp(this.faucetFlow, this.faucetOn ? 1 : 0, Math.min(1, dt * 12));
    this.textures.waterBumpMap.offset.y -= dt * 2.6;
    this.textures.waterBumpMap.offset.x = Math.sin(elapsed * 2.2) * 0.08;

    const surfaceY = THREE.MathUtils.lerp(this.basinBounds.floorY + 0.02, -0.04, this.waterLevel);
    const hitY = Math.max(surfaceY, dishImpactY);
    const streamLen = Math.max(0.25, this.spoutWorldPos.y - hitY);

    if (this.faucetFlow > 0.03) {
      this.waterColumnMesh.visible = !this.showerMode;
      this.showerGroup.visible = this.showerMode;

      const wobble = 1 + Math.sin(elapsed * 28) * 0.06;
      this.waterColumnMesh.scale.set(this.faucetFlow * wobble, streamLen, this.faucetFlow * wobble);
      this.showerGroup.scale.set(this.faucetFlow, streamLen, this.faucetFlow);
    } else {
      this.waterColumnMesh.visible = false;
      this.showerGroup.visible = false;
    }

    // 6. Rubber Drain Stopper & Sink Basin Water Level ("水を満杯に貯める・溢れさせる")
    const targetPlugPos = this.drainPlugged
      ? new THREE.Vector3(this.drainPos.x, this.basinBounds.floorY + 0.025, this.drainPos.z)
      : new THREE.Vector3(this.drainPos.x - 0.26, this.basinBounds.floorY + 0.055, this.drainPos.z - 0.16);
    this.stopperGroup.position.lerp(targetPlugPos, Math.min(1, dt * 12));
    this.stopperGroup.rotation.z = THREE.MathUtils.lerp(
      this.stopperGroup.rotation.z,
      this.drainPlugged ? 0 : 0.35,
      Math.min(1, dt * 12)
    );

    // Update beaded chain curve from back basin wall to stopper ring
    const chainStart = new THREE.Vector3(this.drainPos.x - 0.12, -0.14, this.basinBounds.minZ + 0.04);
    const chainEnd = this.stopperGroup.position.clone().add(new THREE.Vector3(0, 0.06, 0));
    for (let i = 0; i < this.chainBeads.length; i++) {
      const t = (i + 1) / (this.chainBeads.length + 1);
      const p = chainStart.clone().lerp(chainEnd, t);
      p.y -= Math.sin(t * Math.PI) * 0.11;
      this.chainBeads[i].position.copy(p);
    }

    // Water filling / draining logic
    if (this.drainPlugged) {
      if (this.faucetOn) {
        this.waterLevel = Math.min(1.04, this.waterLevel + dt * 0.16);
        if (this.waterLevel >= 0.99) {
          this.overflowRipple = Math.min(1, this.overflowRipple + dt * 1.5);
        }
      }
      this.whirlpoolSpin = THREE.MathUtils.lerp(this.whirlpoolSpin, 0, Math.min(1, dt * 5));
    } else {
      if (this.waterLevel > 0.04) {
        // Exciting whirlpool vortex as water drains down!
        this.whirlpoolSpin = Math.min(1, this.whirlpoolSpin + dt * 4);
        this.waterLevel = Math.max(0, this.waterLevel - dt * 0.28);
      } else {
        this.waterLevel = this.faucetOn ? 0.035 : Math.max(0, this.waterLevel - dt * 0.2);
        this.whirlpoolSpin = THREE.MathUtils.lerp(this.whirlpoolSpin, 0, Math.min(1, dt * 6));
      }
      this.overflowRipple = Math.max(0, this.overflowRipple - dt * 2);
    }

    // Animate 3D Sink Water Plane vertices (waves + faucet splash ripples + whirlpool funnel!)
    if (this.waterLevel > 0.015) {
      this.sinkWaterMesh.visible = true;
      this.sinkWaterMesh.position.y = THREE.MathUtils.lerp(
        this.basinBounds.floorY + 0.02,
        -0.02,
        Math.min(1.02, this.waterLevel)
      );

      const posAttr = this.waterGeo.attributes.position;
      const arr = posAttr.array;
      const base = this.waterBasePos;
      const wxCenter = this.sinkWaterMesh.position.x;
      const wzCenter = this.sinkWaterMesh.position.z;

      for (let i = 0; i < posAttr.count; i++) {
        const idx = i * 3;
        const lx = base[idx];
        const lz = base[idx + 2];
        const worldX = lx + wxCenter;
        const worldZ = lz + wzCenter;

        // Gentle sloshing waves
        let dy = Math.sin(worldX * 3.8 + elapsed * 3.4) * 0.012
          + Math.cos(worldZ * 4.2 - elapsed * 2.9) * 0.012;

        // Concentric ripples around faucet stream impact (-0.10, 0.16)
        if (this.faucetFlow > 0.1) {
          const dxS = worldX - (-0.10);
          const dzS = worldZ - 0.16;
          const distS = Math.sqrt(dxS * dxS + dzS * dzS);
          dy += Math.sin(distS * 18 - elapsed * 16) * 0.018 * this.faucetFlow / (1 + distS * 2.5);
        }

        // Whirlpool funnel depression right over drain when unplugged!
        if (this.whirlpoolSpin > 0.05) {
          const dxD = worldX - this.drainPos.x;
          const dzD = worldZ - this.drainPos.z;
          const distD = Math.sqrt(dxD * dxD + dzD * dzD);
          const funnel = Math.exp(-distD * 4.2) * 0.16 * this.whirlpoolSpin * Math.min(1, this.waterLevel * 2.5);
          const spiral = Math.sin(Math.atan2(dzD, dxD) * 3 + distD * 14 - elapsed * 20) * 0.016 * this.whirlpoolSpin;
          dy += spiral - funnel;
        }

        arr[idx + 1] = dy;
      }
      posAttr.needsUpdate = true;
      this.waterGeo.computeVertexNormals();
    } else {
      this.sinkWaterMesh.visible = false;
    }
  }
}
