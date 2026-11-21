// Scene B: the recycling plant. Built lazily on the first visit (not at startup).
// The press bed is centred on the hero's dumpSpot (world), so the dumped pile lands on it.
import * as THREE from '../vendor/three.module.min.js';
import { box, cyl, sphere, rbox, merge, place, paint, uvRect } from './geo.js';
import { ATLAS, makePlantWall } from './textures.js';

export const PLANT = {
  camera: { pos: [0, 6.0, 12.8], look: [0, 1.15, 0.3], fitHalfWidth: 5.3, fitDepth: 9.9 },
  buttonPos: [0.6, 0, 3.0],
  homePos: [0.6, 0, 3.1],
  moldXs: [-3.2, -1.1, 1.0],
  moldZ: 3.25,
  animalPos: [3.3, 0, 4.1], // in front of the cab, clear of the wheels: the friend is the point of the whole scene
  animalScale: 1.3,
  cubeSize: 1.3,
};

export function createPlant(tex, mat, pressX, pressZ) {
  const group = new THREE.Group();
  group.name = 'plant';
  const owned = []; // materials/textures to dispose

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshLambertMaterial({ color: 0xd6dade }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01;
  group.add(ground); owned.push(ground.material);

  const wallTex = makePlantWall();
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(10, 1);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 9), new THREE.MeshLambertMaterial({ map: wallTex }));
  wall.position.set(0, 4.5, -9.5);
  group.add(wall); owned.push(wall.material, wallTex);

  // floor markings + roof edge + side bollards (merged)
  const deco = [];
  deco.push(place(box(70, 0.4, 0.6, 0xffd54a), 0, 9.1, -9.3));
  deco.push(place(box(30, 0.01, 0.18, 0xffd54a), 0, 0.006, 1.6));
  deco.push(place(box(30, 0.01, 0.18, 0xffd54a), 0, 0.006, -3.0));
  for (const x of [-9, -6.5, 7, 9.5]) {
    deco.push(place(cyl(0.18, 0.2, 0.9, 0xff9f43, 10), x, 0.45, 1.9));
    deco.push(place(cyl(0.19, 0.19, 0.12, 0xffffff, 10), x, 0.7, 1.9));
  }
  // simple green hills peeking over the wall
  for (const [x, r] of [[-14, 5], [-4, 4], [9, 6]]) deco.push(place(paint(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x8fd16a), x, 9, -12));
  group.add(new THREE.Mesh(merge(deco), mat));

  // ---- press machine ----
  const press = new THREE.Group();
  press.position.set(pressX, 0, pressZ);
  group.add(press);
  const steelMat = new THREE.MeshLambertMaterial({ map: tex.photo.steel, color: 0xe8e8e8 });
  owned.push(steelMat);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 3.2), steelMat);
  bed.position.y = 0.03;
  press.add(bed);
  const frame = [];
  for (const sx of [-1, 1]) frame.push(place(rbox(0.4, 4.6, 0.4, 0.08, 0xffc93c), sx * 1.85, 2.3, -1.7));
  frame.push(place(rbox(4.2, 0.5, 0.6, 0.1, 0xffc93c), 0, 4.6, -1.7));
  frame.push(place(rbox(0.5, 0.4, 2.0, 0.08, 0xffc93c), 0, 4.6, -0.6));
  frame.push(place(box(3.6, 0.04, 0.2, 0x333333), 0, 0.065, 1.55));
  press.add(new THREE.Mesh(merge(frame), mat));
  const headMat = mat.clone(); owned.push(headMat);
  const head = new THREE.Group();
  const headParts = [
    place(rbox(2.5, 0.6, 2.5, 0.12, 0xff8a3d), 0, 0.3, 0),
    place(box(2.3, 0.08, 2.3, 0x555555), 0, 0.0, 0),
  ];
  for (let i = -2; i <= 2; i++) headParts.push(place(box(0.25, 0.62, 0.02, 0x333333), i * 0.5, 0.3, 1.255, 0, 0, 0.5));
  head.add(new THREE.Mesh(merge(headParts), headMat));
  const rod = new THREE.Mesh(merge([cyl(0.18, 0.18, 1, 0xbfc6cc, 12)]), mat);
  rod.position.y = 0.5;
  head.add(rod);
  head.position.set(0, 3.3, 0);
  const headHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 3.2), mat);
  headHit.visible = false; headHit.position.y = 0.2;
  head.add(headHit);
  press.add(head);
  const pressApi = {
    root: press, head, headMat, hit: headHit, bed,
    topY: 3.3, bottomY: PLANT.cubeSize,
    setHeadY(y) {
      head.position.y = y;
      const len = Math.max(0.1, 4.5 - y - 0.6);
      rod.scale.y = len; rod.position.y = 0.6 + len / 2;
    },
  };
  pressApi.setHeadY(pressApi.topY);

  // ---- big round button ----
  const button = makePushable(mat, owned, [
    place(cyl(0.75, 0.85, 0.7, 0xffd23f, 20), 0, 0.35, 0),
    place(cyl(0.68, 0.68, 0.06, 0x333333, 20), 0, 0.72, 0),
  ], merge([place(paint(new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xff4a4a), 0, 0, 0, 0, 0, 0, 1, 0.6, 1)]), 0.74);
  button.root.position.set(...PLANT.buttonPos);
  group.add(button.root);

  // ---- home button (green disc + house pictogram) ----
  const houseIcon = uvRect(paint(new THREE.CircleGeometry(0.6, 24), 0xffffff, 'keep'), ATLAS.cell(...ATLAS.icon.house));
  const home = makePushable(mat, owned, [
    place(cyl(0.7, 0.8, 0.5, 0xffffff, 20), 0, 0.25, 0),
  ], merge([place(cyl(0.78, 0.78, 0.22, 0x39b86a, 24), 0, 0.11, 0), place(houseIcon, 0, 0.226, 0, -Math.PI / 2, 0, 0)]), 0.5);
  home.root.position.set(...PLANT.homePos);
  home.root.rotation.x = 0;
  home.top.rotation.x = 0.55; // tilt the face toward the camera
  group.add(home.root);

  // ---- molds: ball / bench / flowerpot ----
  const moldShapes = {
    ball: () => [place(sphere(0.48, 0xbfe6ff, 16, 10), 0, 0.48, 0)],
    bench: () => [
      place(rbox(1.3, 0.14, 0.5, 0.05, 0xffd6a8), 0, 0.45, 0),
      place(rbox(1.3, 0.4, 0.1, 0.04, 0xffd6a8), 0, 0.75, -0.2),
      ...[-0.5, 0.5].map((x) => place(box(0.1, 0.4, 0.4, 0xd9a066), x, 0.2, 0)),
    ],
    pot: () => [place(paint(potLathe(), 0xffc2dd), 0, 0, 0), place(cyl(0.04, 0.04, 0.4, 0x5cc45a, 6), 0, 0.85, 0), place(sphere(0.14, 0xff7ab6, 8, 6), 0, 1.08, 0)],
  };
  const molds = ['ball', 'bench', 'pot'].map((type, i) => {
    const m = makePushable(mat, owned, [place(cyl(0.72, 0.8, 0.36, 0xffffff, 20), 0, 0.18, 0), place(cyl(0.74, 0.74, 0.05, 0xb8e8ff, 20), 0, 0.37, 0)], merge(moldShapes[type]()), 0.38);
    m.type = type;
    m.root.position.set(PLANT.moldXs[i], 0, PLANT.moldZ + (i === 1 ? 0.25 : 0));
    group.add(m.root);
    return m;
  });

  // ---- pressed block (stripes texture set per round) ----
  const s = PLANT.cubeSize;
  const cubeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  owned.push(cubeMat);
  const cube = new THREE.Mesh(roundedCube(s), cubeMat);
  cube.position.set(pressX, s / 2 + 0.06, pressZ);
  cube.visible = false;
  group.add(cube);
  const cubeHit = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s * 1.5, s * 1.5), mat);
  cubeHit.visible = false; cube.add(cubeHit);

  // halo ring under the currently active thing
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.0, depthWrite: false });
  owned.push(haloMat);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 40), haloMat);
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; halo.renderOrder = 1;
  group.add(halo);

  return {
    group, press: pressApi, button, home, molds, cube, cubeHit, cubeMat, halo, haloMat,
    pressPos: new THREE.Vector3(pressX, 0, pressZ),
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      owned.forEach((x) => x.dispose());
    },
  };
}

/** Something with a base, a moving top (pressable / bobbing) and an invisible hit cylinder. */
function makePushable(mat, owned, baseParts, topGeo, topY) {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(merge(baseParts), mat));
  const topMat = mat.clone(); owned.push(topMat);
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = topY;
  root.add(top);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), mat);
  hit.visible = false; hit.position.y = 0.8;
  root.add(hit);
  root.scale.setScalar(0.001);
  root.visible = false;
  return { root, top, topMat, hit, topY, shown: 0 };
}

export function potLathe() {
  const pts = [[0, 0], [0.32, 0], [0.36, 0.05], [0.46, 0.6], [0.54, 0.62], [0.54, 0.72], [0.44, 0.72], [0.42, 0.66], [0, 0.66]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 20);
}

function roundedCube(s) {
  // box with UVs per face (stripes run horizontally on the sides)
  return new THREE.BoxGeometry(s, s, s);
}
