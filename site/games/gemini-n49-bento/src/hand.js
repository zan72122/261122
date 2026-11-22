import * as THREE from '../lib/three.module.js';

// Slender, anatomically graceful, natural-textured human right hand holding Japanese lacquered chopsticks!
// Uses organic sculpted tapered meshes + procedural skin micro-texture (zero balloon/mannequin toy joints!)
export function createChopstickHand(textures) {
  const root = new THREE.Group();
  const handRig = new THREE.Group();
  root.add(handRig);

  // Fine Japanese wakasa-nuri / walnut lacquered chopsticks
  const chopstickWoodMat = new THREE.MeshPhysicalMaterial({
    color: 0x4d2a14,
    map: textures.cedarMap,
    normalMap: textures.cedarNormal,
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughness: 0.24,
    clearcoat: 0.8,
    clearcoatRoughness: 0.14
  });

  const chopstickTipMat = new THREE.MeshStandardMaterial({
    color: 0xdab483,
    roughness: 0.56
  });

  // Realistic natural matte human skin with procedural micro-pores & subtle warm subsurface sheen
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xedd4be,
    map: textures.skinMap,
    normalMap: textures.skinNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.68,
    metalness: 0.0,
    sheen: 0.38,
    sheenRoughness: 0.76,
    sheenColor: new THREE.Color(0xe89a80),
    clearcoat: 0.0
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4d2c6,
    roughness: 0.24,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18
  });

  const cuffMat = new THREE.MeshPhysicalMaterial({
    color: 0xebe3d5,
    map: textures.clothMap,
    normalMap: textures.clothNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.92,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffffff)
  });

  // Tapered authentic Japanese chopsticks (length 3.35)
  function buildStick() {
    const g = new THREE.Group();
    const len = 3.35;
    const shaftGeo = new THREE.CylinderGeometry(0.052, 0.028, len * 0.76, 14);
    shaftGeo.rotateZ(-Math.PI / 2);
    const shaft = new THREE.Mesh(shaftGeo, chopstickWoodMat);
    shaft.position.x = len * 0.62;
    shaft.castShadow = true;
    g.add(shaft);

    const tipGeo = new THREE.CylinderGeometry(0.028, 0.015, len * 0.24, 14);
    tipGeo.rotateZ(-Math.PI / 2);
    const tip = new THREE.Mesh(tipGeo, chopstickTipMat);
    tip.position.x = len * 0.12;
    tip.castShadow = true;
    g.add(tip);

    return g;
  }

  const gripX = 1.92;

  const lowerPivot = new THREE.Group();
  lowerPivot.position.set(gripX, 0.0, 0.0);
  const lowerStick = buildStick();
  lowerStick.position.set(-gripX, -0.048, 0.0);
  lowerPivot.add(lowerStick);
  handRig.add(lowerPivot);

  const upperPivot = new THREE.Group();
  upperPivot.position.set(gripX, 0.064, 0.0);
  const upperStick = buildStick();
  upperStick.position.set(-gripX, 0.0, 0.0);
  upperPivot.add(upperStick);
  handRig.add(upperPivot);

  // Gracefully proportioned slender human hand (0.72 scale vs bloated balloon hand — anatomically matched to real chopsticks!)
  const handGroup = new THREE.Group();
  handGroup.position.set(gripX + 0.06, 0.12, 0.08);
  handGroup.scale.setScalar(0.72);
  handRig.add(handGroup);

  // Sculpted organic palm & metacarpal dorsum (tapered toward wrist, subtly arched across knuckles)
  const palmGeo = new THREE.BoxGeometry(1.38, 0.44, 0.96, 14, 8, 12);
  const pp = palmGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    let x = pp.getX(i); // -0.69 (knuckles) .. +0.69 (wrist)
    let y = pp.getY(i);
    let z = pp.getZ(i);
    const nx = x / 0.69;
    const ny = y / 0.22;
    const nz = z / 0.48;
    // Soft anatomical cross-section rounding
    const rYZ = Math.pow(Math.abs(ny), 2.4) + Math.pow(Math.abs(nz), 2.4);
    if (rYZ > 0.65) {
      const s = 1 / Math.pow(rYZ / 0.65, 0.28);
      y *= s;
      z *= s;
    }
    // Taper smoothly toward wrist (+x) and soften knuckle bridge (-x)
    const wristTaper = 1 - Math.max(0, nx) * 0.24;
    const archY = (1 - nz * nz) * 0.07;
    const endRound = Math.max(0, Math.abs(nx) - 0.72) / 0.28;
    const endPull = 1 - endRound * endRound * 0.22;
    pp.setXYZ(i, x, (y + archY) * endPull, z * wristTaper * endPull);
  }
  palmGeo.computeVertexNormals();
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0.68, 0.02, 0.05);
  palm.rotation.z = 0.05;
  palm.castShadow = true;
  palm.receiveShadow = true;
  handGroup.add(palm);

  // Continuous smoothly curved tapered finger built along a 3-point CatmullRom spline (ZERO ball-joint seams!)
  function buildCurvedFinger(pts, rBase, rTip) {
    const fGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = 16;
    const radSegs = 12;
    const frames = curve.computeFrenetFrames(segs, false);
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      // Taper smoothly along finger with gentle organic fingertip rounding at t -> 1
      let r = THREE.MathUtils.lerp(rBase, rTip, t);
      if (t > 0.88) {
        const cap = (t - 0.88) / 0.12;
        r *= Math.sqrt(Math.max(0.02, 1 - cap * cap * 0.85));
      }
      const N = frames.normals[i];
      const B = frames.binormals[i];
      for (let j = 0; j <= radSegs; j++) {
        const a = (j / radSegs) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // Slightly oval anatomical finger cross-section
        const vx = p.x + (N.x * ca * 0.92 + B.x * sa * 1.04) * r;
        const vy = p.y + (N.y * ca * 0.92 + B.y * sa * 1.04) * r;
        const vz = p.z + (N.z * ca * 0.92 + B.z * sa * 1.04) * r;
        positions.push(vx, vy, vz);
        uvs.push(t, j / radSegs);
      }
    }
    const stride = radSegs + 1;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        // Outward-facing CCW winding order so skin normals illuminate cleanly!
        indices.push(a, d, b, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, skinMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    fGroup.add(mesh);

    // Subtle delicate fingernail nestled on the fingertip
    const tipPt = curve.getPointAt(0.91);
    const tipTan = curve.getTangentAt(0.91);
    const nailGeo = new THREE.SphereGeometry(rTip * 0.78, 10, 8);
    nailGeo.scale(1.2, 0.2, 0.78);
    const nail = new THREE.Mesh(nailGeo, nailMat);
    nail.position.copy(tipPt).add(new THREE.Vector3(0, rTip * 0.72, 0));
    nail.rotation.z = Math.atan2(tipTan.y, tipTan.x);
    fGroup.add(nail);

    return fGroup;
  }

  // Index finger gracefully arching over upper chopstick
  const indexFinger = buildCurvedFinger(
    [
      new THREE.Vector3(0.06, 0.08, -0.26),
      new THREE.Vector3(-0.42, 0.14, -0.24),
      new THREE.Vector3(-0.82, -0.02, -0.14),
      new THREE.Vector3(-1.05, -0.22, -0.05)
    ],
    0.135,
    0.095
  );
  handGroup.add(indexFinger);

  // Middle finger gently cradling the upper chopstick
  const middleFinger = buildCurvedFinger(
    [
      new THREE.Vector3(0.08, 0.06, -0.02),
      new THREE.Vector3(-0.44, 0.06, 0.0),
      new THREE.Vector3(-0.84, -0.16, 0.04),
      new THREE.Vector3(-1.02, -0.38, 0.02)
    ],
    0.135,
    0.095
  );
  handGroup.add(middleFinger);

  // Ring finger softly curved under the lower chopstick
  const ringFinger = buildCurvedFinger(
    [
      new THREE.Vector3(0.12, 0.0, 0.22),
      new THREE.Vector3(-0.34, -0.08, 0.26),
      new THREE.Vector3(-0.66, -0.34, 0.24),
      new THREE.Vector3(-0.76, -0.56, 0.18)
    ],
    0.125,
    0.088
  );
  handGroup.add(ringFinger);

  // Pinky finger gently tucked beside ring finger
  const pinkyFinger = buildCurvedFinger(
    [
      new THREE.Vector3(0.22, -0.05, 0.4),
      new THREE.Vector3(-0.16, -0.18, 0.44),
      new THREE.Vector3(-0.44, -0.44, 0.38),
      new THREE.Vector3(-0.52, -0.62, 0.3)
    ],
    0.11,
    0.078
  );
  handGroup.add(pinkyFinger);

  // Opposing thumb pressing cleanly against the chopsticks
  const thumb = buildCurvedFinger(
    [
      new THREE.Vector3(0.45, -0.04, -0.36),
      new THREE.Vector3(0.08, -0.1, -0.46),
      new THREE.Vector3(-0.32, -0.14, -0.36),
      new THREE.Vector3(-0.56, -0.16, -0.16)
    ],
    0.165,
    0.115
  );
  handGroup.add(thumb);

  // Smooth continuous palm-to-wrist-to-forearm bridge (eliminates hard cylinder seam at the wrist!)
  const wristGeo = new THREE.CapsuleGeometry(0.36, 1.45, 10, 18);
  wristGeo.rotateZ(Math.PI / 2);
  wristGeo.scale(1.0, 0.68, 1.04);
  const wrist = new THREE.Mesh(wristGeo, skinMat);
  wrist.position.set(1.62, 0.02, 0.05);
  wrist.castShadow = true;
  wrist.receiveShadow = true;
  handGroup.add(wrist);

  // Rolled Japanese linen morning-shirt cuff
  const cuffGeo = new THREE.CylinderGeometry(0.46, 0.54, 1.9, 18);
  cuffGeo.rotateZ(Math.PI / 2);
  cuffGeo.scale(1.0, 0.82, 1.0);
  const cuff = new THREE.Mesh(cuffGeo, cuffMat);
  cuff.position.set(3.05, 0.03, 0.05);
  cuff.castShadow = true;
  handGroup.add(cuff);

  const cuffRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.068, 10, 22), cuffMat);
  cuffRim.rotation.y = Math.PI / 2;
  cuffRim.scale.set(1.0, 0.82, 1.0);
  cuffRim.position.set(2.12, 0.03, 0.05);
  handGroup.add(cuffRim);

  // Ergonomic side-angle approach so hand + chopsticks read gracefully from both Overhead & Macro!
  handRig.rotation.set(0.18, -0.32, 0.38);

  let currentOpen = 0.35;
  let targetOpen = 0.35;

  function setPinch(openAmount) {
    targetOpen = Math.max(0.02, Math.min(1.0, openAmount));
  }

  function update(dt) {
    currentOpen += (targetOpen - currentOpen) * Math.min(1, dt * 16);
    upperPivot.rotation.z = -0.015 - currentOpen * 0.26;
    lowerPivot.rotation.z = 0.012 + currentOpen * 0.045;
    indexFinger.rotation.z = -currentOpen * 0.14;
    middleFinger.rotation.z = -currentOpen * 0.09;
  }

  update(1);

  return {
    root,
    handRig,
    setPinch,
    update
  };
}
