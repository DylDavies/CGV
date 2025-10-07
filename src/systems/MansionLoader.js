// src/systems/MansionLoader.js - Load and manage the mansion model with occlusion culling

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { Pathfinding } from 'https://unpkg.com/three-pathfinding@1.2.0/dist/three-pathfinding.module.js';
import logger from '../utils/Logger.js';

class MansionLoader {
    constructor(scene, physicsManager = null, qualityPreset = 'medium') {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.model = null;
        this.rooms = new Map();
        this.props = new Map();
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

        // NEW: Page glow control
        this.pageGlowEnabled = false;

        // Material caching for performance
        this.materialCache = new Map();

        // Listen for quality changes
        window.addEventListener('qualitychange', (e) => {
            this.setQualityPreset(e.detail.quality);
            this.recreateFireplaces();
        });

        logger.log(`🏠 MansionLoader initialized (${qualityPreset} quality)`);
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

        logger.log(`🎨 Quality preset "${preset}" applied to MansionLoader`);
    }

    async loadMansion(modelPath) {
        logger.log('📦 Loading mansion model:', modelPath);

        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();

            loader.load(
                modelPath,
                (gltf) => {
                    logger.log('✅ Mansion model loaded successfully');
                    this.model = gltf.scene;

                    this.processModel();

                    this.setupInstancedMeshes()
                    this.setupPageEffects();
                    this.setupPuzzleSlots(); // Find and prepare the puzzle slots on the wall

                    this.scene.add(this.model);
                    this.hideDebugObjects();

                    if (this.physicsManager) {
                        this.generatePhysics();
                    }

                    this.setupLamps();
                    this.setupOcclusionCulling();

                    logger.log(`🏠 Mansion ready with ${this.rooms.size} rooms and ${this.lamps.length} lamps`);
                    resolve(this.model);
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total) * 100;
                    logger.log(`⏳ Loading: ${percent.toFixed(1)}%`);
                },
                (error) => {
                    logger.error('❌ Error loading mansion:', error);
                    reject(error);
                }
            );
        });
    }

        getProp(propName) {
        return this.props.get(propName);
    }

    processModel() {
        logger.log('🔍 Processing mansion model - optimizing Blender materials...');
        let totalMeshes = 0;
        const materialMap = new Map(); // Track materials by their properties

        this.model.traverse((node) => {
            // Find and store specific, named props
            if (node.name === 'S_Telephone001') {
                this.props.set('telephone', node);
                node.userData = { type: 'telephone', interactable: 'true' };
                console.log(`📞 Found prop: ${node.name}`);
            }
            if (node.name === 'S_Laptop001') {
                this.props.set('laptop', node);
                node.userData = { type: 'laptop', interactable: true };
                console.log(`💻 Found prop: ${node.name}`);
            }
            if (node.name === 'S_ElectricalCabinet001') {
                this.props.set('fuse_box', node);
                node.userData = { type: 'fuse_box', interactable: true };
                console.log(`⚡ Found prop: ${node.name} (Fuse Box)`);
            }
            
            if (node.isMesh) {

                totalMeshes++;
                node.castShadow = false;
                node.receiveShadow = false;
                node.frustumCulled = true;

                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];

                    materials.forEach((material, index) => {
                        this.optimizeMaterial(material);
                    });
                }
                if (node.geometry) {
                    node.geometry.computeBoundingSphere();

                    // Remove unused attributes to save memory
                    if (node.geometry.attributes.uv2) {
                        node.geometry.deleteAttribute('uv2');
                    }

                    // Remove unused attributes to save memory
                    if (node.geometry.attributes.tangent) {
                        node.geometry.deleteAttribute('tangent');
                    }
                }
            }
        });

        logger.log(`♻️ Material optimization complete:`);
        logger.log(`   Total meshes: ${totalMeshes}`);

        this.materialCache = materialMap;
        this.organizeByRooms();
    }

    setupInstancedMeshes() {
        logger.log('🔄 Creating InstancedMeshes...');
        const instances = new Map();

        // First, group all meshes by their base name (e.g., "Chair")
        this.model.traverse((node) => {
            if (node.isMesh) {
                const baseName = node.name.split('.')[0]; // "Chair.001" -> "Chair"
                if (!instances.has(baseName)) {
                    instances.set(baseName, []);
                }
                instances.get(baseName).push(node);
            }
        });

        // Now, create InstancedMesh for groups with more than one object
        for (const [name, meshes] of instances.entries()) {
            if (meshes.length > 1) {
                const firstMesh = meshes[0];
                const geometry = firstMesh.geometry;
                const material = firstMesh.material;
                const instancedMesh = new THREE.InstancedMesh(geometry, material, meshes.length);

                // Set the position and rotation for each instance
                for (let i = 0; i < meshes.length; i++) {
                    const mesh = meshes[i];
                    mesh.updateWorldMatrix(true, false);
                    instancedMesh.setMatrixAt(i, mesh.matrixWorld);
                    // Hide the original mesh
                    mesh.visible = false;
                }

                this.scene.add(instancedMesh);
                logger.log(`  - Created InstancedMesh for "${name}" with ${meshes.length} instances.`);
            }
        }
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
                node.visible = true;
                node.material = slotMaterial;
                this.pageSlots[node.userData.slotIndex] = node;

                // --- FIX FOR ALL SUNKEN SLOTS ---
                // 1. Get the direction the slot is "facing"
                const forward = new THREE.Vector3(0, 0, 1);
                forward.applyQuaternion(node.quaternion);

                // 2. Move the slot slightly forward in that direction
                // You can adjust the 0.02 value if it needs to be more or less
                node.position.add(forward.multiplyScalar(0.02)); 
                // --- END FIX ---
            }
        });
        // The console.log was here, but it's better to log inside the loop
        // to confirm each adjustment. Let's add a final confirmation.
        console.log(`🔧 Adjusted positions for all ${this.pageSlots.length} page slots.`);
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

        pageObject.traverse((node) => {
        if (node.isMesh) {
            // Apply the polygon offset fix to all parts of the page
            node.material = node.material.clone();
            node.material.polygonOffset = true;
            node.material.polygonOffsetFactor = -1.0;
            node.material.polygonOffsetUnits = -1.0;

            // --- FIX TO LIFT SYMBOL OFF PAGE ---
            // Check if the current mesh is a symbol
            if (node.name.toLowerCase().includes('_symbol')) {
                // The symbol's "forward" is its local Z-axis
                const symbolForward = new THREE.Vector3(0, 0, 1); 
                
                // Move the symbol slightly along its own forward axis
                node.position.add(symbolForward.multiplyScalar(0.01));
                console.log(`🔧 Lifted symbol ${node.name} off its page.`);
            }
            // --- END FIX ---
        }
    });

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
        pageObject.position.add(normal.multiplyScalar(0.015));

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
        // Optimize the material without changing its appearance
        
        // Set precision to medium for better performance
        material.precision = 'mediump';
        
        // Disable features that hurt performance if not needed
        material.flatShading = false;
        
        // For MeshStandardMaterial or MeshPhysicalMaterial, reduce expensive features
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
            // Reduce roughness/metalness if very high (won't be noticeable)
            if (material.roughness !== undefined && material.roughness > 0.95) {
                material.roughness = 1;
            }
            if (material.metalness !== undefined && material.metalness < 0.05) {
                material.metalness = 0;
            }
            
            // Disable expensive features if not being used
            if (!material.envMap) {
                material.envMapIntensity = 0;
            }
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
        logger.log('🗂️ Organizing rooms from collections...');

        // NEW: First, find the main 'Mansion' parent group
        const mansionNode = this.model.getObjectByName('Mansion');

        if (!mansionNode) {
            logger.error("❌ Critical Error: Could not find the 'Mansion' group in the model! Make sure your main collection is named 'Mansion'.");
            return;
        }

        mansionNode.children.forEach((node) => {
            // This check ensures we only process children that are actual groups (your room collections)
            if (node.type === 'Object3D' && node.children.length > 0) {
                const roomName = node.name;

                const box = new THREE.Box3().setFromObject(node);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // This part of your original logic was perfect, no changes needed here
                const roomData = {
                    name: roomName,
                    children: node.children, // Store children for the minimap
                    bounds: box,
                    center: center,
                    // The rest of the properties from your original object can go here too
                };

                this.rooms.set(roomName, roomData);
                logger.log(`✅ Room "${roomName}" registered successfully.`);
            }
        });

        console.log(this.rooms)

        if (this.rooms.size === 0) {
            logger.warn("⚠️ No rooms were registered. Check that your room collections are direct children of the 'Mansion' group.");
        }
    }


    hideDebugObjects() {
        logger.log('🔍 Scanning for debug/leftover objects and portraits...');

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

        logger.log(`✅ Hidden ${hiddenCount} debug/helper objects and portraits`);
    }

    generatePhysics() {
        logger.log('⚙️ Generating physics bodies with integrated visual exclusion logic...');

        // CRITICAL FIX: Update all world matrices BEFORE creating physics bodies
        this.model.updateMatrixWorld(true);

        let collisionCount = 0;
        let skippedCount = 0;
        let invalidBodies = 0;

        this.model.traverse((node) => {
            // Only process valid, visible meshes with geometry.
            if (!node.isMesh || !node.geometry || !node.geometry.attributes.position || node.geometry.attributes.position.count === 0) {
                return;
            }

            // --- START: Integrated Exclusion Logic from hideDebugObjects() ---
            const nodeName = node.name.toLowerCase();
            const isDebugObject = nodeName.includes('helper') || nodeName.includes('debug') || nodeName.includes('marker') || nodeName.includes('guide') || nodeName.includes('gizmo') || nodeName.includes('temp');
            const isPortrait = nodeName.includes('portrait') || nodeName.includes('painting') || nodeName.includes('picture') || nodeName.includes('frame');
            const isDoor = nodeName.includes('door') || nodeName.includes('doors') || nodeName.includes('doorway') || nodeName.includes('opening');
            const isNoCollision = nodeName.includes('nocollision');

            // Check parent hierarchy for door/nocollision flags
            let shouldSkipByHierarchy = false;
            let currentNode = node.parent;
            while (currentNode) {
                const currentName = currentNode.name.toLowerCase();
                if (currentName.includes('door') ||
                    currentName.includes('doors') ||
                    currentName.includes('doorway') ||
                    currentName.includes('opening') ||
                    currentName.includes('nocollision')) {
                    shouldSkipByHierarchy = true;
                    break;
                }
                currentNode = currentNode.parent;
            }

            let hasDebugMaterial = false;
            if (node.material) {
                const material = Array.isArray(node.material) ? node.material[0] : node.material;
                if (material && material.color) {
                    const color = material.color;
                    if ((color.r > 0.9 && color.g < 0.1 && color.b < 0.1) ||
                        (color.g > 0.9 && color.r < 0.1 && color.b < 0.1) ||
                        (color.b > 0.9 && color.r < 0.1 && color.g < 0.1)) {
                        hasDebugMaterial = true;
                    }
                }
            }

            // If the object meets any of the exclusion criteria, skip it.
            if (isDebugObject || hasDebugMaterial || isPortrait || isDoor || isNoCollision || shouldSkipByHierarchy) {
                skippedCount++;
                return; // Skip to the next node
            }
            // --- END: Integrated Exclusion Logic ---

            // If the mesh passes all checks, create its physics body.
            const body = this.createPhysicsBodyFromMesh(node);
            if (body) {
                // IMPORTANT: Store the mesh name in the body's userData for the debug labels
                body.userData = { name: node.name };
                this.physicsBodies.push({ mesh: node, body: body });
                collisionCount++;
            } else {
                // Track bodies that failed to create (likely due to invalid geometry)
                invalidBodies++;
            }
        });

        logger.log(`✅ Generated ${collisionCount} physics bodies.`);
        logger.log(`🚪 Skipped ${skippedCount} objects based on integrated exclusion rules.`);
        if (invalidBodies > 0) {
            logger.log(`⚠️ ${invalidBodies} objects failed physics body creation (invalid geometry or transforms).`);
        }
    }

    createPhysicsBodyFromMesh(mesh) {
        // Step 1: Get the raw vertex data and ensure the mesh's matrix is up-to-date.
        const geometry = mesh.geometry;
        const positionAttribute = geometry.attributes.position;

        // No need to call updateMatrixWorld here - it's already updated in generatePhysics()
        // mesh.updateMatrixWorld(true);

        // Step 2: Create a list of all vertices transformed into their final WORLD positions.
        const worldVertices = [];
        const vertex = new THREE.Vector3();
        for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            vertex.applyMatrix4(mesh.matrixWorld);
            worldVertices.push(vertex.clone());
        }

        if (worldVertices.length === 0) {
            return null;
        }

        // Step 3: From these world-space points, create a new, tight-fitting Box3.
        const worldAABB = new THREE.Box3().setFromPoints(worldVertices);
        const center = new THREE.Vector3();
        worldAABB.getCenter(center);

        // Step 4: Now, we need the rotation. Get it directly from the mesh's world matrix.
        const quaternion = new THREE.Quaternion();
        mesh.getWorldQuaternion(quaternion);

        // Step 5: Calculate the LOCAL-space dimensions of the object, aligned with its own rotation axes.
        const inverseQuaternion = quaternion.clone().invert();
        const localVertices = worldVertices.map(v => {
            return v.clone().sub(center).applyQuaternion(inverseQuaternion);
        });
        const localAABB = new THREE.Box3().setFromPoints(localVertices);

        const size = new THREE.Vector3();
        localAABB.getSize(size);

        // --- START: The Final Filter ---
        // This is the definitive check for invalid, zero-volume meshes.
        // It will catch any leftover helper objects or empty nodes at the origin.
        const minValidSize = 0.01; // A reasonable threshold to consider a mesh "real"
        if (size.x < minValidSize || size.y < minValidSize || size.z < minValidSize) {
            return null; // Silently skip creating a body for this object.
        }
        // --- END: The Final Filter ---

        // DEBUG: Log bodies that are spawning near the origin
        if (Math.abs(center.x) < 0.1 && Math.abs(center.y) < 0.1 && Math.abs(center.z) < 0.1) {
            logger.log(`⚠️ Physics body near origin detected: "${mesh.name}" at (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        }

        // Step 6: Send the perfect, calculated data to Rapier.
        return this.physicsManager.createBoxBody(center, size, quaternion);
    }

    async loadNavMesh(path) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(path, (gltf) => {
                const navMeshNode = gltf.scene.children[0];
                if (!navMeshNode || !navMeshNode.geometry) {
                    logger.error('NavMesh GLB must contain a single mesh.');
                    return reject();
                }
                this.navMesh = navMeshNode;
                // Hide the original navmesh model
                this.navMesh.visible = false; 

                logger.log('🧠 Building navigation zone...');
                const zone = Pathfinding.createZone(navMeshNode.geometry);
                this.pathfinding.setZoneData(this.ZONE, zone);
                logger.log('✅ Navigation mesh created successfully.');

                this.createNavMeshVisualizer();
                this.createNavMeshNodesVisualizer();
                resolve();
            }, undefined, (error) => {
                logger.error(`❌ Error loading navigation mesh from ${path}:`, error);
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
        logger.log("✅ Navigation mesh visualizer created. Toggle with gameControls.toggleNavMeshVisualizer()");
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
    logger.log(`✅ Navigation mesh node visualizer created with ${navMeshNodes.length} nodes.`);
}

toggleNavMeshNodesVisualizer() {
    if (this.navMeshNodesVisualizer) {
        this.navMeshNodesVisualizer.visible = !this.navMeshNodesVisualizer.visible;
        logger.log(`NavMesh nodes visualizer ${this.navMeshNodesVisualizer.visible ? 'ON' : 'OFF'}`);
    }
}
    
    // --- NEW: Helper to toggle the visualizer ---
    toggleNavMeshVisualizer() {
        if (this.navMeshVisualizer) {
            this.navMeshVisualizer.visible = !this.navMeshVisualizer.visible;
            logger.log(`NavMesh visualizer ${this.navMeshVisualizer.visible ? 'ON' : 'OFF'}`);
        }
    }

    toggleMansionVisibility() {
    if (this.model) {
        this.model.visible = !this.model.visible;
        logger.log(`Mansion model visibility ${this.model.visible ? 'ON' : 'OFF'}`);
    }
}


    setupLamps() {
        logger.log('💡 Setting up automatic lamp lighting...');

        let lampCount = 0;
        this.model.traverse((node) => {
            const nodeName = node.name.toLowerCase();

             if (nodeName.includes('walllamp') || nodeName.includes('chandelier') ||
                nodeName.includes('lamp') || nodeName.includes('light')) {

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

                    if (isNaN(forward.x) || isNaN(forward.y) || isNaN(forward.z)) {
                        console.error("❌ Failed to calculate spawn point direction. Using fallback.");
                        return null; // Return null to indicate failure
                    }

                    lampLight.position.copy(lampPosition);
                    lampLight.position.add(forward.multiplyScalar(0.4));
                    lampLight.position.y += 0.1;
                } else {
                    lampLight.position.copy(lampPosition);
                }
                lampLight.castShadow = false;

                // CRITICAL FIX: Start with light visible!
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

        logger.log(`💡 Added ${lampCount} automatic lights to lamps`);
        logger.log(`🔥 Found ${this.fireplaces.length} fireplaces`);
    }

    recreateFireplaces() {
        logger.log('🔄 Recreating fireplaces with new quality settings...');

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

        logger.log(`✅ Recreated ${this.fireplaces.length} fireplaces`);
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
        })

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
            flickerPhase: Math.random() * Math.PI * 2,
        };
        this.fireplaces.push(fireplaceData);
    }

    setupOcclusionCulling() {
        logger.log('👁️ Setting up occlusion culling system...');

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

        logger.log(`👁️ Frustum culling enabled on ${meshCount} meshes`);

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
        for (const [roomName, roomData] of this.rooms) {
            // Create a temporary, "flattened" bounding box for a 2D check.
            // This ignores the Y-axis, making detection much more reliable.
            const bounds2D = roomData.bounds.clone();
            bounds2D.min.y = -Infinity;
            bounds2D.max.y = Infinity;

            if (bounds2D.containsPoint(position)) {
                return roomData; // Return the room if the player is within its footprint
            }
        }
        return null; // Return null if the player is not in any room
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
            spawnPoint.z -= 1;

            if (isNaN(spawnPoint.x) || isNaN(spawnPoint.y) || isNaN(spawnPoint.z)) {
                return null;
            }

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

        logger.log(`👁️ Occlusion culling: ${enabled ? 'ON' : 'OFF'}`);
    }

    setMaxVisibleDistance(distance) {
        this.maxVisibleDistance = distance;
        logger.log(`👁️ Max visible distance set to: ${distance}`);
    }


    // NEW: Enable page glow (called when phone is answered)
    enablePageGlow() {
        this.pageGlowEnabled = true;
        console.log('✨ Page glow enabled');
    }

    updatePageGlow() {
        if (!this.pageGlowEnabled) return; // Don't glow until enabled

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
        for (const lamp of this.lamps) {
            lamp.light.visible = enabled;
        }
        logger.log(`💡 Lamps ${enabled ? 'enabled' : 'disabled'}`);
    }

    // NEW: Control all lights (lamps and fireplaces)
    setAllLightsEnabled(enabled) {
        this.setLampsEnabled(enabled);
        this.setFireplacesEnabled(enabled);
        console.log(`💡 All lights ${enabled ? 'ON' : 'OFF'}`);
    }
    showLightHelpers() {
        logger.log('💡 Adding light helpers...');

        for (const lamp of this.lamps) {
            if (!lamp.helper) {
                const helper = new THREE.PointLightHelper(lamp.light, 0.2);
                this.scene.add(helper);
                lamp.helper = helper;
            } else {
                lamp.helper.visible = true;
            }
        }

        logger.log(`✅ Showing helpers for ${this.lamps.length} lights`);
    }
    hideLightHelpers() {
        for (const lamp of this.lamps) {
            if (lamp.helper) {
                lamp.helper.visible = false;
            }
        }
        logger.log('💡 Light helpers hidden');
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
        logger.log(`💡 Lamp intensity set to: ${intensity}`);
    }
    setLampFlickerSpeed(speed) {
        this.lampFlickerSpeed = speed;
        logger.log(`💡 Lamp flicker speed set to: ${speed}`);
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

        logger.log(`🔥 Fireplaces ${enabled ? 'enabled' : 'disabled'}`);
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
        logger.log('📋 Listing all objects in mansion model:');
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
        logger.log(`📊 Total: ${objects.length} objects${filter ? ` (filtered by "${filter}")` : ''}`);
        return objects;
    }
    findObjects(searchTerm) {
        logger.log(`🔍 Searching for objects containing "${searchTerm}":`);
        return this.listAllObjects(searchTerm);
    }
    showObjectHierarchy(objectName) {
        logger.log(`🌳 Showing hierarchy for "${objectName}":`);

        this.model.traverse((node) => {
            if (node.name.toLowerCase().includes(objectName.toLowerCase())) {
                logger.log(`\n📍 Found: ${node.name}`);
                logger.log('Hierarchy (from root to object):');

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

                logger.log(`Has "door" in parent hierarchy: ${hassDoorParent ? '✅ YES' : '❌ NO'}`);
            }
        });
    }
    listCollections() {
        logger.log('📁 Listing all groups/collections:');
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
        logger.log('🧹 Disposing mansion loader...');

        for (const { body } of this.physicsBodies) {
            this.physicsManager.removeBody(body);
        }
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

        logger.log('✅ Mansion loader disposed');
    }
}

export { MansionLoader };
