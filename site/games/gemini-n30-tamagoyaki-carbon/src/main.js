// Main Entry: Photorealistic 3D Tamagoyaki Cooking Game (Zero Text, One-Finger Embodied Play)
// Strict Performance Budget: pixelRatio <= 1.5, Triangles << 300k, All Textures <= 1024px, >= 30fps on iPhone/iPad

import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { SoundEngine } from './audio.js';
import { KitchenStage } from './kitchen.js';
import { CookingHands, KitchenGirl } from './actors.js';
import { SteamSystem } from './tamagoyaki.js';

class TamagoyakiGame {
  constructor() {
    this.container = document.getElementById('app');
    this.sound = new SoundEngine();

    this._initRendererAndScene();
    this._initLighting();

    this.kitchen = new KitchenStage(this.scene);
    this.girl = new KitchenGirl(this.scene);
    // Calibrate girl position so her whole head, kerchief, expressive eyes, smile & apron frame cleanly with headroom!
    this.girl.root.position.set(0.0, -0.26, -1.42);
    this.girl.root.scale.setScalar(0.96);

    this.hands = new CookingHands(this.scene);
    this.steam = new SteamSystem(this.scene, 56);

    // Game Phases:
    // 'PREP' (crack 1..3 eggs + whisk + optional mix-ins)
    // 'POURING' (hands lift bowl & pour into copper pan)
    // 'PAN_COOK' (sizzle, steam, bubbles + drag/swipe/tap to roll Pass 1 -> Pass 2)
    // 'FLIP_TO_BOARD' (plump golden log lands on hinoki cutting board)
    // 'SLICING' (swipe/tap with chef knife to slice custom spiral pieces)
    // 'PACKING' (drag/tap slices & strawberries into bento OR up to girl's mouth "A-nn!")
    // 'CELEBRATE' (radiant celebration, souvenir saved on tray, fresh eggs roll in!)
    this.phase = 'PREP';

    this.round = {
      eggCount: 0,
      mixProgress: 0,
      swirlAngle: 0,
      swirlEnergy: 0,
      mixIns: { cheese: false, negi: false, honey: false },
      pourTimer: 0,
      passIndex: 0, // 0 = first layer, 1 = second layer
      rollMilestone: 0,
      slicesCutCount: 0,
      fedGirlCount: 0,
    };

    // Active animations & pointer state (single primary pointer so multi-touch never breaks!)
    this.activePointerId = null;
    this.pointerNDC = new THREE.Vector2();
    this.prevPointerNDC = new THREE.Vector2();
    this.downNDC = new THREE.Vector2();
    this.isPointerDown = false;
    this.dragDist = 0;

    this.raycaster = new THREE.Raycaster();
    this.workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
    this.facePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.72);

    // Sub-animations
    this.eggCrackAnim = null;
    this.knifeChopAnim = null;
    this.grabbedItem = null; // { type: 'slice' | 'berry', ref, worldPos }
    this.flyingItemAnim = null;
    this.celebrateTimer = 0;

    // Idle gentle 3D hand demonstration (ONLY after 10s of complete inactivity, 1 time per phase, per preference!)
    this.idleSeconds = 0;
    this.idleDemoShownForPhase = null;
    this.idleDemoTimer = 0;

    // Responsive Camera Framing Targets
    this.camLookCurrent = new THREE.Vector3(-0.02, 0.36, 0.08);
    this.camLookTarget = new THREE.Vector3(-0.02, 0.36, 0.08);
    this.camPosBase = new THREE.Vector3(0.0, 2.08, 2.42);

    this.steamEmitAccum = 0;
    this.clock = new THREE.Clock();

    this._bindEvents();
    this._onResize();

    // Expose clean read-only inspection hook for automated visual/perf verification
    window.__TAMAGO_DEBUG__ = {
      game: this,
      getStats: () => ({
        phase: this.phase,
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
        pixelRatio: this.renderer.getPixelRatio(),
        eggCount: this.round.eggCount,
        mixProgress: Number(this.round.mixProgress.toFixed(2)),
        passIndex: this.round.passIndex,
        rollProgress: Number(this.kitchen.panTamago.state.rollProgress.toFixed(2)),
        searLevel: Number(this.kitchen.panTamago.state.searLevel.toFixed(2)),
        sliceCount: this.kitchen.boardSlices.slices.length,
        bentoPacked: this.kitchen.bentoPackedCount,
      }),
    };

