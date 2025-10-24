// src/main.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
// ... (all your other imports are correct)
import { createScene } from './components/World/scene.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { UIManager } from './systems/uiManager.js';
import { RapierPhysicsManager } from './systems/RapierPhysicsManager.js';
import { MansionLoader } from './systems/MansionLoader.js';
import { StageManager } from './systems/StageManager.js';
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
import { KeypadPuzzle } from './puzzles/keypadPuzzle/KeypadPuzzle.js';
import { PauseMenu } from './systems/PauseMenu.js';
import { AudioManager } from './systems/AudioManager.js';
import { Minimap } from './systems/Minimap.js';
import { NarrativeManager } from './systems/NarrativeManager.js';
import { Stage1Manager } from './systems/Stage1Manager.js';
import logger from './utils/Logger.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';


async function main() {
    try {
        logger.log('噫 Initializing Project HER...');
        await RAPIER.init();
        logger.log(`📊 Logger initialized - File logging: ${logger.fileLoggingEnabled ? 'ENABLED' : 'DISABLED'}`);

        const canvas = document.querySelector('#game-canvas');

        // --- Initialize Core Systems that EXIST OUTSIDE the loading screen ---
        const scene = createScene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
        const renderer = createRenderer(canvas);
        const stats = createStats();
        // We will now declare 'loop' here but define it INSIDE the callback.
        let loop;

        const audioManager = new AudioManager(camera);
        const uiManager = new UIManager(audioManager);
        await uiManager.initialize();

        const colorPuzzle = new ColorPuzzle();
        await colorPuzzle.loadLevels();

        const wirePuzzle = new WirePuzzle();
        await wirePuzzle.loadLevels();

        const keypadPuzzle = new KeypadPuzzle(uiManager);


        // --- UI Manager loading ---
        uiManager.showWelcomeScreen(async () => {

            const savedSettings = localStorage.getItem('gameSettings');
            const settings = savedSettings ? JSON.parse(savedSettings) : { quality: 'medium' };

            uiManager.showLoadingScreen();
            uiManager.updateLoadingProgress(10, "Preparing atmosphere...");
            const atmosphere = new SimpleAtmosphere(scene, camera, settings.quality || 'medium');

            uiManager.updateLoadingProgress(25, "Setting up physics...");
            // Create the physics manager first
            const physicsManager = new RapierPhysicsManager(scene, camera, null);

            // --- START: THE FIX ---
            // Now that physicsManager exists, we can create the loop and pass the labelRenderer.
            loop = new Loop(camera, scene, renderer, stats, physicsManager.labelRenderer);
            // --- END: THE FIX ---

            // Create StageManager to handle different game stages (pass loop and audioManager for safe transitions)
            const stageManager = new StageManager(scene, physicsManager, camera, settings.quality || 'medium', loop, audioManager);

            // Create NarrativeManager with StageManager support
            const narrativeManager = new NarrativeManager(stageManager);
            await narrativeManager.loadNarrative('public/narrative/narrative.json');

            // Snapshot persistent objects (lights, camera) before loading stage
            stageManager.snapshotPersistentObjects();

            // Load initial stage (office/Stage1)
            uiManager.updateLoadingProgress(40, "Loading initial stage...");
            const stageData = await stageManager.loadStage('office', (progress, message) => {
                uiManager.updateLoadingProgress(progress, message);
            });

            const mansionLoader = stageData.loader;
            const spawnPosition = stageData.spawnPosition;

            scene.add(camera);

            uiManager.updateLoadingProgress(75, "Preparing the experience...");
            const monster = await createMonster('blender/monster.glb');
            scene.add(monster);

            const monsterAI = new MonsterAI(monster, camera, mansionLoader.pathfinding, scene, audioManager);
            monster.visible = false;

            uiManager.updateLoadingProgress(85, "Preparing your escape...");
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle, wirePuzzle, keypadPuzzle }, monsterAI, mansionLoader);
            uiManager.setControls(controls);
            const flashlight = new ImprovedFlashlight(camera, scene, stageManager);
            // Pass the loop to the PauseMenu
            const pauseMenu = new PauseMenu(renderer, controls, loop);

            const gameManager = new GameManager(mansionLoader, camera, scene, uiManager, audioManager, controls, stageManager);
            const puzzleSystem = new PuzzleSystem(scene, gameManager);
            const interactionSystem = new InteractionSystem(camera, scene, gameManager, uiManager, controls);

            controls.puzzles = { colorPuzzle, wirePuzzle, keypadPuzzle };
            colorPuzzle.setControls(controls);
            wirePuzzle.setControls(controls);
            keypadPuzzle.setControls(controls);

            puzzleSystem.registerPuzzle('colorPuzzle', colorPuzzle);
            puzzleSystem.registerPuzzle('wirePuzzle', wirePuzzle);
            puzzleSystem.registerPuzzle('keypadPuzzle', keypadPuzzle);

            uiManager.updateLoadingText("Creating minimap...");
            const minimap = new Minimap(scene, camera, mansionLoader, renderer);

            uiManager.updateLoadingText("Setting up Stage 1 puzzles...");
            const stage1Manager = new Stage1Manager(scene, gameManager, mansionLoader, uiManager, audioManager, interactionSystem);

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
                monsterAI,
                minimap,
                stage1Manager
            );

            window.gameControls = {
                camera, scene, flashlight, physicsManager, mansionLoader, gameManager,
                interactionSystem, puzzleSystem, atmosphere, colorPuzzle, wirePuzzle, keypadPuzzle,
                audioManager, monsterAI, narrativeManager, uiManager, minimap, stageManager, stage1Manager,
                toggleNavMesh: () => mansionLoader.toggleNavMeshVisualizer(),
                toggleMansion: () => mansionLoader.toggleMansionVisibility(),
                toggleNavMeshNodes: () => mansionLoader.toggleNavMeshNodesVisualizer(),
                toggleMinimap: () => minimap.toggle(),
                listPhysics: () => mansionLoader.listPhysicsBodies(),
            };

            window.game = { mansionLoader, logger };
            logger.log('🔧 Debug controls available in `window.gameControls`.');
            logger.log("庁 To toggle the navigation mesh visualizer, type `gameControls.toggleNavMesh()` in the console.");
            logger.log("🎬 To transition to office stage, type `gameControls.stageManager.transitionToStage('office')` in the console.");
            logger.log('');
            logger.log('📝 LOGGING COMMANDS:');
            logger.log('   logger.disable()       - Disable console logging');
            logger.log('   logger.enable()        - Enable console logging');
            logger.log('   logger.downloadLogs()  - Download log file');
            logger.log('   logger.clearBuffer()   - Clear log buffer');
            logger.log('   logger.getStats()      - View logger stats');
            logger.log('');

            uiManager.updateLoadingProgress(95, "Preparing spawn point...");

            loop.start();

            setTimeout(() => {
                physicsManager.teleportTo(spawnPosition);
                logger.log(`📍 Teleported and stabilizing...`);
                setTimeout(() => {
                    uiManager.updateLoadingProgress(100, "Ready to play!");
                    setTimeout(async () => {
                        uiManager.hideLoadingScreen();
                        document.body.classList.add('game-active');
                        await gameManager.showStage1Title(); // Show Stage 1 title

                        // Start stage-specific gameplay
                        if (stageManager.currentStage === 'office') {
                            // Start Stage 1 puzzle sequence
                            stage1Manager.setupMissingPersonsFile();
                            stage1Manager.startStage1();
                        } else if (stageManager.currentStage === 'mansion') {
                            // Play intro narrative sequence on mansion stage
                            await narrativeManager.playIntroSequence();
                        }
                        console.log('✅ Game ready! Click to begin.');
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