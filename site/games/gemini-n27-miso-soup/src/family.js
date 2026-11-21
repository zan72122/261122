import * as THREE from 'three';
import {
  sculptClay,
  createPlumpBoxGeometry,
  makeClayMaterial,
  makeGlossClayMaterial,
  ClaySpring,
  applySquash,
} from './clay.js';
import { createTofuCubeMesh, createWakameLeafMesh } from './props.js';

/**
 * Builds one large, expressive, plump claymation family member + their lacquer soup bowl
 */
class ClayFamilyMember {
  constructor(parent, config, index) {
    this.index = index;
    this.config = config;
    this.group = new THREE.Group();
    this.group.position.set(config.x, 0, -2.42);
    parent.add(this.group);

    this.state = 'waiting'; // waiting | delight | blowing | sipping | happy
    this.stateTimer = 0;
    this.serveCount = 0;
    this.blinkTimer = 1.8 + index * 0.9;
    this.spring = new ClaySpring(170, 10);
    this.bowlSpring = new ClaySpring(200, 11);

    this._buildCharacter(config);
    this._buildBowl(parent, config);
    this._buildEffects(parent, config);
  }

  _buildCharacter(cfg) {
    const skinMat = makeClayMaterial(cfg.skin, { roughness: 0.72, bumpScale: 0.015 });
    const shirtMat = makeClayMaterial(cfg.shirt, { roughness: 0.84 });
    const hairMat = makeClayMaterial(cfg.hair, { roughness: 0.82 });

    // Plump shoulders / torso sitting right behind the table
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    const torsoGeo = new THREE.SphereGeometry(cfg.torsoR, 18, 14);
    torsoGeo.scale(1.18, 1.15, 0.88);
    sculptClay(torsoGeo, 0.024, 2.2, 700 + this.index * 20);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = cfg.torsoY;
    torso.castShadow = true;
    torso.receiveShadow = true;
    torso.userData.interactId = `family_${this.index}`;
    this.bodyGroup.add(torso);

    // Cute collar or apron accent (positioned cleanly proud of torso belly so zero poke-through!)
    if (cfg.apron) {
      const apronGeo = createPlumpBoxGeometry(cfg.torsoR * 1.04, cfg.torsoR * 1.05, 0.24, 0.08, 3);
      sculptClay(apronGeo, 0.012, 3.0, 705 + this.index);
      const apron = new THREE.Mesh(apronGeo, makeClayMaterial(0xfaf0df, { roughness: 0.84 }));
      apron.position.set(0, cfg.torsoY + 0.04, cfg.torsoR * 0.83);
      this.bodyGroup.add(apron);
    } else if (cfg.collar) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.torsoR * 0.62, 0.12, 10, 20),
        makeClayMaterial(0xfff6e6, { roughness: 0.8 })
      );
      collar.rotation.x = Math.PI / 2 + 0.18;
      collar.position.set(0, cfg.headY - cfg.headR * 0.82, 0.08);
      this.bodyGroup.add(collar);
    }

    // Big expressive plump clay head!
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, cfg.headY, 0.08);
    this.bodyGroup.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(cfg.headR, 24, 18);
    headGeo.scale(1.06, 0.98, 1.0);
    sculptClay(headGeo, 0.022, 2.4, 710 + this.index * 20);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    head.receiveShadow = true;
    head.userData.interactId = `family_${this.index}`;
    this.headGroup.add(head);

    // Cute rounded clay ears
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(
        sculptClay(new THREE.SphereGeometry(cfg.headR * 0.22, 10, 8), 0.01, 5, 712 + s),
        skinMat
      );
      ear.position.set(s * cfg.headR * 1.02, -0.02, -0.04);
      this.headGroup.add(ear);
    });

    // Plump nose dot
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.headR * 0.11, 10, 8),
      makeClayMaterial(cfg.noseCol, { roughness: 0.68 })
    );
    nose.position.set(0, -cfg.headR * 0.04, cfg.headR * 0.99);
    this.headGroup.add(nose);

    // Hair sculpting per character (Papa, Little Sibling, Mama)
    this._buildHair(cfg, hairMat);

    // Rosy clay cheeks (grow & glow warmer when eating!)
    const cheekMat = makeClayMaterial(0xf38b87, { roughness: 0.72 });
    this.cheeks = [-1, 1].map((s) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(cfg.headR * 0.19, 12, 8), cheekMat);
      c.scale.set(1.25, 0.78, 0.45);
      c.position.set(s * cfg.headR * 0.56, -cfg.headR * 0.16, cfg.headR * 0.84);
      this.headGroup.add(c);
      return c;
    });

    // Eyes: normal round glossy clay beads + happy crescent smiles (`^ ^`)
    const eyeMat = makeGlossClayMaterial(0x281e1a, { roughness: 0.1, clearcoat: 0.9, noBump: true });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.openEyesGroup = new THREE.Group();
    this.headGroup.add(this.openEyesGroup);

    this.eyeBeads = [-1, 1].map((s) => {
      const eg = new THREE.Group();
      eg.position.set(s * cfg.headR * 0.34, cfg.headR * 0.1, cfg.headR * 0.91);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(cfg.headR * 0.135, 12, 10), eyeMat);
      eg.add(bead);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(cfg.headR * 0.045, 8, 6), glintMat);
      glint.position.set(0.03, 0.038, cfg.headR * 0.11);
      eg.add(glint);
      this.openEyesGroup.add(eg);
      return eg;
    });

    // Happy closed-eye crescents (^ ^) shown during bliss!
    this.happyEyesGroup = new THREE.Group();
    this.happyEyesGroup.visible = false;
    this.headGroup.add(this.happyEyesGroup);
    [-1, 1].forEach((s) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.headR * 0.16, cfg.headR * 0.045, 8, 16, Math.PI),
        makeClayMaterial(0x3a261e, { roughness: 0.6 })
      );
      arc.position.set(s * cfg.headR * 0.35, cfg.headR * 0.06, cfg.headR * 0.93);
      this.happyEyesGroup.add(arc);
    });

    // Expressive eyebrows
    this.brows = [-1, 1].map((s) => {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(cfg.headR * 0.045, cfg.headR * 0.18, 6, 8),
        hairMat
      );
      brow.rotation.z = Math.PI / 2 - s * 0.14;
      brow.position.set(s * cfg.headR * 0.35, cfg.headR * 0.33, cfg.headR * 0.9);
      this.headGroup.add(brow);
      return brow;
    });

    // Papa's cozy round glasses!
    if (cfg.glasses) {
      const frameMat = makeClayMaterial(0x5d412d, { roughness: 0.55 });
      [-1, 1].forEach((s) => {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(cfg.headR * 0.24, cfg.headR * 0.035, 8, 20),
          frameMat
        );
        rim.position.set(s * cfg.headR * 0.35, cfg.headR * 0.1, cfg.headR * 0.98);
        this.headGroup.add(rim);
      });
      const bridge = new THREE.Mesh(
        new THREE.CapsuleGeometry(cfg.headR * 0.025, cfg.headR * 0.16, 4, 8),
        frameMat
      );
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, cfg.headR * 0.12, cfg.headR * 0.99);
      this.headGroup.add(bridge);
    }

    // 3 distinct claymouth shapes swapped cleanly for super crisp claymation expressions!
    const mouthDarkMat = makeClayMaterial(0x6e2f2b, { roughness: 0.65 });
    const tongueMat = makeClayMaterial(0xe87373, { roughness: 0.6 });

    // Waiting gentle expectant smile
    this.mouthWait = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.headR * 0.14, cfg.headR * 0.036, 8, 16, Math.PI),
      mouthDarkMat
    );
    this.mouthWait.rotation.z = Math.PI;
    this.mouthWait.position.set(0, -cfg.headR * 0.25, cfg.headR * 0.93);
    this.headGroup.add(this.mouthWait);

    // Blowing / sipping "o" mouth (おちょぼ口)
    this.mouthBlow = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.headR * 0.09, cfg.headR * 0.042, 8, 16),
      mouthDarkMat
    );
    this.mouthBlow.position.set(0, -cfg.headR * 0.3, cfg.headR * 0.96);
    this.mouthBlow.visible = false;
    this.headGroup.add(this.mouthBlow);

    // Big radiant happy open grin!
    this.mouthHappy = new THREE.Group();
    this.mouthHappy.position.set(0, -cfg.headR * 0.28, cfg.headR * 0.91);
    const mBack = new THREE.Mesh(new THREE.SphereGeometry(cfg.headR * 0.2, 12, 10), mouthDarkMat);
    mBack.scale.set(1.3, 0.95, 0.5);
    this.mouthHappy.add(mBack);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(cfg.headR * 0.13, 10, 8), tongueMat);
    tongue.scale.set(1.15, 0.55, 0.5);
    tongue.position.set(0, -cfg.headR * 0.08, cfg.headR * 0.06);
    this.mouthHappy.add(tongue);
    this.mouthHappy.visible = false;
    this.headGroup.add(this.mouthHappy);

    // Two big plump clay hands resting by their bowl (lift up to cradle bowl when sipping!)
    this.hands = [-1, 1].map((s) => {
      const hg = new THREE.Group();
      const palm = new THREE.Mesh(
        sculptClay(new THREE.SphereGeometry(cfg.headR * 0.26, 12, 10), 0.012, 4, 730 + s),
        skinMat
      );
      palm.scale.set(1.1, 0.78, 1.15);
      palm.castShadow = true;
      hg.add(palm);
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.headR * 0.2, cfg.headR * 0.24, 0.28, 12),
        shirtMat
      );
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(0, 0, -0.2);
      hg.add(cuff);
      hg.position.set(s * 0.78, 0.22, 1.25);
      this.group.add(hg);
      return hg;
    });
  }

  _buildHair(cfg, hairMat) {
    const r = cfg.headR;
    // Clean tilted back hair dome (tilted -0.34 rad backward so it NEVER bleeds over eyes/forehead!)
    const makeBackCap = (thetaLen, seed) => {
      const cap = new THREE.Mesh(
        sculptClay(new THREE.SphereGeometry(r * 1.07, 18, 14, 0, Math.PI * 2, 0, thetaLen), 0.018, 2.8, seed),
        hairMat
      );
      cap.position.set(0, r * 0.08, -r * 0.14);
      cap.rotation.x = -0.34;
      cap.castShadow = true;
      return cap;
    };

    if (cfg.hairStyle === 'papa') {
      this.headGroup.add(makeBackCap(Math.PI * 0.56, 740));
      // Plump side-swept top hair cushions sitting high on forehead
      const top1 = new THREE.Mesh(sculptClay(new THREE.SphereGeometry(r * 0.48, 12, 10), 0.015, 4, 741), hairMat);
      top1.scale.set(1.35, 0.55, 0.85);
      top1.position.set(-r * 0.18, r * 0.82, r * 0.36);
      this.headGroup.add(top1);
      const top2 = new THREE.Mesh(sculptClay(new THREE.SphereGeometry(r * 0.36, 12, 10), 0.014, 4, 748), hairMat);
      top2.scale.set(1.2, 0.52, 0.78);
      top2.position.set(r * 0.42, r * 0.72, r * 0.32);
      this.headGroup.add(top2);
    } else if (cfg.hairStyle === 'child') {
      this.headGroup.add(makeBackCap(Math.PI * 0.6, 742));
      // Twin cute plump clay buns + coral hair beads!
      [-1, 1].forEach((s) => {
        const bun = new THREE.Mesh(sculptClay(new THREE.SphereGeometry(r * 0.4, 12, 10), 0.016, 4, 743 + s), hairMat);
        bun.position.set(s * r * 0.88, r * 0.74, -r * 0.12);
        bun.castShadow = true;
        this.headGroup.add(bun);
        const rib = new THREE.Mesh(
          new THREE.SphereGeometry(r * 0.17, 10, 8),
          makeClayMaterial(0xff7d95, { roughness: 0.62 })
        );
        rib.position.set(s * r * 0.66, r * 0.66, r * 0.22);
        this.headGroup.add(rib);
      });
      // Soft rounded clay bangs positioned high above eyebrows
      for (let i = -1; i <= 1; i++) {
        const bang = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), hairMat);
        bang.scale.set(1.18, 0.55, 0.58);
        bang.position.set(i * r * 0.32, r * 0.72, r * 0.66);
        this.headGroup.add(bang);
      }
    } else {
      // Mama: warm chestnut hair + neat parted bangs + cozy top bun with golden tie
      this.headGroup.add(makeBackCap(Math.PI * 0.62, 745));
      [-1, 1].forEach((s) => {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.22, r * 0.56, 8, 10), hairMat);
        lock.position.set(s * r * 0.94, -r * 0.05, r * 0.04);
        lock.rotation.z = s * 0.14;
        this.headGroup.add(lock);
        // Clean arched side-parted forehead bangs well above eyes!
        const bang = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 12, 10), hairMat);
        bang.scale.set(1.25, 0.48, 0.62);
        bang.position.set(s * r * 0.36, r * 0.74, r * 0.56);
        bang.rotation.z = -s * 0.22;
        this.headGroup.add(bang);
      });
      const bun = new THREE.Mesh(sculptClay(new THREE.SphereGeometry(r * 0.44, 14, 10), 0.018, 3.8, 746), hairMat);
      bun.position.set(r * 0.22, r * 1.02, -r * 0.22);
      bun.castShadow = true;
      this.headGroup.add(bun);
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.32, r * 0.075, 8, 16),
        makeClayMaterial(0xf7c566, { roughness: 0.62 })
      );
      band.position.set(r * 0.2, r * 0.86, -r * 0.18);
      band.rotation.x = Math.PI / 2 - 0.28;
      this.headGroup.add(band);
    }
  }

  _buildBowl(parent, cfg) {
    this.bowlHome = new THREE.Vector3(cfg.x, 0.0, -0.45);
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.copy(this.bowlHome);
    parent.add(this.bowlGroup);

    // Traditional Japanese lacquerware clay soup bowl (お椀 — DoubleSide so never culled!)
    const outerPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.45, 0),
      new THREE.Vector2(0.48, 0.15),
      new THREE.Vector2(0.74, 0.28),
      new THREE.Vector2(0.84, 0.58),
      new THREE.Vector2(0.85, 0.75),
    ];
    const outerGeo = new THREE.LatheGeometry(outerPts, 28);
    sculptClay(outerGeo, 0.011, 3.2, 760 + this.index);
    const outerMat = makeGlossClayMaterial(cfg.bowlOuter, {
      roughness: 0.22,
      clearcoat: 0.72,
      side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.rotation.y = Math.PI;
    outer.castShadow = true;
    outer.receiveShadow = true;
    outer.userData.interactId = `bowl_${this.index}`;
    this.bowlGroup.add(outer);

    // Warm glossy vermilion/cream interior
    const innerPts = [
      new THREE.Vector2(0.78, 0.74),
      new THREE.Vector2(0.74, 0.44),
      new THREE.Vector2(0.44, 0.19),
      new THREE.Vector2(0, 0.17),
    ];
    const innerGeo = new THREE.LatheGeometry(innerPts, 26);
    const inner = new THREE.Mesh(
      innerGeo,
      makeGlossClayMaterial(cfg.bowlInner, { roughness: 0.2, clearcoat: 0.75, side: THREE.DoubleSide })
    );
    inner.rotation.y = Math.PI;
    inner.userData.interactId = `bowl_${this.index}`;
    this.bowlGroup.add(inner);

    // Thick gold-clay rim sitting cleanly on top of bowl walls
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.815, 0.052, 10, 28),
      makeGlossClayMaterial(0xeec469, { roughness: 0.28, clearcoat: 0.6 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.75;
    rim.userData.interactId = `bowl_${this.index}`;
    this.bowlGroup.add(rim);

    // Soup + floating tofu & wakame inside this bowl!
    this.bowlSoupGroup = new THREE.Group();
    this.bowlSoupGroup.visible = false;
    this.bowlGroup.add(this.bowlSoupGroup);

    this.soupFill = 0;
    this.targetSoupFill = 0;

    const soupDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.69, 24),
      makeGlossClayMaterial(0xd58a3b, { roughness: 0.16, clearcoat: 0.78 })
    );
    soupDisc.rotation.x = -Math.PI / 2;
    this.bowlSoupGroup.add(soupDisc);

    // Plump tofu cubes & emerald wakame ribbons inside the served bowl!
    const tPositions = [
      [-0.22, 0.01, 0.14],
      [0.2, 0.01, -0.1],
      [-0.04, 0.01, -0.22],
      [0.18, 0.01, 0.2],
    ];
    tPositions.forEach(([x, y, z], i) => {
      const tc = createTofuCubeMesh(0.2, 770 + this.index * 10 + i);
      tc.position.set(x, y, z);
      tc.rotation.set(0.12 * i, i * 0.9, 0.1);
      this.bowlSoupGroup.add(tc);
    });
    const wPositions = [
      [0.02, 0.02, 0.06],
      [-0.24, 0.02, -0.14],
    ];
    wPositions.forEach(([x, y, z], i) => {
      const wl = createWakameLeafMesh(780 + this.index * 5 + i);
      wl.scale.setScalar(0.72);
      wl.position.set(x, y, z);
      wl.rotation.y = i * 1.4;
      this.bowlSoupGroup.add(wl);
    });

    // Cozy clay steam puffs rising from filled bowl
    this.bowlSteam = [];
    const sGeo = new THREE.SphereGeometry(0.11, 8, 6);
    for (let i = 0; i < 4; i++) {
      const smat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9, transparent: true, opacity: 0 });
      const sm = new THREE.Mesh(sGeo, smat);
      sm.visible = false;
      this.bowlGroup.add(sm);
      this.bowlSteam.push({ mesh: sm, mat: smat, phase: i * 0.25 });
    }
  }

  _buildEffects(parent, cfg) {
    // Breath blow clouds ("fuuu-fuuu")
    this.breathPuffs = [];
    const bGeo = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 0; i < 3; i++) {
      const bmat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, transparent: true, opacity: 0 });
      const bm = new THREE.Mesh(bGeo, bmat);
      bm.visible = false;
      parent.add(bm);
      this.breathPuffs.push({ mesh: bm, mat: bmat, delay: i * 0.26 });
    }

    // Floating warm clay hearts/stars around happy family member!
    this.joyPops = [];
    const heartMat = makeClayMaterial(cfg.joyCol, { roughness: 0.55, emissive: cfg.joyCol, emissiveIntensity: 0.22 });
    for (let i = 0; i < 4; i++) {
      const jg = new THREE.Group();
      // Plump clay heart built from 2 spheres + tilted cone
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), heartMat);
      s1.position.set(-0.06, 0.05, 0);
      const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), heartMat);
      s2.position.set(0.06, 0.05, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.135, 0.18, 8), heartMat);
      tip.rotation.z = Math.PI;
      tip.position.set(0, -0.05, 0);
      jg.add(s1, s2, tip);
      jg.visible = false;
      this.group.add(jg);
      this.joyPops.push({ mesh: jg, phase: i * 0.25, side: i % 2 === 0 ? -1 : 1 });
    }
  }

  receiveSoup(onBlow, onSip, onHappy) {
    this.serveCount++;
    this.targetSoupFill = Math.min(1.12, 0.82 + (this.serveCount - 1) * 0.16);
    this.bowlSoupGroup.visible = true;
    this.bowlSpring.impulse(5.0);
    this.spring.impulse(5.5);

    this.state = 'delight';
    this.stateTimer = 0;
    this._callbacks = { onBlow, onSip, onHappy, blew: false, sipped: false, happied: false };
  }

  poke() {
    this.spring.impulse(5.2);
  }

  reset() {
    this.state = 'waiting';
    this.stateTimer = 0;
    this.serveCount = 0;
    this.soupFill = 0;
    this.targetSoupFill = 0;
    this.bowlSoupGroup.visible = false;
    this.bowlGroup.position.copy(this.bowlHome);
    this.bowlGroup.rotation.set(0, 0, 0);
    this.openEyesGroup.visible = true;
    this.happyEyesGroup.visible = false;
    this.mouthWait.visible = true;
    this.mouthBlow.visible = false;
    this.mouthHappy.visible = false;
    for (const p of this.joyPops) p.mesh.visible = false;
    for (const b of this.breathPuffs) b.mesh.visible = false;
    for (const s of this.bowlSteam) s.mesh.visible = false;
  }

  update(dt, time) {
    const sq = this.spring.step(dt);
    applySquash(this.bodyGroup, sq * 0.075, 1);

    const bSq = this.bowlSpring.step(dt);
    applySquash(this.bowlGroup, bSq * 0.08, 1);

    // Smooth bowl soup level fill
    this.soupFill += (this.targetSoupFill - this.soupFill) * Math.min(1, dt * 6);
    if (this.soupFill > 0.02) {
      this.bowlSoupGroup.visible = true;
      this.bowlSoupGroup.position.y = 0.24 + Math.min(1, this.soupFill) * 0.36;
      const sr = 0.72 + Math.min(1, this.soupFill) * 0.28;
      this.bowlSoupGroup.scale.set(sr, 1, sr);
      this.bowlSoupGroup.rotation.y += dt * 0.2;
    }

    // Bowl steam puffs when filled
    for (const s of this.bowlSteam) {
      if (this.soupFill > 0.3) {
        s.mesh.visible = true;
        const cyc = (time * 0.45 + s.phase) % 1;
        s.mesh.position.set(
          Math.sin(cyc * 5 + s.phase * 8) * 0.16,
          0.68 + cyc * 0.85,
          Math.cos(cyc * 4 + s.phase * 6) * 0.12
        );
        const sc = (0.4 + cyc * 0.9) * Math.sin(cyc * Math.PI);
        s.mesh.scale.setScalar(sc);
        s.mat.opacity = Math.sin(cyc * Math.PI) * 0.42;
      } else {
        s.mesh.visible = false;
      }
    }

    // Blinking when eyes are open
    this.blinkTimer -= dt;
    let blinkScaleY = 1;
    if (this.blinkTimer < 0) {
      if (this.blinkTimer > -0.14) blinkScaleY = 0.12;
      else this.blinkTimer = 2.4 + Math.random() * 2.5;
    }
    this.eyeBeads.forEach((eb) => {
      eb.scale.y = blinkScaleY;
    });

    // State machine for claymation acting!
    this.stateTimer += dt;
    let targetBowlPos = this.bowlHome.clone();
    let targetBowlRotX = 0;
    let targetHeadRotX = 0.12;
    let targetHeadRotY = 0;
    let targetHeadRotZ = 0;
    let handLiftY = 0.22;
    let handZ = 1.25;
    let handSpread = 0.82;

    if (this.state === 'waiting') {
      // Gaze eagerly toward the steaming pot & down at empty bowl!
      const lookCycle = Math.sin(time * 1.4 + this.index * 1.7);
      targetHeadRotX = 0.16 + lookCycle * 0.08;
      targetHeadRotY = -this.config.x * 0.1 + Math.sin(time * 0.9 + this.index) * 0.12;
      targetHeadRotZ = Math.sin(time * 2.2 + this.index) * 0.05;
      this.openEyesGroup.visible = true;
      this.happyEyesGroup.visible = false;
      this.mouthWait.visible = true;
      this.mouthBlow.visible = false;
      this.mouthHappy.visible = false;
      // Subtle eager bounce
      this.bodyGroup.position.y = Math.abs(Math.sin(time * 2.6 + this.index * 1.3)) * 0.045;
    } else if (this.state === 'delight') {
      // Wide-eyed delight! Hands reach out to cradle bowl
      targetHeadRotX = 0.26;
      this.openEyesGroup.visible = true;
      this.happyEyesGroup.visible = false;
      this.eyeBeads.forEach((eb) => eb.scale.set(1.22, 1.22, 1.1));
      this.mouthWait.visible = false;
      this.mouthBlow.visible = false;
      this.mouthHappy.visible = true;
      this.cheeks.forEach((c) => c.scale.set(1.4, 0.9, 0.5));
      handLiftY = 0.42;
      handZ = 1.48;
      handSpread = 0.72;
      if (this.stateTimer > 0.42) {
        this.state = 'blowing';
        this.stateTimer = 0;
        if (this._callbacks && !this._callbacks.blew) {
          this._callbacks.blew = true;
          if (this._callbacks.onBlow) this._callbacks.onBlow(this.index);
        }
      }
    } else if (this.state === 'blowing') {
      // Lift bowl gently & blow "fuuu-fuuu" to cool the hot miso soup!
      const blowBounce = Math.sin(this.stateTimer * 10) * 0.06;
      targetHeadRotX = 0.22 + blowBounce;
      targetBowlPos.set(this.bowlHome.x, 0.55, this.bowlHome.z - 0.32);
      handLiftY = 0.72;
      handZ = 1.38;
      handSpread = 0.68;
      this.openEyesGroup.visible = true;
      this.happyEyesGroup.visible = false;
      this.eyeBeads.forEach((eb) => eb.scale.set(1.0, 1.0, 1.0));
      this.mouthWait.visible = false;
      this.mouthBlow.visible = true;
      this.mouthHappy.visible = false;

      // Animate cute white clay breath puffs traveling from mouth to bowl!
      this.breathPuffs.forEach((p) => {
        const pt = (this.stateTimer - p.delay) / 0.45;
        if (pt > 0 && pt < 1) {
          p.mesh.visible = true;
          p.mesh.position.set(
            this.config.x + Math.sin(pt * 8) * 0.04,
            this.config.headY - 0.16 - pt * 0.35,
            -1.0 + pt * 0.6
          );
          const sc = (0.4 + pt * 1.1) * Math.sin(pt * Math.PI);
          p.mesh.scale.setScalar(sc);
          p.mat.opacity = Math.sin(pt * Math.PI) * 0.65;
        } else {
          p.mesh.visible = false;
        }
      });

      if (this.stateTimer > 0.85) {
        this.breathPuffs.forEach((p) => (p.mesh.visible = false));
        this.state = 'sipping';
        this.stateTimer = 0;
        if (this._callbacks && !this._callbacks.sipped) {
          this._callbacks.sipped = true;
          if (this._callbacks.onSip) this._callbacks.onSip(this.index);
        }
      }
    } else if (this.state === 'sipping') {
      // Tip bowl to lips and take a warm cozy sip!
      const sipEase = Math.sin(Math.min(1, this.stateTimer / 0.58) * Math.PI);
      targetBowlPos.set(
        this.bowlHome.x,
        0.55 + sipEase * 0.62,
        this.bowlHome.z - 0.32 - sipEase * 0.35
      );
      targetBowlRotX = -sipEase * 0.48;
      targetHeadRotX = -0.05 * sipEase;
      handLiftY = 0.75 + sipEase * 0.55;
      handZ = 0.92 - sipEase * 0.25;
      handSpread = 0.6;
      this.openEyesGroup.visible = false;
      this.happyEyesGroup.visible = true;
      this.mouthBlow.visible = true;
      this.mouthHappy.visible = false;

      if (this.stateTimer > 0.62) {
        this.state = 'happy';
        this.stateTimer = 0;
        this.spring.impulse(6.0);
        if (this._callbacks && !this._callbacks.happied) {
          this._callbacks.happied = true;
          if (this._callbacks.onHappy) this._callbacks.onHappy(this.index);
        }
      }
    } else if (this.state === 'happy') {
      // Pure warm claymation bliss (^ ^ eyes, rosy cheeks, swaying grin, floating hearts!)
      this.openEyesGroup.visible = false;
      this.happyEyesGroup.visible = true;
      this.mouthWait.visible = false;
      this.mouthBlow.visible = false;
      this.mouthHappy.visible = true;
      this.cheeks.forEach((c) => c.scale.set(1.42, 0.92, 0.52));

      const sway = Math.sin(time * 3.8 + this.index * 1.4);
      targetHeadRotZ = sway * 0.14;
      targetHeadRotX = 0.04 + Math.abs(sway) * 0.06;
      this.bodyGroup.position.y = Math.abs(Math.sin(time * 4.2 + this.index)) * 0.08;
      handLiftY = 0.32 + Math.abs(sway) * 0.12;

      // Floating clay hearts rising around happy head!
      this.joyPops.forEach((jp, idx) => {
        const cyc = (time * 0.55 + jp.phase) % 1;
        jp.mesh.visible = true;
        jp.mesh.position.set(
          jp.side * (0.72 + Math.sin(cyc * 5 + idx) * 0.16),
          this.config.headY + 0.25 + cyc * 1.15,
          0.35
        );
        const sc = Math.sin(cyc * Math.PI) * 1.1;
        jp.mesh.scale.setScalar(sc);
        jp.mesh.rotation.y = time * 1.8 + idx;
      });
    }

    // Smoothly interpolate head, hands, and bowl
    this.headGroup.rotation.x += (targetHeadRotX - this.headGroup.rotation.x) * Math.min(1, dt * 8);
    this.headGroup.rotation.y += (targetHeadRotY - this.headGroup.rotation.y) * Math.min(1, dt * 8);
    this.headGroup.rotation.z += (targetHeadRotZ - this.headGroup.rotation.z) * Math.min(1, dt * 8);

    this.bowlGroup.position.lerp(targetBowlPos, Math.min(1, dt * 9));
    this.bowlGroup.rotation.x += (targetBowlRotX - this.bowlGroup.rotation.x) * Math.min(1, dt * 9);

    this.hands.forEach((h, idx) => {
      const s = idx === 0 ? -1 : 1;
      h.position.x += (s * handSpread - h.position.x) * Math.min(1, dt * 8);
      h.position.y += (handLiftY - h.position.y) * Math.min(1, dt * 8);
      h.position.z += (handZ - h.position.z) * Math.min(1, dt * 8);
    });
  }
}

