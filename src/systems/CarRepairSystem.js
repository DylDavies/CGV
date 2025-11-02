// src/systems/CarRepairSystem.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

// Transparent material overlay for invisible interactive zones
const transparentMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0, 
    depthWrite: false, // Prevents issues with rendering order
    side: THREE.DoubleSide // ensure that the raycase from the player cursor can reach inside the empty objects
});


// Geometry for interaction zones
const zoneGeometry = new THREE.BoxGeometry(1, 1, 1); // 1x1x1 cube, will be scaled by the Object3D


export class CarRepairSystem {
    constructor(stageManager, interactionSystem, qteManager, audioManager, gameManager, narrativeManager, carInteraction, physicsManager, camera) {
        this.stageManager = stageManager;
        this.interactionSystem = interactionSystem;
        this.qteManager = qteManager;
        this.audioManager = audioManager;
        this.gameManager = gameManager;
        this.narrativeManager = narrativeManager;
        this.carInteraction = carInteraction;
        this.physicsManager = physicsManager;
        this.camera = camera;

        // Object References
        this.carObject = null;
        this.hoodObject = null;
        this.engineZone = null;
        this.driverDoorZone = null;
        this.driverPosObject = null; // Driver position for teleport
        this.steeringWheelObject = null; // Steering wheel for car ignition
        this.engineZoneMesh = null; // mesh for raycasting
        this.driverDoorZoneMesh = null; // mesh for raycasting
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
            playerInCar: false,
            carStartQTETriggered: false,
            carDriveQTETriggered: false,
        };

        // Key listener for E key when in car
        this.boundHandleKeyPress = this.handleKeyPress.bind(this);
        this.boundHandleSpacePress = this.handleSpacePress.bind(this);

        // State for waiting for space key to drive
        this.waitingForSpaceToDrive = false;

