import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import GUI from 'lil-gui';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
    flameVertexShader,
    flameFragmentShader,
    sparkVertexShader,
    sparkFragmentShader,
    smokeVertexShader,
    smokeFragmentShader,
} from '../shaders/campfireShaders.js';
import {
    fireflyVertexShader,
    fireflyFragmentShader,
} from '../shaders/wildlifeShaders.js';

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
let fireflies;
let tungSahur;
const birds = [];

let sunLight;
let campfireLight;
let campfireSpotLight;
let campfireAreaLight;
let ambientLight;
let hemisphereLight;
let lakeAreaLight;

const flameMeshes = [];
const wetMaterials = [];
const clock = new THREE.Clock();

// build a soft glowing dot texture for sparks
function makeSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.25, 'rgba(255, 220, 140, 0.95)');
    gradient.addColorStop(0.55, 'rgba(255, 130, 40, 0.45)');
    gradient.addColorStop(1.0, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// build a soft puff texture for smoke
function makeSmokeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // base puff
    const baseGradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    baseGradient.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    baseGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.55)');
    baseGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.18)');
    baseGradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, 128, 128);

    // a few extra blobs to break up the silhouette
    for (let i = 0; i < 6; i += 1) {
        const px = 40 + Math.random() * 48;
        const py = 40 + Math.random() * 48;
        const radius = 18 + Math.random() * 22;
        const blob = ctx.createRadialGradient(px, py, 0, px, py, radius);
        blob.addColorStop(0.0, `rgba(255, 255, 255, ${0.18 + Math.random() * 0.18})`);
        blob.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, 128, 128);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

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
    weatherEnabled: true,
    rainIntensity: 0,
    fogStrength: 0.25,
    wetness: 0,
    lightingMode: 'Realistic',
    firefliesEnabled: true,
    birdsEnabled: true,
    tungSahurEnabled: true,
    demoMode: false,
    demoSpeed: 1.0,
};

// lighting style presets
const LIGHTING_MODES = {
    Realistic: {
        toneMapping: THREE.ACESFilmicToneMapping,
        exposure: 1.05,
        ambientMult: 1.0,
        hemisphereMult: 1.0,
        sunMult: 1.0,
        fireMult: 1.0,
    },
    Cinematic: {
        toneMapping: THREE.CineonToneMapping,
        exposure: 0.78,
        ambientMult: 0.55,
        hemisphereMult: 0.65,
        sunMult: 1.4,
        fireMult: 1.5,
    },
    Stylized: {
        toneMapping: THREE.LinearToneMapping,
        exposure: 1.4,
        ambientMult: 1.5,
        hemisphereMult: 1.4,
        sunMult: 0.95,
        fireMult: 0.9,
    },
};

// cinematic camera flythrough waypoints
const CAMERA_PATH_POSITIONS = [
    new THREE.Vector3(0, 14, 28),
    new THREE.Vector3(35, 18, 25),
    new THREE.Vector3(70, 24, 0),
    new THREE.Vector3(120, 30, -55),
    new THREE.Vector3(78, 50, -120),
    new THREE.Vector3(0, 70, -170),
    new THREE.Vector3(-110, 50, -100),
    new THREE.Vector3(-140, 30, 0),
    new THREE.Vector3(-50, 22, 60),
    new THREE.Vector3(0, 14, 28),
];

const CAMERA_PATH_TARGETS = [
    new THREE.Vector3(0, 4, 0),
    new THREE.Vector3(0, 4, 0),
    new THREE.Vector3(40, 2, -25),
    new THREE.Vector3(78, 1, -58),
    new THREE.Vector3(78, 1, -58),
    new THREE.Vector3(0, 5, -30),
    new THREE.Vector3(-50, 5, 0),
    new THREE.Vector3(0, 5, 0),
    new THREE.Vector3(0, 4, 0),
    new THREE.Vector3(0, 4, 0),
];

const cameraCurve = new THREE.CatmullRomCurve3(CAMERA_PATH_POSITIONS, true, 'catmullrom', 0.4);
const targetCurve = new THREE.CatmullRomCurve3(CAMERA_PATH_TARGETS, true, 'catmullrom', 0.4);

// start the scene
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x89c7ff);
    scene.fog = new THREE.Fog(0x89c7ff, 200, 600);

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
    createFireflies();
    createBirds();
    createTungSahur();
    createLights();
    setupPostProcessing();
    setupGUI();
    setupButtons();
    applyShadowSettings();
    applyLightingMode();
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
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
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

