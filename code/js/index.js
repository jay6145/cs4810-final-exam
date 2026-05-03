import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import GUI from 'lil-gui';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

// scene variables
let scene;
let camera;
let renderer;
let controls;
let composer;
let ssaoPass;
let gui;

let sunMesh;
let moonMesh;
let stars;
let lake;
let rain;
let sparkParticles;
let smokeParticles;

let sunLight;
let campfireLight;
let campfireSpotLight;
let ambientLight;
let hemisphereLight;
let lakeAreaLight;

const flameMeshes = [];
const wetMaterials = [];
const clock = new THREE.Clock();

// scene settings
const state = {
    animateCycle: true,
    cycleSpeed: 0.02,
    timeOfDay: 0.35,
    shadowQuality: 2048,
    softShadows: true,
    ambientOcclusion: false,
    aoRadius: 4.0,
    aoIntensity: 16,
    campfireIntensity: 1.8,
    campfireParticles: true,
    sparkAmount: 0.7,
    smokeAmount: 0.65,
    weatherEnabled: false,
    rainIntensity: 0.5,
    fogStrength: 0.4,
    wetness: 0.55,
};

// start the scene
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x89c7ff);
    scene.fog = new THREE.Fog(0x89c7ff, 130, 430);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 42, 145);
    camera.lookAt(0, 20, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 35;
    controls.maxDistance = 300;
    controls.maxPolarAngle = Math.PI * 0.48;

    RectAreaLightUniformsLib.init();

    createTerrain();
    createLake();
    createForest();
    createCampfire();
    createCampfireParticles();
    createSkyElements();
    createRain();
    createLights();
    setupPostProcessing();
    setupGUI();
    setupButtons();
    applyShadowSettings();
    updateDayNightLighting();

    window.addEventListener('resize', onWindowResize);

    animate();
}

// make the ground and camp area
function createTerrain() {
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x4c7a3c,
        roughness: 0.98,
        metalness: 0.02,
    });
    wetMaterials.push({ material: groundMaterial, dryRoughness: 0.98, wetRoughness: 0.42, dryMetalness: 0.02, wetMetalness: 0.25 });
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        groundMaterial
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const campPatchMaterial = new THREE.MeshStandardMaterial({
        color: 0x5b4a35,
        roughness: 1.0,
        metalness: 0.0,
    });
    wetMaterials.push({ material: campPatchMaterial, dryRoughness: 1.0, wetRoughness: 0.5, dryMetalness: 0.0, wetMetalness: 0.2 });
    const campPatch = new THREE.Mesh(
        new THREE.CircleGeometry(20, 48),
        campPatchMaterial
    );
    campPatch.rotation.x = -Math.PI / 2;
    campPatch.position.y = 0.02;
    campPatch.receiveShadow = true;
    scene.add(campPatch);
}

// make the lake and shoreline
function createLake() {
    const lakeGeometry = new THREE.CircleGeometry(38, 96);
    lake = new Reflector(lakeGeometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x7cc4ff,
        multisample: 4,
    });
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(48, 0.05, -32);
    scene.add(lake);

    const shoreMaterial = new THREE.MeshStandardMaterial({
        color: 0x6c5a3f,
        roughness: 0.95,
        metalness: 0.0,
    });
    wetMaterials.push({ material: shoreMaterial, dryRoughness: 0.95, wetRoughness: 0.35, dryMetalness: 0.0, wetMetalness: 0.25 });
    const shoreRing = new THREE.Mesh(
        new THREE.RingGeometry(38, 44, 96),
        shoreMaterial
    );
    shoreRing.rotation.x = -Math.PI / 2;
    shoreRing.position.copy(lake.position);
    shoreRing.position.y = 0.03;
    shoreRing.receiveShadow = true;
    scene.add(shoreRing);
}

