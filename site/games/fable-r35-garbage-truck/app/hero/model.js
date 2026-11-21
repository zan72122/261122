// The truck's parts, built from the parameter block P (metres, radians). Every rigid group gets at most
// one mesh per material (merged), repeated parts are instanced. Frame: +x forward (cab), +z camera side
// (arm + cut-away window), y = 0 ground.
import { makeGeo, UV, ATLAS_SIZE, rng } from './geo.js';

export function makeParams(opts) {
  const low = opts.tier === 'low';
  const capacity = Math.max(1, Math.round(opts.capacity || 3));
  const bin = opts.binSize || { w: 0.9, d: 0.9, h: 1.15 };
  const D = Math.PI / 180;
  const P = {
    low, capacity, bin,
    // overall
    rearX: -3.6, frontX: 3.39, halfW: 1.2, height: 3.05,
    // wheels (front axle + two rear axles)
    wheelR: 0.46, wheelW: 0.36, wheelXs: [2.57, -1.45, -2.6], wheelZ: 0.97, wheelSeg: low ? 14 : 20,
    // chassis rails
    railY0: 0.5, railY1: 0.82, railZ: 0.48,
    // tilting body (packer box): inner space x ∈ [rearIn, frontIn], z ∈ ±inZ, y ∈ [floorY, top]
    floorY: 1.0, bodyTop: 2.95, rearIn: -3.45, frontIn: 1.0, wall: 0.08, inZ: 1.12,
    hopperX0: -0.42, // the roof is open from here to the front wall
    win: { x0: -3.28, x1: 0.8, y0: 1.17, y1: 2.77, r: 0.16, frame: 0.12 },
    hinge: { x: -3.3, y: 1.0 }, hoistMax: 50 * D,
    gateT: 0.13, gateMax: 150 * D,
    // packer plate (front face at plate.position.x, pushes toward -x)
    plateHome: 0.72, plateDepth: 0.26, plateTop: 2.84,
    // compressed layers
    layerH: 1.5, layerMaxH: 1.88,
    // arm: tower in the gap between body and cab, links move in the y-z plane at x = armX
    gapX0: 1.08, gapX1: 1.86, armX: 1.33, cylDX: 0.3,
    P0: { z: 1.0, y: 2.05 }, L1: 1.05, L2: 1.0, stickTail: 0.28,
    // cab
    cabX0: 1.86, cabX1: 3.31, cabTop: 2.85, cabHalfW: 1.15,
    // where the bin stands, and where the wrist sits relative to the bin's origin when gripping
    binX: 0.3, binZ: 2.35, seat: { y: 0.72, z: 0.72 },
    stow: { z: 1.33, y: 0.72 },
    // trash
    pieceMax: low ? 16 : 36, chunkBig: low ? 5 : 8, chunkSmall: low ? 5 : 10,
    dumpDX: 1.9, pileR: 1.3, pileH: 1.15, pileBaseY: 0.07,
  };
  P.tau = (P.plateHome - 1.25 - P.rearIn) / capacity; // final thickness of one compressed layer (x)
  P.chunkMax = capacity * (P.chunkBig + P.chunkSmall);
  P.gripX = P.binX - P.armX; // carriage centre in the gripper frame (x)
  return P;
}