export class ClayFamilyScene {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    // 3 big, distinct, warm claymation family members seated clearly above their bowls!
    const configs = [
      {
        name: 'papa',
        x: -2.35,
        skin: 0xf4c7a6,
        noseCol: 0xe6a885,
        shirt: 0x4f7696,
        hair: 0x4b3527,
        hairStyle: 'papa',
        glasses: true,
        torsoR: 0.94,
        torsoY: 0.74,
        headR: 0.76,
        headY: 2.22,
        bowlOuter: 0x383244,
        bowlInner: 0xd9483b,
        joyCol: 0xffc64b,
      },
      {
        name: 'child',
        x: 0.0,
        skin: 0xfad4bc,
        noseCol: 0xf0b59c,
        shirt: 0xf2bf4f,
        hair: 0x5c3c28,
        hairStyle: 'child',
        collar: true,
        torsoR: 0.76,
        torsoY: 0.68,
        headR: 0.68,
        headY: 1.94,
        bowlOuter: 0xe66a5c,
        bowlInner: 0xfdf1dc,
        joyCol: 0xff82a9,
      },
      {
        name: 'mama',
        x: 2.35,
        skin: 0xf8cfb7,
        noseCol: 0xeba98e,
        shirt: 0xe3887d,
        hair: 0x6b452d,
        hairStyle: 'mama',
        apron: true,
        torsoR: 0.88,
        torsoY: 0.72,
        headR: 0.74,
        headY: 2.16,
        bowlOuter: 0x7c3645,
        bowlInner: 0xf9ebd4,
        joyCol: 0xff8c69,
      },
    ];

