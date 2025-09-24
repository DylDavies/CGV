import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/PointerLockControls.js';

class FirstPersonControls {
    constructor(camera, domElement, physicsManager = null) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        this.domElement = domElement;
        this.physicsManager = physicsManager;

        // Movement input states
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.jump = false;

        // Legacy velocity for backward compatibility (if no physics manager)
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        // Input handling
        this.addEventListeners();

        // Mouse sensitivity
        this.mouseSensitivity = 0.002;
        this.controls.pointerSpeed = this.mouseSensitivity;
    }

    addEventListeners() {
        this.domElement.addEventListener('click', () => {
            this.controls.lock();
        });

        const onKeyDown = (event) => {
            // Prevent default for movement keys
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(event.code)) {
                event.preventDefault();
            }

            switch (event.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space':
                    this.jump = true;
                    break;
                case 'ShiftLeft':
                    if (this.physicsManager) {
                        this.isRunning = true;
                    } else {
                        // Legacy: crouch/move down
                        this.isCrouching = true;
                    }
                    break;
                case 'ControlLeft':
                    this.isCrouching = true;
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = false; break;
                case 'KeyA': this.moveLeft = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyD': this.moveRight = false; break;
                case 'Space': this.jump = false; break;
                case 'ShiftLeft':
                    this.isRunning = false;
                    this.isCrouching = false; // Legacy support
                    break;
                case 'ControlLeft':
                    this.isCrouching = false;
                    break;
            }
        };

        // Handle pointer lock events
        this.controls.addEventListener('lock', () => {
            console.log('🎮 Pointer locked - game controls active');
        });

        this.controls.addEventListener('unlock', () => {
            console.log('🎮 Pointer unlocked - game controls inactive');
        });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Store references for cleanup
        this.onKeyDown = onKeyDown;
        this.onKeyUp = onKeyUp;
    }

    tick(delta) {
        if (!this.controls.isLocked) return;

        if (this.physicsManager) {
            // Use new physics-based movement
            const inputs = {
                moveForward: this.moveForward,
                moveBackward: this.moveBackward,
                moveLeft: this.moveLeft,
                moveRight: this.moveRight,
                jump: this.jump,
                isRunning: this.isRunning,
                isCrouching: this.isCrouching
            };

            // Let physics manager handle movement
            this.physicsManager.tick(delta, inputs);

            // Reset one-shot inputs
            this.jump = false;
        } else {
            // Legacy movement system for backward compatibility
            this.legacyMovement(delta);
        }
    }

    legacyMovement(delta) {
        // Original movement code for backward compatibility
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= this.velocity.y * 10.0 * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 400.0 * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 400.0 * delta;
        if (this.jump) this.velocity.y += 400.0 * delta;
        if (this.isCrouching) this.velocity.y -= 400.0 * delta;

        // Move the player
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        this.camera.position.y += this.velocity.y * delta;
    }

    // Set physics manager (can be done after construction)
    setPhysicsManager(physicsManager) {
        this.physicsManager = physicsManager;
    }

    // Get current input state
    getInputState() {
        return {
            moveForward: this.moveForward,
            moveBackward: this.moveBackward,
            moveLeft: this.moveLeft,
            moveRight: this.moveRight,
            isRunning: this.isRunning,
            isCrouching: this.isCrouching,
            jump: this.jump,
            isLocked: this.controls.isLocked
        };
    }

    // Mouse sensitivity controls
    setMouseSensitivity(sensitivity) {
        this.mouseSensitivity = sensitivity;
        this.controls.pointerSpeed = sensitivity;
    }

    getMouseSensitivity() {
        return this.mouseSensitivity;
    }

    // Lock/unlock controls
    lock() {
        this.controls.lock();
    }

    unlock() {
        this.controls.unlock();
    }

    isLocked() {
        return this.controls.isLocked;
    }

    // Reset input states
    resetInputs() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.jump = false;
    }

    // Cleanup
    dispose() {
        // Remove event listeners
        if (this.onKeyDown) {
            document.removeEventListener('keydown', this.onKeyDown);
        }
        if (this.onKeyUp) {
            document.removeEventListener('keyup', this.onKeyUp);
        }

        // Reset inputs
        this.resetInputs();

        // Dispose pointer lock controls
        this.controls.dispose();
    }
}

export { FirstPersonControls };