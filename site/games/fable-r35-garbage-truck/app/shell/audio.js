// WebAudio sound effects, all synthesised (no files, no network).
// The context is created/resumed on the first touch (iOS needs a user gesture).
export function createAudio() {
  let ctx = null, master = null, noiseBuf = null, engine = null;
  const lastPlay = Object.create(null);

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const now = () => ctx.currentTime;
  function env(g, t0, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + 0.01, dur));
  }
  function osc(type, f0, f1, dur, peak = 0.3, delay = 0, attack = 0.005) {
    const t0 = now() + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    env(g, t0, attack, peak, dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, filterType, f0, f1, peak = 0.3, delay = 0, q = 1, attack = 0.005) {
    const t0 = now() + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); env(g, t0, attack, peak, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  const SFX = {
    pick() { osc('sine', 420, 880, 0.09, 0.25); },
    drop() { osc('sine', 180, 80, 0.16, 0.35); noise(0.06, 'lowpass', 900, 300, 0.15); },
    hop() { osc('sine', 520, 760, 0.08, 0.16); },
    snap() { osc('triangle', 660, 990, 0.08, 0.2); osc('triangle', 990, 1320, 0.1, 0.16, 0.07); },
    tap() { osc('sine', 700, 500, 0.06, 0.12); },
    sparkle() { [1568, 2093, 2637].forEach((f, i) => osc('sine', f, f, 0.18, 0.08, i * 0.06)); },
    honk() { osc('square', 392, 392, 0.14, 0.12); osc('square', 494, 494, 0.14, 0.1); osc('square', 392, 392, 0.26, 0.12, 0.2); osc('square', 494, 494, 0.26, 0.1, 0.2); },
    beep() { osc('square', 1046, 1046, 0.11, 0.08); },
    hydraulic(p) {
      const dur = Math.min(4, Math.max(0.3, (p && p.dur) || 1));
      osc('sawtooth', 70, 95, dur, 0.06, 0, 0.08);
      noise(dur, 'bandpass', 500, 800, 0.05, 0, 3, 0.08);
    },
    grab() { osc('square', 300, 220, 0.07, 0.1); noise(0.05, 'bandpass', 2500, 2000, 0.15, 0, 4); },
    lid() { osc('triangle', 520, 300, 0.08, 0.15); },
    pour(p) {
      const n = Math.min(14, 6 + ((p && p.count) || 8));
      for (let i = 0; i < n; i++) noise(0.07, 'bandpass', 1400 + Math.random() * 2400, 900, 0.12, i * 0.045 + Math.random() * 0.03, 2);
    },
    land() { noise(0.08, 'lowpass', 500, 200, 0.18); osc('sine', 140, 90, 0.08, 0.1); },
    squeeze(p) {
      const dur = Math.min(3, Math.max(0.4, (p && p.dur) || 1));
      noise(dur, 'bandpass', 1800, 300, 0.16, 0, 2, 0.1);
      osc('sawtooth', 110, 60, dur, 0.05, 0, 0.1);
      for (let i = 0; i < 6; i++) noise(0.04, 'highpass', 3000, 3000, 0.07, (i / 6) * dur + Math.random() * 0.05);
    },
    thump() { osc('sine', 150, 70, 0.14, 0.3); noise(0.1, 'lowpass', 600, 180, 0.18); },
    clank() { osc('square', 180, 120, 0.1, 0.1); noise(0.08, 'bandpass', 1800, 1200, 0.15, 0, 5); },
    dumpPour(p) {
      const dur = Math.min(4, Math.max(0.6, (p && p.dur) || 1.5));
      noise(dur, 'lowpass', 1600, 300, 0.32, 0, 0.7, 0.15);
      for (let i = 0; i < 12; i++) noise(0.08, 'bandpass', 900 + Math.random() * 1500, 600, 0.12, Math.random() * dur, 2);
    },
    dumpThud() { osc('sine', 90, 40, 0.4, 0.5); noise(0.3, 'lowpass', 700, 150, 0.3); },
    boing() { osc('sine', 180, 620, 0.12, 0.3); osc('sine', 620, 320, 0.22, 0.22, 0.11); },
    slam() { osc('sine', 120, 45, 0.35, 0.5); noise(0.25, 'lowpass', 1200, 200, 0.35); },
    poof() { noise(0.35, 'highpass', 800, 3000, 0.22, 0, 0.7, 0.01); SFX.sparkle(); },
    whoosh() { noise(0.5, 'bandpass', 300, 2400, 0.12, 0, 1.5, 0.15); },
    happy() { [523, 659, 784, 1046].forEach((f, i) => { osc('triangle', f, f, 0.22, 0.16, i * 0.11); osc('sine', f * 2, f * 2, 0.15, 0.05, i * 0.11); }); },
    giggle() { [880, 1046, 880, 1175].forEach((f, i) => osc('sine', f, f * 1.15, 0.07, 0.13, i * 0.09)); },
    bounce() { osc('sine', 260, 520, 0.1, 0.2); },
    grow() { osc('sine', 300, 900, 0.6, 0.12, 0, 0.05); SFX.sparkle(); },
  };

  return {
    unlock() { try { ensure(); } catch (e) { /* ignore */ } },
    play(name, params) {
      if (!ctx || ctx.state !== 'running') return;
      const fn = SFX[name] || SFX.tap;
      const t = now(), min = name === 'land' ? 0.07 : 0.03;
      if (lastPlay[name] && t - lastPlay[name] < min) return; // thin out repeated calls
      lastPlay[name] = t;
      try { fn(params); } catch (e) { /* never break the game for a sound */ }
    },
    /** continuous engine hum; level 0..1 */
    engine(level) {
      if (!ctx || ctx.state !== 'running') return;
      if (!engine) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0;
        o.connect(f); f.connect(g); g.connect(master); o.start();
        engine = { o, g };
      }
      const t = now();
      engine.g.gain.setTargetAtTime(0.07 * level, t, 0.08);
      engine.o.frequency.setTargetAtTime(50 + 40 * level, t, 0.1);
    },
    get running() { return !!ctx && ctx.state === 'running'; },
  };
}
