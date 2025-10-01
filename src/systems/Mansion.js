// src/systems/Mansion.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { loadModel } from '../utils/AssetLoader.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@^0.20.0';

class Mansion {
    constructor(scene, physicsManager) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.model = null;
        this.rooms = [
            {
                id: 0,
                type: 'entrance',
                center: new THREE.Vector3(0, 2.5, 5),
                puzzles: [], // <--- ADD THIS LINE
            },];

        this.puzzleRooms = [];
    }

    async load() {
        console.log('Loading house model...');
        this.model = await loadModel('public/models/house.glb');

        const box = new THREE.Box3().setFromObject(this.model.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        console.log('Model Bounding Box Size:', size);
        console.log('Model Bounding Box Center:', center);

        this.scene.add(this.model.scene);
        console.log('House model added to the scene.');


        // --- DELETE THE OLD TRAVERSE BLOCK AND REPLACE IT WITH THIS ---

        // 2. Set up collisions for the model
        this.model.scene.traverse((node) => {
            if (node.isMesh) {
                // Enable shadows for meshes
                node.castShadow = true;
                node.receiveShadow = true;

                // Create the physics body
                const body = this.createStaticBodyFromMesh(node);
                if (body) {
                    this.physicsManager.addBody(body);
                }
            }
        });
        
        console.log('Physics bodies created for the house model.');
        // --- Game Logic Data (Manual Setup) ---
        // Since we are no longer generating rooms, you need to define them manually.
        // This data will be used by the GameManager and other systems.
        this.rooms = [
            {
                id: 0,
                type: 'entrance',
                // Define the center of your entrance room for the spawn point
                center: new THREE.Vector3(0, 1.8, 5),
                // You can add more room properties here, like bounding boxes for triggers
            },
            // Add other rooms here...
            // { id: 1, type: 'living_room', center: new THREE.Vector3(10, 1.8, 5) },
        ];

        this.puzzleRooms = []; // You can manually define which rooms have puzzles
    }
    
    // This function is called by GameManager to find the player's current room.
    // You'll need to implement logic to determine which room the player is in.
    getRoomAt(position) {
        // For now, we'll just return the entrance.
        // A better implementation would check if the position is within a room's bounding box.
        return this.rooms[0];
    }

     createStaticBodyFromMesh(mesh) {
        const worldQuaternion = new THREE.Quaternion();
        mesh.getWorldQuaternion(worldQuaternion);
        
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);

        const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
        const shape = new CANNON.Box(halfExtents);
        
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);

        // --- START OF THE FIX ---

        // 1. Create a temporary Three.js vector to store the center.
        const center = new THREE.Vector3();
        box.getCenter(center);

        // 2. Copy the values from the Three.js vector to the Cannon.js vector.
        body.position.copy(center);
        
        // --- END OF THE FIX ---

        body.quaternion.copy(worldQuaternion);

        return body;
    }
    // The tick method can be used for animations or updates related to the mansion model.
    tick(delta) {
        // Nothing to do here for a static model, but the method needs to exist.
    }
}

export { Mansion };