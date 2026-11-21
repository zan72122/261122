import {
  THREE,
  RoundedBoxGeometry,
  clayMat,
  sculptClayGeo,
  getWoodClayTexture,
  SquashSpring,
} from './clay.js';
import { sound } from './audio.js';

/**
 * Builds the cozy stop-motion clay kitchen counter, warm tiled backdrop, and decorative props.
 */
export function createKitchenStage(scene) {
  const stage = new THREE.Group();
  scene.add(stage);

  // Warm sculpted wood-clay tabletop counter
  const woodTex = getWoodClayTexture();
  woodTex.repeat.set(3, 2);
  const counterMat = clayMat(0xe5b586, {
    map: woodTex,
    roughness: 0.78,
    warmth: 0.16,
    bumpScale: 0.018,
  });

  const counterGeo = new RoundedBoxGeometry(12.0, 0.75, 9.5, 5, 0.16);
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.set(0, -0.375, 2.95);
  counter.receiveShadow = true;
  stage.add(counter);

  // Counter front trim molding
  const trimMat = clayMat(0xc98b56, { roughness: 0.76, warmth: 0.14 });
  const trim = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 10.6, 8, 16), trimMat);
  trim.rotation.z = Math.PI * 0.5;
  trim.position.set(0, -0.04, -1.68);
  trim.receiveShadow = true;
  stage.add(trim);

  // Warm cream-apricot clay kitchen backdrop wall behind the family
  const wallMat = clayMat(0xf7e6cf, { roughness: 0.85, warmth: 0.22, bumpScale: 0.025 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), wallMat);
  wall.position.set(0, 3.2, -3.55);
  wall.receiveShadow = true;
  stage.add(wall);

  // Soft large clay wall tiles behind family for cozy kitchen context (subtle low-contrast!)
  const tileColors = [0xf2dcc0, 0xfaeede, 0xedd3b4];
  const tileGeo = new RoundedBoxGeometry(1.15, 0.72, 0.08, 3, 0.03);
  for (let row = 0; row < 4; row++) {
    for (let col = -5; col <= 5; col++) {
      const m = clayMat(tileColors[(Math.abs(col) + row) % tileColors.length], {
        roughness: 0.82,
        warmth: 0.2,
      });
      const tile = new THREE.Mesh(tileGeo, m);
      tile.position.set(col * 1.22 + (row % 2) * 0.61, 0.55 + row * 0.78, -3.5);
      stage.add(tile);
    }
  }

  return stage;
}

/**
 * Builds the centerpiece Chunky Clay Pot, Stove Flame Ring, Dynamic Rippling/Vortex Soup Surface,
 * Splash/Overflow Droplets, Simmer Bubbles, and Fragrant Steam Puffs!
 */
