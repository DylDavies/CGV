// src/components/Player/FixedFlashlight.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class FixedFlashlight {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.isOn = true;

        // Battery system
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.batteryDrainRate = 0.5; // per second when on

        // Flashlight properties
        this.intensity = 2.0;
        this.distance = 20;
        this.angle = Math.PI / 6; // 30 degrees
        this.penumbra = 0.3;
        
        // Create the flashlight
        this.createFlashlight();
        this.setupControls();
        
        console.log('🔦 Fixed flashlight initialized');
    }

    createFlashlight() {
        // Create spotlight
        this.light = new THREE.SpotLight(
            0xffffff,        // white light
            this.intensity,  // intensity
            this.distance,   // distance
            this.angle,      // angle
            this.penumbra,   // penumbra
            1.5             // decay
        );

        // Enable shadows for atmospheric effect
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 1024;
        this.light.shadow.mapSize.height = 1024;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = this.distance;

        // Position light slightly offset from camera (like holding a flashlight)
        this.light.position.set(0.3, -0.2, -0.1);

        // CRITICAL: Add light to camera so it moves with the player
        this.camera.add(this.light);

        // Create target object for the light
        this.target = new THREE.Object3D();
        this.light.target = this.target;

        // CRITICAL: Add target to camera so it moves with player
        // Position target in front of camera in local space
        this.target.position.set(0, 0, -5);
        this.camera.add(this.target);

        // Optional: Create visible flashlight beam geometry
        this.createBeamVisualization();

        console.log('🔦 Flashlight light created and attached to camera');
    }

    createBeamVisualization() {
        // Create a cone geometry to visualize the light beam
        const beamGeometry = new THREE.ConeGeometry(0.02, 1, 8, 1, true);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });

        this.beam = new THREE.Mesh(beamGeometry, beamMaterial);
        
        // Position and orient the beam
        this.beam.position.set(0.3, -0.2, -0.5);
        this.beam.rotation.x = Math.PI; // Point forward
        
        // Scale beam to match light properties
        const beamLength = this.distance * 0.8;
        const beamRadius = Math.tan(this.angle) * beamLength;
        this.beam.scale.set(beamRadius, beamLength, beamRadius);

        // Add to camera
        this.camera.add(this.beam);
        
        console.log('🔦 Beam visualization created');
    }

    setupControls() {
        // F key to toggle flashlight
        this.keyHandler = (event) => {
            if (event.code === 'KeyF' && this.currentBattery > 0) {
                this.toggle();
                event.preventDefault();
            }
        };
        
        document.addEventListener('keydown', this.keyHandler);
        console.log('🔦 Controls set up - Press F to toggle');
    }

    toggle() {
        this.isOn = !this.isOn;
        this.updateVisibility();
        console.log(`🔦 Flashlight ${this.isOn ? 'ON' : 'OFF'} (Battery: ${Math.round(this.currentBattery)}%)`);
    }

    updateVisibility() {
        if (this.isOn && this.currentBattery > 0) {
            this.light.visible = true;
            if (this.beam) this.beam.visible = true;
            this.updateIntensity();
        } else {
            this.light.visible = false;
            if (this.beam) this.beam.visible = false;
        }
    }

    updateIntensity() {
        // Adjust intensity based on battery level
        const batteryRatio = this.currentBattery / this.maxBattery;
        let intensity = this.intensity * batteryRatio;

        // Add flickering when battery is low
        if (this.currentBattery < 20) {
            const flicker = 0.7 + Math.random() * 0.3;
            intensity *= flicker;
            
            // Update beam opacity based on flicker
            if (this.beam) {
                this.beam.material.opacity = 0.1 * batteryRatio * flicker;
            }
        } else {
            if (this.beam) {
                this.beam.material.opacity = 0.1 * batteryRatio;
            }
        }

        this.light.intensity = Math.max(intensity, 0.05);
    }

    tick(delta) {
        // Update battery drain
        if (this.isOn && this.currentBattery > 0) {
            this.currentBattery = Math.max(0, this.currentBattery - this.batteryDrainRate * delta);

            // Auto-turn off when battery is dead
            if (this.currentBattery === 0) {
                this.isOn = false;
                console.log('🔋 Battery dead! Flashlight automatically turned off.');
            }
        }

        // Update visibility and intensity
        this.updateVisibility();
        
        // The light and target automatically follow the camera since they're children of it
        // No need to manually update positions!
    }

    // Battery management
    rechargeBattery(amount) {
        const oldBattery = this.currentBattery;
        this.currentBattery = Math.min(this.maxBattery, this.currentBattery + amount);
        console.log(`⚡ Battery recharged: ${Math.round(this.currentBattery)}% (+${Math.round(this.currentBattery - oldBattery)})`);
        
        // Can turn on again if battery was dead
        if (oldBattery === 0 && this.currentBattery > 0) {
            console.log('🔋 Battery recharged! You can turn on the flashlight again.');
        }
    }

    setBatteryDrainRate(rate) {
        this.batteryDrainRate = rate;
        console.log(`🔋 Battery drain rate set to ${rate}/second`);
    }

    // Get status for UI
    getBatteryStatus() {
        return {
            current: this.currentBattery,
            max: this.maxBattery,
            percentage: (this.currentBattery / this.maxBattery) * 100,
            isLow: this.currentBattery < 20,
            isCritical: this.currentBattery < 5,
            isEmpty: this.currentBattery === 0
        };
    }

    getState() {
        return {
            isOn: this.isOn,
            canToggle: this.currentBattery > 0,
            battery: this.getBatteryStatus(),
            intensity: this.light.intensity,
            distance: this.distance
        };
    }

    // Horror effects
    setHorrorMode(enabled, flickerIntensity = 0.5) {
        this.horrorMode = enabled;
        this.flickerIntensity = flickerIntensity;
        
        if (enabled) {
            console.log('😰 Horror mode activated - flashlight may flicker');
        }
    }

    triggerFlicker(duration = 2000) {
        if (!this.isOn) return;
        
        this.flickering = true;
        console.log('⚡ Flashlight flickering...');
        
        setTimeout(() => {
            this.flickering = false;
        }, duration);
    }

    // Emergency mode (very dim light, no battery drain)
    activateEmergencyMode() {
        console.log('🚨 Emergency mode activated');
        this.emergencyMode = true;
        this.isOn = true;
        this.light.intensity = this.intensity * 0.1;
        this.light.visible = true;
        
        if (this.beam) {
            this.beam.material.opacity = 0.02;
            this.beam.visible = true;
        }
    }

    deactivateEmergencyMode() {
        console.log('✅ Emergency mode deactivated');
        this.emergencyMode = false;
        this.updateVisibility();
    }

    // Cleanup
    dispose() {
        // Remove event listener
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }

        // Remove from camera
        if (this.light && this.light.parent) {
            this.light.parent.remove(this.light);
        }
        if (this.target && this.target.parent) {
            this.target.parent.remove(this.target);
        }
        if (this.beam && this.beam.parent) {
            this.beam.parent.remove(this.beam);
        }

        // Dispose geometry and materials
        if (this.beam) {
            this.beam.geometry.dispose();
            this.beam.material.dispose();
        }

        console.log('🔦 Flashlight disposed');
    }
}

export { FixedFlashlight };