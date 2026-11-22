/**
 * Procedural Web Audio Foley Synthesizer for Rice Cooking
 * Produces tactile, photorealistic kitchen sounds:
 * - Shaka-shaka wet rice washing friction + water sloshing
 * - Running faucet stream & drain pouring
 * - Inner pot metallic placement clunk & lid mechanical latch
 * - Authentic Japanese IH rice cooker harmonic chimes
 * - Warm bubbling simmer & billowing steam hiss
 * - Moist cooked rice fluffing & soft serving/topping Foley
 */
export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.unlocked = false;

    // Continuous sound nodes
    this.washGain = null;
    this.washFilter = null;
    this.sloshGain = null;
    this.sloshFilter = null;

    this.faucetGain = null;
    this.faucetFilter = null;

    this.steamGain = null;
    this.steamFilter = null;

    this.lastGrainClick = 0;
    this.lastBubbleTime = 0;
  }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._buildNoiseBuffer();
      this._initLoops();
      this.unlocked = true;
    } catch {
      // Audio unavailable
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.22) * 0.7;
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

  _initLoops() {
    // 1. Rice washing friction ("shaka-shaka")
    const washSrc = this._makeLoopNoise();
    this.washFilter = this.ctx.createBiquadFilter();
    this.washFilter.type = 'bandpass';
    this.washFilter.frequency.value = 2600;
    this.washFilter.Q.value = 1.6;
    this.washGain = this.ctx.createGain();
    this.washGain.gain.value = 0;
    washSrc.connect(this.washFilter).connect(this.washGain).connect(this.ctx.destination);

    // 2. Water slosh
    const sloshSrc = this._makeLoopNoise();
    this.sloshFilter = this.ctx.createBiquadFilter();
    this.sloshFilter.type = 'bandpass';
    this.sloshFilter.frequency.value = 680;
    this.sloshFilter.Q.value = 1.1;
    this.sloshGain = this.ctx.createGain();
    this.sloshGain.gain.value = 0;
    sloshSrc.connect(this.sloshFilter).connect(this.sloshGain).connect(this.ctx.destination);

    // 3. Faucet / Pouring stream
    const faucetSrc = this._makeLoopNoise();
    this.faucetFilter = this.ctx.createBiquadFilter();
    this.faucetFilter.type = 'bandpass';
    this.faucetFilter.frequency.value = 1150;
    this.faucetFilter.Q.value = 0.85;
    this.faucetGain = this.ctx.createGain();
    this.faucetGain.gain.value = 0;
    faucetSrc.connect(this.faucetFilter).connect(this.faucetGain).connect(this.ctx.destination);

    // 4. Steam hiss
    const steamSrc = this._makeLoopNoise();
    this.steamFilter = this.ctx.createBiquadFilter();
    this.steamFilter.type = 'highpass';
    this.steamFilter.frequency.value = 2400;
    this.steamGain = this.ctx.createGain();
    this.steamGain.gain.value = 0;
    steamSrc.connect(this.steamFilter).connect(this.steamGain).connect(this.ctx.destination);
  }

  /**
   * Modulate continuous shaka-shaka washing sound from hand swirl speed (0..1)
   */
  setWashIntensity(speedNorm, turbidity = 0.3) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const s = Math.max(0, Math.min(1, speedNorm));

    // Shaka-shaka crisp granular friction
    const washVol = s * 0.24;
    this.washGain.gain.setTargetAtTime(washVol, now, 0.045);
    this.washFilter.frequency.setTargetAtTime(2100 + s * 1500 - turbidity * 300, now, 0.05);

    // Underlying water swirl
    this.sloshGain.gain.setTargetAtTime(s * 0.16, now, 0.06);
    this.sloshFilter.frequency.setTargetAtTime(480 + s * 620, now, 0.06);

    // Micro rice grain clicks for tactile realism
    if (s > 0.18 && now - this.lastGrainClick > 0.045 / (0.5 + s)) {
      this.lastGrainClick = now;
      this._grainTick(0.03 + s * 0.04);
    }
  }

  _grainTick(vol) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const base = 1800 + Math.random() * 2400;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.45, now + 0.018);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.02);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
  }

  setWaterStream(intensity, pitch = 1150) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const v = Math.max(0, Math.min(1, intensity));
    this.faucetGain.gain.setTargetAtTime(v * 0.17, now, 0.06);
    this.faucetFilter.frequency.setTargetAtTime(pitch, now, 0.08);

    if (v > 0.25 && now - this.lastBubbleTime > 0.09 + Math.random() * 0.08) {
      this.lastBubbleTime = now;
      this.playBubble(0.035 * v, 420 + Math.random() * 480);
    }
  }

  setSteamLevel(intensity) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const v = Math.max(0, Math.min(1, intensity));
    this.steamGain.gain.setTargetAtTime(v * 0.085, now, 0.12);
    if (v > 0.35 && now - this.lastBubbleTime > 0.18 + Math.random() * 0.16) {
      this.lastBubbleTime = now;
      this.playBubble(0.04 * v, 160 + Math.random() * 140);
    }
  }

  playBubble(vol = 0.05, startFreq = 320) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.1, now + 0.065);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.075);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playSplash() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1400, now);
    f.frequency.exponentialRampToValueAtTime(520, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.2);
  }

  playPotClunk() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Heavy dull metallic pot seating into cooker
    [138, 274, 430].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.78, now + 0.18);
      g.gain.setValueAtTime(0.18 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  playLidLatch(open = false) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = open ? [620, 960] : [480, 260];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.032;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.045);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  playCookStartChime() {
    if (!this.unlocked || !this.ctx) return;
    // Gentle Japanese IH rice cooker start melody (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const t = now + i * 0.095;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playCookDoneChime() {
    if (!this.unlocked || !this.ctx) return;
    // Warm cheerful Japanese completion melody
    const notes = [783.99, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    const times = [0, 0.13, 0.26, 0.42, 0.58, 0.72];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const t = now + times[i];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  playSteamWhoosh() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1600, now);
    f.frequency.exponentialRampToValueAtTime(3400, now + 0.45);
    f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 1.2);
  }

  playFluffStroke() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(950, now);
    f.frequency.linearRampToValueAtTime(1500, now + 0.14);
    f.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.13, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.24);
  }

  playRiceDrop() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft moist mound landing in ceramic bowl + warm porcelain resonance
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.09);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.09, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(f).connect(ng).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.15);
  }

  playTopping(kind = 'sesame') {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (kind === 'umeboshi') {
      this.playBubble(0.09, 260);
      return;
    }
    const count = kind === 'nori' ? 4 : 7;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.028 + Math.random() * 0.015;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400 + Math.random() * 1800, t);
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.025);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.028);
    }
  }

  playGentleTap() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.05);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playHappyBite() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 880.0];
    notes.forEach((f, i) => {
      const t = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.075, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }
}
