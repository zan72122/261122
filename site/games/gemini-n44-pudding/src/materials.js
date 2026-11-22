import * as THREE from '../vendor/three.module.js';
import { RIM_LIGHT_POS } from './studio.js';
import { createCaramelPoolTexture } from './textures.js';

const SOFTBODY_VERTEX_COMMON = /* glsl */ `
uniform vec2 uBend;
uniform vec2 uBend2;
uniform float uSquash;
uniform float uTwist;
uniform float uRippleAmp;
uniform float uRipplePhase;
uniform vec2 uRippleDir;
uniform vec3 uPokePos;
uniform float uPokeAmount;
uniform float uPuddingHeight;
uniform float uScoopAmount;

varying vec3 vSbLocalPos;
varying vec3 vSbWorldPos;
varying vec3 vSbWorldNormal;

vec3 deformPudding(vec3 p) {
  float H = max(0.01, uPuddingHeight);
  float h = clamp(p.y / H, 0.0, 1.0);
  float hBend = pow(h, 1.72);
  float hWave2 = sin(h * 3.14159265) * h;

  float yScale = 1.0 + uSquash;
  float radialScale = 1.0 / sqrt(max(0.55, yScale));
  float bulgeProfile = mix(1.0, radialScale, sin(h * 3.14159265) * 0.85 + h * 0.15);

  vec3 q = p;
  q.y *= yScale;
  q.xz *= bulgeProfile;

  float tw = uTwist * hBend;
  float ct = cos(tw);
  float st = sin(tw);
  q.xz = mat2(ct, -st, st, ct) * q.xz;

  q.xz += uBend * hBend + uBend2 * hWave2;

  float dirProj = dot(normalize(p.xz + vec2(1e-4)), uRippleDir);
  float ripple = sin(h * 11.5 - uRipplePhase + dirProj * 1.8) * uRippleAmp * sin(h * 3.14159265);
  float rLen = length(q.xz);
  if (rLen > 0.001) {
    q.xz += (q.xz / rLen) * ripple;
  }

  vec3 toPoke = p - uPokePos;
  float dPoke = length(toPoke);
  float pokeFalloff = exp(-dPoke * dPoke * 6.8) * smoothstep(0.05, 0.25, h);
  vec3 inward = -normalize(vec3(p.x, (p.y - H * 0.45) * 0.45, p.z) + vec3(1e-4));
  q += inward * (uPokeAmount * 0.19 * pokeFalloff);

  if (uScoopAmount > 0.001) {
    vec3 scoopCenter = vec3(0.46, H * 0.78, 0.48);
    float ds = length((p - scoopCenter) * vec3(1.05, 1.25, 1.05));
    float carve = smoothstep(0.54, 0.06, ds) * uScoopAmount;
    vec3 scoopDir = normalize(vec3(-0.62, -0.42, -0.66));
    q += scoopDir * (carve * 0.46);
  }

  return q;
}
`;

function attachSoftBodyAndSSS(material, softBodyUniforms, sssOpts) {
  const sssUniforms = {
    uRimLightPos: { value: RIM_LIGHT_POS.clone() },
    uSssColor: { value: new THREE.Color(sssOpts.color) },
    uSssStrength: { value: sssOpts.strength },
    uSssPower: { value: sssOpts.power },
    uWrapBoost: { value: sssOpts.wrapBoost ?? 0.22 },
  };

  material.userData.sssUniforms = sssUniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, softBodyUniforms, sssUniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SOFTBODY_VERTEX_COMMON}`)
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec3 objectNormal = vec3( normal );
        {
          vec3 refUp = abs(objectNormal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 t1 = normalize(cross(refUp, objectNormal));
          vec3 t2 = normalize(cross(objectNormal, t1));
          float eps = 0.015;
          vec3 p0 = deformPudding(position);
          vec3 p1 = deformPudding(position + t1 * eps);
          vec3 p2 = deformPudding(position + t2 * eps);
          vec3 dn = cross(p1 - p0, p2 - p0);
          if (length(dn) > 1e-6) {
            objectNormal = normalize(dn);
          }
        }
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif
        `
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = deformPudding(position);
        vSbLocalPos = position;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vec4 sbWp = modelMatrix * vec4(transformed, 1.0);
        vSbWorldPos = sbWp.xyz;
        vSbWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform vec3 uRimLightPos;
        uniform vec3 uSssColor;
        uniform float uSssStrength;
        uniform float uSssPower;
        uniform float uWrapBoost;
        uniform float uPuddingHeight;
        varying vec3 vSbLocalPos;
        varying vec3 vSbWorldPos;
        varying vec3 vSbWorldNormal;
        `
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          vec3 sssL = normalize(uRimLightPos - vSbWorldPos);
          vec3 sssV = normalize(cameraPosition - vSbWorldPos);
          vec3 sssN = normalize(vSbWorldNormal);
          // Backlit subsurface scattering + creamy internal light diffusion!
          vec3 sssH = normalize(sssL + sssN * 0.42);
          float backScatter = pow(clamp(dot(sssV, -sssH), 0.0, 1.0), uSssPower);
          float fresnelRim = pow(1.0 - max(dot(sssN, sssV), 0.0), 2.15);
          float topThinness = smoothstep(0.05, 0.96, clamp(vSbLocalPos.y / max(0.01, uPuddingHeight), 0.0, 1.0));
          float wrapLight = clamp((dot(sssN, sssL) + 0.72) / 1.72, 0.0, 1.0);
          // Internal scattering warms shadows so translucent custard NEVER looks muddy gray!
          float internalScatter = (0.35 + 0.65 * wrapLight) * uWrapBoost;
          vec3 sssAdd = uSssColor * (backScatter * (0.62 + 0.75 * topThinness) + fresnelRim * wrapLight * 0.56 + internalScatter) * uSssStrength;
          outgoingLight += sssAdd;
        }
        #include <opaque_fragment>
        `
      );
  };

  return material;
}

