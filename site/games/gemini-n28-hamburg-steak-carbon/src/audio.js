// Expressive wordless WebAudio synthesizer & tactile cooking foley engine
// Conveys story, emotion, and physical materiality purely through sound & music.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.masterGain = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.sizzleLfoGain = null;
    this.sizzleTarget = 0;
    this.noiseBuffer = null;
    this.bgmTimer = 0;
    this.bgmStep = 0;
    this.lastSquishTime = 0;
    this.lastPourTime = 0;
    this.stageMood = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.78;
      this.masterGain.connect(this.ctx.destination);

      this._createNoiseBuffer();
      this._setupSizzleLoop();
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
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Crisp crackle spikes mixed with warm pink-ish noise
      const crackle = Math.random() < 0.014 ? (Math.random() * 2 - 1) * 2.4 : 0;
      last = last * 0.62 + white * 0.38;
      data[i] = Math.max(-1, Math.min(1, last * 0.8 + white * 0.35 + crackle));
    }
    this.noiseBuffer = buf;
  }

  _setupSizzleLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 950;

    this.sizzleFilter = this.ctx.createBiquadFilter();
    this.sizzleFilter.type = 'bandpass';
    this.sizzleFilter.frequency.value = 3400;
    this.sizzleFilter.Q.value = 0.75;

    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.0001;

    src.connect(hp);
    hp.connect(this.sizzleFilter);
    this.sizzleFilter.connect(this.sizzleGain);
    this.sizzleGain.connect(this.masterGain);
    src.start();
  }

  setSizzle(level, muffled = false) {
    this.sizzleTarget = Math.max(0, Math.min(1, level));
    if (this.sizzleFilter && this.ctx) {
      const freq = muffled ? 1350 : 3500;
      this.sizzleFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
    }
  }

  update(dt, stageIndex = 0) {
    if (!this.unlocked || !this.ctx) return;
    this.stageMood = stageIndex;

    // Smooth sizzle envelope + subtle organic crackle flutter
    if (this.sizzleGain) {
      const flutter = this.sizzleTarget > 0.02 ? (0.86 + Math.random() * 0.28) : 1;
      const target = this.sizzleTarget * 0.22 * flutter;
      this.sizzleGain.gain.setTargetAtTime(Math.max(0.0001, target), this.ctx.currentTime, 0.05);
    }

    // Gentle sunlit acoustic marimba/celesta kitchen motif
    this.bgmTimer += dt;
    const stepInterval = stageIndex === 2 ? 0.42 : 0.48;
    if (this.bgmTimer >= stepInterval) {
      this.bgmTimer -= stepInterval;
      this._playBgmStep();
    }
  }

  _playBgmStep() {
    // Cozy F-major / C-major pentatonic anime-film morning kitchen melody
    const pattern = [
      349.23, 0, 440.0, 523.25,
      587.33, 0, 523.25, 440.0,
      392.00, 440.0, 523.25, 0,
      659.25, 587.33, 523.25, 0,
      349.23, 440.0, 523.25, 659.25,
      587.33, 0, 440.0, 392.00,
      349.23, 0, 293.66, 349.23,
      392.00, 0, 440.00, 0
    ];
    const bass = [
      174.61, 0, 0, 0,  146.83, 0, 0, 0,
      196.00, 0, 0, 0,  130.81, 0, 0, 0,
      174.61, 0, 0, 0,  146.83, 0, 0, 0,
      196.00, 0, 0, 0,  130.81, 0, 196.00, 0
    ];
    const idx = this.bgmStep % pattern.length;
    this.bgmStep++;

    const note = pattern[idx];
    const bassNote = bass[idx];
    const now = this.ctx.currentTime;

    if (note > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.036, now + 0.016);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.38);
    }

    if (bassNote > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(bassNote, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.48);
    }
  }

  // Plump golden egg yolk pop!
  playYolkPop() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.055);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    this.playSparkleNote(880, 0.06);
  }

  // Tactile wet meat knead squish ("むにゅっ・くちゃっ")
  playKneadSquish(intensity = 0.7) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSquishTime < 0.11) return;
    this.lastSquishTime = now;

    // Rubbery low body
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const baseFreq = 135 + Math.random() * 55;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, now + 0.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * intensity, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);

    // Wet noise squish
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(650 + Math.random() * 450, now);
      bp.frequency.exponentialRampToValueAtTime(1450, now + 0.09);
      bp.Q.value = 2.6;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.16 * intensity, now + 0.018);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      nSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.masterGain);
      nSrc.start(now, Math.random() * 0.8, 0.14);
    }
  }

  // Crisp rhythmic "ぺちっ！ ぱんっ！" palm-to-palm air release slap!
  playPechiSlap(stepIndex = 0) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Warm palm slap transient
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1250 + (stepIndex % 2) * 260, now);
      bp.Q.value = 1.4;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.34, now + 0.006);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      nSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.masterGain);
      nSrc.start(now, Math.random() * 0.5, 0.09);
    }

    // Plump dough thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 + (stepIndex % 2) * 30, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.085);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);

    // Tiny escaping air bubble "ぷわっ♪" ascending marimba pop
    const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 1046.5];
    const pitch = scale[Math.min(stepIndex, scale.length - 1)];
    const bOsc = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    bOsc.type = 'sine';
    bOsc.frequency.setValueAtTime(pitch * 0.82, now + 0.035);
    bOsc.frequency.exponentialRampToValueAtTime(pitch * 1.18, now + 0.12);
    bGain.gain.setValueAtTime(0.001, now + 0.035);
    bGain.gain.linearRampToValueAtTime(0.14, now + 0.05);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    bOsc.connect(bGain);
    bGain.connect(this.masterGain);
    bOsc.start(now + 0.035);
    bOsc.stop(now + 0.17);
  }

  // Pressing the cute center dimple ("むにゅ〜ん♪")
  playDimplePress() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.34);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Stove ignition & patty landing in hot buttered skillet ("ボッ！ ジュワァァ！！")
  playPanDropSizzle() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2800, now);
      bp.frequency.exponentialRampToValueAtTime(4200, now + 0.15);
      bp.Q.value = 0.65;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.36, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      nSrc.connect(bp);
      bp.connect(gain);
      gain.connect(this.masterGain);
      nSrc.start(now, 0, 0.6);
    }
    this.playSparkleNote(523.25, 0.02);
  }

  // Big triumphant skillet flip! ("ひゅっ… くるんっ… ジュワァン！！")
  playBigFlip() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Upward air whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.28);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.34);

    // Landing sear burst + warm triumphant chord at t + 0.52s
    const land = now + 0.52;
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, land);
      nGain.gain.linearRampToValueAtTime(0.38, land + 0.02);
      nGain.gain.exponentialRampToValueAtTime(0.001, land + 0.45);
      nSrc.connect(hp);
      hp.connect(nGain);
      nGain.connect(this.masterGain);
      nSrc.start(land, 0.2, 0.5);
    }

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playSparkleNote(freq, 0.52 + i * 0.045, 0.14);
    });
  }

  // Putting dome lid on or lifting steam puff!
  playSteamPuff(open = false) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Gentle metallic/glass clink
    const cOsc = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    cOsc.type = 'sine';
    cOsc.frequency.setValueAtTime(open ? 1320 : 980, now);
    cGain.gain.setValueAtTime(0.14, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    cOsc.connect(cGain);
    cGain.connect(this.masterGain);
    cOsc.start(now);
    cOsc.stop(now + 0.2);

    // Soft warm steam rush
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(open ? 1600 : 900, now);
      lp.frequency.exponentialRampToValueAtTime(open ? 3200 : 600, now + 0.42);
      lp.Q.value = 0.9;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(open ? 0.26 : 0.16, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      nSrc.connect(lp);
      lp.connect(gain);
      gain.connect(this.masterGain);
      nSrc.start(now, 0.1, 0.52);
    }
    if (open) {
      [587.33, 783.99, 987.77, 1174.66].forEach((f, i) => this.playSparkleNote(f, 0.06 + i * 0.05, 0.12));
    }
  }

  // Sauce pour velvety glug & shimmer ("とろ〜り♪")
  playSaucePour(progress = 0.5) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPourTime < 0.095) return;
    this.lastPourTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const base = 330 + progress * 340 + Math.random() * 45;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.24, now + 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Topping plop (cheese or sunny egg!)
  playToppingPlop(kind = 'cheese') {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    if (kind === 'cheese') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Cutting into juicy hamburg steak ("サクッ… 肉汁じゅわわ〜✨")
  playJuicyCut() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200, now);
      bp.Q.value = 1.2;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      nSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.masterGain);
      nSrc.start(now, 0.3, 0.3);
    }
    [523.25, 659.25, 783.99, 987.77, 1318.5].forEach((f, i) => {
      this.playSparkleNote(f, 0.04 + i * 0.05, 0.12);
    });
  }

  // Expressive non-verbal character reactions (giggle, amazed, munch, veggie crunch, bliss!)
  playGirlReaction(kind = 'giggle') {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (kind === 'giggle') {
      [659.25, 783.99, 880.0].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.075);
        osc.frequency.exponentialRampToValueAtTime(f * 1.12, now + i * 0.075 + 0.06);
        g.gain.setValueAtTime(0.001, now + i * 0.075);
        g.gain.linearRampToValueAtTime(0.13, now + i * 0.075 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.075 + 0.08);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now + i * 0.075);
        osc.stop(now + i * 0.075 + 0.09);
      });
    } else if (kind === 'aan') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.18);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (kind === 'chomp') {
      // Cute "ぱくっ！ もぐもぐ♪"
      [0, 0.22, 0.42].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const f = idx === 0 ? 310 : (idx === 1 ? 392 : 440);
        osc.frequency.setValueAtTime(f, now + offset);
        osc.frequency.exponentialRampToValueAtTime(f * 0.68, now + offset + 0.11);
        g.gain.setValueAtTime(0.001, now + offset);
        g.gain.linearRampToValueAtTime(idx === 0 ? 0.25 : 0.16, now + offset + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.14);
      });
    } else if (kind === 'crunch') {
      // Crisp broccoli/carrot crunch ("シャキッ！")
      if (this.noiseBuffer) {
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.value = 2600;
        hp.Q.value = 1.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.28, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        nSrc.connect(hp);
        hp.connect(g);
        g.connect(this.masterGain);
        nSrc.start(now, 0.4, 0.13);
      }
      this.playSparkleNote(698.46, 0.08, 0.14);
      this.playSparkleNote(880.0, 0.15, 0.14);
    } else if (kind === 'bliss') {
      // Warm major-9th celesta fanfare ("ん〜〜〜♡ おいしい！！")
      const chord = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
      chord.forEach((f, i) => {
        this.playSparkleNote(f, i * 0.065, 0.16);
      });
    } else if (kind === 'wobble') {
      this.playSparkleNote(466.16, 0, 0.08);
    }
  }

  playSparkleNote(freq = 880, delay = 0, volume = 0.12) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.36);
  }
}
