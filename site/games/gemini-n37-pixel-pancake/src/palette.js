// Exact 16-color warm retro pixel-art palette
(function (global) {
  'use strict';

  const HEX = [
    '#1c141d', // 0: INK       - deep espresso outline, pupils, deep shadow
    '#3b2d3d', // 1: IRON      - cast-iron pan, stove grate, dark hair
    '#655666', // 2: SLATE     - pan highlight, metal sheen, handle grip
    '#5c2c24', // 3: COCOA     - dark wood shadow, crispy crust, dark syrup
    '#8f4826', // 4: MAPLE     - wood counter, ladle, maple syrup, hair mid
    '#c9732c', // 5: GOLDEN    - cooked hotcake, warm wood, syrup highlight
    '#eb9f38', // 6: HONEY     - melted butter, golden rim, flame mid
    '#ffd954', // 7: BUTTER    - butter pat, sparkles, flame core, yolk
    '#fff3cf', // 8: CREAM     - raw batter, ceramic plate, steam, highlights
    '#d9c5a7', // 9: OAT       - tile wall, plate shadow, batter shadow
    '#a8b8c4', // 10: SKY      - window morning sky, cool highlight, fork sheen
    '#f5bfa0', // 11: SKIN     - Mama skin
    '#d68c72', // 12: BLUSH    - skin shadow, terracotta pot, warm wood accent
    '#d94848', // 13: BERRY    - Mama apron, strawberry, flame red, hearts
    '#f27c8e', // 14: PINK     - rosy cheeks, apron stripe, berry highlight
    '#4e9e62', // 15: MINT     - berry leaf, potted herb, cozy bowl accent
  ];

  const PAL = {
    INK: 0,
    IRON: 1,
    SLATE: 2,
    COCOA: 3,
    MAPLE: 4,
    GOLDEN: 5,
    HONEY: 6,
    BUTTER: 7,
    CREAM: 8,
    OAT: 9,
    SKY: 10,
    SKIN: 11,
    BLUSH: 12,
    BERRY: 13,
    PINK: 14,
    MINT: 15,
    TRANSPARENT: 255,
  };

  // Pre-pack RGBA into little-endian Uint32 (ABGR) for fast blit
  const RGBA32 = new Uint32Array(16);
  const RGB = [];
  for (let i = 0; i < 16; i++) {
    const h = HEX[i];
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    RGB.push([r, g, b]);
    RGBA32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }

  // 2x2 ordered dither helper
  function dither2(x, y, c1, c2) {
    return ((x + y) & 1) === 0 ? c1 : c2;
  }

  global.PP = global.PP || {};
  global.PP.HEX = HEX;
  global.PP.PAL = PAL;
  global.PP.RGBA32 = RGBA32;
  global.PP.RGB = RGB;
  global.PP.dither2 = dither2;
})(window);
