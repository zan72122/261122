import * as THREE from '../vendor/three.module.js';
import {
  INK_COLOR,
  TOON_GRADIENT_3,
  TOON_GRADIENT_4,
  addOutline,
  createBowlBottomEmblemTexture,
  createCelMaterial,
  createDonburiTexture,
  createEggBowlTexture,
  createLidWoodTexture,
  createPlateTexture,
  createSparkleStarTexture,
  createSteamCloudTexture,
  createTileWallTexture,
  createWoodTexture,
  makeCelHighlight,
  makeCelMesh,
} from './cel.js';

export class OyakodonKitchen {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.flameLevel = 1; // 0: low, 1: medium, 2: high
    this.cookProgress = 0; // 0..1 simmer progress
    this.eggWhisk = 0; // 0..1 whisking blend
    this.eggPourProgress = 0; // 0..1 amount poured into pan
    this.steamProgress = 0; // 0..1 fuwatoro puffing under lid
    this.eggPuffiness = 0; // 0..1 3D fluffy custard dome
    this.jiggleEnergy = 0;
    this.lidRattleBoost = 0;
    this.revealGlow = 0;
    this.yolkPopped = false;
    this.bitesTaken = 0;
    this.maxBites = 4;
    this.panRedrawTimer = 0;

    this.wiggles = new Map();
    this.ingredients = [];
    this.garnishes = [];
    this.pouredSpots = [];

