import * as THREE from '../lib/three.module.js';

// Deterministic fast PRNG & 2D value/fbm noise for crisp procedural PBR maps (all <= 1024px)
function hash2(x, y, seed = 1) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2(x, y, seed = 1) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4, seed = 1) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * freq, y * freq, seed + i * 17);
    freq *= 2.02;
    amp *= 0.5;
  }
  return v;
}

function heightToNormalCanvas(heightData, w, h, strength = 2.5) {
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(w, h);
  const out = img.data;
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (heightData[y * w + xp] - heightData[y * w + xm]) * strength;
      const dy = (heightData[yp * w + x] - heightData[ym * w + x]) * strength;
      let nx = -dx, ny = -dy, nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const idx = (y * w + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createAllTextures() {
  const textures = {};

  // 1. Donabe Stoneware Ceramic (Banko-yaki dark glazed & unglazed clay, 512x512)
  {
    const w = 512, h = 512;
    const cMap = document.createElement('canvas');
    cMap.width = w; cMap.height = h;
    const ctx = cMap.getContext('2d');
    const img = ctx.createImageData(w, h);
    const rCvs = document.createElement('canvas');
    rCvs.width = w; rCvs.height = h;
    const rCtx = rCvs.getContext('2d');
    const rImg = rCtx.createImageData(w, h);
    const hData = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      const v = 1.0 - y / h; // uv.y: 0 = bottom clay foot, 1 = glazed rim & interior bowl!
      const ring = Math.sin(v * Math.PI * 46) * 0.06;
      const glazeMask = Math.min(1, Math.max(0, (v - 0.12) * 9.0));
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const ang = u * Math.PI * 2;
        const nx = Math.cos(ang) * 4.5;
        const grain = fbm(nx * 6, v * 28, 4, 3);
        const speck = hash2(Math.floor(u * 260), Math.floor(v * 260), 11);
        const crackle = Math.abs(fbm(nx * 11, v * 45, 3, 21) - 0.5);
        const crackLine = crackle < 0.016 ? 1 : 0;

        const idx = (y * w + x) * 4;
        // Unglazed dark clay foot vs authentic deep kuro-donabe black-charcoal glaze
        let r = 38 + grain * 14, g = 29 + grain * 10, b = 24 + grain * 8;
        const pool = fbm(nx * 3.2, v * 9.5, 4, 44);
        const gr = 12 + pool * 10 + (speck > 0.988 ? 32 : 0);
        const gg = 11 + pool * 8 + (speck > 0.988 ? 26 : 0);
        const gb = 10 + pool * 7 + (speck > 0.988 ? 20 : 0);

        r = r * (1 - glazeMask) + gr * glazeMask;
        g = g * (1 - glazeMask) + gg * glazeMask;
        b = b * (1 - glazeMask) + gb * glazeMask;

        if (speck > 0.97 && glazeMask < 0.6) {
          r += 38; g += 30; b += 22;
        }
        img.data[idx] = Math.min(255, r);
        img.data[idx + 1] = Math.min(255, g);
        img.data[idx + 2] = Math.min(255, b);
        img.data[idx + 3] = 255;

        const rough = (1 - glazeMask) * (0.76 + grain * 0.16) + glazeMask * (0.11 + pool * 0.12 + crackLine * 0.18);
        const rv = Math.round(Math.min(1, Math.max(0.05, rough)) * 255);
        rImg.data[idx] = rv; rImg.data[idx + 1] = rv; rImg.data[idx + 2] = rv; rImg.data[idx + 3] = 255;

        hData[y * w + x] = ring * (1 - glazeMask * 0.55) + grain * (0.45 - glazeMask * 0.28) - crackLine * 0.08 * glazeMask + (speck > 0.98 ? 0.15 : 0);
      }
    }
    ctx.putImageData(img, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    const map = new THREE.CanvasTexture(cMap);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const roughMap = new THREE.CanvasTexture(rCvs);
    roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
    textures.donabeMap = map;
    textures.donabeRough = roughMap;
    textures.donabeNormal = heightToNormalCanvas(hData, w, h, 2.8);
  }

  // 2. Solid Walnut / Keyaki Dining Table Wood (1024x1024 - max cap)
  {
    const w = 1024, h = 1024;
    const cMap = document.createElement('canvas');
    cMap.width = w; cMap.height = h;
    const ctx = cMap.getContext('2d');
    const img = ctx.createImageData(w, h);
    const rCvs = document.createElement('canvas');
    rCvs.width = w; rCvs.height = h;
    const rCtx = rCvs.getContext('2d');
    const rImg = rCtx.createImageData(w, h);
    const hData = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      // Subtle wide plank join lines (3 thick solid planks)
      const plankIdx = ny < 0.32 ? 0 : (ny < 0.68 ? 1 : 2);
      const seam = Math.min(Math.abs(ny - 0.32), Math.abs(ny - 0.68));
      const seamFactor = seam < 0.0025 ? (seam / 0.0025) : 1.0;
      const seedOff = plankIdx * 31;

      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(nx * 2.5, ny * 9.0, 4, 5 + seedOff) * 0.45;
        const cathedral = Math.sin(((ny - 0.18 - plankIdx * 0.33) * 18.0 + warp * 8.5) * Math.PI);
        const ringVal = Math.pow(0.5 + 0.5 * cathedral, 1.8);
        const finePore = noise2(nx * 220, ny * 38, 12 + seedOff);
        const ray = fbm(nx * 28, ny * 6, 3, 19 + seedOff);

        // Rich warm honey-walnut / keyaki color
        let r = 88 + ringVal * 38 + ray * 18 - (finePore > 0.84 ? 16 : 0);
        let g = 51 + ringVal * 23 + ray * 10 - (finePore > 0.84 ? 11 : 0);
        let b = 29 + ringVal * 13 + ray * 5 - (finePore > 0.84 ? 7 : 0);
        if (plankIdx === 1) { r += 5; g += 3; }

        r *= (0.55 + 0.45 * seamFactor);
        g *= (0.55 + 0.45 * seamFactor);
        b *= (0.55 + 0.45 * seamFactor);

        const idx = (y * w + x) * 4;
        img.data[idx] = Math.min(255, Math.max(0, r));
        img.data[idx + 1] = Math.min(255, Math.max(0, g));
        img.data[idx + 2] = Math.min(255, Math.max(0, b));
        img.data[idx + 3] = 255;

        const rough = 0.25 + (1 - ringVal) * 0.12 + (finePore > 0.84 ? 0.22 : 0) + (1 - seamFactor) * 0.35;
        const rv = Math.round(Math.min(1, rough) * 255);
        rImg.data[idx] = rv; rImg.data[idx + 1] = rv; rImg.data[idx + 2] = rv; rImg.data[idx + 3] = 255;

        hData[y * w + x] = ringVal * 0.16 - (finePore > 0.84 ? 0.22 : 0) - (1 - seamFactor) * 0.45;
      }
    }
    ctx.putImageData(img, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    const map = new THREE.CanvasTexture(cMap);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const roughMap = new THREE.CanvasTexture(rCvs);
    textures.woodMap = map;
    textures.woodRough = roughMap;
    textures.woodNormal = heightToNormalCanvas(hData, w, h, 2.0);
  }

  // 3. Napa Cabbage (白菜 - ivory white stem branching into ruffled green leaf veins, 512x512)
  {
    const w = 512, h = 512;
    const cMap = document.createElement('canvas');
    cMap.width = w; cMap.height = h;
    const ctx = cMap.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hData = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      // Flip v so uv.y = 1 (ruffled top of PlaneGeometry) is vibrant jade green leaf, uv.y = 0 is ivory stem!
      const v = 1.0 - y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const cx = u - 0.5;
        // Central stem tapers as v increases
        const stemHalfWidth = Math.max(0.018, 0.28 * (1.0 - v * 0.85));
        const inStem = Math.max(0, 1.0 - Math.pow(Math.abs(cx) / stemHalfWidth, 2.2));
        // Branching lateral veins
        const veinCoord = Math.abs(cx) * 12.0 - v * 7.5 + fbm(u * 8, v * 8, 3, 71) * 0.9;
        const lateralVein = Math.pow(Math.max(0, Math.cos(veinCoord * Math.PI)), 10.0) * Math.max(0, 1.0 - Math.abs(cx) * 1.65) * Math.min(1, v * 2.2);
        const microVein = Math.pow(Math.max(0, Math.cos((u * 26 + v * 18 + fbm(u * 12, v * 12, 2, 81)) * Math.PI)), 14.0) * 0.35;
        const veinMask = Math.min(1, inStem + lateralVein * 0.72 + microVein * 0.35);

        const crinkle = fbm(u * 18, v * 16, 4, 91);
        const leafGreenness = Math.min(1, Math.max(0, (v - 0.18) * 1.65)) * (1.0 - inStem * 0.86);

        // Ivory white rib -> lush winter hakusai emerald-jade crinkled leaf!
        const wr = 246 - crinkle * 12, wg = 248 - crinkle * 8, wb = 232 - crinkle * 16;
        const lr = 56 + crinkle * 46, lg = 152 + crinkle * 48, lb = 32 + crinkle * 22;

        let r = wr * (1 - leafGreenness) + lr * leafGreenness;
        let g = wg * (1 - leafGreenness) + lg * leafGreenness;
        let b = wb * (1 - leafGreenness) + lb * leafGreenness;
        // Brighten veins slightly
        r = r * (1 - lateralVein * 0.45) + 238 * (lateralVein * 0.45);
        g = g * (1 - lateralVein * 0.45) + 244 * (lateralVein * 0.45);
        b = b * (1 - lateralVein * 0.45) + 212 * (lateralVein * 0.45);

        const idx = (y * w + x) * 4;
        img.data[idx] = Math.min(255, r);
        img.data[idx + 1] = Math.min(255, g);
        img.data[idx + 2] = Math.min(255, b);
        img.data[idx + 3] = 255;

        // Fibrous longitudinal ridges on stem + crinkly leaf blisters
        const stemFiber = Math.sin(cx * 210) * 0.08 * inStem;
        hData[y * w + x] = veinMask * 0.42 + stemFiber + crinkle * 0.48 * leafGreenness;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = new THREE.CanvasTexture(cMap);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.hakusaiMap = map;
    textures.hakusaiNormal = heightToNormalCanvas(hData, w, h, 3.2);
  }

  // 4. Silky Momen/Kinu Tofu (豆腐 - warm soybean cream with fine cloth weave & tiny curd pores, 512x512)
  {
    const w = 512, h = 512;
    const cMap = document.createElement('canvas');
    cMap.width = w; cMap.height = h;
    const ctx = cMap.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hData = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const cloth = (Math.sin(u * Math.PI * 90) * Math.sin(v * Math.PI * 90)) * 0.06;
        const curd = fbm(u * 28, v * 28, 4, 105);
        const pore = hash2(Math.floor(u * 170), Math.floor(v * 170), 109) > 0.965 ? 1 : 0;

        const r = 247 - curd * 9 - pore * 14;
        const g = 242 - curd * 10 - pore * 14;
        const b = 226 - curd * 13 - pore * 16;
        const idx = (y * w + x) * 4;
        img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;

        hData[y * w + x] = cloth + curd * 0.22 - pore * 0.35;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = new THREE.CanvasTexture(cMap);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    textures.tofuMap = map;
    textures.tofuNormal = heightToNormalCanvas(hData, w, h, 1.9);
  }

  // 5. Shiitake Cap with Star Cross-Cut (飾り切り花椎茸, 512x512 polar UV centered at 0.5, 0.5)
  {
    const w = 512, h = 512;
    const cMap = document.createElement('canvas');
    cMap.width = w; cMap.height = h;
    const ctx = cMap.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hData = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x / w) * 2 - 1;
        const v = (y / h) * 2 - 1;
        const rad = Math.hypot(u, v);
        const ang = Math.atan2(v, u);

        // 3-line star decorative knife cut across top center of shiitake cap!
        let starCut = 0;
        if (rad < 0.62) {
          for (let k = 0; k < 3; k++) {
            const ka = (k * Math.PI) / 3 + 0.18;
            const dLine = Math.abs(-u * Math.sin(ka) + v * Math.cos(ka));
            const along = Math.abs(u * Math.cos(ka) + v * Math.sin(ka));
            const widthAt = 0.085 * (1.0 - Math.pow(along / 0.62, 1.7));
            if (along < 0.60 && dLine < widthAt) {
              const t = 1.0 - dLine / widthAt;
              starCut = Math.max(starCut, Math.pow(t, 0.65));
            }
          }
        }

        const capFibers = fbm(Math.cos(ang) * 4 + 5, rad * 12, 4, 131);
        const naturalCracks = Math.max(0, fbm(u * 9, v * 9, 3, 141) - 0.66) * 1.8 * (rad > 0.25 && rad < 0.85 ? 1 : 0);
        const whiteFlesh = Math.min(1, starCut + naturalCracks * 0.55);

        // Rich velvety dark chestnut cap vs creamy ivory inner flesh
        const cr = 74 + capFibers * 36 - rad * 18;
        const cg = 43 + capFibers * 22 - rad * 12;
        const cb = 25 + capFibers * 12 - rad * 8;

        const fr = 236 - capFibers * 18;
        const fg = 223 - capFibers * 20;
        const fb = 198 - capFibers * 24;

        const idx = (y * w + x) * 4;
        img.data[idx] = Math.round(cr * (1 - whiteFlesh) + fr * whiteFlesh);
        img.data[idx + 1] = Math.round(cg * (1 - whiteFlesh) + fg * whiteFlesh);
        img.data[idx + 2] = Math.round(cb * (1 - whiteFlesh) + fb * whiteFlesh);
        img.data[idx + 3] = 255;

        hData[y * w + x] = capFibers * 0.32 - starCut * 0.75 - naturalCracks * 0.25;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = new THREE.CanvasTexture(cMap);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.shiitakeMap = map;
    textures.shiitakeNormal = heightToNormalCanvas(hData, w, h, 3.4);
  }

  // 6. Cable-Knit Wool Sweater Normal & Albedo Grain (512x512 repeatable)
  {
    const w = 512, h = 512;
    const hData = new Float32Array(w * h);
    const aoCvs = document.createElement('canvas');
    aoCvs.width = w; aoCvs.height = h;
    const aoCtx = aoCvs.getContext('2d');
    const aoImg = aoCtx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        // Ribbed V-stitch knit pattern
        const cols = 36, rows = 52;
        const cu = (u * cols) % 1;
        const side = cu < 0.5 ? 0 : 1;
        const lx = side === 0 ? cu * 2 : (1 - cu) * 2;
        const stitchY = (v * rows + lx * 0.55) % 1;
        const stitchArch = Math.sin(stitchY * Math.PI) * Math.sin(lx * Math.PI * 0.92);
        const yarnTwist = Math.sin((u * cols * 4 + v * rows * 2) * Math.PI) * 0.08;
        const fuzz = noise2(u * 180, v * 180, 201) * 0.12;
        const height = stitchArch * 0.75 + yarnTwist + fuzz;
        hData[y * w + x] = height;

        const shade = Math.round((0.68 + stitchArch * 0.28 + fuzz * 0.2) * 255);
        const idx = (y * w + x) * 4;
        aoImg.data[idx] = shade; aoImg.data[idx + 1] = shade; aoImg.data[idx + 2] = shade; aoImg.data[idx + 3] = 255;
      }
    }
    aoCtx.putImageData(aoImg, 0, 0);
    const aoTex = new THREE.CanvasTexture(aoCvs);
    aoTex.wrapS = aoTex.wrapT = THREE.RepeatWrapping;
    aoTex.repeat.set(4, 4);
    const normTex = heightToNormalCanvas(hData, w, h, 3.0);
    normTex.repeat.set(4, 4);
    textures.knitAO = aoTex;
    textures.knitNormal = normTex;
  }

  // 7. Human Skin Micro-Pore Normal Map & Realistic Iris Texture (256x256)
  {
    const w = 256, h = 256;
    const hData = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const pore = fbm(u * 64, v * 64, 3, 301);
        const cell = Math.sin(u * 180) * Math.sin(v * 180) * 0.05;
        hData[y * w + x] = pore * 0.18 + cell;
      }
    }
    const skinNorm = heightToNormalCanvas(hData, w, h, 0.85);
    skinNorm.repeat.set(3, 3);
    textures.skinNormal = skinNorm;

    // Eye sclera + warm dark-brown Japanese iris + crisp pupil
    const iCvs = document.createElement('canvas');
    iCvs.width = 256; iCvs.height = 256;
    const iCtx = iCvs.getContext('2d');
    const iImg = iCtx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const dx = (x / 256) * 2 - 1;
        const dy = (y / 256) * 2 - 1;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        let cr = 244, cg = 239, cb = 235; // warm natural sclera (never stark 255 blue-white)
        if (r > 0.56) {
          // Subtle sclera pinkness toward outer corner
          const edge = Math.min(1, (r - 0.56) * 1.8);
          cr -= edge * 10; cg -= edge * 22; cb -= edge * 24;
        }
        if (r < 0.50) {
          // Limbal ring -> warm chestnut iris with radial stroma -> dark pupil
          const ir = r / 0.50;
          if (ir < 0.36) {
            // Pupil
            cr = 10; cg = 8; cb = 8;
          } else {
            const fiber = fbm(Math.cos(a) * 9 + 4, Math.sin(a) * 9 + ir * 6, 3, 333);
            const limbal = Math.pow(Math.max(0, (ir - 0.74) / 0.26), 1.4);
            cr = (68 + fiber * 44) * (1 - limbal * 0.72);
            cg = (38 + fiber * 25) * (1 - limbal * 0.75);
            cb = (22 + fiber * 14) * (1 - limbal * 0.78);
          }
        } else if (r < 0.53) {
          // Soft transition at iris border
          const t = (r - 0.50) / 0.03;
          cr = 22 * (1 - t) + cr * t;
          cg = 14 * (1 - t) + cg * t;
          cb = 10 * (1 - t) + cb * t;
        }
        const idx = (y * 256 + x) * 4;
        iImg.data[idx] = cr; iImg.data[idx + 1] = cg; iImg.data[idx + 2] = cb; iImg.data[idx + 3] = 255;
      }
    }
    iCtx.putImageData(iImg, 0, 0);
    const eyeTex = new THREE.CanvasTexture(iCvs);
    eyeTex.colorSpace = THREE.SRGBColorSpace;
    textures.eyeMap = eyeTex;
  }

  // 8. Soft Wisp Steam Texture (256x256 cloudy FBM alpha) & Bamboo Weave (512x512)
  {
    const w = 256, h = 256;
    const sCvs = document.createElement('canvas');
    sCvs.width = w; sCvs.height = h;
    const sCtx = sCvs.getContext('2d');
    const sImg = sCtx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x / w) * 2 - 1;
        const dy = (y / h) * 2 - 1;
        const r = Math.hypot(dx, dy);
        const falloff = Math.pow(Math.max(0, 1 - r), 2.1);
        const cloud = fbm(x / 42, y / 42, 4, 401);
        const alpha = Math.min(1, falloff * (0.45 + cloud * 0.85));
        const idx = (y * w + x) * 4;
        sImg.data[idx] = 255;
        sImg.data[idx + 1] = 252;
        sImg.data[idx + 2] = 246;
        sImg.data[idx + 3] = Math.round(alpha * 255);
      }
    }
    sCtx.putImageData(sImg, 0, 0);
    const steamTex = new THREE.CanvasTexture(sCvs);
    textures.steamMap = steamTex;

    // Woven Bamboo Zaru (竹ざる, 512x512)
    const bw = 512, bh = 512;
    const bCvs = document.createElement('canvas');
    bCvs.width = bw; bCvs.height = bh;
    const bCtx = bCvs.getContext('2d');
    const bImg = bCtx.createImageData(bw, bh);
    const bHeight = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const u = x / bw, v = y / bh;
        const su = u * 18, sv = v * 18;
        const iu = Math.floor(su), iv = Math.floor(sv);
        const fu = su - iu, fv = sv - iv;
        const overH = (iu + iv) % 2 === 0;
        const archH = Math.sin(fv * Math.PI) * (0.75 + 0.25 * Math.cos((fu - 0.5) * Math.PI));
        const archV = Math.sin(fu * Math.PI) * (0.75 + 0.25 * Math.cos((fv - 0.5) * Math.PI));
        const hVal = overH ? archH : archV;
        const fiber = noise2((overH ? u * 160 : u * 25), (overH ? v * 25 : v * 160), 501);
        bHeight[y * bw + x] = hVal * 0.65 + fiber * 0.1;

        const shade = 0.55 + hVal * 0.45 - fiber * 0.08;
        const idx = (y * bw + x) * 4;
        bImg.data[idx] = Math.min(255, Math.round(196 * shade));
        bImg.data[idx + 1] = Math.min(255, Math.round(162 * shade));
        bImg.data[idx + 2] = Math.min(255, Math.round(98 * shade));
        bImg.data[idx + 3] = 255;
      }
    }
    bCtx.putImageData(bImg, 0, 0);
    const bMap = new THREE.CanvasTexture(bCvs);
    bMap.colorSpace = THREE.SRGBColorSpace;
    bMap.wrapS = bMap.wrapT = THREE.RepeatWrapping;
    textures.bambooMap = bMap;
    textures.bambooNormal = heightToNormalCanvas(bHeight, bw, bh, 2.8);
  }

  // 9. Ceramic Tonsui Bowl Glaze (温かみのある粉引・織部・飴釉, 512x512)
  {
    const w = 256, h = 256;
    const cCvs = document.createElement('canvas');
    cCvs.width = w; cCvs.height = h;
    const ctx = cCvs.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const speck = hash2(x, y, 601) > 0.975 ? 1 : 0;
        const flow = fbm(u * 8, v * 8, 3, 611);
        const r = 236 - flow * 18 - speck * 75;
        const g = 229 - flow * 20 - speck * 82;
        const b = 214 - flow * 24 - speck * 88;
        const idx = (y * w + x) * 4;
        img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const kohiki = new THREE.CanvasTexture(cCvs);
    kohiki.colorSpace = THREE.SRGBColorSpace;
    textures.ceramicKohiki = kohiki;
  }

  // 10. Fine Anisotropic Hair Strand Texture & Normal Map (512x512)
  {
    const w = 512, h = 512;
    const hCvs = document.createElement('canvas');
    hCvs.width = w; hCvs.height = h;
    const ctx = hCvs.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hData = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const strand1 = Math.sin(u * Math.PI * 190 + fbm(u * 14, v * 4, 2, 701) * 4.0);
        const strand2 = Math.sin(u * Math.PI * 420 + noise2(u * 60, v * 8, 711) * 3.0);
        const clumping = fbm(u * 32, v * 5, 3, 721);
        const sVal = clumping * 0.55 + (strand1 * 0.5 + 0.5) * 0.28 + (strand2 * 0.5 + 0.5) * 0.17;
        hData[y * w + x] = sVal * 0.65;

        const shade = Math.round((0.62 + sVal * 0.38) * 255);
        const idx = (y * w + x) * 4;
        img.data[idx] = shade;
        img.data[idx + 1] = Math.round(shade * 0.96);
        img.data[idx + 2] = Math.round(shade * 0.92);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const hairTex = new THREE.CanvasTexture(hCvs);
    hairTex.wrapS = hairTex.wrapT = THREE.RepeatWrapping;
    textures.hairStrandMap = hairTex;
    textures.hairNormal = heightToNormalCanvas(hData, w, h, 2.4);
  }

  return textures;
}
