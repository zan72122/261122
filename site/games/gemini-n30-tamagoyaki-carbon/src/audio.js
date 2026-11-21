// Synthesized Foley & Expressive Non-Verbal Audio Engine (Zero External Assets, Zero Spoken Words)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.sizzleNodes = null;
    this.sizzleIntensity = 0;
    this.sizzleHeat = 1;
    this.lastWhiskTime = 0;
    this.crackleTimer = 0;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;

      // Subtle warm kitchen room compressor so overlapping foley never clips
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.14;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      // 2-second pink/white blended noise buffer for realistic sizzle, steam & shell crackles
      const len = Math.floor(this.ctx.sampleRate * 2.0);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.45) * 0.24;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Silent tick for iOS Safari audio unlock
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  }

  // Crisp egg-on-glass rim tap ("Kon!")
  playEggTap(hitNum = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Hollow eggshell knock body
    const shellOsc = ctx.createOscillator();
    const shellGain = ctx.createGain();
    shellOsc.type = 'triangle';
    const baseFreq = hitNum === 1 ? 470 : 415;
    shellOsc.frequency.setValueAtTime(baseFreq * 1.25, t);
    shellOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, t + 0.055);
    shellGain.gain.setValueAtTime(0.42, t);
    shellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
    shellOsc.connect(shellGain);
    shellGain.connect(this.master);
    shellOsc.start(t);
    shellOsc.stop(t + 0.07);

    // Thick glass bowl rim ring
    [1380, 2690].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(idx === 0 ? 0.22 : 0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (idx === 0 ? 0.19 : 0.11));
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.2);
    });

    // Subtle hairline crackle on hit
    this._burstNoise(t, 0.025, 3200, 3.5, hitNum >= 2 ? 0.28 : 0.14);
  }

  // Eggshell parting ("Paka!") + heavy glossy yolk plop ("Topun!")
  playEggCrackOpen() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Crisp shell fracture bursts
    this._burstNoise(t, 0.035, 3800, 2.2, 0.34);
    this._burstNoise(t + 0.03, 0.04, 2600, 1.8, 0.28);
    this._burstNoise(t + 0.065, 0.03, 4500, 3.0, 0.2);

    // Plump yolk & egg white plop into bowl 140ms later
    const plopT = t + 0.14;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, plopT);
    osc.frequency.exponentialRampToValueAtTime(365, plopT + 0.065);
    osc.frequency.exponentialRampToValueAtTime(210, plopT + 0.14);
    g.gain.setValueAtTime(0.001, plopT);
    g.gain.linearRampToValueAtTime(0.36, plopT + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, plopT + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(plopT);
    osc.stop(plopT + 0.17);
  }

  // Chopstick stirring in glass bowl ("Kacha-kacha, chapu-chapu")
  playWhiskStroke(speed = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const minGap = Math.max(0.062, 0.14 - Math.min(speed, 2) * 0.038);
    if (now - this.lastWhiskTime < minGap) return;
    this.lastWhiskTime = now;

    // Glass clink with natural pitch jitter
    const jitter = 0.94 + Math.random() * 0.13;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2180 * jitter, now);
    g.gain.setValueAtTime(0.11 * Math.min(1.2, 0.5 + speed * 0.45), now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);

    // Viscous liquid slosh
    const sloshOsc = ctx.createOscillator();
    const sloshGain = ctx.createGain();
    sloshOsc.type = 'triangle';
    const f0 = 260 + Math.random() * 110;
    sloshOsc.frequency.setValueAtTime(f0, now);
    sloshOsc.frequency.exponentialRampToValueAtTime(f0 * 1.55, now + 0.055);
    sloshGain.gain.setValueAtTime(0.12, now);
    sloshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    sloshOsc.connect(sloshGain);
    sloshGain.connect(this.master);
    sloshOsc.start(now);
    sloshOsc.stop(now + 0.07);

    this._burstNoise(now, 0.045, 950 + Math.random() * 500, 1.4, 0.09);
  }

  playWhiskReady() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._marimbaNote(f, t + i * 0.055, 0.16, 0.24);
    });
  }

  playMixIn(kind = 'cheese') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'cheese') {
      [330, 440, 554].forEach((f, i) => this._marimbaNote(f, t + i * 0.045, 0.16, 0.18));
    } else if (kind === 'negi') {
      this._burstNoise(t, 0.08, 4200, 1.8, 0.18);
      [587, 784].forEach((f, i) => this._marimbaNote(f, t + i * 0.04, 0.13, 0.15));
    } else {
      // Sweet honey golden gliss
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.22);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.28);
    }
  }

  playOilBrush() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    this._burstNoise(t, 0.22, 3400, 1.1, 0.22);
  }

  startPanSizzle(initialIntensity = 0.85) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.sizzleNodes) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const bp1 = ctx.createBiquadFilter();
      bp1.type = 'bandpass';
      bp1.frequency.value = 2900;
      bp1.Q.value = 0.75;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1100;

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(bp1);
      bp1.connect(hp);
      hp.connect(gain);
      gain.connect(this.master);
      src.start();

      this.sizzleNodes = { src, bp1, gain };
    }
    this.setPanSizzle(initialIntensity, this.sizzleHeat);
    // Initial loud pour "Juwawa~!!" surge
    const now = ctx.currentTime;
    this._burstNoise(now, 0.42, 2400, 0.7, 0.36 * initialIntensity);
  }

  setPanSizzle(intensity, heat = 1) {
    this.sizzleIntensity = Math.max(0, Math.min(1.4, intensity));
    this.sizzleHeat = Math.max(0.5, Math.min(1.8, heat));
    if (!this.ctx || !this.sizzleNodes) return;
    const t = this.ctx.currentTime;
    const targetGain = this.sizzleIntensity * 0.22 * (0.75 + 0.35 * this.sizzleHeat);
    this.sizzleNodes.gain.gain.setTargetAtTime(Math.max(0.0001, targetGain), t, 0.08);
    this.sizzleNodes.bp1.frequency.setTargetAtTime(2400 + this.sizzleHeat * 950, t, 0.1);
  }

  stopPanSizzle() {
    this.sizzleIntensity = 0;
    if (!this.ctx || !this.sizzleNodes) return;
    this.sizzleNodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
  }

  // Call every frame so pan sizzle produces authentic stochastic oil-popping crackles
  update(dt) {
    if (!this.ctx || this.sizzleIntensity <= 0.04) return;
    this.crackleTimer -= dt * (6 + this.sizzleIntensity * 18 * this.sizzleHeat);
    if (this.crackleTimer <= 0) {
      this.crackleTimer = 0.3 + Math.random() * 0.9;
      const t = this.ctx.currentTime;
      const freq = 2600 + Math.random() * 3600;
      this._burstNoise(t, 0.014 + Math.random() * 0.018, freq, 4.5, 0.08 * this.sizzleIntensity);
    }
  }

  playRollFold(step = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Soft moist cushiony peel & fold
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const base = 240 + step * 48;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.42, t + 0.09);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.13);

    const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    this._marimbaNote(scale[step % scale.length], t + 0.02, 0.15, 0.22);
  }

  playPanFlipOntoBoard() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Plump warm egg log landing on hinoki cutting board ("Pon! Purun!")
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, t);
    osc.frequency.exponentialRampToValueAtTime(92, t + 0.12);
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.17);

    this._marimbaNote(523.25, t + 0.05, 0.16, 0.22);
    this._marimbaNote(659.25, t + 0.11, 0.18, 0.26);
  }

  playKnifeSlice(cutIndex = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Silky blade glide through moist egg ("Suu...")
    this._burstNoise(t, 0.06, 4800, 2.0, 0.14);

    // Crisp hinoki wood cutting-board contact ("Ton!")
    const thudT = t + 0.045;
    const wood = ctx.createOscillator();
    const wg = ctx.createGain();
    wood.type = 'triangle';
    const pitch = 205 + (cutIndex % 4) * 14;
    wood.frequency.setValueAtTime(pitch * 1.4, thudT);
    wood.frequency.exponentialRampToValueAtTime(pitch * 0.72, thudT + 0.065);
    wg.gain.setValueAtTime(0.44, thudT);
    wg.gain.exponentialRampToValueAtTime(0.001, thudT + 0.085);
    wood.connect(wg);
    wg.connect(this.master);
    wood.start(thudT);
    wood.stop(thudT + 0.09);

    // Resonant wood overtone
    this._marimbaNote(420 + (cutIndex % 5) * 28, thudT, 0.14, 0.09);

    // Gentle puff of inner steam ("Howa~")
    this._burstNoise(thudT + 0.03, 0.18, 1750, 0.9, 0.08);
  }

  playPickItem() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    this._marimbaNote(587.33, t, 0.12, 0.11);
  }

  playPackBento(count = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Soft squishy nestle ("Mugyu-pon!")
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.09);
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.13);

    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    this._marimbaNote(notes[(count - 1) % notes.length], t + 0.03, 0.18, 0.24);
  }

  // Non-verbal warm formant girl vocalizations (zero words!)
  playVoiceCurious() {
    this._formantVoice(340, 435, 0.22, [720, 1280], 0.16);
  }

  playVoiceOpenMouth() {
    // Gentle expectant "A-nn~" vowel chord
    this._formantVoice(330, 392, 0.34, [850, 1320], 0.18);
  }

  playVoiceMunch(extraSparkle = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Two cute "mogu-mogu" cheek munches + delighted rising hum!
    [0, 0.16].forEach((offset) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250, t + offset);
      osc.frequency.exponentialRampToValueAtTime(170, t + offset + 0.08);
      g.gain.setValueAtTime(0.18, t + offset);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.11);
    });
    setTimeout(() => {
      this._formantVoice(392, 523.25, 0.38, [520, 1550], 0.2);
      if (extraSparkle) {
        const now = this.ctx.currentTime;
        [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
          this._marimbaNote(f, now + i * 0.055, 0.13, 0.24);
        });
      }
    }, 310);
  }

  playVoiceCelebrate() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((f, i) => {
      this._marimbaNote(f, t + i * 0.075, 0.2, 0.42);
    });
    this._formantVoice(440, 587.33, 0.42, [780, 1450], 0.18);
  }

  playPropTap(kind = 'wood') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'metal') {
      this._marimbaNote(940, t, 0.14, 0.22);
    } else if (kind === 'ceramic') {
      this._marimbaNote(1320, t, 0.12, 0.14);
    } else if (kind === 'soft') {
      this._marimbaNote(310, t, 0.14, 0.1);
    } else if (kind === 'flame') {
      this._burstNoise(t, 0.15, 720, 0.9, 0.2);
    } else {
      this._marimbaNote(430, t, 0.14, 0.11);
    }
  }

  _formantVoice(fStart, fEnd, dur, formants, level = 0.16) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fStart, t);
    osc.frequency.exponentialRampToValueAtTime(fEnd, t + dur);

    // Gentle human vibrato
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 5.5;
    vibG.gain.value = 4.5;
    vib.connect(vibG);
    vibG.connect(osc.frequency);

    const mix = ctx.createGain();
    mix.gain.setValueAtTime(0.001, t);
    mix.gain.linearRampToValueAtTime(level, t + 0.04);
    mix.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.04);

    formants.forEach((ff, idx) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = idx === 0 ? 5.5 : 7.5;
      osc.connect(bp);
      bp.connect(mix);
    });

    mix.connect(this.master);
    osc.start(t);
    vib.start(t);
    osc.stop(t + dur + 0.06);
    vib.stop(t + dur + 0.06);
  }

  _marimbaNote(freq, startTime, gainVal = 0.16, duration = 0.22) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const over = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const og = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    over.type = 'sine';
    over.frequency.setValueAtTime(freq * 3.98, startTime);

    g.gain.setValueAtTime(0.0005, startTime);
    g.gain.linearRampToValueAtTime(gainVal, startTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    og.gain.setValueAtTime(gainVal * 0.22, startTime);
    og.gain.exponentialRampToValueAtTime(0.0005, startTime + duration * 0.35);

    osc.connect(g);
    over.connect(og);
    og.connect(g);
    g.connect(this.master);

    osc.start(startTime);
    over.start(startTime);
    osc.stop(startTime + duration + 0.02);
    over.stop(startTime + duration * 0.4 + 0.02);
  }

  _burstNoise(startTime, dur, centerFreq, q = 1.5, level = 0.2) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const offset = Math.random() * 1.2;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centerFreq;
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(level, startTime);
    g.gain.exponentialRampToValueAtTime(0.0008, startTime + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(startTime, offset, dur + 0.02);
  }
}
