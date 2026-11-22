import * as THREE from '../vendor/three.module.js';
import {
  INK_COLOR,
  TOON_GRADIENT_3,
  TOON_GRADIENT_SKIN,
  addOutline,
  createApronTexture,
  createCelMaterial,
  createDonburiTexture,
  makeCelHighlight,
  makeCelMesh,
} from './cel.js';

function createEyeCanvas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  return c;
}

function drawAnimeEye(ctx, mood, lookX, lookY, blink) {
  ctx.clearRect(0, 0, 256, 256);

  // Happy closed crescent arc (^ ^)
  if (mood === 'happy' || mood === 'ecstasy') {
    ctx.strokeStyle = '#241612';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 160, 74, Math.PI * 1.14, Math.PI * 1.86);
    ctx.stroke();

    // Cute side lashes
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(192, 118);
    ctx.lineTo(220, 102);
    ctx.stroke();
    return;
  }

  // Blinking closed curve
  if (blink > 0.72) {
    ctx.strokeStyle = '#241612';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 112, 72, Math.PI * 0.16, Math.PI * 0.84);
    ctx.stroke();
    return;
  }

  const openScale = 1 - blink * 0.85;
  ctx.save();
  ctx.translate(128, 132);
  ctx.scale(1, openScale);
  ctx.translate(-128, -132);

  // White sclera
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(128, 134, 82, 86, 0, 0, Math.PI * 2);
  ctx.fill();

  // Clip iris inside sclera
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(128, 134, 78, 82, 0, 0, Math.PI * 2);
  ctx.clip();

  const ix = 128 + lookX * 22;
  const iy = 136 - lookY * 18;
  const irisR = mood === 'wide' ? 58 : 64;

  // Warm anime chestnut-amber iris gradient
  const grad = ctx.createLinearGradient(ix, iy - irisR, ix, iy + irisR);
  grad.addColorStop(0, '#3a1b10');
  grad.addColorStop(0.45, '#7c3f1c');
  grad.addColorStop(0.8, '#d47c2a');
  grad.addColorStop(1, '#f5ba51');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(ix, iy, irisR * 0.92, irisR, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris rim
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 7;
  ctx.stroke();

  // Deep pupil
  ctx.fillStyle = '#241612';
  ctx.beginPath();
  ctx.ellipse(ix, iy - 2, irisR * 0.42, irisR * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lower warm anime bounce crescent
  ctx.fillStyle = 'rgba(255, 228, 128, 0.72)';
  ctx.beginPath();
  ctx.ellipse(ix, iy + irisR * 0.56, irisR * 0.45, irisR * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sparkle star mode!
  if (mood === 'sparkle') {
    ctx.fillStyle = '#fff9d6';
    drawStar4(ctx, ix, iy, 36, 12);
    ctx.fill();
  }

  // Big glossy anime catchlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ix - 22, iy - 26, 20, 22, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ix + 22, iy + 20, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end sclera clip

  // Bold classic cel-anime upper eyelash arch
  ctx.strokeStyle = '#241612';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 146, 86, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  // Winged outer lash
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(202, 114);
  ctx.lineTo(230, 96);
  ctx.stroke();

  // Subtle lower rim line
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 134, 80, Math.PI * 0.28, Math.PI * 0.72);
  ctx.stroke();

  ctx.restore();
}

function drawStar4(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function createMouthCanvas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  return c;
}

function drawAnimeMouth(ctx, mouthState, chewPhase) {
  ctx.clearRect(0, 0, 256, 192);
  ctx.strokeStyle = '#241612';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (mouthState === 'smile') {
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(128, 66, 46, Math.PI * 0.16, Math.PI * 0.84);
    ctx.stroke();
  } else if (mouthState === 'ooh') {
    ctx.fillStyle = '#e06464';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(128, 96, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9898';
    ctx.beginPath();
    ctx.ellipse(128, 112, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mouthState === 'open' || mouthState === 'ahhh') {
    const ry = mouthState === 'ahhh' ? 54 : 44;
    const rx = mouthState === 'ahhh' ? 48 : 54;
    ctx.fillStyle = '#c84b52';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(128, 96, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cute tongue
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff8c94';
    ctx.beginPath();
    ctx.ellipse(128, 134, rx * 0.78, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Upper white anime tooth glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(128 - rx, 96 - ry, rx * 2, 16);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(128, 96, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mouthState === 'chew') {
    const w = 36 + Math.sin(chewPhase * 14) * 10;
    const h = 14 + Math.abs(Math.sin(chewPhase * 14)) * 12;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(128 - w, 96);
    ctx.quadraticCurveTo(128 - w * 0.4, 96 + h, 128, 94);
    ctx.quadraticCurveTo(128 + w * 0.4, 96 + h, 128 + w, 96);
    ctx.stroke();
  } else if (mouthState === 'bigsmile') {
    ctx.fillStyle = '#d45258';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(64, 72);
    ctx.quadraticCurveTo(128, 66, 192, 72);
    ctx.quadraticCurveTo(186, 146, 128, 146);
    ctx.quadraticCurveTo(70, 146, 64, 72);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff9aa0';
    ctx.beginPath();
    ctx.ellipse(128, 136, 46, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(60, 62, 136, 18);
    ctx.restore();
    ctx.stroke();
  }
}

export class AnimeChefCharacter {
  constructor() {
    this.group = new THREE.Group();
    this.mood = 'normal'; // normal | sparkle | happy | ecstasy | wide | sniff | eat
    this.mouthState = 'smile';
    this.lookTarget = new THREE.Vector3(0, 0.7, 0.4);
    this.lookSmooth = new THREE.Vector2(0, -0.2);
    this.blinkTimer = 2.6;
    this.blinkValue = 0;
    this.reactTimer = 0;
    this.chewTimer = 0;
    this.joyPulse = 0;
    this.sniffMode = false;
    this.eatReady = false;

    this._lastEyeKey = '';
    this._lastMouthKey = '';

    this._buildBody();
    this._buildHead();
    this._buildArms();
    this._buildShelf();
  }

  _buildBody() {
    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    // Cream puff-sleeve shirt underneath
    const torsoGeom = new THREE.CylinderGeometry(0.62, 0.84, 1.55, 18);
    const shirt = makeCelMesh(torsoGeom, 0xfff5e2, {
      outlineThickness: 0.042,
      gradientMap: TOON_GRADIENT_3,
    });
    shirt.position.set(0, 0.85, 0);
    this.bodyPivot.add(shirt);

    // Cheerful red-and-cream striped anime kitchen apron front
    const apronTex = createApronTexture();
    const apronGeom = new THREE.CylinderGeometry(0.66, 0.89, 1.48, 18, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
    const apron = makeCelMesh(apronGeom, 0xffffff, {
      map: apronTex,
      outlineThickness: 0.032,
      side: THREE.DoubleSide,
    });
    apron.position.set(0, 0.82, 0.02);
    this.bodyPivot.add(apron);

    // Apron red neck strap
    const strapGeom = new THREE.TorusGeometry(0.36, 0.055, 8, 20, Math.PI);
    const strap = makeCelMesh(strapGeom, 0xef5348, { outlineThickness: 0.026 });
    strap.position.set(0, 1.56, 0.24);
    strap.rotation.x = Math.PI * 0.85;
    this.bodyPivot.add(strap);

    // Cute puff shoulders
    const sleeveGeom = new THREE.SphereGeometry(0.34, 14, 12);
    [-1, 1].forEach((side) => {
      const sl = makeCelMesh(sleeveGeom, 0xfff5e2, { outlineThickness: 0.034 });
      sl.position.set(side * 0.72, 1.38, 0.02);
      sl.scale.set(1.05, 0.92, 0.95);
      this.bodyPivot.add(sl);
    });

    // Neck
    const neck = makeCelMesh(new THREE.CylinderGeometry(0.22, 0.25, 0.36, 14), 0xffdfc4, {
      outlineThickness: 0.03,
      gradientMap: TOON_GRADIENT_SKIN,
    });
    neck.position.set(0, 1.72, 0.02);
    this.bodyPivot.add(neck);
  }

  _buildHead() {
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 2.52, 0.06);
    this.bodyPivot.add(this.headPivot);

    // Sculpted anime face sphere (slightly tapered at chin via scale)
    const headGeom = new THREE.SphereGeometry(0.84, 24, 20);
    const pos = headGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      // Soft cute anime cheek fullness & slightly gentle chin
      if (y < 0) {
        const t = Math.min(1, -y / 0.84);
        x *= 1 - t * 0.14;
        z *= 1 - t * 0.08;
      }
      pos.setXYZ(i, x, y, z);
    }
    headGeom.computeVertexNormals();

    this.headMesh = makeCelMesh(headGeom, 0xffe2c8, {
      outlineThickness: 0.044,
      gradientMap: TOON_GRADIENT_SKIN,
    });
    this.headPivot.add(this.headMesh);

    // Cute ears
    const earGeom = new THREE.SphereGeometry(0.16, 12, 10);
    [-1, 1].forEach((side) => {
      const ear = makeCelMesh(earGeom, 0xffd5b6, {
        outlineThickness: 0.028,
        gradientMap: TOON_GRADIENT_SKIN,
      });
      ear.position.set(side * 0.8, -0.06, -0.04);
      ear.scale.set(0.65, 1.0, 0.72);
      this.headPivot.add(ear);
    });

    // Tiny cute anime nose dot
    const nose = makeCelMesh(new THREE.SphereGeometry(0.055, 10, 8), 0xf7b998, {
      outline: false,
      gradientMap: TOON_GRADIENT_SKIN,
    });
    nose.position.set(0, -0.1, 0.82);
    nose.scale.set(0.9, 0.75, 0.7);
    this.headPivot.add(nose);

    // Rosy cheeks + anime blush lines
    this.blushGroup = new THREE.Group();
    this.headPivot.add(this.blushGroup);
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xff8a8a,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.cheekMat = cheekMat;
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), cheekMat);
      cheek.position.set(side * 0.44, -0.18, 0.72);
      cheek.rotation.y = side * 0.42;
      cheek.scale.set(1.25, 0.72, 1);
      cheek.raycast = () => {};
      this.blushGroup.add(cheek);
    });

    // Dynamic Anime Eyes (left & right canvas textures on gently curved faces)
    this.eyeCanvasL = createEyeCanvas();
    this.eyeCtxL = this.eyeCanvasL.getContext('2d');
    this.eyeTexL = new THREE.CanvasTexture(this.eyeCanvasL);
    this.eyeTexL.colorSpace = THREE.SRGBColorSpace;

    this.eyeCanvasR = createEyeCanvas();
    this.eyeCtxR = this.eyeCanvasR.getContext('2d');
    this.eyeTexR = new THREE.CanvasTexture(this.eyeCanvasR);
    this.eyeTexR.colorSpace = THREE.SRGBColorSpace;

    const eyeGeo = new THREE.PlaneGeometry(0.42, 0.42);
    const makeEyeMesh = (tex, side) => {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const m = new THREE.Mesh(eyeGeo, mat);
      m.position.set(side * 0.31, 0.04, 0.77);
      m.rotation.y = side * 0.28;
      if (side < 0) m.scale.x = -1; // mirror lash wing cleanly
      m.raycast = () => {};
      return m;
    };
    this.leftEye = makeEyeMesh(this.eyeTexL, -1);
    this.rightEye = makeEyeMesh(this.eyeTexR, 1);
    this.headPivot.add(this.leftEye, this.rightEye);

    // Animated Eyebrows (warm gentle upward-arched anime brows — friendly & bright!)
    const browGeo = new THREE.CapsuleGeometry(0.025, 0.17, 4, 8);
    const browMat = new THREE.MeshBasicMaterial({ color: 0x3b2016 });
    this.leftBrow = new THREE.Mesh(browGeo, browMat);
    this.leftBrow.position.set(-0.32, 0.35, 0.77);
    this.leftBrow.rotation.set(0, -0.26, Math.PI / 2 + 0.15);
    this.rightBrow = new THREE.Mesh(browGeo, browMat);
    this.rightBrow.position.set(0.32, 0.35, 0.77);
    this.rightBrow.rotation.set(0, 0.26, Math.PI / 2 - 0.15);
    this.headPivot.add(this.leftBrow, this.rightBrow);

    // Dynamic Anime Mouth
    this.mouthCanvas = createMouthCanvas();
    this.mouthCtx = this.mouthCanvas.getContext('2d');
    this.mouthTex = new THREE.CanvasTexture(this.mouthCanvas);
    this.mouthTex.colorSpace = THREE.SRGBColorSpace;
    const mouthMat = new THREE.MeshBasicMaterial({
      map: this.mouthTex,
      transparent: true,
      depthWrite: false,
    });
    this.mouthMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), mouthMat);
    this.mouthMesh.position.set(0, -0.34, 0.77);
    this.mouthMesh.raycast = () => {};
    this.headPivot.add(this.mouthMesh);

    // === HAIR (Warm Chestnut Anime Bob + Clean Forehead Bangs + Cute Twin Buns + Red Chef Headband!) ===
    const hairColor = 0x5c3220;
    const hairMat = createCelMaterial(hairColor, { gradientMap: TOON_GRADIENT_3 });

    // Main hair dome tucked cleanly BEHIND her face (z = -0.26) so it NEVER pokes through her eyes!
    const crown = makeCelMesh(new THREE.SphereGeometry(0.94, 22, 18), hairColor, {
      material: hairMat,
      outlineThickness: 0.046,
    });
    crown.position.set(0, 0.16, -0.26);
    crown.scale.set(1.04, 1.02, 0.92);
    this.headPivot.add(crown);

    // Top hair cap sitting cleanly above the forehead hairline (above y = 0.48)
    const topCap = makeCelMesh(new THREE.SphereGeometry(0.86, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), hairColor, {
      material: hairMat,
      outline: false,
    });
    topCap.position.set(0, 0.14, 0.02);
    topCap.rotation.x = -0.18;
    topCap.scale.set(1.02, 0.99, 1.02);
    this.headPivot.add(topCap);

    // Lower bob hair flare around neck
    const backBob = makeCelMesh(new THREE.SphereGeometry(0.86, 18, 14), hairColor, {
      material: hairMat,
      outlineThickness: 0.044,
    });
    backBob.position.set(0, -0.34, -0.36);
    backBob.scale.set(1.14, 0.85, 0.78);
    this.headPivot.add(backBob);

    // Glossy anime hair halo highlight band (classic cel-anime sheen across crown!)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb87a56 });
    [-0.36, -0.12, 0.14, 0.38].forEach((x, idx) => {
      const glint = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.1 + (idx % 2) * 0.04, 4, 8), haloMat);
      glint.position.set(x, 0.68 - Math.abs(x) * 0.14, 0.56 - Math.abs(x) * 0.24);
      glint.rotation.set(-0.35, x * 0.65, Math.PI / 2 - x * 0.5);
      glint.raycast = () => {};
      this.headPivot.add(glint);
    });

    // Clean anime forehead bangs sitting neatly ABOVE the eyebrows (huge sparkling eyes 100% open & bright!)
    const bangSpecs = [
      { x: -0.48, y: 0.52, z: 0.56, sx: 0.15, sy: 0.28, rz: -0.34 },
      { x: -0.24, y: 0.56, z: 0.68, sx: 0.16, sy: 0.25, rz: -0.14 },
      { x: 0.01, y: 0.58, z: 0.71, sx: 0.17, sy: 0.23, rz: 0.04 },
      { x: 0.25, y: 0.56, z: 0.67, sx: 0.16, sy: 0.25, rz: 0.18 },
      { x: 0.49, y: 0.52, z: 0.55, sx: 0.15, sy: 0.28, rz: 0.34 },
    ];
    const bangGeo = new THREE.ConeGeometry(1, 1.5, 10);
    bangSpecs.forEach((b) => {
      const m = makeCelMesh(bangGeo, hairColor, {
        material: hairMat,
        outline: false,
      });
      m.position.set(b.x, b.y, b.z);
      m.scale.set(b.sx, b.sy, 0.13);
      m.rotation.set(0.24, b.x * 0.45, Math.PI + b.rz);
      this.headPivot.add(m);
    });

    // Framing side cheek locks
    [-1, 1].forEach((side) => {
      const lock = makeCelMesh(new THREE.CapsuleGeometry(0.16, 0.62, 6, 10), hairColor, {
        material: hairMat,
        outlineThickness: 0.036,
      });
      lock.position.set(side * 0.77, -0.06, 0.24);
      lock.rotation.z = side * -0.15;
      this.headPivot.add(lock);
    });

    // Cute bouncy high twin-puffs / side-bun ponytails!
    this.puffs = [];
    [-1, 1].forEach((side) => {
      const puffGroup = new THREE.Group();
      puffGroup.position.set(side * 0.86, 0.66, -0.12);
      const bun = makeCelMesh(new THREE.SphereGeometry(0.36, 14, 12), hairColor, {
        material: hairMat,
        outlineThickness: 0.04,
      });
      bun.scale.set(1.05, 0.95, 0.95);
      puffGroup.add(bun);

      // Cute cream hair tie ring
      const tie = makeCelMesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), 0xfff3cf, {
        outlineThickness: 0.025,
      });
      tie.position.set(-side * 0.18, -0.12, 0.05);
      tie.rotation.y = side * 0.7;
      puffGroup.add(tie);

      this.headPivot.add(puffGroup);
      this.puffs.push(puffGroup);
    });

    // Crisp Vermilion-Red Chef Headband / Kerchief with cute front knot bow!
    const band = makeCelMesh(new THREE.TorusGeometry(0.86, 0.1, 10, 28, Math.PI * 1.15), 0xef5348, {
      outlineThickness: 0.034,
    });
    band.position.set(0, 0.42, 0.06);
    band.rotation.set(-0.62, 0, -0.24);
    this.headPivot.add(band);

    // Cute bow ears on top-right of headband
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0.45, 0.88, 0.36);
    bowGroup.rotation.z = -0.35;
    [-1, 1].forEach((side) => {
      const ear = makeCelMesh(new THREE.SphereGeometry(0.18, 10, 8), 0xef5348, {
        outlineThickness: 0.03,
      });
      ear.scale.set(1.35, 0.75, 0.5);
      ear.position.set(side * 0.18, 0.04, 0);
      ear.rotation.z = side * 0.28;
      bowGroup.add(ear);
    });
    const knot = makeCelMesh(new THREE.SphereGeometry(0.11, 10, 8), 0xd83a30, {
      outlineThickness: 0.028,
    });
    bowGroup.add(knot);
    this.headPivot.add(bowGroup);

    // Draw initial eyes & mouth
    this._redrawFace(true);
  }

  _buildArms() {
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.78, 1.32, 0.12);
    this.bodyPivot.add(this.leftArmPivot);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.78, 1.32, 0.12);
    this.bodyPivot.add(this.rightArmPivot);

    const buildArm = (pivot, side) => {
      const arm = makeCelMesh(new THREE.CapsuleGeometry(0.145, 0.54, 6, 12), 0xffe2c8, {
        outlineThickness: 0.032,
        gradientMap: TOON_GRADIENT_SKIN,
      });
      arm.position.set(side * 0.14, -0.34, 0.25);
      arm.rotation.set(-0.55, 0, side * 0.22);
      pivot.add(arm);

      // Expressive cel-shaded anime hand (palm + thumb + curved finger silhouette)
      const hand = new THREE.Group();
      hand.position.set(side * 0.24, -0.58, 0.56);
      const palm = makeCelMesh(new THREE.SphereGeometry(0.19, 12, 10), 0xffe2c8, {
        outlineThickness: 0.032,
        gradientMap: TOON_GRADIENT_SKIN,
      });
      palm.scale.set(1.0, 0.9, 0.75);
      hand.add(palm);

      const thumb = makeCelMesh(new THREE.CapsuleGeometry(0.065, 0.11, 4, 8), 0xffe2c8, {
        outlineThickness: 0.024,
        gradientMap: TOON_GRADIENT_SKIN,
      });
      thumb.position.set(-side * 0.15, 0.07, 0.04);
      thumb.rotation.z = side * 0.75;
      hand.add(thumb);

      pivot.add(hand);
      return hand;
    };

    this.leftHand = buildArm(this.leftArmPivot, -1);
    this.rightHand = buildArm(this.rightArmPivot, 1);

    // Big Wooden Donburi Spoon held in right hand during Eating Stage!
    this.spoonGroup = new THREE.Group();
    this.spoonGroup.visible = false;
    const handle = makeCelMesh(new THREE.CapsuleGeometry(0.048, 0.65, 4, 8), 0xd48d46, {
      outlineThickness: 0.024,
    });
    handle.position.set(0, 0.22, 0);
    const bowl = makeCelMesh(new THREE.SphereGeometry(0.22, 14, 12), 0xe29d54, {
      outlineThickness: 0.028,
    });
    bowl.scale.set(1.05, 0.45, 1.35);
    bowl.position.set(0, 0.62, 0.08);
    this.spoonGroup.add(handle, bowl);

    // Mini scoop of oyakodon sitting inside the spoon when feeding!
    this.spoonFood = new THREE.Group();
    this.spoonFood.visible = false;
    const sRice = makeCelMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xfffcf5, {
      outlineThickness: 0.022,
    });
    sRice.scale.set(1, 0.75, 1.15);
    sRice.position.set(0, 0.71, 0.08);
    const sEgg = makeCelMesh(new THREE.SphereGeometry(0.16, 10, 8), 0xffc83b, {
      outlineThickness: 0.022,
    });
    sEgg.scale.set(1.05, 0.62, 1.05);
    sEgg.position.set(0, 0.78, 0.08);
    const sChick = makeCelMesh(new THREE.SphereGeometry(0.09, 8, 8), 0xc46b28, {
      outlineThickness: 0.02,
    });
    sChick.position.set(0.05, 0.84, 0.1);
    const sShine = makeCelHighlight(0.07, 0.045);
    sShine.position.set(-0.04, 0.88, 0.14);
    sShine.rotation.x = -0.7;
    this.spoonFood.add(sRice, sEgg, sChick, sShine);
    this.spoonGroup.add(this.spoonFood);

    this.spoonGroup.position.set(0.05, 0.05, 0.12);
    this.spoonGroup.rotation.set(0.55, 0, -0.3);
    this.rightHand.add(this.spoonGroup);
  }

  _buildShelf() {
    // Background wall shelf displaying stacked mini ceramic bowls for every finished round!
    this.shelfGroup = new THREE.Group();
    this.shelfGroup.position.set(-2.55, 2.38, -1.25);
    this.group.add(this.shelfGroup);

    const plank = makeCelMesh(new THREE.BoxGeometry(1.55, 0.14, 0.65), 0xd89352, {
      outlineThickness: 0.032,
    });
    this.shelfGroup.add(plank);

    [-0.52, 0.52].forEach((x) => {
      const bracket = makeCelMesh(new THREE.BoxGeometry(0.12, 0.34, 0.45), 0xb87236, {
        outlineThickness: 0.026,
      });
      bracket.position.set(x, -0.22, -0.05);
      this.shelfGroup.add(bracket);
    });

    this.stackedBowls = [];
    this.stackWobble = 0;
    this.miniBowlTex = createDonburiTexture();
  }

  addCompletedBowl() {
    const idx = this.stackedBowls.length;
    if (idx >= 8) return;
    const col = idx % 2;
    const row = Math.floor(idx / 2);

    const points = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.16, 0.0),
      new THREE.Vector2(0.26, 0.12),
      new THREE.Vector2(0.32, 0.28),
      new THREE.Vector2(0.28, 0.28),
      new THREE.Vector2(0.2, 0.1),
      new THREE.Vector2(0.0, 0.08),
    ];
    const geom = new THREE.LatheGeometry(points, 16);
    const bowl = makeCelMesh(geom, 0xffffff, {
      map: this.miniBowlTex,
      outlineThickness: 0.024,
    });
    bowl.position.set(-0.34 + col * 0.68, 0.07 + row * 0.23, 0.02);
    bowl.userData.baseX = bowl.position.x;
    bowl.userData.baseY = bowl.position.y;
    bowl.userData.pop = 1.0;
    this.shelfGroup.add(bowl);
    this.stackedBowls.push(bowl);
    this.stackWobble = 1.0;
  }

  wobbleShelf() {
    this.stackWobble = 1.0;
  }

  setLookTarget(vec3) {
    this.lookTarget.copy(vec3);
  }

  triggerReaction(mood, mouth, duration = 1.4) {
    this.mood = mood;
    this.mouthState = mouth;
    this.reactTimer = duration;
    this.joyPulse = 1.0;
    if (mouth === 'chew') {
      this.chewTimer = duration;
    }
    this._redrawFace(true);
  }

  setIdleState(stage, readyToEat = false) {
    this.sniffMode = stage === 'steaming';
    this.eatReady = readyToEat;
    this.spoonGroup.visible = readyToEat;
    if (this.reactTimer <= 0) {
      if (readyToEat) {
        this.mood = 'sparkle';
        this.mouthState = 'ahhh';
      } else if (stage === 'steaming') {
        this.mood = 'happy';
        this.mouthState = 'ooh';
      } else if (stage === 'revealed' || stage === 'slide') {
        this.mood = 'sparkle';
        this.mouthState = 'bigsmile';
      } else {
        this.mood = 'normal';
        this.mouthState = 'smile';
      }
      this._redrawFace(false);
    }
  }

  _redrawFace(force) {
    const lx = Math.round(this.lookSmooth.x * 16) / 16;
    const ly = Math.round(this.lookSmooth.y * 16) / 16;
    const bl = Math.round(this.blinkValue * 10) / 10;
    const eyeKey = `${this.mood}_${lx}_${ly}_${bl}`;
    if (force || eyeKey !== this._lastEyeKey) {
      drawAnimeEye(this.eyeCtxL, this.mood, -lx, ly, bl);
      drawAnimeEye(this.eyeCtxR, this.mood, lx, ly, bl);
      this.eyeTexL.needsUpdate = true;
      this.eyeTexR.needsUpdate = true;
      this._lastEyeKey = eyeKey;
    }
    const chewBucket = this.mouthState === 'chew' ? Math.floor(this.chewTimer * 18) : 0;
    const mouthKey = `${this.mouthState}_${chewBucket}`;
    if (force || mouthKey !== this._lastMouthKey) {
      drawAnimeMouth(this.mouthCtx, this.mouthState, this.chewTimer);
      this.mouthTex.needsUpdate = true;
      this._lastMouthKey = mouthKey;
    }
  }

  update(dt, t) {
    // Blinking rhythm
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.8;
    }
    if (this.blinkTimer < 0.16) {
      this.blinkValue = Math.sin((this.blinkTimer / 0.16) * Math.PI);
    } else {
      this.blinkValue = 0;
    }

    if (this.reactTimer > 0) {
      this.reactTimer = Math.max(0, this.reactTimer - dt);
    }
    if (this.chewTimer > 0) {
      this.chewTimer = Math.max(0, this.chewTimer - dt);
    }
    this.joyPulse = Math.max(0, this.joyPulse - dt * 1.8);

    // Smooth eye & head tracking toward active point
    const relX = THREE.MathUtils.clamp((this.lookTarget.x - this.group.position.x) / 3.2, -1, 1);
    const relY = THREE.MathUtils.clamp((this.lookTarget.y - 2.35) / 2.2, -1, 0.7);
    this.lookSmooth.x += (relX - this.lookSmooth.x) * Math.min(1, dt * 8);
    this.lookSmooth.y += (relY - this.lookSmooth.y) * Math.min(1, dt * 8);

    // Expressive body breathing & joy bounce
    const bounce = Math.sin(t * 2.6) * 0.035 + Math.sin(this.joyPulse * Math.PI) * 0.14;
    this.bodyPivot.position.y = bounce;

    // Head tilts naturally with look target + sniffing or cheering
    const sniffBob = this.sniffMode ? Math.sin(t * 7.5) * 0.08 : 0;
    const chewTilt = this.chewTimer > 0 ? Math.sin(t * 14) * 0.09 : 0;
    this.headPivot.rotation.y = this.lookSmooth.x * 0.24;
    this.headPivot.rotation.x = -this.lookSmooth.y * 0.16 + sniffBob;
    this.headPivot.rotation.z = Math.sin(t * 1.8) * 0.04 + chewTilt;

    // Hair puffs bounce!
    this.puffs.forEach((p, idx) => {
      const side = idx === 0 ? -1 : 1;
      p.rotation.z = side * (Math.sin(t * 3.5 + idx) * 0.08 + this.joyPulse * 0.25);
    });

    // Eyebrows reflect mood
    const browLift =
      this.mood === 'sparkle' || this.mood === 'wide' || this.eatReady
        ? 0.055
        : this.mood === 'happy' || this.mood === 'ecstasy'
          ? 0.035
          : 0;
    this.leftBrow.position.y = 0.35 + browLift;
    this.rightBrow.position.y = 0.35 + browLift;

    // Cheek blush intensifies when ecstatic/eating
    const blushTarget = this.mood === 'ecstasy' || this.chewTimer > 0 ? 0.85 : 0.45;
    this.cheekMat.opacity += (blushTarget - this.cheekMat.opacity) * Math.min(1, dt * 6);

    // Arm animation by mood
    if (this.mood === 'ecstasy' || this.mood === 'sparkle' && this.reactTimer > 0) {
      // Big cheerful anime double hand wave / cheer!
      this.leftArmPivot.rotation.x = -1.15 + Math.sin(t * 11) * 0.22;
      this.leftArmPivot.rotation.z = -0.42;
      this.rightArmPivot.rotation.x = -1.15 - Math.sin(t * 11) * 0.22;
      this.rightArmPivot.rotation.z = 0.42;
    } else if (this.chewTimer > 0) {
      // Hands up near cheeks in happy delicious pose!
      this.leftArmPivot.rotation.x = -0.95 + Math.sin(t * 10) * 0.1;
      this.leftArmPivot.rotation.z = 0.38;
      this.rightArmPivot.rotation.x = -0.95 + Math.cos(t * 10) * 0.1;
      this.rightArmPivot.rotation.z = -0.38;
    } else if (this.eatReady) {
      // Holding up spoon eagerly!
      this.leftArmPivot.rotation.x = -0.35 + Math.sin(t * 4) * 0.08;
      this.leftArmPivot.rotation.z = -0.15;
      this.rightArmPivot.rotation.x = -0.78 + Math.sin(t * 5) * 0.1;
      this.rightArmPivot.rotation.z = 0.18;
    } else if (this.sniffMode) {
      // Leaning gently with hands clasped near chin watching steam!
      this.leftArmPivot.rotation.x = -0.68 + Math.sin(t * 4.5) * 0.07;
      this.leftArmPivot.rotation.z = 0.24;
      this.rightArmPivot.rotation.x = -0.68 + Math.sin(t * 4.5 + 0.5) * 0.07;
      this.rightArmPivot.rotation.z = -0.24;
    } else {
      // Friendly attentive resting sway
      this.leftArmPivot.rotation.x = -0.22 + Math.sin(t * 2.4) * 0.06;
      this.leftArmPivot.rotation.z = -0.12;
      this.rightArmPivot.rotation.x = -0.22 + Math.sin(t * 2.4 + 1.2) * 0.06;
      this.rightArmPivot.rotation.z = 0.12;
    }

    // Stacked bowls wobble on shelf
    if (this.stackWobble > 0) {
      this.stackWobble = Math.max(0, this.stackWobble - dt * 1.8);
    }
    this.stackedBowls.forEach((b, i) => {
      if (b.userData.pop > 0) {
        b.userData.pop = Math.max(0, b.userData.pop - dt * 3.5);
        const s = 1 + Math.sin(b.userData.pop * Math.PI) * 0.35;
        b.scale.setScalar(s);
      }
      b.rotation.z = Math.sin(t * 18 + i * 1.1) * 0.11 * this.stackWobble;
    });

    this._redrawFace(false);
  }
}
