import * as THREE from 'three';
import { createBowlTextures } from './textures.js';

/**
 * Large handcrafted Japanese nabe ladle (brushed stainless steel scoop + warm walnut handle)
 * resting on a glazed ceramic ladle rest (おたま置き) at foreground-right.
 * Holds golden dashi broth + up to 2 glistening cooked ingredients, and pours a gleaming
 * liquid arc into any family member's ceramic bowl (とんすい).
 */
export function createLadleSystem(scene) {
  const root = new THREE.Group();

  // Ceramic ladle rest (おたま置き) at foreground-right — clearly visible on Frame 1!
  const restPos = new THREE.Vector3(0.26, 0.0, 0.22);
  const restTex = createBowlTextures('#d7cfc2', '#6a4f3b', 3100);
  const restMat = new THREE.MeshPhysicalMaterial({
    map: restTex.map,
    normalMap: restTex.normalMap,
    roughness: 0.24,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14,
  });

  const restProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.036, 0.0),
    new THREE.Vector2(0.056, 0.012),
    new THREE.Vector2(0.060, 0.022),
    new THREE.Vector2(0.054, 0.024),
    new THREE.Vector2(0.044, 0.012),
    new THREE.Vector2(0.0, 0.009),
  ];
  const ladleRest = new THREE.Mesh(new THREE.LatheGeometry(restProfile, 28), restMat);
  ladleRest.position.copy(restPos);
  ladleRest.castShadow = true;
  ladleRest.receiveShadow = true;
  root.add(ladleRest);

  // =========================================================================
  // Ladle Group (pivot at the bowl/cup of the ladle for intuitive scooping & pouring!)
  // =========================================================================
  const ladleGroup = new THREE.Group();

  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8dce0,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.35,
    side: THREE.DoubleSide,
  });

  const handleWoodMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c3a22,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
  });

  // Deep gleaming stainless steel ladle cup (large and readable!)
  const cupGeo = new THREE.SphereGeometry(0.046, 26, 16, 0, Math.PI * 2, Math.PI * 0.44, Math.PI * 0.56);
  const cupMesh = new THREE.Mesh(cupGeo, steelMat);
  cupMesh.scale.set(1.0, 0.76, 1.06);
  cupMesh.position.y = 0.012;
  cupMesh.castShadow = true;
  cupMesh.receiveShadow = true;
  ladleGroup.add(cupMesh);

  // Subtle rolled rim on ladle cup
  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0022, 10, 32), steelMat);
  cupRim.rotation.x = Math.PI / 2;
  cupRim.scale.set(1.0, 1.06, 1.0);
  cupRim.position.y = 0.016;
  ladleGroup.add(cupRim);

  // Curved steel neck rising from back-right edge of cup
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.012, 0.044),
    new THREE.Vector3(0.0, 0.045, 0.062),
    new THREE.Vector3(0.0, 0.115, 0.115),
    new THREE.Vector3(0.0, 0.158, 0.155),
  ]);
  const neckMesh = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 18, 0.0046, 10, false), steelMat);
  neckMesh.castShadow = true;
  ladleGroup.add(neckMesh);

  // Turned warm walnut wooden handle grip (thick & inviting for a child's hand!)
  const gripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.145, 0.142),
    new THREE.Vector3(0.0, 0.215, 0.215),
    new THREE.Vector3(0.0, 0.268, 0.268),
  ]);
  const gripMesh = new THREE.Mesh(new THREE.TubeGeometry(gripCurve, 16, 0.0115, 14, false), handleWoodMat);
  gripMesh.castShadow = true;
  ladleGroup.add(gripMesh);

  // Brass ferrule collar joining steel neck & wooden handle
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.007, 0.018, 14),
    new THREE.MeshStandardMaterial({ color: 0xc89d54, metalness: 0.85, roughness: 0.26 })
  );
  ferrule.position.set(0, 0.146, 0.143);
  ferrule.rotation.x = Math.PI * 0.25;
  ladleGroup.add(ferrule);

  // End cap of wooden handle
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 12, 10), handleWoodMat);
  endCap.position.set(0, 0.268, 0.268);
  ladleGroup.add(endCap);

  // Golden dashi broth disc inside the ladle cup (visible when filled!)
  const ladleBrothMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9a24b,
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.25,
    transparent: true,
    opacity: 0.92,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const ladleBrothMesh = new THREE.Mesh(new THREE.CircleGeometry(0.041, 24), ladleBrothMat);
  ladleBrothMesh.rotation.x = -Math.PI / 2;
  ladleBrothMesh.position.y = 0.011;
  ladleBrothMesh.visible = false;
  ladleGroup.add(ladleBrothMesh);

  // Glowing pouring broth stream mesh (shown dynamically during pouring into a family bowl!)
  const pourStreamMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6b55a,
    roughness: 0.05,
    transparent: true,
    opacity: 0.86,
    clearcoat: 1.0,
  });
  const pourStream = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0095, 0.14, 12), pourStreamMat);
  pourStream.visible = false;
  root.add(pourStream);

  // Generous invisible touch hitboxes along cup & handle
  const hitCup = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitCup.name = 'ladleHit';
  ladleGroup.add(hitCup);

  const hitHandle = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitHandle.position.set(0, 0.17, 0.17);
  hitHandle.name = 'ladleHit';
  ladleGroup.add(hitHandle);

  // Resting pose on ceramic ladle rest — handle angled cleanly into lower-right view!
  const restLadlePos = new THREE.Vector3(restPos.x, 0.025, restPos.z);
  const restLadleRot = new THREE.Euler(0.06, 0.56, 0.04);

  ladleGroup.position.copy(restLadlePos);
  ladleGroup.rotation.copy(restLadleRot);
  root.add(ladleGroup);
  scene.add(root);

  const state = {
    mode: 'rest', // 'rest' | 'dragging' | 'scooping' | 'holding' | 'pouring'
    hasBroth: false,
    carriedItems: [],
    targetPos: restLadlePos.clone(),
    targetRot: restLadleRot.clone(),
    animT: 0,
    pourTargetMember: null,
    scoopPhase: 0,
    pourStreamAlpha: 0,
    handAttachWorld: new THREE.Vector3(),
  };

  let steamTimer = 0;

  return {
    root,
    ladleGroup,
    hitMeshes: [hitCup, hitHandle],
    restLadlePos,
    restLadleRot,
    state,

    // Start automated dip-and-scoop into the donabe (when player taps ladle or dips over pot)
    startScoop(potSystem, ingredientSystem, audio) {
      if (state.mode === 'pouring') return;
      state.mode = 'scooping';
      state.animT = 0;
      state.scoopPhase = 0;
      state.pourTargetMember = null;
      this._potRef = potSystem;
      this._ingRef = ingredientSystem;
      this._audioRef = audio;
    },

    // Pour carried broth & ingredients into a target family member's bowl!
    startPour(member, potSystem, audio) {
      if (!state.hasBroth && state.carriedItems.length === 0) return;
      state.mode = 'pouring';
      state.animT = 0;
      state.pourTargetMember = member;
      this._potRef = potSystem;
      this._audioRef = audio;
      this._pouredPayload = false;
      if (audio) audio.playPour();
    },

    returnToRest() {
      // Return any unpoured items gently back to pot if we drop ladle early
      if (state.carriedItems.length > 0 && this._potRef) {
        for (const it of state.carriedItems) {
          it.state = 'pot';
        }
        state.carriedItems = [];
      }
      state.hasBroth = false;
      ladleBrothMesh.visible = false;
      pourStream.visible = false;
      state.mode = 'rest';
      state.targetPos.copy(restLadlePos);
      state.targetRot.copy(restLadleRot);
    },

    setDragTarget(worldPos, potSystem) {
      state.targetPos.copy(worldPos);
      // Slight natural tilt toward center/camera
      const yaw = Math.atan2(worldPos.x, 0.55) * 0.45 + 0.25;
      state.targetRot.set(0.05, yaw, 0.0);

      // If dragged close into open pot while empty, scoop automatically!
      if (!state.hasBroth && potSystem && !potSystem.state.lidOn) {
        const dx = worldPos.x - potSystem.state.potCenter.x;
        const dz = worldPos.z - potSystem.state.potCenter.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.135) {
          return true; // signal caller to trigger scoop
        }
      }
      return false;
    },

    getHandleGripWorld(out = new THREE.Vector3()) {
      ladleGroup.updateMatrixWorld(true);
      out.set(0, 0.215, 0.215).applyMatrix4(ladleGroup.matrixWorld);
      return out;
    },

    update(dt, elapsed, potSystem, familySystem) {
      if (state.mode === 'scooping' && this._potRef) {
        state.animT += dt;
        const pc = this._potRef.state.potCenter;
        if (state.animT < 0.28) {
          // Dip down into steaming broth
          const t = state.animT / 0.28;
          state.targetPos.set(pc.x + 0.01, pc.y + 0.06 - t * 0.072, pc.z + 0.01);
          state.targetRot.set(-0.32 * t, 0.28, -0.18 * t);
        } else if (state.animT < 0.58) {
          // Scoop forward & fill ladle!
          if (state.scoopPhase === 0) {
            state.scoopPhase = 1;
            state.hasBroth = true;
            ladleBrothMesh.visible = true;
            this._potRef.spawnSplash(pc.x, pc.z, 8, 0.72);
            this._potRef.addSwirl(1.6);
            if (this._audioRef) this._audioRef.playLadleScoop();
            if (this._ingRef) {
              const scooped = this._ingRef.scoopFromPot(2);
              state.carriedItems = scooped;
            }
          }
          const t = (state.animT - 0.28) / 0.30;
          state.targetPos.set(pc.x - 0.01 + t * 0.02, pc.y - 0.012 + t * 0.145, pc.z + 0.01);
          state.targetRot.set(-0.32 * (1 - t) + 0.04, 0.28, -0.18 * (1 - t));
        } else {
          // Lifted full & ready to carry to any family bowl!
          state.mode = 'holding';
          state.targetPos.set(pc.x, pc.y + 0.155, pc.z + 0.03);
          state.targetRot.set(0.04, 0.26, 0.0);
        }
      } else if (state.mode === 'pouring' && state.pourTargetMember) {
        state.animT += dt;
        const bowlWorld = state.pourTargetMember.getBowlWorldPos();
        if (state.animT < 0.28) {
          // Move smoothly above the target bowl
          state.targetPos.set(bowlWorld.x + 0.035, bowlWorld.y + 0.145, bowlWorld.z + 0.025);
          state.targetRot.set(0.08, Math.atan2(bowlWorld.x, 0.5) * 0.45 + 0.2, 0.1);
        } else if (state.animT < 0.82) {
          // Tilt ladle dramatically & pour golden broth + glistening ingredients into bowl!
          const t = Math.min(1, (state.animT - 0.28) / 0.35);
          state.targetPos.set(bowlWorld.x + 0.028, bowlWorld.y + 0.132, bowlWorld.z + 0.02);
          state.targetRot.set(0.08, Math.atan2(bowlWorld.x, 0.5) * 0.45 + 0.2, 0.88 * t);

          // Show shimmering pouring liquid stream
          pourStream.visible = true;
          const cupSpout = new THREE.Vector3(-0.036, 0.005, 0).applyMatrix4(ladleGroup.matrixWorld);
          const streamMid = cupSpout.clone().lerp(bowlWorld.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.5);
          const streamLen = Math.max(0.04, cupSpout.distanceTo(bowlWorld));
          pourStream.position.copy(streamMid);
          pourStream.scale.set(0.85 + Math.sin(elapsed * 28) * 0.12, streamLen / 0.14, 0.85);

          if (!this._pouredPayload && state.animT > 0.46) {
            this._pouredPayload = true;
            const delivered = state.carriedItems.slice();
            state.carriedItems = [];
            state.hasBroth = false;
            ladleBrothMesh.visible = false;
            state.pourTargetMember.receiveServing(delivered, this._audioRef, potSystem);
            if (familySystem) {
              familySystem.onAnyServed(state.pourTargetMember);
            }
          }
        } else if (state.animT < 1.15) {
          pourStream.visible = false;
          state.targetPos.copy(restLadlePos);
          state.targetRot.copy(restLadleRot);
        } else {
          pourStream.visible = false;
          state.mode = 'rest';
          state.pourTargetMember = null;
        }
      }

      // Smooth spring interpolation for ladle position & rotation
      const lerpSpeed = state.mode === 'dragging' ? 16.0 : 9.5;
      ladleGroup.position.lerp(state.targetPos, Math.min(1, dt * lerpSpeed));
      ladleGroup.rotation.x += (state.targetRot.x - ladleGroup.rotation.x) * Math.min(1, dt * lerpSpeed);
      ladleGroup.rotation.y += (state.targetRot.y - ladleGroup.rotation.y) * Math.min(1, dt * lerpSpeed);
      ladleGroup.rotation.z += (state.targetRot.z - ladleGroup.rotation.z) * Math.min(1, dt * lerpSpeed);

      // Keep carried ingredients nestled realistically inside the gleaming ladle cup
      if (state.carriedItems.length > 0) {
        ladleGroup.updateMatrixWorld(true);
        state.carriedItems.forEach((it, idx) => {
          const offset =
            state.carriedItems.length === 1
              ? new THREE.Vector3(0, 0.015, 0)
              : new THREE.Vector3(idx === 0 ? -0.015 : 0.016, 0.015 + idx * 0.005, idx === 0 ? -0.008 : 0.01);
          const worldP = offset.applyMatrix4(ladleGroup.matrixWorld);
          it.mesh.position.lerp(worldP, Math.min(1, dt * 18));
          it.mesh.rotation.y += dt * 0.3;
          it.mesh.rotation.x *= 0.88;
          it.mesh.rotation.z *= 0.88;
        });
      }

      // Gentle steam rising from hot full ladle as child carries it across the table
      if (state.hasBroth && potSystem) {
        steamTimer += dt;
        if (steamTimer > 0.22) {
          steamTimer = 0;
          potSystem.emitLocalSteam(ladleGroup.position, 0.068);
        }
      }
    },
  };
}
