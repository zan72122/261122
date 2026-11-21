import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { SYRUP_DEFS, createFruitMesh } from './kakigori.js';

export class KakigoriWorld {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.syrupBottles = [];
    this.fruitDishes = [];
    this.rainbowArcAlpha = 0;

    this._buildLighting();
    this._buildCounterAndStall();
    this._buildSyrupStation();
    this._buildToppingStation();
    this._buildBackgroundDiorama();
    this._buildKeepsakes();
  }

  _buildLighting() {
    // Balanced miniature studio lighting so white shaved ice keeps rich crystal shading & saturated syrups!
    const hemi = new THREE.HemisphereLight(0xfff4e2, 0x7d5136, 0.85);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff0d4, 1.72);
    this.sunLight.position.set(2.8, 5.2, 3.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 12.5;
    this.sunLight.shadow.camera.left = -2.8;
    this.sunLight.shadow.camera.right = 2.8;
    this.sunLight.shadow.camera.top = 3.2;
    this.sunLight.shadow.camera.bottom = -1.8;
    this.sunLight.shadow.bias = -0.0008;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    const rim = new THREE.DirectionalLight(0xc4ebff, 0.78);
    rim.position.set(-3.2, 3.6, -2.2);
    this.scene.add(rim);

    this.lanternGlow = new THREE.PointLight(0xffa447, 0.55, 7.5);
    this.lanternGlow.position.set(0, 2.85, 0.4);
    this.scene.add(this.lanternGlow);
  }

  _buildCounterAndStall() {
    const cedarMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodMap,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.018,
      roughness: 0.42,
      metalness: 0.03,
    });
    const darkTimberMat = new THREE.MeshStandardMaterial({
      map: this.textures.darkWoodMap,
      roughness: 0.50,
    });

    // Thick Japanese Hinoki Cedar Countertop
    const counterGeo = new RoundedBoxGeometry(6.4, 0.24, 2.85, 4, 0.045);
    this.counterMesh = new THREE.Mesh(counterGeo, cedarMat);
    this.counterMesh.position.set(0, 0.64, 1.52);
    this.counterMesh.receiveShadow = true;
    this.scene.add(this.counterMesh);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.72, 2.55), darkTimberMat);
    apron.position.set(0, 0.18, 1.56);
    this.scene.add(apron);

    // Woven bamboo customer serving mat across counter
    const bambooMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodMap,
      color: 0xe8d49b,
      roughness: 0.62,
    });
    this.servingMat = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.022, 0.64, 2, 0.01), bambooMat);
    this.servingMat.position.set(0.66, 0.765, 0.62);
    this.servingMat.receiveShadow = true;
    this.servingMat.userData.hitRole = 'customer';
    this.scene.add(this.servingMat);

    // Yatai wooden corner posts & lowered top beam so Noren frames the top of BOTH 4:3 & Portrait!
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.20, 3.4, 0.20), darkTimberMat);
      post.position.set(side * 2.25, 2.1, 0.12);
      this.scene.add(post);
    }
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.20, 0.24), darkTimberMat);
    topBeam.position.set(0, 3.16, 0.18);
    this.scene.add(topBeam);

    // Swaying Pictorial Indigo & Coral Noren Curtain clearly visible along top frame (ZERO text!)
    this.norenPanels = [];
    for (let i = 0; i < 3; i++) {
      const uvOffset = i / 3;
      const geo = new THREE.PlaneGeometry(1.16, 0.56, 6, 6);
      const uvAttr = geo.attributes.uv;
      for (let k = 0; k < uvAttr.count; k++) {
        uvAttr.setX(k, uvOffset + uvAttr.getX(k) / 3);
      }
      const mat = new THREE.MeshStandardMaterial({
        map: this.textures.norenMap,
        roughness: 0.76,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(geo, mat);
      panel.position.set((i - 1) * 1.22, 2.82, 0.22);
      this.scene.add(panel);
      this.norenPanels.push(panel);
    }

    // Contact AO Shadow blobs
    this.aoMat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    });
    this.bowlAO = this._addAO(-0.08, 1.54, 1.48, 1.48);
    this.shaverAO = this._addAO(-1.02, 1.18, 1.25, 1.25);
    this.syrupAO = this._addAO(-1.14, 1.92, 1.18, 1.10);
    this.toppingAO = this._addAO(1.06, 1.88, 1.25, 1.25);
  }

  _addAO(x, z, sx, sz) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), this.aoMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.763, z);
    this.scene.add(m);
    return m;
  }

  _buildSyrupStation() {
    this.syrupCaddy = new THREE.Group();
    this.scene.add(this.syrupCaddy);

    const caddyWood = new THREE.MeshStandardMaterial({
      map: this.textures.darkWoodMap,
      roughness: 0.44,
    });
    const tray = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.08, 0.82, 3, 0.022), caddyWood);
    tray.position.set(0, 0.04, 0);
    tray.castShadow = true;
    tray.receiveShadow = true;
    this.syrupCaddy.add(tray);

    const stepRiser = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.08, 0.36, 2, 0.018), caddyWood);
    stepRiser.position.set(0, 0.11, -0.19);
    this.syrupCaddy.add(stepRiser);

    // Compact 2x2 stepped grid so ALL 4 jewel bottles fit 100% inside the left side of the screen!
    const offsets = [
      new THREE.Vector3(-0.19, 0.08, 0.19),  // Ruby Strawberry (front-left)
      new THREE.Vector3(0.19, 0.08, 0.19),   // Sunny Lemon (front-right)
      new THREE.Vector3(-0.19, 0.15, -0.19), // Emerald Melon (back-left)
      new THREE.Vector3(0.19, 0.15, -0.19),  // Sky Blue Hawaii (back-right)
    ];

    const spoutSteel = new THREE.MeshStandardMaterial({ color: 0xe3eaef, roughness: 0.2, metalness: 0.88 });

    SYRUP_DEFS.forEach((def, idx) => {
      const bGroup = new THREE.Group();
      const home = offsets[idx].clone();
      bGroup.position.copy(home);

      const liqMat = new THREE.MeshPhysicalMaterial({
        color: def.liquidHex,
        emissive: def.liquidHex,
        emissiveIntensity: 0.12,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      });
      const liqMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.130, 0.27, 16), liqMat);
      liqMesh.position.y = 0.14;
      liqMesh.castShadow = true;
      bGroup.add(liqMesh);

      const glassBottleMat = new THREE.MeshPhysicalMaterial({
        color: def.capHex,
        roughness: 0.05,
        transparent: true,
        opacity: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        depthWrite: false,
      });
      const bodyPts = [
        new THREE.Vector2(0.001, 0),
        new THREE.Vector2(0.142, 0),
        new THREE.Vector2(0.150, 0.28),
        new THREE.Vector2(0.058, 0.38),
        new THREE.Vector2(0.054, 0.47),
      ];
      const glassBody = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 18), glassBottleMat);
      bGroup.add(glassBody);

      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.072, 0.068, 14),
        new THREE.MeshStandardMaterial({ color: def.capHex, roughness: 0.28 })
      );
      collar.position.y = 0.44;
      bGroup.add(collar);

      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.12, 10), spoutSteel);
      spout.position.set(0.015, 0.52, 0);
      spout.rotation.z = -0.22;
      bGroup.add(spout);

      const nozzleTip = new THREE.Object3D();
      nozzleTip.position.set(0.028, 0.59, 0);
      bGroup.add(nozzleTip);

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.20, 0.66, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.31;
      hit.userData = { hitRole: 'syrup', syrupIndex: idx };
      bGroup.add(hit);

      this.syrupCaddy.add(bGroup);
      this.syrupBottles.push({
        index: idx,
        def,
        group: bGroup,
        homeLocal: home,
        nozzleTip,
        wobble: 0,
        activePour: false,
      });
    });
  }

  _buildToppingStation() {
    this.toppingStation = new THREE.Group();
    this.scene.add(this.toppingStation);

    // Plump Condensed Milk Squeeze Bottle tucked neatly at back-left of right station!
    this.milkBottleGroup = new THREE.Group();
    this.milkHomeLocal = new THREE.Vector3(-0.32, 0.02, -0.28);
    this.milkBottleGroup.position.copy(this.milkHomeLocal);

    const milkBodyMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.milkLabelMap,
      roughness: 0.24,
      clearcoat: 0.75,
    });
    const milkBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.142, 0.34, 20), milkBodyMat);
    milkBody.position.y = 0.19;
    milkBody.castShadow = true;
    this.milkBottleGroup.add(milkBody);

    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.28 })
    );
    shoulder.position.y = 0.35;
    this.milkBottleGroup.add(shoulder);

    const redNozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.062, 0.15, 14),
      new THREE.MeshStandardMaterial({ color: 0xe6223b, roughness: 0.28 })
    );
    redNozzle.position.y = 0.52;
    this.milkBottleGroup.add(redNozzle);

    this.milkNozzleTip = new THREE.Object3D();
    this.milkNozzleTip.position.set(0, 0.61, 0);
    this.milkBottleGroup.add(this.milkNozzleTip);

    const milkHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.70, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    milkHit.position.y = 0.32;
    milkHit.userData = { hitRole: 'milk' };
    this.milkBottleGroup.add(milkHit);
    this.milkWobble = 0;
    this.toppingStation.add(this.milkBottleGroup);

    // Compact 2x2 Ceramic Fruit Bowls clearly inside right side of frame (Strawberries front-left & prominent!)
    const dishCoords = [
      { kind: 0, pos: new THREE.Vector3(-0.22, 0.0, 0.18),  glaze: 0xfff3f5 }, // Strawberries!
      { kind: 1, pos: new THREE.Vector3(0.24, 0.0, 0.18),   glaze: 0xf1fbf2 }, // Melon wedges!
      { kind: 2, pos: new THREE.Vector3(0.24, 0.0, -0.22),  glaze: 0xfff8eb }, // Mango cubes!
      { kind: 3, pos: new THREE.Vector3(0.12, 0.0, -0.60),  glaze: 0xf4f7ff }, // Cherries!
    ];

    dishCoords.forEach((cfg) => {
      const dGroup = new THREE.Group();
      dGroup.position.copy(cfg.pos);

      const ceramicMat = new THREE.MeshPhysicalMaterial({
        color: cfg.glaze,
        roughness: 0.16,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide,
      });
      const pts = [
        new THREE.Vector2(0.001, 0.01),
        new THREE.Vector2(0.13, 0.01),
        new THREE.Vector2(0.20, 0.055),
        new THREE.Vector2(0.22, 0.12),
      ];
      const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), ceramicMat);
      dish.castShadow = true;
      dish.receiveShadow = true;
      dGroup.add(dish);

      const pile = new THREE.Group();
      const pileSpots = [
        [0, 0.12, 0],
        [-0.075, 0.09, 0.055],
        [0.075, 0.09, 0.05],
        [0.01, 0.10, -0.07],
      ];
      pileSpots.forEach(([px, py, pz], k) => {
        const f = createFruitMesh(cfg.kind, this.textures, 0.82);
        f.position.set(px, py, pz);
        f.rotation.set((k - 1) * 0.25, k * 1.4, (k % 2 ? 1 : -1) * 0.2);
        pile.add(f);
      });
      dGroup.add(pile);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.13;
      hit.userData = { hitRole: 'fruitDish', fruitKind: cfg.kind };
      dGroup.add(hit);

      this.toppingStation.add(dGroup);
      this.fruitDishes.push({ kind: cfg.kind, group: dGroup, pile, wobble: 0 });
    });
  }

  _buildBackgroundDiorama() {
    // Rich warm golden-afternoon miniature studio backdrop + slatted wooden garden wall + warm bokeh fairy lights!
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(15, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xf7dfc0, side: THREE.BackSide })
    );
    this.scene.add(sky);

    // Crafted Japanese slatted cedar garden wall behind stall (instead of flat tan box!)
    const wallWood = new THREE.MeshStandardMaterial({
      map: this.textures.darkWoodMap,
      color: 0x9e6a43,
      roughness: 0.72,
    });
    const slatParts = [new THREE.BoxGeometry(11, 1.35, 0.12)];
    for (let i = -18; i <= 18; i++) {
      const slat = new THREE.BoxGeometry(0.12, 1.65, 0.18);
      slat.translate(i * 0.28, 0.1, 0.04);
      slatParts.push(slat);
    }
    const fence = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(slatParts), wallWood);
    fence.position.set(0, 0.82, -2.55);
    this.scene.add(fence);

    // Merged lush miniature garden foliage clusters behind wall (only 2 draw calls!)
    const darkTreeParts = [];
    const lightTreeParts = [];
    for (let i = 0; i < 16; i++) {
      const r = 0.55 + (i % 3) * 0.24;
      const g = new THREE.SphereGeometry(r, 12, 10);
      g.translate(-4.8 + i * 0.65, 2.05 + Math.sin(i * 1.7) * 0.48, -3.1 - (i % 2) * 0.5);
      if (i % 2 === 0) darkTreeParts.push(g);
      else lightTreeParts.push(g);
    }
    this.scene.add(
      new THREE.Mesh(BufferGeometryUtils.mergeGeometries(darkTreeParts), new THREE.MeshStandardMaterial({ color: 0x38783b, roughness: 0.76 })),
      new THREE.Mesh(BufferGeometryUtils.mergeGeometries(lightTreeParts), new THREE.MeshStandardMaterial({ color: 0x549c4c, roughness: 0.74 }))
    );

    // Bright Glowing Warm Festival String Lights across background -> creates authentic optical bokeh circles!
    const bulbPalette = [0xfff4bc, 0xffca70, 0xff9b73, 0xc2f2ff];
    bulbPalette.forEach((hex, cIdx) => {
      const parts = [];
      for (let i = cIdx; i < 16; i += 4) {
        const b = new THREE.SphereGeometry(0.085 + (i % 2) * 0.025, 10, 8);
        b.translate(-3.6 + i * 0.48, 2.55 + Math.sin(i * 0.85) * 0.42, -1.85 - (i % 3) * 0.45);
        parts.push(b);
      }
      if (parts.length > 0) {
        this.scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: hex })));
      }
    });

    // Magical Miniature Rainbow Sunbeam Arc
    this.rainbowGroup = new THREE.Group();
    this.rainbowGroup.position.set(0, 1.35, -1.45);
    const arcPalette = [0xff3b5c, 0xffa62b, 0xffe135, 0x2ce86f, 0x2cb4ff, 0x9b5de5];
    this.rainbowBands = [];
    arcPalette.forEach((hex, idx) => {
      const m = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.rainbowGroup.add(new THREE.Mesh(new THREE.TorusGeometry(2.25 - idx * 0.085, 0.045, 8, 36, Math.PI), m));
      this.rainbowBands.push(m);
    });
    this.scene.add(this.rainbowGroup);
  }

  _buildKeepsakes() {
    // 1. Glass Fuurin Wind-Chime hanging on upper-right beam
    const fuurin = new THREE.Group();
    fuurin.position.set(1.58, 2.72, 0.42);
    const bellGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
      new THREE.MeshPhysicalMaterial({ color: 0xbfeaff, transmission: 0.82, roughness: 0.06, clearcoat: 1 })
    );
    fuurin.add(bellGlass);
    const tanzaku = new THREE.Mesh(
      new THREE.PlaneGeometry(0.085, 0.30),
      new THREE.MeshStandardMaterial({ color: 0xff6b88, side: THREE.DoubleSide, roughness: 0.6 })
    );
    tanzaku.position.y = -0.28;
    fuurin.add(tanzaku);
    const fHit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    fHit.position.y = -0.10;
    fHit.userData = { hitRole: 'keepsake', keepsakeId: 'fuurin' };
    fuurin.add(fHit);
    this.scene.add(fuurin);
    this.fuurin = { group: fuurin, tanzaku, swing: 0.08 };

    // 2. Kazaguruma Pinwheel (unlocks after 1st bowl)
    const pinwheel = new THREE.Group();
    pinwheel.position.set(-1.55, 0.76, 0.92);
    pinwheel.visible = false;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.62, 8),
      new THREE.MeshStandardMaterial({ color: 0xe6c28b })
    );
    stick.position.y = 0.31;
    pinwheel.add(stick);
    const rotor = new THREE.Group();
    rotor.position.set(0, 0.58, 0.04);
    const pwColors = [0xff3b5c, 0xffd014, 0x1cd860, 0x1ca8ff];
    pwColors.forEach((c, i) => {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.21, 4),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })
      );
      const a = (i / 4) * Math.PI * 2;
      blade.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0);
      blade.rotation.z = a - Math.PI * 0.25;
      rotor.add(blade);
    });
    pinwheel.add(rotor);
    const pHit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    pHit.position.y = 0.52;
    pHit.userData = { hitRole: 'keepsake', keepsakeId: 'pinwheel' };
    pinwheel.add(pHit);
    this.scene.add(pinwheel);
    this.pinwheel = { group: pinwheel, rotor, spinVel: 1.5 };

    // 3. Brass Counter Bell (unlocks after 2nd bowl)
    const bell = new THREE.Group();
    bell.position.set(0.58, 0.76, 1.18);
    bell.visible = false;
    const brass = new THREE.MeshStandardMaterial({ color: 0xf0be49, roughness: 0.2, metalness: 0.88 });
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), brass);
    bellDome.position.y = 0.03;
    bellDome.castShadow = true;
    const bellBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), brass);
    bellBtn.position.y = 0.14;
    bell.add(bellDome, bellBtn);
    const bHit = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    bHit.position.y = 0.09;
    bHit.userData = { hitRole: 'keepsake', keepsakeId: 'bell' };
    bell.add(bHit);
    this.scene.add(bell);
    this.brassBell = { group: bell, bounce: 0 };

    // 4. Glowing Festival Chochin Lanterns (unlocks after 3rd bowl)
    this.chochinGroup = new THREE.Group();
    this.chochinGroup.visible = false;
    for (const side of [-1, 1]) {
      const lantern = new THREE.Group();
      lantern.position.set(side * 1.78, 2.58, 0.36);
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 16, 12),
        new THREE.MeshStandardMaterial({
          color: 0xff4b3a,
          emissive: 0xff8c2b,
          emissiveIntensity: 0.78,
          roughness: 0.55,
        })
      );
      body.scale.set(0.88, 1.22, 0.88);
      const rimTop = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x221612 }));
      rimTop.position.y = 0.24;
      const rimBot = rimTop.clone();
      rimBot.position.y = -0.24;
      lantern.add(body, rimTop, rimBot);
      this.chochinGroup.add(lantern);
    }
    this.scene.add(this.chochinGroup);
  }

  unlockKeepsakeForServeCount(servedCount, isRainbow) {
    if (servedCount >= 1) {
      this.pinwheel.group.visible = true;
      this.pinwheel.spinVel = 14.0;
    }
    if (servedCount >= 2) {
      this.brassBell.group.visible = true;
      this.brassBell.bounce = 1.0;
    }
    if (servedCount >= 3) {
      this.chochinGroup.visible = true;
      this.lanternGlow.intensity = 1.35;
    }
    if (isRainbow) {
      this.rainbowArcAlpha = 1.0;
    }
  }

  updateResponsiveLayout(isPortrait, machineGroup) {
    if (isPortrait) {
      machineGroup.position.set(-1.02, 0.76, 1.18);
      this.shaverAO.position.set(-1.02, 0.763, 1.18);
      this.syrupCaddy.position.set(-0.82, 0.76, 2.26);
      this.syrupCaddy.scale.setScalar(0.88);
      this.syrupAO.position.set(-0.82, 0.763, 2.26);
      this.toppingStation.position.set(0.76, 0.76, 2.24);
      this.toppingStation.scale.setScalar(0.86);
      this.toppingAO.position.set(0.76, 0.763, 2.24);
      this.servingMat.position.set(0.48, 0.765, 0.62);
      this.pinwheel.group.position.set(-1.18, 0.76, 0.58);
      this.fuurin.group.position.set(1.22, 2.72, 0.42);
    } else {
      machineGroup.position.set(-1.02, 0.76, 1.18);
      this.shaverAO.position.set(-1.02, 0.763, 1.18);
      this.syrupCaddy.position.set(-1.16, 0.76, 1.94);
      this.syrupCaddy.scale.setScalar(0.96);
      this.syrupAO.position.set(-1.16, 0.763, 1.94);
      this.toppingStation.position.set(1.06, 0.76, 1.88);
      this.toppingStation.scale.setScalar(0.96);
      this.toppingAO.position.set(1.06, 0.763, 1.88);
      this.servingMat.position.set(0.66, 0.765, 0.62);
      this.pinwheel.group.position.set(-1.62, 0.76, 0.85);
      this.fuurin.group.position.set(1.58, 2.72, 0.42);
    }
  }

  update(dt, elapsed) {
    this.norenPanels.forEach((p, idx) => {
      p.rotation.x = Math.sin(elapsed * 1.6 + idx * 0.9) * 0.06 - 0.04;
    });

    this.fuurin.swing = Math.max(0.05, this.fuurin.swing * (1 - dt * 1.4));
    this.fuurin.group.rotation.z = Math.sin(elapsed * 3.1) * this.fuurin.swing;
    this.fuurin.tanzaku.rotation.z = Math.sin(elapsed * 4.4 + 0.8) * (this.fuurin.swing * 2.2 + 0.06);

    if (this.pinwheel.group.visible) {
      this.pinwheel.spinVel = Math.max(1.2, this.pinwheel.spinVel * (1 - dt * 1.5));
      this.pinwheel.rotor.rotation.z -= this.pinwheel.spinVel * dt;
    }

    if (this.brassBell.bounce > 0) {
      this.brassBell.bounce = Math.max(0, this.brassBell.bounce - dt * 4.0);
      const s = 1 + Math.sin(this.brassBell.bounce * Math.PI * 3) * 0.14 * this.brassBell.bounce;
      this.brassBell.group.scale.set(s, 2 - s, s);
    }

    for (const b of this.syrupBottles) {
      if (!b.activePour) {
        b.group.position.lerp(b.homeLocal, Math.min(1, dt * 12));
        b.wobble = Math.max(0, b.wobble - dt * 3.2);
        b.group.rotation.set(0, 0, Math.sin(elapsed * 26) * 0.18 * b.wobble);
      }
    }

    if (!this.milkActivePour) {
      this.milkBottleGroup.position.lerp(this.milkHomeLocal, Math.min(1, dt * 12));
      this.milkWobble = Math.max(0, this.milkWobble - dt * 3.2);
      this.milkBottleGroup.rotation.set(0, 0, Math.sin(elapsed * 26) * 0.18 * this.milkWobble);
    }

    for (const d of this.fruitDishes) {
      d.wobble = Math.max(0, d.wobble - dt * 3.2);
      d.group.rotation.z = Math.sin(elapsed * 26) * 0.15 * d.wobble;
    }

    if (this.rainbowArcAlpha > 0.001) {
      this.rainbowArcAlpha = Math.max(0, this.rainbowArcAlpha - dt * 0.12);
      this.rainbowBands.forEach((m) => {
        m.opacity = this.rainbowArcAlpha * 0.42;
      });
    }
  }
}
