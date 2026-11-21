// 指1本だけを追う。2本目以降の指・ピンチ・長押しメニュー・スクロールは止める。
export class Pointer {
  constructor(el) {
    this.el = el; this.id = null; this.events = []; this.x = 0; this.y = 0; this.down = false;
    const push = (type, e) => {
      const r = el.getBoundingClientRect();
      this.x = e.clientX - r.left; this.y = e.clientY - r.top;
      const last = this.events[this.events.length - 1];
      if (type === 'move' && last && last.type === 'move') { last.x = this.x; last.y = this.y; return; }
      this.events.push({ type, x: this.x, y: this.y, w: r.width, h: r.height });
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.id !== null) return;
      this.id = e.pointerId; this.down = true;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      push('down', e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === this.id) { e.preventDefault(); push('move', e); } });
    const up = (e) => { if (e.pointerId !== this.id) return; push('up', e); this.id = null; this.down = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    const stop = (e) => e.preventDefault();
    for (const t of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) {
      el.addEventListener(t, stop, { passive: false });
    }
    document.addEventListener('gesturestart', stop, { passive: false });
  }
  drain() { const e = this.events; this.events = []; return e; }
  cancel() { if (this.id !== null) { this.events.push({ type: 'up', x: this.x, y: this.y, w: this.el.clientWidth, h: this.el.clientHeight }); this.id = null; this.down = false; } }
}
