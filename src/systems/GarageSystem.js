// src/systems/GarageSystem.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

export class GarageSystem {
    constructor(interactionSystem, qteManager, audioManager, gameManager, stageManager, mansionLoader, physicsManager) {
        this.interactionSystem = interactionSystem;
        this.qteManager = qteManager;
        this.audioManager = audioManager;
        this.gameManager = gameManager;
        this.stageManager = stageManager;
        this.mansionLoader = mansionLoader;
        this.physicsManager = physicsManager;

        // References to the Door to the garage(group of objects), the door pivot, and 2 wooken planks
        this.garageDoor = null;
        this.doorPivot = null;
        this.plank1 = null;
        this.plank2 = null;

        this.plank1Placed = false;
        this.plank2Placed = false;
        this.barricadeSequenceActive = false;
        this.isAnimatingPlank = false;

        // Garage gate lifting system
        this.garageGate = null;
        this.garageSwitch = null; // The switch object used to lift the gate
        this.isGateLiftActive = false;
        this.isEKeyHeld = false;
        this.gateStartY = null;
        this.gateMaxLift = 2; // How far the gate can lift in units
        this.gateLiftSpeed = 0.8; // Units per second
        this.gateCurrentLift = 0;
        this.gateFullyLifted = false;
        this.wallHider = null;

        // Outside boundary detection (line-crossing method)
        this.outsideBoundaryLine = {
            pointA: { x: 15.77, z: 10.42 },
            pointB: { x: 9.74, z: 10.57 }
        };
        this.isCurrentlyOutside = false; // Track if player is currently outside
        this.outsideTimer = 0; // Timer for how long player has been outside
        this.maxOutsideTime = 6.0; // Max time in seconds before death
        this.boundaryLineVisual = null; // Visual representation of the boundary line
        this.vignetteOverlay = null; // Dark vignette overlay for time warning
        this.vignetteShown = false; // Track if vignette has been shown (for one-time log)

        // Movement speed slowdown settings
        this.originalWalkSpeed = null; // Store original walk speed
        this.originalRunSpeed = null; // Store original run speed
        this.speedSlowdownRate = 0.15; // Speed reduction per second (15% per second)

        // Switch rotation settings
        this.switchStartRotation = null; // Store initial rotation
        this.switchTargetRotationX = THREE.MathUtils.degToRad(-45); // Rotate down 45 degrees
        this.switchMaxRotation = THREE.MathUtils.degToRad(-45); // Max rotation when gate is fully lifted 

        // Target positions and rotaions of planks relative to the door pivot
        this.plank1Target = {
            position: new THREE.Vector3(-0.54, 1.6, -0.2), 
            rotation: new THREE.Euler(0, 0, Math.PI / 3),
        };

        this.plank2Target = {
            position: new THREE.Vector3(-0.47, 1.2, -0.2),
            rotation: new THREE.Euler(0, 0, -Math.PI / 3), 
        };

        // Register the garage gate handler early (will be used when switch becomes active)
        if (this.interactionSystem.interactionTypes['garage_gate']) {
            this.interactionSystem.interactionTypes['garage_gate'].handler = this.handleGateInteraction.bind(this);
        }

        logger.log('🚪 GarageSystem initialized');
    }

    /**
     * Called from InteractionSystem when the garage door is first opened.
     * Finds the planks and makes them interactable.
     */
    activateBarricadeSequence() {
        if (this.barricadeSequenceActive) return;

        logger.log('🚪 Activating Barricade Sequence...');
        this.barricadeSequenceActive = true;

        // Find the door and pivot objects (ensure they exist)
        this.garageDoor = this.stageManager.currentScene.getObjectByName('S_Door002');

        if (this.garageDoor) {
            this.doorPivot = this.garageDoor.parent; // pivot is parent of door

            if (!this.doorPivot || !this.doorPivot.name.includes('S_Door_Pivot')) {
                logger.error('GarageSystem: Could not find door pivot for reference.');

                this.doorPivot = this.garageDoor; // Fallback to door itself if pivot not found
            }
        } 
        else{
            logger.error('GarageSystem: Cannot activate sequence, S_Door002 not found.');
            this.barricadeSequenceActive = false;

            return;
        }


        // Find the planks
        this.plank1 = this.stageManager.currentScene.getObjectByName('wooden_plank');
        this.plank2 = this.stageManager.currentScene.getObjectByName('wooden_plank2'); 

        let planksFound = 0;
        if (this.plank1) {
            this.plank1.userData = { 
                interactable: true,
                type: 'barricade_plank',
                plankId: 1 
            };

            planksFound++;
            logger.log(`   Found plank 1: ${this.plank1.name}`);
        } 
        else {
            logger.warn('   Could not find plank 1 (wooden_plank)');
        }

        if (this.plank2){
            this.plank2.userData = { 
                interactable: true,
                type: 'barricade_plank',
                plankId: 2 
            };
            planksFound++;
            logger.log(`   Found plank 2: ${this.plank2.name}`);
        } 
        else{
            logger.warn('   Could not find plank 2 (wooden_plank2)');
        }

        if (planksFound > 0) {
            // Register the handler with InteractionSystem
            if (this.interactionSystem.interactionTypes['barricade_plank']){
                this.interactionSystem.interactionTypes['barricade_plank'].handler = this.handlePlankInteraction.bind(this);

                logger.log('   Registered plank interaction handler.');
            } 
            else {
                logger.error('   Interaction type "barricade_plank" not defined in InteractionSystem.');
            }
        } 
        else{
            logger.error('   No planks found. Barricade sequence cannot proceed.');
            this.barricadeSequenceActive = false;
        }
    }

