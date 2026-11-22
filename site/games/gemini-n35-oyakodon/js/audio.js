// Procedural Web Audio API cooking & anime sound engine (zero external assets)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuf = null;
    this.simmerGain = null;
    this.simmerFilter = null;
    this.simmerLevel = 0;
    this.flameLevel = 1;
    this.steamLevel = 0;
    this.bubbleTimer = 0;
    this.rattleTimer = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._createNoiseBuffer();
      this._startSimmerBed();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.simmerGain && this.ctx) {
      this.simmerGain.gain.setTargetAtTime(m ? 0 : this._targetSimmerVol(), this.ctx.currentTime, 0.08);
    }
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuf = buf;
  }

  _startSimmerBed() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.9;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();

    this.simmerFilter = filter;
    this.simmerGain = gain;
  }

  _targetSimmerVol() {
    if (this.muted) return 0;
    const f = 0.5 + this.flameLevel * 0.25;
    return (this.simmerLevel * 0.045 + this.steamLevel * 0.055) * f;
  }

  setAmbience(simmerLevel, flameLevel, steamLevel) {
    this.simmerLevel = simmerLevel;
    this.flameLevel = flameLevel;
    this.steamLevel = steamLevel;
    if (!this.ctx || !this.simmerGain) return;
    const now = this.ctx.currentTime;
    this.simmerGain.gain.setTargetAtTime(this._targetSimmerVol(), now, 0.12);
    const freq = 900 + flameLevel * 380 + steamLevel * 950;
    this.simmerFilter.frequency.setTargetAtTime(freq, now, 0.12);
  }

  update(dt) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    if (this.simmerLevel > 0.15) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this._playBubblePop(this.simmerLevel);
        const rate = 0.14 + Math.random() * (0.45 / (0.6 + this.flameLevel * 0.55));
        this.bubbleTimer = rate;
      }
    }
    if (this.steamLevel > 0.35) {
      this.rattleTimer -= dt;
      if (this.rattleTimer <= 0) {
        this.playLidRattle(0.65);
        this.rattleTimer = 0.22 + Math.random() * (0.38 / (0.6 + this.flameLevel * 0.5));
      }
    }
  }

  _playBubblePop(intensity = 0.6) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const base = 210 + Math.random() * 240;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.4, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.032 * intensity, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.065);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playTapCeramic() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760 + Math.random() * 90, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.07);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playTapWood() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360 + Math.random() * 50, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playPickup() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.075);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playSplash() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Plop tone
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.09);
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    // Sizzle burst
    if (this.noiseBuf) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(2200, now);
      f.frequency.exponentialRampToValueAtTime(900, now + 0.25);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.12, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now);
      n.stop(now + 0.28);
    }
  }

  playKnobClick(level) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Crisp mechanical click
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880 + level * 140, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.03);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);

    // Flame whoosh
    if (this.noiseBuf) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420 + level * 260;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.11, now + 0.04);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now);
      n.stop(now + 0.24);
    }
  }

  playCrack() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Crisp shell snap!
    if (this.noiseBuf) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      n.connect(f);
      f.connect(g);
      g.connect(this.ctx.destination);
      n.start(now);
      n.stop(now + 0.06);
    }
    // Wet golden yolk plop right after
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(430, now + 0.14);
    og.gain.setValueAtTime(0.001, now + 0.05);
    og.gain.linearRampToValueAtTime(0.16, now + 0.075);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now + 0.05);
    osc.stop(now + 0.18);
  }

  playWhisk(progress = 0.5) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Rhythmic chopstick ceramic tap + slosh
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const f0 = 620 + progress * 240 + Math.random() * 80;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.65, now + 0.045);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);

    if (this.noiseBuf) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1400 + progress * 600;
      f.Q.value = 2.0;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.06, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now);
      n.stop(now + 0.09);
    }
  }

  playEggPourTick() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = 310 + Math.random() * 140;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.07);
    g.gain.setValueAtTime(0.045, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playLidPlace() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playLidRattle(vol = 0.8) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420 + Math.random() * 110, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.045);
    g.gain.setValueAtTime(0.07 * vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playRevealFanfare() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((freq, i) => {
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.72);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  playSlideFood() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(340, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.34);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.44);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playGarnish(kind) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (kind === 'yolk') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.18);
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (kind === 'nori') {
      if (this.noiseBuf) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 3400;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.13, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.16);
      }
    } else {
      // Sparkly leaf chime
      [880, 1174.66].forEach((freq, i) => {
        const t = now + i * 0.06;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    }
  }

  playYolkPop() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playBite() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Soft happy chomp + joyful anime hum notes
    [330, 260].forEach((freq, i) => {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.07);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    });
    // Cheerful delighted chime
    [659.25, 783.99, 1046.5].forEach((freq, i) => {
      const t = now + 0.22 + i * 0.075;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  playBowlFinish() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    melody.forEach((freq, i) => {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playStageChime() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}
