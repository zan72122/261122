/* core: namespace, tier, math helpers, colour mixing, debug overlay */
(function () {
  'use strict';
  var MJ = (window.MJ = window.MJ || {});
  MJ.t0 = performance.now();
  MJ.errors = [];
  function pushErr(msg) {
    msg = String(msg).slice(0, 160);
    if (MJ.errors.length < 20) MJ.errors.push(msg);
    if (MJ.debug) console.warn('[MJ]', msg);
  }
  MJ.pushErr = pushErr;
  window.addEventListener('error', function (e) { pushErr(e.message || e); });
  window.addEventListener('unhandledrejection', function (e) { pushErr('promise: ' + ((e.reason && e.reason.message) || e.reason)); });

  var q = new URLSearchParams(location.search);
  MJ.debug = q.get('debug') === '1';

  // iPad reports a Mac UA, so maxTouchPoints > 1 is the mobile test.
  var isMobile = (navigator.maxTouchPoints || 0) > 1 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  var TIERS = {
    desktop: { name: 'desktop', dpr: Math.min(window.devicePixelRatio || 1, 2), aa: true, disc: [36, 64], side: [48, 10], detail: 1.0, particles: 220 },
    mobile: { name: 'mobile', dpr: 1.0, aa: false, disc: [28, 48], side: [40, 8], detail: 0.85, particles: 160 },
    low: { name: 'low', dpr: 0.75, aa: false, disc: [20, 40], side: [32, 6], detail: 0.7, particles: 110 }
  };
  var tn = q.get('tier');
  MJ.isMobile = isMobile;
  MJ.tier = TIERS[tn] || (isMobile ? TIERS.mobile : TIERS.desktop);

  // ---------- math ----------
  var M = (MJ.M = {});
  M.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.sat = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  M.smooth = function (a, b, x) { var t = M.sat((x - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
  M.damp = function (a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); };
  M.easeOutBack = function (t) { var c1 = 1.70158, c3 = c1 + 1; t = M.sat(t); return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  M.easeInOut = function (t) { t = M.sat(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  M.easeOut = function (t) { t = M.sat(t); return 1 - (1 - t) * (1 - t) * (1 - t); };
  M.easeIn = function (t) { t = M.sat(t); return t * t; };
  M.rand = function (a, b) { return a + Math.random() * (b - a); };
  M.fin = function (x, d) { return isFinite(x) ? x : d; };
  // damped bounce 0..1 (a "boing")
  M.boing = function (t, f) { if (t < 0 || t > 1) return 0; return Math.sin(t * Math.PI * (f || 3)) * (1 - t); };

  // ---------- colour: OKLab mixing that keeps juice colours bright ----------
  // input/output: THREE.Color in linear sRGB (three's working space)
  function toLab(c) {
    var l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    var m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    var s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
    l = Math.cbrt(Math.max(l, 0)); m = Math.cbrt(Math.max(m, 0)); s = Math.cbrt(Math.max(s, 0));
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromLab(L, a, b, out) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.291485548 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    out.r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    out.g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    out.b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return out;
  }
  MJ.toLab = toLab;
  // items: [{lab:[L,a,b], w}] -> THREE.Color
  MJ.mixLab = function (items, out) {
    var W = 0, L = 0, A = 0, B = 0, C = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], w = Math.max(it.w, 0);
      W += w; L += it.lab[0] * w; A += it.lab[1] * w; B += it.lab[2] * w;
      C += Math.hypot(it.lab[1], it.lab[2]) * w;
    }
    if (W <= 1e-6) { out.setRGB(1, 1, 1); return out; }
    L /= W; A /= W; B /= W; C /= W;
    var c = Math.hypot(A, B), target = Math.max(C * 1.02, 0.115); // keep juice colours vivid
    if (c > 1e-4) { var k = Math.max(c, target) / c; A *= k; B *= k; }
    L = Math.min(0.74, Math.max(0.5, L - 0.03));
    // pull chroma back into gamut
    for (var t = 0; t < 12; t++) {
      fromLab(L, A, B, out);
      if (out.r >= -0.001 && out.g >= -0.001 && out.b >= -0.001 && out.r <= 1.001 && out.g <= 1.001 && out.b <= 1.001) break;
      A *= 0.9; B *= 0.9;
    }
    out.r = M.sat(out.r); out.g = M.sat(out.g); out.b = M.sat(out.b);
    return out;
  };

  // ---------- frame stats & debug overlay ----------
  var ft = new Float32Array(180), fti = 0, ftn = 0;
  MJ.stats = { avgFps: 0, p95Fps: 0, avgMs: 0, calls: 0, tris: 0, tex: 0, geo: 0, gpuMB: 0, firstInteractiveMs: -1 };
  MJ.recordFrame = function (ms) {
    ft[fti] = ms; fti = (fti + 1) % ft.length; ftn = Math.min(ftn + 1, ft.length);
  };
  MJ.frameSummary = function () {
    if (!ftn) return;
    var arr = Array.prototype.slice.call(ft, 0, ftn).sort(function (a, b) { return a - b; });
    var sum = 0; for (var i = 0; i < ftn; i++) sum += arr[i];
    var avg = sum / ftn, p95 = arr[Math.min(ftn - 1, Math.floor(ftn * 0.95))];
    MJ.stats.avgMs = avg; MJ.stats.avgFps = 1000 / Math.max(avg, 0.1); MJ.stats.p95Fps = 1000 / Math.max(p95, 0.1);
  };

  var dbgEl = null;
  MJ.updateDebug = function (renderer) {
    if (!MJ.debug) return;
    if (!dbgEl) {
      dbgEl = document.createElement('div'); dbgEl.id = 'dbg';
      dbgEl.style.cssText = 'position:fixed;left:6px;top:6px;z-index:20;font:11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(30,20,40,.72);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre;max-width:60vw';
      document.body.appendChild(dbgEl);
    }
    MJ.frameSummary();
    var s = MJ.stats, cv = renderer.domElement;
    dbgEl.textContent =
      'tier ' + MJ.tier.name + '  mobile ' + MJ.isMobile + '  dpr ' + renderer.getPixelRatio().toFixed(2) + (MJ.renderScaleNote || '') + '\n' +
      'canvas ' + cv.width + 'x' + cv.height + '  aa ' + MJ.tier.aa + '\n' +
      'fps avg ' + s.avgFps.toFixed(1) + '  p95 ' + s.p95Fps.toFixed(1) + '  (' + s.avgMs.toFixed(1) + 'ms, cpu ' + (s.cpuMs || 0).toFixed(1) + 'ms)\n' +
      'draw ' + s.calls + '  tris ' + s.tris + '  (hero ' + (s.heroTris || 0) + ')\n' +
      'tex ' + s.tex + '  geo ' + s.geo + '  gpu~' + s.gpuMB.toFixed(1) + 'MiB\n' +
      'first touch ready ' + (s.firstInteractiveMs >= 0 ? (s.firstInteractiveMs / 1000).toFixed(2) + 's' : '-') +
      '  ctxLost ' + (MJ.ctxLostCount || 0) + '/' + (MJ.ctxRestoredCount || 0) + '\n' +
      'nan ' + (MJ.nanCount || 0) + '  errors ' + MJ.errors.length + (MJ.errors.length ? '\n' + MJ.errors.slice(-4).join('\n') : '');
  };

  // Estimate GPU memory: textures (+mips), geometry buffers, framebuffers.
  MJ.estimateGPU = function (renderer, scene) {
    var tex = new Set(), geo = new Set(), bytes = 0, texBytes = 0, geoBytes = 0;
    function addTex(t) {
      if (!t || !t.isTexture || tex.has(t)) return;
      tex.add(t);
      var img = t.image, w = (img && (img.width || img.videoWidth)) || 1, h = (img && (img.height || img.videoHeight)) || 1;
      var b = w * h * 4; if (t.generateMipmaps !== false && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter) b *= 4 / 3;
      texBytes += b;
    }
    function addAttr(a) { if (a && a.array) geoBytes += a.array.byteLength; }
    scene.traverse(function (o) {
      if (o.geometry && !geo.has(o.geometry)) {
        geo.add(o.geometry);
        var g = o.geometry; for (var k in g.attributes) addAttr(g.attributes[k]); addAttr(g.index);
      }
      if (o.isInstancedMesh) { addAttr(o.instanceMatrix); addAttr(o.instanceColor); }
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) {
        ['map', 'normalMap', 'emissiveMap', 'alphaMap', 'roughnessMap'].forEach(function (k) { addTex(m[k]); });
        if (m.uniforms) for (var u in m.uniforms) addTex(m.uniforms[u].value);
      });
    });
    var cv = renderer.domElement, px = cv.width * cv.height;
    // colour + depth/stencil back buffer (x4 samples if MSAA) + resolved/front buffer + compositor copy
    var fb = px * (4 + 4) * (MJ.tier.aa ? 4 : 1) + px * 4 * 2;
    bytes = texBytes + geoBytes + fb;
    MJ.stats.tex = tex.size; MJ.stats.geo = geo.size;
    MJ.stats.gpuMB = bytes / 1048576;
    MJ.stats.gpuParts = { texMB: texBytes / 1048576, geoMB: geoBytes / 1048576, fbMB: fb / 1048576 };
    return MJ.stats.gpuMB;
  };
})();
