/* generated from app/shell/*.js by `npm run build:shell` — 直接編集しない */
(() => {
  // app/shell/three.js
  var THREE = window.THREE;

  // app/shell/layout.js
  var V = (x, y, z) => new THREE.Vector3(x, y, z);
  var L = {
    counter: { minX: -0.85, maxX: 0.85, minZ: -0.3, maxZ: 0.46, thick: 0.06 },
    serve: { top: 0.1, minZ: -0.58, maxZ: -0.3 },
    // 奥の一段高い受け渡し台
    board: { center: V(-0.26, 0.03, 0.06), sizeX: 0.5, sizeZ: 0.38, thick: 0.03 },
    doughStart: { center: V(-0.26, 0.03, 0.05), sizeX: 0.24, sizeZ: 0.18, thickness: 0.035 },
    knifeRest: V(0.03, 0, -0.06),
    // 刃の下端の中心（作業台の上に寝かせる）
    pinRest: V(-0.26, 0.022, 0.335),
    // めん棒の軸の中心
    pin: { radius: 0.022, length: 0.42 },
    pot: { base: V(0.44, 0, -0.08), radius: 0.155, inner: 0.145, height: 0.17, stove: 0.03, water: 0.14 },
    netRest: V(0.7, 0.16, -0.04),
    // 網のかごの中心（鍋の右の置き場）
    net: { radius: 0.062, depth: 0.06, rimY: 0.012 },
    // かごの半径・深さ・縁の高さ（hero にも渡す）
    bowlRest: V(0.16, 0, 0.29),
    // お椀の外底
    bowl: { outerR: 0.098, innerR: 0.085, bottomR: 0.04, height: 0.08, foot: 0.012, brothLevel: 0.045 },
    dishes: [V(0.33, 0, 0.33), V(0.45, 0, 0.35), V(0.57, 0, 0.33), V(0.68, 0, 0.26)],
    dishR: 0.05,
    serveSpot: V(0, 0.1, -0.4),
    // 渡したお椀の位置（受け渡し台の上）
    customer: V(0, 0.1, -0.68),
    // お客さんの座る位置（足元）
    giftShelf: { start: V(-0.72, 0.1, -0.47), step: 0.095 },
    backdrop: { z: -1.9, y: 0.55, size: 3.6 },
    camera: {
      work: {
        pos: V(0.03, 0.8, 0.98),
        target: V(0.07, 0.03, -0.12),
        // 画面に必ず入れる点（縦持ちでも）
        fit: [V(-0.55, 0, 0.3), V(0.78, 0, 0.3), V(-0.78, 0.12, -0.47), V(0.8, 0.2, -0.06), V(0, 0.56, -0.7), V(-0.5, 0, 0.42), V(0.7, 0, 0.42)]
      },
      serve: {
        pos: V(-0.04, 0.62, 0.22),
        target: V(0, 0.22, -0.62),
        fit: [V(-0.3, 0.1, -0.38), V(0.3, 0.1, -0.38), V(0, 0.62, -0.7), V(-0.3, 0.1, -0.75), V(0.3, 0.1, -0.75)]
      }
    }
  };

  // app/shell/tier.js
  function detectTier(params2) {
    const ua = navigator.userAgent || "";
    const mobile = (navigator.maxTouchPoints || 0) > 1 || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const tiers = {
      // 基準機（2020 iPad Pro 12.9"）: DPR 1.0 固定、MSAA なし
      mobile: { name: "mobile", dpr: 1, maxPixels: 16e5, hero: "mid", fx: 1 },
      desktop: { name: "desktop", dpr: Math.min(window.devicePixelRatio || 1, 2), maxPixels: 37e5, hero: "high", fx: 1 },
      low: { name: "low", dpr: mobile ? 0.75 : 1, maxPixels: 1e6, hero: "low", fx: 0.5 }
    };
    const want = params2.get("tier");
    const t = tiers[want] || (mobile ? tiers.mobile : tiers.desktop);
    return { ...t, mobile, antialias: false, minScale: 0.7 };
  }

  // app/shell/textures.js
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error("load " + src));
      document.head.appendChild(s);
    });
  }
  var TextureBank = class {
    constructor(renderer) {
      this.renderer = renderer;
      this.items = [];
      this.fileMode = location.protocol === "file:";
      this._dataPromise = null;
    }
    _register(name, tex, w, h, mip) {
      const it = { name, tex, w, h, mip };
      this.items.push(it);
      return it;
    }
    _source(name) {
      if (!this.fileMode) return Promise.resolve("assets/" + name + ".jpg");
      if (!this._dataPromise) this._dataPromise = window.UdonTextureData ? Promise.resolve() : loadScript("assets/textures.js");
      return this._dataPromise.then(() => {
        const d = window.UdonTextureData && window.UdonTextureData[name];
        if (!d) throw new Error("no texture data " + name);
        return d;
      });
    }
    // 写真テクスチャ（app/assets/<name>.jpg）
    photo(name, avg, { repeat = [1, 1], wrap = true } = {}) {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const g = c.getContext("2d");
      g.fillStyle = avg;
      g.fillRect(0, 0, 1, 1);
      const tex = new THREE.Texture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (wrap) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      }
      tex.repeat.set(repeat[0], repeat[1]);
      tex.needsUpdate = true;
      const it = this._register(name, tex, 1, 1, true);
      tex.userData.ready = this._source(name).then((src) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const done = () => {
            tex.dispose();
            tex.image = img;
            tex.needsUpdate = true;
            it.w = img.naturalWidth;
            it.h = img.naturalHeight;
            res(tex);
          };
          if (img.decode) img.decode().then(done, done);
          else done();
        };
        img.onerror = () => rej(new Error("image " + name));
        img.src = src;
      })).catch((e) => {
        console.warn("[udon] texture", name, e.message);
        return tex;
      });
      return tex;
    }
    // 手続きの Canvas テクスチャ
    canvas(name, w, h, draw, { wrap = false, srgb = true, mip = true } = {}) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      draw(c.getContext("2d"), w, h);
      const tex = new THREE.CanvasTexture(c);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      if (wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = mip;
      if (!mip) tex.minFilter = THREE.LinearFilter;
      this._register(name, tex, w, h, mip);
      return tex;
    }
    ready() {
      return Promise.all(this.items.map((i) => i.tex.userData.ready).filter(Boolean));
    }
    bytes() {
      let b = 0;
      for (const i of this.items) b += i.w * i.h * 4 * (i.mip ? 4 / 3 : 1);
      return b;
    }
    list() {
      return this.items.map((i) => ({ name: i.name, width: i.w, height: i.h }));
    }
    // コンテキスト喪失から戻ったら全部もう一度 GPU へ送る
    restore() {
      for (const i of this.items) i.tex.needsUpdate = true;
    }
    dispose() {
      for (const i of this.items) i.tex.dispose();
      this.items.length = 0;
    }
  };
  function drawWood(g, w, h) {
    g.fillStyle = "#c98f55";
    g.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let y = 0; y < h; y += 1) {
      const v = Math.sin(y * 0.11 + Math.sin(y * 0.023) * 4) * 0.5 + 0.5;
      g.fillStyle = `rgba(${120 + v * 40},${70 + v * 30},${35 + v * 15},${0.1 + v * 0.1})`;
      g.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(110,62,28,${0.06 + rnd() * 0.1})`;
      g.lineWidth = 1 + rnd() * 1.5;
      const y0 = rnd() * h;
      g.beginPath();
      g.moveTo(0, y0);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.03 + i) * 3);
      g.stroke();
    }
  }
  function drawSoft(g, w, h) {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.5, "rgba(255,255,255,0.45)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  }
  function drawSparkle(g, w, h) {
    const cx = w / 2, cy = h / 2;
    const r = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,255,255,0.5)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i % 2 ? w * 0.09 : w * 0.48;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  function drawHeart(g, w, h) {
    g.fillStyle = "#fff";
    g.beginPath();
    const s = w / 64;
    g.moveTo(32 * s, 54 * s);
    g.bezierCurveTo(4 * s, 36 * s, 6 * s, 10 * s, 20 * s, 10 * s);
    g.bezierCurveTo(27 * s, 10 * s, 31 * s, 15 * s, 32 * s, 20 * s);
    g.bezierCurveTo(33 * s, 15 * s, 37 * s, 10 * s, 44 * s, 10 * s);
    g.bezierCurveTo(58 * s, 10 * s, 60 * s, 36 * s, 32 * s, 54 * s);
    g.fill();
  }
  function drawBowlPattern(color) {
    return (g, w, h) => {
      g.fillStyle = "#fbf6ee";
      g.fillRect(0, 0, w, h);
      g.fillStyle = color;
      g.fillRect(0, 0, w, h * 0.22);
      g.fillRect(0, h * 0.9, w, h * 0.1);
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc((i + 0.5) * w / 8, h * 0.56, h * 0.13, 0, Math.PI * 2);
        g.fill();
      }
    };
  }
  function drawNet(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(205,210,214,1)";
    g.lineWidth = 2;
    for (let i = 0; i <= w; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, h);
      g.stroke();
    }
    for (let j = 0; j <= h; j += 8) {
      g.beginPath();
      g.moveTo(0, j);
      g.lineTo(w, j);
      g.stroke();
    }
  }

  // app/shell/util.js
  function mergeColored(parts, opts = {}) {
    let nv = 0, ni = 0;
    const prepared = parts.map((p) => {
      const g = p.geo.index ? p.geo : indexed(p.geo);
      const m = p.matrix ? p.matrix.clone() : new THREE.Matrix4().compose(
        p.pos || new THREE.Vector3(),
        new THREE.Quaternion().setFromEuler(p.rot || new THREE.Euler()),
        p.scale instanceof THREE.Vector3 ? p.scale : new THREE.Vector3(1, 1, 1).multiplyScalar(p.scale || 1)
      );
      nv += g.attributes.position.count;
      ni += g.index.count;
      return { g, m, c: p.color == null ? null : new THREE.Color(p.color), uv: p.uv || null, a: p.alpha == null ? 1 : p.alpha, src: p.geo };
    });
    const cs = opts.alpha ? 4 : 3;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * cs);
    const uvs = opts.uv ? new Float32Array(nv * 2) : null;
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const { g, m, c, uv, a } of prepared) {
      nm.getNormalMatrix(m);
      const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m);
        v.toArray(pos, (vo + i) * 3);
        if (N) {
          v.fromBufferAttribute(N, i).applyMatrix3(nm);
          const l = v.length();
          if (l > 1e-6) v.multiplyScalar(1 / l);
          else v.set(0, 1, 0);
          v.toArray(nor, (vo + i) * 3);
        }
        const o = (vo + i) * cs;
        if (c) {
          col[o] = c.r;
          col[o + 1] = c.g;
          col[o + 2] = c.b;
        } else if (C) {
          col[o] = C.getX(i);
          col[o + 1] = C.getY(i);
          col[o + 2] = C.getZ(i);
        } else {
          col[o] = col[o + 1] = col[o + 2] = 1;
        }
        if (cs === 4) col[o + 3] = a;
        if (uvs) {
          if (uv) {
            uvs[(vo + i) * 2] = uv[0];
            uvs[(vo + i) * 2 + 1] = uv[1];
          } else if (U) {
            uvs[(vo + i) * 2] = U.getX(i);
            uvs[(vo + i) * 2 + 1] = U.getY(i);
          }
        }
      }
      const I = g.index.array;
      for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
      vo += P.count;
      io += I.length;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("color", new THREE.BufferAttribute(col, cs));
    if (uvs) out.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    for (const p of prepared) if (p.g !== p.geo) p.g.dispose();
    return out;
  }
  function indexed(g) {
    const n = g.attributes.position.count;
    const c = g.clone();
    const a = new Uint32Array(n);
    for (let i = 0; i < n; i++) a[i] = i;
    c.setIndex(new THREE.BufferAttribute(a, 1));
    return c;
  }
  var clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  var lerp = (a, b, t) => a + (b - a) * t;
  var smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  var easeInOut = (t) => {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  function dampV(v, target, k, dt) {
    return v.lerp(target, 1 - Math.exp(-k * dt));
  }
  var Glow = class {
    constructor(materials) {
      this.mats = materials.filter((m) => m && m.emissive);
      this.base = this.mats.map((m) => m.emissive.clone());
      this.v = 0;
    }
    set(v) {
      if (Math.abs(v - this.v) < 1e-3) return;
      this.v = v;
      this.mats.forEach((m, i) => {
        m.emissive.copy(this.base[i]).lerp(GLOW_COLOR, v);
      });
    }
  };
  var GLOW_COLOR = new THREE.Color("#ffd9a0");

  // app/shell/scene.js
  var V2 = (x, y, z) => new THREE.Vector3(x, y, z);
  var lambert = (o) => new THREE.MeshLambertMaterial(o);
  var phong = (o) => new THREE.MeshPhongMaterial(o);
  function proxy(geo2, kind, extra = {}) {
    const m = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ visible: false }));
    m.userData = { kind, enabled: true, ...extra };
    return m;
  }
  var BOWL_COLORS = ["#d9534f", "#3a6ea5", "#4f9a5a", "#e08a2e", "#9b59b6"];
  function buildScene(bank, tier) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9d6b8");
    const proxies = [];
    const glows = {};
    scene.add(new THREE.HemisphereLight("#fff6ea", "#8a6a50", 1.5));
    const sun = new THREE.DirectionalLight("#fff1de", 1.7);
    sun.position.set(-0.6, 1.6, 1.1);
    scene.add(sun);
    const tex = {
      shop: bank.photo("udon_shop_512", "#a57a52", { wrap: false }),
      board: bank.photo("flour_board_512", "#e8c9a4"),
      metal: bank.photo("pot_metal_512", "#b8babd", { repeat: [2, 1] }),
      broth: bank.photo("dashi_broth_512", "#d09a20"),
      wood: bank.canvas("wood", 256, 256, drawWood, { wrap: true }),
      net: bank.canvas("net", 128, 128, drawNet, { wrap: true }),
      water: bank.canvas("water", 128, 128, drawWater, { wrap: false }),
      soft: bank.canvas("soft", 64, 64, drawSoft)
    };
    tex.wood.repeat.set(3, 1.4);
    const bd = L.backdrop;
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(bd.size, bd.size),
      new THREE.MeshBasicMaterial({ map: tex.shop, color: "#f2e6d6" })
    );
    back.position.set(0.05, bd.y, bd.z);
    scene.add(back);
    const tmpGeos = [];
    const tg = (g) => {
      tmpGeos.push(g);
      return g;
    };
    const c = L.counter, s = L.serve;
    const counterGeo = mergeColored([
      { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX, c.thick, c.maxZ - c.minZ)), color: "#f0d2ae", pos: V2((c.minX + c.maxX) / 2, -c.thick / 2, (c.minZ + c.maxZ) / 2) },
      { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.4, 0.8, 0.03)), color: "#b98a5c", pos: V2(0, -c.thick - 0.4, c.maxZ - 0.01) },
      { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.6, 0.04, s.maxZ - s.minZ)), color: "#f6dcbc", pos: V2(0, s.top - 0.02, (s.minZ + s.maxZ) / 2) },
      { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.6, s.top, 0.02)), color: "#c79a6c", pos: V2(0, s.top / 2 - 0.02, s.maxZ - 0.01) }
    ], { uv: true });
    scene.add(new THREE.Mesh(counterGeo, lambert({ map: tex.wood, vertexColors: true })));
    const plainGeo = mergeColored([
      { geo: tg(new THREE.PlaneGeometry(4, 2.2)), color: "#8d8173", pos: V2(0, bd.y - bd.size / 2, bd.z + 1.1), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
      { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.6, 0.5, 0.02)), color: "#7a5638", pos: V2(0, s.top - 0.27, s.minZ - 0.26) }
    ]);
    scene.add(new THREE.Mesh(plainGeo, lambert({ vertexColors: true })));
    const shadowMat = new THREE.MeshBasicMaterial({ map: tex.soft, color: "#000000", transparent: true, opacity: 0.22, depthWrite: false });
    const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const staticShadows = [];
    const staticShadow = (x, y, z, sx, sz, op) => staticShadows.push({ geo: shadowGeo, color: "#000000", alpha: op, pos: V2(x, y + 1e-3, z), scale: V2(sx, 1, sz) });
    const shadow = (x, y, z, sx, sz, op = 0.22) => {
      const m = new THREE.Mesh(shadowGeo, op === 0.22 ? shadowMat : shadowMat.clone());
      if (op !== 0.22) m.material.opacity = op;
      m.position.set(x, y + 1e-3, z);
      m.scale.set(sx, 1, sz);
      m.renderOrder = 1;
      scene.add(m);
      return m;
    };
    const b = L.board;
    const boardGeo = new THREE.BoxGeometry(b.sizeX, b.thick, b.sizeZ);
    {
      const n = boardGeo.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const top = i >= 8 && i < 12;
        col.set(top ? [1, 1, 1] : [0.94, 0.83, 0.68], i * 3);
      }
      boardGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
    const board = new THREE.Mesh(boardGeo, lambert({ map: tex.board, vertexColors: true }));
    board.position.set(b.center.x, b.thick / 2, b.center.z);
    scene.add(board);
    staticShadow(b.center.x, 0, b.center.z + 0.01, b.sizeX + 0.06, b.sizeZ + 0.06, 0.18);
    const knife = new THREE.Group();
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.095, 0);
    bladeShape.lineTo(0.095, 0);
    bladeShape.lineTo(0.095, 0.072);
    bladeShape.lineTo(-0.085, 0.072);
    bladeShape.quadraticCurveTo(-0.095, 0.072, -0.095, 0.06);
    bladeShape.lineTo(-0.095, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 4e-3, bevelEnabled: false, curveSegments: 3 });
    bladeGeo.translate(0, 0, -2e-3);
    bladeGeo.rotateY(Math.PI / 2);
    const bladeMat = phong({ vertexColors: true, specular: "#ffffff", shininess: 100 });
    knife.add(new THREE.Mesh(mergeColored([
      { geo: tg(bladeGeo), color: "#cfd6dc" },
      { geo: tg(new THREE.BoxGeometry(45e-4, 0.012, 0.19)), color: "#f4f8fb", pos: V2(0, 6e-3, 0) },
      // 刃先
      { geo: tg(new THREE.BoxGeometry(8e-3, 0.02, 0.04)), color: "#cfd6dc", pos: V2(0, 0.07, 0.085) }
      // 口金
    ]), bladeMat));
    const handleMat = lambert({ color: "#6b3f22" });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.12), handleMat);
    handle.position.set(0, 0.074, 0.13);
    handle.rotation.x = -0.18;
    knife.add(handle);
    knife.position.copy(L.knifeRest);
    scene.add(knife);
    const knifeProxy = proxy(new THREE.BoxGeometry(0.09, 0.14, 0.34), "knife");
    knifeProxy.position.set(0, 0.04, 0.04);
    knife.add(knifeProxy);
    proxies.push(knifeProxy);
    const knifeShadow = shadow(L.knifeRest.x, 0, L.knifeRest.z, 0.06, 0.3, 0.16);
    glows.knife = new Glow([bladeMat, handleMat]);
    const pr = L.pin.radius, pl = L.pin.length;
    const pinPts = [V2(0, -pl / 2, 0), V2(0.011, -pl / 2, 0), V2(0.013, -pl / 2 + 0.02, 0), V2(pr, -pl / 2 + 0.05, 0), V2(pr, pl / 2 - 0.05, 0), V2(0.013, pl / 2 - 0.02, 0), V2(0.011, pl / 2, 0), V2(0, pl / 2, 0)].map((p) => new THREE.Vector2(p.x, p.y));
    const pinGeo = tg(new THREE.LatheGeometry(pinPts, 16));
    pinGeo.rotateZ(Math.PI / 2);
    const bandGeo = tg(new THREE.CylinderGeometry(pr * 1.01, pr * 1.01, 0.012, 16, 1, true).rotateZ(Math.PI / 2));
    const pinMat = lambert({ vertexColors: true });
    const pin = new THREE.Group();
    const pinMesh = new THREE.Mesh(mergeColored([
      { geo: pinGeo, color: "#e7c08a" },
      { geo: bandGeo, color: "#b4834d", pos: V2(-0.1, 0, 0) },
      { geo: bandGeo, color: "#b4834d", pos: V2(0.1, 0, 0) },
      { geo: tg(new THREE.SphereGeometry(6e-3, 6, 4)), color: "#9c6a3a", pos: V2(0, pr, 0) }
    ]), pinMat);
    pin.add(pinMesh);
    pin.position.copy(L.pinRest);
    scene.add(pin);
    const pinProxy = proxy(new THREE.BoxGeometry(pl + 0.04, 0.09, 0.1), "pin");
    pin.add(pinProxy);
    proxies.push(pinProxy);
    const pinShadow = shadow(L.pinRest.x, 0, L.pinRest.z, pl, 0.06, 0.16);
    glows.pin = new Glow([pinMat]);
    const P = L.pot;
    scene.add(new THREE.Mesh(mergeColored([
      { geo: tg(new THREE.CylinderGeometry(P.radius + 0.035, P.radius + 0.045, P.stove, 28)), color: "#3d3a38", pos: V2(P.base.x, P.stove / 2, P.base.z) },
      { geo: tg(new THREE.TorusGeometry(P.radius - 0.03, 6e-3, 6, 28).rotateX(Math.PI / 2)), color: "#1e1c1b", pos: V2(P.base.x, P.stove + 2e-3, P.base.z) },
      { geo: tg(new THREE.CylinderGeometry(0.07, 0.075, 0.07, 20)), color: "#9a6b44", pos: V2(L.netRest.x, 0.035, L.netRest.z) }
    ]), lambert({ vertexColors: true })));
    staticShadow(P.base.x, 0, P.base.z, 0.5, 0.5, 0.25);
    const y0 = P.stove, y1 = P.stove + P.height;
    const potPts = [
      [0, y0],
      [P.radius - 0.01, y0],
      [P.radius, y0 + 0.01],
      [P.radius, y1 - 8e-3],
      [P.radius + 8e-3, y1],
      [P.radius + 4e-3, y1 + 6e-3],
      [P.inner, y1],
      [P.inner, y0 + 0.012],
      [0, y0 + 0.01]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const potMat = phong({ map: tex.metal, color: "#e9edf0", specular: "#9aa0a6", shininess: 50 });
    const potHandleGeo = tg(new THREE.TorusGeometry(0.024, 6e-3, 6, 12, Math.PI).rotateZ(-Math.PI / 2).rotateX(Math.PI / 2));
    const pot = new THREE.Mesh(mergeColored([
      { geo: tg(new THREE.LatheGeometry(potPts, 40)), color: "#ffffff" },
      ...[-1, 1].map((sx) => ({ geo: potHandleGeo, color: "#ffffff", pos: V2(sx * (P.radius - 4e-3), y1 - 0.025, 0), rot: new THREE.Euler(0, sx > 0 ? 0 : Math.PI, 0) }))
    ], { uv: true }), potMat);
    pot.position.set(P.base.x, 0, P.base.z);
    scene.add(pot);
    const waterMat = phong({ map: tex.water, color: "#eef5f4", specular: "#ffffff", shininess: 70, emissive: "#1d2a2c", transparent: true, opacity: 0.6, depthWrite: false });
    const water = new THREE.Mesh(new THREE.CircleGeometry(P.inner - 1e-3, 40).rotateX(-Math.PI / 2), waterMat);
    water.position.set(P.base.x, P.water, P.base.z);
    water.renderOrder = 2;
    scene.add(water);
    const waterProxy = proxy(new THREE.CylinderGeometry(P.radius + 0.01, P.radius + 0.01, 0.08, 16), "water");
    waterProxy.position.set(P.base.x, P.water, P.base.z);
    scene.add(waterProxy);
    proxies.push(waterProxy);
    glows.pot = new Glow([potMat]);
    const net = new THREE.Group();
    const netR = L.net.radius, netD = L.net.depth;
    const cupPts = [];
    for (let i = 0; i <= 8; i++) {
      const a = i / 8 * Math.PI / 2;
      cupPts.push(new THREE.Vector2(Math.max(2e-3, Math.sin(a) * netR), -Math.cos(a) * netD + 0.01));
    }
    tex.net.repeat.set(6, 2);
    const netMat = lambert({ map: tex.net, color: "#dfe4e8", alphaTest: 0.4, side: THREE.DoubleSide, transparent: false });
    const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 20), netMat);
    net.add(cup);
    const metalMat = phong({ color: "#c3c8cc", specular: "#ffffff", shininess: 80 });
    const netHandle = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8), lambert({ color: "#6b3f22" }));
    grip.position.y = 0.17;
    netHandle.add(grip);
    netHandle.position.set(netR * 0.7, 0.01, netR * 0.7);
    netHandle.rotation.set(1, 0, -0.3);
    netHandle.updateMatrix();
    net.add(netHandle);
    net.add(new THREE.Mesh(mergeColored([
      { geo: tg(new THREE.TorusGeometry(netR, 4e-3, 6, 24).rotateX(Math.PI / 2)), color: "#ffffff", pos: V2(0, 0.01, 0) },
      { geo: tg(new THREE.CylinderGeometry(45e-4, 45e-4, 0.14, 6)), color: "#ffffff", matrix: netHandle.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.07, 0)) }
    ]), metalMat));
    net.position.copy(L.netRest);
    scene.add(net);
    staticShadow(L.netRest.x, 0, L.netRest.z, 0.2, 0.2, 0.2);
    const netProxy = proxy(new THREE.SphereGeometry(0.085, 10, 8), "net");
    net.add(netProxy);
    proxies.push(netProxy);
    const netProxy2 = proxy(new THREE.BoxGeometry(0.07, 0.24, 0.07), "net");
    netProxy2.position.y = 0.12;
    netHandle.add(netProxy2);
    proxies.push(netProxy2);
    glows.net = new Glow([metalMat, netMat]);
    const B = L.bowl;
    const bowl = new THREE.Group();
    const outerPts = [[0, 2e-3], [0.044, 0], [0.047, B.foot], [0.06, B.foot + 4e-3], [0.08, 0.03], [0.093, 0.055], [B.outerR, B.height], [B.outerR - 3e-3, B.height + 4e-3]].map(([x, y]) => new THREE.Vector2(x, y));
    const innerPts = [[B.outerR - 3e-3, B.height + 4e-3], [B.innerR, B.height + 2e-3], [0.08, 0.05], [0.064, 0.03], [B.bottomR, B.foot + 3e-3], [0, B.foot]].map(([x, y]) => new THREE.Vector2(x, y));
    const patternTex = bank.canvas("bowl-pattern", 256, 64, drawBowlPattern(BOWL_COLORS[0]), { wrap: true });
    patternTex.repeat.set(2, 1);
    const bowlOutMat = phong({ map: patternTex, specular: "#ffffff", shininess: 60, vertexColors: true });
    const outerGeo = tg(new THREE.LatheGeometry(outerPts, 36));
    {
      const uv = outerGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    }
    bowl.add(new THREE.Mesh(mergeColored([
      { geo: outerGeo, color: "#ffffff" },
      { geo: tg(new THREE.LatheGeometry(innerPts, 36)), color: "#ffffff", uv: [0.25, 0.7] }
    ], { uv: true }), bowlOutMat));
    const bowlAnchor = new THREE.Object3D();
    bowlAnchor.position.y = B.foot + 3e-3;
    bowlAnchor.userData = { innerRadius: B.innerR, bottomRadius: B.bottomR, depth: B.height - B.foot, brothLevel: B.brothLevel };
    bowl.add(bowlAnchor);
    const broth = new THREE.Mesh(
      new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2),
      phong({ map: tex.broth, color: "#ffffff", specular: "#fff6dd", shininess: 80, transparent: true, opacity: 0.78, depthWrite: false })
    );
    broth.renderOrder = 2;
    bowlAnchor.add(broth);
    broth.visible = false;
    bowl.position.copy(L.bowlRest);
    scene.add(bowl);
    const bowlShadow = shadow(L.bowlRest.x, 0, L.bowlRest.z, 0.24, 0.24, 0.24);
    const bowlProxy = proxy(new THREE.CylinderGeometry(B.outerR + 0.03, B.outerR + 0.02, 0.12, 12), "bowl");
    bowlProxy.position.y = 0.05;
    bowl.add(bowlProxy);
    proxies.push(bowlProxy);
    glows.bowl = new Glow([bowlOutMat]);
    const setBowlColor = (i) => {
      const cv = patternTex.image;
      drawBowlPattern(BOWL_COLORS[i % BOWL_COLORS.length])(cv.getContext("2d"), cv.width, cv.height);
      patternTex.needsUpdate = true;
    };
    const brothRadiusAt = (h) => {
      const yb = B.foot + 3e-3, hb = h + yb;
      const t = Math.min(1, Math.max(0, (hb - (B.foot + 3e-3)) / (B.height - B.foot)));
      return B.bottomR + (B.innerR - B.bottomR) * Math.pow(t, 0.8);
    };
    const toppings = makeToppings();
    const dishGeo = new THREE.LatheGeometry([[0, 4e-3], [0.03, 2e-3], [0.034, 0], [L.dishR, 0.012], [L.dishR + 3e-3, 0.016], [L.dishR - 2e-3, 0.014], [0.03, 7e-3], [0, 8e-3]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    const dishes = [];
    const TYPES = ["negi", "kamaboko", "ebiten", "oage"];
    L.dishes.forEach((p, i) => {
      const g = new THREE.Group();
      const dmat = phong({ color: ["#f3efe6", "#e9f1f6", "#f6efe2", "#eef3ea"][i], specular: "#ffffff", shininess: 40 });
      g.add(new THREE.Mesh(dishGeo, dmat));
      const pileMat = toppings.mats[TYPES[i]].clone();
      const pileParts = [];
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + i;
        pileParts.push({ geo: toppings.geos[TYPES[i]], pos: V2(Math.cos(a) * 0.012, 0.012 + k * 6e-3, Math.sin(a) * 0.012), rot: new THREE.Euler(0, a * 1.3, 0) });
      }
      const pile = new THREE.Mesh(mergeColored(pileParts), pileMat);
      g.add(pile);
      g.position.copy(p);
      scene.add(g);
      staticShadow(p.x, 0, p.z, 0.13, 0.13, 0.2);
      const px = proxy(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10), "dish", { index: i, type: TYPES[i] });
      px.position.y = 0.03;
      g.add(px);
      proxies.push(px);
      dishes.push({ group: g, pile, type: TYPES[i], glow: new Glow([dmat, pileMat]), base: p.clone() });
    });
    const customerProxy = proxy(new THREE.BoxGeometry(0.42, 0.5, 0.3), "customer");
    customerProxy.position.set(L.customer.x, L.customer.y + 0.25, L.customer.z);
    scene.add(customerProxy);
    proxies.push(customerProxy);
    const tableProxy = proxy(new THREE.BoxGeometry(c.maxX - c.minX, 0.01, c.maxZ - c.minZ + 0.1), "table");
    tableProxy.position.set(0, 0, (c.minZ + c.maxZ) / 2);
    scene.add(tableProxy);
    proxies.push(tableProxy);
    const staticShadowMesh = new THREE.Mesh(
      mergeColored(staticShadows, { alpha: true }),
      new THREE.MeshBasicMaterial({ map: tex.soft, vertexColors: true, transparent: true, depthWrite: false })
    );
    staticShadowMesh.renderOrder = 1;
    scene.add(staticShadowMesh);
    for (const g of new Set(tmpGeos)) g.dispose();
    return {
      scene,
      proxies,
      glows,
      tex,
      objs: { board, knife, knifeShadow, pin, pinMesh, pinShadow, net, netHandle, pot, water, bowl, bowlAnchor, broth, bowlShadow, dishes, toppings },
      setBowlColor,
      brothRadiusAt
    };
  }
  function drawWater(g, w, h) {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "#f6fbfb");
    r.addColorStop(1, "#cfdcdc");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const a = k * 1.256 + t * 2.4, rr = (0.12 + t * 0.36) * w;
        const x = w / 2 + Math.cos(a) * rr, y = h / 2 + Math.sin(a) * rr;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  function makeToppings() {
    const geos = {}, mats = {};
    const ring = new THREE.TorusGeometry(68e-4, 26e-4, 5, 10);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.7, r = i === 0 ? 0 : 0.011;
      parts.push({ geo: ring, color: i % 2 ? "#8fd16a" : "#5fae45", pos: V2(Math.cos(a) * r, 2e-3 + i % 3 * 15e-4, Math.sin(a) * r), rot: new THREE.Euler(Math.PI / 2 + i % 2 * 0.3, 0, 0) });
    }
    geos.negi = mergeColored(parts);
    const d = (sx, sy) => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.024 * sx, 0);
      sh.lineTo(0.024 * sx, 0);
      sh.absellipse(0, 0, 0.024 * sx, 0.02 * sy, 0, Math.PI, false);
      return sh;
    };
    const kw = new THREE.ExtrudeGeometry(d(1, 1), { depth: 8e-3, bevelEnabled: false, curveSegments: 10 });
    const kp = new THREE.ExtrudeGeometry(d(1.12, 1.2), { depth: 75e-4, bevelEnabled: false, curveSegments: 10 });
    geos.kamaboko = mergeColored([
      { geo: kp, color: "#f48aa8", pos: V2(0, 5e-4, 2e-3), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
      { geo: kw, color: "#fffaf4", pos: V2(0, 1e-3, 0), rot: new THREE.Euler(-Math.PI / 2, 0, 0) }
    ]);
    kw.dispose();
    kp.dispose();
    const curve = new THREE.CatmullRomCurve3([V2(-0.04, 0.012, 0), V2(-0.01, 0.016, 8e-3), V2(0.02, 0.014, 4e-3), V2(0.038, 0.01, -6e-3)]);
    const body = new THREE.TubeGeometry(curve, 12, 0.012, 8, false);
    {
      const p = body.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const n = 1 + 0.12 * Math.sin(i * 2.3) * Math.cos(i * 0.7);
        p.setY(i, 0.012 + (p.getY(i) - 0.012) * n);
      }
      body.computeVertexNormals();
    }
    const capA = new THREE.SphereGeometry(0.012, 8, 6);
    const tail = new THREE.ConeGeometry(0.011, 0.024, 6);
    geos.ebiten = mergeColored([
      { geo: body, color: "#e3a947" },
      { geo: capA, color: "#e3a947", pos: V2(-0.04, 0.012, 0) },
      { geo: tail, color: "#e8553a", pos: V2(0.05, 0.01, -0.01), rot: new THREE.Euler(0, 0, -Math.PI / 2), scale: V2(1, 1, 0.45) }
    ]);
    body.dispose();
    capA.dispose();
    tail.dispose();
    const og = new THREE.BoxGeometry(0.058, 0.012, 0.044, 4, 1, 4);
    {
      const p = og.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / 0.029, z = p.getZ(i) / 0.022;
        const k = 1 - 0.25 * (x * x * z * z);
        p.setY(i, p.getY(i) * (0.6 + 0.6 * k) + 6e-3);
      }
      og.computeVertexNormals();
    }
    geos.oage = mergeColored([{ geo: og, color: "#c98436" }]);
    og.dispose();
    ring.dispose();
    for (const k of Object.keys(geos)) mats[k] = new THREE.MeshLambertMaterial({ vertexColors: true });
    return { geos, mats };
  }

  // app/shell/customer.js
  var V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  var E = (x, y, z) => new THREE.Euler(x, y, z);
  var SPECIES = [
    { id: "tanuki", fur: "#8f6e50", light: "#f3e2ca", dark: "#4b3729", ear: "round", tail: "tanuki", nose: "#2b2018", cheek: "#f4a3a0", mask: true },
    { id: "kitsune", fur: "#ee9440", light: "#fff4e6", dark: "#5a3018", ear: "pointy", tail: "fox", nose: "#2b2018", cheek: "#f7a59a" },
    { id: "neko", fur: "#f7efe2", light: "#ffffff", dark: "#e9a85e", ear: "cat", tail: "cat", nose: "#f08a9a", cheek: "#f7b0b8", whisker: true },
    { id: "usagi", fur: "#fbf6f2", light: "#ffffff", dark: "#f2b8c2", ear: "bunny", tail: "bunny", nose: "#f08a9a", cheek: "#f7aab4" }
  ];
  var G = {};
  function geo() {
    if (G.s) return G;
    G.s = new THREE.SphereGeometry(1, 20, 14);
    G.ss = new THREE.SphereGeometry(1, 10, 8);
    G.cone = new THREE.ConeGeometry(1, 1, 12);
    G.cap = new THREE.CapsuleGeometry(1, 2, 4, 10);
    G.arc = new THREE.TorusGeometry(1, 0.24, 5, 12, Math.PI);
    G.box = new THREE.BoxGeometry(1, 1, 1);
    return G;
  }
  function headParts(sp, { happy = false } = {}) {
    const g = geo();
    const P = [];
    P.push({ geo: g.s, color: sp.fur, scale: V3(0.12, 0.11, 0.114) });
    if (sp.mask) for (const sx of [-1, 1]) P.push({ geo: g.s, color: sp.dark, pos: V3(sx * 0.046, 6e-3, 0.088), scale: V3(0.038, 0.03, 0.02), rot: E(0, 0, sx * 0.3) });
    const muzzleZ = sp.id === "kitsune" ? 0.094 : 0.085;
    P.push({ geo: g.s, color: sp.light, pos: V3(0, -0.035, muzzleZ), scale: V3(0.063, 0.043, 0.041) });
    P.push({ geo: g.s, color: sp.nose, pos: V3(0, -0.014, muzzleZ + 0.04), scale: V3(0.016, 0.012, 0.011) });
    if (sp.whisker) for (const sx of [-1, 1]) for (const k of [-1, 1]) P.push({ geo: g.box, color: "#b9a98f", pos: V3(sx * 0.085, -0.03 + k * 8e-3, 0.1), scale: V3(0.05, 16e-4, 16e-4), rot: E(0, 0, sx * k * 0.15) });
    if (happy) {
      for (const sx of [-1, 1]) P.push({ geo: g.arc, color: "#2a1d16", pos: V3(sx * 0.045, 4e-3, 0.106), scale: V3(0.016, 0.016, 0.016) });
      P.push({ geo: g.arc, color: "#7a2b2b", pos: V3(0, -0.054, 0.122), scale: V3(0.013, 0.013, 0.013), rot: E(-0.3, 0, Math.PI) });
      for (const sx of [-1, 1]) P.push({ geo: g.s, color: sp.cheek, pos: V3(sx * 0.078, -0.035, 0.085), scale: V3(0.024, 0.016, 9e-3) });
    }
    return P;
  }
  function earParts(sp, sx) {
    const g = geo();
    switch (sp.ear) {
      case "round":
        return [{ geo: g.s, color: sp.dark, scale: V3(0.04, 0.038, 0.02) }, { geo: g.s, color: sp.light, pos: V3(0, -4e-3, 0.012), scale: V3(0.022, 0.02, 0.01) }];
      case "pointy":
        return [{ geo: g.cone, color: sp.fur, scale: V3(0.045, 0.1, 0.022) }, { geo: g.cone, color: sp.dark, pos: V3(0, 0.032, 2e-3), scale: V3(0.022, 0.036, 0.016) }, { geo: g.cone, color: sp.light, pos: V3(0, -0.01, 0.01), scale: V3(0.025, 0.06, 8e-3) }];
      case "cat":
        return [{ geo: g.cone, color: sp.dark, scale: V3(0.04, 0.07, 0.02) }, { geo: g.cone, color: "#f6b0bb", pos: V3(0, -6e-3, 0.01), scale: V3(0.022, 0.045, 8e-3) }];
      case "bunny":
        return [{ geo: g.cap, color: sp.fur, pos: V3(0, 0.06, 0), scale: V3(0.026, 0.045, 0.016) }, { geo: g.cap, color: "#f6b8c4", pos: V3(0, 0.06, 0.01), scale: V3(0.014, 0.036, 8e-3) }];
    }
    return [];
  }
  function earPlace(sp, sx) {
    switch (sp.ear) {
      case "round":
        return { pos: V3(sx * 0.082, 0.085, -0.01), rot: E(0, 0, -sx * 0.4) };
      case "pointy":
        return { pos: V3(sx * 0.072, 0.12, -5e-3), rot: E(0, 0, -sx * 0.35) };
      case "cat":
        return { pos: V3(sx * 0.07, 0.1, -5e-3), rot: E(0, 0, -sx * 0.3) };
      case "bunny":
        return { pos: V3(sx * 0.04, 0.1, -0.01), rot: E(0, 0, -sx * 0.15) };
    }
    return { pos: V3(), rot: E() };
  }
  function tailParts(sp) {
    const g = geo();
    switch (sp.tail) {
      case "tanuki":
        return [{ geo: g.s, color: sp.fur, pos: V3(0.05, 0, 0), scale: V3(0.06, 0.04, 0.04) }, { geo: g.s, color: sp.dark, pos: V3(0.1, 0, 0), scale: V3(0.035, 0.032, 0.032) }];
      case "fox":
        return [{ geo: g.s, color: sp.fur, pos: V3(0.07, 0.02, 0), scale: V3(0.08, 0.04, 0.04) }, { geo: g.s, color: sp.light, pos: V3(0.14, 0.03, 0), scale: V3(0.035, 0.03, 0.03) }];
      case "cat":
        return [{ geo: g.cap, color: sp.fur, pos: V3(0.05, 0.03, 0), scale: V3(0.012, 0.04, 0.012), rot: E(0, 0, -1) }, { geo: g.s, color: sp.dark, pos: V3(0.095, 0.075, 0), scale: V3(0.015, 0.015, 0.015) }];
      case "bunny":
        return [{ geo: g.s, color: "#ffffff", pos: V3(0.02, 0, 0), scale: V3(0.03, 0.03, 0.03) }];
    }
    return [];
  }
  var Customer = class {
    constructor(sp, mats, sfx) {
      const g = geo();
      this.sp = sp;
      this.sfx = sfx;
      this.root = new THREE.Group();
      this.root.position.copy(L.customer);
      const M = (geom, mat = mats.body) => {
        const m = new THREE.Mesh(geom, mat);
        return m;
      };
      this.own = [];
      const own = (geom) => {
        this.own.push(geom);
        return geom;
      };
      this.body = new THREE.Group();
      this.root.add(this.body);
      this.body.add(M(own(mergeColored([
        { geo: g.s, color: sp.fur, pos: V3(0, 0.05, 0), scale: V3(0.135, 0.13, 0.11) },
        { geo: g.s, color: sp.light, pos: V3(0, 0.055, 0.07), scale: V3(0.09, 0.1, 0.045) }
      ]))));
      this.head = new THREE.Group();
      this.head.position.set(0, 0.29, 0.01);
      this.body.add(this.head);
      this.head.add(M(own(mergeColored(headParts(sp)))));
      this.ears = [-1, 1].map((sx) => {
        const p = earPlace(sp, sx);
        const e = M(own(mergeColored(earParts(sp, sx))));
        e.position.copy(p.pos);
        e.rotation.copy(p.rot);
        e.userData.baseZ = p.rot.z;
        this.head.add(e);
        return e;
      });
      this.eyes = [-1, 1].map((sx) => {
        const e = M(own(mergeColored([
          { geo: g.s, color: "#22170f", scale: V3(0.016, 0.019, 0.01) },
          { geo: g.ss, color: "#ffffff", pos: V3(5e-3, 7e-3, 8e-3), scale: V3(55e-4, 55e-4, 4e-3) }
        ])), mats.eye);
        e.position.set(sx * 0.045, 0.012, 0.103);
        this.head.add(e);
        return e;
      });
      this.happyEyes = M(own(mergeColored([-1, 1].map((sx) => ({ geo: g.arc, color: "#2a1d16", pos: V3(sx * 0.045, 4e-3, 0.106), scale: V3(0.016, 0.016, 0.016) })))));
      this.happyEyes.visible = false;
      this.head.add(this.happyEyes);
      this.cheeks = M(own(mergeColored([-1, 1].map((sx) => ({ geo: g.s, color: sp.cheek, pos: V3(sx * 0.078, 0, 0), scale: V3(0.024, 0.016, 9e-3) })))));
      this.cheeks.position.set(0, -0.035, 0.087);
      this.head.add(this.cheeks);
      this.smile = M(own(mergeColored([{ geo: g.arc, color: "#7a2b2b", scale: V3(0.012, 0.012, 0.012), rot: E(0, 0, Math.PI) }])));
      this.smile.position.set(0, -0.052, 0.123);
      this.smile.rotation.x = -0.3;
      this.head.add(this.smile);
      this.mouthO = M(own(mergeColored([{ geo: g.s, color: "#8a2a2a", scale: V3(0.012, 0.014, 6e-3) }])));
      this.mouthO.position.set(0, -0.056, 0.121);
      this.mouthO.visible = false;
      this.head.add(this.mouthO);
      this.mouth = new THREE.Object3D();
      this.mouth.position.set(0, -0.056, 0.13);
      this.head.add(this.mouth);
      this.paws = [-1, 1].map((sx) => {
        const p = M(own(mergeColored([{ geo: g.s, color: sp.light, scale: V3(0.034, 0.026, 0.04) }])));
        p.position.set(sx * 0.115, 0.02, 0.13);
        p.userData.base = p.position.clone();
        this.body.add(p);
        return p;
      });
      this.tail = new THREE.Group();
      this.tail.position.set(0.11, 0, -0.06);
      this.tail.rotation.y = -0.5;
      this.body.add(this.tail);
      this.tail.add(M(own(mergeColored(tailParts(sp)))));
      this.state = "gone";
      this.t = 0;
      this.time = Math.random() * 10;
      this.blinkT = 2;
      this.giggleT = 0;
      this.beckon = false;
      this.lookX = 0;
      this.root.visible = false;
    }
    setState(s) {
      this.state = s;
      this.t = 0;
      if (s === "enter") {
        this.root.visible = true;
      }
    }
    giggle() {
      this.giggleT = 0.6;
      if (this.sfx) this.sfx.play("giggle");
    }
    update(dt) {
      this.time += dt;
      this.t += dt;
      const t = this.time, st = this.state, k = this.t;
      let x = 0, y = 0, lean = 0, headX = 0, headZ = Math.sin(t * 0.7) * 0.05, eyeS = 1, happy = false, oMouth = false, cheek = 1, smileS = 1, wag = 1.5, wagAmp = 0.25;
      let pawUp = [0, 0];
      if (st === "enter") {
        const u = clamp(k / 1.1, 0, 1);
        x = (1 - smooth(u)) * 0.95;
        y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.06 * (1 - u * 0.4);
        if (u >= 1) this.setState("idle");
      } else if (st === "want") {
        lean = 0.12 * smooth(k / 0.4);
        eyeS = 1 + 0.25 * smooth(k / 0.3);
        headX = 0.12;
        wag = 5;
        wagAmp = 0.35;
      } else if (st === "eat") {
        lean = 0.18;
        headX = 0.32 + Math.sin(t * 13) * 0.03;
        oMouth = true;
        eyeS = 0.35;
        wag = 5;
        cheek = 1 + 0.35 * smooth((k - 1.2) / 0.3);
      } else if (st === "happy") {
        happy = true;
        smileS = 1.5;
        cheek = 1.25;
        wag = 10;
        wagAmp = 0.45;
        if (k < 1.4) y = Math.abs(Math.sin(k * Math.PI * 1.45)) * 0.055;
        pawUp = [0.05 * smooth(k / 0.3), 0.05 * smooth(k / 0.3)];
        headZ = Math.sin(t * 5) * 0.08;
      } else if (st === "leave") {
        happy = true;
        smileS = 1.3;
        if (k < 0.8) pawUp = [0, 0.06 + Math.sin(k * 18) * 0.02];
        const u = clamp((k - 0.8) / 1, 0, 1);
        x = -smooth(u) * 0.95;
        y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.06;
        if (u >= 1) {
          this.root.visible = false;
          this.state = "gone";
        }
      } else if (st === "idle") {
        headX = 0.04;
        if (this.beckon) {
          pawUp = [0, 0.04 + Math.sin(t * 9) * 0.025];
          wag = 4;
        }
      }
      if (this.giggleT > 0) {
        this.giggleT -= dt;
        const g = this.giggleT / 0.6;
        happy = true;
        headZ += Math.sin(g * 30) * 0.12 * g;
        this.body.scale.set(1 + 0.06 * g, 1 - 0.07 * g, 1);
      } else this.body.scale.set(1, 1 + Math.sin(t * 2.2) * 0.012, 1);
      this.blinkT -= dt;
      let blink = 1;
      if (this.blinkT < 0) {
        blink = 0.12;
        if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 2.5;
      }
      this.root.position.set(L.customer.x + x, L.customer.y + y, L.customer.z);
      this.body.rotation.x = damp(this.body.rotation.x, lean, 8, dt);
      this.head.rotation.x = damp(this.head.rotation.x, headX, 8, dt);
      this.head.rotation.z = damp(this.head.rotation.z, headZ, 10, dt);
      this.head.rotation.y = damp(this.head.rotation.y, clamp(this.lookX * 0.6, -0.35, 0.35), 3, dt);
      for (const e of this.eyes) {
        e.visible = !happy;
        e.scale.set(eyeS, eyeS * blink, eyeS);
      }
      this.happyEyes.visible = happy;
      this.mouthO.visible = oMouth;
      this.smile.visible = !oMouth;
      this.smile.scale.setScalar(smileS);
      const ch = damp(this.cheeks.scale.x, cheek, 10, dt);
      this.cheeks.scale.set(ch, ch, 1);
      this.ears.forEach((e, i) => {
        e.rotation.z = e.userData.baseZ + Math.sin(t * 3 + i) * 0.04 + (happy ? Math.sin(t * 14 + i * 3) * 0.08 : 0);
      });
      this.paws.forEach((p, i) => {
        p.position.y = damp(p.position.y, p.userData.base.y + pawUp[i], 14, dt);
      });
      this.tail.rotation.z = Math.sin(t * wag) * wagAmp;
    }
    dispose() {
      this.root.parent && this.root.parent.remove(this.root);
      for (const g of this.own) g.dispose();
    }
  };
  var Customers = class {
    constructor(scene, sfx) {
      this.scene = scene;
      this.sfx = sfx;
      this.mats = { body: new THREE.MeshLambertMaterial({ vertexColors: true }), eye: new THREE.MeshPhongMaterial({ vertexColors: true, specular: "#ffffff", shininess: 90 }) };
      this.index = -1;
      this.current = null;
      this.leaving = null;
      this.gifts = [];
      this.giftGeo = {};
      this.maxGifts = 8;
    }
    next() {
      if (this.current) this.leaving = this.current;
      this.index++;
      const sp = SPECIES[this.index % SPECIES.length];
      this.current = new Customer(sp, this.mats, this.sfx);
      this.scene.add(this.current.root);
      this.current.setState("enter");
      if (this.sfx) this.sfx.play("hop");
      return this.current;
    }
    addGift() {
      const sp = this.current.sp;
      if (!this.giftGeo[sp.id]) {
        const parts = headParts(sp, { happy: true });
        for (const sx of [-1, 1]) {
          const p = earPlace(sp, sx);
          for (const q of earParts(sp, sx)) {
            const m2 = new THREE.Matrix4().compose(p.pos, new THREE.Quaternion().setFromEuler(p.rot), new THREE.Vector3(1, 1, 1));
            const local = new THREE.Matrix4().compose(q.pos || V3(), new THREE.Quaternion().setFromEuler(q.rot || E()), q.scale || V3(1, 1, 1));
            m2.multiply(local);
            const pos = V3(), quat = new THREE.Quaternion(), scl = V3();
            m2.decompose(pos, quat, scl);
            parts.push({ geo: q.geo, color: q.color, pos, rot: new THREE.Euler().setFromQuaternion(quat), scale: scl });
          }
        }
        parts.push({ geo: geo().s, color: "#d8c2a0", pos: V3(0, -0.115, 0), scale: V3(0.1, 0.02, 0.1) });
        this.giftGeo[sp.id] = mergeColored(parts);
      }
      const m = new THREE.Mesh(this.giftGeo[sp.id], this.mats.body);
      m.scale.setScalar(0.42);
      if (this.gifts.length >= this.maxGifts) {
        const old = this.gifts.shift();
        this.scene.remove(old);
      }
      this.gifts.forEach((g, i) => g.position.x = L.giftShelf.start.x + i * L.giftShelf.step);
      m.position.set(L.giftShelf.start.x + this.gifts.length * L.giftShelf.step, L.giftShelf.start.y + 0.05, L.giftShelf.start.z);
      m.rotation.y = 0.25;
      m.userData.pop = 0;
      this.gifts.push(m);
      this.scene.add(m);
      return m.position;
    }
    update(dt) {
      if (this.current) this.current.update(dt);
      if (this.leaving) {
        this.leaving.update(dt);
        if (this.leaving.state === "gone") {
          this.leaving.dispose();
          this.leaving = null;
        }
      }
      for (const g of this.gifts) if (g.userData.pop < 1) {
        g.userData.pop = Math.min(1, g.userData.pop + dt * 3);
        const s = 0.42 * (1 + Math.sin(g.userData.pop * Math.PI) * 0.4) * smooth(g.userData.pop * 2);
        g.scale.setScalar(Math.max(1e-3, s));
      }
    }
    dispose() {
      if (this.current) this.current.dispose();
      if (this.leaving) this.leaving.dispose();
      for (const g of Object.values(this.giftGeo)) g.dispose();
      for (const g of this.gifts) this.scene.remove(g);
      this.mats.body.dispose();
      this.mats.eye.dispose();
    }
  };

  // app/shell/input.js
  var Pointer = class {
    constructor(el) {
      this.el = el;
      this.id = null;
      this.events = [];
      this.x = 0;
      this.y = 0;
      this.down = false;
      const push = (type, e) => {
        const r = el.getBoundingClientRect();
        this.x = e.clientX - r.left;
        this.y = e.clientY - r.top;
        const last = this.events[this.events.length - 1];
        if (type === "move" && last && last.type === "move") {
          last.x = this.x;
          last.y = this.y;
          return;
        }
        this.events.push({ type, x: this.x, y: this.y, w: r.width, h: r.height });
      };
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (this.id !== null) return;
        this.id = e.pointerId;
        this.down = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {
        }
        push("down", e);
      });
      el.addEventListener("pointermove", (e) => {
        if (e.pointerId === this.id) {
          e.preventDefault();
          push("move", e);
        }
      });
      const up = (e) => {
        if (e.pointerId !== this.id) return;
        push("up", e);
        this.id = null;
        this.down = false;
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("lostpointercapture", up);
      const stop = (e) => e.preventDefault();
      for (const t of ["touchstart", "touchmove", "touchend", "gesturestart", "gesturechange", "dblclick", "contextmenu"]) {
        el.addEventListener(t, stop, { passive: false });
      }
      document.addEventListener("gesturestart", stop, { passive: false });
    }
    drain() {
      const e = this.events;
      this.events = [];
      return e;
    }
    cancel() {
      if (this.id !== null) {
        this.events.push({ type: "up", x: this.x, y: this.y, w: this.el.clientWidth, h: this.el.clientHeight });
        this.id = null;
        this.down = false;
      }
    }
  };

  // app/shell/audio.js
  var Sfx = class {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.stretchOsc = null;
      this.stretchGain = null;
      this.stretchUntil = 0;
      this.muted = false;
    }
    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          const comp = this.ctx.createDynamicsCompressor();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.7;
          this.master.connect(comp);
          comp.connect(this.ctx.destination);
          const n = this.ctx.sampleRate;
          this.noiseBuf = this.ctx.createBuffer(1, n, n);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state !== "running") this.ctx.resume();
      } catch (e) {
        console.warn("[udon] audio", e);
      }
    }
    suspend() {
      if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
    }
    get ok() {
      return this.ctx && this.ctx.state === "running" && !this.muted;
    }
    tone(f0, f1, dur, { type = "sine", gain = 0.3, at = 0, vib = 0, vibHz = 0 } = {}) {
      const c = this.ctx, t = c.currentTime + at;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.015, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      if (vib > 0) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = vibHz;
        lg.gain.value = vib;
        l.connect(lg);
        lg.connect(o.frequency);
        l.start(t);
        l.stop(t + dur + 0.02);
      }
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    noise(dur, { type = "lowpass", f0 = 1e3, f1 = 1e3, q = 1, gain = 0.3, at = 0, trem = 0 } = {}) {
      const c = this.ctx, t = c.currentTime + at;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      let out = g;
      if (trem > 0) {
        const tg = c.createGain();
        tg.gain.value = 0.6;
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = trem;
        lg.gain.value = 0.4;
        l.connect(lg);
        lg.connect(tg.gain);
        l.start(t);
        l.stop(t + dur + 0.02);
        g.connect(tg);
        out = tg;
      }
      s.connect(f);
      f.connect(g);
      out.connect(this.master);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    }
    play(name, p = {}) {
      if (!this.ok) return;
      try {
        this._play(name, p);
      } catch (e) {
        console.warn("[udon] sfx", name, e);
      }
    }
    _play(name, p) {
      const r = Math.random;
      switch (name) {
        case "munyu":
          this.tone(280, 150, 0.16, { gain: 0.3 });
          this.noise(0.08, { f0: 700, f1: 300, gain: 0.12 });
          break;
        case "boyon":
          this.tone(520, 230, 0.34, { gain: 0.28, vib: 40, vibHz: 16 });
          break;
        case "goro":
          this.noise(0.14, { f0: 320, f1: 200, gain: 0.25 });
          this.tone(95, 80, 0.1, { gain: 0.15, type: "triangle" });
          break;
        case "ton":
          this.noise(0.05, { type: "bandpass", f0: 1900, f1: 1500, q: 2, gain: 0.35 });
          this.tone(190, 90, 0.08, { type: "triangle", gain: 0.4 });
          break;
        case "suton":
          this.tone(760, 600, 0.05, { gain: 0.12, at: 0.02 });
          break;
        case "pick":
          this.tone(420, 720, 0.13, { gain: 0.22 });
          break;
        case "grab":
          this.tone(520, 680, 0.06, { gain: 0.16 });
          break;
        case "putdown":
          this.tone(320, 220, 0.07, { gain: 0.16 });
          break;
        case "splash":
          this.noise(0.45, { f0: 2400, f1: 400, gain: 0.35 });
          this.tone(210, 80, 0.22, { gain: 0.25 });
          break;
        case "bubble":
          this.tone(500 + r() * 400, 900 + r() * 400, 0.06, { gain: 0.05 });
          break;
        case "swirl":
          this.noise(0.25, { type: "bandpass", f0: 600, f1: 900, q: 1.2, gain: 0.07 });
          break;
        case "scoop":
          this.noise(0.32, { type: "bandpass", f0: 1300, f1: 500, q: 1, gain: 0.3 });
          break;
        case "drop":
          this.tone(300, 120, 0.18, { gain: 0.3 });
          this.noise(0.15, { f0: 900, f1: 300, gain: 0.15 });
          break;
        case "broth":
          this.noise(0.6, { f0: 900, f1: 500, gain: 0.08 });
          break;
        case "pon":
          this.tone(600, 980, 0.09, { gain: 0.32 });
          this.tone(980, 760, 0.08, { gain: 0.12, at: 0.08 });
          break;
        case "nope":
          this.tone(400, 380, 0.08, { gain: 0.12 });
          this.tone(380, 400, 0.08, { gain: 0.12, at: 0.1 });
          break;
        case "slide":
          this.noise(0.5, { f0: 600, f1: 300, gain: 0.12 });
          break;
        case "zuzu":
          this.noise(1.5, { type: "bandpass", f0: 800, f1: 1700, q: 1.5, gain: 0.32, trem: 9 });
          break;
        case "mogu":
          for (let i = 0; i < 3; i++) this.tone(300, 200, 0.07, { gain: 0.18, at: i * 0.16 });
          break;
        case "happy":
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.26, { type: "triangle", gain: 0.22, at: i * 0.11 }));
          break;
        case "kira":
          for (let i = 0; i < 3; i++) this.tone(1700 + r() * 800, 2400 + r() * 600, 0.08, { gain: 0.08, at: i * 0.07 });
          break;
        case "giggle":
          this.tone(880, 1180, 0.08, { gain: 0.15 });
          this.tone(960, 1300, 0.08, { gain: 0.15, at: 0.11 });
          break;
        case "hop":
          this.tone(260, 520, 0.15, { gain: 0.25 });
          break;
        case "poyon":
          this.tone(220, 140, 0.25, { gain: 0.3, vib: 25, vibHz: 12 });
          break;
        default:
          break;
      }
    }
    // 引っ張っている間ずっと鳴る「びよーん」。amount で音の高さが上がる
    stretch(amount) {
      if (!this.ok) return;
      const c = this.ctx, t = c.currentTime;
      if (!this.stretchOsc) {
        const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
        o.type = "sine";
        l.frequency.value = 7;
        lg.gain.value = 12;
        l.connect(lg);
        lg.connect(o.frequency);
        g.gain.setValueAtTime(1e-4, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        l.start(t);
        this.stretchOsc = o;
        this.stretchGain = g;
        this.stretchLfo = l;
      }
      this.stretchOsc.frequency.setTargetAtTime(220 + amount * 520, t, 0.04);
      this.stretchUntil = t + 0.3;
    }
    stretchEnd() {
      if (!this.stretchOsc || !this.ctx) return;
      const t = this.ctx.currentTime;
      this.stretchGain.gain.setTargetAtTime(1e-4, t, 0.05);
      this.stretchOsc.stop(t + 0.3);
      this.stretchLfo.stop(t + 0.3);
      this.stretchOsc = null;
    }
    update() {
      if (this.stretchOsc && this.ctx.currentTime > this.stretchUntil) this.stretchEnd();
    }
  };

  // app/shell/fx.js
  var VERT = (
    /* glsl */
    `
attribute float aAlpha;
varying vec2 vUv; varying float vA; varying vec3 vC;
void main() {
  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float s = length(instanceMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
  vUv = uv; vA = aAlpha;
#ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
#else
  vC = vec3(1.0);
#endif
}`
  );
  var FRAG = (
    /* glsl */
    `
uniform sampler2D map;
varying vec2 vUv; varying float vA; varying vec3 vC;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vC * t.rgb, t.a * clamp(vA, 0.0, 1.0));
  if (gl_FragColor.a < 0.004) discard;
  #include <colorspace_fragment>
}`
  );
  var Pool = class {
    constructor(tex, max, additive) {
      const geo2 = new THREE.PlaneGeometry(1, 1);
      this.alpha = new Float32Array(max);
      geo2.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(this.alpha, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      this.mesh = new THREE.InstancedMesh(geo2, mat, max);
      this.mesh.frustumCulled = false;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      this.mesh.renderOrder = 10;
      this.max = max;
      this.p = [];
      for (let i = 0; i < max; i++) this.p.push({ on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.02, grow: 0, g: 0, a: 1, sway: 0, ph: 0, color: new THREE.Color() });
      this.m = new THREE.Matrix4();
      this.count = 0;
    }
    spawn(pos, vel, o) {
      let q = this.p.find((x) => !x.on);
      if (!q) q = this.p.reduce((a, b) => a.age / a.life > b.age / b.life ? a : b);
      q.on = true;
      q.pos.copy(pos);
      q.vel.copy(vel);
      q.age = 0;
      q.life = o.life || 1;
      q.size = o.size || 0.02;
      q.grow = o.grow || 0;
      q.g = o.g || 0;
      q.a = o.alpha == null ? 1 : o.alpha;
      q.sway = o.sway || 0;
      q.ph = Math.random() * 6.28;
      q.color.set(o.color || "#ffffff");
      return q;
    }
    update(dt) {
      let n = 0;
      for (const q of this.p) {
        if (!q.on) continue;
        q.age += dt;
        if (q.age >= q.life) {
          q.on = false;
          continue;
        }
        q.vel.y -= q.g * dt;
        q.pos.addScaledVector(q.vel, dt);
        if (q.sway) q.pos.x += Math.sin(q.age * 4 + q.ph) * q.sway * dt;
        const k = q.age / q.life;
        const s = Math.max(1e-4, q.size + q.grow * q.age);
        this.m.makeScale(s, s, s);
        this.m.setPosition(q.pos);
        this.mesh.setMatrixAt(n, this.m);
        this.mesh.setColorAt(n, q.color);
        this.alpha[n] = q.a * Math.min(1, k * 6) * (1 - k * k);
        n++;
      }
      this.count = n;
      this.mesh.count = n;
      this.mesh.visible = n > 0;
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
    }
  };
  var Fx = class {
    constructor(scene, bank, tierFx, soft) {
      const spark = bank.canvas("fx-sparkle", 64, 64, drawSparkle);
      const heart = bank.canvas("fx-heart", 64, 64, drawHeart);
      this.scale = tierFx;
      this.soft = new Pool(soft, Math.round(28 * tierFx) + 4, false);
      this.spark = new Pool(spark, Math.round(40 * tierFx) + 6, true);
      this.heart = new Pool(heart, 8, false);
      for (const p of [this.soft, this.spark, this.heart]) scene.add(p.mesh);
      this.v = new THREE.Vector3();
      this.w = new THREE.Vector3();
      this.steamRate = 0;
      this.steamAcc = 0;
      this.steamAt = new THREE.Vector3();
      this.steamR = 0.1;
      this.bubbleRate = 0;
      this.bubbleAcc = 0;
      this.bubbleY = 0;
      this.onBubble = null;
    }
    sparkle(pos, n = 8, color = "#fff6b0", spread = 0.35) {
      n = Math.max(2, Math.round(n * this.scale));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, u = Math.random() * 0.8 + 0.2;
        this.v.set(Math.cos(a) * spread * u, 0.25 + Math.random() * 0.35, Math.sin(a) * spread * u * 0.6);
        this.spark.spawn(pos, this.v, { life: 0.6 + Math.random() * 0.4, size: 0.022 + Math.random() * 0.02, grow: -0.02, g: 0.6, color });
      }
    }
    puff(pos, n = 5) {
      n = Math.max(2, Math.round(n * this.scale));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.v.set(Math.cos(a) * 0.08, 0.05 + Math.random() * 0.08, Math.sin(a) * 0.08);
        this.soft.spawn(pos, this.v, { life: 0.6, size: 0.02, grow: 0.06, color: "#fffaf0", alpha: 0.7 });
      }
    }
    hearts(pos, n = 3) {
      for (let i = 0; i < n; i++) {
        this.w.copy(pos);
        this.w.x += (i - (n - 1) / 2) * 0.09;
        this.w.y += Math.random() * 0.03;
        this.v.set((i - (n - 1) / 2) * 0.03, 0.16 + Math.random() * 0.06, 0.02);
        const q = this.heart.spawn(this.w, this.v, { life: 1.8, size: 0.055, grow: 0.015, color: i % 2 ? "#ff7aa8" : "#ff9cc0", sway: 0.05 });
        q.age = -i * 0.18;
      }
    }
    setSteam(at, radius, rate) {
      this.steamAt.copy(at);
      this.steamR = radius;
      this.steamRate = rate;
    }
    setBubbles(rate, y) {
      this.bubbleRate = rate;
      this.bubbleY = y;
    }
    update(dt) {
      this.steamAcc += dt * this.steamRate * this.scale;
      while (this.steamAcc > 1) {
        this.steamAcc -= 1;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.steamR;
        this.w.set(this.steamAt.x + Math.cos(a) * r, this.steamAt.y + 0.01, this.steamAt.z + Math.sin(a) * r);
        this.v.set(0, 0.07 + Math.random() * 0.04, 0);
        this.soft.spawn(this.w, this.v, { life: 2.2, size: 0.05, grow: 0.06, color: "#ffffff", alpha: 0.22, sway: 0.03 });
      }
      this.bubbleAcc += dt * this.bubbleRate * this.scale;
      while (this.bubbleAcc > 1) {
        this.bubbleAcc -= 1;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.steamR * 0.9;
        this.w.set(this.steamAt.x + Math.cos(a) * r, this.bubbleY + 2e-3, this.steamAt.z + Math.sin(a) * r);
        this.v.set(0, 0.01, 0);
        this.soft.spawn(this.w, this.v, { life: 0.45, size: 8e-3, grow: 0.03, color: "#ffffff", alpha: 0.8 });
        if (this.onBubble && Math.random() < 0.3) this.onBubble();
      }
      for (const p of [this.soft, this.spark]) p.update(dt);
      this.heart.update(dt);
    }
    stats() {
      return {
        draw: [this.soft, this.spark, this.heart].filter((p) => p.count > 0).length,
        tri: (this.soft.count + this.spark.count + this.heart.count) * 2
      };
    }
  };

  // app/shell/flow.js
  var TOP = L.board.center.y;
  var HINT_DELAY = 4;
  var CAM_DUR = 1.6;
  var MAX_PER_TOPPING = 3;
  var HOLD_ABOVE = 0.2;
  var TAP_TIME = 0.35;
  var V32 = () => new THREE.Vector3();
  var Flow = class {
    constructor({ world, hero, customers, fx, sfx, camera, pointer }) {
      this.w = world;
      this.o = world.objs;
      this.hero = hero;
      this.cust = customers;
      this.fx = fx;
      this.sfx = sfx;
      this.camera = camera;
      this.pointer = pointer;
      this.raycaster = new THREE.Raycaster();
      this.ndc = new THREE.Vector2();
      this.time = 0;
      this.mode = "play";
      this.round = 0;
      this.grab = null;
      this.lastTouch = -HINT_DELAY + 1.2;
      this.hint = null;
      this.hintT = 0;
      this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.tmp = V32();
      this.tmp2 = V32();
      this.tmp3 = V32();
      this.hin = {
        time: 0,
        pointer: { phase: "none", active: false, part: null, hitPoint: V32(), boardPoint: V32(), ray: new THREE.Ray() },
        chops: [],
        pin: { active: false, center: V32(), radius: L.pin.radius, length: L.pin.length, dz: 0 },
        stir: { active: false, point: V32(), velocity: V32() },
        hold: V32(),
        net: V32(),
        netInWater: false
      };
      this._chopPool = [V32(), V32(), V32()];
      this.knife = { pos: L.knifeRest.clone(), target: L.knifeRest.clone(), up: 0, onBoard: false, chopT: -1, lastChopX: null, lastChopTime: -1, hover: 0.05, hop: 0 };
      this.pin = { pos: L.pinRest.clone(), target: L.pinRest.clone(), angle: 0, prevZ: L.pinRest.z, hop: 0, ride: 0, auto: null };
      this.net = { pos: L.netRest.clone(), target: L.netRest.clone(), dwell: 0, hop: 0, auto: null };
      this.bowl = { pos: L.bowlRest.clone(), target: L.bowlRest.clone(), fill: 0, fillTarget: 0, toppings: [], counts: { negi: 0, kamaboko: 0, ebiten: 0, oage: 0 }, color: 0, wiggle: 0, hop: 0, serveFrom: V32() };
      this.flying = [];
      this.water = { omega: 0, swirlT: 0, prev: V32(), has: false };
      this.hold = { pos: V32(), init: false };
      this.cam = { from: null, to: "work", t: CAM_DUR, fov: { work: 45, serve: 45 }, targets: {}, pos: V32(), target: V32() };
      this.camScratch = new THREE.PerspectiveCamera();
      this.serveT = 0;
      this.served = null;
      this.stats = { serves: 0, cuts: 0 };
    }
    // ---------- カメラ ----------
    resize(aspect) {
      for (const k of ["work", "serve"]) this.cam.fov[k] = this.fitFov(L.camera[k], aspect, k);
      this.applyCamera(true);
    }
    // 決めた点が全部入る画角を求め、上下左右の余白がそろうよう注視点を少し回す
    fitFov(preset, aspect, key) {
      const c = this.camScratch;
      const target = (this.cam.targets[key] || (this.cam.targets[key] = new THREE.Vector3())).copy(preset.target);
      let need = 0.2;
      for (let it = 0; it < 3; it++) {
        c.position.copy(preset.pos);
        c.lookAt(target);
        c.updateMatrixWorld(true);
        const inv = c.matrixWorldInverse.copy(c.matrixWorld).invert();
        let ymin = 9, ymax = -9, xmin = 9, xmax = -9;
        for (const p of preset.fit) {
          const q = this.tmp.copy(p).applyMatrix4(inv), d = Math.max(0.05, -q.z);
          ymin = Math.min(ymin, Math.atan2(q.y, d));
          ymax = Math.max(ymax, Math.atan2(q.y, d));
          xmin = Math.min(xmin, Math.atan2(q.x, d));
          xmax = Math.max(xmax, Math.atan2(q.x, d));
        }
        const tanY = Math.tan((ymax - ymin) / 2), tanX = Math.tan((xmax - xmin) / 2);
        need = Math.max(tanY, tanX / aspect);
        const dist = target.distanceTo(preset.pos);
        const ay = (ymax + ymin) / 2, ax = (xmax + xmin) / 2;
        this.tmp2.set(Math.tan(ax) * dist, Math.tan(ay) * dist, -dist).applyMatrix4(c.matrixWorld);
        target.copy(this.tmp2);
      }
      return clamp(2 * Math.atan(need * 1.05) * 180 / Math.PI, 26, 80);
    }
    goCamera(name) {
      if (this.cam.to === name) return;
      this.cam.from = { pos: this.camera.position.clone(), target: this.cam.target.clone(), fov: this.camera.fov };
      this.cam.to = name;
      this.cam.t = 0;
    }
    applyCamera(force, dt = 0) {
      const c = this.cam, P = L.camera[c.to];
      if (c.t < CAM_DUR && c.from) {
        c.t += dt;
        const e = easeInOut(c.t / CAM_DUR);
        this.camera.position.lerpVectors(c.from.pos, P.pos, e);
        c.target.lerpVectors(c.from.target, c.targets[c.to] || P.target, e);
        this.camera.fov = lerp(c.from.fov, c.fov[c.to], e);
      } else if (force || c.t >= CAM_DUR) {
        this.camera.position.copy(P.pos);
        c.target.copy(c.targets[c.to] || P.target);
        this.camera.fov = c.fov[c.to];
      }
      this.camera.lookAt(c.target);
      this.camera.updateProjectionMatrix();
    }
    // ---------- 入力 ----------
    setRay(ev) {
      this.ndc.set(ev.x / ev.w * 2 - 1, -(ev.y / ev.h) * 2 + 1);
      this.raycaster.setFromCamera(this.ndc, this.camera);
    }
    planeHit(y, out = this.tmp) {
      this.plane.constant = -y;
      const r = this.raycaster.ray.intersectPlane(this.plane, out);
      if (!r) out.set(0, y, 0);
      return out;
    }
    pick() {
      const list = [];
      for (const p of this.w.proxies) if (p.userData.enabled !== false) list.push(p);
      for (const p of this.hero.hitTargets) if (p.userData.enabled !== false) list.push(p);
      const hits = this.raycaster.intersectObjects(list, false);
      if (!hits.length) return null;
      const h = hits[0];
      return { kind: h.object.userData.kind || h.object.userData.heroPart, object: h.object, point: h.point.clone() };
    }
    handleEvents(dt) {
      const evs = this.pointer.drain();
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        this.setRay(ev);
        if (ev.type === "down") this.onDown(ev);
        else if (ev.type === "move") this.onMove(ev);
        else this.onUp(ev);
        if (ev.type === "down" && this.hin.pointer.phase === "down" && i + 1 < evs.length) {
          this.pointer.events.unshift(...evs.slice(i + 1));
          break;
        }
      }
      this.lastEv = this.lastEv || null;
    }
    onDown(ev) {
      this.sfx.unlock();
      this.lastTouch = this.time;
      this.setHint(null);
      this.lastEv = ev;
      const hit = this.pick();
      if (this.mode !== "play") {
        if (hit && hit.kind === "customer" && this.cust.current) this.cust.current.giggle();
        return;
      }
      if (!hit) return;
      const g = this.grab = { kind: hit.kind, data: hit.object.userData, point: hit.point, t0: this.time, sx: ev.x, sy: ev.y, moved: false, piece: null };
      const st = this.hero.getState();
      switch (hit.kind) {
        case "dough": {
          const hp = this.hin.pointer;
          hp.phase = "down";
          hp.active = true;
          hp.part = "dough";
          hp.hitPoint.copy(hit.point);
          this.planeHit(TOP, hp.boardPoint);
          hp.ray.copy(this.raycaster.ray);
          break;
        }
        case "noodles":
          if (st.place === "board") {
            this.hero.setPlace("hand");
            this.sfx.play("pick");
            this.hold.init = false;
            this.updateHold(0, true);
          } else this.grab = null;
          break;
        case "knife": {
          const k = this.knife, q = this.planeHit(TOP, this.tmp2);
          g.offX = clamp(k.target.x - q.x, -0.12, 0.12);
          g.offZ = clamp(k.target.z - q.z, -0.2, 0.2);
          this.sfx.play("grab");
          k.onBoard = false;
          k.step = 0;
          break;
        }
        case "pin":
          this.sfx.play("grab");
          this.pin.auto = null;
          break;
        case "net":
          this.sfx.play("grab");
          this.net.auto = null;
          break;
        case "dish":
          this.o.dishes[g.data.index].wig = 1;
          break;
        case "bowl":
          if (!this.servable()) {
            this.bowl.wiggle = 1;
            this.sfx.play("putdown");
            this.grab = null;
            if (st.place === "net") this.netAuto("deliver");
          } else this.sfx.play("grab");
          break;
        case "water":
          this.water.has = false;
          this.water.omega += this.water.omega >= 0 ? 1.2 : -1.2;
          this.fx.sparkle(hit.point, 4, "#e9fbff", 0.12);
          this.sfx.play("swirl");
          if (st.place === "board" && st.cutCount > 0 && !st.busy) this.hero.setPlace("pot");
          break;
        case "customer":
          if (this.servable()) this.serve();
          else if (this.cust.current) this.cust.current.giggle();
          this.grab = null;
          break;
        case "table":
          this.fx.puff(hit.point, 3);
          this.grab = null;
          break;
        default:
          this.grab = null;
      }
    }
    onMove(ev) {
      this.lastEv = ev;
      const g = this.grab;
      if (!g) return;
      if (!g.moved && Math.hypot(ev.x - g.sx, ev.y - g.sy) > 10) g.moved = true;
    }
    onUp(ev) {
      this.lastTouch = this.time;
      const g = this.grab;
      this.grab = null;
      if (!g) return;
      const st = this.hero.getState();
      const tap = !g.moved && this.time - g.t0 < TAP_TIME;
      switch (g.kind) {
        case "dough": {
          const hp = this.hin.pointer;
          hp.phase = "up";
          hp.active = false;
          this.planeHit(TOP, hp.boardPoint);
          break;
        }
        case "noodles": {
          if (st.place !== "hand") break;
          const where = tap ? "pot" : this.rayOver();
          this.hero.setPlace(where === "pot" ? "pot" : where === "bowl" ? "bowl" : "board");
          if (where !== "pot" && where !== "bowl") this.sfx.play("putdown");
          break;
        }
        case "knife": {
          const k = this.knife;
          if (tap && k.up > 0.5) {
            this.startChop();
            k.step = 0.018 + Math.random() * 0.016;
          }
          if (this.inBoard(k.target.x, k.target.z, 0)) {
            k.onBoard = true;
          } else {
            k.onBoard = false;
            k.target.copy(L.knifeRest);
            this.sfx.play("putdown");
          }
          if (tap && !k.onBoard) {
            const b = st.place === "board" && this.heroBounds();
            if (b) {
              k.target.set(b.x0 + 0.022, 0, clamp((b.z0 + b.z1) / 2 - 0.03, -0.26, 0.42));
              k.onBoard = true;
              k.hop = 1;
              this.sfx.play("grab");
            } else k.hop = 1;
          }
          break;
        }
        case "pin":
          this.pin.target.copy(L.pinRest);
          this.hin.pin.active = false;
          if (tap) {
            if (!this.pinAuto()) this.pin.hop = 1;
          }
          break;
        case "net":
          if (st.place === "net" && (this.rayOver() === "bowl" || this.whereOver(this.net.pos.x, this.net.pos.z) === "bowl")) this.hero.setPlace("bowl");
          this.net.target.copy(L.netRest);
          if (tap) {
            if (st.place === "pot") this.netAuto("scoop");
            else if (st.place === "net") this.netAuto("deliver");
            else this.net.hop = 1;
          }
          break;
        case "dish": {
          const type = g.data.type;
          if (g.piece) {
            if (this.rayOver() === "bowl" && this.bowl.counts[type] < MAX_PER_TOPPING) this.launchTopping(type, g.piece, true);
            else this.flyBack(g.piece, g.data.index);
          } else if (this.bowl.counts[type] < MAX_PER_TOPPING) {
            const piece = this.makePiece(type);
            piece.position.copy(this.o.dishes[g.data.index].base);
            piece.position.y += 0.02;
            this.launchTopping(type, piece, false);
          } else {
            this.o.dishes[g.data.index].wig = 1.5;
            this.sfx.play("hop");
          }
          break;
        }
        case "bowl":
          if (this.mode !== "play") break;
          if (tap && this.servable()) {
            this.serve();
            break;
          }
          this.bowl.target.copy(L.bowlRest);
          this.sfx.play("putdown");
          break;
        case "water":
          this.hin.stir.active = false;
          break;
      }
    }
    // ---------- 場所 ----------
    inBoard(x, z, m) {
      const b = L.board;
      return Math.abs(x - b.center.x) < b.sizeX / 2 + m && Math.abs(z - b.center.z) < b.sizeZ / 2 + m;
    }
    whereOver(x, z) {
      const P = L.pot.base, B = this.bowl.pos;
      if (Math.hypot(x - P.x, z - P.z) < L.pot.radius + 0.03) return "pot";
      if (Math.hypot(x - B.x, z - B.z) < L.bowl.outerR + 0.06) return "bowl";
      if (this.inBoard(x, z, 0.02)) return "board";
      return "counter";
    }
    surfaceAt(x, z) {
      const w = this.whereOver(x, z);
      return w === "pot" ? L.pot.stove + L.pot.height + 0.01 : w === "bowl" ? this.bowl.pos.y + L.bowl.height : w === "board" ? TOP : 0;
    }
    heroBounds() {
      for (const p of this.hero.hitTargets) {
        if (p.userData.enabled === false) continue;
        const q = p.position, s = p.scale;
        return { x0: q.x - s.x / 2, x1: q.x + s.x / 2, z0: q.z - s.z / 2, z1: q.z + s.z / 2, top: q.y + s.y / 2, part: p.userData.heroPart };
      }
      return null;
    }
    // 網が自分で動く（タップしたとき）：鍋に沈めてすくう／お椀の上へ運んで入れる
    netAuto(kind) {
      const P = L.pot.base, n = this.net, B = this.bowl.pos;
      if (kind === "scoop") {
        n.auto = { i: 0, t: 0, steps: [
          { p: new THREE.Vector3(P.x + 0.02, 0.27, P.z + 0.01), dur: 0.35 },
          { p: new THREE.Vector3(P.x + 0.02, L.pot.water - 0.035, P.z + 0.01), dur: 0.55, act: () => {
            if (this.hero.getState().place === "pot") this.hero.setPlace("net");
          } },
          { p: new THREE.Vector3(P.x + 0.02, 0.29, P.z + 0.01), dur: 0.45 },
          { p: L.netRest, dur: 0.3 }
        ] };
      } else {
        const top = B.y + L.bowl.height + 0.08;
        n.auto = { i: 0, t: 0, steps: [
          { p: new THREE.Vector3(B.x, top + 0.05, B.z - 0.02), dur: 0.6, act: () => {
            if (this.hero.getState().place === "net") this.hero.setPlace("bowl");
          } },
          { p: new THREE.Vector3(B.x, top + 0.05, B.z - 0.02), dur: 0.5 },
          { p: L.netRest, dur: 0.3 }
        ] };
      }
      this.sfx.play("grab");
    }
    // めん棒が自分で転がる（タップしたとき）：生地の奥へ → 手前へ → 置き場
    pinAuto() {
      const st = this.hero.getState(), b = this.heroBounds();
      if (st.place !== "board" || !b || b.part !== "dough") return false;
      const x = clamp((b.x0 + b.x1) / 2, L.board.center.x - 0.06, L.board.center.x + 0.06), bz = L.board;
      const zN = clamp(b.z1 + 0.03, bz.center.z - bz.sizeZ / 2 + 0.03, L.pinRest.z), zF = clamp(b.z0 + 0.01, bz.center.z - bz.sizeZ / 2 + 0.03, L.pinRest.z);
      this.pin.auto = { i: 0, t: 0, steps: [
        { p: new THREE.Vector3(x, 0, zN), dur: 0.35 },
        { p: new THREE.Vector3(x, 0, zF), dur: 0.7, roll: true },
        { p: new THREE.Vector3(x, 0, zN), dur: 0.7, roll: true },
        { p: L.pinRest, dur: 0.3 }
      ] };
      this.sfx.play("grab");
      return true;
    }
    stepAuto(o, dt) {
      const a = o.auto;
      if (!a) return null;
      const s = a.steps[a.i];
      o.target.copy(s.p);
      a.t += dt;
      if (a.t >= s.dur) {
        if (s.act) s.act();
        a.i++;
        a.t = 0;
        if (a.i >= a.steps.length) o.auto = null;
      }
      return s;
    }
    servable() {
      return this.hero.getState().place === "bowl" || this.bowl.toppings.length > 0;
    }
    // ---------- 毎フレーム ----------
    update(dt) {
      this.time += dt;
      this.handleEvents(dt);
      const st = this.hero.getState();
      const g = this.grab;
      const hin = this.hin;
      hin.time = this.time;
      if (g) {
        if (g.kind === "dough") {
          const hp = hin.pointer;
          if (hp.phase === "none") hp.phase = "move";
          this.planeHit(TOP, hp.boardPoint);
          hp.ray.copy(this.raycaster.ray);
        } else if (g.kind === "noodles") this.updateHold(dt, false);
        else if (g.kind === "knife") this.dragKnife(dt, g);
        else if (g.kind === "pin") this.dragPin(g);
        else if (g.kind === "net") this.dragNet(dt, st);
        else if (g.kind === "dish") this.dragTopping(g);
        else if (g.kind === "bowl") this.dragBowl();
        else if (g.kind === "water") this.stir(dt);
      }
      if (!g || g.kind !== "water") {
        hin.stir.active = false;
      }
      if (!g || g.kind !== "pin") hin.pin.active = false;
      this.animateTools(dt, st);
      this.animateToppings(dt);
      this.updatePot(dt, st);
      this.o.bowl.updateMatrixWorld(true);
      if (this.cust.current) this.cust.current.root.updateMatrixWorld(true);
      hin.net.copy(this.net.pos);
      const P = L.pot.base;
      hin.netInWater = Math.hypot(this.net.pos.x - P.x, this.net.pos.z - P.z) < L.pot.inner * 0.85 && this.net.pos.y < L.pot.water;
      this.hero.update(dt, hin);
      hin.pointer.phase = "none";
      hin.chops.length = 0;
      hin.pin.dz = 0;
      if (!hin.pointer.active) hin.pointer.part = null;
      if (this.mode === "serving") this.updateServe(dt);
      this.updateHint(dt);
      if (this.cust.current) this.cust.current.lookX = g ? this.lastEv ? this.lastEv.x / this.lastEv.w - 0.5 : 0 : (st.center.x - L.customer.x) * 0.8;
      this.applyCamera(false, dt);
    }
    // 指の光線が今どの物の上にあるか（物の高さの面で判定する）
    rayOver() {
      const P = L.pot.base, B = this.bowl.pos, q = this.tmp3;
      this.planeHit(L.pot.water, q);
      if (Math.hypot(q.x - P.x, q.z - P.z) < L.pot.radius + 0.03) return "pot";
      this.planeHit(B.y + L.bowl.height * 0.7, q);
      if (Math.hypot(q.x - B.x, q.z - B.z) < L.bowl.outerR + 0.05) return "bowl";
      this.planeHit(TOP, q);
      if (this.inBoard(q.x, q.z, 0.02)) return "board";
      return "counter";
    }
    // 麺の束をつまむ点：指の下、下にある物の 0.16 上（束が指からぶら下がって見える）
    updateHold(dt, snap) {
      const w = this.rayOver();
      const base = w === "pot" ? L.pot.stove + L.pot.height : w === "bowl" ? this.bowl.pos.y + L.bowl.height : TOP;
      const p = this.planeHit(base + HOLD_ABOVE, this.tmp2);
      this.tmp2.set(clamp(p.x, -0.75, 0.8), p.y, clamp(p.z, -0.28, 0.44));
      if (snap || !this.hold.init) {
        this.hold.pos.copy(this.tmp2);
        this.hold.init = true;
      } else dampV(this.hold.pos, this.tmp2, 22, dt);
      this.hin.hold.copy(this.hold.pos);
    }
    dragKnife(dt, g) {
      const k = this.knife;
      const p = this.planeHit(TOP, this.tmp2);
      k.target.set(clamp(p.x + (g.offX || 0), -0.62, 0.78), 0, clamp(p.z + (g.offZ == null ? -0.03 : g.offZ), -0.26, 0.42));
      if (g.moved && k.up > 0.8 && k.chopT < 0 && this.inBoard(k.pos.x, k.pos.z, -0.01) && this.time - k.lastChopTime >= 0.15 && (k.lastChopX === null || Math.abs(k.pos.x - k.lastChopX) >= 0.01)) this.startChop();
    }
    startChop() {
      const k = this.knife;
      if (k.chopT >= 0) return;
      k.chopT = 0;
      k.chopX = k.pos.x;
      k.lastChopX = k.pos.x;
      k.lastChopTime = this.time;
    }
    dragPin(g) {
      const r = L.pin.radius, b = L.board;
      const p = this.planeHit(TOP + r, this.tmp2);
      this.pin.target.set(clamp(p.x, b.center.x - 0.06, b.center.x + 0.06), 0, clamp(p.z, b.center.z - b.sizeZ / 2 + 0.03, L.pinRest.z));
      const pi = this.hin.pin;
      pi.active = this.inBoard(this.pin.pos.x, this.pin.pos.z, -0.02);
      pi.center.copy(this.pin.pos);
    }
    dragNet(dt, st) {
      const n = this.net;
      const w = this.rayOver();
      const y = w === "pot" ? L.pot.water - 0.035 : w === "board" ? TOP + 0.05 : w === "bowl" ? this.bowl.pos.y + L.bowl.height + 0.06 : 0.22;
      const p = this.planeHit(w === "pot" ? L.pot.water : y, this.tmp2);
      n.target.set(clamp(p.x, -0.6, 0.8), y, clamp(p.z, -0.28, 0.44));
      if (st.place === "pot" && this.hin.netInWater) {
        n.dwell += dt;
        if (n.dwell > 0.15) {
          this.hero.setPlace("net");
          n.dwell = 0;
        }
      } else n.dwell = 0;
      if (st.place === "board" && !st.busy && Math.hypot(n.pos.x - st.center.x, n.pos.z - st.center.z) < 0.12 && n.pos.y < TOP + 0.09) this.hero.setPlace("net");
    }
    dragTopping(g) {
      if (!g.moved) return;
      if (!g.piece) {
        if (this.bowl.counts[g.data.type] >= MAX_PER_TOPPING) {
          this.o.dishes[g.data.index].wig = 1.5;
          return;
        }
        g.piece = this.makePiece(g.data.type);
        this.sfx.play("pick");
      }
      const p = this.planeHit(0.05, this.tmp2);
      g.piece.position.set(clamp(p.x, -0.7, 0.8), 0.1, clamp(p.z, -0.28, 0.44));
      g.piece.rotation.y += 0.02;
    }
    dragBowl() {
      const p = this.planeHit(0, this.tmp2);
      this.bowl.target.set(clamp(p.x, -0.6, 0.75), 0, clamp(p.z, -0.4, 0.4));
      if (this.bowl.pos.z < L.counter.minZ + 0.04) {
        this.grab = null;
        this.serve();
      }
    }
    stir(dt) {
      const p = this.planeHit(L.pot.water, this.tmp2), s = this.hin.stir, w = this.water, P = L.pot.base;
      if (w.has && dt > 0) {
        s.velocity.subVectors(p, w.prev).divideScalar(Math.max(dt, 1 / 120));
        const rx = p.x - P.x, rz = p.z - P.z, r = Math.max(0.03, Math.hypot(rx, rz));
        const tang = (rx * s.velocity.z - rz * s.velocity.x) / r;
        w.omega = clamp(w.omega + tang / r * dt * 1.5, -3, 3);
        w.swirlT -= dt;
        if (w.swirlT < 0 && s.velocity.length() > 0.1) {
          this.sfx.play("swirl");
          w.swirlT = 0.3;
        }
      } else s.velocity.set(0, 0, 0);
      w.prev.copy(p);
      w.has = true;
      s.active = true;
      s.point.copy(p);
    }
    // ---------- 道具の動き ----------
    animateTools(dt, st) {
      const k = this.knife, o = this.o;
      const grabbing = this.grab && this.grab.kind === "knife";
      const upT = grabbing || k.onBoard ? 1 : 0;
      k.up = damp(k.up, upT, 14, dt);
      if (!grabbing && !k.onBoard) k.target.copy(L.knifeRest);
      const overBoard = this.inBoard(k.pos.x, k.pos.z, 0.01);
      const base = overBoard ? TOP : 0;
      const hover = base + (k.up > 0.5 ? 0.05 : 2e-3);
      k.pos.x = damp(k.pos.x, k.target.x, 25, dt);
      k.pos.z = damp(k.pos.z, k.target.z, 25, dt);
      let y = damp(k.pos.y, hover, 18, dt);
      if (k.chopT >= 0) {
        const t = k.chopT;
        k.chopT += dt;
        const down = 0.05, upd = 0.09;
        const prevT = t, f = t < down ? t / down : Math.max(0, 1 - (t - down) / upd);
        y = hover - (hover - base) * f;
        if (prevT < down && k.chopT >= down) {
          this.sfx.play("ton");
          if (overBoard) {
            const c = this._chopPool[this.hin.chops.length % 3];
            c.set(k.pos.x, TOP, k.pos.z);
            this.hin.chops.push(c);
          }
        }
        if (k.chopT > down + upd) {
          k.chopT = -1;
          if (k.step && !grabbing && k.onBoard) {
            const b2 = this.heroBounds();
            if (b2 && k.target.x + k.step < b2.x1 - 6e-3) k.target.x += k.step;
            else {
              k.onBoard = false;
              k.hop = 1;
              this.sfx.play("putdown");
            }
          }
          k.step = 0;
        }
      }
      k.pos.y = y;
      k.hop = Math.max(0, k.hop - dt * 3);
      o.knife.position.set(k.pos.x, k.pos.y + this.hintHop("knife") + Math.sin(k.hop * Math.PI) * 0.02, k.pos.z);
      o.knife.rotation.z = (1 - k.up) * (-Math.PI / 2);
      o.knifeShadow.position.set(k.pos.x + 0.02 * (1 - k.up), base + 15e-4, k.pos.z);
      o.knifeShadow.scale.set(0.04 + 0.05 * (1 - k.up), 1, 0.3);
      const p = this.pin, r = L.pin.radius;
      const pinStep = this.grab && this.grab.kind === "pin" ? null : this.stepAuto(p, dt);
      if (!(this.grab && this.grab.kind === "pin") && !pinStep) p.target.copy(L.pinRest);
      if (pinStep && pinStep.roll) {
        this.hin.pin.active = this.inBoard(p.pos.x, p.pos.z, -0.02);
        this.hin.pin.center.copy(p.pos);
      }
      p.pos.x = damp(p.pos.x, p.target.x, pinStep ? 8 : 18, dt);
      p.pos.z = damp(p.pos.z, p.target.z, pinStep ? 8 : 18, dt);
      const hb = this.heroBounds();
      const onDough = hb && hb.part === "dough" && this.hero.getState().place === "board" && p.pos.z > hb.z0 - r && p.pos.z < hb.z1 + r && p.pos.x + L.pin.length / 2 > hb.x0 && p.pos.x - L.pin.length / 2 < hb.x1;
      p.ride = damp(p.ride, onDough ? Math.max(0, hb.top - TOP - 6e-3) * 0.85 : 0, 16, dt);
      const py = (this.inBoard(p.pos.x, p.pos.z, -0.01) ? TOP + p.ride : 0) + r;
      p.pos.y = damp(p.pos.y, py, 20, dt);
      const dz = p.pos.z - p.prevZ;
      p.prevZ = p.pos.z;
      p.angle += dz / r;
      if (this.hin.pin.active) this.hin.pin.dz += dz;
      this.hin.pin.center.copy(p.pos);
      p.hop = Math.max(0, p.hop - dt * 3);
      o.pin.position.set(p.pos.x, p.pos.y + this.hintHop("pin") + Math.sin(p.hop * Math.PI) * 0.02, p.pos.z);
      o.pinMesh.rotation.x = p.angle;
      o.pinShadow.position.set(p.pos.x, p.pos.y - r + 15e-4, p.pos.z);
      const n = this.net;
      const netStep = this.grab && this.grab.kind === "net" ? null : this.stepAuto(n, dt);
      if (!(this.grab && this.grab.kind === "net") && !netStep) n.target.copy(L.netRest);
      dampV(n.pos, n.target, 14, dt);
      n.hop = Math.max(0, n.hop - dt * 3);
      o.net.position.set(n.pos.x, n.pos.y + this.hintHop("net") + Math.sin(n.hop * Math.PI) * 0.02, n.pos.z);
      const b = this.bowl;
      if (this.mode === "play") {
        if (!(this.grab && this.grab.kind === "bowl")) b.target.copy(L.bowlRest);
        dampV(b.pos, b.target, 16, dt);
      }
      b.wiggle = Math.max(0, b.wiggle - dt * 2.5);
      o.bowl.position.set(b.pos.x, b.pos.y + this.hintHop("bowl"), b.pos.z);
      o.bowl.rotation.z = Math.sin(b.wiggle * 18) * 0.08 * b.wiggle;
      o.bowlShadow.position.set(b.pos.x, b.pos.y > 0.05 ? L.serve.top + 1e-3 : 1e-3, b.pos.z);
      b.fill = damp(b.fill, b.fillTarget, 2.5, dt);
      const lvl = L.bowl.brothLevel * b.fill;
      o.broth.visible = b.fill > 0.02;
      o.broth.position.y = lvl;
      o.broth.scale.setScalar(this.w.brothRadiusAt(lvl));
      o.dishes.forEach((d, i) => {
        d.wig = Math.max(0, (d.wig || 0) - dt * 3);
        const hh = this.hint === "dishes" ? this.hintHop("dish" + i) : 0;
        d.group.position.y = d.base.y + Math.sin(Math.min(1, d.wig) * Math.PI) * 0.015 + hh;
        d.group.rotation.z = Math.sin(d.wig * 20) * 0.05 * Math.min(1, d.wig);
      });
    }
    // ---------- 鍋（湯気・泡・渦） ----------
    updatePot(dt, st) {
      const w = this.water, P = L.pot.base;
      w.omega = damp(w.omega, 0, 0.7, dt);
      this.o.water.rotation.y += w.omega * dt * 0.6 + dt * 0.05;
      this.tmp3.set(P.x, L.pot.water, P.z);
      const inPot = st.place === "pot";
      this.fx.setSteam(this.tmp3, 0.11, inPot ? 4 : 2);
      this.fx.setBubbles(inPot ? 7 : 2, L.pot.water);
      this.fx.onBubble = inPot ? () => this.sfx.play("bubble") : null;
    }
    // ---------- 具 ----------
    makePiece(type) {
      const t = this.o.toppings;
      const m = new THREE.Mesh(t.geos[type], t.mats[type]);
      m.userData.type = type;
      this.w.scene.add(m);
      return m;
    }
    // 具をお椀へ飛ばす（dragged=true なら指を離した場所から）
    launchTopping(type, piece, dragged) {
      const b = this.bowl;
      const n = b.toppings.length;
      const a = n * 2.39996 + Math.random() * 0.4, r = n === 0 ? 0 : 0.022 + n % 3 * 0.012;
      const local = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (dragged) {
        this.tmp.copy(piece.position);
        this.o.bowlAnchor.worldToLocal(this.tmp);
        local.x = clamp(this.tmp.x, -0.05, 0.05);
        local.z = clamp(this.tmp.z, -0.05, 0.05);
      }
      b.counts[type]++;
      b.toppings.push({ type, mesh: piece, local, landed: false });
      this.flying.push({ mesh: piece, from: piece.position.clone(), local, t: 0, dur: dragged ? 0.25 : 0.5, mode: "toBowl", spin: (Math.random() - 0.5) * 6, rot0: piece.rotation.y });
      this.sfx.play("pon");
    }
    flyBack(piece, idx) {
      this.flying.push({ mesh: piece, from: piece.position.clone(), to: this.o.dishes[idx].base.clone().setY(0.02), t: 0, dur: 0.3, mode: "toDish" });
      this.sfx.play("putdown");
    }
    toppingY() {
      return Math.max(6e-3, L.bowl.brothLevel * this.bowl.fill + 4e-3) + (this.hero.getState().place === "bowl" ? 0.016 : 0);
    }
    // 麺のいちばん上はつゆ面 + 0.015〜0.02
    animateToppings(dt) {
      const anchor = this.o.bowlAnchor;
      for (let i = this.flying.length - 1; i >= 0; i--) {
        const f = this.flying[i];
        f.t += dt;
        const u = clamp(f.t / f.dur, 0, 1), e = smooth(u);
        if (f.mode === "toBowl") {
          this.tmp.set(f.local.x, this.toppingY(), f.local.z);
          anchor.localToWorld(this.tmp);
          f.mesh.position.lerpVectors(f.from, this.tmp, e);
          f.mesh.position.y += Math.sin(u * Math.PI) * (f.dur > 0.3 ? 0.13 : 0.04);
          f.mesh.rotation.y = f.rot0 + f.spin * u;
          if (u >= 1) {
            anchor.add(f.mesh);
            f.mesh.position.set(f.local.x, this.toppingY(), f.local.z);
            f.mesh.rotation.set(0, f.rot0 + f.spin, 0);
            const tp = this.bowl.toppings.find((x) => x.mesh === f.mesh);
            if (tp) tp.landed = true;
            this.fx.sparkle(this.tmp, 4);
            this.sfx.play("drop", {});
            this.flying.splice(i, 1);
          }
        } else if (f.mode === "toDish") {
          f.mesh.position.lerpVectors(f.from, f.to, e);
          f.mesh.scale.setScalar(Math.max(1e-3, 1 - e));
          if (u >= 1) {
            this.w.scene.remove(f.mesh);
            this.flying.splice(i, 1);
          }
        } else if (f.mode === "toMouth") {
          if (f.t < 0) continue;
          f.target.getWorldPosition(this.tmp);
          f.mesh.position.lerpVectors(f.from, this.tmp, e);
          f.mesh.scale.setScalar(Math.max(1e-3, 1 - e * 0.9));
          if (u >= 1) {
            this.w.scene.remove(f.mesh);
            this.flying.splice(i, 1);
          }
        }
      }
      const y = this.toppingY();
      for (const t of this.bowl.toppings) if (t.landed && t.mesh.parent === anchor) t.mesh.position.y = damp(t.mesh.position.y, y, 6, dt);
    }
    // ---------- 渡す ----------
    serve() {
      if (this.mode !== "play") return;
      if (this.grab && this.grab.kind === "dough") {
        this.hin.pointer.phase = "up";
        this.hin.pointer.active = false;
      }
      this.grab = null;
      this.mode = "serving";
      this.serveT = 0;
      this.setHint(null);
      this.bowl.serveFrom.copy(this.bowl.pos);
      this.served = { noodles: this.hero.getState().place === "bowl", ate: false, happy: false, gift: false, leave: false, next: false };
      this.goCamera("serve");
      if (this.cust.current) this.cust.current.setState("want");
      this.sfx.play("slide");
      this.stats.serves++;
    }
    updateServe(dt) {
      const t = this.serveT += dt, s = this.served, b = this.bowl, c = this.cust.current;
      if (t < 0.8) {
        const u = easeInOut(t / 0.8);
        b.pos.lerpVectors(b.serveFrom, L.serveSpot, u);
        b.pos.y = lerp(b.serveFrom.y, L.serveSpot.y, smooth(t / 0.5)) + Math.sin(u * Math.PI) * 0.04;
      } else b.pos.copy(L.serveSpot);
      if (!s.ate && t > 1) {
        s.ate = true;
        if (c) c.setState("eat");
        if (s.noodles && c) {
          this.hero.setPlace("eaten", { mouth: c.mouth, duration: 1.6 });
          this.sfx.play("zuzu");
        }
        b.toppings.forEach((tp, i) => {
          tp.mesh.getWorldPosition(this.tmp);
          this.w.scene.attach(tp.mesh);
          this.flying.push({ mesh: tp.mesh, from: this.tmp.clone(), target: c ? c.mouth : this.o.bowlAnchor, t: -0.3 * i - (s.noodles ? 0.9 : 0), dur: 0.35, mode: "toMouth" });
        });
        if (b.toppings.length) this.sfx.play("mogu");
        b.toppings = [];
        b.fillTarget = 0;
      }
      if (!s.happy && t > 2.9) {
        s.happy = true;
        if (c) {
          c.setState("happy");
          c.head.getWorldPosition(this.tmp);
          this.tmp.y += 0.14;
          this.fx.hearts(this.tmp, 3);
          this.fx.sparkle(this.tmp, 12, "#fff3a0", 0.4);
        }
        this.sfx.play("happy");
      }
      if (!s.gift && t > 4) {
        s.gift = true;
        const p = this.cust.addGift();
        this.fx.sparkle(p, 10);
        this.sfx.play("kira");
      }
      if (!s.leave && t > 4.7) {
        s.leave = true;
        if (c) c.setState("leave");
        this.goCamera("work");
      }
      if (!s.next && t > 5.5) {
        s.next = true;
        this.round++;
        this.cust.next();
        b.counts = { negi: 0, kamaboko: 0, ebiten: 0, oage: 0 };
        b.color++;
        this.w.setBowlColor(b.color);
        b.target.copy(L.bowlRest);
        b.serveFrom.copy(b.pos);
        b.back = 0;
        if (this.hero.getState().place === "eaten") {
          this._resetPending = true;
          this.hero.reset({ seed: this.round });
        }
      }
      if (s.next) {
        b.back = (b.back || 0) + dt;
        const u = easeInOut(b.back / 0.7);
        b.pos.lerpVectors(b.serveFrom, L.bowlRest, u);
        b.pos.y = lerp(b.serveFrom.y, 0, u) + Math.sin(u * Math.PI) * 0.04;
      }
      if (t > 6.3) {
        this.mode = "play";
        this.lastTouch = this.time;
        b.pos.copy(L.bowlRest);
        b.target.copy(L.bowlRest);
      }
    }
    // ---------- ヒント（止まったら次に触れる物が光る・揺れる） ----------
    chooseHint() {
      const s = this.hero.getState();
      const touched = s.touched.pressed || s.touched.stretched || s.touched.rolled;
      if (s.place === "board" && s.cutCount === 0 && !touched) return "dough";
      if (s.place === "board" && s.cutCount === 0) return "knife";
      if (s.place === "board") return "noodles";
      if (s.place === "pot") return "net";
      if (s.place === "net" || s.place === "hand") return "bowl";
      if (s.place === "bowl" && this.bowl.toppings.length === 0) return "dishes";
      if (this.servable()) return "serve";
      return null;
    }
    setHint(h) {
      if (h === this.hint) return;
      const gl = this.w.glows;
      for (const k of Object.keys(gl)) gl[k].set(0);
      for (const d of this.o.dishes) d.glow.set(0);
      this.hero.setHint(null);
      if (this.cust.current) this.cust.current.beckon = false;
      this.hint = h;
      this.hintT = 0;
      if (h === "dough" || h === "noodles") this.hero.setHint(h);
    }
    updateHint(dt) {
      let want = null;
      if (this.mode === "play" && !this.grab && this.time - this.lastTouch > HINT_DELAY && this.flying.length === 0 && !this.net.auto && !this.pin.auto && !this.hero.getState().busy) want = this.chooseHint();
      if (want && want !== "knife" && this.knife.onBoard) {
        this.knife.onBoard = false;
        this.knife.hop = 1;
        this.sfx.play("putdown");
      }
      this.setHint(want);
      if (!this.hint) return;
      this.hintT += dt;
      const pulse = 0.5 - 0.5 * Math.cos(this.hintT * Math.PI * 2 / 1.2);
      const gl = this.w.glows, h = this.hint;
      if (h === "knife") gl.knife.set(pulse * 0.6);
      if (h === "net") gl.net.set(pulse * 0.6);
      if (h === "noodles") gl.pot.set(pulse * 0.35);
      if (h === "bowl" || h === "serve") gl.bowl.set(pulse * 0.5);
      if (h === "serve" && this.cust.current) this.cust.current.beckon = true;
      if (h === "dishes") this.o.dishes.forEach((d, i) => d.glow.set((0.5 - 0.5 * Math.cos((this.hintT - i * 0.25) * Math.PI * 2 / 1.2)) * 0.6));
    }
    // ぴょこっ（2秒に1回、0.35秒の小さな跳ね）
    hintHop(name) {
      if (!this.hint) return 0;
      const h = this.hint;
      let on = h === name || name === "bowl" && (h === "bowl" || h === "serve");
      let off = 0;
      if (name.startsWith("dish") && h === "dishes") {
        on = true;
        off = +name.slice(4) * 0.25;
      }
      if (!on) return 0;
      const ph = ((this.hintT - off) % 2 + 2) % 2;
      return ph < 0.35 ? Math.sin(ph / 0.35 * Math.PI) * 0.014 : 0;
    }
    // ---------- hero のイベント → 音・演出 ----------
    onHeroEvent(type, d) {
      const fx = this.fx, sfx = this.sfx;
      switch (type) {
        case "press":
          sfx.play("munyu");
          if (d && d.position) fx.puff(d.position, 3);
          break;
        case "stretch":
          sfx.stretch(d ? d.amount : 0.5);
          break;
        case "stretch-release":
          sfx.stretchEnd();
          sfx.play("boyon");
          break;
        case "roll":
          if (this.time - (this._rollT || 0) > 0.09) {
            sfx.play("goro");
            this._rollT = this.time;
          }
          break;
        case "cut":
          sfx.play("suton");
          this.stats.cuts++;
          if (d && d.position) {
            fx.puff(d.position, 4);
            fx.sparkle(d.position, 2, "#ffffff", 0.15);
          }
          break;
        case "splash":
          sfx.play("splash");
          if (d && d.position) fx.sparkle(d.position, 8, "#e9fbff", 0.3);
          break;
        case "scoop":
          sfx.play("scoop");
          break;
        case "drop":
          sfx.play("drop");
          if (this.bowl.fillTarget < 1) {
            this.bowl.fillTarget = 1;
            sfx.play("broth");
          }
          break;
        case "settled":
          if (d && d.place === "board" && this._resetPending) {
            sfx.play("poyon");
            this._resetPending = false;
          }
          if (d && d.place === "bowl" && this.bowl.fillTarget < 1) this.bowl.fillTarget = 1;
          break;
      }
    }
  };

  // app/shell/debug.js
  var Debug = class {
    constructor(enabled) {
      this.enabled = enabled;
      this.frames = new Float32Array(240);
      this.n = 0;
      this.i = 0;
      this.cpu = new Float32Array(240);
      this.ci = 0;
      this.cn = 0;
      this.nan = 0;
      this.errors = [];
      this.last = { calls: 0, tris: 0 };
      this.geoBytes = 0;
      this.geoT = 0;
      this.showT = 0;
      if (enabled) {
        const d = this.el = document.createElement("div");
        d.style.cssText = "position:fixed;left:6px;top:6px;z-index:10;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.55);padding:5px 7px;border-radius:6px;white-space:pre;max-width:96vw;overflow:hidden";
        document.body.appendChild(d);
      }
    }
    error(msg) {
      this.errors.push(String(msg).slice(0, 200));
      if (this.errors.length > 20) this.errors.shift();
    }
    frame(dt) {
      this.frames[this.i] = dt * 1e3;
      this.i = (this.i + 1) % this.frames.length;
      this.n = Math.min(this.n + 1, this.frames.length);
    }
    cpuFrame(ms) {
      this.cpu[this.ci] = ms;
      this.ci = (this.ci + 1) % this.cpu.length;
      this.cn = Math.min(this.cn + 1, this.cpu.length);
    }
    cpuMs() {
      if (!this.cn) return { avg: 0, p95: 0 };
      const a = Array.from(this.cpu.subarray(0, this.cn)).sort((x, y) => x - y);
      return { avg: a.reduce((s, x) => s + x, 0) / a.length, p95: a[Math.floor(a.length * 0.95)] || 0 };
    }
    fps() {
      if (!this.n) return { avg: 0, p95: 0 };
      const a = Array.from(this.frames.subarray(0, this.n)).sort((x, y) => x - y);
      const mean = a.reduce((s, x) => s + x, 0) / a.length;
      return { avg: 1e3 / Math.max(mean, 1e-3), p95ms: a[Math.floor(a.length * 0.95)] || 0 };
    }
    // シーンの頂点バッファの合計（同じ geometry は1回だけ数える）
    // あわせて、描いている頂点に NaN／長さ0の法線（シェーダーの normalize で NaN → 黒くなる）が無いか数える
    measureGeometry(scene) {
      const seen = /* @__PURE__ */ new Set();
      let b = 0, bad = 0;
      scene.traverse((o) => {
        if (o.isInstancedMesh) b += o.instanceMatrix.array.byteLength + (o.instanceColor ? o.instanceColor.array.byteLength : 0);
        const g = o.geometry;
        if (!g || seen.has(g)) return;
        seen.add(g);
        for (const k in g.attributes) b += g.attributes[k].array.byteLength;
        if (g.index) b += g.index.array.byteLength;
        if (!o.visible || !o.isMesh) return;
        const P = g.attributes.position, N = g.attributes.normal, pa = P.array, na = N && N.array, I = g.index && g.index.array;
        const start2 = g.drawRange.start, end = Math.min(I ? I.length : P.count, start2 + g.drawRange.count);
        for (let k = start2; k < end; k++) {
          const i = I ? I[k] : k, x = na ? na[i * 3] : 0, y = na ? na[i * 3 + 1] : 1, z = na ? na[i * 3 + 2] : 0;
          if (!Number.isFinite(pa[i * 3] + pa[i * 3 + 1] + pa[i * 3 + 2]) || !(x * x + y * y + z * z > 1e-12)) {
            bad++;
            break;
          }
        }
      });
      this.geoBytes = b;
      this.nan = bad;
      return b;
    }
    report(s) {
      this.state = s;
    }
    update(dt, info) {
      this.showT -= dt;
      if (!this.enabled || this.showT > 0 || !this.state) return;
      this.showT = 0.5;
      const s = this.state, f = this.fps(), MiB = (x) => (x / 1048576).toFixed(1);
      this.el.textContent = `tier ${s.tier}  dpr ${s.dpr.toFixed(2)}  scale ${s.scale.toFixed(2)}
