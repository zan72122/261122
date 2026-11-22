import * as THREE from 'three';

/**
 * Injects physically-inspired forward/back-lit Subsurface Scattering (SSS) + Fresnel rim glow
 * into Three.js MeshPhysicalMaterial / MeshStandardMaterial for studio 1-rim-light food photography.
 */
export function applySubsurfaceScattering(material, {
  lightPosUniform,
  scatterColor = new THREE.Color(0xff8c24),
  scatterStrength = 0.85,
  scatterPower = 2.6,
  distortion = 0.38,
  ambientScatter = 0.12,
  rimGlowColor = new THREE.Color(0xfff0d4),
  rimGlowStrength = 0.25,
} = {}) {
  const uniforms = {
    uRimLightPos: lightPosUniform || { value: new THREE.Vector3(-2.2, 4.6, -2.8) },
    uScatterColor: { value: scatterColor.clone() },
    uScatterStrength: { value: scatterStrength },
    uScatterPower: { value: scatterPower },
    uScatterDistortion: { value: distortion },
    uAmbientScatter: { value: ambientScatter },
    uRimGlowColor: { value: rimGlowColor.clone() },
    uRimGlowStrength: { value: rimGlowStrength },
  };

  material.userData.sssUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSssWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSssWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSssWorldPos;
        uniform vec3 uRimLightPos;
        uniform vec3 uScatterColor;
        uniform float uScatterStrength;
        uniform float uScatterPower;
        uniform float uScatterDistortion;
        uniform float uAmbientScatter;
        uniform vec3 uRimGlowColor;
        uniform float uRimGlowStrength;`
      )
      .replace(
        '#include <dithering_fragment>',
        `
        vec3 sssViewDir = normalize(cameraPosition - vSssWorldPos);
        vec3 sssLightDir = normalize(uRimLightPos - vSssWorldPos);
        vec3 sssWorldNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);

        // Back-lit translucent scatter through yolk / custard / caramel / skin
        vec3 transLight = normalize(sssLightDir + sssWorldNormal * uScatterDistortion);
        float backScatter = pow(clamp(dot(sssViewDir, -transLight), 0.0, 1.0), uScatterPower);
        float wrapNdotL = clamp((dot(sssWorldNormal, sssLightDir) + 0.55) / 1.55, 0.0, 1.0);
        float fresnelEdge = pow(1.0 - clamp(dot(sssWorldNormal, sssViewDir), 0.0, 1.0), 3.0);

        vec3 sssContribution = uScatterColor * (
          backScatter * uScatterStrength * (0.55 + 0.65 * fresnelEdge) +
          wrapNdotL * uAmbientScatter
        );
        vec3 rimContribution = uRimGlowColor * fresnelEdge * clamp(dot(sssWorldNormal, sssLightDir) * 0.6 + 0.5, 0.0, 1.0) * uRimGlowStrength;

        gl_FragColor.rgb += sssContribution + rimContribution;
        #include <dithering_fragment>`
      );
  };

  material.customProgramCacheKey = () => 'sss_studio_v1';
  return material;
}

/**
 * Hero Custard Pudding Material:
 * Combines silky vanilla-bean custard + baked top caramel cap + dynamic poured caramel streams
 * along 16 angular sectors + freshly-scooped interior creamy face + rich subsurface scattering!
 */
