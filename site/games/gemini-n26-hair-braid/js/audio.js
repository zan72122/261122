/**
 * Tactile procedural Web Audio synthesizer for Yarn Doll Hair Salon.
 * Warm wooden marimba, soft wool/bristle swishes, gentle harp chimes, cute doll coos.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.lastBrushTime = 0;
    this.pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this._buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.08) * 1.4;
    }
    this.noiseBuffer = buf;
  }

  _playTone(freq, startOffset, duration, type = 'sine', gainPeak = 0.14, endFreq = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playBrushStroke(intensity = 0.7) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastBrushTime < 0.085) return;
    this.lastBrushTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100 + Math.random() * 550, now);
    filter.Q.setValueAtTime(1.6, now);

    const gain = this.ctx.createGain();
    const peak = Math.min(0.18, 0.07 + intensity * 0.10);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.6, 0.16);
  }

  playFuzzPop(index = 0) {
    const f = this.pentatonic[index % this.pentatonic.length];
    this._playTone(f * 0.65, 0, 0.14, 'triangle', 0.15, f * 1.15);
    this._playTone(f * 1.5, 0.03, 0.12, 'sine', 0.08);
  }

  playBrushComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => {
      this._playTone(n, i * 0.07, 0.34, 'triangle', 0.13);
      this._playTone(n * 2, i * 0.07, 0.22, 'sine', 0.045);
    });
  }

  playPickup() {
    this._playTone(390, 0, 0.09, 'sine', 0.11, 560);
  }

  playDropSoft() {
    this._playTone(440, 0, 0.10, 'sine', 0.09, 310);
  }

  playWeaveStep(stepIndex) {
    // Alternating A-B warm wooden marimba + ascending pentatonic
    const idx = Math.min(this.pentatonic.length - 1, stepIndex);
    const freq = this.pentatonic[idx];
    const loomPitch = stepIndex % 2 === 0 ? 280 : 330;
    this._playTone(loomPitch, 0, 0.07, 'triangle', 0.11, loomPitch * 0.78);
    this._playTone(freq, 0.025, 0.26, 'triangle', 0.14);
    this._playTone(freq * 2, 0.025, 0.14, 'sine', 0.05);
  }

  playSwirlTick(progress) {
    const idx = Math.min(this.pentatonic.length - 1, Math.floor(progress * this.pentatonic.length));
    const freq = this.pentatonic[idx];
    this._playTone(freq, 0, 0.20, 'sine', 0.10, freq * 1.03);
    this._playTone(freq * 1.5, 0.02, 0.14, 'triangle', 0.05);
  }

  playStyleDone() {
    const chord = [523.25, 659.25, 783.99, 987.77, 1046.5];
    chord.forEach((n, i) => {
      this._playTone(n, i * 0.06, 0.42, 'triangle', 0.13);
      this._playTone(n * 2, i * 0.06 + 0.02, 0.28, 'sine', 0.05);
    });
  }

  playPlaceAccessory(type, isSymmetry = false) {
    if (type === 'bow') {
      this._playTone(587.33, 0, 0.22, 'triangle', 0.14);
      this._playTone(880, 0.05, 0.26, 'sine', 0.11);
    } else if (type === 'flower') {
      this._playTone(659.25, 0, 0.18, 'triangle', 0.13, 720);
      this._playTone(987.77, 0.05, 0.22, 'sine', 0.10);
    } else if (type === 'strawberry') {
      this._playTone(460, 0, 0.11, 'sine', 0.15, 760);
      this._playTone(1046.5, 0.06, 0.20, 'triangle', 0.10);
    } else if (type === 'star') {
      [880, 1174.66, 1567.98].forEach((n, i) => this._playTone(n, i * 0.045, 0.30, 'sine', 0.09));
    } else {
      // pompom squishy boing
      this._playTone(340, 0, 0.18, 'sine', 0.14, 590);
      this._playTone(590, 0.08, 0.16, 'triangle', 0.09, 520);
    }

    if (isSymmetry) {
      // Extra magical harmony chime for matching left/right pair!
      [783.99, 1046.5, 1318.5, 1567.98].forEach((n, i) => {
        this._playTone(n, 0.12 + i * 0.05, 0.36, 'sine', 0.09);
      });
    }
  }

  playNudge() {
    this._playTone(420, 0, 0.08, 'sine', 0.07, 470);
  }

  playGiggle() {
    // Cute melodic doll coo / giggle
    const steps = [680, 820, 760, 940];
    steps.forEach((f, i) => {
      this._playTone(f, i * 0.065, 0.09, 'sine', 0.095, f * 1.12);
    });
  }

  playColorWave() {
    const notes = [440, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this._playTone(n, i * 0.045, 0.32, 'sine', 0.10);
    });
  }

  playMirrorReveal() {
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    melody.forEach((n, i) => {
      this._playTone(n, i * 0.085, 0.55, 'triangle', 0.13);
      this._playTone(n * 2, i * 0.085 + 0.02, 0.35, 'sine', 0.055);
    });
  }

  playMirrorPose(idx) {
    const base = [659.25, 783.99, 880, 1046.5][idx % 4];
    this._playTone(base, 0, 0.22, 'triangle', 0.13);
    this._playTone(base * 1.25, 0.07, 0.26, 'sine', 0.11);
    this._playTone(base * 1.5, 0.14, 0.34, 'sine', 0.09);
  }
}
