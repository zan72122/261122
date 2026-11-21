/* audio: every sound is synthesised with WebAudio (no files) */
(function () {
  'use strict';
  var MJ = window.MJ;
  var ctx = null, master = null, noiseBuf = null, motor = null, unlocked = false;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.55;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      var n = ctx.sampleRate * 1.0; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // call inside a user gesture (iOS needs a sound started in the gesture)
  function unlock() {
    var c = ensure(); if (!c || unlocked) return;
    var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
    unlocked = true;
  }

  function env(g, t0, a, peak, dur) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dur);
  }
  function tone(o) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 20), t0 + (o.glide || o.dur));
    env(g, t0, o.a || 0.006, o.vol || 0.3, o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + (o.a || 0.006) + o.dur + 0.05);
  }
  function noise(o) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    var s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = c.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0); f.Q.value = o.q || 1;
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    var g = c.createGain(); env(g, t0, o.a || 0.004, o.vol || 0.2, o.dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + o.dur + 0.06);
  }

  var A = (MJ.Audio = { unlock: unlock });
  A.pop = function (p) { p = p || 1; tone({ f0: 520 * p, f1: 980 * p, dur: 0.09, vol: 0.22 }); };
  A.pick = function () { tone({ f0: 420, f1: 760, dur: 0.08, vol: 0.18, type: 'triangle' }); };
  A.plop = function (wet) {
    tone({ f0: 720, f1: 180, dur: 0.16, vol: 0.32 });
    if (wet) noise({ f: 1400, f1: 500, q: 0.8, dur: 0.22, vol: 0.16, delay: 0.02 });
  };
  A.click = function () { tone({ f0: 1800, f1: 900, dur: 0.03, vol: 0.2, type: 'square' }); tone({ f0: 300, f1: 160, dur: 0.08, vol: 0.25, delay: 0.01 }); };
  A.crunch = function () {
    noise({ f: 2600, q: 0.7, dur: 0.07, vol: 0.32 });
    noise({ f: 900, q: 1.2, dur: 0.12, vol: 0.25, delay: 0.04 });
    tone({ f0: 240, f1: 90, dur: 0.1, vol: 0.18, type: 'square' });
  };
  A.splash = function () { noise({ f: 1800, f1: 600, q: 0.6, dur: 0.25, vol: 0.18 }); };
  A.glug = function (p) { p = p || 1; tone({ f0: 260 * p, f1: 520 * p, dur: 0.07, vol: 0.2, glide: 0.06 }); };
  A.chirp = function (p) { p = p || 1; tone({ f0: 660 * p, f1: 900 * p, dur: 0.1, vol: 0.2, type: 'triangle' }); tone({ f0: 880 * p, f1: 1320 * p, dur: 0.14, vol: 0.2, type: 'triangle', delay: 0.11 }); };
  A.giggle = function (p) { p = p || 1; for (var i = 0; i < 3; i++) tone({ f0: (700 + i * 60) * p, f1: (520 + i * 40) * p, dur: 0.07, vol: 0.14, type: 'triangle', delay: i * 0.09 }); };
  A.clink = function () {
    [2093, 3136, 4186].forEach(function (f, i) { tone({ f0: f, dur: 0.9 - i * 0.2, vol: 0.12, a: 0.002 }); });
    [523, 659, 784, 1047].forEach(function (f, i) { tone({ f0: f, dur: 0.22, vol: 0.13, type: 'triangle', delay: 0.18 + i * 0.09 }); });
  };
  A.gulp = function (d) { tone({ f0: 180, f1: 340, dur: 0.09, vol: 0.18, delay: d || 0 }); };
  A.whoosh = function () { noise({ f: 400, f1: 2400, q: 0.7, dur: 0.35, vol: 0.18 }); };
  A.sparkle = function () { [1568, 2093, 2637].forEach(function (f, i) { tone({ f0: f, dur: 0.18, vol: 0.07, delay: i * 0.06 }); }); };
  A.tink = function () { tone({ f0: 1900, dur: 0.25, vol: 0.09, a: 0.002 }); };
  A.boing = function () { tone({ f0: 220, f1: 440, dur: 0.18, vol: 0.18, type: 'triangle' }); };
  A.again = function () { [523, 659, 784, 1047].forEach(function (f, i) { tone({ f0: f, dur: 0.12, vol: 0.14, type: 'triangle', delay: i * 0.06 }); }); };

  // Blender motor: "ga-ga-ga" = sawtooth + noise, amplitude-modulated.
  A.motor = function (on) {
    var c = ensure(); if (!c) return;
    if (on && !motor) {
      var t = c.currentTime;
      var osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 62;
      var osc2 = c.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 93;
      var src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1100; nf.Q.value = 0.8;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      var mix = c.createGain(); mix.gain.value = 0;
      var am = c.createGain(); am.gain.value = 0.6;
      var lfo = c.createOscillator(); lfo.frequency.value = 11; var lfoG = c.createGain(); lfoG.gain.value = 0.4;
      lfo.connect(lfoG); lfoG.connect(am.gain);
      var g1 = c.createGain(); g1.gain.value = 0.35; var g2 = c.createGain(); g2.gain.value = 0.12; var gn = c.createGain(); gn.gain.value = 0.5;
      osc.connect(g1); osc2.connect(g2); g1.connect(lp); g2.connect(lp); src.connect(nf); nf.connect(gn); gn.connect(lp);
      lp.connect(am); am.connect(mix); mix.connect(master);
      mix.gain.setTargetAtTime(0.22, t, 0.08);
      osc.start(); osc2.start(); src.start(); lfo.start();
      motor = { osc: osc, osc2: osc2, src: src, lfo: lfo, mix: mix, lp: lp, gn: gn };
    } else if (!on && motor) {
      var m = motor; motor = null; var t2 = c.currentTime;
      m.mix.gain.setTargetAtTime(0, t2, 0.1);
      m.osc.frequency.setTargetAtTime(30, t2, 0.15);
      setTimeout(function () { try { m.osc.stop(); m.osc2.stop(); m.src.stop(); m.lfo.stop(); } catch (e) { /* already stopped */ } }, 600);
    }
  };
  A.motorLoad = function (x) {
    if (!motor || !ctx) return;
    var t = ctx.currentTime;
    motor.lp.frequency.setTargetAtTime(700 + 1400 * x, t, 0.05);
    motor.gn.gain.setTargetAtTime(0.5 + 1.2 * x, t, 0.05);
    motor.osc.frequency.setTargetAtTime(62 - 14 * x, t, 0.05);
  };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && unlocked && ctx.state === 'suspended') ctx.resume(); };
})();
