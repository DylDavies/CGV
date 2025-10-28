// src/systems/CarRepairSystem.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

// --- Define a transparent material for interaction zones ---
const transparentMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0, // Make it invisible
    depthWrite: false, // Prevents issues with rendering order
    side: THREE.DoubleSide // Ensure raycast hits from inside too
});
// ---

// --- Define simple geometry for interaction zones ---
const zoneGeometry = new THREE.BoxGeometry(1, 1, 1); // 1x1x1 cube, will be scaled by the Object3D
// ---

export class CarRepairSystem {
    constructor(scene, interactionSystem, qteManager, audioManager, gameManager, narrativeManager, carInteraction) {
        this.scene = scene;
        this.interactionSystem = interactionSystem; // Store interaction system
        this.qteManager = qteManager;
        this.audioManager = audioManager;
        this.gameManager = gameManager;
        this.narrativeManager = narrativeManager;
        this.carInteraction = carInteraction;

        // Object References
        this.carObject = null;
        this.hoodObject = null; // The actual hood mesh for animation/interaction
        this.engineZone = null; // The Object3D parent for the engine zone
        this.driverDoorZone = null; // The Object3D parent for the driver door zone
        this.engineZoneMesh = null; // The invisible mesh child for engine raycasting
        this.driverDoorZoneMesh = null; // The invisible mesh child for door raycasting
        this.crowbarObject = null;
        this.toolboxObject = null;
        this.gasCanBodyObject = null;
        this.gasCanCapObject = null;

        // State Tracking
        this.repairState = {
            driverDoorInteractedFirstTime: false,
            carWontStartTriggered: false,
            hoodStuckTriggered: false,
            needsCrowbar: false,
            hasCrowbar: false,
            justUsedCrowbar: false,
            hoodOpenedWithCrowbar: false,
            needsEngineRepairTriggered: false,
            needsToolbox: false,
            hasToolbox: false,
            engineRepaired: false,
            needsGasTriggered: false,
            needsGasCan: false,
            hasGasCanBody: false,
            hasGasCanCap: false,
            carFueled: false,
            carReadyTriggered: false,
            monsterBreaksInTriggered: false,
        };

        logger.log('🚗 CarRepairSystem initialized');
    }

