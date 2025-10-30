// src/systems/InteractionSystem.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import { AnnieInteraction } from '../interactions/AnnieInteraction.js';

class InteractionSystem {
   constructor(camera, scene, gameManager, uiManager, controls, audioManager, stageManager = null) {
        this.camera = camera;
        this.scene = scene; // Fallback scene for single-scene mode
        this.stageManager = stageManager; // For multi-scene support
        this.gameManager = gameManager;
        this.uiManager = uiManager; // uiManager was missing from the original constructor but is used, so I've added it.
        this.controls = controls; // NEW: Store the controls object
        this.audioManager = audioManager; // NEW: Store the audio manager
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactableObjects = new Map();
        this.highlightedObject = null;
        this.currentInteraction = null;
        this.interactionRange = 2.5; // Maximum interaction distance

        // Performance: Throttle crosshair raycasting
        this.crosshairUpdateCounter = 0;
        this.crosshairUpdateInterval = 2; // Update every 2nd frame

        this.messageQueue = []; // NEW: A queue for interaction messages.
        this.isMessageVisible = false; // NEW: A flag to check visibility.
        this.blockInteractionPrompt = false; // Flag to block interaction prompts during important messages
        this.hasSeenPageExplanation = false; // Track if player has seen the first page explanation popup
        this.isColorPuzzleSolved = false;
        this.justClosedUI = false; // Prevent immediate re-interaction after closing UI

        // Sofa movement system
        this.movingSofa = null; // Currently moving sofa
        this.sofaMovementSpeed = 0.01; // Units per frame (slow movement)
        this.sofaMaxMovement = 1; // Maximum distance to move (0.5 units)
        this.isEKeyHeld = false; // Track if E key is held

        // Hiding system
        this.isHiding = false; // Is player currently hiding
        this.currentHidingSpot = null; // Current wardrobe object player is in
        this.hideStartTime = 0; // When player started hiding
        this.hideTimer = null; // Timer for aggression decrease
        this.monsterInvestigationTriggered = false; // Track if monster has investigated this hiding session
        this.monsterAggroReductionTriggered = false; // Track if aggro reduction has occurred
        this.hideOverlay = null; // Visual overlay for hiding
        this.originalCameraPosition = null; // Store player's position before hiding
        this.originalCameraQuaternion = null; // Store player's rotation before hiding
        this.lockedCameraPosition = null; // Camera position while hiding (locked)
        this.lockedCameraQuaternion = null; // Camera rotation while hiding (locked)
        this.flashlightWasOn = false; // Track if flashlight was on before hiding

        // UI Elements
        this.crosshair = null;
        this.interactionPrompt = null;
        this.puzzleUI = null;

        // Initialize Annie interaction handler
        this.annieInteraction = new AnnieInteraction(this);

        this.setupEventListeners();
        this.createUI();
        this.registerInteractionTypes();
    }

    setupEventListeners() {
        // Mouse events
        document.addEventListener('click', this.onMouseClick.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Touch events for mobile
        document.addEventListener('touchstart', this.onTouchStart.bind(this));
        document.addEventListener('touchend', this.onTouchEnd.bind(this));
    }

    createUI() {
        this.createCrosshair();
        this.createInteractionPrompt();
        this.createPuzzleUI();
    }

    createCrosshair() {
        this.crosshair = document.createElement('div');
        this.crosshair.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 4px;
            height: 4px;
            background: white;
            border: 2px solid rgba(255,255,255,0.8);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 999;
            transition: all 0.2s ease;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(this.crosshair);
    }

    createInteractionPrompt() {
        this.interactionPrompt = document.createElement('div');
        this.interactionPrompt.style.cssText = `
            position: fixed;
            bottom: 40%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 20px;
            border: 2px solid #666;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            text-align: center;
            display: none;
            pointer-events: none;
            z-index: 998;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            box-shadow: 0 4px 8px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(this.interactionPrompt);
    }

    createPuzzleUI() {
        this.puzzleUI = document.createElement('div');
        this.puzzleUI.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 30px;
            border: 3px solid #888;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            display: none;
            pointer-events: auto;
            z-index: 1000;
            max-width: 500px;
            min-width: 300px;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
        `;

        this.puzzleUI.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        document.body.appendChild(this.puzzleUI);
    }

    registerInteractionTypes() {
        // Register different types of interactions
        this.interactionTypes = {
            page: {
                prompt: "Press E to take the page",
                handler: this.handlePageInteraction.bind(this)
            },
            page_slot: {
                prompt: "Press E to place page",
                promptWithPage: "Press E to take the page",
                handler: this.handlePageSlotInteraction.bind(this)
            },
            telephone: {
                prompt: "[E] Answer Phone",
                handler: this.handleTelephoneInteraction.bind(this)
            },
            laptop: {
                prompt: "Press E to use laptop",
                handler: this.handleLaptopInteraction.bind(this)
            },
            door: {
                prompt: "Press E to open door",
                lockedPrompt: "Door is locked - need key",
                handler: this.handleDoorInteraction.bind(this)
            },
            key: {
                prompt: "Press E to pick up key",
                handler: this.handleKeyInteraction.bind(this)
            },
            puzzle: {
                prompt: "Press E to examine puzzle",
                handler: this.handlePuzzleInteraction.bind(this)
            },
            furniture: {
                prompt: "Press E to search",
                handler: this.handleFurnitureInteraction.bind(this)
            },
            book: {
                prompt: "Press E to read book",
                handler: this.handleBookInteraction.bind(this)
            },
            safe: {
                prompt: "Press E to open safe",
                lockedPrompt: "Safe is locked - enter combination",
                handler: this.handleSafeInteraction.bind(this)
            },
            mirror: {
                prompt: "Press E to adjust mirror",
                handler: this.handleMirrorInteraction.bind(this)
            },
            pressure_plate: {
                prompt: "Place objects here",
                handler: this.handlePressurePlateInteraction.bind(this)
            },
            weight_object: {
                prompt: "Press E to pick up",
                handler: this.handleWeightObjectInteraction.bind(this)
            },
            clock: {
                prompt: "Press E to set time",
                handler: this.handleClockInteraction.bind(this)
            },
            symbol: {
                prompt: "Press E to pick up symbol",
                handler: this.handleSymbolInteraction.bind(this)
            },
            symbol_slot: {
                prompt: "Place symbol here",
                handler: this.handleSymbolSlotInteraction.bind(this)
            },
            scroll: {
                prompt: "Press E to read scroll",
                handler: this.handleScrollInteraction.bind(this)
            },
            escape_portal: {
                prompt: "Press E to escape!",
                handler: this.handleEscapePortal.bind(this)
            },
            fuse_box: {
                prompt: "Press E to fix the fuse box",
                fixedPrompt: "The fuse box is working",
                handler: this.handleFuseBoxInteraction.bind(this)
            },
            entrance_door: {
                prompt: "Press E to open the door",
                handler: this.handleEntranceDoorInteraction.bind(this)
            },
            diary: {
                prompt: "Press E to read the diary",
                handler: this.handleDiaryInteraction.bind(this)
            },
            fireplace: {
                prompt: "Press E to inspect the fireplace",
                handler: this.handleFireplaceInteraction.bind(this)
            },
            keypad: {
                prompt: "Press E to use keypad",
                handler: this.handleKeypadInteraction.bind(this)
            },
            bucket: {
                prompt: "Press E to pick up bucket",
                handler: this.handleBucketInteraction.bind(this)
            },
            sofa: {
                prompt: "Hold E to push sofa",
                movedPrompt: "Sofa won't move any further",
                pushingPrompt: "Pushing... (Hold E)",
                handler: this.handleSofaInteraction.bind(this)
            },
            wardrobe: {
                prompt: "Press E to hide",
                hidingPrompt: "Press E to exit",
                handler: this.handleWardrobeInteraction.bind(this)
            },
            tic_tac_toe_mirror: {
                prompt: "Press E to play the haunted mirror game",
                unlockedPrompt: "The mirror gleams peacefully",
                handler: this.handleTicTacToeMirrorInteraction.bind(this)
            },
            computer: {
                prompt: "Press E to use computer",
                handler: this.handleComputerInteraction.bind(this)
            },
            notepad: {
                prompt: "Press E to read notepad",
                handler: this.handleNotepadInteraction.bind(this)
            },
            newspaper: {
                prompt: "Press E to read newspaper",
                handler: this.handleNewspaperInteraction.bind(this)
            },
            loose_book: {
                prompt: "Press E to examine book",
                handler: this.handleLooseBookInteraction.bind(this)
            }
        };
    }

    onMouseClick(event) {
         // If controls are frozen for a puzzle, do nothing.
        if (this.controls && this.controls.isFrozen) {
            return;
        }

        if (this.currentInteraction) return;

        // Prevent immediate re-interaction after closing UI
        if (this.justClosedUI) {
            console.log('[InteractionSystem] Ignoring click - just closed UI');
            return;
        }

        this.checkInteraction();
    }

    onMouseMove(event) {
        // Update mouse position for raycasting
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyE':
                // Special handling for hiding - allow E key to exit
                if (this.isHiding) {
                    this.exitHiding();
                    return;
                }

                if (this.controls && this.controls.isFrozen) {
                    return;
                }

                // Set E key held state
                this.isEKeyHeld = true;

                if (!this.currentInteraction) {
                    this.checkInteraction();
                }
                break;
            case 'Escape':
                this.closePuzzleUI();
                break;
            case 'Tab':
                event.preventDefault();
                this.showNearbyInteractables();
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyE':
                // Release E key
                this.isEKeyHeld = false;

                // Stop moving sofa if currently moving
                if (this.movingSofa) {
                    this.showMessage(`Stopped pushing sofa. Moved ${this.movingSofa.distanceMoved.toFixed(2)} units.`);
                    this.movingSofa = null;

                    // Clear the interaction state
                    if (this.currentInteraction === 'sofa_movement') {
                        this.currentInteraction = null;
                    }
                }
                break;
        }
    }