// make trees around the scene
function createForest() {
    const trunkGeometry = new THREE.CylinderGeometry(0.8, 1.2, 9, 8);
    const leavesGeometry = new THREE.ConeGeometry(4.2, 12, 10);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x5d3a1b,
        roughness: 0.95,
        metalness: 0.02,
    });
    wetMaterials.push({ material: trunkMaterial, dryRoughness: 0.95, wetRoughness: 0.5, dryMetalness: 0.02, wetMetalness: 0.2 });
    const leavesMaterial = new THREE.MeshStandardMaterial({
        color: 0x2b6f2f,
        roughness: 0.9,
        metalness: 0.03,
    });
    wetMaterials.push({ material: leavesMaterial, dryRoughness: 0.9, wetRoughness: 0.45, dryMetalness: 0.03, wetMetalness: 0.18 });

    const treeCount = 85;
    for (let i = 0; i < treeCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 90 + Math.random() * 125;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // keep center area open for camp/lake stuff
        if (Math.hypot(x, z) < 55) {
            continue;
        }

        const scale = 0.85 + Math.random() * 0.7;
        const tree = new THREE.Group();

        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 4.5 * scale;
        trunk.scale.setScalar(scale);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 11 * scale;
        leaves.scale.setScalar(scale);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        tree.add(leaves);

        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        scene.add(tree);
    }
}

// make the campfire objects
function createCampfire() {
    const fireGroup = new THREE.Group();
    scene.add(fireGroup);

    const logGeometry = new THREE.CylinderGeometry(0.55, 0.55, 13, 10);
    const logMaterial = new THREE.MeshStandardMaterial({
        color: 0x6a4021,
        roughness: 0.95,
        metalness: 0.0,
    });

    for (let i = 0; i < 5; i += 1) {
        const log = new THREE.Mesh(logGeometry, logMaterial);
        log.rotation.z = Math.PI / 2.3;
        log.rotation.y = (i / 5) * Math.PI * 2;
        log.position.y = 1.0;
        log.castShadow = true;
        log.receiveShadow = true;
        fireGroup.add(log);
    }

    const emberBed = new THREE.Mesh(
        new THREE.CircleGeometry(4, 20),
        new THREE.MeshStandardMaterial({
            color: 0x2a1d12,
            emissive: 0x7a2d00,
            emissiveIntensity: 0.8,
            roughness: 1.0,
        })
    );
    emberBed.rotation.x = -Math.PI / 2;
    emberBed.position.y = 0.06;
    fireGroup.add(emberBed);

    const flameMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8d2f,
        emissive: 0xff4d00,
        emissiveIntensity: 2.2,
        roughness: 0.25,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9,
    });

    for (let i = 0; i < 3; i += 1) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(1.8 - i * 0.3, 6 + i * 1.2, 16), flameMaterial.clone());
        flame.position.y = 3.5 + i * 1.15;
        flame.position.x = (Math.random() - 0.5) * 0.5;
        flame.position.z = (Math.random() - 0.5) * 0.5;
        flame.castShadow = false;
        flameMeshes.push(flame);
        fireGroup.add(flame);
    }
}

// make the rain particles
function createRain() {
    const rainCount = 5000;
    const rainPositions = new Float32Array(rainCount * 3);
    const rainSpeeds = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i += 1) {
        const i3 = i * 3;
        rainPositions[i3] = (Math.random() - 0.5) * 360;
        rainPositions[i3 + 1] = Math.random() * 180 + 20;
        rainPositions[i3 + 2] = (Math.random() - 0.5) * 360;
        rainSpeeds[i] = 28 + Math.random() * 50;
    }

    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(rainSpeeds, 1));

    const rainMaterial = new THREE.PointsMaterial({
        color: 0xbfd8ff,
        size: 0.23,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
    });

    rain = new THREE.Points(rainGeometry, rainMaterial);
    rain.visible = false;
    scene.add(rain);
}

