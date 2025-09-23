// src/main.js (Updated)

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
import { LoadingManager } from './systems/LoadingManager.js'; // <-- 1. IMPORT

const welcomeScreen = document.getElementById('welcome-screen');
const playButton = document.getElementById('play-btn');
const loadingScreen = document.getElementById('loading-screen');

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
    
    const loadingManager = new LoadingManager(); // <-- 2. CREATE LOADING MANAGER
    const assetManager = new AssetManager(scene, camera, loadingManager); // <-- 3. PASS IT TO ASSET MANAGER
    assetManager.init();
    await assetManager.loadInitialAsset('entry'); 

    loadingScreen.style.display = 'none';
    
    const controls = new FirstPersonControls(camera, renderer.domElement);
    loop.updatables.push(controls, assetManager); // <-- 4. ADD ASSET MANAGER TO THE LOOP

    const { flashlight } = createFlashlight();
    camera.add(flashlight);
    camera.add(flashlight.target);

    const player = createPlayer();
    const { ambientLight } = createLights();
    scene.add(player, ambientLight, camera);
    
    const resizer = new Resizer(camera, renderer);

    loop.start();
}