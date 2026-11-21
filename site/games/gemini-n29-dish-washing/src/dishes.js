import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 5 distinct, appetizing & realistic dishes!
export const DISH_RECIPES = [
  {
    id: 'cake_plate',
    shape: 'plate',
    materialType: 'ceramic',
    baseColor: 0xfdfcf9,
    rimColor: 0xe6b5b0,
    scale: [1.0, 1.0, 1.0],
    oilLevel: 0.45, // Strawberry shortcake cream & berry sauce (easy & rewarding first dish!)
    stainKind: 'strawberry_cake',
    seed: 11,
  },
  {
    id: 'pasta_bowl',
    shape: 'bowl',
    materialType: 'ceramic',
    baseColor: 0xf7f2e8,
    rimColor: 0x6e8fa6,
    scale: [1.0, 1.0, 1.0],
    oilLevel: 0.72, // Rich tomato meat sauce + herbs
    stainKind: 'meat_sauce',
    seed: 22,
  },
  {
    id: 'cocoa_mug',
    shape: 'mug',
    materialType: 'mug',
    baseColor: 0xf8e7e4,
    rimColor: 0xd9878b,
    scale: [1.0, 1.0, 1.0],
    oilLevel: 0.55, // Creamy hot chocolate drips
    stainKind: 'cocoa',
    seed: 33,
  },
  {
    id: 'juice_glass',
    shape: 'glass',
    materialType: 'glass',
    baseColor: 0xeef8ff,
    rimColor: 0xeef8ff,
    scale: [1.0, 1.0, 1.0],
    oilLevel: 0.38, // Fresh orange juice pulp & streaks
    stainKind: 'orange_juice',
    seed: 44,
  },
  {
    id: 'curry_plate',
    shape: 'oval',
    materialType: 'ceramic',
    baseColor: 0xfbf8f1,
    rimColor: 0xd9b36c,
    scale: [1.14, 1.0, 0.88],
    oilLevel: 0.9, // Thick rich curry (really shows off soap bubble power!)
    stainKind: 'curry',
    seed: 55,
  },
];

