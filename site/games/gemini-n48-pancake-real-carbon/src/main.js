import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { KitchenAudio } from './audio.js';
import { createMorningKitchenEnvMap } from './textures.js';
import { MorningKitchen } from './kitchen.js';
import { MomAndChild } from './mom.js';
import { PancakeItem, BatterStream } from './pancake.js';
import { StackToppingsSystem } from './toppings.js';

class MorningPancakeGame {
  constructor() {
    this.container = document.getElementById('app');
    this.audio = new KitchenAudio();

    this._initRendererAndScene();
    this._initWorld();
    this._initGameState();
    this._bindInput();
    this._onResize();

    window.addEventListener('resize', () => this._onResize());

    this.lastTime = performance.now();
    this.elapsed = 0;

    // Expose lightweight debug hook for automated visual/perf inspection
    window.__PANCAKE_GAME__ = this;

    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initRendererAndScene() {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbda992);

    const envMap = createMorningKitchenEnvMap(this.renderer);
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0.52;

    // Over-the-shoulder portrait-friendly 50mm camera
    this.camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.06,
      8.0
    );
    this.camPosGoal = new THREE.Vector3(0.055, 0.435, 0.64);
    this.camLookGoal = new THREE.Vector3(0.035, 0.175, -0.045);
    this.camPosCur = this.camPosGoal.clone();
    this.camLookCur = this.camLookGoal.clone();
    this.camera.position.copy(this.camPosCur);
    this.camera.lookAt(this.camLookCur);

