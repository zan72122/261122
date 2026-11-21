// One-finger input. Only the first pointer counts; everything else is ignored.
// Blocks pinch / scroll / double-tap zoom / long-press menus on iPad.
export function createInput(canvas, handlers) {
  let active = null, sx = 0, sy = 0, st = 0, moved = false;
  const ndc = { x: 0, y: 0 };
  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / Math.max(1, r.height)) * 2 + 1;
    return ndc;
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (active !== null) return;
    active = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now(); moved = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    handlers.down(toNdc(e));
  }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    e.preventDefault();
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) moved = true;
    handlers.move(toNdc(e), moved);
  }, { passive: false });
  const end = (e) => {
    if (e.pointerId !== active) return;
    active = null;
    const tap = !moved && performance.now() - st < 600;
    handlers.up(toNdc(e), { tap, moved });
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  const stop = (e) => e.preventDefault();
  canvas.addEventListener('touchstart', stop, { passive: false });
  canvas.addEventListener('touchmove', stop, { passive: false });
  canvas.addEventListener('contextmenu', stop);
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
}
