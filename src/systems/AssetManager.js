// src/systems/AssetManager.js (Updated)

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/DRACOLoader.js';
import { mansionConfig } from '../config/MansionConfig.js';

class AssetManager {
    constructor(scene, camera, loadingManager) {
        this.scene = scene;
        this.camera = camera;
        this.loadingManager = loadingManager;
        this.gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.127.0/examples/js/libs/draco/gltf/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        this.loadRadius = 75;
        this.unloadRadius = 100; // Larger to prevent rapid load/unload cycles
        this.assetCache = new Map();
        this.loadQueue = [];
        this.isLoading = false;
        this.checkInterval = 1000; // Check every second
        this.timeSinceLastCheck = 0;
    }

    init() {
        mansionConfig.forEach(config => {
            this.assetCache.set(config.id, { ...config, loaded: false, sceneObject: null });
        });
        this.loadingManager.init(1); // Only for the initial asset
    }

    async loadInitialAsset(assetId) {
        const asset = this.assetCache.get(assetId);
        if (asset) {
            await this._loadAsset(asset);
            this.showAsset(asset);
            this.loadingManager.assetLoaded();
        }
    }

    tick(delta) {
        this.timeSinceLastCheck += delta * 1000;
        if (this.timeSinceLastCheck > this.checkInterval) {
            this.updateLoadQueue();
            this.timeSinceLastCheck = 0;
        }
        
        this.assetCache.forEach(asset => {
            if (asset.loaded) {
                const distance = this.camera.position.distanceTo(asset.position);
                if (distance > this.unloadRadius) {
                    this.unloadAsset(asset);
                }
            }
        });
    }

    updateLoadQueue() {
        const playerPosition = this.camera.position;
        const toLoad = [];
        this.assetCache.forEach(asset => {
            if (!asset.loaded && !this.loadQueue.includes(asset.id)) {
                const distance = playerPosition.distanceTo(asset.position);
                if (distance < this.loadRadius) {
                    toLoad.push({ id: asset.id, distance });
                }
            }
        });

        toLoad.sort((a, b) => a.distance - b.distance); // Prioritize closest
        this.loadQueue.push(...toLoad.map(item => item.id));

        if (!this.isLoading && this.loadQueue.length > 0) {
            this.processQueue();
        }
    }

    async processQueue() {
        this.isLoading = true;
        const assetId = this.loadQueue.shift();
        if (assetId) {
            const asset = this.assetCache.get(assetId);
            await this._loadAsset(asset);
            const distance = this.camera.position.distanceTo(asset.position);
            if (distance < this.loadRadius) {
                this.showAsset(asset);
            }
        }
        this.isLoading = false;
        if (this.loadQueue.length > 0) {
            this.processQueue();
        }
    }

    async _loadAsset(asset) {
        if (asset.loaded) return;
        try {
            const gltf = await this.gltfLoader.loadAsync(asset.path);
            asset.sceneObject = gltf.scene;
            // REMOVED position.copy() - model positions are already correct
            asset.sceneObject.visible = false;
            this.scene.add(asset.sceneObject);
            asset.loaded = true;
            console.log(`${asset.id} loaded.`);
        } catch (error) {
            console.error(`Failed to load ${asset.id}:`, error);
        }
    }

    unloadAsset(asset) {
        if (asset.sceneObject) {
            this._disposeObject(asset.sceneObject);
            this.scene.remove(asset.sceneObject);
            asset.sceneObject = null;
            asset.loaded = false;
            console.log(`${asset.id} unloaded.`);
        }
    }

    _disposeObject(obj) {
        obj.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.isMaterial) this._disposeMaterial(child.material);
                else if (Array.isArray(child.material)) child.material.forEach(mat => this._disposeMaterial(mat));
            }
        });
    }

    _disposeMaterial(mat) {
        mat.dispose();
        if (mat.map) mat.map.dispose();
        if (mat.normalMap) mat.normalMap.dispose();
        if (mat.roughnessMap) mat.roughnessMap.dispose();
        // Add any other texture maps your materials use
    }

    showAsset(asset) {
        if (asset.sceneObject) asset.sceneObject.visible = true;
    }

    hideAsset(asset) {
        if (asset.sceneObject) asset.sceneObject.visible = false;
    }
}

export { AssetManager };