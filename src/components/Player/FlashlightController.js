// src/components/Player/FlashlightController.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class FlashlightController {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;

        // Flashlight properties
        this.isOn = true;
        this.isToggling = false;
        this.toggleCooldown = 0.2; // Prevent rapid toggling
        this.lastToggleTime = 0;

        // Battery system
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.batteryDrainRate = 1.0; // per second when on
        this.lowBatteryThreshold = 20;
        this.criticalBatteryThreshold = 5;

        // Light properties
        this.maxIntensity = 100;
        this.maxDistance = 100;
        this.spotAngle = Math.PI / 8;
        this.penumbra = 0.5;
        this.decay = 2;

        // Horror effects
        this.flickerEnabled = false;
        this.flickerIntensity = 0;
        this.flickerTime = 0;
        this.horrorModeActive = false;

        // Create the flashlight
        this.createFlashlight();
        this.createFlashlightBeam();

        // Input handling
        this.setupEventListeners();

        // Performance optimization
        this.updateInterval = 1000 / 60; // 60 FPS
        this.lastUpdate = 0;

        // Sound effects (placeholder for future audio implementation)
        this.soundEnabled = true;
    }

    createFlashlight() {
        // Main spotlight
        this.flashlight = new THREE.SpotLight(
            0xffffff,
            this.maxIntensity,
            this.maxDistance,
            this.spotAngle,
            this.penumbra,
            this.decay
        );

        // Position relative to camera (slightly offset like holding a flashlight)
        this.flashlight.position.set(0.2, -0.1, 0);
        this.flashlight.castShadow = true;

        // Shadow properties for better atmosphere
        this.flashlight.shadow.mapSize.width = 1024;
        this.flashlight.shadow.mapSize.height = 1024;
        this.flashlight.shadow.camera.near = 0.1;
        this.flashlight.shadow.camera.far = this.maxDistance;
        this.flashlight.shadow.camera.fov = (this.spotAngle * 180) / Math.PI;

        // Create target for the spotlight - this is key for proper direction
        this.flashlightTarget = new THREE.Object3D();
        this.flashlight.target = this.flashlightTarget;

        // Add to camera so it moves with player
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlightTarget);

        // Position target in front of camera in local space
        this.flashlightTarget.position.set(0, 0, -this.maxDistance * 0.8);
    }

    createFlashlightBeam() {
        // Create volumetric light effect (cone geometry for beam visualization)
        const beamGeometry = new THREE.ConeGeometry(0, 2, 8, 1, true);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            fog: false
        });

        this.flashlightBeam = new THREE.Mesh(beamGeometry, beamMaterial);
        this.flashlightBeam.position.copy(this.flashlight.position);
        this.flashlightBeam.rotateX(-Math.PI / 2);

        // Scale beam based on light properties
        const beamLength = this.maxDistance * 0.8;
        const beamRadius = Math.tan(this.spotAngle) * beamLength;
        this.flashlightBeam.scale.set(beamRadius, beamLength, beamRadius);

        this.camera.add(this.flashlightBeam);
        this.flashlightBeam.visible = this.isOn;
    }

    setupEventListeners() {
        // Toggle flashlight with F key
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyF') {
                this.toggle();
            }
        });

        // Mouse wheel for light intensity adjustment (optional feature)
        document.addEventListener('wheel', (event) => {
            if (event.ctrlKey && this.isOn) {
                event.preventDefault();
                const delta = event.deltaY > 0 ? -5 : 5;
                this.adjustIntensity(delta);
            }
        });
    }

    toggle() {
        const currentTime = Date.now() / 1000;
        if (currentTime - this.lastToggleTime < this.toggleCooldown) {
            return; // Prevent rapid toggling
        }

        this.lastToggleTime = currentTime;

        if (this.currentBattery <= 0) {
            this.playToggleSound('empty');
            return; // Can't turn on with no battery
        }

        this.isOn = !this.isOn;
        this.updateFlashlightState();
        this.playToggleSound(this.isOn ? 'on' : 'off');
    }

    updateFlashlightState() {
        if (this.isOn && this.currentBattery > 0) {
            this.flashlight.visible = true;
            this.flashlightBeam.visible = true;
            this.updateIntensityBasedOnBattery();
        } else {
            this.flashlight.visible = false;
            this.flashlightBeam.visible = false;
        }
    }

    updateIntensityBasedOnBattery() {
        let intensityMultiplier = 1.0;

        // Battery level affects brightness
        if (this.currentBattery <= this.criticalBatteryThreshold) {
            intensityMultiplier = 0.2;
            this.enableFlicker(0.8); // Strong flicker when critical
        } else if (this.currentBattery <= this.lowBatteryThreshold) {
            intensityMultiplier = 0.6;
            this.enableFlicker(0.3); // Mild flicker when low
        } else {
            this.disableFlicker();
        }

        // Apply horror mode effects
        if (this.horrorModeActive) {
            intensityMultiplier *= 0.7;
            this.enableFlicker(0.5);
        }

        this.flashlight.intensity = this.maxIntensity * intensityMultiplier;
        this.flashlightBeam.material.opacity = 0.1 * intensityMultiplier;
    }

    adjustIntensity(delta) {
        const oldIntensity = this.maxIntensity;
        this.maxIntensity = THREE.MathUtils.clamp(this.maxIntensity + delta, 50, 150);

        if (oldIntensity !== this.maxIntensity) {
            this.updateIntensityBasedOnBattery();
        }
    }

    enableFlicker(intensity = 0.3) {
        this.flickerEnabled = true;
        this.flickerIntensity = intensity;
    }

    disableFlicker() {
        this.flickerEnabled = false;
        this.flickerIntensity = 0;
    }

    updateFlicker(delta) {
        if (!this.flickerEnabled || !this.isOn) return;

        this.flickerTime += delta;

        // Create irregular flicker pattern
        const flickerPattern =
            Math.sin(this.flickerTime * 15) * 0.5 +
            Math.sin(this.flickerTime * 23) * 0.3 +
            Math.sin(this.flickerTime * 37) * 0.2;

        const flickerAmount = flickerPattern * this.flickerIntensity;
        const baseIntensity = this.maxIntensity * (this.currentBattery / this.maxBattery);

        this.flashlight.intensity = Math.max(0, baseIntensity + flickerAmount * 20);

        // Flicker beam opacity too
        const baseOpacity = 0.1 * (this.currentBattery / this.maxBattery);
        this.flashlightBeam.material.opacity = Math.max(0, baseOpacity + flickerAmount * 0.05);
    }

    updateBattery(delta) {
        if (this.isOn && this.currentBattery > 0) {
            // Battery drains faster when intensity is higher
            const drainMultiplier = this.maxIntensity / 100;
            this.currentBattery = Math.max(0, this.currentBattery - this.batteryDrainRate * drainMultiplier * delta);

            // Auto-turn off when battery is depleted
            if (this.currentBattery <= 0) {
                this.isOn = false;
                this.updateFlashlightState();
                this.playToggleSound('dead');
            }
        }
    }

    rechargeBattery(amount) {
        const oldBattery = this.currentBattery;
        this.currentBattery = Math.min(this.maxBattery, this.currentBattery + amount);

        if (oldBattery === 0 && this.currentBattery > 0) {
            // Battery was dead, now has charge - can turn on again
            this.playToggleSound('recharge');
        }

        return this.currentBattery - oldBattery; // Return amount actually recharged
    }

    updateTarget() {
        // Since both flashlight and target are children of camera,
        // we just need to keep the target in front - camera rotation handles the rest
        this.flashlightTarget.position.set(0, 0, -this.maxDistance * 0.8);
    }

    activateHorrorMode(duration = 5000) {
        this.horrorModeActive = true;
        this.enableFlicker(0.6);

        // Automatically disable after duration
        setTimeout(() => {
            this.horrorModeActive = false;
            if (this.currentBattery > this.lowBatteryThreshold) {
                this.disableFlicker();
            }
        }, duration);
    }

    // Simulate emergency mode (very dim light with no battery drain)
    activateEmergencyMode() {
        this.isOn = true;
        this.flashlight.intensity = this.maxIntensity * 0.1;
        this.flashlightBeam.material.opacity = 0.02;
        this.flashlight.visible = true;
        this.flashlightBeam.visible = true;
        this.enableFlicker(0.9);
    }

    deactivateEmergencyMode() {
        this.updateFlashlightState();
    }

    // Main update method
    tick(delta) {
        const currentTime = Date.now();

        // Throttle updates for performance
        if (currentTime - this.lastUpdate < this.updateInterval) {
            return;
        }
        this.lastUpdate = currentTime;

        // Update flashlight target to follow camera
        this.updateTarget();

        // Update battery system
        this.updateBattery(delta);

        // Update flicker effects
        this.updateFlicker(delta);

        // Update intensity based on current state
        if (this.isOn) {
            this.updateIntensityBasedOnBattery();
        }
    }

    // Audio placeholder methods
    playToggleSound(type) {
        if (!this.soundEnabled) return;

        // Placeholder for audio implementation
        switch (type) {
            case 'on':
                console.log('🔦 Flashlight ON');
                break;
            case 'off':
                console.log('🔦 Flashlight OFF');
                break;
            case 'empty':
                console.log('🔋 Battery empty!');
                break;
            case 'dead':
                console.log('💀 Flashlight died!');
                break;
            case 'recharge':
                console.log('⚡ Battery recharged!');
                break;
        }
    }

    // Get flashlight state for UI display
    getFlashlightState() {
        return {
            isOn: this.isOn,
            battery: this.currentBattery,
            maxBattery: this.maxBattery,
            batteryPercentage: (this.currentBattery / this.maxBattery) * 100,
            isLowBattery: this.currentBattery <= this.lowBatteryThreshold,
            isCriticalBattery: this.currentBattery <= this.criticalBatteryThreshold,
            isFlickering: this.flickerEnabled,
            horrorModeActive: this.horrorModeActive,
            intensity: this.flashlight.intensity,
            maxIntensity: this.maxIntensity
        };
    }

    // Configuration methods
    setBatteryDrainRate(rate) {
        this.batteryDrainRate = rate;
    }

    setLightProperties(intensity, distance, angle) {
        this.maxIntensity = intensity;
        this.maxDistance = distance;
        this.spotAngle = angle;

        this.flashlight.distance = distance;
        this.flashlight.angle = angle;

        // Update beam geometry
        const beamLength = this.maxDistance * 0.8;
        const beamRadius = Math.tan(this.spotAngle) * beamLength;
        this.flashlightBeam.scale.set(beamRadius, beamLength, beamRadius);
    }

    enableSounds(enabled) {
        this.soundEnabled = enabled;
    }

    // Cleanup
    dispose() {
        // Remove event listeners
        document.removeEventListener('keydown', this.toggle);
        document.removeEventListener('wheel', this.adjustIntensity);

        // Remove from scene
        if (this.flashlight.parent) {
            this.flashlight.parent.remove(this.flashlight);
        }
        if (this.flashlightBeam.parent) {
            this.flashlightBeam.parent.remove(this.flashlightBeam);
        }
        if (this.flashlightTarget.parent) {
            this.flashlightTarget.parent.remove(this.flashlightTarget);
        }

        // Dispose geometries and materials
        this.flashlightBeam.geometry.dispose();
        this.flashlightBeam.material.dispose();
    }
}

export { FlashlightController };