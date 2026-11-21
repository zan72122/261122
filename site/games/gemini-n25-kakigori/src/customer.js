import * as THREE from '../vendor/three.module.js';
import { createYukataTexture } from './textures.js';

// 4 charming handcrafted miniature Japanese wooden/bisque summer doll customers!
// Each has a distinct hair style, summer accessory (subtly hinting a favorite flavor!), and yukata.
const CUSTOMER_PROFILES = [
  {
    name: 'straw_girl',
    favorite: 'strawberry',
    skin: 0xf7dac3,
    hair: 0x3b261c,
    hairStyle: 'buns',
    yukata: ['#e85d75', '#fff2f4', '#fde047'],
    obi: 0xfef3c7,
    accessory: 'strawberry_clip',
  },
  {
    name: 'lemon_girl',
    favorite: 'lemon',
    skin: 0xf6d5bb,
    hair: 0x513424,
    hairStyle: 'bob',
    yukata: ['#f5b82e', '#fffbe6', '#f97316'],
    obi: 0xe64a4a,
    accessory: 'sunhat',
  },
  {
    name: 'blue_girl',
    favorite: 'blue',
    skin: 0xf9dfd0,
    hair: 0x26212a,
    hairStyle: 'pigtails',
    yukata: ['#2d7cb8', '#e6f6ff', '#fbbf24'],
    obi: 0xf472b6,
    accessory: 'blue_ribbon',
  },
  {
    name: 'rainbow_girl',
    favorite: 'rainbow',
    skin: 0xf5d4ba,
    hair: 0x4b2f21,
    hairStyle: 'bob',
    yukata: ['#4aa988', '#fef3c7', '#f472b6'],
    obi: 0xf59e0b,
    accessory: 'flower_crown',
  },
];

export class MiniatureCustomer {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    // Large, close-up handcrafted miniature figure seated nicely high across the counter so her face shines above the kakigori!
    this.homePos = new THREE.Vector3(0.0, 0.22, -1.32);
    this.root.position.copy(this.homePos);
    this.scene.add(this.root);

    this.profileIndex = 0;
    this.state = 'waiting'; // waiting, excited, eating, reacting, exiting, entering
    this.stateTime = 0;
    this.reactionType = 'happy';
    this.blinkTimer = 2.4;
    this.blinkAmt = 0;
    this.time = 0;
    this.lookTarget = new THREE.Vector3(0, 0.7, 0.35);
    this.hitMeshes = [];

