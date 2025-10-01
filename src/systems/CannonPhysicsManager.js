// src/systems/CannonPhysicsManager.js - Cannon.js physics integration

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@^0.20.0';

class CannonPhysicsManager {
    constructor(camera, devModeLight = null) {
        this.camera = camera;
        this.devModeLight = devModeLight;

        // Create Cannon.js world
        this.world = new CANNON.World();
        this.world.gravity.set(0, -15, 0); // Gravity pointing down
        this.world.broadphase = new CANNON.NaiveBroadphase(); // Simple collision detection

        // Player physics body - using a sphere for simplicity
        this.playerRadius = 0.5;
        this.playerHeight = 1.8;

        const playerShape = new CANNON.Sphere(this.playerRadius);
        const playerMaterial = new CANNON.Material('player');

        this.playerBody = new CANNON.Body({
            mass: 5, // Player mass
            material: playerMaterial
        });
        this.playerBody.addShape(playerShape);

        // Set initial position
        this.playerBody.position.set(
            this.camera.position.x,
            this.camera.position.y - this.playerHeight/2, // Body center is lower than camera
            this.camera.position.z
        );

        // Add player to world
        this.world.addBody(this.playerBody);

        // Movement properties
        this.maxSpeed = {
            walk: 5.0,
            run: 8.0,
            crouch: 2.0,
            fly: 10.0
        };

        this.jumpForce = 8.0;
        this.movementSpeed = this.maxSpeed.walk;

        // State tracking
        this.isOnGround = false;
        this.isMoving = false;
        this.canJump = false;

        // Developer mode
        this.devMode = false;
        this.flyMode = false;
        this.noclipMode = false;

        // Ground contact detection
        const groundMaterial = new CANNON.Material('ground');
        this.groundContactMaterial = new CANNON.ContactMaterial(
            groundMaterial,
            playerMaterial,
            {
                friction: 0.8,
                restitution: 0.1 // Low bounce
            }
        );
        this.world.addContactMaterial(this.groundContactMaterial);

        // Track ground contacts
        this.playerBody.addEventListener('collide', (event) => {
            // Check if collision is with ground (from below)
            const contact = event.contact;
            let normal = contact.ni;

            // Make sure we get the right normal direction
            if (event.target === this.playerBody) {
                normal = contact.ni;
            } else {
                normal = contact.ni.clone().negate();
            }

            // If normal points up (y > 0.5), we're likely on ground
            if (normal.y > 0.5) {
                this.isOnGround = true;
                this.canJump = true;
            }
        });

        // Head bob system
        this.headBob = {
            enabled: true,
            intensity: 0.02,
            frequency: 8.0,
            time: 0,
            offset: new THREE.Vector3()
        };

        // Fear system (for horror effects)
        this.fearLevel = 0;
        this.fearEffects = {
            shakingIntensity: 0,
            lastShake: null
        };

        //this.setupDevControls();
        console.log('🔧 CannonPhysicsManager initialized');
    }

    updateDevMode() {
        if (this.devModeLight) {
            if (this.devMode) {
                this.devModeLight.intensity = 1.0; // Daylight brightness
                console.log('☀️ Dev mode lighting: ON');
            } else {
                this.devModeLight.intensity = 0; // Back to horror lighting
                console.log('🌙 Dev mode lighting: OFF');
            }
        }
    }

    // setupDevControls() {
    //     document.addEventListener('keydown', (e) => {
    //         // Toggle dev mode with F9
    //         if (e.code === 'F9') {
    //             this.devMode = !this.devMode;
    //             this.updateDevMode();
    //             console.log(`🔧 Developer mode: ${this.devMode ? 'ON' : 'OFF'}`);
    //         }

    //         // Toggle fly mode with F10 (only in dev mode)
    //         if (e.code === 'F10' && this.devMode) {
    //             this.flyMode = !this.flyMode;
    //             if (this.flyMode) {
    //                 // Disable gravity for player
    //                 this.playerBody.type = CANNON.Body.KINEMATIC;
    //                 console.log('✈️ Fly mode: ON');
    //             } else {
    //                 // Re-enable physics
    //                 this.playerBody.type = CANNON.Body.DYNAMIC;
    //                 console.log('✈️ Fly mode: OFF');
    //             }
    //         }
    //     });
    // }

    //  setupDevControls() {
    //     document.addEventListener('keydown', (e) => {
    //         // Toggle dev mode and fly mode together with F9
    //         if (e.code === 'F9') {
    //             this.devMode = !this.devMode;
    //             this.flyMode = this.devMode; // Link fly mode directly to dev mode

