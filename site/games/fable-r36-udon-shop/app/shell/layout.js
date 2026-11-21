// 場面の配置（メートル）。原点＝作業台の上面の中心、+y 上、+x 右、+z 手前（子ども側）、-z 奥（お客さん側）。
// docs/HERO-SPEC.md §2 と同じ値。
import { THREE } from './three.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const L = {
  counter: { minX: -0.85, maxX: 0.85, minZ: -0.30, maxZ: 0.46, thick: 0.06 },
  serve: { top: 0.10, minZ: -0.58, maxZ: -0.30 },          // 奥の一段高い受け渡し台
  board: { center: V(-0.26, 0.03, 0.06), sizeX: 0.50, sizeZ: 0.38, thick: 0.03 },
  doughStart: { center: V(-0.26, 0.03, 0.05), sizeX: 0.24, sizeZ: 0.18, thickness: 0.035 },
  knifeRest: V(0.03, 0.0, -0.06),                          // 刃の下端の中心（作業台の上に寝かせる）
  pinRest: V(-0.26, 0.022, 0.335),                         // めん棒の軸の中心
  pin: { radius: 0.022, length: 0.42 },
  pot: { base: V(0.44, 0.0, -0.08), radius: 0.155, inner: 0.145, height: 0.17, stove: 0.03, water: 0.14 },
  netRest: V(0.70, 0.16, -0.04),                           // 網のかごの中心（鍋の右の置き場）
  net: { radius: 0.062, depth: 0.06, rimY: 0.012 },        // かごの半径・深さ・縁の高さ（hero にも渡す）
  bowlRest: V(0.16, 0.0, 0.29),                            // お椀の外底
  bowl: { outerR: 0.098, innerR: 0.085, bottomR: 0.04, height: 0.08, foot: 0.012, brothLevel: 0.045 },
  dishes: [V(0.33, 0, 0.33), V(0.45, 0, 0.35), V(0.57, 0, 0.33), V(0.68, 0, 0.26)],
  dishR: 0.05,
  serveSpot: V(0.0, 0.10, -0.40),                          // 渡したお椀の位置（受け渡し台の上）
  customer: V(0.0, 0.10, -0.68),                           // お客さんの座る位置（足元）
  giftShelf: { start: V(-0.72, 0.10, -0.47), step: 0.095 },
  backdrop: { z: -1.9, y: 0.55, size: 3.6 },
  camera: {
    work:  { pos: V(0.03, 0.80, 0.98), target: V(0.07, 0.03, -0.12),
             // 画面に必ず入れる点（縦持ちでも）
             fit: [V(-0.55, 0, 0.30), V(0.78, 0, 0.30), V(-0.78, 0.12, -0.47), V(0.80, 0.2, -0.06), V(0, 0.56, -0.70), V(-0.5, 0, 0.42), V(0.7, 0, 0.42)] },
    serve: { pos: V(-0.04, 0.62, 0.22), target: V(0.0, 0.22, -0.62),
             fit: [V(-0.30, 0.1, -0.38), V(0.30, 0.1, -0.38), V(0, 0.62, -0.70), V(-0.3, 0.1, -0.75), V(0.3, 0.1, -0.75)] },
  },
};
