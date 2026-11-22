import * as THREE from 'three';
import { createSkinTextures, createKnitSweaterTextures } from './textures.js';

/**
 * Large photorealistic sculpted first-person right hand & cozy knit-sleeved forearm.
 * Smooth organic proportions (continuous palm, knuckle pads, tapered articulated fingers,
 * soft warm skin PBR) entering naturally from bottom-right when grabbing ingredients,
 * wrapping around the walnut ladle handle, lifting the lid, or turning the stove knob.
 */
export function createPlayerHand(scene) {
  const handGroup = new THREE.Group();

  const skinTex = createSkinTextures('#e6b397', '#d48678', 3500, false);
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTex.map,
    normalMap: skinTex.normalMap,
    normalScale: new THREE.Vector2(0.50, 0.50),
    roughness: 0.56,
    metalness: 0.0,
    sheen: 0.32,
    sheenColor: new THREE.Color(0xf6b496),
    sheenRoughness: 0.78,
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xf6d4c8,
    roughness: 0.20,
    clearcoat: 0.90,
  });

  const sleeveTex = createKnitSweaterTextures('#e2b2a0', '#be8470', 3600);
  const sleeveMat = new THREE.MeshPhysicalMaterial({
    map: sleeveTex.map,
    normalMap: sleeveTex.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.92,
    sheen: 0.65,
    sheenColor: new THREE.Color(0xffded2),
  });

  // Sculpted organic palm using deformed sphere (flattened back-of-hand, subtle thumb mound)
  const palmGeo = new THREE.SphereGeometry(0.036, 20, 16);
  const pPos = palmGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    let x = pPos.getX(i);
    let y = pPos.getY(i);
    let z = pPos.getZ(i);
    x *= 1.04;
    y *= 0.46;
    z *= 1.18;
    // Slight knuckle fullness toward front (-Z)
    if (z < 0) y += 0.002 * (-z / 0.042);
    // Soft thumb muscle pad on inner left (-X, +Z)
    if (x < -0.01 && z > 0) y -= 0.004;
    pPos.setXYZ(i, x, y, z);
  }
  palmGeo.computeVertexNormals();
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0, 0, 0.034);
  palm.castShadow = true;
  palm.receiveShadow = true;
  handGroup.add(palm);

  // Smooth tapered wrist leading into ribbed sweater cuff
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.027, 0.068, 16), skinMat);
  wrist.rotation.x = Math.PI / 2;
  wrist.scale.set(1.08, 1.0, 0.72);
  wrist.position.set(0.003, -0.003, 0.092);
  wrist.castShadow = true;
  handGroup.add(wrist);

  const cuffRib = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 10, 20), sleeveMat);
  cuffRib.position.set(0.004, -0.004, 0.120);
  cuffRib.scale.set(1.06, 0.85, 1.0);
  handGroup.add(cuffRib);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.18, 18), sleeveMat);
  cuff.rotation.x = Math.PI / 2 + 0.08;
  cuff.position.set(0.008, -0.012, 0.21);
  cuff.castShadow = true;
  handGroup.add(cuff);

  // Four natural tapered fingers with knuckle spheres so joints stay continuous when curled
  const fingers = [];
  const fingerDefs = [
    { x: -0.024, z: -0.003, len: 0.046, r: 0.0074, spread: 0.10 },
    { x: -0.008, z: -0.006, len: 0.052, r: 0.0076, spread: 0.02 },
    { x: 0.008, z: -0.004, len: 0.047, r: 0.0072, spread: -0.05 },
    { x: 0.023, z: 0.003, len: 0.037, r: 0.0064, spread: -0.12 },
  ];

  for (const fd of fingerDefs) {
    const fPivot = new THREE.Group();
    fPivot.position.set(fd.x, 0.0, fd.z);
    fPivot.rotation.y = fd.spread;

    // Knuckle joint cap
    const knuck = new THREE.Mesh(new THREE.SphereGeometry(fd.r * 1.05, 10, 8), skinMat);
    fPivot.add(knuck);

    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(fd.r * 0.90, fd.r * 1.02, fd.len * 0.56, 10), skinMat);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.set(0, 0, -fd.len * 0.28);
    seg1.castShadow = true;
    fPivot.add(seg1);

    const midPivot = new THREE.Group();
    midPivot.position.set(0, 0, -fd.len * 0.56);
    fPivot.add(midPivot);

    const midJoint = new THREE.Mesh(new THREE.SphereGeometry(fd.r * 0.90, 8, 8), skinMat);
    midPivot.add(midJoint);

    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(fd.r * 0.80, fd.len * 0.34, 6, 10), skinMat);
    seg2.rotation.x = Math.PI / 2;
    seg2.position.set(0, 0, -fd.len * 0.22);
    midPivot.add(seg2);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(fd.r * 0.62, 8, 6), nailMat);
    nail.scale.set(0.95, 0.24, 1.15);
    nail.position.set(0, fd.r * 0.66, -fd.len * 0.34);
    midPivot.add(nail);

    handGroup.add(fPivot);
    fingers.push({ root: fPivot, tip: midPivot });
  }

  // Opposable thumb on left side of right hand
  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-0.032, -0.004, 0.032);
  thumbPivot.rotation.set(0.15, 0.58, 0.22);

  const thumbBase = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), skinMat);
  thumbPivot.add(thumbBase);

  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.034, 6, 10), skinMat);
  thumbMesh.rotation.x = Math.PI / 2;
  thumbMesh.position.set(0, 0, -0.022);
  thumbMesh.castShadow = true;
  thumbPivot.add(thumbMesh);

  handGroup.add(thumbPivot);

  const restPos = new THREE.Vector3(0.58, -0.04, 0.68);
  handGroup.position.copy(restPos);
  handGroup.scale.setScalar(1.02);
  scene.add(handGroup);

  const state = {
    active: false,
    pose: 'open',
    targetPos: restPos.clone(),
    targetRot: new THREE.Euler(-0.34, 0.52, -0.10),
  };

  return {
    handGroup,
    state,
    setTarget(worldPos, pose = 'pinch') {
      state.active = true;
      state.pose = pose;
      // POSITIVE rotation.y points fingers forward-left (-X,-Z) & extends forearm cleanly
      // toward the bottom-right corner (+X,+Z) wrapping snugly around the walnut handle!
      if (pose === 'grip') {
        state.targetPos.copy(worldPos).add(new THREE.Vector3(0.010, 0.008, 0.008));
        state.targetRot.set(-0.32, 0.54, -0.34);
      } else if (pose === 'pinch') {
        state.targetPos.copy(worldPos).add(new THREE.Vector3(0.016, 0.032, 0.024));
        state.targetRot.set(-0.48, 0.44, -0.12);
      } else if (pose === 'point') {
        state.targetPos.copy(worldPos).add(new THREE.Vector3(0.014, 0.016, 0.032));
        state.targetRot.set(-0.28, 0.42, -0.08);
      } else {
        state.targetPos.copy(worldPos).add(new THREE.Vector3(0.018, 0.034, 0.028));
        state.targetRot.set(-0.34, 0.48, -0.10);
      }
    },
    release() {
      state.active = false;
      state.pose = 'open';
      state.targetPos.copy(restPos);
      state.targetRot.set(-0.34, 0.52, -0.10);
    },
    update(dt) {
      const spd = state.active ? 16.0 : 5.5;
      handGroup.position.lerp(state.targetPos, Math.min(1, dt * spd));
      handGroup.rotation.x += (state.targetRot.x - handGroup.rotation.x) * Math.min(1, dt * spd);
      handGroup.rotation.y += (state.targetRot.y - handGroup.rotation.y) * Math.min(1, dt * spd);
      handGroup.rotation.z += (state.targetRot.z - handGroup.rotation.z) * Math.min(1, dt * spd);

      fingers.forEach((f, idx) => {
        let baseCurl = -0.18;
        let tipCurl = -0.16;
        if (state.pose === 'grip') {
          baseCurl = -1.16;
          tipCurl = -1.04;
        } else if (state.pose === 'pinch') {
          baseCurl = idx === 0 ? -0.68 : -0.42;
          tipCurl = idx === 0 ? -0.52 : -0.35;
        } else if (state.pose === 'point') {
          baseCurl = idx === 0 ? -0.05 : -0.85;
          tipCurl = idx === 0 ? -0.04 : -0.78;
        }
        f.root.rotation.x += (baseCurl - f.root.rotation.x) * Math.min(1, dt * 14);
        f.tip.rotation.x += (tipCurl - f.tip.rotation.x) * Math.min(1, dt * 14);
      });

      const thumbCurl = state.pose === 'grip' ? 0.62 : state.pose === 'pinch' ? 0.45 : 0.18;
      thumbPivot.rotation.x += (thumbCurl - thumbPivot.rotation.x) * Math.min(1, dt * 14);
    },
  };
}
