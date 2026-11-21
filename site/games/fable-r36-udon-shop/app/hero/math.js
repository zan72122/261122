// 小さな数式の道具（hero 専用）。THREE に依存しない。

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => { t = 1 - clamp(t, 0, 1); return 1 - t * t * t; };
export const easeOutBack = (t) => { t = clamp(t, 0, 1) - 1; return 1 + 2.70158 * t * t * t + 1.70158 * t * t; };
export const fin = (x, d) => (Number.isFinite(x) ? x : d);
// 0..1 の決まった乱数（seed が同じなら同じ値）
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// 上限 L にやわらかく寄せる（単調・なめらか）。k は効き始める幅
export const softHi = (x, L, k) => (x <= L - k ? x : L - k * Math.exp(-(x - (L - k)) / k));
export const softLo = (x, L, k) => (x >= L + k ? x : L + k * Math.exp((x - (L + k)) / k));

// 減衰ばね（x'' = -w²(x - target) - 2ζw x'）を1歩進める。s = {x, v}
export function spring(s, target, w, zeta, dt) {
  const n = dt > 0.02 ? 2 : 1, h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (-w * w * (s.x - target) - 2 * zeta * w * s.v) * h;
    s.x += s.v * h;
  }
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = target; s.v = 0; }
}

// Catmull-Rom（一様）の重み。t は区間内 0..1
export function crWeights(t, out, o) {
  const t2 = t * t, t3 = t2 * t;
  out[o] = 0.5 * (-t + 2 * t2 - t3);
  out[o + 1] = 0.5 * (2 - 5 * t2 + 3 * t3);
  out[o + 2] = 0.5 * (t + 4 * t2 - 3 * t3);
  out[o + 3] = 0.5 * (-t2 + t3);
}
