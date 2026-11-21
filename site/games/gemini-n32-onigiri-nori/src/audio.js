// Procedural Web Audio API sound designer for warm picture-book foley & acoustic chimes.
// Zero external audio files; unlocks safely on first user gesture.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.muted = false;
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _note(freq, time, dur, gainPeak = 0.16, type = 'triangle', freqEnd = null) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), time + dur);
    }
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gainPeak, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  _noise(time, dur, filterFreq, q = 1.5, gainPeak = 0.12, filterType = 'bandpass') {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, time);
    filter.Q.setValueAtTime(q, time);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gainPeak, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(time, Math.random() * 0.4, dur + 0.05);
  }

  // Soft fluffy scoop of warm rice ("fuwa-pon!")
  playRiceScoop(isExtra = false) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.16, 900, 1.2, 0.11, 'bandpass');
    const base = isExtra ? 360 : 290;
    this._note(base, t + 0.04, 0.18, 0.18, 'sine', base * 1.42);
    this._note(base * 1.5, t + 0.09, 0.22, 0.12, 'triangle', base * 1.8);
  }

  // Gentle warm hand squeeze ("gyu-gyu!")
  playSqueeze(step = 1) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pitches = [330, 392, 440, 523.25];
    const p = pitches[Math.min(step, pitches.length - 1)];
    // Soft tactile squish
    this._noise(t, 0.11, 520 + step * 110, 1.8, 0.1, 'bandpass');
    this._note(p * 0.72, t, 0.13, 0.15, 'sine', p * 1.05);
    this._note(p, t + 0.04, 0.18, 0.14, 'triangle', p * 1.12);
  }

  // Celebratory soft marimba chord when triangle shape finishes!
  playShapeDone() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      this._note(f, t + i * 0.055, 0.34, 0.12, 'triangle');
      this._note(f * 2, t + i * 0.055, 0.16, 0.035, 'sine');
    });
  }

  // Dropping a filling into the rice ("poton!")
  playFillingPlop(kind = 'ume') {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'ume') {
      // Bright rosy bouncy pop + cute tangy upward chirp
      this._note(380, t, 0.12, 0.16, 'sine', 620);
      this._note(740, t + 0.09, 0.16, 0.12, 'triangle', 880);
    } else if (kind === 'salmon') {
      // Warm rich comforting marimba plop
      this._note(310, t, 0.14, 0.18, 'sine', 460);
      this._note(587.33, t + 0.07, 0.2, 0.13, 'triangle', 659.25);
    } else {
      // Double deluxe rainbow chime!
      [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((f, i) => {
        this._note(f, t + i * 0.045, 0.28, 0.11, 'triangle');
      });
    }
  }

  // Sesame-salt wooden shaker ("shaka-shaka!")
  playSesameShake() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      this._noise(t + i * 0.055, 0.045, 3600 + i * 350, 2.2, 0.09, 'highpass');
    }
    this._note(880, t + 0.05, 0.1, 0.06, 'sine', 1046);
  }

  // Crisp nori seaweed wrap ("pari-pari! kasha!")
  playNoriWrap(isFace = false) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Crisp crackling bursts
    this._noise(t, 0.06, 2600, 1.4, 0.16, 'bandpass');
    this._noise(t + 0.055, 0.08, 3200, 1.6, 0.14, 'bandpass');
    this._noise(t + 0.12, 0.07, 2200, 1.3, 0.1, 'bandpass');
    if (isFace) {
      // Adorable bento face twinkle!
      [659.25, 880, 1174.66, 1318.5].forEach((f, i) => {
        this._note(f, t + 0.08 + i * 0.05, 0.25, 0.1, 'triangle');
      });
    } else {
      this._note(440, t + 0.08, 0.22, 0.12, 'triangle', 587.33);
      this._note(659.25, t + 0.14, 0.26, 0.11, 'triangle');
    }
  }

  // Cozy wicker basket placement ("koton!" + warm arpeggio)
  playBasketPlace(count = 1) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Soft wicker thud
    this._note(190, t, 0.12, 0.2, 'sine', 120);
    this._noise(t, 0.08, 700, 1.5, 0.08, 'bandpass');
    const scales = [
      [523.25, 659.25, 783.99],
      [587.33, 739.99, 880.0],
      [523.25, 659.25, 783.99, 1046.5, 1318.5]
    ];
    const seq = scales[Math.min(count - 1, 2)];
    seq.forEach((f, i) => {
      this._note(f, t + 0.08 + i * 0.07, 0.34, 0.13, 'triangle');
    });
  }

  // Sunny picnic fanfare when transitioning to the meadow!
  playPicnicStart() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.0 },
      { f: 659.25, d: 0.11 },
      { f: 783.99, d: 0.22 },
      { f: 1046.5, d: 0.34 },
      { f: 880.0, d: 0.47 },
      { f: 1046.5, d: 0.58 }
    ];
    melody.forEach((m) => {
      this._note(m.f, t + m.d, 0.35, 0.13, 'triangle');
      this._note(m.f * 0.5, t + m.d, 0.3, 0.07, 'sine');
    });
  }

  // Big crunchy happy bite ("paku! mogu-mogu!")
  playBite(reaction = 'happy') {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Crisp bite crunch
    this._noise(t, 0.07, 1900, 1.4, 0.17, 'bandpass');
    this._noise(t + 0.06, 0.06, 2800, 1.6, 0.13, 'bandpass');
    this._note(280, t, 0.09, 0.15, 'sine', 420);

    if (reaction === 'sour') {
      // Hilarious cute sour squint trill!
      this._note(780, t + 0.16, 0.09, 0.11, 'sine', 990);
      this._note(940, t + 0.25, 0.09, 0.11, 'sine', 740);
      this._note(880, t + 0.34, 0.16, 0.12, 'triangle', 1120);
    } else if (reaction === 'bliss') {
      // Warm dreamy harp-like rising notes
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
        this._note(f, t + 0.16 + i * 0.07, 0.35, 0.11, 'sine');
      });
    } else if (reaction === 'rainbow') {
      // Sparkling deluxe double-filling fanfare!
      [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5].forEach((f, i) => {
        this._note(f, t + 0.14 + i * 0.055, 0.3, 0.11, 'triangle');
      });
    } else {
      // Cozy satisfied happy hum
      this._note(523.25, t + 0.16, 0.18, 0.12, 'triangle', 659.25);
      this._note(783.99, t + 0.28, 0.25, 0.11, 'sine');
    }
  }

  // Warm tea sip ("goku-goku... haaa!")
  playTeaSip() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._note(320, t, 0.1, 0.12, 'sine', 460);
    this._note(360, t + 0.16, 0.1, 0.12, 'sine', 510);
    this._noise(t + 0.32, 0.22, 1200, 1.0, 0.06, 'bandpass');
    this._note(587.33, t + 0.34, 0.3, 0.1, 'triangle', 523.25);
  }

  // Playful wiggle / poke response (girl giggle, prop tap)
  playGiggle() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 784, 880, 1046].forEach((f, i) => {
      this._note(f, t + i * 0.065, 0.12, 0.1, 'sine', f * 1.12);
    });
  }

  playSoftTap(pitch = 480) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._note(pitch, t, 0.11, 0.1, 'triangle', pitch * 1.16);
  }
}

export const sound = new SoundEngine();