export function createPotSystem(scene) {
  const root = new THREE.Group();
  root.position.set(0, 0.02, 0.08);
  scene.add(root);

  const potSquash = new SquashSpring(200, 14);
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Cozy dark-iron clay stove ring + burner base
  const ironMat = clayMat(0x453b38, { roughness: 0.72, warmth: 0.1 });
  const stoveBase = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.54, 0.14, 32), ironMat);
  stoveBase.position.y = 0.05;
  stoveBase.receiveShadow = true;
  stoveBase.castShadow = true;
  root.add(stoveBase);

  // Sculpted clay stove flames around the pot bottom!
  const flames = [];
  const flameOuterMat = clayMat(0xff7b29, {
    roughness: 0.5,
    warmth: 0.45,
    emissive: 0xff5400,
    emissiveIntensity: 0.45,
  });
  const flameInnerMat = clayMat(0xffdc5e, {
    roughness: 0.45,
    warmth: 0.5,
    emissive: 0xffbe2e,
    emissiveIntensity: 0.55,
  });

  const flameGroup = new THREE.Group();
  flameGroup.position.y = 0.12;
  root.add(flameGroup);

  const numFlames = 14;
  for (let i = 0; i < numFlames; i++) {
    const angle = (i / numFlames) * Math.PI * 2;
    const fg = new THREE.Group();
    fg.position.set(Math.cos(angle) * 1.32, 0, Math.sin(angle) * 1.32);
    fg.rotation.y = -angle;

    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.30, 10), flameOuterMat);
    outer.position.y = 0.12;
    outer.rotation.z = -0.35;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.20, 8), flameInnerMat);
    inner.position.set(-0.02, 0.10, 0);
    inner.rotation.z = -0.35;
    fg.add(outer, inner);
    fg.scale.setScalar(0.001);
    fg.visible = false;
    flameGroup.add(fg);
    flames.push({ group: fg, phase: i * 0.9 });
  }

  // Lathe-sculpted Plump Earthenware Clay Pot (warm vermilion exterior + cream-glazed interior!)
  const outerPts = [
    new THREE.Vector2(0.0, 0.08),
    new THREE.Vector2(1.12, 0.08),
    new THREE.Vector2(1.42, 0.28),
    new THREE.Vector2(1.50, 0.65),
    new THREE.Vector2(1.48, 0.98),
    new THREE.Vector2(1.54, 1.06), // Plump rolled clay lip
    new THREE.Vector2(1.44, 1.12),
    new THREE.Vector2(1.33, 1.06),
  ];
  const innerPts = [
    new THREE.Vector2(1.33, 1.06),
    new THREE.Vector2(1.31, 0.62),
    new THREE.Vector2(1.18, 0.24),
    new THREE.Vector2(0.0, 0.20),
  ];

  const potOuterMat = clayMat(0xdf5638, { roughness: 0.68, warmth: 0.18, bumpScale: 0.026 });
  const potInnerMat = clayMat(0xf7ead7, { roughness: 0.58, warmth: 0.22, bumpScale: 0.014 });

  const outerGeo = sculptClayGeo(new THREE.LatheGeometry(outerPts, 40), 0.008, 3.5, 1.0);
  const outerMesh = new THREE.Mesh(outerGeo, potOuterMat);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  outerMesh.userData.isPot = true;
  bodyGroup.add(outerMesh);

  const innerGeo = new THREE.LatheGeometry(innerPts, 40);
  const innerMesh = new THREE.Mesh(innerGeo, potInnerMat);
  innerMesh.receiveShadow = true;
  innerMesh.userData.isPot = true;
  bodyGroup.add(innerMesh);

  // Decorative cream clay wave band around pot belly
  const bandGeo = new THREE.TorusGeometry(1.49, 0.038, 8, 40);
  bandGeo.rotateX(Math.PI * 0.5);
  const band = new THREE.Mesh(bandGeo, potInnerMat);
  band.position.y = 0.72;
  bodyGroup.add(band);

  // Two chunky donabe clay loop handles sticking proudly outward on left & right!
  for (const side of [-1, 1]) {
    const hGeo = sculptClayGeo(new THREE.TorusGeometry(0.26, 0.095, 12, 20, Math.PI * 1.05), 0.008, 5, side);
    const handle = new THREE.Mesh(hGeo, potOuterMat);
    handle.position.set(side * 1.46, 0.80, 0);
    handle.rotation.x = Math.PI * 0.35;
    handle.rotation.y = side > 0 ? 0 : Math.PI;
    handle.rotation.z = -Math.PI * 0.5;
    handle.castShadow = true;
    handle.userData.isPot = true;
    bodyGroup.add(handle);
  }

  // Dynamic Rippling & Swirling Soup Surface Disc (radial grid for smooth vortex & waves)
  const RINGS = 16;
  const SEGS = 36;
  const maxR = 1.32;
  const surfGeo = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];

  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= RINGS; r++) {
    const rad = (r / RINGS) * maxR;
    for (let s = 0; s < SEGS; s++) {
      const a = (s / SEGS) * Math.PI * 2;
      positions.push(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      uvs.push(0.5 + (Math.cos(a) * rad) / (maxR * 2), 0.5 + (Math.sin(a) * rad) / (maxR * 2));
    }
  }

  for (let s = 0; s < SEGS; s++) {
    const next = (s + 1) % SEGS;
    indices.push(0, 1 + next, 1 + s);
  }
  for (let r = 1; r < RINGS; r++) {
    const rowA = 1 + (r - 1) * SEGS;
    const rowB = 1 + r * SEGS;
    for (let s = 0; s < SEGS; s++) {
      const next = (s + 1) % SEGS;
      indices.push(rowA + s, rowA + next, rowB + s);
      indices.push(rowA + next, rowB + next, rowB + s);
    }
  }

  surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surfGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  surfGeo.setIndex(indices);
  surfGeo.computeVertexNormals();

  const soupMat = clayMat(0x7ad0f5, {
    roughness: 0.26,
    warmth: 0.22,
    rim: 0.28,
    transparent: true,
    opacity: 0.78,
    bumpScale: 0.01,
  });

  const soupMesh = new THREE.Mesh(surfGeo, soupMat);
  soupMesh.position.y = 0.22;
  soupMesh.visible = false;
  soupMesh.receiveShadow = true;
  soupMesh.userData.isSoup = true;
  bodyGroup.add(soupMesh);

  // Floating ingredients container inside the pot
  const ingredientsGroup = new THREE.Group();
  bodyGroup.add(ingredientsGroup);

  // Swirling Miso Paste Ribbons/Clouds container
  const misoSwirlGroup = new THREE.Group();
  bodyGroup.add(misoSwirlGroup);
  const misoClouds = [];
  const misoCloudMat = clayMat(0xc4772c, {
    roughness: 0.62,
    warmth: 0.22,
    transparent: true,
    opacity: 0.88,
  });
  for (let i = 0; i < 16; i++) {
    const cGeo = new THREE.SphereGeometry(0.11 + (i % 3) * 0.035, 10, 8);
    cGeo.scale(1.5, 0.35, 0.85);
    const m = new THREE.Mesh(cGeo, misoCloudMat);
    m.visible = false;
    misoSwirlGroup.add(m);
    misoClouds.push({ mesh: m, angle: (i / 16) * Math.PI * 2, rad: 0.2 + (i % 5) * 0.18, life: 0 });
  }

  // Simmer Bubbles + Splash Droplets + Steam Puffs pools!
  const bubbles = [];
  const bubbleMat = clayMat(0xfff6dc, { roughness: 0.25, warmth: 0.3, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), bubbleMat);
    b.visible = false;
    bodyGroup.add(b);
    bubbles.push({ mesh: b, life: 0, maxLife: 0.65, x: 0, z: 0, size: 1 });
  }

  const droplets = [];
  const waterDropMat = clayMat(0x7fd4fa, { roughness: 0.22, warmth: 0.25 });
  const soupDropMat = clayMat(0xe8af48, { roughness: 0.28, warmth: 0.25 });
  for (let i = 0; i < 28; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), waterDropMat);
    d.visible = false;
    root.add(d);
    droplets.push({ mesh: d, vel: new THREE.Vector3(), life: 0 });
  }

  const steamPuffs = [];
  const steamMat = clayMat(0xfffaf2, {
    roughness: 0.9,
    warmth: 0.35,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  for (let i = 0; i < 12; i++) {
    const sGeo = sculptClayGeo(new THREE.SphereGeometry(0.18, 12, 10), 0.02, 4, i);
    const sMesh = new THREE.Mesh(sGeo, steamMat.clone());
    sMesh.visible = false;
    root.add(sMesh);
    steamPuffs.push({ mesh: sMesh, vel: new THREE.Vector3(), life: 0, maxLife: 1.8 });
  }

  // Pot fluid & recipe state
  const state = {
    waterLevel: 0, // 0..1.0 (up to 1.14 dome during active overflow!)
    dashiAmount: 0, // 0..1.0
    misoAmount: 0, // 0..1.0 (can go up to 1.35 if extra miso scoop!)
    heatOn: false,
    flameScale: 0,
    vortexVel: 0, // radians/sec
    vortexAngle: 0,
    ripples: [], // { x, z, t, amp }
    floatingItems: [], // { mesh, type, radius, angle, dist, bobPhase, squash, swellProg, sizeFactor }
    steamTimer: 0,
    bubbleTimer: 0,
  };

  const colorWater = new THREE.Color(0x79d2f7);
  const colorDashi = new THREE.Color(0xf0b843);
  const colorMiso = new THREE.Color(0xd18838);
  const colorRichMiso = new THREE.Color(0xb86b27);
  const tmpColor = new THREE.Color();

  function getSoupY() {
    return 0.24 + Math.min(1.04, state.waterLevel) * 0.64;
  }

  function addRipple(localX, localZ, amp = 0.06) {
    if (state.ripples.length > 6) state.ripples.shift();
    state.ripples.push({ x: localX, z: localZ, t: 0, amp });
  }

  function spawnSplash(localX, localZ, count = 7, isGolden = false, speed = 1.0) {
    const y = getSoupY();
    let spawned = 0;
    for (const d of droplets) {
      if (d.life <= 0 && spawned < count) {
        d.life = 0.55 + Math.random() * 0.25;
        d.mesh.material = isGolden ? soupDropMat : waterDropMat;
        d.mesh.visible = true;
        d.mesh.position.set(localX, y + 0.04, localZ);
        d.mesh.scale.setScalar(0.75 + Math.random() * 0.55);
        const a = Math.random() * Math.PI * 2;
        const out = (0.65 + Math.random() * 0.95) * speed;
        d.vel.set(Math.cos(a) * out, (1.8 + Math.random() * 1.4) * speed, Math.sin(a) * out);
        spawned++;
      }
    }
  }

  function spawnOverflowDrops() {
    // Plump water droplets spilling right over the pot rim onto the counter!
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const rx = Math.cos(a) * 1.46;
      const rz = Math.sin(a) * 1.46;
      for (const d of droplets) {
        if (d.life <= 0) {
          d.life = 0.65;
          d.mesh.material = state.dashiAmount > 0.3 ? soupDropMat : waterDropMat;
          d.mesh.visible = true;
          d.mesh.position.set(rx, 1.02, rz);
          d.mesh.scale.setScalar(1.05);
          d.vel.set(Math.cos(a) * 1.15, 0.8 + Math.random() * 0.7, Math.sin(a) * 1.15);
          break;
        }
      }
    }
  }

  function spawnSteamBurst(count = 4, big = false) {
    let spawned = 0;
    for (const s of steamPuffs) {
      if (s.life <= 0 && spawned < count) {
        s.maxLife = big ? 2.2 : 1.6;
        s.life = s.maxLife;
        s.mesh.visible = true;
        s.mesh.position.set(
          (Math.random() - 0.5) * 1.2,
          getSoupY() + 0.12,
          (Math.random() - 0.5) * 1.2
        );
        s.vel.set((Math.random() - 0.5) * 0.25, big ? 0.95 : 0.68, (Math.random() - 0.5) * 0.22);
        s.mesh.userData.big = big;
        spawned++;
      }
    }
  }

  function addFloatingIngredient(item) {
    ingredientsGroup.add(item.mesh);
    state.floatingItems.push(item);
  }

  function resetPot() {
    state.waterLevel = 0;
    state.dashiAmount = 0;
    state.misoAmount = 0;
    state.heatOn = false;
    state.flameScale = 0;
    state.vortexVel = 0;
    state.ripples.length = 0;
    for (const item of state.floatingItems) {
      ingredientsGroup.remove(item.mesh);
    }
    state.floatingItems.length = 0;
    for (const c of misoClouds) {
      c.life = 0;
      c.mesh.visible = false;
    }
    for (const b of bubbles) {
      b.life = 0;
      b.mesh.visible = false;
    }
    for (const d of droplets) {
      d.life = 0;
      d.mesh.visible = false;
    }
    for (const s of steamPuffs) {
      s.life = 0;
      s.mesh.visible = false;
    }
    soupMesh.visible = false;
    potSquash.impulse(2.4);
  }

  function update(dt, time) {
    potSquash.update(dt, bodyGroup, 1.0);

    // Stove clay flames animation
    const targetFlame = state.heatOn ? 1.0 : 0.0;
    state.flameScale = THREE.MathUtils.lerp(state.flameScale, targetFlame, Math.min(1, dt * 6));
    for (const f of flames) {
      if (state.flameScale > 0.02) {
        f.group.visible = true;
        const flicker = 0.85 + Math.sin(time * 16 + f.phase) * 0.2;
        f.group.scale.setScalar(state.flameScale * flicker);
      } else {
        f.group.visible = false;
      }
    }

    // Soup visibility, height, color & dynamic surface mesh deformation
    if (state.waterLevel > 0.01) {
      soupMesh.visible = true;
      const baseY = getSoupY();
      soupMesh.position.y = baseY;

      // Scale disc slightly by pot interior taper
      const rScale = 0.90 + Math.min(1.0, state.waterLevel) * 0.105;
      soupMesh.scale.set(rScale, 1, rScale);

      // Blend color: Water -> Golden Dashi -> Creamy Miso -> Extra Rich Miso
      tmpColor.copy(colorWater).lerp(colorDashi, Math.min(1, state.dashiAmount));
      if (state.misoAmount > 0) {
        const m1 = Math.min(1, state.misoAmount);
        tmpColor.lerp(colorMiso, m1);
        if (state.misoAmount > 1.0) {
          tmpColor.lerp(colorRichMiso, Math.min(1, state.misoAmount - 1.0));
        }
      }
      soupMat.color.copy(tmpColor);
      soupMat.opacity = THREE.MathUtils.lerp(
        0.76,
        0.96,
        Math.max(state.dashiAmount * 0.35, Math.min(1, state.misoAmount))
      );

      // Update ripples
      for (let i = state.ripples.length - 1; i >= 0; i--) {
        state.ripples[i].t += dt;
        if (state.ripples[i].t > 1.3) state.ripples.splice(i, 1);
      }

      // Vortex decay
      state.vortexAngle += state.vortexVel * dt;
      state.vortexVel *= Math.exp(-2.1 * dt);

      // Deform soup surface vertices
      const pos = surfGeo.attributes.position;
      const overflowDome = Math.max(0, state.waterLevel - 1.0) * 0.95;
      const absVortex = Math.abs(state.vortexVel);

      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const dist = Math.hypot(vx, vz);
        const normR = dist / maxR;

        let vy = 0;

        // Gentle simmer wave
        if (state.heatOn) {
          vy += Math.sin(vx * 4.5 + time * 4.2) * Math.cos(vz * 4.5 - time * 3.6) * 0.012 * (1 - normR * 0.4);
        }

        // Surface-tension plump dome when overflowing!
        if (overflowDome > 0) {
          vy += Math.cos(normR * Math.PI * 0.5) * overflowDome * 0.16;
        }

        // Real whirlpool vortex dip in center + spiral wave ridges!
        if (absVortex > 0.15) {
          const strength = Math.min(1.0, absVortex / 5.5);
          vy -= (1 - normR * normR) * 0.13 * strength;
          const ang = Math.atan2(vz, vx);
          vy += Math.sin(ang * 3 - state.vortexAngle * 2.2 + dist * 6.0) * 0.022 * strength * normR;
        }

        // Finger-poke / plop concentric ripples
        for (const rip of state.ripples) {
          const d = Math.hypot(vx - rip.x, vz - rip.z);
          const waveFront = rip.t * 2.4;
          const delta = d - waveFront;
          if (Math.abs(delta) < 0.45) {
            const env = Math.exp(-rip.t * 2.6) * Math.cos((delta / 0.45) * Math.PI * 0.5);
            vy += Math.sin(delta * 18.0) * rip.amp * env * (1 - normR * 0.35);
          }
        }

        pos.setY(i, vy);
      }
      pos.needsUpdate = true;
      surfGeo.computeVertexNormals();
    } else {
      soupMesh.visible = false;
    }

    // Simmer bubbles & steam when heated
    if (state.heatOn && state.waterLevel > 0.35) {
      state.bubbleTimer -= dt;
      if (state.bubbleTimer <= 0) {
        state.bubbleTimer = 0.16 + Math.random() * 0.18;
        for (const b of bubbles) {
          if (b.life <= 0) {
            b.maxLife = 0.45 + Math.random() * 0.35;
            b.life = b.maxLife;
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.98;
            b.x = Math.cos(a) * r;
            b.z = Math.sin(a) * r;
            b.size = 0.7 + Math.random() * 0.75;
            b.mesh.visible = true;
            break;
          }
        }
      }

      state.steamTimer -= dt;
      if (state.steamTimer <= 0) {
        state.steamTimer = state.misoAmount > 0.5 ? 0.38 : 0.65;
        spawnSteamBurst(1, false);
      }
    }

    for (const b of bubbles) {
      if (b.life > 0) {
        b.life -= dt;
        const p = 1 - b.life / b.maxLife;
        b.mesh.position.set(b.x, getSoupY() + 0.02, b.z);
        const sc = Math.sin(p * Math.PI) * b.size;
        b.mesh.scale.setScalar(Math.max(0.01, sc));
        if (b.life <= 0) {
          b.mesh.visible = false;
          if (Math.random() < 0.25) sound.playBubblePop();
        }
      }
    }

    // Update splash droplets
    for (const d of droplets) {
      if (d.life > 0) {
        d.life -= dt;
        d.vel.y -= 9.2 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < 0.02) {
          d.mesh.position.y = 0.02;
          d.vel.y *= -0.3;
          d.vel.x *= 0.6;
          d.vel.z *= 0.6;
        }
        if (d.life <= 0) d.mesh.visible = false;
      }
    }

    // Update rising fragrant clay steam puffs
    for (const s of steamPuffs) {
      if (s.life > 0) {
        s.life -= dt;
        const p = 1 - s.life / s.maxLife;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.position.x += Math.sin(time * 2.5 + p * 5) * 0.18 * dt;
        const baseS = s.mesh.userData.big ? 1.55 : 0.95;
        const sc = (0.35 + p * 1.15) * baseS;
        s.mesh.scale.set(sc * 1.15, sc * 0.85, sc);
        s.mesh.material.opacity = Math.sin(p * Math.PI) * (s.mesh.userData.big ? 0.62 : 0.38);
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    // Update floating ingredients inside the pot (gravity drop -> splash -> buoyancy bob + vortex orbit!)
    const surfaceY = getSoupY();
    for (const item of state.floatingItems) {
      if (item.falling) {
        item.vy -= 10.5 * dt;
        item.mesh.position.y += item.vy * dt;
        item.mesh.position.x = THREE.MathUtils.lerp(item.mesh.position.x, item.targetX, dt * 4);
        item.mesh.position.z = THREE.MathUtils.lerp(item.mesh.position.z, item.targetZ, dt * 4);
        item.mesh.rotation.x += item.rotVel.x * dt;
        item.mesh.rotation.z += item.rotVel.z * dt;

        if (item.mesh.position.y <= surfaceY) {
          item.falling = false;
          item.mesh.position.y = surfaceY - 0.08;
          item.angle = Math.atan2(item.mesh.position.z, item.mesh.position.x);
          item.dist = Math.min(0.95, Math.hypot(item.mesh.position.x, item.mesh.position.z));
          item.squash.impulse(-3.2);
          addRipple(item.mesh.position.x, item.mesh.position.z, 0.065 * (item.sizeFactor || 1));
          spawnSplash(
            item.mesh.position.x,
            item.mesh.position.z,
            Math.round(5 * (item.sizeFactor || 1)),
            state.dashiAmount > 0.3,
            0.85 + 0.25 * (item.sizeFactor || 1)
          );
          sound.playPlop(item.sizeFactor || 1);
          potSquash.impulse(-0.9 * Math.min(2, item.sizeFactor || 1));
        }
      } else {
        // Wakame magical 5x swelling unfurl animation!
        if (item.type === 'wakame' && item.swellProg < 1) {
          item.swellProg = Math.min(1, item.swellProg + dt * 1.45);
          // Smooth overshoot elastic curve
          const t = item.swellProg;
          const elastic = t === 1 ? 1 : 1 - Math.pow(2, -8 * t) * Math.cos(t * Math.PI * 2.5);
          const sc = 0.24 + elastic * 0.86;
          item.crinkledMesh.visible = t < 0.35;
          item.unfurledMesh.visible = t >= 0.22;
          item.mesh.scale.setScalar(sc);
        } else {
          item.squash.update(dt, item.mesh, item.baseScale || 1);
        }

        // Orbit with stirring vortex + gentle convection drift!
        const angularSpeed = state.vortexVel * 0.72 + (state.heatOn ? 0.22 : 0.04);
        item.angle += angularSpeed * dt;
        const bob = Math.sin(time * 3.2 + item.bobPhase) * 0.028;
        const vortexDip = Math.min(0.08, Math.abs(state.vortexVel) * 0.012) * (1 - item.dist);

        item.mesh.position.x = Math.cos(item.angle) * item.dist;
        item.mesh.position.z = Math.sin(item.angle) * item.dist;
        item.mesh.position.y = surfaceY + (item.floatOffset ?? -0.02) + bob - vortexDip;
        item.mesh.rotation.y = -item.angle + Math.sin(time * 1.8 + item.bobPhase) * 0.25;
        item.mesh.rotation.x = THREE.MathUtils.lerp(
          item.mesh.rotation.x,
          Math.sin(time * 2.4 + item.bobPhase) * 0.14,
          dt * 5
        );
        item.mesh.rotation.z = THREE.MathUtils.lerp(
          item.mesh.rotation.z,
          Math.cos(time * 2.1 + item.bobPhase) * 0.14,
          dt * 5
        );
      }
    }

    // Update swirling miso clouds during stirring
    for (const c of misoClouds) {
      if (c.life > 0) {
        c.life -= dt;
        c.angle += (state.vortexVel * 0.95 + 1.2) * dt;
        c.rad = Math.min(1.08, c.rad + dt * 0.28);
        c.mesh.position.set(
          Math.cos(c.angle) * c.rad,
          surfaceY + 0.012,
          Math.sin(c.angle) * c.rad
        );
        c.mesh.rotation.y = -c.angle;
        const s = Math.sin((1 - c.life / 1.1) * Math.PI) * 1.25;
        c.mesh.scale.set(1.6 * s, 0.3 * s, 0.85 * s);
        if (c.life <= 0) c.mesh.visible = false;
      }
    }
  }

  function emitMisoSwirl(worldX, worldZ) {
    const local = root.worldToLocal(new THREE.Vector3(worldX, getSoupY(), worldZ));
    for (const c of misoClouds) {
      if (c.life <= 0) {
        c.life = 1.1;
        c.angle = Math.atan2(local.z, local.x);
        c.rad = Math.min(0.95, Math.hypot(local.x, local.z));
        c.mesh.visible = true;
        break;
      }
    }
  }

  return {
    root,
    bodyGroup,
    soupMesh,
    potSquash,
    state,
    getSoupY,
    addRipple,
    spawnSplash,
    spawnOverflowDrops,
    spawnSteamBurst,
    addFloatingIngredient,
    emitMisoSwirl,
    resetPot,
    update,
  };
}

