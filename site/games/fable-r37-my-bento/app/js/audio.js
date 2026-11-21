// audio.js — tiny WebAudio synth for sound effects (no files, no network).
(function () {
  'use strict';
  const G = window.G;
  let ctx = null, master = null, noiseBuf = null;
  let active = 0;
  const MAX_ACTIVE = 28;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 1;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // iOS needs a sound started inside the gesture to unlock output.
      const o = ctx.createOscillator(), g = ctx.createGain();
      g.gain.value = 0.0001; o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.02);
    } catch (e) { ctx = null; }
  }

  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function track(node, stopAt) {
    active++;
    node.onended = () => { active--; };
    node.stop(stopAt);
  }
  function tone(f0, f1, dur, opt) {
    if (!ctx || active > MAX_ACTIVE) return;
    opt = opt || {};
    const t0 = ctx.currentTime + (opt.delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    env(g, t0, opt.attack || 0.008, dur, (opt.gain || 0.3));
    o.connect(g); g.connect(master);
    o.start(t0); track(o, t0 + dur + 0.05);
    if (opt.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = opt.vib; lg.gain.value = opt.vibDepth || 12;
      l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05);
    }
  }
  function noise(dur, f0, f1, opt) {
    if (!ctx || active > MAX_ACTIVE) return;
    opt = opt || {};
    const t0 = ctx.currentTime + (opt.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.playbackRate.value = opt.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.Q.value = opt.q || 1.2;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    env(g, t0, opt.attack || 0.005, dur, opt.gain || 0.25);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); track(s, t0 + dur + 0.05);
  }
  function bell(freq, delay, gain, dur) {
    tone(freq, freq, dur || 0.5, { delay, gain: gain || 0.18, type: 'sine' });
    tone(freq * 2.01, freq * 2.01, (dur || 0.5) * 0.6, { delay, gain: (gain || 0.18) * 0.35, type: 'sine' });
  }
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const S = {
    pick() { tone(480, 820, 0.12, { gain: 0.22 }); },
    drop() { tone(330, 170, 0.16, { gain: 0.28 }); noise(0.06, 900, 400, { gain: 0.12, filter: 'lowpass' }); },
    squish() { tone(240, 150, 0.22, { type: 'triangle', gain: 0.22, vib: 28, vibDepth: 30 }); },
    tap() { tone(700, 900, 0.08, { gain: 0.16 }); },
    boop() { tone(520, 390, 0.12, { type: 'triangle', gain: 0.2 }); },
    shake() { for (let i = 0; i < 3; i++) noise(0.07, 5200, 4200, { delay: i * 0.09, gain: 0.16, filter: 'highpass', q: 0.7 }); },
    sprinkle() { noise(0.05, 7000, 6000, { gain: 0.06, filter: 'highpass' }); },
    stick() { tone(1300, 900, 0.05, { type: 'square', gain: 0.07 }); tone(900, 1200, 0.06, { delay: 0.04, gain: 0.12 }); },
    lidClose() { noise(0.09, 900, 300, { gain: 0.25, filter: 'lowpass' }); tone(220, 130, 0.14, { gain: 0.25, type: 'triangle', delay: 0.01 }); },
    fold() { noise(0.32, 500, 2200, { gain: 0.16, q: 0.8 }); },
    knot() { tone(500, 1100, 0.14, { gain: 0.2, type: 'triangle' }); tone(1150, 1300, 0.12, { delay: 0.13, gain: 0.16 }); },
    whoosh() { noise(0.7, 300, 2600, { gain: 0.18, q: 0.6, attack: 0.2 }); },
    chime() { [72, 76, 79, 84].forEach((n, i) => bell(NOTE(n), i * 0.11, 0.16, 0.6)); },
    open() { tone(380, 950, 0.12, { gain: 0.28 }); [84, 88, 91, 96].forEach((n, i) => bell(NOTE(n), 0.1 + i * 0.07, 0.12, 0.5)); },
    untie() { tone(1000, 450, 0.18, { type: 'triangle', gain: 0.18 }); noise(0.3, 1800, 500, { gain: 0.12, delay: 0.05 }); },
    munch() { for (let i = 0; i < 4; i++) noise(0.06, 700 + Math.random() * 300, 500, { delay: i * 0.22, gain: 0.22, q: 2 }); },
    gulp() { tone(300, 600, 0.12, { gain: 0.2 }); },
    happy() { [76, 79, 83, 88].forEach((n, i) => bell(NOTE(n), i * 0.09, 0.15, 0.5)); },
    boing() { tone(260, 620, 0.12, { gain: 0.22 }); tone(620, 330, 0.18, { delay: 0.12, gain: 0.18 }); },
    fanfare() { [67, 72, 76, 79, 84, 79, 84].forEach((n, i) => bell(NOTE(n), i * 0.13, 0.17, 0.55)); },
    bird() { const f = 2400 + Math.random() * 900; tone(f, f * 1.3, 0.08, { gain: 0.05 }); tone(f * 1.1, f * 0.9, 0.07, { delay: 0.11, gain: 0.04 }); },
    glow() { bell(NOTE(91), 0, 0.05, 0.3); },
  };

  G.sfx = {
    unlock: init,
    play(name) { if (!ctx) return; try { S[name] && S[name](); } catch (e) { /* audio must never break play */ } },
    get ready() { return !!ctx; },
  };
})();
