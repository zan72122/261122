import * as THREE from '../lib/three.module.js';

// Sculpted organic ingredients with wet PBR clearcoat, cooking states, elastic jiggle & platters
export class IngredientManager {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.items = [];
    this.platters = new THREE.Group();
    this.scene.add(this.platters);
    this.shimeUnlocked = false;
    this.shimeTray = null;

    this._buildPlatters();
    this._spawnInitialIngredients();
  }

  _buildPlatters() {
    const tex = this.textures;

    // Left Platter: Woven Bamboo Zaru (竹ざる) for fresh cut Napa Cabbage, Mushrooms & Winter Yuzu
    const zaruGroup = new THREE.Group();
    zaruGroup.position.set(-0.34, 0.004, 0.21);
    this.zaruGroup = zaruGroup;

    const zaruPoints = [
      new THREE.Vector2(0.0, 0.004),
      new THREE.Vector2(0.115, 0.006),
      new THREE.Vector2(0.148, 0.024),
      new THREE.Vector2(0.155, 0.032),
      new THREE.Vector2(0.146, 0.034),
      new THREE.Vector2(0.112, 0.012),
      new THREE.Vector2(0.0, 0.010),
    ];
    const zaruGeo = new THREE.LatheGeometry(zaruPoints, 40);
    // Planar top UV for crisp bamboo basket weave
    const zp = zaruGeo.attributes.position;
    const zuv = zaruGeo.attributes.uv;
    for (let i = 0; i < zp.count; i++) {
      zuv.setXY(i, zp.getX(i) * 3.2 + 0.5, zp.getZ(i) * 3.2 + 0.5);
    }
    const zaruMat = new THREE.MeshStandardMaterial({
      map: tex.bambooMap,
      normalMap: tex.bambooNormal,
      roughness: 0.62,
    });
    const zaruMesh = new THREE.Mesh(zaruGeo, zaruMat);
    zaruMesh.castShadow = true;
    zaruMesh.receiveShadow = true;
    zaruGroup.add(zaruMesh);

    // Wrapped bamboo rim coil
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.008, 12, 44),
      new THREE.MeshStandardMaterial({ map: tex.bambooMap, color: 0xc9a362, roughness: 0.52 })
    );
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.029;
    rimMesh.castShadow = true;
    zaruGroup.add(rimMesh);
    this.platters.add(zaruGroup);

    // Right Dish: Glossy Dark Indigo/Slate Ceramic Rectangular Dish for Silky Tofu & Carrot/Negi
    const tofuDishGroup = new THREE.Group();
    tofuDishGroup.position.set(0.33, 0.004, 0.215);
    this.tofuDishGroup = tofuDishGroup;

    const dishShape = new THREE.Shape();
    const dw = 0.115, dd = 0.095, dr = 0.028;
    dishShape.moveTo(-dw + dr, -dd);
    dishShape.lineTo(dw - dr, -dd);
    dishShape.quadraticCurveTo(dw, -dd, dw, -dd + dr);
    dishShape.lineTo(dw, dd - dr);
    dishShape.quadraticCurveTo(dw, dd, dw - dr, dd);
    dishShape.lineTo(-dw + dr, dd);
    dishShape.quadraticCurveTo(-dw, dd, -dw, dd - dr);
    dishShape.lineTo(-dw, -dd + dr);
    dishShape.quadraticCurveTo(-dw, -dd, -dw + dr, -dd);

    const dishGeo = new THREE.ExtrudeGeometry(dishShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.007,
    });
    dishGeo.rotateX(Math.PI / 2);
    const dishMat = new THREE.MeshPhysicalMaterial({
      map: tex.donabeMap,
      normalMap: tex.donabeNormal,
      color: 0x2a333d,
      roughness: 0.16,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.position.y = 0.015;
    dishMesh.castShadow = true;
    dishMesh.receiveShadow = true;
    tofuDishGroup.add(dishMesh);
    this.platters.add(tofuDishGroup);
  }

  // Builds individual photorealistic ingredient mesh + wet PBR material
  _createIngredientMesh(type) {
    const tex = this.textures;
    const group = new THREE.Group();
    const mats = [];

    if (type === 'hakusai') {
      // Sculpted curved multi-layered Napa Cabbage cut piece (thick white crunchy stem + crinkled jade leaf)
      const segX = 20, segY = 24;
      const geo = new THREE.PlaneGeometry(0.078, 0.105, segX, segY);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i); // -0.0525 (stem) .. +0.0525 (leaf tip)
        const v = (y + 0.0525) / 0.105;
        const u = x / 0.039; // -1..1

        // Natural tapered base & flared ruffled leaf top
        const widthScale = 0.62 + v * 0.58 + Math.sin(v * Math.PI * 3.0) * 0.08;
        x *= widthScale;

        // U-channel trough along crunchy stem + 3D ruffled waves at leaf edge
        const trough = (1.0 - v * 0.6) * (u * u) * 0.014;
        const arch = Math.sin(v * Math.PI) * 0.012;
        const ruffle = Math.pow(v, 1.5) * Math.pow(Math.abs(u), 1.3) *
          (Math.sin(u * 9.0 + v * 6.0) * 0.007 + Math.cos(u * 15.0 - v * 8.0) * 0.0035);
        const thicknessBump = (1.0 - v * 0.75) * Math.max(0, 1.0 - u * u * 2.2) * 0.006;

        pos.setXYZ(i, x, arch + trough + ruffle + thicknessBump, -y);
      }
      geo.computeVertexNormals();

      // Solidified double-layer feel by adding subtle stem volume underneath
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex.hakusaiMap,
        normalMap: tex.hakusaiNormal,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        sheen: 0.25,
        sheenColor: new THREE.Color(0xefffd8),
        side: THREE.DoubleSide,
      });
      mats.push(mat);
      const leaf1 = new THREE.Mesh(geo, mat);
      leaf1.castShadow = true;
      leaf1.receiveShadow = true;
      group.add(leaf1);

      // Second nestled inner leaf layer for convincing 3D thickness!
      const leaf2 = new THREE.Mesh(geo, mat);
      leaf2.scale.set(0.86, 0.9, 0.88);
      leaf2.position.set(0.003, 0.0065, 0.003);
      leaf2.rotation.y = 0.14;
      leaf2.castShadow = true;
      group.add(leaf2);
      group.scale.setScalar(1.22); // Lush, generous cut hakusai leaves!
      group.rotation.x = 0.16;
    } else if (type === 'tofu') {
      // Beveled soft silky tofu block with real-time jiggle capability
      const w = 0.048, h = 0.036, d = 0.046;
      const geo = new THREE.BoxGeometry(w, h, d, 8, 6, 8);
      const pos = geo.attributes.position;
      const hw = w / 2, hh = h / 2, hd = d / 2, r = 0.0055;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        // Smooth bevel rounding on edges + subtle pillow fullness
        const cx = Math.max(-hw + r, Math.min(hw - r, x));
        const cy = Math.max(-hh + r, Math.min(hh - r, y));
        const cz = Math.max(-hd + r, Math.min(hd - r, z));
        const dx = x - cx, dy = y - cy, dz = z - cz;
        const len = Math.hypot(dx, dy, dz);
        if (len > 0.0001) {
          x = cx + (dx / len) * r;
          y = cy + (dy / len) * r;
          z = cz + (dz / len) * r;
        }
        pos.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();

      const mat = new THREE.MeshPhysicalMaterial({
        map: tex.tofuMap,
        normalMap: tex.tofuNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        color: new THREE.Color(0xfffdf9),
        roughness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        sheen: 0.35,
        sheenColor: new THREE.Color(0xfff1d8),
      });
      mats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    } else if (type === 'shiitake') {
      // Plump glossy Shiitake mushroom with decorative white star knife-cut (花椎茸)
      const capGeo = new THREE.SphereGeometry(0.034, 28, 18);
      const pos = capGeo.attributes.position;
      const uv = capGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const rad = Math.hypot(x, z) / 0.034;
        // Organic slight asymmetry
        const wobble = 1.0 + 0.06 * Math.sin(Math.atan2(z, x) * 3.0);
        x *= wobble;
        z *= wobble;
        if (y >= 0) {
          // Plump dome top with subtle indent along star-cut center
          y = y * 0.56 + 0.004 * (1.0 - rad * rad);
        } else {
          // Rolled-in plump cap rim ("どんこ椎茸" curled lip!)
          y = y * 0.22 - Math.pow(rad, 2.5) * 0.004;
        }
        pos.setXYZ(i, x, y + 0.008, z);
        // Planar top UV so the star cross-cut sits squarely on the cap crown
        uv.setXY(i, (x / (0.036 * wobble)) * 0.48 + 0.5, (z / (0.036 * wobble)) * 0.48 + 0.5);
      }
      capGeo.computeVertexNormals();

      const capMat = new THREE.MeshPhysicalMaterial({
        map: tex.shiitakeMap,
        normalMap: tex.shiitakeNormal,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughness: 0.22,
        clearcoat: 0.96,
        clearcoatRoughness: 0.07,
      });
      mats.push(capMat);
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.castShadow = true;
      capMesh.receiveShadow = true;
      group.add(capMesh);

      // Creamy gill underside + short trimmed stem
      const gillMat = new THREE.MeshStandardMaterial({
        color: 0xe8dcc4,
        roughness: 0.55,
      });
      const gillDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.004, 24), gillMat);
      gillDisc.position.y = 0.003;
      group.add(gillDisc);

      const stemGeo = new THREE.CylinderGeometry(0.007, 0.009, 0.018, 12);
      const stemMesh = new THREE.Mesh(stemGeo, gillMat);
      stemMesh.position.set(0.002, -0.004, 0.001);
      stemMesh.rotation.z = 0.15;
      group.add(stemMesh);
    } else if (type === 'shimeji') {
      // Cluster of 6 organic curved Bunashimeji mushrooms
      const stemMat = new THREE.MeshPhysicalMaterial({
        map: tex.tofuMap,
        color: 0xf4ecdc,
        roughness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
      });
      const capMat = new THREE.MeshPhysicalMaterial({
        map: tex.tofuMap,
        color: 0x8e6b4a,
        roughness: 0.34,
        clearcoat: 0.72,
        clearcoatRoughness: 0.14,
      });
      mats.push(stemMat, capMat);

      const base = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 10), stemMat);
      base.scale.set(1.2, 0.7, 1.1);
      group.add(base);

      const offsets = [
        [0, 0, 0.042, 0, 0],
        [0.012, 0.006, 0.038, 0.32, 0.15],
        [-0.012, 0.005, 0.039, -0.30, 0.12],
        [0.008, -0.011, 0.035, 0.22, -0.28],
        [-0.009, -0.010, 0.036, -0.25, -0.25],
        [0.002, 0.013, 0.033, 0.06, 0.34],
      ];
      offsets.forEach(([ox, oz, len, rx, rz]) => {
        const stalk = new THREE.Group();
        stalk.position.set(ox * 0.5, 0.002, oz * 0.5);
        stalk.rotation.set(rz, 0, -rx);
        const sMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0062, len, 10), stemMat);
        sMesh.position.y = len / 2;
        sMesh.castShadow = true;
        stalk.add(sMesh);

        const cMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 10), capMat);
        cMesh.scale.set(1.0, 0.72, 1.0);
        cMesh.position.y = len + 0.002;
        cMesh.castShadow = true;
        stalk.add(cMesh);
        group.add(stalk);
      });
      group.rotation.x = 0.55;
    } else if (type === 'carrot') {
      // Vivid orange 5-petal Plum Blossom Carrot (花にんじん)
      const flowerShape = new THREE.Shape();
      const petals = 5;
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const lobe = 0.016 + 0.0075 * Math.abs(Math.cos(a * petals * 0.5));
        const x = Math.cos(a) * lobe;
        const y = Math.sin(a) * lobe;
        if (i === 0) flowerShape.moveTo(x, y);
        else flowerShape.lineTo(x, y);
      }
      const cGeo = new THREE.ExtrudeGeometry(flowerShape, {
        depth: 0.008,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.002,
        bevelThickness: 0.002,
      });
      cGeo.rotateX(Math.PI / 2);
      const cMat = new THREE.MeshPhysicalMaterial({
        color: 0xec5318,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
      mats.push(cMat);
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.y = 0.006;
      cMesh.castShadow = true;
      group.add(cMesh);
    } else if (type === 'yuzu') {
      // Fragrant dimpled yellow Winter Yuzu half
      const yGeo = new THREE.SphereGeometry(0.026, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const yMat = new THREE.MeshPhysicalMaterial({
        normalMap: tex.tofuNormal,
        normalScale: new THREE.Vector2(1.4, 1.4),
        color: 0xf4c41c,
        roughness: 0.25,
        clearcoat: 0.95,
        clearcoatRoughness: 0.08,
      });
      const cutMat = new THREE.MeshPhysicalMaterial({
        color: 0xfff3b0,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
      });
      mats.push(yMat, cutMat);
      const peel = new THREE.Mesh(yGeo, yMat);
      peel.rotation.x = Math.PI;
      peel.position.y = 0.018;
      peel.castShadow = true;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.0255, 20), cutMat);
      face.rotation.x = -Math.PI / 2;
      face.position.y = 0.018;
      group.add(peel, face);
    } else if (type === 'udon') {
      // Thick glossy intertwined Sanuki Udon bundle (シメのご褒美!)
      const uMat = new THREE.MeshPhysicalMaterial({
        color: 0xfaf5ea,
        roughness: 0.11,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        sheen: 0.25,
      });
      mats.push(uMat);
      for (let s = 0; s < 5; s++) {
        const pts = [];
        const phase = s * 1.25;
        for (let k = 0; k <= 18; k++) {
          const t = (k / 18) * Math.PI * 2.2;
          const r = 0.016 + 0.018 * Math.sin(t * 1.5 + phase) * 0.6 + (s * 0.003);
          pts.push(new THREE.Vector3(
            Math.cos(t + phase) * r * 1.35,
            0.005 + Math.sin(t * 3.0 + s) * 0.005 + s * 0.0022,
            Math.sin(t + phase) * r
          ));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0042, 8, false), uMat);
        tube.castShadow = true;
        group.add(tube);
      }
    } else if (type === 'mochi') {
      // Toasted white Kiri-Mochi that puffs up big & pillowy in hot broth!
      const mGeo = new THREE.BoxGeometry(0.050, 0.018, 0.036, 8, 6, 8);
      const pos = mGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = x / 0.025, ny = y / 0.009, nz = z / 0.018;
        const round = 1.0 - 0.08 * (nx * nx * nz * nz);
        pos.setXYZ(i, x * round, y, z * round);
      }
      mGeo.computeVertexNormals();
      const mMat = new THREE.MeshPhysicalMaterial({
        map: tex.tofuMap,
        color: 0xfcf9f0,
        roughness: 0.22,
        clearcoat: 0.85,
        clearcoatRoughness: 0.09,
      });
      mats.push(mMat);
      const mMesh = new THREE.Mesh(mGeo, mMat);
      mMesh.castShadow = true;
      group.add(mMesh);

      // Golden-brown toasted puff dome (scales up as it cooks!)
      const puffMat = new THREE.MeshPhysicalMaterial({
        color: 0xf6ebd2,
        roughness: 0.18,
        clearcoat: 0.9,
      });
      const puffDome = new THREE.Mesh(new THREE.SphereGeometry(0.020, 16, 12), puffMat);
      puffDome.scale.set(1.1, 0.08, 0.85);
      puffDome.position.y = 0.008;
      group.add(puffDome);
      group.userData.puffDome = puffDome;
    }

    return { group, mats };
  }

  spawnItem(type, homePos, homeRotY = 0) {
    const { group, mats } = this._createIngredientMesh(type);
    group.position.copy(homePos);
    group.rotation.y = homeRotY;
    this.scene.add(group);

    const item = {
      id: Math.random().toString(36).slice(2),
      type,
      mesh: group,
      mats,
      state: 'tray', // 'tray' | 'held' | 'falling' | 'pot' | 'ladle' | 'bowl'
      homePos: homePos.clone(),
      homeRotY,
      vel: new THREE.Vector3(),
      potAngle: Math.random() * Math.PI * 2,
      potRadius: 0.03 + Math.random() * 0.11,
      cookProgress: 0, // 0 = raw crisp, 1 = tender simmered
      jigglePhase: Math.random() * 10,
      jiggleAmp: 0,
      baseScale: 1.0,
      respawnSlot: { type, homePos: homePos.clone(), homeRotY },
    };
    group.userData.ingredientItem = item;
    this.items.push(item);
    return item;
  }

  _spawnInitialIngredients() {
    // Generous, visually distinct layout on Left Zaru & Right Ceramic Dish (100% inside viewport!)
    // Left Zaru (-0.34, y, 0.21): 3 Napa Cabbage, 2 Star Shiitake, 1 Shimeji cluster, 1 Winter Yuzu
    this.spawnItem('hakusai', new THREE.Vector3(-0.38, 0.032, 0.165), 0.38);
    this.spawnItem('hakusai', new THREE.Vector3(-0.31, 0.036, 0.155), -0.22);
    this.spawnItem('hakusai', new THREE.Vector3(-0.40, 0.034, 0.245), 0.72);

    this.spawnItem('shiitake', new THREE.Vector3(-0.28, 0.028, 0.235), 0.18);
    this.spawnItem('shiitake', new THREE.Vector3(-0.345, 0.030, 0.275), -0.65);
    this.spawnItem('shimeji', new THREE.Vector3(-0.25, 0.026, 0.175), 0.45);

    this.spawnItem('yuzu', new THREE.Vector3(-0.23, 0.012, 0.29), 0.1);

    // Right Ceramic Dish (+0.33, y, 0.215): 3 chunky Silky Tofu cubes + 2 Plum-Blossom Carrots
    this.spawnItem('tofu', new THREE.Vector3(0.285, 0.034, 0.185), 0.08);
    this.spawnItem('tofu', new THREE.Vector3(0.358, 0.034, 0.185), -0.06);
    this.spawnItem('tofu', new THREE.Vector3(0.320, 0.034, 0.250), 0.12);

    this.spawnItem('carrot', new THREE.Vector3(0.388, 0.022, 0.250), 0.3);
    this.spawnItem('carrot', new THREE.Vector3(0.262, 0.022, 0.255), -0.4);
  }

  // Adapts tray X positions smoothly for narrow portrait vs wide landscape screens!
  updateLayoutForAspect(aspect) {
    const isPortrait = aspect < 0.85;
    const targetLeftX = isPortrait ? -0.225 : -0.34;
    const targetLeftZ = isPortrait ? 0.30 : 0.21;
    const targetRightX = isPortrait ? 0.225 : 0.33;
    const targetRightZ = isPortrait ? 0.305 : 0.215;

    const dxL = targetLeftX - this.zaruGroup.position.x;
    const dzL = targetLeftZ - this.zaruGroup.position.z;
    const dxR = targetRightX - this.tofuDishGroup.position.x;
    const dzR = targetRightZ - this.tofuDishGroup.position.z;

    if (Math.abs(dxL) > 0.001 || Math.abs(dzL) > 0.001) {
      this.zaruGroup.position.set(targetLeftX, 0.004, targetLeftZ);
      this.tofuDishGroup.position.set(targetRightX, 0.004, targetRightZ);

      for (const item of this.items) {
        if (item.respawnSlot) {
          const isRight = ['tofu', 'carrot'].includes(item.type);
          item.homePos.x += isRight ? dxR : dxL;
          item.homePos.z += isRight ? dzR : dzL;
          item.respawnSlot.homePos.copy(item.homePos);
          if (item.state === 'tray') {
            item.mesh.position.copy(item.homePos);
          }
        }
      }
    }
  }

  // Unlocks the "Shime" (Udon & Toasted Mochi) reward platter with a celebratory slide-in!
  unlockShimeReward() {
    if (this.shimeUnlocked) return;
    this.shimeUnlocked = true;

    const trayGroup = new THREE.Group();
    trayGroup.position.set(0.0, 0.004, 0.48); // slides in from front-center to (0.0, 0.004, 0.33)
    const lacquerMat = new THREE.MeshPhysicalMaterial({
      color: 0x6e1410,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.115), lacquerMat);
    box.position.y = 0.009;
    box.castShadow = true;
    box.receiveShadow = true;
    trayGroup.add(box);
    this.platters.add(trayGroup);
    this.shimeTray = { group: trayGroup, slideT: 0 };

    this.spawnItem('udon', new THREE.Vector3(-0.048, 0.022, 0.335), 0.1);
    this.spawnItem('mochi', new THREE.Vector3(0.052, 0.026, 0.325), -0.18);
    this.spawnItem('mochi', new THREE.Vector3(0.052, 0.026, 0.365), 0.15);
  }

  // Replenishes empty tray slots gently so open-ended play never runs out!
  checkReplenish() {
    const trayItems = this.items.filter((i) => i.state === 'tray');
    const potOrLadle = this.items.filter((i) => i.state === 'pot' || i.state === 'ladle');
    if (trayItems.length <= 3 && potOrLadle.length <= 5) {
      // Respawn missing classic slots
      const defaults = [
        ['hakusai', -0.04, -0.04, 0.35],
        ['shiitake', 0.06, 0.02, 0.2],
        ['shimeji', 0.08, -0.04, 0.5],
        ['tofu', -0.04, -0.03, 0.08],
        ['tofu', 0.03, 0.03, -0.06],
        ['carrot', 0.05, 0.035, 0.3],
      ];
      for (const [type, ox, oz, rot] of defaults) {
        const baseGroup = ['tofu', 'carrot'].includes(type) ? this.tofuDishGroup : this.zaruGroup;
        const pos = new THREE.Vector3(baseGroup.position.x + ox, type === 'tofu' ? 0.034 : 0.030, baseGroup.position.z + oz);
        const occupied = trayItems.some((it) => it.mesh.position.distanceTo(pos) < 0.045);
        if (!occupied) {
          const spawned = this.spawnItem(type, pos, rot);
          spawned.jiggleAmp = 0.8;
        }
      }
      if (this.shimeUnlocked) {
        const hasUdon = this.items.some((i) => i.type === 'udon' && (i.state === 'tray' || i.state === 'pot'));
        if (!hasUdon) {
          const u = this.spawnItem('udon', new THREE.Vector3(-0.048, 0.022, 0.335), 0.1);
          u.jiggleAmp = 0.7;
        }
      }
    }
  }

  update(dt, elapsed, potSystem) {
    if (this.shimeTray && this.shimeTray.slideT < 1) {
      this.shimeTray.slideT = Math.min(1, this.shimeTray.slideT + dt * 2.2);
      const ease = 1 - Math.pow(1 - this.shimeTray.slideT, 3);
      this.shimeTray.group.position.z = 0.48 + (0.34 - 0.48) * ease;
    }

    const potPos = potSystem.potCenter;
    const brothY = potSystem.brothSurfaceY;
    const boil = potSystem.boilLevel;
    const swirlVel = potSystem.swirlAngularVel;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];

      // Elastic jiggle decay (especially luscious on tofu & mochi!)
      if (it.jiggleAmp > 0.001) {
        it.jigglePhase += dt * (it.type === 'tofu' ? 28 : 20);
        it.jiggleAmp *= Math.exp(-dt * 4.5);
        const sq = 1 + Math.sin(it.jigglePhase) * 0.14 * it.jiggleAmp;
        const inv = 1 / Math.sqrt(sq);
        it.mesh.scale.set(it.baseScale * inv, it.baseScale * sq, it.baseScale * inv);
      } else {
        it.mesh.scale.setScalar(it.baseScale);
      }

      if (it.state === 'falling') {
        it.vel.y -= 4.8 * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
        it.mesh.rotation.x += dt * 1.4;

        const distXZ = Math.hypot(it.mesh.position.x - potPos.x, it.mesh.position.z - potPos.z);
        if (it.mesh.position.y <= brothY + 0.006) {
          if (distXZ < 0.195 && !potSystem.lidClosed) {
            // Landed in simmering broth!
            it.state = 'pot';
            it.potAngle = Math.atan2(it.mesh.position.z - potPos.z, it.mesh.position.x - potPos.x);
            it.potRadius = Math.min(0.135, distXZ);
            it.jiggleAmp = 1.0;
            potSystem.addSplash(it.mesh.position.x - potPos.x, it.mesh.position.z - potPos.z, 1.0);
            if (it.type === 'yuzu') {
              potSystem.triggerYuzuAroma();
            }
          } else {
            // Softly return to home tray if dropped outside pot
            it.state = 'tray';
            it.mesh.position.copy(it.homePos);
            it.mesh.rotation.set(0, it.homeRotY, 0);
            it.jiggleAmp = 0.6;
          }
        }
      } else if (it.state === 'pot') {
        // Cook faster with higher flame or closed lid!
        const cookRate = (0.095 + boil * 0.18) * (potSystem.lidClosed ? 2.4 : 1.0);
        it.cookProgress = Math.min(1.0, it.cookProgress + dt * cookRate);

        // Orbit with stirring vortex + gentle convection drift
        it.potAngle += (swirlVel * 0.85 + 0.12 * Math.sin(elapsed * 0.7 + i)) * dt;
        const targetR = Math.min(0.132, Math.max(0.025, it.potRadius));

        // Soft separation between ingredients in the pot so they arrange appetizingly!
        for (let j = 0; j < this.items.length; j++) {
          if (i === j) continue;
          const other = this.items[j];
          if (other.state !== 'pot') continue;
          const dx = it.mesh.position.x - other.mesh.position.x;
          const dz = it.mesh.position.z - other.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.001 && d < 0.058) {
            const push = (0.058 - d) * dt * 1.8;
            const nx = (it.mesh.position.x + (dx / d) * push) - potPos.x;
            const nz = (it.mesh.position.z + (dz / d) * push) - potPos.z;
            it.potAngle = Math.atan2(nz, nx);
            it.potRadius = Math.min(0.135, Math.hypot(nx, nz));
          }
        }

        const tx = potPos.x + Math.cos(it.potAngle) * targetR;
        const tz = potPos.z + Math.sin(it.potAngle) * targetR;

        // Buoyancy physics: raw tofu sinks slightly first, then rises & bobs as heated!
        const waveH = potSystem.sampleWaveHeight(tx - potPos.x, tz - potPos.z, elapsed);
        let floatOffset = -0.004;
        if (it.type === 'tofu') {
          floatOffset = -0.012 + it.cookProgress * 0.016 + Math.sin(elapsed * 4.2 + i) * 0.003 * boil;
          it.jiggleAmp = Math.max(it.jiggleAmp, boil * 0.22);
        } else if (it.type === 'hakusai') {
          // Softens and settles tenderly into golden broth
          floatOffset = 0.008 - it.cookProgress * 0.011;
        } else if (it.type === 'mochi') {
          floatOffset = 0.002 + it.cookProgress * 0.006;
          if (it.mesh.userData.puffDome) {
            const puff = 0.08 + Math.pow(it.cookProgress, 1.3) * 1.15;
            it.mesh.userData.puffDome.scale.set(1.15, puff, 0.92);
          }
        } else if (it.type === 'shiitake' || it.type === 'shimeji') {
          floatOffset = 0.003;
        }

        it.mesh.position.x += (tx - it.mesh.position.x) * Math.min(1, dt * 6);
        it.mesh.position.z += (tz - it.mesh.position.z) * Math.min(1, dt * 6);
        it.mesh.position.y = brothY + floatOffset + waveH;

        // Gentle boiling rock
        it.mesh.rotation.x = Math.sin(elapsed * 3.4 + i * 1.7) * (0.06 + boil * 0.10);
        it.mesh.rotation.z = Math.cos(elapsed * 2.9 + i * 2.1) * (0.06 + boil * 0.10);
        it.mesh.rotation.y += swirlVel * 0.35 * dt;

        // Visual cooking transformation (rich warm umami broth absorption & softened sheen!)
        const cp = it.cookProgress;
        if (it.type === 'hakusai') {
          it.mats[0].color.setRGB(1.0 - cp * 0.06, 1.0 - cp * 0.04, 1.0 - cp * 0.22);
          it.mats[0].roughness = 0.24 - cp * 0.12;
          it.baseScale = 1.0 - cp * 0.08;
        } else if (it.type === 'tofu') {
          it.mats[0].color.setRGB(1.0, 0.99 - cp * 0.03, 0.96 - cp * 0.10);
        } else if (it.type === 'shiitake') {
          it.mats[0].color.setRGB(1.0 - cp * 0.18, 1.0 - cp * 0.20, 1.0 - cp * 0.22);
          it.mats[0].roughness = 0.22 - cp * 0.11;
        }
      }
    }
  }
}
