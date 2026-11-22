import * as THREE from '../vendor/three.module.js';

function hash2(x, y, seed = 1337) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, y, seed = 1337) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, octaves = 4, seed = 1337) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 79);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return val / norm;
}

// 1. Deep Obsidian-Charcoal Studio Slate Tabletop (albedo, roughness, bump) - 512px
export function createSlateTextures() {
  const size = 512;
  const cAlbedo = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  cAlbedo.width = cRough.width = cBump.width = size;
  cAlbedo.height = cRough.height = cBump.height = size;

  const ctxA = cAlbedo.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  const imgA = ctxA.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      // Subtle honed obsidian slate texture — kept VERY dark so black studio drama dominates!
      const warp = fbm(nx * 4.5, ny * 4.5, 3, 17) * 0.38;
      const strata = fbm((nx + warp) * 7.0, ny * 16.0, 4, 41);
      const micro = fbm(nx * 38.0, ny * 38.0, 3, 97);
      const grain = hash2(x, y, 211);

      const shade = 5 + strata * 6.5 + micro * 3.2 + grain * 1.2;
      imgA.data[idx] = shade * 0.96;
      imgA.data[idx + 1] = shade * 0.98;
      imgA.data[idx + 2] = shade * 1.06;
      imgA.data[idx + 3] = 255;

      // Matte-satin stone roughness so specular pools softly without looking like wet plastic
      const rough = Math.min(255, Math.max(0, Math.round(158 + (1 - strata) * 52 + micro * 28)));
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rough;
      imgR.data[idx + 3] = 255;

      const bump = Math.min(255, Math.max(0, Math.round(strata * 160 + micro * 75 + grain * 16)));
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = bump;
      imgB.data[idx + 3] = 255;
    }
  }

  ctxA.putImageData(imgA, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  const map = new THREE.CanvasTexture(cAlbedo);
  const roughnessMap = new THREE.CanvasTexture(cRough);
  const bumpMap = new THREE.CanvasTexture(cBump);

  [map, roughnessMap, bumpMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3.5, 3.5);
    t.anisotropy = 4;
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, roughnessMap, bumpMap };
}

// 2. Luminous Patisserie Vanilla-Bean Custard Texture (512px) — creamy egg-gold + delicate micro vanilla specks!
export function createCustardTextures(richness = 0.55) {
  const size = 512;
  const cAlbedo = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  cAlbedo.width = cRough.width = cBump.width = size;
  cAlbedo.height = cRough.height = cBump.height = size;

  const ctxA = cAlbedo.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  // Rich luminous creamy egg-gold gradient (warm golden crown transitioning to silky pale-gold custard body)
  const grad = ctxA.createLinearGradient(0, 0, 0, size);
  const rTop = 255;
  const gTop = Math.round(218 - richness * 14);
  const bTop = Math.round(122 - richness * 26);

  const rMid = 255;
  const gMid = Math.round(234 - richness * 14);
  const bMid = Math.round(154 - richness * 30);

  const rBot = 253;
  const gBot = Math.round(228 - richness * 14);
  const bBot = Math.round(142 - richness * 28);

  grad.addColorStop(0.0, `rgb(${rTop},${gTop},${bTop})`);
  grad.addColorStop(0.22, `rgb(${rMid},${gMid},${bMid})`);
  grad.addColorStop(1.0, `rgb(${rBot},${gBot},${bBot})`);
  ctxA.fillStyle = grad;
  ctxA.fillRect(0, 0, size, size);

  const imgA = ctxA.getImageData(0, 0, size, size);
  const imgR = ctxR.createImageData(size, size);
  const imgB = ctxB.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n = fbm(x / 54, y / 54, 3, 303);
      const micro = fbm(x / 12, y / 12, 2, 509);
      const delta = (n - 0.5) * 9 + (micro - 0.5) * 3;

      imgA.data[idx] = Math.min(255, Math.max(0, imgA.data[idx] + delta));
      imgA.data[idx + 1] = Math.min(255, Math.max(0, imgA.data[idx + 1] + delta * 0.92));
      imgA.data[idx + 2] = Math.min(255, Math.max(0, imgA.data[idx + 2] + delta * 0.78));

      // Ultra-smooth silky wet custard glaze roughness
      const rVal = Math.round(28 + micro * 22 + (1 - n) * 12);
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rVal;
      imgR.data[idx + 3] = 255;

      const bVal = Math.round(128 + (micro - 0.5) * 20 + (n - 0.5) * 12);
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = bVal;
      imgB.data[idx + 3] = 255;
    }
  }
  ctxA.putImageData(imgA, 0, 0);
  ctxR.putImageData(imgR, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  // Delicate ultra-fine Madagascar vanilla bean micro-specks (authentic patisserie scale!)
  for (let i = 0; i < 340; i++) {
    const sx = hash2(i, 1, 701) * size;
    const syBias = Math.pow(hash2(i, 2, 701), 0.82);
    const sy = syBias * size;
    const rad = 0.35 + hash2(i, 3, 701) * 0.52;
    const alpha = 0.20 + hash2(i, 4, 701) * 0.28;
    ctxA.fillStyle = `rgba(68, 38, 16, ${alpha.toFixed(2)})`;
    ctxA.beginPath();
    ctxA.arc(sx, sy, rad, 0, Math.PI * 2);
    ctxA.fill();
  }

  const map = new THREE.CanvasTexture(cAlbedo);
  const roughnessMap = new THREE.CanvasTexture(cRough);
  const bumpMap = new THREE.CanvasTexture(cBump);
  map.colorSpace = THREE.SRGBColorSpace;
  [map, roughnessMap, bumpMap].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
  });
  return { map, roughnessMap, bumpMap };
}

