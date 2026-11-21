import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export const SYRUP_DEFS = [
  { id: 'strawberry', color: new THREE.Color('#ee1138'), liquidHex: 0xee1138, capHex: 0xff3358 },
  { id: 'lemon',      color: new THREE.Color('#ffbe0b'), liquidHex: 0xffbe0b, capHex: 0xffd438 },
  { id: 'melon',      color: new THREE.Color('#0ec44e'), liquidHex: 0x0ec44e, capHex: 0x28df68 },
  { id: 'blue',       color: new THREE.Color('#0b8ef5'), liquidHex: 0x0b8ef5, capHex: 0x36aaff },
];

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// Shared cached geometries/materials so fruit dishes & toppings use minimal draw calls!
let _sharedCalyxGeo = null;
function getSharedCalyxGeo() {
  if (_sharedCalyxGeo) return _sharedCalyxGeo;
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const leafGeo = new THREE.ConeGeometry(0.052, 0.115, 5);
    leafGeo.scale(1.0, 0.30, 0.50);
    const a = (i / 6) * Math.PI * 2;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, -a + Math.PI * 0.5, 0));
    m.compose(
      new THREE.Vector3(Math.cos(a) * 0.058, 0.132, Math.sin(a) * 0.058),
      q,
      new THREE.Vector3(1, 1, 1)
    );
    leafGeo.applyMatrix4(m);
    parts.push(leafGeo);
  }
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.055, 6);
  stem.translate(0, 0.155, 0);
  parts.push(stem);
  _sharedCalyxGeo = BufferGeometryUtils.mergeGeometries(parts);
  return _sharedCalyxGeo;
}

export function createFruitMesh(kind, textures, scale = 1.0) {
  const group = new THREE.Group();
  group.userData.fruitKind = kind;

  if (kind === 0) {
    // Plump Glossy Strawberry with dimpled seed skin + merged green leafy calyx (2 draw calls total!)
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const y = (t - 0.45) * 0.31;
      const r = Math.sin(Math.pow(t, 0.72) * Math.PI) * (0.152 * (1.0 - t * 0.22));
      pts.push(new THREE.Vector2(Math.max(0.002, r), -y));
    }
    const geo = new THREE.LatheGeometry(pts, 18);
    const mat = textures._strawMat || (textures._strawMat = new THREE.MeshPhysicalMaterial({
      map: textures.strawberryMap,
      bumpMap: textures.strawberryBump,
      bumpScale: 0.014,
      roughness: 0.20,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    }));
    const berry = new THREE.Mesh(geo, mat);
    berry.castShadow = true;
    group.add(berry);

    const leafMat = textures._leafMat || (textures._leafMat = new THREE.MeshStandardMaterial({
      color: 0x26993a,
      roughness: 0.46,
    }));
    group.add(new THREE.Mesh(getSharedCalyxGeo(), leafMat));
  } else if (kind === 1) {
    // Juicy Emerald Melon Crescent Wedge
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.18, Math.PI * 1.08, Math.PI * 1.92, false);
    shape.quadraticCurveTo(0, -0.02, -0.17, -0.045);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.014,
      bevelSegments: 2,
      curveSegments: 14,
    });
    geo.center();
    const mat = textures._melonMat || (textures._melonMat = new THREE.MeshPhysicalMaterial({
      color: 0x5ee858,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.14,
    }));
    const flesh = new THREE.Mesh(geo, mat);
    flesh.castShadow = true;
    group.add(flesh);

    const rindGeo = new THREE.TorusGeometry(0.175, 0.026, 8, 14, Math.PI * 0.84);
    const rindMat = textures._rindMat || (textures._rindMat = new THREE.MeshStandardMaterial({
      color: 0x267334,
      bumpMap: textures.snowBump,
      bumpScale: 0.008,
      roughness: 0.62,
    }));
    const rind = new THREE.Mesh(rindGeo, rindMat);
    rind.rotation.z = Math.PI * 1.08;
    rind.position.y = 0.065;
    group.add(rind);
  } else if (kind === 2) {
    // Plump Glossy Golden Mango Cushion Cube
    const geo = new THREE.SphereGeometry(0.14, 16, 12);
    geo.scale(1.18, 0.78, 0.96);
    const mat = textures._mangoMat || (textures._mangoMat = new THREE.MeshPhysicalMaterial({
      color: 0xff9a0d,
      roughness: 0.16,
      clearcoat: 0.92,
      clearcoatRoughness: 0.10,
    }));
    const mango = new THREE.Mesh(geo, mat);
    mango.castShadow = true;
    group.add(mango);
  } else {
    // Twin Glossy Ruby Cherries on Merged Green Stem
    const cherryMat = textures._cherryMat || (textures._cherryMat = new THREE.MeshPhysicalMaterial({
      color: 0xd40628,
      roughness: 0.10,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }));
    const c1 = new THREE.SphereGeometry(0.095, 14, 12);
    c1.translate(-0.072, -0.02, 0.01);
    const c2 = new THREE.SphereGeometry(0.095, 14, 12);
    c2.translate(0.072, -0.01, -0.01);
    const cherries = new THREE.Mesh(BufferGeometryUtils.mergeGeometries([c1, c2]), cherryMat);
    cherries.castShadow = true;
    group.add(cherries);

    const curve1 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.065, 0.05, 0.01),
      new THREE.Vector3(-0.02, 0.20, 0),
      new THREE.Vector3(0.01, 0.24, 0)
    );
    const curve2 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.065, 0.06, -0.01),
      new THREE.Vector3(0.03, 0.20, 0),
      new THREE.Vector3(0.01, 0.24, 0)
    );
    const stemMat = textures._leafMat || (textures._leafMat = new THREE.MeshStandardMaterial({ color: 0x26993a, roughness: 0.46 }));
    const stems = BufferGeometryUtils.mergeGeometries([
      new THREE.TubeGeometry(curve1, 7, 0.011, 6, false),
      new THREE.TubeGeometry(curve2, 7, 0.011, 6, false),
    ]);
    group.add(new THREE.Mesh(stems, stemMat));
  }

  group.scale.setScalar(scale);
  return group;
}

