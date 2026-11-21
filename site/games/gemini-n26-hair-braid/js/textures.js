import * as THREE from '../vendor/three.module.js';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
}

function rgbStr(r, g, b, a = 1) {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return a < 1 ? `rgba(${cr},${cg},${cb},${a})` : `rgb(${cr},${cg},${cb})`;
}

function finalizeTexture(canvas, isColor = true, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Twisted chunky multi-ply wool yarn texture + deep diagonal rib bump map.
 */
export function createYarnTextures(baseHex = '#e8a848', highlightHex = '#f7cf7c', shadowHex = '#ba7722') {
  const size = 256;
  const diffCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = diffCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRandom(101);

  const base = hexToRgb(baseHex);
  const hi = hexToRgb(highlightHex);
  const sh = hexToRgb(shadowHex);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Diagonal twisted plies
  const plyCount = 12;
  const step = size / plyCount;
  for (let i = -plyCount; i < plyCount * 2; i++) {
    const x0 = i * step;
    // Shadow groove
    ctx.strokeStyle = rgbStr(sh.r, sh.g, sh.b, 0.72);
    ctx.lineWidth = step * 0.38;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + size * 0.55, size);
    ctx.stroke();

    bctx.strokeStyle = '#282828';
    bctx.lineWidth = step * 0.34;
    bctx.beginPath();
    bctx.moveTo(x0, 0);
    bctx.lineTo(x0 + size * 0.55, size);
    bctx.stroke();

    // Plump twisted ridge highlight
    ctx.strokeStyle = rgbStr(hi.r, hi.g, hi.b, 0.65);
    ctx.lineWidth = step * 0.42;
    ctx.beginPath();
    ctx.moveTo(x0 + step * 0.42, 0);
    ctx.lineTo(x0 + step * 0.42 + size * 0.55, size);
    ctx.stroke();

    bctx.strokeStyle = '#ececec';
    bctx.lineWidth = step * 0.44;
    bctx.beginPath();
    bctx.moveTo(x0 + step * 0.42, 0);
    bctx.lineTo(x0 + step * 0.42 + size * 0.55, size);
    bctx.stroke();
  }

  // Fine fuzzy wool fibers along the twist
  for (let i = 0; i < 950; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 6 + rand() * 14;
    const ang = 1.05 + (rand() - 0.5) * 0.45;
    const bright = rand() > 0.48;
    const c = bright ? hi : sh;
    ctx.strokeStyle = rgbStr(c.r, c.g, c.b, 0.25 + rand() * 0.28);
    ctx.lineWidth = 0.8 + rand() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();

    bctx.strokeStyle = bright ? 'rgba(235,235,235,0.28)' : 'rgba(55,55,55,0.28)';
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    bctx.stroke();
  }

  return {
    map: finalizeTexture(diffCanvas, true, 2, 6),
    bumpMap: finalizeTexture(bumpCanvas, false, 2, 6),
  };
}

/**
 * Stockinette V-stitch knitted wool fabric texture + deep bump map.
 */
