// Shared palette, layout constants & family definitions

export const FAMILY = [
  {
    id: 0,
    key: 'girl',
    color: '#f8d24b',       // Cheerful Sunny Yellow
    colorLight: '#fef0a8',
    colorDeep: '#e0a924',
    accent: '#fffaf0',
    cheek: '#f39892',
    hair: '#96613e',
    skin: '#fae3cc',
    matX: -2.15,
    emblem: 'star',
  },
  {
    id: 1,
    key: 'mom',
    color: '#ee7b92',       // Warm Strawberry Rose Pink
    colorLight: '#fbc4d0',
    colorDeep: '#cb546d',
    accent: '#fff7f4',
    cheek: '#f28b96',
    hair: '#7e5038',
    skin: '#fbe5d1',
    matX: 0.0,
    emblem: 'flower',
  },
  {
    id: 2,
    key: 'dad',
    color: '#5f9cd6',       // Friendly Sky-Denim Blue
    colorLight: '#b3d4f2',
    colorDeep: '#3d74ad',
    accent: '#f5f9fe',
    cheek: '#ef9c92',
    hair: '#684c3a',
    skin: '#f6dac0',
    matX: 2.15,
    emblem: 'diamond',
  },
];

export const LAYOUT = {
  tableY: 0,
  foldingMatPos: { x: 0, z: 1.72 },
  foldingMatSize: { w: 3.15, d: 2.12 },
  sortingMatZ: -0.25,
  sortingMatSize: { w: 1.65, d: 1.18 },
  chestFrontZ: -2.35,
  chestDepth: 1.48,
  chestHeight: 1.52,
  drawerOpenZ: 1.12,
  drawerAjarZ: 0.28,
  dollZ: -2.92,
  dollBaseY: 1.52,
  basketPosLandscape: { x: -3.05, z: 1.65 },
  dishPosLandscape: { x: 3.05, z: 1.65 },
  basketPosPortrait: { x: -1.78, z: 3.92 },
  dishPosPortrait: { x: 1.78, z: 3.92 },
};

// Curated laundry waves: Round 1 = 2 items per family (6 total) for fast joyful payoff!
// Round 2+ = 3 items per family (9 total) with richer patterns & surprises!
export function buildLaundryWave(round = 1) {
  if (round === 1) {
    return [
      { familyId: 0, type: 'towel', pattern: 'stripe', hasPin: false, hasPocket: false },
      { familyId: 1, type: 'shirt', pattern: 'polka', hasPin: true, hasPocket: false },
      { familyId: 0, type: 'dress', pattern: 'solid', hasPin: false, hasPocket: true, treasure: 'strawberry' },
      { familyId: 2, type: 'pants', pattern: 'gingham', hasPin: false, hasPocket: true, treasure: 'acorn' },
      { familyId: 1, type: 'towel', pattern: 'waffle', hasPin: false, hasPocket: false },
      { familyId: 2, type: 'shirt', pattern: 'stripe', hasPin: true, hasPocket: false },
    ];
  }

  const patterns = ['solid', 'stripe', 'gingham', 'polka', 'waffle', 'knit'];
  const treasures = ['strawberry', 'star_button', 'acorn', 'felt_flower'];
  const typesByFamily = [
    ['dress', 'socks', 'towel', 'shirt'],
    ['apron', 'towel', 'shirt', 'socks'],
    ['shirt', 'pants', 'socks', 'towel'],
  ];

  const items = [];
  const perFamily = 3;
  for (let slot = 0; slot < perFamily; slot++) {
    for (let f = 0; f < 3; f++) {
      const typePool = typesByFamily[f];
      const type = typePool[(slot + round) % typePool.length];
      const pattern = patterns[(slot * 3 + f + round) % patterns.length];
      const hasPin = (slot + f + round) % 3 === 1;
      const hasPocket = (slot + f + round) % 3 === 2 && type !== 'socks' && type !== 'towel';
      const treasure = treasures[(slot + f + round) % treasures.length];
      items.push({ familyId: f, type, pattern, hasPin, hasPocket, treasure });
    }
  }
  return items;
}
