// Garbage bins (shell-owned). Shape contract with the hero: see docs/HERO-SPEC.md "ごみ箱".
// root origin = bottom centre, +z faces the camera, -z faces the truck. lid pivot = hinge at
// (0, h, -d/2); opening = negative rotation.x. contents = the stuff peeking out of the bin.
import * as THREE from '../vendor/three.module.min.js';
import { rbox, cyl, sphere, box, merge, place, paint, uvRect, roundedBox } from './geo.js';
import { ATLAS } from './textures.js';

export const BIN_SIZE = { w: 0.9, d: 0.9, h: 1.15 };

export const KINDS = {
  paper: { body: 0xffd23f, lid: 0xf2b705, layer: 0xfff08a, colors: [0xffffff, 0xfff3b0, 0xffd6e8, 0xd8f0ff] },
  box: { body: 0xff9f43, lid: 0xe57d1e, layer: 0xd9a066, colors: [0xc98b4a, 0xe0a868, 0xb07038, 0xf0c890] },
  bottle: { body: 0x4aa3ff, lid: 0x2b7fd9, layer: 0x7fd0ff, colors: [0x9fdcff, 0x6ec6ff, 0xc8f0ff, 0x7be0c0] },
  can: { body: 0xff5e5e, lid: 0xd93a3a, layer: 0xff8a8a, colors: [0xff4d4d, 0xd8d8d8, 0xffc93c, 0x8fd0ff] },
  bag: { body: 0x4cd07d, lid: 0x2fa85c, layer: 0xc38bff, colors: [0xff7ac6, 0xb07aff, 0x7af0a0, 0xffe07a] },
};
export const KIND_ORDER = ['paper', 'box', 'bottle', 'can', 'bag'];

/** One representative trash piece (painted). Used for the bin's peeking contents. */
export function pieceGeo(kind, color) {
  switch (kind) {
    case 'paper': return paint(new THREE.IcosahedronGeometry(0.15, 0).scale(1, 0.85, 1), color);
    case 'box': return rbox(0.3, 0.2, 0.24, 0.03, color, 1);
    case 'bottle': return merge([cyl(0.08, 0.08, 0.28, color, 10), place(cyl(0.035, 0.075, 0.1, color, 10), 0, 0.19, 0), place(cyl(0.042, 0.042, 0.05, 0xffffff, 8), 0, 0.26, 0)]);
    case 'can': return merge([cyl(0.075, 0.075, 0.2, color, 12), place(cyl(0.07, 0.07, 0.02, 0xdddddd, 12), 0, 0.105, 0)]);
    default: return merge([paint(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.7, 0.9), color), place(paint(new THREE.ConeGeometry(0.05, 0.1, 6), color), 0, 0.12, 0)]);
  }
}

function bodyGeo(def) {
  const { w, d, h } = BIN_SIZE;
  const bh = h - 0.1;
  const body = paint(roundedBox(w, bh, d, 0.09, 2), def.body);
  // taper: narrower at the bottom
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = 0.86 + 0.14 * ((y + bh / 2) / bh);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  place(body, 0, 0.1 + bh / 2, 0);
  const parts = [body];
  // dark opening rim (visible when the lid opens)
  parts.push(place(box(w * 0.86, 0.02, d * 0.86, 0x3a3a3a), 0, h - 0.005, 0));
  // wheels at the hinge (truck) side, handle bar
  for (const sx of [-1, 1]) parts.push(place(cyl(0.13, 0.13, 0.1, 0x333333, 12), sx * 0.36, 0.13, -d / 2 + 0.08, 0, 0, Math.PI / 2));
  parts.push(place(cyl(0.035, 0.035, w * 0.8, def.lid, 8), 0, h - 0.16, -d / 2 - 0.06, 0, 0, Math.PI / 2));
  // pictogram decal on the camera side
  const decal = uvRect(paint(new THREE.PlaneGeometry(0.44, 0.44), 0xffffff, 'keep'), ATLAS.cell(...ATLAS.icon[def.kind]));
  parts.push(place(decal, 0, 0.58, d * 0.468, -0.07, 0, 0));
  return merge(parts);
}

function lidGeo(def) {
  const { w, d } = BIN_SIZE;
  return merge([
    place(rbox(w + 0.06, 0.1, d + 0.06, 0.04, def.lid, 1), 0, 0.05, (d + 0.06) / 2 - 0.03),
    place(rbox(0.3, 0.06, 0.08, 0.02, def.lid, 1), 0, 0.02, d + 0.04),
  ]);
}

function contentsGeo(def, rnd) {
  const { h } = BIN_SIZE;
  const parts = [];
  const spots = [[-0.2, 0.02, 0.15], [0.18, 0.05, 0.18], [0.0, 0.08, -0.05], [-0.22, 0.0, -0.2], [0.22, 0.02, -0.18]];
  spots.forEach((s, i) => {
    const g = pieceGeo(def.kind, def.colors[Math.floor(rnd() * def.colors.length)]);
    place(g, s[0], h - 0.12 + s[1], s[2], rnd() * 0.8 - 0.4, rnd() * 3, rnd() * 0.8 - 0.4);
    parts.push(g);
  });
  return merge(parts);
}

export function createBins(mat, rnd = Math.random) {
  const bins = [];
  KIND_ORDER.forEach((kind, i) => {
    const def = { kind, ...KINDS[kind] };
    const root = new THREE.Group();
    root.name = 'bin-' + kind;
    root.userData.shellOwned = true; // lent to the hero while the arm holds it; not counted as hero in ?debug=1
    const body = new THREE.Mesh(bodyGeo(def), mat);
    root.add(body);
    const lid = new THREE.Group();
    lid.position.set(0, BIN_SIZE.h, -BIN_SIZE.d / 2);
    lid.add(new THREE.Mesh(lidGeo(def), mat));
    root.add(lid);
    const contents = new THREE.Mesh(contentsGeo(def, rnd), mat);
    root.add(contents);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.6, 1.25), mat);
    hit.position.y = 0.75; hit.visible = false;
    root.add(hit);
    const bin = {
      id: i + 1, kind, def, root, lid, contents, hit, body,
      size: { ...BIN_SIZE },
      load: { kind, colors: def.colors.slice(), count: 8, layerColor: def.layer },
      full: true, state: 'home', home: new THREE.Vector3(), rest: new THREE.Vector3(),
      marker: null, placedAt: 0, bob: Math.random() * 6, lift: 0, wiggle: 0, glow: 0,
    };
    hit.userData.bin = bin;
    bins.push(bin);
  });
  return bins;
}

/** Fill the bin again with freshly coloured stuff. */
export function refillBin(bin, rnd = Math.random) {
  bin.contents.geometry.dispose();
  const cols = shuffled(bin.def.colors, rnd);
  bin.contents.geometry = contentsGeo({ ...bin.def, colors: cols.slice(0, 3) }, rnd);
  bin.contents.visible = true;
  bin.load.colors = cols;
  bin.full = true;
  bin.lid.rotation.x = -0.2;
}

function shuffled(a, rnd) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export function disposeBins(bins) {
  for (const b of bins) b.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
