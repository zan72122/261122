import * as THREE from '../vendor/three.module.js';

// Ultra-lightweight Tilt-Shift Macro Photography post-processing pipeline.
// Uses half-resolution separable 9-tap Gaussian blur + vertical focal-plane tilt-shift blend
// + subtle warm sunlit miniature color grade & optical macro vignette.
// Runs comfortably > 45-60fps on iPhone/iPad (pixelRatio <= 1.5).

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  varying vec2 vUv;

  void main() {
    vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
    sum += texture2D(tDiffuse, vUv + uDirection * 1.384615) * 0.316216;
    sum += texture2D(tDiffuse, vUv - uDirection * 1.384615) * 0.316216;
    sum += texture2D(tDiffuse, vUv + uDirection * 3.230769) * 0.070270;
    sum += texture2D(tDiffuse, vUv - uDirection * 3.230769) * 0.070270;
    gl_FragColor = sum;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tSharp;
  uniform sampler2D tBlur;
  uniform float uFocusY;
  uniform float uFocusHalfBand;
  uniform float uBlurStrength;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    vec4 sharp = texture2D(tSharp, vUv);
    vec4 blurred = texture2D(tBlur, vUv);

    // Tilt-shift shallow depth of field band centered around the counter/bowl/customer plane
    float distY = abs(vUv.y - uFocusY);
    float blurFactor = smoothstep(uFocusHalfBand, uFocusHalfBand + 0.30, distY);
    // Slight extra dreamy blur in the far top corners for authentic macro lens curvature
    float edgeX = abs(vUv.x - 0.5);
    float cornerSoft = smoothstep(0.32, 0.62, edgeX) * smoothstep(0.12, 0.45, distY) * 0.35;
    float mixAmt = clamp((blurFactor + cornerSoft) * uBlurStrength, 0.0, 0.92);

    vec3 col = mix(sharp.rgb, blurred.rgb, mixAmt);

    // Subtle macro miniature photographic warmth & micro-contrast pop
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.09); // Gentle miniature Kodachrome vibrance
    col *= vec3(1.02, 1.005, 0.98);   // Warm afternoon sunlight tint

    // Gentle optical lens vignette
    vec2 centered = (vUv - 0.5) * vec2(min(uAspect, 1.35), 1.0);
    float vig = 1.0 - smoothstep(0.50, 0.98, length(centered)) * 0.22;
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class TiltShiftRenderer {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const isWebGL2 = renderer.capabilities.isWebGL2;
    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    };

    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      ...rtOpts,
      samples: isWebGL2 ? 4 : 0,
    });
    this.blurRTA = new THREE.WebGLRenderTarget(Math.max(2, width >> 1), Math.max(2, height >> 1), rtOpts);
    this.blurRTB = new THREE.WebGLRenderTarget(Math.max(2, width >> 1), Math.max(2, height >> 1), rtOpts);

    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1 / width, 0) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.compMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tSharp: { value: this.sceneRT.texture },
        tBlur: { value: this.blurRTB.texture },
        uFocusY: { value: 0.45 },
        uFocusHalfBand: { value: 0.20 },
        uBlurStrength: { value: 0.88 },
        uAspect: { value: width / Math.max(1, height) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quadScene = new THREE.Scene();
    this.quadMesh = new THREE.Mesh(quadGeo, this.blurMat);
    this.quadScene.add(this.quadMesh);

    this.width = width;
    this.height = height;
  }

  resize(width, height) {
    const w = Math.max(2, Math.floor(width));
    const h = Math.max(2, Math.floor(height));
    this.width = w;
    this.height = h;
    this.sceneRT.setSize(w, h);
    this.blurRTA.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.blurRTB.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.compMat.uniforms.uAspect.value = w / h;
    // Slightly widen focus band on tall portrait phones so customer + bowl + crank are all sharp
    this.compMat.uniforms.uFocusHalfBand.value = w < h ? 0.22 : 0.19;
    this.compMat.uniforms.uFocusY.value = w < h ? 0.46 : 0.45;
  }

  render(scene, camera) {
    const r = this.renderer;
    const prevAutoClear = r.autoClear;

    // 1. Render main 3D miniature scene into multisampled RT
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    this.lastSceneTriangles = r.info.render.triangles;
    this.lastSceneCalls = r.info.render.calls;

    // 2. Horizontal blur into half-res A (wide photographic bokeh radius)
    const bw = this.blurRTA.width;
    const bh = this.blurRTA.height;
    const radius = 2.15;

    this.quadMesh.material = this.blurMat;
    this.blurMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.blurMat.uniforms.uDirection.value.set(radius / bw, 0);
    r.setRenderTarget(this.blurRTA);
    r.render(this.quadScene, this.orthoCam);

    // 3. Vertical blur into half-res B
    this.blurMat.uniforms.tDiffuse.value = this.blurRTA.texture;
    this.blurMat.uniforms.uDirection.value.set(0, radius / bh);
    r.setRenderTarget(this.blurRTB);
    r.render(this.quadScene, this.orthoCam);

    // Second gentle blur pass for extra-creamy real-lens bokeh
    this.blurMat.uniforms.tDiffuse.value = this.blurRTB.texture;
    this.blurMat.uniforms.uDirection.value.set((radius * 1.45) / bw, 0);
    r.setRenderTarget(this.blurRTA);
    r.render(this.quadScene, this.orthoCam);

    this.blurMat.uniforms.tDiffuse.value = this.blurRTA.texture;
    this.blurMat.uniforms.uDirection.value.set(0, (radius * 1.45) / bh);
    r.setRenderTarget(this.blurRTB);
    r.render(this.quadScene, this.orthoCam);

    // 4. Composite Tilt-Shift to screen
    this.quadMesh.material = this.compMat;
    this.compMat.uniforms.tSharp.value = this.sceneRT.texture;
    this.compMat.uniforms.tBlur.value = this.blurRTB.texture;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.orthoCam);

    r.autoClear = prevAutoClear;
  }
}
