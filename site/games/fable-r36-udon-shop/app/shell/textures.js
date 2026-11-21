// テクスチャの置き場と GPU メモリ見積もり。
// 写真は最初 1×1 の平均色で作って、読めたら image を差し替える（最初の描画を待たせない）。
// file:// では画像を WebGL に渡せないので、assets/textures.js（data URI）を読む。
import { THREE } from './three.js';

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
    document.head.appendChild(s);
  });
}

export class TextureBank {
  constructor(renderer) {
    this.renderer = renderer;
    this.items = [];          // { name, tex, w, h, mip }
    this.fileMode = location.protocol === 'file:';
    this._dataPromise = null;
  }
  _register(name, tex, w, h, mip) {
    const it = { name, tex, w, h, mip };
    this.items.push(it);
    return it;
  }
  _source(name) {
    if (!this.fileMode) return Promise.resolve('assets/' + name + '.jpg');
    if (!this._dataPromise) this._dataPromise = window.UdonTextureData ? Promise.resolve() : loadScript('assets/textures.js');
    return this._dataPromise.then(() => {
      const d = window.UdonTextureData && window.UdonTextureData[name];
      if (!d) throw new Error('no texture data ' + name);
      return d;
    });
  }
  // 写真テクスチャ（app/assets/<name>.jpg）
  photo(name, avg, { repeat = [1, 1], wrap = true } = {}) {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('2d'); g.fillStyle = avg; g.fillRect(0, 0, 1, 1);
    const tex = new THREE.Texture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
    tex.repeat.set(repeat[0], repeat[1]);
    tex.needsUpdate = true;
    const it = this._register(name, tex, 1, 1, true);
    tex.userData.ready = this._source(name).then((src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const done = () => { tex.dispose(); tex.image = img; tex.needsUpdate = true;   // 大きさが変わるので一度 GPU 側を捨てる
          it.w = img.naturalWidth; it.h = img.naturalHeight; res(tex); };
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = () => rej(new Error('image ' + name));
      img.src = src;
    })).catch((e) => { console.warn('[udon] texture', name, e.message); return tex; });
    return tex;
  }
  // 手続きの Canvas テクスチャ
  canvas(name, w, h, draw, { wrap = false, srgb = true, mip = true } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    if (wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = mip;
    if (!mip) tex.minFilter = THREE.LinearFilter;
    this._register(name, tex, w, h, mip);
    return tex;
  }
  ready() { return Promise.all(this.items.map((i) => i.tex.userData.ready).filter(Boolean)); }
  bytes() {
    let b = 0;
    for (const i of this.items) b += i.w * i.h * 4 * (i.mip ? 4 / 3 : 1);
    return b;
  }
  list() { return this.items.map((i) => ({ name: i.name, width: i.w, height: i.h })); }
  // コンテキスト喪失から戻ったら全部もう一度 GPU へ送る
  restore() { for (const i of this.items) i.tex.needsUpdate = true; }
  dispose() { for (const i of this.items) i.tex.dispose(); this.items.length = 0; }
}

// ---- 手続きテクスチャの絵 ----
export function drawWood(g, w, h) {
  g.fillStyle = '#c98f55'; g.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y += 1) {
    const v = Math.sin(y * 0.11 + Math.sin(y * 0.023) * 4) * 0.5 + 0.5;
    g.fillStyle = `rgba(${120 + v * 40},${70 + v * 30},${35 + v * 15},${0.10 + v * 0.10})`;
    g.fillRect(0, y, w, 1);
  }
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(110,62,28,${0.06 + rnd() * 0.1})`; g.lineWidth = 1 + rnd() * 1.5;
    const y0 = rnd() * h; g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.03 + i) * 3);
    g.stroke();
  }
}
export function drawSoft(g, w, h) {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
}
export function drawSparkle(g, w, h) {
  const cx = w / 2, cy = h / 2;
  const r = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, rr = i % 2 ? w * 0.09 : w * 0.48;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}
export function drawHeart(g, w, h) {
  g.fillStyle = '#fff';
  g.beginPath();
  const s = w / 64;
  g.moveTo(32 * s, 54 * s);
  g.bezierCurveTo(4 * s, 36 * s, 6 * s, 10 * s, 20 * s, 10 * s);
  g.bezierCurveTo(27 * s, 10 * s, 31 * s, 15 * s, 32 * s, 20 * s);
  g.bezierCurveTo(33 * s, 15 * s, 37 * s, 10 * s, 44 * s, 10 * s);
  g.bezierCurveTo(58 * s, 10 * s, 60 * s, 36 * s, 32 * s, 54 * s);
  g.fill();
}
export function drawBowlPattern(color) {
  return (g, w, h) => {
    g.fillStyle = '#fbf6ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.fillRect(0, 0, w, h * 0.22); g.fillRect(0, h * 0.9, w, h * 0.1);
    for (let i = 0; i < 8; i++) {          // 丸い水玉
      g.beginPath(); g.arc((i + 0.5) * w / 8, h * 0.56, h * 0.13, 0, Math.PI * 2); g.fill();
    }
  };
}
export function drawNet(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(205,210,214,1)'; g.lineWidth = 2;
  for (let i = 0; i <= w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
  for (let j = 0; j <= h; j += 8) { g.beginPath(); g.moveTo(0, j); g.lineTo(w, j); g.stroke(); }
}
