import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { makeSoft3DMaterial, addPencilOutline } from './materials.js';

// Deformable 3D Hamburg Steak, ingredients, cast-iron skillet, stove, steam lid,
// draped cheddar cheese slice, sunny-side egg, continuous glossy demi-glace glaze & keepsakes!

export class CulinaryWorld {
  constructor(scene, meatPainter, ginghamTex, spriteTextures) {
    this.scene = scene;
    this.meatPainter = meatPainter;
    this.ginghamTex = ginghamTex;
    this.spriteTextures = spriteTextures;

    this.root = new THREE.Group();
    scene.add(this.root);

    this.spreadX = 1.0;
    this.time = 0;

    this.pattyState = {
      mode: 'mound',
      knead: 0,
      roundness: 0,
      flatness: 0,
      dimple: 0,
      plump: 0,
      searBottom: 0,
      searTop: 0,
      squash: 0,
      squashVel: 0,
      swirlAngle: 0,
      indentLocal: new THREE.Vector3(0, 1, 0),
      indentStrength: 0,
      cutOpen: false,
      bitesLeft: 3
    };

    this._buildBowlStation();
    this._buildPattyActor();
    this._buildStoveAndSkillet();
    this._buildPlateAndGarnish();
    this._buildToppingsSaucer();
    this._buildSaucePitcher();
    this._buildFork();
    this._buildKeepsakeTray();
  }

