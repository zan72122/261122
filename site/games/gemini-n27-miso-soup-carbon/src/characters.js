import { THREE, clayMat, sculptClayGeo, SquashSpring } from './clay.js';
import { sound } from './audio.js';

/**
 * Builds one big, expressive, chubby clay family member (bust + shoulders + 2 big counter hands + face rig)
 * and manages autonomous eye-tracking, blinking, breathing, poking, blowing "fuu-fuu", slurping, and cheering.
 */
export class ClayFamilyMember {
  constructor(role, config) {
    this.role = role; // 'girl' | 'mom' | 'dad'
    this.config = config;
    this.root = new THREE.Group();
    this.root.position.copy(config.basePos);

    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    this.squash = new SquashSpring(190, 13);
    this.headSquash = new SquashSpring(220, 14);

    // State
    this.mood = 'curious'; // 'curious' | 'excited' | 'wow' | 'sniff' | 'eager' | 'blowing' | 'slurping' | 'chewing' | 'bliss'
    this.moodTimer = 0;
    this.blinkTimer = 1.2 + Math.random() * 2.5;
    this.isBlinking = false;
    this.lookTarget = new THREE.Vector3(0, 0.8, 0.5);
    this.currentLook = new THREE.Vector3(0, 0.8, 0.5);
    this.servedCount = 0;
    this.eatingSeq = null; // { phase, t, hasGiantTofu, hasFlower, wakameCount }
    this.heldBowl = null;
    this.breathPhase = Math.random() * Math.PI * 2;

    this._buildSculpt();
  }

  _buildSculpt() {
    const skinMat = clayMat(this.config.skinHex, { roughness: 0.72, warmth: 0.22, rim: 0.22 });
    const cheekMat = clayMat(0xff7e79, {
      roughness: 0.68,
      warmth: 0.28,
      transparent: true,
      opacity: 0.72,
    });
    this.cheekMat = cheekMat;

    const clothMat = clayMat(this.config.clothHex, { roughness: 0.78, warmth: 0.16 });
    const trimMat = clayMat(this.config.trimHex, { roughness: 0.76, warmth: 0.18 });
    const hairMat = clayMat(this.config.hairHex, { roughness: 0.76, warmth: 0.12, bumpScale: 0.032 });

    const s = this.config.scale ?? 1.0;

    // Plump torso / shoulders rising behind the counter
    const torsoGeo = sculptClayGeo(new THREE.SphereGeometry(0.76 * s, 26, 20), 0.018, 3.0, 1.1);
    torsoGeo.scale(1.18, 1.05, 0.86);
    const torso = new THREE.Mesh(torsoGeo, clothMat);
    torso.position.set(0, 0.42 * s, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyGroup.add(torso);

    // Cute clay collar / apron detail
    const collarGeo = new THREE.TorusGeometry(0.44 * s, 0.11 * s, 12, 24);
    collarGeo.rotateX(Math.PI * 0.5);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(0, 0.96 * s, 0.08 * s);
    this.bodyGroup.add(collar);

    if (this.role === 'mom') {
      // Cozy apron bib front
      const bibGeo = sculptClayGeo(new THREE.SphereGeometry(0.46 * s, 18, 14), 0.012, 4.0, 2.0);
      bibGeo.scale(1.0, 0.95, 0.35);
      const bib = new THREE.Mesh(bibGeo, trimMat);
      bib.position.set(0, 0.56 * s, 0.55 * s);
      this.bodyGroup.add(bib);
    }

    // Head Pivot
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.56 * s, 0.06 * s);
    this.bodyGroup.add(this.headGroup);

    this.headMeshGroup = new THREE.Group();
    this.headGroup.add(this.headMeshGroup);

    // Big chubby sculpted clay head!
    const headR = 0.68 * s;
    this.headR = headR;
    const headGeo = sculptClayGeo(new THREE.SphereGeometry(headR, 32, 26), 0.014, 2.8, this.config.seed);
    headGeo.scale(1.08, 0.98, 0.98);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    head.receiveShadow = true;
    head.userData.character = this;
    this.headMeshGroup.add(head);
    torso.userData.character = this;

    // Plump ears
    const earGeo = new THREE.SphereGeometry(0.15 * s, 14, 12);
    earGeo.scale(0.65, 1.0, 0.85);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(side * headR * 1.03, -0.04 * s, 0.02);
      this.headMeshGroup.add(ear);
    }

    // Sculpted clay hair per character
    this._buildHair(hairMat, trimMat, headR, s);

    // Face Rig (front of head at +Z)
    this.faceGroup = new THREE.Group();
    this.faceGroup.position.set(0, 0, headR * 0.92);
    this.headMeshGroup.add(this.faceGroup);

