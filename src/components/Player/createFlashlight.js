// src/components/Player/createFlashlight.js
import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { FlashlightController } from './FlashlightController.js';

function createFlashlight(camera, scene, useAdvancedController = true) {
    if (useAdvancedController) {
        // Return new advanced flashlight controller
        const flashlightController = new FlashlightController(camera, scene);
        return {
            flashlightController,
            flashlight: flashlightController.flashlight,
            // For backward compatibility
            flashlightHelper: null
        };
    } else {
        // Legacy simple flashlight creation
        const flashlight = new THREE.SpotLight(0xffffff, 100, 100, Math.PI / 8, 0.5, 2);

        flashlight.position.set(0, 0.5, 0);
        flashlight.castShadow = true;
        flashlight.target = new THREE.Object3D();

        // Create a helper to visualize the light cone
        const flashlightHelper = new THREE.SpotLightHelper(flashlight);

        return { flashlight, flashlightHelper };
    }
}

// Alternative function for creating just the advanced controller
function createAdvancedFlashlight(camera, scene) {
    return new FlashlightController(camera, scene);
}

// Simple flashlight factory for basic usage
function createSimpleFlashlight() {
    const flashlight = new THREE.SpotLight(0xffffff, 80, 50, Math.PI / 6, 0.3, 1.5);

    flashlight.position.set(0.2, -0.1, 0);
    flashlight.castShadow = true;
    flashlight.target = new THREE.Object3D();

    // Better shadow settings for horror atmosphere
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    flashlight.shadow.camera.near = 0.1;
    flashlight.shadow.camera.far = 50;

    return { flashlight, target: flashlight.target };
}

export { createFlashlight, createAdvancedFlashlight, createSimpleFlashlight };