    // Interaction handler for planks
    handlePlankInteraction(interactedObject, userData) {

        // Door must be closed in order to interact with the planks
        if(this.garageDoor && this.garageDoor.userData.isOpen){
            logger.log('Plank interaction blocked: Garage door is open.');
            this.interactionSystem.showMessage("Need to close the door first.", 2000); 

            return; // Stop the interaction        
        }

        if (!this.barricadeSequenceActive || this.isAnimatingPlank || this.qteManager.isActive()) {
            logger.log('Ignoring plank interaction (sequence inactive, animating, or QTE active).');
            return;
        }

        const plankId = userData.plankId;
        const isPlank1 = plankId === 1;
        const isAlreadyPlaced = isPlank1 ? this.plank1Placed : this.plank2Placed;

        if (isAlreadyPlaced) {
            return;
        }

        logger.log(`Attempting to place plank ${plankId}... Starting QTE.`);

        // Disable interaction temporarily to prevent double triggers
        interactedObject.userData.interactable = false;

        // Trigger button mash QTE
        this.qteManager.startQTE('buttonMash', {
            key: 'KeyE', 
            duration: 5000, 
            requiredPresses: 15, 
            onSuccess: () => this.onPlankQteSuccess(interactedObject, plankId),
            onFailure: () => this.onPlankQteFailure(interactedObject),
        });
    }

    // Plank pickup Successfull QTE
    async onPlankQteSuccess(plankObject, plankId) {
        logger.log(`✅ QTE Success for plank ${plankId}!`);
        this.isAnimatingPlank = true; 

        if (plankId === 1) {
            this.plank1Placed = true;
        } 
        else{
            this.plank2Placed = true;
        }

        // Keep interaction disabled permanently for this plank
        plankObject.userData.interactable = false;

        //this.audioManager.playSound('plank_place', 'public/audio/sfx/wood-block.mp3'); // ToDO: audio for placing a plank

        // Animate the plank to its target position on door
        const target = (plankId === 1) ? this.plank1Target : this.plank2Target;
        this.animatePlankPlacement(plankObject, target, () => {
            this.isAnimatingPlank = false; // Clear animation flag when done

            logger.log(`   Plank ${plankId} animation finished.`);
            this.audioManager.playSound('plank_place', 'public/audio/sfx/wood-block.mp3'); // ToDO: audio for placing a plank
            this.checkBarricadeCompletion(); // check if we have barricaded the door
        });
    }

    // plank pickup fail QTE
    async onPlankQteFailure(plankObject) { 
        logger.log(`❌ QTE Failure for plank ${plankObject.userData.plankId}. Triggering death sequence.`);

        if (window.gameControls && window.gameControls.narrativeManager) {
            await window.gameControls.narrativeManager.triggerEvent("stage3.barricaded_door_fail"); // failure screen, player dies
        } 
        else {
            logger.error("NarrativeManager not found, cannot trigger barricade failure event!");
            this.gameManager.onGameLost("You weren't fast enough to barricade the door...");
        }

    }

