// src/systems/StageManager.js
// Manages different physical stages/locations in the game

import logger from '../utils/Logger.js';
import { MansionLoader } from './MansionLoader.js';

export class StageManager {
    constructor(scene, physicsManager, camera, quality = 'medium', loop = null, audioManager = null) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.camera = camera;
        this.quality = quality;
        this.loop = loop;
        this.audioManager = audioManager;

        this.currentStage = null;
        this.currentLoader = null;

        // Track objects that should persist across stage changes
        this.persistentObjects = new Set();

        // Stage definitions
        this.stages = {
            office: {
                name: 'Journalist Office',
                modelPath: 'blender/stage1/stage1.glb',
                navMeshPath: null, // No navmesh for office yet
                spawnPoint: { x: 3, y: 1.8, z: 1.2 }, // Spawn in center of office
                ambientIntensity: 0.3, // Brighter for office
                lightsConfig: {
                    fluorescent: true, // Has fluorescent ceiling lights
                    lamps: false,
                    fireplaces: false
                },
                // Physics filter for office - add exclusion keywords for furniture that shouldn't collide
                physicsExclusions: ['furniture', 'chair', 'desk', 'cabinet', 'file', 'table', 'shelf', 'bin', 'frame']
            },
            mansion: {
                name: 'Haunted Mansion',
                modelPath: 'blender/Mansion.glb',
                navMeshPath: 'blender/NavMesh.glb',
                spawnPoint: null, // Will use entrance door spawn
                ambientIntensity: 0.005, // Dark for horror
                lightsConfig: {
                    fluorescent: false,
                    lamps: true,
                    fireplaces: true
                }
            }
        };

