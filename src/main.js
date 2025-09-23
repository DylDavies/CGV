import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import our new loader
import { loadMap } from './utils/AssetLoader.js';

// World Components
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';

// Game Object Components
import { createPlayer } from './components/Player/Player.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { createFlashlight } from './components/Player/createFlashlight.js';

// Core Systems
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';

// Main function to run the game
async function main() {
    const canvas = document.querySelector('#game-canvas');

    // 1. Core setup
    const scene = createScene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 5, 20); // Adjust camera position to see the map
    const renderer = createRenderer(canvas);
    const stats = createStats();
    const loop = new Loop(camera, scene, renderer, stats);

    const controls = new FirstPersonControls(camera, renderer.domElement);
    loop.updatables.push(controls); // Add controls to the update loop

    const { flashlight } = createFlashlight(); // Get both from the function
    camera.add(flashlight);
    camera.add(flashlight.target);
    
    // 2. Load the map assets
//     const mapFiles = [
//   'models/Mansion/MERGED_CENTRE_bottom_left_corridor.glb',
//   'models/Mansion/MERGED_CENTRE_bottom_right_back_room.glb',
//   'models/Mansion/MERGED_CENTRE_bottom_right_back_room2.glb',
//   'models/Mansion/MERGED_CENTRE_bottom_right_back_room_001.glb',
//   'models/Mansion/MERGED_CENTRE_bottom_right_corridor.glb',
//   'models/Mansion/MERGED_CENTRE_bottom_right_mid_room.glb',
//   'models/Mansion/MERGED_CENTRE_corridor.glb',
//   'models/Mansion/MERGED_CENTRE_Entry.glb',
//   'models/Mansion/MERGED_CENTRE_Entry_library.glb',
//   'models/Mansion/MERGED_CENTRE_Entry_right.glb',
//   'models/Mansion/MERGED_CENTRE_Entry_top_right.glb',
//   'models/Mansion/MERGED_CENTRE_top_left_corridor_centre.glb',
//   'models/Mansion/MERGED_CENTRE_top_left_corridor_end.glb',
//   'models/Mansion/MERGED_CENTRE_top_left_corridor_entrance.glb',
//   'models/Mansion/MERGED_CENTRE_top_left_room1.glb',
//   'models/Mansion/MERGED_CENTRE_top_left_room2.glb',
//   'models/Mansion/MERGED_CENTRE_top_middle_room.glb',
//   'models/Mansion/MERGED_CENTRE_top_right_corridor_end.glb',
//   'models/Mansion/MERGED_CENTRE_top_right_corridor_entrance.glb',
//   'models/Mansion/MERGED_CENTRE_top_right_corridor_kink.glb',
//   'models/Mansion/MERGED_CENTRE_top_right_room_end.glb'
// ]

    const startingRoom = ['/models/Mansion/MERGED_CENTRE_Entry.glb'];
    const models = await loadMap(startingRoom);
    scene.add(models[0].scene);

    // 3. Add other objects and lights
    const player = createPlayer();
    const { ambientLight } = createLights();

    const flashlightControl = {
        tick: () => {
            // The target's position is relative to the camera.
            // A negative Z value points it directly forward from the camera's perspective.
            flashlight.target.position.set(0, 0, -1);
        }
    };
    loop.updatables.push(flashlightControl);

    loop.updatables.push(player);
    scene.add(player, ambientLight, camera);
    
    // 4. Set up window resizing
    const resizer = new Resizer(camera, renderer);

    // 5. Start the game
    loop.start();
}

// Run the main function
main().catch((err) => {
    console.error(err);
});