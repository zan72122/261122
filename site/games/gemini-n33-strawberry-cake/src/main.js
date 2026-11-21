import * as THREE from 'three';
import { createPastelStudioEnv } from './textures.js';
import { ToyPatisserieEnv } from './scene.js';
import { ToyCharacter } from './character.js';
import { Shortcake, CAKE_TOP_Y, CAKE_RADIUS } from './cake.js';
import { ToolsManager } from './tools.js';
import { SoundEngine } from './sound.js';

// Pastel Dreamy-Kawaii Toy Strawberry Shortcake 3D Web Game
// Zero text, one-finger intuitive play, rich physical causality & reactions.

class StrawberryCakeGame {
  constructor() {
    this.container = document.getElementById('app');

    // WebGL Renderer strictly capped at pixelRatio <= 1.5 for silky iPhone/iPad >= 30fps
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfcd9ea);
    this.scene.environment = createPastelStudioEnv(this.renderer);
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 45);

    this.sound = new SoundEngine();
    this.env = new ToyPatisserieEnv(this.scene);
    this.character = new ToyCharacter(this.scene);
    this.cake = new Shortcake(this.scene);
    this.tools = new ToolsManager(this.scene);

    // Stage flow: cream -> berry -> pipe -> candle -> blow -> eat
    this.stage = 'cream';
    this.stageTransitionLock = false;
    this.pipeScore = 0;
    this.activeRosette = null;
    this.lastPipePoint = null;
    this.bitesEaten = 0;

    // Single-finger pointer tracking (ignores extra fingers safely!)
    this.activePointerId = null;
    this.pointerNDC = new THREE.Vector2();
    this.lastPointerX = 0;
    this.dragMode = null; // 'cream' | 'berry' | 'pipe' | 'candle' | 'blow' | 'slice' | 'spin'
    this.raycaster = new THREE.Raycaster();
    this.cakeTopPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CAKE_TOP_Y);
    this.workPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.4);

    // Gentle idle hint timer (0-9s silent observation; then 1 slow physical hand glide)
    this.idleSeconds = 0;
    this.hintShownInStage = false;

    // Frame timing & performance telemetry
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.fpsSamples = [];
    this.currentFps = 60;

    this._onResize();
    window.addEventListener('resize', () => this._onResize());
    this._bindInput();
    this._exposeDebugHandle();
    this._animate();
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    const isPortrait = aspect < 1.0;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.camera.aspect = aspect;

    // Responsive cozy camera framing so cake, full character + chef hat, and active tool are 100% framed!
    if (isPortrait) {
      this.camera.fov = 45;
      const distPull = THREE.MathUtils.clamp(0.62 / Math.max(0.42, aspect), 0.98, 1.34);
      this.camera.position.set(0, 4.15 * distPull, 6.85 * distPull);
      this.camera.lookAt(0, 1.72, 0.12);
    } else {
      this.camera.fov = 40;
      this.camera.position.set(0, 3.75, 7.25);
      this.camera.lookAt(0, 1.85, -0.32);
    }
    this.camera.updateProjectionMatrix();
    this.tools.setLayout(isPortrait);
  }

  _bindInput() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => this._handlePointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._handlePointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._handlePointerUp(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._handlePointerUp(e), { passive: false });
  }

  _updateNDC(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _raycastAll() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    return this.raycaster.intersectObjects(this.scene.children, true);
  }

  _projectToCakeTop() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const out = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.cakeTopPlane, out)) {
      return out;
    }
    return new THREE.Vector3(0, CAKE_TOP_Y, 0);
  }

  _projectToWorkPlane() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const out = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.workPlane, out)) {
      return out;
    }
    return new THREE.Vector3(0, CAKE_TOP_Y + 0.5, 0.4);
  }

  _findInteractTag(hits) {
    for (const h of hits) {
      let obj = h.object;
      while (obj) {
        if (obj.userData && obj.userData.interact) {
          return { tag: obj.userData.interact, hit: h };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  _handlePointerDown(e) {
    e.preventDefault();
    this.sound.unlock();

    // Multi-touch safety: only track one active finger!
    if (this.activePointerId !== null) return;
    this.activePointerId = e.pointerId;
    this.idleSeconds = 0;
    this.character.cancelIdleHint();

    this._updateNDC(e);
    this.lastPointerX = e.clientX;
    const hits = this._raycastAll();
    const found = this._findInteractTag(hits);
    const tag = found ? found.tag : null;

    // Fun playful discovery anytime: poke Patissiere-chan's face -> giggle & hearts!
    if (tag === 'character-face') {
      if (this.stage === 'blow') {
        this._triggerCharacterBlow();
        return;
      }
      if (this.stage === 'eat' && this.tools.isHoldingSlice) {
        this._feedCharacterBite();
        return;
      }
      this.sound.playGiggle();
      this.character.setMood('giggle', 1.4);
      this.env.spawnBurst(this.character.getMouthWorldPos().add(new THREE.Vector3(0, 0.4, 0.3)), 6, 'heart');
      return;
    }

    // Wordless Replay Bell Cloche in celebration/eat stage!
    if (tag === 'replay-bell' && this.stage === 'eat') {
      this._resetGame();
      return;
    }

    // --- STAGE 1: SPREAD WHIPPED CREAM ---
    if (this.stage === 'cream') {
      if (tag === 'cream-bowl' || tag === 'spatula') {
        this.tools.spatulaLoaded = true;
        this.sound.playScoop();
        this.tools.pokeStation('creamStation');
        this.tools.pickUpSpatula(found.hit.point);
        this.dragMode = 'cream';
        this.character.setLookTarget(found.hit.point);
        return;
      }
      if (tag === 'cake' || tag === 'cake-top' || tag === 'cake-side') {
        // Forgiving direct-touch: spatula swoops right to the cake where she rubs!
        this.tools.pickUpSpatula(found.hit.point);
        this.dragMode = 'cream';
        this._spreadCreamAt(found.hit.point, 0.7);
        return;
      }
      if (tag === 'stand') {
        this.dragMode = 'spin';
        return;
      }
      this._pokeInactiveFeedback(tag);
      return;
    }

    // --- STAGE 2: ARRANGE STRAWBERRIES ---
    if (this.stage === 'berry') {
      if (tag === 'tray-pearl-berry' || tag === 'tray-berry' || tag === 'berry-tray') {
        const isPearl = tag === 'tray-pearl-berry';
        this.sound.playBoing(isPearl ? 1.35 : 1.05);
        this.tools.pokeStation('berryTray');
        this.tools.pickUpBerry(this._projectToCakeTop(), isPearl);
        this.dragMode = 'berry';
        this.character.setLookTarget(this.tools.berryTray.position);
        return;
      }
      if (tag === 'placed-berry') {
        // Playful jelly jiggle when poking an already-placed berry!
        this.cake.jiggleNearestBerry(found.hit.point);
        this.sound.playBoing(1.22);
        this.env.spawnBurst(found.hit.point, 4, 'star');
        return;
      }
      if (tag === 'cake' || tag === 'cake-top' || tag === 'cake-side') {
        // Direct tap on cake top -> picks a juicy red berry and places it immediately!
        const pt = this._projectToCakeTop();
        this._placeBerry(pt, false);
        return;
      }
      if (tag === 'stand') {
        this.dragMode = 'spin';
        return;
      }
      this._pokeInactiveFeedback(tag);
      return;
    }

    // --- STAGE 3: PIPING BAG CREAM ROSETTES & RIBBONS ---
    if (this.stage === 'pipe') {
      // Diegetic pastel cream color pots!
      if (tag && tag.startsWith('cream-pot-')) {
        const idx = parseInt(tag.slice(-1), 10) || 0;
        this.tools.setCreamColor(idx);
        this.sound.playColorDip(idx);
        this.env.spawnBurst(found.hit.point.clone().add(new THREE.Vector3(0, 0.2, 0)), 8, 'star');
        this.character.setMood('amazed', 1.1);
        return;
      }
      if (tag === 'piping-bag') {
        this.sound.playBoing(1.1);
        this.tools.pokeStation('pipingStation');
        this.tools.pickUpPipingBag(this._projectToCakeTop());
        this.dragMode = 'pipe';
        return;
      }
      if (tag === 'cake' || tag === 'cake-top' || tag === 'cake-side' || tag === 'placed-berry') {
        // Direct press-and-hold or drag on cake -> piping bag swoops in & squeezes cream!
        const pt = this._projectToCakeTop();
        this.tools.pickUpPipingBag(pt);
        this.dragMode = 'pipe';
        this._beginSqueezeAt(pt);
        return;
      }
      if (tag === 'stand') {
        this.dragMode = 'spin';
        return;
      }
      this._pokeInactiveFeedback(tag);
      return;
    }

    // --- STAGE 4: PLACE 5 BIRTHDAY CANDLES ---
    if (this.stage === 'candle') {
      if (tag && (tag.startsWith('tray-candle-') || tag === 'candle-holder')) {
        let idx = tag.startsWith('tray-candle-') ? parseInt(tag.slice(-1), 10) : this.tools.getNextUnusedCandleIndex();
        if (idx < 0 || this.tools.trayCandles[idx]?.userData.used) {
          idx = this.tools.getNextUnusedCandleIndex();
        }
        if (idx >= 0) {
          this.sound.playBoing(1.15);
          this.tools.pokeStation('candleHolder');
          this.tools.pickUpCandle(idx, this._projectToCakeTop());
          this.dragMode = 'candle';
        }
        return;
      }
      if (tag === 'cake' || tag === 'cake-top' || tag === 'cake-side' || tag === 'placed-berry') {
        const idx = this.tools.getNextUnusedCandleIndex();
        if (idx >= 0) {
          this._plantCandle(this._projectToCakeTop(), idx);
        }
        return;
      }
      if (tag === 'candle') {
        this.sound.playBoing(1.3);
        this.env.spawnBurst(found.hit.point, 6, 'star');
        return;
      }
      if (tag === 'stand') {
        this.dragMode = 'spin';
        return;
      }
      this._pokeInactiveFeedback(tag);
      return;
    }

    // --- STAGE 5A: BLOW OUT THE CANDLES! ---
    if (this.stage === 'blow') {
      this.dragMode = 'blow';
      this._triggerCharacterBlow(found ? found.hit.point : null);
      return;
    }

    // --- STAGE 5B: SLICE & FEED PATISSIERE-CHAN! ---
    if (this.stage === 'eat') {
      if (tag === 'cake' || tag === 'cake-top' || tag === 'cake-side' || tag === 'placed-berry' || tag === 'cake-server') {
        const slice = this.cake.createCakeSliceMesh(this.tools.activeCreamColor);
        const startPos = this._projectToWorkPlane();
        this.tools.pickUpCakeSlice(slice, startPos);
        this.dragMode = 'slice';
        this.sound.playBoing(1.12);
        this.character.setMood('amazed', 2.0);
        this.character.setLookTarget(startPos);
        return;
      }
      if (tag === 'stand') {
        this.dragMode = 'spin';
        return;
      }
      this._pokeInactiveFeedback(tag);
    }
  }

  _handlePointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.idleSeconds = 0;

    const dxPx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this._updateNDC(e);

    if (this.dragMode === 'spin') {
      if (this.cake.spinBy(dxPx * 0.012)) {
        this.sound.playTurntableTick();
      }
      return;
    }

    if (this.dragMode === 'cream') {
      const hits = this._raycastAll();
      const cakeHit = hits.find((h) => {
        const t = h.object.userData?.interact;
        return t === 'cake' || t === 'cake-top' || t === 'cake-side';
      });
      if (cakeHit) {
        this.tools.moveHeldSpatula(cakeHit.point, dxPx * 0.04);
        this.character.setLookTarget(cakeHit.point);
        // Gentle horizontal turntable assist when frosting sides!
        if (cakeHit.point.y < CAKE_TOP_Y - 0.14 && Math.abs(dxPx) > 1.5) {
          this.cake.spinBy(dxPx * 0.0055);
        }
        this._spreadCreamAt(cakeHit.point, Math.min(1.4, Math.abs(dxPx) * 0.05 + 0.35));
      } else {
        const pt = this._projectToCakeTop();
        this.tools.moveHeldSpatula(pt, dxPx * 0.04);
        this.character.setLookTarget(pt);
        // Re-dip into cream bowl for extra thick scoop!
        if (pt.distanceTo(this.tools.creamStation.position) < 1.1 && !this.tools.spatulaLoaded) {
          this.tools.spatulaLoaded = true;
          this.sound.playScoop();
          this.tools.pokeStation('creamStation');
        }
        // Silly fun discovery: fling cream up near character's face -> cream dab on her nose!
        const faceHit = hits.find((h) => h.object.userData?.interact === 'character-face');
        if (faceHit && !this.character.noseCream.visible) {
          this.character.dabNoseCream();
          this.sound.playGiggle();
          this.env.spawnBurst(faceHit.point, 6, 'cream');
        }
      }
      return;
    }

    if (this.dragMode === 'berry') {
      const pt = this._projectToCakeTop();
      this.tools.moveHeldBerry(pt);
      this.character.setLookTarget(pt);
      return;
    }

    if (this.dragMode === 'pipe') {
      const pt = this._projectToCakeTop();
      const onCake = Math.hypot(pt.x, pt.z) <= CAKE_RADIUS * 1.12;
      this.tools.moveHeldPipingBag(pt, onCake);
      this.character.setLookTarget(pt);

      if (onCake) {
        if (!this.activeRosette) {
          this._beginSqueezeAt(pt);
        } else if (this.lastPipePoint && pt.distanceTo(this.lastPipePoint) > 0.29) {
          // Continuous drag pipes a scalloped 3D cream ribbon!
          this.activeRosette = this.cake.startRosetteAtWorld(pt, this.tools.activeCreamColor);
          this.lastPipePoint.copy(pt);
          this.pipeScore += 0.65;
          this.env.spawnBurst(pt.clone().add(new THREE.Vector3(0, 0.14, 0)), 3, 'cream');
          this._checkPipeStageAdvance();
        }
      } else {
        if (this.activeRosette) {
          this.sound.stopSqueeze(false);
          this.activeRosette = null;
        }
      }
      return;
    }

    if (this.dragMode === 'candle') {
      const pt = this._projectToCakeTop();
      this.tools.moveHeldCandle(pt);
      this.character.setLookTarget(pt);
      return;
    }

    if (this.dragMode === 'blow') {
      if (Math.abs(dxPx) > 10) {
        const pt = this._projectToCakeTop();
        this._triggerCharacterBlow(pt);
      }
      return;
    }

    if (this.dragMode === 'slice') {
      const pt = this._projectToWorkPlane();
      // Gently rise toward character mouth height when dragged upward
      this.tools.moveHeldCakeSlice(pt);
      this.character.setLookTarget(pt);
      const mouthPos = this.character.getMouthWorldPos();
      const dist2D = Math.hypot(pt.x - mouthPos.x, pt.y - mouthPos.y);
      if (dist2D < 1.15) {
        this._feedCharacterBite();
      }
    }
  }

  _handlePointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;

    if (this.dragMode === 'cream') {
      this.tools.releaseSpatula();
    } else if (this.dragMode === 'berry') {
      const pt = this._projectToCakeTop();
      const isPearl = this.tools.holdingPearl;
      this.tools.releaseBerry();
      if (Math.hypot(pt.x, pt.z) <= CAKE_RADIUS * 1.45) {
        this._placeBerry(pt, isPearl);
      }
    } else if (this.dragMode === 'pipe') {
      this.sound.stopSqueeze(Boolean(this.activeRosette));
      this.activeRosette = null;
      this.lastPipePoint = null;
      this.tools.releasePipingBag();
      this._checkPipeStageAdvance();
    } else if (this.dragMode === 'candle') {
      const pt = this._projectToCakeTop();
      const idx = this.tools.heldCandleIndex;
      if (Math.hypot(pt.x, pt.z) <= CAKE_RADIUS * 1.45) {
        this.tools.consumeHeldCandle();
        this._plantCandle(pt, idx);
      } else {
        this.tools.cancelHeldCandle();
      }
    } else if (this.dragMode === 'slice') {
      // If lifted high near character, feed her generously!
      const pos = this.tools.heldSliceContainer.position;
      const mouthPos = this.character.getMouthWorldPos();
      if (Math.hypot(pos.x - mouthPos.x, pos.y - mouthPos.y) < 1.8) {
        this._feedCharacterBite();
      } else {
        this.tools.releaseCakeSlice();
      }
    }

    this.dragMode = null;
  }

  _pokeInactiveFeedback(tag) {
    if (!tag) return;
    this.sound.playBoing(0.95 + Math.random() * 0.25);
    if (tag === 'cream-bowl' || tag === 'spatula') this.tools.pokeStation('creamStation');
    else if (tag.includes('berry')) this.tools.pokeStation('berryTray');
    else if (tag === 'piping-bag' || tag.startsWith('cream-pot')) this.tools.pokeStation('pipingStation');
    else if (tag.includes('candle')) this.tools.pokeStation('candleHolder');
  }

  _spreadCreamAt(worldPoint, speed) {
    const cov = this.cake.applyCreamAtWorldPoint(worldPoint, this.tools.spatulaLoaded);
    this.sound.playSpread(speed);
    if (Math.random() < 0.35) {
      this.env.spawnBurst(worldPoint, 2, 'cream');
    }
    if (cov > 0.35 && this.character.mood === 'eager') {
      this.character.setMood('happy', 0.9);
    }
    // Generous ~76% coverage finishes smoothly into gleaming white shortcake!
    if (cov >= 0.76 && !this.stageTransitionLock) {
      this._advanceToBerryStage();
    }
  }

  _advanceToBerryStage() {
    this.stageTransitionLock = true;
    this.tools.releaseSpatula();
    this.dragMode = null;
    this.cake.finishFrostingSmooth();
    this.sound.playStageComplete();
    this.character.setMood('happy', 2.0);
    this.env.spawnBurst(new THREE.Vector3(0, CAKE_TOP_Y + 0.2, 0), 18, 'star');

    setTimeout(() => {
      this.stage = 'berry';
      this.tools.setStage('berry');
      this.cake.setShowBerryGuides(true);
      this.idleSeconds = 0;
      this.hintShownInStage = false;
      this.stageTransitionLock = false;
      this.character.setLookTarget(this.tools.berryTray.position);
    }, 650);
  }

  _placeBerry(worldPoint, isPearl) {
    const res = this.cake.placeStrawberryAtWorld(worldPoint, isPearl);
    if (res.tumbled) {
      this.sound.playTumble();
      this.character.setMood('giggle', 1.4);
      this.env.spawnBurst(res.worldPos, 8, 'cream');
      return;
    }

    this.sound.playBerryPlace(res.count - 1, isPearl);
    this.env.spawnBurst(res.worldPos, isPearl ? 18 : 9, isPearl ? 'heart' : 'star');
    this.character.setMood(isPearl ? 'heart' : 'happy', 1.5);

    // After 6 lush strawberries, smoothly invite Stage 3 (Piping Bag)!
    if (res.count >= 6 && !this.stageTransitionLock) {
      this._advanceToPipeStage();
    }
  }

  _advanceToPipeStage() {
    this.stageTransitionLock = true;
    this.sound.playStageComplete();
    this.character.setMood('cheer', 1.8);
    this.cake.setShowBerryGuides(false);
    this.env.spawnBurst(new THREE.Vector3(0, CAKE_TOP_Y + 0.3, 0), 20, 'star');

    setTimeout(() => {
      this.stage = 'pipe';
      this.tools.setStage('pipe');
      this.pipeScore = 0;
      this.idleSeconds = 0;
      this.hintShownInStage = false;
      this.stageTransitionLock = false;
      this.character.setLookTarget(this.tools.pipingStation.position);
    }, 750);
  }

  _beginSqueezeAt(pt) {
    this.activeRosette = this.cake.startRosetteAtWorld(pt, this.tools.activeCreamColor);
    this.lastPipePoint = pt.clone();
    this.pipeScore += 1.0;
    this.sound.startSqueeze();
    this.character.setMood('amazed', 1.0);
  }

  _checkPipeStageAdvance() {
    if (this.stage !== 'pipe' || this.stageTransitionLock) return;
    if (this.pipeScore >= 5.0 && !this.activeRosette) {
      this._advanceToCandleStage();
    }
  }

  _advanceToCandleStage() {
    this.stageTransitionLock = true;
    this.sound.stopSqueeze(false);
    this.tools.releasePipingBag();
    this.dragMode = null;
    this.sound.playStageComplete();
    this.character.setMood('happy', 2.0);
    this.env.spawnBurst(new THREE.Vector3(0, CAKE_TOP_Y + 0.35, 0), 22, 'star');

    setTimeout(() => {
      this.stage = 'candle';
      this.tools.setStage('candle');
      this.idleSeconds = 0;
      this.hintShownInStage = false;
      this.stageTransitionLock = false;
      this.character.setLookTarget(this.tools.candleHolder.position);
    }, 750);
  }

  _plantCandle(worldPoint, candleIndex) {
    this.tools.trayCandles[candleIndex].userData.used = true;
    this.tools.trayCandles[candleIndex].visible = false;

    const { worldPos } = this.cake.placeCandleAtWorld(worldPoint, candleIndex);
    const count = this.cake.candles.length;
    this.sound.playCandleLight(count - 1);
    this.env.spawnBurst(worldPos, 10, 'star', 0xffe48f);
    this.character.setMood('amazed', 1.5);

    // Dreamy twilight gradually deepens with each glowing birthday candle!
    this.env.setTwilight(Math.min(0.88, count * 0.18));

    // All 5 candles for our 5-year-old birthday cake -> Grand Blow-Out Moment!
    if (count >= 5 && !this.stageTransitionLock) {
      this.stageTransitionLock = true;
      setTimeout(() => {
        this.stage = 'blow';
        this.tools.setStage('blow');
        this.env.setTwilight(0.92);
        this.character.setMood('amazed', 3.0);
        this.character.setLookTarget(new THREE.Vector3(0, CAKE_TOP_Y + 0.8, 0));
        this.sound.playStageComplete();
        this.idleSeconds = 0;
        this.hintShownInStage = false;
        this.stageTransitionLock = false;
      }, 650);
    }
  }

  _triggerCharacterBlow(targetPoint = null) {
    const res = this.cake.blowOutCandle(targetPoint);
    if (!res) return;

    const mouthPos = this.character.getMouthWorldPos();
    this.character.setMood('blow', 0.85);
    this.sound.playBlow();
    this.sound.playCandleOut(res.remaining);
    this.env.spawnWindRibbon(mouthPos, res.worldPos);
    this.env.spawnBurst(res.worldPos, 8, 'smoke');
    this.env.spawnBurst(res.worldPos, 10, 'star');

    // All candles blown out -> SUNNY CELEBRATION & EATING FINALE!
    if (res.remaining === 0 && !this.stageTransitionLock) {
      this.stageTransitionLock = true;
      this.sound.playCelebrationFanfare();
      this.env.setTwilight(0);
      this.env.spawnCelebrationBalloons();
      this.env.spawnBurst(new THREE.Vector3(0, 2.2, 0), 42, 'confetti');
      this.env.spawnBurst(new THREE.Vector3(0, 2.8, -1.2), 14, 'heart');
      this.character.setMood('cheer', 4.0);

      setTimeout(() => {
        this.stage = 'eat';
        this.tools.setStage('eat');
        this.bitesEaten = 0;
        this.idleSeconds = 0;
        this.hintShownInStage = false;
        this.stageTransitionLock = false;
      }, 1100);
    }
  }

  _feedCharacterBite() {
    this.tools.releaseCakeSlice();
    this.dragMode = null;
    this.bitesEaten++;
    this.sound.playEatBite();
    this.character.setMood('eat', 1.6);
    const mouthPos = this.character.getMouthWorldPos();
    this.env.spawnBurst(mouthPos.clone().add(new THREE.Vector3(0, 0.25, 0.3)), 10, 'heart');
    this.env.spawnBurst(mouthPos.clone().add(new THREE.Vector3(0, 0, 0.25)), 8, 'cream');
    if (this.bitesEaten === 2) {
      this.character.dabNoseCream();
    }
    if (this.bitesEaten >= 3) {
      this.sound.playCelebrationFanfare();
      this.env.spawnBurst(new THREE.Vector3(0, 2.5, -0.5), 26, 'confetti');
      this.character.setMood('heart', 2.8);
    }
  }

  _resetGame() {
    this.sound.playBellTing();
    this.tools.pokeStation('replayBell');
    this.env.clearBalloons();
    this.env.setTwilight(0);
    this.cake.reset();
    this.tools.resetAll();
    this.stage = 'cream';
    this.stageTransitionLock = false;
    this.pipeScore = 0;
    this.bitesEaten = 0;
    this.idleSeconds = 0;
    this.hintShownInStage = false;
    this.character.setMood('happy', 1.5);
    this.env.spawnBurst(new THREE.Vector3(0, CAKE_TOP_Y + 0.1, 0), 14, 'star');
  }

  _triggerIdleHintIfNeeded(dt) {
    if (this.activePointerId !== null || this.stageTransitionLock) {
      this.idleSeconds = 0;
      return;
    }
    this.idleSeconds += dt;
    // Wait 9 full seconds with zero distraction, then perform ONE gentle physical glide
    if (this.idleSeconds >= 9.0 && !this.hintShownInStage) {
      this.hintShownInStage = true;
      const from = this.tools.getActiveStationWorldPos();
      const to = this.stage === 'eat'
        ? this.character.getMouthWorldPos()
        : new THREE.Vector3(0, CAKE_TOP_Y + 0.25, 0);
      this.character.playIdleHint(from, to);
      this.character.setLookTarget(from);
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    // Track rolling FPS
    if (dt > 0.0001) {
      this.fpsSamples.push(1 / dt);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      this.currentFps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    }

    // Grow active piped rosette while holding finger down!
    if (this.stage === 'pipe' && this.dragMode === 'pipe' && this.activeRosette) {
      const res = this.cake.growRosette(this.activeRosette, dt);
      this.sound.updateSqueeze(res.progress);
      this.pipeScore += dt * 1.1;
      if (res.justPopped) {
        this.sound.playSparkleBurst();
        this.env.spawnBurst(res.worldPos, 18, 'star');
        this.character.setMood('heart', 1.6);
      }
    }

    this._triggerIdleHintIfNeeded(dt);

    // Character naturally glances between active tool & cake when idle
    if (this.activePointerId === null) {
      const glance = Math.sin(this.elapsed * 0.75) > 0.2
        ? this.tools.getActiveStationWorldPos()
        : new THREE.Vector3(0, CAKE_TOP_Y + 0.15, 0);
      this.character.setLookTarget(glance);
    }

    this.env.update(dt, this.elapsed, this.cake.getLitCandleCount());
    this.cake.update(dt, this.elapsed);
    this.tools.update(dt, this.elapsed);
    this.character.update(dt, this.elapsed);

    this.renderer.render(this.scene, this.camera);
  }

  // Invisible diagnostic hook for automated visual & performance verification
  _exposeDebugHandle() {
    window.__GAME_DEBUG__ = {
      getStats: () => {
        let maxTex = 0;
        const seenTex = new Set();
        this.scene.traverse((obj) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              if (m.map && !seenTex.has(m.map)) {
                seenTex.add(m.map);
                const img = m.map.image;
                if (img) maxTex = Math.max(maxTex, img.width || 0, img.height || 0);
              }
            }
          }
        });
        return {
          stage: this.stage,
          fps: Math.round(this.currentFps),
          triangles: this.renderer.info.render.triangles,
          calls: this.renderer.info.render.calls,
          pixelRatio: this.renderer.getPixelRatio(),
          maxTexturePx: maxTex,
          frostingCoverage: Number(this.cake.frosting.getCoverage().toFixed(2)),
          strawberries: this.cake.strawberries.length,
          rosettes: this.cake.rosettes.length,
          candles: this.cake.candles.length,
          litCandles: this.cake.getLitCandleCount()
        };
      },
      // Helper to preview each stage during visual verification
      captureJpeg: (w = 800, h = 600, q = 0.88) => {
        this.renderer.render(this.scene, this.camera);
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const ctx = out.getContext('2d');
        ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
        return out.toDataURL('image/jpeg', q);
      },
      demoState: (targetStage) => {
        this.cake.reset();
        this.tools.resetAll();
        this.env.clearBalloons();
        this.env.setTwilight(0);
        this.stageTransitionLock = false;

        if (targetStage === 'cream') {
          this.stage = 'cream';
          this.tools.setStage('cream', true);
          this.cake.applyCreamAtWorldPoint(new THREE.Vector3(-0.3, CAKE_TOP_Y, 0.2), true);
          this.cake.applyCreamAtWorldPoint(new THREE.Vector3(0.2, CAKE_TOP_Y, 0.35), true);
          this.cake.applyCreamAtWorldPoint(new THREE.Vector3(0.1, CAKE_TOP_Y - 0.3, CAKE_RADIUS), true);
          return;
        }
        // Finish cream for all later stages
        this.cake.finishFrostingSmooth();
        if (targetStage === 'berry') {
          this.stage = 'berry';
          this.tools.setStage('berry', true);
          this.cake.setShowBerryGuides(true);
          this.cake.placeStrawberryAtWorld(new THREE.Vector3(0.62, CAKE_TOP_Y, 0.35), false);
          this.cake.placeStrawberryAtWorld(new THREE.Vector3(0.0, CAKE_TOP_Y, 0.72), true);
          this.cake.placeStrawberryAtWorld(new THREE.Vector3(-0.62, CAKE_TOP_Y, 0.35), false);
          this.character.setMood('happy', 5);
          return;
        }
        // Place full 6-berry ring + pearl center for pipe/candle/blow/eat
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          this.cake.placeStrawberryAtWorld(new THREE.Vector3(Math.cos(a) * 0.72, CAKE_TOP_Y, Math.sin(a) * 0.72), i === 1);
        }
        if (targetStage === 'pipe') {
          this.stage = 'pipe';
          this.tools.setStage('pipe', true);
          this.tools.setCreamColor(1);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const r = this.cake.startRosetteAtWorld(new THREE.Vector3(Math.cos(a) * 0.88, CAKE_TOP_Y, Math.sin(a) * 0.88), i % 3);
            this.cake.growRosette(r, 0.65);
          }
          this.character.setMood('amazed', 5);
          return;
        }
        // Full rosettes ring nestled gracefully between strawberries + pastel sprinkles!
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const r = this.cake.startRosetteAtWorld(new THREE.Vector3(Math.cos(a) * 0.88, CAKE_TOP_Y, Math.sin(a) * 0.88), i % 3);
          this.cake.growRosette(r, 0.65);
        }
        this.cake.addSprinkleShower(new THREE.Vector3(0, 0, 0));

        if (targetStage === 'candle' || targetStage === 'blow') {
          const count = targetStage === 'candle' ? 3 : 5;
          for (let i = 0; i < count; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            this.tools.trayCandles[i].userData.used = true;
            this.tools.trayCandles[i].visible = false;
            this.cake.placeCandleAtWorld(new THREE.Vector3(Math.cos(a) * 0.36, CAKE_TOP_Y, Math.sin(a) * 0.36), i);
          }
          this.stage = targetStage;
          this.tools.setStage(targetStage, true);
          this.env.setTwilight(targetStage === 'blow' ? 0.88 : 0.38, true);
          this.env.update(0.016, 1.0, count);
          this.character.setMood(targetStage === 'blow' ? 'amazed' : 'happy', 5);
          return;
        }
        if (targetStage === 'eat') {
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            this.tools.trayCandles[i].userData.used = true;
            this.tools.trayCandles[i].visible = false;
            this.cake.placeCandleAtWorld(new THREE.Vector3(Math.cos(a) * 0.36, CAKE_TOP_Y, Math.sin(a) * 0.36), i);
            this.cake.blowOutCandle();
          }
          this.stage = 'eat';
          this.tools.setStage('eat', true);
          this.env.setTwilight(0, true);
          this.env.spawnCelebrationBalloons();
          this.env.update(0.016, 1.0, 0);
          this.character.setMood('cheer', 5);
        }
      }
    };
  }
}

new StrawberryCakeGame();