        logger.log('🎬 StageManager initialized');
    }

    /**
     * Load a specific stage
     * @param {string} stageName - Name of the stage (office, mansion, etc.)
     * @param {Function} onProgress - Progress callback (progress, message)
     * @returns {Promise<Object>} Loaded stage data
     */
    async loadStage(stageName, onProgress = null) {
        const stageConfig = this.stages[stageName];
        if (!stageConfig) {
            throw new Error(`Stage "${stageName}" not found`);
        }

        logger.log(`🎬 Loading stage: ${stageConfig.name}`);

        // Unload current stage if exists
        if (this.currentLoader) {
            await this.unloadCurrentStage();
        }

        // Create new loader
        this.currentLoader = new MansionLoader(
            this.scene,
            this.physicsManager,
            this.quality
        );

        // Pass stage-specific physics exclusions if defined
        if (stageConfig.physicsExclusions) {
            this.currentLoader.setPhysicsExclusions(stageConfig.physicsExclusions);
        }

        // Load the model
        if (onProgress) onProgress(40, `Loading ${stageConfig.name}...`);
        await this.currentLoader.loadMansion(stageConfig.modelPath);

        // Load navmesh if available
        if (stageConfig.navMeshPath) {
            if (onProgress) onProgress(60, 'Analyzing walkable areas...');
            await this.currentLoader.loadNavMesh(
                `${stageConfig.navMeshPath}?v=${Date.now()}`
            );
        }

        // Determine spawn point
        let spawnPosition;
        if (stageName === 'mansion') {
            // Use entrance door spawn for mansion
            const doorSpawnPoint = this.currentLoader.getEntranceDoorSpawnPoint();
            if (doorSpawnPoint) {
                spawnPosition = doorSpawnPoint;
            } else {
                const entranceRoom = this.currentLoader.getEntranceRoom();
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
            spawnPosition = stageConfig.spawnPoint;
        }

        // Set camera position
        this.camera.position.set(
            spawnPosition.x,
            spawnPosition.y,
            spawnPosition.z
        );

        // Update ambient lighting for stage
        this.updateAmbientLighting(stageConfig.ambientIntensity);

        this.currentStage = stageName;

        logger.log(`✅ Stage loaded: ${stageConfig.name}`);
        logger.log(`📍 Spawn position: ${JSON.stringify(spawnPosition)}`);

        return {
            loader: this.currentLoader,
            spawnPosition: spawnPosition,
            config: stageConfig
        };
    }

    /**
     * Mark an object as persistent (won't be removed during stage transitions)
     */
    markAsPersistent(object) {
        this.persistentObjects.add(object);
    }

    /**
     * Snapshot current scene objects to identify what's persistent
     */
    snapshotPersistentObjects() {
        this.persistentObjects.clear();

        // Mark core scene objects as persistent
        this.scene.children.forEach(child => {
            // Keep lights (ambient, directional, etc.) and camera
            if (child.isLight || child.isCamera) {
                this.persistentObjects.add(child);
            }
        });

        logger.log(`📸 Snapshotted ${this.persistentObjects.size} persistent objects`);
    }

    /**
     * Remove all non-persistent objects from scene
     */
    cleanupNonPersistentObjects() {
        const objectsToRemove = [];

        this.scene.children.forEach(child => {
            // Skip persistent objects and the current stage model
            if (!this.persistentObjects.has(child) && child !== this.currentLoader?.model) {
                objectsToRemove.push(child);
            }
        });

        objectsToRemove.forEach(obj => {
            this.scene.remove(obj);
            // Dispose if possible
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });

        logger.log(`🧹 Removed ${objectsToRemove.length} non-persistent objects from scene`);
    }

    /**
     * Unload the current stage
     */
    async unloadCurrentStage() {
        if (!this.currentLoader) return;

        logger.log(`🗑️ Unloading stage: ${this.currentStage}`);

        // Stop all audio
        if (this.audioManager) {
            this.audioManager.stopAll();
            logger.log('🔇 Stopped all audio');
        }

        // Clean up non-persistent scene objects (monster, particles, etc.)
        this.cleanupNonPersistentObjects();

        // Use the MansionLoader's built-in dispose method
        // This properly cleans up physics bodies, lights, and meshes
        if (this.currentLoader.dispose) {
            this.currentLoader.dispose();
        }

        this.currentLoader = null;
        this.currentStage = null;

        logger.log('✅ Stage unloaded');
    }

    /**
     * Transition to a new stage with fade effect
     * @param {string} newStageName - Target stage name
     * @param {Object} options - Transition options
     * @returns {Promise<Object>} New stage data
     */
    async transitionToStage(newStageName, options = {}) {
        const {
            fadeOutDuration = 1000,
            fadeInDuration = 1000,
            onProgress = null
        } = options;

        logger.log(`🎬 Transitioning to stage: ${newStageName}`);

        // Stop the game loop to prevent physics updates during transition
        const wasLoopRunning = this.loop && this.loop.isRunning;
        if (wasLoopRunning) {
            this.loop.stop();
            logger.log('⏸️ Game loop paused for stage transition');
            // Wait for any pending animation frames to complete
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Fade out
        await this.fadeScreen(true, fadeOutDuration);

        // Load new stage
        const stageData = await this.loadStage(newStageName, onProgress);

        // Reset player if physics manager available
        if (this.physicsManager && this.physicsManager.teleportTo) {
            this.physicsManager.teleportTo({
                x: stageData.spawnPosition.x,
                y: stageData.spawnPosition.y,
                z: stageData.spawnPosition.z
            });
        }

        // Fade in
        await this.fadeScreen(false, fadeInDuration);

        // Resume the game loop
        if (wasLoopRunning && this.loop) {
            this.loop.start();
            logger.log('▶️ Game loop resumed after stage transition');
        }

        return stageData;
    }

    /**
     * Fade screen to/from black
     * @param {boolean} fadeOut - True to fade to black, false to fade from black
     * @param {number} duration - Duration in milliseconds
     */
    async fadeScreen(fadeOut, duration) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('fade-overlay') || this.createFadeOverlay();
            const startOpacity = fadeOut ? 0 : 1;
            const endOpacity = fadeOut ? 1 : 0;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const opacity = startOpacity + (endOpacity - startOpacity) * progress;
                overlay.style.opacity = opacity;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * Create fade overlay element
     */
    createFadeOverlay() {
        let overlay = document.getElementById('fade-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'fade-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: black;
                opacity: 0;
                pointer-events: none;
                z-index: 9999;
                transition: opacity 0.1s linear;
            `;
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    /**
     * Update ambient lighting for stage
     */
    updateAmbientLighting(intensity) {
        const ambientLight = this.scene.getObjectByName('moonlight_ambient');
        if (ambientLight) {
            ambientLight.intensity = intensity;
            logger.log(`💡 Ambient light intensity set to: ${intensity}`);
        }
    }

    /**
     * Get current stage info
     */
    getCurrentStageInfo() {
        if (!this.currentStage) return null;

        return {
            name: this.currentStage,
            config: this.stages[this.currentStage],
            loader: this.currentLoader
        };
    }

    /**
     * Get available stages
     */
    getAvailableStages() {
        return Object.keys(this.stages);
    }
}
