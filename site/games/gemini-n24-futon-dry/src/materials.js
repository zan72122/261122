import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function loadTex(url, { srgb = false, repeat = [1, 1], anisotropy = 4 } = {}) {
  const tex = loader.load(url);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  return tex;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Create a soft radial contact shadow texture for grounding objects realistically
export function createContactShadowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(18, 22, 28, 0.58)');
  g.addColorStop(0.45, 'rgba(18, 22, 28, 0.28)');
  g.addColorStop(0.78, 'rgba(18, 22, 28, 0.07)');
  g.addColorStop(1, 'rgba(18, 22, 28, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Composite real ambientCG Fabric019 woven cotton with understated authentic Japanese futon weave & quilted stitch details
async function buildFutonTextures() {
  const [fabricCol, fabricNor, fabricRough] = await Promise.all([
    loadImage('./assets/textures/Fabric019/Color.jpg'),
    loadImage('./assets/textures/Fabric019/NormalGL.jpg'),
    loadImage('./assets/textures/Fabric019/Roughness.jpg')
  ]);

  const size = 1024;

  // Front side: Warm natural ecru cotton with delicate muted sakura-linen woven stripes & subtle Japanese floral motif
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = size;
  frontCanvas.height = size;
  const fctx = frontCanvas.getContext('2d');

  // Tile real Fabric019 weave 3x3 for realistic fine cotton thread scale
  const tile = size / 3;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      fctx.drawImage(fabricCol, x * tile, y * tile, tile + 1, tile + 1);
    }
  }

  // Warm sunlit natural cotton tint (multiply preserves real thread shading)
  fctx.globalCompositeOperation = 'multiply';
  fctx.fillStyle = '#faf3e9';
  fctx.fillRect(0, 0, size, size);

  // Subtle woven Japanese cotton stripes (delicate dusty rose-beige & soft flax, realistic muji/nishikawa fabric)
  const stripeCount = 12;
  const step = size / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const x = i * step;
    fctx.fillStyle = i % 2 === 0 ? 'rgba(230, 198, 194, 0.26)' : 'rgba(236, 225, 208, 0.18)';
    fctx.fillRect(x + step * 0.14, 0, step * 0.14, size);
    fctx.fillStyle = 'rgba(216, 178, 174, 0.22)';
    fctx.fillRect(x + step * 0.34, 0, step * 0.035, size);
  }

  // Very delicate woven micro-flower motif (understated, realistic printed cotton cover)
  fctx.globalCompositeOperation = 'multiply';
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cx = (col + (row % 2) * 0.5) * (size / 10);
      const cy = (row + 0.5) * (size / 10);
      fctx.save();
      fctx.translate(cx, cy);
      fctx.rotate(((row * 7 + col * 13) % 6) * 0.5);
      fctx.fillStyle = 'rgba(222, 175, 178, 0.30)';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        fctx.beginPath();
        fctx.ellipse(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 4.2, 2.7, a, 0, Math.PI * 2);
        fctx.fill();
      }
      fctx.fillStyle = 'rgba(215, 192, 148, 0.36)';
      fctx.beginPath();
      fctx.arc(0, 0, 2.3, 0, Math.PI * 2);
      fctx.fill();
      fctx.restore();
    }
  }

  // Soft quilted seam valley darkening + subtle thread stitches (4x5 traditional quilted grid)
  fctx.globalCompositeOperation = 'multiply';
  const qx = 4;
  const qy = 5;
  fctx.strokeStyle = 'rgba(170, 155, 142, 0.28)';
  fctx.lineWidth = 10;
  for (let i = 1; i < qx; i++) {
    const x = (i / qx) * size;
    fctx.beginPath();
    for (let y = 0; y <= size; y += 16) {
      const wave = Math.sin((y / size) * Math.PI * qy * 2) * 14;
      if (y === 0) fctx.moveTo(x + wave, y);
      else fctx.lineTo(x + wave, y);
    }
    fctx.stroke();
  }
  for (let j = 1; j < qy; j++) {
    const y = (j / qy) * size;
    fctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const wave = Math.sin((x / size) * Math.PI * qx * 2) * 10;
      if (x === 0) fctx.moveTo(x, y + wave);
      else fctx.lineTo(x, y + wave);
    }
    fctx.stroke();
  }

  // Fine dashed cotton stitching along the quilt lines
  fctx.globalCompositeOperation = 'source-over';
  fctx.strokeStyle = 'rgba(195, 178, 165, 0.45)';
  fctx.lineWidth = 1.6;
  fctx.setLineDash([6, 4]);
  for (let i = 1; i < qx; i++) {
    const x = (i / qx) * size;
    fctx.beginPath();
    for (let y = 0; y <= size; y += 16) {
      const wave = Math.sin((y / size) * Math.PI * qy * 2) * 14;
      if (y === 0) fctx.moveTo(x + wave, y);
      else fctx.lineTo(x + wave, y);
    }
    fctx.stroke();
  }
  fctx.setLineDash([]);

  // Back side: Clean natural cream-ivory woven cotton with matching subtle quilting
  const backCanvas = document.createElement('canvas');
  backCanvas.width = size;
  backCanvas.height = size;
  const bctx = backCanvas.getContext('2d');
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      bctx.drawImage(fabricCol, x * tile, y * tile, tile + 1, tile + 1);
    }
  }
  bctx.globalCompositeOperation = 'multiply';
  bctx.fillStyle = '#f5efe2';
  bctx.fillRect(0, 0, size, size);
  // Subtle cream quilt valleys
  bctx.strokeStyle = 'rgba(175, 162, 145, 0.24)';
  bctx.lineWidth = 10;
  for (let i = 1; i < qx; i++) {
    const x = (i / qx) * size;
    bctx.beginPath();
    for (let y = 0; y <= size; y += 16) {
      const wave = Math.sin((y / size) * Math.PI * qy * 2) * 14;
      if (y === 0) bctx.moveTo(x + wave, y);
      else bctx.lineTo(x + wave, y);
    }
    bctx.stroke();
  }

  // Quilt AO map (soft ambient occlusion inside quilted stitch channels)
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 512;
  aoCanvas.height = 512;
  const actx = aoCanvas.getContext('2d');
  actx.fillStyle = '#ffffff';
  actx.fillRect(0, 0, 512, 512);
  actx.strokeStyle = 'rgba(130, 130, 130, 0.55)';
  actx.lineWidth = 14;
  actx.filter = 'blur(5px)';
  for (let i = 1; i < qx; i++) {
    const x = (i / qx) * 512;
    actx.beginPath();
    for (let y = 0; y <= 512; y += 12) {
      const wave = Math.sin((y / 512) * Math.PI * qy * 2) * 7;
      if (y === 0) actx.moveTo(x + wave, y);
      else actx.lineTo(x + wave, y);
    }
    actx.stroke();
  }
  for (let j = 1; j < qy; j++) {
    const y = (j / qy) * 512;
    actx.beginPath();
    for (let x = 0; x <= 512; x += 12) {
      const wave = Math.sin((x / 512) * Math.PI * qx * 2) * 5;
      if (x === 0) actx.moveTo(x, y + wave);
      else actx.lineTo(x, y + wave);
    }
    actx.stroke();
  }

  const frontMap = new THREE.CanvasTexture(frontCanvas);
  frontMap.colorSpace = THREE.SRGBColorSpace;
  frontMap.anisotropy = 4;

  const backMap = new THREE.CanvasTexture(backCanvas);
  backMap.colorSpace = THREE.SRGBColorSpace;
  backMap.anisotropy = 4;

  const aoMap = new THREE.CanvasTexture(aoCanvas);
  aoMap.colorSpace = THREE.NoColorSpace;

  const normalMap = new THREE.Texture(fabricNor);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(6, 6);
  normalMap.anisotropy = 4;
  normalMap.needsUpdate = true;

  const roughMap = new THREE.Texture(fabricRough);
  roughMap.colorSpace = THREE.NoColorSpace;
  roughMap.wrapS = THREE.RepeatWrapping;
  roughMap.wrapT = THREE.RepeatWrapping;
  roughMap.repeat.set(6, 6);
  roughMap.needsUpdate = true;

  return { frontMap, backMap, aoMap, normalMap, roughMap };
}

