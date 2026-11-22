import * as THREE from '../vendor/three.module.js';
import { makeSoft3DMaterial, addPencilOutline } from './materials.js';

// Large, soft foreground 3D hands ("手・人物・食べ物は画面に大きく").
// Forearms angle naturally DOWNWARD toward the bottom-left and bottom-right screen corners
// so sleeve ends never float cut-off in midair!

export class CookingHands {
  constructor() {
    this.group = new THREE.Group();

    const skinMat = makeSoft3DMaterial({
      color: 0xffe2cb,
      roughness: 0.65,
      emissive: 0x612814,
      emissiveIntensity: 0.11
    });
    const tipMat = makeSoft3DMaterial({
      color: 0xffc2b2,
      roughness: 0.66,
      emissive: 0x5c2218,
      emissiveIntensity: 0.10
    });
    const sleeveMat = makeSoft3DMaterial({
      color: 0xfff8eb,
      roughness: 0.76,
      emissive: 0x3b2615,
      emissiveIntensity: 0.08
    });
    const cuffMat = makeSoft3DMaterial({
      color: 0xffd27d,
      roughness: 0.72,
      emissive: 0x45260a,
      emissiveIntensity: 0.09
    });

    this.left = this._buildSingleHand(-1, skinMat, tipMat, sleeveMat, cuffMat);
    this.right = this._buildSingleHand(1, skinMat, tipMat, sleeveMat, cuffMat);
    this.group.add(this.left.root);
    this.group.add(this.right.root);

    this.leftTargetPos = new THREE.Vector3(-0.95, 0.45, 1.05);
    this.rightTargetPos = new THREE.Vector3(0.95, 0.45, 1.05);
    this.leftTargetRot = new THREE.Euler(0.15, -0.35, -0.2);
    this.rightTargetRot = new THREE.Euler(0.15, 0.35, 0.2);

    this.leftCurl = 0.22;
    this.rightCurl = 0.22;
    this.left.root.position.copy(this.leftTargetPos);
    this.right.root.position.copy(this.rightTargetPos);
  }

