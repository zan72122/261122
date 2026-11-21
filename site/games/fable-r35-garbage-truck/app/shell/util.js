// Small math / animation helpers shared by the shell. No allocations in hot paths.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
/** frame-rate independent exponential approach */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/**
 * Tiny tween runner. Tweens are plain objects {t, dur, update(k, dtRaw), done()}.
 * Everything is driven by the game dt (so ?timescale works).
 */
export class Tweens {
  constructor() { this.list = []; }
  add(dur, update, done) {
    const tw = { t: 0, dur: Math.max(1e-4, dur), update, done, dead: false };
    this.list.push(tw);
    update && update(0);
    return tw;
  }
  wait(dur, done) { return this.add(dur, null, done); }
  cancel(tw) { if (tw) tw.dead = true; }
  update(dt) {
    const l = this.list;
    for (let i = 0; i < l.length; i++) {
      const tw = l[i];
      if (tw.dead) continue;
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update && tw.update(k);
      if (k >= 1) { tw.dead = true; tw.done && tw.done(); }
    }
    let w = 0;
    for (let i = 0; i < l.length; i++) if (!l[i].dead) l[w++] = l[i];
    l.length = w;
  }
  clear() { this.list.length = 0; }
}