// generate organic lake outline points using layered sine waves
function createLakeOutline(segments, baseRadius, variation) {
    const points = [];
    for (let i = 0; i < segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        const r = baseRadius
            + Math.sin(angle * 2 + 0.5) * variation
            + Math.cos(angle * 3 + 1.2) * variation * 0.65
            + Math.sin(angle * 5 + 2.3) * variation * 0.35;
        points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    return points;
}

// fixed lake center used by createLake and createLights
const LAKE_CENTER = new THREE.Vector3(78, 0.08, -58);

// how far the sun and moon orbit, kept far in the sky
const SKY_DISTANCE = 480;
// vertical squash so the arc feels like a celestial dome
const SKY_Y_RATIO = 0.85;
// where the directional sun light sits along the sun direction
const SUN_LIGHT_DISTANCE = 180;

// make the lake and shoreline
function createLake() {
    const outlinePoints = createLakeOutline(72, 34, 4.5);
    const lakeShape = new THREE.Shape(outlinePoints);
    const lakeGeometry = new THREE.ShapeGeometry(lakeShape, 24);

    lake = new Reflector(lakeGeometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x7cc4ff,
        multisample: 4,
    });
    lake.rotation.x = -Math.PI / 2;
    lake.position.copy(LAKE_CENTER);
    // bias forward so it always wins z-fight with the ground
    lake.material.polygonOffset = true;
    lake.material.polygonOffsetFactor = -2;
    lake.material.polygonOffsetUnits = -2;
    scene.add(lake);

    // shoreline that hugs the irregular lake outline
    const shoreWidth = 6;
    const shoreOuterPoints = outlinePoints.map(p => {
        const angle = Math.atan2(p.y, p.x);
        const len = p.length();
        return new THREE.Vector2(
            Math.cos(angle) * (len + shoreWidth),
            Math.sin(angle) * (len + shoreWidth)
        );
    });
    const shoreShape = new THREE.Shape(shoreOuterPoints);
    // hole points must wind opposite to the outer shape
    shoreShape.holes.push(new THREE.Path(outlinePoints.slice().reverse()));
    const shoreGeometry = new THREE.ShapeGeometry(shoreShape, 24);

    const shoreMaterial = new THREE.MeshStandardMaterial({
        color: 0x6c5a3f,
        roughness: 0.95,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });
    wetMaterials.push({ material: shoreMaterial, dryRoughness: 0.95, wetRoughness: 0.35, dryMetalness: 0.0, wetMetalness: 0.25 });

    const shoreRing = new THREE.Mesh(shoreGeometry, shoreMaterial);
    shoreRing.rotation.x = -Math.PI / 2;
    shoreRing.position.copy(LAKE_CENTER);
    shoreRing.position.y = 0.05;
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

        // keep center area open for camp and exclude the lake area
        const distFromCamp = Math.hypot(x, z);
        const distFromLake = Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.z);
        if (distFromCamp < 55 || distFromLake < 48) {
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
    fireGroup.position.set(0, 0, 0);
    scene.add(fireGroup);

    // stone ring around the pit
    const stoneGeo = new THREE.SphereGeometry(0.7, 10, 8);
    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 0.92,
        metalness: 0.0,
    });
    const stoneCount = 10;
    for (let i = 0; i < stoneCount; i += 1) {
        const angle = (i / stoneCount) * Math.PI * 2;
        const radius = 3.6 + Math.random() * 0.4;
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(Math.cos(angle) * radius, 0.45, Math.sin(angle) * radius);
        stone.scale.set(
            0.85 + Math.random() * 0.5,
            0.65 + Math.random() * 0.35,
            0.85 + Math.random() * 0.5
        );
        stone.rotation.set(Math.random(), Math.random() * Math.PI * 2, Math.random());
        stone.castShadow = true;
        stone.receiveShadow = true;
        fireGroup.add(stone);
    }

    // ash bed
    const ashBed = new THREE.Mesh(
        new THREE.CircleGeometry(3.4, 32),
        new THREE.MeshStandardMaterial({
            color: 0x111110,
            roughness: 1.0,
            metalness: 0.0,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
        })
    );
    ashBed.rotation.x = -Math.PI / 2;
    ashBed.position.y = 0.12;
    ashBed.receiveShadow = true;
    fireGroup.add(ashBed);

    // hot ember disk
    const emberDisk = new THREE.Mesh(
        new THREE.CircleGeometry(2.2, 28),
        new THREE.MeshStandardMaterial({
            color: 0x2a1106,
            emissive: 0xff6320,
            emissiveIntensity: 1.6,
            roughness: 1.0,
            metalness: 0.0,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
        })
    );
    emberDisk.rotation.x = -Math.PI / 2;
    emberDisk.position.y = 0.18;
    fireGroup.add(emberDisk);

    // bright inner ember disk
    const innerEmber = new THREE.Mesh(
        new THREE.CircleGeometry(1.05, 24),
        new THREE.MeshBasicMaterial({
            color: 0xffd994,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
        })
    );
    innerEmber.rotation.x = -Math.PI / 2;
    innerEmber.position.y = 0.24;
    fireGroup.add(innerEmber);

    // scattered logs piled at random angles for a natural campfire look
    const logGeometry = new THREE.CylinderGeometry(0.34, 0.4, 5.6, 12);
    const logMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a2a16,
        roughness: 0.95,
        metalness: 0.0,
        emissive: 0x401200,
        emissiveIntensity: 0.45,
    });

    const logCount = 6;
    for (let i = 0; i < logCount; i += 1) {
        // each log gets a holder so we can yaw it cleanly around the fire center
        const holder = new THREE.Group();
        const yaw = Math.random() * Math.PI * 2;
        const layer = Math.floor(i / 2);
        const baseY = 0.42 + layer * 0.5 + (Math.random() - 0.5) * 0.1;
        const radialOffset = Math.random() * 0.55;
        const offsetAngle = Math.random() * Math.PI * 2;

        holder.position.set(
            Math.cos(offsetAngle) * radialOffset,
            baseY,
            Math.sin(offsetAngle) * radialOffset
        );
        holder.rotation.y = yaw;

        const log = new THREE.Mesh(logGeometry, logMaterial);
        log.rotation.z = Math.PI / 2;
        // slight roll + tilt so logs aren't perfectly aligned
        log.rotation.x = (Math.random() - 0.5) * 0.18;
        log.rotation.y = (Math.random() - 0.5) * 0.18;
        // length variation
        log.scale.set(0.85 + Math.random() * 0.3, 0.8 + Math.random() * 0.35, 0.85 + Math.random() * 0.3);
        log.castShadow = true;
        log.receiveShadow = true;
        holder.add(log);
        fireGroup.add(holder);
    }

    // small kindling / branches scattered around the embers
    const stickGeometry = new THREE.CylinderGeometry(0.1, 0.14, 3.2, 8);
    const stickCount = 5;
    for (let i = 0; i < stickCount; i += 1) {
        const holder = new THREE.Group();
        const yaw = Math.random() * Math.PI * 2;
        const radial = Math.random() * 0.9;
        const offsetAngle = Math.random() * Math.PI * 2;

        holder.position.set(
            Math.cos(offsetAngle) * radial,
            0.18 + Math.random() * 0.12,
            Math.sin(offsetAngle) * radial
        );
        holder.rotation.y = yaw;

        const stick = new THREE.Mesh(stickGeometry, logMaterial);
        stick.rotation.z = Math.PI / 2;
        stick.rotation.x = (Math.random() - 0.5) * 0.25;
        stick.scale.y = 0.7 + Math.random() * 0.6;
        stick.castShadow = true;
        stick.receiveShadow = true;
        holder.add(stick);
        fireGroup.add(holder);
    }

    // glowing white-hot core sphere
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff4d2 })
    );
    core.position.y = 1.2;
    fireGroup.add(core);

    // multi-layered animated flames using custom shader
    const flameLayers = [
        { radius: 2.1, height: 5.2, hot: '#ffeec0', mid: '#ff8534', cool: '#3f0700', intensity: 0.95, y: 2.0, seed: 0.0 },
        { radius: 1.6, height: 5.9, hot: '#fff4cc', mid: '#ffa044', cool: '#651000', intensity: 1.05, y: 2.4, seed: 1.7 },
        { radius: 1.1, height: 6.4, hot: '#ffffff', mid: '#ffd07a', cool: '#a04400', intensity: 1.25, y: 2.8, seed: 3.4 },
        { radius: 0.65, height: 5.8, hot: '#ffffff', mid: '#fff0bd', cool: '#ffb060', intensity: 1.55, y: 3.0, seed: 5.1 },
    ];

    flameLayers.forEach(layer => {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: layer.intensity },
                uColorHot: { value: new THREE.Color(layer.hot) },
                uColorMid: { value: new THREE.Color(layer.mid) },
                uColorCool: { value: new THREE.Color(layer.cool) },
                uSeed: { value: layer.seed },
            },
            vertexShader: flameVertexShader,
            fragmentShader: flameFragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });
        const geometry = new THREE.ConeGeometry(layer.radius, layer.height, 32, 12, true);
        const flame = new THREE.Mesh(geometry, material);
        flame.position.y = layer.y;
        flame.castShadow = false;
        flame.renderOrder = 2;
        flameMeshes.push(flame);
        fireGroup.add(flame);
    });
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
    const sparkTexture = makeSparkTexture();
    const smokeTexture = makeSmokeTexture();
    const pixelRatio = renderer ? renderer.getPixelRatio() : 1;

    // sparks
    const sparkCount = 260;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    const sparkLifetimes = new Float32Array(sparkCount);
    const sparkMaxLifetimes = new Float32Array(sparkCount);
    const sparkSizes = new Float32Array(sparkCount);

    for (let i = 0; i < sparkCount; i += 1) {
        const i3 = i * 3;
        sparkPositions[i3] = (Math.random() - 0.5) * 0.8;
        sparkPositions[i3 + 1] = 1.4 + Math.random() * 0.7;
        sparkPositions[i3 + 2] = (Math.random() - 0.5) * 0.8;

        const theta = Math.random() * Math.PI * 2;
        const horizontalSpeed = 0.6 + Math.random() * 1.6;
        const verticalSpeed = 3.5 + Math.random() * 4.8;
        sparkVelocities[i3] = Math.cos(theta) * horizontalSpeed;
        sparkVelocities[i3 + 1] = verticalSpeed;
        sparkVelocities[i3 + 2] = Math.sin(theta) * horizontalSpeed;

        sparkMaxLifetimes[i] = 0.8 + Math.random() * 1.6;
        // stagger so they aren't all newborn
        sparkLifetimes[i] = Math.random() * sparkMaxLifetimes[i];
        sparkSizes[i] = 1.6 + Math.random() * 2.0;
    }

    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    sparkGeometry.setAttribute('aLife', new THREE.BufferAttribute(sparkLifetimes, 1));
    sparkGeometry.setAttribute('aMaxLife', new THREE.BufferAttribute(sparkMaxLifetimes, 1));
    sparkGeometry.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1));

    const sparkMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTex: { value: sparkTexture },
            uPixelRatio: { value: pixelRatio },
            uOpacity: { value: state.sparkAmount },
        },
        vertexShader: sparkVertexShader,
        fragmentShader: sparkFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    sparkParticles = new THREE.Points(sparkGeometry, sparkMaterial);
    sparkParticles.frustumCulled = false;
    sparkParticles.renderOrder = 3;
    sparkParticles.userData = {
        velocities: sparkVelocities,
        lifetimes: sparkLifetimes,
        maxLifetimes: sparkMaxLifetimes,
    };
    scene.add(sparkParticles);

    // smoke
    const smokeCount = 160;
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities = new Float32Array(smokeCount * 3);
    const smokeLifetimes = new Float32Array(smokeCount);
    const smokeMaxLifetimes = new Float32Array(smokeCount);
    const smokeSizes = new Float32Array(smokeCount);
    const smokeRotations = new Float32Array(smokeCount);
    const smokeRotationSpeeds = new Float32Array(smokeCount);

    for (let i = 0; i < smokeCount; i += 1) {
        const i3 = i * 3;
        smokePositions[i3] = (Math.random() - 0.5) * 1.4;
        smokePositions[i3 + 1] = 4.0 + Math.random() * 1.6;
        smokePositions[i3 + 2] = (Math.random() - 0.5) * 1.4;

        const theta = Math.random() * Math.PI * 2;
        const horizontalSpeed = 0.18 + Math.random() * 0.55;
        const verticalSpeed = 1.6 + Math.random() * 1.6;
        smokeVelocities[i3] = Math.cos(theta) * horizontalSpeed;
        smokeVelocities[i3 + 1] = verticalSpeed;
        smokeVelocities[i3 + 2] = Math.sin(theta) * horizontalSpeed;

        smokeMaxLifetimes[i] = 5.5 + Math.random() * 5.5;
        smokeLifetimes[i] = Math.random() * smokeMaxLifetimes[i];
        smokeSizes[i] = 5.5 + Math.random() * 4.5;
        smokeRotations[i] = Math.random() * Math.PI * 2;
        smokeRotationSpeeds[i] = (Math.random() - 0.5) * 0.45;
    }

    const smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeometry.setAttribute('aLife', new THREE.BufferAttribute(smokeLifetimes, 1));
    smokeGeometry.setAttribute('aMaxLife', new THREE.BufferAttribute(smokeMaxLifetimes, 1));
    smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSizes, 1));
    smokeGeometry.setAttribute('aRotation', new THREE.BufferAttribute(smokeRotations, 1));

    const smokeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTex: { value: smokeTexture },
            uPixelRatio: { value: pixelRatio },
            uOpacity: { value: state.smokeAmount },
            uWarm: { value: new THREE.Color(0x4a3328) },
            uCool: { value: new THREE.Color(0x6e747e) },
        },
        vertexShader: smokeVertexShader,
        fragmentShader: smokeFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
    });

    smokeParticles = new THREE.Points(smokeGeometry, smokeMaterial);
    smokeParticles.frustumCulled = false;
    smokeParticles.renderOrder = 1;
    smokeParticles.userData = {
        velocities: smokeVelocities,
        lifetimes: smokeLifetimes,
        maxLifetimes: smokeMaxLifetimes,
        rotations: smokeRotations,
        rotationSpeeds: smokeRotationSpeeds,
    };
    scene.add(smokeParticles);
}

