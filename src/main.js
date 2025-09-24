// src/main.js - Simplified error-free version

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import components
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { ProceduralMansion } from './systems/ProceduralMansion.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { PhysicsManager } from './systems/PhysicsManager.js';

const welcomeScreen = document.getElementById('welcome-screen');
const playButton = document.getElementById('play-btn');
const loadingScreen = document.getElementById('loading-container'); 
const loadingText = document.getElementById('loading-text');

playButton.addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
    loadingScreen.style.display = 'flex';
    main();
});

async function main() {
    try {
        console.log('🚀 Starting PROJECT HER...');
        
        const canvas = document.querySelector('#game-canvas');

        // Create scene with better lighting
        loadingText.textContent = "Creating world...";
        const scene = createScene();
        scene.background = new THREE.Color(0x222222); // Lighter gray background
        scene.fog = new THREE.Fog(0x222222, 20, 60); // Less aggressive fog
        
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        console.log('📷 Camera created');
        
        const renderer = createRenderer(canvas);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);

        // Add good lighting FIRST
        loadingText.textContent = "Setting up lighting...";
        
        // Strong ambient light so we can see
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Bright enough to see
        scene.add(ambientLight);
        console.log('💡 Ambient light added');
        
        // Directional light for depth
        const directionalLight = new THREE.DirectionalLight(0x404040, 0.4);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        console.log('☀️ Directional light added');
        
        // Add a test cube to see if anything is visible
        const testGeometry = new THREE.BoxGeometry(2, 2, 2);
        const testMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const testCube = new THREE.Mesh(testGeometry, testMaterial);
        testCube.position.set(0, 1, -5);
        scene.add(testCube);
        console.log('🟢 Test cube added at (0, 1, -5)');

        // Initialize systems
        loadingText.textContent = "Initializing collision system...";
        const collisionSystem = new CollisionSystem(scene, camera);
        
        loadingText.textContent = "Setting up physics...";
        const physicsManager = new PhysicsManager(collisionSystem, camera);
        
        // Create mansion
        loadingText.textContent = "Generating mansion...";
        const mansion = new ProceduralMansion(scene, collisionSystem);
        mansion.generateMansion();
        console.log(`🏠 Mansion created with ${mansion.rooms.length} rooms`);

        // Position camera
        const entranceRoom = mansion.rooms.find(room => room.type === 'entrance');
        if (entranceRoom) {
            camera.position.set(entranceRoom.center.x, 3, entranceRoom.center.z + 3);
            physicsManager.teleportTo(camera.position.clone());
        } else {
            camera.position.set(0, 3, 0);
            physicsManager.teleportTo(new THREE.Vector3(0, 3, 0));
        }
        console.log('📍 Camera positioned at:', camera.position);

        // Add camera to scene (required for lights attached to camera)
        scene.add(camera);
        console.log('📷 Camera added to scene');

        // Create flashlight AFTER camera is in scene
        loadingText.textContent = "Creating flashlight...";
        console.log('🔦 Creating flashlight...');
        
        class SimpleFlashlight {
            constructor(camera) {
                this.camera = camera;
                this.isOn = true;
                this.battery = 100;
                
                // Create bright spotlight
                this.light = new THREE.SpotLight(0xffffff, 3, 25, Math.PI/4, 0.1, 1);
                this.light.position.set(0.3, -0.1, 0);
                this.light.castShadow = true;
                
                // Create target
                this.target = new THREE.Object3D();
                this.target.position.set(0, 0, -10);
                this.light.target = this.target;
                
                // Add to camera
                camera.add(this.light);
                camera.add(this.target);
                
                // Controls
                document.addEventListener('keydown', (e) => {
                    if (e.code === 'KeyF') {
                        this.toggle();
                    }
                });
                
                console.log('🔦 Flashlight created and attached to camera');
            }
            
            toggle() {
                this.isOn = !this.isOn;
                this.light.visible = this.isOn;
                console.log(`🔦 Flashlight ${this.isOn ? 'ON' : 'OFF'}`);
            }
            
            tick(delta) {
                if (this.isOn) {
                    this.battery -= 0.2 * delta;
                    if (this.battery <= 0) {
                        this.battery = 0;
                        this.isOn = false;
                        this.light.visible = false;
                    }
                }
            }
        }
        
        const flashlight = new SimpleFlashlight(camera);

        // Set up controls - FIXED: Pass proper physics manager
        const controls = new FirstPersonControls(camera, renderer.domElement);
        controls.setPhysicsManager(physicsManager); // This ensures proper integration
        
        // Configure physics
        physicsManager.setGravity(-15);
        physicsManager.setMovementSpeeds(4, 7, 2);
        
        const resizer = new Resizer(camera, renderer);

        // Add updatables to loop
        loop.updatables.push(controls, physicsManager, flashlight, mansion);

        // Global debug controls
        window.gameControls = {
            camera,
            scene,
            ambientLight,
            directionalLight,
            flashlight,
            physicsManager,
            mansion,
            testCube,
            
            // Helper functions
            addLight: () => {
                const light = new THREE.PointLight(0xffffff, 1, 20);
                light.position.copy(camera.position);
                scene.add(light);
                console.log('💡 Added light at camera position');
            },
            
            brighten: () => {
                ambientLight.intensity = Math.min(2, ambientLight.intensity + 0.2);
                console.log(`💡 Ambient light: ${ambientLight.intensity.toFixed(1)}`);
            },
            
            darken: () => {
                ambientLight.intensity = Math.max(0, ambientLight.intensity - 0.2);
                console.log(`💡 Ambient light: ${ambientLight.intensity.toFixed(1)}`);
            },
            
            teleport: (x, y, z) => {
                camera.position.set(x, y, z);
                physicsManager.teleportTo(new THREE.Vector3(x, y, z));
                console.log(`📍 Teleported to: ${x}, ${y}, ${z}`);
            }
        };

        console.log('🔧 DEBUG COMMANDS:');
        console.log('window.gameControls.brighten() - Increase lighting');
        console.log('window.gameControls.darken() - Decrease lighting');
        console.log('window.gameControls.addLight() - Add light at camera');
        console.log('window.gameControls.flashlight.toggle() - Toggle flashlight');
        console.log('window.gameControls.teleport(0, 5, 0) - Move camera');

        console.log('🔍 SCENE STATUS:');
        console.log(`- Scene has ${scene.children.length} objects`);
        console.log(`- Camera position: ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`);
        console.log(`- Ambient light intensity: ${ambientLight.intensity}`);
        console.log(`- Flashlight visible: ${flashlight.light.visible}`);

        // Start game
        loadingText.textContent = "Ready to play!";
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            document.body.classList.add('game-active');
            
            console.log('🎮 GAME STARTED!');
            console.log('Click to lock cursor, then use WASD to move, F for flashlight');
            
            loop.start();
        }, 1000);

    } catch (error) {
        console.error('🚨 STARTUP ERROR:', error);
        loadingText.textContent = `Error: ${error.message}`;
        loadingText.style.color = '#ff0000';
    }
}

// Error handling
window.addEventListener('error', (event) => {
    console.error('🚨 RUNTIME ERROR:', event.error);
});

window.main = main;