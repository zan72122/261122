import * as THREE from '../vendor/three.module.js';

/**
 * Handmade Cloth & Yarn Doll with expressive embroidered face,
 * movable cloth arms, dynamic brushable yarn hair, interactive braiding
 * & bun coiling, color-changing yarn wave, and magnetic accessory anchors.
 */
export class YarnDoll {
  constructor(textures) {
    this.textures = textures;
    this.root = new THREE.Group();
    this.root.position.set(0, 0.03, -0.35);

    this.paletteIndex = 0;
    this.hairMaterials = this._createHairMaterials(0);

    // Interactive states
    this.style = 'loose'; // 'loose' | 'braids' | 'twin_buns' | 'top_bun'
    this.weaveSteps = 0; // 0..5
    this.maxWeaveSteps = 5;
    this.weaveAnimTimer = 0;
    this.weaveSideDir = 1;

    this.coilProgress = 0; // 0..1
    this.coilSpinAngle = 0;

    // Expression & animation states
    this.expression = 'messy'; // 'messy' | 'content' | 'happy' | 'sparkle' | 'wink'
    this.giggleTimer = 0;
    this.blushBoost = 0;
    this.headTiltTarget = new THREE.Vector3(0, 0, 0); // x=pitch, y=yaw, z=roll
    this.headTiltCurrent = new THREE.Vector3(0, 0, 0);
    this.bodyBounceVel = 0;
    this.bodyBounceY = 0;
    this.mirrorPoseIndex = 0;
    this.mirrorMode = false;
    this.colorWaveTimer = 0;

    // Hair locks & fuzzballs
    this.looseLocks = [];
    this.fuzzballs = [];
    this.placedAccessories = []; // { id, type, mesh, anchorId, sideGroup, pokeTimer }

    // Braid pendulum spring states
    this.braidSwing = { left: 0, leftVel: 0, right: 0, rightVel: 0 };
    this.bunSquish = { left: 0, right: 0, top: 0 };

    // Build all anatomy & hair groups
    this._buildBody();
    this._buildArms();
    this._buildHead();
    this._buildBaseHair();
    this._buildLooseHair();
    this._buildFuzzballs();
    this._buildBraids();
    this._buildTwinBuns();
    this._buildTopBun();

    this.setStyle('loose');
    this.setExpression('messy');
  }

  _createHairMaterials(paletteIdx) {
    const p = this.textures.hairPalettes[paletteIdx];
    return {
      main: new THREE.MeshStandardMaterial({
        map: p.texMain.map,
        bumpMap: p.texMain.bumpMap,
        bumpScale: 0.055,
        roughness: 0.92,
        metalness: 0.0,
      }),
      light: new THREE.MeshStandardMaterial({
        map: p.texLight.map,
        bumpMap: p.texLight.bumpMap,
        bumpScale: 0.05,
        roughness: 0.90,
        metalness: 0.0,
      }),
      dark: new THREE.MeshStandardMaterial({
        map: p.texDark.map,
        bumpMap: p.texDark.bumpMap,
        bumpScale: 0.055,
        roughness: 0.94,
        metalness: 0.0,
      }),
    };
  }

  cycleHairColor() {
    this.paletteIndex = (this.paletteIndex + 1) % this.textures.hairPalettes.length;
    const p = this.textures.hairPalettes[this.paletteIndex];
    this.hairMaterials.main.map = p.texMain.map;
    this.hairMaterials.main.bumpMap = p.texMain.bumpMap;
    this.hairMaterials.main.needsUpdate = true;

    this.hairMaterials.light.map = p.texLight.map;
    this.hairMaterials.light.bumpMap = p.texLight.bumpMap;
    this.hairMaterials.light.needsUpdate = true;

    this.hairMaterials.dark.map = p.texDark.map;
    this.hairMaterials.dark.bumpMap = p.texDark.bumpMap;
    this.hairMaterials.dark.needsUpdate = true;

    this.colorWaveTimer = 0.85;
    this.triggerBounce(0.14);
    this.triggerGiggle(1.0);
    return p;
  }

