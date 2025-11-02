// src/systems/CarInteraction.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

export class CarInteraction {
    constructor(scene, interactionSystem, audioManager, gameManager) {
        this.scene = scene;
        this.interactionSystem = interactionSystem;
        this.audioManager = audioManager;
        this.gameManager = gameManager;

        this.carObject = null;
        this.hoodObject = null; // This will be rotated directly
        this.hoodInteractionCallback = null; // Callback BEFORE animation
        this.hoodAnimationCompleteCallback = null; // Callback AFTER animation
        this.isHoodOpen = false;
        this.isAnimating = false;

        // Store target rotation values - Initialize them here
        this.closedRotation = new THREE.Euler();
        this.openRotation = new THREE.Euler();

        logger.log('CarInteraction system initialized (JS Rotation)');
    }

    /**
     * Allows other systems (like CarRepairSystem) to hook into the hood interaction.
     * @param {function | null} callback - The function to call before handling hood interaction.
     * Should accept (interactObject, userData) and return boolean (true to proceed, false to block).
     */
    registerHoodInteractionCallback(callback) {
        this.hoodInteractionCallback = callback;
        logger.log(`Hood interaction callback ${callback ? 'registered' : 'cleared'}.`);
    }

    /**
     * Allows other systems to be notified when the hood animation finishes.
     * @param {function | null} callback - Function accepting boolean (isOpen)
     */
    registerHoodAnimationCompleteCallback(callback) {
        this.hoodAnimationCompleteCallback = callback;
        logger.log(`Hood animation complete callback ${callback ? 'registered' : 'cleared'}.`);
    }


    /**
     * Initializes the car interaction system after the main scene graph is loaded.
     * @param {THREE.Object3D} sceneGraphRoot - The root object of the loaded GLB (gltf.scene).
     * @param {string} carRootName - The name of the car's top-level object (used for logging/context).
     */
    initializeCar(sceneGraphRoot, carRootName = 'car') {
        if (!sceneGraphRoot) {
            logger.error("CarInteraction: Invalid scene graph root provided for initialization.");
            return;
        }

        this.carObject = sceneGraphRoot.getObjectByName(carRootName);
        if (!this.carObject) {
            logger.warn(`CarInteraction: Could not find the main car object named "${carRootName}". Searching globally.`);
            // Optionally search globally if not found directly: this.carObject = this.scene.getObjectByName(carRootName);
        } else {
             logger.log(`Found car object reference: ${this.carObject.name}`);
        }

        const hoodObjectName = 'Murphy92_Hood_Murphy92_Bodymat_0'; // Object to rotate and click

        // Find the hood object (search recursively from scene root)
        this.hoodObject = sceneGraphRoot.getObjectByName(hoodObjectName, true);

        if (!this.hoodObject) {
            logger.error(`CarInteraction: CRITICAL - Could not find hood object named "${hoodObjectName}"! Cannot proceed.`);
            logger.error("   >>> ACTION NEEDED: Verify the object exists, has the EXACT name, and was exported correctly.");
            return; // Stop initialization
        } else {
             logger.log(`   Found hood object (for rotation AND interaction): ${this.hoodObject.name}`);
             // Store initial rotation AS SOON as object is found
             this.closedRotation.copy(this.hoodObject.rotation);
             this.openRotation.copy(this.closedRotation).y += THREE.MathUtils.degToRad(60); // Apply 60 degrees rotation on Y
             logger.log(`   Initial Rotation (Closed): ${this.closedRotation.x.toFixed(2)}, ${this.closedRotation.y.toFixed(2)}, ${this.closedRotation.z.toFixed(2)}`);
             logger.log(`   Target Rotation (Open): ${this.openRotation.x.toFixed(2)}, ${this.openRotation.y.toFixed(2)}, ${this.openRotation.z.toFixed(2)}`);
        }

        this.hoodObject.userData.interactable = true;
        this.hoodObject.userData.type = 'car_hood';
        // Set the initial prompt in userData here
        this.hoodObject.userData.prompt = "Press E to open hood";
        logger.log(`CarInteraction: Hood "${this.hoodObject.name}" configured for interaction.`);

         // Ensure the interaction type exists (InteractionSystem might create it)
         // The handler itself is now set by InteractionSystem's proxy
         if (!this.interactionSystem.interactionTypes['car_hood']) {
            this.interactionSystem.interactionTypes['car_hood'] = {
                prompt: this.hoodObject.userData.prompt, // Use initial prompt
                handler: null // Let InteractionSystem's proxy handle it
            };
            logger.log('   Created placeholder for car_hood interaction type.');
         }
    }