export function createHeroPuddingMaterial(textures, lightPosUniform) {
  const dripArray = new Float32Array(16).fill(0.16); // Initial baked caramel cap drips

  const uniforms = {
    uRimLightPos: lightPosUniform,
    uCustardTint: { value: new THREE.Color(0xfad878) },
    uCustardScatter: { value: new THREE.Color(0xff9424) },
    uCaramelDeep: { value: new THREE.Color(0x140300) },
    uCaramelAmber: { value: new THREE.Color(0xd94404) },
    uExtraTopCaramel: { value: 0.0 },
    uDrips: { value: dripArray },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    map: textures.custardColor,
    bumpMap: textures.custardBump,
    bumpScale: 0.0022,
    roughness: 0.11,
    metalness: 0.0,
    ior: 1.44,
    reflectivity: 0.68,
    clearcoat: 1.0,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.45,
  });

  mat.userData.puddingUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // vPuddingMeta: x = hNorm (0 bottom .. 1 crown), y = theta (-PI..PI), z = scoopCutMask (0 outer .. 1 cut interior)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aPuddingMeta;
        varying vec3 vPuddingMeta;
        varying vec3 vPudWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vPuddingMeta = aPuddingMeta;
        vPudWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPuddingMeta;
        varying vec3 vPudWorldPos;
        uniform vec3 uRimLightPos;
        uniform vec3 uCustardTint;
        uniform vec3 uCustardScatter;
        uniform vec3 uCaramelDeep;
        uniform vec3 uCaramelAmber;
        uniform float uExtraTopCaramel;
        uniform float uDrips[16];

        float sampleCaramelMask(float hNorm, float theta, float cutMask) {
          if (cutMask > 0.35) return 0.0;
          float ang01 = fract((theta + 3.14159265) / 6.2831853);
          float fIdx = ang01 * 16.0;
          int i0 = int(floor(fIdx)) & 15;
          int i1 = (i0 + 1) & 15;
          float frac = fract(fIdx);
          frac = frac * frac * (3.0 - 2.0 * frac);

          float d0 = 0.16;
          float d1 = 0.16;
          for (int k = 0; k < 16; k++) {
            if (k == i0) d0 = uDrips[k];
            if (k == i1) d1 = uDrips[k];
          }
          float dripReach = mix(d0, d1, frac);
          // Organic scalloped drip lobes along the fluted ribs
          float lobe = sin(theta * 12.0) * 0.025 + sin(theta * 5.0 + 1.3) * 0.032;
          float threshold = 1.0 - clamp(dripReach + lobe, 0.12, 1.02);
          return smoothstep(threshold - 0.045, threshold + 0.025, hNorm);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float hNorm = vPuddingMeta.x;
        float theta = vPuddingMeta.y;
        float cutMask = clamp(vPuddingMeta.z, 0.0, 1.0);
        float cMask = sampleCaramelMask(hNorm, theta, cutMask);

        // Freshly scooped interior is slightly paler, velvety custard
        vec3 custardBase = diffuseColor.rgb * mix(uCustardTint, uCustardTint * 1.07 + vec3(0.03, 0.025, 0.015), cutMask);
        // Caramel thickness transitions from fiery ruby-amber edge to deep mahogany-espresso center
        float cThick = clamp((hNorm - 0.72) * 2.2 + cMask * (0.42 + uExtraTopCaramel * 0.55), 0.0, 1.0);
        vec3 caramelCol = mix(uCaramelAmber, uCaramelDeep, smoothstep(0.12, 0.88, cThick));

        diffuseColor.rgb = mix(custardBase, caramelCol, cMask * 0.96);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float cMaskR = sampleCaramelMask(vPuddingMeta.x, vPuddingMeta.y, clamp(vPuddingMeta.z, 0.0, 1.0));
        // Poured caramel is ultra-glossy liquid mirror (0.022); cut interior has soft velvety moisture (0.16)
        roughnessFactor = mix(mix(0.095, 0.155, clamp(vPuddingMeta.z, 0.0, 1.0)), 0.022, cMaskR);`
      )
      .replace(
        '#include <dithering_fragment>',
        `
        vec3 pViewDir = normalize(cameraPosition - vPudWorldPos);
        vec3 pLightDir = normalize(uRimLightPos - vPudWorldPos);
        vec3 pWorldN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);

        float pCut = clamp(vPuddingMeta.z, 0.0, 1.0);
        float pCaramel = sampleCaramelMask(vPuddingMeta.x, vPuddingMeta.y, pCut);

        vec3 pTrans = normalize(pLightDir + pWorldN * 0.42);
        float pBack = pow(clamp(dot(pViewDir, -pTrans), 0.0, 1.0), 2.35);
        float pWrap = clamp((dot(pWorldN, pLightDir) + 0.6) / 1.6, 0.0, 1.0);
        float pFresnel = pow(1.0 - clamp(dot(pWorldN, pViewDir), 0.0, 1.0), 2.8);

        // Custard scatters warm golden-orange; caramel scatters fiery ruby-amber when thin/rim-lit!
        vec3 scatterTint = mix(uCustardScatter, vec3(0.96, 0.24, 0.01), pCaramel * 0.76);
        float scatterAmt = mix(1.14, 0.72, pCaramel) * (pBack * (0.72 + 0.65 * pFresnel) + pWrap * 0.16);

        // Extra crisp studio wet-rim specular glint
        vec3 halfVec = normalize(pLightDir + pViewDir);
        float specGlint = pow(clamp(dot(pWorldN, halfVec), 0.0, 1.0), mix(140.0, 320.0, pCaramel));

        gl_FragColor.rgb += scatterTint * scatterAmt + vec3(1.0, 0.96, 0.88) * (pFresnel * 0.22 * pWrap + specGlint * 0.55);
        #include <dithering_fragment>`
      );
  };

  mat.customProgramCacheKey = () => 'hero_pudding_sss_v1';
  return mat;
}

