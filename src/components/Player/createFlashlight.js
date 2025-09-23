// src/components/Player/createFlashlight.js
import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createFlashlight() {
    const flashlight = new THREE.SpotLight(0xffffff, 100, 100, Math.PI / 8, 0.5, 2);

    flashlight.position.set(0, 0.5, 0);

    flashlight.castShadow = true;
    flashlight.target = new THREE.Object3D();

    // Create a helper to visualize the light cone
    const flashlightHelper = new THREE.SpotLightHelper(flashlight);

    return { flashlight, flashlightHelper };
}

export { createFlashlight };