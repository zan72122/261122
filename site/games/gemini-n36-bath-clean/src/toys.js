import * as THREE from '../vendor/three.module.min.js';
import { createSpongeTextures } from './textures.js';

/**
 * Big tactile porous yellow-and-pink miniature bath sponge
 * Extra large and unmistakable on screen, with squash-and-stretch scrubbing physics.
 */
export function createBigSponge() {
  const group = new THREE.Group();
  const { map, bumpMap } = createSpongeTextures();

  // Main chunky rounded yellow foam body (created by scaling a smooth rounded box-like shape)
  const spongeMat = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.045,
    roughness: 0.88,
    metalness: 0.0,
  });

  // Sculpted plump yellow bath sponge using a chamfered extruded rounded rectangle
  const shape = new THREE.Shape();
  const w = 0.44;
  const h = 0.3;
  const r = 0.11;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);

  const foamGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.055,
    bevelThickness: 0.055,
  });
  foamGeo.rotateX(Math.PI / 2);
  foamGeo.center();

  const foamBody = new THREE.Mesh(foamGeo, spongeMat);
  foamBody.position.y = 0.18;
  foamBody.castShadow = true;
  foamBody.receiveShadow = true;
  group.add(foamBody);

  // Soft pastel-pink scrubbing pad top layer (classic recognizable 2-tone kitchen/bath sponge!)
  const padGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.042,
    bevelThickness: 0.032,
  });
  padGeo.rotateX(Math.PI / 2);
  padGeo.center();

  const padMat = new THREE.MeshStandardMaterial({
    color: 0xff8fab,
    bumpMap,
    bumpScale: 0.03,
    roughness: 0.94,
  });
  const scrubPad = new THREE.Mesh(padGeo, padMat);
  scrubPad.position.y = 0.35;
  scrubPad.castShadow = true;
  group.add(scrubPad);

  return group;
}

/**
 * Expressive Glossy Vinyl Miniature Rubber Duck (big Mama Duck or cute pastel Baby Duck)
 * Features expressive blink/happy-squint eyes, flapping wings, and rubber squash-and-stretch!
 */
