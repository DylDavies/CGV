// src/components/Monster/MonsterAI.js - Updated for NavMesh Pathfinding

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

class MonsterAI {
    constructor(monsterMesh, playerCamera, pathfinding, scene, audioManager) {
        this.monster = monsterMesh;
        this.player = playerCamera;
        this.pathfinding = pathfinding;
        this.scene = scene;
        this.audioManager = audioManager;
        this.heartbeatStarted = false; // Track if heartbeat has started
        
        this.speed = 3; // Adjusted for delta-time based movement
        this.path = [];
        this.lastPathRecalculation = 0;
        this.recalculationInterval = 1000; // Recalculate path less frequently for non-hostile states
        this.ZONE = 'mansion';
        
        // Group ID for pathfinding
        this.groupID = 0;
        
        // Path visualization for debugging
        this.pathLine = null;
        this.pathVisualizationEnabled = false; // Path line is off by default

        // For Direct Pursuit
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 20; // Increased sight range for cautious state

        // For Visualizing Sight and Status
        this.sightLine = null;
        this.statusElement = null;
        this.createVisuals(); // Set up our visuals

        // --- REVISED: Aggression System ---
        this.aggressionLevel = 1; // Start at docile
        this.aggressionLevels = {
            1: { name: 'DOCILE', speed: 1.5, color: 0x00ff00 },
            2: { name: 'CAUTIOUS', speed: 2.0, color: 0xADD8E6 }, // Light Blue
            3: { name: 'CURIOUS', speed: 2.5, color: 0xffff00, distance: 12, fleeDistance: 10 }, // Increased flee distance to 10 (runs away earlier)
            4: { name: 'BOLD', speed: 3.0, color: 0xffa500, distance: 1 },
            5: { name: 'HOSTILE', speed: 4, color: 0xff0000, distance: 0 }
        };
        this.wanderTarget = null;
        this.lastWander = 0;
        this.isFleeing = false;
        this.fleeTimer = 0;
        this.fleeDuration = 4000; // 2 seconds in milliseconds

        this.mixer = monsterMesh.mixer;
        this.animations = monsterMesh.animations;
        this.activeAnimation = null;
        // --- END REVISED ---

        console.log("👾 Monster AI Initialized with NavMesh pathfinding.");
    }

    cycleAggression() {
        this.aggressionLevel++;
        if (this.aggressionLevel > Object.keys(this.aggressionLevels).length) {
            this.aggressionLevel = 1;
        }
        console.log(`🧠 Monster aggression level set to: ${this.aggressionLevel} (${this.aggressionLevels[this.aggressionLevel].name})`);
        this.path = []; // Clear path on state change
        this.wanderTarget = null; // Clear wander target
    }

    setAggressionLevel(level) {
        if (level >= 1 && level <= Object.keys(this.aggressionLevels).length) {
            this.aggressionLevel = level;
            console.log(`🧠 Monster aggression level set to: ${this.aggressionLevel} (${this.aggressionLevels[this.aggressionLevel].name})`);
            this.path = []; // Clear path on state change
            this.wanderTarget = null; // Clear wander target
        }
    }

    togglePathVisualization() {
        this.pathVisualizationEnabled = !this.pathVisualizationEnabled;
        if (this.pathLine) {
            this.pathLine.visible = this.pathVisualizationEnabled;
        }
        console.log(`Path visualization ${this.pathVisualizationEnabled ? 'ON' : 'OFF'}`);
    }


    createVisuals() {
        this.sightLine = null;

        // Status element removed - no longer displaying aggro level
        this.statusElement = null;
    }

