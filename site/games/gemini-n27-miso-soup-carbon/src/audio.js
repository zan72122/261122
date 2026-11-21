/**
 * Procedural Web Audio API synthesizer for warm tactile clay foley,
 * kitchen water/simmer sounds, marimba musical feedback, and expressive wordless character voices.
 * Zero external audio files required; instant <20ms response.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.waterNode = null;
    this.waterGain = null;
    this.waterFilter = null;
    this.stirNode = null;
    this.stirGain = null;
    this.stirFilter = null;
    this.lastBubbleTime = 0;
    this.lastWaterDropTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    this.noiseBuffer = buf;
  }

  /** Soft wooden marimba / clay bell note */
  playMarimba(freq = 523.25, vol = 0.22, dur = 0.28, delay = 0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const og = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 3.98, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    og.gain.setValueAtTime(vol * 0.24, t);
    og.gain.exponentialRampToValueAtTime(0.0005, t + dur * 0.28);

    osc.connect(g);
    overtone.connect(og);
    og.connect(g);
    g.connect(this.master);

    osc.start(t);
    overtone.start(t);
    osc.stop(t + dur + 0.02);
    overtone.stop(t + dur + 0.02);
  }

  /** Soft clay poke / squish sound */
  playClayBoop(pitch = 1.0, vol = 0.2) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(340 * pitch, t + 0.065);
    osc.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.14);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** Continuous water pouring stream + rising musical water droplets */
  setWaterPouring(active, fillRatio = 0, overflowing = false) {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    if (active) {
      if (!this.waterNode) {
        this.waterNode = this.ctx.createBufferSource();
        this.waterNode.buffer = this.noiseBuffer;
        this.waterNode.loop = true;

        this.waterFilter = this.ctx.createBiquadFilter();
        this.waterFilter.type = 'bandpass';
        this.waterFilter.Q.value = 1.8;

        this.waterGain = this.ctx.createGain();
        this.waterGain.gain.setValueAtTime(0.001, now);

        this.waterNode.connect(this.waterFilter);
        this.waterFilter.connect(this.waterGain);
        this.waterGain.connect(this.master);
        this.waterNode.start(now);
      }
      const baseFreq = 520 + fillRatio * 560 + (overflowing ? 260 : 0);
      this.waterFilter.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.waterGain.gain.setTargetAtTime(overflowing ? 0.34 : 0.24, now, 0.04);

      if (now - this.lastWaterDropTime > (overflowing ? 0.065 : 0.095)) {
        this.lastWaterDropTime = now;
        const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
        const idx = Math.min(scale.length - 1, Math.floor(fillRatio * (scale.length - 1)));
        const f = scale[idx] * (0.97 + Math.random() * 0.06);
        this.playDroplet(f, overflowing ? 0.18 : 0.13);
      }
    } else if (this.waterGain) {
      this.waterGain.gain.setTargetAtTime(0.0001, now, 0.05);
      const node = this.waterNode;
      this.waterNode = null;
      this.waterGain = null;
      setTimeout(() => {
        try { node.stop(); } catch (_) {}
      }, 180);
    }
  }

  playDroplet(freq = 480, vol = 0.16) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.72, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.48, t + 0.075);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playSplash(intensity = 1.0) {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(950, t);
    filt.frequency.exponentialRampToValueAtTime(380, t + 0.24);
    filt.Q.value = 1.1;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.28);

    this.playDroplet(420 + Math.random() * 260, 0.18 * intensity);
  }

  /** Cozy stove flame ignition + golden dashi bloom */
  playDashiBloom() {
    this.unlock();
    if (!this.ctx) return;
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((n, i) => this.playMarimba(n, 0.18, 0.38, i * 0.075));
  }

  playBubblePop() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastBubbleTime < 0.08) return;
    this.lastBubbleTime = now;
    this.playDroplet(320 + Math.random() * 240, 0.07);
  }

  /** Soft jiggly tofu wobble */
  playTofuJiggle() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.linearRampToValueAtTime(265, t + 0.045);
    osc.frequency.linearRampToValueAtTime(175, t + 0.095);
    osc.frequency.linearRampToValueAtTime(235, t + 0.145);

    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** Clean satisfying squishy slice across palm tofu */
  playTofuSlice(cutCount = 1) {
    this.unlock();
    if (!this.ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const freq = scale[(cutCount - 1) % scale.length];
    this.playMarimba(freq, 0.22, 0.22, 0);
    this.playClayBoop(1.15, 0.16);
  }

  /** Tofu piece plopping into broth (bigger piece = deeper bassier plop!) */
  playPlop(sizeFactor = 1.0, delay = 0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const base = Math.max(120, 340 / Math.sqrt(sizeFactor));
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 0.68, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.65, t + 0.085);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(Math.min(0.32, 0.16 * Math.sqrt(sizeFactor)), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** Dried wakame drop + comical swelling unfurl sound! */
  playWakameSwell(count = 1) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const startF = 240 + (count % 5) * 28;
    osc.frequency.setValueAtTime(startF, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(startF * 2.15, t + 0.42);

    g.gain.setValueAtTime(0.001, t + 0.08);
    g.gain.linearRampToValueAtTime(0.18, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t + 0.08);
    osc.stop(t + 0.47);
    this.playDroplet(520, 0.12);
  }

  /** Rich thick miso dollop squish */
  playMisoSquish() {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    this.playClayBoop(0.68, 0.26);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(480, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }

  /** Continuous swirling soup stir sound */
  setStirring(speed = 0) {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (speed > 0.05) {
      if (!this.stirNode) {
        this.stirNode = this.ctx.createBufferSource();
        this.stirNode.buffer = this.noiseBuffer;
        this.stirNode.loop = true;

        this.stirFilter = this.ctx.createBiquadFilter();
        this.stirFilter.type = 'bandpass';
        this.stirFilter.Q.value = 2.2;

        this.stirGain = this.ctx.createGain();
        this.stirGain.gain.setValueAtTime(0.001, now);

        this.stirNode.connect(this.stirFilter);
        this.stirFilter.connect(this.stirGain);
        this.stirGain.connect(this.master);
        this.stirNode.start(now);
      }
      const clamped = Math.min(1.5, speed);
      this.stirFilter.frequency.setTargetAtTime(280 + clamped * 380, now, 0.05);
      this.stirGain.gain.setTargetAtTime(Math.min(0.24, clamped * 0.18), now, 0.05);
    } else if (this.stirGain) {
      this.stirGain.gain.setTargetAtTime(0.0001, now, 0.06);
      const n = this.stirNode;
      this.stirNode = null;
      this.stirGain = null;
      setTimeout(() => {
        try { n.stop(); } catch (_) {}
      }, 180);
    }
  }

  /** Pouring soup from ladle into bowl */
  playLadlePour() {
    this.unlock();
    if (!this.ctx) return;
    [392, 440, 523.25, 659.25].forEach((f, i) => {
      setTimeout(() => this.playDroplet(f, 0.16), i * 65);
    });
  }

  /** Soft gentle "Fuu-fuu!" blowing on hot soup */
  playBlowFuu(basePitch = 1.0) {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer) return;
    for (let b = 0; b < 2; b++) {
      const t = this.ctx.currentTime + b * 0.32;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(680 * basePitch, t);
      filt.frequency.exponentialRampToValueAtTime(460 * basePitch, t + 0.22);
      filt.Q.value = 3.2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      src.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.26);
    }
  }

  /** Cozy soup slurp "Zuzuzuuu~!" + happy "Puhaa~!" voice */
  playSlurpAndDelight(role = 'girl', extraExcited = false) {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // Slurp filtered noise sweep
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 4.5;
    filt.frequency.setValueAtTime(420, t);
    filt.frequency.exponentialRampToValueAtTime(1250, t + 0.42);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.46);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.48);

    // Happy vocal sigh + marimba chord after slurp
    setTimeout(() => {
      this.playVoice(role, extraExcited ? 'wow' : 'happy');
      const chord = extraExcited ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
      chord.forEach((f, i) => this.playMarimba(f, 0.16, 0.35, i * 0.055));
    }, 480);
  }

  /**
   * Wordless claymation character voice (formant vowel contour).
   * role: 'girl' | 'mom' | 'dad'
   * mood: 'giggle' | 'happy' | 'wow' | 'sniff' | 'eager'
   */
  playVoice(role = 'girl', mood = 'happy') {
    this.unlock();
    if (!this.ctx) return;
    const baseMap = { girl: 375, mom: 268, dad: 148 };
    const f0 = baseMap[role] || 300;
    const t = this.ctx.currentTime;

    const makeNote = (startF, endF, startOff, dur, vol = 0.16, vowelF1 = 720) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(startF, t + startOff);
      osc.frequency.exponentialRampToValueAtTime(endF, t + startOff + dur);

      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(vowelF1, t + startOff);
      f1.Q.value = 3.6;

      const low = this.ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 2100;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t + startOff);
      g.gain.linearRampToValueAtTime(vol, t + startOff + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + startOff + dur);

      osc.connect(f1);
      f1.connect(low);
      low.connect(g);
      g.connect(this.master);

      osc.start(t + startOff);
      osc.stop(t + startOff + dur + 0.02);
    };

    if (mood === 'giggle') {
      makeNote(f0 * 1.05, f0 * 1.28, 0.0, 0.09, 0.14, 820);
      makeNote(f0 * 1.15, f0 * 1.42, 0.11, 0.11, 0.15, 880);
    } else if (mood === 'wow') {
      makeNote(f0 * 0.92, f0 * 1.52, 0.0, 0.28, 0.18, 760);
    } else if (mood === 'sniff') {
      this.playBlowFuu(role === 'dad' ? 0.78 : 1.15);
      makeNote(f0 * 1.12, f0 * 0.95, 0.34, 0.26, 0.13, 640);
    } else if (mood === 'eager') {
      makeNote(f0 * 1.0, f0 * 1.25, 0.0, 0.13, 0.14, 780);
    } else {
      // warm happy "Puhaa~♪"
      makeNote(f0 * 1.24, f0 * 0.96, 0.0, 0.32, 0.17, 750);
    }
  }

  /** Grand heartwarming family celebration fanfare */
  playCelebration() {
    this.unlock();
    if (!this.ctx) return;
    const melody = [
      [523.25, 0.0],
      [659.25, 0.11],
      [783.99, 0.22],
      [1046.5, 0.34],
      [880.0, 0.50],
      [1046.5, 0.64],
    ];
    melody.forEach(([f, d]) => this.playMarimba(f, 0.22, 0.45, d));
  }
}

export const sound = new SoundEngine();
