// New things born from the pressed block: ball / bench / flowerpot, painted with the child's stripes.
import * as THREE from '../vendor/three.module.min.js';
import { box, cyl, sphere, merge, place, paint } from './geo.js';
import { potLathe } from './plant.js';
import { easeOutElastic, clamp } from './util.js';

export const GIFT_TYPES = ['ball', 'bench', 'pot'];

export function createGift(type, stripesTex, mat) {
  const root = new THREE.Group();
  root.name = 'gift-' + type;
  const sMat = new THREE.MeshLambertMaterial({ map: stripesTex });
  const spin = new THREE.Group(); // inner node that "plays"
  root.add(spin);
  let flower = null, height = 0.8;
  if (type === 'ball') {
    const g = new THREE.SphereGeometry(0.42, 24, 14);
    const m = new THREE.Mesh(g, sMat);
    m.position.y = 0.42;
    spin.add(m);
    height = 0.84;
  } else if (type === 'bench') {
    const seat = merge([
      place(paint(new THREE.BoxGeometry(1.4, 0.14, 0.52), 0xffffff, 'keep'), 0, 0.46, 0),
      place(paint(new THREE.BoxGeometry(1.4, 0.42, 0.1), 0xffffff, 'keep'), 0, 0.8, -0.22, -0.12, 0, 0),
    ]);
    spin.add(new THREE.Mesh(seat, sMat));
    const legs = merge([-0.55, 0.55].flatMap((x) => [place(box(0.1, 0.4, 0.1, 0x8a5a3a), x, 0.2, 0.18), place(box(0.1, 0.4, 0.1, 0x8a5a3a), x, 0.2, -0.18)]));
    spin.add(new THREE.Mesh(legs, mat));
    height = 1.0;
  } else {
    const pot = new THREE.Mesh(potLathe(), sMat);
    spin.add(pot);
    spin.add(new THREE.Mesh(merge([place(cyl(0.42, 0.42, 0.04, 0x6b4a2e, 16), 0, 0.64, 0)]), mat));
    flower = new THREE.Group();
    flower.position.y = 0.64;
    const petals = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; petals.push(place(sphere(0.13, 0xff7ab6, 8, 6), Math.cos(a) * 0.17, 0.9, Math.sin(a) * 0.17 + 0.02, 0, 0, 0, 1, 1, 0.5)); }
    flower.add(new THREE.Mesh(merge([
      place(cyl(0.035, 0.035, 0.9, 0x4fb84a, 6), 0, 0.45, 0),
      place(sphere(0.12, 0x4fb84a, 8, 4), 0.14, 0.4, 0, 0, 0, -0.6, 1.4, 0.4, 0.7),
      place(sphere(0.12, 0x4fb84a, 8, 4), -0.14, 0.55, 0, 0, 0, 0.6, 1.4, 0.4, 0.7),
      ...petals,
      place(sphere(0.09, 0xffd23f, 8, 6), 0, 0.9, 0.06),
    ]), mat));
    flower.scale.setScalar(0.001);
    spin.add(flower);
    height = 0.75;
  }
  let t = 0, playT = -1, mode = 'idle';
  return {
    root, type, height, material: sMat,
    get mode() { return mode; },
    setMode(m) { mode = m; t = 0; if (m === 'play') playT = 0; },
    update(dt) {
      t += dt;
      spin.position.y = 0; spin.rotation.set(0, 0, 0);
      if (mode === 'idle') {
        spin.position.y = 0.08 + Math.sin(t * 3) * 0.08;
        spin.rotation.y = Math.sin(t * 1.3) * 0.4;
      } else if (mode === 'play' || mode === 'friend') {
        if (playT >= 0) playT += dt;
        const pt = mode === 'friend' ? 10 + t : playT;
        if (type === 'ball') {
          const b = Math.abs(Math.sin(pt * 3.2));
          spin.position.y = b * (mode === 'friend' ? 0.35 : 0.9);
          spin.rotation.z = -pt * 2;
        } else if (type === 'pot' && flower) {
          const k = clamp(pt / 1.2, 0, 1);
          flower.scale.setScalar(Math.max(0.001, easeOutElastic(k)));
          flower.rotation.z = Math.sin(pt * 1.7) * 0.08;
        }
      }
    },
    dispose() {
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      sMat.dispose();
      if (stripesTex) stripesTex.dispose();
    },
  };
}
