// Photorealistic 3D Dishes, 3D Food Leftovers, Surfactant/Soak Scrubbing Physics,
// and the Grand Reward Stage (Interactive Strawberry Shortcake Party!).

import * as THREE from 'three';
import { ScrubbableDishSurface } from './textures.js';

function applyPlanarDishUVs(geo, outerRadius) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const inv = 1 / (outerRadius * 2.04);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, 0.5 + x * inv, 0.5 + z * inv);
  }
  uv.needsUpdate = true;
}

export const DISH_RECIPES = [
  {
    id: 'strawberry_plate',
    shape: 'plate',
    radius: 0.78,
    pitchScale: 1.0,
    isGlass: false,
    isOily: false,
    baseColor: '#f8fafc',
    centerTint: '#ffffff',
    rimShade: '#e5ebf2',
    rimStripeColor: '#3b7ddd',
    rimInnerColor: '#8db7f2',
    rimStripeWidth: 13,
    sudsTint: 'rgba(255, 232, 240, 0.80)',
    sudsHex: 0xffe6ee,
    swirlColor: 'rgba(218, 24, 54, 0.78)',
    stains: [
      { x: -0.07, y: -0.03, r: 0.25, innerColor: 'rgba(208,18,48,0.94)', color: 'rgba(235,55,84,0.82)', aspect: 0.88, rot: 0.3 },
      { x: 0.11, y: 0.08, r: 0.22, innerColor: 'rgba(255,248,236,0.97)', color: 'rgba(250,218,212,0.86)', aspect: 0.78, rot: -0.5 },
      { x: -0.15, y: 0.13, r: 0.17, innerColor: 'rgba(242,190,98,0.92)', color: 'rgba(226,165,78,0.78)', aspect: 0.9, rot: 0.8 },
      { x: 0.05, y: -0.15, r: 0.18, innerColor: 'rgba(212,24,58,0.92)', color: 'rgba(242,88,116,0.80)', aspect: 0.84, rot: 0.1 },
    ],
    chunks: [
      { kind: 'cream', x: -0.17, z: -0.08, scale: 1.32, toughness: 1.0 },
      { kind: 'strawberry_half', x: 0.16, z: 0.08, scale: 1.42, toughness: 1.1 },
      { kind: 'cream', x: 0.04, z: -0.21, scale: 1.15, toughness: 1.0 },
      { kind: 'sponge_crumb', x: -0.20, z: 0.19, scale: 1.25, toughness: 0.9 },
      { kind: 'berry_drop', x: 0.22, z: -0.12, scale: 1.20, toughness: 0.9 },
    ],
  },
  {
    id: 'parfait_glass',
    shape: 'glass_bowl',
    radius: 0.70,
    pitchScale: 1.32,
    isGlass: true,
    isOily: true, // Rich cocoa-butter chocolate fudge needs soap surfactant!
    cleanRoughnessByte: 8,
    baseColor: '#e9f6fc',
    centerTint: '#f5fcff',
    rimShade: '#cce6f4',
    oilSmearColor: 'rgba(98, 52, 28, 0.14)',
    sudsTint: 'rgba(246, 232, 224, 0.82)',
    sudsHex: 0xf5e5dc,
    swirlColor: 'rgba(92, 44, 22, 0.72)',
    stains: [
      { x: 0.0, y: 0.02, r: 0.25, innerColor: 'rgba(78,36,16,0.94)', color: 'rgba(112,56,28,0.82)', aspect: 0.92, rot: 0.2 },
      { x: -0.14, y: -0.11, r: 0.18, innerColor: 'rgba(136,34,112,0.88)', color: 'rgba(168,58,138,0.75)', aspect: 0.8, rot: -0.4 },
      { x: 0.15, y: -0.08, r: 0.17, innerColor: 'rgba(255,248,230,0.92)', color: 'rgba(210,175,140,0.76)', aspect: 0.85, rot: 0.6 },
    ],
    chunks: [
      { kind: 'choco_swirl', x: -0.12, z: 0.08, scale: 1.1, toughness: 1.25 },
      { kind: 'choco_swirl', x: 0.16, z: -0.06, scale: 0.95, toughness: 1.2 },
      { kind: 'blueberry', x: -0.05, z: -0.18, scale: 1.15, toughness: 1.0 },
      { kind: 'cream', x: 0.10, z: 0.18, scale: 0.9, toughness: 1.0 },
    ],
  },
  {
    id: 'omurice_bowl',
    shape: 'deep_bowl',
    radius: 0.76,
    pitchScale: 0.88,
    isGlass: false,
    isOily: true,
    baseColor: '#fffbf0',
    centerTint: '#ffffff',
    rimShade: '#f5e8c8',
    rimStripeColor: '#f2a922',
    rimInnerColor: '#ffd166',
    rimStripeWidth: 16,
    oilSmearColor: 'rgba(218, 72, 28, 0.13)',
    sudsTint: 'rgba(255, 240, 222, 0.82)',
    sudsHex: 0xffeed8,
    swirlColor: 'rgba(224, 48, 26, 0.70)',
    stains: [
      { x: -0.04, y: 0.0, r: 0.27, innerColor: 'rgba(218,42,22,0.94)', color: 'rgba(235,84,38,0.84)', aspect: 0.82, rot: -0.2 },
      { x: 0.13, y: 0.11, r: 0.20, innerColor: 'rgba(248,196,42,0.94)', color: 'rgba(240,172,28,0.82)', aspect: 0.9, rot: 0.5 },
      { x: -0.14, y: -0.12, r: 0.18, innerColor: 'rgba(245,182,36,0.90)', color: 'rgba(215,95,32,0.78)', aspect: 0.85, rot: 0.9 },
    ],
    chunks: [
      { kind: 'cheese_blob', x: -0.14, z: 0.06, scale: 1.15, toughness: 1.8 },
      { kind: 'ketchup_dollop', x: 0.12, z: -0.08, scale: 1.1, toughness: 1.1 },
      { kind: 'egg_curd', x: 0.16, z: 0.15, scale: 1.05, toughness: 1.2 },
      { kind: 'cheese_blob', x: -0.04, z: -0.19, scale: 0.95, toughness: 1.7 },
    ],
  },
  {
    id: 'pancake_skillet',
    shape: 'skillet',
    radius: 0.76,
    pitchScale: 0.78,
    isGlass: false,
    isOily: true, // Melted butter & honey glaze + crispy caramelized bits!
    cleanRoughnessByte: 34,
    baseColor: '#35383d',
    centerTint: '#43474d',
    rimShade: '#26292e',
    oilSmearColor: 'rgba(225, 165, 38, 0.16)',
    sudsTint: 'rgba(255, 246, 225, 0.84)',
    sudsHex: 0xfff4dc,
    swirlColor: 'rgba(218, 148, 24, 0.72)',
    stains: [
      { x: 0.0, y: 0.0, r: 0.28, innerColor: 'rgba(235,172,34,0.92)', color: 'rgba(196,122,18,0.82)', aspect: 0.94, rot: 0.0 },
      { x: -0.14, y: 0.10, r: 0.18, innerColor: 'rgba(255,224,112,0.95)', color: 'rgba(232,178,48,0.82)', aspect: 0.85, rot: 0.4 },
      { x: 0.14, y: -0.11, r: 0.18, innerColor: 'rgba(168,88,22,0.92)', color: 'rgba(138,68,16,0.80)', aspect: 0.80, rot: -0.6 },
    ],
    chunks: [
      { kind: 'butter_pat', x: -0.10, z: 0.06, scale: 1.15, toughness: 1.5 },
      { kind: 'caramel_crust', x: 0.18, z: -0.10, scale: 1.1, toughness: 2.2 },
      { kind: 'caramel_crust', x: -0.18, z: -0.14, scale: 1.0, toughness: 2.1 },
      { kind: 'pancake_bit', x: 0.08, z: 0.18, scale: 1.1, toughness: 1.4 },
    ],
  },
];