/**
 * Builds the Big Chunky Brass-and-Coral Clay Water Faucet perched at the left edge of the pot!
 */
export function createWaterFaucet(scene) {
  const group = new THREE.Group();
  group.position.set(-1.68, 0.0, 0.22);
  scene.add(group);

  const brassMat = clayMat(0xe6b85c, { roughness: 0.52, warmth: 0.2, rim: 0.25 });
  const handleMat = clayMat(0xff4f5e, { roughness: 0.58, warmth: 0.26 });
  const capMat = clayMat(0x5ec8f8, { roughness: 0.38, warmth: 0.28 });

  // Chunky base flange on counter
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.20, 20), brassMat);
  base.position.y = 0.10;
  base.castShadow = true;
  base.userData.isFaucet = true;
  group.add(base);

  // Curved gooseneck pipe arcing cleanly over the pot rim!
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(0, 1.25, 0.0),
    new THREE.Vector3(0.38, 1.56, 0.04),
    new THREE.Vector3(0.86, 1.44, 0.08),
    new THREE.Vector3(0.94, 1.24, 0.08),
  ]);
  const pipeGeo = new THREE.TubeGeometry(curve, 24, 0.14, 16, false);
  const pipe = new THREE.Mesh(pipeGeo, brassMat);
  pipe.castShadow = true;
  pipe.userData.isFaucet = true;
  group.add(pipe);

  // Flared spout lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 18), brassMat);
  lip.rotation.x = Math.PI * 0.5;
  lip.position.set(0.94, 1.23, 0.08);
  lip.userData.isFaucet = true;
  group.add(lip);

  // HUGE 5-Petal Coral-Red Clay Flower Tap Handle mounted proudly in front/top (100% unoccluded!)
  const handlePivot = new THREE.Group();
  handlePivot.position.set(-0.08, 1.18, 0.30);
  handlePivot.rotation.x = 0.72;
  group.add(handlePivot);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 12), brassMat);
  stem.position.y = -0.10;
  stem.userData.isFaucet = true;
  handlePivot.add(stem);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), capMat);
  hub.scale.set(1, 0.72, 1);
  hub.position.y = 0.08;
  hub.userData.isFaucet = true;
  handlePivot.add(hub);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), handleMat);
    petal.scale.set(0.95, 0.58, 1.28);
    petal.position.set(Math.cos(a) * 0.25, 0.03, Math.sin(a) * 0.25);
    petal.rotation.y = -a;
    petal.castShadow = true;
    petal.userData.isFaucet = true;
    handlePivot.add(petal);
  }

  // Glossy sculpted sky-blue clay water stream column!
  const streamMat = clayMat(0x6fd2ff, {
    roughness: 0.18,
    warmth: 0.3,
    rim: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  const streamGeo = new THREE.CylinderGeometry(0.095, 0.135, 1.0, 16, 8);
  const streamMesh = new THREE.Mesh(streamGeo, streamMat);
  streamMesh.visible = false;
  group.add(streamMesh);

  const squash = new SquashSpring(220, 13);

  function getSpoutWorldPos() {
    return group.localToWorld(new THREE.Vector3(0.94, 1.22, 0.08));
  }

  return {
    group,
    handlePivot,
    streamMesh,
    squash,
    getSpoutWorldPos,
  };
}

/**
 * Builds the Dashi Tray with sculpted Clay Kombu (kelp) & Fluffy Golden Katsuobushi Dashi Pouch!
 */
export function createDashiTray(scene) {
  const trayGroup = new THREE.Group();
  trayGroup.position.set(1.52, 0.04, 1.55);
  scene.add(trayGroup);

  const dishMat = clayMat(0xe8d0a9, { roughness: 0.76, warmth: 0.2 });
  const rimMat = clayMat(0xcfa974, { roughness: 0.76, warmth: 0.18 });

  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.64, 0.10, 28), dishMat);
  dish.scale.set(1.22, 1, 0.88);
  dish.position.y = 0.05;
  dish.castShadow = true;
  dish.receiveShadow = true;
  trayGroup.add(dish);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.055, 10, 28), rimMat);
  rim.rotation.x = Math.PI * 0.5;
  rim.scale.set(1.22, 0.88, 1);
  rim.position.y = 0.10;
  trayGroup.add(rim);

  // 1) Wavy Dark-Olive Clay Kombu with cute white umami crystals
  const kombuGroup = new THREE.Group();
  kombuGroup.position.set(-0.36, 0.18, 0.0);
  trayGroup.add(kombuGroup);

  const kombuMat = clayMat(0x2d4a2b, { roughness: 0.66, warmth: 0.14 });
  const dotMat = clayMat(0xf5efe0, { roughness: 0.75, warmth: 0.25 });

  const kGeo = new RoundedBoxGeometry(0.46, 0.09, 0.78, 5, 0.04);
  const kPos = kGeo.attributes.position;
  for (let i = 0; i < kPos.count; i++) {
    const z = kPos.getZ(i);
    const x = kPos.getX(i);
    kPos.setY(i, kPos.getY(i) + Math.sin(z * 6.5) * 0.045 + Math.cos(x * 5) * 0.02);
  }
  kGeo.computeVertexNormals();
  const kombuMesh = new THREE.Mesh(kGeo, kombuMat);
  kombuMesh.rotation.y = 0.22;
  kombuMesh.castShadow = true;
  kombuMesh.userData.dashiType = 'kombu';
  kombuGroup.add(kombuMesh);

  for (let i = 0; i < 6; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dotMat);
    dot.scale.set(1.2, 0.45, 1.0);
    dot.position.set((i % 2 === 0 ? -0.08 : 0.09), 0.055, -0.22 + i * 0.09);
    kombuMesh.add(dot);
  }

  // 2) Plump Golden Dashi Pouch + Curly Katsuobushi Flakes!
  const katsuoGroup = new THREE.Group();
  katsuoGroup.position.set(0.38, 0.22, 0.02);
  trayGroup.add(katsuoGroup);

  const pouchMat = clayMat(0xfff4de, { roughness: 0.78, warmth: 0.22 });
  const ribbonMat = clayMat(0xf4a236, { roughness: 0.65, warmth: 0.24 });
  const flakeMat = clayMat(0xd98a4e, { roughness: 0.68, warmth: 0.22 });

  const pouchGeo = sculptClayGeo(new THREE.SphereGeometry(0.28, 18, 14), 0.018, 4.5, 3.1);
  pouchGeo.scale(1.15, 0.78, 1.05);
  const pouch = new THREE.Mesh(pouchGeo, pouchMat);
  pouch.castShadow = true;
  pouch.userData.dashiType = 'katsuo';
  katsuoGroup.add(pouch);

  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 8, 16), ribbonMat);
  tie.rotation.x = Math.PI * 0.5;
  tie.position.y = 0.18;
  tie.userData.dashiType = 'katsuo';
  katsuoGroup.add(tie);

  // Cute golden bonito curls on top!
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.026, 8, 14, Math.PI * 1.25), flakeMat);
    curl.position.set(Math.cos(a) * 0.12, 0.23 + (i % 2) * 0.03, Math.sin(a) * 0.12);
    curl.rotation.set(0.6 + i * 0.3, a, 0.4);
    curl.userData.dashiType = 'katsuo';
    katsuoGroup.add(curl);
  }

  return {
    trayGroup,
    kombuGroup,
    katsuoGroup,
    traySquash: new SquashSpring(200, 14),
    kombuSquash: new SquashSpring(220, 13),
    katsuoSquash: new SquashSpring(220, 13),
  };
}