function paintStainCanvas(ctx, size, stainKind, seed) {
  const rng = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const cy = size * 0.5;

  if (stainKind === 'strawberry_cake') {
    // Rich ruby-red glossy strawberry glaze smears
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2;
      const dist = rng() * size * 0.27;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      const r = 34 + rng() * 54;
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(182, 20, 38, 0.96)');
      g.addColorStop(0.55, 'rgba(216, 44, 62, 0.78)');
      g.addColorStop(1, 'rgba(216, 44, 62, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warm vanilla custard & whipped cream swirls with subtle shading edge
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2;
      const dist = rng() * size * 0.24;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      const r = 24 + rng() * 38;
      const g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r);
      g.addColorStop(0, 'rgba(255, 244, 212, 0.96)');
      g.addColorStop(0.68, 'rgba(242, 214, 168, 0.88)');
      g.addColorStop(1, 'rgba(220, 178, 128, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Golden sponge cake crumbs & dark berry seeds
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const d = rng() * size * 0.34;
      ctx.fillStyle = rng() > 0.35 ? 'rgba(214, 152, 56, 0.96)' : 'rgba(115, 16, 26, 0.9)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5 + rng() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (stainKind === 'meat_sauce') {
    // Rich orange-red tomato pasta swirls
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2;
      const dist = rng() * size * 0.27;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      const r = 34 + rng() * 64;
      const g = ctx.createRadialGradient(x, y, 5, x, y, r);
      g.addColorStop(0, 'rgba(196, 62, 26, 0.94)');
      g.addColorStop(0.6, 'rgba(224, 92, 34, 0.72)');
      g.addColorStop(1, 'rgba(224, 92, 34, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pasta fork-twirl streaks
    ctx.strokeStyle = 'rgba(182, 48, 22, 0.78)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      ctx.lineWidth = 8 + rng() * 14;
      ctx.beginPath();
      const sa = rng() * Math.PI * 2;
      ctx.arc(cx + (rng() - 0.5) * 60, cy + (rng() - 0.5) * 60, 40 + rng() * 80, sa, sa + 1.2);
      ctx.stroke();
    }
    // Herbs & minced bits
    for (let i = 0; i < 75; i++) {
      const a = rng() * Math.PI * 2;
      const d = rng() * size * 0.35;
      ctx.fillStyle = rng() > 0.45 ? 'rgba(60, 118, 44, 0.92)' : 'rgba(116, 46, 22, 0.9)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5 + rng() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (stainKind === 'cocoa') {
    // Rich brown cocoa drips & rings (mapped onto cylinder UV)
    for (let i = 0; i < 18; i++) {
      const x = rng() * size;
      const y = size * (0.18 + rng() * 0.62);
      const r = 28 + rng() * 54;
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(92, 46, 24, 0.92)');
      g.addColorStop(0.6, 'rgba(132, 74, 42, 0.74)');
      g.addColorStop(1, 'rgba(132, 74, 42, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Vertical drips from rim
    for (let i = 0; i < 14; i++) {
      const x = rng() * size;
      const len = 70 + rng() * 180;
      const grad = ctx.createLinearGradient(x, 0, x, len);
      grad.addColorStop(0, 'rgba(84, 40, 20, 0.9)');
      grad.addColorStop(1, 'rgba(118, 62, 34, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 8, 25, 16, len);
    }
  } else if (stainKind === 'orange_juice') {
    // Bright sunny orange juice residue & pulp dots on glass
    for (let i = 0; i < 16; i++) {
      const x = rng() * size;
      const y = size * (0.2 + rng() * 0.62);
      const r = 28 + rng() * 56;
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(246, 146, 24, 0.88)');
      g.addColorStop(0.65, 'rgba(255, 178, 52, 0.62)');
      g.addColorStop(1, 'rgba(255, 185, 70, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = 'rgba(255, 205, 86, 0.92)';
      ctx.beginPath();
      ctx.arc(rng() * size, size * (0.15 + rng() * 0.7), 2 + rng() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (stainKind === 'curry') {
    // Rich golden-brown Japanese curry sauce + carrot/potato specs
    for (let i = 0; i < 18; i++) {
      const a = rng() * Math.PI * 2;
      const dist = rng() * size * 0.27;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      const r = 38 + rng() * 68;
      const g = ctx.createRadialGradient(x, y, 6, x, y, r);
      g.addColorStop(0, 'rgba(138, 76, 18, 0.95)');
      g.addColorStop(0.55, 'rgba(176, 108, 28, 0.78)');
      g.addColorStop(1, 'rgba(196, 128, 38, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rice grains & carrot flecks
    for (let i = 0; i < 55; i++) {
      const a = rng() * Math.PI * 2;
      const d = rng() * size * 0.34;
      ctx.fillStyle = rng() > 0.35 ? 'rgba(252, 246, 224, 0.95)' : 'rgba(222, 102, 34, 0.94)';
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * d,
        cy + Math.sin(a) * d,
        3.5 + rng() * 3,
        2 + rng() * 2,
        rng() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
}

function buildPlateGeometries(isDeepBowl = false) {
  // Smooth ceramic profile via LatheGeometry
  const pts = isDeepBowl
    ? [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.088, 0.0),
        new THREE.Vector2(0.095, 0.012),
        new THREE.Vector2(0.145, 0.048),
        new THREE.Vector2(0.172, 0.084),
        new THREE.Vector2(0.165, 0.088),
        new THREE.Vector2(0.136, 0.052),
        new THREE.Vector2(0.086, 0.018),
        new THREE.Vector2(0.0, 0.016),
      ]
    : [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.105, 0.0),
        new THREE.Vector2(0.115, 0.01),
        new THREE.Vector2(0.172, 0.032),
        new THREE.Vector2(0.185, 0.042),
        new THREE.Vector2(0.178, 0.046),
        new THREE.Vector2(0.115, 0.02),
        new THREE.Vector2(0.0, 0.018),
      ];
  const baseGeo = new THREE.LatheGeometry(pts, 44);

  // Overlay surface disk conformed smoothly to top face for dirt & foam CanvasTextures!
  const radius = isDeepBowl ? 0.162 : 0.174;
  const overlayGeo = new THREE.CircleGeometry(radius, 40);
  overlayGeo.rotateX(-Math.PI / 2);
  const pos = overlayGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const t = Math.min(1, r / radius);
    const y = isDeepBowl
      ? 0.02 + Math.pow(t, 1.85) * 0.066
      : 0.021 + Math.pow(t, 1.65) * 0.024;
    pos.setY(i, y);
  }
  overlayGeo.computeVertexNormals();

  return { baseGeo, overlayGeo };
}

function buildCupGeometries(isGlass = false) {
  const rTop = isGlass ? 0.086 : 0.092;
  const rBot = isGlass ? 0.068 : 0.084;
  const h = isGlass ? 0.21 : 0.175;
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(rBot, 0.0),
    new THREE.Vector2(rTop, h),
    new THREE.Vector2(rTop - 0.008, h + 0.004),
    new THREE.Vector2(rBot - 0.008, 0.018),
    new THREE.Vector2(0.0, 0.018),
  ];
  const baseGeo = new THREE.LatheGeometry(pts, 36);

  // Outer cylindrical overlay for stain & foam
  const overlayGeo = new THREE.CylinderGeometry(rTop + 0.0025, rBot + 0.0025, h * 0.92, 36, 1, true);
  overlayGeo.translate(0, h * 0.5, 0);

  return { baseGeo, overlayGeo, rTop, h };
}

export class DishInstance {
  constructor(recipe, index) {
    this.recipe = recipe;
    this.index = index;
    this.group = new THREE.Group();
    this.group.scale.set(...recipe.scale);

    this.state = 'waiting'; // waiting | washing | clean_ready | racked
    this.cleanProgress = 0;
    this.foamAmount = 0;
    this.dirtRemaining = 1.0;
    this.dirtInitialCount = 1;
    this.sparkleTriggered = false;
    this.textureDirty = false;
    this.lastTexUpload = 0;

    // 256x256 dynamic canvases (fast to sample & update on mobile iOS, well under 1024px)
    this.texSize = 256;
    this.dirtCanvas = document.createElement('canvas');
    this.dirtCanvas.width = this.texSize;
    this.dirtCanvas.height = this.texSize;
    this.dirtCtx = this.dirtCanvas.getContext('2d', { willReadFrequently: true });
    paintStainCanvas(this.dirtCtx, this.texSize, recipe.stainKind, recipe.seed);

    this.foamCanvas = document.createElement('canvas');
    this.foamCanvas.width = this.texSize;
    this.foamCanvas.height = this.texSize;
    this.foamCtx = this.foamCanvas.getContext('2d', { willReadFrequently: true });

    this.dirtTexture = new THREE.CanvasTexture(this.dirtCanvas);
    this.dirtTexture.colorSpace = THREE.SRGBColorSpace;
    this.foamTexture = new THREE.CanvasTexture(this.foamCanvas);
    this.foamTexture.colorSpace = THREE.SRGBColorSpace;

    // Count initial opaque stain pixels on a coarse grid for accurate progress
    this.sampleGrid = 24;
    this.dirtInitialCount = this._countAlphaPixels(this.dirtCtx);
    this.foamCoverage = 0;

    // Build realistic 3D dish geometry & physical materials
    let baseMat;
    if (recipe.shape === 'glass') {
      baseMat = new THREE.MeshPhysicalMaterial({
        color: 0xf4fbff,
        roughness: 0.06,
        metalness: 0.0,
        transmission: 0.86,
        thickness: 0.04,
        ior: 1.5,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.72,
      });
    } else {
      baseMat = new THREE.MeshPhysicalMaterial({
        color: recipe.baseColor,
        roughness: 0.12,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });
    }

    let overlayGeo;
    if (recipe.shape === 'plate' || recipe.shape === 'bowl' || recipe.shape === 'oval') {
      const built = buildPlateGeometries(recipe.shape === 'bowl');
      const baseMesh = new THREE.Mesh(built.baseGeo, baseMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      this.group.add(baseMesh);

      // Decorative subtle ceramic rim stripe
      const rimRadius = recipe.shape === 'bowl' ? 0.168 : 0.181;
      const rimY = recipe.shape === 'bowl' ? 0.085 : 0.044;
      const rimRing = new THREE.Mesh(
        new THREE.TorusGeometry(rimRadius, 0.0042, 10, 44),
        new THREE.MeshPhysicalMaterial({
          color: recipe.rimColor,
          roughness: 0.16,
          clearcoat: 1.0,
        })
      );
      rimRing.rotation.x = Math.PI / 2;
      rimRing.position.y = rimY;
      this.group.add(rimRing);

      overlayGeo = built.overlayGeo;
      this.isCup = false;
    } else {
      const built = buildCupGeometries(recipe.shape === 'glass');
      const baseMesh = new THREE.Mesh(built.baseGeo, baseMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      this.group.add(baseMesh);

      if (recipe.shape === 'mug') {
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.011, 12, 24, Math.PI * 1.25), baseMat);
        handle.position.set(0.092, 0.095, 0);
        handle.rotation.z = -Math.PI * 0.62;
        handle.castShadow = true;
        this.group.add(handle);
      }

      overlayGeo = built.overlayGeo;
      this.isCup = true;
    }

    // Layer 2: Dirt overlay mesh (erased dynamically as child scrubs!)
    const dirtMat = new THREE.MeshStandardMaterial({
      map: this.dirtTexture,
      transparent: true,
      roughness: 0.34,
      metalness: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.dirtMesh = new THREE.Mesh(overlayGeo, dirtMat);
    this.dirtMesh.position.y = 0.002;
    this.dirtMesh.userData.interactive = 'activeDish';
    this.dirtMesh.userData.dish = this;
    this.group.add(this.dirtMesh);

    // Layer 3: Creamy white soap foam film mesh
    const foamMat = new THREE.MeshPhysicalMaterial({
      map: this.foamTexture,
      transparent: true,
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 0.8,
      iridescence: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.foamMesh = new THREE.Mesh(overlayGeo, foamMat);
    this.foamMesh.position.y = 0.0045;
    this.foamMesh.raycast = () => {}; // Let raycasts hit dirtMesh cleanly
    this.group.add(this.foamMesh);

    // 3D solid food crumbs / scraps that pop off when scrubbed!
    this.crumbs = [];
    this._createFoodScraps();

    // Wet specular gleam droplets that appear once clean
    this.wetDropGroup = new THREE.Group();
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      transmission: 0.9,
      ior: 1.33,
      clearcoat: 1.0,
    });
    const rng = mulberry32(recipe.seed + 77);
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.0055 + rng() * 0.004, 8, 8), dropMat);
      d.scale.set(1, 0.45, 1);
      if (this.isCup) {
        const a = rng() * Math.PI * 2;
        d.position.set(Math.cos(a) * 0.088, 0.04 + rng() * 0.12, Math.sin(a) * 0.088);
      } else {
        const a = rng() * Math.PI * 2;
        const r = 0.03 + rng() * 0.11;
        d.position.set(Math.cos(a) * r, 0.025 + r * 0.14, Math.sin(a) * r);
      }
      this.wetDropGroup.add(d);
    }
    this.wetDropGroup.visible = false;
    this.group.add(this.wetDropGroup);
  }

  _createFoodScraps() {
    if (this.isCup) return;
    const rng = mulberry32(this.recipe.seed + 99);
    const kind = this.recipe.stainKind;

    for (let i = 0; i < 5; i++) {
      let mesh;
      if (kind === 'strawberry_cake') {
        // Juicy strawberry slice or cream dollop
        const isBerry = i < 3;
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(isBerry ? 0.017 : 0.015, 10, 8),
          new THREE.MeshStandardMaterial({
            color: isBerry ? 0xd92536 : 0xfff8e6,
            roughness: isBerry ? 0.22 : 0.45,
          })
        );
        mesh.scale.set(1.2, 0.55, 0.9);
      } else if (kind === 'meat_sauce') {
        // Pasta bit or herb leaf
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.006, 0.026, 4, 8),
          new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xf2c96b : 0xb8381d, roughness: 0.4 })
        );
        mesh.rotation.z = Math.PI / 2;
      } else {
        // Curry carrot cube / potato piece
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.012, 0.018),
          new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xe06824 : 0xebcf88, roughness: 0.42 })
        );
      }
      const a = (i / 5) * Math.PI * 2 + rng() * 0.6;
      const r = 0.035 + rng() * 0.075;
      mesh.position.set(Math.cos(a) * r, 0.032 + r * 0.12, Math.sin(a) * r);
      mesh.rotation.y = rng() * Math.PI;
      mesh.castShadow = true;
      this.group.add(mesh);

      this.crumbs.push({
        mesh,
        detached: false,
        gone: false,
        vel: new THREE.Vector3(),
      });
    }
  }

  _countAlphaPixels(ctx) {
    const img = ctx.getImageData(0, 0, this.texSize, this.texSize).data;
    const step = Math.floor(this.texSize / this.sampleGrid);
    let count = 0;
    for (let y = 0; y < this.texSize; y += step) {
      for (let x = 0; x < this.texSize; x += step) {
        const a = img[(y * this.texSize + x) * 4 + 3];
        if (a > 36) count++;
      }
    }
    return count;
  }

  // Scrub at UV coordinate (0..1, 0..1)
  scrubAtUV(uv, soapStrength, radiusPx = 30) {
    const x = uv.x * this.texSize;
    const y = (1 - uv.y) * this.texSize;

    // Causality: oily dishes scrub slowly when dry, effortlessly with soap!
    const eff = soapStrength > 0.05
      ? 0.68 + Math.min(1, soapStrength) * 0.32
      : Math.max(0.08, 0.25 - this.recipe.oilLevel * 0.18);

    // Erase dirt softly
    this.dirtCtx.save();
    this.dirtCtx.globalCompositeOperation = 'destination-out';
    const g = this.dirtCtx.createRadialGradient(x, y, radiusPx * 0.15, x, y, radiusPx);
    g.addColorStop(0, `rgba(0,0,0,${eff})`);
    g.addColorStop(0.7, `rgba(0,0,0,${eff * 0.65})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.dirtCtx.fillStyle = g;
    this.dirtCtx.beginPath();
    this.dirtCtx.arc(x, y, radiusPx, 0, Math.PI * 2);
    this.dirtCtx.fill();
    this.dirtCtx.restore();

    // Deposit rich white micro-bubbles foam when sponge has soap
    if (soapStrength > 0.05) {
      const fRad = radiusPx * 1.1;
      const fg = this.foamCtx.createRadialGradient(x, y, fRad * 0.1, x, y, fRad);
      fg.addColorStop(0, 'rgba(255,255,255,0.88)');
      fg.addColorStop(0.55, 'rgba(244,252,255,0.58)');
      fg.addColorStop(1, 'rgba(240,250,255,0)');
      this.foamCtx.fillStyle = fg;
      this.foamCtx.beginPath();
      this.foamCtx.arc(x, y, fRad, 0, Math.PI * 2);
      this.foamCtx.fill();

      // Tiny bright highlight bubble rings inside foam
      this.foamCtx.strokeStyle = 'rgba(218, 240, 255, 0.55)';
      this.foamCtx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const bx = x + (Math.random() - 0.5) * radiusPx * 1.1;
        const by = y + (Math.random() - 0.5) * radiusPx * 1.1;
        this.foamCtx.beginPath();
        this.foamCtx.arc(bx, by, 3 + Math.random() * 6, 0, Math.PI * 2);
        this.foamCtx.stroke();
      }
    }

    this.textureDirty = true;
    return eff;
  }

  // Rinse foam & gentle dirt away under running water
  rinseUnderWater(dt, intensity = 1.0) {
    // Rinse spreads downward across the dish from top-center where stream hits
    const washes = 3;
    this.foamCtx.save();
    this.foamCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < washes; i++) {
      const x = this.texSize * (0.12 + Math.random() * 0.76);
      const y = this.texSize * (0.1 + Math.random() * 0.8);
      const r = 34 + Math.random() * 38;
      const g = this.foamCtx.createRadialGradient(x, y, 4, x, y, r);
      const alpha = Math.min(0.65, dt * 3.8 * intensity);
      g.addColorStop(0, `rgba(0,0,0,${alpha})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this.foamCtx.fillStyle = g;
      this.foamCtx.beginPath();
      this.foamCtx.arc(x, y, r, 0, Math.PI * 2);
      this.foamCtx.fill();
    }
    this.foamCtx.restore();

    // Water also helps loosen the very last faint specks of dirt if already mostly scrubbed
    if (this.dirtRemaining < 0.25) {
      this.dirtCtx.save();
      this.dirtCtx.globalCompositeOperation = 'destination-out';
      this.dirtCtx.fillStyle = `rgba(0,0,0,${Math.min(0.22, dt * 1.6 * intensity)})`;
      this.dirtCtx.fillRect(0, 0, this.texSize, this.texSize);
      this.dirtCtx.restore();
    }

    this.textureDirty = true;
  }

  popNearbyCrumbs(localPos, dishWorldMatrix) {
    let popped = 0;
    for (const c of this.crumbs) {
      if (c.detached || c.gone) continue;
      if (c.mesh.position.distanceTo(localPos) < 0.085) {
        c.detached = true;
        // Convert crumb to world space behavior (keep inside group but fly off downward)
        c.vel.set((Math.random() - 0.5) * 0.45, 0.35 + Math.random() * 0.2, 0.25 + Math.random() * 0.2);
        popped++;
      }
    }
    return popped;
  }

  flushTexturesAndMeasure(nowMs) {
    if (!this.textureDirty) return;
    if (nowMs - this.lastTexUpload < 33) return; // Cap canvas upload to ~30Hz for mobile GPU speed
    this.lastTexUpload = nowMs;
    this.textureDirty = false;

    this.dirtTexture.needsUpdate = true;
    this.foamTexture.needsUpdate = true;

    const dirtNow = this._countAlphaPixels(this.dirtCtx);
    const foamNow = this._countAlphaPixels(this.foamCtx);
    const totalCells = this.sampleGrid * this.sampleGrid;

    this.dirtRemaining = this.dirtInitialCount > 0 ? Math.min(1, dirtNow / this.dirtInitialCount) : 0;
    this.foamCoverage = Math.min(1, foamNow / (totalCells * 0.42));

    // Generous kid-friendly snap-to-clean when >86% dirt is scrubbed
    if (this.dirtRemaining < 0.14 && this.dirtRemaining > 0) {
      this.dirtCtx.clearRect(0, 0, this.texSize, this.texSize);
      this.dirtTexture.needsUpdate = true;
      this.dirtRemaining = 0;
    }

    // Pop any remaining crumbs once mostly scrubbed
    if (this.dirtRemaining < 0.22) {
      for (const c of this.crumbs) {
        if (!c.detached && !c.gone) {
          c.detached = true;
          c.vel.set((Math.random() - 0.5) * 0.4, 0.3, 0.2);
        }
      }
    }

    // Generous snap-to-rinsed when foam is mostly gone
    if (this.dirtRemaining <= 0.01 && this.foamCoverage < 0.14 && this.foamCoverage > 0) {
      this.foamCtx.clearRect(0, 0, this.texSize, this.texSize);
      this.foamTexture.needsUpdate = true;
      this.foamCoverage = 0;
    }

    // Mark clean & shiny once dirt is gone and foam is rinsed!
    if (this.dirtRemaining <= 0.01 && this.foamCoverage <= 0.01) {
      this.wetDropGroup.visible = true;
    }
  }

  updateCrumbs(dt) {
    for (const c of this.crumbs) {
      if (!c.detached || c.gone) continue;
      c.vel.y -= 2.4 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += dt * 7;
      c.mesh.rotation.z += dt * 5;
      if (c.mesh.position.y < -0.35) {
        c.gone = true;
        c.mesh.visible = false;
      }
    }
  }

  isScrubbedClean() {
    return this.dirtRemaining <= 0.01;
  }

  isFullyRinsed() {
    return this.dirtRemaining <= 0.01 && this.foamCoverage <= 0.01;
  }

  resetForReplay() {
    paintStainCanvas(this.dirtCtx, this.texSize, this.recipe.stainKind, this.recipe.seed + Math.floor(Math.random() * 100));
    this.foamCtx.clearRect(0, 0, this.texSize, this.texSize);
    this.dirtTexture.needsUpdate = true;
    this.foamTexture.needsUpdate = true;
    this.dirtInitialCount = this._countAlphaPixels(this.dirtCtx);
    this.dirtRemaining = 1.0;
    this.foamCoverage = 0;
    this.sparkleTriggered = false;
    this.wetDropGroup.visible = false;
    this.state = 'waiting';
    for (const c of this.crumbs) {
      c.detached = false;
      c.gone = false;
      c.mesh.visible = true;
      const a = Math.random() * Math.PI * 2;
      const r = 0.035 + Math.random() * 0.07;
      c.mesh.position.set(Math.cos(a) * r, 0.032 + r * 0.12, Math.sin(a) * r);
    }
  }
}

