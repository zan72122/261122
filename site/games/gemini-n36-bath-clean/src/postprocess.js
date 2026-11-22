import * as THREE from '../vendor/three.module.min.js';

/**
 * Lightweight 2-pass HDR Optical Tilt-Shift Miniature Photography Renderer
 * Renders linear HDR scene -> half-res optical tilt-shift bokeh -> ACESFilmic tone mapping + sRGB
 * Gives authentic macro miniature photography depth, specular pop, and warm sunlight feel.
 */
export class TiltShiftPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.width = 1;
    this.height = 1;
    this.lastSceneTriangles = 0;
    this.lastSceneCalls = 0;

    // HalfFloat linear HDR targets prevent blown-out highlights & double-gamma encoding
    const rtType = THREE.HalfFloatType;
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: rtType,
      samples: 2,
    });

    this.blurRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: rtType,
    });

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);

    // Pass 1: Horizontal optical bokeh blur (half-res)
    this.hBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        uFocusY: { value: 0.50 },
        uFocusWidth: { value: 0.24 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uTexelSize;
        uniform float uFocusY;
        uniform float uFocusWidth;
        varying vec2 vUv;

        void main() {
          float dist = abs(vUv.y - uFocusY + (vUv.x - 0.5) * 0.035);
          float coc = smoothstep(uFocusWidth, 0.50, dist);
          float r = coc * 3.4;

          vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
          sum += texture2D(tDiffuse, vUv + vec2(uTexelSize.x * 1.3846 * r, 0.0)) * 0.1945946;
          sum += texture2D(tDiffuse, vUv - vec2(uTexelSize.x * 1.3846 * r, 0.0)) * 0.1945946;
          sum += texture2D(tDiffuse, vUv + vec2(uTexelSize.x * 3.2307 * r, 0.0)) * 0.1216216;
          sum += texture2D(tDiffuse, vUv - vec2(uTexelSize.x * 3.2307 * r, 0.0)) * 0.1216216;
          sum += texture2D(tDiffuse, vUv + vec2(uTexelSize.x * 5.0 * r, 0.0)) * 0.0702703;
          sum += texture2D(tDiffuse, vUv - vec2(uTexelSize.x * 5.0 * r, 0.0)) * 0.0702703;
          gl_FragColor = sum;
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.hBlurScene = new THREE.Scene();
    this.hBlurScene.add(new THREE.Mesh(this.quadGeo, this.hBlurMat));

    // Pass 2: Vertical optical bokeh + ACESFilmic tone mapping + sRGB + warm macro color grade
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tSharp: { value: null },
        tBlur: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        uFocusY: { value: 0.50 },
        uFocusWidth: { value: 0.24 },
        uExposure: { value: 1.04 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSharp;
        uniform sampler2D tBlur;
        uniform vec2 uTexelSize;
        uniform float uFocusY;
        uniform float uFocusWidth;
        uniform float uExposure;
        varying vec2 vUv;

        // Narkowicz ACES Filmic Tone Mapping
        vec3 acesFilm(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          float dist = abs(vUv.y - uFocusY + (vUv.x - 0.5) * 0.035);
          float coc = smoothstep(uFocusWidth, 0.50, dist);
          float r = coc * 3.4;

          vec3 sharp = texture2D(tSharp, vUv).rgb;

          vec3 blur = texture2D(tBlur, vUv).rgb * 0.227027;
          blur += texture2D(tBlur, vUv + vec2(0.0, uTexelSize.y * 1.3846 * r)).rgb * 0.1945946;
          blur += texture2D(tBlur, vUv - vec2(0.0, uTexelSize.y * 1.3846 * r)).rgb * 0.1945946;
          blur += texture2D(tBlur, vUv + vec2(0.0, uTexelSize.y * 3.2307 * r)).rgb * 0.1216216;
          blur += texture2D(tBlur, vUv - vec2(0.0, uTexelSize.y * 3.2307 * r)).rgb * 0.1216216;
          blur += texture2D(tBlur, vUv + vec2(0.0, uTexelSize.y * 5.0 * r)).rgb * 0.0702703;
          blur += texture2D(tBlur, vUv - vec2(0.0, uTexelSize.y * 5.0 * r)).rgb * 0.0702703;

          // Blend sharp macro center with creamy optical tilt-shift bokeh
          vec3 hdr = mix(sharp, blur, smoothstep(0.04, 0.90, coc));

          // Exposure & Filmic Tone Mapping
          vec3 col = acesFilm(hdr * uExposure);

          // Linear -> sRGB encoding
          col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

          // Miniature photography filmic pop: slight saturation lift + subtle warm sunlight
          float luma = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(luma), col, 1.12);
          col *= vec3(1.015, 1.005, 0.99);

          // Soft photographic lens vignette
          vec2 center = vUv - 0.5;
          float vig = 1.0 - dot(center, center) * 0.34;
          col *= clamp(vig, 0.76, 1.0);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.finalScene = new THREE.Scene();
    this.finalScene.add(new THREE.Mesh(this.quadGeo, this.finalMat));
  }

  setSize(cssW, cssH, dpr) {
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;

    this.sceneRT.setSize(w, h);
    const bw = Math.max(1, Math.floor(w * 0.5));
    const bh = Math.max(1, Math.floor(h * 0.5));
    this.blurRT.setSize(bw, bh);

    this.hBlurMat.uniforms.uTexelSize.value.set(1 / bw, 1 / bh);
    this.finalMat.uniforms.uTexelSize.value.set(1 / bw, 1 / bh);
  }

  setFocus(focusY = 0.50, focusWidth = 0.24) {
    this.hBlurMat.uniforms.uFocusY.value = focusY;
    this.hBlurMat.uniforms.uFocusWidth.value = focusWidth;
    this.finalMat.uniforms.uFocusY.value = focusY;
    this.finalMat.uniforms.uFocusWidth.value = focusWidth;
  }

  render(scene, camera) {
    // 1. Render main 3D scene into linear HDR target
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(scene, camera);
    this.lastSceneTriangles = this.renderer.info.render.triangles;
    this.lastSceneCalls = this.renderer.info.render.calls;

    // 2. Horizontal bokeh blur -> blurRT (half res)
    this.hBlurMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.renderer.setRenderTarget(this.blurRT);
    this.renderer.render(this.hBlurScene, this.quadCam);

    // 3. Final tilt-shift composite + ACESFilmic + sRGB -> screen
    this.finalMat.uniforms.tSharp.value = this.sceneRT.texture;
    this.finalMat.uniforms.tBlur.value = this.blurRT.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.finalScene, this.quadCam);
  }
}
