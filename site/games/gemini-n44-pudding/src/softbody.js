import * as THREE from '../vendor/three.module.js';

/**
 * Multi-mode Spring-Damper Soft-Body Physics Controller for the Pudding + Caramel Glaze.
 * Drives custom vertex-shader uniforms for real-time jelly shear, volume-preserving squash/bulge,
 * travelling surface ripples, twist wobble, and localized finger-poke indentation!
 */
export class PuddingSoftBody {
  constructor() {
    // Horizontal top bend (shear sway)
    this.bend = new THREE.Vector2(0, 0);
    this.bendVel = new THREE.Vector2(0, 0);

    // Secondary higher harmonic bend (creates realistic S-curve whip/lag!)
    this.bend2 = new THREE.Vector2(0, 0);
    this.bend2Vel = new THREE.Vector2(0, 0);

    // Vertical squash/stretch (volume preserved radially in shader)
    this.squash = 0;
    this.squashVel = 0;

    // Rotational twist wobble
    this.twist = 0;
    this.twistVel = 0;

    // Travelling surface jelly ripple
    this.rippleAmp = 0;
    this.ripplePhase = 0;
    this.rippleDir = new THREE.Vector2(1, 0);

    // Localized poke spring
    this.pokePos = new THREE.Vector3(0, 0.65, 0.65);
    this.pokeAmount = 0;
    this.pokeVel = 0;

    // Custard firmness (richer 2-egg custard is slightly firmer & snappier; 1-egg is silkier & wobblier)
    this.firmness = 1.0;

    // Scoop dent progress (0..1)
    this.scoopAmount = 0;
    this.targetScoop = 0;

    // Caramel glaze coverage (0..1) and drip length (0..1)
    this.caramelCover = 0;
    this.caramelDrip = 0;

    // Shared uniform dictionary attached to both pudding custard & caramel glaze shaders
    this.uniforms = {
      uBend: { value: new THREE.Vector2(0, 0) },
      uBend2: { value: new THREE.Vector2(0, 0) },
      uSquash: { value: 0 },
      uTwist: { value: 0 },
      uRippleAmp: { value: 0 },
      uRipplePhase: { value: 0 },
      uRippleDir: { value: new THREE.Vector2(1, 0) },
      uPokePos: { value: new THREE.Vector3(0, 0.65, 0.65) },
      uPokeAmount: { value: 0 },
      uPuddingHeight: { value: 1.18 },
      uScoopAmount: { value: 0 },
    };
  }

  setFirmness(f) {
    this.firmness = THREE.MathUtils.clamp(f, 0.78, 1.28);
  }

  reset() {
    this.bend.set(0, 0);
    this.bendVel.set(0, 0);
    this.bend2.set(0, 0);
    this.bend2Vel.set(0, 0);
    this.squash = 0;
    this.squashVel = 0;
    this.twist = 0;
    this.twistVel = 0;
    this.rippleAmp = 0;
    this.ripplePhase = 0;
    this.pokeAmount = 0;
    this.pokeVel = 0;
    this.scoopAmount = 0;
    this.targetScoop = 0;
    this.syncUniforms();
  }

  // Triggered on dramatic unmolding landing!
  impulseUnmold(strength = 1.0) {
    this.squash = -0.18 * strength;
    this.squashVel = -3.8 * strength;
    this.bendVel.set(2.35 * strength, -1.65 * strength);
    this.bend2Vel.set(-3.1 * strength, 2.2 * strength);
    this.twistVel = 2.6 * strength;
    this.rippleAmp = Math.min(0.11, this.rippleAmp + 0.085 * strength);
    this.rippleDir.set(0.78, 0.62).normalize();
  }

  // Triggered when poking or dragging the pudding directly with one finger
  impulsePoke(localPoint, dirX, dirZ, strength = 1.0) {
    this.pokePos.copy(localPoint);
    this.pokeVel += 5.4 * strength;
    this.bendVel.x += dirX * 3.8 * strength;
    this.bendVel.y += dirZ * 3.8 * strength;
    this.bend2Vel.x -= dirX * 2.9 * strength;
    this.bend2Vel.y -= dirZ * 2.9 * strength;
    this.squashVel -= 2.1 * strength;
    this.twistVel += (localPoint.z * dirX - localPoint.x * dirZ) * 2.8 * strength;
    this.rippleAmp = Math.min(0.11, this.rippleAmp + 0.062 * strength);
    const len = Math.hypot(dirX, dirZ);
    if (len > 0.01) this.rippleDir.set(dirX / len, dirZ / len);
  }

  // Gentle top wiggle when caramel ribbon hits the crown or plate vibrates
  impulseTopDrop(strength = 0.35) {
    this.squashVel -= 1.55 * strength;
    this.bendVel.x += (Math.random() - 0.5) * 1.4 * strength;
    this.bendVel.y += (Math.random() - 0.5) * 1.4 * strength;
    this.rippleAmp = Math.min(0.08, this.rippleAmp + 0.032 * strength);
  }

  // Continuous drag tension while finger holds and slides on the pudding
  applyDrag(dx, dz) {
    this.bendVel.x += dx * 22;
    this.bendVel.y += dz * 22;
    this.bend2Vel.x -= dx * 12;
    this.bend2Vel.y -= dz * 12;
    this.squashVel -= Math.hypot(dx, dz) * 3.5;
    this.rippleAmp = Math.min(0.095, this.rippleAmp + Math.hypot(dx, dz) * 0.25);
  }