export function createKnitTextures(baseHex = '#df6872', accentHex = '#f5a5ac') {
  const size = 256;
  const diffCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = diffCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRandom(202);

  const base = hexToRgb(baseHex);
  const acc = hexToRgb(accentHex);

  ctx.fillStyle = rgbStr(base.r * 0.72, base.g * 0.72, base.b * 0.72);
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#303030';
  bctx.fillRect(0, 0, size, size);

  const cols = 10;
  const rows = 12;
  const cw = size / cols;
  const rh = size / rows;

  for (let r = -1; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cw;
      const cy = r * rh;
      const stripe = (r % 6 === 0);
      const col = stripe ? acc : base;

      // Left leg of V-stitch
      ctx.strokeStyle = rgbStr(col.r * 1.08, col.g * 1.08, col.b * 1.08);
      ctx.lineWidth = cw * 0.28;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.34, cy - rh * 0.12);
      ctx.quadraticCurveTo(cx - cw * 0.16, cy + rh * 0.42, cx - cw * 0.04, cy + rh * 0.85);
      ctx.stroke();

      // Right leg of V-stitch
      ctx.strokeStyle = rgbStr(col.r * 0.94, col.g * 0.94, col.b * 0.94);
      ctx.beginPath();
      ctx.moveTo(cx + cw * 0.34, cy - rh * 0.12);
      ctx.quadraticCurveTo(cx + cw * 0.16, cy + rh * 0.42, cx + cw * 0.04, cy + rh * 0.85);
      ctx.stroke();

      // Bump V-stitch ridges
      bctx.strokeStyle = '#e8e8e8';
      bctx.lineWidth = cw * 0.26;
      bctx.lineCap = 'round';
      bctx.beginPath();
      bctx.moveTo(cx - cw * 0.34, cy - rh * 0.12);
      bctx.quadraticCurveTo(cx - cw * 0.16, cy + rh * 0.42, cx - cw * 0.04, cy + rh * 0.85);
      bctx.moveTo(cx + cw * 0.34, cy - rh * 0.12);
      bctx.quadraticCurveTo(cx + cw * 0.16, cy + rh * 0.42, cx + cw * 0.04, cy + rh * 0.85);
      bctx.stroke();
    }
  }

  // Fuzzy wool flecks
  for (let i = 0; i < 600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(60,20,25,0.12)';
    ctx.fillRect(x, y, 2, 1.5);
  }

  return {
    map: finalizeTexture(diffCanvas, true, 3, 3),
    bumpMap: finalizeTexture(bumpCanvas, false, 3, 3),
  };
}

/**
 * Woven cotton muslin cloth texture for the fabric doll's skin.
 */
export function createLinenSkinTextures(baseHex = '#f7dec8') {
  const size = 256;
  const diffCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = diffCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRandom(303);

  const base = hexToRgb(baseHex);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Subtle cross-weave cotton threads
  const pitch = 4;
  for (let i = 0; i < size; i += pitch) {
    const v1 = (rand() - 0.5) * 10;
    ctx.fillStyle = rgbStr(base.r + v1, base.g + v1 * 0.9, base.b + v1 * 0.8, 0.35);
    ctx.fillRect(i, 0, 2, size);
    ctx.fillRect(0, i, size, 2);

    bctx.fillStyle = 'rgba(205,205,205,0.28)';
    bctx.fillRect(i, 0, 2, size);
    bctx.fillStyle = 'rgba(185,185,185,0.28)';
    bctx.fillRect(0, i, size, 2);
  }

  // Warm cloth speckle
  for (let i = 0; i < 800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const d = (rand() - 0.5) * 18;
    ctx.fillStyle = rgbStr(base.r + d, base.g + d * 0.85, base.b + d * 0.75, 0.25);
    ctx.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTexture(diffCanvas, true, 4, 4),
    bumpMap: finalizeTexture(bumpCanvas, false, 4, 4),
  };
}

/**
 * Wool felt texture with speckled organic fibers + fuzzy bump map.
 */