export function createRubberDuck({
  scale = 1.0,
  bodyColor = 0xffd426,
  beakColor = 0xff7b22,
  ribbonColor = null,
} = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  const vinylMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  const beakMat = new THREE.MeshPhysicalMaterial({
    color: beakColor,
    roughness: 0.24,
    clearcoat: 0.75,
  });

  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1816,
    roughness: 0.06,
    clearcoat: 1.0,
  });

  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xff7b9c,
    transparent: true,
    opacity: 0.45,
  });

  // Plump rubber duck body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 22, 16), vinylMat);
  body.scale.set(1.25, 0.86, 0.96);
  body.position.set(0, 0.31, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  inner.add(body);

  // Cute upturned rubber tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 14), vinylMat);
  tail.position.set(-0.41, 0.44, 0);
  tail.rotation.z = 0.72;
  tail.castShadow = true;
  inner.add(tail);

  // Round cheerful head (faces +X locally)
  const headGroup = new THREE.Group();
  headGroup.position.set(0.26, 0.69, 0);
  inner.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 22, 16), vinylMat);
  head.castShadow = true;
  headGroup.add(head);

  // Little tuft of feathers on top
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), vinylMat);
  tuft.scale.set(1.2, 0.8, 0.7);
  tuft.position.set(-0.04, 0.27, 0);
  tuft.rotation.z = 0.35;
  headGroup.add(tuft);

  // Optional cute pastel hair bow for Mama Duck!
  if (ribbonColor) {
    const bowMat = new THREE.MeshPhysicalMaterial({
      color: ribbonColor,
      roughness: 0.3,
      clearcoat: 0.5,
    });
    const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), bowMat);
    bowCenter.position.set(0.02, 0.26, 0.1);
    headGroup.add(bowCenter);
    const bowL = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 10), bowMat);
    bowL.position.set(0.02, 0.27, 0.17);
    bowL.rotation.x = Math.PI / 2;
    headGroup.add(bowL);
    const bowR = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 10), bowMat);
    bowR.position.set(0.02, 0.27, 0.03);
    bowR.rotation.x = -Math.PI / 2;
    headGroup.add(bowR);
  }

  // Rounded duck bill (upper + lower so it can quack open!)
  const upperBill = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), beakMat);
  upperBill.scale.set(1.32, 0.45, 0.96);
  upperBill.position.set(0.28, -0.01, 0);
  upperBill.castShadow = true;
  headGroup.add(upperBill);

  const lowerBill = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), beakMat);
  lowerBill.scale.set(1.2, 0.36, 0.86);
  lowerBill.position.set(0.25, -0.065, 0);
  headGroup.add(lowerBill);

  // Expressive Eyes (normal glossy eyes + happy curved squint arcs)
  const normalEyes = new THREE.Group();
  const happyEyes = new THREE.Group();
  happyEyes.visible = false;
  headGroup.add(normalEyes);
  headGroup.add(happyEyes);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), eyeMat);
    eye.position.set(0.17, 0.08, side * 0.19);
    normalEyes.add(eye);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), glintMat);
    glint.position.set(0.205, 0.105, side * 0.215);
    normalEyes.add(glint);

    // Happy squint smile-eye (^ ^)
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 8, 12, Math.PI), eyeMat);
    arc.position.set(0.18, 0.07, side * 0.205);
    arc.rotation.y = side > 0 ? 0.65 : Math.PI - 0.65;
    happyEyes.add(arc);

    // Soft rosy cheek blush
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), blushMat);
    cheek.scale.set(0.7, 0.55, 0.4);
    cheek.position.set(0.14, -0.02, side * 0.235);
    headGroup.add(cheek);
  }

  // Flappable Left & Right Wings
  const wingGeo = new THREE.SphereGeometry(0.21, 14, 12);
  wingGeo.scale(1.15, 0.68, 0.34);

  const leftWing = new THREE.Group();
  leftWing.position.set(-0.02, 0.34, 0.34);
  const lwMesh = new THREE.Mesh(wingGeo, vinylMat);
  lwMesh.position.set(-0.04, 0, 0.04);
  lwMesh.castShadow = true;
  leftWing.add(lwMesh);
  inner.add(leftWing);

  const rightWing = new THREE.Group();
  rightWing.position.set(-0.02, 0.34, -0.34);
  const rwMesh = new THREE.Mesh(wingGeo, vinylMat);
  rwMesh.position.set(-0.04, 0, -0.04);
  rwMesh.castShadow = true;
  rightWing.add(rwMesh);
  inner.add(rightWing);

  root.scale.setScalar(scale);

  // Expressive state controller
  const state = {
    quackTimer: 0,
    happyTimer: 0,
    squashVel: 0,
    squash: 0,
    blinkTimer: 2 + Math.random() * 3,
    wobbleTimer: 0,
  };

  function triggerQuack(happyDuration = 0.9) {
    state.quackTimer = 0.28;
    state.happyTimer = Math.max(state.happyTimer, happyDuration);
    state.squash = -0.26;
    state.squashVel = 2.4;
  }

  function triggerWobble() {
    state.wobbleTimer = 0.45;
  }

  function update(dt, time, excited = false) {
    // Springy rubber squash & stretch
    const springK = 110;
    const damp = 10;
    state.squashVel += (-springK * state.squash - damp * state.squashVel) * dt;
    state.squash += state.squashVel * dt;

    const sy = 1 + state.squash;
    const sxz = 1 - state.squash * 0.5;
    inner.scale.set(sxz, sy, sxz);

    // Beak quack open
    if (state.quackTimer > 0) {
      state.quackTimer = Math.max(0, state.quackTimer - dt);
      const open = Math.sin((state.quackTimer / 0.28) * Math.PI);
      lowerBill.position.y = -0.065 - open * 0.06;
      lowerBill.rotation.z = -open * 0.35;
      upperBill.rotation.z = open * 0.15;
    } else {
      lowerBill.position.y = -0.065;
      lowerBill.rotation.z = 0;
      upperBill.rotation.z = 0;
    }

    // Happy squint eyes vs blinking normal eyes
    if (state.happyTimer > 0) {
      state.happyTimer = Math.max(0, state.happyTimer - dt);
      normalEyes.visible = false;
      happyEyes.visible = true;
    } else {
      normalEyes.visible = true;
      happyEyes.visible = false;
      state.blinkTimer -= dt;
      if (state.blinkTimer <= 0) {
        state.blinkTimer = 2.5 + Math.random() * 3.5;
      }
      normalEyes.scale.y = state.blinkTimer < 0.11 ? 0.15 : 1.0;
    }

    // Wing flap when excited or quacking
    const flapSpeed = state.happyTimer > 0 ? 18 : excited ? 12 : 2.5;
    const flapAmp = state.happyTimer > 0 ? 0.55 : excited ? 0.38 : 0.04;
    const flap = Math.sin(time * flapSpeed) * flapAmp;
    leftWing.rotation.x = 0.12 + flap;
    rightWing.rotation.x = -0.12 - flap;

    // Gentle head tilt / wobble
    if (state.wobbleTimer > 0) {
      state.wobbleTimer = Math.max(0, state.wobbleTimer - dt);
      headGroup.rotation.x = Math.sin(state.wobbleTimer * 28) * 0.25 * (state.wobbleTimer / 0.45);
    } else {
      headGroup.rotation.x = Math.sin(time * 1.6) * 0.06;
    }
  }

  return {
    root,
    inner,
    headGroup,
    triggerQuack,
    triggerWobble,
    update,
  };
}