    initialize() {
        logger.log('🚗 Initializing CarRepairSystem components...');

        this.carObject = this.scene.getObjectByName('car');
        this.hoodObject = this.carInteraction.hoodObject; // Relies on CarInteraction initializing first

        if (!this.hoodObject) {
             logger.error("CarRepairSystem: Hood object reference not found from CarInteraction!");
             return; // Critical dependency
        }
        if (!this.carObject) {
            logger.error("CarRepairSystem: Car root object 'car' not found!");
             // Continue initialization if possible
        }

        // --- Find Zones and Items ---
        this.scene.updateMatrixWorld(true);
        this.engineZone = this.scene.getObjectByName('engine_interact_zone');
        this.driverDoorZone = this.scene.getObjectByName('driver_door_interact_zone');
        this.crowbarObject = this.scene.getObjectByName('crowbar');
        this.toolboxObject = this.scene.getObjectByName('toolbox');
        this.gasCanBodyObject = this.scene.getObjectByName('gas_can_body');
        this.gasCanCapObject = this.scene.getObjectByName('gas_can_cap');

        // --- Configure Zones ---
        if (this.engineZone) {
            this.engineZone.visible = true; // Keep parent Object3D visible
            this.engineZoneMesh = new THREE.Mesh(zoneGeometry, transparentMaterial);
            this.engineZoneMesh.name = "engine_zone_mesh";
            this.engineZone.add(this.engineZoneMesh); // Add mesh child
            this.engineZone.userData = { interactable: false, type: 'car_engine_zone', prompt: "" }; // Data on parent
            logger.log('   Found and configured engine zone (added invisible mesh).');
        } else { logger.error('   Engine interaction zone not found!'); }

        if (this.driverDoorZone) {
            this.driverDoorZone.visible = true; // Keep parent Object3D visible
            this.driverDoorZoneMesh = new THREE.Mesh(zoneGeometry, transparentMaterial);
            this.driverDoorZoneMesh.name = "driver_door_zone_mesh";
            this.driverDoorZone.add(this.driverDoorZoneMesh); // Add mesh child
            // Optional scaling adjustment (apply to parent Object3D)
            // this.driverDoorZone.scale.set(1.5, 1.5, 1.5);
            this.driverDoorZone.userData = { interactable: true, type: 'car_driver_door_zone', prompt: "Press E to enter car" }; // Data on parent
             logger.log('   Found and configured driver door zone (added invisible mesh).');
        } else { logger.error('   Driver door interaction zone not found!'); }

        // --- Refined Raycast Handling for Car Parts ---
        if (this.carObject) {
            logger.log('   Configuring raycasting for car parts...');
            let enabledCount = 0;
            let disabledCount = 0;
            const interactableMeshes = [
                this.hoodObject,
                this.engineZoneMesh,
                this.driverDoorZoneMesh
            ].filter(Boolean); // Filter out nulls if zones weren't found

            this.carObject.traverse((child) => {
                if (child.isMesh) {
                    // Check if this mesh is one of the specifically interactable ones
                    if (interactableMeshes.includes(child)) {
                        // Ensure raycasting is NOT disabled for these
                        // Check if raycast property exists and is the empty function
                        if (typeof child.raycast === 'function' && child.raycast.toString() === "() => {}") {
                           delete child.raycast; // Restore default raycasting
                           logger.log(`      Restored default raycast for: ${child.name || 'Zone Mesh'}`);
                        }
                        enabledCount++;
                    } else {
                        // Disable raycasting for all OTHER meshes under the car
                        child.raycast = () => {}; // Empty function disables raycasting
                        disabledCount++;
                    }
                }
            });
            logger.log(`   Configured raycasting: ${enabledCount} parts kept enabled, ${disabledCount} parts disabled.`);
        }
        // --- End Raycast Handling ---

        // --- Configure Items ---
        if (this.crowbarObject) this.crowbarObject.userData = { interactable: false, type: 'crowbar', itemId: 'crowbar', itemName: 'Crowbar' };
        else logger.warn('   Crowbar object not found.');
        if (this.toolboxObject) this.toolboxObject.userData = { interactable: false, type: 'toolbox', itemId: 'toolbox', itemName: 'Toolbox' };
        else logger.warn('   Toolbox object not found.');
        if (this.gasCanBodyObject) this.gasCanBodyObject.userData = { interactable: false, type: 'gas_can_part', itemId: 'gas_can_body', itemName: 'Gas Can Body' };
        else logger.warn('   Gas can body object not found.');
        if (this.gasCanCapObject) this.gasCanCapObject.userData = { interactable: false, type: 'gas_can_part', itemId: 'gas_can_cap', itemName: 'Gas Can Cap' };
        else logger.warn('   Gas can cap object not found.');


        // --- Register Handlers ---
        this.registerInteractionHandler('car_driver_door_zone', this.handleDriverDoorInteraction.bind(this));
        this.registerInteractionHandler('car_engine_zone', this.handleEngineInteraction.bind(this));
        this.registerInteractionHandler('crowbar', this.handleItemPickup.bind(this));
        this.registerInteractionHandler('toolbox', this.handleItemPickup.bind(this));
        this.registerInteractionHandler('gas_can_part', this.handleItemPickup.bind(this));

        // --- Hook into CarInteraction ---
        this.carInteraction.registerHoodInteractionCallback(this.handleHoodInteractionRequest.bind(this));
        this.carInteraction.registerHoodAnimationCompleteCallback(this.onHoodAnimationComplete.bind(this));

        logger.log('✅ CarRepairSystem initialization complete.');
    }

