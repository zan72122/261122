import * as THREE from 'three';
import {
  sculptClay,
  createPlumpBoxGeometry,
  getClayTextures,
  makeClayMaterial,
  makeGlossClayMaterial,
  ClaySpring,
  applySquash,
} from './clay.js';

export class ClayKitchen {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.time = 0;
    this.waterLevel = 0;       // 0..1.05
    this.targetWaterLevel = 0;
    this.dashiLevel = 0;       // 0..1 (steeped golden dashi)
    this.misoLevel = 0;        // 0..1 (creamy miso dissolved)
    this.heatOn = false;
    this.heatIntensity = 0;
    this.swirlSpeed = 0.25;
    this.rippleAmp = 0;
    this.potSpring = new ClaySpring(180, 11);
    this.dialSpring = new ClaySpring(220, 12);

    this.floatingTofu = [];
    this.floatingWakame = [];
    this.floatingKombu = [];
    this.steamPuffs = [];
    this.splashDrops = [];
    this.misoClouds = [];
    this.simmerBubbles = [];
    this.flames = [];

    this._buildEnvironment();
    this._buildStoveAndTrivet();
    this._buildPot();
    this._buildParticlePools();
  }

  _buildEnvironment() {
    const { woodMap, tileMap, clayBump } = getClayTextures();

    // Warm chunky clay-wood countertop / dining table
    const tableGeo = createPlumpBoxGeometry(18, 0.8, 12, 0.14, 4);
    sculptClay(tableGeo, 0.015, 0.6, 11);
    const tableMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      bumpMap: clayBump,
      bumpScale: 0.014,
      roughness: 0.72,
      metalness: 0.0,
    });
    this.table = new THREE.Mesh(tableGeo, tableMat);
    this.table.position.set(0, -0.4, 0.6);
    this.table.receiveShadow = true;
    this.group.add(this.table);

    // Warm sunlit hand-pressed clay tile kitchen backsplash wall
    const wallGeo = new THREE.PlaneGeometry(22, 11, 16, 8);
    sculptClay(wallGeo, 0.025, 0.5, 19);
    const wallMat = new THREE.MeshStandardMaterial({
      map: tileMap,
      bumpMap: clayBump,
      bumpScale: 0.018,
      roughness: 0.82,
    });
    this.backWall = new THREE.Mesh(wallGeo, wallMat);
    this.backWall.position.set(0, 4.4, -4.6);
    this.backWall.receiveShadow = true;
    this.group.add(this.backWall);

    // Cozy clay wooden shelf on the back wall (gentle atmosphere, low contrast)
    const shelfGeo = createPlumpBoxGeometry(14, 0.28, 0.85, 0.08, 3);
    sculptClay(shelfGeo, 0.012, 1.2, 23);
    const shelf = new THREE.Mesh(shelfGeo, makeClayMaterial(0xc88f5a, { roughness: 0.78 }));
    shelf.position.set(0, 4.35, -4.2);
    shelf.castShadow = false;
    shelf.receiveShadow = true;
    this.group.add(shelf);

    // Soft sunny morning window frame on upper-left of wall (warm atmosphere)
    const winGroup = new THREE.Group();
    winGroup.position.set(-4.6, 5.2, -4.5);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.8),
      new THREE.MeshBasicMaterial({ color: 0xfff7dc })
    );
    winGroup.add(glass);
    const frameMat = makeClayMaterial(0xf3e4cc, { roughness: 0.8 });
    const bars = [
      [3.5, 0.24, 0.22, 0, 1.4, 0.08],
      [3.5, 0.24, 0.22, 0, -1.4, 0.08],
      [0.24, 3.0, 0.22, -1.65, 0, 0.08],
      [0.24, 3.0, 0.22, 1.65, 0, 0.08],
      [0.16, 2.8, 0.18, 0, 0, 0.06],
      [3.2, 0.16, 0.18, 0, 0, 0.06],
    ];
    bars.forEach(([w, h, d, x, y, z], idx) => {
      const g = createPlumpBoxGeometry(w, h, d, 0.05, 2);
      sculptClay(g, 0.008, 1.8, 30 + idx);
      const m = new THREE.Mesh(g, frameMat);
      m.position.set(x, y, z);
      winGroup.add(m);
    });
    this.group.add(winGroup);

    // Cute background clay jars on the shelf (soft warm hues, background hierarchy D)
    const jarData = [
      { x: -1.6, r: 0.34, h: 0.62, col: 0xe8b57f, lid: 0xd17c56 },
      { x: -0.75, r: 0.28, h: 0.48, col: 0xa8c9a8, lid: 0xead8b8 },
      { x: 2.3, r: 0.36, h: 0.56, col: 0x9ec4d8, lid: 0xc98a56 },
      { x: 3.15, r: 0.26, h: 0.44, col: 0xe9a39b, lid: 0xf4e8d2 },
    ];
    jarData.forEach((j, idx) => {
      const jg = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(j.r * 0.92, j.r, j.h, 16, 4);
      sculptClay(bodyGeo, 0.014, 3.0, 40 + idx);
      const body = new THREE.Mesh(bodyGeo, makeClayMaterial(j.col, { roughness: 0.72 }));
      body.position.y = j.h * 0.5;
      jg.add(body);
      const lidGeo = new THREE.SphereGeometry(j.r * 0.76, 14, 10);
      sculptClay(lidGeo, 0.012, 3.2, 50 + idx);
      const lid = new THREE.Mesh(lidGeo, makeClayMaterial(j.lid, { roughness: 0.76 }));
      lid.scale.set(1, 0.55, 1);
      lid.position.y = j.h + 0.06;
      jg.add(lid);
      jg.position.set(j.x, 4.49, -4.15);
      this.group.add(jg);
    });
  }

  _buildStoveAndTrivet() {
    // Cozy tabletop clay gas stove (こんろ)
    this.stoveGroup = new THREE.Group();
    this.stoveGroup.position.set(0, 0, 0);
    this.group.add(this.stoveGroup);

    const baseGeo = createPlumpBoxGeometry(3.2, 0.3, 2.85, 0.12, 4);
    sculptClay(baseGeo, 0.014, 1.5, 61);
    const base = new THREE.Mesh(baseGeo, makeClayMaterial(0xf2e4cc, { roughness: 0.76 }));
    base.position.y = 0.15;
    base.castShadow = true;
    base.receiveShadow = true;
    this.stoveGroup.add(base);

    // Charcoal clay burner ring
    const ringGeo = new THREE.TorusGeometry(0.95, 0.1, 10, 24);
    sculptClay(ringGeo, 0.01, 3.0, 62);
    const grateMat = makeClayMaterial(0x4c4642, { roughness: 0.85 });
    const ring = new THREE.Mesh(ringGeo, grateMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.31;
    ring.castShadow = true;
    this.stoveGroup.add(ring);

    // 4 plump grate prongs
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const prongGeo = createPlumpBoxGeometry(0.55, 0.11, 0.14, 0.04, 2);
      const prong = new THREE.Mesh(prongGeo, grateMat);
      prong.position.set(Math.cos(a) * 0.92, 0.34, Math.sin(a) * 0.92);
      prong.rotation.y = -a;
      this.stoveGroup.add(prong);
    }

    // Tactile stove knob on front-right (turns when heat ignites & clickable!)
    this.stoveDial = new THREE.Group();
    this.stoveDial.position.set(1.22, 0.16, 1.46);
    const dialCyl = new THREE.Mesh(
      sculptClay(new THREE.CylinderGeometry(0.18, 0.2, 0.14, 16), 0.008, 4.0, 63),
      makeClayMaterial(0xe36b52, { roughness: 0.65 })
    );
    dialCyl.rotation.x = Math.PI / 2;
    this.stoveDial.add(dialCyl);
    const dialBar = new THREE.Mesh(
      createPlumpBoxGeometry(0.08, 0.24, 0.12, 0.03, 2),
      makeClayMaterial(0xfff5e4, { roughness: 0.72 })
    );
    dialBar.position.z = 0.06;
    this.stoveDial.add(dialBar);
    this.stoveDial.userData.interactId = 'stoveDial';
    this.stoveGroup.add(this.stoveDial);

    // Ring of cute plump stop-motion clay flames!
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 0.29, 0);
    this.stoveGroup.add(this.flameGroup);

    const outerFlameMat = makeClayMaterial(0xff7728, {
      roughness: 0.48,
      emissive: 0xff5a12,
      emissiveIntensity: 0.75,
    });
    const innerFlameMat = makeClayMaterial(0xffdc52, {
      roughness: 0.42,
      emissive: 0xffb824,
      emissiveIntensity: 0.85,
    });

    const flameCount = 10;
    for (let i = 0; i < flameCount; i++) {
      const a = (i / flameCount) * Math.PI * 2;
      const fg = new THREE.Group();
      const outer = new THREE.Mesh(
        sculptClay(new THREE.ConeGeometry(0.17, 0.36, 9, 3), 0.015, 5.0, 70 + i),
        outerFlameMat
      );
      outer.position.y = 0.14;
      fg.add(outer);
      const inner = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.22, 8, 2),
        innerFlameMat
      );
      inner.position.y = 0.11;
      fg.add(inner);

      fg.position.set(Math.cos(a) * 1.12, 0, Math.sin(a) * 1.12);
      fg.rotation.z = -Math.cos(a) * 0.32;
      fg.rotation.x = Math.sin(a) * 0.32;
      fg.scale.setScalar(0.001);
      this.flameGroup.add(fg);
      this.flames.push({ mesh: fg, phase: i * 1.37, angle: a });
    }

    // Warm glow light under the pot when cooking
    this.flameLight = new THREE.PointLight(0xff8e36, 0, 5.5, 1.8);
    this.flameLight.position.set(0, 0.45, 0.3);
    this.stoveGroup.add(this.flameLight);

    // Woven clay trivet (鍋敷き) for Stage 4 dining table
    this.trivetGroup = new THREE.Group();
    this.trivetGroup.position.set(0, 0.05, 1.85);
    this.trivetGroup.scale.setScalar(0.001);
    this.trivetGroup.visible = false;
    const trivetBase = new THREE.Mesh(
      sculptClay(new THREE.CylinderGeometry(1.36, 1.4, 0.13, 24, 2), 0.016, 3.0, 88),
      makeClayMaterial(0xd7a86e, { roughness: 0.85 })
    );
    trivetBase.receiveShadow = true;
    this.trivetGroup.add(trivetBase);
    const trivetRing = new THREE.Mesh(
      sculptClay(new THREE.TorusGeometry(1.24, 0.08, 8, 24), 0.012, 4.0, 89),
      makeClayMaterial(0xc08b4e, { roughness: 0.84 })
    );
    trivetRing.rotation.x = Math.PI / 2;
    trivetRing.position.y = 0.05;
    this.trivetGroup.add(trivetRing);
    this.group.add(this.trivetGroup);
  }

  _buildPot() {
    this.potGroup = new THREE.Group();
    this.potGroup.position.set(0, 0.31, 0);
    this.group.add(this.potGroup);

    // Plump terracotta-coral enameled clay cooking pot (thick sculpted walls, zero Z-fighting with rim!)
    const outerPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(1.06, 0.0),
      new THREE.Vector2(1.24, 0.14),
      new THREE.Vector2(1.32, 0.56),
      new THREE.Vector2(1.33, 1.02),
      new THREE.Vector2(1.27, 1.07),
    ];
    const outerGeo = new THREE.LatheGeometry(outerPoints, 32);
    sculptClay(outerGeo, 0.016, 2.2, 101);
    const potOuterMat = makeGlossClayMaterial(0xd95f44, {
      roughness: 0.38,
      clearcoat: 0.42,
      bumpScale: 0.016,
      side: THREE.DoubleSide,
    });
    this.potOuter = new THREE.Mesh(outerGeo, potOuterMat);
    this.potOuter.rotation.y = Math.PI; // Hide lathe UV seam on the back
    this.potOuter.castShadow = true;
    this.potOuter.receiveShadow = true;
    this.potOuter.userData.interactId = 'pot';
    this.potGroup.add(this.potOuter);

    // Creamy glazed interior bowl wall so water/dashi/miso colors pop clearly!
    const innerPoints = [
      new THREE.Vector2(1.19, 1.07),
      new THREE.Vector2(1.17, 0.55),
      new THREE.Vector2(1.05, 0.18),
      new THREE.Vector2(0.0, 0.14),
    ];
    const innerGeo = new THREE.LatheGeometry(innerPoints, 30);
    sculptClay(innerGeo, 0.01, 2.4, 102);
    const potInnerMat = makeGlossClayMaterial(0xf7efe0, {
      roughness: 0.32,
      clearcoat: 0.38,
      side: THREE.DoubleSide,
    });
    const potInner = new THREE.Mesh(innerGeo, potInnerMat);
    potInner.rotation.y = Math.PI;
    potInner.receiveShadow = true;
    potInner.userData.interactId = 'pot';
    this.potGroup.add(potInner);

    // Thick rolled cream-ivory accent clay rim sitting cleanly on top (zero overlap!)
    const rimGeo = new THREE.TorusGeometry(1.27, 0.105, 14, 34);
    sculptClay(rimGeo, 0.011, 3.0, 103);
    const rim = new THREE.Mesh(rimGeo, makeGlossClayMaterial(0xf5ead5, { roughness: 0.36, bumpScale: 0.014 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.11;
    rim.castShadow = true;
    rim.userData.interactId = 'pot';
    this.potGroup.add(rim);

    // Two chunky plump clay pot ears/handles on left and right (attached cleanly below the cream rim!)
    const handleMat = makeClayMaterial(0xc44b33, { roughness: 0.62, bumpScale: 0.022 });
    [-1, 1].forEach((side, idx) => {
      const hGeo = new THREE.TorusGeometry(0.26, 0.10, 10, 18, Math.PI * 1.1);
      sculptClay(hGeo, 0.012, 4.0, 104 + idx);
      const h = new THREE.Mesh(hGeo, handleMat);
      h.position.set(side * 1.32, 0.78, 0);
      h.rotation.y = side > 0 ? 0 : Math.PI;
      h.rotation.z = -Math.PI * 0.55;
      h.rotation.x = 0.18;
      h.castShadow = true;
      h.userData.interactId = 'pot';
      this.potGroup.add(h);
    });

    // Dynamic liquid surface inside pot (ripples + smooth water -> dashi -> miso transformation)
    const { soupSwirlMap } = getClayTextures();
    this.liquidGeo = new THREE.CircleGeometry(1.16, 36, 0, Math.PI * 2);
    // Add radial rings by using Ring/Cylinder cap geometry for wave deformation
    this.liquidGeo = new THREE.CylinderGeometry(1.17, 1.05, 0.18, 32, 1, false);
    // Replace top cap with subdivided disc for smooth waves
    const discGeo = new THREE.CircleGeometry(1.18, 36);
    // Subdivide circle manually into concentric rings for silky liquid ripples
    const rings = 5;
    const segs = 28;
    const verts = [];
    const uvs = [];
    const indices = [];
    verts.push(0, 0, 0);
    uvs.push(0.5, 0.5);
    for (let r = 1; r <= rings; r++) {
      const rad = (r / rings) * 1.17;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        verts.push(x, 0, z);
        uvs.push(0.5 + (x / 2.34), 0.5 + (z / 2.34));
      }
    }
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      indices.push(0, 1 + next, 1 + s);
    }
    for (let r = 1; r < rings; r++) {
      const rowA = 1 + (r - 1) * segs;
      const rowB = 1 + r * segs;
      for (let s = 0; s < segs; s++) {
        const next = (s + 1) % segs;
        indices.push(rowA + s, rowA + next, rowB + next);
        indices.push(rowA + s, rowB + next, rowB + s);
      }
    }
    const surfGeo = new THREE.BufferGeometry();
    surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    surfGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    surfGeo.setIndex(indices);
    surfGeo.computeVertexNormals();
    this.liquidBasePos = new Float32Array(verts);
    this.liquidGeo = surfGeo;

    this.liquidMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x7cdaf2),
      map: soupSwirlMap,
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 0.78,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.78,
    });
    this.liquidMesh = new THREE.Mesh(this.liquidGeo, this.liquidMat);
    this.liquidMesh.position.y = 0.18;
    this.liquidMesh.visible = false;
    this.liquidMesh.receiveShadow = true;
    this.liquidMesh.userData.interactId = 'pot';
    this.potGroup.add(this.liquidMesh);

    // Container for floating ingredients inside pot (moves with pot!)
    this.contentsGroup = new THREE.Group();
    this.potGroup.add(this.contentsGroup);

    // Subtle expanding golden ring when dashi steeps
    const dashiRingGeo = new THREE.RingGeometry(0.18, 0.34, 24);
    this.dashiRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd256,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.dashiRing = new THREE.Mesh(dashiRingGeo, this.dashiRingMat);
    this.dashiRing.rotation.x = -Math.PI / 2;
    this.dashiRing.position.y = 0.96;
    this.potGroup.add(this.dashiRing);
    this.dashiRingAnim = 0;
  }

  _buildParticlePools() {
    // 1. Plump clay steam puffs (soft matte cream spheres that curl upward)
    const steamGeo = sculptClay(new THREE.SphereGeometry(0.18, 10, 8), 0.025, 4.0, 201);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfffaf0,
        roughness: 0.9,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(steamGeo, mat);
      mesh.visible = false;
      this.potGroup.add(mesh);
      this.steamPuffs.push({
        mesh,
        mat,
        life: i / 16,
        maxLife: 2.2 + (i % 4) * 0.35,
        angle: (i / 16) * Math.PI * 2,
        radius: 0.22 + (i % 5) * 0.16,
      });
    }

    // 2. Chunky splash droplets
    const dropGeo = new THREE.SphereGeometry(0.08, 8, 6);
    for (let i = 0; i < 22; i++) {
      const mat = makeGlossClayMaterial(0x88e4f8, { roughness: 0.15 });
      const mesh = new THREE.Mesh(dropGeo, mat);
      mesh.visible = false;
      this.potGroup.add(mesh);
      this.splashDrops.push({
        mesh,
        mat,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
      });
    }

    // 3. Swirling miso cloud puffs (appear during miso dissolving!)
    const cloudGeo = sculptClay(new THREE.SphereGeometry(0.16, 10, 8), 0.02, 4.5, 205);
    for (let i = 0; i < 18; i++) {
      const mat = makeClayMaterial(i % 2 === 0 ? 0xc8742a : 0xe39e4c, {
        roughness: 0.45,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(cloudGeo, mat);
      mesh.visible = false;
      this.potGroup.add(mesh);
      this.misoClouds.push({
        mesh,
        mat,
        active: false,
        angle: 0,
        radius: 0.15,
        life: 0,
        maxLife: 1.2,
      });
    }

    // 4. Simmering surface bubbles
    const bubGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 10; i++) {
      const mat = makeGlossClayMaterial(0xfff1c4, { roughness: 0.18, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(bubGeo, mat);
      mesh.visible = false;
      this.potGroup.add(mesh);
      this.simmerBubbles.push({
        mesh,
        mat,
        phase: i * 0.73,
        x: Math.cos(i * 2.1) * (0.2 + (i % 4) * 0.2),
        z: Math.sin(i * 2.1) * (0.2 + (i % 4) * 0.2),
      });
    }
  }

  getLiquidLocalY() {
    return 0.2 + Math.min(1.04, this.waterLevel) * 0.76;
  }

  getLiquidWorldY() {
    return this.potGroup.position.y + this.getLiquidLocalY();
  }

  getCurrentSoupColor(outColor = new THREE.Color()) {
    const waterCol = new THREE.Color(0x7fdaf0);
    const dashiCol = new THREE.Color(0xf2be4b);
    const misoCol = new THREE.Color(0xd58a3b);
    outColor.copy(waterCol).lerp(dashiCol, this.dashiLevel).lerp(misoCol, this.misoLevel);
    return outColor;
  }

  pokePot() {
    this.potSpring.impulse(4.8);
    if (this.waterLevel > 0.12) {
      this.rippleAmp = Math.min(0.09, this.rippleAmp + 0.045);
      this.spawnSplash(0, 0, 5);
    }
  }

  spawnSplash(localX = 0, localZ = 0, count = 6, colorHex = null) {
    const col = colorHex ? new THREE.Color(colorHex) : this.getCurrentSoupColor();
    let spawned = 0;
    const ly = this.getLiquidLocalY();
    for (const d of this.splashDrops) {
      if (!d.active) {
        d.active = true;
        d.life = 0;
        const a = Math.random() * Math.PI * 2;
        const spd = 0.7 + Math.random() * 1.1;
        d.pos.set(localX + Math.cos(a) * 0.1, ly + 0.04, localZ + Math.sin(a) * 0.1);
        d.vel.set(Math.cos(a) * spd, 2.2 + Math.random() * 1.4, Math.sin(a) * spd);
        d.mat.color.copy(col);
        d.mesh.position.copy(d.pos);
        d.mesh.scale.setScalar(0.7 + Math.random() * 0.6);
        d.mesh.visible = true;
        spawned++;
        if (spawned >= count) break;
      }
    }
    this.rippleAmp = Math.min(0.11, this.rippleAmp + 0.038);
  }

  spawnMisoCloud(localX, localZ) {
    for (const c of this.misoClouds) {
      if (!c.active) {
        c.active = true;
        c.life = 0;
        c.maxLife = 0.9 + Math.random() * 0.65;
        c.angle = Math.atan2(localZ, localX) + (Math.random() - 0.5) * 0.4;
        c.radius = Math.max(0.12, Math.hypot(localX, localZ));
        c.mesh.visible = true;
        c.mesh.scale.set(0.6, 0.25, 0.6);
        break;
      }
    }
  }

  triggerDashiRing() {
    this.dashiRingAnim = 0.001;
  }

  addFloatingKombu(mesh, localX, localZ) {
    this.contentsGroup.add(mesh);
    this.floatingKombu.push({
      mesh,
      angle: Math.atan2(localZ, localX),
      radius: Math.min(0.65, Math.hypot(localX, localZ)),
      phase: Math.random() * 6.28,
      sinkDepth: 0.06,
    });
  }

  addFloatingTofu(mesh, localX, localZ) {
    this.contentsGroup.add(mesh);
    const r = Math.min(0.82, Math.max(0.16, Math.hypot(localX, localZ)));
    const angle = Math.atan2(localZ, localX);
    mesh.position.set(Math.cos(angle) * r, this.getLiquidLocalY(), Math.sin(angle) * r);
    this.floatingTofu.push({
      mesh,
      angle,
      radius: r,
      phase: Math.random() * 6.28,
      bobVel: -1.4,
      bobOffset: 0.08,
      rotSpeed: (Math.random() - 0.5) * 0.7,
    });
  }

  addFloatingWakame(mesh, localX, localZ) {
    this.contentsGroup.add(mesh);
    const r = Math.min(0.78, Math.max(0.15, Math.hypot(localX, localZ)));
    const angle = Math.atan2(localZ, localX);
    mesh.position.set(Math.cos(angle) * r, this.getLiquidLocalY() + 0.015, Math.sin(angle) * r);
    this.floatingWakame.push({
      mesh,
      angle,
      radius: r,
      phase: Math.random() * 6.28,
      bloom: 0.01,
      bloomDelay: 0.16,
      bloomedSound: false,
    });
    return this.floatingWakame[this.floatingWakame.length - 1];
  }

  resetForNewRound() {
    this.waterLevel = 0;
    this.targetWaterLevel = 0;
    this.dashiLevel = 0;
    this.misoLevel = 0;
    this.heatOn = false;
    this.heatIntensity = 0;
    this.swirlSpeed = 0.25;
    this.rippleAmp = 0;
    this.dashiRingAnim = 0;
    this.dashiRingMat.opacity = 0;

    for (const item of [...this.floatingTofu, ...this.floatingWakame, ...this.floatingKombu]) {
      this.contentsGroup.remove(item.mesh);
    }
    this.floatingTofu.length = 0;
    this.floatingWakame.length = 0;
    this.floatingKombu.length = 0;

    for (const p of this.steamPuffs) {
      p.mesh.visible = false;
      p.mat.opacity = 0;
    }
    for (const b of this.simmerBubbles) {
      b.mesh.visible = false;
    }
    for (const c of this.misoClouds) {
      c.active = false;
      c.mesh.visible = false;
    }
    this.liquidMesh.visible = false;
    this.stoveGroup.visible = true;
    this.stoveGroup.position.set(0, 0, 0);
    this.stoveDial.rotation.z = 0;
    this.trivetGroup.visible = false;
    this.trivetGroup.scale.setScalar(0.001);
    this.potBaseScale = 1.0;
    this.potGroup.position.set(0, 0.31, 0);
    this.potSpring.impulse(4.0);
  }

  update(dt, onWakameBloomed) {
    this.time += dt;

    // Pot squash & stretch spring (preserve base scale for dining table!)
    const potSq = this.potSpring.step(dt);
    applySquash(this.potGroup, potSq * 0.08, this.potBaseScale ?? 1);

    // Water level easing
    this.waterLevel += (this.targetWaterLevel - this.waterLevel) * Math.min(1, dt * 6);
    if (this.waterLevel > 0.015) {
      this.liquidMesh.visible = true;
      const ly = this.getLiquidLocalY();
      this.liquidMesh.position.y = ly;
      const scaleR = 0.91 + Math.min(1, this.waterLevel) * 0.09;
      this.liquidMesh.scale.set(scaleR, 1, scaleR);

      // Update liquid color & opacity smoothly (translucent water -> golden dashi -> rich opaque miso)
      const col = this.getCurrentSoupColor();
      this.liquidMat.color.copy(col);
      this.liquidMat.opacity = 0.72 + this.dashiLevel * 0.14 + this.misoLevel * 0.14;
      this.liquidMat.roughness = 0.12 + this.misoLevel * 0.14;

      // Rotate swirl texture
      this.liquidMesh.rotation.y += dt * this.swirlSpeed;

      // Subtle concentric ripples on liquid vertices
      this.rippleAmp = Math.max(this.heatOn ? 0.014 : 0.005, this.rippleAmp * Math.exp(-dt * 2.4));
      const pos = this.liquidGeo.attributes.position;
      const base = this.liquidBasePos;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const bz = base[i * 3 + 2];
        const r = Math.hypot(bx, bz);
        const wave = Math.sin(r * 7.5 - this.time * 5.2) * this.rippleAmp * (1 - r / 1.35);
        pos.setY(i, wave);
      }
      pos.needsUpdate = true;
      this.liquidGeo.computeVertexNormals();
    }

    // Dashi golden expansion ring
    if (this.dashiRingAnim > 0) {
      this.dashiRingAnim += dt * 1.4;
      const t = this.dashiRingAnim;
      this.dashiRing.position.y = this.getLiquidLocalY() + 0.02;
      this.dashiRing.scale.setScalar(0.5 + t * 3.1);
      this.dashiRingMat.opacity = Math.max(0, (1 - t) * 0.75);
      if (t >= 1) {
        this.dashiRingAnim = 0;
        this.dashiRingMat.opacity = 0;
      }
    }

    // Stove clay flames (subtle stop-motion 10fps feel on flame flicker!)
    const targetHeat = this.heatOn ? 1 : 0;
    this.heatIntensity += (targetHeat - this.heatIntensity) * Math.min(1, dt * 4.5);
    const dialTargetZ = this.heatOn ? -Math.PI * 0.42 : 0;
    this.stoveDial.rotation.z += (dialTargetZ - this.stoveDial.rotation.z) * Math.min(1, dt * 8);
    const dialSq = this.dialSpring.step(dt);
    applySquash(this.stoveDial, dialSq * 0.08, 1);

    const steppedTime = Math.floor(this.time * 10) / 10;
    for (const f of this.flames) {
      if (this.heatIntensity > 0.02) {
        const pulse = 0.86 + Math.sin(steppedTime * 11 + f.phase) * 0.22;
        const s = this.heatIntensity * pulse;
        f.mesh.scale.set(s * 0.95, s * (1.05 + Math.cos(steppedTime * 9 + f.phase) * 0.16), s * 0.95);
      } else {
        f.mesh.scale.setScalar(0.001);
      }
    }
    this.flameLight.intensity = this.heatIntensity * (1.6 + Math.sin(steppedTime * 12) * 0.25);

    // Floating ingredients inside pot
    const ly = this.getLiquidLocalY();
    const orbitSpd = this.swirlSpeed * 0.65;

    for (const k of this.floatingKombu) {
      k.angle += dt * orbitSpd * 0.7;
      k.mesh.position.set(
        Math.cos(k.angle) * k.radius,
        Math.max(0.24, ly - k.sinkDepth + Math.sin(this.time * 2.2 + k.phase) * 0.02),
        Math.sin(k.angle) * k.radius
      );
      k.mesh.rotation.y = -k.angle + Math.sin(this.time * 1.4 + k.phase) * 0.2;
      // Gently fade kombu down slightly once miso turns opaque so tofu & wakame shine
      const visScale = Math.max(0.55, 1 - this.misoLevel * 0.35);
      k.mesh.scale.setScalar(visScale);
    }

    for (const t of this.floatingTofu) {
      t.angle += dt * orbitSpd;
      t.bobVel += (-t.bobOffset * 28 - t.bobVel * 4.5) * Math.min(dt, 0.04);
      t.bobOffset += t.bobVel * Math.min(dt, 0.04);
      const waveY = Math.sin(this.time * 2.8 + t.phase) * 0.024;
      t.mesh.position.set(
        Math.cos(t.angle) * t.radius,
        ly - 0.015 + t.bobOffset + waveY,
        Math.sin(t.angle) * t.radius
      );
      t.mesh.rotation.y += dt * (t.rotSpeed + orbitSpd);
      t.mesh.rotation.x = Math.sin(this.time * 2.3 + t.phase) * 0.12;
      t.mesh.rotation.z = Math.cos(this.time * 1.9 + t.phase) * 0.12;
    }

    for (const w of this.floatingWakame) {
      w.angle += dt * orbitSpd * 1.1;
      if (w.bloomDelay > 0) {
        w.bloomDelay -= dt;
      } else if (w.bloom < 1) {
        if (!w.bloomedSound) {
          w.bloomedSound = true;
          if (onWakameBloomed) onWakameBloomed(w);
        }
        w.bloom = Math.min(1, w.bloom + dt * 2.6);
      }
      // Elastic overshoot bloom curve!
      const b = w.bloom;
      const overshoot = b < 1 ? b + Math.sin(b * Math.PI) * 0.32 : 1;
      const sx = 0.28 + overshoot * 0.85;
      const sy = 0.32 + overshoot * 0.55;
      const sz = 0.28 + overshoot * 0.92;
      const undulate = Math.sin(this.time * 3.4 + w.phase) * 0.08 * b;
      w.mesh.scale.set(sx + undulate, sy, sz - undulate);
      w.mesh.position.set(
        Math.cos(w.angle) * w.radius,
        ly + 0.015 + Math.sin(this.time * 2.5 + w.phase) * 0.02,
        Math.sin(w.angle) * w.radius
      );
      w.mesh.rotation.y = -w.angle + Math.sin(this.time * 1.6 + w.phase) * 0.25;
    }

    // Swirl speed gently decays back to simmering baseline
    const baseSwirl = this.heatOn ? 0.32 : 0.08;
    this.swirlSpeed += (baseSwirl - this.swirlSpeed) * Math.min(1, dt * 2.2);

    // Simmer bubbles (only while actively boiling on the stove!)
    for (const b of this.simmerBubbles) {
      if (this.heatOn && this.heatIntensity > 0.35 && this.waterLevel > 0.4) {
        b.mesh.visible = true;
        const cyc = (this.time * 1.25 + b.phase) % 1;
        const s = Math.sin(cyc * Math.PI) * 1.05 * this.heatIntensity;
        b.mesh.position.set(b.x, ly + 0.005 + cyc * 0.035, b.z);
        b.mesh.scale.set(s, s * 0.65, s);
        b.mat.color.copy(this.getCurrentSoupColor()).lerp(new THREE.Color(0xffffff), 0.55);
      } else {
        b.mesh.visible = false;
      }
    }

    // Plump clay steam clouds when warm
    for (const p of this.steamPuffs) {
      if (this.heatIntensity > 0.25 && this.waterLevel > 0.35) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.life = 0;
          p.angle = Math.random() * Math.PI * 2;
          p.radius = 0.14 + Math.random() * 0.72;
        }
        const t = p.life / p.maxLife;
        p.mesh.visible = true;
        const drift = Math.sin(t * Math.PI * 2 + p.angle) * 0.18;
        p.mesh.position.set(
          Math.cos(p.angle) * p.radius + drift,
          ly + 0.18 + t * 1.75,
          Math.sin(p.angle) * p.radius + Math.cos(t * 5 + p.angle) * 0.1
        );
        const s = (0.45 + t * 1.15) * Math.sin(t * Math.PI) * this.heatIntensity;
        p.mesh.scale.set(s * 1.15, s * 0.9, s * 1.05);
        p.mat.opacity = Math.sin(t * Math.PI) * 0.44 * this.heatIntensity;
      } else {
        p.mesh.visible = false;
      }
    }

    // Splash droplets physics
    for (const d of this.splashDrops) {
      if (!d.active) continue;
      d.life += dt;
      d.vel.y -= 8.8 * dt;
      d.pos.addScaledVector(d.vel, dt);
      d.mesh.position.copy(d.pos);
      if (d.life > 0.65 || d.pos.y < ly - 0.1) {
        d.active = false;
        d.mesh.visible = false;
      }
    }

    // Swirling miso dissolve clouds
    for (const c of this.misoClouds) {
      if (!c.active) continue;
      c.life += dt;
      const t = c.life / c.maxLife;
      if (t >= 1) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      c.angle += dt * (1.8 + this.swirlSpeed);
      c.radius = Math.min(1.02, c.radius + dt * 0.42);
      c.mesh.position.set(
        Math.cos(c.angle) * c.radius,
        ly + 0.01,
        Math.sin(c.angle) * c.radius
      );
      const s = 0.65 + t * 1.65;
      c.mesh.scale.set(s * 1.35, 0.22, s * 0.95);
      c.mesh.rotation.y = -c.angle;
      c.mat.opacity = Math.sin(t * Math.PI) * 0.72;
    }
  }
}
