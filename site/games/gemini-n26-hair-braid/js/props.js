import * as THREE from '../vendor/three.module.js';

/**
 * Factory for the 5 handmade cloth/felt/crochet hair accessories!
 * Used both on the felt pincushion tray AND when attached to the doll's hair.
 */
export function createAccessoryMesh(type, textures) {
  const group = new THREE.Group();
  group.userData.accessoryType = type;

  const feltRed = new THREE.MeshStandardMaterial({
    map: textures.feltRed.map,
    bumpMap: textures.feltRed.bumpMap,
    bumpScale: 0.035,
    roughness: 0.92,
  });
  const feltYellow = new THREE.MeshStandardMaterial({
    map: textures.feltYellow.map,
    bumpMap: textures.feltYellow.bumpMap,
    bumpScale: 0.035,
    roughness: 0.90,
  });
  const feltCream = new THREE.MeshStandardMaterial({
    map: textures.feltCream.map,
    bumpMap: textures.feltCream.bumpMap,
    bumpScale: 0.03,
    roughness: 0.92,
  });
  const feltGreen = new THREE.MeshStandardMaterial({
    map: textures.feltGreen.map,
    bumpMap: textures.feltGreen.bumpMap,
    bumpScale: 0.03,
    roughness: 0.92,
  });
  const feltGold = new THREE.MeshStandardMaterial({
    map: textures.feltGold.map,
    bumpMap: textures.feltGold.bumpMap,
    bumpScale: 0.035,
    roughness: 0.85,
  });
  const feltMint = new THREE.MeshStandardMaterial({
    map: textures.feltMint.map,
    bumpMap: textures.feltMint.bumpMap,
    bumpScale: 0.04,
    roughness: 0.94,
  });
  const feltPink = new THREE.MeshStandardMaterial({
    map: textures.feltPink.map,
    bumpMap: textures.feltPink.bumpMap,
    bumpScale: 0.04,
    roughness: 0.94,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    roughness: 0.62,
  });

  if (type === 'bow') {
    // Plump berry-red stitched wool-felt ribbon bow with dangling tails!
    const loopGeo = new THREE.SphereGeometry(0.19, 14, 12);
    loopGeo.scale(1.25, 0.82, 0.48);

    const leftLoop = new THREE.Mesh(loopGeo, feltRed);
    leftLoop.position.set(-0.20, 0.02, 0.03);
    leftLoop.rotation.z = 0.22;
    leftLoop.castShadow = true;

    const rightLoop = new THREE.Mesh(loopGeo, feltRed);
    rightLoop.position.set(0.20, 0.02, 0.03);
    rightLoop.rotation.z = -0.22;
    rightLoop.castShadow = true;

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), feltRed);
    knot.scale.set(0.9, 1.08, 0.78);
    knot.position.set(0, 0.01, 0.07);
    knot.castShadow = true;

    // Cream center button stitch
    const stitch = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), feltCream);
    stitch.position.set(0, 0.01, 0.14);

    // Two dangling felt ribbon tails
    const tailGeo = new THREE.BoxGeometry(0.11, 0.32, 0.035);
    const tailL = new THREE.Mesh(tailGeo, feltRed);
    tailL.position.set(-0.11, -0.20, 0.01);
    tailL.rotation.z = -0.28;
    const tailR = new THREE.Mesh(tailGeo, feltRed);
    tailR.position.set(0.11, -0.20, 0.01);
    tailR.rotation.z = 0.28;

    group.add(leftLoop, rightLoop, knot, stitch, tailL, tailR);
  } else if (type === 'flower') {
    // Sunny crocheted daisy flower clip with wooden button center!
    const petalGeo = new THREE.SphereGeometry(0.115, 12, 10);
    petalGeo.scale(0.85, 1.25, 0.42);
    const petalCount = 6;
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? feltCream : feltYellow);
      petal.position.set(Math.cos(a) * 0.175, Math.sin(a) * 0.175, 0.03);
      petal.rotation.z = a - Math.PI / 2;
      petal.castShadow = true;
      group.add(petal);
    }
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 16), feltYellow);
    center.rotation.x = Math.PI / 2;
    center.position.set(0, 0, 0.065);
    const woodDot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), woodMat);
    woodDot.rotation.x = Math.PI / 2;
    woodDot.position.set(0, 0, 0.07);
    group.add(center, woodDot);
  } else if (type === 'strawberry') {
    // Plump stitched felt strawberry clip with green leafy crown & cream seed stitches!
    const berryGeo = new THREE.SphereGeometry(0.20, 16, 14);
    const pos = berryGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const taper = y < 0 ? 1 + y * 1.45 : 1 - y * 0.35;
      pos.setX(i, pos.getX(i) * Math.max(0.22, taper));
      pos.setZ(i, pos.getZ(i) * Math.max(0.22, taper) * 0.72);
    }
    berryGeo.computeVertexNormals();
    const berry = new THREE.Mesh(berryGeo, feltRed);
    berry.position.set(0, -0.02, 0.05);
    berry.castShadow = true;
    group.add(berry);

    // 5 felt leaves on top
    const leafGeo = new THREE.ConeGeometry(0.068, 0.16, 6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, feltGreen);
      leaf.position.set(Math.cos(a) * 0.08, 0.17, 0.05 + Math.sin(a) * 0.05);
      leaf.rotation.z = -Math.cos(a) * 1.15;
      leaf.rotation.x = Math.sin(a) * 0.85;
      group.add(leaf);
    }

    // Cream embroidered seeds
    const seedGeo = new THREE.SphereGeometry(0.022, 6, 6);
    const seedCoords = [
      [-0.08, 0.03, 0.17], [0.08, 0.03, 0.17], [0, -0.03, 0.185],
      [-0.06, -0.10, 0.145], [0.06, -0.10, 0.145], [0, 0.09, 0.165],
    ];
    for (const sc of seedCoords) {
      const seed = new THREE.Mesh(seedGeo, feltCream);
      seed.position.set(...sc);
      group.add(seed);
    }
  } else if (type === 'star') {
    // Embroidered plump golden felt star with dangling cream pearl bead!
    const shape = new THREE.Shape();
    const spikes = 5;
    const outerR = 0.25;
    const innerR = 0.115;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 3,
    });
    starGeo.center();
    const star = new THREE.Mesh(starGeo, feltGold);
    star.position.set(0, 0.02, 0.04);
    star.castShadow = true;
    group.add(star);

    // Dangling pearl bead
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6), feltCream);
    cord.position.set(0, -0.22, 0.04);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), feltCream);
    bead.position.set(0, -0.32, 0.04);
    group.add(cord, bead);
  } else {
    // Fluffy twin wool pom-pom clip (mint & pink!)
    const p1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.145, 2), feltMint);
    p1.position.set(-0.10, 0.03, 0.06);
    p1.castShadow = true;
    const p2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.135, 2), feltPink);
    p2.position.set(0.11, -0.02, 0.07);
    p2.castShadow = true;
    const p3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 1), feltCream);
    p3.position.set(0.0, 0.12, 0.05);
    group.add(p1, p2, p3);
  }

  return group;
}

