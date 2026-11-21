// ?debug=1 overlay: tier, canvas, fps (avg / p95), draw calls, triangles, textures, GPU estimate, boot time, NaN check, errors.
import { estimateSceneGPU } from './textures.js';
import { triCount } from './geo.js';
import { LIMITS, frameBytesPerPixel } from './tier.js';

export function createDebug({ renderer, scene, camera, tier, getHeroRoot, getState, getBoot, errors, bootMode }) {
  const el = document.createElement('div');
  el.id = 'debug';
  el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:50;font:11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.62);padding:6px 8px;border-radius:6px;white-space:pre;pointer-events:none;max-width:60vw';
  document.body.appendChild(el);
  const frames = new Float32Array(180);
  let fi = 0, fn = 0, acc = 0, gpu = null, gpuAcc = 99, heroTris = { now: 0, max: 0, calls: 0 }, nanCount = 0, nanReported = false;
  const stats = { calls: 0, tris: 0, js: 0, gl: 0 };

  // hero triangles: walk hero.root but skip things the shell only lends to it (the bin in the claws)
  function heroCount() {
    const r = getHeroRoot();
    const out = { now: 0, max: 0, calls: 0 };
    const walk = (o, vis) => {
      if (o.userData && o.userData.shellOwned) return;
      vis = vis && o.visible;
      if (o.isMesh && o.geometry) {
        const t = triCount(o.geometry);
        if (o.isInstancedMesh) { out.now += vis ? t * o.count : 0; out.max += t * o.instanceMatrix.count; if (vis && o.count > 0) out.calls++; }
        else { out.max += t; if (vis) { out.now += t; out.calls++; } }
      }
      for (const c of o.children) walk(c, vis);
    };
    if (r) walk(r, true);
    out.now = Math.round(out.now); out.max = Math.round(out.max);
    return out;
  }

  // NaN guard: any non-finite world matrix / instance matrix / camera matrix turns the screen black on some GPUs
  const finiteArr = (a, n) => { for (let i = 0; i < n; i++) { const x = a[i]; if (x !== x || x === Infinity || x === -Infinity) return false; } return true; };
  function nanScan() {
    let bad = 0;
    scene.traverse((o) => {
      if (!finiteArr(o.matrixWorld.elements, 16)) bad++;
      if (o.isInstancedMesh && !finiteArr(o.instanceMatrix.array, o.count * 16)) bad++;
    });
    if (camera && !finiteArr(camera.projectionMatrix.elements, 16)) bad++;
    return bad;
  }

  return {
    frame(ms, jsMs = 0, glMs = 0) {
      stats.js += (jsMs - stats.js) * 0.05; stats.gl += (glMs - stats.gl) * 0.05;
      frames[fi] = ms; fi = (fi + 1) % frames.length; fn = Math.min(fn + 1, frames.length);
      stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    },
    update(dt) {
      acc += dt; gpuAcc += dt;
      if (acc < 0.25) return;
      acc = 0;
      if (gpuAcc > 1) {
        gpuAcc = 0; gpu = estimateSceneGPU(scene); heroTris = heroCount();
        nanCount = nanScan();
        if (nanCount && !nanReported) { nanReported = true; errors.push(`NaN in ${nanCount} matrices`); }
      }
      const arr = Array.from(frames.subarray(0, fn)).sort((a, b) => a - b);
      const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
      const p95 = arr[Math.floor(arr.length * 0.95)] || 0;
      const c = renderer.domElement;
      const px = c.width * c.height;
      const fb = px * frameBytesPerPixel({ msaa: false });
      const msaa = px * frameBytesPerPixel(tier) - fb;
      const total = (gpu ? gpu.texBytes + gpu.geoBytes : 0) + fb + msaa;
      const MB = (b) => (b / 1048576).toFixed(1);
      const boot = getBoot ? getBoot() : null;
      const shellTris = Math.max(0, stats.tris - heroTris.now);
      el.textContent =
        `tier ${tier.name}  boot ${bootMode}  dpr ${renderer.getPixelRatio().toFixed(2)}  msaa ${tier.msaa ? tier.msaaSamples + 'x' : 'off'}\n` +
        `canvas ${c.width}x${c.height}\n` +
        `fps ${(1000 / Math.max(1, avg)).toFixed(0)} avg  p95 ${p95.toFixed(1)}ms (${(1000 / Math.max(1, p95)).toFixed(0)}fps)  cpu: update ${stats.js.toFixed(2)}ms render ${stats.gl.toFixed(2)}ms\n` +
        `draw ${stats.calls}  tris ${stats.tris}/${LIMITS.maxTriangles / 1000}k  (hero ${heroTris.now} now / ${heroTris.max} max, ${heroTris.calls} calls; shell ${shellTris})\n` +
        `tex ${renderer.info.memory.textures} (scene ${gpu ? gpu.texCount : '-'})  geo ${renderer.info.memory.geometries}\n` +
        `gpu≈ ${MB(total)}/${MB(LIMITS.gpuBytes)}MB  (tex ${gpu ? MB(gpu.texBytes) : '-'} geo ${gpu ? MB(gpu.geoBytes) : '-'} fb ${MB(fb)} msaa ${MB(msaa)})\n` +
        (boot ? `first touch ${boot.firstFrame.toFixed(0)}ms  (tex ${boot.textures.toFixed(0)} hero ${boot.hero.toFixed(0)} town ${boot.town.toFixed(0)})  ctx lost ${boot.lost}/${boot.restored}\n` : '') +
        `state ${getState()}  nan ${nanCount}\n` +
        (errors.length ? 'errors:\n' + errors.slice(-3).map((e) => ' ' + String(e).slice(0, 120)).join('\n') : 'errors: 0');
    },
  };
}