export function createFeltTextures(baseHex = '#d9485b', fleckHex = '#ff9ea8') {
  const size = 256;
  const diffCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = diffCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRandom(404 + baseHex.charCodeAt(1) * 17);

  const base = hexToRgb(baseHex);
  const fleck = hexToRgb(fleckHex);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Soft cloudy wool mottling
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 8 + rand() * 20;
    const light = rand() > 0.5;
    ctx.fillStyle = light
      ? rgbStr(base.r + 18, base.g + 16, base.b + 16, 0.08)
      : rgbStr(base.r - 22, base.g - 22, base.b - 22, 0.08);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Random overlapping wool felt fibers
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 3 + rand() * 8;
    const ang = rand() * Math.PI * 2;
    const pick = rand();
    if (pick > 0.72) {
      ctx.strokeStyle = rgbStr(fleck.r, fleck.g, fleck.b, 0.32);
      bctx.strokeStyle = 'rgba(220,220,220,0.35)';
    } else if (pick < 0.35) {
      ctx.strokeStyle = rgbStr(base.r * 0.75, base.g * 0.75, base.b * 0.75, 0.28);
      bctx.strokeStyle = 'rgba(65,65,65,0.35)';
    } else {
      ctx.strokeStyle = rgbStr(base.r * 1.12, base.g * 1.12, base.b * 1.12, 0.24);
      bctx.strokeStyle = 'rgba(195,195,195,0.28)';
    }
    ctx.lineWidth = 0.9 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();

    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    bctx.stroke();
  }

  return {
    map: finalizeTexture(diffCanvas, true, 2, 2),
    bumpMap: finalizeTexture(bumpCanvas, false, 2, 2),
  };
}

/**
 * Warm beechwood grain texture for brush back, mirror stand, buttons.
 */
export function createWoodTextures(baseHex = '#cfa06e') {
  const size = 256;
  const diffCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = diffCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRandom(505);
  const base = hexToRgb(baseHex);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin(y * 0.08) * 10 + Math.sin(y * 0.22) * 5;
    const shade = (rand() - 0.5) * 16 + Math.sin(y * 0.14) * 12;
    ctx.strokeStyle = rgbStr(base.r + shade, base.g + shade * 0.85, base.b + shade * 0.6, 0.45);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.33, y + wave, size * 0.66, y - wave, size, y);
    ctx.stroke();

    const bv = 128 + shade * 1.8;
    bctx.strokeStyle = rgbStr(bv, bv, bv, 0.4);
    bctx.lineWidth = 2;
    bctx.beginPath();
    bctx.moveTo(0, y);
    bctx.bezierCurveTo(size * 0.33, y + wave, size * 0.66, y - wave, size, y);
    bctx.stroke();
  }

  return {
    map: finalizeTexture(diffCanvas, true, 1, 1),
    bumpMap: finalizeTexture(bumpCanvas, false, 1, 1),
  };
}

/**
 * Cozy quilted patchwork craft mat texture for the dressing table surface.
 */