function create3DFoodChunk(kind, scale = 1.0) {
  const g = new THREE.Group();

  if (kind === 'cream') {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xfffdf7, roughness: 0.22, clearcoat: 0.4 });
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), mat);
    base.scale.set(1.2, 0.65, 1.1);
    g.add(base);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.075, 12), mat);
    tip.position.y = 0.055;
    tip.rotation.z = 0.2;
    g.add(tip);
  } else if (kind === 'strawberry_half') {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xe32240, roughness: 0.14, clearcoat: 0.9 });
    const berry = new THREE.Mesh(new THREE.ConeGeometry(0.088, 0.15, 14), mat);
    berry.rotation.z = Math.PI * 0.46;
    berry.scale.set(1, 1, 0.62);
    berry.position.y = 0.035;
    g.add(berry);
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x35a249, roughness: 0.45 })
    );
    leaf.scale.set(1.4, 0.4, 0.9);
    leaf.position.set(0.07, 0.045, 0);
    g.add(leaf);
  } else if (kind === 'sponge_crumb' || kind === 'pancake_bit') {
    const col = kind === 'pancake_bit' ? 0xc97a2b : 0xf2c45a;
    const crumb = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.068, 1),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.78 })
    );
    crumb.scale.set(1.2, 0.65, 1.0);
    crumb.position.y = 0.03;
    g.add(crumb);
  } else if (kind === 'berry_drop' || kind === 'ketchup_dollop') {
    const col = kind === 'ketchup_dollop' ? 0xd92b18 : 0xd41c4e;
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.08, clearcoat: 1.0 })
    );
    drop.scale.set(1.25, 0.45, 1.1);
    drop.position.y = 0.02;
    g.add(drop);
  } else if (kind === 'choco_swirl') {
    const choco = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.028, 10, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x47210f, roughness: 0.14, clearcoat: 0.85 })
    );
    choco.rotation.x = Math.PI * 0.5;
    choco.position.y = 0.025;
    g.add(choco);
  } else if (kind === 'blueberry') {
    const bb = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: 0x2f2b66, roughness: 0.18, clearcoat: 0.7 })
    );
    bb.position.y = 0.042;
    g.add(bb);
  } else if (kind === 'cheese_blob' || kind === 'egg_curd') {
    const col = kind === 'cheese_blob' ? 0xffb624 : 0xffdb4d;
    const blob = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 14, 10),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.22, clearcoat: 0.65 })
    );
    blob.scale.set(1.35, 0.48, 1.05);
    blob.position.y = 0.025;
    g.add(blob);
  } else if (kind === 'butter_pat') {
    const pat = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.045, 0.11),
      new THREE.MeshPhysicalMaterial({ color: 0xffe875, roughness: 0.18, clearcoat: 0.8 })
    );
    pat.position.y = 0.025;
    pat.rotation.y = 0.35;
    g.add(pat);
  } else if (kind === 'caramel_crust') {
    const crust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.078, 0.032, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a3b10, roughness: 0.55 })
    );
    crust.position.y = 0.018;
    g.add(crust);
  }

  g.scale.setScalar(scale);
  return g;
}

