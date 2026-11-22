// Procedural Web Audio API kitchen foley & warm acoustic feedback (zero external files)

export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;

    // Continuous sizzle node
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.sizzleHighGain = null;
    this.sizzleActive = false;

    // Continuous whisk node
    this.whiskGain = null;
    this.whiskFilter = null;
    this.whiskPhase = 0;

    // Continuous flame bed
    this.flameGain = null;
    this.flameFilter = null;

    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked && this.ctx && this.ctx.state === 'running') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;

      // Warm compressor to prevent clipping when layers combine
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer(2.0);
      this._setupContinuousLayers();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _setupContinuousLayers() {
    // 1. Pan sizzle continuous bed
    const sSrc = this.ctx.createBufferSource();
    sSrc.buffer = this.noiseBuffer;
    sSrc.loop = true;

    const sBand = this.ctx.createBiquadFilter();
    sBand.type = 'bandpass';
    sBand.frequency.value = 3400;
    sBand.Q.value = 0.85;

    const sHigh = this.ctx.createBiquadFilter();
    sHigh.type = 'highpass';
    sHigh.frequency.value = 5200;

    this.sizzleFilter = sBand;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.0001;

    this.sizzleHighGain = this.ctx.createGain();
    this.sizzleHighGain.gain.value = 0.0001;

    sSrc.connect(sBand);
    sBand.connect(this.sizzleGain);
    this.sizzleGain.connect(this.master);

    sSrc.connect(sHigh);
    sHigh.connect(this.sizzleHighGain);
    this.sizzleHighGain.connect(this.master);
    sSrc.start();

    // 2. Gas flame soft warm rumble
    const fSrc = this.ctx.createBufferSource();
    fSrc.buffer = this.noiseBuffer;
    fSrc.loop = true;

    const fLow = this.ctx.createBiquadFilter();
    fLow.type = 'bandpass';
    fLow.frequency.value = 240;
    fLow.Q.value = 1.4;

    this.flameFilter = fLow;
    this.flameGain = this.ctx.createGain();
    this.flameGain.gain.value = 0.0001;

    fSrc.connect(fLow);
    fLow.connect(this.flameGain);
    this.flameGain.connect(this.master);
    fSrc.start();

    // 3. Whisking wet swirl bed
    const wSrc = this.ctx.createBufferSource();
    wSrc.buffer = this.noiseBuffer;
    wSrc.loop = true;

    const wBand = this.ctx.createBiquadFilter();
    wBand.type = 'bandpass';
    wBand.frequency.value = 1100;
    wBand.Q.value = 2.0;

    this.whiskFilter = wBand;
    this.whiskGain = this.ctx.createGain();
    this.whiskGain.gain.value = 0.0001;

    wSrc.connect(wBand);
    wBand.connect(this.whiskGain);
    this.whiskGain.connect(this.master);
    wSrc.start();
  }

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Hollow crisp "kon!" eggshell tap against stoneware rim
  playEggTap(pitchScale = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    // Ceramic ring + hollow eggshell knock
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1180 * pitchScale, t);
    osc.frequency.exponentialRampToValueAtTime(520 * pitchScale, t + 0.055);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);

    // Subtle crisp shell click
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2800 * pitchScale;
    f.Q.value = 3.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.032);

    n.connect(f);
    f.connect(ng);
    ng.connect(this.master);
    n.start(t);
    n.stop(t + 0.04);
  }

  // Crisp "paka!" shell crack followed by glossy wet "plop!"
  playEggCrack() {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    // Crisp multi-micro-fracture crackle
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.018;
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 3200 + i * 750;
      f.Q.value = 2.6;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.26 - i * 0.05, t + offset);
      ng.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.028);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.master);
      n.start(t + offset);
      n.stop(t + offset + 0.035);
    }

    // Wet juicy plop 0.14s later when yolk lands in bowl
    const plopT = t + 0.15;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, plopT);
    osc.frequency.exponentialRampToValueAtTime(490, plopT + 0.055);
    osc.frequency.exponentialRampToValueAtTime(280, plopT + 0.12);

    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.001, plopT);
    pg.gain.linearRampToValueAtTime(0.28, plopT + 0.015);
    pg.gain.exponentialRampToValueAtTime(0.001, plopT + 0.14);

    osc.connect(pg);
    pg.connect(this.master);
    osc.start(plopT);
    osc.stop(plopT + 0.15);
  }

  // Warm marimba shimmer for rare double yolk or delightful moment
  playSparkleChime(notes = [523.25, 659.25, 783.99, 1046.5]) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    notes.forEach((freq, idx) => {
      const st = t + idx * 0.075;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);

      const over = this.ctx.createOscillator();
      over.type = 'triangle';
      over.frequency.setValueAtTime(freq * 2, st);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.14, st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.42);

      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.03, st);
      og.gain.exponentialRampToValueAtTime(0.0005, st + 0.16);

      osc.connect(g);
      over.connect(og);
      og.connect(g);
      g.connect(this.master);

      osc.start(st);
      over.start(st);
      osc.stop(st + 0.45);
      over.stop(st + 0.2);
    });
  }

  // Ingredient add foley (negi sprinkle, nori rustle, dashi liquid pour)
  playAddIngredient(type) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    if (type === 'dashi') {
      // Liquid splash bubbles
      for (let i = 0; i < 4; i++) {
        const st = t + i * 0.055;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340 + i * 70, st);
        osc.frequency.exponentialRampToValueAtTime(640 + i * 95, st + 0.05);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.065);
        osc.connect(g);
        g.connect(this.master);
        osc.start(st);
        osc.stop(st + 0.07);
      }
    } else if (type === 'nori') {
      // Crisp dry seaweed rustle
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 3400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      n.connect(f);
      f.connect(g);
      g.connect(this.master);
      n.start(t);
      n.stop(t + 0.18);
    } else {
      // Fresh chopped negi pat-pat sprinkle
      for (let i = 0; i < 5; i++) {
        const st = t + i * 0.035;
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuffer;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1800 + Math.random() * 1400;
        f.Q.value = 2.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.11, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.03);
        n.connect(f);
        f.connect(g);
        g.connect(this.master);
        n.start(st);
        n.stop(st + 0.04);
      }
    }
    this.playWarmNote(type === 'dashi' ? 440 : type === 'nori' ? 523.25 : 587.33, 0.08);
  }

  // Dynamic whisking "shaka-shaka" driven by stir speed (0..1)
  updateWhisk(speed, dt) {
    if (!this.ctx || !this.whiskGain) return;
    const t = this._now();
    const clamped = Math.max(0, Math.min(1, speed));
    this.whiskPhase += dt * (8 + clamped * 22);
    const pulse = 0.55 + 0.45 * Math.sin(this.whiskPhase);
    const targetGain = clamped > 0.04 ? clamped * 0.18 * pulse : 0.0001;
    this.whiskGain.gain.setTargetAtTime(targetGain, t, 0.035);
    this.whiskFilter.frequency.setTargetAtTime(900 + clamped * 1600 + pulse * 400, t, 0.04);

    // Occasional gentle chopstick-on-ceramic clink during vigorous whisking
    if (clamped > 0.25 && Math.random() < dt * (2.5 + clamped * 6.0)) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1650 + Math.random() * 550, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.035 * clamped, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.045);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  // Stove knob mechanical click + gas whoosh
  playStoveKnob(heatLevel) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    // Mechanical detent click
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420 + heatLevel * 120, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.025);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.035);

    // Soft flame whoosh
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(220 + heatLevel * 140, t);
    f.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.16, t + 0.04);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.master);
    n.start(t);
    n.stop(t + 0.25);
  }

  // Continuous gas flame + frying pan sizzle controller
  setCookingBed(flameLevel, sizzleIntensity, wetness = 0.5) {
    if (!this.ctx || !this.sizzleGain) return;
    const t = this._now();
    const fl = Math.max(0, Math.min(1, flameLevel));
    this.flameGain.gain.setTargetAtTime(fl > 0.01 ? 0.035 + fl * 0.055 : 0.0001, t, 0.1);
    this.flameFilter.frequency.setTargetAtTime(190 + fl * 170, t, 0.1);

    const sz = Math.max(0, Math.min(1, sizzleIntensity));
    this.sizzleGain.gain.setTargetAtTime(sz > 0.01 ? sz * 0.20 : 0.0001, t, 0.08);
    this.sizzleHighGain.gain.setTargetAtTime(sz > 0.01 ? sz * (0.07 + wetness * 0.09) : 0.0001, t, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(2600 + wetness * 1800, t, 0.1);
  }

  // Pouring liquid egg into hot pan: glossy pour + dramatic "JUUUU!!"
  playPourSizzle(heatLevel = 1) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    // Big rising sizzle burst
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1900, t);
    f.frequency.linearRampToValueAtTime(4200 + heatLevel * 700, t + 0.35);
    f.Q.value = 0.75;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24 + heatLevel * 0.05, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.02, t + 1.05);

    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + 1.1);
  }

  playBubblePop() {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360 + Math.random() * 140, t);
    osc.frequency.exponentialRampToValueAtTime(880 + Math.random() * 200, t + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Soft silicone spatula sliding & folding egg
  playRollFold(layerIndex = 0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.linearRampToValueAtTime(680, t + 0.16);
    f.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + 0.22);

    const scale = [392.0, 440.0, 523.25];
    this.playWarmNote(scale[layerIndex % scale.length], 0.10);
  }

  // Soft squishy press & hop onto cutting board
  playFlipToBoard() {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(92, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);

    this.playSparkleChime([523.25, 659.25, 783.99]);
  }

  // Crisp "saku-ton!" knife cutting through fluffy tamagoyaki onto hinoki wood
  playKnifeCut(sliceIndex = 0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    // Soft slice hiss
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2400;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.09, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.master);
    n.start(t);
    n.stop(t + 0.085);

    // Warm hinoki wood "TON!" tap 0.045s later
    const wt = t + 0.045;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340 + sliceIndex * 22, wt);
    osc.frequency.exponentialRampToValueAtTime(145, wt + 0.055);
    const wg = this.ctx.createGain();
    wg.gain.setValueAtTime(0.001, wt);
    wg.gain.linearRampToValueAtTime(0.32, wt + 0.004);
    wg.gain.exponentialRampToValueAtTime(0.001, wt + 0.08);
    osc.connect(wg);
    wg.connect(this.master);
    osc.start(wt);
    osc.stop(wt + 0.09);

    const pent = [523.25, 587.33, 659.25, 783.99, 880.0];
    this.playWarmNote(pent[sliceIndex % pent.length], 0.09);
  }

  // Cozy bento placement "poku!"
  playBentoPlace(count = 0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 + count * 35, t);
    osc.frequency.exponentialRampToValueAtTime(160 + count * 20, t + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);

    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
    this.playWarmNote(notes[count % notes.length], 0.13);
  }

  // Playful ketchup squeeze
  playKetchupSquirt() {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.15);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 950;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  // Gentle "fuu" blow + happy "mogu-mogu" chewing + warm celebratory melody
  playHappyEat() {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();

    // Soft blow "fuu"
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 920;
    f.Q.value = 3.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.11, t + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.master);
    n.start(t);
    n.stop(t + 0.30);

    // Two soft cute munch pops
    [0.36, 0.56].forEach((delay, idx) => {
      const mt = t + delay;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(310 + idx * 50, mt);
      osc.frequency.exponentialRampToValueAtTime(175, mt + 0.065);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.17, mt);
      g.gain.exponentialRampToValueAtTime(0.001, mt + 0.08);
      osc.connect(g);
      g.connect(this.master);
      osc.start(mt);
      osc.stop(mt + 0.09);
    });

    // Joyful warm marimba phrase
    setTimeout(() => {
      this.playSparkleChime([523.25, 659.25, 783.99, 1046.5, 1318.5]);
    }, 340);
  }

  // Subtle physical clink when tapping an object not in the current active step
  playGentleClink(material = 'wood') {
    this.unlock();
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = material === 'metal' ? 'sine' : 'triangle';
    const base = material === 'metal' ? 1480 : material === 'ceramic' ? 980 : 420;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.65, t + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playWarmNote(freq, volume = 0.1) {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.32);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