// make sun moon and stars
function createSkyElements() {
    sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(22, 32, 32),
        new THREE.MeshBasicMaterial({
            color: 0xffdf70,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            fog: false,
        })
    );
    sunMesh.renderOrder = -1;
    scene.add(sunMesh);

    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(16, 32, 32),
        new THREE.MeshBasicMaterial({
            color: 0xdde4ff,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            fog: false,
        })
    );
    moonMesh.renderOrder = -1;
    scene.add(moonMesh);

    // stars sit on a dome well beyond the sun and moon
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1100;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
        const radius = 600 + Math.random() * 180;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
        starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        // keep all stars above the horizon so none show below ground
        starPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 40;
        starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
            color: 0xe5ecff,
            size: 1.6,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            fog: false,
        })
    );
    stars.renderOrder = -2;
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

    // main warm point light at the heart of the fire, reaches far enough to touch nearby trees
    campfireLight = new THREE.PointLight(0xff8b2f, state.campfireIntensity, 140, 1.7);
    campfireLight.position.set(0, 4.5, 0);
    campfireLight.castShadow = true;
    campfireLight.shadow.mapSize.set(1024, 1024);
    campfireLight.shadow.bias = -0.0009;
    scene.add(campfireLight);

    // wider downward spot pours focused light onto the ground around the camp
    campfireSpotLight = new THREE.SpotLight(0xffb066, 1.3, 110, Math.PI / 3, 0.55, 1.3);
    campfireSpotLight.position.set(0, 12, 0);
    campfireSpotLight.target.position.set(0, 0, 0);
    campfireSpotLight.castShadow = true;
    campfireSpotLight.shadow.mapSize.set(1024, 1024);
    scene.add(campfireSpotLight);
    scene.add(campfireSpotLight.target);

    // soft warm area light that gives the campfire true surrounding illumination
    campfireAreaLight = new THREE.RectAreaLight(0xff8a3a, 4.0, 28, 28);
    campfireAreaLight.position.set(0, 9, 0);
    campfireAreaLight.lookAt(0, 0, 0);
    scene.add(campfireAreaLight);

    lakeAreaLight = new THREE.RectAreaLight(0x99c5ff, 2.2, 20, 9);
    lakeAreaLight.position.set(LAKE_CENTER.x, 6, LAKE_CENTER.z);
    lakeAreaLight.lookAt(LAKE_CENTER.x, 0, LAKE_CENTER.z);
    scene.add(lakeAreaLight);
}

