import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { TakoyakiAudio } from './audio.js';
import { createAllTextures } from './textures.js';
import { createEnvironmentAndFX } from './environmentAndFX.js';
import { createHumans } from './humans.js';
import { createPanAndFood } from './panAndFood.js';

const container = document.getElementById('app');

// 1. Renderer (strictly capped pixelRatio <= 1.5 for >30fps on iPhone/iPad!)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
const getClampedPixelRatio = () => Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(getClampedPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.info.autoReset = false;
container.appendChild(renderer.domElement);

// 2. Scene & Procedural PBR Textures (all <= 1024px, zero external network assets)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x110a07);
scene.fog = new THREE.FogExp2(0x140c08, 0.34);

const textures = createAllTextures(renderer);
scene.environment = textures.envMap;

// 3. Camera — Table-height low-angle Over-The-Shoulder ("テーブルの高さのローアングル・肩越し")
// Frames sizzling iron pan + player 3D hand HUGE in foreground, Mom & Dad faces HUGE across table!
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.08, 6.0);

function updateCameraFraming() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // Portrait (iPhone): frames all 8 wells, side bowls, pendant light, player hand & Mom/Dad faces!
    const portraitFactor = THREE.MathUtils.clamp((0.85 - aspect) / 0.40, 0, 1);
    camera.fov = THREE.MathUtils.lerp(45, 58, portraitFactor);
    camera.position.set(
      -0.015,
      THREE.MathUtils.lerp(0.365, 0.41, portraitFactor),
      THREE.MathUtils.lerp(0.56, 0.69, portraitFactor)
    );
    camera.lookAt(0.0, 0.145, -0.11);
  } else {
    // Landscape / 4:3 (iPad & Desktop): table-height OTS low angle showing deep oiled wells + huge family faces!
    const narrowFactor = THREE.MathUtils.clamp((1.45 - aspect) / 0.55, 0, 1);
    camera.fov = THREE.MathUtils.lerp(40, 44, narrowFactor);
    camera.position.set(
      -0.02,
      0.355 + narrowFactor * 0.012,
      0.525 + narrowFactor * 0.045
    );
    camera.lookAt(0.0, 0.142, -0.11);
  }
  camera.updateProjectionMatrix();
}
updateCameraFraming();

// 4. World Systems
const audio = new TakoyakiAudio();
const fx = createEnvironmentAndFX(scene, textures);
const pan = createPanAndFood(scene, textures, fx, audio);
const humans = createHumans(scene, textures, fx, audio);

// Attach lifted takoyaki visual rig directly to the player's bamboo toothpick!
humans.playerHand.liftedBallAnchor.add(pan.liftedVisual.rig);

// Seed subtle initial life on pan so first glance already sizzles warmly with rising wisps of steam!
fx.spawnSteam(-0.04, pan.PAN_TOP_Y + 0.015, pan.PAN_Z, { size0: 0.03, size1: 0.10, alpha: 0.16 });
fx.spawnSteam(0.05, pan.PAN_TOP_Y + 0.015, pan.PAN_Z + 0.03, { size0: 0.025, size1: 0.09, alpha: 0.14 });

// 5. Post-Processing: Single-Pass DepthTexture Soft SSAO + Subtle Specular Bloom + OutputPass
// Reuses RenderPass depthTexture so the scene is NEVER rendered twice — 60fps & <150k triangles!
const pr = getClampedPixelRatio();
const rtWidth = Math.max(1, Math.floor(window.innerWidth * pr));
const rtHeight = Math.max(1, Math.floor(window.innerHeight * pr));

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pr);
composer.setSize(window.innerWidth, window.innerHeight);

