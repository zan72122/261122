import * as THREE from 'three';
import {
  createFaceSkinTextures,
  createRealisticEyeTexture,
  createHairTextures,
  createFabricTextures,
  createGarmentTextures
} from './textures.js';

function gaussian2(dx, dy, sx, sy) {
  return Math.exp(-0.5 * ((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
}

// Parametric anatomically sculpted human head with exact UV alignment (u=0.5 -> +Z front, v=1 -> top)
function createAnatomicalHeadGeometry(variant = 'mom') {
  const segU = 58;
  const segV = 44;
  const isDad = variant === 'dad';
  const baseRx = isDad ? 0.083 : 0.077;
  const baseRy = isDad ? 0.114 : 0.106;
  const baseRz = isDad ? 0.095 : 0.090;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = 1 - iv / segV; // 1 at crown, 0 at chin/neck base
    const theta = (1 - v) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2; // 0 at +Z front
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      let rx = baseRx;
      let ry = baseRy;
      let rz = baseRz;

      // Graceful anatomical taper from cheekbones down to jaw & chin
      if (v < 0.48) {
        const t = (0.48 - v) / 0.48;
        const jawTaper = isDad ? 0.25 : 0.34;
        rx *= 1 - t * t * jawTaper;
        if (cosP < 0) rz *= 1 - t * 0.24;
      }
      if (v > 0.56) {
        const t = (v - 0.56) / 0.44;
        rx *= 1 + Math.sin(t * Math.PI) * 0.035;
      }

      let x = sinP * sinT * rx;
      let y = cosT * ry;
      let z = cosP * sinT * rz;

      const du = u - 0.5;
      const absU = Math.abs(du);

      if (cosP > 0.15) {
        const frontMask = Math.min(1, (cosP - 0.15) / 0.4);

        // 1. Subtle natural brow ridge
        const brow = gaussian2(absU - 0.046, v - 0.576, 0.036, 0.022) * (isDad ? 0.0042 : 0.0024);
        z += brow * frontMask;

        // 2. Gentle anatomical eye sockets (shallow so NO dark shadow pockets!)
        const socket = gaussian2(absU - 0.052, v - 0.518, 0.025, 0.021) * 0.0058;
        z -= socket * frontMask;

        // 3. Warm sculpted cheekbones
        const cheek = gaussian2(absU - 0.068, v - 0.456, 0.036, 0.034) * (isDad ? 0.005 : 0.0068);
        z += cheek * frontMask;
        x += Math.sign(du) * cheek * 0.42 * frontMask;

        // 4. Refined nose bridge, tip, and alae
        const noseBridge = gaussian2(du, v - 0.502, 0.012, 0.044) * (isDad ? 0.0125 : 0.0102);
        const noseTip = gaussian2(du, v - 0.446, 0.015, 0.018) * (isDad ? 0.013 : 0.0105);
        const nostrilWing = gaussian2(absU - 0.019, v - 0.440, 0.010, 0.010) * 0.0048;
        const underNose = gaussian2(du, v - 0.422, 0.015, 0.008) * 0.0038;
        z += (noseBridge + noseTip + nostrilWing - underNose) * frontMask;
        y -= noseTip * 0.14 * frontMask;

        // 5. Soft sculpted upper/lower lips
        const upperLip = gaussian2(du, v - 0.388, 0.030, 0.010) * 0.0060;
        const cupidDip = gaussian2(du, v - 0.394, 0.007, 0.007) * 0.0018;
        const mouthPart = gaussian2(du, v - 0.374, 0.032, 0.0055) * 0.0038;
        const lowerLip = gaussian2(du, v - 0.360, 0.026, 0.011) * 0.0065;
        const labiomental = gaussian2(du, v - 0.336, 0.022, 0.012) * 0.0036;
        z += (upperLip - cupidDip - mouthPart + lowerLip - labiomental) * frontMask;

        // 6. Natural chin contour
        const chin = gaussian2(du, v - 0.288, 0.026, 0.025) * (isDad ? 0.0075 : 0.0055);
        z += chin * frontMask;
        y -= chin * 0.20 * frontMask;
      }

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Seamless anatomically sculpted human upper body (ZERO doll joints! Continuous neck->trapezius->shoulders->draped sleeves->torso)
// UV alignment: u=0.5 is dead front (+Z), v=0 is collar top, v=1 is table bottom!
function createSculptedUpperBodyGeometry(isDad = false) {
  const segU = 52;
  const segV = 32;
  const totalH = isDad ? 0.278 : 0.262;
  const shoulderW = isDad ? 0.205 : 0.168;
  const waistW = isDad ? 0.175 : 0.145;
  const chestD = isDad ? 0.098 : 0.088;
  const neckR = isDad ? 0.050 : 0.042;

  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iv = 0; iv <= segV; iv++) {
    const t = iv / segV; // 0 = table bottom, 1 = collar top
    const y = t * totalH;

    let rx, rz;
    if (t < 0.72) {
      // Smooth continuous ribcage & relaxed sleeves hanging cleanly beside torso
      const k = t / 0.72;
      const smooth = k * k * (3 - 2 * k);
      rx = waistW + (shoulderW - waistW) * smooth;
      rz = chestD * (0.90 + 0.11 * Math.sin(k * Math.PI * 0.85));
    } else {
      // Natural rounded deltoids sloping gracefully up the trapezius into the collar!
      const k = (t - 0.72) / 0.28;
      // Smooth cosine/power arch with zero sharp corners
      const arch = Math.pow(Math.cos(k * Math.PI * 0.5), 0.78);
      rx = neckR + (shoulderW - neckR) * arch;
      rz = neckR * 0.90 + (chestD * 0.92 - neckR * 0.90) * Math.pow(Math.cos(k * Math.PI * 0.5), 0.85);
    }

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2; // 0 = +Z front (matches u=0.5 garment placket!)
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      // Gentle vertical sleeve crease separating torso chest from relaxed outer arms
      const armGroove = Math.exp(-Math.pow((Math.abs(sinP) - 0.68) / 0.11, 2)) * (1 - Math.max(0, (t - 0.72) / 0.28)) * 0.011;
      const fold = Math.sin(phi * 7 + t * 8.0) * 0.0022 * (1 - t * 0.55);
      const chestFull = cosP > 0 ? Math.pow(cosP, 2) * Math.sin(t * Math.PI) * (isDad ? 0.010 : 0.015) : 0;

      const x = sinP * (rx + fold);
      const z = cosP * (rz + fold + chestFull - armGroove);

      pos.push(x, y, z);
      uvs.push(u, t); // v=1 at top collar (matches CanvasTexture flipY=true where y=0 is top!)
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      idx.push(a, b, c);
      idx.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Anatomically shaped hair cap with true forehead hairline! (Stops cleanly ABOVE eyebrows in front, wraps smoothly down temples & back!)
function createSculptedHairCapGeometry(rx, ry, rz, isDad = false) {
  const segU = 44;
  const segV = 24;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iv = 0; iv <= segV; iv++) {
    const t = iv / segV; // 0 = crown apex, 1 = hairline / nape rim
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2; // 0 = +Z front forehead!
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      // Hairline angle thetaMax depends on azimuth phi:
      // Front forehead (cosP = +1): stops high at 0.34*PI (well above eyebrows!)
      // Sides/temples (cosP = 0): dips to 0.55*PI (covers ears/sideburns)
      // Back nape (cosP = -1): wraps smoothly down to 0.72*PI (or 0.85*PI for Mom)
      const frontBlend = Math.max(0, cosP); // 1 at front, 0 at sides/back
      const backBlend = Math.max(0, -cosP);
      const foreheadTheta = isDad ? Math.PI * 0.335 : Math.PI * 0.345;
      const sideTheta = isDad ? Math.PI * 0.52 : Math.PI * 0.60;
      const backTheta = isDad ? Math.PI * 0.72 : Math.PI * 0.84;

      let thetaMax = sideTheta;
      if (frontBlend > 0) {
        const s = frontBlend * frontBlend;
        thetaMax = sideTheta * (1 - s) + foreheadTheta * s;
      } else if (backBlend > 0) {
        thetaMax = sideTheta * (1 - backBlend) + backTheta * backBlend;
      }

      const theta = t * thetaMax;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Subtle natural hair volume loft around crown & temples
      const loft = 1.0 + Math.sin(t * Math.PI) * 0.045 + Math.sin(phi * 14) * 0.004 * t;
      const x = sinP * sinT * rx * loft;
      const y = cosT * ry * loft;
      const z = cosP * sinT * rz * loft;

      pos.push(x, y, z);
      uvs.push(u * 4, t * 2);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      idx.push(a, c, b);
      idx.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Tapered curved hair-strand ribbon for natural soft hair locks
function createHairRibbonGeo(length = 0.16, width = 0.024, curveOut = 0.022, curveBack = 0.018) {
  const segs = 10;
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = width * Math.sin(Math.pow(1 - t, 0.7) * Math.PI * 0.85 + 0.08);
    const y = -t * length;
    const z = Math.sin(t * Math.PI) * curveOut - t * t * curveBack;
    pos.push(-w * 0.5, y, z);
    pos.push(w * 0.5, y, z);
    uvs.push(0, t);
    uvs.push(1, t);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export class FamilyMember {
  constructor(variant = 'mom', sharedEyeTex = null) {
    this.variant = variant;
    this.isDad = variant === 'dad';
    this.root = new THREE.Group();

    const skinTex = createFaceSkinTextures(variant);
    const eyeTex = sharedEyeTex || createRealisticEyeTexture();
    const hairTex = createHairTextures(this.isDad ? '#191411' : '#261a14');
    const garmentTex = createGarmentTextures(variant);

    // Main face skin material
    this.skinMat = new THREE.MeshPhysicalMaterial({
      map: skinTex.map,
      normalMap: skinTex.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: skinTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.55,
      sheen: 0.35,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(0xffc7ab)
    });

    // Clean dedicated solid-tone skin material for eyelids, ears, neck & hands (ZERO UV-smear darkening!)
    this.solidSkinMat = new THREE.MeshPhysicalMaterial({
      color: this.isDad ? 0xd4a486 : 0xe6b89c,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.05,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xffc9ae)
    });

    const hairMat = new THREE.MeshPhysicalMaterial({
      map: hairTex.map,
      normalMap: hairTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.44,
      metalness: 0.03,
      clearcoat: 0.22,
      clearcoatRoughness: 0.38,
      side: THREE.DoubleSide
    });

    const sweaterMat = new THREE.MeshPhysicalMaterial({
      map: garmentTex.map,
      normalMap: garmentTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.56,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color(this.isDad ? 0x708296 : 0xe8cfc2)
    });

    // Seamless continuous sculpted upper body + natural shoulders + draped knit texture (ZERO doll seams!)
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    const bodyMesh = new THREE.Mesh(createSculptedUpperBodyGeometry(this.isDad), sweaterMat);
    bodyMesh.position.set(0, -0.02, -0.02);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.bodyPivot.add(bodyMesh);

    // Subtle soft ribbed collar trim
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(this.isDad ? 0.050 : 0.044, 0.009, 10, 26),
      new THREE.MeshStandardMaterial({ color: this.isDad ? 0x2d3744 : 0xdfd4c7, roughness: 0.88 })
    );
    collar.rotation.x = Math.PI * 0.52;
    collar.position.set(0, this.isDad ? 0.252 : 0.236, -0.015);
    this.bodyPivot.add(collar);

    // Subtle soft inner cream undershirt collar peeking for Dad (adds realistic layered clothing detail!)
    if (this.isDad) {
      const innerCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.047, 0.006, 8, 22),
        new THREE.MeshStandardMaterial({ color: 0xe6dfd6, roughness: 0.85 })
      );
      innerCollar.rotation.x = Math.PI * 0.52;
      innerCollar.position.set(0, 0.264, -0.013);
      this.bodyPivot.add(innerCollar);
    }

    // Graceful anatomical neck
    const neckGeo = new THREE.CylinderGeometry(
      this.isDad ? 0.040 : 0.033,
      this.isDad ? 0.047 : 0.039,
      0.088,
      20
    );
    const neck = new THREE.Mesh(neckGeo, this.solidSkinMat);
    neck.position.set(0, this.isDad ? 0.292 : 0.275, -0.012);
    neck.castShadow = true;
    neck.receiveShadow = true;
    this.bodyPivot.add(neck);

    // Head Pivot (elevated cleanly on neck!)
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, this.isDad ? 0.392 : 0.372, -0.002);
    this.bodyPivot.add(this.headPivot);

    // Sculpted anatomical head mesh
    const headGeo = createAnatomicalHeadGeometry(variant);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMat);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headPivot.add(this.headMesh);

    // Sculpted ears (clean solidSkinMat)
    const earGeo = new THREE.SphereGeometry(0.017, 12, 10);
    earGeo.scale(0.42, 1.32, 0.72);
    for (const dir of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, this.solidSkinMat);
      ear.position.set(dir * (this.isDad ? 0.083 : 0.077), -0.006, -0.005);
      ear.rotation.y = dir * 0.28;
      this.headPivot.add(ear);
    }

    // Realistic multi-layer eyes with glossy cornea + clean matching skin eyelids!
    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.75
    });

    this.eyes = [];
    this.upperLids = [];
    this.lowerLids = [];
    const eyeSpacing = this.isDad ? 0.0285 : 0.0268;
    const eyeY = this.isDad ? 0.0065 : 0.0055;
    const eyeZ = this.isDad ? 0.0775 : 0.0735;

    for (const dir of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(dir * eyeSpacing, eyeY, eyeZ);
      this.headPivot.add(eyeGroup);

      const ballGeo = new THREE.SphereGeometry(0.0124, 20, 16);
      const posAttr = ballGeo.attributes.position;
      const uvAttr = ballGeo.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        const pz = posAttr.getZ(i);
        if (pz > 0) {
          uvAttr.setXY(i, 0.5 + (px / 0.0124) * 0.5, 0.5 + (py / 0.0124) * 0.5);
        } else {
          uvAttr.setXY(i, 0.04, 0.04);
        }
      }
      const eyeball = new THREE.Mesh(ballGeo, eyeMat);
      eyeGroup.add(eyeball);
      this.eyes.push(eyeball);

      // Upper eyelid shell using clean solidSkinMat & castShadow=false (ZERO dark masks!)
      const uLidGeo = new THREE.SphereGeometry(0.0133, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
      const uLid = new THREE.Mesh(uLidGeo, this.solidSkinMat);
      uLid.rotation.x = -0.36;
      uLid.castShadow = false;
      eyeGroup.add(uLid);
      this.upperLids.push(uLid);

      // Fine dark upper eyelash rim
      const lashGeo = new THREE.TorusGeometry(0.0132, 0.0009, 6, 16, Math.PI * 0.82);
      const lashMat = new THREE.MeshStandardMaterial({ color: 0x1e1410, roughness: 0.6 });
      const lash = new THREE.Mesh(lashGeo, lashMat);
      lash.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.09);
      lash.position.set(0, -0.0002, 0.0008);
      uLid.add(lash);

      // Lower eyelid / warm smiling cheek-puff shell (solidSkinMat!)
      const lLidGeo = new THREE.SphereGeometry(0.0132, 16, 8, 0, Math.PI * 2, Math.PI * 0.60, Math.PI * 0.40);
      const lLid = new THREE.Mesh(lLidGeo, this.solidSkinMat);
      lLid.rotation.x = 0.34;
      lLid.castShadow = false;
      eyeGroup.add(lLid);
      this.lowerLids.push(lLid);
    }

    // Expressive mouth cavity + upper teeth glint
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, this.isDad ? -0.043 : -0.040, this.isDad ? 0.077 : 0.0725);
    this.headPivot.add(this.mouthGroup);

    const cavityMat = new THREE.MeshStandardMaterial({ color: 0x4b1a1c, roughness: 0.72 });
    this.mouthCavity = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 14, 10), cavityMat);
    this.mouthCavity.scale.set(1.25, 0.07, 0.5);
    this.mouthGroup.add(this.mouthCavity);

    const teethMat = new THREE.MeshStandardMaterial({ color: 0xf7f1ea, roughness: 0.22 });
    this.teethMesh = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.0048, 0.0055), teethMat);
    this.teethMesh.position.set(0, 0.0022, 0.004);
    this.teethMesh.visible = false;
    this.mouthGroup.add(this.teethMesh);

    // Layered realistic hair
    this._buildHair(hairMat);

    // Subtle outer relaxed shoulder-arm gesture pivot (kept cleanly to the outer side, NEVER poking between them!)
    this._buildRelaxedOuterArm(sweaterMat);

    // Animation state
    this.currentLook = new THREE.Vector3(0, 0.05, 0.02);
    this.smileLevel = 0.35;
    this.targetSmile = 0.35;
    this.excitement = 0;
    this.blowTimer = 0;
    this.eatTimer = 0;
    this.blinkTimer = 1.8 + Math.random() * 2.5;
    this.blinkPhase = 0;
    this.nodTimer = 0;
    this.phaseOffset = this.isDad ? 1.7 : 0.0;
  }

  _buildHair(hairMat) {
    const hairGroup = new THREE.Group();
    this.headPivot.add(hairGroup);

    const rx = this.isDad ? 0.088 : 0.084;
    const ry = this.isDad ? 0.117 : 0.111;
    const rz = this.isDad ? 0.100 : 0.095;

    // Anatomically sculpted hair cap with true forehead hairline (100% clear eyes & eyebrows, ZERO bald gaps!)
    const capGeo = createSculptedHairCapGeometry(rx, ry, rz, this.isDad);
    const cap = new THREE.Mesh(capGeo, hairMat);
    cap.position.set(0, 0.006, -0.003);
    cap.castShadow = true;
    hairGroup.add(cap);

    if (!this.isDad) {
      // Mom: soft layered shoulder-length chestnut bob framing her cheeks gracefully
      const backGeo = new THREE.CylinderGeometry(rx * 0.96, rx * 1.10, 0.165, 22, 4, true, Math.PI * 0.16, Math.PI * 1.68);
      const backHair = new THREE.Mesh(backGeo, hairMat);
      backHair.position.set(0, -0.056, -0.016);
      backHair.rotation.y = Math.PI;
      backHair.castShadow = true;
      hairGroup.add(backHair);

      const ribbonLong = createHairRibbonGeo(0.180, 0.030, 0.016, 0.012);
      const sideAngles = [-1.42, -1.16, -0.96, 0.96, 1.16, 1.42, -1.78, 1.78, -2.18, 2.18, -2.6, 2.6];
      for (const ang of sideAngles) {
        const m = new THREE.Mesh(ribbonLong, hairMat);
        m.position.set(Math.sin(ang) * rx * 0.96, 0.032, Math.cos(ang) * rz * 0.90 - 0.008);
        m.rotation.y = ang;
        m.rotation.x = -0.04;
        hairGroup.add(m);
      }

      // Delicate soft side-swept wispy locks framing temples (sleek & natural, zero protruding forehead tabs!)
      const bangGeo = createHairRibbonGeo(0.064, 0.018, 0.004, 0.004);
      const bangSpecs = [
        { a: -0.78, rz: 0.24 }, { a: -0.60, rz: 0.20 },
        { a: 0.60, rz: -0.20 }, { a: 0.78, rz: -0.24 }
      ];
      for (const s of bangSpecs) {
        const b = new THREE.Mesh(bangGeo, hairMat);
        b.position.set(Math.sin(s.a) * rx * 0.90, 0.072, Math.cos(s.a) * rz * 0.86);
        b.rotation.y = s.a;
        b.rotation.z = s.rz;
        b.rotation.x = -0.06;
        hairGroup.add(b);
      }
    }
  }

  _buildRelaxedOuterArm(sweaterMat) {
    // Relaxed outer forearm & hand resting gracefully near their personal dish (never sticking out in front!)
    const outDir = this.isDad ? 1 : -1;
    this.armPivot = new THREE.Group();
    this.armPivot.position.set(outDir * (this.isDad ? 0.165 : 0.140), 0.08, 0.05);
    this.bodyPivot.add(this.armPivot);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), this.solidSkinMat);
    hand.scale.set(0.95, 0.65, 1.35);
    hand.position.set(-outDir * 0.02, -0.04, 0.12);
    hand.castShadow = true;
    this.armPivot.add(hand);

    // Wooden personal chopsticks resting naturally beside their personal plate
    const chopMat = new THREE.MeshStandardMaterial({ color: this.isDad ? 0x3b2618 : 0x703924, roughness: 0.45 });
    for (let i = 0; i < 2; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0020, 0.0034, 0.16, 8), chopMat);
      stick.rotation.x = Math.PI * 0.48;
      stick.rotation.z = -outDir * (0.35 + i * 0.05);
      stick.position.set(-outDir * 0.05, -0.032 + i * 0.006, 0.15);
      this.armPivot.add(stick);
    }
  }

  react(type = 'smile') {
    if (type === 'amazed') {
      this.targetSmile = 0.88;
      this.excitement = 1.0;
      this.nodTimer = 0.85;
    } else if (type === 'smile') {
      this.targetSmile = 0.74;
      this.excitement = Math.max(this.excitement, 0.55);
      this.nodTimer = 0.6;
    } else if (type === 'blow_and_eat') {
      this.blowTimer = 0.95;
      this.eatTimer = 2.1;
      this.targetSmile = 1.0;
      this.excitement = 1.0;
    } else if (type === 'eager') {
      this.targetSmile = 0.68;
      this.excitement = Math.max(this.excitement, 0.75);
    }
  }

  getMouthWorldPosition(out = new THREE.Vector3()) {
    this.mouthGroup.getWorldPosition(out);
    return out;
  }

  update(dt, time, lookTargetWorld) {
    this.excitement = Math.max(0, this.excitement - dt * 0.35);
    this.targetSmile += (0.36 + this.excitement * 0.48 - this.targetSmile) * Math.min(1, dt * 1.4);
    this.smileLevel += (this.targetSmile - this.smileLevel) * Math.min(1, dt * 6);

    if (this.nodTimer > 0) this.nodTimer = Math.max(0, this.nodTimer - dt);
    if (this.blowTimer > 0) this.blowTimer = Math.max(0, this.blowTimer - dt);
    if (this.eatTimer > 0) this.eatTimer = Math.max(0, this.eatTimer - dt);

    const breath = Math.sin(time * 1.6 + this.phaseOffset) * 0.0035;
    const eagerLean = (this.excitement * 0.042) + (this.eatTimer > 0 ? 0.038 : 0);
    this.bodyPivot.position.y = breath;
    this.bodyPivot.rotation.x = 0.06 + eagerLean;

    if (lookTargetWorld) {
      this.currentLook.lerp(lookTargetWorld, Math.min(1, dt * 4.5));
    }
    const localLook = this.root.worldToLocal(this.currentLook.clone());
    const dx = localLook.x;
    const dy = localLook.y - 0.38;
    const dz = Math.max(0.18, localLook.z);

    const targetYaw = Math.max(-0.40, Math.min(0.40, Math.atan2(dx, dz) * 0.64));
    const nodOffset = this.nodTimer > 0 ? Math.sin(this.nodTimer * Math.PI * 3.5) * 0.10 : 0;
    const chewBob = (this.eatTimer > 0 && this.blowTimer <= 0)
      ? Math.sin(time * 11) * 0.032 * Math.min(1, this.eatTimer)
      : 0;
    const targetPitch = Math.max(-0.16, Math.min(0.32, -Math.atan2(dy, dz) * 0.52 + nodOffset + chewBob));
    const headTilt = Math.sin(time * 0.7 + this.phaseOffset) * 0.032 + (this.smileLevel - 0.35) * (this.isDad ? -0.05 : 0.08);

    this.headPivot.rotation.y += (targetYaw - this.headPivot.rotation.y) * Math.min(1, dt * 5);
    this.headPivot.rotation.x += (targetPitch - this.headPivot.rotation.x) * Math.min(1, dt * 6);
    this.headPivot.rotation.z += (headTilt - this.headPivot.rotation.z) * Math.min(1, dt * 4);

    const eyeYaw = Math.max(-0.26, Math.min(0.26, Math.atan2(dx, dz) - this.headPivot.rotation.y));
    const eyePitch = Math.max(-0.20, Math.min(0.20, -Math.atan2(dy, dz) - this.headPivot.rotation.x));
    for (const eye of this.eyes) {
      eye.rotation.y = eyeYaw;
      eye.rotation.x = eyePitch;
    }

    // Natural eye blinks + joyful eye-crinkle smile
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase = 1.0;
      this.blinkTimer = 2.6 + Math.random() * 3.2;
    }
    if (this.blinkPhase > 0) {
      this.blinkPhase = Math.max(0, this.blinkPhase - dt * 7.5);
    }
    const blinkAmt = Math.sin(this.blinkPhase * Math.PI);
    const happySquint = (this.eatTimer > 0 && this.blowTimer <= 0)
      ? 0.48
      : Math.max(0, (this.smileLevel - 0.55) * 0.55);

    for (const uLid of this.upperLids) {
      uLid.rotation.x = -0.44 + blinkAmt * 0.65 + happySquint * 0.24;
    }
    for (const lLid of this.lowerLids) {
      lLid.rotation.x = 0.36 - happySquint * 0.28;
    }

    if (this.blowTimer > 0) {
      this.mouthCavity.scale.set(0.55, 0.52, 0.62);
      this.teethMesh.visible = false;
    } else if (this.eatTimer > 0) {
      const chew = Math.abs(Math.sin(time * 9.5)) * 0.42;
      this.mouthCavity.scale.set(1.32, 0.24 + chew, 0.52);
      this.teethMesh.visible = chew > 0.12;
    } else if (this.smileLevel > 0.48) {
      const openAmt = (this.smileLevel - 0.48) * 1.05;
      this.mouthCavity.scale.set(1.15 + openAmt * 0.42, 0.12 + openAmt * 0.42, 0.52);
      this.teethMesh.visible = openAmt > 0.22;
    } else {
      this.mouthCavity.scale.set(1.05, 0.07, 0.42);
      this.teethMesh.visible = false;
    }

    const armLift = this.excitement * 0.18 + (this.eatTimer > 0 ? 0.25 : 0);
    this.armPivot.rotation.x = -armLift;
  }
}