    registerInteractionHandler(type, handler) {
        if (this.interactionSystem.interactionTypes[type]) {
            this.interactionSystem.interactionTypes[type].handler = handler;
            logger.log(`   Registered handler for interaction type: ${type}`);
        } else {
            logger.error(`   Interaction type "${type}" not defined in InteractionSystem.`);
        }
    }

    // --- Interaction Handlers ---

    async handleDriverDoorInteraction(interactedObject, userData) {
        // interactedObject here will be the PARENT Object3D ('driver_door_interact_zone')
        logger.log(`🚗 Handling Driver Door Interaction via zone: ${interactedObject.name}. State: ${JSON.stringify(this.repairState)}`);
        if (this.qteManager.isActive()) return;

        // Firt Interaction
        if(!this.repairState.driverDoorInteractedFirstTime) this.repairState.driverDoorInteractedFirstTime = true;

        // --- Logic remains the same, using userData from the parent zone ---
        if (!this.repairState.carWontStartTriggered) {
            logger.log("   Step 1: Triggering 'car_wont_start'.");
            await this.narrativeManager.triggerEvent("stage3.car_wont_start");
            this.repairState.carWontStartTriggered = true;
            userData.prompt = "Check under the hood?";
            this.interactionSystem.updateCrosshair(); return;
        }
        if (this.repairState.engineRepaired && this.repairState.needsEngineRepairTriggered && !this.repairState.needsGasTriggered) {
             logger.log("   Step 5: Triggering 'fuel_guage' and 'need_gas'.");
             await this.narrativeManager.triggerEvent("stage3.fuel_guage");
             await this.narrativeManager.triggerEvent("stage3.need_gas");
             this.repairState.needsGasTriggered = true; this.repairState.needsGasCan = true;
             this.makeItemInteractable('gas_can_body'); this.makeItemInteractable('gas_can_cap');
             userData.prompt = "Need gas"; this.updateEngineZonePrompt(); this.interactionSystem.updateCrosshair(); return;
        }
        if (this.repairState.engineRepaired && this.repairState.carFueled && !this.repairState.carReadyTriggered) {
            logger.log("   Step 7: Triggering 'car_ready'.");
            await this.narrativeManager.triggerEvent("stage3.car_ready");
            this.repairState.carReadyTriggered = true; this.audioManager.playSound('car_start', 'public/audio/sfx/crack-sound.mp3'); // Placeholder
            userData.interactable = false;
            setTimeout(async () => {
                 if (!this.repairState.monsterBreaksInTriggered) {
                     logger.log("   Triggering 'monster_breaks_in'.");
                     await this.narrativeManager.triggerEvent("stage3.monster_breaks_in");
                     this.repairState.monsterBreaksInTriggered = true; /* TODO: Trigger monster AI */
                 }
            }, 2000);
            userData.prompt = "Escape!"; this.interactionSystem.updateCrosshair(); this.interactionSystem.showMessage("The car starts! Floor it!", 5000);
            setTimeout(() => { if (this.gameManager.gameState !== 'lost') { this.gameManager.onGameWon("You escaped the garage!"); } }, 5000); return;
        }
        // --- Default / Intermediate States ---
        logger.log("   Default message/prompt update for driver door.");
        let message = "Maybe I should check under the hood first.";
        if (!this.carInteraction.isHoodOpen && this.repairState.hoodStuckTriggered && !this.repairState.hasCrowbar) { userData.prompt = "Find a crowbar for the hood"; message = "The hood is stuck. Need a crowbar."; }
        else if (!this.carInteraction.isHoodOpen && this.repairState.hoodStuckTriggered && this.repairState.hasCrowbar) { userData.prompt = "Pry open the hood"; message = "I should use the crowbar on the hood."; }
        else if (this.carInteraction.isHoodOpen && this.repairState.hoodOpenedWithCrowbar && !this.repairState.engineRepaired && !this.repairState.hasToolbox) { userData.prompt = "Find tools for the engine"; message = "The engine needs repair. Need tools."; }
        else if (this.carInteraction.isHoodOpen && this.repairState.hoodOpenedWithCrowbar && !this.repairState.engineRepaired && this.repairState.hasToolbox) { userData.prompt = "Repair the engine"; message = "I should use the toolbox on the engine."; }
        else if (this.repairState.engineRepaired && this.repairState.needsGasTriggered && !this.repairState.carFueled && (!this.repairState.hasGasCanBody || !this.repairState.hasGasCanCap)) { userData.prompt = "Find gas can parts"; message = "The car needs gas. Find the parts for the gas can."; }
        else if (this.repairState.engineRepaired && this.repairState.needsGasTriggered && !this.repairState.carFueled && this.repairState.hasGasCanBody && this.repairState.hasGasCanCap) { userData.prompt = "Fuel the car"; message = "I should put the gas in the car now."; }
        else if (this.repairState.carWontStartTriggered && !this.repairState.hoodStuckTriggered) { userData.prompt = "Check under the hood"; message = "Let me check under the hood."; }
        else { userData.prompt = "Check the car"; message = "Need to figure out what's wrong with the car."; }
        this.interactionSystem.showMessage(message, 2000); this.interactionSystem.updateCrosshair();
    }

