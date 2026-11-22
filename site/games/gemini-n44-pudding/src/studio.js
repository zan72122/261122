import * as THREE from '../vendor/three.module.js';
import { createSlateTextures, createContactShadowTexture } from './textures.js';

// Primary studio rim-light position (behind-left-high) — shared with SSS shaders!
export const RIM_LIGHT_POS = new THREE.Vector3(-2.7, 4.1, -3.2);

/**
 * Generates a soft feathered studio softbox light-panel texture (no harsh polygonal edges!)
 */
function createSoftboxTexture() {
  const w = 128, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Smooth feathered vertical strip softbox diffuser
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, h * 0.48);
  g.addColorStop(0.0, 'rgba(255, 248, 236, 1.0)');
  g.addColorStop(0.45, 'rgba(255, 244, 224, 0.82)');
  g.addColorStop(0.75, 'rgba(255, 236, 206, 0.28)');
  g.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Bespoke Darkroom Culinary Studio PMREM Environment Map.
 * Deep pitch-black enclosure + ONE creamy feathered vertical strip softbox back-left-top
 * for authentic commercial food-photography specular rolloff on pudding, caramel, yolk, glass & porcelain.
 */
function createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x020203);

  const softboxTex = createSoftboxTexture();

  // 1. Primary Studio Rim Strip Softbox (back-left-top) — smooth feathered HDR reflection
  const softbox = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 11.5),
    new THREE.MeshBasicMaterial({
      map: softboxTex,
      color: new THREE.Color(5.6, 5.2, 4.65),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  softbox.position.set(-5.6, 5.2, -5.2);
  softbox.lookAt(0, 0.7, 0);
  envScene.add(softbox);

  // 2. Soft overhead feathered diffuser (creates creamy glossy highlight arc on pudding crown & yolk dome)
  const topDiffuser = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 7.2),
    new THREE.MeshBasicMaterial({
      map: softboxTex,
      color: new THREE.Color(1.9, 1.78, 1.58),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  topDiffuser.position.set(-1.6, 8.6, -1.8);
  topDiffuser.lookAt(0, 0.4, 0);
  envScene.add(topDiffuser);

  // 3. Crisp narrow studio silver-reflector strip (right-front) — brings stainless steel whisk,
  // silver spoon, glass bowl rims & caramel pitcher edges to photographic sparkle without lifting the black background!
  const sideCard = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 10.5),
    new THREE.MeshBasicMaterial({
      map: softboxTex,
      color: new THREE.Color(1.45, 1.40, 1.34),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  sideCard.position.set(7.2, 3.8, 5.2);
  sideCard.lookAt(0, 0.8, 0);
  envScene.add(sideCard);

  // 4. Subtle front-left narrow specular kicker for silver utensils & glass lip
  const kickerCard = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 8.0),
    new THREE.MeshBasicMaterial({
      map: softboxTex,
      color: new THREE.Color(0.95, 0.90, 0.82),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  kickerCard.position.set(-6.8, 3.2, 5.6);
  kickerCard.lookAt(0, 0.8, 0);
  envScene.add(kickerCard);

  const envRT = pmrem.fromScene(envScene, 0.032);
  pmrem.dispose();
  softboxTex.dispose();
  return envRT.texture;
}

export function createStudio(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  // Dense dark studio falloff so the black slate horizon dissolves seamlessly into pitch-black void!
  scene.fog = new THREE.FogExp2(0x020203, 0.135);

  const envMap = createStudioEnvironment(renderer);
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 40);
  camera.position.set(0, 2.55, 5.05);
  camera.lookAt(0, 0.62, 0);

  // === 1-LIGHT DRAMATIC STUDIO RIM-LIGHT RIG ===
  // Single primary focused SpotLight from behind-left-high: carves glowing translucent rim,
  // activates golden SSS through egg yolk, custard, and amber caramel, with tight studio spotlight falloff!
  const rimLight = new THREE.SpotLight(0xfff3de, 54.0, 18, Math.PI * 0.22, 0.78, 1.55);
  rimLight.position.copy(RIM_LIGHT_POS);
  rimLight.target.position.set(0.05, 0.55, 0.05);
  rimLight.castShadow = true;
  rimLight.shadow.mapSize.set(1024, 1024);
  rimLight.shadow.camera.near = 1.4;
  rimLight.shadow.camera.far = 12.5;
  rimLight.shadow.bias = -0.0004;
  rimLight.shadow.normalBias = 0.016;
  scene.add(rimLight);
  scene.add(rimLight.target);

  // Subtle warm studio reflector card bounce (keeps front custard creamy gold, never muddy gray, while preserving deep dark studio contrast!)
  const bounceLight = new THREE.DirectionalLight(0xffe9cc, 0.58);
  bounceLight.position.set(2.4, 2.6, 4.6);
  scene.add(bounceLight);

  // Gentle warm ambient floor so shadows in food stay appetizing warm-toned
  const hemiLight = new THREE.HemisphereLight(0xfff1dc, 0x0d0b0a, 0.24);
  scene.add(hemiLight);

  // Stage-specific accent lights (off at 0 by default)
  const steamGlowLight = new THREE.PointLight(0xff9430, 0.0, 4.8, 2.0);
  steamGlowLight.position.set(0, 0.35, 0);
  scene.add(steamGlowLight);

  const chillLight = new THREE.PointLight(0x7ccfff, 0.0, 5.5, 1.9);
  chillLight.position.set(1.5, 1.8, -1.6);
  scene.add(chillLight);

  // === DEEP OBSIDIAN-SLATE STUDIO TABLETOP ===
  const slateTex = createSlateTextures();
  const tableGeo = new THREE.CircleGeometry(10.5, 64);
  const tableMat = new THREE.MeshStandardMaterial({
    map: slateTex.map,
    roughnessMap: slateTex.roughnessMap,
    bumpMap: slateTex.bumpMap,
    bumpScale: 0.012,
    roughness: 0.76,
    metalness: 0.06,
    envMapIntensity: 0.52,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.y = 0;
  table.receiveShadow = true;
  scene.add(table);

  const contactTex = createContactShadowTexture();
  function createContactShadow(radius = 1.2, opacity = 0.86) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.004;
    return mesh;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const aspect = w / h;
    if (aspect < 0.85) {
      camera.fov = THREE.MathUtils.lerp(46, 36, Math.max(0, (aspect - 0.45) / 0.4));
    } else {
      camera.fov = 33;
    }
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    rimLight,
    bounceLight,
    steamGlowLight,
    chillLight,
    createContactShadow,
    resize,
  };
}
