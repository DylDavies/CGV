// src/systems/HorrorAtmosphere.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class HorrorAtmosphere {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.ambientSounds = [];
        this.scareEvents = [];
        this.atmosphericElements = [];
        this.fogIntensity = 0.02;
        this.lightFlickerObjects = [];
        this.paranormalActivity = [];
        
        this.initializeAtmosphere();
    }

    initializeAtmosphere() {
        // Set up fog for limited visibility
        this.scene.fog = new THREE.FogExp2(0x000000, this.fogIntensity);
        
        // Create atmospheric particle system
        this.createParticleSystem();
        
        // Set up dynamic lighting
        this.setupDynamicLighting();
        
        // Initialize scare event system
        this.initializeScareEvents();
        
        // Create ambient horror elements
        this.createAmbientElements();
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

    setupDynamicLighting() {
        // Flickering candles/torches
        this.flickeringLights = [];
        
        // Create some flickering light sources
        for (let i = 0; i < 5; i++) {
            const light = new THREE.PointLight(0xff6600, 0.5, 15, 2);
            light.position.set(
                Math.random() * 40 - 20,
                2 + Math.random() * 2,
                Math.random() * 40 - 20
            );
            
            light.userData = {
                baseIntensity: 0.5,
                flickerSpeed: 1 + Math.random() * 2,
                flickerAmount: 0.3 + Math.random() * 0.4
            };
            
            this.flickeringLights.push(light);
            this.scene.add(light);
        }

        // Occasional lightning flashes
        this.lightning = new THREE.DirectionalLight(0x9999ff, 0);
        this.lightning.position.set(0, 50, 0);
        this.scene.add(this.lightning);
        
        this.lightningTimer = Math.random() * 10000 + 5000; // 5-15 seconds
    }

    initializeScareEvents() {
        this.scareEvents = [
            {
                type: 'shadow_figure',
                probability: 0.02, // 2% chance per second
                cooldown: 30000, // 30 seconds between events
                lastTriggered: 0
            },
            {
                type: 'door_slam',
                probability: 0.01,
                cooldown: 45000,
                lastTriggered: 0
            },
            {
                type: 'whispers',
                probability: 0.015,
                cooldown: 60000,
                lastTriggered: 0
            },
            {
                type: 'object_movement',
                probability: 0.025,
                cooldown: 20000,
                lastTriggered: 0
            },
            {
                type: 'cold_breath',
                probability: 0.008,
                cooldown: 90000,
                lastTriggered: 0
            }
        ];
    }

    createAmbientElements() {
        // Cobwebs
        this.createCobwebs();
        
        // Blood stains and decay
        this.createDecayElements();
        
        // Creepy portraits
        this.createPortraits();
        
        // Floating orbs (paranormal activity)
        this.createParanormalOrbs();
    }

    createCobwebs() {
        for (let i = 0; i < 20; i++) {
            const cobwebGeometry = new THREE.PlaneGeometry(1, 1);
            const cobwebMaterial = new THREE.MeshLambertMaterial({
                color: 0xcccccc,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            
            const cobweb = new THREE.Mesh(cobwebGeometry, cobwebMaterial);
            cobweb.position.set(
                Math.random() * 60 - 30,
                3 + Math.random() * 2,
                Math.random() * 60 - 30
            );
            cobweb.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            this.atmosphericElements.push(cobweb);
            this.scene.add(cobweb);
        }
    }

    createDecayElements() {
        // Blood stains on floors and walls
        for (let i = 0; i < 15; i++) {
            const stainGeometry = new THREE.PlaneGeometry(
                0.5 + Math.random() * 1.5,
                0.5 + Math.random() * 1.5
            );
            const stainMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(0, 0.8, 0.1 + Math.random() * 0.2),
                transparent: true,
                opacity: 0.6
            });
            
            const stain = new THREE.Mesh(stainGeometry, stainMaterial);
            
            if (Math.random() > 0.5) {
                // Floor stain
                stain.rotation.x = -Math.PI / 2;
                stain.position.set(
                    Math.random() * 60 - 30,
                    0.01,
                    Math.random() * 60 - 30
                );
            } else {
                // Wall stain
                stain.position.set(
                    Math.random() * 60 - 30,
                    1 + Math.random() * 2,
                    Math.random() * 60 - 30
                );
            }
            
            this.atmosphericElements.push(stain);
            this.scene.add(stain);
        }
    }

    createPortraits() {
        for (let i = 0; i < 8; i++) {
            const frameGeometry = new THREE.BoxGeometry(2, 2.5, 0.1);
            const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x2F1B14 });
            
            const frame = new THREE.Mesh(frameGeometry, frameMaterial);
            
            // Portrait canvas (dark, ominous)
            const canvasGeometry = new THREE.PlaneGeometry(1.6, 2.1);
            const canvasMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(0.1, 0.3, 0.1 + Math.random() * 0.2)
            });
            
            const portrait = new THREE.Mesh(canvasGeometry, canvasMaterial);
            portrait.position.z = 0.06;
            
            // Add creepy eyes that sometimes glow
            const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const eyeMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xff0000,
                emissive: 0x440000
            });
            
            const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            
            leftEye.position.set(-0.2, 0.3, 0.07);
            rightEye.position.set(0.2, 0.3, 0.07);
            
            portrait.add(leftEye);
            portrait.add(rightEye);
            frame.add(portrait);
            
            frame.position.set(
                Math.random() * 50 - 25,
                2 + Math.random(),
                Math.random() * 50 - 25
            );
            
            frame.userData = {
                type: 'creepy_portrait',
                eyesGlow: false,
                glowTimer: Math.random() * 10000
            };
            
            this.atmosphericElements.push(frame);
            this.scene.add(frame);
        }
    }

    createParanormalOrbs() {
        for (let i = 0; i < 5; i++) {
            const orbGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const orbMaterial = new THREE.MeshLambertMaterial({
                color: 0x00ffff,
                emissive: 0x004444,
                transparent: true,
                opacity: 0.3
            });
            
            const orb = new THREE.Mesh(orbGeometry, orbMaterial);
            orb.position.set(
                Math.random() * 40 - 20,
                1 + Math.random() * 3,
                Math.random() * 40 - 20
            );
            
            orb.userData = {
                type: 'paranormal_orb',
                basePosition: orb.position.clone(),
                movementSpeed: 0.5 + Math.random() * 1,
                movementRadius: 2 + Math.random() * 3,
                phase: Math.random() * Math.PI * 2,
                visible: Math.random() > 0.5
            };
            
            orb.visible = orb.userData.visible;
            this.paranormalActivity.push(orb);
            this.scene.add(orb);
        }
    }

    // Scare event implementations
    triggerShadowFigure() {
        console.log("A shadow figure darts across your vision...");
        
        // Create a temporary shadow figure
        const figureGeometry = new THREE.PlaneGeometry(1, 3);
        const figureMaterial = new THREE.MeshLambertMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.8
        });
        
        const shadowFigure = new THREE.Mesh(figureGeometry, figureMaterial);
        
        // Position it in peripheral vision
        const angle = Math.random() * Math.PI * 2;
        const distance = 8 + Math.random() * 5;
        
        shadowFigure.position.set(
            this.camera.position.x + Math.cos(angle) * distance,
            1.5,
            this.camera.position.z + Math.sin(angle) * distance
        );
        
        shadowFigure.lookAt(this.camera.position);
        this.scene.add(shadowFigure);
        
        // Animate it moving quickly
        const startPos = shadowFigure.position.clone();
        const endPos = startPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
        ));
        
        let progress = 0;
        const animate = () => {
            progress += 0.05;
            shadowFigure.position.lerpVectors(startPos, endPos, progress);
            shadowFigure.material.opacity = 0.8 * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(shadowFigure);
            }
        };
        animate();
    }

    triggerDoorSlam() {
        console.log("A door slams shut somewhere in the mansion...");
        
        // Find nearby doors and animate one
        // For now, just create a sound effect placeholder
        this.createSoundRipple(this.camera.position, 0xff0000, 1);
    }

    triggerWhispers() {
        console.log("You hear whispers in a language you don't understand...");
        
        // Create visual representation of whispers
        for (let i = 0; i < 20; i++) {
            const whisperGeometry = new THREE.RingGeometry(0.1, 0.2, 8);
            const whisperMaterial = new THREE.MeshLambertMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.2
            });
            
            const whisper = new THREE.Mesh(whisperGeometry, whisperMaterial);
            whisper.position.set(
                this.camera.position.x + (Math.random() - 0.5) * 10,
                this.camera.position.y + (Math.random() - 0.5) * 2,
                this.camera.position.z + (Math.random() - 0.5) * 10
            );
            
            this.scene.add(whisper);
            
            // Animate whispers floating away
            const animateWhisper = () => {
                whisper.position.y += 0.02;
                whisper.material.opacity *= 0.98;
                whisper.rotation.z += 0.01;
                
                if (whisper.material.opacity > 0.01) {
                    requestAnimationFrame(animateWhisper);
                } else {
                    this.scene.remove(whisper);
                }
            };
            setTimeout(() => animateWhisper(), i * 100);
        }
    }

    triggerObjectMovement() {
        console.log("Something moves in the shadows...");
        
        // Find a random atmospheric element and move it slightly
        if (this.atmosphericElements.length > 0) {
            const element = this.atmosphericElements[
                Math.floor(Math.random() * this.atmosphericElements.length)
            ];
            
            const originalPos = element.position.clone();
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.5
            );
            
            // Move object slightly
            element.position.add(offset);
            
            // Move it back after a moment
            setTimeout(() => {
                element.position.copy(originalPos);
            }, 2000 + Math.random() * 3000);
        }
    }

    triggerColdBreath() {
        console.log("Your breath becomes visible in the sudden cold...");
        
        // Create breath particles
        const breathGeometry = new THREE.BufferGeometry();
        const breathCount = 50;
        const breathPositions = new Float32Array(breathCount * 3);
        
        for (let i = 0; i < breathCount * 3; i += 3) {
            breathPositions[i] = this.camera.position.x + (Math.random() - 0.5) * 2;
            breathPositions[i + 1] = this.camera.position.y + (Math.random() - 0.5) * 0.5;
            breathPositions[i + 2] = this.camera.position.z + Math.random() * 2;
        }
        
        breathGeometry.setAttribute('position', new THREE.BufferAttribute(breathPositions, 3));
        
        const breathMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.05,
            transparent: true,
            opacity: 0.6
        });
        
        const breathParticles = new THREE.Points(breathGeometry, breathMaterial);
        this.scene.add(breathParticles);
        
        // Animate breath dissipating
        let opacity = 0.6;
        const animate = () => {
            opacity *= 0.95;
            breathMaterial.opacity = opacity;
            
            // Move particles forward
            const positions = breathGeometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 2] += 0.02; // Move forward
                positions[i + 1] += 0.01; // Float up
            }
            breathGeometry.attributes.position.needsUpdate = true;
            
            if (opacity > 0.01) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(breathParticles);
            }
        };
        animate();
        
        // Temporarily increase fog intensity
        const originalFog = this.scene.fog.density;
        this.scene.fog.density = 0.04;
        setTimeout(() => {
            this.scene.fog.density = originalFog;
        }, 5000);
    }

    createSoundRipple(position, color, intensity) {
        // Visual representation of sound
        const rippleGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
        const rippleMaterial = new THREE.MeshLambertMaterial({
            color: color,
            transparent: true,
            opacity: intensity
        });
        
        const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
        ripple.position.copy(position);
        ripple.rotation.x = -Math.PI / 2;
        
        this.scene.add(ripple);
        
        // Animate ripple expanding
        let scale = 1;
        let opacity = intensity;
        const animate = () => {
            scale += 0.1;
            opacity *= 0.95;
            
            ripple.scale.set(scale, scale, 1);
            ripple.material.opacity = opacity;
            
            if (opacity > 0.01) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(ripple);
            }
        };
        animate();
    }

    triggerLightning() {
        this.lightning.intensity = 2;
        
        // Flash duration
        setTimeout(() => {
            this.lightning.intensity = 1;
        }, 100);
        
        setTimeout(() => {
            this.lightning.intensity = 0;
        }, 200);
        
        // Reset timer
        this.lightningTimer = Math.random() * 15000 + 10000;
    }

    updateParticles(delta) {
        // Update dust particles
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            const velocities = this.dustParticles.geometry.attributes.velocity.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += velocities[i];     // x
                positions[i + 1] += velocities[i + 1]; // y
                positions[i + 2] += velocities[i + 2]; // z
                
                // Reset particles that fall too low or move too far
                if (positions[i + 1] < -5) {
                    positions[i + 1] = 20;
                }
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

    updateFlickeringLights(delta) {
        const time = Date.now() * 0.001;
        
        this.flickeringLights.forEach(light => {
            const userData = light.userData;
            const flicker = Math.sin(time * userData.flickerSpeed) * userData.flickerAmount;
            light.intensity = userData.baseIntensity + flicker;
        });
        
        // Lightning timer
        this.lightningTimer -= delta * 1000;
        if (this.lightningTimer <= 0) {
            this.triggerLightning();
        }
    }

    updateParanormalActivity(delta) {
        const time = Date.now() * 0.001;
        
        this.paranormalActivity.forEach(orb => {
            const userData = orb.userData;
            
            // Float around base position
            orb.position.x = userData.basePosition.x + 
                Math.sin(time * userData.movementSpeed + userData.phase) * userData.movementRadius;
            orb.position.z = userData.basePosition.z + 
                Math.cos(time * userData.movementSpeed + userData.phase) * userData.movementRadius;
            orb.position.y = userData.basePosition.y + 
                Math.sin(time * userData.movementSpeed * 2) * 0.5;
            
            // Randomly appear/disappear
            if (Math.random() < 0.002) {
                orb.visible = !orb.visible;
            }
            
            // Pulse opacity
            if (orb.visible) {
                orb.material.opacity = 0.3 + Math.sin(time * 3) * 0.2;
            }
        });
    }

    updateAtmosphericElements(delta) {
        // Update portrait eyes
        this.atmosphericElements.forEach(element => {
            if (element.userData.type === 'creepy_portrait') {
                element.userData.glowTimer -= delta * 1000;
                
                if (element.userData.glowTimer <= 0) {
                    element.userData.eyesGlow = !element.userData.eyesGlow;
                    element.userData.glowTimer = 5000 + Math.random() * 10000;
                    
                    // Update eye glow
                    const portrait = element.children[0];
                    if (portrait) {
                        const eyes = portrait.children;
                        eyes.forEach(eye => {
                            if (element.userData.eyesGlow) {
                                eye.material.emissive.setHex(0xff0000);
                            } else {
                                eye.material.emissive.setHex(0x440000);
                            }
                        });
                    }
                }
            }
        });
    }

    processScareEvents(delta) {
        const currentTime = Date.now();
        
        this.scareEvents.forEach(event => {
            if (currentTime - event.lastTriggered > event.cooldown) {
                if (Math.random() < event.probability * delta) {
                    switch (event.type) {
                        case 'shadow_figure':
                            this.triggerShadowFigure();
                            break;
                        case 'door_slam':
                            this.triggerDoorSlam();
                            break;
                        case 'whispers':
                            this.triggerWhispers();
                            break;
                        case 'object_movement':
                            this.triggerObjectMovement();
                            break;
                        case 'cold_breath':
                            this.triggerColdBreath();
                            break;
                    }
                    event.lastTriggered = currentTime;
                }
            }
        });
    }

    intensifyAtmosphere() {
        // Increase fog
        this.scene.fog.density = Math.min(this.scene.fog.density * 1.5, 0.05);
        
        // Make lights dimmer
        this.flickeringLights.forEach(light => {
            light.userData.baseIntensity *= 0.8;
        });
        
        // Increase paranormal activity
        this.paranormalActivity.forEach(orb => {
            orb.userData.movementSpeed *= 1.2;
            orb.visible = true;
        });
    }

    calmatmosphere() {
        // Reduce fog
        this.scene.fog.density = Math.max(this.scene.fog.density * 0.8, this.fogIntensity);
        
        // Restore lights
        this.flickeringLights.forEach(light => {
            light.userData.baseIntensity = Math.min(light.userData.baseIntensity * 1.1, 0.5);
        });
    }

    tick(delta) {
        this.updateParticles(delta);
        this.updateFlickeringLights(delta);
        this.updateParanormalActivity(delta);
        this.updateAtmosphericElements(delta);
        this.processScareEvents(delta);
    }

    // Cleanup method
    dispose() {
        // Remove all atmospheric elements
        this.atmosphericElements.forEach(element => {
            this.scene.remove(element);
        });
        
        this.paranormalActivity.forEach(orb => {
            this.scene.remove(orb);
        });
        
        this.flickeringLights.forEach(light => {
            this.scene.remove(light);
        });
        
        if (this.dustParticles) {
            this.scene.remove(this.dustParticles);
        }
        
        this.scene.remove(this.lightning);
    }
}

export { HorrorAtmosphere };