    // Post-processing: MSAA HalfFloat render target + subtle sunlit morning bloom + ACES OutputPass
    const rtWidth = Math.max(2, Math.floor(window.innerWidth * this.pixelRatio));
    const rtHeight = Math.max(2, Math.floor(window.innerHeight * this.pixelRatio));
    const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
      type: THREE.HalfFloatType,
      samples: 4,
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.min(512, rtWidth), Math.min(512, rtHeight)),
      0.12,
      0.45,
      1.08
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  _initWorld() {
    this.kitchen = new MorningKitchen(this.scene);
    this.mom = new MomAndChild(this.scene, this.kitchen.sunDir);
    this.batterStream = new BatterStream(this.scene);
    this.toppings = new StackToppingsSystem(this.kitchen.plateGroup);

    // Edible bite chunk attached to fork tines when eating together!
    this.forkBiteGroup = new THREE.Group();
    this.forkBiteGroup.visible = false;
    const chunkMat = new THREE.MeshPhysicalMaterial({
      color: 0xc46b22,
      roughness: 0.62,
      sheen: 0.25,
      sheenColor: 0xffe8c2,
    });
    const spongeSideMat = new THREE.MeshStandardMaterial({
      color: 0xf7e3ab,
      roughness: 0.78,
    });
    const topCrust = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.006, 16), chunkMat);
    topCrust.position.y = 0.009;
    const spongeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.012, 16), spongeSideMat);
    spongeCore.position.y = 0.003;
    const syrupGlaze = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 8),
      this.toppings.syrupMat
    );
    syrupGlaze.scale.set(1.2, 0.35, 1.2);
    syrupGlaze.position.y = 0.0125;
    this.forkBiteGroup.add(spongeCore, topCrust, syrupGlaze);
    this.forkBiteGroup.position.set(0, 0.008, -0.066);
    this.kitchen.forkGroup.add(this.forkBiteGroup);
  }

  _initGameState() {
    // Active pancake in skillet + stacked pancakes on ceramic plate
    this.panPancake = null;
    this.stackedPancakes = [];
    this.batterRemaining = 1.0;

    // Flight animations (flip toss in pan OR stacking arc to plate)
    this.flipAnim = null;  // { time, duration, startY, peakHeight, startRotZ, endRotZ, strength }
    this.stackAnim = null; // { pancake, time, duration, startPos, endPos, startRotZ }

    // Pouring & utensil interaction states
    this.isPouringBatter = false;
    this.minPourTimer = 0;
    this.pourTargetOffset = new THREE.Vector2(0, 0);

    this.isPouringSyrup = false;
    this.minSyrupTimer = 0;
    this.syrupAimLocal = new THREE.Vector2(0, 0);

    this.holdingFork = false;
    this.forkHasBite = false;
    this.forkWorldGoal = this.kitchen.forkRestPos.clone();
    this.forkEatAnim = null; // { target: 'mom' | 'child', time, duration, startPos }
    this.bitesTaken = 0;

    // Micro-wobble springs for non-stage touchable props ("他は小さく揺れる")
    this.wobbles = {
      pitcher: 0,
      butter: 0,
      syrup: 0,
      berries: 0,
      fork: 0,
      plate: 0,
      curtain: 0,
    };

    // Idle gentle 1-time Mom hand demonstration ("0-6秒は何もしない、10秒以降に放置時のみ手で1回実演")
    this.idleSeconds = 0;
    this.demoShownForStage = false;
    this.demoAnim = null; // { type, time, duration }

    // Smooth Mom hand poses
    this.rHandCur = new THREE.Vector3(-0.27, 0.095, 0.16);
    this.lHandCur = new THREE.Vector3(0.13, 0.09, -0.13);
    this.rRotCur = new THREE.Quaternion();
    this.lRotCur = new THREE.Quaternion();

    // Pointer tracking (single-finger friendly, multi-touch safe)
    this.activePointerId = null;
    this.pointerDownPos = new THREE.Vector2();
    this.pointerCurPos = new THREE.Vector2();
    this.pointerPrevPos = new THREE.Vector2();
    this.pointerVel = new THREE.Vector2();
    this.dragMode = null; // 'pour_batter' | 'pan_cook' | 'butter_slide' | 'pour_syrup' | 'fork_drag' | null
    this.raycaster = new THREE.Raycaster();
    this.counterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.032);
  }

  _currentStage() {
    if (this.flipAnim || this.stackAnim) return 'ANIMATING';
    if (this.panPancake) {
      if (this.isPouringBatter || this.minPourTimer > 0) return 'POURING';
      if (this.panPancake.flipCount === 0) {
        return this.panPancake.brownNegY >= 0.28 || this.panPancake.poppedCount >= 3
          ? 'READY_FLIP'
          : 'COOK_SIDE1';
      }
      return this.panPancake.brownPosY >= 0.22 ? 'READY_STACK' : 'COOK_SIDE2';
    }
    // Skillet is empty:
    // Encourage stacking at least 2 pancakes ("重ねてバターとシロップ") before focusing camera on toppings!
    if (this.stackedPancakes.length < 2 && !this.toppings.hasButter && this.toppings.totalSyrupPoured < 0.02) {
      return 'INVITE_POUR';
    }
    if (!this.toppings.hasButter) return 'INVITE_BUTTER';
    if (this.toppings.totalSyrupPoured < 0.25) return 'INVITE_SYRUP';
    return 'READY_EAT';
  }

  _resetIdle() {
    this.idleSeconds = 0;
    this.demoAnim = null;
  }

  _markStageChanged() {
    this.idleSeconds = 0;
    this.demoShownForStage = false;
    this.demoAnim = null;
  }

  _onResize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;

    this.camera.aspect = aspect;
    // Keep both skillet (-0.28) and plate/cruet (+0.38) comfortably framed on iPhone portrait & iPad landscape!
    if (aspect < 1.0) {
      // Portrait phone: widen vertical FOV smoothly so horizontal FOV stays generous
      this.camera.fov = THREE.MathUtils.clamp(42 / Math.pow(aspect, 0.58), 44, 68);
    } else {
      this.camera.fov = THREE.MathUtils.clamp(41 - (aspect - 1.33) * 4.0, 36, 43);
    }
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  _screenToNDC(clientX, clientY) {
    return new THREE.Vector2(
      (clientX / Math.max(1, window.innerWidth)) * 2 - 1,
      -(clientY / Math.max(1, window.innerHeight)) * 2 + 1
    );
  }

  _raycastPlaneY(ndc, yHeight = 0.035) {
    this.raycaster.setFromCamera(ndc, this.camera);
    this.counterPlane.constant = -yHeight;
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.counterPlane, hit);
  }

  _worldDist2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  _bindInput() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.unlock();
      if (this.activePointerId !== null) return; // Ignore extra fingers so multi-touch never breaks state!

      this.activePointerId = e.pointerId;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {}

      this.pointerDownPos.set(e.clientX, e.clientY);
      this.pointerCurPos.set(e.clientX, e.clientY);
      this.pointerPrevPos.set(e.clientX, e.clientY);
      this.pointerVel.set(0, 0);
      this._resetIdle();

      this._handlePointerDown(e.clientX, e.clientY);
    });

    dom.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      const dx = e.clientX - this.pointerCurPos.x;
      const dy = e.clientY - this.pointerCurPos.y;
      this.pointerPrevPos.copy(this.pointerCurPos);
      this.pointerCurPos.set(e.clientX, e.clientY);
      this.pointerVel.set(dx, dy);
      this._resetIdle();

      this._handlePointerMove(e.clientX, e.clientY, dx, dy);
    });

    const endPointer = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this._handlePointerUp(e.clientX, e.clientY);
    };

    dom.addEventListener('pointerup', endPointer);
    dom.addEventListener('pointercancel', endPointer);
  }

  _handlePointerDown(clientX, clientY) {
    if (this.flipAnim || this.stackAnim || this.forkEatAnim) return;

    const ndc = this._screenToNDC(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.camera);

    const hitCounter = this._raycastPlaneY(ndc, 0.045) || new THREE.Vector3();
    const panPos = this.kitchen.skilletGroup.position;
    const handlePos = this.kitchen.getSkilletHandleWorldPos();
    const platePos = this.kitchen.platePos;
    const pitcherPos = this.kitchen.pitcherRestPos;
    const butterPos = this.kitchen.butterDishRestPos;
    const syrupPos = this.kitchen.syrupCruetRestPos;
    const berryPos = this.kitchen.berryBowlGroup.position;
    const forkPos = this.kitchen.forkGroup.position;

    // 1. Check touch on Mom's face (affectionate reaction!)
    const momHits = this.raycaster.intersectObject(this.mom.headMesh, false);
    if (momHits.length > 0) {
      if (this.forkHasBite) {
        this._triggerEatBite('mom');
        return;
      }
      this.mom.triggerHappyReaction(0.8);
      this.audio.playHappyWarmChord();
      return;
    }

    // 2. Check touch on sunlit window curtain (playful breeze + dust motes!)
    const curtainHits = this.raycaster.intersectObject(this.kitchen.curtainMesh, false);
    if (curtainHits.length > 0) {
      this.wobbles.curtain = 1.0;
      this.kitchen.swirlDustNear(new THREE.Vector3(-0.35, 0.35, -0.1), 1.4);
      return;
    }

    const distPan = this._worldDist2D(hitCounter, panPos);
    const distHandle = this._worldDist2D(hitCounter, handlePos);
    const distPitcher = this._worldDist2D(hitCounter, pitcherPos);
    const distPlate = this._worldDist2D(hitCounter, platePos);
    const distButter = this._worldDist2D(hitCounter, butterPos);
    const distSyrup = this._worldDist2D(hitCounter, syrupPos);
    const distBerry = this._worldDist2D(hitCounter, berryPos);
    const distFork = this._worldDist2D(hitCounter, forkPos);

    // Swirl sunlit dust lightly wherever finger enters the beam!
    this.kitchen.swirlDustNear(hitCounter, 0.45);

    const hasStack = this.stackedPancakes.length > 0;
    const canFinishToppings = hasStack && (this.toppings.hasButter || this.toppings.totalSyrupPoured > 0.08);

    // --- Fork interaction (when stack has butter/syrup, fork scoops & feeds!) ---
    if (distFork < 0.075) {
      if (canFinishToppings) {
        this._scoopForkBite();
        this.dragMode = 'fork_drag';
        return;
      } else {
        this.wobbles.fork = 1.0;
        this.audio.playPanSlide(0.25);
        return;
      }
    }

    // --- Strawberry Bowl discovery (glossy berries plop onto stack!) ---
    if (distBerry < 0.072) {
      if (hasStack && !this.panPancake && this.toppings.placedBerries.length < 5) {
        const berry = this.kitchen.createStrawberryMesh();
        const lx = (Math.random() - 0.5) * 0.065;
        const lz = (Math.random() - 0.5) * 0.065;
        this.toppings.addStrawberry(berry, lx, lz);
        this.wobbles.berries = 1.0;
        this.audio.playStackBounce(3);
        this.mom.triggerHappyReaction(0.95);
        return;
      } else {
        this.wobbles.berries = 1.0;
        this.audio.playBubblePop(0.8, false);
        return;
      }
    }

    // --- Butter Dish interaction ---
    if (distButter < 0.078) {
      if (hasStack && !this.panPancake) {
        this._placeOrRefreshButter(0, 0);
        this.dragMode = 'butter_slide';
        return;
      } else {
        this.wobbles.butter = 1.0;
        this.audio.playButterPat();
        return;
      }
    }

    // --- Maple Syrup Cruet interaction ---
    if (distSyrup < 0.080) {
      if (hasStack && !this.panPancake) {
        this.isPouringSyrup = true;
        this.minSyrupTimer = 0.55;
        this.syrupAimLocal.set(0, 0);
        this.dragMode = 'pour_syrup';
        this.audio.playSyrupDrop();
        this.mom.triggerHappyReaction(0.75);
        this._markStageChanged();
        return;
      } else {
        this.wobbles.syrup = 1.0;
        this.audio.playSyrupDrop();
        return;
      }
    }

    // --- Ceramic Plate / Pancake Stack interaction ---
    if (distPlate < 0.13) {
      // If a flipped pancake in the skillet is ready to stack, tapping the plate stacks it!
      if (this.panPancake && this.panPancake.flipCount >= 1 && this.panPancake.brownPosY >= 0.12) {
        this._launchStackToPlate();
        return;
      }
      if (hasStack && !this.panPancake) {
        const localHit = hitCounter.clone().sub(platePos);
        // If no butter yet and >= 2 pancakes (or direct tap in butter stage), drop butter right where touched!
        if (!this.toppings.hasButter && this.stackedPancakes.length >= 2) {
          this._placeOrRefreshButter(localHit.x, localHit.z);
          this.dragMode = 'butter_slide';
          return;
        }
        // If butter is already melting and little syrup poured yet, pressing & holding on stack pours syrup right onto finger!
        if (this.toppings.hasButter && this.toppings.totalSyrupPoured < 0.18) {
          this.isPouringSyrup = true;
          this.minSyrupTimer = 0.55;
          this.syrupAimLocal.set(localHit.x, localHit.z);
          this.dragMode = 'pour_syrup';
          this.audio.playSyrupDrop();
          this._markStageChanged();
          return;
        }
        // If butter is present, dragging near butter slides it; tapping squishes stack & squeezes syrup drips!
        if (
          this.toppings.hasButter &&
          Math.hypot(localHit.x - this.toppings.butterX, localHit.z - this.toppings.butterZ) < 0.048
        ) {
          this.dragMode = 'butter_slide';
          return;
        }
        // Elastic stack squish + syrup drip squeeze ("積んで弾む / ちょっかいで更に溢れる")!
        this.stackedPancakes.forEach((p, idx) => {
          p.squashVel += 2.2 + idx * 0.5;
        });
        this.toppings.triggerSqueezeDrip();
        this.audio.playStackBounce(this.stackedPancakes.length);
        // If already topped & fork ready, tapping stack can also scoop a bite!
        if (this.toppings.totalSyrupPoured >= 0.25 && !this.forkHasBite) {
          this._scoopForkBite();
          this.dragMode = 'fork_drag';
        }
        return;
      }
      this.wobbles.plate = 1.0;
      return;
    }

    // --- Pitcher OR Skillet interaction ---
    const onSkilletOrHandle = distPan < 0.145 || distHandle < 0.095;
    const onPitcher = distPitcher < 0.095;

    if (onPitcher || onSkilletOrHandle) {
      // Case A: Skillet is empty (or still tiny raw puddle) -> Pour creamy batter!
      if (!this.panPancake && this.stackedPancakes.length < 4 && this.batterRemaining > 0.05) {
        this._startPouringBatter();
        this.dragMode = 'pour_batter';
        return;
      }
      if (this.panPancake && this.panPancake.flipCount === 0 && this.panPancake.setAmount < 0.22 && onPitcher) {
        // Allow topping up more batter before it sets!
        this.isPouringBatter = true;
        this.minPourTimer = 0.35;
        this.dragMode = 'pour_batter';
        return;
      }

      // Case B: Pancake is cooking in the skillet!
      if (this.panPancake) {
        // Poke swelling bubbles directly on raw top!
        if (this.panPancake.flipCount === 0) {
          const localPan = hitCounter.clone().sub(panPos);
          const popped = this.panPancake.popBubblesNearLocal(localPan.x, localPan.z, 0.036, (sz) => {
            this.audio.playBubblePop(sz, true);
          });
          if (popped > 0) {
            this.panPancake.squashVel += 0.9;
            if (popped >= 2) this.mom.triggerHappyReaction(0.5);
          }
        }
        // Tapping handle directly when ready to flip triggers a crisp flip!
        if (
          distHandle < 0.075 &&
          this.panPancake.flipCount === 0 &&
          (this.panPancake.brownNegY >= 0.28 || this.panPancake.poppedCount >= 3)
        ) {
          this._launchFlip(0.75);
          return;
        }
        this.dragMode = 'pan_cook';
        return;
      }

      this.wobbles.pitcher = 1.0;
    }
  }

  _handlePointerMove(clientX, clientY, dx, dy) {
    if (this.flipAnim || this.stackAnim || this.forkEatAnim) return;

    const ndc = this._screenToNDC(clientX, clientY);
    const hitCounter = this._raycastPlaneY(ndc, 0.05) || new THREE.Vector3();

    if (this.dragMode === 'pour_batter') {
      const panPos = this.kitchen.panBasePos;
      this.pourTargetOffset.set(
        THREE.MathUtils.clamp(hitCounter.x - panPos.x, -0.024, 0.024),
        THREE.MathUtils.clamp(hitCounter.z - panPos.z, -0.024, 0.024)
      );
      return;
    }

    if (this.dragMode === 'pan_cook' && this.panPancake) {
      // Slide skillet physically with finger!
      const moveScale = 0.00042;
      this.kitchen.panVel.x += dx * moveScale * 18;
      this.kitchen.panVel.z += dy * moveScale * 18;
      this.kitchen.panTilt.z = THREE.MathUtils.clamp(-dx * 0.004, -0.18, 0.18);
      this.kitchen.panTilt.x = THREE.MathUtils.clamp(dy * 0.004, -0.18, 0.18);

      // Jiggle elastic pancake in pan & pop bubbles under finger!
      this.panPancake.shearVelX -= dx * 0.0032;
      this.panPancake.shearVelZ -= dy * 0.0032;

      if (Math.hypot(dx, dy) > 8 && Math.random() < 0.28) {
        this.audio.playPanSlide(Math.min(1, Math.hypot(dx, dy) / 28));
      }

      if (this.panPancake.flipCount === 0) {
        const localPan = hitCounter.clone().sub(this.kitchen.skilletGroup.position);
        this.panPancake.popBubblesNearLocal(localPan.x, localPan.z, 0.032, (sz) => {
          this.audio.playBubblePop(sz, true);
        });
      }

      // Check for big upward flick OR vigorous pan shake to FLIP!
      const totalDy = clientY - this.pointerDownPos.y;
      const totalDx = clientX - this.pointerDownPos.x;

      // Swipe right toward ceramic plate after flipping -> stack onto plate!
      if (
        this.panPancake.flipCount >= 1 &&
        this.panPancake.brownPosY >= 0.10 &&
        (totalDx > 58 || (dx > 15 && hitCounter.x > 0.04))
      ) {
        this.dragMode = null;
        this._launchStackToPlate();
        return;
      }

      // Upward flick (dy < -13 or totalDy < -48) flips the pancake in mid-air!
      if (dy < -14 || totalDy < -52) {
        const canFlip =
          this.panPancake.flipCount >= 1 ||
          this.panPancake.brownNegY >= 0.20 ||
          this.panPancake.poppedCount >= 2;
        if (canFlip) {
          const strength = THREE.MathUtils.clamp(Math.abs(dy) / 26 + Math.abs(totalDy) / 140, 0.55, 1.35);
          this.dragMode = null;
          this._launchFlip(strength);
          return;
        } else {
          // Still very raw liquid -> playful wet slosh & extra bubble!
          this.panPancake.squashVel += 1.6;
          this.panPancake.spawnBubble();
        }
      }
      return;
    }

    if (this.dragMode === 'butter_slide') {
      const localPlate = hitCounter.clone().sub(this.kitchen.platePos);
      this.toppings.slideButterTo(localPlate.x, localPlate.z, 0.03);
      return;
    }

    if (this.dragMode === 'pour_syrup') {
      const hitTop = this._raycastPlaneY(ndc, this.kitchen.platePos.y + this.toppings.stackTopY) || hitCounter;
      const localPlate = hitTop.clone().sub(this.kitchen.platePos);
      const maxAim = this.toppings.stackRadius * 0.85;
      const r = Math.hypot(localPlate.x, localPlate.z);
      if (r > maxAim) {
        localPlate.multiplyScalar(maxAim / r);
      }
      this.syrupAimLocal.set(localPlate.x, localPlate.z);
      return;
    }

    if (this.dragMode === 'fork_drag' && this.forkHasBite) {
      const hitHigh = this._raycastPlaneY(ndc, 0.18) || hitCounter;
      this.forkWorldGoal.set(
        THREE.MathUtils.clamp(hitHigh.x, -0.18, 0.36),
        THREE.MathUtils.clamp(0.14 + (0.5 - clientY / Math.max(1, window.innerHeight)) * 0.28, 0.08, 0.36),
        THREE.MathUtils.clamp(hitHigh.z, -0.18, 0.38)
      );

      // Open Mom's mouth in anticipation ("あーん！") as fork nears Mom!
      if (clientY < window.innerHeight * 0.45) {
        this.mom.targetMouthOpen = 0.78;
        this.mom.targetSmile = 0.85;
      }
      if (clientY < window.innerHeight * 0.34) {
        this.dragMode = null;
        this._triggerEatBite('mom');
      } else if (clientY > window.innerHeight * 0.80) {
        this.dragMode = null;
        this._triggerEatBite('child');
      }
    }
  }

  _handlePointerUp(clientX, clientY) {
    if (this.isPouringBatter) {
      this.isPouringBatter = false;
      if (this.minPourTimer <= 0) {
        this._markStageChanged();
      }
    }
    if (this.isPouringSyrup) {
      this.isPouringSyrup = false;
    }
    if (this.dragMode === 'fork_drag' && this.forkHasBite && !this.forkEatAnim) {
      // Quick tap on fork/stack delivers a joyful bite automatically to child or Mom alternately!
      const moved = Math.hypot(clientX - this.pointerDownPos.x, clientY - this.pointerDownPos.y);
      if (moved < 24) {
        this._triggerEatBite(this.bitesTaken % 2 === 0 ? 'mom' : 'child');
      }
    }
    this.dragMode = null;
  }

  _startPouringBatter() {
    if (!this.panPancake) {
      this.panPancake = new PancakeItem(this.stackedPancakes.length);
      this.panPancake.group.position.set(0, 0.005, 0);
      this.kitchen.skilletGroup.add(this.panPancake.group);
    }
    this.isPouringBatter = true;
    this.minPourTimer = 0.52; // Guarantees even a quick tap pours a real cute mini pancake!
    this.pourTargetOffset.set(0, 0);
    this.kitchen.flameIntensity = 1.0;
    this.mom.triggerHappyReaction(0.55);
    this._markStageChanged();
  }

  _launchFlip(strength = 1.0) {
    if (!this.panPancake || this.flipAnim) return;

    this.audio.playFlipToss(strength);
    this.kitchen.panVel.y += 0.42 * strength;
    this.kitchen.panTilt.x = -0.26 * strength;
    this.kitchen.swirlDustNear(this.kitchen.panBasePos.clone().add(new THREE.Vector3(0, 0.18, 0)), 1.3 * strength);

    if (strength > 0.95) {
      this.mom.triggerSurprise(strength);
    } else {
      this.mom.triggerHappyReaction(0.75);
    }

    const curRotZ = this.panPancake.group.rotation.z;
    this.flipAnim = {
      time: 0,
      duration: 0.56 + strength * 0.14,
      startY: this.panPancake.group.position.y,
      peakHeight: 0.15 + strength * 0.12,
      startRotZ: curRotZ,
      endRotZ: curRotZ + Math.PI,
      strength,
    };
    this._markStageChanged();
  }

  _launchStackToPlate() {
    if (!this.panPancake || this.stackAnim) return;

    const p = this.panPancake;
    this.panPancake = null;

    // Convert pancake from skillet local space to plate local space seamlessly
    const startWorld = new THREE.Vector3();
    p.group.getWorldPosition(startWorld);
    this.kitchen.plateGroup.add(p.group);
    const startLocal = startWorld.clone();
    this.kitchen.plateGroup.worldToLocal(startLocal);
    p.group.position.copy(startLocal);

    // Compute exact target stack height on plate
    let stackY = 0.008 + p.thickness * 0.46;
    for (const prev of this.stackedPancakes) {
      stackY += prev.thickness * 0.88;
    }
    const jitterX = (Math.random() - 0.5) * 0.007;
    const jitterZ = (Math.random() - 0.5) * 0.007;

    this.kitchen.panTilt.z = -0.46;
    this.kitchen.panVel.x += 0.25;
    this.audio.playFlipToss(0.75);

    this.stackAnim = {
      pancake: p,
      time: 0,
      duration: 0.48,
      startPos: startLocal.clone(),
      endPos: new THREE.Vector3(jitterX, stackY, jitterZ),
    };
    this._markStageChanged();
  }

  _placeOrRefreshButter(lx = 0, lz = 0) {
    this.toppings.configureStack(this.stackedPancakes);
    this.toppings.dropButter(lx, lz);
    this.kitchen.readyButterPat.visible = false;
    this.audio.playButterPat();
    this.mom.triggerHappyReaction(0.85);
    this.stackedPancakes.forEach((p) => {
      p.squashVel += 1.4;
    });
    this._markStageChanged();
  }

  _scoopForkBite() {
    if (this.forkHasBite) return;
    this.forkHasBite = true;
    this.forkBiteGroup.visible = true;
    this.audio.playStackBounce(2);

    const progress = Math.min(0.82, (this.bitesTaken + 1) * 0.28);
    this.stackedPancakes.forEach((p) => {
      p.biteProgress = progress;
      p.squashVel += 1.5;
    });
    this.forkWorldGoal.set(this.kitchen.platePos.x + 0.02, 0.16, this.kitchen.platePos.z + 0.06);
    this.mom.triggerHappyReaction(0.9);
  }

  _triggerEatBite(target = 'mom') {
    if (!this.forkHasBite || this.forkEatAnim) return;
    this.forkEatAnim = {
      target,
      time: 0,
      duration: 0.78,
      startPos: this.kitchen.forkGroup.position.clone(),
    };
    if (target === 'mom') {
      this.mom.targetMouthOpen = 0.88;
      this.mom.targetSmile = 0.92;
    }
    this._markStageChanged();
  }

  _resetTableForNextRound() {
    this.stackedPancakes.forEach((p) => {
      this.kitchen.plateGroup.remove(p.group);
    });
    this.stackedPancakes.length = 0;
    this.toppings.reset();
    this.kitchen.readyButterPat.visible = true;
    this.kitchen.panStarterButter.visible = true;
    this.kitchen.panButterMelt = 0.35;
    this.kitchen.flameIntensity = 1.0;
    this.batterRemaining = 1.0;
    this.bitesTaken = 0;
    this.forkHasBite = false;
    this.forkBiteGroup.visible = false;
    this.forkWorldGoal.copy(this.kitchen.forkRestPos);
    this.kitchen.swirlDustNear(new THREE.Vector3(0.05, 0.22, 0.05), 1.5);
    this._markStageChanged();
  }

  _updateIdleDemo(dt) {
    const stage = this._currentStage();
    if (stage === 'ANIMATING' || stage === 'POURING' || this.isPouringSyrup || this.holdingFork) {
      this.idleSeconds = 0;
      return;
    }

    this.idleSeconds += dt;
    // Wait quietly for 9.5 seconds before a single gentle 1-time Mom hand demonstration!
    if (this.idleSeconds > 9.5 && !this.demoShownForStage && !this.demoAnim) {
      this.demoShownForStage = true;
      this.demoAnim = { type: stage, time: 0, duration: 1.5 };
    }

    if (this.demoAnim) {
      this.demoAnim.time += dt;
      const t = this.demoAnim.time / this.demoAnim.duration;
      if (t >= 1) {
        this.demoAnim = null;
      } else {
        const wave = Math.sin(t * Math.PI);
        if (this.demoAnim.type === 'READY_FLIP') {
          this.kitchen.panOffset.y = wave * 0.016;
          this.kitchen.panTilt.x = -wave * 0.12;
        } else if (this.demoAnim.type === 'READY_STACK') {
          this.kitchen.panTilt.z = -wave * 0.22;
        }
      }
    }
  }

  _updateAnimationsAndCooking(dt, elapsed) {
    // 1. Batter pouring logic
    const pouringNow = (this.isPouringBatter || this.minPourTimer > 0) && this.panPancake;
    if (this.minPourTimer > 0) {
      this.minPourTimer = Math.max(0, this.minPourTimer - dt);
    }

    if (pouringNow) {
      // Smoothly lift & tilt stoneware pitcher above skillet
      const goalPos = new THREE.Vector3(
        this.kitchen.panBasePos.x + 0.115 + this.pourTargetOffset.x * 0.5,
        0.165,
        this.kitchen.panBasePos.z + this.pourTargetOffset.y * 0.5
      );
      this.kitchen.pitcherGroup.position.lerp(goalPos, Math.min(1, dt * 10));
      this.kitchen.pitcherGroup.rotation.z = THREE.MathUtils.lerp(
        this.kitchen.pitcherGroup.rotation.z,
        0.92,
        Math.min(1, dt * 9)
      );

      // Grow pancake radius & thickness causally with pour duration!
      this.panPancake.targetRadius = Math.min(
        this.panPancake.maxRadius,
        this.panPancake.targetRadius + dt * 0.036
      );
      this.panPancake.targetThickness = 0.0055 + (this.panPancake.targetRadius / 0.094) * 0.0035;
      this.batterRemaining = Math.max(0.08, this.batterRemaining - dt * 0.09);

      if (this.panPancake.targetRadius >= this.panPancake.maxRadius) {
        this.isPouringBatter = false;
        this.minPourTimer = 0;
      }
    } else {
      // Return pitcher smoothly to counter (with optional gentle demo lift if idle in INVITE_POUR!)
      let demoLift = 0;
      let demoTilt = 0;
      if (this.demoAnim && this.demoAnim.type === 'INVITE_POUR') {
        const w = Math.sin((this.demoAnim.time / this.demoAnim.duration) * Math.PI);
        demoLift = w * 0.045;
        demoTilt = w * 0.28;
      }
      const restGoal = this.kitchen.pitcherRestPos.clone();
      restGoal.y += demoLift;
      restGoal.x -= demoLift * 0.5;
      this.kitchen.pitcherGroup.position.lerp(restGoal, Math.min(1, dt * 8));
      this.kitchen.pitcherGroup.rotation.z = THREE.MathUtils.lerp(
        this.kitchen.pitcherGroup.rotation.z,
        demoTilt + Math.sin(elapsed * 22) * this.wobbles.pitcher * 0.12,
        Math.min(1, dt * 9)
      );
    }

    const spoutWorld = this.kitchen.getPitcherSpoutWorldPos();
    const panHitWorld = this.kitchen.skilletGroup.position.clone().add(
      new THREE.Vector3(this.pourTargetOffset.x, 0.008, this.pourTargetOffset.y)
    );
    this.batterStream.update(dt, elapsed, Boolean(pouringNow), spoutWorld, panHitWorld);

    // 2. Mid-air Flip Toss animation
    if (this.flipAnim && this.panPancake) {
      this.flipAnim.time += dt;
      const u = Math.min(1, this.flipAnim.time / this.flipAnim.duration);
      const arc = 4 * u * (1 - u);
      this.panPancake.group.position.y = this.flipAnim.startY + arc * this.flipAnim.peakHeight;
      // Smooth ease-in-out 180-degree flip
      const rotEase = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      this.panPancake.group.rotation.z = THREE.MathUtils.lerp(
        this.flipAnim.startRotZ,
        this.flipAnim.endRotZ,
        rotEase
      );
      this.panPancake.airBend = Math.sin(u * Math.PI * 2) * 0.014 * this.flipAnim.strength;

      if (u >= 1) {
        this.panPancake.flipCount++;
        this.panPancake.group.position.y = 0.008;
        this.panPancake.squash = 0.28;
        this.panPancake.squashVel = -1.2;
        this.kitchen.panVel.y -= 0.18;
        this.audio.playSizzleBurst(this.flipAnim.strength);
        for (let k = 0; k < 5; k++) {
          this.kitchen.spawnSteam(this.kitchen.skilletGroup.position, 1.35);
        }
        this.mom.triggerHappyReaction(1.0);
        this.flipAnim = null;
        this._markStageChanged();
      }
    }

    // 3. Stacking arc from skillet onto ceramic plate
    if (this.stackAnim) {
      this.stackAnim.time += dt;
      const u = Math.min(1, this.stackAnim.time / this.stackAnim.duration);
      const p = this.stackAnim.pancake;
      p.group.position.lerpVectors(this.stackAnim.startPos, this.stackAnim.endPos, u);
      p.group.position.y += Math.sin(u * Math.PI) * 0.12;
      p.airBend = Math.sin(u * Math.PI) * 0.010;

      if (u >= 1) {
        p.group.position.copy(this.stackAnim.endPos);
        p.airBend = 0;
        p.squash = 0.25;
        this.stackedPancakes.push(p);
        this.stackedPancakes.forEach((sp, idx) => {
          sp.squashVel += 1.6 + idx * 0.35;
        });
        this.toppings.configureStack(this.stackedPancakes);
        this.audio.playStackBounce(this.stackedPancakes.length);
        this.mom.triggerHappyReaction(0.95);
        if (this.stackedPancakes.length >= 2) {
          this.audio.playHappyWarmChord();
          this.kitchen.flameIntensity = 0.35;
        }
        this.stackAnim = null;
        this._markStageChanged();
      }
    }

    // 4. Update active skillet pancake cooking (snappy child-friendly pacing, zero boredom!)
    if (this.panPancake) {
      const cookingDT = !pouringNow && !this.flipAnim ? dt * 1.65 : dt;
      this.panPancake.update(cookingDT, elapsed, {
        isCookingInPan: !this.flipAnim,
        isPouring: Boolean(pouringNow),
        onBubblePop: (sz) => this.audio.playBubblePop(sz, false),
      });
      if (!this.flipAnim) {
        this.panPancake.group.position.y = this.panPancake.thickness * 0.48 + 0.0015;
      }
    }

    // 5. Update stacked pancakes & toppings (butter melt + Beer-Lambert maple syrup!)
    for (const sp of this.stackedPancakes) {
      sp.update(dt, elapsed, { isCookingInPan: false, isPouring: false });
    }
    this.toppings.configureStack(this.stackedPancakes);

    if (this.minSyrupTimer > 0) {
      this.minSyrupTimer = Math.max(0, this.minSyrupTimer - dt);
    }
    const syrupActive = (this.isPouringSyrup || this.minSyrupTimer > 0) && this.stackedPancakes.length > 0;
    if (syrupActive) {
      const cruetGoal = new THREE.Vector3(
        this.kitchen.platePos.x + this.syrupAimLocal.x + 0.072,
        this.kitchen.platePos.y + this.toppings.stackTopY + 0.125,
        this.kitchen.platePos.z + this.syrupAimLocal.y
      );
      this.kitchen.syrupCruetGroup.position.lerp(cruetGoal, Math.min(1, dt * 10));
      this.kitchen.syrupCruetGroup.rotation.z = THREE.MathUtils.lerp(
        this.kitchen.syrupCruetGroup.rotation.z,
        1.02,
        Math.min(1, dt * 10)
      );
      this.toppings.pourSyrupAt(this.syrupAimLocal.x, this.syrupAimLocal.y, dt);
    } else {
      let demoTilt = 0;
      if (this.demoAnim && this.demoAnim.type === 'INVITE_SYRUP') {
        demoTilt = Math.sin((this.demoAnim.time / this.demoAnim.duration) * Math.PI) * 0.25;
      }
      this.kitchen.syrupCruetGroup.position.lerp(this.kitchen.syrupCruetRestPos, Math.min(1, dt * 8));
      this.kitchen.syrupCruetGroup.rotation.z = THREE.MathUtils.lerp(
        this.kitchen.syrupCruetGroup.rotation.z,
        demoTilt + Math.sin(elapsed * 24) * this.wobbles.syrup * 0.14,
        Math.min(1, dt * 9)
      );
    }

    const syrupSpoutWorld = this.kitchen.getSyrupSpoutWorldPos();
    this.toppings.updatePouringStream(
      dt,
      elapsed,
      syrupActive,
      syrupSpoutWorld,
      this.syrupAimLocal.x,
      this.syrupAimLocal.y
    );
    this.toppings.update(dt, elapsed);

    // 6. Fork & Eating animation ("ママと一緒にあーん！")
    if (this.forkEatAnim) {
      this.forkEatAnim.time += dt;
      const u = Math.min(1, this.forkEatAnim.time / this.forkEatAnim.duration);
      const goal =
        this.forkEatAnim.target === 'mom'
          ? new THREE.Vector3(-0.045, 0.315, -0.085)
          : new THREE.Vector3(this.camera.position.x, this.camera.position.y - 0.08, this.camera.position.z - 0.18);
      this.kitchen.forkGroup.position.lerpVectors(this.forkEatAnim.startPos, goal, Math.pow(u, 0.75));
      this.kitchen.forkGroup.rotation.x = THREE.MathUtils.lerp(0, -0.35, u);

      if (u >= 1) {
        this.audio.playBite();
        this.audio.playHappyWarmChord();
        this.mom.triggerHappyReaction(1.0);
        this.forkHasBite = false;
        this.forkBiteGroup.visible = false;
        this.forkEatAnim = null;
        this.bitesTaken++;
        this.forkWorldGoal.copy(this.kitchen.forkRestPos);

        if (this.bitesTaken >= 3) {
          this._resetTableForNextRound();
        }
      }
    } else if (this.forkHasBite) {
      this.kitchen.forkGroup.position.lerp(this.forkWorldGoal, Math.min(1, dt * 12));
      this.kitchen.forkGroup.rotation.x = THREE.MathUtils.lerp(this.kitchen.forkGroup.rotation.x, -0.18, dt * 8);
    } else {
      this.kitchen.forkGroup.position.lerp(this.kitchen.forkRestPos, Math.min(1, dt * 8));
      this.kitchen.forkGroup.rotation.x = THREE.MathUtils.lerp(this.kitchen.forkGroup.rotation.x, 0, dt * 8);
      this.kitchen.forkGroup.rotation.z = Math.sin(elapsed * 26) * this.wobbles.fork * 0.12;
    }

    // Decay non-stage prop micro-wobbles
    for (const k of Object.keys(this.wobbles)) {
      this.wobbles[k] = Math.max(0, this.wobbles[k] - dt * 3.2);
    }
    this.kitchen.butterDishGroup.rotation.z = Math.sin(elapsed * 24) * this.wobbles.butter * 0.12;
    this.kitchen.berryBowlGroup.rotation.z = Math.sin(elapsed * 24) * this.wobbles.berries * 0.12;
    this.kitchen.plateGroup.rotation.z = Math.sin(elapsed * 24) * this.wobbles.plate * 0.05;
  }

  _updateMomHandsAndCamera(dt, elapsed) {
    const stage = this._currentStage();
    const pouringBatter = (this.isPouringBatter || this.minPourTimer > 0) && this.panPancake;
    const pouringSyrup = (this.isPouringSyrup || this.minSyrupTimer > 0) && this.stackedPancakes.length > 0;

    // --- Mom's Right Hand (-X side): grips the walnut skillet handle during cooking, or rests warmly ---
    const handleWorld = this.kitchen.getSkilletHandleWorldPos();
    const rGoal = new THREE.Vector3();
    const rEuler = new THREE.Euler();

    if (
      this.panPancake ||
      stage === 'INVITE_POUR' ||
      this.stackAnim
    ) {
      // Wrap right hand naturally over top of angled walnut skillet grip!
      rGoal.set(handleWorld.x + 0.018, handleWorld.y + 0.014, handleWorld.z - 0.042);
      rEuler.set(0.18 + this.kitchen.panTilt.x, 0.72, -0.22 + this.kitchen.panTilt.z);
      this.mom.rightGrip = 0.86;
    } else {
      // Keep right hand resting gently on the skillet walnut handle (never poking inside hot pan!)
      rGoal.set(handleWorld.x + 0.018, handleWorld.y + 0.014, handleWorld.z - 0.042);
      rEuler.set(0.16, 0.72, -0.18);
      this.mom.rightGrip = 0.72;
    }

    // --- Mom's Left Hand (+X side): palm faces INWARD (-X) via negative Z roll, thumb UP, fingers curled around handle! ---
    const lGoal = new THREE.Vector3();
    const lEuler = new THREE.Euler();

    if (pouringBatter || stage === 'INVITE_POUR') {
      const pHandle = this.kitchen.getPitcherHandleWorldPos();
      const tilt = this.kitchen.pitcherGroup.rotation.z;
      lGoal.set(pHandle.x + 0.014, pHandle.y - 0.005, pHandle.z - 0.038);
      lEuler.set(0.08, 0.42, -1.42 + tilt * 0.55);
      this.mom.leftGrip = 0.88;
    } else if (pouringSyrup) {
      const sHandle = this.kitchen.getSyrupHandleWorldPos();
      const tilt = this.kitchen.syrupCruetGroup.rotation.z;
      lGoal.set(sHandle.x + 0.016, sHandle.y + 0.006, sHandle.z - 0.038);
      lEuler.set(0.10, 0.48, -1.35 + tilt * 0.45);
      this.mom.leftGrip = 0.90;
    } else if (this.demoAnim && this.demoAnim.type === 'INVITE_BUTTER') {
      const w = Math.sin((this.demoAnim.time / this.demoAnim.duration) * Math.PI);
      lGoal.set(0.20, 0.045 + w * 0.035, -0.18);
      lEuler.set(0.22, -0.22, -0.15);
      this.mom.leftGrip = 0.45;
    } else if (this.forkHasBite || this.forkEatAnim) {
      // Delighted hand softly near cheek while eating together!
      lGoal.set(0.065, 0.175, -0.185);
      lEuler.set(-0.55, 0.35, -0.75);
      this.mom.leftGrip = 0.38;
    } else {
      // Rest left hand cleanly on oak counter beside butter dish
      lGoal.set(0.165, 0.024, -0.215);
      lEuler.set(0.12, -0.18, -0.10);
      this.mom.leftGrip = 0.32;
    }

    this.rHandCur.lerp(rGoal, Math.min(1, dt * 12));
    this.lHandCur.lerp(lGoal, Math.min(1, dt * 10));
    this.mom.rightHandTarget.copy(this.rHandCur);
    this.mom.leftHandTarget.copy(this.lHandCur);

    const qR = new THREE.Quaternion().setFromEuler(rEuler);
    const qL = new THREE.Quaternion().setFromEuler(lEuler);
    this.rRotCur.slerp(qR, Math.min(1, dt * 12));
    this.lRotCur.slerp(qL, Math.min(1, dt * 10));
    this.mom.rightHandRot.setFromQuaternion(this.rRotCur);
    this.mom.leftHandRot.setFromQuaternion(this.lRotCur);

    // --- Mom's Warm Eye & Head Gaze Target ---
    if (this.flipAnim && this.panPancake) {
      const airPos = new THREE.Vector3();
      this.panPancake.group.getWorldPosition(airPos);
      this.mom.lookTarget.copy(airPos);
    } else if (this.panPancake) {
      // Alternates gently between watching the bubbling pancake and smiling up at child!
      if (Math.sin(elapsed * 0.65) > 0.55) {
        this.mom.lookTarget.set(this.camera.position.x * 0.6, this.camera.position.y - 0.06, this.camera.position.z * 0.65);
      } else {
        this.mom.lookTarget.copy(this.kitchen.skilletGroup.position);
      }
    } else if (this.forkHasBite) {
      this.mom.lookTarget.copy(this.kitchen.forkGroup.position);
    } else if (this.stackedPancakes.length >= 2) {
      if (Math.sin(elapsed * 0.7) > 0.35) {
        this.mom.lookTarget.set(this.camera.position.x * 0.6, this.camera.position.y - 0.05, this.camera.position.z * 0.65);
      } else {
        this.mom.lookTarget.copy(this.kitchen.platePos).add(new THREE.Vector3(0, 0.05, 0));
      }
    } else {
      // Opening look: warm inviting eye contact with child + glance at skillet/pitcher!
      if (Math.sin(elapsed * 0.8) > -0.15) {
        this.mom.lookTarget.set(this.camera.position.x * 0.55, this.camera.position.y - 0.06, this.camera.position.z * 0.62);
      } else {
        this.mom.lookTarget.copy(this.kitchen.panBasePos);
      }
    }

    // --- Subtle Responsive Camera Framing (Cooking wide OTS <-> Topping close-up OTS) ---
    const focusToppings =
      !this.panPancake &&
      !this.stackAnim &&
      (this.stackedPancakes.length >= 2 || this.toppings.hasButter || this.toppings.totalSyrupPoured > 0.02);

    const portraitPullback = this.camera.aspect < 1.0 ? (1.0 - this.camera.aspect) * 0.34 : 0;
    if (focusToppings) {
      this.camPosGoal.set(0.105, 0.415 + portraitPullback * 0.22, 0.595 + portraitPullback);
      this.camLookGoal.set(0.075, 0.195, -0.055);
    } else {
      this.camPosGoal.set(0.055, 0.445 + portraitPullback * 0.22, 0.655 + portraitPullback);
      this.camLookGoal.set(0.035, 0.205, -0.055);
    }

    // Gentle living handheld breathing sway
    const swayX = Math.sin(elapsed * 0.9) * 0.0025;
    const swayY = Math.cos(elapsed * 1.1) * 0.0020;

    this.camPosCur.lerp(this.camPosGoal, Math.min(1, dt * 3.2));
    this.camLookCur.lerp(this.camLookGoal, Math.min(1, dt * 3.8));
    this.camera.position.set(this.camPosCur.x + swayX, this.camPosCur.y + swayY, this.camPosCur.z);
    this.camera.lookAt(this.camLookCur);
  }

  _animate(now) {
    requestAnimationFrame(this._animate);

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.elapsed += dt;

    this._updateIdleDemo(dt);
    this._updateAnimationsAndCooking(dt, this.elapsed);
    this._updateMomHandsAndCamera(dt, this.elapsed);

    // Steam rises from hot skillet while cooking OR from hot stacked pancakes on plate!
    let steamPos = null;
    let steamRate = 0.08;
    if (this.panPancake && !this.flipAnim) {
      steamPos = this.kitchen.skilletGroup.position;
      steamRate = 0.25 + this.panPancake.brownNegY * 0.65 + (this.panPancake.flipCount > 0 ? 0.35 : 0);
    } else if (this.stackedPancakes.length > 0) {
      steamPos = this.kitchen.platePos.clone().add(new THREE.Vector3(0, this.toppings.stackTopY, 0));
      steamRate = 0.42;
    }

    this.kitchen.update(dt, this.elapsed, this.camera, {
      steamSourcePos: steamPos,
      steamRate,
      batterRemaining: this.batterRemaining,
    });
    this.mom.update(dt, this.elapsed, this.camera);

    // Continuous tactile audio synthesis levels
    const pouringBatter = (this.isPouringBatter || this.minPourTimer > 0) && this.panPancake;
    const pouringSyrup = (this.isPouringSyrup || this.minSyrupTimer > 0) && this.stackedPancakes.length > 0;
    const sizzleLevel = this.panPancake && !this.flipAnim ? 0.35 + this.panPancake.setAmount * 0.65 : 0.08;
    this.audio.update(dt, {
      sizzleLevel,
      pourLevel: pouringBatter ? 1.0 : 0.0,
      syrupLevel: pouringSyrup ? 1.0 : 0.0,
    });

    this.composer.render();
  }
}

new MorningPancakeGame();