/**
 * Builds the entire cozy handmade craft dressing table, backdrop,
 * hairbrush, hairstyle choice formers, accessory pincushion,
 * yarn color ball, real reflective vanity mirror, and idle knitted demo hand!
 */
export class CraftProps {
  constructor(textures, mirrorRenderTarget) {
    this.textures = textures;
    this.mirrorRenderTarget = mirrorRenderTarget;
    this.root = new THREE.Group();

    this.nudgeTimers = new Map();
    this.mirrorReady = false;
    this.mirrorShowMode = false;

    this._buildTableAndRoom();
    this._buildBrush();
    this._buildYarnBall();
    this._buildStyleTray();
    this._buildAccessoryTray();
    this._buildMirror();
    this._buildDemoHand();

    // Set initial layout (default landscape, dynamically updated on resize)
    this.applyLayout(1.33);
  }

  _buildTableAndRoom() {
    // Cozy quilted craft room wall behind the dressing table
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.textures.backdrop,
      roughness: 0.96,
      metalness: 0.0,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), wallMat);
    wall.position.set(0, 5.2, -3.8);
    wall.receiveShadow = true;
    this.root.add(wall);

    // Subtle fabric bunting garland high in the background (warm craft atmosphere!)
    const buntingGroup = new THREE.Group();
    buntingGroup.position.set(0, 5.25, -3.55);
    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.8, 0.55, 0),
      new THREE.Vector3(-2.5, -0.18, 0),
      new THREE.Vector3(0, -0.35, 0),
      new THREE.Vector3(2.5, -0.18, 0),
      new THREE.Vector3(5.8, 0.55, 0),
    ]);
    const cord = new THREE.Mesh(
      new THREE.TubeGeometry(cordCurve, 24, 0.022, 6, false),
      new THREE.MeshStandardMaterial({ color: '#b58d6d', roughness: 0.9 })
    );
    buntingGroup.add(cord);

    const pennantTextures = ['feltPink', 'feltYellow', 'feltMint', 'feltCream', 'feltSky'];
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.24, 0);
    triShape.lineTo(0.24, 0);
    triShape.lineTo(0, -0.46);
    triShape.closePath();
    const triGeo = new THREE.ShapeGeometry(triShape);

    for (let i = 0; i < 11; i++) {
      const t = 0.08 + (i / 10) * 0.84;
      const pt = cordCurve.getPoint(t);
      const pMat = new THREE.MeshStandardMaterial({
        map: this.textures[pennantTextures[i % pennantTextures.length]].map,
        roughness: 0.95,
        side: THREE.DoubleSide,
      });
      const flag = new THREE.Mesh(triGeo, pMat);
      flag.position.copy(pt);
      flag.rotation.z = (t - 0.5) * 0.25;
      buntingGroup.add(flag);
    }
    this.root.add(buntingGroup);

    // Wooden craft table top
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood.map,
      bumpMap: this.textures.wood.bumpMap,
      bumpScale: 0.02,
      roughness: 0.72,
    });
    const table = new THREE.Mesh(new THREE.BoxGeometry(16, 0.42, 8.5), woodMat);
    table.position.set(0, -0.21, 0.4);
    table.receiveShadow = true;
    this.root.add(table);

    // Quilted patchwork dressing mat on top of table
    const matMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.quiltMat.map,
      bumpMap: this.textures.quiltMat.bumpMap,
      bumpScale: 0.03,
      roughness: 0.94,
    });
    const quiltMat = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.06, 5.4), matMaterial);
    quiltMat.position.set(0, 0.015, 0.55);
    quiltMat.receiveShadow = true;
    this.root.add(quiltMat);

    // Stitched felt lace border around mat edge
    const borderMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltCream.map,
      roughness: 0.95,
    });
    const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(9.75, 0.045, 0.14), borderMat);
    frontTrim.position.set(0, 0.02, 3.25);
    this.root.add(frontTrim);
  }

  _buildBrush() {
    this.brushGroup = new THREE.Group();
    this.brushHomePos = new THREE.Vector3(-2.35, 0.22, 1.35);
    this.brushHomeRot = new THREE.Euler(-0.35, 0.45, -0.28);
    this.brushGroup.position.copy(this.brushHomePos);
    this.brushGroup.rotation.copy(this.brushHomeRot);
    this.root.add(this.brushGroup);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood.map,
      bumpMap: this.textures.wood.bumpMap,
      bumpScale: 0.022,
      roughness: 0.62,
    });
    const padMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltMint.map,
      bumpMap: this.textures.feltMint.bumpMap,
      bumpScale: 0.035,
      roughness: 0.92,
    });
    const ribbonMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltRed.map,
      roughness: 0.9,
    });

    // Oval wooden paddle head (chunky & unmistakable for a 5-year-old!)
    const paddleGeo = new THREE.SphereGeometry(0.42, 20, 14);
    paddleGeo.scale(0.82, 1.18, 0.34);
    const paddle = new THREE.Mesh(paddleGeo, woodMat);
    paddle.position.set(0, 0.34, 0);
    paddle.castShadow = true;
    this.brushGroup.add(paddle);

    // Mint felt cushion pad
    const padGeo = new THREE.SphereGeometry(0.36, 18, 12);
    padGeo.scale(0.76, 1.10, 0.22);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 0.34, 0.10);
    this.brushGroup.add(pad);

    // Chunky rounded wooden bristles
    const bristleGeo = new THREE.CapsuleGeometry(0.026, 0.13, 5, 8);
    for (let r = -2; r <= 2; r++) {
      const cols = Math.abs(r) === 2 ? 2 : 3;
      for (let c = 0; c < cols; c++) {
        const bx = (c - (cols - 1) / 2) * 0.15;
        const by = 0.34 + r * 0.145;
        const br = new THREE.Mesh(bristleGeo, woodMat);
        br.rotation.x = Math.PI / 2;
        br.position.set(bx, by, 0.20);
        br.castShadow = true;
        this.brushGroup.add(br);
      }
    }

    // Thick comfortable wooden handle
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.62, 8, 12), woodMat);
    handle.position.set(0, -0.44, 0);
    handle.castShadow = true;
    this.brushGroup.add(handle);

    // Felt grip wrap on handle
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.26, 14), ribbonMat);
    grip.position.set(0, -0.46, 0);
    this.brushGroup.add(grip);

    // Generous touch hitbox (sized cleanly to the brush without overlapping neighboring bow!)
    const hitbox = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(0, 0.08, 0.05);
    this.brushGroup.add(hitbox);

    this.brushGroup.traverse((c) => {
      if (c.isMesh) c.userData = { hitKind: 'prop_brush' };
    });
  }

  _buildYarnBall() {
    // Cozy chunky wool yarn ball on left side of table — tap/drag to change hair color!
    this.yarnBallGroup = new THREE.Group();
    this.yarnBallHomePos = new THREE.Vector3(-2.65, 0.38, -0.15);
    this.yarnBallGroup.position.copy(this.yarnBallHomePos);
    this.root.add(this.yarnBallGroup);

    // Small cream knitted coaster under the yarn ball
    const coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.48, 0.04, 20),
      new THREE.MeshStandardMaterial({
        map: this.textures.knitCream.map,
        bumpMap: this.textures.knitCream.bumpMap,
        bumpScale: 0.03,
        roughness: 0.94,
      })
    );
    coaster.position.set(0, -0.33, 0);
    coaster.receiveShadow = true;
    this.yarnBallGroup.add(coaster);

    // Multi-ply wound yarn sphere (updates color to preview the NEXT hair color!)
    this.yarnBallVisual = new THREE.Group();
    this.yarnBallGroup.add(this.yarnBallVisual);

    const p = this.textures.hairPalettes[1]; // shows NEXT color (chestnut -> berry -> lavender -> honey)!
    this.yarnBallMat = new THREE.MeshStandardMaterial({
      map: p.texMain.map,
      bumpMap: p.texMain.bumpMap,
      bumpScale: 0.06,
      roughness: 0.92,
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 14), this.yarnBallMat);
    ball.castShadow = true;
    this.yarnBallVisual.add(ball);

    // Overlapping thick yarn bands wrapped around the ball
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.065, 8, 20), this.yarnBallMat);
      band.rotation.set(i * 0.72, i * 1.1, i * 0.4);
      this.yarnBallVisual.add(band);
    }

    // Tiny wooden knitting needle sticking out playfully
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood.map, roughness: 0.58 });
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.95, 8), woodMat);
    needle.position.set(0.16, 0.22, 0.05);
    needle.rotation.z = -0.58;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), new THREE.MeshStandardMaterial({ map: this.textures.feltRed.map, roughness: 0.9 }));
    knob.position.set(0.42, 0.62, 0.05);
    this.yarnBallVisual.add(needle, knob);

    // Generous hitbox
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.yarnBallGroup.add(hit);

    this.yarnBallGroup.traverse((c) => {
      if (c.isMesh) c.userData = { hitKind: 'prop_yarnball' };
    });
  }

  updateYarnBallPreview(nextPaletteIndex) {
    const p = this.textures.hairPalettes[nextPaletteIndex];
    this.yarnBallMat.map = p.texMain.map;
    this.yarnBallMat.bumpMap = p.texMain.bumpMap;
    this.yarnBallMat.needsUpdate = true;
  }

  _buildStyleTray() {
    // 3 unmistakable tactile yarn hairstyle formers sitting on a stitched felt cushion tray!
    this.styleTrayGroup = new THREE.Group();
    this.styleTrayHomePos = new THREE.Vector3(2.25, 0.06, 0.72);
    this.styleTrayFocusPos = new THREE.Vector3(2.05, 0.08, 1.48);
    this.styleTrayGroup.position.copy(this.styleTrayHomePos);
    this.root.add(this.styleTrayGroup);

    // Stitched cream felt oval tray base
    const baseGeo = new THREE.CylinderGeometry(1.04, 1.10, 0.09, 26);
    baseGeo.scale(1.02, 1, 0.62);
    const trayBase = new THREE.Mesh(
      baseGeo,
      new THREE.MeshStandardMaterial({
        map: this.textures.feltCream.map,
        bumpMap: this.textures.feltCream.bumpMap,
        bumpScale: 0.03,
        roughness: 0.94,
      })
    );
    trayBase.receiveShadow = true;
    trayBase.castShadow = true;
    this.styleTrayGroup.add(trayBase);

    const yarnMain = new THREE.MeshStandardMaterial({
      map: this.textures.hairPalettes[0].texMain.map,
      bumpMap: this.textures.hairPalettes[0].texMain.bumpMap,
      bumpScale: 0.055,
      roughness: 0.92,
    });
    const yarnLight = new THREE.MeshStandardMaterial({
      map: this.textures.hairPalettes[0].texLight.map,
      bumpMap: this.textures.hairPalettes[0].texLight.bumpMap,
      bumpScale: 0.05,
      roughness: 0.92,
    });
    const feltRed = new THREE.MeshStandardMaterial({ map: this.textures.feltRed.map, roughness: 0.9 });
    const knitMint = new THREE.MeshStandardMaterial({ map: this.textures.knitMint.map, roughness: 0.9 });
    const knitLav = new THREE.MeshStandardMaterial({ map: this.textures.knitLavender.map, roughness: 0.9 });

    this.styleItems = [];

    // 1. BRAIDS former (chunky twin-braid plait charm with red tie!)
    const braidFormer = new THREE.Group();
    braidFormer.position.set(-0.58, 0.34, 0.06);
    for (let s = 0; s < 4; s++) {
      const pL = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.10, 6, 8), s % 2 === 0 ? yarnMain : yarnLight);
      pL.position.set(-0.05, 0.22 - s * 0.14, 0);
      pL.rotation.z = -0.55;
      pL.castShadow = true;
      const pR = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.10, 6, 8), s % 2 === 0 ? yarnLight : yarnMain);
      pR.position.set(0.05, 0.18 - s * 0.14, 0.01);
      pR.rotation.z = 0.55;
      pR.castShadow = true;
      braidFormer.add(pL, pR);
    }
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.032, 8, 14), feltRed);
    tie.rotation.x = Math.PI / 2;
    tie.position.set(0, -0.32, 0);
    braidFormer.add(tie);
    const hitB = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    braidFormer.add(hitB);
    braidFormer.traverse((c) => {
      if (c.isMesh) c.userData = { hitKind: 'prop_style', style: 'braids' };
    });
    this.styleTrayGroup.add(braidFormer);
    this.styleItems.push({ style: 'braids', group: braidFormer, homePos: braidFormer.position.clone() });

    // 2. TWIN BUNS former (two plump knitted yarn bun rings side by side!)
    const twinFormer = new THREE.Group();
    twinFormer.position.set(0.02, 0.28, 0.12);
    for (const s of [-1, 1]) {
      const miniBun = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 12), yarnMain);
      miniBun.position.set(s * 0.18, 0.04, 0);
      miniBun.castShadow = true;
      const miniRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), knitMint);
      miniRing.rotation.x = Math.PI / 2;
      miniRing.position.set(s * 0.18, -0.06, 0);
      twinFormer.add(miniBun, miniRing);
    }
    const hitT = new THREE.Mesh(new THREE.SphereGeometry(0.33, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    twinFormer.add(hitT);
    twinFormer.traverse((c) => {
      if (c.isMesh) c.userData = { hitKind: 'prop_style', style: 'twin_buns' };
    });
    this.styleTrayGroup.add(twinFormer);
    this.styleItems.push({ style: 'twin_buns', group: twinFormer, homePos: twinFormer.position.clone() });

    // 3. CROWN TOP BUN former (one BIG plush spiral bun doughnut!)
    const topFormer = new THREE.Group();
    topFormer.position.set(0.64, 0.30, 0.04);
    const bigBun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), yarnLight);
    bigBun.scale.set(1.05, 0.85, 1.05);
    bigBun.position.set(0, 0.08, 0);
    bigBun.castShadow = true;
    const bigScrunch = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 18), knitLav);
    bigScrunch.rotation.x = Math.PI / 2;
    bigScrunch.position.set(0, -0.06, 0);
    topFormer.add(bigBun, bigScrunch);
    const hitTop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    topFormer.add(hitTop);
    topFormer.traverse((c) => {
      if (c.isMesh) c.userData = { hitKind: 'prop_style', style: 'top_bun' };
    });
    this.styleTrayGroup.add(topFormer);
    this.styleItems.push({ style: 'top_bun', group: topFormer, homePos: topFormer.position.clone() });
  }

  _buildAccessoryTray() {
    // Stitched felt pincushion / organizer presenting the 5 handmade ribbons & hairpins!
    this.accTrayGroup = new THREE.Group();
    this.accTrayHomePos = new THREE.Vector3(0.0, 0.05, 2.25);
    this.accTrayFocusPos = new THREE.Vector3(0.0, 0.08, 2.02);
    this.accTrayGroup.position.copy(this.accTrayHomePos);
    this.root.add(this.accTrayGroup);

    // Wide plush stitched felt cushion bar in foreground
    const cushionGeo = new THREE.CapsuleGeometry(0.35, 3.25, 10, 18);
    cushionGeo.rotateZ(Math.PI / 2);
    cushionGeo.scale(1, 0.32, 0.88);
    const cushion = new THREE.Mesh(
      cushionGeo,
      new THREE.MeshStandardMaterial({
        map: this.textures.feltCream.map,
        bumpMap: this.textures.feltCream.bumpMap,
        bumpScale: 0.03,
        roughness: 0.95,
      })
    );
    cushion.receiveShadow = true;
    cushion.castShadow = true;
    this.accTrayGroup.add(cushion);

    const types = ['bow', 'flower', 'strawberry', 'star', 'pompom'];
    this.trayAccessories = [];

    types.forEach((type, i) => {
      const slot = new THREE.Group();
      const x = (i - 2) * 0.78;
      slot.position.set(x, 0.28, 0.02);

      const mesh = createAccessoryMesh(type, this.textures);
      mesh.rotation.x = -0.35;
      mesh.scale.setScalar(1.12);
      slot.add(mesh);

      // Generous invisible touch sphere (cleanly separated from adjacent items)
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      slot.add(hit);

      slot.traverse((c) => {
        if (c.isMesh) c.userData = { hitKind: 'prop_accessory', accessoryType: type, slotIndex: i };
      });

      this.accTrayGroup.add(slot);
      this.trayAccessories.push({ type, group: slot, homePos: slot.position.clone() });
    });
  }

  _buildMirror() {
    // Handmade scalloped beechwood & stitched-felt tabletop Vanity Mirror with REAL live reflection!
    this.mirrorGroup = new THREE.Group();
    this.mirrorSidePos = new THREE.Vector3(2.45, 0.05, -0.45);
    this.mirrorSideRotY = -0.62;
    this.mirrorShowPos = new THREE.Vector3(1.12, 0.14, 1.38);
    this.mirrorShowRotY = -2.42; // faces doll + angled slightly toward viewer so BOTH doll and live reflection shine!

    this.mirrorGroup.position.copy(this.mirrorSidePos);
    this.mirrorGroup.rotation.y = this.mirrorSideRotY;
    this.root.add(this.mirrorGroup);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood.map,
      bumpMap: this.textures.wood.bumpMap,
      bumpScale: 0.025,
      roughness: 0.65,
    });
    const feltFrameMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltPink.map,
      bumpMap: this.textures.feltPink.bumpMap,
      bumpScale: 0.035,
      roughness: 0.92,
    });
    const feltCreamMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltCream.map,
      roughness: 0.92,
    });

    // Sturdy wooden tabletop base + upright posts
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.14, 22), woodMat);
    base.scale.set(1.3, 1, 0.72);
    base.position.set(0, 0.07, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    this.mirrorGroup.add(base);

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 1.38, 10), woodMat);
      post.position.set(side * 0.78, 0.74, 0);
      post.castShadow = true;
      this.mirrorGroup.add(post);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), feltCreamMat);
      knob.position.set(side * 0.84, 1.38, 0);
      this.mirrorGroup.add(knob);
    }

    // Pivoting mirror head frame
    this.mirrorHead = new THREE.Group();
    this.mirrorHead.position.set(0, 1.48, 0);
    this.mirrorGroup.add(this.mirrorHead);

    // Oval wooden back plate
    const backPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.11, 28), woodMat);
    backPlate.rotation.x = Math.PI / 2;
    backPlate.scale.set(0.88, 1, 1.15);
    backPlate.position.set(0, 0, -0.04);
    backPlate.castShadow = true;
    this.mirrorHead.add(backPlate);

    // Plush stitched felt frame ring
    const frameRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.11, 12, 32), feltFrameMat);
    frameRing.scale.set(0.88, 1.15, 0.75);
    frameRing.position.set(0, 0, 0.03);
    frameRing.castShadow = true;
    this.mirrorHead.add(frameRing);

    // Scalloped cream felt dots around the mirror frame + cute felt bow at crown!
    const dotGeo = new THREE.SphereGeometry(0.065, 10, 8);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dot = new THREE.Mesh(dotGeo, feltCreamMat);
      dot.position.set(Math.cos(a) * 0.75 * 0.88, Math.sin(a) * 0.75 * 1.15, 0.09);
      this.mirrorHead.add(dot);
    }
    const crownBow = createAccessoryMesh('bow', this.textures);
    crownBow.position.set(0, 0.96, 0.10);
    crownBow.scale.setScalar(0.82);
    this.mirrorHead.add(crownBow);

    // REAL LIVE REFLECTIVE MIRROR GLASS (horizontally flipped UV for true mirror image!)
    const glassGeo = new THREE.CircleGeometry(0.73, 32);
    glassGeo.scale(0.86, 1.13, 1);
    const uvAttr = glassGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;

    this.mirrorGlassMat = new THREE.MeshBasicMaterial({
      map: this.mirrorRenderTarget.texture,
      color: new THREE.Color('#fffdf8'),
    });
    this.mirrorGlass = new THREE.Mesh(glassGeo, this.mirrorGlassMat);
    this.mirrorGlass.position.set(0, 0, 0.045);
    this.mirrorHead.add(this.mirrorGlass);

    // Subtle soft sparkle gleam ring (illuminates softly when mirror is ready to show!)
    this.mirrorGleamMat = new THREE.MeshBasicMaterial({
      color: '#fff4c2',
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const gleamRing = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.76, 32), this.mirrorGleamMat);
    gleamRing.scale.set(0.86, 1.13, 1);
    gleamRing.position.set(0, 0, 0.055);
    this.mirrorHead.add(gleamRing);

    // Generous hitbox for tapping/dragging the mirror (sized cleanly to frame)
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.86, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.mirrorHead.add(hit);

    this.mirrorGroup.traverse((c) => {
      if (c.isMesh) c.userData = { hitKind: 'prop_mirror' };
    });
  }

  _buildDemoHand() {
    // Cozy knitted cream mitten hand — ONLY appears once after 10+ seconds idle!
    this.demoHand = new THREE.Group();
    this.demoHand.visible = false;
    this.root.add(this.demoHand);

    const mittenMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitCream.map,
      bumpMap: this.textures.knitCream.bumpMap,
      bumpScale: 0.04,
      roughness: 0.9,
      transparent: true,
      opacity: 0.92,
    });
    const cuffMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltPink.map,
      roughness: 0.9,
      transparent: true,
      opacity: 0.92,
    });

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), mittenMat);
    palm.scale.set(0.92, 1.25, 0.55);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mittenMat);
    thumb.position.set(-0.22, -0.02, 0.04);
    thumb.rotation.z = 0.5;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 14), cuffMat);
    cuff.position.set(0, -0.32, 0);

    this.demoHand.add(palm, thumb, cuff);
    this.demoHand.rotation.x = -0.35;
  }

  /**
   * Adjust prop positions smoothly for both Portrait (iPhone) and Landscape (iPad/Desktop)!
   */
  applyLayout(aspect) {
    const isPortrait = aspect < 0.95;
    if (isPortrait) {
      const narrow = aspect < 0.72;
      this.brushHomePos.set(narrow ? -1.16 : -1.38, 0.36, 1.25);
      this.brushHomeRot.set(-0.55, 0.42, -0.22);
      this.yarnBallHomePos.set(narrow ? -1.24 : -1.46, 0.38, -0.35);
      this.styleTrayHomePos.set(narrow ? 0.94 : 1.06, 0.06, 1.15);
      this.styleTrayFocusPos.set(narrow ? 0.80 : 0.90, 0.08, 1.32);
      this.accTrayHomePos.set(0.0, 0.06, 2.24);
      this.accTrayFocusPos.set(0.0, 0.09, 2.08);
      this.mirrorSidePos.set(narrow ? 1.16 : 1.36, 0.05, -0.45);
      this.mirrorSideRotY = -0.42;
      this.mirrorShowPos.set(0.88, 0.14, 1.08);
      this.mirrorShowRotY = -0.68;
      this.styleTrayGroup.scale.setScalar(narrow ? 0.56 : 0.64);
      this.accTrayGroup.scale.setScalar(narrow ? 0.58 : 0.65);
      this.mirrorGroup.scale.setScalar(narrow ? 0.68 : 0.76);
      this.brushGroup.scale.setScalar(narrow ? 0.76 : 0.84);
      this.yarnBallGroup.scale.setScalar(narrow ? 0.76 : 0.84);
    } else {
      this.brushHomePos.set(-2.14, 0.38, 0.88);
      this.brushHomeRot.set(-0.55, 0.45, -0.24);
      this.yarnBallHomePos.set(-2.74, 0.38, -0.68);
      this.styleTrayHomePos.set(1.98, 0.06, 0.72);
      this.styleTrayFocusPos.set(1.78, 0.08, 1.05);
      this.accTrayHomePos.set(0.0, 0.06, 1.66);
      this.accTrayFocusPos.set(0.0, 0.09, 1.54);
      this.mirrorSidePos.set(2.38, 0.05, -0.78);
      this.mirrorSideRotY = -0.56;
      this.mirrorShowPos.set(1.48, 0.14, 0.98);
      this.mirrorShowRotY = -0.72;
      this.styleTrayGroup.scale.setScalar(0.92);
      this.accTrayGroup.scale.setScalar(0.92);
      this.mirrorGroup.scale.setScalar(1.02);
      this.brushGroup.scale.setScalar(0.95);
      this.yarnBallGroup.scale.setScalar(0.95);
    }
  }

  triggerNudge(key) {
    this.nudgeTimers.set(key, 0.42);
  }

  _getNudgeOffset(key, time) {
    const t = this.nudgeTimers.get(key) || 0;
    if (t <= 0) return 0;
    return Math.sin(time * 36) * 0.16 * (t / 0.42);
  }

  update(dt, time, stage, isHoldingBrush, activeStyleDragged) {
    // Decay nudge timers
    for (const [k, v] of this.nudgeTimers.entries()) {
      const nv = Math.max(0, v - dt);
      if (nv <= 0) this.nudgeTimers.delete(k);
      else this.nudgeTimers.set(k, nv);
    }

    // 1. Brush resting invitation (subtle rock during Stage 1 'brush')
    if (!isHoldingBrush) {
      const brushNudge = this._getNudgeOffset('brush', time);
      const inviteBob = stage === 'brush' ? Math.sin(time * 3.0) * 0.07 : 0;
      const targetPos = this.brushHomePos.clone();
      targetPos.y += inviteBob;
      this.brushGroup.position.lerp(targetPos, Math.min(1, dt * 8));

      const targetRotZ = this.brushHomeRot.z + (stage === 'brush' ? Math.sin(time * 3.0) * 0.14 : 0) + brushNudge;
      this.brushGroup.rotation.x = THREE.MathUtils.lerp(this.brushGroup.rotation.x, this.brushHomeRot.x, dt * 8);
      this.brushGroup.rotation.y = THREE.MathUtils.lerp(this.brushGroup.rotation.y, this.brushHomeRot.y, dt * 8);
      this.brushGroup.rotation.z = THREE.MathUtils.lerp(this.brushGroup.rotation.z, targetRotZ, dt * 8);
    }

    // 2. Yarn ball gentle spin/wobble when poked
    const yarnNudge = this._getNudgeOffset('yarn', time);
    this.yarnBallVisual.rotation.y += dt * 0.35 + Math.abs(yarnNudge) * 0.25;
    this.yarnBallVisual.position.y = Math.abs(yarnNudge) * 0.4;

    // 3. Style tray slides forward during 'choose_style', tucks slightly otherwise
    const styleTargetPos = stage === 'choose_style' ? this.styleTrayFocusPos : this.styleTrayHomePos;
    this.styleTrayGroup.position.lerp(styleTargetPos, Math.min(1, dt * 6));
    this.styleItems.forEach((item, idx) => {
      if (activeStyleDragged === item.style) return;
      const invite = stage === 'choose_style' ? Math.sin(time * 3.6 + idx * 1.1) * 0.08 : 0;
      const nudge = this._getNudgeOffset(`style_${item.style}`, time);
      item.group.position.x = THREE.MathUtils.lerp(item.group.position.x, item.homePos.x, dt * 10);
      item.group.position.y = THREE.MathUtils.lerp(item.group.position.y, item.homePos.y + invite + Math.abs(nudge) * 0.35, dt * 10);
      item.group.position.z = THREE.MathUtils.lerp(item.group.position.z, item.homePos.z, dt * 10);
      item.group.rotation.z = nudge * 1.4;
      const s = stage === 'choose_style' ? 1.14 : 0.96;
      item.group.scale.lerp(new THREE.Vector3(s, s, s), dt * 6);
    });

    // 4. Accessory tray slides forward during 'decorate'
    const accTargetPos = stage === 'decorate' ? this.accTrayFocusPos : this.accTrayHomePos;
    this.accTrayGroup.position.lerp(accTargetPos, Math.min(1, dt * 6));
    this.trayAccessories.forEach((item, idx) => {
      const invite = stage === 'decorate' ? Math.sin(time * 3.4 + idx * 0.85) * 0.055 : 0;
      const nudge = this._getNudgeOffset(`acc_${item.type}`, time);
      item.group.position.y = item.homePos.y + invite + Math.abs(nudge) * 0.3;
      item.group.rotation.z = nudge * 1.2;
      const s = stage === 'decorate' ? 1.12 : 0.92;
      item.group.scale.lerp(new THREE.Vector3(s, s, s), dt * 6);
    });

    // 5. Mirror position & gleaming invitation
    const mirrorTargetPos = this.mirrorShowMode ? this.mirrorShowPos : this.mirrorSidePos;
    const mirrorTargetRotY = this.mirrorShowMode ? this.mirrorShowRotY : this.mirrorSideRotY;
    this.mirrorGroup.position.lerp(mirrorTargetPos, Math.min(1, dt * 5.2));
    this.mirrorGroup.rotation.y = THREE.MathUtils.lerp(this.mirrorGroup.rotation.y, mirrorTargetRotY, Math.min(1, dt * 5.2));

    const mirrorNudge = this._getNudgeOffset('mirror', time);
    if (!this.mirrorShowMode && this.mirrorReady && stage === 'decorate') {
      // Gentle inviting gleam & subtle bob when ready to show in mirror!
      this.mirrorHead.position.y = 1.48 + Math.sin(time * 3.0) * 0.05;
      this.mirrorHead.rotation.z = Math.sin(time * 2.4) * 0.045 + mirrorNudge;
      this.mirrorGleamMat.opacity = 0.25 + (Math.sin(time * 3.8) * 0.5 + 0.5) * 0.38;
    } else {
      this.mirrorHead.position.y = THREE.MathUtils.lerp(this.mirrorHead.position.y, 1.48, dt * 6);
      this.mirrorHead.rotation.z = THREE.MathUtils.lerp(this.mirrorHead.rotation.z, mirrorNudge, dt * 8);
      this.mirrorGleamMat.opacity = THREE.MathUtils.lerp(
        this.mirrorGleamMat.opacity,
        this.mirrorShowMode ? 0.22 : 0.0,
        dt * 5
      );
    }
  }
}
