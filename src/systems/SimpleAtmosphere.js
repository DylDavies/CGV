// src/systems/SimpleAtmosphere.js - Simple atmosphere with only dust particles

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class SimpleAtmosphere {
    constructor(scene, camera, qualityPreset = 'medium') {
        this.scene = scene;
        this.camera = camera;
        this.dustParticles = null;

        // Performance optimization: staggered particle updates
        this.updateGroup = 0; // Which quarter of particles to update this frame
        this.groupsPerFrame = 4; // Update 1/4 of particles per frame

        // Set quality preset
        this.setQualityPreset(qualityPreset);

        this.createParticleSystem();

        // Listen for quality changes
        window.addEventListener('qualitychange', (e) => {
            this.setQualityPreset(e.detail.quality);
            this.recreateParticleSystem();
        });

        console.log(`✨ Simple atmosphere initialized (${qualityPreset} quality)`);
    }

    setQualityPreset(preset) {
        const presets = {
            low: { dustParticles: 150 },
            medium: { dustParticles: 250 },
            high: { dustParticles: 500 },
            ultra: { dustParticles: 1000 }
        };

        const settings = presets[preset] || presets.medium;
        this.dustParticleCount = settings.dustParticles;

        console.log(`🎨 Quality preset "${preset}" applied to Atmosphere`);
    }

    recreateParticleSystem() {
        // Remove old particles
        if (this.dustParticles) {
            this.scene.remove(this.dustParticles);
            this.dustParticles.geometry.dispose();
            this.dustParticles.material.dispose();
        }

        // Create new with updated settings
        this.createParticleSystem();
        console.log('🔄 Particle system recreated with new quality settings');
    }

    createParticleSystem() {
        // Dust particles floating in the air - count based on quality setting
        const dustGeometry = new THREE.BufferGeometry();
        const dustCount = this.dustParticleCount;
        const dustPositions = new Float32Array(dustCount * 3);
        const dustVelocities = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount * 3; i += 3) {
            dustPositions[i] = (Math.random() - 0.5) * 200;     // x
            dustPositions[i + 1] = Math.random() * 20;          // y
            dustPositions[i + 2] = (Math.random() - 0.5) * 200; // z

            dustVelocities[i] = (Math.random() - 0.5) * 0.02;     // x velocity
            dustVelocities[i + 1] = -Math.random() * 0.01;        // y velocity (falling)
            dustVelocities[i + 2] = (Math.random() - 0.5) * 0.02; // z velocity
        }

        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        dustGeometry.setAttribute('velocity', new THREE.BufferAttribute(dustVelocities, 3));

        const dustMaterial = new THREE.PointsMaterial({
            color: 0x888888,
            size: 0.1,
            transparent: true,
            opacity: 0.3,
            fog: true,
            sizeAttenuation: true
        });

        this.dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.dustParticles);

        // Performance: Set static draw usage hint
        dustGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    }

    tick(delta) {
        // Update dust particle positions
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            const velocities = this.dustParticles.geometry.attributes.velocity.array;

            // Performance: Only update 1/4 of particles per frame (rotate through groups)
            const particlesPerGroup = Math.floor(positions.length / (this.groupsPerFrame * 3));
            const startIndex = this.updateGroup * particlesPerGroup * 3;
            const endIndex = Math.min(startIndex + particlesPerGroup * 3, positions.length);

            for (let i = startIndex; i < endIndex; i += 3) {
                // Update positions based on velocity
                positions[i] += velocities[i];
                positions[i + 1] += velocities[i + 1];
                positions[i + 2] += velocities[i + 2];

                // Reset particles that fall too low
                if (positions[i + 1] < 0) {
                    positions[i + 1] = 20;
                }

                // Keep particles within bounds
                if (Math.abs(positions[i]) > 100) {
                    positions[i] = (Math.random() - 0.5) * 200;
                }
                if (Math.abs(positions[i + 2]) > 100) {
                    positions[i + 2] = (Math.random() - 0.5) * 200;
                }
            }

            // Rotate to next group for next frame
            this.updateGroup = (this.updateGroup + 1) % this.groupsPerFrame;

            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    dispose() {
        if (this.dustParticles) {
            this.scene.remove(this.dustParticles);
            this.dustParticles.geometry.dispose();
            this.dustParticles.material.dispose();
        }
        console.log('🧹 Simple atmosphere disposed');
    }
}

export { SimpleAtmosphere };
