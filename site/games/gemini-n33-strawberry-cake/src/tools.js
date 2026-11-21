import * as THREE from 'three';
import {
  createStrawberryTexture,
  createPipingBagTexture,
  createCandleTexture
} from './textures.js';
import { createStrawberryMesh, CREAM_COLORS, CANDLE_STRIPES } from './cake.js';

// Physical 3D diegetic toys on the patisserie counter (Zero 2D HUD menus!)
// Active stage's tool hops big into the foreground; future/past tools rest politely aside and jiggle when poked.

export class ToolsManager {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.redBerryTex = createStrawberryTexture(false);
    this.pearlBerryTex = createStrawberryTexture(true);
    this.pipingTex = createPipingBagTexture();
    this.candleTextures = CANDLE_STRIPES.map((hex) => createCandleTexture(hex));

    this.isPortrait = false;
    this.stage = 'cream'; // cream | berry | pipe | candle | blow | eat
    this.activeCreamColor = 0;

    // Track wobble springs for each tool station
    this.wobbles = {
      creamStation: 0,
      berryTray: 0,
      pipingStation: 0,
      candleHolder: 0,
      replayBell: 0
    };

    // Active floating held objects (dragged by player's finger!)
    this.isHoldingSpatula = false;
    this.spatulaLoaded = true;
    this.isHoldingBerry = false;
    this.holdingPearl = false;
    this.isHoldingBag = false;
    this.isSqueezingBag = false;
    this.isHoldingCandle = false;
    this.heldCandleIndex = 0;
    this.isHoldingSlice = false;

    this._buildCreamStation();
    this._buildBerryTray();
    this._buildPipingStation();
    this._buildCandleHolder();
    this._buildCelebrationTools();
    this._buildDraggedProxies();