  update(dt) {
    // Substep for rock-solid spring stability even during slow-mo transitions
    const clampedDt = Math.min(dt, 0.05);
    const steps = 3;
    const h = clampedDt / steps;

    const kBend = 148 * this.firmness;
    const cBend = 3.15;
    const kBend2 = 340 * this.firmness;
    const cBend2 = 4.6;
    const kSquash = 215 * this.firmness;
    const cSquash = 3.6;
    const kTwist = 175 * this.firmness;
    const cTwist = 3.8;
    const kPoke = 290 * this.firmness;
    const cPoke = 6.2;

    for (let i = 0; i < steps; i++) {
      // Primary shear mode
      const ax = -kBend * this.bend.x - cBend * this.bendVel.x;
      const ay = -kBend * this.bend.y - cBend * this.bendVel.y;
      this.bendVel.x += ax * h;
      this.bendVel.y += ay * h;
      this.bend.x += this.bendVel.x * h;
      this.bend.y += this.bendVel.y * h;

      // Secondary S-wave mode (coupled weakly to primary velocity for authentic jelly lag!)
      const a2x = -kBend2 * this.bend2.x - cBend2 * this.bend2Vel.x + this.bendVel.x * 16.0;
      const a2y = -kBend2 * this.bend2.y - cBend2 * this.bend2Vel.y + this.bendVel.y * 16.0;
      this.bend2Vel.x += a2x * h;
      this.bend2Vel.y += a2y * h;
      this.bend2.x += this.bend2Vel.x * h;
      this.bend2.y += this.bend2Vel.y * h;

      // Vertical squash/stretch mode
      const asq = -kSquash * this.squash - cSquash * this.squashVel;
      this.squashVel += asq * h;
      this.squash += this.squashVel * h;

      // Twist mode
      const atw = -kTwist * this.twist - cTwist * this.twistVel;
      this.twistVel += atw * h;
      this.twist += this.twistVel * h;

      // Localized finger poke spring
      const apk = -kPoke * this.pokeAmount - cPoke * this.pokeVel;
      this.pokeVel += apk * h;
      this.pokeAmount += this.pokeVel * h;
    }

    // Clamp extreme excursions to avoid self-intersection
    this.bend.x = THREE.MathUtils.clamp(this.bend.x, -0.38, 0.38);
    this.bend.y = THREE.MathUtils.clamp(this.bend.y, -0.38, 0.38);
    this.bend2.x = THREE.MathUtils.clamp(this.bend2.x, -0.18, 0.18);
    this.bend2.y = THREE.MathUtils.clamp(this.bend2.y, -0.18, 0.18);
    this.squash = THREE.MathUtils.clamp(this.squash, -0.28, 0.24);
    this.twist = THREE.MathUtils.clamp(this.twist, -0.34, 0.34);
    this.pokeAmount = THREE.MathUtils.clamp(this.pokeAmount, -0.16, 0.22);

    // Ripple propagation and smooth decay
    this.ripplePhase += clampedDt * 21.5 * Math.sqrt(this.firmness);
    this.rippleAmp *= Math.exp(-clampedDt * 2.15);
    if (this.rippleAmp < 0.0004) this.rippleAmp = 0;

    // Smooth scoop cavity blend
    this.scoopAmount += (this.targetScoop - this.scoopAmount) * Math.min(1, clampedDt * 8);

    this.syncUniforms();
  }

  syncUniforms() {
    this.uniforms.uBend.value.copy(this.bend);
    this.uniforms.uBend2.value.copy(this.bend2);
    this.uniforms.uSquash.value = this.squash;
    this.uniforms.uTwist.value = this.twist;
    this.uniforms.uRippleAmp.value = this.rippleAmp;
    this.uniforms.uRipplePhase.value = this.ripplePhase;
    this.uniforms.uRippleDir.value.copy(this.rippleDir);
    this.uniforms.uPokePos.value.copy(this.pokePos);
    this.uniforms.uPokeAmount.value = this.pokeAmount;
    this.uniforms.uScoopAmount.value = this.scoopAmount;
  }
}

/**
 * Slow-Motion Time Dilation Director
 * Smoothly dilates simulation time for culinary hero shots (egg crack, unmold purun!, caramel drizzle)
 */
export class SlowMoDirector {
  constructor() {
    this.scale = 1.0;
    this.targetScale = 1.0;
    this.holdTimer = 0;
    this.zoomBoost = 0; // 0..1 subtle studio camera macro push-in
  }

  trigger(scale = 0.24, holdSeconds = 1.15) {
    this.targetScale = scale;
    this.holdTimer = Math.max(this.holdTimer, holdSeconds);
  }

  update(rawDt) {
    if (this.holdTimer > 0) {
      this.holdTimer -= rawDt;
      if (this.holdTimer <= 0) {
        this.targetScale = 1.0;
      }
    }
    const rate = this.targetScale < this.scale ? 11.0 : 3.2;
    this.scale += (this.targetScale - this.scale) * Math.min(1, rawDt * rate);
    const targetZoom = THREE.MathUtils.clamp((1.0 - this.scale) / 0.78, 0, 1);
    this.zoomBoost += (targetZoom - this.zoomBoost) * Math.min(1, rawDt * 4.5);
    return this.scale;
  }
}
