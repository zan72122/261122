// Tactile procedural Web Audio Foley for photorealistic Mochi Making
// Warm, natural acoustic sounds: viscoelastic stretch, snap, dough pat, kinako puff,
// wet anko dollop, crisp nori crinkle, ceramic/lacquer clink, and soft Japanese koto chimes.

class MochiAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.stretchOsc = null;
    this.stretchGain = null;
    this.stretchFilter = null;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked && this.ctx && this.ctx.state === 'running') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this._buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Soft pink-ish filtered noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 1.8));
    }
    this.noiseBuffer = buf;
  }

  // Soft pillowy poke/squish on mochi mound
  playPoke(intensity = 0.7) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135 + intensity * 35, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(112, now + 0.24);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * intensity, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.30);
  }

  // Continuous elastic stretch hum modulated by stretch ratio (0..1) and speed
  updateStretch(active, ratio = 0, speed = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!active) {
      if (this.stretchGain) {
        this.stretchGain.gain.setTargetAtTime(0.0001, now, 0.04);
      }
      return;
    }

    if (!this.stretchOsc) {
      this.stretchOsc = this.ctx.createOscillator();
      this.stretchFilter = this.ctx.createBiquadFilter();
      this.stretchGain = this.ctx.createGain();
      this.stretchOsc.type = 'triangle';
      this.stretchFilter.type = 'lowpass';
      this.stretchFilter.frequency.value = 340;
      this.stretchGain.gain.value = 0.0001;
      this.stretchOsc.connect(this.stretchFilter);
      this.stretchFilter.connect(this.stretchGain);
      this.stretchGain.connect(this.ctx.destination);
      this.stretchOsc.start();
    }

    const freq = 98 + ratio * 155 + Math.min(speed * 18, 40);
    const vol = Math.min(0.11, 0.012 + ratio * 0.055 + Math.min(speed * 0.025, 0.04));
    this.stretchOsc.frequency.setTargetAtTime(freq, now, 0.03);
    this.stretchFilter.frequency.setTargetAtTime(260 + ratio * 420, now, 0.04);
    this.stretchGain.gain.setTargetAtTime(vol, now, 0.03);
  }

  // Juicy viscoelastic snap when mochi tears off (ちぎれる！)
  playSnap(sizeFactor = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    this.updateStretch(false);
    const now = this.ctx.currentTime;

    // Popping elastic recoil pitch sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const base = 180 / Math.max(0.7, Math.min(1.3, sizeFactor));
    osc.frequency.setValueAtTime(base * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.6, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(base * 0.85, now + 0.19);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);

    // Subtle soft rice-flour release puff
    this._playFilteredNoise(now, 0.11, 1400, 'bandpass', 0.08, 1.2);
  }

  // Soft cushioned palm pat / roll on wooden hinoki board
  playRollPat(roundness = 0.5) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const pitch = 115 + roundness * 55 + Math.random() * 14;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.58, now + 0.085);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    this._playFilteredNoise(now, 0.06, 900, 'lowpass', 0.045, 0.8);
  }

  // Silky airy golden kinako powder puff (きなこが舞う音)
  playKinakoPuff(strength = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._playFilteredNoise(now, 0.34, 2600, 'bandpass', 0.15 * strength, 0.7);
    this._playFilteredNoise(now + 0.04, 0.42, 4200, 'highpass', 0.06 * strength, 0.6);
  }

  // Thick glossy sweet red bean paste dollop (あんこ)
  playAnkoScoop() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);

    this._playFilteredNoise(now + 0.02, 0.14, 720, 'bandpass', 0.09, 2.2);
  }

  // Crisp dry roasted seaweed wrap (のり パリッ)
  playNoriWrap() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.045 + Math.random() * 0.015;
      this._playFilteredNoise(t, 0.065, 3600 + i * 700, 'bandpass', 0.12, 1.8);
    }
  }

  // Warm ceramic/lacquer plate placement + happy Japanese pentatonic koto chord
  playServe(familyIndex = 0, isCelebration = false) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Subtle soft wooden/ceramic tap
    const tap = this.ctx.createOscillator();
    const tapGain = this.ctx.createGain();
    tap.type = 'sine';
    tap.frequency.setValueAtTime(620 + familyIndex * 70, now);
    tap.frequency.exponentialRampToValueAtTime(290, now + 0.045);
    tapGain.gain.setValueAtTime(0.08, now);
    tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    tap.connect(tapGain);
    tapGain.connect(this.ctx.destination);
    tap.start(now);
    tap.stop(now + 0.07);

    // Warm Japanese pentatonic (D4, E4, G4, A4, B4, D5, E5) plucked notes
    const scale = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25];
    const baseIdx = familyIndex % 3;
    const notes = isCelebration
      ? [scale[0], scale[2], scale[3], scale[5], scale[6]]
      : [scale[baseIdx], scale[baseIdx + 2], scale[baseIdx + 4]];

    notes.forEach((freq, idx) => {
      const t = now + 0.05 + idx * (isCelebration ? 0.085 : 0.075);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.5, t);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.4, t + 0.55);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(isCelebration ? 0.13 : 0.10, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.72);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  // Soft wooden clack / friendly nudge when tapping a family plate or hand
  playPlateTap(familyIndex = 0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const f = 460 + familyIndex * 65;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.72, now + 0.06);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  _playFilteredNoise(startTime, duration, freq, type, volume, q = 1.0) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, startTime);
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + Math.min(0.025, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(startTime, Math.random() * 0.4, duration + 0.03);
  }
}

export const audio = new MochiAudio();
