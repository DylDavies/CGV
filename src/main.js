// src/main.js - Fixed version with improved flashlight and physics

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@^0.20.0';

// Import components
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { ImprovedFlashlight } from './components/Player/ImprovedFlashlight.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { ProceduralMansion } from './systems/ProceduralMansion.js';
import { CannonPhysicsManager } from './systems/CannonPhysicsManager.js';

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

        // Create scene with horror atmosphere
        loadingText.textContent = "Creating world...";
        const scene = createScene();
        scene.background = new THREE.Color(0x000000); // Pure black for horror
        scene.fog = new THREE.Fog(0x000000, 10, 50); // Dense fog for atmosphere
        
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        console.log('📷 Camera created');
        
        const renderer = createRenderer(canvas);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);

        // Add minimal ambient light for horror atmosphere
        loadingText.textContent = "Setting up lighting...";

        // Very dim ambient light - just enough to see walls
        const ambientLight = new THREE.AmbientLight(0x404040, 0.1); // Much dimmer
        scene.add(ambientLight);

        // Dev mode lighting override
        const devModeLight = new THREE.DirectionalLight(0xffffff, 0);
        devModeLight.position.set(0, 50, 0);
        devModeLight.castShadow = true;
        devModeLight.shadow.camera.left = -50;
        devModeLight.shadow.camera.right = 50;
        devModeLight.shadow.camera.top = 50;
        devModeLight.shadow.camera.bottom = -50;
        scene.add(devModeLight);

        console.log('💡 Ambient light added (horror mode)');
        
        // Initialize physics system
        loadingText.textContent = "Setting up physics...";
        const physicsManager = new CannonPhysicsManager(camera, devModeLight);
        
        // Create mansion
        loadingText.textContent = "Generating mansion...";
        const mansion = new ProceduralMansion(scene, physicsManager);
        mansion.generateMansion();
        console.log(`🏠 Mansion created with ${mansion.rooms.length} rooms`);

        // Position camera at ground level entrance
        const entranceRoom = mansion.rooms.find(room => room.type === 'entrance');
        if (entranceRoom) {
            const spawnY = (entranceRoom.baseHeight || 0) + 3; // 3 meters above floor
            camera.position.set(entranceRoom.center.x, spawnY, entranceRoom.center.z + 3);
            physicsManager.teleportTo(new THREE.Vector3(entranceRoom.center.x, spawnY, entranceRoom.center.z + 3));
            console.log(`🚪 Spawned at entrance on level ${entranceRoom.level || 0} at height ${spawnY}m`);
        } else {
            camera.position.set(0, 3, 0);
            physicsManager.teleportTo(new THREE.Vector3(0, 3, 0));
            console.log('🚪 No entrance found, spawned at origin');
        }
        console.log('📍 Camera positioned at:', camera.position);

        // Add camera to scene (required for proper transforms)
        scene.add(camera);
        console.log('📷 Camera added to scene');

        // Create improved flashlight
        loadingText.textContent = "Creating flashlight...";
        console.log('🔦 Creating improved flashlight...');
        const flashlight = new ImprovedFlashlight(camera, scene);
        console.log('🔦 Flashlight system ready');

        // Set up controls with physics manager
        const controls = new FirstPersonControls(camera, renderer.domElement);
        controls.setPhysicsManager(physicsManager);
        
        // Configure physics
        physicsManager.setGravity(-15);
        physicsManager.setMovementSpeeds(4, 7, 2, 10); // walk, run, crouch, fly
        
        const resizer = new Resizer(camera, renderer);

        // Add updatables to loop
        loop.updatables.push(controls, physicsManager, flashlight, mansion);

        // Global debug controls
        window.gameControls = {
            camera,
            scene,
            ambientLight,
            devModeLight,
            flashlight,
            physicsManager,
            mansion,
            
            // Helper functions
            addLight: () => {
                const light = new THREE.PointLight(0xffffff, 1, 20);
                light.position.copy(camera.position);
                scene.add(light);
                console.log('💡 Added light at camera position');
                return light;
            },
            
            brighten: () => {
                ambientLight.intensity = Math.min(2, ambientLight.intensity + 0.1);
                console.log(`💡 Ambient light: ${ambientLight.intensity.toFixed(1)}`);
            },
            
            darken: () => {
                ambientLight.intensity = Math.max(0, ambientLight.intensity - 0.1);
                console.log(`💡 Ambient light: ${ambientLight.intensity.toFixed(1)}`);
            },
            
            teleport: (x, y, z) => {
                camera.position.set(x, y, z);
                physicsManager.teleportTo(new THREE.Vector3(x, y, z));
                console.log(`📍 Teleported to: ${x}, ${y}, ${z}`);
            },
            
            toggleFlashlightDebug: () => {
                flashlight.toggleDebug();
                console.log('🔦 Flashlight debug toggled');
            },
            
            rechargeFlashlight: () => {
                flashlight.rechargeBattery(100);
            },
            
            getStatus: () => {
                const physicsState = physicsManager.getDebugInfo();
                const flashlightState = flashlight.getState();
                console.log('=== Game Status ===');
                console.log('Position:', physicsState.position);
                console.log('On Ground:', physicsState.isOnGround);
                console.log('Dev Mode:', physicsState.devMode);
                console.log('Fly Mode:', physicsState.flyMode);
                console.log('Flashlight:', flashlightState.isOn ? 'ON' : 'OFF');
                console.log('Battery:', flashlightState.battery.percentage.toFixed(0) + '%');
            }
        };

        console.log('🔧 DEBUG COMMANDS:');
        console.log('=== DEVELOPER MODE ===');
        console.log('F9 - Toggle developer mode');
        console.log('F10 - Toggle fly mode (when in dev mode)');
        console.log('F11 - Toggle stats display');
        console.log('Q/E - Fly up/down (when in fly mode)');
        console.log('');
        console.log('=== DEBUG COMMANDS ===');
        console.log('window.gameControls.brighten() - Increase ambient lighting');
        console.log('window.gameControls.darken() - Decrease ambient lighting');
        console.log('window.gameControls.addLight() - Add light at camera');
        console.log('window.gameControls.teleport(x, y, z) - Move camera');
        console.log('window.gameControls.rechargeFlashlight() - Recharge battery');
        console.log('window.gameControls.getStatus() - Get current game state');
        console.log('');
        console.log('=== CONTROLS ===');
        console.log('Click to lock cursor');
        console.log('WASD - Move');
        console.log('Shift - Run');
        console.log('Ctrl - Crouch');
        console.log('Space - Jump');
        console.log('F - Toggle flashlight');
        console.log('ESC - Release cursor');

        // Start game
        loadingText.textContent = "Ready to play!";
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            document.body.classList.add('game-active');
            
            console.log('🎮 GAME STARTED!');
            console.log('Click to lock cursor and begin');
            
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