function attachComposerDepthTextures(w, h) {
  const dt1 = new THREE.DepthTexture(w, h);
  dt1.type = THREE.UnsignedIntType;
  const dt2 = new THREE.DepthTexture(w, h);
  dt2.type = THREE.UnsignedIntType;
  composer.renderTarget1.depthTexture = dt1;
  composer.renderTarget2.depthTexture = dt2;
  composer.renderTarget1.dispose();
  composer.renderTarget2.dispose();
}
attachComposerDepthTextures(rtWidth, rtHeight);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Warm Physically-Grounded Screen-Space Ambient Occlusion (SSAO) ShaderPass
const SoftSSAOShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: composer.readBuffer.depthTexture },
    uResolution: { value: new THREE.Vector2(rtWidth, rtHeight) },
    uNear: { value: camera.near },
    uFar: { value: camera.far },
    uProjScale: { value: 1.0 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) },
    uIntensity: { value: 0.68 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform highp sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uNear;
    uniform float uFar;
    uniform float uProjScale;
    uniform float uIntensity;
    varying vec2 vUv;

    float linearizeDepth(float d) {
      float z = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }

    vec3 getViewPos(vec2 uv, float linZ) {
      vec2 ndcPos = uv * 2.0 - 1.0;
      float aspect = uResolution.x / max(1.0, uResolution.y);
      return vec3(ndcPos.x * aspect / uProjScale * linZ, ndcPos.y / uProjScale * linZ, -linZ);
    }

    void main() {
      vec4 baseCol = texture2D(tDiffuse, vUv);
      float rawD = texture2D(tDepth, vUv).x;
      if (rawD >= 0.9995) {
        gl_FragColor = vec4(baseCol.rgb, 1.0);
        return;
      }

      float centerZ = linearizeDepth(rawD);
      vec3 centerPos = getViewPos(vUv, centerZ);

      // Reconstruct smooth view-space normal from depth derivatives
      vec2 texel = 1.0 / uResolution;
      float zR = linearizeDepth(texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x);
      float zU = linearizeDepth(texture2D(tDepth, vUv + vec2(0.0, texel.y)).x);
      vec3 dPdx = getViewPos(vUv + vec2(texel.x, 0.0), zR) - centerPos;
      vec3 dPdy = getViewPos(vUv + vec2(0.0, texel.y), zU) - centerPos;
      vec3 viewNorm = normalize(cross(dPdx, dPdy));

      // Interleaved gradient noise per pixel for smooth Banding-Free soft shadows
      float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float rotAngle = ign * 6.2831853;
      float ca = cos(rotAngle);
      float sa = sin(rotAngle);
      mat2 rot = mat2(ca, -sa, sa, ca);

      float worldRadius = 0.036;
      float uvRadius = clamp((worldRadius * uProjScale) / max(0.15, centerZ) * 0.5, 0.003, 0.045);

      float occ = 0.0;
      for (int i = 0; i < 12; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 12.0) * uvRadius;
        float theta = fi * 2.3999632; // Golden angle Vogel disk
        vec2 offset = rot * (vec2(cos(theta), sin(theta)) * r);
        offset.x /= (uResolution.x / max(1.0, uResolution.y));

        float sampleRaw = texture2D(tDepth, clamp(vUv + offset, 0.001, 0.999)).x;
        float sampleZ = linearizeDepth(sampleRaw);
        vec3 samplePos = getViewPos(vUv + offset, sampleZ);
        vec3 diff = samplePos - centerPos;
        float dist = length(diff);
        vec3 dir = diff / max(0.0001, dist);

        float rangeCheck = smoothstep(0.0, 1.0, (worldRadius * 1.45) / max(0.001, abs(centerZ - sampleZ)));
        float ndotd = max(0.0, dot(viewNorm, dir) - 0.08);
        occ += ndotd * rangeCheck * (1.0 - clamp(dist / (worldRadius * 1.8), 0.0, 1.0));
      }

      float ao = clamp(1.0 - (occ / 12.0) * 2.35 * uIntensity, 0.28, 1.0);
      // Warm evening umber contact shadow tint (avoids cold muddy gray shadows on food & skin!)
      vec3 lit = mix(vec3(0.24, 0.13, 0.08) * baseCol.rgb, baseCol.rgb, ao);

      // Subtle HDR specular catchlight halo (only triggers on glints > 1.15: eye catchlights, hot oil, wet sauce, pendant bulb)
      vec3 specGlow = vec3(0.0);
      for (int b = 0; b < 8; b++) {
        float ang = float(b) * 0.785398;
        vec2 bOff = vec2(cos(ang), sin(ang)) * texel * 4.5;
        vec3 sCol = texture2D(tDiffuse, clamp(vUv + bOff, 0.001, 0.999)).rgb;
        float lum = dot(sCol, vec3(0.2126, 0.7152, 0.0722));
        specGlow += max(vec3(0.0), sCol - vec3(1.15)) * step(1.15, lum);
      }
      lit += (specGlow / 8.0) * 0.18;

      gl_FragColor = vec4(lit, 1.0);
    }
  `,
};

const ssaoPass = new ShaderPass(SoftSSAOShader);
composer.addPass(ssaoPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

window.addEventListener('resize', () => {
  const newPr = getClampedPixelRatio();
  renderer.setPixelRatio(newPr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCameraFraming();
  composer.setPixelRatio(newPr);
  composer.setSize(window.innerWidth, window.innerHeight);
  const rw = Math.max(1, Math.floor(window.innerWidth * newPr));
  const rh = Math.max(1, Math.floor(window.innerHeight * newPr));
  attachComposerDepthTextures(rw, rh);
  ssaoPass.uniforms.uResolution.value.set(rw, rh);
  ssaoPass.uniforms.uProjScale.value = 1.0 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
});

// 6. One-Finger Embodied Physical Interaction Controller (Zero UI, Zero Text, Magnetic Forgiveness)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const panPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pan.PAN_TOP_Y - 0.015);
const feedPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.16);
const hitPoint = new THREE.Vector3();

let activePointerId = null;
let pointerDown = false;
let currentGestureTool = null; // 'pitcher' | 'octopus' | 'topping' | 'oil' | 'pick' | 'sauce' | 'mayo' | 'bonito' | 'servePick' | 'steamSwipe'
let activePourWell = -1;
let liftedBall = null; // non-null while carrying a finished takoyaki on the bamboo pick!
let cheeseAnchorOrigin = null;
let lastPointerWorld = new THREE.Vector3();
let lastSwipedWell = -1;
let wellActionCooldown = new Float32Array(8);

// Gentle 10-second idle 3D hand nudge (runs at most ONCE per idle period, never steals agency!)
let idleSeconds = 0;
let idleDemoDone = false;
let idleDemoTimer = 0;

function screenToNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function findNearestWell(worldX, worldZ, maxDist = 0.068) {
  let best = -1;
  let bestD = maxDist;
  for (let i = 0; i < pan.wells.length; i++) {
    const w = pan.wells[i];
    const d = Math.hypot(worldX - w.x, worldZ - w.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function chooseContextualActionForWell(w) {
  // Natural intuitive progression when touching directly on a well!
  if (w.fill < 0.72) return 'pitcher';
  if (w.octopusCount === 0 && w.flipCount === 0) return 'octopus';
  if (w.flipCount < 2) return 'pick';
  if (w.sauceAmount < 0.75) return 'sauce';
  if (w.bonitoAmount < 0.5) return 'bonito';
  return 'servePick';
}

function syncRestingUtensilVisibility(tool) {
  pan.restingPickVisual.visible = tool !== 'pick';
  pan.restingOilBrush.visible = tool !== 'oil';
  pan.restingBrushStick.visible = tool !== 'sauce';
  pan.mayoPropGroup.visible = tool !== 'mayo';
}

function setHandToToolAt(tool, wx, wy, wz) {
  const h = humans.playerHand;
  h.mode = tool || 'idle';
  syncRestingUtensilVisibility(tool);

  if (tool === 'pitcher') {
    h.setHeldTool('none'); // Hand grips the 3D stainless pitcher's wooden handle!
    h.targetPos.set(wx + 0.118, wy + 0.095, wz + 0.025);
  } else if (tool === 'servePick') {
    h.setHeldTool('servePick');
    h.targetPos.set(wx + 0.102, wy - 0.012, wz + 0.032);
  } else if (tool && tool !== 'steamSwipe') {
    const visualKey = tool === 'topping' ? 'octopus' : tool;
    h.setHeldTool(visualKey);
    h.targetPos.set(wx + 0.018, wy + 0.068, wz + 0.035);
  } else {
    h.setHeldTool('none');
    h.targetPos.set(wx + 0.02, wy + 0.07, wz + 0.04);
  }
}

function applyToolToWell(tool, wIdx, dragDX = 0, dragDZ = -1, dt = 0.016) {
  if (wIdx < 0 || wIdx >= pan.wells.length) return;
  const w = pan.wells[wIdx];
  const h = humans.playerHand;

  humans.setInterestTarget(new THREE.Vector3(w.x, pan.PAN_TOP_Y + 0.02, w.z), 0.55);

  if (tool === 'pitcher') {
    activePourWell = wIdx;
    pan.pourBatterIntoWell(wIdx, dt);
    h.actionPulse = 0.7;
    return;
  }

  if (wellActionCooldown[wIdx] > 0) return;

  if (tool === 'octopus') {
    if (pan.dropOctopusIntoWell(wIdx)) {
      wellActionCooldown[wIdx] = 0.24;
      h.actionPulse = 1.0;
    }
  } else if (tool === 'topping') {
    pan.sprinkleToppingIntoWell(wIdx);
    wellActionCooldown[wIdx] = 0.26;
    h.actionPulse = 1.0;
  } else if (tool === 'oil') {
    pan.brushOilOnWell(wIdx);
    wellActionCooldown[wIdx] = 0.22;
    h.actionPulse = 0.9;
  } else if (tool === 'pick') {
    if (pan.flipWellWithPick(wIdx, dragDX, dragDZ)) {
      wellActionCooldown[wIdx] = 0.22;
      h.actionPulse = 1.0;
      h.flickAngle = (dragDX >= 0 ? 1 : -1) * 0.75;
    }
  } else if (tool === 'sauce') {
    if (pan.applySauceToWell(wIdx)) {
      wellActionCooldown[wIdx] = 0.18;
      h.actionPulse = 0.9;
    }
  } else if (tool === 'mayo') {
    if (pan.applyMayoToWell(wIdx)) {
      wellActionCooldown[wIdx] = 0.18;
      h.actionPulse = 0.9;
    }
  } else if (tool === 'bonito') {
    if (pan.sprinkleBonitoOnWell(wIdx)) {
      wellActionCooldown[wIdx] = 0.20;
      h.actionPulse = 0.95;
    }
  }
}

function onPointerDown(e) {
  if (activePointerId !== null) return; // Ignore extra multi-touch fingers cleanly!
  activePointerId = e.pointerId;
  pointerDown = true;
  idleSeconds = 0;
  idleDemoDone = false;
  idleDemoTimer = 0;

  audio.unlock();
  screenToNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(ndc, camera);

  // Check if touching a side prop bowl / utensil first
  const propHits = raycaster.intersectObjects(pan.propsHitables, false);
  const wellHits = raycaster.intersectObjects(pan.wellHitables, false);

  raycaster.ray.intersectPlane(panPlane, hitPoint);
  lastPointerWorld.copy(hitPoint);
  lastSwipedWell = -1;
  activePourWell = -1;

  // Wells ALWAYS take priority when touched directly so back-row wells are never blocked by background boat/bowls!
  if (propHits.length > 0 && wellHits.length === 0) {
    const pName = propHits[0].object.userData.propName;
    pan.pulseProp(pName);

    if (pName === 'boat') {
      // Tapping bamboo boat gently wobbles & lets Mom/Dad admire it
      audio.playBoatPlace();
      return;
    }

    currentGestureTool = pName;
    setHandToToolAt(currentGestureTool, hitPoint.x, pan.PAN_TOP_Y, hitPoint.z);

    // Immediate responsive feedback even on a quick tap of a bowl/pitcher!
    if (pName === 'pitcher') {
      const emptyIdx = pan.wells.findIndex((w) => w.fill < 0.75);
      const targetIdx = emptyIdx >= 0 ? emptyIdx : 0;
      activePourWell = targetIdx;
      const tw = pan.wells[targetIdx];
      setHandToToolAt('pitcher', tw.x, pan.PAN_TOP_Y, tw.z);
      pan.pourBatterIntoWell(targetIdx, 0.14);
    } else if (pName === 'octopus') {
      const cand = pan.wells.findIndex((w) => w.fill > 0.35 && w.octopusCount === 0);
      if (cand >= 0) {
        const tw = pan.wells[cand];
        setHandToToolAt('octopus', tw.x, pan.PAN_TOP_Y, tw.z);
        applyToolToWell('octopus', cand);
      }
    } else if (pName === 'topping') {
      const cand = pan.wells.findIndex((w) => w.fill > 0.35 && !w.hasCheese);
      if (cand >= 0) {
        const tw = pan.wells[cand];
        setHandToToolAt('topping', tw.x, pan.PAN_TOP_Y, tw.z);
        applyToolToWell('topping', cand);
      }
    } else if (pName === 'oil') {
      const tw = pan.wells[0];
      setHandToToolAt('oil', tw.x, pan.PAN_TOP_Y, tw.z);
      applyToolToWell('oil', 0);
    } else if (pName === 'sauce') {
      const cand = pan.wells.findIndex((w) => w.flipCount >= 2 && w.sauceAmount < 0.7);
      if (cand >= 0) {
        const tw = pan.wells[cand];
        setHandToToolAt('sauce', tw.x, pan.PAN_TOP_Y, tw.z);
        applyToolToWell('sauce', cand);
      }
    } else if (pName === 'mayo') {
      const cand = pan.wells.findIndex((w) => w.flipCount >= 2 && !w.hasMayo);
      if (cand >= 0) {
        const tw = pan.wells[cand];
        setHandToToolAt('mayo', tw.x, pan.PAN_TOP_Y, tw.z);
        applyToolToWell('mayo', cand);
      }
    } else if (pName === 'bonito') {
      const cand = pan.wells.findIndex((w) => w.flipCount >= 2 && w.bonitoAmount < 0.5);
      if (cand >= 0) {
        const tw = pan.wells[cand];
        setHandToToolAt('bonito', tw.x, pan.PAN_TOP_Y, tw.z);
        applyToolToWell('bonito', cand);
      }
    }
    return;
  }

  // Check well hit (with generous magnetic radius!)
  let wIdx = wellHits.length > 0 ? wellHits[0].object.userData.wellIndex : findNearestWell(hitPoint.x, hitPoint.z, 0.068);
  if (wIdx >= 0) {
    const w = pan.wells[wIdx];
    const autoTool = chooseContextualActionForWell(w);
    currentGestureTool = autoTool;

    if (autoTool === 'servePick') {
      const extracted = pan.extractBallFromWell(wIdx);
      if (extracted) {
        liftedBall = extracted;
        cheeseAnchorOrigin = extracted.hasCheese ? extracted.originPos.clone() : null;
        audio.playPickTurn(true);
        setHandToToolAt('servePick', w.x, pan.PAN_TOP_Y + 0.04, w.z);
      }
    } else if (autoTool === 'pick') {
      // Wait briefly for swipe direction OR flip immediately if tapped!
      lastSwipedWell = wIdx;
      setHandToToolAt('pick', w.x, pan.PAN_TOP_Y, w.z);
      applyToolToWell('pick', wIdx, 0.3, -1.0);
    } else {
      setHandToToolAt(autoTool, w.x, pan.PAN_TOP_Y, w.z);
      applyToolToWell(autoTool, wIdx, 0, -1, 0.09);
    }
  } else {
    // Touching open air / above pan -> interactive steam & dancing bonito swirl!
    currentGestureTool = 'steamSwipe';
  }
}

function onPointerMove(e) {
  if (!pointerDown || e.pointerId !== activePointerId) return;
  idleSeconds = 0;

  screenToNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(ndc, camera);

  // If carrying a finished steaming takoyaki on the bamboo pick, project across 3D space toward boat & Mom/Dad!
  if (currentGestureTool === 'servePick' && liftedBall) {
    // Blend between tabletop plane (lower screen) and vertical feeding plane near Mom & Dad (upper screen)!
    const upperScreen = THREE.MathUtils.clamp((ndc.y + 0.08) / 0.65, 0, 1);
    const pTable = new THREE.Vector3();
    const pFeed = new THREE.Vector3();
    raycaster.ray.intersectPlane(panPlane, pTable);
    raycaster.ray.intersectPlane(feedPlane, pFeed);

    const target = new THREE.Vector3(
      THREE.MathUtils.lerp(pTable.x, pFeed.x, upperScreen),
      THREE.MathUtils.lerp(pan.PAN_TOP_Y + 0.055, Math.max(0.12, pFeed.y), upperScreen),
      THREE.MathUtils.lerp(Math.max(-0.18, pTable.z), -0.22, upperScreen)
    );
    target.x = THREE.MathUtils.clamp(target.x, -0.32, 0.32);
    target.y = THREE.MathUtils.clamp(target.y, 0.08, 0.35);

    setHandToToolAt('servePick', target.x, target.y - 0.04, target.z);

    // Check if held right up to Mom's or Dad's mouth ("ふーっ、ふーっ → ぱくっ！")!
    const ballWorld = new THREE.Vector3();
    pan.liftedVisual.rig.getWorldPosition(ballWorld);
    for (const member of humans.family) {
      const mPos = humans.getMouthWorldPosition(member);
      if (ballWorld.distanceTo(mPos) < 0.115) {
        const started = humans.triggerFeedSequence(member, liftedBall, () => {
          pan.liftedVisual.rig.visible = false;
          liftedBall = null;
          cheeseAnchorOrigin = null;
          currentGestureTool = null;
          humans.playerHand.mode = 'idle';
          humans.playerHand.setHeldTool('none');
          humans.playerHand.targetPos.set(0.21, 0.145, 0.24);
        });
        if (started) break;
      }
    }
    return;
  }

  if (!raycaster.ray.intersectPlane(panPlane, hitPoint)) return;

  const dx = hitPoint.x - lastPointerWorld.x;
  const dz = hitPoint.z - lastPointerWorld.z;
  const moveDist = Math.hypot(dx, dz);

  if (currentGestureTool === 'steamSwipe' || ndc.y > 0.15) {
    if (moveDist > 0.004) {
      fx.addWindGust(dx * 8.5, 0.08, dz * 8.5);
    }
  }

  if (currentGestureTool && currentGestureTool !== 'steamSwipe') {
    const clampedX = THREE.MathUtils.clamp(hitPoint.x, -0.26, 0.26);
    const clampedZ = THREE.MathUtils.clamp(hitPoint.z, -0.14, 0.20);
    setHandToToolAt(currentGestureTool, clampedX, pan.PAN_TOP_Y, clampedZ);

    const wIdx = findNearestWell(hitPoint.x, hitPoint.z, 0.058);
    if (wIdx >= 0) {
      if (currentGestureTool === 'pitcher') {
        activePourWell = wIdx;
      } else if (currentGestureTool === 'pick') {
        if (wIdx !== lastSwipedWell || moveDist > 0.024) {
          lastSwipedWell = wIdx;
          applyToolToWell('pick', wIdx, dx, dz);
        }
      } else {
        applyToolToWell(currentGestureTool, wIdx, dx, dz);
      }
    } else if (currentGestureTool === 'pitcher') {
      activePourWell = -1;
    }
  }

  lastPointerWorld.copy(hitPoint);
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  pointerDown = false;
  activePourWell = -1;

  // Handle releasing a lifted takoyaki!
  if (currentGestureTool === 'servePick' && liftedBall) {
    // Check if Mom or Dad is already mid-"ふーっ" eating it!
    const eatingNow = humans.family.some((m) => m.mode === 'fuu');
    if (!eatingNow) {
      const ballWorld = new THREE.Vector3();
      pan.liftedVisual.rig.getWorldPosition(ballWorld);

      // Magnetic snap to Mom or Dad if released fairly close to their face, otherwise place neatly on Bamboo Boat!
      let fedSomeone = false;
      for (const member of humans.family) {
        const mPos = humans.getMouthWorldPosition(member);
        if (ballWorld.distanceTo(mPos) < 0.19) {
          fedSomeone = humans.triggerFeedSequence(member, liftedBall, () => {
            pan.liftedVisual.rig.visible = false;
            liftedBall = null;
            cheeseAnchorOrigin = null;
            humans.playerHand.mode = 'idle';
            humans.playerHand.setHeldTool('none');
            humans.playerHand.targetPos.set(0.21, 0.145, 0.24);
          });
          if (fedSomeone) {
            // Keep hand hovering graciously right near their mouth during the 0.6s "ふーっ、ぱくっ"!
            setHandToToolAt('servePick', mPos.x * 0.75, mPos.y - 0.03, mPos.z + 0.12);
            break;
          }
        }
      }

      if (!fedSomeone) {
        const boatFull = pan.placeBallOnBoat(liftedBall);
        if (boatFull) humans.celebratePlatter();
        pan.liftedVisual.rig.visible = false;
        liftedBall = null;
        cheeseAnchorOrigin = null;
      }
    }
  }

  if (!humans.family.some((m) => m.mode === 'fuu')) {
    currentGestureTool = null;
    syncRestingUtensilVisibility(null);
    humans.playerHand.mode = 'idle';
    humans.playerHand.setHeldTool('none');
    humans.playerHand.targetPos.set(0.21, 0.145, 0.24);
  }
}

const dom = renderer.domElement;
dom.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// 7. Main Simulation & Render Loop
let prevTimeMs = performance.now();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const nowMs = performance.now();
  const dt = Math.min((nowMs - prevTimeMs) * 0.001, 0.05);
  prevTimeMs = nowMs;
  elapsed += dt;

  for (let i = 0; i < 8; i++) {
    if (wellActionCooldown[i] > 0) wellActionCooldown[i] = Math.max(0, wellActionCooldown[i] - dt);
  }

  // Continuous pouring while holding finger over a well!
  const isPouringNow = pointerDown && currentGestureTool === 'pitcher' && activePourWell >= 0;
  if (isPouringNow) {
    const pw = pan.wells[activePourWell];
    pan.pourBatterIntoWell(activePourWell, dt);
    pan.updatePourVisual(true, new THREE.Vector3(pw.x, pan.PAN_TOP_Y + 0.005, pw.z));
    humans.setInterestTarget(new THREE.Vector3(pw.x, pan.PAN_TOP_Y + 0.02, pw.z), 0.65);
  } else {
    pan.updatePourVisual(false, null);
  }

  // Gentle 10-second idle 3D hand demonstration (runs ONCE after 10s of zero input, per preference rules!)
  if (!pointerDown && !liftedBall) {
    idleSeconds += dt;
    if (idleSeconds > 10.0 && !idleDemoDone) {
      idleDemoTimer += dt;
      const sampleWell = pan.wells.find((w) => w.fill < 0.7) || pan.wells[1];
      const hintTool = chooseContextualActionForWell(sampleWell);
      if (idleDemoTimer < 1.35) {
        const wave = Math.sin((idleDemoTimer / 1.35) * Math.PI);
        setHandToToolAt(
          hintTool === 'servePick' ? 'pick' : hintTool,
          THREE.MathUtils.lerp(0.18, sampleWell.x, wave * 0.82),
          pan.PAN_TOP_Y + 0.02,
          THREE.MathUtils.lerp(0.18, sampleWell.z, wave * 0.82)
        );
      } else {
        idleDemoDone = true;
        syncRestingUtensilVisibility(null);
        humans.playerHand.mode = 'idle';
        humans.playerHand.setHeldTool('none');
        humans.playerHand.targetPos.set(0.21, 0.145, 0.24);
      }
    }
  }

  // Update lifted takoyaki world position & melted cheese elastic strand!
  let offeredWorldPos = null;
  if (liftedBall && pan.liftedVisual.rig.visible) {
    offeredWorldPos = new THREE.Vector3();
    pan.liftedVisual.rig.getWorldPosition(offeredWorldPos);
    pan.updateCheeseStretch(Boolean(cheeseAnchorOrigin), cheeseAnchorOrigin, offeredWorldPos);
  } else {
    pan.updateCheeseStretch(false, null, null);
  }

  const heatActivity = pan.update(dt, elapsed, liftedBall);
  humans.update(dt, elapsed, offeredWorldPos);
  fx.update(dt, elapsed, camera, heatActivity);
  audio.update(dt, heatActivity, isPouringNow);

  renderer.info.reset();
  ssaoPass.uniforms.tDepth.value = composer.readBuffer.depthTexture;
  composer.render();
}

animate();

// Expose read-only runtime telemetry & test helpers for automated visual/perf verification
window.__takoyakiDebug = {
  getStats: () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    pixelRatio: renderer.getPixelRatio(),
    wells: pan.wells.map((w) => ({
      fill: Number(w.fill.toFixed(2)),
      octo: w.octopusCount,
      flips: w.flipCount,
      sauce: Number(w.sauceAmount.toFixed(2)),
      bonito: Number(w.bonitoAmount.toFixed(2)),
    })),
  }),
  scene,
  camera,
  renderer,
  composer,
  ssaoPass,
  outputPass,
  pan,
  humans,
  fx,
};
