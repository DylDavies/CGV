// src/systems/MansionLoader.js - Load and manage the mansion model with occlusion culling

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { Pathfinding } from 'https://unpkg.com/three-pathfinding@1.2.0/dist/three-pathfinding.module.js';

class MansionLoader {
    constructor(scene, physicsManager = null) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.model = null;
        this.rooms = new Map(); // Collection name -> room data
        this.physicsBodies = [];

        // --- NEW: Pathfinding Properties ---
        this.pathfinding = new Pathfinding();
        this.navMesh = null;
        this.navMeshVisualizer = null;
        this.ZONE = 'mansion';

        // Occlusion culling settings
        this.frustumCulling = true;
        this.occlusionCulling = true;
        this.playerPosition = new THREE.Vector3();
        this.visibleRooms = new Set();
        this.maxVisibleDistance = 20; // Only show rooms within this distance

        // Lamp system
        this.lamps = [];
        this.lampsEnabled = true;
        this.lampFlickerSpeed = 1.0;

        // Fireplace system
        this.fireplaces = [];
        this.fireplacesEnabled = true;
        this.navMeshNodesVisualizer = null;

        console.log('🏠 MansionLoader initialized');
    }

    async loadMansion(modelPath) {
        console.log('📦 Loading mansion model:', modelPath);

        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();

            loader.load(
                modelPath,
                (gltf) => {
                    console.log('✅ Mansion model loaded successfully');
                    this.model = gltf.scene;

                    // Process the model
                    this.processModel();

                    // Add to scene
                    this.scene.add(this.model);

                    // Hide debug/helper objects
                    this.hideDebugObjects();

                    // Generate physics
                    if (this.physicsManager) {
                        this.generatePhysics();
                    }

                    // Setup lamps (WallLamp, Chandelier, etc.)
                    this.setupLamps();

                    // Setup occlusion culling
                    this.setupOcclusionCulling();

                    console.log(`🏠 Mansion ready with ${this.rooms.size} rooms and ${this.lamps.length} lamps`);
                    resolve(this.model);
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total) * 100;
                    console.log(`⏳ Loading: ${percent.toFixed(1)}%`);
                },
                (error) => {
                    console.error('❌ Error loading mansion:', error);
                    reject(error);
                }
            );
        });
    }

    processModel() {
        console.log('🔍 Processing mansion model...');

        // Performance optimizations and shadow setup
        this.model.traverse((node) => {
            if (node.isMesh) {
                // Disable shadows for most objects - only enable for important ones
                node.castShadow = false;
                node.receiveShadow = false;

                // Enable frustum culling
                node.frustumCulled = true;

                // Optimize materials
                if (node.material) {
                    const material = Array.isArray(node.material) ? node.material[0] : node.material;

                    // Reduce material precision for performance
                    material.precision = 'mediump';

                    // Disable unnecessary features
                    material.flatShading = false;

                    material.needsUpdate = true;
                }

                // Merge geometries for static objects where possible
                if (node.geometry) {
                    node.geometry.computeBoundingSphere();
                }
            }
        });

        // Organize meshes by room collections
        this.organizeByRooms();
    }

    organizeByRooms() {
        console.log('🗂️ Organizing rooms from collections...');

        // Each collection in Blender becomes a group
        this.model.traverse((node) => {
            if (node.type === 'Group' && node.children.length > 0) {
                const roomName = node.name;

                // Calculate room bounds for occlusion culling
                const box = new THREE.Box3().setFromObject(node);
                const center = new THREE.Vector3();
                box.getCenter(center);

                const roomData = {
                    name: roomName,
                    group: node,
                    meshes: [],
                    bounds: box,
                    center: center,
                    visible: true
                };

                // Collect all meshes in this room
                node.traverse((child) => {
                    if (child.isMesh) {
                        roomData.meshes.push(child);
                    }
                });

                this.rooms.set(roomName, roomData);
                console.log(`📍 Room "${roomName}" registered with ${roomData.meshes.length} meshes`);
            }
        });
    }

    generatePhysics() {
        console.log('⚙️ Generating physics collision bodies...');
        console.log('💡 TIP: Run window.gameControls.mansionLoader.listAllObjects() to see all object names');

        let collisionCount = 0;
        let skippedCount = 0;

        // Traverse all meshes and create collision bodies
        this.model.traverse((node) => {
            if (node.isMesh) {
                const nodeName = node.name.toLowerCase();

                // Check parent hierarchy for excluded keywords
                let shouldSkipByHierarchy = false;
                let currentNode = node;
                while (currentNode) {
                    const currentName = currentNode.name.toLowerCase();
                    if (currentName.includes('nocollision') ||
                        currentName.includes('door') ||
                        currentName.includes('opening') ||
                        currentName.includes('doorway')) {
                        shouldSkipByHierarchy = true;
                        console.log(`🚪 Skipping collision (parent hierarchy): ${node.name} (parent: ${currentNode.name})`);
                        break;
                    }
                    currentNode = currentNode.parent;
                }

                if (shouldSkipByHierarchy) {
                    skippedCount++;
                    return;
                }

                // Check if this mesh itself should have collision
                const shouldSkip = nodeName.includes('nocollision') ||
                    nodeName.includes('door') ||  // Any object with "door" in the name
                    nodeName.includes('opening') ||
                    nodeName.includes('doorway');

                if (shouldSkip && !nodeName.includes("entrance")) {
                    console.log(`🚪 Skipping collision for: ${node.name}`);
                    skippedCount++;
                    return;
                }

                // Create physics body based on mesh
                const body = this.createPhysicsBodyFromMesh(node);
                if (body) {
                    this.physicsManager.addBody(body);
                    this.physicsBodies.push({
                        mesh: node,
                        body: body
                    });
                    collisionCount++;
                }
            }
        });

        console.log(`✅ Generated ${collisionCount} physics collision bodies`);
        console.log(`🚪 Skipped ${skippedCount} objects (doors, openings, etc.)`);
    }

    hideDebugObjects() {
        console.log('🔍 Scanning for debug/leftover objects and portraits...');

        let hiddenCount = 0;

        this.model.traverse((node) => {
            if (node.isMesh) {
                const nodeName = node.name.toLowerCase();

                // Check if this is a debug/helper object that should be hidden
                const isDebugObject =
                    nodeName.includes('helper') ||
                    nodeName.includes('debug') ||
                    nodeName.includes('marker') ||
                    nodeName.includes('guide') ||
                    nodeName.includes('gizmo') ||
                    nodeName.includes('temp');

                // Check if this is a portrait/painting that should be hidden
                const isPortrait =
                    nodeName.includes('portrait') ||
                    nodeName.includes('painting') ||
                    nodeName.includes('picture') ||
                    nodeName.includes('frame');

                // Check material for debug colors (bright red, green, blue)
                let hasDebugMaterial = false;
                if (node.material) {
                    const material = Array.isArray(node.material) ? node.material[0] : node.material;
                    if (material.color) {
                        const color = material.color;
                        // Check for pure red (debug color)
                        if (color.r > 0.9 && color.g < 0.1 && color.b < 0.1) {
                            hasDebugMaterial = true;
                        }
                        // Check for pure green
                        if (color.g > 0.9 && color.r < 0.1 && color.b < 0.1) {
                            hasDebugMaterial = true;
                        }
                        // Check for pure blue
                        if (color.b > 0.9 && color.r < 0.1 && color.g < 0.1) {
                            hasDebugMaterial = true;
                        }
                    }
                }

                if (isDebugObject || hasDebugMaterial) {
                    node.visible = false;
                    hiddenCount++;
                    console.log(`👻 Hidden debug object: ${node.name}`);
                } else if (isPortrait) {
                    node.visible = false;
                    hiddenCount++;
                    console.log(`🖼️ Hidden portrait/painting: ${node.name}`);
                }
            }
        });

        console.log(`✅ Hidden ${hiddenCount} debug/helper objects and portraits`);
    }

    createPhysicsBodyFromMesh(mesh) {
        // Get world position and bounding box
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);

        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);

        // Create box-shaped collision body
        const body = this.physicsManager.createBoxBody(center, size);

        return body;
    }

    // --- NEW: Method to load and process the NavMesh ---
    async loadNavMesh(path) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(path, (gltf) => {
                const navMeshNode = gltf.scene.children[0];
                if (!navMeshNode || !navMeshNode.geometry) {
                    console.error('NavMesh GLB must contain a single mesh.');
                    return reject();
                }

                this.navMesh = navMeshNode;
                // Hide the original navmesh model
                this.navMesh.visible = false; 

                console.log('🧠 Building navigation zone...');
                const zone = Pathfinding.createZone(navMeshNode.geometry);
                this.pathfinding.setZoneData(this.ZONE, zone);
                console.log('✅ Navigation mesh created successfully.');

                this.createNavMeshVisualizer();
                this.createNavMeshNodesVisualizer();
                resolve();

            }, undefined, (error) => {
                console.error(`❌ Error loading navigation mesh from ${path}:`, error);
                reject(error);
            });
        });
    }

    // --- NEW: Method to visualize the generated NavMesh ---
    createNavMeshVisualizer() {
        // Note: getNavMesh() is not a standard part of three-pathfinding,
        // we are creating a visual representation from the source geometry.
        const geometry = this.navMesh.geometry;
        const material = new THREE.MeshBasicMaterial({
            color: 0xff00ff, // A bright, obvious magenta color
            wireframe: false, // Turn off wireframe to make it solid
            transparent: true, // Allow transparency
            opacity: 0.5 // Make it 50% transparent to see the floor below
        });
        const visualMesh = new THREE.Mesh(geometry, material);
        
        this.navMeshVisualizer = visualMesh;
        this.navMeshVisualizer.visible = false; // Initially hidden
        this.scene.add(this.navMeshVisualizer);
        console.log("✅ Navigation mesh visualizer created. Toggle with gameControls.toggleNavMeshVisualizer()");
    }

    createNavMeshNodesVisualizer() {
    const zone = this.pathfinding.zones[this.ZONE];
    console.log("Inspecting the navigation zone object:", zone); 
    if (!zone) {
        console.warn("Could not create node visualizer: Zone not found.");
        return;
    }

    const group = new THREE.Group();
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff }); // A bright blue color
    const nodeGeometry = new THREE.SphereGeometry(0.1); // Small spheres for each node

    // The pathfinding library stores nodes in zone.groups[GROUP_ID].nodes
    // We'll assume a single group (groupID = 0) for this NavMesh.
    const navMeshNodes = zone.groups[0];

    for (const node of navMeshNodes) {
        const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
        nodeMesh.position.copy(node.centroid);
        group.add(nodeMesh);
    }

    this.navMeshNodesVisualizer = group;
    this.navMeshNodesVisualizer.visible = false; // Initially hidden
    this.scene.add(this.navMeshNodesVisualizer);
    console.log(`✅ Navigation mesh node visualizer created with ${navMeshNodes.length} nodes.`);
}

