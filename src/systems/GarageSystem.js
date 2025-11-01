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
        this.garageObjects = []; // All objects with "garage" in name or hierarchy
        this.isGateLiftActive = false;
        this.isEKeyHeld = false;
        this.gateStartY = null;
        this.gateMaxLift = 3.0; // How far the gate can lift in units
        this.gateLiftSpeed = 0.8; // Units per second
        this.gateCurrentLift = 0;
        this.gateFullyLifted = false;
        this.wallHider = null;
        this.wallHiderProxy = null; 

        // Target positions and rotaions of planks relative to the door pivot
        this.plank1Target = {
            position: new THREE.Vector3(-0.54, 1.6, -0.2), 
            rotation: new THREE.Euler(0, 0, Math.PI / 3),
        };

        this.plank2Target = {
            position: new THREE.Vector3(-0.47, 1.2, -0.2),
            rotation: new THREE.Euler(0, 0, -Math.PI / 3), 
        };

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

            // Activate the garage gate lifting sequence
            this.activateGateLifting();

            // TODO: Potentially trigger monster behavior change - trying to break door, and sounds
        }
    }

    /**
     * Activates the garage gate lifting sequence after barricade is complete.
     * Player must hold E while looking at the garage gate to lift it.
     */
    activateGateLifting() {
        if (this.isGateLiftActive) return;

        logger.log('🚪 Activating Garage Gate Lifting Sequence...');
        this.isGateLiftActive = true;

        // Find all objects with "garage" in their name and make them interactable
        this.garageObjects = [];
        this.stageManager.currentScene.traverse((object) => {
            if (object.isMesh || object.isGroup || object.isObject3D) {
                const lowerName = object.name.toLowerCase();

                // Check if this object or any ancestor has "garage" in the name
                let hasGarageInHierarchy = lowerName.includes('garage');

                if (!hasGarageInHierarchy) {
                    // Check ancestors
                    let parent = object.parent;
                    while (parent) {
                        if (parent.name.toLowerCase().includes('garage')) {
                            hasGarageInHierarchy = true;
                            break;
                        }
                        parent = parent.parent;
                    }
                }

                if (hasGarageInHierarchy) {
                    // Make this object interactable
                    object.userData = {
                        ...object.userData,
                        interactable: true,
                        type: 'garage_gate',
                    };

                    // Store initial Y position for this object and all children (same pattern as sofa)
                    object.traverse((child) => {
                        if (child.isMesh || child.isGroup) {
                            if (!child.userData) child.userData = {};
                            child.userData.gateStartY = child.position.y;
                        }
                    });

                    this.garageObjects.push(object);
                    logger.log(`   Made ${object.name} interactable (garage-related)`);

                    // If this looks like the main gate, store it
                    if (lowerName.includes('gate') || lowerName.includes('lp_garage')) {
                        this.garageGate = object;
                        this.gateStartY = object.position.y;
                        logger.log(`   ✓ Using ${object.name} as main garage gate (Y: ${this.gateStartY})`);
                    }
                }
            }
        });

        logger.log(`   Found ${this.garageObjects.length} garage-related objects`);

        if (!this.garageGate) {
            logger.warn('   No main garage gate identified, using first garage object');
            if (this.garageObjects.length > 0) {
                this.garageGate = this.garageObjects[0];
                this.gateStartY = this.garageGate.position.y;
            } else {
                logger.error('   No garage objects found at all!');
                this.isGateLiftActive = false;
                return;
            }
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

        // Find S_Wall_hider for later removal AND make it interactable too
        // (S_Wall_hider is in front of the gate and may block raycasts)
        this.wallHider = this.stageManager.currentScene.getObjectByName('S_Wall_hider');
        if (this.wallHider) {
            logger.log('   Found S_Wall_hider for physics removal');

            // Keep S_Wall_hider invisible but make it raycastable
            // by setting it to a special layer that the raycaster can detect
            this.wallHider.visible = false; // Keep it invisible

            // However, we need the raycaster to hit it, so we'll use a different approach:
            // Create an invisible box geometry at the same position for raycasting
            const geometry = new THREE.BoxGeometry(3, 3, 0.1); // Adjust size as needed
            const material = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                depthWrite: false
            });
            this.wallHiderProxy = new THREE.Mesh(geometry, material);

            // Copy position from S_Wall_hider
            this.wallHiderProxy.position.copy(this.wallHider.position);
            this.wallHiderProxy.rotation.copy(this.wallHider.rotation);

            // Add to scene
            this.stageManager.currentScene.add(this.wallHiderProxy);

            // Make the proxy interactable with same prompt as gate
            // This ensures player can interact even if it blocks the gate
            this.wallHiderProxy.userData = {
                interactable: true,
                type: 'garage_gate',
                isWallHider: true // Mark it so we know it's the wall hider proxy
            };
            logger.log('   Created invisible raycast proxy for S_Wall_hider (same as gate)');
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
     * Similar to sofa movement system.
     */
    tick(delta) {
        if (!this.isGateLiftActive || this.gateFullyLifted || !this.garageGate) {
            return;
        }

        // Check if player is looking at any garage-related object
        const highlightedObj = this.interactionSystem.highlightedObject;
        if (!highlightedObj) {
            // Hide progress bar if not looking at target
            if (this.progressBarContainer) {
                this.progressBarContainer.style.display = 'none';
            }
            return;
        }

        // DEBUG: Log what object we're looking at
        console.log(`👁️ Looking at: "${highlightedObj.name}" (type: ${highlightedObj.type}, children: ${highlightedObj.children?.length || 0})`);

        // Accept interaction from any garage object or the wall hider proxy
        const isLookingAtGarageObject = this.garageObjects.includes(highlightedObj);
        const isLookingAtWallHiderProxy = highlightedObj === this.wallHiderProxy;

        if (!isLookingAtGarageObject && !isLookingAtWallHiderProxy) {
            // Hide progress bar if not looking at target
            if (this.progressBarContainer) {
                this.progressBarContainer.style.display = 'none';
            }
            return;
        }

        // Show progress bar when looking at the gate
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

        if (this.gateCurrentLift >= this.gateMaxLift) {
            // Gate is fully lifted
            this.gateCurrentLift = this.gateMaxLift;
            this.gateFullyLifted = true;

            // Move all garage objects to final position (same pattern as sofa)
            this.garageObjects.forEach(garageObj => {
                garageObj.traverse((child) => {
                    if ((child.isMesh || child.isGroup) && child.userData.gateStartY !== undefined) {
                        child.position.y = child.userData.gateStartY + this.gateMaxLift;
                    }
                });
            });

            logger.log('🚪✅ Garage gate fully lifted!');
            this.onGateFullyLifted();
        } else {
            // Continue lifting - move all children of all garage objects (same pattern as sofa)
            this.garageObjects.forEach(garageObj => {
                garageObj.traverse((child) => {
                    if ((child.isMesh || child.isGroup) && child.userData.gateStartY !== undefined) {
                        child.position.y = child.userData.gateStartY + this.gateCurrentLift;
                    }
                });
            });
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
     * Called when the garage gate is fully lifted.
     * Removes S_Wall_hider physics and triggers dialogue.
     */
    async onGateFullyLifted() {
        // Hide progress bar
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'none';
        }

        // Make all garage objects non-interactable
        this.garageObjects.forEach(obj => {
            if (obj.userData) {
                obj.userData.interactable = false;
            }
        });

        if (this.wallHiderProxy) {
            this.wallHiderProxy.userData.interactable = false;
        }

        // Complete the lift objective
        this.gameManager.completeObjective('lift_garage_door');

        // Remove physics from S_Wall_hider
        if (this.wallHider) {
            this.removeWallHiderPhysics();
        }

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

        // Remove wall hider proxy from scene
        if (this.wallHiderProxy && this.stageManager && this.stageManager.currentScene) {
            this.stageManager.currentScene.remove(this.wallHiderProxy);
        }

        // Clean up references
        this.garageDoor = null;
        this.doorPivot = null;
        this.plank1 = null;
        this.plank2 = null;
        this.garageGate = null;
        this.garageObjects = [];
        this.wallHider = null;
        this.wallHiderProxy = null;
        this.progressBarContainer = null;
        this.progressBarFill = null;
    }
}