/**
 * Real-time 3D Slicable Silken Tofu on the Palm!
 * Allows slicing vertically, horizontally, or tapping into 2 giant halves up to 12 bouncy cubes,
 * and then tipping all custom-cut tofu blocks right off the palm into the simmering pot!
 */
export class TofuPalmController {
  constructor(tofuMount, potSystem) {
    this.mount = tofuMount;
    this.pot = potSystem;
    this.tofuMat = clayMat(0xfffdf7, { roughness: 0.58, warmth: 0.28, rim: 0.24, bumpScale: 0.01 });
    this.pieces = []; // { x0, x1, z0, z1, mesh, squash }
    this.cutCount = 0;
    this.isTipping = false;
    this.tipTimer = 0;
  }

  spawnFreshBlock() {
    this.clear();
    this.cutCount = 0;
    this.isTipping = false;
    this.tipTimer = 0;
    // Initial big plump silken tofu block on the palm!
    this._addPiece(-0.56, 0.56, -0.46, 0.46, true);
  }

  clear() {
    for (const p of this.pieces) {
      this.mount.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.pieces.length = 0;
  }

  _addPiece(x0, x1, z0, z1, initialDrop = false) {
    const w = Math.max(0.14, x1 - x0 - 0.028);
    const d = Math.max(0.14, z1 - z0 - 0.028);
    const h = 0.38;
    const bevel = Math.min(0.058, Math.min(w, d) * 0.20);
    const geo = new RoundedBoxGeometry(w, h, d, 4, bevel);
    const mesh = new THREE.Mesh(geo, this.tofuMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    mesh.position.set(cx, h * 0.5, cz);
    mesh.userData.isTofu = true;

    const squash = new SquashSpring(240, 12);
    if (initialDrop) squash.impulse(-3.2);
    else squash.impulse(-2.4);

    this.mount.add(mesh);
    const piece = { x0, x1, z0, z1, w, d, h, mesh, squash };
    this.pieces.push(piece);
    return piece;
  }

  /**
   * Slices across the tofu along X or Z depending on swipe direction (or splits largest axis on tap).
   * Returns { didCut, knifeLocalPos, cutAxis } so the chunky clay knife animates right through the cut!
   */
  performCut(localStart, localEnd) {
    if (this.isTipping || this.pieces.length === 0) return { didCut: false };

    const dx = localEnd.x - localStart.x;
    const dz = localEnd.z - localStart.z;
    const swipeLen = Math.hypot(dx, dz);

    let axis = null; // 'x' means cut plane x = const; 'z' means cut plane z = const
    let coord = 0;

    if (swipeLen > 0.14) {
      // Swipe along Z cuts at X = midX; swipe along X cuts at Z = midZ!
      if (Math.abs(dz) >= Math.abs(dx)) {
        axis = 'x';
        coord = THREE.MathUtils.clamp((localStart.x + localEnd.x) * 0.5, -0.42, 0.42);
      } else {
        axis = 'z';
        coord = THREE.MathUtils.clamp((localStart.z + localEnd.z) * 0.5, -0.34, 0.34);
      }
    } else {
      // Tap gesture! Find the piece near tap (or largest piece) and split its longer dimension cleanly!
      let best = null;
      let bestScore = -Infinity;
      for (const p of this.pieces) {
        const cx = (p.x0 + p.x1) * 0.5;
        const cz = (p.z0 + p.z1) * 0.5;
        const dist = Math.hypot(localEnd.x - cx, localEnd.z - cz);
        const maxDim = Math.max(p.x1 - p.x0, p.z1 - p.z0);
        if (maxDim < 0.34) continue; // Already bite-sized cube!
        const score = maxDim * 2.0 - dist;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      if (!best) return { didCut: false, allBiteSized: true };
      const wx = best.x1 - best.x0;
      const wz = best.z1 - best.z0;
      if (wx >= wz) {
        axis = 'x';
        coord = (best.x0 + best.x1) * 0.5;
      } else {
        axis = 'z';
        coord = (best.z0 + best.z1) * 0.5;
      }
    }

    // Split all pieces crossed by this cut plane (with slight spread offset so gaps are super clear!)
    const MIN_SLICE = 0.19;
    let splitAny = false;
    const nextPieces = [];

    for (const p of this.pieces) {
      if (axis === 'x' && coord > p.x0 + MIN_SLICE && coord < p.x1 - MIN_SLICE && this.pieces.length + nextPieces.length < 13) {
        splitAny = true;
        this.mount.remove(p.mesh);
        p.mesh.geometry.dispose();
        const spread = 0.024;
        nextPieces.push({ x0: p.x0 - spread, x1: coord - spread * 0.4, z0: p.z0, z1: p.z1 });
        nextPieces.push({ x0: coord + spread * 0.4, x1: p.x1 + spread, z0: p.z0, z1: p.z1 });
      } else if (axis === 'z' && coord > p.z0 + MIN_SLICE && coord < p.z1 - MIN_SLICE && this.pieces.length + nextPieces.length < 13) {
        splitAny = true;
        this.mount.remove(p.mesh);
        p.mesh.geometry.dispose();
        const spread = 0.024;
        nextPieces.push({ x0: p.x0, x1: p.x1, z0: p.z0 - spread, z1: coord - spread * 0.4 });
        nextPieces.push({ x0: p.x0, x1: p.x1, z0: coord + spread * 0.4, z1: p.z1 + spread });
      } else {
        nextPieces.push(p);
      }
    }

    // Fallback: if swipe missed slightly, split the largest remaining sliceable block!
    if (!splitAny) {
      let largestIdx = -1;
      let largestDim = 0.34;
      for (let i = 0; i < this.pieces.length; i++) {
        const p = this.pieces[i];
        const m = Math.max(p.x1 - p.x0, p.z1 - p.z0);
        if (m > largestDim) {
          largestDim = m;
          largestIdx = i;
        }
      }
      if (largestIdx >= 0 && this.pieces.length < 12) {
        const p = this.pieces[largestIdx];
        this.mount.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.pieces.splice(largestIdx, 1);
        const spread = 0.024;
        if (p.x1 - p.x0 >= p.z1 - p.z0) {
          axis = 'x';
          coord = (p.x0 + p.x1) * 0.5;
          this._addPiece(p.x0 - spread, coord - spread * 0.4, p.z0, p.z1);
          this._addPiece(coord + spread * 0.4, p.x1 + spread, p.z0, p.z1);
        } else {
          axis = 'z';
          coord = (p.z0 + p.z1) * 0.5;
          this._addPiece(p.x0, p.x1, p.z0 - spread, coord - spread * 0.4);
          this._addPiece(p.x0, p.x1, coord + spread * 0.4, p.z1 + spread);
        }
        splitAny = true;
        this.cutCount++;
        sound.playTofuSlice(this.cutCount);
        return { didCut: true, axis, coord, cutCount: this.cutCount };
      }
      return { didCut: false, allBiteSized: true };
    }

    // Rebuild split pieces
    this.pieces = [];
    for (const item of nextPieces) {
      if (item.mesh) {
        item.squash.impulse(-1.4);
        this.pieces.push(item);
      } else {
        this._addPiece(item.x0, item.x1, item.z0, item.z1, false);
      }
    }

    this.cutCount++;
    sound.playTofuSlice(this.cutCount);
    return { didCut: true, axis, coord, cutCount: this.cutCount };
  }

  /**
   * Releases all cut tofu pieces off the tilted palm right into the simmering pot!
   */
  dropPiecesIntoPot() {
    if (this.pieces.length === 0) return;
    // Sort rightmost pieces first so they slide off the fingertips sequentially!
    const sorted = [...this.pieces].sort((a, b) => b.mesh.position.x - a.mesh.position.x);
    sorted.forEach((p, idx) => {
      const worldPos = new THREE.Vector3();
      p.mesh.getWorldPosition(worldPos);
      const potLocal = this.pot.root.worldToLocal(worldPos.clone());
      this.mount.remove(p.mesh);

      // Compute sizeFactor so giant half-blocks make BIG splashes & squirrel-cheek reactions!
      const area = p.w * p.d;
      const sizeFactor = area > 0.34 ? 2.1 : area > 0.18 ? 1.35 : 0.88;

      const spreadAngle = (idx / Math.max(1, sorted.length)) * Math.PI * 2 + Math.random() * 0.5;
      const targetR = 0.22 + Math.random() * 0.68;

      p.mesh.position.copy(potLocal);
      p.mesh.scale.setScalar(0.76); // Scale cleanly into pot interior proportions

      this.pot.addFloatingIngredient({
        mesh: p.mesh,
        type: 'tofu',
        isGiant: area > 0.34,
        sizeFactor,
        baseScale: 0.76,
        falling: true,
        vy: -0.4 - idx * 0.35,
        targetX: Math.cos(spreadAngle) * targetR,
        targetZ: Math.sin(spreadAngle) * targetR,
        rotVel: new THREE.Vector3((Math.random() - 0.5) * 4, 0, -2.5 - Math.random() * 2),
        bobPhase: Math.random() * Math.PI * 2,
        floatOffset: -0.02,
        squash: new SquashSpring(200, 12),
      });
    });
    this.pieces.length = 0;
  }

  update(dt) {
    for (const p of this.pieces) {
      p.squash.update(dt, p.mesh, 1.0);
    }
  }
}

/**
 * Builds the Dried Wakame Bowl + Bonus Garnish Dish (Flower Carrots, Uzumaki Fu, Green Negi),
 * plus factory helpers to spawn swelling wakame & cute garnishes in the pot!
 */
export function createWakameAndGarnishStation(scene) {
  const station = new THREE.Group();
  station.visible = false;
  scene.add(station);

  // Left Bowl: Dried Wakame Bowl!
  const wakameBowlGroup = new THREE.Group();
  wakameBowlGroup.position.set(-0.92, 0.04, 1.62);
  station.add(wakameBowlGroup);

  const tealBowlMat = clayMat(0x5ebec4, { roughness: 0.62, warmth: 0.2 });
  const creamMat = clayMat(0xfaf0df, { roughness: 0.68, warmth: 0.22 });
  const driedWakameMat = clayMat(0x1b3b29, { roughness: 0.78, warmth: 0.12, bumpScale: 0.03 });

  const wBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.40, 0.30, 24), tealBowlMat);
  wBowl.position.y = 0.15;
  wBowl.castShadow = true;
  wBowl.userData.pickType = 'wakame';
  wakameBowlGroup.add(wBowl);

  const wInner = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.36, 0.08, 22), creamMat);
  wInner.position.y = 0.27;
  wInner.userData.pickType = 'wakame';
  wakameBowlGroup.add(wInner);

  // Smooth crinkled dark dried wakame curls inside the bowl (zero inverted triangles!)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.4;
    const r = (i % 4) * 0.105;
    const bitGeo = sculptClayGeo(new THREE.SphereGeometry(0.095, 12, 10), 0.008, 8, i);
    bitGeo.scale(1.38, 0.62, 0.82);
    const bit = new THREE.Mesh(bitGeo, driedWakameMat);
    bit.position.set(Math.cos(a) * r, 0.33 + (1 - r) * 0.07, Math.sin(a) * r);
    bit.rotation.set(i * 0.7, i * 1.1, i * 0.4);
    bit.castShadow = true;
    bit.userData.pickType = 'wakame';
    wakameBowlGroup.add(bit);
  }

  // Right Mini Saucer: Optional Secret Cute Toppings (Flower Carrot, Uzumaki Fu, Negi)!
  const garnishGroup = new THREE.Group();
  garnishGroup.position.set(0.95, 0.04, 1.64);
  station.add(garnishGroup);

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.46, 0.10, 24), creamMat);
  saucer.position.y = 0.05;
  saucer.castShadow = true;
  garnishGroup.add(saucer);

  // Flower Carrots on saucer
  const carrotSlots = [];
  for (let i = 0; i < 2; i++) {
    const c = buildFlowerCarrotMesh();
    c.position.set(-0.22 + i * 0.16, 0.14 + i * 0.03, -0.14);
    c.rotation.x = 0.2 * i;
    c.traverse((m) => { m.userData.pickType = 'carrot'; });
    garnishGroup.add(c);
    carrotSlots.push(c);
  }

  // Uzumaki Fu on saucer
  for (let i = 0; i < 2; i++) {
    const fu = buildUzumakiFuMesh();
    fu.position.set(0.24, 0.14 + i * 0.05, 0.06 - i * 0.16);
    fu.traverse((m) => { m.userData.pickType = 'fu'; });
    garnishGroup.add(fu);
  }

  // Green Negi rings on saucer
  const negiCluster = new THREE.Group();
  negiCluster.position.set(-0.12, 0.14, 0.22);
  for (let i = 0; i < 4; i++) {
    const ring = buildNegiRingMesh();
    ring.position.set((i % 2) * 0.11, i * 0.015, Math.floor(i / 2) * 0.10);
    ring.userData.pickType = 'negi';
    negiCluster.add(ring);
  }
  garnishGroup.add(negiCluster);

  return {
    station,
    wakameBowlGroup,
    garnishGroup,
    wakameSquash: new SquashSpring(220, 13),
    garnishSquash: new SquashSpring(220, 13),
  };
}

