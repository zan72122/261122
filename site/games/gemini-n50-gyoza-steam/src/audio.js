// Procedural Web Audio Engine: Dynamic "Juwaa~" Sizzle, Steam Hiss, Boiling & Kitchen Foley
// Zero external audio files. Auto-unlocks on first touch/click for iOS Safari.

export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.noiseBuffer = null;

    // Continuous sizzle / steam nodes
    this.sizzleMaster = null;
    this.oilGain = null;
    this.steamGain = null;
    this.boilGain = null;
    this.ventGain = null;
    this.lidFilter = null;

    // Target continuous intensities
    this.oilLevel = 0;
    this.steamLevel = 0;
    this.boilLevel = 0;
    this.ventLevel = 0;
    this.lidClosed = 0; // 0 = open, 1 = closed (muffles high harshness warmly)
    this.crackleRate = 0;
    this.crackleAccum = 0;
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
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // 3-second seamless noise buffer
    const sr = this.ctx.sampleRate;
    const len = sr * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._initSizzleRig();
    this.unlocked = true;
  }

  _initSizzleRig() {
    const ctx = this.ctx;
    this.sizzleMaster = ctx.createGain();
    this.sizzleMaster.gain.value = 0.82;

    // Warm lid lowpass filter (open = 9500Hz bright sizzle, closed = 2300Hz warm glass-muffled boil)
    this.lidFilter = ctx.createBiquadFilter();
    this.lidFilter.type = 'lowpass';
    this.lidFilter.frequency.value = 9500;
    this.lidFilter.Q.value = 0.7;

    this.lidFilter.connect(this.sizzleMaster);
    this.sizzleMaster.connect(ctx.destination);

    // 1. Oil Fry Layer (crisp mid-high jiri-jiri)
    const oilSrc = ctx.createBufferSource();
    oilSrc.buffer = this.noiseBuffer;
    oilSrc.loop = true;
    const oilBP = ctx.createBiquadFilter();
    oilBP.type = 'bandpass';
    oilBP.frequency.value = 4200;
    oilBP.Q.value = 0.65;
    this.oilGain = ctx.createGain();
    this.oilGain.gain.value = 0;
    oilSrc.connect(oilBP).connect(this.oilGain).connect(this.lidFilter);
    oilSrc.start();

    // 2. Steam Hiss Layer (broad roaring juwaaaa)
    const steamSrc = ctx.createBufferSource();
    steamSrc.buffer = this.noiseBuffer;
    steamSrc.loop = true;
    const steamHP = ctx.createBiquadFilter();
    steamHP.type = 'highpass';
    steamHP.frequency.value = 1400;
    this.steamGain = ctx.createGain();
    this.steamGain.gain.value = 0;
    steamSrc.connect(steamHP).connect(this.steamGain).connect(this.lidFilter);
    steamSrc.start();

    // 3. Wet Boiling Bubble Rumble (low-mid gutsugutsu)
    const boilSrc = ctx.createBufferSource();
    boilSrc.buffer = this.noiseBuffer;
    boilSrc.loop = true;
    const boilBP = ctx.createBiquadFilter();
    boilBP.type = 'bandpass';
    boilBP.frequency.value = 460;
    boilBP.Q.value = 1.6;
    this.boilGain = ctx.createGain();
    this.boilGain.gain.value = 0;
    boilSrc.connect(boilBP).connect(this.boilGain).connect(this.lidFilter);
    boilSrc.start();

    // 4. Tight Steam Vent Jet Hiss (bypasses lid muffling since it escapes outside the vent!)
    const ventSrc = ctx.createBufferSource();
    ventSrc.buffer = this.noiseBuffer;
    ventSrc.loop = true;
    const ventBP = ctx.createBiquadFilter();
    ventBP.type = 'bandpass';
    ventBP.frequency.value = 6200;
    ventBP.Q.value = 2.4;
    this.ventGain = ctx.createGain();
    this.ventGain.gain.value = 0;
    ventSrc.connect(ventBP).connect(this.ventGain).connect(this.sizzleMaster);
    ventSrc.start();
  }

  // Called every animation frame with live physical cooking state
  updateSizzle(dt, { oil = 0, steam = 0, boil = 0, vent = 0, lidClosed = 0, crackle = 0 }) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const tau = 0.08;

    this.oilGain.gain.setTargetAtTime(oil * 0.16, now, tau);
    this.steamGain.gain.setTargetAtTime(steam * 0.24, now, tau);
    this.boilGain.gain.setTargetAtTime(boil * 0.22, now, tau);
    this.ventGain.gain.setTargetAtTime(vent * 0.09, now, tau);

    // Smooth lid muffling frequency sweep
    const cutoff = 9500 - lidClosed * 7100;
    this.lidFilter.frequency.setTargetAtTime(cutoff, now, 0.09);

    // Stochastic crisp oil crackles & boiling bubble pops ("pachi-pachi" / "poko-poko")
    this.crackleAccum += dt * crackle;
    while (this.crackleAccum >= 1) {
      this.crackleAccum -= 1;
      if (boil > oil * 1.1) {
        this._spawnBubblePop(lidClosed);
      } else {
        this._spawnOilPop(lidClosed);
      }
    }
  }

  _spawnOilPop(lidClosed) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const offset = Math.random() * 2.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (2800 + Math.random() * 4400) * (1 - lidClosed * 0.45);
    bp.Q.value = 3.2;

    const g = ctx.createGain();
    const peak = 0.05 + Math.random() * 0.11;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.022 + Math.random() * 0.024);

    src.connect(bp).connect(g).connect(this.lidFilter);
    src.start(now, offset, 0.06);
  }

  _spawnBubblePop(lidClosed) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseF = 240 + Math.random() * 260;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 2.1, now + 0.045);

    const g = ctx.createGain();
    const peak = (0.04 + Math.random() * 0.05) * (1 - lidClosed * 0.3);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(g).connect(this.lidFilter);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Dramatic "JUWAAAA!!" when katakuriko water hits hot oiled skillet
  playWaterJuwaaBurst(intensity = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(1900, now + 1.2);
    bp.Q.value = 0.5;

    const g = ctx.createGain();
    const peak = 0.42 * intensity;
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.06);
    g.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random());
    src.stop(now + 1.5);
  }

  playScoopPlop() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Moist organic weight plop
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.11);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Subtle soft wet texture
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 900;
    lp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.08, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    src.connect(lp).connect(ng).connect(ctx.destination);
    src.start(now, Math.random(), 0.1);
  }

  playPleatPinch(index = 0) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Gentle tactile dough crimp with slight ascending pitch across 6 pleats
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = 310 + index * 38;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.24, now + 0.065);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // Soft powdery dough rustle
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.045, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    src.connect(bp).connect(ng).connect(ctx.destination);
    src.start(now, Math.random(), 0.06);
  }

  playPanDrop() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Soft body thud
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    // Quick appetizing oil "juu!" kiss
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.16, now + 0.025);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    src.connect(bp).connect(ng).connect(ctx.destination);
    src.start(now, Math.random(), 0.35);
  }

  playLidClink(closing = true) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Tempered glass + stainless rim metallic ring
    const freqs = closing ? [1180, 2340, 3920] : [1420, 2680];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const amp = (closing ? 0.09 : 0.055) / (idx + 1);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (closing ? 0.24 : 0.16));
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    });

    if (closing) {
      // Heavy seat thud
      const thud = ctx.createOscillator();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(165, now);
      thud.frequency.exponentialRampToValueAtTime(68, now + 0.09);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.22, now);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      thud.connect(tg).connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.12);
    } else {
      // Escaping puff of trapped steam when lid lifts!
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(2600, now);
      hp.frequency.exponentialRampToValueAtTime(1200, now + 0.7);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.001, now);
      sg.gain.linearRampToValueAtTime(0.22, now + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      src.connect(hp).connect(sg).connect(ctx.destination);
      src.start(now, Math.random(), 0.8);
    }
  }

  playKnobClick(heat = 0.7) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620 + heat * 320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  playPlateClack() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [760, 1540].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  playFlipWhoosh() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(320, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.55);
    bp.Q.value = 1.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random(), 0.65);
  }

  // Ultra-satisfying crisp "PARI! SAKU!" hanetsuki lace crack!
  playHaneCrack() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Triple micro-burst crisp snap
    [0, 0.028, 0.062].forEach((delay, idx) => {
      const t = now + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 3400 + idx * 950;
      hp.Q.value = 1.4;

      const g = ctx.createGain();
      const peak = 0.28 - idx * 0.06;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      src.connect(hp).connect(g).connect(ctx.destination);
      src.start(t, Math.random(), 0.07);
    });
  }

  playSauceDip() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.075);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playBiteCrunch() {
    this.playHaneCrack();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.07;
    // Juicy savory bite crunch follow-through
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1950;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random(), 0.18);
  }

  playGlassWipe() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 600;
    bp.Q.value = 4.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random(), 0.06);
  }

  playPropBump(kind = 'wood') {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    if (kind === 'glass') {
      osc.type = 'sine';
      osc.frequency.value = 1620;
      g.gain.setValueAtTime(0.07, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    } else if (kind === 'metal') {
      osc.type = 'triangle';
      osc.frequency.value = 490;
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.07);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    }
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}