    // Animate plank moving from floor to the final location
    animatePlankPlacement(plankObject, target, onComplete) {
        const duration = 1500; // Duration of animation
        const startTime = performance.now();

        const startPosition = plankObject.position.clone();
        const startQuaternion = plankObject.quaternion.clone();

        // === Calculate positions and rotations relative to world coords ===
        const helper = new THREE.Object3D(); // helper
        
        // local position and rotations
        helper.position.copy(target.position);
        helper.rotation.copy(target.rotation);
       
        // helper is a child of the pivot
        this.doorPivot.add(helper);

        // get helpers world position and quaternion
        const worldTargetPosition = new THREE.Vector3();
        const worldTargetQuaternion = new THREE.Quaternion();
        helper.getWorldPosition(worldTargetPosition);
        helper.getWorldQuaternion(worldTargetQuaternion);
   
        // remove helper from pivot
        this.doorPivot.remove(helper);

        // re-parenting
        const originalParent = plankObject.parent;
        
        const currentWorldPos = new THREE.Vector3();
        const currentWorldQuat = new THREE.Quaternion();
        plankObject.getWorldPosition(currentWorldPos);
        plankObject.getWorldQuaternion(currentWorldQuat);
        
        // Add to scene and set world transform
        this.stageManager.currentScene.add(plankObject);
        plankObject.position.copy(currentWorldPos);
        plankObject.quaternion.copy(currentWorldQuat);

        logger.log(`   Animating plank ${plankObject.userData.plankId} to world pos: ${worldTargetPosition.x.toFixed(2)}, ${worldTargetPosition.y.toFixed(2)}, ${worldTargetPosition.z.toFixed(2)}`);

        const animate = () => {
            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for a nice slowing down effect
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            // Interpolate position directly in world space
            plankObject.position.lerpVectors(currentWorldPos, worldTargetPosition, easedProgress);

            // Interpolate rotation using Quaternion slerp for smooth rotation
            plankObject.quaternion.copy(currentWorldQuat).slerp(worldTargetQuaternion, easedProgress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
            else {
                // Snap to final world position/rotation
                plankObject.position.copy(worldTargetPosition);
                plankObject.quaternion.copy(worldTargetQuaternion);


                this.doorPivot.attach(plankObject);
                logger.log(`   Re-parented plank ${plankObject.userData.plankId} to door pivot.`);

                if (onComplete) onComplete();
            }
        };

        requestAnimationFrame(animate);
    }


    // Check both plaks are placed for barricade sequence completion
    async checkBarricadeCompletion() {
        if (this.plank1Placed && this.plank2Placed) {
            logger.log('🚪✅ Barricade Complete!');
            this.barricadeSequenceActive = false;

            // Update the door's state
            if (this.garageDoor && this.garageDoor.userData) {
                this.garageDoor.userData.barricaded = true;
                this.garageDoor.userData.interactable = false;


                if (this.interactionSystem.interactionTypes.garage_door) {
                    this.interactionSystem.interactionTypes.garage_door.prompt = "Barricaded";
                }
            }

            // Complete the objective
            this.gameManager.completeObjective('barricade_door');

            // Trigger narrative event for Stage 3 start
            await window.gameControls.narrativeManager.triggerEvent("stage3.barricaded_door");

            // Despawn the monster after barricade is complete (keeps heartbeat playing)
            if (window.gameControls && window.gameControls.monsterAI) {
                logger.log('👾 Despawning monster after barricade - player is safe behind the door');
                window.gameControls.monsterAI.despawn();
            }

            // Activate the garage gate lifting sequence
            this.activateGateLifting();

            // TODO: Potentially trigger monster behavior change - trying to break door, and sounds
        }
    }

    /**
     * Activates the garage gate lifting sequence after barricade is complete.
     * Player must hold E while looking at the Garage_switch to lift the gate.
     */
    activateGateLifting() {
        if (this.isGateLiftActive) return;

        logger.log('🚪 Activating Garage Gate Lifting Sequence...');
        this.isGateLiftActive = true;

        // Find the garage switch and make it interactable
        const garageSwitch = this.stageManager.currentScene.getObjectByName('Garage_switch');
        if (garageSwitch) {
            garageSwitch.userData = {
                ...garageSwitch.userData,
                        interactable: true,
                        type: 'garage_gate',
                    };
            this.garageSwitch = garageSwitch;
            // Store the switch's initial rotation
            this.switchStartRotation = {
                x: garageSwitch.rotation.x,
                y: garageSwitch.rotation.y,
                z: garageSwitch.rotation.z
            };
            logger.log(`   ✓ Found and activated Garage_switch for interaction`);
        } else {
            logger.error('   ❌ Garage_switch not found in scene!');
            this.isGateLiftActive = false;
            return;
                    }

        // Find the specific garage gate object: gateslp_garage_0
        this.garageGate = this.stageManager.currentScene.getObjectByName('gateslp_garage_0');

        if (this.garageGate) {
            // Store initial Y position for the gate and all its children
            this.garageGate.traverse((child) => {
                if (child.isMesh || child.isGroup) {
                    if (!child.userData) child.userData = {};
                    child.userData.gateStartY = child.position.y;
                }
            });
                this.gateStartY = this.garageGate.position.y;
            logger.log(`   ✓ Found garage gate: ${this.garageGate.name} (Y: ${this.gateStartY})`);
            } else {
            logger.error('   ❌ gateslp_garage_0 not found in scene!');
                this.isGateLiftActive = false;
                return;
            }

        // Register the interaction handler
        if (!this.interactionSystem.interactionTypes['garage_gate']) {
            this.interactionSystem.interactionTypes['garage_gate'] = {
                prompt: "Hold E to lift the garage door",
                handler: this.handleGateInteraction.bind(this)
            };
        } else {
            this.interactionSystem.interactionTypes['garage_gate'].handler = this.handleGateInteraction.bind(this);
            this.interactionSystem.interactionTypes['garage_gate'].prompt = "Hold E to lift the garage door";
        }

        // Find S_Wall_hider for later physics removal
        this.wallHider = this.stageManager.currentScene.getObjectByName('S_Wall_hider');
        if (this.wallHider) {
            logger.log('   Found S_Wall_hider for physics removal');
        } else {
            logger.warn('   S_Wall_hider not found');
        }

        // Trigger the objective through narrative manager for proper UI display
        logger.log('   Triggering objective: lift_garage_door');
        if (window.gameControls && window.gameControls.narrativeManager) {
            window.gameControls.narrativeManager.triggerEvent("stage3.lift_garage_door");
        }

        // Create progress bar UI
        this.createProgressBar();

        logger.log('   Garage gate lifting sequence activated!');
    }

    /**
     * Creates a progress bar UI element for showing gate lift progress
     */
    createProgressBar() {
        // Create progress bar container
        this.progressBarContainer = document.createElement('div');
        this.progressBarContainer.style.cssText = `
            position: fixed;
            bottom: 30%;
            left: 50%;
            transform: translateX(-50%);
            width: 300px;
            background: rgba(0,0,0,0.8);
            border: 2px solid #666;
            border-radius: 5px;
            padding: 10px;
            display: none;
            pointer-events: none;
            z-index: 999;
        `;

        // Progress bar label
        const label = document.createElement('div');
        label.textContent = 'Lifting Garage Door...';
        label.style.cssText = `
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            text-align: center;
            margin-bottom: 8px;
        `;
        this.progressBarContainer.appendChild(label);

        // Progress bar background
        const barBg = document.createElement('div');
        barBg.style.cssText = `
            width: 100%;
            height: 20px;
            background: rgba(50,50,50,0.8);
            border: 1px solid #444;
            border-radius: 3px;
            overflow: hidden;
        `;

        // Progress bar fill
        this.progressBarFill = document.createElement('div');
        this.progressBarFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #8BC34A);
            transition: width 0.1s linear;
        `;
        barBg.appendChild(this.progressBarFill);

        this.progressBarContainer.appendChild(barBg);
        document.body.appendChild(this.progressBarContainer);

        logger.log('   Progress bar UI created');
    }

    /**
     * Handler for when player interacts with the garage gate.
     * This starts the lifting process when E is held.
     */
    handleGateInteraction(interactedObject, userData) {
        if (!this.isGateLiftActive || this.gateFullyLifted) {
            return;
        }

        // The actual lifting happens in the tick() method when E is held
        // This is just to acknowledge the first interaction
        if (this.gateCurrentLift === 0) {
            logger.log('🚪 Starting to lift garage gate...');
            this.interactionSystem.showMessage("Hold E to lift the door...", 2000);
        }
    }

    /**
     * Called every frame to update gate lifting if E is held.
     * Player must look at Garage_switch to lift the gate.
     * Also checks if player has crossed the boundary line to go outside.
     */
    tick(delta) {
        // Check if player has crossed the boundary line to go outside (only after gate is fully lifted)
        // BUT NOT if player is in the car driving
        if (this.gateFullyLifted) {
            // Check if player is in car - if so, don't trigger death/slowdown
            const carRepairSystem = window.gameControls?.carRepairSystem;
            const playerInCar = carRepairSystem?.repairState?.playerInCar || false;

            if (!playerInCar) {
                this.checkPlayerCrossedBoundary(delta);
            }
        }

        // If gate isn't active yet or is already fully lifted, don't run gate lifting logic
        if (!this.isGateLiftActive || this.gateFullyLifted || !this.garageGate) {
            return;
        }

        // Check if player is looking at the garage switch
        const highlightedObj = this.interactionSystem.highlightedObject;
        if (!highlightedObj) {
            // Hide progress bar if not looking at switch
            if (this.progressBarContainer) {
                this.progressBarContainer.style.display = 'none';
            }
            return;
        }

        // Check if looking at the garage switch
        const isLookingAtSwitch = highlightedObj === this.garageSwitch;

        if (!isLookingAtSwitch) {
            // Hide progress bar if not looking at switch
            if (this.progressBarContainer) {
                this.progressBarContainer.style.display = 'none';
            }
            return;
        }

        // Show progress bar when looking at the switch
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'block';
        }

        // Check if E key is held (we'll sync with InteractionSystem)
        if (!this.interactionSystem.isEKeyHeld) {
            // Update progress bar but don't lift
            this.updateProgressBar();
            return;
        }

        // Lift the gate gradually
        const liftAmount = this.gateLiftSpeed * delta;
        this.gateCurrentLift += liftAmount;

        // Calculate progress (0 to 1)
        const progress = Math.min(this.gateCurrentLift / this.gateMaxLift, 1);

        if (this.gateCurrentLift >= this.gateMaxLift) {
            // Gate is fully lifted
            this.gateCurrentLift = this.gateMaxLift;
            this.gateFullyLifted = true;

            // Move the specific garage gate to final position
            this.garageGate.traverse((child) => {
                if ((child.isMesh || child.isGroup) && child.userData.gateStartY !== undefined) {
                    child.position.y = child.userData.gateStartY - this.gateMaxLift;
                }
            });

            // Set switch to final rotation (rotated down)
            if (this.garageSwitch && this.switchStartRotation) {
                this.garageSwitch.rotation.x = this.switchStartRotation.x + this.switchMaxRotation;
            }

            logger.log('🚪✅ Garage gate fully lifted!');
            logger.log('   🔍 Boundary detection will now run every second');
            this.onGateFullyLifted();
        } else {
            // Continue lifting - move the specific garage gate
            this.garageGate.traverse((child) => {
                if ((child.isMesh || child.isGroup) && child.userData.gateStartY !== undefined) {
                    child.position.y = child.userData.gateStartY - this.gateCurrentLift;
                }
            });

            // Rotate the switch down based on progress
            if (this.garageSwitch && this.switchStartRotation) {
                this.garageSwitch.rotation.x = this.switchStartRotation.x + (this.switchMaxRotation * progress);
            }
        }

        // Update progress bar
        this.updateProgressBar();
    }

    /**
     * Updates the progress bar fill based on current lift progress
     */
    updateProgressBar() {
        if (!this.progressBarFill) return;

        const percentage = Math.min(100, (this.gateCurrentLift / this.gateMaxLift) * 100);
        this.progressBarFill.style.width = `${percentage}%`;
    }

    /**
     * Checks if the player has crossed the boundary line to go outside.
     * Uses line-crossing detection with the boundary from (15.77, 10.42) to (9.74, 10.57).
     * Player is considered "outside" if they cross to the far side of this line.
     * If player stays outside for 2 seconds, they die.
     */
    checkPlayerCrossedBoundary(delta) {
        // Check if physicsManager and playerBody exist
        if (!this.physicsManager || !this.physicsManager.playerBody) {
            return;
        }

        // Get player position from playerBody.translation() (Rapier API)
        const playerPos = this.physicsManager.playerBody.translation();
        if (!playerPos) {
            return;
        }

        // Get boundary line points
        const A = this.outsideBoundaryLine.pointA;
        const B = this.outsideBoundaryLine.pointB;
        const P = { x: playerPos.x, z: playerPos.z };

        // Check if player is within the boundary detection zone (near the visible line)
        const minX = Math.min(A.x, B.x);
        const maxX = Math.max(A.x, B.x);
        const minZ = Math.min(A.z, B.z);
        const maxZ = Math.max(A.z, B.z);

        // Calculate cross product to determine which side of the line the player is on
        // Cross product formula: (B - A) × (P - A)
        // In 2D: cross = (B.x - A.x) * (P.z - A.z) - (B.z - A.z) * (P.x - A.x)
        const cross = (B.x - A.x) * (P.z - A.z) - (B.z - A.z) * (P.x - A.x);

        // Check if player is outside (negative cross product = z > 11)
        const isOutside = cross < 0;

        // Detect crossing from inside to outside
        if ((isOutside && !this.isCurrentlyOutside) && !(P.x < minX || P.x > maxX || P.z < minZ || P.z > maxZ)) {
            this.isCurrentlyOutside = true;
            this.outsideTimer = 0;

            // Store original speeds if not already stored
            if (this.originalWalkSpeed === null && this.physicsManager.maxSpeed) {
                this.originalWalkSpeed = this.physicsManager.maxSpeed.walk;
                this.originalRunSpeed = this.physicsManager.maxSpeed.run;
                logger.log(`   Stored original speeds: walk=${this.originalWalkSpeed}, run=${this.originalRunSpeed}`);
            }

            logger.log('🚪 Player crossed boundary line to OUTSIDE');
            logger.log(`   Position: (x: ${P.x.toFixed(2)}, z: ${P.z.toFixed(2)})`);
        }
        // Detect crossing from outside to inside
        else if ((!isOutside && this.isCurrentlyOutside) && !(P.x < minX || P.x > maxX || P.z < minZ || P.z > maxZ)) {
            logger.log('🏠 Player crossed boundary line back INSIDE');
            logger.log(`   Position: (x: ${P.x.toFixed(2)}, z: ${P.z.toFixed(2)})`);
            logger.log(`   Was outside for ${this.outsideTimer.toFixed(2)} seconds`);
            this.isCurrentlyOutside = false;
            this.outsideTimer = 0;
            this.updateVignetteEffect();

            // Restore original movement speeds
            this.restoreMovementSpeed();
        }

        // If player is outside, accumulate time, update vignette, and slow down movement
        if (this.isCurrentlyOutside) {
            this.outsideTimer += delta;
            this.updateVignetteEffect();
            this.slowDownMovementSpeed(delta);

            // Check if player has been outside too long
            if (this.outsideTimer >= this.maxOutsideTime && this.gateFullyLifted) {
                logger.log('💀 Player stayed outside too long - triggering death');
                this.onPlayerStayedOutsideTooLong();
            }
        }
    }

    /**
     * Creates a vignette overlay that darkens the screen from edges.
     * Similar to hit border overlay but for outside timer warning.
     */
    createVignetteOverlay() {
        this.vignetteOverlay = document.createElement('div');
        this.vignetteOverlay.id = 'outside-vignette-overlay';
        this.vignetteOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 999999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.vignetteOverlay);
        logger.log('   ✓ Created vignette overlay for outside timer warning');
    }

    /**
     * Updates the vignette effect based on how long player has been outside.
     * Follows the same pattern as hit border overlay.
     */
    updateVignetteEffect() {
        if (!this.vignetteOverlay) {
            return;
        }

        // Ensure element is in DOM - re-add if missing
        if (!document.body.contains(this.vignetteOverlay)) {
            document.body.appendChild(this.vignetteOverlay);
        }

        if (this.isCurrentlyOutside && this.outsideTimer > 0) {
            // Start showing at 2 seconds, increase intensity until 10 seconds
            const warningStartTime = 2.0;

            if (this.outsideTimer < warningStartTime) {
                // Too early, hide vignette
                this.vignetteOverlay.style.display = 'none';
                this.vignetteOverlay.style.opacity = '0';
                this.vignetteOverlay.style.boxShadow = 'none';
                this.vignetteOverlay.style.background = 'transparent';
                this.vignetteShown = false;
            } else {
                // Calculate progress from 2 to 6 seconds
                const progress = (this.outsideTimer - warningStartTime) / (this.maxOutsideTime - warningStartTime);
                const intensity = Math.min(progress, 1.0);

                // Calculate border thickness based on intensity (increased for more visibility)
                const borderThickness = 100 + (intensity * 150); // 100px to 250px
                const opacity = 0.6 + (intensity * 0.4); // 0.6 to 1.0

                // Log once when vignette first appears
                if (!this.vignetteShown) {
                    logger.log(`🌑 Vignette warning started - screen will darken as timer approaches ${this.maxOutsideTime}s`);
                    this.vignetteShown = true;
                }

                // Ensure element is visible with explicit display and high z-index
                this.vignetteOverlay.style.display = 'block';
                this.vignetteOverlay.style.zIndex = '999999';
                this.vignetteOverlay.style.opacity = '1';
                this.vignetteOverlay.style.border = 'none';

                // Use box-shadow inset for proper edge vignette effect (black instead of red)
                // Creates a black glow that fades from edges toward center
                this.vignetteOverlay.style.boxShadow = `
                    inset 0 0 ${borderThickness}px ${borderThickness * 0.4}px rgba(0, 0, 0, ${opacity}),
                    inset 0 0 ${borderThickness * 2}px ${borderThickness * 0.6}px rgba(0, 0, 0, ${opacity * 0.8}),
                    inset 0 0 ${borderThickness * 3}px ${borderThickness * 0.8}px rgba(0, 0, 0, ${opacity * 0.6})
                `;

                // Add a stronger black vignette to entire screen
                this.vignetteOverlay.style.background = `radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, ${opacity * 0.6}) 100%)`;
            }
        } else {
            // Player is inside, hide vignette
            this.vignetteOverlay.style.display = 'none';
            this.vignetteOverlay.style.opacity = '0';
            this.vignetteOverlay.style.border = 'none';
            this.vignetteOverlay.style.boxShadow = 'none';
            this.vignetteOverlay.style.background = 'transparent';
            this.vignetteShown = false;
        }
    }

    /**
     * Gradually slows down player movement speed based on time spent outside.
     * Speed decreases by speedSlowdownRate (15%) per second.
     * Minimum speed is 30% of original speed.
     */
    slowDownMovementSpeed(delta) {
        if (!this.physicsManager || !this.physicsManager.maxSpeed || this.originalWalkSpeed === null) return;

        // Calculate slowdown multiplier based on time outside
        // Formula: 1.0 - (speedSlowdownRate * outsideTimer)
        // Clamp to minimum of 0.3 (30% of original speed)
        const slowdownMultiplier = Math.max(0.3, 1.0 - (this.speedSlowdownRate * this.outsideTimer));

        // Apply slowdown to both walk and run speeds
        this.physicsManager.maxSpeed.walk = this.originalWalkSpeed * slowdownMultiplier;
        this.physicsManager.maxSpeed.run = this.originalRunSpeed * slowdownMultiplier;

        // Log occasionally for debugging (every 1 second)
        if (Math.floor(this.outsideTimer) !== Math.floor(this.outsideTimer - delta)) {
            logger.log(`🐌 Movement speed slowed to ${(slowdownMultiplier * 100).toFixed(0)}% (walk: ${this.physicsManager.maxSpeed.walk.toFixed(2)}, run: ${this.physicsManager.maxSpeed.run.toFixed(2)})`);
        }
    }

    /**
     * Restores player movement speed to original values when coming back inside.
     */
    restoreMovementSpeed() {
        if (!this.physicsManager || !this.physicsManager.maxSpeed || this.originalWalkSpeed === null) return;

        this.physicsManager.maxSpeed.walk = this.originalWalkSpeed;
        this.physicsManager.maxSpeed.run = this.originalRunSpeed;

        logger.log(`✅ Movement speed restored (walk: ${this.physicsManager.maxSpeed.walk.toFixed(2)}, run: ${this.physicsManager.maxSpeed.run.toFixed(2)})`);
    }

    /**
     * Called when the player stays outside the boundary for too long.
     * Plays monster attack sound and triggers death sequence via narrative manager.
     */
    async onPlayerStayedOutsideTooLong() {
        // Prevent multiple death triggers
        if (this.gateFullyLifted === false) return; // Safety check
        this.gateFullyLifted = false; // Disable further checks

        logger.log('💀 Death sequence starting - player caught outside too long');

        // Update game state
        if (this.gameManager) {
            this.gameManager.gameState = 'lost';
        }

        // Play monster attack sound
        if (this.audioManager) {
            this.audioManager.playSound('monster_attack', 'public/audio/sfx/monster-attack.mp3');
        }

        // Trigger death event via narrative manager
        const deathEvent = 'endings.death_garage_escape';
        logger.log(`💀 Triggering death event: ${deathEvent}`);

        if (window.gameControls && window.gameControls.narrativeManager) {
            await window.gameControls.narrativeManager.triggerEvent(deathEvent);
        } else {
            logger.error('💀 NarrativeManager not found!');
            // Fallback to direct game lost
            if (this.gameManager && this.gameManager.onGameLost) {
                this.gameManager.onGameLost("I knew I wouldn't make it...");
            }
        }
    }

    /**
     * Creates a visual representation of the boundary line in the game world.
     * Shows a bright red vertical wall at the boundary to help visualize when player crosses.
     */
    createBoundaryLineVisual() {
        if (!this.stageManager || !this.stageManager.currentScene) {
            logger.warn('Cannot create boundary line visual - no scene available');
            return;
        }

        const A = this.outsideBoundaryLine.pointA;
        const B = this.outsideBoundaryLine.pointB;

        // Calculate the length and angle of the boundary line
        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);

        // Create a vertical plane geometry (extends from y=0 to y=10)
        const wallHeight = 10;
        const geometry = new THREE.PlaneGeometry(length, wallHeight);

        // Create a bright red semi-transparent material (double-sided so visible from both sides)
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Bright red
            opacity: 0.5,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false // Allows seeing through it
        });

        // Create the wall mesh
        this.boundaryLineVisual = new THREE.Mesh(geometry, material);
        this.boundaryLineVisual.name = 'BoundaryLineVisual';

        // Position at the midpoint between A and B
        const midX = (A.x + B.x) / 2;
        const midZ = (A.z + B.z) / 2;
        this.boundaryLineVisual.position.set(midX, wallHeight / 2, midZ);

        // Rotate to align with the boundary line (plane starts facing Z, rotate around Y axis then tilt to vertical)
        this.boundaryLineVisual.rotation.y = angle;
        this.boundaryLineVisual.rotation.x = 0; // Keep it vertical

        // Add to scene
        this.stageManager.currentScene.add(this.boundaryLineVisual);

        logger.log('   ✓ Created boundary line visualization (red vertical wall)');
        logger.log(`      From: (${A.x.toFixed(2)}, 0-10, ${A.z.toFixed(2)})`);
        logger.log(`      To: (${B.x.toFixed(2)}, 0-10, ${B.z.toFixed(2)})`);
        logger.log(`      Length: ${length.toFixed(2)}, Angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
    }

    /**
     * Called when the garage gate is fully lifted.
     * Removes S_Wall_hider physics and triggers dialogue.
     */
    async onGateFullyLifted() {
        // Hide progress bar
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'none';
        }

        // Make the garage switch non-interactable
        if (this.garageSwitch && this.garageSwitch.userData) {
            this.garageSwitch.userData.interactable = false;
        }

        // Complete the lift objective
        this.gameManager.completeObjective('lift_garage_door');

        // Remove physics from S_Wall_hider
        if (this.wallHider) {
            this.removeWallHiderPhysics();
        }

        // Create vignette warning overlay
        this.createVignetteOverlay();

        // Verify boundary detection is active
        logger.log('   ✓ Boundary line detection active - player has 6 seconds outside before death');

        // Show dialogue
        if (window.gameControls && window.gameControls.narrativeManager) {
            // Create a temporary speech bubble for the player's realization
            const speechData = {
                type: "speechBubble",
                title: "You",
                text: "I wont make it far on foot, I need to get the car working",
                duration: 4000
            };

            // Trigger the speech bubble
            await window.gameControls.narrativeManager.showSpeechBubble(
                speechData.title,
                speechData.text,
                speechData.duration
            );
        }

        // Now trigger the garage escape objective (car repair)
        await window.gameControls.narrativeManager.triggerEvent("stage3.garage_escape_objective");

        logger.log('🚗 Transitioning to car repair objective');
    }

    /**
     * Removes physics collision from S_Wall_hider so player can pass through.
     * Uses the same traverse pattern as the sofa physics recalculation code.
     */
    removeWallHiderPhysics() {
        if (!this.wallHider || !this.mansionLoader) {
            logger.warn('Cannot remove wall hider physics - missing dependencies');
            logger.warn(`  wallHider: ${!!this.wallHider}, mansionLoader: ${!!this.mansionLoader}`);
            return;
        }

        logger.log(`🔍 Removing physics for S_Wall_hider and all children...`);
        logger.log(`   S_Wall_hider name: ${this.wallHider.name}`);

        let removedCount = 0;

        // Traverse S_Wall_hider and all its children (same pattern as sofa code in InteractionSystem)
        this.wallHider.traverse((child) => {
            if (child.isMesh && child.name) {
                logger.log(`   Attempting to remove collision for child: ${child.name}`);

                // Use the existing removeCollisionForObject method (searches by name)
                this.mansionLoader.removeCollisionForObject(child.name);
                removedCount++;
            }
        });

        if (removedCount > 0) {
            logger.log(`✅ Removed physics from ${removedCount} S_Wall_hider mesh(es) - player can now pass through`);
        } else {
            logger.warn('⚠️ No child meshes found in S_Wall_hider');
        }
    }

    dispose() {
        logger.log("🧹 Disposing GarageSystem...");

        // Remove progress bar from DOM
        if (this.progressBarContainer && this.progressBarContainer.parentNode) {
            this.progressBarContainer.parentNode.removeChild(this.progressBarContainer);
        }

        // Remove vignette overlay from DOM
        if (this.vignetteOverlay && this.vignetteOverlay.parentNode) {
            this.vignetteOverlay.parentNode.removeChild(this.vignetteOverlay);
        }

        // Remove boundary line visual from scene
        if (this.boundaryLineVisual && this.stageManager && this.stageManager.currentScene) {
            this.stageManager.currentScene.remove(this.boundaryLineVisual);
            this.boundaryLineVisual.geometry.dispose();
            this.boundaryLineVisual.material.dispose();
        }

        // Clean up references
        this.garageDoor = null;
        this.doorPivot = null;
        this.plank1 = null;
        this.plank2 = null;
        this.garageGate = null;
        this.garageSwitch = null;
        this.switchStartRotation = null;
        this.wallHider = null;
        this.outsideBoundaryLine = null;
        this.boundaryLineVisual = null;
        this.vignetteOverlay = null;
        this.vignetteShown = false;
        this.isCurrentlyOutside = false;
        this.outsideTimer = 0;
        this.progressBarContainer = null;
        this.progressBarFill = null;
    }
}