import * as THREE from '../vendor/three.module.js';
import { createCastIronBumpTexture, createWoodTextures } from './textures.js';

export class IceShaver {
  constructor(scene) {
    this.group = new THREE.Group();
    this.crankAngle = 0;
    this.crankVelocity = 0;
    this.iceBlockScale = 1.0;
    this.wobbleTimer = 0;
    this.hitMeshes = [];

    const ironBump = createCastIronBumpTexture();
    const wood = createWoodTextures(42, '#b94832', '#7a2518');

    // Classic vintage Japanese mint-teal cast-iron enamel material
    const enamelMat = new THREE.MeshStandardMaterial({
      color: 0x56a3a6,
      roughness: 0.28,
      metalness: 0.22,
      bumpMap: ironBump,
      bumpScale: 0.014,
    });
    const creamTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf4ecd8,
      roughness: 0.35,
      metalness: 0.08,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd9a84e,
      roughness: 0.24,
      metalness: 0.82,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe6edf2,
      roughness: 0.14,
      metalness: 0.9,
    });
    const redWoodMat = new THREE.MeshStandardMaterial({
      color: 0xd93636,
      map: wood.map,
      bumpMap: wood.bumpMap,
      bumpScale: 0.01,
      roughness: 0.32,
      metalness: 0.05,
    });

    // 1. Heavy sculpted cast-iron base plate (sits cleanly on the left without clipping the saucer!)
    const baseFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 24), enamelMat);
    baseFoot.position.set(-0.62, 0.06, 0);
    baseFoot.castShadow = true;
    baseFoot.receiveShadow = true;
    this.group.add(baseFoot);

    // Low flat cast-iron drip pad under the bowl (y = 0.014 so bowl saucer sits neatly ABOVE it at y = 0.016!)
    const dripTray = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.49, 0.016, 28), creamTrimMat);
    dripTray.position.set(0.22, 0.008, 0);
    dripTray.receiveShadow = true;
    this.group.add(dripTray);

    const dripRim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.016, 8, 32), enamelMat);
    dripRim.rotation.x = Math.PI / 2;
    dripRim.position.set(0.22, 0.016, 0);
    this.group.add(dripRim);

    // Connecting slim bridge plate
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.036, 0.32), enamelMat);
    bridge.position.set(-0.26, 0.018, 0);
    bridge.receiveShadow = true;
    bridge.castShadow = true;
    this.group.add(bridge);

    // 2. Sculpted Vintage Swan-Neck C-Arch Pillar (authentic curved cast-iron craft!)
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.62, 0.10, 0),
      new THREE.Vector3(-0.66, 0.95, 0),
      new THREE.Vector3(-0.60, 1.82, 0),
      new THREE.Vector3(-0.28, 2.04, 0),
      new THREE.Vector3(0.22, 2.04, 0),
    ]);
    const swanNeck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 28, 0.155, 16, false), enamelMat);
    swanNeck.castShadow = true;
    swanNeck.receiveShadow = true;
    this.group.add(swanNeck);

    // Decorative brass collar rings on pillar
    for (const py of [0.22, 1.48]) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.028, 10, 22), brassMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(-0.64, py, 0);
      this.group.add(collar);
    }

    // Lower blade platform ring at y = 1.64 (generous clearance over bowl!)
    const bladePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.35, 0.13, 24), enamelMat);
    bladePlate.position.set(0.22, 1.64, 0);
    bladePlate.castShadow = true;
    this.group.add(bladePlate);

    // Brass decorative rim on blade housing
    const bladeBrass = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.018, 8, 28), brassMat);
    bladeBrass.rotation.x = Math.PI / 2;
    bladeBrass.position.set(0.22, 1.68, 0);
    this.group.add(bladeBrass);

    // Stainless steel blade chute underside
    const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.13, 0.16, 18), chromeMat);
    chute.position.set(0.22, 1.52, 0);
    this.group.add(chute);

    // Curved connecting lower bracket from swan neck to blade plate
    const midCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.62, 1.46, 0),
      new THREE.Vector3(-0.25, 1.62, 0),
      new THREE.Vector3(0.18, 1.64, 0),
    ]);
    const midArm = new THREE.Mesh(new THREE.TubeGeometry(midCurve, 14, 0.085, 12, false), enamelMat);
    midArm.castShadow = true;
    this.group.add(midArm);

    // Open brass side guide rods framing the ice block so it stays visible!
    for (const sz of [-0.28, 0.28]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 10), chromeMat);
      rod.position.set(0.22, 1.98, sz);
      this.group.add(rod);
    }

    // 3. Top brass threaded shaft & cap
    this.pressGroup = new THREE.Group();
    this.pressGroup.position.set(0.22, 2.15, 0);
    this.group.add(this.pressGroup);

    const screwShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 14), brassMat);
    screwShaft.position.y = 0.22;
    this.pressGroup.add(screwShaft);

    const topKnob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), brassMat);
    topKnob.scale.set(1.2, 0.75, 1.2);
    topKnob.position.y = 0.58;
    topKnob.castShadow = true;
    this.pressGroup.add(topKnob);

    const pressDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 18), chromeMat);
    pressDisc.position.y = -0.14;
    this.pressGroup.add(pressDisc);

    // 4. Translucent Glistening Crystal Ice Block clamped inside the chamber!
    this.iceBlockGroup = new THREE.Group();
    this.iceBlockGroup.position.set(0.22, 1.74, 0);
    this.group.add(this.iceBlockGroup);

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff6ff,
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.76,
      envMapIntensity: 1.7,
    });
    const iceBlockGeo = new THREE.CylinderGeometry(0.27, 0.28, 0.44, 16);
    iceBlockGeo.translate(0, 0.22, 0); // Anchor bottom on blade plate!
    this.iceBlock = new THREE.Mesh(iceBlockGeo, iceMat);
    this.iceBlock.castShadow = true;
    this.iceBlockGroup.add(this.iceBlock);

    // Frozen internal crystal sparkles inside the ice block
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    const bubbleGeo = new THREE.OctahedronGeometry(0.032, 0);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(bubbleGeo, bubbleMat);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.12, 0.09 + (i % 4) * 0.085, Math.sin(a) * 0.12);
      b.rotation.set(i, i * 0.7, 0);
      this.iceBlock.add(b);
    }

    // 5. BIG Iconic Spoked Cast-Iron Flywheel + Chunky Cherry-Red Wooden Crank Handle!
    // Angled clearly toward front-left so the entire red wooden knob stays well inside the frame!
    this.wheelMount = new THREE.Group();
    this.wheelMount.position.set(-0.78, 1.38, 0.18);
    this.wheelMount.rotation.y = 0.56;
    this.group.add(this.wheelMount);

    // Axle housing connecting flywheel to pillar
    const axleHub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.34, 16), brassMat);
    axleHub.rotation.z = Math.PI / 2;
    axleHub.position.x = 0.15;
    this.wheelMount.add(axleHub);

    // Rotating flywheel assembly (rotates around local X axis!)
    this.flywheel = new THREE.Group();
    this.wheelMount.add(this.flywheel);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 14, 32), enamelMat);
    rim.rotation.y = Math.PI / 2;
    rim.castShadow = true;
    this.flywheel.add(rim);

    // Brass decorative inner accent ring
    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.018, 8, 28), brassMat);
    innerRim.rotation.y = Math.PI / 2;
    this.flywheel.add(innerRim);

    // Center brass hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 16), brassMat);
    hub.rotation.z = Math.PI / 2;
    this.flywheel.add(hub);

    // 5 curved/tapered vintage spokes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.48, 10), enamelMat);
      spoke.position.set(0, Math.cos(a) * 0.25, Math.sin(a) * 0.25);
      spoke.rotation.x = a;
      spoke.castShadow = true;
      this.flywheel.add(spoke);
    }

    // CHUNKY BRIGHT RED WOODEN CRANK HANDLE sticking out prominently!
    this.handleGroup = new THREE.Group();
    this.handleGroup.position.set(-0.04, 0.48, 0);
    this.flywheel.add(this.handleGroup);

    const handleRod = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.18, 12), chromeMat);
    handleRod.rotation.z = Math.PI / 2;
    handleRod.position.x = -0.07;
    this.handleGroup.add(handleRod);

    // Turned glossy cherry-red wooden grip (big, inviting, physical!)
    const handleGrip = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 10, 18), redWoodMat);
    handleGrip.rotation.z = Math.PI / 2;
    handleGrip.position.x = -0.24;
    handleGrip.castShadow = true;
    this.handleGroup.add(handleGrip);

    // Brass end cap on handle
    const handleCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), brassMat);
    handleCap.position.x = -0.39;
    this.handleGroup.add(handleCap);

    // Invisible generous touch hitbox for 5-year-old single-finger grab on flywheel & handle!
    const crankHitbox = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    crankHitbox.position.set(-0.16, 0, 0);
    crankHitbox.userData = { interactType: 'crank' };
    this.wheelMount.add(crankHitbox);
    this.hitMeshes.push(crankHitbox);

    // 6. Live Sparkling Shaved-Ice Snow Waterfall Particles (InstancedMesh for ultra-high FPS!)
    this.flakeCount = 95;
    const flakeGeo = new THREE.DodecahedronGeometry(0.036, 0);
    const flakeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xdff5ff,
      emissiveIntensity: 0.22,
      roughness: 0.35,
      metalness: 0.05,
    });
    this.flakesMesh = new THREE.InstancedMesh(flakeGeo, flakeMat, this.flakeCount);
    this.flakesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flakesMesh.frustumCulled = false;
    this.group.add(this.flakesMesh);

    this.flakes = [];
    this._dummy = new THREE.Object3D();
    for (let i = 0; i < this.flakeCount; i++) {
      this.flakes.push({
        active: false,
        x: 0.22,
        y: 1.5,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1,
        rot: Math.random() * Math.PI * 2,
      });
      this._dummy.scale.setScalar(0);
      this._dummy.updateMatrix();
      this.flakesMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.flakesMesh.instanceMatrix.needsUpdate = true;

    scene.add(this.group);
  }

  getWheelScreenCenter(camera, width, height) {
    const wp = new THREE.Vector3();
    this.wheelMount.getWorldPosition(wp);
    wp.project(camera);
    return {
      x: (wp.x * 0.5 + 0.5) * width,
      y: (-wp.y * 0.5 + 0.5) * height,
    };
  }

  getHandleWorldPosition(target = new THREE.Vector3()) {
    return this.handleGroup.getWorldPosition(target);
  }

  getChuteWorldPosition(target = new THREE.Vector3()) {
    target.set(0.22, 0.0, 0.0);
    return this.group.localToWorld(target);
  }

  resetIceBlock() {
    this.iceBlockScale = 1.0;
    this.iceBlock.scale.y = 1.0;
    this.pressGroup.position.y = 2.15;
  }

  triggerGentleNudge() {
    this.wobbleTimer = 0.7;
  }

  addCrankDelta(deltaAngle) {
    this.crankAngle += deltaAngle;
    this.crankVelocity = Math.min(18, Math.abs(deltaAngle) * 35);
    this.flywheel.rotation.x = this.crankAngle;
    this.iceBlockGroup.rotation.y += deltaAngle * 0.75;

    // Slowly shave down crystal ice block (refills smoothly if exhausted so child can keep cranking!)
    this.iceBlockScale -= Math.abs(deltaAngle) * 0.022;
    if (this.iceBlockScale < 0.26) {
      this.iceBlockScale = 0.96;
    }
    this.iceBlock.scale.y = this.iceBlockScale;
    this.pressGroup.position.y = 1.74 + this.iceBlockScale * 0.44 + 0.04;

    // Spawn burst of sparkling falling snow flakes from blade chute!
    const spawnNum = Math.min(12, Math.max(2, Math.ceil(Math.abs(deltaAngle) * 14)));
    let spawned = 0;
    for (let i = 0; i < this.flakeCount && spawned < spawnNum; i++) {
      const f = this.flakes[i];
      if (!f.active) {
        f.active = true;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.11;
        f.x = 0.22 + Math.cos(a) * r;
        f.y = 1.48 - Math.random() * 0.06;
        f.z = Math.sin(a) * r;
        f.vx = (Math.random() - 0.5) * 0.48;
        f.vy = -1.35 - Math.random() * 0.9;
        f.vz = (Math.random() - 0.5) * 0.48;
        f.scale = 0.65 + Math.random() * 1.15;
        f.rot = Math.random() * Math.PI * 2;
        spawned++;
      }
    }
  }

  update(dt, iceTopY = 0.55) {
    // Smooth velocity decay
    this.crankVelocity = Math.max(0, this.crankVelocity - dt * 16);

    // Subtle idle wiggle when gently nudged
    if (this.wobbleTimer > 0) {
      this.wobbleTimer = Math.max(0, this.wobbleTimer - dt);
      const w = Math.sin(this.wobbleTimer * 22) * this.wobbleTimer * 0.35;
      this.flywheel.rotation.x = this.crankAngle + w;
    } else {
      this.flywheel.rotation.x = this.crankAngle;
    }

    // Update falling snow crystals
    let anyChange = false;
    for (let i = 0; i < this.flakeCount; i++) {
      const f = this.flakes[i];
      if (!f.active) continue;
      anyChange = true;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.vy -= 2.4 * dt;
      f.rot += 5.5 * dt;
      if (f.y < Math.max(0.45, iceTopY - 0.05)) {
        f.active = false;
        this._dummy.scale.setScalar(0);
      } else {
        this._dummy.position.set(f.x, f.y, f.z);
        this._dummy.rotation.set(f.rot, f.rot * 0.7, 0);
        this._dummy.scale.setScalar(f.scale);
      }
      this._dummy.updateMatrix();
      this.flakesMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyChange) {
      this.flakesMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