// build glowing fireflies that drift through the forest at night
function createFireflies() {
    const count = 130;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const basePositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
        let x;
        let z;
        // distribute around camp + forest while staying out of the lake
        do {
            x = (Math.random() - 0.5) * 220;
            z = (Math.random() - 0.5) * 220;
        } while (Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.z) < 40);

        const y = 1.5 + Math.random() * 9;
        const i3 = i * 3;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
        seeds[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uTex: { value: makeSparkTexture() },
            uPixelRatio: { value: renderer.getPixelRatio() },
            uOpacity: { value: 0 },
        },
        vertexShader: fireflyVertexShader,
        fragmentShader: fireflyFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    fireflies = new THREE.Points(geometry, material);
    fireflies.frustumCulled = false;
    fireflies.userData = { basePositions };
    scene.add(fireflies);
}

// build a single bird as a flapping pair of triangle wings
function createBird() {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x121212, side: THREE.DoubleSide });

    const leftGeo = new THREE.BufferGeometry();
    leftGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        0, 0, 0,
        -1.6, 0, 0.45,
        -0.6, 0, 0.55,
    ]), 3));
    leftGeo.computeVertexNormals();
    const leftWing = new THREE.Mesh(leftGeo, mat);
    group.add(leftWing);

    const rightGeo = new THREE.BufferGeometry();
    rightGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        0, 0, 0,
        0.6, 0, 0.55,
        1.6, 0, 0.45,
    ]), 3));
    rightGeo.computeVertexNormals();
    const rightWing = new THREE.Mesh(rightGeo, mat);
    group.add(rightWing);

    group.userData = { leftWing, rightWing };
    return group;
}

// build a small flock of birds in V-formation
function createBirds() {
    const flockSize = 5;
    for (let i = 0; i < flockSize; i += 1) {
        const bird = createBird();
        bird.scale.setScalar(1.4 + (i === 0 ? 0.25 : 0));
        scene.add(bird);
        birds.push(bird);
    }
}

