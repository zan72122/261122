/* main: boot, textures, render loop, resize, WebGL context loss / restore, quality guard */
(function () {
  'use strict';
  var MJ = window.MJ;
  var NAMES = ['fruit_skin', 'fruit_smoothie', 'kitchen_window', 'wall_tiles', 'wood_counter'];
  var HERO = { fruit_skin: true, fruit_smoothie: true };

  function loadScript(src) {
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { MJ.pushErr('missing ' + src); res(); };
      document.head.appendChild(s);
    });
  }
  // Textures: JPEG files over http(s); embedded base64 copies on file:// (WebGL refuses file:// images).
  function makeTextures(renderer) {
    var useData = location.protocol === 'file:';
    var pre = useData ? loadScript('assets/textures.js') : Promise.resolve();
    var T = {}, waits = [];
    NAMES.forEach(function (n) { var t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; T[n] = t; });
    var ready = pre.then(function () {
      var loader = new THREE.ImageLoader();
      NAMES.forEach(function (n) {
        var url = useData && window.MJ_TEX && window.MJ_TEX[n] ? window.MJ_TEX[n] : 'assets/' + n + '.jpg';
        waits.push(new Promise(function (res) {
          loader.load(url, function (img) {
            var t = T[n]; t.image = img; t.anisotropy = HERO[n] ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1; t.needsUpdate = true; res();
          }, undefined, function () { MJ.pushErr('texture ' + n); res(); });
        }));
      });
      return Promise.race([Promise.all(waits), new Promise(function (r) { setTimeout(r, 4000); })]);
    });
    return { T: T, ready: ready };
  }

  function countTris(root) {
    var n = 0;
    root.traverseVisible(function (o) {
      if (!o.isMesh || !o.geometry) return;
      var g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      if (o.isInstancedMesh) t *= o.count; else if (g.isInstancedBufferGeometry) t *= g.instanceCount;
      n += t;
    });
    return Math.round(n);
  }

  function boot() {
    var canvas = document.getElementById('c');
    var tier = MJ.tier;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: tier.aa, alpha: false, stencil: false, powerPreference: 'high-performance' });
    } catch (e) {
      MJ.pushErr('WebGL unavailable'); document.getElementById('loader').classList.add('nogl'); return;
    }
    MJ.renderer = renderer;
    renderer.setPixelRatio(tier.dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var tx = makeTextures(renderer);
    var tb = performance.now();
    var W = MJ.buildScene(renderer, tx.T);
    MJ.Game.init();
    MJ.stats.buildMs = performance.now() - tb; MJ.stats.bootStartMs = tb;

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      // desktop: keep the drawing buffer within a pixel budget so MSAA stays inside the GPU-memory limit
      if (MJ.tier.name === 'desktop') renderer.setPixelRatio(Math.min(MJ.tier.dpr, Math.sqrt(2.2e6 / Math.max(w * h, 1))));
      renderer.setSize(w, h, false);
      MJ.canvasRect = canvas.getBoundingClientRect();
      MJ.fitCamera(w, h);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    resize();

    // ----- context loss: keep game state, rebuild GPU resources on restore -----
    MJ.ctxLostCount = 0; MJ.ctxRestoredCount = 0;
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); MJ.ctxLost = true; MJ.ctxLostCount++; MJ.Audio.motor(false);
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      // three re-initialises its GL state; mark our resources dirty so everything is re-uploaded
      W.scene.traverse(function (o) {
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          m.needsUpdate = true;
          ['map'].forEach(function (k) { if (m[k] && m[k].image) m[k].needsUpdate = true; });
          if (m.uniforms) for (var u in m.uniforms) { var v = m.uniforms[u].value; if (v && v.isTexture && v.image) v.needsUpdate = true; }
        });
        if (o.geometry) for (var a in o.geometry.attributes) o.geometry.attributes[a].needsUpdate = true;
        if (o.isInstancedMesh) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
      });
      if (MJ.S && MJ.S.jug.motorOn) MJ.Audio.motor(true);
      MJ.ctxLost = false; MJ.ctxRestoredCount++; last = performance.now();
    }, false);
    document.addEventListener('visibilitychange', function () { if (document.hidden) MJ.Audio.suspend(); else MJ.Audio.resume(); });

    var last = performance.now(), statT = 0, gpuT = 0, firstDone = false, lowT = 0, scaled = false;
    function frame(now) {
      requestAnimationFrame(frame);
      if (MJ.ctxLost || renderer.getContext().isContextLost()) return;
      var raw = now - last; last = now;
      var dt = Math.min(Math.max(raw, 0) / 1000, 0.05);
      try {
        var c0 = performance.now();
        MJ.Game.update(dt);
        renderer.render(W.scene, W.camera);
        var cpu = performance.now() - c0; MJ.stats.cpuMs = MJ.stats.cpuMs ? MJ.stats.cpuMs * 0.95 + cpu * 0.05 : cpu;
      } catch (err) { MJ.pushErr(err && err.message || err); }
      if (!firstDone) {
        firstDone = true; MJ.stats.firstInteractiveMs = performance.now();
        var ld = document.getElementById('loader'); if (ld) { ld.classList.add('gone'); setTimeout(function () { ld.remove(); }, 600); }
        return;
      }
      MJ.recordFrame(raw);
      MJ.stats.calls = renderer.info.render.calls; MJ.stats.tris = renderer.info.render.triangles;
      statT += raw; gpuT += raw;
      if (gpuT > 2000) {
        gpuT = 0; MJ.estimateGPU(renderer, W.scene);
        var heroRoots = [W.blender, W.jug]; var h = 0; heroRoots.forEach(function (r) { h += countTris(r); });
        MJ.S.tray.forEach(function (sl) { if (sl.fruit) h += countTris(sl.fruit.mesh); });
        if (W.stream.mesh.visible) h += countTris(W.stream.mesh);
        MJ.stats.heroTris = h;
        // quality guard on mobile: drop render scale once if the frame rate is poor
        if (MJ.tier.name === 'mobile' && !scaled) {
          MJ.frameSummary();
          if (MJ.stats.avgFps < 45) lowT++; else lowT = 0;
          if (lowT >= 3) { scaled = true; renderer.setPixelRatio(0.8); resize(); MJ.renderScaleNote = ' (auto 0.8)'; }
        }
      }
      if (statT > 500) { statT = 0; MJ.updateDebug(renderer); }
    }
    tx.ready.then(function () { last = performance.now(); requestAnimationFrame(frame); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