    this._buildRoom();
    this._buildStove();
    this._buildPan();
    this._buildPrepPlateAndIngredients();
    this._buildEggStation();
    this._buildWoodenLid();
    this._buildRiceBowl();
    this._buildGarnishDish();
    this._buildVFX();
    this._buildIdleHintHand();
  }

  triggerWiggle(obj, strength = 1.0) {
    this.wiggles.set(obj, { time: 0.42, strength });
  }

  _buildRoom() {
    // Warm sunlit wooden kitchen counter
    const woodTex = createWoodTexture('#e6ad6f', '#bc7a3e', '#5a3216');
    woodTex.repeat.set(2.5, 1.5);
    const counter = makeCelMesh(new THREE.BoxGeometry(16, 1.2, 7.6), 0xffffff, {
      map: woodTex,
      outlineThickness: 0.04,
    });
    counter.position.set(0, -0.6, 0.5);
    counter.receiveShadow = true;
    this.root.add(counter);

    // Cream ceramic tile back wall
    const tileTex = createTileWallTexture();
    tileTex.repeat.set(2.4, 1.8);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({ map: tileTex })
    );
    wall.position.set(0, 4.4, -3.7);
    this.root.add(wall);

    // Subtle wooden backsplash trim strip along counter/wall seam
    const trim = makeCelMesh(new THREE.BoxGeometry(16, 0.24, 0.24), 0xc78344, {
      outlineThickness: 0.03,
    });
    trim.position.set(0, 0.12, -3.55);
    this.root.add(trim);
  }

  _buildStove() {
    this.stoveGroup = new THREE.Group();
    this.stoveGroup.position.set(0, 0, 0.28);
    this.root.add(this.stoveGroup);

    // Cute retro Japanese enamel tabletop gas stove (warm mint-cream)
    const bodyGeo = new THREE.BoxGeometry(2.2, 0.44, 1.92);
    const body = makeCelMesh(bodyGeo, 0xd8ebe0, {
      outlineThickness: 0.04,
    });
    body.position.set(0, 0.22, 0);
    this.stoveGroup.add(body);

    // Top dark-slate burner plate
    const plate = makeCelMesh(new THREE.CylinderGeometry(0.92, 0.96, 0.08, 24), 0x3b4046, {
      outlineThickness: 0.026,
    });
    plate.position.set(0, 0.46, -0.02);
    this.stoveGroup.add(plate);

    // 6 iron grate prongs (gotoku)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const prong = makeCelMesh(new THREE.BoxGeometry(0.11, 0.14, 0.44), 0x2c3035, {
        outlineThickness: 0.02,
      });
      prong.position.set(Math.cos(a) * 0.72, 0.52, -0.02 + Math.sin(a) * 0.72);
      prong.rotation.y = -a + Math.PI / 2;
      this.stoveGroup.add(prong);
    }

    // Center brass burner ring
    const burner = makeCelMesh(new THREE.CylinderGeometry(0.36, 0.4, 0.1, 18), 0x5c6066, {
      outlineThickness: 0.022,
    });
    burner.position.set(0, 0.49, -0.02);
    this.stoveGroup.add(burner);

    // Stylized Cel-Shaded Gas Flame Petals peeking visibly out around the base of the golden pan!
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 0.54, -0.02);
    this.stoveGroup.add(this.flameGroup);
    this.flamePetals = [];
    const petalGeo = new THREE.ConeGeometry(0.13, 0.42, 7);
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x26b8ff });
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff921c });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, blueMat);
      petal.position.set(Math.cos(a) * 0.84, 0.1, Math.sin(a) * 0.84);
      petal.rotation.z = -Math.cos(a) * 0.52;
      petal.rotation.x = Math.sin(a) * 0.52;
      petal.userData.angle = a;
      petal.userData.phase = i * 0.65;

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), orangeMat);
      tip.position.y = 0.12;
      petal.add(tip);

      this.flameGroup.add(petal);
      this.flamePetals.push(petal);
    }

    // Chunky Tactile Red Rotary Flame Dial Knob on front face!
    this.knobGroup = new THREE.Group();
    this.knobGroup.position.set(0.68, 0.22, 0.98);
    this.stoveGroup.add(this.knobGroup);

    const knobBase = makeCelMesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 16), 0xfff6e3, {
      outlineThickness: 0.028,
    });
    knobBase.rotation.x = Math.PI / 2;
    this.knobGroup.add(knobBase);

    this.knobDial = new THREE.Group();
    this.knobDial.position.z = 0.08;
    this.knobGroup.add(this.knobDial);

    const dialCyl = makeCelMesh(new THREE.CylinderGeometry(0.18, 0.19, 0.14, 16), 0xef4e3e, {
      outlineThickness: 0.028,
    });
    dialCyl.rotation.x = Math.PI / 2;
    this.knobDial.add(dialCyl);

    const dialBar = makeCelMesh(new THREE.BoxGeometry(0.08, 0.34, 0.16), 0xffd24c, {
      outlineThickness: 0.024,
    });
    dialBar.position.z = 0.04;
    this.knobDial.add(dialBar);

    // 3 little heat indicator dots around knob (no text/numbers!)
    [-0.6, 0, 0.6].forEach((ang, idx) => {
      const dot = makeCelMesh(new THREE.SphereGeometry(0.036 + idx * 0.012, 8, 8), idx === 2 ? 0xef4e3e : 0xff9f2e, {
        outline: false,
      });
      dot.position.set(Math.sin(ang) * 0.29, Math.cos(ang) * 0.29, -0.02);
      this.knobGroup.add(dot);
    });
  }

  _buildPan() {
    // Authentic shallow Japanese oyakodon pan (oyako-nabe) with vertical wooden handle!
    this.panHome = new THREE.Vector3(0, 0.56, 0.26);
    this.panGroup = new THREE.Group();
    this.panGroup.position.copy(this.panHome);
    this.root.add(this.panGroup);

    // Shallow flared metallic brass/gold pan wall via LatheGeometry
    const panPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.76, 0.0),
      new THREE.Vector2(0.84, 0.06),
      new THREE.Vector2(0.95, 0.34),
      new THREE.Vector2(0.99, 0.36),
      new THREE.Vector2(0.93, 0.37),
      new THREE.Vector2(0.88, 0.32),
      new THREE.Vector2(0.78, 0.08),
      new THREE.Vector2(0.0, 0.06),
    ];
    const panGeo = new THREE.LatheGeometry(panPts, 28);
    this.panMetal = makeCelMesh(panGeo, 0xf2c56b, {
      outlineThickness: 0.036,
      gradientMap: TOON_GRADIENT_4,
    });
    this.panGroup.add(this.panMetal);

    // Iconic angled vertical oyakodon wooden handle!
    const handlePivot = new THREE.Group();
    handlePivot.position.set(-0.88, 0.3, -0.18);
    handlePivot.rotation.set(-0.22, 0.35, 0.36);
    this.panGroup.add(handlePivot);

    const metalNeck = makeCelMesh(new THREE.CylinderGeometry(0.065, 0.085, 0.26, 10), 0xd8a852, {
      outlineThickness: 0.024,
    });
    metalNeck.position.y = 0.12;
    handlePivot.add(metalNeck);

    const woodGrip = makeCelMesh(new THREE.CapsuleGeometry(0.11, 0.62, 6, 12), 0xc47b3c, {
      outlineThickness: 0.032,
    });
    woodGrip.position.y = 0.55;
    handlePivot.add(woodGrip);

    // === Dynamic Broth & Egg Surface Canvas (512x512) ===
    this.panCanvas = document.createElement('canvas');
    this.panCanvas.width = 512;
    this.panCanvas.height = 512;
    this.panCtx = this.panCanvas.getContext('2d');
    this.panTex = new THREE.CanvasTexture(this.panCanvas);
    this.panTex.colorSpace = THREE.SRGBColorSpace;

    // Group containing everything inside the pan that slides onto the rice in Stage 4!
    this.panContents = new THREE.Group();
    this.panGroup.add(this.panContents);

    // Subdivided disk for wavy simmering & puffy fuwatoro dome!
    const surfGeo = new THREE.CircleGeometry(0.84, 28);
    surfGeo.rotateX(-Math.PI / 2);
    // Replace with custom radial rings so center can puff up into a plump 3D fuwatoro pillow!
    const puffGeo = this._createRadialDiskGeometry(0.84, 26, 8);
    this.panSurfaceGeo = puffGeo;
    this.panSurfaceBasePos = new Float32Array(puffGeo.attributes.position.array);

    this.panSurfaceMat = createCelMaterial(0xffffff, {
      map: this.panTex,
      gradientMap: TOON_GRADIENT_4,
    });
    this.panSurface = new THREE.Mesh(puffGeo, this.panSurfaceMat);
    this.panSurface.position.y = 0.16;
    this.panContents.add(this.panSurface);

    // Anime glossy white shine glints on the egg/broth surface!
    this.panGlints = new THREE.Group();
    this.panGlints.position.y = 0.21;
    const g1 = makeCelHighlight(0.24, 0.09, 0.88);
    g1.position.set(-0.28, 0.08, -0.22);
    g1.rotation.set(-Math.PI / 2, 0, 0.45);
    const g2 = makeCelHighlight(0.13, 0.065, 0.85);
    g2.position.set(0.32, 0.06, -0.14);
    g2.rotation.set(-Math.PI / 2, 0, -0.35);
    const g3 = makeCelHighlight(0.16, 0.06, 0.8);
    g3.position.set(0.06, 0.11, 0.28);
    g3.rotation.set(-Math.PI / 2, 0, 0.15);
    this.panGlints.add(g1, g2, g3);
    this.panContents.add(this.panGlints);

    // Container for ingredients once they land inside the pan
    this.simmeredItemsGroup = new THREE.Group();
    this.panContents.add(this.simmeredItemsGroup);

    this._redrawPanSurface(0);
  }

  _createRadialDiskGeometry(radius, segs, rings) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Center vertex
    positions.push(0, 0, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);

    for (let r = 1; r <= rings; r++) {
      const frac = r / rings;
      const rad = frac * radius;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        positions.push(x, 0, z);
        normals.push(0, 1, 0);
        uvs.push(0.5 + (x / radius) * 0.5, 0.5 - (z / radius) * 0.5);
      }
    }

    // Center fan
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      indices.push(0, 1 + next, 1 + s);
    }
    // Outer rings
    for (let r = 1; r < rings; r++) {
      const rowA = 1 + (r - 1) * segs;
      const rowB = 1 + r * segs;
      for (let s = 0; s < segs; s++) {
        const next = (s + 1) % segs;
        indices.push(rowA + s, rowA + next, rowB + next);
        indices.push(rowA + s, rowB + next, rowB + s);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    return geom;
  }

  _redrawPanSurface(t) {
    const ctx = this.panCtx;
    ctx.clearRect(0, 0, 512, 512);

    // Rich amber warishita dashi broth base
    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    grad.addColorStop(0, '#dc943c');
    grad.addColorStop(0.65, '#b8681f');
    grad.addColorStop(1, '#854212');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Animated broth simmer rings
    ctx.strokeStyle = 'rgba(255, 232, 170, 0.5)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.55 + i * 0.25) % 1;
      const bx = 256 + Math.cos(i * 2.1) * 95;
      const by = 256 + Math.sin(i * 1.7) * 95;
      ctx.globalAlpha = (1 - p) * 0.65;
      ctx.beginPath();
      ctx.arc(bx, by, 12 + p * 44, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Poured beaten egg golden ribbons & lush bright fuwatoro custard curds!
    if (this.eggPourProgress > 0.01) {
      const puff = this.eggPuffiness;
      if (this.eggPourProgress > 0.15) {
        const cov = Math.min(1, (this.eggPourProgress - 0.1) * 1.15);
        const eg = ctx.createRadialGradient(256, 256, 20, 256, 256, 248);
        eg.addColorStop(0, puff > 0.3 ? '#fff08c' : '#ffdc52');
        eg.addColorStop(0.55, '#ffd038');
        eg.addColorStop(0.88, '#f5a91f');
        eg.addColorStop(1, '#d97e12');
        ctx.globalAlpha = cov * 0.96;
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(256, 256, 248 * Math.min(1, 0.48 + cov * 0.54), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Painted golden & silky white swirled ribbons where user poured!
      for (let i = 0; i < this.pouredSpots.length; i++) {
        const s = this.pouredSpots[i];
        const px = 256 + s.x * 235;
        const py = 256 - s.z * 235;
        const r = s.r * (1 + puff * 0.38);

        ctx.fillStyle = s.white ? '#fffdf0' : '#ffe35c';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        if (puff > 0.25) {
          ctx.strokeStyle = 'rgba(225, 138, 22, 0.42)';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      }

      // Iconic anime marbled silky white ribbons on fuwatoro egg (including lush outer rim swirls!)
      if (this.eggPourProgress > 0.3) {
        ctx.strokeStyle = 'rgba(255, 254, 244, 0.95)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 24 + puff * 10;
        for (let w = 0; w < 6; w++) {
          const a0 = w * 1.05 + 0.15;
          ctx.beginPath();
          ctx.arc(256, 256, 118 + (w % 3) * 38, a0, a0 + 0.92);
          ctx.stroke();
        }
        // Rich warm-gold custard sheen swirls
        ctx.strokeStyle = 'rgba(255, 178, 22, 0.8)';
        ctx.lineWidth = 18;
        for (let w = 0; w < 5; w++) {
          const a0 = w * 1.25 + 0.65;
          ctx.beginPath();
          ctx.arc(256, 256, 132 + (w % 2) * 44, a0, a0 + 1.05);
          ctx.stroke();
        }
        // Bright anime white glossy crescent highlights right on the egg custard!
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        [
          [145, 325, 26, 12, -0.45],
          [358, 338, 22, 10, 0.45],
          [260, 396, 28, 11, 0.05],
          [125, 210, 18, 9, -0.9],
        ].forEach(([hx, hy, rx, ry, rot]) => {
          ctx.beginPath();
          ctx.ellipse(hx, hy, rx, ry, rot, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    this.panTex.needsUpdate = true;
  }

  addEggRibbonAt(localX, localZ) {
    const r = Math.hypot(localX, localZ);
    const scale = r > 0.7 ? 0.7 / r : 1;
    this.pouredSpots.push({
      x: localX * scale,
      z: localZ * scale,
      r: 36 + Math.random() * 20,
      white: Math.random() < 0.32,
    });
    if (this.pouredSpots.length > 48) this.pouredSpots.shift();
  }

  _buildPrepPlateAndIngredients() {
    this.plateHome = new THREE.Vector3(-2.05, 0.0, 0.92);
    this.plateGroup = new THREE.Group();
    this.plateGroup.position.copy(this.plateHome);
    this.root.add(this.plateGroup);

    // Ceramic prep plate
    const plateTex = createPlateTexture();
    const platePts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.62, 0),
      new THREE.Vector2(0.94, 0.14),
      new THREE.Vector2(0.9, 0.17),
      new THREE.Vector2(0.58, 0.06),
      new THREE.Vector2(0, 0.05),
    ];
    const plateMesh = makeCelMesh(new THREE.LatheGeometry(platePts, 24), 0xffffff, {
      map: plateTex,
      outlineThickness: 0.034,
    });
    this.plateGroup.add(plateMesh);

    this.spawnIngredients();
  }

  spawnIngredients() {
    // Clear previous ingredients
    this.ingredients.forEach((item) => {
      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
    });
    this.ingredients = [];

    // 4 plump bite-sized chicken chunks + 5 crisp solid crescent onion slices!
    const chickenSpots = [
      [-0.44, 0.17, 0.18],
      [-0.12, 0.18, 0.42],
      [-0.46, 0.18, -0.24],
      [-0.1, 0.18, -0.08],
    ];

    chickenSpots.forEach((pos, idx) => {
      const g = new THREE.Group();
      const mat = createCelMaterial(0xf8b5ac, { gradientMap: TOON_GRADIENT_3 });
      const geo = new THREE.DodecahedronGeometry(0.2, 1);
      const pAttr = geo.attributes.position;
      for (let i = 0; i < pAttr.count; i++) {
        const vx = pAttr.getX(i);
        const vy = pAttr.getY(i);
        const vz = pAttr.getZ(i);
        pAttr.setXYZ(i, vx * 1.18, vy * 0.74, vz * 0.92);
      }
      geo.computeVertexNormals();
      const chunk = makeCelMesh(geo, 0xf8b5ac, {
        material: mat,
        outlineThickness: 0.03,
      });
      // Glossy cel shine on chicken
      const glint = makeCelHighlight(0.075, 0.042, 0.88);
      glint.position.set(-0.05, 0.15, 0.04);
      glint.rotation.x = -Math.PI / 2;
      chunk.add(glint);
      g.add(chunk);

      g.position.set(
        this.plateGroup.position.x + pos[0],
        pos[1],
        this.plateGroup.position.z + pos[2]
      );
      g.rotation.y = idx * 1.35;
      this.root.add(g);

      this.ingredients.push({
        type: 'chicken',
        mesh: g,
        mat,
        homeLocal: new THREE.Vector3(pos[0], pos[1], pos[2]),
        inPan: false,
        dragging: false,
        cooked: 0,
        panOffset: new THREE.Vector2(
          Math.cos(idx * 1.57 + 0.45) * 0.34,
          Math.sin(idx * 1.57 + 0.45) * 0.34
        ),
        bobPhase: idx * 1.4,
      });
    });

    // 5 crisp CLOSED crescent-sliced onions (ExtrudeGeometry — zero hollow ends!)
    const onionShape = new THREE.Shape();
    onionShape.absarc(0, 0, 0.25, -Math.PI * 0.15, Math.PI * 1.05, false);
    onionShape.absarc(0, 0.03, 0.145, Math.PI * 1.02, -Math.PI * 0.12, true);
    onionShape.closePath();
    const onionGeo = new THREE.ExtrudeGeometry(onionShape, {
      depth: 0.065,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 14,
    });
    onionGeo.rotateX(Math.PI / 2);
    onionGeo.center();

    const onionSpots = [
      [0.36, 0.14, 0.34],
      [0.52, 0.14, 0.04],
      [0.24, 0.15, -0.36],
      [0.48, 0.15, -0.26],
      [0.22, 0.16, 0.06],
    ];
    onionSpots.forEach((pos, idx) => {
      const g = new THREE.Group();
      const mat = createCelMaterial(0xfffcf0, { gradientMap: TOON_GRADIENT_3 });
      const slice = makeCelMesh(onionGeo, 0xfffcf0, {
        material: mat,
        outlineThickness: 0.026,
      });
      g.add(slice);

      g.position.set(
        this.plateGroup.position.x + pos[0],
        pos[1],
        this.plateGroup.position.z + pos[2]
      );
      g.rotation.y = idx * 1.05 + 0.4;
      this.root.add(g);

      this.ingredients.push({
        type: 'onion',
        mesh: g,
        mat,
        homeLocal: new THREE.Vector3(pos[0], pos[1], pos[2]),
        inPan: false,
        dragging: false,
        cooked: 0,
        panOffset: new THREE.Vector2(
          Math.cos(idx * 1.25 + 0.9) * 0.44,
          Math.sin(idx * 1.25 + 0.9) * 0.44
        ),
        bobPhase: idx * 1.9 + 0.5,
      });
    });
  }

  _buildEggStation() {
    this.eggBowlHome = new THREE.Vector3(2.04, 0.0, -0.66);
    this.eggBowlGroup = new THREE.Group();
    this.eggBowlGroup.position.copy(this.eggBowlHome);
    this.root.add(this.eggBowlGroup);

    // Striped ceramic egg bowl
    const ebTex = createEggBowlTexture();
    const ebPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.38, 0),
      new THREE.Vector2(0.62, 0.24),
      new THREE.Vector2(0.68, 0.54),
      new THREE.Vector2(0.62, 0.56),
      new THREE.Vector2(0.56, 0.24),
      new THREE.Vector2(0.34, 0.07),
      new THREE.Vector2(0, 0.06),
    ];
    const bowlMesh = makeCelMesh(new THREE.LatheGeometry(ebPts, 24), 0xffffff, {
      map: ebTex,
      outlineThickness: 0.034,
    });
    this.eggBowlGroup.add(bowlMesh);

    // Dynamic 256x256 liquid egg whisking canvas inside bowl
    this.eggCanvas = document.createElement('canvas');
    this.eggCanvas.width = 256;
    this.eggCanvas.height = 256;
    this.eggCtx = this.eggCanvas.getContext('2d');
    this.eggTex = new THREE.CanvasTexture(this.eggCanvas);
    this.eggTex.colorSpace = THREE.SRGBColorSpace;

    this.eggLiquid = new THREE.Mesh(
      new THREE.CircleGeometry(0.56, 22),
      createCelMaterial(0xffffff, { map: this.eggTex, gradientMap: TOON_GRADIENT_4 })
    );
    this.eggLiquid.rotation.x = -Math.PI / 2;
    this.eggLiquid.position.y = 0.36;
    this.eggLiquid.visible = false;
    this.eggBowlGroup.add(this.eggLiquid);

    // Whole 3D Egg sitting in/on bowl before cracking!
    this.wholeEggGroup = new THREE.Group();
    this.wholeEggGroup.position.set(0, 0.44, 0);
    const eggGeo = new THREE.SphereGeometry(0.29, 18, 16);
    eggGeo.scale(0.86, 1.16, 0.86);
    this.wholeEggMesh = makeCelMesh(eggGeo, 0xf7e3c6, { outlineThickness: 0.032 });
    const eggGlint = makeCelHighlight(0.09, 0.14, 0.9);
    eggGlint.position.set(-0.1, 0.1, 0.22);
    eggGlint.rotation.y = -0.45;
    this.wholeEggMesh.add(eggGlint);
    this.wholeEggGroup.add(this.wholeEggMesh);
    this.eggBowlGroup.add(this.wholeEggGroup);

    // Cracked egg shell halves (brief animated pop!)
    this.shellHalves = new THREE.Group();
    this.shellHalves.visible = false;
    const halfGeo = new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
    halfGeo.scale(0.86, 1.12, 0.86);
    this.shellLeft = makeCelMesh(halfGeo, 0xf7e3c6, {
      outlineThickness: 0.028,
      side: THREE.DoubleSide,
    });
    this.shellRight = makeCelMesh(halfGeo, 0xf7e3c6, {
      outlineThickness: 0.028,
      side: THREE.DoubleSide,
    });
    this.shellRight.rotation.z = Math.PI;
    this.shellHalves.add(this.shellLeft, this.shellRight);
    this.shellHalves.position.set(0, 0.82, 0);
    this.eggBowlGroup.add(this.shellHalves);
    this.crackAnim = 0;

    // Pair of red-tipped wooden chopsticks for whisking!
    this.chopsticksGroup = new THREE.Group();
    this.chopsticksGroup.position.set(0, 0.46, 0);
    this.chopsticksGroup.visible = false;
    [-0.045, 0.045].forEach((ox, idx) => {
      const stick = makeCelMesh(new THREE.CylinderGeometry(0.036, 0.018, 1.25, 8), 0xde9a56, {
        outlineThickness: 0.018,
      });
      stick.position.set(ox, 0.48, 0);
      stick.rotation.z = idx === 0 ? -0.14 : -0.22;
      stick.rotation.x = 0.16;
      const tip = makeCelMesh(new THREE.CylinderGeometry(0.038, 0.035, 0.24, 8), 0xe64a3b, {
        outlineThickness: 0.016,
      });
      tip.position.y = 0.52;
      stick.add(tip);
      this.chopsticksGroup.add(stick);
    });
    this.eggBowlGroup.add(this.chopsticksGroup);

    // 3D Glossy Golden Liquid Egg Pour Stream (tapered silky ribbon from tilted bowl spout into pan!)
    this.eggStream = new THREE.Group();
    const streamCyl = makeCelMesh(
      new THREE.CylinderGeometry(0.048, 0.088, 0.64, 12),
      0xffcf33,
      { outlineThickness: 0.022 }
    );
    const streamHighlight = makeCelHighlight(0.024, 0.24, 0.9);
    streamHighlight.position.set(-0.02, 0.02, 0.07);
    this.eggStream.add(streamCyl, streamHighlight);
    this.eggStream.visible = false;
    this.root.add(this.eggStream);

    this._redrawEggBowl(0);
  }

  _redrawEggBowl(spinAngle) {
    const ctx = this.eggCtx;
    const w = this.eggWhisk;
    ctx.clearRect(0, 0, 256, 256);

    // Base color blends from translucent egg white -> rich golden beaten egg
    const r = Math.round(255);
    const g = Math.round(248 - w * 46);
    const b = Math.round(226 - w * 176);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 256, 256);

    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(spinAngle);

    // Distinct glossy orange yolks fade into swirling golden-white marbled ribbons!
    if (w < 0.72) {
      const alpha = 1 - w / 0.72;
      ctx.globalAlpha = alpha;
      [
        [-30, -14],
        [32, 18],
      ].forEach(([yx, yy]) => {
        ctx.fillStyle = '#ff981a';
        ctx.beginPath();
        ctx.arc(yx, yy, 38 * (1 - w * 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d96b08';
        ctx.lineWidth = 4;
        ctx.stroke();
        // Anime gloss highlight on yolk
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(yx - 12, yy - 14, 11, 7, -0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Swirl ribbons as you whisk!
    if (w > 0.06) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.strokeStyle = i % 2 === 0 ? '#ffa822' : '#fff8df';
        ctx.lineWidth = 18 - w * 6;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + i * 13, a, a + 1.4 + w * 1.4);
        ctx.stroke();
      }
    }

    ctx.restore();
    this.eggTex.needsUpdate = true;
  }

  _buildWoodenLid() {
    this.lidHome = new THREE.Vector3(-2.12, 0.24, -0.78);
    this.lidGroup = new THREE.Group();
    this.lidGroup.position.copy(this.lidHome);
    this.lidGroup.rotation.set(0.35, 0.22, -0.1);
    this.root.add(this.lidGroup);

    const lidTex = createLidWoodTexture();
    const disc = makeCelMesh(new THREE.CylinderGeometry(0.96, 0.98, 0.1, 26), 0xffffff, {
      map: lidTex,
      outlineThickness: 0.036,
    });
    this.lidGroup.add(disc);

    // Traditional wooden bar handle across top of oyakodon lid
    const bar = makeCelMesh(new THREE.BoxGeometry(0.86, 0.18, 0.16), 0xc78342, {
      outlineThickness: 0.03,
    });
    bar.position.y = 0.16;
    this.lidGroup.add(bar);

    [-0.3, 0.3].forEach((x) => {
      const peg = makeCelMesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), 0xb06c30, {
        outlineThickness: 0.024,
      });
      peg.position.set(x, 0.08, 0);
      this.lidGroup.add(peg);
    });
  }

  _buildRiceBowl() {
    this.riceBowlHome = new THREE.Vector3(2.08, 0.0, 0.92);
    this.riceBowlGroup = new THREE.Group();
    this.riceBowlGroup.position.copy(this.riceBowlHome);
    this.root.add(this.riceBowlGroup);

    // Classic Japanese ceramic Donburi Bowl! (Outer patterned shell + solid cream ceramic inner liner!)
    const donTex = createDonburiTexture();
    const outerPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.5, 0),
      new THREE.Vector2(0.52, 0.12),
      new THREE.Vector2(0.86, 0.42),
      new THREE.Vector2(1.0, 0.82),
      new THREE.Vector2(0.93, 0.84),
    ];
    const outerMesh = makeCelMesh(new THREE.LatheGeometry(outerPts, 28), 0xffffff, {
      map: donTex,
      outlineThickness: 0.038,
    });
    this.riceBowlGroup.add(outerMesh);

    // Solid glossy cream ceramic inner bowl wall (DoubleSide so interior is ALWAYS solid & opaque!)
    const innerPts = [
      new THREE.Vector2(0.93, 0.84),
      new THREE.Vector2(0.82, 0.44),
      new THREE.Vector2(0.46, 0.16),
      new THREE.Vector2(0.0, 0.15),
    ];
    const innerMesh = makeCelMesh(new THREE.LatheGeometry(innerPts, 28), 0xfff8ea, {
      outline: false,
      side: THREE.DoubleSide,
    });
    this.riceBowlGroup.add(innerMesh);

    // Rim cap ring with crisp ink outline feel
    const rimRing = makeCelMesh(new THREE.TorusGeometry(0.965, 0.036, 8, 28), 0xd94532, {
      outlineThickness: 0.024,
    });
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.825;
    this.riceBowlGroup.add(rimRing);

    // Hidden cute painted flower emblem at the bottom of the bowl (Discovery when eaten clean!)
    const emblemTex = createBowlBottomEmblemTexture();
    this.bowlEmblem = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 20),
      new THREE.MeshBasicMaterial({ map: emblemTex })
    );
    this.bowlEmblem.rotation.x = -Math.PI / 2;
    this.bowlEmblem.position.y = 0.175;
    this.riceBowlGroup.add(this.bowlEmblem);

    // Fluffy White Rice Mound! (Plump dome with glossy anime grain highlights!)
    this.riceMoundGroup = new THREE.Group();
    this.riceMoundGroup.position.set(0, 0.68, 0);
    this.riceBowlGroup.add(this.riceMoundGroup);

    const riceBase = makeCelMesh(
      new THREE.SphereGeometry(0.87, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
      0xfffdf6,
      { outlineThickness: 0.032 }
    );
    riceBase.scale.set(1.0, 0.56, 1.0);
    this.riceMoundGroup.add(riceBase);

    // Sculpted puffy rice grain cluster bumps for appetizing cel-anime texture
    const grainGeo = new THREE.SphereGeometry(0.115, 8, 6);
    grainGeo.scale(1.3, 0.72, 0.9);
    for (let i = 0; i < 24; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt(i / 24) * 0.68;
      const g = makeCelMesh(grainGeo, i % 3 === 0 ? 0xffffff : 0xf9f3e4, { outline: false });
      const domeY = Math.cos((r / 0.87) * (Math.PI / 2)) * 0.45;
      g.position.set(Math.cos(a) * r, domeY, Math.sin(a) * r);
      g.rotation.y = a;
      this.riceMoundGroup.add(g);
    }

    // Container where the slided oyakodon topping + garnishes live on the rice!
    this.bowlToppingMount = new THREE.Group();
    this.bowlToppingMount.position.set(0, 0.95, 0);
    this.riceBowlGroup.add(this.bowlToppingMount);

    // Applied garnishes on top of finished oyakodon
    this.placedGarnishesGroup = new THREE.Group();
    this.bowlToppingMount.add(this.placedGarnishesGroup);
  }

  _buildGarnishDish() {
    this.garnishDishHome = new THREE.Vector3(-2.1, 0.0, 1.12);
    this.garnishDishGroup = new THREE.Group();
    this.garnishDishGroup.position.set(-4.5, 0, 1.12); // slides in for Stage 5!
    this.garnishDishGroup.visible = false;
    this.root.add(this.garnishDishGroup);

    // Cute pale celadon saucer
    const saucerPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.55, 0),
      new THREE.Vector2(0.84, 0.14),
      new THREE.Vector2(0.8, 0.16),
      new THREE.Vector2(0.5, 0.06),
      new THREE.Vector2(0, 0.05),
    ];
    const saucer = makeCelMesh(new THREE.LatheGeometry(saucerPts, 22), 0xd2edd8, {
      outlineThickness: 0.032,
    });
    this.garnishDishGroup.add(saucer);

    this.resetGarnishes();
  }

  resetGarnishes() {
    this.garnishes.forEach((g) => {
      if (g.mesh.parent) g.mesh.parent.remove(g.mesh);
    });
    this.garnishes = [];
    this.yolkPopped = false;
    while (this.placedGarnishesGroup.children.length) {
      this.placedGarnishesGroup.remove(this.placedGarnishesGroup.children[0]);
    }

    // 1. Fresh Emerald Mitsuba Leaf Sprig (classic 3-leaf Japanese trefoil!)
    const mitsuba = new THREE.Group();
    const leafGeo = new THREE.SphereGeometry(0.16, 10, 8);
    leafGeo.scale(0.8, 0.2, 1.35);
    [0, 2.09, 4.18].forEach((a) => {
      const lf = makeCelMesh(leafGeo, 0x35b84b, { outlineThickness: 0.024 });
      lf.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
      lf.rotation.y = -a + Math.PI / 2;
      mitsuba.add(lf);
    });
    const stem = makeCelMesh(new THREE.CapsuleGeometry(0.025, 0.2, 4, 6), 0x2a943c, {
      outlineThickness: 0.016,
    });
    stem.rotation.x = Math.PI / 2;
    stem.position.set(0, -0.02, 0.22);
    mitsuba.add(stem);
    mitsuba.position.set(-0.32, 0.18, 0.18);
    this.garnishDishGroup.add(mitsuba);
    this.garnishes.push({ kind: 'mitsuba', mesh: mitsuba, used: false, localHome: mitsuba.position.clone() });

    // 2. Crispy Shredded Black Nori Strips
    const nori = new THREE.Group();
    const stripGeo = new THREE.BoxGeometry(0.36, 0.028, 0.085);
    for (let i = 0; i < 4; i++) {
      const st = makeCelMesh(stripGeo, 0x1e2c24, { outlineThickness: 0.016 });
      st.position.set((i - 1.5) * 0.03, i * 0.025, (i - 1.5) * 0.05);
      st.rotation.y = i * 0.48 - 0.5;
      nori.add(st);
    }
    nori.position.set(0.32, 0.16, 0.16);
    this.garnishDishGroup.add(nori);
    this.garnishes.push({ kind: 'nori', mesh: nori, used: false, localHome: nori.position.clone() });

    // 3. Glossy Extra Raw Egg Yolk ("Tsukimi" jewel! Pokable & poppable!)
    const yolk = new THREE.Group();
    const ySphere = makeCelMesh(new THREE.SphereGeometry(0.2, 16, 12), 0xff8d14, {
      outlineThickness: 0.028,
    });
    ySphere.scale.set(1.08, 0.72, 1.08);
    const yShine = makeCelHighlight(0.08, 0.05, 0.95);
    yShine.position.set(-0.07, 0.13, 0.08);
    yShine.rotation.set(-0.9, 0, -0.4);
    yolk.add(ySphere, yShine);
    yolk.position.set(0.0, 0.18, -0.28);
    this.garnishDishGroup.add(yolk);
    this.garnishes.push({ kind: 'yolk', mesh: yolk, used: false, localHome: yolk.position.clone() });
  }

  popExtraYolk() {
    if (this.yolkPopped) return false;
    const yolkItem = this.garnishes.find((g) => g.kind === 'yolk' && g.used);
    if (!yolkItem) return false;
    this.yolkPopped = true;
    // Flatten yolk orb into a rich cascading golden puddle!
    yolkItem.mesh.scale.set(1.75, 0.25, 1.75);
    yolkItem.mesh.position.y -= 0.05;

    // Add silky golden drip tongues!
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.35;
      const drip = makeCelMesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), 0xff9d18, {
        outlineThickness: 0.018,
      });
      drip.position.set(Math.cos(a) * 0.28, 0.04, Math.sin(a) * 0.28);
      drip.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      this.placedGarnishesGroup.add(drip);
    }
    this.jiggleEnergy = 1.0;
    return true;
  }

  _buildVFX() {
    // 1. Pooled Hand-Drawn Cel-Anime Puffy Steam Cloud Sprites (zero backface artifacts!)
    this.steamPuffs = [];
    const steamTex = createSteamCloudTexture();
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.SpriteMaterial({
        map: steamTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new THREE.Sprite(mat);
      m.visible = false;
      m.raycast = () => {};
      this.root.add(m);
      this.steamPuffs.push({
        mesh: m,
        mat,
        life: 0,
        maxLife: 1,
        vel: new THREE.Vector3(),
        baseScale: 0.7,
      });
    }

    // 2. Pooled Cel-Anime Sparkle Stars & Splash Droplets
    this.particles = [];
    const dropGeo = new THREE.OctahedronGeometry(0.11, 0);
    const starTex = createSparkleStarTexture();
    for (let i = 0; i < 36; i++) {
      const isStar = i < 18;
      let m;
      let mat;
      if (isStar) {
        mat = new THREE.SpriteMaterial({ map: starTex, transparent: true, opacity: 1, depthWrite: false });
        m = new THREE.Sprite(mat);
      } else {
        mat = new THREE.MeshBasicMaterial({ color: 0xffd54a });
        m = new THREE.Mesh(dropGeo, mat);
        addOutline(m, 0.02, INK_COLOR);
      }
      m.visible = false;
      m.raycast = () => {};
      this.root.add(m);
      this.particles.push({
        mesh: m,
        mat,
        isStar,
        life: 0,
        maxLife: 0.7,
        vel: new THREE.Vector3(),
        gravity: 9.0,
        spin: 0,
      });
    }

    // 3. Classic Japanese Cooking-Anime Reveal Sunburst Rays behind the pan (never blocking Hana-chan's face!)
    this.revealRays = new THREE.Group();
    this.revealRays.position.set(0, 1.05, -0.95);
    this.revealRays.visible = false;
    const rayGeo = new THREE.ConeGeometry(0.2, 3.2, 3);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffe478,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rayMat = rayMat;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0);
      ray.rotation.z = a + Math.PI / 2;
      ray.raycast = () => {};
      this.revealRays.add(ray);
    }
    this.root.add(this.revealRays);
  }

  _buildIdleHintHand() {
    // Gentle cel-shaded anime hand that ONLY appears after 10+ sec of total idle, demonstrating once!
    this.hintHand = new THREE.Group();
    this.hintHand.visible = false;

    const palm = makeCelMesh(new THREE.SphereGeometry(0.24, 12, 10), 0xffe4cc, {
      outlineThickness: 0.032,
    });
    palm.scale.set(1.0, 0.85, 0.55);
    const finger = makeCelMesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), 0xffe4cc, {
      outlineThickness: 0.024,
    });
    finger.position.set(-0.06, 0.24, 0.02);
    const thumb = makeCelMesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), 0xffe4cc, {
      outlineThickness: 0.024,
    });
    thumb.position.set(0.2, 0.02, 0.02);
    thumb.rotation.z = -0.7;

    this.hintHand.add(palm, finger, thumb);
    this.hintHand.rotation.x = -0.65;
    this.hintHand.renderOrder = 20;
    this.root.add(this.hintHand);
  }

  spawnSteam(pos, big = false) {
    const slot = this.steamPuffs.find((p) => p.life <= 0);
    if (!slot) return;
    slot.life = big ? 1.45 : 1.05;
    slot.maxLife = slot.life;
    slot.baseScale = big ? 0.92 + Math.random() * 0.35 : 0.55 + Math.random() * 0.25;
    slot.mesh.position.copy(pos);
    slot.mesh.position.x += (Math.random() - 0.5) * 0.65;
    slot.mesh.position.z += (Math.random() - 0.5) * 0.45;
    slot.vel.set((Math.random() - 0.5) * 0.42, big ? 1.55 : 1.0, (Math.random() - 0.5) * 0.25);
    slot.mesh.visible = true;
  }

  spawnBurst(pos, color = 0xffd54a, count = 10, floaty = false) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue;
      if (floaty && !p.isStar) continue;
      if (!floaty && p.isStar) continue;
      p.life = floaty ? 1.15 : 0.65;
      p.maxLife = p.life;
      if (!p.isStar) p.mat.color.setHex(color);
      else p.mat.color.setHex(0xffffff);
      p.mesh.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const spd = floaty ? 1.6 + Math.random() * 1.8 : 1.4 + Math.random() * 2.2;
      p.vel.set(Math.cos(a) * spd, (floaty ? 2.4 : 2.8) + Math.random() * 2.0, Math.sin(a) * spd);
      p.gravity = floaty ? 2.4 : 9.8;
      p.spin = (Math.random() - 0.5) * 12;
      p.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  triggerRevealBurst() {
    this.revealGlow = 1.0;
    this.jiggleEnergy = 1.0;
    this.spawnBurst(new THREE.Vector3(0, 1.15, 0.25), 0xffe066, 14, true);
    for (let i = 0; i < 6; i++) {
      this.spawnSteam(new THREE.Vector3(0, 0.92, 0.26), true);
    }
  }

  setFlameLevel(level) {
    this.flameLevel = level % 3;
    const angles = [0.65, 0, -0.65];
    this.knobDial.rotation.z = angles[this.flameLevel];
  }

  applyResponsiveLayout(aspect, snap = false) {
    if (aspect < 0.78) {
      // Tall Phone Portrait (iPhone): super roomy 2-row semi-circle so 100% fits cleanly inside screen!
      this.plateHome.set(-0.9, 0.0, 2.38);
      this.riceBowlHome.set(0.78, 0.0, 2.42);
      this.lidHome.set(-1.18, 0.24, -0.85);
      this.eggBowlHome.set(1.1, 0.12, -0.82);
      this.garnishDishHome.set(-1.02, 0.0, 2.28);
      this.portraitBowlScale = 0.88;
    } else {
      // Landscape (iPad / Desktop / 4:3): wide classic counter spread, zero overlap between egg bowl & rice bowl!
      const xScale = aspect < 1.05 ? 0.92 : 1.0;
      this.plateHome.set(-2.14 * xScale, 0.0, 1.02);
      this.lidHome.set(-2.18 * xScale, 0.24, -0.78);
      this.riceBowlHome.set(2.22 * xScale, 0.0, 1.18);
      this.eggBowlHome.set(1.76 * xScale, 0.16, -0.92);
      this.garnishDishHome.set(-1.88 * xScale, 0.0, 1.08);
      this.portraitBowlScale = 1.0;
    }
    if (snap) {
      this.plateGroup.position.copy(this.plateHome);
      this.lidGroup.position.copy(this.lidHome);
      this.riceBowlGroup.position.copy(this.riceBowlHome);
      this.riceBowlGroup.scale.setScalar(this.portraitBowlScale);
      this.eggBowlGroup.position.copy(this.eggBowlHome);
      this.ingredients.forEach((item) => {
        if (!item.inPan && !item.dragging) {
          item.mesh.position.set(
            this.plateGroup.position.x + item.homeLocal.x,
            item.homeLocal.y,
            this.plateGroup.position.z + item.homeLocal.z
          );
        }
      });
    }
  }

  update(dt, t, stage) {
    // 1. Animated Cel Gas Flame (turns off neatly during finished feast!)
    this.flameGroup.visible = stage !== 'feast' && stage !== 'done';
    const flameScales = [0.65, 1.05, 1.52];
    const fScale = flameScales[this.flameLevel];
    this.flamePetals.forEach((p) => {
      const flick = 0.85 + Math.sin(t * 22 + p.userData.phase) * 0.22;
      p.scale.set(fScale * 0.95, fScale * flick, fScale * 0.95);
    });

    // 2. Wiggle animations for touched non-active props
    for (const [obj, w] of this.wiggles.entries()) {
      w.time -= dt;
      if (w.time <= 0) {
        obj.rotation.z = obj.userData.baseRotZ || 0;
        this.wiggles.delete(obj);
      } else {
        const decay = w.time / 0.42;
        obj.rotation.z = (obj.userData.baseRotZ || 0) + Math.sin(w.time * 38) * 0.16 * decay * w.strength;
      }
    }

    // 3. Simmering / Fuwatoro Puffing Vertex Deformation on pan surface!
    const pos = this.panSurfaceGeo.attributes.position;
    const base = this.panSurfaceBasePos;
    const flameMult = 0.65 + this.flameLevel * 0.45;
    this.jiggleEnergy = Math.max(0, this.jiggleEnergy - dt * 1.4);
    const jiggle = Math.sin(t * 24) * 0.06 * this.jiggleEnergy;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const bz = base[i * 3 + 2];
      const r = Math.hypot(bx, bz) / 0.84;
      const dome = Math.max(0, Math.cos(r * Math.PI * 0.5)) * (0.24 * this.eggPuffiness + jiggle);
      const ripple =
        Math.sin(r * 10 - t * 6.5 * flameMult) *
        0.014 *
        (1 - this.eggPuffiness * 0.55) *
        (stage === 'simmer' || stage === 'egg_pour' || stage === 'steaming' ? 1 : 0.2);
      pos.setY(i, dome + ripple);
    }
    pos.needsUpdate = true;
    this.panSurfaceGeo.computeVertexNormals();
    this.panGlints.position.y = 0.2 + this.eggPuffiness * 0.2;
    this.panGlints.visible = stage !== 'steaming' && stage !== 'lid_off';

    // Throttled ~15Hz redraw of bubbling pan canvas (huge mobile iPhone/iPad GPU savings!)
    if (stage === 'simmer' || stage === 'egg_pour' || stage === 'steaming' || stage === 'revealed') {
      this.panRedrawTimer -= dt;
      if (this.panRedrawTimer <= 0) {
        this._redrawPanSurface(t * flameMult);
        this.panRedrawTimer = 0.066;
      }
    }

    // 4. Update Chicken & Onion cooking color + bobbing!
    const rawChicken = new THREE.Color(0xf7b9b0);
    const cookedChicken = new THREE.Color(0xc96e28);
    const rawOnion = new THREE.Color(0xfffdf2);
    const cookedOnion = new THREE.Color(0xf2be5e);

    this.ingredients.forEach((item) => {
      if (item.inPan) {
        if (stage === 'simmer' || stage === 'egg_crack' || stage === 'egg_whisk' || stage === 'egg_pour' || stage === 'steaming') {
          item.cooked = Math.min(1, item.cooked + dt * (0.28 + this.flameLevel * 0.14));
        }
        item.mat.color.lerpColors(
          item.type === 'chicken' ? rawChicken : rawOnion,
          item.type === 'chicken' ? cookedChicken : cookedOnion,
          item.cooked
        );
        const bob =
          Math.sin(t * (5 + this.flameLevel * 2) + item.bobPhase) *
          0.025 *
          (1 - this.eggPuffiness * 0.7);
        const embedY = 0.22 + this.eggPuffiness * 0.16;
        item.mesh.position.set(item.panOffset.x, embedY + bob, item.panOffset.y);
      } else if (!item.dragging) {
        // Gentle inviting breath bounce ONLY during Stage 1!
        const hop = stage === 'simmer' ? Math.abs(Math.sin(t * 3.6 + item.bobPhase)) * 0.055 : 0;
        item.mesh.position.set(
          this.plateGroup.position.x + item.homeLocal.x,
          item.homeLocal.y + hop,
          this.plateGroup.position.z + item.homeLocal.z
        );
      }
    });

    // 5. Eggshell crack pop animation
    if (this.crackAnim > 0) {
      this.crackAnim = Math.max(0, this.crackAnim - dt * 1.9);
      const p = 1 - this.crackAnim;
      this.shellHalves.visible = this.crackAnim > 0.02;
      this.shellLeft.position.set(-0.22 - p * 0.45, p * 0.35, 0);
      this.shellLeft.rotation.z = 0.3 + p * 1.2;
      this.shellRight.position.set(0.22 + p * 0.45, p * 0.35, 0);
      this.shellRight.rotation.z = Math.PI - 0.3 - p * 1.2;
      const s = 1 - p * 0.7;
      this.shellLeft.scale.setScalar(s);
      this.shellRight.scale.setScalar(s);
    }

    // 6. Lid rattle boost decay
    this.lidRattleBoost = Math.max(0, this.lidRattleBoost - dt * 2.2);

    // 7. Anime Reveal Sunburst Rays
    if (this.revealGlow > 0) {
      this.revealGlow = Math.max(0, this.revealGlow - dt * 0.55);
      this.revealRays.visible = this.revealGlow > 0.01;
      this.revealRays.rotation.z += dt * 0.65;
      const s = 0.65 + (1 - this.revealGlow) * 0.55;
      this.revealRays.scale.setScalar(s);
      this.rayMat.opacity = Math.min(0.55, this.revealGlow * 0.85);
    } else {
      this.revealRays.visible = false;
    }

    // 8. Update Steam Puffs
    for (const p of this.steamPuffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      const frac = 1 - p.life / p.maxLife;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.x += Math.sin(t * 4 + frac * 6) * dt * 0.3;
      const sc = p.baseScale * (0.45 + frac * 1.15);
      p.mesh.scale.setScalar(sc);
      p.mat.opacity = frac < 0.25 ? (frac / 0.25) * 0.88 : (1 - frac) * 0.92;
    }

    // 9. Update Splash / Sparkle Particles
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.isStar) {
        const sc = Math.min(0.65, (p.life / p.maxLife) * 0.85);
        p.mesh.scale.set(sc, sc, 1);
      } else {
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.y += p.spin * dt;
        const sc = Math.min(1, (p.life / p.maxLife) * 1.4);
        p.mesh.scale.setScalar(sc);
      }
    }
  }
}