    updateVisuals() {
        if (this.sightLine) {
            this.scene.remove(this.sightLine);
            this.sightLine.geometry.dispose();
            this.sightLine.material.dispose();
        }

        const startPoint = this.monster.position;
        const endPoint = this.player.position;
        const sightPath = new THREE.LineCurve3(startPoint, endPoint);

        const sightGeometry = new THREE.TubeGeometry(sightPath, 1, 0.02, 8, false);
        const sightMaterial = new THREE.MeshBasicMaterial({
            color: this.directPursuit ? 0xff0000 : 0x00ffff
        });

        this.sightLine = new THREE.Mesh(sightGeometry, sightMaterial);
        this.scene.add(this.sightLine);

        // Status element update removed - no longer displaying aggro level
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

            // Start heartbeat when monster spawns
            if (!this.heartbeatStarted) {
                this.audioManager.playHeartbeat();
                this.heartbeatStarted = true;
            }
        } catch (error) {
            console.error("Could not find a valid node to spawn the monster.", error);
            this.monster.position.set(0, 0, 0);
        }
    }

    canSeePlayer(fromPosition = this.monster.position) {
        if (this.aggressionLevel === 1) {
            const monsterDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.monster.quaternion);
            const directionToPlayer = this.player.position.clone().sub(fromPosition).normalize();
            
            if (monsterDirection.dot(directionToPlayer) < 0) {
                return false;
            }
        }

        const distanceToPlayer = fromPosition.distanceTo(this.player.position);
        if (distanceToPlayer > this.raycaster.far) {
            return false;
        }

        const direction = this.player.position.clone().sub(fromPosition).normalize();
        this.raycaster.set(fromPosition, direction);

        const obstacles = this.scene.children.filter(obj => {
            return obj !== this.monster && obj !== this.sightLine && obj !== this.pathLine && !obj.name.toLowerCase().includes('monster');
        });

        const intersects = this.raycaster.intersectObjects(obstacles, true);

        return intersects.length === 0 || intersects[0].distance > distanceToPlayer;
    }

    isSpotVisibleToPlayer(spot) {
        const distanceToSpot = this.player.position.distanceTo(spot);
        if (distanceToSpot > this.raycaster.far) {
            return false;
        }
    
        const direction = spot.clone().sub(this.player.position).normalize();
        this.raycaster.set(this.player.position, direction);
    
        const obstacles = this.scene.children.filter(obj => 
            !obj.name.toLowerCase().includes('monster') && obj !== this.sightLine && obj !== this.pathLine
        );
    
        const intersects = this.raycaster.intersectObjects(obstacles, true);
    
        return intersects.length === 0 || intersects[0].distance > distanceToSpot;
    }
    
    isPlayerLookingAtMonster() {
        const playerDirection = new THREE.Vector3();
        this.player.getWorldDirection(playerDirection);

        const monsterDirection = this.monster.position.clone().sub(this.player.position).normalize();
        return playerDirection.dot(monsterDirection) > 0.5; 
    }

    wander(delta) {
        const now = Date.now();
        if (!this.wanderTarget && now - this.lastWander > 5000) { 
            this.lastWander = now;
            
            const zone = this.pathfinding.zones[this.ZONE];
            const nodes = zone.groups[this.groupID];
            const randomIndex = Math.floor(Math.random() * nodes.length);
            this.wanderTarget = nodes[randomIndex].centroid;

            const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, this.groupID);
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, this.wanderTarget, this.ZONE, this.groupID);

            if (path) {
                this.path = path;
                // this.visualizePath(); // Commented out - causing bugs
            }
        }
        this.followPath(delta);
    }
    
    update(delta) {
        this.updateVisuals();
        const currentState = this.aggressionLevels[this.aggressionLevel];
        this.speed = currentState.speed;
        const now = Date.now();
        const distanceToPlayer = this.monster.position.distanceTo(this.player.position);

        // update heartbeat based on the distance to the player
        if(this.audioManager){
            this.audioManager.updateHeartbeat(distanceToPlayer, 25);
        }

        switch (this.aggressionLevel) {
            case 1: // Docile
                if (this.canSeePlayer()) {
                    this.aggressionLevel = 2; // Becomes Cautious
                    this.path = [];
                } else {
                    this.wander(delta);
                }
                break;
            
            case 2: // Cautious
                if (this.path.length > 0) {
                    this.followPath(delta);
                } else {
                    this.smoothLookAtPlayer(delta); // At hiding spot, just watch
                    if (now - this.lastPathRecalculation > 3000) { // Look for a new spot every 3 seconds
                        this.findHidingSpot();
                    }
                }
                // If player gets too close, become Curious
                if (distanceToPlayer < 5) {
                    this.aggressionLevel = 3;
                }
                break;

            case 3: // Curious
                if (this.isFleeing) {
                    if (now - this.fleeTimer > this.fleeDuration) {
                        if (distanceToPlayer < currentState.fleeDistance) {
                            this.aggressionLevel = 5; // Jumps to Hostile
                            this.isFleeing = false;
                        } else {
                            this.isFleeing = false;
                            this.path = []; 
                        }
                    } else {
                        if (now - this.lastPathRecalculation > this.recalculationInterval) {
                            this.recalculateFleePath();
                        }
                    }
                }
                else {
                    if (distanceToPlayer < currentState.fleeDistance) {
                        this.isFleeing = true;
                        this.fleeTimer = now; 
                        this.speed = currentState.speed * 1.5; 
                        this.recalculateFleePath(); 
                    }
                    else if (distanceToPlayer > currentState.distance) {
                        if (now - this.lastPathRecalculation > this.recalculationInterval) {
                            this.recalculateChasePath();
                        }
                    }
                    else {
                        this.path = [];
                        this.smoothLookAtPlayer(delta);
                    }
                }
                this.followPath(delta);
                break;
            case 4: // Bold
                const boldDistanceToPlayer = distanceToPlayer;
                if (boldDistanceToPlayer < 1.5) {
                    this.aggressionLevel = 5; // Becomes Hostile
                    return; 
                }
                if (this.isPlayerLookingAtMonster()) {
                    this.path = [];
                    this.smoothLookAtPlayer(delta);
                } else {
                    if (boldDistanceToPlayer > currentState.distance) {
                        if (now - this.lastPathRecalculation > this.recalculationInterval) { 
                            this.recalculateChasePath();
                        }
                    } else {
                        this.path = []; 
                    }
                }
                this.followPath(delta);
                break;
            case 5: // Hostile
                this.recalculationInterval = 800; 
                const canSee = this.canSeePlayer();
                if (canSee) {
                    this.directPursuit = true;
                    this.path = [];
                    if (this.pathLine) this.pathLine.visible = false;
                } else {
                    this.directPursuit = false;
                    if (this.pathLine) this.pathLine.visible = true;
                    if (now - this.lastPathRecalculation > this.recalculationInterval) {
                        this.recalculateChasePath();
                    }
                }
                if (this.directPursuit) {
                    this.moveDirectlyToPlayer(delta);
                } else {
                    this.followPath(delta);
                }
                break;
        }

        const isMoving = this.path.length > 0 || this.directPursuit;
        let animationToPlay = null;

        if (isMoving) {
            if (this.aggressionLevel === 5) {
                animationToPlay = 'run';
            } else {
                animationToPlay = 'walk';
            }
        }

        this.setAnimation(animationToPlay);
    }
    
    setAnimation(animationName) {
        if (this.activeAnimation === animationName) {
            return;
        }

        // Stop the current animation if it's playing
        if (this.activeAnimation && this.animations[this.activeAnimation]) {
            this.animations[this.activeAnimation].stop();
        }

        // Start the new animation
        if (animationName && this.animations[animationName]) {
            this.animations[animationName].play();
        }

        this.activeAnimation = animationName;
    }

    moveDirectlyToPlayer(delta) {
       const direction = this.player.position.clone().sub(this.monster.position).normalize();
        direction.y = 0; 
        this.monster.position.add(direction.multiplyScalar(this.speed * delta));
        this.smoothLookAtPlayer(delta); 
    }
    
    smoothLookAtPlayer(delta) {
        const targetQuaternion = new THREE.Quaternion();
        const directionToPlayer = this.player.position.clone().sub(this.monster.position);
        const lookTarget = this.monster.position.clone().sub(directionToPlayer);
        lookTarget.y = this.monster.position.y; 

        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(this.monster.position, lookTarget, this.monster.up);
        targetQuaternion.setFromRotationMatrix(tempMatrix);
        this.monster.quaternion.slerp(targetQuaternion, 4 * delta);
    }

    followPath(delta) {
        if (!this.path || this.path.length === 0) {
            if (this.wanderTarget) {
                this.wanderTarget = null; 
                this.lastWander = Date.now(); 
            }
            return;
        }
        const targetPosition = this.path[0];
        const direction = targetPosition.clone().sub(this.monster.position);
        const distanceToTarget = direction.length();

        if (distanceToTarget < 0.1) {
            this.monster.position.copy(targetPosition);
            this.path.shift();
            return; 
        }

        direction.y = 0;
        direction.normalize();

        const moveDistance = Math.min(this.speed * delta, distanceToTarget);
        this.monster.position.add(direction.multiplyScalar(moveDistance));
        
        const lookAtPosition = this.path.length > 1 ? this.path[1] : targetPosition;
        const lookTarget = new THREE.Vector3().copy(lookAtPosition);
        lookTarget.y = this.monster.position.y;
        this.monster.lookAt(lookTarget);
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
                // this.visualizePath(); // Commented out - causing bugs
            } else {
                this.path = [];
            }
        } else {
             this.path = [];
        }
    }

    recalculateFleePath() {
        this.lastPathRecalculation = Date.now();
        const fleeDirection = this.monster.position.clone().sub(this.player.position).normalize();
        const fleeDistance = 15;
        const targetPoint = this.monster.position.clone().add(fleeDirection.multiplyScalar(fleeDistance));
        const groupID = this.pathfinding.getGroup(this.ZONE, this.monster.position, true);
        const closestFleeNode = this.pathfinding.getClosestNode(targetPoint, this.ZONE, groupID);
        const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, groupID);
        if (closestFleeNode && closestMonsterNode) {
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, closestFleeNode.centroid, this.ZONE, groupID);
            if (path && path.length > 0) {
                this.path = path;
                // this.visualizePath(); // Commented out - causing bugs
            } else {
                this.path = [];
            }
        } else {
             this.path = [];
        }
    }

    findHidingSpot() {
        this.lastPathRecalculation = Date.now();
        const groupID = this.pathfinding.getGroup(this.ZONE, this.monster.position, true);
        const allNodes = this.pathfinding.zones[this.ZONE].groups[groupID];
        
        let bestSpot = null;
        let highestScore = -Infinity;
    
        const directionToPlayerFromMonster = this.player.position.clone().sub(this.monster.position).normalize();
    
        for (const node of allNodes) {
            const spot = node.centroid;
            const distanceToMonster = this.monster.position.distanceTo(spot);
    
            // Filter 1: Reasonable distance
            if (distanceToMonster > 3 && distanceToMonster < 20) {
                const directionToSpot = spot.clone().sub(this.monster.position).normalize();
                const pathDot = directionToPlayerFromMonster.dot(directionToSpot);
    
                // Filter 2: Must move generally away from the player
                if (pathDot < 0.3) { // Allow for some lateral movement, not just directly away
                    let score = 0;
                    
                    // The #1 priority is that the player cannot see the spot.
                    if (this.isSpotVisibleToPlayer(spot)) {
                        continue; // If player can see it, it's not a hiding spot.
                    }
    
                    // Base score for being a valid, hidden spot.
                    score += 1000;
    
                    // Bonus: Can the monster see the player from this hidden spot?
                    if (this.canSeePlayer(spot)) {
                        score += 200; // This is a great ambush spot.
                    }
                    
                    // Bonus for being further away from the player's forward direction
                    const playerDirection = new THREE.Vector3();
                    this.player.getWorldDirection(playerDirection);
                    const spotDirectionFromPlayer = spot.clone().sub(this.player.position).normalize();
                    const fovDot = playerDirection.dot(spotDirectionFromPlayer);
                    if (fovDot < 0) {
                        score += Math.abs(fovDot) * 50;
                    }
    
                    // Penalize distance slightly to prefer closer hiding spots
                    score -= distanceToMonster; 
                    
                    if (score > highestScore) {
                        highestScore = score;
                        bestSpot = spot;
                    }
                }
            }
        }
    
        if (bestSpot) {
            const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, groupID);
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, bestSpot, this.ZONE, groupID);
            if (path) {
                this.path = path;
                // this.visualizePath(); // Commented out - causing bugs
            }
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
            color: this.isFleeing ? 0x0000ff : 0xffff00,
            linewidth: 5
        });
        this.pathLine = new THREE.Line(geometry, material);
        this.pathLine.visible = this.pathVisualizationEnabled; 
        this.scene.add(this.pathLine);
    }

    tick(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }
        this.update(delta);
    }
}
//this is the monsterAI

export { MonsterAI };