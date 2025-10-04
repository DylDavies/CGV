// src/systems/MansionLoader.js - Load and manage the mansion model with occlusion culling

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { Pathfinding } from 'https://unpkg.com/three-pathfinding@1.2.0/dist/three-pathfinding.module.js';

class MansionLoader {
    constructor(scene, physicsManager = null, qualityPreset = 'medium') {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.model = null;
        this.rooms = new Map();
        this.physicsBodies = [];
        this.pages = [];
        this.pageSlots = []; // Array to store the puzzle slot objects
        this.glowingSymbols = []; // NEW: An array to hold symbols that need to animate.

        // --- NEW: Pathfinding Properties ---
        this.pathfinding = new Pathfinding();
        this.navMesh = null;
        this.navMeshVisualizer = null;
        this.ZONE = 'mansion';

        // Quality settings
        this.setQualityPreset(qualityPreset);

        // Occlusion culling settings
        this.frustumCulling = true;
        this.occlusionCulling = true;
        this.playerPosition = new THREE.Vector3();
        this.visibleRooms = new Set();

        // Lamp system
        this.lamps = [];
        this.lampsEnabled = true;
        this.lampFlickerSpeed = 1.0;

        // Fireplace system
        this.fireplaces = [];
        this.fireplacesEnabled = true;
        this.navMeshNodesVisualizer = null;

        // Material caching for performance
        this.materialCache = new Map();

        // Listen for quality changes
        window.addEventListener('qualitychange', (e) => {
            this.setQualityPreset(e.detail.quality);
            this.recreateFireplaces();
        });

        console.log(`🏠 MansionLoader initialized (${qualityPreset} quality)`);
    }

    setQualityPreset(preset) {
        const presets = {
            low: {
                fireParticles: 15,
                lampUpdateRate: 4,
                fireplaceUpdateRate: 4,
                maxVisibleDistance: 12,
                maxActiveLights: 6
            },
            medium: {
                fireParticles: 25,
                lampUpdateRate: 3,
                fireplaceUpdateRate: 3,
                maxVisibleDistance: 15,
                maxActiveLights: 8
            },
            high: {
                fireParticles: 50,
                lampUpdateRate: 2,
                fireplaceUpdateRate: 2,
                maxVisibleDistance: 20,
                maxActiveLights: 12
            },
            ultra: {
                fireParticles: 100,
                lampUpdateRate: 1,
                fireplaceUpdateRate: 1,
                maxVisibleDistance: 25,
                maxActiveLights: 15
            }
        };

        const settings = presets[preset] || presets.medium;
        this.fireParticleCount = settings.fireParticles;
        this.lampUpdateRate = settings.lampUpdateRate;
        this.fireplaceUpdateRate = settings.fireplaceUpdateRate;
        this.maxVisibleDistance = settings.maxVisibleDistance;
        this.maxActiveLights = settings.maxActiveLights;

        console.log(`🎨 Quality preset "${preset}" applied to MansionLoader`);
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

                    this.processModel();
                    this.setupPageEffects();
                    this.setupPuzzleSlots(); // Find and prepare the puzzle slots on the wall

                    this.scene.add(this.model);
                    this.hideDebugObjects();

                    if (this.physicsManager) {
                        this.generatePhysics();
                    }

                    this.setupLamps();
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
        console.log('🔍 Processing mansion model - optimizing Blender materials...');
        let totalMeshes = 0;
        let sharedMaterials = 0;
        const materialMap = new Map();

        this.model.traverse((node) => {
            if (node.isMesh) {
                totalMeshes++;
                node.castShadow = false;
                node.receiveShadow = false;
                node.frustumCulled = true;

                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach((material, index) => {
                        const key = this.getMaterialKey(material);
                        if (!materialMap.has(key)) {
                            this.optimizeMaterial(material);
                            materialMap.set(key, material);
                        } else {
                            const existingMaterial = materialMap.get(key);
                            if (Array.isArray(node.material)) {
                                node.material[index] = existingMaterial;
                            } else {
                                node.material = existingMaterial;
                            }
                            sharedMaterials++;
                        }
                    });
                }
                if (node.geometry) {
                    node.geometry.computeBoundingSphere();
                    if (node.geometry.attributes.uv2) node.geometry.deleteAttribute('uv2');
                    if (node.geometry.attributes.tangent) node.geometry.deleteAttribute('tangent');
                }
            }
        });