export class DishItem {
  constructor(recipe, woodMat) {
    this.recipe = recipe;
    this.surface = new ScrubbableDishSurface(recipe);
    this.group = new THREE.Group();

    this.soakAmount = 0; // Increases when submerged or rinsed, softening tough cheese/caramel crusts!
    this.wetness = 0.2;
    this.isSparklingClean = false;
    this.isRacked = false;
    this.glintAnim = 0;
    this.oilBeadsVisible = 0;

    this._buildGeometry(woodMat);
    this._buildFoodChunks();
    this._buildOilWaterBeads();
  }

  _buildGeometry(woodMat) {
    const r = this.recipe.radius;
    let profile;
    if (this.recipe.shape === 'plate') {
      profile = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(r * 0.62, 0.005),
        new THREE.Vector2(r * 0.78, 0.045),
        new THREE.Vector2(r * 0.98, 0.115),
        new THREE.Vector2(r * 1.0, 0.105),
        new THREE.Vector2(r * 0.75, 0.015),
        new THREE.Vector2(r * 0.60, -0.032),
        new THREE.Vector2(0.0, -0.032),
      ];
    } else if (this.recipe.shape === 'glass_bowl') {
      profile = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(r * 0.52, 0.01),
        new THREE.Vector2(r * 0.82, 0.16),
        new THREE.Vector2(r * 0.98, 0.30),
        new THREE.Vector2(r * 1.0, 0.285),
        new THREE.Vector2(r * 0.78, 0.12),
        new THREE.Vector2(r * 0.50, -0.045),
        new THREE.Vector2(0.0, -0.045),
      ];
    } else if (this.recipe.shape === 'deep_bowl') {
      profile = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(r * 0.56, 0.015),
        new THREE.Vector2(r * 0.84, 0.18),
        new THREE.Vector2(r * 1.0, 0.25),
        new THREE.Vector2(r * 0.96, 0.22),
        new THREE.Vector2(r * 0.54, -0.04),
        new THREE.Vector2(0.0, -0.04),
      ];
    } else {
      // Skillet pan!
      profile = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(r * 0.80, 0.004),
        new THREE.Vector2(r * 0.94, 0.16),
        new THREE.Vector2(r * 1.0, 0.175),
        new THREE.Vector2(r * 0.96, -0.035),
        new THREE.Vector2(0.0, -0.035),
      ];
    }

    const latheGeo = new THREE.LatheGeometry(profile, this.recipe.isGlass ? 24 : 36);
    applyPlanarDishUVs(latheGeo, r);

    if (this.recipe.isGlass) {
      this.dishMat = new THREE.MeshPhysicalMaterial({
        map: this.surface.colorMap,
        roughnessMap: this.surface.roughnessMap,
        transparent: true,
        opacity: 0.82,
        roughness: 0.10,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        envMapIntensity: 2.1,
      });
    } else {
      this.dishMat = new THREE.MeshPhysicalMaterial({
        map: this.surface.colorMap,
        roughnessMap: this.surface.roughnessMap,
        roughness: this.recipe.shape === 'skillet' ? 0.32 : 0.14,
        metalness: this.recipe.shape === 'skillet' ? 0.42 : 0.02,
        clearcoat: this.recipe.shape === 'skillet' ? 0.65 : 1.0,
        clearcoatRoughness: 0.035,
        envMapIntensity: 1.45,
      });
    }

    this.mesh = new THREE.Mesh(latheGeo, this.dishMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // If skillet, add red enameled outer band + warm wooden handle!
    if (this.recipe.shape === 'skillet') {
      const enamelBand = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 1.005, r * 0.955, 0.17, 32, 1, true),
        new THREE.MeshPhysicalMaterial({ color: 0xd9342b, roughness: 0.14, clearcoat: 0.9 })
      );
      enamelBand.position.y = 0.075;
      this.group.add(enamelBand);

      const ferrule = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.055, 0.14, 12),
        new THREE.MeshStandardMaterial({ color: 0xdde3e8, metalness: 0.9, roughness: 0.15 })
      );
      ferrule.rotation.z = Math.PI * 0.44;
      ferrule.position.set(-r - 0.06, 0.14, 0);
      this.group.add(ferrule);

      const handle = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.052, 0.42, 8, 12),
        woodMat || new THREE.MeshStandardMaterial({ color: 0xb87e4b, roughness: 0.5 })
      );
      handle.rotation.z = Math.PI * 0.44;
      handle.position.set(-r - 0.30, 0.18, 0);
      handle.castShadow = true;
      this.group.add(handle);
    }

    // Invisible generous hit disc for smooth raycasting across the entire dish mouth!
    this.hitDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.22, 20),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitDisc.position.y = 0.08;
    this.group.add(this.hitDisc);
  }

  _buildFoodChunks() {
    this.foodChunks = [];
    (this.recipe.chunks || []).forEach((spec) => {
      const mesh = create3DFoodChunk(spec.kind, spec.scale);
      mesh.position.set(spec.x, 0.018, spec.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(mesh);
      this.foodChunks.push({
        mesh,
        localPos: new THREE.Vector3(spec.x, 0.02, spec.z),
        hp: spec.toughness || 1.0,
        maxHp: spec.toughness || 1.0,
        baseScale: spec.scale || 1.0,
        alive: true,
      });
    });
  }

  _buildOilWaterBeads() {
    // Visual proof of "oil repels plain water!" (hydrophobic water beads forming when rinsed without soap)
    this.oilBeadGroup = new THREE.Group();
    this.oilBeadGroup.visible = false;
    this.group.add(this.oilBeadGroup);

    const beadMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f8ff,
      transparent: true,
      opacity: 0.78,
      roughness: 0.02,
      clearcoat: 1.0,
      envMapIntensity: 2.2,
    });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
      const rad = 0.14 + (i % 3) * 0.14;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), beadMat);
      bead.scale.set(1, 0.58, 1);
      bead.position.set(Math.cos(a) * rad, 0.025, Math.sin(a) * rad);
      this.oilBeadGroup.add(bead);
    }
  }

  worldToDishUV(worldPoint) {
    const local = this.group.worldToLocal(worldPoint.clone());
    const inv = 1 / (this.recipe.radius * 2.04);
    return {
      local,
      u: THREE.MathUtils.clamp(0.5 + local.x * inv, 0.04, 0.96),
      v: THREE.MathUtils.clamp(0.5 + local.z * inv, 0.04, 0.96),
    };
  }

  scrubWorldPoint(worldPoint, soapPower, onChunkPopped) {
    const { local, u, v } = this.worldToDishUV(worldPoint);
    this.surface.scrubAt(u, v, 0.175, soapPower, this.recipe.sudsTint, this.recipe.isOily);

    if (soapPower > 0.08) {
      this.oilBeadsVisible = Math.max(0, this.oilBeadsVisible - 0.35);
      // Dissolve / pop nearby 3D food chunks!
      const soakBonus = 1 + this.soakAmount * 1.4;
      this.foodChunks.forEach((ch) => {
        if (!ch.alive) return;
        const dist = Math.hypot(local.x - ch.localPos.x, local.z - ch.localPos.z);
        if (dist < 0.34) {
          ch.hp -= (0.42 + soapPower * 0.55) * soakBonus;
          ch.mesh.rotation.z = (Math.random() - 0.5) * 0.25;
          const ratio = Math.max(0.15, ch.hp / ch.maxHp);
          ch.mesh.scale.setScalar(ch.baseScale * ratio);
          if (ch.hp <= 0) {
            ch.alive = false;
            ch.mesh.visible = false;
            if (onChunkPopped) {
              const wp = ch.localPos.clone();
              this.group.localToWorld(wp);
              onChunkPopped(wp, ch.maxHp > 1.6);
            }
          }
        }
      });
    } else if (this.recipe.isOily) {
      // Rubbing oily dish without soap jiggles chunks slightly without dissolving them
      this.foodChunks.forEach((ch) => {
        if (!ch.alive) return;
        const dist = Math.hypot(local.x - ch.localPos.x, local.z - ch.localPos.z);
        if (dist < 0.26) {
          ch.mesh.rotation.z = Math.sin(performance.now() * 0.03) * 0.18;
        }
      });
    }
    return local;
  }

  rinseWorldPoint(worldPoint, strength = 1.0) {
    const { u, v } = this.worldToDishUV(worldPoint);
    this.wetness = Math.min(1, this.wetness + 0.12);
    this.soakAmount = Math.min(1, this.soakAmount + 0.04 * strength);

    // If oily dish still has heavy grease and NO suds, water beads up visibly!
    if (this.recipe.isOily && this.surface.dirtRatio > 0.45 && this.surface.sudsRatio < 0.05) {
      this.oilBeadsVisible = Math.min(1, this.oilBeadsVisible + 0.25);
    } else {
      this.oilBeadsVisible = Math.max(0, this.oilBeadsVisible - 0.18);
    }

    this.surface.rinseAt(u, v, 0.22, strength);
  }

  checkCleanStatus(remaining3DSuds) {
    // Auto-pop any tiny leftover food chunk once 86%+ of dish surface has been scrubbed with soap!
    if (this.surface.dirtRatio < 0.14) {
      this.foodChunks.forEach((c) => {
        if (c.alive) {
          c.alive = false;
          c.mesh.visible = false;
        }
      });
    }
    const aliveChunks = this.foodChunks.filter((c) => c.alive).length;
    if (
      !this.isSparklingClean &&
      aliveChunks === 0 &&
      this.surface.dirtRatio < 0.14 &&
      this.surface.sudsRatio < 0.12 &&
      remaining3DSuds <= 8
    ) {
      this.surface.snapSparklingClean();
      this.oilBeadsVisible = 0;
      this.isSparklingClean = true;
      this.glintAnim = 1.0;
      return true;
    }
    return false;
  }

  update(dt, elapsed) {
    if (this.oilBeadsVisible > 0.05) {
      this.oilBeadGroup.visible = true;
      this.oilBeadGroup.scale.setScalar(0.85 + Math.sin(elapsed * 8) * 0.05);
      this.oilBeadsVisible = Math.max(0, this.oilBeadsVisible - dt * 0.22);
    } else {
      this.oilBeadGroup.visible = false;
    }

    if (this.glintAnim > 0) {
      this.glintAnim = Math.max(0, this.glintAnim - dt * 1.4);
    }

    // Extra glossy wet sheen when clean!
    if (this.isSparklingClean) {
      this.dishMat.envMapIntensity = 1.95 + Math.sin(elapsed * 4) * 0.22;
      this.dishMat.clearcoatRoughness = 0.015;
    }
  }

  dispose() {
    this.surface.dispose();
  }
}