// build the tung tung tung sahur character: a wooden cylinder body
// with a big toothy grin, expressive eyes, skinny limbs, and a held bat
function createTungSahur() {
    const group = new THREE.Group();

    const bodyHeight = 4.0;
    const bodyBottomY = 1.55;
    const bodyRadius = 0.85;

    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xb87a3f,
        roughness: 0.78,
        metalness: 0.05,
    });
    wetMaterials.push({ material: bodyMat, dryRoughness: 0.78, wetRoughness: 0.4, dryMetalness: 0.05, wetMetalness: 0.2 });

    const limbMat = new THREE.MeshStandardMaterial({
        color: 0xa46a3c,
        roughness: 0.85,
        metalness: 0.04,
    });
    wetMaterials.push({ material: limbMat, dryRoughness: 0.85, wetRoughness: 0.45, dryMetalness: 0.04, wetMetalness: 0.2 });

    // simple cylinder body
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 32),
        bodyMat
    );
    body.position.y = bodyBottomY + bodyHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // helper: place a face feature on the curved cylinder front, optionally pushed outward
    function frontZ(x, offset = 0) {
        return Math.sqrt(Math.max(0, bodyRadius * bodyRadius - x * x)) + offset;
    }

    // eye builder: white sclera, brown iris, black pupil, bright highlight
    function makeEye() {
        const eye = new THREE.Group();
        const sclera = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 22, 22),
            new THREE.MeshStandardMaterial({ color: 0xfafaf2, roughness: 0.32 })
        );
        eye.add(sclera);
        const iris = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 18, 18),
            new THREE.MeshBasicMaterial({ color: 0x6b3a18 })
        );
        iris.position.z = 0.2;
        eye.add(iris);
        const pupil = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        pupil.position.z = 0.28;
        eye.add(pupil);
        const highlight = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        highlight.position.set(-0.06, 0.07, 0.305);
        eye.add(highlight);
        return eye;
    }

    // eyes - placed on the curved front and rotated to face radially outward
    const eyeY = bodyBottomY + bodyHeight * 0.78;
    const eyeX = 0.36;
    const leftEye = makeEye();
    leftEye.position.set(-eyeX, eyeY, frontZ(-eyeX, 0.05));
    leftEye.rotation.y = Math.atan2(leftEye.position.x, leftEye.position.z);
    group.add(leftEye);
    const rightEye = makeEye();
    rightEye.position.set(eyeX, eyeY, frontZ(eyeX, 0.05));
    rightEye.rotation.y = Math.atan2(rightEye.position.x, rightEye.position.z);
    group.add(rightEye);

    // thin raised brows above the eyes (wrapped so they also face outward)
    const browGeo = new THREE.BoxGeometry(0.36, 0.05, 0.06);
    const browMat = new THREE.MeshBasicMaterial({ color: 0x1a0c04 });
    function addBrow(x, tilt) {
        const wrapper = new THREE.Group();
        wrapper.position.set(x, eyeY + 0.4, frontZ(x, 0.18));
        wrapper.rotation.y = Math.atan2(wrapper.position.x, wrapper.position.z);
        const brow = new THREE.Mesh(browGeo, browMat);
        brow.rotation.z = tilt;
        wrapper.add(brow);
        group.add(wrapper);
    }
    addBrow(-eyeX, 0.18);
    addBrow(eyeX, -0.18);

    // wide curved smile shape, wrapped onto the cylinder surface so it follows the body curve
    const mouthY = bodyBottomY + bodyHeight * 0.5;
    const mw = 0.55;
    const mh = 0.32;
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-mw, 0.04);
    mouthShape.quadraticCurveTo(-mw * 0.5, 0.16, 0, 0.14);
    mouthShape.quadraticCurveTo(mw * 0.5, 0.16, mw, 0.04);
    mouthShape.quadraticCurveTo(mw * 0.55, -mh, 0, -mh * 1.1);
    mouthShape.quadraticCurveTo(-mw * 0.55, -mh, -mw, 0.04);
    const mouthGeo = new THREE.ShapeGeometry(mouthShape, 24);
    const mouthPositions = mouthGeo.attributes.position;
    for (let i = 0; i < mouthPositions.count; i += 1) {
        const px = mouthPositions.getX(i);
        const angle = px / bodyRadius;
        mouthPositions.setX(i, bodyRadius * Math.sin(angle));
        mouthPositions.setZ(i, bodyRadius * Math.cos(angle) + 0.02);
    }
    mouthPositions.needsUpdate = true;
    mouthGeo.computeVertexNormals();
    const mouth = new THREE.Mesh(
        mouthGeo,
        new THREE.MeshBasicMaterial({ color: 0x180a05, side: THREE.DoubleSide })
    );
    mouth.position.set(0, mouthY, 0);
    group.add(mouth);

    // individual teeth that follow the curved smile
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xf2e8d3 });
    const dividerMat = new THREE.MeshBasicMaterial({ color: 0x180a05 });
    const toothGeo = new THREE.BoxGeometry(0.13, 0.11, 0.04);
    const dividerGeo = new THREE.BoxGeometry(0.018, 0.11, 0.05);
    [-0.32, -0.16, 0, 0.16, 0.32].forEach(tx => {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(tx, mouthY + 0.09, frontZ(tx, 0.04));
        tooth.rotation.y = Math.atan2(tx, frontZ(tx));
        group.add(tooth);
    });
    [-0.24, -0.08, 0.08, 0.24].forEach(dx => {
        const divider = new THREE.Mesh(dividerGeo, dividerMat);
        divider.position.set(dx, mouthY + 0.09, frontZ(dx, 0.05));
        divider.rotation.y = Math.atan2(dx, frontZ(dx));
        group.add(divider);
    });

    // arms attached directly to the SIDE of the cylinder body, hanging straight down
    const shoulderY = bodyBottomY + bodyHeight * 0.55;
    const armGeo = new THREE.CylinderGeometry(0.085, 0.06, 1.5, 12);
    armGeo.translate(0, -0.75, 0);

    const leftArm = new THREE.Mesh(armGeo, limbMat);
    leftArm.position.set(-bodyRadius, shoulderY, 0);
    leftArm.rotation.z = -0.06;
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, limbMat);
    rightArm.position.set(bodyRadius, shoulderY, 0);
    rightArm.rotation.z = 0.06;
    rightArm.castShadow = true;
    group.add(rightArm);

    // simple round hands at the end of each arm
    const handGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const leftHand = new THREE.Mesh(handGeo, limbMat);
    leftHand.position.y = -1.5;
    leftHand.castShadow = true;
    leftArm.add(leftHand);
    const rightHand = new THREE.Mesh(handGeo, limbMat);
    rightHand.position.y = -1.5;
    rightHand.castShadow = true;
    rightArm.add(rightHand);

    // hand-held baseball bat: thin handle and knob at the wrist, tapering down into a thick rounded barrel
    const heldBatMat = new THREE.MeshStandardMaterial({
        color: 0xc8924d,
        roughness: 0.42,
        metalness: 0.08,
    });
    wetMaterials.push({ material: heldBatMat, dryRoughness: 0.42, wetRoughness: 0.18, dryMetalness: 0.08, wetMetalness: 0.3 });

    // profile from barrel tip (low y) up through the taper to the handle and knob (high y)
    const heldBatProfile = [
        new THREE.Vector2(0.001, 0.00),
        new THREE.Vector2(0.100, 0.04),
        new THREE.Vector2(0.135, 0.10),
        new THREE.Vector2(0.150, 0.22),
        new THREE.Vector2(0.155, 0.42),
        new THREE.Vector2(0.155, 0.62),
        new THREE.Vector2(0.140, 0.76),
        new THREE.Vector2(0.115, 0.88),
        new THREE.Vector2(0.085, 1.00),
        new THREE.Vector2(0.062, 1.12),
        new THREE.Vector2(0.052, 1.28),
        new THREE.Vector2(0.050, 1.52),
        new THREE.Vector2(0.075, 1.62),
        new THREE.Vector2(0.085, 1.68),
        new THREE.Vector2(0.050, 1.74),
        new THREE.Vector2(0.001, 1.76),
    ];
    const heldBatGeo = new THREE.LatheGeometry(heldBatProfile, 24);
    // shift so the gripping point on the handle is at the geometry origin
    heldBatGeo.translate(0, -1.56, 0);

    const heldBat = new THREE.Mesh(heldBatGeo, heldBatMat);
    heldBat.position.set(0, 0, 0.04);
    heldBat.rotation.x = -0.55;
    heldBat.scale.setScalar(1.55);
    heldBat.castShadow = true;
    heldBat.receiveShadow = true;
    rightHand.add(heldBat);

    // dark wrapped grip on the handle
    const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.32, 18),
        new THREE.MeshStandardMaterial({ color: 0x1d100a, roughness: 0.95 })
    );
    grip.position.set(0, -0.2, 0);
    grip.castShadow = true;
    heldBat.add(grip);

    // skinny tapered legs hanging from the body bottom
    const legGeo = new THREE.CylinderGeometry(0.11, 0.08, 1.55, 12);
    legGeo.translate(0, -0.78, 0);

    const leftLeg = new THREE.Mesh(legGeo, limbMat);
    leftLeg.position.set(-0.38, bodyBottomY + 0.05, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, limbMat);
    rightLeg.position.set(0.38, bodyBottomY + 0.05, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // rounded oval feet
    const footGeo = new THREE.SphereGeometry(0.18, 16, 12);
    footGeo.scale(1.35, 0.6, 1.95);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x6b4523, roughness: 0.95 });
    wetMaterials.push({ material: footMat, dryRoughness: 0.95, wetRoughness: 0.45, dryMetalness: 0.0, wetMetalness: 0.18 });

    const leftFoot = new THREE.Mesh(footGeo, footMat);
    leftFoot.position.set(0, -1.5, 0.18);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;
    leftLeg.add(leftFoot);
    const rightFoot = new THREE.Mesh(footGeo, footMat);
    rightFoot.position.set(0, -1.5, 0.18);
    rightFoot.castShadow = true;
    rightFoot.receiveShadow = true;
    rightLeg.add(rightFoot);

    group.scale.setScalar(0.95);
    group.userData = { leftArm, rightArm, leftLeg, rightLeg };

    tungSahur = group;
    scene.add(group);
}