    this._buildReactionEffects();
    this._buildDoll(CUSTOMER_PROFILES[0]);
  }

  _buildReactionEffects() {
    this.fxGroup = new THREE.Group();
    this.fxGroup.position.set(0, 2.05, -1.1);
    this.scene.add(this.fxGroup);

    this.fxParticles = [];
    const starGeo = new THREE.OctahedronGeometry(0.09, 0);
    const heartGeo = new THREE.SphereGeometry(0.08, 10, 8);
    const iceGeo = new THREE.ConeGeometry(0.055, 0.16, 5);

    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        i % 3 === 0 ? starGeo : i % 3 === 1 ? heartGeo : iceGeo,
        new THREE.MeshStandardMaterial({ color: 0xff6b8b, roughness: 0.3, emissive: 0x331111, emissiveIntensity: 0.25 })
      );
      m.visible = false;
      this.fxGroup.add(m);
      this.fxParticles.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0, rot: 0 });
    }
  }

  _spawnReactionBurst(type) {
    const palettes = {
      happy: [0xff6b8b, 0xffd166, 0xff9eb5],
      strawberry: [0xf43f5e, 0xff9eb5, 0xfef08a],
      lemon: [0xfacc15, 0xfde047, 0xfb923c],
      blue: [0x38bdf8, 0x7dd3fc, 0xfef08a],
      rainbow: [0xf43f5e, 0xfacc15, 0x38bdf8, 0xa855f7, 0x4ade80],
      brainfreeze: [0xbae6fd, 0xe0f2fe, 0x38bdf8],
    };
    const cols = palettes[type] || palettes.happy;
    for (let i = 0; i < this.fxParticles.length; i++) {
      const p = this.fxParticles[i];
      p.life = 1.15 + Math.random() * 0.55;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(cols[i % cols.length]);
      p.mesh.material.emissive.setHex(cols[i % cols.length]);
      const a = (i / this.fxParticles.length) * Math.PI * 2;
      const spd = 0.75 + Math.random() * 0.85;
      p.mesh.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.15);
      p.vx = Math.cos(a) * spd;
      p.vy = 1.1 + Math.random() * 1.1;
      p.vz = Math.sin(a) * spd * 0.4;
      p.rot = (Math.random() - 0.5) * 8;
    }
  }

  _buildDoll(profile) {
    // Clear previous doll mesh
    while (this.root.children.length > 0) {
      this.root.remove(this.root.children[0]);
    }
    this.hitMeshes = [];

    this.profile = profile;
    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    // Authentic handcrafted matte wooden/bisque miniature doll materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: profile.skin,
      roughness: 0.56,
      metalness: 0.0,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: profile.hair,
      roughness: 0.48,
      metalness: 0.04,
    });
    const yukataTex = createYukataTexture(...profile.yukata);
    const yukataMat = new THREE.MeshStandardMaterial({
      map: yukataTex,
      roughness: 0.84,
    });
    const obiMat = new THREE.MeshStandardMaterial({
      color: profile.obi,
      roughness: 0.78,
    });
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xfbf7ee,
      roughness: 0.82,
    });

    // 1. Sculpted rounded wooden/bisque torso in handcrafted Japanese summer yukata!
    const torsoPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.60, 0.0),
      new THREE.Vector2(0.56, 0.30),
      new THREE.Vector2(0.50, 0.62),
      new THREE.Vector2(0.44, 0.80),
      new THREE.Vector2(0.32, 0.90),
      new THREE.Vector2(0.18, 0.94),
      new THREE.Vector2(0.0, 0.94),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 28), yukataMat);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyGroup.add(torso);

    // Crisp crossed white yukata kimono collar
    const collarL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.24, 6, 10), collarMat);
    collarL.position.set(-0.08, 0.82, 0.34);
    collarL.rotation.set(-0.35, 0, -0.58);
    this.bodyGroup.add(collarL);
    const collarR = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.24, 6, 10), collarMat);
    collarR.position.set(0.08, 0.82, 0.34);
    collarR.rotation.set(-0.35, 0, 0.58);
    this.bodyGroup.add(collarR);

    // Obi sash around waist
    const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.57, 0.24, 24), obiMat);
    obi.position.y = 0.28;
    this.bodyGroup.add(obi);

    // Smooth wooden doll neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.24, 16), skinMat);
    neck.position.y = 0.98;
    this.bodyGroup.add(neck);

    // 2. LARGE Expressive Miniature Doll Head!
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.48, 0.04);
    this.bodyGroup.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.54, 28, 22), skinMat);
    head.scale.set(1.04, 0.97, 0.98);
    head.castShadow = true;
    head.receiveShadow = true;
    this.headGroup.add(head);

    // Cute miniature sculpted nose & ears
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), skinMat);
    nose.position.set(0, -0.05, 0.53);
    this.headGroup.add(nose);

    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat);
      ear.position.set(sx * 0.53, -0.04, -0.02);
      ear.scale.set(0.55, 0.95, 0.8);
      this.headGroup.add(ear);
    }

    // Rosy miniature painted cheeks (brighten on happy/strawberry reaction!)
    this.cheekMat = new THREE.MeshStandardMaterial({
      color: 0xf47f86,
      roughness: 0.65,
      transparent: true,
      opacity: 0.52,
    });
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 10), this.cheekMat);
      cheek.position.set(sx * 0.31, -0.11, 0.44);
      cheek.scale.set(1.22, 0.72, 0.30);
      this.headGroup.add(cheek);
    }

    // Glossy glass-bead dark doll eyes with real white specular catchlights!
    const eyeBallMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1310,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes = [];
    this.eyebrows = [];

    for (const sx of [-1, 1]) {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(sx * 0.20, 0.03, 0.48);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.084, 16, 12), eyeBallMat);
      bead.scale.set(0.95, 1.06, 0.62);
      eyeSocket.add(bead);

      // Sparkling twin catchlights
      const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), catchlightMat);
      c1.position.set(0.024, 0.030, 0.050);
      eyeSocket.add(c1);
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), catchlightMat);
      c2.position.set(-0.022, -0.022, 0.048);
      eyeSocket.add(c2);

      this.headGroup.add(eyeSocket);
      this.eyes.push(eyeSocket);

      // Cute curved painted eyebrow clearly visible above eye!
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.075, 6, 8), hairMat);
      brow.rotation.z = Math.PI / 2 - sx * 0.18;
      brow.position.set(sx * 0.20, 0.17, 0.485);
      this.headGroup.add(brow);
      this.eyebrows.push(brow);
    }

    // Expressive Mouth (happy smile / open eating O / sour pucker / blue-tongue tint!)
    this.mouthMat = new THREE.MeshStandardMaterial({ color: 0xd94b5a, roughness: 0.35 });
    this.openMouthMat = new THREE.MeshStandardMaterial({ color: 0x992639, roughness: 0.55 });
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.022, 8, 18, Math.PI), this.mouthMat);
    this.mouth.position.set(0, -0.15, 0.495);
    this.mouth.rotation.z = Math.PI; // Warm curved smile!
    this.headGroup.add(this.mouth);

    this.openMouth = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 10), this.openMouthMat);
    this.openMouth.position.set(0, -0.20, 0.465);
    this.openMouth.scale.set(1.05, 0.95, 0.42);
    this.openMouth.visible = false;
    this.headGroup.add(this.openMouth);

    // 3. Sculpted Miniature Doll Hair — properly positioned BACK & TOP so full face shines clearly!
    const backHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.57, 24, 18),
      hairMat
    );
    backHair.position.set(0, 0.05, -0.12);
    backHair.scale.set(1.03, 1.02, 0.94);
    backHair.castShadow = true;
    this.headGroup.add(backHair);

    // Top hair crown tilted cleanly back off the forehead
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.44),
      hairMat
    );
    hairCrown.position.set(0, 0.07, -0.02);
    hairCrown.rotation.x = -0.28;
    hairCrown.castShadow = true;
    this.headGroup.add(hairCrown);

    // Side bob locks framing cheeks cleanly (never covering eyes!)
    for (const sx of [-1, 1]) {
      const sideLock = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), hairMat);
      sideLock.position.set(sx * 0.48, -0.08, -0.02);
      sideLock.scale.set(0.68, 1.38, 0.85);
      this.headGroup.add(sideLock);
    }
    // Cute neat sculpted bangs sitting cleanly ABOVE the eyebrows!
    for (let i = -2; i <= 2; i++) {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), hairMat);
      bang.position.set(i * 0.145, 0.35 - Math.abs(i) * 0.035, 0.38 - Math.abs(i) * 0.055);
      bang.scale.set(1.05, 0.78, 0.62);
      this.headGroup.add(bang);
    }

    if (profile.hairStyle === 'buns') {
      for (const sx of [-1, 1]) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), hairMat);
        bun.position.set(sx * 0.50, 0.44, -0.10);
        bun.castShadow = true;
        this.headGroup.add(bun);
      }
    } else if (profile.hairStyle === 'pigtails') {
      for (const sx of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.32, 10, 12), hairMat);
        tail.position.set(sx * 0.60, 0.02, -0.08);
        tail.rotation.z = sx * 0.25;
        tail.castShadow = true;
        this.headGroup.add(tail);
      }
    }

    // Visual craving accessory (purely pictorial, zero text!)
    this._addAccessory(profile.accessory);

    // 4. BIG Articulated Miniature Arms & Sculpted Doll Hands resting naturally on the counter!
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.46, 0.68, 0.12);
    this.bodyGroup.add(this.leftArm);

    const sleeveL = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.28, 10, 14), yukataMat);
    sleeveL.rotation.set(Math.PI * 0.38, 0, 0.2);
    sleeveL.position.set(-0.06, -0.14, 0.20);
    sleeveL.castShadow = true;
    this.leftArm.add(sleeveL);

    this.leftHand = new THREE.Group();
    this.leftHand.position.set(-0.04, -0.34, 0.45);
    const lPalm = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), skinMat);
    lPalm.scale.set(1.05, 0.78, 1.15);
    lPalm.castShadow = true;
    this.leftHand.add(lPalm);
    const lThumb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
    lThumb.position.set(0.095, 0.01, 0.03);
    this.leftHand.add(lThumb);
    this.leftArm.add(this.leftHand);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.46, 0.68, 0.12);
    this.bodyGroup.add(this.rightArm);

    const sleeveR = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.28, 10, 14), yukataMat);
    sleeveR.rotation.set(Math.PI * 0.38, 0, -0.2);
    sleeveR.position.set(0.06, -0.14, 0.20);
    sleeveR.castShadow = true;
    this.rightArm.add(sleeveR);

    this.rightHand = new THREE.Group();
    this.rightHand.position.set(0.04, -0.34, 0.45);
    const rPalm = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), skinMat);
    rPalm.scale.set(1.05, 0.78, 1.15);
    rPalm.castShadow = true;
    this.rightHand.add(rPalm);
    const rThumb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
    rThumb.position.set(-0.095, 0.01, 0.03);
    this.rightHand.add(rThumb);
    this.rightArm.add(this.rightHand);

    // Customer's miniature silver eating spoon (held in right hand when eating!)
    this.eatSpoon = new THREE.Group();
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xecf2f7, roughness: 0.16, metalness: 0.9 });
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.42), silverMat);
    sh.position.z = 0.18;
    this.eatSpoon.add(sh);
    const sb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), silverMat);
    sb.scale.set(0.85, 0.35, 1.3);
    sb.position.z = 0.42;
    this.eatSpoon.add(sb);
    // Scoop of ice sitting on the spoon!
    this.spoonScoop = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.45 })
    );
    this.spoonScoop.position.set(0, 0.055, 0.42);
    this.spoonScoop.visible = false;
    this.eatSpoon.add(this.spoonScoop);

    this.eatSpoon.position.set(0.04, -0.34, 0.45);
    this.eatSpoon.visible = false;
    this.rightArm.add(this.eatSpoon);

    // Generous hitbox for tapping customer to serve!
    const custHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 2.2, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    custHit.position.set(0, 1.15, 0.15);
    custHit.userData = { interactType: 'customer' };
    this.bodyGroup.add(custHit);
    this.hitMeshes.push(custHit);
  }

  _addAccessory(type) {
    if (type === 'strawberry_clip') {
      const berry = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.22, 12),
        new THREE.MeshPhysicalMaterial({ color: 0xe6203b, roughness: 0.2, clearcoat: 0.8 })
      );
      berry.position.set(0.36, 0.42, 0.32);
      berry.rotation.set(0.3, 0, -0.5);
      this.headGroup.add(berry);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x2f8a42, roughness: 0.5 })
      );
      leaf.scale.set(1.4, 0.5, 1.4);
      leaf.position.set(0.31, 0.50, 0.31);
      this.headGroup.add(leaf);
    } else if (type === 'sunhat') {
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xe6c37a, roughness: 0.85 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.92, 0.05, 24), strawMat);
      brim.position.set(0, 0.44, -0.02);
      brim.rotation.x = -0.14;
      brim.castShadow = true;
      this.headGroup.add(brim);

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.32, 20), strawMat);
      crown.position.set(0, 0.59, -0.04);
      crown.rotation.x = -0.14;
      crown.castShadow = true;
      this.headGroup.add(crown);

      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(0.51, 0.045, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xf5b800, roughness: 0.65 })
      );
      ribbon.rotation.x = Math.PI / 2 - 0.14;
      ribbon.position.set(0, 0.48, -0.03);
      this.headGroup.add(ribbon);
    } else if (type === 'blue_ribbon') {
      const ribMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.55 });
      for (const sx of [-1, 1]) {
        const bow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), ribMat);
        bow.scale.set(1.3, 0.7, 0.55);
        bow.position.set(sx * 0.46, 0.34, 0.16);
        bow.rotation.z = sx * 0.4;
        this.headGroup.add(bow);
      }
    } else if (type === 'flower_crown') {
      const colors = [0xf43f5e, 0xfacc15, 0x38bdf8, 0xa855f7, 0x4ade80];
      for (let i = 0; i < 7; i++) {
        const a = -0.95 + (i / 6) * 1.9;
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.105, 10, 8),
          new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.5 })
        );
        fl.position.set(Math.sin(a) * 0.50, 0.46, Math.cos(a) * 0.46);
        this.headGroup.add(fl);
      }
    }
  }

  setLookTarget(vec3) {
    this.lookTarget.copy(vec3);
  }

  setEager(isEager) {
    if (this.state === 'waiting' || this.state === 'excited') {
      this.state = isEager ? 'excited' : 'waiting';
    }
  }

  startEating(flavorProfile, onBite, onDone) {
    this.state = 'eating';
    this.stateTime = 0;
    this.flavorProfile = flavorProfile;
    this.onBite = onBite;
    this.onDone = onDone;
    this.bitesTaken = 0;

    // Color the spoon scoop to match the child's creation!
    const scoopColors = {
      strawberry: 0xe6203b,
      lemon: 0xf7c914,
      blue: 0x0ea5e9,
      rainbow: 0xe879f9,
      plain: 0xf5faff,
    };
    this.spoonScoop.material.color.setHex(scoopColors[flavorProfile.dominant] || 0xf5faff);
    this.eatSpoon.visible = true;

    // Pick signature reaction!
    if (flavorProfile.isRainbow) this.reactionType = 'rainbow';
    else if (flavorProfile.isMega) this.reactionType = 'brainfreeze';
    else if (flavorProfile.dominant === 'lemon') this.reactionType = 'lemon';
    else if (flavorProfile.dominant === 'blue') this.reactionType = 'blue';
    else if (flavorProfile.dominant === 'strawberry') this.reactionType = 'strawberry';
    else this.reactionType = 'happy';
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;

    // Natural blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.4;
      this.blinkAmt = 1.0;
    }
    if (this.blinkAmt > 0) {
      this.blinkAmt = Math.max(0, this.blinkAmt - dt * 7.5);
    }
    const eyeScaleY = 1.0 - Math.sin(this.blinkAmt * Math.PI) * 0.88;

    // Update celebration particles
    for (const p of this.fxParticles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 1.8 * dt;
      p.mesh.rotation.y += p.rot * dt;
      p.mesh.rotation.x += p.rot * 0.7 * dt;
      p.mesh.scale.setScalar(Math.min(1, p.life * 1.4));
      if (p.life <= 0) p.mesh.visible = false;
    }

    // Head tracking toward bowl / player action
    const localLook = this.lookTarget.clone().sub(this.root.position);
    const yaw = THREE.MathUtils.clamp(Math.atan2(localLook.x, Math.max(0.6, localLook.z)), -0.45, 0.45);
    const pitch = THREE.MathUtils.clamp(-0.18 + (localLook.y - 0.9) * 0.2, -0.35, 0.25);

    if (this.state === 'waiting') {
      this.root.position.lerp(this.homePos, Math.min(1, dt * 6));
      this.bodyGroup.position.y = Math.sin(this.time * 2.1) * 0.025;
      this.bodyGroup.rotation.z = Math.sin(this.time * 1.2) * 0.025;
      this.headGroup.rotation.y += (yaw - this.headGroup.rotation.y) * Math.min(1, dt * 6);
      this.headGroup.rotation.x += (-pitch - this.headGroup.rotation.x) * Math.min(1, dt * 6);
      this.headGroup.rotation.z = Math.sin(this.time * 1.4) * 0.04;
      this.leftArm.rotation.set(0.06, 0, 0);
      this.rightArm.rotation.set(0.06, 0, 0);
      this.mouth.visible = true;
      this.openMouth.visible = false;
      this.mouthMat.color.setHex(0xd94b5a);
      this.cheekMat.opacity = 0.52;
      for (const e of this.eyes) e.scale.set(1, eyeScaleY, 1);
    } else if (this.state === 'excited') {
      // Leans eagerly toward counter & gently taps little hands!
      this.root.position.lerp(this.homePos, Math.min(1, dt * 6));
      this.bodyGroup.position.y = Math.abs(Math.sin(this.time * 4.5)) * 0.05;
      this.bodyGroup.rotation.x = 0.10;
      this.headGroup.rotation.y += (yaw - this.headGroup.rotation.y) * Math.min(1, dt * 8);
      this.headGroup.rotation.x += (-pitch + 0.05 - this.headGroup.rotation.x) * Math.min(1, dt * 8);
      this.leftArm.rotation.x = -0.15 + Math.sin(this.time * 9) * 0.14;
      this.rightArm.rotation.x = -0.15 + Math.cos(this.time * 9) * 0.14;
      this.mouth.visible = true;
      this.openMouth.visible = false;
      this.cheekMat.opacity = 0.68;
      for (const e of this.eyes) e.scale.set(1.06, eyeScaleY * 1.06, 1);
    } else if (this.state === 'eating') {
      // 3 visible animated spoon scoops straight from bowl to mouth!
      const cycleDur = 0.78;
      const cycleIdx = Math.floor(this.stateTime / cycleDur);
      const t = (this.stateTime % cycleDur) / cycleDur;

      this.bodyGroup.rotation.x = 0.08;
      this.headGroup.rotation.y *= 0.85;

      if (cycleIdx < 3) {
        if (t < 0.42) {
          // Reach down into the kakigori bowl
          const f = t / 0.42;
          this.rightArm.rotation.x = 0.25 * Math.sin(f * Math.PI * 0.5);
          this.rightArm.rotation.y = 0.35;
          this.headGroup.rotation.x = 0.18;
          this.openMouth.visible = false;
          this.mouth.visible = true;
          this.spoonScoop.visible = f > 0.32;
        } else if (t < 0.78) {
          // Lift spoonful up to open mouth!
          const f = (t - 0.42) / 0.36;
          this.rightArm.rotation.x = 0.25 - f * 1.15;
          this.rightArm.rotation.y = 0.35 + f * 0.35;
          this.headGroup.rotation.x = 0.18 - f * 0.24;
          this.openMouth.visible = true;
          this.mouth.visible = false;
          this.openMouth.scale.set(1.0, 0.85 + Math.sin(f * Math.PI) * 0.45, 0.55);
          this.spoonScoop.visible = f < 0.82;
          if (f > 0.75 && this.bitesTaken <= cycleIdx) {
            this.bitesTaken = cycleIdx + 1;
            if (this.onBite) this.onBite(cycleIdx);
          }
        } else {
          // Happy munch!
          const f = (t - 0.78) / 0.22;
          this.rightArm.rotation.x = -0.5 + f * 0.5;
          this.openMouth.visible = false;
          this.mouth.visible = true;
          this.spoonScoop.visible = false;
          this.bodyGroup.position.y = Math.sin(f * Math.PI * 2) * 0.04;
        }
      } else {
        // Done scooping -> burst into flavor-specific delight!
        this.eatSpoon.visible = false;
        this.spoonScoop.visible = false;
        this.state = 'reacting';
        this.stateTime = 0;
        this._spawnReactionBurst(this.reactionType);
        if (this.onBite) this.onBite('react', this.reactionType);
      }
      for (const e of this.eyes) e.scale.set(1.04, eyeScaleY, 1);
    } else if (this.state === 'reacting') {
      const t = this.stateTime;
      this.bodyGroup.rotation.x = 0;
      this.openMouth.visible = false;
      this.mouth.visible = true;

      if (this.reactionType === 'brainfreeze') {
        if (t < 0.9) {
          // Comical icy shiver with hands on cheeks!
          this.headGroup.rotation.z = Math.sin(t * 48) * 0.16;
          this.leftArm.rotation.set(-1.15, -0.45, 0.35);
          this.rightArm.rotation.set(-1.15, 0.45, -0.35);
          this.openMouth.visible = true;
          this.mouth.visible = false;
          this.openMouth.scale.set(0.75, 1.15, 0.5);
          for (const e of this.eyes) e.scale.set(1.15, 0.45, 1);
        } else {
          // Shakes it off & laughs happily!
          this.bodyGroup.position.y = Math.abs(Math.sin(t * 10)) * 0.16;
          this.headGroup.rotation.z = Math.sin(t * 8) * 0.1;
          this.leftArm.rotation.set(-1.05, 0, -0.4);
          this.rightArm.rotation.set(-1.05, 0, 0.4);
          this.cheekMat.opacity = 0.85;
          for (const e of this.eyes) e.scale.set(1.08, 0.35, 1); // Happy crescent eyes!
        }
      } else if (this.reactionType === 'lemon') {
        if (t < 0.65) {
          // Cute sour pucker wiggle!
          this.headGroup.rotation.z = Math.sin(t * 36) * 0.18;
          this.openMouth.visible = true;
          this.mouth.visible = false;
          this.openMouth.scale.set(0.42, 0.42, 0.5);
          for (const e of this.eyes) e.scale.set(1.1, 0.22, 1);
        } else {
          // Huge delighted grin & bounce!
          this.bodyGroup.position.y = Math.abs(Math.sin(t * 10)) * 0.18;
          this.leftArm.rotation.set(-1.1, 0, -0.45);
          this.rightArm.rotation.set(-1.1, 0, 0.45);
          this.cheekMat.opacity = 0.88;
          for (const e of this.eyes) e.scale.set(1.1, 1.1, 1);
        }
      } else if (this.reactionType === 'rainbow') {
        // Big celebratory joy spin + clapping bounce!
        this.bodyGroup.position.y = Math.abs(Math.sin(t * 11)) * 0.22;
        this.bodyGroup.rotation.y = Math.sin(Math.min(1, t / 1.4) * Math.PI * 2) * 0.55;
        this.leftArm.rotation.set(-1.2 + Math.sin(t * 16) * 0.2, 0.3, -0.35);
        this.rightArm.rotation.set(-1.2 + Math.sin(t * 16) * 0.2, -0.3, 0.35);
        this.cheekMat.opacity = 0.92;
        for (const e of this.eyes) e.scale.set(1.15, 0.35, 1);
      } else {
        // Strawberry / Blue Hawaii / Happy bounce & clap!
        if (this.reactionType === 'blue') {
          this.mouthMat.color.setHex(0x0284c7); // Cute Blue Hawaii tongue tint!
        }
        this.bodyGroup.position.y = Math.abs(Math.sin(t * 9.5)) * 0.16;
        this.headGroup.rotation.z = Math.sin(t * 7) * 0.12;
        this.leftArm.rotation.set(-1.05, 0.25 * Math.sin(t * 14), -0.3);
        this.rightArm.rotation.set(-1.05, -0.25 * Math.sin(t * 14), 0.3);
        this.cheekMat.opacity = 0.88;
        for (const e of this.eyes) e.scale.set(1.08, 0.35, 1);
      }

      if (t > 1.95) {
        this.state = 'exiting';
        this.stateTime = 0;
        this.bodyGroup.rotation.y = 0;
      }
    } else if (this.state === 'exiting') {
      // Friendly wave goodbye while gliding happily to the side
      this.root.position.x -= dt * 3.1;
      this.bodyGroup.position.y = Math.abs(Math.sin(this.time * 10)) * 0.08;
      this.rightArm.rotation.set(-1.2, 0, 0.45 + Math.sin(this.time * 16) * 0.35);
      if (this.stateTime > 0.95) {
        // Swap to the next charming miniature customer!
        this.profileIndex = (this.profileIndex + 1) % CUSTOMER_PROFILES.length;
        this._buildDoll(CUSTOMER_PROFILES[this.profileIndex]);
        this.root.position.set(3.2, this.homePos.y, this.homePos.z);
        this.state = 'entering';
        this.stateTime = 0;
        if (this.onDone) this.onDone();
      }
    } else if (this.state === 'entering') {
      this.root.position.x += (this.homePos.x - this.root.position.x) * Math.min(1, dt * 6.5);
      this.bodyGroup.position.y = Math.abs(Math.sin(this.time * 11)) * 0.07;
      if (Math.abs(this.root.position.x - this.homePos.x) < 0.03) {
        this.root.position.x = this.homePos.x;
        this.state = 'waiting';
        this.stateTime = 0;
      }
    }
  }
}