    /**
     * Callback for CarInteraction. Checks state before allowing hood animation.
     * @param {THREE.Mesh} interactedObject - This will be the HOOD MESH.
     * @param {object} userData - userData from the HOOD MESH.
     * @returns {boolean} True to allow animation, False to block.
     */
    handleHoodInteractionRequest(interactedObject, userData) {
        logger.log(`🚗 Handling Hood Interaction Request on object: ${interactedObject.name}. State: ${JSON.stringify(this.repairState)}`);

        // --- Hood Stuck Logic ---
        // If hood is closed AND player hasn't tried starting car OR hasn't encountered stuck hood yet
        if (!this.carInteraction.isHoodOpen && (!this.repairState.carWontStartTriggered || !this.repairState.hoodStuckTriggered)) {
             if (!this.repairState.carWontStartTriggered) {
                logger.log("   Hood interaction blocked: Try starting the car first.");
                this.interactionSystem.showMessage("Maybe I should try starting the car first.", 2000);
                return false;
            }
            logger.log("   Step 2: Triggering 'hood_stuck'.");
            this.narrativeManager.triggerEvent("stage3.hood_stuck");
            this.repairState.hoodStuckTriggered = true; 
            this.repairState.needsCrowbar = true;
            this.makeItemInteractable('crowbar');
            userData.prompt = "Need something to pry this open"; // Update prompt on hood object
            this.interactionSystem.updateCrosshair();
             return false;
        }

        // --- Crowbar Logic ---
        if (!this.carInteraction.isHoodOpen && this.repairState.needsCrowbar) {
            if (this.repairState.hasCrowbar) {
                logger.log("   Step 3: Player has crowbar. Prying hood open.");
                this.repairState.justUsedCrowbar = true; 
                this.audioManager.playSound('pry_hood', 'public/audio/sfx/hit_sound.mp3');  // Audio for playing crowbar sound
                userData.prompt = "Opening..."; 
                this.interactionSystem.updateCrosshair(); 
                this.narrativeManager.triggerEvent("stage3.need_engine_repair");
                return true;
            } 
            else {
                logger.log("   Hood still stuck, player needs crowbar."); 
                this.interactionSystem.showMessage("The hood is stuck fast. Need a crowbar.", 2000);
                userData.prompt = "Need something to pry this open"; 
                this.interactionSystem.updateCrosshair(); 
                return false;
            }
        }

        // --- Default Open/Close ---
        if (!this.repairState.carWontStartTriggered) {
            logger.log("   Hood interaction blocked: Try starting the car first."); 
            this.interactionSystem.showMessage("Maybe I should try starting the car first.", 2000); 
            return false;
        }

        logger.log("   Allowing normal hood open/close.");
        if (this.repairState.driverDoorInteractedFirstTime){
            userData.prompt = this.carInteraction.isHoodOpen ? "Press E to open hood" : "Press E to close hood";
            this.interactionSystem.updateCrosshair(); 
        }

        return true;
    }

