// 効果音（WebAudio で合成。音声ファイルなし、声のセリフなし）。
// iOS は最初のタッチで resume しないと鳴らないので unlock() を pointerdown で呼ぶ。
export class Sfx {
  constructor() {
    this.ctx = null; this.master = null; this.noiseBuf = null;
    this.stretchOsc = null; this.stretchGain = null; this.stretchUntil = 0;
    this.muted = false;
  }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.7;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch (e) { console.warn('[udon] audio', e); }
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  get ok() { return this.ctx && this.ctx.state === 'running' && !this.muted; }

  tone(f0, f1, dur, { type = 'sine', gain = 0.3, at = 0, vib = 0, vibHz = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.015, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vib > 0) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibHz; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.02);
    }
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { type = 'lowpass', f0 = 1000, f1 = 1000, q = 1, gain = 0.3, at = 0, trem = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (trem > 0) {
      const tg = c.createGain(); tg.gain.value = 0.6;
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = trem; lg.gain.value = 0.4; l.connect(lg); lg.connect(tg.gain);
      l.start(t); l.stop(t + dur + 0.02);
      g.connect(tg); out = tg;
    }
    s.connect(f); f.connect(g); out.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name, p = {}) {
    if (!this.ok) return;
    try { this._play(name, p); } catch (e) { console.warn('[udon] sfx', name, e); }
  }
  _play(name, p) {
    const r = Math.random;
    switch (name) {
      case 'munyu': this.tone(280, 150, 0.16, { gain: 0.3 }); this.noise(0.08, { f0: 700, f1: 300, gain: 0.12 }); break;
      case 'boyon': this.tone(520, 230, 0.34, { gain: 0.28, vib: 40, vibHz: 16 }); break;
      case 'goro': this.noise(0.14, { f0: 320, f1: 200, gain: 0.25 }); this.tone(95, 80, 0.1, { gain: 0.15, type: 'triangle' }); break;
      case 'ton': this.noise(0.05, { type: 'bandpass', f0: 1900, f1: 1500, q: 2, gain: 0.35 }); this.tone(190, 90, 0.08, { type: 'triangle', gain: 0.4 }); break;
      case 'suton': this.tone(760, 600, 0.05, { gain: 0.12, at: 0.02 }); break;
      case 'pick': this.tone(420, 720, 0.13, { gain: 0.22 }); break;
      case 'grab': this.tone(520, 680, 0.06, { gain: 0.16 }); break;
      case 'putdown': this.tone(320, 220, 0.07, { gain: 0.16 }); break;
      case 'splash': this.noise(0.45, { f0: 2400, f1: 400, gain: 0.35 }); this.tone(210, 80, 0.22, { gain: 0.25 }); break;
      case 'bubble': this.tone(500 + r() * 400, 900 + r() * 400, 0.06, { gain: 0.05 }); break;
      case 'swirl': this.noise(0.25, { type: 'bandpass', f0: 600, f1: 900, q: 1.2, gain: 0.07 }); break;
      case 'scoop': this.noise(0.32, { type: 'bandpass', f0: 1300, f1: 500, q: 1, gain: 0.3 }); break;
      case 'drop': this.tone(300, 120, 0.18, { gain: 0.3 }); this.noise(0.15, { f0: 900, f1: 300, gain: 0.15 }); break;
      case 'broth': this.noise(0.6, { f0: 900, f1: 500, gain: 0.08 }); break;
      case 'pon': this.tone(600, 980, 0.09, { gain: 0.32 }); this.tone(980, 760, 0.08, { gain: 0.12, at: 0.08 }); break;
      case 'nope': this.tone(400, 380, 0.08, { gain: 0.12 }); this.tone(380, 400, 0.08, { gain: 0.12, at: 0.1 }); break;
      case 'slide': this.noise(0.5, { f0: 600, f1: 300, gain: 0.12 }); break;
      case 'zuzu': this.noise(1.5, { type: 'bandpass', f0: 800, f1: 1700, q: 1.5, gain: 0.32, trem: 9 }); break;
      case 'mogu': for (let i = 0; i < 3; i++) this.tone(300, 200, 0.07, { gain: 0.18, at: i * 0.16 }); break;
      case 'happy': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.26, { type: 'triangle', gain: 0.22, at: i * 0.11 })); break;
      case 'kira': for (let i = 0; i < 3; i++) this.tone(1700 + r() * 800, 2400 + r() * 600, 0.08, { gain: 0.08, at: i * 0.07 }); break;
      case 'giggle': this.tone(880, 1180, 0.08, { gain: 0.15 }); this.tone(960, 1300, 0.08, { gain: 0.15, at: 0.11 }); break;
      case 'hop': this.tone(260, 520, 0.15, { gain: 0.25 }); break;
      case 'poyon': this.tone(220, 140, 0.25, { gain: 0.3, vib: 25, vibHz: 12 }); break;
      default: break;
    }
  }
  // 引っ張っている間ずっと鳴る「びよーん」。amount で音の高さが上がる
  stretch(amount) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.stretchOsc) {
      const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; l.frequency.value = 7; lg.gain.value = 12; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      o.connect(g); g.connect(this.master); o.start(t); l.start(t);
      this.stretchOsc = o; this.stretchGain = g; this.stretchLfo = l;
    }
    this.stretchOsc.frequency.setTargetAtTime(220 + amount * 520, t, 0.04);
    this.stretchUntil = t + 0.3;
  }
  stretchEnd() {
    if (!this.stretchOsc || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.stretchGain.gain.setTargetAtTime(0.0001, t, 0.05);
    this.stretchOsc.stop(t + 0.3); this.stretchLfo.stop(t + 0.3);
    this.stretchOsc = null;
  }
  update() { if (this.stretchOsc && this.ctx.currentTime > this.stretchUntil) this.stretchEnd(); }
}