  _buildSingleHand(side, skinMat, tipMat, sleeveMat, cuffMat) {
    const root = new THREE.Group();
    root.scale.setScalar(0.94);

    // Palm & fingers rotate freely inside wristGroup while forearm sleeve stays angled downward!
    const wristGroup = new THREE.Group();
    root.add(wristGroup);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), skinMat);
    palm.scale.set(1.06, 0.56, 1.15);
    palm.raycast = () => {};
    addPencilOutline(palm, 0.025, 0x6b4230, 0.48);
    wristGroup.add(palm);

    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), tipMat);
    pad.scale.set(1.0, 0.35, 1.02);
    pad.position.set(0, -0.07, -0.02);
    pad.raycast = () => {};
    wristGroup.add(pad);

    // 4 soft articulated fingers pointing along -Z
    const fingers = [];
    const fingerSpecs = [
      { x: -side * 0.16, len: 0.19, r: 0.055, yaw: side * 0.11 },
      { x: -side * 0.055, len: 0.22, r: 0.058, yaw: side * 0.03 },
      { x: side * 0.05, len: 0.205, r: 0.056, yaw: -side * 0.03 },
      { x: side * 0.15, len: 0.165, r: 0.050, yaw: -side * 0.10 }
    ];

    fingerSpecs.forEach((fs) => {
      const fPivot = new THREE.Group();
      fPivot.position.set(fs.x, 0.0, -0.22);
      fPivot.rotation.y = fs.yaw;

      const fMesh = new THREE.Mesh(new THREE.CapsuleGeometry(fs.r, fs.len, 8, 12), skinMat);
      fMesh.rotation.x = Math.PI * 0.5;
      fMesh.position.set(0, 0, -fs.len * 0.52);
      fMesh.raycast = () => {};
      addPencilOutline(fMesh, 0.028, 0x6b4230, 0.45);
      fPivot.add(fMesh);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(fs.r * 0.95, 10, 8), tipMat);
      tip.position.set(0, -0.008, -fs.len - 0.01);
      tip.raycast = () => {};
      fPivot.add(tip);

      wristGroup.add(fPivot);
      fingers.push(fPivot);
    });

    // Plump thumb on inner side
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-side * 0.21, -0.02, -0.05);
    thumbPivot.rotation.y = side * 0.62;
    const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.16, 8, 12), skinMat);
    thumbMesh.rotation.x = Math.PI * 0.5;
    thumbMesh.position.set(0, 0, -0.10);
    thumbMesh.raycast = () => {};
    addPencilOutline(thumbMesh, 0.028, 0x6b4230, 0.45);
    thumbPivot.add(thumbMesh);
    wristGroup.add(thumbPivot);

    // Forearm & rounded sleeve anchored to `root` (NOT `wristGroup`!)
    // Positive X rotation (+0.58) angles the +Z sleeve cleanly DOWNWARD below the bottom viewport edge!
    const armHolder = new THREE.Group();
    armHolder.position.set(0, -0.04, 0.12);
    armHolder.rotation.set(0.58, side * 0.36, 0);
    root.add(armHolder);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.48, 10, 14), skinMat);
    arm.rotation.x = Math.PI * 0.5;
    arm.position.set(0, 0, 0.24);
    arm.raycast = () => {};
    addPencilOutline(arm, 0.024, 0x6b4230, 0.44);
    armHolder.add(arm);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.048, 10, 20), cuffMat);
    cuff.position.set(0, 0, 0.26);
    cuff.raycast = () => {};
    armHolder.add(cuff);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.195, 1.15, 10, 16), sleeveMat);
    sleeve.rotation.x = Math.PI * 0.5;
    sleeve.position.set(0, 0, 0.82);
    sleeve.raycast = () => {};
    addPencilOutline(sleeve, 0.02, 0x6b4230, 0.40);
    armHolder.add(sleeve);

    return { root, wristGroup, fingers, thumbPivot, side };
  }

  setLeftPose(pos, rotX, rotY, rotZ, curl = 0.25) {
    this.leftTargetPos.copy(pos);
    this.leftTargetRot.set(rotX, rotY, rotZ);
    this.leftCurl = curl;
  }

  setRightPose(pos, rotX, rotY, rotZ, curl = 0.25) {
    this.rightTargetPos.copy(pos);
    this.rightTargetRot.set(rotX, rotY, rotZ);
    this.rightCurl = curl;
  }

  update(dt, stiffness = 13.0) {
    const alpha = Math.min(1, dt * stiffness);
    this._stepHand(this.left, this.leftTargetPos, this.leftTargetRot, this.leftCurl, alpha);
    this._stepHand(this.right, this.rightTargetPos, this.rightTargetRot, this.rightCurl, alpha);
  }

  _stepHand(hand, targetPos, targetRot, curl, alpha) {
    hand.root.position.lerp(targetPos, alpha);
    hand.wristGroup.rotation.x += (targetRot.x - hand.wristGroup.rotation.x) * alpha;
    hand.wristGroup.rotation.y += (targetRot.y - hand.wristGroup.rotation.y) * alpha;
    hand.wristGroup.rotation.z += (targetRot.z - hand.wristGroup.rotation.z) * alpha;

    // Notice: with fingers along -Z, positive X rotation curls fingertips DOWNWARD (-Y)!
    // Wait: let's verify! For (0, 0, -L), Rx(a) gives y' = -(-L) sin(a) = +L sin(a)!
    // So NEGATIVE `a` gives y' < 0 (curling fingertips DOWNWARD into the meat/palm)!
    // Keep `-Math.abs(curl)` so curl > 0 always flexes downward!
    const c = Math.max(0, curl);
    hand.fingers.forEach((f, idx) => {
      const targetFlex = -c * (0.75 + idx * 0.05);
      f.rotation.x += (targetFlex - f.rotation.x) * alpha;
    });
    hand.thumbPivot.rotation.x += (-c * 0.48 - hand.thumbPivot.rotation.x) * alpha;
  }
}
