// src/systems/CannonPhysicsManager.js - Cannon.js physics integration for a character model

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@^0.20.0';

class CannonPhysicsManager {
    constructor(character, camera, devModeLight = null) {
        this.character = character; // The 3D model of the player
        this.camera = camera;
        this.devModeLight = devModeLight;

        // Create Cannon.js world
        this.world = new CANNON.World();
        this.world.gravity.set(0, -15, 0); // Standard gravity
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;
        this.world.solver.iterations = 5;

        // Player physics body setup
        this.playerHeight = 1.8; // Approximate height of character for camera positioning
        const playerShape = new CANNON.Sphere(0.5); // A simple sphere for collision
        const playerMaterial = new CANNON.Material('player');
        this.playerBody = new CANNON.Body({
            mass: 70, // A more realistic mass for a character
            material: playerMaterial,
            angularDamping: 1.0 // This is crucial to prevent the sphere from rolling
        });
        this.playerBody.addShape(playerShape);
        
        // The physics body starts at the character model's initial position.
        this.playerBody.position.copy(this.character.position); 
        
        this.playerBody.allowSleep = false;
        this.world.addBody(this.playerBody);


        // Movement properties
        this.maxSpeed = {
            walk: 8.0,
            run: 12.0,
            crouch: 3.0,
            fly: 10.0
        };
        this.movementSpeed = this.maxSpeed.walk;
        this.isMoving = false;

        // Developer mode states
        this.devMode = false;
        this.flyMode = false;
        this.noclipMode = false;
        this.fixedYMode = false;
        this.fixedYHeight = 0;

        // Physics debugging
        this.debugRenderer = null;
        this.debugEnabled = false;

        // Ground contact material setup
        const groundMaterial = new CANNON.Material('ground');
        this.groundContactMaterial = new CANNON.ContactMaterial(
            groundMaterial,
            playerMaterial,
            {
                friction: 0.0,
                restitution: 0.0,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        this.world.addContactMaterial(this.groundContactMaterial);

        // Fear system for effects
        this.fearLevel = 0;
        this.fearEffects = {
            shakingIntensity: 0,
            lastShake: null
        };

        // State flags
        this.spawnFrozen = false;
        this.physicsStabilizing = false;
        this.stabilizationTimer = 0;

        this.setupDevControls();
        console.log('🔧 CannonPhysicsManager initialized for Character');
    }

    updateDevMode() {
        if (this.devModeLight) {
            if (this.devMode) {
                this.devModeLight.intensity = 1.0;
                console.log('☀️ Dev mode lighting: ON');
            } else {
                this.devModeLight.intensity = 0;
                console.log('🌙 Dev mode lighting: OFF');
            }
        }
    }

    setupDevControls() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'F8') {
                this.spawnFrozen = !this.spawnFrozen;
                if (this.spawnFrozen) {
                    this.playerBody.type = CANNON.Body.KINEMATIC;
                    this.playerBody.velocity.set(0, 0, 0);
                    console.log('🔒 SPAWN FROZEN');
                } else {
                    this.playerBody.type = CANNON.Body.DYNAMIC;
                    console.log('🔓 SPAWN UNFROZEN');
                }
            }
            if (e.code === 'F9') {
                this.devMode = !this.devMode;
                this.updateDevMode();
                console.log(`🔧 Dev mode: ${this.devMode ? 'ON' : 'OFF'}`);
            }
            if (e.code === 'F10' && this.devMode) {
                this.fixedYMode = !this.fixedYMode;
                if (this.fixedYMode) {
                    this.fixedYHeight = Math.max(0, this.character.position.y);
                    this.playerBody.type = CANNON.Body.KINEMATIC;
                    this.playerBody.velocity.set(0, 0, 0);
                    console.log(`✈️ Fixed Y Mode: ON at Y=${this.fixedYHeight.toFixed(2)}`);
                } else {
                    this.playerBody.type = CANNON.Body.DYNAMIC;
                    console.log('✈️ Fixed Y Mode: OFF');
                }
            }
            if (e.code === 'F11' && this.devMode) {
                this.togglePhysicsDebug();
            }
        });
    }

    tick(delta, inputs) {
        const safeInputs = inputs || {};

        if (this.spawnFrozen) return;

        if (this.physicsStabilizing) {
            this.stabilizationTimer -= delta;
            if (this.stabilizationTimer <= 0) {
                this.playerBody.type = CANNON.Body.DYNAMIC;
                this.physicsStabilizing = false;
                console.log('✅ Physics stabilization complete');
            } else {
                return;
            }
        }

        this.world.step(delta);

        if (this.noclipMode) {
             this.handleNoclipMode(safeInputs, delta);
        } else if (this.fixedYMode && this.devMode) {
            this.handleFixedYMode(safeInputs, delta);
        } else if (this.flyMode && this.devMode) {
            this.handleFlyMode(safeInputs, delta);
        } else {
            this.handleNormalMovement(safeInputs, delta);
        }
        
        // Sync the 3D models with the physics simulation
        this.syncModelsToPhysics();

        this.updateFearEffects(delta);

        if (this.debugEnabled && this.debugRenderer) {
            this.debugRenderer.update();
        }
    }

    handleNormalMovement(inputs, delta) {
        if (inputs.isCrouching) this.movementSpeed = this.maxSpeed.crouch;
        else if (inputs.isRunning) this.movementSpeed = this.maxSpeed.run;
        else this.movementSpeed = this.maxSpeed.walk;

        // Get the direction the camera is facing
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);

        // Project the direction onto the XZ plane and normalize it
        const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
        
        // Calculate the right vector by taking the cross product of the forward vector and the world's up vector
        const right = new THREE.Vector3().crossVectors(forward, this.camera.up);

        const movement = new THREE.Vector3();
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right); // FIX: Was .sub()
        if (inputs.moveLeft) movement.sub(right);  // FIX: Was .add()

        if (movement.length() > 0) {
            movement.normalize().multiplyScalar(this.movementSpeed);
            this.playerBody.velocity.x = movement.x;
            this.playerBody.velocity.z = movement.z;
            this.isMoving = true;
        } else {
            // Apply friction
            this.playerBody.velocity.x *= 0.5;
            this.playerBody.velocity.z *= 0.5;
            this.isMoving = false;
        }

        const maxVel = this.movementSpeed * 1.5;
        this.playerBody.velocity.x = Math.max(-maxVel, Math.min(maxVel, this.playerBody.velocity.x));
        this.playerBody.velocity.z = Math.max(-maxVel, Math.min(maxVel, this.playerBody.velocity.z));
    }


    handleFixedYMode(inputs, delta) {
        const speed = this.maxSpeed.fly;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.character.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.character.quaternion);
        
        const movement = new THREE.Vector3();
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);

        if (movement.length() > 0) {
            movement.normalize().multiplyScalar(speed * delta);
            this.playerBody.position.x += movement.x;
            this.playerBody.position.z += movement.z;
        }
        
        if (inputs.jump) this.fixedYHeight += speed * delta;
        if (inputs.isCrouching) this.fixedYHeight -= speed * delta;
        
        this.playerBody.position.y = this.fixedYHeight;
    }

    handleFlyMode(inputs, delta) {
        const speed = this.maxSpeed.fly;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        
        const right = new THREE.Vector3().crossVectors(this.camera.up, forward);

        const movement = new THREE.Vector3();
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.sub(right);
        if (inputs.moveLeft) movement.add(right);
        if (inputs.flyUp) movement.y += 1;
        if (inputs.flyDown) movement.y -= 1;

        if (movement.length() > 0) {
            movement.normalize().multiplyScalar(speed * delta);
            this.playerBody.position.x += movement.x;
            this.playerBody.position.y += movement.y;
            this.playerBody.position.z += movement.z;
        }
    }
    
    handleNoclipMode(inputs, delta) {
        const speed = this.maxSpeed.fly;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        
        const right = new THREE.Vector3().crossVectors(this.camera.up, forward);
    
        const movement = new THREE.Vector3();
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.sub(right);
        if (inputs.moveLeft) movement.add(right);
        if (inputs.jump) movement.y += 1;
        if (inputs.isCrouching) movement.y -= 1;
    
        if (movement.length() > 0) {
            movement.normalize().multiplyScalar(speed * delta);
            this.camera.position.add(movement);
            this.playerBody.position.copy(this.camera.position);
            this.playerBody.position.y -= this.playerHeight / 2;
        }
    }

    syncModelsToPhysics() {
        // Update the 3D character model to the physics body's position
        this.character.position.copy(this.playerBody.position);
        this.character.position.y -= this.playerHeight / 2; // Adjust for model's pivot point at its feet

        // The camera's rotation is handled by PlayerControls. We just need to set its position
        // relative to the character's new position (e.g., at head height).
        this.camera.position.copy(this.character.position);
        this.camera.position.y += this.playerHeight * 0.9; // Position camera near the character's head
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

    addBody(body) {
        this.world.addBody(body);
    }

    removeBody(body) {
        this.world.removeBody(body);
    }

    createBoxBody(position, size) {
        if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z) || isNaN(size.x) || isNaN(size.y) || isNaN(size.z)) {
            console.error('❌ Cannot create box body: Invalid position or size (NaN)');
            return null;
        }
        if (size.x < 0.01 || size.y < 0.01 || size.z < 0.01) {
            return null; // Skip flat objects
        }
        const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
        const body = new CANNON.Body({ mass: 0, material: new CANNON.Material('ground') });
        body.addShape(shape);
        body.position.set(position.x, position.y, position.z);
        return body;
    }

    teleportTo(position) {
        if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
            console.error('❌ Cannot teleport: Invalid position (NaN)');
            return;
        }

        this.playerBody.type = CANNON.Body.KINEMATIC;
        this.playerBody.position.set(position.x, position.y, position.z);
        this.playerBody.velocity.set(0, 0, 0);

        this.syncModelsToPhysics(); // Immediately update model and camera

        this.physicsStabilizing = true;
        this.stabilizationTimer = 0.05;

        console.log(`📍 Teleported character to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
        console.log(`⏸️ Physics stabilizing for 50ms...`);
    }

    emergencyRescue() {
        const currentPos = this.character.position;
        const safeHeight = Math.max(0, currentPos.y);

        console.log('🚁 Emergency rescue activated!');
        this.fixedYMode = true;
        this.fixedYHeight = safeHeight;
        this.playerBody.type = CANNON.Body.KINEMATIC;
        this.playerBody.velocity.set(0, 0, 0);
        this.playerBody.position.y = this.fixedYHeight;
        
        this.syncModelsToPhysics();
        
        console.log(`✅ Rescued! Now at Y=${this.fixedYHeight.toFixed(2)}`);
        console.log('✈️ Fixed Y Mode enabled - use F10 to disable.');
    }

    increaseFear(amount) { this.fearLevel = Math.min(100, this.fearLevel + amount); }
    decreaseFear(amount) { this.fearLevel = Math.max(0, this.fearLevel - amount); }
    getFearLevel() { return this.fearLevel; }
    getVelocityMagnitude() { const vel = this.playerBody.velocity; return new THREE.Vector2(vel.x, vel.z).length(); }

    getMovementState() {
        return {
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
            position: this.character.position.clone(),
            velocity: new THREE.Vector3(this.playerBody.velocity.x, this.playerBody.velocity.y, this.playerBody.velocity.z),
            isMoving: this.isMoving,
            fearLevel: this.fearLevel,
            movementSpeed: this.movementSpeed,
            devMode: this.devMode,
            flyMode: this.flyMode,
            fixedYMode: this.fixedYMode,
            fixedYHeight: this.fixedYHeight,
            physicsDebug: this.debugEnabled,
        };
    }

    setGravity(gravity) { this.world.gravity.set(0, gravity, 0); }
    setMovementSpeeds(walk, run, crouch, fly) { this.maxSpeed = { walk, run, crouch, fly }; }
    setNoclip(enabled) { this.noclipMode = enabled; }

    togglePhysicsDebug() {
        this.debugEnabled = !this.debugEnabled;
        if (this.debugEnabled && !this.debugRenderer) {
            this.createSimpleDebugRenderer();
        }
        if (this.debugRenderer) {
            this.debugRenderer.group.visible = this.debugEnabled;
        }
        console.log(`🔍 Physics Debug: ${this.debugEnabled ? 'ON' : 'OFF'}`);
    }

    createSimpleDebugRenderer() {
        const scene = this.camera.parent;
        if (!scene) return;

        const debugGroup = new THREE.Group();
        debugGroup.name = 'physics_debug';

        for (const body of this.world.bodies) {
            if (body.shapes.length > 0) {
                const shape = body.shapes[0];
                let geometry;
                if (shape.type === CANNON.Shape.types.BOX) {
                    const { x, y, z } = shape.halfExtents;
                    geometry = new THREE.BoxGeometry(x * 2, y * 2, z * 2);
                } else if (shape.type === CANNON.Shape.types.SPHERE) {
                    geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
                }

                if (geometry) {
                    const material = new THREE.MeshBasicMaterial({
                        color: body === this.playerBody ? 0x00ff00 : 0xff0000,
                        wireframe: true
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.userData.body = body; // Link mesh to body
                    debugGroup.add(mesh);
                }
            }
        }
        scene.add(debugGroup);

        this.debugRenderer = {
            group: debugGroup,
            update: () => {
                debugGroup.children.forEach(mesh => {
                    if (mesh.userData.body) {
                        mesh.position.copy(mesh.userData.body.position);
                        mesh.quaternion.copy(mesh.userData.body.quaternion);
                    }
                });
            }
        };
    }

    dispose() {
        if (this.debugRenderer && this.debugRenderer.group) {
            const scene = this.camera.parent;
            if (scene) {
                scene.remove(this.debugRenderer.group);
            }
        }
        this.world.removeBody(this.playerBody);
        console.log('🧹 CannonPhysicsManager disposed');
    }
}

export { CannonPhysicsManager };