    async handleEngineInteraction(interactedObject, userData) {
        // interactedObject here will be the PARENT Object3D ('engine_interact_zone')
        logger.log(`🚗 Handling Engine Interaction via zone: ${interactedObject.name}. State: ${JSON.stringify(this.repairState)}`);
        if (this.qteManager.isActive() || !this.carInteraction.isHoodOpen) return;

        if (!this.repairState.hoodOpenedWithCrowbar) {
            logger.warn("   Engine interaction blocked: Hood not properly opened.");
            this.interactionSystem.showMessage("Need to get the hood fully open first.", 2000);
            return;
        }

         // --- Engine Repair Logic ---
        if (!this.repairState.needsEngineRepairTriggered) {
            this.repairState.needsEngineRepairTriggered = true;
            this.repairState.needsToolbox = true;
            this.makeItemInteractable('toolbox');
            this.updateEngineZonePrompt();
            this.interactionSystem.updateCrosshair();
            return;
        }

         if (this.repairState.needsToolbox && !this.repairState.engineRepaired) {
            if (this.repairState.hasToolbox) {
                logger.log("   Player has toolbox. Starting repair QTE.");
                userData.interactable = false;
                this.interactionSystem.updateCrosshair();
                // skilcheck sound
                this.audioManager.playSound('fueling', 'public/audio/sfx/skill-check.mp3'); // Placeholder
                await new Promise(resolve => setTimeout(resolve, 400));
                this.qteManager.startQTE('skillCheck', { key: 'KeyE', duration: 7000, successZoneSize: 30, needleSpeed: 360, onSuccess: () => this.onEngineRepairSuccess(userData), onFailure: () => this.onEngineRepairFailure(userData) });
            }
            else{
                logger.log("   Engine needs repair, player needs toolbox."); 
                this.interactionSystem.showMessage("Need tools to fix this engine.", 2000);
                this.updateEngineZonePrompt(); 
                this.interactionSystem.updateCrosshair();
            }

             return;
         }

         // --- Fueling Logic ---
         if (this.repairState.engineRepaired && this.repairState.needsGasCan && !this.repairState.carFueled) {
             if (this.repairState.hasGasCanBody && this.repairState.hasGasCanCap) {
                 logger.log("   Step 6: Player has gas can parts. Fueling car.");
                 userData.interactable = false; this.interactionSystem.updateCrosshair();
                  this.audioManager.playSound('fueling', 'public/audio/sfx/unlock-safe.mp3'); // Placeholder
                 await new Promise(resolve => setTimeout(resolve, 3000));
                 this.repairState.carFueled = true; this.repairState.needsGasCan = false; this.interactionSystem.showMessage("Fueled up!", 2000); userData.interactable = true;
                 this.gameManager.removeFromInventory('Gas Can Body'); this.gameManager.removeFromInventory('Gas Can Cap');
                 this.updateEngineZonePrompt(); if (this.driverDoorZone) this.driverDoorZone.userData.prompt = "Press E to start car";
                 await this.narrativeManager.triggerEvent("stage3.is_engine_fixed"); await this.narrativeManager.triggerEvent("stage3.test_car");
                 this.interactionSystem.updateCrosshair();
             } else {
                 logger.log("   Car needs gas, player missing parts."); this.interactionSystem.showMessage("Need to find both parts of the gas can first.", 2000);
                 this.updateEngineZonePrompt(); this.interactionSystem.updateCrosshair();
             }
             return;
         }

         // --- Default: Engine Repaired and Fueled ---
         logger.log("   Engine already repaired and fueled."); this.interactionSystem.showMessage("The engine looks ready.", 2000);
         this.updateEngineZonePrompt(); this.interactionSystem.updateCrosshair();
    }

