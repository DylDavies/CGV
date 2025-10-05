// src/components/Player/Character.js

import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

const loader = new GLTFLoader();

// Define a layer that only the player character will be on
export const PLAYER_LAYER = 1;

async function createCharacter(path) {
  try {
    const gltf = await loader.loadAsync(path);
    const characterModel = gltf.scene;
    characterModel.scale.set(0.5, 0.5, 0.5);

    const box = new THREE.Box3().setFromObject(characterModel);
    const center = box.getCenter(new THREE.Vector3());
    characterModel.position.y -= center.y;

    characterModel.name = 'playerCharacter';

    // FIX: Recursively set every part of the model to the player layer
    characterModel.traverse((child) => {
      if (child.isMesh) {
        child.layers.set(PLAYER_LAYER);
      }
    });

    // --- NEW: Animation Setup ---
    const mixer = new THREE.AnimationMixer(characterModel);
    characterModel.mixer = mixer;
    characterModel.animations = {};

    // Assuming you have 'walk'  animations in your character.glb
    const walkClip = gltf.animations.find(clip => clip.name === 'walk');
    if (walkClip) {
        characterModel.animations.walk = mixer.clipAction(walkClip);
        console.log('✅ Player "walk" animation found.');
    } else {
        console.warn('⚠️ Player "walk" animation not found.');
    }

    console.log('✅ Character model loaded and assigned to player layer.');
    return characterModel;

  } catch (error) {
    console.error('❌ Error loading character model:', error);
    const fallbackGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 'lightgrey' });
    const fallbackCharacter = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    fallbackCharacter.name = 'playerCharacter_fallback';
    fallbackCharacter.layers.set(PLAYER_LAYER); // Also apply to fallback
    return fallbackCharacter;
  }
}

export { createCharacter };