        console.log(`♻️ Material optimization complete:`);
        console.log(`   Total meshes: ${totalMeshes}`);
        console.log(`   Unique materials: ${materialMap.size}`);
        console.log(`   Materials shared: ${sharedMaterials}`);

        this.materialCache = materialMap;
        this.organizeByRooms();
    }

    setupPageEffects() {
        console.log('✨ Searching for pages to apply glow effect...');
        this.model.traverse((node) => {
            if (node.isMesh && node.userData.type === 'page') {
                console.log(`✨ Found page: ${node.name}. Applying glow effect.`);
                node.material = node.material.clone();
                node.material.emissive = new THREE.Color(0xff0000);
                node.material.emissiveIntensity = 0;
                this.pages.push(node);
            }
        });
    }

    setupPuzzleSlots() {
        console.log('🔍 Searching for page puzzle slots...');
        const slotMaterial = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });

        this.model.traverse((node) => {
            if (node.userData.type === 'page_slot') {
                console.log(`🔍 Found page slot: ${node.name}`);
                // Make the placeholder slot visible with a subtle material
                node.visible = true;
                node.material = slotMaterial;
                this.pageSlots[node.userData.slotIndex] = node;
            }
        });
    }

    displayPageOnSlot(slotIndex, pageId) {
        const slotObject = this.pageSlots[slotIndex];
        if (!slotObject) {
            console.error(`Could not find page slot with index ${slotIndex}`);
            return;
        }

        const pageIndex = this.pages.findIndex(p => p.name === pageId);
        if (pageIndex === -1) {
            console.error(`Could not find page object with ID ${pageId} to place. It might have already been placed.`);
            return;
        }
        
        const pageObject = this.pages[pageIndex];

        // The page was removed from the scene, re-add it
        this.scene.add(pageObject);

        // Get the world position and rotation of the slot
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        slotObject.getWorldPosition(worldPosition);
        slotObject.getWorldQuaternion(worldQuaternion);
        
        // Apply the world coordinates to the page
        pageObject.position.copy(worldPosition);
        pageObject.quaternion.copy(worldQuaternion);
        
        // Add a small offset along the object's normal to prevent z-fighting with the wall
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pageObject.quaternion);
        pageObject.position.add(normal.multiplyScalar(0.01));

        // Make the page visible again and stop its glow
        pageObject.visible = true;
        pageObject.material.emissiveIntensity = 0;

        // Remove the page from the animation array so it no longer pulses
        this.pages.splice(pageIndex, 1);

         // NEW: Add this line to create a reference between the slot and the page object.
        slotObject.userData.placedPage = pageObject;
    }

    activatePageSymbolGlow(pageId) {
        const pageObject = this.scene.getObjectByName(pageId);
        if (!pageObject) {
            console.warn(`Could not find page ${pageId} to activate symbol glow.`);
            return;
        }

        // Find the symbol mesh using the naming convention (e.g., "S_Page1_Symbol").
        const symbolName = `${pageId}_Symbol`;
        const symbolMesh = pageObject.getObjectByName(symbolName);

        if (symbolMesh) {
            console.log(`✨ Activating glow for symbol: ${symbolName}`);
            // Clone the material to ensure we're not affecting other objects.
            symbolMesh.material = symbolMesh.material.clone();
            
            // Set the emissive (glow) color to red.
            symbolMesh.material.emissive.setHex(0xff0000);
            
            // Add it to our array for animation in the tick method.
            this.glowingSymbols.push(symbolMesh);
        } else {
            console.warn(`Could not find a symbol mesh named "${symbolName}" inside ${pageId}.`);
        }
    }

    tick(delta, cameraPosition) {
        if (cameraPosition) this.updateOcclusionCulling(cameraPosition);
        if (this.lampsEnabled) this.updateLampFlickering(delta);
        if (this.fireplacesEnabled) this.updateFireplaces(delta);
        this.updatePageGlow();

        // NEW: Add this loop to animate the glowing symbols.
        // This creates a pulsing effect.
        if (this.glowingSymbols.length > 0) {
            const time = Date.now() * 0.005;
            const pulse = (Math.sin(time) + 1) / 2; // oscillates between 0 and 1
            this.glowingSymbols.forEach(symbol => {
                symbol.material.emissiveIntensity = 1 + pulse * 1.5; // Pulse between 1 and 2.5
            });
        }
    }

    hidePageOnSlot(slotIndex) {
        const slotObject = this.pageSlots[slotIndex];
        if (slotObject && slotObject.userData.placedPage) {
            const pageObject = slotObject.userData.placedPage;

            // Make the page object invisible.
            pageObject.visible = false;
            
            // Add it back to the main `pages` array so it can be animated/interacted with again.
            this.pages.push(pageObject);
            
            // Clear the reference from the slot.
            slotObject.userData.placedPage = null;
        }
    }

    optimizeMaterial(material) {
        material.precision = 'mediump';
        material.flatShading = false;
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
            if (material.roughness !== undefined && material.roughness > 0.95) material.roughness = 1;
            if (material.metalness !== undefined && material.metalness < 0.05) material.metalness = 0;
            if (!material.envMap) material.envMapIntensity = 0;
        }
        material.needsUpdate = true;
    }

    getMaterialKey(material) {
        const props = {
            type: material.type,
            color: material.color ? material.color.getHex() : 0,
            opacity: material.opacity || 1,
            transparent: material.transparent || false,
            map: material.map ? material.map.uuid : 'none',
            roughness: material.roughness || 0,
            metalness: material.metalness || 0
        };
        return JSON.stringify(props);
    }

    organizeByRooms() {
        console.log('🗂️ Organizing rooms from collections...');

        this.model.traverse((node) => {
            if (node.type === 'Group' && node.children.length > 0) {
                const roomName = node.name;

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

        let collisionCount = 0;
        let skippedCount = 0;

        this.model.traverse((node) => {
            if (node.isMesh) {
                const nodeName = node.name.toLowerCase();

                let shouldSkipByHierarchy = false;
                let currentNode = node;
                while (currentNode) {
                    const currentName = currentNode.name.toLowerCase();
                    if (currentName.includes('nocollision') ||
                        currentName.includes('door') ||
                        currentName.includes('opening') ||
                        currentName.includes('doorway')) {
                        shouldSkipByHierarchy = true;
                        break;
                    }
                    currentNode = currentNode.parent;
                }

                if (shouldSkipByHierarchy) {
                    skippedCount++;
                    return;
                }

                const shouldSkip = nodeName.includes('nocollision') ||
                    nodeName.includes('door') ||
                    nodeName.includes('opening') ||
                    nodeName.includes('doorway');

                if (shouldSkip && !nodeName.includes("entrance")) {
                    skippedCount++;
                    return;
                }

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
                const isDebugObject = nodeName.includes('helper') || nodeName.includes('debug') || nodeName.includes('marker') || nodeName.includes('guide') || nodeName.includes('gizmo') || nodeName.includes('temp');
                const isPortrait = nodeName.includes('portrait') || nodeName.includes('painting') || nodeName.includes('picture') || nodeName.includes('frame');
                let hasDebugMaterial = false;
                if (node.material) {
                    const material = Array.isArray(node.material) ? node.material[0] : node.material;
                    if (material.color) {
                        const color = material.color;
                        if (color.r > 0.9 && color.g < 0.1 && color.b < 0.1) hasDebugMaterial = true;
                        if (color.g > 0.9 && color.r < 0.1 && color.b < 0.1) hasDebugMaterial = true;
                        if (color.b > 0.9 && color.r < 0.1 && color.g < 0.1) hasDebugMaterial = true;
                    }
                }
                if (isDebugObject || hasDebugMaterial) {
                    node.visible = false;
                    hiddenCount++;
                } else if (isPortrait) {
                    node.visible = false;
                    hiddenCount++;
                }
            }
        });
        console.log(`✅ Hidden ${hiddenCount} debug/helper objects and portraits`);
    }

    createPhysicsBodyFromMesh(mesh) {
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        if (box.isEmpty()) return null;
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        if (isNaN(center.x) || isNaN(center.y) || isNaN(center.z)) return null;
        if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z)) return null;
        const body = this.physicsManager.createBoxBody(center, size);
        return body;
    }

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

    createNavMeshVisualizer() {
        const geometry = this.navMesh.geometry;
        const material = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            wireframe: false,
            transparent: true,
            opacity: 0.5
        });
        const visualMesh = new THREE.Mesh(geometry, material);
        this.navMeshVisualizer = visualMesh;
        this.navMeshVisualizer.visible = false;
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
        const nodeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff
        });
        const nodeGeometry = new THREE.SphereGeometry(0.1);
        const navMeshNodes = zone.groups[0];
        for (const node of navMeshNodes) {
            const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
            nodeMesh.position.copy(node.centroid);
            group.add(nodeMesh);
        }
        this.navMeshNodesVisualizer = group;
        this.navMeshNodesVisualizer.visible = false;
        this.scene.add(this.navMeshNodesVisualizer);
        console.log(`✅ Navigation mesh node visualizer created with ${navMeshNodes.length} nodes.`);
    }

    toggleNavMeshNodesVisualizer() {
        if (this.navMeshNodesVisualizer) {
            this.navMeshNodesVisualizer.visible = !this.navMeshNodesVisualizer.visible;
            console.log(`NavMesh nodes visualizer ${this.navMeshNodesVisualizer.visible ? 'ON' : 'OFF'}`);
        }
    }

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
            if (nodeName.includes('walllamp') || nodeName.includes('chandelier') || nodeName.includes('lamp') || nodeName.includes('light')) {
                node.updateMatrixWorld(true);
                const lampPosition = new THREE.Vector3();
                node.getWorldPosition(lampPosition);
                let lightColor, lightIntensity, lightDistance;
                if (nodeName.includes('chandelier')) {
                    lightColor = 0xffaa55;
                    lightIntensity = 2.0;
                    lightDistance = 4;
                } else if (nodeName.includes('walllamp')) {
                    lightColor = 0xffbb66;
                    lightIntensity = 1.5;
                    lightDistance = 3;
                } else {
                    lightColor = 0xffcc77;
                    lightIntensity = 1.5;
                    lightDistance = 4;
                }
                const lampLight = new THREE.PointLight(lightColor, lightIntensity, lightDistance, 3);
                if (nodeName.includes('walllamp')) {
                    const worldQuaternion = new THREE.Quaternion();
                    node.getWorldQuaternion(worldQuaternion);
                    const forward = new THREE.Vector3(0.5, 0, 0);
                    forward.applyQuaternion(worldQuaternion);
                    forward.normalize();
                    lampLight.position.copy(lampPosition);
                    lampLight.position.add(forward.multiplyScalar(0.4));
                    lampLight.position.y += 0.1;
                } else {
                    lampLight.position.copy(lampPosition);
                }
                lampLight.castShadow = false;
                lampLight.visible = true;
                this.scene.add(lampLight);
                if (lampCount < 3) {
                    console.log(`💡 ${node.name}: pos=${lampLight.position.x.toFixed(1)},${lampLight.position.y.toFixed(1)},${lampLight.position.z.toFixed(1)}`);
                }
                const lampData = {
                    mesh: node,
                    light: lampLight,
                    baseIntensity: lightIntensity,
                    flickerPhase: Math.random() * Math.PI * 2,
                    flickerSpeed: 0.5 + Math.random() * 0.5,
                    type: nodeName.includes('chandelier') ? 'chandelier' : nodeName.includes('walllamp') ? 'walllamp' : 'lamp'
                };
                this.lamps.push(lampData);
                lampCount++;
            }
            if (nodeName.includes('fire') && !nodeName.includes('fireplace')) {
                this.setupFireplace(node);
            }
        });
        console.log(`💡 Added ${lampCount} automatic lights to lamps`);
        console.log(`🔥 Found ${this.fireplaces.length} fireplaces`);
    }

    recreateFireplaces() {
        console.log('🔄 Recreating fireplaces with new quality settings...');
        for (const fireplace of this.fireplaces) {
            this.scene.remove(fireplace.particles);
            this.scene.remove(fireplace.light);
            fireplace.particles.geometry.dispose();
            fireplace.particles.material.dispose();
        }
        const fireNodes = this.fireplaces.map(f => f.mesh);
        this.fireplaces = [];
        for (const fireNode of fireNodes) {
            this.setupFireplace(fireNode);
        }
        console.log(`✅ Recreated ${this.fireplaces.length} fireplaces`);
    }

    setupFireplace(fireNode) {
        fireNode.updateMatrixWorld(true);
        const firePosition = new THREE.Vector3();
        fireNode.getWorldPosition(firePosition);
        const particleCount = this.fireParticleCount;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 0.5;
            positions[i + 1] = Math.random() * 0.2;
            positions[i + 2] = (Math.random() - 0.5) * 0.5;
            velocities[i] = (Math.random() - 0.5) * 0.02;
            velocities[i + 1] = 0.5 + Math.random() * 0.5;
            velocities[i + 2] = (Math.random() - 0.5) * 0.02;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
        const material = new THREE.PointsMaterial({
            color: 0xff6600,
            size: 0.15,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        const fireParticles = new THREE.Points(geometry, material);
        fireParticles.position.copy(firePosition);
        this.scene.add(fireParticles);
        const fireLight = new THREE.PointLight(0xff6600, 4.0, 6, 2);
        fireLight.position.copy(firePosition);
        this.scene.add(fireLight);
        const fireplaceData = {
            mesh: fireNode,
            particles: fireParticles,
            light: fireLight,
            baseIntensity: 3.0,
            flickerPhase: Math.random() * Math.PI * 2
        };
        this.fireplaces.push(fireplaceData);
    }

    setupOcclusionCulling() {
        console.log('👁️ Setting up occlusion culling system...');
        let meshCount = 0;
        this.model.traverse((node) => {
            if (node.isMesh) {
                node.frustumCulled = true;
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => mat.side = THREE.FrontSide);
                    } else {
                        node.material.side = THREE.FrontSide;
                    }
                }
                meshCount++;
            }
        });
        console.log(`👁️ Frustum culling enabled on ${meshCount} meshes`);
        for (const roomData of this.rooms.values()) {
            this.visibleRooms.add(roomData.name);
        }
    }

    updateOcclusionCulling(cameraPosition) {
        if (!this.occlusionCulling) return;
        this.playerPosition.copy(cameraPosition);
        for (const [roomName, roomData] of this.rooms) {
            const distance = this.playerPosition.distanceTo(roomData.center);
            const shouldBeVisible = distance <= this.maxVisibleDistance;
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
        for (const [, roomData] of this.rooms) {
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
        const entranceNames = ['entrance', 'Entrance', 'Entry', 'entry', 'Foyer', 'foyer'];
        for (const name of entranceNames) {
            const room = this.rooms.get(name);
            if (room) return room;
        }
        return this.rooms.values().next().value;
    }

    getEntranceDoorSpawnPoint() {
        let entranceDoor = null;
        this.model.traverse((node) => {
            if (node.name.toLowerCase() === 's_entrance001') {
                entranceDoor = node;
            }
        });
        if (entranceDoor) {
            entranceDoor.updateMatrixWorld(true);
            const doorPosition = new THREE.Vector3();
            entranceDoor.getWorldPosition(doorPosition);
            if (isNaN(doorPosition.x) || isNaN(doorPosition.y) || isNaN(doorPosition.z)) return null;
            const worldQuaternion = new THREE.Quaternion();
            entranceDoor.getWorldQuaternion(worldQuaternion);
            const forward = new THREE.Vector3(-1, 2, -2);
            forward.applyQuaternion(worldQuaternion);
            forward.normalize();
            const spawnPoint = doorPosition.clone();
            spawnPoint.add(forward.multiplyScalar(2.0));
            spawnPoint.y += 0.5;
            spawnPoint.x += 0.5;
            if (isNaN(spawnPoint.x) || isNaN(spawnPoint.y) || isNaN(spawnPoint.z)) return null;
            return spawnPoint;
        }
        return null;
    }

    setOcclusionCulling(enabled) {
        this.occlusionCulling = enabled;
        if (!enabled) {
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


    updatePageGlow() {
        const time = Date.now() * 0.005;
        const pulseIntensity = (Math.sin(time) + 1) / 2;
        for (const page of this.pages) {
            if (page.material) {
                page.material.emissiveIntensity = 0.5 + pulseIntensity;
            }
        }
    }

    updateLampFlickering(delta) {
        const time = Date.now() * 0.001;
        const playerPos = this.playerPosition;
        this.lampUpdateCounter = (this.lampUpdateCounter || 0) + 1;
        if (this.lampUpdateCounter % this.lampUpdateRate !== 0) return;
        const playerPosSet = playerPos.length() > 0.1;
        if (playerPosSet) {
            let activeLights = 0;
            const lampDistances = this.lamps.map(lamp => ({
                lamp,
                distance: lamp.light.position.distanceTo(playerPos)
            }));
            lampDistances.sort((a, b) => a.distance - b.distance);
            for (const {
                    lamp,
                    distance
                } of lampDistances) {
                if (distance < lamp.light.distance * 2.5 && activeLights < this.maxActiveLights) {
                    lamp.light.visible = true;
                    const flicker = Math.sin(time * lamp.flickerSpeed * this.lampFlickerSpeed + lamp.flickerPhase);
                    const noise = Math.random() * 0.1 - 0.05;
                    lamp.light.intensity = lamp.baseIntensity * (0.9 + flicker * 0.05 + noise);
                    activeLights++;
                } else if (activeLights >= this.maxActiveLights) {
                    lamp.light.intensity *= 0.95;
                    if (lamp.light.intensity < 0.1) lamp.light.visible = false;
                }
            }
        } else {
            for (const lamp of this.lamps) {
                lamp.light.visible = true;
                const flicker = Math.sin(time * lamp.flickerSpeed * this.lampFlickerSpeed + lamp.flickerPhase);
                const noise = Math.random() * 0.1 - 0.05;
                lamp.light.intensity = lamp.baseIntensity * (0.9 + flicker * 0.05 + noise);
            }
        }
    }

    updateFireplaces(delta) {
        const time = Date.now() * 0.001;
        this.fireplaceUpdateCounter = (this.fireplaceUpdateCounter || 0) + 1;
        const shouldUpdateParticles = this.fireplaceUpdateCounter % this.fireplaceUpdateRate === 0;
        for (const fireplace of this.fireplaces) {
            if (shouldUpdateParticles) {
                const positions = fireplace.particles.geometry.attributes.position.array;
                const velocities = fireplace.particles.geometry.attributes.velocity.array;
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] += velocities[i] * delta * 2;
                    positions[i + 1] += velocities[i + 1] * delta * 2;
                    positions[i + 2] += velocities[i + 2] * delta * 2;
                    if (positions[i + 1] > 0.7) {
                        positions[i] = (Math.random() - 0.5) * 0.5;
                        positions[i + 1] = 0;
                        positions[i + 2] = (Math.random() - 0.5) * 0.5;
                    }
                }
                fireplace.particles.geometry.attributes.position.needsUpdate = true;
            }
            const flicker = Math.sin(time * 10 + fireplace.flickerPhase);
            const noise = Math.random() * 0.3;
            fireplace.light.intensity = fireplace.baseIntensity * (0.8 + flicker * 0.2 + noise);
        }
    }

    setLampsEnabled(enabled) {
        this.lampsEnabled = enabled;
        for (const lamp of this.lamps) lamp.light.visible = enabled;
        console.log(`💡 Lamps ${enabled ? 'enabled' : 'disabled'}`);
    }
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
        for (const lamp of this.lamps)
            if (lamp.helper) lamp.helper.visible = false;
        console.log('💡 Light helpers hidden');
    }
    toggleLamps() {
        this.setLampsEnabled(!this.lampsEnabled);
        return this.lampsEnabled;
    }
    setLampIntensity(intensity) {
        for (const lamp of this.lamps) lamp.baseIntensity = intensity;
        console.log(`💡 Lamp intensity set to: ${intensity}`);
    }
    setLampFlickerSpeed(speed) {
        this.lampFlickerSpeed = speed;
        console.log(`💡 Lamp flicker speed set to: ${speed}`);
    }
    getLampsByType(type) {
        return this.lamps.filter(lamp => lamp.type === type);
    }
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
        const activeLamps = this.lamps.filter(l => l.light.visible).length;
        return {
            totalRooms: this.rooms.size,
            visibleRooms: this.visibleRooms.size,
            physicsBodies: this.physicsBodies.length,
            occlusionCulling: this.occlusionCulling,
            maxVisibleDistance: this.maxVisibleDistance,
            totalLamps: this.lamps.length,
            activeLamps: activeLamps,
            lampsEnabled: this.lampsEnabled,
            sharedMaterials: Object.keys(this.sharedMaterials).length,
            cachedMaterials: this.materialCache.size
        };
    }
    listAllObjects(filter = '') {
        console.log('📋 Listing all objects in mansion model:');
        const objects = [];
        this.model.traverse((node) => {
            if (node.isMesh) {
                const name = node.name;
                if (!filter || name.toLowerCase().includes(filter.toLowerCase())) objects.push({
                    name: name,
                    type: node.type,
                    visible: node.visible,
                    hasPhysics: this.physicsBodies.some(pb => pb.mesh === node)
                });
            }
        });
        console.table(objects);
        console.log(`📊 Total: ${objects.length} objects${filter ? ` (filtered by "${filter}")` : ''}`);
        return objects;
    }
    findObjects(searchTerm) {
        console.log(`🔍 Searching for objects containing "${searchTerm}":`);
        return this.listAllObjects(searchTerm);
    }
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
                const hassDoorParent = hierarchy.some(item => item.name.toLowerCase().includes('door'));
                console.log(`Has "door" in parent hierarchy: ${hassDoorParent ? '✅ YES' : '❌ NO'}`);
            }
        });
    }
    listCollections() {
        console.log('📁 Listing all groups/collections:');
        const collections = [];
        this.model.traverse((node) => {
            if (node.type === 'Group' && node.children.length > 0) collections.push({
                name: node.name,
                childCount: node.children.length
            });
        });
        console.table(collections);
        return collections;
    }
    dispose() {
        console.log('🧹 Disposing mansion loader...');
        for (const {
                body
            } of this.physicsBodies) this.physicsManager.removeBody(body);
        this.physicsBodies = [];
        for (const lamp of this.lamps)
            if (lamp.light) {
                this.scene.remove(lamp.light);
                if (lamp.light.dispose) lamp.light.dispose();
            }
        this.lamps = [];
        if (this.model) {
            this.scene.remove(this.model);
            this.model.traverse((node) => {
                if (node.isMesh) {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) node.material.forEach(mat => mat.dispose());
                        else node.material.dispose();
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

