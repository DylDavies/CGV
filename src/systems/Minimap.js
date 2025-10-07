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

        this.roomMeshes = new Map();

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
        // Create a group to hold the player indicator
        this.playerIndicator = new THREE.Group();
        this.playerIndicator.position.y = 0.1;
        this.playerIndicator.renderOrder = 2;

        // Circle base
        const circleGeometry = new THREE.CircleGeometry(0.5, 8);
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        this.playerIndicator.add(circle);

        // Direction arrow (triangle pointing forward)
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0.6);
        arrowShape.lineTo(-0.3, -0.3);
        arrowShape.lineTo(0.3, -0.3);
        arrowShape.lineTo(0, 0.6);

        const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.y = 0.01;
        this.playerIndicator.add(arrow);

        this.minimapScene.add(this.playerIndicator);
    }

   createMinimapGeometry() {
        // Get the mansion model from the loader
        const mansionModel = this.mansionLoader.model;

        if (!mansionModel) {
            console.warn('⚠️ No mansion model found for minimap');
            return;
        }

        // Calculate bounds of entire mansion
        const totalBounds = new THREE.Box3().setFromObject(mansionModel);
        const mansionSize = new THREE.Vector3();
        totalBounds.getSize(mansionSize);
        const mansionCenter = new THREE.Vector3();
        totalBounds.getCenter(mansionCenter);

        // Set up orthographic camera to view from above with padding
        const frustumSize = Math.max(mansionSize.x, mansionSize.z) * 1.1;
        this.minimapCamera.left = frustumSize / -2;
        this.minimapCamera.right = frustumSize / 2;
        this.minimapCamera.top = frustumSize / 2;
        this.minimapCamera.bottom = frustumSize / -2;
        this.minimapCamera.position.set(mansionCenter.x, 50, mansionCenter.z);
        this.minimapCamera.lookAt(mansionCenter.x, 0, mansionCenter.z);
        this.minimapCamera.updateProjectionMatrix();

        console.log(`🗺️ Minimap camera setup: frustum=${frustumSize.toFixed(2)}, center=(${mansionCenter.x.toFixed(2)}, ${mansionCenter.z.toFixed(2)})`);

        // Traverse entire model and create minimap meshes for walls and floors
        let wallCount = 0;
        let floorCount = 0;

        mansionModel.traverse((node) => {
            if (!node.isMesh) return;

            const meshName = node.name.toLowerCase();

            // Check if it's a special S_Door object (these should be included)
            const isSpecialDoor = meshName.includes('s_door');

            // Check for door exclusion in mesh or parent hierarchy
            // BUT: Don't exclude S_Door objects
            let isDoor = !isSpecialDoor && meshName.includes('walldoor');
            if (!isDoor && !isSpecialDoor) {
                let parent = node.parent;
                while (parent) {
                    const parentName = parent.name.toLowerCase();
                    if (parentName.includes('walldoor')) {
                        isDoor = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }

            // Skip doors entirely (except S_Door objects)
            if (isDoor) return;

            // Check parent hierarchy for wall/floor/column designation
            let isWall = meshName.includes('wall');
            let isFloor = meshName.includes('floor');
            let isColumn = meshName.includes('columnangle');

            // If not found in mesh name, check parent chain
            if (!isWall && !isFloor && !isColumn) {
                let parent = node.parent;
                while (parent) {
                    const parentName = parent.name.toLowerCase();
                    if (parentName.includes('wall')) {
                        isWall = true;
                        break;
                    } else if (parentName.includes('floor')) {
                        isFloor = true;
                        break;
                    } else if (parentName.includes('columnangle')) {
                        isColumn = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }

            // Create minimap representation for walls, floors, and columns
            if (isWall || isFloor || isColumn) {
                // Get world bounding box
                node.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(node);
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // Skip tiny objects (likely decorative or errors)
                if (size.x < 0.1 || size.z < 0.1) {
                    return;
                }

                // For walls and columns, only include floor-level ones (skip elevated walls above doors)
                if (isWall || isColumn) {
                    // Check if the bottom of the wall is above floor level
                    // Floor level is considered Y < 3 (adjust this threshold as needed)
                    const bottomY = box.min.y;
                    if (bottomY > 2.0) {
                        return; // Skip elevated walls
                    }
                }

                // Determine color based on type
                let color;
                if (isWall || isColumn) {
                    color = 0xaaaaaa; // Light gray for walls and columns
                    wallCount++;
                } else {
                    color = 0x444444; // Dark gray for floors
                    floorCount++;
                }

                // Create a top-down representation using the actual XZ footprint
                // For better gap filling, slightly increase the size
                const minimapGeometry = new THREE.PlaneGeometry(size.x * 1.01, size.z * 1.01);
                const minimapMaterial = new THREE.MeshBasicMaterial({
                    color: color,
                    side: THREE.DoubleSide,
                    depthTest: false
                });
                const minimapMesh = new THREE.Mesh(minimapGeometry, minimapMaterial);

                // Position at the center of the original mesh, on the XZ plane
                minimapMesh.position.set(center.x, 0.05, center.z);
                minimapMesh.rotation.x = -Math.PI / 2; // Lay flat on XZ plane

                // Render floors below walls
                if (isFloor) {
                    minimapMesh.renderOrder = 0;
                } else {
                    minimapMesh.renderOrder = 1;
                }

                this.minimapScene.add(minimapMesh);
            }
        });

        console.log(`🗺️ Created minimap: ${wallCount} walls, ${floorCount} floors`);
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


    updatePlayerIndicator(playerPosition) {
        this.playerIndicator.position.x = playerPosition.x;
        this.playerIndicator.position.z = playerPosition.z;

        // Rotate the player indicator to match camera direction
        // Get the camera's direction in world space
        const direction = new THREE.Vector3();
        this.mainCamera.getWorldDirection(direction);

        // Calculate rotation around Y axis (for top-down view)
        const angle = Math.atan2(direction.x, direction.z);
        this.playerIndicator.rotation.y = -angle;
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