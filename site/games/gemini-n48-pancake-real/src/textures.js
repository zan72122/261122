import * as THREE from 'three';

/**
 * Deterministic fast PRNG for consistent photorealistic textures.
 */
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

/**
 * Smooth 2D value noise with FBM.
 */
function createNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    vals[i] = rand();
    perm[i] = i;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  function hash(x, y) {
    return vals[perm[(perm[x & 255] + (y & 255)) & 255]];
  }

  function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, y, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      val += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.02;
    }
    return val / norm;
  }

  return { noise, fbm };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, { colorSpace = THREE.SRGBColorSpace, repeat = [1, 1], anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a high-contrast sunlit weekend-morning kitchen PMREM environment map.
 * Crisp HDR morning window reflections on glass, amber maple syrup, ceramic, steel & eyes,
 * balanced against rich shaded interior walls for photographic depth.
 */
export function createMorningKitchenEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x3a2e25);

  const domeGeo = new THREE.SphereGeometry(20, 32, 20);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 floorCol = vec3(0.20, 0.13, 0.08);
        vec3 wallCol  = vec3(0.55, 0.47, 0.40);
        vec3 ceilCol  = vec3(0.84, 0.80, 0.75);
        vec3 skyCol   = vec3(0.76, 0.88, 1.0);

        float up = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(floorCol, wallCol, smoothstep(0.14, 0.52, up));
        col = mix(col, ceilCol, smoothstep(0.56, 0.94, up));

        // Cool morning sky fill from left window opening
        float leftWindow = smoothstep(-0.22, -0.78, d.x) * smoothstep(-0.04, 0.58, d.y);
        col = mix(col, skyCol * 1.45, leftWindow * 0.72);

        // Crisp bright golden morning sun disc through window
        vec3 sunDir = normalize(vec3(-0.78, 0.44, 0.14));
        float sunDot = max(dot(d, sunDir), 0.0);
        col += vec3(5.2, 3.8, 2.2) * pow(sunDot, 28.0);
        col += vec3(1.3, 0.95, 0.58) * pow(sunDot, 4.5);

        // Subtle warm bounce on opposite kitchen side
        vec3 bounceDir = normalize(vec3(0.68, 0.22, 0.45));
        col += vec3(0.32, 0.24, 0.18) * pow(max(dot(d, bounceDir), 0.0), 3.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(domeGeo, domeMat));

  // Divided sunlit window panes (gives realistic mullioned window reflection on glass carafe, eyes & ceramic!)
  const sunPaneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.6, 4.5, 3.1) });
  const skyPaneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 3.1, 3.8) });
  const panePositions = [
    [-10.2, 5.2, -2.4, sunPaneMat],
    [-10.2, 2.2, -2.4, sunPaneMat],
    [-10.2, 5.2, 1.6, skyPaneMat],
    [-10.2, 2.2, 1.6, skyPaneMat],
  ];
  for (const [px, py, pz, mat] of panePositions) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), mat);
    p.position.set(px, py, pz);
    p.lookAt(0, 0.8, 0);
    envScene.add(p);
  }

  // Soft warm ceiling bounce card
  const topCard = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 0.96, 0.86) })
  );
  topCard.position.set(1.5, 11, 0);
  topCard.rotation.x = Math.PI / 2;
  envScene.add(topCard);

  const rt = pmrem.fromScene(envScene, 0.032);
  pmrem.dispose();
  domeGeo.dispose();
  domeMat.dispose();
  return rt.texture;
}

/**
 * Natural wide-plank oiled white oak kitchen countertop (1024x512).
 * Organic cathedral grain, subtle timber tone shifts, zero repetitive CG striping.
 */
