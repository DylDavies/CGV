// src/components/Player/PlayerControls.js - Fixed version

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

        // Legacy velocity (for backward compatibility if no physics manager)
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        // Input handling
        this.addEventListeners();

        // Mouse sensitivity
        this.mouseSensitivity = 0.002;
        this.controls.pointerSpeed = this.mouseSensitivity;

        console.log('🎮 FirstPersonControls initialized');
    }

    addEventListeners() {
        // Click to lock pointer
        this.domElement.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });

        const onKeyDown = (event) => {
            // Prevent default for movement keys to stop page scrolling
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft'].includes(event.code)) {
                event.preventDefault();
            }

            switch (event.code) {
                case 'KeyW': 
                    this.moveForward = true; 
                    break;
                case 'KeyA': 
                    this.moveLeft = true; 
                    break;
                case 'KeyS': 
                    this.moveBackward = true; 
                    break;
                case 'KeyD': 
                    this.moveRight = true; 
                    break;
                case 'Space':
                    this.jump = true;
                    break;
                case 'ShiftLeft':
                    this.isRunning = true;
                    break;
                case 'ControlLeft':
                    this.isCrouching = true;
                    break;
                case 'Escape':
                    // Allow escape to unlock pointer
                    if (this.controls.isLocked) {
                        this.controls.unlock();
                    }
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': 
                    this.moveForward = false; 
                    break;
                case 'KeyA': 
                    this.moveLeft = false; 
                    break;
                case 'KeyS': 
                    this.moveBackward = false; 
                    break;
                case 'KeyD': 
                    this.moveRight = false; 
                    break;
                case 'Space': 
                    this.jump = false; 
                    break;
                case 'ShiftLeft':
                    this.isRunning = false;
                    break;
                case 'ControlLeft':
                    this.isCrouching = false;
                    break;
            }
        };

        // Handle pointer lock events
        this.controls.addEventListener('lock', () => {
            console.log('🔒 Pointer locked - game controls active');
            this.showControlHint();
        });

        this.controls.addEventListener('unlock', () => {
            console.log('🔓 Pointer unlocked - game controls inactive');
        });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Store references for cleanup
        this.onKeyDown = onKeyDown;
        this.onKeyUp = onKeyUp;
    }

    showControlHint() {
        // Show controls hint when first locking
        if (!this.hasShownHint) {
            console.log('🎮 Controls: WASD to move, Shift to run, Ctrl to crouch, Space to jump, F for flashlight');
            this.hasShownHint = true;
        }
    }

    tick(delta) {
        if (!this.controls.isLocked) return;

        if (this.physicsManager) {
            // Use physics-based movement
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

            // Reset one-shot inputs after physics processing
            this.jump = false;
        } else {
            // Legacy movement system (fallback)
            this.legacyMovement(delta);
        }
    }

    legacyMovement(delta) {
        // Simplified legacy movement for backward compatibility
        this.velocity.x -= this.velocity.x * 8.0 * delta;
        this.velocity.z -= this.velocity.z * 8.0 * delta;
        this.velocity.y -= this.velocity.y * 8.0 * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        const speed = this.isRunning ? 600.0 : 400.0;

        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * speed * delta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * speed * delta;
        }
        if (this.jump) {
            this.velocity.y += 500.0 * delta;
        }
        if (this.isCrouching) {
            this.velocity.y -= 300.0 * delta;
        }

        // Apply movement
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        this.camera.position.y += this.velocity.y * delta;

        // Keep camera above ground (simple)
        if (this.camera.position.y < 1.8) {
            this.camera.position.y = 1.8;
            this.velocity.y = Math.max(0, this.velocity.y);
        }
    }

    // Utility methods
    setPhysicsManager(physicsManager) {
        this.physicsManager = physicsManager;
        console.log('🔧 Physics manager attached to controls');
    }

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

    setMouseSensitivity(sensitivity) {
        this.mouseSensitivity = sensitivity;
        this.controls.pointerSpeed = sensitivity;
        console.log(`🖱️ Mouse sensitivity set to ${sensitivity}`);
    }

    getMouseSensitivity() {
        return this.mouseSensitivity;
    }

    lock() {
        this.controls.lock();
    }

    unlock() {
        this.controls.unlock();
    }

    isLocked() {
        return this.controls.isLocked;
    }

    resetInputs() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.jump = false;
        console.log('🔄 Input states reset');
    }

    // Debug methods
    getDebugInfo() {
        return {
            inputState: this.getInputState(),
            isLocked: this.controls.isLocked,
            mouseSensitivity: this.mouseSensitivity,
            hasPhysics: !!this.physicsManager
        };
    }

    // Cleanup
    dispose() {
        console.log('🧹 Disposing FirstPersonControls');
        
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
        if (this.controls && this.controls.dispose) {
            this.controls.dispose();
        }
    }
}

export { FirstPersonControls };