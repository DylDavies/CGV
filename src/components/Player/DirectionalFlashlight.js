// src/components/Player/DirectionalFlashlight.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class DirectionalFlashlight {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.isOn = true;

        // Battery system
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.batteryDrainRate = 0.5; // per second when on

        // Create flashlight
        this.createFlashlight();
        this.setupControls();
    }

    createFlashlight() {
        // Use a directional light instead of spotlight for more predictable behavior
        this.light = new THREE.DirectionalLight(0xffffff, 0.8);

        // Position light at camera
        this.light.position.set(0, 0, 0);

        // Set up shadows
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 1024;
        this.light.shadow.mapSize.height = 1024;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = 20;
        this.light.shadow.camera.left = -10;
        this.light.shadow.camera.right = 10;
        this.light.shadow.camera.top = 10;
        this.light.shadow.camera.bottom = -10;

        // Add to camera so it follows camera movement
        this.camera.add(this.light);

        // Also add a helper light to see the effect better
        this.helper = new THREE.DirectionalLightHelper(this.light, 2, 0xff0000);
        this.camera.add(this.helper);

        console.log('🔦 Directional flashlight created');
    }

    setupControls() {
        // F key to toggle flashlight
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyF' && this.currentBattery > 0) {
                this.toggle();
            }
        });
    }

    toggle() {
        this.isOn = !this.isOn;
        this.updateVisibility();
        console.log(`🔦 Directional flashlight ${this.isOn ? 'ON' : 'OFF'}`);
    }

    updateVisibility() {
        if (this.isOn && this.currentBattery > 0) {
            this.light.visible = true;
            this.helper.visible = true;
            this.updateIntensity();
        } else {
            this.light.visible = false;
            this.helper.visible = false;
        }
    }

    updateIntensity() {
        // Adjust intensity based on battery level
        const batteryRatio = this.currentBattery / this.maxBattery;
        let intensity = 0.8 * batteryRatio;

        // Add flickering when battery is low
        if (this.currentBattery < 20) {
            intensity *= (0.7 + Math.random() * 0.3); // Random flicker
        }

        this.light.intensity = Math.max(intensity, 0.1); // Minimum light
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

        // Update visibility and intensity
        this.updateVisibility();

        // Update light direction to match camera direction
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.light.target.position.copy(this.camera.position).add(direction.multiplyScalar(10));
        this.light.target.updateMatrixWorld();
    }

    // Recharge battery (for gameplay mechanics)
    rechargeBattery(amount) {
        this.currentBattery = Math.min(this.maxBattery, this.currentBattery + amount);
        console.log(`⚡ Battery recharged: ${Math.round(this.currentBattery)}%`);
    }

    // Get battery status for UI
    getBatteryStatus() {
        return {
            current: this.currentBattery,
            max: this.maxBattery,
            percentage: (this.currentBattery / this.maxBattery) * 100,
            isLow: this.currentBattery < 20,
            isCritical: this.currentBattery < 5
        };
    }

    // Get flashlight state
    getState() {
        return {
            isOn: this.isOn,
            canToggle: this.currentBattery > 0,
            battery: this.getBatteryStatus()
        };
    }

    dispose() {
        // Remove from camera
        if (this.light.parent) {
            this.light.parent.remove(this.light);
        }
        if (this.helper.parent) {
            this.helper.parent.remove(this.helper);
        }
    }
}

export { DirectionalFlashlight };