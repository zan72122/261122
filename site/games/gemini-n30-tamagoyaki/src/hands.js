import * as THREE from '../vendor/three.module.min.js';

// Large, warm, realistic 3D articulated cooking hand that physically grabs eggs,
// stirs chopsticks, tilts the bowl, rolls with the spatula, slices with the knife,
// packs bento pieces, and performs a single gentle idle demonstration when untouched.
export class PlayerHand {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.position.set(0, 1.4, 1.8);
    scene.add(this.root);

    this.targetPos = new THREE.Vector3(0, 1.4, 1.8);
    this.targetRot = new THREE.Euler(0.15, 0, 0);
    this.visibleAlpha = 0; // smoothly slides hand in/out from front-right
    this.active = false;
    this.pose = 'open'; // open | pinch | grip | flat

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5c5a8,
      roughness: 0.52,
      metalness: 0.0,
    });
    const nailMat = new THREE.MeshStandardMaterial({
      color: 0xfbe2d6,
      roughness: 0.25,
    });
    const cuffMat = new THREE.MeshStandardMaterial({
      color: 0xf6efe6,
      roughness: 0.85,
    });

    this.handMesh = new THREE.Group();
    this.root.add(this.handMesh);

    // Forearm + soft cream sleeve cuff extending smoothly toward player (+Z)
    const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.34, 8, 16), skinMat);
    wrist.rotation.x = Math.PI * 0.5;
    wrist.position.set(0, 0.01, 0.36);
    wrist.castShadow = true;
    this.handMesh.add(wrist);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.095, 0.24, 16), cuffMat);
    cuff.rotation.x = Math.PI * 0.5;
    cuff.position.set(0, 0.015, 0.56);
    this.handMesh.add(cuff);

    // Sculpted palm
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.068, 0.20), skinMat);
    palm.position.set(0, 0, 0.06);
    palm.castShadow = true;
    this.handMesh.add(palm);

    const palmRound = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skinMat);
    palmRound.scale.set(1.04, 0.42, 1.08);
    palmRound.position.set(0, 0.005, 0.055);
    palmRound.castShadow = true;
    this.handMesh.add(palmRound);

    // Four softly tapered fingers (index, middle, ring, pinky)
    this.fingers = [];
    const fingerSpecs = [
      { x: -0.066, len: 0.145, r: 0.022, z: -0.045 },
      { x: -0.022, len: 0.160, r: 0.023, z: -0.052 },
      { x: 0.024, len: 0.148, r: 0.022, z: -0.048 },
      { x: 0.068, len: 0.118, r: 0.019, z: -0.036 },
    ];
    for (const f of fingerSpecs) {
      const fPivot = new THREE.Group();
      fPivot.position.set(f.x, 0.005, f.z);
      this.handMesh.add(fPivot);

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r, f.len, 6, 12), skinMat);
      seg1.rotation.x = Math.PI * 0.5;
      seg1.position.set(0, 0, -f.len * 0.52);
      seg1.castShadow = true;
      fPivot.add(seg1);

      const nail = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.72, 8, 8), nailMat);
      nail.scale.set(0.9, 0.35, 1.15);
      nail.position.set(0, f.r * 0.76, -f.len * 0.92);
      fPivot.add(nail);

      this.fingers.push(fPivot);
    }

    // Opposable thumb on left (-X) side of right hand
    this.thumbPivot = new THREE.Group();
    this.thumbPivot.position.set(-0.095, -0.008, 0.045);
    this.handMesh.add(this.thumbPivot);

    const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.115, 6, 12), skinMat);
    thumbMesh.rotation.x = Math.PI * 0.5;
    thumbMesh.rotation.z = 0.42;
    thumbMesh.position.set(-0.035, -0.01, -0.058);
    thumbMesh.castShadow = true;
    this.thumbPivot.add(thumbMesh);

    // Scale hand generously so it's big and unmistakable for a 5-year-old
    this.handMesh.scale.setScalar(1.22);
  }

  setTarget(pos, rotEuler = null, pose = 'open', visible = true) {
    this.targetPos.copy(pos);
    if (rotEuler) {
      this.targetRot.copy(rotEuler);
    }
    this.pose = pose;
    this.active = visible;
  }

  hide(anchorX = 0) {
    this.active = false;
    this.targetPos.set(anchorX + 0.95, 0.72, 1.95);
    this.targetRot.set(0.2, -0.25, 0);
  }

  update(dt) {
    const speed = this.active ? 13 : 5.5;
    this.root.position.lerp(this.targetPos, Math.min(1, dt * speed));
    this.root.rotation.x += (this.targetRot.x - this.root.rotation.x) * Math.min(1, dt * speed);
    this.root.rotation.y += (this.targetRot.y - this.root.rotation.y) * Math.min(1, dt * speed);
    this.root.rotation.z += (this.targetRot.z - this.root.rotation.z) * Math.min(1, dt * speed);

    // Finger articulation per pose
    let curl = 0.18;
    let thumbCurl = 0.12;
    if (this.pose === 'pinch') {
      curl = 0.65;
      thumbCurl = 0.55;
    } else if (this.pose === 'grip') {
      curl = 1.05;
      thumbCurl = 0.68;
    } else if (this.pose === 'flat') {
      curl = 0.06;
      thumbCurl = 0.05;
    }

    for (let i = 0; i < this.fingers.length; i++) {
      const f = this.fingers[i];
      const extra = this.pose === 'pinch' && i > 1 ? 0.35 : 0;
      const targetX = -(curl + extra);
      f.rotation.x += (targetX - f.rotation.x) * Math.min(1, dt * 12);
    }
    this.thumbPivot.rotation.y += (-thumbCurl - this.thumbPivot.rotation.y) * Math.min(1, dt * 12);
    this.thumbPivot.rotation.x += (-thumbCurl * 0.45 - this.thumbPivot.rotation.x) * Math.min(1, dt * 12);

    this.visibleAlpha += ((this.active ? 1 : 0) - this.visibleAlpha) * Math.min(1, dt * 7);
    this.root.visible = this.visibleAlpha > 0.03;
  }
}
