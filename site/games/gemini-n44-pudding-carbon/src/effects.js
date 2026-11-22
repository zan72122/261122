import * as THREE from 'three';

/**
 * Dynamic laminar fluid pouring stream (Milk, Custard Batter, or Molten Caramel)
 * Connects spout world position to target landing position with Rayleigh surface ripples & tapering waist.
 */
export class LiquidStream {
  constructor(material) {
    this.radialSegs = 14;
    this.lenSegs = 28;
    const geo = new THREE.CylinderGeometry(1, 1, 1, this.radialSegs, this.lenSegs, false);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.visible = false;
    this.mesh.castShadow = true;
    this.phase = 0;
    this.flowAmount = 0;
    this._start = new THREE.Vector3();
    this._end = new THREE.Vector3();
  }

  setMaterial(mat) {
    this.mesh.material = mat;
  }

  update(dt, active, startWorld, endWorld, baseRadius = 0.024) {
    const targetFlow = active ? 1.0 : 0.0;
    this.flowAmount += (targetFlow - this.flowAmount) * Math.min(1, dt * 14);
    if (this.flowAmount < 0.02) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.phase += dt * 22.0;

    this._start.copy(startWorld);
    this._end.copy(endWorld);

    const posAttr = this.geo.attributes.position;
    const pos = posAttr.array;
    const cols = this.radialSegs + 1;

    // CylinderGeometry layout: (lenSegs + 1) rows of (radialSegs + 1) vertices + top/bottom caps
    const mainVertCount = (this.lenSegs + 1) * cols;
    for (let row = 0; row <= this.lenSegs; row++) {
      const t = row / this.lenSegs; // 0 top .. 1 bottom
      // Parabolic gravity curve with slight forward spout arc
      const arcHoriz = Math.sin(t * Math.PI) * 0.028;
      const cx = THREE.MathUtils.lerp(this._start.x, this._end.x, Math.pow(t, 0.85));
      const cz = THREE.MathUtils.lerp(this._start.z, this._end.z, Math.pow(t, 0.85)) + arcHoriz;
      const cy = THREE.MathUtils.lerp(this._start.y, this._end.y, t * t * 0.65 + t * 0.35);

      // Laminar stream narrows as velocity increases (r ~ (1 + 2.2*t)^-0.38) + subtle capillary wave
      const pinch = Math.sin(Math.min(1, this.flowAmount * 1.2) * Math.PI * 0.5);
      const wave = 1.0 + 0.11 * Math.sin(t * 18.0 - this.phase);
      const flareBottom = t > 0.9 ? (t - 0.9) * 5.5 : 0.0;
      const rad = baseRadius * pinch * Math.pow(1.0 + t * 2.1, -0.36) * wave * (1.0 + flareBottom);

      for (let c = 0; c < cols; c++) {
        const ang = (c / this.radialSegs) * Math.PI * 2;
        const idx = (row * cols + c) * 3;
        pos[idx] = cx + Math.cos(ang) * rad;
        pos[idx + 1] = cy;
        pos[idx + 2] = cz + Math.sin(ang) * rad;
      }
    }

    // Collapse end cap vertices cleanly to start & end centers
    for (let i = mainVertCount; i < posAttr.count; i++) {
      const isTop = i < mainVertCount + (posAttr.count - mainVertCount) / 2;
      const p = isTop ? this._start : this._end;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
    }

    posAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

/**
 * Rim-lit Slow-Motion Specular Micro-Droplets (for egg crack, purun landing, caramel & milk splashes)
 */
export class DropletSystem {
  constructor(defaultMaterial, count = 48) {
    this.count = count;
    this.group = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
    this.items = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(sphereGeo, defaultMaterial);
      mesh.visible = false;
      mesh.castShadow = false;
      this.group.add(mesh);
      this.items.push({
        mesh,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        radius: 0.01,
        floorY: 0.01,
      });
    }
    this.cursor = 0;
  }

  burst(origin, material, {
    count = 14,
    speed = 1.35,
    upBias = 1.2,
    radiusMin = 0.006,
    radiusMax = 0.017,
    floorY = 0.015,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const item = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.count;

      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const horiz = (0.35 + Math.random() * 0.85) * speed;
      item.mesh.material = material;
      item.mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.06,
        origin.y + Math.random() * 0.04,
        origin.z + (Math.random() - 0.5) * 0.06
      );
      item.vel.set(
        Math.cos(ang) * horiz,
        (0.55 + Math.random() * 0.9) * upBias * speed,
        Math.sin(ang) * horiz
      );
      item.radius = radiusMin + Math.random() * (radiusMax - radiusMin);
      item.age = 0;
      item.maxAge = 0.75 + Math.random() * 0.55;
      item.floorY = floorY;
      item.mesh.scale.setScalar(item.radius);
      item.mesh.visible = true;
    }
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (!it.mesh.visible) continue;
      it.age += dt;
      if (it.age >= it.maxAge) {
        it.mesh.visible = false;
        continue;
      }
      it.vel.y -= 6.8 * dt;
      it.mesh.position.addScaledVector(it.vel, dt);

      // Velocity elongation along flight path (authentic high-speed shutter look!)
      const spd = it.vel.length();
      const stretch = THREE.MathUtils.clamp(1 + spd * 0.16, 1.0, 1.85);
      const fade = 1.0 - THREE.MathUtils.smoothstep(it.age / it.maxAge, 0.65, 1.0);

      if (it.mesh.position.y <= it.floorY) {
        it.mesh.position.y = it.floorY;
        it.vel.y *= -0.22;
        it.vel.x *= 0.6;
        it.vel.z *= 0.6;
        it.mesh.scale.set(it.radius * 1.45 * fade, it.radius * 0.42 * fade, it.radius * 1.45 * fade);
      } else {
        it.mesh.scale.set(it.radius * fade, it.radius * stretch * fade, it.radius * fade);
      }
    }
  }
}

