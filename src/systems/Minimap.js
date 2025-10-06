// src/systems/Minimap.js - Orthographic minimap with fog of war

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class Minimap {
    constructor(scene, camera, mansionLoader, renderer) {
        this.mainScene = scene;
        this.mainCamera = camera;
        this.mansionLoader = mansionLoader;
        this.renderer = renderer;
        this.rooms = this.mansionLoader.getAllRooms();

        this.minimapScene = new THREE.Scene();
        this.minimapScene.background = new THREE.Color(0x000000);

        const frustumSize = 40;
        const aspect = 1;
        this.minimapCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2,
            frustumSize / 2, frustumSize / -2,
            0.1, 100
        );
        this.minimapCamera.position.set(0, 50, 0);
        this.minimapCamera.lookAt(0, 0, 0);

        const minimapSize = 256;
        this.renderTarget = new THREE.WebGLRenderTarget(minimapSize, minimapSize, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });

        this.roomMeshes = new Map(); // CHANGED: Now stores an array of meshes per room
        this.exploredRooms = new Set();

        this.createPlayerIndicator();
        this.createMinimapGeometry();
        this.createMinimapUI();

        this.enabled = true;
        this.setupControls();
        console.log('🗺️ Minimap system initialized');
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Tab') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    createPlayerIndicator() {
        const geometry = new THREE.CircleGeometry(0.5, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        this.playerIndicator = new THREE.Mesh(geometry, material);
        this.playerIndicator.rotation.x = -Math.PI / 2;
        this.playerIndicator.position.y = 0.1;
        this.playerIndicator.renderOrder = 2;
        this.minimapScene.add(this.playerIndicator);
    }

   createMinimapGeometry() {
        if (this.rooms.length === 0) {
            console.warn('⚠️ No rooms found for minimap');
            return;
        }

        const totalBounds = new THREE.Box3();
        this.rooms.forEach(room => totalBounds.union(room.bounds));

        const mansionSize = new THREE.Vector3();
        totalBounds.getSize(mansionSize);
        const mansionCenter = new THREE.Vector3();
        totalBounds.getCenter(mansionCenter);

        // --- FIX 1: Make map bigger by removing padding ---
        const frustumSize = Math.max(mansionSize.x, mansionSize.z);
        this.minimapCamera.left = frustumSize / -2;
        this.minimapCamera.right = frustumSize / 2;
        this.minimapCamera.top = frustumSize / 2;
        this.minimapCamera.bottom = frustumSize / -2;
        this.minimapCamera.position.set(mansionCenter.x, 50, mansionCenter.z);
        this.minimapCamera.lookAt(mansionCenter);
        this.minimapCamera.updateProjectionMatrix();

        this.rooms.forEach(room => {
            // --- FIX 2: A better approach - create a mesh for each wall ---
            const wallMeshes = [];
            if (room.children) {
                room.children.forEach(child => {
                    if (child.name.toLowerCase().includes('wall')) {
                        const box = new THREE.Box3().setFromObject(child);
                        const size = new THREE.Vector3();
                        box.getSize(size);
                        const center = new THREE.Vector3();
                        box.getCenter(center);
                        
                        // Create a simple plane for this wall
                        const wallGeometry = new THREE.PlaneGeometry(size.x, size.z);
                        const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
                        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
                        
                        wallMesh.position.set(center.x, 0, center.z);
                        wallMesh.rotation.x = -Math.PI / 2;
                        
                        this.minimapScene.add(wallMesh);
                        wallMeshes.push(wallMesh);
                    }
                });
            }
            // Store the array of wall meshes for this room
            this.roomMeshes.set(room.name, wallMeshes);
        });

        console.log(`🗺️ Created minimap geometry for ${this.rooms.length} rooms`);
    }

    createMinimapUI() {
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.id = 'minimap-canvas';
        this.minimapCanvas.width = 256;
        this.minimapCanvas.height = 256;
        this.minimapCanvas.style.cssText = `
            position: fixed;
            top: 75vh;
            left: 80vw;
            width: 200px;
            height: 200px;
            border: 3px solid #444;
            border-radius: 8px;
            background: #000;
            z-index: 100;
            image-rendering: pixelated;
        `;
        document.body.appendChild(this.minimapCanvas);
        this.minimapContext = this.minimapCanvas.getContext('2d');
    }

    getCurrentRoomForMinimap(playerPosition) {
        const playerPos2D = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);

        for (const room of this.rooms) {
            const roomBounds2D = room.bounds.clone();
            roomBounds2D.min.y = -Infinity;
            roomBounds2D.max.y = Infinity;

            if (roomBounds2D.containsPoint(playerPos2D)) {
                return room;
            }
        }
        return null;
    }

    updateExploration(playerPosition) {
        const currentRoom = this.getCurrentRoomForMinimap(playerPosition);

        if (currentRoom && !this.exploredRooms.has(currentRoom.name)) {
            this.exploredRooms.add(currentRoom.name);

            // Get the array of wall meshes for the current room
            const meshesToReveal = this.roomMeshes.get(currentRoom.name);
            
            if (meshesToReveal && meshesToReveal.length > 0) {
                console.log(`%cREVEALING ROOM: ${currentRoom.name}`, 'color: #00ff00; font-weight: bold;');
                
                // Animate each wall mesh in the room from black to grey
                meshesToReveal.forEach(mesh => {
                    const startColor = new THREE.Color(0x000000);
                    const endColor = new THREE.Color(0x333333); // Explored color
                    let progress = 0;

                    const revealMesh = () => {
                        progress += 0.05;
                        mesh.material.color.lerpColors(startColor, endColor, Math.min(progress, 1.0));
                        if (progress < 1.0) {
                            requestAnimationFrame(revealMesh);
                        }
                    };
                    revealMesh();
                });
            }
        }
    }

    updatePlayerIndicator(playerPosition) {
        this.playerIndicator.position.x = playerPosition.x;
        this.playerIndicator.position.z = playerPosition.z;
    }

    render() {
        if (!this.enabled) return;
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.minimapScene, this.minimapCamera);
        this.renderer.setRenderTarget(null);

        const pixels = new Uint8Array(256 * 256 * 4);
        this.renderer.readRenderTargetPixels(this.renderTarget, 0, 0, 256, 256, pixels);
        const imageData = new ImageData(new Uint8ClampedArray(pixels), 256, 256);

        const flippedCanvas = document.createElement('canvas');
        flippedCanvas.width = 256;
        flippedCanvas.height = 256;
        const flippedCtx = flippedCanvas.getContext('2d');
        flippedCtx.putImageData(imageData, 0, 0);

        this.minimapContext.save();
        this.minimapContext.scale(1, -1);
        this.minimapContext.drawImage(flippedCanvas, 0, -256);
        this.minimapContext.restore();
    }

    tick() {
        if (!this.enabled) return;
        this.updatePlayerIndicator(this.mainCamera.position);
        this.updateExploration(this.mainCamera.position);
        this.render();
    }

    toggle() {
        this.enabled = !this.enabled;
        this.minimapCanvas.style.display = this.enabled ? 'block' : 'none';
        console.log(`🗺️ Minimap: ${this.enabled ? 'ON' : 'OFF'}`);
    }

    dispose() {
        if (this.minimapCanvas) {
            document.body.removeChild(this.minimapCanvas);
        }
        if (this.renderTarget) {
            this.renderTarget.dispose();
        }
        this.minimapScene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}

export { Minimap };