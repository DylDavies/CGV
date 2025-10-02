import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
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
import { ColorPuzzle } from './puzzles/colorPuzzle/ColorPuzzle.js';
import { WirePuzzle } from './puzzles/wirePuzzle/WirePuzzle.js';
import { PauseMenu } from './systems/PauseMenu.js';

async function main() {
    try {
        console.log('🚀 Initializing Project HER...');
        const canvas = document.querySelector('#game-canvas');

        // --- Initialize Core & UI Systems ---
        const scene = createScene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = createRenderer(canvas);
        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);
        
        const uiManager = new UIManager();
        await uiManager.initialize();

        // --- Initialize Puzzles ---
        const colorPuzzle = new ColorPuzzle();
        await colorPuzzle.loadLevels();
        
        const wirePuzzle = new WirePuzzle();
        await wirePuzzle.loadLevels();
        
        // --- UI Manager loading --- 
        uiManager.showWelcomeScreen(async () => {
            uiManager.updateLoadingText("Preparing atmosphere...");
            const atmosphere = new SimpleAtmosphere(scene, camera);
            
            uiManager.updateLoadingText("Setting up physics...");
            const physicsManager = new CannonPhysicsManager(camera);

            uiManager.updateLoadingText("Loading mansion model...");
            const mansionLoader = new MansionLoader(scene, physicsManager);
            await mansionLoader.loadMansion('/blender/Mansion.glb');

            const entranceRoom = mansionLoader.getEntranceRoom();
            if (entranceRoom) {
                const spawnY = entranceRoom.bounds.max.y + 2.5;
                const spawnPos = new THREE.Vector3(entranceRoom.center.x, spawnY, entranceRoom.center.z);
                camera.position.copy(spawnPos);
                physicsManager.teleportTo(spawnPos);
                console.log(`📍 Spawned at entrance: ${entranceRoom.name} at Y=${spawnY.toFixed(2)}`);
            } else {
                camera.position.set(0, 10, 5);
                physicsManager.teleportTo(new THREE.Vector3(0, 10, 5));
            }
            scene.add(camera);

            // --- Initialize Player Components ---
            uiManager.updateLoadingText("Preparing your escape...");
            // Pass BOTH puzzles to the controls
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle, wirePuzzle });
            const flashlight = new ImprovedFlashlight(camera, scene);
            const pauseMenu = new PauseMenu(renderer, controls);
            
            // --- Initialize Game Logic & Puzzle Systems ---
            const gameManager = new GameManager(mansionLoader, camera, scene, uiManager);
            const puzzleSystem = new PuzzleSystem(scene, gameManager);
            const interactionSystem = new InteractionSystem(camera, scene, gameManager, uiManager);
            
            // Set controls for BOTH puzzles
            controls.puzzles = { colorPuzzle, wirePuzzle };
            colorPuzzle.setControls(controls);
            wirePuzzle.setControls(controls);

            // Register BOTH puzzles
            puzzleSystem.registerPuzzle('colorPuzzle', colorPuzzle);
            puzzleSystem.registerPuzzle('wirePuzzle', wirePuzzle);

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
                atmosphere
            );

            // --- Global Debug ---
            window.gameControls = {
                camera, scene, flashlight, physicsManager, mansionLoader, gameManager,
                interactionSystem, puzzleSystem, atmosphere, colorPuzzle, wirePuzzle
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