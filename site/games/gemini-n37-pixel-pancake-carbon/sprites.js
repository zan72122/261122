// Pixel-art sprites & 1px integer sprite-stacking renderers (strict 16 colors)
(function () {
  const CHAR_MAP = {
    '.': -1,
    '0': 0,  // outline
    '1': 1,  // dark iron
    '2': 2,  // iron sheen
    '3': 3,  // dark hair / roast
    '4': 4,  // golden crust / wood
    '5': 5,  // maple amber
    '6': 6,  // gold butter
    '7': 7,  // pale batter / butter
    '8': 8,  // white cream
    '9': 9,  // ceramic shadow
    'a': 10, // peach skin
    'b': 11, // rosy cheek / pink batter
    'c': 12, // strawberry red
    'd': 13, // leaf green
    'e': 14, // flame blue
    'f': 15  // blueberry plum
  };

  const STRAWBERRY_SPRITE = [
    '...dd.dd...',
    '..ddddddd..',
    '.ccccccccc.',
    'cc8ccccc8cc',
    'ccccccccccc',
    '.ccc8ccc8c.',
    '.ccccccccc.',
    '..ccc8ccc..',
    '...ccccc...',
    '....ccc....'
  ];

  const BLUEBERRY_SPRITE = [
    '..ffef..',
    '.ff8fff.',
    'ffffffff',
    'ffffff1f',
    '.ffffff.',
    '..f11f..'
  ];

  const HEART_SPRITE = [
    '.cc.cc.',
    'cc8cccc',
    'ccccccc',
    '.ccccc.',
    '..ccc..',
    '...c...'
  ];

  const STAR_SPRITE = [
    '...8...',
    '..878..',
    '.87878.',
    '..878..',
    '...8...'
  ];

  // Flavor color schemes for batter & pancakes
  // 0: Classic Cream, 1: Strawberry Pink, 2: Blueberry Dot, 3: Honey Souffle
  const FLAVORS = [
    { rawMain: 7, rawHi: 8, rawRim: 5, sponge: 7, spongeHi: 8, cookedMain: 4, cookedMid: 5, cookedHi: 6, dot: -1 },
    { rawMain: 11, rawHi: 8, rawRim: 12, sponge: 11, spongeHi: 11, cookedMain: 12, cookedMid: 11, cookedHi: 8, dot: 12 },
    { rawMain: 7, rawHi: 8, rawRim: 15, sponge: 7, spongeHi: 14, cookedMain: 4, cookedMid: 15, cookedHi: 6, dot: 15 },
    { rawMain: 6, rawHi: 7, rawRim: 5, sponge: 6, spongeHi: 7, cookedMain: 4, cookedMid: 5, cookedHi: 7, dot: -1 }
  ];

  // Step 1: Wall & Window & Shelf (behind Mama!)
  function drawWallAndShelf(pb, layout) {
    const W = pb.w;
    const counterY = layout.counterY;

    // Warm sunlit kitchen tile wall
    pb.fillRect(0, 0, W, counterY, 9);

    const tileW = 22;
    const tileH = 16;
    for (let y = 0; y < counterY; y += tileH) {
      pb.fillRect(0, y, W, 1, 8);
      const offset = ((y / tileH) & 1) * 11;
      for (let x = -offset; x < W; x += tileW) {
        pb.fillRect(x, y, 1, Math.min(tileH, counterY - y), 8);
        if (((x + y) % 66 === 0) && y < counterY - 12) {
          pb.fillRect(x + 3, y + 3, 3, 2, 8);
        }
      }
    }

    // Sunny kitchen window on upper left (landscape)
    if (layout.isLandscape && W >= 230) {
      const wx = 8;
      const wy = 8;
      pb.fillRect(wx, wy, 36, 46, 0);
      pb.fillRect(wx + 1, wy + 1, 34, 44, 7);
      pb.fillRect(wx + 3, wy + 3, 14, 19, 8);
      pb.fillRect(wx + 19, wy + 3, 14, 19, 8);
      pb.fillRect(wx + 3, wy + 24, 14, 19, 8);
      pb.fillRect(wx + 19, wy + 24, 14, 19, 7);
      // Red-and-cream gingham awning
      for (let cx = wx - 2; cx < wx + 38; cx += 6) {
        pb.fillRect(cx, wy - 4, 4, 7, 12);
        pb.fillRect(cx + 4, wy - 4, 2, 7, 8);
      }
      pb.rectOutline(wx - 3, wy - 5, 42, 9, 0);
    }

    // Wooden Topping Shelf on wall
    if (layout.shelf) {
      const s = layout.shelf;
      pb.beginLayer();
      pb.fillRect(s.x, s.y, s.w, 6, 4);
      pb.fillRect(s.x + 1, s.y + 1, s.w - 2, 2, 6);
      pb.fillRect(s.x + 7, s.y + 6, 4, 5, 3);
      pb.fillRect(s.x + s.w - 11, s.y + 6, 4, 5, 3);
      pb.endLayer(0);
    }
  }

  // Step 2: Wooden Kitchen Counter Surface (in front of Mama's waist, behind her hands & props!)
  function drawCounterSurface(pb, layout) {
    const W = pb.w;
    const H = pb.h;
    const counterY = layout.counterY;

    pb.fillRect(0, counterY - 2, W, 2, 0);
    pb.fillRect(0, counterY, W, 5, 6);
    pb.fillRect(0, counterY + 5, W, H - counterY - 5, 5);

    // Warm wood plank lines
    for (let y = counterY + 18; y < H; y += 22) {
      pb.fillRect(0, y, W, 1, 4);
      pb.fillRect(0, y + 1, W, 1, 6);
    }
    for (let x = 26; x < W; x += 58) {
      pb.fillRect(x, counterY + 6, 1, 12, 4);
    }

    // Portrait foreground serving table plank
    if (!layout.isLandscape && layout.tableY) {
      const ty = layout.tableY;
      pb.fillRect(0, ty - 2, W, 2, 0);
      pb.fillRect(0, ty, W, 4, 7);
      pb.fillRect(0, ty + 4, W, H - ty - 4, 4);
      pb.fillRect(0, ty + 5, W, 2, 5);
    }
  }

  // Mama's Upper Body & Expressive Face (drawn behind counter edge!)
  function drawMamaBody(pb, mama, time) {
    const cx = Math.round(mama.x);
    const bob = Math.round(Math.sin(time * 2.4) * 1 + mama.bounceY);
    const baseY = Math.round(mama.y + bob);
    const headY = baseY + 27;
    const expr = mama.expr;

    pb.beginLayer();
    // Soft chestnut hair bob behind shoulders
    pb.fillEllipse(cx, headY + 4, 25, 22, 3);
    pb.fillEllipse(cx + 19, headY + 13, 9, 11, 3);
    pb.fillEllipse(cx - 19, headY + 13, 8, 10, 3);

    // Warm puff-sleeve top (#12 strawberry red with #11 highlight)
    pb.fillRect(cx - 26, baseY + 54, 52, 36, 12);
    pb.fillEllipse(cx, baseY + 56, 29, 14, 12);
    pb.fillEllipse(cx - 24, baseY + 57, 9, 10, 12);
    pb.fillEllipse(cx + 24, baseY + 57, 9, 10, 12);
    pb.fillEllipse(cx - 25, baseY + 54, 4, 4, 11);
    pb.fillEllipse(cx + 23, baseY + 54, 4, 4, 11);

    // Crisp cream ruffled apron
    pb.fillRect(cx - 19, baseY + 49, 38, 42, 8);
    pb.fillRect(cx - 19, baseY + 49, 3, 42, 9);
    pb.fillRect(cx + 16, baseY + 49, 3, 42, 9);
    pb.fillRect(cx - 16, baseY + 42, 6, 10, 8);
    pb.fillRect(cx + 10, baseY + 42, 6, 10, 8);
    pb.drawMap(cx, baseY + 63, HEART_SPRITE, CHAR_MAP);

    // Neck
    pb.fillRect(cx - 6, headY + 15, 12, 10, 11);
    pb.fillRect(cx - 5, headY + 14, 10, 8, 10);

    // Ears
    pb.fillEllipse(cx - 21, headY + 2, 4, 5, 10);
    pb.fillEllipse(cx + 21, headY + 2, 4, 5, 10);
    pb.pset(cx - 21, headY + 2, 11);
    pb.pset(cx + 21, headY + 2, 11);

    // Clean warm peach face oval
    const cheekPuff = expr === 'chew' ? Math.round(Math.abs(Math.sin(time * 11)) * 2) : 0;
    pb.fillEllipse(cx, headY, 21 + cheekPuff, 18, 10);

    // Chestnut Hair Crown & Scalloped Bangs
    pb.fillEllipse(cx, headY - 13, 23, 10, 3);
    pb.fillEllipse(cx - 18, headY - 2, 6, 14, 3);
    pb.fillEllipse(cx + 18, headY - 2, 6, 14, 3);
    // Warm chestnut hair sheen
    pb.fillRect(cx - 12, headY - 16, 10, 2, 4);
    pb.fillRect(cx + 2, headY - 16, 10, 2, 4);
    // Soft bangs framing forehead cleanly
    pb.fillEllipse(cx - 10, headY - 10, 9, 5, 3);
    pb.fillEllipse(cx, headY - 11, 8, 5, 3);
    pb.fillEllipse(cx + 10, headY - 10, 9, 5, 3);

    // Cute Red Hair Ribbon Bow
    pb.fillEllipse(cx - 16, headY - 18, 6, 4, 12);
    pb.fillEllipse(cx - 7, headY - 20, 5, 4, 12);
    pb.fillEllipse(cx - 11, headY - 19, 3, 3, 8);
    pb.pset(cx - 17, headY - 19, 11);

    pb.endLayer(0);

    // --- Expressive Facial Features ---
    const gx = Math.max(-2, Math.min(2, Math.round(mama.gazeX)));
    const gy = Math.max(-2, Math.min(2, Math.round(mama.gazeY)));
    const eyeY = headY + 1;
    const lx = cx - 9;
    const rx = cx + 9;

    const browLift = expr === 'flip' || expr === 'aaan' ? -3 : expr === 'clap' ? -2 : 0;
    pb.line(lx - 3, eyeY - 6 + browLift, lx + 2, eyeY - 7 + browLift, 3);
    pb.line(rx - 2, eyeY - 7 + browLift, rx + 3, eyeY - 6 + browLift, 3);

    const blinking = mama.blink > 0 && expr !== 'flip' && expr !== 'aaan';
    if (blinking || expr === 'clap' || expr === 'chew' || expr === 'giggle') {
      [lx, rx].forEach((ex) => {
        pb.pset(ex - 3, eyeY + 1, 0);
        pb.pset(ex - 2, eyeY - 1, 0);
        pb.fillRect(ex - 1, eyeY - 2, 3, 1, 0);
        pb.pset(ex + 2, eyeY - 1, 0);
        pb.pset(ex + 3, eyeY + 1, 0);
      });
    } else if (expr === 'flip') {
      [lx, rx].forEach((ex) => {
        pb.fillEllipse(ex, eyeY, 4, 4, 0);
        pb.fillRect(ex - 2, eyeY - 2, 2, 2, 8);
        pb.pset(ex + 1, eyeY + 2, 8);
      });
    } else {
      [lx, rx].forEach((ex) => {
        pb.fillRect(ex - 2 + gx, eyeY - 2 + gy, 5, 5, 0);
        pb.pset(ex - 2 + gx, eyeY - 2 + gy, 10);
        pb.pset(ex + 2 + gx, eyeY + 2 + gy, 4);
        pb.fillRect(ex - 1 + gx, eyeY - 1 + gy, 2, 2, 8);
      });
    }

    // Rosy Cheeks
    const blushExtra = expr === 'chew' || expr === 'clap' || expr === 'aaan';
    pb.fillEllipse(lx - 5 - cheekPuff, eyeY + 6, 4, 2, 11);
    pb.fillEllipse(rx + 5 + cheekPuff, eyeY + 6, 4, 2, 11);
    if (blushExtra) {
      pb.pset(lx - 5, eyeY + 6, 12);
      pb.pset(rx + 5, eyeY + 6, 12);
    }

    pb.pset(cx, eyeY + 4, 11);

    // Mouth
    const my = eyeY + 9;
    if (expr === 'aaan') {
      pb.fillEllipse(cx, my + 1, 6, 5, 0);
      pb.fillEllipse(cx, my + 1, 5, 4, 3);
      pb.fillEllipse(cx, my + 3, 4, 2, 12);
    } else if (expr === 'flip') {
      pb.fillEllipse(cx, my + 1, 4, 4, 0);
      pb.fillEllipse(cx, my + 1, 3, 3, 12);
    } else if (expr === 'clap') {
      pb.fillEllipse(cx, my + 1, 5, 4, 0);
      pb.fillEllipse(cx, my + 1, 4, 3, 12);
      pb.fillRect(cx - 5, my - 3, 11, 3, 10);
      pb.fillRect(cx - 5, my - 1, 11, 1, 0);
    } else if (expr === 'watch' || expr === 'bubble') {
      pb.fillEllipse(cx, my + 1, 3, 2, 0);
      pb.pset(cx, my + 1, 12);
    } else if (expr === 'chew') {
      const chewY = Math.round(Math.sin(time * 14));
      pb.pset(cx - 3, my + chewY, 0);
      pb.fillRect(cx - 2, my + 1 + chewY, 2, 1, 0);
      pb.pset(cx, my + chewY, 0);
      pb.fillRect(cx + 1, my + 1 + chewY, 2, 1, 0);
      pb.pset(cx + 3, my + chewY, 0);
    } else {
      pb.pset(cx - 4, my - 1, 0);
      pb.pset(cx - 3, my, 0);
      pb.fillRect(cx - 2, my + 1, 5, 1, 0);
      pb.pset(cx + 3, my, 0);
      pb.pset(cx + 4, my - 1, 0);
    }
  }

  // Mama's Two Pixel Hands (drawn IN FRONT of the counter edge so she rests/claps naturally!)
  function drawMamaHands(pb, mama, layout, time) {
    const cx = Math.round(mama.x);
    const bob = Math.round(Math.sin(time * 2.4) * 1 + mama.bounceY);
    const baseY = Math.round(mama.y + bob);
    const headY = baseY + 27;

    let lx = cx - 25;
    let ly = layout.counterY + 2;
    let rx = cx + 25;
    let ry = layout.counterY + 2;

    if (mama.expr === 'flip') {
      lx = cx - 22;
      ly = headY + 10;
      rx = cx + 22;
      ry = headY + 10;
    } else if (mama.expr === 'clap') {
      const clapGap = 6 + Math.abs(Math.sin(time * 16)) * 8;
      lx = cx - clapGap;
      ly = baseY + 60;
      rx = cx + clapGap;
      ry = baseY + 60;
    } else if (mama.expr === 'bubble') {
      const b = Math.sin(time * 9) * 2;
      lx = cx - 24;
      ly = layout.counterY - 3 + b;
      rx = cx + 24;
      ry = layout.counterY - 3 - b;
    } else if (mama.expr === 'aaan') {
      lx = cx - 24;
      ly = layout.counterY - 2;
      rx = cx + 24;
      ry = layout.counterY - 2;
    } else if (mama.expr === 'chew') {
      lx = cx - 20;
      ly = headY + 12;
      rx = cx + 20;
      ry = headY + 12;
    }

    if (mama.nudgeHand) {
      lx = mama.nudgeHand.x;
      ly = mama.nudgeHand.y;
    }

    [
      { x: lx, y: ly, thumbDir: 1 },
      { x: rx, y: ry, thumbDir: -1 }
    ].forEach((h) => {
      pb.beginLayer();
      pb.fillEllipse(h.x, h.y, 7, 5, 10);
      pb.fillEllipse(h.x + h.thumbDir * 4, h.y - 2, 3, 3, 10);
      pb.pset(h.x + h.thumbDir * 2, h.y + 2, 11);
      pb.endLayer(0);
    });
  }

  // Stove burner + visible gas flames + rotary flame knob on metal bezel
  function drawStoveAndKnob(pb, layout, highFlame, time) {
    const px = layout.panX;
    const py = layout.panY + 3;

    // Wide cast-iron stove grate extending visibly past pan rim!
    pb.beginLayer();
    pb.fillEllipse(px, py + 5, 47, 25, 1);
    pb.fillEllipse(px, py + 5, 39, 20, 3);
    pb.line(px - 49, py + 5, px + 49, py + 5, 1, 3);
    pb.line(px - 32, py - 14, px + 32, py + 24, 1, 3);
    pb.line(px + 32, py - 14, px - 32, py + 24, 1, 3);
    pb.endLayer(0);

    // Lively visible blue-and-gold gas flames around burner rim!
    const count = highFlame ? 16 : 10;
    const radX = highFlame ? 45 : 41;
    const radY = highFlame ? 23 : 21;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + time * (highFlame ? 3.2 : 1.2);
      const fx = px + Math.cos(a) * radX;
      const fy = py + 5 + Math.sin(a) * radY;
      const flick = Math.round(Math.sin(time * 20 + i * 1.9) * (highFlame ? 3 : 1.2));
      const h = (highFlame ? 7 : 4) + Math.max(0, flick);
      pb.beginLayer();
      pb.fillEllipse(fx, fy - h * 0.35, highFlame ? 3 : 2, Math.max(2, h * 0.55), 14);
      if (highFlame) {
        pb.fillEllipse(fx, fy - h * 0.6, 2, 2, 7);
        pb.pset(fx, fy - h, 6);
      } else {
        pb.pset(fx, fy - 2, 8);
      }
      pb.endLayer(0);
    }

    // Brushed Metal Stove Dial Plate + Tactile Red Knob
    const kx = layout.knobX;
    const ky = layout.knobY;
    pb.beginLayer();
    pb.fillEllipse(kx, ky + 1, 14, 11, 9);
    pb.fillEllipse(kx, ky, 13, 10, 8);
    // Small flame icon left, big flame icon right on plate
    pb.fillRect(kx - 11, ky - 3, 2, 3, 14);
    pb.fillRect(kx + 9, ky - 5, 3, 5, highFlame ? 12 : 14);
    pb.pset(kx + 10, ky - 6, highFlame ? 7 : 14);
    // Red rotary dial
    pb.fillEllipse(kx, ky + 2, 9, 7, 1);
    pb.fillEllipse(kx, ky, 8, 6, 12);
    pb.fillEllipse(kx, ky - 1, 6, 4, 11);
    const ang = highFlame ? 0.65 : -0.65;
    pb.line(kx, ky - 1, kx + Math.sin(ang) * 6, ky - 1 - Math.cos(ang) * 5, 8, 2);
    pb.endLayer(0);
  }

  // 1px Sprite-Stacked Cast-Iron Frying Pan
  function drawFryingPan(pb, layout, panState) {
    const cx = Math.round(layout.panX + panState.ox);
    const cy = Math.round(layout.panY + panState.oy);
    const tiltY = Math.round(panState.tilt * 5);

    pb.beginLayer();
    for (let s = 0; s < 5; s++) {
      const sy = cy + 4 - s + Math.round((s - 2) * panState.tilt * 0.6);
      const rx = 40 + s * 1.4;
      const ry = 21 + s * 0.8;
      pb.fillEllipse(cx, sy, rx, ry, s === 4 ? 2 : 1);
    }
    pb.fillEllipse(cx, cy, 38, 19, 1);
    pb.fillEllipse(cx, cy + 1, 36, 17, 0);
    pb.fillEllipse(cx, cy + 1, 35, 16, 1);
    pb.line(cx - 19, cy - 8, cx - 8, cy - 11, 2);
    pb.line(cx - 7, cy - 11, cx + 5, cy - 11, 2);

    // Chunky Wooden Handle pointing forward toward player's thumb
    const hx0 = cx - 4 + Math.round(panState.handleSwing * 4);
    const hy0 = cy + 20;
    const hx1 = cx - 14 + Math.round(panState.handleSwing * 10);
    const hy1 = cy + 39 + tiltY;
    pb.line(cx - 3, cy + 19, hx0, hy0 + 4, 2, 6);
    for (let s = 0; s < 4; s++) {
      const col = s === 3 ? 5 : s === 0 ? 3 : 4;
      pb.line(hx0, hy0 + 3 - s, hx1, hy1 - s, col, s === 3 ? 5 : 8);
    }
    pb.pset(hx1 - 1, hy1 - 2, 0);
    pb.endLayer(0);
  }

  // 1px Integer Sprite-Stacked Hotcake
  function drawStackedPancake(pb, p, time) {
    const fl = FLAVORS[p.flavor || 0];
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const squashX = p.squashX || 1;
    const squashY = p.squashY || 1;
    const rx = Math.max(9, Math.round(p.radius * squashX));
    const baseRy = Math.max(5, Math.round(p.radius * 0.50 * (2 - squashX) * 0.95));

    const ang = p.flipAngle || 0;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const faceRy = Math.max(2, Math.round(baseRy * Math.abs(cosA) + 2.4 * Math.abs(sinA)));

    const numSlices = (p.flavor === 3 ? 10 : 8);
    const half = (numSlices - 1) / 2;
    const sliceStep = Math.max(0.45, 1.05 * squashY);

    pb.beginLayer();

    const order = [];
    for (let i = 0; i < numSlices; i++) {
      const rel = i - half;
      const zY = -rel * cosA * sliceStep;
      const zDepth = rel * cosA;
      order.push({ i, rel, zY, zDepth });
    }
    order.sort((a, b) => a.zDepth - b.zDepth);

    for (let k = 0; k < order.length; k++) {
      const s = order[k];
      const isSideA = s.i === 0;
      const isSideB = s.i === numSlices - 1;
      const taper = (isSideA || isSideB) ? 0.92 : 1.0;
      const srx = Math.max(4, Math.round(rx * taper));
      const sry = Math.max(2, Math.round(faceRy * taper));
      const sy = Math.round(cy + s.zY);
      const sx = Math.round(cx + Math.sin(ang) * s.rel * 0.35);

      let col = fl.sponge;
      if (isSideA) {
        col = p.cookA >= 0.8 ? (p.cookA > 1.75 ? 3 : fl.cookedMain)
            : p.cookA >= 0.42 ? fl.cookedMid
            : fl.rawMain;
      } else if (isSideB) {
        col = p.cookB >= 0.8 ? (p.cookB > 1.75 ? 3 : fl.cookedMain)
            : p.cookB >= 0.42 ? fl.cookedMid
            : fl.rawMain;
      } else if (s.i === 1 || s.i === numSlices - 2) {
        col = fl.spongeHi;
      }

      pb.fillEllipse(sx, sy, srx, sry, col);

      const isVisibleTop = (cosA >= 0 && isSideB) || (cosA < 0 && isSideA);
      if (isVisibleTop && Math.abs(cosA) > 0.28) {
        const cook = cosA >= 0 ? p.cookB : p.cookA;
        if (cook >= 0.42) {
          pb.fillEllipse(sx, sy, Math.max(3, srx - 3), Math.max(2, sry - 2), cook >= 0.8 ? fl.cookedMain : fl.cookedMid);
          pb.ellipseRing(sx, sy, Math.max(2, srx - 4), Math.max(1, sry - 3), fl.cookedHi);
          pb.fillEllipse(sx - srx * 0.25, sy - sry * 0.22, Math.max(2, srx * 0.22), Math.max(1, sry * 0.18), fl.cookedMid);
          if (cook > 1.6) {
            pb.pset(sx - 6, sy - 2, 3);
            pb.pset(sx + 7, sy + 1, 3);
            pb.pset(sx + 1, sy + 3, 3);
          }
        } else {
          // Creamy raw batter sheen
          pb.fillEllipse(sx - srx * 0.22, sy - sry * 0.22, Math.max(3, srx * 0.3), Math.max(2, sry * 0.24), fl.rawHi);
        }

        if (fl.dot >= 0) {
          for (let d = 0; d < 6; d++) {
            const da = d * 1.05 + 0.3;
            const dr = (d % 2 === 0 ? 0.55 : 0.3);
            const dx = sx + Math.cos(da) * srx * dr;
            const dy = sy + Math.sin(da) * sry * dr;
            pb.fillRect(dx, dy, 2, 2, fl.dot);
          }
        }
      }

      if (p.bites > 0) {
        for (let b = 0; b < p.bites; b++) {
          const ba = -0.5 + b * 1.15;
          carveLayerEllipse(pb, sx + Math.cos(ba) * (srx * 0.72), sy + Math.sin(ba) * (sry * 0.72), Math.max(5, srx * 0.38), Math.max(4, sry * 0.42));
        }
      }
    }

    // Plump, super-clear Pukupuku Bubbles on raw top surface!
    if (p.bubbles && p.bubbles.length > 0 && Math.abs(cosA) > 0.5) {
      const topY = Math.round(cy - half * Math.abs(cosA) * sliceStep);
      for (const b of p.bubbles) {
        const bx = Math.round(cx + b.nx * (rx - 6));
        const by = Math.round(topY + b.ny * (faceRy - 4));
        if (b.popping) {
          pb.ellipseRing(bx, by, 4, 3, fl.rawRim);
          pb.fillRect(bx - 1, by - 1, 2, 1, 4);
        } else {
          const br = Math.max(2, Math.round(b.r));
          pb.fillEllipse(bx, by, br + 1, br, fl.rawRim);
          pb.fillEllipse(bx, by, br, Math.max(1, br - 1), fl.rawMain);
          pb.fillRect(bx - 1, by - 1, 2, 1, 8);
        }
      }
    }

    pb.endLayer(0);
  }

  function carveLayerEllipse(pb, cx, cy, rx, ry) {
    if (!pb.inLayer) return;
    const icx = (Math.round(cx) + pb.camX) | 0;
    const icy = (Math.round(cy) + pb.camY) | 0;
    const irx = Math.max(1, Math.round(rx));
    const iry = Math.max(1, Math.round(ry));
    for (let dy = -iry; dy <= iry; dy++) {
      const py = icy + dy;
      if (py < 0 || py >= pb.h) continue;
      const ny = (dy * dy) / (iry * iry);
      if (ny > 1) continue;
      const maxDx = Math.floor(Math.sqrt((1 - ny) * irx * irx));
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        const px = icx + dx;
        if (px >= 0 && px < pb.w) {
          pb.layer[py * pb.w + px] = -1;
        }
      }
    }
  }

  // Spouted Batter Mixing Bowl + Whisk + High Clear Pouring Stream
  function drawBatterPitcher(pb, pitcher, panTarget, time) {
    const fl = FLAVORS[pitcher.flavor || 0];
    const x = Math.round(pitcher.x);
    const y = Math.round(pitcher.y + Math.sin(time * 3.2) * (pitcher.invitePulse ? 1.5 : 0));
    const pouring = pitcher.pouring;

    if (pouring && panTarget) {
      const spoutX = x + 17;
      const spoutY = y + 4;
      pb.beginLayer();
      const wobble = Math.sin(time * 22) * 1.5;
      pb.line(spoutX, spoutY, panTarget.x + wobble, panTarget.y - 4, fl.rawMain, 6);
      pb.line(spoutX - 1, spoutY, panTarget.x - 1 + wobble, panTarget.y - 4, fl.rawHi, 2);
      pb.fillEllipse(panTarget.x + wobble, panTarget.y - 3, 6, 3, fl.rawHi);
      pb.endLayer(0);
    }

    pb.beginLayer();
    if (!pouring) {
      const wx = x - 8 + Math.round(Math.sin(pitcher.whiskAngle) * 5);
      pb.line(wx, y - 10, wx - 5, y - 22, 4, 3);
      pb.line(wx - 1, y - 10, wx - 6, y - 22, 5, 1);

      pb.fillEllipse(x, y + 8, 18, 12, 9);
      pb.fillEllipse(x, y + 4, 20, 13, 8);
      pb.fillRect(x - 18, y + 5, 36, 3, 14);
      pb.fillEllipse(x + 19, y - 3, 5, 4, 8);
      pb.fillEllipse(x, y - 4, 18, 8, 9);
      pb.fillEllipse(x, y - 3, 16, 6, fl.rawMain);
      pb.fillEllipse(x - 5, y - 4, 6, 2, fl.rawHi);
      if (fl.dot >= 0) {
        pb.fillRect(x + 4, y - 4, 2, 2, fl.dot);
        pb.fillRect(x - 3, y - 2, 2, 2, fl.dot);
        pb.pset(x + 8, y - 3, fl.dot);
      }
      if (pitcher.mixFlash > 0) {
        pb.ellipseRing(x, y - 3, 10, 3, 8);
      }
    } else {
      pb.fillEllipse(x - 2, y + 2, 16, 13, 9);
      pb.fillEllipse(x, y, 17, 13, 8);
      pb.line(x - 12, y - 6, x + 8, y + 9, 14, 3);
      pb.fillEllipse(x + 12, y + 1, 8, 10, 9);
      pb.fillEllipse(x + 12, y + 2, 6, 8, fl.rawMain);
      pb.fillEllipse(x + 17, y + 4, 4, 3, fl.rawMain);
    }
    pb.endLayer(0);
  }

  // Serving Plate + Hotcake Stack + Butter + Syrup Cascade + Berries
  function drawPlateAndStack(pb, layout, stack, toppings, activeSyrup, time) {
    const px = layout.plateX;
    const py = layout.plateY;
    const prx = layout.plateRx || 43;
    const pry = Math.round(prx * 0.42);

    pb.beginLayer();
    pb.fillEllipse(px, py + 4, prx - 1, pry, 9);
    pb.fillEllipse(px, py + 1, prx, pry, 8);
    pb.ellipseRing(px, py + 1, prx - 6, Math.max(6, pry - 4), 14);
    pb.fillEllipse(px, py + 2, prx - 11, Math.max(4, pry - 7), 9);
    pb.fillEllipse(px, py + 1, prx - 12, Math.max(4, pry - 8), 8);
    if (toppings.plateSyrup > 0.05) {
      const sr = Math.min(prx - 11, 9 + toppings.plateSyrup * 18);
      pb.fillEllipse(px + 2, py + 2, sr, sr * 0.42, 5);
      pb.fillEllipse(px, py + 1, sr * 0.6, sr * 0.25, 6);
    }
    pb.endLayer(0);

    let topSurfaceY = py - 2;
    let topX = px;
    let topRadius = 26;
    for (let i = 0; i < stack.length; i++) {
      const c = stack[i];
      drawStackedPancake(pb, c, time);
      if (i === stack.length - 1) {
        topSurfaceY = c.y - 4;
        topX = c.x;
        topRadius = Math.max(10, c.radius - c.bites * 2);
      }
    }

    if (stack.length > 0) {
      if (toppings.syrupAmount > 0.02) {
        pb.beginLayer();
        const srad = Math.min(topRadius - 2, 7 + toppings.syrupAmount * (topRadius - 5));
        const sry = Math.max(3, srad * 0.48);
        pb.fillEllipse(topX, topSurfaceY, srad, sry, 5);
        pb.fillEllipse(topX - srad * 0.2, topSurfaceY - 1, Math.max(2, srad * 0.38), Math.max(1, sry * 0.35), 6);
        pb.fillRect(topX - srad * 0.35, topSurfaceY - 2, 2, 1, 8);

        for (const d of toppings.drips) {
          const dx = Math.round(topX + d.nx * (topRadius - 4));
          const dy0 = Math.round(topSurfaceY + d.ny * sry);
          const maxDrop = Math.min(d.len, py + 2 - dy0);
          if (maxDrop > 2) {
            pb.fillRect(dx - 2, dy0, 4, Math.round(maxDrop), 5);
            pb.fillRect(dx - 1, dy0, 1, Math.max(1, Math.round(maxDrop) - 2), 6);
            pb.fillEllipse(dx, dy0 + maxDrop, 3, 2, 5);
            pb.pset(dx - 1, dy0 + maxDrop - 1, 8);
          }
        }
        pb.endLayer(0);
      }

      for (const b of toppings.butters) {
        const bx = topX + b.ox;
        const by = topSurfaceY + b.oy;
        pb.beginLayer();
        if (b.melt > 0.12) {
          const mr = 6 + b.melt * 9;
          pb.fillEllipse(bx, by + 1, mr, mr * 0.48, 6);
          pb.fillEllipse(bx - 1, by, mr * 0.65, mr * 0.32, 7);
        }
        const slices = Math.max(1, Math.round((1 - b.melt * 0.78) * 4));
        const bw = Math.max(5, Math.round(10 - b.melt * 3));
        const bh = Math.max(3, Math.round(6 - b.melt * 2));
        for (let s = 0; s < slices; s++) {
          pb.fillRect(bx - bw / 2, by - bh / 2 - s, bw, bh, s === slices - 1 ? 8 : 7);
        }
        pb.endLayer(0);
      }

      for (const item of toppings.items) {
        const ix = topX + item.ox;
        const iy = topSurfaceY + item.oy - item.hopY;
        pb.beginLayer();
        if (item.kind === 'strawberry') {
          pb.drawMap(ix, iy - 2, STRAWBERRY_SPRITE, CHAR_MAP);
        } else if (item.kind === 'blueberry') {
          pb.drawMap(ix, iy - 1, BLUEBERRY_SPRITE, CHAR_MAP);
        } else {
          pb.fillEllipse(ix, iy + 1, 6, 3, 9);
          pb.fillEllipse(ix, iy - 1, 5, 3, 8);
          pb.fillEllipse(ix, iy - 3, 3, 2, 8);
          pb.pset(ix + 1, iy - 5, 8);
        }
        pb.endLayer(0);
      }
    }

    if (activeSyrup && activeSyrup.pouring) {
      pb.beginLayer();
      const jx = activeSyrup.x;
      const jy = activeSyrup.y;
      const tx = stack.length > 0 ? topX + activeSyrup.aimX : px;
      const ty = stack.length > 0 ? topSurfaceY : py;
      pb.line(jx - 9, jy + 4, tx, ty, 5, 4);
      pb.line(jx - 10, jy + 4, tx - 1, ty, 6, 1);
      pb.fillEllipse(jx, jy, 9, 8, 5);
      pb.fillEllipse(jx - 2, jy - 2, 5, 4, 6);
      pb.fillRect(jx - 10, jy, 6, 4, 4);
      pb.ellipseRing(jx + 8, jy - 3, 3, 4, 4);
      pb.endLayer(0);
    }
  }

  function drawToppingTray(pb, layout, dragKind, activeSyrup, time) {
    if (dragKind !== 'butter') {
      const b = layout.butterPos;
      const wy = b.wiggle ? Math.sin(time * 28) * 1.5 : 0;
      pb.beginLayer();
      pb.fillEllipse(b.x, b.y + 4 + wy, 12, 5, 9);
      pb.fillEllipse(b.x, b.y + 3 + wy, 11, 4, 8);
      for (let s = 0; s < 4; s++) {
        pb.fillRect(b.x - 6, b.y - 2 - s + wy, 12, 6, s === 3 ? 8 : 7);
      }
      pb.fillRect(b.x - 6, b.y + 2 + wy, 12, 2, 6);
      pb.endLayer(0);
    }

    if (dragKind !== 'syrup' && !(activeSyrup && activeSyrup.pouring)) {
      const s = layout.syrupPos;
      const wy = s.wiggle ? Math.sin(time * 28) * 1.5 : 0;
      pb.beginLayer();
      pb.fillEllipse(s.x, s.y + 2 + wy, 9, 9, 4);
      pb.fillEllipse(s.x - 1, s.y + 1 + wy, 8, 8, 5);
      pb.fillEllipse(s.x - 3, s.y - 1 + wy, 3, 4, 6);
      pb.pset(s.x - 3, s.y - 2 + wy, 8);
      pb.fillRect(s.x - 4, s.y - 9 + wy, 8, 5, 6);
      pb.fillRect(s.x - 6, s.y - 10 + wy, 10, 2, 7);
      pb.ellipseRing(s.x + 8, s.y - 2 + wy, 3, 4, 4);
      pb.endLayer(0);
    }

    const br = layout.berryPos;
    const bwy = br.wiggle ? Math.sin(time * 28) * 1.5 : 0;
    pb.beginLayer();
    pb.fillEllipse(br.x, br.y + 4 + bwy, 13, 6, 9);
    pb.fillEllipse(br.x, br.y + 2 + bwy, 13, 5, 8);
    pb.drawMap(br.x - 4, br.y - 3 + bwy, STRAWBERRY_SPRITE, CHAR_MAP);
    pb.drawMap(br.x + 5, br.y - 1 + bwy, BLUEBERRY_SPRITE, CHAR_MAP);
    pb.fillEllipse(br.x + 2, br.y - 5 + bwy, 4, 3, 8);
    pb.endLayer(0);
  }

  // Chunky Wooden-Handled Shiny Fork & Delicious Bite!
  function drawFork(pb, fork, time) {
    if (!fork.visible) return;
    const x = Math.round(fork.x);
    const y = Math.round(fork.y + (fork.dragging ? 0 : Math.sin(time * 4) * 1.2));

    pb.beginLayer();
    if (!fork.hasBite && !fork.dragging) {
      // Wooden handle + shiny 3-tine fork resting beside plate
      pb.line(x - 2, y + 12, x + 2, y + 2, 4, 4);
      pb.line(x - 3, y + 11, x + 1, y + 2, 5, 2);
      pb.line(x + 2, y + 2, x + 5, y - 5, 9, 3);
      pb.fillRect(x + 2, y - 7, 7, 3, 8);
      pb.line(x + 2, y - 7, x + 4, y - 14, 8, 1);
      pb.line(x + 5, y - 7, x + 7, y - 14, 8, 1);
      pb.line(x + 8, y - 7, x + 10, y - 14, 8, 1);
    } else {
      pb.line(x + 15, y + 15, x + 6, y + 6, 4, 4);
      pb.line(x + 6, y + 6, x + 1, y + 1, 8, 3);
      if (fork.hasBite) {
        const fl = FLAVORS[fork.biteFlavor || 0];
        for (let s = 0; s < 5; s++) {
          const col = s === 4 ? fl.cookedMain : s === 0 ? fl.cookedMid : fl.sponge;
          pb.fillEllipse(x - 2, y - 2 - s, 8, 5, col);
        }
        if (fork.withSyrup) {
          pb.fillEllipse(x - 2, y - 7, 6, 3, 5);
          pb.pset(x - 4, y - 8, 8);
        }
        if (fork.withButter) {
          pb.fillRect(x - 3, y - 9, 4, 3, 7);
        }
        if (fork.withBerry) {
          pb.fillEllipse(x + 1, y - 9, 3, 3, 12);
          pb.pset(x + 1, y - 11, 13);
        }
      }
    }
    pb.endLayer(0);
  }

  function drawDraggedProp(pb, drag) {
    if (!drag || !drag.active) return;
    const x = Math.round(drag.x);
    const y = Math.round(drag.y - 8);
    pb.beginLayer();
    if (drag.kind === 'butter') {
      for (let s = 0; s < 4; s++) {
        pb.fillRect(x - 6, y - 3 - s, 12, 7, s === 3 ? 8 : 7);
      }
    } else if (drag.kind === 'strawberry') {
      pb.drawMap(x, y, STRAWBERRY_SPRITE, CHAR_MAP);
    } else if (drag.kind === 'blueberry') {
      pb.drawMap(x, y, BLUEBERRY_SPRITE, CHAR_MAP);
    } else if (drag.kind === 'cream') {
      pb.fillEllipse(x, y + 2, 6, 3, 9);
      pb.fillEllipse(x, y, 5, 3, 8);
      pb.fillEllipse(x, y - 3, 3, 2, 8);
    }
    pb.endLayer(0);
  }

  function drawParticles(pb, particles) {
    for (const pt of particles) {
      if (pt.kind === 'heart') {
        pb.beginLayer();
        pb.drawMap(pt.x, pt.y, HEART_SPRITE, CHAR_MAP);
        pb.endLayer(0);
      } else if (pt.kind === 'star') {
        pb.drawMap(pt.x, pt.y, STAR_SPRITE, CHAR_MAP);
      } else if (pt.kind === 'steam') {
        const r = Math.max(1, Math.round(pt.r));
        pb.fillEllipse(pt.x, pt.y, r, r, pt.life > 0.3 ? 8 : 9);
      } else {
        pb.beginLayer();
        pb.fillEllipse(pt.x, pt.y, pt.r || 1, pt.r || 1, pt.col);
        pb.endLayer(0);
      }
    }
  }

  window.Sprites = {
    drawWallAndShelf,
    drawCounterSurface,
    drawMamaBody,
    drawMamaHands,
    drawStoveAndKnob,
    drawFryingPan,
    drawStackedPancake,
    drawBatterPitcher,
    drawPlateAndStack,
    drawToppingTray,
    drawFork,
    drawDraggedProp,
    drawParticles
  };
})();