    this.members = configs.map((cfg, idx) => new ClayFamilyMember(this.group, cfg, idx));

    // Tactile 3D clay replay mini-pot on wooden coaster (ZERO text! Pops up after all 3 are happy)
    this.replayGroup = new THREE.Group();
    this.replayGroup.position.set(2.55, 0.0, 1.95);
    this.replayGroup.visible = false;
    this.replayGroup.scale.setScalar(0.001);
    this.group.add(this.replayGroup);

    const coaster = new THREE.Mesh(
      sculptClay(new THREE.CylinderGeometry(0.68, 0.72, 0.12, 20), 0.012, 3.5, 810),
      makeClayMaterial(0xf2d085, { roughness: 0.72 })
    );
    coaster.position.y = 0.06;
    coaster.castShadow = true;
    coaster.userData.interactId = 'replayPot';
    this.replayGroup.add(coaster);

    // Cute shiny mini fresh terracotta pot with little lid & golden star-knob!
    const miniPot = new THREE.Mesh(
      sculptClay(new THREE.CylinderGeometry(0.46, 0.4, 0.42, 20), 0.012, 4.0, 811),
      makeGlossClayMaterial(0xd95f44, { roughness: 0.34 })
    );
    miniPot.position.y = 0.32;
    miniPot.castShadow = true;
    miniPot.userData.interactId = 'replayPot';
    this.replayGroup.add(miniPot);

