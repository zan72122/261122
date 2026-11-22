/**
 * Procedural Web Audio API sound engine for photorealistic Nabe night ambiance:
 * - Soft winter rain pattering on window glass
 * - Continuous dynamic boiling/simmering broth (ぐつぐつ) + resonant bubble pops
 * - Gas stove mechanical click & gentle flame hiss
 * - Ceramic donabe lid clink, boiling rattle (コトコト), & steam cloud release
 * - Wet ingredient splashes (ぽちゃん), broth stirring swish, ladle scoop & pour
 * - Window condensation wipe sound
 * - Warm wordless family reactions (breath blow ふーふー, happy hums, gentle laughs)
 */
export class NabeAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.noiseBuffer = null;

    this.rainGain = null;
    this.boilRumbleGain = null;
    this.boilFilter = null;
    this.flameGain = null;
    this.steamJetGain = null;

    this.bubbleTimer = 0;
    this.rattleTimer = 0;
    this.rainDropTimer = 0;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    try {
      this.ctx = new AC();
      this.unlocked = true;
      this._createNoiseBuffer();
      this._startAmbientBeds();
    } catch {
      // Ignore audio errors on restricted environments
    }
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 3;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Pink-ish warm noise via Paul Kellet filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buf;
  }

  _startAmbientBeds() {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Soft winter rain outside window
    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffer;
    rainSrc.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1150;
    rainFilter.Q.value = 0.55;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.09;
    rainSrc.connect(rainFilter).connect(this.rainGain).connect(this.ctx.destination);
    rainSrc.start();

    // 2. Continuous simmering/boiling broth body rumble
    const boilSrc = this.ctx.createBufferSource();
    boilSrc.buffer = this.noiseBuffer;
    boilSrc.loop = true;
    this.boilFilter = this.ctx.createBiquadFilter();
    this.boilFilter.type = 'lowpass';
    this.boilFilter.frequency.value = 340;
    this.boilFilter.Q.value = 1.6;
    this.boilRumbleGain = this.ctx.createGain();
    this.boilRumbleGain.gain.value = 0.001;
    boilSrc.connect(this.boilFilter).connect(this.boilRumbleGain).connect(this.ctx.destination);
    boilSrc.start();

    // 3. Soft cassette gas stove flame hiss
    const flameSrc = this.ctx.createBufferSource();
    flameSrc.buffer = this.noiseBuffer;
    flameSrc.loop = true;
    const flameFilter = this.ctx.createBiquadFilter();
    flameFilter.type = 'bandpass';
    flameFilter.frequency.value = 520;
    flameFilter.Q.value = 0.9;
    this.flameGain = this.ctx.createGain();
    this.flameGain.gain.value = 0.025;
    flameSrc.connect(flameFilter).connect(this.flameGain).connect(this.ctx.destination);
    flameSrc.start();

    // 4. Steam whistle through lid vent hole when covered & boiling
    const steamSrc = this.ctx.createBufferSource();
    steamSrc.buffer = this.noiseBuffer;
    steamSrc.loop = true;
    const steamFilter = this.ctx.createBiquadFilter();
    steamFilter.type = 'bandpass';
    steamFilter.frequency.value = 2400;
    steamFilter.Q.value = 2.6;
    this.steamJetGain = this.ctx.createGain();
    this.steamJetGain.gain.value = 0.0001;
    steamSrc.connect(steamFilter).connect(this.steamJetGain).connect(this.ctx.destination);
    steamSrc.start();
  }

  update(dt, { boilLevel = 0, heatLevel = 0.5, lidOn = false }) {
    if (!this.unlocked || !this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const lidMuffle = lidOn ? 0.58 : 1.0;

    if (this.boilRumbleGain) {
      const target = Math.max(0.002, boilLevel * 0.24 * lidMuffle);
      this.boilRumbleGain.gain.setTargetAtTime(target, now, 0.15);
      this.boilFilter.frequency.setTargetAtTime(240 + boilLevel * 440 * lidMuffle, now, 0.15);
    }

    if (this.flameGain) {
      this.flameGain.gain.setTargetAtTime(0.012 + heatLevel * 0.055, now, 0.12);
    }

    if (this.steamJetGain) {
      const jet = lidOn && boilLevel > 0.35 ? (boilLevel - 0.35) * 0.12 : 0.0001;
      this.steamJetGain.gain.setTargetAtTime(jet, now, 0.18);
    }

    // Stochastic boiling bubbles (ぐつぐつ / ぽこぽこ)
    if (boilLevel > 0.08) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this._playBubblePop(boilLevel, lidOn);
        const rate = 2.5 + boilLevel * 18;
        this.bubbleTimer = (0.4 + Math.random() * 1.2) / rate;
      }
    }

    // Lid ceramic rattle (コトコト) when boiling with lid on
    if (lidOn && boilLevel > 0.58) {
      this.rattleTimer -= dt;
      if (this.rattleTimer <= 0) {
        this.playCeramicClink(0.18 + (boilLevel - 0.58) * 0.35, 0.85 + Math.random() * 0.25);
        this.rattleTimer = 0.14 + Math.random() * (0.35 - boilLevel * 0.2);
      }
    }

    // Occasional soft window raindrop tap
    this.rainDropTimer -= dt;
    if (this.rainDropTimer <= 0) {
      this._playRainTap();
      this.rainDropTimer = 0.35 + Math.random() * 0.9;
    }
  }

  _playBubblePop(boilLevel, lidOn) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const baseFreq = (170 + Math.random() * 280) * (lidOn ? 0.78 : 1.0);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.62, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + 0.048);

    const vol = (0.015 + boilLevel * 0.055) * (lidOn ? 0.55 : 1.0) * (0.5 + Math.random() * 0.6);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.058);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  _playRainTap() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const f = 900 + Math.random() * 1400;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.022);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.009 + Math.random() * 0.008, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  playSplash(intensity = 1.0) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Resonant liquid plop (ぽちゃん)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const f0 = 190 + Math.random() * 70;
    osc.frequency.setValueAtTime(f0 * 1.25, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.68, now + 0.035);
    osc.frequency.exponentialRampToValueAtTime(f0 * 2.4, now + 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18 * intensity, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    // Filtered water splash burst
    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400, now);
      bp.frequency.exponentialRampToValueAtTime(600, now + 0.22);
      bp.Q.value = 1.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(0.22 * intensity, now + 0.015);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      n.connect(bp).connect(ng).connect(this.ctx.destination);
      n.start(now, Math.random() * 1.5, 0.28);
    }
  }

  playPickup(soft = false) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f = soft ? 260 : 340;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.38, now + 0.07);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playCeramicClink(vol = 0.22, pitch = 1.0) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const partials = [520, 1140, 2180];
    partials.forEach((p, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p * pitch, now);
      const pv = (vol * 0.4) / (idx + 1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(pv, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11 / (idx + 0.7));
      osc.connect(g).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    });
  }

  playSteamWhoosh(strength = 1.0) {
    if (!this.unlocked || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1750, now);
    bp.frequency.exponentialRampToValueAtTime(680, now + 0.75);
    bp.Q.value = 0.85;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.32 * strength, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(now, Math.random(), 0.9);
  }

  playStoveClick(heatLevel) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Mechanical click
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.025);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);

    // Soft gas flame flare whoosh
    if (this.noiseBuffer && heatLevel > 0.2) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320 + heatLevel * 480, now);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(0.16 * heatLevel, now + 0.03);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      src.connect(lp).connect(ng).connect(this.ctx.destination);
      src.start(now, Math.random(), 0.25);
    }
  }

  playLadleScoop() {
    if (!this.unlocked || !this.ctx) return;
    this.playSplash(0.65);
    this.playCeramicClink(0.12, 1.35);
  }

  playPour() {
    if (!this.unlocked || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(750, now);
    bp.frequency.linearRampToValueAtTime(1350, now + 0.35);
    bp.frequency.linearRampToValueAtTime(980, now + 0.55);
    bp.Q.value = 1.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.06);
    g.gain.linearRampToValueAtTime(0.18, now + 0.38);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(now, Math.random(), 0.65);

    // Couple of soft liquid glugs
    for (let i = 0; i < 3; i++) {
      const t = now + 0.07 + i * 0.13;
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'sine';
      const bf = 260 + i * 75;
      osc.frequency.setValueAtTime(bf, t);
      osc.frequency.exponentialRampToValueAtTime(bf * 1.85, t + 0.065);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.075, t + 0.015);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(og).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  playStirSwish() {
    if (!this.unlocked || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(920, now + 0.14);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(now, Math.random(), 0.26);
  }

  playWindowWipe() {
    if (!this.unlocked || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800 + Math.random() * 500;
    hp.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    src.connect(hp).connect(g).connect(this.ctx.destination);
    src.start(now, Math.random(), 0.16);
  }

  // Warm non-verbal family reactions (blow steam ふーふー, happy hum, favorite delight)
  playFamilyBlow() {
    if (!this.unlocked || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, now);
    bp.frequency.exponentialRampToValueAtTime(700, now + 0.42);
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(now, Math.random(), 0.5);
  }

  playFamilyHappy(personIdx, isFavorite = false) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Warm cozy vocal-like formant marimba/hum cadence (different pitch per family member)
    const roots = [392.0, 261.63, 523.25]; // Mom (G4), Dad (C4), Little Sibling (C5)
    const root = roots[personIdx % 3];
    const notes = isFavorite ? [1, 1.25, 1.5, 2.0] : [1, 1.25, 1.5];

    notes.forEach((ratio, idx) => {
      const t = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(root * ratio * 0.96, t);
      osc.frequency.exponentialRampToValueAtTime(root * ratio, t + 0.04);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(isFavorite ? 0.09 : 0.065, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);

      osc.connect(g).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }
}