/**
 * Backlit Volumetric Studio Steam (hot rising wisps) & Cold Frost Mist (tabletop-hugging vapor)
 */
export class SteamMistSystem {
  constructor(steamTexture, count = 64) {
    this.count = count;
    this.group = new THREE.Group();
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    this.items = [];

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: steamTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
        color: new THREE.Color(0xfff8ee),
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.items.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 2.2,
        startScale: 0.15,
        endScale: 0.65,
        peakOpacity: 0.24,
        rotSpeed: 0,
        rot: 0,
        coldMode: false,
      });
    }
    this.cursor = 0;
  }

  emitHotSteam(origin, { radius = 0.18, opacity = 0.24, riseSpeed = 0.42, scale = 1.0 } = {}) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.count;

    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    it.mesh.position.set(
      origin.x + Math.cos(ang) * r,
      origin.y + Math.random() * 0.05,
      origin.z + Math.sin(ang) * r
    );
    it.vel.set(
      (Math.random() - 0.5) * 0.12,
      riseSpeed * (0.75 + Math.random() * 0.55),
      (Math.random() - 0.5) * 0.12
    );
    it.age = 0;
    it.maxAge = 1.8 + Math.random() * 1.1;
    it.startScale = 0.16 * scale;
    it.endScale = (0.58 + Math.random() * 0.28) * scale;
    it.peakOpacity = opacity;
    it.rot = Math.random() * Math.PI * 2;
    it.rotSpeed = (Math.random() - 0.5) * 0.8;
    it.coldMode = false;
    it.mat.color.setHex(0xfff6e9);
    it.mesh.visible = true;
  }

  emitColdMist(origin, { radius = 0.22, opacity = 0.26 } = {}) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.count;

    const ang = Math.random() * Math.PI * 2;
    const r = 0.08 + Math.random() * radius;
    it.mesh.position.set(
      origin.x + Math.cos(ang) * r,
      origin.y + 0.04 + Math.random() * 0.08,
      origin.z + Math.sin(ang) * r
    );
    // Cold vapor sinks slightly and rolls outward across the dark basalt tabletop!
    it.vel.set(
      Math.cos(ang) * (0.18 + Math.random() * 0.16),
      -0.06,
      Math.sin(ang) * (0.18 + Math.random() * 0.16)
    );
    it.age = 0;
    it.maxAge = 1.7 + Math.random() * 0.9;
    it.startScale = 0.18;
    it.endScale = 0.56;
    it.peakOpacity = opacity;
    it.rot = Math.random() * Math.PI * 2;
    it.rotSpeed = (Math.random() - 0.5) * 0.5;
    it.coldMode = true;
    it.mat.color.setHex(0xe8f5ff);
    it.mesh.visible = true;
  }

  update(dt, camera) {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (!it.mesh.visible) continue;
      it.age += dt;
      if (it.age >= it.maxAge) {
        it.mesh.visible = false;
        continue;
      }
      const p = it.age / it.maxAge;
      if (it.coldMode) {
        it.mesh.position.addScaledVector(it.vel, dt);
        it.vel.multiplyScalar(1 - dt * 0.8);
        if (it.mesh.position.y < 0.045) {
          it.mesh.position.y = 0.045;
          it.vel.y = 0;
        }
      } else {
        it.vel.x += Math.sin(it.age * 3.2 + i) * 0.08 * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
      }

      const sc = THREE.MathUtils.lerp(it.startScale, it.endScale, Math.pow(p, 0.72));
      it.mesh.scale.setScalar(sc);
      it.mesh.quaternion.copy(camera.quaternion);
      it.rot += it.rotSpeed * dt;
      it.mesh.rotateZ(it.rot);

      const fadeIn = THREE.MathUtils.smoothstep(p, 0.0, 0.22);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(p, 0.35, 1.0);
      it.mat.opacity = it.peakOpacity * fadeIn * fadeOut;
    }
  }
}
