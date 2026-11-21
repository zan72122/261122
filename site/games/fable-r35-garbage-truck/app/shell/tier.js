// Device tier and performance caps. Baseline: iPad Pro 12.9" (2020), Safari.
// iPad reports a Mac UA, so mobile = navigator.maxTouchPoints > 1.
export const LIMITS = {
  maxTriangles: 100000, heroTriangles: 50000, shellTriangles: 50000,
  gpuBytes: 128 * 1024 * 1024,
  // what the drawing buffers may use; the rest (≥ 32 MiB) is for textures + geometry (measured ≤ 20 MiB)
  frameBudgetBytes: 96 * 1024 * 1024,
};

export function detectTier(params) {
  const forced = params.get('tier');
  const touch = (navigator.maxTouchPoints || 0) > 1;
  let name = touch ? 'mobile' : 'desktop';
  if (forced === 'low' || forced === 'mobile' || forced === 'desktop') name = forced;
  const dpr = window.devicePixelRatio || 1;
  const table = {
    desktop: { dpr: Math.min(dpr, 1.5), msaa: true, msaaSamples: 4, fxCount: 48 },
    mobile: { dpr: 1.0, msaa: true, msaaSamples: 4, fxCount: 40 },
    low: { dpr: 1.0, msaa: false, msaaSamples: 0, fxCount: 24 },
  };
  return { name, touch, ...table[name] };
}

/** Bytes per canvas pixel: back colour (4) + depth/stencil (4) + front/compositor copy (4), plus MSAA samples × (colour + depth). */
export function frameBytesPerPixel(tier) {
  return 12 + (tier.msaa ? tier.msaaSamples * 8 : 0);
}

/** Pixel ratio for a CSS size: the tier's ratio, lowered if the drawing buffers would not fit the frame budget. */
export function fitPixelRatio(tier, cssW, cssH) {
  const maxPx = LIMITS.frameBudgetBytes / frameBytesPerPixel(tier);
  const px = Math.max(1, cssW * cssH);
  return Math.min(tier.dpr, Math.sqrt(maxPx / px));
}