    handleItemPickup(interactedObject, userData) {
        if (this.qteManager.isActive()) return;
        const itemId = userData.itemId;
        const itemName = userData.itemName || itemId;
        let success = false; // Flag to check if pickup was successful

        // *** NEW: Special handling for gas can parts ***
        if (itemId === 'gas_can_body' || itemId === 'gas_can_cap') {
            logger.log(`🛠️ Picking up gas can parts (triggered by ${itemName})`);

            // Check if inventory has space for *two* items if neither is held, or *one* if one is already held (though ideally they are picked together)
            const neededSlots = (this.repairState.hasGasCanBody || this.repairState.hasGasCanCap) ? 1 : 2;
            if (this.gameManager.inventory.length <= (10 - neededSlots)) {
                // Add both items to inventory if not already present
                if (!this.repairState.hasGasCanBody) {
                    this.gameManager.addToInventory({ name: 'Gas Can Body', type: 'gas_can_part', id: 'gas_can_body', description: 'The main body of the gas can.' });
                    this.repairState.hasGasCanBody = true;
                }
                if (!this.repairState.hasGasCanCap) {
                    this.gameManager.addToInventory({ name: 'Gas Can Cap', type: 'gas_can_part', id: 'gas_can_cap', description: 'The cap for the gas can.' });
                    this.repairState.hasGasCanCap = true;
                }

                // Make both 3D objects invisible and non-interactable
                if (this.gasCanBodyObject) {
                    this.gasCanBodyObject.visible = false;
                    this.gasCanBodyObject.userData.interactable = false;
                }
                if (this.gasCanCapObject) {
                    this.gasCanCapObject.visible = false;
                    this.gasCanCapObject.userData.interactable = false;
                }

                success = true; // Mark as successful pickup
                this.audioManager.playSound('pickup_gas', 'public/audio/sfx/wood-block.mp3'); // Use a specific sound if desired, or keep generic 'pickup'
                this.interactionSystem.showMessage("Picked up Gas Can parts", 2000); // Consolidated message
            } else {
                logger.warn(`   Inventory full, could not pick up gas can parts.`);
                this.interactionSystem.showMessage("Inventory full!", 2000);
            }
        }
        // *** END: Special handling for gas can parts ***

        // --- Original logic for other items ---
        else {
            logger.log(`🛠️ Picking up item: ${itemName} (ID: ${itemId})`);
            success = this.gameManager.addToInventory({ name: itemName, type: userData.type, id: itemId, description: `A ${itemName}. Might be useful.` });

            if (success) {
                if (itemId === 'crowbar') this.repairState.hasCrowbar = true;
                if (itemId === 'toolbox') this.repairState.hasToolbox = true;
                // Note: Gas can flags are handled above now

                interactedObject.visible = false;
                interactedObject.userData.interactable = false;
                this.audioManager.playSound('pickup', 'public/audio/sfx/unlock-door.mp3'); // Placeholder
            } else {
                logger.warn(`   Inventory full, could not pick up ${itemName}.`);
                this.interactionSystem.showMessage("Inventory is full!", 2000);
            }
        }
        // --- End Original logic ---

        // Update UI prompts only if a pickup was successful
        if (success) {
            this.updateHoodPrompt();
            this.updateEngineZonePrompt();
            this.updateDriverDoorPrompt();
            this.interactionSystem.updateCrosshair(); // Ensure crosshair updates after state changes
        }
    }


    // --- QTE Callbacks ---
    async onEngineRepairSuccess(engineZoneUserData) {
        logger.log('✅ Engine Repair QTE Success!');
        this.repairState.engineRepaired = true; this.repairState.needsToolbox = false; this.interactionSystem.showMessage("Engine repaired!", 2000);
        engineZoneUserData.interactable = true; this.updateEngineZonePrompt();
        await this.narrativeManager.triggerEvent("stage3.is_engine_fixed"); await this.narrativeManager.triggerEvent("stage3.test_car");
        if (this.driverDoorZone) this.driverDoorZone.userData.prompt = "Try starting the car again";
        this.interactionSystem.updateCrosshair();
     }
    onEngineRepairFailure(engineZoneUserData) {
        logger.log('❌ Engine Repair QTE Failure.'); this.interactionSystem.showMessage("Repair failed... Try again.", 2000);
        engineZoneUserData.prompt = "Try repair again"; engineZoneUserData.interactable = true; this.interactionSystem.updateCrosshair();
    }

