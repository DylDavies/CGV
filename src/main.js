// Import Three.js from a CDN or a local file
import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

// Import our own modules
import { createScene } from './components/World/scene.js';
import { createLights } from './components/World/lights.js';
import { createPlayer } from './components/Player/Player.js';
import { Loop } from './systems/Loop.js';

// Get a reference to the canvas element
const canvas = document.querySelector('#game-canvas');

// 1. Create the scene and camera
const scene = createScene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// 2. Create a renderer
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// 3. Add objects to the scene
const player = createPlayer();
const { ambientLight, mainLight } = createLights();
scene.add(player, ambientLight, mainLight);

// 4. Start the game loop
const loop = new Loop(camera, scene, renderer);
loop.start();