// Photorealistic Sunlit Kitchen Stage, Glass Mixing Bowl, Cracking 3D Eggs, Mix-ins,
// Hammered Copper Makiyakinabe Pan on Gas Burner, Hinoki Board & Lacquered Bento Box with Instanced Rice

import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import {
  createBowlLiquidPainter,
  createCounterStoneTextures,
  createEggShellPainter,
  createHammeredCopperTextures,
  createHinokiWoodTextures,
  createKeyakiWoodTexture,
  createSeasonedPanTextures,
  createSpiralCutTexture,
  createStrawberryTextures,
  createSubwayTileTextures,
} from './textures.js';
import { BoardTamagoyakiSlices, PanTamagoyakiMesh } from './tamagoyaki.js';

export class KitchenStage {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.interactables = [];
    this.wobbleProps = [];
    this.time = 0;

    this._buildEnvironmentGeometry();
    this._buildEggTrayAndCracker();
    this._buildGlassBowl();
    this._buildMixInRamekins();
    this._buildStoveAndCopperPan();
    this._buildCuttingBoard();
    this._buildBentoBoxAndGarnishes();
    this._buildMemoryServingTray();
  }

  _registerWobble(obj, kind = 'wood') {
    const item = { obj, kind, vel: 0, angle: 0, baseY: obj.position.y };
    this.wobbleProps.push(item);
    obj.traverse((c) => {
      if (c.isMesh && !c.userData.kind) {
        c.userData.kind = 'propWobble';
        c.userData.wobbleItem = item;
      }
    });
    return item;
  }

  pokeProp(item, strength = 1) {
    if (!item) return;
    item.vel += 0.26 * strength;
  }

  _buildEnvironmentGeometry() {
    // Honed warm limestone/marble kitchen countertop (top at y = 0)
    const stoneTex = createCounterStoneTextures();
    const counterMat = new THREE.MeshPhysicalMaterial({
      map: stoneTex.map,
      bumpMap: stoneTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.35,
    });
    const counterGeo = new RoundedBoxGeometry(6.8, 0.36, 3.6, 3, 0.04);
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.set(0, -0.18, 0.15);
    counter.receiveShadow = true;
    this.root.add(counter);

    // Warm oak front apron trim along counter front
    const oakTex = createKeyakiWoodTexture(false);
    const oakMat = new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.55 });
    const frontTrim = new THREE.Mesh(new BoxGeoHelper(6.8, 0.6, 0.12), oakMat);
    frontTrim.position.set(0, -0.62, 1.88);
    this.root.add(frontTrim);

    // Sunlit Kitchen Background Wall (glazed ivory ceramic subway tiles behind girl + sunlit window on left)
    const tileTex = createSubwayTileTextures();
    const wallMat = new THREE.MeshPhysicalMaterial({
      map: tileTex.map,
      bumpMap: tileTex.bumpMap,
      bumpScale: 0.012,
      roughness: 0.24,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.4), wallMat);
    backWall.position.set(0, 1.55, -2.55);
    backWall.receiveShadow = true;
    this.root.add(backWall);

    // Warm oak shelf on back wall with ceramic canisters & potted herb for photographic kitchen depth
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(3.8, 0.07, 0.34, 2, 0.015), oakMat);
    shelf.position.set(0.85, 1.82, -2.36);
    shelf.castShadow = true;
    this.root.add(shelf);

    const creamCeramic = new THREE.MeshPhysicalMaterial({
      color: 0xf6f0e4,
      roughness: 0.18,
      clearcoat: 0.85,
    });
    const sageCeramic = new THREE.MeshPhysicalMaterial({
      color: 0x9ab09a,
      roughness: 0.22,
      clearcoat: 0.8,
    });
    [
      { x: 1.55, r: 0.11, h: 0.24, m: creamCeramic },
      { x: 1.85, r: 0.095, h: 0.19, m: sageCeramic },
    ].forEach((jar) => {
      const jm = new THREE.Mesh(new THREE.CylinderGeometry(jar.r, jar.r * 0.94, jar.h, 18), jar.m);
      jm.position.set(jar.x, 1.855 + jar.h * 0.5, -2.35);
      jm.castShadow = true;
      this.root.add(jm);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(jar.r * 0.98, jar.r * 0.98, 0.035, 18), oakMat);
      lid.position.set(jar.x, 1.855 + jar.h + 0.018, -2.35);
      this.root.add(lid);
    });

    // Bright morning sunlit window glow panel on upper-left back wall
    const windowFrame = new THREE.Group();
    windowFrame.position.set(-2.15, 1.72, -2.50);
    this.root.add(windowFrame);

    const skyMat = new THREE.MeshBasicMaterial({ color: 0xfff8e6 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.65), skyMat);
    windowFrame.add(pane);

    // Soft blurred garden greenery outside window
    const leafOutMat = new THREE.MeshBasicMaterial({ color: 0x9cc47c, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 6; i++) {
      const blob = new THREE.Mesh(new THREE.CircleGeometry(0.24 + (i % 3) * 0.08, 16), leafOutMat);
      blob.position.set(-0.48 + i * 0.2, -0.42 + (i % 2) * 0.22, 0.01);
      windowFrame.add(blob);
    }

    // Oak window mullions
    const frameBars = [
      [0, 0.84, 1.65, 0.08],
      [0, -0.84, 1.65, 0.09],
      [-0.79, 0, 0.08, 1.74],
      [0.79, 0, 0.08, 1.74],
      [0, 0, 1.60, 0.045],
      [0, 0, 0.045, 1.68],
    ];
    frameBars.forEach(([bx, by, bw, bh]) => {
      const bar = new THREE.Mesh(new RoundedBoxGeometry(bw, bh, 0.07, 2, 0.01), oakMat);
      bar.position.set(bx, by, 0.03);
      windowFrame.add(bar);
    });
  }

  // Realistic ovoid 3D egg geometry (slightly pointed top, round bottom)
  _createOvoidEggGeometry(radius = 0.145, heightScale = 1.32, half = null) {
    const thetaStart = half === 'top' ? 0 : (half === 'bottom' ? Math.PI * 0.5 : 0);
    const thetaLen = half ? Math.PI * 0.5 : Math.PI;
    const geo = new THREE.SphereGeometry(radius, 26, 20, 0, Math.PI * 2, thetaStart, thetaLen);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const ny = y / radius; // -1..+1
      // Narrow slightly toward top (+Y), plump toward bottom (-Y)
      const taper = 1 - ny * 0.13 - ny * ny * 0.04;
      pos.setX(i, pos.getX(i) * taper);
      pos.setZ(i, pos.getZ(i) * taper);
      pos.setY(i, y * heightScale);
    }
    geo.computeVertexNormals();
    return geo;
  }

  _buildEggTrayAndCracker() {
    this.eggTrayGroup = new THREE.Group();
    this.eggTrayGroup.position.set(-1.14, 0.0, 0.46);
    this.root.add(this.eggTrayGroup);

    // Glazed cream ceramic 3-cup egg crate
    const trayMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7f2e8,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
    });
    const trayBase = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.085, 0.88, 4, 0.035), trayMat);
    trayBase.position.set(0, 0.042, 0);
    trayBase.castShadow = true;
    trayBase.receiveShadow = true;
    this.eggTrayGroup.add(trayBase);

    this.eggs = [];
    const offsets = [
      new THREE.Vector3(0.06, 0.20, 0.25),  // Closest foreground egg!
      new THREE.Vector3(-0.05, 0.20, -0.02),
      new THREE.Vector3(0.05, 0.20, -0.28),
    ];

    offsets.forEach((off, idx) => {
      // Cup dimple ring
      const cup = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.024, 10, 20), trayMat);
      cup.rotation.x = Math.PI * 0.5;
      cup.position.set(off.x, 0.086, off.z);
      this.eggTrayGroup.add(cup);

      const painter = createEggShellPainter(idx);
      const eggMat = new THREE.MeshPhysicalMaterial({
        map: painter.map,
        bumpMap: painter.bumpMap,
        bumpScale: 0.006,
        roughness: 0.40,
        clearcoat: 0.16,
        clearcoatRoughness: 0.35,
      });

      const eggGeo = this._createOvoidEggGeometry(0.145, 1.32, null);
      const mesh = new THREE.Mesh(eggGeo, eggMat);
      mesh.position.copy(off);
      mesh.rotation.z = idx === 0 ? -0.16 : (idx === 1 ? 0.1 : -0.08);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.kind = 'egg';
      mesh.userData.eggIndex = idx;

      // Invisible generous hit-sphere so 5-year-old one-finger taps never miss!
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      mesh.add(hit);
      hit.userData.kind = 'egg';
      hit.userData.eggIndex = idx;

      this.eggTrayGroup.add(mesh);
      this.interactables.push(mesh, hit);

      this.eggs.push({
        index: idx,
        mesh,
        painter,
        homePos: off.clone(),
        crackedCount: 0,
        used: false,
        wobble: 0,
      });
    });

    // Dedicated 3D Two-Half Cracking Egg + Stretching Yolk/Albumen Rig over the Bowl!
    this.crackRig = new THREE.Group();
    this.crackRig.visible = false;
    this.root.add(this.crackRig);

    const crackPainter = createEggShellPainter(0);
    const shellOuterMat = new THREE.MeshPhysicalMaterial({
      map: crackPainter.map,
      bumpMap: crackPainter.bumpMap,
      bumpScale: 0.006,
      roughness: 0.4,
      clearcoat: 0.16,
      side: THREE.DoubleSide,
    });
    this.crackShellTop = new THREE.Mesh(this._createOvoidEggGeometry(0.15, 1.3, 'top'), shellOuterMat);
    this.crackShellBot = new THREE.Mesh(this._createOvoidEggGeometry(0.15, 1.3, 'bottom'), shellOuterMat);
    this.crackShellTop.castShadow = true;
    this.crackShellBot.castShadow = true;
    // Rotate horizontally so the two shell halves part left & right ("Paka!")!
    this.crackShellTop.rotation.z = Math.PI * 0.5;
    this.crackShellBot.rotation.z = Math.PI * 0.5;
    this.crackRig.add(this.crackShellTop, this.crackShellBot);

    // Falling plump 3D yolk + glossy stretching albumen column
    const yolkMat = new THREE.MeshPhysicalMaterial({
      color: 0xff8c10,
      emissive: 0x3b1500,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    this.fallingYolk = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 18), yolkMat);
    this.fallingYolk.scale.set(1.05, 0.88, 1.05);

    const albumenMat = new THREE.MeshPhysicalMaterial({
      color: 0xfefaf0,
      transparent: true,
      opacity: 0.62,
      roughness: 0.06,
      clearcoat: 1.0,
    });
    this.fallingAlbumen = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.085, 0.28, 14), albumenMat);
    this.fallingYolk.add(this.fallingAlbumen);
    this.fallingAlbumen.position.set(0, 0.12, 0);
    this.crackRig.add(this.fallingYolk);
  }

  _buildGlassBowl() {
    this.bowlHomePos = new THREE.Vector3(-0.38, 0.0, 0.58);
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.copy(this.bowlHomePos);
    this.bowlGroup.scale.setScalar(0.88);
    this.root.add(this.bowlGroup);

    // Thick Crystal-Clear Heatproof Glass Bowl (Lathe profile with rounded lip!)
    const pts = [
      new THREE.Vector2(0.0, 0.015),
      new THREE.Vector2(0.24, 0.015),
      new THREE.Vector2(0.36, 0.075),
      new THREE.Vector2(0.45, 0.195),
      new THREE.Vector2(0.485, 0.325),
      new THREE.Vector2(0.498, 0.342),
      new THREE.Vector2(0.472, 0.348),
      new THREE.Vector2(0.435, 0.320),
      new THREE.Vector2(0.398, 0.195),
      new THREE.Vector2(0.312, 0.082),
      new THREE.Vector2(0.21, 0.038),
      new THREE.Vector2(0.0, 0.038),
    ];
    const bowlGeo = new THREE.LatheGeometry(pts, 40);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6fbff,
      transparent: true,
      opacity: 0.34,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.5,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
    });
    this.bowlMesh = new THREE.Mesh(bowlGeo, glassMat);
    this.bowlMesh.renderOrder = 6;
    this.bowlMesh.userData.kind = 'bowl';
    this.bowlGroup.add(this.bowlMesh);

    // Specular rim torus so the bowl lip gleams crisply where eggs knock ("Kon-kon!")
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.52,
      roughness: 0.04,
      clearcoat: 1.0,
      depthWrite: false,
    });
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.484, 0.016, 12, 44), rimMat);
    rimMesh.rotation.x = Math.PI * 0.5;
    rimMesh.position.y = 0.338;
    rimMesh.renderOrder = 7;
    this.bowlGroup.add(rimMesh);

    // Generous hit cylinder for stirring & tapping the bowl
    const bowlHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.42, 0.42, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bowlHit.position.y = 0.21;
    bowlHit.userData.kind = 'bowl';
    this.bowlGroup.add(bowlHit);
    this.interactables.push(bowlHit);

    // Dynamic Egg Liquid Surface + 3D Floating Yolks inside Bowl!
    this.liquidPainter = createBowlLiquidPainter();
    this.liquidGroup = new THREE.Group();
    this.liquidGroup.position.set(0, 0.12, 0);
    this.liquidGroup.visible = false;
    this.bowlGroup.add(this.liquidGroup);

    // Subdivided disc so stirring creates a real 3D concave vortex & ripple!
    const liqGeo = new THREE.CircleGeometry(0.39, 36, 0, Math.PI * 2);
    liqGeo.rotateX(-Math.PI * 0.5);
    this.liquidMat = new THREE.MeshPhysicalMaterial({
      map: this.liquidPainter.texture,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.94,
    });
    this.liquidDisc = new THREE.Mesh(liqGeo, this.liquidMat);
    this.liquidDisc.renderOrder = 4;
    this.liquidGroup.add(this.liquidDisc);

    // Up to 3 plump glossy 3D orange egg yolks floating in the bowl before whisking dissolves them!
    this.bowlYolks = [];
    const yolkMat = new THREE.MeshPhysicalMaterial({
      color: 0xff880c,
      emissive: 0x3d1400,
      emissiveIntensity: 0.22,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    });
    for (let i = 0; i < 3; i++) {
      const yMesh = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 18), yolkMat);
      yMesh.scale.set(1.12, 0.62, 1.12);
      yMesh.visible = false;
      yMesh.renderOrder = 5;
      this.liquidGroup.add(yMesh);
      this.bowlYolks.push(yMesh);
    }

    // Resting pair of wooden Saibashi chopsticks neatly along the bowl rim (zero overlap with bento!)
    const woodTex = createKeyakiWoodTexture(false);
    const stickMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.45 });
    this.restingChopsticks = new THREE.Group();
    this.restingChopsticks.position.set(-0.04, 0.362, -0.18);
    this.restingChopsticks.rotation.y = 0.28;
    [-0.022, 0.022].forEach((zOff, i) => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.015, 0.72, 10), stickMat);
      st.rotation.z = Math.PI * 0.5 - 0.04;
      st.position.set(0.0, 0, zOff + i * 0.008);
      st.castShadow = true;
      this.restingChopsticks.add(st);
    });
    this.bowlGroup.add(this.restingChopsticks);
  }

  _buildMixInRamekins() {
    // 3 Cute Glazed Ceramic Ramekins in a neat row at Back-Left: Cheese, Green Negi, Golden Honey!
    this.mixInGroup = new THREE.Group();
    this.mixInGroup.position.set(-0.96, 0.0, -0.26);
    this.root.add(this.mixInGroup);

    const woodTex = createKeyakiWoodTexture(false);
    const tray = new THREE.Mesh(
      new RoundedBoxGeometry(0.96, 0.035, 0.34, 3, 0.015),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 })
    );
    tray.position.y = 0.018;
    tray.receiveShadow = true;
    this.mixInGroup.add(tray);

    const ramekinMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf8f2,
      roughness: 0.16,
      clearcoat: 0.88,
    });

    this.mixInDishes = {};
    const specs = [
      { key: 'cheese', x: -0.31, color: 0xffdf6b },
      { key: 'negi', x: 0.0, color: 0x459c39 },
      { key: 'honey', x: 0.31, color: 0xeb9612 },
    ];

    specs.forEach((sp) => {
      const dish = new THREE.Group();
      dish.position.set(sp.x, 0.035, 0);
      this.mixInGroup.add(dish);

      const cupPts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.105, 0),
        new THREE.Vector2(0.132, 0.095),
        new THREE.Vector2(0.118, 0.098),
        new THREE.Vector2(0.095, 0.018),
        new THREE.Vector2(0, 0.018),
      ];
      const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 22), ramekinMat);
      cup.castShadow = true;
      dish.add(cup);

      const contents = new THREE.Group();
      dish.add(contents);

      if (sp.key === 'cheese') {
        const chMat = new THREE.MeshPhysicalMaterial({ color: 0xffe26e, roughness: 0.28, clearcoat: 0.35 });
        for (let i = 0; i < 14; i++) {
          const cube = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.036, 0.042, 2, 0.008), chMat);
          const a = (i / 14) * Math.PI * 2;
          const r = (i % 3) * 0.032;
          cube.position.set(Math.cos(a) * r, 0.058 + (i % 2) * 0.025, Math.sin(a) * r);
          cube.rotation.set(i * 0.4, i * 0.7, 0);
          contents.add(cube);
        }
      } else if (sp.key === 'negi') {
        const ngMat = new THREE.MeshStandardMaterial({ color: 0x3f9634, roughness: 0.42 });
        for (let i = 0; i < 18; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 6, 12), ngMat);
          const a = (i / 18) * Math.PI * 2;
          const r = (i % 3) * 0.032;
          ring.position.set(Math.cos(a) * r, 0.06 + (i % 3) * 0.016, Math.sin(a) * r);
          ring.rotation.set(Math.PI * 0.4 + i * 0.2, i * 0.5, 0);
          contents.add(ring);
        }
      } else {
        // Glossy amber honey pool + miniature wooden honey dipper!
        const hMat = new THREE.MeshPhysicalMaterial({
          color: 0xeb8f0c,
          roughness: 0.05,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.92,
        });
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.05, 20), hMat);
        pool.position.y = 0.055;
        contents.add(pool);

        const dipper = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, 0.22, 8),
          new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.45 })
        );
        dipper.position.set(0.04, 0.12, -0.02);
        dipper.rotation.z = -0.55;
        contents.add(dipper);
      }

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.08;
      hit.userData.kind = 'mixIn';
      hit.userData.mixKey = sp.key;
      dish.add(hit);
      this.interactables.push(hit);

      this.mixInDishes[sp.key] = { dish, contents, bounce: 0 };
    });
  }

  _buildStoveAndCopperPan() {
    this.stoveHomePos = new THREE.Vector3(0.68, 0.0, -0.44);
    this.stoveGroup = new THREE.Group();
    this.stoveGroup.position.copy(this.stoveHomePos);
    this.stoveGroup.scale.setScalar(0.84);
    this.root.add(this.stoveGroup);

    // Sleek matte warm-ivory & brushed stainless tabletop gas cassette stove ("Konro")
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xebe4d8,
      roughness: 0.30,
      metalness: 0.15,
      clearcoat: 0.5,
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x262423,
      roughness: 0.52,
      metalness: 0.65,
    });

    const stoveBase = new THREE.Mesh(new RoundedBoxGeometry(1.76, 0.13, 1.32, 4, 0.035), bodyMat);
    stoveBase.position.y = 0.065;
    stoveBase.castShadow = true;
    stoveBase.receiveShadow = true;
    this.stoveGroup.add(stoveBase);

    // Cast-iron burner trivet ("Gotoku")
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.022, 8, 28), darkIronMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.145;
    this.stoveGroup.add(ring);

    for (let i = 0; i < 4; i++) {
      const prong = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.032, 0.032, 2, 0.006), darkIronMat);
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      prong.rotation.y = a;
      prong.position.set(Math.cos(a) * 0.34, 0.155, Math.sin(a) * 0.34);
      this.stoveGroup.add(prong);
    }

    // Dynamic 3D Blue-Orange Gas Flame Ring!
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.y = 0.142;
    this.stoveGroup.add(this.flameGroup);
    this.flames = [];
    const flameBlueMat = new THREE.MeshBasicMaterial({
      color: 0x4da6ff,
      transparent: true,
      opacity: 0.82,
    });
    const flameTipMat = new THREE.MeshBasicMaterial({
      color: 0xff9d3b,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.075, 7), i % 4 === 0 ? flameTipMat : flameBlueMat);
      cone.position.set(Math.cos(a) * 0.28, 0.02, Math.sin(a) * 0.28);
      cone.rotation.z = -Math.cos(a) * 0.45;
      cone.rotation.x = Math.sin(a) * 0.45;
      this.flameGroup.add(cone);
      this.flames.push({ mesh: cone, phase: i * 0.7 });
    }
    this.heatLevel = 1.0; // 0.65 (gentle), 1.0 (medium), 1.45 (high sear!)

    // Tactile Front Rotary Flame Dial (zero numbers/text — intuitive size/glow feedback!)
    this.flameKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.064, 0.048, 20),
      darkIronMat
    );
    this.flameKnob.rotation.x = Math.PI * 0.5;
    this.flameKnob.position.set(0.62, 0.072, 0.67);
    this.flameKnob.userData.kind = 'flameKnob';
    this.stoveGroup.add(this.flameKnob);

    const knobBar = new THREE.Mesh(
      new RoundedBoxGeometry(0.018, 0.055, 0.024, 2, 0.004),
      new THREE.MeshStandardMaterial({ color: 0xe86c3a, roughness: 0.3 })
    );
    knobBar.position.set(0, 0.026, 0.015);
    this.flameKnob.add(knobBar);

    const knobHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    knobHit.userData.kind = 'flameKnob';
    this.flameKnob.add(knobHit);
    this.interactables.push(this.flameKnob, knobHit);

    // White Porcelain Oil Cup & Cotton Oil Dabber ("Abura-hiki") right next to stove
    this.oilCupGroup = new THREE.Group();
    this.oilCupGroup.position.set(-1.05, 0.0, -0.35);
    this.stoveGroup.add(this.oilCupGroup);

    const porcMat = new THREE.MeshPhysicalMaterial({ color: 0xf9f6f0, roughness: 0.15, clearcoat: 0.9 });
    const oilCup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.13, 20), porcMat);
    oilCup.position.y = 0.065;
    oilCup.castShadow = true;
    this.oilCupGroup.add(oilCup);

    this.oilBrush = new THREE.Group();
    this.oilBrush.position.set(0, 0.12, 0);
    const brushHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.13, 14), porcMat);
    brushHandle.position.y = 0.06;
    const cotton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0xfcf2d4, roughness: 0.8 })
    );
    this.oilBrush.add(brushHandle, cotton);
    this.oilCupGroup.add(this.oilBrush);

    const oilHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    oilHit.position.y = 0.11;
    oilHit.userData.kind = 'oilBrush';
    this.oilCupGroup.add(oilHit);
    this.interactables.push(oilHit);

    // Artisan Hammered Copper Rectangular Tamagoyaki Pan ("Makiyakinabe")!
    this.panPivot = new THREE.Group();
    this.panPivot.position.set(0, 0.175, 0);
    this.stoveGroup.add(this.panPivot);

    const copperTex = createHammeredCopperTextures();
    const copperMat = new THREE.MeshPhysicalMaterial({
      map: copperTex.map,
      bumpMap: copperTex.bumpMap,
      bumpScale: 0.015,
      metalness: 0.86,
      roughness: 0.24,
      clearcoat: 0.25,
    });

    this.panSeasonTex = createSeasonedPanTextures();
    this.panInnerMat = new THREE.MeshPhysicalMaterial({
      map: this.panSeasonTex.map,
      bumpMap: this.panSeasonTex.bumpMap,
      bumpScale: 0.008,
      metalness: 0.48,
      roughness: 0.22,
      clearcoat: 0.72,
      clearcoatRoughness: 0.14,
    });

    // Pan interior floor: 1.60 x 1.10
    const floorMesh = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.028, 1.12, 3, 0.01), this.panInnerMat);
    floorMesh.position.y = 0.014;
    floorMesh.receiveShadow = true;
    floorMesh.castShadow = true;
    this.panPivot.add(floorMesh);

    const copperUnder = new THREE.Mesh(new RoundedBoxGeometry(1.65, 0.016, 1.15, 2, 0.006), copperMat);
    copperUnder.position.y = 0.002;
    this.panPivot.add(copperUnder);

    // 4 Sloped Rectangular Pan Walls (outer hammered copper, inner seasoned iron!)
    const wallH = 0.135;
    const walls = [
      { pos: [0, wallH * 0.5, -0.565], size: [1.68, wallH, 0.042], rot: [0.12, 0, 0] },
      { pos: [0, wallH * 0.5, 0.565], size: [1.68, wallH, 0.042], rot: [-0.12, 0, 0] },
      { pos: [-0.825, wallH * 0.5, 0], size: [0.042, wallH, 1.16], rot: [0, 0, -0.18] },
      { pos: [0.825, wallH * 0.5, 0], size: [0.042, wallH, 1.16], rot: [0, 0, 0.14] },
    ];
    walls.forEach((w) => {
      const wm = new THREE.Mesh(new RoundedBoxGeometry(w.size[0], w.size[1], w.size[2], 3, 0.012), copperMat);
      wm.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wm.rotation.set(w.rot[0], w.rot[1], w.rot[2]);
      wm.castShadow = true;
      wm.receiveShadow = true;
      this.panPivot.add(wm);
    });

    // Brass ferrule + turned Keyaki wooden handle extending to the right-front (+X, +Z)
    const brassMat = new THREE.MeshPhysicalMaterial({ color: 0xd8b25c, metalness: 0.88, roughness: 0.22 });
    const handleGroup = new THREE.Group();
    handleGroup.position.set(0.84, 0.095, 0.0);
    handleGroup.rotation.z = 0.22;
    this.panPivot.add(handleGroup);

    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.14, 16), brassMat);
    ferrule.rotation.z = -Math.PI * 0.5;
    ferrule.position.x = 0.07;
    handleGroup.add(ferrule);

    const woodTex = createKeyakiWoodTexture(false);
    const pHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.038, 0.62, 18),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.45 })
    );
    pHandle.rotation.z = -Math.PI * 0.5;
    pHandle.position.x = 0.42;
    pHandle.castShadow = true;
    handleGroup.add(pHandle);

    // Hit box over entire pan for pouring, rolling & poking
    const panHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.34, 1.32),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    panHit.position.y = 0.14;
    panHit.userData.kind = 'pan';
    this.panPivot.add(panHit);
    this.interactables.push(panHit);

    // Deformable Tamagoyaki Sheet & Multi-Layer Roll inside Pan!
    this.panTamago = new PanTamagoyakiMesh();
    this.panTamago.group.position.y = 0.026;
    this.panPivot.add(this.panTamago.group);
  }

  _buildCuttingBoard() {
    this.boardHomePos = new THREE.Vector3(-1.35, 0.0, -0.82);
    this.boardGroup = new THREE.Group();
    this.boardGroup.position.copy(this.boardHomePos);
    this.boardGroup.scale.setScalar(0.78);
    this.root.add(this.boardGroup);

    const hinokiTex = createHinokiWoodTextures();
    const boardMat = new THREE.MeshPhysicalMaterial({
      map: hinokiTex.map,
      bumpMap: hinokiTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.54,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
    });

    const slab = new THREE.Mesh(new RoundedBoxGeometry(1.92, 0.095, 1.12, 4, 0.025), boardMat);
    slab.position.y = 0.048;
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.userData.kind = 'board';
    this.boardGroup.add(slab);

    const boardHit = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.55, 1.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    boardHit.position.y = 0.24;
    boardHit.userData.kind = 'board';
    this.boardGroup.add(boardHit);
    this.interactables.push(slab, boardHit);

    // Resting chef knife along back edge of board when not held by hand
    this.restingKnife = new THREE.Group();
    this.restingKnife.position.set(0.15, 0.105, -0.42);
    this.restingKnife.rotation.y = Math.PI * 0.5;
    const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xe6eaee, metalness: 0.92, roughness: 0.14 });
    const kBlade = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.09, 0.54, 2, 0.003), steelMat);
    kBlade.rotation.z = Math.PI * 0.5;
    const kHandle = new THREE.Mesh(
      new RoundedBoxGeometry(0.04, 0.055, 0.28, 2, 0.012),
      new THREE.MeshStandardMaterial({ map: createKeyakiWoodTexture(true), roughness: 0.5 })
    );
    kHandle.position.z = 0.40;
    this.restingKnife.add(kBlade, kHandle);
    this.boardGroup.add(this.restingKnife);

    // Anchor on top surface of board (`y = 0.096`) where plump tamagoyaki log & slices live!
    this.boardTopAnchor = new THREE.Group();
    this.boardTopAnchor.position.set(0, 0.096, 0.04);
    this.boardGroup.add(this.boardTopAnchor);

    this.boardSlices = new BoardTamagoyakiSlices(this.boardTopAnchor);
  }

  _buildBentoBoxAndGarnishes() {
    // Open Vermilion & Dark Tamenuri Lacquered Bento Box — Visible completely on the counter from Frame 0!
    this.bentoHomePos = new THREE.Vector3(0.68, 0.0, 0.56);
    this.bentoGroup = new THREE.Group();
    this.bentoGroup.position.copy(this.bentoHomePos);
    this.bentoGroup.rotation.y = -0.10;
    this.bentoGroup.scale.setScalar(0.84);
    this.root.add(this.bentoGroup);

    const outerLacquer = new THREE.MeshPhysicalMaterial({
      color: 0x26120f,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const innerVermilion = new THREE.MeshPhysicalMaterial({
      color: 0xb8291e,
      roughness: 0.16,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
    });

    const bw = 1.24, bd = 0.92, bh = 0.22, wall = 0.055;
    const bottom = new THREE.Mesh(new RoundedBoxGeometry(bw, 0.045, bd, 3, 0.015), innerVermilion);
    bottom.position.y = 0.022;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    this.bentoGroup.add(bottom);

    const boxWalls = [
      [0, bh * 0.5, -bd * 0.5 + wall * 0.5, bw, bh, wall],
      [0, bh * 0.5, bd * 0.5 - wall * 0.5, bw, bh, wall],
      [-bw * 0.5 + wall * 0.5, bh * 0.5, 0, wall, bh, bd - wall * 2],
      [bw * 0.5 - wall * 0.5, bh * 0.5, 0, wall, bh, bd - wall * 2],
    ];
    boxWalls.forEach(([x, y, z, sx, sy, sz]) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 3, 0.015), outerLacquer);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.bentoGroup.add(m);
    });

    // Inner cedar divider separating Fluffy White Rice (left) &のおかず/Tamagoyaki Space (right)!
    const divider = new THREE.Mesh(
      new RoundedBoxGeometry(0.025, bh * 0.78, bd - wall * 2.2, 2, 0.006),
      innerVermilion
    );
    divider.position.set(-0.08, bh * 0.42, 0);
    this.bentoGroup.add(divider);

    // 1. Fluffy Glossy White Japanese Rice Bed (240 Instanced 3D Rice Grains + Base Mound + Ruby Umeboshi!)
    this.riceGroup = new THREE.Group();
    this.riceGroup.position.set(-0.33, 0.045, 0);
    this.bentoGroup.add(this.riceGroup);

    const riceMat = new THREE.MeshPhysicalMaterial({
      color: 0xfcfbf7,
      roughness: 0.18,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
    const riceBase = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.11, 0.74, 4, 0.045), riceMat);
    riceBase.position.y = 0.055;
    riceBase.receiveShadow = true;
    this.riceGroup.add(riceBase);

    const grainGeo = new THREE.CapsuleGeometry(0.016, 0.028, 4, 8);
    const grainInst = new THREE.InstancedMesh(grainGeo, riceMat, 220);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 220; i++) {
      const rx = ((Math.sin(i * 73.1) * 0.5 + 0.5) - 0.5) * 0.39;
      const rz = ((Math.sin(i * 191.7) * 0.5 + 0.5) - 0.5) * 0.70;
      const crown = Math.cos(rx * 3.5) * Math.cos(rz * 2.0) * 0.022;
      dummy.position.set(rx, 0.112 + crown, rz);
      dummy.rotation.set(Math.PI * 0.5 + (i % 5 - 2) * 0.12, i * 1.1, (i % 3 - 1) * 0.15);
      dummy.updateMatrix();
      grainInst.setMatrixAt(i, dummy.matrix);
    }
    grainInst.instanceMatrix.needsUpdate = true;
    this.riceGroup.add(grainInst);

    // Glossy pickled red Umeboshi plum in center of rice + black sesame seeds
    const umeMat = new THREE.MeshPhysicalMaterial({
      color: 0xb51828,
      roughness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    const ume = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), umeMat);
    ume.scale.set(1.05, 0.62, 1.05);
    ume.position.set(0, 0.138, 0);
    this.riceGroup.add(ume);

    const sesameMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.4 });
    for (let s = 0; s < 14; s++) {
      const a = (s / 14) * Math.PI * 2;
      const r = 0.095 + (s % 3) * 0.032;
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), sesameMat);
      seed.scale.set(1.5, 0.6, 0.9);
      seed.position.set(Math.cos(a) * r * 0.85, 0.125, Math.sin(a) * r * 1.25);
      seed.rotation.y = a;
      this.riceGroup.add(seed);
    }
    this._registerWobble(this.riceGroup, 'soft');

    // 2. Top-Right Side Dish Nook: Lush Broccoli Floret & Cute Octo-Wiener!
    this.sideDishGroup = new THREE.Group();
    this.sideDishGroup.position.set(0.25, 0.055, -0.26);
    this.bentoGroup.add(this.sideDishGroup);

    const brocStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.028, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0x7cb356, roughness: 0.6 })
    );
    brocStem.position.set(-0.11, 0.05, 0);
    this.sideDishGroup.add(brocStem);

    const floretMat = new THREE.MeshStandardMaterial({ color: 0x2f7529, roughness: 0.78 });
    for (let b = 0; b < 9; b++) {
      const a = (b / 8) * Math.PI * 2;
      const rad = b === 0 ? 0 : 0.052;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), floretMat);
      f.position.set(-0.11 + Math.cos(a) * rad, 0.105 + (b === 0 ? 0.02 : 0), Math.sin(a) * rad);
      this.sideDishGroup.add(f);
    }

    // Glossy red Octo-Wiener ("Tako-san Wiener")!
    const wienerMat = new THREE.MeshPhysicalMaterial({
      color: 0xd93b2b,
      roughness: 0.24,
      clearcoat: 0.72,
    });
    const wHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.05, 8, 14), wienerMat);
    wHead.position.set(0.12, 0.11, 0.02);
    wHead.rotation.z = -0.18;
    this.sideDishGroup.add(wHead);
    for (let l = 0; l < 6; l++) {
      const la = (l / 6) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.045, 5, 8), wienerMat);
      leg.position.set(0.12 + Math.cos(la) * 0.048, 0.052, 0.02 + Math.sin(la) * 0.048);
      leg.rotation.z = Math.cos(la) * 0.5;
      leg.rotation.x = -Math.sin(la) * 0.5;
      this.sideDishGroup.add(leg);
    }
    this._registerWobble(this.sideDishGroup, 'soft');

    // 3. Vibrant Green Sasa Bamboo Leaf Lining the Open Tamagoyaki Compartment! (Goal Signifier!)
    const sasaMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b8c36,
      roughness: 0.34,
      clearcoat: 0.45,
      side: THREE.DoubleSide,
    });
    const leafGeo = new THREE.PlaneGeometry(0.58, 0.52, 8, 8);
    leafGeo.rotateX(-Math.PI * 0.5);
    const lPos = leafGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const lx = lPos.getX(i);
      const lz = lPos.getZ(i);
      lPos.setY(i, Math.pow(lz * 1.5, 2) * 0.08 + Math.sin(lx * 5) * 0.008);
    }
    leafGeo.computeVertexNormals();
    this.sasaLeaf = new THREE.Mesh(leafGeo, sasaMat);
    this.sasaLeaf.position.set(0.24, 0.052, 0.14);
    this.bentoGroup.add(this.sasaLeaf);

    // Packed Tamagoyaki Slots inside Bento Compartment
    this.bentoPackedAnchor = new THREE.Group();
    this.bentoPackedAnchor.position.set(0.24, 0.06, 0.15);
    this.bentoGroup.add(this.bentoPackedAnchor);
    this.bentoPackedCount = 0;

    // Bento drop/hit target
    const bentoHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.42, 1.04),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bentoHit.position.y = 0.16;
    bentoHit.userData.kind = 'bento';
    this.bentoGroup.add(bentoHit);
    this.interactables.push(bentoHit);

    // Side Saucer with 3 Glossy Ripe Strawberries nestled neatly at back-left of bento so it stays 100% in frame!
    this.berrySaucerGroup = new THREE.Group();
    this.berrySaucerGroup.position.set(-0.42, 0.0, -0.68);
    this.bentoGroup.add(this.berrySaucerGroup);

    const saucerMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf9f5, roughness: 0.15, clearcoat: 0.9 });
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.038, 24), saucerMat);
    saucer.position.y = 0.019;
    saucer.castShadow = true;
    this.berrySaucerGroup.add(saucer);

    const berryTex = createStrawberryTextures();
    const berryMat = new THREE.MeshPhysicalMaterial({
      map: berryTex.map,
      bumpMap: berryTex.bumpMap,
      bumpScale: 0.009,
      roughness: 0.18,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
    });
    const calyxMat = new THREE.MeshStandardMaterial({ color: 0x36882d, roughness: 0.5, side: THREE.DoubleSide });

    this.strawberries = [];
    const bOffsets = [
      new THREE.Vector3(-0.075, 0.095, 0.05),
      new THREE.Vector3(0.085, 0.095, 0.03),
      new THREE.Vector3(0.0, 0.095, -0.075),
    ];
    bOffsets.forEach((bo, idx) => {
      const bGrp = new THREE.Group();
      bGrp.position.copy(bo);

      // Heart-conical strawberry body
      const bGeo = new THREE.SphereGeometry(0.068, 18, 16);
      const bp = bGeo.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const y = bp.getY(i) / 0.068; // -1 (tip) .. +1 (crown)
        const w = y < 0 ? (1 + y * 0.58) : (1 - y * 0.15);
        bp.setX(i, bp.getX(i) * w);
        bp.setZ(i, bp.getZ(i) * w);
        bp.setY(i, bp.getY(i) * 1.22);
      }
      bGeo.computeVertexNormals();
      const berryMesh = new THREE.Mesh(bGeo, berryMat);
      berryMesh.castShadow = true;
      bGrp.add(berryMesh);

      // 5 green calyx leaves on crown
      for (let lf = 0; lf < 5; lf++) {
        const la = (lf / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.055, 4), calyxMat);
        leaf.rotation.x = Math.PI * 0.42;
        leaf.rotation.y = la;
        leaf.position.set(Math.cos(la) * 0.028, 0.078, Math.sin(la) * 0.028);
        bGrp.add(leaf);
      }

      const bHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      bHit.userData.kind = 'strawberry';
      bGrp.add(bHit);
      berryMesh.userData.kind = 'strawberry';

      const berryObj = {
        group: bGrp,
        homePos: bo.clone(),
        packed: false,
        eaten: false,
        grabbed: false,
        index: idx,
      };
      bHit.userData.berryRef = berryObj;
      berryMesh.userData.berryRef = berryObj;

      this.berrySaucerGroup.add(bGrp);
      this.interactables.push(berryMesh, bHit);
      this.strawberries.push(berryObj);
    });
  }

  _buildMemoryServingTray() {
    // Sunlit Wooden Tray on Back-Right Counter Keeping SouvenirSlices of Past Rounds!
    this.memoryTray = new THREE.Group();
    this.memoryTray.position.set(1.52, 0.0, -0.82);
    this.memoryTray.rotation.y = -0.28;
    this.root.add(this.memoryTray);

    const woodTex = createKeyakiWoodTexture(false);
    const board = new THREE.Mesh(
      new RoundedBoxGeometry(0.72, 0.03, 0.48, 3, 0.012),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5 })
    );
    board.position.y = 0.015;
    board.receiveShadow = true;
    this.memoryTray.add(board);
    this.memoryItems = [];
  }

  addCompletedMemory({ searLevel, eggCount, mixIns }) {
    const idx = this.memoryItems.length;
    if (idx >= 6) return;
    const cutTex = createSpiralCutTexture({ searLevel, eggCount, mixIns });
    const mat = new THREE.MeshPhysicalMaterial({ map: cutTex, roughness: 0.3, clearcoat: 0.4 });
    const mini = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.11, 0.14, 3, 0.025), mat);
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    mini.position.set(-0.20 + col * 0.20, 0.085, -0.09 + row * 0.18);
    mini.rotation.y = 0.25;
    mini.castShadow = true;
    this.memoryTray.add(mini);
    this.memoryItems.push(mini);
  }

  resetRoundForReplay() {
    // Reset eggs in tray
    this.eggs.forEach((e) => {
      e.used = false;
      e.crackedCount = 0;
      e.painter.reset();
      e.mesh.visible = true;
      e.mesh.position.copy(e.homePos);
      e.mesh.scale.setScalar(1);
    });

    // Reset bowl
    this.liquidGroup.visible = false;
    this.bowlYolks.forEach((y) => { y.visible = false; });
    this.restingChopsticks.visible = true;
    this.bowlGroup.position.copy(this.bowlHomePos);
    this.bowlGroup.rotation.set(0, 0, 0);

    // Clear packed items in bento & respawn strawberries
    while (this.bentoPackedAnchor.children.length > 0) {
      this.bentoPackedAnchor.remove(this.bentoPackedAnchor.children[0]);
    }
    this.bentoPackedCount = 0;

    this.strawberries.forEach((b) => {
      b.packed = false;
      b.eaten = false;
      b.grabbed = false;
      b.group.visible = true;
      this.berrySaucerGroup.add(b.group);
      b.group.position.copy(b.homePos);
      b.group.rotation.set(0, 0, 0);
      b.group.scale.setScalar(1);
    });

    // Clear board slices
    this.boardSlices.clear();
    this.restingKnife.visible = true;
  }

  // Update bowl liquid ripples, yolks & gas flame shimmer
  update(dt, { mixProgress = 0, swirlAngle = 0, eggCount = 0, mixIns = {}, swirlEnergy = 0 } = {}) {
    this.time += dt;

    // Animate gas burner blue-orange flame cones
    this.flames.forEach((f) => {
      const flicker = 0.84 + 0.18 * Math.sin(this.time * 22 + f.phase);
      const s = this.heatLevel * flicker;
      f.mesh.scale.set(0.85 + this.heatLevel * 0.2, s, 0.85 + this.heatLevel * 0.2);
    });

    // Update wobbling kitchen props
    this.wobbleProps.forEach((w) => {
      w.vel -= w.angle * 38 * dt;
      w.vel *= Math.exp(-7 * dt);
      w.angle += w.vel * dt * 12;
      w.obj.rotation.z = w.angle * 0.18;
      w.obj.position.y = w.baseY + Math.abs(w.angle) * 0.025;
    });

    // Mix-in dish bounce feedback
    Object.values(this.mixInDishes).forEach((d) => {
      if (d.bounce > 0.001) {
        d.bounce *= Math.exp(-8 * dt);
        const s = 1 + Math.sin(this.time * 25) * d.bounce * 0.16;
        d.dish.scale.set(s, 1 / s, s);
      }
    });

    // Egg wobble in tray
    this.eggs.forEach((e) => {
      if (e.wobble > 0.001) {
        e.wobble *= Math.exp(-6.5 * dt);
        e.mesh.rotation.z = (e.index === 0 ? -0.16 : 0.08) + Math.sin(this.time * 22) * e.wobble * 0.35;
      }
    });

    // Bowl liquid level, 3D yolks & dynamic vortex mesh
    if (eggCount > 0 && this.liquidGroup.visible) {
      const targetY = 0.105 + eggCount * 0.048;
      this.liquidGroup.position.y += (targetY - this.liquidGroup.position.y) * Math.min(1, dt * 8);
      const radScale = 0.82 + eggCount * 0.075;
      this.liquidGroup.scale.set(radScale, 1, radScale);

      // Vertex vortex & slosh ripple on liquidDisc
      const pos = this.liquidDisc.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z) / 0.39;
        // Concave stir vortex: dips in center, rises at outer wall!
        const vortex = swirlEnergy * (-0.032 * (1 - r * r) + 0.022 * r * r);
        const slosh = swirlEnergy * Math.sin(Math.atan2(z, x) - swirlAngle * 2.0) * r * 0.022;
        pos.setY(i, vortex + slosh);
      }
      pos.needsUpdate = true;
      this.liquidDisc.geometry.computeVertexNormals();

      // 3D floating yolks flatten and dissolve smoothly as mixProgress goes 0 -> 0.55!
      const yolkVis = Math.max(0, 1 - mixProgress * 1.85);
      for (let i = 0; i < 3; i++) {
        const ym = this.bowlYolks[i];
        if (i < eggCount && yolkVis > 0.04) {
          ym.visible = true;
          const a = swirlAngle * 0.85 + i * 2.1;
          const rr = eggCount === 1 ? 0.03 : 0.11 * (1 - mixProgress * 0.4);
          ym.position.set(Math.cos(a) * rr, 0.012 * yolkVis, Math.sin(a) * rr);
          ym.scale.set(1.12 + (1 - yolkVis) * 0.65, 0.62 * yolkVis, 1.12 + (1 - yolkVis) * 0.65);
        } else {
          ym.visible = false;
        }
      }
    }

    this.panTamago.updateGeometry(dt);
    this.boardSlices.update(dt, this.time);
  }
}

function BoxGeoHelper(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