    // --- Helper Methods ---
    makeItemInteractable(itemId) {
        let itemObject = null; let stateFlag = false;
        if (itemId === 'crowbar') { itemObject = this.crowbarObject; stateFlag = this.repairState.hasCrowbar; }
        else if (itemId === 'toolbox') { itemObject = this.toolboxObject; stateFlag = this.repairState.hasToolbox; }
        else if (itemId === 'gas_can_body') { itemObject = this.gasCanBodyObject; stateFlag = this.repairState.hasGasCanBody; }
        else if (itemId === 'gas_can_cap') { itemObject = this.gasCanCapObject; stateFlag = this.repairState.hasGasCanCap; }
        if (itemObject && itemObject.userData && !stateFlag && itemObject.visible) {
            itemObject.userData.interactable = true; logger.log(`   Made item interactable: ${itemId}`);
        } else if (!itemObject) { logger.warn(`   Could not make item interactable: ${itemId} (not found)`); }
    }
     makeEngineInteractable() {
         if (this.engineZone && this.engineZone.userData) {
             this.engineZone.userData.interactable = true; this.updateEngineZonePrompt(); logger.log('   Engine zone interactable.'); this.interactionSystem.updateCrosshair();
         }
     }
     makeEngineNonInteractable() {
         if (this.engineZone && this.engineZone.userData) {
             this.engineZone.userData.interactable = false; this.engineZone.userData.prompt = ""; logger.log('   Engine zone non-interactable.'); this.interactionSystem.updateCrosshair();
         }
     }
     updateEngineZonePrompt() {
         if (!this.engineZone?.userData) return;

         if (!this.repairState.hoodOpenedWithCrowbar || !this.carInteraction.isHoodOpen){
            this.engineZone.userData.prompt = "";
            return;
        }

        if (!this.repairState.engineRepaired){
            this.engineZone.userData.prompt = this.repairState.hasToolbox ? "Press E to repair engine" : "Need tools to fix this"; 
        }
        else if (this.repairState.engineRepaired && !this.repairState.needsGasTriggered) {
             // Engine fixed, but player needs to test start via door first
             this.engineZone.userData.prompt = "Engine looks repaired"; // Or "" for no prompt
        }
         // *** END NEW CHECK ***
        else if (!this.repairState.carFueled) {
             // Engine repaired, gas trigger happened, now check for parts
             this.engineZone.userData.prompt = (this.repairState.hasGasCanBody && this.repairState.hasGasCanCap) ? "Press E to add fuel" : "Need fuel"; // Updated prompt for missing parts
         }
        else { this.engineZone.userData.prompt = "Engine looks ready"; }
     }

