// 端末判定と性能ティア。iPad は Mac の UA を名乗るので maxTouchPoints > 1 でモバイルとみなす。
export function detectTier(params) {
  const ua = navigator.userAgent || '';
  const mobile = (navigator.maxTouchPoints || 0) > 1 || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const tiers = {
    // 基準機（2020 iPad Pro 12.9"）: DPR 1.0 固定、MSAA なし
    mobile:  { name: 'mobile',  dpr: 1.0, maxPixels: 1.6e6, hero: 'mid',  fx: 1.0 },
    desktop: { name: 'desktop', dpr: Math.min(window.devicePixelRatio || 1, 2), maxPixels: 3.7e6, hero: 'high', fx: 1.0 },
    low:     { name: 'low',     dpr: mobile ? 0.75 : 1.0, maxPixels: 1.0e6, hero: 'low', fx: 0.5 },
  };
  const want = params.get('tier');
  const t = tiers[want] || (mobile ? tiers.mobile : tiers.desktop);
  return { ...t, mobile, antialias: false, minScale: 0.7 };
}
