/**
 * Procedural Studio Culinary Foley Synthesizer (Web Audio API, zero external assets).
 * Automatically unlocks on first pointer/touch event for iOS Safari & Chrome.
 * Responds to slow-motion time scale by deepening pitch and softening transients!
 */
export class StudioAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.steamNode = null;
    this.steamGain = null;
    this.pourNode = null;
    this.pourGain = null;
    this.pourFilter = null;
    this.lastWhiskTime = 0;
    this.lastWobbleTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this._createNoiseBuffer(2.0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _createNoiseBuffer(seconds) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.65;
    }
    return buf;
  }

  // Crisp realistic eggshell tap + crack against glass rim
  playEggCrack(timeScale = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const pitch = 0.65 + 0.35 * timeScale;

    // 1. Glass rim clink
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1680 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(1420 * pitch, now + 0.14);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    // 2. Shell crisp micro-snaps
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.022;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = (2400 + i * 650) * pitch;
      bp.Q.value = 3.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.22 - i * 0.04, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      src.connect(bp).connect(ng).connect(this.ctx.destination);
      src.start(t, Math.random() * 1.2, 0.06);
    }
  }

  // Glossy wet yolk plop into glass bowl (deepens dramatically in slow-mo!)
  playYolkPlop(timeScale = 0.35) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const pitch = 0.55 + 0.45 * timeScale;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(190 * pitch, now + 0.28);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  // Continuous pouring stream (milk / custard / viscous caramel)
  setPourSound(active, viscosity = 0.3, level = 0.5) {
    if (!active) {
      if (this.pourGain && this.ctx) {
        this.pourGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      }
      return;
    }
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (!this.pourNode) {
      this.pourNode = this.ctx.createBufferSource();
      this.pourNode.buffer = this.noiseBuffer;
      this.pourNode.loop = true;

      this.pourFilter = this.ctx.createBiquadFilter();
      this.pourFilter.type = 'bandpass';
      this.pourFilter.Q.value = 2.6;

      this.pourGain = this.ctx.createGain();
      this.pourGain.gain.value = 0.0001;

      this.pourNode.connect(this.pourFilter).connect(this.pourGain).connect(this.ctx.destination);
      this.pourNode.start(now);
    }

    // Pitch rises gently as cup fills! Viscous caramel sounds deeper & silkier
    const baseFreq = (1 - viscosity * 0.55) * 820 + level * 520;
    this.pourFilter.frequency.setTargetAtTime(baseFreq, now, 0.07);
    this.pourGain.gain.setTargetAtTime(0.11, now, 0.06);
  }

  // Tactile wet whisk swish + delicate stainless-steel-on-glass chime
  playWhiskSwish(speed = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWhiskTime < 0.095) return;
    this.lastWhiskTime = now;

    const clamped = Math.min(2.2, Math.max(0.3, speed));
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520 + clamped * 440, now);
    bp.Q.value = 1.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075 * Math.min(1.4, clamped), now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(now, Math.random() * 1.4, 0.16);

    // Occasional light musical glass-bowl tap
    if (Math.random() < 0.35) {
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1850 + Math.random() * 480;
      og.gain.setValueAtTime(0.022, now);
      og.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);
      osc.connect(og).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }

  // Soft warm steam hiss
  setSteamSound(intensity = 0) {
    if (intensity <= 0.01) {
      if (this.steamGain && this.ctx) {
        this.steamGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
      }
      return;
    }
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (!this.steamNode) {
      this.steamNode = this.ctx.createBufferSource();
      this.steamNode.buffer = this.noiseBuffer;
      this.steamNode.loop = true;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1850;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5400;

      this.steamGain = this.ctx.createGain();
      this.steamGain.gain.value = 0.0001;

      this.steamNode.connect(hp).connect(lp).connect(this.steamGain).connect(this.ctx.destination);
      this.steamNode.start(now);
    }
    this.steamGain.gain.setTargetAtTime(0.065 * intensity, now, 0.1);
  }

  // Crisp crystal ice clink into chilled water bath
  playIceClink() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [2480, 3310, 4120];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * (0.94 + Math.random() * 0.14), now + idx * 0.014);
      g.gain.setValueAtTime(0.065 / (idx + 1), now + idx * 0.014);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.18 + idx * 0.03);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(now + idx * 0.014);
      osc.stop(now + 0.24);
    });
  }

  // Porcelain plate clink when flipping the cup
  playPorcelainClink() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [1320, 2680].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(i === 0 ? 0.09 : 0.035, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.19);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    });
  }

  // Iconic suction release + heavy glossy "PURUN!" pudding unmold wobble!
  playPurunUnmold(timeScale = 0.24) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Air-bubble suction pop ("shlup!")
    const pop = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(160, now);
    pop.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    pg.gain.setValueAtTime(0.18, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    pop.connect(pg).connect(this.ctx.destination);
    pop.start(now);
    pop.stop(now + 0.14);

    // 2. Deep slow-mo resonant jelly wobble ("booo-yo-yo-yong!")
    const wob = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const wg = this.ctx.createGain();

    wob.type = 'sine';
    const basePitch = 92 + timeScale * 54;
    wob.frequency.setValueAtTime(basePitch * 0.78, now + 0.09);
    wob.frequency.exponentialRampToValueAtTime(basePitch * 1.45, now + 0.34);
    wob.frequency.exponentialRampToValueAtTime(basePitch * 0.96, now + 1.15);

    lfo.frequency.value = 5.8 + timeScale * 5.0;
    lfoGain.gain.setValueAtTime(24, now + 0.09);
    lfoGain.gain.exponentialRampToValueAtTime(2, now + 1.25);

    wg.gain.setValueAtTime(0.001, now + 0.08);
    wg.gain.linearRampToValueAtTime(0.24, now + 0.15);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 1.32);

    lfo.connect(lfoGain).connect(wob.frequency);
    wob.connect(wg).connect(this.ctx.destination);
    lfo.start(now + 0.08);
    wob.start(now + 0.08);
    lfo.stop(now + 1.35);
    wob.stop(now + 1.35);

    // 3. Soft shimmering warm studio bell triad
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const bell = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bell.type = 'sine';
      bell.frequency.value = freq;
      const t0 = now + 0.18 + idx * 0.07;
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.linearRampToValueAtTime(0.045, t0 + 0.04);
      bg.gain.exponentialRampToValueAtTime(0.0004, t0 + 1.2);
      bell.connect(bg).connect(this.ctx.destination);
      bell.start(t0);
      bell.stop(t0 + 1.25);
    });
  }

  // Tactile finger poke / jiggle sound
  playPuddingWobble(strength = 0.7) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWobbleTime < 0.08) return;
    this.lastWobbleTime = now;

    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    const g = this.ctx.createGain();

    osc.type = 'sine';
    const f0 = 118 + strength * 44;
    osc.frequency.setValueAtTime(f0 * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.25, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.92, now + 0.36);

    lfo.frequency.value = 10.5;
    lfoG.gain.value = 14 * strength;
    lfo.connect(lfoG).connect(osc.frequency);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14 * Math.min(1.2, strength), now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.38);

    osc.connect(g).connect(this.ctx.destination);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.4);
    osc.stop(now + 0.4);
  }

  // Gentle metallic spoon scoop + delighted chime
  playSpoonScoop() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [880, 1174.66, 1567.98].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.055;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.42);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // Soft stage completion cue (subtle warm marimba/harp harmonic)
  playStageChime(step = 0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    const f = notes[step % notes.length];
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.55);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.58);
  }
}
