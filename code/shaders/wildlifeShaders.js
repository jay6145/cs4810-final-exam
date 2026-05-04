// firefly vertex shader
export const fireflyVertexShader = `
    attribute float aSeed;
    varying float vPulse;
    uniform float uTime;
    uniform float uPixelRatio;

    void main() {
        // each firefly pulses on its own phase
        float pulse = 0.5 + 0.5 * sin(uTime * 2.5 + aSeed);
        vPulse = pulse;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (2.5 + pulse * 3.5) * uPixelRatio * (200.0 / -mvPosition.z);
    }
`;

// firefly fragment shader
export const fireflyFragmentShader = `
    varying float vPulse;
    uniform sampler2D uTex;
    uniform float uOpacity;

    void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        // warm yellow-green firefly glow
        vec3 col = vec3(0.95, 1.0, 0.45) * (0.55 + vPulse * 0.7);
        float a = tex.a * (0.25 + vPulse * 0.75) * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
    }
`;
