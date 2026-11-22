// Tactile Web Audio Foley Synthesizer (zero external audio files, instant <20ms latency)

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.lastSpreadAt = 0;
    this.lastSliceAt = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.noiseBuffer = this._createNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.12) * 0.8;
    }
    return buf;
  }

  // Soft velvety whipped-cream spreading sound
  playCreamSpread(speed = 1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSpreadAt < 0.075) return;
    this.lastSpreadAt = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.min(speed, 2.0) * 0.25;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620 + Math.min(speed, 2) * 380, now);
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    const peak = Math.min(0.14, 0.05 + speed * 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.8, 0.16);
  }

  // Juicy plop-squish when placing fruit into whipped cream
  playFruitPlop(pitchScale = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Soft pillowy plop bubble
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(420 * pitchScale, now + 0.075);
    osc.frequency.exponentialRampToValueAtTime(280 * pitchScale, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    // Subtle moist droplet sparkle
    const chime = this.ctx.createOscillator();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(880 * pitchScale, now + 0.02);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.0001, now + 0.02);
    cg.gain.linearRampToValueAtTime(0.045, now + 0.035);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    chime.connect(cg);
    cg.connect(this.ctx.destination);
    chime.start(now + 0.02);
    chime.stop(now + 0.24);
  }

  // Soft pillowy bread squish + cream puff
  playBreadSquish() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Soft low pillowy thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.14);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.001, now);
    og.gain.linearRampToValueAtTime(0.22, now + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    // Creamy squish puff
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(900, now);
    filt.frequency.exponentialRampToValueAtTime(340, now + 0.18);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.11, now + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    src.connect(filt);
    filt.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5, 0.24);
  }

  // Crisp-juicy knife slicing sound
  playSliceStroke(progress = 0.5) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSliceAt < 0.055) return;
    this.lastSliceAt = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1.15 + progress * 0.35;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1600 + progress * 900, now);
    filt.Q.value = 2.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.8, 0.13);
  }

  // Warm sunlit morning reveal bloom (soft harp-like natural arpeggio)
  playFlowerReveal() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const t = now + i * 0.065;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const over = this.ctx.createOscillator();
      over.type = 'triangle';
      over.frequency.setValueAtTime(freq * 2, t);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);

      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.02, t + 0.015);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      osc.connect(g);
      over.connect(og);
      g.connect(this.ctx.destination);
      og.connect(this.ctx.destination);
      osc.start(t);
      over.start(t);
      osc.stop(t + 1.0);
      over.stop(t + 0.45);
    });
  }

  // Happy soft crisp bite sound
  playBite() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1150, now);
    filt.frequency.exponentialRampToValueAtTime(480, now + 0.14);
    filt.Q.value = 1.3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5, 0.18);

    const pop = this.ctx.createOscillator();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(340, now + 0.02);
    pop.frequency.exponentialRampToValueAtTime(520, now + 0.12);
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.001, now + 0.02);
    pg.gain.linearRampToValueAtTime(0.09, now + 0.035);
    pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    pop.connect(pg);
    pg.connect(this.ctx.destination);
    pop.start(now + 0.02);
    pop.stop(now + 0.18);
  }

  // Soft tactile nudge sound for poking inactive objects (never silent, never distracting)
  playGentleTap(type = 'wood') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (type === 'metal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2480, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    } else if (type === 'fruit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.07);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    }
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}
