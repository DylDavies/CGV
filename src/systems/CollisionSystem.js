// src/systems/CollisionSystem.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class CollisionSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();

        // Player collision properties
        this.playerRadius = 0.5; // Player capsule radius
        this.playerHeight = 1.8; // Player height
        this.stepHeight = 0.3; // Maximum step height

        // Collision objects storage
        this.collisionObjects = [];
        this.floorObjects = [];

        // Raycasting directions for collision detection
        this.directions = [
            new THREE.Vector3(1, 0, 0),   // Right
            new THREE.Vector3(-1, 0, 0),  // Left
            new THREE.Vector3(0, 0, 1),   // Forward
            new THREE.Vector3(0, 0, -1),  // Backward
            new THREE.Vector3(0.707, 0, 0.707),   // Forward-right
            new THREE.Vector3(-0.707, 0, 0.707),  // Forward-left
            new THREE.Vector3(0.707, 0, -0.707),  // Backward-right
            new THREE.Vector3(-0.707, 0, -0.707), // Backward-left
        ];

        // Ground detection
        this.groundRay = new THREE.Raycaster();
        this.groundRay.set(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));

        this.isOnGround = false;
        this.groundHeight = 0;
    }

    // Add collision objects from the mansion
    addCollisionObject(object, type = 'wall') {
        if (type === 'floor') {
            this.floorObjects.push(object);
        } else {
            this.collisionObjects.push(object);
        }
    }

    // Remove collision object
    removeCollisionObject(object) {
        const wallIndex = this.collisionObjects.indexOf(object);
        if (wallIndex > -1) {
            this.collisionObjects.splice(wallIndex, 1);
        }

        const floorIndex = this.floorObjects.indexOf(object);
        if (floorIndex > -1) {
            this.floorObjects.splice(floorIndex, 1);
        }
    }

    // Check for ground collision and update ground state
    checkGroundCollision(position) {
        this.groundRay.ray.origin.copy(position);
        this.groundRay.ray.origin.y += 0.1; // Start just slightly above current position

        const intersections = this.groundRay.intersectObjects(this.floorObjects, true);

        if (intersections.length > 0) {
            const groundDistance = intersections[0].distance - 0.1;
            this.groundHeight = intersections[0].point.y;
            this.isOnGround = groundDistance < 2.0; // Allow being up to 2m above ground

            return {
                isOnGround: this.isOnGround,
                groundHeight: this.groundHeight,
                groundDistance: groundDistance,
                normal: intersections[0].face ? intersections[0].face.normal : new THREE.Vector3(0, 1, 0)
            };
        } else {
            this.isOnGround = false;
            return {
                isOnGround: false,
                groundHeight: this.groundHeight,
                groundDistance: Infinity,
                normal: new THREE.Vector3(0, 1, 0)
            };
        }
    }

    // Check collision in a specific direction
    checkDirectionalCollision(position, direction, distance = this.playerRadius) {
        this.raycaster.set(position, direction);
        const intersections = this.raycaster.intersectObjects(this.collisionObjects, true);

        if (intersections.length > 0) {
            const collision = intersections[0];
            if (collision.distance < distance) {
                return {
                    hasCollision: true,
                    distance: collision.distance,
                    point: collision.point,
                    normal: collision.face.normal,
                    object: collision.object
                };
            }
        }

        return { hasCollision: false };
    }

    // Main collision checking method
    checkCollision(currentPosition, intendedPosition) {
        const movement = new THREE.Vector3().subVectors(intendedPosition, currentPosition);
        const movementDistance = movement.length();

        if (movementDistance === 0) {
            return {
                position: currentPosition.clone(),
                hasCollision: false
            };
        }

        const movementDirection = movement.normalize();
        let finalPosition = intendedPosition.clone();
        let hasAnyCollision = false;

        // Check collision in movement direction
        const collision = this.checkDirectionalCollision(
            currentPosition,
            movementDirection,
            movementDistance + this.playerRadius
        );

        if (collision.hasCollision) {
            hasAnyCollision = true;

            // Calculate sliding vector along the collision surface
            const slideVector = this.calculateSlideVector(movementDirection, collision.normal);
            const slideDistance = Math.max(0, movementDistance - collision.distance + this.playerRadius);

            // Apply sliding motion
            if (slideVector.length() > 0.01) {
                finalPosition = currentPosition.clone().add(
                    slideVector.multiplyScalar(slideDistance * 0.8)
                );

                // Recursively check for additional collisions in slide direction
                const slideCollision = this.checkCollision(currentPosition, finalPosition);
                finalPosition = slideCollision.position;
            } else {
                // No sliding possible, stop at collision point
                finalPosition = currentPosition.clone().add(
                    movementDirection.multiplyScalar(Math.max(0, collision.distance - this.playerRadius))
                );
            }
        }

        // Additional multi-directional collision checking for better wall hugging
        for (const dir of this.directions) {
            const dirCollision = this.checkDirectionalCollision(finalPosition, dir, this.playerRadius);
            if (dirCollision.hasCollision) {
                hasAnyCollision = true;
                // Push player away from wall
                const pushBack = dir.clone().multiplyScalar(-(this.playerRadius - dirCollision.distance + 0.01));
                finalPosition.add(pushBack);
            }
        }

        return {
            position: finalPosition,
            hasCollision: hasAnyCollision
        };
    }

    // Calculate sliding vector along collision surface
    calculateSlideVector(movementDirection, surfaceNormal) {
        // Project movement onto surface plane
        const dot = movementDirection.dot(surfaceNormal);
        return movementDirection.clone().sub(surfaceNormal.clone().multiplyScalar(dot));
    }

    // Check if player can step up (for stairs or small obstacles)
    checkStepUp(position, direction, distance) {
        const stepUpPosition = position.clone().add(new THREE.Vector3(0, this.stepHeight, 0));
        const stepCollision = this.checkDirectionalCollision(stepUpPosition, direction, distance);

        if (!stepCollision.hasCollision) {
            // Check if there's ground after stepping up
            const forwardPosition = stepUpPosition.clone().add(direction.clone().multiplyScalar(distance));
            const groundCheck = this.checkGroundCollision(forwardPosition);

            if (groundCheck.isOnGround && groundCheck.groundHeight <= position.y + this.stepHeight) {
                return {
                    canStepUp: true,
                    stepHeight: groundCheck.groundHeight - position.y
                };
            }
        }

        return { canStepUp: false };
    }

    // Get all nearby collision objects (for interaction system)
    getNearbyObjects(position, radius = 3.0) {
        const nearbyObjects = [];

        for (const object of this.collisionObjects) {
            const distance = position.distanceTo(object.position);
            if (distance <= radius) {
                nearbyObjects.push({
                    object: object,
                    distance: distance
                });
            }
        }

        return nearbyObjects.sort((a, b) => a.distance - b.distance);
    }

    // Check line of sight between two points
    checkLineOfSight(from, to) {
        const direction = new THREE.Vector3().subVectors(to, from).normalize();
        const distance = from.distanceTo(to);

        this.raycaster.set(from, direction);
        const intersections = this.raycaster.intersectObjects(this.collisionObjects, true);

        return intersections.length === 0 || intersections[0].distance > distance;
    }

    // Debug visualization methods
    createDebugVisualization() {
        const debugGroup = new THREE.Group();
        debugGroup.name = 'collision-debug';

        // Player capsule visualization
        const capsuleGeometry = new THREE.CapsuleGeometry(this.playerRadius, this.playerHeight);
        const capsuleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        const capsuleMesh = new THREE.Mesh(capsuleGeometry, capsuleMaterial);

        debugGroup.add(capsuleMesh);

        // Collision ray visualization
        for (let i = 0; i < this.directions.length; i++) {
            const rayGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                this.directions[i].clone().multiplyScalar(this.playerRadius)
            ]);
            const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
            const rayLine = new THREE.Line(rayGeometry, rayMaterial);
            debugGroup.add(rayLine);
        }

        return debugGroup;
    }

    updateDebugVisualization(debugGroup, position) {
        if (debugGroup) {
            debugGroup.position.copy(position);

            // Update collision ray colors based on current collisions
            for (let i = 1; i < debugGroup.children.length; i++) {
                const collision = this.checkDirectionalCollision(position, this.directions[i - 1]);
                debugGroup.children[i].material.color.setHex(
                    collision.hasCollision ? 0xff0000 : 0x00ff00
                );
            }
        }
    }

    // Performance optimization: spatial partitioning for large mansions
    buildSpatialHash(cellSize = 10) {
        this.spatialHash = new Map();
        this.cellSize = cellSize;

        // Hash collision objects into spatial grid
        for (const object of this.collisionObjects) {
            const cellKey = this.getCellKey(object.position);
            if (!this.spatialHash.has(cellKey)) {
                this.spatialHash.set(cellKey, []);
            }
            this.spatialHash.get(cellKey).push(object);
        }
    }

    getCellKey(position) {
        const x = Math.floor(position.x / this.cellSize);
        const z = Math.floor(position.z / this.cellSize);
        return `${x},${z}`;
    }

    getLocalCollisionObjects(position) {
        if (!this.spatialHash) return this.collisionObjects;

        const localObjects = [];
        const cellKey = this.getCellKey(position);

        // Get objects from current cell and adjacent cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const x = Math.floor(position.x / this.cellSize) + dx;
                const z = Math.floor(position.z / this.cellSize) + dz;
                const key = `${x},${z}`;

                if (this.spatialHash.has(key)) {
                    localObjects.push(...this.spatialHash.get(key));
                }
            }
        }

        return localObjects;
    }

    // Cleanup
    dispose() {
        this.collisionObjects = [];
        this.floorObjects = [];
        if (this.spatialHash) {
            this.spatialHash.clear();
        }
    }
}

export { CollisionSystem };