/** the hero's own texture: flat white, a few decals and a light "crumple" map made from the trash photo */
export function makeAtlas(THREE, trashTex) {
  const c = document.createElement('canvas');
  c.width = c.height = ATLAS_SIZE;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  const cell = (cx, cy, w, h, fn) => { g.save(); g.beginPath(); g.rect(cx * 64, cy * 64, w * 64, h * 64); g.clip(); g.translate(cx * 64, cy * 64); fn(w * 64, h * 64); g.restore(); };
  // flower emblem (cab door)
  cell(1, 0, 2, 2, (w, h) => {
    g.translate(w / 2, h / 2);
    g.fillStyle = '#ffffff'; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#ff8fc0';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * 27, Math.sin(a) * 27, 23, 16, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(-5, -5, 6, 0, Math.PI * 2); g.fill();
  });
  // window glass: sky blue with a soft glint
  cell(0, 1, 1, 1, (w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#bfe9ff'); gr.addColorStop(0.5, '#7cc8f5'); gr.addColorStop(1, '#58b0e8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.moveTo(10, h); g.lineTo(26, h); g.lineTo(46, 0); g.lineTo(30, 0); g.fill();
    g.beginPath(); g.moveTo(32, h); g.lineTo(38, h); g.lineTo(58, 0); g.lineTo(52, 0); g.fill();
  });
  // candy chevrons (tailgate, packer plate)
  cell(0, 2, 4, 1, (w, h) => {
    g.fillStyle = '#fff6d8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff9f43';
    for (let x = -h; x < w + h; x += 44) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 22, h); g.lineTo(x + 22 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
  // down arrow (above the hopper)
  cell(3, 0, 1, 1, (w, h) => {
    g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(22, 8); g.lineTo(42, 8); g.lineTo(42, 30); g.lineTo(56, 30); g.lineTo(32, 58); g.lineTo(8, 30); g.lineTo(22, 30); g.fill();
  });
  // crumple map: the trash photo, mostly desaturated and lifted, so a layer colour multiplies into a clear stripe
  let ok = false;
  const img = trashTex && trashTex.image;
  if (img && (img.width || 0) > 0) {
    try {
      g.save();
      g.beginPath(); g.rect(256, 0, 256, 256); g.clip();
      g.drawImage(img, 256, 0, 256, 256);
      g.globalCompositeOperation = 'saturation'; g.globalAlpha = 0.8; g.fillStyle = '#808080'; g.fillRect(256, 0, 256, 256);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.62; g.fillStyle = '#ffffff'; g.fillRect(256, 0, 256, 256);
      g.restore();
      g.getImageData(300, 40, 1, 1); // throws if the canvas got tainted
      ok = true;
    } catch (e) { ok = false; g.restore(); }
  }
  if (!ok) {
    // could not read the photo (or none given): draw crumpled scraps by hand
    const c2 = document.createElement('canvas'); c2.width = c2.height = 256;
    const h2 = c2.getContext('2d');
    const r = rng(5);
    h2.fillStyle = '#e9e9e9'; h2.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 150; i++) {
      const x = r() * 256, y = r() * 256, s = 14 + r() * 26, v = 190 + Math.floor(r() * 65);
      h2.fillStyle = `rgb(${v},${v},${v})`;
      h2.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + r(); h2.lineTo(x + Math.cos(a) * s * (0.6 + r() * 0.6), y + Math.sin(a) * s * (0.6 + r() * 0.6)); }
      h2.closePath(); h2.fill();
      h2.strokeStyle = 'rgba(120,120,120,0.35)'; h2.lineWidth = 1.5; h2.stroke();
    }
    // a fresh atlas canvas is needed if the first one was tainted
    const c3 = document.createElement('canvas'); c3.width = c3.height = ATLAS_SIZE;
    const g3 = c3.getContext('2d');
    try { g3.drawImage(c, 0, 0); } catch (e) { /* tainted: decals are lost, keep white */ g3.fillStyle = '#ffffff'; g3.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE); }
    g3.drawImage(c2, 256, 0);
    return finish(THREE, c3);
  }
  return finish(THREE, c);
}
function finish(THREE, canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * Build all meshes. Returns the scene graph handles the animation code drives.
 * mats: { paint, steel, color, inst, piece, layer, chunk, lamp, shadow }
 */
export function buildTruck(THREE, P, mats, track) {
  const G = makeGeo(THREE);
  const { paint, shade, uvRect, worldUV, place, merge, box, boxAt, rbox, rboxAt, cyl, pinX, sphere, roundRect, roundPoly, extrude, lump } = G;
  const low = P.low;
  const geo = (g) => { track.push(g); return g; };
  const meshOf = (list, mat, parent) => { const m = new THREE.Mesh(geo(merge(list)), mat); parent.add(m); return m; };
  const group = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const C = {
    dark: 0x3b4048, tire: 0x2a2c31, hub: 0xf2efe6, cream: 0xfff6e6, green: 0x35b53c, greenDark: 0x23872b,
    yellow: 0xffcf33, orange: 0xffa01f, steel: 0xb9c2ca, steelDark: 0x8d979f, chrome: 0xe9eef2, pink: 0xff7ab6, glassRim: 0x39424c,
  };

  const root = new THREE.Group();
  root.name = 'hero-truck';

  // ---------- soft shadow (shell's blob texture) ----------
  const shadowGeo = geo(new THREE.PlaneGeometry(P.frontX - P.rearX + 1.3, P.halfW * 2 + 1.5));
  const shadow = new THREE.Mesh(shadowGeo, mats.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set((P.frontX + P.rearX) / 2, 0.016, 0.05);
  shadow.renderOrder = 1;
  root.add(shadow);

  // ---------- wheels: tyre (lathe) + hub + nuts, one InstancedMesh ----------
  const R = P.wheelR, hw = P.wheelW / 2;
  const prof = [[R - 0.17, -hw], [R - 0.05, -hw], [R - 0.008, -hw * 0.72], [R, -hw * 0.36], [R, hw * 0.36], [R - 0.008, hw * 0.72], [R - 0.05, hw], [R - 0.17, hw]]
    .map(([r, a]) => new THREE.Vector2(r, a));
  const wparts = [paint(new THREE.LatheGeometry(prof, P.wheelSeg), C.tire)];
  wparts.push(cyl(R - 0.16, R - 0.16, P.wheelW - 0.05, C.hub, P.wheelSeg));
  for (const s of [-1, 1]) {
    wparts.push(place(sphere(0.11, C.yellow, 8, 5), 0, s * (hw - 0.05), 0, 0, 0, 0, 1, 0.5, 1));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      wparts.push(place(cyl(0.035, 0.035, 0.04, C.dark, 6), Math.cos(a) * 0.19, s * (hw - 0.02), Math.sin(a) * 0.19));
    }
  }
  const wheelGeo = geo(place(merge(wparts), 0, 0, 0, Math.PI / 2, 0, 0)); // axle along z
  const wheels = new THREE.InstancedMesh(wheelGeo, mats.color, P.wheelXs.length * 2);
  wheels.frustumCulled = false;
  root.add(wheels);

  // ---------- sprung mass: everything that rides on the suspension ----------
  const sprung = group(root);

  // chassis, cab and arm tower (static in the sprung frame)
  const st = [];
  st.push(boxAt(P.rearX + 0.28, P.cabX1 - 0.1, P.railY0, P.railY1, -P.railZ, P.railZ, C.dark));
  for (const x of P.wheelXs) st.push(place(cyl(0.09, 0.09, P.wheelZ * 2 - 0.2, C.dark, 8), x, P.wheelR, 0, Math.PI / 2, 0, 0)); // axles
  st.push(boxAt(P.rearX + 0.2, P.rearX + 0.34, 0.42, 0.72, -1.12, 1.12, C.dark)); // rear under-run bar
  for (const s of [-1, 1]) st.push(boxAt(P.wheelXs[2] - 0.62, P.wheelXs[2] - 0.56, 0.3, 0.9, s * 0.78, s * 1.14, C.dark)); // mud flaps
  // hinge blocks for the tilting body
  for (const s of [-1, 1]) st.push(place(pinX(0.12, 0.2, C.yellow, 10), P.hinge.x, P.hinge.y - 0.06, s * 0.62, 0, Math.PI / 2, 0));
  // cab: side profile extruded across the truck, wheel arch cut out
  {
    const x0 = P.cabX0, x1 = P.cabX1, top = P.cabTop, yb = 0.7;
    const ax = P.wheelXs[0], ay = P.wheelR + 0.04, ar = P.wheelR + 0.16;
    const dx = Math.sqrt(Math.max(1e-4, ar * ar - (yb - ay) * (yb - ay)));
    const pts = [[x0, yb, 0.06], [ax - dx, yb, 0.01]];
    const n = low ? 6 : 9;
    for (let i = 1; i < n; i++) { const a = Math.PI - Math.acos(Math.min(1, dx / ar)) - (i / n) * (Math.PI - 2 * Math.acos(Math.min(1, dx / ar))); pts.push([ax + Math.cos(a) * ar, ay + Math.sin(a) * ar, 0]); }
    pts.push([ax + dx, yb, 0.01], [x1, yb, 0.08], [x1, 1.82, 0.16], [x1 - 0.36, top, 0.22], [x0, top, 0.14]);
    const cab = place(paint(extrude(roundPoly(pts, 0.05), P.cabHalfW * 2, 0.05, 4), C.cream), 0, 0, -P.cabHalfW);
    st.push(cab);
    // fender ring + belt line (green)
    const ring = new THREE.Shape();
    ring.absarc(ax, ay, ar + 0.13, Math.PI * 0.94, Math.PI * 0.06, true);
    ring.absarc(ax, ay, ar, Math.PI * 0.06, Math.PI * 0.94, false);
    st.push(place(paint(extrude(ring, 0.07, 0, low ? 6 : 10), C.green), 0, 0, P.cabHalfW - 0.02));
    st.push(boxAt(x0 + 0.02, x1 - 0.02, 1.52, 1.64, P.cabHalfW - 0.02, P.cabHalfW + 0.012, C.green));
    // side window (camera side) + windscreen, both mapped to the glass cell
    const sw = roundPoly([[x0 + 0.2, 1.88], [x1 - 0.2, 1.88], [x1 - 0.44, top - 0.2], [x0 + 0.2, top - 0.2]], 0.1);
    const swg = extrude(sw, 0.02, 0, 4);
    {
      const p = swg.attributes.position, uv = swg.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0 - 0.2) / (x1 - x0 - 0.4), (p.getY(i) - 1.88) / (top - 2.08));
    }
    st.push(place(uvRect(paint(swg, 0xffffff, 'keep'), UV.glass), 0, 0, P.cabHalfW - 0.005));
    const slant = Math.atan2(0.36, top - 1.82), sl = Math.hypot(0.36, top - 1.82);
    const ws = uvRect(paint(new THREE.PlaneGeometry(P.cabHalfW * 2 - 0.36, sl - 0.26), 0xffffff, 'keep'), UV.glass);
    st.push(place(place(ws, 0, 0, 0, 0, Math.PI / 2, 0), x1 - 0.18 + 0.02, (1.82 + top) / 2 + 0.006, 0, 0, 0, slant));
    // door: seam, handle, flower emblem
    st.push(boxAt(x0 + 0.13, x0 + 0.15, 1.0, top - 0.16, P.cabHalfW, P.cabHalfW + 0.008, 0xd9cfbd));
    st.push(rboxAt(x0 + 0.26, x0 + 0.46, 1.69, 1.75, P.cabHalfW, P.cabHalfW + 0.03, 0.012, C.dark, 1));
    st.push(place(uvRect(paint(new THREE.PlaneGeometry(0.42, 0.42), 0xffffff, 'keep'), UV.flower), x0 + 0.42, 1.24, P.cabHalfW + 0.006));
    // bumper, grille, roof cap, mirror
    st.push(rboxAt(x1 - 0.06, P.frontX, 0.52, 0.9, -1.18, 1.18, 0.06, 0xe4e8ec, 2));
    st.push(rboxAt(x1 - 0.02, x1 + 0.03, 1.0, 1.5, -0.55, 0.55, 0.03, C.dark, 1));
    st.push(rboxAt(x0 + 0.3, x1 - 0.75, top - 0.02, top + 0.07, -0.75, 0.75, 0.04, C.green, 1));
    st.push(boxAt(x1 - 0.5, x1 - 0.46, 2.1, 2.16, P.cabHalfW, P.cabHalfW + 0.2, C.dark));
    st.push(rboxAt(x1 - 0.55, x1 - 0.41, 1.95, 2.3, P.cabHalfW + 0.17, P.cabHalfW + 0.24, 0.03, C.dark, 1));
    // step under the door
    st.push(rboxAt(x0 + 0.02, ax - dx - 0.05, 0.52, 0.62, 0.7, P.cabHalfW + 0.02, 0.03, C.dark, 1));
  }
  // arm tower: two cheek plates in the gap, the boom swings between them
  {
    const pl = roundPoly([[0.12, 0.84], [0.9, 0.84], [0.9, 0.46], [1.2, 0.46], [1.2, 1.4], [P.P0.z + 0.16, P.P0.y + 0.2, 0.14], [P.P0.z - 0.16, P.P0.y + 0.2, 0.14], [0.12, 1.12]], 0.05);
    for (const [xa, xb] of [[P.gapX0, P.gapX0 + 0.07], [P.gapX1 - 0.07, P.gapX1]]) {
      // shape is in (z, y): rotate so that shape-x → z
      st.push(place(paint(extrude(pl, xb - xa, 0, 3), C.dark), xb, 0, 0, 0, -Math.PI / 2, 0));
    }
    st.push(boxAt(P.gapX0, P.gapX1, 0.84, 1.06, 0.1, 0.2, C.dark));
    st.push(place(pinX(0.075, P.gapX1 - P.gapX0 + 0.06, C.chrome, 10), (P.gapX0 + P.gapX1) / 2, P.P0.y, P.P0.z));
    st.push(place(pinX(0.15, 0.03, C.yellow, 12), P.gapX1 + 0.012, P.P0.y, P.P0.z));
  }
  const staticMesh = meshOf(st, mats.color, sprung);

  // ---------- tilting body ----------
  const tilt = group(sprung, P.hinge.x, P.hinge.y, 0);
  const body = group(tilt, -P.hinge.x, -P.hinge.y, 0);
  const W = P.win, t = P.wall, xr = P.rearIn, xf = P.frontIn + t, top = P.bodyTop, fy = P.floorY, oz = P.inZ + t;
  // outside panels (paint photo): camera-side wall with the cut-away window, roof
  {
    const wallShape = new THREE.Shape();
    wallShape.moveTo(xr, fy - 0.07); wallShape.lineTo(xf, fy - 0.07); wallShape.lineTo(xf, top); wallShape.lineTo(xr, top); wallShape.closePath();
    wallShape.holes.push(roundRect(new THREE.Path(), W.x0, W.y0, W.x1, W.y1, W.r));
    const wall = place(extrude(wallShape, t, 0, 5), 0, 0, P.inZ);
    const roof = place(new THREE.BoxGeometry(P.hopperX0 - xr, t, oz * 2), (xr + P.hopperX0) / 2, top - t / 2, 0);
    const pg = [wall, roof].map((g) => paint(worldUV(g, 0.45), 0xffffff, 'keep'));
    meshOf(pg, mats.paint, body);
  }
  // inside (steel photo): floor, far wall, front wall
  {
    const floor = place(new THREE.BoxGeometry(xf - xr, 0.07, oz * 2), (xr + xf) / 2, fy - 0.035, 0);
    const far = place(new THREE.BoxGeometry(xf - xr, top - fy, t), (xr + xf) / 2, (fy + top) / 2, -P.inZ - t / 2);
    const front = place(new THREE.BoxGeometry(t, top - fy, P.inZ * 2), P.frontIn + t / 2, (fy + top) / 2, 0);
    const sg = [floor, far, front].map((g) => paint(worldUV(g, 0.62), 0xffffff, 'keep'));
    shade(sg[1], () => 0.78); shade(sg[2], () => 0.88);
    meshOf(sg, mats.steel, body);
  }
  // trims (colour): window frame, hopper rim, sub-frame, arrow sign
  {
    const b = [];
    const fs = new THREE.Shape();
    roundRect(fs, W.x0 - W.frame, W.y0 - W.frame, W.x1 + W.frame, W.y1 + W.frame, W.r + W.frame);
    fs.holes.push(roundRect(new THREE.Path(), W.x0, W.y0, W.x1, W.y1, W.r));
    b.push(place(paint(extrude(fs, 0.075, 0.016, 5), C.yellow), 0, 0, oz));
    const rim = 0.07;
    b.push(rboxAt(P.hopperX0 - 0.03, xf + 0.02, top, top + rim, P.inZ - 0.03, oz + 0.03, 0.025, C.yellow, 1));
    b.push(rboxAt(P.hopperX0 - 0.03, xf + 0.02, top, top + rim, -oz - 0.03, -P.inZ + 0.03, 0.025, C.yellow, 1));
    b.push(rboxAt(P.frontIn - 0.03, xf + 0.02, top, top + rim, -oz, oz, 0.025, C.yellow, 1));
    b.push(rboxAt(P.hopperX0 - 0.06, P.hopperX0 + 0.04, top - 0.02, top + rim, -oz, oz, 0.025, C.yellow, 1));
    b.push(boxAt(xr + 0.25, xf - 0.1, fy - 0.16, fy - 0.07, -0.72, 0.72, C.dark));
    // ceiling liner over the packed part (seen through the window from below eye level: keeps it bright)
    b.push(boxAt(xr, P.hopperX0, top - t - 0.012, top - t, -P.inZ, P.inZ, C.steelDark));
    // rear frame around the gate opening
    b.push(boxAt(xr - 0.005, xr + 0.07, top - 0.01, top + 0.05, -oz, oz, C.greenDark));
    meshOf(b, mats.color, body);
  }

  // tailgate: hinge at the top rear edge
  const gate = group(body, xr, top, 0);
  {
    const gh = top - fy + 0.1;
    const panel = paint(worldUV(place(G.roundedBox(P.gateT, gh, oz * 2 + 0.02, 0.04, 2), -P.gateT / 2, -gh / 2 + 0.02, 0), 0.45), 0xffffff, 'keep');
    meshOf([panel], mats.paint, gate);
    const d = [];
    d.push(boxAt(0, 0.012, -gh + 0.12, -0.06, -P.inZ + 0.01, P.inZ - 0.01, C.steel)); // inner liner
    const chev = uvRect(paint(new THREE.PlaneGeometry(oz * 2 - 0.5, 0.42), 0xffffff, 'keep'), UV.chevron);
    d.push(place(chev, -P.gateT - 0.004, -gh + 0.45, 0, 0, -Math.PI / 2, 0));
    d.push(rboxAt(-P.gateT - 0.05, -P.gateT + 0.02, -gh + 0.02, -gh + 0.14, -oz, oz, 0.03, C.dark, 1));
    for (const s of [-1, 1]) d.push(place(pinX(0.09, 0.16, C.yellow, 10), -0.02, 0.02, s * (oz - 0.25), 0, Math.PI / 2, 0));
    meshOf(d, mats.color, gate);
  }

  // packer plate: steel face, orange gussets (the near one is what the window shows), chevrons
  const plate = group(body, P.plateHome, 0, 0);
  {
    const d = [];
    const ph = P.plateTop - fy - 0.03, pz = P.inZ - 0.035;
    d.push(boxAt(0, 0.07, fy + 0.03, P.plateTop, -pz, pz, C.steel));
    const tri = roundPoly([[0.06, fy + 0.03], [P.plateDepth, fy + 0.03], [P.plateDepth, fy + 0.3], [0.1, P.plateTop], [0.06, P.plateTop]], 0.03);
    for (const s of [-1, 1]) d.push(place(paint(extrude(tri, 0.06, 0, 3), C.orange), 0, 0, s > 0 ? pz - 0.06 : -pz));
    d.push(boxAt(0.06, P.plateDepth, fy + 0.03, fy + 0.1, -pz, pz, C.orange));
    d.push(boxAt(0.06, 0.16, P.plateTop - 0.1, P.plateTop, -pz, pz, C.orange));
    // chevrons on the pushing face (seen from above through the hopper) and a stripe on the near gusset
    const chev = uvRect(paint(new THREE.PlaneGeometry(pz * 2 - 0.2, 0.36), 0xffffff, 'keep'), UV.chevron);
    d.push(place(chev, -0.004, fy + ph * 0.55, 0, 0, -Math.PI / 2, 0));
    meshOf(d, mats.color, plate);
  }

  // compressed layers: unit slab [0,1]×[0,1]×[-.5,.5], bumpy top and plate-side face, crumple UVs
  let layerGeo;
  {
    const nx = low ? 3 : 5, ny = low ? 4 : 7, nz = low ? 4 : 8;
    const g = new THREE.BoxGeometry(1, 1, 1, nx, ny, nz);
    g.translate(0.5, 0.5, 0);
    const p = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
    const cr = UV.crumple;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i);
      const z = p.getZ(i);
      // wavy plate-side face and bumpy top (kept welded: displacement depends on position only)
      if (x > 0.999) x += 0.035 * Math.sin(y * 9 + z * 5) + 0.03 * Math.sin(z * 13 + 1);
      if (x < 0.001) x += 0.035 * Math.sin(y * 9 + z * 5) + 0.03 * Math.sin(z * 13 + 1) - 0.01;
      if (y > 0.999) y += 0.045 * Math.sin(x * 7 + z * 9) + 0.035 * Math.sin(z * 17 + x * 3 + 2) - 0.03;
      p.setXYZ(i, x, y, z);
      // texture: side faces look along z, top looks along y
      const ny_ = Math.abs(nrm.getY(i)), nx_ = Math.abs(nrm.getX(i));
      let u, v;
      if (ny_ > 0.5) { u = p.getX(i); v = z + 0.5; } else if (nx_ > 0.5) { u = z + 0.5; v = y; } else { u = p.getX(i); v = y; }
      uv.setXY(i, cr[0] + Math.min(1, Math.max(0, u)) * (cr[2] - cr[0]), cr[1] + Math.min(1, Math.max(0, v)) * (cr[3] - cr[1]));
    }
    g.computeVertexNormals();
    layerGeo = geo(paint(g, 0xffffff, 'keep'));
  }
  const layers = new THREE.InstancedMesh(layerGeo, mats.layer, P.capacity);
  layers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P.capacity * 3).fill(1), 3);
  layers.count = 0; layers.frustumCulled = false;
  body.add(layers);

  // ---------- arm: boom → stick → gripper ----------
  const ax = P.armX;
  const boom = group(sprung, ax, P.P0.y, P.P0.z);
  {
    const d = [];
    d.push(place(rbox(0.3, 0.26, P.L1, 0.06, C.yellow, 1), 0, 0, P.L1 / 2));
    d.push(pinX(0.19, 0.32, C.yellow, 12));
    d.push(place(pinX(0.18, 0.34, C.yellow, 12), 0, 0, P.L1));
    d.push(place(pinX(0.08, 0.42, C.dark, 8), 0, 0, P.L1));
    d.push(place(pinX(0.055, 0.42, C.dark, 8), P.cylDX / 2 + 0.04, 0, 0.5)); // boom cylinder pin
    d.push(place(box(0.16, 0.26, 0.16, C.yellow), 0.07, -0.15, 0.15)); // lug for the stick cylinder
    d.push(place(pinX(0.055, 0.42, C.dark, 8), P.cylDX / 2 + 0.04, -0.2, 0.15));
    meshOf(d, mats.color, boom);
  }
  const stick = group(boom, 0, 0, P.L1);
  {
    const d = [];
    d.push(place(rbox(0.22, 0.22, P.L2 + P.stickTail, 0.05, C.orange, 1), 0, 0, (P.L2 - P.stickTail) / 2));
    d.push(place(pinX(0.15, 0.26, C.orange, 12), 0, 0, P.L2));
    d.push(place(pinX(0.055, 0.46, C.dark, 8), P.cylDX / 2 + 0.02, 0, -P.stickTail));
    d.push(place(box(0.14, 0.2, 0.14, C.orange), 0.05, -0.13, 0.3));
    d.push(place(pinX(0.05, 0.42, C.dark, 8), P.cylDX / 2 + 0.03, -0.16, 0.3));
    meshOf(d, mats.color, stick);
  }
  const gripper = group(stick, 0, 0, P.L2);
  const gx = P.gripX;
  const horn = { y: -0.082, z: -0.2255 }; // cylinder lug on the wrist bracket
  {
    const d = [];
    // wrist bracket + lug, torque tube out to the carriage
    d.push(pinX(0.11, 0.38, C.dark, 10));
    const hl = roundPoly([[0.06, 0.1], [horn.z - 0.07, horn.y + 0.07], [horn.z - 0.07, horn.y - 0.07], [0.06, -0.12]], 0.04);
    d.push(place(paint(extrude(hl, 0.14, 0, 3), C.dark), 0.07, 0, 0, 0, -Math.PI / 2, 0));
    d.push(place(pinX(0.05, 0.4, C.dark, 8), P.cylDX / 2 + 0.03, horn.y, horn.z));
    d.push(place(rbox(Math.abs(gx) + 0.5, 0.15, 0.15, 0.04, C.dark, 1), (gx - 0.5) / 2 + 0.03, 0, 0.02));
    // carriage: back plate with rubber bumpers and two ribs
    d.push(rboxAt(gx - 0.58, gx + 0.58, -0.3, 0.3, 0.09, 0.17, 0.035, C.yellow, 1));
    for (const s of [-1, 1]) d.push(rboxAt(gx + s * 0.3 - 0.05, gx + s * 0.3 + 0.05, -0.34, 0.34, 0.07, 0.11, 0.02, C.orange, 1));
    for (const s of [-1, 1]) d.push(rboxAt(gx - 0.5, gx + 0.5, s * 0.22 - 0.035, s * 0.22 + 0.035, 0.165, 0.2, 0.015, C.dark, 1));
    // claw pivots
    for (const s of [-1, 1]) d.push(place(cyl(0.075, 0.075, 0.5, C.dark, 10), gx + s * 0.56, 0, 0.15));
    meshOf(d, mats.color, gripper);
  }
  // claws: one finger shape, the other side is the same shape turned 180° about its long axis
  const clawLen = 0.78;
  let clawGeo;
  {
    // outline in (x, z): pivot at the origin, finger runs along +z and hooks toward -x at the tip
    const pts = [[0.07, -0.06], [0.08, 0.3], [0.05, 0.56], [-0.02, clawLen], [-0.11, clawLen - 0.02], [-0.07, 0.55], [-0.035, 0.3], [-0.06, -0.06]];
    const s = roundPoly(pts.map(([x, z]) => [z, x]), 0.04); // shape plane (z, x)
    const g = extrude(s, 0.15, 0.02, 3); // depth along shape-normal
    // shape (u=z, v=x, depth=w) → world (x=v, y=w, z=u)
    const m = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, -0.075, 1, 0, 0, 0, 0, 0, 0, 1);
    g.applyMatrix4(m);
    paint(g, C.orange);
    // pink rubber pad on the inner face
    const pad = place(rbox(0.035, 0.11, 0.3, 0.015, C.pink, 1), -0.06, 0, 0.36);
    clawGeo = geo(merge([g, pad]));
  }
  const claws = new THREE.InstancedMesh(clawGeo, mats.color, 2);
  claws.frustumCulled = false;
  gripper.add(claws);

  // ---------- hydraulic cylinders: all tubes in one InstancedMesh, all eyes in another ----------
  const tubeGeo = geo(new THREE.CylinderGeometry(1, 1, 1, low ? 8 : 10));
  tubeGeo.translate(0, 0.5, 0);
  const eyeGeo = geo(new THREE.SphereGeometry(1, 8, 6));
  const cx = P.cylDX;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cyls = [
    { name: 'boom', a: [sprung, V(ax + cx, 0.62, 0.55)], b: [boom, V(cx, 0, 0.5)], r: 0.105, barrel: 0.95, stages: 2 },
    { name: 'stick', a: [boom, V(cx, -0.2, 0.15)], b: [stick, V(cx, 0, -P.stickTail)], r: 0.095, barrel: 0.8, stages: 2 },
    { name: 'wrist', a: [stick, V(cx, -0.16, 0.3)], b: [gripper, V(cx, horn.y, horn.z)], r: 0.085, barrel: 0.42, stages: 2 },
    { name: 'pack1', a: [body, V(P.frontIn - 0.02, 1.5, -0.86)], b: [plate, V(0.2, 1.5, 0.86)], r: 0.085, barrel: 1.6, stages: 3 },
    { name: 'pack2', a: [body, V(P.frontIn - 0.02, 2.05, 0.86)], b: [plate, V(0.2, 2.05, -0.86)], r: 0.085, barrel: 1.6, stages: 3 },
    { name: 'hoist1', a: [sprung, V(-0.75, 0.7, 0.62)], b: [body, V(0.45, 0.88, 0.62)], r: 0.095, barrel: 1.12, stages: 3 },
    { name: 'hoist2', a: [sprung, V(-0.75, 0.7, -0.62)], b: [body, V(0.45, 0.88, -0.62)], r: 0.095, barrel: 1.12, stages: 3 },
  ];
  let nTubes = 0;
  for (const c of cyls) { c.tube0 = nTubes; nTubes += c.stages; }
  const tubes = new THREE.InstancedMesh(tubeGeo, mats.inst, nTubes);
  tubes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nTubes * 3).fill(1), 3);
  tubes.frustumCulled = false;
  root.add(tubes);
  const eyes = new THREE.InstancedMesh(eyeGeo, mats.inst, cyls.length * 2);
  eyes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cyls.length * 6).fill(1), 3);
  eyes.frustumCulled = false;
  root.add(eyes);
  {
    const col = new THREE.Color();
    const cols = { barrel: 0x3f9bff, mid: 0xb6c3cc, rod: 0xf4f7f9, eye: 0x39424c };
    cyls.forEach((c, i) => {
      tubes.setColorAt(c.tube0, col.set(cols.barrel));
      if (c.stages === 3) tubes.setColorAt(c.tube0 + 1, col.set(cols.mid));
      tubes.setColorAt(c.tube0 + c.stages - 1, col.set(cols.rod));
      eyes.setColorAt(i * 2, col.set(cols.eye)); eyes.setColorAt(i * 2 + 1, col.set(cols.eye));
    });
  }

  // ---------- lamps (unlit, one InstancedMesh): beacon, gripper pads, headlights, blinker, tail lamps ----------
  const lampGeo = geo(new THREE.SphereGeometry(1, 10, 6));
  const lampDefs = [
    { name: 'beacon', at: [sprung, V(P.cabX0 + 0.62, P.cabTop + 0.1, 0)], r: 0.17, sy: 1.15 },
    { name: 'padL', at: [gripper, V(gx - 0.3, 0, 0.2)], r: 0.085, sz: 0.45 },
    { name: 'padR', at: [gripper, V(gx + 0.3, 0, 0.2)], r: 0.085, sz: 0.45 },
    { name: 'headL', at: [sprung, V(P.cabX1 + 0.02, 1.24, 0.8)], r: 0.13, sx: 0.5 },
    { name: 'headR', at: [sprung, V(P.cabX1 + 0.02, 1.24, -0.8)], r: 0.13, sx: 0.5 },
    { name: 'blink', at: [sprung, V(P.cabX1 - 0.22, 1.3, P.cabHalfW + 0.01)], r: 0.075, sz: 0.5 },
    { name: 'tailL', at: [gate, V(-P.gateT - 0.01, -1.05, oz - 0.3)], r: 0.11, sx: 0.5 },
    { name: 'tailR', at: [gate, V(-P.gateT - 0.01, -1.05, -oz + 0.3)], r: 0.11, sx: 0.5 },
  ];
  const lamps = new THREE.InstancedMesh(lampGeo, mats.lamp, lampDefs.length);
  lamps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lampDefs.length * 3).fill(1), 3);
  lamps.frustumCulled = false;
  root.add(lamps);

  // ---------- trash pieces: one shape per kind, instanced (colour per instance, shading per vertex) ----------
  const pieceGeos = {};
  {
    const seg = low ? 7 : 10;
    // paper: crumpled ball
    pieceGeos.paper = paint(lump(0.21, low ? 0 : 1, 0.2, 11, 0.9), 0xffffff);
    // cardboard box with two open flaps
    const bx = [box(0.42, 0.28, 0.34, 0xffffff)];
    bx.push(shade(place(box(0.42, 0.02, 0.17, 0xffffff), 0, 0.17, 0.23, -0.7, 0, 0), () => 0.82));
    bx.push(shade(place(box(0.42, 0.02, 0.17, 0xffffff), 0, 0.2, -0.2, 1.0, 0, 0), () => 0.82));
    bx.push(shade(place(box(0.425, 0.06, 0.345, 0xffffff), 0, 0, 0), () => 0.7)); // tape band
    pieceGeos.box = merge(bx);
    // bottle: lathe with shoulder, neck and cap
    const bp = [[0.0, -0.21], [0.1, -0.21], [0.115, -0.17], [0.115, 0.06], [0.07, 0.15], [0.045, 0.17], [0.045, 0.21], [0.055, 0.21], [0.055, 0.25], [0.0, 0.25]].map(([r, y]) => new THREE.Vector2(r, y));
    pieceGeos.bottle = shade(paint(new THREE.LatheGeometry(bp, seg), 0xffffff), (x, y) => (y > 0.205 ? 0.55 : y > -0.1 && y < 0.0 ? 1.25 : 1));
    // can: lathe with rims
    const cp = [[0.0, -0.15], [0.09, -0.15], [0.105, -0.13], [0.105, 0.13], [0.09, 0.15], [0.0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y));
    pieceGeos.can = shade(paint(new THREE.LatheGeometry(cp, seg + 2), 0xffffff), (x, y) => (Math.abs(y) > 0.125 ? 0.6 : 1));
    // bag: squashed lumpy ball with a knot
    const bg = paint(lump(0.22, low ? 0 : 1, 0.12, 23, 0.78), 0xffffff);
    const knot = shade(place(paint(new THREE.ConeGeometry(0.07, 0.14, 6), 0xffffff), 0, 0.2, 0, Math.PI, 0, 0), () => 0.8);
    pieceGeos.bag = merge([bg, knot]);
    for (const k in pieceGeos) { pieceGeos[k].computeBoundingSphere(); geo(pieceGeos[k]); }
  }
  const pools = {};
  for (const k in pieceGeos) {
    const im = new THREE.InstancedMesh(pieceGeos[k], mats.piece, P.pieceMax);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P.pieceMax * 3).fill(1), 3);
    im.count = 0; im.frustumCulled = false;
    body.add(im);
    pools[k] = im;
  }

  // ---------- dumped chunks (on the ground, root frame): lumpy blobs with the trash photo ----------
  let chunkGeo;
  {
    const g = lump(0.3, low ? 0 : 1, 0.22, 41, 0.8);
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = 0.5 + p.getX(i) * 0.9 + p.getZ(i) * 0.4; uv[i * 2 + 1] = 0.5 + p.getY(i) * 0.9 + p.getZ(i) * 0.3; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    chunkGeo = geo(g);
  }
  const chunks = new THREE.InstancedMesh(chunkGeo, mats.chunk, P.chunkMax);
  chunks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P.chunkMax * 3).fill(1), 3);
  chunks.count = 0; chunks.frustumCulled = false;
  root.add(chunks);

  // ---------- hit target: one invisible box around the truck ----------
  const hitGeo = geo(new THREE.BoxGeometry(P.frontX - P.rearX, 3.2, P.halfW * 2 + 0.5));
  const hit = new THREE.Mesh(hitGeo, mats.shadow);
  hit.position.set((P.frontX + P.rearX) / 2, 1.6, 0.15);
  hit.visible = false;
  root.add(hit);

  return {
    root, sprung, shadow, wheels, staticMesh, tilt, body, gate, plate, layers, boom, stick, gripper, claws, clawLen,
    tubes, eyes, cyls, lamps, lampDefs, pools, chunks, hit, horn,
    instanced: [wheels, layers, claws, tubes, eyes, lamps, chunks, ...Object.values(pools)],
  };
}