const lushWakameMat = clayMat(0x1f8a4c, { roughness: 0.52, warmth: 0.2, rim: 0.25 });
const darkCrinkleMat = clayMat(0x1b3326, { roughness: 0.82, warmth: 0.1 });
const carrotMat = clayMat(0xff6b2b, { roughness: 0.6, warmth: 0.25 });
const fuCreamMat = clayMat(0xfff0d4, { roughness: 0.72, warmth: 0.22 });
const fuPinkMat = clayMat(0xff7aa2, { roughness: 0.68, warmth: 0.25 });
const negiMat = clayMat(0x52b74a, { roughness: 0.58, warmth: 0.22 });

export function createSwellingWakamePiece() {
  const root = new THREE.Group();

  // Tiny crinkled dark bit (visible initially)
  const crinkleGeo = sculptClayGeo(new THREE.SphereGeometry(0.11, 12, 10), 0.008, 7, Math.random() * 5);
  crinkleGeo.scale(1.3, 0.65, 0.85);
  const crinkledMesh = new THREE.Mesh(crinkleGeo, darkCrinkleMat);
  root.add(crinkledMesh);

  // Lush wavy 5x emerald-green sculpted clay seaweed fronds!
  const unfurledMesh = new THREE.Group();
  for (let f = 0; f < 2; f++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04, 0, -0.28),
      new THREE.Vector3(0.05 * (f === 0 ? 1 : -1), 0.03, -0.10),
      new THREE.Vector3(-0.05 * (f === 0 ? 1 : -1), -0.02, 0.10),
      new THREE.Vector3(0.03, 0.02, 0.28),
    ]);
    const frondGeo = new THREE.TubeGeometry(curve, 14, 0.075, 8, false);
    frondGeo.scale(1.55, 0.36, 1.0);
    const frond = new THREE.Mesh(frondGeo, lushWakameMat);
    frond.rotation.y = f === 0 ? 0.18 : -0.35;
    frond.position.x = (f - 0.5) * 0.06;
    frond.castShadow = true;
    unfurledMesh.add(frond);
  }
  unfurledMesh.visible = false;
  root.add(unfurledMesh);

  return { root, crinkledMesh, unfurledMesh };
}

