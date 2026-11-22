// Procedural Web Audio engine for realistic sizzling takoyaki, utensils, & warm wordless family sounds
export class TakoyakiAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.targetSizzle = 0.03;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.65;
      this.master.connect(this.ctx.destination);

      // Generate 2 seconds of crisp noise buffer for realistic frying sizzle
      const sampleRate = this.ctx.sampleRate;
      const len = sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.055;
        b1 = 0.95 * b1 + white * 0.12;
        b2 = 0.65 * b2 + white * 0.35;
        // Mix crackle impulses with high-frequency hiss
        const crackle = Math.random() < 0.004 ? (Math.random() * 2 - 1) * 1.4 : 0;
        data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2) * 0.65 + white * 0.25 + crackle));
      }

      // Continuous hot iron griddle sizzle bed
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;

      this.sizzleFilter = this.ctx.createBiquadFilter();
      this.sizzleFilter.type = 'bandpass';
      this.sizzleFilter.frequency.value = 4200;
      this.sizzleFilter.Q.value = 0.7;

      this.sizzleGain = this.ctx.createGain();
      this.sizzleGain.gain.value = 0.015;

      src.connect(hp);
      hp.connect(this.sizzleFilter);
      this.sizzleFilter.connect(this.sizzleGain);
      this.sizzleGain.connect(this.master);
      src.start();

      this.unlocked = true;
    } catch (_) {
      // Ignore audio init errors in restricted browsers
    }
  }

  setSizzleLevel(intensity) {
    // intensity: 0 (idle hot oiled plate) to 1 (all 6 wells actively sizzling)
    if (!this.ctx || !this.sizzleGain || !this.sizzleFilter) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, intensity));
    const gain = 0.015 + clamped * 0.13;
    const freq = 3400 + clamped * 2800;
    this.sizzleGain.gain.setTargetAtTime(gain, now, 0.15);
    this.sizzleFilter.frequency.setTargetAtTime(freq, now, 0.18);
  }

  // Batter pouring into hot oiled cast-iron well ("toro-juuuuu~")
  playBatterPour() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // 1. Hot-iron initial sizzle burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5200, now);
    bp.frequency.exponentialRampToValueAtTime(2800, now + 0.55);
    bp.Q.value = 0.85;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.8, 0.7);

    // 2. Soft liquid glug tone
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.001, now);
    og.gain.linearRampToValueAtTime(0.08, now + 0.03);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(og);
    og.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Wet octopus plop into batter + fresh crackle
  playOctopusPlop(isDouble = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = isDouble ? 360 : 280;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.95, now + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);

    this._sizzleBurst(0.16, 0.25, 4800);
  }

  // Metal pick flip: subtle steel tap + crisp "kuru-juu!" turn sizzle
  playPickFlip(flipStage = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Tiny steel pick click on cast iron
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1650 + flipStage * 180, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);

    // Lush turn-over sizzle when raw batter meets the hot iron bottom
    this._sizzleBurst(flipStage >= 2 ? 0.22 : 0.30, 0.48, 5600);
  }

  // Thick glossy sauce squeeze
  playSauceDrizzle(isMayo = false) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isMayo ? 950 : 620, now);
    bp.frequency.linearRampToValueAtTime(isMayo ? 1350 : 920, now + 0.22);
    bp.Q.value = 3.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random(), 0.3);

    // Subtle warm sauce sizzle on hot crust
    this._sizzleBurst(0.11, 0.32, 3800);
  }

  // Soft papery flutter of dancing katsuobushi shavings
  playKatsuobushiFlutter() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.065;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 4600 + i * 850;
      hp.Q.value = 2.0;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.master);
      src.start(t, Math.random(), 0.16);
    }
  }

  // Gentle "fuu~ fuu~" cooling breath sound
  playBlowSteam() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(750, now);
    bp.frequency.linearRampToValueAtTime(520, now + 0.42);
    bp.Q.value = 2.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.5, 0.5);
  }

  // Warm delighted wordless reaction when Mom or Dad eats a takoyaki
  playFamilyHappy(who = 'mom') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft warm marimba/vocal-hum fifth chord (gentle, natural, non-cartoony)
    const freqs = who === 'mom' ? [392, 493.88, 587.33] : [220, 277.18, 329.63];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.96, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.08);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  // Soft ceramic/wood nudge for off-stage props (small tactile feedback)
  playSoftClink(pitch = 880) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, now + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  _sizzleBurst(volume, duration, freq) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, now);
    bp.frequency.exponentialRampToValueAtTime(freq * 0.55, now + duration);
    bp.Q.value = 0.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.9, duration + 0.05);
  }
}
