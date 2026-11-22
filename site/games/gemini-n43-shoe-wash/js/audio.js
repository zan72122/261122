/**
 * Procedural Summer Veranda Audio Engine (Web Audio API, zero external assets).
 * Includes:
 * - Authentic Japanese summer cicada chorus (アブラゼミ / ミンミンゼミ shimmer)
 * - Crystalline Edo glass wind chime (江戸風鈴) on breeze & player tap
 * - Tactile water slosh, creamy foam lather crackle, stiff brush scrub on wet canvas
 * - Sparkling outdoor faucet cascade, droplet splashes, bubble pops & celebratory water chimes
 */
export class VerandaAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.started = false;

    // Continuous nodes
    this.cicadaGain = null;
    this.faucetGain = null;
    this.faucetFilter = null;
    this.scrubGain = null;
    this.scrubFilter = null;
    this.swirlGain = null;
    this.swirlFilter = null;

    this.lastBubbleTime = 0;
    this.lastSplashTime = 0;
    this.lastWindChimeTime = 0;
    this.cicadaPhase = 0;
  }

  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.72;
    this.master.connect(this.ctx.destination);

    // Create 2-second white/pink noise buffer
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._setupCicadas();
    this._setupFaucetStream();
    this._setupScrubChannel();
    this._setupSwirlChannel();

    this.started = true;
    // Gentle welcoming wind chime shortly after audio starts
    setTimeout(() => this.playWindChime(0.45), 650);
  }

  _createLoopingNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start();
    return src;
  }

  _setupCicadas() {
    // Japanese summer cicada bed (Aburazemi sizzle + distant shimmer)
    const src = this._createLoopingNoise();
    const bp1 = this.ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 4650;
    bp1.Q.value = 2.8;

    const bp2 = this.ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 6900;
    bp2.Q.value = 4.2;

    // Subtle buzzing AM LFO (~16Hz wing tremor)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 17.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.011;

    this.cicadaGain = this.ctx.createGain();
    this.cicadaGain.gain.value = 0.036;

    const mixer = this.ctx.createGain();
    mixer.gain.value = 1.0;
    src.connect(bp1);
    src.connect(bp2);
    bp1.connect(mixer);
    bp2.connect(mixer);
    mixer.connect(this.cicadaGain);
    this.cicadaGain.connect(this.master);

    lfo.connect(lfoGain);
    lfoGain.connect(this.cicadaGain.gain);
    lfo.start();
  }

  _setupFaucetStream() {
    const src = this._createLoopingNoise();
    this.faucetFilter = this.ctx.createBiquadFilter();
    this.faucetFilter.type = 'bandpass';
    this.faucetFilter.frequency.value = 1450;
    this.faucetFilter.Q.value = 0.85;

    const hiPass = this.ctx.createBiquadFilter();
    hiPass.type = 'highpass';
    hiPass.frequency.value = 340;

    this.faucetGain = this.ctx.createGain();
    this.faucetGain.gain.value = 0.0001;

    src.connect(this.faucetFilter);
    this.faucetFilter.connect(hiPass);
    hiPass.connect(this.faucetGain);
    this.faucetGain.connect(this.master);
  }

  _setupScrubChannel() {
    const src = this._createLoopingNoise();
    this.scrubFilter = this.ctx.createBiquadFilter();
    this.scrubFilter.type = 'bandpass';
    this.scrubFilter.frequency.value = 1950;
    this.scrubFilter.Q.value = 1.7;

    this.scrubGain = this.ctx.createGain();
    this.scrubGain.gain.value = 0.0001;

    src.connect(this.scrubFilter);
    this.scrubFilter.connect(this.scrubGain);
    this.scrubGain.connect(this.master);
  }

  _setupSwirlChannel() {
    const src = this._createLoopingNoise();
    this.swirlFilter = this.ctx.createBiquadFilter();
    this.swirlFilter.type = 'bandpass';
    this.swirlFilter.frequency.value = 620;
    this.swirlFilter.Q.value = 1.3;

    this.swirlGain = this.ctx.createGain();
    this.swirlGain.gain.value = 0.0001;

    src.connect(this.swirlFilter);
    this.swirlFilter.connect(this.swirlGain);
    this.swirlGain.connect(this.master);
  }

  updateContinuous(dt, { swirlSpeed = 0, scrubSpeed = 0, faucetFlow = 0, rinsingHit = 0 }) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Natural gentle cicada swell in summer heat
    this.cicadaPhase += dt * 0.28;
    const cicadaLevel = 0.024 + 0.015 * (0.5 + 0.5 * Math.sin(this.cicadaPhase)) * (0.75 + 0.25 * Math.sin(this.cicadaPhase * 2.7));
    this.cicadaGain.gain.setTargetAtTime(cicadaLevel, now, 0.25);

    // Water swirl sloshing
    const swirlVol = Math.min(0.28, swirlSpeed * 0.22);
    this.swirlGain.gain.setTargetAtTime(swirlVol, now, 0.05);
    this.swirlFilter.frequency.setTargetAtTime(420 + Math.min(1, swirlSpeed) * 950, now, 0.06);

    // Brush scrubbing wet canvas (ゴシゴシ)
    const scrubVol = Math.min(0.32, scrubSpeed * 0.26);
    this.scrubGain.gain.setTargetAtTime(scrubVol, now, 0.035);
    this.scrubFilter.frequency.setTargetAtTime(1450 + Math.min(1, scrubSpeed) * 1450, now, 0.04);

    // Faucet water stream + louder bright splash when hitting the shoe
    const fVol = faucetFlow * (0.14 + rinsingHit * 0.16);
    this.faucetGain.gain.setTargetAtTime(fVol, now, 0.06);
    this.faucetFilter.frequency.setTargetAtTime(1250 + rinsingHit * 1350, now, 0.05);
  }

  /**
   * Authentic Japanese glass wind chime (江戸風鈴): チリーン♪
   */
  playWindChime(intensity = 0.8) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWindChimeTime < 0.22) return;
    this.lastWindChimeTime = now;

    // Glass bell inharmonic partials
    const base = 2480 + (Math.random() - 0.5) * 110;
    const partials = [
      { mult: 1.0, amp: 0.14 * intensity, decay: 1.8 },
      { mult: 2.13, amp: 0.08 * intensity, decay: 1.1 },
      { mult: 3.42, amp: 0.045 * intensity, decay: 0.65 },
      { mult: 4.86, amp: 0.02 * intensity, decay: 0.35 }
    ];

    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * p.mult, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(p.amp, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    }
  }

  /**
   * Juicy water droplet / soap bubble pop!
   */
  playBubblePop(pitchScale = 1.0) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastBubbleTime < 0.045) return;
    this.lastBubbleTime = now;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const startF = (360 + Math.random() * 260) * pitchScale;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(startF * 2.35, now + 0.065);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  /**
   * Wet water splash burst (dropping shoe in bucket / shaking / big splash)
   */
  playSplash(intensity = 0.7) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSplashTime < 0.09) return;
    this.lastSplashTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600 + Math.random() * 600, now);
    bp.frequency.exponentialRampToValueAtTime(520, now + 0.24);
    bp.Q.value = 0.9;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28 * intensity, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.5, 0.3);

    // Accompany with 2 water-plop overtones
    this.playBubblePop(0.8 + Math.random() * 0.5);
  }

  /**
   * Soft sparkling harmonic chime when a shoe becomes clean or finishes sun-drying!
   */
  playSparkleChime(celebratory = false) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = celebratory
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [659.25, 880.0, 1046.5];

    notes.forEach((freq, i) => {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  /**
   * Gentle metallic click when clipping a clean uwabaki onto the shoe hanger
   */
  playClipSnap() {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.04);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Soft water drip sound from hanging wet shoes
   */
  playDrip() {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = 900 + Math.random() * 520;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.45, now + 0.045);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}
