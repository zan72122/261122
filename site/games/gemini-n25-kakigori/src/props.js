import * as THREE from '../vendor/three.module.js';
import {
  createWoodTextures,
  createBambooCoasterTexture,
  createLinenMatTexture,
  createNorenTexture,
  createSyrupLabelTexture,
  createBokehBackdropTexture,
} from './textures.js';
import { SYRUP_COLORS } from './kakigori.js';

export class ShopProps {
  constructor(scene, fruitFactory) {
    this.scene = scene;
    this.fruitFactory = fruitFactory;
    this.hitMeshes = [];
    this.bottles = {};
    this.plateFruits = [];
    this.norenPanels = [];
    this.keepsakes = [];
    this.furinSwing = 0;
    this.furinVel = 0;
    this.time = 0;

    this._buildEnvironment();
    this._buildSyrupBottles();
    this._buildMilkBottle();
    this._buildFruitPlate();
    this._buildPourStream();
  }

  _buildEnvironment() {
    // 1. Sun-drenched summer garden & festival bokeh backdrop (sells macro miniature scale immediately!)
    const bokehTex = createBokehBackdropTexture();
    const bgPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10.5),
      new THREE.MeshBasicMaterial({ map: bokehTex })
    );
    bgPlane.position.set(0, 2.6, -4.6);
    this.scene.add(bgPlane);

    // 2. Handcrafted Hinoki/Cedar Wooden Countertop (y = 0) — natural warm satin wood!
    const counterWood = createWoodTextures(17, '#c29263', '#8c5e35');
    const darkWood = createWoodTextures(29, '#7a4d2c', '#4d2d16');

    const counterMat = new THREE.MeshStandardMaterial({
      map: counterWood.map,
      bumpMap: counterWood.bumpMap,
      bumpScale: 0.022,
      roughness: 0.62,
      metalness: 0.02,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      map: darkWood.map,
      bumpMap: darkWood.bumpMap,
      bumpScale: 0.024,
      roughness: 0.64,
    });

    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.24, 3.4), counterMat);
    counterTop.position.set(0, -0.12, 0.22);
    counterTop.receiveShadow = true;
    this.scene.add(counterTop);

    // Front molded wooden counter bevel edge
    const frontEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.2, 14), counterMat);
    frontEdge.rotation.z = Math.PI / 2;
    frontEdge.position.set(0, -0.12, 1.91);
    frontEdge.receiveShadow = true;
    this.scene.add(frontEdge);

    // Counter underside apron (tall enough to cover tall iPhone portrait screens seamlessly!)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.6, 3.1), darkWoodMat);
    apron.position.set(0, -2.04, 0.22);
    this.scene.add(apron);

    // 3. Woven Miniature Bamboo Coaster (Decorating Spot — cleanly spaced from shaver!)
    const coasterTex = createBambooCoasterTexture();
    this.coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.74, 0.022, 32),
      new THREE.MeshStandardMaterial({ map: coasterTex, roughness: 0.8 })
    );
    this.coaster.position.set(0.08, 0.011, 0.56);
    this.coaster.receiveShadow = true;
    this.scene.add(this.coaster);

    // 4. Striped Japanese Linen Serving Mat (Customer Serving Spot)
    const linenTex = createLinenMatTexture();
    this.servingMat = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.016, 0.84),
      new THREE.MeshStandardMaterial({ map: linenTex, roughness: 0.88 })
    );
    this.servingMat.position.set(0.0, 0.008, -0.58);
    this.servingMat.receiveShadow = true;
    this.servingMat.userData = { interactType: 'serveMat' };
    this.scene.add(this.servingMat);
    this.hitMeshes.push(this.servingMat);

    // 5. Miniature Wooden Stall Pillars & Upper Roof Beam (framing the top cleanly!)
    for (const px of [-2.95, 2.95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 5.0, 0.24), darkWoodMat);
      post.position.set(px, 2.0, -1.28);
      post.castShadow = true;
      post.receiveShadow = true;
      this.scene.add(post);
    }

    const roofBeam = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.22, 0.34), darkWoodMat);
    roofBeam.position.set(0, 3.16, -1.16);
    roofBeam.castShadow = true;
    this.scene.add(roofBeam);

    // Bamboo pole for hanging noren curtains
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0xbba060, roughness: 0.58 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 6.2, 12), bambooMat);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, 3.00, -1.04);
    this.scene.add(pole);

    // 6. Swaying Pictorial Miniature Noren Curtains (ZERO text! Pure shaved-ice & snowflake crests!)
    const norenTexA = createNorenTexture(0);
    const norenTexB = createNorenTexture(1);
    const panelCount = 5;
    for (let i = 0; i < panelCount; i++) {
      const pivot = new THREE.Group();
      pivot.position.set((i - 2) * 1.10, 3.00, -1.02);
      const geo = new THREE.PlaneGeometry(1.00, 0.72, 2, 4);
      geo.translate(0, -0.36, 0);
      const mat = new THREE.MeshStandardMaterial({
        map: i % 2 === 0 ? norenTexA : norenTexB,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(geo, mat);
      panel.castShadow = true;
      pivot.add(panel);
      this.scene.add(pivot);
      this.norenPanels.push({ pivot, phase: i * 0.7 });
    }

    // 7. Glowing Miniature Japanese Summer Paper Lanterns (warm cozy glow on both stall sides!)
    for (const [lx, colHex] of [[-2.42, 0xffeed2], [2.42, 0xffdfd4]]) {
      const lantern = new THREE.Group();
      lantern.position.set(lx, 2.38, -0.84);

      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.58, 6), darkWoodMat);
      cord.position.y = 0.48;
      lantern.add(cord);

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 18, 14),
        new THREE.MeshStandardMaterial({
          color: colHex,
          emissive: 0xffa64d,
          emissiveIntensity: 0.72,
          roughness: 0.75,
        })
      );
      body.scale.set(0.95, 1.18, 0.95);
      lantern.add(body);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.245, 0.02, 8, 22),
        new THREE.MeshStandardMaterial({ color: 0xd93a3a, roughness: 0.7 })
      );
      band.rotation.x = Math.PI / 2;
      lantern.add(band);

      for (const cy of [-0.29, 0.29]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.045, 14), darkWoodMat);
        cap.position.y = cy;
        lantern.add(cap);
      }
      this.scene.add(lantern);
    }

    // 8. Interactive Translucent Glass Wind Chime (Furin) — cleanly visible & tappable!
    this.furinPivot = new THREE.Group();
    this.furinPivot.position.set(-1.62, 2.74, -0.45);
    this.scene.add(this.furinPivot);

    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6),
      new THREE.MeshBasicMaterial({ color: 0xf0e6d2 })
    );
    string.position.y = -0.18;
    this.furinPivot.add(string);

    const bellGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.72),
      new THREE.MeshPhysicalMaterial({
        color: 0xbceeff,
        roughness: 0.06,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    bellGlass.position.y = -0.42;
    this.furinPivot.add(bellGlass);

    const bellBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.015, 8, 22),
      new THREE.MeshStandardMaterial({ color: 0xe64545, roughness: 0.3 })
    );
    bellBand.rotation.x = Math.PI / 2;
    bellBand.position.y = -0.49;
    this.furinPivot.add(bellBand);

    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xffece8, roughness: 0.85, side: THREE.DoubleSide })
    );
    strip.position.y = -0.78;
    this.furinPivot.add(strip);

    const furinHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    furinHit.position.y = -0.55;
    furinHit.userData = { interactType: 'furin' };
    this.furinPivot.add(furinHit);
    this.hitMeshes.push(furinHit);

    // 9. Wooden Keepsake Souvenir Shelf + Low Wooden Syrup Caddy Step
    this.keepsakeRail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.24), darkWoodMat);
    this.keepsakeRail.position.set(0, 0.035, -1.04);
    this.keepsakeRail.receiveShadow = true;
    this.scene.add(this.keepsakeRail);

    // Miniature stepped wooden bottle stand on right-back so all 3 syrup bottles display proudly!
    this.bottleRack = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.10, 0.44), darkWoodMat);
    this.bottleRack.position.set(1.38, 0.05, -0.26);
    this.bottleRack.rotation.y = -0.18;
    this.bottleRack.castShadow = true;
    this.bottleRack.receiveShadow = true;
    this.scene.add(this.bottleRack);
  }

  _buildSyrupBottles() {
    const kinds = [
      { key: 'strawberry', color: SYRUP_COLORS.strawberry, pos: new THREE.Vector3(0.95, 0, -0.18) },
      { key: 'lemon', color: SYRUP_COLORS.lemon, pos: new THREE.Vector3(1.34, 0, -0.06) },
      { key: 'blue', color: SYRUP_COLORS.blue, pos: new THREE.Vector3(1.66, 0, 0.14) },
    ];

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.07,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 1.6,
      depthWrite: false,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe6edf2,
      roughness: 0.16,
      metalness: 0.88,
    });

    for (const def of kinds) {
      const group = new THREE.Group();
      group.position.copy(def.pos);

      // Rich glossy colored syrup inside the glass bottle
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: def.color,
        roughness: 0.1,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.9,
      });
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.48, 20), liquidMat);
      liquid.position.y = 0.26;
      liquid.castShadow = true;
      group.add(liquid);

      // Outer glass bottle silhouette (lathe)
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.165, 0.0),
        new THREE.Vector2(0.17, 0.52),
        new THREE.Vector2(0.13, 0.62),
        new THREE.Vector2(0.062, 0.72),
        new THREE.Vector2(0.062, 0.84),
        new THREE.Vector2(0.074, 0.86),
      ];
      const bottleGlass = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), glassMat);
      bottleGlass.renderOrder = 4;
      group.add(bottleGlass);

      // Painted pictorial paper label wrapped around front (ZERO text!)
      const labelTex = createSyrupLabelTexture(def.key);
      const labelMat = new THREE.MeshStandardMaterial({
        map: labelTex,
        roughness: 0.65,
      });
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.173, 0.173, 0.30, 20, 1, true, -Math.PI * 0.42, Math.PI * 0.84),
        labelMat
      );
      label.position.y = 0.28;
      group.add(label);

      // Classic metal kakigori pour spout cap
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.08, 16), chromeMat);
      collar.position.y = 0.88;
      group.add(collar);

      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.16, 12), chromeMat);
      spout.position.set(0, 0.98, 0);
      group.add(spout);

      // Spout tip marker for exact liquid stream origin
      const spoutTip = new THREE.Object3D();
      spoutTip.position.set(0, 1.07, 0);
      group.add(spoutTip);

      // Generous invisible hitbox for small fingers
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 1.15, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.54;
      hit.userData = { interactType: 'syrup', flavor: def.key };
      group.add(hit);
      this.hitMeshes.push(hit);

      this.scene.add(group);
      this.bottles[def.key] = {
        key: def.key,
        group,
        spoutTip,
        homePos: def.pos.clone(),
        targetPos: def.pos.clone(),
        targetRotZ: 0,
        targetRotX: 0,
        wobble: 0,
        autoAnim: null,
        color: def.color,
      };
    }
  }

  _buildMilkBottle() {
    const pos = new THREE.Vector3(1.52, 0, 0.68);
    const group = new THREE.Group();
    group.position.copy(pos);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff8ec,
      roughness: 0.28,
      clearcoat: 0.65,
    });
    const redCapMat = new THREE.MeshPhysicalMaterial({
      color: 0xd93030,
      roughness: 0.22,
      clearcoat: 0.85,
    });

    // Iconic Japanese miniature soft condensed-milk squeeze bottle!
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.155, 0.0),
      new THREE.Vector2(0.175, 0.18),
      new THREE.Vector2(0.165, 0.44),
      new THREE.Vector2(0.11, 0.56),
      new THREE.Vector2(0.075, 0.60),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Pictorial creamy droplet label (zero text!)
    const labelTex = createSyrupLabelTexture('milk');
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.173, 0.173, 0.26, 20, 1, true, -Math.PI * 0.44, Math.PI * 0.88),
      new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55 })
    );
    label.position.y = 0.27;
    group.add(label);

    // Iconic red pointed squeeze nozzle cap
    const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.088, 0.07, 16), redCapMat);
    capBase.position.y = 0.62;
    group.add(capBase);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 14), redCapMat);
    nozzle.position.y = 0.73;
    group.add(nozzle);

    const spoutTip = new THREE.Object3D();
    spoutTip.position.set(0, 0.82, 0);
    group.add(spoutTip);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.92, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.44;
    hit.userData = { interactType: 'milk' };
    group.add(hit);
    this.hitMeshes.push(hit);

    this.scene.add(group);
    this.bottles.milk = {
      key: 'milk',
      group,
      spoutTip,
      homePos: pos.clone(),
      targetPos: pos.clone(),
      targetRotZ: 0,
      targetRotX: 0,
      wobble: 0,
      autoAnim: null,
      color: new THREE.Color(0xfff8e6),
    };
  }

  _buildFruitPlate() {
    this.plateGroup = new THREE.Group();
    this.plateGroup.position.set(0.95, 0, 0.88);
    this.scene.add(this.plateGroup);

    // Cute miniature glazed ceramic saucer
    const ceramicMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf7ef,
      roughness: 0.15,
      clearcoat: 0.85,
    });
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.42, 0.0),
      new THREE.Vector2(0.56, 0.068),
      new THREE.Vector2(0.54, 0.088),
      new THREE.Vector2(0.40, 0.036),
      new THREE.Vector2(0.0, 0.032),
    ];
    const plate = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), ceramicMat);
    plate.castShadow = true;
    plate.receiveShadow = true;
    this.plateGroup.add(plate);

    // Hand-painted coral floral border ring
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.013, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xd95f52, roughness: 0.3 })
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.075;
    this.plateGroup.add(trim);

    // 4 big, juicy, cleanly separated miniature fruits sitting on the plate!
    const defs = [
      { kind: 'strawberry', x: -0.23, z: -0.20, rotY: 0.3, rotX: 0 },
      { kind: 'cherry', x: 0.21, z: -0.19, rotY: -0.4, rotX: 0 },
      { kind: 'mandarin', x: -0.22, z: 0.23, rotY: 0.45, rotX: 0.55 },
      { kind: 'kiwi', x: 0.22, z: 0.21, rotY: -0.2, rotX: 0 },
    ];

    for (const d of defs) {
      const slot = new THREE.Group();
      slot.position.set(d.x, 0.045, d.z);
      const fruitMesh = this.fruitFactory.createFruit(d.kind, 0.92);
      fruitMesh.rotation.set(d.rotX, d.rotY, 0);
      slot.add(fruitMesh);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.12;
      hit.userData = { interactType: 'fruit', fruitKind: d.kind };
      slot.add(hit);
      this.hitMeshes.push(hit);

      this.plateGroup.add(slot);
      this.plateFruits.push({
        kind: d.kind,
        slot,
        mesh: fruitMesh,
        respawnPop: 0,
        wobble: 0,
      });
    }
  }

  _buildPourStream() {
    // Dynamic curved glossy liquid stream pouring from bottle spout into the shaved ice!
    this.streamMat = new THREE.MeshPhysicalMaterial({
      color: 0xe61e3c,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
    this.streamMesh = new THREE.Mesh(new THREE.TubeGeometry(dummyCurve, 12, 0.028, 8, false), this.streamMat);
    this.streamMesh.visible = false;
    this.scene.add(this.streamMesh);

    // Splash droplets at impact
    this.dropGeo = new THREE.SphereGeometry(0.032, 8, 6);
    this.drops = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(this.dropGeo, this.streamMat);
      d.visible = false;
      this.scene.add(d);
      this.drops.push({ mesh: d, phase: i * 1.1 });
    }
  }

  // Responsive counter layout for iPhone portrait vs iPad landscape — ZERO overlapping bottles!
  applyLayout(isPortrait) {
    if (isPortrait) {
      this.bottleRack.position.set(1.16, 0.05, -0.20);
      this.bottleRack.scale.set(0.92, 1, 1);
      this.bottles.strawberry.homePos.set(0.80, 0.10, -0.24);
      this.bottles.lemon.homePos.set(1.16, 0.10, -0.18);
      this.bottles.blue.homePos.set(1.50, 0.10, -0.10);
      this.bottles.milk.homePos.set(-1.02, 0, 1.36);
      this.plateGroup.position.set(0.86, 0, 1.36);
      this.coaster.position.set(0.0, 0.011, 0.44);
    } else {
      this.bottleRack.position.set(1.40, 0.05, -0.26);
      this.bottleRack.scale.set(1.05, 1, 1);
      this.bottles.strawberry.homePos.set(0.98, 0.10, -0.32);
      this.bottles.lemon.homePos.set(1.39, 0.10, -0.25);
      this.bottles.blue.homePos.set(1.80, 0.10, -0.16);
      this.bottles.milk.homePos.set(1.94, 0, 0.62);
      this.plateGroup.position.set(1.12, 0, 0.88);
      this.coaster.position.set(0.08, 0.011, 0.56);
    }
    for (const b of Object.values(this.bottles)) {
      if (!b.autoAnim) {
        b.targetPos.copy(b.homePos);
      }
    }
  }

  showPourStream(startWorld, endWorld, color, isMilk = false) {
    this.streamMat.color.copy(color);
    this.streamMat.opacity = isMilk ? 0.96 : 0.88;
    const mid = startWorld.clone().lerp(endWorld, 0.45);
    mid.y += 0.12;
    const curve = new THREE.QuadraticBezierCurve3(startWorld, mid, endWorld);
    const radius = isMilk ? 0.024 : 0.027;
    this.streamMesh.geometry.dispose();
    this.streamMesh.geometry = new THREE.TubeGeometry(curve, 12, radius, 7, false);
    this.streamMesh.visible = true;

    for (let i = 0; i < this.drops.length; i++) {
      const dr = this.drops[i];
      dr.phase += 0.24;
      const t = (dr.phase % 1);
      const a = i * 1.15 + this.time * 4;
      dr.mesh.visible = true;
      dr.mesh.position.set(
        endWorld.x + Math.cos(a) * t * 0.16,
        endWorld.y + Math.sin(t * Math.PI) * 0.12,
        endWorld.z + Math.sin(a) * t * 0.16
      );
      dr.mesh.scale.setScalar((1 - t) * 0.9);
    }
  }

  hidePourStream() {
    this.streamMesh.visible = false;
    for (const dr of this.drops) dr.mesh.visible = false;
  }

  wobbleBottle(key) {
    const b = this.bottles[key];
    if (b) b.wobble = 0.55;
  }

  wobbleFruit(kind) {
    const pf = this.plateFruits.find((f) => f.kind === kind);
    if (pf) pf.wobble = 0.55;
  }

  popRespawnFruit(kind) {
    const pf = this.plateFruits.find((f) => f.kind === kind);
    if (pf) pf.respawnPop = 1.0;
  }

  ringFurin() {
    this.furinVel += (Math.random() > 0.5 ? 1 : -1) * 5.2;
  }

  // Shop Memory (Discovery 6): Drop a tiny glossy miniature kakigori charm onto the wooden back shelf!
  addKeepsakeCharm(flavorProfile) {
    if (this.keepsakes.length >= 10) return;
    const idx = this.keepsakes.length;
    const charm = new THREE.Group();
    const x = -1.05 + idx * 0.23;
    charm.position.set(x, 0.08, -1.03);

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.042, 0.065, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xdff5fa, roughness: 0.12, clearcoat: 1.0 })
    );
    cup.position.y = 0.035;
    charm.add(cup);

    const colorMap = {
      strawberry: 0xe6203b,
      lemon: 0xf7c914,
      blue: 0x0ea5e9,
      rainbow: 0xf472b6,
      plain: 0xf5faff,
    };
    const col = colorMap[flavorProfile.dominant] || 0xe6203b;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.25, clearcoat: 0.7 })
    );
    dome.position.y = 0.085;
    dome.scale.set(1, flavorProfile.isMega ? 1.45 : 1.0, 1);
    charm.add(dome);

    charm.scale.setScalar(0.01);
    this.scene.add(charm);
    this.keepsakes.push({ mesh: charm, pop: 1.0 });
  }

  update(dt) {
    this.time += dt;

    // Gentle summer breeze on woven linen noren curtains
    for (const p of this.norenPanels) {
      p.pivot.rotation.x = Math.sin(this.time * 1.45 + p.phase) * 0.08 + 0.04;
    }

    // Furin glass wind chime pendulum physics
    const breeze = Math.sin(this.time * 1.9) * 0.25;
    this.furinVel += (-this.furinSwing * 14.0 + breeze) * dt;
    this.furinVel *= Math.exp(-dt * 1.6);
    this.furinSwing += this.furinVel * dt;
    this.furinPivot.rotation.z = this.furinSwing;
    this.furinPivot.rotation.x = Math.sin(this.time * 1.3) * 0.05;

    // Smoothly interpolate bottles back to target positions & wobbles
    for (const b of Object.values(this.bottles)) {
      b.group.position.lerp(b.targetPos, Math.min(1, dt * 11));
      let rz = b.targetRotZ;
      if (b.wobble > 0) {
        b.wobble = Math.max(0, b.wobble - dt);
        rz += Math.sin(b.wobble * 28) * b.wobble * 0.38;
      }
      b.group.rotation.z += (rz - b.group.rotation.z) * Math.min(1, dt * 12);
      b.group.rotation.x += (b.targetRotX - b.group.rotation.x) * Math.min(1, dt * 12);
    }

    // Plate fruit respawn spring pop & gentle wobble
    for (const pf of this.plateFruits) {
      if (pf.respawnPop > 0) {
        pf.respawnPop = Math.max(0, pf.respawnPop - dt * 3.4);
        const s = 1 - pf.respawnPop + Math.sin(pf.respawnPop * Math.PI * 2) * 0.16 * pf.respawnPop;
        pf.mesh.scale.setScalar(Math.max(0.05, s * 1.05));
      } else {
        pf.mesh.scale.setScalar(1.05);
      }
      if (pf.wobble > 0) {
        pf.wobble = Math.max(0, pf.wobble - dt);
        pf.slot.rotation.z = Math.sin(pf.wobble * 26) * pf.wobble * 0.35;
      } else {
        pf.slot.rotation.z = 0;
      }
    }

    // Keepsake souvenir charms pop onto the wooden shelf
    for (const k of this.keepsakes) {
      if (k.pop > 0) {
        k.pop = Math.max(0, k.pop - dt * 2.8);
        const s = 1 - k.pop + Math.sin(k.pop * Math.PI) * 0.35;
        k.mesh.scale.setScalar(Math.max(0.01, s));
      }
    }
  }
}
