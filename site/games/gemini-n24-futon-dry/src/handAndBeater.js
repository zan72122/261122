import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function safeMerge(geos) {
  const normalized = geos.map((g) => (g.index ? g.toNonIndexed() : g.clone()));
  return mergeGeometries(normalized, false);
}

// Authentic Japanese woven rattan futon beater (籐のふとんたたき) + natural sculpted first-person hand

function buildRattanBeater(mats) {
  const beater = new THREE.Group();
  beater.userData.interactiveType = 'beater';

  const caneParts = [];
  const bindingParts = [];

  // 1. Twin bundled rattan handle shafts running from butt (-0.13) up to neck (+0.24)
  for (const side of [-1, 1]) {
    const shaftCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.006, -0.13, 0),
      new THREE.Vector3(side * 0.007, 0.02, 0),
      new THREE.Vector3(side * 0.008, 0.16, 0),
      new THREE.Vector3(side * 0.015, 0.245, 0)
    ]);
    caneParts.push(new THREE.TubeGeometry(shaftCurve, 18, 0.0072, 10, false));
  }

  const coreShaft = new THREE.CylinderGeometry(0.0062, 0.0068, 0.37, 10);
  coreShaft.translate(0, 0.055, 0);
  caneParts.push(coreShaft);

  // 2. Classic Japanese heart/pretzel 3-loop interwoven rattan paddle (Y = 0.23 .. 0.55)
  const outerLoop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.015, 0.23, 0.003),
    new THREE.Vector3(-0.092, 0.305, 0.004),
    new THREE.Vector3(-0.118, 0.41, 0.002),
    new THREE.Vector3(-0.072, 0.515, -0.002),
    new THREE.Vector3(0.0, 0.545, -0.003),
    new THREE.Vector3(0.072, 0.515, -0.002),
    new THREE.Vector3(0.118, 0.41, 0.002),
    new THREE.Vector3(0.092, 0.305, 0.004),
    new THREE.Vector3(0.015, 0.23, 0.003)
  ]);
  caneParts.push(new THREE.TubeGeometry(outerLoop, 48, 0.0068, 10, false));

  // Inner interwoven left & right pretzel loops
  const innerLoopA = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.012, 0.235, -0.004),
    new THREE.Vector3(-0.058, 0.325, 0.006),
    new THREE.Vector3(-0.068, 0.425, -0.006),
    new THREE.Vector3(-0.015, 0.49, 0.005),
    new THREE.Vector3(0.044, 0.44, -0.005),
    new THREE.Vector3(0.062, 0.35, 0.006),
    new THREE.Vector3(0.012, 0.235, -0.004)
  ]);
  caneParts.push(new THREE.TubeGeometry(innerLoopA, 40, 0.0056, 8, false));

  const innerLoopB = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.012, 0.235, 0.005),
    new THREE.Vector3(0.058, 0.325, -0.005),
    new THREE.Vector3(0.068, 0.425, 0.006),
    new THREE.Vector3(0.015, 0.49, -0.005),
    new THREE.Vector3(-0.044, 0.44, 0.005),
    new THREE.Vector3(-0.062, 0.35, -0.005),
    new THREE.Vector3(-0.012, 0.235, 0.005)
  ]);
  caneParts.push(new THREE.TubeGeometry(innerLoopB, 40, 0.0056, 8, false));

  // 3. Wrapped rattan binding collars (藤巻き) accurately placed on the handle & neck (NO floating rings!)
  const collarSpecs = [
    { y: -0.115, rings: 4, sx: 1.25, sy: 0.85 },
    { y: -0.015, rings: 3, sx: 1.25, sy: 0.85 },
    { y: 0.14,   rings: 4, sx: 1.28, sy: 0.85 },
    { y: 0.215,  rings: 5, sx: 1.48, sy: 0.88 }
  ];
  for (const cs of collarSpecs) {
    for (let r = 0; r < cs.rings; r++) {
      const tGeo = new THREE.TorusGeometry(0.0138, 0.0031, 8, 18);
      tGeo.rotateX(Math.PI / 2);
      tGeo.scale(cs.sx, 1.0, cs.sy);
      tGeo.translate(0, cs.y + r * 0.0058, 0);
      bindingParts.push(tGeo);
    }
  }

  // Hanging loop at butt end
  const endLoop = new THREE.TorusGeometry(0.015, 0.0034, 8, 16);
  endLoop.translate(0, -0.142, 0);
  bindingParts.push(endLoop);

  const caneMesh = new THREE.Mesh(safeMerge(caneParts), mats.rattan);
  caneMesh.castShadow = true;
  caneMesh.receiveShadow = true;
  beater.add(caneMesh);

  const bindMesh = new THREE.Mesh(safeMerge(bindingParts), mats.rattanBinding);
  bindMesh.castShadow = true;
  bindMesh.receiveShadow = true;
  beater.add(bindMesh);

  // Generous invisible touch hitbox
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.72, 0.14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, 0.24, 0);
  hit.userData.interactiveType = 'beater';
  beater.add(hit);

  return beater;
}

