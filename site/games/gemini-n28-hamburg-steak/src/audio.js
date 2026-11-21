// Procedural WebAudio foley + warm acoustic chime engine (zero external audio files)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.unlocked = false;

    // Continuous sizzle state
    this.sizzleNodes = null;
    this.sizzleActive = false;
    this.crackleTimer = 0;
    this.lastSquishTime = 0;
  }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;
    this.master.connect(this.ctx.destination);

    // Pre-bake 2s pink-ish noise buffer for wet squish, air puff, and crisp pan sizzle
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 1.4;
    }
    this.unlocked = true;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _ready() {
    if (!this.unlocked) this.unlock();
    if (!this.ctx || !this.master || this.muted) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  // Warm wooden marimba/kalimba tone
  playNote(freq, duration = 0.28, gainLevel = 0.16, delay = 0, type = 'sine') {
    if (!this._ready()) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(gainLevel * 0.25, now);
    g2.gain.exponentialRampToValueAtTime(0.0008, now + duration * 0.45);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainLevel, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(this.master);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);
  }

  // Stage 1: Wet tactile meat kneading squish
  playSquish(intensity = 0.7) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSquishTime < 0.085) return;
    this.lastSquishTime = now;

    // Bandpass noise burst for wet squish
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseF = 340 + Math.random() * 240;
    filter.frequency.setValueAtTime(baseF, now);
    filter.frequency.exponentialRampToValueAtTime(baseF * 1.9, now + 0.06);
    filter.frequency.exponentialRampToValueAtTime(baseF * 0.7, now + 0.14);
    filter.Q.value = 3.2;

    const g = this.ctx.createGain();
    const amp = Math.min(0.28, 0.1 + intensity * 0.15);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.2, 0.18);

    // Subtle soft low bubble-pop
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    const startF = 140 + Math.random() * 70;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(startF * 1.85, now + 0.065);
    og.gain.setValueAtTime(0.001, now);
    og.gain.linearRampToValueAtTime(0.08 * intensity, now + 0.015);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(og);
    og.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Stage 1: Egg yolk glossy pop!
  playEggPop() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);
    this.playNote(523.25, 0.22, 0.11, 0.02);
    this.playNote(659.25, 0.24, 0.1, 0.07);
  }

  // Stage 1: Salt shaker shaka-shaka sparkles
  playSaltShake() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.09;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 1.1, 0.09);
    }
    this.playNote(1046.5, 0.18, 0.08, 0.03);
    this.playNote(1318.5, 0.2, 0.08, 0.11);
    this.playNote(1568.0, 0.25, 0.09, 0.19);
  }

  // Stage 2: Warm fleshy hand pat-pat (ぺちぺち!)
  playPat(step = 0, side = 1) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    // Warm low palm thump
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    const pitch = side > 0 ? 155 : 138;
    osc.frequency.setValueAtTime(pitch * 1.45, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.62, now + 0.11);
    og.gain.setValueAtTime(0.001, now);
    og.gain.linearRampToValueAtTime(0.32, now + 0.008);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(og);
    og.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);

    // Soft slap noise
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = side > 0 ? 920 : 780;
    bp.Q.value = 1.4;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.26, now + 0.006);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.master);
    src.start(now, Math.random() * 1.2, 0.1);

    // Rising pentatonic playful marimba hint
    const pent = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    this.playNote(pent[step % pent.length], 0.24, 0.11, 0.015);
  }

  // Stage 2: Cute air bubble puff out of meat
  playAirPuff() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(700, now + 0.12);
    bp.Q.value = 2.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.1, 0.15);
  }

  // Stage 2: Soft thumb dimple press (ぎゅーっ!)
  playDimple() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.18);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
    this.playNote(587.33, 0.25, 0.12, 0.06);
    this.playNote(783.99, 0.32, 0.14, 0.14);
  }

  // Stage 3: Continuous dynamic pan sizzle (ジュージュー!)
  startSizzleLoop() {
    if (!this._ready() || this.sizzleNodes) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7200;

    const g = this.ctx.createGain();
    g.gain.value = 0.0001;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start();

    this.sizzleNodes = { src, hp, lp, gain: g };
    this.sizzleActive = true;
  }

  updateSizzle(dt, heatLevel = 1, isCovered = false, butterAmount = 0, active = true) {
    if (!this.sizzleNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.sizzleNodes.gain.gain.setTargetAtTime(0.0001, now, 0.08);
      return;
    }
    const baseGain = 0.055 + heatLevel * 0.042 + butterAmount * 0.028;
    const targetGain = isCovered ? baseGain * 0.55 : baseGain;
    const targetLP = isCovered ? 2400 : 6200 + heatLevel * 1200;
    this.sizzleNodes.gain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.sizzleNodes.lp.frequency.setTargetAtTime(targetLP, now, 0.1);

    // Random lively oil crackle pops
    this.crackleTimer -= dt;
    if (this.crackleTimer <= 0) {
      this.crackleTimer = (0.09 + Math.random() * 0.22) / (0.6 + heatLevel * 0.45);
      this._playOilCrackle(isCovered ? 0.4 : 1.0);
    }
  }

  _playOilCrackle(scale = 1.0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 2800;
    bp.Q.value = 3.5;
    const g = this.ctx.createGain();
    const amp = (0.04 + Math.random() * 0.07) * scale;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.5, 0.04);
  }

  stopSizzleLoop() {
    if (!this.sizzleNodes) return;
    try {
      this.sizzleNodes.src.stop();
      this.sizzleNodes.src.disconnect();
    } catch (_) {}
    this.sizzleNodes = null;
    this.sizzleActive = false;
  }

  playDropSizzle() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.45);
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.8, 0.55);

    // Soft meat landing thump
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.09);
    og.gain.setValueAtTime(0.24, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(og);
    og.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playFlipWhoosh() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.22);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
    this.playNote(523.25, 0.2, 0.1, 0.02);
    this.playNote(659.25, 0.24, 0.11, 0.08);
    this.playNote(783.99, 0.28, 0.12, 0.15);
  }

  playLandSizzle() {
    this.playDropSizzle();
    this.playNote(587.33, 0.26, 0.11, 0.03);
    this.playNote(880.0, 0.34, 0.13, 0.09);
  }

  playLidClink(isCovering = true) {
    if (!this._ready()) return;
    const base = isCovering ? 680 : 820;
    this.playNote(base, 0.16, 0.12, 0, 'triangle');
    this.playNote(base * 1.48, 0.22, 0.08, 0.02, 'sine');
    if (!isCovering) {
      // Big fragrant steam puff release!
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1900, now);
      bp.frequency.exponentialRampToValueAtTime(850, now + 0.38);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 0.9, 0.42);
    }
  }

  playButterDrop() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.08);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
    this.playNote(659.25, 0.2, 0.1, 0.04);
    this.playNote(783.99, 0.24, 0.1, 0.1);
  }

  playKnobClick(level = 1) {
    if (!this._ready()) return;
    const freqs = [330, 440, 587.33];
    this.playNote(freqs[level % freqs.length], 0.12, 0.14, 0, 'triangle');
  }

  playPlateSlide() {
    if (!this._ready()) return;
    this.playNote(523.25, 0.24, 0.13, 0);
    this.playNote(659.25, 0.26, 0.13, 0.08);
    this.playNote(783.99, 0.3, 0.14, 0.16);
    this.playNote(1046.5, 0.42, 0.15, 0.24);
  }

  // Stage 4: Thick glossy demi-glace sauce pour (とろ〜り!)
  playSaucePour() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const notes = [293.66, 329.63, 392.0, 440.0, 523.25];
    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.075;
      osc.frequency.setValueAtTime(f * 0.85, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.09);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playKetchupSqueeze() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.16);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playToppingPop() {
    if (!this._ready()) return;
    this.playNote(493.88, 0.18, 0.12, 0);
    this.playNote(659.25, 0.22, 0.13, 0.06);
    this.playNote(987.77, 0.3, 0.12, 0.12);
  }

  // Stage 5: Tender cut + sparkling meat juice burst (肉汁ジュワ〜!)
  playCutJuicy(hasDimple = true) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    // Tender slice soft sound
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, now);
    bp.frequency.exponentialRampToValueAtTime(2800, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.7, 0.25);

    // Sparkling golden juice cascade!
    const notes = hasDimple
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0]
      : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.playNote(f, 0.32, 0.11, 0.04 + i * 0.055);
    });
  }

  // Stage 5: Cute eating munch (もぐもぐ!)
  playMunch(itemType = 'meat') {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const bites = itemType === 'carrot' ? 3 : 2;
    for (let i = 0; i < bites; i++) {
      const t = now + i * 0.19;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = itemType === 'carrot' ? 'triangle' : 'sine';
      const base = itemType === 'carrot' ? 420 : 260;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.58, t + 0.08);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.11);

      if (itemType === 'carrot' || itemType === 'broccoli') {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = itemType === 'carrot' ? 2400 : 1700;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.001, t);
        ng.gain.linearRampToValueAtTime(0.13, t + 0.01);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        src.start(t, Math.random() * 1.1, 0.08);
      }
    }
    // Cute joyful musical reaction!
    const motif = itemType === 'meat'
      ? [523.25, 659.25, 783.99, 1046.5]
      : itemType === 'egg'
      ? [587.33, 739.99, 880.0, 1174.66]
      : [440.0, 554.37, 659.25, 880.0];
    motif.forEach((f, i) => {
      this.playNote(f, 0.34, 0.11, 0.28 + i * 0.08);
    });
  }

  playHappyGiggle() {
    if (!this._ready()) return;
    const notes = [523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.playNote(f, 0.42, 0.13, i * 0.075);
    });
  }

  playStageCompleteChime() {
    if (!this._ready()) return;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      this.playNote(f, 0.55, 0.11, i * 0.06);
    });
  }

  playPropWiggle() {
    if (!this._ready()) return;
    this.playNote(440 + Math.random() * 160, 0.14, 0.08, 0, 'sine');
  }
}
