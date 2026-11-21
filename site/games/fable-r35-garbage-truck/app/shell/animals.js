// The friend who receives the gift: simple round animals with big friendly faces (never realistic).
import * as THREE from '../vendor/three.module.min.js';
import { sphere, cone, torus, merge, place, paint } from './geo.js';
import { clamp, damp } from './util.js';

export const ANIMAL_KINDS = ['bunny', 'bear', 'cat', 'panda'];

const LOOK = {
  bunny: { fur: 0xfff7f2, belly: 0xffffff, ear: 0xffb3c9, muzzle: 0xffffff, nose: 0xff7aa2 },
  bear: { fur: 0xc98a55, belly: 0xf1d2ad, ear: 0xa86a3c, muzzle: 0xf1d2ad, nose: 0x4a2e1e },
  cat: { fur: 0xffb35c, belly: 0xfff1dc, ear: 0xff9a3c, muzzle: 0xfff1dc, nose: 0xff7aa2 },
  panda: { fur: 0xffffff, belly: 0xffffff, ear: 0x2b2b2b, muzzle: 0xffffff, nose: 0x2b2b2b },
};

export function createAnimal(kind, mat) {
  const L = LOOK[kind] || LOOK.bunny;
  const root = new THREE.Group();
  root.name = 'animal-' + kind;
  const body = new THREE.Group();
  root.add(body);

  const torsoParts = [
    place(sphere(0.42, L.fur, 14, 10), 0, 0.52, 0, 0, 0, 0, 1, 1.02, 0.92),
    place(sphere(0.3, L.belly, 12, 8), 0, 0.48, 0.17, 0, 0, 0, 1, 1.05, 0.75),
    place(sphere(0.15, kind === 'panda' ? 0x2b2b2b : L.fur, 10, 6), -0.19, 0.1, 0.12, 0, 0, 0, 1, 0.7, 1.3),
    place(sphere(0.15, kind === 'panda' ? 0x2b2b2b : L.fur, 10, 6), 0.19, 0.1, 0.12, 0, 0, 0, 1, 0.7, 1.3),
    place(sphere(kind === 'bunny' ? 0.13 : 0.09, kind === 'bunny' ? 0xffffff : L.fur, 8, 6), 0, 0.32, -0.42),
  ];
  if (kind === 'cat') torsoParts.push(place(paint(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), L.fur), 0.12, 0.55, -0.42, 0.6, 0, -0.3));
  body.add(new THREE.Mesh(merge(torsoParts), mat));

  const head = new THREE.Group();
  head.position.y = 1.08;
  body.add(head);
  const headParts = [
    place(sphere(0.44, L.fur, 16, 12), 0, 0, 0, 0, 0, 0, 1.05, 0.95, 1),
    place(sphere(0.17, L.muzzle, 12, 8), 0, -0.12, 0.33, 0, 0, 0, 1.2, 0.85, 0.8),
    place(sphere(0.05, L.nose, 8, 6), 0, -0.06, 0.47, 0, 0, 0, 1.3, 0.9, 1),
    place(torus(0.07, 0.016, 0x5a3a2a, Math.PI, 5, 10), 0, -0.15, 0.45, 0, 0, Math.PI),
    place(sphere(0.08, 0xff9fbf, 8, 6), -0.26, -0.1, 0.33, 0, 0, 0, 1, 0.6, 0.5),
    place(sphere(0.08, 0xff9fbf, 8, 6), 0.26, -0.1, 0.33, 0, 0, 0, 1, 0.6, 0.5),
  ];
  for (const sx of [-1, 1]) {
    if (kind === 'bunny') {
      headParts.push(place(sphere(0.12, L.fur, 10, 8), sx * 0.16, 0.5, -0.02, 0, 0, sx * -0.12, 1, 3.0, 0.7));
      headParts.push(place(sphere(0.07, L.ear, 8, 6), sx * 0.16, 0.5, 0.05, 0, 0, sx * -0.12, 1, 3.4, 0.5));
    } else if (kind === 'cat') {
      headParts.push(place(cone(0.16, 0.3, L.ear, 4), sx * 0.24, 0.42, 0, 0, Math.PI / 4, sx * -0.35));
    } else {
      headParts.push(place(sphere(0.14, L.ear, 10, 8), sx * 0.3, 0.33, -0.02, 0, 0, 0, 1, 1, 0.6));
    }
    if (kind === 'panda') headParts.push(place(sphere(0.1, 0x2b2b2b, 8, 6), sx * 0.15, 0.06, 0.36, 0, 0, sx * 0.5, 1, 1.4, 0.5));
  }
  head.add(new THREE.Mesh(merge(headParts), mat));

  const eyesOpen = new THREE.Mesh(merge([
    place(sphere(0.06, 0x1d1d1d, 10, 8), -0.15, 0.06, 0.39), place(sphere(0.06, 0x1d1d1d, 10, 8), 0.15, 0.06, 0.39),
    place(sphere(0.02, 0xffffff, 6, 4), -0.13, 0.09, 0.445), place(sphere(0.02, 0xffffff, 6, 4), 0.17, 0.09, 0.445),
  ]), mat);
  const eyesHappy = new THREE.Mesh(merge([
    place(torus(0.06, 0.018, 0x1d1d1d, Math.PI, 5, 10), -0.15, 0.04, 0.41),
    place(torus(0.06, 0.018, 0x1d1d1d, Math.PI, 5, 10), 0.15, 0.04, 0.41),
  ]), mat);
  eyesHappy.visible = false;
  head.add(eyesOpen, eyesHappy);

  const arms = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.36, 0.78, 0.05);
    g.add(new THREE.Mesh(merge([place(sphere(0.11, L.fur, 10, 6), 0, -0.2, 0, 0, 0, 0, 1, 2.0, 1)]), mat));
    body.add(g);
    return g;
  });

  const holdPoint = new THREE.Object3D();
  holdPoint.position.set(0, 0.72, 0.62);
  body.add(holdPoint);

  const look = new THREE.Vector3(0, 1, 10), tmp = new THREE.Vector3();
  let mode = 'wait', t = Math.random() * 3, modeT = 0, blink = 2, happyT = 0, pokeT = 0, sit = 0;
  const api = {
    root, kind, holdPoint, head,
    get mode() { return mode; },
    setMode(m) { if (m !== mode) { mode = m; modeT = 0; } },
    setSit(v) { sit = v; },
    lookAt(p) { look.copy(p); },
    poke() { pokeT = 0.5; },
    cheer() { happyT = 1.8; },
    update(dt) {
      t += dt; modeT += dt;
      pokeT = Math.max(0, pokeT - dt);
      happyT = Math.max(0, happyT - dt);
      // head looks at the point of interest (yaw only, gentle)
      tmp.copy(look); root.worldToLocal(tmp);
      const yaw = clamp(Math.atan2(tmp.x, Math.max(0.1, tmp.z)), -0.7, 0.7);
      head.rotation.y = damp(head.rotation.y, yaw, 5, dt);
      // blink
      blink -= dt;
      if (blink < 0) blink = 2.5 + Math.random() * 2;
      const happy = happyT > 0 || mode === 'happy' || (mode === 'friend' && Math.sin(t * 0.7) > 0.6);
      eyesHappy.visible = happy; eyesOpen.visible = !happy;
      eyesOpen.scale.y = blink < 0.12 ? 0.15 : 1;

      let y = 0, sq = 1, aL = 0.15, aR = 0.15, fx = 0;
      const breathe = 1 + 0.02 * Math.sin(t * 2.4);
      if (mode === 'wait') {
        aR = 2.4 + 0.45 * Math.sin(t * 7); // wave
        aL = 0.2;
      } else if (mode === 'reach') {
        fx = -1.25 + 0.1 * Math.sin(t * 6);
        y = Math.abs(Math.sin(t * 5)) * 0.08;
      } else if (mode === 'hold') {
        fx = -1.0; aL = aR = 0.35;
      } else if (mode === 'happy') {
        const hop = Math.abs(Math.sin(modeT * 6.5));
        y = hop * 0.45; sq = 1 + (hop < 0.25 ? -0.12 : 0.06);
        aL = aR = 2.6 + 0.3 * Math.sin(modeT * 13);
      } else if (mode === 'friend') {
        y = Math.max(0, Math.sin(t * 2.2)) * 0.12;
        aR = 0.3 + 0.4 * Math.max(0, Math.sin(t * 1.1));
      }
      if (pokeT > 0) { y += Math.sin((pokeT / 0.5) * Math.PI) * 0.3; aL = aR = 2.2; }
      if (happyT > 0 && mode !== 'happy') { const hop = Math.abs(Math.sin(happyT * 6.5)); y += hop * 0.3; aL = aR = 2.5; }
      body.position.y = y + sit * 0.42;
      body.scale.set(1 / Math.sqrt(sq), sq * breathe, 1 / Math.sqrt(sq));
      arms[0].rotation.set(fx, 0, -aL);
      arms[1].rotation.set(fx, 0, aR);
    },
    dispose() { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); },
  };
  return api;
}