    // Plump clay button nose
    const noseGeo = new THREE.SphereGeometry(0.105 * s * (this.role === 'dad' ? 1.25 : 1.0), 14, 12);
    noseGeo.scale(1.08, 0.92, 0.95);
    this.nose = new THREE.Mesh(noseGeo, skinMat);
    this.nose.position.set(0, -0.02 * s, 0.08 * s);
    this.faceGroup.add(this.nose);

    // Rosy clay cheeks
    const cheekGeo = new THREE.SphereGeometry(0.16 * s, 14, 12);
    cheekGeo.scale(1.25, 0.82, 0.35);
    this.cheeks = [];
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.position.set(side * 0.36 * s, -0.11 * s, 0.01 * s);
      cheek.rotation.y = side * 0.38;
      this.faceGroup.add(cheek);
      this.cheeks.push(cheek);
    }

    // Shiny dark clay bead eyes + white catchlights + happy arc lids
    const eyeMat = clayMat(0x231815, { roughness: 0.24, warmth: 0.04, rim: 0.1 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const smileEyeMat = clayMat(0x2d1e18, { roughness: 0.5, warmth: 0.08 });

    this.eyes = [];
    this.smileEyes = [];
    this.brows = [];

    const browMat = clayMat(this.config.hairHex, { roughness: 0.72, warmth: 0.1 });

    for (const side of [-1, 1]) {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.24 * s, 0.11 * s, 0.03 * s);
      this.faceGroup.add(eyeSocket);

      const beadGeo = new THREE.SphereGeometry(0.088 * s, 16, 14);
      beadGeo.scale(1.0, 1.12, 0.72);
      const bead = new THREE.Mesh(beadGeo, eyeMat);

      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.032 * s, 10, 8), shineMat);
      shine.position.set(0.026 * s, 0.032 * s, 0.058 * s);
      bead.add(shine);

      eyeSocket.add(bead);
      this.eyes.push({ socket: eyeSocket, bead, side });

      // Happy curved "^" clay arc eye (shown when blissful/laughing)
      const arcGeo = new THREE.TorusGeometry(0.082 * s, 0.024 * s, 8, 16, Math.PI * 0.88);
      const arc = new THREE.Mesh(arcGeo, smileEyeMat);
      arc.rotation.z = Math.PI * 0.06;
      arc.position.set(side * 0.24 * s, 0.09 * s, 0.05 * s);
      arc.visible = false;
      this.faceGroup.add(arc);
      this.smileEyes.push(arc);

      // Expressive clay eyebrow
      const browThickness = this.role === 'dad' ? 0.046 * s : 0.030 * s;
      const browGeo = new THREE.CapsuleGeometry(browThickness, 0.13 * s, 6, 10);
      browGeo.rotateZ(Math.PI * 0.5);
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(side * 0.25 * s, 0.27 * s, 0.05 * s);
      this.faceGroup.add(brow);
      this.brows.push({ mesh: brow, side, baseY: 0.27 * s });
    }

    if (this.role === 'dad') {
      // Cute friendly sculpted clay moustache
      const stacheMat = clayMat(this.config.hairHex, { roughness: 0.75 });
      for (const side of [-1, 1]) {
        const mGeo = new THREE.CapsuleGeometry(0.042 * s, 0.11 * s, 6, 10);
        mGeo.rotateZ(Math.PI * 0.5 - side * 0.28);
        const m = new THREE.Mesh(mGeo, stacheMat);
        m.position.set(side * 0.09 * s, -0.12 * s, 0.08 * s);
        this.faceGroup.add(m);
      }
    }

    // Dynamic 3D Clay Mouth Rig (smile arc + open/O/blow cavity + tongue)
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, -0.22 * s, 0.04 * s);
    this.faceGroup.add(this.mouthGroup);

    const mouthDarkMat = clayMat(0x6e222a, { roughness: 0.65, warmth: 0.1 });
    const tongueMat = clayMat(0xf47983, { roughness: 0.62, warmth: 0.25 });
    const lipMat = clayMat(0xd45b5b, { roughness: 0.68, warmth: 0.2 });

    // Smile crescent
    const smileGeo = new THREE.TorusGeometry(0.11 * s, 0.024 * s, 8, 18, Math.PI * 0.92);
    smileGeo.rotateZ(Math.PI * 1.04);
    this.mouthSmile = new THREE.Mesh(smileGeo, mouthDarkMat);
    this.mouthSmile.position.y = 0.05 * s;
    this.mouthGroup.add(this.mouthSmile);

    // Open mouth oval (used for "O", "Aaan!", chewing, blowing "Fuu-fuu")
    const openGeo = new THREE.SphereGeometry(0.11 * s, 16, 14);
    openGeo.scale(1.0, 1.0, 0.45);
    this.mouthOpen = new THREE.Mesh(openGeo, mouthDarkMat);
    this.mouthOpen.visible = false;

    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.068 * s, 12, 10), tongueMat);
    tongue.scale.set(1.1, 0.65, 0.55);
    tongue.position.set(0, -0.04 * s, 0.025 * s);
    this.mouthOpen.add(tongue);
    this.mouthGroup.add(this.mouthOpen);

    // Pursed "Fuu-fuu" clay ring lips
    const fuuGeo = new THREE.TorusGeometry(0.052 * s, 0.026 * s, 10, 16);
    this.mouthFuu = new THREE.Mesh(fuuGeo, lipMat);
    this.mouthFuu.position.z = 0.04 * s;
    this.mouthFuu.visible = false;
    this.mouthGroup.add(this.mouthFuu);

    // Two BIG Plump Chubby Clay Hands resting visibly on the counter!
    this.hands = [];
    for (const side of [-1, 1]) {
      const handGroup = new THREE.Group();
      const basePos = new THREE.Vector3(side * 0.56 * s, 0.34, 0.72);
      handGroup.position.copy(basePos);

      const palmGeo = sculptClayGeo(new THREE.SphereGeometry(0.19 * s, 16, 14), 0.01, 4.0, side + 2);
      palmGeo.scale(1.12, 0.72, 1.18);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      palm.userData.character = this;
      handGroup.add(palm);

      // Cute thumb bump + finger dimples
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.078 * s, 10, 10), skinMat);
      thumb.position.set(-side * 0.16 * s, 0.02, 0.06 * s);
      handGroup.add(thumb);

      for (let f = -1; f <= 1; f++) {
        const finger = new THREE.Mesh(new THREE.SphereGeometry(0.065 * s, 10, 8), skinMat);
        finger.scale.set(0.9, 0.78, 1.25);
        finger.position.set(f * 0.085 * s, -0.01, 0.17 * s);
        handGroup.add(finger);
      }

      this.root.add(handGroup);
      this.hands.push({ group: handGroup, side, basePos });
    }

    // Floating joy/heart/flower clay pop particles above character head
    this.joyParticles = [];
    const heartMat = clayMat(0xff6b8b, { roughness: 0.6, warmth: 0.3 });
    const starMat = clayMat(0xffce47, { roughness: 0.55, warmth: 0.35 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      if (i % 2 === 0) {
        // Plump clay heart made of 2 spheres + cone tip
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), heartMat);
        l.position.set(-0.055, 0.04, 0);
        const r = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), heartMat);
        r.position.set(0.055, 0.04, 0);
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 12), heartMat);
        b.rotation.z = Math.PI;
        b.position.set(0, -0.04, 0);
        g.add(l, r, b);
      } else {
        // Plump clay flower blossom
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), starMat);
          petal.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
          g.add(petal);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), heartMat);
        center.position.z = 0.02;
        g.add(center);
      }
      g.visible = false;
      this.root.add(g);
      this.joyParticles.push({ mesh: g, life: 0, maxLife: 1.2, vel: new THREE.Vector3() });
    }
  }

  _buildHair(hairMat, trimMat, headR, s) {
    if (this.role === 'girl') {
      // Plump bob hair cap tilted backward so her bright peach clay face is 100% open & clear!
      const capGeo = sculptClayGeo(
        new THREE.SphereGeometry(headR * 1.07, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.55),
        0.018,
        3.5,
        5.0
      );
      capGeo.scale(1.09, 1.02, 1.04);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.rotation.x = -0.58;
      cap.position.set(0, 0.08 * s, -0.04 * s);
      cap.castShadow = true;
      this.headMeshGroup.add(cap);

      // Side bob puffs framing cheeks neatly behind face plane!
      for (const side of [-1, 1]) {
        const puffGeo = sculptClayGeo(new THREE.SphereGeometry(0.32 * s, 16, 14), 0.015, 4.0, side + 8);
        puffGeo.scale(0.80, 1.25, 0.92);
        const puff = new THREE.Mesh(puffGeo, hairMat);
        puff.position.set(side * headR * 1.02, -0.06 * s, -0.04 * s);
        puff.rotation.z = side * 0.16;
        this.headMeshGroup.add(puff);
      }

      // Cute high sculpted bangs well above eyebrows!
      for (let i = -2; i <= 2; i++) {
        const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.092 * s, 0.14 * s, 6, 10), hairMat);
        bang.position.set(i * 0.145 * s, headR * 0.68, headR * 0.76 - Math.abs(i) * 0.04);
        bang.rotation.z = i * -0.08;
        bang.rotation.x = 0.42;
        this.headMeshGroup.add(bang);
      }

      // Bright strawberry-red clay flower hair clip
      const clipMat = clayMat(0xff4d6d, { roughness: 0.6, warmth: 0.25 });
      const centerMat = clayMat(0xffd447, { roughness: 0.6, warmth: 0.25 });
      const clip = new THREE.Group();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        const pet = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 10, 8), clipMat);
        pet.position.set(Math.cos(a) * 0.09 * s, Math.sin(a) * 0.09 * s, 0);
        clip.add(pet);
      }
      clip.add(new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 10, 8), centerMat));
      clip.position.set(-headR * 0.78, headR * 0.56, headR * 0.68);
      clip.rotation.y = -0.45;
      clip.rotation.x = -0.25;
      this.headMeshGroup.add(clip);
    } else if (this.role === 'mom') {
      // Warm sculpted hair tilted back so Mom's gentle peach face shines clearly!
      const capGeo = sculptClayGeo(
        new THREE.SphereGeometry(headR * 1.06, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.54),
        0.02,
        3.6,
        9.0
      );
      capGeo.scale(1.09, 1.02, 1.04);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.rotation.x = -0.60;
      cap.position.set(0, 0.08 * s, -0.04 * s);
      cap.castShadow = true;
      this.headMeshGroup.add(cap);

      // Soft side hair framing ears
      for (const side of [-1, 1]) {
        const sideLock = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 14, 12), hairMat);
        sideLock.scale.set(0.75, 1.2, 0.9);
        sideLock.position.set(side * headR * 1.0, 0.04 * s, -0.05 * s);
        this.headMeshGroup.add(sideLock);

        // High parted front hair sweep above eyebrows
        const wave = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * s, 0.28 * s, 8, 12), hairMat);
        wave.position.set(side * 0.30 * s, headR * 0.68, headR * 0.70);
        wave.rotation.z = side * 1.18;
        wave.rotation.y = side * 0.32;
        this.headMeshGroup.add(wave);
      }

      // Big plump top clay bun + coral hair ornament!
      const bunGeo = sculptClayGeo(new THREE.SphereGeometry(0.34 * s, 20, 16), 0.018, 4.2, 3.3);
      bunGeo.scale(1.14, 0.88, 1.04);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(0, headR * 1.02, -0.18 * s);
      bun.castShadow = true;
      this.headMeshGroup.add(bun);

      const beadMat = clayMat(0xff7a59, { roughness: 0.55, warmth: 0.25 });
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 12, 10), beadMat);
      pin.position.set(0.28 * s, headR * 0.92, 0.04 * s);
      this.headMeshGroup.add(pin);
    } else {
      // Dad: Cozy thick sculpted clay hair tilted cleanly above forehead & eyebrows!
      const capGeo = sculptClayGeo(
        new THREE.SphereGeometry(headR * 1.06, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.52),
        0.022,
        4.0,
        12.0
      );
      capGeo.scale(1.08, 1.0, 1.03);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.rotation.x = -0.58;
      cap.position.set(0, 0.09 * s, -0.04 * s);
      cap.castShadow = true;
      this.headMeshGroup.add(cap);

      for (let i = -1; i <= 1; i++) {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 14, 12), hairMat);
        tuft.scale.set(1.1, 0.76, 1.12);
        tuft.position.set(i * 0.21 * s, headR * 0.78, headR * 0.62);
        tuft.rotation.z = i * -0.22;
        this.headMeshGroup.add(tuft);
      }
    }
  }

  setMood(mood, duration = 1.6) {
    if (this.eatingSeq) return; // Don't interrupt active eating sequence
    this.mood = mood;
    this.moodTimer = duration;
    if (mood === 'wow' || mood === 'excited') {
      this.squash.impulse(2.2);
      this.headSquash.impulse(-2.0);
    } else if (mood === 'sniff') {
      this.headSquash.impulse(1.5);
    }
  }

  poke() {
    this.squash.impulse(-3.2);
    this.headSquash.impulse(2.8);
    sound.playClayBoop(this.role === 'girl' ? 1.25 : this.role === 'mom' ? 1.0 : 0.75, 0.18);
    sound.playVoice(this.role, 'giggle');

    if (this.eatingSeq && this.eatingSeq.phase === 'blowing') {
      // Helping blow cool the hot soup!
      sound.playBlowFuu(1.25);
      this.eatingSeq.t += 0.55;
      this.spawnJoyBurst(2);
      return;
    }
    this.setMood('excited', 1.4);
    this.spawnJoyBurst(2);
  }

  spawnJoyBurst(count = 3) {
    let spawned = 0;
    for (const p of this.joyParticles) {
      if (p.life <= 0 && spawned < count) {
        p.life = p.maxLife;
        p.mesh.visible = true;
        p.mesh.position.set(
          (Math.random() - 0.5) * 0.7,
          2.35 + Math.random() * 0.25,
          0.35 + Math.random() * 0.2
        );
        p.mesh.scale.setScalar(0.01);
        p.vel.set((Math.random() - 0.5) * 0.45, 0.75 + Math.random() * 0.35, (Math.random() - 0.5) * 0.2);
        spawned++;
      }
    }
  }

  /**
   * Receives a filled soup bowl and plays out an interactive, expressive
   * claymation blowing -> slurping -> chewing -> blissful delight sequence!
   */
  receiveBowl(bowlGroup, soupTraits) {
    this.servedCount++;
    this.heldBowl = bowlGroup;
    // Attach bowl smoothly into character's root space right between their hands
    this.root.attach(bowlGroup);
    this.eatingSeq = {
      phase: 'blowing', // 'blowing' -> 'slurping' -> 'chewing' -> 'done'
      t: 0,
      hasGiantTofu: soupTraits.hasGiantTofu,
      hasFlower: soupTraits.hasFlower,
      wakameCount: soupTraits.wakameCount,
    };
    this.squash.impulse(2.4);
    sound.playBlowFuu(this.role === 'dad' ? 0.8 : this.role === 'girl' ? 1.22 : 1.0);
  }

  clearBowl() {
    if (this.heldBowl) {
      this.heldBowl.parent?.remove(this.heldBowl);
      this.heldBowl = null;
    }
    this.eatingSeq = null;
  }

  update(dt, time, worldLookTarget, isServingPhase = false) {
    this.breathPhase += dt * 2.2;
    this.squash.update(dt, this.bodyGroup, 1.0);
    this.headSquash.update(dt, this.headMeshGroup, 1.0);

    // Mood decay
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && !this.eatingSeq) {
        this.mood = this.servedCount > 0 ? 'bliss' : 'curious';
      }
    }

    // Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkTimer = 0.11;
      } else {
        this.isBlinking = false;
        this.blinkTimer = 2.0 + Math.random() * 3.2;
      }
    }

    // Eating sequence choreography
    if (this.eatingSeq) {
      const seq = this.eatingSeq;
      seq.t += dt;

      if (seq.phase === 'blowing') {
        this.mood = 'blowing';
        // Cradle bowl in front of chest, lean down and blow "Fuu-fuu!"
        if (this.heldBowl) {
          this.heldBowl.position.lerp(new THREE.Vector3(0, 0.82, 0.92), Math.min(1, dt * 8));
          this.heldBowl.rotation.x = THREE.MathUtils.lerp(this.heldBowl.rotation.x, 0.06, dt * 8);
          this.heldBowl.scale.lerp(new THREE.Vector3(0.84, 0.84, 0.84), dt * 8);
        }
        if (seq.t > 1.25) {
          seq.phase = 'slurping';
          seq.t = 0;
          const extra = seq.hasGiantTofu || seq.hasFlower || seq.wakameCount >= 5;
          sound.playSlurpAndDelight(this.role, extra);
        }
      } else if (seq.phase === 'slurping') {
        this.mood = 'slurping';
        // Lift bowl right up to mouth and tilt to slurp!
        if (this.heldBowl) {
          this.heldBowl.position.lerp(new THREE.Vector3(0, 1.18, 0.78), Math.min(1, dt * 10));
          this.heldBowl.rotation.x = THREE.MathUtils.lerp(this.heldBowl.rotation.x, -0.48, dt * 10);
          // Lower liquid inside held bowl as they drink!
          if (this.heldBowl.userData.liquidGroup) {
            const s = Math.max(0.28, 1 - seq.t * 0.75);
            this.heldBowl.userData.liquidGroup.position.y = 0.12 + s * 0.24;
          }
        }
        if (seq.t > 0.85) {
          seq.phase = seq.hasGiantTofu ? 'chewing' : 'done';
          seq.t = 0;
          if (!seq.hasGiantTofu) {
            this.mood = 'bliss';
            this.spawnJoyBurst(4);
            this.squash.impulse(2.8);
          }
        }
      } else if (seq.phase === 'chewing') {
        // Big comical squirrel-cheek munching for giant tofu!
        this.mood = 'chewing';
        if (this.heldBowl) {
          this.heldBowl.position.lerp(new THREE.Vector3(0, 0.34, 0.86), Math.min(1, dt * 8));
          this.heldBowl.rotation.x = THREE.MathUtils.lerp(this.heldBowl.rotation.x, 0, dt * 8);
        }
        if (seq.t > 1.15) {
          seq.phase = 'done';
          seq.t = 0;
          this.mood = 'bliss';
          this.spawnJoyBurst(4);
          this.squash.impulse(3.0);
          sound.playVoice(this.role, 'wow');
        }
      } else if (seq.phase === 'done') {
        this.mood = 'bliss';
        // Hold happy bowl visibly at chest height (Mom rests slightly lower behind pot rim)
        if (this.heldBowl) {
          const sideX = this.role === 'girl' ? -0.32 : this.role === 'dad' ? 0.32 : 0.0;
          const restY = this.role === 'mom' ? 0.22 : 0.62;
          this.heldBowl.position.lerp(new THREE.Vector3(sideX, restY, 0.82), Math.min(1, dt * 7));
          this.heldBowl.rotation.x = THREE.MathUtils.lerp(this.heldBowl.rotation.x, 0.12, dt * 7);
          this.heldBowl.scale.lerp(new THREE.Vector3(0.76, 0.76, 0.76), dt * 7);
        }
        if (seq.t > 0.7) {
          this.eatingSeq = null;
        }
      }
    }

    // Eye & Head tracking
    if (worldLookTarget) {
      this.lookTarget.copy(worldLookTarget);
    }
    if (this.eatingSeq && this.heldBowl) {
      const bowlWorld = new THREE.Vector3();
      this.heldBowl.getWorldPosition(bowlWorld);
      this.lookTarget.copy(bowlWorld);
    }
    this.currentLook.lerp(this.lookTarget, Math.min(1, dt * 7.5));

    const headWorld = new THREE.Vector3();
    this.headGroup.getWorldPosition(headWorld);
    const dir = this.currentLook.clone().sub(headWorld);
    const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, Math.max(0.8, dir.z)) * 0.48, -0.45, 0.45);
    const pitch = THREE.MathUtils.clamp(-Math.atan2(dir.y, Math.max(0.8, dir.z)) * 0.38, -0.28, 0.38);

    const happySway = this.mood === 'bliss' || this.mood === 'excited'
      ? Math.sin(time * 5.2 + this.breathPhase) * 0.11
      : Math.sin(this.breathPhase) * 0.025;

    this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, yaw, dt * 8);
    this.headGroup.rotation.x = THREE.MathUtils.lerp(
      this.headGroup.rotation.x,
      pitch + (this.mood === 'sniff' ? -0.18 : 0),
      dt * 8
    );
    this.headGroup.rotation.z = happySway;

    // Subtle bead pupil offset
    const useSmileEyes = this.mood === 'bliss' || this.mood === 'sniff';
    for (let i = 0; i < 2; i++) {
      const e = this.eyes[i];
      const arc = this.smileEyes[i];
      e.bead.visible = !useSmileEyes;
      arc.visible = useSmileEyes;
      const blinkScale = this.isBlinking ? 0.12 : 1.12;
      e.bead.scale.y = blinkScale * (this.mood === 'wow' ? 1.22 : 1.0);
      e.bead.scale.x = this.mood === 'wow' ? 1.18 : 1.0;
      e.socket.position.x = e.side * 0.24 * (this.config.scale ?? 1) + yaw * 0.05;
      e.socket.position.y = 0.11 * (this.config.scale ?? 1) - pitch * 0.04;
    }

    // Eyebrows expression
    for (const b of this.brows) {
      let by = b.baseY;
      let rot = 0;
      if (this.mood === 'wow' || this.mood === 'excited') {
        by += 0.055;
        rot = b.side * 0.18;
      } else if (this.mood === 'blowing') {
        by += 0.02;
        rot = -b.side * 0.15;
      } else if (this.mood === 'bliss') {
        by += 0.035;
        rot = b.side * 0.12;
      }
      b.mesh.position.y = THREE.MathUtils.lerp(b.mesh.position.y, by, dt * 10);
      b.mesh.rotation.z = THREE.MathUtils.lerp(b.mesh.rotation.z, rot, dt * 10);
    }

    // Cheeks puff & glow!
    const cheekPuff = this.mood === 'chewing'
      ? 1.48 + Math.sin(time * 16) * 0.22
      : this.mood === 'bliss'
      ? 1.25
      : 1.0;
    for (const c of this.cheeks) {
      c.scale.set(1.25 * cheekPuff, 0.82 * cheekPuff, 0.35 * cheekPuff);
    }
    this.cheekMat.opacity = this.mood === 'bliss' || this.mood === 'sniff' ? 0.88 : 0.68;

    // Mouth morphing
    this.mouthSmile.visible = false;
    this.mouthOpen.visible = false;
    this.mouthFuu.visible = false;

    if (this.mood === 'blowing') {
      this.mouthFuu.visible = true;
      const pulse = 1 + Math.sin(time * 14) * 0.2;
      this.mouthFuu.scale.set(pulse, pulse, 1.2);
    } else if (this.mood === 'wow' || this.mood === 'slurping' || this.mood === 'eager') {
      this.mouthOpen.visible = true;
      const openAmt = this.mood === 'slurping' ? 1.15 + Math.sin(time * 22) * 0.2 : 1.05;
      this.mouthOpen.scale.set(0.95, openAmt, 0.5);
    } else if (this.mood === 'chewing') {
      this.mouthSmile.visible = true;
      this.mouthSmile.scale.set(1.15, 0.7 + Math.abs(Math.sin(time * 15)) * 0.65, 1.0);
    } else if (this.mood === 'bliss' || this.mood === 'excited') {
      this.mouthOpen.visible = true;
      this.mouthOpen.scale.set(1.28, 0.92, 0.45);
    } else {
      this.mouthSmile.visible = true;
      this.mouthSmile.scale.set(1, 1, 1);
    }

    // Nose sniff wiggle
    if (this.mood === 'sniff') {
      this.nose.position.y = -0.02 + Math.sin(time * 18) * 0.025;
    } else {
      this.nose.position.y = -0.02;
    }

    // Counter Hands choreography!
    for (const h of this.hands) {
      const target = h.basePos.clone();
      let rx = 0, ry = 0, rz = 0;

      if (this.eatingSeq && (this.eatingSeq.phase === 'blowing' || this.eatingSeq.phase === 'slurping')) {
        // Cradle the held bowl with both hands!
        const liftY = this.eatingSeq.phase === 'slurping' ? 1.12 : 0.78;
        target.set(h.side * 0.42, liftY, 0.84);
        rz = -h.side * 0.65;
        rx = -0.35;
      } else if (isServingPhase && this.servedCount === 0) {
        // Eagerly reach hands forward asking for miso soup ("ちょうだい！")
        const wave = Math.sin(time * 6.5 + (h.side > 0 ? 0.6 : 0)) * 0.08;
        target.set(h.side * 0.44, 0.34 + Math.max(0, wave), 0.98);
        rx = -0.25;
      } else if (this.mood === 'excited' || this.mood === 'bliss') {
        // Happy little clay hand claps / bounces!
        const bounce = Math.abs(Math.sin(time * 7.5 + h.side * 0.3)) * 0.16;
        target.y += bounce;
        if (this.heldBowl) {
          target.x = h.side * 0.56;
        }
      }

      h.group.position.lerp(target, Math.min(1, dt * 10));
      h.group.rotation.set(rx, ry, rz);
    }

    // Update floating clay hearts & blossoms
    for (const p of this.joyParticles) {
      if (p.life > 0) {
        p.life -= dt;
        const prog = 1 - p.life / p.maxLife;
        p.mesh.position.addScaledVector(p.vel, dt);
        const sc = prog < 0.22 ? prog / 0.22 : Math.max(0, 1 - (prog - 0.55) / 0.45);
        p.mesh.scale.setScalar(sc * 1.15);
        p.mesh.rotation.z = Math.sin(time * 5 + prog * 4) * 0.25;
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
  }
}