export function createWoodCounterTextures() {
  const w = 1024;
  const h = 512;
  const cCol = makeCanvas(w, h);
  const cRough = makeCanvas(w, h);
  const cBump = makeCanvas(w, h);
  const ctxC = cCol.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  const imgC = ctxC.createImageData(w, h);
  const imgR = ctxR.createImageData(w, h);
  const imgB = ctxB.createImageData(w, h);
  const n1 = createNoise2D(109);
  const n2 = createNoise2D(217);
  const n3 = createNoise2D(331);

  const plankCount = 4;
  const plankH = h / plankCount;

  for (let y = 0; y < h; y++) {
    const plankIdx = Math.floor(y / plankH);
    const localY = (y % plankH) / plankH;
    const seamDist = Math.min(localY, 1 - localY);
    const seamMask = Math.min(1, seamDist * 46);
    const plankTone = 0.90 + ((plankIdx * 29 + 3) % 9) * 0.022;
    const plankWarm = ((plankIdx * 17) % 5) * 2.5 - 5.0;
    const offsetX = plankIdx * 17.3;
    const offsetY = plankIdx * 9.1;

    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      // Gentle cathedral wave grain (low frequency along x, natural ring density across plank)
      const drift = n1.fbm(u * 2.0 + offsetX, localY * 3.5 + offsetY, 3);
      const fineWarp = n2.fbm(u * 8.0 + offsetX, localY * 14.0 + offsetY, 3) * 0.25;
      const ringPhase = (localY * 14.0 + drift * 5.2 + fineWarp * 2.8) * Math.PI;
      const grain = Math.pow(0.5 + 0.5 * Math.sin(ringPhase), 1.35);

      // Subtle oak medullary rays & fine elongated wood pores
      const fibers = n3.fbm(u * 26 + offsetX, v * 195, 3);
      const pore = fibers < 0.33 ? (0.33 - fibers) * 2.5 : 0;
      const ray = n2.noise(u * 14 + offsetX, v * 48) > 0.78 ? 0.06 : 0;

      // Rich natural matte-oiled warm oak (calibrated so morning sunlight never blows it out!)
      let r = (146 + grain * 26 - pore * 48 + ray * 18 + plankWarm) * plankTone;
      let g = (106 + grain * 21 - pore * 38 + ray * 13 + plankWarm * 0.6) * plankTone;
      let b = (73 + grain * 14 - pore * 27 + ray * 8) * plankTone;

      // Subtle bevel groove between wide oak boards
      r *= 0.64 + 0.36 * seamMask;
      g *= 0.62 + 0.38 * seamMask;
      b *= 0.60 + 0.40 * seamMask;

      const idx = (y * w + x) * 4;
      imgC.data[idx] = Math.max(0, Math.min(255, r));
      imgC.data[idx + 1] = Math.max(0, Math.min(255, g));
      imgC.data[idx + 2] = Math.max(0, Math.min(255, b));
      imgC.data[idx + 3] = 255;

      // Satin-matte natural beeswax oiled oak roughness (0.42..0.72)
      const roughVal = Math.max(
        0,
        Math.min(255, (0.44 + (1 - grain) * 0.14 + pore * 0.28 + (1 - seamMask) * 0.24) * 255)
      );
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = roughVal;
      imgR.data[idx + 3] = 255;

      const bumpVal = Math.max(
        0,
        Math.min(255, (0.56 + grain * 0.14 - pore * 0.36 - (1 - seamMask) * 0.46) * 255)
      );
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = bumpVal;
      imgB.data[idx + 3] = 255;
    }
  }

  ctxC.putImageData(imgC, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return {
    map: finalizeTexture(cCol, { repeat: [1.35, 1.15] }),
    roughnessMap: finalizeTexture(cRough, { colorSpace: THREE.NoColorSpace, repeat: [1.35, 1.15] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: [1.35, 1.15] }),
  };
}

/**
 * Handcrafted Japanese glazed ceramic subway tile backsplash (512x512)
 * Rich warm ivory-greige tone so golden window light patches & mullion shadows shine clearly!
 */
