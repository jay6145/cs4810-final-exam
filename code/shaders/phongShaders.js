export const phongVertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      // Transform normal to camera (view) space
      vNormal = normalize(normalMatrix * normal);

      // Transform vertex to camera (view) space
      vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = viewPos.xyz;

      gl_Position = projectionMatrix * viewPos;
    }
  `;

export const phongFragmentShader = `
    uniform vec3 u_objectColor;
    uniform vec3 u_lightPos;       // Light position in VIEW space
    uniform vec3 u_lightColor;
    uniform float u_ambientStrength;
    uniform float u_diffuseStrength;
    uniform float u_specularStrength;
    uniform float u_shininess;
    uniform float u_bandCount;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);

      // --- Ambient ---
      vec3 ambient = u_ambientStrength * u_lightColor;

      // --- Diffuse ---
      // TODO (CP 1): Compute diffuse lighting.
      //   You need the light direction vector and the dot product with the normal.
      vec3 lightDir = normalize(u_lightPos - vViewPosition);

      // calculates intensity to be between 0 and 1
      float intensity = max(dot(normal, lightDir), 0.0);

      // applies toon shading by dividing intensity into bands and creating discrete steps
      float diff = floor(intensity*u_bandCount)/u_bandCount;
      // computes the diffuse color
      vec3 diffuse = diff * u_diffuseStrength * u_lightColor;

      // --- Specular (Blinn-Phong) ---
      // TODO (CP 1): Compute specular highlight using the Blinn-Phong model.
      //   You need the view direction and the half-vector.
      vec3 viewDir = normalize(-vViewPosition);
      // computes the half vector
      vec3 halfDir = normalize(lightDir + viewDir);

      // computes the specular intensity
      float spec = pow(max(dot(normal, halfDir), 0.0), u_shininess);
      // applies the smoothstep to specular intensity
      float specToon = smoothstep(0.5, 1.0, spec);
      // computes the specular color
      vec3 specular = specToon * u_specularStrength * u_lightColor;

      // --- Combine ---
      vec3 result = (ambient + diffuse + specular) * u_objectColor;
      gl_FragColor = vec4(result, 1.0);
    }
  `;
