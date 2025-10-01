// src/main.js - Refactored and Integrated Version

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { createScene } from './components/World/scene.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { UIManager } from './systems/uiManager.js';
import { CannonPhysicsManager } from './systems/CannonPhysicsManager.js';
// --- REMOVE THE OLD MANSION ---
// import { ProceduralMansion } from './systems/ProceduralMansion.js'; 
// --- IMPORT THE NEW MANSION ---
import { Mansion } from './systems/Mansion.js';
import { GameManager } from './systems/GameManager.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { PuzzleSystem } from './systems/PuzzleSystem.js';
import { HorrorAtmosphere } from './systems/HorrorAtmosphere.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { ImprovedFlashlight } from './components/Player/ImprovedFlashlight.js';
import { ColorPuzzle } from './puzzles/colorPuzzle/ColorPuzzle.js';
import CannonDebugger from 'https://cdn.skypack.dev/cannon-es-debugger';

async function main() {
    try {
        console.log('🚀 Initializing Project HER...');
        const canvas = document.querySelector('#game-canvas');

        // --- Initialize Core & UI Systems ---
        const scene = createScene();

         // --- ADD THESE DEBUG LIGHTS BACK IN ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Bright white light
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Bright sun-like light
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);
        
        console.log('✅ Added strong debug lights to the scene.');
        // --- END OF NEW CODE ---

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = createRenderer(canvas);
        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);
        
        const uiManager = new UIManager();
        await uiManager.initialize();

        // create and load puzzle for colorPuzzle - can remove later for optimization and only load stuff when needed
        const colorPuzzle = new ColorPuzzle();
        await colorPuzzle.loadLevels();
        
        // --- UI Manager loading --- 
        // show welcome screen
        uiManager.showWelcomeScreen(async () => {
            uiManager.updateLoadingText("Waking the spirits...");
            const horrorAtmosphere = new HorrorAtmosphere(scene, camera);
            
            uiManager.updateLoadingText("Setting up physics...");
            const physicsManager = new CannonPhysicsManager(camera);
            const cannonDebugger = new CannonDebugger(scene, physicsManager.world);

            // --- REPLACE PROCEDURAL MANSION WITH YOUR MODEL ---
            uiManager.updateLoadingText("Constructing the house...");
            const mansion = new Mansion(scene, physicsManager); // Use the new Mansion class
            await mansion.load(); // Load the .glb model

            // Find the entrance for spawning the player
            const entranceRoom = mansion.rooms.find(room => room.type === 'entrance');

            if (entranceRoom) {
                // // Use the spawn position defined in your new Mansion class
                // const spawnPos = entranceRoom.center;
                // camera.position.copy(spawnPos);
                // physicsManager.teleportTo(spawnPos);

                // --- TEMPORARILY REPLACE THE SPAWN LOGIC WITH THIS ---
                const spawnPos = new THREE.Vector3(0, 15, 0); // Elevated but closer
                camera.position.copy(spawnPos);
                camera.lookAt(0, 0, 0); // Make sure camera is looking at the model
                physicsManager.teleportTo(spawnPos);
                // --- END OF TEMPORARY CODE ---
            } else {
                // Fallback spawn position if no entrance is defined
                //const fallbackSpawn = new THREE.Vector3(0, 1.8, 5);
                //camera.position.copy(fallbackSpawn);
                //physicsManager.teleportTo(fallbackSpawn);
                //console.warn("No 'entrance' room found in Mansion.js. Using fallback spawn position.");
                const spawnPos = new THREE.Vector3(0, 50, 15); // Move camera high up and back
                camera.position.copy(spawnPos);
                physicsManager.teleportTo(spawnPos);
            
            }

            scene.add(camera);

            // --- Initialize Player Components ---
            uiManager.updateLoadingText("Preparing your escape...");
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle });
            const flashlight = new ImprovedFlashlight(camera, scene);
            
            // --- Initialize Game Logic & Puzzle Systems ---
            // The GameManager will now use the room data from your new Mansion class
            const gameManager = new GameManager(mansion, camera, scene);
            const puzzleSystem = new PuzzleSystem(scene, gameManager);
            const interactionSystem = new InteractionSystem(camera, scene, gameManager, uiManager);
            
            controls.puzzles = { colorPuzzle };
            colorPuzzle.setControls(controls);
            puzzleSystem.registerPuzzle('colorPuzzle', colorPuzzle);

            // --- Final Setup & Start Loop ---
            new Resizer(camera, renderer);
            loop.updatables.push(
                controls, 
                physicsManager, 
                flashlight, 
                mansion, // Add the new mansion to the update loop
                interactionSystem, 
                puzzleSystem, 
                gameManager,
                horrorAtmosphere,
                 { tick: () => cannonDebugger.update() } 
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