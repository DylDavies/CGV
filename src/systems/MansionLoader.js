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
        this.physicsBodies = [];

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

        // Lightmap system
        this.lightmapOn = null;  // Lightmap with lights ON
        this.lightmapOff = null; // Lightmap with lights OFF
        this.useLightsOn = true;  // Toggle between lights on/off (renamed from lightmapsEnabled)

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

        // Load lightmap textures first
        logger.log('🗺️ Loading lightmap textures...');
        const textureLoader = new THREE.TextureLoader();

        try {
            this.lightmapOn = await textureLoader.loadAsync('blender/Mansion_Lightmap_On.png');
            this.lightmapOff = await textureLoader.loadAsync('blender/Mansion_Lightmap_Off.png');

            // Configure lightmaps - CRITICAL for proper rendering
            this.lightmapOn.flipY = false;
            this.lightmapOff.flipY = false;
            this.lightmapOn.encoding = THREE.sRGBEncoding;
            this.lightmapOff.encoding = THREE.sRGBEncoding;

            // Enable anisotropic filtering for better quality
            this.lightmapOn.anisotropy = 16;
            this.lightmapOff.anisotropy = 16;

            logger.log('✅ Lightmap textures loaded successfully');
            logger.log(`   Lightmap On size: ${this.lightmapOn.image.width}x${this.lightmapOn.image.height}`);
            logger.log(`   Lightmap Off size: ${this.lightmapOff.image.width}x${this.lightmapOff.image.height}`);

            // Debug: Check actual pixel data
            const canvas = document.createElement('canvas');
            canvas.width = this.lightmapOn.image.width;
            canvas.height = this.lightmapOn.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.lightmapOn.image, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Sample some pixels to verify it's not all black
            let totalBrightness = 0;
            const samplePoints = 100;
            for (let i = 0; i < samplePoints; i++) {
                const randomIdx = Math.floor(Math.random() * (data.length / 4)) * 4;
                const r = data[randomIdx];
                const g = data[randomIdx + 1];
                const b = data[randomIdx + 2];
                totalBrightness += (r + g + b) / 3;
            }
            const avgBrightness = totalBrightness / samplePoints;
            logger.log(`   Average pixel brightness: ${avgBrightness.toFixed(2)}/255`);

            if (avgBrightness < 10) {
                logger.warn('   ⚠️ WARNING: Lightmap appears mostly black! Check Blender bake.');
            } else {
                logger.log('   ✅ Lightmap contains visible data');
            }
        } catch (error) {
            logger.error('❌ Failed to load lightmap textures:', error);
        }

        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();

            loader.load(
                modelPath,
                (gltf) => {
                    logger.log('✅ Mansion model loaded successfully');
                    this.model = gltf.scene;

                    // Process the model (includes material sharing)
                    this.processModel();

                    this.setupInstancedMeshes()

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

    processModel() {
        logger.log('🔍 Processing mansion model - optimizing Blender materials...');

        let totalMeshes = 0;
        let sharedMaterials = 0;
        let lightmappedMeshes = 0;
        const materialMap = new Map(); // Track materials by their properties

        // Performance optimizations while keeping Blender materials
        this.model.traverse((node) => {
            if (node.isMesh) {
                totalMeshes++;

                // Disable shadows for most objects
                node.castShadow = false;
                node.receiveShadow = false;

                // Enable frustum culling
                node.frustumCulled = true;

                // Optimize existing Blender materials
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];

                    materials.forEach((material, index) => {
                        // CRITICAL: Apply lightmap to material BEFORE material sharing
                        // Don't share lightmaps across materials - each needs its own
                        if (this.lightmapOn && this.lightmapOff) {
                            material.lightMap = this.useLightsOn ? this.lightmapOn : this.lightmapOff;
                            // INCREASED INTENSITY: Match Blender's brightness
                            material.lightMapIntensity = 2.5;  // Increased from 1.0 to 2.5
                            material.needsUpdate = true;
                            lightmappedMeshes++;

                            // Debug first few materials
                            if (lightmappedMeshes <= 3) {
                                logger.log(`  🗺️ Applied lightmap to ${node.name}:`);
                                logger.log(`     Material: ${material.name}`);
                                logger.log(`     LightMap: ${material.lightMap ? '✅' : '❌'}`);
                                logger.log(`     Intensity: ${material.lightMapIntensity}`);
                            }
                        }

                        // DON'T share materials if they have lightmaps (each mesh needs its own material instance)
                        // This prevents lightmap conflicts
                        this.optimizeMaterial(material);
                    });
                }

                // Optimize geometry
                if (node.geometry) {
                    node.geometry.computeBoundingSphere();

                    // CRITICAL: Check if uv2 exists for lightmaps
                    if (!node.geometry.attributes.uv2) {
                        logger.warn(`  ⚠️ ${node.name} missing uv2! Re-export from Blender with both UV layers.`);
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
        logger.log(`   Lightmapped meshes: ${lightmappedMeshes}`);
        logger.log(`   Lightmap intensity: 2.5x`);

        // Store the material map for later use
        this.materialCache = materialMap;

        // Organize meshes by room collections
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
        // Create a unique key for material caching based on its properties
        const props = {
            type: material.type,
            color: material.color ? material.color.getHex() : 0,
            opacity: material.opacity || 1,
            transparent: material.transparent || false,
            // Include texture references if they exist
            map: material.map ? material.map.uuid : 'none',
            roughness: material.roughness || 0,
            metalness: material.metalness || 0
        };
        
        return JSON.stringify(props);
    }

    organizeByRooms() {
        logger.log('🗂️ Organizing rooms from collections...');

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
                logger.log(`📍 Room "${roomName}" registered with ${roomData.meshes.length} meshes`);
            }
        });
    }

    generatePhysics() {
        logger.log('⚙️ Generating physics collision bodies...');

        let collisionCount = 0;
        let skippedCount = 0;

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

        logger.log(`✅ Generated ${collisionCount} physics collision bodies`);
        logger.log(`🚪 Skipped ${skippedCount} objects (doors, openings, etc.)`);
    }

    hideDebugObjects() {
        logger.log('🔍 Scanning for debug/leftover objects and portraits...');

        let hiddenCount = 0;

        this.model.traverse((node) => {
            if (node.isMesh) {
                const nodeName = node.name.toLowerCase();

                const isDebugObject =
                    nodeName.includes('helper') ||
                    nodeName.includes('debug') ||
                    nodeName.includes('marker') ||
                    nodeName.includes('guide') ||
                    nodeName.includes('gizmo') ||
                    nodeName.includes('temp');

                const isPortrait =
                    nodeName.includes('portrait') ||
                    nodeName.includes('painting') ||
                    nodeName.includes('picture') ||
                    nodeName.includes('frame');

                let hasDebugMaterial = false;
                if (node.material) {
                    const material = Array.isArray(node.material) ? node.material[0] : node.material;
                    if (material.color) {
                        const color = material.color;
                        if (color.r > 0.9 && color.g < 0.1 && color.b < 0.1) {
                            hasDebugMaterial = true;
                        }
                        if (color.g > 0.9 && color.r < 0.1 && color.b < 0.1) {
                            hasDebugMaterial = true;
                        }
                        if (color.b > 0.9 && color.r < 0.1 && color.g < 0.1) {
                            hasDebugMaterial = true;
                        }
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

    createPhysicsBodyFromMesh(mesh) {
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);

        if (box.isEmpty()) {
            return null;
        }

        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);

        if (isNaN(center.x) || isNaN(center.y) || isNaN(center.z)) {
            return null;
        }

        if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z)) {
            return null;
        }

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
        logger.log("✅ Navigation mesh visualizer created. Toggle with gameControls.toggleNavMeshVisualizer()");
    }

    createNavMeshNodesVisualizer() {
    const zone = this.pathfinding.zones[this.ZONE];
    logger.log("Inspecting the navigation zone object:", zone); 
    if (!zone) {
        logger.warn("Could not create node visualizer: Zone not found.");
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
        logger.log('🔥 Setting up fireplaces...');

        this.model.traverse((node) => {
            const nodeName = node.name.toLowerCase();

            if (nodeName.includes('fire') && !nodeName.includes('fireplace')) {
                this.setupFireplace(node);
            }
        });

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
        const randoms = new Float32Array(particleCount * 3); // x: lifetime, y: speed, z: size

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 0.5; // x
            positions[i * 3 + 1] = Math.random() * 0.2;         // y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5; // z

            randoms[i * 3 + 0] = 1.0 + Math.random(); // lifetime
            randoms[i * 3 + 1] = 0.5 + Math.random() * 0.5; // speed
            randoms[i * 3 + 2] = 0.1 + Math.random() * 0.1; // size
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uColor: { value: new THREE.Color(0xff6600) },
            },
            vertexShader: `
                uniform float uTime;
                attribute vec3 aRandom; // x: lifetime, y: speed, z: size

                void main() {
                    vec3 pos = position;
                    float progress = mod(uTime * aRandom.y, aRandom.x) / aRandom.x;

                    pos.y += progress * 2.0; // Move particle up

                    // Fade out at the end of life
                    float size = aRandom.z * (1.0 - progress);

                    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    gl_Position = projectionMatrix * viewPosition;
                    gl_PointSize = size * 100.0;
                    gl_PointSize *= (1.0 / -viewPosition.z);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;

                void main() {
                    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                    float strength = 1.0 - (distanceToCenter * 2.0);
                    gl_FragColor = vec4(uColor, strength);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false, // Important for transparency
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
            flickerPhase: Math.random() * Math.PI * 2,
        };

        this.fireplaces.push(fireplaceData);
    }

    setupOcclusionCulling() {
        logger.log('👁️ Setting up occlusion culling system...');

        let meshCount = 0;
        this.model.traverse((node) => {
            if (node.isMesh) {
                // Enable frustum culling to skip rendering objects outside camera view
                node.frustumCulled = true;

                // Set material side to reduce overdraw
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
            if (room) {
                return room;
            }
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

            if (isNaN(doorPosition.x) || isNaN(doorPosition.y) || isNaN(doorPosition.z)) {
                return null;
            }

            const worldQuaternion = new THREE.Quaternion();
            entranceDoor.getWorldQuaternion(worldQuaternion);

            const forward = new THREE.Vector3(-1, 2, -2);
            forward.applyQuaternion(worldQuaternion);
            forward.normalize();

            const spawnPoint = doorPosition.clone();
            spawnPoint.add(forward.multiplyScalar(2.0));
            spawnPoint.y += 0.5;
            spawnPoint.x += 0.5;

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
            // Show all rooms
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

    tick(delta, cameraPosition) {
        if (cameraPosition) {
            this.updateOcclusionCulling(cameraPosition);
        }

        if (this.fireplacesEnabled) {
            this.updateFireplaces(delta);
        }
    }

    updateFireplaces(delta) {
        const time = Date.now() * 0.001;

        for (const fireplace of this.fireplaces) {
            // Update the time uniform for the shader
            fireplace.particles.material.uniforms.uTime.value = time;

            // Keep the light flickering on the CPU
            const flicker = Math.sin(time * 10 + fireplace.flickerPhase);
            const noise = Math.random() * 0.3;
            fireplace.light.intensity = fireplace.baseIntensity * (0.8 + flicker * 0.2 + noise);
        }
    }

    // Lightmap control API
    toggleLightmaps() {
        this.useLightsOn = !this.useLightsOn;

        if (!this.lightmapOn || !this.lightmapOff) {
            logger.warn('⚠️ Lightmap textures not loaded');
            return this.useLightsOn;
        }

        // Update all materials
        this.model.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(material => {
                    material.lightMap = this.useLightsOn ? this.lightmapOn : this.lightmapOff;
                    material.needsUpdate = true;
                });
            }
        });

        logger.log(`💡 Mansion lights: ${this.useLightsOn ? 'ON' : 'OFF'}`);
        return this.useLightsOn;
    }

    setLightmapIntensity(intensity) {
        this.model.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(material => {
                    if (material.lightMap) {
                        material.lightMapIntensity = intensity;
                        material.needsUpdate = true;
                    }
                });
            }
        });
        logger.log(`🗺️ Lightmap intensity set to: ${intensity}`);
    }

    // Fireplace control API
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

    // Debug: List all objects in the model
    listAllObjects(filter = '') {
        logger.log('📋 Listing all objects in mansion model:');
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
        logger.log(`📊 Total: ${objects.length} objects${filter ? ` (filtered by "${filter}")` : ''}`);
        return objects;
    }

    // Debug: Search for objects by name
    findObjects(searchTerm) {
        logger.log(`🔍 Searching for objects containing "${searchTerm}":`);
        return this.listAllObjects(searchTerm);
    }

    // Debug: Show parent hierarchy of an object
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

    // Debug: List all groups/collections
    listCollections() {
        logger.log('📁 Listing all groups/collections:');
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
        logger.log('🧹 Disposing mansion loader...');

        for (const { body } of this.physicsBodies) {
            this.physicsManager.removeBody(body);
        }
        this.physicsBodies = [];

        for (const lamp of this.lamps) {
            if (lamp.light) {
                this.scene.remove(lamp.light);
                if (lamp.light.dispose) lamp.light.dispose();
            }
        }
        this.lamps = [];

        if (this.model) {
            this.scene.remove(this.model);

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

        logger.log('✅ Mansion loader disposed');
    }

    // Debug: Check UV channels
    debugUVs() {
        logger.log('🔍 UV Channel Debug:');
        let meshCount = 0;
        let hasUV1 = 0;
        let hasUV2 = 0;
        let bothUVs = 0;
        let sameArray = 0;
        const missingUV2Meshes = [];

        this.model.traverse((node) => {
            if (node.isMesh) {
                meshCount++;
                const geom = node.geometry;
                const uv1 = geom.attributes.uv;
                const uv2 = geom.attributes.uv2;

                if (uv1) hasUV1++;
                if (uv2) hasUV2++;
                if (uv1 && uv2) {
                    bothUVs++;
                    // Check if UV1 and UV2 point to the same array (BUG!)
                    if (uv1.array === uv2.array) {
                        sameArray++;
                    }
                } else if (uv1 && !uv2) {
                    // Track meshes missing UV2
                    missingUV2Meshes.push(node.name);
                }

                // Log first mesh details
                if (meshCount === 1) {
                    logger.log(`\nFirst mesh: ${node.name}`);
                    logger.log(`  UV1: ${uv1 ? `✅ (${uv1.count} coords)` : '❌ Missing'}`);
                    logger.log(`  UV2: ${uv2 ? `✅ (${uv2.count} coords)` : '❌ Missing'}`);

                    if (uv1 && uv2) {
                        // Sample first coordinate
                        logger.log(`  UV1 sample: (${uv1.array[0].toFixed(3)}, ${uv1.array[1].toFixed(3)})`);
                        logger.log(`  UV2 sample: (${uv2.array[0].toFixed(3)}, ${uv2.array[1].toFixed(3)})`);

                        if (uv1.array === uv2.array) {
                            logger.error('  ⚠️ UV1 and UV2 are THE SAME ARRAY! This is the bug!');
                        }
                    }
                }
            }
        });

        logger.log(`\n📊 UV Statistics:`);
        logger.log(`  Total meshes: ${meshCount}`);
        logger.log(`  Has UV1: ${hasUV1}`);
        logger.log(`  Has UV2: ${hasUV2}`);
        logger.log(`  Has BOTH: ${bothUVs}`);

        if (missingUV2Meshes.length > 0) {
            logger.warn(`\n⚠️ Meshes missing UV2 (${missingUV2Meshes.length}):`);
            missingUV2Meshes.forEach(name => logger.log(`  - ${name}`));
        }

        if (sameArray > 0) {
            logger.error(`\n❌ CRITICAL: ${sameArray} meshes have UV1 and UV2 pointing to SAME array!`);
            logger.log('   This means the Blender export did NOT include separate UV layers.');
            logger.log('   Solution: In Blender, ensure the model has 2 UV layers before export.');
        } else if (bothUVs === 0) {
            logger.error('\n❌ NO meshes have UV2! Lightmaps will not work.');
            logger.log('   Solution: Re-export from Blender with BOTH UV layers enabled.');
        } else if (bothUVs < meshCount) {
            logger.warn(`\n⚠️ Only ${bothUVs}/${meshCount} meshes have UV2!`);
        } else {
            logger.log('\n✅ All meshes have both UV channels with separate data');
        }

        return { meshCount, hasUV1, hasUV2, bothUVs, sameArray, missingUV2Meshes };
    }

    // Fix missing UV2 by copying UV1 as a fallback
    fixMissingUV2() {
        logger.log('🔧 Fixing missing UV2 channels...');
        let fixedCount = 0;

        this.model.traverse((node) => {
            if (node.isMesh) {
                const geom = node.geometry;
                const uv1 = geom.attributes.uv;
                const uv2 = geom.attributes.uv2;

                // If has UV1 but missing UV2, copy UV1 to UV2
                if (uv1 && !uv2) {
                    // Create a new array (don't reference the same array!)
                    const uv2Array = new Float32Array(uv1.array);
                    geom.setAttribute('uv2', new THREE.BufferAttribute(uv2Array, 2));
                    fixedCount++;
                    logger.log(`  ✅ Fixed UV2 for: ${node.name}`);
                }
            }
        });

        logger.log(`\n✅ Fixed ${fixedCount} meshes by copying UV1 to UV2`);
        logger.warn('⚠️ Note: This is a temporary fix. For proper lightmapping,');
        logger.warn('   re-export from Blender with a dedicated lightmap UV layer.');

        return fixedCount;
    }

    // Compare UV1 and UV2 to check if they're actually different
    compareUVChannels(meshName = null) {
        logger.log('🔍 Comparing UV1 vs UV2 coordinates...');
        let checkedMeshes = 0;
        let identicalUVs = 0;
        let differentUVs = 0;

        this.model.traverse((node) => {
            if (node.isMesh) {
                // Filter by mesh name if specified
                if (meshName && !node.name.toLowerCase().includes(meshName.toLowerCase())) {
                    return;
                }

                const geom = node.geometry;
                const uv1 = geom.attributes.uv;
                const uv2 = geom.attributes.uv2;

                if (uv1 && uv2) {
                    checkedMeshes++;

                    // Check if coordinates are identical
                    let areIdentical = true;
                    const threshold = 0.001; // Small threshold for floating point comparison

                    for (let i = 0; i < Math.min(uv1.array.length, uv2.array.length); i++) {
                        if (Math.abs(uv1.array[i] - uv2.array[i]) > threshold) {
                            areIdentical = false;
                            break;
                        }
                    }

                    if (areIdentical) {
                        identicalUVs++;
                        if (checkedMeshes <= 5 || meshName) {
                            logger.warn(`  ⚠️ ${node.name}: UV1 and UV2 are IDENTICAL`);
                        }
                    } else {
                        differentUVs++;
                        if (checkedMeshes <= 5 || meshName) {
                            logger.log(`  ✅ ${node.name}: UV1 and UV2 are different`);
                            // Show sample coordinates
                            logger.log(`     UV1[0]: (${uv1.array[0].toFixed(3)}, ${uv1.array[1].toFixed(3)})`);
                            logger.log(`     UV2[0]: (${uv2.array[0].toFixed(3)}, ${uv2.array[1].toFixed(3)})`);
                        }
                    }
                }
            }
        });

        logger.log(`\n📊 UV Comparison Results:`);
        logger.log(`  Total meshes checked: ${checkedMeshes}`);
        logger.log(`  Identical UV1/UV2: ${identicalUVs} (${((identicalUVs/checkedMeshes)*100).toFixed(1)}%)`);
        logger.log(`  Different UV1/UV2: ${differentUVs} (${((differentUVs/checkedMeshes)*100).toFixed(1)}%)`);

        if (identicalUVs > 0) {
            logger.warn(`\n⚠️ ${identicalUVs} meshes have identical UV1 and UV2!`);
            logger.warn('   This means Blender exported the same UV layer twice.');
            logger.warn('   Solution: In Blender, create a separate UV layer for lightmaps');
            logger.warn('   and ensure it\'s named "LightmapUV" or similar.');
        }

        return { checkedMeshes, identicalUVs, differentUVs };
    }

    // Visual debug: Show lightmap textures in browser
    showLightmapPreview() {
        logger.log('🖼️ Creating lightmap preview...');

        // Remove old preview if exists
        const oldPreview = document.getElementById('lightmap-preview');
        if (oldPreview) oldPreview.remove();

        // Create preview container
        const preview = document.createElement('div');
        preview.id = 'lightmap-preview';
        preview.style.position = 'fixed';
        preview.style.top = '10px';
        preview.style.right = '10px';
        preview.style.zIndex = '10000';
        preview.style.background = 'rgba(0,0,0,0.8)';
        preview.style.padding = '10px';
        preview.style.borderRadius = '5px';
        preview.style.color = 'white';
        preview.style.fontFamily = 'monospace';
        preview.style.fontSize = '12px';

        const title = document.createElement('div');
        title.textContent = 'Lightmap Preview (Click to close)';
        title.style.marginBottom = '10px';
        title.style.cursor = 'pointer';
        title.onclick = () => preview.remove();
        preview.appendChild(title);

        // Show Lightmap ON
        if (this.lightmapOn && this.lightmapOn.image) {
            const canvasOn = document.createElement('canvas');
            canvasOn.width = 256;
            canvasOn.height = 256;
            const ctxOn = canvasOn.getContext('2d');
            ctxOn.drawImage(this.lightmapOn.image, 0, 0, 256, 256);
            const labelOn = document.createElement('div');
            labelOn.textContent = 'Lightmap ON';
            labelOn.style.marginTop = '5px';
            preview.appendChild(labelOn);
            preview.appendChild(canvasOn);
        }

        // Show Lightmap OFF
        if (this.lightmapOff && this.lightmapOff.image) {
            const canvasOff = document.createElement('canvas');
            canvasOff.width = 256;
            canvasOff.height = 256;
            const ctxOff = canvasOff.getContext('2d');
            ctxOff.drawImage(this.lightmapOff.image, 0, 0, 256, 256);
            const labelOff = document.createElement('div');
            labelOff.textContent = 'Lightmap OFF';
            labelOff.style.marginTop = '10px';
            preview.appendChild(labelOff);
            preview.appendChild(canvasOff);
        }

        document.body.appendChild(preview);
        logger.log('✅ Lightmap preview displayed (top-right corner)');
    }
}

export { MansionLoader };

