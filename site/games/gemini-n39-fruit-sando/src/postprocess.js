import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Extract bright morning window glints & wet fruit highlights for dreamy optical bloom
const BRIGHT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  varying vec2 vUv;

  void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float knee = 0.35;
    float soft = clamp((luma - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
    soft = soft * soft;
    float contrib = max(luma - uThreshold, soft * knee * 0.5) / max(luma, 0.0001);
    gl_FragColor = vec4(col * contrib, 1.0);
  }
`;

// Separable 9-tap Gaussian blur for silky morning window halation
const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    vec2 stepUv = uDirection * uTexelSize;
    vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;
    sum += texture2D(tDiffuse, vUv + stepUv * 1.384615).rgb * 0.316216;
    sum += texture2D(tDiffuse, vUv - stepUv * 1.384615).rgb * 0.316216;
    sum += texture2D(tDiffuse, vUv + stepUv * 3.230769).rgb * 0.070270;
    sum += texture2D(tDiffuse, vUv - stepUv * 3.230769).rgb * 0.070270;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

// Optical Macro Bokeh DoF (16-tap Golden-Angle Spiral with Highlight Bokeh Disc Weighting)
// + Morning Window Halation Bloom + High-Saturation Japanese Food-CM Filmic Grading
const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform sampler2D tBloom;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocusDist;
  uniform float uFocusRange;
  uniform float uMaxBlur;
  uniform float uBloomStrength;
  uniform float uExposure;
  uniform float uSaturation;
  varying vec2 vUv;

  float linearizeDepth(float depth) {
    float z = depth * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / max(uFar + uNear - z * (uFar - uNear), 0.0001);
  }

  // Signed Circle of Confusion (0 = razor sharp, 1 = full dreamy macro bokeh)
  float computeCoC(float linDepth) {
    float diff = linDepth - uFocusDist;
    // Slightly gentler foreground falloff, lush creamy background bokeh falloff
    float range = diff < 0.0 ? uFocusRange * 1.15 : uFocusRange;
    float coc = clamp(abs(diff) / max(range, 0.1), 0.0, 1.0);
    // Smooth optical transition around focus plane
    return smoothstep(0.06, 1.0, coc);
  }

  // ACES Filmic approximation tuned for luminous Japanese food commercial photography
  vec3 acesFoodCM(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    float centerDepth = linearizeDepth(texture2D(tDepth, vUv).r);
    float centerCoC = computeCoC(centerDepth);
    vec3 centerCol = texture2D(tDiffuse, vUv).rgb;

    vec2 invRes = 1.0 / uResolution;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 radiusScale = vec2(uMaxBlur * invRes.y / aspect, uMaxBlur * invRes.y);

    // 24-tap Vogel golden-angle optical bokeh disc (silky creamy 85mm f/1.4 blur with zero stepping!)
    vec3 acc = centerCol;
    float totalW = 1.0;

    if (centerCoC > 0.012) {
      const float GOLDEN_ANGLE = 2.39996323;
      for (int i = 1; i <= 24; i++) {
        float fi = float(i);
        float r = sqrt(fi / 24.0);
        float theta = fi * GOLDEN_ANGLE;
        vec2 dir = vec2(cos(theta), sin(theta));
        vec2 sampleUv = clamp(vUv + dir * r * centerCoC * radiusScale, vec2(0.002), vec2(0.998));

        float sDepth = linearizeDepth(texture2D(tDepth, sampleUv).r);
        float sCoC = computeCoC(sDepth);
        vec3 sCol = texture2D(tDiffuse, sampleUv).rgb;

        // Prevent sharp foreground edges from leaking halos into blurred background
        float bleed = sDepth < centerDepth ? clamp(sCoC * 1.35, 0.0, 1.0) : 1.0;

        // Smooth optical lens disc weighting: bright speculars expand into creamy circular bokeh orbs (玉ボケ)!
        float sLuma = dot(sCol, vec3(0.2126, 0.7152, 0.0722));
        float bokehBoost = 1.0 + pow(clamp(sLuma - 0.65, 0.0, 3.0), 2.0) * 2.8;
        float softDisc = mix(1.0, 0.85, smoothstep(0.78, 1.0, r));

        float w = bleed * bokehBoost * softDisc;
        acc += sCol * w;
        totalW += w;
      }
    }

    vec3 color = acc / totalW;

    // Add silky sunlit morning window bloom halation
    vec3 bloom = texture2D(tBloom, vUv).rgb;
    color += bloom * uBloomStrength;

    // Subtle warm sunlit upper-left morning window veil (authentic lens flare feel in backlight)
    float sunProximity = 1.0 - smoothstep(0.0, 0.88, length((vUv - vec2(0.16, 0.94)) * vec2(1.15, 1.45)));
    color += vec3(1.0, 0.91, 0.72) * sunProximity * 0.045;

    // Exposure & Food-CM Filmic Tone Mapping
    color *= uExposure;
    color = acesFoodCM(color);

    // High-saturation food commercial vibrance (boosts juicy crimson, emerald, tangerine while keeping cream ivory clean!)
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float maxC = max(color.r, max(color.g, color.b));
    float minC = min(color.r, min(color.g, color.b));
    float sat = maxC - minC;
    // Selective vibrance + rich chroma
    float boost = mix(uSaturation, uSaturation * 0.95, sat);
    color = mix(vec3(luma), color, boost);

    // Crisp food-photography midtone contrast & warm sunlit morning balance
    color = pow(clamp(color, 0.0, 1.0), vec3(1.06));
    color *= vec3(1.025, 1.005, 0.975);

    // Subtle warm photographic lens frame
    float distEdge = length((vUv - 0.5) * vec2(1.0, 0.92));
    float softEdge = smoothstep(0.52, 1.06, distEdge);
    color = mix(color, color * vec3(0.9, 0.86, 0.81), softEdge * 0.3);

    // Linear -> sRGB
    color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class MacroPostProcessor {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const isWebGL2 = renderer.capabilities.isWebGL2;
    const texType = isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;

    // Main scene render target with hardware DepthTexture
    this.depthTexture = new THREE.DepthTexture(this.width, this.height);
    this.depthTexture.type = THREE.UnsignedIntType;
    this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.magFilter = THREE.NearestFilter;

    this.sceneRT = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: texType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      depthTexture: this.depthTexture,
    });

    const bw = Math.max(2, Math.floor(this.width * 0.5));
    const bh = Math.max(2, Math.floor(this.height * 0.5));
    const bloomOpts = {
      type: texType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    };
    this.bloomRT1 = new THREE.WebGLRenderTarget(bw, bh, bloomOpts);
    this.bloomRT2 = new THREE.WebGLRenderTarget(bw, bh, bloomOpts);

    // Fullscreen triangle-pair quad
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BRIGHT_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 1.25 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uTexelSize: { value: new THREE.Vector2(1 / bw, 1 / bh) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tDiffuse: { value: this.sceneRT.texture },
        tDepth: { value: this.depthTexture },
        tBloom: { value: this.bloomRT1.texture },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uNear: { value: 0.25 },
        uFar: { value: 32.0 },
        uFocusDist: { value: 4.5 },
        uFocusRange: { value: 2.3 },
        uMaxBlur: { value: 18.0 },
        uBloomStrength: { value: 0.36 },
        uExposure: { value: 1.06 },
        uSaturation: { value: 1.24 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(quadGeo, this.compositeMat);
    this.quadScene.add(this.quadMesh);
  }

  setSize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;

    this.sceneRT.setSize(w, h);
    const bw = Math.max(2, Math.floor(w * 0.5));
    const bh = Math.max(2, Math.floor(h * 0.5));
    this.bloomRT1.setSize(bw, bh);
    this.bloomRT2.setSize(bw, bh);
    this.blurMat.uniforms.uTexelSize.value.set(1 / bw, 1 / bh);
    this.compositeMat.uniforms.uResolution.value.set(w, h);
  }

  setFocus({ focusDist, focusRange = 2.2, maxBlur = 19.0, bloomStrength = 0.36, exposure = 1.06, saturation = 1.24 } = {}) {
    const u = this.compositeMat.uniforms;
    if (focusDist !== undefined) u.uFocusDist.value = focusDist;
    if (focusRange !== undefined) u.uFocusRange.value = focusRange;
    if (maxBlur !== undefined) u.uMaxBlur.value = maxBlur;
    if (bloomStrength !== undefined) u.uBloomStrength.value = bloomStrength;
    if (exposure !== undefined) u.uExposure.value = exposure;
    if (saturation !== undefined) u.uSaturation.value = saturation;
  }

  render(scene, camera) {
    this.compositeMat.uniforms.uNear.value = camera.near;
    this.compositeMat.uniforms.uFar.value = camera.far;

    // 1. Render main 3D scene into HDR color + depth buffer
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.sceneTriangles = this.renderer.info.render.triangles;
    this.sceneCalls = this.renderer.info.render.calls;

    // 2. Half-res bright pass
    this.brightMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.quadMesh.material = this.brightMat;
    this.renderer.setRenderTarget(this.bloomRT1);
    this.renderer.render(this.quadScene, this.quadCamera);

    // 3. Separable Gaussian blur (2 iterations for extra silky morning glow)
    this.quadMesh.material = this.blurMat;
    for (let i = 0; i < 2; i++) {
      const spread = i === 0 ? 1.35 : 2.6;
      this.blurMat.uniforms.tDiffuse.value = this.bloomRT1.texture;
      this.blurMat.uniforms.uDirection.value.set(spread, 0);
      this.renderer.setRenderTarget(this.bloomRT2);
      this.renderer.render(this.quadScene, this.quadCamera);

      this.blurMat.uniforms.tDiffuse.value = this.bloomRT2.texture;
      this.blurMat.uniforms.uDirection.value.set(0, spread);
      this.renderer.setRenderTarget(this.bloomRT1);
      this.renderer.render(this.quadScene, this.quadCamera);
    }

    // 4. Final Optical Bokeh DoF + Bloom + Food-CM Grading to screen
    this.compositeMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.compositeMat.uniforms.tDepth.value = this.depthTexture;
    this.compositeMat.uniforms.tBloom.value = this.bloomRT1.texture;
    this.quadMesh.material = this.compositeMat;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
