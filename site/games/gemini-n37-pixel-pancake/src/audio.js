// Pure Web Audio API procedural sound effects — warm, juicy, zero external files
(function (global) {
  'use strict';

  const PP = global.PP || (global.PP = {});

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.noiseBuf = null;
      this.sizzleNode = null;
      this.sizzleGain = null;
      this.sizzleFilter = null;
      this.lastSyrupSound = 0;
    }

    unlock() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.noiseBuf && this.ctx) {
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
          data[i] = (b0 + b1 + b2 + white * 0.18) * 0.45;
        }
        this.noiseBuf = buf;
      }
      this.unlocked = true;
      this._ensureSizzle();
    }

    _ensureSizzle() {
      if (!this.ctx || !this.noiseBuf || this.sizzleNode) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2600;
      filter.Q.value = 1.1;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();

      this.sizzleNode = src;
      this.sizzleFilter = filter;
      this.sizzleGain = gain;
    }

    setSizzle(level, heat) {
      if (!this.ctx || !this.sizzleGain) return;
      const now = this.ctx.currentTime;
      const target = Math.max(0.0001, Math.min(0.14, level * 0.11));
      this.sizzleGain.gain.setTargetAtTime(target, now, 0.08);
      const freq = 1900 + (heat || 1) * 850 + level * 600;
      this.sizzleFilter.frequency.setTargetAtTime(freq, now, 0.1);
    }

    _tone(type, f0, f1, dur, vol, delay) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, f0), t0);
      if (f1 !== f0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    _noise(freq, q, dur, vol, delay) {
      if (!this.ctx || !this.noiseBuf) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = freq;
      flt.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt);
      flt.connect(g);
      g.connect(this.ctx.destination);
      src.start(t0, Math.random() * 0.8, dur + 0.03);
    }

    playScoop() {
      this._tone('sine', 260, 420, 0.09, 0.14, 0);
      this._tone('triangle', 520, 380, 0.06, 0.08, 0.03);
    }

    playPour(size) {
      const pitch = size === 'mini' ? 1.25 : size === 'jumbo' ? 0.8 : 1.0;
      this._tone('sine', 340 * pitch, 190 * pitch, 0.16, 0.18, 0);
      this._tone('sine', 220 * pitch, 310 * pitch, 0.12, 0.14, 0.08);
      this._tone('triangle', 460 * pitch, 290 * pitch, 0.09, 0.08, 0.15);
      this._noise(2400, 1.0, 0.32, 0.16, 0.05);
    }

    playBubblePop(cookRatio) {
      const base = 360 + Math.min(1.2, cookRatio) * 340 + (Math.random() - 0.5) * 60;
      this._tone('sine', base, base * 1.65, 0.065, 0.11, 0);
    }

    playFlip(power, combo, size) {
      const sz = size === 'mini' ? 1.22 : size === 'jumbo' ? 0.82 : 1.0;
      const cBoost = 1 + Math.min(4, (combo || 0)) * 0.12;
      const f0 = 210 * sz * cBoost;
      const f1 = (580 + (power || 1) * 180) * sz * cBoost;
      // Big juicy "POON!"
      this._tone('triangle', f0, f1, 0.26, 0.24, 0);
      this._tone('sine', f0 * 1.5, f1 * 1.2, 0.19, 0.14, 0.03);
      // Pan metal shake clink
      this._noise(1700, 1.8, 0.11, 0.14, 0);
      this._tone('square', 150, 95, 0.05, 0.05, 0);
    }

    playLand(quality, isStack) {
      // Juicy "MUNI!" squash bounce
      this._tone('sine', 195, 92, 0.13, 0.24, 0);
      this._tone('triangle', 140, 210, 0.09, 0.12, 0.05);
      this._noise(1200, 1.2, 0.09, 0.1, 0);

      if (quality === 'perfect' || quality === 'buttered') {
        const notes = isStack ? [523, 659, 784, 1046] : [523, 659, 784];
        notes.forEach((n, idx) => {
          this._tone('triangle', n, n * 1.01, 0.16, 0.13, 0.05 + idx * 0.055);
        });
      } else if (quality === 'early') {
        // Silly squishy flop
        this._tone('sine', 300, 140, 0.14, 0.15, 0.02);
        this._tone('sine', 240, 180, 0.1, 0.1, 0.09);
      } else if (quality === 'crispy') {
        // Playful crunch
        this._noise(3200, 1.6, 0.12, 0.14, 0.02);
        this._tone('triangle', 392, 440, 0.11, 0.1, 0.06);
      } else if (isStack) {
        this._tone('triangle', 440, 587, 0.12, 0.12, 0.04);
      }
    }

    playSlideToPlate() {
      this._tone('sine', 330, 620, 0.18, 0.18, 0);
      this._tone('triangle', 440, 740, 0.14, 0.11, 0.04);
    }

    playButterPan() {
      this._noise(3400, 1.3, 0.35, 0.16, 0);
      this._tone('sine', 660, 880, 0.12, 0.11, 0.03);
      this._tone('triangle', 880, 1174, 0.14, 0.09, 0.1);
    }

    playButterStack() {
      this._tone('sine', 360, 220, 0.09, 0.18, 0);
      this._tone('triangle', 587, 784, 0.14, 0.12, 0.05);
    }

    playSyrupTick(fill) {
      const now = performance.now();
      if (now - this.lastSyrupSound < 95) return;
      this.lastSyrupSound = now;
      const base = 260 + Math.min(1, fill) * 240 + (Math.random() - 0.5) * 30;
      this._tone('sine', base, base * 1.28, 0.08, 0.12, 0);
    }

    playBerryPlop(count) {
      const scale = [523, 587, 659, 784, 880, 1046];
      const note = scale[(count || 0) % scale.length];
      this._tone('sine', note * 0.75, note, 0.07, 0.16, 0);
      this._tone('triangle', note, note * 1.02, 0.14, 0.12, 0.03);
    }

    playKnob(heat) {
      this._tone('square', 600, 320, 0.03, 0.09, 0);
      this._noise(1000 + heat * 650, 0.9, 0.16, 0.12 + heat * 0.04, 0.02);
    }

    playWobble() {
      this._tone('sine', 220, 340, 0.09, 0.13, 0);
      this._tone('sine', 340, 200, 0.11, 0.12, 0.07);
      this._tone('sine', 200, 280, 0.09, 0.09, 0.14);
    }

    playMamaGiggle(mood) {
      if (mood === 'cheer') {
        this._tone('sine', 587, 784, 0.11, 0.13, 0);
        this._tone('sine', 784, 1046, 0.14, 0.13, 0.09);
      } else if (mood === 'aahn') {
        this._tone('sine', 420, 520, 0.14, 0.1, 0);
      } else {
        this._tone('sine', 523, 659, 0.08, 0.11, 0);
        this._tone('sine', 659, 587, 0.08, 0.1, 0.08);
        this._tone('sine', 659, 784, 0.1, 0.11, 0.15);
      }
    }

    playMamaBlow() {
      this._noise(1600, 2.5, 0.3, 0.12, 0);
      this._tone('sine', 480, 390, 0.22, 0.06, 0);
    }

    playBite(isMama) {
      // Crisp yummy munch
      this._noise(2400, 1.4, 0.08, 0.16, 0);
      this._tone('triangle', 280, 160, 0.07, 0.16, 0);
      this._noise(2000, 1.6, 0.07, 0.12, 0.09);
      if (isMama) {
        this._tone('sine', 587, 784, 0.1, 0.12, 0.12);
        this._tone('sine', 784, 987, 0.13, 0.12, 0.2);
      } else {
        this._tone('triangle', 523, 659, 0.1, 0.11, 0.1);
      }
    }

    playCelebration() {
      const notes = [523, 659, 784, 1046, 784, 1046];
      const times = [0, 0.08, 0.16, 0.25, 0.36, 0.45];
      notes.forEach((n, i) => {
        this._tone('triangle', n, n * 1.005, 0.2, 0.15, times[i]);
        this._tone('sine', n * 2, n * 2, 0.14, 0.05, times[i]);
      });
    }

    playSoftTap() {
      this._tone('triangle', 380, 260, 0.05, 0.09, 0);
    }
  }

  PP.SoundEngine = SoundEngine;
})(window);
