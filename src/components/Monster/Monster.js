// src/components/Monster/Monster.js

import { Clock } from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { MonsterAI } from './MonsterAI.js';

class Monster {
    constructor(player, scene, navMesh, walls, camera, mansion) { 
        this.model = null;
        this.ai = null;
        this.player = player;
        this.scene = scene;
        this.navMesh = navMesh;
        this.walls = walls;
        this.camera = camera; // Pass camera for AI sight
        this.loader = new GLTFLoader();
         this.mansion = mansion;
    }

    async load() {
        return new Promise((resolve, reject) => {
            this.loader.load(
                './public/models/untitled.glb', // Correct path from main.js
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.scale.set(1, 1, 1);
                    this.model.name = 'monster';
                    this.scene.add(this.model);

                    const aiConfig = {
                        speed: 2.5, // Speed in units per second
                        recalculationInterval: 1000,
                        wallSize: 6.0, // Should match mansion gridSize
                        onAggressionChange: (level) => {
                            console.log(`Monster aggression level: ${level}`);
                        }
                    };
                    
                    this.ai = new MonsterAI(this.model, this.player, this.navMesh, this.walls, this.camera, aiConfig, this.scene, this.mansion);
                    this.ai.setupRayVisualizers();
                    this.ai.setupMonsterRayVisualizers();
                    
                    console.log("👹 Monster loaded and AI initialized.");
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading monster model:', error);
                    reject(error);
                }
            );
        });
    }

    tick(delta) {
        if (this.ai) {
            this.ai.update(delta);
        }
    }
}

export { Monster };