// Smooth anatomical lofted hand-and-wrist geometry (eliminates ball-on-cylinder doll seams!)
function createSculptedPalmWristGeometry() {
  // Loft cross-sections along Z from forearm wrist (+0.155) seamlessly into metacarpal knuckles (-0.042)
  const sections = [
    { z:  0.155, rx: 0.029, ry: 0.023, cx:  0.002, cy: -0.002, arch: 0.000 },
    { z:  0.115, rx: 0.028, ry: 0.021, cx:  0.001, cy: -0.002, arch: 0.001 },
    { z:  0.075, rx: 0.032, ry: 0.020, cx: -0.002, cy: -0.001, arch: 0.002 },
    { z:  0.035, rx: 0.042, ry: 0.019, cx: -0.005, cy:  0.000, arch: 0.004 },
    { z: -0.005, rx: 0.044, ry: 0.017, cx: -0.002, cy:  0.001, arch: 0.006 },
    { z: -0.032, rx: 0.041, ry: 0.014, cx:  0.000, cy:  0.001, arch: 0.005 },
    { z: -0.044, rx: 0.026, ry: 0.008, cx:  0.000, cy:  0.000, arch: 0.002 },
    { z: -0.048, rx: 0.002, ry: 0.002, cx:  0.000, cy:  0.000, arch: 0.000 }
  ];

  const radialSegs = 24;
  const rows = sections.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < rows; r++) {
    const s = sections[r];
    for (let c = 0; c <= radialSegs; c++) {
      const t = c / radialSegs;
      const a = t * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      // Slight organic dorsum flattening & soft palm hollowing + subtle thumb-side fullness
      let x = s.cx + ca * s.rx;
      let y = s.cy + sa * s.ry;
      if (sa > 0) {
        // Gentle dorsal arch across back of hand
        y += s.arch * (1.0 - ca * ca * 0.5);
      } else {
        // Soft natural palm curve + thenar fullness on -X side
        y += s.arch * 0.35;
        if (ca < 0 && s.z > -0.01 && s.z < 0.06) {
          y -= 0.006 * (-ca) * (1.0 - Math.abs(s.z - 0.025) / 0.04);
          x -= 0.004 * (-ca);
        }
      }
      positions.push(x, y, s.z);
      uvs.push(t, r / (rows - 1));
    }
  }

  const stride = radialSegs + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRealisticHand(mats) {
  const handRoot = new THREE.Group();

  function createTaperedPhalanx(len, rBase, rMid, rTip, radialSegs = 14) {
    const pts = [
      new THREE.Vector2(0.0001, -rBase * 0.55),
      new THREE.Vector2(rBase * 0.84, -rBase * 0.35),
      new THREE.Vector2(rBase * 1.02, 0),
      new THREE.Vector2(rMid, len * 0.52),
      new THREE.Vector2(rTip * 1.05, len * 0.88),
      new THREE.Vector2(rTip * 0.80, len * 0.97),
      new THREE.Vector2(0.0001, len * 1.02)
    ];
    const g = new THREE.LatheGeometry(pts, radialSegs);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // 1. Soft woven cotton long-sleeve forearm with natural gentle drape
  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.028, -0.022, 0.50),
    new THREE.Vector3(0.015, -0.014, 0.32),
    new THREE.Vector3(0.004, -0.004, 0.145)
  ]);
  const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 16, 0.043, 18, false);
  sleeveGeo.scale(1.06, 0.88, 1.0);
  const sleeve = new THREE.Mesh(sleeveGeo, mats.sleeveCotton);
  sleeve.castShadow = true;
  sleeve.receiveShadow = true;
  handRoot.add(sleeve);

  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.039, 0.008, 10, 22),
    mats.sleeveCotton
  );
  cuff.scale.set(1.08, 0.86, 1.0);
  cuff.position.set(0.003, -0.003, 0.144);
  cuff.castShadow = true;
  handRoot.add(cuff);

  // 2. Continuous sculpted anatomical palm + wrist mesh (zero ball/cylinder seams!)
  const palmWrist = new THREE.Mesh(createSculptedPalmWristGeometry(), mats.skinMat);
  palmWrist.castShadow = true;
  palmWrist.receiveShadow = true;
  handRoot.add(palmWrist);

  // 3. Natural proportioned slender fingers emerging seamlessly from the metacarpal knuckle ridge
  const fingerSpecs = [
    { x: -0.029, z: -0.027, len: [0.044, 0.028, 0.022], r: 0.0094, spread:  0.07 },
    { x: -0.009, z: -0.031, len: [0.048, 0.030, 0.023], r: 0.0097, spread:  0.01 },
    { x:  0.011, z: -0.028, len: [0.044, 0.027, 0.021], r: 0.0091, spread: -0.04 },
    { x:  0.029, z: -0.021, len: [0.035, 0.022, 0.018], r: 0.0078, spread: -0.10 }
  ];

  const fingers = [];
  for (const spec of fingerSpecs) {
    const basePivot = new THREE.Group();
    basePivot.position.set(spec.x, 0.001, spec.z);
    basePivot.rotation.y = spec.spread;
    handRoot.add(basePivot);

    const p1 = new THREE.Mesh(createTaperedPhalanx(spec.len[0], spec.r, spec.r * 0.90, spec.r * 0.85), mats.skinMat);
    p1.castShadow = true;
    basePivot.add(p1);

    const midPivot = new THREE.Group();
    midPivot.position.set(0, 0, -spec.len[0] * 0.93);
    basePivot.add(midPivot);

    const p2 = new THREE.Mesh(createTaperedPhalanx(spec.len[1], spec.r * 0.84, spec.r * 0.78, spec.r * 0.72), mats.skinMat);
    p2.castShadow = true;
    midPivot.add(p2);

    const tipPivot = new THREE.Group();
    tipPivot.position.set(0, 0, -spec.len[1] * 0.91);
    midPivot.add(tipPivot);

    const p3 = new THREE.Mesh(createTaperedPhalanx(spec.len[2], spec.r * 0.72, spec.r * 0.65, spec.r * 0.52), mats.skinMat);
    p3.castShadow = true;
    tipPivot.add(p3);

    const nailGeo = new THREE.SphereGeometry(spec.r * 0.50, 10, 8);
    nailGeo.scale(1.0, 0.24, 1.38);
    const nail = new THREE.Mesh(nailGeo, mats.nailMat);
    nail.position.set(0, spec.r * 0.52, -spec.len[2] * 0.58);
    tipPivot.add(nail);

    fingers.push({ basePivot, midPivot, tipPivot });
  }

  // 4. Opposed thumb seamlessly emerging from the thenar side of the palm
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.038, -0.006, 0.016);
  handRoot.add(thumbBase);

  const t1 = new THREE.Mesh(createTaperedPhalanx(0.036, 0.0115, 0.0102, 0.0095), mats.skinMat);
  t1.castShadow = true;
  thumbBase.add(t1);

  const thumbTip = new THREE.Group();
  thumbTip.position.set(0, 0, -0.033);
  thumbBase.add(thumbTip);

  const t2 = new THREE.Mesh(createTaperedPhalanx(0.028, 0.0095, 0.0086, 0.0068), mats.skinMat);
  t2.castShadow = true;
  thumbTip.add(t2);

  const thumbNailGeo = new THREE.SphereGeometry(0.0055, 10, 8);
  thumbNailGeo.scale(1.08, 0.24, 1.38);
  const thumbNail = new THREE.Mesh(thumbNailGeo, mats.nailMat);
  thumbNail.position.set(0, 0.0066, -0.016);
  thumbTip.add(thumbNail);

  // Natural handle grip socket nestled right inside the curled fingers & thumb
  const gripSocket = new THREE.Group();
  gripSocket.position.set(-0.004, -0.022, -0.030);
  gripSocket.rotation.set(-Math.PI * 0.44, 0.06, -0.10);
  handRoot.add(gripSocket);

  function setCurl(curl) {
    for (let i = 0; i < fingers.length; i++) {
      const f = fingers[i];
      const extra = i * 0.05;
      f.basePivot.rotation.x = -(0.12 + curl * (1.02 + extra));
      f.midPivot.rotation.x = -(0.10 + curl * (1.12 + extra));
      f.tipPivot.rotation.x = -(0.08 + curl * 0.74);
    }
    thumbBase.rotation.set(
      0.18 + curl * 0.36,
      0.55 - curl * 0.28,
      0.40 + curl * 0.50
    );
    thumbTip.rotation.x = -(0.08 + curl * 0.58);
  }

  setCurl(0.2);

  return { handRoot, gripSocket, setCurl };
}