export function createTileBacksplashTextures() {
  const s = 512;
  const cCol = makeCanvas(s, s);
  const cRough = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  // Authentic recessed sand-grey mortar grout
  ctxC.fillStyle = '#aba195';
  ctxC.fillRect(0, 0, s, s);
  ctxR.fillStyle = '#e8e8e8';
  ctxR.fillRect(0, 0, s, s);
  ctxB.fillStyle = '#242424';
  ctxB.fillRect(0, 0, s, s);

  const rand = mulberry32(419);
  const rows = 8;
  const cols = 4;
  const th = s / rows;
  const tw = s / cols;
  const gap = 4.5;

  for (let r = 0; r < rows; r++) {
    const shift = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + shift + gap * 0.5;
      const y = r * th + gap * 0.5;
      const w = tw - gap;
      const h = th - gap;

      // Subtle handmade zellige / artisan tile shade & warmth variation
      const v = (rand() - 0.5) * 16;
      const cr = Math.round(204 + v);
      const cg = Math.round(195 + v * 0.92);
      const cb = Math.round(182 + v * 0.85);

      const grad = ctxC.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, `rgb(${Math.min(255, cr + 7)},${Math.min(255, cg + 6)},${Math.min(255, cb + 4)})`);
      grad.addColorStop(0.55, `rgb(${cr},${cg},${cb})`);
      grad.addColorStop(1, `rgb(${cr - 10},${cg - 10},${cb - 11})`);
      ctxC.fillStyle = grad;
      ctxC.fillRect(x, y, w, h);

      // Subtle organic ceramic glaze pooling around edges
      ctxC.strokeStyle = `rgba(148, 134, 118, 0.22)`;
      ctxC.lineWidth = 2.0;
      ctxC.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Glazed tile roughness with slight artisanal ripple
      const rv = Math.round(52 + rand() * 32);
      ctxR.fillStyle = `rgb(${rv},${rv},${rv})`;
      ctxR.fillRect(x, y, w, h);

      // Hand-pressed subtle pillow bevel
      const bGrad = ctxB.createLinearGradient(x, y, x, y + h);
      bGrad.addColorStop(0, '#9a9a9a');
      bGrad.addColorStop(0.14, '#ebebeb');
      bGrad.addColorStop(0.5, '#f6f6f6');
      bGrad.addColorStop(0.86, '#e0e0e0');
      bGrad.addColorStop(1, '#858585');
      ctxB.fillStyle = bGrad;
      ctxB.fillRect(x, y, w, h);
    }
  }

  return {
    map: finalizeTexture(cCol, { repeat: [3.2, 2.0] }),
    roughnessMap: finalizeTexture(cRough, { colorSpace: THREE.NoColorSpace, repeat: [3.2, 2.0] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: [3.2, 2.0] }),
  };
}

/**
 * Seasoned cast-iron skillet micro-pitted dark surface with warm oil sheen (512x512)
 */
export function createCastIronTextures() {
  const s = 512;
  const cCol = makeCanvas(s, s);
  const cRough = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  const imgC = ctxC.createImageData(s, s);
  const imgR = ctxR.createImageData(s, s);
  const imgB = ctxB.createImageData(s, s);
  const n = createNoise2D(707);
  const nFine = createNoise2D(808);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const v = y / s;
      const cx = u - 0.5;
      const cy = v - 0.5;
      const rad = Math.sqrt(cx * cx + cy * cy);

      const macro = n.fbm(u * 8, v * 8, 3);
      const pits = nFine.fbm(u * 92, v * 92, 3);
      const oilCenter = Math.max(0, 1 - rad * 2.05);

      const base = 22 + macro * 13 + pits * 9;
      const idx = (y * s + x) * 4;
      imgC.data[idx] = Math.min(255, base + oilCenter * 5);
      imgC.data[idx + 1] = Math.min(255, base * 0.96 + oilCenter * 3);
      imgC.data[idx + 2] = Math.min(255, base * 0.92);
      imgC.data[idx + 3] = 255;

      const rVal = (0.48 - oilCenter * 0.22 + (0.5 - pits) * 0.22 + (macro - 0.5) * 0.1) * 255;
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = Math.max(32, Math.min(212, rVal));
      imgR.data[idx + 3] = 255;

      const bVal = (0.5 + (pits - 0.5) * 0.72 + (macro - 0.5) * 0.2) * 255;
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = Math.max(0, Math.min(255, bVal));
      imgB.data[idx + 3] = 255;
    }
  }

  ctxC.putImageData(imgC, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return {
    map: finalizeTexture(cCol, { repeat: [1, 1] }),
    roughnessMap: finalizeTexture(cRough, { colorSpace: THREE.NoColorSpace, repeat: [1, 1] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: [1, 1] }),
  };
}