// Retro Cast-Iron Miniature Kakigori Machine — Positioned cleanly on left so customer's face is 100% unobstructed!
export class KakigoriMachine {
  constructor(textures) {
    this.group = new THREE.Group();
    this.wheelAngle = 0;
    this.swingAngle = 0;
    this.targetSwingAngle = 0; // 0 = over bowl, -0.48 = swung toward front-left away from bowl & customer!

    const turquoiseIron = new THREE.MeshStandardMaterial({
      color: 0x1b8391,
      bumpMap: textures.ironBump,
      bumpScale: 0.014,
      roughness: 0.34,
      metalness: 0.24,
    });
    const creamIron = new THREE.MeshStandardMaterial({
      color: 0xf6efe0,
      bumpMap: textures.ironBump,
      bumpScale: 0.009,
      roughness: 0.38,
      metalness: 0.12,
    });
    const redAccent = new THREE.MeshStandardMaterial({
      color: 0xdc2b3c,
      roughness: 0.32,
      metalness: 0.18,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe6b44c,
      roughness: 0.22,
      metalness: 0.86,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xdce4ea,
      roughness: 0.20,
      metalness: 0.88,
    });

    // Heavy cast-iron pedestal base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.16, 24), turquoiseIron);
    base.position.y = 0.08;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 10, 24), creamIron);
    baseRim.rotation.x = Math.PI / 2;
    baseRim.position.y = 0.16;
    this.group.add(baseRim);

    // Sturdy vertical pillar
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 1.38, 20), turquoiseIron);
    pillar.position.y = 0.84;
    pillar.castShadow = true;
    this.group.add(pillar);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20), brassMat);
    collar.position.y = 1.48;
    this.group.add(collar);

    // Swinging Gooseneck Upper Arm
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.50, 0);
    this.group.add(this.headPivot);

    // Reach from machine pillar (-1.02, z=1.18) right to bowl (-0.08, z=1.54) -> offset (+0.94, z=+0.36)
    const reachX = 0.94;
    const reachZ = 0.36;

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.0, 0),
      new THREE.Vector3(0.28, 0.38, 0.11),
      new THREE.Vector3(0.70, 0.50, 0.27),
      new THREE.Vector3(reachX, 0.38, reachZ),
    ]);
    const armMesh = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 18, 0.105, 12, false), turquoiseIron);
    armMesh.castShadow = true;
    this.headPivot.add(armMesh);

    const lowerBraceCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.04, -0.32, 0.02),
      new THREE.Vector3(0.48, -0.22, 0.19),
      new THREE.Vector3(reachX, -0.05, reachZ)
    );
    const lowerBrace = new THREE.Mesh(new THREE.TubeGeometry(lowerBraceCurve, 12, 0.065, 10, false), turquoiseIron);
    lowerBrace.castShadow = true;
    this.headPivot.add(lowerBrace);

    // Shaver Blade Drum
    this.chuteGroup = new THREE.Group();
    this.chuteGroup.position.set(reachX, -0.05, reachZ);
    this.headPivot.add(this.chuteGroup);

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.24, 0.14, 22), creamIron);
    drum.castShadow = true;
    this.chuteGroup.add(drum);

    const drumRim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.024, 10, 22), turquoiseIron);
    drumRim.rotation.x = Math.PI / 2;
    drumRim.position.y = 0.06;
    this.chuteGroup.add(drumRim);

    const chuteCone = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.10, 0.10, 18, 1, true), steelMat);
    chuteCone.position.y = -0.10;
    this.chuteGroup.add(chuteCone);

    // Sparkling Translucent Ice Block
    this.iceBlockGroup = new THREE.Group();
    this.iceBlockGroup.position.set(reachX, 0.14, reachZ);
    this.headPivot.add(this.iceBlockGroup);

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9f4ff,
      roughness: 0.08,
      transmission: 0.72,
      thickness: 0.55,
      ior: 1.31,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    this.iceMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.30, 18), iceMat);
    this.iceMesh.position.y = 0.15;
    this.iceBlockGroup.add(this.iceMesh);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x99dcff,
      emissiveIntensity: 0.22,
      roughness: 0.28,
      transparent: true,
      opacity: 0.55,
    });
    this.iceCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.22, 12), coreMat);
    this.iceCore.position.y = 0.15;
    this.iceBlockGroup.add(this.iceCore);

    // Vertical Spindle + Clamp
    this.spindleGroup = new THREE.Group();
    this.spindleGroup.position.set(reachX, 0.44, reachZ);
    this.headPivot.add(this.spindleGroup);

    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.54, 10), steelMat);
    spindle.position.y = 0.12;
    this.spindleGroup.add(spindle);

    this.clampPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.23, 0.048, 16), brassMat);
    this.clampPlate.position.y = 0.01;
    this.spindleGroup.add(this.clampPlate);

    // Merged Single-Mesh Brass Bevel Gears (1 draw call each!)
    this.topGear = this._makeMergedGear(0.14, 12, brassMat);
    this.topGear.position.set(reachX, 0.49, reachZ);
    this.headPivot.add(this.topGear);

    this.sideGear = this._makeMergedGear(0.13, 12, brassMat);
    this.sideGear.rotation.z = Math.PI * 0.42;
    this.sideGear.position.set(reachX - 0.14, 0.51, reachZ - 0.05);
    this.headPivot.add(this.sideGear);

    // Prominent Spoked Hand-Wheel positioned cleanly inside left frame!
    this.wheelHubPos = new THREE.Vector3(0.06, 0.02, 0.42);
    const axleCurve = new THREE.LineCurve3(this.wheelHubPos, new THREE.Vector3(0.28, 0.36, 0.11));
    this.headPivot.add(new THREE.Mesh(new THREE.TubeGeometry(axleCurve, 6, 0.072, 10, false), creamIron));

    this.wheelGroup = new THREE.Group();
    this.wheelGroup.position.copy(this.wheelHubPos);
    this.wheelGroup.rotation.y = 0.26;
    this.wheelGroup.rotation.x = -0.10;
    this.headPivot.add(this.wheelGroup);

    const wheelRadius = 0.47;
    const outerRim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.046, 14, 34), redAccent);
    outerRim.castShadow = true;
    this.wheelGroup.add(outerRim);

    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius - 0.038, 0.020, 8, 32), creamIron);
    this.wheelGroup.add(innerRim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.11, 16), brassMat);
    hub.rotation.x = Math.PI / 2;
    this.wheelGroup.add(hub);

    // Merge 5 curved spokes into 1 single draw call!
    const spokeGeos = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spokeCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(a + 0.32) * 0.17, Math.sin(a + 0.32) * 0.17, 0),
        new THREE.Vector3(Math.cos(a - 0.22) * 0.32, Math.sin(a - 0.22) * 0.32, 0),
        new THREE.Vector3(Math.cos(a) * (wheelRadius - 0.025), Math.sin(a) * (wheelRadius - 0.025), 0)
      );
      spokeGeos.push(new THREE.TubeGeometry(spokeCurve, 9, 0.024, 7, false));
    }
    const spokesMesh = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(spokeGeos), turquoiseIron);
    spokesMesh.castShadow = true;
    this.wheelGroup.add(spokesMesh);

    // Warm Turned Wood Handle Knob sticking out clearly!
    this.knobAnchor = new THREE.Group();
    this.knobAnchor.position.set(wheelRadius * 0.88, 0, 0.04);
    this.wheelGroup.add(this.knobAnchor);

    const knobStem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.15, 10), brassMat);
    knobStem.rotation.x = Math.PI / 2;
    knobStem.position.z = 0.075;
    this.knobAnchor.add(knobStem);

    const woodKnobMat = new THREE.MeshStandardMaterial({
      map: textures.woodMap,
      roughness: 0.28,
      color: 0xf7a452,
    });
    this.knobMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 8, 14), woodKnobMat);
    this.knobMesh.rotation.x = Math.PI / 2;
    this.knobMesh.position.z = 0.19;
    this.knobMesh.castShadow = true;
    this.knobAnchor.add(this.knobMesh);

    // Generous invisible collider around wheel & handle
    this.wheelCollider = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.wheelCollider.position.z = 0.08;
    this.wheelCollider.userData.hitRole = 'wheel';
    this.wheelGroup.add(this.wheelCollider);
  }

  _makeMergedGear(radius, teeth, mat) {
    const parts = [new THREE.CylinderGeometry(radius * 0.84, radius, 0.055, 18)];
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = new THREE.BoxGeometry(0.038, 0.058, 0.048);
      const m = new THREE.Matrix4().makeRotationY(-a);
      m.setPosition(Math.cos(a) * radius * 0.95, 0, Math.sin(a) * radius * 0.95);
      tooth.applyMatrix4(m);
      parts.push(tooth);
    }
    return new THREE.Mesh(BufferGeometryUtils.mergeGeometries(parts), mat);
  }

  crank(deltaRadians, iceProgress) {
    this.wheelAngle += deltaRadians;
    this.wheelGroup.rotation.z = -this.wheelAngle;
    this.topGear.rotation.y = this.wheelAngle * 1.6;
    this.sideGear.rotation.x = -this.wheelAngle * 1.6;
    this.iceBlockGroup.rotation.y = this.wheelAngle * 0.85;

    const remain = Math.max(0.36, 1.0 - Math.min(1.15, iceProgress) * 0.54);
    this.iceMesh.scale.y = remain;
    this.iceMesh.position.y = 0.15 * remain;
    this.iceCore.scale.y = remain;
    this.iceCore.position.y = 0.15 * remain;
    this.clampPlate.position.y = -0.30 * (1 - remain) + 0.01;
    this.spindleGroup.position.y = 0.44 - 0.14 * (1 - remain);
  }

  resetIceBlock() {
    this.iceMesh.scale.set(1, 0.05, 1);
    this.iceDropAnim = 0.001;
    this.targetSwingAngle = 0;
  }

  getKnobWorldPosition(out = new THREE.Vector3()) {
    this.knobMesh.getWorldPosition(out);
    return out;
  }

  getChuteWorldPosition(out = new THREE.Vector3()) {
    this.chuteGroup.getWorldPosition(out);
    out.y -= 0.13;
    return out;
  }

  update(dt, elapsed, attractBounce = 0) {
    this.swingAngle += (this.targetSwingAngle - this.swingAngle) * Math.min(1, dt * 8.5);
    // Lift & tilt gooseneck arm cleanly up-and-left when decorating so mound & customer have 100% open space!
    const openAmt = Math.max(0, -this.swingAngle);
    this.headPivot.rotation.z = openAmt * 0.72;
    this.headPivot.rotation.y = -openAmt * 0.22;
    this.headPivot.position.y = 1.50 + openAmt * 0.22;

    if (this.iceDropAnim > 0) {
      this.iceDropAnim = Math.min(1, this.iceDropAnim + dt * 4.2);
      const ease = 1 - Math.pow(1 - this.iceDropAnim, 3);
      this.iceMesh.scale.set(1, ease, 1);
      this.iceMesh.position.y = 0.15 * ease + (1 - ease) * 0.22;
      this.iceCore.scale.set(1, ease, 1);
      this.iceCore.position.y = this.iceMesh.position.y;
      this.clampPlate.position.y = 0.01;
      this.spindleGroup.position.y = 0.44;
      if (this.iceDropAnim >= 1) this.iceDropAnim = 0;
    }

    if (attractBounce > 0) {
      this.wheelGroup.rotation.z = -this.wheelAngle + Math.sin(elapsed * 4.2) * 0.09 * attractBounce;
    }
  }
}

