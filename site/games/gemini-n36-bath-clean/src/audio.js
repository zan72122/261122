/**
 * Tactile Procedural Web Audio Engine
 * Zero external files — crisp bathroom foley + warm marimba/celesta chimes.
 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

export class BathAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.master = null;

    // Continuous loop nodes
    this.showerGain = null;
    this.showerFilter = null;
    this.faucetGain = null;
    this.faucetFilter = null;
    this.faucetTone = null;
    this.faucetToneGain = null;
    this.scrubGain = null;
    this.scrubFilter = null;
    this.fizzGain = null;

    this.lastScrubSqueak = 0;
    this.lastGurgle = 0;
    this.noteIdx = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);

      // 2-second white noise buffer
      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr * 2, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this._setupContinuousLoops();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _setupContinuousLoops() {
    const ctx = this.ctx;

    // 1. Shower spray loop
    const showerSrc = ctx.createBufferSource();
    showerSrc.buffer = this.noiseBuffer;
    showerSrc.loop = true;
    this.showerFilter = ctx.createBiquadFilter();
    this.showerFilter.type = 'bandpass';
    this.showerFilter.frequency.value = 2600;
    this.showerFilter.Q.value = 0.75;
    this.showerGain = ctx.createGain();
    this.showerGain.gain.value = 0;
    showerSrc.connect(this.showerFilter);
    this.showerFilter.connect(this.showerGain);
    this.showerGain.connect(this.master);
    showerSrc.start();

    // 2. Faucet pouring loop (water rush + resonant rising tub pitch)
    const faucetSrc = ctx.createBufferSource();
    faucetSrc.buffer = this.noiseBuffer;
    faucetSrc.loop = true;
    this.faucetFilter = ctx.createBiquadFilter();
    this.faucetFilter.type = 'bandpass';
    this.faucetFilter.frequency.value = 720;
    this.faucetFilter.Q.value = 1.6;
    this.faucetGain = ctx.createGain();
    this.faucetGain.gain.value = 0;
    faucetSrc.connect(this.faucetFilter);
    this.faucetFilter.connect(this.faucetGain);
    this.faucetGain.connect(this.master);
    faucetSrc.start();

    this.faucetTone = ctx.createOscillator();
    this.faucetTone.type = 'sine';
    this.faucetTone.frequency.value = 220;
    this.faucetToneGain = ctx.createGain();
    this.faucetToneGain.gain.value = 0;
    this.faucetTone.connect(this.faucetToneGain);
    this.faucetToneGain.connect(this.master);
    this.faucetTone.start();

    // 3. Sponge scrub loop
    const scrubSrc = ctx.createBufferSource();
    scrubSrc.buffer = this.noiseBuffer;
    scrubSrc.loop = true;
    this.scrubFilter = ctx.createBiquadFilter();
    this.scrubFilter.type = 'bandpass';
    this.scrubFilter.frequency.value = 1100;
    this.scrubFilter.Q.value = 2.4;
    this.scrubGain = ctx.createGain();
    this.scrubGain.gain.value = 0;
    scrubSrc.connect(this.scrubFilter);
    this.scrubFilter.connect(this.scrubGain);
    this.scrubGain.connect(this.master);
    scrubSrc.start();

    // 4. Bath bomb fizz loop
    const fizzSrc = ctx.createBufferSource();
    fizzSrc.buffer = this.noiseBuffer;
    fizzSrc.loop = true;
    const fizzFilter = ctx.createBiquadFilter();
    fizzFilter.type = 'highpass';
    fizzFilter.frequency.value = 3400;
    this.fizzGain = ctx.createGain();
    this.fizzGain.gain.value = 0;
    fizzSrc.connect(fizzFilter);
    fizzFilter.connect(this.fizzGain);
    this.fizzGain.connect(this.master);
    fizzSrc.start();
  }

  setScrub(intensity, speed = 0) {
    if (!this.ctx || !this.scrubGain) return;
    const t = this.ctx.currentTime;
    const clamped = Math.min(1, Math.max(0, intensity));
    this.scrubGain.gain.setTargetAtTime(clamped * 0.2, t, 0.03);
    this.scrubFilter.frequency.setTargetAtTime(800 + Math.min(1800, speed * 260), t, 0.04);

    // Occasional cheerful bubbly squeak when scrubbing briskly
    if (clamped > 0.35 && speed > 1.8 && t - this.lastScrubSqueak > 0.16) {
      this.lastScrubSqueak = t;
      this.playBubblePop(0.55 + Math.random() * 0.5, 0.12);
    }
  }

  setShower(active, hittingFoam = false) {
    if (!this.ctx || !this.showerGain) return;
    const t = this.ctx.currentTime;
    this.showerGain.gain.setTargetAtTime(active ? 0.24 : 0, t, 0.045);
    this.showerFilter.frequency.setTargetAtTime(hittingFoam ? 3200 : 2300, t, 0.06);

    if (active && hittingFoam && t - this.lastGurgle > 0.24) {
      this.lastGurgle = t;
      this.playDrainGurgle(0.14);
    }
  }

  setFaucet(active, waterLevel = 0) {
    if (!this.ctx || !this.faucetGain) return;
    const t = this.ctx.currentTime;
    this.faucetGain.gain.setTargetAtTime(active ? 0.28 : 0, t, 0.05);
    // Rising acoustic pitch as the tub fills up!
    const freq = 480 + waterLevel * 920;
    this.faucetFilter.frequency.setTargetAtTime(freq, t, 0.08);
    this.faucetTone.frequency.setTargetAtTime(195 + waterLevel * 280, t, 0.08);
    this.faucetToneGain.gain.setTargetAtTime(active ? 0.035 : 0, t, 0.06);
  }

  setFizz(intensity) {
    if (!this.ctx || !this.fizzGain) return;
    const t = this.ctx.currentTime;
    this.fizzGain.gain.setTargetAtTime(Math.min(1, Math.max(0, intensity)) * 0.16, t, 0.08);
  }

  playBubblePop(pitchMul = 1, vol = 0.22) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = (360 + Math.random() * 260) * pitchMul;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2.15, t + 0.065);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playMusicalPop() {
    if (!this.ctx) return;
    this.playBubblePop(1.15, 0.18);
    const freq = PENTATONIC[this.noteIdx % PENTATONIC.length];
    this.noteIdx++;
    this._playBell(freq, 0.16, 0.34);
  }

  playSoapSquirt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  playDrainGurgle(vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f = 170 + Math.random() * 140;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.07);
    osc.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.14);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  playPlugPop(closing = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    if (closing) {
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.11);
    } else {
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(580, t + 0.09);
    }
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playSplash(big = true) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // Low water kerplunk thump
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(big ? 190 : 280, t);
    osc.frequency.exponentialRampToValueAtTime(big ? 75 : 130, t + 0.14);
    og.gain.setValueAtTime(big ? 0.34 : 0.2, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);

    // Sparkling splash burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(big ? 1600 : 2200, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + (big ? 0.38 : 0.22));
    filter.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(big ? 0.36 : 0.22, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.42 : 0.24));
    src.connect(filter);
    filter.connect(ng);
    ng.connect(this.master);
    src.start(t);
    src.stop(t + 0.45);
  }

  /**
   * Cheerful rubber-duck squeak-quack (baby=true for cute high peep)
   */
  playDuckQuack(baby = false, shy = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    const base = baby ? 820 + Math.random() * 140 : 410 + Math.random() * 45;
    const dur = shy ? 0.13 : baby ? 0.15 : 0.22;

    osc.frequency.setValueAtTime(base * 0.92, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.24, t + dur * 0.35);
    osc.frequency.exponentialRampToValueAtTime(base * 0.86, t + dur);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baby ? 2100 : 1250, t);
    filter.frequency.exponentialRampToValueAtTime(baby ? 2900 : 1750, t + dur * 0.4);
    filter.frequency.exponentialRampToValueAtTime(baby ? 1700 : 950, t + dur);
    filter.Q.value = 3.2;

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(shy ? 0.16 : 0.28, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  playWobbleTap(pitch = 480) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, t + 0.08);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playStageSparkle(grand = false) {
    if (!this.ctx) return;
    const notes = grand
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
      : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this._playBell(f, grand ? 0.2 : 0.16, 0.55, idx * 0.075);
    });
  }

  playDroplet() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(1420, t + 0.055);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  _playBell(freq, vol = 0.18, dur = 0.4, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
