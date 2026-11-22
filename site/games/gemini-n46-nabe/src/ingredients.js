import * as THREE from 'three';
import {
  createCabbageTextures,
  createTofuTextures,
  createShiitakeTextures,
  createPlatterWoodTextures,
} from './textures.js';

/**
 * Builds the large Hinoki wooden platter and photorealistic sculpted 3D nabe ingredients:
 * - 白菜 (Napa Cabbage): ruffled curved leaves with crisp ivory midrib & veined green margin
 * - 豆腐 (Silken Tofu): subtly beveled blocks with cloth-imprint PBR & gelatinous wobble physics
 * - しいたけ (Star-cut Shiitake): dark umber cap with decorative 花切り star cut & ribbed underside gills
 * - しめじ (Shimeji cluster): organic cluster of slender stalks & glossy amber caps
 *
 * Each piece transitions smoothly from raw -> glossy wet broth-soaked simmered PBR as it cooks!
 */
export function createIngredientSystem(scene) {
  const root = new THREE.Group();

  const cabbageTex = createCabbageTextures();
  const tofuTex = createTofuTextures();
  const shiitakeTex = createShiitakeTextures();
  const platterTex = createPlatterWoodTextures();

  // =========================================================================
  // 1. Large Hinoki Cypress Wooden Platter (具材の大皿) — Foreground-Left (HUGE & visible on Frame 1!)
  // =========================================================================
  const PLATTER_POS = new THREE.Vector3(-0.24, 0.0, 0.25);
  const platterGroup = new THREE.Group();
  platterGroup.position.copy(PLATTER_POS);
  platterGroup.rotation.y = 0.22;

  const platterMat = new THREE.MeshPhysicalMaterial({
    map: platterTex.map,
    normalMap: platterTex.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.44,
    clearcoat: 0.25,
    clearcoatRoughness: 0.42,
  });

  // Shallow oval-ish handcrafted wooden tray (sculpted bevel)
  const trayBase = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.138, 0.016, 40), platterMat);
  trayBase.scale.set(1.24, 1.0, 0.84);
  trayBase.position.y = 0.008;
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  trayBase.name = 'ingredientPlatter';
  platterGroup.add(trayBase);

  const trayRim = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.0085, 12, 48), platterMat);
  trayRim.rotation.x = Math.PI / 2;
  trayRim.scale.set(1.24, 0.84, 1.0);
  trayRim.position.y = 0.018;
  trayRim.castShadow = true;
  trayRim.receiveShadow = true;
  platterGroup.add(trayRim);

  // Subtle authentic bamboo leaf garnish (笹の葉) with veined organic texture lining the platter
  const bamC = document.createElement('canvas');
  bamC.width = 256; bamC.height = 128;
  const bCtx = bamC.getContext('2d');
  const bGrad = bCtx.createLinearGradient(0, 0, 256, 128);
  bGrad.addColorStop(0, '#1e421b');
  bGrad.addColorStop(0.5, '#2f5e27');
  bGrad.addColorStop(1, '#20451c');
  bCtx.fillStyle = bGrad;
  bCtx.fillRect(0, 0, 256, 128);
  bCtx.strokeStyle = 'rgba(130, 180, 95, 0.42)';
  bCtx.lineWidth = 2.5;
  bCtx.beginPath(); bCtx.moveTo(0, 64); bCtx.lineTo(256, 64); bCtx.stroke();
  bCtx.lineWidth = 1.0;
  for (let y = 8; y < 128; y += 7) {
    bCtx.strokeStyle = 'rgba(18, 42, 16, 0.28)';
    bCtx.beginPath(); bCtx.moveTo(0, y); bCtx.lineTo(256, y); bCtx.stroke();
  }
  const bamTex = new THREE.CanvasTexture(bamC);
  bamTex.colorSpace = THREE.SRGBColorSpace;

  const bambooMat = new THREE.MeshPhysicalMaterial({
    map: bamTex,
    roughness: 0.34,
    clearcoat: 0.48,
    clearcoatRoughness: 0.26,
    side: THREE.DoubleSide,
  });
  const bambooGeo = new THREE.PlaneGeometry(0.24, 0.068, 16, 6);
  const bPos = bambooGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const x = bPos.getX(i);
    const y = bPos.getY(i);
    const nx = x / 0.12;
    const taper = Math.pow(Math.max(0.02, 1 - nx * nx), 0.72);
    bPos.setY(i, y * taper);
    bPos.setZ(i, Math.sin(nx * Math.PI) * 0.004 - Math.abs(y) * 0.05);
  }
  bambooGeo.computeVertexNormals();
  const bambooLeaf = new THREE.Mesh(bambooGeo, bambooMat);
  bambooLeaf.rotation.x = -Math.PI / 2;
  bambooLeaf.rotation.z = -0.22;
  bambooLeaf.position.set(-0.015, 0.0195, 0.0);
  bambooLeaf.receiveShadow = true;
  platterGroup.add(bambooLeaf);

  root.add(platterGroup);

  // =========================================================================
  // 2. Sculpted Organic Geometries for Hero Ingredients
  // =========================================================================

  // A) Ruffled Curved Napa Cabbage Leaf (白菜)
  function createCabbageGeometry() {
    const geo = new THREE.PlaneGeometry(0.078, 0.098, 14, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); // -0.039 .. 0.039
      const y = pos.getY(i); // -0.049 (stem) .. 0.049 (leaf tip)
      const nx = x / 0.039;
      const ny = (y + 0.049) / 0.098; // 0 stem -> 1 tip

      // Narrow thick stem at bottom flaring into broad ruffled leaf top
      const widthScale = 0.56 + ny * 0.54;
      const newX = x * widthScale;

      // Natural concave cup curvature along stem + crisp wavy ruffle at leafy tip
      const cupZ = Math.pow(nx, 2) * 0.011 + Math.sin(ny * Math.PI) * 0.008;
      const ruffle = Math.sin(nx * 9.5 + ny * 4.0) * 0.0045 * Math.pow(ny, 1.5);
      const midribBump = Math.exp(-nx * nx * 6.5) * 0.005 * (1 - ny * 0.5);

      pos.setXYZ(i, newX, y, cupZ + ruffle - midribBump);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // B) Subtly Beveled Silken Tofu Block (絹ごし豆腐)
  function createTofuGeometry() {
    const geo = new THREE.BoxGeometry(0.056, 0.036, 0.052, 6, 4, 6);
    const pos = geo.attributes.position;
    const hw = 0.028, hh = 0.018, hd = 0.026;
    const r = 0.0045;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const cx = Math.max(-(hw - r), Math.min(hw - r, x));
      const cy = Math.max(-(hh - r), Math.min(hh - r, y));
      const cz = Math.max(-(hd - r), Math.min(hd - r, z));
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len > 0.0001) {
        const s = r / len;
        pos.setXYZ(i, cx + dx * s, cy + dy * s, cz + dz * s);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  // C) Plump Shiitake Mushroom with Star-Cut Cap + Gills + Stem (花切りしいたけ)
  const cabbageGeo = createCabbageGeometry();
  const tofuGeo = createTofuGeometry();

  // Shiitake dome cap with planar top UV so star-cut aligns cleanly at center!
  function createShiitakeCapGeometry() {
    const geo = new THREE.SphereGeometry(0.034, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Organic slightly uneven mushroom cap height
      const organic = 1.0 + Math.sin(Math.atan2(z, x) * 3.0) * 0.05;
      pos.setXYZ(i, x * organic, y * 0.62, z * organic);
      uv.setXY(i, x / 0.068 + 0.5, z / 0.068 + 0.5);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const shiitakeCapGeo = createShiitakeCapGeometry();
  const shiitakeGillGeo = new THREE.CircleGeometry(0.031, 20);
  const shiitakeStemGeo = new THREE.CylinderGeometry(0.0085, 0.011, 0.022, 12);

  // D) Shimeji Mushroom Cluster (しめじ)
  const shimejiCapGeo = new THREE.SphereGeometry(0.0115, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.68);
  const shimejiStemGeo = new THREE.CylinderGeometry(0.0042, 0.0056, 0.044, 7);

  // E) Flower-Cut Carrot Slice (花にんじん) — iconic sunset-orange Japanese nabe color pop!
  function createCarrotFlowerGeo() {
    const shape = new THREE.Shape();
    const petals = 5;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = 0.020 + Math.cos(a * petals) * 0.0045;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.0085,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.0018,
      bevelSegments: 2,
    });
    geo.center();
    geo.rotateX(Math.PI / 2);
    return geo;
  }
  const carrotGeo = createCarrotFlowerGeo();

  // F) Diagonal-Cut Japanese Leek (長ねぎ)
  const negiOuterGeo = new THREE.CylinderGeometry(0.011, 0.0115, 0.052, 14);
  const negiInnerGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.053, 12);

  // Factory for individual ingredient meshes (each owns its own material clone so cooking state is per-piece!)
  function createIngredientMesh(type) {
    const group = new THREE.Group();
    const mats = [];

    if (type === 'cabbage') {
      const mat = new THREE.MeshPhysicalMaterial({
        map: cabbageTex.map,
        normalMap: cabbageTex.normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughness: 0.46,
        metalness: 0.0,
        clearcoat: 0.35,
        clearcoatRoughness: 0.32,
        sheen: 0.15,
        sheenColor: new THREE.Color(0xeef5cc),
        side: THREE.DoubleSide,
      });
      mats.push(mat);
      const leaf = new THREE.Mesh(cabbageGeo, mat);
      leaf.rotation.x = -Math.PI / 2;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      group.add(leaf);
    } else if (type === 'tofu') {
      const mat = new THREE.MeshPhysicalMaterial({
        map: tofuTex.map,
        normalMap: tofuTex.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughness: 0.24,
        metalness: 0.0,
        clearcoat: 0.88,
        clearcoatRoughness: 0.12,
        sheen: 0.22,
        sheenColor: new THREE.Color(0xfff5e4),
      });
      mats.push(mat);
      const block = new THREE.Mesh(tofuGeo, mat);
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);
    } else if (type === 'shiitake') {
      const capMat = new THREE.MeshPhysicalMaterial({
        map: shiitakeTex.capMap,
        normalMap: shiitakeTex.capNormal,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughness: 0.56,
        metalness: 0.0,
        clearcoat: 0.25,
        clearcoatRoughness: 0.38,
      });
      const gillMat = new THREE.MeshStandardMaterial({
        map: shiitakeTex.gillMap,
        roughness: 0.72,
        side: THREE.DoubleSide,
      });
      const stemMat = new THREE.MeshStandardMaterial({
        color: 0xe6d6bc,
        roughness: 0.68,
      });
      mats.push(capMat, gillMat, stemMat);

      const cap = new THREE.Mesh(shiitakeCapGeo, capMat);
      cap.position.y = 0.004;
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);

      const gill = new THREE.Mesh(shiitakeGillGeo, gillMat);
      gill.rotation.x = Math.PI / 2;
      gill.position.y = 0.002;
      group.add(gill);

      const stem = new THREE.Mesh(shiitakeStemGeo, stemMat);
      stem.position.y = -0.009;
      stem.castShadow = true;
      group.add(stem);
    } else if (type === 'shimeji') {
      const capMat = new THREE.MeshPhysicalMaterial({
        color: 0x8e6340,
        roughness: 0.36,
        clearcoat: 0.48,
        clearcoatRoughness: 0.24,
      });
      const stemMat = new THREE.MeshStandardMaterial({
        color: 0xf4eee2,
        roughness: 0.58,
      });
      mats.push(capMat, stemMat);

      // 5 cute curved shimeji stems clustered together so it's big & unmistakable
      const offsets = [
        [0, 0, 0, 0.06, 1.05],
        [-0.015, 0.012, -0.18, 0.16, 0.94],
        [0.016, 0.010, 0.20, 0.14, 0.92],
        [-0.011, -0.014, -0.14, -0.18, 0.88],
        [0.013, -0.013, 0.16, -0.16, 0.85],
      ];
      for (const [ox, oz, rx, rz, sc] of offsets) {
        const sub = new THREE.Group();
        const st = new THREE.Mesh(shimejiStemGeo, stemMat);
        st.position.y = 0.016 * sc;
        st.scale.setScalar(sc);
        sub.add(st);

        const cp = new THREE.Mesh(shimejiCapGeo, capMat);
        cp.position.y = 0.036 * sc;
        cp.scale.set(sc * 1.12, sc * 0.85, sc * 1.12);
        cp.castShadow = true;
        sub.add(cp);

        sub.position.set(ox, -0.012, oz);
        sub.rotation.set(rz, 0, rx);
        group.add(sub);
      }
    } else if (type === 'carrot') {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xe85a1c,
        roughness: 0.36,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
      });
      mats.push(mat);
      const slice = new THREE.Mesh(carrotGeo, mat);
      slice.castShadow = true;
      slice.receiveShadow = true;
      group.add(slice);
    } else if (type === 'negi') {
      const outerMat = new THREE.MeshPhysicalMaterial({
        color: 0xedf2dc,
        roughness: 0.32,
        clearcoat: 0.62,
        clearcoatRoughness: 0.20,
      });
      const greenTipMat = new THREE.MeshPhysicalMaterial({
        color: 0x4f8c34,
        roughness: 0.35,
        clearcoat: 0.55,
      });
      mats.push(outerMat, greenTipMat);
      const cyl = new THREE.Mesh(negiOuterGeo, outerMat);
      cyl.rotation.z = Math.PI / 2;
      cyl.castShadow = true;
      group.add(cyl);
      const core = new THREE.Mesh(negiInnerGeo, greenTipMat);
      core.rotation.z = Math.PI / 2;
      group.add(core);
    }

    // Generous invisible touch collider so 5yo fingers grab effortlessly
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.name = 'ingredientHit';
    group.add(hit);

    return { group, mats, hit };
  }

  // Platter slot layout (clean, appetizing Japanese arrangement — 9 big pieces on the platter!)
  const platterSlots = [
    // Left stack: 白菜 (3 lush leaves)
    { type: 'cabbage', local: new THREE.Vector3(-0.105, 0.026, -0.015), rot: new THREE.Euler(0.08, 0.35, 0.05) },
    { type: 'cabbage', local: new THREE.Vector3(-0.082, 0.038, 0.025), rot: new THREE.Euler(0.12, 0.18, -0.08) },
    { type: 'cabbage', local: new THREE.Vector3(-0.068, 0.048, -0.028), rot: new THREE.Euler(0.05, 0.55, 0.06) },
    // Center stack: 豆腐 (3 glistening silken blocks)
    { type: 'tofu', local: new THREE.Vector3(0.005, 0.035, 0.028), rot: new THREE.Euler(0, 0.14, 0) },
    { type: 'tofu', local: new THREE.Vector3(0.012, 0.035, -0.034), rot: new THREE.Euler(0, -0.12, 0) },
    { type: 'tofu', local: new THREE.Vector3(0.002, 0.068, -0.004), rot: new THREE.Euler(0.02, 0.28, -0.02) },
    // Right stack: きのこ (2 star-cut shiitake + 2 shimeji clusters)
    { type: 'shiitake', local: new THREE.Vector3(0.095, 0.034, 0.032), rot: new THREE.Euler(0.16, -0.4, 0.12) },
    { type: 'shiitake', local: new THREE.Vector3(0.112, 0.038, -0.026), rot: new THREE.Euler(-0.1, 0.8, -0.15) },
    { type: 'shimeji', local: new THREE.Vector3(0.072, 0.042, -0.046), rot: new THREE.Euler(0.55, 0.3, -0.25) },
    { type: 'shimeji', local: new THREE.Vector3(0.125, 0.040, 0.006), rot: new THREE.Euler(0.42, -0.5, 0.3) },
    // Jewel-like seasonal accents: 花にんじん & 長ねぎ for mouthwatering Japanese nabe photography!
    { type: 'carrot', local: new THREE.Vector3(-0.046, 0.027, 0.068), rot: new THREE.Euler(0.10, 0.4, 0.08) },
    { type: 'carrot', local: new THREE.Vector3(0.048, 0.027, 0.064), rot: new THREE.Euler(-0.08, 1.1, -0.10) },
    { type: 'negi', local: new THREE.Vector3(-0.008, 0.027, -0.078), rot: new THREE.Euler(0.0, 0.22, 0.0) },
  ];

  const items = [];
  let nextId = 1;

  function slotWorldTransform(slot) {
    platterGroup.updateMatrixWorld(true);
    const pos = slot.local.clone().applyMatrix4(platterGroup.matrixWorld);
    const quat = new THREE.Quaternion().setFromEuler(slot.rot);
    const pQuat = new THREE.Quaternion().setFromEuler(platterGroup.rotation);
    quat.premultiply(pQuat);
    return { pos, rot: new THREE.Euler().setFromQuaternion(quat) };
  }

  function spawnOnSlot(slotIdx, popIn = false) {
    const slot = platterSlots[slotIdx];
    const { group, mats, hit } = createIngredientMesh(slot.type);
    const { pos, rot } = slotWorldTransform(slot);

    const item = {
      id: nextId++,
      type: slot.type,
      category: slot.type === 'shimeji' || slot.type === 'shiitake' ? 'mushroom' : slot.type,
      slotIdx,
      mesh: group,
      mats,
      hit,
      state: 'platter', // 'platter' | 'dragging' | 'flying' | 'pot' | 'ladle' | 'pouring' | 'bowl' | 'eaten'
      cooked: 0,        // 0 raw -> 1 fully glossy simmered
      wobble: 0,
      wobblePhase: Math.random() * 6.28,
      // Pot physics
      potRadius: 0.02 + Math.random() * 0.075,
      potAngle: Math.random() * Math.PI * 2,
      potSpin: (Math.random() - 0.5) * 0.35,
      bobPhase: Math.random() * Math.PI * 2,
      // Flight animation
      flyStart: new THREE.Vector3(),
      flyEnd: new THREE.Vector3(),
      flyT: 0,
      flyDur: 0.45,
      flyArc: 0.18,
      onLand: null,
      // Bowl ownership
      bowlOwner: null,
      bowlLocalOffset: new THREE.Vector3(),
      scalePop: popIn ? 0.01 : 1.0,
    };

    group.userData.ingredient = item;
    hit.userData.ingredient = item;
    group.position.copy(pos);
    group.rotation.copy(rot);
    if (popIn) group.scale.setScalar(0.01);

    root.add(group);
    items.push(item);
    return item;
  }

  // Initial full appetizing platter
  for (let i = 0; i < platterSlots.length; i++) {
    spawnOnSlot(i, false);
  }

  scene.add(root);

  function updateCookedMaterial(item) {
    const c = item.cooked;
    if (item.type === 'cabbage') {
      const m = item.mats[0];
      // Raw crisp matte -> wet glossy golden-dashi translucent simmered cabbage
      m.roughness = THREE.MathUtils.lerp(0.46, 0.11, c);
      m.clearcoat = THREE.MathUtils.lerp(0.32, 0.98, c);
      m.clearcoatRoughness = THREE.MathUtils.lerp(0.32, 0.06, c);
      m.color.setRGB(
        THREE.MathUtils.lerp(1.0, 0.96, c),
        THREE.MathUtils.lerp(1.0, 0.94, c),
        THREE.MathUtils.lerp(1.0, 0.78, c)
      );
    } else if (item.type === 'tofu') {
      const m = item.mats[0];
      m.roughness = THREE.MathUtils.lerp(0.24, 0.07, c);
      m.clearcoat = THREE.MathUtils.lerp(0.85, 1.0, c);
      m.clearcoatRoughness = THREE.MathUtils.lerp(0.12, 0.04, c);
      m.color.setRGB(1.0, THREE.MathUtils.lerp(1.0, 0.97, c), THREE.MathUtils.lerp(1.0, 0.89, c));
    } else if (item.type === 'shiitake') {
      const cap = item.mats[0];
      cap.roughness = THREE.MathUtils.lerp(0.56, 0.10, c);
      cap.clearcoat = THREE.MathUtils.lerp(0.22, 0.98, c);
      cap.clearcoatRoughness = THREE.MathUtils.lerp(0.38, 0.06, c);
      cap.color.setRGB(
        THREE.MathUtils.lerp(1.0, 0.84, c),
        THREE.MathUtils.lerp(1.0, 0.78, c),
        THREE.MathUtils.lerp(1.0, 0.72, c)
      );
    } else if (item.type === 'shimeji') {
      const cap = item.mats[0];
      cap.roughness = THREE.MathUtils.lerp(0.36, 0.09, c);
      cap.clearcoat = THREE.MathUtils.lerp(0.45, 0.98, c);
      cap.clearcoatRoughness = THREE.MathUtils.lerp(0.24, 0.05, c);
    } else if (item.type === 'carrot' || item.type === 'negi') {
      const m = item.mats[0];
      m.roughness = THREE.MathUtils.lerp(0.34, 0.08, c);
      m.clearcoat = THREE.MathUtils.lerp(0.55, 1.0, c);
      m.clearcoatRoughness = THREE.MathUtils.lerp(0.22, 0.04, c);
    }
  }

  let refillTimer = 0;

  return {
    root,
    platterGroup,
    trayBase,
    items,
    getPlatterItems() {
      return items.filter((it) => it.state === 'platter');
    },
    getPotItems() {
      return items.filter((it) => it.state === 'pot');
    },
    getHitMeshes() {
      return items.filter((it) => it.state === 'platter').map((it) => it.hit);
    },
    refillPlatter(audio) {
      const occupied = new Set(items.filter((it) => it.state === 'platter').map((it) => it.slotIdx));
      let added = 0;
      for (let i = 0; i < platterSlots.length; i++) {
        if (!occupied.has(i)) {
          spawnOnSlot(i, true);
          added++;
        }
      }
      if (added > 0 && audio) {
        audio.playPickup(true);
      }
      return added;
    },
    launchIntoPot(item, potSystem, audio) {
      item.state = 'flying';
      item.flyStart.copy(item.mesh.position);
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.018 + Math.random() * 0.068;
      item.potAngle = ang;
      item.potRadius = rad;
      item.flyEnd.set(
        potSystem.state.potCenter.x + Math.cos(ang) * rad,
        potSystem.state.potCenter.y + 0.002,
        potSystem.state.potCenter.z + Math.sin(ang) * rad
      );
      item.flyT = 0;
      item.flyDur = 0.42;
      item.flyArc = 0.16;
      item.onLand = () => {
        item.state = 'pot';
        item.wobble = item.type === 'tofu' ? 1.0 : 0.65;
        potSystem.spawnSplash(item.flyEnd.x, item.flyEnd.z, 11, 1.0);
        if (audio) audio.playSplash(item.type === 'tofu' ? 1.1 : 0.9);
      };
    },
    scoopFromPot(maxCount = 2) {
      // Prefer more-cooked and varied pieces from pot
      const inPot = items.filter((it) => it.state === 'pot');
      inPot.sort((a, b) => b.cooked - a.cooked);
      const picked = [];
      const usedCats = new Set();
      for (const it of inPot) {
        if (picked.length >= maxCount) break;
        if (!usedCats.has(it.category) || picked.length === 0) {
          picked.push(it);
          usedCats.add(it.category);
        }
      }
      for (const it of inPot) {
        if (picked.length >= maxCount) break;
        if (!picked.includes(it)) picked.push(it);
      }
      for (const it of picked) {
        it.state = 'ladle';
        it.wobble = 0.7;
      }
      return picked;
    },
    removeEaten(item) {
      item.state = 'eaten';
      root.remove(item.mesh);
      const idx = items.indexOf(item);
      if (idx !== -1) items.splice(idx, 1);
    },
    update(dt, elapsed, potSystem, audio) {
      const potCenter = potSystem.state.potCenter;
      const boil = potSystem.state.boilLevel;
      const swirlVel = potSystem.state.swirlVel;

      // Auto-refill platter gently a couple seconds after it gets very low (< 3 items)
      const onPlatter = items.filter((it) => it.state === 'platter').length;
      if (onPlatter <= 2) {
        refillTimer += dt;
        if (refillTimer > 2.4) {
          refillTimer = 0;
          this.refillPlatter(audio);
        }
      } else {
        refillTimer = 0;
      }

      // Clean up excess old pot pieces only if crazy huge (> 22)
      for (const item of items) {
        // Pop-in animation on platter refill
        if (item.scalePop < 1.0) {
          item.scalePop = Math.min(1.0, item.scalePop + dt * 4.2);
          const ease = 1 - Math.pow(1 - item.scalePop, 3);
          item.mesh.scale.setScalar(ease);
        }

        // Elastic jelly wobble decay (extra juicy on silken tofu!)
        if (item.wobble > 0.005) {
          item.wobble *= Math.exp(-dt * (item.type === 'tofu' ? 3.2 : 5.5));
          const wAmp = item.wobble * (item.type === 'tofu' ? 0.16 : 0.07);
          const s = Math.sin(elapsed * 22.0 + item.wobblePhase) * wAmp;
          item.mesh.scale.set(1 + s, 1 - s * 1.15, 1 + s);
        } else if (item.scalePop >= 1.0 && item.state !== 'bowl') {
          item.mesh.scale.set(1, 1, 1);
        }

        if (item.state === 'flying') {
          item.flyT += dt / item.flyDur;
          const t = Math.min(1, item.flyT);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          item.mesh.position.lerpVectors(item.flyStart, item.flyEnd, ease);
          item.mesh.position.y += Math.sin(t * Math.PI) * item.flyArc;
          item.mesh.rotation.x += dt * 2.8;
          item.mesh.rotation.z += dt * 1.9;
          if (t >= 1 && item.onLand) {
            const cb = item.onLand;
            item.onLand = null;
            cb();
          }
        } else if (item.state === 'pot') {
          // Simmer cooking progression!
          const cookSpeed = (0.09 + boil * 0.24) * (potSystem.state.lidOn ? 1.55 : 1.0);
          if (item.cooked < 1.0) {
            item.cooked = Math.min(1.0, item.cooked + dt * cookSpeed);
            updateCookedMaterial(item);
          }

          // Buoyant floating, convection drift, & swirling vortex inside the donabe
          const orbitSpeed = 0.08 + boil * 0.22 + swirlVel * 0.65;
          item.potAngle += orbitSpeed * dt;
          // Gentle boiling agitation bobbing — keep appetizing cooked pieces peeking cleanly out of broth!
          const bob = Math.sin(elapsed * (3.2 + boil * 6.5) + item.bobPhase) * (0.002 + boil * 0.0055);
          const sinkDepth = item.cooked * 0.003;
          const tx = potCenter.x + Math.cos(item.potAngle) * item.potRadius;
          const tz = potCenter.z + Math.sin(item.potAngle) * item.potRadius;
          const ty = potCenter.y + 0.003 - sinkDepth + bob;

          item.mesh.position.x += (tx - item.mesh.position.x) * Math.min(1, dt * 6);
          item.mesh.position.z += (tz - item.mesh.position.z) * Math.min(1, dt * 6);
          item.mesh.position.y += (ty - item.mesh.position.y) * Math.min(1, dt * 8);

          // Gentle floating tilt
          const targetRx = Math.sin(elapsed * 2.4 + item.bobPhase) * (0.08 + boil * 0.14);
          const targetRz = Math.cos(elapsed * 2.1 + item.bobPhase) * (0.08 + boil * 0.14);
          item.mesh.rotation.x += (targetRx - item.mesh.rotation.x) * Math.min(1, dt * 4);
          item.mesh.rotation.z += (targetRz - item.mesh.rotation.z) * Math.min(1, dt * 4);
          item.mesh.rotation.y += (item.potSpin + swirlVel * 0.4) * dt;
        }
      }

      // Soft repulsion between items floating in the pot so they don't overlap harshly
      const potItems = items.filter((it) => it.state === 'pot');
      for (let i = 0; i < potItems.length; i++) {
        for (let j = i + 1; j < potItems.length; j++) {
          const a = potItems[i];
          const b = potItems[j];
          const dx = b.mesh.position.x - a.mesh.position.x;
          const dz = b.mesh.position.z - a.mesh.position.z;
          const distSq = dx * dx + dz * dz;
          const minD = 0.052;
          if (distSq > 0.00001 && distSq < minD * minD) {
            const d = Math.sqrt(distSq);
            const push = (minD - d) * 0.35;
            const nx = dx / d;
            const nz = dz / d;
            a.mesh.position.x -= nx * push;
            a.mesh.position.z -= nz * push;
            b.mesh.position.x += nx * push;
            b.mesh.position.z += nz * push;
            // Re-sync polar coordinates
            for (const it of [a, b]) {
              const rx = it.mesh.position.x - potCenter.x;
              const rz = it.mesh.position.z - potCenter.z;
              it.potRadius = Math.min(0.086, Math.sqrt(rx * rx + rz * rz));
              it.potAngle = Math.atan2(rz, rx);
            }
          }
        }
      }
    },
  };
}
