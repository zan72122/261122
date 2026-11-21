import * as THREE from 'three';

// Custom Real-Miniature Tilt-Shift Macro Photography Post-Processing Pipeline
// Keeps all GPU RenderTargets strictly <= 1024px for iPhone/iPad 60fps & <=1024px texture rule.

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Pass 1: Downsampled Disc Bokeh + Highlight Specular Bloom for creamy macro lens blur
const bokehBlurFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uAngle;
  varying vec2 vUv;

  void main() {
    // 12-tap Golden-Angle Vogel Disc Kernel with warm bokeh highlight weighting
    vec3 acc = vec3(0.0);
    float wSum = 0.0;

    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 12.0);
      float theta = fi * 2.3999632 + uAngle;
      vec2 offset = vec2(cos(theta), sin(theta)) * r * 5.5 * uTexel;
      vec3 col = texture2D(tDiffuse, clamp(vUv + offset, 0.002, 0.998)).rgb;
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      // Bokeh ball specular boost in out-of-focus lights
      float weight = 1.0 + smoothstep(0.68, 1.25, luma) * 2.35;
      acc += col * weight;
      wSum += weight;
    }

    gl_FragColor = vec4(acc / max(wSum, 0.0001), 1.0);
  }
`;

// Pass 2: Composite Crisp Focal Plane + Creamy Tilt-Shift Macro Blur + Photographic Film Grade
const tiltShiftCompositeFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tSharp;
  uniform sampler2D tBlur;
  uniform float uFocusY;
  uniform float uFocusHalfBand;
  uniform float uTime;
  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 acesFilm(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    // Tilt-shift focal band: keeps kakigori bowl, front syrup/strawberry trays, shaver handle & customer face tack-sharp,
    // while softly blurring top background (noren, bokeh lights, garden) & very bottom counter lip!
    float distTop = smoothstep(0.68, 0.96, vUv.y);
    float distBot = smoothstep(0.14, 0.01, vUv.y);
    float edgeX = smoothstep(0.44, 0.58, abs(vUv.x - 0.5)) * 0.18;
    float coc = clamp(max(distTop * 0.96, distBot * 0.82) + edgeX * (distTop + distBot), 0.0, 1.0);

    // Subtle macro lens chromatic fringe only in blurred periphery
    vec2 caShift = (vUv - 0.5) * 0.0026 * coc;
    vec3 sharpCol = texture2D(tSharp, vUv).rgb;
    vec3 blurCol;
    blurCol.r = texture2D(tBlur, clamp(vUv + caShift, 0.002, 0.998)).r;
    blurCol.g = texture2D(tBlur, vUv).g;
    blurCol.b = texture2D(tBlur, clamp(vUv - caShift, 0.002, 0.998)).b;

    vec3 col = mix(sharpCol, blurCol, smoothstep(0.0, 1.0, coc));

    // Warm miniature studio photographic color science (Kodak Portra / sunlit macro)
    col *= vec3(1.03, 1.005, 0.965);
    col = acesFilm(col * 1.06);

    // Gentle saturation boost for tactile miniature craft pigments
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, 1.14);

    // Natural macro optical vignette
    vec2 vigUv = vUv - 0.5;
    float vig = 1.0 - dot(vigUv * vec2(0.95, 1.05), vigUv * vec2(0.95, 1.05)) * 0.52;
    col *= clamp(vig, 0.65, 1.0);

    // Linear -> sRGB gamma + ultra-subtle analog film grain
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
    float grain = (hash12(vUv * 680.0 + fract(uTime * 0.37)) - 0.5) * 0.018;
    col = clamp(col + grain, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class TiltShiftPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.sceneTriangles = 0;
    this.sceneCalls = 0;
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geo = new THREE.PlaneGeometry(2, 2);

    this.sharpRT = new THREE.WebGLRenderTarget(800, 600, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    // MSAA on sharp target for silky smooth glass & cast-iron rims on WebGL2
    this.sharpRT.samples = 4;

    this.blurRT1 = new THREE.WebGLRenderTarget(400, 300, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.blurRT2 = new THREE.WebGLRenderTarget(400, 300, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: bokehBlurFrag,
      uniforms: {
        tDiffuse: { value: null },
        uTexel: { value: new THREE.Vector2(1 / 400, 1 / 300) },
        uAngle: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.compMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: tiltShiftCompositeFrag,
      uniforms: {
        tSharp: { value: this.sharpRT.texture },
        tBlur: { value: this.blurRT2.texture },
        uFocusY: { value: 0.49 },
        uFocusHalfBand: { value: 0.25 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(geo, this.blurMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(cssWidth, cssHeight, dpr) {
    const rawW = Math.max(2, Math.floor(cssWidth * dpr));
    const rawH = Math.max(2, Math.floor(cssHeight * dpr));
    // Strictly cap render targets <= 1024px in BOTH dimensions per <=1024px texture spec
    const scale = Math.min(1.0, 1024 / Math.max(rawW, rawH));
    const w = Math.max(2, Math.floor(rawW * scale));
    const h = Math.max(2, Math.floor(rawH * scale));

    const bw = Math.max(2, Math.floor(w * 0.48));
    const bh = Math.max(2, Math.floor(h * 0.48));

    this.sharpRT.setSize(w, h);
    this.blurRT1.setSize(bw, bh);
    this.blurRT2.setSize(bw, bh);
    this.blurMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);

    // Portrait screens have slightly taller central focus span
    const isPortrait = cssWidth / cssHeight < 0.85;
    this.compMat.uniforms.uFocusY.value = isPortrait ? 0.48 : 0.50;
    this.compMat.uniforms.uFocusHalfBand.value = isPortrait ? 0.27 : 0.25;
  }

  render(scene, camera, elapsed) {
    // 1. Render main 3D miniature scene into sharpRT
    this.renderer.setRenderTarget(this.sharpRT);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.sceneTriangles = this.renderer.info.render.triangles;
    this.sceneCalls = this.renderer.info.render.calls;

    // 2. Two-pass rotated Vogel disc bokeh blur at half-res
    this.quad.material = this.blurMat;
    this.blurMat.uniforms.tDiffuse.value = this.sharpRT.texture;
    this.blurMat.uniforms.uAngle.value = 0.0;
    this.renderer.setRenderTarget(this.blurRT1);
    this.renderer.render(this.quadScene, this.quadCam);

    this.blurMat.uniforms.tDiffuse.value = this.blurRT1.texture;
    this.blurMat.uniforms.uAngle.value = 1.0472;
    this.renderer.setRenderTarget(this.blurRT2);
    this.renderer.render(this.quadScene, this.quadCam);

    // 3. Composite tilt-shift focal plane + filmic grade directly to screen
    this.quad.material = this.compMat;
    this.compMat.uniforms.tSharp.value = this.sharpRT.texture;
    this.compMat.uniforms.tBlur.value = this.blurRT2.texture;
    this.compMat.uniforms.uTime.value = elapsed;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}
