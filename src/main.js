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
import { createMonster } from './components/Monster/Monster.js';
import { MonsterAI } from './components/Monster/MonsterAI.js';
import { ColorPuzzle } from './puzzles/colorPuzzle/ColorPuzzle.js';
import { WirePuzzle } from './puzzles/wirePuzzle/WirePuzzle.js';
import { PauseMenu } from './systems/PauseMenu.js';
import { AudioManager } from './systems/AudioManager.js';
import logger from './utils/Logger.js'; // Import logger

async function main() {
    try {
        logger.log('噫 Initializing Project HER...');
        logger.log(`📊 Logger initialized - File logging: ${logger.fileLoggingEnabled ? 'ENABLED' : 'DISABLED'}`);
        const canvas = document.querySelector('#game-canvas');

        // --- Initialize Core & UI Systems ---
        const scene = createScene();
        // Camera far plane set to just beyond fog end (25) for better performance
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
        const renderer = createRenderer(canvas);
        const stats = createStats();
        const loop = new Loop(camera, scene, renderer, stats);
        
        const audioManager = new AudioManager(camera); // <-- INITIALIZE AUDIO MANAGER
        const uiManager = new UIManager(audioManager); // <-- PASS TO UI MANAGER
        await uiManager.initialize();

        // --- Initialize Puzzles ---
        const colorPuzzle = new ColorPuzzle();
        await colorPuzzle.loadLevels();
        
        const wirePuzzle = new WirePuzzle();
        await wirePuzzle.loadLevels();
        
        // --- UI Manager loading --- 
        uiManager.showWelcomeScreen(async () => {
            // Load saved quality settings first
            const savedSettings = localStorage.getItem('gameSettings');
            const settings = savedSettings ? JSON.parse(savedSettings) : { quality: 'medium' };

            uiManager.updateLoadingText("Preparing atmosphere...");
            const atmosphere = new SimpleAtmosphere(scene, camera, settings.quality || 'medium');

            uiManager.updateLoadingText("Setting up physics...");
            const physicsManager = new CannonPhysicsManager(camera);

            uiManager.updateLoadingText("Loading mansion model...");
            const mansionLoader = new MansionLoader(scene, physicsManager, settings.quality || 'medium');
            await mansionLoader.loadMansion('/blender/Mansion.glb');
            
            // --- NEW: Load the navigation mesh ---
            uiManager.updateLoadingText("Analyzing walkable areas...");
            await mansionLoader.loadNavMesh(`/blender/NavMesh.glb?v=${Date.now()}`);


            // Set initial camera position (will teleport properly after loop starts)
            const doorSpawnPoint = mansionLoader.getEntranceDoorSpawnPoint();
            let spawnPosition;

            if (doorSpawnPoint) {
                spawnPosition = doorSpawnPoint;
                camera.position.copy(doorSpawnPoint);
                logger.log(`📍 Will spawn at entrance door`);
            } else {
                // Fallback to entrance room
                const entranceRoom = mansionLoader.getEntranceRoom();
                if (entranceRoom) {
                    const spawnY = entranceRoom.bounds.max.y + 2.5;
                    spawnPosition = new THREE.Vector3(entranceRoom.center.x, spawnY, entranceRoom.center.z);
                    camera.position.copy(spawnPosition);
                    logger.log(`📍 Will spawn at entrance: ${entranceRoom.name} at Y=${spawnY.toFixed(2)}`);
                } else {
                    spawnPosition = new THREE.Vector3(0, 10, 5);
                    camera.position.copy(spawnPosition);
                }
            }
            scene.add(camera);

            // --- Initialize Monster ---
            uiManager.updateLoadingText("Waking the beast...");
            const monster = await createMonster('/blender/monster.glb');
            scene.add(monster);

            // --- UPDATED: Pass the pathfinding instance to the AI ---
            const monsterAI = new MonsterAI(monster, camera, mansionLoader.pathfinding, scene);
            monsterAI.spawn();
            // --- Initialize Player Components ---
            uiManager.updateLoadingText("Preparing your escape...");
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle, wirePuzzle }, monsterAI, mansionLoader);
            const flashlight = new ImprovedFlashlight(camera, scene);
            const pauseMenu = new PauseMenu(renderer, controls, loop);
            
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
                atmosphere,
                monsterAI 
            );

            // --- Global Debug ---
           window.gameControls = {
                camera, scene, flashlight, physicsManager, mansionLoader, gameManager,
                interactionSystem, puzzleSystem, atmosphere, colorPuzzle, wirePuzzle,
                audioManager, monsterAI,
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
            
            // Also expose logger and mansionLoader for easy access
            window.game = { mansionLoader, logger };
            logger.log('🔧 Debug controls available in `window.gameControls`.');
            logger.log("庁 To toggle the navigation mesh visualizer, type `gameControls.toggleNavMesh()` in the console.");
            logger.log('');
            logger.log('📝 LOGGING COMMANDS:');
            logger.log('   logger.disable()          - Disable console logging');
            logger.log('   logger.enable()           - Enable console logging');
            logger.log('   logger.downloadLogs()     - Download log file');
            logger.log('   logger.clearBuffer()      - Clear log buffer');
            logger.log('   logger.getStats()         - View logger stats');
            logger.log('');
            logger.log('💡 LIGHTMAP COMMANDS:');
            logger.log('   window.game.mansionLoader.toggleLightmaps()           - Toggle lights on/off');
            logger.log('   window.game.mansionLoader.setLightmapIntensity(5.0)   - Adjust brightness');
            logger.log('   window.game.mansionLoader.showLightmapPreview()       - Show lightmap textures');
            logger.log('   window.game.mansionLoader.debugUVs()                  - Check UV channels');
            logger.log('   window.game.mansionLoader.compareUVChannels()         - Compare UV1 vs UV2');
            logger.log('');

            uiManager.updateLoadingText("Preparing spawn point...");

            // Start the loop but keep loading screen visible
            loop.start();

            // Wait a moment for the loop to start, then teleport
            setTimeout(() => {
                physicsManager.teleportTo(spawnPosition);
                logger.log(`📍 Teleported and stabilizing...`);

                // Wait for physics stabilization to complete (100ms total)
                setTimeout(() => {
                    uiManager.updateLoadingText("Ready to play!");

                    // Small final delay before revealing the game
                    setTimeout(() => {
                        uiManager.hideLoadingScreen();
                        document.body.classList.add('game-active');
                        controls.lock();
                        logger.log('✅ Game ready!');
                    }, 500);
                }, 100);
            }, 50);
        });

    } catch (error) {
        logger.error('圷 A critical error occurred during initialization:', error);
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = `Error: Could not start the game.`;
            loadingText.style.color = 'red';
        }
    }
}

main();