     updateHoodPrompt() {
          if (!this.hoodObject?.userData) return;

          if(!this.repairState.driverDoorInteractedFirstTime)this.repairState.driverDoorInteractedFirstTime = true;

          if (!this.carInteraction.isHoodOpen) {
              if (this.repairState.needsCrowbar && !this.repairState.hasCrowbar) { this.hoodObject.userData.prompt = "Need something to pry this open"; }
              else if (this.repairState.needsCrowbar && this.repairState.hasCrowbar) { this.hoodObject.userData.prompt = "Press E to pry open hood"; }
              else if (this.repairState.carWontStartTriggered) { this.hoodObject.userData.prompt = "Press E to open hood"; }
              else { this.hoodObject.userData.prompt = ""; } // No prompt if car hasn't been tried
          } else { this.hoodObject.userData.prompt = "Press E to close hood"; }
     }
     updateDriverDoorPrompt() {
          if (!this.driverDoorZone?.userData) return;
          if (this.repairState.carReadyTriggered) { this.driverDoorZone.userData.prompt = "Escape!"; }
          else if (this.repairState.engineRepaired && this.repairState.carFueled) { this.driverDoorZone.userData.prompt = "Press E to start car"; }
          else if (this.repairState.engineRepaired && this.repairState.needsGasTriggered) { this.driverDoorZone.userData.prompt = this.repairState.hasGasCanBody && this.repairState.hasGasCanCap ? "Fuel the car first" : "Find gas can parts"; }
          else if (this.repairState.engineRepaired && !this.repairState.needsGasTriggered) { this.driverDoorZone.userData.prompt = "Try starting the car again"; }
          else if (this.repairState.hoodOpenedWithCrowbar && !this.repairState.engineRepaired) { this.driverDoorZone.userData.prompt = this.repairState.hasToolbox ? "Repair the engine first" : "Find tools for the engine"; }
          else if (this.repairState.hoodStuckTriggered) { this.driverDoorZone.userData.prompt = this.repairState.hasCrowbar ? "Pry open the hood first" : "Find a crowbar for the hood"; }
          else if (this.repairState.carWontStartTriggered) { this.driverDoorZone.userData.prompt = "Check under the hood"; }
          else { this.driverDoorZone.userData.prompt = "Press E to enter car"; }
     }
    consumeCrowbar() { logger.log('   Crowbar used on hood.'); }
    
    onHoodAnimationComplete(isOpen) {
        logger.log(`🚗 Hood animation complete. New state isOpen: ${isOpen}`);
        if (isOpen && this.repairState.justUsedCrowbar) {
            logger.log("   Hood successfully pried open with crowbar.");
            this.repairState.hoodOpenedWithCrowbar = true; this.repairState.needsCrowbar = false; this.repairState.justUsedCrowbar = false;
            this.makeEngineInteractable();
        } else if (!isOpen) {
            this.makeEngineNonInteractable();
        }
        this.updateHoodPrompt(); this.updateEngineZonePrompt(); this.updateDriverDoorPrompt(); this.interactionSystem.updateCrosshair();
    }

    dispose() {
        logger.log("🧹 Disposing CarRepairSystem...");
        // --- Remove added meshes ---
        if (this.engineZone && this.engineZoneMesh && this.engineZone.children.includes(this.engineZoneMesh)) {
             this.engineZone.remove(this.engineZoneMesh);
             if (this.engineZoneMesh.geometry) this.engineZoneMesh.geometry.dispose(); // Dispose geometry
             // Material is shared, no need to dispose here
             logger.log("   Removed engine zone mesh.");
        }
        if (this.driverDoorZone && this.driverDoorZoneMesh && this.driverDoorZone.children.includes(this.driverDoorZoneMesh)) {
             this.driverDoorZone.remove(this.driverDoorZoneMesh);
             if (this.driverDoorZoneMesh.geometry) this.driverDoorZoneMesh.geometry.dispose(); // Dispose geometry
             logger.log("   Removed driver door zone mesh.");
        }
        // ---
        this.registerInteractionHandler('car_driver_door_zone', null); this.registerInteractionHandler('car_engine_zone', null);
        this.registerInteractionHandler('crowbar', null); this.registerInteractionHandler('toolbox', null); this.registerInteractionHandler('gas_can_part', null);
        if(this.carInteraction) {
           this.carInteraction.registerHoodInteractionCallback(null); this.carInteraction.registerHoodAnimationCompleteCallback(null);
        }
        // Reset references
        this.carObject=this.hoodObject=this.engineZone=this.driverDoorZone=this.crowbarObject=this.toolboxObject=this.gasCanBodyObject=this.gasCanCapObject=this.engineZoneMesh=this.driverDoorZoneMesh = null;
    }
}