    this.renderer.setAnimationLoop(() => this._tick());
  }

  _initRendererAndScene() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    // Strict pixel ratio cap <= 1.5 per hardware budget
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcab7a0);
    this.scene.fog = new THREE.Fog(0xcab7a0, 6.0, 12.5);

    // Realistic studio/kitchen IBL reflections (makes copper, glass, egg yolk & lacquer look genuinely photographic!)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.56;
    roomEnv.dispose();
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 25);
  }

  _initLighting() {
    // Warm sunlit morning kitchen ambiance with photographic shadow depth
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0x7d5c42, 0.68);
    this.scene.add(hemi);

    // Morning window key light from upper-left-front (1024x1024 shadow map <= 1024px budget!)
    this.sunLight = new THREE.DirectionalLight(0xfff0d4, 1.72);
    this.sunLight.position.set(-2.4, 4.2, 2.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 0.8;
    this.sunLight.shadow.camera.far = 10.5;
    const d = 2.65;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);

    // Soft warm backlight so rising steam clouds & hair catch a luminous rim!
    const rimLight = new THREE.DirectionalLight(0xffe6be, 0.85);
    rimLight.position.set(1.6, 2.8, -2.2);
    this.scene.add(rimLight);

    // Subtle warm stove glow under the copper pan
    this.stoveGlow = new THREE.PointLight(0xff8c3a, 0.45, 2.2, 2.0);
    this.stoveGlow.position.set(0.76, 0.25, -0.05);
    this.scene.add(this.stoveGlow);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.sound.unlock();
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      this.activePointerId = e.pointerId;
      this.isPointerDown = true;
      this._updateNDC(e, this.pointerNDC);
      this.prevPointerNDC.copy(this.pointerNDC);
      this.downNDC.copy(this.pointerNDC);
      this.dragDist = 0;
      this.idleSeconds = 0;
      this.idleDemoTimer = 0;

      this._onPointerDown();
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown || e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      this.prevPointerNDC.copy(this.pointerNDC);
      this._updateNDC(e, this.pointerNDC);
      const step = this.pointerNDC.distanceTo(this.prevPointerNDC);
      this.dragDist += step;
      this.idleSeconds = 0;

      this._onPointerMove(step);
    }, { passive: false });

    const endPointer = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this._onPointerUp();
      this.isPointerDown = false;
      this.activePointerId = null;
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  }

  _updateNDC(e, out) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    out.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    out.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.camera.aspect = aspect;

    // Responsive FOV & camera distance so BOTH iPhone portrait (aspect ~0.46..0.6) AND iPad landscape (aspect ~1.33+)
    // show the entire active cooking scene + big hands + expressive girl without clipping!
    if (aspect < 0.85) {
      // Portrait (iPhone): widen vertical FOV so horizontal span fits eggs + bowl + pan + bento cleanly!
      this.camera.fov = Math.min(64, 43 / Math.max(0.56, aspect * 0.92));
    } else {
      this.camera.fov = 41;
    }
    this.camera.updateProjectionMatrix();
  }

  _raycastHits() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const dynamicTargets = [
      ...this.kitchen.interactables,
      this.girl.headGroup,
      ...this.kitchen.boardSlices.slices.map((s) => s.mesh),
    ];
    return this.raycaster.intersectObjects(dynamicTargets, true);
  }

  _projectOntoY(yHeight = 0.28) {
    this.workPlane.constant = -yHeight;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const out = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.workPlane, out);
    return out;
  }

  // ---------------- INPUT HANDLERS BY PHASE ----------------

  _onPointerDown() {
    const hits = this._raycastHits();
    const topHit = hits.length > 0 ? hits[0].object : null;
    const kind = topHit ? topHit.userData.kind : null;

    // Universal playful world interactions (nothing is a dead decoration!)
    if (kind === 'flameKnob') {
      this._cycleStoveFlame();
      return;
    }
    if (kind === 'oilBrush') {
      this._brushOilOnPan();
      return;
    }
    if (kind === 'mixIn' && (this.phase === 'PREP' || this.phase === 'PAN_COOK')) {
      this._triggerMixIn(topHit.userData.mixKey);
      return;
    }

    if (this.phase === 'PREP') {
      if (kind === 'egg') {
        const egg = this.kitchen.eggs[topHit.userData.eggIndex];
        if (egg && !egg.used && !this.eggCrackAnim) {
          this._handleEggTap(egg);
          return;
        }
      }
      if (kind === 'bowl') {
        if (this.round.eggCount === 0) {
          // Tapping empty bowl gently wobbles nearest egg & clinks glass, or if dragging from egg it cracks!
          const nextEgg = this.kitchen.eggs.find((e) => !e.used);
          if (nextEgg) {
            nextEgg.wobble = 1.0;
            this.sound.playEggTap(1);
          }
          return;
        }
        if (this.round.mixProgress >= 0.96) {
          this._beginPouringIntoPan();
          return;
        }
        // Stirring pulse even on simple tap!
        this._advanceWhisk(0.14);
        return;
      }
      if (kind === 'pan' && this.round.eggCount > 0 && this.round.mixProgress >= 0.68) {
        // Forgiving: tapping the pan once reasonably mixed immediately pours!
        this.round.mixProgress = 1.0;
        this._beginPouringIntoPan();
        return;
      }
    } else if (this.phase === 'PAN_COOK') {
      const st = this.kitchen.panTamago.state;
      if (st.pourProgress >= 0.85 && st.setProgress >= 0.48) {
        // Forgiving: tapping also nudges the roll forward slightly, while dragging rolls smoothly!
        this._advancePanRoll(0.14);
        return;
      } else {
        this.kitchen.panTamago.triggerJiggle(0.5);
        return;
      }
    } else if (this.phase === 'SLICING') {
      const worldPt = this._projectOntoY(0.28);
      if (worldPt) {
        const localPt = this.kitchen.boardTopAnchor.worldToLocal(worldPt.clone());
        if (Math.abs(localPt.x) < 0.95 && Math.abs(localPt.z) < 0.68) {
          this._triggerKnifeSliceAt(localPt.x);
          return;
        }
      }
    } else if (this.phase === 'PACKING') {
      // Check if touching a tamagoyaki slice or strawberry to grab with chopsticks!
      const sliceHit = hits.find((h) => h.object.userData.kind === 'tamagoSlice');
      if (sliceHit) {
        const seg = sliceHit.object.userData.sliceRef;
        if (seg && !seg.packed && !seg.eaten && !this.flyingItemAnim) {
          this._grabItem('slice', seg);
          return;
        }
      }
      const berryHit = hits.find((h) => h.object.userData.kind === 'strawberry');
      if (berryHit) {
        const berry = berryHit.object.userData.berryRef;
        if (berry && !berry.packed && !berry.eaten && !this.flyingItemAnim) {
          this._grabItem('berry', berry);
          return;
        }
      }
      // Forgiving: tapping the open bento directly auto-picks the next warm slice onto chopsticks & packs it!
      if (kind === 'bento' && !this.flyingItemAnim) {
        const nextSlice = this.kitchen.boardSlices.getAvailableSlices()[0];
        if (nextSlice) {
          this._flyItemToBento('slice', nextSlice);
          return;
        }
      }
    }

    // Subtle secondary reactions on non-active props (per preference: "他は小さく揺れる")
    if (kind === 'girlFace') {
      this.girl.setMood('excited', 1.1);
      this.sound.playVoiceCurious();
    } else if (kind === 'propWobble' && topHit.userData.wobbleItem) {
      this.kitchen.pokeProp(topHit.userData.wobbleItem, 1.0);
      this.sound.playPropTap(topHit.userData.wobbleItem.kind);
    } else if (kind === 'pan') {
      this.sound.playPropTap('metal');
    } else if (kind === 'bento') {
      this.kitchen.pokeProp(this.kitchen.wobbleProps[0], 0.8);
      this.sound.playPropTap('wood');
    } else if (kind === 'board') {
      this.sound.playPropTap('wood');
    }
  }

  _onPointerMove(stepNDC) {
    if (this.phase === 'PREP') {
      // If dragging an uncracked egg toward the bowl, crack it automatically on arrival!
      if (this.round.eggCount === 0 || this.dragDist > 0.04) {
        const worldPt = this._projectOntoY(0.28);
        if (worldPt) {
          const distToBowl = worldPt.distanceTo(this.kitchen.bowlGroup.position);
          if (distToBowl < 0.65 && this.round.eggCount > 0 && !this.eggCrackAnim) {
            // Stirring inside/around the glass bowl!
            this.kitchen.restingChopsticks.visible = false;
            this.hands.setTool('chopsticks');

            const dx = this.pointerNDC.x - this.prevPointerNDC.x;
            const dy = this.pointerNDC.y - this.prevPointerNDC.y;
            const speed = Math.min(2.5, Math.hypot(dx, dy) * 32);
            if (speed > 0.04) {
              this.round.swirlAngle += (dx + dy * 0.5 >= 0 ? 1 : 1) * stepNDC * 11.5;
              this._advanceWhisk(stepNDC * 1.15);
              this.sound.playWhiskStroke(speed);
            }
          } else if (this.round.eggCount >= 1 && this.round.mixProgress >= 0.75) {
            // Dragging bowl toward pan pours it!
            const distToPan = worldPt.distanceTo(this.kitchen.stoveGroup.position);
            if (distToPan < 0.85) {
              this.round.mixProgress = 1.0;
              this._beginPouringIntoPan();
            }
          }
        }
      }
    } else if (this.phase === 'PAN_COOK') {
      const st = this.kitchen.panTamago.state;
      if (st.pourProgress >= 0.85 && st.setProgress >= 0.42) {
        const dx = this.pointerNDC.x - this.prevPointerNDC.x;
        const dy = this.pointerNDC.y - this.prevPointerNDC.y;
        // Natural left->right drag OR circular swirl both smoothly roll the tamagoyaki!
        const forwardProgress = Math.max(0, dx * 1.15) + Math.abs(dy) * 0.28;
        if (forwardProgress > 0.002) {
          this._advancePanRoll(forwardProgress * 0.88);
        }
      }
    } else if (this.phase === 'SLICING') {
      // Swiping downward across the tamagoyaki log slices cleanly right where the finger crosses!
      const dy = this.pointerNDC.y - this.prevPointerNDC.y;
      if (dy < -0.025 && !this.knifeChopAnim) {
        const worldPt = this._projectOntoY(0.28);
        if (worldPt) {
          const localPt = this.kitchen.boardTopAnchor.worldToLocal(worldPt.clone());
          if (Math.abs(localPt.x) < 0.9 && Math.abs(localPt.z) < 0.7) {
            this._triggerKnifeSliceAt(localPt.x);
          }
        }
      }
    } else if (this.phase === 'PACKING' && this.grabbedItem) {
      this._updateGrabbedItemPosition();
    }
  }

  _onPointerUp() {
    if (this.phase === 'PREP' && !this.eggCrackAnim) {
      // Check if user dragged from an egg and released over the bowl!
      const hits = this._raycastHits();
      if (this.dragDist > 0.08 && hits.some((h) => h.object.userData.kind === 'bowl')) {
        const nextEgg = this.kitchen.eggs.find((e) => !e.used && e.crackedCount > 0);
        if (nextEgg) {
          this._startEggCrackOpenAnim(nextEgg);
        }
      }
    }

    if (this.phase === 'PACKING' && this.grabbedItem) {
      const item = this.grabbedItem;
      this.grabbedItem = null;

      // Was it dragged simply as a quick tap (< 0.06 NDC)? Auto-pack into bento!
      if (this.dragDist < 0.06) {
        this._flyItemToBento(item.type, item.ref);
        return;
      }

      // Did the child hold it up near the girl's open mouth ("A-nn!")?
      const mouthWorld = new THREE.Vector3();
      this.girl.mouthGroup.getWorldPosition(mouthWorld);
      if (item.worldPos.y > 0.58 && item.worldPos.distanceTo(mouthWorld) < 0.68) {
        this._feedItemToGirl(item.type, item.ref);
        return;
      }

      // Is it near/over the bento box (forgiving magnet radius!)?
      const bentoWorld = new THREE.Vector3();
      this.kitchen.bentoPackedAnchor.getWorldPosition(bentoWorld);
      if (item.worldPos.distanceTo(bentoWorld) < 0.92 || this.pointerNDC.x > 0.02) {
        this._flyItemToBento(item.type, item.ref);
        return;
      }

      // Otherwise set it gently back onto its board/saucer spot!
      this._returnItemHome(item.type, item.ref);
    }
  }

  // ---------------- GAMEPLAY ACTIONS & CAUSALITY ----------------

  _handleEggTap(egg) {
    egg.crackedCount += 1;
    if (egg.crackedCount === 1) {
      // First "Kon!" against the bowl rim: hands lift egg to rim, tap & show hairline crack!
      egg.painter.drawCrack(1);
      egg.wobble = 1.2;
      // Move egg right next to the glass bowl rim so 2nd tap is super obvious & tactile!
      const bowlLocal = this.kitchen.eggTrayGroup.worldToLocal(
        this.kitchen.bowlGroup.position.clone().add(new THREE.Vector3(-0.38, 0.36, 0.12))
      );
      egg.mesh.position.copy(bowlLocal);
      egg.mesh.rotation.z = -0.45;
      this.sound.playEggTap(1);
      this.girl.setMood('excited', 0.9);
      this.girl.setLookTarget(this.kitchen.bowlGroup.position);
    } else {
      // Second "Kon! Paka!!": crack shell halves wide open & drop glossy yolk into glass bowl!
      this._startEggCrackOpenAnim(egg);
    }
  }

  _startEggCrackOpenAnim(egg) {
    egg.used = true;
    egg.mesh.visible = false;
    this.sound.playEggTap(2);
    setTimeout(() => this.sound.playEggCrackOpen(), 95);

    const rigPos = this.kitchen.bowlGroup.position.clone().add(new THREE.Vector3(0, 0.62, 0));
    this.kitchen.crackRig.position.copy(rigPos);
    this.kitchen.crackRig.visible = true;
    this.kitchen.crackShellTop.position.set(-0.01, 0, 0);
    this.kitchen.crackShellBot.position.set(0.01, 0, 0);
    this.kitchen.crackShellTop.rotation.set(0, 0, Math.PI * 0.5);
    this.kitchen.crackShellBot.rotation.set(0, 0, Math.PI * 0.5);
    this.kitchen.fallingYolk.visible = true;
    this.kitchen.fallingYolk.position.set(0, -0.02, 0);

    this.hands.setTool('none');
    this.eggCrackAnim = {
      t: 0,
      dur: 0.62,
      dropped: false,
      rigPos,
    };
  }

  _advanceWhisk(delta) {
    this.kitchen.restingChopsticks.visible = false;
    this.hands.setTool('chopsticks');
    const prev = this.round.mixProgress;
    this.round.mixProgress = Math.min(1, this.round.mixProgress + delta);
    this.round.swirlEnergy = Math.min(1.2, this.round.swirlEnergy + 0.45);
    this.round.swirlAngle += delta * 9.5;

    this.kitchen.liquidPainter.render(
      this.round.mixProgress,
      this.round.swirlAngle,
      this.round.eggCount,
      this.round.mixIns
    );

    if (prev < 0.95 && this.round.mixProgress >= 0.95) {
      this.sound.playWhiskReady();
      this.girl.setMood('excited', 1.4);
      // Subtle oil sizzle & steam puff on the neighboring copper pan to invite pouring!
      this.steam.emit(
        this.kitchen.stoveGroup.position.x,
        0.32,
        this.kitchen.stoveGroup.position.z,
        { count: 4, spread: 0.45, speedY: 0.35, alpha: 0.28 }
      );
    }
  }

  _triggerMixIn(key) {
    const d = this.kitchen.mixInDishes[key];
    if (!d) return;
    d.bounce = 1.2;
    this.round.mixIns[key] = true;
    this.sound.playMixIn(key);
    this.girl.setMood('sparkle', 1.2);
    this.sound.playVoiceCurious();

    if (this.phase === 'PREP') {
      if (this.round.eggCount > 0) {
        this.kitchen.liquidPainter.render(
          this.round.mixProgress,
          this.round.swirlAngle,
          this.round.eggCount,
          this.round.mixIns
        );
      }
    } else if (this.phase === 'PAN_COOK') {
      this.kitchen.panTamago.state.mixIns[key] = true;
      this.kitchen.panTamago.painter.update({
        setProgress: this.kitchen.panTamago.state.setProgress,
        searLevel: this.kitchen.panTamago.state.searLevel,
        mixIns: this.kitchen.panTamago.state.mixIns,
        force: true,
      });
      this.kitchen.panTamago.triggerJiggle(0.6);
    }
  }

  _cycleStoveFlame() {
    const levels = [0.68, 1.0, 1.45];
    const cur = this.kitchen.heatLevel;
    const next = cur < 0.85 ? levels[1] : (cur < 1.2 ? levels[2] : levels[0]);
    this.kitchen.heatLevel = next;
    this.kitchen.flameKnob.rotation.y = (next - 1.0) * 1.4;
    this.stoveGlow.intensity = 0.3 + next * 0.35;
    this.sound.playPropTap('flame');
    if (this.phase === 'PAN_COOK') {
      this.sound.setPanSizzle(0.9, next);
    }
  }

  _brushOilOnPan() {
    this.sound.playOilBrush();
    this.kitchen.panSeasonTex.setOil(1.0);
    this.kitchen.panInnerMat.roughness = 0.10;
    this.kitchen.panInnerMat.clearcoat = 0.95;
    const p = this.kitchen.stoveGroup.position;
    this.steam.emit(p.x, 0.28, p.z, { count: 5, spread: 0.65, speedY: 0.42, alpha: 0.26 });
  }

  _beginPouringIntoPan() {
    if (this.phase !== 'PREP' || this.round.eggCount === 0) return;
    this.phase = 'POURING';
    this.round.pourTimer = 0;
    this.round.passIndex = 0;
    this.hands.setTool('none');
    this.kitchen.panTamago.resetForNewCook(this.round.eggCount, this.round.mixIns);
    this.kitchen.panTamago.startPass(0);
    this.sound.startPanSizzle(1.0);
    this.girl.setMood('excited', 1.8);
  }

  _startSecondPassPour() {
    this.phase = 'POURING';
    this.round.pourTimer = 0;
    this.round.passIndex = 1;
    this.round.rollMilestone = 0;
    this.hands.setTool('none');
    this.kitchen.panTamago.startPass(1);
    this.sound.startPanSizzle(0.95);
    this.girl.setMood('excited', 1.4);
  }

  _advancePanRoll(amount) {
    const st = this.kitchen.panTamago.state;
    const prev = st.rollProgress;
    st.rollProgress = Math.min(1.0, st.rollProgress + amount);
    this.hands.setTool('chopsticks');

    // Play tactile fold sound & puff steam from under the peeling seared sheet at each 1/3 fold!
    const milestone = Math.floor(st.rollProgress * 3.01);
    if (milestone > this.round.rollMilestone) {
      this.round.rollMilestone = milestone;
      this.sound.playRollFold(this.round.passIndex * 3 + milestone);
      this.kitchen.panTamago.triggerJiggle(0.85);
      const panWorld = new THREE.Vector3();
      this.kitchen.panPivot.getWorldPosition(panWorld);
      this.steam.emit(
        panWorld.x - 0.35 + st.rollProgress * 0.7,
        panWorld.y + 0.16,
        panWorld.z,
        { count: 5, spread: 0.35, speedY: 0.48, alpha: 0.36 }
      );
    }

    if (prev < 0.99 && st.rollProgress >= 0.99) {
      st.rollProgress = 1.0;
      if (this.round.passIndex === 0) {
        // Brief beat to admire Pass 1 roll, then smoothly pour Pass 2 to make it thick & layered!
        setTimeout(() => {
          if (this.phase === 'PAN_COOK') this._startSecondPassPour();
        }, 420);
      } else {
        // Finished Pass 2! Plump golden multi-layer tamagoyaki flips onto the hinoki cutting board!
        this._beginFlipToBoard();
      }
    }
  }

  _beginFlipToBoard() {
    this.phase = 'FLIP_TO_BOARD';
    this.sound.stopPanSizzle();
    this.flipAnim = { t: 0, dur: 0.78, landed: false };
    this.girl.setMood('excited', 1.8);
  }

  _triggerKnifeSliceAt(localX) {
    if (this.knifeChopAnim) return;
    const result = this.kitchen.boardSlices.sliceAtX(localX);
    if (!result) {
      // Already bite-sized! Transition smoothly to Bento Packing!
      this._enterPackingPhase();
      return;
    }

    this.round.slicesCutCount += 1;
    this.kitchen.restingKnife.visible = false;
    this.hands.setTool('knife');
    this.sound.playKnifeSlice(this.round.slicesCutCount);

    // Puff of warm fragrant inner steam right from the newly sliced spiral cross-section!
    this.steam.emit(
      result.cutWorldPos.x,
      result.cutWorldPos.y,
      result.cutWorldPos.z,
      { count: 6, spread: 0.18, speedY: 0.42, scale0: 0.14, scale1: 0.55, alpha: 0.38 }
    );

    this.knifeChopAnim = {
      t: 0,
      dur: 0.28,
      cutX: localX,
    };

    if (this.round.slicesCutCount === 1 || this.round.mixIns.cheese) {
      this.girl.setMood('excited', 1.2);
    }

    // Once sliced into 4+ plump pieces (or no wide chunk remains), smoothly invite Bento Packing!
    if (!result.canSliceMore || this.kitchen.boardSlices.slices.length >= 4) {
      setTimeout(() => {
        if (this.phase === 'SLICING') this._enterPackingPhase();
      }, 520);
    }
  }

  _enterPackingPhase() {
    this.phase = 'PACKING';
    this.hands.setTool('chopsticks');
    this.kitchen.restingKnife.visible = true;
    this.girl.setMood('excited', 1.5);
  }

  _grabItem(type, ref) {
    ref.grabbed = true;
    this.sound.playPickItem();
    this.hands.setTool('chopsticks');
    const obj3d = type === 'slice' ? ref.mesh : ref.group;
    const worldPos = new THREE.Vector3();
    obj3d.getWorldPosition(worldPos);
    this.scene.attach(obj3d);
    // Gentle chopstick pinch squish on golden egg!
    if (type === 'slice') {
      obj3d.scale.set(0.92, 1.06, 0.96);
    }
    this.grabbedItem = { type, ref, obj3d, worldPos };
    this._updateGrabbedItemPosition();
  }

  _updateGrabbedItemPosition() {
    if (!this.grabbedItem) return;
    // Lift higher as pointer moves toward upper half of screen so you can feed the girl ("A-nn!")!
    const liftFromPointerY = Math.max(0, (this.pointerNDC.y + 0.15) * 0.95);
    const targetY = 0.36 + liftFromPointerY;
    const pt = this._projectOntoY(targetY);
    if (pt) {
      pt.z = Math.max(-0.85, Math.min(1.15, pt.z - liftFromPointerY * 0.65));
      this.grabbedItem.worldPos.copy(pt);
      this.grabbedItem.obj3d.position.copy(pt);
      // Tilt slice slightly so spiral cross-section faces camera!
      if (this.grabbedItem.type === 'slice') {
        this.grabbedItem.obj3d.rotation.set(0.32, 0.45, 0.15);
      }

      // If held near the girl's face, she opens her mouth wide ("A-nn~!")!
      const mouthWorld = new THREE.Vector3();
      this.girl.mouthGroup.getWorldPosition(mouthWorld);
      if (pt.y > 0.56 && pt.distanceTo(mouthWorld) < 0.78) {
        if (this.girl.mood !== 'openMouth') {
          this.girl.setMood('openMouth', 0.5);
          this.sound.playVoiceOpenMouth();
        } else {
          this.girl.moodTimer = 0.5;
        }
        this.girl.setLookTarget(pt);
      }
    }
  }

  _flyItemToBento(type, ref) {
    ref.grabbed = false;
    const obj3d = type === 'slice' ? ref.mesh : ref.group;
    const startPos = new THREE.Vector3();
    obj3d.getWorldPosition(startPos);
    this.scene.attach(obj3d);

    const slotIdx = this.kitchen.bentoPackedCount;
    const localSlot = new THREE.Vector3();
    if (type === 'slice') {
      // Arrange slices overlapped cleanly in classic bento showcase row with spiral facing up!
      const rowOffset = -0.14 + (slotIdx % 4) * 0.125;
      localSlot.set((slotIdx % 2 === 0 ? -0.03 : 0.04), 0.11 + slotIdx * 0.012, rowOffset);
    } else {
      // Tuck ripe strawberry into cozy garnish nook!
      localSlot.set(-0.14 + (ref.index - 1) * 0.12, 0.115, -0.06);
    }

    const endPos = localSlot.clone();
    this.kitchen.bentoPackedAnchor.localToWorld(endPos);

    this.flyingItemAnim = {
      type,
      ref,
      obj3d,
      startPos,
      endPos,
      localSlot,
      targetMode: 'bento',
      t: 0,
      dur: 0.34,
    };
  }

  _feedItemToGirl(type, ref) {
    ref.grabbed = false;
    const obj3d = type === 'slice' ? ref.mesh : ref.group;
    const startPos = new THREE.Vector3();
    obj3d.getWorldPosition(startPos);
    this.scene.attach(obj3d);

    const endPos = new THREE.Vector3();
    this.girl.mouthGroup.getWorldPosition(endPos);
    endPos.z += 0.06;

    this.flyingItemAnim = {
      type,
      ref,
      obj3d,
      startPos,
      endPos,
      targetMode: 'mouth',
      t: 0,
      dur: 0.28,
    };
  }

  _returnItemHome(type, ref) {
    ref.grabbed = false;
    if (type === 'slice') {
      this.kitchen.boardTopAnchor.attach(ref.mesh);
      ref.mesh.position.set(ref.targetX, ref.baseY, 0);
      ref.mesh.rotation.set(0, 0, 0);
      ref.mesh.scale.setScalar(1);
      ref.jiggle = 0.8;
    } else {
      this.kitchen.berrySaucerGroup.attach(ref.group);
      ref.group.position.copy(ref.homePos);
      ref.group.rotation.set(0, 0, 0);
    }
  }

  _checkPackingCompletion() {
    const remainingSlices = this.kitchen.boardSlices.getAvailableSlices().length;
    if ((this.kitchen.bentoPackedCount >= 3 && remainingSlices === 0) ||
        (remainingSlices === 0 && (this.kitchen.bentoPackedCount > 0 || this.round.fedGirlCount > 0))) {
      this._triggerBentoCelebration();
    }
  }

  _triggerBentoCelebration() {
    this.phase = 'CELEBRATE';
    this.celebrateTimer = 0;
    this.hands.setTool('none');
    this.girl.setMood('celebrate', 3.8);
    this.sound.playVoiceCelebrate();

    // Save souvenir on the kitchen serving tray so play builds visible culinary history!
    this.kitchen.addCompletedMemory({
      searLevel: this.kitchen.panTamago.state.searLevel,
      eggCount: this.round.eggCount,
      mixIns: { ...this.round.mixIns },
    });
  }

  _startFreshRound() {
    this.kitchen.resetRoundForReplay();
    this.round = {
      eggCount: 0,
      mixProgress: 0,
      swirlAngle: 0,
      swirlEnergy: 0,
      mixIns: { cheese: false, negi: false, honey: false },
      pourTimer: 0,
      passIndex: 0,
      rollMilestone: 0,
      slicesCutCount: 0,
      fedGirlCount: 0,
    };
    this.phase = 'PREP';
    this.idleSeconds = 0;
    this.idleDemoShownForPhase = null;
    this.girl.setMood('curious', 2.0);
  }

  // ---------------- MAIN FRAME UPDATE LOOP ----------------

  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    this.sound.update(dt);
    this.round.swirlEnergy *= Math.exp(-3.8 * dt);

    this._updateStationsAndCamera(dt);
    this._updateSubAnimations(dt, t);
    this._updateHandsAndGaze(dt, t);

    this.kitchen.update(dt, {
      mixProgress: this.round.mixProgress,
      swirlAngle: this.round.swirlAngle,
      eggCount: this.round.eggCount,
      mixIns: this.round.mixIns,
      swirlEnergy: this.round.swirlEnergy,
    });
    this.girl.update(dt);
    this.hands.update(dt);
    this.steam.update(dt, this.camera);

    this.renderer.render(this.scene, this.camera);
  }

  _updateStationsAndCamera(dt) {
    const kSlide = Math.min(1, dt * 5.2);

    // Smoothly slide active station into prime foreground center while keeping neighboring context visible!
    const aspect = this.camera.aspect;
    const xCompact = aspect < 0.82 ? 0.76 : 1.0;

    let stoveTarget = this.kitchen.stoveHomePos.clone();
    let stoveScale = 0.84;
    let boardTarget = this.kitchen.boardHomePos.clone();
    let boardScale = 0.78;
    let bentoTarget = this.kitchen.bentoHomePos.clone();
    let bentoScale = 0.84;
    let trayTarget = new THREE.Vector3(-1.14, 0.0, 0.48);
    let bowlTarget = this.kitchen.bowlHomePos.clone();
    let mixTarget = new THREE.Vector3(-0.96, 0.0, -0.28);

    if (this.phase === 'PREP') {
      // Frame 0: Eggs, Crystal Bowl, Ramekins, Copper Pan, Open Bento Box & Full Girl ALL visible cleanly!
      this.camLookTarget.set(-0.04, 0.46, -0.06);
      this.camPosBase.set(-0.04, 1.56, 2.54);
      stoveTarget.x *= xCompact;
      bentoTarget.x *= xCompact;
      trayTarget.x *= xCompact;
      bowlTarget.x *= xCompact;
      mixTarget.x *= xCompact;
      if (aspect < 0.82) {
        trayTarget.z = 0.82;
        bowlTarget.set(-0.22, 0.0, 0.46);
        bentoTarget.set(0.48, 0.0, 0.86);
        bentoScale = 0.74;
        stoveTarget.set(0.42, 0.0, -0.38);
        stoveScale = 0.76;
      }
    } else if (this.phase === 'POURING' || this.phase === 'PAN_COOK') {
      stoveTarget.set(0.02, 0.0, 0.36);
      stoveScale = aspect < 0.82 ? 0.88 : 1.02;
      trayTarget.set(-1.46 * xCompact, 0.0, 0.56);
      mixTarget.set(-1.18 * xCompact, 0.0, -0.34);
      if (this.phase === 'PAN_COOK') {
        bowlTarget.set(-1.26, 0.0, 0.08);
      }
      bentoTarget.set(1.28, 0.0, 0.62);
      bentoScale = 0.80;
      this.camLookTarget.set(0.02, 0.42, 0.02);
      this.camPosBase.set(0.0, 1.52, 2.24);
    } else if (this.phase === 'FLIP_TO_BOARD' || this.phase === 'SLICING') {
      stoveTarget.set(1.08, 0.0, -0.44);
      stoveScale = 0.82;
      trayTarget.set(-1.62, 0.0, 0.48);
      bowlTarget.set(-1.48, 0.0, -0.28);
      mixTarget.set(-1.35, 0.0, -0.62);
      boardTarget.set(aspect < 0.82 ? 0.0 : -0.14, 0.0, 0.42);
      boardScale = aspect < 0.82 ? 0.86 : 1.0;
      bentoTarget.set(1.06, 0.0, 0.54);
      bentoScale = 0.84;
      this.camLookTarget.set(-0.04, 0.40, 0.04);
      this.camPosBase.set(0.0, 1.48, 2.20);
    } else if (this.phase === 'PACKING') {
      stoveTarget.set(1.26, 0.0, -0.58);
      stoveScale = 0.78;
      trayTarget.set(-1.65, 0.0, 0.42);
      bowlTarget.set(-1.55, 0.0, -0.38);
      mixTarget.set(-1.42, 0.0, -0.68);
      boardTarget.set(aspect < 0.82 ? -0.44 : -0.66, 0.0, aspect < 0.82 ? 0.68 : 0.44);
      boardScale = aspect < 0.82 ? 0.76 : 0.92;
      bentoTarget.set(aspect < 0.82 ? 0.36 : 0.56, 0.0, 0.46);
      bentoScale = aspect < 0.82 ? 0.82 : 0.98;
      this.camLookTarget.set(0.0, 0.48, -0.06);
      this.camPosBase.set(0.0, 1.54, 2.38);
    } else if (this.phase === 'CELEBRATE') {
      stoveTarget.set(1.26, 0.0, -0.58);
      stoveScale = 0.78;
      trayTarget.set(-1.65, 0.0, 0.42);
      bowlTarget.set(-1.55, 0.0, -0.38);
      mixTarget.set(-1.42, 0.0, -0.68);
      boardTarget.set(-1.28, 0.0, 0.38);
      boardScale = 0.82;
      bentoTarget.set(0.0, 0.06, 0.46);
      bentoScale = aspect < 0.82 ? 0.90 : 1.04;
      this.camLookTarget.set(0.0, 0.50, -0.10);
      this.camPosBase.set(0.0, 1.50, 2.22);
    }

    this.kitchen.stoveGroup.position.lerp(stoveTarget, kSlide);
    this.kitchen.stoveGroup.scale.lerp(new THREE.Vector3(stoveScale, stoveScale, stoveScale), kSlide);
    this.kitchen.boardGroup.position.lerp(boardTarget, kSlide);
    this.kitchen.boardGroup.scale.lerp(new THREE.Vector3(boardScale, boardScale, boardScale), kSlide);
    this.kitchen.bentoGroup.position.lerp(bentoTarget, kSlide);
    this.kitchen.bentoGroup.scale.lerp(new THREE.Vector3(bentoScale, bentoScale, bentoScale), kSlide);
    this.kitchen.eggTrayGroup.position.lerp(trayTarget, kSlide);
    this.kitchen.mixInGroup.position.lerp(mixTarget, kSlide);
    if (this.phase !== 'POURING') {
      this.kitchen.bowlGroup.position.lerp(bowlTarget, kSlide);
      this.kitchen.bowlGroup.rotation.z += (0 - this.kitchen.bowlGroup.rotation.z) * kSlide;
    }

    this.stoveGlow.position.set(
      this.kitchen.stoveGroup.position.x,
      0.26,
      this.kitchen.stoveGroup.position.z
    );

    // Adjust camera distance proportionally on narrow portrait screens so ALL items fit horizontally!
    const portraitPullback = aspect < 0.88 ? ((1 / Math.max(0.45, aspect)) - 1.12) * 1.18 : 0;
    const targetCamPos = new THREE.Vector3(
      this.camPosBase.x,
      this.camPosBase.y + portraitPullback * 0.48,
      this.camPosBase.z + portraitPullback * 1.05
    );
    this.camera.position.lerp(targetCamPos, Math.min(1, dt * 5.0));
    this.camLookCurrent.lerp(this.camLookTarget, Math.min(1, dt * 6.0));
    this.camera.lookAt(this.camLookCurrent);
  }

  _updateSubAnimations(dt) {
    // 1. Egg Cracking Open Over Bowl ("Paka! Topun!")
    if (this.eggCrackAnim) {
      const a = this.eggCrackAnim;
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);

      // Two shell halves pull apart & hinge upward cleanly!
      const openEase = Math.min(1, u * 2.2);
      this.kitchen.crackShellTop.position.x = -0.02 - openEase * 0.14;
      this.kitchen.crackShellBot.position.x = 0.02 + openEase * 0.14;
      this.kitchen.crackShellTop.rotation.z = Math.PI * 0.5 + openEase * 0.62;
      this.kitchen.crackShellBot.rotation.z = Math.PI * 0.5 - openEase * 0.62;

      // Plump orange yolk + albumen falls into bowl
      const fallU = Math.max(0, (u - 0.14) / 0.52);
      if (fallU < 1) {
        this.kitchen.fallingYolk.position.y = -fallU * fallU * 0.44;
        this.kitchen.fallingAlbumen.scale.y = 0.5 + fallU * 1.4;
      } else if (!a.dropped) {
        a.dropped = true;
        this.kitchen.fallingYolk.visible = false;
        this.round.eggCount += 1;
        // Dilute mixProgress slightly when adding a fresh whole egg so you get to burst & swirl the new yolk!
        this.round.mixProgress *= 0.35;
        this.round.swirlEnergy = 0.85;
        this.kitchen.liquidGroup.visible = true;
        this.kitchen.liquidPainter.render(
          this.round.mixProgress,
          this.round.swirlAngle,
          this.round.eggCount,
          this.round.mixIns
        );
        this.girl.setMood('excited', 1.1);
      }

      if (u >= 1) {
        this.kitchen.crackRig.visible = false;
        this.eggCrackAnim = null;
      }
    }

    // 2. Pouring Egg Ribbon from Tilted Glass Bowl into Sizzling Copper Pan!
    if (this.phase === 'POURING') {
      this.round.pourTimer += dt;
      const u = Math.min(1, this.round.pourTimer / 0.95);
      const panPos = this.kitchen.stoveGroup.position;

      // Lift & tilt bowl over pan
      const pourPos = new THREE.Vector3(panPos.x - 0.35, 0.72, panPos.z + 0.05);
      this.kitchen.bowlGroup.position.lerp(pourPos, Math.min(1, dt * 10));
      this.kitchen.bowlGroup.rotation.z = -Math.sin(Math.min(1, u * 1.35) * Math.PI * 0.45);

      const stream = this.kitchen.panTamago.streamMesh;
      stream.visible = u > 0.12 && u < 0.92;
      stream.position.set(-0.08 + u * 0.18, 0.34, 0);
      stream.scale.set(1 - u * 0.35, 1, 1 - u * 0.35);

      this.kitchen.panTamago.state.pourProgress = Math.min(1, u * 1.12);
      if (this.round.passIndex === 0) {
        // Leave half the egg liquid in the bowl for Pass 2!
        this.kitchen.liquidGroup.scale.multiplyScalar(0.996);
      } else if (u > 0.75) {
        this.kitchen.liquidGroup.visible = false;
      }

      // Billowing steam on initial contact with hot oiled pan!
      this.steamEmitAccum += dt * 18;
      while (this.steamEmitAccum >= 1) {
        this.steamEmitAccum -= 1;
        this.steam.emit(panPos.x, 0.28, panPos.z, {
          count: 1,
          spread: 0.95,
          speedY: 0.46,
          scale0: 0.2,
          scale1: 0.85,
          alpha: 0.34,
        });
      }

      if (u >= 1) {
        stream.visible = false;
        this.phase = 'PAN_COOK';
        this.sound.setPanSizzle(0.82, this.kitchen.heatLevel);
      }
    }

    // 3. Active Pan Sizzling, Setting, Real-Time Sear ("Yaki-iro") & Billowing Steam!
    if (this.phase === 'PAN_COOK') {
      const st = this.kitchen.panTamago.state;
      const heat = this.kitchen.heatLevel;
      st.setProgress = Math.min(1.0, st.setProgress + dt * 0.68 * heat);
      // Sear deepens naturally up to delicious golden-brown (capped at 0.88 so it never turns black/fails!)
      st.searLevel = Math.min(0.88, st.searLevel + dt * 0.065 * heat);

      const panPos = this.kitchen.stoveGroup.position;
      this.steamEmitAccum += dt * (5.5 + heat * 4.5);
      while (this.steamEmitAccum >= 1) {
        this.steamEmitAccum -= 1;
        this.steam.emit(panPos.x, 0.28, panPos.z, {
          count: 1,
          spread: 1.05,
          speedY: 0.38 + heat * 0.12,
          scale0: 0.18,
          scale1: 0.78,
          alpha: 0.30,
        });
      }
    }

    // 4. Pan Flip onto Hinoki Cutting Board!
    if (this.phase === 'FLIP_TO_BOARD' && this.flipAnim) {
      this.flipAnim.t += dt;
      const u = Math.min(1, this.flipAnim.t / this.flipAnim.dur);

      if (u < 0.55) {
        const lift = Math.sin((u / 0.55) * Math.PI);
        this.kitchen.panPivot.position.y = 0.175 + lift * 0.42;
        this.kitchen.panPivot.position.x = -lift * 0.45;
        this.kitchen.panPivot.rotation.z = lift * 0.62;
      } else {
        if (!this.flipAnim.landed) {
          this.flipAnim.landed = true;
          this.kitchen.panTamago.sheetMesh.visible = false;
          this.kitchen.panTamago.coreRollMesh.visible = false;

          this.kitchen.boardSlices.spawnWholeLog({
            searTexture: this.kitchen.panTamago.painter.bottomTexture,
            bumpTexture: this.kitchen.panTamago.painter.bumpTexture,
            searLevel: this.kitchen.panTamago.state.searLevel,
            eggCount: this.round.eggCount,
            mixIns: this.round.mixIns,
          });
          this.sound.playPanFlipOntoBoard();
          const bPos = this.kitchen.boardGroup.position;
          this.steam.emit(bPos.x, 0.36, bPos.z, { count: 8, spread: 0.75, speedY: 0.42, alpha: 0.36 });
        }
        this.kitchen.panPivot.position.y += (0.175 - this.kitchen.panPivot.position.y) * Math.min(1, dt * 10);
        this.kitchen.panPivot.position.x += (0 - this.kitchen.panPivot.position.x) * Math.min(1, dt * 10);
        this.kitchen.panPivot.rotation.z += (0 - this.kitchen.panPivot.rotation.z) * Math.min(1, dt * 10);
      }

      if (u >= 1) {
        this.kitchen.panPivot.position.set(0, 0.175, 0);
        this.kitchen.panPivot.rotation.set(0, 0, 0);
        this.flipAnim = null;
        this.phase = 'SLICING';
        this.kitchen.restingKnife.visible = false;
        this.hands.setTool('knife');
      }
    }

    // Gentle rising steam from warm tamagoyaki on cutting board & inside bento!
    if (this.phase === 'SLICING' || this.phase === 'PACKING' || this.phase === 'CELEBRATE') {
      this.steamEmitAccum += dt * 3.2;
      while (this.steamEmitAccum >= 1) {
        this.steamEmitAccum -= 1;
        const srcPos = this.phase === 'CELEBRATE'
          ? this.kitchen.bentoGroup.position
          : this.kitchen.boardGroup.position;
        this.steam.emit(srcPos.x, 0.34, srcPos.z, {
          count: 1,
          spread: 0.65,
          speedY: 0.28,
          scale0: 0.14,
          scale1: 0.56,
          alpha: 0.22,
        });
      }
    }

    // 5. Knife Chop Motion
    if (this.knifeChopAnim) {
      this.knifeChopAnim.t += dt;
      if (this.knifeChopAnim.t >= this.knifeChopAnim.dur) {
        this.knifeChopAnim = null;
      }
    }

    // 6. Flying Slice / Strawberry into Bento OR into Girl's Mouth!
    if (this.flyingItemAnim) {
      const f = this.flyingItemAnim;
      f.t += dt;
      const u = Math.min(1, f.t / f.dur);
      const ease = 1 - Math.pow(1 - u, 3);
      f.obj3d.position.lerpVectors(f.startPos, f.endPos, ease);
      f.obj3d.position.y += Math.sin(u * Math.PI) * 0.26;

      if (f.type === 'slice') {
        // Rotate so the +X spiral cross-section faces upward toward the camera in the bento!
        f.obj3d.rotation.set(0.18 * ease, 0.12 * ease, Math.PI * 0.43 * ease);
      }

      if (u >= 1) {
        if (f.targetMode === 'bento') {
          f.ref.packed = true;
          this.kitchen.bentoPackedAnchor.attach(f.obj3d);
          f.obj3d.position.copy(f.localSlot);
          if (f.type === 'slice') {
            f.obj3d.rotation.set(0.18, 0.12, Math.PI * 0.43);
            f.obj3d.scale.setScalar(0.88);
            f.ref.jiggle = 1.0;
            this.kitchen.bentoPackedCount += 1;
          }
          this.sound.playPackBento(this.kitchen.bentoPackedCount);
          this.girl.setMood('excited', 1.1);
        } else {
          // Girl ate the warm slice ("A-nn! Mogu-mogu!!")
          f.ref.eaten = true;
          f.obj3d.visible = false;
          this.round.fedGirlCount += 1;
          const hasTreat = this.round.mixIns.cheese || this.round.mixIns.honey || f.type === 'berry';
          this.sound.playVoiceMunch(hasTreat);
          this.girl.setMood('munching', 1.7);
          const mouthW = new THREE.Vector3();
          this.girl.mouthGroup.getWorldPosition(mouthW);
          this.steam.emit(mouthW.x + 0.18, mouthW.y, mouthW.z + 0.1, {
            count: 3,
            spread: 0.15,
            speedY: 0.25,
            scale0: 0.1,
            scale1: 0.35,
            alpha: 0.28,
          });
        }
        this.flyingItemAnim = null;
        this._checkPackingCompletion();
      }
    }

    // 7. Celebration & Seamless Replay Reset
    if (this.phase === 'CELEBRATE') {
      this.celebrateTimer += dt;
      if (this.celebrateTimer > 3.6) {
        this._startFreshRound();
      }
    }
  }

  _updateHandsAndGaze(dt, t) {
    // Track idle time for single subtle 3D hand demonstration ONLY after 10s idle (per wordless.short.md!)
    if (!this.isPointerDown && !this.eggCrackAnim && !this.flyingItemAnim && this.phase !== 'POURING' && this.phase !== 'FLIP_TO_BOARD' && this.phase !== 'CELEBRATE') {
      this.idleSeconds += dt;
      if (this.idleSeconds > 10.0 && this.idleDemoShownForPhase !== this.phase) {
        this.idleDemoShownForPhase = this.phase;
        this.idleDemoTimer = 1.6;
      }
    }
    if (this.idleDemoTimer > 0) {
      this.idleDemoTimer = Math.max(0, this.idleDemoTimer - dt);
    }
    const demoWave = this.idleDemoTimer > 0 ? Math.sin((1.6 - this.idleDemoTimer) * Math.PI * 2.5) : 0;

    // Expressive 3D Hands & Girl Gaze per Phase
    if (this.eggCrackAnim) {
      const rp = this.eggCrackAnim.rigPos;
      const open = Math.min(1, (this.eggCrackAnim.t / this.eggCrackAnim.dur) * 2.0);
      this.hands.setPose({
        leftPos: new THREE.Vector3(rp.x - 0.18 - open * 0.12, rp.y + 0.08, rp.z + 0.24),
        leftRot: new THREE.Euler(0.35, -0.35, 0.25),
        rightPos: new THREE.Vector3(rp.x + 0.18 + open * 0.12, rp.y + 0.08, rp.z + 0.24),
        rightRot: new THREE.Euler(0.35, 0.35, -0.25),
        leftCurl: 0.55,
        rightCurl: 0.55,
      });
      this.girl.setLookTarget(rp);
      return;
    }

    if (this.phase === 'PREP') {
      const bPos = this.kitchen.bowlGroup.position;
      if (this.round.eggCount === 0) {
        this.hands.setTool('none');
        const nextEgg = this.kitchen.eggs[0];
        const eggWorld = new THREE.Vector3();
        nextEgg.mesh.getWorldPosition(eggWorld);
        this.girl.setLookTarget(eggWorld);

        if (this.idleDemoTimer > 0) {
          // 1-time 10s idle gentle hand reach toward first egg
          this.hands.setPose({
            leftPos: new THREE.Vector3(-1.35, 0.45, 1.55),
            leftRot: new THREE.Euler(0.25, 0.3, 0),
            rightPos: new THREE.Vector3(eggWorld.x + 0.12 + demoWave * 0.14, 0.46, eggWorld.z + 0.34),
            rightRot: new THREE.Euler(0.45, 0.25, 0),
            leftCurl: 0.25,
            rightCurl: 0.4,
          });
        } else {
          // Keep foreground clean on Frame 0 until first touch!
          this.hands.setPose({
            leftPos: new THREE.Vector3(-1.32, 0.38, 1.58),
            leftRot: new THREE.Euler(0.3, 0.35, 0),
            rightPos: new THREE.Vector3(1.32, 0.38, 1.58),
            rightRot: new THREE.Euler(0.3, -0.35, 0),
            leftCurl: 0.25,
            rightCurl: 0.25,
          });
        }
      } else {
        // Egg is in bowl -> Left hand steadies glass bowl rim, Right hand swirls chopsticks!
        this.girl.setLookTarget(bPos);
        const stirR = 0.14;
        const sa = this.round.swirlAngle + (this.idleDemoTimer > 0 ? t * 5 : 0);
        const useSticks = !this.kitchen.restingChopsticks.visible || this.idleDemoTimer > 0;
        this.hands.setTool(useSticks ? 'chopsticks' : 'none');

        this.hands.setPose({
          leftPos: new THREE.Vector3(bPos.x - 0.54, 0.38, bPos.z + 0.28),
          leftRot: new THREE.Euler(0.32, -0.42, 0.18),
          rightPos: useSticks
            ? new THREE.Vector3(bPos.x + 0.26 + Math.cos(sa) * stirR, 0.78, bPos.z + 0.46 + Math.sin(sa) * stirR)
            : new THREE.Vector3(bPos.x + 0.58, 0.42, bPos.z + 0.36),
          rightRot: new THREE.Euler(0.38 + Math.sin(sa) * 0.08, 0.22 - Math.cos(sa) * 0.12, -0.12),
          leftCurl: 0.52,
          rightCurl: 0.65,
          pinch: 0.05,
        });
      }
    } else if (this.phase === 'POURING') {
      const bPos = this.kitchen.bowlGroup.position;
      this.girl.setLookTarget(this.kitchen.stoveGroup.position);
      this.hands.setPose({
        leftPos: new THREE.Vector3(bPos.x - 0.38, bPos.y + 0.24, bPos.z + 0.28),
        leftRot: new THREE.Euler(0.28, -0.3, -0.35),
        rightPos: new THREE.Vector3(bPos.x + 0.22, bPos.y + 0.34, bPos.z + 0.34),
        rightRot: new THREE.Euler(0.28, 0.25, -0.45),
        leftCurl: 0.55,
        rightCurl: 0.55,
      });
    } else if (this.phase === 'PAN_COOK') {
      const pPos = this.kitchen.stoveGroup.position;
      const rProg = this.kitchen.panTamago.state.rollProgress;
      this.girl.setLookTarget(pPos);
      this.hands.setTool('chopsticks');

      // Left hand grips wooden pan handle on right-front? Wait: pan handle is on +X, so let's poise chopsticks cleanly at the rolling front!
      const rollX = pPos.x - 0.62 + rProg * 1.22 + demoWave * 0.22;
      const rollArcY = 0.78 + Math.sin(rProg * Math.PI * 3) * 0.08;
      this.hands.setPose({
        leftPos: new THREE.Vector3(pPos.x - 1.12, 0.42, pPos.z + 0.62),
        leftRot: new THREE.Euler(0.35, -0.3, 0.1),
        rightPos: new THREE.Vector3(rollX + 0.24, rollArcY, pPos.z + 0.56),
        rightRot: new THREE.Euler(0.42, 0.28, -0.15 - Math.sin(rProg * Math.PI * 3) * 0.16),
        leftCurl: 0.35,
        rightCurl: 0.68,
        pinch: 0.05,
      });
    } else if (this.phase === 'SLICING') {
      const brdPos = this.kitchen.boardGroup.position;
      this.girl.setLookTarget(brdPos);
      this.hands.setTool('knife');

      // Track finger X smoothly over cutting board; chop downward during knifeChopAnim!
      let targetX = brdPos.x + 0.18 + demoWave * 0.12;
      if (this.isPointerDown) {
        const wp = this._projectOntoY(0.28);
        if (wp) targetX = Math.max(brdPos.x - 0.58, Math.min(brdPos.x + 0.62, wp.x));
      }
      let chopDrop = 0;
      if (this.knifeChopAnim) {
        targetX = brdPos.x + this.knifeChopAnim.cutX;
        chopDrop = Math.sin((this.knifeChopAnim.t / this.knifeChopAnim.dur) * Math.PI) * 0.26;
      } else if (this.idleDemoTimer > 0) {
        chopDrop = Math.max(0, demoWave) * 0.14;
      }

      // Left hand in safe curled "Cat-Paw" ("猫の手") pose steadying the left end of the tamagoyaki!
      this.hands.setPose({
        leftPos: new THREE.Vector3(brdPos.x - 0.68, 0.46, brdPos.z + 0.28),
        leftRot: new THREE.Euler(0.58, -0.18, 0.12),
        rightPos: new THREE.Vector3(targetX + 0.02, 0.54 - chopDrop, brdPos.z + 0.52),
        rightRot: new THREE.Euler(0.18 + chopDrop * 0.45, 0.02, 0),
        leftCurl: 0.88, // Curled cat-paw fingertips!
        rightCurl: 0.78,
      });
    } else if (this.phase === 'PACKING') {
      this.hands.setTool('chopsticks');
      if (this.grabbedItem) {
        const gp = this.grabbedItem.worldPos;
        this.hands.setPose({
          leftPos: new THREE.Vector3(-1.35, 0.24, 1.62),
          leftRot: new THREE.Euler(0.3, 0.3, 0),
          rightPos: new THREE.Vector3(gp.x + 0.28, gp.y + 0.34, gp.z + 0.52),
          rightRot: new THREE.Euler(0.28, 0.28, -0.14),
          leftCurl: 0.3,
          rightCurl: 0.68,
          pinch: 0.03,
        });
      } else {
        const bentoPos = this.kitchen.bentoGroup.position;
        this.girl.setLookTarget(bentoPos);
        const brdPos = this.kitchen.boardGroup.position;
        this.hands.setPose({
          leftPos: new THREE.Vector3(-1.28, 0.38, 1.38),
          leftRot: new THREE.Euler(0.3, 0.3, 0),
          rightPos: new THREE.Vector3(brdPos.x + 0.25 + demoWave * 0.45, 0.68, brdPos.z + 0.56),
          rightRot: new THREE.Euler(0.38, 0.22, -0.1),
          leftCurl: 0.3,
          rightCurl: 0.62,
          pinch: 0.08,
        });
      }
    } else if (this.phase === 'CELEBRATE') {
      this.girl.setLookTarget(this.kitchen.bentoGroup.position);
      this.hands.setPose({
        leftPos: new THREE.Vector3(-1.35, 0.36, 1.55),
        leftRot: new THREE.Euler(0.25, 0.3, 0),
        rightPos: new THREE.Vector3(1.35, 0.36, 1.55),
        rightRot: new THREE.Euler(0.25, -0.3, 0),
        leftCurl: 0.25,
        rightCurl: 0.25,
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TamagoyakiGame();
});