/**
 * Artisanal Japanese stoneware ceramic plate texture (speckled warm cream glaze, 512x512)
 */
export function createStonewareTextures() {
  const s = 512;
  const cCol = makeCanvas(s, s);
  const cRough = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxR = cRough.getContext('2d');

  const grad = ctxC.createRadialGradient(s * 0.5, s * 0.5, s * 0.04, s * 0.5, s * 0.5, s * 0.52);
  grad.addColorStop(0, '#eee7dc');
  grad.addColorStop(0.72, '#e6ddcf');
  grad.addColorStop(0.91, '#d3c4ae');
  grad.addColorStop(1, '#b59d82');
  ctxC.fillStyle = grad;
  ctxC.fillRect(0, 0, s, s);

  ctxR.fillStyle = '#404040';
  ctxR.fillRect(0, 0, s, s);

  const rand = mulberry32(909);
  ctxC.strokeStyle = 'rgba(165,145,120,0.09)';
  for (let r = 18; r < s * 0.5; r += 5) {
    ctxC.beginPath();
    ctxC.arc(s * 0.5, s * 0.5, r, 0, Math.PI * 2);
    ctxC.stroke();
  }
  for (let i = 0; i < 720; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const rad = 0.5 + rand() * 1.4;
    const alpha = 0.14 + rand() * 0.34;
    ctxC.fillStyle = `rgba(92, 70, 50, ${alpha})`;
    ctxC.beginPath();
    ctxC.arc(x, y, rad, 0, Math.PI * 2);
    ctxC.fill();

    ctxR.fillStyle = `rgba(148, 148, 148, ${alpha})`;
    ctxR.beginPath();
    ctxR.arc(x, y, rad * 1.1, 0, Math.PI * 2);
    ctxR.fill();
  }

  return {
    map: finalizeTexture(cCol, { repeat: [1, 1] }),
    roughnessMap: finalizeTexture(cRough, { colorSpace: THREE.NoColorSpace, repeat: [1, 1] }),
  };
}

/**
 * Woven linen / soft ribbed cotton knit texture for Mama's apron & sweater (512x512)
 */
