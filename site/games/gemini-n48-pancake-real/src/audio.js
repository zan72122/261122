/**
 * Procedural WebAudio tactile kitchen soundscape (zero external files).
 * Automatically unlocks on first touch/pointer gesture.
 */
export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.syrupGain = null;
    this.syrupFilter = null;
    this.targetSizzle = 0;
    this.targetSyrup = 0;
    this.ready = false;
  }

  unlock() {
    if (this.ready) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      // 2 seconds of crisp noise for sizzle, steam, pour
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 2, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;

      // Continuous pan sizzle loop
      const sSrc = this.ctx.createBufferSource();
      sSrc.buffer = buf;
      sSrc.loop = true;

      this.sizzleFilter = this.ctx.createBiquadFilter();
      this.sizzleFilter.type = 'bandpass';
      this.sizzleFilter.frequency.value = 3400;
      this.sizzleFilter.Q.value = 0.7;

      const sHigh = this.ctx.createBiquadFilter();
      sHigh.type = 'highpass';
      sHigh.frequency.value = 1400;

      this.sizzleGain = this.ctx.createGain();
      this.sizzleGain.gain.value = 0;

      sSrc.connect(this.sizzleFilter);
      this.sizzleFilter.connect(sHigh);
      sHigh.connect(this.sizzleGain);
      this.sizzleGain.connect(this.ctx.destination);
      sSrc.start();

      // Continuous viscous maple syrup trickle loop
      const sySrc = this.ctx.createBufferSource();
      sySrc.buffer = buf;
      sySrc.loop = true;

      this.syrupFilter = this.ctx.createBiquadFilter();
      this.syrupFilter.type = 'bandpass';
      this.syrupFilter.frequency.value = 680;
      this.syrupFilter.Q.value = 3.2;

      this.syrupGain = this.ctx.createGain();
      this.syrupGain.gain.value = 0;

      sySrc.connect(this.syrupFilter);
      this.syrupFilter.connect(this.syrupGain);
      this.syrupGain.connect(this.ctx.destination);
      sySrc.start();

      this.ready = true;
    } catch {
      // Audio unavailable
    }
  }

  updateContinuous(dt, { sizzleIntensity = 0, sizzleBright = 0.5, syrupFlow = 0, time = 0 }) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const clampedSiz = Math.max(0, Math.min(1, sizzleIntensity));
    const flicker = 0.86 + 0.14 * Math.sin(time * 23.0) * Math.cos(time * 13.7);
    this.sizzleGain.gain.setTargetAtTime(clampedSiz * 0.085 * flicker, now, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(2200 + sizzleBright * 2800, now, 0.12);

    const clampedSyr = Math.max(0, Math.min(1, syrupFlow));
    this.syrupGain.gain.setTargetAtTime(clampedSyr * 0.09, now, 0.06);
    this.syrupFilter.frequency.setTargetAtTime(520 + Math.sin(time * 9.5) * 140 + clampedSyr * 220, now, 0.06);
  }

  /** Thick creamy batter pour + immediate hot-skillet sizzle burst */
  playBatterPour() {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Creamy low-mid glug
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.34);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // Hot skillet "juwaaa" splash
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(3200, now);
    f.frequency.exponentialRampToValueAtTime(1900, now + 0.55);
    f.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.16, now + 0.06);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    src.connect(f);
    f.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.65);
  }

  /** Delicate realistic batter bubble pop ("puku!") */
  playBubblePop(size = 0.6) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const base = 360 + (1 - size) * 280 + Math.random() * 110;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.15, now + 0.048);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.045 + size * 0.035, now + 0.009);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.058);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  /** Dramatic skillet toss whoosh */
  playFlipToss() {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(340, now);
    f.frequency.exponentialRampToValueAtTime(1150, now + 0.16);
    f.frequency.exponentialRampToValueAtTime(420, now + 0.34);
    f.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    src.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.38);
  }

  /** Satisfying pancake catch thwump + fresh sizzle */
  playFlipLand() {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.12);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2800;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.13, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    src.connect(f);
    f.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.38);
  }

  /** Soft fluffy pancake landing onto stoneware stack */
  playPlateStack(stackCount = 1) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190 + stackCount * 18, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Subtle warm ceramic resonance
    const clink = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clink.type = 'sine';
    clink.frequency.value = 1120;
    cg.gain.setValueAtTime(0.025, now);
    cg.gain.exponentialRampToValueAtTime(0.0005, now + 0.18);
    clink.connect(cg);
    cg.connect(this.ctx.destination);
    clink.start(now);
    clink.stop(now + 0.2);
  }

  /** Cold butter pat plop + warm melting hiss */
  playButterDrop() {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.08);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3200;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now + 0.03);
    ng.gain.linearRampToValueAtTime(0.055, now + 0.14);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    src.connect(f);
    f.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.75);
  }

  /** Crisp ceramic/wooden tap or stove knob click */
  playSoftClick(pitch = 780) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.55, now + 0.045);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Warm musical acoustic delight chord (when Mama cheers or tastes) */
  playWarmDelight(big = false) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = big ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.48);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  /** Soft fluffy pancake bite + gentle ceramic fork clink */
  playHappyBite() {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft metallic fork clink
    const clink = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(1680, now);
    clink.frequency.exponentialRampToValueAtTime(1420, now + 0.14);
    cg.gain.setValueAtTime(0.035, now);
    cg.gain.exponentialRampToValueAtTime(0.0005, now + 0.16);
    clink.connect(cg);
    cg.connect(this.ctx.destination);
    clink.start(now);
    clink.stop(now + 0.18);

    // Warm cheerful 2-note chime
    [659.25, 880.0].forEach((freq, idx) => {
      const t = now + 0.09 + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.36);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }
}
