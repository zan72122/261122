// Procedural Web Audio API sound effects (zero external assets, iOS-ready)
(function () {
  const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.noiseBuf = null;
      this.pourNode = null;
      this.pourGain = null;
      this.sizzleNode = null;
      this.sizzleGain = null;
    }

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.06 * white) / 1.06;
          data[i] = last * 2.8;
        }
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.unlocked && this.ctx) {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const s = this.ctx.createBufferSource();
        s.buffer = b;
        s.connect(this.ctx.destination);
        try { s.start(0); } catch (e) {}
        this.unlocked = true;
      }
    }

    now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    tone(freq0, freq1, dur, type = 'triangle', vol = 0.16, delay = 0) {
      if (!this.ctx) return;
      const t = this.now() + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, freq0), t);
      if (freq1 !== freq0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq1), t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    noise(dur, filterFreq = 1600, q = 1.2, vol = 0.08, delay = 0) {
      if (!this.ctx || !this.noiseBuf) return;
      const t = this.now() + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(filterFreq, t);
      filt.Q.setValueAtTime(q, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.ctx.destination);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    }

    wiggle(pitch = 420) {
      this.tone(pitch, pitch * 1.22, 0.075, 'triangle', 0.1);
    }

    panClink() {
      this.tone(290, 180, 0.08, 'triangle', 0.14);
      this.tone(860, 620, 0.06, 'sine', 0.06);
    }

    startPour(sizeProgress = 0) {
      if (!this.ctx) return;
      if (!this.pourNode) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 250;
        g.gain.value = 0.0001;
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start();
        this.pourNode = osc;
        this.pourGain = g;
      }
      const t = this.now();
      const f = 230 + sizeProgress * 190 + Math.sin(t * 18) * 14;
      this.pourNode.frequency.setTargetAtTime(f, t, 0.04);
      this.pourGain.gain.setTargetAtTime(0.11, t, 0.03);
      if (Math.random() < 0.35) {
        this.noise(0.09, 1900 + sizeProgress * 700, 1.0, 0.045);
      }
    }

    stopPour() {
      if (!this.ctx || !this.pourGain) return;
      this.pourGain.gain.setTargetAtTime(0.0001, this.now(), 0.04);
    }

    bubblePop(idx = 0) {
      const base = PENTATONIC[idx % PENTATONIC.length] * 0.65;
      this.tone(base * 0.72, base * 1.55, 0.085, 'sine', 0.12);
    }

    flipLaunch(power = 1) {
      const top = 560 + power * 340;
      this.tone(180, 110, 0.07, 'triangle', 0.18); // pan flick thump
      this.tone(280, top, 0.24 + power * 0.08, 'triangle', 0.16, 0.02);
      this.noise(0.12, 1200, 0.9, 0.06);
    }

    spinTick() {
      this.noise(0.055, 950, 1.5, 0.05);
      this.tone(420, 520, 0.05, 'sine', 0.05);
    }

    pancakeLand(isGolden = true, sizeScale = 1) {
      const low = Math.max(55, 135 - sizeScale * 30);
      this.tone(low * 1.5, low, 0.14, 'triangle', 0.24); // squishy thud
      this.tone(240, 350, 0.11, 'sine', 0.13, 0.03); // muni bounce
      this.noise(0.22, 2400, 0.8, 0.09, 0.01); // warm sizzle!
      if (isGolden) {
        this.tone(659.25, 659.25, 0.13, 'triangle', 0.11, 0.06);
        this.tone(880.0, 880.0, 0.18, 'triangle', 0.12, 0.13);
      }
    }

    stackLand(count = 1) {
      const note = PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, count - 1))];
      this.tone(150, 95, 0.11, 'triangle', 0.19);
      this.tone(note * 0.85, note, 0.16, 'triangle', 0.17, 0.02);
      this.tone(note * 1.5, note * 1.5, 0.14, 'sine', 0.08, 0.07);
    }

    mixSplash(flavor = 1) {
      this.tone(320, 580, 0.11, 'sine', 0.14);
      const base = flavor === 1 ? 659.25 : flavor === 2 ? 587.33 : 783.99;
      this.tone(base, base * 1.25, 0.13, 'triangle', 0.12, 0.07);
      this.tone(base * 1.5, base * 2, 0.18, 'triangle', 0.12, 0.15);
    }

    swirlWhisk() {
      this.noise(0.08, 1100, 1.4, 0.05);
      this.tone(340 + Math.random() * 120, 480, 0.07, 'sine', 0.07);
    }

    butterDrop() {
      this.tone(260, 190, 0.09, 'triangle', 0.15);
      this.noise(0.28, 2800, 0.9, 0.07, 0.04);
      this.tone(587.33, 783.99, 0.14, 'sine', 0.09, 0.05);
    }

    syrupDrip() {
      const f = 520 + Math.random() * 240;
      this.tone(f * 1.18, f * 0.82, 0.09, 'sine', 0.09);
    }

    berryPop(isBlueberry = false) {
      const f = isBlueberry ? 680 : 560;
      this.tone(f * 0.75, f * 1.35, 0.09, 'triangle', 0.14);
    }

    flameKnob(high = true) {
      this.tone(720, 440, 0.04, 'square', 0.06);
      this.noise(0.18, high ? 1400 : 750, 0.7, high ? 0.09 : 0.04, 0.02);
    }

    forkCut() {
      this.noise(0.07, 2200, 1.4, 0.07);
      this.tone(440, 620, 0.09, 'triangle', 0.12, 0.02);
    }

    mamaBite(deluxe = false) {
      // Crisp cute chomp + mogu-mogu + happy warm chord!
      this.tone(280, 150, 0.09, 'triangle', 0.18);
      this.tone(392, 440, 0.11, 'sine', 0.12, 0.16);
      this.tone(440, 493.88, 0.11, 'sine', 0.12, 0.31);
      const chord = deluxe ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
      chord.forEach((n, i) => {
        this.tone(n * 0.98, n, 0.32, 'triangle', 0.11, 0.45 + i * 0.055);
      });
    }

    towerWobble() {
      this.tone(240, 330, 0.12, 'sine', 0.11);
      this.tone(330, 250, 0.12, 'sine', 0.1, 0.09);
    }
  }

  window.SoundEngine = SoundEngine;
})();
