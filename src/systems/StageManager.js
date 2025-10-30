// src/systems/StageManager.js
// Multi-scene architecture
// Each stage has its own independent scene with own lights/physics
// Switching between scenes is clean and prevents light bleed

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';
import { MansionLoader } from './MansionLoader.js';

export class StageManager {
    constructor(physicsManager, camera, quality = 'medium', loop = null, audioManager = null) {
        this.physicsManager = physicsManager;
        this.camera = camera;
        this.quality = quality;
        this.loop = loop;
        this.audioManager = audioManager;

        // Track scenes per stage
        this.scenes = {
            office: null,
            mansion: null
        };

        this.currentStage = null;
        this.currentScene = null;
        this.currentLoader = null;

        // Track all loaders (one per stage)
        this.loaders = {
            office: null,
            mansion: null
        };

        // Stage definitions
        this.stages = {
            office: {
                name: 'Journalist Office',
                modelPath: 'blender/stage1/stage1.glb',
                navMeshPath: null,
                spawnPoint: { x: 3, y: 1.8, z: 1.2 },
                ambientIntensity: 0.3,
                lightsConfig: {
                    fluorescent: true,
                    lamps: false,
                    fireplaces: false
                },
                physicsExclusions: ['furniture', 'chair', 'desk', 'cabinet', 'file', 'shelf', 'frame']
            },
            mansion: {
                name: 'Haunted Mansion',
                modelPath: 'blender/Mansion.glb',
                navMeshPath: 'blender/NavMesh.glb',
                spawnPoint: null, // Will use entrance door spawn
                ambientIntensity: 0.005,
                lightsConfig: {
                    fluorescent: false,
                    lamps: true,
                    fireplaces: true
                },
                physicsExclusions: ['icosphere']
            }
        };

        logger.log('🎬 StageManager initialized (multi-scene architecture)');
    }

    /**
     * Initialize scenes and load all stages
     * Each stage gets its own independent scene
     */
    async initializeAllStages(onProgress = null) {
        logger.log('🎬 Initializing all stages with separate scenes...');

        // Load mansion stage first
        if (onProgress) onProgress(20, 'Loading mansion...');
        await this._loadStageModel('mansion', onProgress);

        // Load office stage
        if (onProgress) onProgress(50, 'Loading office...');
        await this._loadStageModel('office', onProgress);

        // Set initial stage to office
        this.currentStage = 'office';
        this.currentScene = this.scenes.office;
        this.currentLoader = this.loaders.office;
        if (onProgress) onProgress(95, 'Preparing spawn point...');

        logger.log('✅ All stages loaded with independent scenes');
        return {
            scene: this.scenes.office,
            spawnPosition: this._getSpawnPosition('office')
        };
    }

    /**
     * Create a scene with lighting setup for a stage
     */
    _createStageScene(stageConfig) {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000510);
        // Use exponential fog for proper atmospheric depth (matches working Project2 version)
        scene.fog = new THREE.FogExp2(0x000510, 0.05);

        // Add ambient lighting
        const moonAmbient = new THREE.AmbientLight(0x1a1a2e, stageConfig.ambientIntensity);
        moonAmbient.name = 'moonlight_ambient';
        scene.add(moonAmbient);

        // Add directional light
        const moonLight = new THREE.DirectionalLight(0x5a7fb5, 0.15);
        moonLight.position.set(-20, 50, 30);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        moonLight.shadow.camera.left = -40;
        moonLight.shadow.camera.right = 40;
        moonLight.shadow.camera.top = 40;
        moonLight.shadow.camera.bottom = -40;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 100;
        moonLight.shadow.bias = -0.0001;
        moonLight.shadow.normalBias = 0;
        moonLight.shadow.radius = 1;
        moonLight.name = 'moonlight_directional';
        scene.add(moonLight);

