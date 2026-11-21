// Procedural Web Audio API synthesizer for realistic supermarket tactile sound effects

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.cartNode = null;
    this.cartGain = null;
  }

  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this._buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.cartGain && this.ctx) {
      this.cartGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.45;
    }
    this.noiseBuffer = buf;
  }

  // Authentic crisp Japanese supermarket barcode scanner "ピッ!"
  playScanBeep(streak = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const baseFreq = 2420 * Math.pow(1.075, Math.min(streak, 6));

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.setValueAtTime(baseFreq * 2, now);

    const g2 = ctx.createGain();
    g2.gain.value = 0.14;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.006);
    gain.gain.setValueAtTime(0.26, now + 0.075);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.115);

    osc1.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.12);

    // Subtle happy chime tail
    const chime = ctx.createOscillator();
    const cg = ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(streak > 0 ? 1318.5 : 1046.5, now + 0.07);
    cg.gain.setValueAtTime(0.0001, now + 0.07);
    cg.gain.linearRampToValueAtTime(0.09, now + 0.085);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    chime.connect(cg);
    cg.connect(ctx.destination);
    chime.start(now + 0.07);
    chime.stop(now + 0.29);
  }

  // Rolling shopping cart wheels rumble (continuous pulse)
  playCartRoll(duration = 0.9) {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(190, now);
    bp.frequency.linearRampToValueAtTime(340, now + duration * 0.45);
    bp.frequency.linearRampToValueAtTime(160, now + duration);
    bp.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.12);
    gain.gain.setValueAtTime(0.18, now + Math.max(0.15, duration - 0.22));
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.04);

    // Subtle tile seam clicks
    const clicks = Math.max(2, Math.floor(duration * 5));
    for (let i = 0; i < clicks; i++) {
      const t = now + 0.08 + i * (duration / clicks);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + Math.random() * 40, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.035);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    }
  }

  // Pick up food from shelf (tactile pop + category nuance)
  playPickup(category = 'veg') {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startF = category === 'dairy' ? 320 : category === 'bread' ? 260 : 380;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(startF * 1.85, now + 0.08);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    if (category === 'dairy') {
      this.playMilkSlosh();
    } else if (category === 'bread') {
      this.playBreadSquish();
    }
  }

  // Liquid slosh inside chilled milk carton
  playMilkSlosh() {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    bp.frequency.exponentialRampToValueAtTime(360, now + 0.25);
    bp.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.28);
  }

  // Soft crusty bread squish / puff
  playBreadSquish() {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1400, now);
    hp.frequency.exponentialRampToValueAtTime(650, now + 0.14);
    hp.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.17);
  }

  // Drop matching item into metal wire cart basket (metallic clink + joyful marimba)
  playBasketDrop() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Soft heavy thump
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(155, now);
    thump.frequency.exponentialRampToValueAtTime(58, now + 0.12);
    tg.gain.setValueAtTime(0.26, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    thump.connect(tg);
    tg.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.15);

    // Chrome wire rattle
    [820, 1290].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + i * 0.025);
      g.gain.setValueAtTime(0.055, now + i * 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + i * 0.03);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.025);
      o.stop(now + 0.18 + i * 0.03);
    });

    // Happy 2-note sticker chime
    [587.33, 880].forEach((f, i) => {
      const t = now + 0.07 + i * 0.09;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
  }

  // Playful non-matching gentle boing (friendly, never harsh)
  playGentleBoing() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(340, now);
    o.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    o.frequency.exponentialRampToValueAtTime(310, now + 0.2);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.25);
  }

  // Produce cool water mister "psssshhh"
  playMistSpray() {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2400, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.08);
    gain.gain.setValueAtTime(0.20, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 1.08);
  }

  // Pyramid fruit tumble clacks
  playFruitTumble() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.065 + Math.random() * 0.02;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(290 + Math.random() * 160, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.06);
      g.gain.setValueAtTime(0.14 - i * 0.015, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.08);
    }
  }

  // Warm bakery brass service bell "チーン!"
  playBakeryBell() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [
      { f: 1568, a: 0.22, d: 0.9 },
      { f: 3136, a: 0.11, d: 0.6 },
      { f: 4435, a: 0.06, d: 0.35 }
    ];
    partials.forEach((p) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(p.f, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(p.a, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, now + p.d);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now);
      o.stop(now + p.d + 0.02);
    });
  }

  // Eco-bag soft fabric rustle + plush thump
  playBagPack() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(950, now);
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      src.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.24);
    }

    const th = ctx.createOscillator();
    const tg = ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(190, now + 0.02);
    th.frequency.exponentialRampToValueAtTime(75, now + 0.14);
    tg.gain.setValueAtTime(0.22, now + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    th.connect(tg);
    tg.connect(ctx.destination);
    th.start(now + 0.02);
    th.stop(now + 0.18);

    // Warm ascending plop note
    const note = ctx.createOscillator();
    const ng = ctx.createGain();
    note.type = 'triangle';
    note.frequency.setValueAtTime(523.25, now + 0.05);
    note.frequency.exponentialRampToValueAtTime(783.99, now + 0.16);
    ng.gain.setValueAtTime(0.14, now + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    note.connect(ng);
    ng.connect(ctx.destination);
    note.start(now + 0.05);
    note.stop(now + 0.28);
  }

  // Register cash drawer pop + shiny coin jingle
  playCashDrawer() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Metallic bell + mechanical slide
    this.playBakeryBell();
    [2200, 2950, 3600, 2600].forEach((f, i) => {
      const t = now + 0.08 + i * 0.045;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.16);
    });
  }

  // Receipt printer whir
  playReceiptPrint() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(175, now);
    o.frequency.linearRampToValueAtTime(215, now + 0.45);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.04);
    g.gain.setValueAtTime(0.07, now + 0.42);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    o.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.55);
  }

  // Friendly cashier giggle/wave musical hum
  playCashierHappy() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const t = now + i * 0.08;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.24);
    });
  }

  // Big cheerful xylophone celebration fanfare!
  playCelebration() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.00, d: 0.25 },
      { f: 659.25, t: 0.11, d: 0.25 },
      { f: 783.99, t: 0.22, d: 0.25 },
      { f: 1046.5, t: 0.34, d: 0.55 },
      { f: 783.99, t: 0.52, d: 0.22 },
      { f: 1046.5, t: 0.65, d: 0.72 }
    ];
    melody.forEach((n) => {
      const t = now + n.t;
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o2.type = 'triangle';
      o.frequency.setValueAtTime(n.f, t);
      o2.frequency.setValueAtTime(n.f * 2, t);
      const g2 = ctx.createGain();
      g2.gain.value = 0.16;

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + n.d);

      o.connect(g);
      o2.connect(g2);
      g2.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o2.start(t);
      o.stop(t + n.d + 0.03);
      o2.stop(t + n.d + 0.03);
    });
  }
}

export const sound = new SoundEngine();
