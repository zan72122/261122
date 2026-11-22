import * as THREE from 'three';
import { createPlasterWallTexture } from './textures.js';

/**
 * Winter rainy night window with:
 * - Multi-layered out-of-focus photographic bokeh city lights (warm sodium streetlamps,
 *   apartment glow, red tail lights, cool cyan/blue night lights) with depth parallax
 * - Streaming raindrops & meandering wet glass trails refracting city lights behind them
 * - Dynamic condensation fog driven by pot boiling level, which the child can wipe
 *   clear with a single finger!
 * - Framed by dark Japanese timber mullions, warm plaster walls, & soft linen curtains.
 */
export function createWinterWindow(scene, woodMat) {
  const group = new THREE.Group();

  // Interactive condensation fog canvas (256x128: white = foggy condensation, black = wiped clear)
  const fogW = 256;
  const fogH = 128;
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = fogW;
  fogCanvas.height = fogH;
  const fogCtx = fogCanvas.getContext('2d');
  fogCtx.fillStyle = '#383838'; // light natural winter mist around edges initially
  fogCtx.fillRect(0, 0, fogW, fogH);

  const fogTex = new THREE.CanvasTexture(fogCanvas);
  fogTex.minFilter = THREE.LinearFilter;
  fogTex.magFilter = THREE.LinearFilter;

  const windowUniforms = {
    uTime: { value: 0 },
    uCameraPan: { value: 0 },
    uFogLevel: { value: 0.28 },
    uFogMask: { value: fogTex },
  };

  const windowShaderMat = new THREE.ShaderMaterial({
    uniforms: windowUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uCameraPan;
      uniform float uFogLevel;
      uniform sampler2D uFogMask;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      // Single raindrop layer with sliding drop + lingering trail droplets
      vec3 rainLayer(vec2 uv, float t, vec2 grid, float seed) {
        vec2 st = uv * grid;
        vec2 id = floor(st);
        float colShift = hash12(vec2(id.x + seed * 17.0, seed * 3.1));
        st.y += t * (0.38 + colShift * 0.34) + colShift * 12.0;

        id = floor(st);
        vec2 gv = fract(st) - 0.5;
        float n = hash12(id + seed * 53.0);

        // Horizontal meandering wiggle
        float wiggle = sin(uv.y * 22.0 + n * 19.0 + sin(uv.y * 9.0 + n * 7.0)) * 0.18;
        float x = (n - 0.5) * 0.58 + wiggle;
        // Stop-and-go gravity slip
        float slip = sin(t * (0.9 + n * 0.6) + n * 6.2831);
        float y = -0.35 + (0.5 + 0.5 * sin(t * 0.75 + n * 6.28 + slip * 0.55)) * 0.68;

        vec2 aspect = vec2(grid.y / grid.x, 1.0);
        vec2 dropPos = (gv - vec2(x, y)) / aspect;
        float d = length(dropPos);
        // Teardrop squash
        float dropMask = smoothstep(0.115, 0.045, d);

        // Trail beads left above the moving raindrop
        vec2 trailPos = (gv - vec2(x, y)) / aspect;
        float trailY = clamp(trailPos.y, 0.0, 0.65);
        float trailMask = 0.0;
        if (gv.y > y) {
          float beadGrid = fract(uv.y * grid.y * 5.2 + n * 11.0) - 0.5;
          vec2 beadPos = vec2((gv.x - x) / aspect.x, beadGrid * 0.12);
          float bd = length(beadPos);
          float fade = smoothstep(0.55, 0.02, gv.y - y);
          trailMask = smoothstep(0.055, 0.015, bd) * fade * 0.75;
        }

        // Refraction normal offset
        vec2 normalOff = dropPos * dropMask * 2.4 + vec2((gv.x - x) * trailMask * 0.7, 0.0);
        float mask = max(dropMask, trailMask);
        return vec3(normalOff, mask);
      }

      // Out-of-focus photographic bokeh city background
      vec3 sampleCityBokeh(vec2 uv, float blurExtra) {
        // Deep winter night sky gradient
        vec3 skyTop = vec3(0.028, 0.048, 0.105);
        vec3 skyMid = vec3(0.055, 0.088, 0.175);
        vec3 horizonGlow = vec3(0.145, 0.118, 0.135);
        vec3 col = mix(horizonGlow, skyMid, smoothstep(0.08, 0.55, uv.y));
        col = mix(col, skyTop, smoothstep(0.45, 0.96, uv.y));

        // Distant soft dark city roofline silhouette
        float bldgX = floor(uv.x * 16.0);
        float bldgH = 0.24 + hash12(vec2(bldgX, 4.1)) * 0.28;
        float inBldg = smoothstep(bldgH + 0.04, bldgH - 0.03, uv.y);
        col = mix(col, vec3(0.022, 0.032, 0.062), inBldg * 0.65);

        // 3 depth layers of lush photographic bokeh discs
        for (int layer = 0; layer < 3; layer++) {
          float fl = float(layer);
          float parallax = (0.14 + fl * 0.10) * uCameraPan;
          vec2 scale = (layer == 0) ? vec2(11.0, 6.0) : ((layer == 1) ? vec2(7.0, 4.0) : vec2(4.6, 2.8));
          vec2 p = vec2(uv.x + parallax, uv.y) * scale;
          vec2 cell = floor(p);
          vec2 f = fract(p);

          for (int oy = -1; oy <= 1; oy++) {
            for (int ox = -1; ox <= 1; ox++) {
              vec2 nb = cell + vec2(float(ox), float(oy));
              vec2 rnd = hash22(nb + fl * 31.7);
              float prob = (layer == 2) ? 0.58 : 0.48;
              if (rnd.x > prob) continue;

              // Concentrate lights in lower 72% of window (city skyline & street level)
              float worldY = (nb.y + rnd.y) / scale.y;
              if (worldY > 0.78 || worldY < 0.04) continue;

              vec2 center = vec2(float(ox), float(oy)) + 0.18 + rnd * 0.64;
              vec2 delta = (f - center) * vec2(1.0, scale.x / scale.y * 0.52);
              float dist = length(delta);

              float baseR = ((layer == 2) ? 0.42 : ((layer == 1) ? 0.30 : 0.21)) + blurExtra * 0.16;
              float r = baseR * (0.65 + hash12(nb + 7.3) * 0.55);

              // Realistic camera bokeh disc with soft luminous outer ring
              float disc = smoothstep(r, r * 0.52, dist);
              float ring = smoothstep(r * 0.48, r * 0.84, dist) * smoothstep(r * 1.02, r * 0.86, dist);
              float bokeh = disc * (0.68 + ring * 0.55);

              // Rich Japanese winter night city light palette
              float cRnd = hash12(nb + fl * 13.3 + 2.9);
              vec3 bCol;
              if (cRnd < 0.44) {
                bCol = vec3(1.0, 0.68, 0.28); // warm amber sodium streetlamp
              } else if (cRnd < 0.70) {
                bCol = vec3(1.0, 0.87, 0.62); // warm cozy apartment window
              } else if (cRnd < 0.84) {
                bCol = vec3(0.42, 0.74, 1.0); // cool winter station/office glow
              } else if (cRnd < 0.94) {
                bCol = vec3(1.0, 0.26, 0.20); // wet red traffic / tail light
              } else {
                bCol = vec3(0.45, 0.95, 0.72); // green signal glow
              }

              float twinkle = 0.86 + 0.14 * sin(uTime * (1.2 + rnd.y * 2.5) + rnd.x * 30.0);
              float intensity = (layer == 2 ? 0.72 : (layer == 1 ? 0.58 : 0.46)) * twinkle;
              col += bCol * bokeh * intensity;
            }
          }
        }
        return col;
      }

      void main() {
        vec2 uv = vUv;

        // Combine 3 raindrop trail layers at different scales
        vec3 r1 = rainLayer(uv, uTime * 0.65, vec2(15.0, 7.5), 1.0);
        vec3 r2 = rainLayer(uv + vec2(0.37, 0.19), uTime * 0.92, vec2(26.0, 12.0), 2.0);
        vec3 r3 = rainLayer(uv + vec2(0.71, 0.53), uTime * 0.42, vec2(10.0, 5.2), 3.0);

        vec2 refr = r1.xy * 0.048 + r2.xy * 0.028 + r3.xy * 0.062;
        float dropMask = clamp(r1.z + r2.z * 0.75 + r3.z * 0.9, 0.0, 1.0);

        // Condensation mist mask: edge frost + boiling fog * wipeable canvas mask
        float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        float edgeFrost = smoothstep(0.24, 0.0, edgeDist) * 0.45;
        float wiped = texture2D(uFogMask, uv).r; // 0 = wiped clear, 1 = full mist
        float mist = clamp((wiped * uFogLevel + edgeFrost * wiped) * (1.0 - dropMask * 0.85), 0.0, 0.78);

        // Refracted bokeh through wet drops vs soft misty glass
        vec3 sharpCity = sampleCityBokeh(uv - refr * 1.35, 0.0);
        vec3 mistyCity = sampleCityBokeh(uv, 0.85);
        vec3 col = mix(sharpCity, mistyCity * 0.92 + vec3(0.08, 0.10, 0.14), mist * 0.72);

        // Crisp specular highlight on curved raindrops catching warm indoor lamp & city glow
        float rimSpec = pow(dropMask, 1.8) * 0.62;
        vec3 warmInterior = vec3(1.0, 0.86, 0.66);
        col += (warmInterior * 0.42 + sharpCity * 0.78) * rimSpec;

        // Subtle dark winter glass vignette & warm interior lamp reflection in upper corners
        float interiorRefl = smoothstep(0.55, 1.0, uv.y) * 0.065;
        col += vec3(0.85, 0.58, 0.32) * interiorRefl;

        // Delicate wet vertical rain streaks catching cool night glow
        float streak = sin(uv.x * 160.0 + sin(uv.y * 12.0)) * 0.5 + 0.5;
        col += vec3(0.05, 0.08, 0.13) * streak * dropMask * 0.38;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: true,
  });

  // Large panoramic winter window behind the family
  const winW = 2.65;
  const winH = 1.38;
  const winY = 0.72;
  const winZ = -1.32;

  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), windowShaderMat);
  glassMesh.position.set(0, winY, winZ);
  glassMesh.name = 'rainyWindow';
  group.add(glassMesh);

  // Dark wooden Japanese window frame & mullions (格子)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c14,
    roughness: 0.48,
    metalness: 0.05,
    normalMap: woodMat ? woodMat.normalMap : null,
  });

  const frameDepth = 0.09;
  const outerBar = 0.065;
  // Top & bottom sill
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(winW + outerBar * 2, outerBar, frameDepth), frameMat);
  topFrame.position.set(0, winY + winH / 2 + outerBar / 2, winZ + 0.025);
  group.add(topFrame);

  const sillFrame = new THREE.Mesh(new THREE.BoxGeometry(winW + outerBar * 2.4, outerBar * 1.15, frameDepth * 1.7), frameMat);
  sillFrame.position.set(0, winY - winH / 2 - outerBar / 2, winZ + 0.055);
  group.add(sillFrame);

  // Left & right outer posts
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(outerBar, winH + outerBar, frameDepth), frameMat);
    post.position.set(sx * (winW / 2 + outerBar / 2), winY, winZ + 0.025);
    group.add(post);
  }

  // Sliding glass door center mullion + subtle horizontal bar
  const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.036, winH, 0.04), frameMat);
  centerMullion.position.set(0.0, winY, winZ + 0.02);
  group.add(centerMullion);

  for (const mx of [-0.74, 0.74]) {
    const sideMul = new THREE.Mesh(new THREE.BoxGeometry(0.024, winH, 0.03), frameMat);
    sideMul.position.set(mx, winY, winZ + 0.018);
    group.add(sideMul);
  }

  const transBar = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.022, 0.028), frameMat);
  transBar.position.set(0, winY + 0.34, winZ + 0.018);
  group.add(transBar);

  // Cozy Japanese dining room plaster walls framing the window
  const plasterTex = createPlasterWallTexture();
  const wallMat = new THREE.MeshStandardMaterial({
    map: plasterTex.map,
    normalMap: plasterTex.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.9,
    metalness: 0.0,
    color: 0x5c4a3e,
  });

  // Below window wainscot wall
  const lowerWall = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.4), wallMat);
  lowerWall.position.set(0, winY - winH / 2 - 0.72, winZ + 0.03);
  group.add(lowerWall);

  // Left & right walls around window
  for (const sx of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), wallMat);
    sideWall.position.set(sx * (winW / 2 + 1.12), 0.7, winZ + 0.03);
    group.add(sideWall);

    // Side room walls angled to wrap the room when looking around
    const roomSide = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), wallMat);
    roomSide.position.set(sx * 2.15, 0.7, 0.25);
    roomSide.rotation.y = -sx * Math.PI / 2;
    group.add(roomSide);
  }

  // Above window wall
  const upperWall = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.2), wallMat);
  upperWall.position.set(0, winY + winH / 2 + 0.62, winZ + 0.03);
  group.add(upperWall);

  // Soft pleated woven linen curtains flanking the winter window
  const curtainMat = new THREE.MeshPhysicalMaterial({
    color: 0x7b6a5b,
    roughness: 0.94,
    sheen: 0.55,
    sheenColor: new THREE.Color(0xc8b29b),
    sheenRoughness: 0.85,
  });
  for (const sx of [-1, 1]) {
    const curtainGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const foldGeo = new THREE.CylinderGeometry(0.055, 0.068, 1.75, 12, 1, false);
      const fold = new THREE.Mesh(foldGeo, curtainMat);
      fold.position.set(sx * (winW / 2 - 0.08 + i * 0.072), winY - 0.05, winZ + 0.11 + Math.sin(i * 1.4) * 0.025);
      fold.scale.set(1.0, 1.0, 0.58);
      curtainGroup.add(fold);
    }
    group.add(curtainGroup);
  }

  // Hanging warm Japanese woven/ceramic pendant lamp shade subtly visible at top of frame
  const lampGroup = new THREE.Group();
  const shadePoints = [
    new THREE.Vector2(0.03, 0.16),
    new THREE.Vector2(0.06, 0.14),
    new THREE.Vector2(0.18, 0.05),
    new THREE.Vector2(0.24, 0.0),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadePoints, 32);
  const shadeMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b2c22,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  lampGroup.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0d4 })
  );
  bulb.position.y = 0.05;
  lampGroup.add(bulb);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.8 })
  );
  cord.position.y = 0.55;
  lampGroup.add(cord);

  lampGroup.position.set(0.02, 1.18, 0.16);
  group.add(lampGroup);

  scene.add(group);

  let fogAccumTimer = 0;

  return {
    group,
    glassMesh,
    wipeAtUV(uv) {
      if (!uv) return;
      const cx = uv.x * fogW;
      const cy = (1 - uv.y) * fogH;
      const grad = fogCtx.createRadialGradient(cx, cy, 2, cx, cy, 18);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fogCtx.fillStyle = grad;
      fogCtx.beginPath();
      fogCtx.arc(cx, cy, 18, 0, Math.PI * 2);
      fogCtx.fill();
      fogTex.needsUpdate = true;
    },
    update(dt, elapsed, { cameraPan = 0, boilLevel = 0 }) {
      windowUniforms.uTime.value = elapsed;
      windowUniforms.uCameraPan.value = cameraPan;
      const targetFog = 0.24 + boilLevel * 0.52;
      windowUniforms.uFogLevel.value += (targetFog - windowUniforms.uFogLevel.value) * Math.min(1, dt * 0.8);

      // Slowly re-fog wiped spots when boiling steam fills the room
      fogAccumTimer += dt;
      if (fogAccumTimer > 0.25) {
        fogAccumTimer = 0;
        const alpha = 0.008 + boilLevel * 0.022;
        fogCtx.fillStyle = `rgba(215, 215, 215, ${alpha.toFixed(4)})`;
        fogCtx.fillRect(0, 0, fogW, fogH);
        fogTex.needsUpdate = true;
      }
    },
  };
}
