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
        this.world.broadphase = new CANNON.SAPBroadphase(this.world); // Simple collision detection

        this.world.allowSleep = true;
        this.world.solver.iterations = 5;

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

        // Position at camera location
        this.playerBody.position.set(
            this.camera.position.x,
            this.camera.position.y - this.playerHeight/2,
            this.camera.position.z
        );

        this.playerBody.allowSleep = false;

        // Add player to world
        this.world.addBody(this.playerBody);

        // Movement properties
        this.maxSpeed = {
            walk: 8.0,
            run: 12.0,
            crouch: 3.0,
            fly: 10.0
        };

        this.movementSpeed = this.maxSpeed.walk;

        // State tracking
        this.isMoving = false;

        // Developer mode
        this.devMode = false;
        this.flyMode = false;
        this.noclipMode = false;
        this.fixedYMode = false; // New mode: constant Y height
        this.fixedYHeight = 0; // Store the Y height when fixed Y mode is enabled

        // Physics debugging
        this.debugRenderer = null;
        this.debugEnabled = false;

        // Ground contact detection
        const groundMaterial = new CANNON.Material('ground');
        this.groundContactMaterial = new CANNON.ContactMaterial(
            groundMaterial,
            playerMaterial,
            {
                friction: 0.0, // Zero friction for smooth movement
                restitution: 0.0, // No bounce
                contactEquationStiffness: 1e8, // Very stiff contact
                contactEquationRelaxation: 3 // Quick settling
            }
        );
        this.world.addContactMaterial(this.groundContactMaterial);

        // No ground tracking needed - fixed Y height

        // Head bob system
        this.headBob = {
            enabled: false, // Disable head bob - causing bouncing
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

        // Debug spawn freeze
        this.spawnFrozen = false;

        // Physics stabilization after teleport
        this.physicsStabilizing = false;
        this.stabilizationTimer = 0;

        this.setupDevControls();
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

    setupDevControls() {
        document.addEventListener('keydown', (e) => {
            // Toggle spawn freeze with F8
            if (e.code === 'F8') {
                this.spawnFrozen = !this.spawnFrozen;

                if (this.spawnFrozen) {
                    this.playerBody.type = CANNON.Body.KINEMATIC;
                    this.playerBody.velocity.set(0, 0, 0);
                    console.log('🔒 SPAWN FROZEN - Position locked for debugging');
                    console.log(`📍 Current position: X=${this.camera.position.x.toFixed(2)}, Y=${this.camera.position.y.toFixed(2)}, Z=${this.camera.position.z.toFixed(2)}`);
                    console.log('💡 Press F8 again to unfreeze');
                } else {
                    this.playerBody.type = CANNON.Body.DYNAMIC;
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

                    // Disable gravity for player
                    this.playerBody.type = CANNON.Body.KINEMATIC;
                    this.playerBody.velocity.set(0, 0, 0);

                    // Immediately set position to fixed height
                    this.playerBody.position.y = this.fixedYHeight - this.playerHeight/2;
                    this.camera.position.y = this.fixedYHeight;

                    console.log(`✈️ Fixed Y Mode: ON (height locked at Y=${this.fixedYHeight.toFixed(2)})`);
                    console.log(`💡 Use SPACE to go up, SHIFT to go down`);
                } else {
                    // Re-enable physics
                    this.playerBody.type = CANNON.Body.DYNAMIC;
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
                // Stabilization complete, re-enable physics
                this.playerBody.type = CANNON.Body.DYNAMIC;
                this.physicsStabilizing = false;
                console.log('✅ Physics stabilization complete, physics enabled');
            } else {
                // Skip physics entirely during stabilization - don't even step the world
                // This prevents any collision calculations during the freeze period
                return;
            }
        }

        // Step the physics world
        this.world.step(delta);

        // Check for NaN before movement
        if (isNaN(this.playerBody.position.x) || isNaN(this.playerBody.position.y) || isNaN(this.playerBody.position.z)) {
            console.error('❌ CRITICAL: Player body position is NaN before movement!');
            console.error('Position:', this.playerBody.position);
            console.error('Velocity:', this.playerBody.velocity);
            // Reset to safe position
            this.playerBody.position.set(0, 2, 0);
            this.playerBody.velocity.set(0, 0, 0);
        }

        if (this.noclipMode) {
            this.handleNoclipMode(safeInputs, delta);
        } else if (this.fixedYMode && this.devMode) {
            this.handleFixedYMode(safeInputs, delta);
        } else if (this.flyMode && this.devMode) {
            this.handleFlyMode(safeInputs, delta);
        } else {
            this.handleNormalMovement(safeInputs, delta);
        }

        // Check for NaN after movement
        if (isNaN(this.playerBody.position.x) || isNaN(this.playerBody.position.y) || isNaN(this.playerBody.position.z)) {
            console.error('❌ CRITICAL: Player body position is NaN after movement!');
            console.error('Position:', this.playerBody.position);
            console.error('Velocity:', this.playerBody.velocity);
            // Reset to safe position
            this.playerBody.position.set(0, 2, 0);
            this.playerBody.velocity.set(0, 0, 0);
        }

        // Update camera position based on physics body
        this.syncCameraToPhysicsBody();

        // Update effects
        this.updateFearEffects(delta);

        // Update physics debug renderer
        if (this.debugEnabled && this.debugRenderer) {
            this.debugRenderer.update();
        }
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

        // Safety check to prevent NaN
        if (forward.length() > 0.001) {
            forward.normalize();
        } else {
            forward.set(0, 0, -1); // Default forward
        }

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
        if (right.length() > 0.001) {
            right.normalize();
        } else {
            right.set(1, 0, 0); // Default right
        }

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

            // Direct velocity control for responsive movement (only horizontal)
            this.playerBody.velocity.x = movement.x;
            this.playerBody.velocity.z = movement.z;

            this.isMoving = true;
        } else {
            // Apply strong friction when not moving (only horizontal)
            this.playerBody.velocity.x *= 0.5;
            this.playerBody.velocity.z *= 0.5;
            this.isMoving = false;
        }

        // No jumping - just let gravity work naturally, no jump input handling

        // Limit maximum speeds
        const maxVel = this.movementSpeed * 1.5;
        this.playerBody.velocity.x = Math.max(-maxVel, Math.min(maxVel, this.playerBody.velocity.x));
        this.playerBody.velocity.z = Math.max(-maxVel, Math.min(maxVel, this.playerBody.velocity.z));
        this.playerBody.velocity.y = Math.max(-20, Math.min(15, this.playerBody.velocity.y));
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

            this.playerBody.position.x += movement.x;
            this.playerBody.position.z += movement.z;
        }

        // Always maintain fixed Y height
        this.playerBody.position.y = this.fixedYHeight - this.playerHeight/2;

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
        this.camera.position.y = this.playerBody.position.y + this.playerHeight/2; // Camera at head level
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
        // Validate inputs
        if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
            console.error('❌ Cannot create box body: Invalid position (NaN)', position);
            return null;
        }
        if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z)) {
            console.error('❌ Cannot create box body: Invalid size (NaN)', size);
            return null;
        }

        // Skip flat objects (decals, carpets, etc.) - they have one dimension that's too small
        const minThickness = 0.01;
        if (size.x < minThickness || size.y < minThickness || size.z < minThickness) {
            // Silently skip - these are decorative flat objects
            return null;
        }

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
        // Validate input position
        if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
            console.error('❌ Cannot teleport: Invalid position (NaN)');
            return;
        }

        // Freeze physics temporarily to let collision system stabilize
        this.playerBody.type = CANNON.Body.KINEMATIC;

        this.playerBody.position.set(position.x, position.y - this.playerHeight/2, position.z);
        this.playerBody.velocity.set(0, 0, 0);
        this.playerBody.angularVelocity.set(0, 0, 0);
        this.playerBody.force.set(0, 0, 0);
        this.playerBody.torque.set(0, 0, 0);

        // Verify the teleport worked
        if (isNaN(this.playerBody.position.x) || isNaN(this.playerBody.position.y) || isNaN(this.playerBody.position.z)) {
            console.error('❌ Teleport failed: Player body position is NaN after setting!');
            console.error('Attempted position:', position);
            console.error('Player body:', this.playerBody.position);
            return;
        }

        this.syncCameraToPhysicsBody();

        // Start stabilization period (50ms freeze to let physics settle)
        this.physicsStabilizing = true;
        this.stabilizationTimer = 0.05; // 50ms

        console.log(`📍 Teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
        console.log(`📍 Player body at: ${this.playerBody.position.x.toFixed(1)}, ${this.playerBody.position.y.toFixed(1)}, ${this.playerBody.position.z.toFixed(1)}`);
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
        this.playerBody.type = CANNON.Body.KINEMATIC;
        this.playerBody.velocity.set(0, 0, 0);

        // Teleport to safe height
        this.playerBody.position.y = this.fixedYHeight - this.playerHeight/2;
        this.camera.position.y = this.fixedYHeight;

        console.log(`✅ Rescued! Now at Y=${this.fixedYHeight.toFixed(2)}`);
        console.log('✈️ Fixed Y Mode enabled - use SPACE/SHIFT to adjust height');
        console.log('💡 Press F10 to disable Fixed Y Mode when ready');
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
            fixedYMode: this.fixedYMode,
            fixedYHeight: this.fixedYHeight,
            physicsDebug: this.debugEnabled,
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

    togglePhysicsDebug() {
        this.debugEnabled = !this.debugEnabled;

        if (this.debugEnabled) {
            // Create debug renderer
            if (!this.debugRenderer) {
                console.log('💡 Creating simple wireframe physics debugger...');
                this.createSimpleDebugRenderer();
            } else {
                // Show existing renderer
                if (this.debugRenderer.group) {
                    this.debugRenderer.group.visible = true;
                }
            }
            console.log('🔍 Physics Debug: ON');
            console.log(`📊 Showing ${this.world.bodies.length} physics bodies`);
        } else {
            // Hide debug renderer
            if (this.debugRenderer && this.debugRenderer.group) {
                this.debugRenderer.group.visible = false;
            }
            console.log('🔍 Physics Debug: OFF');
        }
    }

    createSimpleDebugRenderer() {
        // Fallback: Simple debug renderer using wireframes
        const scene = this.camera.parent;
        if (!scene) return;

        const debugGroup = new THREE.Group();
        debugGroup.name = 'physics_debug';

        // Create wireframe boxes for all physics bodies
        for (const body of this.world.bodies) {
            if (body.shapes.length > 0) {
                const shape = body.shapes[0];

                let geometry;
                if (shape.type === CANNON.Shape.types.BOX) {
                    geometry = new THREE.BoxGeometry(
                        shape.halfExtents.x * 2,
                        shape.halfExtents.y * 2,
                        shape.halfExtents.z * 2
                    );
                } else if (shape.type === CANNON.Shape.types.SPHERE) {
                    geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
                }

                if (geometry) {
                    const material = new THREE.MeshBasicMaterial({
                        color: body === this.playerBody ? 0x00ff00 : 0xff0000,
                        wireframe: true
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.copy(body.position);
                    mesh.quaternion.copy(body.quaternion);
                    mesh.userData.body = body;
                    debugGroup.add(mesh);
                }
            }
        }

        scene.add(debugGroup);
        this.debugRenderer = {
            group: debugGroup,
            update: () => {
                // Update positions of debug meshes
                debugGroup.children.forEach(mesh => {
                    if (mesh.userData.body) {
                        mesh.position.copy(mesh.userData.body.position);
                        mesh.quaternion.copy(mesh.userData.body.quaternion);
                    }
                });
            }
        };

        console.log('🔍 Simple Physics Debug Renderer created');
    }

    setNoclip(enabled) {
        this.noclipMode = enabled;
        console.log(`🚪 Noclip mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    dispose() {
        // Clean up debug renderer
        if (this.debugRenderer && this.debugRenderer.group) {
            const scene = this.camera.parent;
            if (scene) {
                scene.remove(this.debugRenderer.group);
            }
        }

        // Clean up physics world
        this.world.removeBody(this.playerBody);
        console.log('🧹 CannonPhysicsManager disposed');
    }
}

export { CannonPhysicsManager };