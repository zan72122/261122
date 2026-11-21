// Procedural tactile WebAudio synthesizer — zero external files, instant iOS unlock

class CraftAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = m;
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = sr * 1.2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Soft pink-ish filtered noise for warm felt/fabric foley
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.7;
    }
    this.noiseBuffer = buf;
  }

  _ready() {
    if (this.muted) return false;
    if (!this.ctx) this.unlock();
    return Boolean(this.ctx && this.ctx.state !== 'closed');
  }

  _tone(freq, startOffset, dur, gainPeak = 0.16, type = 'triangle', freqEnd = null) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.018, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _noise(startOffset, dur, centerFreq, q, gainPeak) {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + startOffset;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + dur * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5, dur + 0.05);
  }

  playFabricRustle(intensity = 0.5, pitch = 1.0) {
    const dur = 0.11 + intensity * 0.09;
    this._noise(0, dur, 900 * pitch, 1.4, 0.11 * intensity);
  }

  // Crisp felt "ぱたん!" fold sound + rising marimba note
  playFoldPatan(stepIndex = 0) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const note = notes[stepIndex % notes.length];
    // Soft thick felt thump
    this._tone(165, 0, 0.11, 0.22, 'sine', 68);
    // Crisp fabric slap
    this._noise(0, 0.09, 1150, 1.2, 0.18);
    // Warm wooden marimba chime
    this._tone(note, 0.015, 0.28, 0.16, 'triangle');
    this._tone(note * 2, 0.015, 0.12, 0.05, 'sine');
  }

  // Cheerful sparkle when the whole garment finishes folding into a neat bundle
  playFoldComplete() {
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      this._tone(f, i * 0.055, 0.34, 0.13, 'triangle');
    });
  }

  // Wooden clothespin *pachin!* snap
  playClothespinSnap() {
    this._tone(980, 0, 0.045, 0.2, 'triangle', 420);
    this._noise(0, 0.04, 2400, 2.2, 0.14);
    this._tone(1174.66, 0.04, 0.16, 0.1, 'sine');
  }

  // Surprise pocket treasure *pon-kirarin!*
  playPocketPop() {
    this._tone(340, 0, 0.12, 0.18, 'sine', 680);
    const sparkle = [880, 1174.66, 1396.91, 1760];
    sparkle.forEach((f, i) => {
      this._tone(f, 0.07 + i * 0.055, 0.26, 0.1, 'sine');
    });
  }

  // Soft plush landing on color pile + family signature happy chirp
  playPileLand(stackHeight = 1, familyIdx = 0) {
    // Plush felt cushion *pofu!*
    this._tone(140 + stackHeight * 14, 0, 0.12, 0.22, 'sine', 72);
    this._noise(0, 0.1, 780, 1.1, 0.14);
    // Family signature happy two-note voice chirp
    const basePitch = familyIdx === 0 ? 698.46 : familyIdx === 1 ? 523.25 : 392.0;
    this._tone(basePitch, 0.06, 0.16, 0.13, 'triangle', basePitch * 1.18);
    this._tone(basePitch * 1.26, 0.16, 0.22, 0.14, 'triangle');
  }

  // Playful soft bounce & puzzled giggle on color mismatch (never negative/harsh!)
  playMismatchGiggle(familyIdx = 0) {
    const base = familyIdx === 0 ? 540 : familyIdx === 1 ? 440 : 320;
    this._tone(base, 0, 0.13, 0.14, 'sine', base * 0.8);
    this._tone(base * 0.85, 0.12, 0.16, 0.13, 'sine', base * 1.15);
    this._noise(0, 0.08, 650, 1.2, 0.09);
  }

  // Soft wobbly pile tumble
  playStackWobble() {
    this._tone(190, 0, 0.1, 0.16, 'sine', 110);
    this._noise(0, 0.12, 700, 1.1, 0.12);
    this._tone(240, 0.09, 0.1, 0.14, 'sine', 140);
  }

  // Wooden drawer slide *karakara*
  playDrawerSlide(opening = true) {
    this._noise(0, 0.22, opening ? 520 : 420, 1.8, 0.16);
    this._tone(opening ? 210 : 280, 0, 0.18, 0.12, 'triangle', opening ? 310 : 190);
  }

  // Solid warm *koton!* drawer close
  playDrawerShut() {
    this._tone(145, 0, 0.13, 0.26, 'sine', 62);
    this._noise(0, 0.07, 460, 1.5, 0.16);
  }

  // Family doll celebration fanfare!
  playFamilyCelebrate(familyIdx = 0) {
    const scales = [
      [587.33, 739.99, 880.0, 1174.66], // Girl (bright D major)
      [523.25, 659.25, 783.99, 1046.5], // Mom (warm C major)
      [392.0, 493.88, 587.33, 783.99],  // Dad (cozy G major)
    ];
    const seq = scales[familyIdx % 3];
    seq.forEach((f, i) => {
      this._tone(f, i * 0.075, 0.36, 0.14, 'triangle');
      this._tone(f * 1.5, i * 0.075 + 0.02, 0.18, 0.04, 'sine');
    });
  }

  // Grand room celebration when all 3 drawers are cozy & tucked!
  playGrandFinale() {
    const melody = [
      [523.25, 0.0],
      [659.25, 0.11],
      [783.99, 0.22],
      [1046.5, 0.34],
      [880.0, 0.48],
      [1046.5, 0.62],
      [1318.51, 0.78],
    ];
    for (const [f, t] of melody) {
      this._tone(f, t, 0.42, 0.14, 'triangle');
      this._tone(f * 0.5, t, 0.35, 0.07, 'sine');
    }
  }

  // Plush pat-pat / doll poke giggle
  playPatSquish(pitch = 1.0) {
    this._tone(280 * pitch, 0, 0.09, 0.14, 'sine', 420 * pitch);
    this._noise(0, 0.06, 950, 1.3, 0.08);
  }

  // Basket rustle & pop
  playBasketPop() {
    this._noise(0, 0.14, 820, 1.2, 0.14);
    this._tone(240, 0.02, 0.11, 0.14, 'sine', 380);
  }

  // Trinket dish musical chime
  playTrinketChime(index = 0) {
    const notes = [659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
    const f = notes[index % notes.length];
    this._tone(f, 0, 0.3, 0.12, 'sine');
    this._tone(f * 2, 0.01, 0.14, 0.04, 'triangle');
  }
}

export const audio = new CraftAudio();