toggleNavMeshNodesVisualizer() {
    if (this.navMeshNodesVisualizer) {
        this.navMeshNodesVisualizer.visible = !this.navMeshNodesVisualizer.visible;
        console.log(`NavMesh nodes visualizer ${this.navMeshNodesVisualizer.visible ? 'ON' : 'OFF'}`);
    }
}
    
    // --- NEW: Helper to toggle the visualizer ---
    toggleNavMeshVisualizer() {
        if (this.navMeshVisualizer) {
            this.navMeshVisualizer.visible = !this.navMeshVisualizer.visible;
            console.log(`NavMesh visualizer ${this.navMeshVisualizer.visible ? 'ON' : 'OFF'}`);
        }
    }

    toggleMansionVisibility() {
    if (this.model) {
        this.model.visible = !this.model.visible;
        console.log(`Mansion model visibility ${this.model.visible ? 'ON' : 'OFF'}`);
    }
}


    setupLamps() {
        console.log('💡 Setting up automatic lamp lighting...');

        let lampCount = 0;

        this.model.traverse((node) => {
            const nodeName = node.name.toLowerCase();

            // Check if this object is a lamp (WallLamp, Chandelier, etc.)
            if (nodeName.includes('walllamp') || nodeName.includes('chandelier') ||
                nodeName.includes('lamp') || nodeName.includes('light')) {

                // Get world position of the lamp mesh
                node.updateMatrixWorld(true);
                const lampPosition = new THREE.Vector3();
                node.getWorldPosition(lampPosition);

                // Determine light properties based on lamp type
                let lightColor, lightIntensity, lightDistance;

                if (nodeName.includes('chandelier')) {
                    lightColor = 0xffaa55; // Warm orange candlelight
                    lightIntensity = 3.0; // Brighter
                    lightDistance = 6; // Shorter range to prevent bleeding
                } else if (nodeName.includes('walllamp')) {
                    lightColor = 0xffbb66; // Slightly warmer
                    lightIntensity = 2.5; // Brighter
                    lightDistance = 4; // Shorter range
                } else {
                    lightColor = 0xffcc77; // Generic warm light
                    lightIntensity = 2.0;
                    lightDistance = 5;
                }

                // Create point light - offset for wall lamps using normal direction
                const lampLight = new THREE.PointLight(lightColor, lightIntensity, lightDistance, 2);

                if (nodeName.includes('walllamp')) {
                    // Get the lamp's rotation to determine outward direction
                    const worldQuaternion = new THREE.Quaternion();
                    node.getWorldQuaternion(worldQuaternion);

                    // Try different forward vectors to find the right one
                    // Wall lamps typically face along local +Z axis
                    const forward = new THREE.Vector3(0.5, 0, 0);
                    forward.applyQuaternion(worldQuaternion);
                    forward.normalize();

                    // Offset light outward from wall
                    lampLight.position.copy(lampPosition);
                    lampLight.position.add(forward.multiplyScalar(0.4));
                    lampLight.position.y += 0.1; // Slight upward offset
                } else {
                    // Chandeliers and other lamps - exact position
                    lampLight.position.copy(lampPosition);
                }

                lampLight.castShadow = false;

                // Add light to scene
                this.scene.add(lampLight);

                console.log(`💡 ${node.name}: pos=${lampLight.position.x.toFixed(1)},${lampLight.position.y.toFixed(1)},${lampLight.position.z.toFixed(1)}`);

                // Store lamp data
                const lampData = {
                    mesh: node,
                    light: lampLight,
                    baseIntensity: lightIntensity,
                    flickerPhase: Math.random() * Math.PI * 2,
                    flickerSpeed: 0.5 + Math.random() * 0.5,
                    type: nodeName.includes('chandelier') ? 'chandelier' :
                          nodeName.includes('walllamp') ? 'walllamp' : 'lamp'
                };

                this.lamps.push(lampData);
                lampCount++;
            }

            // Check for fireplace
            if (nodeName.includes('fire') && !nodeName.includes('fireplace')) {
                this.setupFireplace(node);
            }
        });

        console.log(`💡 Added ${lampCount} automatic lights to lamps`);
        console.log(`🔥 Found ${this.fireplaces.length} fireplaces`);
    }

    setupFireplace(fireNode) {
        // Get world position of fire mesh
        fireNode.updateMatrixWorld(true);
        const firePosition = new THREE.Vector3();
        fireNode.getWorldPosition(firePosition);

        // Create fire particle system
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 0.5;     // x
            positions[i + 1] = Math.random() * 0.2;          // y
            positions[i + 2] = (Math.random() - 0.5) * 0.5; // z

            velocities[i] = (Math.random() - 0.5) * 0.02;
            velocities[i + 1] = 0.5 + Math.random() * 0.5; // Rising
            velocities[i + 2] = (Math.random() - 0.5) * 0.02;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

        const material = new THREE.PointsMaterial({
            color: 0xff6600,
            size: 0.15,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const fireParticles = new THREE.Points(geometry, material);
        fireParticles.position.copy(firePosition);
        this.scene.add(fireParticles);

        // Create fire light - shorter range to prevent bleeding
        const fireLight = new THREE.PointLight(0xff6600, 4.0, 6, 2);
        fireLight.position.copy(firePosition);
        this.scene.add(fireLight);

        // Store fireplace data
        const fireplaceData = {
            mesh: fireNode,
            particles: fireParticles,
            light: fireLight,
            baseIntensity: 3.0,
            flickerPhase: Math.random() * Math.PI * 2
        };

        this.fireplaces.push(fireplaceData);
        console.log(`🔥 Added fireplace at: ${firePosition.x.toFixed(1)},${firePosition.y.toFixed(1)},${firePosition.z.toFixed(1)}`);
    }

    setupOcclusionCulling() {
        console.log('👁️ Setting up occlusion culling system...');

        // Enable frustum culling on all meshes
        this.model.traverse((node) => {
            if (node.isMesh) {
                node.frustumCulled = this.frustumCulling;
            }
        });

        // Initialize all rooms as visible
        for (const roomData of this.rooms.values()) {
            this.visibleRooms.add(roomData.name);
        }
    }

    updateOcclusionCulling(cameraPosition) {
        if (!this.occlusionCulling) return;

        this.playerPosition.copy(cameraPosition);

        // Update visibility for each room based on distance
        for (const [roomName, roomData] of this.rooms) {
            const distance = this.playerPosition.distanceTo(roomData.center);
            const shouldBeVisible = distance <= this.maxVisibleDistance;

            // Only update if visibility changed
            if (roomData.visible !== shouldBeVisible) {
                roomData.visible = shouldBeVisible;
                roomData.group.visible = shouldBeVisible;

                if (shouldBeVisible) {
                    this.visibleRooms.add(roomName);
                } else {
                    this.visibleRooms.delete(roomName);
                }
            }
        }
    }

    getCurrentRoom(position) {
        // Find which room the player is currently in
        for (const [roomName, roomData] of this.rooms) {
            if (roomData.bounds.containsPoint(position)) {
                return roomData;
            }
        }
        return null;
    }

    getRoomByName(name) {
        return this.rooms.get(name);
    }

    getAllRooms() {
        return Array.from(this.rooms.values());
    }

    getEntranceRoom() {
        // Try to find entrance room by name
        const entranceNames = ['entrance', 'Entrance', 'Entry', 'entry', 'Foyer', 'foyer'];

        for (const name of entranceNames) {
            const room = this.rooms.get(name);
            if (room) {
                return room;
            }
        }

        // If no entrance found, return first room
        return this.rooms.values().next().value;
    }

    setOcclusionCulling(enabled) {
        this.occlusionCulling = enabled;

        if (!enabled) {
            // Show all rooms
            for (const roomData of this.rooms.values()) {
                roomData.group.visible = true;
                roomData.visible = true;
            }
        }

        console.log(`👁️ Occlusion culling: ${enabled ? 'ON' : 'OFF'}`);
    }

    setMaxVisibleDistance(distance) {
        this.maxVisibleDistance = distance;
        console.log(`👁️ Max visible distance set to: ${distance}`);
    }

    tick(delta, cameraPosition) {
        // Update occlusion culling
        if (cameraPosition) {
            this.updateOcclusionCulling(cameraPosition);
        }

        // Update lamp flickering
        if (this.lampsEnabled) {
            this.updateLampFlickering(delta);
        }

        // Update fireplace effects
        if (this.fireplacesEnabled) {
            this.updateFireplaces(delta);
        }
    }

    updateLampFlickering(delta) {
        const time = Date.now() * 0.001; // Current time in seconds

        for (const lamp of this.lamps) {
            // Calculate flicker using sine wave with some noise
            const flicker = Math.sin(time * lamp.flickerSpeed * this.lampFlickerSpeed + lamp.flickerPhase);
            const noise = Math.random() * 0.1 - 0.05; // Small random variation

            // Vary intensity slightly (90% to 110% of base)
            const intensityVariation = 0.9 + (flicker * 0.05) + noise;
            lamp.light.intensity = lamp.baseIntensity * intensityVariation;
        }
    }

    updateFireplaces(delta) {
        const time = Date.now() * 0.001;

        for (const fireplace of this.fireplaces) {
            // Update fire particles
            const positions = fireplace.particles.geometry.attributes.position.array;
            const velocities = fireplace.particles.geometry.attributes.velocity.array;

            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += velocities[i] * delta * 2;
                positions[i + 1] += velocities[i + 1] * delta * 2;
                positions[i + 2] += velocities[i + 2] * delta * 2;

                // Reset particles that rise too high
                if (positions[i + 1] > 0.7) {
                    positions[i] = (Math.random() - 0.5) * 0.5;
                    positions[i + 1] = 0;
                    positions[i + 2] = (Math.random() - 0.5) * 0.5;
                }
            }

            fireplace.particles.geometry.attributes.position.needsUpdate = true;

            // Flicker fire light
            const flicker = Math.sin(time * 10 + fireplace.flickerPhase);
            const noise = Math.random() * 0.3;
            fireplace.light.intensity = fireplace.baseIntensity * (0.8 + flicker * 0.2 + noise);
        }
    }

    // Lamp control API
    setLampsEnabled(enabled) {
        this.lampsEnabled = enabled;

        // Toggle all lamp lights
        for (const lamp of this.lamps) {
            lamp.light.visible = enabled;
        }

        console.log(`💡 Lamps ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Debug: Show light helpers
    showLightHelpers() {
        console.log('💡 Adding light helpers...');

        for (const lamp of this.lamps) {
            if (!lamp.helper) {
                const helper = new THREE.PointLightHelper(lamp.light, 0.2);
                this.scene.add(helper);
                lamp.helper = helper;
            } else {
                lamp.helper.visible = true;
            }
        }

        console.log(`✅ Showing helpers for ${this.lamps.length} lights`);
    }

    hideLightHelpers() {
        for (const lamp of this.lamps) {
            if (lamp.helper) {
                lamp.helper.visible = false;
            }
        }
        console.log('💡 Light helpers hidden');
    }

    toggleLamps() {
        this.setLampsEnabled(!this.lampsEnabled);
        return this.lampsEnabled;
    }

    setLampIntensity(intensity) {
        // Update base intensity for all lamps
        for (const lamp of this.lamps) {
            lamp.baseIntensity = intensity;
        }
        console.log(`💡 Lamp intensity set to: ${intensity}`);
    }

    setLampFlickerSpeed(speed) {
        this.lampFlickerSpeed = speed;
        console.log(`💡 Lamp flicker speed set to: ${speed}`);
    }

    getLampsByType(type) {
        return this.lamps.filter(lamp => lamp.type === type);
    }

    // Fireplace control API
    setFireplacesEnabled(enabled) {
        this.fireplacesEnabled = enabled;

        for (const fireplace of this.fireplaces) {
            fireplace.particles.visible = enabled;
            fireplace.light.visible = enabled;
        }

        console.log(`🔥 Fireplaces ${enabled ? 'enabled' : 'disabled'}`);
    }

    toggleFireplaces() {
        this.setFireplacesEnabled(!this.fireplacesEnabled);
        return this.fireplacesEnabled;
    }

    getDebugInfo() {
        return {
            totalRooms: this.rooms.size,
            visibleRooms: this.visibleRooms.size,
            physicsBodies: this.physicsBodies.length,
            occlusionCulling: this.occlusionCulling,
            maxVisibleDistance: this.maxVisibleDistance,
            totalLamps: this.lamps.length,
            lampsEnabled: this.lampsEnabled
        };
    }

    // Debug: List all objects in the model
    listAllObjects(filter = '') {
        console.log('📋 Listing all objects in mansion model:');
        const objects = [];

        this.model.traverse((node) => {
            if (node.isMesh) {
                const name = node.name;
                if (!filter || name.toLowerCase().includes(filter.toLowerCase())) {
                    objects.push({
                        name: name,
                        type: node.type,
                        visible: node.visible,
                        hasPhysics: this.physicsBodies.some(pb => pb.mesh === node)
                    });
                }
            }
        });

        console.table(objects);
        console.log(`📊 Total: ${objects.length} objects${filter ? ` (filtered by "${filter}")` : ''}`);
        return objects;
    }

    // Debug: Search for objects by name
    findObjects(searchTerm) {
        console.log(`🔍 Searching for objects containing "${searchTerm}":`);
        return this.listAllObjects(searchTerm);
    }

    // Debug: Show parent hierarchy of an object
    showObjectHierarchy(objectName) {
        console.log(`🌳 Showing hierarchy for "${objectName}":`);

        this.model.traverse((node) => {
            if (node.name.toLowerCase().includes(objectName.toLowerCase())) {
                console.log(`\n📍 Found: ${node.name}`);
                console.log('Hierarchy (from root to object):');

                const hierarchy = [];
                let current = node;
                while (current) {
                    hierarchy.unshift({
                        name: current.name,
                        type: current.type,
                        isMesh: current.isMesh || false
                    });
                    current = current.parent;
                }

                console.table(hierarchy);

                // Check if any parent has "door" in name
                const hassDoorParent = hierarchy.some(item =>
                    item.name.toLowerCase().includes('door')
                );

                console.log(`Has "door" in parent hierarchy: ${hassDoorParent ? '✅ YES' : '❌ NO'}`);
            }
        });
    }

    // Debug: List all groups/collections
    listCollections() {
        console.log('📁 Listing all groups/collections:');
        const collections = [];

        this.model.traverse((node) => {
            if (node.type === 'Group' && node.children.length > 0) {
                collections.push({
                    name: node.name,
                    childCount: node.children.length
                });
            }
        });

        console.table(collections);
        return collections;
    }

    dispose() {
        console.log('🧹 Disposing mansion loader...');

        // Remove physics bodies
        for (const { body } of this.physicsBodies) {
            this.physicsManager.removeBody(body);
        }
        this.physicsBodies = [];

        // Remove all lamp lights from scene
        for (const lamp of this.lamps) {
            if (lamp.light) {
                this.scene.remove(lamp.light);
                if (lamp.light.dispose) lamp.light.dispose();
            }
        }
        this.lamps = [];

        // Remove model from scene
        if (this.model) {
            this.scene.remove(this.model);

            // Dispose geometries and materials
            this.model.traverse((node) => {
                if (node.isMesh) {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(mat => mat.dispose());
                        } else {
                            node.material.dispose();
                        }
                    }
                }
            });
        }

        this.rooms.clear();
        this.visibleRooms.clear();

        console.log('✅ Mansion loader disposed');
    }
}

export { MansionLoader };

