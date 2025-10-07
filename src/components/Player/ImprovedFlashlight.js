// src/components/Player/ImprovedFlashlight.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class ImprovedFlashlight {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.isOn = true;

        // Battery system
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.batteryDrainRate = 0; // Slower drain

        // Create the flashlight system
        this.createFlashlight();
        this.setupControls();

        console.log('🔦 Improved flashlight initialized');
    }

    createFlashlight() {
        // Main spotlight with better settings
        this.light = new THREE.SpotLight(
            0xffffff,    // color
            4,           // intensity
            50,          // distance
            Math.PI / 6, // angle (30 degrees)
            0.2,         // penumbra (softer edges)
            1            // decay
        );

        // Disable shadows for performance (prevents lag spikes when toggling)
        this.light.castShadow = false;
        
        // IMPORTANT: Add light to scene, not camera
        this.scene.add(this.light);
        
        // Create target in scene
        this.target = new THREE.Object3D();
        this.target.name = 'flashlight_target';
        this.scene.add(this.target);
        this.light.target = this.target;
        
        // Optional: Add a subtle ambient boost when flashlight is on
        this.ambientBoost = new THREE.AmbientLight(0x111111, 0.2);
        this.scene.add(this.ambientBoost);
        
        // Visual cone helper (for debugging flashlight issues)
        if (false) { // Disabled - flashlight is working properly now
            this.helper = new THREE.SpotLightHelper(this.light);
            this.scene.add(this.helper);
            console.log('🔦 Flashlight helper enabled for debugging');
        }
        
        console.log('🔦 Flashlight created in scene');
    }
    
    setupControls() {
        // Flashlight is now always on - no toggle needed
        // F key functionality removed
    }

    toggle() {
        // Flashlight is always on - toggle disabled
        console.log(`🔦 Flashlight is always ON`);
    }
    
    updateVisibility() {
        const shouldBeOn = this.isOn && this.currentBattery > 0;

        // Only update if state changed to avoid unnecessary updates
        if (this.light.visible !== shouldBeOn) {
            this.light.visible = shouldBeOn;
            this.ambientBoost.visible = shouldBeOn;
        }

        if (shouldBeOn) {
            this.updateIntensity();
        }
    }
    
    updateIntensity() {
        const batteryRatio = this.currentBattery / this.maxBattery;
        let intensity = 2 * batteryRatio;
        
        // Add flickering when battery is low
        if (this.currentBattery < 20) {
            const flicker = 0.7 + Math.random() * 0.3;
            intensity *= flicker;
        }
        
        this.light.intensity = Math.max(intensity, 0.1);
        this.ambientBoost.intensity = 0.2 * batteryRatio;
    }
    
    tick(delta) {
        // Update battery
        if (this.isOn && this.currentBattery > 0) {
            this.currentBattery = Math.max(0, this.currentBattery - this.batteryDrainRate * delta);
            
            if (this.currentBattery === 0) {
                this.isOn = false;
                console.log('🔋 Battery dead!');
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
        console.log(`⚡ Battery recharged: ${Math.round(this.currentBattery)}%`);
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
    
    dispose() {
        if (this.light) {
            this.scene.remove(this.light);
            if (this.light.dispose) this.light.dispose();
        }
        if (this.target) {
            this.scene.remove(this.target);
        }
        if (this.ambientBoost) {
            this.scene.remove(this.ambientBoost);
        }
        if (this.helper) {
            this.scene.remove(this.helper);
        }
        if (this.debugArrow) {
            this.scene.remove(this.debugArrow);
        }
    }
}

export { ImprovedFlashlight };