// Realistic natural sunlit human skin texture (warm healthy tones, knuckle blush, micro-grain)
function createSkinMaterials() {
  const size = 256;
  const col = document.createElement('canvas');
  col.width = size;
  col.height = size;
  const cctx = col.getContext('2d');
  const grad = cctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#f2c7ac');
  grad.addColorStop(0.5, '#eab99c');
  grad.addColorStop(1, '#e0ac8e');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 14;
    cctx.fillStyle = i % 2 === 0 ? 'rgba(215, 130, 108, 0.055)' : 'rgba(255, 228, 208, 0.05)';
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();
  }

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext('2d');
  const imgData = bctx.createImageData(size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 20);
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 255;
  }
  bctx.putImageData(imgData, 0, 0);

  const skinMap = new THREE.CanvasTexture(col);
  skinMap.colorSpace = THREE.SRGBColorSpace;
  const skinBump = new THREE.CanvasTexture(bump);
  skinBump.colorSpace = THREE.NoColorSpace;
  skinBump.wrapS = THREE.RepeatWrapping;
  skinBump.wrapT = THREE.RepeatWrapping;
  skinBump.repeat.set(4, 4);

  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinMap,
    bumpMap: skinBump,
    bumpScale: 0.0012,
    roughness: 0.56,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color('#ffcab2')
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f7d5cb'),
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.22
  });

  return { skinMat, nailMat };
}

