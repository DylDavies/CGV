// src/main.js - Refactored and Integrated Version

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import { createScene } from './components/World/scene.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { UIManager } from './systems/uiManager.js';
import { CannonPhysicsManager } from './systems/CannonPhysicsManager.js';
import { MansionLoader } from './systems/MansionLoader.js';
import { GameManager } from './systems/GameManager.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { PuzzleSystem } from './systems/PuzzleSystem.js';
import { SimpleAtmosphere } from './systems/SimpleAtmosphere.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { ImprovedFlashlight } from './components/Player/ImprovedFlashlight.js';
import { createMonster } from './components/Monster/Monster.js';
import { MonsterAI } from './components/Monster/MonsterAI.js';
import { ColorPuzzle } from './puzzles/colorPuzzle/ColorPuzzle.js';
import { PauseMenu } from './systems/PauseMenu.js';

async function main() {
    try {
        console.log('噫 Initializing Project HER...');
        const canvas = document.querySelector('#game-canvas');

        // --- Initialize Core & UI Systems ---
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
        
        // --- UI Manager loading --- 
        // show welcome screen
        uiManager.showWelcomeScreen(async () => {
            uiManager.updateLoadingText("Preparing atmosphere...");
            const atmosphere = new SimpleAtmosphere(scene, camera);
            
            uiManager.updateLoadingText("Setting up physics...");
            const physicsManager = new CannonPhysicsManager(camera);

            uiManager.updateLoadingText("Loading mansion model...");
            const mansionLoader = new MansionLoader(scene, physicsManager);
            await mansionLoader.loadMansion('/blender/Mansion.glb');
            
            // --- NEW: Load the navigation mesh ---
            uiManager.updateLoadingText("Analyzing walkable areas...");
            await mansionLoader.loadNavMesh(`/blender/NavMesh.glb?v=${Date.now()}`);


            // Find entrance room and spawn player
            const entranceRoom = mansionLoader.getEntranceRoom();
            
            if (entranceRoom && isFinite(entranceRoom.center.x)) {
                const spawnY = 4; 
                const spawnPos = new THREE.Vector3(entranceRoom.center.x, spawnY, entranceRoom.center.z);
                camera.position.copy(spawnPos);
                physicsManager.teleportTo(spawnPos);
                console.log(`桃 Spawned at entrance: ${entranceRoom.name} at Y=${spawnY.toFixed(2)}`);
            } else {
                console.warn("Could not find a valid entrance room. Using default spawn position.");
                camera.position.set(0, 10, 5);
                physicsManager.teleportTo(new THREE.Vector3(0, 10, 5));
            }
            scene.add(camera);

            // --- Initialize Monster ---
            uiManager.updateLoadingText("Waking the beast...");
            const monster = createMonster();
            scene.add(monster);

            // --- UPDATED: Pass the pathfinding instance to the AI ---
            const monsterAI = new MonsterAI(monster, camera, mansionLoader.pathfinding, scene);
            monsterAI.spawn();
            // --- Initialize Player Components ---
            uiManager.updateLoadingText("Preparing your escape...");
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle });
            const flashlight = new ImprovedFlashlight(camera, scene);
            const pauseMenu = new PauseMenu(renderer, controls);
            
            // --- Initialize Game Logic & Puzzle Systems ---
            const gameManager = new GameManager(mansionLoader, camera, scene, uiManager);
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
                mansionLoader,
                interactionSystem,
                puzzleSystem,
                gameManager,
                atmosphere,
                monsterAI 
            );

            // --- Global Debug ---
           window.gameControls = {
                camera, scene, flashlight, physicsManager, mansionLoader, gameManager,
                interactionSystem, puzzleSystem, atmosphere, colorPuzzle, monsterAI,
                toggleNavMesh: () => {
                    mansionLoader.toggleNavMeshVisualizer();
                },
                toggleMansion: () => {
                    mansionLoader.toggleMansionVisibility();
                },
                toggleNavMeshNodes: () => {
                    mansionLoader.toggleNavMeshNodesVisualizer();
                }
            };
            console.log('肌 Debug controls available in `window.gameControls`.');
            console.log("庁 To toggle the navigation mesh visualizer, type `gameControls.toggleNavMesh()` in the console.");


            uiManager.updateLoadingText("Ready to play!");
            setTimeout(() => {
                uiManager.hideLoadingScreen();
                document.body.classList.add('game-active');
                loop.start();
                controls.lock();
            }, 1000);
        });

    } catch (error) {
        console.error('圷 A critical error occurred during initialization:', error);
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = `Error: Could not start the game.`;
            loadingText.style.color = 'red';
        }
    }
}

main();