    /**
     * Handles the interaction event when the car hood is clicked.
     * Called by InteractionSystem's proxy handler.
     * interactObject is the mesh the player clicked (hoodObject)
     */
    handleHoodInteraction(interactObject, userData) {
        // Ensure the clicked object is the one we expect
        if (interactObject !== this.hoodObject) {
            logger.warn("CarInteraction: handleHoodInteraction called with unexpected interact object:", interactObject.name);
            return;
        }

        // Prevent interaction if object isn't found or already animating
        if (!this.hoodObject || this.isAnimating) {
            logger.warn("CarInteraction: Hood not ready or already animating.");
            return;
        }

        let proceed = true;
        if (this.hoodInteractionCallback) {
            proceed = this.hoodInteractionCallback(interactObject, userData);
        }
        if (!proceed) {
            logger.log("CarInteraction: Hood interaction blocked by callback.");
            return; // Stop if the callback returns false
        }


        this.isAnimating = true;
        // InteractionSystem's updateCrosshair will handle disabling prompt during animation

        // Use the PRE-CALCULATED target rotations
        const targetRotation = this.isHoodOpen ? this.closedRotation : this.openRotation;
        const startRotation = this.hoodObject.rotation.clone(); // Current rotation
        const duration = 1000; // Animation duration in ms (1 second)
        const startTime = performance.now();

        logger.log(`${this.isHoodOpen ? 'Closing' : 'Opening'} car hood via JS rotation...`);
        if(this.isHoodOpen){
            this.audioManager.playSound('car_hood_close', 'public/audio/sfx/hood-close.mp3');
        }
        else{
            this.audioManager.playSound('car_hood_open', 'public/audio/sfx/hood-open.mp3');
        }
        //this.audioManager.playSound(this.isHoodOpen ? 'car_hood_close' : 'car_hood_open', 'public/audio/sfx/monster-huff.mp3'); // Placeholder

        const animateRotation = () => {
            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

            // Interpolate Euler rotation using slerp on Quaternions for smooth rotation
            const startQuaternion = new THREE.Quaternion().setFromEuler(startRotation);
            const targetQuaternion = new THREE.Quaternion().setFromEuler(targetRotation);
            const currentQuaternion = new THREE.Quaternion().copy(startQuaternion).slerp(targetQuaternion, easedProgress);

            this.hoodObject.setRotationFromQuaternion(currentQuaternion);

            if (progress < 1) {
                requestAnimationFrame(animateRotation);
            } else {
                // Snap to final rotation to ensure accuracy
                this.hoodObject.rotation.copy(targetRotation);
                const wasOpen = this.isHoodOpen; // Store previous state before toggling
                this.isHoodOpen = !wasOpen;      // Toggle state
                this.isAnimating = false;
                // Update the prompt in userData for InteractionSystem to pick up
                interactObject.userData.prompt = this.isHoodOpen ? "Press E to close hood" : "Press E to open hood";
                logger.log(`   Hood animation finished. State: ${this.isHoodOpen ? 'Open' : 'Closed'}`);


                if (this.hoodAnimationCompleteCallback) {
                    this.hoodAnimationCompleteCallback(this.isHoodOpen); // Pass the NEW state
                }


                // InteractionSystem's updateCrosshair will handle re-enabling prompt/interaction
            }
        };

        requestAnimationFrame(animateRotation);
    }

    dispose() {
        logger.log("Disposing CarInteraction system...");
        // Clear callback references
        this.hoodInteractionCallback = null;
        this.hoodAnimationCompleteCallback = null;
        // Clear object references
        this.carObject = null;
        this.hoodObject = null;
        this.isHoodOpen = false;
        this.isAnimating = false;
    }
}