// Create clean sunlit Japanese architectural painted concrete/stucco albedo from real Poly Haven concrete_wall_005
async function buildCleanParapetTexture() {
  const img = await loadImage('./assets/textures/concrete_wall_005/diff.jpg');
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  // Base sunlit Japanese apartment light warm-grey/ivory exterior stucco
  ctx.fillStyle = '#e7e4dc';
  ctx.fillRect(0, 0, size, size);
  // Subtle real concrete mottling & architectural grain from Poly Haven concrete_wall_005
  ctx.globalAlpha = 0.24;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(img, 0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;

  // Subtle architectural vertical expansion joint seam (authentic Japanese mansion balcony concrete)
  ctx.strokeStyle = 'rgba(130, 126, 118, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, size);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 0.85);
  tex.anisotropy = 4;
  return tex;
}

export async function createMaterials() {
  const [futonTex, cleanParapetMap] = await Promise.all([
    buildFutonTextures(),
    buildCleanParapetTexture()
  ]);

  // Concrete balcony floor (Poly Haven concrete_floor_01)
  const concreteFloor = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/concrete_floor_01/diff.jpg', { srgb: true, repeat: [2.6, 1.3] }),
    normalMap: loadTex('./assets/textures/concrete_floor_01/nor_gl.jpg', { repeat: [2.6, 1.3] }),
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: loadTex('./assets/textures/concrete_floor_01/rough.jpg', { repeat: [2.6, 1.3] }),
    aoMap: loadTex('./assets/textures/concrete_floor_01/ao.jpg', { repeat: [2.6, 1.3] }),
    aoMapIntensity: 0.75,
    roughness: 0.92,
    metalness: 0.0,
    color: new THREE.Color('#eceae4')
  });

  // Concrete apartment parapet & side walls (Poly Haven concrete_wall_005 — bright sunlit Japanese cream-grey exterior)
  const concreteWall = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/concrete_wall_005/diff.jpg', { srgb: true, repeat: [2.4, 1.0] }),
    normalMap: loadTex('./assets/textures/concrete_wall_005/nor_gl.jpg', { repeat: [2.4, 1.0] }),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: loadTex('./assets/textures/concrete_wall_005/rough.jpg', { repeat: [2.4, 1.0] }),
    aoMap: loadTex('./assets/textures/concrete_wall_005/ao.jpg', { repeat: [2.4, 1.0] }),
    aoMapIntensity: 0.45,
    roughness: 0.92,
    metalness: 0.0,
    color: new THREE.Color('#f4f1ea')
  });

  // Clean painted Japanese apartment balcony concrete stucco (uses Poly Haven concrete_wall_005 micro-texture)
  const balconyParapet = new THREE.MeshStandardMaterial({
    map: cleanParapetMap,
    normalMap: loadTex('./assets/textures/concrete_wall_005/nor_gl.jpg', { repeat: [2.2, 0.85] }),
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: loadTex('./assets/textures/concrete_wall_005/rough.jpg', { repeat: [2.2, 0.85] }),
    roughness: 0.90,
    metalness: 0.0,
    color: new THREE.Color('#ffffff')
  });

  // Brushed aluminum / stainless steel (ambientCG Metal049A)
  const aluminum = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/Metal049A/Color.jpg', { srgb: true, repeat: [4, 1] }),
    normalMap: loadTex('./assets/textures/Metal049A/NormalGL.jpg', { repeat: [4, 1] }),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: loadTex('./assets/textures/Metal049A/Roughness.jpg', { repeat: [4, 1] }),
    metalnessMap: loadTex('./assets/textures/Metal049A/Metalness.jpg', { repeat: [4, 1] }),
    roughness: 0.34,
    metalness: 0.88,
    color: new THREE.Color('#dfe4ea')
  });

  // Dark anodized aluminum sash frame
  const darkSash = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/Metal049A/Color.jpg', { srgb: true, repeat: [2, 2] }),
    roughnessMap: loadTex('./assets/textures/Metal049A/Roughness.jpg', { repeat: [2, 2] }),
    roughness: 0.42,
    metalness: 0.78,
    color: new THREE.Color('#4a4e54')
  });

  // Natural oak wood for indoor sill / engawa edge (Poly Haven oak_veneer_04)
  const oakWood = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/oak_veneer_04/diff.jpg', { srgb: true, repeat: [3.2, 1.8] }),
    normalMap: loadTex('./assets/textures/oak_veneer_04/nor_gl.jpg', { repeat: [3.2, 1.8] }),
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: loadTex('./assets/textures/oak_veneer_04/rough.jpg', { repeat: [3.2, 1.8] }),
    aoMap: loadTex('./assets/textures/oak_veneer_04/ao.jpg', { repeat: [3.2, 1.8] }),
    roughness: 0.72,
    metalness: 0.0,
    color: new THREE.Color('#d2b28a')
  });

  // Authentic Japanese Tatami mat (ambientCG Tatami002)
  const tatami = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/Tatami002/Color.jpg', { srgb: true, repeat: [2.2, 1.4] }),
    normalMap: loadTex('./assets/textures/Tatami002/NormalGL.jpg', { repeat: [2.2, 1.4] }),
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: loadTex('./assets/textures/Tatami002/Roughness.jpg', { repeat: [2.2, 1.4] }),
    aoMap: loadTex('./assets/textures/Tatami002/AmbientOcclusion.jpg', { repeat: [2.2, 1.4] }),
    aoMapIntensity: 0.65,
    roughness: 0.86,
    metalness: 0.0,
    color: new THREE.Color('#e6e3c8')
  });

  // Woven dark green/indigo tatami border (heri)
  const tatamiHeri = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/Fabric019/Color.jpg', { srgb: true, repeat: [12, 1] }),
    normalMap: loadTex('./assets/textures/Fabric019/NormalGL.jpg', { repeat: [12, 1] }),
    roughness: 0.88,
    metalness: 0.0,
    color: new THREE.Color('#35443a')
  });

  // Traditional woven rattan futon beater (ambientCG Wicker009A)
  const rattan = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/Wicker009A/Color.jpg', { srgb: true, repeat: [3.5, 1.0] }),
    normalMap: loadTex('./assets/textures/Wicker009A/NormalGL.jpg', { repeat: [3.5, 1.0] }),
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: loadTex('./assets/textures/Wicker009A/Roughness.jpg', { repeat: [3.5, 1.0] }),
    aoMap: loadTex('./assets/textures/Wicker009A/AmbientOcclusion.jpg', { repeat: [3.5, 1.0] }),
    roughness: 0.66,
    metalness: 0.0,
    color: new THREE.Color('#e6c28c')
  });

  // Darker bound rattan lashing strips
  const rattanBinding = new THREE.MeshStandardMaterial({
    map: loadTex('./assets/textures/Wicker009A/Color.jpg', { srgb: true, repeat: [2, 2] }),
    normalMap: loadTex('./assets/textures/Wicker009A/NormalGL.jpg', { repeat: [2, 2] }),
    roughness: 0.58,
    metalness: 0.0,
    color: new THREE.Color('#b6844b')
  });

  // Quilted Cotton Futon — Front (subtle woven Japanese linen/sakura)
  const futonFront = new THREE.MeshPhysicalMaterial({
    map: futonTex.frontMap,
    normalMap: futonTex.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: futonTex.roughMap,
    aoMap: futonTex.aoMap,
    aoMapIntensity: 0.55,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color('#fff7ec')
  });

  // Quilted Cotton Futon — Back (clean ivory cotton)
  const futonBack = new THREE.MeshPhysicalMaterial({
    map: futonTex.backMap,
    normalMap: futonTex.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: futonTex.roughMap,
    aoMap: futonTex.aoMap,
    aoMapIntensity: 0.5,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color('#fff9f0')
  });

  // Futon edge piping trim
  const futonPiping = new THREE.MeshPhysicalMaterial({
    map: loadTex('./assets/textures/Fabric019/Color.jpg', { srgb: true, repeat: [16, 1] }),
    normalMap: loadTex('./assets/textures/Fabric019/NormalGL.jpg', { repeat: [16, 1] }),
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.5,
    sheenRoughness: 0.8,
    color: new THREE.Color('#e3c8c2')
  });

  // Real matte polypropylene futon clip (ふとんばさみ)
  const futonClipWhite = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f1f3f5'),
    roughness: 0.38,
    metalness: 0.0
  });
  const futonClipAccent = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8cb5d8'),
    roughness: 0.42,
    metalness: 0.0
  });

  // Sliding door architectural glass
  const windowGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8f4fa'),
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.86,
    transparent: true,
    opacity: 0.36,
    ior: 1.5,
    reflectivity: 0.65
  });

  // Blown glass wind chime (風鈴)
  const chimeGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b8dff6'),
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0.82,
    transparent: true,
    opacity: 0.62,
    ior: 1.52,
    thickness: 0.008
  });

  // Cotton sleeve cuff for first-person forearm (soft natural blue-grey chambray cotton)
  const sleeveCotton = new THREE.MeshPhysicalMaterial({
    map: loadTex('./assets/textures/Fabric019/Color.jpg', { srgb: true, repeat: [4, 4] }),
    normalMap: loadTex('./assets/textures/Fabric019/NormalGL.jpg', { repeat: [4, 4] }),
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.45,
    sheenRoughness: 0.85,
    color: new THREE.Color('#e8cfc5')
  });

  const { skinMat, nailMat } = createSkinMaterials();
  const contactShadowTex = createContactShadowTexture();

  return {
    concreteFloor,
    concreteWall,
    balconyParapet,
    aluminum,
    darkSash,
    oakWood,
    tatami,
    tatamiHeri,
    rattan,
    rattanBinding,
    futonFront,
    futonBack,
    futonPiping,
    futonClipWhite,
    futonClipAccent,
    windowGlass,
    chimeGlass,
    sleeveCotton,
    skinMat,
    nailMat,
    contactShadowTex
  };
}