// walk tung tung tung sahur in a wide circle around the campfire
function animateTungSahur(elapsed) {
    if (!tungSahur) {
        return;
    }
    tungSahur.visible = state.tungSahurEnabled;
    if (!state.tungSahurEnabled) {
        return;
    }

    // circular path that stays inside the open camp area, outside the fire pit
    const radius = 14;
    const angularSpeed = 0.35;
    const angle = elapsed * angularSpeed;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // bob up and down with each step (always positive so feet stay above ground)
    const stepBob = Math.abs(Math.sin(elapsed * 4.2)) * 0.18;

    tungSahur.position.set(x, stepBob, z);
    // face the direction of motion: tangent to the circle, +Z is the model's front
    tungSahur.rotation.y = -angle;

    // walking animation: alternating limbs
    const swing = Math.sin(elapsed * 7.5) * 0.7;
    const { leftArm, rightArm, leftLeg, rightLeg } = tungSahur.userData;
    leftArm.rotation.x = swing;
    rightArm.rotation.x = -swing;
    leftLeg.rotation.x = -swing * 0.85;
    rightLeg.rotation.x = swing * 0.85;

    // tiny side-to-side waddle
    tungSahur.rotation.z = Math.sin(elapsed * 7.5) * 0.05;
}

// apply tone mapping + multipliers from a preset
function applyLightingMode() {
    const mode = LIGHTING_MODES[state.lightingMode];
    if (!mode || !renderer) {
        return;
    }
    renderer.toneMapping = mode.toneMapping;
    renderer.toneMappingExposure = mode.exposure;
    if (typeof updateDayNightLighting === 'function' && scene) {
        updateDayNightLighting();
    }
}

// animate fireflies drifting + pulsing at night
function animateFireflies(elapsed, daylight) {
    if (!fireflies) {
        return;
    }
    // visible at dusk + night, hidden during day
    const nightFactor = THREE.MathUtils.clamp((0.45 - daylight) / 0.4, 0, 1);
    const isVisible = state.firefliesEnabled && nightFactor > 0.02;
    fireflies.visible = isVisible;
    if (!isVisible) {
        return;
    }

    fireflies.material.uniforms.uTime.value = elapsed;
    fireflies.material.uniforms.uOpacity.value = nightFactor;

    const positions = fireflies.geometry.attributes.position;
    const base = fireflies.userData.basePositions;
    for (let i = 0; i < positions.count; i += 1) {
        const i3 = i * 3;
        const baseX = base[i3];
        const baseY = base[i3 + 1];
        const baseZ = base[i3 + 2];
        positions.array[i3] = baseX + Math.sin(elapsed * 0.35 + i * 0.7) * 1.6;
        positions.array[i3 + 1] = baseY + Math.cos(elapsed * 0.45 + i * 1.3) * 0.85;
        positions.array[i3 + 2] = baseZ + Math.cos(elapsed * 0.4 + i * 0.5) * 1.6;
    }
    positions.needsUpdate = true;
}

// animate birds flying in V-formation overhead during the day
function animateBirds(elapsed, daylight) {
    if (!birds.length) {
        return;
    }
    const isVisible = state.birdsEnabled && daylight > 0.45;

    const t = elapsed * 0.05;
    const radius = 115;
    const height = 70;
    const tangent = new THREE.Vector3(-Math.sin(t), 0, Math.cos(t));
    const sideVec = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const leadX = Math.cos(t) * radius;
    const leadZ = Math.sin(t) * radius;

    const formation = [
        { back: 0, side: 0 },
        { back: 4.5, side: 3.5 },
        { back: 4.5, side: -3.5 },
        { back: 9, side: 7 },
        { back: 9, side: -7 },
    ];

    const lookTarget = new THREE.Vector3();
    birds.forEach((bird, idx) => {
        bird.visible = isVisible;
        if (!isVisible) {
            return;
        }
        const off = formation[idx] || formation[0];
        const x = leadX - tangent.x * off.back + sideVec.x * off.side;
        const z = leadZ - tangent.z * off.back + sideVec.z * off.side;
        const y = height + Math.sin(elapsed * 0.5 + idx * 0.7) * 1.6;

        bird.position.set(x, y, z);
        lookTarget.set(x + tangent.x, y, z + tangent.z);
        bird.lookAt(lookTarget);

        const flap = Math.sin(elapsed * 7 + idx * 0.5) * 0.75;
        bird.userData.leftWing.rotation.z = -flap;
        bird.userData.rightWing.rotation.z = flap;
    });
}