// make campfire spark and smoke particles
function createCampfireParticles() {
    const sparkCount = 220;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i += 1) {
        const i3 = i * 3;
        sparkPositions[i3] = (Math.random() - 0.5) * 1.5;
        sparkPositions[i3 + 1] = 2.1 + Math.random() * 1.4;
        sparkPositions[i3 + 2] = (Math.random() - 0.5) * 1.5;
        sparkVelocities[i3] = (Math.random() - 0.5) * 1.1;
        sparkVelocities[i3 + 1] = 4.6 + Math.random() * 3.2;
        sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 1.1;
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = new THREE.PointsMaterial({
        color: 0xffb066,
        size: 0.35,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
    });
    sparkParticles = new THREE.Points(sparkGeometry, sparkMaterial);
    sparkParticles.userData.velocities = sparkVelocities;
    scene.add(sparkParticles);

    const smokeCount = 150;
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i += 1) {
        const i3 = i * 3;
        smokePositions[i3] = (Math.random() - 0.5) * 1.2;
        smokePositions[i3 + 1] = 2.4 + Math.random() * 2.0;
        smokePositions[i3 + 2] = (Math.random() - 0.5) * 1.2;
        smokeVelocities[i3] = (Math.random() - 0.5) * 0.35;
        smokeVelocities[i3 + 1] = 1.3 + Math.random() * 1.0;
        smokeVelocities[i3 + 2] = (Math.random() - 0.5) * 0.35;
    }
    const smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    const smokeMaterial = new THREE.PointsMaterial({
        color: 0xc2c7d2,
        size: 1.25,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
    });
    smokeParticles = new THREE.Points(smokeGeometry, smokeMaterial);
    smokeParticles.userData.velocities = smokeVelocities;
    scene.add(smokeParticles);
}

// make sun moon and stars
function createSkyElements() {
    sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(9, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffdf70 })
    );
    scene.add(sunMesh);

    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(6.5, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xdde4ff })
    );
    scene.add(moonMesh);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
        const radius = 320 + Math.random() * 120;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
        starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 15;
        starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
            color: 0xe5ecff,
            size: 1.2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
        })
    );
    scene.add(stars);
}

// add all light types
function createLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.24);
    scene.add(ambientLight);

    hemisphereLight = new THREE.HemisphereLight(0x9ec8ff, 0x274122, 0.4);
    scene.add(hemisphereLight);

    sunLight = new THREE.DirectionalLight(0xfff1c2, 1.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(state.shadowQuality, state.shadowQuality);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 360;
    sunLight.shadow.camera.left = -140;
    sunLight.shadow.camera.right = 140;
    sunLight.shadow.camera.top = 140;
    sunLight.shadow.camera.bottom = -140;
    sunLight.shadow.bias = -0.00008;
    scene.add(sunLight);
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight.target);

    campfireLight = new THREE.PointLight(0xff8b2f, state.campfireIntensity, 90, 2.0);
    campfireLight.position.set(0, 4.5, 0);
    campfireLight.castShadow = true;
    campfireLight.shadow.mapSize.set(1024, 1024);
    campfireLight.shadow.bias = -0.0009;
    scene.add(campfireLight);

    campfireSpotLight = new THREE.SpotLight(0xffb066, 1.3, 70, Math.PI / 4, 0.45, 1.2);
    campfireSpotLight.position.set(0, 11, 0);
    campfireSpotLight.target.position.set(0, 0, 0);
    campfireSpotLight.castShadow = true;
    campfireSpotLight.shadow.mapSize.set(1024, 1024);
    scene.add(campfireSpotLight);
    scene.add(campfireSpotLight.target);

    lakeAreaLight = new THREE.RectAreaLight(0x99c5ff, 2.2, 20, 9);
    lakeAreaLight.position.set(48, 6, -32);
    lakeAreaLight.lookAt(48, 0, -32);
    scene.add(lakeAreaLight);
}

// set up post processing
function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = state.aoRadius;
    ssaoPass.minDistance = 0.004;
    ssaoPass.maxDistance = 0.16;
    ssaoPass.output = SSAOPass.OUTPUT.Default;
    composer.addPass(ssaoPass);
}

