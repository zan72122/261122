// 場面（お店のカウンター）と道具の形。すべて低ポリの手続き形状。
import { THREE } from './three.js';
import { L } from './layout.js';
import { drawWood, drawBowlPattern, drawNet, drawSoft } from './textures.js';
import { mergeColored, Glow } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lambert = (o) => new THREE.MeshLambertMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);

// 触り判定用の見えない形
function proxy(geo, kind, extra = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  m.userData = { kind, enabled: true, ...extra };
  return m;
}

export const BOWL_COLORS = ['#d9534f', '#3a6ea5', '#4f9a5a', '#e08a2e', '#9b59b6'];

export function buildScene(bank, tier) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9d6b8');
  const proxies = [];
  const glows = {};

  // ---- 光：半球光＋平行光（影マップなし） ----
  scene.add(new THREE.HemisphereLight('#fff6ea', '#8a6a50', 1.5));
  const sun = new THREE.DirectionalLight('#fff1de', 1.7);
  sun.position.set(-0.6, 1.6, 1.1);
  scene.add(sun);

  // ---- テクスチャ ----
  const tex = {
    shop: bank.photo('udon_shop_512', '#a57a52', { wrap: false }),
    board: bank.photo('flour_board_512', '#e8c9a4'),
    metal: bank.photo('pot_metal_512', '#b8babd', { repeat: [2, 1] }),
    broth: bank.photo('dashi_broth_512', '#d09a20'),
    wood: bank.canvas('wood', 256, 256, drawWood, { wrap: true }),
    net: bank.canvas('net', 128, 128, drawNet, { wrap: true }),
    water: bank.canvas('water', 128, 128, drawWater, { wrap: false }),
    soft: bank.canvas('soft', 64, 64, drawSoft),
  };
  tex.wood.repeat.set(3, 1.4);

  // ---- 遠景：お店の写真の板ポリゴン ----
  const bd = L.backdrop;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(bd.size, bd.size),
    new THREE.MeshBasicMaterial({ map: tex.shop, color: '#f2e6d6' }));
  back.position.set(0.05, bd.y, bd.z);
  scene.add(back);
  // 静的な形は材質ごとに1つの geometry へ結合する（draw call を減らす。見た目は同じ）
  const tmpGeos = [];
  const tg = (g) => { tmpGeos.push(g); return g; };
  const c = L.counter, s = L.serve;

  // ---- 作業台と受け渡し台（木目テクスチャ×頂点色、1 draw call） ----
  const counterGeo = mergeColored([
    { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX, c.thick, c.maxZ - c.minZ)), color: '#f0d2ae', pos: V((c.minX + c.maxX) / 2, -c.thick / 2, (c.minZ + c.maxZ) / 2) },
    { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.4, 0.8, 0.03)), color: '#b98a5c', pos: V(0, -c.thick - 0.4, c.maxZ - 0.01) },
    { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.6, 0.04, s.maxZ - s.minZ)), color: '#f6dcbc', pos: V(0, s.top - 0.02, (s.minZ + s.maxZ) / 2) },
    { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.6, s.top, 0.02)), color: '#c79a6c', pos: V(0, s.top / 2 - 0.02, s.maxZ - 0.01) },
  ], { uv: true });
  scene.add(new THREE.Mesh(counterGeo, lambert({ map: tex.wood, vertexColors: true })));
  // 写真の下の床（写真の下端より手前の床のすき間を埋める）と、受け渡し台の奥の低い仕切り（お客さんの体の下を隠す）
  const plainGeo = mergeColored([
    { geo: tg(new THREE.PlaneGeometry(4, 2.2)), color: '#8d8173', pos: V(0, bd.y - bd.size / 2, bd.z + 1.1), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
    { geo: tg(new THREE.BoxGeometry(c.maxX - c.minX + 0.6, 0.5, 0.02)), color: '#7a5638', pos: V(0, s.top - 0.27, s.minZ - 0.26) },
  ]);
  scene.add(new THREE.Mesh(plainGeo, lambert({ vertexColors: true })));

  // ---- 疑似影（放射グラデーションの暗い板） ----
  const shadowMat = new THREE.MeshBasicMaterial({ map: tex.soft, color: '#000000', transparent: true, opacity: 0.22, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const staticShadows = [];   // 動かない物の影は最後に1つの geometry にまとめる
  const staticShadow = (x, y, z, sx, sz, op) => staticShadows.push({ geo: shadowGeo, color: '#000000', alpha: op, pos: V(x, y + 0.001, z), scale: V(sx, 1, sz) });
  const shadow = (x, y, z, sx, sz, op = 0.22) => {
    const m = new THREE.Mesh(shadowGeo, op === 0.22 ? shadowMat : shadowMat.clone());
    if (op !== 0.22) m.material.opacity = op;
    m.position.set(x, y + 0.001, z); m.scale.set(sx, 1, sz); m.renderOrder = 1;
    scene.add(m); return m;
  };

  // ---- まな板 ----
  const b = L.board;
  const boardGeo = new THREE.BoxGeometry(b.sizeX, b.thick, b.sizeZ);
  {  // 面の順は +x,-x,+y,-y,+z,-z（各4頂点）。上面は写真そのまま、側面は元の側面色 #e2b98a に近づく倍率を掛ける
    const n = boardGeo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const top = i >= 8 && i < 12; col.set(top ? [1, 1, 1] : [0.94, 0.83, 0.68], i * 3); }
    boardGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const board = new THREE.Mesh(boardGeo, lambert({ map: tex.board, vertexColors: true }));
  board.position.set(b.center.x, b.thick / 2, b.center.z);
  scene.add(board);
  staticShadow(b.center.x, 0, b.center.z + 0.01, b.sizeX + 0.06, b.sizeZ + 0.06, 0.18);

  // ---- 包丁（原点＝刃の下端の中心。刃は z 方向） ----
  const knife = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.095, 0); bladeShape.lineTo(0.095, 0); bladeShape.lineTo(0.095, 0.072);
  bladeShape.lineTo(-0.085, 0.072); bladeShape.quadraticCurveTo(-0.095, 0.072, -0.095, 0.06); bladeShape.lineTo(-0.095, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.004, bevelEnabled: false, curveSegments: 3 });
  bladeGeo.translate(0, 0, -0.002); bladeGeo.rotateY(Math.PI / 2);   // shape の x → ワールドの -z
  const bladeMat = phong({ vertexColors: true, specular: '#ffffff', shininess: 100 });
  knife.add(new THREE.Mesh(mergeColored([
    { geo: tg(bladeGeo), color: '#cfd6dc' },
    { geo: tg(new THREE.BoxGeometry(0.0045, 0.012, 0.19)), color: '#f4f8fb', pos: V(0, 0.006, 0) },   // 刃先
    { geo: tg(new THREE.BoxGeometry(0.008, 0.02, 0.04)), color: '#cfd6dc', pos: V(0, 0.07, 0.085) },  // 口金
  ]), bladeMat));
  const handleMat = lambert({ color: '#6b3f22' });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.12), handleMat);
  handle.position.set(0, 0.074, 0.13); handle.rotation.x = -0.18; knife.add(handle);
  knife.position.copy(L.knifeRest);
  scene.add(knife);
  const knifeProxy = proxy(new THREE.BoxGeometry(0.09, 0.14, 0.34), 'knife');
  knifeProxy.position.set(0, 0.04, 0.04); knife.add(knifeProxy); proxies.push(knifeProxy);
  const knifeShadow = shadow(L.knifeRest.x, 0, L.knifeRest.z, 0.06, 0.3, 0.16);
  glows.knife = new Glow([bladeMat, handleMat]);

  // ---- めん棒（軸は x 方向） ----
  const pr = L.pin.radius, pl = L.pin.length;
  const pinPts = [V(0, -pl / 2, 0), V(0.011, -pl / 2, 0), V(0.013, -pl / 2 + 0.02, 0), V(pr, -pl / 2 + 0.05, 0), V(pr, pl / 2 - 0.05, 0), V(0.013, pl / 2 - 0.02, 0), V(0.011, pl / 2, 0), V(0, pl / 2, 0)]
    .map((p) => new THREE.Vector2(p.x, p.y));
  const pinGeo = tg(new THREE.LatheGeometry(pinPts, 16)); pinGeo.rotateZ(Math.PI / 2);
  // 転がりが見えるように焼き印の帯2本と点（本体と1つの geometry）
  const bandGeo = tg(new THREE.CylinderGeometry(pr * 1.01, pr * 1.01, 0.012, 16, 1, true).rotateZ(Math.PI / 2));
  const pinMat = lambert({ vertexColors: true });
  const pin = new THREE.Group();
  const pinMesh = new THREE.Mesh(mergeColored([
    { geo: pinGeo, color: '#e7c08a' },
    { geo: bandGeo, color: '#b4834d', pos: V(-0.1, 0, 0) },
    { geo: bandGeo, color: '#b4834d', pos: V(0.1, 0, 0) },
    { geo: tg(new THREE.SphereGeometry(0.006, 6, 4)), color: '#9c6a3a', pos: V(0, pr, 0) },
  ]), pinMat);
  pin.add(pinMesh);
  pin.position.copy(L.pinRest);
  scene.add(pin);
  const pinProxy = proxy(new THREE.BoxGeometry(pl + 0.04, 0.09, 0.1), 'pin');
  pin.add(pinProxy); proxies.push(pinProxy);
  const pinShadow = shadow(L.pinRest.x, 0, L.pinRest.z, pl, 0.06, 0.16);
  glows.pin = new Glow([pinMat]);

  // ---- コンロと鍋 ----
  const P = L.pot;
  // コンロ・五徳・網の台（動かない無地の形、1 draw call）
  scene.add(new THREE.Mesh(mergeColored([
    { geo: tg(new THREE.CylinderGeometry(P.radius + 0.035, P.radius + 0.045, P.stove, 28)), color: '#3d3a38', pos: V(P.base.x, P.stove / 2, P.base.z) },
    { geo: tg(new THREE.TorusGeometry(P.radius - 0.03, 0.006, 6, 28).rotateX(Math.PI / 2)), color: '#1e1c1b', pos: V(P.base.x, P.stove + 0.002, P.base.z) },
    { geo: tg(new THREE.CylinderGeometry(0.07, 0.075, 0.07, 20)), color: '#9a6b44', pos: V(L.netRest.x, 0.035, L.netRest.z) },
  ]), lambert({ vertexColors: true })));
  staticShadow(P.base.x, 0, P.base.z, 0.5, 0.5, 0.25);
  const y0 = P.stove, y1 = P.stove + P.height;
  const potPts = [[0, y0], [P.radius - 0.01, y0], [P.radius, y0 + 0.01], [P.radius, y1 - 0.008], [P.radius + 0.008, y1], [P.radius + 0.004, y1 + 0.006],
    [P.inner, y1], [P.inner, y0 + 0.012], [0, y0 + 0.01]].map(([x, y]) => new THREE.Vector2(x, y));
  const potMat = phong({ map: tex.metal, color: '#e9edf0', specular: '#9aa0a6', shininess: 50 });
  const potHandleGeo = tg(new THREE.TorusGeometry(0.024, 0.006, 6, 12, Math.PI).rotateZ(-Math.PI / 2).rotateX(Math.PI / 2));
  // 鍋の本体と、横に張り出す取っ手（水平の輪）2つを1つの geometry に
  const pot = new THREE.Mesh(mergeColored([
    { geo: tg(new THREE.LatheGeometry(potPts, 40)), color: '#ffffff' },
    ...[-1, 1].map((sx) => ({ geo: potHandleGeo, color: '#ffffff', pos: V(sx * (P.radius - 0.004), y1 - 0.025, 0), rot: new THREE.Euler(0, sx > 0 ? 0 : Math.PI, 0) })),
  ], { uv: true }), potMat);
  pot.position.set(P.base.x, 0, P.base.z);
  scene.add(pot);
  // 湯は半透明（ふつうのアルファ合成。transmission は使わない）。沈んだ麺が透けて見える
  const waterMat = phong({ map: tex.water, color: '#eef5f4', specular: '#ffffff', shininess: 70, emissive: '#1d2a2c', transparent: true, opacity: 0.6, depthWrite: false });
  const water = new THREE.Mesh(new THREE.CircleGeometry(P.inner - 0.001, 40).rotateX(-Math.PI / 2), waterMat);
  water.position.set(P.base.x, P.water, P.base.z);
  water.renderOrder = 2;
  scene.add(water);
  const waterProxy = proxy(new THREE.CylinderGeometry(P.radius + 0.01, P.radius + 0.01, 0.08, 16), 'water');
  waterProxy.position.set(P.base.x, P.water, P.base.z); scene.add(waterProxy); proxies.push(waterProxy);
  glows.pot = new Glow([potMat]);

  // ---- 網（てぼ）。原点＝かごの中心 ----
  const net = new THREE.Group();
  const netR = L.net.radius, netD = L.net.depth;
  const cupPts = [];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; cupPts.push(new THREE.Vector2(Math.max(0.002, Math.sin(a) * netR), -Math.cos(a) * netD + 0.01)); }
  tex.net.repeat.set(6, 2);
  const netMat = lambert({ map: tex.net, color: '#dfe4e8', alphaTest: 0.4, side: THREE.DoubleSide, transparent: false });
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 20), netMat);
  net.add(cup);
  const metalMat = phong({ color: '#c3c8cc', specular: '#ffffff', shininess: 80 });
  const netHandle = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8), lambert({ color: '#6b3f22' }));
  grip.position.y = 0.17; netHandle.add(grip);
  netHandle.position.set(netR * 0.7, 0.01, netR * 0.7);
  netHandle.rotation.set(1.0, 0, -0.3);   // 手前・右上へ伸びる柄
  netHandle.updateMatrix();
  net.add(netHandle);
  // かごの縁と柄の金属の棒（柄の向きを焼き込んで1つの geometry に）
  net.add(new THREE.Mesh(mergeColored([
    { geo: tg(new THREE.TorusGeometry(netR, 0.004, 6, 24).rotateX(Math.PI / 2)), color: '#ffffff', pos: V(0, 0.01, 0) },
    { geo: tg(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 6)), color: '#ffffff', matrix: netHandle.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.07, 0)) },
  ]), metalMat));
  net.position.copy(L.netRest);
  scene.add(net);
  staticShadow(L.netRest.x, 0, L.netRest.z, 0.2, 0.2, 0.2);
  const netProxy = proxy(new THREE.SphereGeometry(0.085, 10, 8), 'net');
  net.add(netProxy); proxies.push(netProxy);
  const netProxy2 = proxy(new THREE.BoxGeometry(0.07, 0.24, 0.07), 'net');
  netProxy2.position.y = 0.12; netHandle.add(netProxy2); proxies.push(netProxy2);
  glows.net = new Glow([metalMat, netMat]);

  // ---- お椀。bowl＝外底の中心、bowlAnchor＝内側の底の中心（hero に渡す） ----
  const B = L.bowl;
  const bowl = new THREE.Group();
  const outerPts = [[0.0, 0.002], [0.044, 0.0], [0.047, B.foot], [0.06, B.foot + 0.004], [0.08, 0.03], [0.093, 0.055], [B.outerR, B.height], [B.outerR - 0.003, B.height + 0.004]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const innerPts = [[B.outerR - 0.003, B.height + 0.004], [B.innerR, B.height + 0.002], [0.08, 0.05], [0.064, 0.03], [B.bottomR, B.foot + 0.003], [0, B.foot]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const patternTex = bank.canvas('bowl-pattern', 256, 64, drawBowlPattern(BOWL_COLORS[0]), { wrap: true });
  patternTex.repeat.set(2, 1);
  const bowlOutMat = phong({ map: patternTex, specular: '#ffffff', shininess: 60, vertexColors: true });
  // 外側は v が下→上なので、模様の上端（色帯）が口に来るよう flip
  const outerGeo = tg(new THREE.LatheGeometry(outerPts, 36));
  { const uv = outerGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
  // 内側は模様の地の白（色帯と水玉の間、canvas の上から 30%）の1点を使う → 外と内で 1 draw call
  bowl.add(new THREE.Mesh(mergeColored([
    { geo: outerGeo, color: '#ffffff' },
    { geo: tg(new THREE.LatheGeometry(innerPts, 36)), color: '#ffffff', uv: [0.25, 0.7] },
  ], { uv: true }), bowlOutMat));
  const bowlAnchor = new THREE.Object3D();
  bowlAnchor.position.y = B.foot + 0.003;
  bowlAnchor.userData = { innerRadius: B.innerR, bottomRadius: B.bottomR, depth: B.height - B.foot, brothLevel: B.brothLevel };
  bowl.add(bowlAnchor);
  const broth = new THREE.Mesh(new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2),
    phong({ map: tex.broth, color: '#ffffff', specular: '#fff6dd', shininess: 80, transparent: true, opacity: 0.78, depthWrite: false }));
  broth.renderOrder = 2;
  bowlAnchor.add(broth);
  broth.visible = false;
  bowl.position.copy(L.bowlRest);
  scene.add(bowl);
  const bowlShadow = shadow(L.bowlRest.x, 0, L.bowlRest.z, 0.24, 0.24, 0.24);
  const bowlProxy = proxy(new THREE.CylinderGeometry(B.outerR + 0.03, B.outerR + 0.02, 0.12, 12), 'bowl');
  bowlProxy.position.y = 0.05; bowl.add(bowlProxy); proxies.push(bowlProxy);
  glows.bowl = new Glow([bowlOutMat]);
  const setBowlColor = (i) => {
    const cv = patternTex.image; drawBowlPattern(BOWL_COLORS[i % BOWL_COLORS.length])(cv.getContext('2d'), cv.width, cv.height);
    patternTex.needsUpdate = true;
  };
  // つゆの高さ → 円の半径（内側の壁に合わせる）
  const brothRadiusAt = (h) => {
    const yb = B.foot + 0.003, hb = h + yb;
    const t = Math.min(1, Math.max(0, (hb - (B.foot + 0.003)) / (B.height - B.foot)));
    return B.bottomR + (B.innerR - B.bottomR) * Math.pow(t, 0.8);
  };

  // ---- 具の小皿と具 ----
  const toppings = makeToppings();
  const dishGeo = new THREE.LatheGeometry([[0, 0.004], [0.03, 0.002], [0.034, 0.0], [L.dishR, 0.012], [L.dishR + 0.003, 0.016], [L.dishR - 0.002, 0.014], [0.03, 0.007], [0, 0.008]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const dishes = [];
  const TYPES = ['negi', 'kamaboko', 'ebiten', 'oage'];
  L.dishes.forEach((p, i) => {
    const g = new THREE.Group();
    const dmat = phong({ color: ['#f3efe6', '#e9f1f6', '#f6efe2', '#eef3ea'][i], specular: '#ffffff', shininess: 40 });
    g.add(new THREE.Mesh(dishGeo, dmat));
    const pileMat = toppings.mats[TYPES[i]].clone();
    const pileParts = [];
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i;
      pileParts.push({ geo: toppings.geos[TYPES[i]], pos: V(Math.cos(a) * 0.012, 0.012 + k * 0.006, Math.sin(a) * 0.012), rot: new THREE.Euler(0, a * 1.3, 0) });
    }
    const pile = new THREE.Mesh(mergeColored(pileParts), pileMat);   // 頂点色はそのまま、3つで 1 draw call
    g.add(pile);
    g.position.copy(p);
    scene.add(g);
    staticShadow(p.x, 0, p.z, 0.13, 0.13, 0.2);
    const px = proxy(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10), 'dish', { index: i, type: TYPES[i] });
    px.position.y = 0.03; g.add(px); proxies.push(px);
    dishes.push({ group: g, pile, type: TYPES[i], glow: new Glow([dmat, pileMat]), base: p.clone() });
  });

  // ---- お客さんの当たり（customer.js が中身を作る） ----
  const customerProxy = proxy(new THREE.BoxGeometry(0.42, 0.5, 0.3), 'customer');
  customerProxy.position.set(L.customer.x, L.customer.y + 0.25, L.customer.z);
  scene.add(customerProxy); proxies.push(customerProxy);

  // ---- 足元の当たり（何もない所を触った時の打ち粉） ----
  const tableProxy = proxy(new THREE.BoxGeometry(c.maxX - c.minX, 0.01, c.maxZ - c.minZ + 0.1), 'table');
  tableProxy.position.set(0, 0.0, (c.minZ + c.maxZ) / 2); scene.add(tableProxy); proxies.push(tableProxy);

  // 動かない物の疑似影（まな板・鍋・網の台・小皿4つ）を1 draw call に。濃さは頂点アルファ
  const staticShadowMesh = new THREE.Mesh(mergeColored(staticShadows, { alpha: true }),
    new THREE.MeshBasicMaterial({ map: tex.soft, vertexColors: true, transparent: true, depthWrite: false }));
  staticShadowMesh.renderOrder = 1;
  scene.add(staticShadowMesh);
  for (const g of new Set(tmpGeos)) g.dispose();

  return {
    scene, proxies, glows, tex,
    objs: { board, knife, knifeShadow, pin, pinMesh, pinShadow, net, netHandle, pot, water, bowl, bowlAnchor, broth, bowlShadow, dishes, toppings },
    setBowlColor, brothRadiusAt,
  };
}

function drawWater(g, w, h) {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, '#f6fbfb'); r.addColorStop(1, '#cfdcdc');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
  for (let k = 0; k < 5; k++) {            // 渦の筋（かき混ぜると回って見える）
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = k * 1.256 + t * 2.4, rr = (0.12 + t * 0.36) * w;
      const x = w / 2 + Math.cos(a) * rr, y = h / 2 + Math.sin(a) * rr;
      if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
}

// 具：ねぎ・かまぼこ・えび天・おあげ（各1 mesh、頂点色）
function makeToppings() {
  const geos = {}, mats = {};
  // ねぎ：小さな輪を5つ
  const ring = new THREE.TorusGeometry(0.0068, 0.0026, 5, 10);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7, r = i === 0 ? 0 : 0.011;
    parts.push({ geo: ring, color: i % 2 ? '#8fd16a' : '#5fae45', pos: V(Math.cos(a) * r, 0.002 + (i % 3) * 0.0015, Math.sin(a) * r), rot: new THREE.Euler(Math.PI / 2 + (i % 2) * 0.3, 0, 0) });
  }
  geos.negi = mergeColored(parts);
  // かまぼこ：D の形（白）に桃色の縁
  const d = (sx, sy) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.024 * sx, 0); sh.lineTo(0.024 * sx, 0);
    sh.absellipse(0, 0, 0.024 * sx, 0.02 * sy, 0, Math.PI, false);
    return sh;
  };
  const kw = new THREE.ExtrudeGeometry(d(1, 1), { depth: 0.008, bevelEnabled: false, curveSegments: 10 });
  const kp = new THREE.ExtrudeGeometry(d(1.12, 1.2), { depth: 0.0075, bevelEnabled: false, curveSegments: 10 });
  geos.kamaboko = mergeColored([
    { geo: kp, color: '#f48aa8', pos: V(0, 0.0005, 0.002), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
    { geo: kw, color: '#fffaf4', pos: V(0, 0.001, 0.0), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
  ]);
  kw.dispose(); kp.dispose();
  // えび天：ゆるく曲がった衣＋赤いしっぽ
  const curve = new THREE.CatmullRomCurve3([V(-0.04, 0.012, 0.0), V(-0.01, 0.016, 0.008), V(0.02, 0.014, 0.004), V(0.038, 0.01, -0.006)]);
  const body = new THREE.TubeGeometry(curve, 12, 0.012, 8, false);
  { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + 0.12 * Math.sin(i * 2.3) * Math.cos(i * 0.7); p.setY(i, 0.012 + (p.getY(i) - 0.012) * n); } body.computeVertexNormals(); }
  const capA = new THREE.SphereGeometry(0.012, 8, 6);
  const tail = new THREE.ConeGeometry(0.011, 0.024, 6);
  geos.ebiten = mergeColored([
    { geo: body, color: '#e3a947' },
    { geo: capA, color: '#e3a947', pos: V(-0.04, 0.012, 0) },
    { geo: tail, color: '#e8553a', pos: V(0.05, 0.01, -0.01), rot: new THREE.Euler(0, 0, -Math.PI / 2), scale: V(1, 1, 0.45) },
  ]);
  body.dispose(); capA.dispose(); tail.dispose();
  // おあげ：ふっくらした茶色の四角
  const og = new THREE.BoxGeometry(0.058, 0.012, 0.044, 4, 1, 4);
  { const p = og.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 0.029, z = p.getZ(i) / 0.022; const k = 1 - 0.25 * (x * x * z * z); p.setY(i, p.getY(i) * (0.6 + 0.6 * k) + 0.006); } og.computeVertexNormals(); }
  geos.oage = mergeColored([{ geo: og, color: '#c98436' }]);
  og.dispose();
  ring.dispose();
  for (const k of Object.keys(geos)) mats[k] = new THREE.MeshLambertMaterial({ vertexColors: true });
  return { geos, mats };
}