/**
 * Grand Reward Stage: Interactive Strawberry Shortcake & Fruit Dessert Party!
 * Lets the child place big glossy strawberries & cake onto her freshly washed sparkling plate
 * and feed/serve them to the delighted Helper Girl!
 */
export class PartyDessertSet {
  constructor(scene, woodMat) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    this.active = false;
    this.eatenCount = 0;
    this.treats = [];

    this._buildSet(woodMat);
  }

  _buildSet(woodMat) {
    // Sparkling clean hero white porcelain cake plate in center!
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.015,
      envMapIntensity: 2.0,
    });
    this.heroPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.50, 0.07, 36), plateMat);
    this.heroPlate.position.set(0.24, 0.12, 0.26);
    this.heroPlate.castShadow = true;
    this.heroPlate.receiveShadow = true;
    this.root.add(this.heroPlate);

    const blueRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.61, 0.016, 10, 36),
      new THREE.MeshStandardMaterial({ color: 0x3b7ddd, roughness: 0.2 })
    );
    blueRim.rotation.x = Math.PI * 0.5;
    blueRim.position.set(0.24, 0.158, 0.26);
    this.root.add(blueRim);

    // Wooden Serving Tray on left holding big juicy strawberries & shortcake!
    this.servingTray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.54, 0.05, 28),
      woodMat
    );
    this.servingTray.position.set(-0.86, 0.11, 0.26);
    this.servingTray.castShadow = true;
    this.servingTray.receiveShadow = true;
    this.root.add(this.servingTray);

    // Build 5 large, irresistible 3D treats!
    const treatDefs = [
      { kind: 'shortcake_base', home: new THREE.Vector3(-0.86, 0.24, 0.16), plateSlot: new THREE.Vector3(0.24, 0.25, 0.26) },
      { kind: 'strawberry', home: new THREE.Vector3(-1.12, 0.22, 0.44), plateSlot: new THREE.Vector3(0.24, 0.46, 0.24) },
      { kind: 'strawberry', home: new THREE.Vector3(-0.62, 0.22, 0.46), plateSlot: new THREE.Vector3(0.02, 0.24, 0.38) },
      { kind: 'cream_rosette', home: new THREE.Vector3(-1.08, 0.21, -0.04), plateSlot: new THREE.Vector3(0.46, 0.23, 0.36) },
      { kind: 'berry_macaron', home: new THREE.Vector3(-0.60, 0.21, -0.02), plateSlot: new THREE.Vector3(0.38, 0.22, 0.06) },
    ];

    treatDefs.forEach((def) => {
      const mesh = this._createBigTreatMesh(def.kind);
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      mesh.add(hit);
      this.root.add(mesh);
      this.treats.push({
        kind: def.kind,
        mesh,
        hit,
        home: def.home.clone(),
        plateSlot: def.plateSlot.clone(),
        targetPos: def.home.clone(),
        state: 'tray', // 'tray' | 'plated' | 'eaten'
      });
    });
  }

  _createBigTreatMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'shortcake_base') {
      // Large wedge/round golden sponge cake layered with snowy whipped cream!
      const spongeMat = new THREE.MeshStandardMaterial({ color: 0xf6ca65, roughness: 0.68 });
      const creamMat = new THREE.MeshPhysicalMaterial({ color: 0xfffef9, roughness: 0.2, clearcoat: 0.4 });
      const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 24), spongeMat);
      g.add(bottom);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.055, 24), creamMat);
      mid.position.y = 0.07;
      g.add(mid);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.085, 24), spongeMat);
      top.position.y = 0.14;
      g.add(top);
      const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 24), creamMat);
      icing.position.y = 0.19;
      g.add(icing);
    } else if (kind === 'strawberry') {
      // Huge, plump, glossy red strawberry with golden seeds & green calyx!
      const berryMat = new THREE.MeshPhysicalMaterial({
        color: 0xe61c3c,
        roughness: 0.11,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.7,
      });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.25, 18), berryMat);
      body.position.y = 0.06;
      body.castShadow = true;
      g.add(body);
      const baseRound = new THREE.Mesh(new THREE.SphereGeometry(0.142, 16, 12), berryMat);
      baseRound.scale.y = 0.65;
      baseRound.position.y = -0.03;
      g.add(baseRound);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2ea344, roughness: 0.42 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), leafMat);
        leaf.scale.set(1.5, 0.35, 0.8);
        leaf.rotation.y = a;
        leaf.position.set(Math.cos(a) * 0.06, -0.08, Math.sin(a) * 0.06);
        g.add(leaf);
      }
      // Flip right-side up (broad base down, tip up!)
      g.children.forEach((c) => { c.position.y += 0.05; });
    } else if (kind === 'cream_rosette') {
      const creamMat = new THREE.MeshPhysicalMaterial({ color: 0xfffdf8, roughness: 0.18, clearcoat: 0.5 });
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), creamMat);
      b1.scale.y = 0.68;
      g.add(b1);
      const b2 = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.14, 14), creamMat);
      b2.position.y = 0.09;
      g.add(b2);
    } else {
      // Pink Raspberry Macaron!
      const macMat = new THREE.MeshPhysicalMaterial({ color: 0xf7749b, roughness: 0.26, clearcoat: 0.55 });
      const fillMat = new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.3 });
      const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.145, 0.05, 20), macMat);
      s1.position.y = -0.03;
      g.add(s1);
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.035, 20), fillMat);
      g.add(fill);
      const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.14, 0.05, 20), macMat);
      s2.position.y = 0.03;
      g.add(s2);
    }
    return g;
  }

  startParty() {
    this.active = true;
    this.eatenCount = 0;
    this.root.visible = true;
    this.treats.forEach((t) => {
      t.state = 'tray';
      t.mesh.visible = true;
      t.mesh.scale.setScalar(1);
      t.mesh.position.copy(t.home).add(new THREE.Vector3(0, 0.6, 0));
      t.targetPos.copy(t.home);
    });
  }

  stopParty() {
    this.active = false;
    this.root.visible = false;
  }

  update(dt, elapsed) {
    if (!this.active) return;
    this.treats.forEach((t, i) => {
      if (t.state === 'eaten') {
        t.mesh.visible = false;
        return;
      }
      t.mesh.position.lerp(t.targetPos, Math.min(1, dt * 14));
      if (t.state === 'tray') {
        t.mesh.position.y += Math.sin(elapsed * 3.5 + i) * 0.003;
      }
    });
  }
}
