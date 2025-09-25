// src/components/Player/PlayerControls.js - Enhanced with dev mode

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/PointerLockControls.js';

class FirstPersonControls {
    constructor(camera, domElement, physicsManager = null, puzzles = {}) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        this.domElement = domElement;
        this.physicsManager = physicsManager;

        // Testing puzzle works with new system
        this.puzzles = puzzles;

        // used for tracking if player contols are frozen, e.g if they are interacting with an html puzzle
        this.isFrozen = false;

        // Movement input states
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.jump = false;
        
        // Dev mode controls
        this.flyUp = false;
        this.flyDown = false;

        // Legacy velocity (for backward compatibility if no physics manager)
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        // Input handling
        this.addEventListeners();

        // Mouse sensitivity
        this.mouseSensitivity = 0.002;
        this.controls.pointerSpeed = this.mouseSensitivity;
        
        // Dev mode state
        this.devMode = false;
        this.showingStats = false;

        console.log('🎮 FirstPersonControls initialized');
        console.log('Press F9 for dev mode, F10 for fly mode (in dev), F11 for stats');
    }

    addEventListeners() {
        // Click to lock pointer
        this.domElement.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });

        const onKeyDown = (event) => {
            // Prevent default for movement keys to stop page scrolling - remove KeyP (currently here for testing)
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft', 'KeyQ', 'KeyE', 'KeyP'].includes(event.code)) {
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
                case 'KeyQ':
                    this.flyUp = true;
                    break;
                case 'KeyE':
                    this.flyDown = true;
                    break;
                case 'Escape':
                    if (this.controls.isLocked) {
                        this.controls.unlock();
                    }
                    break;
                case 'F11':
                    event.preventDefault();
                    this.toggleStats();
                    break;
                case 'KeyP': // Remove this later, just here for testing
                    console.log("Triggering color puzzle for testing");
                    if (this.puzzles && this.puzzles.colorPuzzle) {
                        this.puzzles.colorPuzzle.show(4);
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
                case 'KeyQ':
                    this.flyUp = false;
                    break;
                case 'KeyE':
                    this.flyDown = false;
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
            this.hideStats();
        });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Store references for cleanup
        this.onKeyDown = onKeyDown;
        this.onKeyUp = onKeyUp;
        
        // Create stats display
        this.createStatsDisplay();
    }

    createStatsDisplay() {
        this.statsDisplay = document.createElement('div');
        this.statsDisplay.id = 'dev-stats';
        this.statsDisplay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            color: #0f0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border: 1px solid #0f0;
            display: none;
            z-index: 1000;
            min-width: 200px;
        `;
        document.body.appendChild(this.statsDisplay);
    }

    toggleStats() {
        this.showingStats = !this.showingStats;
        this.statsDisplay.style.display = this.showingStats ? 'block' : 'none';
        console.log(`📊 Stats display: ${this.showingStats ? 'ON' : 'OFF'}`);
    }

    hideStats() {
        this.showingStats = false;
        this.statsDisplay.style.display = 'none';
    }

    updateStats() {
        if (!this.showingStats || !this.physicsManager) return;
        
        const state = this.physicsManager.getDebugInfo();
        const pos = state.position;
        const vel = state.velocity;
        
        this.statsDisplay.innerHTML = `
            <strong>== DEV STATS ==</strong><br>
            <strong>Position:</strong><br>
            X: ${pos.x.toFixed(2)}<br>
            Y: ${pos.y.toFixed(2)}<br>
            Z: ${pos.z.toFixed(2)}<br>
            <strong>Velocity:</strong><br>
            X: ${vel.x.toFixed(2)}<br>
            Y: ${vel.y.toFixed(2)}<br>
            Z: ${vel.z.toFixed(2)}<br>
            <strong>State:</strong><br>
            On Ground: ${state.isOnGround ? 'Yes' : 'No'}<br>
            Moving: ${state.isMoving ? 'Yes' : 'No'}<br>
            Dev Mode: ${state.devMode ? 'ON' : 'OFF'}<br>
            Fly Mode: ${state.flyMode ? 'ON' : 'OFF'}<br>
            Fear Level: ${state.fearLevel}%<br>
            <hr style="border-color: #0f0;">
            <small>F9: Dev Mode<br>
            F10: Fly Mode<br>
            F11: Hide Stats</small>
        `;
    }

    showControlHint() {
        if (!this.hasShownHint) {
            console.log('🎮 Controls: WASD to move, Shift to run, Ctrl to crouch, Space to jump, F for flashlight');
            console.log('🔧 Dev: F9 for dev mode, F10 for fly (in dev), F11 for stats');
            this.hasShownHint = true;
        }
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
                jump: this.jump,
                isRunning: this.isRunning,
                isCrouching: this.isCrouching,
                flyUp: this.flyUp,
                flyDown: this.flyDown
            };

            // Let physics manager handle movement
            this.physicsManager.tick(delta, inputs);

            // Update stats display
            this.updateStats();

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
            flyUp: this.flyUp,
            flyDown: this.flyDown,
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

    // For interactions that require mouse interactivity
    freeze() {
        this.isFrozen = true;
        this.controls.unlock(); // Release the mouse pointer
    }

    unfreeze() {
        this.isFrozen = false;
        this.controls.lock(); // Re-lock the mouse pointer for gameplay
    }

    resetInputs() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.jump = false;
        this.flyUp = false;
        this.flyDown = false;
        console.log('🔄 Input states reset');
    }

    // Debug methods
    getDebugInfo() {
        return {
            inputState: this.getInputState(),
            isLocked: this.controls.isLocked,
            mouseSensitivity: this.mouseSensitivity,
            hasPhysics: !!this.physicsManager,
            showingStats: this.showingStats
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

        // Remove stats display
        if (this.statsDisplay) {
            document.body.removeChild(this.statsDisplay);
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