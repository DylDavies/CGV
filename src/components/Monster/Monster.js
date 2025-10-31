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
    const walkClip = gltf.animations.find(clip => clip.name === 'walk');
    if (walkClip) {
        const walkAction = mixer.clipAction(walkClip);
        monsterModel.animations.walk = walkAction; // Store the walk action
        console.log('✅ "walk" animation found and configured.');
    } else {
        console.warn('⚠️ "walk" animation not found in the model. Available animations:', gltf.animations.map(a => a.name).join(', '));
    }

    // Find the 'run' animation from the GLB file's animations array
    const runClip = gltf.animations.find(clip => clip.name === 'run');
    if (runClip) {
        const runAction = mixer.clipAction(runClip);
        monsterModel.animations.run = runAction; // Store the run action
        console.log('✅ "run" animation found and configured.');
    } else {
        console.warn('⚠️ "run" animation not found in the model. Available animations:', gltf.animations.map(a => a.name).join(', '));
    }
    // --- END NEW ---

    // Load attack animation from attack8.glb
    try {
        const attackGltf = await loader.loadAsync('blender/attack8.glb');
        let attackClip = attackGltf.animations.find(clip => clip.name === 'attack');

        if (attackClip) {
            // Clone the clip so we can modify it without affecting the original
            attackClip = attackClip.clone();

            // Log ALL tracks first to see what we have
            console.log('📋 ALL attack animation tracks:');
            attackClip.tracks.forEach((track, index) => {
                console.log(`  [${index}] ${track.name}`);
            });

            // Remove ONLY Main.position to prevent teleporting
            // Keep rotation and scale as they might be needed for proper animation
            // Keep ALL bone animations (hip, spine, arms, legs, etc.)
            const filteredTracks = attackClip.tracks.filter(track => {
                const trackName = track.name;

                // Remove position and quaternion tracks for "Main" (prevents teleporting and rotation)
                // Keep Main.scale as bones might depend on it
                if (trackName === 'Main.position' || trackName === 'Main.quaternion') {
                    console.log(`  ❌ Removing root track: ${track.name}`);
                    return false;
                }

                // Keep all other tracks (including Main.scale and all bone animations)
                return true;
            });

            attackClip.tracks = filteredTracks;

            console.log(`✅ Attack animation processed: ${filteredTracks.length} tracks kept`);

            // Apply the attack animation to the monster's mixer
            const attackAction = mixer.clipAction(attackClip);
            attackAction.setLoop(THREE.LoopOnce); // Play attack once, not looping
            attackAction.clampWhenFinished = true; // Hold on last frame when done
            monsterModel.animations.attack = attackAction; // Store the attack action
            console.log('✅ "attack" animation loaded from attack8.glb and configured.');
        } else {
            console.warn('⚠️ "attack" animation not found in attack8.glb. Available animations:', attackGltf.animations.map(a => a.name).join(', '));
        }
    } catch (error) {
        console.warn('⚠️ Could not load attack8.glb:', error.message);
    }

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