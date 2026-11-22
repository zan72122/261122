import * as THREE from 'three';
import { StarchFluidMap, createRiceBedTextures } from './textures.js';
import {
  createRiceGrainGeometry,
  createRiceMaterial,
  createWaterSurface,
  createKitchenEnvironment,
  createFaucet,
  createInnerPot,
  createRiceCooker,
  createServingSet,
  createShamoji,
  createRealisticHand,
  createSteamSystem,
  createSplashSystem,
  createWoodenSpoon,
} from './models.js';

export const STAGES = {
  WASH_1: 'WASH_1',
  POUR_1: 'POUR_1',
  WASH_2: 'WASH_2',
  POUR_2: 'POUR_2',
  LOAD_POT: 'LOAD_POT',
  CLOSE_LID: 'CLOSE_LID',
  PRESS_START: 'PRESS_START',
  COOKING: 'COOKING',
  OPEN_LID: 'OPEN_LID',
  FLUFF: 'FLUFF',
  SCOOP: 'SCOOP',
  SERVE: 'SERVE',
};

// World anchors (1 unit ≈ 10cm)
export const POS = {
  POT_WASH: new THREE.Vector3(-1.35, 0.0, 0.20),
  POT_POUR: new THREE.Vector3(-2.38, 0.62, 0.05),
  COOKER: new THREE.Vector3(1.55, 0.0, -0.20),
  POT_IN_COOKER: new THREE.Vector3(1.55, 0.24, -0.20),
  TRAY: new THREE.Vector3(4.35, 0.0, 0.42),
  FAUCET: new THREE.Vector3(-2.55, 0.0, -1.68),
};

export class RiceCookSimulation {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;

    this.stage = STAGES.WASH_1;
    this.time = 0;
    this.stageTime = 0;
    this.idleTime = 0;
    this.hintActive = false;
    this.hintProgress = 0;

    // Gameplay progress states
    this.washProgress = 0;
    this.turbidity = 0.03;
    this.targetTurbidity = 0.03;
    this.waterLevel = 0.78; // Local Y inside pot
    this.targetWaterLevel = 0.78;
    this.swirlSpeed = 0;
    this.swirlAngle = 0;

    // Pour / Faucet animations
    this.pourAnim = 0;
    this.pouring = false;
    this.refilling = false;
    this.refillAnim = 0;
    this.faucetUserTimer = 0;
    this.faucetFlow = 0;

    // Pot drag/transition
    this.potDragging = false;
    this.potTargetPos = POS.POT_WASH.clone();
    this.potTargetRotZ = 0;
    this.potInCooker = false;

    // Cooker lid & cook state
    this.lidAngle = 1.42; // Starts open so child sees the waiting cooker right away!
    this.targetLidAngle = 1.42;
    this.cookProgress = 0;
    this.cookDuration = 5.2;
    this.cookedBlend = 0; // 0 = raw, 1 = steamed plump cooked

    // Fluff & Scoop states
    this.fluffProgress = 0;
    this.fluffStrokes = 0;
    this.lastFluffSound = 0;
    this.scoopLoaded = false;
    this.scoopDragging = false;
    this.bowlScoops = 0; // 0..3
    this.bowlBites = 0;  // 0..5
    this.scoopDropAnim = 0;
    this.shamojiVisible = false;

    // Toppings placed
    this.hasUmeboshi = false;
    this.sesameCount = 0;
    this.noriCount = 0;
    this.spoonAnim = 0;
    this.spoonActive = false;

    // Wobble feedback map for non-active objects
    this.wobbles = new Map();

    // Hand target state
    this.handWorldPos = new THREE.Vector3(-0.65, 1.38, 0.65);
    this.handTargetPos = new THREE.Vector3(-0.65, 1.38, 0.65);
    this.handTargetRot = new THREE.Euler(0.15, -0.35, 0.05);
    this.handActive = false;
    this.handLocalInPot = new THREE.Vector2(0, 0);
    this.prevHandLocal = new THREE.Vector2(0, 0);

    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();
    this.tmpVec = new THREE.Vector3();

