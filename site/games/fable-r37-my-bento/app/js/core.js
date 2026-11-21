// core.js — renderer, tiers, loop, textures, debug overlay, context loss.
(function () {
  'use strict';
  const T = THREE;
  const G = (window.G = window.G || {});
  const qs = new URLSearchParams(location.search);
  G.T0 = performance.now();
  G.debug = qs.get('debug') === '1';

  // ---------- errors ----------
  G.errors = [];
  G.logError = function (msg) {
    const s = String(msg).slice(0, 200);
    G.errors.push(s);
    if (G.errors.length > 20) G.errors.shift();
  };
  window.addEventListener('error', (e) => G.logError(e.message || e.error || 'error'));
  window.addEventListener('unhandledrejection', (e) => G.logError('promise: ' + (e.reason && e.reason.message || e.reason)));

  // ---------- tier ----------
  // iPad Safari reports a Mac UA, so touch points decide "mobile".
  const ua = navigator.userAgent || '';
  const isMobile = (navigator.maxTouchPoints || 0) > 1 || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const TIERS = {
    high: { name: 'high', dpr: Math.min(window.devicePixelRatio || 1, 2), aa: true, sprinkles: 900, maxFoods: 32 },
    mobile: { name: 'mobile', dpr: 1.0, aa: false, sprinkles: 600, maxFoods: 30 },
    low: { name: 'low', dpr: 1.0, aa: false, sprinkles: 400, maxFoods: 24 },
  };
  const forced = qs.get('tier');
  G.isMobile = isMobile;
  const weak = isMobile && ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2);
  G.tier = TIERS[forced] || (weak ? TIERS.low : isMobile ? TIERS.mobile : TIERS.high);

  // ---------- renderer ----------
  const canvas = document.getElementById('c');
  G.canvas = canvas;
  const renderer = new T.WebGLRenderer({
    canvas, antialias: G.tier.aa, alpha: false, stencil: false, depth: true,
    powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(G.tier.dpr);
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  G.renderer = renderer;

  const scene = new T.Scene();
  scene.background = new T.Color(0xf6e7d2);
  G.scene = scene;
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 120);
  G.camera = camera;

  G.resizeHooks = [];
  G.viewW = 1; G.viewH = 1;
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    G.viewW = w; G.viewH = h;
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const f of G.resizeHooks) f(w, h);
  }
  G.resize = resize;
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // Place the camera along a fixed direction so that all given points fit on screen.
  G.fitCamera = function (target, dir, points, fov, margin) {
    camera.fov = fov; camera.updateProjectionMatrix();
    const d = dir.clone().normalize();
    const v = new T.Vector3();
    let lo = 2, hi = 80;
    for (let it = 0; it < 26; it++) {
      const mid = (lo + hi) / 2;
      camera.position.copy(target).addScaledVector(d, mid);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      let ok = true;
      for (const p of points) {
        v.copy(p).project(camera);
        if (Math.abs(v.x) > margin.x || v.y > margin.top || v.y < -margin.bottom || v.z > 1) { ok = false; break; }
      }
      if (ok) hi = mid; else lo = mid;
    }
    camera.position.copy(target).addScaledVector(d, hi);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  };

  // ---------- textures ----------
  G.texRegistry = new Set(); // every texture we upload, for the memory estimate and restore
  G.trackTex = function (tex, w, h, label) {
    tex.userData.w = w; tex.userData.h = h; tex.userData.label = label;
    G.texRegistry.add(tex);
    tex.addEventListener('dispose', () => G.texRegistry.delete(tex));
    return tex;
  };
  const texCache = {};
  // Loads a JPEG from app/assets (http) or from window.TEX_DATA (file://, data URIs).
  G.loadTex = function (name, opts) {
    if (texCache[name]) return texCache[name];
    const tex = new T.Texture();
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = (opts && opts.mirror) ? T.MirroredRepeatWrapping : T.RepeatWrapping;
    tex.anisotropy = 1;
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        tex.image = img; tex.needsUpdate = true;
        G.trackTex(tex, img.naturalWidth, img.naturalHeight, name);
        resolve(tex);
      };
      img.onerror = () => { G.logError('texture failed: ' + name); resolve(null); };
      const data = window.TEX_DATA && window.TEX_DATA[name];
      img.src = data || ('assets/' + name + '.jpg');
    });
    texCache[name] = { tex, ready: p };
    return texCache[name];
  };
  // Small canvas texture (patterns, glows). Size stays tiny.
  G.canvasTex = function (size, draw, label, srgb) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    draw(g, size);
    const tex = new T.CanvasTexture(c);
    if (srgb !== false) tex.colorSpace = T.SRGBColorSpace;
    G.trackTex(tex, size, size, label);
    return tex;
  };

  // ---------- loop ----------
  G.updaters = [];
  G.time = 0;
  const frameTimes = [];
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    frameTimes.push(dt);
    if (frameTimes.length > 180) frameTimes.shift();
    if (dt > 0.1) dt = 0.1;
    G.time += dt;
    G.dt = dt;
    if (G.contextLost) return;
    try {
      for (const f of G.updaters) f(dt, G.time);
      renderer.render(scene, camera);
    } catch (e) {
      G.logError(e && e.message || e);
    }
    if (G.debug) updateDebug(now);
  }
  G.startLoop = function () { requestAnimationFrame((t) => { last = t; frame(t); }); };

  // ---------- context loss ----------
  G.contextLost = false; G.lostCount = 0; G.restoredCount = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allow restore
    G.contextLost = true; G.lostCount++;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    // three.js rebuilds its internal GL state; we flag every resource to re-upload.
    for (const tex of G.texRegistry) tex.needsUpdate = true;
    scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
      if (o.isInstancedMesh) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
      if (o.geometry) for (const k in o.geometry.attributes) o.geometry.attributes[k].needsUpdate = true;
    });
    G.contextLost = false; G.restoredCount++;
    resize();
  }, false);
  G.debugLoseContext = function (ms) {
    const ext = renderer.getContext().getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), ms || 400);
    return true;
  };

  // ---------- GPU memory estimate ----------
  G.estimateGpu = function () {
    let tex = 0;
    for (const t of G.texRegistry) {
      const w = t.userData.w || 0, h = t.userData.h || 0;
      tex += w * h * 4 * (t.generateMipmaps !== false ? 4 / 3 : 1);
    }
    let geo = 0;
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        const g = o.geometry;
        for (const k in g.attributes) geo += g.attributes[k].array.byteLength;
        if (g.index) geo += g.index.array.byteLength;
      }
      if (o.isInstancedMesh) {
        geo += o.instanceMatrix.array.byteLength;
        if (o.instanceColor) geo += o.instanceColor.array.byteLength;
      }
    });
    const db = new T.Vector2();
    renderer.getDrawingBufferSize(db);
    const px = db.x * db.y;
    // front + back colour (RGBA8) + depth24/stencil8; MSAA x4 adds multisampled colour+depth.
    let fb = px * (4 + 4 + 4);
    if (G.tier.aa) fb += px * (4 + 4) * 4;
    return { tex, geo, fb, total: tex + geo + fb, w: db.x, h: db.y, count: G.texRegistry.size };
  };

  // ---------- debug overlay ----------
  let dbgEl = null, dbgT = 0;
  G.stats = {};
  function updateDebug(now) {
    if (now - dbgT < 500) return;
    dbgT = now;
    if (!dbgEl) {
      dbgEl = document.createElement('pre');
      dbgEl.id = 'dbg';
      document.body.appendChild(dbgEl);
    }
    const ft = frameTimes.slice().sort((a, b) => a - b);
    const avg = ft.length ? ft.length / ft.reduce((a, b) => a + b, 0) : 0;
    const p95 = ft.length ? 1 / ft[Math.min(ft.length - 1, Math.floor(ft.length * 0.95))] : 0;
    const r = renderer.info.render, m = renderer.info.memory;
    const mem = G.estimateGpu();
    const mib = (b) => (b / 1048576).toFixed(1);
    G.stats = {
      tier: G.tier.name, w: mem.w, h: mem.h, dpr: renderer.getPixelRatio(), fpsAvg: avg, fpsP95: p95,
      calls: r.calls, tris: r.triangles, textures: m.textures, texCount: mem.count, geometries: m.geometries,
      gpuMiB: mem.total / 1048576, texMiB: mem.tex / 1048576, geoMiB: mem.geo / 1048576, fbMiB: mem.fb / 1048576,
      errors: G.errors.length, scene: G.state && G.state.scene, lost: G.lostCount, restored: G.restoredCount,
      firstInteractiveMs: G.firstInteractiveMs,
    };
    dbgEl.textContent =
      `tier ${G.tier.name}  canvas ${mem.w}x${mem.h} @${renderer.getPixelRatio()}\n` +
      `fps avg ${avg.toFixed(0)}  p95 ${p95.toFixed(0)}\n` +
      `calls ${r.calls}  tris ${r.triangles}\n` +
      `tex ${m.textures} (${mem.count} img) ${mib(mem.tex)}MiB  geo ${mib(mem.geo)}MiB\n` +
      `fb ${mib(mem.fb)}MiB  GPU est ${mib(mem.total)}MiB\n` +
      `scene ${G.state ? G.state.scene : '-'}  ready ${G.firstInteractiveMs | 0}ms  ctx lost/restored ${G.lostCount}/${G.restoredCount}\n` +
      `errors ${G.errors.length}${G.errors.length ? '\n' + G.errors.slice(-3).join('\n') : ''}`;
  }

  // ---------- small math helpers ----------
  G.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smooth = (t) => { t = G.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  G.easeOutBack = (t) => { t = G.clamp(t, 0, 1); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  G.damp = (k, dt) => 1 - Math.exp(-k * dt);
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.pick = (arr) => arr[(Math.random() * arr.length) | 0];
})();
