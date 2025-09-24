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
        this.batteryDrainRate = 0.3; // Slower drain
        
        // Create the flashlight system
        this.createFlashlight();
        this.setupControls();
        
        console.log('🔦 Improved flashlight initialized');
    }
    
    createFlashlight() {
        // Main spotlight with better settings
        this.light = new THREE.SpotLight(
            0xffffff,    // color
            2,           // intensity  
            30,          // distance
            Math.PI / 6, // angle (30 degrees)
            0.2,         // penumbra (softer edges)
            1            // decay
        );
        
        // Enable shadows for atmospheric effect
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 1024;
        this.light.shadow.mapSize.height = 1024;
        this.light.shadow.camera.near = 0.5;
        this.light.shadow.camera.far = 30;
        this.light.shadow.camera.fov = 30;
        
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
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' && this.currentBattery > 0) {
                this.toggle();
            }
        });
    }
    
    toggle() {
        this.isOn = !this.isOn;
        this.updateVisibility();
        console.log(`🔦 Flashlight ${this.isOn ? 'ON' : 'OFF'} | Battery: ${Math.round(this.currentBattery)}%`);
    }
    
    updateVisibility() {
        if (this.isOn && this.currentBattery > 0) {
            this.light.visible = true;
            this.ambientBoost.visible = true;
            this.updateIntensity();
        } else {
            this.light.visible = false;
            this.ambientBoost.visible = false;
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
        // Get camera's world position and direction
        const cameraWorldPos = new THREE.Vector3();
        this.camera.getWorldPosition(cameraWorldPos);

        const cameraWorldDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraWorldDir);

        // Position light slightly offset from camera (like holding a flashlight)
        const rightOffset = new THREE.Vector3();
        rightOffset.crossVectors(cameraWorldDir, new THREE.Vector3(0, 1, 0)).normalize();
        rightOffset.multiplyScalar(0.1); // Smaller offset

        // Set light position closer to camera
        this.light.position.copy(cameraWorldPos);
        this.light.position.add(rightOffset);
        this.light.position.y -= 0.1; // Slightly lower than eye level
        
        // Set target position (point where we're looking)
        this.target.position.copy(cameraWorldPos);
        this.target.position.add(cameraWorldDir.multiplyScalar(10)); // 10 units ahead
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