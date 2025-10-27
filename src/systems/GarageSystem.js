// src/systems/GarageSystem.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

export class GarageSystem {
    /**
     * @param {THREE.Scene} scene - The main Three.js scene.
     * @param {InteractionSystem} interactionSystem - To register/unregister interaction handlers.
     * @param {QTEManager} qteManager - To trigger Quick Time Events.
     * @param {AudioManager} audioManager - To play sound effects.
     * @param {GameManager} gameManager - To access game state, inventory, and objectives.
     * @param {MansionLoader} mansionLoader - To find objects in the scene.
     */
    constructor(scene, interactionSystem, qteManager, audioManager, gameManager, mansionLoader) {
        this.scene = scene;
        this.interactionSystem = interactionSystem;
        this.qteManager = qteManager;
        this.audioManager = audioManager;
        this.gameManager = gameManager;
        this.mansionLoader = mansionLoader; // Assuming mansionLoader has a way to find objects

        this.garageDoor = null; // Reference to S_Door002 group
        this.doorPivot = null; // Reference to S_Door_Pivot001
        this.plank1 = null; // Reference to wooden_plank
        this.plank2 = null; // Reference to wooden_plank2

        this.plank1Placed = false;
        this.plank2Placed = false;
        this.barricadeSequenceActive = false;
        this.isAnimatingPlank = false; // Prevent QTE trigger during animation

        // Target positions of the planks relative to the door pivot
        // !!! IMPORTANT: Adjust these values based on your scene setup !!!
        this.plank1Target = {
            position: new THREE.Vector3(-0.54, 1.6, -0.2), // Position relative to the pivot
            rotation: new THREE.Euler(0, 0, Math.PI / 3), // Example rotation (45 degrees Z)
        };
        this.plank2Target = {
            position: new THREE.Vector3(-0.47, 1.2, -0.2), // Example position
            rotation: new THREE.Euler(0, 0, -Math.PI / 3), // Example rotation (-45 degrees Z)
        };
        // --- End Target Definitions ---

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
        this.garageDoor = this.scene.getObjectByName('S_Door002'); // The group
        if (this.garageDoor) {
            this.doorPivot = this.garageDoor.parent; // Assuming pivot is direct parent
            if (!this.doorPivot || !this.doorPivot.name.includes('S_Door_Pivot')) {
                logger.error('GarageSystem: Could not find door pivot for reference.');
                this.doorPivot = this.garageDoor; // Fallback to door itself if pivot not found
            }
        } else {
            logger.error('GarageSystem: Cannot activate sequence, S_Door002 not found.');
            this.barricadeSequenceActive = false;
            return;
        }


        // Find the planks
        this.plank1 = this.scene.getObjectByName('wooden_plank');
        this.plank2 = this.scene.getObjectByName('wooden_plank2'); // Ensure this name is correct

        let planksFound = 0;
        if (this.plank1) {
            this.plank1.userData = { // Overwrite or set userData
                interactable: true,
                type: 'barricade_plank',
                plankId: 1 // Add an ID for easier handling
            };
            planksFound++;
            logger.log(`   Found plank 1: ${this.plank1.name}`);
        } else {
            logger.warn('   Could not find plank 1 (wooden_plank)');
        }

        if (this.plank2) {
            this.plank2.userData = { // Overwrite or set userData
                interactable: true,
                type: 'barricade_plank',
                plankId: 2 // Add an ID
            };
            planksFound++;
             logger.log(`   Found plank 2: ${this.plank2.name}`);
        } else {
             logger.warn('   Could not find plank 2 (wooden_plank2)');
        }

        if (planksFound > 0) {
            // Register the handler with InteractionSystem
            if (this.interactionSystem.interactionTypes['barricade_plank']) {
                this.interactionSystem.interactionTypes['barricade_plank'].handler = this.handlePlankInteraction.bind(this);
                logger.log('   Registered plank interaction handler.');
            } else {
                logger.error('   Interaction type "barricade_plank" not defined in InteractionSystem.');
            }
        } else {
             logger.error('   No planks found. Barricade sequence cannot proceed.');
             this.barricadeSequenceActive = false;
        }
    }

