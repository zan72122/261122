/**
 * Procedural Studio Foley & ASMR Web Audio Synthesizer (Zero External Assets)
 * Coupled directly to physical velocities, fill levels, and slow-motion timeScale!
 */
export class StudioAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.pourGain = null;
    this.pourFilter = null;
    this.steamGain = null;
    this.steamFilter = null;
    this.lastPurunTime = 0;
    this.lastWhiskTime = 0;
    this.timeScale = 1.0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;
      this.master.connect(this.ctx.destination);

      // Generate 2s pink-tinted noise buffer for liquid pours, steam & shell crackles
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }

      // Continuous loop channels for pouring & steaming
      const pourSrc = this.ctx.createBufferSource();
      pourSrc.buffer = this.noiseBuf;
      pourSrc.loop = true;
      this.pourFilter = this.ctx.createBiquadFilter();
      this.pourFilter.type = 'bandpass';
      this.pourFilter.frequency.value = 650;
      this.pourFilter.Q.value = 2.8;
      this.pourGain = this.ctx.createGain();
      this.pourGain.gain.value = 0.0;
      pourSrc.connect(this.pourFilter).connect(this.pourGain).connect(this.master);
      pourSrc.start();

      const steamSrc = this.ctx.createBufferSource();
      steamSrc.buffer = this.noiseBuf;
      steamSrc.loop = true;
      this.steamFilter = this.ctx.createBiquadFilter();
      this.steamFilter.type = 'bandpass';
      this.steamFilter.frequency.value = 1650;
      this.steamFilter.Q.value = 0.9;
      this.steamGain = this.ctx.createGain();
      this.steamGain.gain.value = 0.0;
      steamSrc.connect(this.steamFilter).connect(this.steamGain).connect(this.master);
      steamSrc.start();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setTimeScale(ts) {
    this.timeScale = ts;
  }

  playEggTap() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Crisp calcified shell against glass rim "tock!"
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.038);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playEggCrack() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playEggTap();
    // Brittle micro-crackle bursts
    for (let i = 0; i < 4; i++) {
      const delay = 0.02 + i * 0.024;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2400 + i * 400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.03);
      src.connect(hp).connect(g).connect(this.master);
      src.start(t + delay, Math.random() * 1.2, 0.04);
    }
  }

  playYolkPlop(slowMo = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const stretch = slowMo ? 1.85 : 1.0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(slowMo ? 155 : 210, t);
    osc.frequency.exponentialRampToValueAtTime(slowMo ? 310 : 440, t + 0.09 * stretch);
    osc.frequency.exponentialRampToValueAtTime(slowMo ? 120 : 175, t + 0.22 * stretch);
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25 * stretch);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.26 * stretch);
  }

  playPurun(intensity = 0.7, pitchScale = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPurunTime < 0.075) return;
    this.lastPurunTime = now;

    const slowStretch = this.timeScale < 0.6 ? 1.75 : 1.0;
    const pitchTs = 0.65 + 0.35 * this.timeScale;
    const baseF = 148 * pitchScale * pitchTs;

    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseF * 0.82, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.38, now + 0.07 * slowStretch);
    osc.frequency.exponentialRampToValueAtTime(baseF * 0.94, now + 0.24 * slowStretch);

    // Wobbling FM vibrato = signature juicy "purun-purun" acoustic texture!
    mod.type = 'sine';
    mod.frequency.value = 15.5 * pitchTs;
    modGain.gain.setValueAtTime(28 * intensity, now);
    modGain.gain.exponentialRampToValueAtTime(2, now + 0.28 * slowStretch);

    outGain.gain.setValueAtTime(Math.min(0.42, 0.14 + intensity * 0.28), now);
    outGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30 * slowStretch);

    mod.connect(modGain).connect(osc.frequency);
    osc.connect(outGain).connect(this.master);
    mod.start(now);
    osc.start(now);
    mod.stop(now + 0.32 * slowStretch);
    osc.stop(now + 0.32 * slowStretch);
  }

  updatePourSound(active, fillRatio = 0.5, isSyrup = false) {
    if (!this.ctx || !this.pourGain) return;
    const t = this.ctx.currentTime;
    const targetGain = active ? (isSyrup ? 0.15 : 0.24) : 0.0;
    this.pourGain.gain.setTargetAtTime(targetGain, t, 0.05);
    if (active) {
      // Rising glass cavity resonance as vessel fills!
      const baseHz = isSyrup ? 340 : 480 + fillRatio * 480;
      this.pourFilter.frequency.setTargetAtTime(baseHz * (0.7 + 0.3 * this.timeScale), t, 0.06);
    }
  }

  playWhiskStroke(speed = 0.5) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWhiskTime < 0.095) return;
    this.lastWhiskTime = now;

    // Soft liquid slosh + delicate stainless wire ring against glass bowl
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + speed * 750;
    bp.Q.value = 2.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.24, 0.06 + speed * 0.16), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now, Math.random(), 0.09);

    if (Math.random() < 0.45) {
      const chime = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.value = 2650 + Math.random() * 420;
      cg.gain.setValueAtTime(0.035 * speed, now);
      cg.gain.exponentialRampToValueAtTime(0.0005, now + 0.06);
      chime.connect(cg).connect(this.master);
      chime.start(now);
      chime.stop(now + 0.065);
    }
  }

  updateSteamSound(active, intensity = 0.7) {
    if (!this.ctx || !this.steamGain) return;
    const t = this.ctx.currentTime;
    this.steamGain.gain.setTargetAtTime(active ? 0.22 * intensity : 0.0, t, 0.12);
    if (active) {
      this.steamFilter.frequency.setTargetAtTime(1400 + intensity * 650, t, 0.1);
    }
  }

  playGlassCloche() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1180, 1790].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.11 / (i + 1), t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  playIceChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Crystalline ice cubes clinking against chilled glass
    [2150, 2890, 3420].forEach((freq, idx) => {
      const d = idx * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + d);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + d + 0.18);
      g.gain.setValueAtTime(0.14, t + d);
      g.gain.exponentialRampToValueAtTime(0.0008, t + d + 0.2);
      osc.connect(g).connect(this.master);
      osc.start(t + d);
      osc.stop(t + d + 0.22);
    });
  }

  playPlateClack() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(210, t + 0.065);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playUnmoldPopAndDrop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // 1. Vacuum seal release "shhh-POP!"
    const pop = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(190, t);
    pop.frequency.exponentialRampToValueAtTime(560, t + 0.065);
    pg.gain.setValueAtTime(0.32, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    pop.connect(pg).connect(this.master);
    pop.start(t);
    pop.stop(t + 0.085);

    // 2. Slow-motion sub-bass plush landing + deep wobbling purun!
    const landT = t + 0.12;
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(98, landT);
    sub.frequency.exponentialRampToValueAtTime(185, landT + 0.18);
    sub.frequency.exponentialRampToValueAtTime(78, landT + 0.55);
    sg.gain.setValueAtTime(0.45, landT);
    sg.gain.exponentialRampToValueAtTime(0.001, landT + 0.6);
    sub.connect(sg).connect(this.master);
    sub.start(landT);
    sub.stop(landT + 0.62);
  }

  playSpoonSpank() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Wet custard "pata!" slap + silver harmonic + purun
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 1150;
    lp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, 0.2, 0.05);
    this.playPurun(0.85, 1.08);
  }

  playSpoonScoop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Silky wet slice into custard
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.14);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playHappyTaste() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Warm, gentle acoustic marimba/harp major-9th delight chord (no synthetic arcade bleeps!)
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach((freq, i) => {
      const st = t + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.12, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.65);
      osc.connect(g).connect(this.master);
      osc.start(st);
      osc.stop(st + 0.68);
    });
  }
}
