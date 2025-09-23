import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('skyblue');
    return scene;
}