    /**
     * Handles the interaction event when a plank is clicked.
     * Called by InteractionSystem.
     * @param {THREE.Object3D} interactedObject - The plank mesh that was clicked.
     * @param {object} userData - The userData from the plank object.
     */
    handlePlankInteraction(interactedObject, userData) {
        // Door must be closed in order to interact with the planks
        if(this.garageDoor && this.garageDoor.userData.isOpen){
            logger.log('Plank interaction blocked: Garage door is open.');
            this.interactionSystem.showMessage("Need to close the door first.", 2000); // Inform player
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
            //this.gameManager.showMessage("Plank already placed.", 1500);
            return;
        }

        logger.log(`Attempting to place plank ${plankId}... Starting QTE.`);

        // Disable interaction temporarily to prevent double triggers
        interactedObject.userData.interactable = false;

        this.qteManager.startQTE('buttonMash', {
            key: 'KeyE', // Mash the E key
            duration: 5000, // 5 seconds
            requiredPresses: 15, // Number of presses needed
            onSuccess: () => this.onPlankQteSuccess(interactedObject, plankId),
            onFailure: () => this.onPlankQteFailure(interactedObject),
        });
    }

    /**
     * Called when the Button Mash QTE for placing a plank succeeds.
     * @param {THREE.Object3D} plankObject - The plank mesh involved.
     * @param {number} plankId - 1 or 2.
     */
    async onPlankQteSuccess(plankObject, plankId) {
        logger.log(`✅ QTE Success for plank ${plankId}!`);
        this.isAnimatingPlank = true; // Set animation flag

        if (plankId === 1) {
            this.plank1Placed = true;
        } else {
            this.plank2Placed = true;
        }

        // Keep interaction disabled permanently for this plank
        plankObject.userData.interactable = false;

        // Play sound
        this.audioManager.playSound('plank_place', 'public/audio/sfx/hit_sound.mp3'); // Replace with actual sound path

        // Animate the plank to its target position/rotation ON THE DOOR
        const target = (plankId === 1) ? this.plank1Target : this.plank2Target;
        this.animatePlankPlacement(plankObject, target, () => {
            this.isAnimatingPlank = false; // Clear animation flag when done
            logger.log(`   Plank ${plankId} animation finished.`);
            // Check if the barricade is complete
            this.checkBarricadeCompletion();
        });
    }

    /**
     * Called when the Button Mash QTE for placing a plank fails.
     * @param {THREE.Object3D} plankObject - The plank mesh involved.
     */
    async onPlankQteFailure(plankObject) { 
        logger.log(`❌ QTE Failure for plank ${plankObject.userData.plankId}. Triggering death sequence.`);

        if (window.gameControls && window.gameControls.narrativeManager) {
            // Trigger the failure event which should show the death screen
            await window.gameControls.narrativeManager.triggerEvent("stage3.barricaded_door_fail");
            // This is a placeholder, we can do something with this
        } 
        else {
            logger.error("NarrativeManager not found, cannot trigger barricade failure event!");
            // Fallback: Directly show a game over message if narrative fails
            this.gameManager.onGameLost("You weren't fast enough to barricade the door...");
        }

    }

