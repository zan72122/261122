// Tactile procedural Web Audio engine for the miniature kakigori shop.
// Unlocks cleanly on first pointer/touch event, zero external audio assets.

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.shaveGain = null;
    this.shaveFilter = null;
    this.shaveTarget = 0;
    this.pourGain = null;
    this.pourOsc = null;
    this.pourTarget = 0;
    this.toppingCount = 0;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      this._buildNoiseBuffer();
      this._buildContinuousNodes();
      this.unlocked = true;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio errors on restricted environments
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // Slightly crispy pink-white blend for ice crystals
      last = last * 0.45 + w * 0.55;
      data[i] = last * 0.9;
    }
    this.noiseBuffer = buf;
  }

  _buildContinuousNodes() {
    // Ice shaving continuous filtered noise
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 1.4;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(hp);
    hp.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();

    this.shaveGain = gain;
    this.shaveFilter = filter;
  }

  setShaveSpeed(speed) {
    if (!this.ctx || !this.shaveGain) return;
    const clamped = Math.min(1, Math.max(0, speed));
    const now = this.ctx.currentTime;
    this.shaveGain.gain.setTargetAtTime(clamped * 0.16, now, 0.035);
    this.shaveFilter.frequency.setTargetAtTime(2200 + clamped * 2600, now, 0.04);
  }

  playIceSparkle(pitchScale = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((1800 + Math.random() * 900) * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(3200 * pitchScale, now + 0.05);
    g.gain.setValueAtTime(0.025, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playSyrupBubble(kind = 'strawberry') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const baseMap = { strawberry: 410, lemon: 520, blue: 470, milk: 320 };
    const base = (baseMap[kind] || 440) + (Math.random() - 0.5) * 90;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = kind === 'milk' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(base * 0.78, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + 0.075);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(kind === 'milk' ? 0.075 : 0.055, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playToppingPlop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Soft snowy thump
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    // Ascending wooden marimba sparkle note
    const freq = PENTATONIC[this.toppingCount % PENTATONIC.length];
    this.toppingCount++;
    this._playMarimbaNote(freq, now + 0.015, 0.14, 0.11);
  }

  resetToppingPitch() {
    this.toppingCount = 0;
  }

  playWoodTok(pitch = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(160 * pitch, now + 0.055);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playSnowTumble() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Playful xylophone downward cascade
    const notes = [1046, 880, 783, 659, 523];
    notes.forEach((f, i) => {
      this._playMarimbaNote(f, now + i * 0.055, 0.12, 0.09);
    });
  }

  playBowlSlide() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(900, now);
      f.frequency.exponentialRampToValueAtTime(450, now + 0.25);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      src.connect(f);
      f.connect(g);
      g.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.3);
    }
    this._playMarimbaNote(587.33, now + 0.16, 0.16, 0.08);
    this._playMarimbaNote(880.0, now + 0.24, 0.22, 0.09);
  }

  playEatCrunch() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      src.connect(f);
      f.connect(g);
      g.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.13);
    }
    this._playMarimbaNote(659.25 + Math.random() * 140, now + 0.03, 0.1, 0.07);
  }

  playReaction(type) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (type === 'rainbow') {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1174.66, 1318.5, 1567.98];
      seq.forEach((f, i) => this._playMarimbaNote(f, now + i * 0.07, 0.35, 0.12));
    } else if (type === 'brainfreeze') {
      // Shimmering icy chord then warm laugh notes
      [1567.98, 1760.0, 2093.0, 2349.3].forEach((f, i) => {
        this._playBellNote(f, now + i * 0.04, 0.45, 0.06);
      });
      this._playMarimbaNote(523.25, now + 0.55, 0.15, 0.1);
      this._playMarimbaNote(659.25, now + 0.68, 0.15, 0.1);
      this._playMarimbaNote(783.99, now + 0.80, 0.25, 0.11);
    } else if (type === 'sour') {
      // Playful squiggly trill then happy chime
      for (let i = 0; i < 5; i++) {
        this._playMarimbaNote(i % 2 === 0 ? 740 : 660, now + i * 0.055, 0.08, 0.08);
      }
      this._playMarimbaNote(880, now + 0.36, 0.2, 0.1);
      this._playMarimbaNote(1046.5, now + 0.48, 0.3, 0.11);
    } else {
      // Happy joyful chime
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._playMarimbaNote(f, now + i * 0.085, 0.28, 0.11);
      });
    }
  }

  playFurinChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const base = 2280 + Math.random() * 240;
    this._playBellNote(base, now, 1.3, 0.065);
    this._playBellNote(base * 1.498, now + 0.02, 0.9, 0.03);
    this._playBellNote(base * 2.02, now + 0.01, 0.65, 0.02);
  }

  playColorMixSparkle() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [880, 1174.66, 1567.98].forEach((f, i) => {
      this._playBellNote(f, now + i * 0.055, 0.35, 0.05);
    });
  }

  _playMarimbaNote(freq, startTime, duration, volume) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  _playBellNote(freq, startTime, duration, volume) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }
}
