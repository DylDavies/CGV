// src/utils/AssetLoader.js

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';

const assetLoader = {
    loadAssets: (assets, onProgress) => {
        const manager = new LoadingManager();
        const gltfLoader = new GLTFLoader(manager);
        const textureLoader = new THREE.TextureLoader(manager); // Assuming you might need this later

        const promises = [];
        const loadedAssets = {};

        const assetsToLoad = [
            ...assets,
            // NEW: Add your monster model to the assets list
            { name: 'monsterModel', type: 'gltf', path: 'models/untitled.glb' }
        ];

        assetsToLoad.forEach(asset => {
            const promise = new Promise((resolve, reject) => {
                if (asset.type === 'gltf') {
                    gltfLoader.load(asset.path, (gltf) => {
                        loadedAssets[asset.name] = gltf;
                        resolve();
                    }, undefined, reject);
                }
                // Add other asset types like textures here if needed
            });
            promises.push(promise);
        });

        manager.onProgress = onProgress;

        return Promise.all(promises).then(() => loadedAssets);
    }
};

export { assetLoader };