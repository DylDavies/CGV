// src/components/Monster/Monster.js - Now loads a GLB model with animations

import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

const loader = new GLTFLoader();

async function createMonster(path) {
  try {
    const gltf = await loader.loadAsync(path);
    const monsterModel = gltf.scene;
    monsterModel.scale.set(0.35, 0.35, 0.35);

    // --- Adjustments for your model ---
    const box = new THREE.Box3().setFromObject(monsterModel);
    const center = box.getCenter(new THREE.Vector3());
    monsterModel.position.y -= center.y;

    monsterModel.name = 'monster';

    // --- NEW: Animation Setup ---
    // The mixer is the player for all animations on this object
    const mixer = new THREE.AnimationMixer(monsterModel);
    monsterModel.mixer = mixer; // Attach mixer to the model
    monsterModel.animations = {}; // Create a place to store animation actions

    // Find the 'walk' animation from the GLB file's animations array
    const walkClip = gltf.animations.find(clip => clip.name === 'Walk');
    if (walkClip) {
        const walkAction = mixer.clipAction(walkClip);
        monsterModel.animations.walk = walkAction; // Store the walk action
        console.log('✅ "walk" animation found and configured.');
    } else {
        console.warn('⚠️ "walk" animation not found in the model.');
    }
    // --- END NEW ---

    console.log('✅ Custom monster model loaded successfully.');
    return monsterModel; // Return the model with mixer and animations attached

  } catch (error) {
    console.error('❌ Error loading monster model:', error);
    // As a fallback, return a simple box so the game doesn't crash.
    const fallbackGeometry = new THREE.BoxGeometry(1, 2, 1);
    const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 'red' });
    const fallbackMonster = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    fallbackMonster.name = 'monster_fallback';
    return fallbackMonster;
  }
}

export { createMonster };

