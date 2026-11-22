// Pure Web Audio API tactile kitchen foley & warm morning acoustic sound engine

class BentoAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.master = null;
    this.packStep = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this._createNoiseBuffer(1.5);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _createNoiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _playNoiseBurst({ duration = 0.08, freq = 1200, q = 2.0, type = 'bandpass', gain = 0.25, delay = 0, attack = 0.004 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 0.5, duration + 0.02);
  }

  _playTone({ freq = 440, endFreq = null, duration = 0.14, type = 'sine', gain = 0.2, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Crisp wooden chopstick click + food-specific tactile pickup
  playPickup(foodType) {
    this.unlock();
    if (!this.ctx) return;
    // Wooden chopstick subtle clack
    this._playTone({ freq: 1420, endFreq: 980, duration: 0.032, type: 'triangle', gain: 0.12 });
    this._playNoiseBurst({ duration: 0.028, freq: 2400, q: 3.2, gain: 0.14 });

    if (foodType === 'karaage') {
      // Crispy craggy batter micro-crunch
      for (let i = 0; i < 4; i++) {
        this._playNoiseBurst({
          duration: 0.03 + Math.random() * 0.025,
          freq: 2600 + Math.random() * 2200,
          q: 2.5,
          gain: 0.18,
          delay: 0.015 + i * 0.018
        });
      }
    } else if (foodType === 'tomato') {
      // Smooth taut glossy pop
      this._playTone({ freq: 520, endFreq: 860, duration: 0.065, type: 'sine', gain: 0.18, delay: 0.01 });
      this._playTone({ freq: 1080, endFreq: 1450, duration: 0.04, type: 'sine', gain: 0.07, delay: 0.02 });
    } else if (foodType === 'broccoli') {
      // Crisp leafy floret rustle
      this._playNoiseBurst({ duration: 0.085, freq: 3400, q: 1.4, gain: 0.16, delay: 0.01 });
      this._playNoiseBurst({ duration: 0.055, freq: 5200, q: 2.2, gain: 0.11, delay: 0.035 });
    } else if (foodType === 'tamagoyaki') {
      // Soft pillowy egg squish
      this._playTone({ freq: 260, endFreq: 340, duration: 0.09, type: 'sine', gain: 0.16, delay: 0.01 });
      this._playNoiseBurst({ duration: 0.06, freq: 900, q: 1.2, gain: 0.08, delay: 0.015 });
    }
  }

  // Cozy, crisp wooden bento pack sound + ascending gentle marimba warmth
  playPack(foodType, packedCount) {
    this.unlock();
    if (!this.ctx) return;

    // Hollow cedar magewappa box "koton!" resonance
    this._playTone({ freq: 230, endFreq: 165, duration: 0.11, type: 'triangle', gain: 0.28 });
    this._playTone({ freq: 470, endFreq: 390, duration: 0.06, type: 'sine', gain: 0.14 });
    this._playNoiseBurst({ duration: 0.045, freq: 1350, q: 2.5, gain: 0.15 });

    // Food-specific cozy nestle detail
    if (foodType === 'karaage') {
      this._playNoiseBurst({ duration: 0.05, freq: 3100, q: 2.0, gain: 0.16, delay: 0.02 });
      this._playNoiseBurst({ duration: 0.04, freq: 4200, q: 2.8, gain: 0.12, delay: 0.045 });
    } else if (foodType === 'tomato') {
      this._playTone({ freq: 720, endFreq: 1020, duration: 0.065, type: 'sine', gain: 0.15, delay: 0.025 });
    } else if (foodType === 'broccoli') {
      this._playNoiseBurst({ duration: 0.075, freq: 3800, q: 1.8, gain: 0.14, delay: 0.02 });
    } else if (foodType === 'tamagoyaki') {
      this._playTone({ freq: 310, endFreq: 250, duration: 0.09, type: 'sine', gain: 0.14, delay: 0.02 });
    }

    // Gentle rising wooden marimba pentatonic note (C5, D5, E5, G5, A5, C6, D6, E6)
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
    const f = scale[Math.min(Math.max(0, packedCount - 1), scale.length - 1)];
    this._playTone({ freq: f, duration: 0.28, type: 'sine', gain: 0.15, delay: 0.045, attack: 0.004 });
    this._playTone({ freq: f * 2, duration: 0.12, type: 'sine', gain: 0.045, delay: 0.045, attack: 0.003 });
  }

  // Gentle ceramic bounce when dropped outside the bento
  playBounce(foodType) {
    this.unlock();
    if (!this.ctx) return;
    if (foodType === 'tomato') {
      // Cute rolling ceramic tap-tap
      this._playTone({ freq: 920, endFreq: 840, duration: 0.045, type: 'sine', gain: 0.14 });
      this._playTone({ freq: 1140, endFreq: 1020, duration: 0.035, type: 'sine', gain: 0.09, delay: 0.09 });
    } else {
      this._playTone({ freq: 420, endFreq: 340, duration: 0.07, type: 'triangle', gain: 0.13 });
      this._playNoiseBurst({ duration: 0.035, freq: 1800, q: 2.0, gain: 0.1 });
    }
  }

  // Soft wobble/poke interaction (rice, umeboshi, locked lid)
  playPoke(kind = 'wood') {
    this.unlock();
    if (!this.ctx) return;
    if (kind === 'rice') {
      this._playNoiseBurst({ duration: 0.08, freq: 1100, q: 1.0, gain: 0.09 });
      this._playTone({ freq: 240, endFreq: 290, duration: 0.08, type: 'sine', gain: 0.08 });
    } else if (kind === 'camera') {
      // Crisp mechanical camera shutter / lens click
      this._playNoiseBurst({ duration: 0.025, freq: 3200, q: 2.5, gain: 0.16 });
      this._playTone({ freq: 1800, endFreq: 1200, duration: 0.03, type: 'triangle', gain: 0.09, delay: 0.018 });
    } else {
      // Hollow cedar knock
      this._playTone({ freq: 340, endFreq: 260, duration: 0.065, type: 'triangle', gain: 0.16 });
    }
  }

  // Cedar lid sliding on & snapping snugly shut ("suu... pako-ton!")
  playLidClose() {
    this.unlock();
    if (!this.ctx) return;
    // Soft wooden slide
    this._playNoiseBurst({ duration: 0.18, freq: 1400, q: 1.4, gain: 0.14, attack: 0.03 });
    // Deep hollow cedar seal "pako-ton!"
    this._playTone({ freq: 195, endFreq: 132, duration: 0.17, type: 'triangle', gain: 0.34, delay: 0.15 });
    this._playTone({ freq: 380, endFreq: 280, duration: 0.12, type: 'sine', gain: 0.2, delay: 0.16 });
    this._playNoiseBurst({ duration: 0.06, freq: 1100, q: 2.2, gain: 0.18, delay: 0.15 });
    // Warm chord bloom
    this._playTone({ freq: 523.25, duration: 0.42, type: 'sine', gain: 0.12, delay: 0.22 });
    this._playTone({ freq: 659.25, duration: 0.42, type: 'sine', gain: 0.11, delay: 0.28 });
    this._playTone({ freq: 783.99, duration: 0.5, type: 'sine', gain: 0.12, delay: 0.34 });
  }

  // Woven furoshiki cotton rustle ("fasa-sara")
  playClothFold(isFinalKnot = false) {
    this.unlock();
    if (!this.ctx) return;
    this._playNoiseBurst({ duration: 0.24, freq: 1850, q: 0.9, gain: 0.2, attack: 0.04 });
    this._playNoiseBurst({ duration: 0.2, freq: 3400, q: 1.1, gain: 0.12, delay: 0.08, attack: 0.03 });
    if (isFinalKnot) {
      // Crisp tight fabric knot "kyu!"
      this._playNoiseBurst({ duration: 0.12, freq: 2400, q: 3.0, gain: 0.22, delay: 0.22, attack: 0.01 });
      this._playTone({ freq: 320, endFreq: 540, duration: 0.14, type: 'sine', gain: 0.12, delay: 0.22 });
    }
  }

  // Golden morning celebration: gentle sunlight chime + soft morning sparrow chirp
  playComplete() {
    this.unlock();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, idx) => {
      this._playTone({ freq: f, duration: 0.75, type: 'sine', gain: 0.12, delay: 0.1 + idx * 0.09, attack: 0.008 });
      this._playTone({ freq: f * 2, duration: 0.35, type: 'sine', gain: 0.035, delay: 0.1 + idx * 0.09, attack: 0.005 });
    });
    // Gentle distant morning sparrow chirp (2 soft trills)
    this._playTone({ freq: 3100, endFreq: 3950, duration: 0.08, type: 'sine', gain: 0.045, delay: 0.65 });
    this._playTone({ freq: 3900, endFreq: 3350, duration: 0.07, type: 'sine', gain: 0.04, delay: 0.74 });
    this._playTone({ freq: 3250, endFreq: 4200, duration: 0.09, type: 'sine', gain: 0.045, delay: 0.92 });
  }
}

export const audio = new BentoAudio();