// Foreground realistic player hand (clearly visible bottom-right, big & expressive!)
export class PlayerHand {
  constructor() {
    this.root = new THREE.Group();
    const sleeveTex = createFabricTextures('#cf8e7e', '#ab6c5d');

    const handMat = new THREE.MeshPhysicalMaterial({
      color: 0xc99678,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.04,
      sheen: 0.28,
      sheenColor: new THREE.Color(0xf2baa0)
    });

    const nailMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6c4b8,
      roughness: 0.22,
      clearcoat: 0.7
    });

    const sleeveMat = new THREE.MeshPhysicalMaterial({
      map: sleeveTex.map,
      normalMap: sleeveTex.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: 0.90,
      sheen: 0.45
    });

    this.handGroup = new THREE.Group();
    this.root.add(this.handGroup);

    // Smooth forearm & wrist seamlessly joined (no clunky cuff ring!)
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.20, 8, 16), sleeveMat);
    forearm.rotation.set(Math.PI * 0.47, 0, -0.22);
    forearm.position.set(0.036, -0.018, 0.145);
    forearm.castShadow = true;
    this.handGroup.add(forearm);

    const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.038, 6, 14), handMat);
    wrist.rotation.set(Math.PI * 0.48, 0, -0.14);
    wrist.position.set(0.010, -0.007, 0.034);
    wrist.castShadow = true;
    this.handGroup.add(wrist);

    const palmGeo = new THREE.SphereGeometry(0.034, 18, 14);
    palmGeo.scale(1.02, 0.56, 1.18);
    const palm = new THREE.Mesh(palmGeo, handMat);
    palm.position.set(0, -0.005, 0.0);
    palm.castShadow = true;
    this.handGroup.add(palm);

    this.fingers = [];
    const fingerSpecs = [
      { x: -0.022, len: 0.056, r: 0.0076, spread: 0.14 },
      { x: -0.007, len: 0.062, r: 0.0078, spread: 0.04 },
      { x: 0.008, len: 0.057, r: 0.0073, spread: -0.04 },
      { x: 0.022, len: 0.046, r: 0.0065, spread: -0.14 }
    ];

    for (const spec of fingerSpecs) {
      const fPivot = new THREE.Group();
      fPivot.position.set(spec.x, -0.002, -0.032);
      fPivot.rotation.y = spec.spread;
      this.handGroup.add(fPivot);

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(spec.r, spec.len * 0.52, 6, 10), handMat);
      seg1.rotation.x = Math.PI * 0.5;
      seg1.position.set(0, 0, -spec.len * 0.30);
      seg1.castShadow = true;
      fPivot.add(seg1);

      const tipPivot = new THREE.Group();
      tipPivot.position.set(0, 0, -spec.len * 0.58);
      fPivot.add(tipPivot);

      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(spec.r * 0.88, spec.len * 0.42, 6, 10), handMat);
      seg2.rotation.x = Math.PI * 0.5;
      seg2.position.set(0, 0, -spec.len * 0.22);
      seg2.castShadow = true;
      tipPivot.add(seg2);

      const nail = new THREE.Mesh(new THREE.BoxGeometry(spec.r * 1.25, 0.002, spec.r * 1.4), nailMat);
      nail.position.set(0, spec.r * 0.72, -spec.len * 0.36);
      tipPivot.add(nail);

      this.fingers.push({ base: fPivot, tip: tipPivot });
    }

    this.thumbPivot = new THREE.Group();
    this.thumbPivot.position.set(-0.030, -0.006, 0.006);
    this.thumbPivot.rotation.set(0.25, 0.62, -0.35);
    this.handGroup.add(this.thumbPivot);

    const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.0088, 0.036, 6, 10), handMat);
    thumbMesh.rotation.x = Math.PI * 0.5;
    thumbMesh.position.set(0, 0, -0.022);
    thumbMesh.castShadow = true;
    this.thumbPivot.add(thumbMesh);

    this.toolAnchor = new THREE.Group();
    this.toolAnchor.position.set(-0.018, -0.014, -0.052);
    this.handGroup.add(this.toolAnchor);

    // Gracefully visible in bottom-right foreground beside the stove, NEVER blocking the front-right takoyaki well!
    this.restPos = new THREE.Vector3(0.215, 0.068, 0.195);
    this.targetPos = this.restPos.clone();
    this.currentPos = this.restPos.clone();
    this.targetRot = new THREE.Euler(-0.14, 0.26, -0.08);
    this.gripAmount = 0.28;
    this.targetGrip = 0.28;
    this.actionKick = 0;

    this.root.position.copy(this.currentPos);
  }

  setTarget(pos, rotEuler = null, grip = 0.6) {
    this.targetPos.copy(pos);
    if (rotEuler) this.targetRot.copy(rotEuler);
    this.targetGrip = grip;
  }

  kickAction() {
    this.actionKick = 1.0;
  }

  update(dt, time) {
    const smooth = Math.min(1, dt * 14);
    this.currentPos.lerp(this.targetPos, smooth);
    this.gripAmount += (this.targetGrip - this.gripAmount) * Math.min(1, dt * 12);
    this.actionKick = Math.max(0, this.actionKick - dt * 5.2);

    const floatY = Math.sin(time * 2.1) * 0.0022;
    this.root.position.set(this.currentPos.x, this.currentPos.y + floatY, this.currentPos.z);

    const kickPitch = Math.sin(this.actionKick * Math.PI) * -0.28;
    this.handGroup.rotation.x += (this.targetRot.x + kickPitch - this.handGroup.rotation.x) * smooth;
    this.handGroup.rotation.y += (this.targetRot.y - this.handGroup.rotation.y) * smooth;
    this.handGroup.rotation.z += (this.targetRot.z - this.handGroup.rotation.z) * smooth;

    for (let i = 0; i < this.fingers.length; i++) {
      const f = this.fingers[i];
      const curl = 0.22 + this.gripAmount * (0.65 + i * 0.08);
      f.base.rotation.x = -curl * 0.72;
      f.tip.rotation.x = -curl * 0.85;
    }
    this.thumbPivot.rotation.x = 0.25 - this.gripAmount * 0.42;
  }
}