// Scalloped Pressed-Glass Bowl + Smooth Fluffy Indexed Snow Mountain + Vivid Pigment Mixing!
export class KakigoriBowl {
  constructor(textures) {
    this.textures = textures;
    this.group = new THREE.Group();
    this.homePos = new THREE.Vector3(-0.08, 0.76, 1.54);
    this.group.position.copy(this.homePos);

    this.iceProgress = 0;
    this.jiggle = 0;
    this.jiggleVel = 0;
    this.overflowCount = 0;
    this.syrupDropsCount = 0;
    this.milkDropsCount = 0;
    this.colorChannelTotals = [0, 0, 0, 0];
    this.mixedZonesCount = 0;
    this.placedFruits = [];
    this.milkBeads = [];
    this.spillPuffs = [];

    this._buildCoasterAndBowl();
    this._buildSnowMound();
    this._buildSpoon();
    this._buildHitTarget();
  }

  _buildCoasterAndBowl() {
    const coasterMat = new THREE.MeshStandardMaterial({
      map: this.textures.darkWoodMap,
      roughness: 0.40,
      metalness: 0.05,
    });
    const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.068, 28), coasterMat);
    coaster.position.y = 0.034;
    coaster.castShadow = true;
    coaster.receiveShadow = true;
    this.group.add(coaster);

    const coasterRim = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.025, 10, 28), coasterMat);
    coasterRim.rotation.x = Math.PI / 2;
    coasterRim.position.y = 0.065;
    this.group.add(coasterRim);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f6ff,
      roughness: 0.06,
      metalness: 0.0,
      transmission: 0.82,
      thickness: 0.35,
      ior: 1.49,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    });

    const footPts = [
      new THREE.Vector2(0.001, 0.06),
      new THREE.Vector2(0.32, 0.06),
      new THREE.Vector2(0.30, 0.11),
      new THREE.Vector2(0.12, 0.16),
      new THREE.Vector2(0.11, 0.26),
      new THREE.Vector2(0.22, 0.31),
    ];
    const footMesh = new THREE.Mesh(new THREE.LatheGeometry(footPts, 28), glassMat);
    footMesh.castShadow = true;
    this.group.add(footMesh);

    const radialSegs = 48;
    const heightSegs = 14;
    const bowlGeo = new THREE.BufferGeometry();
    const pos = [];
    const uvs = [];
    const indices = [];

    for (let iy = 0; iy <= heightSegs; iy++) {
      const v = iy / heightSegs;
      for (let ix = 0; ix <= radialSegs; ix++) {
        const u = ix / radialSegs;
        const theta = u * Math.PI * 2;
        const petals = Math.sin(theta * 10);
        const rBase = 0.15 + Math.pow(v, 0.72) * 0.54;
        const r = rBase + petals * 0.030 * Math.pow(v, 1.8);
        const y = 0.27 + v * 0.36 + petals * 0.022 * Math.pow(v, 2.2);
        pos.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        uvs.push(u, v);
      }
    }
    for (let iy = 0; iy < heightSegs; iy++) {
      for (let ix = 0; ix < radialSegs; ix++) {
        const a = iy * (radialSegs + 1) + ix;
        const b = a + radialSegs + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }
    bowlGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bowlGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bowlGeo.setIndex(indices);
    bowlGeo.computeVertexNormals();

    this.bowlMesh = new THREE.Mesh(bowlGeo, glassMat);
    this.bowlMesh.castShadow = true;
    this.group.add(this.bowlMesh);

    const rimPts = [];
    for (let i = 0; i <= 60; i++) {
      const th = (i / 60) * Math.PI * 2;
      const p = Math.sin(th * 10);
      const r = 0.69 + p * 0.030;
      const y = 0.63 + p * 0.022;
      rimPts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
    }
    const rimCurve = new THREE.CatmullRomCurve3(rimPts, true);
    this.group.add(new THREE.Mesh(new THREE.TubeGeometry(rimCurve, 64, 0.018, 8, true), glassMat));
  }

  _buildSnowMound() {
    this.moundPivot = new THREE.Group();
    // Anchor right inside the glass bowl below the rim (rim is at y = 0.63 -> local y = 0.17)
    this.moundPivot.position.set(0, 0.46, 0);
    this.group.add(this.moundPivot);

    // IMPORTANT: Merge shared vertices so computeVertexNormals produces SMOOTH fluffy snow instead of flat facets!
    const rawGeo = new THREE.IcosahedronGeometry(0.60, 4);
    rawGeo.deleteAttribute('normal');
    rawGeo.deleteAttribute('uv');
    const geo = BufferGeometryUtils.mergeVertices(rawGeo, 1e-4);

    const posAttr = geo.attributes.position;
    const count = posAttr.count;
    const uvs = new Float32Array(count * 2);

    this.baseDirs = new Float32Array(count * 3);
    this.lumpFactors = new Float32Array(count);
    this.pigments = new Float32Array(count * 5);
    const colors = new Float32Array(count * 3);
    const v = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(posAttr, i).normalize();
      this.baseDirs[i * 3] = v.x;
      this.baseDirs[i * 3 + 1] = v.y;
      this.baseDirs[i * 3 + 2] = v.z;

      // Spherical UV for fine shaved-ice crystal bump & sparkle roughness map!
      uvs[i * 2] = Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5;
      uvs[i * 2 + 1] = v.y * 0.5 + 0.5;

      // Soft organic multi-frequency snow fluffiness (no harsh jagged spikes!)
      const n1 = Math.sin(v.x * 5.2 + 0.8) * Math.cos(v.z * 5.4 - 0.6) * Math.sin(v.y * 5.1 + 0.3);
      const n2 = Math.sin(v.x * 11.3 - v.z * 9.7) * Math.cos(v.y * 10.5);
      const micro = hash3(Math.round(v.x * 23), Math.round(v.y * 23), Math.round(v.z * 23)) - 0.5;
      this.lumpFactors[i] = 1.0 + n1 * 0.068 + n2 * 0.032 + micro * 0.018;

      colors[i * 3] = 0.96;
      colors[i * 3 + 1] = 0.975;
      colors[i * 3 + 2] = 0.995;
    }

    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.snowMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      bumpMap: this.textures.snowBump,
      bumpScale: 0.038,
      roughnessMap: this.textures.snowRough,
      roughness: 0.68,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.34,
    });

    this.snowMesh = new THREE.Mesh(geo, this.snowMat);
    this.snowMesh.castShadow = true;
    this.snowMesh.receiveShadow = true;
    this.snowMesh.visible = false;
    this.snowMesh.userData.hitRole = 'mound';
    this.moundPivot.add(this.snowMesh);

    this.toppingsGroup = new THREE.Group();
    this.moundPivot.add(this.toppingsGroup);

    this.spillGroup = new THREE.Group();
    this.group.add(this.spillGroup);
  }

  _buildSpoon() {
    this.spoonGroup = new THREE.Group();
    const bambooMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodMap,
      color: 0xf2c88b,
      roughness: 0.38,
    });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.44, 6, 10), bambooMat);
    handle.position.y = 0.23;
    this.spoonGroup.add(handle);

    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), bambooMat);
    scoop.scale.set(0.85, 1.25, 0.36);
    this.spoonGroup.add(scoop);

    this.spoonBiteIce = new THREE.Mesh(
      new THREE.SphereGeometry(0.066, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xff2850, roughness: 0.5 })
    );
    this.spoonBiteIce.position.set(0, 0.01, 0.035);
    this.spoonBiteIce.visible = false;
    this.spoonGroup.add(this.spoonBiteIce);

    this.spoonGroup.position.set(0.44, 0.14, 0.20);
    this.spoonGroup.rotation.set(1.38, 0.25, -0.52);
    this.spoonGroup.visible = false;
    this.group.add(this.spoonGroup);
  }

  _buildHitTarget() {
    this.bowlCollider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.74, 0.64, 1.32, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.bowlCollider.position.y = 0.70;
    this.bowlCollider.userData.hitRole = 'bowl';
    this.group.add(this.bowlCollider);
  }

  // Exact fluffy snow mound silhouette helper used by vertices, syrup projection & fruit placement!
  _evalMoundPoint(dx, dy, dz, lump = 1.0) {
    const p = Math.max(0.04, this.iceProgress);
    const widthFill = Math.min(1.06, Math.pow(Math.min(1.0, p / 0.62), 0.56) * 0.98 + Math.max(0, p - 0.85) * 0.11);
    const peakHeight = 0.12 + Math.pow(p, 0.90) * 0.78;

    if (dy < 0) {
      // Snug inside the lower glass bowl cavity (never pokes through glass!)
      const bowlWallR = 0.38 * Math.min(1, widthFill);
      return new THREE.Vector3(dx * bowlWallR, dy * 0.16, dz * bowlWallR);
    }

    const radial = Math.sin(Math.acos(Math.min(1, dy)));
    const y = Math.pow(dy, 0.84) * peakHeight * lump;
    let shapedR = radial * (0.61 * widthFill * (1.0 - Math.pow(dy, 1.45) * 0.38)) * lump;

    // Strictly constrain snow inside glass bowl wall below rim (local y < 0.17 -> world y < 0.63)!
    if (y < 0.17) {
      const glassMaxR = 0.36 + (Math.max(0, y) / 0.17) * 0.26;
      shapedR = Math.min(shapedR, glassMaxR);
    }

    const ang = Math.atan2(dz, dx);
    return new THREE.Vector3(Math.cos(ang) * shapedR, y, Math.sin(ang) * shapedR);
  }

  addShavedIce(amount) {
    const prev = this.iceProgress;
    this.iceProgress = Math.min(1.48, this.iceProgress + amount);
    this.snowMesh.visible = this.iceProgress > 0.02;
    this._updateSnowGeometry();

    let spawnedOverflow = false;
    const thresholdStep = Math.floor((this.iceProgress - 1.05) / 0.11);
    if (this.iceProgress > 1.06 && thresholdStep > this.overflowCount && this.spillPuffs.length < 10) {
      this.overflowCount = thresholdStep;
      this._spawnSpillPuff();
      this.jiggleVel += 0.18;
      spawnedOverflow = true;
    } else if (this.iceProgress - prev > 0.01) {
      this.jiggleVel += 0.024;
    }
    return spawnedOverflow;
  }

  _spawnSpillPuff() {
    const a = this.spillPuffs.length * 2.2 + Math.random() * 0.5;
    const r = 0.42 + Math.random() * 0.13;
    const puffGeo = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(0.08 + Math.random() * 0.03, 2));
    puffGeo.computeVertexNormals();
    const puff = new THREE.Mesh(
      puffGeo,
      new THREE.MeshStandardMaterial({
        color: 0xf9fcff,
        bumpMap: this.textures.snowBump,
        bumpScale: 0.02,
        roughness: 0.72,
      })
    );
    puff.scale.set(1.2, 0.72, 1.1);
    puff.position.set(Math.cos(a) * r, 0.10, Math.sin(a) * r);
    puff.castShadow = true;
    this.spillGroup.add(puff);
    this.spillPuffs.push(puff);
  }

  _updateSnowGeometry(biteScoopFactor = 0) {
    if (!this.snowMesh.visible) return;
    const posAttr = this.snowMesh.geometry.attributes.position;
    const count = posAttr.count;
    const peakHeight = 0.12 + Math.pow(Math.max(0.04, this.iceProgress), 0.90) * 0.78;

    for (let i = 0; i < count; i++) {
      const pt = this._evalMoundPoint(
        this.baseDirs[i * 3],
        this.baseDirs[i * 3 + 1],
        this.baseDirs[i * 3 + 2],
        this.lumpFactors[i]
      );

      if (biteScoopFactor > 0 && pt.y > 0.1) {
        const bdx = pt.x - 0.12;
        const bdy = pt.y - peakHeight * 0.62;
        const bdz = pt.z + 0.24;
        const d2 = bdx * bdx + bdy * bdy + bdz * bdz;
        if (d2 < 0.14) {
          const dent = (1 - d2 / 0.14) * 0.22 * biteScoopFactor;
          pt.y -= dent;
          pt.x -= bdx * dent * 1.1;
          pt.z -= bdz * dent * 1.1;
        }
      }

      posAttr.setXYZ(i, pt.x, pt.y, pt.z);
    }

    posAttr.needsUpdate = true;
    this.snowMesh.geometry.computeVertexNormals();

    for (const item of this.placedFruits) {
      if (item.anchorDir) {
        const p = this._evalMoundPoint(item.anchorDir.x, Math.max(0.18, item.anchorDir.y), item.anchorDir.z, 1.0);
        item.mesh.position.set(p.x, p.y + 0.028, p.z);
      }
    }
  }

  // Project any aim point onto the actual outer snow mountain surface so syrup & milk ALWAYS stain vividly!
  _projectLocalToSurface(localAim) {
    const dir = localAim.clone();
    const peakH = 0.12 + Math.pow(Math.max(0.32, this.iceProgress), 0.90) * 0.78;
    dir.y = THREE.MathUtils.clamp(dir.y / Math.max(0.25, peakH), 0.18, 1.0);
    if (Math.hypot(dir.x, dir.z) < 0.001) {
      dir.x = 0.01;
    }
    dir.normalize();
    return this._evalMoundPoint(dir.x, Math.max(0.16, dir.y), dir.z, 1.0);
  }

  applySyrupAtWorldPoint(worldPoint, syrupIndex, radius = 0.42, strength = 0.72) {
    if (!this.snowMesh.visible) return false;
    const rawLocal = this.moundPivot.worldToLocal(worldPoint.clone());
    const surfPt = this._projectLocalToSurface(rawLocal);

    const posAttr = this.snowMesh.geometry.attributes.position;
    const colAttr = this.snowMesh.geometry.attributes.color;
    const count = posAttr.count;
    const r2 = radius * radius;

    this.syrupDropsCount++;
    this.colorChannelTotals[syrupIndex] += strength;
    let createdNewMix = false;

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      if (vy < 0.02) continue;

      // Syrup drips richly down the slope below the pour point!
      const dx = vx - surfPt.x;
      const dy = vy < surfPt.y ? (vy - surfPt.y) * 0.42 : (vy - surfPt.y) * 0.92;
      const dz = vz - surfPt.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;

      const falloff = Math.pow(1 - d2 / r2, 1.25) * strength;
      const base = i * 5;
      const prevOthers =
        this.pigments[base] +
        this.pigments[base + 1] +
        this.pigments[base + 2] +
        this.pigments[base + 3] -
        this.pigments[base + syrupIndex];

      const beforeThis = this.pigments[base + syrupIndex];
      this.pigments[base + syrupIndex] = Math.min(1.4, beforeThis + falloff);

      if (prevOthers > 0.25 && beforeThis < 0.18 && this.pigments[base + syrupIndex] >= 0.18) {
        this.mixedZonesCount++;
        createdNewMix = true;
      }

      this._recomputeVertexColor(i, colAttr);
    }

    this.snowMat.clearcoat = Math.min(0.76, 0.22 + this.syrupDropsCount * 0.035);
    this.snowMat.roughness = Math.max(0.36, 0.72 - this.syrupDropsCount * 0.025);
    colAttr.needsUpdate = true;
    this.jiggleVel += 0.016;
    return createdNewMix;
  }

  applyCondensedMilkAtWorldPoint(worldPoint) {
    if (!this.snowMesh.visible) return;
    const rawLocal = this.moundPivot.worldToLocal(worldPoint.clone());
    const surfPt = this._projectLocalToSurface(rawLocal);

    const posAttr = this.snowMesh.geometry.attributes.position;
    const colAttr = this.snowMesh.geometry.attributes.color;
    const count = posAttr.count;
    const radius = 0.13;
    const r2 = radius * radius;

    this.milkDropsCount++;

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      if (vy < 0.04) continue;
      const d2 = (vx - surfPt.x) ** 2 + ((vy - surfPt.y) * 0.85) ** 2 + (vz - surfPt.z) ** 2;
      if (d2 > r2) continue;
      const falloff = (1 - d2 / r2) * 0.55;
      this.pigments[i * 5 + 4] = Math.min(1.0, this.pigments[i * 5 + 4] + falloff);
      this._recomputeVertexColor(i, colAttr);
    }
    colAttr.needsUpdate = true;

    if (this.milkBeads.length < 48) {
      const lastBead = this.milkBeads[this.milkBeads.length - 1];
      if (!lastBead || lastBead.position.distanceToSquared(surfPt) > 0.004) {
        const milkMat = this._milkMat || (this._milkMat = new THREE.MeshPhysicalMaterial({
          color: 0xfff7df,
          roughness: 0.10,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
        }));
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), milkMat);
        bead.scale.set(1.3, 0.52, 1.3);
        bead.position.copy(surfPt);
        const n = surfPt.clone().normalize();
        bead.position.addScaledVector(n, 0.015);
        bead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        this.toppingsGroup.add(bead);
        this.milkBeads.push(bead);
      }
    }
    this.jiggleVel += 0.015;
  }

  _recomputeVertexColor(i, colAttr) {
    const b = i * 5;
    const st = this.pigments[b];
    const le = this.pigments[b + 1];
    const me = this.pigments[b + 2];
    const bl = this.pigments[b + 3];
    const mk = this.pigments[b + 4];

    const totalSyrup = st + le + me + bl;
    // Note: Three.js vertex colors are in LINEAR color space!
    // Convert rich sRGB kakigori syrup pigments to linear space so they render deep, juicy & appetizing!
    let sr = 0.97, sg = 0.985, sb = 1.0;

    if (totalSyrup > 0.001) {
      const ws = st / totalSyrup;
      const wl = le / totalSyrup;
      const wm = me / totalSyrup;
      const wb = bl / totalSyrup;

      // Vivid sRGB targets: Ruby Strawberry, Golden Lemon, Emerald Melon, Ocean Blue Hawaii
      let cr = ws * 0.94 + wl * 1.00 + wm * 0.06 + wb * 0.05;
      let cg = ws * 0.08 + wl * 0.78 + wm * 0.80 + wb * 0.56;
      let cb = ws * 0.24 + wl * 0.04 + wm * 0.28 + wb * 0.98;

      // Secondary mixes in sRGB: Orange, Lime-Emerald, Berry-Violet
      const orangeMix = Math.min(ws, wl) * 2.0;
      if (orangeMix > 0.15) {
        cr = THREE.MathUtils.lerp(cr, 1.00, orangeMix * 0.8);
        cg = THREE.MathUtils.lerp(cg, 0.46, orangeMix * 0.8);
        cb = THREE.MathUtils.lerp(cb, 0.04, orangeMix * 0.8);
      }
      const greenMix = Math.min(wl, wb) * 2.0;
      if (greenMix > 0.15) {
        cr = THREE.MathUtils.lerp(cr, 0.08, greenMix * 0.85);
        cg = THREE.MathUtils.lerp(cg, 0.84, greenMix * 0.85);
        cb = THREE.MathUtils.lerp(cb, 0.34, greenMix * 0.85);
      }
      const purpleMix = Math.min(ws, wb) * 2.0;
      if (purpleMix > 0.15) {
        cr = THREE.MathUtils.lerp(cr, 0.62, purpleMix * 0.85);
        cg = THREE.MathUtils.lerp(cg, 0.14, purpleMix * 0.85);
        cb = THREE.MathUtils.lerp(cb, 0.96, purpleMix * 0.85);
      }

      const sat = Math.min(0.96, Math.pow(Math.min(1.2, totalSyrup), 0.75) * 0.92);
      sr = THREE.MathUtils.lerp(0.97, cr, sat);
      sg = THREE.MathUtils.lerp(0.985, cg, sat);
      sb = THREE.MathUtils.lerp(1.0, cb, sat);
    }

    if (mk > 0.01) {
      const mw = Math.min(0.62, mk * 0.55);
      sr = THREE.MathUtils.lerp(sr, 1.0, mw);
      sg = THREE.MathUtils.lerp(sg, 0.97, mw);
      sb = THREE.MathUtils.lerp(sb, 0.88, mw);
    }

    // sRGB -> Linear conversion for Three.js vertexColor attribute!
    colAttr.setXYZ(i, Math.pow(sr, 2.2), Math.pow(sg, 2.2), Math.pow(sb, 2.2));
  }

  placeFruitOnMound(fruitMesh, worldTargetPoint = null) {
    let dir;
    const peakH = 0.12 + Math.pow(Math.max(0.35, this.iceProgress), 0.90) * 0.78;

    if (worldTargetPoint) {
      const localPt = this.moundPivot.worldToLocal(worldTargetPoint.clone());
      dir = new THREE.Vector3(localPt.x, THREE.MathUtils.clamp(localPt.y / peakH, 0.25, 1.0), localPt.z).normalize();
    } else {
      const idx = this.placedFruits.length;
      if (idx === 0) {
        dir = new THREE.Vector3(0, 0.99, 0.12).normalize();
      } else {
        const a = idx * 2.15 + 0.55;
        const dy = Math.max(0.36, 0.84 - (idx % 5) * 0.10);
        const rHoriz = Math.sqrt(Math.max(0.01, 1 - dy * dy));
        dir = new THREE.Vector3(Math.cos(a) * rHoriz, dy, Math.sin(a) * rHoriz).normalize();
      }
    }

    const surfPt = this._evalMoundPoint(dir.x, Math.max(0.24, dir.y), dir.z, 1.0);
    fruitMesh.position.set(surfPt.x, surfPt.y + 0.028, surfPt.z);

    const normal = new THREE.Vector3(dir.x * 0.52, 1.0, dir.z * 0.52).normalize();
    fruitMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    fruitMesh.rotateY(Math.random() * Math.PI * 2);

    this.toppingsGroup.add(fruitMesh);
    this.placedFruits.push({
      mesh: fruitMesh,
      kind: fruitMesh.userData.fruitKind,
      anchorDir: dir,
      popAnim: 0.01,
    });
    this.jiggleVel += 0.12;
  }

  getDominantColor() {
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < 4; i++) {
      if (this.colorChannelTotals[i] > bestVal) {
        bestVal = this.colorChannelTotals[i];
        bestIdx = i;
      }
    }
    return bestVal > 0.05 ? SYRUP_DEFS[bestIdx].color.clone() : new THREE.Color(0xffffff);
  }

  getRecipeProfile() {
    const activeColors = this.colorChannelTotals.filter((v) => v > 0.25).length;
    const isRainbow = activeColors >= 3 || this.mixedZonesCount > 55;
    const isMegaMountain = this.iceProgress >= 1.12;
    const hasMilk = this.milkDropsCount >= 2;
    const hasStrawberry = this.colorChannelTotals[0] > 0.3 || this.placedFruits.some((f) => f.kind === 0);
    return {
      iceProgress: this.iceProgress,
      activeColors,
      isRainbow,
      isMegaMountain,
      hasMilk,
      hasStrawberry,
      fruitCount: this.placedFruits.length,
      dominantColor: this.getDominantColor(),
    };
  }

  isReadyToServe() {
    return (
      this.iceProgress >= 0.36 &&
      (this.syrupDropsCount >= 1 || this.milkDropsCount >= 1 || this.placedFruits.length >= 1)
    );
  }

  takeSpoonBite(amount = 1.0) {
    this.spoonBiteIce.material.color.copy(this.getDominantColor());
    this._updateSnowGeometry(amount);
    this.jiggleVel += 0.14;
  }

  resetForNextCustomer() {
    this.iceProgress = 0;
    this.overflowCount = 0;
    this.syrupDropsCount = 0;
    this.milkDropsCount = 0;
    this.colorChannelTotals = [0, 0, 0, 0];
    this.mixedZonesCount = 0;
    this.pigments.fill(0);

    const colAttr = this.snowMesh.geometry.attributes.color;
    const lr = Math.pow(0.97, 2.2);
    const lg = Math.pow(0.985, 2.2);
    for (let i = 0; i < colAttr.count; i++) {
      colAttr.setXYZ(i, lr, lg, 1.0);
    }
    colAttr.needsUpdate = true;
    this.snowMat.clearcoat = 0.22;
    this.snowMat.roughness = 0.72;
    this.snowMesh.visible = false;

    while (this.toppingsGroup.children.length > 0) {
      this.toppingsGroup.remove(this.toppingsGroup.children[0]);
    }
    while (this.spillGroup.children.length > 0) {
      this.spillGroup.remove(this.spillGroup.children[0]);
    }
    this.placedFruits = [];
    this.milkBeads = [];
    this.spillPuffs = [];

    this.spoonGroup.visible = false;
    this.spoonGroup.position.set(0.44, 0.14, 0.20);
    this.spoonGroup.rotation.set(1.38, 0.25, -0.52);
    this.spoonBiteIce.visible = false;

    this.group.position.copy(this.homePos);
    this.group.scale.setScalar(1);
    this.slideInAnim = 0.001;
  }

  update(dt) {
    const force = -this.jiggle * 42.0 - this.jiggleVel * 7.2;
    this.jiggleVel += force * dt;
    this.jiggle += this.jiggleVel * dt;

    const sx = 1.0 + this.jiggle * 0.26;
    const sy = Math.max(0.84, 1.0 - this.jiggle * 0.32);
    this.moundPivot.scale.set(sx, sy, sx);
    this.moundPivot.rotation.z = this.jiggle * 0.20;

    for (const f of this.placedFruits) {
      if (f.popAnim > 0 && f.popAnim < 1) {
        f.popAnim = Math.min(1, f.popAnim + dt * 6.5);
        const s = f.popAnim < 0.7
          ? (f.popAnim / 0.7) * 1.18
          : 1.18 - ((f.popAnim - 0.7) / 0.3) * 0.18;
        f.mesh.scale.setScalar(s);
      }
    }

    if (this.slideInAnim > 0) {
      this.slideInAnim = Math.min(1, this.slideInAnim + dt * 3.8);
      const ease = 1 - Math.pow(1 - this.slideInAnim, 3);
      this.group.position.x = this.homePos.x + (1 - ease) * -0.85;
      if (this.slideInAnim >= 1) this.slideInAnim = 0;
    }
  }
}