    const miniLid = new THREE.Mesh(
      sculptClay(new THREE.SphereGeometry(0.47, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), 0.01, 4.0, 812),
      makeGlossClayMaterial(0xf7ecd7, { roughness: 0.32 })
    );
    miniLid.scale.set(1, 0.52, 1);
    miniLid.position.y = 0.5;
    miniLid.userData.interactId = 'replayPot';
    this.replayGroup.add(miniLid);

    const lidKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      makeClayMaterial(0xf6c24a, { roughness: 0.45, emissive: 0xe69f1a, emissiveIntensity: 0.25 })
    );
    lidKnob.position.y = 0.76;
    lidKnob.userData.interactId = 'replayPot';
    this.replayGroup.add(lidKnob);

    this.showReplay = false;
    this.enterProgress = 0;
  }

  enter() {
    this.group.visible = true;
    this.enterProgress = 0;
    this.showReplay = false;
    this.replayGroup.visible = false;
    this.replayGroup.scale.setScalar(0.001);
    this.members.forEach((m) => m.reset());
  }

  hide() {
    this.group.visible = false;
  }

  allServed() {
    return this.members.every((m) => m.serveCount > 0);
  }

  getBowlWorldPos(index, target = new THREE.Vector3()) {
    const m = this.members[index];
    return target.copy(m.bowlHome).add(new THREE.Vector3(0, 0.65, 0));
  }

  update(dt, time) {
    if (!this.group.visible) return;
    this.enterProgress = Math.min(1, this.enterProgress + dt * 3.8);
    // Smooth pop-in entrance
    const ease = 1 - Math.pow(1 - this.enterProgress, 3);
    this.group.position.y = (1 - ease) * -1.4;

    this.members.forEach((m) => m.update(dt, time));

    if (this.showReplay) {
      this.replayGroup.visible = true;
      const pulse = 1 + Math.sin(time * 4.5) * 0.08;
      const cur = this.replayGroup.scale.x;
      const next = cur + (pulse - cur) * Math.min(1, dt * 8);
      this.replayGroup.scale.setScalar(next);
      this.replayGroup.rotation.y = Math.sin(time * 2.4) * 0.16;
    }
  }
}