    //             if (this.flyMode) {
    //                 // Disable gravity for player
    //                 this.playerBody.type = CANNON.Body.KINEMATIC;
    //                 console.log('✈️ Dev Mode / Flying: ON');
    //             } else {
    //                 // Re-enable physics
    //                 this.playerBody.type = CANNON.Body.DYNAMIC;
    //                 console.log('✈️ Dev Mode / Flying: OFF');
    //             }
    //             this.updateDevMode();
    //         }
    //     });
    // }

    toggleFlyMode() {
        this.flyMode = !this.flyMode;

        if (this.flyMode) {
            this.playerBody.type = CANNON.Body.KINEMATIC; // Disable gravity
            console.log('✈️ Fly Mode: ON');
        } else {
            this.playerBody.type = CANNON.Body.DYNAMIC; // Re-enable physics
            console.log('✈️ Fly Mode: OFF');
        }
        // Also toggle dev mode's lighting effect if you want
        this.devMode = this.flyMode;
        this.updateDevMode();
    }

    tick(delta, inputs) {
        const safeInputs = inputs || {};

        // Reset ground state (will be set by collision detection)
        this.isOnGround = false;
        this.canJump = false;

        // Step the physics world
        this.world.step(delta);

        if (this.noclipMode) {
            this.handleNoclipMode(safeInputs, delta);
        } else if (this.flyMode && this.devMode) {
            this.handleFlyMode(safeInputs, delta);
        } else {
            this.handleNormalMovement(safeInputs, delta);
        }

        // Update camera position based on physics body
        this.syncCameraToPhysicsBody();

        // Update effects
        this.updateHeadBob(delta);
        this.updateFearEffects(delta);
    }

    handleNormalMovement(inputs, delta) {
        // Determine movement speed
        if (inputs.isCrouching) {
            this.movementSpeed = this.maxSpeed.crouch;
        } else if (inputs.isRunning) {
            this.movementSpeed = this.maxSpeed.run;
        } else {
            this.movementSpeed = this.maxSpeed.walk;
        }

        // Calculate movement direction based on camera
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.y = 0; // Remove vertical component
        forward.normalize();

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calculate intended movement
        const movement = new THREE.Vector3();
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);

        // Apply movement force
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(this.movementSpeed);

