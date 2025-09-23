// computeCenters.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/DRACOLoader.js';
// Make sure this path is correct relative to where you run the script
import { mansionConfig } from '../config/MansionConfig.js';

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.127.0/examples/js/libs/draco/gltf/');
gltfLoader.setDRACOLoader(dracoLoader);

async function computeCenter(path) {
    const gltf = await gltfLoader.loadAsync(path);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
}

async function main() {
    console.log("Starting computation of asset centers...");
    console.log("Copy the output below into src/config/MansionConfig.js");
    console.log("const mansionSections = [");

    for (const config of mansionConfig) {
        try {
            const center = await computeCenter(config.path);
            console.log(`    { id: '${config.id}', path: '${config.path}', position: new THREE.Vector3(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}) },`);
        } catch (error) {
            console.error(`Error processing ${config.id}:`, error);
        }
    }
    console.log("];");
}

main();