// make the gui controls
function setupGUI() {
    gui = new GUI({ container: document.getElementById('gui-container') });

    const cycleFolder = gui.addFolder('Time of Day');
    cycleFolder.add(state, 'animateCycle').name('Animate Cycle');
    cycleFolder.add(state, 'cycleSpeed', 0.002, 0.12, 0.001).name('Cycle Speed');
    cycleFolder.add(state, 'timeOfDay', 0, 1, 0.001).name('Time').onChange(updateDayNightLighting);
    cycleFolder.open();

    const shadowFolder = gui.addFolder('Shadows');
    shadowFolder
        .add(state, 'shadowQuality', { Low: 512, Medium: 1024, High: 2048, Ultra: 4096 })
        .name('Shadow Map')
        .onChange(applyShadowSettings);
    shadowFolder.add(state, 'softShadows').name('Soft Shadows').onChange(applyShadowSettings);
    shadowFolder.open();

    const aoFolder = gui.addFolder('Ambient Occlusion');
    aoFolder.add(state, 'ambientOcclusion').name('Enabled');
    aoFolder.add(state, 'aoRadius', 1, 16, 0.1).name('Radius').onChange(() => {
        ssaoPass.kernelRadius = state.aoRadius;
    });
    aoFolder.add(state, 'aoIntensity', 1, 32, 0.1).name('Intensity').onChange(() => {
        ssaoPass.kernelRadius = state.aoRadius;
    });
    aoFolder.open();

    const fireFolder = gui.addFolder('Campfire');
    fireFolder.add(state, 'campfireIntensity', 0.2, 4.5, 0.05).name('Light Intensity');
    fireFolder.add(state, 'campfireParticles').name('Particles');
    fireFolder.add(state, 'sparkAmount', 0, 1, 0.01).name('Sparks');
    fireFolder.add(state, 'smokeAmount', 0, 1, 0.01).name('Smoke');
    fireFolder.open();

    const weatherFolder = gui.addFolder('Weather');
    weatherFolder.add(state, 'weatherEnabled').name('Enabled');
    weatherFolder.add(state, 'rainIntensity', 0, 1, 0.01).name('Rain');
    weatherFolder.add(state, 'fogStrength', 0, 1, 0.01).name('Fog');
    weatherFolder.add(state, 'wetness', 0, 1, 0.01).name('Wet Ground');
    weatherFolder.open();
}

// connect ui buttons
function setupButtons() {
    const btnSun = document.getElementById('btnToggleSun');
    btnSun.textContent = 'Pause Cycle';
    btnSun.classList.add('active');

    btnSun.addEventListener('click', () => {
        state.animateCycle = !state.animateCycle;
        btnSun.textContent = state.animateCycle ? 'Pause Cycle' : 'Resume Cycle';
        btnSun.classList.toggle('active', state.animateCycle);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        state.animateCycle = true;
        state.timeOfDay = 0.35;
        updateDayNightLighting();
        btnSun.textContent = 'Pause Cycle';
        btnSun.classList.add('active');
    });
}

// update shadow settings
function applyShadowSettings() {
    renderer.shadowMap.type = state.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    const size = Number(state.shadowQuality);
    sunLight.shadow.mapSize.set(size, size);
    if (sunLight.shadow.map) {
        sunLight.shadow.map.dispose();
        sunLight.shadow.map = null;
    }
}

// handle screen resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
    if (ssaoPass) {
        ssaoPass.setSize(window.innerWidth, window.innerHeight);
    }
}