export class HandAndBeater {
  constructor(scene, mats) {
    this.scene = scene;
    this.beater = buildRattanBeater(mats);
    this.hand = buildRealisticHand(mats);

    scene.add(this.hand.handRoot);
    scene.add(this.beater);

    this.mode = 'rest';
    this.curl = 0.2;

    this.handPos = new THREE.Vector3(0.46, 0.42, 0.42);
    this.handTarget = new THREE.Vector3(0.46, 0.42, 0.42);
    this.handRot = new THREE.Euler(-0.14, 0.28, -0.18);
    this.handRotTarget = new THREE.Euler(-0.14, 0.28, -0.18);

    // Beater resting naturally against the folding wooden stool on right
    this.beaterRestPos = new THREE.Vector3(0.76, 0.50, -0.32);
    this.beaterRestQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, -0.42, 0.24));

    this.swing = {
      active: false,
      t: 0,
      duration: 0.28,
      hitFired: false,
      strikeWorld: new THREE.Vector3(0, 0.85, -0.52),
      onHit: null
    };

    this.pat = {
      active: false,
      t: 0,
      target: new THREE.Vector3(0, 0.22, 1.02)
    };

    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
  }

  setMode(mode) {
    this.mode = mode;
  }

  triggerBeat(worldPoint, onHitCallback) {
    this.mode = 'beater';
    this.swing.active = true;
    this.swing.t = 0;
    this.swing.hitFired = false;
    this.swing.strikeWorld.copy(worldPoint);
    this.swing.onHit = onHitCallback;
  }

  triggerPat(worldPoint) {
    this.mode = 'pat';
    this.pat.active = true;
    this.pat.t = 0;
    this.pat.target.copy(worldPoint);
  }

  setLiftPoint(worldPoint) {
    this.mode = 'lift';
    this.handTarget.set(
      THREE.MathUtils.clamp(worldPoint.x + 0.08, -0.55, 0.65),
      THREE.MathUtils.clamp(worldPoint.y + 0.04, 0.24, 1.24),
      THREE.MathUtils.clamp(worldPoint.z + 0.12, -0.46, 0.62)
    );
    this.handRotTarget.set(-0.32, 0.16, -0.06);
  }

  update(dt, elapsed, camera, futonPose) {
    const breath = Math.sin(elapsed * 1.7) * 0.007;
    let targetCurl = 0.22;

    if (this.mode === 'beater') {
      targetCurl = 0.96;

      if (this.swing.active) {
        this.swing.t += dt;
        const p = Math.min(1, this.swing.t / this.swing.duration);
        const sp = this.swing.strikeWorld;

        if (!this.swing.hitFired && p >= 0.42) {
          this.swing.hitFired = true;
          if (this.swing.onHit) this.swing.onHit();
        }

        if (p < 0.25) {
          // Crisp wrist wind-up back & slightly right (natural first-person angle)
          const w = p / 0.25;
          const ease = 1 - Math.pow(1 - w, 2);
          this.handTarget.set(
            sp.x + 0.24 + ease * 0.06,
            sp.y - 0.24 + ease * 0.08,
            Math.max(0.18, sp.z + 0.62 + ease * 0.10)
          );
          this.handRotTarget.set(0.32 + ease * 0.34, 0.24, -0.26 - ease * 0.10);
        } else if (p < 0.48) {
          // Fast whip snap forward — entire woven rattan paddle slaps flush against front cotton face with ZERO clipping!
          const s = (p - 0.25) / 0.23;
          const snap = s * s * (3 - 2 * s);
          this.handTarget.set(
            sp.x + 0.26 - snap * 0.12,
            sp.y - 0.28 - snap * 0.02,
            Math.max(0.14, sp.z + 0.68 - snap * 0.11)
          );
          this.handRotTarget.set(0.64 - snap * 0.62, 0.22 + snap * 0.06, -0.34 + snap * 0.14);
        } else {
          // Elastic recoil back to natural lower-right first-person hold
          const r = (p - 0.48) / 0.52;
          const ease = 1 - Math.pow(1 - r, 3);
          this.handTarget.set(
            THREE.MathUtils.lerp(sp.x + 0.14, 0.38, ease),
            THREE.MathUtils.lerp(sp.y - 0.30, 0.62, ease),
            THREE.MathUtils.lerp(Math.max(0.14, sp.z + 0.57), 0.18, ease)
          );
          this.handRotTarget.set(
            THREE.MathUtils.lerp(0.02, 0.18, ease),
            THREE.MathUtils.lerp(0.28, 0.28, ease),
            THREE.MathUtils.lerp(-0.20, -0.26, ease)
          );
        }

        if (p >= 1) {
          this.swing.active = false;
        }
      } else {
        // Comfortable natural first-person angle holding rattan beater from lower-right edge
        this.handTarget.set(0.36 + Math.sin(elapsed * 0.9) * 0.010, 0.60 + breath, 0.14);
        this.handRotTarget.set(0.18, 0.28, -0.28);
      }
    } else if (this.mode === 'pat') {
      targetCurl = 0.08;
      if (this.pat.active) {
        this.pat.t += dt;
        const p = Math.min(1, this.pat.t / 0.38);
        const dip = Math.sin(p * Math.PI);
        this.handTarget.set(
          this.pat.target.x + 0.05,
          this.pat.target.y + 0.09 - dip * 0.075,
          this.pat.target.z + 0.07
        );
        this.handRotTarget.set(-0.20 - dip * 0.16, 0.14, -0.06);
        if (p >= 1) this.pat.active = false;
      } else {
        this.handTarget.set(0.46, 0.42 + breath, 1.98);
        this.handRotTarget.set(-0.26, 0.24, -0.10);
      }
    } else if (this.mode === 'lift') {
      targetCurl = 0.58;
    } else {
      targetCurl = 0.18;
      if (futonPose === 'indoors') {
        this.handTarget.set(0.48, 0.42 + breath, 2.02);
        this.handRotTarget.set(-0.24, 0.22, -0.10);
      } else {
        this.handTarget.set(0.48, 0.36 + breath, 0.44);
        this.handRotTarget.set(-0.16, 0.26, -0.16);
      }
    }

    const lerpSpeed = this.swing.active ? 26 : 10;
    this.handPos.lerp(this.handTarget, Math.min(1, dt * lerpSpeed));
    this.hand.handRoot.position.copy(this.handPos);

    this.handRot.x += (this.handRotTarget.x - this.handRot.x) * Math.min(1, dt * lerpSpeed);
    this.handRot.y += (this.handRotTarget.y - this.handRot.y) * Math.min(1, dt * lerpSpeed);
    this.handRot.z += (this.handRotTarget.z - this.handRot.z) * Math.min(1, dt * lerpSpeed);
    this.hand.handRoot.rotation.copy(this.handRot);

    this.curl += (targetCurl - this.curl) * Math.min(1, dt * 12);
    this.hand.setCurl(this.curl);

    this.hand.handRoot.updateMatrixWorld(true);
    if (this.mode === 'beater') {
      this.hand.gripSocket.getWorldPosition(this._tmpPos);
      this.hand.gripSocket.getWorldQuaternion(this._tmpQuat);
      this.beater.position.lerp(this._tmpPos, Math.min(1, dt * 22));
      this.beater.quaternion.slerp(this._tmpQuat, Math.min(1, dt * 22));
    } else {
      this.beater.position.lerp(this.beaterRestPos, Math.min(1, dt * 8));
      this.beater.quaternion.slerp(this.beaterRestQuat, Math.min(1, dt * 8));
    }
  }
}
