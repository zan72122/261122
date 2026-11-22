import * as THREE from '../lib/three.module.js';

export class PotAndFluidSystem {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;

    this.potCenter = new THREE.Vector3(0, 0, 0.08);
    this.brothSurfaceY = 0.122;
    this.potRimY = 0.150;

    this.highFlame = false;      // toggled by stove knob
    this.boilLevel = 0.32;       // 0..1 dynamic boil vigor
    this.foamLevel = 0.08;       // rises when highFlame or lidded!
    this.umamiRichness = 0.0;    // deepens golden broth color as ingredients cook
    this.yuzuGlow = 0.0;
    this.swirlAngularVel = 0.0;  // fluid vortex from stirring
    this.lidClosed = false;
    this.lidAnimT = 0.0;         // 0 = on stand, 1 = on pot
    this.lidTargetClosed = false;

    this.splashes = [];          // active expanding surface ripples

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this._buildStoveAndPot();
    this._buildLid();
    this._buildBrothSurface();
    this._buildBubbles();
    this._buildSteam();
    this._buildLadle();
  }

  _buildStoveAndPot() {
    const tex = this.textures;
    const cx = this.potCenter.x, cz = this.potCenter.z;

    // 1. Sleek Slimline Japanese Cassette Konro (no text/labels!)
    const stoveGroup = new THREE.Group();
    stoveGroup.position.set(cx, 0, cz);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x262423,
      metalness: 0.72,
      roughness: 0.34,
      clearcoat: 0.35,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x151414,
      metalness: 0.85,
      roughness: 0.42,
    });

    const stoveBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.036, 0.29), bodyMat);
    stoveBase.position.y = 0.020;
    stoveBase.castShadow = true;
    stoveBase.receiveShadow = true;
    stoveGroup.add(stoveBase);

    // Cylindrical gas canister cover bulge on right side (classic slim konro silhouette)
    const canisterCover = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.285, 24), bodyMat);
    canisterCover.rotation.x = Math.PI / 2;
    canisterCover.position.set(0.155, 0.026, 0);
    canisterCover.castShadow = true;
    stoveGroup.add(canisterCover);

    // Brushed drip pan & 4 cast-iron trivet prongs (五徳)
    const dripPan = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.008, 32), trimMat);
    dripPan.position.set(-0.015, 0.040, 0);
    stoveGroup.add(dripPan);

    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.014, 0.010), trimMat);
      prong.position.set(-0.015 + Math.cos(ang) * 0.105, 0.046, Math.sin(ang) * 0.105);
      prong.rotation.y = -ang;
      stoveGroup.add(prong);
    }

    // Animated Blue-Amber Gas Flame Ring under the Donabe!
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(-0.015, 0.044, 0);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x3b8eff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameTipMat = new THREE.MeshBasicMaterial({
      color: 0xff8a2b,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flameMat = flameMat;
    this.flameTipMat = flameTipMat;

    for (let f = 0; f < 20; f++) {
      const a = (f / 20) * Math.PI * 2;
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.026, 8), f % 3 === 0 ? flameTipMat : flameMat);
      jet.position.set(Math.cos(a) * 0.078, 0.004, Math.sin(a) * 0.078);
      jet.rotation.z = -Math.cos(a) * 0.85;
      jet.rotation.x = Math.sin(a) * 0.85;
      this.flameGroup.add(jet);
    }
    stoveGroup.add(this.flameGroup);

    // Tactile Rotary Flame Knob on front-right of stove (chunky, inviting!)
    this.knobGroup = new THREE.Group();
    this.knobGroup.position.set(0.155, 0.032, 0.152);
    const knobCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 0.022, 24),
      new THREE.MeshPhysicalMaterial({ color: 0x382a24, roughness: 0.25, clearcoat: 0.7 })
    );
    knobCyl.rotation.x = Math.PI / 2;
    const knobGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.010, 0.038, 0.026),
      new THREE.MeshPhysicalMaterial({ color: 0xd96b27, roughness: 0.28, clearcoat: 0.6 })
    );
    knobGrip.position.z = 0.004;
    this.knobDial = new THREE.Group();
    this.knobDial.add(knobCyl, knobGrip);
    this.knobDial.rotation.z = -0.35;
    this.knobGroup.add(this.knobDial);

    // Generous invisible hitbox for effortless single-finger knob tap
    const knobHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    knobHit.name = 'stoveKnobHit';
    this.knobGroup.add(knobHit);
    this.knobHitMesh = knobHit;

    stoveGroup.add(this.knobGroup);
    this.root.add(stoveGroup);

    // 2. Sculpted Banko-yaki Earthenware Donabe (土鍋)
    const donabeGroup = new THREE.Group();
    donabeGroup.position.set(cx - 0.012, 0.046, cz);
    this.potCenter.set(cx - 0.012, 0, cz);

    // Lathe profile: unglazed terracotta/clay foot -> generous rounded belly -> thick glazed lip -> inner bowl
    const potPts = [
      new THREE.Vector2(0.000, 0.002),
      new THREE.Vector2(0.125, 0.002),
      new THREE.Vector2(0.168, 0.018),
      new THREE.Vector2(0.204, 0.056),
      new THREE.Vector2(0.208, 0.082),
      new THREE.Vector2(0.195, 0.098),
      new THREE.Vector2(0.202, 0.106), // outer rolled rim
      new THREE.Vector2(0.192, 0.111), // top of rim (world y = 0.046 + 0.111 = 0.157)
      new THREE.Vector2(0.178, 0.105), // lid rest ledge
      new THREE.Vector2(0.172, 0.095),
      new THREE.Vector2(0.164, 0.055),
      new THREE.Vector2(0.128, 0.022),
      new THREE.Vector2(0.000, 0.016),
    ];
    const potGeo = new THREE.LatheGeometry(potPts, 56);
    const donabeMat = new THREE.MeshPhysicalMaterial({
      map: tex.donabeMap,
      normalMap: tex.donabeNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: tex.donabeRough,
      roughness: 0.85,
      clearcoat: 0.88,
      clearcoatRoughness: 0.09,
    });
    const potMesh = new THREE.Mesh(potGeo, donabeMat);
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    potMesh.name = 'donabeBody';
    donabeGroup.add(potMesh);

    // Two sculpted ceramic loop handles (土鍋の耳)
    [-1, 1].forEach((side) => {
      const hCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.194, 0.068, -0.042),
        new THREE.Vector3(side * 0.236, 0.088, -0.028),
        new THREE.Vector3(side * 0.240, 0.092, 0.0),
        new THREE.Vector3(side * 0.236, 0.088, 0.028),
        new THREE.Vector3(side * 0.194, 0.068, 0.042),
      ]);
      const earGeo = new THREE.TubeGeometry(hCurve, 20, 0.0125, 12, false);
      const earMesh = new THREE.Mesh(earGeo, donabeMat);
      earMesh.castShadow = true;
      donabeGroup.add(earMesh);
    });

    this.donabeMat = donabeMat;
    this.donabeGroup = donabeGroup;
    this.root.add(donabeGroup);

    this.potRimY = 0.046 + 0.108;
    this.brothSurfaceY = 0.046 + 0.080; // 0.126m
  }

  _buildLid() {
    // Authentic heavy domed ceramic Donabe Lid with top handle & steam vent hole (蒸気穴)
    this.lidGroup = new THREE.Group();

    const lidPts = [
      new THREE.Vector2(0.012, 0.056), // inner edge around steam vent vibe
      new THREE.Vector2(0.055, 0.054),
      new THREE.Vector2(0.125, 0.038),
      new THREE.Vector2(0.180, 0.012),
      new THREE.Vector2(0.184, 0.002),
      new THREE.Vector2(0.174, 0.000),
      new THREE.Vector2(0.168, 0.008),
      new THREE.Vector2(0.012, 0.048),
    ];
    const lidGeo = new THREE.LatheGeometry(lidPts, 44);
      const lidMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.donabeMap,
      normalMap: this.textures.donabeNormal,
      roughness: 0.22,
      clearcoat: 0.88,
      clearcoatRoughness: 0.09,
      color: 0x302925, // matching dark glazed Banko-yaki ceramic lid!
    });
    const lidMesh = new THREE.Mesh(lidGeo, lidMat);
    lidMesh.castShadow = true;
    lidMesh.receiveShadow = true;
    this.lidGroup.add(lidMesh);

    // Arched bridge handle on top of lid
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.042, 0.050, 0),
      new THREE.Vector3(-0.032, 0.078, 0),
      new THREE.Vector3(0.0, 0.084, 0),
      new THREE.Vector3(0.032, 0.078, 0),
      new THREE.Vector3(0.042, 0.050, 0),
    ]);
    const lidHandle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 18, 0.010, 10, false), this.donabeMat);
    lidHandle.castShadow = true;
    this.lidGroup.add(lidHandle);

    // Dark recessed steam vent hole (蒸気穴)
    const ventHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.012, 14),
      new THREE.MeshBasicMaterial({ color: 0x0b0806 })
    );
    ventHole.position.set(0.055, 0.046, 0.045);
    ventHole.rotation.z = -0.22;
    this.lidGroup.add(ventHole);

    // Generous hitbox for tapping/dragging the lid
    const lidHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lidHit.position.y = 0.04;
    lidHit.name = 'donabeLidHit';
    this.lidGroup.add(lidHit);
    this.lidHitMesh = lidHit;

    // Rest Donabe Lid naturally flat on a woven trivet at back-left so zero overlap with zaru or Dad!
    this.lidRestPos = new THREE.Vector3(-0.44, 0.012, -0.06);
    this.lidPotPos = new THREE.Vector3(this.potCenter.x, this.potRimY - 0.006, this.potCenter.z);

    this.lidGroup.position.copy(this.lidRestPos);
    this.lidGroup.rotation.set(0.04, 0.35, -0.08);
    this.root.add(this.lidGroup);
  }

  _buildBrothSurface() {
    // High-resolution polar grid for real-time shallow-water waves + boiling displacement + foam
    const rings = 32, segs = 56;
    const maxR = 0.171;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r <= rings; r++) {
      const rf = (r / rings) * maxR;
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const x = Math.cos(a) * rf;
        const z = Math.sin(a) * rf;
        verts.push(x, 0, z);
        uvs.push((x / maxR) * 0.5 + 0.5, (z / maxR) * 0.5 + 0.5);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s;
        const b = a + segs + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    // Foam & oil attribute per vertex
    const foamAttr = new Float32Array(verts.length / 3);
    geo.setAttribute('aFoam', new THREE.BufferAttribute(foamAttr, 1));
    geo.computeVertexNormals();

    this.brothGeo = geo;
    this.brothBaseXZ = new Float32Array((verts.length / 3) * 2);
    for (let i = 0; i < verts.length / 3; i++) {
      this.brothBaseXZ[i * 2] = verts[i * 3];
      this.brothBaseXZ[i * 2 + 1] = verts[i * 3 + 2];
    }

    // Physical liquid golden konbu-katsuo dashi material with warm golden glow & wet reflections!
    const brothMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xd6841e),
      emissive: new THREE.Color(0x5c2e04),
      emissiveIntensity: 0.46,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.34,
      clearcoat: 0.68,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.88,
    });

    this.brothUniforms = {
      uTime: { value: 0 },
      uFoamLevel: { value: 0.1 },
      uUmami: { value: 0.0 },
      uYuzu: { value: 0.0 },
    };

    brothMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.brothUniforms.uTime;
      shader.uniforms.uFoamLevel = this.brothUniforms.uFoamLevel;
      shader.uniforms.uUmami = this.brothUniforms.uUmami;
      shader.uniforms.uYuzu = this.brothUniforms.uYuzu;

      shader.vertexShader = `
        attribute float aFoam;
        varying float vFoam;
        varying vec2 vBrothUv;
      ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vFoam = aFoam;
         vBrothUv = uv;`
      );

      shader.fragmentShader = `
        uniform float uTime;
        uniform float uFoamLevel;
        uniform float uUmami;
        uniform float uYuzu;
        varying float vFoam;
        varying vec2 vBrothUv;
      ` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec2 centered = (vBrothUv - 0.5) * 2.0;
         float rad = length(centered);
         // Rich deep golden-amber dashi in deep center, warm luminous honey-gold meniscus near black ceramic wall!
         vec3 deepDashi = mix(vec3(0.46, 0.23, 0.04), vec3(0.36, 0.16, 0.03), uUmami);
         vec3 midDashi  = mix(vec3(0.76, 0.44, 0.09), vec3(0.68, 0.34, 0.06), uUmami);
         vec3 rimDashi  = mix(vec3(0.95, 0.68, 0.22), vec3(0.88, 0.54, 0.14), uUmami);
         vec3 brothCol = mix(deepDashi, midDashi, smoothstep(0.0, 0.72, rad));
         diffuseColor.rgb = mix(brothCol, rimDashi, smoothstep(0.78, 0.99, rad));

         // Shimmering golden dashi/yuzu oil droplets drifting on broth surface
         float ang = atan(centered.y, centered.x);
         float oilCell = sin(rad * 52.0 - uTime * 2.0) * cos(ang * 16.0 + uTime * 0.7);
         float oilDrop = smoothstep(0.80 - uYuzu * 0.18, 0.96, oilCell);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.82, 0.28), oilDrop * (0.35 + uYuzu * 0.35));

         // Delicate translucent simmering foam lace ONLY at high-boil peaks & rim meniscus
         float frothNoise = 0.5 + 0.5 * sin(centered.x * 68.0 + uTime * 3.2) * cos(centered.y * 68.0 - uTime * 2.8);
         float lace = smoothstep(0.42, 0.88, frothNoise);
         float foamMask = clamp((vFoam * 0.65 * lace) + smoothstep(0.91, 0.995, rad) * (0.18 + uFoamLevel * 0.55) * lace, 0.0, 0.85);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.91, 0.76), foamMask * 0.75);
         diffuseColor.a = mix(0.76 + smoothstep(0.85, 0.0, rad) * 0.14, 0.94, foamMask);
        `
      );
    };

    this.brothMesh = new THREE.Mesh(geo, brothMat);
    this.brothMesh.position.set(this.potCenter.x, this.brothSurfaceY, this.potCenter.z);
    this.brothMesh.receiveShadow = true;
    this.brothMesh.name = 'brothSurface';
    this.root.add(this.brothMesh);
  }

  _buildBubbles() {
    // 110 translucent liquid-film boiling bubbles clustered along convection ring (never opaque white balls!)
    this.bubbleCount = 110;
    const bGeo = new THREE.SphereGeometry(1, 10, 8);
    const bMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4c97a,
      roughness: 0.02,
      ior: 1.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
    });
    this.bubbleInst = new THREE.InstancedMesh(bGeo, bMat, this.bubbleCount);
    this.bubbleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.bubbleInst);

    this.bubbles = [];
    for (let i = 0; i < this.bubbleCount; i++) {
      // Cluster around the gas burner convection ring (r ~ 0.065..0.135) & center hotspot
      const ringBias = i % 4 === 0 ? Math.random() * 0.05 : 0.065 + (Math.random() - 0.5) * 0.065;
      this.bubbles.push({
        r: ringBias,
        ang: Math.random() * Math.PI * 2,
        y: -0.04 + Math.random() * 0.04,
        size: 0.0020 + Math.random() * 0.0048,
        speed: 0.035 + Math.random() * 0.06,
        life: Math.random(),
      });
    }
    this._dummy = new THREE.Object3D();
  }

  _buildSteam() {
    // 95 fluid-advected soft volumetric-style steam wisps (pot + lid vent + ladle + bowls!)
    this.steamCount = 95;
    const sGeo = new THREE.PlaneGeometry(1, 1);
    const sMat = new THREE.MeshBasicMaterial({
      map: this.textures.steamMap,
      color: 0xfff5e8,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.steamParticles = [];
    this.steamGroup = new THREE.Group();
    this.scene.add(this.steamGroup);

    for (let i = 0; i < this.steamCount; i++) {
      const m = new THREE.Mesh(sGeo, sMat.clone());
      m.visible = false;
      this.steamGroup.add(m);
      this.steamParticles.push({
        mesh: m,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 1.0,
        maxAge: 2.2,
        startScale: 0.06,
        endScale: 0.26,
        maxOpacity: 0.20,
        rot: Math.random() * Math.PI * 2,
        rotVel: (Math.random() - 0.5) * 0.8,
      });
    }
    this._steamCursor = 0;
    this._steamEmitAccum = 0;
  }

  emitSteamPuff(origin, velBoost = null, scaleMul = 1.0, opacity = 0.22) {
    const p = this.steamParticles[this._steamCursor];
    this._steamCursor = (this._steamCursor + 1) % this.steamCount;
    p.pos.copy(origin);
    p.vel.set(
      (Math.random() - 0.5) * 0.045,
      0.095 + Math.random() * 0.075,
      (Math.random() - 0.5) * 0.045
    );
    if (velBoost) p.vel.add(velBoost);
    p.age = 0;
    p.maxAge = 1.8 + Math.random() * 1.1;
    p.startScale = (0.048 + Math.random() * 0.03) * scaleMul;
    p.endScale = (0.20 + Math.random() * 0.12) * scaleMul;
    p.maxOpacity = opacity;
    p.mesh.visible = true;
  }

  _buildLadle() {
    // Ceramic Ladle Rest (おたま立て) in warm Ame-yu amber pottery glaze!
    this.ladleRestPos = new THREE.Vector3(0.255, 0.056, 0.075);
    const restDish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.050, 0.038, 0.018, 28),
      new THREE.MeshPhysicalMaterial({
        map: this.textures.donabeMap,
        color: 0x7c4b27,
        roughness: 0.16,
        clearcoat: 0.92,
      })
    );
    restDish.position.set(this.ladleRestPos.x, 0.010, this.ladleRestPos.z);
    restDish.castShadow = true;
    restDish.receiveShadow = true;
    this.root.add(restDish);

    // Large, tactile Wooden/Glazed Nabe Ladle (おたま — scaled 1.28x for unmistakable affordance!)
    this.ladleGroup = new THREE.Group();
    this.ladleTiltGroup = new THREE.Group(); // inner pivot for pouring tilt
    this.ladleTiltGroup.scale.setScalar(1.26);
    this.ladleGroup.add(this.ladleTiltGroup);

    // Deep hemisphere ladle cup (radius 0.043m — generous & unmistakable!)
    const cupPts = [
      new THREE.Vector2(0.0, -0.026),
      new THREE.Vector2(0.024, -0.022),
      new THREE.Vector2(0.041, -0.008),
      new THREE.Vector2(0.045, 0.004),
      new THREE.Vector2(0.041, 0.005),
      new THREE.Vector2(0.037, -0.006),
      new THREE.Vector2(0.021, -0.019),
      new THREE.Vector2(0.0, -0.022),
    ];
    const cupGeo = new THREE.LatheGeometry(cupPts, 32);
    const ladleMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.woodMap,
      color: 0x8b4c24, // rich lacquered hinoki/urushi wooden ladle!
      roughness: 0.16,
      clearcoat: 0.95,
      clearcoatRoughness: 0.05,
    });
    const cupMesh = new THREE.Mesh(cupGeo, ladleMat);
    cupMesh.castShadow = true;
    this.ladleTiltGroup.add(cupMesh);

    // Long ergonomic angled wooden handle rising toward the player (+Z, +Y)
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.004, 0.040),
      new THREE.Vector3(0, 0.055, 0.095),
      new THREE.Vector3(0, 0.125, 0.155),
      new THREE.Vector3(0, 0.165, 0.192),
    ]);
    const handleGeo = new THREE.TubeGeometry(handleCurve, 20, 0.0075, 10, false);
    const handleMesh = new THREE.Mesh(handleGeo, ladleMat);
    handleMesh.castShadow = true;
    this.ladleTiltGroup.add(handleMesh);

    // Hook end on ladle handle
    const hookCap = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 10, 8), ladleMat);
    hookCap.position.set(0, 0.165, 0.192);
    this.ladleTiltGroup.add(hookCap);

    // Golden soup meniscus inside the ladle cup (scales with fillAmount 0..1!)
    this.ladleSoupMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.039, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xdf982e,
        roughness: 0.05,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.ladleSoupMesh.rotation.x = -Math.PI / 2;
    this.ladleSoupMesh.position.y = -0.002;
    this.ladleSoupMesh.visible = false;
    this.ladleTiltGroup.add(this.ladleSoupMesh);

    // Ingredient anchor inside ladle cup
    this.ladleHoldAnchor = new THREE.Object3D();
    this.ladleHoldAnchor.position.set(0, 0.004, 0);
    this.ladleTiltGroup.add(this.ladleHoldAnchor);

    // Glistening broth pour stream when pouring into a family bowl!
    const pourGeo = new THREE.CylinderGeometry(0.005, 0.011, 0.12, 12, 1, true);
    pourGeo.translate(0, -0.06, 0);
    this.pourStreamMesh = new THREE.Mesh(
      pourGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0xf0aa3c,
        roughness: 0.04,
        transmission: 0.65,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      })
    );
    this.pourStreamMesh.visible = false;
    this.scene.add(this.pourStreamMesh);

    // Generous invisible hitbox covering ladle cup + handle
    const ladleHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    ladleHit.position.set(0, 0.045, 0.075);
    ladleHit.name = 'ladleHit';
    this.ladleGroup.add(ladleHit);
    this.ladleHitMesh = ladleHit;

    this.ladleState = {
      held: false,
      fillAmount: 0,       // 0..1 golden soup in ladle
      carriedItems: [],    // simmered ingredient items riding in the ladle
      pouringT: 0,         // > 0 during pour animation
      pourTargetPos: new THREE.Vector3(),
    };

    this.ladleGroup.position.copy(this.ladleRestPos);
    this.ladleGroup.rotation.set(0.16, -0.78, 0.12);
    this.scene.add(this.ladleGroup);
  }

  updateLayoutForAspect(aspect) {
    const isPortrait = aspect < 0.85;
    this.ladleRestPos.set(isPortrait ? 0.215 : 0.255, 0.056, isPortrait ? 0.09 : 0.075);
    this.lidRestPos.set(isPortrait ? -0.26 : -0.44, 0.012, -0.06);
    if (!this.ladleState.held && this.ladleState.pouringT <= 0) {
      this.ladleGroup.position.copy(this.ladleRestPos);
    }
    if (!this.lidClosed && this.lidAnimT < 0.01) {
      this.lidGroup.position.copy(this.lidRestPos);
    }
  }

  toggleFlame() {
    this.highFlame = !this.highFlame;
    return this.highFlame;
  }

  toggleLid(audio) {
    this.lidTargetClosed = !this.lidTargetClosed;
    if (!this.lidTargetClosed && this.lidClosed) {
      // Opening hot lid -> huge dramatic billow of fragrant white steam!
      for (let k = 0; k < 18; k++) {
        this.emitSteamPuff(
          new THREE.Vector3(
            this.potCenter.x + (Math.random() - 0.5) * 0.22,
            this.potRimY + 0.02,
            this.potCenter.z + (Math.random() - 0.5) * 0.22
          ),
          new THREE.Vector3((Math.random() - 0.5) * 0.14, 0.14 + Math.random() * 0.12, (Math.random() - 0.5) * 0.14),
          1.45,
          0.34
        );
      }
      if (audio) audio.playSteamBurst();
    } else if (audio) {
      audio.playCeramicClink(0.75);
    }
    this.lidClosed = this.lidTargetClosed;
  }

  addSplash(localX, localZ, strength = 1.0) {
    this.splashes.push({ x: localX, z: localZ, age: 0, strength });
    if (this.splashes.length > 6) this.splashes.shift();

    // Burst of warm steam & droplets on splash
    for (let i = 0; i < 5; i++) {
      this.emitSteamPuff(
        new THREE.Vector3(this.potCenter.x + localX, this.brothSurfaceY + 0.02, this.potCenter.z + localZ),
        new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.08, (Math.random() - 0.5) * 0.08),
        0.9,
        0.22
      );
    }
  }

  triggerYuzuAroma() {
    this.yuzuGlow = 1.0;
    for (let i = 0; i < 10; i++) {
      this.emitSteamPuff(
        new THREE.Vector3(this.potCenter.x + (Math.random() - 0.5) * 0.16, this.brothSurfaceY + 0.02, this.potCenter.z + (Math.random() - 0.5) * 0.16),
        new THREE.Vector3(0, 0.12, 0),
        1.1,
        0.26
      );
    }
  }

  sampleWaveHeight(lx, lz, elapsed) {
    const r = Math.hypot(lx, lz);
    const boilDome = (
      Math.sin(lx * 38 + elapsed * 7.5) * Math.cos(lz * 38 - elapsed * 6.8) +
      Math.sin((lx + lz) * 52 - elapsed * 9.2) * 0.6
    ) * (0.0022 + this.boilLevel * 0.0058) * Math.max(0, 1 - r / 0.18);

    let ripple = 0;
    for (const sp of this.splashes) {
      const d = Math.hypot(lx - sp.x, lz - sp.z);
      const waveFront = sp.age * 0.38;
      const env = Math.exp(-Math.abs(d - waveFront) * 28) * Math.exp(-sp.age * 3.2);
      ripple += Math.sin((d - waveFront) * 85) * 0.011 * sp.strength * env;
    }
    return boilDome + ripple;
  }

  update(dt, elapsed, camera, potIngredientsCount = 0, avgCook = 0) {
    // 1. Flame & Boil dynamics
    const targetKnobZ = this.highFlame ? 0.55 : -0.35;
    this.knobDial.rotation.z += (targetKnobZ - this.knobDial.rotation.z) * Math.min(1, dt * 10);

    const targetBoil = (this.highFlame ? 0.92 : 0.38) + (this.lidClosed ? 0.18 : 0);
    this.boilLevel += (Math.min(1.0, targetBoil) - this.boilLevel) * Math.min(1, dt * 1.4);

    // Rich umami color deepens as ingredients simmer
    const targetUmami = Math.min(1.0, potIngredientsCount * 0.12 + avgCook * 0.65);
    this.umamiRichness += (targetUmami - this.umamiRichness) * Math.min(1, dt * 0.5);
    this.yuzuGlow = Math.max(0, this.yuzuGlow - dt * 0.08);

    // Exciting frothy foam swells up when highFlame is left running, calmed by stirring!
    const targetFoam = this.highFlame ? (0.58 + (this.lidClosed ? 0.3 : 0)) : 0.12;
    this.foamLevel += (targetFoam - this.foamLevel) * Math.min(1, dt * 0.7);
    this.foamLevel = Math.max(0.05, this.foamLevel - Math.abs(this.swirlAngularVel) * dt * 0.25);

    this.swirlAngularVel *= Math.exp(-dt * 2.2);

    // Animate blue-amber gas flame ring
    const fScale = this.highFlame ? 1.38 : 0.85;
    this.flameGroup.children.forEach((jet, idx) => {
      const flick = 1 + Math.sin(elapsed * 26 + idx * 2.3) * 0.16;
      jet.scale.set(1, fScale * flick, 1);
    });
    this.flameMat.opacity = this.highFlame ? 0.95 : 0.68;
    this.flameTipMat.opacity = this.highFlame ? 0.85 : 0.35;

    // 2. Lid position & steaming "kata-kata" rattle when closed!
    const targetLidT = this.lidTargetClosed ? 1.0 : 0.0;
    this.lidAnimT += (targetLidT - this.lidAnimT) * Math.min(1, dt * 7.5);
    this.lidGroup.position.lerpVectors(this.lidRestPos, this.lidPotPos, this.lidAnimT);

    const restQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0.35, -0.08));
    const rattleX = this.lidAnimT > 0.95 ? Math.sin(elapsed * 34) * 0.018 * this.boilLevel : 0;
    const rattleZ = this.lidAnimT > 0.95 ? Math.cos(elapsed * 29) * 0.018 * this.boilLevel : 0;
    const potQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rattleX, 0, rattleZ));
    this.lidGroup.quaternion.slerpQuaternions(restQuat, potQuat, this.lidAnimT);

    // 3. Update splashes & 2.5D Broth Surface Mesh
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].age += dt;
      if (this.splashes[i].age > 1.8) this.splashes.splice(i, 1);
    }

    const posAttr = this.brothGeo.attributes.position;
    const foamAttr = this.brothGeo.attributes.aFoam;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = this.brothBaseXZ[i * 2];
      const lz = this.brothBaseXZ[i * 2 + 1];
      const h = this.sampleWaveHeight(lx, lz, elapsed) + this.foamLevel * 0.012;
      posAttr.setY(i, h);
      const peakFoam = Math.max(0, h * 95) * this.boilLevel + this.foamLevel * 0.55;
      foamAttr.setX(i, Math.min(1, peakFoam));
    }
    posAttr.needsUpdate = true;
    foamAttr.needsUpdate = true;
    this.brothGeo.computeVertexNormals();

    this.brothUniforms.uTime.value = elapsed;
    this.brothUniforms.uFoamLevel.value = this.foamLevel;
    this.brothUniforms.uUmami.value = this.umamiRichness;
    this.brothUniforms.uYuzu.value = this.yuzuGlow;

    // 4. Update 3D Rising & Popping Broth Bubbles
    const dummy = this._dummy;
    for (let i = 0; i < this.bubbleCount; i++) {
      const b = this.bubbles[i];
      b.life += dt * (0.65 + this.boilLevel * 1.9);
      b.ang += this.swirlAngularVel * 0.9 * dt;
      if (b.life >= 1.0) {
        b.life = 0;
        b.r = 0.015 + Math.random() * 0.145;
        b.ang = Math.random() * Math.PI * 2;
        b.size = (0.0028 + Math.random() * 0.0062) * (0.75 + this.boilLevel * 0.65);
      }
      const riseY = this.brothSurfaceY - 0.032 + Math.min(0.036, b.life * 0.048) + this.foamLevel * 0.012;
      const popScale = b.life > 0.85 ? (1.0 + (b.life - 0.85) * 3.2) * (1.0 - (b.life - 0.85) / 0.15) : Math.min(1, b.life * 4.0);
      const wobbleR = b.r + Math.sin(elapsed * 9 + i) * 0.003;

      dummy.position.set(
        this.potCenter.x + Math.cos(b.ang) * wobbleR,
        riseY,
        this.potCenter.z + Math.sin(b.ang) * wobbleR
      );
      const s = b.size * Math.max(0.0001, popScale) * (this.lidAnimT > 0.92 ? 0.2 : 1.0);
      dummy.scale.set(s, s * 0.78, s);
      dummy.updateMatrix();
      this.bubbleInst.setMatrixAt(i, dummy.matrix);
    }
    this.bubbleInst.instanceMatrix.needsUpdate = true;

    // 5. Continuous Fluid-Advected Steam Emission & Update
    const emitRate = this.lidAnimT > 0.9
      ? 14 + this.boilLevel * 16   // concentrated jet out of lid steam vent!
      : 10 + this.boilLevel * 18;
    this._steamEmitAccum += dt * emitRate;
    while (this._steamEmitAccum >= 1.0) {
      this._steamEmitAccum -= 1.0;
      if (this.lidAnimT > 0.9) {
        //Focused puff right from the lid's steam vent hole!
        this.emitSteamPuff(
          new THREE.Vector3(this.potCenter.x + 0.055, this.potRimY + 0.046, this.potCenter.z + 0.045),
          new THREE.Vector3(0.035, 0.16 + this.boilLevel * 0.12, 0.02),
          0.72,
          0.28
        );
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 0.14;
        this.emitSteamPuff(
          new THREE.Vector3(
            this.potCenter.x + Math.cos(a) * r,
            this.brothSurfaceY + 0.015,
            this.potCenter.z + Math.sin(a) * r
          ),
          new THREE.Vector3(-Math.sin(a) * this.swirlAngularVel * 0.02, 0.04 + this.boilLevel * 0.09, Math.cos(a) * this.swirlAngularVel * 0.02),
          1.15 + this.boilLevel * 0.45,
          0.22 + this.boilLevel * 0.16
        );
      }
    }

    // Also emit delicate steam from a filled ladle!
    if (this.ladleState.fillAmount > 0.3 && Math.random() < dt * 7) {
      const wp = new THREE.Vector3();
      this.ladleHoldAnchor.getWorldPosition(wp);
      this.emitSteamPuff(wp, new THREE.Vector3(0, 0.04, 0), 0.55, 0.16);
    }

    for (const p of this.steamParticles) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.mesh.visible = false;
        continue;
      }
      const t = p.age / p.maxAge;
      // Curl-like thermal buoyancy drift
      p.vel.x += Math.sin(elapsed * 1.8 + p.pos.y * 11) * 0.045 * dt;
      p.vel.z += Math.cos(elapsed * 1.5 + p.pos.y * 9) * 0.035 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.rotVel * dt;

      p.mesh.position.copy(p.pos);
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.rotateZ(p.rot);
      const sc = p.startScale + (p.endScale - p.startScale) * Math.pow(t, 0.75);
      p.mesh.scale.setScalar(sc);
      const fadeIn = Math.min(1, t * 4.5);
      const fadeOut = Math.pow(1 - t, 1.6);
      p.mesh.material.opacity = p.maxOpacity * fadeIn * fadeOut;
    }

    // 6. Ladle Soup Meniscus & Carried Ingredients sync
    const ls = this.ladleState;
    if (ls.fillAmount > 0.02) {
      this.ladleSoupMesh.visible = true;
      const s = 0.55 + 0.45 * ls.fillAmount;
      this.ladleSoupMesh.scale.setScalar(s);
      this.ladleSoupMesh.position.y = -0.016 + ls.fillAmount * 0.015;
    } else {
      this.ladleSoupMesh.visible = false;
    }

    // Keep carried items nestled inside the ladle cup!
    if (ls.carriedItems.length > 0) {
      const cupWorld = new THREE.Vector3();
      const cupQuat = new THREE.Quaternion();
      this.ladleHoldAnchor.getWorldPosition(cupWorld);
      this.ladleHoldAnchor.getWorldQuaternion(cupQuat);
      ls.carriedItems.forEach((it, idx) => {
        const off = new THREE.Vector3((idx - (ls.carriedItems.length - 1) * 0.5) * 0.022, 0.004 + idx * 0.005, 0);
        off.applyQuaternion(cupQuat);
        it.mesh.position.copy(cupWorld).add(off);
        it.mesh.scale.setScalar(0.82);
      });
    }
  }
}
