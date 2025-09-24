// src/systems/PhysicsManager.js - Fixed version that handles undefined inputs

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class PhysicsManager {
    constructor(collisionSystem, camera) {
        this.collisionSystem = collisionSystem;
        this.camera = camera;
        
        // Player physics properties
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.maxSpeed = {
            walk: 5.0,
            run: 8.0,
            crouch: 2.0
        };
        
        // Physics constants
        this.gravity = -9.81;
        this.jumpForce = 8.0;
        this.friction = 0.85;
        this.airResistance = 0.98;
        
        // Player state
        this.isOnGround = false;
        this.isMoving = false;
        this.movementSpeed = this.maxSpeed.walk;
        
        // Head bob system
        this.headBob = {
            enabled: true,
            intensity: 0.02,
            frequency: 8.0,
            time: 0,
            offset: new THREE.Vector3()
        };
        
        // Fear system (for horror effects)
        this.fearLevel = 0; // 0-100
        this.fearEffects = {
            shakingIntensity: 0,
            breathingRate: 1.0,
            heartbeatRate: 1.0,
            lastShake: null
        };
        
        // Default input state (prevents undefined errors)
        this.defaultInputs = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            isRunning: false,
            isCrouching: false
        };
        
        console.log('🔧 PhysicsManager initialized');
    }

    setGravity(gravity) {
        this.gravity = gravity;
        console.log(`🌍 Gravity set to: ${gravity}`);
    }

    setMovementSpeeds(walk, run, crouch) {
        this.maxSpeed.walk = walk;
        this.maxSpeed.run = run;
        this.maxSpeed.crouch = crouch;
        console.log(`🏃 Movement speeds: walk=${walk}, run=${run}, crouch=${crouch}`);
    }

    enableHeadBob(enabled) {
        this.headBob.enabled = enabled;
        console.log(`👀 Head bob: ${enabled ? 'enabled' : 'disabled'}`);
    }

    setHeadBobProperties(intensity, frequency) {
        this.headBob.intensity = intensity;
        this.headBob.frequency = frequency;
        console.log(`👀 Head bob properties: intensity=${intensity}, frequency=${frequency}`);
    }

    tick(delta, inputs) {
        // FIXED: Ensure inputs is defined and has all required properties
        const safeInputs = { ...this.defaultInputs, ...(inputs || {}) };
        
        // Update ground collision
        if (this.collisionSystem && this.collisionSystem.checkGroundCollision) {
            const groundInfo = this.collisionSystem.checkGroundCollision(this.camera.position);
            this.isOnGround = groundInfo.isOnGround;
        } else {
            // Fallback ground detection
            this.isOnGround = this.camera.position.y <= 3; // Assume ground at y=1.8 + eye height
        }

        // Calculate intended movement
        const intendedMovement = this.calculateMovement(safeInputs, delta);
        
        // Apply physics
        this.applyPhysics(intendedMovement, safeInputs, delta);
        
        // Check collisions and move
        this.moveWithCollisionDetection(delta);
        
        // Update effects
        this.updateHeadBob(delta);
        this.updateFearEffects(delta);
        
        // Keep player above ground
        if (this.isOnGround) {
            const minY = 3; // Eye height
            if (this.camera.position.y < minY) {
                this.camera.position.y = minY;
                this.velocity.y = Math.max(0, this.velocity.y);
            }
        }
    }

    calculateMovement(inputs, delta) {
        // FIXED: All input properties are now guaranteed to exist
        if (inputs.isCrouching) {
            this.movementSpeed = this.maxSpeed.crouch;
        } else if (inputs.isRunning) {
            this.movementSpeed = this.maxSpeed.run;
        } else {
            this.movementSpeed = this.maxSpeed.walk;
        }

        // Get camera's forward and right vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        this.camera.getWorldDirection(forward);
        forward.y = 0; // Remove vertical component
        forward.normalize();
        
        // Right vector is perpendicular to forward
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calculate movement direction
        const movement = new THREE.Vector3();
        
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);
        
        // Normalize diagonal movement
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(this.movementSpeed);
            this.isMoving = true;
        } else {
            this.isMoving = false;
        }

        return movement;
    }

    applyPhysics(intendedMovement, inputs, delta) {
        // Apply gravity
        if (!this.isOnGround) {
            this.velocity.y += this.gravity * delta;
        } else {
            // Ground friction
            this.velocity.x *= Math.pow(this.friction, delta * 60);
            this.velocity.z *= Math.pow(this.friction, delta * 60);
        }

        // Apply movement to horizontal velocity
        if (this.isOnGround) {
            this.velocity.x = intendedMovement.x;
            this.velocity.z = intendedMovement.z;
        } else {
            // Air control (reduced)
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, intendedMovement.x * 0.3, delta * 5);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, intendedMovement.z * 0.3, delta * 5);
            
            // Air resistance
            this.velocity.multiplyScalar(Math.pow(this.airResistance, delta * 60));
        }

        // Handle jumping
        if (inputs.jump && this.isOnGround) {
            this.velocity.y = this.jumpForce;
            this.isOnGround = false;
            console.log('🦘 Jump!');
        }

        // Limit velocity
        const maxVel = this.movementSpeed * 2;
        this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxVel, maxVel);
        this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxVel, maxVel);
        this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -30, 15);
    }

    moveWithCollisionDetection(delta) {
        const currentPosition = this.camera.position.clone();
        const intendedPosition = currentPosition.clone().add(
            this.velocity.clone().multiplyScalar(delta)
        );

        // Check collision if collision system is available
        if (this.collisionSystem && this.collisionSystem.checkCollision) {
            const collisionResult = this.collisionSystem.checkCollision(
                currentPosition, 
                intendedPosition
            );

            // Apply the safe position
            this.camera.position.copy(collisionResult.position);

            // If we hit something, reduce velocity in that direction
            if (collisionResult.hasCollision) {
                const collisionDirection = new THREE.Vector3()
                    .subVectors(intendedPosition, collisionResult.position)
                    .normalize();
                
                // Remove velocity component in collision direction
                const velocityInCollisionDir = this.velocity.dot(collisionDirection);
                if (velocityInCollisionDir > 0) {
                    this.velocity.sub(
                        collisionDirection.multiplyScalar(velocityInCollisionDir)
                    );
                }
            }
        } else {
            // Fallback: simple movement without collision detection
            this.camera.position.copy(intendedPosition);
        }
    }

    updateHeadBob(delta) {
        if (!this.headBob.enabled) return;

        // Reset head bob offset
        this.camera.position.sub(this.headBob.offset);
        this.headBob.offset.set(0, 0, 0);

        // Apply head bob if moving on ground
        if (this.isMoving && this.isOnGround) {
            this.headBob.time += delta * this.headBob.frequency;
            
            const bobIntensity = this.headBob.intensity;
            this.headBob.offset.y = Math.sin(this.headBob.time) * bobIntensity;
            this.headBob.offset.x = Math.sin(this.headBob.time * 0.5) * bobIntensity * 0.5;
            
            // Apply speed modifier
            const speedModifier = this.movementSpeed / this.maxSpeed.walk;
            this.headBob.offset.multiplyScalar(speedModifier);
        }

        // Apply head bob offset
        this.camera.position.add(this.headBob.offset);
    }

    updateFearEffects(delta) {
        // Update fear-based camera shake
        if (this.fearLevel > 20) {
            const shakeIntensity = (this.fearLevel / 100) * 0.02;
            const shake = new THREE.Vector3(
                (Math.random() - 0.5) * shakeIntensity,
                (Math.random() - 0.5) * shakeIntensity,
                (Math.random() - 0.5) * shakeIntensity
            );
            
            // Remove previous shake
            if (this.fearEffects.lastShake) {
                this.camera.position.sub(this.fearEffects.lastShake);
            }
            
            // Apply new shake
            this.camera.position.add(shake);
            this.fearEffects.lastShake = shake;
        } else if (this.fearEffects.lastShake) {
            this.camera.position.sub(this.fearEffects.lastShake);
            this.fearEffects.lastShake = null;
        }
    }

    teleportTo(position) {
        this.camera.position.copy(position);
        this.velocity.set(0, 0, 0);
        console.log(`📍 Teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
    }

    increaseFear(amount) {
        this.fearLevel = Math.min(100, this.fearLevel + amount);
        console.log(`😰 Fear increased to: ${this.fearLevel}%`);
    }

    decreaseFear(amount) {
        this.fearLevel = Math.max(0, this.fearLevel - amount);
        console.log(`😌 Fear decreased to: ${this.fearLevel}%`);
    }

    getFearLevel() {
        return this.fearLevel;
    }

    getVelocityMagnitude() {
        return new THREE.Vector2(this.velocity.x, this.velocity.z).length();
    }

    getMovementState() {
        return {
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            velocity: this.velocity.clone(),
            speed: this.getVelocityMagnitude(),
            fearLevel: this.fearLevel
        };
    }

    // Debug methods
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`🐛 Debug mode: ${enabled ? 'enabled' : 'disabled'}`);
    }

    getDebugInfo() {
        return {
            position: this.camera.position.clone(),
            velocity: this.velocity.clone(),
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            fearLevel: this.fearLevel,
            movementSpeed: this.movementSpeed,
            hasCollisionSystem: !!this.collisionSystem
        };
    }
}

export { PhysicsManager };