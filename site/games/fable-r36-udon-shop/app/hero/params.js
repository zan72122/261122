// hero のパラメータ（すべてここ）。単位はメートル・秒・ラジアン。docs/HERO-SPEC.md §7 の既定値が元。

export const PARAMS = {
  // 品質ごとの分割：生地の格子 nx×nz、麺チューブ seg（長さ方向）×rad（断面）
  quality: {
    low: { nx: 32, nz: 24, seg: 24, rad: 6 },
    mid: { nx: 48, nz: 36, seg: 40, rad: 8 },
    high: { nx: 64, nz: 48, seg: 56, rad: 10 },
  },
  g: 9.8,

  dough: {
    edgeRound: 0.012,        // 側面の丸み（肩の幅 = edgeRound × 1.8）
    mound: 0.2,              // 上面の盛り上がり（縁の高さは中央の 1-mound 倍）
    minFactor: 0.12,         // 元の厚さのこの割合より薄くはならない
    texScale: 0.30,          // テクスチャ1枚が覆う長さ
    blob: [0.05, 0.035],     // 外形のゆらぎ（reset の seed で変わる）
    sizeJitter: 0.14,        // 大きさのゆらぎ
    edgeBias: 0.75,          // 格子を縁へ寄せる度合い（0 で均等）
    boardMargin: 0.012,      // まな板の端からの余白
    boardSoft: 0.025,        // 端でやわらかく止まる幅
    jelly: { period: 0.26, zeta: 0.2 },        // ぷるん（全体のつぶれ・のびのばね）
    breathe: { amp: 0.012, period: 3.4 },      // 息をするような揺れ
    drop: { height: 0.22, fall: 0.25, total: 0.6 },   // reset の「ぽよん」
    dentShade: 0.34,         // へこみを暗くして見やすくする量
    baseShade: 0.2,          // 板に接する根元を暗くする量（接地の影の代わり）
  },
  dent: {
    radius: 0.03, depthMax: 0.014,
    keep: 0.7,               // 残る割合（30% だけゆっくり戻る）
    recoverTau: 0.6, growTime: 0.1,
    tapDepth: 0.85,          // タップ直後の深さ（depthMax 比）。押し続けると 1 まで深くなる
    holdTime: 0.6, bulge: 0.35,
    pinchDent: 0.5,          // 引っ張りになった時、跡の深さに掛ける倍率
  },
  pull: {
    maxStretch: 1.8,         // 局所の伸び率の上限。式では使わず、limit と widen の組で守る（0.607·D/(falloff+widen·D) ≤ 0.8）
    keep: 0.65, falloff: 0.06,
    widen: 0.55,             // 引くほど巻き込む範囲が広がる（falloff + widen × 引いた量）
    limit: 0.20,             // 引ける量の上限（ここへなめらかに近づく）
    period: 0.25, decay: 0.4, settle: 1.0,
    moveThreshold: 0.012,
    thin: 0.5, neck: 0.28,   // 伸びた所が薄く・細くなる量
    pinch: 0.005,            // つまんだ所の小さな盛り上がり
  },
  pin: {
    minThickness: 0.012,
    perStroke: 0.78,         // 1往復ごとに一番厚い所の何倍まで押すか
    spread: 0.6, spreadX: 0.15,   // 減った厚さのうち広がりになる割合、x に回る割合
    smoothDents: 0.9,
  },
  cut: { minPieceWidth: 0.008, gap: 0.003, zMargin: 0.05 },

  noodle: {
    K: 10,                   // 制御点の数（偶数。とぐろを 1.8 周まで巻けるよう 6 → 10）
    wMin: 0.006, wMax: 0.032,                 // 麺の幅 = 切った間隔（wMax まで。超えた分は長さになる）
    hMin: 0.007, hMax: 0.016, hScale: 0.5,    // 麺の厚さ = 生地の厚さ × hScale（お椀に入る太さへ）
    lMin: 0.05, lMax: 0.46, lMaxPerWidth: 6,  // 長さの上限（幅が広いほど短く：lMax − lMaxPerWidth × (幅 − 0.012)）
    lenScale: 1.5,           // 麺の長さ = 生地の z の長さ × lenScale（細くなったぶん伸びる）
    morphTime: 0.3,          // 生地の切り身 → 麺の断面へ変わる時間
    texScale: 0.25,
  },
  hang: {
    damping: 3.0,
    splay: [0.5, 0.22, 0.08, 0.03], // 指に掛かった所から先へ、外へ開く傾き（tan）
    topGap: 0.003,
    bundle: 0.014,           // つまんだ所の束の半径
    uneven: 0.24,            // つまむ位置のずれ（麺の長さ比。両端の高さがそろわない）
    floorDip: 0.035,         // 鍋の上では先が湯にこれだけ浸かる
  },
  pot: {
    rimAbove: 0.06,          // 湯面から鍋のふちまで
    waveAmp: 0.01, waveLen: 0.08, wavePeriod: 1.6,
    bobAmp: 0.008, depthMin: 0.014, depthVar: 0.03,
    drift: 0.14, omegaMax: 3, omegaDecay: 1.5, stirGain: 1.5,
    plunge: 0.03,
  },
  // 網のかご（shell の形に合わせた値：半径・縁の高さ）。inCup = かごの中に残る長さの上限
  net: { radius: 0.062, rimY: 0.012, inCup: 0.10, inCupFrac: 0.42, hangTime: 0.35 },
  bowl: {
    r0: 0.012, rimFill: 0.75, // とぐろの内側・外側（外 = innerRadius × rimFill）
    maxTurns: 1.7,           // 1本が巻く周の上限（K = 10 のとき。超えるなら次の層へ）
    floatAbove: 0.004,       // つゆの面より上に出る量（一番上の層の中心）
    fillRate: 2.5,           // shell のつゆが満ちる速さ（麺が一緒に浮き上がる）
    feedBase: 0.4, feedPerMeter: 1.0, feedStagger: 0.035,
  },
  eat: { duration: 1.6, lift: 0.05, wobble: 0.008 },
  shadow: { dough: 0.3, laid: 0.2, hang: 0.34 },   // 疑似影の濃さ
  hint: { period: 1.2, hopEvery: 2.0, hopTime: 0.35, hopHeight: 0.01, glow: [0.35, 0.28, 0.12] },
  move: { hand: 0.22, board: 0.38, pot: 0.5, net: 0.32, bowlBlend: 0.3 },
};
