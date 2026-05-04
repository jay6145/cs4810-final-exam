// aurora borealis vertex shader -- gently waves the plane
export const auroraVertexShader = `
    varying vec2 vUv;
    uniform float uTime;

    void main() {
        vUv = uv;
        vec3 p = position;
        // long slow waves so the curtain undulates instead of staying flat
        p.z += sin(p.x * 0.012 + uTime * 0.3) * 6.0;
        p.z += cos(p.x * 0.027 - uTime * 0.18) * 3.0;
        p.y += sin(p.x * 0.04 + uTime * 0.6) * 1.4;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

// aurora borealis fragment shader -- animated layered noise into a green/violet gradient
export const auroraFragmentShader = `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;

    // hash and value noise that's cheap on the GPU
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
        float sum = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
            sum += noise(p) * amp;
            p *= 2.05;
            amp *= 0.5;
        }
        return sum;
    }

    void main() {
        vec2 uv = vUv;

        // streak the curtain vertically with a flowing fbm
        float n = fbm(vec2(uv.x * 4.0 + uTime * 0.18, uv.y * 1.2 - uTime * 0.05));
        float curtain = smoothstep(0.32, 0.85, n);

        // soft top/bottom falloff so the band doesn't hit the horizon abruptly
        float vertical = smoothstep(0.0, 0.25, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y));

        // color gradient drifts along the curtain
        vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.7, n));
        col = mix(col, uColorC, smoothstep(0.55, 1.1, n + uv.y * 0.2));

        float alpha = curtain * vertical * uIntensity;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(col * (0.7 + n), alpha);
    }
`;

// falling leaves vertex shader -- rotates each leaf and drifts it through wind
export const leafVertexShader = `
    attribute float aSeed;
    attribute float aSize;
    varying float vSeed;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uPixelRatio;

    void main() {
        vSeed = aSeed;
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aSize * uPixelRatio * (220.0 / -mvPosition.z);
    }
`;

// falling leaves fragment shader -- procedural maple leaf shape with rotation
export const leafFragmentShader = `
    varying float vSeed;
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;

    void main() {
        // rotate the point sprite uv by a per-leaf angle so leaves spin
        vec2 c = gl_PointCoord - 0.5;
        float ang = vSeed * 6.28318 + uTime * (0.6 + fract(vSeed * 7.3) * 1.5);
        float s = sin(ang);
        float co = cos(ang);
        vec2 r = vec2(c.x * co - c.y * s, c.x * s + c.y * co);

        // a simple procedural maple-ish silhouette using polar shaping
        float radius = length(r);
        float theta = atan(r.y, r.x);
        float petals = 0.32 + 0.13 * cos(theta * 5.0);
        float mask = smoothstep(petals, petals - 0.05, radius);

        if (mask < 0.05) discard;

        // pick one of three autumn colors per leaf based on the seed
        vec3 col;
        float pick = fract(vSeed * 13.7);
        if (pick < 0.34) col = uColorA;
        else if (pick < 0.67) col = uColorB;
        else col = uColorC;

        // little vein darkening down the center for character
        float vein = smoothstep(0.04, 0.0, abs(r.y));
        col *= 1.0 - vein * 0.25;

        gl_FragColor = vec4(col, mask);
    }
`;
