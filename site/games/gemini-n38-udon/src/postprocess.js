import * as THREE from '../vendor/three.module.js';

/**
 * Custom lightweight Showa 35mm Faded Film Post-Processing Pipeline:
 * - Warm bare-bulb halation / soft specular bloom
 * - Authentic 1970s faded Japanese film curve (lifted dusty cool shadows, warm tungsten highlights)
 * - Overhead single-bulb natural corner falloff / vignette
 * - Subtle vintage lens edge chromatic micro-fringe
 * - Animated organic 35mm film grain noise
 */
export class ShowaFilmPostProcess {
  constructor(renderer) {
    this.renderer = renderer;
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);

    this.renderTarget = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 4,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      tDiffuse: { value: this.renderTarget.texture },
      uResolution: { value: new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)) },
      uTime: { value: 0 },
      uGrainStrength: { value: 0.058 },
      uVignette: { value: 0.70 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform float uGrainStrength;
        uniform float uVignette;
        varying vec2 vUv;

        // Fast ACES filmic tone map
        vec3 acesFilm(vec3 x) {
          const float a = 2.51;
          const float b = 0.03;
          const float c = 2.43;
          const float d = 0.59;
          const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        // High-frequency organic film grain hash
        float filmHash(vec2 p, float t) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031 + fract(t * 0.137));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec2 uv = vUv;
          vec2 center = uv - vec2(0.49, 0.51);
          float dist = length(center);
          vec2 texel = 1.0 / uResolution;

          // Micro vintage-lens chromatic aberration near outer corners
          float ca = dist * dist * 0.0022;
          vec2 dir = dist > 0.0001 ? normalize(center) : vec2(0.0);
          float r = texture2D(tDiffuse, uv + dir * ca).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv - dir * ca).b;
          vec3 col = vec3(r, g, b);

          // Warm bare-bulb halation / soft bloom ONLY around crisp HDR specular glints & flame
          vec3 bloom = vec3(0.0);
          float radius = 3.0;
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2( radius,  0.0)).rgb - 1.05);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2(-radius,  0.0)).rgb - 1.05);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2( 0.0,  radius)).rgb - 1.05);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2( 0.0, -radius)).rgb - 1.05);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2( radius * 1.9,  radius * 1.9)).rgb - 1.12);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2(-radius * 1.9,  radius * 1.9)).rgb - 1.12);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2( radius * 1.9, -radius * 1.9)).rgb - 1.12);
          bloom += max(vec3(0.0), texture2D(tDiffuse, uv + texel * vec2(-radius * 1.9, -radius * 1.9)).rgb - 1.12);
          bloom *= 0.125;
          col += bloom * vec3(0.42, 0.28, 0.16);

          // Exposure & Filmic curve (moody winter night exposure!)
          col *= 0.94;
          col = acesFilm(col);

          // Convert linear to sRGB-like gamma before faded film print grading
          col = pow(col, vec3(1.0 / 2.2));

          // Showa faded 35mm film color grading (1970s low-light pushed tungsten print):
          float luma = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(luma), col, 0.84);

          vec3 shadowTint = vec3(0.028, 0.036, 0.048); // Deep cool midwinter-night lifted film black
          vec3 midWarm = vec3(1.045, 0.975, 0.875);    // Warm bare tungsten bulb cast
          vec3 highFade = vec3(0.96, 0.935, 0.88);     // Soft nostalgic faded highlight ceiling

          col = col * midWarm;
          col = mix(shadowTint, highFade, smoothstep(0.0, 1.03, col));

          // Gentle cinematic contrast
          col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

          // Strong overhead bare-bulb falloff into winter-night dark edges
          float vig = 1.0 - smoothstep(0.22, 0.86, dist) * uVignette;
          col *= vig;

          // Organic 35mm film grain (stronger in shadow/midtone, fine in highlights)
          float n1 = filmHash(gl_FragCoord.xy, floor(uTime * 24.0));
          float n2 = filmHash(gl_FragCoord.xy * 0.5 + 17.3, floor(uTime * 24.0) + 1.0);
          float grain = ((n1 + n2) - 1.0);
          float grainMask = (1.0 - luma * 0.55);
          col += grain * uGrainStrength * grainMask;

          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.postScene.add(quad);
  }

  resize(width, height, pixelRatio) {
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.renderTarget.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
  }

  render(scene, camera, time, onSceneRendered = null) {
    this.uniforms.uTime.value = time;
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(scene, camera);
    if (onSceneRendered) onSceneRendered();
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
