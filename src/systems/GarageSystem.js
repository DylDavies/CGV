// src/systems/GarageSystem.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

export class GarageSystem {
    constructor(interactionSystem, qteManager, audioManager, gameManager, stageManager) {
        this.interactionSystem = interactionSystem;
        this.qteManager = qteManager;
        this.audioManager = audioManager;
        this.gameManager = gameManager;
        this.stageManager = stageManager;

        // References to the Door to the garage(group of objects), the door pivot, and 2 wooken planks
        this.garageDoor = null; 
        this.doorPivot = null; 
        this.plank1 = null; 
        this.plank2 = null; 

        this.plank1Placed = false;
        this.plank2Placed = false;
        this.barricadeSequenceActive = false;
        this.isAnimatingPlank = false; 

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
            await window.gameControls.narrativeManager.triggerEvent("stage3.garage_escape_objective")

            // TODO: Potentially trigger monster behavior change - trying to break door, and sounds
        }
    }

    dispose() {
        logger.log("🧹 Disposing GarageSystem...");
        
        // Clean up references 
        this.garageDoor = null;
        this.doorPivot = null;
        this.plank1 = null;
        this.plank2 = null;
    }
}