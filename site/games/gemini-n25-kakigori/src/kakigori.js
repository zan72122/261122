import * as THREE from '../vendor/three.module.js';
import { createSnowBumpTexture, createStrawberryTexture, createKiwiTexture, createMandarinTexture } from './textures.js';

export const SYRUP_COLORS = {
  strawberry: new THREE.Color(0xe61e3c),
  lemon: new THREE.Color(0xf7c914),
  blue: new THREE.Color(0x0ea5e9),
};

// Realistic subtractive-inspired pigment blending in LINEAR color space!
// Red+Blue -> rich Grape Purple, Yellow+Blue -> Melon Green, Red+Yellow -> Tangerine Orange!
function mixPigments(rAmt, yAmt, bAmt, outColor) {
  const total = rAmt + yAmt + bAmt;
  if (total <= 0.001) {
    outColor.setRGB(0.94, 0.96, 0.99);
    return outColor;
  }
  const nr = rAmt / total;
  const ny = yAmt / total;
  const nb = bAmt / total;

  // Subtractive dye absorption in sRGB, then converted cleanly to linear for Three.js vertexColors
  const absR = nr * 0.05 + ny * 0.01 + nb * 0.94;
  const absG = nr * 0.92 + ny * 0.14 + nb * 0.36;
  const absB = nr * 0.80 + ny * 0.96 + nb * 0.04;

  const strength = Math.min(0.96, total * 1.18);
  const sr = Math.min(1, Math.max(0.04, 1.0 - absR * strength));
  const sg = Math.min(1, Math.max(0.04, 1.0 - absG * strength));
  const sb = Math.min(1, Math.max(0.04, 1.0 - absB * strength));

  // Convert sRGB -> Linear so vertexColors render vibrant, juicy, and never washed-out white!
  outColor.setRGB(sr, sg, sb).convertSRGBToLinear();
  return outColor;
}

export class FruitFactory {
  constructor() {
    this.strawTex = createStrawberryTexture();
    this.kiwiTex = createKiwiTexture();
    this.mandarinTex = createMandarinTexture();

    this.strawMat = new THREE.MeshPhysicalMaterial({
      map: this.strawTex,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    this.leafMat = new THREE.MeshStandardMaterial({
      color: 0x2f8a42,
      roughness: 0.45,
    });
    this.cherryMat = new THREE.MeshPhysicalMaterial({
      color: 0xc9142b,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    this.stemMat = new THREE.MeshStandardMaterial({
      color: 0x3b7a33,
      roughness: 0.4,
    });
    this.mandarinMat = new THREE.MeshPhysicalMaterial({
      map: this.mandarinTex,
      roughness: 0.16,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });
    this.kiwiMat = new THREE.MeshPhysicalMaterial({
      map: this.kiwiTex,
      roughness: 0.18,
      clearcoat: 0.8,
      clearcoatRoughness: 0.14,
    });
    this.kiwiSkinMat = new THREE.MeshStandardMaterial({
      color: 0x7b5c34,
      roughness: 0.8,
    });
  }

  createFruit(kind, scale = 1.0) {
    const g = new THREE.Group();
    g.userData.fruitKind = kind;

    if (kind === 'strawberry') {
      // Plump miniature strawberry lathe profile
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.075, 0.05),
        new THREE.Vector2(0.145, 0.16),
        new THREE.Vector2(0.155, 0.25),
        new THREE.Vector2(0.11, 0.31),
        new THREE.Vector2(0.0, 0.32),
      ];
      const geo = new THREE.LatheGeometry(pts, 18);
      geo.rotateX(Math.PI); // Pointed tip up!
      geo.translate(0, 0.27, 0);
      const body = new THREE.Mesh(geo, this.strawMat);
      body.castShadow = true;
      g.add(body);

      // Cute green star calyx at base
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.11, 5), this.leafMat);
        leaf.position.set(Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08);
        leaf.rotation.z = -Math.cos(a) * 1.15;
        leaf.rotation.x = Math.sin(a) * 1.15;
        g.add(leaf);
      }
    } else if (kind === 'cherry') {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), this.cherryMat);
      berry.scale.set(1.04, 0.94, 1.04);
      berry.position.y = 0.12;
      berry.castShadow = true;
      g.add(berry);

      // Graceful curved stem
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.22, 0),
        new THREE.Vector3(0.03, 0.34, 0.02),
        new THREE.Vector3(0.11, 0.44, 0.03),
      ]);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.015, 6, false), this.stemMat);
      stem.castShadow = true;
      g.add(stem);
    } else if (kind === 'mandarin') {
      // Plump curved mandarin orange segment
      const wedge = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.072, 10, 14, Math.PI * 0.92),
        this.mandarinMat
      );
      wedge.rotation.z = -Math.PI * 0.04;
      wedge.position.y = 0.08;
      wedge.scale.set(1.05, 0.92, 0.8);
      wedge.castShadow = true;
      g.add(wedge);
    } else if (kind === 'kiwi') {
      // Fresh bright green kiwi slice
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.175, 0.175, 0.055, 20),
        [this.kiwiSkinMat, this.kiwiMat, this.kiwiMat]
      );
      disc.position.y = 0.05;
      disc.rotation.x = 0.25;
      disc.castShadow = true;
      g.add(disc);
    }

    g.scale.setScalar(scale);
    return g;
  }
}

