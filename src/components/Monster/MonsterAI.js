// src/components/Monster/MonsterAI.js - Updated for NavMesh Pathfinding

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

class MonsterAI {
    constructor(monsterMesh, playerCamera, pathfinding, scene) {
        this.monster = monsterMesh;
        this.player = playerCamera;
        this.pathfinding = pathfinding;
        this.scene = scene;
        
        this.speed = 3; // Adjusted for delta-time based movement
        this.path = [];
        this.lastPathRecalculation = 0;
        this.recalculationInterval = 250; // Recalculate path more frequently
        this.ZONE = 'mansion';
        
        // Group ID for pathfinding
        this.groupID = 0;
        
        // Path visualization for debugging
        this.pathLine = null;

        // For Direct Pursuit
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 5; // How far the monster can "see"
        this.directPursuit = false;

        // For Visualizing Sight and Status
        this.sightLine = null;
        this.statusElement = null;
        this.createVisuals(); // Set up our visuals

        console.log("👾 Monster AI Initialized with NavMesh pathfinding.");
    }

    createVisuals() {
        // We will create the sightLine mesh dynamically in updateVisuals, so we only need to set up the status element here.
        this.sightLine = null; 

        // Create the on-screen status indicator
        this.statusElement = document.createElement('div');
        this.statusElement.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 16px;
            border: 1px solid #fff;
            border-radius: 5px;
            z-index: 1001;
        `;
        document.body.appendChild(this.statusElement);
    }

    updateVisuals() {
        // --- This is the new, reliable way to draw the line ---
        // 1. Remove the old line from the last frame
        if (this.sightLine) {
            this.scene.remove(this.sightLine);
            this.sightLine.geometry.dispose();
            this.sightLine.material.dispose();
        }

        // 2. Create a new, updated tube for the current frame
        const startPoint = this.monster.position;
        const endPoint = this.player.position;
        const sightPath = new THREE.LineCurve3(startPoint, endPoint);
        
        // Create a tube with a radius of 0.02, making it thick and visible
        const sightGeometry = new THREE.TubeGeometry(sightPath, 1, 0.02, 8, false);
        const sightMaterial = new THREE.MeshBasicMaterial({ 
            color: this.directPursuit ? 0xff0000 : 0x00ffff // Red if pursuing, Cyan if not
        });
        
        this.sightLine = new THREE.Mesh(sightGeometry, sightMaterial);
        this.scene.add(this.sightLine);
        // --- End of new line drawing logic ---

        // Update the status text (this part remains the same)
        if (this.directPursuit) {
            this.statusElement.textContent = "MODE: DIRECT PURSUIT";
            this.statusElement.style.color = "#ff4d4d";
            this.statusElement.style.borderColor = "#ff4d4d";
        } else {
            this.statusElement.textContent = "MODE: PATHFINDING";
            this.statusElement.style.color = "#ffffff";
            this.statusElement.style.borderColor = "#ffffff";
        }
    }

    spawn() {
        try {
            const zone = this.pathfinding.zones[this.ZONE];
            const nodes = zone.groups[this.groupID];

            if (!nodes || nodes.length === 0) {
                throw new Error("NavMesh node group is empty or not found.");
            }

            const randomIndex = Math.floor(Math.random() * nodes.length);
            const randomNode = nodes[randomIndex];

            if (randomNode && randomNode.centroid) {
                this.monster.position.copy(randomNode.centroid);
                console.log(`👾 Monster spawned at random NavMesh node ID: ${randomNode.id}`);
            } else {
                throw new Error("Selected random node is invalid or missing a centroid.");
            }
        } catch (error) {
            console.error("Could not find a valid node to spawn the monster.", error);
            this.monster.position.set(0, 0, 0);
        }
    }

    canSeePlayer() {
        const distanceToPlayer = this.monster.position.distanceTo(this.player.position);
        if (distanceToPlayer > this.raycaster.far) {
            return false;
        }

        const direction = this.player.position.clone().sub(this.monster.position).normalize();
        this.raycaster.set(this.monster.position, direction);

        // Get all potential obstacles, ignoring the monster itself and any visual helpers
        const obstacles = this.scene.children.filter(obj => {
            return obj !== this.monster && obj !== this.sightLine && obj !== this.pathLine;
        });

        const intersects = this.raycaster.intersectObjects(obstacles, true);

        // If the ray hits nothing, the path is clear.
        if (intersects.length === 0) {
            return true;
        }

        // If the first object the ray hits is further away than the player, the path is clear.
        if (intersects[0].distance > distanceToPlayer) {
            return true;
        }

        return false;
    }
    
    update(delta) {
        this.updateVisuals(); 

        const canSee = this.canSeePlayer();

        if (canSee) {
            this.directPursuit = true;
            this.path = [];
            if (this.pathLine) this.pathLine.visible = false;
        } else {
            this.directPursuit = false;
            if (this.pathLine) this.pathLine.visible = true;

            const now = Date.now();
            if (now - this.lastPathRecalculation > this.recalculationInterval) {
                this.recalculateChasePath();
            }
        }

        if (this.directPursuit) {
            this.moveDirectlyToPlayer(delta);
        } else {
            this.followPath(delta);
        }
    }
    
    moveDirectlyToPlayer(delta) {
       const direction = this.player.position.clone().sub(this.monster.position).normalize();
        direction.y = 0; // <-- ADD THIS LINE
        this.monster.position.add(direction.multiplyScalar(this.speed * delta));

        const lookTarget = new THREE.Vector3().copy(this.player.position);
        lookTarget.y = this.monster.position.y;
        this.monster.lookAt(lookTarget);
    }
    
    followPath(delta) {
        if (!this.path || this.path.length === 0) return;

        // --- NEW: Look-ahead logic ---
        // If the path has more than one node, aim for the second node instead of the first.
        // This makes the movement smoother around corners.
        let targetNodeIndex = this.path.length > 1 ? 1 : 0;
        let targetPosition = this.path[targetNodeIndex];
        // --- End of new logic ---

        const direction = targetPosition.clone().sub(this.monster.position);
        direction.y = 0;
        direction.normalize();

        this.monster.position.add(direction.multiplyScalar(this.speed * delta));
        
        const lookTarget = this.monster.position.clone().add(direction);
        this.monster.lookAt(lookTarget);

        // Check proximity to the *actual* next node to advance the path
        if (this.monster.position.distanceTo(this.path[0]) < 0.2) { // Increased threshold slightly
            this.path.shift();
        }
    }
    
    recalculateChasePath() {
        this.lastPathRecalculation = Date.now();
        
        const playerPos = this.player.position;
        const monsterPos = this.monster.position;

        const groupID = this.pathfinding.getGroup(this.ZONE, monsterPos, true);
        const closestPlayerNode = this.pathfinding.getClosestNode(playerPos, this.ZONE, groupID);
        const closestMonsterNode = this.pathfinding.getClosestNode(monsterPos, this.ZONE, groupID);

        if (closestPlayerNode && closestMonsterNode) {
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, closestPlayerNode.centroid, this.ZONE, groupID);
            
            if (path && path.length > 0) {
                this.path = path;
                this.visualizePath();
            } else {
                this.path = [];
            }
        } else {
             this.path = [];
        }
    }

    visualizePath() {
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
            this.pathLine.geometry.dispose();
            this.pathLine.material.dispose();
        }

        if (!this.path || this.path.length === 0) return;

        const points = [this.monster.position.clone(), ...this.path];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            linewidth: 5
        });
        
        this.pathLine = new THREE.Line(geometry, material);
        this.scene.add(this.pathLine);
    }

    tick(delta) {
        this.update(delta);
    }
}

export { MonsterAI };