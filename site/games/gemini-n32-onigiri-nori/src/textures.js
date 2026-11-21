import * as THREE from '../vendor/three.module.min.js';

// Seeded PRNG so picture-book brushstrokes stay consistent and warm
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

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, repeatX = 1, repeatY = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Add subtle watercolor pigment granulation & colored-pencil strokes to any canvas
function paintWatercolorWash(ctx, w, h, colors, seed = 1, pencilStrokes = 90) {
  const rng = mulberry32(seed);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);

  // Soft wet-on-wet watercolor blooms
  for (let i = 0; i < 28; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = (0.14 + rng() * 0.28) * Math.max(w, h);
    const col = colors[1 + Math.floor(rng() * (colors.length - 1))];
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(0.75, col.replace(/[\d.]+\)$/, '0.18)'));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Delicate colored-pencil hatching strokes
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < pencilStrokes; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 14 + rng() * 44;
    const angle = -0.45 + (rng() - 0.5) * 0.25;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(110, 82, 62, 0.08)' : 'rgba(255, 252, 244, 0.12)';
    ctx.lineWidth = 1 + rng() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// Paper overlay dataURL for the DOM #paper-overlay
export function createPaperOverlayDataUrl() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const rng = mulberry32(777);
  ctx.fillStyle = '#fcf8ee';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1600; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const s = 1 + rng() * 2.4;
    const shade = Math.floor(220 + rng() * 32);
    ctx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 22}, ${0.28 + rng() * 0.35})`;
    ctx.fillRect(x, y, s, s);
  }
  // Soft cold-press paper fibers
  ctx.strokeStyle = 'rgba(182, 162, 138, 0.18)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 120; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const a = rng() * Math.PI * 2;
    const l = 6 + rng() * 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

// Plump freshly cooked Japanese rice watercolor texture + bump map
export function createRiceTextures() {
  const size = 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const b = makeCanvas(size, size);
  const bctx = b.getContext('2d');
  const rng = mulberry32(101);

  ctx.fillStyle = '#fdf9ee';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Soft warm ivory watercolor base blooms
  for (let i = 0; i < 20; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 60 + rng() * 110;
    const g = ctx.createRadialGradient(x, y, 5, x, y, r);
    g.addColorStop(0, 'rgba(247, 237, 218, 0.45)');
    g.addColorStop(1, 'rgba(255, 253, 245, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hand-painted plump overlapping rice grains!
  for (let i = 0; i < 520; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const angle = rng() * Math.PI;
    const rx = 10 + rng() * 6;
    const ry = 5.5 + rng() * 3;

    const drawGrain = (ox, oy) => {
      ctx.save();
      ctx.translate(x + ox, y + oy);
      ctx.rotate(angle);
      // Warm soft shadow crease
      ctx.fillStyle = 'rgba(208, 192, 174, 0.42)';
      ctx.beginPath();
      ctx.ellipse(1.5, 2.2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Plump creamy white rice body
      const gr = ctx.createRadialGradient(-rx * 0.25, -ry * 0.25, 1, 0, 0, rx);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.65, '#fcf7ea');
      gr.addColorStop(1, '#ebe0cc');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Delicate colored-pencil grain contour
      ctx.strokeStyle = 'rgba(168, 146, 126, 0.34)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
      // Glossy freshly-steamed dot highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.28, -ry * 0.25, rx * 0.26, ry * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Bump map
      bctx.save();
      bctx.translate(x + ox, y + oy);
      bctx.rotate(angle);
      const bgr = bctx.createRadialGradient(0, 0, 1, 0, 0, rx);
      bgr.addColorStop(0, '#ffffff');
      bgr.addColorStop(0.75, '#b8b8b8');
      bgr.addColorStop(1, '#555555');
      bctx.fillStyle = bgr;
      bctx.beginPath();
      bctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    };

    drawGrain(0, 0);
    // Tile wrap near edges
    if (x < 25) drawGrain(size, 0);
    if (x > size - 25) drawGrain(-size, 0);
    if (y < 25) drawGrain(0, size);
    if (y > size - 25) drawGrain(0, -size);
  }

  return {
    map: toTexture(c, 2, 2, true),
    bumpMap: toTexture(b, 2, 2, false)
  };
}

// Crisp roasted Japanese nori seaweed texture (deep forest-charcoal with green sheen & fibers)
export function createNoriTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = mulberry32(202);

  paintWatercolorWash(
    ctx,
    512,
    512,
    ['#212d24', 'rgba(30, 56, 38, 0.5)', 'rgba(18, 26, 22, 0.5)', 'rgba(48, 72, 46, 0.3)'],
    202,
    140
  );

  // Roasted seaweed plant fibers & tiny crisp pores
  ctx.lineCap = 'round';
  for (let i = 0; i < 700; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const l = 6 + rng() * 20;
    const a = rng() * Math.PI * 2;
    ctx.strokeStyle =
      i % 4 === 0
        ? 'rgba(72, 108, 70, 0.25)'
        : i % 3 === 0
          ? 'rgba(12, 18, 14, 0.35)'
          : 'rgba(54, 78, 56, 0.22)';
    ctx.lineWidth = 0.8 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // Subtle crisp toasted sheen spots
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(104, 140, 96, 0.16)';
    ctx.beginPath();
    ctx.arc(rng() * 512, rng() * 512, 1 + rng() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Colored-pencil border shading
  ctx.strokeStyle = 'rgba(14, 22, 16, 0.45)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);

  return toTexture(c, 1, 1, true);
}

// Warm honey-cedar wood grain (table, cutting board, ohitsu)
export function createWoodTexture(base = '#e2be8d', dark = '#c39562', seed = 303) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);

  paintWatercolorWash(
    ctx,
    512,
    512,
    [base, 'rgba(202, 152, 98, 0.3)', 'rgba(246, 224, 188, 0.32)'],
    seed,
    80
  );

  // Hand-painted gentle cedar wood grain lines
  for (let y = 0; y < 512; y += 7) {
    ctx.strokeStyle = y % 21 === 0 ? dark : 'rgba(165, 118, 72, 0.24)';
    ctx.globalAlpha = 0.25 + rng() * 0.22;
    ctx.lineWidth = 1.2 + rng() * 2.4;
    ctx.beginPath();
    let py = y;
    ctx.moveTo(0, py);
    for (let x = 0; x <= 512; x += 32) {
      py = y + Math.sin(x * 0.014 + y * 0.04) * (3 + rng() * 3);
      ctx.lineTo(x, py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, 1, 1, true);
}

// Hand-painted red & white watercolor gingham picnic cloth
export function createGinghamTexture(stripeColor = 'rgba(224, 92, 82, 0.46)', repeat = 2) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const rng = mulberry32(404);

  ctx.fillStyle = '#fdf7ec';
  ctx.fillRect(0, 0, 256, 256);

  const step = 64;
  // Slightly hand-wobbled watercolor stripes (overlapping creates darker check squares!)
  ctx.fillStyle = stripeColor;
  for (let i = 0; i < 256; i += step) {
    ctx.fillRect(i, 0, step * 0.5, 256);
    ctx.fillRect(0, i, 256, step * 0.5);
  }
  // Soft watercolor brush unevenness & pencil texture
  for (let i = 0; i < 120; i++) {
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,250,242,0.16)' : 'rgba(180,62,56,0.08)';
    ctx.lineWidth = 1 + rng() * 2;
    const x = rng() * 256;
    const y = rng() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18, y + (rng() - 0.5) * 4);
    ctx.stroke();
  }

  return toTexture(c, repeat, repeat, true);
}

// Woven wicker picnic basket texture
export function createWickerTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = mulberry32(505);

  ctx.fillStyle = '#d29e5e';
  ctx.fillRect(0, 0, 512, 512);

  const cellW = 48;
  const cellH = 22;
  for (let row = 0; row < 512 / cellH + 1; row++) {
    for (let col = 0; col < 512 / cellW + 1; col++) {
      const x = col * cellW + (row % 2 === 0 ? 0 : cellW * 0.5) - cellW * 0.5;
      const y = row * cellH;
      const grad = ctx.createLinearGradient(x, y, x + cellW, y);
      grad.addColorStop(0, '#b57e40');
      grad.addColorStop(0.5, '#e8bc7e');
      grad.addColorStop(1, '#ae773a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 3, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(104, 68, 34, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Colored-pencil reed striations
      ctx.strokeStyle = 'rgba(130, 88, 42, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + cellH * 0.5 + (rng() - 0.5) * 2);
      ctx.lineTo(x + cellW - 6, y + cellH * 0.5 + (rng() - 0.5) * 2);
      ctx.stroke();
    }
  }
  return toTexture(c, 2, 2, true);
}

// Rosy wrinkled Umeboshi pickled plum texture
export function createUmeboshiTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const rng = mulberry32(606);

  paintWatercolorWash(
    ctx,
    256,
    256,
    ['#d94b57', 'rgba(242, 112, 120, 0.5)', 'rgba(176, 40, 56, 0.45)', 'rgba(250, 152, 154, 0.3)'],
    606,
    45
  );
  // Characteristic juicy pickled plum wrinkles
  ctx.lineCap = 'round';
  for (let i = 0; i < 38; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(136, 28, 42, 0.42)' : 'rgba(255, 198, 200, 0.35)';
    ctx.lineWidth = 2 + rng() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * 32, y + (rng() - 0.5) * 32, x + (rng() - 0.5) * 44, y + (rng() - 0.5) * 44);
    ctx.stroke();
  }
  return toTexture(c, 1, 1, true);
}

// Grilled coral-pink Japanese salmon (shake) texture with flaky lines
export function createSalmonTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const rng = mulberry32(707);

  paintWatercolorWash(
    ctx,
    256,
    256,
    ['#f08963', 'rgba(248, 162, 122, 0.5)', 'rgba(218, 96, 66, 0.4)', 'rgba(252, 200, 164, 0.35)'],
    707,
    40
  );
  // Pale creamy salmon flake striations
  for (let i = -40; i < 296; i += 22) {
    ctx.strokeStyle = 'rgba(255, 232, 214, 0.65)';
    ctx.lineWidth = 4 + rng() * 2.5;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.quadraticCurveTo(i + 28, 128, i - 14, 256);
    ctx.stroke();
  }
  // Appetizing light grill marks
  for (let i = 0; i < 5; i++) {
    const y = 32 + i * 48;
    ctx.strokeStyle = 'rgba(166, 78, 44, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(240, y + 18);
    ctx.stroke();
  }
  return toTexture(c, 1, 1, true);
}

// Generic soft watercolor wash texture for clothes, skin, ceramics, bamboo
export function createSoftWashTexture(baseHex, accentRgba, accentRgba2, seed = 10) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  paintWatercolorWash(ctx, 256, 256, [baseHex, accentRgba, accentRgba2], seed, 55);
  return toTexture(c, 1, 1, true);
}

// Cute bento nori face texture (transparent background, crisp dark nori cutouts + rosy cheeks)
export function createBentoFaceTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Soft watercolor rosy cheeks
  const drawBlush = (cx, cy) => {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 24);
    g.addColorStop(0, 'rgba(244, 132, 138, 0.72)');
    g.addColorStop(1, 'rgba(244, 132, 138, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
  };
  drawBlush(70, 146);
  drawBlush(186, 146);

  // Nori eyes (cute rounded oval cutouts with sparkle)
  ctx.fillStyle = '#202b23';
  ctx.beginPath();
  ctx.ellipse(92, 118, 15, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(164, 118, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tiny white rice sparkle dots inside eyes
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.arc(87, 111, 5, 0, Math.PI * 2);
  ctx.arc(159, 111, 5, 0, Math.PI * 2);
  ctx.fill();

  // Happy nori smile arc
  ctx.strokeStyle = '#202b23';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 136, 24, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();

  return toTexture(c, 1, 1, true);
}

// Sunlit Japanese picture-book Kitchen Wall + Window backdrop
export function createKitchenBackdropTexture() {
  const w = 1024;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(808);

  // Warm cream plaster watercolor wall
  paintWatercolorWash(
    ctx,
    w,
    h,
    ['#fbf2df', 'rgba(244, 224, 192, 0.45)', 'rgba(255, 248, 232, 0.5)', 'rgba(232, 206, 174, 0.3)'],
    808,
    180
  );

  // Sunlit window on the left-back and right-back (framing the girl in the center!)
  const drawWindow = (wx, wy, ww, wh) => {
    // Sky wash outside
    const sky = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    sky.addColorStop(0, '#b9dff2');
    sky.addColorStop(0.62, '#e4f3f5');
    sky.addColorStop(1, '#dcebc4');
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);

    // Fluffy watercolor clouds
    ctx.fillStyle = 'rgba(255, 253, 247, 0.86)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(wx + 45 + i * 32, wy + 58 + (i % 2) * 14, 26 + (i % 2) * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant watercolor leafy tree canopy outside
    const greens = ['rgba(148, 192, 122, 0.72)', 'rgba(176, 212, 136, 0.65)', 'rgba(122, 168, 102, 0.55)'];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = greens[i % greens.length];
      ctx.beginPath();
      ctx.arc(wx + 24 + i * 28, wy + wh - 24 - (i % 3) * 16, 30 + rng() * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm morning sunbeams slanting across window
    ctx.fillStyle = 'rgba(255, 249, 224, 0.26)';
    ctx.beginPath();
    ctx.moveTo(wx + 20, wy);
    ctx.lineTo(wx + 95, wy);
    ctx.lineTo(wx + 55, wy + wh);
    ctx.lineTo(wx - 10, wy + wh);
    ctx.closePath();
    ctx.fill();

    // Wooden window frame + muntins
    ctx.strokeStyle = '#b9895a';
    ctx.lineWidth = 14;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(wx + ww * 0.5, wy);
    ctx.lineTo(wx + ww * 0.5, wy + wh);
    ctx.moveTo(wx, wy + wh * 0.52);
    ctx.lineTo(wx + ww, wy + wh * 0.52);
    ctx.stroke();

    // Soft sepia colored-pencil outline on frame
    ctx.strokeStyle = 'rgba(92, 67, 55, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(wx - 7, wy - 7, ww + 14, wh + 14);

    // Gingham cafe curtain valance at top of window
    ctx.fillStyle = 'rgba(232, 126, 114, 0.42)';
    for (let x = wx; x < wx + ww; x += 28) {
      ctx.beginPath();
      ctx.arc(x + 14, wy + 24, 16, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillRect(wx, wy, ww, 24);
  };

  drawWindow(68, 128, 252, 224);
  drawWindow(704, 128, 252, 224);

  // Subtle cozy wall paneling along lower wall
  ctx.fillStyle = 'rgba(222, 188, 146, 0.34)';
  ctx.fillRect(0, 392, w, 120);
  ctx.strokeStyle = 'rgba(164, 124, 86, 0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 392);
  ctx.lineTo(w, 392);
  ctx.stroke();

  // Gentle wooden kitchen shelf with painted ceramic teapot & cup silhouettes in center-top
  ctx.fillStyle = '#cf9e6c';
  ctx.fillRect(365, 188, 294, 14);
  ctx.strokeStyle = 'rgba(92, 67, 55, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(365, 188, 294, 14);

  // Cute watercolor ceramic jars on shelf (pure background charm)
  const drawJar = (jx, jy, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(jx, jy, 34, 42, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(92, 67, 55, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#b9895a';
    ctx.beginPath();
    ctx.roundRect(jx + 4, jy - 8, 26, 10, 4);
    ctx.fill();
  };
  drawJar(392, 146, '#f2d3a8');
  drawJar(442, 152, '#c8dfcf');
  drawJar(576, 146, '#f3c6bd');

  return toTexture(c, 1, 1, true);
}

// Sunlit Picture-book Picnic Meadow Sky & Rolling Hills backdrop
export function createMeadowBackdropTexture() {
  const w = 1024;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(909);

  const sky = ctx.createLinearGradient(0, 80, 0, h * 0.85);
  sky.addColorStop(0, '#96cfec');
  sky.addColorStop(0.58, '#d4edf5');
  sky.addColorStop(1, '#fbf3d8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Warm watercolor sun glow (clearly visible in upper right!)
  const sun = ctx.createRadialGradient(845, 205, 14, 845, 205, 125);
  sun.addColorStop(0, 'rgba(255, 245, 188, 0.96)');
  sun.addColorStop(0.35, 'rgba(255, 232, 162, 0.48)');
  sun.addColorStop(1, 'rgba(255, 244, 210, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(845, 205, 125, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy watercolor clouds positioned nicely in visible upper sky band!
  const drawCloud = (cx, cy, s) => {
    ctx.fillStyle = 'rgba(255, 253, 247, 0.92)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 26 * s, cy + Math.abs(i) * 6 * s, (32 - Math.abs(i) * 5) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawCloud(195, 215, 1.12);
  drawCloud(640, 185, 0.82);
  drawCloud(885, 265, 0.78);

  // Rolling sunlit hills in soft watercolor greens (lower third so sky shines behind the girl!)
  ctx.fillStyle = '#c4dca0';
  ctx.beginPath();
  ctx.moveTo(0, 382);
  ctx.quadraticCurveTo(260, 315, 560, 368);
  ctx.quadraticCurveTo(820, 318, 1024, 362);
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#a5cc7b';
  ctx.beginPath();
  ctx.moveTo(0, 422);
  ctx.quadraticCurveTo(340, 370, 680, 412);
  ctx.quadraticCurveTo(880, 390, 1024, 418);
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // Watercolor meadow grass & wildflower specks
  for (let i = 0; i < 95; i++) {
    const x = rng() * w;
    const y = 390 + rng() * 115;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 236, 118, 0.75)' : 'rgba(255, 252, 240, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + rng() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return toTexture(c, 1, 1, true);
}

// Dynamic Watercolor Picture-Book Face Renderer for the Girl Character!
// NOTE: SphereGeometry equirectangular UV maps 360deg horizontally vs 180deg vertically (2:1),
// so horizontal radii & offsets are compressed 0.52x so features render round & adorable on 3D head!
export class WatercolorFaceCanvas {
  constructor() {
    this.canvas = makeCanvas(512, 512);
    this.ctx = this.canvas.getContext('2d');
    this.texture = toTexture(this.canvas, 1, 1, true);
    this.lastKey = '';
    this.draw({ expression: 'happy', lookX: 0, lookY: 0, blink: 0, chewPhase: 0 });
  }

  draw({ expression = 'happy', lookX = 0, lookY: lookYIn = 0, blink = 0, chewPhase = 0 }) {
    const lookY = lookYIn;
    const qx = Math.round(lookX * 14);
    const qy = Math.round(lookY * 14);
    const qb = Math.round(blink * 8);
    const qc = Math.round(chewPhase * 8);
    const key = `${expression}_${qx}_${qy}_${qb}_${qc}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const ctx = this.ctx;
    const w = 512;
    const h = 512;

    // Warm Japanese picture-book peach skin watercolor wash
    ctx.fillStyle = '#fde3cc';
    ctx.fillRect(0, 0, w, h);

    // Subtle forehead/cheek warmth gradient
    const warm = ctx.createRadialGradient(256, 260, 30, 256, 260, 210);
    warm.addColorStop(0, 'rgba(255, 243, 228, 0.48)');
    warm.addColorStop(1, 'rgba(238, 194, 162, 0.34)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);

    // Rosy watercolor cheeks (extra rosy on sour/cheer/bliss!)
    const blushBoost =
      expression === 'sour' || expression === 'cheer' || expression === 'bliss' || expression === 'sparkle'
        ? 0.74
        : 0.52;
    const drawCheek = (cx, cy, rx, ry) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx / ry, 1);
      const g = ctx.createRadialGradient(0, 0, 3, 0, 0, ry);
      g.addColorStop(0, `rgba(244, 132, 134, ${blushBoost})`);
      g.addColorStop(0.62, `rgba(244, 148, 142, ${blushBoost * 0.45})`);
      g.addColorStop(1, 'rgba(244, 148, 142, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, ry, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Cute colored-pencil cheek blush lines
      ctx.strokeStyle = 'rgba(222, 102, 106, 0.32)';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 6 - 2, cy + 5);
        ctx.lineTo(cx + i * 6 + 2, cy - 5);
        ctx.stroke();
      }
    };
    const cheekPuff = expression === 'focus' || expression === 'munch' ? Math.sin(chewPhase * Math.PI * 2) * 3 + 5 : 0;
    drawCheek(200 - cheekPuff * 0.25, 294, 21 + cheekPuff * 0.35, 34 + cheekPuff * 0.5);
    drawCheek(312 + cheekPuff * 0.25, 294, 21 + cheekPuff * 0.35, 34 + cheekPuff * 0.5);

    // Cute soft eyebrows
    ctx.strokeStyle = '#5c3f31';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    const browY = expression === 'sparkle' || expression === 'eager' ? 196 : 206;
    if (expression === 'sour') {
      ctx.beginPath();
      ctx.moveTo(206, 206);
      ctx.lineTo(234, 218);
      ctx.moveTo(306, 206);
      ctx.lineTo(278, 218);
      ctx.stroke();
    } else if (expression === 'focus') {
      ctx.beginPath();
      ctx.moveTo(206, 208);
      ctx.quadraticCurveTo(220, 200, 234, 210);
      ctx.moveTo(306, 208);
      ctx.quadraticCurveTo(292, 200, 278, 210);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(206, browY + 6);
      ctx.quadraticCurveTo(220, browY - 5, 234, browY + 5);
      ctx.moveTo(278, browY + 5);
      ctx.quadraticCurveTo(292, browY - 5, 306, browY + 6);
      ctx.stroke();
    }

    // Eyes! Big round sparkling picture-book eyes (aspect-corrected for SphereGeometry!)
    const lx = 220;
    const rx = 292;
    const ey = 252;

    if (expression === 'sour') {
      // Hilarious adorable >< sour squint!
      ctx.strokeStyle = '#473026';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lx - 11, ey - 14);
      ctx.lineTo(lx + 9, ey);
      ctx.lineTo(lx - 11, ey + 14);
      ctx.moveTo(rx + 11, ey - 14);
      ctx.lineTo(rx - 9, ey);
      ctx.lineTo(rx + 11, ey + 14);
      ctx.stroke();
    } else if (expression === 'bliss' || expression === 'cheer' || blink > 0.72) {
      // Joyful curved smiling eyes (^^)
      ctx.strokeStyle = '#473026';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx - 12, ey + 4);
      ctx.quadraticCurveTo(lx, ey - 16, lx + 12, ey + 4);
      ctx.moveTo(rx - 12, ey + 4);
      ctx.quadraticCurveTo(rx, ey - 16, rx + 12, ey + 4);
      ctx.stroke();
    } else {
      const ox = lookX * 5;
      const oy = lookY * 6;
      const drawOpenEye = (cx) => {
        const erx = 12.5;
        const ery = 23 * (1 - blink * 0.8);
        // Warm dark-brown iris
        ctx.fillStyle = '#452d23';
        ctx.beginPath();
        ctx.ellipse(cx + ox, ey + oy, erx, ery, 0, 0, Math.PI * 2);
        ctx.fill();

        // Warm honey lower iris glow
        ctx.fillStyle = '#84563c';
        ctx.beginPath();
        ctx.ellipse(cx + ox, ey + oy + 7, erx * 0.62, ery * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // Big sparkling picture-book catchlights
        ctx.fillStyle = '#fffdf8';
        ctx.beginPath();
        ctx.ellipse(cx + ox - 3.8, ey + oy - 7, expression === 'sparkle' ? 4.8 : 4.2, expression === 'sparkle' ? 8.2 : 7.0, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + ox + 4.2, ey + oy + 5, 2.5, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();

        if (expression === 'sparkle') {
          ctx.fillStyle = '#ffe588';
          ctx.beginPath();
          ctx.ellipse(cx + ox + 3.8, ey + oy - 8, 2.6, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Gentle curved upper eyelash
        ctx.strokeStyle = '#452d23';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 14, ey - 6);
        ctx.quadraticCurveTo(cx, ey - 25, cx + 14, ey - 6);
        ctx.stroke();
      };
      drawOpenEye(lx);
      drawOpenEye(rx);
    }

    // Tiny cute button nose
    ctx.fillStyle = 'rgba(218, 152, 122, 0.72)';
    ctx.beginPath();
    ctx.ellipse(256, 286, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Mouth!
    ctx.strokeStyle = '#5a362c';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const my = 324;

    if (expression === 'sour') {
      // Cute wiggly puckered sour mouth
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.moveTo(242, my + 2);
      ctx.quadraticCurveTo(249, my - 9, 256, my + 2);
      ctx.quadraticCurveTo(263, my + 11, 270, my + 2);
      ctx.stroke();
    } else if (expression === 'focus') {
      ctx.fillStyle = '#e27c7a';
      ctx.beginPath();
      ctx.ellipse(256, my + 4, 7.5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (expression === 'munch') {
      const openAmt = 5 + Math.abs(Math.sin(chewPhase * Math.PI * 2)) * 11;
      ctx.fillStyle = '#e07272';
      ctx.beginPath();
      ctx.ellipse(256, my + 4, 12, openAmt, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5.2;
      ctx.stroke();

      // Tiny cute rice grain stuck near mouth corner
      ctx.fillStyle = '#fffdf5';
      ctx.strokeStyle = '#b99d84';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(282, my + 5, 5.2, 4.2, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (expression === 'cheer' || expression === 'sparkle' || expression === 'eager') {
      // Big joyful open "D" smile!
      ctx.fillStyle = '#df6d70';
      ctx.beginPath();
      ctx.moveTo(236, my - 4);
      ctx.quadraticCurveTo(256, my + 38, 276, my - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f49a9c';
      ctx.beginPath();
      ctx.ellipse(256, my + 14, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = '#5a362c';
      ctx.beginPath();
      ctx.moveTo(236, my - 4);
      ctx.quadraticCurveTo(256, my + 38, 276, my - 4);
      ctx.quadraticCurveTo(256, my + 2, 236, my - 4);
      ctx.stroke();
    } else {
      // Warm gentle happy picture-book smile
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.moveTo(237, my - 2);
      ctx.quadraticCurveTo(256, my + 22, 275, my - 2);
      ctx.stroke();
    }

    this.texture.needsUpdate = true;
  }
}
