// src/systems/InteractionSystem.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class InteractionSystem {
    constructor(camera, scene, gameManager) {
        this.camera = camera;
        this.scene = scene;
        this.gameManager = gameManager;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactableObjects = new Map();
        this.highlightedObject = null;
        this.currentInteraction = null;
        this.interactionRange = 5; // Maximum interaction distance
        
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
        document.body.appendChild(this.puzzleUI);
    }

    registerInteractionTypes() {
        // Register different types of interactions
        this.interactionTypes = {
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
            }
        };
    }

    onMouseClick(event) {
        if (this.currentInteraction) return; // Don't process if puzzle UI is open
        
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

    // Interaction Handlers

    handleTelephoneInteraction(phone, userData) {
        // Stop the ringing sound
        this.gameManager.audioManager.stopSound('phone_ringing', 500); // 500ms fade out

        // Trigger a narrative event
        window.gameControls.narrativeManager.triggerEvent('stage1.phone_call_black_screen');
    }

    handleDoorInteraction(door, userData) {
        const doorData = this.gameManager.mansion.doors.find(d => 
            d.mesh === door || d.mesh === door.parent
        );
        
        if (doorData) {
            if (doorData.locked) {
                const requiredKey = doorData.key;
                if (this.gameManager.hasItem(requiredKey)) {
                    this.showConfirmation(
                        `Use ${requiredKey} to unlock door?`,
                        () => {
                            this.gameManager.removeFromInventory(requiredKey);
                            doorData.locked = false;
                            this.updateDoorVisual(door, false);
                            this.showMessage("Door unlocked!");
                        }
                    );
                } else {
                    this.showMessage("This door is locked. You need a key.");
                }
            } else {
                this.showMessage("Door is already unlocked.");
                // Could add door opening animation here
            }
        }
    }

    handleKeyInteraction(key, userData) {
        if (userData.keyId) {
            this.gameManager.addToInventory({
                name: userData.name || userData.keyId,
                type: 'key',
                id: userData.keyId
            });
            
            // Remove key from scene with animation
            this.animateItemPickup(key, () => {
                if (key.parent) {
                    key.parent.remove(key);
                }
            });
        }
    }

    handleBookInteraction(book, userData) {
        const bookTitle = userData.title || "Mysterious Book";
        const bookContent = userData.content || "The pages are yellowed with age and filled with strange symbols and text you can barely make out...";

        this.showScrollDialog(bookTitle, bookContent);

        // Some books might contain clues or trigger events
        if (userData.clue) {
            this.showMessage(`You notice something important: ${userData.clue}`);
        }

        if (userData.triggersEvent) {
            // Handle special book events
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
                            // Start book cipher puzzle
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
                
                // Start the appropriate puzzle
                this.startPuzzle(puzzleData, puzzle);
            }
        }
    }

    handleSafeInteraction(safe, userData) {
        if (userData.solved) {
            this.showMessage("The safe is already open.");
            return;
        }
        
        this.showCombinationDialog(
            "Enter 4-digit combination:",
            (combination) => {
                if (this.gameManager.mansion.puzzleSystem?.solveCombinationSafe(safe, combination)) {
                    this.showMessage("Safe opened! You hear something dropping inside.");
                    userData.solved = true;
                } else {
                    this.showMessage("Incorrect combination. Look around for clues.");
                }
            }
        );
    }

    handleMirrorInteraction(mirror, userData) {
        if (userData.rotatable) {
            userData.rotation = (userData.rotation || 0) + 45;
            if (userData.rotation >= 360) userData.rotation = 0;
            
            mirror.rotation.z = (userData.rotation * Math.PI) / 180;
            
            this.showMessage(`Mirror rotated to ${userData.rotation}°`);
            
            // Check if mirror puzzle is solved
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

    // Puzzle-specific methods

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
        // Show book arrangement interface
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

    // UI Dialog Methods

    showMessage(message, duration = 3000) {
        this.interactionPrompt.textContent = message;
        this.interactionPrompt.style.display = 'block';
        
        setTimeout(() => {
            this.interactionPrompt.style.display = 'none';
        }, duration);
    }

    showConfirmation(message, onConfirm, onCancel = null) {
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
        this.puzzleUI.style.display = 'none';
        this.currentInteraction = null;
        
        // Clean up any global callbacks
        if (window.puzzleChoiceCallback) {
            delete window.puzzleChoiceCallback;
        }
    }

    // Utility methods

    updateCrosshair() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        let isInteractable = false;
        let interactionPrompt = '';
        
        if (intersects.length > 0) {
            const distance = intersects[0].distance;
            if (distance <= this.interactionRange) {
                const interactableData = this.findInteractableData(intersects[0].object);
                if (interactableData) {
                    isInteractable = true;
                    const interactionType = this.interactionTypes[interactableData.data.type];
                    if (interactionType) {
                        interactionPrompt = interactableData.data.locked ? 
                            (interactionType.lockedPrompt || interactionType.prompt) : 
                            interactionType.prompt;
                    }
                }
            }
        }
        
        // Update crosshair appearance
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
        
        // Add glowing effect
        const glowAnimation = () => {
            item.material.emissive.setHSL(0.15, 1, Math.sin(Date.now() * 0.005) * 0.2 + 0.2);
            requestAnimationFrame(glowAnimation);
        };
        glowAnimation();
    }

    tick(delta) {
        if (!this.currentInteraction) {
            this.updateCrosshair();
        }
        
        // Update any ongoing animations or effects
        this.updateInteractionEffects(delta);
    }

    updateInteractionEffects(delta) {
        // Update any glowing or pulsing effects on interactable objects
        // This could be expanded to highlight nearby interactables
    }

    showNearbyInteractables() {
        // Highlight all nearby interactable objects temporarily
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
            
            // Temporarily highlight objects
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
        // Update door appearance based on lock status
        const lockIndicator = door.getObjectByName('lock_indicator');
        if (lockIndicator) {
            lockIndicator.material.color.setHex(isLocked ? 0xff0000 : 0x00ff00);
        }
    }

    // Advanced puzzle interactions

    handleWeightObjectInteraction(object, userData) {
        if (userData.draggable) {
            this.gameManager.addToInventory({
                name: `${userData.weight} object`,
                type: 'weight_object',
                weight: userData.weight,
                object: object
            });
            
            this.animateItemPickup(object, () => {
                object.visible = false; // Hide but don't remove for potential replacement
            });
            
            this.showMessage(`Picked up ${userData.weight} object`);
        }
    }

    handlePressurePlateInteraction(plate, userData) {
        // Check if player has weight objects in inventory
        const weightObjects = this.gameManager.inventory.filter(item => item.type === 'weight_object');
        
        if (weightObjects.length === 0) {
            this.showMessage("You need objects to place on the pressure plate");
            return;
        }
        
        // Show selection dialog for which object to place
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
        // Create visual representation on the plate
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
        
        // Check if all plates are filled correctly
        this.checkPressurePlatesPuzzle(plate.parent);
    }

    checkPressurePlatesPuzzle(puzzleGroup) {
        const plates = [];
        puzzleGroup.traverse((child) => {
            if (child.userData && child.userData.type === 'pressure_plate') {
                plates.push(child);
            }
        });
        
        // Check if all plates have objects
        const allFilled = plates.every(plate => plate.userData.occupied);
        if (!allFilled) return;
        
        // Check if weights are in correct order
        const currentOrder = plates.map(plate => plate.userData.objectWeight);
        const correctOrder = ['heavy', 'medium', 'light', 'medium'];
        
        if (JSON.stringify(currentOrder) === JSON.stringify(correctOrder)) {
            this.showMessage("The pressure plates activate! You hear a mechanism turning...");
            // Trigger puzzle completion
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
        // Create visual representation in the slot
        const symbolMesh = this.createSymbolMesh(symbol.symbolName);
        symbolMesh.position.copy(slot.position);
        symbolMesh.position.y += 0.1;
        
        slot.userData.occupied = true;
        slot.userData.symbolName = symbol.symbolName;
        
        slot.parent.add(symbolMesh);
        
        // Check if puzzle is complete
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
        
        // Check if all slots are filled
        const allFilled = slots.every(slot => slot.userData.occupied);
        if (!allFilled) return;
        
        // Check if symbols are in correct order
        const currentOrder = slots.map(slot => slot.userData.symbolName);
        const correctOrder = ['protection', 'banishment', 'sealing', 'peace'];
        
        if (JSON.stringify(currentOrder) === JSON.stringify(correctOrder)) {
            this.showMessage("The symbols glow and resonate with power! The final seal is broken!");
            
            // Create the escape portal
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
        
        // Add portal animation
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
        
        // Check if all mirrors are at correct angles
        const correctAngles = [0, 45, 90, 135];
        let correct = true;
        
        mirrors.forEach((mirror, index) => {
            if ((mirror.userData.rotation || 0) !== correctAngles[index]) {
                correct = false;
            }
        });
        
        if (correct) {
            this.showMessage("The light beam reaches its target! A hidden mechanism activates!");
            
            // Add light beam visual effect
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
        
        // Animate the beam
        const animateBeam = () => {
            lightBeam.material.opacity = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
            requestAnimationFrame(animateBeam);
        };
        animateBeam();
    }

    showBookArrangementDialog(title, books, onSubmit) {
        this.currentInteraction = 'book_arrangement';
        
        // Create a simple drag-and-drop like interface
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
                // Move book up one position
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
                        // Simple probability-based solution for generic puzzles
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
                        // Could provide additional hints here
                        break;
                        
                    case 2: // Give up
                        this.showMessage("You step away from the puzzle. Sometimes a fresh perspective helps.");
                        break;
                }
            }
        );
    }

    // Cleanup
    dispose() {
        // Remove event listeners
        document.removeEventListener('click', this.onMouseClick);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('touchstart', this.onTouchStart);
        document.removeEventListener('touchend', this.onTouchEnd);
        
        // Remove UI elements
        if (this.crosshair) {
            document.body.removeChild(this.crosshair);
        }
        if (this.interactionPrompt) {
            document.body.removeChild(this.interactionPrompt);
        }
        if (this.puzzleUI) {
            document.body.removeChild(this.puzzleUI);
        }
        
        // Clean up any global callbacks
        if (window.puzzleChoiceCallback) {
            delete window.puzzleChoiceCallback;
        }
        if (window.moveBook) {
            delete window.moveBook;
        }
    }
}

export { InteractionSystem };