export function createLinenTextures(baseRGB = [220, 208, 190], { knitRib = false } = {}) {
  const s = 512;
  const cCol = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const imgC = ctxC.createImageData(s, s);
  const imgB = ctxB.createImageData(s, s);
  const n = createNoise2D(knitRib ? 1223 : 1111);

  for (let y = 0; y < s; y++) {
    const weft = Math.sin((y / s) * Math.PI * (knitRib ? 140 : 128));
    for (let x = 0; x < s; x++) {
      const warp = Math.sin((x / s) * Math.PI * (knitRib ? 140 : 128));
      // Subtle soft heather cotton-wool knit (NO harsh accordion stripes!)
      const fineKnit = knitRib ? Math.sin((x / s) * Math.PI * 84) * 3.5 : 0;
      const slub = (n.fbm(x * 0.045, y * 0.045, 3) - 0.5) * 16;
      const weave = (warp * 0.5 + weft * 0.5) * (knitRib ? 5.5 : 7) + fineKnit;
      const idx = (y * s + x) * 4;
      imgC.data[idx] = Math.max(0, Math.min(255, baseRGB[0] + weave + slub));
      imgC.data[idx + 1] = Math.max(0, Math.min(255, baseRGB[1] + weave + slub * 0.95));
      imgC.data[idx + 2] = Math.max(0, Math.min(255, baseRGB[2] + weave + slub * 0.9));
      imgC.data[idx + 3] = 255;

      const b = Math.max(0, Math.min(255, 128 + (warp + weft) * 30 + fineKnit * 2.2 + slub * 1.8));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = b;
      imgB.data[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return {
    map: finalizeTexture(cCol, { repeat: knitRib ? [3.6, 3.6] : [3.2, 3.2] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: knitRib ? [3.6, 3.6] : [3.2, 3.2] }),
  };
}

/**
 * Natural human skin micro-texture (velvety matte pores, warm golden-peach East Asian tone,
 * very subtle cheek warmth — zero red nose, zero plastic shine! 512x512)
 */
export function createSkinTextures({ cheekBlush = false } = {}) {
  const s = 512;
  const cCol = makeCanvas(s, s);
  const cRough = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  const imgC = ctxC.createImageData(s, s);
  const imgR = ctxR.createImageData(s, s);
  const imgB = ctxB.createImageData(s, s);
  const nMacro = createNoise2D(1515);
  const nMicro = createNoise2D(1616);

  for (let y = 0; y < s; y++) {
    const v = y / s;
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const macro = nMacro.fbm(u * 5.5, v * 5.5, 3);
      const pores = nMicro.fbm(u * 92, v * 92, 3);

      // Soft warm fair-peach natural East Asian skin tone (hands/forearms slightly warmer under direct sun!)
      let r = (cheekBlush ? 220 : 210) + (macro - 0.5) * 11 - (0.5 - pores) * 5;
      let g = (cheekBlush ? 178 : 165) + (macro - 0.5) * 10 - (0.5 - pores) * 5;
      let b = (cheekBlush ? 150 : 136) + (macro - 0.5) * 9 - (0.5 - pores) * 5;

      if (cheekBlush) {
        // Gentle healthy rose warmth ONLY on outer cheeks (never reddening the nose!)
        const signedU = u - 0.25;
        const dL = Math.hypot((signedU + 0.088) * 6.5, (v - 0.56) * 5.0);
        const dR = Math.hypot((signedU - 0.088) * 6.5, (v - 0.56) * 5.0);
        const blush = Math.pow(Math.max(0, 1 - dL), 1.8) + Math.pow(Math.max(0, 1 - dR), 1.8);
        r = Math.min(255, r + blush * 8);
        g = Math.max(0, g - blush * 10);
        b = Math.max(0, b - blush * 8);

        // Very subtle soft eye socket contour shading
        const oL = Math.hypot((signedU + 0.052) * 10.5, (v - 0.475) * 11.5);
        const oR = Math.hypot((signedU - 0.052) * 10.5, (v - 0.475) * 11.5);
        const socketTint = Math.pow(Math.max(0, 1 - oL), 1.6) + Math.pow(Math.max(0, 1 - oR), 1.6);
        r -= socketTint * 8;
        g -= socketTint * 10;
        b -= socketTint * 9;
      }

      const idx = (y * s + x) * 4;
      imgC.data[idx] = Math.max(0, Math.min(255, r));
      imgC.data[idx + 1] = Math.max(0, Math.min(255, g));
      imgC.data[idx + 2] = Math.max(0, Math.min(255, b));
      imgC.data[idx + 3] = 255;

      const rv = (0.66 + (0.5 - pores) * 0.14 + (macro - 0.5) * 0.08) * 255;
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = Math.max(138, Math.min(218, rv));
      imgR.data[idx + 3] = 255;

      const bv = (0.5 + (pores - 0.5) * 0.42) * 255;
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = Math.max(0, Math.min(255, bv));
      imgB.data[idx + 3] = 255;
    }
  }

  ctxC.putImageData(imgC, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return {
    map: finalizeTexture(cCol, { repeat: [1, 1] }),
    roughnessMap: finalizeTexture(cRough, { colorSpace: THREE.NoColorSpace, repeat: [1, 1] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: [1, 1] }),
  };
}

/**
 * Photorealistic warm dark-brown human eye texture (256x256)
 */
export function createEyeTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');

  // Natural soft warm sclera with gentle edge shading
  const scleraGrad = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.18, s * 0.5, s * 0.5, s * 0.52);
  scleraGrad.addColorStop(0.0, '#ede7e1');
  scleraGrad.addColorStop(0.7, '#e2d7cf');
  scleraGrad.addColorStop(1.0, '#c8b3aa');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, s, s);

  const cx = s * 0.5;
  const cy = s * 0.5;
  const irisR = s * 0.245;

  // Deep expressive warm chestnut-espresso iris
  const irisGrad = ctx.createRadialGradient(cx, cy, irisR * 0.2, cx, cy, irisR);
  irisGrad.addColorStop(0.0, '#100805');
  irisGrad.addColorStop(0.38, '#321b0e');
  irisGrad.addColorStop(0.72, '#4e2d18');
  irisGrad.addColorStop(0.88, '#26140b');
  irisGrad.addColorStop(1.0, '#160d08');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  const rand = mulberry32(2323);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2 + (rand() - 0.5) * 0.04;
    const r0 = irisR * 0.36;
    const r1 = irisR * (0.76 + rand() * 0.14);
    ctx.strokeStyle = `rgba(145, 92, 48, ${0.14 + rand() * 0.22})`;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Deep pupil
  ctx.fillStyle = '#080504';
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.43, 0, Math.PI * 2);
  ctx.fill();

  // Warm morning window corneal catchlight (upper-left window reflection + tiny secondary dot)
  ctx.fillStyle = 'rgba(255, 250, 236, 0.90)';
  ctx.beginPath();
  ctx.ellipse(cx - irisR * 0.32, cy - irisR * 0.28, irisR * 0.16, irisR * 0.13, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 245, 224, 0.48)';
  ctx.beginPath();
  ctx.arc(cx + irisR * 0.24, cy + irisR * 0.22, irisR * 0.06, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Fine anisotropic dark-chestnut hair strand texture (512x512)
 */
export function createHairTextures() {
  const s = 512;
  const cCol = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxB = cBump.getContext('2d');

  ctxC.fillStyle = '#20140e';
  ctxC.fillRect(0, 0, s, s);
  ctxB.fillStyle = '#747474';
  ctxB.fillRect(0, 0, s, s);

  const rand = mulberry32(3137);
  for (let i = 0; i < 1800; i++) {
    const x = rand() * s;
    const shade = Math.floor(20 + rand() * 34);
    ctxC.strokeStyle = `rgb(${shade + 18}, ${shade + 7}, ${shade + 1})`;
    ctxC.lineWidth = 0.7 + rand() * 1.3;
    ctxC.beginPath();
    ctxC.moveTo(x, 0);
    ctxC.bezierCurveTo(
      x + (rand() - 0.5) * 12,
      s * 0.33,
      x + (rand() - 0.5) * 12,
      s * 0.66,
      x + (rand() - 0.5) * 6,
      s
    );
    ctxC.stroke();

    const bv = Math.floor(80 + rand() * 135);
    ctxB.strokeStyle = `rgb(${bv},${bv},${bv})`;
    ctxB.lineWidth = 0.9;
    ctxB.beginPath();
    ctxB.moveTo(x, 0);
    ctxB.lineTo(x, s);
    ctxB.stroke();
  }

  return {
    map: finalizeTexture(cCol, { repeat: [2.4, 1.8] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: [2.4, 1.8] }),
  };
}

/**
 * Organic porous pancake noise map (512x512 linear data texture)
 * R: macro Maillard mottling, G: medium baked air pores, B: fine velvety crumb, A: outer ring variation
 */
export function createPancakeNoiseTexture() {
  const s = 512;
  const data = new Uint8Array(s * s * 4);
  const nMacro = createNoise2D(4141);
  const nMed = createNoise2D(4242);
  const nFine = createNoise2D(4343);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const v = y / s;
      const r = nMacro.fbm(u * 6.5, v * 6.5, 4);
      const g = nMed.fbm(u * 26.0, v * 26.0, 3);
      const b = nFine.fbm(u * 84.0, v * 84.0, 2);
      const a = nMacro.fbm(u * 11.0 + 4.1, v * 11.0 + 2.3, 3);
      const idx = (y * s + x) * 4;
      data[idx] = Math.floor(r * 255);
      data[idx + 1] = Math.floor(g * 255);
      data[idx + 2] = Math.floor(b * 255);
      data[idx + 3] = Math.floor(a * 255);
    }
  }

  const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Ripe strawberry seeded glossy skin texture (256x256)
 */
