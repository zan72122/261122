// Procedural Web Audio API synthesizer for realistic, tactile kitchen dishwashing sounds
export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.noiseBuffer = null;

    // Continuous water stream nodes
    this.waterGain = null;
    this.waterFilter = null;
    this.waterResFilter = null;
    this.waterLevel = 0;

    // Continuous scrub sound
    this.scrubGain = null;
    this.scrubFilter = null;
    this.scrubTarget = 0;
    this.scrubFoamy = 0;

    this.popIndex = 0;
    this.pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
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
    this.unlocked = true;

    // Create 2 seconds of smooth pink-ish noise
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buffer;

    // Continuous water stream loop
    const waterSrc = this.ctx.createBufferSource();
    waterSrc.buffer = this.noiseBuffer;
    waterSrc.loop = true;

    this.waterFilter = this.ctx.createBiquadFilter();
    this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 1100;
    this.waterFilter.Q.value = 0.7;

    this.waterResFilter = this.ctx.createBiquadFilter();
    this.waterResFilter.type = 'peaking';
    this.waterResFilter.frequency.value = 420;
    this.waterResFilter.gain.value = 6;
    this.waterResFilter.Q.value = 2.2;

    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.value = 0.0001;

    waterSrc.connect(this.waterFilter);
    this.waterFilter.connect(this.waterResFilter);
    this.waterResFilter.connect(this.waterGain);
    this.waterGain.connect(this.ctx.destination);
    waterSrc.start();

    // Continuous sponge scrub loop
    const scrubSrc = this.ctx.createBufferSource();
    scrubSrc.buffer = this.noiseBuffer;
    scrubSrc.loop = true;

    this.scrubFilter = this.ctx.createBiquadFilter();
    this.scrubFilter.type = 'bandpass';
    this.scrubFilter.frequency.value = 1800;
    this.scrubFilter.Q.value = 1.6;

    this.scrubGain = this.ctx.createGain();
    this.scrubGain.gain.value = 0.0001;

    scrubSrc.connect(this.scrubFilter);
    this.scrubFilter.connect(this.scrubGain);
    this.scrubGain.connect(this.ctx.destination);
    scrubSrc.start();
  }

  updateContinuous(dt, waterFlow, sinkFillRatio, scrubSpeed, hasFoam) {
    if (!this.ctx || !this.waterGain) return;
    const now = this.ctx.currentTime;

    // Water sound rises in pitch gently as sink fills up (realistic resonant acoustics!)
    const targetWater = waterFlow > 0.05 ? 0.05 + waterFlow * 0.22 : 0.0001;
    this.waterGain.gain.setTargetAtTime(targetWater, now, 0.07);
    const freq = 850 + waterFlow * 550 + sinkFillRatio * 480;
    this.waterFilter.frequency.setTargetAtTime(freq, now, 0.12);
    this.waterResFilter.frequency.setTargetAtTime(340 + sinkFillRatio * 340, now, 0.15);

    // Random crisp water droplets while water runs
    if (waterFlow > 0.1 && Math.random() < dt * (7 + waterFlow * 9)) {
      this.playWaterDrop(0.05 + waterFlow * 0.06, 650 + sinkFillRatio * 550);
    }

    // Scrub sound: foamy = airy shwa-shwa; dry = squeaky rubbery friction
    const clampedSpeed = Math.min(1, scrubSpeed);
    const targetScrub = clampedSpeed > 0.04 ? clampedSpeed * (hasFoam ? 0.18 : 0.09) : 0.0001;
    this.scrubGain.gain.setTargetAtTime(targetScrub, now, 0.04);
    this.scrubFilter.frequency.setTargetAtTime(hasFoam ? 2400 + clampedSpeed * 1200 : 950 + clampedSpeed * 600, now, 0.05);
    this.scrubFilter.Q.setTargetAtTime(hasFoam ? 1.0 : 3.8, now, 0.05);

    if (clampedSpeed > 0.15 && hasFoam && Math.random() < dt * 11) {
      this.playMicroBubbleFizz();
    }
  }

  playMicroBubbleFizz() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const base = 1100 + Math.random() * 1600;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.65, now + 0.045);
    g.gain.setValueAtTime(0.032, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.05);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playSoapPump() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Soft mechanical squirt noise
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(1600, now);
      filt.frequency.exponentialRampToValueAtTime(600, now + 0.14);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.16);
    }

    // Thick liquid "bloop!" drop
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(690, now + 0.13);
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.linearRampToValueAtTime(0.16, now + 0.045);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g2);
    g2.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playFaucetToggle(isOn) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOn ? 260 : 410, now);
    osc.frequency.exponentialRampToValueAtTime(isOn ? 460 : 210, now + 0.08);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playWaterDrop(vol = 0.12, baseFreq = 780) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = baseFreq * (0.75 + Math.random() * 0.55);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.48, now + 0.065);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playSplash(intensity = 0.8) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(1400, now);
      filt.frequency.exponentialRampToValueAtTime(420, now + 0.24);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22 * intensity, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.27);
    }
    this.playWaterDrop(0.14 * intensity, 520);
    setTimeout(() => this.playWaterDrop(0.1 * intensity, 840), 55);
  }

  playDrainPlug(isPlugged) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    if (isPlugged) {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.11);
    } else {
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.14);
    }
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playDrainGlug() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = 180 + Math.random() * 140;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.9, now + 0.09);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playBubblePop() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const note = this.pentatonic[this.popIndex % this.pentatonic.length];
    this.popIndex++;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(note * 1.35, now + 0.055);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playDishClink(materialType = 'ceramic', pitchOffset = 0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const base =
      materialType === 'glass'
        ? 1480
        : materialType === 'mug'
        ? 920
        : 1120;
    const f1 = base * Math.pow(1.06, pitchOffset);
    const ratios = materialType === 'glass' ? [1, 2.32] : [1, 1.88];

    ratios.forEach((r, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f1 * r, now);
      g.gain.setValueAtTime(idx === 0 ? 0.14 : 0.06, now);
      g.gain.exponentialRampToValueAtTime(0.0008, now + (materialType === 'glass' ? 0.42 : 0.24));
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    });
  }

  playSparkleClean() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playCelebrationClaps() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Warm cheerful melody + soft claps
    const melody = [523.25, 659.25, 783.99, 1046.5, 880, 1046.5];
    melody.forEach((f, i) => {
      const t = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });

    if (this.noiseBuffer) {
      for (let c = 0; c < 4; c++) {
        const t = now + 0.14 + c * 0.19;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1350;
        filt.Q.value = 1.4;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
        src.connect(filt);
        filt.connect(g);
        g.connect(this.ctx.destination);
        src.start(t);
        src.stop(t + 0.09);
      }
    }
  }

  playDrySqueak() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.linearRampToValueAtTime(920, now + 0.045);
    osc.frequency.linearRampToValueAtTime(590, now + 0.09);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }
}
