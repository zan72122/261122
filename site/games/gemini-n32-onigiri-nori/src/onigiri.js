import * as THREE from '../vendor/three.module.min.js';
import { createWatercolorMaterial, addPencilOutline } from './materials.js';

// Shared geometry builder for morphable 3D Onigiri:
// Smoothly morphs from a fluffy round rice cloud (morph=0) -> plump rounded Japanese triangle (morph=1)
// Also supports a top-corner crescent bite during the picnic reward!
function computeOnigiriVertex(nx, ny, nz, morph, dimple, bite) {
  // Base fluffy sphere radius ~0.82
  const rBase = 0.82;

  // Fluffy warm rice cloud (morph = 0): wider soft warm mound sitting on board
  const roundX = nx * rBase * 1.12;
  let roundY = ny * rBase * 0.78;
  const roundZ = nz * rBase * 0.96;

  // Cozy dimple in the top-center when a filling is tucked into soft rice
  if (dimple > 0.001 && ny > 0.25) {
    const radial = Math.hypot(nx, nz);
    const dip = Math.max(0, 1 - radial / 0.65);
    roundY -= dip * dip * 0.36 * dimple;
  }

  // Plump rounded Japanese triangle onigiri (morph = 1)
  // Using soft triangular profile in XY plane with rounded shoulders & plump Z thickness
  const angle = Math.atan2(ny, nx);
  // 3-lobed rounded triangle modulation (apex at +Y = pi/2)
  const triWave = Math.cos(3 * (angle - Math.PI / 2));
  const triRadius = 0.94 + 0.165 * triWave + 0.025 * Math.cos(6 * (angle - Math.PI / 2));

  // Taper slightly narrower near apex and cozy flat-ish bottom so it sits warmly on the board
  const flatBottom = ny < -0.58 ? 1 - (-0.58 - ny) * 0.28 : 1;
  const triX = nx * triRadius * 1.02;
  const triY = (ny * triRadius * 1.02 + 0.05) * flatBottom;
  // Plump pillowy front/back face (classic hand-squeezed onigiri thickness!)
  const xyDist = Math.min(1, Math.hypot(nx, ny));
  const triZ = nz * (0.64 - 0.12 * xyDist * xyDist);

  let x = THREE.MathUtils.lerp(roundX, triX, morph);
  let y = THREE.MathUtils.lerp(roundY, triY, morph);
  let z = THREE.MathUtils.lerp(roundZ, triZ, morph);

  // Subtle organic rice-grain surface bumpiness (hand-squeezed warmth!)
  const bump =
    0.022 * Math.sin(nx * 15.0 + ny * 11.0) * Math.cos(nz * 13.0 - nx * 9.0) +
    0.014 * Math.sin(ny * 21.0 + nz * 17.0);
  x += nx * bump;
  y += ny * bump;
  z += nz * bump;

  // Picnic bite! Carves a cheerful rounded crescent bite out of the upper-right shoulder
  if (bite > 0.01) {
    const bx = 0.32;
    const by = 0.56;
    const bz = 0.12;
    const d = Math.hypot((x - bx) * 1.05, (y - by) * 1.05, (z - bz) * 0.8);
    if (d < 0.62) {
      const push = (0.62 - d) * 1.18 * bite;
      // Push inward toward center to create an appetizing scalloped bite cavity
      x -= (x - bx * 0.25) * push * 0.72;
      y -= (y - by * 0.2) * push * 0.72;
      z -= (z - bz * 0.1) * push * 0.35;
    }
  }

  return [x, y, z];
}