export function buildFlowerCarrotMesh() {
  const g = new THREE.Group();
  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), carrotMat);
  g.add(center);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    const pet = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), carrotMat);
    pet.position.set(Math.cos(a) * 0.105, 0, Math.sin(a) * 0.105);
    pet.castShadow = true;
    g.add(pet);
  }
  return g;
}

export function buildUzumakiFuMesh() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.075, 16), fuCreamMat);
  base.castShadow = true;
  g.add(base);
  const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 16, Math.PI * 1.55), fuPinkMat);
  swirl.rotation.x = Math.PI * 0.5;
  swirl.position.y = 0.04;
  g.add(swirl);
  return g;
}

export function buildNegiRingMesh() {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.028, 8, 14), negiMat);
  ring.rotation.x = Math.PI * 0.5;
  ring.castShadow = true;
  return ring;
}

/**
 * Builds the Rustic Clay Miso Crock, Ready Miso Scoop, and Big Wooden Clay Ladle (`おたま`)!
 */
export function createMisoAndLadleSystem(scene) {
  // 1) Miso Crock on front-right
  const crockGroup = new THREE.Group();
  crockGroup.position.set(1.28, 0.04, 1.62);
  crockGroup.visible = false;
  scene.add(crockGroup);

  const crockMat = clayMat(0x7c4728, { roughness: 0.72, warmth: 0.16 });
  const misoPasteMat = clayMat(0xc4772c, { roughness: 0.68, warmth: 0.22, bumpScale: 0.038 });
  const woodMat = clayMat(0xdba065, { roughness: 0.74, warmth: 0.2 });

  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.48, 24), crockMat);
  jar.position.y = 0.24;
  jar.castShadow = true;
  jar.userData.isMisoSource = true;
  crockGroup.add(jar);

  const jarLip = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.065, 10, 24), crockMat);
  jarLip.rotation.x = Math.PI * 0.5;
  jarLip.position.y = 0.48;
  jarLip.userData.isMisoSource = true;
  crockGroup.add(jarLip);

  const misoFillGeo = sculptClayGeo(new THREE.SphereGeometry(0.44, 18, 14), 0.03, 5.5, 2.2);
  misoFillGeo.scale(1, 0.45, 1);
  const misoFill = new THREE.Mesh(misoFillGeo, misoPasteMat);
  misoFill.position.y = 0.45;
  misoFill.userData.isMisoSource = true;
  crockGroup.add(misoFill);

  // Wooden paddle perched with a big plump scoop of Miso ready to drop in!
  const paddleGroup = new THREE.Group();
  paddleGroup.position.set(-0.22, 0.68, -0.18);
  paddleGroup.rotation.z = 0.38;
  paddleGroup.rotation.y = 0.45;
  crockGroup.add(paddleGroup);

  const stick = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.65, 6, 12), woodMat);
  stick.rotation.z = Math.PI * 0.5;
  stick.position.x = 0.35;
  stick.userData.isMisoSource = true;
  paddleGroup.add(stick);

  const scoopDollopGeo = sculptClayGeo(new THREE.SphereGeometry(0.24, 16, 14), 0.025, 6.0, 1.1);
  const scoopDollop = new THREE.Mesh(scoopDollopGeo, misoPasteMat);
  scoopDollop.position.set(-0.04, 0.05, 0);
  scoopDollop.castShadow = true;
  scoopDollop.userData.isMisoSource = true;
  paddleGroup.add(scoopDollop);

  // 2) Big Wooden Clay Ladle (`おたま`) used for BOTH dissolving miso & ladling into bowls!
  const ladleGroup = new THREE.Group();
  ladleGroup.position.set(0.35, 1.05, 0.38);
  ladleGroup.visible = false;
  scene.add(ladleGroup);

  const cupOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 22, 16, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.54),
    woodMat
  );
  cupOuter.castShadow = true;
  cupOuter.userData.isLadle = true;
  ladleGroup.add(cupOuter);

  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.375, 0.035, 8, 22), woodMat);
  cupRim.rotation.x = Math.PI * 0.5;
  cupRim.position.y = 0.03;
  cupRim.userData.isLadle = true;
  ladleGroup.add(cupRim);

  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 1.25, 8, 14), woodMat);
  handle.position.set(0.56, 0.56, 0.16);
  handle.rotation.z = -0.76;
  handle.rotation.y = -0.25;
  handle.castShadow = true;
  handle.userData.isLadle = true;
  ladleGroup.add(handle);

  // Miso lump sitting inside the ladle while dissolving!
  const ladleMisoGeo = sculptClayGeo(new THREE.SphereGeometry(0.26, 18, 14), 0.026, 5.5, 4.4);
  const ladleMiso = new THREE.Mesh(ladleMisoGeo, misoPasteMat);
  ladleMiso.position.set(0, -0.04, 0);
  ladleMiso.visible = false;
  ladleGroup.add(ladleMiso);

  // Soup inside the ladle cup during Stage 5 serving!
  const ladleSoupMat = clayMat(0xd18838, { roughness: 0.3, warmth: 0.25 });
  const ladleSoup = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), ladleSoupMat);
  ladleSoup.rotation.x = -Math.PI * 0.5;
  ladleSoup.position.y = 0.01;
  ladleSoup.visible = false;
  ladleGroup.add(ladleSoup);

  const ladleTofuPreview = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.12, 0.16, 3, 0.03),
    clayMat(0xfffdf7, { roughness: 0.58, warmth: 0.28 })
  );
  ladleTofuPreview.position.set(-0.06, 0.04, 0.04);
  ladleSoup.add(ladleTofuPreview);

  const ladleWakamePreview = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.04, 0.24, 3, 0.02),
    lushWakameMat
  );
  ladleWakamePreview.position.set(0.08, 0.04, -0.04);
  ladleSoup.add(ladleWakamePreview);

  return {
    crockGroup,
    paddleGroup,
    scoopDollop,
    ladleGroup,
    ladleMiso,
    ladleSoup,
    ladleSoupMat,
    crockSquash: new SquashSpring(210, 13),
  };
}

