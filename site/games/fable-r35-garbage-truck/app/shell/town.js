// Scene A: the street in front of the child's house. Low poly + photo backdrop.
// World layout (m): near sidewalk z∈[1.15, 8] (bins), curb z=1, road z∈[-6.5, 1], far sidewalk z∈[-9.5,-6.5],
// backdrop board at z=-9.5. Camera from +z looking at the truck's arm side.
import * as THREE from '../vendor/three.module.min.js';
import { box, cyl, sphere, cone, merge, place, paint } from './geo.js';

export const TOWN = {
  curbZ: 1.0,
  markerZ: 1.75,
  binRowZ: 5.1, // far enough in front of the markers that the glowing circles are never hidden behind the bins
  sidewalk: { xMin: -5.2, xMax: 5.2, zMin: 1.45, zMax: 6.1 },
  markerXs: [-2.3, 0, 2.3],
  binXs: [-3.5, -1.75, 0, 1.75, 3.5],
  friendSlots: [[-6.4, -7.6], [6.4, -7.6], [-8.6, -7.9], [8.6, -7.9]],
  camera: { pos: [0, 6.4, 12.8], look: [0, 0.9, 0.4], fitHalfWidth: 5.3, fitDepth: 9.9 },
};

export function createTown(tex, mat, markerXs = TOWN.markerXs) {
  const group = new THREE.Group();
  group.name = 'town';

  // ground (grass), road, sidewalks
  const grassMat = new THREE.MeshLambertMaterial({ map: tex.canvas.grass });
  tex.canvas.grass.repeat.set(12, 6);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), grassMat);
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, 0);
  group.add(grass);

  const roadMat = new THREE.MeshLambertMaterial({ map: tex.photo.asphalt, color: 0xd8d8d8 });
  if (tex.photo.asphalt) tex.photo.asphalt.repeat.set(9, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(64, 7.5), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -2.75);
  group.add(road);

  const tileMat = new THREE.MeshLambertMaterial({ map: tex.canvas.tile });
  tex.canvas.tile.repeat.set(32, 4);
  const nearWalk = new THREE.Mesh(new THREE.PlaneGeometry(64, 8), tileMat);
  nearWalk.rotation.x = -Math.PI / 2; nearWalk.position.set(0, 0.01, 1.1 + 4);
  group.add(nearWalk);
  const farWalk = new THREE.Mesh(new THREE.PlaneGeometry(64, 3), tileMat);
  farWalk.rotation.x = -Math.PI / 2; farWalk.position.set(0, 0.01, -8.0);
  group.add(farWalk);

  // curbs + lane dashes + a few low-poly bushes/flowers (merged, one draw call)
  const deco = [];
  deco.push(place(box(64, 0.16, 0.3, 0xd9d9d9), 0, 0.08, 1.0));
  deco.push(place(box(64, 0.16, 0.3, 0xd9d9d9), 0, 0.08, -6.5));
  for (let x = -30; x <= 30; x += 3) deco.push(place(box(1.6, 0.012, 0.16, 0xffffff), x, 0.012, -2.75));
  const rnd = mulberry(11);
  // near-side flower boxes at the screen edges (frame the child's "own" house front)
  for (const sx of [-1, 1]) {
    deco.push(place(box(1.6, 0.4, 0.7, 0xb5835a), sx * 6.4, 0.2, 5.9));
    for (let i = 0; i < 5; i++) {
      deco.push(place(sphere(0.2, [0xff7ab6, 0xffd23f, 0xffffff, 0xff9f43][i % 4], 8, 6), sx * 6.4 + (i - 2) * 0.32, 0.5, 5.9 + (rnd() - 0.5) * 0.3));
    }
  }
  const decoMesh = new THREE.Mesh(merge(deco), mat);
  group.add(decoMesh);

  // backdrop: one board with the photo (houses/trees). Mirrored repeat widens it seamlessly.
  const bdW = 48, bdH = bdW / 2 * (800 / 1024);
  const bdMat = new THREE.MeshBasicMaterial({ map: tex.photo.town, color: 0xf4f4f4, fog: false });
  if (tex.photo.town) { tex.photo.town.repeat.set(2, 1); tex.photo.town.offset.set(0.5, 0); }
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(bdW, bdH), bdMat);
  backdrop.position.set(0, bdH / 2 - 1.5, -9.6);
  group.add(backdrop);

  // markers (glowing circles on the curb side of the sidewalk)
  const markers = markerXs.map((x, i) => createMarker(x, TOWN.markerZ, i));
  markers.forEach((m) => group.add(m.root));

  return {
    group, markers, backdrop,
    update(dt, time, mode) {
      for (const m of markers) m.update(dt, time, mode);
    },
  };
}

function createMarker(x, z, i) {
  const root = new THREE.Group();
  root.position.set(x, 0.025, z);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.55, depthWrite: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfff7b0, transparent: true, opacity: 0.6, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), discMat);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), ringMat);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.82, 40), pulseMat);
  for (const m of [disc, ring, pulse]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 1; root.add(m); }
  ring.position.y = 0.003; pulse.position.y = 0.006;
  const mk = {
    root, index: i, x, z, bin: null, hover: false, level: 1, burst: 0,
    pos: new THREE.Vector3(x, 0, z),
    get free() { return !this.bin; },
    update(dt, time, mode) {
      // mode: 'on' (glow & pulse), 'dim' (busy truck but still placeable), 'off' (hidden)
      const target = mode === 'off' ? 0 : 1;
      this.level += (target - this.level) * Math.min(1, dt * 6);
      root.visible = this.level > 0.02;
      const strong = mode === 'on' && !this.bin ? 1 : 0.45;
      const h = this.hover ? 1.18 : 1;
      const breathe = 1 + 0.05 * Math.sin(time * 4 + i);
      const s = this.level * h * breathe;
      disc.scale.setScalar(s); ring.scale.setScalar(s);
      discMat.opacity = (0.3 + 0.35 * strong + (this.hover ? 0.25 : 0)) * this.level;
      ringMat.opacity = (0.6 + 0.4 * strong) * this.level;
      const pk = (time * 0.9 + i * 0.33) % 1;
      pulse.scale.setScalar(this.level * (1 + pk * 0.7));
      pulseMat.opacity = this.bin ? 0 : 0.7 * (1 - pk) * strong * this.level;
      if (this.burst > 0) {
        this.burst = Math.max(0, this.burst - dt * 2.5);
        pulse.scale.setScalar(this.level * (1 + (1 - this.burst) * 1.6));
        pulseMat.opacity = this.burst;
      }
    },
  };
  return mk;
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
