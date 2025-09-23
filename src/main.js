import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import all your components and systems
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';
import { createPlayer } from './components/Player/Player.js';
import { FirstPersonControls } from './components/Player/PlayerControls.js';
import { createFlashlight } from './components/Player/createFlashlight.js';
import { createRenderer } from './systems/Renderer.js';
import { Resizer } from './systems/Resizer.js';
import { Loop } from './systems/Loop.js';
import { createStats } from './systems/Stats.js';
import { AssetManager } from './systems/AssetManager.js';
import { LoadingManager } from './systems/LoadingManager.js';

const welcomeScreen = document.getElementById('welcome-screen');
const playButton = document.getElementById('play-btn');
const loadingScreen = document.getElementById('loading-container'); 

playButton.addEventListener('click', () => {
  welcomeScreen.style.display = 'none';
  loadingScreen.style.display = 'flex';
  main();
});

async function main() {
    const canvas = document.querySelector('#game-canvas');

    const scene = createScene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 5, 20);
    const renderer = createRenderer(canvas);
    const stats = createStats();
    const loop = new Loop(camera, scene, renderer, stats);
    
    // 1. Create and initialize the managers
    const loadingManager = new LoadingManager();
    const assetManager = new AssetManager(scene, camera, loadingManager);
    assetManager.init();
    
    // 2. Load only the initial starting room
    await assetManager.loadInitialAsset('entry');

    loadingScreen.style.display = 'none';
    
    // 3. Set up controls and add the assetManager to the update loop
    const controls = new FirstPersonControls(camera, renderer.domElement);
    loop.updatables.push(controls, assetManager); // <-- CRITICAL STEP

    const { flashlight } = createFlashlight();
    camera.add(flashlight);
    camera.add(flashlight.target);

    const player = createPlayer();
    const { ambientLight } = createLights();
    scene.add(player, ambientLight, camera);
    
    const resizer = new Resizer(camera, renderer);

    loop.start();
}