// 3. Translucent Glossy Amber-to-Mahogany Caramel Pool Texture (512px)
// Organic hand-poured wavy silhouette + deep espresso-caramel core + glowing amber backlit rim!
export function createCaramelPoolTexture() {
  const size = 512;
  const cColor = document.createElement('canvas');
  const cAlpha = document.createElement('canvas');
  cColor.width = cAlpha.width = size;
  cColor.height = cAlpha.height = size;
  const ctxC = cColor.getContext('2d');
  const ctxA = cAlpha.getContext('2d');

  const imgC = ctxC.createImageData(size, size);
  const imgA = ctxA.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);

      // Gentle organic liquid-pool waviness at outer rim
      const edgeR = 0.88 + Math.sin(ang * 3 + 0.5) * 0.032 + Math.cos(ang * 5 - 0.8) * 0.022 + Math.sin(ang * 7) * 0.012;
      const nr = r / edgeR;

      // Authentic burnt-sugar caramel gradient: deep espresso-brown core -> rich golden-amber mid -> warm honey-gold rim!
      // (High amber-gold green channel prevents pinkish tint on white porcelain!)
      const t = Math.min(1, Math.max(0, (nr - 0.40) / 0.60));
      const cr = Math.round(44 + t * 148);
      const cg = Math.round(16 + t * 84);
      const cb = Math.round(2 + t * 8);

      imgC.data[idx] = cr;
      imgC.data[idx + 1] = cg;
      imgC.data[idx + 2] = cb;
      imgC.data[idx + 3] = 255;

      // Rich glossy liquid meniscus alpha rolloff
      let a = 1.0;
      if (nr > 0.93) {
        a = Math.max(0, 1 - (nr - 0.93) / 0.07);
      } else {
        a = 0.97 - t * 0.26;
      }
      const aByte = Math.round(Math.min(1, Math.max(0, a)) * 255);
      imgA.data[idx] = imgA.data[idx + 1] = imgA.data[idx + 2] = aByte;
      imgA.data[idx + 3] = 255;
    }
  }

  ctxC.putImageData(imgC, 0, 0);
  ctxA.putImageData(imgA, 0, 0);

  const map = new THREE.CanvasTexture(cColor);
  const alphaMap = new THREE.CanvasTexture(cAlpha);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, alphaMap };
}

// 4. Natural Farm Eggshell Texture (warm speckled organic shell) - 512px
export function createEggshellTextures() {
  const size = 512;
  const cA = document.createElement('canvas');
  const cB = document.createElement('canvas');
  cA.width = cB.width = size;
  cA.height = cB.height = size;
  const ctxA = cA.getContext('2d');
  const ctxB = cB.getContext('2d');

  ctxA.fillStyle = '#dfa980';
  ctxA.fillRect(0, 0, size, size);

  const imgA = ctxA.getImageData(0, 0, size, size);
  const imgB = ctxB.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n = fbm(x / 44, y / 44, 3, 613);
      const pores = hash2(x, y, 619);
      const v = (n - 0.5) * 18 + (pores - 0.5) * 6;
      imgA.data[idx] = Math.min(255, Math.max(0, 224 + v));
      imgA.data[idx + 1] = Math.min(255, Math.max(0, 172 + v * 0.85));
      imgA.data[idx + 2] = Math.min(255, Math.max(0, 132 + v * 0.7));

      const b = Math.round(128 + (pores - 0.5) * 46 + (n - 0.5) * 26);
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = b;
      imgB.data[idx + 3] = 255;
    }
  }
  ctxA.putImageData(imgA, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  for (let i = 0; i < 340; i++) {
    const fx = hash2(i, 1, 911) * size;
    const fy = hash2(i, 2, 911) * size;
    const r = 0.45 + hash2(i, 3, 911) * 1.25;
    ctxA.fillStyle = `rgba(128, 72, 42, ${(0.12 + hash2(i, 4, 911) * 0.22).toFixed(2)})`;
    ctxA.beginPath();
    ctxA.arc(fx, fy, r, 0, Math.PI * 2);
    ctxA.fill();
  }

  const map = new THREE.CanvasTexture(cA);
  const bumpMap = new THREE.CanvasTexture(cB);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap };
}

