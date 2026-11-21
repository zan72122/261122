/* shaders & materials: liquid (vortex), pseudo-glass, stream, particles, blob shadows, glow.
   NaN guards: pow() bases are max(x,1e-4); normalize() replaced by safeN() with an epsilon. */
(function () {
  'use strict';
  var MJ = window.MJ;
  var SH = (MJ.SH = {});

  var COMMON = [
    'vec3 safeN(vec3 v){ return v * inversesqrt(max(dot(v,v), 1e-8)); }'
  ].join('\n');

  // ---------- fruit material: Phong + per-vertex texture mix (one material for every fruit) ----------
  SH.fruitMaterial = function (map) {
    var m = new THREE.MeshPhongMaterial({ map: map, vertexColors: true, shininess: 70, specular: 0x3a3a3a });
    m.onBeforeCompile = function (s) {
      s.vertexShader = 'attribute float texMix;\nvarying float vTexMix;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTexMix = texMix;');
      s.fragmentShader = 'varying float vTexMix;\n' + s.fragmentShader.replace('#include <map_fragment>',
        '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n diffuseColor.rgb *= mix(vec3(1.0), sampledDiffuseColor.rgb * 1.08, vTexMix);\n#endif');
    };
    m.customProgramCacheKey = function () { return 'fruitTexMix'; };
    return m;
  };

  // ---------- liquid ----------
  var LIQ_U = [
    'uniform float uLevel, uSpin, uTime, uPhase, uR0, uR1, uH, uY0, uDepth, uNewAmt, uFoam, uWave;',
    'uniform vec2 uSlope;',
    'uniform vec3 uColA, uColNew;',
    'uniform sampler2D uTex;',
    'float radAt(float y){ return mix(uR0, uR1, clamp(y / max(uH, 1e-3), 0.0, 1.0)); }'
  ].join('\n');
  var SURF = [
    'float surf(float rn, float th, vec2 q){',
    '  float funnel = uSpin * uDepth * exp(-rn * rn * 5.0);',
    '  float wave = ((0.015 + 0.035 * uSpin) * rn * sin(th * 3.0 - uTime * (2.0 + 9.0 * uSpin)) + 0.008 * sin(rn * 10.0 - uTime * 3.0)) * uWave;',
    '  return uLevel + uSlope.x * q.x + uSlope.y * q.y - funnel + uSpin * 0.14 * rn * rn + wave;',
    '}',
    'float hgt(vec2 q){',
    '  float Rl = max(radAt(uLevel), 0.05);',
    '  float l = length(q);',
    '  float rn = min(l / Rl, 1.0);',
    '  float th = l > 1e-5 ? atan(q.y, q.x) : 0.0;',
    '  return surf(rn, th, q);',
    '}'
  ].join('\n');
  var SHADE = [
    'vec3 juice(float tw, float rn, float L){',
    '  float arms = smoothstep(0.3, 0.9, 0.5 + 0.5 * sin(tw * 2.0 + rn * 6.0));',
    '  vec3 col = mix(uColA, uColNew, clamp(uNewAmt * (0.25 + 0.75 * arms), 0.0, 1.0));',
    '  return col * (0.72 + 0.42 * L);',
    '}',
    'vec3 lightIt(vec3 col, vec3 N, vec3 V, float specK){',
    '  vec3 Ld = safeN(vec3(-0.35, 0.9, 0.55));',
    '  float ndl = max(dot(N, Ld), 0.0);',
    '  vec3 Hh = safeN(Ld + V);',
    '  float sp = pow(max(dot(N, Hh), 1e-4), 48.0);',
    '  return col * (0.6 + 0.5 * ndl) + vec3(1.0) * sp * specK;',
    '}'
  ].join('\n');

  var TOP_VS = [COMMON, LIQ_U, SURF,
    'attribute vec2 polar;',
    'varying vec2 vPol; varying vec3 vN; varying vec3 vV;',
    'void main(){',
    '  float rn = polar.x, th = polar.y;',
    '  float Rl = max(radAt(uLevel), 0.05) * 0.985;',
    '  vec2 q = Rl * rn * vec2(cos(th), sin(th));',
    '  float y = clamp(hgt(q), uY0, uH + 0.02);',
    '  float e = 0.03;',
    '  vec3 n = vec3(hgt(q - vec2(e, 0.0)) - hgt(q + vec2(e, 0.0)), 2.0 * e, hgt(q - vec2(0.0, e)) - hgt(q + vec2(0.0, e)));',
    '  vec4 wp = modelMatrix * vec4(q.x, y, q.y, 1.0);',
    '  vN = safeN(mat3(modelMatrix) * safeN(n));',
    '  vV = cameraPosition - wp.xyz;',
    '  vPol = polar;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'].join('\n');
  var TOP_FS = [COMMON, LIQ_U, SHADE,
    'varying vec2 vPol; varying vec3 vN; varying vec3 vV;',
    'void main(){',
    '  float rn = vPol.x, th = vPol.y;',
    '  float tw = th + uPhase * (1.25 - rn) + rn * 2.5 * uSpin;',
    '  vec2 uv = 0.5 + 0.42 * rn * vec2(cos(tw), sin(tw));',
    '  float L = dot(texture2D(uTex, uv).rgb, vec3(0.3, 0.59, 0.11));',
    '  vec3 col = juice(tw, rn, L);',
    '  col = mix(col, vec3(1.0, 0.97, 0.93), uFoam * 0.3 * smoothstep(0.6, 0.0, rn) * smoothstep(0.25, 0.8, L));',
    '  col = lightIt(col, safeN(vN), safeN(vV), 0.5);',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <colorspace_fragment>',
    '}'].join('\n');
  var SIDE_VS = [COMMON, LIQ_U,
    'attribute vec2 polar;',
    'varying vec2 vPol; varying vec3 vN; varying vec3 vV; varying float vY;',
    'void main(){',
    '  float v = polar.x, th = polar.y;',
    '  float Rl = radAt(uLevel);',
    '  vec2 qt = Rl * vec2(cos(th), sin(th));',
    '  float ytop = clamp(uLevel + uSlope.x * qt.x + uSlope.y * qt.y + uSpin * 0.14, uY0, uH + 0.02);',
    '  float y = mix(uY0, ytop, v);',
    '  float R = radAt(y) * 0.985;',
    '  vec4 wp = modelMatrix * vec4(R * cos(th), y, R * sin(th), 1.0);',
    '  vN = safeN(mat3(modelMatrix) * vec3(cos(th), 0.0, sin(th)));',
    '  vV = cameraPosition - wp.xyz;',
    '  vPol = polar; vY = y;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'].join('\n');
  var SIDE_FS = [COMMON, LIQ_U, SHADE,
    'varying vec2 vPol; varying vec3 vN; varying vec3 vV; varying float vY;',
    'void main(){',
    '  float v = vPol.x, th = vPol.y;',
    '  float tw = th + uPhase * 0.7 + vY * 1.6 * uSpin;',
    '  vec2 uv = vec2(tw / 6.2831853 * 2.0, vY * 0.3);',
    '  float L = dot(texture2D(uTex, uv).rgb, vec3(0.3, 0.59, 0.11));',
    '  vec3 col = juice(tw, 0.9, L) * (0.78 + 0.22 * v);',
    '  col = lightIt(col, safeN(vN), safeN(vV), 0.25);',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <colorspace_fragment>',
    '}'].join('\n');

  // Creates a liquid body (top + side) for a container with radius r0 at y=0 and r1 at y=h.
  SH.makeLiquid = function (o, tex) {
    var u = {
      uLevel: { value: o.y0 }, uSpin: { value: 0 }, uTime: { value: 0 }, uPhase: { value: 0 },
      uR0: { value: o.r0 }, uR1: { value: o.r1 }, uH: { value: o.h }, uY0: { value: o.y0 },
      uDepth: { value: o.depth || 0 }, uNewAmt: { value: 0 }, uFoam: { value: 0 }, uWave: { value: o.wave === undefined ? 1 : o.wave },
      uSlope: { value: new THREE.Vector2() },
      uColA: { value: new THREE.Color(0xffb050) }, uColNew: { value: new THREE.Color(0xffb050) },
      uTex: { value: tex }
    };
    var top = new THREE.Mesh(MJ.G.polarDisc(o.disc[0], o.disc[1]), new THREE.ShaderMaterial({ uniforms: u, vertexShader: TOP_VS, fragmentShader: TOP_FS, side: THREE.DoubleSide }));
    var side = new THREE.Mesh(MJ.G.polarTube(o.side[0], o.side[1]), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SIDE_VS, fragmentShader: SIDE_FS }));
    top.frustumCulled = side.frustumCulled = false;
    top.renderOrder = side.renderOrder = 1;
    var g = new THREE.Group(); g.add(side); g.add(top);
    return { group: g, top: top, side: side, u: u };
  };

  // ---------- pseudo glass: opaque far wall (BackSide) + additive rim on the near wall ----------
  SH.glassBack = function () {
    return new THREE.MeshPhongMaterial({ color: 0xd3edf3, side: THREE.BackSide, shininess: 90, specular: 0x555555 });
  };
  SH.glassFront = function () {
    return new THREE.ShaderMaterial({
      uniforms: { uGlow: { value: 0 }, uK: { value: 1 } },
      vertexShader: [COMMON,
        'varying vec3 vN; varying vec3 vV;',
        'void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vN = safeN(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }'].join('\n'),
      fragmentShader: [COMMON,
        'uniform float uGlow, uK; varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vec3 N = safeN(vN), V = safeN(vV);',
        '  float f = pow(max(1.0 - abs(dot(N, V)), 1e-4), 2.2);',
        '  float d = dot(N, safeN(vec3(-0.55, 0.1, 0.83)));',
        '  float stripe = smoothstep(0.8, 0.88, d) * smoothstep(0.995, 0.93, d);',
        '  float d2 = dot(N, safeN(vec3(0.7, 0.1, 0.7)));',
        '  float stripe2 = smoothstep(0.9, 0.95, d2) * smoothstep(1.0, 0.97, d2);',
        '  vec3 col = vec3(0.8, 0.93, 1.0) * (f * 0.38 + stripe * 0.22 + stripe2 * 0.12) * uK + vec3(1.0, 0.85, 0.4) * uGlow * (0.15 + f * 0.6);',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <colorspace_fragment>',
        '}'].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
  };

  // ---------- pour stream: a tube bent along a quadratic curve in the vertex shader ----------
  SH.makeStream = function () {
    var geo = new THREE.CylinderGeometry(1, 1, 1, 8, 18, true);
    geo.translate(0, 0.5, 0); // y 0..1 = parameter t
    var u = { uP0: { value: new THREE.Vector3() }, uP1: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
      uW: { value: 0.05 }, uTime: { value: 0 }, uCol: { value: new THREE.Color() } };
    var mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: [COMMON,
        'uniform vec3 uP0, uP1, uC; uniform float uW, uTime; varying float vT; varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float t = position.y;',
        '  vec3 a = mix(uP0, uC, t), b = mix(uC, uP1, t), c = mix(a, b, t);',
        '  vec3 T = safeN(b - a + vec3(0.0, -1e-4, 0.0));',
        '  vec3 B = safeN(cross(T, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0));',
        '  vec3 N2 = safeN(cross(T, B));',
        '  float w = uW * (1.0 - 0.3 * t) * (1.0 + 0.22 * sin(t * 22.0 - uTime * 18.0));',
        '  vec3 dir = position.x * B + position.z * N2;',
        '  vec3 wp = c + dir * w;',
        '  vN = safeN(dir); vV = cameraPosition - wp; vT = t;',
        '  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);',
        '}'].join('\n'),
      fragmentShader: [COMMON,
        'uniform vec3 uCol; uniform float uTime; varying float vT; varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vec3 N = safeN(vN), V = safeN(vV);',
        '  float f = max(dot(N, V), 0.0);',
        '  float band = 0.5 + 0.5 * sin(vT * 30.0 - uTime * 20.0);',
        '  vec3 col = uCol * (0.65 + 0.4 * f) + vec3(1.0) * pow(max(f, 1e-4), 12.0) * 0.35 + uCol * band * 0.12;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <colorspace_fragment>',
        '}'].join('\n')
    });
    var m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.visible = false; m.renderOrder = 2;
    return { mesh: m, u: u };
  };

  // ---------- particles: instanced billboards, shapes by SDF (0 soft dot, 1 heart, 2 star, 3 drop) ----------
  SH.makeParticles = function (max) {
    var base = new THREE.PlaneGeometry(1, 1);
    var g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    var aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    var aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    var aMisc = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // size, shape, alpha, rot
    [aPos, aCol, aMisc].forEach(function (a) { a.setUsage(THREE.DynamicDrawUsage); });
    g.setAttribute('iPos', aPos); g.setAttribute('iCol', aCol); g.setAttribute('iMisc', aMisc);
    g.instanceCount = 0;
    var mat = new THREE.ShaderMaterial({
      vertexShader: [
        'attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iMisc;',
        'varying vec2 vUv; varying vec3 vCol; varying float vShape; varying float vA;',
        'void main(){',
        '  vec4 mv = viewMatrix * vec4(iPos, 1.0);',
        '  float c = cos(iMisc.w), s = sin(iMisc.w);',
        '  vec2 p = mat2(c, s, -s, c) * position.xy;',
        '  mv.xy += p * iMisc.x;',
        '  vUv = uv; vCol = iCol; vShape = iMisc.y; vA = iMisc.z;',
        '  gl_Position = projectionMatrix * mv;',
        '}'].join('\n'),
      fragmentShader: [
        'varying vec2 vUv; varying vec3 vCol; varying float vShape; varying float vA;',
        'float dot2(vec2 v){ return dot(v, v); }',
        'float heart(vec2 p){ p.x = abs(p.x);',
        '  if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - 0.35355;',
        '  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y); }',
        'float star(vec2 p){ float a = atan(p.y, p.x + 1e-5); float r = length(p); float k = 0.3 + 0.16 * cos(a * 5.0); return r - k; }',
        'void main(){',
        '  vec2 p = vUv - 0.5; float a;',
        '  if (vShape < 0.5) a = smoothstep(0.5, 0.0, length(p));',
        '  else if (vShape < 1.5) a = smoothstep(0.04, -0.03, heart(vec2(p.x, -p.y) * 1.55 * vec2(1.0, -1.0) + vec2(0.0, 0.62)));',
        '  else if (vShape < 2.5) a = smoothstep(0.03, -0.02, star(p * 1.1));',
        '  else a = smoothstep(0.45, 0.35, length(p));',
        '  a *= vA; if (a < 0.01) discard;',
        '  vec3 col = vCol;',
        '  if (vShape > 0.5 && vShape < 2.5) col += 0.25 * smoothstep(0.2, -0.1, length(p - vec2(-0.1, 0.1)));',
        '  gl_FragColor = vec4(col, a);',
        '  #include <colorspace_fragment>',
        '}'].join('\n'),
      transparent: true, depthWrite: false
    });
    var mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
    return { mesh: mesh, aPos: aPos, aCol: aCol, aMisc: aMisc, max: max, geo: g };
  };

  // ---------- blob shadows: instanced flat quads on the counter ----------
  SH.makeShadows = function (max) {
    var base = new THREE.PlaneGeometry(1, 1); base.rotateX(-Math.PI / 2);
    var g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    var a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); a.setUsage(THREE.DynamicDrawUsage);
    var a2 = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); a2.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iS', a); g.setAttribute('iY', a2); g.instanceCount = 0;
    var mat = new THREE.ShaderMaterial({
      vertexShader: 'attribute vec4 iS; attribute vec2 iY; varying vec2 vUv; varying float vA;\nvoid main(){ vec3 p = vec3(position.x * iS.z + iS.x, iY.x + 0.004, position.z * iS.w + iS.y); vUv = uv; vA = iY.y; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying vec2 vUv; varying float vA;\nvoid main(){ float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, d) * vA; gl_FragColor = vec4(0.25, 0.14, 0.08, a); }',
      transparent: true, depthWrite: false
    });
    var mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -1;
    return { mesh: mesh, a: a, a2: a2, max: max, geo: g };
  };

  // ---------- hint glow ring (additive billboard) ----------
  SH.makeGlow = function () {
    var mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA, uT; varying vec2 vUv;\nvoid main(){ float d = length(vUv - 0.5) * 2.0; float ring = smoothstep(0.62, 0.8, d) * smoothstep(1.0, 0.82, d); float fill = smoothstep(1.0, 0.2, d) * 0.22; float a = (ring * (0.7 + 0.3 * sin(uT * 6.0)) + fill) * uA; gl_FragColor = vec4(vec3(1.0, 0.86, 0.35) * a, 1.0);\n #include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.renderOrder = 4; m.visible = false; m.frustumCulled = false;
    return m;
  };
})();
