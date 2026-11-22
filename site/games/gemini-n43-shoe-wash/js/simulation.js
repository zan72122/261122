import * as THREE from 'three';
import {
  buildSummerSky,
  buildVeranda,
  buildUwabakiShoe,
  buildBucket,
  buildSoapBar,
  buildScrubBrush,
  buildChildHand
} from './models.js';
import {
  createVerandaConcreteTextures,
  createCanvasWeaveMaps,
  createDynamicUwabakiSurface,
  createWoodTextures,
  createSkinTextures,
  createFoamBumpTexture,
  createWallStuccoTexture,
  createNeighborhoodBackdropTexture,
  createBotanicalLeafTexture
} from './textures.js';

export const STAGES = {
  LATHER: 'LATHER',
  SCRUB: 'SCRUB',
  RINSE: 'RINSE',
  DRY: 'DRY'
};

const BAND_COLORS = [0xd9363c, 0xe85a90, 0x2f88e3, 0xe6ad1e];

export class ShoeWashSimulation {
  constructor(scene, camera, audio) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;

    this.time = 0;
    this.stage = STAGES.LATHER;
    this.roundIndex = 0;
    this.activeShoeIndex = 0; // 0 = left shoe, 1 = right shoe

    // Interaction state (strictly single-finger safe)
    this.activePointerId = null;
    this.pointerNDC = new THREE.Vector2();
    this.prevPointerNDC = new THREE.Vector2();
    this.pointerSpeed = 0;
    this.isPointerDown = false;
    this.dragTarget = null; // 'bucket' | 'shoe' | 'rinse' | 'hangShoe'
    this.draggedHangIdx = -1;
    this.idleSeconds = 0;
    this.hintPhase = 0;

    // Physical simulation variables
    this.foamLevel = 0.0; // 0..1.65 (1.0 = full mound, >1.0 = overflow onto floor!)
    this.swirlAngle = 0;
    this.swirlVelocity = 0;
    this.swirlTargetXZ = new THREE.Vector2(0, 0);
    this.scrubEnergy = 0;
    this.scrubPhase = 0;
    this.scrubPosLocal = new THREE.Vector2(0, 0);
    this.shoeRotatePhase = 0;
    this.faucetFlow = 0;
    this.rinsingHit = 0;
    this.rinseOffset = new THREE.Vector2(0.18, 0.0);
    this.rainbowOpacity = 0;

    // Drying state
    this.hung = [false, false];
    this.dryProgress = 0;
    this.dryCompleteCelebrated = false;
    this.hangerSwing = 0;
    this.hangerSwingVel = 0;
    this.nextPairReady = false;
    this.nextPairRise = 0;

    // Wind chime physics
    this.chimeSwingX = 0;
    this.chimeSwingZ = 0;
    this.chimeVelX = 0;
    this.chimeVelZ = 0;
    this.nextBreezeTime = 4.5;

    // Camera animation targets (responsive for both portrait & landscape)
    this.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camPosCurrent = new THREE.Vector3(0.06, 0.92, 1.18);
    this.camLookCurrent = new THREE.Vector3(0.0, 0.28, -0.10);
    this.camPosTarget = this.camPosCurrent.clone();
    this.camLookTarget = this.camLookCurrent.clone();