canvas ${s.w}x${s.h}  boot ${Math.round(s.boot)}ms
fps ${f.avg.toFixed(1)} avg  p95 ${f.p95ms.toFixed(1)}ms (${(1e3 / Math.max(f.p95ms, 1e-3)).toFixed(0)}fps)
cpu ${this.cpuMs().avg.toFixed(2)}ms avg  p95 ${this.cpuMs().p95.toFixed(2)}ms  NaN ${this.nan}
draw ${s.calls}  tri ${s.tris}  (hero ${s.heroTris} / ${s.heroCalls}dc)
tex ${s.texCount} (gl ${s.glTextures})  geo ${s.glGeometries}
GPU est ${MiB(s.gpu)} MiB  fb ${MiB(s.fb)} tex ${MiB(s.tex)} geo ${MiB(s.geo)}
place ${s.place}  cuts ${s.cuts}  serves ${s.serves}  ${s.lost ? "CONTEXT LOST" : ""}
err ${this.errors.length}${this.errors.length ? ": " + this.errors[this.errors.length - 1] : ""}`;
    }
  };

  // app/shell/main.js
  var params = new URLSearchParams(location.search);
  var debug = new Debug(params.get("debug") === "1");
  window.addEventListener("error", (e) => debug.error(e.message || e.error));
  window.addEventListener("unhandledrejection", (e) => debug.error("promise: " + (e.reason && e.reason.message || e.reason)));
  var cerr = console.error.bind(console);
  console.error = (...a) => {
    debug.error(a.map(String).join(" "));
    cerr(...a);
  };
  function start() {
    const tier = detectTier(params);
    const t0 = performance.now();
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: tier.antialias, powerPreference: "high-performance", alpha: false, stencil: false, preserveDrawingBuffer: false });
    } catch (e) {
      debug.error("WebGL: " + e.message);
      document.body.style.background = "#f3e2c4";
      return;
    }
    const canvas = renderer.domElement;
    canvas.id = "game";
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
    const doughTex = bank.photo("udon_dough_1024", "#efe3c4");
    let flow = null;
    const create = window.UdonHero && window.UdonHero.createHero;
    if (!create) throw new Error("hero \u304C\u8AAD\u3081\u306A\u3044\uFF08app/hero/hero.build.js\uFF09");
    const hero = create(THREE, {
      tier: tier.hero,
      textures: { dough: doughTex },
      layout: {
        board: { center: L.board.center.clone(), sizeX: L.board.sizeX, sizeZ: L.board.sizeZ },
        doughStart: { center: L.doughStart.center.clone(), sizeX: L.doughStart.sizeX, sizeZ: L.doughStart.sizeZ, thickness: L.doughStart.thickness },
        pot: {
          center: new THREE.Vector3(L.pot.base.x, L.pot.water, L.pot.base.z),
          radius: L.pot.inner,
          depth: L.pot.water - L.pot.stove - 0.012,
          rimAbove: L.pot.stove + L.pot.height - L.pot.water
        },
        // 湯面から鍋のふちまで
        net: { radius: L.net.radius, rimY: L.net.rimY },
        // 網のかご
        bowl: world.objs.bowlAnchor
      },
      maxNoodles: 12,
      onEvent: (type, data) => {
        if (flow) flow.onHeroEvent(type, data || {});
      }
    });
    scene.add(hero.root);
    const pointer = new Pointer(canvas);
    flow = new Flow({ world, hero, customers, fx, sfx, camera, pointer });
    customers.next();
    flow._resetPending = true;
    hero.reset({ seed: 0 });
    let scale = 1, cw = 0, ch = 0;
    function resize() {
      const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
      const pr = Math.min(tier.dpr * scale, Math.sqrt(tier.maxPixels / (w * h)));
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, true);
      cw = Math.round(w * pr);
      ch = Math.round(h * pr);
      camera.aspect = w / h;
      flow.resize(w / h);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 200));
    resize();
    let last = performance.now(), lost = false, paused = false, firstFrame = true;
    const perf = { acc: 0, times: [], warm: 3 };
    function frame(now) {
      let dt = (now - last) / 1e3;
      last = now;
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
        debug.error(e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e);
        console.warn(e);
      }
      debug.frame(dt);
      if (debug.enabled) debug.cpuFrame(performance.now() - c0);
      if (firstFrame) {
        firstFrame = false;
        const b = document.getElementById("boot");
        if (b) b.remove();
        window.__udonReadyMs = performance.now() - t0;
        window.__udonBootMs = performance.now();
      }
      autoScale(dt);
      report(dt);
    }
    function autoScale(dt) {
      perf.warm -= dt;
      if (perf.warm > 0) return;
      perf.times.push(dt);
      perf.acc += dt;
      if (perf.acc < 2) return;
      const a = perf.times.sort((x, y) => x - y), p95 = a[Math.floor(a.length * 0.95)];
      perf.times = [];
      perf.acc = 0;
      if (p95 > 0.034 && scale > tier.minScale) {
        scale = Math.max(tier.minScale, scale * 0.88);
        resize();
      } else if (p95 < 0.019 && scale < 1) {
        scale = Math.min(1, scale * 1.05);
        resize();
      }
    }
    let geoT = 0;
    const peak = { tris: 0, calls: 0, heroTris: 0, gpu: 0 };
    function report(dt) {
      if (!debug.enabled) return;
      geoT -= dt;
      if (geoT <= 0) {
        debug.measureGeometry(scene);
        geoT = 2;
      }
      const hs = hero.getStats();
      const fb = cw * ch * 16;
      let heroTex = 0;
      for (const t of hs.textures || []) heroTex += t.width * t.height * 4 * 4 / 3;
      const tex = bank.bytes() + heroTex;
      const st = hero.getState();
      const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
      peak.tris = Math.max(peak.tris, tris);
      peak.calls = Math.max(peak.calls, calls);
      peak.heroTris = Math.max(peak.heroTris, hs.triangles);
      peak.gpu = Math.max(peak.gpu, fb + tex + debug.geoBytes);
      debug.report({
        boot: window.__udonBootMs || 0,
        tier: tier.name,
        dpr: renderer.getPixelRatio(),
        scale,
        w: cw,
        h: ch,
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        heroTris: hs.triangles,
        heroCalls: hs.drawCalls,
        texCount: bank.items.length + (hs.textures || []).length,
        glTextures: renderer.info.memory.textures,
        glGeometries: renderer.info.memory.geometries,
        gpu: fb + tex + debug.geoBytes,
        fb,
        tex,
        geo: debug.geoBytes,
        place: st.place,
        cuts: st.cutCount,
        serves: flow.stats.serves,
        lost
      });
      debug.update(dt);
    }
    renderer.setAnimationLoop(frame);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      lost = true;
      pointer.cancel();
    }, false);
    canvas.addEventListener("webglcontextrestored", () => {
      bank.restore();
      scene.traverse((o) => {
        if (o.geometry) for (const k in o.geometry.attributes) o.geometry.attributes[k].needsUpdate = true;
        if (o.isInstancedMesh) {
          o.instanceMatrix.needsUpdate = true;
          if (o.instanceColor) o.instanceColor.needsUpdate = true;
        }
      });
      if (hero.onContextRestored) hero.onContextRestored();
      lost = false;
      last = performance.now();
    }, false);
    document.addEventListener("visibilitychange", () => {
      paused = document.hidden;
      if (paused) {
        sfx.suspend();
        pointer.cancel();
      } else {
        last = performance.now();
      }
    });
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
      serve: () => v.set(0, 0.1, -0.45)
    };
    L.dishes.forEach((p, i) => {
      named["dish" + i] = () => v.copy(p).setY(0.02);
    });
    window.__udon = {
      state: () => {
        const st = hero.getState(), f = debug.fps();
        return {
          mode: flow.mode,
          place: st.place,
          cutCount: st.cutCount,
          noodleCount: st.noodleCount,
          busy: st.busy,
          touched: { ...st.touched },
          toppings: flow.bowl.toppings.length,
          fill: flow.bowl.fill,
          serves: flow.stats.serves,
          round: flow.round,
          hint: flow.hint,
          customer: customers.current && customers.current.sp.id,
          gifts: customers.gifts.length,
          errors: debug.errors.slice(),
          fps: f.avg,
          p95ms: f.p95ms,
          readyMs: window.__udonReadyMs,
          bootMs: window.__udonBootMs,
          cpu: debug.cpuMs(),
          nan: debug.nan,
          calls: debug.state && debug.state.calls,
          tris: debug.state && debug.state.tris,
          heroTris: debug.state && debug.state.heroTris,
          gpuMiB: debug.state && debug.state.gpu / 1048576,
          texMiB: debug.state && debug.state.tex / 1048576,
          geoMiB: debug.state && debug.state.geo / 1048576,
          fbMiB: debug.state && debug.state.fb / 1048576,
          tier: tier.name,
          canvas: [cw, ch],
          lost,
          peak: { ...peak, gpuMiB: peak.gpu / 1048576 }
        };
      },
      screen: (name, x, y, z) => {
        const p = name === "xyz" ? v.set(x, y, z) : named[name]();
        const q = p.clone().project(camera);
        return { x: (q.x + 1) / 2 * window.innerWidth, y: (1 - q.y) / 2 * window.innerHeight };
      },
      loseContext: () => {
        const ext = renderer.getContext().getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
        window.__udonLoseExt = ext;
        return !!ext;
      },
      restoreContext: () => {
        const ext = window.__udonLoseExt;
        if (ext) ext.restoreContext();
        return !!ext;
      },
      textures: () => bank.list(),
      _flow: flow,
      _hero: hero,
      // 三角形の内訳（PLAN の実測用）
      breakdown: () => {
        const out = {}, wp = new THREE.Vector3();
        const add = (k, n) => {
          out[k] = (out[k] || 0) + n;
        };
        scene.traverse((o) => {
          if (!o.isMesh || !o.visible || o.material && o.material.visible === false) return;
          let p = o, inHero = false;
          while (p) {
            if (p === hero.root) inHero = true;
            p = p.parent;
          }
          const g = o.geometry, n = (g.index ? Math.min(g.index.count, g.drawRange.count) : Math.min(g.attributes.position.count, g.drawRange.count)) / 3;
          const cnt = o.isInstancedMesh ? n * o.count : n;
          o.getWorldPosition(wp);
          const k = inHero ? "hero" : o.isInstancedMesh ? "fx" : wp.z < -0.6 && wp.y > 0.05 && wp.z > -1 ? "customer" : wp.z < -1 || o === world.objs.board ? "far" : "near";
          add(k, cnt);
        });
        for (const k in out) out[k] = Math.round(out[k]);
        return out;
      }
    };
  }
  try {
    start();
  } catch (e) {
    debug.error(e.message);
    console.warn(e);
  }
})();
