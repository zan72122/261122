// Procedural Web Audio Foley Engine — realistic cast-iron sizzle, oil pops, batter pour, pick scrape, sauce glaze & warm non-verbal reactions
export class TakoyakiAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sizzleGain = null;
    this.hissGain = null;
    this.pourGain = null;
    this.noiseBuffer = null;
    this.targetSizzle = 0.08;
    this.currentSizzle = 0.0;
    this.popTimer = 0;
  }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Create 2.5s rich noise buffer
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 2.5);
    this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.950 * b2 + w * 0.048;
      // Mix pink warmth + crisp white sizzle + micro oil crackles
      const crackle = Math.random() > 0.9965 ? (Math.random() * 2 - 1) * 1.9 : 0;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2) * 0.55 + w * 0.32 + crackle));
    }

    // Master limiter/compressor
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(this.ctx.destination);

    // Continuous cast-iron sizzle loop (mid body + high oil hiss)
    const src1 = this.ctx.createBufferSource();
    src1.buffer = this.noiseBuffer;
    src1.loop = true;
    const bp1 = this.ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 1850;
    bp1.Q.value = 0.85;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.02;
    src1.connect(bp1);
    bp1.connect(this.sizzleGain);
    this.sizzleGain.connect(this.master);
    src1.start();

    const src2 = this.ctx.createBufferSource();
    src2.buffer = this.noiseBuffer;
    src2.loop = true;
    src2.loopStart = 0.37;
    const hp2 = this.ctx.createBiquadFilter();
    hp2.type = 'highpass';
    hp2.frequency.value = 4200;
    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = 0.01;
    src2.connect(hp2);
    hp2.connect(this.hissGain);
    this.hissGain.connect(this.master);
    src2.start();

    // Continuous batter-pour surge channel
    const srcPour = this.ctx.createBufferSource();
    srcPour.buffer = this.noiseBuffer;
    srcPour.loop = true;
    srcPour.loopStart = 0.8;
    const pourFilter = this.ctx.createBiquadFilter();
    pourFilter.type = 'bandpass';
    pourFilter.frequency.value = 2400;
    pourFilter.Q.value = 0.7;
    this.pourFilter = pourFilter;
    this.pourGain = this.ctx.createGain();
    this.pourGain.gain.value = 0;
    srcPour.connect(pourFilter);
    pourFilter.connect(this.pourGain);
    this.pourGain.connect(this.master);
    srcPour.start();

    this.unlocked = true;
  }

  update(dt, heatActivity, isPouring) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.targetSizzle = 0.018 + Math.min(1, heatActivity) * 0.14;
    this.currentSizzle += (this.targetSizzle - this.currentSizzle) * Math.min(1, dt * 5);
    this.sizzleGain.gain.setTargetAtTime(this.currentSizzle, now, 0.06);
    this.hissGain.gain.setTargetAtTime(this.currentSizzle * 0.55, now, 0.06);

    const pourTarget = isPouring ? 0.22 : 0.0;
    this.pourGain.gain.setTargetAtTime(pourTarget, now, isPouring ? 0.03 : 0.09);
    if (isPouring) {
      this.pourFilter.frequency.setTargetAtTime(1900 + Math.sin(now * 14) * 350, now, 0.04);
    }

    // Occasional realistic tiny oil-pop transients ("パチッ！")
    this.popTimer -= dt * (0.6 + heatActivity * 4.2);
    if (this.popTimer <= 0) {
      this.popTimer = 0.08 + Math.random() * 0.35;
      if (heatActivity > 0.08) {
        this.playOilPop(0.04 + Math.random() * 0.07 * heatActivity);
      }
    }
  }

  playOilPop(vol = 0.08) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 3800;
    bp.Q.value = 3.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.028);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 2.0, 0.035);
  }

  playSteamBurst(intensity = 0.22) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(1350, now + 0.32);
    bp.Q.value = 0.75;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(intensity, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.5, 0.42);
  }

  playOctopusDrop() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Plump wet "ぽちゃっ！" + sizzling splash
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210 + Math.random() * 30, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.065);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.13);

    this.playSteamBurst(0.20);
    this.playOilPop(0.14);
  }

  playToppingSprinkle() {
    if (!this.unlocked || !this.ctx) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.playOilPop(0.09), i * 35);
    }
    this.playSteamBurst(0.11);
  }

  playPickTurn(isFullRound = false) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Crisp stainless steel pick touching seasoned cast iron ("カチッ・シャッ")
    const metal = this.ctx.createOscillator();
    metal.type = 'triangle';
    metal.frequency.setValueAtTime(isFullRound ? 2950 : 2450, now);
    metal.frequency.exponentialRampToValueAtTime(1400, now + 0.035);
    const mg = this.ctx.createGain();
    mg.gain.setValueAtTime(0.11, now);
    mg.gain.exponentialRampToValueAtTime(0.0008, now + 0.04);
    metal.connect(mg);
    mg.connect(this.master);
    metal.start(now);
    metal.stop(now + 0.045);

    // Elastic baked dough thump ("クルッ・ポンッ！")
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(isFullRound ? 155 : 125, now + 0.015);
    thump.frequency.exponentialRampToValueAtTime(isFullRound ? 245 : 175, now + 0.085);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.22, now + 0.015);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    thump.connect(tg);
    tg.connect(this.master);
    thump.start(now + 0.015);
    thump.stop(now + 0.12);

    this.playSteamBurst(isFullRound ? 0.18 : 0.24);
  }

  playSauceGlaze() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Thick wet brush/glaze + hot caramel sizzle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(950, now);
    lp.frequency.linearRampToValueAtTime(1850, now + 0.14);
    lp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.5, 0.2);
  }

  playBonitoRustle() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.085, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.5, 0.18);
  }

  playFuuFuuAndBite(isHighVoice = true) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Two gentle "ふーっ、ふーっ" breath puffs
    for (let k = 0; k < 2; k++) {
      const t0 = now + k * 0.26;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = isHighVoice ? 1050 : 780;
      bp.Q.value = 2.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t0, Math.random() * 1.2, 0.21);
    }

    // Crisp happy bite ("ぱくっ！") + warm non-verbal vocalized delight hum
    const bt = now + 0.56;
    const biteSrc = this.ctx.createBufferSource();
    biteSrc.buffer = this.noiseBuffer;
    const biteBp = this.ctx.createBiquadFilter();
    biteBp.type = 'bandpass';
    biteBp.frequency.value = 1600;
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.18, bt);
    bg.gain.exponentialRampToValueAtTime(0.001, bt + 0.07);
    biteSrc.connect(biteBp);
    biteBp.connect(bg);
    bg.connect(this.master);
    biteSrc.start(bt, 0.2, 0.08);

    // Warm resonant non-verbal hum ("ん〜♪")
    const hum = this.ctx.createOscillator();
    hum.type = 'triangle';
    const baseF = isHighVoice ? 310 : 195;
    hum.frequency.setValueAtTime(baseF, bt + 0.12);
    hum.frequency.linearRampToValueAtTime(baseF * 1.26, bt + 0.34);
    hum.frequency.linearRampToValueAtTime(baseF * 1.18, bt + 0.58);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 720;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.001, bt + 0.12);
    hg.gain.linearRampToValueAtTime(0.11, bt + 0.20);
    hg.gain.exponentialRampToValueAtTime(0.001, bt + 0.62);
    hum.connect(lp);
    lp.connect(hg);
    hg.connect(this.master);
    hum.start(bt + 0.12);
    hum.stop(bt + 0.65);
  }

  playOilBrush() {
    if (!this.unlocked || !this.ctx) return;
    this.playSteamBurst(0.16);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playOilPop(0.08 + Math.random() * 0.05), i * 38);
    }
  }

  playMayoSqueeze() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  playBoatPlace() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft hollow bamboo boat tap ("コトン")
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.055);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}