    // Raycaster & scratch math
    this.raycaster = new THREE.Raycaster();
    this.tmpVec3 = new THREE.Vector3();
    this.tmpVec3B = new THREE.Vector3();
    this.tmpMat4 = new THREE.Matrix4();
    this.tmpDummy = new THREE.Object3D();
    this.workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.32);

    this.sunDir = new THREE.Vector3(0.55, 0.72, -0.42).normalize();

    this._buildWorld();
    this._buildParticles();
    this._buildRainbowMist();
    this._updateCameraTargets();
    this.camPosCurrent.copy(this.camPosTarget);
    this.camLookCurrent.copy(this.camLookTarget);
  }

  _buildWorld() {
    // 1. Procedural textures (all <= 1024px)
    this.textures = {
      concrete: createVerandaConcreteTextures(),
      weave: createCanvasWeaveMaps(),
      wood: createWoodTextures(),
      skin: createSkinTextures(),
      foamBump: createFoamBumpTexture(),
      stucco: createWallStuccoTexture(),
      backdrop: createNeighborhoodBackdropTexture(),
      leaf: createBotanicalLeafTexture()
    };

    // 2. Summer sky dome
    this.sky = buildSummerSky(this.sunDir);
    this.scene.add(this.sky.mesh);

    // 3. Veranda architecture, faucet, laundry pole, shoe hanger, glass wind chime
    this.veranda = buildVeranda(this.textures);
    this.scene.add(this.veranda.group);

    // 4. Translucent blue bucket + interactive water + billowing 3D foam mound
    this.bucket = buildBucket(this.textures.foamBump);
    this.bucketPos = new THREE.Vector3(-0.24, 0, 0.04);
    this.bucket.group.position.copy(this.bucketPos);
    this.scene.add(this.bucket.group);

    // 5. Classic Japanese laundry soap bar (bobbing in/on bucket in Stage 1)
    this.soapBar = buildSoapBar();
    this.soapBar.group.position.set(this.bucketPos.x + 0.03, 0.285, this.bucketPos.z + 0.02);
    this.scene.add(this.soapBar.group);

    // 6. Pair of Photorealistic Uwabaki Shoes (Left & Right)
    this.shoes = [];
    const bandHex = BAND_COLORS[0];
    for (let i = 0; i < 2; i++) {
      const surface = createDynamicUwabakiSurface(i + 1);
      const shoe = buildUwabakiShoe({
        side: i === 0 ? 'left' : 'right',
        bandColor: bandHex,
        surface,
        weaveBumpMap: this.textures.weave.bumpMap,
        foamBumpMap: this.textures.foamBump
      });
      shoe.index = i;
      shoe.restPos = new THREE.Vector3(0.28 + i * 0.20, 0.0, 0.08 - i * 0.06);
      shoe.restRot = new THREE.Euler(0, -0.35 + i * 0.22, 0);
      shoe.root.position.copy(shoe.restPos);
      shoe.root.rotation.copy(shoe.restRot);
      shoe.cleanDone = false;
      shoe.rinseDone = false;
      shoe.wobble = 0;
      this.scene.add(shoe.root);
      this.shoes.push(shoe);
    }

    // 7. Beechwood Uwabaki Scrub Brush
    this.brush = buildScrubBrush(this.textures.wood);
    this.brushRestPos = new THREE.Vector3(0.42, 0.042, 0.34);
    this.brush.group.position.copy(this.brushRestPos);
    this.brush.group.rotation.set(0, -0.95, 0);
    this.scene.add(this.brush.group);

    // 8. Big, expressive foreground child hands
    this.leftHand = buildChildHand('left', this.textures.skin);
    this.rightHand = buildChildHand('right', this.textures.skin);
    this.leftHand.root.position.set(-0.34, 0.36, 0.62);
    this.rightHand.root.position.set(0.28, 0.38, 0.58);
    this.scene.add(this.leftHand.root);
    this.scene.add(this.rightHand.root);

    // 9. Fresh "Next Round" muddy mini-prompt pair waiting off-screen until sun-drying completes
    this.nextPairGroup = new THREE.Group();
    this.nextPairGroup.visible = false;
    const nextSurf = createDynamicUwabakiSurface(9);
    for (let i = 0; i < 2; i++) {
      const s = buildUwabakiShoe({
        side: i === 0 ? 'left' : 'right',
        bandColor: BAND_COLORS[1],
        surface: nextSurf,
        weaveBumpMap: this.textures.weave.bumpMap,
        foamBumpMap: this.textures.foamBump
      });
      s.root.position.set((i - 0.5) * 0.19, 0, 0);
      s.root.rotation.y = (i === 0 ? 0.14 : -0.14);
      this.nextPairGroup.add(s.root);
      if (i === 0) this.nextPairShoes = [];
      this.nextPairShoes.push(s);
    }
    this.nextPairGroup.position.set(0.06, 0.0, 0.36);
    this.scene.add(this.nextPairGroup);
  }

  _buildParticles() {
    // A. Sunlit Crystal-Clear Sparkling Water Droplets (high-shutter photographic specular sheen!)
    this.dropCount = 140;
    const dropGeo = new THREE.SphereGeometry(0.0075, 8, 6);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff5ff,
      roughness: 0.03,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.62
    });
    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, this.dropCount);
    this.dropMesh.frustumCulled = false;
    this.scene.add(this.dropMesh);

    this.drops = [];
    for (let i = 0; i < this.dropCount; i++) {
      this.drops.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        isFoam: false
      });
      this.tmpDummy.scale.setScalar(0.0001);
      this.tmpDummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this.tmpDummy.matrix);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;

    // B. Drifting Iridescent Rainbow Soap Bubbles (tappable to pop!)
    this.bubbleCount = 16;
    const bubbleGeo = new THREE.SphereGeometry(0.036, 18, 14);
    this.bubbleMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: this.sunDir }
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vec3 N = normalize(vNormalW);
          vec3 V = normalize(vViewDir);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = pow(1.0 - ndv, 2.3);
          // Thin-film soap iridescence rainbow swirl
          float phase = ndv * 8.5 + uTime * 1.4 + N.y * 3.0;
          vec3 irid = 0.55 + 0.45 * cos(phase + vec3(0.0, 2.09, 4.18));
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 80.0);
          vec3 col = mix(vec3(0.85, 0.96, 1.0), irid, 0.65) + vec3(1.0) * spec * 1.8;
          float alpha = clamp(0.14 + fresnel * 0.72 + spec * 0.85, 0.0, 0.95);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    this.bubbles = [];
    for (let i = 0; i < this.bubbleCount; i++) {
      const m = new THREE.Mesh(bubbleGeo, this.bubbleMat);
      m.visible = false;
      m.name = 'soapBubble';
      m.userData.bubbleIdx = i;
      this.scene.add(m);
      this.bubbles.push({
        mesh: m,
        active: false,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 6,
        radius: 1,
        wobblePhase: Math.random() * Math.PI * 2
      });
    }

    // C. Realistic Specular Sun-Glint Sparkles on Sparkling Clean White Shoes!
    this.glintCount = 12;
    const glintCanvas = document.createElement('canvas');
    glintCanvas.width = 64;
    glintCanvas.height = 64;
    const gCtx = glintCanvas.getContext('2d');
    const grad = gCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,252,235,0.85)');
    grad.addColorStop(0.6, 'rgba(255,245,210,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 64, 64);
    // Crisp 4-point optical lens flare cross
    gCtx.strokeStyle = 'rgba(255,255,255,0.92)';
    gCtx.lineWidth = 2.5;
    gCtx.beginPath();
    gCtx.moveTo(32, 2);
    gCtx.lineTo(32, 62);
    gCtx.moveTo(2, 32);
    gCtx.lineTo(62, 32);
    gCtx.stroke();

    const glintTex = new THREE.CanvasTexture(glintCanvas);
    const glintMat = new THREE.SpriteMaterial({
      map: glintTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0
    });
    this.glints = [];
    for (let i = 0; i < this.glintCount; i++) {
      const sp = new THREE.Sprite(glintMat.clone());
      sp.scale.set(0.08, 0.08, 1);
      sp.visible = false;
      this.scene.add(sp);
      this.glints.push({
        sprite: sp,
        age: 0,
        maxAge: 0.7,
        active: false
      });
    }
  }

  _buildRainbowMist() {
    // Subtle physical sunlit water-spray optical rainbow arc appearing when splashing hard in Stage 3!
    const geo = new THREE.PlaneGeometry(0.75, 0.42);
    this.rainbowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.0 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          if (uOpacity < 0.01) discard;
          vec2 p = (vUv - vec2(0.5, 0.1)) * vec2(1.0, 1.35);
          float r = length(p);
          float band = smoothstep(0.28, 0.36, r) * (1.0 - smoothstep(0.46, 0.56, r));
          float t = clamp((r - 0.30) / 0.22, 0.0, 1.0);
          // Delicate physical sunlit water-mist spectral rainbow (subtle, airy, never neon!)
          vec3 col = 0.52 + 0.48 * cos(6.28318 * (t * 0.85 + vec3(0.0, 0.33, 0.67)));
          float edgeFade = smoothstep(0.0, 0.28, vUv.y) * (1.0 - abs(vUv.x - 0.5) * 1.45);
          float alpha = band * max(0.0, edgeFade) * uOpacity * 0.21;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
    this.rainbowMesh = new THREE.Mesh(geo, this.rainbowMat);
    this.rainbowMesh.position.set(-0.22, 0.46, -0.18);
    this.rainbowMesh.rotation.y = 0.2;
    this.scene.add(this.rainbowMesh);
  }

  spawnSplash(origin, count = 8, speed = 1.2, foamRatio = 0.25) {
    let spawned = 0;
    for (let i = 0; i < this.dropCount && spawned < count; i++) {
      const d = this.drops[i];
      if (d.active) continue;
      d.active = true;
      d.pos.copy(origin);
      d.pos.x += (Math.random() - 0.5) * 0.08;
      d.pos.y += (Math.random() - 0.5) * 0.04;
      d.pos.z += (Math.random() - 0.5) * 0.08;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      d.vel.set(Math.cos(ang) * spd, (0.55 + Math.random() * 0.85) * speed, Math.sin(ang) * spd);
      d.life = 0;
      d.maxLife = 0.45 + Math.random() * 0.45;
      d.isFoam = Math.random() < foamRatio;
      d.size = d.isFoam ? 1.15 + Math.random() * 0.95 : 0.65 + Math.random() * 0.85;
      spawned++;
    }
  }

  spawnFloatingBubble(origin) {
    for (let i = 0; i < this.bubbleCount; i++) {
      const b = this.bubbles[i];
      if (b.active) continue;
      b.active = true;
      b.age = 0;
      b.maxAge = 5.5 + Math.random() * 3.5;
      b.radius = 0.65 + Math.random() * 0.95;
      b.mesh.position.copy(origin);
      b.mesh.position.x += (Math.random() - 0.5) * 0.16;
      b.mesh.position.z += (Math.random() - 0.5) * 0.16;
      b.mesh.scale.setScalar(0.01);
      b.mesh.visible = true;
      b.vel.set((Math.random() - 0.5) * 0.16, 0.20 + Math.random() * 0.18, (Math.random() - 0.5) * 0.10 - 0.05);
      return;
    }
  }

  spawnGlint(worldPos) {
    for (let i = 0; i < this.glintCount; i++) {
      const g = this.glints[i];
      if (g.active) continue;
      g.active = true;
      g.age = 0;
      g.maxAge = 0.55 + Math.random() * 0.35;
      g.sprite.position.copy(worldPos);
      g.sprite.position.x += (Math.random() - 0.5) * 0.16;
      g.sprite.position.y += (Math.random() - 0.5) * 0.10;
      g.sprite.position.z += (Math.random() - 0.5) * 0.14;
      g.sprite.visible = true;
      return;
    }
  }

  wetConcreteAt(worldX, worldZ, radius = 0.035, strength = 0.45) {
    // Map veranda floor world coords (width 5.6, depth 3.6, centered at z=-0.15) to UV
    const u = (worldX / 5.6) + 0.5;
    const v = 0.5 - ((worldZ + 0.15) / 3.6);
    if (u >= 0.02 && u <= 0.98 && v >= 0.02 && v <= 0.98) {
      this.textures.concrete.addWetSplash(u, v, radius, strength);
    }
  }

  setAspect(aspect) {
    this.aspect = aspect;
    this._updateCameraTargets();
  }

  _updateCameraTargets() {
    // Wide-angle lens framing adapted cleanly for both iPhone portrait and iPad/desktop landscape!
    const isPortrait = this.aspect < 0.85;
    const distBoost = isPortrait ? 0.34 : 0.0;

    if (this.stage === STAGES.LATHER) {
      // Dramatic wide-angle child's-eye view: HUGE foreground hands, bucket & muddy shoes with soaring blue summer sky above!
      this.camPosTarget.set(0.05, 0.58 + distBoost * 0.16, 0.94 + distBoost);
      this.camLookTarget.set(0.03, 0.38, -0.22);
    } else if (this.stage === STAGES.SCRUB) {
      // Wide-angle close-up: muddy shoe held HUGE in foreground hands, foamy bucket & bright veranda sky soaring behind!
      this.camPosTarget.set(0.06, 0.62 + distBoost * 0.16, 0.92 + distBoost);
      this.camLookTarget.set(0.02, 0.48, -0.10);
    } else if (this.stage === STAGES.RINSE) {
      // Wide-angle faucet waterfall + foaming shoe held big in hands + glistening bucket + summer sky!
      this.camPosTarget.set(-0.04, 0.62 + distBoost * 0.16, 0.94 + distBoost);
      this.camLookTarget.set(-0.20, 0.47, -0.18);
    } else if (this.stage === STAGES.DRY) {
      // Wide-angle tilt UPWARD toward dazzling blue summer sky, cumulonimbus clouds, shoe hanger & Edo wind chime!
      this.camPosTarget.set(0.06, 0.78 + distBoost * 0.16, 1.04 + distBoost * 1.15);
      this.camLookTarget.set(0.08, 1.06, -0.62);
    }
  }

  setStage(nextStage) {
    this.stage = nextStage;
    this.idleSeconds = 0;
    this.dragTarget = null;
    this.draggedHangIdx = -1;

    if (nextStage === STAGES.LATHER) {
      this.activeShoeIndex = 0;
      this.foamLevel = 0.05;
      this.faucetFlow = 0;
      this.hung = [false, false];
      this.dryProgress = 0;
      this.dryCompleteCelebrated = false;
      this.nextPairReady = false;
      this.nextPairGroup.visible = false;
      this.soapBar.group.visible = true;
      for (const s of this.shoes) {
        s.cleanDone = false;
        s.rinseDone = false;
        s.surface.resetMud(1.0);
        s.surface.updateTexture();
        s.setWetAppearance(0);
        s.puffAnchors.forEach((p) => (p.level = 0));
        s.updateShoeFoam(0);
        s.root.scale.setScalar(1);
      }
    } else if (nextStage === STAGES.SCRUB) {
      this.activeShoeIndex = 0;
      this.faucetFlow = 0;
      this.soapBar.group.visible = false;
      this.brush.brushFoam.visible = true;
      this.audio.playSparkleChime(false);
    } else if (nextStage === STAGES.RINSE) {
      this.activeShoeIndex = 0;
      this.faucetFlow = 1.0;
      this.soapBar.group.visible = false;
      this.veranda.waterStream.visible = true;
      this.rinseOffset.set(0.18, 0.02);
      // Ensure shoes have nice visible white foam to rinse off if jumped directly in debug
      for (const s of this.shoes) {
        s.rinseDone = false;
        if (s.surface.getStats().foamAvg < 0.25) {
          s.surface.wetAll(0.7, 0.65);
          s.surface.updateTexture();
          s.puffAnchors.forEach((p) => (p.level = 0.75));
          s.updateShoeFoam(0);
        }
      }
      this.audio.playSparkleChime(false);
    } else if (nextStage === STAGES.DRY) {
      this.faucetFlow = 0;
      this.soapBar.group.visible = false;
      this.hung = [false, false];
      this.dryProgress = 0;
      this.dryCompleteCelebrated = false;
      this.nextPairReady = false;
      this.nextPairRise = 0;
      this.nextPairGroup.visible = false;
      this.audio.playSparkleChime(false);
      // Prepare fresh muddy color pair for replay
      const nextColor = BAND_COLORS[(this.roundIndex + 1) % BAND_COLORS.length];
      this.nextPairShoes.forEach((s) => s.setBandColor(nextColor));
    }

    this._updateCameraTargets();
  }

  _startNextRound() {
    this.roundIndex++;
    const bandHex = BAND_COLORS[this.roundIndex % BAND_COLORS.length];
    this.shoes.forEach((s) => s.setBandColor(bandHex));
    this.audio.playSplash(0.8);
    this.setStage(STAGES.LATHER);
  }

  // --- Pointer Input (strictly single-finger safe, generous hit detection) ---
  onPointerDown(clientX, clientY, pointerId, rect) {
    this.audio.unlock();
    if (this.activePointerId !== null && this.activePointerId !== pointerId) return;
    this.activePointerId = pointerId;
    this.isPointerDown = true;
    this.idleSeconds = 0;

    this._setNDC(clientX, clientY, rect);
    this.prevPointerNDC.copy(this.pointerNDC);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // 1. Always check interactive drifting soap bubbles first!
    const activeBubbleMeshes = this.bubbles.filter((b) => b.active).map((b) => b.mesh);
    if (activeBubbleMeshes.length > 0) {
      const bHits = this.raycaster.intersectObjects(activeBubbleMeshes, false);
      if (bHits.length > 0) {
        const idx = bHits[0].object.userData.bubbleIdx;
        const b = this.bubbles[idx];
        b.active = false;
        b.mesh.visible = false;
        this.audio.playBubblePop(1.25);
        this.spawnSplash(b.mesh.position, 6, 0.7, 0.5);
        this.spawnGlint(b.mesh.position);
        return;
      }
    }

    // 2. Always check Edo glass wind chime (風鈴) tap!
    const chimeHits = this.raycaster.intersectObject(this.veranda.chimeHit, false);
    if (chimeHits.length > 0) {
      this.chimeVelZ += (Math.random() > 0.5 ? 1 : -1) * 4.5;
      this.chimeVelX += (Math.random() - 0.5) * 3.0;
      this.audio.playWindChime(1.0);
      this.spawnGlint(this.veranda.bellMesh.getWorldPosition(this.tmpVec3));
      return;
    }

    // 3. Stage-specific primary interactions
    if (this.stage === STAGES.LATHER) {
      // Check if tapping bucket/water/soap
      const bucketHit = this.raycaster.intersectObjects(
        [this.bucket.hitProxy, this.soapBar.bar],
        false
      );
      if (bucketHit.length > 0) {
        this.dragTarget = 'bucket';
        this.audio.playSplash(0.55);
        this.spawnSplash(
          new THREE.Vector3(this.bucketPos.x, 0.32, this.bucketPos.z),
          6,
          0.95,
          this.foamLevel > 0.25 ? 0.5 : 0.1
        );
        return;
      }

      // Check if tapping waiting muddy shoes (if foam is already rich, advance to SCRUB; else gentle wobble!)
      const shoeHit = this.raycaster.intersectObjects(this.shoes.map((s) => s.hitProxy), false);
      if (shoeHit.length > 0) {
        if (this.foamLevel >= 0.65) {
          this.setStage(STAGES.SCRUB);
        } else {
          // Gentle wobble feedback: "make bubbles in the bucket first!"
          this.shoes.forEach((s) => (s.wobble = 1.0));
          this.audio.playBubblePop(0.75);
        }
        return;
      }

      // Generous fallback: touching anywhere near lower-left/center starts swirling bucket
      if (this.pointerNDC.y < 0.25) {
        this.dragTarget = 'bucket';
        this.audio.playSplash(0.45);
      }
    } else if (this.stage === STAGES.SCRUB) {
      // Check active held shoe FIRST so touching the shoe ALWAYS scrubs even when bucket sits behind it!
      const activeShoe = this.shoes[this.activeShoeIndex];
      const sHit = activeShoe ? this.raycaster.intersectObject(activeShoe.hitProxy, false) : [];
      if (sHit.length === 0) {
        const bHit = this.raycaster.intersectObject(this.bucket.hitProxy, false);
        if (bHit.length > 0 && this.pointerNDC.x < -0.22) {
          this.audio.playSplash(0.7);
          this.spawnSplash(new THREE.Vector3(this.bucketPos.x, 0.34, this.bucketPos.z), 10, 1.1, 0.65);
          this.spawnFloatingBubble(new THREE.Vector3(this.bucketPos.x, 0.42, this.bucketPos.z));
          this.brush.brushFoam.visible = true;
          return;
        }
      }
      // Scrubbing the held shoe (generous area across the shoe foreground!)
      this.dragTarget = 'shoe';
      this._applyScrubInput(0.06);
    } else if (this.stage === STAGES.RINSE) {
      this.dragTarget = 'rinse';
      this._updateRinsePositionFromPointer();
    } else if (this.stage === STAGES.DRY) {
      // Check fresh muddy shoes replay trigger if drying finished
      if (this.nextPairReady) {
        const nextHits = this.raycaster.intersectObjects(
          this.nextPairShoes.map((s) => s.hitProxy),
          false
        );
        if (nextHits.length > 0) {
          this._startNextRound();
          return;
        }
      }

      // Check grabbing an unhung clean shoe to drag up to the hanger!
      for (let i = 0; i < 2; i++) {
        if (this.hung[i]) continue;
        const h = this.raycaster.intersectObject(this.shoes[i].hitProxy, false);
        if (h.length > 0) {
          this.dragTarget = 'hangShoe';
          this.draggedHangIdx = i;
          this.audio.playBubblePop(1.1);
          return;
        }
      }

      // Generous grab: if touching lower half of screen and a shoe is still unhung, grab the closest unhung shoe!
      if (this.pointerNDC.y < 0.15) {
        const unhungIdx = this.hung[0] ? (this.hung[1] ? -1 : 1) : 0;
        if (unhungIdx !== -1) {
          this.dragTarget = 'hangShoe';
          this.draggedHangIdx = unhungIdx;
          this.audio.playBubblePop(1.1);
          return;
        }
      }

      // Tapping/swiping hung drying shoes makes them swing happily with dripping water drops!
      if (this.hung[0] || this.hung[1]) {
        const hungHits = this.raycaster.intersectObjects(
          this.shoes.filter((_, idx) => this.hung[idx]).map((s) => s.hitProxy),
          false
        );
        if (hungHits.length > 0 || this.pointerNDC.y > -0.1) {
          this.hangerSwingVel += (this.pointerNDC.x >= 0 ? 1 : -1) * 2.8;
          this.audio.playClipSnap();
          if (this.dryProgress < 0.85) {
            this.spawnSplash(this.veranda.hangerPivot.position.clone().add(new THREE.Vector3(0, -0.35, 0)), 7, 0.8, 0.05);
            this.audio.playDrip();
          } else {
            this.spawnGlint(this.veranda.hangerPivot.position.clone().add(new THREE.Vector3(0, -0.25, 0.1)));
            this.audio.playSparkleChime(false);
          }
        }
      }
    }
  }

  onPointerMove(clientX, clientY, pointerId, rect) {
    if (!this.isPointerDown || this.activePointerId !== pointerId) return;
    this.idleSeconds = 0;

    this.prevPointerNDC.copy(this.pointerNDC);
    this._setNDC(clientX, clientY, rect);
    const dx = this.pointerNDC.x - this.prevPointerNDC.x;
    const dy = this.pointerNDC.y - this.prevPointerNDC.y;
    const dist = Math.hypot(dx, dy);
    this.pointerSpeed = Math.min(2.5, this.pointerSpeed * 0.55 + dist * 24);

    if (this.stage === STAGES.LATHER && this.dragTarget === 'bucket') {
      // Swirl water & build giant mountain of soap foam!
      const moveAmt = dist * 2.8;
      this.swirlVelocity = Math.min(14, this.swirlVelocity + moveAmt * 22);
      this.foamLevel = Math.min(1.65, this.foamLevel + moveAmt * 0.24);

      // Update hand swirl target on bucket water plane
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      this.workPlane.constant = -0.32;
      if (this.raycaster.ray.intersectPlane(this.workPlane, this.tmpVec3)) {
        const lx = THREE.MathUtils.clamp(this.tmpVec3.x - this.bucketPos.x, -0.15, 0.15);
        const lz = THREE.MathUtils.clamp(this.tmpVec3.z - this.bucketPos.z, -0.15, 0.15);
        this.swirlTargetXZ.set(lx, lz);
      }

      if (Math.random() < dist * 16) {
        const splashOrigin = new THREE.Vector3(
          this.bucketPos.x + this.swirlTargetXZ.x,
          0.32 + Math.min(0.12, this.foamLevel * 0.08),
          this.bucketPos.z + this.swirlTargetXZ.y
        );
        this.spawnSplash(splashOrigin, 3, 0.85 + Math.min(0.6, dist * 8), this.foamLevel > 0.25 ? 0.55 : 0.12);
        if (Math.random() < 0.35) this.audio.playBubblePop(0.85 + this.foamLevel * 0.45);
      }
      if (this.foamLevel > 0.55 && Math.random() < dist * 2.5) {
        this.spawnFloatingBubble(new THREE.Vector3(this.bucketPos.x, 0.42, this.bucketPos.z));
      }
    } else if (this.stage === STAGES.SCRUB && this.dragTarget === 'shoe') {
      this._applyScrubInput(dist);
    } else if (this.stage === STAGES.RINSE && this.dragTarget === 'rinse') {
      this._updateRinsePositionFromPointer();
    } else if (this.stage === STAGES.DRY && this.dragTarget === 'hangShoe' && this.draggedHangIdx !== -1) {
      // Check magnetic snap to open hanger slot when dragged upward!
      const shoe = this.shoes[this.draggedHangIdx];
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      // Project onto tilted vertical plane between foreground & hanger
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.35);
      if (this.raycaster.ray.intersectPlane(plane, this.tmpVec3)) {
        shoe.root.position.lerp(
          new THREE.Vector3(
            THREE.MathUtils.clamp(this.tmpVec3.x, -0.7, 0.7),
            THREE.MathUtils.clamp(this.tmpVec3.y, 0.28, 1.45),
            THREE.MathUtils.lerp(0.22, -0.54, THREE.MathUtils.clamp((this.tmpVec3.y - 0.35) / 0.85, 0, 1))
          ),
          0.42
        );
        shoe.root.rotation.x = THREE.MathUtils.lerp(shoe.root.rotation.x, 0.35, 0.2);

        // Generous magnetic snap if dragged into upper half near hanger!
        const slot = this.veranda.hangerSlots[this.draggedHangIdx];
        const slotWorld = slot.getWorldPosition(this.tmpVec3B);
        if (shoe.root.position.distanceTo(slotWorld) < 0.38 || this.pointerNDC.y > 0.18) {
          this._snapShoeToHanger(this.draggedHangIdx);
        }
      }
    }
  }

  onPointerUp(pointerId) {
    if (this.activePointerId !== pointerId) return;
    this.activePointerId = null;
    this.isPointerDown = false;

    // In LATHER stage: if foam is rich (>= 0.92) when finger lifts, smoothly proceed to SCRUB!
    if (this.stage === STAGES.LATHER && this.dragTarget === 'bucket' && this.foamLevel >= 0.92) {
      this.setStage(STAGES.SCRUB);
    }

    // In DRY stage: if a shoe was dragged pretty high up when released, helpfully snap it onto hanger!
    if (this.stage === STAGES.DRY && this.dragTarget === 'hangShoe' && this.draggedHangIdx !== -1) {
      if (this.pointerNDC.y > 0.0) {
        this._snapShoeToHanger(this.draggedHangIdx);
      }
    }

    this.dragTarget = null;
    this.draggedHangIdx = -1;
  }

  _setNDC(clientX, clientY, rect) {
    this.pointerNDC.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  _applyScrubInput(moveDist) {
    const shoe = this.shoes[this.activeShoeIndex];
    if (!shoe || shoe.cleanDone) return;

    this.scrubEnergy = Math.min(1.5, this.scrubEnergy + moveDist * 9.5);
    this.scrubPhase += moveDist * 26;
    this.scrubPosLocal.x = THREE.MathUtils.clamp(this.pointerNDC.x * 0.24, -0.14, 0.14);
    this.scrubPosLocal.y = THREE.MathUtils.clamp(this.pointerNDC.y * 0.18, -0.10, 0.12);

    // Map pointer position onto the shoe's UV & scrub away mud, wet fabric, build white suds!
    const u = (0.5 + this.pointerNDC.x * 0.65 + this.shoeRotatePhase * 0.18) % 1.0;
    const uClean = u < 0 ? u + 1 : u;
    const v = THREE.MathUtils.clamp(0.5 + this.pointerNDC.y * 0.7, 0.15, 0.85);

    const power = Math.min(0.24, 0.05 + moveDist * 1.45);
    shoe.surface.scrubAt(uClean, v, 0.44, power, power * 1.45);
    // Generously spread lather & cleaning across shoe wrap/edges so a 5-year-old never gets stuck on unreachable UV corners!
    shoe.surface.scrubAt((uClean + 0.5) % 1.0, 1.0 - v, 0.46, power * 0.52, power * 0.85);
    shoe.surface.scrubAt(0.5, 0.5, 1.05, power * 0.16, power * 0.22);
    shoe.surface.updateTexture();

    // Grow 3D foam puffs on the scrubbed shoe!
    for (let i = 0; i < shoe.puffAnchors.length; i++) {
      const p = shoe.puffAnchors[i];
      if (Math.random() < 0.28 + moveDist * 2.8) {
        p.level = Math.min(1.05, p.level + 0.16 + moveDist * 1.6);
      }
    }
    shoe.updateShoeFoam(0);

    // Rotate shoe gently as she scrubs so all sides shine clean
    this.shoeRotatePhase += moveDist * 1.65;

    // Fly sunlit water droplets & white soap suds flecks!
    if (Math.random() < 0.35 + moveDist * 10) {
      const splashPos = shoe.root.position.clone().add(
        new THREE.Vector3(this.scrubPosLocal.x * 0.8, 0.08 + this.scrubPosLocal.y * 0.5, 0.05)
      );
      this.spawnSplash(splashPos, 3, 1.05, 0.6);
      if (Math.random() < 0.22) this.audio.playBubblePop(1.1);
    }
    if (Math.random() < moveDist * 2.2) {
      this.spawnFloatingBubble(shoe.root.position.clone().add(new THREE.Vector3(0, 0.12, 0)));
    }

    const stats = shoe.surface.getStats();
    shoe.setWetAppearance(stats.wetAvg);

    // Check if this shoe is scrubbed sparkling clean!
    if (stats.dirtAvg < 0.11) {
      shoe.cleanDone = true;
      // Clear remaining trace dirt so it looks immaculate under the foam
      shoe.surface.scrubAt(0.5, 0.5, 1.2, 1.0, 0.25);
      shoe.surface.updateTexture();
      this.audio.playSparkleChime(false);
      this.spawnGlint(shoe.root.position.clone().add(new THREE.Vector3(0, 0.10, 0.08)));

      if (this.activeShoeIndex === 0) {
        // Swap smoothly to Shoe #2!
        this.activeShoeIndex = 1;
        this.shoeRotatePhase = 0;
      } else {
        // Both shoes scrubbed foamy clean -> Rinse under the sparkling sunlit veranda faucet!
        this.setStage(STAGES.RINSE);
      }
    }
  }

  _updateRinsePositionFromPointer() {
    this.rinseOffset.x = THREE.MathUtils.clamp(this.pointerNDC.x * 0.34, -0.26, 0.28);
    this.rinseOffset.y = THREE.MathUtils.clamp(this.pointerNDC.y * 0.22, -0.14, 0.18);
  }

  _snapShoeToHanger(idx) {
    if (this.hung[idx]) return;
    this.hung[idx] = true;
    this.dragTarget = null;
    this.draggedHangIdx = -1;
    this.hangerSwingVel += (idx === 0 ? -1 : 1) * 2.4;
    this.audio.playClipSnap();

    const slotWorld = this.veranda.hangerSlots[idx].getWorldPosition(this.tmpVec3);
    this.spawnSplash(slotWorld.clone().add(new THREE.Vector3(0, -0.06, 0)), 8, 0.65, 0.0);
    this.spawnGlint(slotWorld);

    if (this.hung[0] && this.hung[1]) {
      this.audio.playSparkleChime(true);
      this.audio.playWindChime(0.85);
    }
  }

  // --- Main Per-Frame Simulation Update ---
  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.time += safeDt;
    this.idleSeconds += safeDt;

    // Decay transient inputs
    this.pointerSpeed = Math.max(0, this.pointerSpeed - safeDt * 4.5);
    this.swirlVelocity = Math.max(0, this.swirlVelocity - safeDt * 4.8);
    this.scrubEnergy = Math.max(0, this.scrubEnergy - safeDt * 4.2);

    // 1. Update sky clouds, glossy wet puddle reflection & wind chime breeze
    this.sky.material.uniforms.uTime.value = this.time;
    this.bubbleMat.uniforms.uTime.value = this.time;
    if (this.veranda.puddleMat) {
      this.veranda.puddleMat.uniforms.uTime.value = this.time;
      const targetPuddle = this.stage === STAGES.LATHER ? 0.55 + this.foamLevel * 0.25 : 0.85;
      this.veranda.puddleMat.uniforms.uWetness.value = THREE.MathUtils.lerp(
        this.veranda.puddleMat.uniforms.uWetness.value,
        targetPuddle,
        safeDt * 2.0
      );
    }
    this._updateWindChime(safeDt);

    // 2. Subtle natural idle hint (>9 seconds untouched, one quiet hand gesture per wordless rule!)
    let hintActive = false;
    if (this.idleSeconds > 9.0 && !this.isPointerDown) {
      this.hintPhase += safeDt * 2.2;
      hintActive = true;
      if (this.hintPhase > Math.PI * 2) {
        this.hintPhase = 0;
        this.idleSeconds = 2.0; // wait another ~7s before ever hinting again
      }
    } else {
      this.hintPhase = 0;
    }

    // 3. Stage-specific animations & physics
    this.rinsingHit = 0;
    if (this.stage === STAGES.LATHER) {
      this._updateLatherStage(safeDt, hintActive);
    } else if (this.stage === STAGES.SCRUB) {
      this._updateScrubStage(safeDt, hintActive);
    } else if (this.stage === STAGES.RINSE) {
      this._updateRinseStage(safeDt, hintActive);
    } else if (this.stage === STAGES.DRY) {
      this._updateDryStage(safeDt, hintActive);
    }

    // 4. Update bucket water shader & billowing 3D foam mound
    this.swirlAngle += this.swirlVelocity * safeDt * 0.45;
    const rippleAmp = 0.003 + Math.min(0.022, this.swirlVelocity * 0.002 + this.faucetFlow * 0.012);
    this.bucket.waterMat.uniforms.uTime.value = this.time;
    this.bucket.waterMat.uniforms.uRippleAmp.value = rippleAmp;
    this.bucket.waterMat.uniforms.uRippleCenter.value.copy(this.swirlTargetXZ);
    this.bucket.waterMat.uniforms.uSoapiness.value = THREE.MathUtils.clamp(this.foamLevel * 0.9, 0, 1);
    this.bucket.waterMat.uniforms.uMurkiness.value = this.stage === STAGES.SCRUB ? 0.35 : 0.0;
    this.bucket.updateFoamMound(this.foamLevel, this.swirlAngle, this.time);

    // Faucet water stream shader & handle turn
    this.veranda.streamMat.uniforms.uTime.value = this.time;
    this.veranda.streamMat.uniforms.uFlow.value = THREE.MathUtils.lerp(
      this.veranda.streamMat.uniforms.uFlow.value,
      this.faucetFlow,
      safeDt * 6
    );
    this.veranda.waterStream.visible = this.veranda.streamMat.uniforms.uFlow.value > 0.02;
    this.veranda.faucetHandle.rotation.y = THREE.MathUtils.lerp(
      this.veranda.faucetHandle.rotation.y,
      this.faucetFlow > 0.5 ? Math.PI * 0.75 : 0,
      safeDt * 5
    );

    // Optical sunlight rainbow mist fade
    this.rainbowOpacity = THREE.MathUtils.lerp(
      this.rainbowOpacity,
      this.rinsingHit > 0.35 ? 0.92 : 0.0,
      safeDt * 3.5
    );
    this.rainbowMat.uniforms.uOpacity.value = this.rainbowOpacity;

    // 5. Update concrete puddle evaporation & particles
    this.textures.concrete.flushWetness(safeDt);
    this._updateParticles(safeDt);

    // 6. Smooth wide-angle camera transition
    this.camPosCurrent.lerp(this.camPosTarget, Math.min(1, safeDt * 3.4));
    this.camLookCurrent.lerp(this.camLookTarget, Math.min(1, safeDt * 3.4));
    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);

    // 7. Continuous Web Audio update
    this.audio.updateContinuous(safeDt, {
      swirlSpeed: this.swirlVelocity * 0.14,
      scrubSpeed: this.scrubEnergy * 0.85,
      faucetFlow: this.faucetFlow,
      rinsingHit: this.rinsingHit
    });
  }

  _updateWindChime(dt) {
    // Periodic natural Japanese summer breeze gust!
    this.nextBreezeTime -= dt;
    if (this.nextBreezeTime <= 0) {
      this.nextBreezeTime = 5.5 + Math.random() * 6.5;
      const gust = (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.4);
      this.chimeVelZ += gust;
      if (Math.abs(gust) > 1.7) {
        this.audio.playWindChime(0.45);
      }
    }

    // Spring-damper pendulum for bell & fluttering washi tanzaku strip
    const k = 14.0;
    const damp = 1.65;
    this.chimeVelZ += (-k * this.chimeSwingZ - damp * this.chimeVelZ) * dt;
    this.chimeVelX += (-k * this.chimeSwingX - damp * this.chimeVelX) * dt;
    this.chimeSwingZ += this.chimeVelZ * dt;
    this.chimeSwingX += this.chimeVelX * dt;

    const idleSway = Math.sin(this.time * 1.4) * 0.04;
    this.veranda.windChimePivot.rotation.z = this.chimeSwingZ * 0.25 + idleSway;
    this.veranda.windChimePivot.rotation.x = this.chimeSwingX * 0.22;

    // Paper strip flutters with wider lag behind bell
    this.veranda.stripPivot.rotation.z = this.chimeSwingZ * 0.55 + Math.sin(this.time * 2.4 - 0.6) * 0.08;
    this.veranda.stripPivot.rotation.x = this.chimeSwingX * 0.45 + Math.cos(this.time * 1.9) * 0.05;
  }

  _updateLatherStage(dt, hintActive) {
    // Soap bar bobs invitingly in the sunlit water & circles when swirled!
    const bob = Math.sin(this.time * 2.8) * 0.008;
    const soapX = this.bucketPos.x + (this.dragTarget === 'bucket' ? this.swirlTargetXZ.x * 0.72 : Math.cos(this.time * 0.8) * 0.03);
    const soapZ = this.bucketPos.z + (this.dragTarget === 'bucket' ? this.swirlTargetXZ.y * 0.72 : Math.sin(this.time * 0.8) * 0.03);
    const soapY = 0.285 + Math.min(0.08, this.foamLevel * 0.06) + bob;
    this.soapBar.group.position.lerp(new THREE.Vector3(soapX, soapY, soapZ), Math.min(1, dt * 12));
    this.soapBar.group.rotation.set(
      Math.sin(this.time * 2.1) * 0.14,
      this.swirlAngle * 0.7 + 0.4,
      Math.cos(this.time * 1.8) * 0.12
    );

    // Waiting muddy uwabaki sit cleanly on the right side of the veranda floor (wobble softly if poked)
    for (let i = 0; i < 2; i++) {
      const s = this.shoes[i];
      s.wobble = Math.max(0, s.wobble - dt * 3.5);
      s.root.position.lerp(s.restPos, Math.min(1, dt * 8));
      s.root.rotation.set(
        Math.sin(this.time * 22) * s.wobble * 0.08,
        s.restRot.y,
        Math.cos(this.time * 22) * s.wobble * 0.08
      );
    }

    // Brush rests neatly on the concrete beside the shoes
    this.brush.group.position.lerp(this.brushRestPos, Math.min(1, dt * 8));
    this.brush.group.rotation.set(0, -0.95, 0);
    this.brush.brushFoam.visible = false;

    // Foreground hands: big & natural!
    // Left hand steadies the front rim of the bucket with natural gently curved fingers
    const lTarget = new THREE.Vector3(this.bucketPos.x - 0.19, 0.355, this.bucketPos.z + 0.24);
    this.leftHand.root.position.lerp(lTarget, Math.min(1, dt * 8));
    this.leftHand.root.rotation.set(0.24, -0.38, -0.22);
    this.leftHand.setPose(0.36, 0.30, 0.35);

    let rx = this.bucketPos.x + 0.16;
    let ry = 0.42;
    let rz = this.bucketPos.z + 0.34;
    if (this.dragTarget === 'bucket') {
      rx = this.bucketPos.x + this.swirlTargetXZ.x;
      ry = 0.31 + Math.min(0.05, this.foamLevel * 0.03);
      rz = this.bucketPos.z + this.swirlTargetXZ.y + 0.08;
    } else if (hintActive) {
      // One gentle natural swirling invitation
      rx = this.bucketPos.x + Math.cos(this.hintPhase) * 0.08;
      ry = 0.33;
      rz = this.bucketPos.z + Math.sin(this.hintPhase) * 0.08 + 0.07;
    }
    this.rightHand.root.position.lerp(new THREE.Vector3(rx, ry, rz), Math.min(1, dt * 14));
    this.rightHand.root.rotation.set(
      this.dragTarget === 'bucket' ? 0.38 : 0.22,
      0.28,
      Math.sin(this.swirlAngle) * 0.16 - 0.12
    );
    this.rightHand.setPose(this.dragTarget === 'bucket' ? 0.38 : 0.22, 0.28, this.foamLevel > 0.1 ? 0.85 : 0.25);

    // If overflowing joyfully for a while (>1.5), splash foam onto floor!
    if (this.foamLevel > 1.05 && Math.random() < dt * 2.5) {
      const ang = Math.random() * Math.PI * 2;
      this.wetConcreteAt(this.bucketPos.x + Math.cos(ang) * 0.28, this.bucketPos.z + Math.sin(ang) * 0.28, 0.04, 0.28);
    }
  }

  _updateScrubStage(dt, hintActive) {
    // Active shoe held HUGE and tilted clearly in the foreground by the left hand!
    const holdPos = new THREE.Vector3(0.00, 0.44, 0.22);

    for (let i = 0; i < 2; i++) {
      const s = this.shoes[i];
      if (i === this.activeShoeIndex) {
        s.root.position.lerp(holdPos, Math.min(1, dt * 8));
        // Gentle wobble under energetic scrubbing + smooth presentation angle so toe & sides both shine!
        const scrubJiggle = Math.sin(this.scrubPhase * 1.4) * this.scrubEnergy * 0.035;
        const targetRotY = -0.58 + Math.sin(this.shoeRotatePhase) * 0.58;
        s.root.rotation.x = THREE.MathUtils.lerp(s.root.rotation.x, 0.28 + scrubJiggle, Math.min(1, dt * 10));
        s.root.rotation.y = THREE.MathUtils.lerp(s.root.rotation.y, targetRotY, Math.min(1, dt * 7));
        s.root.rotation.z = THREE.MathUtils.lerp(s.root.rotation.z, -0.22 + scrubJiggle * 0.8, Math.min(1, dt * 10));
      } else if (s.cleanDone) {
        // Already scrubbed shoe rests proudly foamy on right veranda concrete
        const donePos = new THREE.Vector3(0.42, 0.0, 0.06);
        s.root.position.lerp(donePos, Math.min(1, dt * 6));
        s.root.rotation.x = THREE.MathUtils.lerp(s.root.rotation.x, 0, Math.min(1, dt * 6));
        s.root.rotation.y = THREE.MathUtils.lerp(s.root.rotation.y, -0.42, Math.min(1, dt * 6));
        s.root.rotation.z = THREE.MathUtils.lerp(s.root.rotation.z, 0, Math.min(1, dt * 6));
      } else {
        // Waiting dirty shoe #2 sits beside the bucket
        s.root.position.lerp(s.restPos, Math.min(1, dt * 6));
        s.root.rotation.x = THREE.MathUtils.lerp(s.root.rotation.x, 0, Math.min(1, dt * 6));
        s.root.rotation.y = THREE.MathUtils.lerp(s.root.rotation.y, s.restRot.y, Math.min(1, dt * 6));
        s.root.rotation.z = THREE.MathUtils.lerp(s.root.rotation.z, 0, Math.min(1, dt * 6));
      }
    }

    // Left hand cradles the back/heel of the held shoe cleanly without blocking the muddy canvas!
    const lTarget = new THREE.Vector3(holdPos.x - 0.17, holdPos.y + 0.01, holdPos.z + 0.14);
    this.leftHand.root.position.lerp(lTarget, Math.min(1, dt * 10));
    this.leftHand.root.rotation.set(0.22, -0.52, -0.32);
    this.leftHand.setPose(0.66, 0.52, 0.75);

    // Right hand grips the curved beechwood scrub brush & scrubs clearly from the right side!
    let bx = holdPos.x + 0.16;
    let by = holdPos.y + 0.10;
    let bz = holdPos.z + 0.06;
    if (this.dragTarget === 'shoe') {
      const stroke = Math.sin(this.scrubPhase) * 0.055;
      bx = holdPos.x + 0.05 + this.scrubPosLocal.x * 0.85 + stroke * 0.65;
      by = holdPos.y + 0.105 + this.scrubPosLocal.y * 0.50;
      bz = holdPos.z + 0.02 + stroke * 0.55;
    } else if (hintActive) {
      const stroke = Math.sin(this.hintPhase * 2.0) * 0.06;
      bx = holdPos.x + 0.05 + stroke;
      by = holdPos.y + 0.105;
      bz = holdPos.z + 0.02;
    }

    this.brush.group.position.lerp(new THREE.Vector3(bx, by, bz), Math.min(1, dt * 18));
    this.brush.group.rotation.set(
      0.18 + Math.sin(this.scrubPhase) * this.scrubEnergy * 0.12,
      -0.78,
      0.12
    );

    // Right hand grips the handle end cleanly so the shoe & bristle contact stay super visible!
    const rTarget = this.brush.group.position.clone().add(new THREE.Vector3(0.11, 0.01, 0.11));
    this.rightHand.root.position.lerp(rTarget, Math.min(1, dt * 18));
    this.rightHand.root.rotation.set(0.26, 0.45, 0.18);
    this.rightHand.setPose(0.84, 0.68, 0.85);
  }

  _updateRinseStage(dt, hintActive) {
    // Gradually flush soap mound down in bucket as fresh clear water cascades in!
    this.foamLevel = Math.max(0.08, this.foamLevel - dt * 0.14);

    // Brush rests cleanly back on the floor
    this.brush.group.position.lerp(this.brushRestPos, Math.min(1, dt * 7));
    this.brush.group.rotation.set(0, -0.95, 0);
    this.brush.brushFoam.visible = false;

    // Continuous shimmering splash where the faucet stream hits the bucket water
    if (Math.random() < dt * 18) {
      this.spawnSplash(new THREE.Vector3(this.bucketPos.x - 0.05, 0.29, this.bucketPos.z - 0.08), 1, 0.65, 0.08);
    }

    // Active shoe positioned relative to the sparkling faucet waterfall stream!
    const streamCenter = this.veranda.streamWorldMid; // around x=-0.34, y=0.32, z=-0.10
    let targetX = streamCenter.x + this.rinseOffset.x;
    let targetY = 0.42 + this.rinseOffset.y;
    let targetZ = streamCenter.z + 0.14;

    if (hintActive && this.dragTarget !== 'rinse') {
      // Gently glide toward stream once as a quiet visual invitation
      targetX = THREE.MathUtils.lerp(streamCenter.x + 0.16, streamCenter.x, 0.5 - 0.5 * Math.cos(this.hintPhase));
    }

    const activeShoe = this.shoes[this.activeShoeIndex];
    for (let i = 0; i < 2; i++) {
      const s = this.shoes[i];
      if (i === this.activeShoeIndex) {
        s.root.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), Math.min(1, dt * 11));
        s.root.rotation.x = THREE.MathUtils.lerp(s.root.rotation.x, 0.24, Math.min(1, dt * 8));
        s.root.rotation.y = THREE.MathUtils.lerp(
          s.root.rotation.y,
          -0.45 + Math.sin(this.time * 2.2) * 0.25,
          Math.min(1, dt * 6)
        );
        s.root.rotation.z = THREE.MathUtils.lerp(s.root.rotation.z, -0.15, Math.min(1, dt * 8));
      } else if (s.rinseDone) {
        // Already rinsed sparkling white shoe waits on the right side!
        s.root.position.lerp(new THREE.Vector3(0.36, 0.0, 0.10), Math.min(1, dt * 6));
        s.root.rotation.set(0, -0.32, 0);
      } else {
        // Foamy Shoe #2 waiting its turn to rinse
        s.root.position.lerp(new THREE.Vector3(0.42, 0.0, -0.02), Math.min(1, dt * 6));
        s.root.rotation.set(0, -0.5, 0);
      }
    }

    // Both foreground hands cradle & tilt the shoe naturally under the sparkling sunlit waterfall!
    const sPos = activeShoe.root.position;
    this.leftHand.root.position.lerp(new THREE.Vector3(sPos.x - 0.15, sPos.y + 0.015, sPos.z + 0.15), Math.min(1, dt * 11));
    this.leftHand.root.rotation.set(0.14, -0.52, -0.34);
    this.leftHand.setPose(0.38, 0.34, 1.0);

    this.rightHand.root.position.lerp(new THREE.Vector3(sPos.x + 0.15, sPos.y + 0.015, sPos.z + 0.15), Math.min(1, dt * 11));
    this.rightHand.root.rotation.set(0.14, 0.52, 0.34);
    this.rightHand.setPose(0.38, 0.34, 1.0);

    // Check distance from shoe to waterfall stream!
    const dx = sPos.x - streamCenter.x;
    const dz = sPos.z - (streamCenter.z + 0.12);
    const streamDist = Math.hypot(dx, dz);

    if (streamDist < 0.26) {
      const hitStrength = 1.0 - streamDist / 0.26;
      this.rinsingHit = hitStrength;

      // Wash away clinging foam across entire curved shoe & leave dazzling sparkling white wet canvas!
      const u = (0.5 + Math.sin(this.time * 4.5) * 0.4) % 1.0;
      activeShoe.surface.rinseAt(u, 0.5, 0.85, dt * (1.1 + hitStrength * 1.6));
      activeShoe.surface.rinseAt((u + 0.5) % 1.0, 0.5, 0.85, dt * (0.95 + hitStrength * 1.4));
      activeShoe.surface.updateTexture();

      // Shrink 3D clinging foam puffs on shoe rapidly under the water stream!
      for (let i = 0; i < activeShoe.puffAnchors.length; i++) {
        const p = activeShoe.puffAnchors[i];
        p.level = Math.max(0, p.level - dt * (0.95 + hitStrength * 1.4));
      }
      activeShoe.updateShoeFoam(0);

      const stats = activeShoe.surface.getStats();
      activeShoe.setWetAppearance(stats.wetAvg);

      // HUGE sparkling sunlit water splashes & wet concrete puddles!
      if (Math.random() < dt * 36 * hitStrength) {
        this.spawnSplash(sPos.clone().add(new THREE.Vector3(0, 0.07, 0)), 3, 1.35, stats.foamAvg > 0.15 ? 0.32 : 0.04);
      }
      if (Math.random() < dt * 5) {
        this.wetConcreteAt(sPos.x + (Math.random() - 0.5) * 0.4, sPos.z + (Math.random() - 0.5) * 0.4, 0.045, 0.35);
      }

      // Check if completely rinsed sparkling white!
      if (stats.foamAvg < 0.075 && activeShoe.puffAnchors[0].level < 0.05) {
        activeShoe.rinseDone = true;
        activeShoe.surface.rinseAt(0.5, 0.5, 1.5, 2.0);
        activeShoe.surface.updateTexture();
        activeShoe.puffAnchors.forEach((p) => (p.level = 0));
        activeShoe.updateShoeFoam(0);

        this.audio.playSparkleChime(false);
        for (let k = 0; k < 4; k++) this.spawnGlint(sPos);

        if (this.activeShoeIndex === 0) {
          this.activeShoeIndex = 1;
          this.rinseOffset.set(0.18, 0.02);
        } else {
          // Both shoes sparkling white -> Hang them under the summer sun!
          this.setStage(STAGES.DRY);
        }
      }
    }
  }

  _updateDryStage(dt, hintActive) {
    // Shoe hanger gently sways in the summer breeze + player swipes
    const hk = 9.0;
    const hd = 1.4;
    this.hangerSwingVel += (-hk * this.hangerSwing - hd * this.hangerSwingVel) * dt;
    this.hangerSwing += this.hangerSwingVel * dt;
    this.veranda.hangerPivot.rotation.z = this.hangerSwing * 0.16 + Math.sin(this.time * 1.1) * 0.025;
    this.veranda.hangerPivot.rotation.x = Math.cos(this.time * 0.9) * 0.02;

    // Position both shoes: either waiting eagerly in lower foreground OR clipped onto the sunlit shoe-hanger!
    for (let i = 0; i < 2; i++) {
      const s = this.shoes[i];
      if (this.hung[i]) {
        const slotWorld = this.veranda.hangerSlots[i].getWorldPosition(this.tmpVec3);
        s.root.position.lerp(slotWorld, Math.min(1, dt * 14));
        // Classic Japanese uwabaki drying pose: sparkling white canvas upper & bright red band facing the summer sun & camera!
        s.root.rotation.x = THREE.MathUtils.lerp(s.root.rotation.x, 0.96, Math.min(1, dt * 10));
        s.root.rotation.y = THREE.MathUtils.lerp(s.root.rotation.y, i === 0 ? 0.22 : -0.22, Math.min(1, dt * 10));
        s.root.rotation.z = THREE.MathUtils.lerp(
          s.root.rotation.z,
          this.veranda.hangerPivot.rotation.z + (i === 0 ? -0.14 : 0.14),
          Math.min(1, dt * 12)
        );
      } else if (this.dragTarget === 'hangShoe' && this.draggedHangIdx === i) {
        // Being actively dragged upward by player!
      } else {
        // Waiting cleanly in foreground ready to drag up to the hanger!
        const waitPos = new THREE.Vector3(i === 0 ? -0.16 : 0.24, 0.42 + Math.sin(this.time * 2.5 + i) * 0.012, 0.28);
        s.root.position.lerp(waitPos, Math.min(1, dt * 7));
        s.root.rotation.x = THREE.MathUtils.lerp(s.root.rotation.x, 0.24, Math.min(1, dt * 7));
        s.root.rotation.y = THREE.MathUtils.lerp(s.root.rotation.y, i === 0 ? 0.25 : -0.25, Math.min(1, dt * 7));
        s.root.rotation.z = THREE.MathUtils.lerp(s.root.rotation.z, 0, Math.min(1, dt * 7));
      }
    }

    // Foreground hands: follow dragged shoe or step neatly down to admire the hanging shoes under the sky!
    if (this.dragTarget === 'hangShoe' && this.draggedHangIdx !== -1) {
      const sp = this.shoes[this.draggedHangIdx].root.position;
      this.rightHand.root.position.lerp(new THREE.Vector3(sp.x + 0.08, sp.y - 0.04, sp.z + 0.14), Math.min(1, dt * 16));
      this.rightHand.root.rotation.set(-0.25, 0.2, 0.1);
      this.rightHand.setPose(0.7, 0.55, 0.6);
      this.leftHand.root.position.lerp(new THREE.Vector3(-0.42, 0.25, 0.72), Math.min(1, dt * 6));
    } else if (hintActive && (!this.hung[0] || !this.hung[1])) {
      const idx = !this.hung[0] ? 0 : 1;
      const lift = 0.5 - 0.5 * Math.cos(this.hintPhase);
      const sx = idx === 0 ? -0.14 : 0.22;
      this.rightHand.root.position.lerp(new THREE.Vector3(sx, 0.40 + lift * 0.42, 0.34 - lift * 0.22), Math.min(1, dt * 10));
      this.rightHand.root.rotation.set(-0.35 * lift, 0.1, 0);
      this.rightHand.setPose(0.5, 0.4, 0.3);
    } else {
      // Relaxed open hands at lower corners framing the dazzling blue summer sky & drying shoes!
      this.leftHand.root.position.lerp(new THREE.Vector3(-0.44, 0.28, 0.72), Math.min(1, dt * 5));
      this.leftHand.root.rotation.set(0.1, -0.3, -0.1);
      this.leftHand.setPose(0.22, 0.2, 0.15);

      this.rightHand.root.position.lerp(new THREE.Vector3(0.46, 0.28, 0.72), Math.min(1, dt * 5));
      this.rightHand.root.rotation.set(0.1, 0.3, 0.1);
      this.rightHand.setPose(0.22, 0.2, 0.15);
    }

    // Once BOTH shoes are hung in the blazing summer sun: drip water beads & visibly dry into dazzling crisp white!
    if (this.hung[0] && this.hung[1]) {
      if (this.dryProgress < 1.0) {
        this.dryProgress = Math.min(1.0, this.dryProgress + dt * 0.19);
        for (const s of this.shoes) {
          s.surface.dryStep(dt * 0.24);
          s.surface.updateTexture();
          s.setWetAppearance(Math.max(0, 1 - this.dryProgress));
        }

        // Sparkling water drips falling from heels down onto concrete!
        if (Math.random() < dt * (4.5 * (1 - this.dryProgress))) {
          const idx = Math.random() > 0.5 ? 0 : 1;
          const dripPos = this.shoes[idx].root.position.clone().add(new THREE.Vector3(0, -0.12, 0.02));
          this.spawnSplash(dripPos, 1, 0.22, 0.0);
          if (Math.random() < 0.35) this.audio.playDrip();
        }
      } else {
        // Fully sun-dried dazzling crisp white!!
        if (!this.dryCompleteCelebrated) {
          this.dryCompleteCelebrated = true;
          this.audio.playSparkleChime(true);
          this.audio.playWindChime(0.95);
          for (let k = 0; k < 6; k++) {
            const p = this.shoes[k % 2].root.position.clone();
            this.spawnGlint(p);
          }
          // Send a joyful wave of rainbow soap bubbles across the summer sky!
          for (let b = 0; b < 5; b++) {
            this.spawnFloatingBubble(new THREE.Vector3(-0.35 + b * 0.18, 0.48, -0.2));
          }
          this.nextPairReady = true;
          this.nextPairGroup.visible = true;
        }

        // Occasional delicate sunlight glints on the sparkling clean white canvas!
        if (Math.random() < dt * 2.2) {
          const idx = Math.random() > 0.5 ? 0 : 1;
          this.spawnGlint(this.shoes[idx].root.position);
        }

        // Gently slide in a fresh pair of muddy shoes at the bottom veranda edge for zero-text endless replay!
        this.nextPairRise = Math.min(1, this.nextPairRise + dt * 1.4);
        const ease = 1 - Math.pow(1 - this.nextPairRise, 3);
        this.nextPairGroup.position.set(0.06, 0.38 * ease - 0.12 * (1 - ease), 0.32);
        this.nextPairGroup.rotation.set(0.26, Math.sin(this.time * 1.6) * 0.08, 0);
      }
    }
  }

  _updateParticles(dt) {
    // 1. Water droplets & foam flecks with gravity and concrete wet-splash feedback
    let anyActive = false;
    for (let i = 0; i < this.dropCount; i++) {
      const d = this.drops[i];
      if (!d.active) continue;
      anyActive = true;
      d.life += dt;
      d.vel.y -= 5.8 * dt;
      d.pos.addScaledVector(d.vel, dt);

      if (d.pos.y <= 0.008) {
        // Hit concrete veranda floor -> leave a tiny dark glossy wet splash spot!
        if (!d.isFoam && Math.random() < 0.45) {
          this.wetConcreteAt(d.pos.x, d.pos.z, 0.022, 0.25);
        }
        d.active = false;
        this.tmpDummy.scale.setScalar(0.0001);
        this.tmpDummy.updateMatrix();
        this.dropMesh.setMatrixAt(i, this.tmpDummy.matrix);
        continue;
      }

      if (d.life >= d.maxLife) {
        d.active = false;
        this.tmpDummy.scale.setScalar(0.0001);
      } else {
        const fade = 1 - d.life / d.maxLife;
        this.tmpDummy.position.copy(d.pos);
        // Stretch water drops along velocity like real high-shutter summer photography!
        const spd = d.vel.length();
        const stretch = d.isFoam ? 1.0 : Math.min(2.4, 1.0 + spd * 0.45);
        this.tmpDummy.scale.set(d.size * fade, d.size * fade * stretch, d.size * fade);
        if (!d.isFoam && spd > 0.1) {
          this.tmpDummy.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            this.tmpVec3.copy(d.vel).normalize()
          );
        } else {
          this.tmpDummy.rotation.set(0, 0, 0);
        }
      }
      this.tmpDummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this.tmpDummy.matrix);
    }
    if (anyActive) this.dropMesh.instanceMatrix.needsUpdate = true;

    // 2. Drifting iridescent rainbow soap bubbles
    for (let i = 0; i < this.bubbleCount; i++) {
      const b = this.bubbles[i];
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.maxAge) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      const grow = Math.min(1, b.age * 3.5);
      b.mesh.position.x += (b.vel.x + Math.sin(this.time * 2.2 + b.wobblePhase) * 0.09) * dt;
      b.mesh.position.y += b.vel.y * dt;
      b.mesh.position.z += b.vel.z * dt;
      const pulse = 1 + Math.sin(this.time * 5.0 + b.wobblePhase) * 0.06;
      b.mesh.scale.set(b.radius * grow * pulse, b.radius * grow / pulse, b.radius * grow);
    }

    // 3. Optical sun-glint sparkles
    for (let i = 0; i < this.glintCount; i++) {
      const g = this.glints[i];
      if (!g.active) continue;
      g.age += dt;
      if (g.age >= g.maxAge) {
        g.active = false;
        g.sprite.visible = false;
        continue;
      }
      const t = g.age / g.maxAge;
      const env = Math.sin(t * Math.PI);
      g.sprite.material.opacity = env * 0.72;
      const sc = 0.022 + env * 0.042;
      g.sprite.scale.set(sc, sc, 1);
    }
  }
}
