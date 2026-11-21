// Main Game Loop, Physics, Wordless Affordances & One-Finger Touch Controller
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const sound = new window.SoundEngine();
  let pb = new window.PixelBuffer(320, 180);
  let pixelScale = 4;
  let layout = {};

  const state = {
    time: 0,
    idleTime: 0,
    idleNudgeDone: false,
    highFlame: false,
    shakeTime: 0,
    shakeMag: 0,

    mama: {
      x: 120,
      y: 6,
      gazeX: 0,
      gazeY: 1,
      expr: 'idle',
      exprTimer: 0,
      blink: 0,
      nextBlink: 2.6,
      bounceY: 0,
      vy: 0,
      nudgeHand: null
    },

    pitcher: {
      x: 44,
      y: 118,
      baseX: 44,
      baseY: 118,
      flavor: 0, // 0 classic, 1 strawberry, 2 blueberry, 3 honey-butter
      pouring: false,
      pourHoldTime: 0,
      minPourTimer: 0,
      whiskAngle: 0,
      mixFlash: 0,
      invitePulse: true
    },

    pan: {
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      tilt: 0,
      handleSwing: 0,
      pancake: null // active pancake in pan or mid-air above pan
    },

    flyingToPlate: [],
    stack: [],
    stackSwayAngle: 0,
    stackSwayVel: 0,

    toppings: {
      butters: [],
      syrupAmount: 0,
      plateSyrup: 0,
      drips: [],
      items: [],
      berryCycle: 0
    },

    activeSyrup: {
      pouring: false,
      x: 0,
      y: 0,
      aimX: 0,
      timer: 0
    },

    fork: {
      visible: false,
      x: 0,
      y: 0,
      baseX: 0,
      baseY: 0,
      dragging: false,
      hasBite: false,
      biteFlavor: 0,
      withSyrup: false,
      withButter: false,
      withBerry: false
    },

    wiggles: {
      butter: 0,
      syrup: 0,
      berry: 0
    },

    pointer: {
      active: false,
      id: null,
      mode: null, // 'pour', 'pan', 'prop', 'syrup', 'fork', 'whisk', 'stack'
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      startTime: 0,
      moved: false,
      propKind: null
    },

    particles: []
  };

  function computeLayout(overrideVw, overrideVh) {
    const vw = typeof overrideVw === 'number' ? overrideVw : (window.innerWidth || 800);
    const vh = typeof overrideVh === 'number' ? overrideVh : (window.innerHeight || 600);
    const isLandscape = vw >= vh * 0.88;

    if (isLandscape) {
      pixelScale = Math.max(1, Math.min(Math.floor(vw / 240), Math.floor(vh / 175)));
    } else {
      pixelScale = Math.max(1, Math.min(Math.floor(vw / 130), Math.floor(vh / 250)));
    }

    const W = Math.ceil(vw / pixelScale);
    const H = Math.ceil(vh / pixelScale);

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W * pixelScale + 'px';
    canvas.style.height = H * pixelScale + 'px';
    ctx.imageSmoothingEnabled = false;
    pb.resize(W, H);

    if (isLandscape) {
      const counterY = Math.round(H * 0.52);
      const panX = Math.round(W * 0.44);
      const panY = Math.round(counterY + (H - counterY) * 0.42);
      const pitcherX = Math.max(26, Math.round(panX - 68 - (W - 240) * 0.12));
      const pitcherY = panY - 12;
      const plateX = Math.min(W - 46, Math.round(panX + 86 + (W - 240) * 0.16));
      const plateY = panY + 12;
      const shelfW = Math.min(106, Math.max(82, W - (panX + 34) - 6));
      const shelfX = Math.min(W - shelfW - 4, Math.max(panX + 36, plateX - Math.round(shelfW * 0.52)));
      const shelfY = Math.max(46, counterY - 36);

      layout = {
        isLandscape: true,
        W,
        H,
        counterY,
        mamaX: Math.round(panX - 10),
        mamaY: Math.max(2, counterY - 88),
        pitcherX,
        pitcherY,
        knobX: Math.max(18, pitcherX + 8),
        knobY: Math.min(H - 14, panY + 28),
        panX,
        panY,
        plateX,
        plateY,
        plateRx: 43,
        forkX: Math.min(W - 10, plateX + 36),
        forkY: Math.min(H - 12, plateY + 8),
        shelf: { x: shelfX, y: shelfY, w: shelfW },
        butterPos: { x: Math.round(shelfX + shelfW * 0.2), y: shelfY - 5, wiggle: false },
        syrupPos: { x: Math.round(shelfX + shelfW * 0.52), y: shelfY - 9, wiggle: false },
        berryPos: { x: Math.round(shelfX + shelfW * 0.83), y: shelfY - 5, wiggle: false }
      };
    } else {
      // Cozy vertical close-up layout for iPhone / iPad portrait
      const cx = Math.round(W * 0.5);
      const counterY = Math.round(H * 0.33);
      const tableY = Math.round(H * 0.67);
      const panX = Math.round(cx - 8);
      const panY = Math.round(counterY + (tableY - counterY) * 0.44);
      const plateRx = W < 155 ? 35 : 42;
      const plateX = Math.round(W * 0.36);
      const plateY = Math.round(tableY + (H - tableY) * 0.66);
      const trayX = W - 18;
      const tableSpan = H - tableY;

      layout = {
        isLandscape: false,
        W,
        H,
        counterY,
        tableY,
        mamaX: Math.max(30, Math.round(cx - 20)),
        mamaY: Math.max(2, counterY - 88),
        pitcherX: Math.min(W - 22, Math.round(cx + 38)),
        pitcherY: Math.max(46, counterY - 10),
        knobX: Math.min(W - 17, panX + 52),
        knobY: panY + 26,
        panX,
        panY,
        plateX,
        plateY,
        plateRx,
        forkX: Math.min(trayX - 18, plateX + plateRx - 2),
        forkY: plateY + 8,
        shelf: null,
        butterPos: { x: trayX, y: Math.round(tableY + tableSpan * 0.18), wiggle: false },
        syrupPos: { x: trayX, y: Math.round(tableY + tableSpan * 0.50), wiggle: false },
        berryPos: { x: trayX, y: Math.round(tableY + tableSpan * 0.82), wiggle: false }
      };
    }

    // Sync resting anchors
    state.mama.x = layout.mamaX;
    state.mama.y = layout.mamaY;
    state.pitcher.baseX = layout.pitcherX;
    state.pitcher.baseY = layout.pitcherY;
    if (!state.pitcher.pouring) {
      state.pitcher.x = layout.pitcherX;
      state.pitcher.y = layout.pitcherY;
    }
    state.fork.baseX = layout.forkX;
    state.fork.baseY = layout.forkY;
    if (!state.fork.dragging) {
      state.fork.x = layout.forkX;
      state.fork.y = layout.forkY;
    }
    repositionStack(0);
    render();
  }

  function shake(mag = 2, dur = 0.14) {
    state.shakeMag = Math.max(state.shakeMag, mag);
    state.shakeTime = Math.max(state.shakeTime, dur);
  }

  function setMamaExpr(expr, dur = 1.1, bounce = 0) {
    state.mama.expr = expr;
    state.mama.exprTimer = dur;
    if (bounce) state.mama.vy = -bounce;
  }

  function spawnParticle(x, y, vx, vy, col, life = 0.6, kind = 'dot', r = 1.5) {
    if (state.particles.length > 90) state.particles.shift();
    state.particles.push({ x, y, vx, vy, col, life, maxLife: life, kind, r });
  }

  function screenToPixel(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / pixelScale,
      y: (clientY - rect.top) / pixelScale
    };
  }

  function dist(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Begin pouring batter into the warm pan
  function startPouring() {
    if (state.pan.pancake && state.pan.pancake.inAir) return;
    // If a fully cooked pancake is still in pan, plate it first so room opens cleanly!
    if (state.pan.pancake && state.pan.pancake.cookA >= 0.45 && state.pan.pancake.cookB >= 0.45) {
      tossPanPancakeToPlate();
    }
    state.pitcher.pouring = true;
    state.pitcher.minPourTimer = 0.36;
    state.pitcher.x = layout.panX - 30;
    state.pitcher.y = layout.panY - 38;

    if (!state.pan.pancake) {
      state.pan.pancake = {
        x: layout.panX,
        y: layout.panY - 1,
        z: 0,
        vz: 0,
        radius: 13,
        flavor: state.pitcher.flavor,
        cookA: 0, // bottom initially touching pan
        cookB: 0, // top initially raw
        flippedCount: 0,
        flipAngle: 0,
        flipTarget: 0,
        flipSpeed: 0,
        inAir: false,
        squashX: 1,
        squashY: 1,
        bubbles: [],
        bubbleTimer: 0.35,
        bites: 0
      };
      // Sizzle steam puff on contact!
      for (let i = 0; i < 4; i++) {
        spawnParticle(layout.panX + (Math.random() - 0.5) * 14, layout.panY - 4, (Math.random() - 0.5) * 14, -18 - Math.random() * 12, 8, 0.5, 'steam', 2);
      }
    }
    setMamaExpr('watch', 0.8);
  }

  function stopPouring() {
    state.pitcher.pouring = false;
    state.pitcher.pourHoldTime = 0;
    state.pitcher.x = state.pitcher.baseX;
    state.pitcher.y = state.pitcher.baseY;
    sound.stopPour();
  }

  function flipPancakeInPan(power = 1.0) {
    const p = state.pan.pancake;
    if (!p || p.inAir) return;
    stopPouring();

    const pwr = Math.max(0.65, Math.min(1.85, power));
    const readyToTurn = (p.flippedCount % 2 === 0 ? p.cookA : p.cookB) >= 0.38;
    const spins = pwr > 1.45 ? 3 : 1; // 1 = 180 deg flip, 3 = super 540 deg double-flip!

    p.inAir = true;
    p.vz = 155 + pwr * 85;
    p.bubbles = [];
    if (readyToTurn) {
      p.flippedCount += 1;
      p.flipTarget = p.flippedCount * Math.PI + (spins === 3 ? Math.PI * 2 : 0);
    } else {
      // Early hop: cute low bounce & batter wiggle without penalty!
      p.vz = 95;
      p.flipTarget = p.flipAngle + Math.PI * 2;
    }

    const airDur = (2 * p.vz) / 460;
    p.flipSpeed = (p.flipTarget - p.flipAngle) / Math.max(0.2, airDur);

    state.pan.vy = -52 * pwr;
    state.pan.tilt = -0.35;
    shake(pwr > 1.3 ? 2 : 1, 0.1);
    sound.flipLaunch(pwr);
    setMamaExpr('flip', airDur + 0.25, 18);

    // Sparkles on high super-flip!
    if (pwr > 1.25) {
      for (let i = 0; i < 5; i++) {
        spawnParticle(p.x + (Math.random() - 0.5) * 28, p.y - 12, (Math.random() - 0.5) * 35, -35 - Math.random() * 25, 7, 0.55, 'star', 2);
      }
    }
  }

  function tossPanPancakeToPlate() {
    const p = state.pan.pancake;
    if (!p || p.inAir) return;
    stopPouring();
    state.pan.pancake = null;
    state.pan.vx = 28;
    state.pan.vy = -30;
    state.pan.tilt = 0.28;
    sound.flipLaunch(0.8);

    const targetIdx = state.stack.length;
    const targetY = layout.plateY - 3 - targetIdx * 7;
    state.flyingToPlate.push({
      pancake: p,
      startX: p.x,
      startY: p.y,
      targetX: layout.plateX + (Math.random() - 0.5) * 4,
      targetY,
      t: 0,
      dur: 0.42
    });
    // Reset flavor back to classic ONLY after pouring? Keep mixed flavor for 1 pancake then gentle return, or keep until new mix?
    // Resetting after plating lets the child discover mixing fresh flavors each pancake!
    state.pitcher.flavor = 0;
  }

  function repositionStack(dt) {
    if (!layout.plateX) return;
    const n = state.stack.length;
    if (n === 0) {
      state.fork.visible = false;
      return;
    }
    state.fork.visible = true;

    // Gentle spring sway when stack gets tall!
    const stiffness = Math.max(14, 42 - n * 4);
    state.stackSwayVel += (-state.stackSwayAngle * stiffness) * dt;
    state.stackSwayVel *= Math.pow(0.08, dt);
    state.stackSwayAngle += state.stackSwayVel * dt;

    for (let i = 0; i < n; i++) {
      const c = state.stack[i];
      const hFrac = (i + 1) / Math.max(1, n);
      const swayX = Math.sin(state.stackSwayAngle) * i * 3.2 * hFrac;
      const thick = c.flavor === 3 ? 11.0 : 9.2;
      c.x = layout.plateX + c.offsetX + swayX;
      c.y = layout.plateY - 3 - i * thick;
      c.squashX += (1 - c.squashX) * Math.min(1, dt * 14);
      c.squashY += (1 - c.squashY) * Math.min(1, dt * 14);
    }
  }

  function addButterToStack(ox = 0, oy = 0) {
    if (state.stack.length === 0) return false;
    state.toppings.butters.push({
      ox: Math.max(-10, Math.min(10, ox)),
      oy: Math.max(-5, Math.min(5, oy)),
      melt: 0
    });
    sound.butterDrop();
    setMamaExpr('clap', 0.9, 10);
    return true;
  }

  function addBerryToStack(kind, ox = 0, oy = 0) {
    if (state.stack.length === 0) return false;
    state.toppings.items.push({
      kind,
      ox: Math.max(-15, Math.min(15, ox)),
      oy: Math.max(-7, Math.min(7, oy)),
      hopY: 10,
      vy: 0
    });
    sound.berryPop(kind === 'blueberry');
    setMamaExpr('watch', 0.7);
    return true;
  }

  function mixFlavorIntoBatter(flavor) {
    state.pitcher.flavor = flavor;
    state.pitcher.mixFlash = 0.7;
    state.pitcher.whiskAngle += 2.6;
    sound.mixSplash(flavor);
    setMamaExpr('clap', 1.1, 14);
    const col = flavor === 1 ? 12 : flavor === 2 ? 15 : 6;
    for (let i = 0; i < 8; i++) {
      spawnParticle(
        state.pitcher.x + (Math.random() - 0.5) * 20,
        state.pitcher.y - 6,
        (Math.random() - 0.5) * 40,
        -25 - Math.random() * 30,
        col,
        0.55,
        i % 2 === 0 ? 'star' : 'dot',
        2
      );
    }
  }

  function takeBiteOntoFork() {
    if (state.stack.length === 0) return false;
    const top = state.stack[state.stack.length - 1];
    top.bites = (top.bites || 0) + 1;
    top.squashX = 1.14;
    top.squashY = 0.82;

    state.fork.hasBite = true;
    state.fork.biteFlavor = top.flavor || 0;
    state.fork.withSyrup = state.toppings.syrupAmount > 0.12;
    state.fork.withButter = state.toppings.butters.length > 0;
    state.fork.withBerry = state.toppings.items.length > 0;

    if (top.bites >= 3) {
      state.stack.pop();
      if (state.toppings.items.length > 0) state.toppings.items.pop();
      if (state.stack.length === 0) {
        state.toppings.butters = [];
        state.toppings.syrupAmount = 0;
        state.toppings.plateSyrup = 0;
        state.toppings.drips = [];
        state.toppings.items = [];
      }
    }
    sound.forkCut();
    return true;
  }

  function feedMamaBite() {
    if (!state.fork.hasBite) return;
    const deluxe = (state.fork.withSyrup && state.fork.withButter) || state.fork.withBerry || state.fork.biteFlavor > 0;
    state.fork.hasBite = false;
    state.fork.dragging = false;
    state.fork.x = state.fork.baseX;
    state.fork.y = state.fork.baseY;

    sound.mamaBite(deluxe);
    setMamaExpr('chew', deluxe ? 2.1 : 1.5, deluxe ? 24 : 14);
    shake(1, 0.08);

    const heartCount = deluxe ? 6 : 4;
    for (let i = 0; i < heartCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      spawnParticle(
        state.mama.x + side * (24 + (i * 5) % 14),
        state.mama.y + 28 + (i % 3) * 8,
        side * (4 + Math.random() * 8),
        -12 - Math.random() * 10,
        12,
        1.1,
        i % 3 === 2 ? 'star' : 'heart',
        2
      );
    }
  }

  // --- Pointer / One-Finger Touch Handling ---
  function onPointerDown(e) {
    e.preventDefault();
    sound.unlock();
    if (state.pointer.active) return; // Ignore secondary multi-touch fingers safely!

    const p = screenToPixel(e.clientX, e.clientY);
    state.pointer.active = true;
    state.pointer.id = e.pointerId;
    state.pointer.startX = p.x;
    state.pointer.startY = p.y;
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    state.pointer.startTime = state.time;
    state.pointer.moved = false;
    state.idleTime = 0;
    state.mama.nudgeHand = null;

    // 1. Stove Flame Knob
    if (dist(p.x, p.y, layout.knobX, layout.knobY) < 18) {
      state.highFlame = !state.highFlame;
      sound.flameKnob(state.highFlame);
      setMamaExpr('watch', 0.6);
      state.pointer.mode = 'done';
      return;
    }

    // 2. Fork (if stack exists or fork already holding a bite!)
    if ((state.fork.visible || state.fork.hasBite) && dist(p.x, p.y, state.fork.x, state.fork.y) < 22) {
      if (!state.fork.hasBite && state.stack.length > 0) {
        takeBiteOntoFork();
      }
      state.fork.dragging = true;
      state.fork.x = p.x;
      state.fork.y = p.y;
      state.pointer.mode = 'fork';
      setMamaExpr('aaan', 2.0);
      return;
    }

    // 3. Topping Shelf Props (Butter, Syrup, Berries — can drag onto Stack OR into Batter Bowl!)
    if (dist(p.x, p.y, layout.butterPos.x, layout.butterPos.y) < 17) {
      state.pointer.mode = 'prop';
      state.pointer.propKind = 'butter';
      sound.wiggle(520);
      return;
    }
    if (dist(p.x, p.y, layout.syrupPos.x, layout.syrupPos.y) < 17) {
      if (state.stack.length > 0) {
        state.pointer.mode = 'syrup';
        state.activeSyrup.pouring = true;
        state.activeSyrup.x = layout.plateX + 18;
        state.activeSyrup.y = state.stack[state.stack.length - 1].y - 22;
        state.activeSyrup.aimX = 0;
        sound.syrupDrip();
        setMamaExpr('watch', 1.0);
      } else {
        state.pointer.mode = 'prop';
        state.pointer.propKind = 'honey';
        state.wiggles.syrup = 0.35;
        sound.wiggle(460);
      }
      return;
    }
    if (dist(p.x, p.y, layout.berryPos.x, layout.berryPos.y) < 18) {
      const kinds = ['strawberry', 'blueberry', 'cream'];
      const kind = kinds[state.toppings.berryCycle % kinds.length];
      state.toppings.berryCycle++;
      state.pointer.mode = 'prop';
      state.pointer.propKind = kind;
      sound.berryPop(kind === 'blueberry');
      return;
    }

    // 4. Batter Bowl / Pitcher
    if (dist(p.x, p.y, state.pitcher.x, state.pitcher.y) < 26) {
      state.pointer.mode = 'pour';
      state.pitcher.invitePulse = false;
      startPouring();
      return;
    }

    // 5. Frying Pan & Handle (generous touch area including handle!)
    const inPan = dist(p.x, p.y, layout.panX, layout.panY + 6) < 44 ||
                  dist(p.x, p.y, layout.panX - 10, layout.panY + 32) < 24;
    if (inPan) {
      state.pointer.mode = 'pan';
      if (!state.pan.pancake) {
        state.pan.vy = -22;
        state.pan.handleSwing = (Math.random() - 0.5) * 0.5;
        sound.panClink();
        // Mama glances at the batter bowl as a natural cue!
        state.mama.gazeX = layout.pitcherX < layout.mamaX ? -2 : 2;
        state.mama.gazeY = 2;
      } else {
        state.pan.oy = 2;
      }
      return;
    }

    // 6. Serving Plate & Pancake Stack
    const topY = state.stack.length > 0 ? state.stack[state.stack.length - 1].y : layout.plateY;
    if (dist(p.x, p.y, layout.plateX, (layout.plateY + topY) * 0.5) < 38 ||
        (state.stack.length > 0 && p.x > layout.plateX - 30 && p.x < layout.plateX + 30 && p.y >= topY - 14 && p.y <= layout.plateY + 18)) {
      // If a cooked pancake is waiting in the pan, tapping the plate tosses it onto the plate!
      const pc = state.pan.pancake;
      if (pc && !pc.inAir && (pc.cookA >= 0.42 || pc.cookB >= 0.42)) {
        tossPanPancakeToPlate();
        state.pointer.mode = 'done';
        return;
      }
      // Otherwise interact with the stack (squish/wobble or pick up a bite on fork!)
      if (state.stack.length > 0) {
        state.pointer.mode = 'stack';
        state.stackSwayVel += (p.x < layout.plateX ? 4.5 : -4.5);
        state.stack[state.stack.length - 1].squashX = 1.16;
        state.stack[state.stack.length - 1].squashY = 0.8;
        sound.towerWobble();
        return;
      } else {
        sound.wiggle(620);
        state.pointer.mode = 'done';
        return;
      }
    }

    // 7. Tapping Mama! She giggles and waves warmly!
    if (dist(p.x, p.y, state.mama.x, state.mama.y + 38) < 36) {
      if (state.fork.hasBite) {
        feedMamaBite();
      } else {
        setMamaExpr('clap', 0.9, 12);
        sound.wiggle(660);
      }
      state.pointer.mode = 'done';
    }
  }

  function onPointerMove(e) {
    if (!state.pointer.active || e.pointerId !== state.pointer.id) return;
    e.preventDefault();
    const p = screenToPixel(e.clientX, e.clientY);
    const dx = p.x - state.pointer.startX;
    const dy = p.y - state.pointer.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) state.pointer.moved = true;
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    state.idleTime = 0;

    if (state.pointer.mode === 'pan') {
      state.pan.ox = Math.max(-10, Math.min(10, dx * 0.25));
      state.pan.oy = Math.max(-8, Math.min(10, dy * 0.28));
      state.pan.handleSwing = Math.max(-0.8, Math.min(0.8, dx * 0.03));

      // Instant upward flick flips the pancake right away (<100ms response!)
      if (state.pan.pancake && !state.pan.pancake.inAir && dy < -14) {
        const speed = Math.min(1.85, Math.abs(dy) / 26);
        flipPancakeInPan(speed);
        state.pointer.mode = 'done';
      } else if (state.pan.pancake && !state.pan.pancake.inAir) {
        // Sideways drag toward plate when cooked -> toss onto plate!
        const toPlate = (layout.plateX - layout.panX) * dx + (layout.plateY - layout.panY) * dy;
        if (toPlate > 900 && (state.pan.pancake.cookA >= 0.42 || state.pan.pancake.cookB >= 0.42)) {
          tossPanPancakeToPlate();
          state.pointer.mode = 'done';
        }
      }
    } else if (state.pointer.mode === 'syrup') {
      state.activeSyrup.aimX = Math.max(-14, Math.min(14, p.x - layout.plateX));
      state.activeSyrup.x = layout.plateX + state.activeSyrup.aimX + 16;
    } else if (state.pointer.mode === 'fork') {
      state.fork.x = p.x;
      state.fork.y = p.y;
      if (dist(p.x, p.y, state.mama.x, state.mama.y + 34) < 28) {
        feedMamaBite();
        state.pointer.mode = 'done';
      } else {
        setMamaExpr('aaan', 0.5);
      }
    } else if (state.pointer.mode === 'pour') {
      // If swirling inside resting batter bowl without pouring? Pouring already active; allow dragging away to stop
      if (dist(p.x, p.y, layout.panX, layout.panY) > 95 && state.pitcher.minPourTimer <= 0) {
        stopPouring();
      }
    } else if (state.pointer.mode === 'stack' && state.stack.length > 0) {
      // Dragging from stack pulls out a forkful toward Mama!
      if (dist(p.x, p.y, state.pointer.startX, state.pointer.startY) > 16) {
        if (!state.fork.hasBite) takeBiteOntoFork();
        state.fork.dragging = true;
        state.fork.x = p.x;
        state.fork.y = p.y;
        state.pointer.mode = 'fork';
        setMamaExpr('aaan', 1.5);
      }
    }
  }

  function onPointerUp(e) {
    if (!state.pointer.active || e.pointerId !== state.pointer.id) return;
    e.preventDefault();
    const p = screenToPixel(e.clientX, e.clientY);
    const dy = p.y - state.pointer.startY;
    const mode = state.pointer.mode;

    if (mode === 'pour') {
      if (state.pitcher.minPourTimer <= 0) {
        stopPouring();
      }
      // Otherwise minPourTimer finishes a clean dollop automatically in update()!
    } else if (mode === 'pan') {
      const pc = state.pan.pancake;
      state.pan.ox = 0;
      state.pan.oy = 0;
      state.pan.handleSwing = 0;
      if (pc && !pc.inAir) {
        // Pull-down & release = super spring flip!
        if (dy > 10) {
          flipPancakeInPan(Math.min(1.85, 1.15 + dy / 28));
        } else if (pc.cookA >= 0.45 && pc.cookB >= 0.45 && !state.pointer.moved) {
          // Both sides golden & simple tap -> toss right onto serving plate!
          tossPanPancakeToPlate();
        } else {
          flipPancakeInPan(1.0);
        }
      }
    } else if (mode === 'prop') {
      const kind = state.pointer.propKind;
      // Dropped into Batter Bowl -> Mix fruit/honey batter!!
      if (dist(p.x, p.y, state.pitcher.x, state.pitcher.y) < 28 && !state.pitcher.pouring) {
        const fl = kind === 'strawberry' ? 1 : kind === 'blueberry' ? 2 : 3;
        mixFlavorIntoBatter(fl);
      } else if (state.stack.length > 0) {
        const top = state.stack[state.stack.length - 1];
        const nearStack = !state.pointer.moved || dist(p.x, p.y, top.x, top.y) < 42;
        if (nearStack) {
          const ox = state.pointer.moved ? p.x - top.x : (Math.random() - 0.5) * 12;
          const oy = state.pointer.moved ? p.y - top.y : (Math.random() - 0.5) * 6;
          if (kind === 'butter') addButterToStack(ox, oy);
          else if (kind !== 'honey') addBerryToStack(kind, ox, oy);
        } else {
          state.wiggles.butter = 0.3;
        }
      } else {
        // Wiggle shelf prop gently if no pancake on plate yet
        if (kind === 'butter') state.wiggles.butter = 0.35;
        else state.wiggles.berry = 0.35;
        sound.wiggle(520);
      }
    } else if (mode === 'syrup') {
      state.activeSyrup.pouring = false;
    } else if (mode === 'fork') {
      if (dist(p.x, p.y, state.mama.x, state.mama.y + 34) < 34) {
        feedMamaBite();
      } else if (!state.pointer.moved && state.fork.hasBite) {
        // Quick tap on fork = take a yummy bite right away + Mama smiles!
        feedMamaBite();
      } else {
        state.fork.dragging = false;
        state.fork.x = state.fork.baseX;
        state.fork.y = state.fork.baseY;
      }
    } else if (mode === 'stack' && !state.pointer.moved && state.stack.length > 0) {
      // Quick poke on stack: if 5+ tall, big funny wobble; if already topped, cut a bite onto fork!
      if (state.stack.length >= 5 && Math.abs(state.stackSwayVel) > 3.5) {
        toppleTopPancakeToPan();
      } else if (state.toppings.syrupAmount > 0.1 || state.toppings.butters.length > 0 || state.toppings.items.length > 0) {
        if (!state.fork.hasBite) takeBiteOntoFork();
      }
    }

    state.pointer.active = false;
    state.pointer.id = null;
    state.pointer.mode = null;
  }

  // Playful safe topple when stacking super tall (never punishing — bounces into pan or Mama's delight!)
  function toppleTopPancakeToPan() {
    if (state.stack.length < 4 || state.pan.pancake) return;
    const top = state.stack.pop();
    top.inAir = false;
    top.x = layout.panX;
    top.y = layout.panY - 1;
    top.squashX = 1.24;
    top.squashY = 0.72;
    state.pan.pancake = top;
    sound.pancakeLand(true, 1);
    setMamaExpr('flip', 0.7, 14);
    shake(2, 0.12);
  }

  // --- Physics & Simulation Step ---
  function update(dt) {
    state.time += dt;
    state.idleTime += dt;

    // Screen shake decay
    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      const sx = (Math.random() * 2 - 1) * state.shakeMag;
      const sy = (Math.random() * 2 - 1) * state.shakeMag;
      pb.setShake(sx, sy);
    } else {
      state.shakeMag = 0;
      pb.setShake(0, 0);
    }

    // Wiggle timers on non-stage props
    for (const k of ['butter', 'syrup', 'berry']) {
      if (state.wiggles[k] > 0) state.wiggles[k] = Math.max(0, state.wiggles[k] - dt);
    }
    if (layout.butterPos) layout.butterPos.wiggle = state.wiggles.butter > 0;
    if (layout.syrupPos) layout.syrupPos.wiggle = state.wiggles.syrup > 0;
    if (layout.berryPos) layout.berryPos.wiggle = state.wiggles.berry > 0;

    // Mama blink & spring bounce
    state.mama.nextBlink -= dt;
    if (state.mama.nextBlink <= 0) {
      state.mama.blink = 0.13;
      state.mama.nextBlink = 2.4 + Math.random() * 2.5;
    }
    if (state.mama.blink > 0) state.mama.blink -= dt;

    state.mama.vy += (-state.mama.bounceY * 140) * dt;
    state.mama.vy *= Math.pow(0.02, dt);
    state.mama.bounceY += state.mama.vy * dt;

    if (state.mama.exprTimer > 0) {
      state.mama.exprTimer -= dt;
      if (state.mama.exprTimer <= 0) state.mama.expr = 'idle';
    }

    // 10s gentle one-time hand demonstration if player hasn't touched anything
    if (!state.idleNudgeDone && state.idleTime > 9.5 && state.idleTime < 11.3 && !state.pan.pancake && state.stack.length === 0) {
      const u = (state.idleTime - 9.5) / 1.8;
      const reach = Math.sin(u * Math.PI);
      state.mama.nudgeHand = {
        x: state.mama.x - 22 + (state.pitcher.x - (state.mama.x - 22)) * reach,
        y: state.mama.y + 68 + (state.pitcher.y - (state.mama.y + 68)) * reach
      };
      if (u > 0.42 && u < 0.65) {
        state.pitcher.x = state.pitcher.baseX + Math.sin((u - 0.42) * 30) * 2;
      }
      if (u >= 0.98) {
        state.idleNudgeDone = true;
        state.mama.nudgeHand = null;
        state.pitcher.x = state.pitcher.baseX;
      }
    } else if (state.idleTime >= 11.3) {
      state.idleNudgeDone = true;
      state.mama.nudgeHand = null;
    }

    // Batter pouring update
    if (state.pitcher.mixFlash > 0) state.pitcher.mixFlash -= dt;
    if (state.pitcher.pouring && state.pan.pancake) {
      if (state.pitcher.minPourTimer > 0) state.pitcher.minPourTimer -= dt;
      state.pitcher.pourHoldTime += dt;
      const p = state.pan.pancake;
      const maxR = 34;
      if (p.radius < maxR) {
        p.radius = Math.min(maxR, p.radius + dt * 14.5);
        p.squashX = 1.04 + Math.sin(state.time * 24) * 0.03;
        sound.startPour((p.radius - 13) / (maxR - 13));
      } else {
        // Full pan! Plump wobble!
        p.squashX = 1.05 + Math.sin(state.time * 28) * 0.05;
        sound.startPour(1.0);
      }
      if (!state.pointer.active && state.pitcher.minPourTimer <= 0) {
        stopPouring();
      }
    }

    // Pan spring physics
    if (state.pointer.mode !== 'pan') {
      state.pan.vy += (-state.pan.oy * 180) * dt;
      state.pan.vy *= Math.pow(0.015, dt);
      state.pan.oy += state.pan.vy * dt;
      state.pan.vx += (-state.pan.ox * 180) * dt;
      state.pan.vx *= Math.pow(0.015, dt);
      state.pan.ox += state.pan.vx * dt;
      state.pan.tilt *= Math.pow(0.02, dt);
    }

    // Active Pancake in Pan (Cooking, Bubbles, Mid-Air Flip, Landing Squash!)
    const pc = state.pan.pancake;
    if (pc) {
      pc.squashX += (1 - pc.squashX) * Math.min(1, dt * 14);
      pc.squashY += (1 - pc.squashY) * Math.min(1, dt * 14);

      if (pc.inAir) {
        const prevSpin = Math.floor(pc.flipAngle / Math.PI);
        pc.z += pc.vz * dt;
        pc.vz -= 460 * dt;
        pc.flipAngle = Math.min(pc.flipTarget, pc.flipAngle + pc.flipSpeed * dt);
        if (Math.floor(pc.flipAngle / Math.PI) > prevSpin) {
          sound.spinTick();
        }
        pc.x = layout.panX + state.pan.ox * 0.4;
        pc.y = layout.panY - 1 - pc.z;

        // Mama tracks flying pancake with wide eyes!
        state.mama.gazeX = (pc.x - state.mama.x) * 0.05;
        state.mama.gazeY = Math.max(-2, (pc.y - (state.mama.y + 28)) * 0.05);

        if (pc.z <= 0 && pc.vz < 0) {
          pc.z = 0;
          pc.vz = 0;
          pc.inAir = false;
          pc.flipAngle = (pc.flippedCount % 2) * Math.PI;
          pc.squashX = 1.28;
          pc.squashY = 0.62;
          state.pan.vy = 45;
          const upCook = pc.flippedCount % 2 === 1 ? pc.cookA : pc.cookB;
          const isGolden = upCook >= 0.45;
          shake(pc.radius > 24 ? 3 : 2, 0.14);
          sound.pancakeLand(isGolden, pc.radius / 22);
          setMamaExpr(isGolden ? 'clap' : 'watch', isGolden ? 1.2 : 0.6, isGolden ? 16 : 6);

          // Steam & golden crumbs burst!
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            spawnParticle(
              layout.panX + Math.cos(a) * pc.radius * 0.7,
              layout.panY - 2,
              Math.cos(a) * 28,
              -12 - Math.random() * 16,
              isGolden ? 7 : 8,
              0.45,
              isGolden && i % 2 === 0 ? 'star' : 'steam',
              2
            );
          }
        }
      } else {
        pc.x = layout.panX + state.pan.ox;
        pc.y = layout.panY - 1 + state.pan.oy;

        // Heat cooks whichever side is currently down on the cast-iron pan!
        if (!state.pitcher.pouring) {
          const heatRate = state.highFlame ? 0.85 : 0.48;
          if (pc.flippedCount % 2 === 0) {
            pc.cookA = Math.min(2.1, pc.cookA + dt * heatRate);
          } else {
            pc.cookB = Math.min(2.1, pc.cookB + dt * heatRate * 1.15);
          }

          // Pukupuku bubbles when bottom is golden and top is still raw!
          const downCook = pc.flippedCount % 2 === 0 ? pc.cookA : pc.cookB;
          const upCook = pc.flippedCount % 2 === 0 ? pc.cookB : pc.cookA;
          if (downCook >= 0.34 && upCook < 0.35) {
            if (state.mama.expr === 'idle') setMamaExpr('bubble', 0.4);
            pc.bubbleTimer -= dt * (state.highFlame ? 2.1 : 1.35);
            if (pc.bubbleTimer <= 0 && pc.bubbles.length < 9) {
              pc.bubbleTimer = 0.11 + Math.random() * 0.11;
              const a = (pc.bubbles.length * 2.399) + 0.4;
              const r = 0.18 + ((pc.bubbles.length * 0.29) % 0.62);
              pc.bubbles.push({
                nx: Math.cos(a) * r,
                ny: Math.sin(a) * r,
                r: 1.3,
                age: 0,
                popping: false
              });
            }
          }

          for (let i = pc.bubbles.length - 1; i >= 0; i--) {
            const b = pc.bubbles[i];
            b.age += dt;
            b.r = Math.min(3.1, 1.1 + b.age * 2.8);
            if (!b.popping && b.age > 0.62) {
              b.popping = true;
              sound.bubblePop(i + Math.floor(state.time * 3));
              spawnParticle(pc.x + b.nx * (pc.radius - 5), pc.y - 4, 0, -14, 8, 0.35, 'steam', 1.5);
            }
            if (b.age > 0.85) pc.bubbles.splice(i, 1);
          }

          // Cozy rising steam once both sides are golden!
          if (pc.cookA >= 0.5 && pc.cookB >= 0.5 && Math.random() < dt * 4.5) {
            spawnParticle(
              pc.x + (Math.random() - 0.5) * pc.radius,
              pc.y - 6,
              (Math.random() - 0.5) * 8,
              -18 - Math.random() * 10,
              8,
              0.55,
              Math.random() < 0.25 ? 'star' : 'steam',
              2
            );
          }
        }
      }
    }

    // Arcing hotcakes flying from pan onto serving plate stack!
    for (let i = state.flyingToPlate.length - 1; i >= 0; i--) {
      const f = state.flyingToPlate[i];
      f.t += dt / f.dur;
      const u = Math.min(1, f.t);
      const p = f.pancake;
      const targetIdx = state.stack.length;
      const ty = layout.plateY - 3 - targetIdx * (p.flavor === 3 ? 11.0 : 9.2);
      p.x = f.startX + (f.targetX - f.startX) * u;
      p.y = f.startY + (ty - f.startY) * u - Math.sin(u * Math.PI) * 42;
      p.flipAngle = (p.flippedCount % 2 === 1 ? Math.PI : 0);

      if (u >= 1) {
        state.flyingToPlate.splice(i, 1);
        p.offsetX = (Math.random() - 0.5) * 4;
        p.squashX = 1.24;
        p.squashY = 0.68;
        p.bubbles = [];
        // Ensure golden side faces up on plate!
        if (p.cookA > p.cookB) p.flipAngle = Math.PI;
        else p.flipAngle = 0;
        state.stack.push(p);
        state.stackSwayVel += (Math.random() - 0.5) * (1.5 + state.stack.length * 0.7);
        sound.stackLand(state.stack.length);
        shake(1.5, 0.1);
        setMamaExpr('clap', 1.2, 16);
      }
    }

    // Update stack positions & toppings physics
    repositionStack(dt);

    // Melting butter on warm stack
    const meltSpeed = state.highFlame ? 0.28 : 0.18;
    for (const b of state.toppings.butters) {
      if (b.melt < 1) b.melt = Math.min(1, b.melt + dt * meltSpeed);
    }

    // Pouring Maple Syrup & organic asymmetric cascading drips!
    if (state.activeSyrup.pouring && state.stack.length > 0) {
      state.toppings.syrupAmount = Math.min(1.3, state.toppings.syrupAmount + dt * 0.58);
      const dripSpecs = [
        { nx: -0.58, scale: 0.96 },
        { nx: 0.08, scale: 0.62 },
        { nx: 0.56, scale: 0.82 }
      ];
      if (state.toppings.syrupAmount > 0.30 && state.toppings.drips.length < dripSpecs.length && Math.random() < dt * 9) {
        const spec = dripSpecs[state.toppings.drips.length];
        state.toppings.drips.push({
          nx: spec.nx,
          ny: Math.sqrt(Math.max(0.15, 1 - spec.nx * spec.nx)) * 0.86,
          len: 2,
          scale: spec.scale,
          speed: 16 + Math.random() * 8
        });
      }
      if (state.toppings.syrupAmount > 0.85) {
        state.toppings.plateSyrup = Math.min(1, state.toppings.plateSyrup + dt * 0.35);
      }
      state.activeSyrup.timer -= dt;
      if (state.activeSyrup.timer <= 0) {
        state.activeSyrup.timer = 0.14;
        sound.syrupDrip();
      }
    }
    for (const d of state.toppings.drips) {
      const maxH = (state.stack.length * 9.2 + 3) * (d.scale || 0.8);
      if (d.len < maxH) d.len = Math.min(maxH, d.len + dt * d.speed);
    }

    // Bouncing berries on stack
    for (const item of state.toppings.items) {
      if (item.hopY > 0 || item.vy !== 0) {
        item.vy -= 140 * dt;
        item.hopY += item.vy * dt;
        if (item.hopY <= 0) {
          item.hopY = 0;
          item.vy = 0;
        }
      }
    }

    // Mama's natural gaze tracking
    if (!pc || !pc.inAir) {
      let tx = layout.panX;
      let ty = layout.panY;
      if (state.pointer.active) {
        tx = state.pointer.x;
        ty = state.pointer.y;
      } else if (state.stack.length > 0 && !pc) {
        tx = layout.plateX;
        ty = state.stack[state.stack.length - 1].y;
      } else if (!pc) {
        tx = state.pitcher.x;
        ty = state.pitcher.y;
      }
      state.mama.gazeX += ((tx - state.mama.x) * 0.04 - state.mama.gazeX) * Math.min(1, dt * 8);
      state.mama.gazeY += ((ty - (state.mama.y + 30)) * 0.04 - state.mama.gazeY) * Math.min(1, dt * 8);
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === 'dot') pt.vy += 90 * dt;
    }

    // Invite pulse only when pan & plate are both empty
    state.pitcher.invitePulse = !state.pan.pancake && state.stack.length === 0 && !state.pitcher.pouring;
  }

  // --- Render Frame ---
  function render() {
    if (!layout.W) return;
    const S = window.Sprites;
    S.drawWallAndShelf(pb, layout);
    S.drawMamaBody(pb, state.mama, state.time);
    S.drawCounterSurface(pb, layout);
    S.drawMamaHands(pb, state.mama, layout, state.time);

    // Topping tray on shelf / side
    const dragKind = state.pointer.mode === 'prop' ? state.pointer.propKind : null;
    S.drawToppingTray(pb, layout, dragKind, state.activeSyrup, state.time);

    // Stove burner & flame dial
    S.drawStoveAndKnob(pb, layout, state.highFlame, state.time);

    // Frying pan (and pancake inside if resting on pan!)
    S.drawFryingPan(pb, layout, state.pan);
    if (state.pan.pancake && !state.pan.pancake.inAir) {
      S.drawStackedPancake(pb, state.pan.pancake, state.time);
    }

    // Batter bowl & pouring stream
    const panTarget = state.pan.pancake ? { x: state.pan.pancake.x, y: state.pan.pancake.y } : { x: layout.panX, y: layout.panY };
    S.drawBatterPitcher(pb, state.pitcher, panTarget, state.time);

    // Serving plate, hotcake stack, butter, cascading syrup & berries
    S.drawPlateAndStack(pb, layout, state.stack, state.toppings, state.activeSyrup, state.time);

    // Mid-air pancakes (high flips & plate arcs render in front of everything!)
    if (state.pan.pancake && state.pan.pancake.inAir) {
      S.drawStackedPancake(pb, state.pan.pancake, state.time);
    }
    for (const f of state.flyingToPlate) {
      S.drawStackedPancake(pb, f.pancake, state.time);
    }

    // Fork & delicious bite
    S.drawFork(pb, state.fork, state.time);

    // Dragged topping under finger
    if (state.pointer.mode === 'prop') {
      S.drawDraggedProp(pb, { active: true, kind: state.pointer.propKind, x: state.pointer.x, y: state.pointer.y });
    }

    // Sparkles, steam puffs & hearts
    S.drawParticles(pb, state.particles);

    pb.present(ctx);
  }

  // Event listeners
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: false });
  window.addEventListener('pointercancel', onPointerUp, { passive: false });
  window.addEventListener('resize', computeLayout);
  window.addEventListener('orientationchange', () => setTimeout(computeLayout, 60));

  // Prevent iOS rubber-band / double-tap zoom
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

  computeLayout();

  let lastTs = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
    lastTs = ts;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__PANCAKE_GAME = {
    state,
    get layout() { return layout; },
    computeLayout,
    step(dt) {
      update(dt);
      render();
    },
    render
  };
})();
