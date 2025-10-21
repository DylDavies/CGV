// src/components/World/scene.js - Enhanced for horror atmosphere

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createScene() {
    const scene = new THREE.Scene();

    // Very dark background for horror atmosphere - slightly blue-tinted for moonlight
    scene.background = new THREE.Color(0x000510); // Very dark blue-black

    // Enhanced fog for atmospheric depth and extreme shadow contrast
    // Using FogExp2 for more natural exponential fog falloff
    scene.fog = new THREE.FogExp2(0x000510, 0.05); // Exponential fog for better depth perception

    // Add moonlight - very dim ambient light with blue tint (reduced for more extreme shadows)
    const moonAmbient = new THREE.AmbientLight(0x1a1a2e, 0.005); // Reduced from 0.01 for darker shadows
    moonAmbient.name = 'moonlight_ambient';
    scene.add(moonAmbient);

    // Add directional moonlight from above - increased intensity for visible window streaks
    const moonLight = new THREE.DirectionalLight(0x5a7fb5, 0.15); // Brighter pale blue moonlight
    moonLight.position.set(-20, 50, 30); // Coming from upper left

    // Enable shadow casting for moonlight (reduced resolution for performance)
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;  // Reduced from 4096 for performance
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.left = -40;
    moonLight.shadow.camera.right = 40;
    moonLight.shadow.camera.top = 40;
    moonLight.shadow.camera.bottom = -40;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 100;
    moonLight.shadow.bias = -0.0001; // Reduced bias for sharper, more pronounced shadows
    moonLight.shadow.normalBias = 0; // No normal bias for more extreme shadows
    moonLight.shadow.radius = 1; // Sharper moonlight shadows for horror atmosphere

    moonLight.name = 'moonlight_directional';
    scene.add(moonLight);

    console.log('🌙 Horror scene created with moonlight and atmospheric fog');

    return scene;
}

export { createScene };