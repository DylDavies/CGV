import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import our new loader
import { loadMap } from './utils/AssetLoader.js';

// World Components
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';

// Game Object Components
import { createPlayer } from './components/Player/Player.js';

// Core Systems
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';

// Main function to run the game
async function main() {
  const canvas = document.querySelector('#game-canvas');

  // 1. Core setup
  const scene = createScene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 5, 20); // Adjust camera position to see the map
  const renderer = createRenderer(canvas);
  const loop = new Loop(camera, scene, renderer);
  
  // 2. Load the map assets
  const mapFiles = ['/models/map_part1.glb', '/models/map_part2.glb']; // 👈 ADD YOUR FILE NAMES HERE
  const models = await loadMap(mapFiles);
  for (const model of models) {
    scene.add(model.scene); // Add each loaded map part to the scene
  }

  // 3. Add other objects and lights
  const player = createPlayer();
  const { ambientLight, mainLight } = createLights();
  loop.updatables.push(player);
  scene.add(player, ambientLight, mainLight);
  
  // 4. Set up window resizing
  const resizer = new Resizer(camera, renderer);

  // 5. Start the game
  loop.start();
}

// Run the main function
main().catch((err) => {
  console.error(err);
});