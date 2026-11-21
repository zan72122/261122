// Synthesized tactile ASMR sound effects for miniature kakigori shop (Zero external files)

export class MiniatureAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.lastShaveTime = 0;
    this.lastPourTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this._buildNoise();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoise() {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 1.2);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (0.85 + 0.15 * Math.sin(i * 0.13));
    }
    this.noiseBuffer = buf;
  }

  // Crisp icy "shari-shari" shaved ice ASMR coupled to crank velocity
  playShaveGrain(speed = 1.0, progress = 0.5) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const minGap = Math.max(0.026, 0.072 - Math.min(1.5, speed) * 0.03);
    if (now - this.lastShaveTime < minGap) return;
    this.lastShaveTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.95 + Math.random() * 0.35 + speed * 0.18;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200 + progress * 900 + Math.random() * 800, now);
    bp.Q.value = 1.6;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;

    const gain = this.ctx.createGain();
    const vol = Math.min(0.22, 0.07 + speed * 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    src.connect(bp);
    bp.connect(hp);
    hp.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.8, 0.075);

    // Subtle vintage cast-iron gear click
    if (Math.random() < 0.42) {
      const osc = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240 + speed * 75, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.022);
      g2.gain.setValueAtTime(0.035, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.024);
      osc.connect(g2);
      g2.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.026);
    }
  }

  // Gentle miniature clink / wooden wobble when tapping out-of-stage or glass items
  playWobbleClink(pitch = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(780 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(1120 * pitch, now + 0.045);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // Liquid syrup glug + fizzing ice soak
  playSyrupDrop(colorIndex = 0, isMix = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPourTime < 0.065) return;
    this.lastPourTime = now;

    const baseNotes = [523.25, 587.33, 659.25, 783.99];
    const base = baseNotes[colorIndex % 4] * (0.97 + Math.random() * 0.06);

    // Liquid droplet bloop
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.32, now + 0.065);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);

    // Ice-soak soft fizz
    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 4600;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.035, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now, Math.random() * 0.5, 0.06);
    }

    if (isMix) {
      this.playSparkleChord([base * 1.5, base * 2.0], 0.055);
    }
  }

  // Velvety creamy condensed milk drizzle
  playMilkDrizzle() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPourTime < 0.075) return;
    this.lastPourTime = now;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const f = 390 + Math.random() * 90;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f * 1.18, now + 0.08);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // Plump bouncy fruit placement on fluffy snow
  playFruitLand(count = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = scale[(count - 1) % scale.length];

    // Soft snow thud + marimba pop
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.65, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.035);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // Overflow puff chime
  playOverflowPuff() {
    if (!this.ctx) return;
    this.playSparkleChord([659.25, 880, 1174.66], 0.08);
  }

  // Wooden coaster sliding smoothly across cedar counter
  playBowlSlide() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(520, now);
    lp.frequency.linearRampToValueAtTime(840, now + 0.28);
    lp.Q.value = 2.0;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now, 0.1, 0.34);

    // Gentle wooden arrival knock
    setTimeout(() => this.playWobbleClink(0.62), 260);
  }

  // Spoon crunch into shaved ice
  playSpoonBite() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.13;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3400 + i * 600;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.ctx.destination);
      src.start(t, i * 0.2, 0.09);
    }
  }

  // Glass summer wind-chime (Fuurin)
  playWindChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [2093, 2637, 3136];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * (0.995 + Math.random() * 0.01), now + idx * 0.03);
      g.gain.setValueAtTime(idx === 0 ? 0.11 : 0.05, now + idx * 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.95 + idx * 0.15);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.03);
      osc.stop(now + 1.15);
    });
  }

  // Brass counter bell
  playBrassBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [1318.5, 2637.0, 3951.0].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.12 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.85);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.88);
    });
  }

  // Customer delight / special reaction fanfare
  playReaction(kind = 'happy') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (kind === 'brainfreeze') {
      // Funny icy shiver tremolando then cheerful resolve!
      for (let i = 0; i < 6; i++) {
        const t = now + i * 0.075;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 1174.66 : 1244.5, t);
        g.gain.setValueAtTime(0.09, t);
        g.gain.exponentialRampToValueAtTime(0.002, t + 0.068);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.07);
      }
      setTimeout(() => {
        this.playSparkleChord([523.25, 659.25, 783.99, 1046.5], 0.1);
        this.playWindChime();
      }, 520);
      return;
    }

    if (kind === 'rainbow') {
      const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1567.98];
      notes.forEach((f, idx) => {
        const t = now + idx * 0.065;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      });
      setTimeout(() => this.playWindChime(), 360);
      return;
    }

    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.48);
    });
    setTimeout(() => this.playWindChime(), 250);
  }

  playSparkleChord(freqs, vol = 0.08) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const t = now + i * 0.045;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}
