// src/systems/PhysicsManager.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class PhysicsManager {
    constructor(collisionSystem, camera) {
        this.collisionSystem = collisionSystem;
        this.camera = camera;

        // Physics properties
        this.gravity = -20.0; // Gravity acceleration (m/s²)
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();

        // Movement properties
        this.walkSpeed = 3.0;
        this.runSpeed = 6.0;
        this.crouchSpeed = 1.5;
        this.jumpSpeed = 8.0;

        // Player state
        this.isOnGround = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.isExhausted = false;

        // Stamina system for horror tension
        this.maxStamina = 100;
        this.currentStamina = this.maxStamina;
        this.staminaRegenRate = 15; // per second
        this.staminaDrainRate = 25; // per second when running

        // Fear system affects movement
        this.fearLevel = 0; // 0-100
        this.fearMovementPenalty = 0; // Applied to movement speed

        // Head bobbing for immersion
        this.headBob = {
            enabled: true,
            time: 0,
            intensity: 0.03,
            frequency: 8.0,
            originalY: 0
        };

        // Smooth movement interpolation
        this.targetPosition = new THREE.Vector3();
        this.currentPosition = new THREE.Vector3();
        this.positionLerpFactor = 0.85;

        // No slope handling - flat floors only

        // Initialize position
        this.currentPosition.copy(this.camera.position);
        this.headBob.originalY = this.camera.position.y;
    }

    // Update physics each frame
    tick(delta, inputs = {}) {
        if (delta > 0.1) delta = 0.1; // Cap delta to prevent large jumps

        // Update player state based on inputs
        this.updatePlayerState(inputs);

        // Update stamina system
        this.updateStamina(delta);

        // Apply movement
        this.updateMovement(delta, inputs);

        // Apply gravity and ground detection
        this.updateGravity(delta);

        // Update position with collision detection
        this.updatePosition(delta);

        // Update head bobbing
        this.updateHeadBob(delta);

        // Update fear effects
        this.updateFearEffects(delta);
    }

    updatePlayerState(inputs) {
        // Update running state
        this.isRunning = inputs.isRunning && !this.isExhausted && this.isOnGround;

        // Update crouching state
        this.isCrouching = inputs.isCrouching;

        // Exhaustion check
        if (this.currentStamina <= 0) {
            this.isExhausted = true;
        } else if (this.currentStamina > 30) {
            this.isExhausted = false;
        }
    }

    updateStamina(delta) {
        if (this.isRunning && this.isOnGround) {
            // Drain stamina when running
            this.currentStamina = Math.max(0, this.currentStamina - this.staminaDrainRate * delta);
        } else {
            // Regenerate stamina when not running
            this.currentStamina = Math.min(this.maxStamina, this.currentStamina + this.staminaRegenRate * delta);
        }

        // Fear increases stamina drain
        if (this.fearLevel > 50) {
            const fearDrain = (this.fearLevel - 50) * 0.1 * delta;
            this.currentStamina = Math.max(0, this.currentStamina - fearDrain);
        }
    }

    updateMovement(delta, inputs) {
        // Calculate target movement speed
        let targetSpeed = this.walkSpeed;

        if (this.isCrouching) {
            targetSpeed = this.crouchSpeed;
        } else if (this.isRunning) {
            targetSpeed = this.runSpeed;
        }

        // Apply fear penalty
        targetSpeed *= (1 - this.fearMovementPenalty);

        // Apply exhaustion penalty
        if (this.isExhausted) {
            targetSpeed *= 0.6;
        }

        // Calculate movement direction in local space
        const movement = new THREE.Vector3();

        if (inputs.moveForward) movement.z += 1;  // Fixed: forward should be positive Z
        if (inputs.moveBackward) movement.z -= 1; // Fixed: backward should be negative Z
        if (inputs.moveLeft) movement.x -= 1;
        if (inputs.moveRight) movement.x += 1;

        // Normalize diagonal movement
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(targetSpeed);

            // Transform movement relative to camera direction
            // Get camera's world direction vectors
            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();

            this.camera.getWorldDirection(forward);
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            // Flatten to horizontal plane
            forward.y = 0;
            forward.normalize();
            right.y = 0;
            right.normalize();

            // Project movement onto world axes
            const moveVector = new THREE.Vector3();
            moveVector.addScaledVector(forward, movement.z);
            moveVector.addScaledVector(right, movement.x);
            moveVector.y = 0; // Keep movement horizontal

            // Set horizontal velocity
            this.velocity.x = moveVector.x;
            this.velocity.z = moveVector.z;
        } else {
            // Apply strong friction when not moving
            this.velocity.x *= 0.1;
            this.velocity.z *= 0.1;

            // Stop very small movements to prevent sliding
            if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
            if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
        }

        // Handle jumping
        if (inputs.jump && this.isOnGround && !this.isExhausted) {
            this.velocity.y = this.jumpSpeed;
            this.isOnGround = false;

            // Jumping drains stamina
            this.currentStamina = Math.max(0, this.currentStamina - 20);
        }
    }

    updateGravity(delta) {
        // Apply gravity
        this.velocity.y += this.gravity * delta;

        // Terminal velocity
        this.velocity.y = Math.max(this.velocity.y, -50);

        // Check ground collision
        const groundCheck = this.collisionSystem.checkGroundCollision(this.currentPosition);

        if (groundCheck.isOnGround) {
            if (this.velocity.y <= 0) {
                this.velocity.y = 0;
                this.isOnGround = true;

                // Only adjust height if we're falling through the floor
                const targetHeight = groundCheck.groundHeight + 1.8;
                if (this.currentPosition.y < groundCheck.groundHeight + 0.5) {
                    // Smoothly adjust to proper height instead of snapping
                    this.currentPosition.y = THREE.MathUtils.lerp(this.currentPosition.y, targetHeight, 0.1);
                }
            }
        } else {
            this.isOnGround = false;
        }
    }


    updatePosition(delta) {
        // Calculate intended position
        const deltaPosition = this.velocity.clone().multiplyScalar(delta);
        const intendedPosition = this.currentPosition.clone().add(deltaPosition);

        // Check collision and get final position
        const collisionResult = this.collisionSystem.checkCollision(this.currentPosition, intendedPosition);

        // Update position directly (no interpolation for better responsiveness)
        this.currentPosition.copy(collisionResult.position);

        // Apply position to camera
        this.camera.position.copy(this.currentPosition);

        // Handle collision feedback
        if (collisionResult.hasCollision) {
            // Reduce velocity on collision for more realistic feel
            this.velocity.multiplyScalar(0.5);

            // Add subtle screen shake on hard impacts
            if (this.velocity.length() > 5.0) {
                this.addCameraShake(0.02, 0.1);
            }
        }
    }

    updateHeadBob(delta) {
        if (!this.headBob.enabled || !this.isOnGround) return;

        const speed = new THREE.Vector2(this.velocity.x, this.velocity.z).length();

        if (speed > 0.5) {
            // Calculate bobbing based on movement speed
            let bobIntensity = this.headBob.intensity;
            let bobFrequency = this.headBob.frequency;

            if (this.isRunning) {
                bobIntensity *= 1.5;
                bobFrequency *= 1.3;
            } else if (this.isCrouching) {
                bobIntensity *= 0.5;
                bobFrequency *= 0.8;
            }

            // Apply fear effect to head bob
            if (this.fearLevel > 30) {
                bobIntensity *= 1 + (this.fearLevel * 0.01);
                bobFrequency *= 1 + (this.fearLevel * 0.005);
            }

            this.headBob.time += delta * bobFrequency * speed;

            // Calculate bob offset - only modify Y position relative to base position
            const bobOffset = Math.sin(this.headBob.time) * bobIntensity;
            this.currentPosition.y = this.headBob.originalY + bobOffset;

            // Note: Don't modify camera position directly, let updatePosition handle it
        } else {
            // Smooth return to original position when stopped
            this.headBob.originalY = THREE.MathUtils.lerp(
                this.headBob.originalY,
                this.currentPosition.y,
                delta * 5
            );
        }
    }

    updateFearEffects(delta) {
        // Calculate fear movement penalty
        this.fearMovementPenalty = Math.min(0.4, this.fearLevel * 0.004);

        // Fear causes trembling (very subtle camera movement)
        if (this.fearLevel > 60) {
            const trembleIntensity = (this.fearLevel - 60) * 0.0001;
            this.camera.position.x += (Math.random() - 0.5) * trembleIntensity;
            this.camera.position.y += (Math.random() - 0.5) * trembleIntensity;
        }

        // Gradually reduce fear over time if not in scary situation
        this.fearLevel = Math.max(0, this.fearLevel - delta * 5);
    }

    // Add camera shake effect
    addCameraShake(intensity, duration) {
        const originalPosition = this.camera.position.clone();
        const shakeStart = Date.now();

        const shake = () => {
            const elapsed = (Date.now() - shakeStart) / 1000;
            if (elapsed < duration) {
                const shakeAmount = intensity * (1 - elapsed / duration);
                this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeAmount;
                this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeAmount;
                this.camera.position.z = originalPosition.z + (Math.random() - 0.5) * shakeAmount;

                requestAnimationFrame(shake);
            } else {
                this.camera.position.copy(originalPosition);
            }
        };

        shake();
    }

    // Fear system methods
    increaseFear(amount) {
        this.fearLevel = Math.min(100, this.fearLevel + amount);
    }

    decreaseFear(amount) {
        this.fearLevel = Math.max(0, this.fearLevel - amount);
    }

    // Teleport player to specific position
    teleportTo(position) {
        this.currentPosition.copy(position);
        this.camera.position.copy(position);
        this.velocity.set(0, 0, 0);
        this.headBob.originalY = position.y;
        this.headBob.time = 0; // Reset head bob
        this.isOnGround = true; // Assume we're on ground after teleport
    }

    // Get current movement state for other systems
    getMovementState() {
        return {
            isOnGround: this.isOnGround,
            isRunning: this.isRunning,
            isCrouching: this.isCrouching,
            isExhausted: this.isExhausted,
            speed: new THREE.Vector2(this.velocity.x, this.velocity.z).length(),
            stamina: this.currentStamina,
            maxStamina: this.maxStamina,
            fearLevel: this.fearLevel,
            position: this.currentPosition.clone(),
            velocity: this.velocity.clone()
        };
    }

    // Set physics properties
    setGravity(gravity) {
        this.gravity = gravity;
    }

    setMovementSpeeds(walk, run, crouch) {
        this.walkSpeed = walk;
        this.runSpeed = run;
        this.crouchSpeed = crouch;
    }

    enableHeadBob(enabled) {
        this.headBob.enabled = enabled;
    }

    setHeadBobProperties(intensity, frequency) {
        this.headBob.intensity = intensity;
        this.headBob.frequency = frequency;
    }

    // Reset physics state
    reset() {
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.currentStamina = this.maxStamina;
        this.fearLevel = 0;
        this.isExhausted = false;
        this.headBob.time = 0;
    }

    // Cleanup
    dispose() {
        // No specific cleanup needed for physics manager
        this.reset();
    }
}

export { PhysicsManager };