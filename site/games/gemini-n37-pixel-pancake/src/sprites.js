// Hand-crafted 16-color pixel-art renderers with 1px ink outlines & object-level 1px sprite stacking
(function (global) {
  'use strict';

  const PP = global.PP;
  const P = PP.PAL;

  // --- Small Iconic Pixel Patterns ---
  const HEART_PAT = [
    '.KK.KK.',
    'KBPKBBK',
    'KPPBBBK',
    'KBBBBBK',
    '.KBBBK.',
    '..KBK..',
    '...K...',
  ];

  const SPARKLE_PAT_BIG = [
    '...Y...',
    '...C...',
    '.Y.C.Y.',
    'CCYCYCC',
    '.Y.C.Y.',
    '...C...',
    '...Y...',
  ];

  const SPARKLE_PAT_SM = [
    '..Y..',
    '.YCY.',
    '..Y..',
  ];

  const BERRY_PAT = [
    '...K.K...',
    '..KMMMK..',
    '.KMBBBMK.',
    'KBPBBRBBK',
    'KPPBBRBBK',
    'KBBYBBYBK',
    '.KBBBBBK.',
    '..KBBBK..',
    '...KKK...',
  ];

  const BERRY_MAP = {
    K: P.INK,
    M: P.MINT,
    B: P.BERRY,
    R: P.BERRY,
    P: P.PINK,
    Y: P.BUTTER,
  };

  const HEART_MAP = {
    K: P.INK,
    B: P.BERRY,
    P: P.PINK,
  };

  const SPARK_MAP = {
    Y: P.BUTTER,
    C: P.CREAM,
  };

  // --- Kitchen Background (Low-contrast calm backdrop so outlined heroes pop!) ---
  function drawKitchenBackground(pb, layout, time) {
    const W = pb.w;
    const H = pb.h;
    const counterY = layout.counterY;

    // Warm cream/oat tiled kitchen backsplash
    pb.rect(0, 0, W, counterY, P.OAT);
    const tileW = 16;
    const tileH = 12;
    for (let y = 0; y < counterY; y += tileH) {
      const offset = ((y / tileH) & 1) ? 8 : 0;
      for (let x = -offset; x < W; x += tileW) {
        // Subtle light tile face
        pb.rect(x + 1, y + 1, tileW - 1, tileH - 1, P.CREAM);
        // Subtle oat bottom-right shade
        pb.hline(x + 1, x + tileW - 1, y + tileH - 1, P.OAT);
      }
    }

    // Morning kitchen window (upper-left)
    const wx = layout.window.x;
    const wy = layout.window.y;
    const ww = layout.window.w;
    const wh = layout.window.h;
    if (ww > 20 && wh > 20) {
      // Sky
      pb.rect(wx + 2, wy + 2, ww - 4, wh - 4, P.SKY);
      // Soft morning cloud drifting slowly
      const cx = wx + 6 + ((Math.floor(time * 2.5)) % Math.max(12, ww - 10));
      const cy = wy + Math.floor(wh * 0.42);
      for (let ox = -1; ox <= 1; ox++) {
        const px = wx + 4 + ((cx - wx + ox * (ww - 6) + (ww - 6) * 2) % (ww - 6));
        if (px > wx + 3 && px < wx + ww - 8) {
          pb.ellipse(px, cy, 7, 3, P.CREAM);
          pb.ellipse(px + 4, cy + 1, 5, 2, P.CREAM);
        }
      }
      // Sunbeams (diagonal subtle cream dots)
      for (let i = 0; i < 4; i++) {
        pb.px(wx + 7 + i * 3, wy + 6 + i * 2, P.CREAM);
        pb.px(wx + 12 + i * 3, wy + 5 + i * 2, P.CREAM);
      }
      // Window muntin crossbars
      const midX = wx + (ww >> 1);
      const midY = wy + (wh >> 1);
      pb.rect(midX - 1, wy + 2, 2, wh - 4, P.CREAM);
      pb.rect(wx + 2, midY - 1, ww - 4, 2, P.CREAM);
      // Wooden window frame
      pb.rect(wx, wy, ww, 2, P.MAPLE);
      pb.rect(wx, wy + wh - 2, ww, 3, P.MAPLE);
      pb.rect(wx, wy, 2, wh, P.MAPLE);
      pb.rect(wx + ww - 2, wy, 2, wh, P.MAPLE);
      pb.hline(wx - 2, wx + ww + 1, wy + wh, P.GOLDEN);
      pb.hline(wx - 2, wx + ww + 1, wy + wh + 1, P.COCOA);

      // Cute tiny potted herb on the windowsill
      const px = wx + ww - 13;
      const py = wy + wh - 1;
      pb.rect(px, py - 5, 7, 5, P.BLUSH);
      pb.hline(px - 1, px + 7, py - 5, P.GOLDEN);
      pb.hline(px, px + 6, py - 1, P.COCOA);
      pb.ellipse(px + 3, py - 8, 4, 2, P.MINT);
      pb.px(px + 1, py - 10, P.MINT);
      pb.px(px + 5, py - 10, P.MINT);
      pb.px(px + 3, py - 9, P.CREAM);
    }

    // Small cozy kitchen shelf on the upper-right in wide/mid mode
    if (layout.mode !== 'tall') {
      const sx = W - 58;
      const sy = Math.max(18, counterY - 38);
      pb.rect(sx, sy, 48, 3, P.MAPLE);
      pb.hline(sx, sx + 47, sy, P.GOLDEN);
      pb.hline(sx, sx + 47, sy + 3, P.OAT);
      // Cute jam jar & mug silhouette (muted, clearly background!)
      pb.rect(sx + 8, sy - 9, 8, 9, P.CREAM);
      pb.rect(sx + 9, sy - 6, 6, 5, P.PINK);
      pb.rect(sx + 7, sy - 10, 10, 2, P.OAT);
      pb.rect(sx + 24, sy - 8, 9, 8, P.SKY);
      pb.rect(sx + 33, sy - 6, 2, 4, P.SKY);
      pb.hline(sx + 25, sx + 31, sy - 7, P.CREAM);
    }

    // Warm wooden kitchen counter
    pb.hline(0, W - 1, counterY - 1, P.INK);
    pb.hline(0, W - 1, counterY, P.GOLDEN);
    pb.hline(0, W - 1, counterY + 1, P.GOLDEN);
    pb.rect(0, counterY + 2, W, H - counterY - 2, P.MAPLE);

    // Subtle calm wood plank seams (low-contrast so outlined foreground objects pop!)
    for (let y = counterY + 20; y < H - 8; y += 22) {
      pb.hline(0, W - 1, y, P.COCOA);
      // Tiny subtle wood grain dashes
      for (let gx = (y * 7) % 36; gx < W; gx += 44) {
        pb.hline(gx, gx + 7, y - 6, P.COCOA);
      }
    }
    // Counter front edge trim near bottom
    if (H - counterY > 24) {
      pb.rect(0, H - 5, W, 5, P.COCOA);
      pb.hline(0, W - 1, H - 5, P.INK);
    }
  }

  // --- Expressive Pixel Mama (Hero Character, right behind counter!) ---
  function drawMama(pb, layout, mama, time) {
    const cx = Math.round(layout.mama.x + mama.swayX);
    const baseY = Math.round(layout.counterY - 1 + mama.bounceY);
    const breathe = Math.sin(time * 2.4) > 0.35 ? 1 : 0;

    pb.beginScratch();

    // Back hair volume (warm chestnut bob + cute high side bun!)
    const headY = baseY - 40 + breathe;
    // High bun on top-right
    pb.sEllipse(cx + 16, headY - 15, 8, 7, P.MAPLE);
    pb.sEllipse(cx + 17, headY - 16, 5, 4, P.GOLDEN);

    // Shoulders & cozy cream puff-sleeve blouse
    pb.sEllipse(cx, baseY - 1, 29, 18, P.CREAM);
    pb.sEllipse(cx - 23, baseY - 3, 9, 10, P.CREAM);
    pb.sEllipse(cx + 23, baseY - 3, 9, 10, P.CREAM);
    // Blouse soft shadow near counter
    pb.sRect(cx - 27, baseY - 2, 54, 3, P.OAT);

    // Back hair curtains flowing softly behind sides of neck (clean open chin!)
    pb.sEllipse(cx - 16, headY + 10, 7, 9, P.COCOA);
    pb.sEllipse(cx + 16, headY + 10, 7, 9, P.COCOA);
    pb.sEllipse(cx - 16, headY + 7, 7, 9, P.MAPLE);
    pb.sEllipse(cx + 16, headY + 7, 7, 9, P.MAPLE);

    // Red & pink apron bib + straps
    pb.sRect(cx - 15, baseY - 15, 30, 16, P.BERRY);
    pb.sRect(cx - 16, baseY - 19, 4, 9, P.BERRY);
    pb.sRect(cx + 12, baseY - 19, 4, 9, P.BERRY);
    pb.sRect(cx - 15, baseY - 18, 2, 7, P.PINK);
    pb.sRect(cx + 13, baseY - 18, 2, 7, P.PINK);
    pb.sRect(cx - 15, baseY - 15, 30, 2, P.PINK);
    pb.sRect(cx - 6, baseY - 8, 12, 6, P.PINK);
    pb.sRect(cx - 5, baseY - 7, 10, 4, P.BERRY);
    // Cute tiny cream heart button on apron
    pb.spx(cx - 1, baseY - 11, P.CREAM);
    pb.spx(cx + 1, baseY - 11, P.CREAM);
    pb.spx(cx, baseY - 10, P.CREAM);

    // Neck (clean, warm!)
    pb.sRect(cx - 4, baseY - 23, 8, 8, P.SKIN);
    pb.sRect(cx - 4, baseY - 23, 8, 3, P.BLUSH);

    // Ears
    pb.sEllipse(cx - 17, headY + 2, 3, 4, P.SKIN);
    pb.sEllipse(cx + 17, headY + 2, 3, 4, P.SKIN);
    pb.spx(cx - 17, headY + 2, P.BLUSH);
    pb.spx(cx + 17, headY + 2, P.BLUSH);

    // Face oval (warm peach skin!)
    pb.sEllipse(cx, headY + 1, 17, 15, P.SKIN);
    // Soft jaw highlight & chin curve
    pb.sEllipse(cx, headY + 14, 9, 2, P.BLUSH);
    pb.sEllipse(cx, headY + 12, 11, 3, P.SKIN);

    // Top hair & soft swept bangs
    pb.sEllipse(cx, headY - 9, 19, 10, P.MAPLE);
    // Side hair framing cheeks gracefully
    pb.sRect(cx - 19, headY - 6, 4, 15, P.MAPLE);
    pb.sRect(cx + 15, headY - 6, 4, 15, P.MAPLE);
    pb.sRect(cx - 19, headY + 7, 3, 3, P.COCOA);
    pb.sRect(cx + 16, headY + 7, 3, 3, P.COCOA);
    // Glossy hair highlight arc
    pb.sRect(cx - 11, headY - 15, 7, 2, P.GOLDEN);
    pb.sRect(cx + 2, headY - 15, 6, 2, P.GOLDEN);
    // Soft parted bangs over forehead
    pb.sRect(cx - 15, headY - 10, 30, 5, P.MAPLE);
    pb.sRect(cx - 14, headY - 5, 6, 2, P.MAPLE);
    pb.sRect(cx - 6, headY - 5, 5, 3, P.MAPLE);
    pb.sRect(cx + 5, headY - 5, 9, 2, P.MAPLE);
    pb.spx(cx + 1, headY - 6, P.SKIN);
    pb.spx(cx + 2, headY - 6, P.SKIN);

    // Cute BERRY & PINK hair ribbon bow right on the bun!
    pb.sRect(cx + 7, headY - 16, 4, 4, P.BERRY);
    pb.sRect(cx + 12, headY - 13, 4, 4, P.BERRY);
    pb.sRect(cx + 10, headY - 14, 3, 3, P.PINK);
    pb.spx(cx + 8, headY - 15, P.PINK);
    pb.spx(cx + 14, headY - 12, P.PINK);

    // Clear anything below counterY so Mama stands cleanly behind counter
    for (let y = layout.counterY; y < pb.h; y++) {
      const row = y * pb.w;
      for (let x = Math.max(0, cx - 36); x <= Math.min(pb.w - 1, cx + 36); x++) {
        pb.scratch[row + x] = 255;
      }
    }
    pb.commitScratch(P.INK);

    // --- Face Details (drawn crisply inside face) ---
    const eyeY = headY + 2;
    const lx = cx - 7;
    const rx = cx + 7;
    const lookX = Math.max(-2, Math.min(2, Math.round(mama.lookX)));
    const lookY = Math.max(-1, Math.min(2, Math.round(mama.lookY)));

    // Rosy cheeks (puffier when blowing or happy!)
    const cheekW = mama.mood === 'happy' || mama.mood === 'chew' || mama.mood === 'blow' ? 5 : 4;
    pb.rect(cx - 13, eyeY + 4, cheekW, 2, P.PINK);
    pb.rect(cx + 13 - cheekW, eyeY + 4, cheekW, 2, P.PINK);
    if (mama.mood === 'happy' || mama.mood === 'star' || mama.mood === 'chew') {
      pb.px(cx - 12, eyeY + 4, P.CREAM);
      pb.px(cx + 11, eyeY + 4, P.CREAM);
    }

    // Eyebrows
    const browLift = (mama.mood === 'surprised' || mama.mood === 'cheer' || mama.mood === 'star') ? -2 : 0;
    pb.hline(lx - 2, lx + 2, eyeY - 4 + browLift, P.COCOA);
    pb.hline(rx - 2, rx + 2, eyeY - 4 + browLift, P.COCOA);

    // Eyes by mood
    if (mama.blinkTimer > 0 && mama.mood === 'normal') {
      // Soft blink
      pb.hline(lx - 2, lx + 2, eyeY + 1, P.INK);
      pb.hline(rx - 2, rx + 2, eyeY + 1, P.INK);
    } else if (mama.mood === 'happy' || mama.mood === 'chew') {
      // Joyous ^ ^ smiling eyes!
      for (const ex of [lx, rx]) {
        pb.hline(ex - 2, ex + 2, eyeY - 1, P.INK);
        pb.px(ex - 3, eyeY, P.INK);
        pb.px(ex + 3, eyeY, P.INK);
        pb.px(ex - 2, eyeY - 2, P.INK);
        pb.px(ex + 2, eyeY - 2, P.INK);
        pb.hline(ex - 1, ex + 1, eyeY - 2, P.INK);
      }
    } else if (mama.mood === 'star') {
      // Sparkling golden star eyes!
      for (const ex of [lx, rx]) {
        pb.rect(ex - 2, eyeY - 2, 5, 5, P.INK);
        pb.px(ex, eyeY - 2, P.BUTTER);
        pb.px(ex, eyeY + 2, P.BUTTER);
        pb.px(ex - 2, eyeY, P.BUTTER);
        pb.px(ex + 2, eyeY, P.BUTTER);
        pb.px(ex, eyeY, P.CREAM);
      }
    } else if (mama.mood === 'surprised') {
      // Wide amazed O O eyes!
      for (const ex of [lx, rx]) {
        pb.rectOutline(ex - 3, eyeY - 3, 6, 6, P.CREAM, P.INK);
        pb.rect(ex - 1 + Math.sign(lookX), eyeY - 1 + Math.sign(lookY), 2, 2, P.INK);
        pb.px(ex - 2, eyeY - 2, P.CREAM);
      }
    } else {
      // Warm expressive eyes tracking the action!
      for (const ex of [lx, rx]) {
        // White sclera
        pb.rect(ex - 2, eyeY - 2, 5, 5, P.CREAM);
        // Dark iris/pupil shifted by look vector
        const px = ex - 1 + Math.max(-1, Math.min(1, lookX));
        const py = eyeY - 1 + Math.max(-1, Math.min(1, lookY));
        pb.rect(px, py, 3, 4, P.INK);
        // Top lash
        pb.hline(ex - 3, ex + 2, eyeY - 2, P.INK);
        // Bright twin catchlights
        pb.px(px, py, P.CREAM);
        pb.px(px + 2, py + 2, P.OAT);
      }
    }

    // Tiny cute pixel nose
    pb.px(cx, eyeY + 4, P.BLUSH);

    // Mouth by mood
    const my = eyeY + 7;
    if (mama.mood === 'aahn') {
      // Wide open "Aahn!" mouth waiting for a yummy bite
      const openR = 3 + Math.round(mama.aahnOpen * 2);
      pb.ellipse(cx, my + 1, 4, openR, P.INK);
      pb.ellipse(cx, my + 1, 3, Math.max(1, openR - 1), P.BERRY);
      pb.hline(cx - 2, cx + 2, my + openR - 1, P.PINK);
    } else if (mama.mood === 'chew') {
      // Happy munching mouth
      const ch = Math.sin(time * 16) > 0;
      if (ch) {
        pb.hline(cx - 3, cx + 3, my, P.INK);
        pb.hline(cx - 2, cx + 2, my + 1, P.BERRY);
      } else {
        pb.hline(cx - 2, cx + 2, my + 1, P.INK);
        pb.px(cx - 3, my, P.INK);
        pb.px(cx + 3, my, P.INK);
      }
    } else if (mama.mood === 'blow') {
      // Cute "Fuuu~" blowing pout
      pb.rectOutline(cx - 2, my - 1, 4, 4, P.BERRY, P.INK);
    } else if (mama.mood === 'surprised') {
      // Cute excited "O!" mouth
      pb.ellipse(cx, my + 1, 3, 3, P.INK);
      pb.ellipse(cx, my + 1, 2, 2, P.BERRY);
      pb.px(cx, my + 2, P.PINK);
    } else if (mama.mood === 'happy' || mama.mood === 'star' || mama.mood === 'cheer') {
      // Big joyful D-smile!
      pb.hline(cx - 4, cx + 4, my - 1, P.INK);
      pb.rect(cx - 3, my, 7, 3, P.BERRY);
      pb.hline(cx - 2, cx + 2, my + 2, P.PINK);
      pb.px(cx - 4, my, P.INK);
      pb.px(cx + 4, my, P.INK);
      pb.hline(cx - 3, cx + 3, my + 3, P.INK);
    } else {
      // Gentle loving smile
      pb.hline(cx - 2, cx + 2, my + 1, P.INK);
      pb.px(cx - 3, my, P.INK);
      pb.px(cx + 3, my, P.INK);
    }

    // --- Mama's Animated Hands (drawn OVER counter edge so she feels right there!) ---
    drawMamaHands(pb, layout, mama, cx, baseY, time);
  }

  function drawMamaHands(pb, layout, mama, cx, baseY, time) {
    let lx = cx - 26;
    let ly = layout.counterY + 2;
    let rx = cx + 26;
    let ry = layout.counterY + 2;

    if (mama.handAction === 'clap') {
      const clap = Math.abs(Math.sin(time * 18));
      lx = cx - 4 - Math.round(clap * 10);
      rx = cx + 4 + Math.round(clap * 10);
      ly = layout.counterY - 7;
      ry = layout.counterY - 7;
    } else if (mama.handAction === 'cheer') {
      const wave = Math.round(Math.sin(time * 14) * 3);
      lx = cx - 28;
      ly = layout.counterY - 22 + wave;
      rx = cx + 28;
      ry = layout.counterY - 22 - wave;
    } else if (mama.handAction === 'fan') {
      const fan = Math.round(Math.sin(time * 20) * 6);
      rx = cx + 18 + fan;
      ry = layout.counterY - 14;
    } else if (mama.handAction === 'hint' && mama.hintTarget) {
      // Gentle single-hand nudge near the next object after 10s idle!
      const bob = Math.round(Math.sin(time * 7) * 3);
      const tx = mama.hintTarget.x;
      const ty = mama.hintTarget.y;
      if (tx < cx) {
        lx = Math.round(lx + (tx - lx) * mama.hintProgress);
        ly = Math.round(ly + (ty - 14 - ly) * mama.hintProgress) + bob;
      } else {
        rx = Math.round(rx + (tx - rx) * mama.hintProgress);
        ry = Math.round(ry + (ty - 14 - ry) * mama.hintProgress) + bob;
      }
    } else {
      // Subtle gentle breathing motion on counter
      ly += Math.round(Math.sin(time * 2.4) * 0.6);
      ry += Math.round(Math.sin(time * 2.4 + 0.8) * 0.6);
    }

    for (const h of [{ x: lx, y: ly, flip: false }, { x: rx, y: ry, flip: true }]) {
      pb.beginScratch();
      pb.sEllipse(h.x, h.y, 6, 4, P.SKIN);
      pb.sEllipse(h.x, h.y + 2, 5, 2, P.BLUSH);
      // Cute thumb bump
      pb.sEllipse(h.x + (h.flip ? -5 : 5), h.y - 1, 2, 2, P.SKIN);
      pb.commitScratch(P.INK);
      // Subtle finger lines
      pb.px(h.x - 2, h.y + 1, P.BLUSH);
      pb.px(h.x + 1, h.y + 1, P.BLUSH);
    }
  }

  // --- Stove Burner & Animated Flames + Interactive Flame Knob ---
  function drawStove(pb, layout, heat, time, knobBounce) {
    const px = Math.round(layout.pan.x);
    const py = Math.round(layout.pan.y + 8);
    const rx = layout.pan.rx + 6;
    const ry = layout.pan.ry + 3;

    // Dark recessed stovetop plate
    pb.beginScratch();
    pb.sEllipse(px, py + 3, rx + 5, ry + 3, P.IRON);
    pb.sEllipse(px, py + 2, rx + 2, ry + 1, P.SLATE);
    pb.sEllipse(px, py + 2, rx - 1, ry - 1, P.INK);
    // 4 grate prongs
    pb.sRect(px - rx - 2, py + 1, 9, 3, P.SLATE);
    pb.sRect(px + rx - 7, py + 1, 9, 3, P.SLATE);
    pb.sRect(px - 2, py - ry + 1, 4, 6, P.SLATE);
    pb.sRect(px - 2, py + ry - 3, 4, 6, P.SLATE);
    pb.commitScratch(P.INK);

    // Animated gas flame tongues peeking around the pan base!
    const flameCount = heat === 0 ? 5 : heat === 1 ? 7 : 9;
    const flameH = heat === 0 ? 3 : heat === 1 ? 5 : 8;
    for (let i = 0; i < flameCount; i++) {
      const ang = (i / (flameCount - 1)) * Math.PI; // front semicircle
      const fx = Math.round(px - Math.cos(ang) * (rx - 4));
      const fy = Math.round(py + 3 + Math.sin(ang) * (ry - 3));
      const flick = Math.sin(time * (14 + heat * 5) + i * 2.3);
      const h = Math.max(2, flameH + Math.round(flick * 1.5));
      pb.rect(fx - 2, fy - h + 2, 4, h, P.BERRY);
      pb.rect(fx - 1, fy - h + 3, 2, Math.max(1, h - 1), P.HONEY);
      if (h >= 4) pb.px(fx, fy - h + 4, P.BUTTER);
    }

    // Tactile Stove Flame Dial Knob (interactive!)
    const kx = Math.round(layout.knob.x);
    const ky = Math.round(layout.knob.y + Math.round(knobBounce));
    pb.beginScratch();
    pb.sEllipse(kx, ky + 1, 9, 8, P.IRON);
    pb.sEllipse(kx, ky, 8, 7, P.SLATE);
    pb.sEllipse(kx, ky - 1, 6, 5, P.CREAM);
    // Dial pointer bar rotating by heat level (0: left, 1: up, 2: right)
    const ang = heat === 0 ? -0.9 : heat === 1 ? 0 : 0.9;
    const dx = Math.round(Math.sin(ang) * 4);
    const dy = Math.round(-Math.cos(ang) * 4);
    pb.sLine(kx, ky - 1, kx + dx, ky - 1 + dy, P.BERRY, 2);
    pb.commitScratch(P.INK);

    // 3 visual flame indicator dots above knob (zero text!)
    for (let i = 0; i < 3; i++) {
      const dotX = kx - 6 + i * 6;
      const dotY = ky - 10;
      const lit = i <= heat;
      pb.rect(dotX - 1, dotY - 1, 3, 3, P.INK);
      pb.px(dotX, dotY, lit ? (i === 2 ? P.BERRY : P.BUTTER) : P.SLATE);
    }
  }

  // --- 1px Sprite-Stacked Cast-Iron Frying Pan ---
  function drawFryingPan(pb, layout, pan, time) {
    const cx = Math.round(layout.pan.x + pan.ox);
    const cy = Math.round(layout.pan.y + pan.oy);
    const rx = layout.pan.rx;
    const ry = layout.pan.ry;
    const tilt = pan.tilt; // 0 = flat, positive = flicked upward!

    // Shadow on stove
    pb.ellipse(Math.round(layout.pan.x), Math.round(layout.pan.y + 8), rx - 2, ry - 2, P.INK);

    pb.beginScratch();

    // Handle sticking out toward bottom-left (super inviting to grab/flick!)
    const hAngle = layout.pan.handleAngle; // radians
    const hLen = layout.pan.handleLen;
    const hx0 = Math.round(cx + Math.cos(hAngle) * (rx - 4));
    const hy0 = Math.round(cy + Math.sin(hAngle) * (ry - 2));
    const liftY = Math.round(-tilt * 14);
    const hx1 = Math.round(cx + Math.cos(hAngle) * (rx + hLen));
    const hy1 = Math.round(cy + Math.sin(hAngle) * (ry + hLen * 0.55) + liftY);

    // Handle 1px thickness stack (3 layers)
    for (let s = 0; s < 3; s++) {
      const col = s === 0 ? P.COCOA : s === 1 ? P.MAPLE : P.GOLDEN;
      pb.sLine(hx0, hy0 + 2 - s, hx1, hy1 + 2 - s, col, 6);
    }
    // Metal neck connecting pan to wooden handle
    const mx = Math.round(hx0 + (hx1 - hx0) * 0.3);
    const my = Math.round(hy0 + (hy1 - hy0) * 0.3);
    pb.sLine(hx0, hy0, mx, my, P.IRON, 5);
    pb.sLine(hx0, hy0 - 1, mx, my - 1, P.SLATE, 3);
    // Hanging hole on handle tip
    pb.spx(hx1 - Math.sign(hx1 - hx0) * 2, hy1, P.INK);

    // 1px Sprite-Stacked Pan Bowl (6 integer pixel slices!)
    const tiltY = Math.round(tilt * 3);
    const curRy = Math.max(8, Math.round(ry * (1 - tilt * 0.22)));
    for (let s = 0; s < 6; s++) {
      const sy = cy + 4 - s - Math.round(tilt * s * 0.35);
      const shrink = s === 0 ? -2 : s === 1 ? -1 : 0;
      const col = s < 2 ? P.IRON : s < 4 ? P.IRON : P.SLATE;
      pb.sEllipse(cx, sy - tiltY, rx + shrink, curRy + (shrink >> 1), col);
    }
    // Pan top metallic rim & recessed dark cooking interior
    const topY = cy - 2 - tiltY;
    pb.sEllipse(cx, topY, rx, curRy, P.SLATE);
    pb.sEllipse(cx, topY + 1, rx - 3, curRy - 2, P.IRON);
    pb.sEllipse(cx, topY + 2, rx - 5, curRy - 3, P.INK);
    // Subtle cast-iron floor
    pb.sEllipse(cx, topY + 3, rx - 6, curRy - 4, P.IRON);
    // Metallic rim glint positioned cleanly ON the curved iron rim
    pb.sRect(cx - 12, topY - curRy + 1, 10, 1, P.CREAM);
    pb.sRect(cx + 4, topY + curRy - 1, 8, 1, P.SKY);

    pb.commitScratch(P.INK);

    // Melted butter skating/foaming inside hot pan!
    if (pan.butterLevel > 0.05) {
      const brx = Math.round((rx - 10) * Math.min(1, pan.butterLevel));
      const bry = Math.round((curRy - 6) * Math.min(1, pan.butterLevel));
      pb.ellipse(cx, topY + 3, brx, bry, P.HONEY);
      pb.ellipse(cx - 2, topY + 2, Math.max(2, brx - 4), Math.max(1, bry - 2), P.BUTTER);
      // Sparkling foam dots
      for (let i = 0; i < 4; i++) {
        const fx = cx + Math.round(Math.sin(time * 5 + i * 1.9) * (brx - 2));
        const fy = topY + 2 + Math.round(Math.cos(time * 4 + i * 2.1) * (bry - 1));
        pb.px(fx, fy, P.CREAM);
      }
    }

    // Caramelized syrup glow in pan if player poured syrup into hot pan!
    if (pan.syrupLevel > 0.05) {
      const srx = Math.round((rx - 12) * Math.min(1, pan.syrupLevel));
      const sry = Math.round((curRy - 7) * Math.min(1, pan.syrupLevel));
      pb.ellipse(cx, topY + 3, srx, sry, P.MAPLE);
      pb.ellipse(cx - 1, topY + 2, Math.max(2, srx - 3), Math.max(1, sry - 2), P.GOLDEN);
    }

    // Skating solid butter cube in pan before fully melted
    if (pan.butterPat && pan.butterPat.life > 0) {
      const bp = pan.butterPat;
      const bx = Math.round(cx + bp.x);
      const by = Math.round(topY + 2 + bp.y);
      const h = Math.max(1, Math.ceil(bp.life * 4));
      pb.beginScratch();
      for (let s = 0; s < h; s++) {
        pb.sRect(bx - 4, by - s, 8, 3, s === h - 1 ? P.BUTTER : P.HONEY);
      }
      pb.spx(bx - 2, by - h + 1, P.CREAM);
      pb.commitScratch(P.INK);
    }
  }

  // --- Helper: Hotcake surface color by cook level (0=raw .. 1=golden .. 1.5=crispy) ---
  function getCookColors(cook, buttered, caramelized) {
    if (cook < 0.28) {
      return { main: P.CREAM, rim: P.OAT, edge: P.CREAM, sheen: P.BUTTER };
    }
    if (cook < 0.58) {
      return { main: P.CREAM, rim: P.HONEY, edge: P.OAT, sheen: P.CREAM };
    }
    if (cook < 1.18) {
      return {
        main: caramelized ? P.MAPLE : P.GOLDEN,
        rim: P.HONEY,
        edge: buttered ? P.BUTTER : P.HONEY,
        sheen: buttered ? P.CREAM : P.BUTTER,
      };
    }
    // Extra-toasty crispy (funny, not punished!)
    return { main: P.MAPLE, rim: P.COCOA, edge: P.GOLDEN, sheen: P.HONEY };
  }

  // --- 1px Sprite-Stacked Fluffy Hotcake (Pan, Mid-Air 3D Flip, AND Stacked!) ---
  function drawHotcake(pb, hc, cx, cy, time, flipAngle, scaleX, scaleY) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    const sx = scaleX || 1;
    const sy = scaleY || 1;

    const baseRx = hc.rx * sx;
    const baseRy = hc.ry * sy;
    const angle = flipAngle || 0;
    const cosA = Math.cos(angle);
    const sinA = Math.abs(Math.sin(angle));

    // Determine which face is visible during 3D flip
    const showingBottom = cosA < 0;
    const visibleCook = showingBottom ? hc.bottomCook : hc.topCook;
    const cols = getCookColors(visibleCook, hc.buttered, hc.caramelized);

    // 1px Sprite-Stack thickness grows as it cooks & puffs up!
    const rawSlices = Math.round(hc.thickness * sy);
    const flatRy = Math.max(2, Math.round(baseRy * Math.abs(cosA)));
    const stackH = Math.max(2, Math.round(rawSlices * (0.75 + 0.55 * sinA)));

    const earRx = Math.max(4, Math.round(baseRx * 0.34));
    const earRy = Math.max(3, Math.round(flatRy * 0.48));
    const earOffX = Math.round(baseRx * 0.72);
    const earOffY = Math.round(-flatRy * 0.62);

    pb.beginScratch();

    // Draw stacked 1px horizontal slices from bottom to top!
    for (let s = 0; s < stackH; s++) {
      const y = cy - s;
      const isTop = s === stackH - 1;
      const sideCol = s === 0 ? P.OAT : (hc.buttered ? P.BUTTER : P.CREAM);
      const fillCol = isTop ? cols.main : sideCol;

      // Main hotcake disc (with toasted golden ring on top slice)
      if (isTop) {
        pb.sEllipse(cx, y, baseRx, flatRy, cols.edge);
        if (baseRx > 4 && flatRy > 2) {
          pb.sEllipse(cx, y, baseRx - 2, Math.max(1, flatRy - 1), cols.rim);
        }
        if (baseRx > 7 && flatRy > 4) {
          pb.sEllipse(cx, y, baseRx - 4, Math.max(1, flatRy - 2), cols.main);
        }
      } else {
        pb.sEllipse(cx, y, baseRx, flatRy, fillCol);
      }

      // Bear-ear fusion blobs (if player dropped extra batter near edges!)
      if (hc.hasEars) {
        pb.sEllipse(cx - earOffX, y + earOffY, earRx, earRy, isTop ? cols.main : sideCol);
        pb.sEllipse(cx + earOffX, y + earOffY, earRx, earRy, isTop ? cols.main : sideCol);
      }
    }

    const topY = cy - (stackH - 1);

    // Top-surface tasty details when visible face is mostly facing camera
    if (Math.abs(cosA) > 0.35) {
      // Glossy highlight arc
      if (baseRx > 10 && flatRy > 5) {
        pb.sEllipse(cx - Math.round(baseRx * 0.28), topY - Math.round(flatRy * 0.32), Math.max(2, Math.round(baseRx * 0.22)), Math.max(1, Math.round(flatRy * 0.16)), cols.sheen);
      }

      // Extra-toasty crispy dark spots
      if (visibleCook >= 1.18 && flatRy > 4) {
        pb.sEllipse(cx - 5, topY + 1, 4, 2, P.COCOA);
        pb.sEllipse(cx + 6, topY - 1, 3, 2, P.COCOA);
        pb.sEllipse(cx + 1, topY + 3, 3, 1, P.COCOA);
      }

      // Special toasted HEART mark when cooked in a buttered pan!
      if (hc.buttered && visibleCook >= 0.58 && visibleCook < 1.18 && flatRy >= 6) {
        const hy = topY - 2;
        pb.sRect(cx - 3, hy, 2, 2, P.MAPLE);
        pb.sRect(cx + 1, hy, 2, 2, P.MAPLE);
        pb.sRect(cx - 3, hy + 1, 6, 2, P.MAPLE);
        pb.sRect(cx - 2, hy + 3, 4, 1, P.MAPLE);
        pb.spx(cx - 1, hy + 4, P.MAPLE);
        pb.spx(cx, hy + 4, P.MAPLE);
      }

      // Cute toasted BEAR FACE when bear ears are fused & golden!
      if (hc.hasEars && visibleCook >= 0.55 && flatRy >= 6) {
        pb.sRect(cx - 6, topY - 1, 2, 2, P.COCOA);
        pb.sRect(cx + 4, topY - 1, 2, 2, P.COCOA);
        pb.sEllipse(cx, topY + 2, 3, 2, P.HONEY);
        pb.spx(cx, topY + 1, P.COCOA);
        pb.spx(cx - 1, topY + 3, P.COCOA);
        pb.spx(cx + 1, topY + 3, P.COCOA);
      }

      // Puku-puku cooking bubbles on uncooked top side!
      if (!showingBottom && hc.bubbles && hc.bubbles.length > 0 && visibleCook < 0.55) {
        for (let i = 0; i < hc.bubbles.length; i++) {
          const b = hc.bubbles[i];
          const bx = Math.round(cx + b.ox * sx);
          const by = Math.round(topY + b.oy * Math.abs(cosA));
          const br = Math.max(1, Math.round(b.r));
          if (b.popped) {
            // Soft popped batter dimple
            pb.sEllipse(bx, by, br, Math.max(1, br - 1), P.OAT);
            pb.spx(bx, by, P.HONEY);
          } else {
            // Plump glossy rising batter bubble!
            pb.sEllipse(bx, by + 1, br + 1, Math.max(1, br), P.OAT);
            pb.sEllipse(bx, by, br, Math.max(1, br - 1), P.CREAM);
            pb.spx(bx - 1, by - 1, P.BUTTER);
          }
        }
      }
    }

    // Bite-mark chomps when being eaten!
    if (hc.bites && hc.bites.length > 0) {
      for (const bite of hc.bites) {
        const bx = Math.round(cx + bite.ox);
        const by = Math.round(topY + bite.oy);
        const r = bite.r;
        for (let yy = by - r; yy <= by + r + stackH; yy++) {
          if (yy < 0 || yy >= pb.h) continue;
          const row = yy * pb.w;
          for (let xx = bx - r; xx <= bx + r; xx++) {
            if (xx < 0 || xx >= pb.w) continue;
            const dx = xx - bx;
            const dy = Math.min(0, yy - by);
            if (dx * dx + dy * dy <= r * r && yy <= cy + flatRy) {
              pb.scratch[row + xx] = 255;
            }
          }
        }
      }
    }

    pb.commitScratch(P.INK);
    return { topY, stackH, flatRy };
  }

  // --- Plate & Wobbling Stacked Hotcake Tower + Butter + Syrup + Berries ---
  function drawPlateAndStack(pb, layout, plate, time) {
    const px = Math.round(layout.plate.x);
    const py = Math.round(layout.plate.y);
    const rx = layout.plate.rx;
    const ry = layout.plate.ry;

    // Plate cast shadow
    pb.ellipse(px, py + 5, rx + 1, ry - 1, P.COCOA);

    // 1px Sprite-Stacked Scalloped Ceramic Plate (4 slices)
    pb.beginScratch();
    for (let s = 0; s < 4; s++) {
      const col = s === 0 ? P.SKY : s === 1 ? P.OAT : P.CREAM;
      pb.sEllipse(px, py + 3 - s, rx - (s === 0 ? 4 : 0), ry - (s === 0 ? 2 : 0), col);
    }
    // Inner plate well
    pb.sEllipse(px, py + 1, rx - 7, ry - 4, P.OAT);
    pb.sEllipse(px, py + 1, rx - 9, ry - 5, P.CREAM);
    // Decorative berry rim dots
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const dx = Math.round(px + Math.cos(a) * (rx - 4));
      const dy = Math.round(py + Math.sin(a) * (ry - 2));
      pb.spx(dx, dy, P.PINK);
    }
    pb.commitScratch(P.INK);

    // Pooled overflow maple syrup on the plate!
    if (plate.syrupPool > 0.05) {
      const srx = Math.round((rx - 8) * Math.min(1, plate.syrupPool));
      const sry = Math.round((ry - 4) * Math.min(1, plate.syrupPool));
      pb.beginScratch();
      pb.sEllipse(px, py + 1, srx, sry, P.MAPLE);
      pb.sEllipse(px - 2, py, Math.max(2, srx - 4), Math.max(1, sry - 2), P.GOLDEN);
      pb.spx(px - Math.round(srx * 0.4), py - 1, P.CREAM);
      pb.commitScratch(P.COCOA);
    }

    // Draw each stacked hotcake from bottom to top with spring wobble!
    const stack = plate.stack;
    let curY = py + 1;
    let topCenterX = px;
    let topCake = null;
    let topInfo = null;

    for (let i = 0; i < stack.length; i++) {
      const cake = stack[i];
      const heightFactor = (i + 1) * 0.45;
      const wobbleX = Math.round(plate.wobble * heightFactor * 5 + cake.jitterX);
      const cx = px + wobbleX;
      const sqX = 1 + cake.squash * 0.24;
      const sqY = Math.max(0.62, 1 - cake.squash * 0.28);

      const info = drawHotcake(pb, cake, cx, curY, time, 0, sqX, sqY);
      topCenterX = cx;
      topCake = cake;
      topInfo = info;

      // Syrup drips hugging the creamy side of each stacked cake!
      if (plate.syrupAmount > 0.12) {
        const dripReach = Math.min(1, plate.syrupAmount * 1.45 - (stack.length - 1 - i) * 0.16);
        if (dripReach > 0) {
          for (let d = 0; d < 5; d++) {
            const dx = cx - Math.round(cake.rx * 0.72) + Math.round((d / 4) * cake.rx * 1.44);
            const dh = Math.max(3, Math.round((info.stackH + 4) * dripReach * (0.65 + ((d * 37 + i * 13) % 5) * 0.1)));
            pb.rect(dx - 2, info.topY + 3, 5, dh, P.COCOA);
            pb.rect(dx - 1, info.topY + 3, 3, Math.max(1, dh - 1), P.MAPLE);
            pb.vline(dx, info.topY + 3, info.topY + 1 + Math.max(1, dh - 2), P.HONEY);
            pb.px(dx, info.topY + 2 + dh, P.MAPLE);
          }
        }
      }

      curY -= Math.max(4, Math.round(info.stackH * 0.85));
    }

    if (topCake && topInfo) {
      const topY = topInfo.topY;

      // Rich glossy amber maple syrup cap & thick cascading drips on top of the stack!
      if (plate.syrupAmount > 0.04) {
        const amt = Math.min(1.3, plate.syrupAmount);
        const srx = Math.round(topCake.rx * Math.min(0.96, 0.42 + amt * 0.56));
        const sry = Math.round(topInfo.flatRy * Math.min(0.94, 0.4 + amt * 0.54));
        pb.beginScratch();
        pb.sEllipse(topCenterX, topY + 1, srx, sry, P.MAPLE);
        pb.sEllipse(topCenterX - 1, topY, Math.max(3, srx - 3), Math.max(2, sry - 2), P.MAPLE);
        // Glossy amber-honey inner gleam & cream specular shine
        pb.sEllipse(topCenterX - Math.round(srx * 0.25), topY - Math.round(sry * 0.25), Math.max(3, Math.round(srx * 0.35)), Math.max(1, Math.round(sry * 0.28)), P.HONEY);
        pb.sEllipse(topCenterX - Math.round(srx * 0.32), topY - Math.round(sry * 0.3), Math.max(2, Math.round(srx * 0.16)), 1, P.CREAM);
        // Thick cascading syrup drips running down the front lip!
        for (let d = 0; d < 6; d++) {
          const t = (d - 2.5) / 2.6;
          const dx = Math.round(topCenterX + t * srx * 0.86);
          const dy = Math.round(topY + Math.sqrt(Math.max(0.15, 1 - t * t)) * sry * 0.72);
          const dlen = Math.round(3 + amt * (5 + ((d * 19) % 5)));
          pb.sRect(dx - 1, dy, 3, dlen, P.MAPLE);
          pb.sLine(dx, dy + 1, dx, dy + dlen - 1, P.HONEY, 1);
          pb.sEllipse(dx, dy + dlen, 2, 1, P.MAPLE);
          pb.spx(dx, dy + dlen - 1, P.CREAM);
        }
        pb.commitScratch(P.COCOA);
      }

      // Melting Butter Pat(s) on top of the stack (1px sprite-stacked cube + golden pool!)
      for (let bIdx = 0; bIdx < plate.butters.length; bIdx++) {
        const b = plate.butters[bIdx];
        const bx = Math.round(topCenterX + b.ox);
        const by = Math.round(topY + b.oy - bIdx * 3);
        const melt = b.melt; // 0 = fresh square, 1 = warmly melted

        // Golden melted butter puddle spreading from base
        if (melt > 0.08) {
          const mrx = Math.round(6 + melt * 9);
          const mry = Math.round(3 + melt * 4);
          pb.beginScratch();
          pb.sEllipse(bx, by + 2, mrx, mry, P.HONEY);
          pb.sEllipse(bx - 1, by + 1, Math.max(2, mrx - 3), Math.max(1, mry - 1), P.BUTTER);
          pb.commitScratch(P.GOLDEN);
        }

        // 1px stacked golden butter cube shrinking as it melts
        const bh = Math.max(2, Math.round(5 - melt * 2.6));
        const bw = Math.round(5 + melt * 1.2);
        const sq = b.squash || 0;
        const rxB = Math.round(bw * (1 + sq * 0.35));
        const ryB = Math.max(2, Math.round(3 * (1 - sq * 0.25)));
        pb.beginScratch();
        for (let s = 0; s < bh; s++) {
          const col = s === bh - 1 ? P.BUTTER : P.HONEY;
          pb.sRect(bx - rxB, by + 1 - s - ryB, rxB * 2, ryB * 2, col);
        }
        // Bright creamy highlight corner
        pb.sRect(bx - rxB + 1, by + 1 - (bh - 1) - ryB + 1, Math.max(2, rxB - 1), 1, P.CREAM);
        pb.commitScratch(P.INK);
      }

      // Plump Red Strawberries on top of the stack!
      for (let sIdx = 0; sIdx < plate.berries.length; sIdx++) {
        const st = plate.berries[sIdx];
        const bx = Math.round(topCenterX + st.ox) - 4;
        const by = Math.round(topY + st.oy - 7 - Math.round(st.bounce * 6));
        pb.drawPattern(BERRY_PAT, bx, by, BERRY_MAP, false, 1);
      }
    }

    return { topY: topInfo ? topInfo.topY : py, topCenterX };
  }

  // --- Batter Mixing Bowl & Wooden Ladle ---
  function drawBatterBowl(pb, layout, bowl, time) {
    const cx = Math.round(layout.bowl.x + bowl.wobbleX);
    const cy = Math.round(layout.bowl.y);
    const rx = layout.bowl.rx;
    const ry = layout.bowl.ry;

    // Shadow
    pb.ellipse(cx, cy + ry + 3, rx - 2, 4, P.COCOA);

    pb.beginScratch();
    // Mint ceramic bowl body (chunky pixel bowl!)
    pb.sEllipse(cx, cy + 5, rx - 1, ry + 3, P.MINT);
    pb.sEllipse(cx, cy + 3, rx, ry + 1, P.MINT);
    // Shading band
    pb.sEllipse(cx, cy + 8, rx - 5, Math.max(3, ry - 2), P.IRON);
    pb.sEllipse(cx, cy + 6, rx - 3, Math.max(3, ry - 1), P.MINT);
    // Bowl rim & creamy batter inside
    pb.sEllipse(cx, cy - 1, rx, Math.round(ry * 0.65), P.CREAM);
    pb.sEllipse(cx, cy, rx - 3, Math.round(ry * 0.52), P.OAT);
    pb.sEllipse(cx, cy, rx - 4, Math.round(ry * 0.45), P.CREAM);
    // Creamy batter swirl & yolk glint
    pb.sEllipse(cx - 4, cy - 1, 5, 2, P.BUTTER);
    pb.sEllipse(cx - 4, cy - 1, 3, 1, P.CREAM);
    // Cute ceramic shine on front of bowl
    pb.sRect(cx - rx + 5, cy + 6, 3, 5, P.CREAM);
    pb.spx(cx - rx + 6, cy + 12, P.CREAM);
    pb.commitScratch(P.INK);

    // Resting wooden ladle sticking up invitingly (if not currently being dragged!)
    if (!bowl.ladleHeld) {
      const bob = Math.round(bowl.inviteBob);
      drawLadle(pb, cx + 6, cy - 2 + bob, 0.35, true);
    }
  }

  // --- Wooden Ladle (Resting or Dragged & Dripping Batter!) ---
  function drawLadle(pb, x, y, tiltAngle, hasBatter, pouring) {
    x = Math.round(x);
    y = Math.round(y);
    const ang = tiltAngle || 0;
    const hx = Math.round(x + Math.sin(ang) * 20);
    const hy = Math.round(y - Math.cos(ang) * 20);

    pb.beginScratch();
    // Wooden handle
    pb.sLine(x, y, hx, hy, P.MAPLE, 4);
    pb.sLine(x - 1, y - 1, hx - 1, hy - 1, P.GOLDEN, 2);
    // Ladle scoop cup
    pb.sEllipse(x, y + 2, 9, 6, P.MAPLE);
    pb.sEllipse(x, y + 1, 8, 5, P.GOLDEN);
    if (hasBatter) {
      pb.sEllipse(x, y, 7, 4, P.CREAM);
      pb.spx(x - 2, y - 1, P.BUTTER);
    }
    pb.commitScratch(P.INK);

    // Creamy batter stream pouring out when pouring!
    if (pouring) {
      pb.beginScratch();
      pb.sRect(x - 2, y + 5, 5, 16, P.CREAM);
      pb.svline(x - 1, y + 5, y + 20, P.OAT);
      pb.sEllipse(x, y + 20, 4, 2, P.CREAM);
      pb.commitScratch(P.INK);
    }
  }

  // --- Butter Dish (on counter) ---
  function drawButterDish(pb, layout, dish, time) {
    const cx = Math.round(layout.butter.x + dish.wobbleX);
    const cy = Math.round(layout.butter.y + dish.bobY);

    pb.ellipse(cx, cy + 5, 13, 4, P.COCOA);
    pb.beginScratch();
    // Small sky-blue butter dish
    pb.sEllipse(cx, cy + 2, 13, 6, P.SKY);
    pb.sEllipse(cx, cy + 1, 11, 5, P.CREAM);
    // 1px stacked golden butter block waiting!
    for (let s = 0; s < 5; s++) {
      pb.sRect(cx - 6, cy - 1 - s, 12, 5, s === 4 ? P.BUTTER : P.HONEY);
    }
    pb.sRect(cx - 5, cy - 4, 6, 1, P.CREAM);
    pb.commitScratch(P.INK);

    // Gentle twinkle glint when pancakes are on the plate waiting for butter!
    if (dish.glint && Math.sin(time * 6) > 0.4) {
      pb.drawPattern(SPARKLE_PAT_SM, cx + 4, cy - 10, SPARK_MAP, false, 1);
    }
  }

  // --- Maple Syrup Pitcher ---
  function drawSyrupPitcher(pb, x, y, tilt, pouring, glint, time) {
    x = Math.round(x);
    y = Math.round(y);

    if (!pouring) {
      pb.ellipse(x, y + 10, 10, 4, P.COCOA);
    }

    pb.beginScratch();
    if (tilt > 0.2) {
      // Tilted pouring pitcher!
      pb.sEllipse(x + 2, y, 8, 7, P.MAPLE);
      pb.sEllipse(x + 1, y - 1, 6, 5, P.GOLDEN);
      pb.sRect(x - 8, y - 3, 6, 4, P.MAPLE); // spout pointing left-down
      pb.sRect(x - 7, y - 2, 4, 2, P.HONEY);
      // Curved handle on right
      pb.sEllipse(x + 10, y - 1, 3, 5, P.GOLDEN);
      pb.sEllipse(x + 10, y - 1, 1, 3, P.INK);
      // Glass highlight
      pb.sRect(x, y - 4, 4, 2, P.CREAM);
    } else {
      // Upright cozy amber maple syrup jug
      pb.sEllipse(x, y + 3, 9, 7, P.MAPLE);
      pb.sEllipse(x - 1, y + 2, 7, 5, P.GOLDEN);
      pb.sRect(x - 4, y - 8, 8, 7, P.MAPLE);
      pb.sRect(x - 3, y - 7, 6, 5, P.GOLDEN);
      // Spout & cap
      pb.sRect(x - 6, y - 8, 3, 3, P.HONEY);
      pb.sRect(x - 4, y - 10, 8, 2, P.CREAM);
      // Side handle
      pb.sRect(x + 7, y - 5, 4, 8, P.MAPLE);
      pb.sRect(x + 8, y - 4, 2, 6, P.GOLDEN);
      // Glossy reflection
      pb.sRect(x - 5, y, 2, 4, P.CREAM);
      pb.spx(x - 2, y - 6, P.CREAM);
    }
    pb.commitScratch(P.INK);

    if (glint && !pouring && Math.sin(time * 5.5 + 1.2) > 0.45) {
      pb.drawPattern(SPARKLE_PAT_SM, x + 5, y - 14, SPARK_MAP, false, 1);
    }
  }

  // --- Strawberry Saucer ---
  function drawBerrySaucer(pb, layout, saucer, time) {
    const cx = Math.round(layout.berries.x + saucer.wobbleX);
    const cy = Math.round(layout.berries.y + saucer.bobY);

    pb.ellipse(cx, cy + 5, 13, 4, P.COCOA);
    pb.beginScratch();
    pb.sEllipse(cx, cy + 2, 13, 5, P.OAT);
    pb.sEllipse(cx, cy + 1, 11, 4, P.CREAM);
    pb.commitScratch(P.INK);

    // 3 plump berries piled on the saucer
    pb.drawPattern(BERRY_PAT, cx - 9, cy - 6, BERRY_MAP, false, 1);
    pb.drawPattern(BERRY_PAT, cx + 1, cy - 6, BERRY_MAP, false, 1);
    pb.drawPattern(BERRY_PAT, cx - 4, cy - 9, BERRY_MAP, false, 1);

    if (saucer.glint && Math.sin(time * 6 + 2.2) > 0.45) {
      pb.drawPattern(SPARKLE_PAT_SM, cx - 1, cy - 15, SPARK_MAP, false, 1);
    }
  }

  // --- Silver Fork (resting beside plate OR carrying a yummy bite to Mama!) ---
  function drawFork(pb, x, y, hasBite, glint, time) {
    x = Math.round(x);
    y = Math.round(y);

    pb.beginScratch();
    // Red cute handle
    pb.sRect(x - 2, y + 4, 4, 11, P.BERRY);
    pb.sRect(x - 1, y + 5, 2, 9, P.PINK);
    // Silver neck & tines
    pb.sRect(x - 1, y - 4, 2, 8, P.SKY);
    pb.sRect(x - 3, y - 6, 7, 3, P.CREAM);
    pb.sRect(x - 3, y - 10, 1, 5, P.CREAM);
    pb.sRect(x, y - 10, 1, 5, P.CREAM);
    pb.sRect(x + 3, y - 10, 1, 5, P.CREAM);
    pb.commitScratch(P.INK);

    // Yummy golden pancake + butter + syrup bite speared on the fork!
    if (hasBite) {
      pb.beginScratch();
      pb.sEllipse(x, y - 9, 6, 4, P.GOLDEN);
      pb.sEllipse(x, y - 10, 5, 3, P.HONEY);
      pb.sRect(x - 2, y - 12, 4, 2, P.BUTTER);
      pb.spx(x + 2, y - 9, P.MAPLE);
      pb.commitScratch(P.INK);
    } else if (glint && Math.sin(time * 6.5) > 0.35) {
      pb.drawPattern(SPARKLE_PAT_SM, x + 2, y - 15, SPARK_MAP, false, 1);
    }
  }

  // --- Dragged Floating Items ---
  function drawDraggedButter(pb, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    pb.beginScratch();
    for (let s = 0; s < 5; s++) {
      pb.sRect(x - 5, y - s, 10, 5, s === 4 ? P.BUTTER : P.HONEY);
    }
    pb.sRect(x - 4, y - 3, 5, 1, P.CREAM);
    pb.commitScratch(P.INK);
  }

  function drawDraggedBerry(pb, x, y) {
    pb.drawPattern(BERRY_PAT, Math.round(x) - 4, Math.round(y) - 5, BERRY_MAP, false, 1);
  }

  // --- Particles (Steam, Hearts, Sparkles, Crumbs, Syrup drops, Blow puffs) ---
  function drawParticles(pb, particles) {
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const x = Math.round(pt.x);
      const y = Math.round(pt.y);
      if (pt.kind === 'heart') {
        pb.drawPattern(HEART_PAT, x - 3, y - 3, HEART_MAP, false, 1);
      } else if (pt.kind === 'spark') {
        pb.drawPattern(pt.big ? SPARKLE_PAT_BIG : SPARKLE_PAT_SM, x - (pt.big ? 3 : 2), y - (pt.big ? 3 : 2), SPARK_MAP, false, 1);
      } else if (pt.kind === 'steam') {
        const r = pt.life > 0.5 ? 2 : 1;
        pb.circle(x, y, r, pt.smoke ? P.SLATE : P.CREAM);
      } else if (pt.kind === 'puff') {
        pb.beginScratch();
        pb.sCircle ? pb.sCircle(x, y, 3, P.CREAM) : pb.sEllipse(x, y, 3, 2, P.CREAM);
        pb.commitScratch(P.SKY);
      } else if (pt.kind === 'drop') {
        pb.rect(x - 1, y - 1, 3, 3, P.INK);
        pb.px(x, y, pt.col);
      } else if (pt.kind === 'crumb') {
        pb.rect(x, y, 2, 2, pt.col);
        pb.px(x + 1, y + 1, P.INK);
      } else if (pt.kind === 'ring') {
        pb.circle(x, y, Math.max(1, Math.round(pt.r)), pt.col);
      }
    }
  }

  // Helper method on PixelBuffer for vertical line in scratch
  if (PP.PixelBuffer && !PP.PixelBuffer.prototype.svline) {
    PP.PixelBuffer.prototype.svline = function (x, y0, y1, c) {
      const a = Math.min(y0 | 0, y1 | 0);
      const b = Math.max(y0 | 0, y1 | 0);
      for (let y = a; y <= b; y++) this.spx(x, y, c);
    };
  }

  PP.Sprites = {
    drawKitchenBackground,
    drawMama,
    drawStove,
    drawFryingPan,
    drawHotcake,
    drawPlateAndStack,
    drawBatterBowl,
    drawLadle,
    drawButterDish,
    drawSyrupPitcher,
    drawBerrySaucer,
    drawFork,
    drawDraggedButter,
    drawDraggedBerry,
    drawParticles,
  };
})(window);