  _buildBody() {
    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    const sweaterMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitSweater.map,
      bumpMap: this.textures.knitSweater.bumpMap,
      bumpScale: 0.045,
      roughness: 0.92,
    });
    const creamKnitMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitCream.map,
      bumpMap: this.textures.knitCream.bumpMap,
      bumpScale: 0.04,
      roughness: 0.92,
    });
    const woodBtnMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood.map,
      bumpMap: this.textures.wood.bumpMap,
      bumpScale: 0.02,
      roughness: 0.65,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      map: this.textures.linenSkin.map,
      bumpMap: this.textures.linenSkin.bumpMap,
      bumpScale: 0.022,
      roughness: 0.92,
    });
    this.skinMat = skinMat;

    // Plush pear-shaped knitted sweater torso
    const torsoGeo = new THREE.SphereGeometry(0.84, 28, 22);
    torsoGeo.scale(0.95, 1.05, 0.82);
    const torso = new THREE.Mesh(torsoGeo, sweaterMat);
    torso.position.set(0, 0.72, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    torso.userData = { hitKind: 'doll_body' };
    this.bodyGroup.add(torso);

    // Knitted hem rib at base
    const hemGeo = new THREE.TorusGeometry(0.68, 0.14, 12, 28);
    hemGeo.rotateX(Math.PI / 2);
    const hem = new THREE.Mesh(hemGeo, creamKnitMat);
    hem.position.set(0, 0.12, 0);
    hem.castShadow = true;
    hem.receiveShadow = true;
    this.bodyGroup.add(hem);

    // Scalloped crocheted cream lace collar (ring of plush petals)
    const collarGroup = new THREE.Group();
    collarGroup.position.set(0, 1.44, 0.03);
    const petalCount = 12;
    const petalGeo = new THREE.SphereGeometry(0.16, 12, 10);
    petalGeo.scale(1.0, 0.45, 1.2);
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const p = new THREE.Mesh(petalGeo, creamKnitMat);
      p.position.set(Math.cos(a) * 0.42, -0.02, Math.sin(a) * 0.36);
      p.rotation.y = -a + Math.PI / 2;
      p.rotation.x = 0.28;
      p.castShadow = true;
      collarGroup.add(p);
    }
    this.bodyGroup.add(collarGroup);

    // Two chunky wooden buttons down front of sweater + tiny cross stitches
    const stitchMat = new THREE.MeshStandardMaterial({ color: '#7a4526', roughness: 0.9 });
    for (let i = 0; i < 2; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.045, 18), woodBtnMat);
      btn.rotation.x = Math.PI / 2 - 0.12;
      btn.position.set(0, 1.05 - i * 0.34, 0.67 + i * 0.02);
      btn.castShadow = true;
      this.bodyGroup.add(btn);

      // Tiny cross thread on button
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.055), stitchMat);
      t1.rotation.z = Math.PI / 4;
      t1.position.copy(btn.position);
      t1.position.z += 0.012;
      this.bodyGroup.add(t1);
      const t2 = t1.clone();
      t2.rotation.z = -Math.PI / 4;
      this.bodyGroup.add(t2);
    }

    // Cloth neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.36, 16), skinMat);
    neck.position.set(0, 1.56, 0);
    neck.castShadow = true;
    this.bodyGroup.add(neck);
  }

  _buildArms() {
    const sweaterMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitSweater.map,
      bumpMap: this.textures.knitSweater.bumpMap,
      bumpScale: 0.045,
      roughness: 0.92,
    });
    const creamKnitMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitCream.map,
      bumpMap: this.textures.knitCream.bumpMap,
      bumpScale: 0.04,
      roughness: 0.92,
    });

    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.72, 1.28, 0.08);

      // Knitted sleeve
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.44, 8, 14), sweaterMat);
      sleeve.position.set(side * 0.14, -0.26, 0.16);
      sleeve.rotation.z = side * 0.42;
      sleeve.rotation.x = -0.52;
      sleeve.castShadow = true;
      pivot.add(sleeve);

      // Knitted cuff
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.065, 10, 18), creamKnitMat);
      cuff.position.set(side * 0.26, -0.46, 0.34);
      cuff.rotation.x = Math.PI / 2 - 0.52;
      cuff.rotation.y = side * 0.42;
      pivot.add(cuff);

      // Plush cloth mitten hand
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), this.skinMat);
      hand.scale.set(0.95, 0.85, 1.15);
      hand.position.set(side * 0.31, -0.55, 0.46);
      hand.castShadow = true;
      pivot.add(hand);

      // Little cloth thumb bump
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), this.skinMat);
      thumb.position.set(side * 0.18, -0.50, 0.52);
      pivot.add(thumb);

      this.bodyGroup.add(pivot);
      return pivot;
    };

    this.leftArmPivot = makeArm(-1);
    this.rightArmPivot = makeArm(1);
  }

  _buildHead() {
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.38, 0.02);
    this.bodyGroup.add(this.headGroup);

    // Plump fabric doll head
    const headGeo = new THREE.SphereGeometry(0.86, 32, 26);
    headGeo.scale(1.06, 1.0, 0.96);
    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headMesh.userData = { hitKind: 'doll_head' };
    this.headGroup.add(headMesh);
    this.headMesh = headMesh;

    // Cloth ears with tiny inner dimple
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), this.skinMat);
      ear.scale.set(0.55, 1.0, 0.72);
      ear.position.set(side * 0.88, -0.04, -0.02);
      ear.castShadow = true;
      this.headGroup.add(ear);
    }

    // Embroidered running-stitch side seams on the cloth head (signature handmade doll detail!)
    const seamMat = new THREE.MeshStandardMaterial({ color: '#c48f6e', roughness: 0.95 });
    const stitchGeo = new THREE.CapsuleGeometry(0.014, 0.055, 4, 6);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const t = -0.35 + i * 0.13;
        const s = new THREE.Mesh(stitchGeo, seamMat);
        const y = Math.sin(t) * 0.82;
        const r = Math.cos(t) * 0.88;
        s.position.set(side * r * 1.01, y, 0.18);
        s.rotation.z = side * 0.15;
        this.headGroup.add(s);
      }
    }

    // Cute tiny cloth button nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), this.skinMat);
    nose.scale.set(1.15, 0.85, 0.82);
    nose.position.set(0, -0.09, 0.835);
    this.headGroup.add(nose);

    // Rosy wool-felt oval cheek patches (interactive - poke to blush & giggle!)
    this.cheekMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltPink.map,
      bumpMap: this.textures.feltPink.bumpMap,
      bumpScale: 0.025,
      color: new THREE.Color('#f796a8'),
      roughness: 0.95,
    });
    this.cheeks = [];
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 12), this.cheekMat);
      cheek.scale.set(1.15, 0.72, 0.22);
      cheek.position.set(side * 0.48, -0.21, 0.69);
      cheek.rotation.y = side * 0.44;
      cheek.rotation.x = 0.12;
      cheek.userData = { hitKind: 'doll_cheek', side };
      this.headGroup.add(cheek);
      this.cheeks.push(cheek);
    }

    // Embroidered eyes & expressions
    const threadDark = new THREE.MeshStandardMaterial({ color: '#3b241c', roughness: 0.85 });
    const threadWhite = new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.6 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: '#c44d5d', roughness: 0.85 });

    // Open embroidered button-satin eyes
    this.openEyesGroup = new THREE.Group();
    this.headGroup.add(this.openEyesGroup);
    this.eyeGlints = [];
    this.brows = [];
    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.34, 0.03, 0.76);
      eyeGroup.rotation.y = side * 0.30;

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), threadDark);
      eye.scale.set(0.92, 1.12, 0.36);
      eyeGroup.add(eye);

      // Embroidered white highlight dot
      const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), threadWhite);
      glint1.position.set(-0.032, 0.042, 0.042);
      eyeGroup.add(glint1);

      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), threadWhite);
      glint2.position.set(0.035, -0.025, 0.04);
      eyeGroup.add(glint2);
      this.eyeGlints.push(glint1, glint2);

      // Tiny embroidered lash
      const lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.065, 4, 6), threadDark);
      lash.position.set(side * 0.11, 0.045, 0.015);
      lash.rotation.z = side * -0.78;
      eyeGroup.add(lash);

      this.openEyesGroup.add(eyeGroup);

      // Embroidered eyebrows (animated!)
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.14, 4, 8), threadDark);
      brow.position.set(side * 0.34, 0.25, 0.75);
      brow.rotation.z = Math.PI / 2 + side * 0.12;
      brow.rotation.y = side * 0.28;
      this.headGroup.add(brow);
      this.brows.push(brow);
    }

    // Happy closed-arc eyes (^ ^) for brushing & giggling
    this.happyEyesGroup = new THREE.Group();
    this.headGroup.add(this.happyEyesGroup);
    for (const side of [-1, 1]) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.024, 8, 16, Math.PI),
        threadDark
      );
      arc.position.set(side * 0.34, 0.0, 0.78);
      arc.rotation.y = side * 0.30;
      this.happyEyesGroup.add(arc);
    }

    // Wink eye group (left open, right happy arc)
    this.winkRightArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.115, 0.024, 8, 16, Math.PI),
      threadDark
    );
    this.winkRightArc.position.set(0.34, 0.0, 0.78);
    this.winkRightArc.rotation.y = 0.30;
    this.winkRightArc.visible = false;
    this.headGroup.add(this.winkRightArc);

    // Embroidered mouths (3 shapes: shy-messy small wave, warm smile, open joyful grin)
    this.mouthMessy = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.020, 8, 14, Math.PI * 0.75),
      mouthMat
    );
    this.mouthMessy.position.set(0, -0.34, 0.77);
    this.mouthMessy.rotation.z = Math.PI * 0.12;
    this.headGroup.add(this.mouthMessy);

    this.mouthSmile = new THREE.Mesh(
      new THREE.TorusGeometry(0.125, 0.024, 8, 18, Math.PI),
      mouthMat
    );
    this.mouthSmile.position.set(0, -0.26, 0.775);
    this.mouthSmile.rotation.z = Math.PI;
    this.headGroup.add(this.mouthSmile);

    this.mouthJoy = new THREE.Group();
    this.mouthJoy.position.set(0, -0.32, 0.765);
    const joyInner = new THREE.Mesh(
      new THREE.CircleGeometry(0.115, 16, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#b5374a', roughness: 0.9, side: THREE.DoubleSide })
    );
    joyInner.position.set(0, 0.04, 0.01);
    const joyRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.118, 0.022, 8, 18, Math.PI),
      mouthMat
    );
    joyRim.position.set(0, 0.04, 0.015);
    joyRim.rotation.z = Math.PI;
    this.mouthJoy.add(joyInner, joyRim);
    this.headGroup.add(this.mouthJoy);
  }

  _buildBaseHair() {
    this.baseHairGroup = new THREE.Group();
    this.headGroup.add(this.baseHairGroup);

    // Thick knitted yarn cap covering top & back of scalp (tilted BACK with negative X rotation so forehead & eyebrows stay 100% clear!)
    const capGeo = new THREE.SphereGeometry(0.91, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.54);
    capGeo.scale(1.06, 1.02, 0.99);
    const cap = new THREE.Mesh(capGeo, this.hairMaterials.main);
    cap.rotation.x = -0.46;
    cap.position.set(0, 0.08, -0.05);
    cap.castShadow = true;
    cap.receiveShadow = true;
    cap.userData = { hitKind: 'doll_hair' };
    this.baseHairGroup.add(cap);

    // Back-of-head fullness so mirror & head turns look lush from every angle
    const backDomeGeo = new THREE.SphereGeometry(0.89, 22, 18);
    backDomeGeo.scale(1.04, 0.98, 0.85);
    const backDome = new THREE.Mesh(backDomeGeo, this.hairMaterials.dark);
    backDome.position.set(0, 0.04, -0.24);
    backDome.castShadow = true;
    backDome.userData = { hitKind: 'doll_hair' };
    this.baseHairGroup.add(backDome);

    // Chunky sculpted yarn bangs framing her forehead (high enough to show cute embroidered brows & eyes!)
    const bangSpecs = [
      // Left side swoop
      { pts: [[0.02, 0.94, 0.22], [-0.30, 0.84, 0.64], [-0.66, 0.56, 0.68], [-0.86, 0.18, 0.42]], r: 0.148, mat: 'main' },
      { pts: [[-0.04, 0.92, 0.30], [-0.38, 0.76, 0.70], [-0.70, 0.42, 0.64]], r: 0.128, mat: 'light' },
      { pts: [[-0.12, 0.88, 0.38], [-0.32, 0.66, 0.78], [-0.48, 0.50, 0.76]], r: 0.112, mat: 'dark' },
      // Right side swoop
      { pts: [[-0.02, 0.94, 0.22], [0.30, 0.84, 0.64], [0.66, 0.56, 0.68], [0.86, 0.18, 0.42]], r: 0.148, mat: 'main' },
      { pts: [[0.04, 0.92, 0.30], [0.38, 0.76, 0.70], [0.70, 0.42, 0.64]], r: 0.128, mat: 'light' },
      { pts: [[0.12, 0.88, 0.38], [0.32, 0.66, 0.78], [0.48, 0.50, 0.76]], r: 0.112, mat: 'dark' },
      // Center playful yarn forehead fringe (above eyebrows!)
      { pts: [[0.0, 0.93, 0.34], [-0.08, 0.72, 0.80], [-0.14, 0.54, 0.82]], r: 0.105, mat: 'light' },
      { pts: [[0.04, 0.93, 0.34], [0.12, 0.72, 0.80], [0.16, 0.55, 0.81]], r: 0.105, mat: 'main' },
    ];
    for (const spec of bangSpecs) {
      const curve = new THREE.CatmullRomCurve3(spec.pts.map((p) => new THREE.Vector3(...p)));
      const geo = new THREE.TubeGeometry(curve, 14, spec.r, 9, false);
      const mesh = new THREE.Mesh(geo, this.hairMaterials[spec.mat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { hitKind: 'doll_hair' };
      this.baseHairGroup.add(mesh);
    }

    // Little yarn part-line tuft on top of head
    const crownTuft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.hairMaterials.light);
    crownTuft.scale.set(1.2, 0.55, 1.4);
    crownTuft.position.set(0, 0.93, 0.16);
    this.baseHairGroup.add(crownTuft);
  }

  _buildLooseHair() {
    this.looseHairGroup = new THREE.Group();
    this.headGroup.add(this.looseHairGroup);

    // 16 thick, lush yarn locks around left, right, and back of head
    // Angles avoid front face (-PI/3 to +PI/3) while sweeping nicely over shoulders!
    const lockCount = 16;
    const matKeys = ['main', 'light', 'dark', 'main'];

    for (let i = 0; i < lockCount; i++) {
      const side = i < 8 ? -1 : 1;
      const idxOnSide = i % 8; // 0 = front-most over shoulder, 7 = center back
      const frac = idxOnSide / 7;

      // Anchor point around head crown/side
      const azimuth = side * (1.12 + frac * 1.92); // radians from +Z
      const ax = Math.sin(azimuth) * 0.86;
      const az = Math.cos(azimuth) * 0.82;
      const ay = 0.42 + (1 - frac) * 0.18;

      const pivot = new THREE.Group();
      pivot.position.set(ax, ay, az);
      this.looseHairGroup.add(pivot);

      // Sleek combed lock curve (hanging gracefully downward & slightly curling at tip)
      const len = 1.55 + (1 - frac) * 0.22 + (i % 2) * 0.08;
      const flareOut = side * (0.20 + (1 - frac) * 0.16);
      const forwardSweep = idxOnSide < 3 ? 0.34 - idxOnSide * 0.08 : -0.10;
      const smoothCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(flareOut * 0.65, -len * 0.35, forwardSweep * 0.5),
        new THREE.Vector3(flareOut * 0.95, -len * 0.72, forwardSweep * 0.9),
        new THREE.Vector3(flareOut * 0.78, -len, forwardSweep * 1.05),
      ]);
      const smoothGeo = new THREE.TubeGeometry(smoothCurve, 14, 0.135, 9, false);

      // Messy tangled lock curve (charming wavy yarn bedhead curls!)
      const zigSign = i % 2 === 0 ? 1 : -1;
      const messyOut = side * (0.42 + (i % 3) * 0.16);
      const messyCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(messyOut * 0.65, -len * 0.22 + zigSign * 0.12, forwardSweep * 0.45 + 0.10),
        new THREE.Vector3(messyOut * 1.18, -len * 0.56 - zigSign * 0.12, forwardSweep * 0.72 - 0.10 * zigSign),
        new THREE.Vector3(messyOut * 0.82, -len * 0.88 + zigSign * 0.18, forwardSweep * 0.95 + 0.16),
      ]);
      const messyGeo = new THREE.TubeGeometry(messyCurve, 14, 0.132, 9, false);

      const mat = this.hairMaterials[matKeys[i % matKeys.length]];
      const smoothMesh = new THREE.Mesh(smoothGeo, mat);
      smoothMesh.castShadow = true;
      smoothMesh.receiveShadow = true;
      smoothMesh.userData = { hitKind: 'doll_hair', lockIndex: i };

      const messyMesh = new THREE.Mesh(messyGeo, mat);
      messyMesh.castShadow = true;
      messyMesh.receiveShadow = true;
      messyMesh.userData = { hitKind: 'doll_hair', lockIndex: i };

      // Cute rounded yarn tip cap
      const tipSmooth = new THREE.Mesh(new THREE.SphereGeometry(0.132, 9, 8), mat);
      tipSmooth.position.copy(smoothCurve.getPoint(1));
      smoothMesh.add(tipSmooth);

      const tipMessy = new THREE.Mesh(new THREE.SphereGeometry(0.135, 9, 8), mat);
      tipMessy.position.copy(messyCurve.getPoint(1));
      messyMesh.add(tipMessy);

      pivot.add(smoothMesh);
      pivot.add(messyMesh);

    // Start visibly tangled & frizzy (natural wavy bedhead!)
      const messyRotZ = side * (0.18 + (i % 3) * 0.09);
      const messyRotX = (i % 2 === 0 ? 1 : -1) * 0.14;

      this.looseLocks.push({
        index: i,
        side,
        pivot,
        smoothMesh,
        messyMesh,
        tangle: 1.0, // 1 = tangled, 0 = smooth combed
        messyRotZ,
        messyRotX,
        sway: 0,
        swayVel: 0,
        phase: i * 0.7,
      });
    }
  }

  _buildFuzzballs() {
    // 6 colorful wool tangle-knots / stray yarn fluff caught in messy hair!
    const fuzzSpecs = [
      { pos: [-1.18, 0.12, 0.36], felt: 'feltPink' },
      { pos: [-1.05, -0.42, 0.48], felt: 'feltMint' },
      { pos: [-0.88, 0.56, 0.46], felt: 'feltYellow' },
      { pos: [1.18, 0.16, 0.38], felt: 'feltSky' },
      { pos: [1.06, -0.38, 0.48], felt: 'feltYellow' },
      { pos: [0.88, 0.55, 0.46], felt: 'feltPink' },
    ];

    this.fuzzGroup = new THREE.Group();
    this.headGroup.add(this.fuzzGroup);

    fuzzSpecs.forEach((spec, idx) => {
      const g = new THREE.Group();
      g.position.set(...spec.pos);
      const mat = new THREE.MeshStandardMaterial({
        map: this.textures[spec.felt].map,
        bumpMap: this.textures[spec.felt].bumpMap,
        bumpScale: 0.04,
        roughness: 0.95,
      });

      // Clumpy tangled yarn knot made of 3 overlapping puffs + curly yarn loop
      const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.145, 1), mat);
      core.castShadow = true;
      core.userData = { hitKind: 'doll_fuzz', fuzzIndex: idx };
      g.add(core);

      const puff1 = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), mat);
      puff1.position.set(0.08, 0.06, 0.04);
      g.add(puff1);

      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 7, 14), this.hairMaterials.light);
      loop.rotation.set(0.6, idx, 0.4);
      g.add(loop);

      this.fuzzGroup.add(g);
      this.fuzzballs.push({
        index: idx,
        group: g,
        homePos: new THREE.Vector3(...spec.pos),
        state: 'tangled', // 'tangled' | 'falling' | 'table' | 'gone'
        vel: new THREE.Vector3(),
        worldPos: new THREE.Vector3(),
        spin: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5),
        hopTimer: 0,
      });
    });
  }

  _buildBraids() {
    this.braidsGroup = new THREE.Group();
    this.headGroup.add(this.braidsGroup);

    this.braidSides = {};
    const tieFeltMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltRed.map,
      bumpMap: this.textures.feltRed.bumpMap,
      bumpScale: 0.035,
      roughness: 0.92,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood.map,
      roughness: 0.55,
    });

    for (const side of [-1, 1]) {
      const key = side < 0 ? 'left' : 'right';
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.84, 0.12, 0.24);
      this.braidsGroup.add(pivot);

      // Top gather puff
      const gather = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), this.hairMaterials.main);
      gather.scale.set(1.0, 1.15, 0.95);
      gather.castShadow = true;
      gather.userData = { hitKind: 'doll_braid', side: key };
      pivot.add(gather);

      // 5 chunky woven braid plait segments (built from alternating left/right overlapping yarn pillows!)
      const segments = [];
      const matOrder = [this.hairMaterials.main, this.hairMaterials.light, this.hairMaterials.dark];
      for (let s = 0; s < this.maxWeaveSteps; s++) {
        const segGroup = new THREE.Group();
        segGroup.position.set(side * (0.04 + s * 0.025), -0.22 - s * 0.255, 0.08 + s * 0.035);

        const puffGeo = new THREE.CapsuleGeometry(0.118, 0.16, 8, 12);
        const leftPuff = new THREE.Mesh(puffGeo, matOrder[s % 3]);
        leftPuff.position.set(-0.085, 0.02, 0.02);
        leftPuff.rotation.z = -0.56;
        leftPuff.rotation.x = 0.18;
        leftPuff.castShadow = true;
        leftPuff.userData = { hitKind: 'doll_braid', side: key };

        const rightPuff = new THREE.Mesh(puffGeo, matOrder[(s + 1) % 3]);
        rightPuff.position.set(0.085, -0.05, 0.03);
        rightPuff.rotation.z = 0.56;
        rightPuff.rotation.x = 0.18;
        rightPuff.castShadow = true;
        rightPuff.userData = { hitKind: 'doll_braid', side: key };

        segGroup.add(leftPuff, rightPuff);
        pivot.add(segGroup);
        segments.push({ group: segGroup, scaleCur: 0 });
      }

      // 3 distinct unbraided lower strands hanging below the active weave tip!
      const looseStrandsGroup = new THREE.Group();
      pivot.add(looseStrandsGroup);
      const strands = [];
      const strandMats = [this.hairMaterials.light, this.hairMaterials.main, this.hairMaterials.dark];
      const xOffsets = [-0.20, 0.0, 0.20];
      for (let k = 0; k < 3; k++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(xOffsets[k] * 0.35, 0, 0),
          new THREE.Vector3(xOffsets[k] * 1.05, -0.45, 0.06),
          new THREE.Vector3(xOffsets[k] * 1.25, -0.95, 0.10),
        ]);
        const strandGeo = new THREE.TubeGeometry(curve, 10, 0.095, 8, false);
        const strandMesh = new THREE.Mesh(strandGeo, strandMats[k]);
        strandMesh.castShadow = true;
        strandMesh.userData = { hitKind: 'doll_braid', side: key };
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.092, 8, 8), strandMats[k]);
        tip.position.copy(curve.getPoint(1));
        strandMesh.add(tip);
        looseStrandsGroup.add(strandMesh);
        strands.push(strandMesh);
      }

      // Bottom yarn hair-tie + wooden bead + fluffy yarn tassel (pops in at weave 5/5!)
      const tasselGroup = new THREE.Group();
      tasselGroup.position.set(side * 0.16, -1.52, 0.26);
      const tieRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.048, 10, 18), tieFeltMat);
      tieRing.rotation.x = Math.PI / 2;
      tasselGroup.add(tieRing);

      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), woodMat);
      bead.position.set(0, -0.02, 0.14);
      tasselGroup.add(bead);

      // Fluffy brushed yarn tassel tail
      for (let t = 0; t < 4; t++) {
        const a = (t / 4) * Math.PI * 2;
        const tuft = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 6, 8), matOrder[t % 3]);
        tuft.position.set(Math.cos(a) * 0.065, -0.18, Math.sin(a) * 0.065);
        tuft.rotation.z = -Math.cos(a) * 0.28;
        tuft.rotation.x = Math.sin(a) * 0.28;
        tasselGroup.add(tuft);
      }
      tasselGroup.scale.setScalar(0.001);
      pivot.add(tasselGroup);

      // Accessory mount container on this braid so bows sway WITH the braid!
      const accessoryMount = new THREE.Group();
      pivot.add(accessoryMount);

      this.braidSides[key] = {
        pivot,
        segments,
        looseStrandsGroup,
        strands,
        tasselGroup,
        tasselScale: 0,
        accessoryMount,
      };
    }
  }

  _buildTwinBuns() {
    this.twinBunsGroup = new THREE.Group();
    this.headGroup.add(this.twinBunsGroup);

    const scrunchieMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitMint.map,
      bumpMap: this.textures.knitMint.bumpMap,
      bumpScale: 0.04,
      roughness: 0.9,
    });

    this.twinBunSides = {};
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'left' : 'right';
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.78, 0.64, 0.02);
      pivot.rotation.z = -side * 0.42;
      this.twinBunsGroup.add(pivot);

      // Uncoiled bouncy high ponytail (shrinks & spins as it coils into the bun!)
      const ponyGroup = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(a) * 0.34, 0.42, Math.sin(a) * 0.28),
          new THREE.Vector3(Math.cos(a) * 0.58, 0.02, Math.sin(a) * 0.48),
        ]);
        const lock = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 12, 0.115, 8, false),
          k % 2 === 0 ? this.hairMaterials.main : this.hairMaterials.light
        );
        lock.castShadow = true;
        lock.userData = { hitKind: 'doll_bun', side: key };
        ponyGroup.add(lock);
      }
      pivot.add(ponyGroup);

      // Coiled knitted spiral bun (plump stacked yarn rings + rounded yarn core)
      const bunGroup = new THREE.Group();
      const bunCore = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), this.hairMaterials.main);
      bunCore.scale.set(1.06, 0.92, 1.06);
      bunCore.position.set(0, 0.24, 0);
      bunCore.castShadow = true;
      bunCore.userData = { hitKind: 'doll_bun', side: key };
      bunGroup.add(bunCore);

      // 3 spiral twisted yarn coils wrapped around the bun
      const coilSpecs = [
        { y: 0.12, r: 0.36, tube: 0.115, mat: this.hairMaterials.dark },
        { y: 0.29, r: 0.33, tube: 0.115, mat: this.hairMaterials.light },
        { y: 0.44, r: 0.21, tube: 0.105, mat: this.hairMaterials.main },
      ];
      coilSpecs.forEach((cs, idx) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(cs.r, cs.tube, 10, 22), cs.mat);
        ring.rotation.x = Math.PI / 2 + (idx % 2 === 0 ? 0.10 : -0.10);
        ring.position.set(0, cs.y, 0);
        ring.castShadow = true;
        ring.userData = { hitKind: 'doll_bun', side: key };
        bunGroup.add(ring);
      });
      pivot.add(bunGroup);

      // Fluffy knitted scrunchie collar around bun base
      const scrunchieGroup = new THREE.Group();
      const puffCount = 10;
      const puffGeo = new THREE.SphereGeometry(0.115, 10, 8);
      for (let i = 0; i < puffCount; i++) {
        const a = (i / puffCount) * Math.PI * 2;
        const pf = new THREE.Mesh(puffGeo, scrunchieMat);
        pf.position.set(Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36);
        scrunchieGroup.add(pf);
      }
      scrunchieGroup.scale.setScalar(0.001);
      pivot.add(scrunchieGroup);

      // Cute short curly side-wisp by ear
      const wispCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.72, 0.08, 0.30),
        new THREE.Vector3(side * 0.86, -0.25, 0.36),
        new THREE.Vector3(side * 0.74, -0.52, 0.44),
      ]);
      const wisp = new THREE.Mesh(new THREE.TubeGeometry(wispCurve, 10, 0.085, 8, false), this.hairMaterials.light);
      wisp.castShadow = true;
      this.twinBunsGroup.add(wisp);

      this.twinBunSides[key] = {
        pivot,
        ponyGroup,
        bunGroup,
        scrunchieGroup,
        scrunchieScale: 0,
      };
    }
  }

  _buildTopBun() {
    this.topBunGroup = new THREE.Group();
    this.headGroup.add(this.topBunGroup);

    const pivot = new THREE.Group();
    pivot.position.set(0, 0.88, -0.04);
    this.topBunGroup.add(pivot);

    // Tall uncoiled crown ponytail
    const ponyGroup = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(a) * 0.42, 0.56, Math.sin(a) * 0.38),
        new THREE.Vector3(Math.cos(a) * 0.72, 0.08, Math.sin(a) * 0.62),
      ]);
      const lock = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, 0.13, 8, false),
        k % 2 === 0 ? this.hairMaterials.main : this.hairMaterials.light
      );
      lock.castShadow = true;
      lock.userData = { hitKind: 'doll_bun', side: 'top' };
      ponyGroup.add(lock);
    }
    pivot.add(ponyGroup);

    // Big plush crown top-bun
    const bunGroup = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 22, 18), this.hairMaterials.main);
    core.scale.set(1.08, 0.88, 1.08);
    core.position.set(0, 0.32, 0);
    core.castShadow = true;
    core.userData = { hitKind: 'doll_bun', side: 'top' };
    bunGroup.add(core);

    const ringSpecs = [
      { y: 0.14, r: 0.48, tube: 0.13, mat: this.hairMaterials.dark },
      { y: 0.34, r: 0.44, tube: 0.13, mat: this.hairMaterials.light },
      { y: 0.54, r: 0.28, tube: 0.12, mat: this.hairMaterials.main },
    ];
    ringSpecs.forEach((cs, idx) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(cs.r, cs.tube, 10, 24), cs.mat);
      ring.rotation.x = Math.PI / 2 + (idx % 2 === 0 ? 0.08 : -0.08);
      ring.position.set(0, cs.y, 0);
      ring.castShadow = true;
      ring.userData = { hitKind: 'doll_bun', side: 'top' };
      bunGroup.add(ring);
    });
    pivot.add(bunGroup);

    // Fluffy knitted halo scrunchie around big crown bun
    const scrunchieMat = new THREE.MeshStandardMaterial({
      map: this.textures.knitLavender.map,
      bumpMap: this.textures.knitLavender.bumpMap,
      bumpScale: 0.04,
      roughness: 0.9,
    });
    const scrunchieGroup = new THREE.Group();
    const puffGeo = new THREE.SphereGeometry(0.13, 10, 8);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pf = new THREE.Mesh(puffGeo, scrunchieMat);
      pf.position.set(Math.cos(a) * 0.50, 0.04, Math.sin(a) * 0.50);
      scrunchieGroup.add(pf);
    }
    scrunchieGroup.scale.setScalar(0.001);
    pivot.add(scrunchieGroup);

    // Cute side-framing yarn curls near cheeks
    for (const side of [-1, 1]) {
      const wispCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.76, 0.10, 0.28),
        new THREE.Vector3(side * 0.90, -0.32, 0.34),
        new THREE.Vector3(side * 0.78, -0.64, 0.44),
      ]);
      const wisp = new THREE.Mesh(new THREE.TubeGeometry(wispCurve, 10, 0.095, 8, false), this.hairMaterials.light);
      wisp.castShadow = true;
      this.topBunGroup.add(wisp);
    }

    this.topBun = { pivot, ponyGroup, bunGroup, scrunchieGroup, scrunchieScale: 0 };
  }

  /**
   * Reset hair back to tangled or smooth loose hair.
   */
  setStyle(style, resetProgress = true) {
    this.style = style;
    this.looseHairGroup.visible = style === 'loose';
    this.fuzzGroup.visible = style === 'loose';
    this.braidsGroup.visible = style === 'braids';
    this.twinBunsGroup.visible = style === 'twin_buns';
    this.topBunGroup.visible = style === 'top_bun';

    // Hide any stray detached fuzzballs when moving to styled hair
    if (style !== 'loose') {
      for (const f of this.fuzzballs) {
        f.state = 'gone';
        f.group.visible = false;
      }
      this.braidSwing = { left: 0, leftVel: 0, right: 0, rightVel: 0 };
    }

    if (resetProgress) {
      this.clearAccessories();
      if (style === 'braids') {
        this.weaveSteps = 0;
        for (const side of ['left', 'right']) {
          this.braidSides[side].tasselScale = 0;
          this.braidSides[side].tasselGroup.scale.setScalar(0.001);
          this.braidSides[side].segments.forEach((seg) => {
            seg.scaleCur = 0;
            seg.group.scale.setScalar(0.001);
          });
        }
      } else if (style === 'twin_buns' || style === 'top_bun') {
        this.coilProgress = 0;
        this.coilSpinAngle = 0;
        if (style === 'twin_buns') {
          for (const side of ['left', 'right']) {
            this.twinBunSides[side].scrunchieScale = 0;
            this.twinBunSides[side].scrunchieGroup.scale.setScalar(0.001);
          }
        } else {
          this.topBun.scrunchieScale = 0;
          this.topBun.scrunchieGroup.scale.setScalar(0.001);
        }
      }
    }
    this.triggerBounce(0.11);
  }

  resetToTangled() {
    this.setStyle('loose', true);
    this.looseLocks.forEach((lock) => {
      lock.tangle = 1.0;
      lock.sway = 0;
      lock.swayVel = 0;
    });
    this.fuzzballs.forEach((f) => {
      f.state = 'tangled';
      f.group.visible = true;
      f.group.position.copy(f.homePos);
      f.group.scale.setScalar(1);
      if (f.group.parent !== this.fuzzGroup) {
        this.fuzzGroup.add(f.group);
      }
    });
    this.setExpression('messy');
  }

  setExpression(expr) {
    this.expression = expr;
    this.openEyesGroup.visible = expr === 'messy' || expr === 'happy' || expr === 'sparkle' || expr === 'wink';
    this.happyEyesGroup.visible = expr === 'content';
    this.winkRightArc.visible = expr === 'wink';

    // Hide right open eye when winking
    if (this.openEyesGroup.children[1]) {
      this.openEyesGroup.children[1].visible = expr !== 'wink';
    }

    // Eyebrow tilt for cute emotional clarity
    if (this.brows.length === 2) {
      if (expr === 'messy') {
        this.brows[0].rotation.z = Math.PI / 2 - 0.18;
        this.brows[1].rotation.z = Math.PI / 2 + 0.18;
        this.brows[0].position.y = 0.24;
        this.brows[1].position.y = 0.24;
      } else if (expr === 'sparkle' || expr === 'wink') {
        this.brows[0].rotation.z = Math.PI / 2 + 0.16;
        this.brows[1].rotation.z = Math.PI / 2 - 0.16;
        this.brows[0].position.y = 0.29;
        this.brows[1].position.y = 0.29;
      } else {
        this.brows[0].rotation.z = Math.PI / 2 + 0.10;
        this.brows[1].rotation.z = Math.PI / 2 - 0.10;
        this.brows[0].position.y = 0.26;
        this.brows[1].position.y = 0.26;
      }
    }

    this.mouthMessy.visible = expr === 'messy';
    this.mouthSmile.visible = expr === 'content' || expr === 'happy';
    this.mouthJoy.visible = expr === 'sparkle' || expr === 'wink';

    // Bigger sparkly glints when delighted
    const glintScale = expr === 'sparkle' ? 1.35 : 1.0;
    this.eyeGlints.forEach((g) => g.scale.setScalar(glintScale));
  }

  /**
   * Brush at a world-space point; smooths nearby yarn locks & pops fuzzballs!
   * Returns { smoothedAmount, poppedFuzz: [{ worldPos, index }] }
   */
  brushAtWorldPoint(worldPt, brushVelX, brushVelY, sceneRoot) {
    let smoothedAmount = 0;
    const poppedFuzz = [];

    const tmpPos = new THREE.Vector3();
    for (const lock of this.looseLocks) {
      lock.pivot.getWorldPosition(tmpPos);
      // Center of lock is slightly below pivot; use XY-focused proximity so front brushing smooths back locks too!
      tmpPos.y -= 0.55;
      const dx = tmpPos.x - worldPt.x;
      const dy = tmpPos.y - worldPt.y;
      const dz = (tmpPos.z - worldPt.z) * 0.25;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1.75) {
        const influence = Math.max(0.35, 1 - dist / 1.75);
        if (lock.tangle > 0) {
          const prev = lock.tangle;
          lock.tangle = Math.max(0, lock.tangle - 0.22 * influence);
          smoothedAmount += prev - lock.tangle;
        }
        lock.swayVel += (brushVelX * 0.14 + (lock.side * -0.04)) * influence;
      }
    }

    // Pop any tangled fuzzballs near the brush (generous XY hitbox!)
    for (const f of this.fuzzballs) {
      if (f.state !== 'tangled') continue;
      f.group.getWorldPosition(tmpPos);
      const dist = Math.hypot(tmpPos.x - worldPt.x, tmpPos.y - worldPt.y, (tmpPos.z - worldPt.z) * 0.35);
      if (dist < 1.25) {
        f.state = 'falling';
        // Detach into sceneRoot so it tumbles physically onto the craft table!
        f.group.getWorldPosition(f.worldPos);
        sceneRoot.add(f.group);
        f.group.position.copy(f.worldPos);
        const sideDir = f.homePos.x < 0 ? -1 : 1;
        f.vel.set(sideDir * (1.2 + Math.random() * 0.9), 2.1 + Math.random() * 0.8, 1.0 + Math.random() * 0.7);
        poppedFuzz.push({ worldPos: f.worldPos.clone(), index: f.index });
      }
    }

    // Gentle head lean in direction of brushing
    this.headTiltTarget.z = THREE.MathUtils.clamp(-brushVelX * 0.08, -0.22, 0.22);
    this.headTiltTarget.x = THREE.MathUtils.clamp(0.08 - brushVelY * 0.04, -0.08, 0.18);

    return { smoothedAmount, poppedFuzz };
  }

  getBrushProgress() {
    let total = 0;
    for (const lock of this.looseLocks) {
      total += 1 - lock.tangle;
    }
    const lockRatio = total / this.looseLocks.length;
    const fuzzCleared = this.fuzzballs.filter((f) => f.state !== 'tangled').length / this.fuzzballs.length;
    return lockRatio * 0.7 + fuzzCleared * 0.3;
  }

  finishBrushingSnap(sceneRoot, instantClear = false) {
    for (const lock of this.looseLocks) {
      lock.tangle = 0;
    }
    const tmp = new THREE.Vector3();
    for (const f of this.fuzzballs) {
      if (instantClear) {
        f.state = 'gone';
        f.group.visible = false;
      } else if (f.state === 'tangled') {
        f.state = 'falling';
        f.group.getWorldPosition(tmp);
        sceneRoot.add(f.group);
        f.group.position.copy(tmp);
        const sideDir = f.homePos.x < 0 ? -1 : 1;
        f.vel.set(sideDir * 1.6, 2.2, 1.1);
      }
    }
  }

  /**
   * Advance interactive braid weaving by one chunky plait step!
   */
  advanceWeaveStep(dir = 1) {
    if (this.style !== 'braids' || this.weaveSteps >= this.maxWeaveSteps) return false;
    this.weaveSteps++;
    this.weaveSideDir = dir || (this.weaveSteps % 2 === 0 ? 1 : -1);
    this.weaveAnimTimer = 0.45;
    this.braidSwing.leftVel = THREE.MathUtils.clamp(this.braidSwing.leftVel + this.weaveSideDir * 1.6, -2.8, 2.8);
    this.braidSwing.rightVel = THREE.MathUtils.clamp(this.braidSwing.rightVel + this.weaveSideDir * 1.6, -2.8, 2.8);
    this.triggerBounce(0.55);
    return true;
  }

  /**
   * Advance interactive bun coiling (swirling gesture)!
   */
  advanceCoil(delta) {
    if (this.style !== 'twin_buns' && this.style !== 'top_bun') return false;
    if (this.coilProgress >= 1) return false;
    this.coilProgress = Math.min(1, this.coilProgress + delta);
    this.coilSpinAngle += delta * Math.PI * 5.2;
    this.bunSquish.left = 0.22;
    this.bunSquish.right = 0.22;
    this.bunSquish.top = 0.22;
    return true;
  }

  triggerBounce(impulse = 0.85) {
    this.bodyBounceVel = Math.max(this.bodyBounceVel, impulse);
  }

  triggerGiggle(duration = 0.95) {
    this.giggleTimer = Math.max(this.giggleTimer, duration);
    this.blushBoost = 1.0;
    this.triggerBounce(0.12);
  }

  pokeBraid(side) {
    if (side === 'left') {
      this.braidSwing.leftVel += 6.2;
    } else {
      this.braidSwing.rightVel -= 6.2;
    }
    this.triggerGiggle(0.7);
  }

  pokeBun(side) {
    this.bunSquish[side] = 0.36;
    this.triggerGiggle(0.7);
  }

  /**
   * Magnetic accessory snap anchors tailored to the active hairstyle!
   * Anchors return world positions + target local parent + outward orientation.
   */
  getAccessoryAnchors() {
    const anchors = [
      // Always available bang & crown anchors (cleanly outside bangs surface!)
      { id: 'bang_L', mirrorId: 'bang_R', parent: this.headGroup, localPos: new THREE.Vector3(-0.56, 0.64, 0.86), localRot: new THREE.Euler(-0.22, -0.44, 0.28) },
      { id: 'bang_R', mirrorId: 'bang_L', parent: this.headGroup, localPos: new THREE.Vector3(0.56, 0.64, 0.86), localRot: new THREE.Euler(-0.22, 0.44, -0.28) },
      { id: 'crown_C', mirrorId: null, parent: this.headGroup, localPos: new THREE.Vector3(0.0, 1.02, 0.44), localRot: new THREE.Euler(-0.48, 0, 0) },
      { id: 'temple_L', mirrorId: 'temple_R', parent: this.headGroup, localPos: new THREE.Vector3(-0.88, 0.34, 0.56), localRot: new THREE.Euler(-0.08, -0.72, 0.16) },
      { id: 'temple_R', mirrorId: 'temple_L', parent: this.headGroup, localPos: new THREE.Vector3(0.88, 0.34, 0.56), localRot: new THREE.Euler(-0.08, 0.72, -0.16) },
    ];

    if (this.style === 'braids') {
      anchors.push(
        { id: 'braid_top_L', mirrorId: 'braid_top_R', parent: this.braidSides.left.accessoryMount, localPos: new THREE.Vector3(-0.04, -0.10, 0.22), localRot: new THREE.Euler(0.05, -0.25, 0.15) },
        { id: 'braid_top_R', mirrorId: 'braid_top_L', parent: this.braidSides.right.accessoryMount, localPos: new THREE.Vector3(0.04, -0.10, 0.22), localRot: new THREE.Euler(0.05, 0.25, -0.15) },
        { id: 'braid_mid_L', mirrorId: 'braid_mid_R', parent: this.braidSides.left.accessoryMount, localPos: new THREE.Vector3(-0.08, -0.74, 0.28), localRot: new THREE.Euler(0.05, -0.18, 0.08) },
        { id: 'braid_mid_R', mirrorId: 'braid_mid_L', parent: this.braidSides.right.accessoryMount, localPos: new THREE.Vector3(0.08, -0.74, 0.28), localRot: new THREE.Euler(0.05, 0.18, -0.08) },
        { id: 'braid_tie_L', mirrorId: 'braid_tie_R', parent: this.braidSides.left.accessoryMount, localPos: new THREE.Vector3(-0.16, -1.48, 0.39), localRot: new THREE.Euler(0.08, -0.12, 0.06) },
        { id: 'braid_tie_R', mirrorId: 'braid_tie_L', parent: this.braidSides.right.accessoryMount, localPos: new THREE.Vector3(0.16, -1.48, 0.39), localRot: new THREE.Euler(0.08, 0.12, -0.06) },
      );
    } else if (this.style === 'twin_buns') {
      anchors.push(
        { id: 'bun_front_L', mirrorId: 'bun_front_R', parent: this.twinBunSides.left.pivot, localPos: new THREE.Vector3(0.02, 0.24, 0.42), localRot: new THREE.Euler(-0.12, -0.22, 0.14) },
        { id: 'bun_front_R', mirrorId: 'bun_front_L', parent: this.twinBunSides.right.pivot, localPos: new THREE.Vector3(-0.02, 0.24, 0.42), localRot: new THREE.Euler(-0.12, 0.22, -0.14) },
        { id: 'bun_base_L', mirrorId: 'bun_base_R', parent: this.twinBunSides.left.pivot, localPos: new THREE.Vector3(0.18, 0.04, 0.36), localRot: new THREE.Euler(0.06, 0.12, 0.20) },
        { id: 'bun_base_R', mirrorId: 'bun_base_L', parent: this.twinBunSides.right.pivot, localPos: new THREE.Vector3(-0.18, 0.04, 0.36), localRot: new THREE.Euler(0.06, -0.12, -0.20) },
        { id: 'bun_top_L', mirrorId: 'bun_top_R', parent: this.twinBunSides.left.pivot, localPos: new THREE.Vector3(-0.04, 0.56, 0.16), localRot: new THREE.Euler(-0.45, 0, 0.15) },
        { id: 'bun_top_R', mirrorId: 'bun_top_L', parent: this.twinBunSides.right.pivot, localPos: new THREE.Vector3(0.04, 0.56, 0.16), localRot: new THREE.Euler(-0.45, 0, -0.15) },
      );
    } else if (this.style === 'top_bun') {
      anchors.push(
        { id: 'topbun_front', mirrorId: null, parent: this.topBun.pivot, localPos: new THREE.Vector3(0, 0.22, 0.54), localRot: new THREE.Euler(-0.15, 0, 0) },
        { id: 'topbun_L', mirrorId: 'topbun_R', parent: this.topBun.pivot, localPos: new THREE.Vector3(-0.44, 0.26, 0.34), localRot: new THREE.Euler(-0.15, -0.58, 0.22) },
        { id: 'topbun_R', mirrorId: 'topbun_L', parent: this.topBun.pivot, localPos: new THREE.Vector3(0.44, 0.26, 0.34), localRot: new THREE.Euler(-0.15, 0.58, -0.22) },
        { id: 'topbun_top', mirrorId: null, parent: this.topBun.pivot, localPos: new THREE.Vector3(0, 0.68, 0.18), localRot: new THREE.Euler(-0.62, 0, 0) },
      );
    }

    return anchors.map((a) => {
      const worldPos = a.localPos.clone();
      a.parent.localToWorld(worldPos);
      return { ...a, worldPos };
    });
  }

  findNearestAnchor(worldPt, excludeAnchorId = null) {
    const anchors = this.getAccessoryAnchors();
    const usedIds = new Set(this.placedAccessories.map((p) => p.anchorId));
    if (excludeAnchorId) usedIds.delete(excludeAnchorId);

    let best = null;
    let bestDist = Infinity;
    for (const a of anchors) {
      if (usedIds.has(a.id)) continue;
      const d = a.worldPos.distanceTo(worldPt);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best ? { anchor: best, dist: bestDist } : null;
  }

  attachAccessory(type, mesh, anchor) {
    // Limit to 10 accessories cleanly (if full, pop oldest)
    if (this.placedAccessories.length >= 10) {
      const oldest = this.placedAccessories.shift();
      if (oldest && oldest.mesh.parent) oldest.mesh.parent.remove(oldest.mesh);
    }

    anchor.parent.add(mesh);
    mesh.position.copy(anchor.localPos);
    mesh.rotation.copy(anchor.localRot);
    mesh.scale.setScalar(0.01);

    const record = {
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      mesh,
      anchorId: anchor.id,
      mirrorId: anchor.mirrorId,
      baseRot: anchor.localRot.clone(),
      popScale: 0.01,
      pokeTimer: 0.45,
    };
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData.hitKind = 'placed_accessory';
        child.userData.accessoryId = record.id;
      }
    });
    this.placedAccessories.push(record);

    // Check if matching mirror partner exists (Symmetry Discovery!)
    let isSymmetry = false;
    if (anchor.mirrorId) {
      const partner = this.placedAccessories.find((p) => p.anchorId === anchor.mirrorId && p.type === type);
      if (partner) {
        isSymmetry = true;
        partner.pokeTimer = 0.75;
        record.pokeTimer = 0.75;
      }
    }

    this.triggerBounce(0.13);
    this.triggerGiggle(0.65);
    return { record, isSymmetry };
  }

  removeAccessoryById(id) {
    const idx = this.placedAccessories.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const [removed] = this.placedAccessories.splice(idx, 1);
    if (removed.mesh.parent) removed.mesh.parent.remove(removed.mesh);
    return removed;
  }

  pokeAccessory(id) {
    const item = this.placedAccessories.find((p) => p.id === id);
    if (!item) return null;
    item.pokeTimer = 0.75;
    this.triggerGiggle(0.55);
    return item;
  }

  clearAccessories() {
    for (const item of this.placedAccessories) {
      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
    }
    this.placedAccessories = [];
  }

  update(dt, time, stage) {
    // 1. Body breathing + stable damped bounce spring
    const safeDt = Math.min(dt, 0.033);
    this.bodyBounceVel += -this.bodyBounceY * 95 * safeDt;
    this.bodyBounceVel *= Math.exp(-9.0 * safeDt);
    this.bodyBounceY = THREE.MathUtils.clamp(this.bodyBounceY + this.bodyBounceVel * safeDt, -0.14, 0.28);

    const breathe = Math.sin(time * 2.1) * 0.02;
    this.bodyGroup.position.y = Math.max(-0.04, this.bodyBounceY) + breathe;
    const squash = THREE.MathUtils.clamp(1 + this.bodyBounceY * 0.42, 0.82, 1.24);
    this.bodyGroup.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // 2. Body yaw toward mirror in Mirror Show mode + head animations
    const targetBodyYaw = this.mirrorMode ? 0.36 : 0.0;
    this.bodyGroup.rotation.y = THREE.MathUtils.lerp(this.bodyGroup.rotation.y, targetBodyYaw, Math.min(1, safeDt * 5.0));

    if (this.mirrorMode) {
      if (this.mirrorPoseIndex === 0) {
        // Admiring herself happily in the mirror
        this.headTiltTarget.set(-0.04, 0.14 + Math.sin(time * 2.2) * 0.16, Math.sin(time * 2.2) * 0.10);
      } else if (this.mirrorPoseIndex === 1) {
        // Playful wink & head tilt toward mirror
        this.headTiltTarget.set(-0.05, 0.10, 0.22);
      } else if (this.mirrorPoseIndex === 2) {
        // Happy sway showing off both sides of her hair
        this.headTiltTarget.set(0.02, 0.12 + Math.sin(time * 3.2) * 0.36, Math.cos(time * 3.2) * 0.14);
      } else {
        // Lean in close & blow kiss joy
        this.headTiltTarget.set(0.08, 0.18 + Math.sin(time * 1.8) * 0.10, -0.12);
      }
    } else if (stage === 'brush') {
      // Gentle idle head sway when not actively dragged
      this.headTiltTarget.x = THREE.MathUtils.lerp(this.headTiltTarget.x, Math.sin(time * 1.2) * 0.04, dt * 3);
      this.headTiltTarget.y = THREE.MathUtils.lerp(this.headTiltTarget.y, Math.sin(time * 0.9) * 0.08, dt * 3);
      this.headTiltTarget.z = THREE.MathUtils.lerp(this.headTiltTarget.z, Math.sin(time * 1.4) * 0.05, dt * 3);
    } else {
      const joyAmp = stage === 'decorate' ? 0.10 : 0.07;
      this.headTiltTarget.x = Math.sin(time * 1.6) * 0.05;
      this.headTiltTarget.y = Math.sin(time * 1.1) * joyAmp;
      this.headTiltTarget.z = Math.sin(time * 1.9) * 0.06;
    }

    if (this.giggleTimer > 0) {
      this.giggleTimer = Math.max(0, this.giggleTimer - dt);
      this.headTiltTarget.z += Math.sin(time * 20) * 0.09 * this.giggleTimer;
    }

    this.headTiltCurrent.lerp(this.headTiltTarget, Math.min(1, dt * 7.5));
    this.headGroup.rotation.set(this.headTiltCurrent.x, this.headTiltCurrent.y, this.headTiltCurrent.z);

    // 3. Rosy cheek blush animation
    this.blushBoost = Math.max(0, this.blushBoost - dt * 0.7);
    const blushColor = new THREE.Color('#f796a8').lerp(new THREE.Color('#f25272'), this.blushBoost * 0.75);
    this.cheekMat.color.copy(blushColor);

    // 4. Arm poses (expressive cloth mitten hands!)
    let leftArmRotX = 0.0, leftArmRotZ = 0.0;
    let rightArmRotX = 0.0, rightArmRotZ = 0.0;
    if (this.mirrorMode) {
      if (this.mirrorPoseIndex === 0) {
        // Both hands lifted happily near braids/buns!
        leftArmRotX = -1.25 + Math.sin(time * 4.5) * 0.14;
        leftArmRotZ = -0.35;
        rightArmRotX = -1.25 + Math.cos(time * 4.5) * 0.14;
        rightArmRotZ = 0.35;
      } else if (this.mirrorPoseIndex === 1) {
        // Right hand wave!
        leftArmRotX = -0.5;
        rightArmRotX = -1.55;
        rightArmRotZ = 0.25 + Math.sin(time * 10) * 0.32;
      } else if (this.mirrorPoseIndex === 2) {
        // Joyful wide celebration arms
        leftArmRotX = -1.35;
        leftArmRotZ = -0.68 + Math.sin(time * 7) * 0.18;
        rightArmRotX = -1.35;
        rightArmRotZ = 0.68 - Math.sin(time * 7) * 0.18;
      } else {
        // Hand near cheek blowing a kiss
        leftArmRotX = -1.15;
        leftArmRotZ = -0.25;
        rightArmRotX = -1.42 + Math.sin(time * 5) * 0.18;
        rightArmRotZ = -0.18;
      }
    } else if (stage === 'choose_style' || stage === 'weaving' || stage === 'coiling') {
      // Excited expectant pose: hands raised slightly!
      leftArmRotX = -0.62 + Math.sin(time * 3.2) * 0.10;
      rightArmRotX = -0.62 + Math.cos(time * 3.2) * 0.10;
      leftArmRotZ = -0.16;
      rightArmRotZ = 0.16;
    } else if (stage === 'decorate') {
      leftArmRotX = -0.45 + Math.sin(time * 2.4) * 0.08;
      rightArmRotX = -0.45 + Math.cos(time * 2.4) * 0.08;
    } else {
      // Relaxed sitting pose while getting brushed
      leftArmRotX = -0.12 + Math.sin(time * 2.0) * 0.06;
      rightArmRotX = -0.12 + Math.cos(time * 2.0) * 0.06;
    }
    if (this.giggleTimer > 0) {
      leftArmRotX -= 0.35 * this.giggleTimer;
      rightArmRotX -= 0.35 * this.giggleTimer;
    }
    this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, leftArmRotX, dt * 6);
    this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, leftArmRotZ, dt * 6);
    this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, rightArmRotX, dt * 6);
    this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, rightArmRotZ, dt * 6);

    // 5. Loose Hair Locks (morph messy <-> smooth + spring sway)
    if (this.looseHairGroup.visible) {
      for (const lock of this.looseLocks) {
        lock.swayVel += -lock.sway * 52 * dt;
        lock.swayVel *= Math.exp(-5.5 * dt);
        lock.sway += lock.swayVel * dt;

        const t = lock.tangle;
        lock.messyMesh.visible = t > 0.05;
        lock.smoothMesh.visible = t < 0.95;
        lock.messyMesh.scale.setScalar(Math.max(0.001, t));
        lock.smoothMesh.scale.setScalar(Math.max(0.001, 1 - t * 0.92));

        const idleWave = Math.sin(time * 2.2 + lock.phase) * 0.035;
        lock.pivot.rotation.z = lock.messyRotZ * t + lock.sway + idleWave - this.headTiltCurrent.z * 0.45;
        lock.pivot.rotation.x = lock.messyRotX * t;
      }
    }

    // 6. Fuzzballs physics (tangled wiggle -> falling -> bouncing on table!)
    for (const f of this.fuzzballs) {
      if (f.state === 'tangled') {
        const s = 1 + Math.sin(time * 4.2 + f.index) * 0.06;
        f.group.scale.setScalar(s);
      } else if (f.state === 'falling') {
        f.vel.y -= 10.5 * dt;
        f.group.position.addScaledVector(f.vel, dt);
        f.group.rotation.x += f.spin.x * dt;
        f.group.rotation.y += f.spin.y * dt;
        if (f.group.position.y <= 0.16) {
          f.group.position.y = 0.16;
          if (Math.abs(f.vel.y) > 0.8) {
            f.vel.y = -f.vel.y * 0.42;
            f.vel.x *= 0.65;
            f.vel.z *= 0.65;
          } else {
            f.state = 'table';
            f.vel.set(0, 0, 0);
          }
        }
      } else if (f.state === 'table' && f.hopTimer > 0) {
        f.hopTimer = Math.max(0, f.hopTimer - dt);
        f.group.position.y = 0.16 + Math.sin(f.hopTimer * Math.PI * 2.5) * 0.35 * f.hopTimer;
        f.group.scale.setScalar(Math.max(0.01, f.hopTimer * 1.4));
        if (f.hopTimer <= 0.02) {
          f.state = 'gone';
          f.group.visible = false;
        }
      }
    }

    // 7. Braids weave & pendulum spring animation
    if (this.braidsGroup.visible) {
      if (this.weaveAnimTimer > 0) {
        this.weaveAnimTimer = Math.max(0, this.weaveAnimTimer - dt);
      }
      for (const side of ['left', 'right']) {
        const bs = this.braidSides[side];
        const velKey = side + 'Vel';
        // Spring pendulum driven by head tilt & pokes (safely clamped!)
        const targetSwing = -this.headTiltCurrent.z * 0.55 + Math.sin(time * 2.4 + (side === 'left' ? 0 : 1.5)) * 0.03;
        this.braidSwing[velKey] += (targetSwing - this.braidSwing[side]) * 36 * safeDt;
        this.braidSwing[velKey] *= Math.exp(-5.2 * safeDt);
        this.braidSwing[velKey] = THREE.MathUtils.clamp(this.braidSwing[velKey], -3.0, 3.0);
        this.braidSwing[side] = THREE.MathUtils.clamp(this.braidSwing[side] + this.braidSwing[velKey] * safeDt, -0.38, 0.38);
        bs.pivot.rotation.z = this.braidSwing[side];

        // Scale in woven segments 0..weaveSteps
        bs.segments.forEach((seg, idx) => {
          const target = idx < this.weaveSteps ? 1.0 : 0.001;
          seg.scaleCur = THREE.MathUtils.lerp(seg.scaleCur, target, Math.min(1, dt * 11));
          const pop = idx === this.weaveSteps - 1 && this.weaveAnimTimer > 0
            ? 1 + Math.sin((this.weaveAnimTimer / 0.45) * Math.PI) * 0.25
            : 1;
          seg.group.scale.setScalar(Math.max(0.001, seg.scaleCur * pop));
        });

        // Position & animate unbraided 3 lower strands below current woven tip
        const remaining = this.maxWeaveSteps - this.weaveSteps;
        if (remaining > 0) {
          bs.looseStrandsGroup.visible = true;
          const sSign = side === 'left' ? -1 : 1;
          bs.looseStrandsGroup.position.set(
            sSign * (0.04 + this.weaveSteps * 0.025),
            -0.14 - this.weaveSteps * 0.255,
            0.08 + this.weaveSteps * 0.035
          );
          const lenScale = 0.45 + (remaining / this.maxWeaveSteps) * 0.65;
          bs.looseStrandsGroup.scale.set(1, lenScale, 1);

          // Dramatic crossing animation when weaving!
          const crossWave = this.weaveAnimTimer > 0
            ? Math.sin((this.weaveAnimTimer / 0.45) * Math.PI) * 0.36 * this.weaveSideDir
            : Math.sin(time * 3.0) * 0.08;
          bs.strands[0].rotation.z = -0.14 + crossWave;
          bs.strands[1].rotation.z = -crossWave * 0.65;
          bs.strands[2].rotation.z = 0.14 + crossWave;
        } else {
          bs.looseStrandsGroup.visible = false;
          bs.tasselScale = THREE.MathUtils.lerp(bs.tasselScale, 1.0, Math.min(1, dt * 10));
          bs.tasselGroup.scale.setScalar(Math.max(0.001, bs.tasselScale));
        }
      }
    }

    // 8. Twin Buns & Top Bun coiling + squishy bounce
    if (this.twinBunsGroup.visible) {
      for (const side of ['left', 'right']) {
        const b = this.twinBunSides[side];
        this.bunSquish[side] = Math.max(0, this.bunSquish[side] - dt * 1.4);
        const sq = 1 + Math.sin(this.bunSquish[side] * Math.PI * 3) * 0.22 * this.bunSquish[side];

        const p = this.coilProgress;
        b.ponyGroup.visible = p < 0.96;
        b.ponyGroup.scale.set(Math.max(0.01, 1 - p * 0.78), Math.max(0.01, 1 - p * 0.85), Math.max(0.01, 1 - p * 0.78));
        b.ponyGroup.rotation.y = this.coilSpinAngle * (side === 'left' ? 1 : -1);

        const bunScale = Math.max(0.01, 0.15 + p * 0.85);
        b.bunGroup.scale.set(bunScale * sq, bunScale / sq, bunScale * sq);
        b.bunGroup.rotation.y = this.coilSpinAngle * 0.65 * (side === 'left' ? 1 : -1);

        const scTarget = p >= 0.98 ? 1.0 : 0.001;
        b.scrunchieScale = THREE.MathUtils.lerp(b.scrunchieScale, scTarget, Math.min(1, dt * 10));
        b.scrunchieGroup.scale.setScalar(Math.max(0.001, b.scrunchieScale));
      }
    }

    if (this.topBunGroup.visible) {
      const b = this.topBun;
      this.bunSquish.top = Math.max(0, this.bunSquish.top - dt * 1.4);
      const sq = 1 + Math.sin(this.bunSquish.top * Math.PI * 3) * 0.22 * this.bunSquish.top;

      const p = this.coilProgress;
      b.ponyGroup.visible = p < 0.96;
      b.ponyGroup.scale.set(Math.max(0.01, 1 - p * 0.78), Math.max(0.01, 1 - p * 0.85), Math.max(0.01, 1 - p * 0.78));
      b.ponyGroup.rotation.y = this.coilSpinAngle;

      const bunScale = Math.max(0.01, 0.18 + p * 0.82);
      b.bunGroup.scale.set(bunScale * sq, bunScale / sq, bunScale * sq);
      b.bunGroup.rotation.y = this.coilSpinAngle * 0.65;

      const scTarget = p >= 0.98 ? 1.0 : 0.001;
      b.scrunchieScale = THREE.MathUtils.lerp(b.scrunchieScale, scTarget, Math.min(1, dt * 10));
      b.scrunchieGroup.scale.setScalar(Math.max(0.001, b.scrunchieScale));
    }

    // 9. Hair color wave shimmer bounce
    if (this.colorWaveTimer > 0) {
      this.colorWaveTimer = Math.max(0, this.colorWaveTimer - dt);
      const waveScale = 1 + Math.sin(this.colorWaveTimer * Math.PI * 3) * 0.05 * this.colorWaveTimer;
      this.baseHairGroup.scale.setScalar(waveScale);
    } else {
      this.baseHairGroup.scale.setScalar(1);
    }

    // 10. Placed Accessories micro-animations (pop-in, flower spin, bow flutter, pompom squish)
    for (const acc of this.placedAccessories) {
      acc.popScale = THREE.MathUtils.lerp(acc.popScale, 1.0, Math.min(1, dt * 12));
      let s = acc.popScale;
      if (acc.pokeTimer > 0) {
        acc.pokeTimer = Math.max(0, acc.pokeTimer - dt);
        const w = Math.sin(acc.pokeTimer * Math.PI * 5) * acc.pokeTimer;
        if (acc.type === 'flower') {
          acc.mesh.rotation.z = acc.baseRot.z + (0.75 - acc.pokeTimer) * 8.5;
        } else if (acc.type === 'pompom') {
          acc.mesh.scale.set(s * (1 + w * 0.35), s * (1 - w * 0.28), s * (1 + w * 0.35));
          continue;
        } else {
          acc.mesh.rotation.z = acc.baseRot.z + w * 0.45;
        }
        s *= 1 + Math.abs(w) * 0.18;
      } else {
        // Gentle ambient life
        acc.mesh.rotation.z = THREE.MathUtils.lerp(
          acc.mesh.rotation.z,
          acc.baseRot.z + Math.sin(time * 2.5 + acc.mesh.id) * 0.04,
          dt * 5
        );
      }
      acc.mesh.scale.setScalar(s);
    }
  }
}
