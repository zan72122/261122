// Procedural WebAudio Foley, Water/Foam Physics & Non-Verbal Expressive Voice Synth
// Zero external audio assets; <15ms latency tactile feedback.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.waterNode = null;
    this.waterGain = null;
    this.waterFilter = null;
    this.waterHiFilter = null;
    this.waterHiGain = null;
    this.waterRunning = false;
    this.showerMode = false;
    this.waterDropTimer = 0;
    this.lastScrubTime = 0;
    this.lastSqueakTime = 0;
    this.lastBubbleTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;

      // Soft limiter / compressor so overlapping splashes and chimes stay warm
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.12;

      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this._buildNoiseBuffer();
      this._setupWaterLoop();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Pink-ish weighted noise for natural water & sponge texture
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = pink * 0.7 + white * 0.3;
    }
    this.noiseBuffer = buf;
  }

  _setupWaterLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    this.waterFilter = this.ctx.createBiquadFilter();
    this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 680;
    this.waterFilter.Q.value = 0.85;

    this.waterHiFilter = this.ctx.createBiquadFilter();
    this.waterHiFilter.type = 'highpass';
    this.waterHiFilter.frequency.value = 2200;

    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.value = 0.0001;

    this.waterHiGain = this.ctx.createGain();
    this.waterHiGain.gain.value = 0.0001;

    src.connect(this.waterFilter);
    this.waterFilter.connect(this.waterGain);
    this.waterGain.connect(this.master);

    src.connect(this.waterHiFilter);
    this.waterHiFilter.connect(this.waterHiGain);
    this.waterHiGain.connect(this.master);

    src.start();
    this.waterNode = src;
  }

  setWaterStream(running, showerMode = false, dishHit = 0, waterLevel = 0) {
    this.waterRunning = running;
    this.showerMode = showerMode;
    if (!this.ctx || !this.waterGain) return;
    const now = this.ctx.currentTime;
    if (running) {
      const baseFreq = showerMode ? 1250 : (540 + waterLevel * 240 + dishHit * 220);
      this.waterFilter.frequency.setTargetAtTime(baseFreq, now, 0.06);
      this.waterFilter.Q.setTargetAtTime(showerMode ? 0.6 : 1.05, now, 0.06);
      this.waterGain.gain.setTargetAtTime(showerMode ? 0.13 : 0.20, now, 0.05);
      this.waterHiGain.gain.setTargetAtTime(showerMode ? 0.16 : (0.055 + dishHit * 0.05), now, 0.05);
    } else {
      this.waterGain.gain.setTargetAtTime(0.0001, now, 0.08);
      this.waterHiGain.gain.setTargetAtTime(0.0001, now, 0.06);
    }
  }

  update(dt, waterLevel = 0) {
    if (!this.ctx || !this.waterRunning) return;
    this.waterDropTimer -= dt;
    if (this.waterDropTimer <= 0) {
      this.waterDropTimer = this.showerMode
        ? 0.045 + Math.random() * 0.05
        : 0.03 + Math.random() * 0.045;
      this._playWaterDroplet(waterLevel);
    }
  }

  _playWaterDroplet(waterLevel = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const base = (this.showerMode ? 1300 : 720) + waterLevel * 320 + Math.random() * 950;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 0.78, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.42, now + 0.038);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(this.showerMode ? 0.022 : 0.04, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playFaucetClick(turningOn) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(turningOn ? 520 : 680, now);
    osc.frequency.exponentialRampToValueAtTime(turningOn ? 920 : 390, now + 0.045);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playSoapPump(variant = 0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Mechanical pump spring press
    const click = this.ctx.createBufferSource();
    click.buffer = this.noiseBuffer;
    const cf = this.ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 1400;
    cf.Q.value = 2.5;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.16, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    click.connect(cf);
    cf.connect(cg);
    cg.connect(this.master);
    click.start(now);
    click.stop(now + 0.05);

    // 2. Viscous gel "plop-squish"
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const pitchShift = variant === 1 ? 1.18 : 1.0;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210 * pitchShift, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(490 * pitchShift, now + 0.11);
    osc.frequency.exponentialRampToValueAtTime(175 * pitchShift, now + 0.21);

    g.gain.setValueAtTime(0.0001, now + 0.03);
    g.gain.linearRampToValueAtTime(0.28, now + 0.055);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now + 0.03);
    osc.stop(now + 0.24);

    // 3. Tiny sparkle bubble pop
    this.playBubblePop(0.7, now + 0.12);
  }

  playSpongeSqueeze(foamAmount = 0.5) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Wet cellular sponge squish
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(650, now);
    filt.frequency.exponentialRampToValueAtTime(1450, now + 0.12);
    filt.Q.value = 1.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 0.18);

    // Micro-bubble cluster pops ("moko-moko!")
    const count = 3 + Math.floor(foamAmount * 4);
    for (let i = 0; i < count; i++) {
      this.playBubblePop(0.45 + Math.random() * 0.4, now + 0.02 + i * 0.026);
    }
  }

  playScrub(speed = 1.0, cleanliness = 0.0, hasSoap = true) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastScrubTime < 0.075) return;
    this.lastScrubTime = now;

    const clampedSpeed = Math.min(2.0, Math.max(0.3, speed));
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + clampedSpeed * 0.3;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    const center = hasSoap
      ? 900 + cleanliness * 900 + clampedSpeed * 320
      : 480 + clampedSpeed * 220;
    filt.frequency.setValueAtTime(center * 0.85, now);
    filt.frequency.exponentialRampToValueAtTime(center * 1.25, now + 0.07);
    filt.Q.value = hasSoap ? 1.5 : 2.4;

    const g = this.ctx.createGain();
    const vol = Math.min(0.20, (0.06 + clampedSpeed * 0.065) * (hasSoap ? 1.0 : 0.65));
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.2, 0.1);

    if (hasSoap && Math.random() < 0.55) {
      this.playBubblePop(0.35, now + 0.015);
    }
    // Subtle emerging squeak when nearly clean!
    if (hasSoap && cleanliness > 0.78 && Math.random() < 0.35) {
      this.playSqueak(0.45, 1.0 + Math.random() * 0.25);
    }
  }

  playOilSlip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastScrubTime < 0.11) return;
    this.lastScrubTime = now;
    // Dull slippery squelch showing water/dry sponge alone slides over oil
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(190, now + 0.08);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playBubblePop(intensity = 0.8, startTime = null) {
    this.unlock();
    if (!this.ctx) return;
    const now = startTime ?? this.ctx.currentTime;
    if (startTime === null && now - this.lastBubbleTime < 0.02) return;
    if (startTime === null) this.lastBubbleTime = now;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f0 = 580 + Math.random() * 520;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 2.45, now + 0.042);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.11 * intensity, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playSqueak(volume = 0.9, pitchScale = 1.0, isGlass = false) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSqueakTime < 0.09) return;
    this.lastSqueakTime = now;

    if (isGlass) {
      // Crystal glass singing chime + squeak!
      const freqs = [1318.5, 1975.5, 2637.0].map((f) => f * pitchScale);
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime((0.12 / (idx + 1)) * volume, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        osc.connect(g);
        g.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.45);
      });
    }

    // Classic Japanese "Kyu-Kyu!" stick-slip porcelain squeak
    for (let i = 0; i < 2; i++) {
      const t0 = now + i * 0.105;
      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modG = this.ctx.createGain();
      const g = this.ctx.createGain();

      const baseF = (1480 + i * 240) * pitchScale;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseF * 0.86, t0);
      osc.frequency.exponentialRampToValueAtTime(baseF * 1.22, t0 + 0.055);
      osc.frequency.exponentialRampToValueAtTime(baseF * 0.96, t0 + 0.085);

      mod.frequency.value = 65;
      modG.gain.value = 45;
      mod.connect(modG);
      modG.connect(osc.frequency);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.15 * volume, t0 + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.088);

      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      mod.start(t0);
      osc.stop(t0 + 0.095);
      mod.stop(t0 + 0.095);
    }
  }

  playSparkleClean() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playSqueak(0.95, 1.05);

    // Bright celesta arpeggio (C6 - E6 - G6 - B6 - D7)
    const notes = [1046.5, 1318.5, 1567.98, 1975.53, 2349.32];
    notes.forEach((freq, i) => {
      const t = now + 0.14 + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  playRackClink() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Ceramic plate resting onto coated stainless steel wire rack ("Kachan!")
    const modes = [820, 1490, 2410, 3680];
    modes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * (0.98 + Math.random() * 0.04), now);
      g.gain.setValueAtTime(0.18 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 - i * 0.025);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.20);
    });

    // Pleasant two-note confirmation chime
    [880, 1318.5].forEach((f, idx) => {
      const t = now + 0.06 + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  playStopperPop(pluggingIn) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    if (pluggingIn) {
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.exponentialRampToValueAtTime(125, now + 0.09);
    } else {
      // Juicy suction pop + whirlpool gurgle!
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.065);
    }
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);

    if (!pluggingIn) {
      // Whirlpool drain gurgles
      for (let i = 0; i < 6; i++) {
        const t = now + 0.09 + i * 0.11;
        const go = this.ctx.createOscillator();
        const gg = this.ctx.createGain();
        go.type = 'sine';
        const gf = 260 + (6 - i) * 38 + Math.random() * 60;
        go.frequency.setValueAtTime(gf, t);
        go.frequency.exponentialRampToValueAtTime(gf * 0.65, t + 0.09);
        gg.gain.setValueAtTime(0.11, t);
        gg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        go.connect(gg);
        gg.connect(this.master);
        go.start(t);
        go.stop(t + 0.105);
      }
    }
  }

  playCrustPop() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.06);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Warm, wordless vocal expressions using soft formant-filtered harmonics
  playVoice(mood = 'happy') {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const playSyllable = (t, dur, fStart, fEnd, f1, f2, amp = 0.12) => {
      const src = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      src.type = 'sawtooth';
      sub.type = 'sine';

      src.frequency.setValueAtTime(fStart, t);
      src.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
      sub.frequency.setValueAtTime(fStart, t);
      sub.frequency.exponentialRampToValueAtTime(fEnd, t + dur);

      const form1 = this.ctx.createBiquadFilter();
      form1.type = 'bandpass';
      form1.frequency.value = f1;
      form1.Q.value = 4.2;

      const form2 = this.ctx.createBiquadFilter();
      form2.type = 'bandpass';
      form2.frequency.value = f2;
      form2.Q.value = 5.0;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(amp, t + Math.min(0.035, dur * 0.3));
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.55;

      src.connect(form1);
      src.connect(form2);
      form1.connect(lp);
      form2.connect(lp);
      sub.connect(subGain);
      subGain.connect(lp);
      lp.connect(env);
      env.connect(this.master);

      src.start(t);
      sub.start(t);
      src.stop(t + dur + 0.01);
      sub.stop(t + dur + 0.01);
    };

    if (mood === 'ooh') {
      playSyllable(now, 0.22, 370, 490, 520, 1080, 0.10);
    } else if (mood === 'giggle') {
      playSyllable(now, 0.09, 440, 510, 680, 1950, 0.09);
      playSyllable(now + 0.11, 0.09, 480, 560, 680, 1950, 0.10);
      playSyllable(now + 0.22, 0.13, 520, 610, 740, 2050, 0.10);
    } else if (mood === 'oops') {
      playSyllable(now, 0.15, 460, 360, 720, 1240, 0.10);
    } else if (mood === 'yummy') {
      // Soft bite pop + blissful hum
      this.playBubblePop(0.5, now);
      playSyllable(now + 0.08, 0.11, 390, 430, 760, 1300, 0.09);
      playSyllable(now + 0.22, 0.32, 420, 525, 420, 1050, 0.11);
    } else if (mood === 'sparkle' || mood === 'happy') {
      playSyllable(now, 0.14, 420, 540, 820, 1550, 0.10);
      playSyllable(now + 0.15, 0.26, 540, 660, 860, 1720, 0.12);
    } else if (mood === 'party') {
      playSyllable(now, 0.14, 440, 554, 820, 1620, 0.11);
      playSyllable(now + 0.16, 0.14, 554, 659, 850, 1750, 0.11);
      playSyllable(now + 0.32, 0.32, 659, 880, 890, 1880, 0.13);
      // Warm celebratory chord
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        const t = now + 0.12 + idx * 0.07;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.09, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.68);
      });
    }
  }
}
