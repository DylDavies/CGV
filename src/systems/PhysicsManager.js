// src/systems/PhysicsManager.js - Fixed jumping and ground detection

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
            crouch: 2.0,
            fly: 10.0  // Added for dev mode
        };
        
        // Physics constants
        this.gravity = -15;  // Reduced from -9.81 for better feel
        this.jumpForce = 8.0;
        this.friction = 0.85;
        this.airResistance = 0.98;
        
        // Player state
        this.isOnGround = false;
        this.isMoving = false;
        this.movementSpeed = this.maxSpeed.walk;
        
        // FIXED: Ground detection buffer to prevent bouncing
        this.groundBuffer = 0.1;
        this.lastGroundY = 3;  // Default eye height
        this.groundStickDistance = 0.5;  // How close to ground to "stick"
        
        // Developer mode
        this.devMode = false;
        this.flyMode = false;
        
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
            breathingRate: 1.0,
            heartbeatRate: 1.0,
            lastShake: null
        };
        
        // Default input state
        this.defaultInputs = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            isRunning: false,
            isCrouching: false,
            flyUp: false,    // Added for dev mode
            flyDown: false   // Added for dev mode
        };
        
        this.setupDevControls();
        console.log('🔧 PhysicsManager initialized (with fixes)');
    }
    
    setupDevControls() {
        document.addEventListener('keydown', (e) => {
            // Toggle dev mode with F9
            if (e.code === 'F9') {
                this.devMode = !this.devMode;
                console.log(`🔧 Developer mode: ${this.devMode ? 'ON' : 'OFF'}`);
                if (this.devMode) {
                    console.log('Press F10 to toggle fly mode, Q/E to fly up/down');
                }
            }
            
            // Toggle fly mode with F10 (only in dev mode)
            if (e.code === 'F10' && this.devMode) {
                this.flyMode = !this.flyMode;
                console.log(`✈️ Fly mode: ${this.flyMode ? 'ON' : 'OFF'}`);
                if (this.flyMode) {
                    this.velocity.y = 0; // Stop falling when entering fly mode
                }
            }
        });
    }

    setGravity(gravity) {
        this.gravity = gravity;
        console.log(`🌍 Gravity set to: ${gravity}`);
    }

    setMovementSpeeds(walk, run, crouch, fly = 10) {
        this.maxSpeed.walk = walk;
        this.maxSpeed.run = run;
        this.maxSpeed.crouch = crouch;
        this.maxSpeed.fly = fly;
        console.log(`🏃 Movement speeds updated`);
    }

    tick(delta, inputs) {
        const safeInputs = { ...this.defaultInputs, ...(inputs || {}) };
        
        // Add dev mode fly controls
        if (this.devMode && this.flyMode) {
            // Handle fly mode separately
            this.handleFlyMode(safeInputs, delta);
            return;
        }
        
        // FIXED: Better ground detection with stabilization
        this.updateGroundStatus();
        
        // Calculate intended movement
        const intendedMovement = this.calculateMovement(safeInputs, delta);
        
        // Apply physics
        this.applyPhysics(intendedMovement, safeInputs, delta);
        
        // Check collisions and move
        this.moveWithCollisionDetection(delta);
        
        // Update effects
        this.updateHeadBob(delta);
        this.updateFearEffects(delta);
        
        // FIXED: Stabilize on ground to prevent bouncing
        this.stabilizeOnGround();
    }
    
    updateGroundStatus() {
        if (this.collisionSystem && this.collisionSystem.checkGroundCollision) {
            const groundInfo = this.collisionSystem.checkGroundCollision(this.camera.position);
            
            // FIXED: Use a buffer zone to determine if on ground
            const distanceToGround = this.camera.position.y - groundInfo.groundHeight;
            
            // Consider on ground if within reasonable distance
            if (groundInfo.isOnGround && distanceToGround <= 3.2) {
                this.isOnGround = true;
                this.lastGroundY = groundInfo.groundHeight + 3; // Eye height above ground
            } else if (distanceToGround > 4) {
                this.isOnGround = false;
            }
        } else {
            // Fallback
            this.isOnGround = this.camera.position.y <= 3.1;
            this.lastGroundY = 3;
        }
    }
    
    stabilizeOnGround() {
        // FIXED: Prevent micro-bouncing by snapping to ground when very close
        if (this.isOnGround) {
            const targetY = this.lastGroundY;
            const currentY = this.camera.position.y;
            const diff = Math.abs(currentY - targetY);
            
            // If very close to target height, snap to it
            if (diff < 0.2) {
                this.camera.position.y = targetY;
                // Kill vertical velocity if moving slowly
                if (Math.abs(this.velocity.y) < 1) {
                    this.velocity.y = 0;
                }
            } else if (currentY < targetY) {
                // If below ground level, push up
                this.camera.position.y = targetY;
                this.velocity.y = Math.max(0, this.velocity.y);
            }
        }
    }
    
    handleFlyMode(inputs, delta) {
        // No gravity in fly mode
        this.movementSpeed = this.maxSpeed.fly;
        
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
        
        // Vertical movement (Q/E keys)
        if (inputs.flyUp || inputs.jump) movement.y += 1;
        if (inputs.flyDown || inputs.isCrouching) movement.y -= 1;
        
        // Normalize and apply speed
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(this.movementSpeed);
        }
        
        // Direct position update for fly mode
        this.camera.position.add(movement.multiplyScalar(delta));
        
        // Still check collisions
        if (this.collisionSystem) {
            const currentPos = this.camera.position.clone();
            const intendedPos = this.camera.position.clone();
            const result = this.collisionSystem.checkCollision(currentPos, intendedPos);
            if (result.hasCollision) {
                this.camera.position.copy(result.position);
            }
        }
    }

    calculateMovement(inputs, delta) {
        if (inputs.isCrouching) {
            this.movementSpeed = this.maxSpeed.crouch;
        } else if (inputs.isRunning) {
            this.movementSpeed = this.maxSpeed.run;
        } else {
            this.movementSpeed = this.maxSpeed.walk;
        }

        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const movement = new THREE.Vector3();
        
        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);
        
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
        // FIXED: More controlled gravity application
        if (!this.isOnGround) {
            // Apply gravity
            this.velocity.y += this.gravity * delta;
            
            // Air control (reduced)
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, intendedMovement.x * 0.3, delta * 5);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, intendedMovement.z * 0.3, delta * 5);
            
            // Air resistance
            this.velocity.x *= Math.pow(this.airResistance, delta * 60);
            this.velocity.z *= Math.pow(this.airResistance, delta * 60);
        } else {
            // Ground movement - direct control
            this.velocity.x = intendedMovement.x;
            this.velocity.z = intendedMovement.z;
            
            // FIXED: Only allow jump if truly on ground and not already moving up
            if (inputs.jump && this.velocity.y <= 0) {
                this.velocity.y = this.jumpForce;
                this.isOnGround = false;
                console.log('🦘 Jump!');
            } else {
                // Apply ground friction to vertical velocity
                this.velocity.y *= 0.5;
            }
        }

        // Clamp velocities
        const maxVel = this.movementSpeed * 2;
        this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxVel, maxVel);
        this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxVel, maxVel);
        this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -20, 15);
    }

    moveWithCollisionDetection(delta) {
        const currentPosition = this.camera.position.clone();
        const intendedPosition = currentPosition.clone().add(
            this.velocity.clone().multiplyScalar(delta)
        );

        if (this.collisionSystem && this.collisionSystem.checkCollision) {
            const collisionResult = this.collisionSystem.checkCollision(
                currentPosition, 
                intendedPosition
            );

            this.camera.position.copy(collisionResult.position);

            if (collisionResult.hasCollision) {
                const collisionDirection = new THREE.Vector3()
                    .subVectors(intendedPosition, collisionResult.position)
                    .normalize();
                
                const velocityInCollisionDir = this.velocity.dot(collisionDirection);
                if (velocityInCollisionDir > 0) {
                    this.velocity.sub(
                        collisionDirection.multiplyScalar(velocityInCollisionDir)
                    );
                }
            }
        } else {
            this.camera.position.copy(intendedPosition);
        }
    }

    updateHeadBob(delta) {
        if (!this.headBob.enabled || this.flyMode) return;

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

    teleportTo(position) {
        this.camera.position.copy(position);
        this.velocity.set(0, 0, 0);
        this.lastGroundY = position.y;
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
        return new THREE.Vector2(this.velocity.x, this.velocity.z).length();
    }

    getMovementState() {
        return {
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            velocity: this.velocity.clone(),
            speed: this.getVelocityMagnitude(),
            fearLevel: this.fearLevel,
            devMode: this.devMode,
            flyMode: this.flyMode
        };
    }

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
            lastGroundY: this.lastGroundY,
            devMode: this.devMode,
            flyMode: this.flyMode
        };
    }
}

export { PhysicsManager };