/**
 * Creates the 3-member Clay Family (Sister, Mom, Dad) seated closely right behind the counter.
 */
export function createClayFamily(scene) {
  const familyGroup = new THREE.Group();
  scene.add(familyGroup);

  const girl = new ClayFamilyMember('girl', {
    basePos: new THREE.Vector3(-1.46, -0.20, -1.92),
    scale: 0.94,
    skinHex: 0xffd9c2,
    hairHex: 0x5c3624,
    clothHex: 0xffcb47,
    trimHex: 0xfff3d6,
    seed: 1.5,
  });

  const mom = new ClayFamilyMember('mom', {
    basePos: new THREE.Vector3(0.0, -0.14, -2.08),
    scale: 1.02,
    skinHex: 0xffdec9,
    hairHex: 0x3f2419,
    clothHex: 0xf7efe1,
    trimHex: 0x7cb587,
    seed: 4.2,
  });

  const dad = new ClayFamilyMember('dad', {
    basePos: new THREE.Vector3(1.48, -0.11, -1.94),
    scale: 1.08,
    skinHex: 0xf7cba8,
    hairHex: 0x2e211b,
    clothHex: 0x4b6b94,
    trimHex: 0xe8995e,
    seed: 8.7,
  });

  familyGroup.add(girl.root, mom.root, dad.root);
  return { familyGroup, members: [girl, mom, dad], girl, mom, dad };
}

