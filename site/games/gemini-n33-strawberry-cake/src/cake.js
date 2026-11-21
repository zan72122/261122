import * as THREE from 'three';
import {
  FrostingCanvas,
  createStrawberryTexture,
  createCandleTexture
} from './textures.js';

// Hero Strawberry Shortcake on a pastel scalloped turntable stand!
// Supports: real-time cream spreading + 3D cream dollops, strawberries with stacking/tumble physics,
// 3D fluted star rosettes & continuous piped ribbons, 5 pastel striped lit candles, and sliceable cake wedges!

export const CAKE_RADIUS = 1.18;
export const CAKE_HEIGHT = 1.02;
export const STAND_TOP_Y = 0.44;
export const CAKE_TOP_Y = STAND_TOP_Y + CAKE_HEIGHT; // 1.46

export const CREAM_COLORS = [
  { name: 'vanilla', hex: 0xfffaf4 },
  { name: 'strawberry', hex: 0xffb8d0 },
  { name: 'mint', hex: 0xbef5df }
];

export const CANDLE_STRIPES = [
  '#ff8fb8',
  '#8be5c4',
  '#ffd66b',
  '#c4a8ff',
  '#8fd4ff'
];

// Shared geometry builder for a plump glossy kawaii Japanese strawberry (wide bottom shoulders -> cute pointed tip UP!)
export function createStrawberryMesh(redTex, pearlTex, isPearl = false) {
  const group = new THREE.Group();

  // Iconic plump heart-teardrop strawberry lathe: y=0 at rounded base, y=0.48 at cute pointed tip!
  const pts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.14, 0.02),
    new THREE.Vector2(0.22, 0.11),
    new THREE.Vector2(0.23, 0.21),
    new THREE.Vector2(0.19, 0.32),
    new THREE.Vector2(0.11, 0.42),
    new THREE.Vector2(0.035, 0.475),
    new THREE.Vector2(0.001, 0.49)
  ];
  const bodyGeo = new THREE.LatheGeometry(pts, 20);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: isPearl ? pearlTex : redTex,
    roughness: isPearl ? 0.14 : 0.16,
    metalness: isPearl ? 0.1 : 0.04
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 0.02;
  group.add(body);

  // Bright green 6-petal star calyx hugging the berry base!
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x52cf7c, roughness: 0.34 });
  const leafGeo = new THREE.ConeGeometry(0.085, 0.21, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(a) * 0.145, 0.045, Math.sin(a) * 0.145);
    leaf.rotation.z = Math.cos(a) * 1.25;
    leaf.rotation.x = -Math.sin(a) * 1.25;
    group.add(leaf);
  }

  return group;
}