/**
 * Creates a glossy Vermilion-and-Ebony Lacquer-Clay Soup Bowl (`お椀`)
 * with dynamic soup fill, actual matching ingredients (including GIANT tofu!), and rising steam!
 */
export function createSoupBowl(soupColorHex = 0xd18838, traits = {}) {
  const bowl = new THREE.Group();

  const outerMat = clayMat(0x3a221d, { roughness: 0.42, warmth: 0.14, rim: 0.26 });
  const innerMat = clayMat(0xd63826, { roughness: 0.38, warmth: 0.22, rim: 0.22 });
  const goldMat = clayMat(0xf0be49, { roughness: 0.45, warmth: 0.25 });

  // Foot ring (`高台`)
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.34, 0.11, 24), outerMat);
  foot.position.y = 0.055;
  foot.castShadow = true;
  foot.userData.isBowl = true;
  bowl.add(foot);

  // Outer bowl body
  const outerPts = [
    new THREE.Vector2(0, 0.10),
    new THREE.Vector2(0.32, 0.10),
    new THREE.Vector2(0.56, 0.26),
    new THREE.Vector2(0.62, 0.52),
    new THREE.Vector2(0.58, 0.54),
  ];
  const outerMesh = new THREE.Mesh(new THREE.LatheGeometry(outerPts, 28), outerMat);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  outerMesh.userData.isBowl = true;
  bowl.add(outerMesh);

  // Vermilion lacquer interior
  const innerPts = [
    new THREE.Vector2(0.58, 0.54),
    new THREE.Vector2(0.52, 0.28),
    new THREE.Vector2(0.28, 0.15),
    new THREE.Vector2(0, 0.14),
  ];
  const innerMesh = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 28), innerMat);
  innerMesh.userData.isBowl = true;
  bowl.add(innerMesh);

  // Golden clay decorative ring
  const goldBand = new THREE.Mesh(new THREE.TorusGeometry(0.595, 0.018, 8, 28), goldMat);
  goldBand.rotation.x = Math.PI * 0.5;
  goldBand.position.y = 0.44;
  bowl.add(goldBand);

  // Liquid & Ingredients inside the bowl (hidden when empty, rises when ladled!)
  const liquidGroup = new THREE.Group();
  liquidGroup.position.y = 0.16;
  liquidGroup.visible = false;
  bowl.add(liquidGroup);

  const liqMat = clayMat(soupColorHex, { roughness: 0.28, warmth: 0.24 });
  const liqDisc = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), liqMat);
  liqDisc.rotation.x = -Math.PI * 0.5;
  liqDisc.userData.isBowl = true;
  liquidGroup.add(liqDisc);

  const tofuMat = clayMat(0xfffdf7, { roughness: 0.56, warmth: 0.28 });

  if (traits.hasGiantTofu) {
    // Hilarious HUGE uncut/half-block tofu sticking proudly out of the bowl!!
    const mega = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.30, 0.36, 4, 0.05), tofuMat);
    mega.position.set(-0.04, 0.09, 0.02);
    mega.rotation.set(0.12, 0.35, -0.08);
    mega.castShadow = true;
    liquidGroup.add(mega);
  } else {
    const numCubes = 3;
    for (let i = 0; i < numCubes; i++) {
      const a = (i / numCubes) * Math.PI * 2 + 0.3;
      const cube = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.16, 3, 0.03), tofuMat);
      cube.position.set(Math.cos(a) * 0.20, 0.02, Math.sin(a) * 0.20);
      cube.rotation.y = a * 1.3;
      liquidGroup.add(cube);
    }
  }

  const wakCount = Math.min(6, Math.max(2, Math.round((traits.wakameCount || 3) * 0.6)));
  for (let i = 0; i < wakCount; i++) {
    const a = (i / wakCount) * Math.PI * 2 + 1.1;
    const w = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.04, 0.26, 3, 0.02), lushWakameMat);
    w.position.set(Math.cos(a) * 0.24, 0.015, Math.sin(a) * 0.24);
    w.rotation.y = -a;
    liquidGroup.add(w);
  }

  if (traits.hasFlower) {
    const fl = buildFlowerCarrotMesh();
    fl.scale.setScalar(0.72);
    fl.position.set(0.08, 0.035, -0.10);
    liquidGroup.add(fl);
  }
  if (traits.hasFu) {
    const fu = buildUzumakiFuMesh();
    fu.scale.setScalar(0.72);
    fu.position.set(-0.16, 0.03, 0.12);
    liquidGroup.add(fu);
  }
  if (traits.hasNegi) {
    for (let i = 0; i < 3; i++) {
      const n = buildNegiRingMesh();
      n.scale.setScalar(0.72);
      n.position.set((i - 1) * 0.14, 0.035, (i % 2) * 0.12 - 0.04);
      liquidGroup.add(n);
    }
  }

  bowl.userData.isBowl = true;
  bowl.userData.liquidGroup = liquidGroup;
  bowl.userData.liqMat = liqMat;
  bowl.userData.fillAmount = 0;
  bowl.userData.squash = new SquashSpring(220, 13);

  return bowl;
}

