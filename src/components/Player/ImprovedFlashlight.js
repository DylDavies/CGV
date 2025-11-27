// src/components/Player/ImprovedFlashlight.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class ImprovedFlashlight {
    constructor(camera, scene, stageManager = null) {
        this.camera = camera;
        this.scene = scene;
        this.stageManager = stageManager;
        this.isOn = true;

        // Battery system
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.batteryDrainRate = 0; // Slower drain

        // Brightness system
        this.baseIntensity = 3; // Base intensity (current default)
        this.brightnessMultiplier = 1.0; // Default multiplier
        this._loadBrightnessSetting();

        // Create the flashlight system
        this.createFlashlight();
        this.setupControls();
        this.setupBrightnessListener();

        console.log('Improved flashlight initialized with brightness level:', this.getBrightnessLevel());
    }

    createFlashlight() {
        // Main spotlight - narrow focused beam like a real flashlight
        const initialIntensity = this.baseIntensity * this.brightnessMultiplier;
        this.light = new THREE.SpotLight(
            0xffffff,    // color
            initialIntensity, // intensity (adjusted by brightness)
            40,          // distance
            Math.PI / 8, // angle
            0.3,         // penumbra
            1            // decay
        );

        // Enable shadow casting (optimized resolution) with dramatic but clean shadows
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 1024;
        this.light.shadow.mapSize.height = 1024;
        this.light.shadow.camera.near = 1.4;  
        this.light.shadow.camera.far = 40;
        this.light.shadow.bias = -0.0003;     
        this.light.shadow.normalBias = 0.02;  
        this.light.shadow.radius = 1.0;      
        // IMPORTANT: Add light to initial scene
        this.scene.add(this.light);
        this.lightCurrentScene = this.scene;

        // Create target in scene
        this.target = new THREE.Object3D();
        this.target.name = 'flashlight_target';
        this.scene.add(this.target);
        this.targetCurrentScene = this.scene;
        this.light.target = this.target;

        // No ambient boost - was causing lag spikes on toggle

        // Visual cone helper (for debugging flashlight issues)
        if (false) { // Disabled - flashlight is working properly now
            this.helper = new THREE.SpotLightHelper(this.light);
            this.scene.add(this.helper);
            console.log('Flashlight helper enabled for debugging');
        }

        console.log('Flashlight created in scene (narrow focused beam)');
    }
    
    setupControls() {
        // F key to toggle flashlight
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF') {
                this.toggle();
            }
        });
    }

    toggle() {
        this.isOn = !this.isOn;
        this.updateVisibility();
        console.log(`Flashlight ${this.isOn ? 'ON' : 'OFF'}`);
    }
    
    updateVisibility() {
        // Flashlight is disabled on office stage (only visible on other stages)
        const isOfficeStage = this.stageManager && this.stageManager.currentStage === 'office';
        const shouldBeOn = this.isOn && this.currentBattery > 0 && !isOfficeStage;

        // Only update if state changed to avoid unnecessary updates
        if (this.light.visible !== shouldBeOn) {
            this.light.visible = shouldBeOn;
            // No ambient boost to toggle - prevents lag spike
        }

        // No dynamic intensity updates - fixed intensity prevents lag
    }
    
    updateIntensity() {
        const batteryRatio = this.currentBattery / this.maxBattery;
        let intensity = 4 * batteryRatio; // Reduced from 8 to 4 for less brightness

        // Add flickering when battery is low
        if (this.currentBattery < 20) {
            const flicker = 0.7 + Math.random() * 0.3;
            intensity *= flicker;
        }

        this.light.intensity = Math.max(intensity, 0.1);
        this.ambientBoost.intensity = 0.15 * batteryRatio; // Reduced from 0.4 to 0.15
    }
    
    tick(delta) {
        // Update battery
        if (this.isOn && this.currentBattery > 0) {
            this.currentBattery = Math.max(0, this.currentBattery - this.batteryDrainRate * delta);

            if (this.currentBattery === 0) {
                this.isOn = false;
                console.log('Battery dead!');
            }
        }

        // CRITICAL: Handle multi-scene switching - ensure light is in the current scene
        if (this.stageManager) {
            const currentScene = this.stageManager.getCurrentScene();
            if (currentScene && this.lightCurrentScene !== currentScene) {
                // Remove light and target from old scene
                if (this.lightCurrentScene) {
                    this.lightCurrentScene.remove(this.light);
                    this.lightCurrentScene.remove(this.target);
                }
                // Add light and target to new scene
                currentScene.add(this.light);
                currentScene.add(this.target);
                this.lightCurrentScene = currentScene;
                this.targetCurrentScene = currentScene;
                console.log(`Flashlight moved to ${this.stageManager.currentStage} scene`);
            }
        }

        // Update visibility
        this.updateVisibility();

        // CRITICAL: Update light position and target in world space
        this.updateLightPosition();

        // Update helper if it exists
        if (this.helper) {
            this.helper.update();
        }
    }
    
    updateLightPosition() {
        // Light comes from camera
        const lightSourcePos = new THREE.Vector3();
        this.camera.getWorldPosition(lightSourcePos);

        const lightDirection = new THREE.Vector3();
        this.camera.getWorldDirection(lightDirection);

        // Offset slightly (like holding a flashlight)
        const rightOffset = new THREE.Vector3();
        rightOffset.crossVectors(lightDirection, new THREE.Vector3(0, 1, 0)).normalize();
        rightOffset.multiplyScalar(0.1);

        lightSourcePos.add(rightOffset);
        lightSourcePos.y -= 0.1; // Slightly lower than eye level

        // Set light position
        this.light.position.copy(lightSourcePos);

        // Set target position (where light is pointing)
        this.target.position.copy(lightSourcePos);
        this.target.position.add(lightDirection.multiplyScalar(10)); // 10 units ahead
    }
    
    rechargeBattery(amount) {
        this.currentBattery = Math.min(this.maxBattery, this.currentBattery + amount);
        console.log(`Battery recharged: ${Math.round(this.currentBattery)}%`);
    }
    
    getBatteryStatus() {
        return {
            current: this.currentBattery,
            max: this.maxBattery,
            percentage: (this.currentBattery / this.maxBattery) * 100,
            isLow: this.currentBattery < 20,
            isCritical: this.currentBattery < 5
        };
    }
    
    getState() {
        return {
            isOn: this.isOn,
            canToggle: this.currentBattery > 0,
            battery: this.getBatteryStatus()
        };
    }
    
    // Debug method to visualize light direction
    toggleDebug() {
        if (!this.debugArrow) {
            const dir = new THREE.Vector3(0, 0, -1);
            const origin = new THREE.Vector3(0, 0, 0);
            const length = 5;
            const hex = 0xffff00;

            this.debugArrow = new THREE.ArrowHelper(dir, origin, length, hex);
            this.scene.add(this.debugArrow);
        } else {
            this.debugArrow.visible = !this.debugArrow.visible;
        }
    }

    // Brightness system methods
    _loadBrightnessSetting() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                const brightness = settings.brightness || 3;
                this.brightnessMultiplier = this.getBrightnessMultiplier(brightness);
            } catch (e) {
                console.error('Failed to load brightness setting:', e);
                this.brightnessMultiplier = 1.0;
            }
        }
    }

    setupBrightnessListener() {
        window.addEventListener('brightnesschange', (event) => {
            const brightness = event.detail.brightness;
            this.brightnessMultiplier = this.getBrightnessMultiplier(brightness);
            this.updateFlashlightBrightness();
            console.log(`Flashlight brightness updated to level ${brightness} (multiplier: ${this.brightnessMultiplier})`);
        });
    }

    getBrightnessMultiplier(level) {
        const multipliers = {
            1: 0.5,   // Very Dark
            2: 0.75,  // Dark
            3: 1.0,   // Normal (current default)
            4: 1.5,   // Bright
            5: 2.0,   // Very Bright
            6: 2.5,   // Ultra Bright
            7: 3.0,   // Maximum
            8: 5.0    // Extreme
        };
        return multipliers[level] || 1.0;
    }

    getBrightnessLevel() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                return settings.brightness || 3;
            } catch (e) {
                return 3;
            }
        }
        return 3;
    }

    updateFlashlightBrightness() {
        if (this.light) {
            this.light.intensity = this.baseIntensity * this.brightnessMultiplier;
        }
    }

    dispose() {
        if (this.light) {
            this.scene.remove(this.light);
            if (this.light.dispose) this.light.dispose();
        }
        if (this.target) {
            this.scene.remove(this.target);
        }
        // No ambient boost to dispose
        if (this.helper) {
            this.scene.remove(this.helper);
        }
        if (this.debugArrow) {
            this.scene.remove(this.debugArrow);
        }
    }
}

export { ImprovedFlashlight };