        return scene;
    }

    /**
     * Load a single stage model into its own scene
     */
    async _loadStageModel(stageName, onProgress = null) {
        const stageConfig = this.stages[stageName];
        if (!stageConfig) {
            throw new Error(`Stage "${stageName}" not found`);
        }

        logger.log(`🎬 Loading stage model: ${stageConfig.name}`);

        // Create a fresh scene for this stage
        const stageScene = this._createStageScene(stageConfig);
        this.scenes[stageName] = stageScene;

        // Create loader for this stage (passes its own scene)
        const loader = new MansionLoader(
            stageScene,
            this.physicsManager,
            this.quality
        );

        // Set physics exclusions if defined
        if (stageConfig.physicsExclusions) {
            loader.setPhysicsExclusions(stageConfig.physicsExclusions);
        }

        // Load the model (into its own scene, at origin)
        await loader.loadMansion(stageConfig.modelPath);

        // Load navmesh if available
        if (stageConfig.navMeshPath) {
            if (onProgress) onProgress(60, `Loading ${stageName} pathfinding...`);
            await loader.loadNavMesh(
                `${stageConfig.navMeshPath}?v=${Date.now()}`
            );
        }

        // Validate load
        const isValid = loader.validateStageLoaded();
        if (!isValid) {
            logger.error(`❌ Stage validation failed for ${stageName}`);
        }

        this.loaders[stageName] = loader;
        logger.log(`✅ ${stageConfig.name} loaded in independent scene`);
    }

    /**
     * Get spawn position for a stage
     * No offset needed - models load at origin in their own scenes
     */
    _getSpawnPosition(stageName) {
        const stageConfig = this.stages[stageName];
        const loader = this.loaders[stageName];

        let spawnPosition;

        if (stageName === 'mansion' && loader) {
            // Use entrance door spawn for mansion
            const doorSpawnPoint = loader.getEntranceDoorSpawnPoint();
            if (doorSpawnPoint) {
                spawnPosition = doorSpawnPoint;
            } else {
                const entranceRoom = loader.getEntranceRoom();
                if (entranceRoom) {
                    spawnPosition = {
                        x: entranceRoom.center.x,
                        y: entranceRoom.bounds.max.y + 2.5,
                        z: entranceRoom.center.z
                    };
                } else {
                    spawnPosition = { x: 0, y: 2.5, z: 0 };
                }
            }
        } else {
            // Use configured spawn point for other stages
            spawnPosition = { ...stageConfig.spawnPoint };
        }

        return spawnPosition;
    }

    /**
     * Switch to a different stage (instant transition via scene swap + physics swap)
     */
    async switchToStage(newStageName) {
        const stageConfig = this.stages[newStageName];
        if (!stageConfig) {
            throw new Error(`Stage "${newStageName}" not found`);
        }

        logger.log(`🎬 Switching to stage: ${stageConfig.name}`);

        // Deactivate physics for the current stage (remove from world)
        if (this.currentLoader && this.currentLoader.deactivatePhysics) {
            this.currentLoader.deactivatePhysics();
        }

        // Switch scene and loader
        this.currentStage = newStageName;
        this.currentScene = this.scenes[newStageName];
        this.currentLoader = this.loaders[newStageName];

        // Activate physics for the new stage (add to world)
        if (this.currentLoader && this.currentLoader.activatePhysics) {
            this.currentLoader.activatePhysics();
        }

        logger.log(`🎨 Switched rendering to ${newStageName} scene`);

        // Teleport player to new stage spawn
        const spawnPosition = this._getSpawnPosition(newStageName);
        if (this.physicsManager && this.physicsManager.teleportTo) {
            this.physicsManager.teleportTo(spawnPosition);
        }

        // Update camera position
        this.camera.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

        logger.log(`✅ Switched to ${stageConfig.name} at position ${JSON.stringify(spawnPosition)}`);

        return {
            loader: this.currentLoader,
            spawnPosition: spawnPosition,
            config: stageConfig,
            scene: this.currentScene
        };
    }

    /**
     * Get the current active scene
     */
    getCurrentScene() {
        return this.currentScene;
    }

    /**
     * Note: Lighting and fog setup is now per-scene in _createStageScene()
     * No dynamic updates needed since each scene is independent
     */

    /**
     * Get current stage info
     */
    getCurrentStageInfo() {
        if (!this.currentStage) return null;

        return {
            name: this.currentStage,
            config: this.stages[this.currentStage],
            loader: this.currentLoader,
            offset: this.stages[this.currentStage].worldOffset
        };
    }

    /**
     * Get available stages
     */
    getAvailableStages() {
        return Object.keys(this.stages);
    }

    /**
     * Get the shared scene
     */
    getScene() {
        return this.scene;
    }
}