// Create a crisp curved 3D Nori wrapper that cleanly hugs OUTSIDE the bottom & front/back of the onigiri
function createNoriWrapGeometry() {
  const geo = new THREE.PlaneGeometry(1.06, 2.15, 14, 26);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i); // -0.53..+0.53 (width across onigiri)
    const v = pos.getY(i); // -1.075..+1.075 (wraps back -> bottom -> front)
    const t = v / 1.075; // -1..+1
    const absT = Math.abs(t);
    const signT = t >= 0 ? 1 : -1;

    // Smoothly wrap around flat bottom and straight up front & back faces clear of rice bulge!
    let ry, rz;
    if (absT < 0.36) {
      // Smooth rounded curve under the bottom base
      const a = (t / 0.36) * (Math.PI * 0.5);
      ry = -0.56 - Math.cos(a) * 0.28;
      rz = Math.sin(a) * 0.695;
    } else {
      // Crisp straight-up front & back nori band hugging outside the plump rice cheeks
      const up = (absT - 0.36) / 0.64; // 0..1
      ry = -0.56 + up * 0.68; // rises nicely to y = +0.12
      // Follows gentle pillow curvature of the rice face while staying ~0.06 clear outside!
      rz = signT * (0.695 - up * up * 0.06);
    }

    const rx = u * (1.0 - 0.08 * absT);
    const ripple = Math.sin(u * 12 + v * 5) * 0.006;
    pos.setXYZ(i, rx, ry + ripple, rz + ripple * 0.4);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Onigiri3D {
  constructor(assets) {
    this.assets = assets;
    this.group = new THREE.Group();

    // State
    this.morph = 0; // 0 = fluffy round rice, 1 = triangle onigiri
    this.targetMorph = 0;
    this.dimple = 0;
    this.targetDimple = 0;
    this.bite = 0;
    this.jumboScale = 1.0;

    this.fillings = { ume: false, salmon: false }; // tucked inside
    this.toppings = { ume: false, salmon: false }; // perched on top as crown
    this.sesameCount = 0;
    this.hasNori = false;
    this.noriProgress = 0; // 0 -> 1 wrap animation
    this.hasFace = false;

    // 1. Morphable Rice Body
    const sphere = new THREE.SphereGeometry(1, 28, 22);
    const pos = sphere.attributes.position;
    this.unitNormals = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      this.unitNormals[i * 3] = pos.getX(i);
      this.unitNormals[i * 3 + 1] = pos.getY(i);
      this.unitNormals[i * 3 + 2] = pos.getZ(i);
    }

    this.riceMat = createWatercolorMaterial({
      color: 0xffffff,
      map: assets.rice.map,
      bumpMap: assets.rice.bumpMap,
      bumpScale: 0.032,
      emissive: 0x3b2c1e,
      emissiveIntensity: 0.14
    });

    this.riceMesh = new THREE.Mesh(sphere, this.riceMat);
    this.riceMesh.castShadow = true;
    this.riceMesh.receiveShadow = true;
    this.outlineMesh = addPencilOutline(this.riceMesh, 1.032, 0x6b5040, 0.62);
    this.group.add(this.riceMesh);

    // 2. Filling nestled inside (visible while unshaped in dimple, hidden once squeezed, REVEALED on picnic bite!)
    this.insideGroup = new THREE.Group();
    this.group.add(this.insideGroup);

    this.insideUme = this._makeUmeMesh(0.32);
    this.insideUme.visible = false;
    this.insideGroup.add(this.insideUme);

    this.insideSalmon = this._makeSalmonMesh(0.36);
    this.insideSalmon.visible = false;
    this.insideGroup.add(this.insideSalmon);

    // 3. Top Crown Fillings (when added AFTER shaping -> perches adorably on top!)
    this.topGroup = new THREE.Group();
    this.group.add(this.topGroup);

    this.topUme = this._makeUmeMesh(0.27);
    this.topUme.position.set(0, 0.92, 0.08);
    this.topUme.visible = false;
    this.topGroup.add(this.topUme);

    this.topSalmon = this._makeSalmonMesh(0.31);
    this.topSalmon.position.set(0, 0.92, 0.08);
    this.topSalmon.visible = false;
    this.topGroup.add(this.topSalmon);

    // 4. Sesame-Salt (Gomashio) sprinkles container
    this.sesameGroup = new THREE.Group();
    this.group.add(this.sesameGroup);

    // 5. Crisp Curved Nori Sheet
    const noriGeo = createNoriWrapGeometry();
    const noriMat = createWatercolorMaterial({
      color: 0xffffff,
      map: assets.nori,
      emissive: 0x101c14,
      emissiveIntensity: 0.16,
      side: THREE.DoubleSide
    });
    this.noriMesh = new THREE.Mesh(noriGeo, noriMat);
    this.noriMesh.castShadow = true;
    this.noriMesh.receiveShadow = true;
    this.noriMesh.visible = false;
    addPencilOutline(this.noriMesh, 1.024, 0x1d261e, 0.55);
    this.group.add(this.noriMesh);

    // 6. Optional Adorable Bento Nori Face (appears on 2nd nori wrap, cleanly above the nori band!)
    const faceGeo = new THREE.PlaneGeometry(1.06, 1.06);
    const faceMat = new THREE.MeshBasicMaterial({
      map: assets.bentoFace,
      transparent: true,
      depthWrite: false
    });
    this.faceMesh = new THREE.Mesh(faceGeo, faceMat);
    this.faceMesh.position.set(0, 0.38, 0.66);
    this.faceMesh.visible = false;
    this.group.add(this.faceMesh);

    this.updateGeometry(true);
  }

  _makeUmeMesh(radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const w = 1 + 0.11 * Math.sin(x * 18) * Math.cos(y * 16 + z * 14);
      p.setXYZ(i, x * w, y * w * 0.86, z * w);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      createWatercolorMaterial({
        map: this.assets.umeboshi,
        emissive: 0x4f1018,
        emissiveIntensity: 0.14
      })
    );
    mesh.castShadow = true;
    addPencilOutline(mesh, 1.055, 0x6b222a, 0.65);
    return mesh;
  }

  _makeSalmonMesh(size) {
    const geo = new THREE.BoxGeometry(size * 1.45, size * 0.72, size * 0.96, 4, 3, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      // Soft organic rounded salmon fillet chunk
      const taper = 1 - Math.abs(x) * 0.45;
      p.setXYZ(i, x, y * (0.85 + 0.2 * taper), z * (0.82 + 0.25 * taper));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      createWatercolorMaterial({
        map: this.assets.salmon,
        emissive: 0x522112,
        emissiveIntensity: 0.14
      })
    );
    mesh.castShadow = true;
    addPencilOutline(mesh, 1.055, 0x703926, 0.65);
    return mesh;
  }

  addFilling(kind, asCrown = false) {
    if (asCrown) {
      this.toppings[kind] = true;
      this._refreshFillingsVisibility();
    } else {
      this.fillings[kind] = true;
      if (this.targetMorph < 0.75) {
        this.targetDimple = 1.0;
      }
      this._refreshFillingsVisibility();
    }
  }

  _refreshFillingsVisibility() {
    // Inside fillings are visible while tucked into the unshaped dimple (morph < 0.62)
    // OR dramatically revealed when bitten at the picnic (bite > 0.2)!
    const showInDimple = this.morph < 0.62 && this.bite < 0.1;
    const showInBite = this.bite > 0.2;
    const bothInside = this.fillings.ume && this.fillings.salmon;

    this.insideUme.visible = this.fillings.ume && (showInDimple || showInBite);
    this.insideSalmon.visible = this.fillings.salmon && (showInDimple || showInBite);

    if (showInBite) {
      // Peek right out of the top-right bite crescent!
      if (bothInside) {
        this.insideUme.position.set(0.14, 0.42, 0.16);
        this.insideUme.scale.setScalar(0.85);
        this.insideSalmon.position.set(0.32, 0.28, 0.16);
        this.insideSalmon.scale.setScalar(0.82);
        this.insideSalmon.rotation.set(0.2, 0.4, -0.3);
      } else {
        this.insideUme.position.set(0.22, 0.38, 0.18);
        this.insideUme.scale.setScalar(0.96);
        this.insideSalmon.position.set(0.22, 0.36, 0.18);
        this.insideSalmon.scale.setScalar(0.95);
        this.insideSalmon.rotation.set(0.15, 0.3, -0.2);
      }
    } else if (showInDimple) {
      const sink = this.morph * 0.48;
      if (bothInside) {
        this.insideUme.position.set(-0.18, 0.46 - sink, 0.04);
        this.insideUme.scale.setScalar(0.86);
        this.insideSalmon.position.set(0.2, 0.45 - sink, 0.04);
        this.insideSalmon.scale.setScalar(0.84);
      } else {
        this.insideUme.position.set(0, 0.48 - sink, 0.05);
        this.insideUme.scale.setScalar(0.95);
        this.insideSalmon.position.set(0, 0.47 - sink, 0.05);
        this.insideSalmon.scale.setScalar(0.95);
      }
    }

    // Top crowns
    const bothTop = this.toppings.ume && this.toppings.salmon;
    this.topUme.visible = this.toppings.ume && this.bite < 0.2;
    this.topSalmon.visible = this.toppings.salmon && this.bite < 0.2;
    if (bothTop) {
      this.topUme.position.set(-0.2, 0.88, 0.1);
      this.topSalmon.position.set(0.22, 0.86, 0.1);
    } else {
      this.topUme.position.set(0, 0.94, 0.08);
      this.topSalmon.position.set(0, 0.92, 0.08);
    }
  }

  addSesameBatch() {
    this.sesameCount = Math.min(this.sesameCount + 1, 3);
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x2a2420 });
    const saltMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dotGeo = new THREE.SphereGeometry(0.032, 6, 5);

    for (let i = 0; i < 16; i++) {
      const isBlack = i % 4 !== 0;
      const m = new THREE.Mesh(dotGeo, isBlack ? blackMat : saltMat);
      // Place mostly on visible front & upper surfaces
      const theta = (Math.random() - 0.5) * 1.9;
      const phi = (Math.random() - 0.35) * 1.4;
      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.sin(phi) + 0.12;
      const nz = Math.abs(Math.cos(theta) * Math.cos(phi));
      const len = Math.hypot(nx, ny, nz) || 1;
      m.userData.dir = [nx / len, ny / len, nz / len];
      m.scale.set(isBlack ? 1.25 : 0.85, isBlack ? 0.72 : 0.85, 0.65);
      m.rotation.z = Math.random() * Math.PI;
      this.sesameGroup.add(m);
    }
    this._repositionSesame();
  }

  _repositionSesame() {
    for (const m of this.sesameGroup.children) {
      const [nx, ny, nz] = m.userData.dir;
      const [x, y, z] = computeOnigiriVertex(nx, ny, nz, this.morph, this.dimple, this.bite);
      m.position.set(x * 1.015, y * 1.015, z * 1.015);
      // Hide dots carved away by bite
      if (this.bite > 0.2 && x > 0.05 && y > 0.25) {
        m.visible = false;
      }
    }
  }

  wrapNori() {
    if (!this.hasNori) {
      this.hasNori = true;
      this.noriMesh.visible = true;
      this.noriProgress = 0.01;
      return 'wrap';
    } else if (!this.hasFace) {
      this.hasFace = true;
      this.faceMesh.visible = true;
      this.faceMesh.scale.setScalar(0.01);
      return 'face';
    }
    return 'already';
  }

  applyBite() {
    this.bite = 1.0;
    this.faceMesh.visible = false;
    this.updateGeometry(true);
    this._refreshFillingsVisibility();
  }

  updateGeometry(force = false) {
    if (!force && Math.abs(this.morph - this.targetMorph) < 0.001 && Math.abs(this.dimple - this.targetDimple) < 0.001) {
      return;
    }
    const pos = this.riceMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = this.unitNormals[i * 3];
      const ny = this.unitNormals[i * 3 + 1];
      const nz = this.unitNormals[i * 3 + 2];
      const [x, y, z] = computeOnigiriVertex(nx, ny, nz, this.morph, this.dimple, this.bite);
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    this.riceMesh.geometry.computeVertexNormals();
    this._repositionSesame();
    this._refreshFillingsVisibility();
  }

  tick(dt) {
    let changed = false;
    if (Math.abs(this.morph - this.targetMorph) > 0.001) {
      this.morph += (this.targetMorph - this.morph) * Math.min(1, dt * 8.5);
      changed = true;
    }
    // Fold dimple closed as triangle forms
    if (this.targetMorph > 0.55) this.targetDimple = 0;
    if (Math.abs(this.dimple - this.targetDimple) > 0.001) {
      this.dimple += (this.targetDimple - this.dimple) * Math.min(1, dt * 7);
      changed = true;
    }
    if (changed) this.updateGeometry(true);

    // Smooth nori wrap pop-in
    if (this.hasNori && this.noriProgress < 1) {
      this.noriProgress = Math.min(1, this.noriProgress + dt * 4.5);
      const ease = 1 - Math.pow(1 - this.noriProgress, 3);
      this.noriMesh.scale.set(0.85 + 0.15 * ease, 0.25 + 0.75 * ease, 0.75 + 0.25 * ease);
    }

    // Smooth bento face pop-in
    if (this.hasFace && this.faceMesh.visible && this.faceMesh.scale.x < 1) {
      const next = Math.min(1, this.faceMesh.scale.x + dt * 6);
      this.faceMesh.scale.setScalar(next);
    }
  }

  // Export lightweight recipe snapshot so exact onigiri can sit in basket & appear at picnic!
  exportRecipe() {
    return {
      jumboScale: this.jumboScale,
      fillings: { ...this.fillings },
      toppings: { ...this.toppings },
      sesameCount: this.sesameCount,
      hasNori: this.hasNori,
      hasFace: this.hasFace
    };
  }

  static fromRecipe(assets, recipe) {
    const o = new Onigiri3D(assets);
    o.morph = 1;
    o.targetMorph = 1;
    o.dimple = 0;
    o.targetDimple = 0;
    o.jumboScale = recipe.jumboScale || 1;
    o.fillings = { ...recipe.fillings };
    o.toppings = { ...recipe.toppings };
    if (recipe.hasNori) {
      o.hasNori = true;
      o.noriMesh.visible = true;
      o.noriProgress = 1;
    }
    if (recipe.hasFace) {
      o.hasFace = true;
      o.faceMesh.visible = true;
      o.faceMesh.scale.setScalar(1);
    }
    for (let i = 0; i < (recipe.sesameCount || 0); i++) {
      o.addSesameBatch();
    }
    o.updateGeometry(true);
    o._refreshFillingsVisibility();
    return o;
  }

  dispose() {
    this.riceMesh.geometry.dispose();
    this.riceMat.dispose();
    this.noriMesh.geometry.dispose();
    this.noriMesh.material.dispose();
  }
}
