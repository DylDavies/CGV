// src/systems/RapierPhysicsManager.js - Rapier physics integration with full feature parity to Cannon

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

class RapierPhysicsManager {
    constructor(scene, camera, devModeLight = null) {
        this.scene = scene;
        this.camera = camera;
        this.devModeLight = devModeLight;

        // Create Rapier world with Cannon-matching gravity
        const gravity = new RAPIER.Vector3(0.0, -15, 0.0); // Match Cannon's gravity
        this.world = new RAPIER.World(gravity);

        this.playerHeight = 1.5;
        this.playerRadius = 0.35;

        // Create player rigid body (kinematic for character controller)
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
            this.camera.position.x,
            this.camera.position.y - this.playerHeight / 2,
            this.camera.position.z
        );
        this.playerBody = this.world.createRigidBody(rigidBodyDesc);

        // Create capsule collider
        const capsuleHalfHeight = this.playerHeight / 2 - this.playerRadius;
        const colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHalfHeight, this.playerRadius);
        this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);

        // Character controller - less smooth for more realistic feel
        this.characterController = this.world.createCharacterController(0.02);
        this.characterController.enableAutostep(0.3, 0.2, true); // Reduced for less smooth stairs
        this.characterController.enableSnapToGround(0.3); // Reduced snap distance for more realistic ground feel
        this.characterController.setApplyImpulsesToDynamicBodies(true);

        // Movement properties - adjusted for more realistic feel
        this.maxSpeed = {
            walk: 4.5,
            run: 7.0,
            fly: 10.0
        };

        this.movementSpeed = this.maxSpeed.walk;

        // State tracking
        this.isMoving = false;
        this.verticalVelocity = 0;
        this.isOnGround = false;
        this.canJump = false;

        // Developer mode
        this.devMode = false;
        this.flyMode = false;
        this.noclipMode = false;
        this.fixedYMode = false;
        this.fixedYHeight = 0;

        // Physics debugging
        this.debugRenderer = null;
        this.debugEnabled = false;

        // Label renderer (for compatibility with Loop.js)
        this.labelRenderer = null;

        // Head bob system - DISABLED
        this.headBob = {
            enabled: false,
            walkIntensity: 0.0,
            runIntensity: 0.0,
            crouchIntensity: 0.0,
            walkFrequency: 0.0,
            runFrequency: 0.0,
            crouchFrequency: 0.0,
            time: 0,
            offset: new THREE.Vector3()
        };

        // Fear system (for horror effects)
        this.fearLevel = 0;
        this.fearEffects = {
            shakingIntensity: 0,
            lastShake: null
        };

        // Debug spawn freeze
        this.spawnFrozen = false;

        // Physics stabilization after teleport
        this.physicsStabilizing = false;
        this.stabilizationTimer = 0;

        // Store all physics bodies for management
        this.physicsBodies = [];

        this.setupDevControls();
        console.log('🔧 RapierPhysicsManager initialized with full feature parity');
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

    setupDevControls() {
        document.addEventListener('keydown', (e) => {
            // Toggle spawn freeze with F8
            if (e.code === 'F8') {
                this.spawnFrozen = !this.spawnFrozen;

                if (this.spawnFrozen) {
                    this.verticalVelocity = 0;
                    console.log('🔒 SPAWN FROZEN - Position locked for debugging');
                    console.log(`📍 Current position: X=${this.camera.position.x.toFixed(2)}, Y=${this.camera.position.y.toFixed(2)}, Z=${this.camera.position.z.toFixed(2)}`);
                    console.log('💡 Press F8 again to unfreeze');
                } else {
                    console.log('🔓 SPAWN UNFROZEN - Physics enabled');
                }
            }

            // Toggle dev mode with F9
            if (e.code === 'F9') {
                this.devMode = !this.devMode;
                this.updateDevMode();
                console.log(`🔧 Developer mode: ${this.devMode ? 'ON' : 'OFF'}`);

                // Show dev mode help
                if (this.devMode) {
                    console.log('🔧 Dev Mode Controls:');
                    console.log('  F8 - Toggle Spawn Freeze (lock position for debugging)');
                    console.log('  F10 - Toggle Fixed Y Mode (constant height flying)');
                    console.log('  F11 - Toggle Physics Debug Renderer');
                }
            }

            // Toggle fixed Y mode with F10 (only in dev mode)
            if (e.code === 'F10' && this.devMode) {
                this.fixedYMode = !this.fixedYMode;

                if (this.fixedYMode) {
                    // Set to safe height (at least Y=0 or current position, whichever is higher)
                    this.fixedYHeight = Math.max(0, this.camera.position.y);
                    this.verticalVelocity = 0;

                    console.log(`✈️ Fixed Y Mode: ON (height locked at Y=${this.fixedYHeight.toFixed(2)})`);
                    console.log(`💡 Use SPACE to go up, SHIFT to go down`);
                } else {
                    console.log('✈️ Fixed Y Mode: OFF');
                }
            }

            // Toggle physics debug with F11 (only in dev mode)
            if (e.code === 'F11' && this.devMode) {
                this.togglePhysicsDebug();
            }
        });
    }

    tick(delta, inputs) {
        const safeInputs = inputs || {};

        // If spawn frozen, skip all physics
        if (this.spawnFrozen) {
            return;
        }

        // Handle physics stabilization period after teleport
        if (this.physicsStabilizing) {
            this.stabilizationTimer -= delta;

            if (this.stabilizationTimer <= 0) {
                this.physicsStabilizing = false;
                console.log('✅ Physics stabilization complete, physics enabled');
            } else {
                // Skip physics entirely during stabilization
                return;
            }
        }

        // Step the physics world
        this.world.step();

        // Handle different movement modes
        if (this.noclipMode) {
            this.handleNoclipMode(safeInputs, delta);
        } else if (this.fixedYMode && this.devMode) {
            this.handleFixedYMode(safeInputs, delta);
        } else if (this.flyMode && this.devMode) {
            this.handleFlyMode(safeInputs, delta);
        } else {
            this.handleNormalMovement(safeInputs, delta);
        }

        // Update camera position based on physics body
        this.syncCameraToPhysicsBody();

        // Apply head bob and fear effects
        this.updateHeadBob(delta);
        this.updateFearEffects(delta);

        // Update physics debug renderer
        if (this.debugEnabled && this.debugRenderer) {
            this.debugRenderer.update();
        }
    }

    handleNormalMovement(inputs, delta) {
        // Determine movement speed (no crouching)
        if (inputs.isRunning) {
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

        // Calculate horizontal movement
        const horizontalMovement = new THREE.Vector3();
        if (inputs.moveForward) horizontalMovement.add(forward);
        if (inputs.moveBackward) horizontalMovement.sub(forward);
        if (inputs.moveRight) horizontalMovement.add(right);
        if (inputs.moveLeft) horizontalMovement.sub(right);

        // Check if player is trying to move BEFORE scaling by delta
        const hasMovementInput = horizontalMovement.length() > 0.01;
        this.isMoving = hasMovementInput;

        if (hasMovementInput) {
            horizontalMovement.normalize().multiplyScalar(this.movementSpeed * delta);
        }

        // Ground detection
        this.isOnGround = this.characterController.computedGrounded();

        if (this.isOnGround) {
            this.verticalVelocity = -1; // Small downward force to stay grounded
            this.canJump = true;
        } else {
            this.verticalVelocity += this.world.gravity.y * delta;
            this.canJump = false;
        }

        // No jumping - just let gravity work naturally (matching Cannon behavior)

        // Calculate desired movement
        const desiredMovement = new THREE.Vector3(
            horizontalMovement.x,
            this.verticalVelocity * delta,
            horizontalMovement.z
        );

        // Apply character controller movement
        this.characterController.computeColliderMovement(this.playerCollider, desiredMovement);
        const correctedMovement = this.characterController.computedMovement();
        const currentPosition = this.playerBody.translation();

        this.playerBody.setNextKinematicTranslation({
            x: currentPosition.x + correctedMovement.x,
            y: currentPosition.y + correctedMovement.y,
            z: currentPosition.z + correctedMovement.z
        });
    }

    handleFixedYMode(inputs, delta) {
        // Movement at constant Y height - perfect for exploring/flying around
        const speed = this.maxSpeed.fly;

        // Get camera's forward and right vectors (flatten to horizontal plane)
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.y = 0; // Remove vertical component
        forward.normalize();

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calculate horizontal movement
        const movement = new THREE.Vector3();

        if (inputs.moveForward) movement.add(forward);
        if (inputs.moveBackward) movement.sub(forward);
        if (inputs.moveRight) movement.add(right);
        if (inputs.moveLeft) movement.sub(right);

        // Apply horizontal movement
        if (movement.length() > 0) {
            movement.normalize();
            movement.multiplyScalar(speed * delta);

            const currentPosition = this.playerBody.translation();
            this.playerBody.setNextKinematicTranslation({
                x: currentPosition.x + movement.x,
                y: this.fixedYHeight - this.playerHeight / 2,
                z: currentPosition.z + movement.z
            });
        }

        // Allow adjusting the fixed height with space/shift
        if (inputs.jump) {
            this.fixedYHeight += speed * delta;
        }
        if (inputs.isCrouching) {
            this.fixedYHeight -= speed * delta;
        }
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

            const currentPosition = this.playerBody.translation();
            this.playerBody.setNextKinematicTranslation({
                x: currentPosition.x + movement.x,
                y: currentPosition.y + movement.y,
                z: currentPosition.z + movement.z
            });
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
            this.playerBody.setNextKinematicTranslation({
                x: this.camera.position.x,
                y: this.camera.position.y - this.playerHeight / 2,
                z: this.camera.position.z
            });
        }
    }

    syncCameraToPhysicsBody() {
        // Update camera position based on physics body
        const position = this.playerBody.translation();
        this.camera.position.x = position.x;
        this.camera.position.y = position.y + this.playerHeight / 2;
        this.camera.position.z = position.z;
    }

    updateHeadBob(delta) {
        if (!this.headBob.enabled || this.flyMode || this.noclipMode || this.fixedYMode) return;

        // Remove previous head bob
        this.camera.position.sub(this.headBob.offset);
        this.headBob.offset.set(0, 0, 0);

        if (this.isMoving && this.isOnGround) {
            // Determine intensity and frequency based on movement state
            let intensity, frequency;

            if (this.movementSpeed >= this.maxSpeed.run) {
                // Running
                intensity = this.headBob.runIntensity;
                frequency = this.headBob.runFrequency;
            } else {
                // Walking
                intensity = this.headBob.walkIntensity;
                frequency = this.headBob.walkFrequency;
            }

            this.headBob.time += delta * frequency;

            // Vertical bob - sin wave for up/down motion (primary motion)
            this.headBob.offset.y = Math.sin(this.headBob.time) * intensity;

            // Horizontal bob - slower side-to-side sway
            this.headBob.offset.x = Math.sin(this.headBob.time * 0.5) * intensity * 0.6;

            // Slight forward/back motion for realism
            this.headBob.offset.z = Math.cos(this.headBob.time * 0.5) * intensity * 0.4;
        } else {
            // Reset time when not moving for smooth restart
            this.headBob.time = 0;
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

    // Body management methods
    addBody(body) {
        // Rapier bodies are automatically added to world, so we just track them
        this.physicsBodies.push(body);
    }

    removeBody(body) {
        const index = this.physicsBodies.indexOf(body);
        if (index !== -1) {
            this.physicsBodies.splice(index, 1);
        }
        this.world.removeRigidBody(body);
    }

    // Create a static box body (for walls, floors)
    createBoxBody(position, size, quaternion) {
        // This function now simply trusts the data it receives.
        // All the complex calculations are handled by the MansionLoader.

        // Basic validation
        if (!position || isNaN(position.x) || !size || isNaN(size.x) || size.x <= 0 || !quaternion || isNaN(quaternion.x)) {
            console.error('❌ [Rapier] Received invalid transform data. Aborting body creation.');
            return null;
        }

        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z)
            .setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });

        const body = this.world.createRigidBody(rigidBodyDesc);

        // Rapier's cuboid collider takes half-extents (half the size)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
        this.world.createCollider(colliderDesc, body);

        this.physicsBodies.push(body);
        return body;
    }

    teleportTo(position) {
        // Validate input position
        if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
            console.error('❌ Cannot teleport: Invalid position (NaN)');
            return;
        }

        this.playerBody.setTranslation({
            x: position.x,
            y: position.y - this.playerHeight / 2,
            z: position.z
        }, true);

        this.verticalVelocity = 0;

        this.syncCameraToPhysicsBody();

        // Start stabilization period (50ms freeze to let physics settle)
        this.physicsStabilizing = true;
        this.stabilizationTimer = 0.05; // 50ms

        console.log(`📍 Teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
        console.log(`⏸️ Physics stabilizing for 50ms...`);
    }

    // Emergency recovery function if player falls through floor
    emergencyRescue() {
        const currentPos = this.camera.position;
        const safeHeight = Math.max(0, currentPos.y);

        console.log('🚁 Emergency rescue activated!');
        console.log(`📍 Current position: Y=${currentPos.y.toFixed(2)}`);

        // Enable fixed Y mode automatically
        this.fixedYMode = true;
        this.fixedYHeight = safeHeight;
        this.verticalVelocity = 0;

        // Teleport to safe height
        this.playerBody.setTranslation({
            x: currentPos.x,
            y: this.fixedYHeight - this.playerHeight / 2,
            z: currentPos.z
        }, true);

        this.camera.position.y = this.fixedYHeight;

        console.log(`✅ Rescued! Now at Y=${this.fixedYHeight.toFixed(2)}`);
        console.log('✈️ Fixed Y Mode enabled - use SPACE/SHIFT to adjust height');
        console.log('💡 Press F10 to disable Fixed Y Mode when ready');
    }

    // Fear system methods
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
        // Rapier doesn't track velocity on kinematic bodies, so we approximate from movement state
        return this.isMoving ? this.movementSpeed : 0;
    }

    getMovementState() {
        return {
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            velocity: new THREE.Vector3(0, this.verticalVelocity, 0),
            speed: this.getVelocityMagnitude(),
            fearLevel: this.fearLevel,
            devMode: this.devMode,
            flyMode: this.flyMode
        };
    }

    getDebugInfo() {
        return {
            position: this.camera.position.clone(),
            velocity: new THREE.Vector3(0, this.verticalVelocity, 0),
            isOnGround: this.isOnGround,
            isMoving: this.isMoving,
            fearLevel: this.fearLevel,
            movementSpeed: this.movementSpeed,
            devMode: this.devMode,
            flyMode: this.flyMode,
            fixedYMode: this.fixedYMode,
            fixedYHeight: this.fixedYHeight,
            physicsDebug: this.debugEnabled,
            canJump: this.canJump
        };
    }

    setGravity(gravity) {
        this.world.gravity.y = gravity;
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

    togglePhysicsDebug() {
        this.debugEnabled = !this.debugEnabled;

        if (this.debugEnabled) {
            // Create debug renderer
            if (!this.debugRenderer) {
                console.log('💡 Creating Rapier debug renderer...');
                this.createDebugRenderer();
            } else {
                // Show existing renderer
                if (this.debugRenderer.lines) {
                    this.debugRenderer.lines.visible = true;
                }
            }
            console.log('🔍 Physics Debug: ON');
            console.log(`📊 Showing physics world debug`);
        } else {
            // Hide debug renderer
            if (this.debugRenderer && this.debugRenderer.lines) {
                this.debugRenderer.lines.visible = false;
            }
            console.log('🔍 Physics Debug: OFF');
        }
    }

    createDebugRenderer() {
        try {
            // Use Rapier's built-in debug renderer
            const material = new THREE.LineBasicMaterial({
                color: 0xffffff,
                vertexColors: true,
                linewidth: 2
            });
            const geometry = new THREE.BufferGeometry();
            const lineSegments = new THREE.LineSegments(geometry, material);

            // Make sure the debug renderer is visible and renders on top
            lineSegments.renderOrder = 999;

            this.scene.add(lineSegments);

            this.debugRenderer = {
                lines: lineSegments,
                update: () => {
                    try {
                        const { vertices, colors } = this.world.debugRender();

                        if (vertices && vertices.length > 0) {
                            this.debugRenderer.lines.geometry.setAttribute(
                                'position',
                                new THREE.BufferAttribute(vertices, 3)
                            );
                            this.debugRenderer.lines.geometry.setAttribute(
                                'color',
                                new THREE.BufferAttribute(colors, 4)
                            );

                            // Make sure geometry updates
                            this.debugRenderer.lines.geometry.attributes.position.needsUpdate = true;
                            this.debugRenderer.lines.geometry.attributes.color.needsUpdate = true;
                        }
                    } catch (error) {
                        console.error('Error updating debug renderer:', error);
                    }
                }
            };

            console.log('🔍 Rapier Debug Renderer created');
            console.log(`📊 Total physics bodies to visualize: ${this.physicsBodies.length}`);
        } catch (error) {
            console.error('❌ Failed to create debug renderer:', error);
        }
    }

    dispose() {
        // Clean up debug renderer
        if (this.debugRenderer && this.debugRenderer.lines) {
            if (this.scene) {
                this.scene.remove(this.debugRenderer.lines);
            }
        }

        // Clean up physics world
        this.world.removeRigidBody(this.playerBody);

        // Remove all tracked bodies
        this.physicsBodies.forEach(body => {
            try {
                this.world.removeRigidBody(body);
            } catch (e) {
                // Body may already be removed
            }
        });
        this.physicsBodies = [];

        console.log('🧹 RapierPhysicsManager disposed');
    }
}

export { RapierPhysicsManager };