export function createStrawberryTextures() {
  const s = 256;
  const cCol = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxB = cBump.getContext('2d');

  const grad = ctxC.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, '#dc4232');
  grad.addColorStop(0.18, '#c2181f');
  grad.addColorStop(0.75, '#9d0f17');
  grad.addColorStop(1, '#700810');
  ctxC.fillStyle = grad;
  ctxC.fillRect(0, 0, s, s);

  ctxB.fillStyle = '#cccccc';
  ctxB.fillRect(0, 0, s, s);

  const rows = 14;
  const cols = 18;
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + (r % 2) * 0.5) / cols) * s;
      const y = (r / rows) * s;

      ctxB.fillStyle = '#383838';
      ctxB.beginPath();
      ctxB.ellipse(x, y, 3.2, 4.4, 0, 0, Math.PI * 2);
      ctxB.fill();

      ctxC.fillStyle = '#d4a14c';
      ctxC.beginPath();
      ctxC.ellipse(x, y, 1.35, 2.25, 0, 0, Math.PI * 2);
      ctxC.fill();
    }
  }

  return {
    map: finalizeTexture(cCol, { repeat: [1, 1] }),
    bumpMap: finalizeTexture(cBump, { colorSpace: THREE.NoColorSpace, repeat: [1, 1] }),
  };
}