/**
 * Builds the HUGE Foreground Plump Clay Left Hand (open palm up for holding Tofu!)
 * + the Chunky Child-Safe Clay Kitchen Knife!
 */
export function createForegroundTofuHands(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const skinMat = clayMat(0xffd7be, { roughness: 0.70, warmth: 0.24, rim: 0.22 });
  const sleeveMat = clayMat(0xff8fab, { roughness: 0.78, warmth: 0.18 });
  const cuffMat = clayMat(0xfff5e8, { roughness: 0.76, warmth: 0.2 });

  // Left Palm Pivot (positioned right above the pot so sliced tofu drops straight in!)
  const palmPivot = new THREE.Group();
  palmPivot.position.set(-0.18, 1.65, 0.55);
  group.add(palmPivot);

  // Forearm & clean rolled cream cuff sharing exact wrist axis!
  const forearmGroup = new THREE.Group();
  forearmGroup.position.set(-1.32, -0.35, 0.56);
  forearmGroup.rotation.y = 0.40;
  forearmGroup.rotation.z = -1.24;
  palmPivot.add(forearmGroup);

  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.35, 10, 18), sleeveMat);
  arm.castShadow = true;
  forearmGroup.add(arm);

  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.095, 12, 24), cuffMat);
  cuff.rotation.x = Math.PI * 0.5;
  cuff.position.y = 0.62;
  cuff.castShadow = true;
  forearmGroup.add(cuff);

  // Big wide flat-cupped open clay palm!
  const palmGeo = sculptClayGeo(new THREE.SphereGeometry(0.82, 28, 22), 0.012, 3.2, 2.2);
  palmGeo.scale(1.18, 0.30, 0.96);
  const palmMesh = new THREE.Mesh(palmGeo, skinMat);
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  palmPivot.add(palmMesh);

  // 4 Chubby clay fingers extending toward +X (toward pot center!)
  const fingerDefs = [
    { z: -0.46, len: 0.52, r: 0.155, rotY: -0.06 },
    { z: -0.16, len: 0.60, r: 0.165, rotY: -0.02 },
    { z: 0.15, len: 0.56, r: 0.160, rotY: 0.02 },
    { z: 0.44, len: 0.44, r: 0.145, rotY: 0.07 },
  ];
  for (const fd of fingerDefs) {
    const fGeo = new THREE.CapsuleGeometry(fd.r, fd.len, 8, 14);
    fGeo.rotateZ(Math.PI * 0.5);
    const fMesh = new THREE.Mesh(fGeo, skinMat);
    fMesh.scale.set(1.0, 0.76, 1.0);
    fMesh.position.set(0.95 + fd.len * 0.32, 0.02, fd.z);
    fMesh.rotation.y = fd.rotY;
    fMesh.rotation.z = 0.06; // Gentle upward cup at fingertips
    fMesh.castShadow = true;
    fMesh.receiveShadow = true;
    palmPivot.add(fMesh);
  }

  // Plump clay thumb on front/upper side
  const thumbGeo = new THREE.CapsuleGeometry(0.18, 0.44, 8, 14);
  thumbGeo.rotateZ(Math.PI * 0.35);
  thumbGeo.rotateY(-0.55);
  const thumb = new THREE.Mesh(thumbGeo, skinMat);
  thumb.position.set(-0.22, 0.11, 0.78);
  thumb.castShadow = true;
  palmPivot.add(thumb);

  // Mount point right on the flat top of the palm where Tofu sits (y = +0.23)
  const tofuMount = new THREE.Group();
  tofuMount.position.set(0.12, 0.23, 0.0);
  palmPivot.add(tofuMount);

  // Chunky Child-Safe Clay Kitchen Knife + Plump Right Hand holding it!
  const knifeRig = new THREE.Group();
  knifeRig.position.set(1.25, 2.55, 0.62);
  group.add(knifeRig);

  const handleMat = clayMat(0xd99457, { roughness: 0.74, warmth: 0.2 });
  const bladeMat = clayMat(0xeef2f6, { roughness: 0.42, warmth: 0.15, rim: 0.25 });

  // Rounded clay blade
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.68, 0.16);
  bladeShape.lineTo(0.45, 0.16);
  bladeShape.quadraticCurveTo(0.55, 0.0, 0.45, -0.22);
  bladeShape.quadraticCurveTo(-0.25, -0.24, -0.62, -0.14);
  bladeShape.quadraticCurveTo(-0.74, 0.0, -0.68, 0.16);

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.025,
    bevelSegments: 4,
  });
  bladeGeo.center();
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.castShadow = true;
  knifeRig.add(blade);

  const kHandleGeo = new THREE.CapsuleGeometry(0.12, 0.52, 8, 14);
  kHandleGeo.rotateZ(Math.PI * 0.5);
  const kHandle = new THREE.Mesh(kHandleGeo, handleMat);
  kHandle.position.set(0.76, 0.05, 0);
  kHandle.castShadow = true;
  knifeRig.add(kHandle);

  // Chubby right hand gripping the knife handle!
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), skinMat);
  rHand.scale.set(1.15, 0.95, 1.05);
  rHand.position.set(0.78, 0.08, 0.04);
  rHand.castShadow = true;
  knifeRig.add(rHand);

  const rSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 8, 14), sleeveMat);
  rSleeve.rotation.z = 1.15;
  rSleeve.position.set(1.42, 0.34, 0.15);
  knifeRig.add(rSleeve);

  return {
    group,
    palmPivot,
    palmMesh,
    tofuMount,
    knifeRig,
    palmSquash: new SquashSpring(220, 14),
  };
}
