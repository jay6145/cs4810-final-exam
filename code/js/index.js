import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import GUI from 'lil-gui';

// ===================== Scene Variables =====================
let scene, camera, renderer, controls;
let objects = [];      // Array of { mesh, material, name }
let sunMesh;           // The visible sun sphere
let gui;

// Animation state
let sunAngle = 0;
let isSunAnimating = false;
let sunSpeed = 0.0005;
const sunRadius = 150;  // Orbit radius of the sun

// ===================== Phong Vertex Shader =====================
const phongVertexShader = `
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

// ===================== Phong Fragment Shader =====================
const phongFragmentShader = `
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

// ===================== Init =====================
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Camera
    camera = new THREE.PerspectiveCamera(
        70, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.set(0, 40, 200);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(20);
    scene.add(axesHelper);


    // ===================== Create Scene Objects =====================
    createObjects();

    // ===================== Create Sun =====================
    createSun();

    // ===================== GUI =====================
    setupGUI();

    // ===================== Button Wiring =====================
    setupButtons();

    // ===================== Handle Resize =====================
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Start render loop
    animate();
}

// ===================== Create Shader Material =====================
function createPhongMaterial(color) {
    return new THREE.ShaderMaterial({
        uniforms: {
            u_objectColor: { value: new THREE.Color(color) },
            u_lightPos: { value: new THREE.Vector3(40, 30, 0) },
            u_lightColor: { value: new THREE.Color(1, 1, 1) },
            u_ambientStrength: { value: 0.15 },
            u_diffuseStrength: { value: 0.7 },
            u_specularStrength: { value: 0.5 },
            u_shininess: { value: 32.0 },
            u_bandCount: { value: 4.0 },
        },
        vertexShader: phongVertexShader,
        fragmentShader: phongFragmentShader,
    });
}

// ===================== Create Objects =====================
function createObjects() {

    // --- Teapot ---
    const teapotGeo = new TeapotGeometry(7);
    const teapotMat = createPhongMaterial('#FF6B6B');  // Coral red
    const teapotMesh = new THREE.Mesh(teapotGeo, teapotMat);
    teapotMesh.position.set(0, 7, 0);
    scene.add(teapotMesh);
    objects.push({ mesh: teapotMesh, material: teapotMat, name: 'Teapot' });

    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x4a7c59 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;  // Rotate flat
    scene.add(groundMesh);

    // scatter trees around the field
    createTree(-60, -50);
    createTree(-80, -20);
    createTree(-50, -60);
    createTree(60, -90);
    createTree(80, -40);
    createTree(50, -70);
    createTree(-30, -80);
    createTree(30, -70);
    createTree(90, -20);
    createTree(-90, -10);
}

// ===================== Create Sun =====================
function createSun() {
    // TODO (CP 0): Create a visible sun sphere and add it to the scene.
    //   Think about which material type makes sense for a glowing light source.
    const sunGeo = new THREE.SphereGeometry(10, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(sunRadius, 25, 0);
    scene.add(sunMesh);

}

// ===================== Create Tree ======================
function createTree(x, z) {
    const trunkGeo = new THREE.CylinderGeometry(1, 1, 10, 8);
    const trunkMat = createPhongMaterial('#8B4513');
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 5, z);
    scene.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(8, 20, 8);
    const leavesMat = createPhongMaterial('#228B22');
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, 15, z);
    scene.add(leaves);
}

