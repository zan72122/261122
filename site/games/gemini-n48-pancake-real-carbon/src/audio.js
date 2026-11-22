// Procedural tactile foley & warm morning kitchen soundscape (zero external assets, zero speech/text)

export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.pourGain = null;
    this.pourFilter = null;
    this.syrupGain = null;
    this.birdTimer = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this._setupContinuousNodes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer(seconds = 2.0) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Pink-ish warm noise with tiny crisp crackles for realistic pan butter sizzle
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      const crackle = Math.random() < 0.0045 ? (Math.random() * 2 - 1) * 2.2 : 0;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 0.14 + crackle));
    }
    return buf;
  }

  _setupContinuousNodes() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.noiseBuf = this._createNoiseBuffer(2.5);

    // Continuous pan sizzle loop
    const sizzleSrc = ctx.createBufferSource();
    sizzleSrc.buffer = this.noiseBuf;
    sizzleSrc.loop = true;

    this.sizzleFilter = ctx.createBiquadFilter();
    this.sizzleFilter.type = 'bandpass';
    this.sizzleFilter.frequency.value = 2600;
    this.sizzleFilter.Q.value = 0.85;

    const sizzleHigh = ctx.createBiquadFilter();
    sizzleHigh.type = 'highshelf';
    sizzleHigh.frequency.value = 4800;
    sizzleHigh.gain.value = 5.0;

    this.sizzleGain = ctx.createGain();
    this.sizzleGain.gain.value = 0.0;

    sizzleSrc.connect(this.sizzleFilter);
    this.sizzleFilter.connect(sizzleHigh);
    sizzleHigh.connect(this.sizzleGain);
    this.sizzleGain.connect(this.master);
    sizzleSrc.start();

    // Continuous batter pouring sound
    const pourSrc = ctx.createBufferSource();
    pourSrc.buffer = this.noiseBuf;
    pourSrc.loop = true;

    this.pourFilter = ctx.createBiquadFilter();
    this.pourFilter.type = 'lowpass';
    this.pourFilter.frequency.value = 420;
    this.pourFilter.Q.value = 2.4;

    this.pourGain = ctx.createGain();
    this.pourGain.gain.value = 0.0;

    pourSrc.connect(this.pourFilter);
    this.pourFilter.connect(this.pourGain);
    this.pourGain.connect(this.master);
    pourSrc.start();

    // Continuous syrup pouring sound (silky warm liquid)
    const syrupSrc = ctx.createBufferSource();
    syrupSrc.buffer = this.noiseBuf;
    syrupSrc.loop = true;

    const syrupFilter = ctx.createBiquadFilter();
    syrupFilter.type = 'bandpass';
    syrupFilter.frequency.value = 680;
    syrupFilter.Q.value = 3.2;

    this.syrupGain = ctx.createGain();
    this.syrupGain.gain.value = 0.0;

    syrupSrc.connect(syrupFilter);
    syrupFilter.connect(this.syrupGain);
    this.syrupGain.connect(this.master);
    syrupSrc.start();
  }

  update(dt, { sizzleLevel = 0, pourLevel = 0, syrupLevel = 0 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    if (this.sizzleGain) {
      const target = Math.max(0, Math.min(0.28, sizzleLevel * 0.22));
      this.sizzleGain.gain.setTargetAtTime(target, t, 0.08);
      this.sizzleFilter.frequency.setTargetAtTime(2100 + sizzleLevel * 1500, t, 0.12);
    }
    if (this.pourGain) {
      this.pourGain.gain.setTargetAtTime(pourLevel * 0.22, t, 0.05);
      this.pourFilter.frequency.setTargetAtTime(340 + pourLevel * 280 + Math.sin(t * 9) * 45, t, 0.06);
    }
    if (this.syrupGain) {
      this.syrupGain.gain.setTargetAtTime(syrupLevel * 0.12, t, 0.06);
    }

    // Occasional distant peaceful morning bird outside the sunlit window
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 7.5 + Math.random() * 9.0;
      this._playDistantMorningBird();
    }
  }

  _playDistantMorningBird() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < notes; i++) {
      const start = t + i * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const base = 2450 + Math.random() * 550;
      osc.frequency.setValueAtTime(base, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.24, start + 0.065);
      osc.frequency.exponentialRampToValueAtTime(base * 0.96, start + 0.12);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.014, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.14);
    }
  }

  playBubblePop(size = 0.6, manual = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const f0 = (manual ? 460 : 380) + (1 - size) * 320 + Math.random() * 90;
    osc.frequency.setValueAtTime(f0 * 0.72, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.65, t + 0.048);
    const vol = manual ? 0.16 : 0.065;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.068);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  playPanSlide(intensity = 0.5) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150 + intensity * 700, t);
    filter.Q.value = 2.6;
    const gain = this.ctx.createGain();
    const peak = Math.min(0.14, 0.04 + intensity * 0.1);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t, Math.random() * 1.2, 0.16);
  }

  playFlipToss(strength = 1.0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    // Airy whoosh + cast-iron lift
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(980 + strength * 420, t + 0.18);
    filter.Q.value = 1.4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t, 0.2, 0.3);

    // Subtle rising pitch breath
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(390 + strength * 110, t + 0.22);
    oGain.gain.setValueAtTime(0.001, t);
    oGain.gain.linearRampToValueAtTime(0.06, t + 0.05);
    oGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.25);
    osc.connect(oGain);
    oGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  playSizzleBurst(strength = 1.0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    // Soft sponge thud + crisp juwaaa sizzle burst!
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(145, t);
    thud.frequency.exponentialRampToValueAtTime(58, t + 0.11);
    thudGain.gain.setValueAtTime(0.22 * strength, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    thud.connect(thudGain);
    thudGain.connect(this.master);
    thud.start(t);
    thud.stop(t + 0.14);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(2100, t + 0.55);
    bp.Q.value = 0.7;
    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.001, t);
    sGain.gain.linearRampToValueAtTime(0.28 * strength, t + 0.03);
    sGain.gain.exponentialRampToValueAtTime(0.002, t + 0.62);
    src.connect(bp);
    bp.connect(sGain);
    sGain.connect(this.master);
    src.start(t, Math.random() * 0.8, 0.65);
  }

  playStackBounce(stackIndex = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const base = 175 + stackIndex * 28;
    osc.frequency.setValueAtTime(base * 0.78, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.18, t + 0.055);
    osc.frequency.exponentialRampToValueAtTime(base * 0.92, t + 0.15);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.20, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  playButterPat() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(165, t + 0.08);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playSyrupDrop() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(590, t + 0.065);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.075, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.085);
  }

  playHappyWarmChord() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    // Soft acoustic Rhodes/celesta-like warm morning notes
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const start = t + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.0005, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.65);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.68);
    });
  }

  playBite() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    // Crispy-fluffy bite foley + happy warm two-note hum
    for (let k = 0; k < 2; k++) {
      const st = t + k * 0.09;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1650 - k * 350;
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.16, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.085);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(st, Math.random(), 0.1);
    }

    const notes = [440, 554.37, 659.25];
    notes.forEach((f, idx) => {
      const st = t + 0.14 + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.065, st + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.36);
      osc.connect(g);
      g.connect(this.master);
      osc.start(st);
      osc.stop(st + 0.38);
    });
  }
}
