// src/systems/InteractionSystem.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

class InteractionSystem {
    constructor(camera, scene, gameManager, uiManager, controls) {
        this.camera = camera;
        this.scene = scene;
        this.gameManager = gameManager;
        this.uiManager = uiManager;
        this.controls = controls;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactableObjects = new Map();
        this.currentInteraction = null;
        this.interactionRange = 5;

        this.messageQueue = [];
        this.isMessageVisible = false;
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
        document.addEventListener('click', this.onMouseClick.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
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

    // MERGED: This list is from the more detailed File 1, but with prompts adjusted for File 2's logic.
    registerInteractionTypes() {
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
                lockedPrompt: "Door is locked", // The specific key is mentioned in the logic
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
                prompt: "Press E to use the safe", // Kept from File 2
                lockedPrompt: "Safe is locked",
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
                prompt: "Press E to look at the clock", // Kept from File 2
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
            }
        };
    }

    // --- KEPT FROM FILE 2: Safe Keypad Logic ---
    setupKeypadListeners() {
        const keypadElement = this.uiManager.uiElements.keypadContainer;
        if (!keypadElement) return;

        const buttons = keypadElement.querySelectorAll('.keypad-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const keypadDisplay = this.uiManager.uiElements.keypadDisplay;
                if (!keypadDisplay) return;

                const value = button.textContent;
                if (value === 'C') {
                    keypadDisplay.textContent = '';
                } else if (keypadDisplay.textContent.length < 4) {
                    keypadDisplay.textContent += value;
                }
            });
        });

        const enterButton = keypadElement.querySelector('#keypad-enter-button');
        if (enterButton) {
            enterButton.onclick = () => {
                this.checkSafePassword();
            };
        }
    }

    showKeypad() {
        const keypadElement = this.uiManager.uiElements.keypadContainer;
        const keypadDisplay = this.uiManager.uiElements.keypadDisplay;
        if (!keypadElement || !keypadDisplay) return;
        
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'keypad';
        keypadElement.style.display = 'flex';
        keypadDisplay.textContent = '';

        if (!keypadElement.listenersAttached) {
            this.setupKeypadListeners();
            keypadElement.listenersAttached = true;
        }
    }

    hideKeypad() {
        const keypadElement = this.uiManager.uiElements.keypadContainer;
        if (keypadElement) {
            keypadElement.style.display = 'none';
        }
        if (this.controls && this.controls.isFrozen) {
             this.controls.unfreeze();
        }
        this.currentInteraction = null;
    }

    checkSafePassword() {
        const keypadDisplay = this.uiManager.uiElements.keypadDisplay;
        if (!keypadDisplay) return;

        const enteredPassword = keypadDisplay.textContent;
        if (enteredPassword === this.gameManager.safePassword) {
            this.showMessage("Correct! The safe is open.");
            this.gameManager.isSafeOpen = true;

            const safeObject = this.gameManager.mansion.getProp('safe');
            const safeDoor = safeObject ? safeObject.getObjectByName('S_Safe_Door') : null;

            if (safeDoor) {
                safeDoor.userData.locked = false;

                const originalParent = safeDoor.parent;
                const pivot = new THREE.Object3D();
                pivot.position.copy(safeDoor.position);
                pivot.rotation.copy(safeDoor.rotation);
                originalParent.add(pivot);

                const doorBox = new THREE.Box3().setFromObject(safeDoor);
                const doorWidth = doorBox.max.x - doorBox.min.x;
                safeDoor.position.set(doorWidth / 2, 0, 0);
                pivot.add(safeDoor);

                let rotation = 0;
                const animateOpen = () => {
                    rotation -= 0.02;
                    if (rotation > -Math.PI / 1.8) {
                        pivot.rotation.y = rotation;
                        requestAnimationFrame(animateOpen);
                    }
                };
                animateOpen();
                
                const keyInSafe = this.gameManager.mansion.getProp('safe_key');
                if (keyInSafe) {
                    keyInSafe.visible = true;
                }
            }
            this.hideKeypad();
        } else {
            this.showMessage("Incorrect password.");
            keypadDisplay.textContent = '';
        }
    }
    // --- END OF KEPT SAFE LOGIC ---

    onMouseClick(event) {
        if (this.controls && this.controls.isFrozen) return;
        if (this.currentInteraction) return;
        this.checkInteraction();
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyE':
                if (this.controls && this.controls.isFrozen) return;
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

    onKeyUp(event) {}

    onTouchStart(event) {
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

    // REPLACED: This is the working interaction logic from File 1.
    checkInteraction() {
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
        if (object.userData && object.userData.type) {
            return { object: object, data: object.userData };
        }
        
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

    // --- The following handlers are merged from the more detailed File 1 ---
    
    handlePageInteraction(pageObject, userData) {
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
        if (this.gameManager.pagesPuzzleCompleted) {
            this.showMessage("The pages are sealed in place by an ancient magic.");
            return;
        }

        if (!this.gameManager.laptopPuzzleCompleted) {
            this.showMessage("The symbols don't make any sense. I need to decipher them first.");
            return;
        }

        const slotIndex = userData.slotIndex;
        if (this.gameManager.placedPages[slotIndex]) {
            this.gameManager.removePageFromSlot(slotIndex);
        }

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
            window.gameControls.narrativeManager.triggerEvent('stage1.phone_dead_line_1').then(() => {
                window.gameControls.narrativeManager.triggerEvent('stage1.phone_dead_line_2');
            });
            return;
        }
        this.gameManager.answerTelephone();
        userData.interacted = true;
    }

    async handleLaptopInteraction(laptopObject, userData) {
        const clue = "> The pages must be placed in the order of the cosmos: Sun, Star, Eye, Hand, Spiral, Moon.";
        await window.gameControls.narrativeManager.triggerEvent('stage1.laptop_puzzle_speech');

        if (this.isColorPuzzleSolved) {
            this.showClueScreenDialog(clue);
            return;
        }

        const colorPuzzle = window.gameControls.colorPuzzle;
        if (colorPuzzle) {
            if (this.controls) this.controls.freeze();
            this.currentInteraction = 'color_puzzle';
            colorPuzzle.show(4, () => this.closePuzzleUI());
            colorPuzzle.onSolve(() => {
                this.isColorPuzzleSolved = true;
                this.showClueScreenDialog(clue);
                window.gameControls.gameManager.completeObjective('decipher_pages');
                window.gameControls.narrativeManager.triggerEvent('stage1.all_pages_placed');
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
                clueTextElement.textContent = clueText;
            }
            clueScreen.style.display = 'flex';
            setTimeout(() => clueScreen.focus(), 50);
        }
    }

    // KEPT: This is the door logic from File 2
    handleDoorInteraction(door, userData) {
        if (userData.locked) {
            const requiredKeyId = userData.key; 
            if (this.gameManager.hasItemById(requiredKeyId)) {
                this.showConfirmation(
                    `Use the ${requiredKeyId.replace(/_/g, ' ')} to unlock this door?`,
                    () => { 
                        this.gameManager.removeFromInventory(requiredKeyId.replace(/_/g, ' '));
                        userData.locked = false;
                        this.showMessage("The door has been unlocked!");
                        this.gameManager.mansion.openDoor(door);
                    }
                );
            } else {
                this.showMessage(`The door is locked. You need the ${requiredKeyId.replace(/_/g, ' ')}.`);
            }
        } else {
            this.gameManager.mansion.openDoor(door);
        }
    }

    // KEPT: This is the key logic from File 2 (with better name formatting)
    handleKeyInteraction(key, userData) {
        if (userData.keyId) {
            this.gameManager.addToInventory({
                name: userData.keyId.replace(/_/g, ' '),
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

    // KEPT: This is the safe logic from File 2
    handleSafeInteraction(safe, userData) {
        if (this.gameManager.isSafeOpen) {
            this.showMessage("The safe is already open.");
            return;
        }
        this.showKeypad();
    }
    
    // KEPT: This is the clock logic from File 2
    handleClockInteraction(clock, userData) {
        const hours = "11";
        const minutes = "47";
        const password = `${hours}${minutes}`;
        this.gameManager.setSafePassword(password);
        this.showMessage(`The clock's hands are frozen at ${hours}:${minutes}.`);
    }

    // ... All other complex puzzle handlers are now included from File 1
    handleBookInteraction(book, userData) {
        const bookTitle = userData.title || "Mysterious Book";
        const bookContent = userData.content || "The pages are yellowed with age...";
        this.showScrollDialog(bookTitle, bookContent);
        if (userData.clue) {
            this.showMessage(`You notice something important: ${userData.clue}`);
        }
    }

    handleFurnitureInteraction(furniture, userData) {
         this.showMessage(`You search the ${furniture.name.split('_')[1] || 'furniture'} but find nothing of interest.`);
    }

    handlePuzzleInteraction(puzzle, userData) {
        this.showMessage("This looks like a complex puzzle.");
    }
    
    handleMirrorInteraction(mirror, userData) {
        this.showMessage("The mirror is dusty. It can be rotated.");
    }
    
    handlePressurePlateInteraction(plate, userData) {
        this.showMessage("A pressure plate. It needs some weight.");
    }

    handleWeightObjectInteraction(object, userData) {
        this.showMessage("This looks heavy.");
    }

    handleSymbolInteraction(symbol, userData) {
        this.showMessage("A strange symbol.");
    }

    handleSymbolSlotInteraction(slot, userData) {
        this.showMessage("Something fits in here.");
    }
    
    handleScrollInteraction(scroll, userData) {
        this.showScrollDialog(userData.name || "Ancient Scroll", userData.content || "The text is too faded...");
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
        if (this.gameManager.fuseBoxFixed) {
            this.showMessage("The fuse box is already working.");
            return;
        }
        if (this.gameManager.gameStage !== 2) {
            this.showMessage("The fuse box seems to be working fine.");
            return;
        }
        await window.gameControls.narrativeManager.triggerEvent('stage2.fuse_box_examine');
        const wirePuzzle = window.gameControls.wirePuzzle;
        if (wirePuzzle) {
            if (this.controls) this.controls.freeze();
            this.currentInteraction = 'wire_puzzle';
            wirePuzzle.show();
            wirePuzzle.onSolve(() => {
                this.gameManager.fixFuseBox();
                userData.fixed = true;
            });
            wirePuzzle.onClose(() => this.closePuzzleUI());
        }
    }
    
    // --- The following are UI and utility functions, mostly from File 1 ---
    
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
            `<button onclick="window.puzzleChoiceCallback(${index})" style="display: block; width: 100%; margin: 5px 0; padding: 10px; background: #444; color: white; border: 1px solid #666; cursor: pointer; border-radius: 3px;">${option}</button>`
        ).join('');
        this.puzzleUI.innerHTML = `
            <h3>${title}</h3>
            <p>${description}</p>
            <div style="margin-top: 20px;">${optionButtons}</div>
        `;
        this.puzzleUI.style.display = 'block';
        window.puzzleChoiceCallback = (choice) => {
            this.closePuzzleUI();
            if (onChoice) onChoice(choice);
        };
    }

    showScrollDialog(title, content) {
        if (this.controls) this.controls.freeze();
        this.currentInteraction = 'scroll';
        this.puzzleUI.innerHTML = `
            <h3>${title}</h3>
            <div style="background: #222; padding: 15px; border: 1px solid #444; margin: 15px 0; font-style: italic; line-height: 1.5; max-height: 200px; overflow-y: auto;">${content}</div>
            <div style="text-align: center;">
                <button id="close-scroll" style="padding: 10px 20px; background: #444; color: white; border: none; cursor: pointer;">Close</button>
            </div>
        `;
        this.puzzleUI.style.display = 'block';
        document.getElementById('close-scroll').onclick = () => this.closePuzzleUI();
    }
    
    closePuzzleUI() {
        if (this.currentInteraction === 'keypad') {
            this.hideKeypad();
        }
        
        const colorPuzzle = window.gameControls?.colorPuzzle;
        if (colorPuzzle && colorPuzzle.puzzleContainer.style.display !== 'none') {
            colorPuzzle.hide();
        }
    
        const clueScreen = this.uiManager.uiElements.clueScreen;
        if (clueScreen && clueScreen.style.display === 'flex') {
            clueScreen.style.display = 'none';
        }
    
        this.puzzleUI.style.display = 'none';
    
        if (this.controls) this.controls.unfreeze();
        this.currentInteraction = null;
    }

    updateCrosshair() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let isInteractable = false;
        let interactionPrompt = '';

        if (intersects.length > 0 && intersects[0].distance <= this.interactionRange) {
            const interactableData = this.findInteractableData(intersects[0].object);
            if (interactableData) {
                const isPagesLocked = this.gameManager.pagesPuzzleCompleted && (interactableData.data.type === 'page' || interactableData.data.type === 'page_slot');
                if (!isPagesLocked) {
                    isInteractable = true;
                    const interactionType = this.interactionTypes[interactableData.data.type];
                    if (interactionType) {
                        interactionPrompt = interactableData.data.locked ? (interactionType.lockedPrompt || interactionType.prompt) : interactionType.prompt;
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
    
    tick(delta) {
        if (!this.currentInteraction) {
            this.updateCrosshair();
        }
    }

    dispose() {
        document.removeEventListener('click', this.onMouseClick);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('keydown', this.onKeyDown);
        // ... remove other listeners

        if (this.crosshair) document.body.removeChild(this.crosshair);
        if (this.interactionPrompt) document.body.removeChild(this.interactionPrompt);
        if (this.puzzleUI) document.body.removeChild(this.puzzleUI);
        
        if (window.puzzleChoiceCallback) delete window.puzzleChoiceCallback;
    }
}

export { InteractionSystem };