/**
 * Builds a cute tactile Clay Mini-Pot Replay Button on the counter corner
 * (zero text! shaped like a fresh shiny clay pot with a sky-blue water droplet on top)
 * that pops up after serving everyone so the child can cook a brand-new batch anytime!
 */
export function createReplayPotButton(scene) {
  const g = new THREE.Group();
  g.position.set(-1.38, 0.04, 1.38);
  g.visible = false;
  scene.add(g);

  const baseMat = clayMat(0xfff2dc, { roughness: 0.72, warmth: 0.22 });
  const potMat = clayMat(0xdf5638, { roughness: 0.65, warmth: 0.2 });
  const dropMat = clayMat(0x5ec8f8, { roughness: 0.3, warmth: 0.28 });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.10, 22), baseMat);
  pad.position.y = 0.05;
  pad.castShadow = true;
  pad.userData.isReplay = true;
  g.add(pad);

  const miniPot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 0.24, 20), potMat);
  miniPot.position.y = 0.22;
  miniPot.castShadow = true;
  miniPot.userData.isReplay = true;
  g.add(miniPot);

  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.028, 8, 12), potMat);
    h.position.set(s * 0.28, 0.24, 0);
    h.userData.isReplay = true;
    g.add(h);
  }

  // Shiny plump sky-blue water drop above mini pot
  const drop = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 14), dropMat);
  drop.position.y = 0.46;
  drop.userData.isReplay = true;
  g.add(drop);
  const dropBase = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), dropMat);
  dropBase.position.y = 0.38;
  dropBase.userData.isReplay = true;
  g.add(dropBase);

  return { group: g, squash: new SquashSpring(220, 12) };
}