        logger.log('CarRepairSystem initialized');
    }

    initialize() {
        logger.log('Initializing CarRepairSystem components...');

        this.carObject = this.stageManager.currentScene.getObjectByName('car');
        this.hoodObject = this.carInteraction.hoodObject; 

        if (!this.hoodObject){
             logger.error("CarRepairSystem: Hood object reference not found from CarInteraction!");
             return; 
        }

        if (!this.carObject) {
            logger.error("CarRepairSystem: Car root object 'car' not found!");
        }

        // Find zones and items
        this.engineZone = this.stageManager.currentScene.getObjectByName('engine_interact_zone');
        this.driverDoorZone = this.stageManager.currentScene.getObjectByName('driver_door_interact_zone');
        this.driverPosObject = this.stageManager.currentScene.getObjectByName('Driver_pos');
        this.steeringWheelObject = this.stageManager.currentScene.getObjectByName('Murphy92_Steering_Wheel_UCB_Interiors_2_0');
        this.crowbarObject = this.stageManager.currentScene.getObjectByName('crowbar');
        this.toolboxObject = this.stageManager.currentScene.getObjectByName('toolbox');
        this.gasCanBodyObject = this.stageManager.currentScene.getObjectByName('gas_can_body');
        this.gasCanCapObject = this.stageManager.currentScene.getObjectByName('gas_can_cap');

        if (this.driverPosObject) {
            logger.log('Found Driver_pos for player teleport');
        } else {
            logger.warn('Driver_pos object not found!');
        }

        if (this.steeringWheelObject) {
            this.steeringWheelObject.userData = { interactable: false, type: 'steering_wheel', prompt: "" };
            logger.log('Found and configured steering wheel for car ignition');
        } else {
            logger.warn('Steering wheel object not found!');
        }

        // Configuring the Engine and Driver interaction zones
        if (this.engineZone){
            this.engineZone.visible = true; 
            this.engineZoneMesh = new THREE.Mesh(zoneGeometry, transparentMaterial);
            this.engineZoneMesh.name = "engine_zone_mesh";

            this.engineZone.add(this.engineZoneMesh); // mesh is a child of the engine
            this.engineZone.userData = { interactable: false, type: 'car_engine_zone', prompt: "" }; 
            logger.log('Found and configured engine zone (added invisible mesh).');
        } 
        else{
            logger.error('Engine interaction zone not found!'); 
        }

        if (this.driverDoorZone){
            this.driverDoorZone.visible = true; 
            this.driverDoorZoneMesh = new THREE.Mesh(zoneGeometry, transparentMaterial);
            this.driverDoorZoneMesh.name = "driver_door_zone_mesh";
            this.driverDoorZone.add(this.driverDoorZoneMesh); // mesh is a child of the the door

            this.driverDoorZone.userData = { interactable: true, type: 'car_driver_door_zone', prompt: "Press E to enter car" }; 
            logger.log('Found and configured driver door zone (added invisible mesh).');
        } 
        else{
            logger.error('Driver door interaction zone not found!'); 
        }

        // Raycasting handling for car parts
        if (this.carObject) {
            logger.log('Configuring raycasting for car parts...');
            let enabledCount = 0;
            let disabledCount = 0;

            const interactableMeshes = [
                this.hoodObject,
                this.engineZoneMesh,
                this.driverDoorZoneMesh
            ].filter(Boolean); // Filter out nulls if zones werent found

            this.carObject.traverse((child) => {
                if (child.isMesh) {
                    // check if the mesh if an interactable mesh
                    if (interactableMeshes.includes(child)) {
                        
                        // raycasting must exist and be enabled
                        if (typeof child.raycast === 'function' && child.raycast.toString() === "() => {}") {
                           delete child.raycast; // Restore default raycasting
                           logger.log(` Restored default raycast for: ${child.name || 'Zone Mesh'}`);
                        }
                        enabledCount++;

                    } 
                    else {
                        // Raycast disabled for all other meshes of the car
                        child.raycast = () => {};
                        disabledCount++;
                    }
                }
            });
            logger.log(`   Configured raycasting: ${enabledCount} parts kept enabled, ${disabledCount} parts disabled.`);
        }

        // Configure Garage interactable objects
        if (this.crowbarObject) this.crowbarObject.userData = { interactable: false, type: 'crowbar', itemId: 'crowbar', itemName: 'Crowbar' };
        else logger.warn('   Crowbar object not found.');
        if (this.toolboxObject) this.toolboxObject.userData = { interactable: false, type: 'toolbox', itemId: 'toolbox', itemName: 'Toolbox' };
        else logger.warn('   Toolbox object not found.');
        if (this.gasCanBodyObject) this.gasCanBodyObject.userData = { interactable: false, type: 'gas_can_part', itemId: 'gas_can_body', itemName: 'Gas Can Body' };
        else logger.warn('   Gas can body object not found.');
        if (this.gasCanCapObject) this.gasCanCapObject.userData = { interactable: false, type: 'gas_can_part', itemId: 'gas_can_cap', itemName: 'Gas Can Cap' };
        else logger.warn('   Gas can cap object not found.');


        // Registre interaction handles for interactable objects
        this.registerInteractionHandler('car_driver_door_zone', this.handleDriverDoorInteraction.bind(this));
        this.registerInteractionHandler('car_engine_zone', this.handleEngineInteraction.bind(this));
        this.registerInteractionHandler('crowbar', this.handleItemPickup.bind(this));
        this.registerInteractionHandler('toolbox', this.handleItemPickup.bind(this));
        this.registerInteractionHandler('gas_can_part', this.handleItemPickup.bind(this));

        // Hook into carInteraction
        this.carInteraction.registerHoodInteractionCallback(this.handleHoodInteractionRequest.bind(this));
        this.carInteraction.registerHoodAnimationCompleteCallback(this.onHoodAnimationComplete.bind(this));

        // Add key listeners for when player is in car
        window.addEventListener('keydown', this.boundHandleKeyPress);
        window.addEventListener('keydown', this.boundHandleSpacePress);

        logger.log('CarRepairSystem initialization complete.');
    }

    registerInteractionHandler(type, handler) {
        if (this.interactionSystem.interactionTypes[type]) {
            this.interactionSystem.interactionTypes[type].handler = handler;
            logger.log(`   Registered handler for interaction type: ${type}`);
        } else {
            logger.error(`   Interaction type "${type}" not defined in InteractionSystem.`);
        }
    }

    // === Interaction Handlers for everything in the car Repair System ===

    async handleDriverDoorInteraction(interactedObject, userData) {
        logger.log(`Handling Driver Door Interaction via zone: ${interactedObject.name}. State: ${JSON.stringify(this.repairState)}`);

        if (this.qteManager.isActive()) return;

        // Firt Interaction in repair sequence will be the car door, this triggers all other states
        if(!this.repairState.driverDoorInteractedFirstTime) this.repairState.driverDoorInteractedFirstTime = true;

        // Interacted with door but the car won't start
        if (!this.repairState.carWontStartTriggered) {
            this.audioManager.playSound('open_car_door', 'public/audio/sfx/open-car-door.mp3');

            logger.log("   Step 1: Triggering 'car_wont_start'.");

            await this.narrativeManager.triggerEvent("stage3.car_wont_start");
            
            this.repairState.carWontStartTriggered = true;
            userData.prompt = "Check under the hood?";
            this.interactionSystem.updateCrosshair(); 
            return;
        }

        // Engine is repaired now we need gas
        if (this.repairState.engineRepaired && this.repairState.needsEngineRepairTriggered && !this.repairState.needsGasTriggered) {
            logger.log("   Step 5: Triggering 'fuel_guage' and 'need_gas'.");

            await this.narrativeManager.triggerEvent("stage3.fuel_guage");
            await this.narrativeManager.triggerEvent("stage3.need_gas");

            this.repairState.needsGasTriggered = true; 
            this.repairState.needsGasCan = true;
            this.makeItemInteractable('gas_can_body');
            this.makeItemInteractable('gas_can_cap');

            userData.prompt = "Need gas"; 
            this.updateEngineZonePrompt(); 
            this.interactionSystem.updateCrosshair();
            return;
        }

        // Car is repaired and refueled, we can now get into the car
        if (this.repairState.engineRepaired && this.repairState.carFueled && !this.repairState.carReadyTriggered) {
            logger.log("   Step 7: Triggering 'car_ready' and teleporting player to driver seat.");

            await this.narrativeManager.triggerEvent("stage3.car_ready");

            this.repairState.carReadyTriggered = true;

            // Close hood if it's open
            if (this.carInteraction && this.carInteraction.isHoodOpen) {
                logger.log("   Closing hood before entering car...");
                // Trigger hood closing animation via handleHoodInteraction
                if (this.hoodObject && this.hoodObject.userData) {
                    this.carInteraction.handleHoodInteraction(this.hoodObject, this.hoodObject.userData);
                }
            }

            // Teleport player to Driver_pos
            if (this.driverPosObject && this.physicsManager) {
                const driverPos = new THREE.Vector3();
                this.driverPosObject.getWorldPosition(driverPos);
                logger.log(`   Teleporting player to driver seat: (${driverPos.x.toFixed(2)}, ${driverPos.y.toFixed(2)}, ${driverPos.z.toFixed(2)})`);
                this.physicsManager.teleportTo(driverPos);
                this.repairState.playerInCar = true;

                // Despawn the monster when player enters the car
                if (window.gameControls && window.gameControls.monsterAI) {
                    logger.log('Despawning monster - player is now in the car');
                    window.gameControls.monsterAI.despawn();
                }

                // Check if player has Annie in inventory and spawn her in the car
                if (this.gameManager.hasItem('Annie (Doll)')) {
                    this.spawnAnnieInCar();
                }

                // Disable all other interactions except steering wheel
                this.disableOtherInteractions();
            } else {
                logger.error("   Cannot teleport player - Driver_pos or physicsManager not found!");
            }

            // Wait a bit and play some audio for the monster breaking in
            setTimeout(async () => {
                if (!this.repairState.monsterBreaksInTriggered) {
                    logger.log("   Triggering 'monster_breaks_in'.");
                    await this.narrativeManager.triggerEvent("stage3.monster_breaks_in");
                    this.repairState.monsterBreaksInTriggered = true; /* TODO: Trigger monster AI */
                }
            }, 2000);

            userData.prompt = "Inside car";
            this.interactionSystem.updateCrosshair();
            this.interactionSystem.showMessage("Press E to start the car!", 3000);

            return;
        }
        
        // Default/ Intermediate States for general flow
        logger.log("   Default message/prompt update for driver door.");
        let message = "Maybe I should check under the hood first.";

        if (!this.carInteraction.isHoodOpen && this.repairState.hoodStuckTriggered && !this.repairState.hasCrowbar){
            userData.prompt = "Find a crowbar for the hood";
            message = "The hood is stuck. Need a crowbar.";
        }
        else if(!this.carInteraction.isHoodOpen && this.repairState.hoodStuckTriggered && this.repairState.hasCrowbar){
            userData.prompt = "Pry open the hood";
            message = "I should use the crowbar on the hood."; 
        }
        else if(this.carInteraction.isHoodOpen && this.repairState.hoodOpenedWithCrowbar && !this.repairState.engineRepaired && !this.repairState.hasToolbox){
            userData.prompt = "Find tools for the engine";
            message = "The engine needs repair. Need tools."; 
        }
        else if (this.carInteraction.isHoodOpen && this.repairState.hoodOpenedWithCrowbar && !this.repairState.engineRepaired && this.repairState.hasToolbox){
            userData.prompt = "Repair the engine";
            message = "I should use the toolbox on the engine."; 
        }
        else if (this.repairState.engineRepaired && this.repairState.needsGasTriggered && !this.repairState.carFueled && (!this.repairState.hasGasCanBody || !this.repairState.hasGasCanCap)){
            userData.prompt = "Find gas can parts"; 
            message = "The car needs gas. Find the parts for the gas can."; 
        }
        else if (this.repairState.engineRepaired && this.repairState.needsGasTriggered && !this.repairState.carFueled && this.repairState.hasGasCanBody && this.repairState.hasGasCanCap){
            userData.prompt = "Fuel the car"; 
            message = "I should put the gas in the car now.";
        }
        else if (this.repairState.carWontStartTriggered && !this.repairState.hoodStuckTriggered){
            userData.prompt = "Check under the hood"; 
            message = "Let me check under the hood."; 
        }
        else{
            userData.prompt = "Check the car";
            message = "Need to figure out what's wrong with the car.";
        }
        
        this.interactionSystem.showMessage(message, 2000); this.interactionSystem.updateCrosshair();
    }

    // Callback for the car Interaction, check states before playing the animation of the hood opening
    handleHoodInteractionRequest(interactedObject, userData) {
        logger.log(`Handling Hood Interaction Request on object: ${interactedObject.name}. State: ${JSON.stringify(this.repairState)}`);

        // Block hood interaction if player is in car
        if (this.repairState.playerInCar) {
            logger.log("   Hood interaction blocked: Player is in car");
            return false;
        }

        // If hood is closed AND player hasn't tried starting car OR hasn't encountered stuck hood yet
        if (!this.carInteraction.isHoodOpen && (!this.repairState.carWontStartTriggered || !this.repairState.hoodStuckTriggered)){
            if (!this.repairState.carWontStartTriggered){
                logger.log("   Hood interaction blocked: Try starting the car first.");
                this.interactionSystem.showMessage("Maybe I should try starting the car first.", 2000);

                return false;
            }

            logger.log("   Step 2: Triggering 'hood_stuck'.");

            this.narrativeManager.triggerEvent("stage3.hood_stuck");
            this.repairState.hoodStuckTriggered = true; 
            this.repairState.needsCrowbar = true;
            this.makeItemInteractable('crowbar');

            userData.prompt = "Need something to pry this open"; // interacted with hood, tell player to find something to pry hood open

            this.interactionSystem.updateCrosshair();
             return false;
        }

        // Crowbar logic
        if (!this.carInteraction.isHoodOpen && this.repairState.needsCrowbar){
            if (this.repairState.hasCrowbar) {
                // Player has crowbar so they can open the hood
                logger.log("   Step 3: Player has crowbar. Prying hood open.");

                this.repairState.justUsedCrowbar = true; 
                //this.audioManager.playSound('pry_hood', 'public/audio/sfx/hit_sound.mp3');  // Audio for playing crowbar sound

                userData.prompt = "Opening..."; 
                this.interactionSystem.updateCrosshair();

                this.narrativeManager.triggerEvent("stage3.need_engine_repair");
                return true;
            } 
            else{
                // No crowbar player needs the crowbar
                logger.log("   Hood still stuck, player needs crowbar."); 

                this.interactionSystem.showMessage("The hood is stuck fast. Need a crowbar.", 2000);
                userData.prompt = "Need something to pry this open"; 
                this.interactionSystem.updateCrosshair(); 

                return false;
            }
        }

        // Open and close for hood
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

    // Handler for E key press when player is in car
    async handleKeyPress(event) {
        // Only handle E key
        if (event.code !== 'KeyE') return;

        // Only handle if player is in car and ready to start
        if (!this.repairState.playerInCar || !this.repairState.carReadyTriggered) return;

        // Don't handle if QTE is already active
        if (this.qteManager.isActive()) return;

        // Don't handle if already triggered
        if (this.repairState.carStartQTETriggered) return;

        // Start the car ignition QTE
        logger.log("   Step 8: Player pressed E in car - Starting bouncing ring QTE for car ignition.");

        this.repairState.carStartQTETriggered = true;
        this.interactionSystem.showMessage("Starting the engine...", 2000);

        this.audioManager.playSound('car_ignition_attempt', 'public/audio/sfx/skill-check.mp3');

        await new Promise(resolve => setTimeout(resolve, 400));

        this.qteManager.startQTE('bouncingRing', {
            key: 'Space',
            duration: 15000,
            initialZoneSize: 60,
            requiredLoops: 6,
            indicatorSpeed: 220,
            onSuccess: () => this.onCarStartSuccess(),
            onFailure: () => this.onCarStartFailure()
        });
    }

    // handler for interactions with the engine when the hood is open
    async handleEngineInteraction(interactedObject, userData){
        logger.log(`Handling Engine Interaction via zone: ${interactedObject.name}. State: ${JSON.stringify(this.repairState)}`);

        // We have a QTE or hood is closed so you cant interact
        if (this.qteManager.isActive() || !this.carInteraction.isHoodOpen) return;

        // Hood hasnt been opened with the crowbar
        if (!this.repairState.hoodOpenedWithCrowbar){
            logger.warn("   Engine interaction blocked: Hood not properly opened.");
            this.interactionSystem.showMessage("Need to get the hood fully open first.", 2000);

            return;
        }

        // Engine repairing logic
        if (!this.repairState.needsEngineRepairTriggered){
            // Sequence for engine needing to be repaired is triggered
            this.repairState.needsEngineRepairTriggered = true;
            this.repairState.needsToolbox = true;

            this.makeItemInteractable('toolbox'); 
            this.updateEngineZonePrompt();
            this.interactionSystem.updateCrosshair();

            return;
        }

        if (this.repairState.needsToolbox && !this.repairState.engineRepaired){
            if (this.repairState.hasToolbox) {
                logger.log("   Player has toolbox. Starting repair QTE.");

                userData.interactable = false;
                this.interactionSystem.updateCrosshair();

                this.audioManager.playSound('fueling', 'public/audio/sfx/skill-check.mp3'); // skill check sound

                // trigger skillcheck
                await new Promise(resolve => setTimeout(resolve, 400));
                this.qteManager.startQTE('skillCheck', { 
                    key: 'KeyE',
                    duration: 7000,
                    successZoneSize: 30,
                    needleSpeed: 360,
                    onSuccess: () => this.onEngineRepairSuccess(userData),
                    onFailure: () => this.onEngineRepairFailure(userData)
                });
            }
            else{
                logger.log("   Engine needs repair, player needs toolbox."); 
                this.interactionSystem.showMessage("Need tools to fix this engine.", 2000);
                this.updateEngineZonePrompt(); 
                this.interactionSystem.updateCrosshair();
            }

            return;
        }

        
        // Car fueling logic
        if (this.repairState.engineRepaired && this.repairState.needsGasCan && !this.repairState.carFueled){
            if (this.repairState.hasGasCanBody && this.repairState.hasGasCanCap){
                logger.log("   Step 6: Player has gas can parts. Fueling car.");
                userData.interactable = false; this.interactionSystem.updateCrosshair();
                
                this.audioManager.playSound('fueling', 'public/audio/sfx/unlock-safe.mp3'); // Car fueling sound
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Fuel car up
                this.repairState.carFueled = true;
                this.repairState.needsGasCan = false;
                this.interactionSystem.showMessage("Fueled up!", 2000);
                
                // Remove Gas can from inventory
                userData.interactable = true;
                this.gameManager.removeFromInventory('Gas Can Body');
                this.gameManager.removeFromInventory('Gas Can Cap');
                this.updateEngineZonePrompt();
                
                // Start the car
                if (this.driverDoorZone) this.driverDoorZone.userData.prompt = "Press E to start car";
                
                // Engine is now fixed and fueled
                await this.narrativeManager.triggerEvent("stage3.is_engine_fixed");
                await this.narrativeManager.triggerEvent("stage3.test_car");
                this.interactionSystem.updateCrosshair();
            } 
            else{
                logger.log("   Car needs gas, player missing parts.");
                
                this.interactionSystem.showMessage("Need to find both parts of the gas can first.", 2000);
                this.updateEngineZonePrompt();
                this.interactionSystem.updateCrosshair();
            }

            return;
         }

        // Engine repaired and refueled
        logger.log("   Engine already repaired and fueled.");

        this.interactionSystem.showMessage("The engine looks ready.", 2000);
        this.updateEngineZonePrompt();
        this.interactionSystem.updateCrosshair();
    }

    // Handler for item pickups in the garage
    handleItemPickup(interactedObject, userData) {

        // QTE active so cant interact or pick things up
        if (this.qteManager.isActive()) return;

        const itemId = userData.itemId;
        const itemName = userData.itemName || itemId;
        let success = false; // flag for if a pickup was successfull

        // Picking up any gas can part should pick up all parts
        if (itemId === 'gas_can_body' || itemId === 'gas_can_cap') {
            logger.log(`Picking up gas can parts (triggered by ${itemName})`);

            // Check if inventory has space for *two* items if neither is held, or *one* if one is already held (though ideally they are picked together)
            const neededSlots = (this.repairState.hasGasCanBody || this.repairState.hasGasCanCap) ? 1 : 2;
            if (this.gameManager.inventory.length <= (10 - neededSlots)){
               
                // Add both gas can parts to the inventory if not already there
                if (!this.repairState.hasGasCanBody){
                    this.gameManager.addToInventory({
                        name: 'Gas Can Body',
                        type: 'gas_can_part',
                        id: 'gas_can_body',
                        description: 'The main body of the gas can.'
                    });
                    
                    this.repairState.hasGasCanBody = true;
                }

                if (!this.repairState.hasGasCanCap){
                    this.gameManager.addToInventory({
                        name: 'Gas Can Cap',
                        type: 'gas_can_part',
                        id: 'gas_can_cap', 
                        description: 'The cap for the gas can.'
                    });

                    this.repairState.hasGasCanCap = true;
                }

                // Gas can picked up so make them invisible and non-interactable
                if (this.gasCanBodyObject) {
                    this.gasCanBodyObject.visible = false;
                    this.gasCanBodyObject.userData.interactable = false;
                }

                if (this.gasCanCapObject) {
                    this.gasCanCapObject.visible = false;
                    this.gasCanCapObject.userData.interactable = false;
                }

                success = true;

                this.audioManager.playSound('pickup_gas', 'public/audio/sfx/wood-block.mp3'); //ToDo Gascan pickup sound
                this.interactionSystem.showMessage("Picked up Gas Can parts", 2000); 
            } 
            else{
                // Inventory is full
                logger.warn(`   Inventory full, could not pick up gas can parts.`);
                this.interactionSystem.showMessage("Inventory full!", 2000);
            }
        }
        else{
            // All other item pickup logic
            logger.log(`Picking up item: ${itemName} (ID: ${itemId})`);

            success = this.gameManager.addToInventory({ 
                name: itemName,
                type: userData.type,
                id: itemId,
                description: `A ${itemName}. Might be useful.`
            });

            if (success){
                if (itemId === 'crowbar') this.repairState.hasCrowbar = true;
                if (itemId === 'toolbox') this.repairState.hasToolbox = true;

                interactedObject.visible = false;
                interactedObject.userData.interactable = false;
                this.audioManager.playSound('pickup', 'public/audio/sfx/unlock-door.mp3'); // ToDo Item pickup sound for objects
            } 
            else{
                logger.warn(`   Inventory full, could not pick up ${itemName}.`);
                this.interactionSystem.showMessage("Inventory is full!", 2000);
            }
        }

        // Update UI if pickup was successfull
        if (success) {
            this.updateHoodPrompt();
            this.updateEngineZonePrompt();
            this.updateDriverDoorPrompt();
            this.interactionSystem.updateCrosshair(); // Ensure crosshair updates after state changes
        }
    }


    // QTE callbacks (SkillCheck success or failure for engine repair)
    async onEngineRepairSuccess(engineZoneUserData) {
        logger.log('Engine Repair QTE Success!');

        this.repairState.engineRepaired = true;
        this.repairState.needsToolbox = false;
        this.interactionSystem.showMessage("Engine repaired!", 2000);

        engineZoneUserData.interactable = true; 
        this.updateEngineZonePrompt();

        await this.narrativeManager.triggerEvent("stage3.is_engine_fixed"); 
        await this.narrativeManager.triggerEvent("stage3.test_car");

        if (this.driverDoorZone) this.driverDoorZone.userData.prompt = "Try starting the car again";

        this.interactionSystem.updateCrosshair();
    }

    onEngineRepairFailure(engineZoneUserData) {
        // fail so play QTE event gagain
        logger.log('Engine Repair QTE Failure.');

        this.interactionSystem.showMessage("Repair failed... Try again.", 2000);

        engineZoneUserData.prompt = "Try repair again";
        engineZoneUserData.interactable = true;
        this.interactionSystem.updateCrosshair();
    }

    // QTE callbacks for car ignition (bouncing ring success or failure)
    async onCarStartSuccess() {
        logger.log('Car Start QTE Success! Engine started. Now starting drive sequence...');

        this.audioManager.playSound('car_starting', 'public/audio/sfx/car-starting.mp3');
        this.interactionSystem.showMessage("The engine roars! Now drive!", 3000);

        // Wait a moment then trigger the rhythm game QTE for driving
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.repairState.carDriveQTETriggered && this.gameManager.gameState !== 'lost') {
            this.onStartDriveQTE();
        }
    }

    async onStartDriveQTE() {
        logger.log('   Step 9: Starting rhythm game QTE for shifting gears.');

        this.repairState.carDriveQTETriggered = true;

        this.interactionSystem.showMessage("Shift gears with arrow keys!", 3000);

        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate a sequence of 4 arrow keys for gear shifting
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        const noteSequence = [];
        for (let i = 0; i < 4; i++) {
            noteSequence.push(arrowKeys[Math.floor(Math.random() * arrowKeys.length)]);
        }

        this.qteManager.startQTE('rhythmGame', {
            noteSequence: noteSequence,
            noteSpeed: 180, // Base speed, will increase per note
            noteSpeedIncrease: 40, // Speed increases by 40 pixels/sec per note
            hitZoneStart: 400,
            hitZoneSize: 100,
            duration: 15000,
            onSuccess: () => this.onGearShiftSuccess(),
            onFailure: () => this.onGearShiftFailure()
        });
    }

    async onGearShiftSuccess() {
        logger.log('Gear Shift QTE Success! Ready to drive!');

        this.audioManager.playSound('gear_shift', 'public/audio/sfx/car-starting.mp3');
        this.interactionSystem.showMessage("Press SPACE to drive!", 5000);

        // Wait for space key press
        this.waitingForSpaceToDrive = true;
    }

    async onGearShiftFailure() {
        logger.log('Gear Shift QTE Failure. Grinding gears...');

        this.interactionSystem.showMessage("Grinded the gears! Retrying...", 2000);

        // Wait a moment then retry automatically
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reset and restart the QTE
        this.repairState.carDriveQTETriggered = false;

        if (this.gameManager.gameState !== 'lost') {
            this.onStartDriveQTE();
        }
    }

    // Handle space key press for driving out
    handleSpacePress(event) {
        if (event.code !== 'Space') return;
        if (!this.waitingForSpaceToDrive) return;

        logger.log('Space pressed - Starting escape sequence!');
        this.waitingForSpaceToDrive = false;

        this.startEscapeSequence();
    }

    async startEscapeSequence() {
        logger.log('Starting escape sequence - driving out!');

        this.audioManager.playSound('car_accelerate', 'public/audio/sfx/car-starting.mp3');
        this.interactionSystem.showMessage("GO GO GO!", 3000);

        // Get the car object, player, and camera
        const car = this.carObject;
        const player = this.physicsManager;
        const camera = this.camera;

        if (!car) {
            logger.error('Car object not found for escape sequence!');
            this.gameManager.onGameWon("You escaped the garage!");
            return;
        }

        // Freeze player controls during escape
        if (player && player.controls) {
            player.controls.freeze();
            logger.log('   Player controls frozen for escape sequence');
        }

        // Disable player physics collider to prevent glitching
        if (player && player.playerCollider) {
            player.playerCollider.setEnabled(false);
            logger.log('   Player physics collider disabled for escape sequence');
        }

        // Disable automatic camera sync to prevent fighting with manual camera control
        const originalSkipCameraSync = player.skipCameraSync || false;
        if (player) {
            player.skipCameraSync = true;
            logger.log('   Camera sync disabled for escape sequence');
        }

        // Define the path from current car position to outside (longer drive)
        const startPos = car.position.clone(); // Start from wherever the car currently is
        const endPos = new THREE.Vector3(12.55, car.position.y, 30.0); // Extended much farther out

        logger.log(`Car escape path: (${startPos.x.toFixed(2)}, ${startPos.z.toFixed(2)}) → (${endPos.x.toFixed(2)}, ${endPos.z.toFixed(2)})`);
        logger.log(`   Drive distance: ${startPos.distanceTo(endPos).toFixed(2)} units`);

        // Update car's world matrix
        car.updateMatrixWorld(true);

        // Parent camera to Driver_pos so it automatically moves with the car
        let originalCameraParent = null;
        let originalCameraPosition = null;
        let originalCameraRotation = null;

        if (camera && this.driverPosObject) {
            // Store original camera state for potential restoration
            originalCameraParent = camera.parent;
            originalCameraPosition = camera.position.clone();
            originalCameraRotation = camera.rotation.clone();

            // Get current camera world position to calculate local offset
            const cameraWorldPos = camera.position.clone();

            // Parent camera to Driver_pos (this maintains world position automatically)
            this.driverPosObject.attach(camera);

            logger.log(`Camera parented to Driver_pos`);
            logger.log(`   Camera local position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
        }

        // Animate car moving along the path
        const startTime = performance.now();
        const duration = 4000; // 4 seconds to drive out

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = progress * progress; // Ease in (accelerating)

            // Interpolate car position along the path
            car.position.lerpVectors(startPos, endPos, easedProgress);

            // IMPORTANT: Update car's world matrix so children (driver_pos and camera) move with it
            car.updateMatrixWorld(true);

            // Camera moves automatically with Driver_pos, no need to manually position it
            // Just log progress for debugging
            if (Math.floor(progress * 100) % 10 === 0 && progress > 0) {
                const cameraWorldPos = new THREE.Vector3();
                camera.getWorldPosition(cameraWorldPos);
                logger.log(`Frame ${Math.floor(progress * 100)}%: Camera at (${cameraWorldPos.x.toFixed(2)}, ${cameraWorldPos.y.toFixed(2)}, ${cameraWorldPos.z.toFixed(2)})`);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Escape complete - fade to ending
                this.triggerEnding();
            }
        };

        animate();
    }

    triggerEnding() {
        logger.log('Triggering ending sequence...');

        // Fade to black
        const fadeOverlay = document.createElement('div');
        fadeOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            opacity: 0;
            transition: opacity 2s;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(fadeOverlay);

        setTimeout(() => {
            fadeOverlay.style.opacity = '1';
        }, 100);

        // Trigger narrative escape event, then show thank you message
        setTimeout(async () => {
            // Trigger the narrative escape ending event
            if (this.narrativeManager) {
                try {
                    await this.narrativeManager.triggerEvent("endings.escape");
                    logger.log('Narrative escape event triggered');
                } catch (error) {
                    logger.warn('Could not trigger narrative escape event:', error);
                }
            }

            // Show thank you message before credits
            this.showThankYouScreen();
        }, 2500);
    }

    showThankYouScreen() {
        logger.log('Showing thank you screen...');

        // Create thank you overlay
        const thankYouOverlay = document.createElement('div');
        thankYouOverlay.id = 'thank-you-overlay';
        thankYouOverlay.tabIndex = 0; // Make it focusable
        thankYouOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            color: white;
            font-family: 'Courier New', monospace;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000000;
            opacity: 0;
            transition: opacity 1s;
            text-align: center;
            padding: 40px;
            cursor: pointer;
        `;

        thankYouOverlay.innerHTML = `
            <div style="max-width: 800px;">
                <h1 style="font-size: 64px; margin-bottom: 40px; font-weight: bold; color: #4CAF50;">
                    YOU ESCAPED!
                </h1>

                <p style="font-size: 32px; margin-bottom: 60px; line-height: 1.6;">
                    Thank you for playing
                </p>

                <p style="font-size: 20px; opacity: 0.7; animation: pulse 2s ease-in-out infinite;">
                    Click anywhere or press any key to continue
                </p>
            </div>

            <style>
                @keyframes pulse {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 0.3; }
                }
            </style>
        `;

        document.body.appendChild(thankYouOverlay);

        // Fade in
        setTimeout(() => {
            thankYouOverlay.style.opacity = '1';
            thankYouOverlay.focus(); // Focus on the overlay
        }, 100);

        // Handle any input to proceed to main menu
        const proceedToMainMenu = () => {
            logger.log('Returning to main menu...');

            // Fade out thank you screen
            thankYouOverlay.style.opacity = '0';

            setTimeout(() => {
                // Remove thank you overlay
                if (thankYouOverlay.parentNode) {
                    thankYouOverlay.parentNode.removeChild(thankYouOverlay);
                }

                // Show credits screen
                this.showCreditsScreen();
            }, 1000);

            // Remove listeners
            thankYouOverlay.removeEventListener('click', proceedToMainMenu);
            document.removeEventListener('keydown', proceedToMainMenu);
        };

        // Add listeners for any input
        thankYouOverlay.addEventListener('click', proceedToMainMenu);
        document.addEventListener('keydown', proceedToMainMenu);

        logger.log('Thank you screen displayed');
    }

    showCreditsScreen() {
        logger.log('Showing credits screen...');

        // Get the existing credits screen from UIManager
        const creditsScreen = document.getElementById('credits-screen');
        const closeButton = document.getElementById('close-credits-btn');

        if (creditsScreen) {
            // Ensure element is in DOM and force visibility (similar to hit border overlay pattern)
            if (!document.body.contains(creditsScreen)) {
                document.body.appendChild(creditsScreen);
            }

            // Show the credits screen with high z-index to be on top of everything
            creditsScreen.classList.remove('hidden');
            creditsScreen.style.position = 'fixed';
            creditsScreen.style.zIndex = '999999'; // Higher than fade overlay (10000)
            creditsScreen.style.display = 'flex';
            creditsScreen.style.opacity = '1';
            creditsScreen.style.cursor = 'pointer';
            creditsScreen.tabIndex = 0; // Make it focusable

            // Focus on the credits screen
            setTimeout(() => {
                creditsScreen.focus();
            }, 100);

            // Replace back button with "return to menu" message
            if (closeButton) {
                closeButton.style.display = 'block';
                closeButton.textContent = 'Click anywhere or press any key to return to menu';
                closeButton.style.pointerEvents = 'none'; // Disable clicking just the button
                closeButton.style.cursor = 'default';
            }

            logger.log('Credits screen displayed');
            logger.log(`   Z-index: ${creditsScreen.style.zIndex}`);
            logger.log(`   Display: ${creditsScreen.style.display}`);

            // Handle any input to return to main menu
            const returnToMenu = () => {
                logger.log('Returning to main menu...');

                // Fade out credits
                creditsScreen.style.opacity = '0';

                setTimeout(() => {
                    // Reload the page to return to main menu
                    // This ensures a clean state reset
                    logger.log('🔄 Reloading to main menu...');
                    location.reload();
                }, 1000);

                // Remove listeners to prevent multiple triggers
                creditsScreen.removeEventListener('click', returnToMenu);
                document.removeEventListener('keydown', returnToMenu);
            };

            // Add listeners for any input
            creditsScreen.addEventListener('click', returnToMenu);
            document.addEventListener('keydown', returnToMenu);

        } else {
            logger.error('Credits screen element not found!');
        }

        // Update game state to won
        if (this.gameManager && this.gameManager.gameState !== 'lost') {
            this.gameManager.gameState = 'won';
            logger.log('Game won - credits displayed');
        }
    }

    async onCarStartFailure() {
        logger.log('Car Start QTE Failure. Engine won\'t start...');

        this.interactionSystem.showMessage("The engine sputtered and died... Retrying...", 2000);

        // Wait a moment then retry automatically
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reset and restart the QTE
        this.repairState.carStartQTETriggered = false;

        if (this.repairState.playerInCar && this.gameManager.gameState !== 'lost') {
            // Restart the car start QTE
            this.handleKeyPress({ code: 'KeyE' });
        }
    }

    // Spawn Annie doll in the car at Annie_spot
    spawnAnnieInCar() {
        logger.log('🎎 Player has Annie in inventory - spawning her in the car...');

        // Find Annie doll object in the scene
        const annieDoll = this.stageManager.currentScene.getObjectByName('Annie');
        const annieSpot = this.stageManager.currentScene.getObjectByName('Annie_spot');

        if (!annieDoll) {
            logger.warn('   Annie doll object not found in scene');
            return;
        }

        if (!annieSpot) {
            logger.warn('   Annie_spot not found in scene - Annie will not be positioned');
            return;
        }

        // Get Annie_spot's world position
        const anniePos = new THREE.Vector3();
        annieSpot.getWorldPosition(anniePos);

        // Position Annie at the spot
        annieDoll.position.copy(anniePos);
        annieDoll.visible = true; // Make sure she's visible

        // Scale Annie down by half
        annieDoll.scale.set(0.5, 0.5, 0.5);

        // Rotate Annie 90 degrees on Y axis
        annieDoll.rotation.y += -Math.PI/2; // 90 degrees in radians

        // Parent Annie to the car so she moves with it during escape
        if (this.carObject) {
            this.carObject.attach(annieDoll);
            logger.log(`   ✓ Annie positioned, scaled to 0.5, and parented to car`);
            logger.log(`   Annie local position: (${annieDoll.position.x.toFixed(2)}, ${annieDoll.position.y.toFixed(2)}, ${annieDoll.position.z.toFixed(2)})`);
        } else {
            logger.warn('   Car object not found - Annie will not move with car');
        }
    }

    // helper making items interactable
    makeItemInteractable(itemId) {
        let itemObject = null; 
        let stateFlag = false;

        if (itemId === 'crowbar'){
            itemObject = this.crowbarObject;
            stateFlag = this.repairState.hasCrowbar;
        }
        else if (itemId === 'toolbox'){
            itemObject = this.toolboxObject;
            stateFlag = this.repairState.hasToolbox; 
        }
        else if (itemId === 'gas_can_body'){
            itemObject = this.gasCanBodyObject; 
            stateFlag = this.repairState.hasGasCanBody;
        }
        else if (itemId === 'gas_can_cap'){
             itemObject = this.gasCanCapObject;
            stateFlag = this.repairState.hasGasCanCap;
        }


        if (itemObject && itemObject.userData && !stateFlag && itemObject.visible){
            itemObject.userData.interactable = true;
            logger.log(`   Made item interactable: ${itemId}`);
        } 
        else if (!itemObject){
            logger.warn(`   Could not make item interactable: ${itemId} (not found)`);
        }
    }

    // Engine is interacable logic
    makeEngineInteractable() {
         // Engine should only be interactable if hood was opened with crowbar AND hood is currently open
         const canInteract = this.repairState.hoodOpenedWithCrowbar && this.carInteraction.isHoodOpen;

        if (this.engineZone && this.engineZone.userData){
             this.engineZone.userData.interactable = canInteract;

            if (canInteract){
                this.updateEngineZonePrompt(); 
                logger.log('   Engine zone interactable.');
            }
            else{
                this.engineZone.userData.prompt = "";  // engine not interactble at this moment so clear the prompt
                logger.log('   Engine zone NOT interactable (hood not opened correctly or closed).');
            }

            this.interactionSystem.updateCrosshair();
        }
    }

    // Engine is not interactable logic
    makeEngineNonInteractable(){
        if (this.engineZone && this.engineZone.userData) {
            this.engineZone.userData.interactable = false;
            this.engineZone.userData.prompt = ""; // Clear the prompt
            
            logger.log('   Engine zone non-interactable.');
            this.interactionSystem.updateCrosshair();
         }
    }

    // Interactable Engine zone prompt update
    updateEngineZonePrompt() {
         if (!this.engineZone?.userData) return;

        // Hood is closed so you cant interact with the engine
        if (!this.carInteraction.isHoodOpen || !this.repairState.hoodOpenedWithCrowbar) {
             this.engineZone.userData.prompt = "";
   

            if (!this.carInteraction.isHoodOpen) {
                this.engineZone.userData.interactable = false;
            }
            
            return;
        }

        // Engine needs to be repaired, you either have the tools or you dont
        if (!this.repairState.engineRepaired){
            this.engineZone.userData.prompt = this.repairState.hasToolbox ? "Press E to repair engine" : "Need tools to fix this"; 
        }
        else if (this.repairState.engineRepaired && !this.repairState.needsGasTriggered) {
            // Engine is repaired but you need to interact with the car door to know that it needs fuel
            this.engineZone.userData.prompt = "Engine looks repaired"; 
        }
        else if (!this.repairState.carFueled) {
            // Engine needs to be fueled player either has the gas can or doesnt
            this.engineZone.userData.prompt = (this.repairState.hasGasCanBody && this.repairState.hasGasCanCap) ? "Press E to add fuel" : "Need fuel";
        }
        else{
            this.engineZone.userData.prompt = "Engine looks ready";
        }
    }

    // Hood interaction prompt logic
    updateHoodPrompt() {
        // No hood
        if (!this.hoodObject?.userData) return;

        // Player interacted with the driver door for the first time - allows the rest of repair flow
        if(!this.repairState.driverDoorInteractedFirstTime)this.repairState.driverDoorInteractedFirstTime = true;

        // Hood closed: follow flow of events
        if (!this.carInteraction.isHoodOpen) {
            if (this.repairState.needsCrowbar && !this.repairState.hasCrowbar){
                this.hoodObject.userData.prompt = "Need something to pry this open";
            }
            else if (this.repairState.needsCrowbar && this.repairState.hasCrowbar){
                this.hoodObject.userData.prompt = "Press E to pry open hood";
            }
            else if (this.repairState.carWontStartTriggered){
                this.hoodObject.userData.prompt = "Press E to open hood";
            }
            else{
                this.hoodObject.userData.prompt = "";
            } 
        } 
        else{
            this.hoodObject.userData.prompt = "Press E to close hood"; // Hood open so you can close it
        }
     }

     // Driver side door interaction prompt flow
     updateDriverDoorPrompt(){
        // No door
        if (!this.driverDoorZone?.userData) return;

        if (this.repairState.playerInCar && this.repairState.carReadyTriggered){
            this.driverDoorZone.userData.prompt = "Press E to start engine";
        }
        else if (this.repairState.carReadyTriggered){
            this.driverDoorZone.userData.prompt = "Press E to enter car";
        }
        else if (this.repairState.engineRepaired && this.repairState.carFueled){
            this.driverDoorZone.userData.prompt = "Press E to enter car";
        }
        else if (this.repairState.engineRepaired && this.repairState.needsGasTriggered){
            this.driverDoorZone.userData.prompt = this.repairState.hasGasCanBody && this.repairState.hasGasCanCap ? "Fuel the car first" : "Find gas can parts";
        }
        else if (this.repairState.engineRepaired && !this.repairState.needsGasTriggered){
            this.driverDoorZone.userData.prompt = "Try starting the car again";
        }
        else if (this.repairState.hoodOpenedWithCrowbar && !this.repairState.engineRepaired){
            this.driverDoorZone.userData.prompt = this.repairState.hasToolbox ? "Repair the engine first" : "Find tools for the engine";
        }
        else if (this.repairState.hoodStuckTriggered){
            this.driverDoorZone.userData.prompt = this.repairState.hasCrowbar ? "Pry open the hood first" : "Find a crowbar for the hood";
        }
        else if (this.repairState.carWontStartTriggered){
            this.driverDoorZone.userData.prompt = "Check under the hood";
        }
        else{
            this.driverDoorZone.userData.prompt = "Press E to enter car";
        }
    }

    consumeCrowbar(){
        logger.log('   Crowbar used on hood.');
    }

    /**
     * Disables all car-related interactions except the steering wheel.
     * Called when player enters the car.
     */
    disableOtherInteractions() {
        logger.log('🚗 Disabling all interactions except steering wheel...');

        // Disable driver door zone
        if (this.driverDoorZone && this.driverDoorZone.userData) {
            this.driverDoorZone.userData.interactable = false;
            logger.log('   Disabled driver door zone');
        }

        // Disable engine zone
        if (this.engineZone && this.engineZone.userData) {
            this.engineZone.userData.interactable = false;
            logger.log('   Disabled engine zone');
        }

        // Disable hood - also close it if open
        if (this.hoodObject && this.hoodObject.userData) {
            this.hoodObject.userData.interactable = false;
            // Force hood to stay non-interactable by marking player as in car
            this.hoodObject.userData.playerInCar = true;
            logger.log('   Disabled hood');
        }

        // Disable all garage items
        if (this.crowbarObject && this.crowbarObject.userData) {
            this.crowbarObject.userData.interactable = false;
        }
        if (this.toolboxObject && this.toolboxObject.userData) {
            this.toolboxObject.userData.interactable = false;
        }
        if (this.gasCanBodyObject && this.gasCanBodyObject.userData) {
            this.gasCanBodyObject.userData.interactable = false;
        }
        if (this.gasCanCapObject && this.gasCanCapObject.userData) {
            this.gasCanCapObject.userData.interactable = false;
        }

        logger.log('   All interactions disabled except steering wheel');

        // Update crosshair to reflect changes
        this.interactionSystem.updateCrosshair();
    }

    onHoodAnimationComplete(isOpen){
        logger.log(`🚗 Hood animation complete. New state isOpen: ${isOpen}`);

        
        if (isOpen) {
            // Hood just finished OPENING
            if (this.repairState.justUsedCrowbar){
                logger.log("   Hood successfully pried open with crowbar."); // hood opened for the first time with the crowbar

                this.repairState.hoodOpenedWithCrowbar = true;
                this.repairState.needsCrowbar = false;
                this.repairState.justUsedCrowbar = false;

                // Make engine interactable 
                this.makeEngineInteractable(); 
            }
            else if (this.repairState.hoodOpenedWithCrowbar) {
                // Hood was already opened correctly before, just reopening it
                logger.log("   Hood reopened. Ensuring engine zone is interactable and prompt is updated.");
                this.makeEngineInteractable(); // Re-enable interaction and update prompt
            } 
            else{
                // General hood interaction 
                this.updateEngineZonePrompt(); 

                if(this.engineZone && this.engineZone.userData) {
                    this.engineZone.userData.interactable = this.repairState.hoodOpenedWithCrowbar;
                }

            }
        } 
        else{
            // Hood just finished CLOSING
            this.makeEngineNonInteractable(); // Disable interaction and clear prompt
        }

        // update hood prompt to be close or open
        this.updateHoodPrompt();

        this.updateDriverDoorPrompt();
        this.interactionSystem.updateCrosshair(); 
    }

    dispose() {
        logger.log("🧹 Disposing CarRepairSystem...");

        // Remove key listeners
        if (this.boundHandleKeyPress) {
            window.removeEventListener('keydown', this.boundHandleKeyPress);
        }
        if (this.boundHandleSpacePress) {
            window.removeEventListener('keydown', this.boundHandleSpacePress);
        }

        if (this.engineZone && this.engineZoneMesh && this.engineZone.children.includes(this.engineZoneMesh)){
             this.engineZone.remove(this.engineZoneMesh);

             if (this.engineZoneMesh.geometry) this.engineZoneMesh.geometry.dispose(); // Dispose geometry
             // Material is shared, no need to dispose here
             logger.log("   Removed engine zone mesh.");
        }

        if (this.driverDoorZone && this.driverDoorZoneMesh && this.driverDoorZone.children.includes(this.driverDoorZoneMesh)){
             this.driverDoorZone.remove(this.driverDoorZoneMesh);
             if (this.driverDoorZoneMesh.geometry) this.driverDoorZoneMesh.geometry.dispose(); // Dispose geometry
             logger.log("   Removed driver door zone mesh.");
        }
        
        this.registerInteractionHandler('car_driver_door_zone', null);
        this.registerInteractionHandler('car_engine_zone', null);
        this.registerInteractionHandler('crowbar', null);
        this.registerInteractionHandler('toolbox', null); 
        this.registerInteractionHandler('gas_can_part', null);

        if(this.carInteraction){
           this.carInteraction.registerHoodInteractionCallback(null); 
           this.carInteraction.registerHoodAnimationCompleteCallback(null);
        }


        this.carObject=this.hoodObject=this.engineZone=this.driverDoorZone=this.crowbarObject=this.toolboxObject=this.gasCanBodyObject=this.gasCanCapObject=this.engineZoneMesh=this.driverDoorZoneMesh = null;
    }
}

