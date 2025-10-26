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
        this.occlusionVizEnabled = false; // Track if visualization is active for real-time updates

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

        // Stage-specific physics exclusions (can be set via setPhysicsExclusions)
        this.physicsExclusions = [];

        // Listen for quality changes
        window.addEventListener('qualitychange', (e) => {
            this.setQualityPreset(e.detail.quality);
            this.recreateFireplaces();
        });

        logger.log(`🏠 MansionLoader initialized (${qualityPreset} quality)`);
    }

    /**
     * Set stage-specific physics exclusions (keywords to exclude from collision)
     * @param {Array<string>} exclusions - Array of keywords to exclude from physics
     */
    setPhysicsExclusions(exclusions) {
        this.physicsExclusions = exclusions || [];
        logger.log(`🔒 Physics exclusions set: ${this.physicsExclusions.join(', ')}`);
    }

    /**
     * Deactivate physics for this stage (remove all bodies from the physics world)
     * Called when switching away from this stage
     */
    deactivatePhysics() {
        if (!this.physicsManager || !this.physicsBodies.length) {
            return;
        }

        logger.log(`🚫 Deactivating physics for ${this.physicsBodies.length} bodies`);

        // Remove all physics bodies from the world
        for (const entry of this.physicsBodies) {
            if (entry.body) {
                this.physicsManager.removeBody(entry.body);
            }
        }
    }

    /**
     * Activate physics for this stage (add all bodies to the physics world)
     * Called when switching to this stage
     */
    activatePhysics() {
        if (!this.physicsManager || !this.physicsBodies.length) {
            return;
        }

        logger.log(`✅ Activating physics for ${this.physicsBodies.length} bodies`);

        // Re-add all physics bodies to the world
        for (const entry of this.physicsBodies) {
            if (entry.body) {
                this.physicsManager.addBody(entry.body);
            }
        }
    }

    setQualityPreset(preset) {
        const presets = {
            low: {
                fireParticles: 15,
                lampUpdateRate: 4,
                fireplaceUpdateRate: 4,
                maxVisibleDistance: 17,
                maxActiveLights: 6,
                lampShadows: false,
                fireplaceShadows: false,
                maxShadowCasters: 0, // No shadows
                shadowMapSize: 256
            },
            medium: {
                fireParticles: 25,
                lampUpdateRate: 3,
                fireplaceUpdateRate: 3,
                maxVisibleDistance: 17,
                maxActiveLights: 8,
                lampShadows: false, // Only chandeliers
                fireplaceShadows: false, // Too expensive with many lights
                maxShadowCasters: 2, // Only 2 chandeliers max
                shadowMapSize: 512
            },
            high: {
                fireParticles: 50,
                lampUpdateRate: 2,
                fireplaceUpdateRate: 2,
                maxVisibleDistance: 18,
                maxActiveLights: 12,
                lampShadows: false, // Only chandeliers
                fireplaceShadows: true, // 1-2 fireplaces
                maxShadowCasters: 4, // 2 chandeliers + 2 fireplaces
                shadowMapSize: 512
            },
            ultra: {
                fireParticles: 100,
                lampUpdateRate: 1,
                fireplaceUpdateRate: 1,
                maxVisibleDistance: 20,
                maxActiveLights: 15,
                lampShadows: true,
                fireplaceShadows: true,
                maxShadowCasters: 6,
                shadowMapSize: 512
            }
        };

        const settings = presets[preset] || presets.medium;
        this.fireParticleCount = settings.fireParticles;
        this.lampUpdateRate = settings.lampUpdateRate;
        this.fireplaceUpdateRate = settings.fireplaceUpdateRate;
        this.maxVisibleDistance = settings.maxVisibleDistance;
        this.maxActiveLights = settings.maxActiveLights;
        this.lampShadows = settings.lampShadows;
        this.fireplaceShadows = settings.fireplaceShadows;
        this.maxShadowCasters = settings.maxShadowCasters;
        this.shadowMapSize = settings.shadowMapSize;

        logger.log(`🎨 Quality preset "${preset}" applied to MansionLoader (lamp shadows: ${this.lampShadows}, fireplace shadows: ${this.fireplaceShadows}, max shadow casters: ${this.maxShadowCasters})`);

        // Update existing lamps if they exist
        if (this.lamps && this.lamps.length > 0) {
            this.updateLampShadows();
        }

        // Update existing fireplaces if they exist
        if (this.fireplaces && this.fireplaces.length > 0) {
            this.updateFireplaceShadows();
        }
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

                    // CRITICAL: Update matrix world after positioning so physics uses correct positions
                    this.model.updateMatrixWorld(true);

                    logger.log(`✅ Added mansion model to scene. Model visible: ${this.model.visible}, Scene children count: ${this.scene.children.length}`);
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
            if (node.name === 'S_Entrance001') {
                this.props.set('entrance_door', node);
                node.userData = { type: 'entrance_door', interactable: true };
                console.log(`🚪 Found prop: ${node.name} (Entrance Door)`);
            }
            if (node.name === 'S_Book017') {
                this.props.set('diary', node);
                node.userData = { type: 'diary', interactable: false }; // Not interactable until laptop puzzle is solved
                console.log(`📖 Found prop: ${node.name} (Diary)`);
            }
            if (node.name === 'S_Fire001') {
                this.props.set('fireplace_fire', node);
                node.userData = { type: 'fireplace', interactable: false }; // Not interactable until diary is read
                console.log(`🔥 Found prop: ${node.name} (Fireplace Fire)`);
            }
            if (node.name === 'S_Fireplace001') {
                this.props.set('fireplace', node);
                node.userData = { type: 'fireplace', interactable: false }; // Not interactable until diary is read
                console.log(`🔥 Found prop: ${node.name} (Fireplace)`);
            }
            
            if (node.name === 'S_Bucket001') {
                this.props.set('bucket', node);
                node.userData = { type: 'bucket', interactable: false }; // Not interactable until fireplace is inspected
                console.log(`🪣 Found prop: ${node.name} (Bucket)`);
            }

            if(node.name === 'S_Door001'){
                this.props.set('master_bedroom_door', node);
                node.userData = { 
                    type: 'door', 
                    interactable: true,
                    locked: true // Start the door in a locked state
                };
                console.log(`🚪 Found prop: ${node.name} (Master Bedroom Door)`);
            }
            if (node.name === 'S_KeyBehindFire') {
                this.props.set('key_behind_fire', node);
                node.userData = { type: 'key', interactable: false }; // Hidden until fire is out
                node.visible = false; // Start hidden
                console.log(`🔑 Found prop: ${node.name} (Key Behind Fire)`);
            }
            
            if (node.name === 'S_Safe') {
                this.props.set('safe', node);
                node.userData = { type: 'safe', interactable: true };
                console.log(`🔒 Found prop: ${node.name} (Safe)`);
            }

            // ========== OFFICE STAGE OBJECTS ==========

            // Computer (Office stage only)
            if (node.name === 'S_Computer' || node.name === 'Computer') {
                this.props.set('computer', node);
                node.userData = { type: 'computer', interactable: true, phoneAnswered: false, loggedIn: false };
                console.log(`💻 Found prop: ${node.name} (Computer)`);
            }

            // Notepad
            if (node.name === 'S_Notepad' || node.name === 'Notepad' || node.name.toLowerCase().includes('notepad')) {
                this.props.set('notepad', node);
                node.userData = { type: 'notepad', interactable: false, loginAttempted: false, notepadRead: false };
                console.log(`📝 Found prop: ${node.name} (Notepad)`);
            }

            // Newspaper
            if (node.name === 'S_Newspaper' || node.name === 'Newspaper' || node.name === 'S_Paper' || node.name.toLowerCase().includes('newspaper')) {
                this.props.set('newspaper', node);
                node.userData = { type: 'newspaper', interactable: false, notepadRead: false, hasRead: false };

                // Ensure visibility and proper material
                node.visible = true;

                // Make sure all parent groups are visible
                let parent = node.parent;
                while (parent) {
                    parent.visible = true;
                    parent = parent.parent;
                }

                if (node.isMesh && !node.material) {
                    // Create a basic white material if none exists
                    node.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                }
                if (node.material) {
                    node.material.transparent = false;
                    node.material.opacity = 1.0;
                    node.material.side = THREE.DoubleSide;
                    node.material.needsUpdate = true;
                }

                // Traverse children to ensure all parts are visible
                node.traverse((child) => {
                    if (child.isMesh) {
                        child.visible = true;
                        if (!child.material) {
                            // Create fallback material if none exists
                            child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        if (child.material) {
                            child.material.transparent = false;
                            child.material.opacity = 1.0;
                            child.material.side = THREE.DoubleSide;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Debug: Check what we found
                let meshCount = 0;
                node.traverse((child) => {
                    if (child.isMesh) meshCount++;
                });
                console.log(`📰 Found prop: ${node.name} (Newspaper) - Type: ${node.type}, IsMesh: ${node.isMesh}, Children with meshes: ${meshCount}`);
            }

            // Loose Book / Missing Persons Report
            if (node.name === 'S_LooseBook' || node.name === 'LooseBook' || node.name === 'S_Book' || node.name.toLowerCase().includes('loose')) {
                this.props.set('loose_book', node);
                node.userData = { type: 'loose_book', interactable: false, found: false };
                console.log(`📖 Found prop: ${node.name} (Loose Book)`);
            }

            if (node.isMesh) {

                totalMeshes++;
                // Enable shadows for all mansion objects
                node.castShadow = true;
                node.receiveShadow = true;
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

                // Enable shadows for all page meshes (including children)
                node.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const childName = child.name.toLowerCase();
                        const isSymbol = childName.includes('_symbol') || childName.includes('symbol');
                        const isBackground = childName.includes('back') || childName.includes('plane') || childName.includes('bg');

                        // Only clone if not already modified
                        if (!child.material.userData.pageModified) {
                            child.material = child.material.clone();
                            child.material.userData.pageModified = true;
                        }

                        // SMART POLYGON OFFSET SYSTEM
                        child.material.polygonOffset = true;
                        if (isSymbol) {
                            child.material.polygonOffsetFactor = -4.0;
                            child.material.polygonOffsetUnits = -4.0;
                        } else if (isBackground) {
                            child.material.polygonOffsetFactor = -0.5;
                            child.material.polygonOffsetUnits = -0.5;
                            child.visible = false;
                            console.log(`🔧 Hiding background mesh: ${child.name}`);
                        } else {
                            child.material.polygonOffsetFactor = -2.0;
                            child.material.polygonOffsetUnits = -2.0;
                        }

                        // SHADOW SETTINGS
                        child.castShadow = true;
                        child.receiveShadow = !isSymbol; // Symbols don't receive shadows

                        // EMISSIVE FOR PICKUP GLOW (red pulsing when enabled)
                        if (child.material.emissive) {
                            child.material.emissive.setHex(0xff0000); // Red for pickup
                            child.material.emissiveIntensity = 0; // Start at 0, will pulse when enabled
                        }

                        // PHYSICAL SEPARATION for symbols
                        if (isSymbol && child.parent) {
                            const symbolForward = new THREE.Vector3(0, 0, 1);
                            // Increase separation for symbols that need more space
                            let separationDistance = 0.04; // Increased from 0.025
                            if (childName.includes('hand') || childName.includes('eye')) {
                                separationDistance = 0.06; // Extra separation for problematic symbols
                            }
                            child.position.add(symbolForward.multiplyScalar(separationDistance));
                        }
                    }
                });

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
        if (node.isMesh && node.material) {
            const nodeName = node.name.toLowerCase();
            const isSymbol = nodeName.includes('_symbol') || nodeName.includes('symbol');
            const isBackground = nodeName.includes('back') || nodeName.includes('plane') || nodeName.includes('bg');

            // Only clone material if we need to modify it
            // This prevents creating too many material instances
            if (!node.material.userData.pageModified) {
                node.material = node.material.clone();
                node.material.userData.pageModified = true; // Mark as already modified
            }

            // SMART POLYGON OFFSET SYSTEM - Create proper depth layering
            node.material.polygonOffset = true;
            if (isSymbol) {
                node.material.polygonOffsetFactor = -3.0;
                node.material.polygonOffsetUnits = -3.0;
            } else if (isBackground) {
                node.material.polygonOffsetFactor = -0.5;
                node.material.polygonOffsetUnits = -0.5;
                node.visible = false;
                console.log(`🔧 Hiding background mesh: ${node.name}`);
            } else {
                node.material.polygonOffsetFactor = -2.0;
                node.material.polygonOffsetUnits = -2.0;
            }

            // SHADOW SETTINGS
            node.castShadow = true;
            node.receiveShadow = !isSymbol; // Only symbols don't receive shadows

            // EMISSIVE GLOW - Higher for symbols, moderate for pages
            if (node.material.emissive) {
                if (isSymbol) {
                    node.material.emissive.setHex(0x333333);
                    node.material.emissiveIntensity = 0.6;
                } else if (!isBackground) {
                    node.material.emissive.setHex(0x222222);
                    node.material.emissiveIntensity = 0.4;
                }
            }

            // PHYSICAL SEPARATION - Lift symbols more to prevent z-fighting and clipping
            if (isSymbol) {
                const symbolForward = new THREE.Vector3(0, 1, 0);
                // Increase separation for symbols that need more space (hand, eye)
                let separationDistance = 0.01; // Increased from 0.025
                if (nodeName == "s_page4_symbol" || nodeName == "s_page5_symbol") {
                    separationDistance = 0.02; // Extra separation for problematic symbols
                }
                node.position.add(symbolForward.multiplyScalar(separationDistance));
                console.log(`🔧 Lifted symbol ${node.name} off its page (${separationDistance} units)`);
            }
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

        // Make the page visible and turn off the red pulsing glow
        pageObject.visible = true;
        // Note: Emissive values already set above in the traverse loop
        // Symbols: 0x333333 @ 0.6 intensity
        // Pages: 0x222222 @ 0.4 intensity

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

    enableDiaryGlow() {
        let diary = this.props.get('diary');

        if (!diary) {
            console.warn('Could not find diary prop, searching for S_Book017 directly...');
            // Try to find it directly in the scene
            this.model.traverse((node) => {
                if (node.name === 'S_Book017') {
                    diary = node;
                }
            });
            if (!diary) {
                console.error('❌ Could not find S_Book017 in the scene!');
                return;
            }
            console.log('✅ Found S_Book017 directly in scene');
        }

        const bookToGlow = diary;
        console.log('✨ Enabling diary glow (using same method as pages)');
        console.log('✨ Diary object:', bookToGlow.name, 'Type:', bookToGlow.type);

        // Apply glow effect to all meshes in the diary - SAME AS PAGES
        let glowCount = 0;
        bookToGlow.traverse((node) => {
            if (node.isMesh && node.material) {
                console.log(`✨ Found mesh in diary: ${node.name}. Applying glow effect.`);

                // Use the EXACT same approach as pages
                node.material = node.material.clone();
                node.material.emissive = new THREE.Color(0xffaa00); // Orange glow for diary
                node.material.emissiveIntensity = 0; // Start at 0, will be animated

                this.glowingSymbols.push(node);
                glowCount++;
            }
        });
        console.log(`✨ Applied glow to ${glowCount} meshes in diary (S_Book017)`);
    }

    disableDiaryGlow() {
        const diary = this.props.get('diary');
        if (!diary) {
            return;
        }

        console.log('✨ Disabling diary glow');

        // Remove glow effect from all meshes in the diary
        diary.traverse((node) => {
            if (node.isMesh && node.material) {
                node.material.emissive = new THREE.Color(0x000000);
                node.material.emissiveIntensity = 0;

                // Remove from glowing symbols array
                const index = this.glowingSymbols.indexOf(node);
                if (index > -1) {
                    this.glowingSymbols.splice(index, 1);
                }
            }
        });
    }

    tick(delta, cameraPosition) {
        if (cameraPosition) {
            this.updateOcclusionCulling(cameraPosition);

            // Update occlusion culling visualization in real-time if enabled
            if (this.occlusionVizEnabled) {
                this.updateOcclusionVizualization();
            }

            // Only update shadows if player has moved significantly (optimization)
            const hasPlayerMoved = !this.lastShadowUpdatePos ||
                this.lastShadowUpdatePos.distanceTo(cameraPosition) > 2.0; // Update every 2 units of movement

            if (hasPlayerMoved) {
                this.updateLampShadows();
                this.lastShadowUpdatePos = cameraPosition.clone();
            }
        }
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
        // Optimize the material for performance

        // Set precision to medium for better performance
        material.precision = 'mediump';

        // Disable features that hurt performance if not needed
        material.flatShading = false;

        // For MeshStandardMaterial or MeshPhysicalMaterial, enhance depth and contrast
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
            // Enhance shadow reception by adjusting roughness for more pronounced shadows
            if (material.roughness !== undefined && material.roughness > 0.95) {
                material.roughness = 1;
            } else if (material.roughness !== undefined) {
                // Increase roughness slightly for better shadow definition
                material.roughness = Math.min(1.0, material.roughness * 1.1);
            }

            if (material.metalness !== undefined && material.metalness < 0.05) {
                material.metalness = 0;
            }

            // Disable expensive features if not being used
            if (!material.envMap) {
                material.envMapIntensity = 0;
            }

            // Ensure proper encoding for tone mapping
            if (material.map) {
                material.map.encoding = THREE.sRGBEncoding;
            }

            // Enhance shadow darkness by reducing ambient occlusion if present
            if (material.aoMapIntensity !== undefined) {
                material.aoMapIntensity = Math.min(1.0, material.aoMapIntensity * 1.3);
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

        // Try to find the main parent group - could be 'Mansion' or 'Scene' or the model itself
        let mansionNode = this.model.getObjectByName('Mansion');

        if (!mansionNode) {
            // Try 'Scene' as fallback (common in Blender exports)
            mansionNode = this.model.getObjectByName('Scene');
        }

        if (!mansionNode) {
            // If no specific collection found, use the model root itself
            logger.log("ℹ️ No 'Mansion' or 'Scene' collection found, using model root");
            mansionNode = this.model;
        }

        mansionNode.children.forEach((node) => {
            // This check ensures we only process children that are actual groups (your room collections)
            if (node.type === 'Object3D' && node.children.length > 0) {
                const roomName = node.name;

                const box = new THREE.Box3().setFromObject(node);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // Collect all descendant meshes (not just direct children)
                const allMeshes = [];
                node.traverse((child) => {
                    if (child.isMesh) {
                        allMeshes.push(child);
                    }
                });

                const roomData = {
                    name: roomName,
                    group: node, // Store the group node itself
                    children: node.children, // Direct children
                    meshes: allMeshes, // All meshes in the room hierarchy
                    bounds: box,
                    center: center,
                    visible: true
                };

                this.rooms.set(roomName, roomData);
                logger.log(`✅ Room "${roomName}" registered with ${allMeshes.length} meshes.`);
            }
        });

        if (this.rooms.size === 0) {
            logger.warn("⚠️ No rooms were registered. Check that your room collections are direct children of the 'Mansion' group.");
        }
    }


    hideDebugObjects() {
        logger.log('🔍 Scanning for debug/leftover objects and portraits...');

        let hiddenCount = 0;
        let visibleCount = 0;
        let materialResetCount = 0;
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
                } else {
                    // CRITICAL FIX: Ensure all non-debug, non-portrait meshes are visible
                    // This fixes the issue where meshes are hidden by default in Blender exports
                    node.visible = true;
                    if (!node.visible) visibleCount++;

                    // CRITICAL FIX 2: Reset material transparency/opacity
                    // Materials might have opacity=0 from loading/transition
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    for (const mat of materials) {
                        if (mat) {
                            // Ensure material is not rendering as transparent with opacity 0
                            if (mat.opacity === 0) {
                                mat.opacity = 1.0;
                                materialResetCount++;
                            }
                            if (mat.transparent === true && !mat.map) {
                                // Only keep transparent if it has a texture, otherwise disable
                                mat.transparent = false;
                                materialResetCount++;
                            }
                            mat.needsUpdate = true;
                        }
                    }
                }
            }
        });

        logger.log(`✅ Hidden ${hiddenCount} debug/helper objects and portraits`);
        logger.log(`✅ Ensured ${visibleCount} meshes are visible`);
        logger.log(`✅ Reset material opacity on ${materialResetCount} materials`);
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

            // Check if it's a special S_Door object (these should be included in physics)
            const isSpecialDoor = nodeName.includes('s_door');

            const isDebugObject = nodeName.includes('helper') || nodeName.includes('debug') || nodeName.includes('marker') || nodeName.includes('guide') || nodeName.includes('gizmo') || nodeName.includes('temp');
            const isPortrait = nodeName.includes('portrait') || nodeName.includes('painting') || nodeName.includes('picture') || nodeName.includes('frame');
            const isDoor = !isSpecialDoor && (nodeName.includes('door') || nodeName.includes('doors') || nodeName.includes('doorway') || nodeName.includes('opening'));
            const isNoCollision = nodeName.includes('nocollision');

            // Check parent hierarchy for door/nocollision flags (but skip if it's an S_Door)
            let shouldSkipByHierarchy = false;
            if (!isSpecialDoor) {
                let currentNode = node.parent;
                while (currentNode) {
                    const currentName = currentNode.name.toLowerCase();
                    // Don't skip if parent is S_Door
                    if (currentName.includes('s_door')) {
                        break; // Stop checking, this is a special door
                    }
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

            // Check stage-specific exclusions
            let isStageExcluded = false;
            if (this.physicsExclusions.length > 0) {
                for (const keyword of this.physicsExclusions) {
                    if (nodeName.includes(keyword.toLowerCase())) {
                        isStageExcluded = true;
                        break;
                    }
                }
            }

            // If the object meets any of the exclusion criteria, skip it.
            if (isDebugObject || hasDebugMaterial || isPortrait || isDoor || isNoCollision || shouldSkipByHierarchy || isStageExcluded) {
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

    recalculatePhysicsForObject(objectName) {
        console.log(`🔄 Attempting to recalculate physics for "${objectName}"...`);

        // Step 1: Find the mesh and its associated physics body.
        const bodyEntry = this.physicsBodies.find(entry => entry.mesh.name === objectName);

        if (!bodyEntry) {
            console.warn(`[Physics Recalculation] Could not find an object named "${objectName}" with a physics body.`);
            return;
        }

        const { mesh, body: oldBody } = bodyEntry;

        // Step 2: Remove the old body from the physics world and our tracking array.
        this.physicsManager.removeBody(oldBody);

        const index = this.physicsBodies.findIndex(entry => entry.mesh.name === objectName);
        if (index !== -1) {
            this.physicsBodies.splice(index, 1);
        }

        console.log(`   - Old body for "${objectName}" removed.`);

        // Step 3: Create a new physics body using its current transform.
        // We use the same reliable function we built before.
        const newBody = this.createPhysicsBodyFromMesh(mesh);

        if (newBody) {
            // Step 4: Add the new body to our tracking array and the physics manager.
            // Assign the same userData so debug labels still work.
            newBody.userData = { name: mesh.name };
            this.physicsBodies.push({ mesh: mesh, body: newBody });
            this.physicsManager.addBody(newBody); // Explicitly add to the manager's list.
            
            console.log(`   - New body for "${objectName}" created and added successfully.`);
        } else {
            console.error(`[Physics Recalculation] Failed to create a new physics body for "${objectName}".`);
        }
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
                logger.log('✅ Navigation mesh created successfully');

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
                nodeName.includes('lamp') || nodeName.includes('light') || nodeName.includes('fluorescent')) {

                node.updateMatrixWorld(true);
                const lampPosition = new THREE.Vector3();
                node.getWorldPosition(lampPosition);
                let lightColor, lightIntensity, lightDistance, lightType;

                if (nodeName.includes('fluorescent')) {
                    // Fluorescent ceiling light (office) - rectangular fixture
                    lightColor = 0xffffff; // Cool white
                    lightIntensity = 3.0; // Bright office lighting
                    lightDistance = 15; // Extended range for wider fixture
                    lightType = 'fluorescent';
                } else if (nodeName.includes('chandelier')) {
                    lightColor = 0xffaa55;
                    lightIntensity = 2.5;
                    lightDistance = 6;
                    lightType = 'chandelier';
                } else if (nodeName.includes('walllamp')) {
                    lightColor = 0xffbb66;
                    lightIntensity = 1.8;
                    lightDistance = 5;
                    lightType = 'walllamp';
                } else {
                    lightColor = 0xffcc77;
                    lightIntensity = 1.8;
                    lightDistance = 6;
                    lightType = 'lamp';
                }
                if (nodeName.includes('fluorescent')) {
                    // For fluorescent fixtures, create multiple point lights along the length
                    const box = new THREE.Box3().setFromObject(node);
                    const size = new THREE.Vector3();
                    box.getSize(size);

                    // Determine the longest horizontal dimension
                    const width = Math.max(size.x, size.z);
                    const isXAxis = size.x > size.z;

                    // Create 3-5 lights spread across the fixture width
                    const numLights = Math.max(3, Math.ceil(width / 1.5));
                    const spacing = width / (numLights + 1);

                    for (let i = 0; i < numLights; i++) {
                        const lampLight = new THREE.PointLight(lightColor, lightIntensity / numLights, lightDistance);

                        // Position lights along the fixture
                        lampLight.position.copy(lampPosition);
                        lampLight.position.y -= 0.15;

                        if (isXAxis) {
                            lampLight.position.x = lampPosition.x - width / 2 + spacing * (i + 1);
                        } else {
                            lampLight.position.z = lampPosition.z - width / 2 + spacing * (i + 1);
                        }

                        lampLight.visible = true;
                        this.scene.add(lampLight);

                        const lampData = {
                            mesh: node,
                            light: lampLight,
                            baseIntensity: lightIntensity / numLights,
                            flickerPhase: Math.random() * Math.PI * 2,
                            flickerSpeed: 0.5 + Math.random() * 0.5,
                            type: 'fluorescent'
                        };
                        this.lamps.push(lampData);
                        lampCount++;
                    }
                } else {
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

                    // Enable shadow casting based on quality settings with extreme shadows
                    const isChandelier = nodeName.includes('chandelier');
                    const isFluorescent = nodeName.includes('fluorescent');
                    // Chandeliers always cast shadows in medium+, all lamps in high+
                    lampLight.castShadow = isChandelier || this.lampShadows;
                    if (lampLight.castShadow) {
                        // Fluorescent lights get higher resolution for smoother shadows
                        const shadowMapSize = isFluorescent ? Math.max(this.shadowMapSize * 2, 1024) : this.shadowMapSize;
                        lampLight.shadow.mapSize.width = shadowMapSize;
                        lampLight.shadow.mapSize.height = shadowMapSize;
                        lampLight.shadow.camera.near = 0.5;
                        lampLight.shadow.camera.far = lightDistance;
                        lampLight.shadow.bias = -0.0001; // Reduced for sharper shadows
                        lampLight.shadow.normalBias = 0; // No normal bias for extreme contrast
                        // Fluorescent lights in office get softer shadows for more natural lighting
                        // Other lights (mansion) get sharp shadows for horror atmosphere
                        lampLight.shadow.radius = isFluorescent ? 2.0 : 0.5;
                    }

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
                        type: lightType // Use the lightType we determined above
                    };
                    this.lamps.push(lampData);
                    lampCount++;
                }
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
        fireParticles.raycast = () => {}; // Make fire particles non-raycastable so clicks go through
        this.scene.add(fireParticles);
        const fireLight = new THREE.PointLight(0xff6600, 4.0, 10, 2); // Reduced intensity from 8.0 to 4.0 for less brightness
        fireLight.position.copy(firePosition);

        // Enable shadow casting for fireplace with extreme flickering shadows
        fireLight.castShadow = this.fireplaceShadows;
        if (fireLight.castShadow) {
            fireLight.shadow.mapSize.width = this.shadowMapSize;
            fireLight.shadow.mapSize.height = this.shadowMapSize;
            fireLight.shadow.camera.near = 0.5;
            fireLight.shadow.camera.far = 10;
            fireLight.shadow.bias = -0.0001; // Reduced for sharper, more dramatic shadows
            fireLight.shadow.normalBias = 0; // No normal bias for extreme contrast
            fireLight.shadow.radius = 0.3; // Very sharp shadows that flicker with the fire
        }

        this.scene.add(fireLight);
        const fireplaceData = {
            mesh: fireNode,
            particles: fireParticles,
            light: fireLight,
            baseIntensity: 3.5, // Reduced from 6.0 to 3.5 for less brightness
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
        if (!this.occlusionCulling || !this.model) return;

        const closestPoint = new THREE.Vector3();

        // Traverse all objects and cull based on distance
        this.model.traverse((node) => {
            if (node === this.model) return; // Skip the root model node
            if (node.userData.lockVisibility) return; // Don't cull locked objects

            let shouldBeVisible = true;

            // For meshes: check bounding box closest point
            if (node.isMesh && node.geometry) {
                // Compute bounding box if it doesn't have one
                if (!node.geometry.boundingBox) {
                    node.geometry.computeBoundingBox();
                }

                // Get the world bounding box
                const boundingBox = node.geometry.boundingBox.clone();
                boundingBox.applyMatrix4(node.matrixWorld);

                // Find closest point on bounding box to camera
                boundingBox.clampPoint(cameraPosition, closestPoint);

                // Distance from camera to closest point on bounding box
                const distance = cameraPosition.distanceTo(closestPoint);
                shouldBeVisible = distance <= this.maxVisibleDistance;
            }
            // For lights: check world position distance
            else if (node.isLight) {
                const worldPos = new THREE.Vector3();
                node.getWorldPosition(worldPos);
                const distance = cameraPosition.distanceTo(worldPos);
                shouldBeVisible = distance <= this.maxVisibleDistance;
            }
            // For groups/containers/non-renderables: ALWAYS KEEP VISIBLE
            // Groups don't render, only their children (meshes) do
            // Children's visibility is controlled individually above
            // Keeping groups visible ensures children can render if they need to
            else {
                shouldBeVisible = true;
            }

            // Update visibility
            node.visible = shouldBeVisible;
        });
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
            // Update all child meshes, not just the group
            page.traverse((child) => {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissiveIntensity = 0.5 + pulseIntensity;
                }
            });
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

            // Performance: Pre-filter lamps within reasonable distance before expensive sort
            const maxConsiderDistance = 25; // Only consider lamps within 25 units
            const nearbyLamps = [];

            for (const lamp of this.lamps) {
                const distance = lamp.light.position.distanceTo(playerPos);
                // Early skip for far lamps
                if (distance < maxConsiderDistance) {
                    nearbyLamps.push({ lamp, distance });
                } else {
                    // Far lamps fade to 0 intensity (no visibility toggle to prevent lag)
                    lamp.light.intensity = 0;
                }
            }

            // Only sort nearby lamps (much smaller array)
            nearbyLamps.sort((a, b) => a.distance - b.distance);

            for (const { lamp, distance } of nearbyLamps) {
                if (distance < lamp.light.distance * 2.5 && activeLights < this.maxActiveLights) {
                    // Apply flicker effect
                    const flicker = Math.sin(time * lamp.flickerSpeed * this.lampFlickerSpeed + lamp.flickerPhase);
                    const noise = Math.random() * 0.1 - 0.05;
                    lamp.light.intensity = lamp.baseIntensity * (0.9 + flicker * 0.05 + noise);

                    activeLights++;
                } else if (activeLights >= this.maxActiveLights) {
                    // Gradually fade out instead of hiding
                    lamp.light.intensity *= 0.95;
                    if (lamp.light.intensity < 0.01) lamp.light.intensity = 0;
                }
            }
        } else {
            // No player position, flicker all lamps
            for (const lamp of this.lamps) {
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

        // OPTIMIZATION: Use intensity instead of visibility to prevent shader recompile lag
        // Same optimization as fireplaces - toggling visibility causes GPU shader recompilation
        for (const lamp of this.lamps) {
            if (enabled) {
                // Restore lamp to base intensity
                lamp.light.intensity = lamp.baseIntensity;
            } else {
                // Set intensity to 0 instead of hiding (prevents shader recompile)
                lamp.light.intensity = 0;
            }
            // Note: light.visible stays true to prevent shader recompilation
        }

        logger.log(`💡 Lamps ${enabled ? 'enabled' : 'disabled'} (${this.lamps.length} total)`);
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

        // OPTIMIZATION: Reduce intensity instead of toggling visibility to prevent shader recompile
        // Toggling light visibility can cause WebGL to recompile shaders, causing lag spikes
        for (const fireplace of this.fireplaces) {
            // Don't re-enable extinguished fireplaces
            if (!fireplace.extinguished) {
                if (enabled) {
                    // Restore fireplace
                    fireplace.particles.visible = true;
                    fireplace.light.intensity = fireplace.baseIntensity;
                } else {
                    // Instead of hiding light, set intensity to 0 (prevents shader recompile lag)
                    fireplace.light.intensity = 0;
                    // Hide particles (less expensive than light changes)
                    fireplace.particles.visible = false;
                }
                // Note: We keep light.visible always true to prevent shader recompilation
            }
        }

        logger.log(`🔥 Fireplaces ${enabled ? 'enabled' : 'disabled'} (${this.fireplaces.length} total)`);
    }

    extinguishFireplace(fireplaceNode) {
        console.log('🔥 extinguishFireplace called with node:', fireplaceNode?.name);
        console.log('🔥 Total fireplaces:', this.fireplaces.length);

        // Find the fireplace data that matches this node
        for (const fireplace of this.fireplaces) {
            console.log('🔥 Checking fireplace mesh:', fireplace.mesh?.name);
            if (fireplace.mesh === fireplaceNode || fireplace.mesh.name === fireplaceNode?.name) {
                // Hide particles and light
                fireplace.particles.visible = false;
                fireplace.light.visible = false;
                fireplace.extinguished = true;
                console.log('🔥 Fireplace extinguished successfully!');
                return;
            }
        }
        console.warn('🔥 Could not find matching fireplace to extinguish');
    }
    toggleFireplaces() {
        this.setFireplacesEnabled(!this.fireplacesEnabled);
        return this.fireplacesEnabled;
    }

    updateLampShadows() {
        //logger.log(`💡 Updating lamp shadows (lampShadows: ${this.lampShadows}, maxShadowCasters: ${this.maxShadowCasters}, shadowMapSize: ${this.shadowMapSize})`);

        // Count shadow casters (reserve some for fireplaces)
        let shadowCasterCount = 0;
        const maxLampShadows = Math.max(0, this.maxShadowCasters - (this.fireplaceShadows ? 2 : 0));

        // First pass: disable all
        for (const lamp of this.lamps) {
            lamp.light.castShadow = false;
        }

        // If we have a player position, prioritize nearby lamps
        if (this.playerPosition && this.playerPosition.length() > 0.1) {
            // Create array of lamps with distances
            const lampsWithDistance = this.lamps.map(lamp => ({
                lamp: lamp,
                distance: lamp.light.position.distanceTo(this.playerPosition),
                isChandelier: lamp.type === 'chandelier'
            }));

            // Sort by priority: chandeliers first, then by distance
            lampsWithDistance.sort((a, b) => {
                if (a.isChandelier && !b.isChandelier) return -1;
                if (!a.isChandelier && b.isChandelier) return 1;
                return a.distance - b.distance;
            });

            // Enable shadows for closest/priority lamps
            for (const item of lampsWithDistance) {
                const shouldCastShadow = (item.isChandelier || this.lampShadows) && shadowCasterCount < maxLampShadows;

                if (shouldCastShadow) {
                    item.lamp.light.castShadow = true;
                    item.lamp.light.shadow.mapSize.width = this.shadowMapSize;
                    item.lamp.light.shadow.mapSize.height = this.shadowMapSize;
                    item.lamp.light.shadow.needsUpdate = true;
                    shadowCasterCount++;
                }
            }
        } else {
            // No player position, use simple priority (chandeliers first)
            for (const lamp of this.lamps) {
                const isChandelier = lamp.type === 'chandelier';
                const shouldCastShadow = (isChandelier || this.lampShadows) && shadowCasterCount < maxLampShadows;

                if (shouldCastShadow) {
                    lamp.light.castShadow = true;
                    lamp.light.shadow.mapSize.width = this.shadowMapSize;
                    lamp.light.shadow.mapSize.height = this.shadowMapSize;
                    lamp.light.shadow.needsUpdate = true;
                    shadowCasterCount++;
                }
            }
        }
        //logger.log(`✅ Updated lamp shadows: ${shadowCasterCount} shadow casters enabled out of ${this.lamps.length} lamps`);
    }

    updateFireplaceShadows() {
        logger.log(`🔥 Updating fireplace shadows (fireplaceShadows: ${this.fireplaceShadows}, shadowMapSize: ${this.shadowMapSize})`);

        let shadowCasterCount = 0;
        const maxFireplaceShadows = Math.min(2, this.maxShadowCasters); // Max 2 fireplace shadows

        // If we have a player position, prioritize nearby fireplaces
        if (this.playerPosition && this.playerPosition.length() > 0.1) {
            // Create array with distances
            const fireplacesWithDistance = this.fireplaces.map(fireplace => ({
                fireplace: fireplace,
                distance: fireplace.light.position.distanceTo(this.playerPosition)
            }));

            // Sort by distance (closest first)
            fireplacesWithDistance.sort((a, b) => a.distance - b.distance);

            // Enable shadows for closest fireplaces
            for (const item of fireplacesWithDistance) {
                const shouldCastShadow = this.fireplaceShadows && shadowCasterCount < maxFireplaceShadows;

                item.fireplace.light.castShadow = shouldCastShadow;
                if (shouldCastShadow) {
                    item.fireplace.light.shadow.mapSize.width = this.shadowMapSize;
                    item.fireplace.light.shadow.mapSize.height = this.shadowMapSize;
                    item.fireplace.light.shadow.needsUpdate = true;
                    shadowCasterCount++;
                }
            }
        } else {
            // No player position, use simple order
            for (const fireplace of this.fireplaces) {
                const shouldCastShadow = this.fireplaceShadows && shadowCasterCount < maxFireplaceShadows;

                fireplace.light.castShadow = shouldCastShadow;
                if (shouldCastShadow) {
                    fireplace.light.shadow.mapSize.width = this.shadowMapSize;
                    fireplace.light.shadow.mapSize.height = this.shadowMapSize;
                    fireplace.light.shadow.needsUpdate = true;
                    shadowCasterCount++;
                }
            }
        }
        logger.log(`✅ Updated fireplace shadows: ${shadowCasterCount} shadow casters enabled out of ${this.fireplaces.length} fireplaces`);
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

    /**
     * Debug method to list all physics bodies with their positions and sizes
     */
    listPhysicsBodies() {
        logger.log(`\n📊 Physics Bodies Report (Total: ${this.physicsBodies.length})`);
        logger.log('─'.repeat(80));

        const bodies = this.physicsBodies.map((entry, index) => {
            const body = entry.body;
            const translation = body.translation();
            return {
                '#': index,
                'Name': entry.mesh.name.substring(0, 20),
                'X': translation.x.toFixed(2),
                'Y': translation.y.toFixed(2),
                'Z': translation.z.toFixed(2)
            };
        });

        console.table(bodies);
        logger.log(`Total physics bodies: ${this.physicsBodies.length}`);
        return this.physicsBodies;
    }

    validateStageLoaded() {
        if (!this.model) {
            logger.error('❌ VALIDATION FAILED: No model in loader');
            return false;
        }

        let totalMeshes = 0, visibleMeshes = 0, opaqueCount = 0;
        const issues = [];

        this.model.traverse((node) => {
            if (node.isMesh) {
                totalMeshes++;
                if (node.visible) visibleMeshes++;

                // Check material opacity
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const mat of materials) {
                    if (mat && mat.opacity > 0) opaqueCount++;
                }
            }
        });

        if (totalMeshes === 0) {
            issues.push('No meshes found in model');
        }
        if (visibleMeshes === 0) {
            issues.push('No visible meshes');
        }
        if (opaqueCount === 0) {
            issues.push('No opaque materials found (all transparent?)');
        }

        if (issues.length > 0) {
            logger.error('❌ VALIDATION FAILED:', issues.join(', '));
            return false;
        }

        logger.log(`✅ VALIDATION PASSED: ${visibleMeshes}/${totalMeshes} meshes visible, ${opaqueCount} opaque materials`);
        return true;
    }

    /**
     * Visualize occlusion culling by showing/hiding visible rooms
     * Shows currently visible rooms in green, culled rooms in red
     */
    visualizeOcclusionCulling(enabled) {
        if (!this.model) {
            logger.warn('⚠️ Model not loaded yet');
            return;
        }

        console.log(`👁️ Occlusion Culling Visualization (per-object): ${enabled ? 'ON' : 'OFF'}`);
        this.occlusionVizEnabled = enabled;

        // Force an update of visible objects before visualization
        if (enabled && typeof window !== 'undefined' && window.gameControls && window.gameControls.camera) {
            console.log(`🔄 Forcing occlusion culling update before visualization...`);
            this.updateOcclusionCulling(window.gameControls.camera.position);
        }

        let visibleMeshes = 0;
        let culledMeshes = 0;
        let totalMeshes = 0;

        this.model.traverse((node) => {
            if (!node.isMesh) return;

            totalMeshes++;

            if (enabled) {
                // Apply visualization colors
                if (!node.userData.originalMaterial) {
                    node.userData.originalMaterial = node.material;
                }

                // Color based on current visibility state
                const isVisible = node.visible;
                const color = isVisible ? 0x00ff00 : 0xff0000; // Green for visible, red for culled

                const visMaterial = new THREE.MeshBasicMaterial({
                    color: color,
                    wireframe: false,
                    transparent: true,
                    opacity: 0.3
                });

                node.material = visMaterial;

                if (isVisible) {
                    visibleMeshes++;
                } else {
                    culledMeshes++;
                }
            } else {
                // Restore original materials
                if (node.userData.originalMaterial) {
                    node.material = node.userData.originalMaterial;
                    delete node.userData.originalMaterial;
                }
            }
        });

        console.log(`👁️ Visualization Updated - Visible: ${visibleMeshes}, Culled: ${culledMeshes}, Total: ${totalMeshes}`);

        // Debug info
        if (enabled && window.gameControls && window.gameControls.camera) {
            const camPos = window.gameControls.camera.position;
            console.log(`👁️ Camera position (world): x=${camPos.x.toFixed(2)}, y=${camPos.y.toFixed(2)}, z=${camPos.z.toFixed(2)}`);
            console.log(`👁️ Max visible distance: ${this.maxVisibleDistance}`);
        }
    }

    /**
     * Update visualization colors in real-time as visibility changes
     * Called every frame when visualization is enabled
     */
    updateOcclusionVizualization() {
        if (!this.model) return;

        let visibleMeshes = 0;
        let culledMeshes = 0;

        this.model.traverse((node) => {
            if (!node.isMesh) return;

            // Update material color based on current visibility state
            const isVisible = node.visible;
            const color = isVisible ? 0x00ff00 : 0xff0000; // Green for visible, red for culled

            // Only update if we have a visualization material
            if (node.material && node.userData.originalMaterial) {
                if (node.material instanceof THREE.MeshBasicMaterial) {
                    node.material.color.setHex(color);
                    if (isVisible) {
                        visibleMeshes++;
                    } else {
                        culledMeshes++;
                    }
                }
            }
        });
    }

    dispose() {
        logger.log('🧹 Disposing mansion loader...');

        // Clean up physics bodies
        for (const { body } of this.physicsBodies) {
            this.physicsManager.removeBody(body);
        }
        this.physicsBodies = [];

        // Clean up lamps
        for (const lamp of this.lamps) {
            if (lamp.light) {
                this.scene.remove(lamp.light);
                if (lamp.light.dispose) lamp.light.dispose();
            }
            if (lamp.helper) {
                this.scene.remove(lamp.helper);
            }
        }
        this.lamps = [];

        // Clean up fireplaces
        if (this.fireplaces) {
            for (const fireplace of this.fireplaces) {
                if (fireplace.particles) {
                    this.scene.remove(fireplace.particles);
                    if (fireplace.particles.geometry) fireplace.particles.geometry.dispose();
                    if (fireplace.particles.material) fireplace.particles.material.dispose();
                }
                if (fireplace.light) {
                    this.scene.remove(fireplace.light);
                }
            }
            this.fireplaces = [];
        }

        // Clean up model and its materials/geometries
        if (this.model) {
            logger.log(`🗑️ Removing model from scene. Model name: ${this.model.name}, Children count before: ${this.scene.children.length}`);
            this.scene.remove(this.model);
            logger.log(`✅ Model removed. Children count after: ${this.scene.children.length}`);
            this.model.traverse((node) => {
                if (node.isMesh) {
                    // Dispose geometry
                    if (node.geometry) node.geometry.dispose();

                    // Dispose materials and their textures
                    if (node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        for (const material of materials) {
                            // Dispose all textures in this material
                            Object.values(material).forEach((value) => {
                                if (value && typeof value === 'object' && value.isTexture) {
                                    // Close ImageBitmap if present (critical for GLB files)
                                    if (value.source?.data?.close) {
                                        value.source.data.close();
                                    }
                                    value.dispose();
                                }
                            });
                            // Dispose the material itself
                            material.dispose();
                        }
                    }
                }
            });
            this.model = null;
        }

        // Clean up room tracking
        this.rooms.clear();
        this.visibleRooms.clear();

        logger.log('✅ Mansion loader disposed');
    }
}

export { MansionLoader };
