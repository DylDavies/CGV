// src/systems/SimpleAtmosphere.js - Simple atmosphere with only dust particles

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class SimpleAtmosphere {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.dustParticles = null;

        this.createParticleSystem();
        console.log('✨ Simple atmosphere initialized (dust particles only)');
    }

    createParticleSystem() {
        // Dust particles floating in the air
        const dustGeometry = new THREE.BufferGeometry();
        const dustCount = 1000;
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
            fog: true
        });

        this.dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.dustParticles);
    }

    tick(delta) {
        // Update dust particle positions
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            const velocities = this.dustParticles.geometry.attributes.velocity.array;

            for (let i = 0; i < positions.length; i += 3) {
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