/**
 * Soft contact ambient occlusion shadow decal texture (128x128)
 * Grounds every dish, bowl, carafe & stove solidly onto the oak counter!
 */
export function createContactShadowTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.08, s * 0.5, s * 0.5, s * 0.5);
  grad.addColorStop(0.0, 'rgba(32, 18, 8, 0.72)');
  grad.addColorStop(0.45, 'rgba(32, 18, 8, 0.42)');
  grad.addColorStop(0.78, 'rgba(32, 18, 8, 0.12)');
  grad.addColorStop(1.0, 'rgba(32, 18, 8, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft glowing radial bokeh dust mote texture (64x64)
 */
export function createDustMoteTexture() {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.5);
  grad.addColorStop(0, 'rgba(255, 250, 232, 1.0)');
  grad.addColorStop(0.32, 'rgba(255, 240, 200, 0.72)');
  grad.addColorStop(0.7, 'rgba(255, 224, 165, 0.18)');
  grad.addColorStop(1, 'rgba(255, 224, 165, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Delicate realistic wispy steam puff texture (128x128)
 */
export function createSteamTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const n = createNoise2D(5555);
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x / s - 0.5) * 2;
      const dy = (y / s - 0.5) * 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      const radial = Math.max(0, 1 - r);
      const wisp = n.fbm((x / s) * 4.5, (y / s) * 4.5, 3);
      const alpha = Math.pow(radial, 1.75) * (0.45 + 0.55 * wisp);
      const idx = (y * s + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 250;
      img.data[idx + 2] = 242;
      img.data[idx + 3] = Math.floor(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
