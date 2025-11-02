// src/main.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { createScene } from './components/World/scene.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { UIManager } from './systems/uiManager.js';
import { RapierPhysicsManager } from './systems/RapierPhysicsManager.js';
import { createRenderer } from './systems/Renderer.js';
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
import { TicTacToePuzzle } from './puzzles/ticTacToePuzzle/TicTacToePuzzle.js';
import { PauseMenu } from './systems/PauseMenu.js';
import { AudioManager } from './systems/AudioManager.js';
import { Minimap } from './systems/Minimap.js';
import { NarrativeManager } from './systems/NarrativeManager.js';
import logger from './utils/Logger.js';
import { PerformanceAnalyzer } from './utils/PerformanceAnalyzer.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { QTEManager } from './systems/QTEManager.js';
import { CarInteraction } from './systems/CarInteraction.js';
import { GarageSystem } from './systems/GarageSystem.js';
import { CarRepairSystem } from './systems/CarRepairSystem.js';

console.log = (...args) => {}
async function main() {
    try {
        logger.log(' Initializing Project HER...');
        await RAPIER.init();
        logger.log(`📊 Logger initialized - File logging: ${logger.fileLoggingEnabled ? 'ENABLED' : 'DISABLED'}`);
        
        const canvas = document.querySelector('#game-canvas');

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);

        const renderer = createRenderer(canvas);
        renderer.setSize(window.innerWidth, window.innerHeight);

        const stats = createStats();
        // We will now declare 'loop' here but define it INSIDE the callback.
        let loop;
        // We will declare scene inside the callback since each stage has its own scene
        let scene;

        const audioManager = new AudioManager(camera);
        const uiManager = new UIManager(audioManager);
        await uiManager.initialize();

        const colorPuzzle = new ColorPuzzle();
        await colorPuzzle.loadLevels();
        const wirePuzzle = new WirePuzzle();
        await wirePuzzle.loadLevels();
        const keypadPuzzle = new KeypadPuzzle(uiManager);

        const ticTacToePuzzle = new TicTacToePuzzle();

        uiManager.showWelcomeScreen(async () => {

            const savedSettings = localStorage.getItem('gameSettings');
            const settings = savedSettings ? JSON.parse(savedSettings) : { quality: 'medium' };

            uiManager.showLoadingScreen();
            uiManager.updateLoadingProgress(10, "Preparing physics...");

            // Create physics manager (shared across all scenes)
            const physicsManager = new RapierPhysicsManager(null, camera, null);

            // Initialize StageManager with proper multi-scene architecture
            const stageManager = new StageManager(physicsManager, camera, settings.quality || 'medium', null, audioManager, renderer);

            // Load all stages (mansion and office)
            const initResult = await stageManager.initializeAllStages((progress, message) => {
                uiManager.updateLoadingProgress(progress, message);
            });

            scene = initResult.scene;
            const spawnPosition = initResult.spawnPosition;

            // Initialize physics with the current scene
            physicsManager.initializeScene(scene);

            // Create atmosphere for the shared scene
            const atmosphere = new SimpleAtmosphere(scene, camera, settings.quality || 'medium');

            // Create the game loop (with multi-scene support via stageManager)
            loop = new Loop(camera, scene, renderer, stats, physicsManager.labelRenderer, stageManager);
            stageManager.loop = loop; // Connect loop to stage manager

            // Create NarrativeManager with StageManager support
            const narrativeManager = new NarrativeManager(stageManager);
            await narrativeManager.loadNarrative('public/narrative/narrative.json');

            logger.log('📍 All stages loaded and ready');

            // Note: Camera is not added to scenes - it's used for rendering independently
            // scene.add(camera); // Removed - not needed in Three.js

            uiManager.updateLoadingProgress(75, "Preparing the experience...");
            const monster = await createMonster('blender/monster.glb');
            // Add monster to the mansion scene only (not office)
            stageManager.scenes.mansion.add(monster);

            const monsterAI = new MonsterAI(monster, camera, stageManager.loaders.mansion.pathfinding, stageManager.scenes.mansion, audioManager);
            monster.visible = false;

            uiManager.updateLoadingProgress(85, "Preparing your escape...");
            const controls = new FirstPersonControls(camera, renderer, physicsManager, { colorPuzzle, wirePuzzle, keypadPuzzle, ticTacToePuzzle }, monsterAI, stageManager.currentLoader, audioManager);
            uiManager.setControls(controls);
            const flashlight = new ImprovedFlashlight(camera, scene, stageManager);
            // Pass the renderer to PauseMenu
            const pauseMenu = new PauseMenu(renderer, controls, loop);
            const qteManager = new QTEManager(uiManager, controls);
            controls.setQTEManager(qteManager);

            const gameManager = new GameManager(stageManager.currentLoader, camera, scene, uiManager, audioManager, controls, stageManager, physicsManager);
            const puzzleSystem = new PuzzleSystem(scene, gameManager);
            const interactionSystem = new InteractionSystem(camera, scene, gameManager, uiManager, controls, audioManager, stageManager);

            controls.puzzles = { colorPuzzle, wirePuzzle, keypadPuzzle, ticTacToePuzzle };
            colorPuzzle.setControls(controls);
            wirePuzzle.setControls(controls);
            keypadPuzzle.setControls(controls);
            ticTacToePuzzle.setControls(controls);

            puzzleSystem.registerPuzzle('colorPuzzle', colorPuzzle);
            puzzleSystem.registerPuzzle('wirePuzzle', wirePuzzle);
            puzzleSystem.registerPuzzle('keypadPuzzle', keypadPuzzle);
            puzzleSystem.registerPuzzle('ticTacToePuzzle', ticTacToePuzzle);

            uiManager.updateLoadingText("Creating minimap...");
            const minimap = new Minimap(scene, camera, stageManager, renderer);

            uiManager.updateLoadingText("Checking vehicle systems...");
            const carInteraction = new CarInteraction(scene, interactionSystem, audioManager, gameManager);
  
            // car collection
            carInteraction.initializeCar(stageManager.scenes.mansion, 'car');

            const garageSystem = new GarageSystem(
                interactionSystem,
                qteManager,
                audioManager,
                gameManager,
                stageManager,
                stageManager.loaders.mansion, // mansionLoader for physics bodies access
                physicsManager // physicsManager for removing bodies
            );

            
            const carRepairSystem = new CarRepairSystem(
                stageManager,
                interactionSystem,
                qteManager,
                audioManager,
                gameManager,
                narrativeManager, // Pass NarrativeManager
                carInteraction,   // Pass CarInteraction instance
                physicsManager,   // Pass PhysicsManager for player teleport
                camera,           // Pass Camera for escape sequence
                controls,         // Pass PlayerControls for freezing during drive
                garageSystem      // Pass GarageSystem to check door state
            );

            new Resizer(camera, renderer);

            // Initialize Performance Analyzer
            const performanceAnalyzer = new PerformanceAnalyzer(renderer, scene);

            // Filter out null updatables (for diagnostic single-scene mode)
            const updatables = [
                controls,
                physicsManager,
                flashlight,
                stageManager.loaders.office,
                stageManager.loaders.mansion,
                interactionSystem,
                puzzleSystem,
                gameManager,
                atmosphere,
                monsterAI,
                minimap,
                garageSystem // Add garageSystem to call tick() for gate lifting
            ].filter(u => u !== null && u !== undefined);

            loop.updatables.push(...updatables);

            window.gameControls = {
                camera, scene, flashlight, physicsManager, gameManager,
                interactionSystem, puzzleSystem, atmosphere, colorPuzzle, wirePuzzle, keypadPuzzle, ticTacToePuzzle,
                audioManager, monsterAI, narrativeManager, uiManager, minimap, stageManager,
                carInteraction, qteManager, garageSystem, carRepairSystem,
                // Always get current loader from stageManager, not cached reference
                get mansionLoader() { return stageManager.currentLoader; },
                // Stage transition commands
                toMansion: async () => {
                    console.log('🚀 Transitioning to mansion...');
                    await stageManager.switchToStage('mansion');
                    await uiManager.reloadResultScreen();
                    console.log('Arrived at mansion');
                },
                toOffice: async () => {
                    console.log('🚀 Transitioning to office...');
                    await stageManager.switchToStage('office');
                    await uiManager.reloadResultScreen();
                    console.log('Arrived at office');
                },
                toggleNavMesh: () => stageManager.currentLoader?.toggleNavMeshVisualizer?.(),
                toggleMansion: () => stageManager.currentLoader?.toggleMansionVisibility?.(),
                toggleNavMeshNodes: () => stageManager.currentLoader?.toggleNavMeshNodesVisualizer?.(),
                toggleNavMesh: () => mansionLoader.toggleNavMeshVisualizer(),
                toggleMansion: () => mansionLoader.toggleMansionVisibility(),
                toggleNavMeshNodes: () => mansionLoader.toggleNavMeshNodesVisualizer(),
                toggleMinimap: () => minimap.toggle(),
                spawnMonster: () => {
                    console.log('👾 DEBUG: Spawning monster...');
                    if (monsterAI && monsterAI.monster) {
                        monsterAI.monster.visible = true;
                        monsterAI.spawn();

                        // Start heartbeat if not already started
                        if (!monsterAI.heartbeatStarted && audioManager) {
                            audioManager.playHeartbeat();
                            monsterAI.heartbeatStarted = true;
                        }

                        // Set game to stage 2 if not already
                        if (gameManager.gameStage !== 2) {
                            gameManager.gameStage = 2;
                            console.log('👾 DEBUG: Game stage set to 2');
                        }

                        console.log('👾 DEBUG: Monster spawned successfully');
                        console.log(`   Position: (${monsterAI.monster.position.x.toFixed(2)}, ${monsterAI.monster.position.y.toFixed(2)}, ${monsterAI.monster.position.z.toFixed(2)})`);
                        console.log(`   Aggression level: ${monsterAI.aggressionLevel}`);
                    } else {
                        console.error('Monster AI not available');
                    }
                },
                spawnMonsterAtRandomNode: () => {
                    if (gameManager) {
                        gameManager.spawnMonsterAtRandomNode();
                    } else {
                        console.error('Game Manager not available');
                    }
                },
                listPhysics: () => stageManager.currentLoader?.listPhysicsBodies?.(),
                toggleOcclusionViz: (enabled) => {
                    // Toggle occlusion culling visualization on ALL stages
                    const state = enabled !== undefined ? enabled : !window._occlusionVizEnabled;
                    window._occlusionVizEnabled = state;
                    console.log(`Occlusion Culling Visualization: ${state ? 'ON (all stages)' : 'OFF'}`);
                    if (stageManager.loaders.office) {
                        stageManager.loaders.office.visualizeOcclusionCulling(state);
                    }
                    if (stageManager.loaders.mansion) {
                        stageManager.loaders.mansion.visualizeOcclusionCulling(state);
                    }
                },
                debugOcclusionStats: () => {
                    const loader = stageManager.currentLoader;
                    if (!loader || !loader.model) {
                        console.log('No active loader');
                        return;
                    }

                    let visibleMeshes = 0;
                    let culledMeshes = 0;
                    let totalMeshes = 0;
                    const culledObjects = [];

                    loader.model.traverse((node) => {
                        if (node.isMesh) {
                            totalMeshes++;
                            if (node.visible) {
                                visibleMeshes++;
                            } else {
                                culledMeshes++;
                                culledObjects.push(node.name || 'unnamed');
                            }
                        }
                    });

                    console.log(`Occlusion Stats - Visible: ${visibleMeshes}, Culled: ${culledMeshes}, Total: ${totalMeshes}`);
                    console.log(`Max distance: ${loader.maxVisibleDistance}`);
                    if (culledObjects.length > 0 && culledObjects.length < 20) {
                        console.log(`Culled objects: ${culledObjects.join(', ')}`);
                    }
                },
                debugOcclusionDetail: (objectName) => {
                    const loader = stageManager.currentLoader;
                    if (!loader || !loader.model) {
                        console.log('No active loader');
                        return;
                    }

                    const closestPoint = new THREE.Vector3();
                    const camPos = camera.position;
                    let found = false;

                    loader.model.traverse((node) => {
                        if (objectName && node.name !== objectName) return;
                        if (!node.isMesh || !node.geometry) return;

                        found = true;

                        // Compute bounding box
                        if (!node.geometry.boundingBox) {
                            node.geometry.computeBoundingBox();
                        }

                        const boundingBox = node.geometry.boundingBox.clone();
                        boundingBox.applyMatrix4(node.matrixWorld);
                        boundingBox.clampPoint(camPos, closestPoint);

                        const distance = camPos.distanceTo(closestPoint);

                        // Check parent visibility
                        let parent = node.parent;
                        let parentChain = [];
                        while (parent && parent !== loader.model) {
                            parentChain.push(`${parent.name || 'unnamed'} (visible=${parent.visible})`);
                            parent = parent.parent;
                        }

                        console.log(`Object: ${node.name}`);
                        console.log(`  Visible: ${node.visible}`);
                        console.log(`  Distance: ${distance.toFixed(2)} (max: ${loader.maxVisibleDistance})`);
                        console.log(`  Should be visible: ${distance <= loader.maxVisibleDistance}`);
                        console.log(`  Position: x=${node.position.x.toFixed(1)}, y=${node.position.y.toFixed(1)}, z=${node.position.z.toFixed(1)}`);
                        console.log(`  World pos: x=${node.getWorldPosition(new THREE.Vector3()).x.toFixed(1)}`);
                        console.log(`  Parent chain: ${parentChain.join(' > ') || 'none'}`);
                    });

                    if (!found) {
                        console.log(`Object "${objectName}" not found`);
                    }
                },
                debugValidateStage: () => {
                    if (!stageManager.currentLoader) {
                        console.log('No active stage loader');
                        return;
                    }
                    stageManager.currentLoader.validateStageLoaded();
                },
                // Performance Analysis Commands
                getPerformanceReport: () => {
                    performanceAnalyzer.analyze();
                    performanceAnalyzer.logReport();
                    return performanceAnalyzer.getReport();
                },
                analyzePerformance: () => {
                    performanceAnalyzer.analyze();
                    performanceAnalyzer.logBottlenecks();
                },
                getPerformanceMetrics: () => {
                    performanceAnalyzer.analyze();
                    return performanceAnalyzer.metrics;
                },
            };

            window.game = { logger };  // mansionLoader access via window.gameControls.mansionLoader getter
            logger.log('🔧 Debug controls available in `window.gameControls`.');
            logger.log("庁 To toggle the navigation mesh visualizer, type `gameControls.toggleNavMesh()` in the console.");
            logger.log("🎬 Stage transitions: gameControls.toMansion() or gameControls.toOffice()");
            logger.log('');
            logger.log('👾 MONSTER DEBUG:');
            logger.log('   gameControls.spawnMonster()             - Spawn the monster for testing');
            logger.log('   gameControls.spawnMonsterAtRandomNode() - Spawn monster at random navmesh node');
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
                        canvas.style.visibility = 'visible';
                        document.body.classList.add('game-active');

                        // Start stage-specific gameplay
                        if (stageManager.currentStage === 'office') {
                            // Start Stage 1 (office) narrative sequence
                            // Phone rings automatically after 5 seconds, then auto-answer
                            setTimeout(async () => {
                                if (gameManager.audioManager) {
                                    gameManager.audioManager.play('phone_ringing');
                                }
                            }, 5000);

                            // Auto-answer phone after 8 seconds (phone rings for 3 seconds)
                            setTimeout(async () => {
                                if (gameManager.audioManager) {
                                    gameManager.audioManager.stopSound('phone_ringing');
                                    // Play voicemail audio after phone is answered

                                    // this.audioManager.playSound('couch_sliding', this.audioManager.soundPaths.couch_sliding, true, 0.4);
                                    //await gameManager.audioManager.playSound('voice_mail', this.audioManager.soundPaths.voice_mail, true, 0.9);
                                    await gameManager.audioManager.play('voice_mail');
                                }
                                // Trigger voicemail narrative
                                await window.gameControls.narrativeManager.triggerEvent('office.phone_answered');
                                // Show objective to use computer
                                await window.gameControls.narrativeManager.triggerEvent('office.computer_objective');
                            }, 8000);
                        } else if (stageManager.currentStage === 'mansion') {
                            // Play intro narrative sequence on mansion stage
                            await narrativeManager.playIntroSequence();
                        }
                        console.log('Game ready! Click to begin.');
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

