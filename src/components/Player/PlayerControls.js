// src/components/Player/PlayerControls.js - Simplified for reliable flying

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/PointerLockControls.js';

class FirstPersonControls {
    constructor(camera, domElement, physicsManager = null, puzzles = {}) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        this.domElement = domElement;
        this.physicsManager = physicsManager;
        this.puzzles = puzzles;
        this.isFrozen = false;

        // Movement input states
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.jump = false; // This will now also control flying up

        // Legacy velocity (for backward compatibility if no physics manager)
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        // Input handling
        this.addEventListeners();
    }

    addEventListeners() {
        this.domElement.addEventListener('click', () => this.controls.lock());

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space': this.jump = true; break;
                // --- SWAP THESE TWO ---
                case 'ShiftLeft': this.isCrouching = true; break; // Shift now controls Crouching / Flying Down
                case 'ControlLeft': this.isRunning = true; break;   // Ctrl now controls Running

                case 'F9':
                    event.preventDefault();
                    if (this.physicsManager && this.physicsManager.toggleFlyMode) {
                        this.physicsManager.toggleFlyMode();
                    }
                    break;
                    
                case 'KeyP': // For puzzle testing
                    if (this.puzzles && this.puzzles.colorPuzzle) {
                        this.puzzles.colorPuzzle.show(4);
                    }
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
                // --- AND SWAP THESE TWO ---
                case 'ShiftLeft': this.isCrouching = false; break;
                case 'ControlLeft': this.isRunning = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }
    
    tick(delta) {
        if (!this.controls.isLocked || this.isFrozen) return;

        if (this.physicsManager) {
            // Use physics-based movement
            const inputs = {
                moveForward: this.moveForward,
                moveBackward: this.moveBackward,
                moveLeft: this.moveLeft,
                moveRight: this.moveRight,
                jump: this.jump, // This is used for both jumping and flying up
                isRunning: this.isRunning,
                isCrouching: this.isCrouching, // This is used for crouching and flying down
            };

            // Let physics manager handle all movement
            this.physicsManager.tick(delta, inputs);

        } else {
            // Fallback for when there's no physics engine
            this.legacyMovement(delta);
        }
    }

    legacyMovement(delta) {
        // This is a simple movement system that should not interfere with the main physics
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();
        const speed = this.isRunning ? 20.0 : 10.0;
        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * speed * delta;
        this.controls.moveRight(-this.velocity.x);
        this.controls.moveForward(-this.velocity.z);
    }

    freeze() { this.isFrozen = true; this.controls.unlock(); }
    unfreeze() { this.isFrozen = false; this.controls.lock(); }
    lock() { this.controls.lock(); }
    unlock() { this.controls.unlock(); }
}

export { FirstPersonControls };