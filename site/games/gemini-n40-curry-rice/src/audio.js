// Rich procedural culinary Web Audio foley synthesizer
// Crafts realistic peeler scrapes, vegetable crunch + hinoki board "ton!", sizzling oil,
// simmering bubbles whose pitch & tempo slow down as curry thickens, roux snaps, and glossy pouring.

export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.unlocked = false;

    // Continuous ambient beds (sizzle + simmer + evening warmth)
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.simmerGain = null;
    this.simmerFilter = null;
    this.simmerLevel = 0;
    this.sizzleLevel = 0;
    this.viscosity = 0; // 0 = watery broth, 1 = thick viscous curry
    this.bubbleTimer = 0;
    this.sizzlePopTimer = 0;

    // Peeler continuous scrape
    this.peelGain = null;
    this.peelFilter = null;
    this.peelTarget = 0;
  }

  unlock() {
    if (this.unlocked && this.ctx && this.ctx.state === 'running') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;

      // Subtle warm kitchen compressor so loud snaps & pops stay crisp and rich
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3.2;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this._createNoiseBuffer();
      this._setupContinuousBeds();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _makeLoopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start();
    return src;
  }

  _setupContinuousBeds() {
    // 1. Sizzle bed (high-shelf crispy frying sound)
    const sSrc = this._makeLoopNoise();
    const sHP = this.ctx.createBiquadFilter();
    sHP.type = 'highpass';
    sHP.frequency.value = 2600;
    this.sizzleFilter = this.ctx.createBiquadFilter();
    this.sizzleFilter.type = 'bandpass';
    this.sizzleFilter.frequency.value = 5400;
    this.sizzleFilter.Q.value = 0.65;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.0001;
    sSrc.connect(sHP).connect(this.sizzleFilter).connect(this.sizzleGain).connect(this.master);

    // 2. Simmer low warm rumble bed (kotokoto pot resonance)
    const mSrc = this._makeLoopNoise();
    this.simmerFilter = this.ctx.createBiquadFilter();
    this.simmerFilter.type = 'bandpass';
    this.simmerFilter.frequency.value = 360;
    this.simmerFilter.Q.value = 1.4;
    this.simmerGain = this.ctx.createGain();
    this.simmerGain.gain.value = 0.0001;
    mSrc.connect(this.simmerFilter).connect(this.simmerGain).connect(this.master);

    // 3. Peeler scraping continuous filtered noise
    const pSrc = this._makeLoopNoise();
    this.peelFilter = this.ctx.createBiquadFilter();
    this.peelFilter.type = 'bandpass';
    this.peelFilter.frequency.value = 3200;
    this.peelFilter.Q.value = 2.2;
    this.peelGain = this.ctx.createGain();
    this.peelGain.gain.value = 0.0001;
    pSrc.connect(this.peelFilter).connect(this.peelGain).connect(this.master);
  }

  // Call each frame to drive continuous cooking ambience & stochastic bubbles
  update(dt, { sizzle = 0, simmer = 0, viscosity = 0, stirSpeed = 0 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    this.sizzleLevel = sizzle;
    this.simmerLevel = simmer;
    this.viscosity = viscosity;

    // Smooth sizzle bed (brightens when stirring!)
    const targetSizzle = sizzle * (0.09 + Math.min(1, stirSpeed) * 0.14);
    this.sizzleGain.gain.setTargetAtTime(Math.max(0.0001, targetSizzle), now, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(4800 + Math.min(1, stirSpeed) * 2400, now, 0.08);

    // Smooth simmer bed (deepens as viscosity increases)
    const targetSimmer = simmer * (0.075 + viscosity * 0.03);
    this.simmerGain.gain.setTargetAtTime(Math.max(0.0001, targetSimmer), now, 0.12);
    this.simmerFilter.frequency.setTargetAtTime(420 - viscosity * 190, now, 0.15);

    // Decay peeler continuous scrape automatically if not being actively updated
    this.peelGain.gain.setTargetAtTime(Math.max(0.0001, this.peelTarget), now, 0.03);
    this.peelTarget *= Math.exp(-dt * 18);

    // Stochastic frying oil pops ("pachi!")
    if (sizzle > 0.15) {
      this.sizzlePopTimer -= dt;
      if (this.sizzlePopTimer <= 0) {
        this._playSizzlePop(0.35 + Math.random() * 0.65);
        this.sizzlePopTimer = (0.08 + Math.random() * 0.24) / Math.max(0.4, sizzle + stirSpeed * 0.8);
      }
    }

    // Stochastic simmering bubbles ("poko!" -> thick "boko... bloop!")
    if (simmer > 0.15) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.playBubblePop(viscosity, 0.4 + Math.random() * 0.6);
        const rateScale = 1.0 + viscosity * 1.45; // Thick curry pops slower & heavier!
        this.bubbleTimer = (0.09 + Math.random() * 0.26) * rateScale / Math.max(0.4, simmer);
      }
    }
  }

  // Peeler tactile crisp fibrous scrape ("sha-shaa!")
  drivePeelScrape(speed, isCarrot = true) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const clamped = Math.min(1, Math.max(0, speed));
    this.peelTarget = clamped * 0.26;
    const baseFreq = isCarrot ? 3600 : 2500;
    this.peelFilter.frequency.setTargetAtTime(baseFreq + clamped * 1900, now, 0.02);
  }

  playPeelSnap(isCarrot = true) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Crisp initial skin bite
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isCarrot ? 4200 : 2900, now);
    bp.frequency.exponentialRampToValueAtTime(isCarrot ? 1900 : 1400, now + 0.065);
    bp.Q.value = 2.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.09);
  }

  playPeelDrop() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Soft damp ribbon landing on wooden board
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Kitchen knife cutting: Phase 1 cellular crisp veggie snap + Phase 2 hinoki wood board "TON!"
  playKnifeCut(isCarrot = true) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const jitter = 0.93 + Math.random() * 0.14;

    // Phase 1: Crisp fibrous slice ("saku!" / "shaku!")
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((isCarrot ? 3300 : 2100) * jitter, now);
    bp.frequency.exponentialRampToValueAtTime((isCarrot ? 1400 : 950) * jitter, now + 0.065);
    bp.Q.value = isCarrot ? 1.8 : 1.2;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(isCarrot ? 0.36 : 0.28, now + 0.007);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    nSrc.connect(bp).connect(nGain).connect(this.master);
    nSrc.start(now);
    nSrc.stop(now + 0.08);

    // Phase 2: Hinoki cutting board warm resonant wooden "TON!" (32ms later when blade touches wood)
    const hitT = now + 0.032;
    const modes = [
      { f: 245 * jitter, amp: 0.36, dur: 0.085 },
      { f: 525 * jitter, amp: 0.22, dur: 0.055 },
      { f: 960 * jitter, amp: 0.11, dur: 0.032 },
    ];
    for (const m of modes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(m.f * 1.12, hitT);
      osc.frequency.exponentialRampToValueAtTime(m.f, hitT + 0.015);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, hitT);
      g.gain.linearRampToValueAtTime(m.amp, hitT + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, hitT + m.dur);
      osc.connect(g).connect(this.master);
      osc.start(hitT);
      osc.stop(hitT + m.dur + 0.01);
    }

    // Short sharp wood-steel click transient
    const cSrc = this.ctx.createBufferSource();
    cSrc.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1650 * jitter;
    hp.Q.value = 1.4;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.32, hitT);
    cg.gain.exponentialRampToValueAtTime(0.001, hitT + 0.022);
    cSrc.connect(hp).connect(cg).connect(this.master);
    cSrc.start(hitT);
    cSrc.stop(hitT + 0.028);
  }

  // Big juicy sizzle burst when veggies drop into hot oil or water hits hot pot
  playSizzleBurst(intensity = 0.8, duration = 0.85) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(4800, now);
    hp.frequency.exponentialRampToValueAtTime(1900, now + duration);
    hp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.36 * intensity, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(hp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.05);
  }

  _playSizzlePop(intensity = 0.6) {
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200 + Math.random() * 4200;
    bp.Q.value = 3.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14 * intensity, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.025);
  }

  // Water pouring into pot (rising resonant pitch as water level rises)
  playWaterPourTick(fillFraction = 0.5) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = 360 + fillFraction * 380 + (Math.random() - 0.5) * 140;
    osc.frequency.setValueAtTime(base * 0.75, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.38, now + 0.048);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  // Individual simmering bubble pop: watery "poko!" -> viscous heavy curry "boko... bloop!"
  playBubblePop(viscosity = 0, intensity = 0.7) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const startF = (210 - viscosity * 105) * (0.85 + Math.random() * 0.35);
    const endF = startF * (1.85 - viscosity * 0.45);
    const dur = 0.055 + viscosity * 0.075;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14 * intensity * (1 + viscosity * 0.35), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.015);
  }

  // Crisp chocolate-like curry roux snap ("PAKI!")
  playRouxSnap() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400 + Math.random() * 600, now);
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.042);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.035);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.24, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(og).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // Heavy liquid splash when roux cube drops into pot ("DOBON!")
  playLiquidPlop() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Low thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);

    // Secondary water droplet bounce
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(290, now + 0.075);
    osc2.frequency.exponentialRampToValueAtTime(590, now + 0.15);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.001, now + 0.075);
    g2.gain.linearRampToValueAtTime(0.16, now + 0.09);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc2.connect(g2).connect(this.master);
    osc2.start(now + 0.075);
    osc2.stop(now + 0.19);
  }

  // Stirring wooden spatula / ladle contact + viscous swirl
  playStirSwish(viscosity = 0, intensity = 0.6) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(750 - viscosity * 340, now);
    bp.frequency.exponentialRampToValueAtTime(420 - viscosity * 160, now + 0.14);
    bp.Q.value = 1.6 + viscosity * 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16 * intensity, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.16);
  }

  // Thick glossy curry pour onto rice ("toro~ri")
  playCurryPour() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const f0 = 155 + i * 24 + Math.random() * 25;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.42, t + 0.095);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.12);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 520;
    lp.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.14, now + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(lp).connect(ng).connect(this.master);
    src.start(now);
    src.stop(now + 0.48);
  }

  // Secondary playful physical taps (wood, pot iron, ceramic plate, spoon munch)
  playTap(material = 'wood') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;
    if (material === 'ceramic') {
      [1820, 3260].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * jitter;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(idx === 0 ? 0.15 : 0.08, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.2);
      });
    } else if (material === 'pot') {
      [340, 710, 1180].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f * jitter;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.16 / (idx + 1), now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.24);
      });
    } else {
      // Warm hinoki wood knock
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(210 * jitter, now + 0.045);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }

  // Happy bite / munch sound on finished curry
  playMunch() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Soft metallic spoon clink + warm happy marimba two-note rise
    this.playTap('ceramic');
    [523.25, 659.25].forEach((freq, i) => {
      const t = now + 0.06 + i * 0.09;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // Warm cozy acoustic completion chord when curry rice is plated
  playWarmChord() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99]; // G major warm evening resonance
    notes.forEach((f, i) => {
      const t = now + i * 0.09;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.85);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }
}