// update day and night lighting
function updateDayNightLighting() {
    const sunOrbit = state.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunPosition = new THREE.Vector3(
        Math.cos(sunOrbit) * 175,
        Math.sin(sunOrbit) * 130,
        -35
    );
    sunMesh.position.copy(sunPosition);
    sunLight.position.copy(sunPosition);

    const moonPosition = new THREE.Vector3(
        Math.cos(sunOrbit + Math.PI) * 175,
        Math.sin(sunOrbit + Math.PI) * 130,
        -25
    );
    moonMesh.position.copy(moonPosition);

    const daylight = THREE.MathUtils.clamp((sunPosition.y + 8) / 130, 0, 1);
    const duskFactor = 1 - Math.abs(daylight - 0.45) / 0.45;
    const twilight = THREE.MathUtils.clamp(duskFactor, 0, 1);

    const daySky = new THREE.Color(0x8fcfff);
    const duskSky = new THREE.Color(0xff7f4d);
    const nightSky = new THREE.Color(0x070b1d);
    const skyColor = new THREE.Color().lerpColors(nightSky, duskSky, twilight).lerp(daySky, daylight);
    if (state.weatherEnabled) {
        skyColor.lerp(new THREE.Color(0x7a8698), 0.35 + state.fogStrength * 0.25);
    }
    scene.background = skyColor;
    scene.fog.color.copy(skyColor);

    const fogBoost = state.weatherEnabled ? state.fogStrength : 0;
    scene.fog.near = 90 - fogBoost * 35;
    scene.fog.far = 390 - fogBoost * 230;

    ambientLight.intensity = THREE.MathUtils.lerp(0.08, 0.34, daylight);
    hemisphereLight.intensity = THREE.MathUtils.lerp(0.12, 0.52, daylight);
    sunLight.intensity = THREE.MathUtils.lerp(0.1, 2.3, daylight);
    lakeAreaLight.intensity = THREE.MathUtils.lerp(2.8, 0.45, daylight);

    stars.visible = daylight < 0.35;
    stars.material.opacity = THREE.MathUtils.lerp(0.05, 0.95, 1 - daylight);
    moonMesh.visible = daylight < 0.6;
    sunMesh.visible = sunPosition.y > -20;
}

// animate campfire movement and light
function animateCampfire(elapsedTime, daylight) {
    flameMeshes.forEach((flame, index) => {
        const pulse = 0.8 + Math.sin(elapsedTime * (4.2 + index * 1.3) + index) * 0.14;
        flame.scale.setScalar(pulse);
        flame.rotation.y += 0.01 + index * 0.002;
    });

    const flicker = 0.82 + Math.sin(elapsedTime * 24) * 0.15 + Math.sin(elapsedTime * 38) * 0.08;
    const nightBoost = THREE.MathUtils.lerp(1.25, 0.9, daylight);
    const fireIntensity = state.campfireIntensity * flicker * nightBoost;
    campfireLight.intensity = fireIntensity;
    campfireSpotLight.intensity = fireIntensity * 0.7;
}

// animate campfire particles
function animateCampfireParticles(delta, daylight) {
    if (!sparkParticles || !smokeParticles) {
        return;
    }

    if (!state.campfireParticles) {
        sparkParticles.visible = false;
        smokeParticles.visible = false;
        return;
    }

    sparkParticles.visible = true;
    smokeParticles.visible = true;

    const sparkOpacity = state.sparkAmount * (0.55 + (1 - daylight) * 0.4);
    const smokeOpacity = state.smokeAmount * 0.45;
    sparkParticles.material.opacity = sparkOpacity;
    smokeParticles.material.opacity = smokeOpacity;

    const sparkPositions = sparkParticles.geometry.attributes.position;
    const sparkVelocities = sparkParticles.userData.velocities;
    for (let i = 0; i < sparkPositions.count; i += 1) {
        const i3 = i * 3;
        let x = sparkPositions.array[i3] + sparkVelocities[i3] * delta;
        let y = sparkPositions.array[i3 + 1] + sparkVelocities[i3 + 1] * delta;
        let z = sparkPositions.array[i3 + 2] + sparkVelocities[i3 + 2] * delta;

        sparkVelocities[i3] += (Math.random() - 0.5) * 0.025;
        sparkVelocities[i3 + 2] += (Math.random() - 0.5) * 0.025;
        sparkVelocities[i3 + 1] *= 0.995;

        if (y > 16 || Math.abs(x) > 9 || Math.abs(z) > 9) {
            x = (Math.random() - 0.5) * 1.6;
            y = 2.0 + Math.random() * 1.2;
            z = (Math.random() - 0.5) * 1.6;
            sparkVelocities[i3] = (Math.random() - 0.5) * 1.1;
            sparkVelocities[i3 + 1] = 4.6 + Math.random() * 3.4;
            sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 1.1;
        }

        sparkPositions.array[i3] = x;
        sparkPositions.array[i3 + 1] = y;
        sparkPositions.array[i3 + 2] = z;
    }
    sparkPositions.needsUpdate = true;

    const smokePositions = smokeParticles.geometry.attributes.position;
    const smokeVelocities = smokeParticles.userData.velocities;
    for (let i = 0; i < smokePositions.count; i += 1) {
        const i3 = i * 3;
        let x = smokePositions.array[i3] + smokeVelocities[i3] * delta;
        let y = smokePositions.array[i3 + 1] + smokeVelocities[i3 + 1] * delta;
        let z = smokePositions.array[i3 + 2] + smokeVelocities[i3 + 2] * delta;

        smokeVelocities[i3] += (Math.random() - 0.5) * 0.003;
        smokeVelocities[i3 + 2] += (Math.random() - 0.5) * 0.003;
        smokeVelocities[i3 + 1] *= 0.998;

        if (y > 22 || Math.abs(x) > 14 || Math.abs(z) > 14) {
            x = (Math.random() - 0.5) * 1.4;
            y = 2.2 + Math.random() * 1.7;
            z = (Math.random() - 0.5) * 1.4;
            smokeVelocities[i3] = (Math.random() - 0.5) * 0.35;
            smokeVelocities[i3 + 1] = 1.3 + Math.random() * 1.0;
            smokeVelocities[i3 + 2] = (Math.random() - 0.5) * 0.35;
        }

        smokePositions.array[i3] = x;
        smokePositions.array[i3 + 1] = y;
        smokePositions.array[i3 + 2] = z;
    }
    smokePositions.needsUpdate = true;
}

