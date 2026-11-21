// Synthesized real-world tactile audio engine (Web Audio API, zero external files)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.ambienceStarted = false;
    this.masterGain = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this._createNoiseBuffer(2.0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.ambienceStarted && this.ctx) {
      this.ambienceStarted = true;
      this._startSunnyAmbience();
    }
  }

  _createNoiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 1.4;
    }
    return buf;
  }

  _startSunnyAmbience() {
    if (!this.ctx) return;
    // Ultra-gentle outdoor sunlit breeze
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.018;

    // Gentle wind swell LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.011;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
    lfo.start();
  }

  // Deep satisfying "PAN! / PON!" futon beater impact
  // centerFactor: 1 at thick center (deeper PON), 0 at thin edge (snappier PAN)
  playFutonBeat(centerFactor = 0.7, fluffiness = 0.3, strength = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1.25, Math.max(0.4, strength));

    // 1. Hollow warm cotton membrane thump
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const baseFreq = 128 - centerFactor * 36 + fluffiness * 14 + (Math.random() - 0.5) * 8;
    osc.frequency.setValueAtTime(baseFreq * 1.45, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.52, t + 0.14);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, t);
    oscGain.gain.linearRampToValueAtTime(0.55 * s, t + 0.006);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18 + fluffiness * 0.05);

    const lowLP = this.ctx.createBiquadFilter();
    lowLP.type = 'lowpass';
    lowLP.frequency.value = 280 + (1 - centerFactor) * 140;

    osc.connect(lowLP);
    lowLP.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);

    // 2. Crisp fabric slap ("PA-")
    const slap = this.ctx.createBufferSource();
    slap.buffer = this.noiseBuffer;
    const slapFilter = this.ctx.createBiquadFilter();
    slapFilter.type = 'bandpass';
    slapFilter.frequency.setValueAtTime(980 + (1 - centerFactor) * 520 + (Math.random() - 0.5) * 160, t);
    slapFilter.Q.value = 1.1;

    const slapGain = this.ctx.createGain();
    slapGain.gain.setValueAtTime(0.001, t);
    slapGain.gain.linearRampToValueAtTime(0.62 * s, t + 0.004);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    slap.connect(slapFilter);
    slapFilter.connect(slapGain);
    slapGain.connect(this.masterGain);
    slap.start(t, Math.random() * 0.9, 0.12);

    // 3. Dry woven rattan cane rattle ("kakk")
    const rattan = this.ctx.createOscillator();
    rattan.type = 'sine';
    rattan.frequency.setValueAtTime(640 + Math.random() * 140, t);
    rattan.frequency.exponentialRampToValueAtTime(310, t + 0.045);
    const rGain = this.ctx.createGain();
    rGain.gain.setValueAtTime(0.14 * s, t);
    rGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    rattan.connect(rGain);
    rGain.connect(this.masterGain);
    rattan.start(t);
    rattan.stop(t + 0.06);

    // 4. Air puff whoosh of dust & cotton fibers
    const puff = this.ctx.createBufferSource();
    puff.buffer = this.noiseBuffer;
    const puffFilter = this.ctx.createBiquadFilter();
    puffFilter.type = 'bandpass';
    puffFilter.frequency.value = 420;
    puffFilter.Q.value = 0.6;
    const puffGain = this.ctx.createGain();
    puffGain.gain.setValueAtTime(0.001, t + 0.01);
    puffGain.gain.linearRampToValueAtTime(0.22 * s, t + 0.03);
    puffGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    puff.connect(puffFilter);
    puffFilter.connect(puffGain);
    puffGain.connect(this.masterGain);
    puff.start(t + 0.01, Math.random() * 0.8, 0.24);
  }

  // Heavy soft cotton fabric rustle (lifting, draping, flipping)
  playFabricWhoosh(duration = 0.42, pitch = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(320 * pitch, t);
    bp.frequency.linearRampToValueAtTime(680 * pitch, t + duration * 0.45);
    bp.frequency.linearRampToValueAtTime(260 * pitch, t + duration);
    bp.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(t, Math.random() * 0.7, duration + 0.05);
  }

  // Soft landing thump onto rail or tatami
  playSoftLand() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.38, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
    this.playFabricWhoosh(0.28, 0.85);
  }

  // Warm airy "FUWAAA..." puff-up when sun-baked futon expands on tatami
  playFluffExpand() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Gentle expanding air rustle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.exponentialRampToValueAtTime(620, t + 1.1);
    lp.frequency.exponentialRampToValueAtTime(340, t + 1.7);
    lp.Q.value = 1.0;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.75);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(t, 0.2, 1.8);

    // Subtle warm sunlit chord shimmer (very delicate, acoustic-feeling)
    const freqs = [392.0, 493.88, 587.33];
    freqs.forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = this.ctx.createGain();
      const start = t + idx * 0.12;
      og.gain.setValueAtTime(0.0001, start);
      og.gain.linearRampToValueAtTime(0.032, start + 0.35);
      og.gain.exponentialRampToValueAtTime(0.0001, start + 1.55);
      o.connect(og);
      og.connect(this.masterGain);
      o.start(start);
      o.stop(start + 1.6);
    });
  }

  // Ultra-soft "mofu!" cotton squish when pressing the fluffy futon
  playFluffySquish(strength = 0.8) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 + Math.random() * 20, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.12);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.18 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.22 * strength, t + 0.025);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.masterGain);
    src.start(t, Math.random() * 0.8, 0.22);
  }

  // Hollow brushed aluminum balcony rail tap ("KANG!")
  playRailClang() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const partials = [
      { f: 495, a: 0.18, d: 0.32 },
      { f: 1320, a: 0.11, d: 0.22 },
      { f: 2540, a: 0.06, d: 0.12 }
    ];
    for (const p of partials) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = p.f * (0.98 + Math.random() * 0.04);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(p.a, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + p.d);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + p.d + 0.02);
    }
  }

  // Crisp plastic-spring futon clip snap ("PACHI!")
  playClipSnap(clamping = true) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(clamping ? 1150 : 880, t);
    o.frequency.exponentialRampToValueAtTime(clamping ? 360 : 480, t + 0.032);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(t);
    o.stop(t + 0.045);
  }

  // Delicate Japanese glass wind chime ("CHIRIN...")
  playWindChime() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [
      { f: 2640, a: 0.085, d: 1.35 },
      { f: 2652, a: 0.065, d: 1.25 },
      { f: 5285, a: 0.032, d: 0.7 }
    ];
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = n.f * (0.99 + Math.random() * 0.02);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(n.a, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0003, t + n.d);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + n.d + 0.05);
    }
  }
}
