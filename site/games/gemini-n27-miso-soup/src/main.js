import * as THREE from 'three';
import { sound } from './audio.js';
import { ClayKitchen } from './kitchen.js';
import {
  ClayWaterPitcher,
  ClayDashiProp,
  ClayTofuPalmStage,
  ClayWakameDish,
  ClayMisoAndLadle,
} from './props.js';
import { ClayFamilyScene } from './family.js';
import { makeClayMaterial, sculptClay } from './clay.js';

// Game stages (purely visual/tactile, zero text!)
const STAGES = {
  WATER_DASHI: 'water_dashi',
  CUT_TOFU: 'cut_tofu',
  ADD_WAKAME: 'add_wakame',
  DISSOLVE_MISO: 'dissolve_miso',
  SERVE_FAMILY: 'serve_family',
};

class MisoSoupGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6e6ce);
    this.scene.fog = new THREE.Fog(0xf6e6ce, 14, 24);

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 40);
    this.camPos = new THREE.Vector3(0, 4.35, 5.5);
    this.camTarget = new THREE.Vector3(0, 0.8, 0.1);
    this.camLookCurrent = this.camTarget.clone();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLookCurrent);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    // Strictly cap pixelRatio at 1.5 for smooth 30fps+ on iPhone/iPad!
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this._setupLights();

    // Build all clay world subsystems
    this.kitchen = new ClayKitchen(this.scene);
    this.pitcher = new ClayWaterPitcher(this.scene);
    this.dashi = new ClayDashiProp(this.scene);
    this.tofuStage = new ClayTofuPalmStage(this.scene);
    this.wakameDish = new ClayWakameDish(this.scene);
    this.misoLadle = new ClayMisoAndLadle(this.scene);
    this.family = new ClayFamilyScene(this.scene);

    // Subtle plump clay helper hand (ONLY appears once after 10s of silence!)
    this._buildIdleHintHand();

    // Stage & interaction state
    this.stage = STAGES.WATER_DASHI;
    this.stageTimer = 0;
    this.stageAdvancing = false;
    this.idleTimer = 0;
    this.hintPlayedForStage = false;
    this.hintAnim = 0;
    this.simmerSoundTimer = 0;
    this.finaleTriggered = false;
    this.finaleTimer = 0;
    this.roundCount = 0;

    // Auto-animations for tolerant tap actions (tap works just as naturally as drag!)
    this.autoPourTimer = 0;
    this.autoDashiFly = null;
    this.autoMisoMove = null;
    this.autoServeAnim = null;

    // Single-finger pointer state (multi-touch safe: tracks activePointerId only!)
    this.activePointerId = null;
    this.dragKind = null; // 'pitcher' | 'dashi' | 'tofuSwipe' | 'wakame' | 'misoLadle' | 'misoSwirl' | 'serveLadle'
    this.dragObj = null;
    this.pointerDownNDC = new THREE.Vector2();
    this.pointerCurNDC = new THREE.Vector2();
    this.pointerPrevNDC = new THREE.Vector2();
    this.swipeAccum = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);
    this.dragHit = new THREE.Vector3();

    this.clock = new THREE.Clock();
    this.time = 0;
    this.fpsFrames = 0;
    this.fpsTimer = 0;
    this.lastFps = 60;

    this._bindEvents();
    this._updateCameraGoals();
    this._exposeDebug();
    this._loop();
  }

  _setupLights() {
    // Cozy warm morning sunlight hemisphere fill
    const hemi = new THREE.HemisphereLight(0xfff8e8, 0xd8a87e, 1.05);
    this.scene.add(hemi);

    // Main sunlit claymation miniature key light with soft shadow
    const key = new THREE.DirectionalLight(0xfff2d6, 1.65);
    key.position.set(-4.2, 8.6, 5.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 22;
    key.shadow.camera.left = -5.6;
    key.shadow.camera.right = 5.6;
    key.shadow.camera.top = 5.6;
    key.shadow.camera.bottom = -5.6;
    key.shadow.bias = -0.0008;
    key.shadow.radius = 3.5;
    this.scene.add(key);

    // Soft warm peach-sky rim light to pop chunky clay contours!
    const rim = new THREE.DirectionalLight(0xffdfb8, 0.58);
    rim.position.set(5.0, 4.5, -4.5);
    this.scene.add(rim);
  }

  _buildIdleHintHand() {
    // Plump translucent clay fingertip hint — completely hidden until 10s idle, then plays ONCE subtly
    this.hintHand = new THREE.Group();
    this.hintHand.visible = false;
    const hMat = makeClayMaterial(0xffead8, {
      roughness: 0.65,
      transparent: true,
      opacity: 0.78,
    });
    const palm = new THREE.Mesh(sculptClay(new THREE.SphereGeometry(0.26, 12, 10), 0.01, 4, 900), hMat);
    palm.scale.set(1.0, 0.6, 1.15);
    this.hintHand.add(palm);
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 10), hMat);
    finger.rotation.x = Math.PI / 2 - 0.35;
    finger.position.set(0, -0.08, -0.28);
    this.hintHand.add(finger);
    this.scene.add(this.hintHand);
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this._updateCameraGoals();
    });

    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _getNDC(e, out = new THREE.Vector2()) {
    const rect = this.canvas.getBoundingClientRect();
    out.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    out.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return out;
  }

  _findInteractId(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.interactId) return { id: cur.userData.interactId, mesh: cur };
      cur = cur.parent;
    }
    return null;
  }

  _raycastInteract(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      // Verify all ancestors are visible
      let vis = true;
      let p = h.object;
      while (p) {
        if (!p.visible) { vis = false; break; }
        p = p.parent;
      }
      if (!vis) continue;
      const found = this._findInteractId(h.object);
      if (found) return { ...found, point: h.point };
    }
    return null;
  }

  _projectToPlane(ndc, planeY, out = new THREE.Vector3()) {
    this.dragPlane.set(new THREE.Vector3(0, 1, 0), -planeY);
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.ray.intersectPlane(this.dragPlane, out);
    return out;
  }

  _resetIdle() {
    this.idleTimer = 0;
    this.hintAnim = 0;
    this.hintHand.visible = false;
  }

  _onPointerDown(e) {
    sound.unlock();
    if (this.activePointerId !== null) return; // Multi-touch safe: ignore extra fingers!
    this.activePointerId = e.pointerId;
    this._resetIdle();

    this._getNDC(e, this.pointerDownNDC);
    this.pointerCurNDC.copy(this.pointerDownNDC);
    this.pointerPrevNDC.copy(this.pointerDownNDC);
    this.swipeAccum.set(0, 0);

    const hit = this._raycastInteract(this.pointerDownNDC);
    const id = hit ? hit.id : null;

    // Secondary tactile reaction on stove dial or pot in any cooking stage
    if (id === 'stoveDial') {
      this.kitchen.dialSpring.impulse(5.5);
      sound.playClayPop(1.4, 0.16);
      return;
    }

    if (this.stage === STAGES.WATER_DASHI) {
      if (id === 'pitcher') {
        this.dragKind = 'pitcher';
        this.autoPourTimer = 0;
        this.pitcher.spring.impulse(4.5);
        sound.playClayPop(1.05, 0.2);
      } else if (id === 'dashi' && !this.dashi.dropped) {
        this.dragKind = 'dashi';
        this.dashi.spring.impulse(5.0);
        sound.playClayPop(1.25, 0.2);
      } else if (id === 'pot') {
        this.kitchen.pokePot();
        sound.playSplash(1.0, 0.18);
      }
    } else if (this.stage === STAGES.CUT_TOFU) {
      if (id === 'tofu' || id === 'tofuPalm' || id === 'knife') {
        this.dragKind = 'tofuSwipe';
        this.tofuStage.jiggleTofu();
        sound.playClayPop(1.3, 0.14);
      } else if (id === 'pot') {
        this.kitchen.pokePot();
        sound.playSplash(1.1, 0.16);
      }
    } else if (this.stage === STAGES.ADD_WAKAME) {
      if (id === 'wakameBud' || id === 'wakameDish') {
        let bud = null;
        if (hit.mesh.userData.budIndex !== undefined) {
          const candidate = this.wakameDish.buds[hit.mesh.userData.budIndex];
          if (candidate && !candidate.used) bud = candidate;
        }
        if (!bud) bud = this.wakameDish.getNextUnusedBud();
        if (bud) {
          this.dragKind = 'wakame';
          this.dragObj = bud;
          bud.spring.impulse(5.0);
          sound.playClayPop(1.45, 0.18);
        }
      } else if (id === 'pot') {
        this.kitchen.pokePot();
        sound.playSplash(1.15, 0.16);
      }
    } else if (this.stage === STAGES.DISSOLVE_MISO) {
      if (!this.misoLadle.misoInPot && (id === 'ladle' || id === 'misoTub')) {
        this.dragKind = 'misoLadle';
        this.misoLadle.spring.impulse(4.8);
        sound.playClayPop(0.95, 0.2);
      } else if (this.misoLadle.misoInPot && (id === 'ladle' || id === 'pot')) {
        this.dragKind = 'misoSwirl';
        sound.playClayPop(1.05, 0.14);
      } else if (id === 'pot') {
        this.kitchen.pokePot();
        sound.playSplash(0.95, 0.16);
      }
    } else if (this.stage === STAGES.SERVE_FAMILY) {
      if (id === 'replayPot' && this.family.showReplay) {
        sound.playStageComplete();
        this._restartNewRound();
        return;
      }
      if (id === 'ladle' || id === 'pot') {
        if (!this.autoServeAnim) {
          this.dragKind = 'serveLadle';
          this.misoLadle.spring.impulse(4.5);
          sound.playSplash(1.05, 0.18);
        }
      } else if (id && id.startsWith('bowl_')) {
        const idx = parseInt(id.split('_')[1], 10);
        if (!this.autoServeAnim) {
          // Tolerant tap on a family bowl: ladle visibly scoops from pot & arcs over to pour into that bowl!
          this._startAutoServeToBowl(idx);
        }
      } else if (id && id.startsWith('family_')) {
        const idx = parseInt(id.split('_')[1], 10);
        this.family.members[idx].poke();
        if (this.family.members[idx].serveCount > 0) {
          sound.playFamilyHappy(idx);
        } else {
          sound.playClayPop(1.0 + idx * 0.15, 0.18);
        }
      }
    }
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    this._resetIdle();
    this.pointerPrevNDC.copy(this.pointerCurNDC);
    this._getNDC(e, this.pointerCurNDC);

    const dx = this.pointerCurNDC.x - this.pointerPrevNDC.x;
    const dy = this.pointerCurNDC.y - this.pointerPrevNDC.y;
    const moveDist = Math.hypot(dx, dy);

    if (this.dragKind === 'pitcher') {
      const p = this._projectToPlane(this.pointerCurNDC, 1.55, this.dragHit);
      const tx = Math.max(-2.9, Math.min(1.6, p.x));
      const tz = Math.max(-1.0, Math.min(1.8, p.z));
      // Magnetic assist when brought near the pot!
      const distPot = Math.hypot(tx, tz);
      if (distPot < 1.85) {
        this.pitcher.group.position.x += (-1.22 - this.pitcher.group.position.x) * 0.25;
        this.pitcher.group.position.y += (1.32 - this.pitcher.group.position.y) * 0.25;
        this.pitcher.group.position.z += (0.12 - this.pitcher.group.position.z) * 0.25;
        this.pitcher.isPouring = true;
      } else {
        this.pitcher.group.position.x += (tx - this.pitcher.group.position.x) * 0.35;
        this.pitcher.group.position.y += (0.65 - this.pitcher.group.position.y) * 0.3;
        this.pitcher.group.position.z += (tz - this.pitcher.group.position.z) * 0.35;
        this.pitcher.isPouring = false;
      }
    } else if (this.dragKind === 'dashi' && !this.dashi.dropped) {
      const p = this._projectToPlane(this.pointerCurNDC, 1.65, this.dragHit);
      this.dashi.bundle.position.x = Math.max(-2.0, Math.min(2.8, p.x));
      this.dashi.bundle.position.y = 1.68;
      this.dashi.bundle.position.z = Math.max(-1.2, Math.min(1.8, p.z));
      // Drop right into pot when dragged over it!
      if (Math.hypot(p.x, p.z) < 1.25) {
        this._dropDashiIntoPot();
        this.dragKind = null;
      }
    } else if (this.dragKind === 'tofuSwipe') {
      this.swipeAccum.x += dx;
      this.swipeAccum.y += dy;
      if (this.swipeAccum.length() > 0.14) {
        const res = this.tofuStage.performNextCut(this.swipeAccum.x, -this.swipeAccum.y);
        if (res === 'cut') {
          sound.playTofuSlice(this.tofuStage.totalCuts - 1);
          this.swipeAccum.set(0, 0);
        } else if (res === 'dump') {
          sound.playClayPop(1.15, 0.2);
          this.dragKind = null;
        }
      }
    } else if (this.dragKind === 'wakame' && this.dragObj && !this.dragObj.used) {
      const p = this._projectToPlane(this.pointerCurNDC, 1.65, this.dragHit);
      this.dragObj.mesh.position.set(
        Math.max(-1.8, Math.min(2.8, p.x)),
        1.65,
        Math.max(-1.2, Math.min(1.8, p.z))
      );
      if (Math.hypot(p.x, p.z) < 1.22) {
        const ly = this.kitchen.getLiquidWorldY();
        this.wakameDish.launchBudToPot(
          this.dragObj,
          new THREE.Vector3(
            (Math.random() - 0.5) * 1.1,
            ly,
            (Math.random() - 0.5) * 1.1
          )
        );
        this.dragObj = null;
        this.dragKind = null;
      }
    } else if (this.dragKind === 'misoLadle' && !this.misoLadle.misoInPot) {
      const p = this._projectToPlane(this.pointerCurNDC, 1.85, this.dragHit);
      this.misoLadle.ladleGroup.position.set(
        Math.max(-1.5, Math.min(2.8, p.x)),
        1.85,
        Math.max(-1.0, Math.min(1.6, p.z))
      );
      if (Math.hypot(p.x, p.z) < 1.25) {
        this._seatMisoInPot();
        this.dragKind = 'misoSwirl';
      }
    } else if (this.dragKind === 'misoSwirl' && this.misoLadle.misoInPot) {
      const p = this._projectToPlane(this.pointerCurNDC, 1.28, this.dragHit);
      const r = Math.hypot(p.x, p.z);
      const clampR = Math.min(0.68, r);
      const ang = Math.atan2(p.z, p.x);
      const lx = Math.cos(ang) * clampR;
      const lz = Math.sin(ang) * clampR;
      const ly = this.kitchen.getLiquidWorldY();
      this.misoLadle.ladleGroup.position.set(lx, ly + 0.04, lz);

      if (moveDist > 0.004) {
        this._applyMisoDissolve(moveDist * 0.42, lx, lz);
      }
    } else if (this.dragKind === 'serveLadle') {
      const p = this._projectToPlane(this.pointerCurNDC, 1.55, this.dragHit);
      const tx = Math.max(-3.1, Math.min(3.1, p.x));
      const tz = Math.max(-1.2, Math.min(2.2, p.z));
      this.misoLadle.ladleGroup.position.set(tx, 1.62, tz);
      // Check proximity to any of the 3 family bowls!
      for (let i = 0; i < this.family.members.length; i++) {
        const bPos = this.family.members[i].bowlHome;
        if (Math.hypot(tx - bPos.x, tz - bPos.z) < 1.05) {
          this.dragKind = null;
          this._startPourIntoBowl(i);
          break;
        }
      }
    }
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    const totalDrag = this.pointerCurNDC.distanceTo(this.pointerDownNDC);
    const wasTap = totalDrag < 0.065;

    if (this.dragKind === 'pitcher') {
      this.pitcher.isPouring = false;
      if (wasTap) {
        // Tolerant tap on pitcher: tips over pot and pours a generous splash!
        this.autoPourTimer = 1.05;
      }
    } else if (this.dragKind === 'dashi' && !this.dashi.dropped) {
      if (wasTap) {
        // Tolerant tap on dashi: hops right into the pot!
        this.autoDashiFly = { t: 0, start: this.dashi.bundle.position.clone() };
      }
    } else if (this.dragKind === 'tofuSwipe') {
      if (wasTap) {
        // Tolerant tap on tofu/palm: performs next slice, or tilts palm once all sliced!
        const res = this.tofuStage.performNextCut(0, 0);
        if (res === 'cut') {
          sound.playTofuSlice(this.tofuStage.totalCuts - 1);
        } else if (res === 'dump') {
          sound.playClayPop(1.15, 0.2);
        }
      }
    } else if (this.dragKind === 'wakame' && this.dragObj && !this.dragObj.used) {
      if (wasTap) {
        const ly = this.kitchen.getLiquidWorldY();
        this.wakameDish.launchBudToPot(
          this.dragObj,
          new THREE.Vector3((Math.random() - 0.5) * 1.15, ly, (Math.random() - 0.5) * 1.15)
        );
      } else {
        // Spring back cleanly to dish
        this.dragObj.mesh.position.copy(this.dragObj.home);
      }
    } else if (this.dragKind === 'misoLadle' && !this.misoLadle.misoInPot) {
      if (wasTap) {
        this.autoMisoMove = { t: 0, start: this.misoLadle.ladleGroup.position.clone() };
      }
    } else if (this.dragKind === 'misoSwirl' && this.misoLadle.misoInPot && wasTap) {
      // Even tapping/poking the miso in the pot gives a nice swirl burst!
      const ang = this.time * 4;
      this._applyMisoDissolve(0.22, Math.cos(ang) * 0.35, Math.sin(ang) * 0.35);
    } else if (this.dragKind === 'serveLadle') {
      if (wasTap) {
        // Tapping the ladle serves the next unserved family member (or center if all served)
        const nextIdx = this.family.members.findIndex((m) => m.serveCount === 0);
        this._startAutoServeToBowl(nextIdx >= 0 ? nextIdx : Math.floor(Math.random() * 3));
      }
    }

    this.activePointerId = null;
    this.dragKind = null;
    this.dragObj = null;
  }

  _dropDashiIntoPot() {
    if (this.dashi.dropped) return;
    this.dashi.dropped = true;
    this.dashi.bundle.visible = false;
    const kombuCopy = this.dashi.createFloatingKombuCopy();
    this.kitchen.addFloatingKombu(kombuCopy, 0.05, -0.05);
    this.kitchen.spawnSplash(0, 0, 7, 0xf2c14e);
    sound.playSplash(0.85, 0.25);

    if (this.kitchen.waterLevel > 0.25) {
      this._steepDashiAndCheckStage0();
    }
  }

  _steepDashiAndCheckStage0() {
    if (this.kitchen.dashiLevel < 0.05 && this.dashi.dropped && this.kitchen.waterLevel > 0.25) {
      this.kitchen.triggerDashiRing();
      sound.playDashiBloom();
    }
    if (this.dashi.dropped && this.kitchen.waterLevel >= 0.88 && !this.stageAdvancing) {
      this.stageAdvancing = true;
      this.kitchen.heatOn = true;
      sound.playFlameIgnite();
      setTimeout(() => {
        if (this.stage === STAGES.WATER_DASHI) {
          this._enterStage(STAGES.CUT_TOFU);
        }
      }, 1350);
    }
  }

  _seatMisoInPot() {
    if (this.misoLadle.misoInPot) return;
    this.misoLadle.misoInPot = true;
    const ly = this.kitchen.getLiquidWorldY();
    this.misoLadle.ladleGroup.position.set(0, ly + 0.04, 0);
    this.misoLadle.stirrerGroup.visible = true;
    this.kitchen.spawnSplash(0, 0, 6);
    sound.playSplash(0.82, 0.24);
  }

  _applyMisoDissolve(amount, lx, lz) {
    if (this.stageAdvancing) return;
    this.misoLadle.dissolveProgress = Math.min(1, this.misoLadle.dissolveProgress + amount);
    const p = this.misoLadle.dissolveProgress;
    this.kitchen.misoLevel = p;
    this.kitchen.swirlSpeed = Math.min(3.8, this.kitchen.swirlSpeed + amount * 5.2);
    this.kitchen.rippleAmp = Math.min(0.085, this.kitchen.rippleAmp + amount * 0.14);

    // Shrink glossy caramel miso lump organically & emit swirling miso ribbons!
    const rem = Math.max(0.001, 1 - p);
    this.misoLadle.misoLump.scale.set(
      rem * (1 + Math.sin(this.time * 18) * 0.08),
      rem * 0.92,
      rem * (1 - Math.sin(this.time * 18) * 0.08)
    );
    if (Math.random() < 0.65) {
      this.kitchen.spawnMisoCloud(lx, lz);
    }
    sound.playMisoSwirl(p);

    if (p >= 1 && !this.stageAdvancing) {
      this.stageAdvancing = true;
      this.misoLadle.misoLump.visible = false;
      this.misoLadle.stirrerGroup.visible = false;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.kitchen.spawnMisoCloud(Math.cos(a) * 0.45, Math.sin(a) * 0.45);
      }
      sound.playStageComplete();
      setTimeout(() => {
        if (this.stage === STAGES.DISSOLVE_MISO) {
          this._enterStage(STAGES.SERVE_FAMILY);
        }
      }, 1200);
    }
  }

  _startAutoServeToBowl(bowlIdx) {
    const potPos = this.kitchen.potGroup.position;
    const bowlTarget = this.family.getBowlWorldPos(bowlIdx);
    this.autoServeAnim = {
      phase: 'carry',
      t: 0,
      bowlIdx,
      start: new THREE.Vector3(potPos.x + 0.12, potPos.y + 1.15, potPos.z + 0.05),
      end: new THREE.Vector3(bowlTarget.x + 0.18, bowlTarget.y + 0.85, bowlTarget.z + 0.12),
      poured: false,
    };
    sound.playSplash(1.08, 0.16);
  }

  _startPourIntoBowl(bowlIdx) {
    const bowlTarget = this.family.getBowlWorldPos(bowlIdx);
    this.autoServeAnim = {
      phase: 'pour',
      t: 0,
      bowlIdx,
      start: this.misoLadle.ladleGroup.position.clone(),
      end: new THREE.Vector3(bowlTarget.x + 0.22, bowlTarget.y + 0.82, bowlTarget.z + 0.1),
      poured: false,
    };
  }

  _enterStage(nextStage) {
    this.stage = nextStage;
    this.stageTimer = 0;
    this.stageAdvancing = false;
    this.idleTimer = 0;
    this.hintPlayedForStage = false;
    this.hintHand.visible = false;
    this.autoPourTimer = 0;
    this.autoDashiFly = null;
    this.autoMisoMove = null;
    this.autoServeAnim = null;

    // Show/hide stage props cleanly (Hierarchy A: current invitation prominent!)
    const isWaterStage = nextStage === STAGES.WATER_DASHI;
    this.pitcher.group.visible = isWaterStage;
    this.pitcher.streamGroup.visible = false;
    this.dashi.trayGroup.visible = isWaterStage;
    this.dashi.bundle.visible = isWaterStage && !this.dashi.dropped;

    if (nextStage === STAGES.CUT_TOFU) {
      this.tofuStage.enter();
      this.wakameDish.hide();
      this.misoLadle.hideAll();
      this.family.hide();
    } else if (nextStage === STAGES.ADD_WAKAME) {
      this.tofuStage.exit();
      this.wakameDish.show();
      this.misoLadle.hideAll();
      this.family.hide();
    } else if (nextStage === STAGES.DISSOLVE_MISO) {
      this.tofuStage.exit();
      this.wakameDish.hide();
      this.misoLadle.enterMisoStage();
      this.family.hide();
    } else if (nextStage === STAGES.SERVE_FAMILY) {
      this.tofuStage.exit();
      this.wakameDish.hide();
      this.kitchen.heatOn = false;
      this.kitchen.heatIntensity = 0.65; // Keep lovely gentle warm steam rising from hot soup!
      this.kitchen.stoveGroup.visible = false;
      this.kitchen.trivetGroup.visible = true;
      this.kitchen.trivetGroup.position.set(0, 0.04, 1.82);
      this.kitchen.potBaseScale = 0.84;
      this.family.enter();
      this.misoLadle.enterServeStage(new THREE.Vector3(0, 0.1, 1.82));
      this.finaleTriggered = false;
      this.finaleTimer = 0;
    }

    this._updateCameraGoals();
  }

  _restartNewRound() {
    this.roundCount++;
    this.kitchen.resetForNewRound();
    this.pitcher.group.position.copy(this.pitcher.homePos);
    this.pitcher.isPouring = false;
    this.pitcher.pourTilt = 0;
    this.dashi.reset();
    this.tofuStage.exit();
    this.wakameDish.hide();
    this.misoLadle.hideAll();
    this.family.hide();
    this._enterStage(STAGES.WATER_DASHI);
  }

  _updateCameraGoals() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    // Automatically widen distance smoothly in portrait mode (iPhone!) so left/right props and all 3 family members fit HUGE and uncropped
    const portraitFactor = aspect < 1.0 ? Math.min(2.15, 1.06 / Math.max(0.44, aspect)) : 1.0;

    if (this.stage === STAGES.WATER_DASHI) {
      this.camPos.set(0, 4.55 * portraitFactor, 6.45 * portraitFactor);
      this.camTarget.set(0, 0.72, 0.18);
    } else if (this.stage === STAGES.CUT_TOFU) {
      // Intimate close-up framing the ENTIRE giant clay palm + 3x3 tofu + friendly knife + steaming pot!
      const pf = aspect < 1.0 ? Math.min(1.65, portraitFactor * 0.82) : 1.0;
      this.camPos.set(0.22, 4.45 * pf, 4.65 * pf);
      this.camTarget.set(0.12, 1.52, 0.25);
    } else if (this.stage === STAGES.ADD_WAKAME) {
      this.camPos.set(0.32, 4.45 * portraitFactor, 5.55 * portraitFactor);
      this.camTarget.set(0.38, 0.8, 0.2);
    } else if (this.stage === STAGES.DISSOLVE_MISO) {
      this.camPos.set(0.45, 4.55 * portraitFactor, 5.85 * portraitFactor);
      this.camTarget.set(0.48, 0.86, 0.22);
    } else if (this.stage === STAGES.SERVE_FAMILY) {
      // Warm dining table view framing ALL 3 BIG clay family members + ALL 3 glossy bowls + steaming pot!
      const pf = aspect < 1.0 ? Math.min(2.15, portraitFactor) : 1.0;
      this.camPos.set(0, 4.95 * pf, 8.05 * pf);
      this.camTarget.set(0, 1.15, -0.45);
    }
  }

  _updateIdleHint(dt) {
    if (this.stageAdvancing || this.dragKind || this.autoServeAnim) {
      this.hintHand.visible = false;
      return;
    }
    this.idleTimer += dt;
    // Wordless rule: 0-9s do NOTHING; after 10s show a gentle clay hand motion ONCE!
    if (this.idleTimer > 10.0 && !this.hintPlayedForStage) {
      this.hintAnim += dt * 0.65;
      if (this.hintAnim >= 1.0) {
        this.hintPlayedForStage = true;
        this.hintHand.visible = false;
        return;
      }
      this.hintHand.visible = true;
      const t = this.hintAnim;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      if (this.stage === STAGES.WATER_DASHI) {
        const from = this.kitchen.waterLevel < 0.85 ? this.pitcher.homePos : this.dashi.bundleHomePos;
        this.hintHand.position.set(
          from.x * (1 - ease),
          1.45 + Math.sin(ease * Math.PI) * 0.55,
          from.z * (1 - ease) + 0.2
        );
      } else if (this.stage === STAGES.CUT_TOFU) {
        if (this.tofuStage.totalCuts < 4) {
          this.hintHand.position.set(-0.6 + ease * 1.3, 2.75, 0.55);
        } else {
          this.hintHand.position.set(0.1, 2.8 - ease * 0.7, 0.55);
        }
      } else if (this.stage === STAGES.ADD_WAKAME) {
        this.hintHand.position.set(2.2 * (1 - ease), 1.35 + Math.sin(ease * Math.PI) * 0.5, 0.5 * (1 - ease));
      } else if (this.stage === STAGES.DISSOLVE_MISO) {
        if (!this.misoLadle.misoInPot) {
          this.hintHand.position.set(2.2 * (1 - ease), 1.7 + Math.sin(ease * Math.PI) * 0.4, 0.5 * (1 - ease));
        } else {
          const ang = ease * Math.PI * 2;
          this.hintHand.position.set(Math.cos(ang) * 0.55, 1.55, Math.sin(ang) * 0.55);
        }
      } else if (this.stage === STAGES.SERVE_FAMILY) {
        const nextIdx = this.family.members.findIndex((m) => m.serveCount === 0);
        if (nextIdx >= 0) {
          const bPos = this.family.members[nextIdx].bowlHome;
          this.hintHand.position.set(
            bPos.x * ease,
            1.45 + Math.sin(ease * Math.PI) * 0.45,
            1.85 * (1 - ease) + bPos.z * ease
          );
        } else {
          this.hintHand.visible = false;
        }
      }
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.stageTimer += dt;

    // Track FPS
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.lastFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    // Smooth camera easing
    this.camera.position.lerp(this.camPos, Math.min(1, dt * 4.2));
    this.camLookCurrent.lerp(this.camTarget, Math.min(1, dt * 4.5));
    this.camera.lookAt(this.camLookCurrent);

    // Stage-specific updates
    if (this.stage === STAGES.WATER_DASHI) {
      // Auto-pour from tolerant tap
      if (this.autoPourTimer > 0) {
        this.autoPourTimer -= dt;
        this.pitcher.group.position.lerp(new THREE.Vector3(-1.22, 1.32, 0.12), Math.min(1, dt * 10));
        this.pitcher.isPouring = this.autoPourTimer > 0.12;
      } else if (this.dragKind !== 'pitcher') {
        this.pitcher.group.position.lerp(this.pitcher.homePos, Math.min(1, dt * 7));
        this.pitcher.isPouring = false;
      }

      if (this.pitcher.isPouring) {
        this.kitchen.targetWaterLevel = Math.min(1.04, this.kitchen.targetWaterLevel + dt * 0.44);
        sound.playWaterPourTick(this.kitchen.waterLevel);
        if (Math.random() < 0.42) {
          this.kitchen.spawnSplash(-0.2 + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 1);
        }
        // Playful extra joyful splash if already brimming full!
        if (this.kitchen.waterLevel > 0.96 && Math.random() < 0.35) {
          this.kitchen.spawnSplash((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 2);
        }
        this._steepDashiAndCheckStage0();
      }

      // Auto dashi hop from tolerant tap
      if (this.autoDashiFly && !this.dashi.dropped) {
        this.autoDashiFly.t += dt * 2.4;
        const t = Math.min(1, this.autoDashiFly.t);
        this.dashi.bundle.position.lerpVectors(
          this.autoDashiFly.start,
          new THREE.Vector3(0, this.kitchen.getLiquidWorldY() + 0.1, 0),
          t
        );
        this.dashi.bundle.position.y += Math.sin(t * Math.PI) * 1.35;
        if (t >= 1) {
          this.autoDashiFly = null;
          this._dropDashiIntoPot();
        }
      } else if (this.dragKind !== 'dashi' && !this.dashi.dropped) {
        this.dashi.bundle.position.lerp(this.dashi.bundleHomePos, Math.min(1, dt * 8));
      }

      // Steep dashi smoothly once BOTH water & dashi are inside
      if (this.dashi.dropped && this.kitchen.waterLevel > 0.25) {
        this.kitchen.dashiLevel = Math.min(1, this.kitchen.dashiLevel + dt * 0.85);
        this._steepDashiAndCheckStage0();
      }

      this.pitcher.update(dt, this.time, this.kitchen.getLiquidWorldY());
      this.dashi.update(dt);
    } else if (this.stage === STAGES.CUT_TOFU) {
      this.tofuStage.update(
        dt,
        this.time,
        this.kitchen,
        (idx) => {
          const pent = [0.85, 0.95, 1.05, 1.18, 1.25, 1.35, 1.48, 1.55, 1.65];
          sound.playSplash(pent[idx % pent.length], 0.18);
        },
        () => {
          if (!this.stageAdvancing) {
            this.stageAdvancing = true;
            sound.playStageComplete();
            setTimeout(() => {
              if (this.stage === STAGES.CUT_TOFU) {
                this._enterStage(STAGES.ADD_WAKAME);
              }
            }, 700);
          }
        }
      );
    } else if (this.stage === STAGES.ADD_WAKAME) {
      this.wakameDish.update(dt, this.time, this.kitchen, () => {
        sound.playSplash(1.12, 0.22);
        const usedCount = this.wakameDish.buds.filter((b) => b.used).length;
        if (usedCount >= 4 && !this.stageAdvancing) {
          this.stageAdvancing = true;
          setTimeout(() => {
            if (this.stage === STAGES.ADD_WAKAME) {
              sound.playStageComplete();
              this._enterStage(STAGES.DISSOLVE_MISO);
            }
          }, 1150);
        }
      });
    } else if (this.stage === STAGES.DISSOLVE_MISO) {
      this.misoLadle.updateTub(dt);
      if (this.autoMisoMove && !this.misoLadle.misoInPot) {
        this.autoMisoMove.t += dt * 2.3;
        const t = Math.min(1, this.autoMisoMove.t);
        const ly = this.kitchen.getLiquidWorldY();
        this.misoLadle.ladleGroup.position.lerpVectors(
          this.autoMisoMove.start,
          new THREE.Vector3(0, ly + 0.04, 0),
          t
        );
        this.misoLadle.ladleGroup.position.y += Math.sin(t * Math.PI) * 0.9;
        if (t >= 1) {
          this.autoMisoMove = null;
          this._seatMisoInPot();
        }
      } else if (!this.misoLadle.misoInPot && this.dragKind !== 'misoLadle') {
        this.misoLadle.ladleGroup.position.lerp(new THREE.Vector3(2.42, 1.1, 0.55), Math.min(1, dt * 8));
      } else if (this.misoLadle.misoInPot) {
        // Gentle stir wobble on wooden chopsticks!
        this.misoLadle.stirrerGroup.rotation.y = Math.sin(this.time * 7) * 0.35;
        this.misoLadle.stirrerGroup.rotation.z = Math.cos(this.time * 6) * 0.14;
      }
    } else if (this.stage === STAGES.SERVE_FAMILY) {
      // Smoothly seat pot onto wooden dining trivet at foreground center!
      const trivetPotPos = new THREE.Vector3(0, 0.08, 1.82);
      this.kitchen.potGroup.position.lerp(trivetPotPos, Math.min(1, dt * 6.5));
      const ts = this.kitchen.trivetGroup.scale.x + (0.84 - this.kitchen.trivetGroup.scale.x) * Math.min(1, dt * 7);
      this.kitchen.trivetGroup.scale.setScalar(ts);
      this.kitchen.heatIntensity = 0.62; // Keep gentle appetizing steam rising on table!

      // Handle ladle carrying & pouring animation into a family member's bowl!
      if (this.autoServeAnim) {
        const a = this.autoServeAnim;
        a.t += dt;
        if (a.phase === 'carry') {
          const p = Math.min(1, a.t / 0.55);
          const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          this.misoLadle.ladleGroup.position.lerpVectors(a.start, a.end, ease);
          this.misoLadle.ladleGroup.position.y += Math.sin(p * Math.PI) * 0.55;
          if (p >= 1) {
            a.phase = 'pour';
            a.t = 0;
          }
        } else if (a.phase === 'pour') {
          const p = Math.min(1, a.t / 0.62);
          this.misoLadle.ladleGroup.position.lerp(a.end, Math.min(1, dt * 12));
          this.misoLadle.ladleGroup.rotation.z = Math.sin(p * Math.PI) * 0.85;
          const bowlCenter = this.family.getBowlWorldPos(a.bowlIdx);
          const ladleTip = this.misoLadle.ladleGroup.position.clone().add(new THREE.Vector3(-0.22, -0.08, 0));
          this.misoLadle.updatePourStream(p > 0.12 && p < 0.85, ladleTip, bowlCenter, this.time);

          if (p > 0.25 && !a.poured) {
            a.poured = true;
            sound.playWaterPourTick(0.65);
            sound.playSplash(1.1, 0.2);
            const member = this.family.members[a.bowlIdx];
            member.receiveSoup(
              () => sound.playBlowSteam(),
              (idx) => sound.playSip(idx === 1 ? 1.25 : idx === 0 ? 0.85 : 1.05),
              (idx) => sound.playFamilyHappy(idx)
            );
          }
          if (p >= 1) {
            this.misoLadle.ladleGroup.rotation.z = 0;
            this.misoLadle.updatePourStream(false);
            a.phase = 'return';
            a.t = 0;
            a.retStart = this.misoLadle.ladleGroup.position.clone();
          }
        } else if (a.phase === 'return') {
          const p = Math.min(1, a.t / 0.48);
          const home = new THREE.Vector3(
            this.kitchen.potGroup.position.x + 0.14,
            this.kitchen.potGroup.position.y + 1.15,
            this.kitchen.potGroup.position.z + 0.05
          );
          this.misoLadle.ladleGroup.position.lerpVectors(a.retStart, home, p);
          if (p >= 1) {
            this.autoServeAnim = null;
          }
        }
      } else if (this.dragKind !== 'serveLadle') {
        const home = new THREE.Vector3(
          this.kitchen.potGroup.position.x + 0.14,
          this.kitchen.potGroup.position.y + 1.15 + Math.sin(this.time * 2.5) * 0.03,
          this.kitchen.potGroup.position.z + 0.05
        );
        this.misoLadle.ladleGroup.position.lerp(home, Math.min(1, dt * 8));
        this.misoLadle.ladleGroup.rotation.z *= Math.exp(-dt * 10);
      }

      this.family.update(dt, this.time);

      // Celebrate once all 3 family members have eaten & smiled!
      if (this.family.allServed() && !this.finaleTriggered) {
        const allHappy = this.family.members.every((m) => m.state === 'happy');
        if (allHappy) {
          this.finaleTriggered = true;
          sound.playFinaleJingle();
        }
      }
      if (this.finaleTriggered) {
        this.finaleTimer += dt;
        if (this.finaleTimer > 1.8) {
          this.family.showReplay = true;
        }
      }
    }

    // Occasional gentle simmering bubble sound while pot is heating
    if (this.kitchen.heatOn && this.kitchen.waterLevel > 0.5) {
      this.simmerSoundTimer -= dt;
      if (this.simmerSoundTimer <= 0) {
        sound.playSimmerBubble();
        this.simmerSoundTimer = 0.45 + Math.random() * 0.65;
      }
    }

    // Update central kitchen (pot, waves, flames, steam, floating tofu & wakame)
    this.kitchen.update(dt, () => {
      sound.playWakameBloom(this.kitchen.floatingWakame.length);
    });

    this._updateIdleHint(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _exposeDebug() {
    // Clean read/test hook (invisible to players; helps verify every stage, FPS, and triangle budget!)
    window.__GAME_DEBUG__ = {
      getStats: () => ({
        stage: this.stage,
        fps: this.lastFps,
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
        pixelRatio: this.renderer.getPixelRatio(),
        waterLevel: this.kitchen.waterLevel,
        dashiLevel: this.kitchen.dashiLevel,
        misoLevel: this.kitchen.misoLevel,
        tofuCuts: this.tofuStage.totalCuts,
        wakameCount: this.kitchen.floatingWakame.length,
        servedCount: this.family.members.filter((m) => m.serveCount > 0).length,
      }),
      jumpToStage: (stageName) => {
        if (stageName === STAGES.WATER_DASHI) {
          this._restartNewRound();
        } else if (stageName === STAGES.CUT_TOFU) {
          this.kitchen.waterLevel = 1.0;
          this.kitchen.targetWaterLevel = 1.0;
          this.kitchen.dashiLevel = 1.0;
          this.kitchen.heatOn = true;
          this.kitchen.heatIntensity = 1.0;
          this.dashi.dropped = true;
          this._enterStage(STAGES.CUT_TOFU);
        } else if (stageName === STAGES.ADD_WAKAME) {
          this.kitchen.waterLevel = 1.0;
          this.kitchen.targetWaterLevel = 1.0;
          this.kitchen.dashiLevel = 1.0;
          this.kitchen.heatOn = true;
          this.kitchen.heatIntensity = 1.0;
          if (this.kitchen.floatingTofu.length === 0) {
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              this.kitchen.addFloatingTofu(
                this.tofuStage.cubes[i].mesh.clone(),
                Math.cos(a) * 0.55,
                Math.sin(a) * 0.55
              );
            }
          }
          this._enterStage(STAGES.ADD_WAKAME);
        } else if (stageName === STAGES.DISSOLVE_MISO) {
          window.__GAME_DEBUG__.jumpToStage(STAGES.ADD_WAKAME);
          if (this.kitchen.floatingWakame.length === 0) {
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * Math.PI * 2 + 0.4;
              const w = this.kitchen.addFloatingWakame(
                this.misoLadle.ladleSoupGroup.children[3].clone(),
                Math.cos(a) * 0.5,
                Math.sin(a) * 0.5
              );
              w.bloom = 1;
              w.bloomDelay = 0;
            }
          }
          this._enterStage(STAGES.DISSOLVE_MISO);
        } else if (stageName === STAGES.SERVE_FAMILY) {
          window.__GAME_DEBUG__.jumpToStage(STAGES.DISSOLVE_MISO);
          this.kitchen.misoLevel = 1.0;
          this._enterStage(STAGES.SERVE_FAMILY);
        }
      },
      serveAllNow: () => {
        this.family.members.forEach((m) => {
          m.receiveSoup();
          m.state = 'happy';
          m.soupFill = 1.0;
          m.targetSoupFill = 1.0;
        });
        this.finaleTriggered = true;
        this.family.showReplay = true;
      },
      cutHalfTofu: () => {
        this.tofuStage.performNextCut(0, 1);
        setTimeout(() => this.tofuStage.performNextCut(0, 1), 360);
        setTimeout(() => this.tofuStage.performNextCut(1, 0), 720);
      },
      seatMisoHalf: () => {
        this._seatMisoInPot();
        this._applyMisoDissolve(0.45, 0.25, 0.2);
      },
      snapCamera: () => {
        this._updateCameraGoals();
        this.camera.position.copy(this.camPos);
        this.camLookCurrent.copy(this.camTarget);
        this.camera.lookAt(this.camLookCurrent);
        if (this.stage === STAGES.ADD_WAKAME) {
          this.wakameDish.group.scale.setScalar(1);
        }
        if (this.stage === STAGES.DISSOLVE_MISO) {
          this.misoLadle.tubGroup.scale.setScalar(1);
        }
        if (this.stage === STAGES.SERVE_FAMILY) {
          this.kitchen.potGroup.position.set(0, 0.08, 1.82);
          this.kitchen.trivetGroup.scale.setScalar(0.84);
          this.family.enterProgress = 1;
          this.family.group.position.y = 0;
        }
        if (this.stage === STAGES.CUT_TOFU) {
          this.tofuStage.handGroup.position.set(-0.12, 1.96, 0.35);
        }
      },
      stepFrames: (n = 12, dt = 0.033) => {
        for (let i = 0; i < n; i++) {
          this.time += dt;
          this.kitchen.update(dt);
          if (this.stage === STAGES.SERVE_FAMILY) this.family.update(dt, this.time);
          if (this.stage === STAGES.ADD_WAKAME) this.wakameDish.update(dt, this.time, this.kitchen);
          if (this.stage === STAGES.DISSOLVE_MISO) this.misoLadle.updateTub(dt);
        }
      },
      captureFrame: (w = 640, h = 480, q = 0.82) => {
        this.renderer.render(this.scene, this.camera);
        const tmp = document.createElement('canvas');
        tmp.width = w;
        tmp.height = h;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(this.canvas, 0, 0, w, h);
        return tmp.toDataURL('image/jpeg', q);
      },
    };
  }
}

new MisoSoupGame();
