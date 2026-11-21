import * as THREE from '../vendor/three.module.min.js';
import {
  createFeltMaterial,
  createWoodMaterial,
  createQuiltTableMaterial,
  createFoldingMatMaterial,
  createBasketWeaveMaterial,
  create3DStitchLine,
  createCraftButton,
  getStitchMaterial,
} from './textures.js';
import { FAMILY, LAYOUT } from './config.js';
import { FeltFamilyDoll } from './characters.js';

function createRoundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function createEmblemMesh(emblem, colorHex) {
  const mat = createFeltMaterial(colorHex, { seed: 650 });
  if (emblem === 'star') {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.24 : 0.11;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return new THREE.Mesh(g, mat);
  }
  if (emblem === 'flower') {
    const grp = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.024, 12), mat);
      p.position.set(Math.cos(a) * 0.11, 0.012, Math.sin(a) * 0.11);
      grp.add(p);
    }
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12),
      createFeltMaterial('#f8d568', { seed: 651 })
    );
    c.position.y = 0.016;
    grp.add(c);
    return grp;
  }
  // diamond
  const s = new THREE.Shape();
  s.moveTo(0, -0.22);
  s.lineTo(0.18, 0);
  s.lineTo(0, 0.22);
  s.lineTo(-0.18, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

/**
 * Builds the entire sunlit felt-craft room:
 * - Patchwork quilt tabletop & stitched wall with swaying fabric bunting
 * - 3-Bay Chest of Drawers (タンス) with pullable drawers + big wooden button knobs
 * - 3 Felt Family Dolls behind the chest
 * - 3 Color-Coded Stitched Sorting Mats (家族ごとの色の山)
 * - Central Quilted Folding Mat
 * - Left Cloth-Rope Laundry Basket with poking colorful clothes
 * - Right Wooden Trinket Dish & Clothespin Jar
 * - Soft Felt Mitten Idle-Hint Hand
 */
export class CraftRoom {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.dolls = [];
    this.drawers = [];
    this.sortingMats = [];
    this.buntingFlags = [];
    this.basketMounds = [];
    this.trinketItems = [];
    this.collectedPins = [];
    this.basketBounce = 0;
    this.basketBounceVel = 0;
    this.dishBounce = 0;
    this.dishBounceVel = 0;

    this._buildTableAndBackdrop();
    this._buildFoldingMat();
    this._buildChestAndDrawers();
    this._buildFamilyDolls();
    this._buildSortingMats();
    this._buildLaundryBasket();
    this._buildTrinketDish();
    this._buildIdleHintHand();
  }

  _buildTableAndBackdrop() {
    // Large patchwork quilt tabletop (extends cleanly past portrait bottom edge!)
    const tableMat = createQuiltTableMaterial();
    const table = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 16), tableMat);
    table.position.set(0, -0.25, 2.2);
    table.receiveShadow = true;
    this.group.add(table);

    // Cozy warm cream fabric room wall behind the chest
    const wallMat = createFeltMaterial('#f4e8d6', {
      pattern: 'stripe',
      accentHex: '#ecdcc6',
      repeatX: 4,
      repeatY: 2,
      bumpScale: 0.02,
      seed: 1010,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), wallMat);
    wall.position.set(0, 3.6, -4.4);
    wall.receiveShadow = true;
    this.group.add(wall);

    // Warm sunlit window beam patch on the wall (suggests freshly sun-dried laundry!)
    const sunPatchMat = new THREE.MeshBasicMaterial({
      color: '#fff6d6',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.2), sunPatchMat);
    sunPatch.position.set(-2.2, 3.3, -4.35);
    sunPatch.rotation.z = -0.18;
    this.group.add(sunPatch);

    // Fabric bunting garland string across the upper wall — cleanly visible in both 4:3 iPad & iPhone!
    const stringPts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = -5.4 + t * 10.8;
      const sag = Math.sin(t * Math.PI) * 0.34;
      stringPts.push(new THREE.Vector3(x, 3.86 - sag, -4.05));
    }
    const stringCurve = new THREE.CatmullRomCurve3(stringPts);
    const cord = new THREE.Mesh(
      new THREE.TubeGeometry(stringCurve, 24, 0.024, 6, false),
      getStitchMaterial('#c89f74')
    );
    this.group.add(cord);

    // Triangle felt bunting flags in family colors + cream
    const flagColors = ['#f2be35', '#df657a', '#4e84bb', '#f7e7c8', '#79b58e'];
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.24, 0);
    triShape.lineTo(0.24, 0);
    triShape.lineTo(0, -0.42);
    triShape.closePath();
    const flagGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.025, bevelEnabled: false });

    for (let i = 1; i <= 13; i++) {
      const t = i / 14;
      const pos = stringCurve.getPoint(t);
      const flag = new THREE.Mesh(
        flagGeo,
        createFeltMaterial(flagColors[i % flagColors.length], { seed: 1100 + i })
      );
      flag.position.copy(pos);
      flag.userData = { phase: i * 0.7 };
      this.group.add(flag);
      this.buntingFlags.push(flag);
    }
  }

  _buildFoldingMat() {
    const { w, d } = LAYOUT.foldingMatSize;
    const { x, z } = LAYOUT.foldingMatPos;
    const shape = createRoundedRectShape(w, d, 0.24);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 3,
    });
    geo.rotateX(-Math.PI / 2);

    // Normalize top UVs to [0, 1] so quilted diamond texture frames the pad cleanly
    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const pz = posAttr.getZ(i);
      uvAttr.setXY(i, (px + w / 2) / w, (pz + d / 2) / d);
    }
    uvAttr.needsUpdate = true;

    const mat = new THREE.Mesh(geo, createFoldingMatMaterial());
    mat.position.set(x, 0.01, z);
    mat.receiveShadow = true;
    this.group.add(mat);

    // 4 cute wooden craft buttons stitched into the corners of the folding pad!
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const btn = createCraftButton({ radius: 0.105, thickness: 0.04, color: '#cf9259', threadColor: '#fff7ea' });
        btn.position.set(x + sx * (w * 0.44), 0.095, z + sz * (d * 0.42));
        this.group.add(btn);
      }
    }

    // 3D dashed stitch border around folding pad
    const bw = w * 0.46;
    const bd = d * 0.44;
    const stitchLoop = create3DStitchLine(
      [
        [x - bw, 0.09, z - bd],
        [x + bw, 0.09, z - bd],
        [x + bw, 0.09, z + bd],
        [x - bw, 0.09, z + bd],
      ],
      { color: '#c48554', spacing: 0.16, closed: true, scale: 0.95 }
    );
    this.group.add(stitchLoop);
  }

  _buildChestAndDrawers() {
    const woodMat = createWoodMaterial('#d5a571');
    const woodDarkMat = createWoodMaterial('#b58250');
    const chestW = 6.95;
    const chestH = LAYOUT.chestHeight;
    const chestD = LAYOUT.chestDepth;
    const frontZ = LAYOUT.chestFrontZ;
    const centerZ = frontZ - chestD / 2;

    const chestGroup = new THREE.Group();
    this.group.add(chestGroup);

    // Top warm wooden plank overhanging gently
    const topPlank = new THREE.Mesh(new THREE.BoxGeometry(chestW + 0.24, 0.14, chestD + 0.18), woodMat);
    topPlank.position.set(0, chestH - 0.07, centerZ);
    topPlank.castShadow = true;
    topPlank.receiveShadow = true;
    chestGroup.add(topPlank);

    // Bottom plinth
    const basePlank = new THREE.Mesh(new THREE.BoxGeometry(chestW + 0.1, 0.14, chestD + 0.08), woodDarkMat);
    basePlank.position.set(0, 0.07, centerZ);
    basePlank.receiveShadow = true;
    chestGroup.add(basePlank);

    // Back panel
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(chestW, chestH, 0.12), woodDarkMat);
    backPanel.position.set(0, chestH / 2, frontZ - chestD + 0.06);
    backPanel.castShadow = true;
    chestGroup.add(backPanel);

    // 4 vertical dividers (left outer, 2 inner, right outer)
    const divXs = [-3.36, -1.08, 1.08, 3.36];
    for (const dx of divXs) {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.16, chestH - 0.14, chestD), woodMat);
      div.position.set(dx, chestH / 2, centerZ);
      div.castShadow = true;
      div.receiveShadow = true;
      chestGroup.add(div);
    }

    // Stitched quilted runner cloth draped across top of the chest
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(chestW - 0.1, 0.04, chestD - 0.28),
      createFeltMaterial('#faf2e3', { pattern: 'solid', seed: 1201 })
    );
    runner.position.set(0, chestH + 0.02, centerZ);
    runner.receiveShadow = true;
    chestGroup.add(runner);

    // Build 3 pullable felt-faced drawers (one per family member!)
    for (const def of FAMILY) {
      const drawerRoot = new THREE.Group();
      drawerRoot.position.set(def.matX, 0.15, frontZ);
      this.group.add(drawerRoot);

      const dw = 2.02;
      const dh = 1.20;
      const dd = 1.24;

      const feltFrontMat = createFeltMaterial(def.color, {
        pattern: 'solid',
        stitchBorder: false,
        seed: 1300 + def.id * 17,
      });
      const interiorMat = createFeltMaterial(def.colorLight, {
        pattern: 'gingham',
        accentHex: '#fff9ef',
        seed: 1350 + def.id * 17,
      });

      // Drawer front face (padded stitched felt!)
      const frontBox = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.14), feltFrontMat);
      frontBox.position.set(0, dh / 2, -0.05);
      frontBox.castShadow = true;
      frontBox.receiveShadow = true;
      drawerRoot.add(frontBox);

      // 3D stitched border right on the drawer front!
      const bw = dw * 0.43;
      const bh = dh * 0.40;
      drawerRoot.add(
        create3DStitchLine(
          [
            [-bw, dh / 2 - bh, 0.032],
            [bw, dh / 2 - bh, 0.032],
            [bw, dh / 2 + bh, 0.032],
            [-bw, dh / 2 + bh, 0.032],
          ],
          { color: '#fff8ec', spacing: 0.14, closed: true, scale: 0.9 }
        )
      );

      // Cozy quilted drawer interior box (bottom + left/right/back walls)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.16, 0.08, dd), interiorMat);
      floor.position.set(0, 0.08, -dd / 2 - 0.08);
      floor.receiveShadow = true;
      drawerRoot.add(floor);

      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.09, dh * 0.72, dd), woodMat);
      sideL.position.set(-dw / 2 + 0.09, dh * 0.4, -dd / 2 - 0.08);
      drawerRoot.add(sideL);

      const sideR = sideL.clone();
      sideR.position.x = dw / 2 - 0.09;
      drawerRoot.add(sideR);

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.16, dh * 0.72, 0.09), woodMat);
      backWall.position.set(0, dh * 0.4, -dd - 0.04);
      drawerRoot.add(backWall);

      // BIG tactile wooden button handle protruding forward!
      const handlePivot = new THREE.Group();
      handlePivot.position.set(0, dh * 0.54, 0.14);
      drawerRoot.add(handlePivot);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.085, 0.18, 12),
        woodDarkMat
      );
      stem.rotation.x = Math.PI / 2;
      stem.position.z = -0.05;
      handlePivot.add(stem);

      const knob = createCraftButton({
        radius: 0.21,
        thickness: 0.085,
        color: '#e0ab70',
        threadColor: def.color,
      });
      knob.rotation.x = Math.PI / 2;
      knob.position.z = 0.05;
      handlePivot.add(knob);

      // Container for neatly tucked folded bundles inside this drawer!
      const tuckedContainer = new THREE.Group();
      tuckedContainer.position.set(0, 0.15, -dd * 0.5 - 0.06);
      drawerRoot.add(tuckedContainer);

      // Generous invisible collider for tapping/dragging the drawer handle!
      const handleCollider = new THREE.Mesh(
        new THREE.BoxGeometry(dw * 0.96, dh * 1.05, 0.58),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      handleCollider.position.set(0, dh * 0.55, 0.12);
      handleCollider.userData = { kind: 'drawer_handle', familyId: def.id };
      drawerRoot.add(handleCollider);

      // Collider for dropping folded pile into open drawer cavity
      const cavityCollider = new THREE.Mesh(
        new THREE.BoxGeometry(dw * 0.95, dh * 0.85, dd * 1.05),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      cavityCollider.position.set(0, dh * 0.45, -dd * 0.52);
      cavityCollider.userData = { kind: 'drawer_cavity', familyId: def.id };
      drawerRoot.add(cavityCollider);

      this.drawers.push({
        familyId: def.id,
        root: drawerRoot,
        handlePivot,
        tuckedContainer,
        handleCollider,
        cavityCollider,
        state: 'closed', // closed | ajar | open | done
        currentZ: 0,
        targetZ: 0,
        tuckedItems: [],
        pendingTuckCount: 0,
        wiggleTime: 0,
      });
    }
  }

  _buildFamilyDolls() {
    for (const def of FAMILY) {
      const doll = new FeltFamilyDoll(def);
      this.group.add(doll.root);
      this.dolls.push(doll);
    }
  }

  _buildSortingMats() {
    const { w, d } = LAYOUT.sortingMatSize;
    const shape = createRoundedRectShape(w, d, 0.22);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    geo.rotateX(-Math.PI / 2);

    for (const def of FAMILY) {
      const matGroup = new THREE.Group();
      matGroup.position.set(def.matX, 0.01, LAYOUT.sortingMatZ);
      this.group.add(matGroup);

      const pad = new THREE.Mesh(
        geo,
        createFeltMaterial(def.color, { pattern: 'solid', seed: 1500 + def.id * 29 })
      );
      pad.receiveShadow = true;
      pad.castShadow = true;
      matGroup.add(pad);

      // Contrast 3D blanket stitch loop around mat!
      const bw = w * 0.44;
      const bd = d * 0.41;
      matGroup.add(
        create3DStitchLine(
          [
            [-bw, 0.078, -bd],
            [bw, 0.078, -bd],
            [bw, 0.078, bd],
            [-bw, 0.078, bd],
          ],
          { color: '#fff8eb', spacing: 0.14, closed: true, scale: 0.88 }
        )
      );

      // Stitched family emblem centered on mat (visible when empty!)
      const emblem = createEmblemMesh(def.emblem, def.colorLight);
      emblem.position.set(0, 0.075, 0);
      matGroup.add(emblem);

      // Invisible generous touch/drop zone
      const collider = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.15, 0.6, d * 1.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      collider.position.set(0, 0.25, 0);
      collider.userData = { kind: 'sorting_mat', familyId: def.id };
      matGroup.add(collider);

      this.sortingMats.push({
        familyId: def.id,
        group: matGroup,
        pad,
        collider,
        baseX: def.matX,
        baseZ: LAYOUT.sortingMatZ,
        pulse: 0,
      });
    }
  }

  _buildLaundryBasket() {
    this.basketGroup = new THREE.Group();
    this.basketGroup.position.set(LAYOUT.basketPosLandscape.x, 0, LAYOUT.basketPosLandscape.z);
    this.group.add(this.basketGroup);

    const basketMat = createBasketWeaveMaterial();
    // Plump flared woven-cloth basket body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.66, 0.84, 22, 1, false),
      basketMat
    );
    body.position.y = 0.42;
    body.castShadow = true;
    body.receiveShadow = true;
    this.basketGroup.add(body);

    // Rolled thick stitched cloth rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.095, 10, 24),
      createFeltMaterial('#e7caa0', { seed: 1601 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.84;
    rim.castShadow = true;
    this.basketGroup.add(rim);

    // Cute cloth ribbon handles on left & right sides
    const handleMat = createFeltMaterial('#c68856', { seed: 1602 });
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.055, 8, 16, Math.PI),
        handleMat
      );
      handle.position.set(side * 0.84, 0.84, 0);
      handle.rotation.y = Math.PI / 2;
      handle.rotation.x = side * 0.15;
      this.basketGroup.add(handle);
    }

    // Plump colorful felt laundry mounds poking cheerfully out of the basket!
    const moundSpecs = [
      { x: -0.26, y: 0.86, z: -0.14, rx: 0.34, ry: 0.24, rz: 0.30, c: FAMILY[0].color, pat: 'stripe' },
      { x: 0.24, y: 0.90, z: -0.08, rx: 0.36, ry: 0.26, rz: 0.32, c: FAMILY[1].color, pat: 'polka' },
      { x: -0.05, y: 0.88, z: 0.24, rx: 0.38, ry: 0.25, rz: 0.28, c: FAMILY[2].color, pat: 'gingham' },
      { x: 0.16, y: 1.02, z: 0.12, rx: 0.28, ry: 0.22, rz: 0.26, c: FAMILY[0].colorLight, pat: 'solid' },
      { x: -0.22, y: 0.98, z: 0.15, rx: 0.27, ry: 0.20, rz: 0.24, c: FAMILY[1].colorLight, pat: 'waffle' },
      { x: 0.0, y: 1.08, z: -0.18, rx: 0.30, ry: 0.22, rz: 0.26, c: FAMILY[2].colorLight, pat: 'stripe' },
    ];

    moundSpecs.forEach((s, idx) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 14, 10),
        createFeltMaterial(s.c, { pattern: s.pat, accentHex: '#fff8ec', seed: 1620 + idx })
      );
      m.position.set(s.x, s.y, s.z);
      m.scale.set(s.rx, s.ry, s.rz);
      m.rotation.set(0.3 * idx, 0.7 * idx, 0.2 * idx);
      m.castShadow = true;
      m.userData = { baseY: s.y };
      this.basketGroup.add(m);
      this.basketMounds.push(m);
    });

    // Generous basket touch collider
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.85, 1.35, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    col.position.y = 0.65;
    col.userData = { kind: 'basket' };
    this.basketGroup.add(col);
  }

  _buildTrinketDish() {
    this.dishGroup = new THREE.Group();
    this.dishGroup.position.set(LAYOUT.dishPosLandscape.x, 0, LAYOUT.dishPosLandscape.z);
    this.group.add(this.dishGroup);

    const woodMat = createWoodMaterial('#cf965d');
    // Plump wooden craft trinket bowl with cozy sage-green stitched felt cushion liner!
    const bowlOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.52, 0.34, 22),
      woodMat
    );
    bowlOuter.position.y = 0.17;
    bowlOuter.castShadow = true;
    bowlOuter.receiveShadow = true;
    this.dishGroup.add(bowlOuter);

    // Sage-green stitched felt liner so wooden clothespins & red strawberries pop cleanly!
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.56, 0.06, 20),
      createFeltMaterial('#8ab88a', { pattern: 'polka', accentHex: '#d9eed4', seed: 1701 })
    );
    liner.position.y = 0.33;
    liner.receiveShadow = true;
    this.dishGroup.add(liner);

    // Warm thick wooden rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.63, 0.075, 10, 24),
      createWoodMaterial('#bc8147')
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.34;
    rim.castShadow = true;
    this.dishGroup.add(rim);

    // 3D cream stitch circle around the felt cushion liner!
    const stitchPts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      stitchPts.push([Math.cos(a) * 0.48, 0.365, Math.sin(a) * 0.48]);
    }
    this.dishGroup.add(create3DStitchLine(stitchPts, { color: '#fff8ec', spacing: 0.14, scale: 0.8 }));

    // Container for collected treasures & clothespins
    this.trinketContainer = new THREE.Group();
    this.trinketContainer.position.y = 0.36;
    this.dishGroup.add(this.trinketContainer);

    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.72, 0.65, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    col.position.y = 0.32;
    col.userData = { kind: 'dish' };
    this.dishGroup.add(col);
  }

  _buildIdleHintHand() {
    // Soft handmade felt mitten hand — HIDDEN by default, only demonstrates ONCE after 8s idle!
    this.hintHand = new THREE.Group();
    this.hintHand.visible = false;

    const mittenMat = createFeltMaterial('#fff3de', { seed: 1801 });
    const cuffMat = createFeltMaterial('#e6857e', { pattern: 'stripe', accentHex: '#fff8ec', seed: 1802 });

    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.22, 8, 12), mittenMat);
    palm.rotation.x = Math.PI / 2;
    palm.scale.set(1.05, 1.0, 0.55);
    this.hintHand.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.12, 6, 10), mittenMat);
    thumb.position.set(-0.18, -0.02, 0.04);
    thumb.rotation.set(Math.PI / 2, 0, 0.65);
    this.hintHand.add(thumb);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 14), cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.24;
    this.hintHand.add(cuff);

    this.hintHand.position.set(0, 0.7, 1.7);
    this.group.add(this.hintHand);
  }

  setBasketFillCount(remaining) {
    this.basketMounds.forEach((m, idx) => {
      m.visible = idx < Math.min(this.basketMounds.length, Math.max(0, remaining));
    });
  }

  jiggleBasket() {
    this.basketBounceVel = 3.8;
  }

  jiggleDish() {
    this.dishBounceVel = 3.6;
    for (const item of this.trinketItems) {
      item.userData.hopVel = 2.4 + Math.random() * 1.4;
    }
  }

  addTrinket(mesh) {
    const count = this.trinketItems.length;
    const ang = count * 1.9;
    const rad = count === 0 ? 0.0 : Math.min(0.36, 0.16 + (count % 4) * 0.07);
    mesh.position.set(Math.cos(ang) * rad, 0.08 + Math.floor(count / 5) * 0.09, Math.sin(ang) * rad);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.hopY = 0;
    mesh.userData.hopVel = 2.8;
    this.trinketContainer.add(mesh);
    this.trinketItems.push(mesh);
    this.dishBounceVel = 2.8;
  }

  setDrawerState(familyId, state) {
    const d = this.drawers[familyId];
    if (!d) return;
    d.state = state;
    if (state === 'closed' || state === 'done') d.targetZ = 0;
    else if (state === 'ajar') d.targetZ = LAYOUT.drawerAjarZ;
    else if (state === 'open') d.targetZ = LAYOUT.drawerOpenZ;
  }

  setPortraitLayout(isPortrait) {
    const bp = isPortrait ? LAYOUT.basketPosPortrait : LAYOUT.basketPosLandscape;
    const dp = isPortrait ? LAYOUT.dishPosPortrait : LAYOUT.dishPosLandscape;
    this.basketGroup.position.x = bp.x;
    this.basketGroup.position.z = bp.z;
    this.dishGroup.position.x = dp.x;
    this.dishGroup.position.z = dp.z;
  }

  update(dt, elapsed, focusWorldPos) {
    // Gentle breeze swaying felt bunting flags
    for (const f of this.buntingFlags) {
      f.rotation.x = Math.sin(elapsed * 1.9 + f.userData.phase) * 0.08;
    }

    // Update drawers smooth sliding & ajar handle invite wiggle
    for (const d of this.drawers) {
      d.currentZ += (d.targetZ - d.currentZ) * Math.min(1, dt * 8.5);
      d.root.position.z = LAYOUT.chestFrontZ + d.currentZ;

      if (d.state === 'ajar') {
        d.wiggleTime += dt;
        // Subtle tactile knob wiggle inviting a pull!
        const w = Math.sin(elapsed * 6.5 + d.familyId) * 0.14;
        d.handlePivot.rotation.z = w;
        const s = 1.0 + Math.sin(elapsed * 5.0) * 0.06;
        d.handlePivot.scale.setScalar(s);
      } else {
        d.handlePivot.rotation.z *= 0.85;
        d.handlePivot.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 8));
      }
    }

    // Sorting mat subtle pulse feedback
    for (const m of this.sortingMats) {
      if (m.pulse > 0) {
        m.pulse = Math.max(0, m.pulse - dt * 2.5);
        const s = 1 + Math.sin(m.pulse * Math.PI) * 0.08;
        m.group.scale.set(s, 1, s);
      } else {
        m.group.scale.set(1, 1, 1);
      }
    }

    // Basket spring bounce
    this.basketBounceVel += (-35 * this.basketBounce - 6 * this.basketBounceVel) * dt;
    this.basketBounce += this.basketBounceVel * dt;
    const bs = 1 + this.basketBounce * 0.06;
    this.basketGroup.scale.set(bs, 1 / Math.sqrt(Math.max(0.7, bs)), bs);
    this.basketMounds.forEach((m, i) => {
      if (m.visible) {
        m.position.y = m.userData.baseY + Math.max(0, this.basketBounce) * (0.08 + i * 0.015);
      }
    });

    // Dish spring bounce & trinket hops
    this.dishBounceVel += (-35 * this.dishBounce - 6 * this.dishBounceVel) * dt;
    this.dishBounce += this.dishBounceVel * dt;
    const ds = 1 + this.dishBounce * 0.06;
    this.dishGroup.scale.set(ds, 1, ds);

    for (const item of this.trinketItems) {
      if (item.userData.hopY > 0 || item.userData.hopVel > 0) {
        item.userData.hopVel -= 14 * dt;
        item.userData.hopY += item.userData.hopVel * dt;
        if (item.userData.hopY <= 0) {
          item.userData.hopY = 0;
          item.userData.hopVel = 0;
        }
        item.position.y = item.userData.baseY + item.userData.hopY;
        item.rotation.y += dt * 3.5;
      }
    }

    // Update all 3 felt family dolls
    for (const doll of this.dolls) {
      doll.update(dt, elapsed, focusWorldPos);
    }
  }
}
