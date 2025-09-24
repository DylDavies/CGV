// src/components/Player/SimpleFlashlight.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class SimpleFlashlight {
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
        // Create extremely simple spotlight - no complex targeting
        this.spotlight = new THREE.SpotLight(
            0xffffff,           // white light
            200,                // high intensity to make it obvious
            25,                 // distance
            Math.PI / 6,        // 30 degree cone
            0.3,                // penumbra
            0.5                 // decay
        );

        // Position slightly in front and to the side like holding a flashlight
        this.spotlight.position.set(0.2, -0.2, 0.5);

        // Disable shadows for now to simplify
        this.spotlight.castShadow = false;

        // Create target and position it in front of camera
        this.target = new THREE.Object3D();
        this.spotlight.target = this.target;

        // Add spotlight to camera
        this.camera.add(this.spotlight);

        // Add target to scene (not camera) and position it manually
        this.scene.add(this.target);

        console.log('🔦 Simple flashlight created');
        console.log('Camera:', this.camera.position);
        console.log('Spotlight:', this.spotlight.position);
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
        console.log(`🔦 Flashlight ${this.isOn ? 'ON' : 'OFF'}`);
    }

    updateVisibility() {
        if (this.isOn && this.currentBattery > 0) {
            this.spotlight.visible = true;
            this.updateIntensity();
        } else {
            this.spotlight.visible = false;
        }
    }

    updateIntensity() {
        // Adjust intensity based on battery level
        const batteryRatio = this.currentBattery / this.maxBattery;
        let intensity = 80 * batteryRatio;

        // Add flickering when battery is low
        if (this.currentBattery < 20) {
            intensity *= (0.7 + Math.random() * 0.3); // Random flicker
        }

        this.spotlight.intensity = Math.max(intensity, 5); // Minimum light
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

        // Manually position target in front of camera
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.normalize(); // IMPORTANT: normalize the direction vector

        // Position target 5 units in front of camera (shorter distance)
        this.target.position.copy(this.camera.position);
        this.target.position.add(direction.multiplyScalar(5));

        // Debug: log positions occasionally
        if (Math.random() < 0.005) { // Less frequent logging
            console.log('🔦 Camera pos:', this.camera.position);
            console.log('🔦 Target pos:', this.target.position);
            console.log('🔦 Direction (normalized):', direction);
            console.log('🔦 Spotlight local pos:', this.spotlight.position);
            console.log('🔦 Distance to target:', this.camera.position.distanceTo(this.target.position));
            console.log('---');
        }
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
        if (this.spotlight.parent) {
            this.spotlight.parent.remove(this.spotlight);
        }
        if (this.target.parent) {
            this.target.parent.remove(this.target);
        }

        // Clean up geometries and materials
        if (this.spotlight.dispose) {
            this.spotlight.dispose();
        }
    }
}

export { SimpleFlashlight };