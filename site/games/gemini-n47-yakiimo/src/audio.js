/**
 * Procedural Web Audio foley synthesizer for autumn bonfire & yakiimo.
 * Warm, organic, tactile sound design with zero external audio files.
 */
export class YakiimoAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.master = null;
    this.fireGain = null;
    this.windGain = null;
    this.sizzleGain = null;
    this.unlocked = false;
    this.fireLevel = 0.2;
    this.sizzleLevel = 0;
    this._crackleTimer = 0;
  }

  unlock() {
    if (this.unlocked) {
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

    // 2-second reusable white noise buffer
    const sr = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, sr * 2, sr);
    const ch = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      ch[i] = Math.random() * 2 - 1;
    }

    // Continuous ambient autumn breeze
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuf;
    windSrc.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.025;
    windSrc.connect(windFilter).connect(this.windGain).connect(this.master);
    windSrc.start();

    // Continuous warm bonfire rumble
    const fireSrc = this.ctx.createBufferSource();
    fireSrc.buffer = this.noiseBuf;
    fireSrc.loop = true;
    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 260;
    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.value = 0.04;
    fireSrc.connect(fireFilter).connect(this.fireGain).connect(this.master);
    fireSrc.start();

    // Continuous soft roasting sizzle bed (controlled by sizzleLevel)
    const sizSrc = this.ctx.createBufferSource();
    sizSrc.buffer = this.noiseBuf;
    sizSrc.loop = true;
    const sizFilter = this.ctx.createBiquadFilter();
    sizFilter.type = 'bandpass';
    sizFilter.frequency.value = 4600;
    sizFilter.Q.value = 1.2;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.0001;
    sizSrc.connect(sizFilter).connect(this.sizzleGain).connect(this.master);
    sizSrc.start();

    this.unlocked = true;
  }

  update(dt, fireIntensity, sizzleAmount) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.fireLevel = fireIntensity;
    this.sizzleLevel = sizzleAmount;

    this.fireGain.gain.setTargetAtTime(0.025 + fireIntensity * 0.14, now, 0.18);
    this.sizzleGain.gain.setTargetAtTime(sizzleAmount * 0.075, now, 0.2);

    // Random wood/leaf crackles scaled by fire intensity
    this._crackleTimer -= dt;
    if (this._crackleTimer <= 0) {
      this._crackleTimer = (0.08 + Math.random() * 0.35) / Math.max(0.25, fireIntensity * 1.4);
      if (Math.random() < 0.45 + fireIntensity * 0.5) {
        this.playCrackle(0.35 + fireIntensity * 0.65);
      }
    }
  }

  playCrackle(strength = 0.6) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600 + Math.random() * 3400;
    filter.Q.value = 3.5;

    const gain = this.ctx.createGain();
    const vol = (0.04 + Math.random() * 0.08) * strength;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.025 + Math.random() * 0.035);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(now, Math.random() * 1.5, 0.07);
  }

  // Crisp dry autumn leaves rustling (カサカサッ)
  playLeafRustle(intensity = 0.7) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const count = 2 + Math.floor(intensity * 3);
    for (let i = 0; i < count; i++) {
      const delay = i * (0.025 + Math.random() * 0.025);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200 + Math.random() * 2400, now + delay);
      bp.frequency.exponentialRampToValueAtTime(1100 + Math.random() * 900, now + delay + 0.09);
      bp.Q.value = 2.2;

      const g = this.ctx.createGain();
      const peak = (0.06 + intensity * 0.1) * (0.7 + Math.random() * 0.4);
      g.gain.setValueAtTime(0.0005, now + delay);
      g.gain.linearRampToValueAtTime(peak, now + delay + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, now + delay + 0.095);

      src.connect(bp).connect(g).connect(this.master);
      src.start(now + delay, Math.random() * 1.4, 0.12);
    }
  }

  // Crisp metallic aluminum foil crinkle (クシャクシャッ)
  playFoilCrinkle(intensity = 0.8) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const bursts = 4 + Math.floor(intensity * 4);
    for (let i = 0; i < bursts; i++) {
      const d = i * (0.018 + Math.random() * 0.022);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 3800 + Math.random() * 4800;
      hp.Q.value = 4.2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + d);
      g.gain.linearRampToValueAtTime(0.11 * intensity * (0.6 + Math.random() * 0.5), now + d + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, now + d + 0.045 + Math.random() * 0.03);

      src.connect(hp).connect(g).connect(this.master);
      src.start(now + d, Math.random() * 1.6, 0.09);
    }
  }

  // Warm flame whoosh when leaves ignite or fire is fanned
  playFlameWhoosh(strength = 0.8) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(160, now);
    lp.frequency.exponentialRampToValueAtTime(640, now + 0.16);
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.55);
    lp.Q.value = 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24 * strength, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    src.connect(lp).connect(g).connect(this.master);
    src.start(now, Math.random() * 0.8, 0.65);
  }

  // Soft thump + spark burst when potato lands in embers
  playEmberDrop() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);

    this.playFlameWhoosh(0.65);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playCrackle(0.95), i * 38);
    }
  }

  // Soft warm organic break & billowing steam hiss (ホクッ…パカッ…シュー！)
  playPotatoBreak() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Soft fibrous tear-snap
    const src1 = this.ctx.createBufferSource();
    src1.buffer = this.noiseBuf;
    const bp1 = this.ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.setValueAtTime(920, now);
    bp1.frequency.exponentialRampToValueAtTime(340, now + 0.18);
    bp1.Q.value = 1.6;
    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.001, now);
    g1.gain.linearRampToValueAtTime(0.26, now + 0.025);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src1.connect(bp1).connect(g1).connect(this.master);
    src1.start(now, 0.2, 0.25);

    // Warm hollow pop
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.12);
    const go = this.ctx.createGain();
    go.gain.setValueAtTime(0.18, now);
    go.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(go).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);

    // Luscious billowing hot steam hiss (ほわぁ〜)
    const src2 = this.ctx.createBufferSource();
    src2.buffer = this.noiseBuf;
    const bp2 = this.ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.setValueAtTime(2200, now + 0.05);
    bp2.frequency.exponentialRampToValueAtTime(1100, now + 1.25);
    bp2.Q.value = 1.0;
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.001, now + 0.04);
    g2.gain.linearRampToValueAtTime(0.14, now + 0.22);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    src2.connect(bp2).connect(g2).connect(this.master);
    src2.start(now + 0.04, 0.4, 1.4);

    // Warm cozy acoustic kalimba major triad bloom
    this.playWarmNote(392.0, 0.08, 0.12);
    this.playWarmNote(493.88, 0.18, 0.10);
    this.playWarmNote(587.33, 0.28, 0.12);
  }

  // Gentle blowing breath (ふーふー) when swiping across steam
  playBlowBreath() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(680, now);
    bp.frequency.linearRampToValueAtTime(980, now + 0.14);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.48);
    bp.Q.value = 2.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now, Math.random() * 0.9, 0.52);
  }

  // Warm soft bite (あむっ！ホクホク) + gentle acoustic note
  playBite(stepIndex = 0) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1150, now);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    bp.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now, Math.random(), 0.15);

    const scale = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];
    this.playWarmNote(scale[stepIndex % scale.length], 0.03, 0.14);
  }

  playWarmNote(freq, delay = 0, vol = 0.12) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const overtone = this.ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0005, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.65);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.22, now);
    g2.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);

    osc.connect(g).connect(this.master);
    overtone.connect(g2).connect(this.master);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.7);
    overtone.stop(now + 0.25);
  }
}
