// flame vertex shader
export const flameVertexShader = `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uSeed;

    void main() {
        vUv = uv;
        vec3 pos = position;
        float t = uv.y;

        // wobble more toward the top
        pos.x += sin(uTime * 5.5 + uSeed + position.y * 1.4) * 0.55 * t;
        pos.z += cos(uTime * 4.7 + uSeed * 0.8 + position.y * 1.7) * 0.55 * t;

        // pinch flame upward to give it a peaked silhouette
        pos.xz *= mix(1.0, 0.35, smoothstep(0.4, 1.0, t));

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

// flame fragment shader
export const flameFragmentShader = `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec3 uColorHot;
    uniform vec3 uColorMid;
    uniform vec3 uColorCool;

    void main() {
        float t = vUv.y;

        vec3 col = mix(uColorHot, uColorMid, smoothstep(0.0, 0.45, t));
        col = mix(col, uColorCool, smoothstep(0.45, 1.0, t));

        float topFade = 1.0 - smoothstep(0.55, 1.0, t);
        float bottomFade = smoothstep(0.0, 0.05, t);
        float flicker = 0.82 + sin(uTime * 16.0 + vUv.x * 12.0) * 0.1 + sin(uTime * 27.0) * 0.06;
        float a = topFade * bottomFade * uIntensity * flicker;

        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    }
`;

// spark vertex shader
export const sparkVertexShader = `
    attribute float aLife;
    attribute float aMaxLife;
    attribute float aSize;

    varying float vLifePct;
    uniform float uPixelRatio;

    void main() {
        vLifePct = clamp(aLife / aMaxLife, 0.0, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float size = aSize * (1.0 - vLifePct * 0.55);
        gl_PointSize = size * uPixelRatio * (180.0 / -mvPosition.z);
    }
`;

// spark fragment shader
export const sparkFragmentShader = `
    varying float vLifePct;
    uniform sampler2D uTex;
    uniform float uOpacity;

    void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);

        vec3 hot = vec3(1.0, 1.0, 0.78);
        vec3 mid = vec3(1.0, 0.55, 0.15);
        vec3 cool = vec3(0.55, 0.05, 0.0);

        vec3 col = mix(hot, mid, smoothstep(0.0, 0.45, vLifePct));
        col = mix(col, cool, smoothstep(0.45, 1.0, vLifePct));

        float a = tex.a * (1.0 - vLifePct) * uOpacity;
        if (a < 0.005) discard;

        gl_FragColor = vec4(col, a);
    }
`;

// smoke vertex shader
export const smokeVertexShader = `
    attribute float aLife;
    attribute float aMaxLife;
    attribute float aSize;
    attribute float aRotation;

    varying float vLifePct;
    varying float vRotation;
    uniform float uPixelRatio;

    void main() {
        vLifePct = clamp(aLife / aMaxLife, 0.0, 1.0);
        vRotation = aRotation;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // smoke puffs grow as they age
        float size = mix(aSize * 0.45, aSize * 2.6, vLifePct);
        gl_PointSize = size * uPixelRatio * (160.0 / -mvPosition.z);
    }
`;

// smoke fragment shader
export const smokeFragmentShader = `
    varying float vLifePct;
    varying float vRotation;
    uniform sampler2D uTex;
    uniform float uOpacity;
    uniform vec3 uWarm;
    uniform vec3 uCool;

    void main() {
        vec2 coord = gl_PointCoord - 0.5;
        float c = cos(vRotation);
        float s = sin(vRotation);
        coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c) + 0.5;
        vec4 tex = texture2D(uTex, coord);

        vec3 col = mix(uWarm, uCool, smoothstep(0.05, 0.55, vLifePct));

        float fadeIn = smoothstep(0.0, 0.18, vLifePct);
        float fadeOut = 1.0 - smoothstep(0.55, 1.0, vLifePct);
        float a = tex.a * fadeIn * fadeOut * uOpacity;
        if (a < 0.003) discard;

        gl_FragColor = vec4(col, a);
    }
`;
