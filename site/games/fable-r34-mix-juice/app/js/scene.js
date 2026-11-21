/* scene: builds the kitchen, blender, cups, animals, shelf and shared effects */
(function () {
  'use strict';
  var MJ = window.MJ, G = MJ.G, SH = MJ.SH, M = MJ.M;
  var V3 = THREE.Vector3;

  var L = (MJ.L = {
    base: new V3(-0.75, 0, -0.3), baseTop: 1.04,
    cupZ: -0.55, cupX: [2.25, 3.95, 5.65],
    animalZ: -3.75, holdY: 0.3, holdZ: -2.5,
    slots: [[-5.25, 0.8], [-3.95, 0.8], [-2.65, 0.8], [-5.25, 2.2], [-3.95, 2.2], [-2.65, 2.2]],
    tray: new V3(-3.95, 0, 1.5),
    shelf: new V3(-4.6, 3.75, -6.15)
  });
  MJ.CUP_COLORS = { bear: 0x76c4f5, rabbit: 0xff9ec6, cat: 0xffcf4d, pig: 0xa8e07a, panda: 0xc1a3ff, chick: 0xffa066 };

  MJ.buildScene = function (renderer, T) {
    var W = (MJ.W = {});
    var scene = (W.scene = new THREE.Scene());
    scene.background = new THREE.Color(0xf7e6d6);
    var cam = (W.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 60));
    W.camTarget = new V3(-0.55, 2.15, -0.9);
    cam.position.set(-0.55, 6.3, 9.0);
    cam.lookAt(W.camTarget);

    scene.add(new THREE.HemisphereLight(0xfff7ee, 0xd8b48c, 1.9));
    var sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(-4, 9, 7); scene.add(sun);
    var fill = new THREE.DirectionalLight(0xffe2d0, 0.7); fill.position.set(6, 3, 5); scene.add(fill);

    // ----- background (cheap: low poly + 512² photo textures, unlit) -----
    var wallMat = new THREE.MeshBasicMaterial({ map: T.wall_tiles, color: 0xf3f0ea });
    T.wall_tiles.wrapS = T.wall_tiles.wrapT = THREE.RepeatWrapping; T.wall_tiles.repeat.set(40 / 2.0, 16 / 2.0);
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), wallMat); wall.position.set(0, 4, -6.5); scene.add(wall);
    var win = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6), new THREE.MeshBasicMaterial({ map: T.kitchen_window }));
    win.position.set(1.9, 5.3, -6.45); scene.add(win);
    T.wood_counter.wrapS = T.wood_counter.wrapT = THREE.RepeatWrapping; T.wood_counter.repeat.set(5.5, 2.6);
    var woodMat = new THREE.MeshLambertMaterial({ map: T.wood_counter, color: 0xffffff });
    var counter = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 13), woodMat); counter.position.set(0, -0.3, 3.5); scene.add(counter);
    W.wood = woodMat;
    var shelf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.8), woodMat); shelf.position.copy(L.shelf); scene.add(shelf);

    // shelf bottles (InstancedMesh, colour = juice made in each round)
    var bp = [[0, 0], [0.17, 0], [0.18, 0.05], [0.18, 0.44], [0.09, 0.58], [0.07, 0.7], [0, 0.7]];
    var bGeo = G.lathe(bp, 16, { uvMode: 'plain' }); bGeo.deleteAttribute('uv');
    var bottles = new THREE.InstancedMesh(bGeo, new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 90, specular: 0x666666 }), 10);
    var capGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.12, 10); capGeo.translate(0, 0.72, 0); capGeo.deleteAttribute('uv');
    var caps = new THREE.InstancedMesh(capGeo, new THREE.MeshLambertMaterial({ color: 0xd9a066 }), 10);
    bottles.count = caps.count = 0; bottles.frustumCulled = caps.frustumCulled = false;
    bottles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(30), 3);
    scene.add(bottles); scene.add(caps);
    W.bottles = bottles; W.caps = caps;

    // ----- fruit tray -----
    var tp = [[0, 0], [1.75, 0], [1.9, 0.07], [2.0, 0.2], [1.93, 0.23], [1.75, 0.11], [0, 0.11]];
    var trayGeo = G.lathe(tp, 48, { uvMode: 'plain' }); trayGeo.deleteAttribute('uv'); trayGeo.scale(1.08, 1, 0.9);
    var tray = new THREE.Mesh(trayGeo, new THREE.MeshPhongMaterial({ color: 0xbfe4f6, shininess: 60, specular: 0x444444 }));
    tray.position.copy(L.tray); scene.add(tray);

    // ----- shared materials -----
    W.fruitMat = SH.fruitMaterial(T.fruit_skin);
    T.fruit_smoothie.wrapS = T.fruit_smoothie.wrapT = THREE.RepeatWrapping;
    W.animalMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    W.eyeMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: 0x777777 });
    W.glassBack = SH.glassBack();

    buildBlender(W, T);
    W.cups = [];
    for (var i = 0; i < 3; i++) W.cups.push(buildCup(W, T, L.cupX[i]));

    W.fx = SH.makeParticles(MJ.tier.particles); scene.add(W.fx.mesh);
    W.shadows = SH.makeShadows(40); scene.add(W.shadows.mesh);
    W.glow = SH.makeGlow(); scene.add(W.glow);
    W.stream = SH.makeStream(); scene.add(W.stream.mesh);
    W.animalRoot = new THREE.Group(); scene.add(W.animalRoot);
    return W;
  };

  function buildBlender(W, T) {
    var scene = W.scene, J = G.JUG;
    var blender = (W.blender = new THREE.Group()); blender.position.copy(L.base); scene.add(blender);
    var bprof = [[0, 0], [1.08, 0], [1.12, 0.07], [1.1, 0.2], [1.04, 0.78], [0.98, 0.93], [0.86, 1.01], [0.74, 1.04], [0, 1.04]];
    var bgeo = G.lathe(G.spline(bprof, 20), 48, { uvMode: 'plain' }); bgeo.deleteAttribute('uv');
    W.baseMat = new THREE.MeshPhongMaterial({ color: 0xff9db8, shininess: 55, specular: 0x555555 });
    blender.add(new THREE.Mesh(bgeo, W.baseMat));
    // big round switch on the front
    var sw = (W.switchGroup = new THREE.Group()); sw.position.set(0, 0.5, 1.02); sw.rotation.x = -0.04; blender.add(sw);
    var ringG = new THREE.TorusGeometry(0.44, 0.07, 10, 36); ringG.deleteAttribute('uv');
    sw.add(new THREE.Mesh(ringG, new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80 })));
    var bprof2 = [[0, 0.2], [0.18, 0.19], [0.3, 0.14], [0.37, 0.06], [0.38, -0.08]];
    var btnG = G.lathe(G.spline(bprof2, 8), 32, { uvMode: 'plain' }); btnG.deleteAttribute('uv'); btnG.rotateX(Math.PI / 2);
    W.switchMat = new THREE.MeshPhongMaterial({ color: 0xffcf3a, shininess: 80, specular: 0x666666, emissive: 0x000000 });
    W.switchBtn = new THREE.Mesh(btnG, W.switchMat); sw.add(W.switchBtn);

    // jug (moves: separate root)
    var jug = (W.jug = new THREE.Group()); jug.position.set(L.base.x, L.baseTop, L.base.z); scene.add(jug);
    var outer = G.lathe(G.jugProfile(0), 56, { uvMode: 'plain', deform: G.spoutDeform }); outer.deleteAttribute('uv');
    W.jugBack = new THREE.Mesh(outer, W.glassBack); jug.add(W.jugBack);
    W.jugFrontMat = SH.glassFront();
    W.jugFront = new THREE.Mesh(outer, W.jugFrontMat); W.jugFront.renderOrder = 3; jug.add(W.jugFront);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(J.r0 - 0.02, 32).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xc8dde3 }));
    floor.position.y = 0.16; jug.add(floor);
    var collarG = new THREE.CylinderGeometry(0.73, 0.76, 0.32, 40); collarG.translate(0, 0.16, 0); collarG.deleteAttribute('uv');
    var accent = new THREE.MeshPhongMaterial({ color: 0xff86a6, shininess: 60 });
    jug.add(new THREE.Mesh(collarG, accent));
    // rim follows the deformed top edge (spout included)
    var rimPts = [];
    for (var i = 0; i < 64; i++) {
      var phi = (i / 64) * Math.PI * 2, p = new V3(J.r1 * Math.sin(phi), J.h, J.r1 * Math.cos(phi));
      G.spoutDeform(p, phi, 1); rimPts.push(p);
    }
    var rimG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 96, 0.045, 6, true); rimG.deleteAttribute('uv');
    jug.add(new THREE.Mesh(rimG, new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 90 })));
    var hc = new THREE.CatmullRomCurve3([new V3(-0.8, 1.95, 0), new V3(-1.3, 1.88, 0), new V3(-1.44, 1.35, 0), new V3(-1.3, 0.78, 0), new V3(-0.72, 0.6, 0)]);
    var hG = new THREE.TubeGeometry(hc, 28, 0.12, 10, false); hG.deleteAttribute('uv');
    jug.add(new THREE.Mesh(hG, accent));
    // blades
    var blades = (W.blades = new THREE.Group()); blades.position.y = 0.3; jug.add(blades);
    var bm = new THREE.MeshPhongMaterial({ color: 0xe2e8ec, shininess: 120, specular: 0xaaaaaa });
    var bl = []; for (i = 0; i < 2; i++) { var b = new THREE.BoxGeometry(0.95, 0.035, 0.13); b.rotateY(i * Math.PI / 2); b.rotateX(i ? 0.25 : -0.25); b.deleteAttribute('uv'); bl.push(b); }
    var hub = new THREE.CylinderGeometry(0.08, 0.1, 0.16, 12); hub.translate(0, -0.06, 0); hub.deleteAttribute('uv'); bl.push(hub);
    blades.add(new THREE.Mesh(THREE.mergeGeometries(bl), bm));
    // liquid
    W.liquid = SH.makeLiquid({ r0: J.r0 - 0.05, r1: J.r1 - 0.05, h: J.h, y0: J.liqY0, depth: 0.6, disc: MJ.tier.disc, side: MJ.tier.side }, T.fruit_smoothie);
    W.liquid.group.visible = false; jug.add(W.liquid.group);
    // crushed chunks
    var chunks = (W.chunks = new THREE.InstancedMesh(G.chunkGeo(), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 }), 36));
    chunks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36 * 3), 3);
    chunks.count = 0; chunks.frustumCulled = false; jug.add(chunks);
    W.jugFruitRoot = new THREE.Group(); jug.add(W.jugFruitRoot);
  }

  function buildCup(W, T, x) {
    var C = G.CUP;
    var g = new THREE.Group(); g.position.set(x, 0, L.cupZ); W.scene.add(g);
    var geo = G.lathe(G.cupProfile(), 36, { uvMode: 'plain' }); geo.deleteAttribute('uv');
    var back = new THREE.Mesh(geo, W.glassBack); g.add(back);
    var fm = SH.glassFront(); fm.uniforms.uK = { value: 0.6 }; var front = new THREE.Mesh(geo, fm); front.renderOrder = 3; g.add(front);
    var bG = new THREE.CylinderGeometry(C.r0 + 0.005, C.r0 + 0.01, 0.16, 32); bG.translate(0, 0.08, 0); bG.deleteAttribute('uv');
    var rG = new THREE.TorusGeometry(C.r1 + 0.005, 0.04, 6, 40); rG.rotateX(Math.PI / 2); rG.translate(0, C.h, 0); rG.deleteAttribute('uv');
    var dots = [];
    for (var i = 0; i < 6; i++) { var a = (i / 6) * Math.PI * 2 + 0.3, r = M.lerp(C.r0, C.r1, 0.62) + 0.012;
      var d = new THREE.SphereGeometry(0.06, 8, 6); d.scale(1, 1, 0.35); d.lookAt(new V3(Math.sin(a), 0, Math.cos(a))); d.translate(r * Math.sin(a), C.h * 0.62, r * Math.cos(a)); d.deleteAttribute('uv'); dots.push(d); }
    var decoMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 });
    var deco = new THREE.Mesh(THREE.mergeGeometries([bG, rG].concat(dots)), decoMat); g.add(deco);
    var liq = SH.makeLiquid({ r0: C.r0 - 0.04, r1: C.r1 - 0.04, h: C.h, y0: C.liqY0, depth: 0, disc: [8, 28], side: [28, 3], wave: 0.25 }, T.fruit_smoothie);
    liq.group.visible = false; g.add(liq.group);
    return { group: g, front: fm, deco: decoMat, liquid: liq, home: new V3(x, 0, L.cupZ) };
  }

  // ----- fruits -----
  MJ.makeFruit = function (type, lod) {
    var m = new THREE.Mesh(G.fruitGeo(type, lod), MJ.W.fruitMat);
    m.userData.type = type;
    return m;
  };

  // ----- animals -----
  MJ.makeAnimal = function (type) {
    var W = MJ.W, P = G.animal(type), H = G.HEAD;
    var root = new THREE.Group();
    var body = new THREE.Mesh(P.body, W.animalMat); root.add(body);
    var head = new THREE.Group(); head.position.y = H.y; root.add(head);
    head.add(new THREE.Mesh(P.head, W.animalMat));
    var eyes = new THREE.Mesh(P.eyes, W.eyeMat); head.add(eyes);
    var happy = new THREE.Mesh(P.happy, W.animalMat); happy.visible = false; head.add(happy);
    var mouth = new THREE.Mesh(P.mouth, W.animalMat); mouth.visible = false; head.add(mouth);
    var arms = [-1, 1].map(function (s) {
      var a = new THREE.Mesh(P.arm, W.animalMat); a.position.set(s * 0.66, 1.08, 0.12); a.rotation.z = s * 0.25; root.add(a); return a;
    });
    return { type: type, root: root, body: body, head: head, eyes: eyes, happy: happy, mouth: mouth, arms: arms, cfg: P.cfg,
      dispose: function () { [P.body, P.head, P.eyes, P.happy, P.mouth, P.arm].forEach(function (g) { g.dispose(); }); } };
  };

  // Fit the fixed camera so the whole counter is visible at any aspect ratio.
  MJ.fitCamera = function (w, h) {
    var cam = MJ.W.camera, aspect = w / Math.max(h, 1);
    var dist = cam.position.distanceTo(MJ.W.camTarget);
    var halfW = 7.0, needTan = halfW / dist;            // horizontal half-extent to keep
    var vt = needTan / aspect;                          // tan(vfov/2) from width
    var minVt = Math.tan(THREE.MathUtils.degToRad(19)); // keep enough height on wide screens
    var vfov = 2 * Math.atan(Math.max(vt, minVt));
    cam.fov = THREE.MathUtils.radToDeg(vfov); cam.aspect = aspect;
    // portrait: shift the view down a little so the counter fills the lower half
    cam.updateProjectionMatrix();
  };
})();