            // Apply horizontal force
            this.playerBody.velocity.x = movement.x;
            this.playerBody.velocity.z = movement.z;
            this.isMoving = true;
        } else {
            // Apply friction when not moving
            this.playerBody.velocity.x *= 0.8;
            this.playerBody.velocity.z *= 0.8;
            this.isMoving = false;
        }

        // Jumping
        if (inputs.jump && this.canJump && this.isOnGround) {
            this.playerBody.velocity.y = this.jumpForce;
            this.canJump = false;
            console.log('🦘 Jump!');
        }

        // Limit maximum speeds
        const maxVel = this.movementSpeed * 1.5;
        this.playerBody.velocity.x = Math.max(-maxVel, Math.min(maxVel, this.playerBody.velocity.x));
        this.playerBody.velocity.z = Math.max(-maxVel, Math.min(maxVel, this.playerBody.velocity.z));
        this.playerBody.velocity.y = Math.max(-20, Math.min(15, this.playerBody.velocity.y));
    }

    handleFlyMode(inputs, delta) {
        // Direct position control in fly mode
        const speed = this.maxSpeed.fly;

        // Get camera's forward and right vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.normalize();

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calculate movement
        const movement = new THREE.Vector3();

        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);

        // Vertical movement
        if (inputs.flyUp || inputs.jump) movement.y += 1;
        if (inputs.flyDown || inputs.isCrouching) movement.y -= 1;

        // Apply movement
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(speed * delta);

            this.playerBody.position.x += movement.x;
            this.playerBody.position.y += movement.y;
            this.playerBody.position.z += movement.z;
        }
    }

    handleNoclipMode(inputs, delta) {
        // Direct camera movement with no collision detection
        const speed = this.maxSpeed.walk;

        // Get camera's forward and right vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.normalize();

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calculate movement
        const movement = new THREE.Vector3();

        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);

        // Vertical movement
        if (inputs.jump) movement.y += 1;
        if (inputs.isCrouching) movement.y -= 1;

        // Apply movement directly to camera (no physics)
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(speed * delta);

            this.camera.position.add(movement);
            // Sync physics body to camera position
            this.playerBody.position.set(
                this.camera.position.x,
                this.camera.position.y - this.playerHeight/2,
                this.camera.position.z
            );
        }
    }

    syncCameraToPhysicsBody() {
        // Update camera position based on physics body
        this.camera.position.x = this.playerBody.position.x;
        //this.camera.position.y = this.playerBody.position.y + this.playerHeight/2; // Camera at head level
        this.camera.position.z = this.playerBody.position.z;
    }

    updateHeadBob(delta) {
        if (!this.headBob.enabled || this.flyMode) return;

        // Remove previous head bob
        this.camera.position.sub(this.headBob.offset);
        this.headBob.offset.set(0, 0, 0);

        if (this.isMoving && this.isOnGround) {
            this.headBob.time += delta * this.headBob.frequency;

            const bobIntensity = this.headBob.intensity;
            this.headBob.offset.y = Math.sin(this.headBob.time) * bobIntensity;
            this.headBob.offset.x = Math.sin(this.headBob.time * 0.5) * bobIntensity * 0.5;

            const speedModifier = this.movementSpeed / this.maxSpeed.walk;
            this.headBob.offset.multiplyScalar(speedModifier);
        }

        // Apply head bob
        this.camera.position.add(this.headBob.offset);
    }

    updateFearEffects(delta) {
        if (this.fearLevel > 20) {
            const shakeIntensity = (this.fearLevel / 100) * 0.02;
            const shake = new THREE.Vector3(
                (Math.random() - 0.5) * shakeIntensity,
                (Math.random() - 0.5) * shakeIntensity,
                (Math.random() - 0.5) * shakeIntensity
            );

            if (this.fearEffects.lastShake) {
                this.camera.position.sub(this.fearEffects.lastShake);
            }

            this.camera.position.add(shake);
            this.fearEffects.lastShake = shake;
        } else if (this.fearEffects.lastShake) {
            this.camera.position.sub(this.fearEffects.lastShake);
            this.fearEffects.lastShake = null;
        }
    }

    // Add a physics body to the world (for collision)
    addBody(body) {
        this.world.addBody(body);
    }

    // Remove a physics body from the world
    removeBody(body) {
        this.world.removeBody(body);
    }

    // Create a static box body (for walls, floors)
    createBoxBody(position, size) {
        const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
        const body = new CANNON.Body({
            mass: 0, // Static body
            material: new CANNON.Material('ground')
        });
        body.addShape(shape);
        body.position.set(position.x, position.y, position.z);
        return body;
    }

    teleportTo(position) {
        this.playerBody.position.set(position.x, position.y - this.playerHeight/2, position.z);
        this.playerBody.velocity.set(0, 0, 0);
        this.syncCameraToPhysicsBody();
        console.log(`📍 Teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
    }

    increaseFear(amount) {
        this.fearLevel = Math.min(100, this.fearLevel + amount);
    }

    decreaseFear(amount) {
        this.fearLevel = Math.max(0, this.fearLevel - amount);
    }

    getFearLevel() {
        return this.fearLevel;
    }

    getVelocityMagnitude() {
        const vel = this.playerBody.velocity;
        return new THREE.Vector2(vel.x, vel.z).length();
    }

    getMovementState() {
        return {
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            velocity: new THREE.Vector3(this.playerBody.velocity.x, this.playerBody.velocity.y, this.playerBody.velocity.z),
            speed: this.getVelocityMagnitude(),
            fearLevel: this.fearLevel,
            devMode: this.devMode,
            flyMode: this.flyMode
        };
    }

    getDebugInfo() {
        return {
            position: this.camera.position.clone(),
            velocity: new THREE.Vector3(this.playerBody.velocity.x, this.playerBody.velocity.y, this.playerBody.velocity.z),
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            fearLevel: this.fearLevel,
            movementSpeed: this.movementSpeed,
            devMode: this.devMode,
            flyMode: this.flyMode,
            canJump: this.canJump
        };
    }

    setGravity(gravity) {
        this.world.gravity.set(0, gravity, 0);
        console.log(`🌍 Gravity set to: ${gravity}`);
    }

    setMovementSpeeds(walk, run, crouch, fly) {
        this.maxSpeed.walk = walk;
        this.maxSpeed.run = run;
        this.maxSpeed.crouch = crouch;
        this.maxSpeed.fly = fly;
        console.log(`🏃 Movement speeds updated`);
    }

    setNoclip(enabled) {
        this.noclipMode = enabled;
        console.log(`🚪 Noclip mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    dispose() {
        // Clean up physics world
        this.world.removeBody(this.playerBody);
        console.log('🧹 CannonPhysicsManager disposed');
    }
}

export { CannonPhysicsManager };