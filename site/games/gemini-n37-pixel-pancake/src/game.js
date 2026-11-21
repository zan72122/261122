// Main game loop, tactile one-finger physics, Mama AI, and wordless storytelling
(function (global) {
  'use strict';

  const PP = global.PP;
  const P = PP.PAL;
  const S = PP.Sprites;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const pb = new PP.PixelBuffer(320, 180);
  const sfx = new PP.SoundEngine();

  // --- Responsive Logical Layout ---
  let layout = null;

  function computeLayout() {
    const vw = Math.max(240, window.innerWidth);
    const vh = Math.max(240, window.innerHeight);
    const aspect = vw / vh;

    let W, H, mode;
    if (aspect >= 1.45) {
      mode = 'wide';
      W = 320;
      H = 180;
    } else if (aspect >= 1.0) {
      mode = 'mid';
      W = 280;
      H = 210;
    } else {
      mode = 'tall';
      W = 192;
      H = Math.max(264, Math.min(336, Math.round(192 / aspect)));
    }

    pb.resize(W, H);
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    // Fit canvas cleanly into viewport preserving exact pixel aspect ratio
    const scale = Math.min(vw / W, vh / H);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';

    if (mode === 'wide') {
      layout = {
        mode, W, H,
        counterY: 76,
        window: { x: 10, y: 6, w: 68, h: 48 },
        mama: { x: 158, faceY: 36 },
        bowl: { x: 34, y: 116, rx: 23, ry: 12 },
        pan: { x: 138, y: 118, rx: 38, ry: 19, handleAngle: 2.48, handleLen: 29 },
        knob: { x: 138, y: 162 },
        plate: { x: 246, y: 122, rx: 34, ry: 14 },
        butter: { x: 196, y: 160 },
        syrup: { x: 246, y: 158 },
        berries: { x: 292, y: 160 },
        fork: { x: 300, y: 116 },
      };
    } else if (mode === 'mid') {
      layout = {
        mode, W, H,
        counterY: 84,
        window: { x: 8, y: 8, w: 60, h: 48 },
        mama: { x: 140, faceY: 44 },
        bowl: { x: 32, y: 134, rx: 21, ry: 11 },
        pan: { x: 120, y: 134, rx: 36, ry: 18, handleAngle: 2.48, handleLen: 26 },
        knob: { x: 120, y: 184 },
        plate: { x: 218, y: 138, rx: 32, ry: 14 },
        butter: { x: 170, y: 184 },
        syrup: { x: 216, y: 182 },
        berries: { x: 256, y: 184 },
        fork: { x: 264, y: 130 },
      };
    } else {
      const cy = Math.round(H * 0.34);
      const rowY = Math.min(H - 34, cy + 132);
      layout = {
        mode, W, H,
        counterY: cy,
        window: { x: 6, y: 10, w: 46, h: 44 },
        mama: { x: 96, faceY: cy - 40 },
        pan: { x: 62, y: cy + 54, rx: 33, ry: 17, handleAngle: 2.52, handleLen: 20 },
        knob: { x: 62, y: cy + 94 },
        plate: { x: 140, y: cy + 62, rx: 28, ry: 13 },
        fork: { x: 176, y: cy + 40 },
        bowl: { x: 32, y: rowY - 2, rx: 21, ry: 10 },
        butter: { x: 80, y: rowY + 4 },
        syrup: { x: 120, y: rowY + 2 },
        berries: { x: 160, y: rowY + 4 },
      };
    }
  }

  // --- Game State ---
  const state = {
    time: 0,
    idleTime: 0,
    heat: 1, // 0=low, 1=med, 2=high
    knobBounce: 0,
    shakeTime: 0,
    shakeMag: 0,

    mama: {
      mood: 'normal',
      moodTimer: 0,
      handAction: 'rest',
      handTimer: 0,
      blinkTimer: 0,
      nextBlink: 2.5,
      lookX: 0,
      lookY: 1,
      swayX: 0,
      bounceY: 0,
      aahnOpen: 0,
      hintTarget: null,
      hintProgress: 0,
      hintShownForPhase: '',
    },

    bowl: {
      wobbleX: 0,
      wobbleV: 0,
      inviteBob: 0,
      ladleHeld: false,
      autoPour: null, // { t, targetX, targetY, poured }
    },

    pan: {
      ox: 0,
      oy: 0,
      tilt: 0,
      tiltV: 0,
      butterLevel: 0,
      syrupLevel: 0,
      butterPat: null, // { x, y, vx, vy, life }
    },

    // Active hotcake in pan or flying in air!
    activeCake: null,

    // Plate & stacked hotcakes
    plate: {
      stack: [],
      wobble: 0,
      wobbleV: 0,
      butters: [],
      syrupAmount: 0,
      syrupPool: 0,
      berries: [],
    },

    // Counter accessories animations
    butterDish: { wobbleX: 0, wobbleV: 0, bobY: 0, glint: false },
    syrupJug: { wobbleX: 0, wobbleV: 0, autoPour: null },
    berrySaucer: { wobbleX: 0, wobbleV: 0, bobY: 0, glint: false },
    forkObj: { bobY: 0, glint: false, autoFeed: null },

    // Flying small toppings (butter pat / berry arcing to plate or pan)
    flyingItems: [],

    // Active single-finger drag state
    drag: null, // { kind, pointerId, x, y, startX, startY, startT, lastX, lastY, vx, vy, holdTime, pouredOnce, hasBite }

    particles: [],
  };

  // --- Helper: Create a new Hotcake ---
  function createHotcake(size, buttered, caramelized) {
    const dims = size === 'mini'
      ? { rx: 16, ry: 9, targetThick: 4.5 }
      : size === 'jumbo'
      ? { rx: 29, ry: 15, targetThick: 7.5 }
      : { rx: 23, ry: 12, targetThick: 6.0 };
    return {
      size,
      rx: dims.rx,
      ry: dims.ry,
      thickness: 2.2,
      targetThick: dims.targetThick + (buttered ? 1.5 : 0),
      topCook: 0,
      bottomCook: 0,
      flipped: 0,
      buttered: !!buttered,
      caramelized: !!caramelized,
      hasEars: false,
      bubbles: [],
      bubbleTimer: 0.4,
      steamTimer: 0,
      // Physics in pan / air
      mode: 'pan', // 'pan' | 'flip' | 'toPlate'
      x: 0,
      y: 0,
      z: 0,
      vz: 0,
      vx: 0,
      vy: 0,
      flipAngle: 0,
      flipSpin: 0,
      targetSpins: 1,
      scaleX: 1.25,
      scaleY: 0.72,
      squash: 0,
      comboFlips: 0,
      jitterX: 0,
      bites: [],
      biteCount: 0,
      // toPlate arc
      arcT: 0,
      arcStartX: 0,
      arcStartY: 0,
      arcEndX: 0,
      arcEndY: 0,
    };
  }

  // --- Particles & Juice ---
  function addShake(mag, dur) {
    state.shakeMag = Math.max(state.shakeMag, mag);
    state.shakeTime = Math.max(state.shakeTime, dur);
  }

  function spawnParticle(pt) {
    if (state.particles.length > 90) state.particles.shift();
    state.particles.push(pt);
  }

  function spawnSparkles(x, y, count, big) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const spd = 14 + Math.random() * 26;
      spawnParticle({
        kind: 'spark',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 12,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.85,
        big: big && i % 2 === 0,
        grav: 18,
      });
    }
  }

  function spawnHearts(x, y, count) {
    for (let i = 0; i < count; i++) {
      spawnParticle({
        kind: 'heart',
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 14,
        vy: -22 - Math.random() * 14,
        life: 1.1 + Math.random() * 0.4,
        maxLife: 1.5,
        grav: -4,
      });
    }
  }

  function spawnCrumbs(x, y, count, col) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const spd = 22 + Math.random() * 34;
      spawnParticle({
        kind: 'crumb',
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        col: col || (i % 2 ? P.GOLDEN : P.CREAM),
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        grav: 120,
      });
    }
  }

  function spawnDrops(x, y, count, col) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8;
      const spd = 18 + Math.random() * 28;
      spawnParticle({
        kind: 'drop',
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        col,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        grav: 110,
      });
    }
  }

  function setMamaMood(mood, dur, handAction, handDur) {
    state.mama.mood = mood;
    state.mama.moodTimer = dur || 1.4;
    if (handAction) {
      state.mama.handAction = handAction;
      state.mama.handTimer = handDur || dur || 1.2;
    }
    state.mama.bounceY = -3;
  }

  // --- Core Gameplay Actions ---
  function pourBatterIntoPan(px, py, holdExtra) {
    const pan = layout.pan;
    if (!state.activeCake) {
      const size = holdExtra ? 'jumbo' : 'normal';
      const hc = createHotcake(size, state.pan.butterLevel > 0.15, state.pan.syrupLevel > 0.15);
      hc.x = pan.x;
      hc.y = pan.y;
      state.activeCake = hc;
      if (state.pan.butterLevel > 0.15) {
        spawnSparkles(pan.x, pan.y - 4, 6, true);
      }
      state.pan.butterLevel = 0;
      state.pan.syrupLevel = 0;
      state.pan.butterPat = null;
      sfx.playPour(size);
      spawnDrops(pan.x, pan.y - 2, 6, P.CREAM);
      addShake(1.2, 0.1);
      setMamaMood('happy', 1.0);
    } else if (state.activeCake.mode === 'pan' && state.activeCake.flipped === 0) {
      const hc = state.activeCake;
      const distFromCenter = Math.abs((px || pan.x) - pan.x);
      // Discovery: pouring near left/right edge fuses cute BEAR EARS onto the hotcake!
      if (!hc.hasEars && (distFromCenter > 11 || hc.size === 'jumbo')) {
        hc.hasEars = true;
        hc.scaleX = 1.2;
        hc.scaleY = 0.8;
        sfx.playPour('mini');
        spawnSparkles(pan.x, pan.y - 8, 7, true);
        setMamaMood('star', 1.6, 'clap', 1.1);
        sfx.playMamaGiggle('cheer');
      } else if (hc.size !== 'jumbo') {
        // Pouring more batter makes it bigger & fluffier!
        hc.size = hc.size === 'mini' ? 'normal' : 'jumbo';
        hc.rx = hc.size === 'jumbo' ? 29 : 23;
        hc.ry = hc.size === 'jumbo' ? 15 : 12;
        hc.targetThick = (hc.size === 'jumbo' ? 7.5 : 6.0) + (hc.buttered ? 1.5 : 0);
        hc.scaleX = 1.22;
        hc.scaleY = 0.78;
        sfx.playPour('jumbo');
        spawnDrops(pan.x, pan.y - 3, 5, P.CREAM);
        setMamaMood('happy', 1.0);
      }
    }
  }

  function flipHotcake(power) {
    const hc = state.activeCake;
    if (!hc || hc.mode === 'toPlate') return;

    const pwr = Math.max(0.85, Math.min(1.6, power || 1.0));
    if (hc.mode === 'pan') {
      hc.mode = 'flip';
      hc.x = layout.pan.x;
      hc.y = layout.pan.y;
      hc.z = 2;
      hc.vz = 142 * pwr;
      hc.flipAngle = 0;
      hc.targetSpins = pwr > 1.3 ? 3 : 1; // Odd half-turns = flips over!
      hc.comboFlips = 1;
      hc.scaleX = 0.78;
      hc.scaleY = 1.38;
      hc.bubbles = [];
      state.pan.tilt = 1.0;
      state.pan.tiltV = 2.0;
      addShake(2.2, 0.14);
      sfx.playFlip(pwr, 0, hc.size);
      spawnDrops(hc.x, hc.y - 4, 5, hc.bottomCook > 0.5 ? P.HONEY : P.CREAM);
      setMamaMood(pwr > 1.25 ? 'surprised' : 'cheer', 1.2, 'cheer', 1.0);
    } else if (hc.mode === 'flip' && hc.z > 6) {
      // Mid-air juggle flip!
      hc.vz = Math.max(hc.vz + 85, 165);
      hc.targetSpins += 2;
      hc.comboFlips++;
      hc.scaleX = 0.72;
      hc.scaleY = 1.45;
      state.pan.tilt = 1.1;
      addShake(2.5, 0.14);
      sfx.playFlip(1.3, hc.comboFlips, hc.size);
      spawnSparkles(hc.x, hc.y - hc.z, 6, true);
      setMamaMood('star', 1.5, 'cheer', 1.3);
      sfx.playMamaGiggle('cheer');
    }
  }

  function sendHotcakeToPlate() {
    const hc = state.activeCake;
    if (!hc || hc.mode === 'toPlate') return;
    hc.mode = 'toPlate';
    hc.arcT = 0;
    hc.arcStartX = hc.x || layout.pan.x;
    hc.arcStartY = (hc.y || layout.pan.y) - (hc.z || 0);
    const stackH = state.plate.stack.reduce((acc, c) => acc + Math.max(4, Math.round(c.thickness * 0.85)), 0);
    hc.arcEndX = layout.plate.x;
    hc.arcEndY = layout.plate.y - stackH;
    hc.z = 0;
    state.pan.tilt = 0.7;
    state.pan.ox = 7;
    sfx.playSlideToPlate();
    setMamaMood('happy', 1.2);
  }

  function dropButterOnPan() {
    if (state.activeCake) return false;
    state.pan.butterPat = {
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 5,
      vx: 26 * (Math.random() < 0.5 ? 1 : -1),
      vy: 14 * (Math.random() < 0.5 ? 1 : -1),
      life: 1.0,
    };
    state.pan.butterLevel = Math.min(1, state.pan.butterLevel + 0.35);
    sfx.playButterPan();
    spawnDrops(layout.pan.x, layout.pan.y - 2, 6, P.BUTTER);
    setMamaMood('star', 1.2);
    return true;
  }

  function addButterToStack(ox) {
    if (state.plate.stack.length === 0) return false;
    const clampedOx = Math.max(-10, Math.min(10, ox || (Math.random() - 0.5) * 6));
    state.plate.butters.push({
      ox: clampedOx,
      oy: (Math.random() - 0.5) * 3,
      melt: 0,
      squash: 1.0,
    });
    if (state.plate.butters.length > 4) state.plate.butters.shift();
    state.plate.wobbleV += (Math.random() < 0.5 ? 1 : -1) * 5;
    sfx.playButterStack();
    const topPos = getPlateTopPos();
    spawnSparkles(topPos.x, topPos.y - 4, 5, false);
    setMamaMood('happy', 1.2);
    return true;
  }

  function addBerryToStack(ox, oy) {
    if (state.plate.stack.length === 0) return false;
    const idx = state.plate.berries.length;
    const defaultOffsets = [
      { x: -9, y: -2 },
      { x: 9, y: -1 },
      { x: 0, y: -4 },
      { x: -5, y: 2 },
      { x: 6, y: 2 },
      { x: 0, y: 0 },
    ];
    const def = defaultOffsets[idx % defaultOffsets.length];
    state.plate.berries.push({
      ox: ox !== undefined ? Math.max(-14, Math.min(14, ox)) : def.x,
      oy: oy !== undefined ? Math.max(-6, Math.min(4, oy)) : def.y,
      bounce: 1.0,
    });
    if (state.plate.berries.length > 6) state.plate.berries.shift();
    state.plate.wobbleV += (Math.random() < 0.5 ? 1 : -1) * 4;
    sfx.playBerryPlop(state.plate.berries.length);
    const topPos = getPlateTopPos();
    spawnSparkles(topPos.x, topPos.y - 6, 4, false);
    setMamaMood('happy', 1.1);
    return true;
  }

  function pourSyrupTick(dt, onPan) {
    if (onPan) {
      state.pan.syrupLevel = Math.min(1, state.pan.syrupLevel + dt * 0.7);
      sfx.playSyrupTick(state.pan.syrupLevel);
      if (Math.random() < 0.35) {
        spawnParticle({
          kind: 'steam',
          x: layout.pan.x + (Math.random() - 0.5) * 16,
          y: layout.pan.y - 4,
          vx: (Math.random() - 0.5) * 6,
          vy: -16 - Math.random() * 10,
          life: 0.7,
          maxLife: 0.7,
          smoke: false,
          grav: -2,
        });
      }
      return;
    }
    if (state.plate.stack.length === 0) return;
    state.plate.syrupAmount = Math.min(1.6, state.plate.syrupAmount + dt * 1.15);
    if (state.plate.syrupAmount > 0.7) {
      state.plate.syrupPool = Math.min(1.0, state.plate.syrupPool + dt * 0.85);
    }
    sfx.playSyrupTick(state.plate.syrupAmount);
    if (state.plate.syrupPool > 0.55 && state.mama.mood !== 'happy') {
      // Mama laughs joyfully at overflowing syrup!
      setMamaMood('happy', 1.3, 'clap', 0.9);
      sfx.playMamaGiggle('giggle');
    }
  }

  function takeBite(feedMama) {
    const stack = state.plate.stack;
    if (stack.length === 0) return;

    const topCake = stack[stack.length - 1];
    topCake.biteCount++;
    const biteAngles = [-0.65, 0.65, 0];
    const ang = biteAngles[(topCake.biteCount - 1) % biteAngles.length];
    topCake.bites.push({
      ox: Math.round(Math.sin(ang) * topCake.rx * 0.52),
      oy: Math.round(Math.cos(ang) * 2),
      r: Math.max(7, Math.round(topCake.rx * 0.44)),
    });

    const topPos = getPlateTopPos();
    spawnCrumbs(feedMama ? layout.mama.x : topPos.x, feedMama ? layout.mama.faceY + 12 : topPos.y, 8, P.GOLDEN);
    sfx.playBite(feedMama);
    state.plate.wobbleV += (Math.random() < 0.5 ? 1 : -1) * 7;

    if (feedMama) {
      setMamaMood('chew', 1.6, 'clap', 1.0);
      spawnHearts(layout.mama.x, layout.mama.faceY - 12, 3);
    } else {
      setMamaMood('happy', 1.2);
      spawnHearts(topPos.x, topPos.y - 12, 2);
    }

    // Consume top cake after 2 bites (or 1 bite for mini)
    const bitesNeeded = topCake.size === 'mini' ? 1 : 2;
    if (topCake.biteCount >= bitesNeeded) {
      stack.pop();
      // Remove top berries/butter gradually as stack is eaten
      if (state.plate.berries.length > 0) state.plate.berries.pop();
      if (stack.length === 0) {
        // Plate happily cleared! Big celebration!
        state.plate.butters = [];
        state.plate.berries = [];
        state.plate.syrupAmount = 0;
        state.plate.syrupPool = 0;
        sfx.playCelebration();
        setMamaMood('star', 2.4, 'cheer', 2.0);
        spawnHearts(layout.mama.x, layout.mama.faceY - 10, 6);
        spawnSparkles(layout.plate.x, layout.plate.y - 10, 12, true);
        addShake(1.5, 0.14);
      }
    }
  }

  function getPlateTopPos() {
    const stackH = state.plate.stack.reduce((acc, c) => acc + Math.max(4, Math.round(c.thickness * 0.85)), 0);
    return { x: layout.plate.x, y: layout.plate.y - stackH };
  }

  // --- Hit Testing (Generous child-friendly hitboxes!) ---
  function screenToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * layout.W,
      y: ((clientY - rect.top) / rect.height) * layout.H,
    };
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function hitTest(x, y) {
    // 1. Fork (if stack has pancakes, prioritize fork for easy feeding!)
    if (state.plate.stack.length > 0 && dist(x, y, layout.fork.x, layout.fork.y) < 20) {
      return 'fork';
    }
    // 2. Batter Bowl & Ladle
    if (dist(x, y, layout.bowl.x, layout.bowl.y - 4) < layout.bowl.rx + 12) {
      return 'bowl';
    }
    // 3. Stove Flame Knob
    if (dist(x, y, layout.knob.x, layout.knob.y) < 16) {
      return 'knob';
    }
    // 4. Butter Dish
    if (dist(x, y, layout.butter.x, layout.butter.y) < 18) {
      return 'butter';
    }
    // 5. Syrup Pitcher
    if (dist(x, y, layout.syrup.x, layout.syrup.y) < 19) {
      return 'syrup';
    }
    // 6. Strawberry Saucer
    if (dist(x, y, layout.berries.x, layout.berries.y) < 18) {
      return 'berries';
    }
    // 7. Active mid-air hotcake (for juggling!)
    if (state.activeCake && state.activeCake.mode === 'flip') {
      const cy = state.activeCake.y - state.activeCake.z;
      if (dist(x, y, state.activeCake.x, cy) < state.activeCake.rx + 18) {
        return 'pan';
      }
    }
    // 8. Frying Pan & Handle
    const hAng = layout.pan.handleAngle;
    const hx = layout.pan.x + Math.cos(hAng) * (layout.pan.rx + layout.pan.handleLen * 0.55);
    const hy = layout.pan.y + Math.sin(hAng) * (layout.pan.ry + layout.pan.handleLen * 0.35);
    if (
      dist(x, y, layout.pan.x, layout.pan.y) < layout.pan.rx + 10 ||
      dist(x, y, hx, hy) < 24
    ) {
      return 'pan';
    }
    // 9. Plate & Stacked Tower
    const topPos = getPlateTopPos();
    if (
      (x >= layout.plate.x - layout.plate.rx - 8 && x <= layout.plate.x + layout.plate.rx + 8 &&
       y >= topPos.y - 22 && y <= layout.plate.y + layout.plate.ry + 8)
    ) {
      return 'plate';
    }
    // 10. Mama!
    if (dist(x, y, layout.mama.x, layout.mama.faceY + 8) < 34) {
      return 'mama';
    }
    return null;
  }

  // --- Pointer Input (Single-finger safe, forgiving gestures!) ---
  function onPointerDown(e) {
    e.preventDefault();
    sfx.unlock();
    // Ignore secondary fingers so multi-touch never breaks state
    if (state.drag !== null) return;

    const pt = screenToCanvas(e.clientX, e.clientY);
    state.idleTime = 0;
    if (state.mama.handAction === 'hint') {
      state.mama.handAction = 'rest';
      state.mama.hintProgress = 0;
    }

    const hit = hitTest(pt.x, pt.y);
    if (!hit) return;

    const now = performance.now();

    if (hit === 'knob') {
      state.heat = (state.heat + 1) % 3;
      state.knobBounce = 3;
      sfx.playKnob(state.heat);
      if (state.heat === 2) {
        setMamaMood('surprised', 0.9);
      } else {
        setMamaMood('happy', 0.7);
      }
      return;
    }

    if (hit === 'mama') {
      // If a pancake is steaming/crispy in pan, Mama blows "Fuuu~" to cool it!
      if (state.activeCake && state.activeCake.mode === 'pan' && (state.activeCake.topCook > 0.5 || state.activeCake.bottomCook > 0.9)) {
        setMamaMood('blow', 1.1, 'fan', 1.0);
        sfx.playMamaBlow();
        for (let i = 0; i < 5; i++) {
          spawnParticle({
            kind: 'puff',
            x: layout.mama.x + (layout.pan.x - layout.mama.x) * 0.25,
            y: layout.mama.faceY + 14,
            vx: (layout.pan.x - layout.mama.x) * 1.1 + (Math.random() - 0.5) * 18,
            vy: (layout.pan.y - layout.mama.faceY - 14) * 1.1 + (Math.random() - 0.5) * 10,
            life: 0.55 + i * 0.06,
            maxLife: 0.75,
            grav: -4,
          });
        }
        state.activeCake.scaleX = 1.16;
        state.activeCake.scaleY = 0.86;
      } else {
        setMamaMood('happy', 1.3, 'clap', 0.9);
        sfx.playMamaGiggle('giggle');
        spawnHearts(layout.mama.x, layout.mama.faceY - 12, 2);
      }
      return;
    }

    if (hit === 'bowl') {
      if (state.bowl.autoPour) return;
      state.bowl.wobbleV = 12;
      state.bowl.ladleHeld = true;
      sfx.playScoop();
      state.drag = {
        kind: 'ladle',
        pointerId: e.pointerId,
        x: pt.x,
        y: pt.y,
        startX: pt.x,
        startY: pt.y,
        startT: now,
        lastX: pt.x,
        lastY: pt.y,
        vx: 0,
        vy: 0,
        holdOverPan: 0,
        poured: false,
      };
      return;
    }

    if (hit === 'pan') {
      if (!state.activeCake) {
        // Gentle metallic pan clink when empty (respecting focus rule: doesn't auto-pour!)
        state.pan.tilt = 0.4;
        sfx.playSoftTap();
        return;
      }
      state.drag = {
        kind: 'pan',
        pointerId: e.pointerId,
        x: pt.x,
        y: pt.y,
        startX: pt.x,
        startY: pt.y,
        startT: now,
        lastX: pt.x,
        lastY: pt.y,
        vx: 0,
        vy: 0,
        flippedThisDrag: false,
      };
      return;
    }

    if (hit === 'butter') {
      state.butterDish.wobbleV = 10;
      sfx.playSoftTap();
      state.drag = {
        kind: 'butter',
        pointerId: e.pointerId,
        x: pt.x,
        y: pt.y,
        startX: pt.x,
        startY: pt.y,
        startT: now,
        lastX: pt.x,
        lastY: pt.y,
        vx: 0,
        vy: 0,
      };
      return;
    }

    if (hit === 'syrup') {
      state.syrupJug.wobbleV = 10;
      sfx.playSoftTap();
      state.drag = {
        kind: 'syrup',
        pointerId: e.pointerId,
        x: pt.x,
        y: pt.y,
        startX: pt.x,
        startY: pt.y,
        startT: now,
        lastX: pt.x,
        lastY: pt.y,
        vx: 0,
        vy: 0,
        poured: false,
      };
      return;
    }

    if (hit === 'berries') {
      state.berrySaucer.wobbleV = 10;
      sfx.playSoftTap();
      state.drag = {
        kind: 'berry',
        pointerId: e.pointerId,
        x: pt.x,
        y: pt.y,
        startX: pt.x,
        startY: pt.y,
        startT: now,
        lastX: pt.x,
        lastY: pt.y,
        vx: 0,
        vy: 0,
      };
      return;
    }

    if (hit === 'fork') {
      if (state.plate.stack.length === 0) {
        sfx.playSoftTap();
        return;
      }
      sfx.playSoftTap();
      state.drag = {
        kind: 'fork',
        pointerId: e.pointerId,
        x: pt.x,
        y: pt.y,
        startX: pt.x,
        startY: pt.y,
        startT: now,
        lastX: pt.x,
        lastY: pt.y,
        vx: 0,
        vy: 0,
        hasBite: true,
      };
      return;
    }

    if (hit === 'plate') {
      // If a finished flipped hotcake is waiting in pan, tapping plate slides it onto the plate!
      if (state.activeCake && state.activeCake.mode === 'pan' && state.activeCake.flipped >= 1) {
        sendHotcakeToPlate();
        return;
      }
      if (state.plate.stack.length === 0) {
        sfx.playSoftTap();
        return;
      }
      // Poking the stacked tower makes it wobble "purupuru"!
      state.plate.wobbleV += (pt.x < layout.plate.x ? 12 : -12);
      sfx.playWobble();
      if (state.plate.stack.length >= 3) {
        setMamaMood('surprised', 0.9);
      }
      // Also allow dragging a bite straight from a decorated stack to Mama!
      const isDecorated = state.plate.butters.length > 0 || state.plate.syrupAmount > 0.1 || state.plate.berries.length > 0;
      if (isDecorated) {
        state.drag = {
          kind: 'fork',
          pointerId: e.pointerId,
          x: pt.x,
          y: pt.y,
          startX: pt.x,
          startY: pt.y,
          startT: now,
          lastX: pt.x,
          lastY: pt.y,
          vx: 0,
          vy: 0,
          hasBite: true,
          fromPlate: true,
        };
      }
    }
  }

  function onPointerMove(e) {
    if (!state.drag || e.pointerId !== state.drag.pointerId) return;
    e.preventDefault();
    const pt = screenToCanvas(e.clientX, e.clientY);
    const d = state.drag;
    d.vx = pt.x - d.lastX;
    d.vy = pt.y - d.lastY;
    d.lastX = d.x;
    d.lastY = d.y;
    d.x = pt.x;
    d.y = pt.y;
    state.idleTime = 0;

    // Immediate flick recognition on frying pan!
    if (d.kind === 'pan' && !d.flippedThisDrag && state.activeCake) {
      const dy = pt.y - d.startY;
      const dx = pt.x - d.startX;
      // Flick upward or shake pan -> POON flip!
      if (dy < -11 || d.vy < -4.5 || (Math.abs(dx) > 18 && d.vy < -1)) {
        const power = Math.min(1.55, 0.95 + Math.abs(d.vy) * 0.08 + Math.abs(dy) * 0.012);
        flipHotcake(power);
        d.flippedThisDrag = true;
      } else if (state.activeCake.flipped >= 1 && dx > 22 && state.activeCake.mode === 'pan') {
        // Drag/flick right toward plate -> slide hotcake onto plate!
        sendHotcakeToPlate();
        d.flippedThisDrag = true;
      } else {
        // Tactile pan follow while holding
        state.pan.ox = Math.max(-6, Math.min(10, dx * 0.25));
        state.pan.oy = Math.max(-5, Math.min(4, dy * 0.25));
      }
    }
  }

  function onPointerUp(e) {
    if (!state.drag || e.pointerId !== state.drag.pointerId) return;
    e.preventDefault();
    const d = state.drag;
    const elapsed = (performance.now() - d.startT) / 1000;
    const moved = dist(d.x, d.y, d.startX, d.startY);
    const isTap = moved < 14 && elapsed < 0.45;
    state.drag = null;

    if (d.kind === 'ladle') {
      state.bowl.ladleHeld = false;
      const overPan = dist(d.x, d.y, layout.pan.x, layout.pan.y) < layout.pan.rx + 22;
      if (overPan) {
        if (!d.poured) {
          pourBatterIntoPan(d.x, d.y, d.holdOverPan > 0.35);
        }
      } else if (isTap) {
        // Auto smooth ladle arc over pan to pour!
        if (!state.activeCake || (state.activeCake.mode === 'pan' && state.activeCake.flipped === 0)) {
          state.bowl.autoPour = { t: 0, poured: false };
          state.bowl.ladleHeld = true;
        } else {
          state.bowl.wobbleV = 14;
          sfx.playSoftTap();
        }
      }
      return;
    }

    if (d.kind === 'pan') {
      if (!d.flippedThisDrag && state.activeCake) {
        const hc = state.activeCake;
        const nearPlate = dist(d.x, d.y, layout.plate.x, layout.plate.y) < layout.plate.rx + 28;
        if (hc.mode === 'pan' && hc.flipped >= 1 && (nearPlate || (isTap && hc.bottomCook >= 0.45))) {
          sendHotcakeToPlate();
        } else if (isTap || d.y < d.startY) {
          flipHotcake(1.08);
        }
      }
      return;
    }

    if (d.kind === 'butter') {
      const topPos = getPlateTopPos();
      const overPlate = state.plate.stack.length > 0 && dist(d.x, d.y, topPos.x, topPos.y) < layout.plate.rx + 24;
      const overPan = !state.activeCake && dist(d.x, d.y, layout.pan.x, layout.pan.y) < layout.pan.rx + 20;
      if (overPlate) {
        addButterToStack(d.x - topPos.x);
      } else if (overPan) {
        dropButterOnPan();
      } else if (isTap) {
        if (state.plate.stack.length > 0) {
          launchFlyingItem('butter', layout.butter.x, layout.butter.y - 4, topPos.x, topPos.y - 2, 'plate');
        } else if (!state.activeCake) {
          launchFlyingItem('butter', layout.butter.x, layout.butter.y - 4, layout.pan.x, layout.pan.y - 2, 'pan');
        } else {
          state.butterDish.wobbleV = 12;
        }
      }
      return;
    }

    if (d.kind === 'syrup') {
      if (isTap && !d.poured) {
        if (state.plate.stack.length > 0) {
          const topPos = getPlateTopPos();
          state.syrupJug.autoPour = { t: 0, dur: 0.95, tx: topPos.x + 12, ty: topPos.y - 24, onPan: false };
        } else if (!state.activeCake) {
          state.syrupJug.autoPour = { t: 0, dur: 0.7, tx: layout.pan.x + 12, ty: layout.pan.y - 24, onPan: true };
        } else {
          state.syrupJug.wobbleV = 12;
        }
      }
      return;
    }

    if (d.kind === 'berry') {
      const topPos = getPlateTopPos();
      const overPlate = state.plate.stack.length > 0 && dist(d.x, d.y, topPos.x, topPos.y) < layout.plate.rx + 24;
      if (overPlate) {
        addBerryToStack(d.x - topPos.x, d.y - topPos.y);
      } else if (isTap) {
        if (state.plate.stack.length > 0) {
          launchFlyingItem('berry', layout.berries.x, layout.berries.y - 6, topPos.x, topPos.y - 2, 'plate');
        } else {
          state.berrySaucer.wobbleV = 12;
        }
      }
      return;
    }

    if (d.kind === 'fork') {
      const nearMama = dist(d.x, d.y, layout.mama.x, layout.mama.faceY + 12) < 40;
      if (nearMama) {
        takeBite(true);
      } else if (isTap && !d.fromPlate) {
        // Tap fork -> cute bite animation toward Mama!
        state.forkObj.autoFeed = { t: 0, sx: layout.plate.x, sy: getPlateTopPos().y - 6 };
      } else if (isTap && d.fromPlate) {
        // Poking decorated stack gently just wobbled it; don't accidentally eat without fork or dragging to Mama
      }
    }
  }

  function launchFlyingItem(kind, sx, sy, tx, ty, dest) {
    state.flyingItems.push({ kind, sx, sy, tx, ty, dest, t: 0, dur: 0.34 });
  }

  // --- Update Simulation ---
  function update(dt) {
    state.time += dt;
    state.idleTime += dt;

    // Screen shake decay
    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      if (state.shakeTime === 0) state.shakeMag = 0;
    }

    // Knob bounce decay
    state.knobBounce *= Math.exp(-dt * 14);

    // Pan spring return
    state.pan.ox += (0 - state.pan.ox) * Math.min(1, dt * 12);
    state.pan.oy += (0 - state.pan.oy) * Math.min(1, dt * 12);
    state.pan.tiltV += (-state.pan.tilt * 85 - state.pan.tiltV * 12) * dt;
    state.pan.tilt += state.pan.tiltV * dt;
    if (Math.abs(state.pan.tilt) < 0.01 && Math.abs(state.pan.tiltV) < 0.05) {
      state.pan.tilt = 0;
      state.pan.tiltV = 0;
    }

    // Counter spring wobbles
    for (const obj of [state.bowl, state.butterDish, state.syrupJug, state.berrySaucer]) {
      obj.wobbleV += (-obj.wobbleX * 120 - obj.wobbleV * 11) * dt;
      obj.wobbleX += obj.wobbleV * dt;
    }

    // Subtle inviting bob ONLY on the current stage's natural object (never noisy!)
    const hasCakeInPan = !!state.activeCake;
    const hasStack = state.plate.stack.length > 0;
    state.bowl.inviteBob = !hasCakeInPan && !hasStack ? Math.sin(state.time * 3.5) * 1.4 : 0;
    state.butterDish.glint = hasStack && state.plate.butters.length === 0;
    state.butterDish.bobY = state.butterDish.glint ? Math.sin(state.time * 3.8) * 0.8 : 0;
    state.berrySaucer.glint = hasStack && state.plate.butters.length > 0 && state.plate.berries.length === 0;
    state.berrySaucer.bobY = state.berrySaucer.glint ? Math.sin(state.time * 3.8 + 1) * 0.8 : 0;
    const isDecorated = hasStack && (state.plate.butters.length > 0 || state.plate.syrupAmount > 0.1 || state.plate.berries.length > 0);
    state.forkObj.glint = isDecorated;
    state.forkObj.bobY = isDecorated ? Math.sin(state.time * 4.5) * 1.6 : 0;

    // Skating butter pat inside hot empty pan
    if (state.pan.butterPat) {
      const bp = state.pan.butterPat;
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
      const maxX = layout.pan.rx - 14;
      const maxY = layout.pan.ry - 8;
      if (Math.abs(bp.x) > maxX) { bp.vx *= -0.9; bp.x = Math.sign(bp.x) * maxX; }
      if (Math.abs(bp.y) > maxY) { bp.vy *= -0.9; bp.y = Math.sign(bp.y) * maxY; }
      bp.life -= dt * (0.45 + state.heat * 0.25);
      state.pan.butterLevel = Math.min(1, state.pan.butterLevel + dt * 0.65);
      if (Math.random() < 0.25) {
        spawnParticle({
          kind: 'drop',
          x: layout.pan.x + bp.x,
          y: layout.pan.y + bp.y - 2,
          vx: (Math.random() - 0.5) * 20,
          vy: -14 - Math.random() * 14,
          col: P.BUTTER,
          life: 0.28,
          maxLife: 0.28,
          grav: 90,
        });
      }
      if (bp.life <= 0) state.pan.butterPat = null;
    }

    // Continuous drag pouring (ladle & syrup!)
    if (state.drag) {
      const d = state.drag;
      if (d.kind === 'ladle') {
        const overPan = dist(d.x, d.y, layout.pan.x, layout.pan.y) < layout.pan.rx + 18;
        if (overPan) {
          d.holdOverPan += dt;
          if (!d.poured && d.holdOverPan > 0.12) {
            pourBatterIntoPan(d.x, d.y, false);
            d.poured = true;
          } else if (d.poured && d.holdOverPan > 0.65 && state.activeCake && state.activeCake.size !== 'jumbo') {
            pourBatterIntoPan(d.x, d.y, true);
            d.holdOverPan = 0.15;
          }
        }
      } else if (d.kind === 'syrup') {
        const topPos = getPlateTopPos();
        const overPlate = state.plate.stack.length > 0 && dist(d.x, d.y, topPos.x, topPos.y - 10) < layout.plate.rx + 28;
        const overPan = !state.activeCake && dist(d.x, d.y, layout.pan.x, layout.pan.y - 10) < layout.pan.rx + 22;
        if (overPlate) {
          pourSyrupTick(dt, false);
          d.poured = true;
        } else if (overPan) {
          pourSyrupTick(dt, true);
          d.poured = true;
        }
      }
    }

    // Auto ladle pour animation (when child taps bowl — snappy 240ms to pour!)
    if (state.bowl.autoPour) {
      const ap = state.bowl.autoPour;
      ap.t += dt;
      if (ap.t >= 0.24 && !ap.poured) {
        ap.poured = true;
        pourBatterIntoPan(layout.pan.x, layout.pan.y, false);
      }
      if (ap.t >= 0.54) {
        state.bowl.autoPour = null;
        state.bowl.ladleHeld = false;
      }
    }

    // Auto syrup pour animation (when child taps syrup jug)
    if (state.syrupJug.autoPour) {
      const ap = state.syrupJug.autoPour;
      ap.t += dt;
      if (ap.t > 0.2 && ap.t < ap.dur - 0.15) {
        pourSyrupTick(dt, ap.onPan);
      }
      if (ap.t >= ap.dur) {
        state.syrupJug.autoPour = null;
      }
    }

    // Auto fork feed animation (when child taps fork)
    if (state.forkObj.autoFeed) {
      const af = state.forkObj.autoFeed;
      af.t += dt;
      if (af.t >= 0.55) {
        state.forkObj.autoFeed = null;
        takeBite(true);
      }
    }

    // Flying butter / berry items
    for (let i = state.flyingItems.length - 1; i >= 0; i--) {
      const fi = state.flyingItems[i];
      fi.t += dt;
      if (fi.t >= fi.dur) {
        if (fi.kind === 'butter') {
          if (fi.dest === 'pan') dropButterOnPan();
          else addButterToStack(0);
        } else if (fi.kind === 'berry') {
          addBerryToStack();
        }
        state.flyingItems.splice(i, 1);
      }
    }

    // --- Active Hotcake Cooking & Flip Physics ---
    let sizzleIntensity = state.pan.butterPat ? 0.65 : 0;
    const hc = state.activeCake;
    if (hc) {
      // Squash-and-stretch recovery
      hc.scaleX += (1 - hc.scaleX) * Math.min(1, dt * 11);
      hc.scaleY += (1 - hc.scaleY) * Math.min(1, dt * 11);

      if (hc.mode === 'pan') {
        hc.x = layout.pan.x + state.pan.ox;
        hc.y = layout.pan.y + state.pan.oy;

        const heatRate = state.heat === 0 ? 0.12 : state.heat === 1 ? 0.22 : 0.36;
        hc.bottomCook = Math.min(1.5, hc.bottomCook + dt * heatRate);
        sizzleIntensity = 0.45 + state.heat * 0.28;

        // Gentle sizzling tremble on pan handle once bubbly & ready to flip!
        if (hc.flipped === 0 && hc.bottomCook >= 0.55 && hc.bottomCook < 1.2) {
          state.pan.tilt = Math.max(state.pan.tilt, Math.sin(state.time * 18) * 0.06);
        }

        // Puff up thickness as it cooks!
        const puffTarget = Math.min(hc.targetThick, 2.2 + (hc.bottomCook + hc.topCook) * 2.8);
        hc.thickness += (puffTarget - hc.thickness) * Math.min(1, dt * 2.4);

        // Spawn cute "puku-puku" bubbles on uncooked side 1!
        if (hc.topCook < 0.5 && hc.bottomCook > 0.14) {
          hc.bubbleTimer -= dt * (1 + state.heat * 0.4);
          if (hc.bubbleTimer <= 0 && hc.bubbles.length < 9) {
            const ang = Math.random() * Math.PI * 2;
            const rad = 0.2 + Math.random() * 0.58;
            hc.bubbles.push({
              ox: Math.cos(ang) * hc.rx * rad,
              oy: Math.sin(ang) * hc.ry * rad,
              r: 1,
              maxR: 2 + Math.random() * 1.4,
              popped: false,
              age: 0,
            });
            hc.bubbleTimer = Math.max(0.18, 0.55 - hc.bottomCook * 0.3);
          }
        }

        // Grow & pop bubbles!
        for (let i = hc.bubbles.length - 1; i >= 0; i--) {
          const b = hc.bubbles[i];
          b.age += dt;
          if (!b.popped) {
            b.r += dt * 1.9;
            if (b.r >= b.maxR) {
              b.popped = true;
              sfx.playBubblePop(hc.bottomCook);
              spawnParticle({
                kind: 'drop',
                x: hc.x + b.ox,
                y: hc.y - hc.thickness + b.oy,
                vx: (Math.random() - 0.5) * 14,
                vy: -14 - Math.random() * 10,
                col: P.CREAM,
                life: 0.22,
                maxLife: 0.22,
                grav: 80,
              });
            }
          } else if (b.age > 2.2) {
            hc.bubbles.splice(i, 1);
          }
        }

        // Rising steam & playful smoke if extra-toasty
        hc.steamTimer -= dt;
        const isSmoky = hc.bottomCook > 1.22;
        if (hc.steamTimer <= 0 && (hc.bottomCook > 0.45 || hc.flipped > 0)) {
          spawnParticle({
            kind: 'steam',
            x: hc.x + (Math.random() - 0.5) * hc.rx * 1.1,
            y: hc.y - hc.thickness - 3,
            vx: (Math.random() - 0.5) * 8,
            vy: -15 - Math.random() * 12,
            life: 0.8 + Math.random() * 0.4,
            maxLife: 1.2,
            smoke: isSmoky,
            grav: -3,
          });
          hc.steamTimer = isSmoky ? 0.14 : 0.34;
          if (isSmoky && state.mama.mood === 'normal') {
            setMamaMood('surprised', 1.0, 'fan', 1.0);
          }
        }
      } else if (hc.mode === 'flip') {
        // Juicy snappy gravity arc!
        hc.vz -= 440 * dt;
        hc.z += hc.vz * dt;
        const totalAirTime = 0.78;
        const targetAngle = hc.targetSpins * Math.PI;
        hc.flipAngle += (targetAngle - hc.flipAngle) * Math.min(1, dt * 6.5) + (targetAngle / totalAirTime) * dt * 0.35;
        if (hc.flipAngle > targetAngle) hc.flipAngle = targetAngle;

        if (hc.z <= 0) {
          // LANDED back in pan! MUNI squash!
          hc.z = 0;
          hc.vz = 0;
          hc.mode = 'pan';
          hc.flipAngle = 0;
          hc.flipped++;

          // Swap top & bottom cook values!
          const prevBottom = hc.bottomCook;
          hc.bottomCook = hc.topCook;
          hc.topCook = prevBottom;

          // Huge squash-and-stretch + brief screen shake!
          hc.scaleX = 1.38;
          hc.scaleY = 0.62;
          state.pan.oy = 4;
          addShake(2.6, 0.16);

          // Expressive reaction based on revealed golden face (never punitive!)
          if (hc.topCook >= 0.58 && hc.topCook < 1.18) {
            const qual = hc.buttered ? 'buttered' : 'perfect';
            sfx.playLand(qual, false);
            spawnSparkles(hc.x, hc.y - 8, hc.buttered ? 12 : 8, true);
            setMamaMood('star', 1.7, 'clap', 1.3);
            sfx.playMamaGiggle('cheer');
          } else if (hc.topCook < 0.58) {
            sfx.playLand('early', false);
            spawnDrops(hc.x, hc.y - 4, 6, P.CREAM);
            setMamaMood('surprised', 1.0);
            sfx.playMamaGiggle('giggle');
          } else {
            sfx.playLand('crispy', false);
            spawnCrumbs(hc.x, hc.y - 6, 7, P.COCOA);
            setMamaMood('surprised', 1.2, 'fan', 1.1);
          }
        }
      } else if (hc.mode === 'toPlate') {
        hc.arcT += dt * 2.5;
        const t = Math.min(1, hc.arcT);
        hc.x = hc.arcStartX + (hc.arcEndX - hc.arcStartX) * t;
        hc.y = hc.arcStartY + (hc.arcEndY - hc.arcStartY) * t - Math.sin(t * Math.PI) * 42;
        hc.flipAngle = t * Math.PI * 2;
        if (t >= 1) {
          // Landed onto the plate stack!
          hc.mode = 'stacked';
          hc.flipAngle = 0;
          hc.squash = 1.0;
          hc.jitterX = (Math.random() - 0.5) * 2.4;
          state.plate.stack.push(hc);
          state.activeCake = null;

          // Stack wobble impulse!
          state.plate.wobbleV += (Math.random() < 0.5 ? 1 : -1) * (6 + state.plate.stack.length * 2.2);
          addShake(2.2, 0.14);
          sfx.playLand(hc.topCook >= 0.58 && hc.topCook < 1.18 ? 'perfect' : 'normal', true);
          const topPos = getPlateTopPos();
          spawnSparkles(topPos.x, topPos.y - 6, 9, true);
          setMamaMood(state.plate.stack.length >= 3 ? 'star' : 'happy', 1.6, 'clap', 1.2);
          if (state.plate.stack.length >= 3) {
            spawnHearts(layout.mama.x, layout.mama.faceY - 12, 3);
            sfx.playMamaGiggle('cheer');
          }
        }
      }
    }

    sfx.setSizzle(sizzleIntensity, state.heat);

    // --- Plate Stack Wobble & Melting Butter ---
    const stackLen = state.plate.stack.length;
    const springK = Math.max(24, 58 - stackLen * 5);
    state.plate.wobbleV += (-state.plate.wobble * springK - state.plate.wobbleV * 4.8) * dt;
    state.plate.wobble += state.plate.wobbleV * dt;

    for (let i = 0; i < stackLen; i++) {
      state.plate.stack[i].squash *= Math.exp(-dt * 9);
    }
    for (let i = 0; i < state.plate.butters.length; i++) {
      const b = state.plate.butters[i];
      b.squash *= Math.exp(-dt * 10);
      b.melt = Math.min(1, b.melt + dt * 0.14);
    }
    for (let i = 0; i < state.plate.berries.length; i++) {
      state.plate.berries[i].bounce *= Math.exp(-dt * 10);
    }

    // --- Mama Expressive AI (Eye Tracking, Blinking, Mouth "Aahn!", Gentle Idle Hint >10s) ---
    const m = state.mama;
    m.bounceY += (0 - m.bounceY) * Math.min(1, dt * 10);
    m.swayX = Math.sin(state.time * 1.4) * 1.0;

    // Blink
    if (m.blinkTimer > 0) {
      m.blinkTimer -= dt;
    } else {
      m.nextBlink -= dt;
      if (m.nextBlink <= 0) {
        m.blinkTimer = 0.14;
        m.nextBlink = 2.6 + Math.random() * 2.5;
      }
    }

    // Mood timers
    if (m.moodTimer > 0) {
      m.moodTimer -= dt;
      if (m.moodTimer <= 0) m.mood = 'normal';
    }
    if (m.handTimer > 0) {
      m.handTimer -= dt;
      if (m.handTimer <= 0 && m.handAction !== 'hint') m.handAction = 'rest';
    }

    // Eye tracking target + "Aahn!" mouth opening when fork approaches Mama!
    let lookTx = layout.pan.x;
    let lookTy = layout.pan.y;

    if (state.drag) {
      lookTx = state.drag.x;
      lookTy = state.drag.y;
      if (state.drag.kind === 'fork') {
        const dMama = dist(state.drag.x, state.drag.y, layout.mama.x, layout.mama.faceY + 12);
        if (dMama < 72) {
          const prevMood = m.mood;
          m.mood = 'aahn';
          m.moodTimer = 0.15;
          m.aahnOpen = Math.max(0, Math.min(1, 1 - dMama / 72));
          if (prevMood !== 'aahn') sfx.playMamaGiggle('aahn');
        }
      }
    } else if (state.forkObj.autoFeed) {
      m.mood = 'aahn';
      m.moodTimer = 0.2;
      m.aahnOpen = Math.min(1, state.forkObj.autoFeed.t * 2.2);
      lookTx = layout.mama.x;
      lookTy = layout.mama.faceY + 18;
    } else if (hc && hc.mode === 'flip') {
      lookTx = hc.x;
      lookTy = hc.y - hc.z;
    } else if (!hc && state.plate.stack.length === 0) {
      lookTx = layout.bowl.x;
      lookTy = layout.bowl.y;
    } else if (hc && hc.flipped >= 1 && hc.bottomCook >= 0.45) {
      lookTx = layout.plate.x;
      lookTy = layout.plate.y;
    } else if (!hc && state.plate.stack.length > 0) {
      lookTx = layout.plate.x;
      lookTy = layout.plate.y;
    }

    const desiredLX = Math.max(-2, Math.min(2, (lookTx - layout.mama.x) / 36));
    const desiredLY = Math.max(-1, Math.min(2, (lookTy - layout.mama.faceY) / 40));
    m.lookX += (desiredLX - m.lookX) * Math.min(1, dt * 8);
    m.lookY += (desiredLY - m.lookY) * Math.min(1, dt * 8);

    // Gentle idle hint ONLY after 10 seconds of complete inactivity (once per phase!)
    const phaseKey = !hc
      ? (state.plate.stack.length === 0 ? 'pour' : (state.plate.butters.length === 0 ? 'butter' : (state.plate.syrupAmount < 0.1 ? 'syrup' : 'eat')))
      : (hc.flipped === 0 ? 'flip' : 'plate');
    if (state.idleTime > 10.0 && m.hintShownForPhase !== phaseKey && m.handAction === 'rest') {
      m.hintShownForPhase = phaseKey;
      m.handAction = 'hint';
      m.handTimer = 2.6;
      m.hintProgress = 0;
      if (phaseKey === 'pour') m.hintTarget = { x: layout.bowl.x, y: layout.bowl.y };
      else if (phaseKey === 'flip') m.hintTarget = { x: layout.pan.x - 24, y: layout.pan.y + 12 };
      else if (phaseKey === 'plate') m.hintTarget = { x: layout.plate.x, y: layout.plate.y };
      else if (phaseKey === 'butter') m.hintTarget = { x: layout.butter.x, y: layout.butter.y };
      else if (phaseKey === 'syrup') m.hintTarget = { x: layout.syrup.x, y: layout.syrup.y };
      else m.hintTarget = { x: layout.fork.x, y: layout.fork.y };
    }
    if (m.handAction === 'hint') {
      m.hintProgress = Math.min(1, m.hintProgress + dt * 2.2);
      if (m.handTimer <= 0.4) {
        m.hintProgress = Math.max(0, m.hintProgress - dt * 3);
      }
      if (m.handTimer <= 0) {
        m.handAction = 'rest';
        m.hintProgress = 0;
      }
    }

    // --- Particles Update ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.vy += (pt.grav || 0) * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  // --- Render Frame (100% Pure 16-Color Crisp Pixel Art!) ---
  function render() {
    const t = state.time;

    // 1. Kitchen wall, window, wooden counter
    S.drawKitchenBackground(pb, layout, t);

    // 2. Mama (standing behind counter, hands over counter!)
    S.drawMama(pb, layout, state.mama, t);

    // 3. Stove burner, flames, interactive heat knob
    S.drawStove(pb, layout, state.heat, t, state.knobBounce);

    // 4. 1px Sprite-Stacked Cast-Iron Frying Pan
    S.drawFryingPan(pb, layout, state.pan, t);

    // 5. Active Hotcake when sitting on the pan (before plate/foreground overlap)
    const hc = state.activeCake;
    if (hc && hc.mode === 'pan') {
      S.drawHotcake(pb, hc, hc.x, hc.y - 1, t, 0, hc.scaleX, hc.scaleY);
    }

    // 6. Ceramic Plate & Wobbling 1px Sprite-Stacked Pancake Tower + Butter + Syrup + Berries
    const plateInfo = S.drawPlateAndStack(pb, layout, state.plate, t);

    // 7. Counter Objects (Batter Bowl, Butter Dish, Syrup Pitcher, Strawberry Saucer, Fork)
    S.drawBatterBowl(pb, layout, state.bowl, t);
    S.drawButterDish(pb, layout, state.butterDish, t);

    // Syrup pitcher (resting unless currently dragged or auto-pouring!)
    const syrupHeld = (state.drag && state.drag.kind === 'syrup') || !!state.syrupJug.autoPour;
    if (!syrupHeld) {
      const syGlint = state.plate.stack.length > 0 && state.plate.syrupAmount < 0.15;
      S.drawSyrupPitcher(pb, layout.syrup.x + state.syrupJug.wobbleX, layout.syrup.y, 0, false, syGlint, t);
    }

    S.drawBerrySaucer(pb, layout, state.berrySaucer, t);

    // Fork (resting beside plate unless dragged or auto-feeding!)
    const forkHeld = (state.drag && state.drag.kind === 'fork') || !!state.forkObj.autoFeed;
    if (!forkHeld) {
      S.drawFork(pb, layout.fork.x, layout.fork.y + state.forkObj.bobY, false, state.forkObj.glint, t);
    }

    // 8. Flying toppings (butter / berry arcing onto plate or pan!)
    for (let i = 0; i < state.flyingItems.length; i++) {
      const fi = state.flyingItems[i];
      const u = Math.min(1, fi.t / fi.dur);
      const fx = fi.sx + (fi.tx - fi.sx) * u;
      const fy = fi.sy + (fi.ty - fi.sy) * u - Math.sin(u * Math.PI) * 32;
      if (fi.kind === 'butter') S.drawDraggedButter(pb, fx, fy);
      else S.drawDraggedBerry(pb, fx, fy);
    }

    // 9. Mid-air Flipping or Plating Hotcake (drawn high above everything!)
    if (hc && (hc.mode === 'flip' || hc.mode === 'toPlate')) {
      const drawY = hc.mode === 'flip' ? (hc.y - hc.z) : hc.y;
      S.drawHotcake(pb, hc, hc.x, drawY, t, hc.flipAngle, hc.scaleX, hc.scaleY);
    }

    // 10. Auto animations (ladle pour / syrup pour / fork feed)
    if (state.bowl.autoPour) {
      const ap = state.bowl.autoPour;
      const u = Math.min(1, ap.t / 0.24);
      const back = ap.t > 0.36 ? Math.min(1, (ap.t - 0.36) / 0.18) : 0;
      const lx = layout.bowl.x + 6 + (layout.pan.x - (layout.bowl.x + 6)) * (back > 0 ? 1 - back : u);
      const ly = layout.bowl.y - 6 + (layout.pan.y - 22 - (layout.bowl.y - 6)) * (back > 0 ? 1 - back : u) - Math.sin(u * Math.PI) * 10;
      const pouring = ap.t >= 0.2 && ap.t <= 0.38;
      S.drawLadle(pb, lx, ly, pouring ? -0.55 : 0.2, !ap.poured || pouring, pouring);
    }

    if (state.syrupJug.autoPour) {
      const ap = state.syrupJug.autoPour;
      const u = Math.min(1, ap.t / 0.2);
      const back = ap.t > ap.dur - 0.18 ? Math.min(1, (ap.t - (ap.dur - 0.18)) / 0.18) : 0;
      const f = back > 0 ? 1 - back : u;
      const jx = layout.syrup.x + (ap.tx - layout.syrup.x) * f;
      const jy = layout.syrup.y + (ap.ty - layout.syrup.y) * f;
      const pouring = ap.t > 0.18 && ap.t < ap.dur - 0.16;
      if (pouring) {
        drawSyrupStream(jx - 7, jy + 1, ap.onPan ? layout.pan.y : plateInfo.topY);
      }
      S.drawSyrupPitcher(pb, jx, jy, pouring ? 1 : 0, pouring, false, t);
    }

    if (state.forkObj.autoFeed) {
      const af = state.forkObj.autoFeed;
      const u = Math.min(1, af.t / 0.55);
      const fx = af.sx + (layout.mama.x - af.sx) * u;
      const fy = af.sy + (layout.mama.faceY + 14 - af.sy) * u - Math.sin(u * Math.PI) * 14;
      S.drawFork(pb, fx, fy, true, false, t);
    }

    // 11. Active finger-dragged tool!
    if (state.drag) {
      const d = state.drag;
      if (d.kind === 'ladle') {
        const overPan = dist(d.x, d.y, layout.pan.x, layout.pan.y) < layout.pan.rx + 18;
        S.drawLadle(pb, d.x, d.y - 6, overPan ? -0.5 : 0.15, true, overPan);
      } else if (d.kind === 'butter') {
        S.drawDraggedButter(pb, d.x, d.y - 6);
      } else if (d.kind === 'berry') {
        S.drawDraggedBerry(pb, d.x, d.y - 6);
      } else if (d.kind === 'syrup') {
        const topPos = getPlateTopPos();
        const overPlate = state.plate.stack.length > 0 && dist(d.x, d.y, topPos.x, topPos.y - 10) < layout.plate.rx + 28;
        const overPan = !state.activeCake && dist(d.x, d.y, layout.pan.x, layout.pan.y - 10) < layout.pan.rx + 22;
        const pouring = overPlate || overPan;
        if (pouring) {
          drawSyrupStream(d.x - 7, d.y - 5, overPan ? layout.pan.y : plateInfo.topY);
        }
        S.drawSyrupPitcher(pb, d.x, d.y - 6, pouring ? 1 : 0, pouring, false, t);
      } else if (d.kind === 'fork') {
        S.drawFork(pb, d.x, d.y - 4, d.hasBite, false, t);
      }
    }

    // 12. Particles (hearts, sparkles, steam, crumbs, drops!)
    S.drawParticles(pb, state.particles);

    // 13. Apply brief screen shake via integer pixel shift & flush to canvas!
    pb.flush(ctx);
    if (state.shakeTime > 0) {
      const sx = Math.round((Math.random() - 0.5) * 2 * state.shakeMag);
      const sy = Math.round((Math.random() - 0.5) * 2 * state.shakeMag);
      canvas.style.transform = `translate(${sx * 3}px, ${sy * 3}px)`;
    } else if (canvas.style.transform) {
      canvas.style.transform = '';
    }
  }

  function drawSyrupStream(x, y0, y1) {
    x = Math.round(x);
    y0 = Math.round(y0);
    y1 = Math.max(y0 + 4, Math.round(y1));
    const wave = Math.round(Math.sin(state.time * 24));
    pb.beginScratch();
    for (let y = y0; y <= y1; y++) {
      const ox = ((y + Math.floor(state.time * 36)) & 7) < 4 ? wave : 0;
      pb.sRect(x - 1 + ox, y, 3, 1, P.MAPLE);
      pb.spx(x + ox, y, P.GOLDEN);
      if (((y + Math.floor(state.time * 40)) & 7) === 0) {
        pb.spx(x + ox, y, P.CREAM);
      }
    }
    pb.commitScratch(P.COCOA);
  }

  // --- Loop & Events ---
  let lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  computeLayout();
  window.addEventListener('resize', computeLayout);
  window.addEventListener('orientationchange', () => setTimeout(computeLayout, 120));

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: false });
  window.addEventListener('pointercancel', onPointerUp, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Prevent iOS Safari bounce/zoom gestures
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // Expose clean deterministic step API for automated QA/screenshot verification
  PP.step = function (totalSec, dt) {
    const stepDt = dt || 1 / 60;
    let rem = totalSec;
    while (rem > 0.0001) {
      const d = Math.min(stepDt, rem);
      update(d);
      rem -= d;
    }
    render();
  };
  PP.getLayout = function () { return layout; };

  requestAnimationFrame(frame);
})(window);