/**
 * Pastel Fizzy Bath Bomb Sphere (spins & tints the bathwater!)
 */
export function createBathBomb(colorHex = 0xff9ec4, stripeHex = 0xfff0f6) {
  const group = new THREE.Group();

  const mainMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.78,
    metalness: 0.02,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), mainMat);
  ball.castShadow = true;
  group.add(ball);

  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.172, 0.028, 10, 20),
    new THREE.MeshStandardMaterial({ color: stripeHex, roughness: 0.7 })
  );
  belt.rotation.x = Math.PI / 2;
  group.add(belt);

  return group;
}

/**
 * Miniature Pastel Toy Sailboat for the Bath Shelf
 */
export function createToyBoat() {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x73c9e8,
    roughness: 0.22,
    clearcoat: 0.85,
  });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.15, 16), hullMat);
  hull.scale.set(1.5, 1, 0.85);
  hull.position.y = 0.08;
  hull.castShadow = true;
  group.add(hull);

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.04, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.4 })
  );
  deck.scale.set(1.45, 1, 0.8);
  deck.position.y = 0.155;
  group.add(deck);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.02, 0.48, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9a876, roughness: 0.5 })
  );
  mast.position.set(0.02, 0.38, 0);
  mast.castShadow = true;
  group.add(mast);

  // Cute coral triangular sail
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0.24, 0.04);
  sailShape.quadraticCurveTo(0.12, 0.22, 0, 0.38);
  sailShape.closePath();

  const sail = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sailShape, { depth: 0.015, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0xff859a, roughness: 0.55, side: THREE.DoubleSide })
  );
  sail.position.set(0.04, 0.21, -0.008);
  sail.castShadow = true;
  group.add(sail);

  return group;
}

/**
 * Subtle Soft Miniature Sculpted Demonstration Hand (ONLY appears once after 10s of total idle!)
 * Styled as a clean soft matte-vinyl / wooden mannequin miniature hand — large and readable.
 */
export function createIdleDemoHand() {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffdfc8,
    roughness: 0.42,
    clearcoat: 0.25,
    transparent: true,
    opacity: 0.0,
  });

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat);
  palm.scale.set(1.05, 0.65, 1.15);
  group.add(palm);

  const fingerOffsets = [
    [-0.14, -0.02, 0.24, 0.22],
    [-0.04, -0.02, 0.28, 0.26],
    [0.06, -0.02, 0.26, 0.24],
    [0.15, -0.02, 0.21, 0.19],
  ];
  for (const [x, y, z, len] of fingerOffsets) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, len, 6, 10), mat);
    f.rotation.x = Math.PI / 2 + 0.35;
    f.position.set(x, y - 0.04, z);
    group.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 6, 10), mat);
  thumb.rotation.z = 0.7;
  thumb.rotation.x = 0.8;
  thumb.position.set(-0.22, -0.04, 0.08);
  group.add(thumb);

  group.visible = false;
  return { group, mat };
}
