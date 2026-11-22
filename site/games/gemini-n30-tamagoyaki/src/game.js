import * as THREE from '../vendor/three.module.min.js';
import { KitchenAudio } from './audio.js';
import { createKitchenEnvMap } from './textures.js';
import { KitchenParticles } from './particles.js';
import { CompanionCharacter } from './character.js';
import { PlayerHand } from './hands.js';
import { buildKitchen } from './kitchen.js';
import { TamagoyakiSystem } from './tamagoyakiMesh.js';

export class TamagoyakiGame {
  constructor(container) {
    this.container = container;
    this.audio = new KitchenAudio();

    // Renderer: photorealistic ACES filmic tone mapping, capped pixel ratio <= 1.5 for 30fps+ on iPhone/iPad
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Scene & warm morning kitchen atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0e4d2);
    this.scene.fog = new THREE.Fog(0xf0e4d2, 6.5, 13.5);
    this.scene.environment = createKitchenEnvMap(this.renderer);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      30
    );
    this.camPos = new THREE.Vector3(-1.55, 1.58, 2.08);
    this.camTarget = new THREE.Vector3(-1.55, 0.34, 0.05);
    this.camDesiredPos = this.camPos.clone();
    this.camDesiredTarget = this.camTarget.clone();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    this._setupLights();

    // Build world & actors
    this.kitchen = buildKitchen(this.scene);
    this.particles = new KitchenParticles(this.scene);
    this.companion = new CompanionCharacter(this.scene);
    this.hand = new PlayerHand(this.scene);
    this.tamagoyaki = new TamagoyakiSystem(
      this.scene,
      this.kitchen.panInteriorGroup,
      this.kitchen.boardGroup
    );

    // Register interactive sizzling bubbles for popping discovery
    for (const b of this.tamagoyaki.bubbles) {
      this.kitchen.hitTargets.push(b.mesh);
    }
    // Register tamagoyaki slices for slicing/packing/feeding
    for (const s of this.tamagoyaki.slices) {
      this.kitchen.hitTargets.push(s.mesh);
    }

    // Raycasting & single-finger pointer tracking (multi-touch safe!)
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.activePointerId = null;
    this.dragState = null;
    this.counterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
    this.dragWorldPos = new THREE.Vector3();
    this.prevDragWorldPos = new THREE.Vector3();

    // Game State
    this.time = 0;
    this.idleTime = 0;
    this.hintAnim = null;
    this.sessionCount = 0;
    this.steamAccum = 0;
    this.wobbles = [];

    this._resetState();
    this._bindEvents();
    this._updateCameraGoals(true);

    const qsStage = new URLSearchParams(window.location.search).get('stage');
    if (qsStage) {
      this._debugJumpStage(qsStage);
    }

    // Lightweight FPS monitor + inspection hook
    this.frameCount = 0;
    this.fps = 60;
    this.fpsTimer = 0;

    window.__TAMAGOYAKI__ = {
      getStats: () => ({
        stage: this.stage,
        layerIndex: this.layerIndex,
        crackedCount: this.crackedCount,
        mixProgress: Number(this.mixProgress.toFixed(2)),
        cutsDone: this.cutsDone,
        packedCount: this.packedCount,
        eatenCount: this.eatenCount,
        heatLevel: this.heatLevel,
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
        pixelRatio: this.renderer.getPixelRatio(),
        fps: this.fps,
      }),
      // Helper for visual verification of every stage cleanly
      jumpToStage: (stageName) => this._debugJumpStage(stageName),
    };

    this.lastTime = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _setupLights() {
    // Soft warm daylight hemisphere
    const hemi = new THREE.HemisphereLight(0xfff7e8, 0x997350, 0.78);
    this.scene.add(hemi);

    // Main sunlit kitchen window directional key light from upper-left-front
    const key = new THREE.DirectionalLight(0xfff4df, 1.85);
    key.position.set(-2.8, 5.2, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1.0;
    key.shadow.camera.far = 14.0;
    key.shadow.camera.left = -4.2;
    key.shadow.camera.right = 4.2;
    key.shadow.camera.top = 3.2;
    key.shadow.camera.bottom = -2.4;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 3;
    this.scene.add(key);

    // Warm subtle rim/fill from right kitchen pendant so pan & food stay lush and readable
    const fill = new THREE.DirectionalLight(0xffe1be, 0.65);
    fill.position.set(3.4, 3.2, 1.8);
    this.scene.add(fill);
  }

  _resetState() {
    this.stage = 'crack'; // crack | whisk | pan_pour | pan_cook | pan_roll | pan_slide_back | pan_finish | slice | bento | eat
    this.stageTimer = 0;
    this.idleTime = 0;
    this.hintAnim = null;

    // Bowl & Egg state
    this.crackedCount = 0;
    this.yolkCount = 0;
    this.selectedEggIndex = -1;
    this.mixProgress = 0;
    this.swirlAngle = 0;
    this.stirSpeed = 0;
    this.froth = 0;
    this.maxStirSpeedSeen = 0;

    // Mix-ins (discoveries!)
    this.hasNegi = false;
    this.hasNori = false;
    this.hasDashi = false;

    // Stove & Pan state
    this.heatLevel = 1; // 0: Low, 1: Medium, 2: High
    this.layerIndex = 0; // 0, 1, 2
    this.pourFill = 0;
    this.cookProgress = 0;
    this.searAccum = 0.45;
    this.rollProgress = 0;
    this.slideBackT = 0;
    this.finishFlipT = 0;

    // Slicing & Bento state
    this.cutsDone = 0;
    this.sliceAnim = null;
    this.packedCount = 0;
    this.eatenCount = 0;
    this.hasKetchup = false;
    this.hasPicks = false;
    this.eatAnim = null;
    this.carriedSlice = null;

    // Reset kitchen props cleanly
    this.kitchen.bowlGroup.position.copy(this.kitchen.bowlHomePos);
    this.kitchen.bowlGroup.rotation.set(0, 0, 0);
    this.kitchen.bowlLiquidMesh.visible = false;
    this.kitchen.bowlLiquidMesh.position.y = 0.06;
    for (const y of this.kitchen.bowlYolks) {
      y.visible = false;
      y.scale.setScalar(1);
    }
    this.kitchen.pourStream.visible = false;

    // Reset 3 eggs (make egg #2 or #3 a fun surprise double-yolk on session >= 1 or 3rd egg!)
    const doubleIdx = this.sessionCount % 2 === 0 ? 2 : 1;
    this.kitchen.eggs.forEach((e, idx) => {
      e.state = 'tray';
      e.animT = 0;
      e.isDoubleYolk = idx === doubleIdx;
      e.shellCtrl.reset();
      e.group.visible = true;
      e.group.position.copy(e.homePos);
      e.group.rotation.set(0, 0, 0);
      e.lowerMesh.position.set(0, 0, 0);
      e.lowerMesh.rotation.set(0, 0, 0);
      e.upperMesh.position.set(0, 0, 0);
      e.upperMesh.rotation.set(0, 0, 0);
      e.dropYolk.visible = false;
    });

    // Reset chopsticks, spatula, knife, replay basket
    this.kitchen.chopsticksGroup.position.copy(this.kitchen.chopsticksHomePos);
    this.kitchen.chopsticksGroup.rotation.set(Math.PI * 0.5, 0.18, 0);
    this.kitchen.chopsticksGroup.visible = true;

    this.kitchen.spatulaGroup.position.copy(this.kitchen.spatulaHomePos);
    this.kitchen.spatulaGroup.rotation.set(0, 0, 0);

    this.kitchen.knifeGroup.position.copy(this.kitchen.knifeHomePos);
    this.kitchen.knifeGroup.rotation.set(0, Math.PI * 0.45, 0);

    this.kitchen.replayBasket.visible = false;
    this.tamagoyaki.hideAll();
    this.tamagoyaki.resetBubbles();
    this.hand.hide(-1.55);

    this.companion.setTargetX(-1.55);
    this.companion.setLookTarget(new THREE.Vector3(-1.55, 0.25, 0.35));
    this.companion.setMood('curious', 4);
    this._updateStoveKnobVisual();
  }

  _getTamagoyakiConfig() {
    const puffiness =
      (this.crackedCount >= 3 ? 0.45 : 0.0) +
      (this.hasDashi ? 0.35 : 0.0) +
      Math.min(0.45, this.froth * 0.6);
    const marbled = this.maxStirSpeedSeen < 1.35 && this.mixProgress < 1.05;
    return {
      sear: Math.max(0.22, Math.min(0.95, this.searAccum)),
      layers: Math.max(1, this.layerIndex + 1),
      hasNegi: this.hasNegi,
      hasNori: this.hasNori,
      hasDashi: this.hasDashi,
      marbled,
      puffiness,
    };
  }

  _bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.unlock();
      if (this.activePointerId !== null) return; // single-finger safety!
      this.activePointerId = e.pointerId;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.idleTime = 0;
      this.hintAnim = null;
      this._onPointerDown(e);
    });

    dom.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      this.idleTime = 0;
      this._onPointerMove(e);
    });

    const endHandler = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this._onPointerUp(e);
    };
    dom.addEventListener('pointerup', endHandler);
    dom.addEventListener('pointercancel', endHandler);

    window.addEventListener('resize', () => this._onResize());
    this._onResize();
  }

  _onResize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Responsive FOV: wide enough on portrait iPhone so eggs+bowl / pan+bowl / board+bento are 100% unclipped and large!
    this.camera.fov = aspect < 1.0 ? THREE.MathUtils.clamp(45 / Math.pow(aspect, 0.36), 44, 62) : 37;
    this.camera.updateProjectionMatrix();
    this._updateCameraGoals(false);
  }

  _setRayFromEvent(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    this.raycaster.ray.intersectPlane(this.counterPlane, this.dragWorldPos);
  }

  _raycastHits() {
    const hits = this.raycaster.intersectObjects(this.kitchen.hitTargets, false);
    return hits.filter((h) => {
      let o = h.object;
      while (o) {
        if (!o.visible && o !== h.object) return false;
        o = o.parent;
      }
      return true;
    });
  }

  _addWobble(obj, amp = 0.08) {
    if (!obj) return;
    this.wobbles = this.wobbles.filter((w) => w.obj !== obj);
    this.wobbles.push({ obj, baseRotZ: obj.rotation.z, t: 0, amp });
  }

  _onPointerDown(e) {
    this._setRayFromEvent(e);
    this.prevDragWorldPos.copy(this.dragWorldPos);
    const hits = this._raycastHits();
    const first = hits.length > 0 ? hits[0].object.userData : null;

    // 1. Check replay egg basket if visible!
    if (this.kitchen.replayBasket.visible && first && first.hitType === 'replayEggs') {
      this.audio.playSparkleChime([523.25, 659.25, 783.99]);
      this.sessionCount++;
      this._resetState();
      return;
    }

    // 2. Stage-specific rich physical interactions (only current stage gives main reaction; other items give gentle physical wobble!)
    if (this.stage === 'crack') {
      if (first && first.hitType === 'egg') {
        const egg = this.kitchen.eggs[first.eggIndex];
        if (egg && (egg.state === 'tray' || egg.state === 'cracked1')) {
          this._handleEggInteract(egg);
          this.dragState = { type: 'egg', egg, startY: e.clientY, startX: e.clientX, moved: false };
          return;
        }
      }
      if (first && first.hitType === 'mixin') {
        this._addMixin(first.mixinType);
        return;
      }
      if (first && (first.hitType === 'chopsticks' || first.hitType === 'bowl')) {
        if (this.crackedCount >= 2) {
          // Enter whisk stage immediately!
          this._enterStage('whisk');
          this.dragState = { type: 'whisk', lastX: e.clientX, lastY: e.clientY };
          return;
        } else if (this.selectedEggIndex >= 0) {
          // Tapping the bowl while holding a cracked egg finishes cracking it right into the bowl!
          const egg = this.kitchen.eggs[this.selectedEggIndex];
          if (egg && egg.state === 'cracked1') {
            this._crackOpenEgg(egg);
            return;
          }
        } else {
          // Gentle stoneware clink
          this._addWobble(this.kitchen.bowlGroup, 0.04);
          this.audio.playGentleClink('ceramic');
          return;
        }
      }
    } else if (this.stage === 'whisk') {
      if (first && first.hitType === 'mixin') {
        this._addMixin(first.mixinType);
        return;
      }
      if (first && first.hitType === 'egg') {
        const egg = this.kitchen.eggs[first.eggIndex];
        if (egg && egg.state === 'tray') {
          this._crackOpenEgg(egg);
          return;
        }
      }
      // Pressing anywhere near bowl/chopsticks starts whisking!
      const distBowl = this.dragWorldPos.distanceTo(this.kitchen.bowlHomePos);
      if (distBowl < 0.85 || (first && (first.hitType === 'bowl' || first.hitType === 'chopsticks'))) {
        this.dragState = { type: 'whisk', lastX: e.clientX, lastY: e.clientY };
        this._applyWhiskStep(0.085); // generous tap-stir progress too!
        return;
      }
    } else if (this.stage === 'pan_pour') {
      if (first && first.hitType === 'stoveKnob') {
        this._cycleStoveHeat();
        return;
      }
      if (first && (first.hitType === 'bowl' || first.hitType === 'pan')) {
        this._startPouringLayer();
        return;
      }
    } else if (this.stage === 'pan_cook') {
      if (first && first.hitType === 'stoveKnob') {
        this._cycleStoveHeat();
        return;
      }
      // Discovery: pop sizzling bubbles on the setting egg!
      if (first && first.hitType === 'bubble') {
        const bub = this.tamagoyaki.bubbles.find((b) => b.mesh === hits[0].object);
        if (bub && !bub.popped) {
          bub.popped = true;
          bub.mesh.visible = false;
          this.audio.playBubblePop();
          const wp = new THREE.Vector3();
          bub.mesh.getWorldPosition(wp);
          this.particles.spawnSteam(wp, { startScale: 0.08, endScale: 0.25, life: 0.7, opacity: 0.38 });
          this.companion.pulseJoy();
          return;
        }
      }
      // Allow eager child to start rolling as soon as egg is reasonably set (> 0.45)
      if (this.cookProgress > 0.45 && first && (first.hitType === 'pan' || first.hitType === 'spatula')) {
        this._enterStage('pan_roll');
        this.dragState = { type: 'roll', startY: e.clientY, startRoll: this.rollProgress };
        return;
      }
    } else if (this.stage === 'pan_roll') {
      if (first && first.hitType === 'stoveKnob') {
        this._cycleStoveHeat();
        return;
      }
      if (first && (first.hitType === 'pan' || first.hitType === 'spatula')) {
        this.dragState = {
          type: 'roll',
          startY: e.clientY,
          startRoll: this.rollProgress,
          moved: false,
        };
        return;
      }
    } else if (this.stage === 'slice') {
      if (first && (first.hitType === 'slice' || first.hitType === 'board' || first.hitType === 'knife')) {
        this.dragState = { type: 'slice', startY: e.clientY, slicedThisDrag: false };
        return;
      }
    } else if (this.stage === 'bento' || this.stage === 'eat') {
      // Ketchup decoration discovery!
      if (first && first.hitType === 'ketchup') {
        this._applyKetchup();
        return;
      }
      // Cute bento flag picks discovery!
      if (first && first.hitType === 'picks') {
        this._applyFlagPicks();
        return;
      }
      // Pick up a slice from the cutting board (or feed a packed slice from bento!)
      if (first && first.hitType === 'slice') {
        const s = this.tamagoyaki.slices[first.sliceIndex];
        if (s && s.state === 'board') {
          this.carriedSlice = s;
          s.state = 'carried';
          this.audio.playGentleClink('wood');
          this.dragState = {
            type: 'carrySlice',
            slice: s,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
          };
          return;
        }
        if (s && s.state === 'bento' && this.packedCount >= this.tamagoyaki.sliceCount && !this.eatAnim) {
          this._feedSliceToCompanion(s);
          return;
        }
      }
      // Tapping cutting board grabs next unpacked slice automatically for tiny fingers
      if (this.stage === 'bento' && first && first.hitType === 'board') {
        const nextBoard = this.tamagoyaki.slices.find((s) => s.state === 'board');
        if (nextBoard) {
          this._packSliceIntoBento(nextBoard);
          return;
        }
      }
      // Tapping full bento feeds a slice to companion!
      if (first && first.hitType === 'bento') {
        if (this.packedCount >= this.tamagoyaki.sliceCount && !this.eatAnim) {
          const nextBento = this.tamagoyaki.slices.find((s) => s.state === 'bento');
          if (nextBento) {
            this._feedSliceToCompanion(nextBento);
            return;
          }
        } else {
          // If slices remain on board, tapping the inviting bento slot packs the next slice smoothly!
          const nextBoard = this.tamagoyaki.slices.find((s) => s.state === 'board');
          if (nextBoard) {
            this._packSliceIntoBento(nextBoard);
            return;
          }
        }
      }
    }

    // Non-active kitchen items gently wobble with authentic material sound (never breaks flow!)
    if (first) {
      if (first.hitType === 'pan') {
        this._addWobble(this.kitchen.panGroup, 0.03);
        this.audio.playGentleClink('metal');
      } else if (first.hitType === 'bento') {
        this._addWobble(this.kitchen.bentoGroup, 0.035);
        this.audio.playGentleClink('wood');
      } else if (first.hitType === 'stoveKnob') {
        this._cycleStoveHeat();
      } else if (first.hitType === 'ketchup') {
        this._addWobble(this.kitchen.ketchupGroup, 0.09);
        this.audio.playGentleClink('wood');
      }
    }
  }

  _onPointerMove(e) {
    this._setRayFromEvent(e);
    if (!this.dragState) return;

    if (this.dragState.type === 'egg') {
      const dist = Math.hypot(e.clientX - this.dragState.startX, e.clientY - this.dragState.startY);
      if (dist > 28) {
        this.dragState.moved = true;
        // Dragging egg right toward the bowl smoothly cracks it open!
        const dBowl = this.dragWorldPos.distanceTo(this.kitchen.bowlHomePos);
        if (dBowl < 0.65 && this.dragState.egg.state !== 'splitting' && this.dragState.egg.state !== 'done') {
          this._crackOpenEgg(this.dragState.egg);
          this.dragState = null;
        }
      }
    } else if (this.dragState.type === 'whisk') {
      const dx = e.clientX - this.dragState.lastX;
      const dy = e.clientY - this.dragState.lastY;
      this.dragState.lastX = e.clientX;
      this.dragState.lastY = e.clientY;
      const pxMove = Math.hypot(dx, dy);
      if (pxMove > 1.5) {
        this._applyWhiskStep(Math.min(0.06, pxMove * 0.00145));
      }
    } else if (this.dragState.type === 'roll') {
      const dy = e.clientY - this.dragState.startY;
      if (Math.abs(dy) > 10) this.dragState.moved = true;
      // Dragging downward (+Y screen pixels) maps cleanly to rolling forward (+Z) in the rectangular pan!
      const h = Math.max(260, this.container.clientHeight * 0.34);
      const nextRoll = THREE.MathUtils.clamp(this.dragState.startRoll + dy / h, this.rollProgress, 1.0);
      if (nextRoll > this.rollProgress + 0.002) {
        this.rollProgress = nextRoll;
        if (Math.random() < 0.22) {
          this.particles.spawnSteam(new THREE.Vector3(0, 0.22, 0.24), {
            startScale: 0.1,
            endScale: 0.35,
            opacity: 0.26,
          });
        }
      }
      if (this.rollProgress >= 0.96) {
        this.dragState = null;
        this._finishCurrentRoll();
      }
    } else if (this.dragState.type === 'slice') {
      const dy = e.clientY - this.dragState.startY;
      if (!this.dragState.slicedThisDrag && dy > 26) {
        this.dragState.slicedThisDrag = true;
        this._performSliceCut();
      }
    } else if (this.dragState.type === 'carrySlice') {
      const dist = Math.hypot(e.clientX - this.dragState.startX, e.clientY - this.dragState.startY);
      if (dist > 14) this.dragState.moved = true;
      const s = this.dragState.slice;
      s.group.position.set(
        THREE.MathUtils.clamp(this.dragWorldPos.x, 0.8, 3.2),
        0.46,
        THREE.MathUtils.clamp(this.dragWorldPos.z, -0.35, 0.95)
      );
      s.group.rotation.y = -0.32;
      this.hand.setTarget(
        new THREE.Vector3(s.group.position.x + 0.08, s.group.position.y + 0.18, s.group.position.z + 0.24),
        new THREE.Euler(0.35, -0.2, 0),
        'pinch',
        true
      );
      this.companion.setLookTarget(s.group.position);
    }
  }

  _onPointerUp() {
    if (!this.dragState) return;
    const ds = this.dragState;
    this.dragState = null;

    if (ds.type === 'roll' && !ds.moved) {
      // Forgiving tap-to-roll! Tapping pan advances ~38% smoothly so kids who tap instead of drag still succeed effortlessly!
      this.rollProgress = Math.min(1.0, this.rollProgress + 0.38);
      this.audio.playRollFold(this.layerIndex);
      if (this.rollProgress >= 0.94) {
        this._finishCurrentRoll();
      }
    } else if (ds.type === 'slice' && !ds.slicedThisDrag) {
      // Forgiving tap-to-slice!
      this._performSliceCut();
    } else if (ds.type === 'carrySlice') {
      const s = ds.slice;
      this.carriedSlice = null;
      const bentoPos = this.kitchen.bentoGroup.position;
      const distBento = Math.hypot(s.group.position.x - bentoPos.x, s.group.position.z - bentoPos.z);
      // Generous magnetic snap: if tapped OR dropped anywhere near bento box, tuck snugly into bento!
      if (!ds.moved || distBento < 1.05 || s.group.position.x > 1.85) {
        this._packSliceIntoBento(s);
      } else {
        s.state = 'board';
        this.hand.hide(2.0);
      }
    }
  }

  // --- STAGE 1: EGG CRACKING & MIX-INS ---
  _handleEggInteract(egg) {
    if (egg.state === 'tray') {
      // First tap: lift egg to stoneware bowl rim -> KON! crack line appears!
      egg.state = 'cracked1';
      egg.animT = 0;
      this.selectedEggIndex = egg.index;
      egg.shellCtrl.drawCrack(1);
      this.audio.playEggTap(0.95 + egg.index * 0.07);
      this.companion.setLookTarget(this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.42, 0)));
      this.companion.setMood('curious', 2.2);
    } else if (egg.state === 'cracked1') {
      this._crackOpenEgg(egg);
    }
  }

  _crackOpenEgg(egg) {
    if (egg.state === 'splitting' || egg.state === 'done') return;
    egg.state = 'splitting';
    egg.animT = 0;
    egg.shellCtrl.drawCrack(2);
    egg.dropYolk.visible = true;
    this.audio.playEggCrack();

    const bowlTop = this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.36, 0));
    this.companion.setLookTarget(bowlTop);

    // Delayed yolk plop into bowl
    setTimeout(() => {
      if (this.stage !== 'crack' && this.stage !== 'whisk') return;
      this.crackedCount++;
      const addYolks = egg.isDoubleYolk ? 2 : 1;
      for (let k = 0; k < addYolks; k++) {
        const yObj = this.kitchen.bowlYolks[this.yolkCount];
        if (yObj) {
          const ang = this.yolkCount * 2.1 + 0.4;
          const rad = this.yolkCount === 0 ? 0.04 : 0.12;
          yObj.position.set(Math.cos(ang) * rad, 0.065 + this.crackedCount * 0.018, Math.sin(ang) * rad);
          yObj.scale.setScalar(1);
          yObj.visible = true;
          this.yolkCount++;
        }
      }

      this.kitchen.bowlLiquidMesh.visible = true;
      this.kitchen.bowlLiquidMesh.position.y = 0.065 + this.crackedCount * 0.022;
      this.kitchen.bowlLiquidCtrl.render({
        mixProgress: this.mixProgress,
        swirlAngle: this.swirlAngle,
        froth: this.froth,
        hasNegi: this.hasNegi,
        hasNori: this.hasNori,
        hasDashi: this.hasDashi,
      });

      this.particles.spawnSplash(
        this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.16, 0)),
        egg.isDoubleYolk ? 14 : 8,
        { color: 0xffb324, speed: 0.75 }
      );

      if (egg.isDoubleYolk) {
        // Delightful surprise: double-yolk egg!
        this.audio.playSparkleChime([587.33, 739.99, 880.0, 1174.66]);
        this.particles.spawnBokehBurst(
          this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.42, 0)),
          10
        );
        this.companion.setMood('surprised', 2.4);
      } else {
        this.companion.setMood('excited', 1.6);
      }

      // If all 3 eggs are cracked, smoothly invite whisking!
      if (this.crackedCount >= 3 && this.stage === 'crack') {
        setTimeout(() => {
          if (this.stage === 'crack') this._enterStage('whisk');
        }, 550);
      }
    }, 170);
  }

  _addMixin(type) {
    const vessel = this.kitchen.mixins[type];
    this._addWobble(vessel, 0.18);
    this.audio.playAddIngredient(type);

    const dropPos = this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.34, 0));
    if (type === 'negi') {
      this.hasNegi = true;
      this.particles.spawnSplash(dropPos, 14, { color: 0x5ca63a, speed: 0.5, flat: true, scale: 1.25 });
    } else if (type === 'nori') {
      this.hasNori = true;
      this.particles.spawnSplash(dropPos, 10, { color: 0x1e2c1b, speed: 0.42, flat: true, scale: 1.4 });
    } else if (type === 'dashi') {
      this.hasDashi = true;
      this.particles.spawnSplash(dropPos, 12, { color: 0xd48c24, speed: 0.55, scale: 1.0 });
    }

    if (this.crackedCount > 0) {
      this.kitchen.bowlLiquidCtrl.render({
        mixProgress: this.mixProgress,
        swirlAngle: this.swirlAngle,
        froth: this.froth,
        hasNegi: this.hasNegi,
        hasNori: this.hasNori,
        hasDashi: this.hasDashi,
      });
    }
    this.companion.setLookTarget(dropPos);
    this.companion.setMood('excited', 1.6);
  }

  // --- STAGE 2: WHISKING ---
  _applyWhiskStep(amount) {
    this.mixProgress = Math.min(1.05, this.mixProgress + amount);
    this.stirSpeed = Math.min(2.2, this.stirSpeed + amount * 14);
    this.maxStirSpeedSeen = Math.max(this.maxStirSpeedSeen, this.stirSpeed);
    if (this.stirSpeed > 1.15) {
      this.froth = Math.min(1.0, this.froth + amount * 1.4);
      if (Math.random() < 0.35) {
        this.particles.spawnSplash(
          this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.22, 0)),
          2,
          { color: 0xffd044, speed: 0.65, scale: 0.72 }
        );
      }
    }
    this.swirlAngle += amount * 12.5;

    // Yolks visibly stretch & blend into golden liquid!
    const yolkFade = Math.max(0, 1 - this.mixProgress * 1.55);
    for (let i = 0; i < this.yolkCount; i++) {
      const yObj = this.kitchen.bowlYolks[i];
      if (!yObj) continue;
      if (yolkFade <= 0.02) {
        yObj.visible = false;
      } else {
        const ang = this.swirlAngle * 0.75 + i * 2.1;
        const rad = 0.09 * yolkFade;
        yObj.position.x = Math.cos(ang) * rad;
        yObj.position.z = Math.sin(ang) * rad;
        yObj.scale.set(1.0 + (1 - yolkFade) * 0.5, yolkFade, 1.0 - (1 - yolkFade) * 0.2);
      }
    }

    this.kitchen.bowlLiquidCtrl.render({
      mixProgress: this.mixProgress,
      swirlAngle: this.swirlAngle,
      froth: this.froth,
      hasNegi: this.hasNegi,
      hasNori: this.hasNori,
      hasDashi: this.hasDashi,
    });

    if (this.mixProgress >= 1.0 && this.stage === 'whisk') {
      this.dragState = null;
      this.audio.updateWhisk(0, 0.016);
      this.audio.playSparkleChime([523.25, 659.25, 783.99]);
      this.companion.setMood('excited', 2.0);
      this._enterStage('pan_pour');
    }
  }

  // --- STAGE 3: GAS STOVE, POURING, SIZZLING & 3-LAYER ROLLING ---
  _cycleStoveHeat() {
    this.heatLevel = (this.heatLevel + 1) % 3; // 0 Low, 1 Med, 2 High
    this.audio.playStoveKnob(this.heatLevel);
    this._updateStoveKnobVisual();
    this.companion.setLookTarget(new THREE.Vector3(-0.56, 0.14, 0.76));
    if (this.heatLevel === 2) {
      this.companion.setMood('surprised', 1.4);
    }
  }

  _updateStoveKnobVisual() {
    const angles = [0.65, 0.0, -0.72];
    this.kitchen.stoveKnobDial.rotation.y = angles[this.heatLevel];
    const ringColors = [0x4da6ff, 0xff9d2e, 0xff4c1e];
    this.kitchen.heatRingMat.color.setHex(ringColors[this.heatLevel]);
    this.kitchen.heatRingMat.emissive.setHex(ringColors[this.heatLevel]);
    this.kitchen.heatRingMat.emissiveIntensity = 0.4 + this.heatLevel * 0.35;
  }

  _startPouringLayer() {
    if (this.pourAnimActive) return;
    this.pourAnimActive = true;
    this.pourAnimT = 0;
    this.pourFill = 0;
    this.cookProgress = 0;
    this.rollProgress = 0;
    this.tamagoyaki.resetBubbles();
    this.audio.playPourSizzle(this.heatLevel);
    this.companion.setLookTarget(new THREE.Vector3(0, 0.25, 0.24));
    this.companion.setMood('sniffing', 2.6);
  }

  _finishCurrentRoll() {
    this.rollProgress = 1.0;
    this.audio.playRollFold(this.layerIndex);

    // Update sear tone based on stove heat
    const heatSear = this.heatLevel === 0 ? 0.26 : this.heatLevel === 1 ? 0.56 : 0.88;
    this.searAccum = this.searAccum * 0.45 + heatSear * 0.55;
    this.tamagoyaki.refreshTextures(this._getTamagoyakiConfig());

    // Satisfying steam burst on roll completion
    for (let i = 0; i < 4; i++) {
      this.particles.spawnSteam(new THREE.Vector3(0, 0.24, 0.52), {
        startScale: 0.14,
        endScale: 0.48,
        opacity: 0.36,
      });
    }

    if (this.layerIndex < 2) {
      this._enterStage('pan_slide_back');
    } else {
      // All 3 layers rolled! Triumphant shape-pat & hop onto the hinoki cutting board!
      this.companion.setMood('excited', 2.8);
      this._enterStage('pan_finish');
    }
  }

  // --- STAGE 4: SLICING ON HINOKI CUTTING BOARD ---
  _performSliceCut() {
    if (this.sliceAnim || this.cutsDone >= 4) return;
    const cutIndex = this.cutsDone; // 0, 1, 2, 3 (4 cuts -> 5 slices!)
    this.sliceAnim = { t: 0, cutIndex, triggered: false };
    this.companion.setLookTarget(this.kitchen.boardCenter);
  }

  // --- STAGE 5: PACKING BENTO, DECORATIONS & FEEDING ---
  _packSliceIntoBento(slice) {
    if (slice.state === 'bento' || slice.state === 'eaten') return;
    const slotIdx = this.packedCount;
    const localSlot = this.kitchen.bentoSlots[slotIdx] || this.kitchen.bentoSlots[0];
    const worldSlot = this.kitchen.bentoGroup.position.clone().add(localSlot);

    slice.state = 'bento';
    slice.bentoSlot = slotIdx;
    slice.targetPos.copy(worldSlot);
    // Angle nicely so the golden spiral cross-section faces upward/toward camera!
    slice.targetRot.set(0.08, -0.35 + (slotIdx % 2) * 0.14, -0.14);
    slice.squash = 0.32;

    if (this.hasKetchup) slice.ketchup.visible = true;
    if (this.hasPicks && slotIdx < 3) slice.pick.visible = true;

    this.packedCount++;
    this.audio.playBentoPlace(slotIdx);
    this.particles.spawnSteam(worldSlot.clone().add(new THREE.Vector3(0, 0.14, 0)), {
      startScale: 0.1,
      endScale: 0.34,
      opacity: 0.3,
    });

    this.hand.hide(2.2);
    this.companion.setLookTarget(worldSlot);
    this.companion.pulseJoy();

    if (this.packedCount >= this.tamagoyaki.sliceCount) {
      this._enterStage('eat');
      this.audio.playSparkleChime([523.25, 659.25, 783.99, 1046.5]);
      this.companion.setMood('hungry', 60);
      // Celebratory first bite invitation after a short beat!
      setTimeout(() => {
        if (this.stage === 'eat' && this.eatenCount === 0 && !this.eatAnim) {
          const topSlice = this.tamagoyaki.slices.find((s) => s.state === 'bento');
          if (topSlice) this._feedSliceToCompanion(topSlice);
        }
      }, 1100);
    }
  }

  _applyKetchup() {
    this._addWobble(this.kitchen.ketchupGroup, 0.22);
    this.audio.playKetchupSquirt();
    this.hasKetchup = true;
    let applied = false;
    for (const s of this.tamagoyaki.slices) {
      if (s.state === 'bento' || s.state === 'board') {
        s.ketchup.visible = true;
        s.squash = 0.24;
        applied = true;
      }
    }
    if (applied) {
      this.particles.spawnSplash(
        this.kitchen.bentoGroup.position.clone().add(new THREE.Vector3(0.24, 0.34, 0.12)),
        8,
        { color: 0xd62b1f, speed: 0.55, scale: 0.85 }
      );
      this.companion.setMood('excited', 2.0);
    }
  }

  _applyFlagPicks() {
    this._addWobble(this.kitchen.picksGroup, 0.18);
    this.audio.playWarmNote(659.25, 0.13);
    this.hasPicks = true;
    let count = 0;
    for (const s of this.tamagoyaki.slices) {
      if (s.state === 'bento' && count < 3) {
        s.pick.visible = true;
        s.squash = 0.26;
        count++;
      }
    }
    this.companion.setMood('excited', 2.0);
  }

  _feedSliceToCompanion(slice) {
    if (this.eatAnim || slice.state !== 'bento') return;
    slice.state = 'eating';
    const startPos = slice.group.position.clone();
    const mouthPos = this.companion.getMouthWorldPosition();
    mouthPos.z += 0.22;
    this.eatAnim = {
      slice,
      startPos,
      mouthPos,
      t: 0,
      playedEat: false,
    };
    this.companion.setLookTarget(mouthPos);
    this.companion.setMood('blowing', 1.2);
  }

  // --- STAGE TRANSITIONS & CAMERA CHOREOGRAPHY ---
  _enterStage(nextStage) {
    this.stage = nextStage;
    this.stageTimer = 0;
    this.idleTime = 0;
    this.hintAnim = null;

    if (nextStage === 'whisk') {
      // Lift chopsticks upright into mixing bowl
      this.kitchen.chopsticksGroup.rotation.set(0.18, 0, -0.15);
      this.companion.setTargetX(-1.55);
      this.companion.setLookTarget(this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.28, 0)));
    } else if (nextStage === 'pan_pour') {
      this.pourAnimActive = false;
      this.kitchen.chopsticksGroup.visible = false;
      this.kitchen.bowlLiquidMesh.visible = true;
      this.kitchen.bowlLiquidMesh.position.y = 0.14 - this.layerIndex * 0.03;
      this.companion.setTargetX(0.0);
      this.companion.setLookTarget(new THREE.Vector3(0, 0.22, 0.24));
      this.hand.hide(0.0);
    } else if (nextStage === 'pan_cook') {
      this.companion.setLookTarget(new THREE.Vector3(0, 0.22, 0.24));
    } else if (nextStage === 'pan_roll') {
      this.companion.setMood('curious', 3.0);
    } else if (nextStage === 'pan_slide_back') {
      this.slideBackT = 0;
    } else if (nextStage === 'pan_finish') {
      this.finishFlipT = 0;
      this.audio.playFlipToBoard();
    } else if (nextStage === 'slice') {
      this.tamagoyaki.sheetMesh.visible = false;
      this.tamagoyaki.panRollMesh.visible = false;
      this.tamagoyaki.placeOnCuttingBoard(this.kitchen.boardCenter, this._getTamagoyakiConfig());
      this.companion.setTargetX(1.55);
      this.companion.setLookTarget(this.kitchen.boardCenter);
      this.hand.hide(1.6);
    } else if (nextStage === 'bento') {
      this.kitchen.knifeGroup.position.copy(this.kitchen.knifeHomePos);
      this.kitchen.knifeGroup.rotation.set(0, Math.PI * 0.45, 0);
      this.companion.setTargetX(2.08);
      this.companion.setLookTarget(this.kitchen.bentoGroup.position.clone().add(new THREE.Vector3(0.2, 0.18, 0.1)));
      this.companion.setMood('hungry', 60);
    } else if (nextStage === 'eat') {
      this.companion.setTargetX(2.25);
      this.companion.setLookTarget(this.kitchen.bentoGroup.position.clone().add(new THREE.Vector3(0.15, 0.2, 0.08)));
    }

    this._updateCameraGoals(false);
  }

  _updateCameraGoals(snap = false) {
    const aspect = this.camera.aspect || 1.33;
    const isPortrait = aspect < 0.95;
    const zPull = isPortrait ? 0.42 : 0.24;
    const yLift = isPortrait ? 0.08 : -0.10;

    if (this.stage === 'crack' || this.stage === 'whisk') {
      this.camDesiredPos.set(-1.66, 1.44 + yLift, 2.28 + zPull);
      this.camDesiredTarget.set(-1.62, 0.48, -0.12);
    } else if (
      this.stage === 'pan_pour' ||
      this.stage === 'pan_cook' ||
      this.stage === 'pan_roll' ||
      this.stage === 'pan_slide_back' ||
      this.stage === 'pan_finish'
    ) {
      this.camDesiredPos.set(-0.08, 1.50 + yLift, 2.30 + zPull);
      this.camDesiredTarget.set(-0.04, 0.48, -0.10);
    } else if (this.stage === 'slice') {
      this.camDesiredPos.set(1.52, 1.42 + yLift, 2.22 + zPull);
      this.camDesiredTarget.set(1.50, 0.46, -0.06);
    } else {
      // bento & eat: frame cutting board slices + bentwood bento box + ketchup/picks + companion!
      this.camDesiredPos.set(2.22, 1.56 + yLift, 2.58 + zPull * 1.1);
      this.camDesiredTarget.set(2.22, 0.48, -0.08);
    }

    if (snap) {
      this.camPos.copy(this.camDesiredPos);
      this.camTarget.copy(this.camDesiredTarget);
    }
  }

  // --- SINGLE GENTLE IDLE HAND DEMONSTRATION AFTER 8.5s (ZERO ARROWS / ZERO TEXT) ---
  _triggerIdleHint() {
    if (this.stage === 'crack') {
      const egg = this.kitchen.eggs.find((e) => e.state === 'tray' || e.state === 'cracked1');
      if (egg) {
        this.hintAnim = {
          t: 0,
          dur: 1.5,
          from: egg.group.position.clone().add(new THREE.Vector3(0.06, 0.34, 0.24)),
          to: this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(-0.18, 0.38, 0.24)),
          pose: 'pinch',
        };
      }
    } else if (this.stage === 'whisk') {
      this.hintAnim = {
        t: 0,
        dur: 1.6,
        type: 'circle',
        center: this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0.04, 0.44, 0.16)),
        pose: 'grip',
      };
    } else if (this.stage === 'pan_pour') {
      this.hintAnim = {
        t: 0,
        dur: 1.4,
        from: this.kitchen.bowlPourPos.clone().add(new THREE.Vector3(-0.08, 0.44, 0.24)),
        to: new THREE.Vector3(-0.34, 0.50, 0.26),
        pose: 'pinch',
      };
    } else if (this.stage === 'pan_roll') {
      this.hintAnim = {
        t: 0,
        dur: 1.5,
        from: new THREE.Vector3(0.08, 0.38, -0.14),
        to: new THREE.Vector3(0.08, 0.38, 0.56),
        pose: 'flat',
      };
    } else if (this.stage === 'slice') {
      this.hintAnim = {
        t: 0,
        dur: 1.3,
        from: this.kitchen.boardCenter.clone().add(new THREE.Vector3(0.20, 0.42, 0.08)),
        to: this.kitchen.boardCenter.clone().add(new THREE.Vector3(0.20, 0.22, 0.28)),
        pose: 'grip',
      };
    } else if (this.stage === 'bento') {
      const s = this.tamagoyaki.slices.find((x) => x.state === 'board');
      if (s) {
        this.hintAnim = {
          t: 0,
          dur: 1.5,
          from: s.group.position.clone().add(new THREE.Vector3(0.04, 0.30, 0.20)),
          to: this.kitchen.bentoGroup.position.clone().add(new THREE.Vector3(0.22, 0.34, 0.26)),
          pose: 'pinch',
        };
      }
    }
  }

  // --- MAIN FRAME UPDATE ---
  _loop(now) {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.time += dt;
    this.stageTimer += dt;

    // FPS tracking
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.6) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Idle single-hand demonstration timer (>8.5s untouched)
    if (!this.dragState && !this.eatAnim && !this.sliceAnim && !this.pourAnimActive) {
      this.idleTime += dt;
      if (this.idleTime > 8.5 && !this.hintAnim) {
        this._triggerIdleHint();
        this.idleTime = 0;
      }
    }

    this._updateEggs(dt);
    this._updateWhiskVisuals(dt);
    this._updateStoveAndPan(dt);
    this._updateSliceAnim(dt);
    this._updateEatAnim(dt);
    this._updateWobbles(dt);
    this._updateIdleHint(dt);

    // Smooth camera glide
    this.camPos.lerp(this.camDesiredPos, Math.min(1, dt * 3.8));
    this.camTarget.lerp(this.camDesiredTarget, Math.min(1, dt * 4.4));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // Update actors & FX
    this.tamagoyaki.updateSlices(dt, this._getTamagoyakiConfig().puffiness);
    this.companion.update(dt);
    this.hand.update(dt);
    this.particles.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _updateEggs(dt) {
    const rimPos = this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(-0.36, 0.34, 0.05));
    const overBowl = this.kitchen.bowlHomePos.clone().add(new THREE.Vector3(0, 0.44, 0));

    for (const egg of this.kitchen.eggs) {
      if (egg.state === 'cracked1') {
        egg.animT += dt;
        const hop = Math.sin(Math.min(1, egg.animT * 5) * Math.PI) * 0.08;
        egg.group.position.lerp(rimPos.clone().add(new THREE.Vector3(0, hop, 0)), Math.min(1, dt * 11));
        egg.group.rotation.z = Math.sin(egg.animT * 18) * 0.14 * Math.exp(-egg.animT * 3);
        if (!this.hintAnim) {
          this.hand.setTarget(
            egg.group.position.clone().add(new THREE.Vector3(0.06, 0.10, 0.24)),
            new THREE.Euler(0.25, -0.15, 0),
            'pinch',
            true
          );
        }
      } else if (egg.state === 'splitting') {
        egg.animT += dt;
        egg.group.position.lerp(overBowl, Math.min(1, dt * 14));
        const splitU = Math.min(1, egg.animT * 3.2);
        // Dramatic realistic shell halves pulling apart!
        egg.lowerMesh.position.set(-splitU * 0.12, splitU * 0.02, 0);
        egg.lowerMesh.rotation.z = splitU * 0.85;
        egg.upperMesh.position.set(splitU * 0.12, splitU * 0.03, 0);
        egg.upperMesh.rotation.z = -splitU * 0.85;

        // Glossy yolk drops straight down into bowl
        egg.dropYolk.position.y = -splitU * 0.34;
        if (splitU > 0.72) egg.dropYolk.visible = false;

        if (!this.hintAnim) {
          this.hand.setTarget(
            egg.group.position.clone().add(new THREE.Vector3(0.09, 0.11, 0.25)),
            new THREE.Euler(0.22, -0.18, 0),
            'pinch',
            true
          );
        }

        if (egg.animT > 0.56) {
          egg.state = 'done';
          egg.group.visible = false;
          if (this.selectedEggIndex === egg.index) this.selectedEggIndex = -1;
          this.hand.hide(-1.55);
        }
      }
    }

    // Gentle inviting shift of chopsticks once >= 2 eggs are in bowl
    if (this.stage === 'crack' && this.crackedCount >= 2) {
      const nudge = Math.sin(this.time * 3.2) * 0.025;
      this.kitchen.chopsticksGroup.position.x = this.kitchen.chopsticksHomePos.x - 0.06 + nudge;
    }
  }

  _updateWhiskVisuals(dt) {
    this.stirSpeed = Math.max(0, this.stirSpeed - dt * 2.8);
    this.audio.updateWhisk(this.stage === 'whisk' ? this.stirSpeed * 0.65 : 0, dt);

    if (this.stage === 'whisk') {
      const r = 0.13 + Math.min(0.08, this.stirSpeed * 0.04);
      const sx = this.kitchen.bowlHomePos.x + Math.cos(this.swirlAngle) * r;
      const sz = this.kitchen.bowlHomePos.z + Math.sin(this.swirlAngle) * r;
      this.kitchen.chopsticksGroup.position.lerp(new THREE.Vector3(sx, 0.34, sz), Math.min(1, dt * 16));
      this.kitchen.chopsticksGroup.rotation.set(
        0.22 + Math.sin(this.swirlAngle) * 0.16,
        0,
        -0.15 - Math.cos(this.swirlAngle) * 0.16
      );
      if (this.dragState && this.dragState.type === 'whisk') {
        this.hand.setTarget(
          new THREE.Vector3(sx + 0.05, 0.56, sz + 0.22),
          new THREE.Euler(0.32, -0.15, 0),
          'grip',
          true
        );
      } else if (!this.hintAnim) {
        this.hand.hide(-1.55);
      }
    }
  }

  _updateStoveAndPan(dt) {
    const inPanStage =
      this.stage === 'pan_pour' ||
      this.stage === 'pan_cook' ||
      this.stage === 'pan_roll' ||
      this.stage === 'pan_slide_back' ||
      this.stage === 'pan_finish';

    // Animate blue-orange gas flame petals smoothly!
    const flameTargetScale = inPanStage ? 0.62 + this.heatLevel * 0.36 : 0.22;
    this.kitchen.flameLight.intensity = inPanStage ? 0.55 + this.heatLevel * 0.52 : 0.15;
    this.kitchen.flameLight.color.setHex(this.heatLevel === 2 ? 0xff9340 : 0x4aa8ff);
    for (const p of this.kitchen.flamePetals) {
      const flicker = 0.86 + 0.24 * Math.sin(this.time * 18 + p.phase) * Math.cos(this.time * 11 - p.phase);
      p.group.scale.setScalar(flameTargetScale * flicker);
      p.tip.visible = this.heatLevel >= 1;
    }

    // Continuous realistic flame + sizzling pan audio bed
    let sizzleAmt = 0;
    if (this.stage === 'pan_cook') sizzleAmt = 0.55 + this.heatLevel * 0.22;
    else if (this.stage === 'pan_roll') sizzleAmt = 0.36 + this.heatLevel * 0.18;
    else if (this.stage === 'pan_pour' && this.pourAnimActive) sizzleAmt = 0.72 + this.heatLevel * 0.2;
    this.audio.setCookingBed(inPanStage ? (this.heatLevel + 1) / 3 : 0, sizzleAmt, 1 - this.cookProgress);

    // Move golden egg bowl cleanly beside the pan during pan stages
    if (inPanStage && !this.pourAnimActive) {
      const tiltInvite = this.stage === 'pan_pour' ? -0.08 - 0.04 * Math.sin(this.time * 3.0) : 0;
      this.kitchen.bowlGroup.position.lerp(this.kitchen.bowlPourPos, Math.min(1, dt * 5));
      this.kitchen.bowlGroup.rotation.z += (tiltInvite - this.kitchen.bowlGroup.rotation.z) * Math.min(1, dt * 6);
    }

    // Pour animation (bowl lifts over rectangular pan -> golden egg stream pours in!)
    if (this.stage === 'pan_pour' && this.pourAnimActive) {
      this.pourAnimT += dt;
      const u = Math.min(1, this.pourAnimT / 1.15);
      const liftArc = Math.sin(u * Math.PI);
      const pourPos = new THREE.Vector3(-0.56, 0.56 * liftArc + 0.18, 0.24);
      this.kitchen.bowlGroup.position.lerp(pourPos, Math.min(1, dt * 10));
      this.kitchen.bowlGroup.rotation.z = -liftArc * 1.05;

      this.hand.setTarget(
        this.kitchen.bowlGroup.position.clone().add(new THREE.Vector3(-0.24, 0.12, 0.26)),
        new THREE.Euler(0.2, 0.25, -liftArc * 0.6),
        'grip',
        true
      );

      const pouring = u > 0.18 && u < 0.85;
      this.kitchen.pourStream.visible = pouring;
      this.kitchen.pourStream.position.set(-0.24, 0.06, 0.24);
      if (pouring) {
        this.pourFill = Math.min(1.0, this.pourFill + dt * 1.45);
        this.kitchen.bowlLiquidMesh.position.y = Math.max(0.055, this.kitchen.bowlLiquidMesh.position.y - dt * 0.032);
        if (Math.random() < 0.45) {
          this.particles.spawnSteam(new THREE.Vector3(0, 0.18, 0.24), {
            startScale: 0.14,
            endScale: 0.52,
            opacity: 0.38,
          });
        }
      }

      if (u >= 1.0) {
        this.pourAnimActive = false;
        this.kitchen.pourStream.visible = false;
        this.pourFill = 1.0;
        this.hand.hide(0.0);
        this._enterStage('pan_cook');
      }
    }

    // Real-time cooking progression
    if (this.stage === 'pan_cook') {
      const cookRate = this.heatLevel === 0 ? 0.34 : this.heatLevel === 1 ? 0.50 : 0.72;
      this.cookProgress = Math.min(1.0, this.cookProgress + dt * cookRate);

      // Rising sizzling kitchen steam!
      this.steamAccum += dt * (2.6 + this.heatLevel * 1.8);
      while (this.steamAccum >= 1) {
        this.steamAccum -= 1;
        this.particles.spawnSteam(new THREE.Vector3(0, 0.20, 0.24), {
          startScale: 0.12,
          endScale: 0.48 + this.heatLevel * 0.1,
          opacity: 0.26 + this.heatLevel * 0.06,
        });
      }

      if (this.cookProgress >= 0.92) {
        this._enterStage('pan_roll');
      }
    }

    // Spatula positioning during roll & slide back (angled cleanly from upper-right, NEVER intersecting the egg roll!)
    if (this.stage === 'pan_roll') {
      const rollZ = -0.34 + this.rollProgress * 0.66;
      // Blade rests cleanly behind the far edge of the rolling log; handle angles UP and RIGHT-BACK cleanly clear!
      const spatPos = new THREE.Vector3(0.28, 0.24, 0.24 + rollZ - 0.24);
      this.kitchen.spatulaGroup.position.lerp(spatPos, Math.min(1, dt * 14));
      this.kitchen.spatulaGroup.rotation.set(-0.26, Math.PI * 0.78, 0.10);

      // Continuous sizzling kitchen steam while rolling hot tamagoyaki!
      this.steamAccum += dt * (4.2 + this.heatLevel * 2.0);
      while (this.steamAccum >= 1) {
        this.steamAccum -= 1;
        this.particles.spawnSteam(new THREE.Vector3((Math.random() - 0.5) * 0.42, 0.24, 0.24 + rollZ), {
          startScale: 0.22,
          endScale: 0.68,
          opacity: 0.52,
          riseSpeed: 0.46,
        });
      }

      if (this.dragState && this.dragState.type === 'roll') {
        this.hand.setTarget(
          spatPos.clone().add(new THREE.Vector3(0.26, 0.18, 0.14)),
          new THREE.Euler(0.24, -0.35, 0),
          'grip',
          true
        );
      } else if (!this.hintAnim) {
        this.hand.hide(0.0);
      }
    } else if (this.stage === 'pan_slide_back') {
      this.slideBackT += dt * 1.7;
      const u = Math.min(1, this.slideBackT);
      const ease = u * u * (3 - 2 * u);
      const zSlide = THREE.MathUtils.lerp(0.32, -0.34, ease);
      this.kitchen.spatulaGroup.position.set(0.18, 0.25, 0.24 + zSlide + 0.16);
      this.kitchen.spatulaGroup.rotation.set(0.18, -0.25, 0);
      this.hand.setTarget(
        new THREE.Vector3(0.24, 0.34, 0.24 + zSlide + 0.46),
        new THREE.Euler(0.22, -0.2, 0),
        'grip',
        true
      );
      if (u >= 1) {
        this.layerIndex++;
        this.rollProgress = 0;
        this.pourFill = 0;
        this.cookProgress = 0;
        this.hand.hide(0.0);
        this._enterStage('pan_pour');
      }
    } else if (this.stage === 'pan_finish') {
      this.finishFlipT += dt;
      const u = Math.min(1, this.finishFlipT / 0.95);
      // Hop arc from pan onto the warm hinoki cutting board!
      const hop = Math.sin(u * Math.PI) * 0.68;
      this.tamagoyaki.panRollMesh.position.set(
        THREE.MathUtils.lerp(0, 1.48, u),
        0.12 + hop,
        THREE.MathUtils.lerp(0.32, 0.10, u)
      );
      this.tamagoyaki.panRollMesh.rotation.x = Math.PI * 6 + u * Math.PI * 2;
      if (u >= 1) {
        this._enterStage('slice');
      }
    } else if (inPanStage) {
      this.kitchen.spatulaGroup.position.lerp(this.kitchen.spatulaHomePos, Math.min(1, dt * 6));
      this.kitchen.spatulaGroup.rotation.set(0, 0, 0);
    }

    // Update Tamagoyaki sheet & roll mesh in pan
    if (inPanStage && this.stage !== 'pan_finish') {
      const cfg = this._getTamagoyakiConfig();
      const sheetVisible =
        this.stage === 'pan_cook' ||
        this.stage === 'pan_roll' ||
        (this.stage === 'pan_pour' && this.pourFill > 0.04);
      const rollZOverride =
        this.stage === 'pan_slide_back'
          ? THREE.MathUtils.lerp(0.32, -0.34, Math.min(1, this.slideBackT))
          : this.stage === 'pan_pour' || this.stage === 'pan_cook'
          ? -0.34
          : undefined;

      this.tamagoyaki.updateSheet({
        visible: sheetVisible,
        pourFill: this.pourFill,
        cook: this.cookProgress,
        sear: this.heatLevel === 0 ? 0.25 : this.heatLevel === 1 ? 0.55 : 0.88,
        rollProgress: this.stage === 'pan_roll' ? this.rollProgress : 0,
        layerIndex: this.layerIndex,
        hasNegi: this.hasNegi,
        hasNori: this.hasNori,
        hasDashi: this.hasDashi,
        marbled: cfg.marbled,
        puffiness: cfg.puffiness,
        time: this.time,
        rollZOverride,
      });
    }
  }

  _updateSliceAnim(dt) {
    if (this.stage !== 'slice') return;

    // Fresh hot steam rising from the steaming tamagoyaki on the cutting board!
    this.steamAccum += dt * 1.9;
    while (this.steamAccum >= 1) {
      this.steamAccum -= 1;
      this.particles.spawnSteam(this.kitchen.boardCenter.clone().add(new THREE.Vector3(0, 0.18, 0)), {
        startScale: 0.10,
        endScale: 0.36,
        opacity: 0.24,
      });
    }

    // Next cut X position (slicing smoothly from right end toward left end)
    const sliceStep = 0.138;
    const cutLineX = this.kitchen.boardCenter.x + (1.5 - this.cutsDone) * sliceStep;

    if (this.sliceAnim) {
      this.sliceAnim.t += dt;
      const u = Math.min(1, this.sliceAnim.t / 0.42);
      // Downward chop curve onto hinoki board
      const down = Math.sin(u * Math.PI);
      const ky = this.kitchen.boardCenter.y + 0.34 - down * 0.24;
      this.kitchen.knifeGroup.position.set(cutLineX, ky, this.kitchen.boardCenter.z + 0.18 - down * 0.08);
      this.kitchen.knifeGroup.rotation.set(down * 0.14, 0, 0);

      this.hand.setTarget(
        new THREE.Vector3(cutLineX + 0.02, ky + 0.09, this.kitchen.boardCenter.z + 0.48),
        new THREE.Euler(0.24 + down * 0.14, 0, 0),
        'grip',
        true
      );

      if (!this.sliceAnim.triggered && u >= 0.48) {
        this.sliceAnim.triggered = true;
        this.cutsDone++;
        this.audio.playKnifeCut(this.cutsDone - 1);
        this.tamagoyaki.applyCutReveal(this.cutsDone, this.kitchen.boardCenter, this._getTamagoyakiConfig().puffiness);
        this.companion.pulseJoy();
        if (this.cutsDone === 4) {
          this.companion.setMood('excited', 2.4);
        }
        // Puff of fresh steam escaping the newly cut golden spiral!
        for (let k = 0; k < 3; k++) {
          this.particles.spawnSteam(new THREE.Vector3(cutLineX, this.kitchen.boardCenter.y + 0.16, this.kitchen.boardCenter.z), {
            startScale: 0.09,
            endScale: 0.34,
            opacity: 0.34,
          });
        }
      }

      if (u >= 1) {
        this.sliceAnim = null;
        if (this.cutsDone >= 4) {
          setTimeout(() => {
            if (this.stage === 'slice') this._enterStage('bento');
          }, 520);
        }
      }
    } else {
      // Hover knife gently ready right above the next cut line!
      const bob = Math.sin(this.time * 3.4) * 0.022;
      this.kitchen.knifeGroup.position.lerp(
        new THREE.Vector3(cutLineX, this.kitchen.boardCenter.y + 0.30 + bob, this.kitchen.boardCenter.z + 0.16),
        Math.min(1, dt * 8)
      );
      this.kitchen.knifeGroup.rotation.set(0.06, 0, 0);
      if (!this.hintAnim) this.hand.hide(1.6);
    }
  }

  _updateEatAnim(dt) {
    if (!this.eatAnim) {
      // Subtle warm steam from packed bento slices
      if (this.stage === 'bento' || this.stage === 'eat') {
        this.steamAccum += dt * 1.2;
        while (this.steamAccum >= 1) {
          this.steamAccum -= 1;
          this.particles.spawnSteam(
            this.kitchen.bentoGroup.position.clone().add(new THREE.Vector3(0.22, 0.24, 0.12)),
            { startScale: 0.08, endScale: 0.30, opacity: 0.20 }
          );
        }
      }
      return;
    }

    const ea = this.eatAnim;
    ea.t += dt;
    const s = ea.slice;

    if (ea.t < 0.72) {
      // Lift steaming slice gracefully up to companion's smiling face!
      const u = ea.t / 0.72;
      const ease = u * u * (3 - 2 * u);
      const pos = ea.startPos.clone().lerp(ea.mouthPos, ease);
      pos.y += Math.sin(u * Math.PI) * 0.24;
      s.group.position.copy(pos);
      s.group.rotation.y = -0.35 + ease * 0.35;
      this.hand.setTarget(
        pos.clone().add(new THREE.Vector3(0.10, 0.06, 0.26)),
        new THREE.Euler(0.15, -0.25, 0),
        'pinch',
        true
      );
      if (u > 0.55 && Math.random() < 0.35) {
        this.particles.spawnSteam(pos, { startScale: 0.08, endScale: 0.26, opacity: 0.32 });
      }
    } else if (ea.t < 1.35) {
      // Companion blows "fuu-fuu" then takes happy bite "mogu-mogu!"
      if (!ea.playedEat) {
        ea.playedEat = true;
        this.audio.playHappyEat();
        this.companion.setMood('eating', 2.4);
        this.particles.spawnBokehBurst(ea.mouthPos.clone().add(new THREE.Vector3(0, 0.12, -0.05)), 14);
      }
      const chompU = Math.min(1, (ea.t - 0.72) / 0.48);
      s.group.scale.setScalar(Math.max(0.01, 1 - chompU));
      s.group.position.lerp(this.companion.getMouthWorldPosition(), Math.min(1, dt * 8));
      this.hand.hide(2.2);
    } else {
      s.state = 'eaten';
      s.group.visible = false;
      this.eatenCount++;
      this.eatAnim = null;

      // After first joyful bite, present the fresh wooden egg basket on the left so child can cook again anytime!
      this.kitchen.replayBasket.visible = true;
      this.companion.setMood('excited', 2.2);
    }
  }

  _updateWobbles(dt) {
    for (let i = this.wobbles.length - 1; i >= 0; i--) {
      const w = this.wobbles[i];
      w.t += dt;
      const decay = Math.exp(-w.t * 8.5);
      w.obj.rotation.z = w.baseRotZ + Math.sin(w.t * 28) * w.amp * decay;
      if (w.t > 0.65) {
        w.obj.rotation.z = w.baseRotZ;
        this.wobbles.splice(i, 1);
      }
    }
  }

  _updateIdleHint(dt) {
    if (!this.hintAnim) return;
    const h = this.hintAnim;
    h.t += dt;
    const u = h.t / h.dur;
    if (u >= 1) {
      this.hintAnim = null;
      this.hand.hide(this.camDesiredTarget.x);
      return;
    }

    if (h.type === 'circle') {
      const ang = u * Math.PI * 2;
      const p = h.center.clone().add(new THREE.Vector3(Math.cos(ang) * 0.18, 0, Math.sin(ang) * 0.18));
      this.hand.setTarget(p, new THREE.Euler(0.32, -0.1, 0), h.pose, true);
    } else {
      const ease = u * u * (3 - 2 * u);
      const p = h.from.clone().lerp(h.to, ease);
      p.y += Math.sin(u * Math.PI) * 0.08;
      this.hand.setTarget(p, new THREE.Euler(0.28, -0.12, 0), h.pose, true);
    }
  }

  // Visual test helper to inspect every stage accurately in screenshots
  _debugJumpStage(stageName) {
    this._resetState();
    if (stageName === 'crack') {
      this._updateCameraGoals(true);
      return;
    }
    // Prepare cracked & whisked egg state
    this.crackedCount = 3;
    this.yolkCount = 3;
    this.hasNegi = true;
    this.hasDashi = true;
    this.kitchen.eggs.forEach((e) => {
      e.state = 'done';
      e.group.visible = false;
    });
    this.kitchen.bowlLiquidMesh.visible = true;
    this.kitchen.bowlLiquidMesh.position.y = 0.135;

    if (stageName === 'whisk') {
      this.mixProgress = 0.45;
      this.swirlAngle = 2.6;
      this.kitchen.bowlYolks[0].visible = true;
      this.kitchen.bowlYolks[0].position.set(0.06, 0.135, -0.04);
      this.kitchen.bowlLiquidCtrl.render({
        mixProgress: 0.45,
        swirlAngle: 2.6,
        froth: 0.4,
        hasNegi: true,
        hasDashi: true,
      });
      this._enterStage('whisk');
      this._updateCameraGoals(true);
      return;
    }

    this.mixProgress = 1.0;
    this.froth = 0.65;
    this.kitchen.bowlLiquidCtrl.render({
      mixProgress: 1.0,
      swirlAngle: 6.2,
      froth: 0.65,
      hasNegi: true,
      hasDashi: true,
    });

    if (stageName === 'pan_roll') {
      this.layerIndex = 1;
      this.pourFill = 1.0;
      this.cookProgress = 1.0;
      this.rollProgress = 0.52;
      this.heatLevel = 2;
      this.searAccum = 0.72;
      this._updateStoveKnobVisual();
      this.tamagoyaki.refreshTextures(this._getTamagoyakiConfig());
      this._enterStage('pan_roll');
      this.kitchen.bowlGroup.position.copy(this.kitchen.bowlPourPos);
      this._updateCameraGoals(true);
      this.companion.root.position.x = 0.0;
      this.companion.setMood('sniffing', 6);
      // Pre-seed visible rising kitchen steam plumes for rich atmosphere!
      for (let i = 0; i < 14; i++) {
        this.particles.spawnSteam(new THREE.Vector3((Math.random() - 0.5) * 0.52, 0.24 + i * 0.055, 0.24), {
          startScale: 0.22,
          endScale: 0.66,
          opacity: 0.62,
          life: 2.8,
          riseSpeed: 0.22,
        });
      }
      return;
    }

    if (stageName === 'slice') {
      this.layerIndex = 2;
      this.searAccum = 0.72;
      this._enterStage('slice');
      this.cutsDone = 2;
      this.tamagoyaki.applyCutReveal(2, this.kitchen.boardCenter, this._getTamagoyakiConfig().puffiness);
      this._updateCameraGoals(true);
      this.companion.root.position.x = 1.52;
      this.companion.setMood('excited', 6);
      for (let i = 0; i < 6; i++) {
        this.particles.spawnSteam(this.kitchen.boardCenter.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.18 + i * 0.05, 0)), {
          startScale: 0.14,
          endScale: 0.44,
          opacity: 0.34,
          life: 2.0,
        });
      }
      return;
    }

    if (stageName === 'bento') {
      this.layerIndex = 2;
      this.searAccum = 0.72;
      this.hasNori = false;
      this._enterStage('slice');
      this.cutsDone = 4;
      this.tamagoyaki.applyCutReveal(4, this.kitchen.boardCenter, this._getTamagoyakiConfig().puffiness);
      this._enterStage('bento');
      this._packSliceIntoBento(this.tamagoyaki.slices[0]);
      this._packSliceIntoBento(this.tamagoyaki.slices[1]);
      this._packSliceIntoBento(this.tamagoyaki.slices[2]);
      // Snap positions immediately for instant clean framing in static capture
      for (const s of this.tamagoyaki.slices) {
        s.group.position.copy(s.targetPos);
        s.group.rotation.copy(s.targetRot);
        if (s.state === 'bento') s.ketchup.visible = true;
      }
      this._applyFlagPicks();
      this._updateCameraGoals(true);
      this.companion.root.position.x = 2.22;
      this.companion.setMood('excited', 6);
      for (let i = 0; i < 6; i++) {
        this.particles.spawnSteam(this.kitchen.bentoGroup.position.clone().add(new THREE.Vector3(0.25, 0.24 + i * 0.06, 0.14)), {
          startScale: 0.16,
          endScale: 0.48,
          opacity: 0.44,
          life: 2.2,
        });
      }
    }
  }
}