export class KakigoriBowl {
  constructor(scene, fruitFactory) {
    this.scene = scene;
    this.fruitFactory = fruitFactory;
    this.group = new THREE.Group();
    this.targetPos = new THREE.Vector3(-0.38, 0.0, 0.28);
    this.group.position.copy(this.targetPos);

    this.iceAmount = 0; // 0 = empty, 0.45+ = ready, 1.0 = full mountain, up to 1.55 = mega wobbly tower!
    this.eatFactor = 1.0; // shrinks 1 -> 0 as customer scoops bites
    this.wobblePhase = 0;
    this.wobbleAmp = 0;
    this.tumbleCooldown = 0;
    this.hasTumbled = false;

    this.syrupTotals = { strawberry: 0, lemon: 0, blue: 0 };
    this.milkCount = 0;
    this.hasMixedColors = false;
    this.toppings = [];
    this.milkRibbons = [];
    this.tumbledSnowballs = [];
    this.hitMeshes = [];

    this._buildBowl();
    this._buildSnowMesh();
    this._buildSnowPuffs();
    this._buildHitbox();

    scene.add(this.group);
  }

  _buildBowl() {
    // Miniature porcelain saucer under the glass bowl
    const saucerMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf8f1,
      roughness: 0.16,
      clearcoat: 0.75,
    });
    const saucerPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.46, 0.0),
      new THREE.Vector2(0.68, 0.055),
      new THREE.Vector2(0.71, 0.085),
      new THREE.Vector2(0.65, 0.09),
      new THREE.Vector2(0.44, 0.045),
      new THREE.Vector2(0.0, 0.04),
    ];
    const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 32), saucerMat);
    saucer.receiveShadow = true;
    saucer.castShadow = true;
    this.group.add(saucer);

    // Classic blue porcelain trim stripe on saucer rim
    const rimStripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.665, 0.014, 8, 36),
      new THREE.MeshStandardMaterial({ color: 0x3b76a8, roughness: 0.25 })
    );
    rimStripe.rotation.x = Math.PI / 2;
    rimStripe.position.y = 0.084;
    this.group.add(rimStripe);

    // Vintage Japanese Fluted Frosted Glass Kakigori Bowl!
    // Uses crisp clearcoat + translucent aquamarine-glass Fresnel feel (zero expensive transmission pass!)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe3f6fa,
      roughness: 0.09,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      envMapIntensity: 1.8,
      depthWrite: false,
    });

    const bowlPts = [
      new THREE.Vector2(0.0, 0.05),
      new THREE.Vector2(0.32, 0.055),
      new THREE.Vector2(0.30, 0.11),
      new THREE.Vector2(0.14, 0.16),
      new THREE.Vector2(0.18, 0.24),
      new THREE.Vector2(0.44, 0.36),
      new THREE.Vector2(0.57, 0.50),
      new THREE.Vector2(0.64, 0.61),
      new THREE.Vector2(0.61, 0.625),
      new THREE.Vector2(0.53, 0.50),
      new THREE.Vector2(0.39, 0.35),
      new THREE.Vector2(0.0, 0.27),
    ];
    const bowlGeo = new THREE.LatheGeometry(bowlPts, 36);
    // Add charming fluted scalloped glass wave along the upper rim!
    const pos = bowlGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > 0.42) {
        const ang = Math.atan2(z, x);
        const factor = (y - 0.42) / 0.20;
        const flute = Math.sin(ang * 14) * 0.022 * factor;
        const r = Math.hypot(x, z);
        if (r > 0.01) {
          pos.setX(i, x * (1 + flute / r));
          pos.setZ(i, z * (1 + flute / r));
        }
        pos.setY(i, y + Math.sin(ang * 14) * 0.016 * factor * factor);
      }
    }
    bowlGeo.computeVertexNormals();
    this.bowlMesh = new THREE.Mesh(bowlGeo, glassMat);
    this.bowlMesh.renderOrder = 5;
    this.bowlMesh.castShadow = true;
    this.group.add(this.bowlMesh);

    // Subtle frosted rim ring highlight
    const rimGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.625, 0.016, 8, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.1,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.72,
      })
    );
    rimGlow.rotation.x = Math.PI / 2;
    rimGlow.position.y = 0.615;
    rimGlow.renderOrder = 6;
    this.group.add(rimGlow);

    // Pooled syrup liquid at the bottom inside the frosted glass bowl!
    this.poolMat = new THREE.MeshPhysicalMaterial({
      color: 0xe61e3c,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.0,
    });
    this.syrupPool = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.16, 0.14, 24), this.poolMat);
    this.syrupPool.position.y = 0.34;
    this.syrupPool.renderOrder = 3;
    this.group.add(this.syrupPool);

    // Miniature silver spoon resting neatly on the saucer edge!
    this.spoon = new THREE.Group();
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xecf2f7,
      roughness: 0.16,
      metalness: 0.9,
    });
    const spoonHandle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.016, 0.44), silverMat);
    spoonHandle.position.z = 0.2;
    this.spoon.add(spoonHandle);
    const spoonHead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), silverMat);
    spoonHead.scale.set(0.85, 0.35, 1.35);
    spoonHead.position.z = -0.04;
    this.spoon.add(spoonHead);
    this.spoon.position.set(0.55, 0.11, 0.32);
    this.spoon.rotation.set(0.08, -0.58, 0.08);
    this.group.add(this.spoon);
  }

  _buildSnowMesh() {
    this.snowGroup = new THREE.Group();
    this.snowGroup.position.y = 0.38;
    this.group.add(this.snowGroup);

    const snowBump = createSnowBumpTexture();

    // Custom high-resolution fluffy shaved-ice mountain dome with sculpted scalloped snow ridges!
    const rings = 28;
    const segs = 38;
    const geo = new THREE.BufferGeometry();
    const vertCount = (rings + 1) * (segs + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const colors = new Float32Array(vertCount * 3);
    const basePos = new Float32Array(vertCount * 3);
    const pigmentR = new Float32Array(vertCount);
    const pigmentY = new Float32Array(vertCount);
    const pigmentB = new Float32Array(vertCount);

    let idx = 0;
    let uvIdx = 0;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings; // 0 = base inside bowl, 1 = fluffy peak
      // Classic generous Japanese kakigori dome profile that tucks cleanly inside the fluted glass bowl lip!
      const bowlTuck = t < 0.24 ? 0.66 + (t / 0.24) * 0.34 : 1.0;
      const radiusProfile = Math.pow(Math.sin((1 - t * 0.97) * Math.PI * 0.56), 0.72) * 0.575 * bowlTuck;
      const baseHeight = t * 0.96;

      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const ang = u * Math.PI * 2;

        // Multi-frequency organic fluffy shaved-ice ribbon ridges (real fuwafuwa silhouette!)
        const fluff =
          Math.sin(ang * 6 + t * 11.0) * 0.032 +
          Math.cos(ang * 11 - t * 8.5) * 0.022 +
          Math.sin(ang * 17 + t * 14.0) * 0.011 +
          Math.sin(t * 18.0) * 0.016;
        const rad = Math.max(0.0, radiusProfile + fluff * Math.sin(t * Math.PI));

        const px = Math.cos(ang) * rad;
        const pz = Math.sin(ang) * rad;
        const py = baseHeight + (t > 0.12 ? Math.cos(ang * 7 + t * 10) * 0.022 * Math.sin(t * Math.PI) : 0);

        positions[idx] = px;
        positions[idx + 1] = py;
        positions[idx + 2] = pz;

        basePos[idx] = px;
        basePos[idx + 1] = py;
        basePos[idx + 2] = pz;

        // Crisp cool-white linear snow base (never blown-out!)
        colors[idx] = 0.88;
        colors[idx + 1] = 0.91;
        colors[idx + 2] = 0.96;

        uvs[uvIdx] = u * 2.5;
        uvs[uvIdx + 1] = t * 2.5;

        idx += 3;
        uvIdx += 2;
      }
    }

    const indices = [];
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s;
        const b = a + segs + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.snowGeo = geo;
    this.snowBasePos = basePos;
    this.pigmentR = pigmentR;
    this.pigmentY = pigmentY;
    this.pigmentB = pigmentB;
    this.snowVertCount = vertCount;

    const snowMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.0,
      bumpMap: snowBump,
      bumpScale: 0.075,
      clearcoat: 0.08,
      clearcoatRoughness: 0.42,
    });

    this.snowMesh = new THREE.Mesh(geo, snowMat);
    this.snowMesh.castShadow = true;
    this.snowMesh.receiveShadow = true;
    this.snowMesh.visible = false;
    this.snowGroup.add(this.snowMesh);

    this.tufts = [];

    // Group holding condensed milk ribbons & placed fruits so they wobble/move with the mountain!
    this.decorGroup = new THREE.Group();
    this.snowGroup.add(this.decorGroup);
  }

  _buildSnowPuffs() {
    // Small burst of fluffy snow crystals when a fruit lands or ice tumbles
    this.puffCount = 36;
    const pGeo = new THREE.DodecahedronGeometry(0.032, 0);
    const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    this.puffMesh = new THREE.InstancedMesh(pGeo, pMat, this.puffCount);
    this.puffMesh.frustumCulled = false;
    this.group.add(this.puffMesh);
    this.puffs = [];
    this._dummy = new THREE.Object3D();
    for (let i = 0; i < this.puffCount; i++) {
      this.puffs.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
      this._dummy.scale.setScalar(0);
      this._dummy.updateMatrix();
      this.puffMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.puffMesh.instanceMatrix.needsUpdate = true;
  }

  _buildHitbox() {
    const bowlHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.65, 1.35, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bowlHit.position.y = 0.72;
    bowlHit.userData = { interactType: 'bowl' };
    this.group.add(bowlHit);
    this.hitMeshes.push(bowlHit);
  }

  spawnSnowPuff(localPos, count = 10, colorHex = 0xffffff) {
    let n = 0;
    for (let i = 0; i < this.puffCount && n < count; i++) {
      const p = this.puffs[i];
      if (p.life <= 0) {
        p.life = 0.45 + Math.random() * 0.25;
        p.x = localPos.x;
        p.y = localPos.y + 0.38;
        p.z = localPos.z;
        const a = Math.random() * Math.PI * 2;
        const spd = 0.5 + Math.random() * 1.0;
        p.vx = Math.cos(a) * spd;
        p.vy = 0.7 + Math.random() * 0.9;
        p.vz = Math.sin(a) * spd;
        n++;
      }
    }
    this.puffMesh.material.color.setHex(colorHex);
  }

  addIce(amount) {
    this.iceAmount = Math.min(1.62, this.iceAmount + amount);
    this.wobbleAmp = Math.min(0.14, this.wobbleAmp + amount * 0.16);
    this._updateSnowGeometry();

    // Discovery 1: Over-piling into a Mega Mountain causes a playful fluffy snowball tumble!
    if (this.iceAmount >= 1.56 && this.tumbleCooldown <= 0) {
      this.tumbleCooldown = 1.6;
      this.hasTumbled = true;
      this.iceAmount = 1.24; // Leaves a generous huge mountain!
      this.wobbleAmp = 0.22;
      this._spawnTumbledSnowballs();
      this._updateSnowGeometry();
      return 'tumbled';
    }
    return this.iceAmount >= 0.45 ? 'ready' : 'growing';
  }

  _spawnTumbledSnowballs() {
    // Fluffy miniature snowballs roll playfully down onto the saucer & counter!
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fbff, roughness: 0.55 });
    for (let i = 0; i < 4; i++) {
      if (this.tumbledSnowballs.length >= 10) {
        const old = this.tumbledSnowballs.shift();
        this.group.remove(old.mesh);
      }
      const r = 0.08 + Math.random() * 0.055;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), snowMat);
      const a = (i / 4) * Math.PI * 2 + Math.random() * 0.7;
      m.position.set(Math.cos(a) * 0.22, 1.55, Math.sin(a) * 0.22);
      m.castShadow = true;
      this.group.add(m);
      this.tumbledSnowballs.push({
        mesh: m,
        vx: Math.cos(a) * (0.9 + Math.random() * 0.5),
        vy: 0.65 + Math.random() * 0.4,
        vz: Math.sin(a) * (0.9 + Math.random() * 0.5),
        r,
        settled: false,
      });
    }
    this.spawnSnowPuff(new THREE.Vector3(0, 1.15, 0), 16, 0xffffff);
  }

  getSnowTopWorldY() {
    const h = Math.max(0.15, this.iceAmount * 0.98 * this.eatFactor);
    return this.group.position.y + 0.38 + h;
  }

  // Computes a clean surface point & normal on the current shaved ice dome for placing fruits/milk
  getSurfacePointLocal(xOffset, zOffset) {
    const hScale = Math.max(0.25, this.iceAmount * this.eatFactor);
    const rScale = Math.min(1.08, 0.65 + this.iceAmount * 0.38) * Math.sqrt(Math.max(0.2, this.eatFactor));
    const maxR = 0.54 * rScale;
    let r = Math.hypot(xOffset, zOffset);
    let lx = xOffset;
    let lz = zOffset;
    if (r > maxR && r > 0.001) {
      lx = (xOffset / r) * maxR;
      lz = (zOffset / r) * maxR;
      r = maxR;
    }
    const normR = Math.min(1, r / Math.max(0.01, maxR));
    // Smooth dome curve matching snow mesh
    const y = Math.pow(Math.max(0, 1 - normR * normR * 0.88), 0.62) * (0.94 * hScale);
    const normal = new THREE.Vector3(lx * 1.1, 0.65 * hScale, lz * 1.1).normalize();
    return { pos: new THREE.Vector3(lx, Math.max(0.22, y), lz), normal };
  }

  // Real-time spatial syrup soaking & subtractive pigment mixing directly onto 3D snow vertices!
  pourSyrupAt(worldHitPoint, kind, amount = 0.18) {
    if (this.iceAmount < 0.12) return false;
    const localPt = this.snowGroup.worldToLocal(worldHitPoint.clone());
    const pos = this.snowGeo.attributes.position;
    const col = this.snowGeo.attributes.color;
    const tmpCol = new THREE.Color();

    // Generous capillary soak radius so syrup visibly drenches & drips down the snowy slopes!
    const radius = 0.62;
    const radiusSq = radius * radius;

    this.syrupTotals[kind] = (this.syrupTotals[kind] || 0) + amount;

    let newlyMixed = false;

    for (let i = 0; i < this.snowVertCount; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      // Horizontal proximity + realistic downward gravity soak!
      const dx = vx - localPt.x;
      const dz = vz - localPt.z;
      const dy = vy < localPt.y ? (localPt.y - vy) * 0.38 : (vy - localPt.y) * 1.15;
      const dSq = dx * dx + dz * dz + dy * dy;

      if (dSq < radiusSq) {
        const w = 1 - Math.sqrt(dSq) / radius;
        const add = Math.pow(w, 1.35) * amount * 1.85;
        if (kind === 'strawberry') this.pigmentR[i] = Math.min(1.6, this.pigmentR[i] + add);
        else if (kind === 'lemon') this.pigmentY[i] = Math.min(1.6, this.pigmentY[i] + add);
        else if (kind === 'blue') this.pigmentB[i] = Math.min(1.6, this.pigmentB[i] + add);

        // Detect pigment color mixing discovery!
        const activeColors =
          (this.pigmentR[i] > 0.22 ? 1 : 0) +
          (this.pigmentY[i] > 0.22 ? 1 : 0) +
          (this.pigmentB[i] > 0.22 ? 1 : 0);
        if (activeColors >= 2 && !this.hasMixedColors) {
          this.hasMixedColors = true;
          newlyMixed = true;
        }

        mixPigments(this.pigmentR[i], this.pigmentY[i], this.pigmentB[i], tmpCol);
        col.setXYZ(i, tmpCol.r, tmpCol.g, tmpCol.b);
      }
    }
    col.needsUpdate = true;

    // Update delicious syrup pool at bottom of frosted glass bowl
    const totalSyrup = this.syrupTotals.strawberry + this.syrupTotals.lemon + this.syrupTotals.blue;
    mixPigments(this.syrupTotals.strawberry, this.syrupTotals.lemon, this.syrupTotals.blue, tmpCol);
    this.poolMat.color.copy(tmpCol);
    this.poolMat.opacity = Math.min(0.86, totalSyrup * 0.30);

    // Subtle glossy wet sheen increase where syrup soaks into ice crystals (keeps granular snow texture!)
    this.snowMesh.material.roughness = Math.max(0.42, 0.72 - totalSyrup * 0.06);
    this.snowMesh.material.clearcoat = Math.min(0.28, 0.08 + totalSyrup * 0.05);

    return newlyMixed;
  }

  // Drapes a glossy creamy ivory condensed-milk ribbon onto the shaved ice mountain!
  addMilkDrizzle(worldPoint = null) {
    if (this.iceAmount < 0.15) return;
    if (this.milkRibbons.length > 26) return;
    this.milkCount++;

    const milkMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff5db,
      roughness: 0.10,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });

    if (worldPoint) {
      // Single creamy glossy droplet/arc draped where user is squeezing!
      const local = this.snowGroup.worldToLocal(worldPoint.clone());
      const { pos } = this.getSurfacePointLocal(local.x, local.z);
      const pts = [];
      const dir = Math.atan2(pos.z, pos.x);
      for (let i = 0; i < 6; i++) {
        const f = i / 5;
        const sx = pos.x + Math.cos(dir + f * 0.5) * f * 0.18;
        const sz = pos.z + Math.sin(dir + f * 0.5) * f * 0.18;
        const sp = this.getSurfacePointLocal(sx, sz);
        pts.push(sp.pos.addScaledVector(sp.normal, 0.025));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.032, 7, false), milkMat);
      tube.castShadow = true;
      this.decorGroup.add(tube);
      this.milkRibbons.push(tube);
    } else {
      // Classic decorative swirling condensed-milk ribbon cascade over the crown!
      const startAngle = this.milkCount * 1.9 + 0.5;
      const pts = [];
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const r = 0.05 + t * 0.48;
        const a = startAngle + t * Math.PI * 2.6;
        const sp = this.getSurfacePointLocal(Math.cos(a) * r, Math.sin(a) * r);
        pts.push(sp.pos.addScaledVector(sp.normal, 0.024));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.033, 8, false), milkMat);
      tube.castShadow = true;
      this.decorGroup.add(tube);
      this.milkRibbons.push(tube);
    }
  }

  // Place a plump miniature fruit onto the shaved-ice mountain (supports stacking!)
  addFruitTopping(kind, worldDropPoint = null) {
    if (this.iceAmount < 0.15) return null;
    if (this.toppings.length >= 16) return null;

    let lx = 0;
    let lz = 0;
    if (worldDropPoint) {
      const local = this.snowGroup.worldToLocal(worldDropPoint.clone());
      lx = local.x;
      lz = local.z;
    } else {
      // Mouthwatering front-facing arrangement when tapped!
      const presetSpots = [
        [0.0, 0.0],       // Crown cherry
        [-0.28, 0.22],    // Front-left strawberry
        [0.29, 0.20],     // Front-right kiwi
        [-0.04, 0.38],    // Front-center mandarin
        [-0.36, -0.06],
        [0.36, -0.06],
      ];
      if (kind === 'cherry' && !this.toppings.some((t) => t.kind === 'cherry')) {
        lx = 0.0;
        lz = 0.0;
      } else {
        const slotIdx = Math.min(presetSpots.length - 1, this.toppings.length);
        if (this.toppings.length < presetSpots.length) {
          [lx, lz] = presetSpots[slotIdx];
        } else {
          const ang = this.toppings.length * 2.15 + 0.4;
          const rad = 0.22 + (this.toppings.length % 3) * 0.10;
          lx = Math.cos(ang) * rad;
          lz = Math.sin(ang) * rad;
        }
      }
    }

    const { pos, normal } = this.getSurfacePointLocal(lx, lz);
    // Nestle slightly into the fluffy snow so it never looks floating!
    pos.addScaledVector(normal, -0.035);

    // Only stack vertically if user explicitly dropped directly on top of another fruit!
    if (worldDropPoint) {
      for (const existing of this.toppings) {
        const d = Math.hypot(existing.mesh.position.x - pos.x, existing.mesh.position.z - pos.z);
        if (d < 0.16) {
          pos.y = Math.max(pos.y, existing.mesh.position.y + 0.16);
        }
      }
    }

    const mesh = this.fruitFactory.createFruit(kind, 1.06);
    mesh.position.copy(pos);
    // Tilt naturally along snow dome normal so kiwi face & strawberry show off toward viewer!
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    mesh.quaternion.copy(q);
    if (kind !== 'kiwi') {
      mesh.rotateY(Math.random() * Math.PI * 2);
    }

    // Pop-in spring bounce state
    const entry = {
      kind,
      mesh,
      baseY: pos.y,
      bounce: 1.0,
      eaten: false,
    };
    this.decorGroup.add(mesh);
    this.toppings.push(entry);

    this.wobbleAmp = Math.min(0.16, this.wobbleAmp + 0.08);
    this.spawnSnowPuff(pos, 10, 0xffffff);
    return entry;
  }

  hasDecoration() {
    const syr = this.syrupTotals.strawberry + this.syrupTotals.lemon + this.syrupTotals.blue;
    return syr > 0.18 || this.milkCount > 0 || this.toppings.length > 0;
  }

  getFlavorProfile() {
    const { strawberry: r, lemon: y, blue: b } = this.syrupTotals;
    const total = r + y + b;
    const countColors = (r > 0.25 ? 1 : 0) + (y > 0.25 ? 1 : 0) + (b > 0.25 ? 1 : 0);
    const isMega = this.iceAmount >= 1.08 || this.hasTumbled;
    const isRainbow = countColors >= 3;

    let dominant = 'plain';
    if (isRainbow) dominant = 'rainbow';
    else if (total > 0.22) {
      if (r >= y && r >= b) dominant = 'strawberry';
      else if (y >= r && y >= b) dominant = 'lemon';
      else dominant = 'blue';
    }
    return {
      dominant,
      isRainbow,
      isMega,
      hasMilk: this.milkCount > 0,
      toppingCount: this.toppings.length,
      totalSyrup: total,
    };
  }

  takeBite(biteIndex) {
    // Customer scoops a real visible bite!
    this.eatFactor = Math.max(0.18, 1.0 - (biteIndex + 1) * 0.28);
    this.wobbleAmp = 0.12;
    this._updateSnowGeometry();
    // Eat top fruits progressively
    let eatenNow = 0;
    for (let i = this.toppings.length - 1; i >= 0 && eatenNow < 3; i--) {
      if (!this.toppings[i].eaten) {
        this.toppings[i].eaten = true;
        this.toppings[i].mesh.visible = false;
        eatenNow++;
      }
    }
    // Lower remaining toppings onto the shrinking snow!
    for (const t of this.toppings) {
      if (!t.eaten) {
        const { pos } = this.getSurfacePointLocal(t.mesh.position.x, t.mesh.position.z);
        t.mesh.position.y = pos.y;
      }
    }
    this.decorGroup.scale.y = Math.max(0.35, this.eatFactor);
    this.spawnSnowPuff(new THREE.Vector3(0, 0.55 * this.eatFactor, 0), 10, 0xffffff);
  }

  resetForNewBowl(startPos) {
    this.iceAmount = 0;
    this.eatFactor = 1.0;
    this.wobbleAmp = 0;
    this.hasTumbled = false;
    this.hasMixedColors = false;
    this.syrupTotals = { strawberry: 0, lemon: 0, blue: 0 };
    this.milkCount = 0;
    this.decorGroup.scale.set(1, 1, 1);

    // Clear toppings & milk ribbons & tumbled snowballs
    for (const t of this.toppings) this.decorGroup.remove(t.mesh);
    this.toppings = [];
    for (const m of this.milkRibbons) {
      this.decorGroup.remove(m);
      m.geometry.dispose();
    }
    this.milkRibbons = [];
    for (const sb of this.tumbledSnowballs) this.group.remove(sb.mesh);
    this.tumbledSnowballs = [];

    // Reset snow pigments to pure sparkling white
    this.pigmentR.fill(0);
    this.pigmentY.fill(0);
    this.pigmentB.fill(0);
    const col = this.snowGeo.attributes.color;
    for (let i = 0; i < this.snowVertCount; i++) {
      col.setXYZ(i, 0.88, 0.91, 0.96);
    }
    col.needsUpdate = true;

    this.poolMat.opacity = 0;
    this.snowMesh.material.roughness = 0.72;
    this.snowMesh.material.clearcoat = 0.08;
    this.snowMesh.visible = false;
    this.spoon.visible = true;

    if (startPos) {
      this.targetPos.copy(startPos);
      this.group.position.copy(startPos);
    }
  }

  _updateSnowGeometry() {
    if (this.iceAmount <= 0.01) {
      this.snowMesh.visible = false;
      return;
    }
    this.snowMesh.visible = true;
    const hScale = this.iceAmount * this.eatFactor;
    const rScale = Math.min(1.08, 0.56 + this.iceAmount * 0.44) * Math.sqrt(Math.max(0.25, this.eatFactor));

    const pos = this.snowGeo.attributes.position;
    for (let i = 0; i < this.snowVertCount; i++) {
      const bx = this.snowBasePos[i * 3];
      const by = this.snowBasePos[i * 3 + 1];
      const bz = this.snowBasePos[i * 3 + 2];
      // When mega-tall (iceAmount > 1.0), peak becomes slightly narrower & extra dramatic!
      const towerPinch = this.iceAmount > 1.0 ? 1 - (by * 0.16 * (this.iceAmount - 1.0)) : 1;
      pos.setXYZ(i, bx * rScale * towerPinch, by * hScale, bz * rScale * towerPinch);
    }
    pos.needsUpdate = true;
    this.snowGeo.computeVertexNormals();

    for (const tuft of this.tufts) {
      const u = tuft.userData;
      tuft.position.set(u.baseX * rScale, u.baseY * hScale, u.baseZ * rScale);
      const visScale = Math.min(1, this.iceAmount * 1.45) * u.s * Math.sqrt(this.eatFactor);
      tuft.scale.setScalar(visScale);
    }
  }

  update(dt) {
    if (this.tumbleCooldown > 0) this.tumbleCooldown -= dt;

    // Smoothly glide bowl to target position on counter
    this.group.position.lerp(this.targetPos, Math.min(1, dt * 8.5));

    // Gentle snow wobble (especially expressive when mega-tall!)
    const tallFactor = Math.max(0, this.iceAmount - 0.85) * 0.04;
    this.wobblePhase += dt * (this.iceAmount > 1.1 ? 8.5 : 11);
    this.wobbleAmp = Math.max(tallFactor, this.wobbleAmp * Math.exp(-dt * 4.5));
    this.snowGroup.rotation.z = Math.sin(this.wobblePhase) * this.wobbleAmp;
    this.snowGroup.rotation.x = Math.cos(this.wobblePhase * 0.85) * this.wobbleAmp * 0.65;

    // Bounce-in animation for newly placed fruits
    for (const t of this.toppings) {
      if (t.bounce > 0.005) {
        t.bounce = Math.max(0, t.bounce - dt * 3.8);
        const s = 1.0 + Math.sin(t.bounce * Math.PI * 2.5) * 0.28 * t.bounce;
        t.mesh.scale.set(1.08 * s, 1.08 * (2 - s * 0.9), 1.08 * s);
      }
    }

    // Update tumbled snowballs rolling onto counter
    for (const sb of this.tumbledSnowballs) {
      if (sb.settled) continue;
      sb.mesh.position.x += sb.vx * dt;
      sb.mesh.position.y += sb.vy * dt;
      sb.mesh.position.z += sb.vz * dt;
      sb.vy -= 5.8 * dt;
      sb.mesh.rotation.x += 5 * dt;
      sb.mesh.rotation.z += 4 * dt;
      if (sb.mesh.position.y <= sb.r) {
        sb.mesh.position.y = sb.r;
        sb.vy = -sb.vy * 0.25;
        sb.vx *= 0.55;
        sb.vz *= 0.55;
        if (Math.abs(sb.vy) < 0.12 && Math.hypot(sb.vx, sb.vz) < 0.12) {
          sb.settled = true;
        }
      }
    }

    // Update snow puff burst particles
    let anyPuff = false;
    for (let i = 0; i < this.puffCount; i++) {
      const p = this.puffs[i];
      if (p.life <= 0) continue;
      anyPuff = true;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 3.6 * dt;
      const sc = Math.max(0, p.life * 2.1);
      this._dummy.position.set(p.x, p.y, p.z);
      this._dummy.scale.setScalar(sc);
      this._dummy.updateMatrix();
      this.puffMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyPuff) {
      this.puffMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