// 5. Organic Fluid-Marbled Real-Time Whisking Swirl Canvas (512px)
// Uses soft feathered fluid ribbons + organic turbulence + micro-bubbles instead of rigid stripes!
export function createMixingLiquidCanvas() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  function redraw({ milkAmount = 0, eggCount = 0, mixProgress = 0, swirlAngle = 0, richness = 0.55 }) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const R = size * 0.5;

    const custardR = 255;
    const custardG = Math.round(230 - richness * 18);
    const custardB = Math.round(145 - richness * 36);

    const baseR = Math.round(249 * (1 - mixProgress) + custardR * mixProgress);
    const baseG = Math.round(244 * (1 - mixProgress) + custardG * mixProgress);
    const baseB = Math.round(233 * (1 - mixProgress) + custardB * mixProgress);

    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.fillRect(0, 0, size, size);

    const radBg = ctx.createRadialGradient(cx, cy, R * 0.06, cx, cy, R);
    radBg.addColorStop(0, `rgba(${Math.min(255, baseR + 5)}, ${Math.min(255, baseG + 4)}, ${Math.min(255, baseB + 2)}, 1)`);
    radBg.addColorStop(1, `rgba(${Math.max(0, baseR - 18)}, ${Math.max(0, baseG - 18)}, ${Math.max(0, baseB - 16)}, 1)`);
    ctx.fillStyle = radBg;
    ctx.fillRect(0, 0, size, size);

    // Organic feathered fluid marbling (soft blurred golden egg tendrils swirling into milk!)
    if (eggCount > 0 && mixProgress < 0.97) {
      const fade = (1 - mixProgress) * Math.min(1, mixProgress * 3.5 + 0.25);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(swirlAngle);
      ctx.filter = 'blur(8px)';

      // Rich organic yolk-gold marble clouds stretched into spiral wisps
      const wisps = 9 + eggCount * 4;
      for (let s = 0; s < wisps; s++) {
        const seedA = hash2(s, 1, 777) * Math.PI * 2;
        const rStart = (0.06 + hash2(s, 2, 777) * 0.32) * R;
        const rEnd = (0.48 + hash2(s, 3, 777) * 0.44) * R;
        const sweep = 0.7 + hash2(s, 4, 777) * 1.4 + mixProgress * 1.8;
        const isDeepYolk = s % 3 !== 0;

        ctx.beginPath();
        const steps = 28;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const r = rStart + (rEnd - rStart) * t + Math.sin(t * 7 + s) * 14 * (1 - mixProgress);
          const a = seedA + t * sweep;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        const alpha = fade * (isDeepYolk ? 0.42 : 0.34);
        ctx.strokeStyle = isDeepYolk
          ? `rgba(246, 168, 22, ${alpha.toFixed(3)})`
          : `rgba(255, 250, 238, ${alpha.toFixed(3)})`;
        ctx.lineWidth = (14 + hash2(s, 5, 777) * 28) * (1 - mixProgress * 0.45);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.filter = 'none';

      // Delicate silky foam bubbles around whisk vortex!
      if (mixProgress > 0.14) {
        for (let b = 0; b < 48; b++) {
          const a = hash2(b, 1, 444) * Math.PI * 2 + swirlAngle * 0.45;
          const r = (0.14 + hash2(b, 2, 444) * 0.76) * R;
          const br = 1.4 + hash2(b, 3, 444) * 3.8 * Math.min(1, mixProgress * 1.3);
          ctx.fillStyle = `rgba(255, 253, 246, ${(0.28 * mixProgress).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r, Math.sin(a) * r, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Fine vanilla micro-specks appearing smoothly in emulsified custard
    if (mixProgress > 0.35) {
      const speckAlpha = Math.min(0.32, (mixProgress - 0.35) * 0.5);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(swirlAngle * 0.55);
      for (let i = 0; i < 110; i++) {
        const a = hash2(i, 7, 991) * Math.PI * 2;
        const r = Math.sqrt(hash2(i, 8, 991)) * R * 0.92;
        ctx.fillStyle = `rgba(66, 38, 18, ${speckAlpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (milkAmount > 0.01 && milkAmount < 0.98 && mixProgress < 0.08) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.32 * (1 - mixProgress * 10)).toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (0.22 + (milkAmount * 1.4) % 0.65), 0, Math.PI * 2);
      ctx.stroke();
    }

    texture.needsUpdate = true;
  }

  redraw({ milkAmount: 0, eggCount: 0, mixProgress: 0, swirlAngle: 0 });
  return { texture, redraw };
}

// 6. Soft Warm Ember Diffused Glow Texture (for steamer heating base — no harsh graphic ring!)
export function createWarmGlowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.16, size / 2, size / 2, size * 0.48);
  g.addColorStop(0.0, 'rgba(255, 160, 48, 0.0)');
  g.addColorStop(0.55, 'rgba(255, 130, 32, 0.72)');
  g.addColorStop(0.75, 'rgba(255, 110, 20, 0.28)');
  g.addColorStop(1.0, 'rgba(255, 90, 10, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 7. Soft Rim-Lit Wispy Steam / Cold Mist Sprite (256px)
export function createSteamTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radial = Math.max(0, 1 - dist);
      const falloff = radial * radial * (3 - 2 * radial);

      const wisp = fbm(x / 46 + 1.3, y / 38 + 2.7, 4, 733);
      const alpha = Math.min(1, Math.max(0, falloff * (0.45 + wisp * 0.85) - 0.14));

      const rim = Math.max(0, (-dx * 0.55 - dy * 0.35) * 0.5 + 0.5);
      const lum = Math.round(218 + rim * 37);
      img.data[idx] = lum;
      img.data[idx + 1] = Math.round(lum * 0.99);
      img.data[idx + 2] = Math.round(lum * 0.97);
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 8. Glass Frost / Condensation Droplets Roughness & Bump Texture (512px)
export function createCondensationTextures() {
  const size = 512;
  const cRough = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  cRough.width = cBump.width = size;
  cRough.height = cBump.height = size;
  const ctxR = cRough.getContext('2d');
  const ctxB = cBump.getContext('2d');

  ctxR.fillStyle = 'rgb(168, 168, 168)';
  ctxR.fillRect(0, 0, size, size);
  ctxB.fillStyle = 'rgb(120, 120, 120)';
  ctxB.fillRect(0, 0, size, size);

  for (let i = 0; i < 180; i++) {
    const x = hash2(i, 1, 521) * size;
    const y = hash2(i, 2, 521) * size;
    const r = 10 + hash2(i, 3, 521) * 32;
    const g = ctxR.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(215,215,215,0.38)');
    g.addColorStop(1, 'rgba(168,168,168,0)');
    ctxR.fillStyle = g;
    ctxR.beginPath();
    ctxR.arc(x, y, r, 0, Math.PI * 2);
    ctxR.fill();
  }

  for (let i = 0; i < 460; i++) {
    const x = hash2(i, 4, 523) * size;
    const y = hash2(i, 5, 523) * size;
    const r = 1.1 + Math.pow(hash2(i, 6, 523), 2.2) * 4.8;

    ctxR.fillStyle = 'rgb(14, 14, 14)';
    ctxR.beginPath();
    ctxR.ellipse(x, y, r * 0.9, r * 1.18, 0, 0, Math.PI * 2);
    ctxR.fill();

    const gb = ctxB.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    gb.addColorStop(0, 'rgb(252, 252, 252)');
    gb.addColorStop(0.75, 'rgb(192, 192, 192)');
    gb.addColorStop(1, 'rgb(120, 120, 120)');
    ctxB.fillStyle = gb;
    ctxB.beginPath();
    ctxB.ellipse(x, y, r * 0.9, r * 1.18, 0, 0, Math.PI * 2);
    ctxB.fill();
  }

  const roughnessMap = new THREE.CanvasTexture(cRough);
  const bumpMap = new THREE.CanvasTexture(cBump);
  [roughnessMap, bumpMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1.2);
  });
  return { roughnessMap, bumpMap };
}

// 9. Soft Radial Contact Shadow Texture (256px)
export function createContactShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  g.addColorStop(0.0, 'rgba(0, 0, 0, 0.94)');
  g.addColorStop(0.48, 'rgba(0, 0, 0, 0.62)');
  g.addColorStop(0.82, 'rgba(0, 0, 0, 0.16)');
  g.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