    onTouchStart(event) {
        // Handle touch for mobile devices
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        }
    }

    onTouchEnd(event) {
        if (!this.currentInteraction) {
            this.checkInteraction();
        }
    }

    getCurrentScene() {
        // Get the current scene - use stageManager if available, otherwise use this.scene
        if (this.stageManager) {
            return this.stageManager.getCurrentScene();
        }
        return this.scene;
    }

    checkInteraction() {
        // Cast ray from camera center
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const currentScene = this.getCurrentScene();
        const intersects = this.raycaster.intersectObjects(currentScene.children, true);

        console.log('🎯 checkInteraction: ' + intersects.length + ' intersections found');

        if (intersects.length > 0) {
            // Log first 3 intersections
            for (let i = 0; i < Math.min(3, intersects.length); i++) {
                const interactData = this.findInteractableData(intersects[i].object);
                console.log(`  [${i}] ${intersects[i].object.name} - type: ${interactData?.data?.type}, distance: ${intersects[i].distance.toFixed(2)}`);
            }

            // PRIORITY: Check if mirror is in the raycast hits (prioritize mirror over page 6)
            let intersectedObject = intersects[0].object;
            let distance = intersects[0].distance;

            let mirrorHit = null;
            for (let i = 0; i < intersects.length; i++) {
                const interactData = this.findInteractableData(intersects[i].object);
                if (interactData?.data?.type === 'tic_tac_toe_mirror' && intersects[i].distance <= this.interactionRange) {
                    mirrorHit = { object: intersects[i].object, distance: intersects[i].distance, index: i };
                    console.log('🪞 Mirror prioritized for interaction');
                    break;
                }
            }

            // Use mirror if found, otherwise use closest interactable
            if (mirrorHit) {
                intersectedObject = mirrorHit.object;
                distance = mirrorHit.distance;
            }

            if (distance <= this.interactionRange) {
                const interactableData = this.findInteractableData(intersectedObject);
                if (interactableData) {
                    console.log('💬 Performing interaction for:', interactableData.data.type);
                    this.performInteraction(interactableData.object, interactableData.data);
                }
            } else {
                this.showMessage("Too far away to interact");
            }
        }
    }

    findInteractableData(object) {
        // Check the object itself
        if (object.userData && object.userData.type) {
            return { object: object, data: object.userData };
        }

        // Check parent chain
        let parent = object.parent;
        while (parent && parent !== this.scene) {
            if (parent.userData && parent.userData.type) {
                return { object: parent, data: parent.userData };
            }
            parent = parent.parent;
        }

        return null;
    }

    performInteraction(object, userData) {
        // Check if interaction should be available based on current objective
        if (userData.type === 'notepad') {
            // Only allow notepad interaction if we're at the computer interaction or have login objective
            // Allow reading once login objective is triggered
            if (!userData.loginAttempted) {
                this.showMessage("I should try to interact with the computer first.");
                return;
            }
        }

        if (userData.type === 'newspaper') {
            // Only allow newspaper interaction if investigate objective is active
            if (!userData.notepadRead) {
                this.showMessage("I should read that notepad first.");
                return;
            }
        }

        const interactionType = this.interactionTypes[userData.type];
        if (interactionType && interactionType.handler) {
            interactionType.handler(object, userData);
        } else {
            console.warn(`No handler for interaction type: ${userData.type}`);
        }
    }

    handlePageInteraction(pageObject, userData) {
        // CRITICAL FIX: Check if phone has been answered before allowing page pickup
        if (!this.gameManager.telephoneAnswered) {
            this.showMessage("These pages seem important. I should answer the phone call first.");
            return;
        }

        // NEW: Check if pages puzzle is completed
        if (this.gameManager.pagesPuzzleCompleted) {
            this.showMessage("The pages are sealed in place by an ancient magic.");
            return;
        }

        // Extract the actual page ID (handle child meshes like S_Page6_Symbol)
        let pageId = userData.pageId;
        if (!pageId) {
            console.warn('No pageId found');
            return;
        }

        // Check if this page has already been collected
        if (this.gameManager.collectedPages.includes(pageId)) {
            console.log(`Page ${pageId} already collected, ignoring interaction`);
            return;
        }

        // If pageId is a child like "S_Page6_Symbol", extract the parent page ID
        const pageMatch = pageId.match(/^(S_Page\d+)/);
        if (pageMatch) {
            pageId = pageMatch[1];
        }

        console.log(`📄 Page interaction: "${userData.pageId}" -> "${pageId}"`);

        if (pageId) {
            // Special handling for Page 6 - Tic-tac-toe mirror puzzle requirement
            if (pageId === 'S_Page6') {
                console.log('🎮 Page 6 interaction - checking mirror status');
                // Check if the player has won the tic-tac-toe puzzle
                const mirror = this.gameManager.mansion.props.get('tic_tac_toe_mirror');
                console.log('Mirror object:', mirror);
                console.log('Mirror found:', !!mirror);
                console.log('Mirror userData:', mirror?.userData);
                console.log('Mirror won status:', mirror?.userData?.won);

                if (!mirror || !mirror.userData || !mirror.userData.won) {
                    console.log('❌ Mirror not won - blocking page 6');

                    // Block interaction prompts during ghost warning
                    this.blockInteractionPrompt = true;

                    // Array of spooky ghost dialogues
                    const ghostWarnings = [
                        "A chilling whisper echoes... 'Not yours... Play the mirror game first, mortal...'",
                        "Cold phantom hands push you away... 'The mirror demands a challenge... Face me there...'",
                        "The page burns with spectral fire... 'Win the game at the mirror, if you dare...'",
                        "A ghostly voice hisses... 'This page is MINE... Defeat me at the mirror to claim it...'",
                        "The air grows icy cold... 'Play... Lose... Die... Or win and take your prize...'",
                        "Ethereal chains bind the page... 'The mirror awaits... A game for your soul...'"
                    ];

                    // Pick a random spooky warning
                    const randomWarning = ghostWarnings[Math.floor(Math.random() * ghostWarnings.length)];
                    this.showMessage(randomWarning, 6000); // Show for 6 seconds so player can read it

                    // Unblock prompts after message is done (with small buffer)
                    setTimeout(() => {
                        this.blockInteractionPrompt = false;
                    }, 6200);

                    // Play a spooky sound effect
                    if (this.audioManager) {
                        this.audioManager.playRandomAmbientSound();
                    }

                    // Force unfreeze immediately AND after a delay
                    if (this.controls) {
                        this.controls.isFrozen = false;
                        this.controls.unfreeze();
                    }
                    return;
                }
                console.log('✅ Mirror won - allowing page 6 collection');
            }

            // Special handling for Page 4 - Annie interaction
            if (pageId === 'S_Page4') {
                this.annieInteraction.handleAnniePageInteraction(pageObject, userData);
                return;
            }

            // Function to collect the page (used both with and without popup)
            const collectPageNow = () => {
                // Mark page as non-interactable immediately to prevent double-interaction
                if (pageObject.userData) {
                    pageObject.userData.interactable = false;
                }

                // Collect the page in the game manager
                this.gameManager.collectPage(pageId);

                // Animate and remove the page (and all its children including symbol)
                this.animateItemPickup(pageObject, () => {
                    // Make sure to remove all children first
                    while(pageObject.children.length > 0) {
                        pageObject.remove(pageObject.children[0]);
                    }

                    // Then remove the page itself from its parent
                    if (pageObject.parent) {
                        pageObject.parent.remove(pageObject);
                    }
                });
            };

            // Always show page content popup for every page
            this.showPageContent(pageId, () => {
                // After viewing, collect the page (with slight delay to prevent double-click)
                setTimeout(() => {
                    collectPageNow();
                }, 100);
            });
        } else {
            console.warn("Tried to pick up a page with no pageId property:", pageObject.name);
        }
    }

    getPageContent(pageId) {
        // Define unique content for each page
        const pageContents = {
            'S_Page1': {
                title: 'Page 1: The Beginning',
                content: `The mansion stands silent tonight, but I can feel it watching me.

Every shadow seems alive, every creak of the floorboards sounds like footsteps. I came here seeking answers about my family's past, but I'm beginning to wonder if some secrets are better left buried.

The old caretaker warned me not to come after dark. I should have listened.`
            },
            'S_Page2': {
                title: 'Page 2: Strange Findings',
                content: `I found something in the library today. Hidden behind a loose panel, a collection of letters dating back decades. They speak of rituals, of something they tried to contain within these walls.

Whatever it was, I don't think they succeeded.

The lights keep flickering, even though I checked all the fuses.`
            },
            'S_Page3': {
                title: 'Page 3: The Basement',
                content: `There's something in the basement. I can hear it moving down there when I'm trying to sleep. Heavy, deliberate footsteps that start and stop without reason.

I tried to board up the door, but the next morning all the planks were neatly stacked beside it.

It wants me to come down. But I'm not ready. Not yet.`
            },
            'S_Page4': {
                title: 'Page 4: Annie',
                content: `I found a doll in one of the bedrooms. The tag says her name is Annie. She has this unnerving smile, and her eyes seem to follow you around the room.

I moved her to the attic, but she keeps appearing back in the bedroom. Always sitting in the same chair, always facing the door.

I've stopped moving her.`
            },
            'S_Page5': {
                title: 'Page 5: The Truth',
                content: `I understand now. This isn't just a haunted house. This is a prison. The original owners didn't just die here – they were consumed, absorbed into the very fabric of the building.

And now it wants me too.

The walls are breathing. I can feel them contract and expand when I press my hand against them. This place is alive.`
            },
            'S_Page6': {
                title: 'Page 6: Final Entry',
                content: `If you're reading this, I'm probably gone. Either I escaped, or I became part of the mansion like the others.

There is a way out. The ritual in the basement can be reversed, but it requires all six pages to be placed in the correct order. Look for the symbols on the wall near the entrance.

Whatever you do, don't let the darkness catch you. It knows you're here now.

Run.`
            }
        };

        return pageContents[pageId] || {
            title: 'Unknown Page',
            content: 'The writing on this page is too faded to read...'
        };
    }

    showPageContent(pageId, onClose = null) {
        console.log(`📄 Showing page content for: ${pageId}`);

        // Immediately hide all prompts BEFORE freezing
        const currentPrompt = this.interactionPrompt.textContent;
        if (currentPrompt) {
            console.log(`📄 Clearing prompt before showing page: "${currentPrompt}"`);
        }
        this.interactionPrompt.style.display = 'none';
        this.interactionPrompt.textContent = '';
        this.crosshair.style.background = 'white';
        this.crosshair.style.borderColor = 'rgba(255,255,255,0.8)';
        this.crosshair.style.width = '4px';
        this.crosshair.style.height = '4px';

        // Release E key to prevent movement after viewing page
        this.isEKeyHeld = false;

        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'page_view';

        const pageData = this.getPageContent(pageId);

        // Remove any existing page overlay first
        const existingOverlay = document.getElementById('page-overlay');
        if (existingOverlay) {
            document.body.removeChild(existingOverlay);
        }

        // Create old page overlay
        const pageOverlay = document.createElement('div');
        pageOverlay.id = 'page-overlay';
        pageOverlay.tabIndex = -1; // Make focusable
        pageOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
            backdrop-filter: blur(5px);
            outline: none;
        `;

        // Create old page paper
        const pagePaper = document.createElement('div');
        pagePaper.style.cssText = `
            width: 600px;
            max-height: 80vh;
            background: linear-gradient(to bottom, #f4e9d4 0%, #e8dcc4 100%);
            border: 2px solid #8b7355;
            box-shadow:
                0 0 40px rgba(0, 0, 0, 0.8),
                inset 0 0 100px rgba(139, 115, 85, 0.1);
            padding: 40px;
            font-family: 'Georgia', serif;
            color: #2c1810;
            position: relative;
            overflow-y: auto;

            /* Old paper texture effect */
            background-image:
                repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139, 115, 85, 0.03) 2px, rgba(139, 115, 85, 0.03) 4px),
                repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(139, 115, 85, 0.03) 2px, rgba(139, 115, 85, 0.03) 4px);
        `;

        // Page title
        const pageTitle = document.createElement('h2');
        pageTitle.textContent = pageData.title;
        pageTitle.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 30px;
            color: #1a0f08;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
            font-family: 'Georgia', serif;
            border-bottom: 2px solid #8b7355;
            padding-bottom: 10px;
        `;

        // Page content
        const pageContent = document.createElement('div');
        pageContent.textContent = pageData.content;
        pageContent.style.cssText = `
            font-size: 16px;
            line-height: 1.8;
            white-space: pre-line;
            text-align: justify;
            color: #3c2415;
            font-family: 'Georgia', serif;
            margin-bottom: 30px;
        `;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close (Press E)';
        closeButton.style.cssText = `
            width: 100%;
            padding: 15px;
            background: #5c4a3a;
            color: #f4e9d4;
            border: 2px solid #3c2a1a;
            cursor: pointer;
            font-family: 'Georgia', serif;
            font-size: 16px;
            transition: all 0.3s;
        `;
        closeButton.onmouseover = () => {
            closeButton.style.background = '#6c5a4a';
        };
        closeButton.onmouseout = () => {
            closeButton.style.background = '#5c4a3a';
        };

        const closePageView = () => {
            console.log('📄 Closing page view');

            // Check if overlay still exists
            if (document.body.contains(pageOverlay)) {
                document.body.removeChild(pageOverlay);
            }

            this.currentInteraction = null;

            // Check if inventory popup is open - if so, keep controls frozen
            const inventoryPopup = document.getElementById('inventory-popup');
            const isInventoryOpen = inventoryPopup && inventoryPopup.style.display === 'block';

            if (this.controls && !isInventoryOpen) {
                this.controls.unfreeze();
            }

            // Call onClose callback if provided
            if (onClose && typeof onClose === 'function') {
                onClose();
            }
        };

        closeButton.onclick = (e) => {
            e.stopPropagation();
            closePageView();
        };

        // Allow E key to close
        const keyHandler = (e) => {
            if (e.code === 'KeyE') {
                e.preventDefault();
                document.removeEventListener('keydown', keyHandler);
                closePageView();
            }
        };
        document.addEventListener('keydown', keyHandler);

        pagePaper.appendChild(pageTitle);
        pagePaper.appendChild(pageContent);
        pagePaper.appendChild(closeButton);
        // Prevent clicks on overlay from passing through
        pageOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        pageOverlay.appendChild(pagePaper);
        document.body.appendChild(pageOverlay);

        // Focus the overlay to capture keyboard events
        setTimeout(() => {
            pageOverlay.focus();
            console.log('📄 Page overlay focused for keyboard input');
        }, 100);
    }

    handlePageSlotInteraction(slotObject, userData) {
        // NEW: Check if pages puzzle is completed
        if (this.gameManager.pagesPuzzleCompleted) {
            this.showMessage("The pages are sealed in place by an ancient magic.");
            return;
        }

        // NEW: Check if laptop puzzle is completed
        if (!this.gameManager.laptopPuzzleCompleted) {
            this.showMessage("The symbols don't make any sense. I need to decipher them first.");
            return;
        }

        const slotIndex = userData.slotIndex;

        // If a page is already in the slot, ask to remove it.
        if (this.gameManager.placedPages[slotIndex]) {
            const pageId = this.gameManager.placedPages[slotIndex];
            const pageSymbol = this.gameManager.getPageSymbol(pageId);

            // this.showConfirmation(
            //     `A page with the ${pageSymbol} symbol is here. Do you want to take it back?`,
            //     () => { // This function runs if you click "Yes".
            //         this.gameManager.removePageFromSlot(slotIndex);
            //     }
            // );
            // return;
            this.gameManager.removePageFromSlot(slotIndex);
        }

        // If the slot is empty, the rest of the function works as before to place a new page.
        const availablePages = this.gameManager.inventory.filter(item => item.pageId);

        if (availablePages.length === 0) {
            this.showMessage("You don't have any pages to place.");
            return;
        }

        const options = availablePages.map(page => `Place Page (${page.symbol})`);
        options.push("Cancel");

        this.showPuzzleDialog(
            "Place a Page",
            "Which page do you want to place in this slot?",
            options,
            (choiceIndex) => {
                if (choiceIndex < availablePages.length) {
                    const chosenPage = availablePages[choiceIndex];
                    this.gameManager.placePage(slotIndex, chosenPage);
                }
            }
        );
    }

    handleTelephoneInteraction(phone, userData) {
        if (userData.interacted) {
            // Trigger the new "dead line" dialogue sequence
            window.gameControls.narrativeManager.triggerEvent('stage1.phone_dead_line_1').then(() => {
                window.gameControls.narrativeManager.triggerEvent('stage1.phone_dead_line_2');
            });
            return;
        }
        // Stop the ringing sound
        this.gameManager.answerTelephone();

        // Mark the object as interacted to prevent re-triggering
        userData.interacted = true;
    }

    async handleLaptopInteraction(laptopObject, userData) {
        // Check if all 6 pages have been collected
        if (this.gameManager.collectedPages.length < 6) {
            this.showMessage("I should focus on collecting the pages first.");
            return;
        }

        console.log("Interacting with laptop");
        const clue = "> The first light reveals the path\n>But the second shadow conceals it.\n> A pin-prick Star follows, a diamond set high,\n>A fourth hand offers a false choice.\n>Only then can we see the truth\n> As the spiral unravels destiny"

        // const clueSourceElement = document.getElementById('clue-text-source');
        // const clue = clueSourceElement ? clueSourceElement.textContent.trim() : "Error: Clue text not found in HTML.";

        await window.gameControls.narrativeManager.triggerEvent('stage1.laptop_puzzle_speech');

        if (this.isColorPuzzleSolved) {
            console.log("Puzzle already solved. Showing clue directly.");
            this.showClueScreenDialog(clue);
            return;
        }

        const colorPuzzle = window.gameControls.colorPuzzle;
        if (colorPuzzle) {
            if (this.controls) this.controls.freeze();
            this.currentInteraction = 'color_puzzle';

            colorPuzzle.show(4, () => this.closePuzzleUI());

            colorPuzzle.onSolve(async () => {
                this.isColorPuzzleSolved = true;
                this.gameManager.laptopPuzzleCompleted = true; // Mark laptop puzzle as complete
                this.showClueScreenDialog(clue);

                // After getting the clue, mark deciphering as complete...
                window.gameControls.gameManager.completeObjective('decipher_pages');
                // ...and give the new objective to place the pages.
                await window.gameControls.narrativeManager.triggerEvent('stage1.all_pages_placed');

            }, 'ACCESS GRANTED');

        } else {
            this.showMessage("The laptop screen is dark.");
        }
    }

    showClueScreenDialog(clueText) {
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'clue';

        const clueScreen = this.uiManager.uiElements.clueScreen;
        if (clueScreen) {
            const clueTextElement = clueScreen.querySelector('.clue-text');
            if (clueTextElement) {
               // clueTextElement.textContent = clueText;
            }
            clueScreen.style.display = 'flex';
            setTimeout(() => {
                clueScreen.focus();
            }, 50);
        }
    }
    
    async handleDoorInteraction(door, userData) {
        if (userData.locked) {
            if (this.gameManager.hasItem('S_KeyBehindFire')) {
                this.showConfirmation("Unlock the master bedroom door?", async () => {
                    userData.locked = false;
                    this.gameManager.removeFromInventory('S_KeyBehindFire');
                    this.showMessage("The door unlocks with a loud click.");

                    // Animate the door opening right after unlocking
                    this.animateDoorOpen(door);

                    // Complete the find lock objective
                    this.gameManager.completeObjective('find_lock');

                    // Set monster to curious (level 3)
                    if (window.gameControls.monsterAI) {
                        window.gameControls.monsterAI.setAggressionLevel(3);
                        console.log('👾 Monster set to CURIOUS after door opened');
                    }

                    // Trigger door opened speech and new objective
                    await window.gameControls.narrativeManager.triggerEvent('stage1.door_opened');
                    await window.gameControls.narrativeManager.triggerEvent('stage1.open_safe_objective');
                });
            }
            else {
                this.showMessage("The door is locked. You need a key.");
            }
        }
        else {
            // If the door is not locked, just open it
            this.animateDoorOpen(door);
        }
    }

    handleKeyInteraction(key, userData) {
        if (userData.keyId) {
            this.gameManager.addToInventory({
                name: userData.name || userData.keyId,
                type: 'key',
                id: userData.keyId
            });
            
            this.animateItemPickup(key, () => {
                if (key.parent) {
                    key.parent.remove(key);
                }
            });
        }
    }

    animateDoorOpen(door) {
        console.log(door);
        if (door.userData.isOpening || door.userData.isOpen) {
            this.showMessage("The door is already open.");
            return;
        }
        door.userData.isOpening = true;

        // --- FINAL, ROBUST PIVOT METHOD ---

        // 1. We only set up the pivot ONCE.
        if (!door.userData.pivot) {
            // Get the door's size from its bounding box.
            const box = new THREE.Box3().setFromObject(door);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Create an invisible pivot object.
            const pivot = new THREE.Group();
            this.scene.add(pivot); // Add the pivot to the main scene.

            // 2. Create an offset vector for the hinge in the door's LOCAL space.
            // We assume the hinge is on the door's left edge (the -X axis of the door model).
            const hingeOffset = new THREE.Vector3(-size.x / 2, 0, 0);

            // 3. Apply the door's WORLD rotation to this local offset.
            hingeOffset.applyQuaternion(door.quaternion);

            // 4. Add the rotated offset to the door's WORLD position.
            // This gives us the exact world coordinate for the pivot.
            pivot.position.copy(door.position).add(hingeOffset);

            // 5. Use pivot.attach(door). This is the crucial step. It re-parents the door
            // to the pivot while maintaining its current world position, rotation, and scale.
            pivot.attach(door);

            // Store the pivot in the door's data so we don't repeat this setup.
            door.userData.pivot = pivot;
        }

        const pivot = door.userData.pivot;

        // 6. Animate the PIVOT's rotation. The door will now swing perfectly.
        const startRotationY = pivot.rotation.y;
        const targetRotationY = startRotationY - (Math.PI / 2); // Open 90 degrees inward.
        const duration = 1500; // 1.5 seconds.
        const startTime = Date.now();

        const animate = () => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 4); // A smooth ease-out effect.

            // Interpolate the pivot's rotation.
            pivot.rotation.y = startRotationY + (targetRotationY - startRotationY) * easedProgress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                pivot.rotation.y = targetRotationY; // Snap to the final rotation.
                door.userData.isOpening = false;
                door.userData.isOpen = true;

                // CRITICAL FIX: Remove door collision when fully opened
                // Use correct loader for multi-scene support
                const currentLoader = this.stageManager ? this.stageManager.currentLoader : this.gameManager.mansion;

                if (currentLoader && currentLoader.removeCollisionForObject) {
                    // Remove collision for the door object itself
                    currentLoader.removeCollisionForObject(door.name);

                    // Also remove collision for any child objects
                    for (const child of door.children) {
                        currentLoader.removeCollisionForObject(child.name);
                    }

                    console.log(`🚪 Door collision removed after opening: ${door.name}`);
                }
            }
        };

        requestAnimationFrame(animate);
    }

    handleBookInteraction(book, userData) {
        const bookTitle = userData.title || "Mysterious Book";
        const bookContent = userData.content || "The pages are yellowed with age and filled with strange symbols and text you can barely make out...";

        this.showScrollDialog(bookTitle, bookContent);

        if (userData.clue) {
            this.showMessage(`You notice something important: ${userData.clue}`);
        }

        if (userData.triggersEvent) {
            setTimeout(() => {
                this.showMessage("Reading this book seems to have triggered something...");
            }, 2000);
        }
    }

    handleFurnitureInteraction(furniture, userData) {
        const furnitureType = furniture.name ? furniture.name.split('_')[1] : 'unknown';

        switch (furnitureType) {
            case 'bed':
                if (Math.random() < 0.3) {
                    this.spawnHiddenItem(furniture, {
                        type: 'key',
                        keyId: 'bedroom_key',
                        name: 'Hidden Key'
                    });
                    this.showMessage("You found a hidden key under the mattress!");
                } else {
                    this.showMessage("Nothing but dust and old memories.");
                }
                break;

            case 'dresser':
                if (Math.random() < 0.4) {
                    this.showPuzzleDialog(
                        "Dresser Drawers",
                        "The drawers are stuck. Which drawer should you try to force open?",
                        ["Top drawer", "Middle drawer", "Bottom drawer"],
                        (choice) => {
                            if (choice === 1) { // Middle drawer
                                this.spawnHiddenItem(furniture, {
                                    type: 'scroll',
                                    name: 'Old Letter',
                                    content: 'The master bedroom holds the key to the study...'
                                });
                                this.showMessage("You found an old letter in the drawer!");
                            } else {
                                this.showMessage("The drawer is empty except for some old clothing.");
                            }
                        }
                    );
                } else {
                    this.showMessage("The dresser drawers are all empty.");
                }
                break;

            case 'bookshelf':
                this.handleBookshelfInteraction(furniture, userData);
                break;

            default:
                this.showMessage(`You search the ${furnitureType} but find nothing of interest.`);
        }
    }

    handleBookshelfInteraction(bookshelf, userData) {
        this.showPuzzleDialog(
            "Ancient Bookshelf",
            "The books seem to be arranged in a specific order. Some books stand out more than others.",
            ["Examine books closely", "Look for hidden mechanism", "Leave it alone"],
            (choice) => {
                switch (choice) {
                    case 0: // Examine books
                        this.showMessage("You notice some books have dates on their spines: 1823, 1834, 1845, 1856");
                        break;
                    case 1: // Look for mechanism
                        if (Math.random() < 0.5) {
                            this.showMessage("You hear a clicking sound. One of the books seems loose!");
                            this.startBookCipherPuzzle(bookshelf);
                        } else {
                            this.showMessage("You don't find any hidden mechanisms.");
                        }
                        break;
                }
            }
        );
    }

    handlePuzzleInteraction(puzzle, userData) {
        const room = this.gameManager.currentRoom;
        if (room && room.puzzles.length > 0) {
            const puzzleData = room.puzzles.find(p => p.type === userData.puzzleType);
            
            if (puzzleData) {
                if (puzzleData.solved) {
                    this.showMessage("This puzzle has already been solved.");
                    return;
                }
                
                this.startPuzzle(puzzleData, puzzle);
            }
        }
    }

    handleSafeInteraction(safe, userData) {
        if (this.gameManager.safePuzzleSolved) {
            this.showMessage("The safe is already open.");
            return;
        }

        const keypadPuzzle = window.gameControls.keypadPuzzle;
        if (keypadPuzzle) {
            this.controls.freeze();
            this.currentInteraction = 'keypad_puzzle';
            keypadPuzzle.show(
                () => { // onSolve
                    this.gameManager.solveSafePuzzle();
                    this.closePuzzleUI();
                },
                () => { // onClose
                    this.closePuzzleUI();
                }
            );
        } else {
            this.showMessage("The safe is locked by a keypad.");
        }
    }

    handleMirrorInteraction(mirror, userData) {
        if (userData.rotatable) {
            userData.rotation = (userData.rotation || 0) + 45;
            if (userData.rotation >= 360) userData.rotation = 0;
            
            mirror.rotation.z = (userData.rotation * Math.PI) / 180;
            
            this.showMessage(`Mirror rotated to ${userData.rotation}°`);
            
            const mirrorPuzzle = mirror.parent;
            if (mirrorPuzzle && mirrorPuzzle.userData.type === 'puzzle') {
                this.checkMirrorPuzzleSolution(mirrorPuzzle);
            }
        }
    }

    handleClockInteraction(clock, userData) {
        this.showTimeSettingDialog(
            "Set the clock time:",
            userData.currentTime || "12:00",
            (hours, minutes) => {
                const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
                
                if (this.gameManager.mansion.puzzleSystem?.setClockTime(clock, hours, minutes)) {
                    this.showMessage("The clock chimes ominously... something has changed.");
                    userData.solved = true;
                } else {
                    this.showMessage(`Clock set to ${timeString}. But nothing happens...`);
                }
            }
        );
    }

    handleScrollInteraction(scroll, userData) {
        this.showScrollDialog(
            userData.name || "Ancient Scroll",
            userData.content || "The text is too faded to read clearly..."
        );
    }

    handleEscapePortal(portal, userData) {
        this.showConfirmation(
            "Step through the portal to escape the mansion?",
            () => {
                this.gameManager.completeObjective('escape');
                this.gameManager.onGameWon();
            }
        );
    }

    async handleFuseBoxInteraction(fuseBox, userData) {
        // Check if already fixed
        if (this.gameManager.fuseBoxFixed) {
            this.showMessage("The fuse box is already working.");
            return;
        }

        // Check if in stage 2
        if (this.gameManager.gameStage !== 2) {
            this.showMessage("The fuse box seems to be working fine.");
            return;
        }

        // Inner monologue using narrative manager
        await window.gameControls.narrativeManager.triggerEvent('stage2.fuse_box_examine');

        // Launch wire puzzle
        const wirePuzzle = window.gameControls.wirePuzzle;
        if (wirePuzzle) {
            if (this.controls) this.controls.freeze();
            this.currentInteraction = 'wire_puzzle';

            wirePuzzle.show();

            wirePuzzle.onSolve(() => {
                this.gameManager.fixFuseBox();
                userData.fixed = true;
            });

            wirePuzzle.onClose(() => {
                this.closePuzzleUI();
            });
        } else {
            this.showMessage("Something's wrong with the wiring...");
        }
    }

    async handleEntranceDoorInteraction(door, userData) {
        // Only allow interaction in stage 2 and if escape objective is active
        if (this.gameManager.gameStage !== 2) {
            this.showMessage("The door is closed.");
            return;
        }

        // Check if this is the first time trying the door
        if (!userData.triedToEscape) {
            userData.triedToEscape = true;

            // Show door locked message
            await window.gameControls.narrativeManager.triggerEvent('stage2.door_locked');

            // Complete the escape objective
            this.gameManager.completeObjective('escape_mansion');

            // Turn off the lamps (but not fireplace - that stays lit)
            this.gameManager.lightsOn = false;
            // Use the current loader from stageManager instead of cached mansion
            const currentLoader = this.gameManager.stageManager ? this.gameManager.stageManager.currentLoader : this.gameManager.mansion;
            if (currentLoader) {
                currentLoader.setLampsEnabled(false);
            }

            await window.gameControls.narrativeManager.triggerEvent('stage2.lights_out');
            await window.gameControls.narrativeManager.triggerEvent('stage2.need_power');

            // Make fuse box interactable
            const fuseBox = this.gameManager.mansion.props.get('fuse_box');
            if (fuseBox) {
                fuseBox.userData.interactable = true;
            }

            // Add the fuse box objective
            await window.gameControls.narrativeManager.triggerEvent('stage2.fix_fuse_box_objective');

            // Spawn the monster after a short delay
            setTimeout(() => {
                if (window.gameControls.monsterAI) {
                    this.gameManager.spawnMonsterNearStudy();
                }
            }, 2000);
        } else {
            this.showMessage("The door is locked from the outside.");
        }
    }

    async handleDiaryInteraction(diary, userData) {
        if (!userData.interactable) {
            this.showMessage("It's just an old book.");
            return;
        }

        if (userData.hasRead) {
            // Already read, just show the page again without changing objectives
            this.showDiaryPage();
            return;
        }

        // Mark as read first
        userData.hasRead = true;

        // Make diary non-interactable after reading to prevent re-triggering objectives
        diary.userData.interactable = false;

        // Stop the diary from glowing
        // Use correct loader for multi-scene support
        const currentLoaderForGlow = this.stageManager ? this.stageManager.currentLoader : this.gameManager.mansion;
        if (currentLoaderForGlow) {
            currentLoaderForGlow.disableDiaryGlow();
        }

        // Show the diary page
        this.showDiaryPage();

        // Wait a moment for the user to see the diary, then trigger the objective change
        setTimeout(async () => {
            // Make both fireplace objects interactable
            // Use correct loader for multi-scene support
            const currentLoader = this.stageManager ? this.stageManager.currentLoader : this.gameManager.mansion;

            if (currentLoader) {
                const fireplace = currentLoader.props.get('fireplace');
                if (fireplace) {
                    fireplace.userData.interactable = true;
                    console.log(`🔥 Fireplace made interactable`);
                }
                const fireplaceFire = currentLoader.props.get('fireplace_fire');
                if (fireplaceFire) {
                    fireplaceFire.userData.interactable = true;
                    console.log(`🔥 Fireplace fire made interactable`);
                }
            } else {
                console.warn(`⚠️ Could not access current loader to make fireplace interactable`);
            }

            // Complete read diary objective - this will mark it complete visually
            this.gameManager.completeObjective('read_diary');

            // Small delay before showing new objective to ensure completion registers
            setTimeout(async () => {
                // Add fireplace inspection objective
                await window.gameControls.narrativeManager.triggerEvent('stage1.inspect_fireplace_objective');
            }, 300);
        }, 500);
    }

    handleKeypadInteraction(keypad, userData) {
        if (this.gameManager.safePuzzleSolved) {
            this.showMessage("The safe is already open.");
            return;
        }

        this.controls.freeze();
        this.currentInteraction = 'keypad';
        this.uiManager.showKeypad();
    } 

    showDiaryPage() {
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'diary';

        const diaryOverlay = document.createElement('div');
        diaryOverlay.id = 'diary-overlay';
        diaryOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            pointer-events: auto;
        `;

        const diaryPage = document.createElement('div');
        diaryPage.style.cssText = `
            width: 600px;
            height: 700px;
            background: #f4e8d0;
            padding: 60px;
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
            border: 2px solid #8b7355;
            position: relative;
            overflow: hidden;
        `;

        const closeFunc = () => {
            if (document.body.contains(diaryOverlay)) {
                document.body.removeChild(diaryOverlay);
            }
            if (this.controls) this.controls.unfreeze();
            this.currentInteraction = null;
        };

        diaryPage.innerHTML = `
            <div style="
                font-family: 'Brush Script MT', cursive, serif;
                font-size: 24px;
                line-height: 1.8;
                color: #2c1810;
                text-align: left;
            ">
                <p style="margin-bottom: 30px;">Dear Diary,</p>
                <p style="margin-bottom: 25px;">They're coming. I can hear them getting closer each day.</p>
                <p style="margin-bottom: 25px;">I must destroy my research before they find it. The truth must not fall into the wrong hands.</p>
                <p style="margin-bottom: 25px;">I've hidden the pages, but I must burn my notes. Too late now, they're at the d</p>
                <p style="
                    font-size: 20px;
                    opacity: 0.5;
                    transform: skew(-2deg);
                ">oor... the</p>
            </div>
        `;

        // Create close button separately and add event listener properly
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            position: absolute;
            bottom: 30px;
            right: 30px;
            padding: 10px 20px;
            background: #8b7355;
            color: #f4e8d0;
            border: none;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            border-radius: 3px;
        `;
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFunc();
        });

        diaryPage.appendChild(closeButton);
        diaryOverlay.appendChild(diaryPage);
        document.body.appendChild(diaryOverlay);

        // Stop propagation on the page itself
        diaryPage.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    async handleFireplaceInteraction(fireplace, userData) {
        if (!userData.interactable) {
            this.showMessage("The fireplace is crackling peacefully.");
            return;
        }

        // Get the correct loader for multi-scene support
        const currentLoader = this.stageManager ? this.stageManager.currentLoader : this.gameManager.mansion;

        // Check if player has bucket and fire is not out yet
        if (this.gameManager.hasItem('Bucket') && !userData.fireOut) {
            console.log('🔥 Player has bucket, putting out fire...');

            // Mark both fireplace objects as fire out
            userData.fireOut = true;
            const fireplaceObj = currentLoader.props.get('fireplace');
            if (fireplaceObj && fireplaceObj.userData) {
                fireplaceObj.userData.fireOut = true;
            }
            const fireplaceFire = currentLoader.props.get('fireplace_fire');
            if (fireplaceFire && fireplaceFire.userData) {
                fireplaceFire.userData.fireOut = true;
            }

            this.showMessage("You pour the water on the fire...");

            // Extinguish ALL fires in the mansion (same method as when lights go out)
            currentLoader.setFireplacesEnabled(false);

            // Remove bucket from inventory
            this.gameManager.removeFromInventory('Bucket');

            // Complete put out fire objective
            this.gameManager.completeObjective('put_out_fire');

            // Set monster to BOLD (level 4) after putting out fire
            if (window.gameControls.monsterAI) {
                window.gameControls.monsterAI.setAggressionLevel(4); // BOLD
                console.log('👾 Monster is now BOLD after fire was extinguished');
            }

            // Show message that they found the key
            await window.gameControls.narrativeManager.triggerEvent('stage1.found_key');

            // Add the key to inventory (S_KeyBehindFire - note: Key not Kay)
            this.gameManager.addToInventory({
                name: 'S_KeyBehindFire',
                type: 'key',
                description: 'A key found behind the fireplace ashes.'
            });

            // Add new objective to find what the key unlocks
            await window.gameControls.narrativeManager.triggerEvent('stage1.find_what_key_unlocks');

            return;
        }

        // If fire is out, show message
        if (userData.fireOut) {
            this.showMessage("The fireplace is empty now.");
            return;
        }

        // First time inspecting with fire still burning
        if (!userData.inspected) {
            // Mark both fireplace objects as inspected
            userData.inspected = true;
            const fireplaceObj = currentLoader.props.get('fireplace');
            if (fireplaceObj && fireplaceObj.userData) {
                fireplaceObj.userData.inspected = true;
            }
            const fireplaceFire = currentLoader.props.get('fireplace_fire');
            if (fireplaceFire && fireplaceFire.userData) {
                fireplaceFire.userData.inspected = true;
            }

            await window.gameControls.narrativeManager.triggerEvent('stage1.fireplace_too_hot');
            this.gameManager.completeObjective('inspect_fireplace');

            // Make bucket interactable
            const bucket = currentLoader.props.get('bucket');
            if (bucket) {
                bucket.userData.interactable = true;
            }

            await window.gameControls.narrativeManager.triggerEvent('stage1.find_something_to_put_out_fire_objective');
        } else {
            this.showMessage("I still need water to put out the fire.");
        }
    }

    async handleBucketInteraction(bucket, userData) {
        if (!userData.interactable) {
            this.showMessage("It's just a bucket.");
            return;
        }

        // Add bucket to inventory
        this.gameManager.addToInventory({
            name: 'Bucket',
            type: 'tool',
            description: 'A bucket that could hold water.'
        });

        // Animate bucket pickup and remove from scene
        this.animateItemPickup(bucket, () => {
            if (bucket.parent) {
                bucket.parent.remove(bucket);
            }
        });

        // Complete the find something to put out fire objective
        this.gameManager.completeObjective('find_something_to_put_out_fire');

        // Add the put out fire objective
        await window.gameControls.narrativeManager.triggerEvent('stage1.put_out_fire_objective');
    }

    async handleSofaInteraction(sofa, userData) {
        // Check if sofa has already been fully moved - silently return (no message)
        if (userData.moved) {
            console.log(`🛋️ Sofa ${sofa.name} already moved, ignoring interaction`);
            return;
        }

        // Check if already moving this sofa
        if (this.movingSofa && this.movingSofa.sofa === sofa) {
            return; // Already moving, continue in tick()
        }

        // Start moving the sofa in positive Z direction
        this.movingSofa = {
            sofa: sofa,
            userData: userData,
            distanceMoved: userData.distanceMoved, // Use the sofa's tracked distance
            initialPosition: sofa.position.clone(),
            sofaName: sofa.name // Store the name explicitly
        };

        this.currentInteraction = 'sofa_movement';

        console.log(`🛋️ Started pushing ${sofa.name}. Current distance: ${userData.distanceMoved}. Hold E to continue.`);
        console.log(`🛋️ Sofa userData:`, userData);
        this.showMessage("Pushing sofa... Hold E to continue.", 500);
    }

    async handleWardrobeInteraction(wardrobe, userData) {
        // Toggle hiding state
        if (this.isHiding) {
            // Exit hiding
            this.exitHiding();
        } else {
            // Enter hiding
            this.enterHiding(wardrobe);
        }
    }

    enterHiding(wardrobe) {
        console.log(`🚪 Entering hiding in ${wardrobe.name}`);

        this.isHiding = true;
        this.currentHidingSpot = wardrobe;
        this.hideStartTime = Date.now();
        this.currentInteraction = 'hiding';

        // Save original camera position and rotation
        this.originalCameraPosition = this.camera.position.clone();
        this.originalCameraQuaternion = this.camera.quaternion.clone();

        // Reset hiding session flags
        this.monsterInvestigationTriggered = false;
        this.monsterAggroReductionTriggered = false;

        // Calculate wardrobe's world position
        const wardrobeWorldPos = new THREE.Vector3();
        wardrobe.getWorldPosition(wardrobeWorldPos);

        // Get the wardrobe's forward direction (where it faces)
        const wardrobeForward = new THREE.Vector3(0, 0, 1);
        wardrobeForward.applyQuaternion(wardrobe.quaternion);

        // Position camera slightly in front of the wardrobe, looking out
        const hidePosition = wardrobeWorldPos.clone();
        hidePosition.add(wardrobeForward.multiplyScalar(0.3)); // 0.3 units forward
        hidePosition.y = this.originalCameraPosition.y; // Keep camera at player eye height

        // Move camera to hiding position
        this.camera.position.copy(hidePosition);

        // Make camera look back at where the player was standing
        this.camera.lookAt(this.originalCameraPosition);

        // Store the locked camera position and rotation
        this.lockedCameraPosition = this.camera.position.clone();
        this.lockedCameraQuaternion = this.camera.quaternion.clone();

        // Teleport physics body to hiding position to prevent falling/movement
        if (window.gameControls && window.gameControls.physicsManager) {
            window.gameControls.physicsManager.teleportTo(hidePosition);
        }

        // Freeze player controls AFTER setting locked position (prevents mouse look and WASD)
        if (this.controls) {
            this.controls.freeze();
        }

        // Turn off flashlight if it's on
        if (window.gameControls && window.gameControls.flashlight) {
            this.flashlightWasOn = window.gameControls.flashlight.isOn;
            if (this.flashlightWasOn) {
                window.gameControls.flashlight.toggle();
                console.log('💡 Flashlight turned off while hiding');
            }
        }

        // Create and show hiding overlay
        this.createHidingOverlay();

        // Show message
        this.showMessage("Hiding... Press E to exit", 2000);
    }

    exitHiding() {
        console.log(`🚪 Exiting hiding`);

        this.isHiding = false;
        this.currentHidingSpot = null;
        this.currentInteraction = null;

        // Restore original camera position and rotation
        if (this.originalCameraPosition && this.originalCameraQuaternion) {
            // Teleport physics body back to original position
            if (window.gameControls && window.gameControls.physicsManager) {
                window.gameControls.physicsManager.teleportTo(this.originalCameraPosition);
            }

            this.camera.position.copy(this.originalCameraPosition);
            this.camera.quaternion.copy(this.originalCameraQuaternion);
        }

        // Unfreeze player controls
        if (this.controls) {
            this.controls.unfreeze();
        }

        // Restore flashlight state if it was on before hiding
        if (this.flashlightWasOn && window.gameControls && window.gameControls.flashlight) {
            if (!window.gameControls.flashlight.isOn) {
                window.gameControls.flashlight.toggle();
                console.log('💡 Flashlight restored after hiding');
            }
        }

        // Remove hiding overlay
        this.removeHidingOverlay();

        // Clear stored positions
        this.originalCameraPosition = null;
        this.originalCameraQuaternion = null;
        this.lockedCameraPosition = null;
        this.lockedCameraQuaternion = null;
        this.flashlightWasOn = false;

        // Reset hiding session flags
        this.monsterInvestigationTriggered = false;
        this.monsterAggroReductionTriggered = false;

        // Show message
        this.showMessage("You exit your hiding spot", 2000);
    }

    createHidingOverlay() {
        // Remove existing overlay if any
        this.removeHidingOverlay();

        // Create main overlay container
        this.hideOverlay = document.createElement('div');
        this.hideOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 500;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // Create left door bar
        const leftDoor = document.createElement('div');
        leftDoor.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 30%;
            height: 100%;
            background: linear-gradient(to right,
                rgba(0, 0, 0, 1) 0%,
                rgba(10, 10, 10, 0.98) 50%,
                rgba(0, 0, 0, 0.9) 100%);
            box-shadow: inset -20px 0 40px rgba(0,0,0,0.9), inset 10px 0 20px rgba(0,0,0,0.7);
            border-right: 3px solid rgba(0, 0, 0, 1);
        `;

        // Create right door bar
        const rightDoor = document.createElement('div');
        rightDoor.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 30%;
            height: 100%;
            background: linear-gradient(to left,
                rgba(0, 0, 0, 1) 0%,
                rgba(10, 10, 10, 0.98) 50%,
                rgba(0, 0, 0, 0.9) 100%);
            box-shadow: inset 20px 0 40px rgba(0,0,0,0.9), inset -10px 0 20px rgba(0,0,0,0.7);
            border-left: 3px solid rgba(0, 0, 0, 1);
        `;

        // Create center vignette overlay
        const vignette = document.createElement('div');
        vignette.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%);
            pointer-events: none;
        `;

        // Add hiding status text
        const statusText = document.createElement('div');
        statusText.style.cssText = `
            position: relative;
            color: rgba(255,255,255,0.8);
            font-family: 'Courier New', monospace;
            font-size: 18px;
            text-align: center;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 501;
        `;
        statusText.innerHTML = `
            <p style="margin: 0 0 10px 0;">HIDING</p>
            <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6);">Press E to exit</p>
        `;

        this.hideOverlay.appendChild(leftDoor);
        this.hideOverlay.appendChild(rightDoor);
        this.hideOverlay.appendChild(vignette);
        this.hideOverlay.appendChild(statusText);
        document.body.appendChild(this.hideOverlay);
    }

    removeHidingOverlay() {
        if (this.hideOverlay) {
            document.body.removeChild(this.hideOverlay);
            this.hideOverlay = null;
        }
    }

    triggerMonsterInvestigation() {
        this.monsterInvestigationTriggered = true;

        // Check if monster is spawned and gameStage is 2
        if (!window.gameControls || !window.gameControls.monsterAI) {
            console.log('🚪 Monster investigation skipped - monster not spawned yet');
            return;
        }

        if (!window.gameControls.gameManager || window.gameControls.gameManager.gameStage !== 2) {
            console.log('🚪 Monster investigation skipped - not in stage 2 yet');
            return;
        }

        const monsterAI = window.gameControls.monsterAI;
        const monster = monsterAI.monster;

        if (!monster || !monster.visible) {
            console.log('🚪 Monster investigation skipped - monster not visible');
            return;
        }

        console.log('👾 Monster heard something and is investigating your hiding spot...');
        this.showMessage("You hear footsteps approaching...", 3000);

        // Get hiding spot position
        const hidePos = this.lockedCameraPosition.clone();

        // Make monster move to near the hiding spot
        if (monsterAI.pathfinding) {
            // Find a navmesh node near the hiding spot
            const zone = monsterAI.pathfinding.zones[monsterAI.ZONE];
            const nodes = zone.groups[monsterAI.groupID];

            let closestNode = null;
            let closestDistance = Infinity;

            for (const node of nodes) {
                const distance = node.centroid.distanceTo(hidePos);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestNode = node;
                }
            }

            if (closestNode) {
                // Move monster to investigation spot
                monster.position.copy(closestNode.centroid);
                console.log('👾 Monster arrived at hiding spot');

                // Make monster look around for 3 seconds, then move away
                setTimeout(() => {
                    this.showMessage("The footsteps are fading away...", 2000);
                    console.log('👾 Monster found nothing and is moving away');

                    // Spawn monster somewhere else after investigation
                    setTimeout(() => {
                        monsterAI.spawn();
                    }, 2000);
                }, 3000);
            }
        }
    }

    reduceMonsterAggression() {
        this.monsterAggroReductionTriggered = true;

        if (window.gameControls && window.gameControls.monsterAI) {
            const currentLevel = window.gameControls.monsterAI.aggressionLevel;
            if (currentLevel > 0) {
                const newLevel = Math.max(0, currentLevel - 1);
                window.gameControls.monsterAI.setAggressionLevel(newLevel);
                console.log(`👾 Monster aggression decreased after hiding for 10 seconds: ${currentLevel} -> ${newLevel}`);
                this.showMessage("You feel safer now...", 2000);
            }
        }
    }

    startPuzzle(puzzleData, puzzleObject) {
        switch (puzzleData.type) {
            case 'combination_lock':
                this.startCombinationPuzzle(puzzleData, puzzleObject);
                break;
            case 'book_cipher':
                this.startBookCipherPuzzle(puzzleObject);
                break;
            case 'mirror_sequence':
                this.startMirrorPuzzle(puzzleData, puzzleObject);
                break;
            case 'pressure_plate':
                this.startPressurePlatePuzzle(puzzleData, puzzleObject);
                break;
            default:
                this.startGenericPuzzle(puzzleData, puzzleObject);
        }
    }

    startCombinationPuzzle(puzzleData, puzzleObject) {
        this.showCombinationDialog(
            `${puzzleData.hint}\n\nEnter combination:`,
            (combination) => {
                if (this.gameManager.mansion.solvePuzzle(
                    this.gameManager.currentRoom.id, 
                    puzzleData.type, 
                    combination
                )) {
                    this.showMessage("Puzzle solved!");
                    this.gameManager.completeObjective(`puzzle_${this.gameManager.currentRoom.id}_${puzzleData.type}`);
                } else {
                    this.showMessage("Incorrect. Look around for more clues.");
                }
            }
        );
    }

    startBookCipherPuzzle(bookshelf) {
        const books = ['Red Book (1823)', 'Blue Book (1834)', 'Green Book (1845)', 'Yellow Book (1856)'];
        
        this.showBookArrangementDialog(
            "Arrange the books in chronological order:",
            books,
            (arrangement) => {
                const colors = arrangement.map(book => book.split(' ')[0].toLowerCase());
                if (this.gameManager.mansion.puzzleSystem?.solveBookCipher(bookshelf, colors)) {
                    this.showMessage("The books click into place! A secret compartment opens.");
                } else {
                    this.showMessage("Nothing happens. Try a different arrangement.");
                }
            }
        );
    }

    showMessage(message, duration = 3000) {
        this.messageQueue.push({ message, duration });
        if (!this.isMessageVisible) {
            this.processMessageQueue();
        }
    }

    processMessageQueue() {
        if (this.messageQueue.length === 0) {
            this.isMessageVisible = false;
            return;
        }

        this.isMessageVisible = true;
        const msg = this.messageQueue.shift();

        this.interactionPrompt.textContent = msg.message;
        this.interactionPrompt.style.display = 'block';
        
        setTimeout(() => {
            this.interactionPrompt.style.display = 'none';
            this.processMessageQueue();
        }, msg.duration);
    }

    showConfirmation(message, onConfirm, onCancel = null) {
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'confirmation';
        
        this.puzzleUI.innerHTML = `
            <h3>Confirmation</h3>
            <p>${message}</p>
            <div style="margin-top: 20px; text-align: center;">
                <button id="confirm-yes" style="margin: 0 10px; padding: 10px 20px; background: #2a5d2a; color: white; border: none; cursor: pointer;">Yes</button>
                <button id="confirm-no" style="margin: 0 10px; padding: 10px 20px; background: #5d2a2a; color: white; border: none; cursor: pointer;">No</button>
            </div>
        `;
        
        this.puzzleUI.style.display = 'block';
        
        document.getElementById('confirm-yes').onclick = () => {
            this.closePuzzleUI();
            if (onConfirm) onConfirm();
        };
        
        document.getElementById('confirm-no').onclick = () => {
            this.closePuzzleUI();
            if (onCancel) onCancel();
        };
    }

    showPuzzleDialog(title, description, options, onChoice) {
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'puzzle_dialog';
        
        const optionButtons = options.map((option, index) => 
            `<button onclick="window.puzzleChoiceCallback(${index})" style="
                display: block;
                width: 100%;
                margin: 5px 0;
                padding: 10px;
                background: #444;
                color: white;
                border: 1px solid #666;
                cursor: pointer;
                border-radius: 3px;
            ">${option}</button>`
        ).join('');
        
        this.puzzleUI.innerHTML = `
            <h3>${title}</h3>
            <p>${description}</p>
            <div style="margin-top: 20px;">
                ${optionButtons}
            </div>
        `;
        
        this.puzzleUI.style.display = 'block';
        
        window.puzzleChoiceCallback = (choice) => {
            this.closePuzzleUI();
            if (onChoice) onChoice(choice);
        };
    }

    showCombinationDialog(prompt, onSubmit) {
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'combination';
        
        this.puzzleUI.innerHTML = `
            <h3>Combination Lock</h3>
            <p>${prompt}</p>
            <div style="margin: 20px 0; text-align: center;">
                <input type="text" id="combination-input" maxlength="4" style="
                    font-size: 24px;
                    text-align: center;
                    width: 150px;
                    padding: 10px;
                    background: #333;
                    color: white;
                    border: 1px solid #666;
                    border-radius: 3px;
                ">
            </div>
            <div style="text-align: center;">
                <button id="submit-combination" style="padding: 10px 20px; background: #2a5d2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Submit</button>
                <button id="cancel-combination" style="padding: 10px 20px; background: #5d2a2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Cancel</button>
            </div>
        `;
        
        this.puzzleUI.style.display = 'block';
        
        const input = document.getElementById('combination-input');
        input.focus();
        
        const submitBtn = document.getElementById('submit-combination');
        const cancelBtn = document.getElementById('cancel-combination');
        
        const submit = () => {
            const combination = input.value;
            if (combination.length >= 3) {
                this.closePuzzleUI();
                if (onSubmit) onSubmit(combination);
            }
        };
        
        submitBtn.onclick = submit;
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
        
        cancelBtn.onclick = () => this.closePuzzleUI();
    }

    showTimeSettingDialog(prompt, currentTime, onSubmit) {
        this.currentInteraction = 'time_setting';
        
        const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
        
        this.puzzleUI.innerHTML = `
            <h3>Ancient Clock</h3>
            <p>${prompt}</p>
            <div style="margin: 20px 0; text-align: center;">
                <label>Hours: </label>
                <select id="hours-select" style="background: #333; color: white; border: 1px solid #666; padding: 5px; margin: 0 10px;">
                    ${Array.from({length: 12}, (_, i) => i + 1).map(h => 
                        `<option value="${h}" ${h === currentHours ? 'selected' : ''}>${h}</option>`
                    ).join('')}
                </select>
                <label>Minutes: </label>
                <select id="minutes-select" style="background: #333; color: white; border: 1px solid #666; padding: 5px; margin: 0 10px;">
                    ${Array.from({length: 60}, (_, i) => i).map(m => 
                        `<option value="${m}" ${m === currentMinutes ? 'selected' : ''}>${m.toString().padStart(2, '0')}</option>`
                    ).join('')}
                </select>
            </div>
            <div style="text-align: center;">
                <button id="submit-time" style="padding: 10px 20px; background: #2a5d2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Set Time</button>
                <button id="cancel-time" style="padding: 10px 20px; background: #5d2a2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Cancel</button>
            </div>
        `;
        
        this.puzzleUI.style.display = 'block';
        
        document.getElementById('submit-time').onclick = () => {
            const hours = parseInt(document.getElementById('hours-select').value);
            const minutes = parseInt(document.getElementById('minutes-select').value);
            this.closePuzzleUI();
            if (onSubmit) onSubmit(hours, minutes);
        };
        
        document.getElementById('cancel-time').onclick = () => this.closePuzzleUI();
    }

    showScrollDialog(title, content) {
        this.currentInteraction = 'scroll';
        
        this.puzzleUI.innerHTML = `
            <h3>${title}</h3>
            <div style="
                background: #222;
                padding: 15px;
                border: 1px solid #444;
                margin: 15px 0;
                font-style: italic;
                line-height: 1.5;
                max-height: 200px;
                overflow-y: auto;
            ">${content}</div>
            <div style="text-align: center;">
                <button id="close-scroll" style="padding: 10px 20px; background: #444; color: white; border: none; cursor: pointer;">Close</button>
            </div>
        `;
        
        this.puzzleUI.style.display = 'block';
        
        document.getElementById('close-scroll').onclick = () => this.closePuzzleUI();
    }

     closePuzzleUI() {
        // Hide the color puzzle if it's open
        const colorPuzzle = window.gameControls?.colorPuzzle;
        if (colorPuzzle && colorPuzzle.puzzleContainer.style.display !== 'none') {
            colorPuzzle.hide();
        }

        // Hide the wire puzzle if it's open
        const wirePuzzle = window.gameControls?.wirePuzzle;
        if (wirePuzzle && wirePuzzle.container.style.display !== 'none') {
            wirePuzzle.hide();
        }

        // Hide the keypad puzzle if it's open
        if (this.uiManager.uiElements.keypadContainer && this.uiManager.uiElements.keypadContainer.style.display !== 'none') {
            this.uiManager.hideKeypad();
        }

        // Hide the clue screen if it's open
        const clueScreen = this.uiManager.uiElements.clueScreen;
        if (clueScreen && clueScreen.style.display === 'flex') {
            clueScreen.style.display = 'none';
        }

        // Hide the generic dialog used by other puzzles
        this.puzzleUI.style.display = 'none';

        // This is now the single, authoritative place where controls are unfrozen.
        if (this.controls) this.controls.unfreeze();
        this.currentInteraction = null;

        // Set flag to prevent immediate re-interaction
        this.justClosedUI = true;
        setTimeout(() => {
            this.justClosedUI = false;
        }, 100); // 100ms debounce
    }

    updateCrosshair() {
        // Don't update crosshair during active interactions (dialogue, page view, etc)
        // Allow updates for sofa_movement and hiding
        if (this.currentInteraction && this.currentInteraction !== 'sofa_movement' && this.currentInteraction !== 'hiding') {
            // Only clear prompts if not showing a message (messages should persist)
            if (!this.isMessageVisible) {
                const currentPrompt = this.interactionPrompt.textContent;
                if (currentPrompt) {
                    console.log(`[Prompt] Force hiding during interaction: "${currentPrompt}" (currentInteraction: ${this.currentInteraction})`);
                }
                this.interactionPrompt.style.display = 'none';
                this.interactionPrompt.textContent = '';
                this.crosshair.style.background = 'white';
                this.crosshair.style.borderColor = 'rgba(255,255,255,0.8)';
                this.crosshair.style.width = '4px';
                this.crosshair.style.height = '4px';
            }
            return;
        }

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const currentScene = this.getCurrentScene();
        const intersects = this.raycaster.intersectObjects(currentScene.children, true);

        let isInteractable = false;
        let interactionPrompt = '';
        let blockedMessage = '';

        if (intersects.length > 0) {
            // PRIORITY: Check if mirror is in the raycast hits (prioritize mirror over page 6)
            let hitObject = intersects[0].object;
            let distance = intersects[0].distance;

            let mirrorHit = null;
            for (let i = 0; i < intersects.length; i++) {
                const interactData = this.findInteractableData(intersects[i].object);
                if (interactData?.data?.type === 'tic_tac_toe_mirror' && intersects[i].distance <= this.interactionRange) {
                    mirrorHit = { object: intersects[i].object, distance: intersects[i].distance, index: i };
                    break;
                }
            }

            // Use mirror if found, otherwise use closest interactable
            if (mirrorHit) {
                hitObject = mirrorHit.object;
                distance = mirrorHit.distance;
            }

            if (distance <= this.interactionRange) {
                const interactableData = this.findInteractableData(hitObject);

                if (interactableData) {
                    const interactionType = this.interactionTypes[interactableData.data.type];
                    const objectName = interactableData.object.name || 'unnamed';
                    const objectType = interactableData.data.type;

                    // Check if this is a page/page_slot and puzzle is completed
                    const isPagesLocked = this.gameManager.pagesPuzzleCompleted &&
                        (interactableData.data.type === 'page' || interactableData.data.type === 'page_slot');

                    // Check if page slot is blocked because laptop puzzle not complete
                    const isPageSlotBlocked = interactableData.data.type === 'page_slot' &&
                        !this.gameManager.laptopPuzzleCompleted;

                    // Check if phone puzzle not completed (for pages)
                    const isPagesBlocked = interactableData.data.type === 'page' &&
                        !this.gameManager.telephoneAnswered;

                    // Check if laptop is blocked (need all 6 pages first)
                    const isLaptopBlocked = interactableData.data.type === 'laptop' &&
                                           this.gameManager.collectedPages.length < 6;

                    // Check if item is interactable (for diary, fireplace, bucket, fuse_box, notepad, newspaper, loose_book)
                    const isNotYetInteractable = (interactableData.data.type === 'diary' ||
                                                  interactableData.data.type === 'fireplace' ||
                                                  interactableData.data.type === 'bucket' ||
                                                  interactableData.data.type === 'fuse_box' ||
                                                  interactableData.data.type === 'notepad' ||
                                                  interactableData.data.type === 'newspaper' ||
                                                  interactableData.data.type === 'loose_book') &&
                                                 !interactableData.data.interactable;

                    // Never show prompt for Annie (she's triggered through Page 4)
                    const isAnnie = this.annieInteraction.isAnnieBlock(interactableData);

                    // Check if sofa has already been moved
                    const isMovedSofa = interactableData.data.type === 'sofa' && interactableData.data.moved;

                    if (isAnnie) {
                        // Don't show any interaction prompt for Annie
                        isInteractable = false;
                    } else if (isMovedSofa) {
                        // Don't show any prompt for sofas that have already been moved
                        isInteractable = false;
                    } else if (isPagesLocked) {
                        blockedMessage = "The pages are sealed in place by ancient magic";
                    } else if (isPageSlotBlocked) {
                        blockedMessage = "These symbols don't make sense yet";
                    } else if (isPagesBlocked) {
                        blockedMessage = "I should focus on what's important first";
                    } else if (isLaptopBlocked) {
                        // Don't show any prompt for laptop until all pages collected
                        isInteractable = false;
                    } else if (isNotYetInteractable) {
                        // Don't show any prompt for items that aren't interactable yet
                        isInteractable = false;
                    } else {
                        isInteractable = true;
                        if (interactionType) {
                            // Special handling for page_slot to show different prompt based on whether page is placed
                            if (interactableData.data.type === 'page_slot') {
                                const slotIndex = interactableData.data.slotIndex;
                                const hasPage = this.gameManager.placedPages[slotIndex] !== null;
                                interactionPrompt = hasPage ? interactionType.promptWithPage : interactionType.prompt;
                            }
                            // Special handling for fuse_box to show different prompt if fixed
                            else if (interactableData.data.type === 'fuse_box') {
                                interactionPrompt = this.gameManager.fuseBoxFixed ?
                                    interactionType.fixedPrompt :
                                    interactionType.prompt;
                            }
                            // Special handling for sofa to show different prompt based on state
                            else if (interactableData.data.type === 'sofa') {
                                // Check if this sofa is currently being pushed
                                const isBeingPushed = this.movingSofa && this.movingSofa.sofa === interactableData.object;

                                if (isBeingPushed) {
                                    // Show progress while pushing (handled in updateSofaMovement)
                                    // Skip updating prompt here - updateSofaMovement will handle it
                                    return;
                                } else {
                                    // Moved sofas are handled earlier (isMovedSofa check), so this is only for unmoved sofas
                                    interactionPrompt = interactionType.prompt;
                                }
                            }
                            // Special handling for wardrobe to show different prompt based on hiding state
                            else if (interactableData.data.type === 'wardrobe') {
                                interactionPrompt = this.isHiding ?
                                    interactionType.hidingPrompt :
                                    interactionType.prompt;
                            }
                            // Special handling for tic-tac-toe mirror to show different prompt if telephone not answered
                            else if (interactableData.data.type === 'tic_tac_toe_mirror') {
                                if (interactableData.data.won) {
                                    interactionPrompt = interactionType.unlockedPrompt;
                                } else if (!this.gameManager.telephoneAnswered) {
                                    interactionPrompt = "The mirror is silent...";
                                } else {
                                    interactionPrompt = interactionType.prompt;
                                }
                            } else {
                                interactionPrompt = interactableData.data.locked ?
                                    (interactionType.lockedPrompt || interactionType.prompt) :
                                    interactionType.prompt;
                            }
                        }
                    }
                }
            }
        }

        // Only update UI if state has changed (prevents flashing)
        const currentPromptText = this.interactionPrompt.textContent;
        const currentPromptVisible = this.interactionPrompt.style.display === 'block';

        if (isInteractable && !this.blockInteractionPrompt) {
            // Only update if prompt text changed or visibility changed
            if (currentPromptText !== interactionPrompt || !currentPromptVisible) {
                // Get debug info from the last found interactable
                const debugInfo = intersects.length > 0 ?
                    this.findInteractableData(intersects[0].object) : null;
                const objName = debugInfo ? (debugInfo.object.name || 'unnamed') : 'none';
                const objType = debugInfo ? debugInfo.data.type : 'none';

                console.log(`[Prompt] Showing: "${interactionPrompt}" | Object: ${objName} (${objType}) | Source: updateCrosshair - interactable`);
                this.crosshair.style.background = '#00ff00';
                this.crosshair.style.borderColor = '#00ff00';
                this.crosshair.style.width = '8px';
                this.crosshair.style.height = '8px';
                this.interactionPrompt.textContent = interactionPrompt;
                this.interactionPrompt.style.display = 'block';
            }
        } else if (blockedMessage && !this.blockInteractionPrompt) {
            // Only update if message changed or visibility changed
            if (currentPromptText !== blockedMessage || !currentPromptVisible) {
                console.log(`[Prompt] Showing blocked: "${blockedMessage}" (from updateCrosshair - blocked)`);
                this.crosshair.style.background = '#ff6666';
                this.crosshair.style.borderColor = '#ff6666';
                this.crosshair.style.width = '6px';
                this.crosshair.style.height = '6px';
                this.interactionPrompt.textContent = blockedMessage;
                this.interactionPrompt.style.display = 'block';
            }
        } else {
            // Only hide if currently visible AND not showing a message
            if (currentPromptVisible && !this.isMessageVisible) {
                // Log what prompt is being hidden (but only for debugging, not for messages)
                console.log(`[Prompt] Hiding: "${currentPromptText}" (from updateCrosshair - no interaction)`);
                this.crosshair.style.background = 'white';
                this.crosshair.style.borderColor = 'rgba(255,255,255,0.8)';
                this.crosshair.style.width = '4px';
                this.crosshair.style.height = '4px';
                this.interactionPrompt.style.display = 'none';
                this.interactionPrompt.textContent = ''; // Clear text when hiding
            }
            // If a message is visible, leave it alone - processMessageQueue will handle hiding it
        }
    }

    animateItemPickup(item, onComplete) {
        const startPosition = item.position.clone();
        const endPosition = this.camera.position.clone();
        let progress = 0;
        
        const animate = () => {
            progress += 0.05;
            item.position.lerpVectors(startPosition, endPosition, progress);
            item.rotation.x += 0.1;
            item.rotation.y += 0.1;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };
        animate();
    }

    spawnHiddenItem(container, itemData) {
        const itemGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const itemMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const item = new THREE.Mesh(itemGeometry, itemMaterial);
        
        item.position.set(
            Math.random() * 0.5 - 0.25,
            0.5,
            Math.random() * 0.5 - 0.25
        );
        
        item.userData = itemData;
        container.add(item);
        
        const glowAnimation = () => {
            item.material.emissive.setHSL(0.15, 1, Math.sin(Date.now() * 0.005) * 0.2 + 0.2);
            requestAnimationFrame(glowAnimation);
        };
        glowAnimation();
    }

    tick(delta) {
        // Force camera to stay locked while hiding
        if (this.isHiding && this.lockedCameraPosition && this.lockedCameraQuaternion) {
            this.camera.position.copy(this.lockedCameraPosition);
            this.camera.quaternion.copy(this.lockedCameraQuaternion);

            // Also keep physics body locked at hiding position
            if (window.gameControls && window.gameControls.physicsManager) {
                const currentPos = window.gameControls.physicsManager.playerBody?.translation();
                if (currentPos) {
                    const distance = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z)
                        .distanceTo(this.lockedCameraPosition);
                    // If physics body has moved, teleport it back
                    if (distance > 0.1) {
                        window.gameControls.physicsManager.teleportTo(this.lockedCameraPosition);
                    }
                }
            }

            // Check hiding duration for timed events
            const hidingDuration = (Date.now() - this.hideStartTime) / 1000; // in seconds

            // At 8 seconds, make monster investigate hiding spot
            if (hidingDuration >= 8 && !this.monsterInvestigationTriggered) {
                this.triggerMonsterInvestigation();
            }

            // At 10 seconds, reduce monster aggression
            if (hidingDuration >= 10 && !this.monsterAggroReductionTriggered) {
                this.reduceMonsterAggression();
            }
        }

        if (!this.currentInteraction) {
            // Performance: Only update crosshair every 2nd frame
            this.crosshairUpdateCounter++;
            if (this.crosshairUpdateCounter >= this.crosshairUpdateInterval) {
                this.updateCrosshair();
                this.crosshairUpdateCounter = 0;
            }
        }

        // Handle gradual sofa movement
        this.updateSofaMovement(delta);

        this.updateInteractionEffects(delta);
    }

    updateSofaMovement(delta) {
        // If no sofa is being moved, return
        if (!this.movingSofa) return;

        // Don't update sofa movement if player is in dialogue or other interaction
        if (this.currentInteraction && this.currentInteraction !== 'sofa_movement') return;

        // If E key is not held, don't continue moving
        if (!this.isEKeyHeld) return;

        const { sofa, userData, distanceMoved } = this.movingSofa;

        // Check if we've reached max movement
        if (distanceMoved >= this.sofaMaxMovement) {
            // Mark as fully moved on this specific sofa's userData
            userData.moved = true;
            userData.distanceMoved = distanceMoved;

            // Removed message - sofa just stops moving silently
            console.log(`🛋️ ${sofa.name} fully moved. Final position: (${sofa.position.x.toFixed(2)}, ${sofa.position.y.toFixed(2)}, ${sofa.position.z.toFixed(2)})`);
            console.log(`🛋️ Sofa final userData:`, userData);

            // Recalculate physics for BOTH S_Sofa005 and S_Sofa006 each time either is moved
            const sofaName = this.movingSofa.sofaName || sofa.name;
            console.log(`🔧 Checking physics recalculation for sofa: "${sofaName}"`);

            // Check if this is one of the trigger sofas (handle both dot and no-dot naming)
            if (sofaName.includes('S_Sofa.005') || sofaName.includes('S_Sofa.006') ||
                sofaName.includes('S_Sofa005') || sofaName.includes('S_Sofa006') ||
                sofaName.includes('Sofa.005') || sofaName.includes('Sofa.006') ||
                sofaName.includes('Sofa005') || sofaName.includes('Sofa006')) {

                console.log(`🔧 Recalculating physics for BOTH sofas...`);
                console.log(`🔧 Available props:`, Array.from(this.gameManager.mansion.props.keys()));

                // Find both sofas in the scene - try multiple naming variations
                let sofa5 = this.gameManager.mansion.props.get('sofa_S_Sofa.005');
                if (!sofa5) sofa5 = this.gameManager.mansion.props.get('sofa_S_Sofa005');
                if (!sofa5) sofa5 = this.gameManager.mansion.props.get('S_Sofa.005');
                if (!sofa5) sofa5 = this.gameManager.mansion.props.get('S_Sofa005');

                let sofa6 = this.gameManager.mansion.props.get('sofa_S_Sofa.006');
                if (!sofa6) sofa6 = this.gameManager.mansion.props.get('sofa_S_Sofa006');
                if (!sofa6) sofa6 = this.gameManager.mansion.props.get('S_Sofa.006');
                if (!sofa6) sofa6 = this.gameManager.mansion.props.get('S_Sofa006');

                console.log(`🔧 Found sofa 5: ${!!sofa5} (name: ${sofa5?.name})`);
                console.log(`🔧 Found sofa 6: ${!!sofa6} (name: ${sofa6?.name})`);

                // If we couldn't find them in props, search the scene directly
                if (!sofa5 || !sofa6) {
                    console.log(`🔧 Sofas not found in props, searching scene...`);
                    this.scene.traverse((node) => {
                        if (node.userData && node.userData.type === 'sofa') {
                            const nodeName = node.name || '';
                            console.log(`  🔍 Found sofa in scene: ${nodeName}`);
                            if (!sofa5 && (nodeName.includes('Sofa.005') || nodeName.includes('Sofa005'))) {
                                sofa5 = node;
                                console.log(`  ✓ Assigned to sofa5`);
                            }
                            if (!sofa6 && (nodeName.includes('Sofa.006') || nodeName.includes('Sofa006'))) {
                                sofa6 = node;
                                console.log(`  ✓ Assigned to sofa6`);
                            }
                        }
                    });
                }

                // Recalculate sofa 5 first - pass mesh objects instead of names
                if (sofa5) {
                    console.log(`🔧 Recalculating physics for S_Sofa005...`);
                    let recalcCount = 0;
                    let successCount = 0;
                    sofa5.traverse((child) => {
                        if (child.isMesh && child.name) {
                            try {
                                // Pass the mesh object itself, not the name
                                const success = this.gameManager.mansion.recalculatePhysicsForObject(child);
                                if (success) {
                                    successCount++;
                                    console.log(`  ✓ S_Sofa005 child: ${child.name}`);
                                } else {
                                    console.log(`  ⚠ S_Sofa005 child not found: ${child.name}`);
                                }
                                recalcCount++;
                                console.log(`  ✓ S_Sofa005 child: ${child.name}`);
                            } catch (error) {
                                console.warn(`  ✗ Failed for ${child.name}:`, error);
                            }
                        }
                    });
                    console.log(`🔧 Recalculated ${successCount}/${recalcCount} physics bodies for S_Sofa005`);
                } else {
                    console.warn(`⚠️ Could not find S_Sofa005 in props for recalculation`);
                }

                // Then recalculate sofa 6 - pass mesh objects instead of names
                if (sofa6) {
                    console.log(`🔧 Recalculating physics for S_Sofa006...`);
                    let recalcCount = 0;
                    let successCount = 0;
                    sofa6.traverse((child) => {
                        if (child.isMesh && child.name) {
                            try {
                                // Pass the mesh object itself, not the name
                                const success = this.gameManager.mansion.recalculatePhysicsForObject(child);
                                if (success) {
                                    successCount++;
                                    console.log(`  ✓ S_Sofa006 child: ${child.name}`);
                                } else {
                                    console.log(`  ⚠ S_Sofa006 child not found: ${child.name}`);
                                }
                                recalcCount++;
                                console.log(`  ✓ S_Sofa006 child: ${child.name}`);
                            } catch (error) {
                                console.warn(`  ✗ Failed for ${child.name}:`, error);
                            }
                        }
                    });
                    console.log(`🔧 Recalculated ${successCount}/${recalcCount} physics bodies for S_Sofa006`);
                } else {
                    console.warn(`⚠️ Could not find S_Sofa006 in props for recalculation`);
                }

                console.log(`🔧 Sofa physics recalculation complete for both sofas`);
            } else {
                console.log(`⏭️ Skipping physics recalculation for ${sofaName} - not a trigger sofa`);
            }

            this.movingSofa = null;

            // Clear the interaction state
            if (this.currentInteraction === 'sofa_movement') {
                this.currentInteraction = null;
            }

            return;
        }

        // Calculate movement for this frame
        const moveAmount = Math.min(this.sofaMovementSpeed, this.sofaMaxMovement - distanceMoved);

        // Move the sofa in positive Z direction
        sofa.position.z += moveAmount;

        // Update distance moved
        this.movingSofa.distanceMoved += moveAmount;
        userData.distanceMoved = this.movingSofa.distanceMoved;

        // Update prompt to show progress
        const progress = (this.movingSofa.distanceMoved / this.sofaMaxMovement * 100).toFixed(0);
        const progressPrompt = `Pushing sofa... ${progress}% (Hold E)`;

        // Only update if changed (prevents spam)
        if (this.interactionPrompt.textContent !== progressPrompt) {
            console.log(`[Prompt] Showing: "${progressPrompt}" (from updateSofaMovement)`);
            this.interactionPrompt.textContent = progressPrompt;
            this.interactionPrompt.style.display = 'block';
        }
    }

    updateInteractionEffects(delta) {
    }

    showNearbyInteractables() {
        const nearbyObjects = [];
        
        this.scene.traverse((object) => {
            if (object.userData && object.userData.type) {
                const distance = this.camera.position.distanceTo(object.position);
                if (distance <= this.interactionRange * 2) {
                    nearbyObjects.push(object);
                }
            }
        });
        
        if (nearbyObjects.length > 0) {
            const objectList = nearbyObjects.map(obj => {
                const type = obj.userData.type;
                const distance = Math.round(this.camera.position.distanceTo(obj.position) * 10) / 10;
                return `${type} (${distance}m away)`;
            }).join(', ');
            
            this.showMessage(`Nearby: ${objectList}`, 5000);
            
            nearbyObjects.forEach(obj => {
                if (obj.material) {
                    const originalEmissive = obj.material.emissive.clone();
                    obj.material.emissive.setHex(0x444400);
                    
                    setTimeout(() => {
                        obj.material.emissive.copy(originalEmissive);
                    }, 2000);
                }
            });
        } else {
            this.showMessage("No interactable objects nearby");
        }
    }

    updateDoorVisual(door, isLocked) {
        const lockIndicator = door.getObjectByName('lock_indicator');
        if (lockIndicator) {
            lockIndicator.material.color.setHex(isLocked ? 0xff0000 : 0x00ff00);
        }
    }

    handleWeightObjectInteraction(object, userData) {
        if (userData.draggable) {
            this.gameManager.addToInventory({
                name: `${userData.weight} object`,
                type: 'weight_object',
                weight: userData.weight,
                object: object
            });
            
            this.animateItemPickup(object, () => {
                object.visible = false; 
            });
            
            this.showMessage(`Picked up ${userData.weight} object`);
        }
    }

    handlePressurePlateInteraction(plate, userData) {
        const weightObjects = this.gameManager.inventory.filter(item => item.type === 'weight_object');
        
        if (weightObjects.length === 0) {
            this.showMessage("You need objects to place on the pressure plate");
            return;
        }
        
        const options = weightObjects.map(obj => `Place ${obj.name}`);
        options.push("Cancel");
        
        this.showPuzzleDialog(
            "Pressure Plate",
            "Which object would you like to place?",
            options,
            (choice) => {
                if (choice < weightObjects.length) {
                    const selectedObject = weightObjects[choice];
                    this.placeObjectOnPlate(plate, selectedObject);
                    this.gameManager.removeFromInventory(selectedObject.name);
                }
            }
        );
    }

    placeObjectOnPlate(plate, weightObject) {
        const objectMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 8),
            new THREE.MeshLambertMaterial({ 
                color: weightObject.weight === 'heavy' ? 0x8B0000 :
                       weightObject.weight === 'medium' ? 0x0000FF : 0x00FF00
            })
        );
        
        objectMesh.position.copy(plate.position);
        objectMesh.position.y += 0.3;
        
        plate.userData.occupied = true;
        plate.userData.objectWeight = weightObject.weight;
        
        plate.parent.add(objectMesh);
        
        this.checkPressurePlatesPuzzle(plate.parent);
    }

    checkPressurePlatesPuzzle(puzzleGroup) {
        const plates = [];
        puzzleGroup.traverse((child) => {
            if (child.userData && child.userData.type === 'pressure_plate') {
                plates.push(child);
            }
        });
        
        const allFilled = plates.every(plate => plate.userData.occupied);
        if (!allFilled) return;
        
        const currentOrder = plates.map(plate => plate.userData.objectWeight);
        const correctOrder = ['heavy', 'medium', 'light', 'medium'];
        
        if (JSON.stringify(currentOrder) === JSON.stringify(correctOrder)) {
            this.showMessage("The pressure plates activate! You hear a mechanism turning...");
            if (puzzleGroup.userData && puzzleGroup.userData.type === 'puzzle') {
                puzzleGroup.userData.solved = true;
                this.gameManager.completeObjective(`puzzle_${this.gameManager.currentRoom.id}_pressure_plate`);
            }
        }
    }

    handleSymbolInteraction(symbol, userData) {
        if (userData.draggable) {
            this.gameManager.addToInventory({
                name: `${userData.name} symbol`,
                type: 'symbol',
                symbolName: userData.name,
                object: symbol
            });
            
            this.animateItemPickup(symbol, () => {
                symbol.visible = false;
            });
            
            this.showMessage(`Picked up ${userData.name} symbol`);
        }
    }

    handleSymbolSlotInteraction(slot, userData) {
        const symbols = this.gameManager.inventory.filter(item => item.type === 'symbol');
        
        if (symbols.length === 0) {
            this.showMessage("You need symbols to place here");
            return;
        }
        
        const options = symbols.map(symbol => `Place ${symbol.name}`);
        options.push("Cancel");
        
        this.showPuzzleDialog(
            "Symbol Slot",
            "Which symbol would you like to place?",
            options,
            (choice) => {
                if (choice < symbols.length) {
                    const selectedSymbol = symbols[choice];
                    this.placeSymbolInSlot(slot, selectedSymbol);
                    this.gameManager.removeFromInventory(selectedSymbol.name);
                }
            }
        );
    }

    placeSymbolInSlot(slot, symbol) {
        const symbolMesh = this.createSymbolMesh(symbol.symbolName);
        symbolMesh.position.copy(slot.position);
        symbolMesh.position.y += 0.1;
        
        slot.userData.occupied = true;
        slot.userData.symbolName = symbol.symbolName;
        
        slot.parent.add(symbolMesh);
        
        this.checkSymbolPuzzle(slot.parent);
    }

    createSymbolMesh(symbolName) {
        let geometry;
        let color;
        
        switch (symbolName) {
            case 'protection':
                geometry = new THREE.ConeGeometry(0.1, 0.2, 3);
                color = 0x0000FF;
                break;
            case 'banishment':
                geometry = new THREE.BoxGeometry(0.15, 0.15, 0.05);
                color = 0xFF0000;
                break;
            case 'sealing':
                geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 5);
                color = 0x00FF00;
                break;
            case 'peace':
                geometry = new THREE.SphereGeometry(0.1);
                color = 0xFFFFFF;
                break;
            default:
                geometry = new THREE.BoxGeometry(0.1, 0.1, 0.05);
                color = 0x888888;
        }
        
        return new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: color })
        );
    }

    checkSymbolPuzzle(puzzleGroup) {
        const slots = [];
        puzzleGroup.traverse((child) => {
            if (child.userData && child.userData.type === 'symbol_slot') {
                slots.push(child);
            }
        });
        
        const allFilled = slots.every(slot => slot.userData.occupied);
        if (!allFilled) return;
        
        const currentOrder = slots.map(slot => slot.userData.symbolName);
        const correctOrder = ['protection', 'banishment', 'sealing', 'peace'];
        
        if (JSON.stringify(currentOrder) === JSON.stringify(correctOrder)) {
            this.showMessage("The symbols glow and resonate with power! The final seal is broken!");
            
            this.createEscapePortal(puzzleGroup);
            
            if (puzzleGroup.userData && puzzleGroup.userData.type === 'puzzle') {
                puzzleGroup.userData.solved = true;
                this.gameManager.completeObjective(`puzzle_${this.gameManager.currentRoom.id}_symbol_matching`);
            }
        }
    }

    createEscapePortal(puzzleGroup) {
        const portalGeometry = new THREE.RingGeometry(1, 1.5, 16);
        const portalMaterial = new THREE.MeshLambertMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.7,
            emissive: 0x004444
        });
        
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        portal.position.set(0, 2, 0);
        portal.userData = {
            type: 'escape_portal',
            interactable: true
        };
        
        puzzleGroup.add(portal);
        
        const animatePortal = () => {
            portal.rotation.z += 0.02;
            portal.material.opacity = 0.7 + Math.sin(Date.now() * 0.005) * 0.2;
            requestAnimationFrame(animatePortal);
        };
        animatePortal();
        
        this.showMessage("A mysterious portal has appeared! This might be your way out!");
    }

    checkMirrorPuzzleSolution(mirrorPuzzle) {
        const mirrors = [];
        mirrorPuzzle.traverse((child) => {
            if (child.userData && child.userData.type === 'mirror') {
                mirrors.push(child);
            }
        });
        
        const correctAngles = [0, 45, 90, 135];
        let correct = true;
        
        mirrors.forEach((mirror, index) => {
            if ((mirror.userData.rotation || 0) !== correctAngles[index]) {
                correct = false;
            }
        });
        
        if (correct) {
            this.showMessage("The light beam reaches its target! A hidden mechanism activates!");
            
            this.createLightBeamEffect(mirrorPuzzle);
            
            if (mirrorPuzzle.userData) {
                mirrorPuzzle.userData.solved = true;
                this.gameManager.completeObjective(`puzzle_${this.gameManager.currentRoom.id}_mirror_sequence`);
            }
        }
    }

    createLightBeamEffect(mirrorPuzzle) {
        const beamGeometry = new THREE.CylinderGeometry(0.02, 0.02, 5);
        const beamMaterial = new THREE.MeshLambertMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8,
            emissive: 0x444444
        });
        
        const lightBeam = new THREE.Mesh(beamGeometry, beamMaterial);
        lightBeam.position.set(0, 1.5, 0);
        lightBeam.rotation.z = Math.PI / 2;
        
        mirrorPuzzle.add(lightBeam);
        
        const animateBeam = () => {
            lightBeam.material.opacity = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
            requestAnimationFrame(animateBeam);
        };
        animateBeam();
    }

    showBookArrangementDialog(title, books, onSubmit) {
        this.currentInteraction = 'book_arrangement';
        
        let currentOrder = [...books];
        
        const renderBooks = () => {
            const bookElements = currentOrder.map((book, index) => 
                `<div style="
                    background: #444;
                    color: white;
                    padding: 10px;
                    margin: 5px 0;
                    border: 1px solid #666;
                    cursor: pointer;
                    border-radius: 3px;
                " onclick="moveBook(${index})">${book}</div>`
            ).join('');
            
            return `
                <h3>${title}</h3>
                <p>Click books to move them up in the order:</p>
                <div style="margin: 15px 0;">
                    ${bookElements}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button id="submit-books" style="padding: 10px 20px; background: #2a5d2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Arrange Books</button>
                    <button id="reset-books" style="padding: 10px 20px; background: #5d5d2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Reset</button>
                    <button id="cancel-books" style="padding: 10px 20px; background: #5d2a2a; color: white; border: none; cursor: pointer; margin: 0 5px;">Cancel</button>
                </div>
            `;
        };
        
        this.puzzleUI.innerHTML = renderBooks();
        this.puzzleUI.style.display = 'block';
        
        window.moveBook = (index) => {
            if (index > 0) {
                const temp = currentOrder[index];
                currentOrder[index] = currentOrder[index - 1];
                currentOrder[index - 1] = temp;
                
                this.puzzleUI.innerHTML = renderBooks();
                this.setupBookDialogEvents();
            }
        };
        
        this.setupBookDialogEvents = () => {
            document.getElementById('submit-books').onclick = () => {
                this.closePuzzleUI();
                if (onSubmit) onSubmit(currentOrder);
            };
            
            document.getElementById('reset-books').onclick = () => {
                currentOrder = [...books];
                this.puzzleUI.innerHTML = renderBooks();
                this.setupBookDialogEvents();
            };
            
            document.getElementById('cancel-books').onclick = () => {
                this.closePuzzleUI();
            };
        };
        
        this.setupBookDialogEvents();
    }

    startGenericPuzzle(puzzleData, puzzleObject) {
        this.showPuzzleDialog(
            puzzleData.hint || "Mysterious Puzzle",
            "This puzzle requires careful observation and thought.",
            ["Attempt to solve", "Examine more closely", "Give up for now"],
            (choice) => {
                switch (choice) {
                    case 0: // Attempt to solve
                        if (Math.random() > 0.6) {
                            this.showMessage("You solve the puzzle through intuition and persistence!");
                            if (this.gameManager.mansion.solvePuzzle(
                                this.gameManager.currentRoom.id, 
                                puzzleData.type, 
                                'solved'
                            )) {
                                this.gameManager.completeObjective(`puzzle_${this.gameManager.currentRoom.id}_${puzzleData.type}`);
                            }
                        } else {
                            this.showMessage("Your attempt fails. Perhaps you need more information or a different approach.");
                        }
                        break;
                        
                    case 1: // Examine more closely
                        this.showMessage("Looking more closely, you notice some details you missed before. This might help with solving it.");
                        break;
                        
                    case 2: // Give up
                        this.showMessage("You step away from the puzzle. Sometimes a fresh perspective helps.");
                        break;
                }
            }
        );
    }

    // ========== OFFICE STAGE INTERACTIONS ==========


    async handleComputerInteraction(computer, userData) {
        console.log('💻 Player interacting with computer', userData);

        // Check if this is the office stage
        const currentStage = this.gameManager.stageManager ? this.gameManager.stageManager.currentStage : 'office';
        if (currentStage !== 'office') {
            console.warn(`⚠️ Computer interaction called on ${currentStage} stage, ignoring`);
            this.showMessage("The computer doesn't respond.");
            return;
        }

        // Prevent multiple simultaneous interactions
        if (this.currentInteraction) return;
        this.currentInteraction = 'computer';

        try {
            if (!userData.loggedIn) {
                await this.showComputerLogin(userData);
            } else {
                await this.showComputerDesktop(userData);
            }
        } finally {
            this.currentInteraction = null;
        }
    }

    async showComputerLogin(userData) {
        return new Promise(resolve => {
            // Freeze controls to disable game input while login screen is open
            if (this.controls) this.controls.freeze();

            const overlay = document.createElement('div');
            overlay.id = 'office-computer-login';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #0a0a0a;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            `;
            overlay.innerHTML = `
                <div style="
                    background: #0a0a0a;
                    border: 2px solid #00ff00;
                    padding: 40px;
                    border-radius: 5px;
                    max-width: 500px;
                    font-family: 'Courier New', monospace;
                    color: #00ff00;
                    text-shadow: 0 0 10px #00ff00;
                ">
                    <h1 style="margin-top: 0; text-align: center; letter-spacing: 2px;">LOGIN</h1>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px;">Username:</label>
                        <input id="office-username" type="text" value="journalist" disabled style="
                            width: 100%;
                            padding: 8px;
                            background: #0a0a0a;
                            border: 1px solid #00ff00;
                            color: #00ff00;
                            font-family: 'Courier New', monospace;
                            box-sizing: border-box;
                        ">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px;">Password:</label>
                        <input id="office-password" type="password" placeholder="Enter password..." autocomplete="off" style="
                            width: 100%;
                            padding: 8px;
                            background: #0a0a0a;
                            border: 1px solid #00ff00;
                            color: #00ff00;
                            font-family: 'Courier New', monospace;
                            box-sizing: border-box;
                        ">
                    </div>
                    <button id="office-login-btn" style="
                        width: 100%;
                        padding: 10px;
                        background: #0a0a0a;
                        border: 1px solid #00ff00;
                        color: #00ff00;
                        font-family: 'Courier New', monospace;
                        cursor: pointer;
                        margin-bottom: 10px;
                    ">LOGIN</button>
                    <button id="office-login-cancel" style="
                        width: 100%;
                        padding: 10px;
                        background: #0a0a0a;
                        border: 1px solid #00ff00;
                        color: #00ff00;
                        font-family: 'Courier New', monospace;
                        cursor: pointer;
                        margin-bottom: 10px;
                    ">EXIT</button>
                    <div id="office-login-error" style="color: #ff0000; text-align: center;"></div>
                </div>
            `;

            document.body.appendChild(overlay);

            const passwordInput = document.getElementById('office-password');
            const loginBtn = document.getElementById('office-login-btn');
            const errorMsg = document.getElementById('office-login-error');

            const handleLogin = async () => {
                const password = passwordInput.value.toUpperCase().replace(/\s+/g, '');
                console.log(password)
                if (password === 'MINECOLLAPSE') {
                    overlay.remove();
                    if (userData) {
                        userData.loggedIn = true;
                    }

                    // Show desktop
                    await this.showComputerDesktop(userData);

                    resolve();
                } else {
                    errorMsg.textContent = 'Incorrect password';
                    passwordInput.value = '';
                }
            };

            const cancelBtn = document.getElementById('office-login-cancel');

            loginBtn.addEventListener('click', handleLogin);
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleLogin();
                }
            });

            // Cancel button - unfreeze controls and close login screen
            cancelBtn.addEventListener('click', async () => {
                overlay.remove();
                // Unfreeze controls to re-enable game input
                if (this.controls) this.controls.unfreeze();

                // Trigger narrative on first exit from login
                if (!userData.loginAttempted) {
                    userData.loginAttempted = true;

                    // Enable notepad interaction
                    const notepadObject = this.gameManager?.mansion?.props?.get('notepad');
                    if (notepadObject) {
                        notepadObject.userData.interactable = true;
                        notepadObject.userData.loginAttempted = true;
                    }

                    // Trigger objective to find password
                    setTimeout(async () => {
                        await window.gameControls.narrativeManager.triggerEvent('office.login_objective');
                    }, 500);
                }

                // Prevent interaction immediately after closing login
                this.justClosedUI = true;
                setTimeout(() => {
                    this.justClosedUI = false;
                }, 100);
                this.currentInteraction = null;
                resolve();
            });

            // Focus password field
            setTimeout(() => passwordInput.focus(), 100);
        });
    }

    async showComputerDesktop(userData) {
        return new Promise(resolve => {
            // Freeze controls to disable game input while desktop is open
            if (this.controls) this.controls.freeze();

            const overlay = document.createElement('div');
            overlay.id = 'office-computer-desktop';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #0a0a0a;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            `;
            overlay.innerHTML = `
                <div style="
                    background: #0a0a0a;
                    border: 2px solid #00ff00;
                    width: 90%;
                    max-width: 700px;
                    padding: 20px;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    color: #00ff00;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #00ff00; padding-bottom: 10px;">
                        <span>Journalist's Computer</span>
                        <button id="office-close-desktop" style="
                            background: #0a0a0a;
                            border: 1px solid #00ff00;
                            color: #00ff00;
                            padding: 5px 10px;
                            cursor: pointer;
                            font-family: 'Courier New', monospace;
                        ">✕</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="office-file-icon" data-file="interview" style="cursor: pointer; text-align: center; padding: 20px; border: 1px solid #00ff00; border-radius: 3px;">
                            <div style="font-size: 40px; margin-bottom: 10px;">🎵</div>
                            <div>Interview.wav</div>
                        </div>
                        <div class="office-file-icon" data-file="mansion_layout" style="cursor: pointer; text-align: center; padding: 20px; border: 1px solid #00ff00; border-radius: 3px;">
                            <div style="font-size: 40px; margin-bottom: 10px;">🗺️</div>
                            <div>Mansion_Layout.jpg</div>
                        </div>
                        <div class="office-file-icon" data-file="note" style="cursor: pointer; text-align: center; padding: 20px; border: 1px solid #00ff00; border-radius: 3px;">
                            <div style="font-size: 40px; margin-bottom: 10px;">📝</div>
                            <div>NOTE.txt</div>
                        </div>
                        <div class="office-file-icon" data-file="evidence" style="cursor: pointer; text-align: center; padding: 20px; border: 1px solid #00ff00; border-radius: 3px;">
                            <div style="font-size: 40px; margin-bottom: 10px;">🔒</div>
                            <div>Evidence.zip</div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Setup file click handlers
            overlay.querySelectorAll('.office-file-icon').forEach(icon => {
                icon.addEventListener('click', async () => {
                    const fileType = icon.dataset.file;
                    await this.handleOfficeFileClick(fileType);
                });
            });

            // Close button
            overlay.querySelector('#office-close-desktop').addEventListener('click', () => {
                overlay.remove();
                // Unfreeze controls to re-enable game input
                if (this.controls) this.controls.unfreeze();
                // Prevent interaction immediately after closing desktop
                this.justClosedUI = true;
                setTimeout(() => {
                    this.justClosedUI = false;
                }, 100);
                resolve();
            });

            if (!userData.hasDoneSearchObjective) {
                userData.hasDoneSearchObjective = true;
                
                // Trigger search objective after desktop is shown
                setTimeout(async () => {
                    await window.gameControls.narrativeManager.triggerEvent('office.search_computer_objective');
                }, 500);
            }
        });
    }

    async handleOfficeFileClick(fileType) {
        console.log(`📂 Opening file: ${fileType}`);

        switch (fileType) {
            case 'interview':
                if (this.gameManager.audioManager) {
                    this.gameManager.audioManager.play('interview_audio');
                }
                this.showDesktopNotification('Playing interview audio...');
                break;

            case 'mansion_layout':
                this.showImageOverlay('Mansion Layout', '/assets/mansion_blueprint.jpg');
                break;

            case 'note':
                this.showDesktopNotification('Case number from missing persons report is needed for ZIP file.');

                // Trigger narrative events on first NOTE.txt read
                if (!this.noteNarrativeTriggered) {
                    this.noteNarrativeTriggered = true;
                    setTimeout(async () => {
                        try {
                            console.log('[InteractionSystem] Starting narrative triggers for NOTE.txt');
                            await window.gameControls.narrativeManager.triggerEvent('office.evidence_found');
                            console.log('[InteractionSystem] evidence_found done');
                            await window.gameControls.narrativeManager.triggerEvent('office.missing_persons_hint');
                            console.log('[InteractionSystem] missing_persons_hint done');
                            await window.gameControls.narrativeManager.triggerEvent('office.missing_persons_objective');
                            console.log('[InteractionSystem] missing_persons_objective done');

                            // Enable the loose book for interaction
                            if (this.gameManager.mansion && this.gameManager.mansion.props) {
                                const looseBook = this.gameManager.mansion.props.get('loose_book');
                                if (looseBook) {
                                    looseBook.userData.interactable = true;
                                    console.log('📖 Loose book is now interactable');
                                }
                            }
                        } catch (e) {
                            console.error('Error triggering narrative events:', e);
                        }
                    }, 1000);
                }
                break;

            case 'evidence':
                // Use custom password UI instead of browser prompt
                this.promptForZipPasswordUI();
                break;
        }
    }

    promptForZipPasswordUI() {
        const overlay = document.createElement('div');
        overlay.id = 'zip-password-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2100;
        `;

        const passwordDialog = document.createElement('div');
        passwordDialog.style.cssText = `
            background: #0a0a0a;
            border: 2px solid #00ff00;
            border-radius: 5px;
            padding: 30px;
            max-width: 400px;
            font-family: 'Courier New', monospace;
            color: #00ff00;
            text-align: center;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
        `;

        passwordDialog.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 1.3em; text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);">
                EVIDENCE.ZIP - PASSWORD REQUIRED
            </h2>
            <p style="margin: 0 0 20px 0; color: #aaa; font-size: 0.9em;">
                Enter the case number from the missing persons report:
            </p>
            <input type="password" id="zip-password-input" placeholder="Case Number" style="
                width: 100%;
                padding: 10px;
                background: #1a1a1a;
                border: 2px solid #00ff00;
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 1em;
                box-sizing: border-box;
                margin-bottom: 15px;
            ">
            <div id="zip-error-message" style="
                color: #ff0000;
                margin-bottom: 15px;
                min-height: 20px;
                font-size: 0.9em;
            "></div>
            <div style="display: flex; gap: 10px;">
                <button id="zip-submit-btn" style="
                    flex: 1;
                    padding: 10px;
                    background: #00ff00;
                    color: #000;
                    border: none;
                    font-weight: bold;
                    cursor: pointer;
                    font-family: 'Courier New', monospace;
                    border-radius: 3px;
                    transition: all 0.3s ease;
                ">UNLOCK</button>
                <button id="zip-cancel-btn" style="
                    flex: 1;
                    padding: 10px;
                    background: transparent;
                    color: #00ff00;
                    border: 2px solid #00ff00;
                    font-weight: bold;
                    cursor: pointer;
                    font-family: 'Courier New', monospace;
                    border-radius: 3px;
                    transition: all 0.3s ease;
                ">CANCEL</button>
            </div>
        `;

        overlay.appendChild(passwordDialog);
        document.body.appendChild(overlay);

        const passwordInput = document.getElementById('zip-password-input');
        const errorMessage = document.getElementById('zip-error-message');
        const submitBtn = document.getElementById('zip-submit-btn');
        const cancelBtn = document.getElementById('zip-cancel-btn');

        submitBtn.addEventListener('mouseover', (e) => {
            e.target.style.background = '#00dd00';
            e.target.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.8)';
        });

        submitBtn.addEventListener('mouseout', (e) => {
            e.target.style.background = '#00ff00';
            e.target.style.boxShadow = 'none';
        });

        const handleSubmit = async () => {
            const password = passwordInput.value;
            if (password === '8013') {
                overlay.remove();

                // Close the computer desktop
                const desktopOverlay = document.getElementById('office-computer-desktop');
                if (desktopOverlay) {
                    desktopOverlay.remove();
                }

                // Close any remaining overlays (double-check)
                const allOverlays = document.querySelectorAll('[id$="-overlay"], [id$="-desktop"]');
                allOverlays.forEach(el => el.remove());

                // Unfreeze controls
                if (this.controls) this.controls.unfreeze();

                // Clear the zip password objective
                if (this.gameManager && this.gameManager.uiManager) {
                    this.gameManager.uiManager.markObjectiveComplete('zip_password');
                }

                // Show lore screen first (blocks all input)
                await this.showLoreScreen();

                // Trigger capture sequence
                await this.triggerCaptureSequence();
            } else if (password) {
                errorMessage.textContent = 'Incorrect password. Check the missing persons report.';
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });

        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        });

        // Focus on input
        setTimeout(() => {
            passwordInput.focus();
        }, 100);
    }

    showDesktopNotification(message) {
        // Show notification within the desktop overlay
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #0a0a0a;
            border: 2px solid #00ff00;
            color: #00ff00;
            padding: 15px 20px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            z-index: 2010;
            max-width: 300px;
            white-space: pre-wrap;
            text-shadow: 0 0 10px #00ff00;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    async showLoreScreen() {
        // Create a blocking lore screen overlay that cannot be closed
        const overlay = document.createElement('div');
        overlay.id = 'lore-screen-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Courier New', monospace;
            color: #c2c2c2;
            cursor: not-allowed;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            max-width: 800px;
            text-align: center;
            padding: 40px;
            border: 2px solid #770000;
            background: rgba(0, 5, 16, 0.95);
        `;

        content.innerHTML = `
            <h2 style="color: #ff6b6b; margin-bottom: 30px; font-size: 24px;">CLASSIFIED</h2>
            <p style="font-size: 14px; line-height: 1.8; margin-bottom: 20px;">
                The Miller family vanished without a trace three months ago. No witnesses. No evidence.
                Just an empty home and questions that demand answers.
            </p>
            <p style="font-size: 14px; line-height: 1.8; margin-bottom: 20px; color: #ff9999;">
                Someone out there knows what happened. Someone has been hiding the truth.
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 40px;">
                [ You cannot escape what comes next ]
            </p>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // Prevent any interaction with the screen
        overlay.addEventListener('click', (e) => e.stopPropagation());
        overlay.addEventListener('contextmenu', (e) => e.preventDefault());
        overlay.addEventListener('wheel', (e) => e.preventDefault());

        // Wait 4 seconds then auto-remove
        await new Promise(resolve => setTimeout(resolve, 4000));

        overlay.remove();
    }

    async triggerCaptureSequence() {
        console.log('⚠️ Capture sequence triggered!');

        // Close any remaining overlays first (except the lore screen which already auto-removed)
        const allOverlays = document.querySelectorAll('[id$="-overlay"]:not(#capture-blackout), [id$="-desktop"]');
        allOverlays.forEach(overlay => overlay.remove());

        // Create persistent blackout overlay that will stay for entire transition
        const blackoutOverlay = document.createElement('div');
        blackoutOverlay.id = 'capture-blackout';
        blackoutOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 1);
            z-index: 20000;
            pointer-events: none;
        `;
        document.body.appendChild(blackoutOverlay);

        // Unfreeze controls
        if (this.controls) this.controls.unfreeze();

        // Reset interaction state so updateCrosshair will resume in next frame
        this.currentInteraction = null;

        // Disable office stage interactables before transition
        this.disableOfficeInteractables();

        // Close computer screen while player is blacked out
        const computerUI = document.getElementById('computer-desktop');
        if (computerUI) {
            computerUI.remove();
            console.log('💻 Computer screen closed before transition');
        }

        // Play the capture/knockout sound sequence (all while blacked out)
        const audioManager = this.gameManager.audioManager;
        if (audioManager) {
            // First bang on the door
            await audioManager.play('door_bang_1');
            await new Promise(resolve => setTimeout(resolve, 800));

            // Unlock sound
            await audioManager.play('door_unlock_click');
            await new Promise(resolve => setTimeout(resolve, 600));

            // Final loud bang
            await audioManager.play('door_bang_2_loud');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Stop all remaining audio
        if (audioManager) {
            audioManager.stopAll();
        }

        // Play capture narrative (also while blacked out)
        await window.gameControls.narrativeManager.triggerEvent('office.capture_triggered');

        // Brief dramatic pause (still blacked out)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Transition to mansion (blackout persists throughout)
        await window.gameControls.narrativeManager.triggerEvent('office.transition_to_mansion');

        // Wait a moment for the new stage to fully load and player to be positioned
        await new Promise(resolve => setTimeout(resolve, 500));

        // Now fade out the blackout to reveal the mansion
        blackoutOverlay.style.transition = 'opacity 1.5s ease-out';
        blackoutOverlay.style.opacity = '0';

        // Remove the blackout after fade completes
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (blackoutOverlay.parentNode) {
            blackoutOverlay.remove();
        }

        console.log('✅ Transition sequence complete - blackout removed');
    }

    /**
     * Disable all office stage interactables before transitioning away
     */
    disableOfficeInteractables() {
        const officeInteractables = ['computer', 'notepad', 'newspaper', 'loose_book'];

        this.scene.traverse((object) => {
            if (object.userData && officeInteractables.includes(object.userData.type)) {
                object.userData.interactable = false;
                console.log(`[InteractionSystem] Disabled interactable: ${object.userData.type}`);
            }
        });
    }

    showImageOverlay(title, imagePath) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2001;
        `;
        overlay.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%;">
                <button style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid white;
                    color: white;
                    padding: 5px 15px;
                    cursor: pointer;
                    z-index: 2002;
                ">Close</button>
                <img src="${imagePath}" alt="${title}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('button').addEventListener('click', () => {
            overlay.remove();
        });
    }

    async handleNotepadInteraction(notepad, userData) {
        console.log('📝 Player reading notepad');

        // Freeze controls while reading notepad
        if (this.controls) this.controls.freeze();

        const overlay = document.createElement('div');
        overlay.id = 'notepad-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

        const notepadDiv = document.createElement('div');
        notepadDiv.style.cssText = `
            width: 500px;
            height: 600px;
            background: #fef9e7;
            border: 3px solid #8b7355;
            border-radius: 3px;
            padding: 40px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            font-family: 'Courier New', monospace;
            overflow: hidden;
        `;

        notepadDiv.innerHTML = `
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.1), transparent);
            "></div>
            <h2 style="
                margin: 0 0 20px 0;
                color: #333;
                font-size: 18px;
                border-bottom: 2px solid #ccc;
                padding-bottom: 10px;
                text-align: center;
            ">Password Hint</h2>
            <div style="
                color: #333;
                font-size: 16px;
                line-height: 1.8;
                text-align: center;
                margin-bottom: 30px;
            ">
                <p style="margin: 10px 0; font-style: italic;">"My first big break"</p>
            </div>
        `;

        // Create close button separately
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            bottom: 30px;
            right: 30px;
            padding: 10px 20px;
            background: #8b7355;
            color: #fef9e7;
            border: 1px solid #5d4a37;
            border-radius: 3px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        `;

        notepadDiv.appendChild(closeBtn);
        overlay.appendChild(notepadDiv);
        document.body.appendChild(overlay);

        // Close button handler
        closeBtn.addEventListener('click', async () => {
            overlay.remove();
            // Unfreeze controls
            if (this.controls) this.controls.unfreeze();

            // Trigger investigate objective on first notepad read
            if (!userData.notepadRead) {
                userData.notepadRead = true;

                // Enable newspaper interaction
                const newspaperObject = this.gameManager?.mansion?.props?.get('newspaper');
                if (newspaperObject) {
                    newspaperObject.userData.interactable = true;
                    newspaperObject.userData.notepadRead = true;
                }

                await window.gameControls.narrativeManager.triggerEvent('office.investigate_objective');
            }

            // Prevent immediate re-interaction
            this.justClosedUI = true;
            setTimeout(() => {
                this.justClosedUI = false;
            }, 200);
        });

        // Allow clicking outside to close
        overlay.addEventListener('click', async (e) => {
            if (e.target === overlay) {
                overlay.remove();
                // Unfreeze controls
                if (this.controls) this.controls.unfreeze();

                // Enable newspaper on first notepad read
                if (!userData.notepadRead) {
                    userData.notepadRead = true;

                    // Enable newspaper interaction
                    const newspaperObject = this.gameManager?.mansion?.props?.get('newspaper');
                    if (newspaperObject) {
                        newspaperObject.userData.interactable = true;
                        newspaperObject.userData.notepadRead = true;
                    }

                    await window.gameControls.narrativeManager.triggerEvent('office.investigate_objective');
                }

                // Prevent immediate re-interaction
                this.justClosedUI = true;
                setTimeout(() => {
                    this.justClosedUI = false;
                }, 200);
            }
        });
    }

    async handleNewspaperInteraction(newspaper, userData) {
        console.log('📰 Player reading newspaper');

        // Freeze controls while reading newspaper
        if (this.controls) this.controls.freeze();

        const overlay = document.createElement('div');
        overlay.id = 'newspaper-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

        const newspaperDiv = document.createElement('div');
        newspaperDiv.style.cssText = `
            width: 600px;
            height: 700px;
            background: #e8e4d9;
            border: 4px solid #654321;
            border-radius: 2px;
            padding: 30px;
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.9), inset 0 0 15px rgba(0, 0, 0, 0.1);
            position: relative;
            font-family: 'Times New Roman', serif;
            overflow-y: auto;
        `;

        newspaperDiv.innerHTML = `
            <div style="
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 3px double #654321;
                padding-bottom: 15px;
            ">
                <h1 style="
                    margin: 0 0 5px 0;
                    color: #000;
                    font-size: 32px;
                    letter-spacing: 2px;
                ">MINE COLLAPSE</h1>
                <p style="
                    margin: 5px 0 0 0;
                    color: #333;
                    font-size: 12px;
                    font-style: italic;
                ">Your Biggest Investigative Piece</p>
            </div>
            <div style="
                color: #000;
                font-size: 14px;
                line-height: 1.8;
                columns: 2;
                column-gap: 20px;
                text-align: justify;
            ">
                <p>In what investigators are calling one of the most significant industrial disasters of the decade, the Blackstone Mine collapsed early this morning, trapping 47 workers underground.</p>
                <p>The mine, operated by Meridian Mining Corporation, had been flagged by safety inspectors multiple times in the past year. Documents obtained by this reporter reveal systematic negligence and ignored safety violations.</p>
                <p>Rescue efforts continue as emergency crews work around the clock. The company has released no official statement regarding the incident.</p>
            </div>
        `;

        // Create close button separately
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #654321;
            color: #e8e4d9;
            border: 1px solid #3d2817;
            border-radius: 2px;
            cursor: pointer;
            font-family: 'Times New Roman', serif;
            font-size: 14px;
        `;

        newspaperDiv.appendChild(closeBtn);
        overlay.appendChild(newspaperDiv);
        document.body.appendChild(overlay);

        // Close button handler
        closeBtn.addEventListener('click', async () => {
            overlay.remove();
            // Unfreeze controls
            if (this.controls) this.controls.unfreeze();

            // Trigger narrative events on first newspaper read
            if (!userData.hasRead) {
                userData.hasRead = true;
                setTimeout(async () => {
                    await window.gameControls.narrativeManager.triggerEvent('office.newspaper_hint');
                    await window.gameControls.narrativeManager.triggerEvent('office.computer_password_objective');
                }, 500);
            }

            // Prevent immediate re-interaction
            this.justClosedUI = true;
            setTimeout(() => {
                this.justClosedUI = false;
            }, 200);
        });

        // Allow clicking outside to close
        overlay.addEventListener('click', async (e) => {
            if (e.target === overlay) {
                overlay.remove();
                // Unfreeze controls
                if (this.controls) this.controls.unfreeze();

                // Trigger narrative events on first newspaper read
                if (!userData.hasRead) {
                    userData.hasRead = true;
                    setTimeout(async () => {
                        await window.gameControls.narrativeManager.triggerEvent('office.newspaper_hint');
                        await window.gameControls.narrativeManager.triggerEvent('office.computer_password_objective');
                    }, 500);
                }

                // Prevent immediate re-interaction
                this.justClosedUI = true;
                setTimeout(() => {
                    this.justClosedUI = false;
                }, 200);
            }
        });
    }

    async handleLooseBookInteraction(book, userData) {
        console.log('📖 Player finding missing persons report');

        if (!userData.found) {
            userData.found = true;
            // Make book non-interactable after finding it
            userData.interactable = false;

            // Add to inventory
            this.gameManager.addToInventory({
                name: 'Missing Persons Report',
                type: 'document',
                description: 'Case report for the Miller disappearance. Case No. 8013',
                caseNumber: 8013
            });

            this.showMessage('You found a hidden missing persons report! Case No. 8013');

            // Trigger narrative events on finding case file
            setTimeout(async () => {
                await window.gameControls.narrativeManager.triggerEvent('office.case_file_found');
                await window.gameControls.narrativeManager.triggerEvent('office.zip_password_realization');
                await window.gameControls.narrativeManager.triggerEvent('office.zip_password_objective');
                // Mark that the missing persons objective has been found
                this.gameManager.completeObjective('find_case_file');
            }, 500);
        } else {
            this.showMessage('The book is now empty.');
        }
    }

    dispose() {
        document.removeEventListener('click', this.onMouseClick);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('touchstart', this.onTouchStart);
        document.removeEventListener('touchend', this.onTouchEnd);
        
        if (this.crosshair) {
            document.body.removeChild(this.crosshair);
        }
        if (this.interactionPrompt) {
            document.body.removeChild(this.interactionPrompt);
        }
        if (this.puzzleUI) {
            document.body.removeChild(this.puzzleUI);
        }
        
        if (window.puzzleChoiceCallback) {
            delete window.puzzleChoiceCallback;
        }
        if (window.moveBook) {
            delete window.moveBook;
        }
    }

    /**
     * Handle interaction with the tic-tac-toe mirror
     */
    async handleTicTacToeMirrorInteraction(mirror, userData) {
        console.log('🪞 Mirror interaction handler called');
        console.log('  userData.won:', userData.won);

        // Check if telephone has been answered first
        if (!this.gameManager.telephoneAnswered) {
            console.log('❌ Telephone not answered - blocking mirror puzzle');
            this.showMessage("The mirror whispers... 'Answer the call first, then we shall play...'");
            return;
        }

        // Check if player has already won the tic-tac-toe puzzle
        if (userData.won) {
            console.log('  Already won - showing unlocked message');
            this.showMessage(this.interactionTypes.tic_tac_toe_mirror.unlockedPrompt);
            return;
        }

        // Show the tic-tac-toe puzzle
        console.log('  Freezing controls and starting puzzle...');
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'tic_tac_toe';

        // Get the puzzle from the controls
        const ticTacToePuzzle = this.controls.puzzles.ticTacToePuzzle;
        console.log('  Puzzle found:', !!ticTacToePuzzle);

        if (!ticTacToePuzzle) {
            console.error('❌ Tic-tac-toe puzzle not found in controls.puzzles');
            console.log('  Available puzzles:', Object.keys(this.controls.puzzles || {}));
            if (this.controls) this.controls.unfreeze();
            return;
        }

        // Set up the win callback
        ticTacToePuzzle.onSolve(() => {
            console.log('🎮 Tic-tac-toe puzzle won!');

            // Mark the mirror as won so player can collect page 6
            userData.won = true;
            console.log('✅ Set mirror userData.won = true');
            console.log('Mirror userData after win:', userData);

            // Also mark it on the mirror object itself to be safe
            const mirrorObj = this.gameManager.mansion.props.get('tic_tac_toe_mirror');
            if (mirrorObj && mirrorObj.userData) {
                mirrorObj.userData.won = true;
                console.log('✅ Also set mirror object userData.won = true');
            }

            // Make page 6 interactable
            const page6 = this.gameManager.mansion.pages.find(p => p.name === 'S_Page6');
            if (page6) {
                page6.userData.interactable = true;
                console.log('✨ Page 6 is now unlocked!');
                console.log('Page 6 userData:', page6.userData);
            } else {
                console.warn('⚠️ Could not find Page 6 in mansion.pages');
                console.log('Available pages:', this.gameManager.mansion.pages.map(p => p.name));
            }

            // Unfreeze controls
            if (this.controls) this.controls.unfreeze();

            // Show success message
            this.showMessage('The ghost has released page 6. Collect it to progress...');
        });

        // Set up the close callback
        ticTacToePuzzle.onClose(() => {
            console.log('🎮 Puzzle closed');
            if (this.controls) this.controls.unfreeze();
            this.currentInteraction = null;
        });

        // Show the puzzle UI
        console.log('🎮 Calling ticTacToePuzzle.show()...');
        ticTacToePuzzle.show();
        console.log('🎮 ticTacToePuzzle.show() returned');
    }
}

export { InteractionSystem };

