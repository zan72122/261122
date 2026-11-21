// 起動：レンダラー・場面・hero・流れ・ループ・コンテキスト喪失・debug。
import { THREE } from './three.js';
import { L } from './layout.js';
import { detectTier } from './tier.js';
import { TextureBank } from './textures.js';
import { buildScene } from './scene.js';
import { Customers } from './customer.js';
import { Pointer } from './input.js';
import { Sfx } from './audio.js';
import { Fx } from './fx.js';
import { Flow } from './flow.js';
import { Debug } from './debug.js';

const params = new URLSearchParams(location.search);
const debug = new Debug(params.get('debug') === '1');
window.addEventListener('error', (e) => debug.error(e.message || e.error));
window.addEventListener('unhandledrejection', (e) => debug.error('promise: ' + (e.reason && e.reason.message || e.reason)));
const cerr = console.error.bind(console);
console.error = (...a) => { debug.error(a.map(String).join(' ')); cerr(...a); };

function start() {
  const tier = detectTier(params);
  const t0 = performance.now();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: tier.antialias, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: false });
  } catch (e) {
    debug.error('WebGL: ' + e.message);
    document.body.style.background = '#f3e2c4';
    return;
  }
  const canvas = renderer.domElement;
  canvas.id = 'game';
  document.body.appendChild(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 20);
  const bank = new TextureBank(renderer);
  const world = buildScene(bank, tier);
  const scene = world.scene;
  const sfx = new Sfx();
  const fx = new Fx(scene, bank, tier.fx, world.tex.soft);
  const customers = new Customers(scene, sfx);

  // ---- hero（app/hero/hero.build.js → window.UdonHero.createHero） ----
  const doughTex = bank.photo('udon_dough_1024', '#efe3c4');
  let flow = null;
  const create = window.UdonHero && window.UdonHero.createHero;
  if (!create) throw new Error('hero が読めない（app/hero/hero.build.js）');
  const hero = create(THREE, {
    tier: tier.hero,
    textures: { dough: doughTex },
    layout: {
      board: { center: L.board.center.clone(), sizeX: L.board.sizeX, sizeZ: L.board.sizeZ },
      doughStart: { center: L.doughStart.center.clone(), sizeX: L.doughStart.sizeX, sizeZ: L.doughStart.sizeZ, thickness: L.doughStart.thickness },
      pot: { center: new THREE.Vector3(L.pot.base.x, L.pot.water, L.pot.base.z), radius: L.pot.inner, depth: L.pot.water - L.pot.stove - 0.012,
             rimAbove: L.pot.stove + L.pot.height - L.pot.water },   // 湯面から鍋のふちまで
      net: { radius: L.net.radius, rimY: L.net.rimY },                 // 網のかご
      bowl: world.objs.bowlAnchor,
    },
    maxNoodles: 12,
    onEvent: (type, data) => { if (flow) flow.onHeroEvent(type, data || {}); },
  });
  scene.add(hero.root);

  const pointer = new Pointer(canvas);
  flow = new Flow({ world, hero, customers, fx, sfx, camera, pointer });
  customers.next();
  flow._resetPending = true;
  hero.reset({ seed: 0 });

  // ---- 大きさ（DPR とキャンパス画素の上限） ----
  let scale = 1, cw = 0, ch = 0;
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const pr = Math.min(tier.dpr * scale, Math.sqrt(tier.maxPixels / (w * h)));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, true);
    cw = Math.round(w * pr); ch = Math.round(h * pr);
    camera.aspect = w / h;
    flow.resize(w / h);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ---- ループ ----
  let last = performance.now(), lost = false, paused = false, firstFrame = true;
  const perf = { acc: 0, times: [], warm: 3 };
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (lost || paused) return;
    const c0 = performance.now();
    dt = Math.min(Math.max(dt, 0), 0.05);
    try {
      flow.update(dt);
      customers.update(dt);
      fx.update(dt);
      sfx.update();
      renderer.render(scene, camera);
    } catch (e) {
      debug.error(e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e);
      console.warn(e);
    }
    debug.frame(dt);
    if (debug.enabled) debug.cpuFrame(performance.now() - c0);
    if (firstFrame) {
      firstFrame = false;
      const b = document.getElementById('boot'); if (b) b.remove();
      window.__udonReadyMs = performance.now() - t0;          // start() から最初の描画まで
      window.__udonBootMs = performance.now();                // ページの読み込み開始（three の読み込み・解釈を含む）から最初の描画まで
    }
    autoScale(dt);
    report(dt);
  }
  // 重いときは描画倍率を下げる（p95 > 34ms が続いたら）
  function autoScale(dt) {
    perf.warm -= dt; if (perf.warm > 0) return;
    perf.times.push(dt); perf.acc += dt;
    if (perf.acc < 2) return;
    const a = perf.times.sort((x, y) => x - y), p95 = a[Math.floor(a.length * 0.95)];
    perf.times = []; perf.acc = 0;
    if (p95 > 0.034 && scale > tier.minScale) { scale = Math.max(tier.minScale, scale * 0.88); resize(); }
    else if (p95 < 0.019 && scale < 1) { scale = Math.min(1, scale * 1.05); resize(); }
  }
  let geoT = 0;
  const peak = { tris: 0, calls: 0, heroTris: 0, gpu: 0 };
  function report(dt) {
    if (!debug.enabled) return;   // 計測は ?debug=1 の時だけ（ふだんは毎フレームの集計・走査をしない）
    geoT -= dt;
    if (geoT <= 0) { debug.measureGeometry(scene); geoT = 2; }
    const hs = hero.getStats();
    const fb = cw * ch * 16;   // 色4B＋深度4B＋表示用の前後2面ぶん（MSAA なし）
    let heroTex = 0; for (const t of hs.textures || []) heroTex += t.width * t.height * 4 * 4 / 3;
    const tex = bank.bytes() + heroTex;
    const st = hero.getState();
    const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
    peak.tris = Math.max(peak.tris, tris); peak.calls = Math.max(peak.calls, calls); peak.heroTris = Math.max(peak.heroTris, hs.triangles);
    peak.gpu = Math.max(peak.gpu, fb + tex + debug.geoBytes);
    debug.report({
      boot: window.__udonBootMs || 0, tier: tier.name, dpr: renderer.getPixelRatio(), scale, w: cw, h: ch,
      calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
      heroTris: hs.triangles, heroCalls: hs.drawCalls,
      texCount: bank.items.length + (hs.textures || []).length, glTextures: renderer.info.memory.textures, glGeometries: renderer.info.memory.geometries,
      gpu: fb + tex + debug.geoBytes, fb, tex, geo: debug.geoBytes,
      place: st.place, cuts: st.cutCount, serves: flow.stats.serves, lost,
    });
    debug.update(dt);
  }
  renderer.setAnimationLoop(frame);

  // ---- コンテキスト喪失：止めて、戻ったら GPU 資源を作り直す（ゲームの状態は JS 側にあるので保たれる） ----
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; pointer.cancel(); }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    bank.restore();
    scene.traverse((o) => {
      if (o.geometry) for (const k in o.geometry.attributes) o.geometry.attributes[k].needsUpdate = true;
      if (o.isInstancedMesh) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
    });
    if (hero.onContextRestored) hero.onContextRestored();
    lost = false; last = performance.now();
  }, false);
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (paused) { sfx.suspend(); pointer.cancel(); } else { last = performance.now(); }
  });

  // ---- 煙テスト・debug 用の窓口 ----
  const v = new THREE.Vector3();
  const named = {
    dough: () => hero.getState().center,
    knife: () => world.objs.knife.localToWorld(v.set(0, 0.02, 0.07)),
    knifeBlade: () => world.objs.knife.localToWorld(v.set(0, 0.03, -0.02)),
    pin: () => world.objs.pin.getWorldPosition(v),
    net: () => world.objs.net.getWorldPosition(v),
    bowl: () => world.objs.bowl.localToWorld(v.set(0, 0.05, 0)),
    pot: () => v.set(L.pot.base.x, L.pot.water, L.pot.base.z),
    potSide: () => v.set(L.pot.base.x + 0.07, L.pot.water, L.pot.base.z + 0.02),
    customer: () => v.set(L.customer.x, L.customer.y + 0.3, L.customer.z),
    board: () => v.copy(L.board.center),
    serve: () => v.set(0, 0.1, -0.45),
  };
  L.dishes.forEach((p, i) => { named['dish' + i] = () => v.copy(p).setY(0.02); });
  window.__udon = {
    state: () => {
      const st = hero.getState(), f = debug.fps();
      return { mode: flow.mode, place: st.place, cutCount: st.cutCount, noodleCount: st.noodleCount, busy: st.busy, touched: { ...st.touched },
        toppings: flow.bowl.toppings.length, fill: flow.bowl.fill, serves: flow.stats.serves, round: flow.round, hint: flow.hint,
        customer: customers.current && customers.current.sp.id, gifts: customers.gifts.length,
        errors: debug.errors.slice(), fps: f.avg, p95ms: f.p95ms, readyMs: window.__udonReadyMs, bootMs: window.__udonBootMs, cpu: debug.cpuMs(), nan: debug.nan,
        calls: debug.state && debug.state.calls, tris: debug.state && debug.state.tris, heroTris: debug.state && debug.state.heroTris,
        gpuMiB: debug.state && debug.state.gpu / 1048576, texMiB: debug.state && debug.state.tex / 1048576, geoMiB: debug.state && debug.state.geo / 1048576, fbMiB: debug.state && debug.state.fb / 1048576,
        tier: tier.name, canvas: [cw, ch], lost, peak: { ...peak, gpuMiB: peak.gpu / 1048576 } };
    },
    screen: (name, x, y, z) => {
      const p = name === 'xyz' ? v.set(x, y, z) : named[name]();
      const q = p.clone().project(camera);
      return { x: (q.x + 1) / 2 * window.innerWidth, y: (1 - q.y) / 2 * window.innerHeight };
    },
    loseContext: () => { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); window.__udonLoseExt = ext; return !!ext; },
    restoreContext: () => { const ext = window.__udonLoseExt; if (ext) ext.restoreContext(); return !!ext; },
    textures: () => bank.list(),
    _flow: flow, _hero: hero,
    // 三角形の内訳（PLAN の実測用）
    breakdown: () => {
      const out = {}, wp = new THREE.Vector3();
      const add = (k, n) => { out[k] = (out[k] || 0) + n; };
      scene.traverse((o) => {
        if (!o.isMesh || !o.visible || (o.material && o.material.visible === false)) return;
        let p = o, inHero = false; while (p) { if (p === hero.root) inHero = true; p = p.parent; }
        const g = o.geometry, n = (g.index ? Math.min(g.index.count, g.drawRange.count) : Math.min(g.attributes.position.count, g.drawRange.count)) / 3;
        const cnt = o.isInstancedMesh ? n * o.count : n;
        o.getWorldPosition(wp);
        const k = inHero ? 'hero' : o.isInstancedMesh ? 'fx' : wp.z < -0.6 && wp.y > 0.05 && wp.z > -1.0 ? 'customer' : (wp.z < -1.0 || o === world.objs.board ? 'far' : 'near');
        add(k, cnt);
      });
      for (const k in out) out[k] = Math.round(out[k]);
      return out;
    },
  };
}

try { start(); } catch (e) { debug.error(e.message); console.warn(e); }