  _buildBowlStation() {
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.set(0, 0.0, 0.48);
    this.root.add(this.bowlGroup);

    const pts = [
      new THREE.Vector2(0.0, 0.02),
      new THREE.Vector2(0.46, 0.02),
      new THREE.Vector2(0.68, 0.16),
      new THREE.Vector2(0.80, 0.42),
      new THREE.Vector2(0.84, 0.54),
      new THREE.Vector2(0.77, 0.56),
      new THREE.Vector2(0.71, 0.42),
      new THREE.Vector2(0.58, 0.18),
      new THREE.Vector2(0.40, 0.08),
      new THREE.Vector2(0.0, 0.08)
    ];
    const bowlMat = makeSoft3DMaterial({
      color: 0xfff8eb,
      roughness: 0.34,
      clearcoat: 0.45,
      emissive: 0x3d2512,
      emissiveIntensity: 0.07
    });
    this.bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), bowlMat);
    this.bowlMesh.castShadow = true;
    this.bowlMesh.receiveShadow = true;
    this.bowlMesh.userData.hitKind = 'bowl';
    addPencilOutline(this.bowlMesh, 0.018, 0x6b4433, 0.45);
    this.bowlGroup.add(this.bowlMesh);

    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.805, 0.022, 10, 36),
      makeSoft3DMaterial({ color: 0xe36255, roughness: 0.45 })
    );
    stripe.rotation.x = Math.PI * 0.5;
    stripe.position.y = 0.46;
    stripe.raycast = () => {};
    this.bowlGroup.add(stripe);

    this.rawIngredients = new THREE.Group();
    this.rawIngredients.position.set(0, 0.44, 0);
    this.bowlGroup.add(this.rawIngredients);

    const eggWhiteMat = makeSoft3DMaterial({
      color: 0xfffdf6,
      roughness: 0.18,
      transparent: true,
      opacity: 0.78,
      clearcoat: 0.9
    });
    this.eggWhite = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), eggWhiteMat);
    this.eggWhite.scale.set(1.18, 0.24, 1.08);
    this.eggWhite.position.set(0, 0.02, 0.02);
    this.eggWhite.userData.hitKind = 'bowl';
    this.rawIngredients.add(this.eggWhite);

    const yolkMat = makeSoft3DMaterial({
      color: 0xffa619,
      roughness: 0.14,
      clearcoat: 1.0,
      emissive: 0x8a3800,
      emissiveIntensity: 0.18
    });
    this.eggYolk = new THREE.Mesh(new THREE.SphereGeometry(0.165, 22, 16), yolkMat);
    this.eggYolk.scale.set(1.05, 0.72, 1.05);
    this.eggYolk.position.set(0, 0.09, 0.02);
    this.eggYolk.userData.hitKind = 'bowl';
    this.rawIngredients.add(this.eggYolk);
    this.yolkPopped = false;

    this.onionCubes = [];
    const onionMat = makeSoft3DMaterial({
      color: 0xfffef4,
      roughness: 0.35,
      emissive: 0x3d3018,
      emissiveIntensity: 0.08
    });
    const cubeGeo = new RoundedBoxGeometry(0.085, 0.065, 0.085, 2, 0.018);
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
      const rad = 0.24 + (i % 3) * 0.12;
      const cube = new THREE.Mesh(cubeGeo, onionMat);
      cube.position.set(Math.cos(ang) * rad, -0.02 + (i % 2) * 0.03, Math.sin(ang) * rad);
      cube.rotation.set(i * 0.5, i * 0.8, i * 0.3);
      cube.raycast = () => {};
      this.rawIngredients.add(cube);
      this.onionCubes.push({ mesh: cube, basePos: cube.position.clone(), ang });
    }
  }

  _buildPattyActor() {
    this.pattyAnchor = new THREE.Group();
    this.pattyAnchor.position.set(0, 0.30, 0.48);
    this.root.add(this.pattyAnchor);

    this.pattyFlipGroup = new THREE.Group();
    this.pattyAnchor.add(this.pattyFlipGroup);

    const segW = 40, segH = 28;
    this.pattyGeo = new THREE.SphereGeometry(0.56, segW, segH);
    this.basePositions = new Float32Array(this.pattyGeo.attributes.position.array);

    this.pattyMat = makeSoft3DMaterial({
      color: 0xffffff,
      map: this.meatPainter.texture,
      roughness: 0.42,
      clearcoat: 0.38,
      clearcoatRoughness: 0.26,
      emissive: 0x3b120c,
      emissiveIntensity: 0.11
    });

    this.pattyMesh = new THREE.Mesh(this.pattyGeo, this.pattyMat);
    this.pattyMesh.castShadow = true;
    this.pattyMesh.receiveShadow = true;
    this.pattyMesh.userData.hitKind = 'patty';
    this.pattyOutline = addPencilOutline(this.pattyMesh, 0.02, 0x5c2b1c, 0.48);
    this.pattyFlipGroup.add(this.pattyMesh);

    // 6 Crisp Airy Translucent Air-Pocket Bubble Sprites floating clearly on outer surface!
    this.airBubbles = [];
    const bubbleSpots = [
      new THREE.Vector3(-0.38, 0.44, 0.34),
      new THREE.Vector3(0.40, 0.42, 0.32),
      new THREE.Vector3(-0.18, 0.54, 0.14),
      new THREE.Vector3(0.20, 0.52, 0.16),
      new THREE.Vector3(0.0, 0.28, 0.58),
      new THREE.Vector3(-0.24, 0.14, 0.52)
    ];
    bubbleSpots.forEach((p) => {
      const bMat = new THREE.SpriteMaterial({
        map: this.spriteTextures.bubble,
        transparent: true,
        opacity: 0.94,
        depthTest: false,
        depthWrite: false
      });
      const b = new THREE.Sprite(bMat);
      b.position.copy(p);
      b.scale.setScalar(0.25);
      b.renderOrder = 4;
      b.visible = false;
      b.raycast = () => {};
      this.pattyFlipGroup.add(b);
      this.airBubbles.push({ mesh: b, basePos: p.clone(), popped: false });
    });

    // Plated Toppings & Continuous Glossy Demi-Glace Sauce Glaze!
    // Note: Plated plump patty top crest is at ~y = +0.44!
    this.pattyTopDecor = new THREE.Group();
    this.pattyAnchor.add(this.pattyTopDecor);

    // A. Melted Square Slice of Rich Cheddar Cheese (conforms tightly to the curved patty surface!)
    const cheeseGeo = new THREE.PlaneGeometry(0.84, 0.78, 20, 20);
    cheeseGeo.rotateX(-Math.PI * 0.5);
    const cPos = cheeseGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const cx = cPos.getX(i);
      const cz = cPos.getZ(i);
      const nx = cx / 0.72;
      const nz = cz / 0.60;
      const dome = Math.sqrt(Math.max(0.04, 1 - nx * nx - nz * nz)) * 0.455 + 0.018;
      cPos.setY(i, dome);
    }
    cheeseGeo.computeVertexNormals();
    const cheeseMat = makeSoft3DMaterial({
      color: 0xffbc2c,
      roughness: 0.22,
      clearcoat: 0.78,
      emissive: 0x783c00,
      emissiveIntensity: 0.16,
      side: THREE.DoubleSide
    });
    this.placedCheese = new THREE.Mesh(cheeseGeo, cheeseMat);
    this.placedCheese.rotation.y = 0.42;
    this.placedCheese.visible = false;
    this.placedCheese.raycast = () => {};
    this.pattyTopDecor.add(this.placedCheese);

    // B. Continuous Lush 3D Glossy Demi-Glace Sauce Glaze Cap (sits cleanly at y = +0.50!)
    const glazeGeo = new THREE.SphereGeometry(0.56, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.50);
    const gPos = glazeGeo.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const gx = gPos.getX(i);
      const gy = gPos.getY(i);
      const gz = gPos.getZ(i);
      const ang = Math.atan2(gz, gx);
      const lobe = 1.0 + Math.sin(ang * 5 + 0.6) * 0.10 + Math.cos(ang * 3) * 0.06;
      gPos.setXYZ(i, gx * 1.12 * lobe, gy * 0.88 + 0.02, gz * 0.94 * lobe);
    }
    glazeGeo.computeVertexNormals();

    const sauceMat = makeSoft3DMaterial({
      color: 0x571b08,
      roughness: 0.08,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: 0x2e0b02,
      emissiveIntensity: 0.20
    });
    this.sauceGlaze = new THREE.Mesh(glazeGeo, sauceMat);
    this.sauceGlaze.position.set(0, 0.01, 0);
    this.sauceGlaze.scale.setScalar(0.001);
    this.sauceGlaze.visible = false;
    this.sauceGlaze.raycast = () => {};
    this.pattyTopDecor.add(this.sauceGlaze);

    // Extra glossy sauce puddles where player specifically drags!
    this.sauceNodes = [];
    const sauceCoords = [
      { x: 0.0, y: 0.49, z: 0.0, sx: 0.30, sy: 0.05, sz: 0.26 },
      { x: -0.20, y: 0.46, z: 0.08, sx: 0.22, sy: 0.05, sz: 0.20 },
      { x: 0.20, y: 0.46, z: 0.06, sx: 0.22, sy: 0.05, sz: 0.20 },
      { x: -0.10, y: 0.45, z: -0.14, sx: 0.22, sy: 0.05, sz: 0.18 },
      { x: 0.12, y: 0.45, z: -0.13, sx: 0.22, sy: 0.05, sz: 0.18 },
      { x: 0.02, y: 0.44, z: 0.18, sx: 0.24, sy: 0.05, sz: 0.20 }
    ];
    sauceCoords.forEach((sc) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), sauceMat);
      m.position.set(sc.x, sc.y, sc.z);
      m.scale.setScalar(0.001);
      m.visible = false;
      m.raycast = () => {};
      this.pattyTopDecor.add(m);
      this.sauceNodes.push({
        mesh: m,
        targetScale: new THREE.Vector3(sc.sx, sc.sy, sc.sz),
        fill: 0,
        pos2D: new THREE.Vector2(sc.x, sc.z)
      });
    });

    // C. Placed Sunny-Side-Up Egg on top of sauce/cheese!
    this.placedEgg = this._createSunnyEggMesh();
    this.placedEgg.position.set(0, 0.53, 0.02);
    this.placedEgg.visible = false;
    this.pattyTopDecor.add(this.placedEgg);

    // D. Glistening Golden Meat-Juice Pool ("肉汁じゅわっ")
    const juiceMat = makeSoft3DMaterial({
      color: 0xffce54,
      roughness: 0.05,
      transparent: true,
      opacity: 0.92,
      clearcoat: 1.0,
      emissive: 0xb85e00,
      emissiveIntensity: 0.36
    });
    this.juicePool = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.03, 24), juiceMat);
    this.juicePool.position.set(0.18, -0.15, 0.32);
    this.juicePool.scale.set(0.01, 1, 0.01);
    this.juicePool.visible = false;
    this.juicePool.raycast = () => {};
    this.pattyTopDecor.add(this.juicePool);

    this.deformPatty();
  }

  _createSunnyEggMesh() {
    const g = new THREE.Group();
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 22, 14),
      makeSoft3DMaterial({ color: 0xfffdf8, roughness: 0.20, clearcoat: 0.8 })
    );
    white.scale.set(1.12, 0.20, 0.98);
    white.raycast = () => {};
    g.add(white);

    const yolk = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 20, 14),
      makeSoft3DMaterial({
        color: 0xff9d14,
        roughness: 0.12,
        clearcoat: 1.0,
        emissive: 0x7a3000,
        emissiveIntensity: 0.18
      })
    );
    yolk.scale.set(1.04, 0.68, 1.04);
    yolk.position.set(0.02, 0.075, 0.02);
    yolk.raycast = () => {};
    g.add(yolk);
    g.userData.yolk = yolk;
    return g;
  }

  deformPatty() {
    const pos = this.pattyGeo.attributes.position;
    const base = this.basePositions;
    const st = this.pattyState;

    const count = pos.count;
    const moundAmt = 1 - st.roundness;
    const ovalX = 1.0 + st.flatness * 0.26 - st.squash * 0.22;
    const ovalY = (0.72 + st.roundness * 0.18 - st.flatness * 0.24) * (1 + st.plump * 0.26) + st.squash * 0.30;
    const ovalZ = 1.0 + st.flatness * 0.06 - st.squash * 0.18;

    for (let i = 0; i < count; i++) {
      let x = base[i * 3];
      let y = base[i * 3 + 1];
      let z = base[i * 3 + 2];

      if (moundAmt > 0.01) {
        const ang = Math.atan2(z, x) + st.swirlAngle * (1 - Math.abs(y));
        const r = Math.sqrt(x * x + z * z);
        x = Math.cos(ang) * r;
        z = Math.sin(ang) * r;

        const lump = Math.sin(x * 9.5 + st.swirlAngle) * Math.cos(z * 9.5) * 0.065 * moundAmt * (1 - st.knead * 0.45);
        const skirt = y < 0 ? (1 + (-y) * 0.42 * moundAmt) : 1;
        x = x * skirt + lump;
        z = z * skirt + lump;
        y = y * (0.62 * moundAmt + (1 - moundAmt)) + lump * 0.6;

        const r2 = x * x + z * z;
        if (y > 0 && st.knead < 0.55) {
          y -= Math.exp(-r2 * 14.0) * 0.14 * (1 - st.knead / 0.55);
        }
      }

      x *= ovalX;
      y *= ovalY;
      z *= ovalZ;

      if (st.indentStrength > 0.01) {
        const dx = x - st.indentLocal.x;
        const dy = y - st.indentLocal.y;
        const dz = z - st.indentLocal.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const push = Math.exp(-d2 * 11.0) * 0.18 * st.indentStrength;
        y -= push;
        x += dx * push * 0.9;
        z += dz * push * 0.9;
      }

      if (st.dimple > 0.01 && y > 0) {
        const r2 = x * x + z * z;
        y -= Math.exp(-r2 * 12.5) * 0.14 * st.dimple * (1 - st.plump * 0.35);
      }

      if (st.cutOpen) {
        if (x > -0.02 && z > -0.02) {
          const pull = Math.min(1, (x + 0.02) * 3.2) * Math.min(1, (z + 0.02) * 3.2);
          x -= x * 0.55 * pull;
          z -= z * 0.55 * pull;
          y -= 0.08 * pull;
        }
      }

      pos.setXYZ(i, x, y, z);
    }

    pos.needsUpdate = true;
    this.pattyGeo.computeVertexNormals();
  }

  _buildStoveAndSkillet() {
    this.stoveGroup = new THREE.Group();
    this.stoveGroup.position.set(-1.42, 0.0, 0.12);
    this.root.add(this.stoveGroup);

    const bodyMat = makeSoft3DMaterial({
      color: 0xf6ebd8,
      roughness: 0.45,
      emissive: 0x382412,
      emissiveIntensity: 0.08
    });
    const ironMat = makeSoft3DMaterial({
      color: 0x383230,
      roughness: 0.48,
      metalness: 0.25,
      emissive: 0x1a1210,
      emissiveIntensity: 0.12
    });

    const stoveBox = new THREE.Mesh(
      new RoundedBoxGeometry(1.48, 0.19, 1.30, 3, 0.05),
      bodyMat
    );
    stoveBox.position.y = 0.095;
    stoveBox.castShadow = true;
    stoveBox.receiveShadow = true;
    stoveBox.userData.hitKind = 'skillet';
    addPencilOutline(stoveBox, 0.016, 0x5c4030, 0.45);
    this.stoveGroup.add(stoveBox);

    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.082, 0.06, 16),
      makeSoft3DMaterial({ color: 0xe36255, roughness: 0.45 })
    );
    knob.rotation.x = Math.PI * 0.5;
    knob.position.set(0.46, 0.10, 0.66);
    knob.raycast = () => {};
    this.stoveGroup.add(knob);

    // Outer burner flame ring positioned OUTSIDE/BELOW skillet floor so it never clips inside pan!
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 0.20, 0);
    this.flameGroup.visible = false;
    this.stoveGroup.add(this.flameGroup);

    this.flamePetals = [];
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x58bcff, transparent: true, opacity: 0.88 });
    const flameTipMat = new THREE.MeshBasicMaterial({ color: 0xffa838, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const p = new THREE.Mesh(
        new THREE.ConeGeometry(0.048, 0.12, 8),
        i % 3 === 0 ? flameTipMat : flameMat
      );
      p.position.set(Math.cos(ang) * 0.74, 0.02, Math.sin(ang) * 0.74);
      p.rotation.z = -Math.cos(ang) * 0.85;
      p.rotation.x = Math.sin(ang) * 0.85;
      p.raycast = () => {};
      this.flameGroup.add(p);
      this.flamePetals.push(p);
    }

    // Cast-Iron Skillet
    this.skilletGroup = new THREE.Group();
    this.skilletGroup.position.set(0, 0.24, 0);
    this.stoveGroup.add(this.skilletGroup);

    const panPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.72, 0.0),
      new THREE.Vector2(0.84, 0.19),
      new THREE.Vector2(0.80, 0.21),
      new THREE.Vector2(0.69, 0.048),
      new THREE.Vector2(0.0, 0.048)
    ];
    this.panMesh = new THREE.Mesh(new THREE.LatheGeometry(panPts, 36), ironMat);
    this.panMesh.castShadow = true;
    this.panMesh.receiveShadow = true;
    this.panMesh.userData.hitKind = 'skillet';
    addPencilOutline(this.panMesh, 0.016, 0x241917, 0.5);
    this.skilletGroup.add(this.panMesh);

    const woodMat = makeSoft3DMaterial({ color: 0xb87342, roughness: 0.58 });
    const panHandle = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.54, 8, 12), woodMat);
    panHandle.rotation.z = Math.PI * 0.5 - 0.16;
    panHandle.rotation.y = -0.35;
    panHandle.position.set(-0.98, 0.20, 0.36);
    panHandle.userData.hitKind = 'skillet';
    addPencilOutline(panHandle, 0.025, 0x4a2812, 0.45);
    this.skilletGroup.add(panHandle);

    // Sunny golden foaming melted butter ring inside skillet!
    this.butterPool = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.62, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffdf72,
        transparent: true,
        opacity: 0.0
      })
    );
    this.butterPool.rotation.x = -Math.PI * 0.5;
    this.butterPool.position.y = 0.054;
    this.butterPool.raycast = () => {};
    this.skilletGroup.add(this.butterPool);

    this.butterPat = new THREE.Mesh(
      new RoundedBoxGeometry(0.22, 0.09, 0.18, 2, 0.02),
      makeSoft3DMaterial({ color: 0xffeb8c, roughness: 0.3, emissive: 0x7a5000, emissiveIntensity: 0.18 })
    );
    this.butterPat.position.set(0.22, 0.09, -0.14);
    this.butterPat.visible = false;
    this.butterPat.raycast = () => {};
    this.skilletGroup.add(this.butterPat);

    // Wooden Spatula (hidden during Stage 0 so it doesn't poke into the mixing bowl!)
    this.spatulaGroup = new THREE.Group();
    this.spatulaGroup.position.set(0.84, 0.36, 0.24);
    this.spatulaGroup.rotation.set(0.2, -0.4, 0.35);
    this.spatulaGroup.visible = false;
    this.skilletGroup.add(this.spatulaGroup);

    const blade = new THREE.Mesh(
      new RoundedBoxGeometry(0.40, 0.026, 0.42, 2, 0.01),
      makeSoft3DMaterial({ color: 0xd99b5e, roughness: 0.52 })
    );
    blade.userData.hitKind = 'spatula';
    addPencilOutline(blade, 0.025, 0x5c3418, 0.45);
    this.spatulaGroup.add(blade);

    const spatNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.044, 0.58, 10),
      woodMat
    );
    spatNeck.rotation.z = -1.05;
    spatNeck.position.set(0.40, 0.17, 0);
    spatNeck.userData.hitKind = 'spatula';
    this.spatulaGroup.add(spatNeck);

    // Copper-and-Glass Steam Dome Lid
    this.lidGroup = new THREE.Group();
    this.lidGroup.position.set(-1.18, 0.02, 0.52);
    this.lidGroup.visible = false;
    this.root.add(this.lidGroup);

    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.79, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.44),
      makeSoft3DMaterial({
        color: 0xeef8ff,
        roughness: 0.12,
        transparent: true,
        opacity: 0.46,
        clearcoat: 1.0
      })
    );
    glassDome.scale.set(1.0, 0.72, 1.0);
    glassDome.userData.hitKind = 'lid';
    this.lidGroup.add(glassDome);

    const copperMat = makeSoft3DMaterial({ color: 0xd97d48, roughness: 0.28, metalness: 0.55 });
    const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.032, 10, 32), copperMat);
    lidRim.rotation.x = Math.PI * 0.5;
    lidRim.position.y = 0.04;
    lidRim.userData.hitKind = 'lid';
    this.lidGroup.add(lidRim);

    const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), copperMat);
    lidKnob.scale.set(1.15, 0.75, 1.15);
    lidKnob.position.y = 0.58;
    lidKnob.userData.hitKind = 'lid';
    addPencilOutline(lidKnob, 0.03, 0x5c2b14, 0.5);
    this.lidGroup.add(lidKnob);
  }

  _buildPlateAndGarnish() {
    this.plateGroup = new THREE.Group();
    this.plateGroup.position.set(1.42, 0.0, 0.26);
    this.root.add(this.plateGroup);

    const matMesh = new THREE.Mesh(
      new RoundedBoxGeometry(1.86, 0.02, 1.46, 2, 0.01),
      makeSoft3DMaterial({ color: 0xffffff, map: this.ginghamTex, roughness: 0.85 })
    );
    matMesh.position.y = 0.01;
    matMesh.receiveShadow = true;
    matMesh.raycast = () => {};
    this.plateGroup.add(matMesh);

    const platePts = [
      new THREE.Vector2(0.0, 0.02),
      new THREE.Vector2(0.64, 0.02),
      new THREE.Vector2(0.92, 0.11),
      new THREE.Vector2(0.95, 0.14),
      new THREE.Vector2(0.88, 0.15),
      new THREE.Vector2(0.60, 0.065),
      new THREE.Vector2(0.0, 0.065)
    ];
    this.plateMesh = new THREE.Mesh(
      new THREE.LatheGeometry(platePts, 40),
      makeSoft3DMaterial({
        color: 0xfffdf9,
        roughness: 0.20,
        clearcoat: 0.8,
        emissive: 0x3b2c1e,
        emissiveIntensity: 0.06
      })
    );
    this.plateMesh.castShadow = true;
    this.plateMesh.receiveShadow = true;
    this.plateMesh.userData.hitKind = 'plate';
    addPencilOutline(this.plateMesh, 0.015, 0x7a5b47, 0.42);
    this.plateGroup.add(this.plateMesh);

    const goldRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.89, 0.012, 8, 40),
      makeSoft3DMaterial({ color: 0xe8b45a, roughness: 0.35, metalness: 0.3 })
    );
    goldRim.rotation.x = Math.PI * 0.5;
    goldRim.position.y = 0.145;
    goldRim.raycast = () => {};
    this.plateGroup.add(goldRim);

    // Broccoli
    this.broccoli = new THREE.Group();
    this.broccoli.position.set(-0.56, 0.13, -0.34);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 0.16, 10),
      makeSoft3DMaterial({ color: 0x8fd16a, roughness: 0.65 })
    );
    stem.rotation.z = 0.25;
    this.broccoli.add(stem);
    const floretMat = makeSoft3DMaterial({ color: 0x3b9e4b, roughness: 0.72 });
    [
      [0, 0.11, 0, 0.12],
      [-0.08, 0.08, 0.06, 0.095],
      [0.09, 0.08, 0.05, 0.095],
      [0.0, 0.08, -0.08, 0.095]
    ].forEach(([bx, by, bz, br]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(br, 14, 12), floretMat);
      puff.position.set(bx, by, bz);
      puff.userData.hitKind = 'veggie_broccoli';
      addPencilOutline(puff, 0.03, 0x1d5226, 0.45);
      this.broccoli.add(puff);
    });
    this.plateGroup.add(this.broccoli);

    // Glazed Carrot
    this.carrot = new THREE.Group();
    this.carrot.position.set(0.56, 0.11, -0.32);
    const carrotMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.065, 18),
      makeSoft3DMaterial({
        color: 0xff7830,
        roughness: 0.26,
        clearcoat: 0.7,
        emissive: 0x6e2200,
        emissiveIntensity: 0.12
      })
    );
    carrotMesh.userData.hitKind = 'veggie_carrot';
    addPencilOutline(carrotMesh, 0.03, 0x6e2808, 0.45);
    this.carrot.add(carrotMesh);
    this.plateGroup.add(this.carrot);

    // Cherry Tomato
    this.tomato = new THREE.Group();
    this.tomato.position.set(-0.62, 0.16, 0.06);
    const tomBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 18, 14),
      makeSoft3DMaterial({ color: 0xeb3b38, roughness: 0.16, clearcoat: 0.9 })
    );
    tomBody.raycast = () => {};
    addPencilOutline(tomBody, 0.03, 0x6b1412, 0.45);
    this.tomato.add(tomBody);
    const calyx = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.04, 5), floretMat);
    calyx.position.y = 0.12;
    calyx.raycast = () => {};
    this.tomato.add(calyx);
    this.plateGroup.add(this.tomato);
  }

  _buildToppingsSaucer() {
    this.toppingsGroup = new THREE.Group();
    this.toppingsGroup.position.set(-1.18, 0.0, 0.56);
    this.toppingsGroup.visible = false;
    this.root.add(this.toppingsGroup);

    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.40, 0.06, 28),
      makeSoft3DMaterial({ color: 0xfff9ee, roughness: 0.3 })
    );
    saucer.position.y = 0.03;
    saucer.raycast = () => {};
    addPencilOutline(saucer, 0.02, 0x7a5b47, 0.42);
    this.toppingsGroup.add(saucer);

    this.cheeseToken = new THREE.Mesh(
      new RoundedBoxGeometry(0.36, 0.045, 0.36, 2, 0.015),
      makeSoft3DMaterial({ color: 0xffbe3b, roughness: 0.3, clearcoat: 0.5 })
    );
    this.cheeseToken.position.set(-0.14, 0.08, 0.10);
    this.cheeseToken.rotation.y = 0.35;
    this.cheeseToken.userData.hitKind = 'topping_cheese';
    addPencilOutline(this.cheeseToken, 0.03, 0x7a4408, 0.48);
    this.toppingsGroup.add(this.cheeseToken);

    this.eggToken = this._createSunnyEggMesh();
    this.eggToken.scale.setScalar(0.68);
    this.eggToken.position.set(0.16, 0.10, -0.10);
    this.eggToken.traverse((c) => {
      if (c.isMesh) {
        c.raycast = THREE.Mesh.prototype.raycast;
        c.userData.hitKind = 'topping_egg';
      }
    });
    this.toppingsGroup.add(this.eggToken);
  }

  _buildSaucePitcher() {
    this.pitcherGroup = new THREE.Group();
    this.pitcherGroup.position.set(1.12, 0.48, 0.62);
    this.pitcherGroup.visible = false;
    this.root.add(this.pitcherGroup);

    const ceramicMat = makeSoft3DMaterial({
      color: 0xfff5e4,
      roughness: 0.28,
      clearcoat: 0.7
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.17, 0.28, 22),
      ceramicMat
    );
    body.scale.set(1.22, 1.0, 0.90);
    body.userData.hitKind = 'pitcher';
    addPencilOutline(body, 0.024, 0x6b4632, 0.48);
    this.pitcherGroup.add(body);

    // Clean curved lip spout pointing left (-X)
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.10, 0.16, 14),
      ceramicMat
    );
    spout.rotation.z = Math.PI * 0.34;
    spout.position.set(-0.26, 0.10, 0);
    spout.userData.hitKind = 'pitcher';
    this.pitcherGroup.add(spout);

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.03, 10, 18, Math.PI * 1.25),
      ceramicMat
    );
    handle.rotation.z = -Math.PI * 0.6;
    handle.position.set(0.25, 0.02, 0);
    handle.userData.hitKind = 'pitcher';
    this.pitcherGroup.add(handle);

    const innerSauce = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.16, 0.04, 18),
      makeSoft3DMaterial({ color: 0x541b09, roughness: 0.1, clearcoat: 1.0 })
    );
    innerSauce.scale.set(1.18, 1, 0.86);
    innerSauce.position.y = 0.11;
    innerSauce.raycast = () => {};
    this.pitcherGroup.add(innerSauce);

    this.sauceStream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.062, 1.0, 14),
      makeSoft3DMaterial({
        color: 0x5c1f0c,
        roughness: 0.08,
        clearcoat: 1.0,
        emissive: 0x2e0b02,
        emissiveIntensity: 0.18
      })
    );
    this.sauceStream.visible = false;
    this.sauceStream.raycast = () => {};
    this.root.add(this.sauceStream);
  }

  _buildFork() {
    this.forkGroup = new THREE.Group();
    this.forkGroup.position.set(0.95, 0.25, 0.65);
    this.forkGroup.visible = false;
    this.root.add(this.forkGroup);

    const silverMat = makeSoft3DMaterial({ color: 0xeef2f7, roughness: 0.22, metalness: 0.72 });
    const handleMat = makeSoft3DMaterial({ color: 0xe86b5d, roughness: 0.45 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.38, 10), silverMat);
    shaft.rotation.x = Math.PI * 0.5;
    shaft.position.z = 0.16;
    shaft.userData.hitKind = 'fork';
    this.forkGroup.add(shaft);

    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.30, 8, 12), handleMat);
    grip.rotation.x = Math.PI * 0.5;
    grip.position.z = 0.46;
    grip.userData.hitKind = 'fork';
    addPencilOutline(grip, 0.03, 0x6b221a, 0.48);
    this.forkGroup.add(grip);

    [-0.045, 0, 0.045].forEach((tx) => {
      const tine = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.14, 6, 8), silverMat);
      tine.rotation.x = Math.PI * 0.5;
      tine.position.set(tx, 0, -0.08);
      tine.userData.hitKind = 'fork';
      this.forkGroup.add(tine);
    });

    this.forkBiteGroup = new THREE.Group();
    this.forkBiteGroup.position.set(0, 0.05, -0.10);
    this.forkBiteGroup.visible = false;
    this.forkGroup.add(this.forkBiteGroup);

    this.biteMeatMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.16, 0.22, 3, 0.05),
      makeSoft3DMaterial({ color: 0x75351a, roughness: 0.35, clearcoat: 0.6 })
    );
    this.biteMeatMesh.userData.hitKind = 'fork';
    addPencilOutline(this.biteMeatMesh, 0.03, 0x3d180a, 0.5);
    this.forkBiteGroup.add(this.biteMeatMesh);

    this.biteSauceCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 10),
      makeSoft3DMaterial({ color: 0x541b0a, roughness: 0.1, clearcoat: 1.0 })
    );
    this.biteSauceCap.scale.set(1.1, 0.45, 1.0);
    this.biteSauceCap.position.y = 0.08;
    this.biteSauceCap.raycast = () => {};
    this.forkBiteGroup.add(this.biteSauceCap);
  }

  _buildKeepsakeTray() {
    this.keepsakesGroup = new THREE.Group();
    this.keepsakesGroup.position.set(1.55, 0.02, -0.58);
    this.root.add(this.keepsakesGroup);
    this.keepsakeCount = 0;
  }

  addKeepsake({ hasCheese = false, hasEgg = false } = {}) {
    if (this.keepsakeCount >= 6) return;
    const idx = this.keepsakeCount++;
    const mini = new THREE.Group();
    const col = idx % 3;
    const row = (idx / 3) | 0;
    mini.position.set((col - 1) * 0.34, 0, row * 0.32);

    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.03, 18),
      makeSoft3DMaterial({ color: 0xfffdf8, roughness: 0.25 })
    );
    dish.raycast = () => {};
    mini.add(dish);

    const steak = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 14, 10),
      makeSoft3DMaterial({ color: 0x692b14, roughness: 0.25, clearcoat: 0.8 })
    );
    steak.scale.set(1.15, 0.62, 0.95);
    steak.position.y = 0.05;
    steak.raycast = () => {};
    mini.add(steak);

    if (hasCheese) {
      const ch = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.02, 0.11),
        makeSoft3DMaterial({ color: 0xffbe3b, roughness: 0.3 })
      );
      ch.position.y = 0.095;
      ch.rotation.y = 0.4;
      ch.raycast = () => {};
      mini.add(ch);
    }
    if (hasEgg) {
      const eg = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8),
        makeSoft3DMaterial({ color: 0xff9d14, roughness: 0.15, clearcoat: 1.0 })
      );
      eg.position.y = hasCheese ? 0.12 : 0.10;
      eg.raycast = () => {};
      mini.add(eg);
    }

    mini.scale.setScalar(0.01);
    this.keepsakesGroup.add(mini);
    mini.userData.popScale = 0.01;
  }

  updateAnimations(dt) {
    this.time += dt;

    const st = this.pattyState;
    const springF = -st.squash * 115.0 - st.squashVel * 11.5;
    st.squashVel += springF * dt;
    st.squash += st.squashVel * dt;
    st.indentStrength = Math.max(0, st.indentStrength - dt * 3.2);

    if (this.rawIngredients.visible && !this.yolkPopped) {
      this.eggYolk.scale.x = 1.05 + Math.sin(this.time * 5.2) * 0.045;
      this.eggYolk.scale.z = 1.05 - Math.sin(this.time * 5.2) * 0.045;
      this.eggYolk.position.y = 0.09 + Math.abs(Math.sin(this.time * 2.6)) * 0.012;
    }

    if (this.flameGroup.visible) {
      for (let i = 0; i < this.flamePetals.length; i++) {
        const p = this.flamePetals[i];
        p.scale.y = 0.82 + Math.sin(this.time * 24 + i * 1.7) * 0.25;
      }
    }

    for (let i = 0; i < this.airBubbles.length; i++) {
      const b = this.airBubbles[i];
      if (b.mesh.visible && !b.popped) {
        const s = 0.23 + Math.sin(this.time * 6.0 + i * 1.3) * 0.03;
        b.mesh.scale.setScalar(s);
      }
    }

    this.keepsakesGroup.children.forEach((mini) => {
      if (mini.userData.popScale < 1.0) {
        mini.userData.popScale = Math.min(1.0, mini.userData.popScale + dt * 4.2);
        mini.scale.setScalar(mini.userData.popScale);
      }
    });
  }
}
