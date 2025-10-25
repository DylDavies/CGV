// src/systems/CarInteraction.js
import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

export class CarInteraction {
    constructor(scene, interactionSystem, audioManager, gameManager) {
        this.scene = scene;
        this.interactionSystem = interactionSystem;
        this.audioManager = audioManager;
        this.gameManager = gameManager;

        this.carObject = null;
        this.hoodObject = null; // This will be rotated directly
        this.isHoodOpen = false;
        this.isAnimating = false; // Flag to prevent rapid clicking during rotation

        // Store target rotation values
        this.closedRotation = new THREE.Euler(0, 0, 0); // Assuming starts closed at 0 rotation
        this.openRotation = new THREE.Euler(THREE.MathUtils.degToRad(-60), 0, 0); // Example: Rotate -60 degrees on X-axis

        logger.log('🚗 CarInteraction system initialized (JS Rotation)');
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

        // --- Store reference to the car object ---
        this.carObject = sceneGraphRoot.getObjectByName(carRootName);
        if (!this.carObject) {
            logger.warn(`CarInteraction: Could not find the main car object named "${carRootName}". Searching globally.`);
        } else {
             logger.log(`🚗 Found car object reference: ${this.carObject.name}`);
        }

        // --- Find Car Hood Object ---
        const hoodObjectName = 'Murphy92_Hood_Murphy92_Bodymat_0'; // Object to rotate and click

        // Find the hood object (search recursively from scene root)
        this.hoodObject = sceneGraphRoot.getObjectByName(hoodObjectName, true);

        // --- Validate Found Object ---
        if (!this.hoodObject) {
            logger.error(`CarInteraction: CRITICAL - Could not find hood object named "${hoodObjectName}"! Cannot proceed.`);
            logger.error("   >>> ACTION NEEDED: Verify the object exists, has the EXACT name, and was exported correctly.");
            return; // Stop initialization
        } else {
             logger.log(`   Found hood object (for rotation AND interaction): ${this.hoodObject.name}`);
             // Store initial rotation as the 'closed' state
             this.closedRotation.copy(this.hoodObject.rotation);
             // Define open state relative to closed state (adjust axis/angle)
             this.openRotation.copy(this.closedRotation).y += THREE.MathUtils.degToRad(60); // Rotate upwards at an angle of 60 deg
             logger.log(`   Initial Rotation (Closed): ${this.closedRotation.x.toFixed(2)}, ${this.closedRotation.y.toFixed(2)}, ${this.closedRotation.z.toFixed(2)}`);
             logger.log(`   Target Rotation (Open): ${this.openRotation.x.toFixed(2)}, ${this.openRotation.y.toFixed(2)}, ${this.openRotation.z.toFixed(2)}`);
        }

        // --- Make Hood Interactable ---
        this.hoodObject.userData.interactable = true;
        this.hoodObject.userData.type = 'car_hood';
        logger.log(`✅ CarInteraction: Hood "${this.hoodObject.name}" configured for interaction.`);

        // --- Register Handler with InteractionSystem ---
         if (!this.interactionSystem.interactionTypes['car_hood']) {
            this.interactionSystem.interactionTypes['car_hood'] = {
                prompt: "Press E to open hood",
                handler: this.handleHoodInteraction.bind(this)
            };
            logger.log('✅ CarInteraction: Interaction handler registered.');
        } else {
             this.interactionSystem.interactionTypes['car_hood'].handler = this.handleHoodInteraction.bind(this);
             logger.log('✅ CarInteraction: Interaction handler updated.');
        }
    }

    /**
     * Handles the interaction event when the car hood is clicked.
     * Called by InteractionSystem.
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

        this.isAnimating = true;
        interactObject.userData.interactable = false; // Disable interaction during animation

        const targetRotation = this.isHoodOpen ? this.closedRotation : this.openRotation;
        const startRotation = this.hoodObject.rotation.clone(); // Use Euler directly
        const duration = 1000; // Animation duration in ms (1 second)
        const startTime = performance.now();

        logger.log(`🚗 ${this.isHoodOpen ? 'Closing' : 'Opening'} car hood via JS rotation...`);
        // TODO: Add sound
        // this.audioManager.playSound(this.isHoodOpen ? 'car_hood_close' : 'car_hood_open', 'path/to/sound.mp3');

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
                this.isHoodOpen = !this.isHoodOpen; // Toggle state
                this.isAnimating = false;
                interactObject.userData.interactable = true; // Re-enable interaction
                // Update prompt
                this.interactionSystem.interactionTypes['car_hood'].prompt = this.isHoodOpen ? "Press E to close hood" : "Press E to open hood";
                logger.log(`   Hood animation finished. State: ${this.isHoodOpen ? 'Open' : 'Closed'}`);
                // TODO: Trigger next objective if opening
            }
        };

        requestAnimationFrame(animateRotation);
    }

    // ** REMOVED: tick method no longer needed for mixer **
    // tick(delta) { }

    dispose() {
        logger.log("🧹 Disposing CarInteraction system...");
        // No mixer or actions to clean up
        this.carObject = null;
        this.hoodObject = null;
        this.isHoodOpen = false;
        this.isAnimating = false;
    }
}

