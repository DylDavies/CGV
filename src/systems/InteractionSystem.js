// src/systems/InteractionSystem.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

class InteractionSystem {
   constructor(camera, scene, gameManager, uiManager, controls) {
        this.camera = camera;
        this.scene = scene;
        this.gameManager = gameManager;
        this.uiManager = uiManager; // uiManager was missing from the original constructor but is used, so I've added it.
        this.controls = controls; // NEW: Store the controls object
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactableObjects = new Map();
        this.highlightedObject = null;
        this.currentInteraction = null;
        this.interactionRange = 5; // Maximum interaction distance

        // Performance: Throttle crosshair raycasting
        this.crosshairUpdateCounter = 0;
        this.crosshairUpdateInterval = 2; // Update every 2nd frame

        this.messageQueue = []; // NEW: A queue for interaction messages.
        this.isMessageVisible = false; // NEW: A flag to check visibility.
        this.isColorPuzzleSolved = false;
        
        // UI Elements
        this.crosshair = null;
        this.interactionPrompt = null;
        this.puzzleUI = null;
        
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
            }
        };
    }

    onMouseClick(event) {
         // If controls are frozen for a puzzle, do nothing.
        if (this.controls && this.controls.isFrozen) {
            return;
        }
        
        if (this.currentInteraction) return;
        
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
                if (this.controls && this.controls.isFrozen) {
                return;
                }
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
        // Handle key up events if needed
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

    checkInteraction() {
        // Cast ray from camera center
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            const distance = intersects[0].distance;
            
            if (distance <= this.interactionRange) {
                const interactableData = this.findInteractableData(intersectedObject);
                if (interactableData) {
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
        const interactionType = this.interactionTypes[userData.type];
        if (interactionType && interactionType.handler) {
            interactionType.handler(object, userData);
        } else {
            console.warn(`No handler for interaction type: ${userData.type}`);
        }
    }

    handlePageInteraction(pageObject, userData) {
        // NEW: Check if pages puzzle is completed
        if (this.gameManager.pagesPuzzleCompleted) {
            this.showMessage("The pages are sealed in place by an ancient magic.");
            return;
        }

        if (userData.pageId) {
            this.gameManager.collectPage(userData.pageId);
            this.animateItemPickup(pageObject, () => {
                if (pageObject.parent) {
                    pageObject.parent.remove(pageObject);
                }
            });
        } else {
            console.warn("Tried to pick up a page with no pageId property:", pageObject.name);
        }
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

                for (const child of door.children) {
                    this.gameManager.mansion.recalculatePhysicsForObject(child.name);
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
        if (userData.solved) {
            this.showMessage("The safe is already open.");
            return;
        }

        this.showMessage("There's a note on the safe: 'The old clock holds the key to my secrets.'");
        
        this.gameManager.puzzleSystem.startKeypadPuzzle();
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

            // Turn off the lights
            this.gameManager.lightsOn = false;
            if (this.gameManager.mansion) {
                this.gameManager.mansion.setAllLightsEnabled(false);
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
        if (this.gameManager.mansion) {
            this.gameManager.mansion.disableDiaryGlow();
        }

        // Show the diary page
        this.showDiaryPage();

        // Wait a moment for the user to see the diary, then trigger the objective change
        setTimeout(async () => {
            // Make both fireplace objects interactable
            const fireplace = this.gameManager.mansion.props.get('fireplace');
            if (fireplace) {
                fireplace.userData.interactable = true;
            }
            const fireplaceFire = this.gameManager.mansion.props.get('fireplace_fire');
            if (fireplaceFire) {
                fireplaceFire.userData.interactable = true;
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

        // Check if player has bucket and fire is not out yet
        if (this.gameManager.hasItem('Bucket') && !userData.fireOut) {
            console.log('🔥 Player has bucket, putting out fire...');

            // Mark both fireplace objects as fire out
            userData.fireOut = true;
            const fireplaceObj = this.gameManager.mansion.props.get('fireplace');
            if (fireplaceObj && fireplaceObj.userData) {
                fireplaceObj.userData.fireOut = true;
            }
            const fireplaceFire = this.gameManager.mansion.props.get('fireplace_fire');
            if (fireplaceFire && fireplaceFire.userData) {
                fireplaceFire.userData.fireOut = true;
            }

            this.showMessage("You pour the water on the fire...");

            // Extinguish ALL fires in the mansion (same method as when lights go out)
            this.gameManager.mansion.setFireplacesEnabled(false);

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
            const fireplaceObj = this.gameManager.mansion.props.get('fireplace');
            if (fireplaceObj && fireplaceObj.userData) {
                fireplaceObj.userData.inspected = true;
            }
            const fireplaceFire = this.gameManager.mansion.props.get('fireplace_fire');
            if (fireplaceFire && fireplaceFire.userData) {
                fireplaceFire.userData.inspected = true;
            }

            await window.gameControls.narrativeManager.triggerEvent('stage1.fireplace_too_hot');
            this.gameManager.completeObjective('inspect_fireplace');

            // Make bucket interactable
            const bucket = this.gameManager.mansion.props.get('bucket');
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
    
        // Hide the clue screen if it's open
        const clueScreen = this.uiManager.uiElements.clueScreen;
        if (clueScreen && clueScreen.style.display === 'flex') {
            clueScreen.style.display = 'none';
        }
    
        // Hide the generic dialog used by other puzzles
        this.puzzleUI.style.display = 'none';
    
        // This is now the single, authoritative place where controls are unfrozen.
        if (this.controls) this.controls.unfreeze();
        this.currentInteraction = null; // This is the line that fixes the interaction lock.
    }

    updateCrosshair() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let isInteractable = false;
        let interactionPrompt = '';
        let blockedMessage = '';

        if (intersects.length > 0) {
            const distance = intersects[0].distance;
            if (distance <= this.interactionRange) {
                const interactableData = this.findInteractableData(intersects[0].object);
                if (interactableData) {
                    const interactionType = this.interactionTypes[interactableData.data.type];

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

                    // Check if item is interactable (for diary, fireplace, bucket, fuse_box)
                    const isNotYetInteractable = (interactableData.data.type === 'diary' ||
                                                  interactableData.data.type === 'fireplace' ||
                                                  interactableData.data.type === 'bucket' ||
                                                  interactableData.data.type === 'fuse_box') &&
                                                 !interactableData.data.interactable;

                    if (isPagesLocked) {
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

        if (isInteractable) {
            this.crosshair.style.background = '#00ff00';
            this.crosshair.style.borderColor = '#00ff00';
            this.crosshair.style.width = '8px';
            this.crosshair.style.height = '8px';
            this.interactionPrompt.textContent = interactionPrompt;
            this.interactionPrompt.style.display = 'block';
        } else if (blockedMessage) {
            // Show blocked message with red crosshair
            this.crosshair.style.background = '#ff6666';
            this.crosshair.style.borderColor = '#ff6666';
            this.crosshair.style.width = '6px';
            this.crosshair.style.height = '6px';
            this.interactionPrompt.textContent = blockedMessage;
            this.interactionPrompt.style.display = 'block';
        } else {
            this.crosshair.style.background = 'white';
            this.crosshair.style.borderColor = 'rgba(255,255,255,0.8)';
            this.crosshair.style.width = '4px';
            this.crosshair.style.height = '4px';
            this.interactionPrompt.style.display = 'none';
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
        if (!this.currentInteraction) {
            // Performance: Only update crosshair every 2nd frame
            this.crosshairUpdateCounter++;
            if (this.crosshairUpdateCounter >= this.crosshairUpdateInterval) {
                this.updateCrosshair();
                this.crosshairUpdateCounter = 0;
            }
        }

        this.updateInteractionEffects(delta);
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
}

export { InteractionSystem };

