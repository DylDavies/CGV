// src/components/World/scene.js - Enhanced for horror atmosphere

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createScene() {
    const scene = new THREE.Scene();

    // Very dark background for horror atmosphere - slightly blue-tinted for moonlight
    scene.background = new THREE.Color(0x000510); // Very dark blue-black

    // Add fog for atmospheric depth and limited visibility
    scene.fog = new THREE.Fog(0x000510, 10, 40); // Dark fog, starts at 10 units, fully opaque at 40 units

    // Add moonlight - very dim ambient light with blue tint
    const moonAmbient = new THREE.AmbientLight(0x1a1a2e, 0.05); // Very dim blue ambient
    moonAmbient.name = 'moonlight_ambient';
    scene.add(moonAmbient);

    // Add directional moonlight from above
    const moonLight = new THREE.DirectionalLight(0x4a6fa5, 0.15); // Pale blue moonlight
    moonLight.position.set(-20, 50, 30); // Coming from upper left
    moonLight.castShadow = false; // Disable shadows for performance
    moonLight.name = 'moonlight_directional';
    scene.add(moonLight);

    console.log('🌙 Horror scene created with moonlight and atmospheric fog');

    return scene;
}

export { createScene };