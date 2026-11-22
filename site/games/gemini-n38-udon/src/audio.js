// Procedural Web Audio synthesizer for warm Showa winter-night kitchen Foley
export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.noiseBuffer = null;
    this.simmerGain = null;
    this.simmerFilter = null;
    this.flameGain = null;
    this.masterGain = null;
    this.pourGain = null;
    this.pourFilter = null;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.72;
    this.masterGain.connect(this.ctx.destination);

    // Pre-build 2s white noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this._startAmbientBed();
    this.unlocked = true;
  }

  _startAmbientBed() {
    const ctx = this.ctx;
    // Soft continuous gas burner hiss
    const flameSrc = ctx.createBufferSource();
    flameSrc.buffer = this.noiseBuffer;
    flameSrc.loop = true;
    const flameBP = ctx.createBiquadFilter();
    flameBP.type = 'bandpass';
    flameBP.frequency.value = 260;
    flameBP.Q.value = 0.7;
    this.flameGain = ctx.createGain();
    this.flameGain.gain.value = 0.045;
    flameSrc.connect(flameBP).connect(this.flameGain).connect(this.masterGain);
    flameSrc.start();

    // Gentle simmering water rumble
    const simSrc = ctx.createBufferSource();
    simSrc.buffer = this.noiseBuffer;
    simSrc.loop = true;
    this.simmerFilter = ctx.createBiquadFilter();
    this.simmerFilter.type = 'lowpass';
    this.simmerFilter.frequency.value = 420;
    this.simmerGain = ctx.createGain();
    this.simmerGain.gain.value = 0.05;
    simSrc.connect(this.simmerFilter).connect(this.simmerGain).connect(this.masterGain);
    simSrc.start();

    // Continuous pouring stream channel (muted until pouring)
    const pourSrc = ctx.createBufferSource();
    pourSrc.buffer = this.noiseBuffer;
    pourSrc.loop = true;
    this.pourFilter = ctx.createBiquadFilter();
    this.pourFilter.type = 'bandpass';
    this.pourFilter.frequency.value = 620;
    this.pourFilter.Q.value = 2.1;
    this.pourGain = ctx.createGain();
    this.pourGain.gain.value = 0.0001;
    pourSrc.connect(this.pourFilter).connect(this.pourGain).connect(this.masterGain);
    pourSrc.start();
  }

  updateBoiling(intensity, flameLevel) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.flameGain.gain.setTargetAtTime(0.02 + flameLevel * 0.085, now, 0.15);
    this.simmerGain.gain.setTargetAtTime(0.03 + intensity * 0.12, now, 0.15);
    this.simmerFilter.frequency.setTargetAtTime(340 + intensity * 720, now, 0.15);
  }

  setPouring(active, fillRatio = 0.5) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.pourGain.gain.setTargetAtTime(active ? 0.16 : 0.0001, now, 0.05);
    // Acoustic causality: resonant pitch rises smoothly as the ceramic bowl fills!
    this.pourFilter.frequency.setTargetAtTime(480 + fillRatio * 540, now, 0.08);
  }

  playBubble(big = false) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const baseF = big ? 170 + Math.random() * 90 : 280 + Math.random() * 220;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 2.1, now + (big ? 0.09 : 0.055));
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(big ? 0.075 : 0.035, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, now + (big ? 0.11 : 0.065));
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playSplash(power = 1.0) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low water plunge thud
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165 * power, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.18);
    og.gain.setValueAtTime(0.24 * power, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(og).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);

    // Filtered water spray noise
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, now);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.28);
    bp.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.24 * power, now + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    src.connect(bp).connect(ng).connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.34);
  }

  playYugiriShake(power = 1.0) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Crisp "CHA!" bamboo/water flick burst
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1950 + Math.random() * 450, now);
    hp.frequency.exponentialRampToValueAtTime(820, now + 0.16);
    hp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28 * power, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    src.connect(hp).connect(g).connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.21);

    // Sparkling water droplets hitting pot/counter right after flick
    for (let i = 0; i < 4; i++) {
      const delay = 0.06 + i * 0.032 + Math.random() * 0.025;
      const osc = ctx.createOscillator();
      const dg = ctx.createGain();
      const f = 920 + Math.random() * 1200;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + delay);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, now + delay + 0.028);
      dg.gain.setValueAtTime(0.032 * power, now + delay);
      dg.gain.exponentialRampToValueAtTime(0.0005, now + delay + 0.034);
      osc.connect(dg).connect(this.masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.04);
    }
  }

  playNoodleDump() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.16);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    // Ceramic warmth resonance
    this.playCeramicClink(0.65);
  }

  playCeramicClink(vol = 0.8) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs = [1180, 2140];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f + Math.random() * 40, now);
      g.gain.setValueAtTime((idx === 0 ? 0.08 : 0.04) * vol, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + (idx === 0 ? 0.16 : 0.09));
      osc.connect(g).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  playKnobClick() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Crisp stove igniter/detent click
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  playScatter(crispy = false) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const count = crispy ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const d = i * 0.026 + Math.random() * 0.02;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = crispy ? 3200 + Math.random() * 1800 : 1800 + Math.random() * 900;
      bp.Q.value = crispy ? 3.2 : 2.0;
      const g = ctx.createGain();
      g.gain.setValueAtTime(crispy ? 0.09 : 0.055, now + d);
      g.gain.exponentialRampToValueAtTime(0.0008, now + d + (crispy ? 0.045 : 0.032));
      src.connect(bp).connect(g).connect(this.masterGain);
      src.start(now + d);
      src.stop(now + d + 0.06);
    }
  }

  playSlurp() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Expressive wet noodle slurp sweep
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 5.5;
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(2150, now + 0.24);
    bp.frequency.exponentialRampToValueAtTime(1280, now + 0.34);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.19, now + 0.05);
    g.gain.linearRampToValueAtTime(0.22, now + 0.20);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    src.connect(bp).connect(g).connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.38);
  }

  playCompleteChime() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Warm cozy Japanese pentatonic chime (ceramic/wood resonance)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
      osc.connect(g).connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }
}