export class MiniatureParticles {
  constructor(scene) {
    this.maxCount = 220;
    const geo = new THREE.IcosahedronGeometry(0.036, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.05 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.items = [];
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < this.maxCount; i++) {
      this.mesh.setMatrixAt(i, zeroMat);
      this.mesh.setColorAt(i, white);
      this.items.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: new THREE.Vector3(1, 1, 1),
        rot: new THREE.Euler(),
        life: 0,
        maxLife: 1,
        gravity: 5.5,
      });
    }
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }

  spawnSnowFlake(origin) {
    const idx = this.cursor;
    const p = this.items[idx];
    this.cursor = (this.cursor + 1) % this.maxCount;
    p.active = true;
    p.pos.set(
      origin.x + (Math.random() - 0.5) * 0.20,
      origin.y,
      origin.z + (Math.random() - 0.5) * 0.20
    );
    p.vel.set((Math.random() - 0.5) * 0.85, -1.5 - Math.random() * 1.3, (Math.random() - 0.5) * 0.85);
    p.scale.set(1.45, 0.45, 1.15);
    p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.life = 0;
    p.maxLife = 0.40 + Math.random() * 0.16;
    p.gravity = 4.2;
    this.mesh.setColorAt(idx, new THREE.Color(0xf8fdff));
    this.mesh.instanceColor.needsUpdate = true;
  }

  spawnLiquidDrop(origin, color) {
    const idx = this.cursor;
    const p = this.items[idx];
    this.cursor = (this.cursor + 1) % this.maxCount;
    p.active = true;
    p.pos.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05));
    p.vel.set((Math.random() - 0.5) * 0.32, -2.3 - Math.random() * 0.5, (Math.random() - 0.5) * 0.32);
    p.scale.set(0.95, 1.65, 0.95);
    p.rot.set(0, 0, 0);
    p.life = 0;
    p.maxLife = 0.26;
    p.gravity = 7.2;
    this.mesh.setColorAt(idx, color);
    this.mesh.instanceColor.needsUpdate = true;
  }

  spawnBurst(origin, colors, count = 18, upward = 2.6) {
    for (let n = 0; n < count; n++) {
      const idx = this.cursor;
      const p = this.items[idx];
      this.cursor = (this.cursor + 1) % this.maxCount;
      p.active = true;
      p.pos.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.2, (Math.random() - 0.5) * 0.3));
      const a = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 1.9;
      p.vel.set(Math.cos(a) * spd, upward * (0.5 + Math.random() * 0.7), Math.sin(a) * spd);
      p.scale.set(1.25, 1.25, 0.6);
      p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.life = 0;
      p.maxLife = 0.75 + Math.random() * 0.45;
      p.gravity = 3.4;
      this.mesh.setColorAt(idx, colors[n % colors.length]);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += dt * 4.5;
      p.rot.z += dt * 3.5;

      const fade = 1.0 - Math.pow(p.life / p.maxLife, 2);
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.copy(p.rot);
      this.dummy.scale.copy(p.scale).multiplyScalar(fade);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
