// Updated src/main.js - Integration with Procedural Mansion

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import all your components and systems
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';
import { createPlayer } from './components/Player/Player.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { SimpleFlashlight } from './components/Player/SimpleFlashlight.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { ProceduralMansion } from './systems/ProceduralMansion.js';
import { GameManager } from './systems/GameManager.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
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
    const canvas = document.querySelector('#game-canvas');

    // Update loading text
    loadingText.textContent = "Generating mansion layout...";
    
    const scene = createScene();
    // Make the scene darker for horror atmosphere
    scene.background = new THREE.Color(0x0a0a0a);
    
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = createRenderer(canvas);
    const stats = createStats();
    const loop = new Loop(camera, scene, renderer, stats);

    // Initialize collision system
    loadingText.textContent = "Initializing physics systems...";
    const collisionSystem = new CollisionSystem(scene, camera);

    // Initialize physics manager
    const physicsManager = new PhysicsManager(collisionSystem, camera);

    // Create the procedural mansion with collision system
    loadingText.textContent = "Building rooms and hallways...";
    const mansion = new ProceduralMansion(scene, collisionSystem);
    
    // Generate the mansion
    loadingText.textContent = "Placing furniture and puzzles...";
    await new Promise(resolve => setTimeout(resolve, 500)); // Show loading text
    mansion.generateMansion();

    // Build spatial hash for performance optimization
    loadingText.textContent = "Optimizing collision detection...";
    mansion.buildCollisionSpatialHash();

    // Position camera at the entrance
    const entranceRoom = mansion.rooms.find(room => room.type === 'entrance');
    if (entranceRoom) {
        const startPosition = new THREE.Vector3(
            entranceRoom.center.x,
            3, // Higher eye level (1.8m above ground)
            entranceRoom.center.z + 5 // Slightly back from center
        );
        camera.position.copy(startPosition);
        physicsManager.teleportTo(startPosition);
    } else {
        const fallbackPosition = new THREE.Vector3(0, 3, 20);
        camera.position.copy(fallbackPosition);
        physicsManager.teleportTo(fallbackPosition);
    }

    loadingText.textContent = "Initializing game systems...";

    // Create game systems
    const gameManager = new GameManager(mansion, camera, scene);
    const interactionSystem = new InteractionSystem(camera, scene, gameManager);

    // Set up controls with physics manager
    const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager);
    
    // Create simple, reliable flashlight
    loadingText.textContent = "Setting up lighting systems...";
    const flashlight = new SimpleFlashlight(camera, scene);

    // Add minimal ambient light for horror atmosphere
    const { ambientLight } = createLights();
    ambientLight.intensity = 0.1; // Very dim ambient light
    scene.add(ambientLight);

    // Add camera to scene (needed for flashlight)
    scene.add(camera);

    const resizer = new Resizer(camera, renderer);

    // Add all updatable objects to the loop
    loop.updatables.push(controls, mansion, gameManager, interactionSystem, physicsManager, flashlight);
    
    // Configure systems for horror game
    loadingText.textContent = "Configuring horror atmosphere...";

    // Set realistic physics properties
    physicsManager.setGravity(-15.0); // Slightly lower gravity for smoother feel
    physicsManager.setMovementSpeeds(2.5, 4.5, 1.2); // walk, run, crouch speeds
    physicsManager.enableHeadBob(true);
    physicsManager.setHeadBobProperties(0.04, 6.0); // More pronounced head bob

    // Configure flashlight for horror atmosphere
    flashlight.batteryDrainRate = 0.3; // Slower drain for gameplay

    // Make controls globally accessible for debugging
    window.gameControls = {
        physicsManager,
        collisionSystem,
        flashlight,
        mansion,
        controls,
        camera
    };

    // Debug commands (remove in production)
    console.log("🎮 Game Controls Available:");
    console.log("- window.gameControls.mansion.toggleCollisionDebug() - Show collision meshes");
    console.log("- window.gameControls.physicsManager.increaseFear(50) - Add fear effect");
    console.log("- window.gameControls.flashlight.rechargeBattery(50) - Recharge flashlight");
    console.log("");
    console.log("🔧 Fixed Issues:");
    console.log("✅ Completely rewrote flashlight - now works like a real flashlight");
    console.log("✅ Fixed player sliding when standing still");
    console.log("✅ Fixed W/S movement inversion");
    console.log("✅ Fixed camera-relative movement controls");
    console.log("");
    console.log("🎮 Controls:");
    console.log("- WASD: Move (relative to camera)");
    console.log("- Shift: Run");
    console.log("- Ctrl: Crouch");
    console.log("- Space: Jump");
    console.log("- F: Toggle flashlight");
    console.log("- Mouse: Look around (click to lock cursor)");

    loadingText.textContent = "Ready to play!";
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        document.body.classList.add('game-active'); // Disable glitch effect
        loop.start();
    }, 1000);
}