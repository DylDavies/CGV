// src/main.js - Refactored and Integrated Version

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import Core Systems
import { createScene } from './components/World/scene.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { UIManager } from './systems/uiManager.js';
import { CannonPhysicsManager } from './systems/CannonPhysicsManager.js';

// Import Game Logic Systems
import { ProceduralMansion } from './systems/ProceduralMansion.js';
import { GameManager } from './systems/GameManager.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { PuzzleSystem } from './systems/PuzzleSystem.js';
import { HorrorAtmosphere } from './systems/HorrorAtmosphere.js';

// Import Player Components
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { ImprovedFlashlight } from './components/Player/ImprovedFlashlight.js';

// import puzzles
import { ColorPuzzle } from './puzzles/colorPuzzle/ColorPuzzle.js';

async function main() {
    try {
        console.log('🚀 Initializing Project HER...');
        const canvas = document.querySelector('#game-canvas');

        // --- 1. Initialize Core & UI Systems ---
        const scene = createScene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = createRenderer(canvas);
        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);
        
        const uiManager = new UIManager();
        await uiManager.initialize();

        // create and load puzzle for colorPuzzle - can remove later for optimization and only load stuff when needed
        const colorPuzzle = new ColorPuzzle();
        await colorPuzzle.loadLevels();
        
        // --- 2. Show Welcome Screen & Wait for Player to Start ---
        uiManager.showWelcomeScreen(async () => {
            // --- 3. Initialize Game World & Physics ---
            uiManager.updateLoadingText("Waking the spirits...");
            const horrorAtmosphere = new HorrorAtmosphere(scene, camera);
            
            uiManager.updateLoadingText("Setting up physics...");
            const physicsManager = new CannonPhysicsManager(camera);
            
            uiManager.updateLoadingText("Generating mansion...");
            const mansion = new ProceduralMansion(scene, physicsManager);
            mansion.generateMansion();

            const entranceRoom = mansion.rooms.find(room => room.type === 'entrance');
            if (entranceRoom) {
                const spawnY = (entranceRoom.baseHeight || 0) + 1.8;
                const spawnPos = new THREE.Vector3(entranceRoom.center.x, spawnY, entranceRoom.center.z + 3);
                camera.position.copy(spawnPos);
                physicsManager.teleportTo(spawnPos);
            }
            scene.add(camera);

            // --- 4. Initialize Player Components ---
            uiManager.updateLoadingText("Preparing your escape...");
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle });
            const flashlight = new ImprovedFlashlight(camera, scene);
            
            // --- 5. Initialize Game Logic & Puzzle Systems ---
            const gameManager = new GameManager(mansion, camera, scene, uiManager);
            const puzzleSystem = new PuzzleSystem(scene, gameManager);
            const interactionSystem = new InteractionSystem(camera, scene, gameManager, uiManager);
            
            controls.puzzles = { colorPuzzle };
            colorPuzzle.setControls(controls);
            puzzleSystem.registerPuzzle('colorPuzzle', colorPuzzle);

            // --- 6. Final Setup & Start Loop ---
            new Resizer(camera, renderer);
            loop.updatables.push(
                controls, 
                physicsManager, 
                flashlight, 
                mansion, 
                interactionSystem, 
                puzzleSystem, 
                gameManager,
                horrorAtmosphere
            );

            // --- Global Debug ---
            window.gameControls = {
                camera, scene, flashlight, physicsManager, mansion, gameManager,
                interactionSystem, puzzleSystem, horrorAtmosphere, colorPuzzle
            };
            console.log('🔧 Debug controls available in `window.gameControls`.');

            uiManager.updateLoadingText("Ready to play!");
            setTimeout(() => {
                uiManager.hideLoadingScreen();
                document.body.classList.add('game-active');
                loop.start();
                controls.lock();
            }, 1000);
        });

    } catch (error) {
        console.error('🚨 A critical error occurred during initialization:', error);
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = `Error: Could not start the game.`;
            loadingText.style.color = 'red';
        }
    }
}

main();