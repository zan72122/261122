// Procedural Web Audio API sound engine for Pastel Strawberry Shortcake Toy Game
// Zero external audio files; warm, soft, tactile toy & bakery sound effects.

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
const BIRTHDAY_NOTES = [523.25, 587.33, 659.25, 783.99, 1046.5];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.lastSpreadTime = 0;
    this.squeezeNode = null;
    this.unlocked = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _buildNoiseBuffer() {
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
      data[i] = (b0 + b1 + b2 + white * 0.08) * 1.6;
    }
    this.noiseBuffer = buf;
  }

  _ready() {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    return true;
  }

  // Soft velvety cream spread sound
  playSpread(speed = 0.5) {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSpreadTime < 0.065) return;
    this.lastSpreadTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const clampedSpeed = Math.min(1.5, Math.max(0.2, speed));
    filter.frequency.setValueAtTime(620 + clampedSpeed * 520, now);
    filter.Q.value = 2.6;

    const gain = this.ctx.createGain();
    const peak = Math.min(0.28, 0.1 + clampedSpeed * 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random() * 0.8);
    src.stop(now + 0.15);
  }

  // Juicy scoop from cream bowl
  playScoop() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.17);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Soft wooden toy click when cake stand spins
  playTurntableTick() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.03);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Cute toy wobble boing for poking inactive props or jiggling berries
  playBoing(pitchScale = 1.0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(290 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(470 * pitchScale, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(350 * pitchScale, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Strawberry land: squishy plop + cheerful marimba note
  playBerryPlace(index = 0, isPearl = false) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    // Soft cream squish pop
    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(210, now);
    pop.frequency.exponentialRampToValueAtTime(430, now + 0.065);
    popGain.gain.setValueAtTime(0.2, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    pop.connect(popGain);
    popGain.connect(this.master);
    pop.start(now);
    pop.stop(now + 0.1);

    // Musical marimba chime
    const freq = PENTATONIC[index % PENTATONIC.length];
    this._playBellTone(freq, now + 0.02, 0.34, 0.24);
    if (isPearl) {
      // Magical pearl strawberry sparkle arpeggio
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
        this._playBellTone(f, now + 0.04 + i * 0.055, 0.42, 0.16);
      });
    }
  }

  // Berry tumble sound when stacked too high
  playTumble() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    [480, 390, 310].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, now + i * 0.07 + 0.06);
      g.gain.setValueAtTime(0.16, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.075);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.08);
    });
  }

  // Continuous velvety piping squeeze
  startSqueeze() {
    if (!this._ready()) return;
    this.stopSqueeze();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    sub.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    sub.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    sub.start(now);

    this.squeezeNode = { osc, sub, gain };
  }

  updateSqueeze(progress = 0) {
    if (!this.squeezeNode || !this._ready()) return;
    const now = this.ctx.currentTime;
    const p = Math.min(1.2, Math.max(0, progress));
    this.squeezeNode.osc.frequency.setTargetAtTime(300 + p * 360, now, 0.04);
    this.squeezeNode.sub.frequency.setTargetAtTime(450 + p * 540, now, 0.04);
  }

  stopSqueeze(popFinish = true) {
    if (!this.squeezeNode) return;
    const { osc, sub, gain } = this.squeezeNode;
    this.squeezeNode = null;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.03);
      osc.stop(now + 0.09);
      sub.stop(now + 0.09);
    } catch (_) {}
    if (popFinish) {
      this._playPop(580, 0.14);
    }
  }

  // Big rosette sparkle burst!
  playSparkleBurst() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this._playPop(680, 0.2);
    [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
      this._playBellTone(f, now + i * 0.045, 0.38, 0.15);
    });
  }

  // Color pot dip sound
  playColorDip(colorIndex = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const base = [440, 523.25, 587.33][colorIndex % 3];
    this._playPop(base, 0.18);
    this._playBellTone(base * 1.5, now + 0.05, 0.25, 0.16);
  }

  // Candle place & light up!
  playCandleLight(index = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    // Cute hollow pokon
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.06);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);

    // Warm music-box chime
    const f = BIRTHDAY_NOTES[index % BIRTHDAY_NOTES.length];
    this._playBellTone(f, now + 0.07, 0.7, 0.22);
    this._playBellTone(f * 1.5, now + 0.12, 0.5, 0.1);
  }

  // Gentle breathy "Fuuu~" wind to blow out candles
  playBlow() {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.36);
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.45);
  }

  // Soft puff when a candle goes out
  playCandleOut(remaining = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this._playPop(500 + (5 - remaining) * 70, 0.16);
    this._playBellTone(880 + (5 - remaining) * 110, now + 0.03, 0.32, 0.14);
  }

  // Cute character giggle / happy vocalization
  playGiggle() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    [680, 820, 960].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.085;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.18, t + 0.055);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.08);
    });
  }

  // Cute eating "mogu-mogu!" crunch-squish + happy chime
  playEatBite() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    // Two cute soft chomps
    [0, 0.14].forEach((offset, idx) => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340 + idx * 60, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.1);
    });
    // Happy heart chime
    this._playBellTone(783.99, now + 0.24, 0.35, 0.18);
    this._playBellTone(1046.5, now + 0.32, 0.45, 0.2);
  }

  // Stage transition fanfare (short, joyful)
  playStageComplete() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._playBellTone(f, now + i * 0.085, 0.48, 0.2);
    });
  }

  // Grand celebration music-box melody!
  playCelebrationFanfare() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const melody = [
      [523.25, 0.0],
      [659.25, 0.11],
      [783.99, 0.22],
      [1046.5, 0.34],
      [880.0, 0.48],
      [1046.5, 0.60],
      [1318.51, 0.74]
    ];
    melody.forEach(([f, dt]) => {
      this._playBellTone(f, now + dt, 0.62, 0.22);
    });
  }

  // Replay bell *ting!*
  playBellTing() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this._playBellTone(1318.51, now, 0.9, 0.25);
    this._playBellTone(2637.02, now + 0.01, 0.5, 0.1);
  }

  _playPop(freq = 500, vol = 0.18) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.055);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  _playBellTone(freq, startTime, duration = 0.45, vol = 0.2) {
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const overGain = this.ctx.createGain();

    osc.type = 'sine';
    overtone.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    overtone.frequency.setValueAtTime(freq * 2, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(vol, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    overGain.gain.setValueAtTime(0.0001, startTime);
    overGain.gain.exponentialRampToValueAtTime(vol * 0.25, startTime + 0.01);
    overGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.45);

    osc.connect(gain);
    overtone.connect(overGain);
    gain.connect(this.master);
    overGain.connect(this.master);

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + duration + 0.02);
    overtone.stop(startTime + duration * 0.5);
  }
}
