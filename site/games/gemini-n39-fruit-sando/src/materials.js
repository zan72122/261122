import * as THREE from 'three';

// Shared world-space morning window backlight direction (normalized, pointing FROM surface TO morning window sun)
export const MORNING_SUN_DIR = new THREE.Vector3(-0.34, 0.56, -0.75).normalize();

/**
 * Generates an HDR-like sunlit morning kitchen window PMREM environment map purely in code.
 * Huge bright warm window behind the subject + crisp sun highlight + soft warm linen table bounce
 * => gives ultra-juicy wet fruit reflections and creamy speculars!
 */
export function createMorningWindowEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  // Rich warm morning studio interior tone (prevents washed-out blown highlights while keeping crisp window reflections!)
  envScene.background = new THREE.Color(0x8e7c66);

  // Giant sunlit morning window behind/left (creates dazzling backlit reflections on wet fruit & steel knife)
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.15, 1.75) });
  const mainWindow = new THREE.Mesh(new THREE.PlaneGeometry(14, 10.5), windowMat);
  mainWindow.position.set(-3.8, 5.0, -10);
  mainWindow.lookAt(0, 0, 0);
  envScene.add(mainWindow);

  // Secondary right-rear soft sunlit sheer curtain glow
  const curtainGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.15, 0.98) })
  );
  curtainGlow.position.set(5.5, 4.8, -9.5);
  curtainGlow.lookAt(0, 0, 0);
  envScene.add(curtainGlow);

  // Extra blazing morning sun disc peeking through upper window pane (for crisp star-bright specular glints)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6.2, 5.3, 3.8) })
  );
  sunDisc.position.set(-4.4, 6.6, -9.7);
  sunDisc.lookAt(0, 0, 0);
  envScene.add(sunDisc);

  // Soft cool morning sky fill from upper right (adds natural daylight color contrast)
  const skyFill = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.84, 1.04) })
  );
  skyFill.position.set(9, 7, 2);
  skyFill.lookAt(0, 0, 0);
  envScene.add(skyFill);

  // Warm front-right studio reflector card (like a real Japanese food-CM foamcore bounce board)
  const bounceCard = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.88, 0.8, 0.7) })
  );
  bounceCard.position.set(5.2, 2.8, 9.2);
  bounceCard.lookAt(0, 0, 0);
  envScene.add(bounceCard);

  // Soft overhead kitchen ceiling bounce
  const ceilingBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.72, 0.68) })
  );
  ceilingBounce.rotation.x = Math.PI * 0.5;
  ceilingBounce.position.set(0, 10, 0);
  envScene.add(ceilingBounce);

  // Warm pale hinoki table bounce underneath
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.48, 0.39, 0.29) })
  );
  floorBounce.rotation.x = -Math.PI * 0.5;
  floorBounce.position.set(0, -6, 0);
  envScene.add(floorBounce);

  // Subtle window muntin shadow strips for realistic reflection breakup on glossy wet surfaces
  const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.65, 0.58, 0.5) });
  const vBar = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 11.6), barMat);
  vBar.position.set(-3.7, 5.0, -9.5);
  vBar.lookAt(0, 0, 0);
  envScene.add(vBar);
  const hBar = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 0.42), barMat);
  hBar.position.set(-3.7, 5.0, -9.5);
  hBar.lookAt(0, 0, 0);
  envScene.add(hBar);

  const rt = pmrem.fromScene(envScene, 0.032);
  pmrem.dispose();
  return rt.texture;
}

/**
 * Injects physically-inspired linear-HDR view-dependent backlit Subsurface Scattering (SSS)
 * into MeshPhysicalMaterial / MeshStandardMaterial before opaque_fragment.
 * Makes strawberries glow ruby-red, kiwi glow emerald-gold, mikan glow amber,
 * whipped cream glow warm creamy-ivory, and skin glow soft rose in morning backlight!
 */
export function applySubsurface(
  material,
  {
    color = 0xff3b2f,
    intensity = 0.85,
    power = 2.6,
    distortion = 0.45,
    ambient = 0.16,
    rim = 0.35,
  } = {}
) {
  const sssColor = new THREE.Color(color);
  const cacheKey = `sss2_${sssColor.getHexString()}_${intensity.toFixed(2)}_${power.toFixed(1)}_${ambient.toFixed(2)}_${rim.toFixed(2)}`;
  material.customProgramCacheKey = () => cacheKey;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSssColor = { value: sssColor };
    shader.uniforms.uSssSunDir = { value: MORNING_SUN_DIR };
    shader.uniforms.uSssIntensity = { value: intensity };
    shader.uniforms.uSssPower = { value: power };
    shader.uniforms.uSssDistortion = { value: distortion };
    shader.uniforms.uSssAmbient = { value: ambient };
    shader.uniforms.uSssRim = { value: rim };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSssWorldPos;
        varying vec3 vSssWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSssWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSssWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSssColor;
        uniform vec3 uSssSunDir;
        uniform float uSssIntensity;
        uniform float uSssPower;
        uniform float uSssDistortion;
        uniform float uSssAmbient;
        uniform float uSssRim;
        varying vec3 vSssWorldPos;
        varying vec3 vSssWorldNormal;`
      )
      .replace(
        '#include <opaque_fragment>',
        `
        {
          vec3 sssV = normalize(cameraPosition - vSssWorldPos);
          vec3 sssN = normalize(vSssWorldNormal);
          if (!gl_FrontFacing) sssN = -sssN;
          vec3 sssL = normalize(uSssSunDir);
          // Backlit transmission lobe (morning sunlight passing THROUGH translucent fruit/cream/skin)
          vec3 sssH = normalize(sssL + sssN * uSssDistortion);
          float sssBack = pow(clamp(dot(sssV, -sssH), 0.0, 1.0), uSssPower);
          // Forward-scatter wrap diffuse so shadowed areas glow juicy rather than muddy grey
          float sssWrap = clamp((dot(sssN, sssL) + 0.7) / 1.7, 0.0, 1.0);
          // Grazing Fresnel backlit halo on edges
          float sssFresnel = pow(1.0 - clamp(dot(sssN, sssV), 0.0, 1.0), 2.4);
          vec3 sssGlow = uSssColor * (
            sssBack * uSssIntensity +
            sssWrap * uSssAmbient +
            sssFresnel * uSssRim * (0.4 + 0.6 * sssWrap)
          );
          outgoingLight += sssGlow;
        }
        #include <opaque_fragment>
        `
      );
  };
  return material;
}
