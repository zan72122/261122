// Main Entry Point: Photorealistic 3D Dish Washing Game for 5yo Girl
// Wordless, One-Finger Touch/Pointer Controls, Responsive Portrait & Landscape Framing,
// Real-Time Foam/Water Physics, 10s Idle Gentle Hand Demo, & Grand Strawberry Cake Reward Stage.

import * as THREE from 'three';
import { SoundEngine } from './audio.js';
import { createKitchenTextures } from './textures.js';
import { buildKitchenEnvironment, KitchenWorld } from './environment.js';
import { FoamAndWaterFX } from './foam.js';
import { HelperGirl, PlayerHand } from './characters.js';
import { DISH_RECIPES, DishItem, PartyDessertSet } from './dishes.js';

class DishWashingGame {
  constructor() {
    this.container = document.getElementById('app');

    // 1. Renderer — Strictly capped pixelRatio <= 1.5 for smooth 60fps on iPhone/iPad!
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xefe4d4);

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.2, 25);
    this.lookAtTarget = new THREE.Vector3(0.05, 0.14, -0.22);

    // 3. Realistic Sunlit Kitchen Studio HDRI + Warm Directional Key Light (shadowMap <= 1024px)
    const envTex = buildKitchenEnvironment(this.renderer);
    this.scene.environment = envTex;

    const hemi = new THREE.HemisphereLight(0xfff9ee, 0xc49c76, 0.72);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff5e4, 1.85);
    this.sunLight.position.set(-2.8, 5.2, 2.9);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024); // Strictly <= 1024px!
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 14.0;
    const sc = 3.6;
    this.sunLight.shadow.camera.left = -sc;
    this.sunLight.shadow.camera.right = sc;
    this.sunLight.shadow.camera.top = sc;
    this.sunLight.shadow.camera.bottom = -sc;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);

    const warmFill = new THREE.PointLight(0xffdfb8, 0.9, 9);
    warmFill.position.set(2.2, 2.6, 1.8);
    this.scene.add(warmFill);

    // 4. Subsystems
    this.sound = new SoundEngine();
    this.textures = createKitchenTextures();
    this.world = new KitchenWorld(this.scene, this.textures);
    this.fx = new FoamAndWaterFX(this.scene, this.textures);
    this.girl = new HelperGirl(this.scene, this.textures);
    this.hand = new PlayerHand(this.scene);
    this.partySet = new PartyDessertSet(this.scene, this.world.woodMat);

    // 5. Gameplay State
    this.dishIndex = 0;
    this.waveCount = 0;
    this.activeDish = null;
    this.rackedDishes = [];
    this.dishHomePos = new THREE.Vector3(-0.08, -0.34, 0.30);
    this.dishTargetPos = this.dishHomePos.clone();
    this.dishTargetRot = new THREE.Euler(0.36, 0, 0);

    // Sponge state
    this.spongeSoapCharges = 0; // 0..1.5
    this.spongeFoamLevel = 0; // 0..1 (grows when squeezed or rubbed!)
    this.spongeTintHex = 0xfff3c4;
    this.hasCitrus = false;
    this.hasBerry = false;
    this.spongeTargetPos = this.world.spongeHome.clone();
    this.spongeSquish = 0;

    // Input & One-Finger Pointer Tracking (ignores secondary multi-touch pointers safely)
    this.activePointerId = null;
    this.pointerNDC = new THREE.Vector2();
    this.prevPointerNDC = new THREE.Vector2();
    this.dragMode = null; // 'sponge' | 'dish' | 'treat' | 'bare_dish'
    this.draggedTreat = null;
    this.raycaster = new THREE.Raycaster();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.1);
    this.sinkDragPlane = new THREE.Plane(new THREE.Vector3(0, 0.88, 0.46).normalize(), 0.16);

    // Intro & Idle Hint Timers ("0-6秒は何もしない、10秒以降に環境の動き/手で1回だけそっと誘う")
    this.elapsed = 0;
    this.introEatTimer = 2.2; // Girl finishes juicy bite while Dish 1 is ALREADY interactive!
    this.idleTimer = 0;
    this.idleDemoShownForState = false;
    this.demoAnim = null;

    this.clock = new THREE.Clock();

    this._spawnDish(0, true);
    this._bindEvents();
    this._onResize();

    // Expose hook for automated visual & FPS verification
    window.__GAME__ = this;

    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _spawnDish(recipeIdx, instant = false) {
    const recipe = DISH_RECIPES[recipeIdx % DISH_RECIPES.length];
    const dish = new DishItem(recipe, this.world.woodMat);
    this.scene.add(dish.group);
    this.activeDish = dish;

    if (instant) {
      dish.group.position.copy(this.dishHomePos);
      dish.group.rotation.copy(this.dishTargetRot);
    } else {
      // Cheerful girl slides the new big messy dish from the counter right into the sink!
      dish.group.position.set(0.38, 0.36, -1.05);
      dish.group.rotation.set(0.15, 0.25, 0);
      this.girl.setMood('yummy', 1.2);
    }
    this.dishTargetPos.copy(this.dishHomePos);
    this.dishTargetRot.set(0.36, 0, 0);
    this.idleTimer = 0;
    this.idleDemoShownForState = false;
  }

  _bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => this._onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._onPointerUp(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e), { passive: false });
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.camera.aspect = aspect;

    this.world.adaptLayout(aspect);
    this.girl.adaptLayout(aspect);
    this.hand.adaptLayout(aspect);
    if (this.dragMode !== 'sponge') {
      this.spongeTargetPos.copy(this.world.spongeHome);
    }

    // Responsive framing for BOTH iPhone Portrait & iPad Landscape!
    if (aspect < 0.86) {
      // Portrait iPhone: fit horizontal half-width ~1.76 comfortably while keeping Dish & Girl HUGE!
      const fov = 48;
      this.camera.fov = fov;
      const halfTan = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
      const neededDist = Math.max(5.1, 1.78 / (halfTan * aspect));
      this.lookAtTarget.set(0.0, 0.14, -0.15);
      this.camera.position.set(0.0, 0.14 + neededDist * 0.52, -0.15 + neededDist * 0.84);
    } else {
      // Landscape iPad & 4:3 (thumb.jpg): fit full counter width [-2.55 .. +2.55] closely!
      const fov = 39;
      this.camera.fov = fov;
      const halfTan = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
      const neededDist = Math.max(4.65, 2.58 / (halfTan * aspect));
      this.lookAtTarget.set(0.02, 0.22, -0.22);
      this.camera.position.set(0.02, 0.22 + neededDist * 0.50, -0.22 + neededDist * 0.86);
    }

    this.camera.lookAt(this.lookAtTarget);
    this.camera.updateProjectionMatrix();
  }

  _updateNDC(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _resetIdle() {
    this.idleTimer = 0;
    this.idleDemoShownForState = false;
    this.demoAnim = null;
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.sound.unlock();

    // Multi-touch safety: ignore secondary fingers while primary finger is active
    if (this.activePointerId !== null) return;
    this.activePointerId = e.pointerId;

    this._updateNDC(e);
    this.prevPointerNDC.copy(this.pointerNDC);
    this._resetIdle();

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // 0. Always let the child pop floating rainbow soap bubbles with a tap!
    const poppedBubble = this.fx.tryPopFloatingBubble(this.raycaster, (popPos) => {
      this.sound.playBubblePop(1.0);
      this.hand.moveTo(popPos.clone().add(new THREE.Vector3(0.08, -0.05, 0.25)), 0.7, true);
      if (Math.random() < 0.45) {
        this.girl.setMood('giggle', 1.2);
        this.sound.playVoice('giggle');
      }
    });
    if (poppedBubble) return;

    // GRAND REWARD STAGE: Interactive Strawberry Shortcake Party!
    if (this.partySet.active) {
      this._handlePartyPointerDown();
      return;
    }

    // 1. Check Soap Pump Bottles (Citrus Yellow & Berry Pink)
    const soapTargets = [this.world.citrusSoap.hit];
    if (this.world.berrySoapUnlocked) soapTargets.push(this.world.berrySoap.hit);
    const soapHits = this.raycaster.intersectObjects(soapTargets, false);
    if (soapHits.length > 0) {
      const isBerry = soapHits[0].object === this.world.berrySoap.hit;
      this._pumpSoap(isBerry);
      return;
    }

    // 2. Check Faucet Spout Aerator Tip (toggles Stream <-> Shower when water is on, or turns water on!)
    if (this.raycaster.intersectObject(this.world.spoutHit, false).length > 0) {
      if (!this.world.faucetOn) {
        this._toggleFaucet(true);
      } else {
        this.world.showerMode = !this.world.showerMode;
        this.sound.playFaucetClick(true);
        this.fx.spawnSplashDrops(this.world.spoutWorldPos, 10, 1.1);
        this.girl.setMood('ooh', 1.1);
      }
      this.hand.moveTo(this.world.spoutWorldPos.clone().add(new THREE.Vector3(0.15, 0.05, 0.3)), 0.7, true);
      this.hand.pulseSqueeze();
      return;
    }

    // 3. Check Chrome Faucet Lever / Neck (toggles running water ON / OFF!)
    if (this.raycaster.intersectObject(this.world.faucetHit, false).length > 0) {
      this._toggleFaucet(!this.world.faucetOn);
      return;
    }

    // 4. Check Rubber Sink Drain Stopper (plugs/unplugs sink to fill water & make whirlpool!)
    if (this.raycaster.intersectObject(this.world.stopperHit, false).length > 0) {
      this.world.drainPlugged = !this.world.drainPlugged;
      this.sound.playStopperPop(this.world.drainPlugged);
      const sp = this.world.stopperGroup.position.clone().add(new THREE.Vector3(0.15, 0.25, 0.32));
      this.hand.moveTo(sp, 0.85);
      this.hand.pulseSqueeze();
      if (this.world.drainPlugged && !this.world.faucetOn) {
        // Helpful physical affordance: if she plugs the drain, gentle bounce on faucet invites filling!
        this.girl.setMood('ooh', 1.2);
      } else if (!this.world.drainPlugged && this.world.waterLevel > 0.25) {
        this.girl.setMood('giggle', 1.6);
        this.sound.playVoice('giggle');
      }
      return;
    }

    // 5. Check Sponge (Tap = squeeze & whip up lather! Drag = pick up & scrub!)
    if (this.raycaster.intersectObject(this.world.spongeHit, false).length > 0) {
      this.dragMode = 'sponge';
      this._squeezeSponge();
      return;
    }

    // 6. Check Active Dish in Sink
    if (this.activeDish && this.raycaster.intersectObject(this.activeDish.hitDisc, false).length > 0) {
      const hit = this.raycaster.intersectObject(this.activeDish.hitDisc, false)[0];
      // Forgiving 5yo gesture mapping:
      // - If dish is sparkling clean -> grab dish to slide into the Drying Rack (or tap rack / rub for squeak)!
      // - If water is running AND dish is already covered in suds (dirt low) -> drag dish under water to rinse!
      // - If sponge ALREADY has soap/foam AND dish still has dirt -> smoothly bring sponge to finger to scrub!
      if (this.activeDish.isSparklingClean) {
        this.dragMode = 'dish';
        this.sound.playSqueak(0.85, this.activeDish.recipe.pitchScale, this.activeDish.recipe.isGlass);
        this.fx.spawnSparkles(hit.point, 3);
        this.hand.moveTo(hit.point.clone().add(new THREE.Vector3(0.18, 0.16, 0.32)), 0.75);
      } else if (this.world.faucetOn && this.activeDish.surface.dirtRatio < 0.28) {
        this.dragMode = 'dish';
        this.hand.moveTo(hit.point.clone().add(new THREE.Vector3(0.22, 0.14, 0.32)), 0.75);
      } else if (this.spongeSoapCharges > 0.05 || this.spongeFoamLevel > 0.08) {
        this.dragMode = 'sponge';
        this.spongeTargetPos.copy(hit.point).add(new THREE.Vector3(0, 0.10, 0.06));
        this.hand.moveTo(this.spongeTargetPos.clone().add(new THREE.Vector3(0.12, 0.16, 0.28)), 0.8);
        this._scrubDishAt(hit.point, 0.8);
      } else {
        // Bare finger / unsoaped touch on dirty sauce -> tactile sticky smudge + gentle invite toward Soap & Sponge!
        this.dragMode = 'bare_dish';
        this.sound.playOilSlip();
        this.hand.moveTo(hit.point.clone().add(new THREE.Vector3(0.08, 0.14, 0.28)), 0.55, true);
        this.world.citrusPumpAnim = 0.65; // Soap bottle gives a subtle friendly bob ("小さく揺れる")
        this.spongeSquish = 0.6;
        this.girl.lookTarget.copy(this.world.citrusSoap.group.position);
      }
      return;
    }

    // 7. Check Drying Rack
    if (this.raycaster.intersectObject(this.world.rackHit, false).length > 0) {
      if (this.activeDish && this.activeDish.isSparklingClean) {
        // Forgiving tap shortcut: tapping the open rack when the dish is already clean places it right in!
        this._placeActiveDishInRack();
      } else {
        // Gentle metallic wobble ("他は小さく揺れる")
        this.world.rackWobble = 1.0;
        this.sound.playFaucetClick(false);
      }
      return;
    }

    // 8. Check Poking Filled Sink Water / Bubble Mountain ("ちょっかいで更に溢れる"!)
    if (this.world.waterLevel > 0.15 && this.raycaster.intersectObject(this.world.sinkWaterMesh, false).length > 0) {
      const pt = this.raycaster.intersectObject(this.world.sinkWaterMesh, false)[0].point;
      this.fx.spawnSplashDrops(pt, 12, 1.25);
      if (this.spongeSoapCharges > 0 || this.spongeFoamLevel > 0) {
        this.fx.spawnSinkBubbleMountain(pt, 8, this.spongeTintHex);
        this.sound.playSpongeSqueeze(0.9);
      } else {
        this.sound.playBubblePop(0.8);
      }
      this.hand.moveTo(pt.clone().add(new THREE.Vector3(0.1, 0.15, 0.28)), 0.6, true);
    }
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();

    this.prevPointerNDC.copy(this.pointerNDC);
    this._updateNDC(e);
    this._resetIdle();

    const moveDelta = this.pointerNDC.distanceTo(this.prevPointerNDC);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // Pop floating bubbles if swiped across!
    this.fx.tryPopFloatingBubble(this.raycaster, () => {
      this.sound.playBubblePop(0.85);
    });

    if (this.partySet.active && this.dragMode === 'treat' && this.draggedTreat) {
      const pt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, pt)) {
        // Also allow lifting upward toward the Helper Girl's mouth!
        if (this.pointerNDC.y > 0.18) {
          const girlMouth = this.girl.getMouthWorldPos();
          pt.lerp(girlMouth, Math.min(1, (this.pointerNDC.y - 0.18) * 1.6));
          this.girl.setMood('aaan', 0.4);
        }
        pt.y = Math.max(0.28, pt.y + (this.pointerNDC.y > 0.1 ? (this.pointerNDC.y - 0.1) * 1.4 : 0.24));
        this.draggedTreat.targetPos.copy(pt);
        this.hand.moveTo(pt.clone().add(new THREE.Vector3(0.14, 0.08, 0.30)), 0.72);
      }
      return;
    }

    if (this.dragMode === 'sponge') {
      // Check if sponge is dragged onto a Soap Bottle -> pumps soap!
      const soapTargets = [this.world.citrusSoap.hit];
      if (this.world.berrySoapUnlocked) soapTargets.push(this.world.berrySoap.hit);
      const soapHit = this.raycaster.intersectObjects(soapTargets, false);
      if (soapHit.length > 0 && this.spongeSoapCharges < 0.9) {
        this._pumpSoap(soapHit[0].object === this.world.berrySoap.hit);
      }

      // Check if sponge is scrubbing the Active Dish!
      if (this.activeDish) {
        const dishHits = this.raycaster.intersectObject(this.activeDish.hitDisc, false);
        if (dishHits.length > 0) {
          const hitPt = dishHits[0].point;
          this.spongeTargetPos.copy(hitPt).add(new THREE.Vector3(0, 0.09, 0.06));
          this.hand.moveTo(this.spongeTargetPos.clone().add(new THREE.Vector3(0.12, 0.15, 0.26)), 0.85);
          if (moveDelta > 0.003) {
            this._scrubDishAt(hitPt, moveDelta * 45);
          }
          return;
        }
      }

      // Otherwise move sponge freely across sink plane (and under running water!)
      const planePt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.sinkDragPlane, planePt)) {
        planePt.x = THREE.MathUtils.clamp(planePt.x, -2.35, 1.55);
        planePt.z = THREE.MathUtils.clamp(planePt.z, -0.65, 1.35);
        planePt.y = Math.max(-0.22, planePt.y);
        this.spongeTargetPos.copy(planePt);
        this.hand.moveTo(planePt.clone().add(new THREE.Vector3(0.12, 0.15, 0.28)), 0.78);

        // Stirring filled sink water with soapy sponge creates a GIANT Bubble Mountain!
        if (this.world.waterLevel > 0.2 && this.spongeSoapCharges > 0.05 && moveDelta > 0.01) {
          const surfPt = new THREE.Vector3(planePt.x, this.world.sinkWaterMesh.position.y, planePt.z);
          this.fx.spawnSinkBubbleMountain(surfPt, 4, this.spongeTintHex);
          this.sound.playScrub(1.1, 0.5, true);
        }
      }
    } else if (this.dragMode === 'dish' && this.activeDish) {
      const planePt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, planePt)) {
        planePt.x = THREE.MathUtils.clamp(planePt.x, -1.15, 2.35);
        planePt.z = THREE.MathUtils.clamp(planePt.z, -0.55, 1.05);
        // Lift dish smoothly over the right sink divider rim when dragging toward Drying Rack!
        const liftOverRim = planePt.x > 0.75 ? THREE.MathUtils.smoothstep(planePt.x, 0.75, 1.45) * 0.62 : 0.08;
        planePt.y = -0.24 + liftOverRim;
        this.dishTargetPos.copy(planePt);
        this.dishTargetRot.set(0.28, 0, -THREE.MathUtils.clamp((planePt.x - 0.5) * 0.35, 0, 0.5));
        this.hand.moveTo(planePt.clone().add(new THREE.Vector3(0.28, 0.16, 0.34)), 0.82);
      }
    } else if (this.dragMode === 'bare_dish' && this.activeDish) {
      const dishHits = this.raycaster.intersectObject(this.activeDish.hitDisc, false);
      if (dishHits.length > 0 && moveDelta > 0.008) {
        const hitPt = dishHits[0].point;
        this.activeDish.scrubWorldPoint(hitPt, 0, null);
        this.sound.playOilSlip();
        this.hand.moveTo(hitPt.clone().add(new THREE.Vector3(0.08, 0.14, 0.28)), 0.55, true);
      }
    }
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;

    if (this.partySet.active && this.dragMode === 'treat' && this.draggedTreat) {
      this._finishPartyTreatDrop(this.draggedTreat);
      this.draggedTreat = null;
      this.dragMode = null;
      this.hand.returnToRest();
      return;
    }

    if (this.dragMode === 'dish' && this.activeDish) {
      const rackDist = this.dishTargetPos.distanceTo(this.world.rackGroup.position);
      const swipedRightToRack = this.dishTargetPos.x > 0.85 || rackDist < 1.35;

      if (swipedRightToRack) {
        if (this.activeDish.isSparklingClean) {
          this._placeActiveDishInRack();
        } else {
          // Self-explanatory physical feedback if dish still has foam or sauce:
          // Drips a puff of suds/sauce, girl says "Oops!", and dish slides gently back into sink!
          this.world.rackWobble = 1.0;
          this.sound.playVoice('oops');
          this.girl.setMood('oops', 1.3);
          this.fx.spawnSplashDrops(this.activeDish.group.position, 8, 0.8);
          this.dishTargetPos.copy(this.dishHomePos);
          this.dishTargetRot.set(0.36, 0, 0);
        }
      } else {
        this.dishTargetPos.copy(this.dishHomePos);
        this.dishTargetRot.set(0.36, 0, 0);
      }
    }

    if (this.dragMode === 'sponge') {
      // Rest sponge conveniently back on its tray so the plate view stays clean & unobstructed!
      this.spongeTargetPos.copy(this.world.spongeHome);
    }

    this.dragMode = null;
    this.hand.returnToRest();
  }

  _pumpSoap(isBerry = false) {
    const bottle = isBerry ? this.world.berrySoap : this.world.citrusSoap;
    if (isBerry) {
      this.world.berryPumpAnim = 1.0;
      this.hasBerry = true;
    } else {
      this.world.citrusPumpAnim = 1.0;
      this.hasCitrus = true;
    }

    this.sound.playSoapPump(isBerry ? 1 : 0);

    // Mix soap colors if both bottles were pumped! ("マテリアル感のある混ぜる")
    if (this.hasCitrus && this.hasBerry) {
      this.spongeTintHex = 0xffb5a8; // Sunset peach-rose mix!
      this.world.soapGelMat.color.setHex(0xff7868);
      // Mixing soaps blows celebratory giant rainbow soap bubbles!
      const tipWorld = new THREE.Vector3();
      bottle.nozzleTip.getWorldPosition(tipWorld);
      for (let i = 0; i < 4; i++) {
        this.fx.spawnBubble(tipWorld, true, 0.09 + Math.random() * 0.07);
      }
    } else if (isBerry) {
      this.spongeTintHex = 0xffccd9;
      this.world.soapGelMat.color.setHex(0xf54784);
    } else {
      this.spongeTintHex = 0xfff3c4;
      this.world.soapGelMat.color.setHex(0xffb824);
    }

    this.spongeSoapCharges = Math.min(1.6, this.spongeSoapCharges + 0.85);
    this.spongeFoamLevel = Math.min(1.0, this.spongeFoamLevel + 0.35);
    this.world.soapGelMesh.visible = true;
    this.spongeSquish = 0.85;

    // Hand presses pump head visibly!
    const pumpPos = bottle.group.position.clone().add(new THREE.Vector3(0.18, 0.92, 0.25));
    this.hand.moveTo(pumpPos, 0.65);
    this.hand.pulseSqueeze();

    // Bring sponge momentarily close to catch the gel drop, then rest
    const catchPos = bottle.group.position.clone().add(new THREE.Vector3(0.32, 0.16, 0.32));
    this.world.spongeGroup.position.lerp(catchPos, 0.55);
    this.fx.spawnBubble(this.world.spongeGroup.position, true, 0.07);

    if (this.girl.mood === 'smile') {
      this.girl.setMood('ooh', 1.0);
    }
  }

  _squeezeSponge() {
    this.spongeSquish = 1.0;
    this.hand.moveTo(this.world.spongeGroup.position.clone().add(new THREE.Vector3(0.12, 0.16, 0.28)), 0.95);
    this.hand.pulseSqueeze();

    if (this.spongeSoapCharges > 0.05) {
      // Whip soap gel into rich fluffy 3D suds + floating bubbles!
      this.spongeFoamLevel = Math.min(1.0, this.spongeFoamLevel + 0.32);
      if (this.spongeFoamLevel > 0.6) {
        this.world.soapGelMesh.visible = false; // Gel has whipped into foam!
      }
      this.sound.playSpongeSqueeze(this.spongeFoamLevel);
      this.fx.spawnBubble(this.world.spongeGroup.position, true, 0.075 + Math.random() * 0.06);
      if (this.spongeFoamLevel > 0.75) {
        this.fx.spawnBubble(this.world.spongeGroup.position, true, 0.095);
      }
    } else {
      // Dry/plain sponge squish
      this.sound.playSpongeSqueeze(0.1);
    }
  }

  _scrubDishAt(worldPoint, speed = 1.0) {
    if (!this.activeDish) return;

    const hasSoap = this.spongeSoapCharges > 0.04;
    if (hasSoap) {
      // Rubbing on the dish automatically whips remaining soap gel into thick foam too!
      this.spongeFoamLevel = Math.min(1.0, this.spongeFoamLevel + 0.06);
      if (this.spongeFoamLevel > 0.55) this.world.soapGelMesh.visible = false;
      this.spongeSoapCharges = Math.max(0.08, this.spongeSoapCharges - 0.004);
    }

    const soapPower = hasSoap ? Math.max(0.55, this.spongeFoamLevel) : 0.0;
    this.spongeSquish = Math.max(this.spongeSquish, 0.45);

    const localPt = this.activeDish.scrubWorldPoint(worldPoint, soapPower, (popWorldPos, wasCrispy) => {
      if (wasCrispy) {
        this.sound.playCrustPop();
      } else {
        this.sound.playBubblePop(0.9);
      }
      this.fx.spawnSparkles(popWorldPos, 3);
    });

    if (hasSoap) {
      const cleanliness = 1 - this.activeDish.surface.dirtRatio;
      this.sound.playScrub(speed, cleanliness, true);

      // Deposit lush 3D foam mounds right on the dish!
      const dishSudCount = this.fx.countDishSuds(this.activeDish.group);
      if (dishSudCount < 145) {
        const tint = this.hasCitrus && this.hasBerry ? 0xffcfc4 : this.activeDish.recipe.sudsHex;
        this.fx.spawnDishSuds(this.activeDish.group, localPt, 3, tint);
      }
      if (Math.random() < 0.08) {
        this.fx.spawnBubble(worldPoint, true, 0.065 + Math.random() * 0.055);
      }
    } else {
      this.sound.playOilSlip();
      // Subtle nudge: soap bottle bobs gently so child notices soap is needed for oil!
      this.world.citrusPumpAnim = Math.max(this.world.citrusPumpAnim, 0.45);
    }

    this.girl.lookTarget.copy(worldPoint);
  }

  _toggleFaucet(turnOn) {
    this.world.faucetOn = turnOn;
    this.sound.playFaucetClick(turnOn);
    const leverPos = this.world.faucetGroup.position.clone().add(new THREE.Vector3(0.05, 0.42, 0.35));
    this.hand.moveTo(leverPos, 0.72);
    this.hand.pulseSqueeze();
  }

  _placeActiveDishInRack() {
    if (!this.activeDish) return;
    const dish = this.activeDish;
    dish.isRacked = true;
    this.activeDish = null;

    // Attach dish upright into the next open slot of the Stainless Steel Drying Rack!
    const slotIdx = this.rackedDishes.length % 4;
    const slotNode = this.world.rackSlots[slotIdx];
    slotNode.add(dish.group);
    dish.group.position.set(0, 0.16, 0);
    // Stand upright inside wire slot!
    dish.group.rotation.set(Math.PI * 0.46, 0, 0.04);
    dish.group.scale.setScalar(0.76);
    this.rackedDishes.push(dish);

    this.world.rackWobble = 0.85;
    this.sound.playRackClink();
    this.sound.playVoice('happy');
    this.girl.setMood('sparkle', 1.8);

    const slotWorld = this.world.getRackSlotWorldPos(slotIdx);
    this.fx.spawnSparkles(slotWorld, 8);
    this.fx.spawnSplashDrops(slotWorld, 6, 0.6);

    // Gently turn off faucet after rinsing & racking (unless child plugged drain for water play!)
    if (!this.world.drainPlugged && this.world.faucetOn) {
      this.world.faucetOn = false;
    }

    // Progressive Disclosure: After Dish 1 is racked, unlock the Pink Strawberry-Berry Dish Soap Bottle!
    if (this.dishIndex === 0) {
      this.world.unlockBerrySoap();
    }

    this.dishIndex++;

    // After 4 dishes are sparkling clean in the Drying Rack -> GRAND REWARD STAGE!
    if (this.rackedDishes.length >= 4) {
      setTimeout(() => this._startRewardParty(), 850);
    } else {
      setTimeout(() => this._spawnDish(this.dishIndex, false), 650);
    }
  }

  _startRewardParty() {
    this.world.faucetOn = false;
    this.world.partyMode = true;
    this.partySet.startParty();
    this.girl.setMood('sparkle', 2.6);
    this.sound.playVoice('party');
    this.fx.spawnSparkles(new THREE.Vector3(0.2, 0.5, 0.2), 14);
  }

  _handlePartyPointerDown() {
    const treatHits = this.raycaster.intersectObjects(
      this.partySet.treats.filter((t) => t.state !== 'eaten').map((t) => t.hit),
      false
    );
    if (treatHits.length > 0) {
      const hitObj = treatHits[0].object;
      const treat = this.partySet.treats.find((t) => t.hit === hitObj);
      if (treat) {
        this.dragMode = 'treat';
        this.draggedTreat = treat;
        this.sound.playBubblePop(0.85);
        this.hand.moveTo(treat.mesh.position.clone().add(new THREE.Vector3(0.14, 0.10, 0.30)), 0.72);
        return;
      }
    }

    // Tapping the Helper Girl directly when treats are plated feeds her the top treat!
    if (this.pointerNDC.y > 0.15) {
      const candidate = this.partySet.treats.find((t) => t.state === 'plated')
        || this.partySet.treats.find((t) => t.state === 'tray');
      if (candidate) {
        this._feedTreatToGirl(candidate);
      }
    }
  }

  _finishPartyTreatDrop(treat) {
    const mouthPos = this.girl.getMouthWorldPos();
    const distToGirl = treat.targetPos.distanceTo(mouthPos);
    const distToPlate = treat.targetPos.distanceTo(this.partySet.heroPlate.position);

    if (distToGirl < 0.85 || this.pointerNDC.y > 0.24) {
      this._feedTreatToGirl(treat);
    } else if (distToPlate < 0.95 || treat.state === 'tray') {
      // Snap neatly onto the sparkling clean hero plate!
      treat.state = 'plated';
      treat.targetPos.copy(treat.plateSlot);
      this.sound.playRackClink();
      this.fx.spawnSparkles(treat.plateSlot, 5);
      this.girl.setMood('ooh', 1.2);
      this.sound.playVoice('ooh');
    } else {
      treat.targetPos.copy(treat.home);
    }
  }

  _feedTreatToGirl(treat) {
    treat.state = 'eaten';
    this.partySet.eatenCount++;
    const mouthPos = this.girl.getMouthWorldPos();
    this.fx.spawnSparkles(mouthPos.clone().add(new THREE.Vector3(0, 0, 0.25)), 7);
    this.girl.setMood('yummy', 1.8);
    this.sound.playVoice('yummy');

    // Once all 5 party treats are happily eaten -> seamlessly transition into a fresh endless play wave!
    if (this.partySet.eatenCount >= this.partySet.treats.length) {
      setTimeout(() => {
        this.partySet.stopParty();
        this.world.partyMode = false;
        // Clear rack slots for the next joyful round of dishes!
        this.rackedDishes.forEach((d) => {
          if (d.group.parent) d.group.parent.remove(d.group);
          d.dispose();
        });
        this.rackedDishes = [];
        this.waveCount++;
        this._spawnDish(this.dishIndex, false);
      }, 1600);
    }
  }

  /**
   * Wordless 10s Idle Gentle Demonstration ("0-6秒は何もしない、10秒以降に手で1回だけ実演して引く")
   * Never completes the task for the child — just shows 1 tiny physical gesture!
   */
  _triggerSingleIdleDemo() {
    this.idleDemoShownForState = true;
    if (this.partySet.active) {
      const nextTreat = this.partySet.treats.find((t) => t.state === 'tray');
      if (nextTreat) {
        this.demoAnim = {
          t: 0,
          dur: 1.4,
          from: nextTreat.mesh.position.clone().add(new THREE.Vector3(0.1, 0.14, 0.28)),
          to: this.partySet.heroPlate.position.clone().add(new THREE.Vector3(0.1, 0.28, 0.28)),
        };
      }
      return;
    }
    if (!this.activeDish) return;

    if (this.spongeSoapCharges < 0.05) {
      // Gently tap-bob toward the Soap Pump once
      const p = this.world.citrusSoap.group.position.clone().add(new THREE.Vector3(0.18, 0.92, 0.25));
      this.demoAnim = { t: 0, dur: 1.3, from: this.hand.restPos.clone(), to: p, action: 'bob_soap' };
    } else if (!this.activeDish.isSparklingClean && this.activeDish.surface.dirtRatio >= 0.09) {
      // Gently move hand toward sponge -> dish center once
      this.demoAnim = {
        t: 0,
        dur: 1.5,
        from: this.world.spongeHome.clone().add(new THREE.Vector3(0.1, 0.16, 0.25)),
        to: this.dishHomePos.clone().add(new THREE.Vector3(0.15, 0.22, 0.28)),
      };
    } else if (!this.activeDish.isSparklingClean && !this.world.faucetOn) {
      // Dish is covered in suds -> gently gesture toward Chrome Faucet Lever
      const fp = this.world.faucetGroup.position.clone().add(new THREE.Vector3(0.05, 0.42, 0.35));
      this.demoAnim = { t: 0, dur: 1.3, from: this.hand.restPos.clone(), to: fp };
    } else if (this.activeDish.isSparklingClean) {
      // Dish is sparkling clean -> gently gesture from dish toward Drying Rack
      this.demoAnim = {
        t: 0,
        dur: 1.5,
        from: this.dishHomePos.clone().add(new THREE.Vector3(0.2, 0.18, 0.3)),
        to: this.world.rackGroup.position.clone().add(new THREE.Vector3(-0.1, 0.45, 0.3)),
      };
    }
  }

  _updateIdleDemo(dt) {
    if (!this.demoAnim) return;
    this.demoAnim.t += dt;
    const u = Math.min(1, this.demoAnim.t / this.demoAnim.dur);
    if (u < 0.72) {
      const k = THREE.MathUtils.smoothstep(u / 0.72, 0, 1);
      const pos = this.demoAnim.from.clone().lerp(this.demoAnim.to, k);
      this.hand.moveTo(pos, 0.65);
      if (this.demoAnim.action === 'bob_soap' && u > 0.45 && this.world.citrusPumpAnim <= 0) {
        this.world.citrusPumpAnim = 0.55;
      }
    } else {
      this.hand.returnToRest();
    }
    if (u >= 1) {
      this.demoAnim = null;
      this.hand.returnToRest();
    }
  }

  _animate() {
    requestAnimationFrame(this._animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    if (this.introEatTimer > -5) this.introEatTimer -= dt;

    // Idle timer check (strictly silent for 0..10s, 1 subtle hand gesture at 10.5s)
    if (this.activePointerId === null) {
      this.idleTimer += dt;
      if (this.idleTimer > 10.5 && !this.idleDemoShownForState) {
        this._triggerSingleIdleDemo();
      }
    }
    this._updateIdleDemo(dt);

    // 1. Update Active Dish Pose & Buoyancy + Water Rinsing Physics!
    let dishImpactY = -0.58;
    if (this.activeDish) {
      // If sink is filled with water and dish isn't being dragged, dish bobs gently in the water!
      const targetPos = this.dishTargetPos.clone();
      if (this.dragMode !== 'dish' && this.world.waterLevel > 0.38) {
        const floatY = THREE.MathUtils.lerp(-0.34, -0.10, (this.world.waterLevel - 0.38) / 0.62);
        targetPos.y = Math.max(targetPos.y, floatY + Math.sin(this.elapsed * 2.8) * 0.02);
        this.activeDish.soakAmount = Math.min(1, this.activeDish.soakAmount + dt * 0.35);
      }

      this.activeDish.group.position.lerp(targetPos, Math.min(1, dt * 12));
      this.activeDish.group.rotation.x = THREE.MathUtils.lerp(
        this.activeDish.group.rotation.x,
        this.dishTargetRot.x,
        Math.min(1, dt * 12)
      );
      this.activeDish.group.rotation.z = THREE.MathUtils.lerp(
        this.activeDish.group.rotation.z,
        this.dishTargetRot.z,
        Math.min(1, dt * 12)
      );

      // Check if running water stream hits the Active Dish!
      const spoutXZ = new THREE.Vector2(this.world.spoutWorldPos.x, this.world.spoutWorldPos.z);
      const dishXZ = new THREE.Vector2(this.activeDish.group.position.x, this.activeDish.group.position.z);
      const distUnderSpout = spoutXZ.distanceTo(dishXZ);
      const hitRadius = this.activeDish.recipe.radius * (this.world.showerMode ? 1.28 : 1.05);

      if (distUnderSpout < hitRadius) {
        dishImpactY = this.activeDish.group.position.y + 0.08;
        if (this.world.faucetFlow > 0.35) {
          const hitWorld = new THREE.Vector3(
            this.world.spoutWorldPos.x + (Math.random() - 0.5) * (this.world.showerMode ? 0.45 : 0.14),
            dishImpactY,
            this.world.spoutWorldPos.z + (Math.random() - 0.5) * (this.world.showerMode ? 0.45 : 0.14)
          );
          const rinseStrength = this.world.showerMode ? 1.25 : 1.0;
          this.activeDish.rinseWorldPoint(hitWorld, rinseStrength * dt * 15);
          const remSuds = this.fx.rinseDishSudsNear(
            this.activeDish.group,
            hitWorld,
            this.world.showerMode ? 0.62 : 0.42,
            rinseStrength
          );

          // Did rinsing just reveal a 100% Squeaky-Clean Sparkling Dish?!
          if (this.activeDish.checkCleanStatus(remSuds)) {
            this.fx.clearAllDishSuds(this.activeDish.group);
            this.fx.spawnSparkles(this.activeDish.group.position.clone().add(new THREE.Vector3(0, 0.15, 0.1)), 12);
            this.sound.playSparkleClean();
            this.sound.playVoice('sparkle');
            this.girl.setMood('sparkle', 2.2);
          }
        }
      } else {
        // Also check if scrubbing alone cleared dirt & water already washed suds
        const remSuds = this.fx.countDishSuds(this.activeDish.group);
        if (this.activeDish.checkCleanStatus(remSuds)) {
          this.fx.spawnSparkles(this.activeDish.group.position, 10);
          this.sound.playSparkleClean();
          this.girl.setMood('sparkle', 2.0);
        }
      }

      this.activeDish.update(dt, this.elapsed);
    }

    // 2. Update Sponge Position, Wetness & Physical Squash-and-Stretch!
    const spTarget = this.spongeTargetPos.clone();
    if (this.dragMode !== 'sponge' && this.world.waterLevel > 0.55) {
      // If sponge is inside basin or sink overflows, subtle bob
      spTarget.y += Math.sin(this.elapsed * 3.5) * 0.01;
    }
    this.world.spongeGroup.position.lerp(spTarget, Math.min(1, dt * 18));

    if (this.spongeSquish > 0) {
      this.spongeSquish = Math.max(0, this.spongeSquish - dt * 5.2);
    }
    const sq = Math.sin(this.spongeSquish * Math.PI) * 0.34;
    this.world.spongeBody.scale.set(1 + sq * 0.42, 1 - sq * 0.52, 1 + sq * 0.42);

    // Running water over plugged soapy sink builds a joyful Bubble Bath Mountain!
    if (this.world.faucetFlow > 0.5 && this.world.drainPlugged && (this.spongeSoapCharges > 0.1 || this.spongeFoamLevel > 0.1)) {
      if (Math.random() < 0.35) {
        const surfY = this.world.sinkWaterMesh.position.y;
        this.fx.spawnSinkBubbleMountain(new THREE.Vector3(-0.10, surfY, 0.18), 2, this.spongeTintHex);
      }
    }

    // 3. Update Subsystems
    this.world.update(dt, this.elapsed, dishImpactY);
    this.sound.setWaterStream(
      this.world.faucetOn,
      this.world.showerMode,
      dishImpactY > -0.5 ? 1 : 0,
      this.world.waterLevel
    );
    this.sound.update(dt, this.world.waterLevel);

    this.fx.update(
      dt,
      this.elapsed,
      this.world.spongeGroup,
      this.spongeFoamLevel,
      this.spongeTintHex,
      this.world,
      this.camera
    );

    const girlFocus = this.dragMode === 'sponge'
      ? this.world.spongeGroup.position
      : (this.activeDish ? this.activeDish.group.position : new THREE.Vector3(0, 0.1, 0.2));
    this.girl.update(dt, this.elapsed, girlFocus, this.introEatTimer);
    this.hand.update(dt, this.elapsed);
    this.partySet.update(dt, this.elapsed);

    // 4. Render!
    this.renderer.render(this.scene, this.camera);
  }
}

new DishWashingGame();
