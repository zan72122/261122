// Procedural tactile claymation foley & warm wooden marimba WebAudio synthesizer

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.simmerNode = null;
    this.simmerGain = null;
    this.lastPourBubble = 0;
    this.lastSwirlSound = 0;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this._createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
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

  _ready() {
    if (!this.ctx) this.unlock();
    return this.ctx && this.ctx.state === 'running';
  }

  // Soft clay squish / poke pop
  playClayPop(pitch = 1.0, vol = 0.2) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.055);
    osc.frequency.exponentialRampToValueAtTime(190 * pitch, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // Warm wooden marimba note
  playMarimba(freq, vol = 0.22, delay = 0, dur = 0.34) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const ogain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 4, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    ogain.gain.setValueAtTime(0.001, now);
    ogain.gain.linearRampToValueAtTime(vol * 0.18, now + 0.004);
    ogain.gain.exponentialRampToValueAtTime(0.0005, now + 0.06);

    osc.connect(gain).connect(this.ctx.destination);
    overtone.connect(ogain).connect(this.ctx.destination);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + dur + 0.02);
    overtone.stop(now + 0.08);
  }

  // Water pouring bubble glug (pitch rises as fill 0..1 rises)
  playWaterPourTick(fillRatio) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPourBubble < 0.075) return;
    this.lastPourBubble = now;

    // Liquid glug
    const base = 260 + fillRatio * 300 + (Math.random() - 0.5) * 45;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.075);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // Gentle water stream shimmer noise
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100 + fillRatio * 700, now);
      filter.Q.value = 2.0;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.04, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(filter).connect(ng).connect(this.ctx.destination);
      src.start(now, Math.random(), 0.09);
    }
  }

  // Splash plop into pot
  playSplash(pitch = 1.0, vol = 0.24) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(240 * pitch, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  // Golden dashi bloom + stove ignite
  playDashiBloom() {
    if (!this._ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.playMarimba(f, 0.16, i * 0.075, 0.55));
  }

  // Stove click & warm clay flame whoosh
  playFlameIgnite() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    // Click
    this.playClayPop(1.6, 0.16);
    // Warm low whoosh
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.35);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start(now, 0, 0.4);
    }
  }

  // Soft simmering bubble pop (called occasionally while pot is warm)
  playSimmerBubble() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const f = 220 + Math.random() * 190;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.75, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.4, now + 0.055);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Silky tofu slice (crisp soft shup + jiggly boing)
  playTofuSlice(cutIndex = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.09);
      filter.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start(now, Math.random(), 0.12);
    }
    // Jiggly tofu boing
    const scale = [392, 440, 493.88, 587.33];
    const base = scale[cutIndex % scale.length];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 0.85, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(base * 1.15, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(base * 0.96, now + 0.16);
    gain.gain.setValueAtTime(0.001, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now + 0.02);
    osc.stop(now + 0.19);
  }

  // Wakame magical unfurl bloom
  playWakameBloom(idx = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const scale = [330, 392, 440, 523.25, 587.33];
    const f = scale[idx % scale.length];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f * 0.65, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.4, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(f * 1.2, now + 0.32);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
    this.playMarimba(f * 1.5, 0.12, 0.08, 0.3);
  }

  // Velvety miso swirl sound
  playMisoSwirl(progress) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSwirlSound < 0.12) return;
    this.lastSwirlSound = now;

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(380 + progress * 480, now);
      filter.Q.value = 2.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start(now, Math.random(), 0.15);
    }
    // Warm subtle pentatonic ripple
    const pent = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const note = pent[Math.min(pent.length - 1, Math.floor(progress * pent.length))];
    this.playMarimba(note, 0.075, 0, 0.22);
  }

  // Gentle breath blow ("fuuu-fuuu")
  playBlowSteam() {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      const t = now + k * 0.36;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(780, t);
      filter.Q.value = 3.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start(t, Math.random(), 0.3);
    }
  }

  // Cozy sip ("zuzu!")
  playSip(pitch = 1.0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(480 * pitch, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Unique delighted chime per family member: 0=Papa, 1=Child, 2=Mama
  playFamilyHappy(memberIdx) {
    if (!this._ready()) return;
    if (memberIdx === 0) {
      // Papa: warm cozy lower chord
      [261.63, 329.63, 392.0, 523.25].forEach((f, i) => this.playMarimba(f, 0.2, i * 0.085, 0.55));
    } else if (memberIdx === 1) {
      // Little sibling: playful bouncy giggle arpeggio
      [523.25, 659.25, 783.99, 1046.5, 880, 1046.5].forEach((f, i) => this.playMarimba(f, 0.16, i * 0.065, 0.35));
    } else {
      // Mama: warm sweet melody
      [392.0, 493.88, 587.33, 783.99].forEach((f, i) => this.playMarimba(f, 0.18, i * 0.08, 0.52));
    }
  }

  // Stage transition gentle chime
  playStageComplete() {
    if (!this._ready()) return;
    [523.25, 659.25, 783.99].forEach((f, i) => this.playMarimba(f, 0.17, i * 0.08, 0.45));
  }

  // Full dinner celebration jingle
  playFinaleJingle() {
    if (!this._ready()) return;
    const seq = [
      [523.25, 0.0],
      [659.25, 0.11],
      [783.99, 0.22],
      [1046.5, 0.34],
      [783.99, 0.48],
      [1046.5, 0.60],
    ];
    seq.forEach(([f, d]) => this.playMarimba(f, 0.19, d, 0.58));
  }
}

export const sound = new SoundEngine();
