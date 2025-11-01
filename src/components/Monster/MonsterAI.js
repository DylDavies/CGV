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

        // For Direct Pursuit
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 20; // Increased sight range for cautious state

        // For Visualizing Sight and Status
        this.sightLine = null;
        this.statusElement = null;
        this.createVisuals(); // Set up our visuals

        // Performance: Cache previous states to avoid unnecessary updates
        this.lastDirectPursuit = false;
        this.lastPathLength = 0;

        // Performance: Raycast throttling
        this.raycastFrameCounter = 0;
        this.raycastInterval = 3; // Only raycast every 3rd frame
        this.lastCanSeePlayer = false;
        this.cachedObstacles = null; // Cache obstacles array

        // Performance: Cache hiding spots
        this.cachedHidingSpots = null;
        this.lastHidingSpotCacheTime = 0;
        this.hidingSpotCacheDuration = 10000; // Recalculate hiding spots every 10 seconds

        // --- REVISED: Aggression System ---
        this.aggressionLevel = 1; // Start at docile
        this.aggressionLevels = {
            1: { name: 'DOCILE', speed: 1.5, color: 0x00ff00 },
            2: { name: 'CAUTIOUS', speed: 2.0, color: 0xADD8E6 }, // Light Blue
            3: { name: 'CURIOUS', speed: 2.5, color: 0xffff00, innerBubble: 5, outerBubble: 10 }, // Inner = aggressive, Outer = approach range
            4: { name: 'BOLD', speed: 3.0, color: 0xffa500, distance: 1 },
            5: { name: 'HOSTILE', speed: 4, color: 0xff0000, distance: 0 }
        };
        this.wanderTarget = null;
        this.lastWander = 0;
        this.isFleeing = false;
        this.fleeTimer = 0;
        this.fleeDuration = 10000; // 10 seconds before becoming bold

        this.mixer = monsterMesh.mixer;
        this.animations = monsterMesh.animations;
        this.activeAnimation = null;

        // Attack system
        this.isAttacking = false;
        this.attackStartTime = 0;
        this.ATTACK_DURATION = 1500; // 1.5 seconds for attack animation
        this.savedPosition = null; // Lock position during attack
        this.savedQuaternion = null; // Lock rotation during attack
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

    createVisuals() {
        this.sightLine = null;

        // Status element removed - no longer displaying aggro level
        this.statusElement = null;
    }

    updateVisuals() {
        // Sight line visualization disabled - no longer showing red/blue lines
        // This method is kept for potential future debugging needs
    }

    spawn() {
        try {
            // Skip spawning if pathfinding is not available (e.g., on office stage without navmesh)
            if (!this.pathfinding || !this.pathfinding.zones[this.ZONE]) {
                console.warn("⚠️ Monster cannot spawn - NavMesh pathfinding not available for current stage");
                return;
            }

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
        // Performance: Check distance first (cheap) before raycasting (expensive)
        const distanceToPlayer = fromPosition.distanceTo(this.player.position);
        if (distanceToPlayer > this.raycaster.far) {
            this.lastCanSeePlayer = false;
            return false;
        }

        if (this.aggressionLevel === 1) {
            const monsterDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.monster.quaternion);
            const directionToPlayer = this.player.position.clone().sub(fromPosition).normalize();

            if (monsterDirection.dot(directionToPlayer) < 0) {
                this.lastCanSeePlayer = false;
                return false;
            }
        }

        // Performance: Only raycast every 3rd frame, use cached result otherwise
        this.raycastFrameCounter++;
        if (this.raycastFrameCounter < this.raycastInterval) {
            return this.lastCanSeePlayer;
        }
        this.raycastFrameCounter = 0;

        const direction = this.player.position.clone().sub(fromPosition).normalize();
        this.raycaster.set(fromPosition, direction);

        // Performance: Cache obstacles array if not already cached
        if (!this.cachedObstacles) {
            this.cachedObstacles = this.scene.children.filter(obj => {
                return obj !== this.monster && obj !== this.sightLine && !obj.name.toLowerCase().includes('monster');
            });
        }

        const intersects = this.raycaster.intersectObjects(this.cachedObstacles, true);
        this.lastCanSeePlayer = intersects.length === 0 || intersects[0].distance > distanceToPlayer;

        return this.lastCanSeePlayer;
    }

    isSpotVisibleToPlayer(spot) {
        // Performance: Distance check first
        const distanceToSpot = this.player.position.distanceTo(spot);
        if (distanceToSpot > this.raycaster.far) {
            return false;
        }

        const direction = spot.clone().sub(this.player.position).normalize();
        this.raycaster.set(this.player.position, direction);

        // Performance: Use cached obstacles if available
        if (!this.cachedObstacles) {
            this.cachedObstacles = this.scene.children.filter(obj =>
                !obj.name.toLowerCase().includes('monster') && obj !== this.sightLine
            );
        }

        const intersects = this.raycaster.intersectObjects(this.cachedObstacles, true);

        return intersects.length === 0 || intersects[0].distance > distanceToSpot;
    }
    
    isPlayerLookingAtMonster() {
        const playerDirection = new THREE.Vector3();
        this.player.getWorldDirection(playerDirection);

        const monsterDirection = this.monster.position.clone().sub(this.player.position).normalize();
        return playerDirection.dot(monsterDirection) > 0.5; 
    }

    wander(delta) {
        // Skip wandering if pathfinding is not available (e.g., on office stage without navmesh)
        if (!this.pathfinding || !this.pathfinding.zones[this.ZONE]) {
            return;
        }

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

        // Check if we should attack (within attack range)
        // Only hostile or bold monsters attack
        // Attack range matches kill range (1.5) so player dies when monster attacks
        // Don't attack if player is hiding
        const playerIsHiding = window.gameControls?.interactionSystem?.isHiding || false;
        if (!this.isAttacking && !playerIsHiding && (this.aggressionLevel >= 4) && distanceToPlayer < 1.5) {
            this.startAttack();
            return; // Skip normal AI logic during attack
        }

        // If attacking, don't do normal AI - just wait for attack to complete
        if (this.isAttacking) {
            return;
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

            case 3: // Curious - Flee from outer bubble, approach from outside
                // Inner bubble: Become AGGRESSIVE (hostile) - unless player is hiding
                if (distanceToPlayer < currentState.innerBubble && !playerIsHiding) {
                    this.aggressionLevel = 5; // Becomes Hostile
                    this.isFleeing = false;
                    this.fleeTimer = 0;
                    console.log('👾 Monster became HOSTILE - player entered inner bubble');
                }
                // Outer bubble: FLEE away from player
                else if (distanceToPlayer >= currentState.innerBubble && distanceToPlayer < currentState.outerBubble) {
                    if (!this.isFleeing) {
                        // Start fleeing
                        this.isFleeing = true;
                        this.fleeTimer = now;
                        this.speed = currentState.speed * 1.5;
                        console.log('👾 Monster fleeing - player entered outer bubble');
                    } else {
                        // Check if we've been fleeing for more than 8 seconds
                        if (now - this.fleeTimer > 8000) {
                            // Player stayed in outer bubble for 8+ seconds - become BOLD
                            this.aggressionLevel = 4; // Becomes Bold
                            this.isFleeing = false;
                            this.path = [];
                            console.log('👾 Monster became BOLD after fleeing for 8 seconds');
                        }
                    }

                    // Recalculate flee path if needed
                    if (this.isFleeing && now - this.lastPathRecalculation > this.recalculationInterval) {
                        this.recalculateFleeToOutsideBubble(currentState.outerBubble);
                    }
                }
                // Outside both bubbles: Approach to just outside outer bubble and watch
                else {
                    if (this.isFleeing) {
                        // Player left the outer bubble - stop fleeing
                        this.isFleeing = false;
                        this.fleeTimer = 0;
                        console.log('👾 Monster stopped fleeing - player left outer bubble');
                    }

                    // Pathfind to position just outside outer bubble
                    if (now - this.lastPathRecalculation > this.recalculationInterval) {
                        this.recalculateApproachToOutsideBubble(currentState.outerBubble);
                    }
                }
                this.followPath(delta);
                break;
            case 4: // Bold
                const boldDistanceToPlayer = distanceToPlayer;
                if (boldDistanceToPlayer < 1.5 && !playerIsHiding) {
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
                } else {
                    this.directPursuit = false;
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
        // Don't interrupt attack animation
        if (this.isAttacking && this.activeAnimation === 'attack') {
            return;
        }

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

    startAttack() {
        if (this.isAttacking) return; // Already attacking

        this.isAttacking = true;
        this.attackStartTime = Date.now();
        this.path = []; // Stop moving
        this.directPursuit = false;

        // Look at player before starting attack
        const lookTarget = this.player.position.clone();
        lookTarget.y = this.monster.position.y;
        this.monster.lookAt(lookTarget);

        // Save current position and quaternion AFTER looking at player
        this.savedPosition = this.monster.position.clone();
        this.savedQuaternion = this.monster.quaternion.clone();

        console.log('🗡️ Monster attacking player!');
        console.log(`   Locked position: (${this.savedPosition.x.toFixed(2)}, ${this.savedPosition.y.toFixed(2)}, ${this.savedPosition.z.toFixed(2)})`);

        // Register hit immediately when attack animation starts
        if (window.gameControls && window.gameControls.gameManager) {
            window.gameControls.gameManager.registerMonsterHit(this.aggressionLevel);
        }

        // Play attack sound
        if (this.audioManager) {
            try {
                this.audioManager.playSound('monster_attack', 'public/audio/sfx/monster-attack.mp3');
            } catch (error) {
                console.warn('⚠️ Could not play monster attack sound:', error.message);
            }
        }

        // Play attack animation
        if (this.activeAnimation && this.animations[this.activeAnimation]) {
            this.animations[this.activeAnimation].stop();
        }

        if (this.animations['attack']) {
            console.log('✅ Playing attack animation');
            this.animations['attack'].reset();
            this.animations['attack'].play();
            this.activeAnimation = 'attack';
        } else {
            console.warn('❌ Attack animation not found! Available animations:', Object.keys(this.animations));
        }
    }

    isAttackComplete() {
        return this.isAttacking && (Date.now() - this.attackStartTime >= this.ATTACK_DURATION);
    }

    resetAttack() {
        console.log('🔄 Resetting attack - monster can move again');
        this.isAttacking = false;
        this.attackStartTime = 0;
        this.savedPosition = null;
        this.savedQuaternion = null;

        // Stop attack animation
        if (this.animations['attack']) {
            this.animations['attack'].stop();
        }
        this.activeAnimation = null;
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
        // Safety check - if no pathfinding data (office stage), skip pathfinding
        if (!this.pathfinding || !this.pathfinding.zones || !this.pathfinding.zones[this.ZONE]) {
            this.path = [];
            return;
        }

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
        // Safety check - if no pathfinding data (office stage), skip pathfinding
        if (!this.pathfinding || !this.pathfinding.zones || !this.pathfinding.zones[this.ZONE]) {
            this.path = [];
            return;
        }

        this.lastPathRecalculation = Date.now();
        const fleeDirection = this.monster.position.clone().sub(this.player.position).normalize();
        const fleeDistance = 10;
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

    recalculateFleeToOutsideBubble(bubbleRadius) {
        // Safety check - if no pathfinding data (office stage), skip pathfinding
        if (!this.pathfinding || !this.pathfinding.zones || !this.pathfinding.zones[this.ZONE]) {
            this.path = [];
            return;
        }

        this.lastPathRecalculation = Date.now();

        // Calculate direction away from player
        const fleeDirection = this.monster.position.clone().sub(this.player.position).normalize();

        // Target position is just outside the outer bubble (add 2 units buffer)
        const targetDistance = bubbleRadius + 2;
        const targetPoint = this.player.position.clone().add(fleeDirection.multiplyScalar(targetDistance));

        const groupID = this.pathfinding.getGroup(this.ZONE, this.monster.position, true);
        const closestFleeNode = this.pathfinding.getClosestNode(targetPoint, this.ZONE, groupID);
        const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, groupID);

        if (closestFleeNode && closestMonsterNode) {
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, closestFleeNode.centroid, this.ZONE, groupID);
            if (path && path.length > 0) {
                this.path = path;
            } else {
                this.path = [];
            }
        } else {
            this.path = [];
        }
    }

    recalculateApproachToOutsideBubble(bubbleRadius) {
        // Safety check - if no pathfinding data (office stage), skip pathfinding
        if (!this.pathfinding || !this.pathfinding.zones || !this.pathfinding.zones[this.ZONE]) {
            this.path = [];
            return;
        }

        this.lastPathRecalculation = Date.now();

        // Calculate direction toward player
        const approachDirection = this.player.position.clone().sub(this.monster.position).normalize();

        // Target position is just outside the outer bubble (subtract 1 unit buffer to stay outside)
        const targetDistance = bubbleRadius + 1;
        const targetPoint = this.player.position.clone().sub(approachDirection.multiplyScalar(targetDistance));

        const groupID = this.pathfinding.getGroup(this.ZONE, this.monster.position, true);
        const closestTargetNode = this.pathfinding.getClosestNode(targetPoint, this.ZONE, groupID);
        const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, groupID);

        if (closestTargetNode && closestMonsterNode) {
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, closestTargetNode.centroid, this.ZONE, groupID);
            if (path && path.length > 0) {
                this.path = path;
            } else {
                this.path = [];
            }
        } else {
            this.path = [];
        }
    }

    findHidingSpot() {
        // Skip if pathfinding is not available
        if (!this.pathfinding || !this.pathfinding.zones[this.ZONE]) {
            return;
        }

        this.lastPathRecalculation = Date.now();
        const now = Date.now();
        const groupID = this.pathfinding.getGroup(this.ZONE, this.monster.position, true);

        // Performance: Use cached hiding spots if available and fresh
        if (this.cachedHidingSpots && (now - this.lastHidingSpotCacheTime < this.hidingSpotCacheDuration)) {
            // Pick a random cached spot
            const randomSpot = this.cachedHidingSpots[Math.floor(Math.random() * this.cachedHidingSpots.length)];
            const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, groupID);
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, randomSpot, this.ZONE, groupID);
            if (path) {
                this.path = path;
                // this.visualizePath(); // Commented out - causing bugs
            }
            return;
        }

        // Recalculate hiding spots (expensive operation)
        const allNodes = this.pathfinding.zones[this.ZONE].groups[groupID];
        const validHidingSpots = [];

        const directionToPlayerFromMonster = this.player.position.clone().sub(this.monster.position).normalize();

        // Performance: Limit how many nodes we check per recalculation
        const maxNodesToCheck = Math.min(allNodes.length, 50); // Only check first 50 nodes
        const stepSize = Math.max(1, Math.floor(allNodes.length / maxNodesToCheck));

        for (let i = 0; i < allNodes.length; i += stepSize) {
            const node = allNodes[i];
            const spot = node.centroid;
            const distanceToMonster = this.monster.position.distanceTo(spot);

            // Filter 1: Reasonable distance
            if (distanceToMonster > 3 && distanceToMonster < 20) {
                const directionToSpot = spot.clone().sub(this.monster.position).normalize();
                const pathDot = directionToPlayerFromMonster.dot(directionToSpot);

                // Filter 2: Must move generally away from the player
                if (pathDot < 0.3) {
                    // The #1 priority is that the player cannot see the spot
                    if (!this.isSpotVisibleToPlayer(spot)) {
                        validHidingSpots.push(spot);

                        // Performance: Early exit once we have enough good spots
                        if (validHidingSpots.length >= 10) {
                            break;
                        }
                    }
                }
            }
        }

        // Cache the results
        if (validHidingSpots.length > 0) {
            this.cachedHidingSpots = validHidingSpots;
            this.lastHidingSpotCacheTime = now;

            // Pick the first one (they're all good)
            const bestSpot = validHidingSpots[0];
            const closestMonsterNode = this.pathfinding.getClosestNode(this.monster.position, this.ZONE, groupID);
            const path = this.pathfinding.findPath(closestMonsterNode.centroid, bestSpot, this.ZONE, groupID);
            if (path) {
                this.path = path;
                // this.visualizePath(); // Commented out - causing bugs
            }
        }
    }

    tick(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }

        this.update(delta);

        // FINAL LOCK - Force position and rotation after EVERYTHING else
        // This is the absolute last thing that happens, overriding anything the animation or AI did
        if (this.isAttacking && this.savedPosition && this.savedQuaternion) {
            // Force exact position using set() for each component
            this.monster.position.x = this.savedPosition.x;
            this.monster.position.y = this.savedPosition.y;
            this.monster.position.z = this.savedPosition.z;
            this.monster.quaternion.copy(this.savedQuaternion);
            this.monster.scale.set(0.35, 0.35, 0.35); // Force scale to stay constant
        }
    }
}
//this is the monsterAI

export { MonsterAI };