    /**
     * Animates a plank moving from its current position to the target on the door.
     * @param {THREE.Object3D} plankObject - The plank to animate.
     * @param {object} target - Object containing target position (Vector3) and rotation (Euler).
     * @param {function} onComplete - Callback function when animation finishes.
     */
    animatePlankPlacement(plankObject, target, onComplete) {
        const duration = 1500; // Animation duration in ms (1.5 seconds)
        const startTime = performance.now();

        const startPosition = plankObject.position.clone();
        const startQuaternion = plankObject.quaternion.clone();

        // --- Calculate World Target ---
        // We need the target position/rotation relative to the *world*,
        // taking the door pivot's current transform into account.

        // 1. Create a temporary helper object
        const helper = new THREE.Object3D();
        // 2. Set its local position/rotation to the target values defined earlier
        helper.position.copy(target.position);
        helper.rotation.copy(target.rotation);
        // 3. Make the helper a child of the door pivot *temporarily*
        this.doorPivot.add(helper);
        // 4. Get the helper's *world* position and quaternion
        const worldTargetPosition = new THREE.Vector3();
        const worldTargetQuaternion = new THREE.Quaternion();
        helper.getWorldPosition(worldTargetPosition);
        helper.getWorldQuaternion(worldTargetQuaternion);
        // 5. Remove the helper from the pivot
        this.doorPivot.remove(helper);
        // --- End World Target Calculation ---


        // --- Re-parent plank to the scene (to animate in world space) ---
        // Store original parent in case we need it later
        const originalParent = plankObject.parent;
        // Get current world position/quaternion BEFORE changing parent
        const currentWorldPos = new THREE.Vector3();
        const currentWorldQuat = new THREE.Quaternion();
        plankObject.getWorldPosition(currentWorldPos);
        plankObject.getWorldQuaternion(currentWorldQuat);
        // Add to scene and set world transform
        this.scene.add(plankObject);
        plankObject.position.copy(currentWorldPos);
        plankObject.quaternion.copy(currentWorldQuat);
        // --- End Re-parenting ---

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
            } else {
                // Snap to final world position/rotation
                plankObject.position.copy(worldTargetPosition);
                plankObject.quaternion.copy(worldTargetQuaternion);

                // --- OPTIONAL: Re-parent back to door pivot ---
                // This makes the plank move *with* the door if it ever animates again.
                // It requires converting the world transform back to local relative to the pivot.
                 this.doorPivot.attach(plankObject);
                 logger.log(`   Re-parented plank ${plankObject.userData.plankId} to door pivot.`);
                // --- End Optional Re-parenting ---

                if (onComplete) onComplete();
            }
        };

        requestAnimationFrame(animate);
    }


    /**
     * Checks if both planks are placed and finalizes the barricade sequence.
     */
    async checkBarricadeCompletion() {
        if (this.plank1Placed && this.plank2Placed) {
            logger.log('🚪✅ Barricade Complete!');
            this.barricadeSequenceActive = false;

            // Update the door's state
            if (this.garageDoor && this.garageDoor.userData) {
                this.garageDoor.userData.barricaded = true;
                // Optionally make the door itself non-interactable now
                this.garageDoor.userData.interactable = false;
                // Update prompt via InteractionSystem if needed (though it might be non-interactable now)
                if (this.interactionSystem.interactionTypes.garage_door) {
                     this.interactionSystem.interactionTypes.garage_door.prompt = "Barricaded";
                }
            }

            // Complete the objective
            this.gameManager.completeObjective('barricade_door');

            // Trigger narrative event for Stage 3 start
            await window.gameControls.narrativeManager.triggerEvent("stage3.barricaded_door");
            await window.gameControls.narrativeManager.triggerEvent("stage3.garage_escape_objective")

            // TODO: Potentially trigger monster behavior change (e.g., trying to break down the door)
        }
    }

    // This system doesn't need a tick update unless you add ongoing effects.
    // tick(delta) {
    //     if (!this.barricadeSequenceActive) return;
    //     // Update logic if needed
    // }

    dispose() {
        logger.log("🧹 Disposing GarageSystem...");
        // Clean up references if needed
        this.garageDoor = null;
        this.doorPivot = null;
        this.plank1 = null;
        this.plank2 = null;
        // If handler was dynamically set, maybe reset it in InteractionSystem?
        // (Depends if other systems might use 'barricade_plank' type)
    }
}