// src/main.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
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
import { QTEManager } from './systems/QTEManager.js';
import { CarInteraction } from './systems/CarInteraction.js';
import { GarageSystem } from './systems/GarageSystem.js';
import { CarRepairSystem } from './systems/CarRepairSystem.js';

async function main() {
    try {
        logger.log('噫 Initializing Project HER...');
        await RAPIER.init();
        logger.log(`📊 Logger initialized - File logging: ${logger.fileLoggingEnabled ? 'ENABLED' : 'DISABLED'}`);

        const canvas = document.querySelector('#game-canvas');

        // --- Initialize Core Systems ---
        const scene = createScene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
        const renderer = createRenderer(canvas);
        const stats = createStats();
        let loop; // Declare loop here

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
            const physicsManager = new RapierPhysicsManager(scene, camera, null);

            loop = new Loop(camera, scene, renderer, stats, physicsManager.labelRenderer);

            const stageManager = new StageManager(scene, physicsManager, camera, settings.quality || 'medium', loop, audioManager);
            const narrativeManager = new NarrativeManager(stageManager);
            await narrativeManager.loadNarrative('public/narrative/narrative.json');

            stageManager.snapshotPersistentObjects();

            uiManager.updateLoadingProgress(40, "Loading mansion...");
            // *** Load the mansion stage directly ***
            const stageData = await stageManager.loadStage('mansion', (progress, message) => {
                uiManager.updateLoadingProgress(progress, message);
            });
            const mansionLoader = stageData.loader;
            const spawnPosition = stageData.spawnPosition;
            const loadedMansionModel = mansionLoader.model; // Get reference to the loaded scene graph

            scene.add(camera);

            uiManager.updateLoadingProgress(75, "Preparing the experience...");
            const monster = await createMonster('blender/monster.glb');
            scene.add(monster);
            const monsterAI = new MonsterAI(monster, camera, mansionLoader.pathfinding, scene, audioManager);
            monster.visible = false;

            uiManager.updateLoadingProgress(85, "Preparing controls...");
            const controls = new FirstPersonControls(camera, renderer.domElement, physicsManager, { colorPuzzle, wirePuzzle, keypadPuzzle }, monsterAI, mansionLoader);
            uiManager.setControls(controls);
            const flashlight = new ImprovedFlashlight(camera, scene, stageManager);
            const pauseMenu = new PauseMenu(renderer, controls, loop);
            const qteManager = new QTEManager(uiManager, controls);
            controls.setQTEManager(qteManager);

            const gameManager = new GameManager(mansionLoader, camera, scene, uiManager, audioManager, controls, stageManager, physicsManager);
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

            uiManager.updateLoadingText("Setting up office puzzles..."); // Keep log generic if stage1Manager isn't used much
            const stage1Manager = new Stage1Manager(scene, gameManager, mansionLoader, uiManager, audioManager, interactionSystem);

            // --- Initialize CarInteraction AFTER mansion is loaded ---
            uiManager.updateLoadingText("Checking vehicle systems...");
            const carInteraction = new CarInteraction(scene, interactionSystem, audioManager, gameManager);
  
            // car collection
            carInteraction.initializeCar(loadedMansionModel, 'car');

            const garageSystem = new GarageSystem(
                scene,
                interactionSystem,
                qteManager,
                audioManager,
                gameManager,
                mansionLoader 
            );

            // --- Initialize CarRepairSystem AFTER CarInteraction and other dependencies ---
            const carRepairSystem = new CarRepairSystem(
                scene,
                interactionSystem,
                qteManager,
                audioManager,
                gameManager,
                narrativeManager, // Pass NarrativeManager
                carInteraction    // Pass CarInteraction instance
            );

            // Call initialize AFTER the scene graph (loadedMansionModel) is fully processed
            carRepairSystem.initialize();

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
                stage1Manager,
            );

            // --- Setup gameControls for debugging ---
            window.gameControls = {
                camera, scene, flashlight, physicsManager, mansionLoader, gameManager,
                interactionSystem, puzzleSystem, atmosphere, colorPuzzle, wirePuzzle, keypadPuzzle,
                audioManager, monsterAI, narrativeManager, uiManager, minimap, stageManager, stage1Manager,
                carInteraction,
                toggleNavMesh: () => mansionLoader.toggleNavMeshVisualizer(),
                toggleMansion: () => mansionLoader.toggleMansionVisibility(),
                toggleNavMeshNodes: () => mansionLoader.toggleNavMeshNodesVisualizer(),
                toggleMinimap: () => minimap.toggle(),
                qteManager,
                carInteraction,
                garageSystem, 
                carRepairSystem,
                testQTE: (type) => { /* ... testQTE function ... */ },
                listPhysics: () => mansionLoader.listPhysicsBodies(),
            };

            window.game = { mansionLoader, logger };
            logger.log('🔧 Debug controls available in `window.gameControls`.');
            // ... other logger messages ...

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
                        // await gameManager.showStage1Title(); // Comment out if starting directly in mansion

                        // Play intro narrative sequence on mansion stage
                        await narrativeManager.playIntroSequence();

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