export function attachStaticSSS(material, sssOpts) {
  const sssUniforms = {
    uRimLightPos: { value: RIM_LIGHT_POS.clone() },
    uSssColor: { value: new THREE.Color(sssOpts.color) },
    uSssStrength: { value: sssOpts.strength },
    uSssPower: { value: sssOpts.power },
    uWrapBoost: { value: sssOpts.wrapBoost ?? 0.16 },
  };
  material.userData.sssUniforms = sssUniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sssUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vSssWPos;\nvarying vec3 vSssWNorm;`
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vec4 sssWp = modelMatrix * vec4(transformed, 1.0);
        vSssWPos = sssWp.xyz;
        vSssWNorm = normalize(mat3(modelMatrix) * objectNormal);
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform vec3 uRimLightPos;
        uniform vec3 uSssColor;
        uniform float uSssStrength;
        uniform float uSssPower;
        uniform float uWrapBoost;
        varying vec3 vSssWPos;
        varying vec3 vSssWNorm;
        `
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          vec3 L = normalize(uRimLightPos - vSssWPos);
          vec3 V = normalize(cameraPosition - vSssWPos);
          vec3 N = normalize(vSssWNorm);
          vec3 H = normalize(L + N * 0.45);
          float back = pow(clamp(dot(V, -H), 0.0, 1.0), uSssPower);
          float rim = pow(1.0 - max(dot(N, V), 0.0), 2.3);
          float wrap = clamp((dot(N, L) + 0.65) / 1.65, 0.0, 1.0);
          outgoingLight += uSssColor * (back * 0.90 + rim * wrap * 0.48 + (0.3 + 0.7 * wrap) * uWrapBoost) * uSssStrength;
        }
        #include <opaque_fragment>
        `
      );
  };
  return material;
}

// 1. Hero Translucent Soft-Body Custard Pudding Material (creamy luminous golden egg custard!)
export function createPuddingMaterial(custardTextures, softBodyUniforms) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: custardTextures.map,
    roughnessMap: custardTextures.roughnessMap,
    bumpMap: custardTextures.bumpMap,
    bumpScale: 0.0028,
    color: new THREE.Color(0xfffbe8),
    roughness: 0.17,
    metalness: 0.0,
    clearcoat: 0.98,
    clearcoatRoughness: 0.055,
    reflectivity: 0.78,
    sheen: 0.20,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(0xfff1c4),
    envMapIntensity: 0.98,
  });

  return attachSoftBodyAndSSS(mat, softBodyUniforms, {
    color: 0xffc038,
    strength: 0.88,
    power: 2.2,
    wrapBoost: 0.36,
  });
}

// 2. Glossy Soft-Body Burnt-Amber Caramel Glaze & Per-Pixel Rounded Viscous Drips Material!
// Computes smooth, bulbous, razor-sharp organic liquid drips in the fragment shader + raised thickness in vertex shader
// so drips NEVER look jagged/polygonal and flex in 100% lockstep with the soft-body custard underneath!
export function createCaramelGlazeMaterial(softBodyUniforms) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x280d01),
    roughness: 0.022,
    metalness: 0.01,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    ior: 1.54,
    reflectivity: 1.0,
    envMapIntensity: 1.55,
    transparent: true,
    opacity: 0.96,
    depthWrite: true,
  });

  const caramelUniforms = {
    uRimLightPos: { value: RIM_LIGHT_POS.clone() },
    uSssColor: { value: new THREE.Color(0xd96808) }, // authentic golden burnt-sugar amber (NOT pinkish-red!)
    uSssStrength: { value: 1.05 },
    uSssPower: { value: 2.0 },
    uCaramelFlow: { value: 0.0 },
  };
  mat.userData.caramelUniforms = caramelUniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, softBodyUniforms, caramelUniforms);

    const DRIP_MATH = /* glsl */ `
    uniform float uCaramelFlow;

    // Smooth organic bulbous viscous caramel drip boundary (returns lowest Y reached by caramel at angle theta)
    float getCaramelBoundaryY(float theta, float H, float flow) {
      // Base baked caramel crown covers top ~0.18 of pudding even at flow = 0
      float crownDrop = 0.19 + 0.04 * sin(theta * 3.0 + 0.6);
      // 9 lush organic rounded drip lobes of varying lengths (smooth cosine-bell shapes -> bulbous liquid teardrops!)
      float d1 = pow(0.5 + 0.5 * sin(theta * 5.0 + 0.35), 2.4) * 0.56;
      float d2 = pow(0.5 + 0.5 * sin(theta * 7.0 - 1.15), 3.0) * 0.44;
      float d3 = pow(0.5 + 0.5 * cos(theta * 3.0 + 1.9), 2.2) * 0.28;
      float d4 = pow(0.5 + 0.5 * sin(theta * 11.0 + 0.8), 3.6) * 0.16;
      float dripReach = (d1 + d2 + d3 + d4) * flow;
      return max(0.05, H - crownDrop - dripReach * 0.92);
    }
    `;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SOFTBODY_VERTEX_COMMON}\n${DRIP_MATH}`)
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec3 objectNormal = vec3( normal );
        {
          vec3 refUp = abs(objectNormal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 t1 = normalize(cross(refUp, objectNormal));
          vec3 t2 = normalize(cross(objectNormal, t1));
          float eps = 0.015;
          vec3 p0 = deformPudding(position);
          vec3 p1 = deformPudding(position + t1 * eps);
          vec3 p2 = deformPudding(position + t2 * eps);
          vec3 dn = cross(p1 - p0, p2 - p0);
          if (length(dn) > 1e-6) {
            objectNormal = normalize(dn);
          }
        }
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif
        `
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        // Add subtle glossy liquid meniscus thickness along drip edge & bulbous tip!
        float vTheta = atan(position.z, position.x);
        float vBoundY = getCaramelBoundaryY(vTheta, uPuddingHeight, uCaramelFlow);
        float distAboveEdge = position.y - vBoundY;
        float tipBead = smoothstep(0.0, 0.045, distAboveEdge) * smoothstep(0.16, 0.035, distAboveEdge) * (0.012 * uCaramelFlow);
        float shellOffset = 0.0085 + 0.005 * uCaramelFlow + tipBead;
        vec3 inflatedPos = position + normalize(normal) * shellOffset;
        vec3 transformed = deformPudding(inflatedPos);
        vSbLocalPos = position;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vec4 sbWp = modelMatrix * vec4(transformed, 1.0);
        vSbWorldPos = sbWp.xyz;
        vSbWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform vec3 uRimLightPos;
        uniform vec3 uSssColor;
        uniform float uSssStrength;
        uniform float uSssPower;
        uniform float uPuddingHeight;
        varying vec3 vSbLocalPos;
        varying vec3 vSbWorldPos;
        varying vec3 vSbWorldNormal;
        ${DRIP_MATH}
        `
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          float fTheta = atan(vSbLocalPos.z, vSbLocalPos.x);
          float boundY = getCaramelBoundaryY(fTheta, uPuddingHeight, uCaramelFlow);
          float dEdge = vSbLocalPos.y - boundY;
          if (dEdge < -0.006) discard;

          // Razor-clean smooth liquid meniscus edge!
          float edgeMask = smoothstep(-0.005, 0.016, dEdge);
          // Thin translucent amber glow right along the drip rim (real caramel turns bright honey-gold where thin!)
          float thinRim = smoothstep(0.11, 0.0, dEdge) * edgeMask;

          vec3 sssL = normalize(uRimLightPos - vSbWorldPos);
          vec3 sssV = normalize(cameraPosition - vSbWorldPos);
          vec3 sssN = normalize(vSbWorldNormal);
          vec3 sssH = normalize(sssL + sssN * 0.42);
          float backScatter = pow(clamp(dot(sssV, -sssH), 0.0, 1.0), uSssPower);
          float fresnelRim = pow(1.0 - max(dot(sssN, sssV), 0.0), 2.1);
          float wrapLight = clamp((dot(sssN, sssL) + 0.65) / 1.65, 0.0, 1.0);

          // Authentic golden burnt-amber subsurface transmittance + honey rim highlight!
          vec3 amberGlow = uSssColor * (backScatter * 0.72 + fresnelRim * wrapLight * 0.55 + thinRim * 0.62) * uSssStrength;
          // Crisp glossy meniscus catchlight right along drip edge
          float meniscusSpec = pow(thinRim, 2.2) * (0.28 + 0.55 * wrapLight);
          outgoingLight += amberGlow + vec3(1.0, 0.72, 0.30) * meniscusSpec * 0.42;
          diffuseColor.a *= edgeMask * (0.76 + 0.22 * smoothstep(0.0, 0.09, dEdge));
        }
        #include <opaque_fragment>
        `
      );
  };

  return mat;
}

// 3. Glossy Liquid Caramel Material (pour ribbon & inside pitcher) — luminous backlit amber-gold!
export function createCaramelLiquidMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x3a1402),
    roughness: 0.02,
    metalness: 0.01,
    clearcoat: 1.0,
    clearcoatRoughness: 0.014,
    ior: 1.55,
    envMapIntensity: 1.65,
    transparent: true,
    opacity: 0.91,
  });
  return attachStaticSSS(mat, {
    color: 0xf27a0a, // bright burnt-sugar amber (no pinkish cast!)
    strength: 1.55,
    power: 1.65,
    wrapBoost: 0.28,
  });
}

// 4. Glossy Feathered Translucent Caramel Pool Material (for the porcelain plate!)
export function createCaramelPoolMaterial() {
  const poolTex = createCaramelPoolTexture();
  const mat = new THREE.MeshPhysicalMaterial({
    map: poolTex.map,
    alphaMap: poolTex.alphaMap,
    color: new THREE.Color(0xffffff),
    roughness: 0.02,
    metalness: 0.01,
    clearcoat: 1.0,
    clearcoatRoughness: 0.014,
    ior: 1.54,
    reflectivity: 1.0,
    envMapIntensity: 1.7,
    transparent: true,
    depthWrite: false,
  });
  return attachStaticSSS(mat, {
    color: 0xe87b0c,
    strength: 0.58,
    power: 2.1,
    wrapBoost: 0.14,
  });
}

// 5. Translucent Glossy Egg Yolk Material
export function createEggYolkMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf6960e),
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    ior: 1.46,
    envMapIntensity: 1.25,
  });
  return attachStaticSSS(mat, {
    color: 0xffb216,
    strength: 1.05,
    power: 2.1,
    wrapBoost: 0.24,
  });
}

// 6. Clear Egg Albumen Material
export function createAlbumenMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfffdf6),
    roughness: 0.03,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.018,
    transparent: true,
    opacity: 0.34,
    envMapIntensity: 1.45,
    depthWrite: false,
  });
}

// 7. Crystal-Clear Studio Glass Material
export function createStudioGlassMaterial(opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color || 0xffffff),
    roughness: opts.roughness ?? 0.025,
    metalness: 0.0,
    transmission: opts.transmission ?? 0.95,
    thickness: opts.thickness ?? 0.16,
    ior: 1.50,
    attenuationColor: new THREE.Color(0xf4f8fc),
    attenuationDistance: 12.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: opts.envMapIntensity ?? 1.6,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
}

// 8. High-Fire Glossy White Japanese Porcelain Plate Material
export function createPorcelainMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf6f4ef),
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 0.95,
    clearcoatRoughness: 0.05,
    reflectivity: 0.88,
    envMapIntensity: 1.08,
  });
}

// 9. Creamy Translucent Milk Material
export function createMilkMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfdfaf2),
    roughness: 0.10,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.92,
  });
  return attachStaticSSS(mat, {
    color: 0xfff8e6,
    strength: 0.45,
    power: 2.6,
    wrapBoost: 0.22,
  });
}

// 10. Gleaming Brushed / Mirror Stainless Steel (tuned for dramatic dark studio specular!)
export function createSteelMaterial(polished = false) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(polished ? 0xf6f8fb : 0xdde3ea),
    roughness: polished ? 0.11 : 0.24,
    metalness: polished ? 0.88 : 0.82,
    clearcoat: polished ? 0.65 : 0.25,
    envMapIntensity: 1.75,
  });
}

// 11. Warm Photorealistic Studio Skin Material
export function createStudioSkinMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe8b89a),
    roughness: 0.50,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    sheen: 0.30,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xffdbc6),
    envMapIntensity: 0.65,
  });
  return attachStaticSSS(mat, {
    color: 0xea6d42,
    strength: 0.52,
    power: 2.4,
    wrapBoost: 0.18,
  });
}

// 12. Crystal Refractive Melted Ice Cube Material
export function createIceMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xdcf3ff),
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.88,
    thickness: 0.65,
    ior: 1.31,
    attenuationColor: new THREE.Color(0x90d6ff),
    attenuationDistance: 2.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.8,
  });
  return attachStaticSSS(mat, {
    color: 0x9ce2ff,
    strength: 0.42,
    power: 2.2,
    wrapBoost: 0.14,
  });
}