// drive camera along a smooth catmull-rom path during demo mode
function updateCinematicCamera(elapsed) {
    if (!state.demoMode) {
        return;
    }
    // 1 cycle takes ~50s at speed 1
    const t = ((elapsed * 0.02 * state.demoSpeed) % 1 + 1) % 1;
    const pos = cameraCurve.getPoint(t);
    const tgt = targetCurve.getPoint(t);
    camera.position.copy(pos);
    camera.lookAt(tgt);
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
    // start disabled, GUI toggle controls it
    ssaoPass.enabled = state.ambientOcclusion;
    composer.addPass(ssaoPass);

    // OutputPass is required after SSAOPass so the multiplicatively-blended result
    // ends up on the populated scene buffer instead of a cleared canvas
    composer.addPass(new OutputPass());
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
    aoFolder.add(state, 'ambientOcclusion').name('Enabled').onChange((value) => {
        if (ssaoPass) ssaoPass.enabled = value;
    });
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

    const lightingFolder = gui.addFolder('Lighting Mode');
    lightingFolder
        .add(state, 'lightingMode', Object.keys(LIGHTING_MODES))
        .name('Style')
        .onChange(applyLightingMode);
    lightingFolder.open();

    const wildlifeFolder = gui.addFolder('Wildlife');
    wildlifeFolder.add(state, 'firefliesEnabled').name('Fireflies (night)');
    wildlifeFolder.add(state, 'birdsEnabled').name('Birds (day)');
    wildlifeFolder.add(state, 'tungSahurEnabled').name('Tung Sahur');
    wildlifeFolder.open();

    const demoFolder = gui.addFolder('Cinematic Demo');
    demoFolder
        .add(state, 'demoMode')
        .name('Auto Camera')
        .onChange(value => {
            controls.enabled = !value;
            if (!value) {
                controls.target.set(0, 4, 0);
            }
        });
    demoFolder.add(state, 'demoSpeed', 0.25, 3, 0.05).name('Speed');
    demoFolder.open();
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
    const sinSun = Math.sin(sunOrbit);
    const cosSun = Math.cos(sunOrbit);

    // visual sun sits far out on the sky dome
    const sunMeshPos = new THREE.Vector3(
        cosSun * SKY_DISTANCE,
        sinSun * SKY_DISTANCE * SKY_Y_RATIO,
        -SKY_DISTANCE * 0.18
    );
    sunMesh.position.copy(sunMeshPos);

    // directional light sits closer along the same direction so shadow camera still covers the scene
    const sunDir = sunMeshPos.clone().normalize();
    sunLight.position.copy(sunDir.multiplyScalar(SUN_LIGHT_DISTANCE));

    // moon mirrors the sun on the opposite side of the sky
    const moonMeshPos = new THREE.Vector3(
        -cosSun * SKY_DISTANCE,
        -sinSun * SKY_DISTANCE * SKY_Y_RATIO,
        -SKY_DISTANCE * 0.13
    );
    moonMesh.position.copy(moonMeshPos);

    // daylight is driven directly by the sun angle so it does not depend on distance
    const daylight = THREE.MathUtils.clamp(sinSun + 0.06, 0, 1);
    const duskFactor = 1 - Math.abs(daylight - 0.45) / 0.45;
    const twilight = THREE.MathUtils.clamp(duskFactor, 0, 1);

    const daySky = new THREE.Color(0x8fcfff);
    const duskSky = new THREE.Color(0xff7f4d);
    const nightSky = new THREE.Color(0x070b1d);
    const skyColor = new THREE.Color().lerpColors(nightSky, duskSky, twilight).lerp(daySky, daylight);
    if (state.weatherEnabled && state.fogStrength > 0) {
        skyColor.lerp(new THREE.Color(0x7a8698), state.fogStrength * 0.5);
    }
    scene.background = skyColor;
    scene.fog.color.copy(skyColor);

    // fog only when weather is enabled; intensity scales with fogStrength
    if (state.weatherEnabled) {
        scene.fog.near = 220 - state.fogStrength * 150;
        scene.fog.far = 620 - state.fogStrength * 340;
    } else {
        scene.fog.near = 10000;
        scene.fog.far = 10001;
    }

    const mode = LIGHTING_MODES[state.lightingMode] || LIGHTING_MODES.Realistic;
    ambientLight.intensity = THREE.MathUtils.lerp(0.08, 0.34, daylight) * mode.ambientMult;
    hemisphereLight.intensity = THREE.MathUtils.lerp(0.12, 0.52, daylight) * mode.hemisphereMult;
    sunLight.intensity = THREE.MathUtils.lerp(0.1, 2.3, daylight) * mode.sunMult;
    lakeAreaLight.intensity = THREE.MathUtils.lerp(2.8, 0.45, daylight);

    stars.visible = daylight < 0.35;
    stars.material.opacity = THREE.MathUtils.lerp(0.05, 0.95, 1 - daylight);

    // fade the sun out smoothly as it dips toward and past the horizon so it never punches through the ground
    const sunHorizonFade = THREE.MathUtils.smoothstep(sunMeshPos.y, -4, 22);
    sunMesh.material.opacity = sunHorizonFade;
    sunMesh.visible = sunHorizonFade > 0.01;

    // moon only shows when its above the horizon and the sky is dim enough
    const moonHorizonFade = THREE.MathUtils.smoothstep(moonMeshPos.y, -4, 22);
    const moonNightFade = THREE.MathUtils.smoothstep(0.6 - daylight, 0, 0.18);
    moonMesh.material.opacity = moonHorizonFade * moonNightFade;
    moonMesh.visible = moonMesh.material.opacity > 0.01;
}

// animate campfire movement and light
function animateCampfire(elapsedTime, daylight) {
    // drive the flame shader animation
    flameMeshes.forEach(flame => {
        if (flame.material.uniforms?.uTime) {
            flame.material.uniforms.uTime.value = elapsedTime;
        }
    });

    const flicker = 0.82 + Math.sin(elapsedTime * 24) * 0.15 + Math.sin(elapsedTime * 38) * 0.08;
    // much stronger at night so the camp glow actually pushes back the dark
    const nightBoost = THREE.MathUtils.lerp(2.6, 0.55, daylight);
    const mode = LIGHTING_MODES[state.lightingMode] || LIGHTING_MODES.Realistic;
    const fireIntensity = state.campfireIntensity * flicker * nightBoost * mode.fireMult;
    // multipliers convert the user-facing slider into physically meaningful candela values
    campfireLight.intensity = fireIntensity * 38;
    campfireSpotLight.intensity = fireIntensity * 22;
    if (campfireAreaLight) {
        campfireAreaLight.intensity = fireIntensity * 4.5;
    }
}