// Star-fluted meringue rosette geometry — clean parametric surface with ZERO degenerate cap normals!
function createFlutedRosetteGeometry() {
  const radialSegs = 28;
  const heightSegs = 12;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let yIdx = 0; yIdx <= heightSegs; yIdx++) {
    const v = yIdx / heightSegs; // 0 = base, 1 = smooth pointed cream peak
    const y = v * 0.30;
    // Plump teardrop whipped-cream kiss profile: soft wide base tapering gracefully to a crisp peak
    const profileR = v === 1
      ? 0.002
      : Math.sin(Math.pow(1 - v, 0.78) * Math.PI * 0.88) * 0.175 + 0.008 * (1 - v);
    const twist = v * 1.55;
    const fluteStrength = 0.22 * (1 - v * 0.65);

    for (let rIdx = 0; rIdx <= radialSegs; rIdx++) {
      const u = rIdx / radialSegs;
      const theta = u * Math.PI * 2;
      const flute = 1 + Math.cos((theta + twist) * 7) * fluteStrength;
      const rad = Math.max(0.002, profileR * flute);
      positions.push(Math.cos(theta) * rad, y, Math.sin(theta) * rad);
      uvs.push(u, v);
    }
  }

  const stride = radialSegs + 1;
  for (let yIdx = 0; yIdx < heightSegs; yIdx++) {
    for (let rIdx = 0; rIdx < radialSegs; rIdx++) {
      const a = yIdx * stride + rIdx;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Outward CCW winding
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export class Shortcake {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.turntable = new THREE.Group();
    this.root.add(this.turntable);

    this.frosting = new FrostingCanvas();
    this.redBerryTex = createStrawberryTexture(false);
    this.pearlBerryTex = createStrawberryTexture(true);
    this.rosetteGeo = createFlutedRosetteGeometry();
    this.candleTextures = CANDLE_STRIPES.map((hex) => createCandleTexture(hex));

    this.creamBlobs = [];
    this.strawberries = [];
    this.tumbledBerries = [];
    this.rosettes = [];
    this.sprinkles = [];
    this.candles = [];
    this.berrySpots = [];

    this.cakeBounce = 0;
    this.spinVelocity = 0;
    this.lastTickAngle = 0;
    this.isFrostedComplete = false;
    this.slicesTaken = 0;

    this._buildStand();
    this._buildCakeBody();
    this._buildBerrySpotGuides();
    this._buildHitVolumes();
  }

  _buildStand() {
    const standMat = new THREE.MeshStandardMaterial({
      color: 0xffbfd7,
      roughness: 0.24,
      metalness: 0.08
    });
    const pearlMat = new THREE.MeshStandardMaterial({
      color: 0xfff8f2,
      roughness: 0.2,
      metalness: 0.1
    });

    // Pedestal base
    const basePts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.88, 0.0),
      new THREE.Vector2(0.84, 0.09),
      new THREE.Vector2(0.38, 0.16),
      new THREE.Vector2(0.32, 0.34),
      new THREE.Vector2(1.52, 0.36),
      new THREE.Vector2(1.58, 0.44),
      new THREE.Vector2(0.0, 0.44)
    ];
    const standGeo = new THREE.LatheGeometry(basePts, 32);
    const standMesh = new THREE.Mesh(standGeo, standMat);
    standMesh.castShadow = true;
    standMesh.receiveShadow = true;
    standMesh.userData.interact = 'stand';
    this.turntable.add(standMesh);

    // Cute pearl trim beads around scalloped rim
    const beadGeo = new THREE.SphereGeometry(0.075, 10, 8);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const bead = new THREE.Mesh(beadGeo, pearlMat);
      bead.position.set(Math.cos(a) * 1.54, 0.39, Math.sin(a) * 1.54);
      this.turntable.add(bead);
    }
  }

  _buildCakeBody() {
    this.cakeGroup = new THREE.Group();
    this.cakeGroup.position.y = STAND_TOP_Y;
    this.turntable.add(this.cakeGroup);

    // Side cylinder + plush beveled top cap sharing our live frosting textures!
    this.sideMat = new THREE.MeshStandardMaterial({
      map: this.frosting.sideTex,
      roughness: 0.56,
      metalness: 0.02
    });
    this.topMat = new THREE.MeshStandardMaterial({
      map: this.frosting.topTex,
      roughness: 0.52,
      metalness: 0.02
    });

    const sideGeo = new THREE.CylinderGeometry(CAKE_RADIUS, CAKE_RADIUS * 1.01, CAKE_HEIGHT, 36, 1, true);
    sideGeo.translate(0, CAKE_HEIGHT * 0.5, 0);
    this.cakeSideMesh = new THREE.Mesh(sideGeo, this.sideMat);
    this.cakeSideMesh.castShadow = true;
    this.cakeSideMesh.receiveShadow = true;
    this.cakeSideMesh.userData.interact = 'cake-side';
    this.cakeGroup.add(this.cakeSideMesh);

    const topGeo = new THREE.CircleGeometry(CAKE_RADIUS, 36);
    topGeo.rotateX(-Math.PI / 2);
    topGeo.translate(0, CAKE_HEIGHT, 0);
    this.cakeTopMesh = new THREE.Mesh(topGeo, this.topMat);
    this.cakeTopMesh.receiveShadow = true;
    this.cakeTopMesh.userData.interact = 'cake-top';
    this.cakeGroup.add(this.cakeTopMesh);

    // Soft rounded upper lip torus so the cake edge looks fluffy & plush when frosted
    this.lipMat = new THREE.MeshStandardMaterial({
      color: 0xf7cf78,
      roughness: 0.5
    });
    this.cakeLip = new THREE.Mesh(
      new THREE.TorusGeometry(CAKE_RADIUS - 0.04, 0.055, 10, 36),
      this.lipMat
    );
    this.cakeLip.rotation.x = Math.PI / 2;
    this.cakeLip.position.y = CAKE_HEIGHT - 0.015;
    this.cakeGroup.add(this.cakeLip);

    // Sub-groups for decorations (rotate together with turntable!)
    this.creamBlobGroup = new THREE.Group();
    this.berryGroup = new THREE.Group();
    this.rosetteGroup = new THREE.Group();
    this.sprinkleGroup = new THREE.Group();
    this.candleGroup = new THREE.Group();
    this.cakeGroup.add(
      this.creamBlobGroup,
      this.berryGroup,
      this.rosetteGroup,
      this.sprinkleGroup,
      this.candleGroup
    );

    // Shared cream blob geometry & material
    this.creamBlobGeo = new THREE.SphereGeometry(0.17, 10, 8);
    this.creamBlobMat = new THREE.MeshStandardMaterial({
      color: 0xfffaf5,
      roughness: 0.28,
      metalness: 0.02
    });
  }

  // Subtle physical cream-dimple rings on top of the frosted cake in Stage 2 (natural affordance!)
  _buildBerrySpotGuides() {
    this.spotGuideGroup = new THREE.Group();
    this.spotGuideGroup.visible = false;
    const spotRingMat = new THREE.MeshStandardMaterial({
      color: 0xffd3e3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.65
    });
    const ringGeo = new THREE.TorusGeometry(0.2, 0.032, 8, 18);
    const ringR = 0.72;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * ringR;
      const z = Math.sin(a) * ringR;
      const ring = new THREE.Mesh(ringGeo, spotRingMat.clone());
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, CAKE_HEIGHT + 0.015, z);
      this.spotGuideGroup.add(ring);
      this.berrySpots.push({ x, z, filled: false, mesh: ring });
    }
    this.cakeGroup.add(this.spotGuideGroup);
  }

  _buildHitVolumes() {
    // Generous invisible collider for forgiving child touch raycasting
    const hitGeo = new THREE.CylinderGeometry(CAKE_RADIUS * 1.15, CAKE_RADIUS * 1.15, CAKE_HEIGHT * 1.12, 20);
    hitGeo.translate(0, CAKE_HEIGHT * 0.52, 0);
    this.hitMesh = new THREE.Mesh(
      hitGeo,
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitMesh.userData.interact = 'cake';
    this.cakeGroup.add(this.hitMesh);
  }

  setShowBerryGuides(show) {
    this.spotGuideGroup.visible = show;
  }

  // Paint cream at a world-space hit point on the cake
  applyCreamAtWorldPoint(worldPoint, loaded = false) {
    // Convert world point into cakeGroup local space
    const local = this.cakeGroup.worldToLocal(worldPoint.clone());
    const r = Math.hypot(local.x, local.z);
    const isTop = local.y >= CAKE_HEIGHT * 0.78 && r <= CAKE_RADIUS * 1.06;

    if (isTop) {
      const nx = THREE.MathUtils.clamp(local.x / CAKE_RADIUS, -0.96, 0.96);
      const nz = THREE.MathUtils.clamp(local.z / CAKE_RADIUS, -0.96, 0.96);
      this.frosting.paintTop(nx, nz, 0.25, loaded);
      this._addCreamBlob(
        nx * CAKE_RADIUS * 0.92,
        CAKE_HEIGHT + 0.01,
        nz * CAKE_RADIUS * 0.92,
        loaded ? 1.25 : 0.95,
        true
      );
      // Also softly brush upper lip if near rim
      if (r > CAKE_RADIUS * 0.65) {
        const angle = Math.atan2(local.x, local.z);
        const u = (angle / (Math.PI * 2) + 1) % 1;
        this.frosting.paintSide(u, 0.92, 0.09, loaded);
      }
    } else {
      const angle = Math.atan2(local.x, local.z);
      const u = (angle / (Math.PI * 2) + 1) % 1;
      const v = THREE.MathUtils.clamp(local.y / CAKE_HEIGHT, 0.05, 0.96);
      this.frosting.paintSide(u, v, 0.11, loaded);
      const dirX = Math.sin(angle);
      const dirZ = Math.cos(angle);
      this._addCreamBlob(
        dirX * (CAKE_RADIUS + 0.01),
        v * CAKE_HEIGHT,
        dirZ * (CAKE_RADIUS + 0.01),
        loaded ? 1.15 : 0.85,
        false
      );
      // Generously feather onto top rim when rubbing high on side
      if (v > 0.72) {
        this.frosting.paintTop(dirX * 0.88, dirZ * 0.88, 0.22, loaded);
      }
    }

    // Blend sponge lip smoothly toward snowy white as coverage climbs
    const cov = this.frosting.getCoverage();
    this.lipMat.color.lerpColors(new THREE.Color(0xf7cf78), new THREE.Color(0xfffaf4), Math.min(1, cov * 1.35));
    this.sideMat.roughness = THREE.MathUtils.lerp(0.56, 0.30, cov);
    this.topMat.roughness = THREE.MathUtils.lerp(0.52, 0.28, cov);
    this.cakeBounce = Math.max(this.cakeBounce, 0.045);
    return cov;
  }

  _addCreamBlob(lx, ly, lz, scaleMul = 1, isTop = true) {
    // Cap total 3D cream blobs for light triangle budget (~90 blobs max)
    if (this.creamBlobs.length >= 90) return;
    // Skip if already very close to an existing blob
    for (let i = 0; i < this.creamBlobs.length; i++) {
      const b = this.creamBlobs[i];
      if (b.position.distanceToSquared(new THREE.Vector3(lx, ly, lz)) < 0.052) {
        return;
      }
    }
    const blob = new THREE.Mesh(this.creamBlobGeo, this.creamBlobMat);
    blob.position.set(lx, ly, lz);
    const sx = (0.95 + Math.random() * 0.45) * scaleMul;
    const sy = isTop ? 0.36 * scaleMul : 0.75 * scaleMul;
    const sz = (0.95 + Math.random() * 0.45) * scaleMul;
    blob.userData.targetScale = new THREE.Vector3(sx, sy, sz);
    blob.scale.set(0.01, 0.01, 0.01);
    this.creamBlobGroup.add(blob);
    this.creamBlobs.push(blob);
  }

  finishFrostingSmooth() {
    this.frosting.finishSmooth();
    this.isFrostedComplete = true;
    this.lipMat.color.set(0xfffaf4);
    this.sideMat.roughness = 0.28;
    this.topMat.roughness = 0.26;

    // Add a clean plush cream scallop trim around the very base of the frosted cake!
    const trimCount = 18;
    for (let i = 0; i < trimCount; i++) {
      const a = (i / trimCount) * Math.PI * 2;
      this._addCreamBlob(
        Math.cos(a) * (CAKE_RADIUS + 0.03),
        0.06,
        Math.sin(a) * (CAKE_RADIUS + 0.03),
        0.92,
        true
      );
    }
    this.cakeBounce = 0.15;
  }

  // Stage 2: Place a plump strawberry at world X/Z (with gentle magnetic snap + playful stacking tumble!)
  placeStrawberryAtWorld(worldPoint, isPearl = false) {
    const local = this.cakeGroup.worldToLocal(worldPoint.clone());
    let lx = local.x;
    let lz = local.z;

    // Clamp onto top surface
    const dist = Math.hypot(lx, lz);
    if (dist > CAKE_RADIUS * 0.84) {
      const s = (CAKE_RADIUS * 0.84) / dist;
      lx *= s;
      lz *= s;
    }

    // Gentle magnetic snap to closest unfilled crown spot if within forgiving distance
    let matchedSpot = null;
    let bestDist = 0.36;
    for (const spot of this.berrySpots) {
      if (spot.filled) continue;
      const d = Math.hypot(lx - spot.x, lz - spot.z);
      if (d < bestDist) {
        bestDist = d;
        matchedSpot = spot;
      }
    }
    if (matchedSpot) {
      lx = matchedSpot.x;
      lz = matchedSpot.z;
      matchedSpot.filled = true;
      matchedSpot.mesh.visible = false;
    }

    // Check if stacking on top of an existing strawberry!
    let stackHeight = 0;
    for (const b of this.strawberries) {
      const d = Math.hypot(lx - b.group.position.x, lz - b.group.position.z);
      if (d < 0.28) {
        stackHeight = Math.max(stackHeight, (b.stackLevel || 0) + 1);
      }
    }

    const berry = createStrawberryMesh(this.redBerryTex, this.pearlBerryTex, isPearl);

    // If stacked 2+ high -> playful tumble down into the cream (learning cause-and-effect + giggles)!
    if (stackHeight >= 2) {
      berry.position.set(lx, CAKE_HEIGHT + 0.72, lz);
      this.berryGroup.add(berry);
      const outAngle = Math.atan2(lz, lx) + (Math.random() - 0.5) * 0.8;
      this.tumbledBerries.push({
        group: berry,
        vel: new THREE.Vector3(Math.cos(outAngle) * 1.1, 1.5, Math.sin(outAngle) * 1.1),
        rotVel: new THREE.Vector3(4, 3, 5),
        settled: false
      });
      this.cakeBounce = 0.11;
      return { tumbled: true, worldPos: this.cakeGroup.localToWorld(berry.position.clone()), count: this.strawberries.length };
    }

    const baseY = CAKE_HEIGHT + stackHeight * 0.36;
    berry.position.set(lx, baseY, lz);
    berry.rotation.y = Math.random() * Math.PI * 2;
    // Slight playful tilt outward on ring
    berry.rotation.z = (Math.random() - 0.5) * 0.14;
    berry.rotation.x = (Math.random() - 0.5) * 0.14;
    berry.scale.set(1.28, 0.62, 1.28); // juicy landing squash!

    // Cream cushion collar under the berry
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.055, 8, 14),
      this.creamBlobMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.025;
    berry.add(collar);

    berry.userData.interact = 'placed-berry';
    this.berryGroup.add(berry);

    const record = {
      group: berry,
      baseY,
      stackLevel: stackHeight,
      isPearl,
      jiggle: 1.0,
      scaleSpring: 1.0
    };
    this.strawberries.push(record);
    this.cakeBounce = 0.12;

    return {
      tumbled: false,
      isPearl,
      worldPos: this.cakeGroup.localToWorld(new THREE.Vector3(lx, baseY + 0.25, lz)),
      count: this.strawberries.length
    };
  }

  jiggleNearestBerry(worldPoint) {
    const local = this.cakeGroup.worldToLocal(worldPoint.clone());
    let nearest = null;
    let bestD = 0.45;
    for (const b of this.strawberries) {
      const d = Math.hypot(local.x - b.group.position.x, local.z - b.group.position.z);
      if (d < bestD) {
        bestD = d;
        nearest = b;
      }
    }
    if (nearest) {
      nearest.jiggle = 1.0;
      return true;
    }
    return false;
  }

  // Stage 3: Start a growing star-fluted cream rosette at world point
  startRosetteAtWorld(worldPoint, colorIndex = 0) {
    if (this.rosettes.length >= 42) {
      // Remove oldest tiny bead if overflowing cap so performance stays rock-solid
      const old = this.rosettes.shift();
      this.rosetteGroup.remove(old.mesh);
    }
    const local = this.cakeGroup.worldToLocal(worldPoint.clone());
    const dist = Math.hypot(local.x, local.z);
    if (dist > CAKE_RADIUS * 0.93) {
      const s = (CAKE_RADIUS * 0.93) / dist;
      local.x *= s;
      local.z *= s;
    }

    const col = CREAM_COLORS[colorIndex % CREAM_COLORS.length].hex;
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.24,
      metalness: 0.03
    });
    const mesh = new THREE.Mesh(this.rosetteGeo, mat);
    mesh.position.set(local.x, CAKE_HEIGHT - 0.01, local.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.set(0.35, 0.25, 0.35);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.rosetteGroup.add(mesh);

    const record = {
      mesh,
      growth: 0.25,
      colorIndex,
      popped: false,
      wobble: 0.6
    };
    this.rosettes.push(record);
    this.cakeBounce = 0.07;
    return record;
  }

    // Grow active rosette while finger holds down! Returns { progress, justPopped, worldPos }
  growRosette(record, dt) {
    if (!record) return { progress: 0, justPopped: false };
    record.growth = Math.min(1.35, record.growth + dt * 1.05);
    const g = record.growth;
    const sx = 0.55 + g * 0.55;
    const sy = 0.45 + g * 0.72;
    record.mesh.scale.set(sx, sy, sx);
    record.mesh.rotation.y += dt * 1.4;

    let justPopped = false;
    if (g >= 1.25 && !record.popped) {
      record.popped = true;
      record.wobble = 1.2;
      justPopped = true;
      this.addSprinkleShower(record.mesh.position);
      this.cakeBounce = 0.16;
    }
    return {
      progress: g / 1.25,
      justPopped,
      worldPos: this.cakeGroup.localToWorld(record.mesh.position.clone().add(new THREE.Vector3(0, 0.30 * sy, 0)))
    };
  }

  // Cute pastel sugar pearls & star sprinkles scattered on the cake!
  addSprinkleShower(localCenter) {
    const colors = [0xff8fbc, 0xffe47a, 0x9bf0d2, 0xd0b5ff, 0xffffff];
    const geo = new THREE.SphereGeometry(0.038, 8, 6);
    for (let i = 0; i < 14; i++) {
      if (this.sprinkles.length >= 90) break;
      const a = Math.random() * Math.PI * 2;
      const rad = 0.1 + Math.random() * 0.65;
      let sx = localCenter.x + Math.cos(a) * rad;
      let sz = localCenter.z + Math.sin(a) * rad;
      const d = Math.hypot(sx, sz);
      if (d > CAKE_RADIUS * 0.9) {
        sx *= (CAKE_RADIUS * 0.9) / d;
        sz *= (CAKE_RADIUS * 0.9) / d;
      }
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.22, metalness: 0.1 })
      );
      m.position.set(sx, CAKE_HEIGHT + 0.025, sz);
      this.sprinkleGroup.add(m);
      this.sprinkles.push(m);
    }
  }

  // Stage 4: Plant a chunky pastel-striped birthday candle & light its glowing flame!
  placeCandleAtWorld(worldPoint, candleIndex) {
    const local = this.cakeGroup.worldToLocal(worldPoint.clone());
    // Keep comfortably inside cake top
    let lx = local.x;
    let lz = local.z;
    const dist = Math.hypot(lx, lz);
    if (dist > CAKE_RADIUS * 0.68) {
      const s = (CAKE_RADIUS * 0.68) / dist;
      lx *= s;
      lz *= s;
    }
    // Avoid overlapping existing candles directly
    for (const c of this.candles) {
      const dx = lx - c.group.position.x;
      const dz = lz - c.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.26) {
        const pushA = d > 0.01 ? Math.atan2(dz, dx) : candleIndex * 1.25;
        lx = c.group.position.x + Math.cos(pushA) * 0.3;
        lz = c.group.position.z + Math.sin(pushA) * 0.3;
      }
    }

    const group = new THREE.Group();
    group.position.set(lx, CAKE_HEIGHT - 0.04, lz);

    const h = 0.72 + (candleIndex === 2 ? 0.1 : 0);
    const waxMat = new THREE.MeshStandardMaterial({
      map: this.candleTextures[candleIndex % this.candleTextures.length],
      roughness: 0.28,
      metalness: 0.04
    });
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, h, 14), waxMat);
    wax.position.y = h * 0.5;
    wax.castShadow = true;
    group.add(wax);

    // Cute cream holder ring at base
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.11, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, roughness: 0.25 })
    );
    holder.position.y = 0.04;
    group.add(holder);

    // Little dark wick
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6),
      new THREE.MeshBasicMaterial({ color: 0x4a353b })
    );
    wick.position.y = h + 0.03;
    group.add(wick);

    // Layered glowing teardrop flame!
    const flameGroup = new THREE.Group();
    flameGroup.position.y = h + 0.16;

    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      transparent: true,
      opacity: 0.92
    });
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xfff9d6 });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.32
    });

    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 12), outerFlameMat);
    outerFlame.position.y = 0.03;
    const outerBase = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), outerFlameMat);
    outerBase.position.y = -0.05;
    const innerFlame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), innerFlameMat);
    innerFlame.scale.set(0.85, 1.45, 0.85);
    innerFlame.position.y = -0.03;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), haloMat);

    flameGroup.add(outerFlame, outerBase, innerFlame, halo);
    group.add(flameGroup);

    group.userData.interact = 'candle';
    this.candleGroup.add(group);

    const record = {
      group,
      flameGroup,
      lit: true,
      wobble: 1.0,
      phase: Math.random() * Math.PI * 2,
      index: candleIndex
    };
    this.candles.push(record);
    this.cakeBounce = 0.11;

    return {
      record,
      worldPos: this.cakeGroup.localToWorld(new THREE.Vector3(lx, CAKE_HEIGHT + h + 0.16, lz))
    };
  }

  getLitCandleCount() {
    let n = 0;
    for (const c of this.candles) if (c.lit) n++;
    return n;
  }

  // Blow out candles near a world point (or blow out next lit candle!)
  blowOutCandle(worldPoint = null) {
    let target = null;
    if (worldPoint) {
      let best = 1.2;
      for (const c of this.candles) {
        if (!c.lit) continue;
        const wp = c.flameGroup.getWorldPosition(new THREE.Vector3());
        const d = wp.distanceTo(worldPoint);
        if (d < best) {
          best = d;
          target = c;
        }
      }
    }
    if (!target) {
      target = this.candles.find((c) => c.lit);
    }
    if (!target) return null;
    target.lit = false;
    target.flameGroup.visible = false;
    target.wobble = 1.0;
    const wp = target.flameGroup.getWorldPosition(new THREE.Vector3());
    return { worldPos: wp, remaining: this.getLitCandleCount() };
  }

  // Stage 5: Build a delicious 3D cake wedge slice matching the player's creation!
  createCakeSliceMesh(lastCreamColorIndex = 0) {
    const sliceGroup = new THREE.Group();

    // Triangular cake wedge shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.86, -0.32);
    shape.quadraticCurveTo(0.95, 0, 0.86, 0.32);
    shape.closePath();

    const spongeMat = new THREE.MeshStandardMaterial({ color: 0xf9d37d, roughness: 0.55 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.28 });
    const jamMat = new THREE.MeshStandardMaterial({ color: 0xff6e9c, roughness: 0.25 });

    // Bottom sponge layer
    const bot = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: false }),
      spongeMat
    );
    bot.rotation.x = -Math.PI / 2;
    sliceGroup.add(bot);

    // Cream & berry jam filling layer
    const midCream = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }),
      creamMat
    );
    midCream.rotation.x = -Math.PI / 2;
    midCream.position.y = 0.24;
    sliceGroup.add(midCream);

    const midJam = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false }),
      jamMat
    );
    midJam.rotation.x = -Math.PI / 2;
    midJam.position.y = 0.29;
    sliceGroup.add(midJam);

    // Top sponge layer
    const topSp = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: false }),
      spongeMat
    );
    topSp.rotation.x = -Math.PI / 2;
    topSp.position.y = 0.34;
    sliceGroup.add(topSp);

    // Glossy white frosted roof + back wall!
    const topFrost = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2 }),
      creamMat
    );
    topFrost.rotation.x = -Math.PI / 2;
    topFrost.position.y = 0.58;
    sliceGroup.add(topFrost);

    // Piped rosette matching player's cream color + shiny mini strawberry on top!
    const rosCol = CREAM_COLORS[lastCreamColorIndex % CREAM_COLORS.length].hex;
    const ros = new THREE.Mesh(
      this.rosetteGeo,
      new THREE.MeshStandardMaterial({ color: rosCol, roughness: 0.24 })
    );
    ros.scale.setScalar(0.75);
    ros.position.set(0.55, 0.67, 0);
    sliceGroup.add(ros);

    const miniBerry = createStrawberryMesh(this.redBerryTex, this.pearlBerryTex, false);
    miniBerry.scale.setScalar(0.75);
    miniBerry.position.set(0.55, 0.85, 0);
    sliceGroup.add(miniBerry);

    // Center pivot nicely
    sliceGroup.children.forEach((c) => { c.position.x -= 0.42; });
    return sliceGroup;
  }

  spinBy(deltaRad) {
    this.turntable.rotation.y += deltaRad;
    this.spinVelocity = deltaRad * 10;
    const diff = Math.abs(this.turntable.rotation.y - this.lastTickAngle);
    if (diff > 0.38) {
      this.lastTickAngle = this.turntable.rotation.y;
      return true; // play wooden turntable click
    }
    return false;
  }

  reset() {
    this.frosting.reset();
    this.isFrostedComplete = false;
    this.slicesTaken = 0;
    this.lipMat.color.set(0xf7cf78);
    this.sideMat.roughness = 0.56;
    this.topMat.roughness = 0.52;
    this.turntable.rotation.y = 0;
    this.spinVelocity = 0;

    // Clear all decorations cleanly
    const clearGroup = (grp, arr) => {
      while (grp.children.length > 0) grp.remove(grp.children[0]);
      arr.length = 0;
    };
    clearGroup(this.creamBlobGroup, this.creamBlobs);
    clearGroup(this.berryGroup, this.strawberries);
    this.tumbledBerries.length = 0;
    clearGroup(this.rosetteGroup, this.rosettes);
    clearGroup(this.sprinkleGroup, this.sprinkles);
    clearGroup(this.candleGroup, this.candles);

    for (const s of this.berrySpots) {
      s.filled = false;
      s.mesh.visible = true;
    }
    this.spotGuideGroup.visible = false;
    this.cakeBounce = 0.22;
  }

  update(dt, time) {
    // Gentle turntable inertia
    if (Math.abs(this.spinVelocity) > 0.002) {
      this.turntable.rotation.y += this.spinVelocity * dt;
      this.spinVelocity *= Math.pow(0.08, dt);
    }

    // Springy cake squish-and-bounce feedback!
    if (this.cakeBounce > 0.001) {
      this.cakeBounce = Math.max(0, this.cakeBounce - dt * 0.55);
      const wave = Math.sin(time * 24) * this.cakeBounce;
      this.cakeGroup.scale.set(1 + wave * 0.5, 1 - wave * 0.7, 1 + wave * 0.5);
    } else {
      this.cakeGroup.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12));
    }

    // Pop-in cream blobs smoothly
    for (const b of this.creamBlobs) {
      if (b.userData.targetScale) {
        b.scale.lerp(b.userData.targetScale, Math.min(1, dt * 14));
      }
    }

    // Subtle breathing on Stage 2 berry spot rings
    if (this.spotGuideGroup.visible) {
      const pulse = 0.94 + Math.sin(time * 3.5) * 0.07;
      for (const s of this.berrySpots) {
        if (!s.filled) s.mesh.scale.setScalar(pulse);
      }
    }

    // Strawberry jelly spring bounce
    for (const b of this.strawberries) {
      if (b.jiggle > 0.005) {
        b.jiggle = Math.max(0, b.jiggle - dt * 2.2);
        const w = Math.sin(b.jiggle * 18) * b.jiggle * 0.26;
        b.group.scale.set(1 + w, 1 - w * 0.9, 1 + w);
      } else {
        b.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12));
      }
    }

    // Tumbled stacked strawberries playful bounce onto cake stand rim!
    for (const tb of this.tumbledBerries) {
      if (tb.settled) continue;
      tb.vel.y -= 8.5 * dt;
      tb.group.position.addScaledVector(tb.vel, dt);
      tb.group.rotation.x += tb.rotVel.x * dt;
      tb.group.rotation.z += tb.rotVel.z * dt;
      if (tb.group.position.y <= 0.14) {
        tb.group.position.y = 0.14;
        tb.vel.y = Math.abs(tb.vel.y) * 0.35;
        tb.vel.x *= 0.65;
        tb.vel.z *= 0.65;
        if (Math.abs(tb.vel.y) < 0.2) {
          tb.settled = true;
        }
      }
    }

    // Rosette wobble
    for (const r of this.rosettes) {
      if (r.wobble > 0.01) {
        r.wobble = Math.max(0, r.wobble - dt * 2.4);
        const s = Math.sin(r.wobble * 22) * r.wobble * 0.14;
        r.mesh.rotation.z = s;
      } else {
        r.mesh.rotation.z *= 0.85;
      }
    }

    // Candle rubbery wobble & lively teardrop flames!
    for (const c of this.candles) {
      if (c.wobble > 0.01) {
        c.wobble = Math.max(0, c.wobble - dt * 2.4);
        c.group.rotation.z = Math.sin(c.wobble * 20) * c.wobble * 0.22;
      } else {
        c.group.rotation.z *= 0.88;
      }
      if (c.lit) {
        const f1 = 1 + Math.sin(time * 14 + c.phase) * 0.12;
        const f2 = 1 + Math.cos(time * 19 + c.phase) * 0.1;
        c.flameGroup.scale.set(f2, f1, f2);
        c.flameGroup.rotation.z = Math.sin(time * 9 + c.phase) * 0.1;
      }
    }
  }
}
