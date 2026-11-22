// Procedural Physical-Modeling Web Audio Engine (Zero external audio files)
export class NabeAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.masterGain = null;
    this.simmerGain = null;
    this.rainGain = null;
    this.noiseBuffer = null;
    this.boilIntensity = 0.35; // 0..1
    this._bubbleTimer = 0;
    this._rainDropTimer = 0;
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.started = true;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    // Generate 3s smooth pink/brown noise buffer
    const len = this.ctx.sampleRate * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    // 1. Cozy winter rain outside window (muffled warm indoor low-mid wash)
    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffer;
    rainSrc.loop = true;
    const rainBand = this.ctx.createBiquadFilter();
    rainBand.type = 'bandpass';
    rainBand.frequency.value = 920;
    rainBand.Q.value = 0.65;
    const rainShelf = this.ctx.createBiquadFilter();
    rainShelf.type = 'lowpass';
    rainShelf.frequency.value = 2200;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.11;
    rainSrc.connect(rainBand);
    rainBand.connect(rainShelf);
    rainShelf.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSrc.start();

    // 2. Continuous warm stove & pot convection murmur
    const simmerSrc = this.ctx.createBufferSource();
    simmerSrc.buffer = this.noiseBuffer;
    simmerSrc.loop = true;
    this.simmerFilter = this.ctx.createBiquadFilter();
    this.simmerFilter.type = 'lowpass';
    this.simmerFilter.frequency.value = 340;
    this.simmerGain = this.ctx.createGain();
    this.simmerGain.gain.value = 0.14;
    simmerSrc.connect(this.simmerFilter);
    this.simmerFilter.connect(this.simmerGain);
    this.simmerGain.connect(this.masterGain);
    simmerSrc.start();
  }

  update(dt, boilLevel, lidClosed = false) {
    if (!this.started || !this.ctx || this.ctx.state !== 'running') return;
    this.boilIntensity = boilLevel;
    const now = this.ctx.currentTime;

    const targetSimmer = (0.08 + boilLevel * 0.22) * (lidClosed ? 0.65 : 1.0);
    this.simmerGain.gain.setTargetAtTime(targetSimmer, now, 0.12);
    this.simmerFilter.frequency.setTargetAtTime(lidClosed ? 240 : (280 + boilLevel * 420), now, 0.12);

    // Procedural Minnaert boiling bubbles ("koto-koto" -> "gutsu-gutsu-gutsu!")
    const rate = 3.5 + boilLevel * 28.0; // bubbles per second
    this._bubbleTimer += dt * rate;
    let count = 0;
    while (this._bubbleTimer >= 1.0 && count < 4) {
      this._bubbleTimer -= 1.0;
      count++;
      if (Math.random() < 0.85) {
        this._triggerBubble(boilLevel, lidClosed);
      }
    }

    // Subtle individual raindrop patters on window glass
    this._rainDropTimer += dt * 4.5;
    if (this._rainDropTimer >= 1.0) {
      this._rainDropTimer -= 1.0;
      if (Math.random() < 0.45) this._triggerWindowDrop();
    }
  }

  _triggerBubble(boil, muffled) {
    const now = this.ctx.currentTime + Math.random() * 0.02;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    // Larger deep "gutsu" bubbles + smaller "poko" bubbles
    const isDeep = Math.random() < 0.45 + boil * 0.25;
    const baseFreq = isDeep
      ? 125 + Math.random() * 115
      : 280 + Math.random() * 340;
    const dur = isDeep ? 0.075 : 0.048;

    osc.frequency.setValueAtTime(baseFreq * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.68, now + dur);

    const vol = (isDeep ? 0.042 : 0.022) * (0.45 + boil * 0.85) * (muffled ? 0.55 : 1.0);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + dur * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  _triggerWindowDrop() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const f = 1400 + Math.random() * 1600;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.65, now + 0.022);
    gain.gain.setValueAtTime(0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  playPickup(type = 'veg') {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (type === 'tofu') {
      // Soft wet elastic "purun!"
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.055);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.11);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.13);
    } else if (type === 'hakusai') {
      // Crisp wet leaf rustle
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, now);
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.15, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      src.connect(bp); bp.connect(g); g.connect(this.masterGain);
      src.start(now, Math.random() * 1.5, 0.1);
    } else {
      // Plump tactile tap
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.06);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.07);
    }
  }

  playSplash(size = 1.0) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Resonant cavity plop ("dobon!" / "topun!") + splash spray
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f0 = 165 / Math.max(0.7, size);
    osc.frequency.setValueAtTime(f0 * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.68, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.95, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18 * Math.min(1.4, size), now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.17);

    // Water splash noise burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, now);
    bp.frequency.exponentialRampToValueAtTime(520, now + 0.16);
    bp.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.14 * size, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    src.connect(bp); bp.connect(ng); ng.connect(this.masterGain);
    src.start(now, Math.random() * 1.2, 0.2);
  }

  playScoop() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.10, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.14);
  }

  playPour() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Warm liquid stream + gentle ceramic bowl resonance
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(750, now);
    bp.frequency.linearRampToValueAtTime(1250, now + 0.36);
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    src.connect(bp); bp.connect(g); g.connect(this.masterGain);
    src.start(now, Math.random(), 0.45);

    // 3 little "toko-toko" liquid droplets
    for (let i = 0; i < 3; i++) {
      const t = now + 0.06 + i * 0.09;
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(320 + i * 75, t);
      o.frequency.exponentialRampToValueAtTime(560 + i * 90, t + 0.055);
      og.gain.setValueAtTime(0.06, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      o.connect(og); og.connect(this.masterGain);
      o.start(t); o.stop(t + 0.07);
    }
  }

  playCeramicClink(pitch = 1.0) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [690 * pitch, 1180 * pitch, 1890 * pitch];
    freqs.forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now);
      const dur = idx === 0 ? 0.16 : 0.07;
      g.gain.setValueAtTime((idx === 0 ? 0.08 : 0.03), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g); g.connect(this.masterGain);
      o.start(now); o.stop(now + dur + 0.01);
    });
  }

  playStoveClick(high = true) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Mechanical piezo click "kachi!" + gas flame whoosh
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(high ? 1850 : 1350, now);
    o.frequency.exponentialRampToValueAtTime(420, now + 0.018);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
    o.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 0.025);

    if (high) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(420, now + 0.02);
      lp.Q.value = 0.8;
      const wg = this.ctx.createGain();
      wg.gain.setValueAtTime(0.001, now + 0.02);
      wg.gain.linearRampToValueAtTime(0.18, now + 0.08);
      wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      src.connect(lp); lp.connect(wg); wg.connect(this.masterGain);
      src.start(now + 0.02, 0.2, 0.3);
    }
  }

  playSteamBurst() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(650, now + 0.55);
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    src.connect(bp); bp.connect(g); g.connect(this.masterGain);
    src.start(now, 0.1, 0.65);
  }

  playBlowSteam() {
    // Gentle human "fuu, fuu" breath on hot food
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.34;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(980, t);
      bp.frequency.exponentialRampToValueAtTime(720, t + 0.22);
      bp.Q.value = 2.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      src.connect(bp); bp.connect(g); g.connect(this.masterGain);
      src.start(t, Math.random(), 0.26);
    }
  }

  playHappyEat(personIdx = 1, isSpecial = false) {
    // Warm acoustic marimba/wood-chime resonance + soft contented hum/breath (natural, never robotic)
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const baseNotes = personIdx === 0
      ? [261.6, 329.6, 392.0]       // Dad: warm C4-E4-G4
      : personIdx === 1
        ? [392.0, 493.9, 587.3]     // Little Sister: bright G4-B4-D5
        : [329.6, 440.0, 523.25];   // Mom: gentle E4-A4-C5
    const notes = isSpecial ? [...baseNotes, baseNotes[0] * 2] : baseNotes;

    notes.forEach((freq, i) => {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 2, t);
      lp.type = 'lowpass';
      lp.frequency.value = 1400;

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(isSpecial ? 0.09 : 0.065, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      const g2 = this.ctx.createGain();
      g2.gain.value = 0.18;
      osc.connect(lp);
      osc2.connect(g2); g2.connect(lp);
      lp.connect(g); g.connect(this.masterGain);
      osc.start(t); osc2.start(t);
      osc.stop(t + 0.45); osc2.stop(t + 0.45);
    });
  }
}
