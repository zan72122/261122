// ?debug=1 の小さなオーバーレイ：tier・canvas・fps（平均/p95）・draw call・三角形・テクスチャ・GPU見積もり・エラー
export class Debug {
  constructor(enabled) {
    this.enabled = enabled;
    this.frames = new Float32Array(240); this.n = 0; this.i = 0;
    this.cpu = new Float32Array(240); this.ci = 0; this.cn = 0;   // 1フレームの JS（更新＋描画命令）の ms
    this.nan = 0;   // 頂点の NaN・長さ0の法線の数（geometry を測るときに一緒に数える）
    this.errors = [];
    this.last = { calls: 0, tris: 0 };
    this.geoBytes = 0; this.geoT = 0; this.showT = 0;
    if (enabled) {
      const d = this.el = document.createElement('div');
      d.style.cssText = 'position:fixed;left:6px;top:6px;z-index:10;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.55);padding:5px 7px;border-radius:6px;white-space:pre;max-width:96vw;overflow:hidden';
      document.body.appendChild(d);
    }
  }
  error(msg) { this.errors.push(String(msg).slice(0, 200)); if (this.errors.length > 20) this.errors.shift(); }
  frame(dt) { this.frames[this.i] = dt * 1000; this.i = (this.i + 1) % this.frames.length; this.n = Math.min(this.n + 1, this.frames.length); }
  cpuFrame(ms) { this.cpu[this.ci] = ms; this.ci = (this.ci + 1) % this.cpu.length; this.cn = Math.min(this.cn + 1, this.cpu.length); }
  cpuMs() {
    if (!this.cn) return { avg: 0, p95: 0 };
    const a = Array.from(this.cpu.subarray(0, this.cn)).sort((x, y) => x - y);
    return { avg: a.reduce((s, x) => s + x, 0) / a.length, p95: a[Math.floor(a.length * 0.95)] || 0 };
  }
  fps() {
    if (!this.n) return { avg: 0, p95: 0 };
    const a = Array.from(this.frames.subarray(0, this.n)).sort((x, y) => x - y);
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    return { avg: 1000 / Math.max(mean, 0.001), p95ms: a[Math.floor(a.length * 0.95)] || 0 };
  }
  // シーンの頂点バッファの合計（同じ geometry は1回だけ数える）
  // あわせて、描いている頂点に NaN／長さ0の法線（シェーダーの normalize で NaN → 黒くなる）が無いか数える
  measureGeometry(scene) {
    const seen = new Set(); let b = 0, bad = 0;
    scene.traverse((o) => {
      if (o.isInstancedMesh) b += o.instanceMatrix.array.byteLength + (o.instanceColor ? o.instanceColor.array.byteLength : 0);
      const g = o.geometry; if (!g || seen.has(g)) return; seen.add(g);
      for (const k in g.attributes) b += g.attributes[k].array.byteLength;
      if (g.index) b += g.index.array.byteLength;
      if (!o.visible || !o.isMesh) return;
      // 描く範囲（index があれば index の drawRange が指す頂点）だけを見る
      const P = g.attributes.position, N = g.attributes.normal, pa = P.array, na = N && N.array, I = g.index && g.index.array;
      const start = g.drawRange.start, end = Math.min(I ? I.length : P.count, start + g.drawRange.count);
      for (let k = start; k < end; k++) {
        const i = I ? I[k] : k, x = na ? na[i * 3] : 0, y = na ? na[i * 3 + 1] : 1, z = na ? na[i * 3 + 2] : 0;
        if (!Number.isFinite(pa[i * 3] + pa[i * 3 + 1] + pa[i * 3 + 2]) || !(x * x + y * y + z * z > 1e-12)) { bad++; break; }
      }
    });
    this.geoBytes = b; this.nan = bad; return b;
  }
  report(s) { this.state = s; }
  update(dt, info) {
    this.showT -= dt;
    if (!this.enabled || this.showT > 0 || !this.state) return;
    this.showT = 0.5;
    const s = this.state, f = this.fps(), MiB = (x) => (x / 1048576).toFixed(1);
    this.el.textContent =
      `tier ${s.tier}  dpr ${s.dpr.toFixed(2)}  scale ${s.scale.toFixed(2)}\n` +
      `canvas ${s.w}x${s.h}  boot ${Math.round(s.boot)}ms\n` +
      `fps ${f.avg.toFixed(1)} avg  p95 ${f.p95ms.toFixed(1)}ms (${(1000 / Math.max(f.p95ms, 0.001)).toFixed(0)}fps)\n` +
      `cpu ${this.cpuMs().avg.toFixed(2)}ms avg  p95 ${this.cpuMs().p95.toFixed(2)}ms  NaN ${this.nan}\n` +
      `draw ${s.calls}  tri ${s.tris}  (hero ${s.heroTris} / ${s.heroCalls}dc)\n` +
      `tex ${s.texCount} (gl ${s.glTextures})  geo ${s.glGeometries}\n` +
      `GPU est ${MiB(s.gpu)} MiB  fb ${MiB(s.fb)} tex ${MiB(s.tex)} geo ${MiB(s.geo)}\n` +
      `place ${s.place}  cuts ${s.cuts}  serves ${s.serves}  ${s.lost ? 'CONTEXT LOST' : ''}\n` +
      `err ${this.errors.length}${this.errors.length ? ': ' + this.errors[this.errors.length - 1] : ''}`;
  }
}