    this._buildScene();
    this._setupPotRice();
    this._setupBowlAndScoopRice();
    this._resetToWash1(true);
  }

  _buildScene() {
    // 1. Kitchen Counter, Stainless Sink, Ceramic Tiles, North Window
    this.kitchen = createKitchenEnvironment();
    this.scene.add(this.kitchen.group);

    // 2. Brushed Chrome Gooseneck Faucet
    this.faucet = createFaucet();
    this.faucet.group.position.copy(POS.FAUCET);
    // Point spout toward washing pot by default
    this.faucet.spoutPivot.rotation.y = 0.56;
    this.scene.add(this.faucet.group);

    // 3. Inner Pot ("内釜") + Dynamic Starch Fluid Water + Gravity-Aligned Pour Stream
    this.pot = createInnerPot();
    this.pot.group.position.copy(POS.POT_WASH);
    this.scene.add(this.pot.group);
    this.scene.add(this.pot.pourStream);

    this.starchMap = new StarchFluidMap();
    this.water = createWaterSurface(this.starchMap.texture, 0.945);
    this.water.mesh.position.y = this.waterLevel;
    this.pot.group.add(this.water.mesh);

    // 4. Modern Japanese IH Rice Cooker ("炊飯器")
    this.cooker = createRiceCooker();
    this.cooker.group.position.copy(POS.COOKER);
    this.cooker.group.rotation.y = -0.16;
    this.cooker.lidPivot.rotation.x = -this.lidAngle;
    this.scene.add(this.cooker.group);

    // 5. Serving Tray, Hand-Thrown Ceramic Bowl, Toppings, Masu Cup
    this.serving = createServingSet();
    this.serving.group.position.copy(POS.TRAY);
    this.serving.group.rotation.y = -0.14;
    this.scene.add(this.serving.group);

    // 6. Wooden Shamoji ("しゃもじ")
    this.shamoji = createShamoji();
    this.shamoji.group.position.set(2.95, 0.14, 1.38);
    this.shamoji.group.rotation.set(0, -0.45, 0);
    this.scene.add(this.shamoji.group);

    // 7. Realistic Articulated 3D Hand ("手")
    this.hand = createRealisticHand();
    this.hand.group.position.copy(this.handWorldPos);
    this.scene.add(this.hand.group);

    // 8. Volumetric Steam & Water Splash Systems
    this.steam = createSteamSystem(72);
    this.scene.add(this.steam.group);

    this.splash = createSplashSystem(44);
    this.scene.add(this.splash.mesh);

    // 9. Tasting Spoon for Serve Finale
    this.spoon = createWoodenSpoon();
    this.scene.add(this.spoon.group);
  }

  _setupPotRice() {
    this.grainGeo = createRiceGrainGeometry();
    this.potRiceMat = createRiceMaterial(0.0);
    this.riceBedTex = createRiceBedTextures(1919);

    // Textured micro-grain rice bed cushion sitting snugly inside pot walls (never pokes through!)
    const bedGeo = new THREE.CylinderGeometry(0.82, 0.56, 0.22, 36);
    this.potRiceBedMat = new THREE.MeshPhysicalMaterial({
      map: this.riceBedTex.map,
      bumpMap: this.riceBedTex.bumpMap,
      bumpScale: 0.025,
      color: new THREE.Color(0xe6e1d5),
      roughness: 0.44,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24,
    });
    this.potRiceBed = new THREE.Mesh(bedGeo, this.potRiceBedMat);
    this.potRiceBed.position.y = 0.28;
    this.potRiceBed.receiveShadow = true;
    this.pot.group.add(this.potRiceBed);

    // 1,350 individually modeled silky-smooth plump translucent rice grains distributed UNIFORMLY across the entire pot!
    this.potGrainCount = 1350;
    this.potRiceMesh = new THREE.InstancedMesh(this.grainGeo, this.potRiceMat, this.potGrainCount);
    this.potRiceMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.potRiceMesh.castShadow = true;
    this.potRiceMesh.receiveShadow = true;
    this.pot.group.add(this.potRiceMesh);

    this.grains = [];
    for (let i = 0; i < this.potGrainCount; i++) {
      // True uniform Vogel sunflower disc distribution (zero spiral gap!)
      const u = (i + 0.5) / this.potGrainCount;
      const layer = i % 3; // interleaved across full disc so every radius has 3 dense layers!
      const rNorm = Math.sqrt(u) * 0.96 + (Math.random() - 0.5) * 0.03;
      const clampedRNorm = THREE.MathUtils.clamp(rNorm, 0.02, 0.97);
      const angle = i * 2.39996323 + (Math.random() - 0.5) * 0.14;
      const maxR = 0.78; // strictly inside inner pot wall curvature at y=0.38..0.85!
      const r = clampedRNorm * maxR;

      // Subtle authentic crab-hole steam dimple coordinates for freshly cooked reveal
      const cookedDome = Math.cos(clampedRNorm * Math.PI * 0.46) * 0.14;
      const crabHole =
        Math.exp(-Math.pow((clampedRNorm - 0.34) / 0.085, 2)) *
        Math.pow(Math.max(0, Math.cos(angle * 3.0 + 0.6)), 6) *
        0.044;

      const isOkoge = clampedRNorm > 0.72 && (i % 31 === 0);
      const hueTint = (Math.random() - 0.5) * 0.055;

      this.grains.push({
        r,
        baseR: r,
        angle,
        layer,
        yOffset: layer * 0.032 + (Math.random() - 0.5) * 0.018,
        cookedDome: cookedDome - crabHole,
        vy: 0,
        lift: 0,
        fluff: 0,
        fluffRandY: (Math.random() - 0.2) * 0.11,
        rx: (Math.random() - 0.5) * 0.95,
        ry: Math.random() * Math.PI * 2,
        rz: (Math.random() - 0.5) * 0.95,
        scaleVar: 0.90 + Math.random() * 0.22,
        hueTint,
        isOkoge,
        removed: false,
      });

      this._setGrainBaseColor(i, 0.0, 0.0);
    }
    this.potRiceMesh.instanceColor.needsUpdate = true;
    this._updatePotRiceTransforms(0.016);
  }

  _setGrainBaseColor(i, cooked, fluffAmt) {
    const g = this.grains[i];
    if (g.isOkoge && cooked > 0.7 && fluffAmt > 0.45) {
      // Delightful rare golden toasted okoge ("おこげ") discovered when fluffing deep!
      this.tmpColor.setRGB(0.84, 0.64, 0.32);
    } else {
      // Vertical crevice AO across grain layers so every individual grain has rich 3D definition!
      const layerAo = g.layer === 0 ? 0.84 : g.layer === 1 ? 0.93 : 1.0;
      // Raw rice has slightly cooler pearlescent semi-translucent ivory; cooked is luminous warm steamed white
      const r = (THREE.MathUtils.lerp(0.91, 0.995, cooked) + g.hueTint) * layerAo;
      const gr = (THREE.MathUtils.lerp(0.905, 0.990, cooked) + g.hueTint * 0.85) * layerAo;
      const b = (THREE.MathUtils.lerp(0.885, 0.962, cooked) + g.hueTint * 0.6) * layerAo;
      this.tmpColor.setRGB(
        THREE.MathUtils.clamp(r, 0.72, 1.0),
        THREE.MathUtils.clamp(gr, 0.72, 1.0),
        THREE.MathUtils.clamp(b, 0.70, 0.99)
      );
    }
    this.potRiceMesh.setColorAt(i, this.tmpColor);
  }

  _setupBowlAndScoopRice() {
    this.cookedRiceMat = createRiceMaterial(1.0);
    this.cookedRiceMat.roughness = 0.16;
    this.cookedRiceMat.clearcoat = 0.92;
    this.cookedRiceMat.clearcoatRoughness = 0.12;

    const coreRiceMat = new THREE.MeshPhysicalMaterial({
      map: this.riceBedTex.map,
      bumpMap: this.riceBedTex.bumpMap,
      bumpScale: 0.026,
      color: new THREE.Color(0xf6f2e8),
      roughness: 0.24,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16,
    });

    // 1. Shamoji Carried Rice Clump (~125 smooth plump grains + rice-textured core squarely on paddle face!)
    const scoopCore = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), coreRiceMat);
    scoopCore.scale.set(1.06, 0.58, 1.18);
    this.shamoji.scoopRiceGroup.add(scoopCore);

    const scoopCount = 110;
    const scoopInst = new THREE.InstancedMesh(this.grainGeo, this.cookedRiceMat, scoopCount);
    for (let i = 0; i < scoopCount; i++) {
      const phi = Math.acos(1 - 1.12 * ((i + 0.5) / scoopCount));
      const theta = i * 2.39996323;
      const rad = 0.23 + (Math.random() - 0.4) * 0.035;
      this.dummy.position.set(
        Math.sin(phi) * Math.cos(theta) * rad * 1.05,
        Math.cos(phi) * rad * 0.58,
        Math.sin(phi) * Math.sin(theta) * rad * 1.16
      );
      this.dummy.rotation.set(Math.random() * 2.2, Math.random() * 6.28, Math.random() * 2.2);
      const sc = 1.18 + Math.random() * 0.22;
      this.dummy.scale.set(sc, sc * 1.08, sc * 1.12);
      this.dummy.updateMatrix();
      scoopInst.setMatrixAt(i, this.dummy.matrix);
      const v = 0.95 + Math.random() * 0.05;
      this.tmpColor.setRGB(v, v * 0.995, v * 0.97);
      scoopInst.setColorAt(i, this.tmpColor);
    }
    scoopInst.instanceMatrix.needsUpdate = true;
    scoopInst.instanceColor.needsUpdate = true;
    this.shamoji.scoopRiceGroup.add(scoopInst);

    // 2. Ceramic Bowl Rice Mound (~720 plump cooked grains strictly inside bowl wall + rice-textured dome!)
    this.bowlRiceGroup = new THREE.Group();
    this.bowlRiceGroup.position.set(0, 0.46, 0);
    this.serving.bowlGroup.add(this.bowlRiceGroup);

    const bowlCoreGeo = new THREE.SphereGeometry(0.67, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    bowlCoreGeo.scale(1.0, 0.72, 1.0);
    this.bowlCore = new THREE.Mesh(bowlCoreGeo, coreRiceMat);
    this.bowlCore.castShadow = true;
    this.bowlCore.receiveShadow = true;
    this.bowlRiceGroup.add(this.bowlCore);

    this.bowlGrainCount = 650;
    this.bowlRiceMesh = new THREE.InstancedMesh(this.grainGeo, this.cookedRiceMat, this.bowlGrainCount);
    this.bowlRiceMesh.castShadow = true;
    this.bowlRiceMesh.receiveShadow = true;
    this.bowlRiceGroup.add(this.bowlRiceMesh);

    this.bowlGrains = [];
    for (let i = 0; i < this.bowlGrainCount; i++) {
      // Strictly cover ONLY the upper visible dome hemisphere (phi in [0, 0.47*PI]) so ZERO grains ever clip outside the ceramic chawan!
      const u = (i + 0.5) / this.bowlGrainCount;
      const phi = Math.acos(1 - 0.88 * u);
      const theta = i * 2.39996323 + (Math.random() - 0.5) * 0.12;
      const r = 0.665 + (Math.random() - 0.5) * 0.036;
      const pos = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r,
        Math.cos(phi) * r * 0.72 + (Math.random() - 0.4) * 0.018,
        Math.sin(phi) * Math.sin(theta) * r
      );
      this.bowlGrains.push({
        pos,
        rot: new THREE.Euler((Math.random() - 0.5) * 1.4, Math.random() * 6.28, (Math.random() - 0.5) * 1.4),
        sc: 1.15 + Math.random() * 0.24,
        tier: i % 3,
        eatenAt: 1 + Math.floor(Math.random() * 5),
      });
      const ao = 0.86 + Math.cos(phi) * 0.14;
      this.tmpColor.setRGB(
        (0.97 + (Math.random() - 0.5) * 0.03) * ao,
        (0.965 + (Math.random() - 0.5) * 0.03) * ao,
        (0.94 + (Math.random() - 0.5) * 0.03) * ao
      );
      this.bowlRiceMesh.setColorAt(i, this.tmpColor);
    }
    this.bowlRiceMesh.instanceColor.needsUpdate = true;

    // 3. Tasting Spoon Rice Bite (~30 plump grains)
    const biteInst = new THREE.InstancedMesh(this.grainGeo, this.cookedRiceMat, 30);
    for (let i = 0; i < 30; i++) {
      const a = i * 2.4;
      const r = Math.sqrt(i / 30) * 0.12;
      this.dummy.position.set(Math.cos(a) * r, 0.03 + (1 - r / 0.14) * 0.055, Math.sin(a) * r * 1.2);
      this.dummy.rotation.set(Math.random() * 2, Math.random() * 6, Math.random() * 2);
      this.dummy.scale.set(1.15, 1.18, 1.2);
      this.dummy.updateMatrix();
      biteInst.setMatrixAt(i, this.dummy.matrix);
    }
    biteInst.instanceMatrix.needsUpdate = true;
    this.spoon.biteGroup.add(biteInst);

    this._refreshBowlRiceVisuals();
  }

  _resetToWash1(initial = false) {
    this.stage = STAGES.WASH_1;
    this.stageTime = 0;
    this.idleTime = 0;
    this.hintActive = false;

    this.washProgress = 0;
    this.turbidity = 0.03;
    this.targetTurbidity = 0.03;
    this.waterLevel = 0.78;
    this.targetWaterLevel = 0.78;
    this.swirlSpeed = 0;
    this.swirlAngle = 0;

    this.pouring = false;
    this.refilling = false;
    this.potDragging = false;
    this.potInCooker = false;
    this.potTargetPos.copy(POS.POT_WASH);
    this.potTargetRotZ = 0;
    this.pot.group.position.copy(POS.POT_WASH);
    this.pot.group.rotation.set(0, 0, 0);
    this.pot.contactShadow.visible = true;
    this.pot.pourStream.visible = false;

    this.starchMap.clear();
    this.water.mesh.visible = true;
    this.water.mesh.position.y = this.waterLevel;
    this.water.uniforms.uTurbidity.value = this.turbidity;
    this.kitchen.sinkPoolMat.opacity = 0;

    this.lidAngle = 1.42;
    this.targetLidAngle = 1.42;
    this.cookProgress = 0;
    this.cookedBlend = 0;
    this.potRiceMat.userData.riceUniforms.uCooked.value = 0;
    this.potRiceMat.userData.riceUniforms.uWetness.value = 0.85;
    this.potRiceMat.roughness = 0.30;
    this.potRiceMat.clearcoat = 0.48;
    this.potRiceBed.position.y = 0.28;
    this.potRiceBed.scale.set(1, 1, 1);
    this.potRiceBedMat.color.setHex(0xcbc6ba);

    this.fluffProgress = 0;
    this.fluffStrokes = 0;
    this.scoopLoaded = false;
    this.scoopDragging = false;
    this.bowlScoops = 0;
    this.bowlBites = 0;
    this.shamoji.scoopRiceGroup.visible = false;
    this.shamoji.group.position.set(2.95, 0.14, 1.38);
    this.shamoji.group.rotation.set(0, -0.45, 0);

    // Clear bowl toppings
    while (this.serving.bowlToppingsGroup.children.length > 0) {
      this.serving.bowlToppingsGroup.remove(this.serving.bowlToppingsGroup.children[0]);
    }
    this.hasUmeboshi = false;
    this.serving.umeboshiInDish.visible = true;
    this.sesameCount = 0;
    this.noriCount = 0;
    this.spoon.group.visible = false;
    this.spoonActive = false;

    // Reset grains
    for (let i = 0; i < this.potGrainCount; i++) {
      const g = this.grains[i];
      g.r = g.baseR;
      g.vy = 0;
      g.lift = 0;
      g.fluff = 0;
      g.removed = false;
      this._setGrainBaseColor(i, 0, 0);
    }
    this.potRiceMesh.instanceColor.needsUpdate = true;

    this.hand.group.visible = true;
    this.hand.setPose('wash', 0);
    // Positive rotY (+0.88) brings forearm naturally from RIGHT-FRONT (+X, +Z), never blocking the pot!
    this.handTargetPos.set(POS.POT_WASH.x + 1.05, 1.24, POS.POT_WASH.z + 0.36);
    if (initial) {
      this.handWorldPos.copy(this.handTargetPos);
      this.hand.group.position.copy(this.handWorldPos);
    }
    this.handTargetRot.set(-0.22, 0.86, 0.08);
    if (initial) this.hand.group.rotation.copy(this.handTargetRot);

    this._refreshBowlRiceVisuals();
    this._updatePotRiceTransforms(0.016);
  }

  _refreshBowlRiceVisuals() {
    const visibleFrac = Math.max(0, (this.bowlScoops / 3) - (this.bowlBites * 0.18));
    if (visibleFrac <= 0.01) {
      this.bowlRiceGroup.visible = false;
      return;
    }
    this.bowlRiceGroup.visible = true;

    // Smooth domed scaling strictly inside the chawan rim (inner rim radius = 0.72 at y = 0.65)
    const baseY = 0.36 + visibleFrac * 0.25; // sits inside bowl at scoop 1, rises to iconic domed peak at scoop 3!
    this.bowlRiceGroup.position.y = baseY;
    const scaleY = 0.48 + visibleFrac * 0.56;
    const scaleXZ = 0.78 + Math.min(1, visibleFrac * 1.1) * 0.25;
    this.bowlCore.scale.set(scaleXZ, 0.72 * scaleY, scaleXZ);
    this.bowlCore.position.y = 0;

    const activeGrains = Math.floor(this.bowlGrainCount * Math.min(1, 0.45 + visibleFrac * 0.60));
    for (let i = 0; i < this.bowlGrainCount; i++) {
      const g = this.bowlGrains[i];
      const eaten = this.bowlBites >= g.eatenAt && this.bowlBites > 0 && (i % 5 < this.bowlBites);
      if (i >= activeGrains || eaten) {
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.set(0, 0, 0);
      } else {
        this.dummy.position.set(
          g.pos.x * scaleXZ,
          g.pos.y * scaleY,
          g.pos.z * scaleXZ
        );
        this.dummy.rotation.copy(g.rot);
        this.dummy.scale.set(g.sc, g.sc * 1.06, g.sc * 1.12);
      }
      this.dummy.updateMatrix();
      this.bowlRiceMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.bowlRiceMesh.instanceMatrix.needsUpdate = true;

    // Exact top-surface summit Y of the lush rice mound so Umeboshi, Sesame & Nori rest visibly ON TOP!
    this.moundSummitY = baseY + 0.67 * 0.72 * scaleY;
    this.serving.bowlToppingsGroup.position.y = this.moundSummitY + 0.025;
  }

  /**
   * Camera framing presets (Slow Cinematic Dolly Targets)
   * Automatically adapts slightly for iPhone portrait vs iPad/desktop landscape so
   * hand, food, and active tools are ALWAYS large and unmistakable on screen!
   */
  getCameraTarget(aspect) {
    const portrait = aspect < 0.92;
    const distScale = portrait ? 1.38 : 1.0;

    let pos = new THREE.Vector3(-0.95, 3.35, 3.85);
    let look = new THREE.Vector3(-1.05, 0.55, 0.08);

    switch (this.stage) {
      case STAGES.WASH_1:
      case STAGES.WASH_2:
        // Large close-up on the inner pot with translucent rice & water, showing sink left & open cooker right
        pos.set(-0.95, 3.15 * (portrait ? 1.12 : 1.0), 3.35 * distScale);
        look.set(-1.12, 0.56, 0.10);
        break;

      case STAGES.POUR_1:
      case STAGES.POUR_2:
        // Dolly gently left to frame pot tilting over gleaming stainless steel sink
        pos.set(-2.05, 3.15 * (portrait ? 1.10 : 1.0), 3.75 * distScale);
        look.set(-2.35, 0.35, 0.02);
        break;

      case STAGES.LOAD_POT:
        // Frame both the gleaming filled inner pot and the waiting open white IH rice cooker
        pos.set(0.22, 3.35 * (portrait ? 1.15 : 1.0), 4.55 * distScale);
        look.set(0.20, 0.72, -0.05);
        break;

      case STAGES.CLOSE_LID:
      case STAGES.PRESS_START:
        // Dolly in heroically on the sculptural white IH rice cooker
        pos.set(1.48, 2.75 * (portrait ? 1.08 : 1.0), 3.45 * distScale);
        look.set(1.52, 0.98, 0.05);
        break;

      case STAGES.COOKING: {
        // Slow cinematic dolly-in while backlit steam billows from the vent
        const t = THREE.MathUtils.clamp(this.cookProgress, 0, 1);
        pos.set(
          THREE.MathUtils.lerp(1.52, 1.35, t),
          THREE.MathUtils.lerp(2.72, 2.42, t) * (portrait ? 1.08 : 1.0),
          THREE.MathUtils.lerp(3.48, 2.95, t) * distScale
        );
        look.set(1.54, THREE.MathUtils.lerp(1.05, 1.25, t), -0.10);
        break;
      }

      case STAGES.OPEN_LID:
        pos.set(1.48, 2.68 * (portrait ? 1.08 : 1.0), 3.25 * distScale);
        look.set(1.54, 1.05, -0.05);
        break;

      case STAGES.FLUFF:
        // Lush overhead-3/4 macro dolly into the steaming plump cooked rice!
        pos.set(1.45, 3.25 * (portrait ? 1.10 : 1.0), 2.55 * distScale);
        look.set(1.54, 0.92, -0.15);
        break;

      case STAGES.SCOOP:
        // Balanced two-shot framing open steaming pot on left & artisanal ceramic bowl on right
        pos.set(2.75, 3.20 * (portrait ? 1.16 : 1.0), 4.15 * distScale);
        look.set(2.78, 0.65, 0.14);
        break;

      case STAGES.SERVE: {
        // Slow cinematic hero dolly-in on the steaming ceramic rice bowl & toppings!
        const dolly = Math.min(1, this.stageTime / 6.0);
        pos.set(
          THREE.MathUtils.lerp(4.25, 4.10, dolly),
          THREE.MathUtils.lerp(2.52, 2.08, dolly) * (portrait ? 1.12 : 1.0),
          THREE.MathUtils.lerp(3.15, 2.62, dolly) * distScale
        );
        look.set(4.15, 0.56, 0.42);
        break;
      }
    }

    return { pos, look };
  }

  /**
   * Gentle non-active object wobble ("今の段階の物だけ本反応、他は小さく揺れる")
   */
  triggerWobble(key, obj) {
    this.wobbles.set(key, { obj, time: 0.36, baseRotZ: obj.rotation.z });
    this.audio.playGentleTap();
  }

  /**
   * Pointer Down Handler (Single-Finger)
   */
  onPointerDown(hitId, worldPoint) {
    this.idleTime = 0;
    this.hintActive = false;

    // Detour: Faucet is always physically responsive during washing stages!
    if (hitId === 'faucet') {
      if (this.stage === STAGES.WASH_1 || this.stage === STAGES.WASH_2 || this.stage === STAGES.POUR_1 || this.stage === STAGES.POUR_2) {
        this.faucetUserTimer = 1.65;
        this.audio.playSplash();
        return;
      }
      this.triggerWobble('faucet', this.faucet.group);
      return;
    }

    switch (this.stage) {
      case STAGES.WASH_1:
      case STAGES.WASH_2:
        if (hitId === 'pot' || this._nearPot(worldPoint, 1.65)) {
          this.handActive = true;
          this._updateWashFromPoint(worldPoint, true);
          this.audio.playSplash();
        } else if (hitId === 'cooker_body' || hitId === 'cooker_lid' || hitId === 'cooker_start') {
          this.triggerWobble('cooker', this.cooker.group);
        } else if (hitId === 'bowl') {
          this.triggerWobble('bowl', this.serving.bowlGroup);
        }
        break;

      case STAGES.POUR_1:
      case STAGES.POUR_2:
        if (!this.pouring && !this.refilling) {
          if (hitId === 'pot' || this._nearPot(worldPoint, 1.9)) {
            this._startPourOut();
          } else if (hitId === 'cooker_body' || hitId === 'cooker_lid') {
            this.triggerWobble('cooker', this.cooker.group);
          }
        }
        break;

      case STAGES.LOAD_POT:
        if (hitId === 'pot' || this._nearPot(worldPoint, 1.55)) {
          this.potDragging = true;
          this.audio.playGentleTap();
        } else if (hitId === 'cooker_body' || hitId === 'cooker_lid') {
          // Generous tap-to-seat if child taps the open waiting rice cooker!
          this._seatPotInCooker();
        }
        break;

      case STAGES.CLOSE_LID:
        if (hitId === 'cooker_lid' || hitId === 'cooker_body' || hitId === 'pot') {
          this._closeCookerLid();
        }
        break;

      case STAGES.PRESS_START:
        if (hitId === 'cooker_start' || hitId === 'cooker_body' || hitId === 'cooker_lid') {
          this._startCooking();
        }
        break;

      case STAGES.COOKING:
        // Interactive joy while cooking: tapping puffs extra fragrant steam & bubbles!
        if (hitId === 'cooker_body' || hitId === 'cooker_lid' || hitId === 'cooker_start' || this._nearCooker(worldPoint, 2.0)) {
          this._emitCookerSteamBurst(8);
          this.audio.playBubble(0.08, 220);
          this.triggerWobble('cooker', this.cooker.group);
        }
        break;

      case STAGES.OPEN_LID:
        if (hitId === 'cooker_lid' || hitId === 'cooker_body' || hitId === 'cooker_start') {
          this._openCookerLid();
        }
        break;

      case STAGES.FLUFF:
        if (hitId === 'pot' || hitId === 'cooker_body' || hitId === 'shamoji' || this._nearCooker(worldPoint, 1.9)) {
          this.handActive = true;
          this._updateFluffFromPoint(worldPoint, true);
        } else if (hitId === 'bowl') {
          this.triggerWobble('bowl', this.serving.bowlGroup);
        }
        break;

      case STAGES.SCOOP:
        if (!this.scoopLoaded) {
          if (hitId === 'pot' || hitId === 'cooker_body' || hitId === 'shamoji' || this._nearCooker(worldPoint, 1.75)) {
            this.scoopLoaded = true;
            this.scoopDragging = true;
            this.shamoji.scoopRiceGroup.visible = true;
            this.audio.playFluffStroke();
            this._emitPotSteam(5);
            this._updateScoopDrag(worldPoint);
          } else if (hitId === 'bowl') {
            this.triggerWobble('bowl', this.serving.bowlGroup);
          }
        } else {
          if (hitId === 'bowl' || this._nearBowl(worldPoint, 1.45)) {
            this._depositScoopInBowl();
          } else {
            this.scoopDragging = true;
            this._updateScoopDrag(worldPoint);
          }
        }
        break;

      case STAGES.SERVE:
        if (hitId === 'topping_umeboshi') {
          this._placeUmeboshi();
        } else if (hitId === 'topping_sesame') {
          this._sprinkleSesame();
        } else if (hitId === 'topping_nori') {
          this._sprinkleNori();
        } else if (hitId === 'masu_reset') {
          this.audio.playTopping('sesame');
          this._resetToWash1(false);
        } else if (hitId === 'bowl' || this._nearBowl(worldPoint, 1.25)) {
          this._takeTastingBite();
        }
        break;
    }
  }

  /**
   * Pointer Move Handler (Single-Finger Drag)
   */
  onPointerMove(worldPoint, deltaScreenX, deltaScreenY) {
    this.idleTime = 0;

    if (this.stage === STAGES.WASH_1 || this.stage === STAGES.WASH_2) {
      if (this.handActive) {
        this._updateWashFromPoint(worldPoint, false);
      }
    } else if (this.stage === STAGES.POUR_1 || this.stage === STAGES.POUR_2) {
      if (!this.pouring && !this.refilling && deltaScreenX < -8) {
        this._startPourOut();
      }
    } else if (this.stage === STAGES.LOAD_POT) {
      if (this.potDragging && worldPoint) {
        const clampedX = THREE.MathUtils.clamp(worldPoint.x, POS.POT_WASH.x - 0.3, POS.COOKER.x + 0.25);
        const t = THREE.MathUtils.clamp((clampedX - POS.POT_WASH.x) / (POS.COOKER.x - POS.POT_WASH.x), 0, 1);
        const arcY = Math.sin(t * Math.PI) * 1.18 + t * 0.24;
        const z = THREE.MathUtils.lerp(POS.POT_WASH.z, POS.COOKER.z, t);
        this.potTargetPos.set(clampedX, arcY, z);
        if (t > 0.68) {
          this._seatPotInCooker();
        }
      }
    } else if (this.stage === STAGES.CLOSE_LID && deltaScreenY > 10) {
      this._closeCookerLid();
    } else if (this.stage === STAGES.OPEN_LID && deltaScreenY < -10) {
      this._openCookerLid();
    } else if (this.stage === STAGES.FLUFF) {
      if (this.handActive) {
        this._updateFluffFromPoint(worldPoint, false);
      }
    } else if (this.stage === STAGES.SCOOP) {
      if (this.scoopDragging && worldPoint) {
        this._updateScoopDrag(worldPoint);
        if (this._nearBowl(worldPoint, 1.05)) {
          this._depositScoopInBowl();
        }
      }
    }
  }

  onPointerUp() {
    this.handActive = false;

    if (this.stage === STAGES.LOAD_POT && this.potDragging) {
      this.potDragging = false;
      const distToCooker = this.pot.group.position.distanceTo(POS.POT_IN_COOKER);
      if (distToCooker < 1.85) {
        this._seatPotInCooker();
      } else {
        this.potTargetPos.copy(POS.POT_WASH);
      }
    }

    if (this.stage === STAGES.SCOOP && this.scoopDragging) {
      this.scoopDragging = false;
      const bowlWorld = this._getBowlWorldPos();
      if (this.shamoji.group.position.distanceTo(bowlWorld) < 1.55) {
        this._depositScoopInBowl();
      }
    }
  }

  _nearPot(pt, radius) {
    if (!pt) return false;
    const dx = pt.x - this.pot.group.position.x;
    const dz = pt.z - this.pot.group.position.z;
    return Math.hypot(dx, dz) < radius;
  }

  _nearCooker(pt, radius) {
    if (!pt) return false;
    const dx = pt.x - POS.COOKER.x;
    const dz = pt.z - POS.COOKER.z;
    return Math.hypot(dx, dz) < radius;
  }

  _getBowlWorldPos() {
    this.serving.bowlGroup.getWorldPosition(this.tmpVec);
    return this.tmpVec.clone();
  }

  _nearBowl(pt, radius) {
    if (!pt) return false;
    const b = this._getBowlWorldPos();
    return Math.hypot(pt.x - b.x, pt.z - b.z) < radius;
  }

  _updateWashFromPoint(pt, isStart) {
    if (!pt) return;
    const potPos = this.pot.group.position;
    let lx = pt.x - potPos.x;
    let lz = pt.z - potPos.z;
    const r = Math.hypot(lx, lz);
    const maxR = 0.66;
    if (r > maxR) {
      lx = (lx / r) * maxR;
      lz = (lz / r) * maxR;
    }

    if (isStart) {
      this.prevHandLocal.set(lx, lz);
    }

    const dx = lx - this.prevHandLocal.x;
    const dz = lz - this.prevHandLocal.y;
    const moveDist = Math.hypot(dx, dz);
    this.prevHandLocal.set(lx, lz);
    this.handLocalInPot.set(lx, lz);

    // Position sculpted 3D hand approaching naturally from RIGHT-FRONT (+X, +Z) with curved fingers dipping into water & rice!
    this.handTargetPos.set(potPos.x + lx * 0.85 + 0.34, 1.06, potPos.z + lz * 0.85 + 0.28);
    this.handTargetRot.set(-0.34, 0.78 - lx * 0.22, 0.12 - lx * 0.10);

    if (moveDist > 0.008) {
      const boost = Math.min(0.45, moveDist * 1.45);
      this.swirlSpeed = Math.min(1.0, this.swirlSpeed + boost);

      // Bloom dynamic swirling milky starch ("とぎ汁") directly behind the fingers!
      const isSecondRinse = this.stage === STAGES.WASH_2;
      const maxTurb = isSecondRinse ? 0.44 : 0.94;
      const washRate = isSecondRinse ? 0.18 : 0.135;

      this.washProgress = Math.min(1.0, this.washProgress + moveDist * washRate);
      this.targetTurbidity = THREE.MathUtils.lerp(0.03, maxTurb, Math.pow(this.washProgress, 0.78));

      const plumeIntensity = isSecondRinse ? 0.14 : 0.28;
      this.starchMap.addStarchPlume(lx / 0.94, lz / 0.94, plumeIntensity * Math.min(1, moveDist * 8), 0.28);

      // Lively tiny water droplet splashes when swirling briskly!
      if (moveDist > 0.08 && Math.random() < 0.45) {
        this.splash.spawn(
          potPos.x + lx,
          this.waterLevel + 0.06,
          potPos.z + lz,
          (Math.random() - 0.5) * 1.6,
          1.4 + Math.random() * 1.4,
          (Math.random() - 0.5) * 1.6,
          0.9
        );
      }

      // Check wash completion -> naturally invite pouring off the milky water!
      if (this.washProgress >= 1.0) {
        this.handActive = false;
        this.stage = this.stage === STAGES.WASH_1 ? STAGES.POUR_1 : STAGES.POUR_2;
        this.stageTime = 0;
        this.idleTime = 0;
        // Subtle physical readiness lean toward the stainless sink on the left
        this.potTargetPos.set(POS.POT_WASH.x - 0.18, 0.06, POS.POT_WASH.z);
        this.potTargetRotZ = 0.09;
      }
    }
  }

  _startPourOut() {
    this.pouring = true;
    this.pourAnim = 0;
    this.pot.contactShadow.visible = false;
    this.hand.setPose('open', 0);
    this.audio.playSplash();
  }

  _seatPotInCooker() {
    if (this.potInCooker) return;
    this.potDragging = false;
    this.potInCooker = true;
    this.potTargetPos.copy(POS.POT_IN_COOKER);
    this.potTargetRotZ = 0;
    this.pot.contactShadow.visible = false;
    this.audio.playPotClunk();
    this.stage = STAGES.CLOSE_LID;
    this.stageTime = 0;
    this.idleTime = 0;
  }

  _closeCookerLid() {
    if (this.stage !== STAGES.CLOSE_LID) return;
    this.targetLidAngle = 0.0;
    this.audio.playLidLatch(false);
    this.stage = STAGES.PRESS_START;
    this.stageTime = 0;
    this.idleTime = 0;
  }

  _startCooking() {
    if (this.stage !== STAGES.PRESS_START) return;
    this.cookProgress = 0;
    this.audio.playCookStartChime();
    this.stage = STAGES.COOKING;
    this.stageTime = 0;
    this.idleTime = 0;
  }

  _openCookerLid() {
    if (this.stage !== STAGES.OPEN_LID) return;
    this.targetLidAngle = 1.44;
    this.audio.playLidLatch(true);
    this.audio.playSteamWhoosh();

    // Lush dramatic reveal burst of north-window backlit steam!
    for (let i = 0; i < 20; i++) {
      this.steam.emit(POS.COOKER.x, 1.32, POS.COOKER.z, {
        spread: 0.95,
        rise: 0.95 + Math.random() * 0.55,
        baseScale: 0.55,
        maxScale: 2.35,
        opacity: 0.34,
        life: 2.8,
      });
    }

    // Bring hand + wooden shamoji smoothly into frame ready to fluff!
    this.stage = STAGES.FLUFF;
    this.stageTime = 0;
    this.idleTime = 0;
    this.hand.setPose('hold_shamoji', 0);
  }

  _updateFluffFromPoint(pt, isStart) {
    if (!pt) return;
    const cx = POS.COOKER.x;
    const cz = POS.COOKER.z;
    let lx = pt.x - cx;
    let lz = pt.z - cz;
    const r = Math.hypot(lx, lz);
    const maxR = 0.72;
    if (r > maxR) {
      lx = (lx / r) * maxR;
      lz = (lz / r) * maxR;
    }

    if (isStart) {
      this.prevHandLocal.set(lx, lz);
    }
    const dx = lx - this.prevHandLocal.x;
    const dz = lz - this.prevHandLocal.y;
    const dist = Math.hypot(dx, dz);
    this.prevHandLocal.set(lx, lz);

    // Drive shamoji paddle tip deep into the steaming rice bed & fold upward!
    const dip = Math.sin(this.time * 10.0) * 0.05;
    this.shamoji.group.position.lerp(
      new THREE.Vector3(cx + lx * 0.82 + 0.24, 1.48 + dip, cz + lz * 0.82 + 0.36),
      0.32
    );
    this.shamoji.group.rotation.set(0.42 + lz * 0.22, 0.38 - lx * 0.35, -lx * 0.42);

    // Right hand grips the wooden shamoji handle cleanly from the right-front (+X, +Z)
    this.handTargetPos.copy(this.shamoji.group.position).add(new THREE.Vector3(0.32, 0.16, 0.48));
    this.handTargetRot.set(-0.18, 0.42 - lx * 0.28, 0.12 - lx * 0.18);

    if (dist > 0.02) {
      this.fluffProgress = Math.min(1.0, this.fluffProgress + dist * 0.18);

      // Physically disturb & fluff individual rice grains near the shamoji blade!
      let colorDirty = false;
      for (let i = 0; i < this.potGrainCount; i++) {
        const g = this.grains[i];
        const gx = Math.cos(g.angle) * g.r;
        const gz = Math.sin(g.angle) * g.r;
        const d = Math.hypot(gx - lx, gz - lz);
        if (d < 0.42) {
          const influence = (1 - d / 0.42) * Math.min(1, dist * 5.5);
          const prevFluff = g.fluff;
          g.fluff = Math.min(1.0, g.fluff + influence * 0.65);
          g.vy = Math.max(g.vy, 0.85 + influence * 1.45);
          g.rx += (Math.random() - 0.5) * 0.9 * influence;
          g.ry += (Math.random() - 0.5) * 0.9 * influence;
          if (g.isOkoge && prevFluff <= 0.45 && g.fluff > 0.45) {
            this._setGrainBaseColor(i, 1.0, g.fluff);
            colorDirty = true;
          }
        }
      }
      if (colorDirty) this.potRiceMesh.instanceColor.needsUpdate = true;

      // Moist rice-fluffing Foley + warm steam curls rising from turned rice!
      if (this.time - this.lastFluffSound > 0.22) {
        this.lastFluffSound = this.time;
        this.audio.playFluffStroke();
        this._emitPotSteam(3);
      }

      if (this.fluffProgress >= 1.0) {
        this.handActive = false;
        this.stage = STAGES.SCOOP;
        this.stageTime = 0;
        this.idleTime = 0;
      }
    }
  }

  _updateScoopDrag(pt) {
    if (!pt) return;
    const bowlW = this._getBowlWorldPos();
    const x = THREE.MathUtils.clamp(pt.x, POS.COOKER.x - 0.5, bowlW.x + 0.5);
    const z = THREE.MathUtils.clamp(pt.z, -0.7, 1.2);
    const t = THREE.MathUtils.clamp((x - POS.COOKER.x) / (bowlW.x - POS.COOKER.x), 0, 1);
    const arcY = 1.52 + Math.sin(t * Math.PI) * 0.58 - t * 0.32;

    this.shamoji.group.position.lerp(new THREE.Vector3(x, arcY, z + 0.25), 0.35);
    this.shamoji.group.rotation.set(0.14, 0.32 - t * 0.28, -0.10 - t * 0.20);

    this.handTargetPos.copy(this.shamoji.group.position).add(new THREE.Vector3(0.28, 0.14, 0.48));
    this.handTargetRot.set(-0.14, 0.42, 0.08);
  }

  _depositScoopInBowl() {
    if (!this.scoopLoaded) return;
    this.scoopLoaded = false;
    this.scoopDragging = false;
    this.scoopDropAnim = 0.45;
    this.shamoji.scoopRiceGroup.visible = false;

    this.bowlScoops = Math.min(3, this.bowlScoops + 1);
    this._refreshBowlRiceVisuals();
    this.audio.playRiceDrop();

    // Gently lower pot rice bed slightly as scoops are served
    this.potRiceBed.position.y = Math.max(0.54, 0.68 - this.bowlScoops * 0.045);

    // Steam puff rising from the freshly served rice in the ceramic bowl!
    const b = this._getBowlWorldPos();
    for (let i = 0; i < 6; i++) {
      this.steam.emit(b.x, b.y + 0.78, b.z, {
        spread: 0.45,
        rise: 0.65,
        baseScale: 0.34,
        maxScale: 1.35,
        opacity: 0.26,
        life: 2.2,
      });
    }

    if (this.bowlScoops >= 3) {
      this.stage = STAGES.SERVE;
      this.stageTime = 0;
      this.idleTime = 0;
      this.audio.playCookDoneChime();
    }
  }

  _placeUmeboshi() {
    if (this.hasUmeboshi) {
      this.triggerWobble('umeDish', this.serving.umeDish);
      return;
    }
    this.hasUmeboshi = true;
    this.serving.umeboshiInDish.visible = false;
    const placed = new THREE.Mesh(this.serving.umeGeo, this.serving.umeMat);
    placed.position.set(0, 0.085, 0);
    placed.scale.set(1.18, 1.05, 1.18);
    placed.castShadow = true;
    this.serving.bowlToppingsGroup.add(placed);
    this.audio.playTopping('umeboshi');
  }

  _sprinkleSesame() {
    if (this.sesameCount >= 5) {
      this.triggerWobble('sesameDish', this.serving.sesameDish);
      return;
    }
    this.sesameCount++;
    const seedGeo = new THREE.SphereGeometry(0.019, 6, 5);
    seedGeo.scale(1.6, 0.65, 0.9);
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.36 });
    const saltMat = new THREE.MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.2 });

    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.14 + Math.sqrt(Math.random()) * 0.38;
      // Follow exact ellipsoidal rice dome slope so every sesame seed rests ON TOP of the rice grains!
      const drop = (1 - Math.sqrt(Math.max(0.05, 1 - (r / 0.68) * (r / 0.68)))) * 0.44;
      const seed = new THREE.Mesh(seedGeo, i % 4 === 0 ? saltMat : blackMat);
      seed.position.set(Math.cos(a) * r, 0.03 - drop, Math.sin(a) * r);
      seed.rotation.set(Math.random() * 1.2, Math.random() * 6, Math.random() * 1.2);
      this.serving.bowlToppingsGroup.add(seed);
    }
    this.triggerWobble('sesameDish', this.serving.sesameDish);
    this.audio.playTopping('sesame');
  }

  _sprinkleNori() {
    if (this.noriCount >= 4) {
      this.triggerWobble('noriDish', this.serving.noriDish);
      return;
    }
    this.noriCount++;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.16 + Math.sqrt(Math.random()) * 0.34;
      const drop = (1 - Math.sqrt(Math.max(0.05, 1 - (r / 0.68) * (r / 0.68)))) * 0.42;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.010, 0.038), this.serving.noriMat);
      strip.position.set(Math.cos(a) * r, 0.045 - drop, Math.sin(a) * r);
      strip.rotation.set((Math.random() - 0.5) * 0.45, Math.random() * Math.PI, (Math.random() - 0.5) * 0.45);
      strip.castShadow = true;
      this.serving.bowlToppingsGroup.add(strip);
    }
    this.triggerWobble('noriDish', this.serving.noriDish);
    this.audio.playTopping('nori');
  }

  _takeTastingBite() {
    if (this.spoonActive) return;
    if (this.bowlBites >= 5) {
      // Bowl happily eaten clean — gently invite fresh rice batch via masu or restart!
      this._resetToWash1(false);
      return;
    }
    this.spoonActive = true;
    this.spoonAnim = 0;
    this.spoon.group.visible = true;
    this.spoon.biteGroup.visible = false;
    this.audio.playFluffStroke();
  }

  _emitPotSteam(count = 2) {
    for (let i = 0; i < count; i++) {
      this.steam.emit(POS.COOKER.x, 1.24, POS.COOKER.z, {
        spread: 0.72,
        rise: 0.68,
        baseScale: 0.44,
        maxScale: 1.75,
        opacity: 0.32,
        life: 2.5,
      });
    }
  }

  _emitCookerSteamBurst(count = 4) {
    const vx = POS.COOKER.x;
    const vy = 1.78;
    const vz = POS.COOKER.z - 0.38;
    for (let i = 0; i < count; i++) {
      this.steam.emit(vx, vy, vz, {
        spread: 0.16,
        rise: 1.15 + Math.random() * 0.48,
        baseScale: 0.34,
        maxScale: 2.15,
        opacity: 0.44,
        life: 2.4,
      });
    }
  }

  /**
   * Per-frame physics, fluids, steam, hand animation, and audio update
   */
  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.time += safeDt;
    this.stageTime += safeDt;
    this.idleTime += safeDt;

    // 1. Subtle 10-second idle gentle hand gesture (strictly following "放置時のみ手で1回実演")
    if (this.idleTime > 10.0 && !this.hintActive && !this.pouring && !this.refilling && this.stage !== STAGES.COOKING && this.stage !== STAGES.SERVE) {
      this.hintActive = true;
      this.hintProgress = 0;
    }
    if (this.hintActive) {
      this.hintProgress += safeDt * 0.65;
      if (this.hintProgress >= 1.0) {
        this.hintActive = false;
        this.idleTime = 0;
      }
    }

    // 2. Smooth pot position & rotation
    this.pot.group.position.lerp(this.potTargetPos, 1 - Math.exp(-safeDt * 9));
    this.pot.group.rotation.z = THREE.MathUtils.lerp(this.pot.group.rotation.z, this.potTargetRotZ, 1 - Math.exp(-safeDt * 8));

    // 3. Pouring milky "とぎ汁" & Faucet refilling state machine
    this._updatePourAndFaucet(safeDt);

    // 4. Water surface & real-time milky starch turbidity advection
    this.turbidity = THREE.MathUtils.lerp(this.turbidity, this.targetTurbidity, 1 - Math.exp(-safeDt * 3.8));
    this.waterLevel = THREE.MathUtils.lerp(this.waterLevel, this.targetWaterLevel, 1 - Math.exp(-safeDt * 4.5));
    this.swirlSpeed = Math.max(0, this.swirlSpeed - safeDt * 0.85);
    this.swirlAngle += safeDt * (0.4 + this.swirlSpeed * 5.8);

    if (this.water.mesh.visible) {
      this.water.mesh.position.y = this.waterLevel;
      this.water.uniforms.uTime.value = this.time;
      this.water.uniforms.uTurbidity.value = this.turbidity;
      this.water.uniforms.uSwirlSpeed.value = this.swirlSpeed;
      this.water.uniforms.uSwirlAngle.value = this.swirlAngle;
      this.water.uniforms.uHandPos.value.set(this.handLocalInPot.x, -this.handLocalInPot.y);
      this.water.uniforms.uSplashAmt.value = this.faucetFlow;

      if (this.swirlSpeed > 0.03 || this.faucetFlow > 0.05) {
        this.starchMap.advect(safeDt * (0.2 + this.swirlSpeed * 1.45), this.turbidity);
      }
    }

    // Continuous washing Foley audio
    if (this.stage === STAGES.WASH_1 || this.stage === STAGES.WASH_2) {
      this.audio.setWashIntensity(this.swirlSpeed, this.turbidity);
    } else {
      this.audio.setWashIntensity(0, 0);
    }

    // 5. Rice cooker lid, LEDs & cooking progression
    this.lidAngle = THREE.MathUtils.lerp(this.lidAngle, this.targetLidAngle, 1 - Math.exp(-safeDt * 8.5));
    this.cooker.lidPivot.rotation.x = -this.lidAngle;

    this._updateCookerState(safeDt);

    // 6. Pot rice grain physics & visual swelling (raw -> steamed -> fluffed!)
    this._updatePotRiceTransforms(safeDt);

    // 7. Hand & Shamoji idle/active posing
    this._updateHandAndTools(safeDt);

    // 8. Tasting spoon animation in SERVE stage
    this._updateTastingSpoon(safeDt);

    // 9. Gentle wobbles on non-active objects
    for (const [key, w] of this.wobbles.entries()) {
      w.time -= safeDt;
      if (w.time <= 0) {
        w.obj.rotation.z = w.baseRotZ;
        this.wobbles.delete(key);
      } else {
        w.obj.rotation.z = w.baseRotZ + Math.sin(w.time * 38.0) * 0.045 * (w.time / 0.36);
      }
    }

    // 10. Continuous warm steam from open cooked pot & steaming ceramic bowl
    if (this.stage === STAGES.FLUFF || this.stage === STAGES.SCOOP) {
      if (Math.random() < safeDt * 6.5) this._emitPotSteam(1);
    }
    if (this.bowlScoops > 0 && this.bowlBites < 5) {
      if (Math.random() < safeDt * (this.stage === STAGES.SERVE ? 7.5 : 3.5)) {
        const b = this._getBowlWorldPos();
        this.steam.emit(b.x, b.y + 0.76, b.z, {
          spread: 0.40,
          rise: 0.56,
          baseScale: 0.28,
          maxScale: 1.25,
          opacity: 0.22,
          life: 2.3,
        });
      }
    }

    // 11. Particle systems
    this.steam.update(safeDt);
    this.splash.update(safeDt);
  }

  _updatePourAndFaucet(dt) {
    // User detour faucet tap
    if (this.faucetUserTimer > 0) {
      this.faucetUserTimer -= dt;
      this.targetWaterLevel = Math.min(0.92, this.targetWaterLevel + dt * 0.08);
      this.targetTurbidity = Math.max(0.04, this.targetTurbidity - dt * 0.12);
      this.starchMap.dilute(dt * 0.45);
    }

    let wantFaucet = this.faucetUserTimer > 0;

    if (this.pouring) {
      this.pourAnim += dt;
      const t = this.pourAnim;

      if (t < 0.45) {
        // Lift & move pot to sink rim
        const p = t / 0.45;
        this.potTargetPos.lerpVectors(POS.POT_WASH, POS.POT_POUR, p);
        this.potTargetRotZ = THREE.MathUtils.lerp(0.09, 0.72, p);
      } else if (t < 1.85) {
        // Pour thick glistening milky stream straight down with gravity into stainless sink!
        const p = (t - 0.45) / 1.4;
        this.potTargetPos.copy(POS.POT_POUR);
        this.potTargetRotZ = THREE.MathUtils.lerp(0.72, 1.04, p);
        this.pot.pourStream.visible = true;
        // Anchor gravity stream precisely to the lowest tilted left rim lip in world space!
        const rimWorld = new THREE.Vector3(-0.98, 1.08, 0.0).applyMatrix4(this.pot.group.matrixWorld);
        this.pot.pourStream.position.copy(rimWorld);
        this.pot.pourUniforms.uTime.value = this.time;
        this.pot.pourUniforms.uFlow.value = Math.sin(p * Math.PI);
        this.pot.pourUniforms.uTurbidity.value = this.turbidity;

        this.targetWaterLevel = THREE.MathUtils.lerp(0.76, 0.24, p);
        this.kitchen.sinkPoolMat.opacity = Math.sin(p * Math.PI) * (0.42 + this.turbidity * 0.45);
        this.kitchen.sinkPoolMat.color.setRGB(
          THREE.MathUtils.lerp(0.78, 0.94, this.turbidity),
          THREE.MathUtils.lerp(0.84, 0.95, this.turbidity),
          THREE.MathUtils.lerp(0.89, 0.96, this.turbidity)
        );
        this.kitchen.sinkPool.scale.setScalar(0.6 + p * 0.55);

        this.audio.setWaterStream(Math.sin(p * Math.PI), 760 + p * 380);

        if (Math.random() < 0.55) {
          this.splash.spawn(
            -3.55 + (Math.random() - 0.5) * 0.3,
            -1.02,
            0.05 + (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 1.4,
            1.2 + Math.random() * 1.1,
            (Math.random() - 0.5) * 1.4,
            0.85
          );
        }
      } else if (t < 2.35) {
        // Return pot back to washing counter
        const p = (t - 1.85) / 0.5;
        this.pot.pourStream.visible = false;
        this.potTargetPos.lerpVectors(POS.POT_POUR, POS.POT_WASH, p);
        this.potTargetRotZ = THREE.MathUtils.lerp(1.06, 0, p);
        this.kitchen.sinkPoolMat.opacity = Math.max(0, this.kitchen.sinkPoolMat.opacity - dt * 1.8);
        this.audio.setWaterStream(0);
      } else {
        // Start fresh crystal-clear water refill from chrome gooseneck faucet!
        this.pouring = false;
        this.refilling = true;
        this.refillAnim = 0;
        this.pot.contactShadow.visible = true;
        this.starchMap.clear();
        this.turbidity = 0.02;
        this.targetTurbidity = 0.02;
      }
    }

    if (this.refilling) {
      wantFaucet = true;
      this.refillAnim += dt;
      const p = Math.min(1, this.refillAnim / 1.45);
      this.targetWaterLevel = THREE.MathUtils.lerp(0.24, 0.78, p);
      this.water.uniforms.uSplashPos.value.set(-0.08, -0.05);

      if (Math.random() < 0.5) {
        this.splash.spawn(
          POS.POT_WASH.x - 0.05,
          this.waterLevel + 0.04,
          POS.POT_WASH.z,
          (Math.random() - 0.5) * 1.1,
          1.1 + Math.random() * 1.0,
          (Math.random() - 0.5) * 1.1,
          0.75
        );
      }

      if (p >= 1.0) {
        this.refilling = false;
        this.washProgress = 0;
        if (this.stage === STAGES.POUR_1) {
          this.stage = STAGES.WASH_2;
        } else {
          // 2nd rinse done & fresh cooking water filled to the gleaming line -> ready for rice cooker!
          this.stage = STAGES.LOAD_POT;
        }
        this.stageTime = 0;
        this.idleTime = 0;
      }
    }

    // Smooth faucet lever & stream animation
    const targetFlow = wantFaucet ? 1.0 : 0.0;
    this.faucetFlow = THREE.MathUtils.lerp(this.faucetFlow, targetFlow, 1 - Math.exp(-dt * 12));
    this.faucet.leverPivot.rotation.x = -this.faucetFlow * 0.42;
    this.faucet.waterStream.visible = this.faucetFlow > 0.03;
    this.faucet.streamUniforms.uTime.value = this.time;
    this.faucet.streamUniforms.uFlow.value = this.faucetFlow;

    if (!this.pouring) {
      this.audio.setWaterStream(this.faucetFlow, 1180 + this.waterLevel * 380);
    }
  }

  _updateCookerState(dt) {
    // Glowing start button ring during PRESS_START
    if (this.stage === STAGES.PRESS_START) {
      const pulse = 0.75 + 0.45 * Math.sin(this.time * 4.2);
      this.cooker.startRingMat.emissiveIntensity = pulse;
      this.cooker.startRingMat.emissive.setHex(0xff9b3d);
      this.cooker.latchMat.emissiveIntensity = 0;
      this.cooker.ledDots.forEach((m) => (m.emissiveIntensity = 0));
    } else if (this.stage === STAGES.COOKING) {
      this.cookProgress = Math.min(1.0, this.cookProgress + dt / this.cookDuration);
      this.cooker.startRingMat.emissiveIntensity = 1.15;
      this.cooker.startRingMat.emissive.setHex(0xff7d29);

      // 3 minimalist progress LED dots light sequentially
      this.cooker.ledDots.forEach((m, i) => {
        const threshold = (i + 0.15) / 3;
        m.emissiveIntensity = this.cookProgress >= threshold ? 1.2 : 0.12;
      });

      // Rhythmic steam plumes from stainless steam vent during active boiling
      const boilFactor = THREE.MathUtils.smoothstep(this.cookProgress, 0.12, 0.88);
      this.audio.setSteamLevel(boilFactor);
      if (boilFactor > 0.1 && Math.random() < dt * (4 + boilFactor * 14)) {
        this._emitCookerSteamBurst(1);
      }

      // Smoothly transform rice inside from raw submerged -> plump steamed cooked rice!
      this.cookedBlend = THREE.MathUtils.smoothstep(this.cookProgress, 0.25, 0.95);
      if (this.cookedBlend > 0.5) {
        this.water.mesh.visible = false; // Water absorbed into plump steamed rice!
      }

      if (this.cookProgress >= 1.0) {
        this.audio.setSteamLevel(0);
        this.audio.playCookDoneChime();
        this.stage = STAGES.OPEN_LID;
        this.stageTime = 0;
        this.idleTime = 0;
        this._finalizeCookedRiceLook();
      }
    } else if (this.stage === STAGES.OPEN_LID) {
      this.cooker.startRingMat.emissive.setHex(0xffe9c7);
      this.cooker.startRingMat.emissiveIntensity = 0.65;
      this.cooker.ledDots.forEach((m) => {
        m.emissive.setHex(0xfff1d6);
        m.emissiveIntensity = 0.85;
      });
      this.cooker.latchMat.emissiveIntensity = 0.45 + 0.35 * Math.sin(this.time * 4.5);
    } else {
      this.cooker.startRingMat.emissiveIntensity = 0.0;
      this.cooker.latchMat.emissiveIntensity = 0.0;
      this.cooker.ledDots.forEach((m) => (m.emissiveIntensity = 0.0));
      this.audio.setSteamLevel(0);
    }
  }

  _finalizeCookedRiceLook() {
    this.cookedBlend = 1.0;
    this.water.mesh.visible = false;
    this.potRiceMat.userData.riceUniforms.uCooked.value = 1.0;
    this.potRiceMat.userData.riceUniforms.uWetness.value = 1.0;
    this.potRiceMat.roughness = 0.16;
    this.potRiceMat.clearcoat = 0.92;
    this.potRiceMat.clearcoatRoughness = 0.12;
    this.potRiceBed.position.y = 0.66;
    this.potRiceBed.scale.set(1.12, 2.30, 1.12);
    this.potRiceBedMat.color.setHex(0xf3efe5);
    this.potRiceBedMat.roughness = 0.26;
    this.potRiceBedMat.clearcoat = 0.72;

    for (let i = 0; i < this.potGrainCount; i++) {
      this._setGrainBaseColor(i, 1.0, 0.0);
    }
    this.potRiceMesh.instanceColor.needsUpdate = true;
  }

  _updatePotRiceTransforms(dt) {
    const isWashing = this.stage === STAGES.WASH_1 || this.stage === STAGES.WASH_2;
    const isCooked = this.cookedBlend > 0.5;
    const baseHeight = isCooked ? 0.80 - this.bowlScoops * 0.045 : 0.39;
    const scaleBoost = isCooked ? 1.24 : 1.02;

    for (let i = 0; i < this.potGrainCount; i++) {
      const g = this.grains[i];

      if (isWashing && this.swirlSpeed > 0.01) {
        // Fluid vortex swirling of individual submerged rice grains!
        const angularVel = (1.6 + (1.0 - g.r) * 2.2) * this.swirlSpeed;
        g.angle += angularVel * dt;

        // Lift grains near the hand's submerged fingertips
        const gx = Math.cos(g.angle) * g.r;
        const gz = Math.sin(g.angle) * g.r;
        const distToHand = Math.hypot(gx - this.handLocalInPot.x, gz - this.handLocalInPot.y);
        if (distToHand < 0.38) {
          g.vy = Math.max(g.vy, (1 - distToHand / 0.38) * 1.45 * this.swirlSpeed);
          g.rx += dt * 4.5 * this.swirlSpeed;
          g.rz += dt * 3.8 * this.swirlSpeed;
        }
      }

      // Gravity & buoyancy settle
      if (g.lift > 0 || g.vy !== 0) {
        g.lift += g.vy * dt;
        g.vy -= (isCooked ? 6.2 : 3.2) * dt; // slower underwater settle!
        if (g.lift <= 0) {
          g.lift = 0;
          g.vy = 0;
        }
      }

      const radialScale = isCooked ? 1.14 : 1.0; // expands smoothly edge-to-edge against upper pot wall when steamed!
      const x = Math.cos(g.angle) * g.r * radialScale;
      const z = Math.sin(g.angle) * g.r * radialScale;
      const dome = isCooked ? g.cookedDome + g.fluff * (0.11 + g.fluffRandY) : -g.r * g.r * 0.14;
      const y = baseHeight + g.yOffset + dome + g.lift;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(g.rx, g.ry + g.angle, g.rz);
      const s = g.scaleVar * scaleBoost;
      this.dummy.scale.set(s, s * (isCooked ? 1.12 : 1.0), s * (isCooked ? 1.15 : 1.0));
      this.dummy.updateMatrix();
      this.potRiceMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.potRiceMesh.instanceMatrix.needsUpdate = true;
  }

  _updateHandAndTools(dt) {
    const potPos = this.pot.group.position;
    const damp = 1 - Math.exp(-dt * 11);

    if (this.stage === STAGES.WASH_1 || this.stage === STAGES.WASH_2) {
      this.hand.group.visible = true;
      if (!this.handActive) {
        if (this.hintActive) {
          // Gentle 1-time circular washing hint after 10s idle
          const a = this.hintProgress * Math.PI * 2;
          this.handTargetPos.set(potPos.x + Math.cos(a) * 0.42 + 0.12, 1.08, potPos.z + Math.sin(a) * 0.42 + 0.34);
          this.hand.setPose('wash', 0.4);
        } else {
          // Graceful ready hover from RIGHT-FRONT (+X, +Z) so the entire glistening rice pot shines cleanly!
          const breath = Math.sin(this.time * 1.9) * 0.025;
          this.handTargetPos.set(potPos.x + 1.05, 1.24 + breath, potPos.z + 0.36);
          this.handTargetRot.set(-0.22, 0.86, 0.08);
          this.hand.setPose('wash', 0);
        }
      } else {
        this.hand.setPose('wash', 0.55 + Math.sin(this.time * 14) * 0.18);
      }
    } else if (this.stage === STAGES.POUR_1 || this.stage === STAGES.POUR_2) {
      this.hand.group.visible = true;
      if (this.pouring) {
        // Right hand naturally supports the upper-right tilted rim while pouring milky togi-jiru into sink!
        this.handTargetPos.set(potPos.x + 0.38, potPos.y + 1.12, potPos.z + 0.58);
        this.handTargetRot.set(-0.38, 0.72, -0.32);
        this.hand.setPose('open', 0);
      } else if (this.hintActive) {
        // Single gentle leftward gesture toward sink after 10s idle
        const p = Math.sin(this.hintProgress * Math.PI);
        this.handTargetPos.set(potPos.x + 0.65 - p * 0.85, 1.30, potPos.z + 0.40);
        this.handTargetRot.set(-0.22, 0.82, 0.12);
      } else {
        const breath = Math.sin(this.time * 2.0) * 0.025;
        this.handTargetPos.set(potPos.x + 1.05, 1.22 + breath, potPos.z + 0.36);
        this.handTargetRot.set(-0.20, 0.84, 0.08);
      }
    } else if (this.stage === STAGES.FLUFF) {
      this.hand.group.visible = true;
      this.hand.setPose('hold_shamoji', 0);
      if (!this.handActive) {
        const cx = POS.COOKER.x;
        const cz = POS.COOKER.z;
        if (this.hintActive) {
          const swing = Math.sin(this.hintProgress * Math.PI * 2) * 0.45;
          this.shamoji.group.position.lerp(new THREE.Vector3(cx + swing + 0.32, 1.56, cz + 0.38), damp);
          this.shamoji.group.rotation.set(0.38, 0.42, -swing * 0.4);
        } else {
          const hover = Math.sin(this.time * 2.2) * 0.03;
          this.shamoji.group.position.lerp(new THREE.Vector3(cx + 0.42, 1.62 + hover, cz + 0.42), damp);
          this.shamoji.group.rotation.set(0.36, 0.44, -0.12);
        }
        this.handTargetPos.copy(this.shamoji.group.position).add(new THREE.Vector3(0.32, 0.16, 0.48));
        this.handTargetRot.set(-0.18, 0.48, 0.10);
      }
    } else if (this.stage === STAGES.SCOOP) {
      this.hand.group.visible = true;
      this.hand.setPose('hold_shamoji', 0);
      if (!this.scoopDragging) {
        if (this.scoopDropAnim > 0) {
          this.scoopDropAnim -= dt;
          const b = this._getBowlWorldPos();
          this.shamoji.group.position.lerp(new THREE.Vector3(b.x, b.y + 1.15, b.z + 0.35), damp);
          this.shamoji.group.rotation.set(0.52, 0.25, -0.55);
        } else if (this.scoopLoaded) {
          // Holding heaped steaming rice above pot ready to carry to ceramic bowl
          const hover = Math.sin(this.time * 2.8) * 0.035;
          this.shamoji.group.position.lerp(new THREE.Vector3(POS.COOKER.x + 0.85, 1.72 + hover, POS.COOKER.z + 0.45), damp);
          this.shamoji.group.rotation.set(0.10, 0.34, -0.06);
        } else if (this.hintActive) {
          const b = this._getBowlWorldPos();
          const t = Math.sin(this.hintProgress * Math.PI);
          this.shamoji.group.position.lerp(
            new THREE.Vector3(
              THREE.MathUtils.lerp(POS.COOKER.x + 0.25, b.x, t),
              1.68 + Math.sin(t * Math.PI) * 0.45,
              THREE.MathUtils.lerp(POS.COOKER.z + 0.35, b.z + 0.35, t)
            ),
            damp
          );
        } else {
          const hover = Math.sin(this.time * 2.1) * 0.03;
          this.shamoji.group.position.lerp(new THREE.Vector3(POS.COOKER.x + 0.42, 1.66 + hover, POS.COOKER.z + 0.48), damp);
          this.shamoji.group.rotation.set(0.30, 0.42, -0.14);
        }
        this.handTargetPos.copy(this.shamoji.group.position).add(new THREE.Vector3(0.30, 0.14, 0.48));
        this.handTargetRot.set(-0.16, 0.46, 0.08);
      }
    } else if (this.stage === STAGES.SERVE) {
      // Rest shamoji neatly clear of the serving tray & masu cup so the steaming hero bowl shines!
      this.shamoji.group.position.lerp(new THREE.Vector3(2.15, 0.14, 1.65), damp * 0.6);
      this.shamoji.group.rotation.set(0, -0.45, 0);
      this.hand.group.visible = false;
    } else {
      // LOAD_POT / CLOSE_LID / PRESS_START / COOKING / OPEN_LID:
      // Hide hand cleanly except during subtle 10-second idle hint
      if (this.hintActive) {
        this.hand.group.visible = true;
        this.hand.setPose('open', 0);
        const p = Math.sin(this.hintProgress * Math.PI);
        if (this.stage === STAGES.LOAD_POT) {
          this.handTargetPos.set(THREE.MathUtils.lerp(POS.POT_WASH.x, POS.COOKER.x, p), 1.65 + p * 0.3, 0.45);
        } else if (this.stage === STAGES.CLOSE_LID) {
          this.handTargetPos.set(POS.COOKER.x + 0.15, 2.75 - p * 0.95, POS.COOKER.z + 0.25);
        } else if (this.stage === STAGES.PRESS_START) {
          this.handTargetPos.set(POS.COOKER.x + 0.05, 1.25, POS.COOKER.z + 2.05 - p * 0.32);
        } else if (this.stage === STAGES.OPEN_LID) {
          this.handTargetPos.set(POS.COOKER.x + 0.1, 1.45 + p * 0.85, POS.COOKER.z + 1.55);
        }
      } else {
        this.hand.group.visible = false;
      }
    }

    this.handWorldPos.lerp(this.handTargetPos, damp);
    this.hand.group.position.copy(this.handWorldPos);
    this.hand.group.rotation.x = THREE.MathUtils.lerp(this.hand.group.rotation.x, this.handTargetRot.x, damp);
    this.hand.group.rotation.y = THREE.MathUtils.lerp(this.hand.group.rotation.y, this.handTargetRot.y, damp);
    this.hand.group.rotation.z = THREE.MathUtils.lerp(this.hand.group.rotation.z, this.handTargetRot.z, damp);
  }

  _updateTastingSpoon(dt) {
    if (!this.spoonActive) return;
    this.spoonAnim += dt;
    const b = this._getBowlWorldPos();
    const t = this.spoonAnim;

    if (t < 0.45) {
      const p = t / 0.45;
      this.spoon.group.position.set(b.x + 0.48 - p * 0.42, b.y + 1.18 - p * 0.36, b.z + 0.55 - p * 0.28);
      this.spoon.group.rotation.set(0.45 - p * 0.35, 0.25, 0.1);
    } else if (t < 1.25) {
      if (!this.spoon.biteGroup.visible) {
        this.spoon.biteGroup.visible = true;
        this.bowlBites = Math.min(5, this.bowlBites + 1);
        this._refreshBowlRiceVisuals();
        this.audio.playHappyBite();
        // Extra joyful steam from freshly scooped bite!
        for (let i = 0; i < 4; i++) {
          this.steam.emit(b.x, b.y + 0.95, b.z, {
            spread: 0.28,
            rise: 0.72,
            baseScale: 0.26,
            maxScale: 1.15,
            opacity: 0.28,
            life: 1.8,
          });
        }
      }
      const p = (t - 0.45) / 0.80;
      this.spoon.group.position.set(b.x + 0.06, b.y + 0.82 + p * 0.75, b.z + 0.27 + p * 0.95);
      this.spoon.group.rotation.set(0.08, 0.15, 0.05);
    } else {
      this.spoonActive = false;
      this.spoon.group.visible = false;
      this.spoon.biteGroup.visible = false;
    }
  }

  /**
   * Jump directly to a stage (used strictly for automated visual quality verification)
   */
  debugJumpStage(targetStage) {
    this._resetToWash1(true);
    if (targetStage === STAGES.WASH_1) return;

    if (targetStage === 'WASH_1_CLOUDY') {
      this.stage = STAGES.WASH_1;
      this.washProgress = 0.78;
      this.turbidity = 0.74;
      this.targetTurbidity = 0.74;
      this.swirlSpeed = 0.78;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.starchMap.addStarchPlume(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.28, 0.30);
      }
      this.starchMap.advect(0.35, 0.70);
      this.handActive = true;
      this.handWorldPos.set(POS.POT_WASH.x + 0.38, 1.06, POS.POT_WASH.z + 0.28);
      this.handTargetPos.copy(this.handWorldPos);
      this.handTargetRot.set(-0.34, 0.80, 0.12);
      this.hand.group.position.copy(this.handWorldPos);
      this.hand.group.rotation.copy(this.handTargetRot);
      this.hand.setPose('wash', 0.6);
      return;
    }

    if (targetStage === STAGES.POUR_1) {
      this.stage = STAGES.POUR_1;
      this.turbidity = 0.88;
      this.targetTurbidity = 0.88;
      this.pouring = true;
      this.pourAnim = 1.05;
      this.pot.group.position.copy(POS.POT_POUR);
      this.potTargetPos.copy(POS.POT_POUR);
      this.pot.group.rotation.z = 0.88;
      this.potTargetRotZ = 0.88;
      this.pot.group.updateMatrixWorld(true);
      const rimWorld = new THREE.Vector3(-0.98, 1.08, 0.0).applyMatrix4(this.pot.group.matrixWorld);
      this.pot.pourStream.position.copy(rimWorld);
      this.pot.pourStream.visible = true;
      this.pot.pourUniforms.uFlow.value = 0.95;
      this.pot.pourUniforms.uTurbidity.value = 0.88;
      this.kitchen.sinkPoolMat.opacity = 0.82;
      this.pot.contactShadow.visible = false;
      this.handWorldPos.set(POS.POT_POUR.x + 0.38, POS.POT_POUR.y + 1.12, POS.POT_POUR.z + 0.58);
      this.handTargetPos.copy(this.handWorldPos);
      this.handTargetRot.set(-0.38, 0.72, -0.32);
      this.hand.group.position.copy(this.handWorldPos);
      this.hand.group.rotation.copy(this.handTargetRot);
      return;
    }

    if (targetStage === STAGES.LOAD_POT) {
      this.stage = STAGES.LOAD_POT;
      return;
    }

    if (targetStage === STAGES.COOKING) {
      this._seatPotInCooker();
      this.pot.group.position.copy(POS.POT_IN_COOKER);
      this.lidAngle = 0;
      this.targetLidAngle = 0;
      this.cooker.lidPivot.rotation.x = 0;
      this.stage = STAGES.COOKING;
      this.cookProgress = 0.58;
      // Pre-step steam particles so billowing north-window-backlit plume is tall and lush!
      for (let step = 0; step < 18; step++) {
        this._emitCookerSteamBurst(2);
        this.steam.update(0.10);
      }
      return;
    }

    if (targetStage === STAGES.FLUFF) {
      this._seatPotInCooker();
      this.pot.group.position.copy(POS.POT_IN_COOKER);
      this.lidAngle = 1.44;
      this.targetLidAngle = 1.44;
      this.cooker.lidPivot.rotation.x = -1.44;
      this._finalizeCookedRiceLook();
      this.stage = STAGES.FLUFF;
      this.shamoji.group.position.set(POS.COOKER.x + 0.40, 1.54, POS.COOKER.z + 0.42);
      this.shamoji.group.rotation.set(0.36, 0.44, -0.12);
      this.hand.group.visible = true;
      this.hand.setPose('hold_shamoji', 0);
      this.handTargetPos.copy(this.shamoji.group.position).add(new THREE.Vector3(0.32, 0.16, 0.48));
      this.handWorldPos.copy(this.handTargetPos);
      this.handTargetRot.set(-0.18, 0.48, 0.10);
      this.hand.group.position.copy(this.handWorldPos);
      this.hand.group.rotation.copy(this.handTargetRot);
      for (let i = 0; i < this.potGrainCount; i++) {
        if (i % 3 === 0) this.grains[i].fluff = 0.75;
        this._setGrainBaseColor(i, 1.0, this.grains[i].fluff);
      }
      this.potRiceMesh.instanceColor.needsUpdate = true;
      this._updatePotRiceTransforms(0.016);
      for (let step = 0; step < 12; step++) {
        this._emitPotSteam(2);
        this.steam.update(0.10);
      }
      return;
    }

    if (targetStage === STAGES.SCOOP) {
      this.debugJumpStage(STAGES.FLUFF);
      this.stage = STAGES.SCOOP;
      this.scoopLoaded = true;
      this.shamoji.scoopRiceGroup.visible = true;
      this.shamoji.group.position.set(POS.COOKER.x + 0.92, 1.62, POS.COOKER.z + 0.44);
      this.shamoji.group.rotation.set(0.10, 0.34, -0.06);
      this.handTargetPos.copy(this.shamoji.group.position).add(new THREE.Vector3(0.30, 0.14, 0.48));
      this.handWorldPos.copy(this.handTargetPos);
      this.handTargetRot.set(-0.16, 0.46, 0.08);
      this.hand.group.position.copy(this.handWorldPos);
      this.hand.group.rotation.copy(this.handTargetRot);
      this.bowlScoops = 1;
      this._refreshBowlRiceVisuals();
      return;
    }

    if (targetStage === STAGES.SERVE) {
      this.debugJumpStage(STAGES.FLUFF);
      this.stage = STAGES.SERVE;
      this.stageTime = 3.5;
      this.bowlScoops = 3;
      this._refreshBowlRiceVisuals();
      this._placeUmeboshi();
      this._sprinkleSesame();
      this._sprinkleNori();
      this.shamoji.group.position.set(2.15, 0.14, 1.65);
      this.shamoji.group.rotation.set(0, -0.45, 0);
      this.hand.group.visible = false;
      const b = this._getBowlWorldPos();
      for (let step = 0; step < 14; step++) {
        this.steam.emit(b.x, b.y + 0.82, b.z, {
          spread: 0.44,
          rise: 0.62,
          baseScale: 0.34,
          maxScale: 1.48,
          opacity: 0.34,
          life: 2.6,
        });
        this.steam.update(0.10);
      }
      return;
    }
  }
}