// ===================== GUI Setup =====================
function setupGUI() {
    gui = new GUI({ container: document.getElementById('gui-container') });

    // Sun controls
    const sunFolder = gui.addFolder('Sun');
    sunFolder.add({ speed: sunSpeed }, 'speed', 0.0001, 0.01, 0.0001)
        .name('Rotation Speed')
        .onChange(v => sunSpeed = v);
    sunFolder.open();

    // --- Phong Parameters (CP 2) ---
    const phongFolder = gui.addFolder('Phong Parameters');
    // TODO (CP 2): Add sliders for ambientStrength, diffuseStrength,
    //   specularStrength, and shininess that update the uniforms
    //   on ALL materials in the objects array.
    phongFolder.open();

    // adds slider for ambient strength
    phongFolder.add({ ambient: 0.15 }, 'ambient', 0, 1, 0.01)
        .name('Ambient')
        .onChange(v => {
            objects.forEach(obj => obj.material.uniforms.u_ambientStrength.value = v);
        });
    // adds slider diffuse strength
    phongFolder.add({ diffuse: 0.7 }, 'diffuse', 0, 2, 0.01)
        .name('Diffuse')
        .onChange(v => {
            objects.forEach(obj => obj.material.uniforms.u_diffuseStrength.value = v);
        });
    // adds specular strength slider
    phongFolder.add({ specular: 0.5 }, 'specular', 0, 2, 0.01)
        .name('Specular')
        .onChange(v => {
            objects.forEach(obj => obj.material.uniforms.u_specularStrength.value = v);
        });
    // adds shininess slider
    phongFolder.add({ shininess: 32.0 }, 'shininess', 2, 256, 1)
        .name('Shininess')
        .onChange(v => {
            objects.forEach(obj => obj.material.uniforms.u_shininess.value = v);
        });

    // --- Per-Object Controls ---
    const objFolder = gui.addFolder('Objects');
    objects.forEach(obj => {
        const f = objFolder.addFolder(obj.name);
        f.add(obj.mesh, 'visible').name('Visible');
        // TODO (CP 2): Add a color picker for obj.material.uniforms.u_objectColor
        const colorParams = {
            color: '#' + obj.material.uniforms.u_objectColor.value.getHexString()
        };
        // adds color picker for object color
        f.addColor(colorParams, 'color')
            .name('Object Color')
            .onChange(v => {
                obj.material.uniforms.u_objectColor.value.set(v);
            });
        f.open();
    });
    objFolder.open();

    // --- Toon Shader (CP 3) ---
    const toonFolder = gui.addFolder('Toon Shader (Global)');
    // TODO (CP 3): Add a band count slider that updates u_bandCount
    //   on all toon-shaded materials (same pattern as Phong globals above).
    toonFolder.add({ bandCount: 4.0 }, 'bandCount', 1, 10, 1)
        .name('Bands')
        .onChange(v => {
            objects.forEach(obj => obj.material.uniforms.u_bandCount.value = v);
        });
    toonFolder.open();

    // --- Creative Extensions (CP 4) ---
    const creativeFolder = gui.addFolder('Creative Extensions');
    // TODO (CP 4): Add controls for Fresnel, edge detection, iridescent, etc.
    creativeFolder.open();

    // --- Scene ---
    const sceneFolder = gui.addFolder('Scene');
    sceneFolder.add({
        hideAll() {
            objects.forEach(o => o.mesh.visible = false);
            gui.controllersRecursive().forEach(c => c.updateDisplay());
        }
    }, 'hideAll').name('Hide All Objects');
    sceneFolder.add({
        showAll() {
            objects.forEach(o => o.mesh.visible = true);
            gui.controllersRecursive().forEach(c => c.updateDisplay());
        }
    }, 'showAll').name('Show All Objects');
    sceneFolder.open();
}

// ===================== Button Wiring =====================
function setupButtons() {
    const btnSun = document.getElementById('btnToggleSun');
    btnSun.addEventListener('click', () => {
        isSunAnimating = !isSunAnimating;
        btnSun.textContent = isSunAnimating ? 'Stop Sun' : 'Start Sun';
        btnSun.classList.toggle('active', isSunAnimating);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        isSunAnimating = false;
        sunAngle = 0;
        btnSun.textContent = 'Start Sun';
        btnSun.classList.remove('active');
    });
}

// ===================== Animation Loop =====================
function animate() {
    requestAnimationFrame(animate);

    // --- Sun Animation ---
    if (isSunAnimating) {
        sunAngle += sunSpeed;
    }

    // Compute sun world position on a circular orbit
    const sunX = sunRadius * Math.cos(sunAngle);
    const sunY = sunRadius * Math.sin(sunAngle);
    // normalize the height
    const t = Math.max(0, sunY / sunRadius);
    const skyColor = new THREE.Color();

    if (sunY > 20) {
        // handles daytime color scheme
        skyColor.lerpColors(new THREE.Color(0xFF6B35), new THREE.Color(0x87CEEB), t);

    } else if (sunY > -20) {
        // handles evening to night color scheme
        const duskT = (sunY + 20) / 40; // Normalize sunY to [0, 1] for dusk transition
        skyColor.lerpColors(new THREE.Color(0x000022), new THREE.Color(0xFF6B35), duskT);
    } else {
        // handles night color scheme
        skyColor.set(0x000022);
    }
    scene.background = skyColor;

    const sunZ = 0;
    const sunWorldPos = new THREE.Vector3(sunX, sunY, sunZ);

    // TODO (CP 0): Update sunMesh position to follow the sun orbit.
    if (sunMesh) {
        sunMesh.position.copy(sunWorldPos);
    }
    // hides the sun when it goes below the horizon
    sunMesh.visible = sunY > -2;
    // TODO (CP 1): Pass the sun's position to the shader as the light position.
    //   Remember: the shader works in VIEW space, so you need to transform
    //   the sun's world position into view space before setting the uniform.
    const sunViewPos = sunWorldPos.clone().applyMatrix4(camera.matrixWorldInverse);

    objects.forEach(obj => {
        obj.material.uniforms.u_lightPos.value.copy(sunViewPos);
    });
    controls.update();
    renderer.render(scene, camera);
}

init();