// Reward Strawberry Shortcake served on a gleaming plate when all dishes are sparkling clean!
export function createRewardCake() {
  const g = new THREE.Group();

  // Gleaming white dessert plate
  const platePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.165, 0.025),
    new THREE.Vector2(0.16, 0.029),
    new THREE.Vector2(0.105, 0.012),
    new THREE.Vector2(0, 0.011),
  ];
  const plate = new THREE.Mesh(
    new THREE.LatheGeometry(platePts, 36),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1.0 })
  );
  plate.castShadow = true;
  plate.receiveShadow = true;
  g.add(plate);

  // Fluffy layered strawberry shortcake wedge / round mini cake
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.42 });
  const spongeMat = new THREE.MeshStandardMaterial({ color: 0xf4d28b, roughness: 0.72 });
  const jamMat = new THREE.MeshStandardMaterial({ color: 0xd62b3d, roughness: 0.2 });

  const cakeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.09, 0.085, 28), creamMat);
  cakeBase.position.y = 0.056;
  cakeBase.castShadow = true;
  g.add(cakeBase);

  // Exposed middle golden sponge & jam stripe band
  const spongeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.022, 28), spongeMat);
  spongeBand.position.y = 0.052;
  g.add(spongeBand);
  const jamBand = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.01, 28), jamMat);
  jamBand.position.y = 0.052;
  g.add(jamBand);

  // Piped cream rosettes on top
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), creamMat);
    pip.scale.set(1, 0.85, 1);
    pip.position.set(Math.cos(a) * 0.064, 0.104, Math.sin(a) * 0.064);
    g.add(pip);
  }

  // Glossy fresh strawberries on top!
  const berryMat = new THREE.MeshPhysicalMaterial({
    color: 0xd91c2f,
    roughness: 0.22,
    clearcoat: 0.9,
  });
  const calyxMat = new THREE.MeshStandardMaterial({ color: 0x3b8c36, roughness: 0.55 });
  const berryPositions = [
    [0, 0.125, 0],
    [0.038, 0.118, 0.024],
    [-0.036, 0.118, 0.026],
    [0.004, 0.118, -0.042],
  ];
  for (const [bx, by, bz] of berryPositions) {
    const berry = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.044, 14), berryMat);
    berry.position.set(bx, by, bz);
    berry.rotation.z = (bx * 3);
    berry.castShadow = true;
    g.add(berry);

    const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.006, 0.008, 6), calyxMat);
    leaf.position.set(bx, by - 0.018, bz);
    g.add(leaf);
  }

  // Generous tap hitbox (tapping cake triggers happy sparkle & next round of fun!)
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.08;
  hit.userData.interactive = 'rewardCake';
  g.add(hit);

  g.visible = false;
  return g;
}