// animate rain and wet surfaces
function animateWeather(delta) {
    if (!rain) {
        return;
    }

    const rainAmount = state.weatherEnabled ? state.rainIntensity : 0;
    rain.visible = rainAmount > 0.01;
    rain.material.opacity = rainAmount * 0.8;

    const positions = rain.geometry.attributes.position;
    const speeds = rain.geometry.attributes.aSpeed;
    for (let i = 0; i < positions.count; i += 1) {
        const y = positions.getY(i) - speeds.getX(i) * delta * (0.25 + rainAmount);
        positions.setY(i, y < 0 ? 170 + Math.random() * 30 : y);
    }
    positions.needsUpdate = true;

    const wetLevel = state.weatherEnabled ? state.wetness : 0;
    wetMaterials.forEach(item => {
        item.material.roughness = THREE.MathUtils.lerp(item.dryRoughness, item.wetRoughness, wetLevel);
        item.material.metalness = THREE.MathUtils.lerp(item.dryMetalness, item.wetMetalness, wetLevel);
    });

    const lakeMix = state.weatherEnabled ? state.wetness * 0.55 : 0;
    if (lake?.material?.uniforms?.color?.value) {
        lake.material.uniforms.color.value.lerp(new THREE.Color(0x8ea2bd), lakeMix);
    }
}

// run the render loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    if (state.animateCycle) {
        state.timeOfDay = (state.timeOfDay + delta * state.cycleSpeed) % 1;
    }

    updateDayNightLighting();

    const sunHeight = sunMesh.position.y;
    const daylight = THREE.MathUtils.clamp((sunHeight + 8) / 130, 0, 1);
    animateCampfire(elapsed, daylight);
    animateCampfireParticles(delta, daylight);
    animateWeather(delta);

    const waterTint = new THREE.Color().lerpColors(
        new THREE.Color(0x3c5f8a),
        new THREE.Color(0x9fd3ff),
        daylight
    );
    if (lake?.material?.uniforms?.color?.value) {
        lake.material.uniforms.color.value.copy(waterTint);
    }

    if (ssaoPass) {
        ssaoPass.kernelRadius = state.aoRadius;
        ssaoPass.minDistance = 0.003 + state.aoIntensity * 0.0001;
        ssaoPass.maxDistance = 0.08 + state.aoIntensity * 0.004;
    }

    controls.update();

    if (state.ambientOcclusion && composer && ssaoPass) {
        try {
            composer.render();
        } catch (error) {
            console.warn('Post-processing failed, falling back to direct render:', error);
            state.ambientOcclusion = false;
            renderer.render(scene, camera);
        }
    } else {
        renderer.render(scene, camera);
    }
}

init();