export function createStudioMaterials(textures, lightPosUniform) {
  // Raw Egg Yolk: ultra-glossy translucent deep orange-gold membrane with intense warm SSS
  const yolk = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xff8400),
    roughness: 0.035,
    metalness: 0.0,
    ior: 1.42,
    clearcoat: 1.0,
    clearcoatRoughness: 0.018,
    envMapIntensity: 1.7,
  });
  applySubsurfaceScattering(yolk, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xff5500),
    scatterStrength: 1.25,
    scatterPower: 2.1,
    distortion: 0.45,
    ambientScatter: 0.22,
    rimGlowColor: new THREE.Color(0xffd27d),
    rimGlowStrength: 0.35,
  });

  // Viscous Raw Egg White (Albumen)
  const albumen = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfff9eb),
    transparent: true,
    opacity: 0.44,
    roughness: 0.03,
    metalness: 0.0,
    ior: 1.36,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    depthWrite: false,
    envMapIntensity: 1.6,
  });

  // Liquid Caramel (for saucier pool, pouring stream, and plate pool)
  const caramel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x280701),
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.49,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 1.85,
  });
  applySubsurfaceScattering(caramel, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xd83b02),
    scatterStrength: 1.15,
    scatterPower: 2.0,
    distortion: 0.5,
    ambientScatter: 0.16,
    rimGlowColor: new THREE.Color(0xff9d42),
    rimGlowStrength: 0.28,
  });

  // Silky Milk (carafe & stream)
  const milk = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfffcf6),
    roughness: 0.06,
    metalness: 0.0,
    ior: 1.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.25,
  });
  applySubsurfaceScattering(milk, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xffe4b8),
    scatterStrength: 0.65,
    scatterPower: 2.4,
    distortion: 0.35,
    ambientScatter: 0.18,
    rimGlowColor: new THREE.Color(0xffffff),
    rimGlowStrength: 0.2,
  });

  // Mixing Bowl Batter Surface (uses live swirling canvas texture!)
  const batter = new THREE.MeshPhysicalMaterial({
    map: textures.batterTex,
    roughness: 0.055,
    metalness: 0.0,
    ior: 1.38,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.4,
  });
  applySubsurfaceScattering(batter, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xffb84d),
    scatterStrength: 0.72,
    scatterPower: 2.4,
    distortion: 0.35,
    ambientScatter: 0.16,
    rimGlowColor: new THREE.Color(0xfff4dc),
    rimGlowStrength: 0.22,
  });

  // Crystal Studio Glass (for bowl, milk carafe, fluted pudding cup, steamer dome)
  // Using fast physical reflection + Fresnel transparency (avoids costly multi-pass transmission FBOs on mobile!)
  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf4f9ff),
    transparent: true,
    opacity: 0.24,
    roughness: 0.025,
    metalness: 0.04,
    ior: 1.52,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 2.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  applySubsurfaceScattering(glass, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xdff0ff),
    scatterStrength: 0.22,
    scatterPower: 3.5,
    distortion: 0.15,
    ambientScatter: 0.02,
    rimGlowColor: new THREE.Color(0xffffff),
    rimGlowStrength: 0.62,
  });

  // Translucent Chilled Ice Cubes
  const ice = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xdcf1ff),
    transparent: true,
    opacity: 0.58,
    roughness: 0.08,
    metalness: 0.0,
    ior: 1.31,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.0,
  });
  applySubsurfaceScattering(ice, {
    lightPosUniform,
    scatterColor: new THREE.Color(0x9be0ff),
    scatterStrength: 0.85,
    scatterPower: 2.2,
    distortion: 0.4,
    ambientScatter: 0.12,
    rimGlowColor: new THREE.Color(0xffffff),
    rimGlowStrength: 0.5,
  });

  // Farm Eggshell Outer & White Inner Membrane
  const eggshell = new THREE.MeshPhysicalMaterial({
    map: textures.eggColor,
    bumpMap: textures.eggBump,
    bumpScale: 0.0025,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.95,
  });
  applySubsurfaceScattering(eggshell, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xff7b38),
    scatterStrength: 0.42,
    scatterPower: 2.8,
    distortion: 0.3,
    ambientScatter: 0.08,
    rimGlowColor: new THREE.Color(0xffe5c8),
    rimGlowStrength: 0.18,
  });

  const eggshellInner = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xf6f1ea),
    roughness: 0.55,
    metalness: 0.0,
    side: THREE.BackSide,
  });

  // Handcrafted Stoneware Dessert Plate
  const plate = new THREE.MeshPhysicalMaterial({
    map: textures.plateColor,
    bumpMap: textures.plateBump,
    bumpScale: 0.002,
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.82,
    clearcoatRoughness: 0.09,
    envMapIntensity: 1.25,
  });

  // Liquid Caramel Pool Material (deep burnt-sugar mahogany center + glowing ruby-amber meniscus rim!)
  const caramelPool = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x140200),
    transparent: true,
    opacity: 0.97,
    roughness: 0.014,
    metalness: 0.0,
    ior: 1.49,
    clearcoat: 1.0,
    clearcoatRoughness: 0.010,
    envMapIntensity: 2.2,
  });
  caramelPool.onBeforeCompile = (shader) => {
    shader.uniforms.uRimLightPos = lightPosUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPoolLocal;\nvarying vec3 vPoolWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPoolLocal = position;\nvPoolWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPoolLocal;\nvarying vec3 vPoolWorld;\nuniform vec3 uRimLightPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rPool = length(vPoolLocal.xz);
        // Deep espresso-mahogany pool with a narrow glowing ruby-amber thin outer meniscus!
        float midAmber = smoothstep(0.76, 0.94, rPool);
        float rimThin = smoothstep(0.91, 1.01, rPool);
        vec3 deepCol = vec3(0.012, 0.0014, 0.0001);
        vec3 rubyCol = vec3(0.16, 0.018, 0.0005);
        vec3 amberEdge = vec3(0.45, 0.085, 0.003);
        diffuseColor.rgb = mix(mix(deepCol, rubyCol, midAmber), amberEdge, rimThin);
        diffuseColor.a = 1.0 - smoothstep(0.955, 1.03, rPool);
      `)
      .replace('#include <dithering_fragment>', `
        vec3 pvDir = normalize(cameraPosition - vPoolWorld);
        vec3 plDir = normalize(uRimLightPos - vPoolWorld);
        vec3 pwN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        vec3 ph = normalize(plDir + pvDir);
        float pSpec = pow(clamp(dot(pwN, ph), 0.0, 1.0), 280.0);
        gl_FragColor.rgb += vec3(1.0, 0.95, 0.86) * pSpec * 0.72;
        #include <dithering_fragment>
      `);
  };
  caramelPool.customProgramCacheKey = () => 'caramel_pool_meniscus_v1';

  // Honed Black Basalt Studio Countertop with true infinity-cyclorama black fade (ZERO horizon line!)
  textures.slateColor.wrapS = textures.slateColor.wrapT = THREE.ClampToEdgeWrapping;
  textures.slateColor.repeat.set(1, 1);
  textures.slateRoughness.wrapS = textures.slateRoughness.wrapT = THREE.ClampToEdgeWrapping;
  textures.slateRoughness.repeat.set(1, 1);
  textures.slateBump.wrapS = textures.slateBump.wrapT = THREE.ClampToEdgeWrapping;
  textures.slateBump.repeat.set(1, 1);

  const tabletop = new THREE.MeshPhysicalMaterial({
    map: textures.slateColor,
    roughnessMap: textures.slateRoughness,
    bumpMap: textures.slateBump,
    bumpScale: 0.0025,
    roughness: 0.78,
    metalness: 0.06,
    clearcoat: 0.28,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.15,
  });
  tabletop.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTableWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTableWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTableWPos;')
      .replace('#include <dithering_fragment>', `
        float tableRad = length(vTableWPos.xz - vec2(0.0, 0.08));
        float cycFade = 1.0 - smoothstep(0.75, 1.85, tableRad);
        gl_FragColor.rgb = mix(vec3(0.006, 0.006, 0.009), gl_FragColor.rgb, cycFade);
        #include <dithering_fragment>
      `);
  };
  tabletop.customProgramCacheKey = () => 'tabletop_cyclorama_v1';

  // Realistic Warm Human Skin (with dermal red-orange SSS!)
  const skin = new THREE.MeshPhysicalMaterial({
    map: textures.skinColor,
    bumpMap: textures.skinBump,
    bumpScale: 0.0016,
    roughness: 0.46,
    metalness: 0.0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.38,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffd8c2),
    envMapIntensity: 0.85,
  });
  applySubsurfaceScattering(skin, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xd9482b),
    scatterStrength: 0.68,
    scatterPower: 2.5,
    distortion: 0.35,
    ambientScatter: 0.14,
    rimGlowColor: new THREE.Color(0xffdfc8),
    rimGlowStrength: 0.24,
  });

  // Subtle Natural Lip Tone (for patissier mouth)
  const lips = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xc47468),
    bumpMap: textures.skinBump,
    bumpScale: 0.0012,
    roughness: 0.32,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.9,
  });
  applySubsurfaceScattering(lips, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xd93829),
    scatterStrength: 0.72,
    scatterPower: 2.4,
    distortion: 0.35,
    ambientScatter: 0.15,
    rimGlowColor: new THREE.Color(0xffd6c4),
    rimGlowStrength: 0.2,
  });

  // Fingernail Translucent Keratin
  const nail = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf2cfc2),
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.1,
  });

  // Dark Charcoal Linen Patissier Coat & Apron
  const chefCoat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x16161a),
    bumpMap: textures.linenBump,
    bumpScale: 0.0035,
    roughness: 0.84,
    metalness: 0.02,
    envMapIntensity: 0.65,
  });

  const chefApron = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x0d0d10),
    bumpMap: textures.linenBump,
    bumpScale: 0.004,
    roughness: 0.88,
    metalness: 0.03,
    envMapIntensity: 0.55,
  });

  // Mirror-Polished Silver Spoon & Stainless Whisk
  const silver = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfafcff),
    roughness: 0.055,
    metalness: 0.98,
    clearcoat: 0.6,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.1,
  });

  // Hammered Copper Saucier + Warm Brass Handle
  const copper = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xd97548),
    bumpMap: textures.copperBump,
    bumpScale: 0.0035,
    roughness: 0.16,
    metalness: 0.94,
    envMapIntensity: 1.9,
  });

  const brass = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd4a857),
    roughness: 0.24,
    metalness: 0.9,
    envMapIntensity: 1.6,
  });

  const darkWood = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2d1b12),
    roughness: 0.52,
    metalness: 0.04,
    envMapIntensity: 0.8,
  });

  // Fresh Wet Ruby Strawberry + Leaf Calyx
  const strawberry = new THREE.MeshPhysicalMaterial({
    map: textures.berryColor,
    bumpMap: textures.berryBump,
    bumpScale: 0.006,
    roughness: 0.09,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.55,
  });
  applySubsurfaceScattering(strawberry, {
    lightPosUniform,
    scatterColor: new THREE.Color(0xff1e26),
    scatterStrength: 0.95,
    scatterPower: 2.3,
    distortion: 0.4,
    ambientScatter: 0.14,
    rimGlowColor: new THREE.Color(0xffb8b8),
    rimGlowStrength: 0.28,
  });

  const berryLeaf = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x2d6e22),
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.35,
    side: THREE.DoubleSide,
  });
  applySubsurfaceScattering(berryLeaf, {
    lightPosUniform,
    scatterColor: new THREE.Color(0x7ad636),
    scatterStrength: 0.75,
    scatterPower: 2.4,
    distortion: 0.3,
    ambientScatter: 0.12,
    rimGlowColor: new THREE.Color(0xd4ff9e),
    rimGlowStrength: 0.2,
  });

  const heroPudding = createHeroPuddingMaterial(textures, lightPosUniform);

  return {
    heroPudding,
    yolk,
    albumen,
    caramel,
    caramelPool,
    milk,
    batter,
    glass,
    ice,
    eggshell,
    eggshellInner,
    plate,
    tabletop,
    skin,
    lips,
    nail,
    chefCoat,
    chefApron,
    silver,
    copper,
    brass,
    darkWood,
    strawberry,
    berryLeaf,
  };
}