    this.setStage('cream', true);
  }

  _buildCreamStation() {
    this.creamStation = new THREE.Group();
    this.creamStation.userData.station = 'creamStation';

    // Chunky pastel mint scalloped bowl
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xb7f0dc, roughness: 0.24, metalness: 0.06 });
    const bowlPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.45, 0.0),
      new THREE.Vector2(0.68, 0.22),
      new THREE.Vector2(0.75, 0.56),
      new THREE.Vector2(0.67, 0.56),
      new THREE.Vector2(0.58, 0.22),
      new THREE.Vector2(0.0, 0.16)
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 24), bowlMat);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    bowl.userData.interact = 'cream-bowl';
    this.creamStation.add(bowl);

    // Rim stripe
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.71, 0.055, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xffb3cf, roughness: 0.26 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.56;
    rim.userData.interact = 'cream-bowl';
    this.creamStation.add(rim);

    // Big overflowing glossy whipped cream cloud inside bowl!
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.24 });
    const mainMound = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), creamMat);
    mainMound.scale.set(1.0, 0.55, 1.0);
    mainMound.position.y = 0.50;
    mainMound.userData.interact = 'cream-bowl';
    this.creamStation.add(mainMound);

    const swirlPeak = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 14), creamMat);
    swirlPeak.position.set(-0.08, 0.85, -0.05);
    swirlPeak.rotation.z = 0.25;
    swirlPeak.userData.interact = 'cream-bowl';
    this.creamStation.add(swirlPeak);

    // Chunky Pastel Toy Spatula (resting inside the bowl, ready to grab!)
    this.spatula = this._makeSpatulaMesh();
    this.spatulaRestLocal = new THREE.Vector3(0.28, 0.72, 0.16);
    this.spatula.position.copy(this.spatulaRestLocal);
    this.spatula.rotation.set(0.35, -0.4, -0.68);
    this.creamStation.add(this.spatula);

    this.root.add(this.creamStation);
  }

  _makeSpatulaMesh() {
    const g = new THREE.Group();
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xff9ec5, roughness: 0.26, metalness: 0.05 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xffe48f, roughness: 0.22, metalness: 0.2 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.15, metalness: 0.55 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.24 });

    // Chunky rounded pastel handle
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.58, 8, 14), handleMat);
    handle.position.y = 0.36;
    handle.castShadow = true;
    handle.userData.interact = 'spatula';
    g.add(handle);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.09, 14), collarMat);
    collar.position.y = 0.02;
    collar.userData.interact = 'spatula';
    g.add(collar);

    // Wide rounded pastel palette blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.045), bladeMat);
    blade.position.y = -0.34;
    blade.castShadow = true;
    blade.userData.interact = 'spatula';
    g.add(blade);

    const bladeTip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.045, 14), bladeMat);
    bladeTip.rotation.x = Math.PI / 2;
    bladeTip.position.y = -0.65;
    bladeTip.userData.interact = 'spatula';
    g.add(bladeTip);

    // Generous glossy dollop of whipped cream right on the blade!
    const dollop = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), creamMat);
    dollop.scale.set(1.05, 1.35, 0.72);
    dollop.position.set(0, -0.52, 0.07);
    dollop.userData.interact = 'spatula';
    g.add(dollop);
    g.userData.dollop = dollop;

    return g;
  }

  _buildBerryTray() {
    this.berryTray = new THREE.Group();
    this.berryTray.userData.station = 'berryTray';

    // Pastel butter-yellow scalloped ceramic tray
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffe9a3, roughness: 0.25, metalness: 0.05 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.72, 0.14, 24), plateMat);
    plate.position.y = 0.07;
    plate.castShadow = true;
    plate.receiveShadow = true;
    plate.userData.interact = 'berry-tray';
    this.berryTray.add(plate);

    // Cute scalloped pearls around edge
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.28 });
    const scGeo = new THREE.SphereGeometry(0.08, 10, 8);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = new THREE.Mesh(scGeo, edgeMat);
      p.position.set(Math.cos(a) * 0.84, 0.12, Math.sin(a) * 0.84);
      this.berryTray.add(p);
    }

    // Pile of plump shiny red strawberries + 1 magical pastel-pink pearl strawberry!
    this.trayBerries = [];
    const layout = [
      [0, 0.15, 0.0, true], // Pearl pink strawberry nestled brightly!
      [-0.36, 0.14, 0.22, false],
      [0.36, 0.14, 0.22, false],
      [-0.38, 0.14, -0.24, false],
      [0.38, 0.14, -0.24, false],
      [0.0, 0.14, 0.44, false],
      [0.0, 0.14, -0.44, false]
    ];
    layout.forEach(([x, y, z, isPearl]) => {
      const b = createStrawberryMesh(this.redBerryTex, this.pearlBerryTex, isPearl);
      b.position.set(x, y, z);
      b.rotation.y = Math.random() * Math.PI * 2;
      b.scale.setScalar(1.08);
      b.traverse((ch) => {
        if (ch.isMesh) {
          ch.userData.interact = isPearl ? 'tray-pearl-berry' : 'tray-berry';
        }
      });
      this.berryTray.add(b);
      this.trayBerries.push(b);
    });

    this.root.add(this.berryTray);
  }

  _buildPipingStation() {
    this.pipingStation = new THREE.Group();
    this.pipingStation.userData.station = 'pipingStation';

    // Cute pastel lavender cup holding the piping bag upright!
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xdcc6ff, roughness: 0.26, metalness: 0.05 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.72, 20), cupMat);
    cup.position.y = 0.36;
    cup.castShadow = true;
    cup.receiveShadow = true;
    cup.userData.interact = 'piping-bag';
    this.pipingStation.add(cup);

    // Plump candy-striped piping bag with star nozzle!
    this.pipingBag = this._makePipingBagMesh();
    this.pipingBagRestLocal = new THREE.Vector3(0, 0.85, 0);
    this.pipingBag.position.copy(this.pipingBagRestLocal);
    this.pipingBag.rotation.set(0.18, 0, -0.22);
    this.pipingStation.add(this.pipingBag);

    // 3 adorable mini pastel cream color pots right in front of the piping cup!
    // Tapping a pot dips the bag & switches cream color (Vanilla / Strawberry Pink / Mint)!
    this.colorPots = [];
    const potGeo = new THREE.CylinderGeometry(0.23, 0.19, 0.24, 16);
    const potCreamGeo = new THREE.SphereGeometry(0.21, 14, 10);
    CREAM_COLORS.forEach((c, idx) => {
      const pot = new THREE.Group();
      pot.position.set((idx - 1) * 0.56, 0, 0.68);
      const base = new THREE.Mesh(
        potGeo,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28 })
      );
      base.position.y = 0.12;
      base.castShadow = true;
      base.userData.interact = `cream-pot-${idx}`;
      pot.add(base);

      const scoop = new THREE.Mesh(
        potCreamGeo,
        new THREE.MeshStandardMaterial({ color: c.hex, roughness: 0.22 })
      );
      scoop.scale.set(1, 0.65, 1);
      scoop.position.y = 0.25;
      scoop.userData.interact = `cream-pot-${idx}`;
      pot.add(scoop);

      // Selection ring glow
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.032, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0xff8fbc, roughness: 0.25 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.03;
      ring.visible = idx === 0;
      pot.add(ring);

      pot.userData.ring = ring;
      pot.userData.colorIndex = idx;
      this.pipingStation.add(pot);
      this.colorPots.push(pot);
    });

    this.root.add(this.pipingStation);
  }

  _makePipingBagMesh() {
    const g = new THREE.Group();
    const bagMat = new THREE.MeshStandardMaterial({
      map: this.pipingTex,
      roughness: 0.34,
      metalness: 0.03
    });
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0xeff4fa,
      roughness: 0.16,
      metalness: 0.65
    });
    const tipCreamMat = new THREE.MeshStandardMaterial({
      color: CREAM_COLORS[0].hex,
      roughness: 0.22
    });
    this.pipingTipCreamMat = tipCreamMat;

    // Plump cone bag pointing tip-down at y = -0.58
    const pts = [
      new THREE.Vector2(0.06, -0.42),
      new THREE.Vector2(0.22, -0.1),
      new THREE.Vector2(0.36, 0.26),
      new THREE.Vector2(0.30, 0.56),
      new THREE.Vector2(0.11, 0.72),
      new THREE.Vector2(0.18, 0.86),
      new THREE.Vector2(0.0, 0.86)
    ];
    const bagMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), bagMat);
    bagMesh.castShadow = true;
    bagMesh.userData.interact = 'piping-bag';
    g.add(bagMesh);

    // Cute pastel ribbon tie around top neck
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.045, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xff7eab, roughness: 0.28 })
    );
    tie.rotation.x = Math.PI / 2;
    tie.position.y = 0.70;
    tie.userData.interact = 'piping-bag';
    g.add(tie);

    // Shiny star-tip metal nozzle
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.045, 0.24, 12), nozzleMat);
    nozzle.position.y = -0.52;
    nozzle.userData.interact = 'piping-bag';
    g.add(nozzle);

    // Peek of colored cream right at the star tip!
    const tipPeek = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), tipCreamMat);
    tipPeek.position.y = -0.64;
    tipPeek.userData.interact = 'piping-bag';
    g.add(tipPeek);

    g.userData.bagMesh = bagMesh;
    return g;
  }

  _buildCandleHolder() {
    this.candleHolder = new THREE.Group();
    this.candleHolder.userData.station = 'candleHolder';

    // Cute pastel star tray base
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xffc7de, roughness: 0.25, metalness: 0.06 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.68, 0.16, 20), trayMat);
    base.position.y = 0.08;
    base.castShadow = true;
    base.receiveShadow = true;
    base.userData.interact = 'candle-holder';
    this.candleHolder.add(base);

    // 5 chunky pastel-striped birthday candles standing in the holder!
    this.trayCandles = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const r = 0.38;
      const cg = new THREE.Group();
      cg.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r);

      const wax = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.08, 0.72, 14),
        new THREE.MeshStandardMaterial({ map: this.candleTextures[i], roughness: 0.28 })
      );
      wax.position.y = 0.36;
      wax.castShadow = true;
      wax.userData.interact = `tray-candle-${i}`;
      cg.add(wax);

      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.09, 6),
        new THREE.MeshBasicMaterial({ color: 0x4a353b })
      );
      wick.position.y = 0.76;
      cg.add(wick);

      cg.userData.used = false;
      cg.userData.candleIndex = i;
      this.candleHolder.add(cg);
      this.trayCandles.push(cg);
    }

    this.root.add(this.candleHolder);
  }

  // Stage 5: Pastel Cake Server Fork + Wordless Replay Sponge-Cloche Bell!
  _buildCelebrationTools() {
    // 1. Shiny pastel cake server / fork resting beside a scalloped dessert plate
    this.serverStation = new THREE.Group();
    this.serverStation.visible = false;

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.56, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xd9f7ee, roughness: 0.24 })
    );
    plate.position.y = 0.05;
    plate.receiveShadow = true;
    plate.userData.interact = 'cake-server';
    this.serverStation.add(plate);

    const serverGroup = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.48, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0xffa6c9, roughness: 0.26 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.35, 0.2, 0.1);
    handle.userData.interact = 'cake-server';
    serverGroup.add(handle);

    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.52, 4),
      new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.14, metalness: 0.6 })
    );
    blade.scale.set(1.0, 1.0, 0.18);
    blade.rotation.z = Math.PI / 2;
    blade.position.set(-0.18, 0.2, 0.1);
    blade.userData.interact = 'cake-server';
    serverGroup.add(blade);

    this.serverGroup = serverGroup;
    this.serverStation.add(serverGroup);
    this.root.add(this.serverStation);

    // 2. Wordless Replay Bell Cloche (glass-like pastel dome with a tiny bouncing golden sponge cake inside!)
    this.replayBell = new THREE.Group();
    this.replayBell.visible = false;

    const bellBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.6, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0xffe494, roughness: 0.25, metalness: 0.12 })
    );
    bellBase.position.y = 0.06;
    bellBase.castShadow = true;
    bellBase.userData.interact = 'replay-bell';
    this.replayBell.add(bellBase);

    // Tiny golden sponge cake icon inside (pure picture — zero text!)
    this.miniSponge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.29, 0.26, 16),
      new THREE.MeshStandardMaterial({ color: 0xf9cf74, roughness: 0.45 })
    );
    this.miniSponge.position.y = 0.26;
    this.miniSponge.userData.interact = 'replay-bell';
    this.replayBell.add(this.miniSponge);

    const miniJam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.285, 0.285, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0xff8ab5, roughness: 0.3 })
    );
    miniJam.position.y = 0.26;
    this.replayBell.add(miniJam);

    // Translucent glossy cloche dome + pink pearl handle on top
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.38
      })
    );
    dome.position.y = 0.12;
    dome.userData.interact = 'replay-bell';
    this.replayBell.add(dome);

    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xff8ab5, roughness: 0.22 })
    );
    knob.position.y = 0.65;
    knob.userData.interact = 'replay-bell';
    this.replayBell.add(knob);

    this.root.add(this.replayBell);
  }

  // Proxies held smoothly under the child's finger while dragging!
  _buildDraggedProxies() {
    this.heldSpatula = this._makeSpatulaMesh();
    this.heldSpatula.visible = false;
    this.heldSpatula.scale.setScalar(1.12);
    this.scene.add(this.heldSpatula);

    this.heldRedBerry = createStrawberryMesh(this.redBerryTex, this.pearlBerryTex, false);
    this.heldRedBerry.visible = false;
    this.heldRedBerry.scale.setScalar(1.22);
    this.scene.add(this.heldRedBerry);

    this.heldPearlBerry = createStrawberryMesh(this.redBerryTex, this.pearlBerryTex, true);
    this.heldPearlBerry.visible = false;
    this.heldPearlBerry.scale.setScalar(1.25);
    this.scene.add(this.heldPearlBerry);

    this.heldPipingBag = this._makePipingBagMesh();
    this.heldPipingBag.visible = false;
    this.heldPipingBag.scale.setScalar(1.1);
    this.scene.add(this.heldPipingBag);

    this.heldCandle = new THREE.Group();
    this.heldCandleWax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.08, 0.74, 14),
      new THREE.MeshStandardMaterial({ map: this.candleTextures[0], roughness: 0.28 })
    );
    this.heldCandleWax.position.y = 0.37;
    this.heldCandle.add(this.heldCandleWax);
    this.heldCandle.visible = false;
    this.scene.add(this.heldCandle);

    this.heldSliceContainer = new THREE.Group();
    this.heldSliceContainer.visible = false;
    this.scene.add(this.heldSliceContainer);
  }

  setCreamColor(idx) {
    this.activeCreamColor = idx % CREAM_COLORS.length;
    const hex = CREAM_COLORS[this.activeCreamColor].hex;
    // Update tip color on both resting and held piping bags
    this.pipingBag.traverse((ch) => {
      if (ch.isMesh && ch.position.y < -0.58) ch.material.color.setHex(hex);
    });
    this.heldPipingBag.traverse((ch) => {
      if (ch.isMesh && ch.position.y < -0.58) ch.material.color.setHex(hex);
    });
    this.colorPots.forEach((p, i) => {
      p.userData.ring.visible = i === this.activeCreamColor;
    });
    this.wobbles.pipingStation = 0.85;
  }

  setLayout(isPortrait) {
    this.isPortrait = isPortrait;
    this._computeTargets();
  }

  setStage(stage, instant = false) {
    this.stage = stage;
    this.serverStation.visible = stage === 'eat';
    this.replayBell.visible = stage === 'eat';
    // Hide empty candle holder cleanly once all 5 candles are on the cake
    this.candleHolder.visible = stage !== 'blow' && stage !== 'eat';
    this._computeTargets();
    if (instant) {
      this._snapToTargets();
    }
  }

  _computeTargets() {
    // Active tool pops big & prominently into the Hero Zone — 100% INSIDE frame on both 4:3 & mobile portrait!
    const p = this.isPortrait;

    const activePos = p ? new THREE.Vector3(0.0, 0.0, 2.22) : new THREE.Vector3(2.02, 0.0, 0.92);
    const leftBack = p ? new THREE.Vector3(-1.45, 0.0, -0.75) : new THREE.Vector3(-2.22, 0.0, 0.25);
    const rightBack = p ? new THREE.Vector3(1.45, 0.0, -0.75) : new THREE.Vector3(2.22, 0.0, -0.95);
    const farLeft = p ? new THREE.Vector3(-1.55, 0.0, 0.55) : new THREE.Vector3(-2.35, 0.0, -1.05);
    const farRight = p ? new THREE.Vector3(1.55, 0.0, 0.55) : new THREE.Vector3(2.45, 0.0, 0.08);

    this.targets = {
      creamStation: { pos: leftBack.clone(), scale: 0.72 },
      berryTray: { pos: rightBack.clone(), scale: 0.70 },
      pipingStation: { pos: farLeft.clone(), scale: 0.66 },
      candleHolder: { pos: farRight.clone(), scale: 0.68 },
      serverStation: { pos: p ? new THREE.Vector3(0.65, 0.0, 2.2) : new THREE.Vector3(1.98, 0.0, 0.98), scale: 1.02 },
      replayBell: { pos: p ? new THREE.Vector3(-0.95, 0.0, 2.18) : new THREE.Vector3(-2.05, 0.0, 0.98), scale: 1.02 }
    };

    if (this.stage === 'cream') {
      this.targets.creamStation = { pos: activePos.clone(), scale: p ? 0.98 : 1.04 };
    } else if (this.stage === 'berry') {
      this.targets.berryTray = { pos: activePos.clone(), scale: p ? 0.98 : 1.04 };
    } else if (this.stage === 'pipe') {
      this.targets.pipingStation = { pos: p ? new THREE.Vector3(0.0, 0.0, 2.08) : new THREE.Vector3(2.02, 0.0, 0.65), scale: p ? 0.92 : 0.96 };
    } else if (this.stage === 'candle') {
      this.targets.candleHolder = { pos: activePos.clone(), scale: p ? 0.98 : 1.04 };
    }
  }

  _snapToTargets() {
    const map = [
      ['creamStation', this.creamStation],
      ['berryTray', this.berryTray],
      ['pipingStation', this.pipingStation],
      ['candleHolder', this.candleHolder],
      ['serverStation', this.serverStation],
      ['replayBell', this.replayBell]
    ];
    for (const [k, obj] of map) {
      obj.position.copy(this.targets[k].pos);
      obj.scale.setScalar(this.targets[k].scale);
    }
  }

  pokeStation(key) {
    if (this.wobbles[key] !== undefined) {
      this.wobbles[key] = 1.0;
    }
  }

  getActiveStationWorldPos() {
    if (this.stage === 'cream') return this.creamStation.position.clone().add(new THREE.Vector3(0, 0.85, 0));
    if (this.stage === 'berry') return this.berryTray.position.clone().add(new THREE.Vector3(0, 0.45, 0));
    if (this.stage === 'pipe') return this.pipingStation.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    if (this.stage === 'candle') return this.candleHolder.position.clone().add(new THREE.Vector3(0, 0.7, 0));
    if (this.stage === 'eat') return new THREE.Vector3(0, 1.5, 0);
    return new THREE.Vector3(0, 1.6, 0);
  }

  // --- HELD TOOL HELPERS ---
  pickUpSpatula(pos) {
    this.isHoldingSpatula = true;
    this.spatula.visible = false;
    this.heldSpatula.visible = true;
    this.moveHeldSpatula(pos);
  }

  moveHeldSpatula(pos, velX = 0) {
    this.heldSpatula.position.set(pos.x + 0.25, pos.y + 0.45, pos.z + 0.15);
    this.heldSpatula.rotation.set(0.35, -0.2, -0.78 + THREE.MathUtils.clamp(velX * 0.6, -0.35, 0.35));
  }

  releaseSpatula() {
    this.isHoldingSpatula = false;
    this.heldSpatula.visible = false;
    this.spatula.visible = true;
  }

  pickUpBerry(pos, isPearl = false) {
    this.isHoldingBerry = true;
    this.holdingPearl = isPearl;
    this.heldRedBerry.visible = !isPearl;
    this.heldPearlBerry.visible = isPearl;
    this.moveHeldBerry(pos);
  }

  moveHeldBerry(pos) {
    const target = this.holdingPearl ? this.heldPearlBerry : this.heldRedBerry;
    target.position.set(pos.x, pos.y + 0.22, pos.z);
  }

  releaseBerry() {
    this.isHoldingBerry = false;
    this.heldRedBerry.visible = false;
    this.heldPearlBerry.visible = false;
  }

  pickUpPipingBag(pos) {
    this.isHoldingBag = true;
    this.pipingBag.visible = false;
    this.heldPipingBag.visible = true;
    this.moveHeldPipingBag(pos, false);
  }

  moveHeldPipingBag(pos, squeezing = false) {
    this.isSqueezingBag = squeezing;
    this.heldPipingBag.position.set(pos.x + 0.12, pos.y + 0.76, pos.z + 0.08);
    this.heldPipingBag.rotation.set(0.18, 0, -0.22);
  }

  releasePipingBag() {
    this.isHoldingBag = false;
    this.isSqueezingBag = false;
    this.heldPipingBag.visible = false;
    this.pipingBag.visible = true;
  }

  getNextUnusedCandleIndex() {
    for (const c of this.trayCandles) {
      if (!c.userData.used) return c.userData.candleIndex;
    }
    return -1;
  }

  pickUpCandle(index, pos) {
    if (index < 0 || index >= this.trayCandles.length) return false;
    this.isHoldingCandle = true;
    this.heldCandleIndex = index;
    this.trayCandles[index].visible = false;
    this.heldCandleWax.material.map = this.candleTextures[index];
    this.heldCandleWax.material.needsUpdate = true;
    this.heldCandle.visible = true;
    this.moveHeldCandle(pos);
    return true;
  }

  moveHeldCandle(pos) {
    this.heldCandle.position.set(pos.x, pos.y + 0.12, pos.z);
  }

  consumeHeldCandle() {
    if (this.heldCandleIndex >= 0 && this.heldCandleIndex < this.trayCandles.length) {
      this.trayCandles[this.heldCandleIndex].userData.used = true;
      this.trayCandles[this.heldCandleIndex].visible = false;
    }
    this.isHoldingCandle = false;
    this.heldCandle.visible = false;
  }

  cancelHeldCandle() {
    if (this.heldCandleIndex >= 0 && this.heldCandleIndex < this.trayCandles.length) {
      if (!this.trayCandles[this.heldCandleIndex].userData.used) {
        this.trayCandles[this.heldCandleIndex].visible = true;
      }
    }
    this.isHoldingCandle = false;
    this.heldCandle.visible = false;
  }

  pickUpCakeSlice(sliceMesh, pos) {
    while (this.heldSliceContainer.children.length > 0) {
      this.heldSliceContainer.remove(this.heldSliceContainer.children[0]);
    }
    this.heldSliceContainer.add(sliceMesh);
    this.heldSliceContainer.visible = true;
    this.heldSliceContainer.position.copy(pos);
    this.isHoldingSlice = true;
  }

  moveHeldCakeSlice(pos) {
    this.heldSliceContainer.position.lerp(pos, 0.45);
  }

  releaseCakeSlice() {
    this.isHoldingSlice = false;
    this.heldSliceContainer.visible = false;
    while (this.heldSliceContainer.children.length > 0) {
      this.heldSliceContainer.remove(this.heldSliceContainer.children[0]);
    }
  }

  resetAll() {
    this.releaseSpatula();
    this.releaseBerry();
    this.releasePipingBag();
    this.releaseCakeSlice();
    this.isHoldingCandle = false;
    this.heldCandle.visible = false;
    for (const c of this.trayCandles) {
      c.userData.used = false;
      c.visible = true;
    }
    this.setCreamColor(0);
    this.setStage('cream', false);
  }

  update(dt, time) {
    const stations = [
      ['creamStation', this.creamStation, this.stage === 'cream'],
      ['berryTray', this.berryTray, this.stage === 'berry'],
      ['pipingStation', this.pipingStation, this.stage === 'pipe'],
      ['candleHolder', this.candleHolder, this.stage === 'candle'],
      ['serverStation', this.serverStation, this.stage === 'eat'],
      ['replayBell', this.replayBell, false]
    ];

    for (const [key, obj, isActive] of stations) {
      const target = this.targets[key];
      obj.position.lerp(target.pos, Math.min(1, dt * 6.5));

      // Gentle inviting bob ONLY on the current active stage tool!
      const bobY = isActive ? Math.abs(Math.sin(time * 2.8)) * 0.08 : 0;
      obj.position.y = bobY;

      // Playful jelly wobble when poked!
      let w = this.wobbles[key] || 0;
      if (w > 0.005) {
        w = Math.max(0, w - dt * 2.6);
        this.wobbles[key] = w;
        const j = Math.sin(w * 24) * w * 0.16;
        obj.scale.set(target.scale * (1 + j), target.scale * (1 - j), target.scale * (1 + j));
      } else {
        const s = THREE.MathUtils.lerp(obj.scale.x, target.scale, Math.min(1, dt * 7));
        obj.scale.setScalar(s);
      }
    }

    // Spatula idle rock inside cream bowl
    if (this.spatula.visible && this.stage === 'cream') {
      this.spatula.rotation.z = -0.68 + Math.sin(time * 3.0) * 0.08;
    }

    // Piping bag squeeze squish feedback!
    if (this.isHoldingBag) {
      const bagMesh = this.heldPipingBag.userData.bagMesh;
      const sx = this.isSqueezingBag ? 0.78 + Math.sin(time * 18) * 0.04 : 1.0;
      const sy = this.isSqueezingBag ? 1.12 : 1.0;
      bagMesh.scale.lerp(new THREE.Vector3(sx, sy, sx), Math.min(1, dt * 14));
    }

    // Mini replay sponge bounce inside glass bell cloche
    if (this.replayBell.visible) {
      this.miniSponge.position.y = 0.26 + Math.abs(Math.sin(time * 3.2)) * 0.06;
      this.miniSponge.rotation.y = time * 0.8;
    }
  }
}