export function createQuiltMatTextures() {
  const size = 512;
  const diffCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = diffCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRandom(606);

  // Cream linen base
  ctx.fillStyle = '#f5eadb';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, size, size);

  // Soft woven plaid / gingham squares
  const sq = 64;
  const palette = ['#f4e4d1', '#edd8c4', '#f7ede0', '#e7d2be'];
  for (let gy = 0; gy < size / sq; gy++) {
    for (let gx = 0; gx < size / sq; gx++) {
      ctx.fillStyle = palette[(gx + gy) % palette.length];
      ctx.fillRect(gx * sq, gy * sq, sq, sq);

      // Subtle polka dots on alternating squares
      if ((gx + gy) % 2 === 0) {
        ctx.fillStyle = 'rgba(210, 165, 130, 0.22)';
        for (let py = 16; py < sq; py += 24) {
          for (let px = 16; px < sq; px += 24) {
            ctx.beginPath();
            ctx.arc(gx * sq + px, gy * sq + py, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // Quilted running stitches along patch seams
  ctx.strokeStyle = '#c49674';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([8, 6]);
  bctx.strokeStyle = '#383838';
  bctx.lineWidth = 3.5;
  bctx.setLineDash([8, 6]);
  for (let i = 0; i <= size; i += sq) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();

    bctx.beginPath();
    bctx.moveTo(i, 0);
    bctx.lineTo(i, size);
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(0, i);
    bctx.lineTo(size, i);
    bctx.stroke();
  }
  ctx.setLineDash([]);
  bctx.setLineDash([]);

  // Fine cloth grain
  for (let i = 0; i < 2000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(130,90,60,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTexture(diffCanvas, true, 2, 1.5),
    bumpMap: finalizeTexture(bumpCanvas, false, 2, 1.5),
  };
}

/**
 * Cozy quilted fabric room backdrop texture (warm muted wall so hero doll pops).
 */
export function createBackdropFabricTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rand = seededRandom(707);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#f3e1cc');
  grad.addColorStop(0.6, '#ead2ba');
  grad.addColorStop(1, '#dec0a4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft diamond quilt stitching
  const step = 64;
  ctx.strokeStyle = 'rgba(176, 134, 102, 0.22)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Tiny fabric weave noise
  for (let i = 0; i < 1800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(130,90,55,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  return finalizeTexture(c, true, 2, 2);
}

/**
 * Build shared texture library once on startup (keeps VRAM tiny and crisp).
 */
export function buildTextureLibrary() {
  return {
    linenSkin: createLinenSkinTextures('#f7dcc5'),
    knitSweater: createKnitTextures('#de6470', '#f6c2c7'),
    knitCream: createKnitTextures('#f7eedf', '#e7d7bf'),
    knitMint: createKnitTextures('#7ec5b5', '#b9e5db'),
    knitLavender: createKnitTextures('#a688d4', '#d4c1f0'),
    knitBerry: createKnitTextures('#d94e67', '#f79eae'),
    feltRed: createFeltTextures('#d94458', '#ff99a8'),
    feltYellow: createFeltTextures('#f4c145', '#fff0a8'),
    feltMint: createFeltTextures('#6dc2b0', '#b7ece0'),
    feltPink: createFeltTextures('#f08ca4', '#ffc7d5'),
    feltCream: createFeltTextures('#f8f0e3', '#e5d4be'),
    feltGreen: createFeltTextures('#5da862', '#a2d99d'),
    feltSky: createFeltTextures('#7cb8e4', '#c5e4fa'),
    feltGold: createFeltTextures('#eab238', '#ffe48f'),
    wood: createWoodTextures('#cfa06c'),
    woodDark: createWoodTextures('#8d5f3b'),
    quiltMat: createQuiltMatTextures(),
    backdrop: createBackdropFabricTexture(),
    hairPalettes: [
      {
        name: 'honey',
        baseHex: '#e5a443',
        lightHex: '#f6cb75',
        darkHex: '#b8761f',
        texMain: createYarnTextures('#e5a443', '#f6cb75', '#b8761f'),
        texLight: createYarnTextures('#f0ba5e', '#ffe099', '#c98a30'),
        texDark: createYarnTextures('#cc882d', '#e4ab56', '#995c14'),
      },
      {
        name: 'chestnut',
        baseHex: '#8d5336',
        lightHex: '#b27453',
        darkHex: '#63351e',
        texMain: createYarnTextures('#8d5336', '#b27453', '#63351e'),
        texLight: createYarnTextures('#a46646', '#c98b68', '#78442a'),
        texDark: createYarnTextures('#744127', '#965d3f', '#4e2714'),
      },
      {
        name: 'berry',
        baseHex: '#dd6c83',
        lightHex: '#f69eb0',
        darkHex: '#ae465d',
        texMain: createYarnTextures('#dd6c83', '#f69eb0', '#ae465d'),
        texLight: createYarnTextures('#ee859a', '#ffb8c7', '#c45b72'),
        texDark: createYarnTextures('#c4536b', '#df7e93', '#92354a'),
      },
      {
        name: 'lavender',
        baseHex: '#9a7dd4',
        lightHex: '#c2adf0',
        darkHex: '#7154ad',
        texMain: createYarnTextures('#9a7dd4', '#c2adf0', '#7154ad'),
        texLight: createYarnTextures('#b096e3', '#d7c7f8', '#8567bf'),
        texDark: createYarnTextures('#8265be', '#a68dd9', '#5b4093'),
      },
    ],
  };
}
