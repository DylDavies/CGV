// src/components/World/scene.js - Enhanced for horror atmosphere

import { Color, Scene, Fog } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createScene() {
    const scene = new Scene();
    
    // Very dark background for horror atmosphere
    scene.background = new Color(0x000000); // Pure black
    
    // Add fog for atmospheric depth and limited visibility
    scene.fog = new Fog(0x000000, 5, 25); // Black fog, starts at 5 units, fully opaque at 25 units
    
    console.log('🌫️ Horror scene created with atmospheric fog');
    
    return scene;
}

export { createScene };