// animate campfire particles
function animateCampfireParticles(delta, daylight) {
    if (!sparkParticles || !smokeParticles) {
        return;
    }

    const enabled = state.campfireParticles;
    sparkParticles.visible = enabled;
    smokeParticles.visible = enabled;
    if (!enabled) {
        return;
    }

    // sparks pop a bit more at night
    sparkParticles.material.uniforms.uOpacity.value =
        state.sparkAmount * (0.6 + (1 - daylight) * 0.4);
    smokeParticles.material.uniforms.uOpacity.value = state.smokeAmount * 0.95;

    // sparks
    const sparkPositions = sparkParticles.geometry.attributes.position;
    const sparkLifeAttr = sparkParticles.geometry.attributes.aLife;
    const sparkData = sparkParticles.userData;
    for (let i = 0; i < sparkPositions.count; i += 1) {
        const i3 = i * 3;
        let life = sparkData.lifetimes[i] + delta;
        let vx = sparkData.velocities[i3];
        let vy = sparkData.velocities[i3 + 1];
        let vz = sparkData.velocities[i3 + 2];
        let x = sparkPositions.array[i3];
        let y = sparkPositions.array[i3 + 1];
        let z = sparkPositions.array[i3 + 2];

        // gravity + drag + tiny turbulence
        vy -= 4.2 * delta;
        vx *= 0.985;
        vz *= 0.985;
        vx += (Math.random() - 0.5) * 0.18;
        vz += (Math.random() - 0.5) * 0.18;

        x += vx * delta;
        y += vy * delta;
        z += vz * delta;

        if (life > sparkData.maxLifetimes[i] || y < 0.4) {
            x = (Math.random() - 0.5) * 0.8;
            y = 1.4 + Math.random() * 0.7;
            z = (Math.random() - 0.5) * 0.8;
            const theta = Math.random() * Math.PI * 2;
            const horizontalSpeed = 0.6 + Math.random() * 1.6;
            vx = Math.cos(theta) * horizontalSpeed;
            vy = 3.5 + Math.random() * 4.8;
            vz = Math.sin(theta) * horizontalSpeed;
            life = 0;
            sparkData.maxLifetimes[i] = 0.8 + Math.random() * 1.6;
        }

        sparkData.lifetimes[i] = life;
        sparkLifeAttr.array[i] = life;
        sparkData.velocities[i3] = vx;
        sparkData.velocities[i3 + 1] = vy;
        sparkData.velocities[i3 + 2] = vz;
        sparkPositions.array[i3] = x;
        sparkPositions.array[i3 + 1] = y;
        sparkPositions.array[i3 + 2] = z;
    }
    sparkPositions.needsUpdate = true;
    sparkLifeAttr.needsUpdate = true;

    // smoke
    const smokePositions = smokeParticles.geometry.attributes.position;
    const smokeLifeAttr = smokeParticles.geometry.attributes.aLife;
    const smokeRotAttr = smokeParticles.geometry.attributes.aRotation;
    const smokeData = smokeParticles.userData;
    const wind = clock.elapsedTime;
    for (let i = 0; i < smokePositions.count; i += 1) {
        const i3 = i * 3;
        let life = smokeData.lifetimes[i] + delta;
        let vx = smokeData.velocities[i3];
        let vy = smokeData.velocities[i3 + 1];
        let vz = smokeData.velocities[i3 + 2];
        let x = smokePositions.array[i3];
        let y = smokePositions.array[i3 + 1];
        let z = smokePositions.array[i3 + 2];

        // gentle global wind + per-particle jitter
        vx += (Math.sin(wind * 0.4 + i * 0.13) * 0.05 + (Math.random() - 0.5) * 0.06) * delta;
        vz += (Math.cos(wind * 0.35 + i * 0.18) * 0.05 + (Math.random() - 0.5) * 0.06) * delta;
        vy *= 0.999;

        x += vx * delta;
        y += vy * delta;
        z += vz * delta;

        smokeData.rotations[i] += smokeData.rotationSpeeds[i] * delta;

        if (life > smokeData.maxLifetimes[i]) {
            x = (Math.random() - 0.5) * 1.4;
            y = 4.0 + Math.random() * 1.6;
            z = (Math.random() - 0.5) * 1.4;
            const theta = Math.random() * Math.PI * 2;
            const horizontalSpeed = 0.18 + Math.random() * 0.55;
            vx = Math.cos(theta) * horizontalSpeed;
            vy = 1.6 + Math.random() * 1.6;
            vz = Math.sin(theta) * horizontalSpeed;
            life = 0;
            smokeData.maxLifetimes[i] = 5.5 + Math.random() * 5.5;
        }

        smokeData.lifetimes[i] = life;
        smokeLifeAttr.array[i] = life;
        smokeData.velocities[i3] = vx;
        smokeData.velocities[i3 + 1] = vy;
        smokeData.velocities[i3 + 2] = vz;
        smokePositions.array[i3] = x;
        smokePositions.array[i3 + 1] = y;
        smokePositions.array[i3 + 2] = z;
        smokeRotAttr.array[i] = smokeData.rotations[i];
    }
    smokePositions.needsUpdate = true;
    smokeLifeAttr.needsUpdate = true;
    smokeRotAttr.needsUpdate = true;
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

    // recover sin of the sun angle from its mesh y so daylight matches updateDayNightLighting
    const sinSunNow = sunMesh.position.y / (SKY_DISTANCE * SKY_Y_RATIO);
    const daylight = THREE.MathUtils.clamp(sinSunNow + 0.06, 0, 1);
    animateCampfire(elapsed, daylight);
    animateCampfireParticles(delta, daylight);
    animateWeather(delta);
    animateFireflies(elapsed, daylight);
    animateBirds(elapsed, daylight);
    animateTungSahur(elapsed);
    updateCinematicCamera(elapsed);

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

    if (!state.demoMode) {
        controls.update();
    }

    if (composer) {
        if (ssaoPass) ssaoPass.enabled = state.ambientOcclusion;
        try {
            composer.render();
        } catch (error) {
            console.warn('Post-processing failed, falling back to direct render:', error);
            renderer.render(scene, camera);
        }
    } else {
        renderer.render(scene, camera);
    }
}

init();
