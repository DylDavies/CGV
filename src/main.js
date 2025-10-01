// src/main.js - Fixed version with improved flashlight and physics

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import components
import { createScene } from './components/World/scene.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { ImprovedFlashlight } from './components/Player/ImprovedFlashlight.js';
import { Monster } from './components/Monster/Monster.js'; // Import the Monster class
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { ProceduralMansion } from './systems/ProceduralMansion.js';
import { CannonPhysicsManager } from './systems/CannonPhysicsManager.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { GameManager } from './systems/GameManager.js';
import { PuzzleSystem } from './systems/PuzzleSystem.js';

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

        loadingText.textContent = "Creating world...";
        const scene = createScene();

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        console.log('📷 Camera created');

        // *** ADDED FOR MONSTER VISION ***
        const playerGeometry = new THREE.BoxGeometry(1, 1.8, 1);
        const playerMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const playerBody = new THREE.Mesh(playerGeometry, playerMaterial);
        playerBody.name = "player_body";
        scene.add(playerBody);

        const renderer = createRenderer(canvas);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);
        
        // Sync player body with camera
        loop.updatables.push({
            tick: () => {
                playerBody.position.copy(camera.position);
            }
        });

        loadingText.textContent = "Setting up lighting...";
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        scene.add(ambientLight);

        const devModeLight = new THREE.DirectionalLight(0xffffff, 0);
        devModeLight.position.set(0, 50, 0);
        devModeLight.castShadow = true;
        scene.add(devModeLight);

        loadingText.textContent = "Setting up physics...";
        const physicsManager = new CannonPhysicsManager(camera, devModeLight);

        loadingText.textContent = "Generating mansion...";
        const mansion = new ProceduralMansion(scene, physicsManager);
        mansion.generateMansion();
        
        const entranceRoom = mansion.rooms.find(room => room.type === 'entrance') || mansion.rooms[0];
        if (entranceRoom) {
            const spawnY = (entranceRoom.baseHeight || 0) + 1.8;
            camera.position.set(entranceRoom.center.x, spawnY, entranceRoom.center.z);
            physicsManager.teleportTo(new THREE.Vector3(entranceRoom.center.x, spawnY, entranceRoom.center.z));
        } else {
            camera.position.set(0, 1.8, 5);
            physicsManager.teleportTo(new THREE.Vector3(0, 1.8, 5));
        }
        
        scene.add(camera);

        loadingText.textContent = "Creating flashlight...";
        const flashlight = new ImprovedFlashlight(camera, scene);
        
        const controls = new FirstPersonControls(camera, renderer.domElement);
        controls.setPhysicsManager(physicsManager);

        const resizer = new Resizer(camera, renderer);

        loadingText.textContent = "Setting up game systems...";
        const gameManager = new GameManager(mansion, camera, scene);
        window.gameManager = gameManager; // Make accessible for UI
        const puzzleSystem = new PuzzleSystem(scene, gameManager);
        const interactionSystem = new InteractionSystem(camera, scene, gameManager);

        loadingText.textContent = "Waking the beast...";
        
        const navGrid = [];
        for (let z = 0; z < mansion.mansionHeight; z++) {
            navGrid[z] = [];
            for (let x = 0; x < mansion.mansionWidth; x++) {
                navGrid[z][x] = mansion.grid[x][z].occupied ? 0 : 1;
            }
        }

         console.log("🗺️ Monster Navigation Grid:");
        const gridVisualization = navGrid.map(row => 
            row.map(tile => (tile === 0 ? "⬜" : "⬛")).join(" ")
        ).join("\n");
        console.log(gridVisualization);
    // END OF SNIPPET -->
        
        const playerForAI = { model: playerBody };
        const walls = mansion.getCollisionMeshes().walls;
        
        const monster = new Monster(playerForAI, scene, navGrid, walls, camera, mansion);
        await monster.load();
        
        // <-- FIX: Changed this line to find the 'entrance' room for the monster spawn.
        const spawnRoom = mansion.rooms.find(r => r.type === 'entrance') || mansion.rooms[0];

        if (spawnRoom && monster.model) {
            const spawnHeight = (spawnRoom.baseHeight || 0) + 1.0;
            // Spawn monster slightly away from the center to avoid being inside the player
            monster.model.position.set(spawnRoom.center.x + 2, spawnHeight, spawnRoom.center.z);
        } else if(monster.model) {
            monster.model.position.set(20, 1.0, 20);
        }

        loop.updatables.push(controls, physicsManager, flashlight, mansion, interactionSystem, puzzleSystem, monster);

        // Global debug controls
        window.gameControls = {
            camera,
            scene,
            ambientLight,
            devModeLight,
            flashlight,
            physicsManager,
            mansion,
            gameManager,
            interactionSystem,
            puzzleSystem,
            debugNoclip: false,

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
            toggleNoclip: () => {
                window.gameControls.debugNoclip = !window.gameControls.debugNoclip;
                physicsManager.setNoclip(window.gameControls.debugNoclip);
                console.log('🚪 Noclip (walk through doors):', window.gameControls.debugNoclip ? 'ON' : 'OFF');
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

        // ... (console logs for controls)
        
        loadingText.textContent = "Ready to play!";
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            document.body.classList.add('game-active');
            loop.start();
        }, 1000);

    } catch (error) {
        console.error('🚨 STARTUP ERROR:', error);
        loadingText.textContent = `Error: ${error.message}`;
        loadingText.style.color = '#ff0000';
    }
}

window.addEventListener('error', (event) => {
    console.error('🚨 RUNTIME ERROR:', event.error);
});