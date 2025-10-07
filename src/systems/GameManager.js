import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';

// Define the data for each page
const PAGE_DATA = {
    'S_Page1': { symbol: 'sun', message: 'The first light reveals the path.' },
    'S_Page2': { symbol: 'moon', message: 'But the second shadow conceals it.' },
    'S_Page3': { symbol: 'star', message: 'The third star guides the lost.' },
    'S_Page4': { symbol: 'hand', message: 'A fourth hand offers a false choice.' },
    'S_Page5': { symbol: 'eye', message: 'The fifth eye sees the truth.' },
    'S_Page6': { symbol: 'spiral', message: 'And the sixth spiral unwinds destiny.' }
};

class GameManager {
    constructor(mansion, camera, scene, uiManager, audioManager, controls) {
        this.mansion = mansion;
        this.camera = camera;
        this.scene = scene;
        this.uiManager = uiManager;
        this.audioManager = audioManager;
        this.controls = controls;   // NEW: Store the controls object
        this.inventory = [];
        this.collectedPages = [];
        this.placedPages = new Array(6).fill(null); // Tracks pages placed on the wall
        this.pageSolution = ['S_Page1', 'S_Page2', 'S_Page3', 'S_Page4', 'S_Page5', 'S_Page6'];
        this.pagesPuzzleCompleted = false; // NEW: Track if pages puzzle is solved
        this.currentRoom = null;
        this.previousRoom = null;
        this.gameState = 'playing'; // 'playing', 'won', 'lost', 'paused'
        this.gameStage = 1; // NEW: Track game stage (1 or 2)
        this.lightsOn = true; // NEW: Track light state
        this.fuseBoxFixed = false; // NEW: Track if fuse box puzzle is complete
        this.telephoneAnswered = false; // NEW: Track if phone has been answered
        this.laptopPuzzleCompleted = false; // NEW: Track if laptop puzzle is complete
        this.masterBedroomKey = false;
        this.safePuzzleSolved = false;

        this.objectives = [];

        this.gameStats = {
            startTime: Date.now(),
            roomsVisited: new Set(),
            puzzlesSolved: 0,
            itemsCollected: 0,
            hintsUsed: 0
        };

        this.hintQueue = []; // NEW: A queue to hold pending hints.
        this.isHintVisible = false; // NEW: A flag to check if a hint is on screen.
        this.allPagesPlaced = false;
        this.puzzleFailureCount = 0; // Track wrong puzzle attempts
        this.maxPuzzleFailures = 3; // Die after 3 failures


        this.ui = this.createUI();
        this.audioEnabled = true;
        this.nextAmbientSoundTime = this.getRandomAmbientTime();

        this.initializeGame();
    }

    getRandomAmbientTime() {
        return Math.random() * 60 + 10; // generate random time interval used for ambient sounds
    }

    initializeGame() {
        console.log("🎮 Initializing game...");

        // Make phone start ringing 30 seconds into the game
        setTimeout(() => {
            this.startPhoneRingEvent();
        }, 30000); // 30 seconds

        this.updateUI();
        this.showWelcomeMessage();
    }

    solveSafePuzzle() {
        this.safePuzzleSolved = true;
        this.addToInventory({
            name: 'Entrance Key',
            type: 'key',
            id: 'entrance_key',
            description: 'A key that might open the entrance door.'
        });
        this.showHint("You found a key inside the safe!");
    }

    async showStage1Title() {
        // Called from main.js after all systems are initialized
        await window.gameControls.narrativeManager.triggerEvent('intro.stage_1_title');
    }

    startPhoneRingEvent() {
        console.log("☎️ Starting phone ring event...");
        
        // Trigger narrative events
        window.gameControls.narrativeManager.triggerEvent('intro.speech_bubble_2');
        window.gameControls.narrativeManager.triggerEvent('intro.objective_1');

        const soundSourceMesh = this.mansion.getProp('telephone');
        if (soundSourceMesh) {
            this.audioManager.playLoopingPositionalSound('phone_ringing', this.audioManager.soundPaths.rotaryPhone, soundSourceMesh, 10);
        } 
    }
    
    async answerTelephone() {
        console.log("📞 Answering the telephone...");

        this.audioManager.stopSound('phone_ringing', 500);
        this.telephoneAnswered = true; // NEW: Mark phone as answered
        this.completeObjective('answer_telephone');

        await window.gameControls.narrativeManager.triggerEvent('stage1.phone_ring_speech');
        await window.gameControls.narrativeManager.triggerEvent('stage1.phone_call_black_screen');

        // Trigger new objective - find pages
        await window.gameControls.narrativeManager.triggerEvent('stage1.objective_find_pages');

        // Enable page glow now that phone is answered
        if (this.mansion) {
            this.mansion.enablePageGlow();
        }
    }
    
    completeObjective(objectiveId) {
        console.log(`[GameManager] Objective '${objectiveId}' reported as complete.`);
        // Mark obj as complted
        this.uiManager.markObjectiveComplete(objectiveId);
        
        // You can still have logic that runs after an objective is completed
        if (objectiveId === 'answer_telephone') {
            // For example, trigger the next narrative event here.
            // window.gameControls.narrativeManager.triggerEvent('stage1.next_objective');
        }
    }

    
    // MODIFIED: This now shows a message when a page is collected
    async collectPage(pageId) {

        const slotIndex = this.placedPages.indexOf(pageId);
        if (slotIndex !== -1) {
            // If it is, call the remove function instead and exit.
            this.removePageFromSlot(slotIndex);
            return;
        }

        if (this.collectedPages.includes(pageId)) {
            return; 
        }

        // Narrative event for when the first page is collected
        if (this.collectedPages.length === 0) {
            await window.gameControls.narrativeManager.triggerEvent('stage1.collect_pages_speech');
        }

        this.collectedPages.push(pageId);
        const pageData = PAGE_DATA[pageId];

        this.addToInventory({
            name: `Page (${pageData.symbol})`,
            type: 'scroll',
            description: 'A strange page with a unique symbol.',
            stackable: false,
            pageId: pageId, // Store the ID for placing it later
            symbol: pageData.symbol
        });

        if (this.collectedPages.length >= 6) {
            // After collecting all pages, trigger speech and objective to decipher them.
            await window.gameControls.narrativeManager.triggerEvent('stage1.all_pages_found');
            await window.gameControls.narrativeManager.triggerEvent('stage1.decipher_pages');
            this.completeObjective('collect_pages');
        }

        this.updateUI();
    }

    // NEW: Handles placing a page on a wall slot
    placePage(slotIndex, pageItem) {
        // Remove the page from inventory
        this.removeFromInventory(pageItem.name);

        // Record the placement
        this.placedPages[slotIndex] = pageItem.pageId;

        // Tell MansionLoader to create the visual
        if (this.mansion) {
            this.mansion.displayPageOnSlot(slotIndex, pageItem.pageId);
        }

        this.checkPageOrder();
    }

    // NEW: Checks if the placed pages match the solution
   async checkPageOrder() {
        if (this.placedPages.includes(null)) {
            return; // Exit if not all slots are filled.
        }


        let isCorrect = this.placedPages.every((pageId, index) => pageId === this.pageSolution[index]);

        if (isCorrect && !this.allPagesPlaced) {
            this.allPagesPlaced = true; // Prevent this from running again.

            this.completeObjective('place_pages');

            // Make all placed pages glow
            this.pageSolution.forEach((pageId) => {
                if (this.mansion) {
                    this.mansion.activatePageSymbolGlow(pageId);
                }
            });

            await window.gameControls.narrativeManager.triggerEvent('stage1.truth_is_found');

            // Trigger warning about monster awakening
            window.gameControls.narrativeManager.triggerEvent('stage1.monster_awaken_warning');

            // Monster attack and stage 2 transition sequence
            setTimeout(async () => {
                window.gameControls.audioManager.playSound('player_hit', 'public/audio/sfx/hit_sound.mp3');
                window.gameControls.narrativeManager.showBlackout();
                window.gameControls.physicsManager.teleportTo(new THREE.Vector3(0, 1.8, 0));
                await window.gameControls.narrativeManager.triggerEvent('stage1.attacked_by_monster');
                await window.gameControls.narrativeManager.triggerEvent('intro.wake_up');

                // Start Stage 2
                this.startStage2();
            }, 5000);

        } else if (!isCorrect) {
            // Wrong order - increment failure count
            this.puzzleFailureCount++;
            console.log(`❌ Puzzle failure ${this.puzzleFailureCount}/${this.maxPuzzleFailures}`);

            if (this.puzzleFailureCount >= this.maxPuzzleFailures) {
                // Player dies after 3 failures
                await this.onPlayerDeath('puzzle');
            } else {
                // Show red screen effect and message
                this.showWrongPageOrderEffect();
                await window.gameControls.narrativeManager.triggerEvent('stage1.wrong_page_order');
            }
        }
    }

    showWrongPageOrderEffect() {
        // Create red overlay
        const redOverlay = document.createElement('div');
        redOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
            border: 20px solid red;
            box-sizing: border-box;
            animation: redPulse 1s ease-out;
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes redPulse {
                0% { border-color: rgba(255, 0, 0, 0); }
                50% { border-color: rgba(255, 0, 0, 0.8); }
                100% { border-color: rgba(255, 0, 0, 0); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(redOverlay);

        // Remove overlay after animation
        setTimeout(() => {
            document.body.removeChild(redOverlay);
            document.head.removeChild(style);
        }, 1000);
    }

    createUI() {
        const ui = {
            container: document.createElement('div'),
            inventory: document.createElement('div'),
            objectives: document.createElement('div'),
            status: document.createElement('div'),
            hint: document.createElement('div'),
            interaction: document.createElement('div'),
            gameMenu: document.createElement('div')
        };

        // Main UI container - HIDDEN (UI elements removed per user request)
        ui.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            pointer-events: none;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            display: none;
        `;

        // Inventory UI - HIDDEN (replaced with popup on 'I' key)
        ui.inventory.style.cssText = `
            background: rgba(0,0,0,0.8);
            padding: 15px;
            border: 2px solid #666;
            margin-bottom: 15px;
            border-radius: 8px;
            backdrop-filter: blur(5px);
            max-width: 250px;
            display: block;
        `;

        // Objectives UI - HIDDEN (per user request)
        ui.objectives.style.cssText = `
            background: rgba(0,0,0,0.8);
            padding: 15px;
            border: 2px solid #666;
            margin-bottom: 15px;
            border-radius: 8px;
            backdrop-filter: blur(5px);
            max-width: 300px;
            max-height: 300px;
            overflow-y: auto;
            display: none;
        `;

        // Status UI - HIDDEN (per user request)
        ui.status.style.cssText = `
            background: rgba(0,0,0,0.8);
            padding: 10px;
            border: 2px solid #666;
            border-radius: 8px;
            backdrop-filter: blur(5px);
            max-width: 250px;
            display: none;
        `;

        // Hint UI
        ui.hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            padding: 12px 18px;
            border: 1px solid #666;
            border-radius: 5px;
            max-width: 300px;
            display: none;
            backdrop-filter: blur(5px);
            animation: slideInRight 0.3s ease-out;
            font-size: 13px;
        `;

        // Interaction UI
        ui.interaction.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.95);
            padding: 30px;
            border: 3px solid #888;
            border-radius: 10px;
            display: none;
            pointer-events: auto;
            z-index: 1600;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 30px rgba(0,0,0,0.8);
        `;

        ui.interaction.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // Game menu UI
        ui.gameMenu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.95);
            padding: 40px;
            border: 3px solid #888;
            border-radius: 15px;
            display: none;
            pointer-events: auto;
            z-index: 1002;
            text-align: center;
            backdrop-filter: blur(10px);
        `;

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @keyframes pulse {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 1.0; }
            }

            @keyframes glow {
                0%, 100% { text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }
                50% { text-shadow: 2px 2px 4px rgba(0,0,0,0.8), 0 0 10px #00ff00; }
            }

            .objective-completed {
                color: #00ff00 !important;
                animation: glow 2s infinite;
            }

            .inventory-item {
                transition: all 0.3s ease;
                cursor: pointer;
                padding: 2px 0;
            }

            .inventory-item:hover {
                color: #ffff00;
                text-shadow: 0 0 5px #ffff00;
            }
        `;
        document.head.appendChild(style);

        ui.container.appendChild(ui.inventory);
        ui.container.appendChild(ui.objectives);
        ui.container.appendChild(ui.status);
        document.body.appendChild(ui.container);
        document.body.appendChild(ui.hint);
        document.body.appendChild(ui.interaction);
        document.body.appendChild(ui.gameMenu);

        // Create inventory popup (shown on 'I' key press)
        ui.inventoryPopup = this.createInventoryPopup();
        document.body.appendChild(ui.inventoryPopup);

        return ui;
    }

     createInventoryPopup() {
        const popup = document.createElement('div');
        popup.id = 'inventory-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.95);
            padding: 30px;
            border: 3px solid #888;
            border-radius: 10px;
            display: none;
            pointer-events: auto;
            z-index: 1500;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 30px rgba(0,0,0,0.8);
            min-width: 400px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            font-family: 'Courier New', monospace;
        `;

        // NEW: Add this event listener to stop clicks from passing through.
        popup.addEventListener('click', (event) => {
            event.stopPropagation();
        });


        // Set up key listener for 'I' key
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI' && this.gameState === 'playing') {
                e.preventDefault();
                this.toggleInventoryPopup();
            }
        });

        return popup;
    }

    toggleInventoryPopup() {
        const isVisible = this.ui.inventoryPopup.style.display === 'block';

        if (isVisible) {
            this.ui.inventoryPopup.style.display = 'none';
            if (this.controls) this.controls.unfreeze(); // NEW: Unfreeze controls when closing
        } else {
            this.updateInventoryPopup();
            this.ui.inventoryPopup.style.display = 'block';
            if (this.controls) this.controls.freeze(); // NEW: Freeze controls when opening
        }
    }


    updateInventoryPopup() {
        const inventoryHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0 0 10px 0; color: #ffaa00;">🎒 Inventory</h2>
                <p style="margin: 0; color: #888; font-size: 12px;">${this.inventory.length}/10 items</p>
            </div>
            <hr style="border-color: #444; margin-bottom: 20px;">
            ${this.inventory.length === 0 ?
                '<p style="color: #888; font-style: italic; text-align: center; padding: 40px 20px;">Your inventory is empty</p>' :
                '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">' +
                this.inventory.map((item, index) =>
                    `<div class="inventory-item-card" onclick="window.gameControls?.gameManager?.useItem?.(${index})" style="
                        background: rgba(255,255,255,0.05);
                        padding: 15px;
                        border: 2px solid #${this.getItemColor(item.type)};
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-align: center;
                    " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='#fff'"
                       onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='#${this.getItemColor(item.type)}'">
                        <div style="font-size: 24px; margin-bottom: 8px;">${this.getItemIcon(item.type)}</div>
                        <div style="color: #${this.getItemColor(item.type)}; font-weight: bold; margin-bottom: 5px; font-size: 14px;">${item.name}</div>
                        ${item.quantity && item.quantity > 1 ? `<div style="color: #888; font-size: 11px;">x${item.quantity}</div>` : ''}
                        ${item.description ? `<div style="color: #aaa; font-size: 10px; margin-top: 5px; line-height: 1.3;">${item.description}</div>` : ''}
                    </div>`
                ).join('') + '</div>'
            }
            <hr style="border-color: #444; margin: 20px 0;">
            <div style="text-align: center;">
                <button onclick="window.gameControls?.gameManager?.toggleInventoryPopup?.()" style="
                    background: linear-gradient(45deg, #444, #666);
                    color: white;
                    border: 1px solid #888;
                    padding: 10px 30px;
                    cursor: pointer;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='linear-gradient(45deg, #555, #777)'"
                   onmouseout="this.style.background='linear-gradient(45deg, #444, #666)'">Close (I)</button>
            </div>
        `;

        this.ui.inventoryPopup.innerHTML = inventoryHTML;
    }

    getItemIcon(itemType) {
        const icons = {
            'key': '🔑',
            'scroll': '📜',
            'tool': '🔧',
            'weight_object': '⚖️',
            'symbol': '🔮',
            'potion': '🧪',
            'book': '📖'
        };
        return icons[itemType] || '📦';
    }
     // NEW: Add this function to handle removing a page from a slot.
    removePageFromSlot(slotIndex) {
        const pageId = this.placedPages[slotIndex];
        if (!pageId) return;

        // Find the page item in the inventory to add it back. We don't call collectPage
        // as it might have unintended side effects like re-completing objectives.
        const pageData = PAGE_DATA[pageId];
        this.addToInventory({
            name: `Page (${pageData.symbol})`,
            type: 'scroll',
            description: 'A strange page with a unique symbol.',
            stackable: false,
            pageId: pageId,
            symbol: pageData.symbol
        });

        // Clear the page from the placed pages array.
        this.placedPages[slotIndex] = null;

        // Tell the MansionLoader to visually hide the page from the slot.
        if (this.mansion) {
            this.mansion.hidePageOnSlot(slotIndex);
        }

        this.checkPageOrder(); // Re-check the solution.
    }

    // NEW: Add this utility function to get a page's symbol for UI prompts.
    getPageSymbol(pageId) {
        return PAGE_DATA[pageId] ? PAGE_DATA[pageId].symbol : 'unknown';
    }

    updateUI() {
        this.updateInventoryUI();
        //this.updateObjectivesUI();
        this.updateStatusUI();
    }

    updateInventoryUI() {
        const inventoryHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ffaa00;">🎒 Inventory (${this.inventory.length}/10)</h3>
            ${this.inventory.length === 0 ? 
                '<p style="color: #888; font-style: italic;">Empty</p>' : 
                this.inventory.map((item, index) => 
                    `<div class="inventory-item" onclick="window.gameManager?.useItem?.(${index})" style="margin: 3px 0;">
                        • <span style="color: #${this.getItemColor(item.type)}">${item.name}</span>
                        ${item.description ? `<br><small style="color: #aaa; margin-left: 10px;">${item.description}</small>` : ''}
                    </div>`
                ).join('')
            }
        `;
        
        this.ui.inventory.innerHTML = inventoryHTML;
    }

    updateObjectivesUI() {
        const mainObjectives = this.objectives.filter(obj => obj.type === 'main');
        const secondaryObjectives = this.objectives.filter(obj => obj.type === 'secondary');
        const puzzleObjectives = this.objectives.filter(obj => obj.type === 'puzzle' && !obj.completed);
        const completedObjectives = this.objectives.filter(obj => obj.completed);
        
        let objectivesHTML = '<h3 style="margin: 0 0 10px 0; color: #ffaa00;">📝 Objectives</h3>';
        
        // Main objectives
        if (mainObjectives.length > 0) {
            objectivesHTML += '<h4 style="color: #ff6666; margin: 5px 0;">Primary:</h4>';
            mainObjectives.forEach(obj => {
                objectivesHTML += `
                    <p style="margin: 3px 0; color: ${obj.completed ? '#00ff00' : '#fff'};" class="${obj.completed ? 'objective-completed' : ''}">
                        ${obj.completed ? '✓' : '•'} ${obj.description}
                    </p>
                `;
            });
        }
        
        // Secondary objectives
        if (secondaryObjectives.length > 0) {
            objectivesHTML += '<h4 style="color: #66aaff; margin: 10px 0 5px 0;">Secondary:</h4>';
            secondaryObjectives.forEach(obj => {
                objectivesHTML += `
                    <p style="margin: 3px 0; color: ${obj.completed ? '#00ff00' : '#ccc'}; font-size: 12px;" class="${obj.completed ? 'objective-completed' : ''}">
                        ${obj.completed ? '✓' : '•'} ${obj.description}
                    </p>
                `;
            });
        }
        
        // Active puzzles
        if (puzzleObjectives.length > 0) {
            objectivesHTML += '<h4 style="color: #ffaa66; margin: 10px 0 5px 0;">Puzzles:</h4>';
            puzzleObjectives.slice(0, 3).forEach(obj => { // Show only top 3
                const difficultyStars = '★'.repeat(obj.difficulty || 1);
                objectivesHTML += `
                    <p style="margin: 3px 0; color: #aaa; font-size: 11px;">
                        • ${obj.description}
                        <span style="color: #ffaa00; margin-left: 5px;">${difficultyStars}</span>
                    </p>
                `;
            });
            
            if (puzzleObjectives.length > 3) {
                objectivesHTML += `<p style="color: #666; font-size: 10px; font-style: italic;">...and ${puzzleObjectives.length - 3} more puzzles</p>`;
            }
        }
        
        // Progress summary
        if (completedObjectives.length > 0) {
            objectivesHTML += `<hr style="border-color: #444; margin: 10px 0;"><p style="color: #888; font-size: 11px;">Completed: ${completedObjectives.length}/${this.objectives.length}</p>`;
        }
        
        this.ui.objectives.innerHTML = objectivesHTML;
    }

    updateStatusUI() {
        const currentTime = Date.now();
        const gameTime = Math.floor((currentTime - this.gameStats.startTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        
        const currentRoomName = this.currentRoom ?
            this.currentRoom.name :
            'Unknown Location';
        
        const statusHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ffaa00;">📊 Status</h3>
            <div style="font-size: 12px;">
                <p style="margin: 2px 0;"><strong>Location:</strong> ${currentRoomName}</p>
                <p style="margin: 2px 0;"><strong>Time:</strong> ${minutes}:${seconds.toString().padStart(2, '0')}</p>
                <p style="margin: 2px 0;"><strong>Rooms:</strong> ${this.gameStats.roomsVisited.size} visited</p>
                <p style="margin: 2px 0;"><strong>Puzzles:</strong> ${this.gameStats.puzzlesSolved} solved</p>
                <p style="margin: 2px 0;"><strong>Items:</strong> ${this.gameStats.itemsCollected} collected</p>
            </div>
            <div style="margin-top: 8px; font-size: 10px;">
                <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #ff6666, #ffaa66, #66ff66); height: 100%; width: ${this.getProgressPercentage()}%; transition: width 0.5s ease;"></div>
                </div>
                <p style="margin: 2px 0; color: #888;">Progress: ${Math.round(this.getProgressPercentage())}%</p>
            </div>
        `;
        
        this.ui.status.innerHTML = statusHTML;
    }

    getProgressPercentage() {
        const totalObjectives = this.objectives.length;
        const completedObjectives = this.objectives.filter(obj => obj.completed).length;
        return totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;
    }

    getItemColor(itemType) {
        const colors = {
            'key': 'FFD700',
            'scroll': 'DDA0DD',
            'tool': 'C0C0C0',
            'weight_object': '8B4513',
            'symbol': '9370DB',
            'potion': '00CED1',
            'book': '8FBC8F'
        };
        return colors[itemType] || 'FFFFFF';
    }

    showWelcomeMessage() {
        // Welcome message removed - no longer showing hints except for inventory
    }

   showHint(text, duration = 2000) {
        this.hintQueue.push({ text, duration });
        if (!this.isHintVisible) {
            this.processHintQueue();
        }
        this.gameStats.hintsUsed++;
    }

     processHintQueue() {
        if (this.hintQueue.length === 0) {
            this.isHintVisible = false;
            return;
        }

        this.isHintVisible = true;
        const hint = this.hintQueue.shift(); // Get the next hint from the queue

        this.ui.hint.innerHTML = `<p style="margin: 0;">💡 ${hint.text}</p>`;
        this.ui.hint.style.display = 'block';
        
        // After the duration, hide the hint and process the next one.
        setTimeout(() => {
            this.ui.hint.style.display = 'none';
            this.processHintQueue();
        }, hint.duration);
    }


    showInteraction(title, text, options, callback) {
        if (this.controls) this.controls.freeze();

        const optionButtons = options.map((option, index) => 
            `<button onclick="window.gameInteractionCallback(${index})" style="
                background: linear-gradient(45deg, #444, #666);
                color: white;
                border: 1px solid #888;
                padding: 12px 20px;
                margin: 5px;
                cursor: pointer;
                border-radius: 5px;
                font-family: 'Courier New', monospace;
                transition: all 0.2s ease;
            " onmouseover="this.style.background='linear-gradient(45deg, #555, #777)'" 
               onmouseout="this.style.background='linear-gradient(45deg, #444, #666)'">${option}</button>`
        ).join('');

        this.ui.interaction.innerHTML = `
            <h3 style="color: #ffaa00; margin: 0 0 15px 0;">${title}</h3>
            <p style="margin-bottom: 20px; line-height: 1.4;">${text}</p>
            <div style="text-align: center;">${optionButtons}</div>
        `;
        
        this.ui.interaction.style.display = 'block';

        this.ui.interaction.querySelectorAll('.interaction-button').forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.dataset.index);

                // Hide the UI and unfreeze controls BEFORE calling the original function.
                this.ui.interaction.style.display = 'none';
                if (this.controls) this.controls.unfreeze();

                // Run the original callback.
                if (callback) callback(index);
            });
        });

        // Store callback globally for button access
        window.gameInteractionCallback = (index) => {
            this.ui.interaction.style.display = 'none';
            delete window.gameInteractionCallback;
            if (callback) callback(index);
        };
    }

    showGameMenu() {
        this.gameState = 'paused';
        
        this.ui.gameMenu.innerHTML = `
            <h2 style="color: #ffaa00; margin: 0 0 30px 0;">⚙️ Game Menu</h2>
            <button onclick="window.gameManager.resumeGame()" style="
                display: block;
                width: 200px;
                margin: 10px auto;
                padding: 15px;
                background: linear-gradient(45deg, #2a5d2a, #4a8d4a);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-family: 'Courier New', monospace;
            ">Resume Game</button>
            
            <button onclick="window.gameManager.toggleAudio()" style="
                display: block;
                width: 200px;
                margin: 10px auto;
                padding: 15px;
                background: linear-gradient(45deg, #5d5d2a, #8d8d4a);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-family: 'Courier New', monospace;
            ">Audio: ${this.audioEnabled ? 'ON' : 'OFF'}</button>
            
            <button onclick="window.gameManager.showControls()" style="
                display: block;
                width: 200px;
                margin: 10px auto;
                padding: 15px;
                background: linear-gradient(45deg, #2a2a5d, #4a4a8d);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-family: 'Courier New', monospace;
            ">Controls</button>
            
            <button onclick="window.gameManager.restartGame()" style="
                display: block;
                width: 200px;
                margin: 10px auto;
                padding: 15px;
                background: linear-gradient(45deg, #5d2a2a, #8d4a4a);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-family: 'Courier New', monospace;
            ">Restart Game</button>
        `;
        
        this.ui.gameMenu.style.display = 'block';
    }

    resumeGame() {
        this.gameState = 'playing';
        this.ui.gameMenu.style.display = 'none';
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.showGameMenu(); // Refresh menu to show updated audio status
    }

    showControls() {
        this.ui.gameMenu.innerHTML = `
            <h2 style="color: #ffaa00; margin: 0 0 20px 0;">🎮 Controls</h2>
            <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                <h4 style="color: #66aaff;">Movement:</h4>
                <p><strong>W A S D</strong> - Move around</p>
                <p><strong>Mouse</strong> - Look around (click to lock cursor)</p>
                <p><strong>Space</strong> - Move up</p>
                <p><strong>Shift</strong> - Move down</p>
                
                <h4 style="color: #66aaff; margin-top: 15px;">Interaction:</h4>
                <p><strong>E</strong> - Interact with objects</p>
                <p><strong>Left Click</strong> - Also interact</p>
                <p><strong>TAB</strong> - Highlight nearby objects</p>
                
                <h4 style="color: #66aaff; margin-top: 15px;">Interface:</h4>
                <p><strong>ESC</strong> - Close dialogs / Game menu</p>
                <p><strong>F</strong> - Toggle flashlight (if available)</p>
            </div>
            <button onclick="window.gameManager.showGameMenu()" style="
                margin-top: 20px;
                padding: 10px 20px;
                background: #444;
                color: white;
                border: 1px solid #888;
                border-radius: 5px;
                cursor: pointer;
            ">Back to Menu</button>
        `;
    }

    restartGame() {
        this.showInteraction(
            "Restart Game",
            "Are you sure you want to restart? All progress will be lost.",
            ["Yes, Restart", "Cancel"],
            (choice) => {
                if (choice === 0) {
                    location.reload();
                }
            }
        );
    }

    // Inventory management
    addToInventory(item) {
        if (this.inventory.length >= 10) {
            return false;
        }

        // Check if item already exists (for stackable items)
        const existingItem = this.inventory.find(inv => inv.name === item.name);
        if (existingItem && item.stackable) {
            existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
        } else {
            this.inventory.push({
                ...item,
                quantity: item.quantity || 1,
                addedTime: Date.now()
            });
        }

        this.gameStats.itemsCollected++;
        this.updateUI();
        this.showHint(`${item.name}`);

        // Update popup if it's visible
        if (this.ui.inventoryPopup && this.ui.inventoryPopup.style.display === 'block') {
            this.updateInventoryPopup();
        }

        return true;
    }

    removeFromInventory(itemName) {
        const index = this.inventory.findIndex(item => item.name === itemName);
        if (index !== -1) {
            const removed = this.inventory.splice(index, 1)[0];
            this.updateUI();

            // Update popup if it's visible
            if (this.ui.inventoryPopup && this.ui.inventoryPopup.style.display === 'block') {
                this.updateInventoryPopup();
            }

            return removed;
        }
        return null;
    }

    hasItem(itemName) {
        return this.inventory.some(item => item.name === itemName);
    }

    useItem(itemIndex) {
        if (itemIndex >= 0 && itemIndex < this.inventory.length) {
            const item = this.inventory[itemIndex];
            
            switch (item.type) {
                case 'scroll':
                    this.showInteraction(
                        item.name,
                        item.content || "The text is too faded to read clearly.",
                        ["Close"],
                        () => {}
                    );
                    break;

                case 'potion':
                    this.showInteraction(
                        `Use ${item.name}?`,
                        item.description || "A mysterious potion. Its effects are unknown.",
                        ["Drink", "Keep for later"],
                        (choice) => {
                            if (choice === 0) {
                                this.consumePotion(item, itemIndex);
                            }
                        }
                    );
                    break;
            }
        }
    }

    consumePotion(potion, itemIndex) {
        // Remove potion from inventory
        this.inventory.splice(itemIndex, 1);
        this.updateUI();

        // Update popup if it's visible
        if (this.ui.inventoryPopup && this.ui.inventoryPopup.style.display === 'block') {
            this.updateInventoryPopup();
        }

        // Apply potion effects (silently)
        switch (potion.effect) {
            case 'vision':
                // Could temporarily increase interaction range or reveal hidden objects
                break;
            case 'courage':
                // Could temporarily reduce scare event frequency
                break;
        }
    }

    // Objective management
    completeObjective(objectiveId) {
        const objective = this.objectives.find(obj => obj.id === objectiveId);
        if (objective && !objective.completed) {
            objective.completed = true;
            objective.completedTime = Date.now();
            
            if (objective.type === 'puzzle') {
                this.gameStats.puzzlesSolved++;
            }
            
            this.updateUI();

            // Special effects for main objectives
            if (objective.type === 'main') {
                this.ui.objectives.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.5)';
                setTimeout(() => {
                    this.ui.objectives.style.boxShadow = 'none';
                }, 2000);
            }
            
            // Check for game completion
            this.checkWinCondition();
            
            // Check for objective chains
            this.checkObjectiveChains(objectiveId);
        }
    }

    checkObjectiveChains(completedObjectiveId) {
        // Unlock new objectives based on completed ones
        switch (completedObjectiveId) {
            case 'explore_mansion':
                this.addObjective({
                    id: 'find_master_key',
                    description: 'Find the master key to unlock restricted areas',
                    type: 'secondary',
                    priority: 2
                });
                break;
                
            case 'survive_horrors':
                this.addObjective({
                    id: 'understand_mystery',
                    description: 'Uncover the truth behind the mansion\'s dark history',
                    type: 'secondary',
                    priority: 2
                });
                break;
        }
    }

    addObjective(objective) {
        const exists = this.objectives.find(obj => obj.id === objective.id);
        if (!exists) {
            this.objectives.push({
                completed: false,
                ...objective
            });
            this.updateUI();
        }
    }

    checkWinCondition() {
        const mainObjectives = this.objectives.filter(obj => obj.type === 'main');
        const allMainCompleted = mainObjectives.every(obj => obj.completed);
        
        if (allMainCompleted) {
            this.gameState = 'won';
            setTimeout(() => {
                this.onGameWon();
            }, 1000); // Delay for dramatic effect
        }
    }

    onGameWon() {
        const gameTime = Math.floor((Date.now() - this.gameStats.startTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        
        const score = this.calculateFinalScore();
        
        this.showInteraction(
            "🎉 Escape Successful!",
            `Congratulations! You've escaped the haunted mansion!
            
            <div style="margin: 20px 0; padding: 15px; background: rgba(0,0,0,0.5); border-radius: 5px;">
                <h4 style="color: #ffaa00; margin: 0 0 10px 0;">Final Statistics:</h4>
                <p style="margin: 5px 0;">⏱️ Time: ${minutes}:${seconds.toString().padStart(2, '0')}</p>
                <p style="margin: 5px 0;">🏠 Rooms Explored: ${this.gameStats.roomsVisited.size}</p>
                <p style="margin: 5px 0;">🧩 Puzzles Solved: ${this.gameStats.puzzlesSolved}</p>
                <p style="margin: 5px 0;">📦 Items Collected: ${this.gameStats.itemsCollected}</p>
                <p style="margin: 5px 0;">💡 Hints Used: ${this.gameStats.hintsUsed}</p>
                <hr style="border-color: #444; margin: 10px 0;">
                <p style="margin: 0; color: #00ff00; font-size: 18px; font-weight: bold;">Final Score: ${score}</p>
            </div>`,
            ["Play Again", "Main Menu"],
            (choice) => {
                if (choice === 0) {
                    location.reload(); // Restart game
                } else {
                    // Return to main menu
                    document.getElementById('welcome-screen').style.display = 'flex';
                    document.querySelector('#game-canvas').style.display = 'none';
                }
            }
        );
    }

    calculateFinalScore() {
        const gameTime = (Date.now() - this.gameStats.startTime) / 1000;
        const timeBonus = Math.max(0, 1000 - gameTime); // Bonus for finishing quickly
        const explorationBonus = this.gameStats.roomsVisited.size * 50;
        const puzzleBonus = this.gameStats.puzzlesSolved * 100;
        const itemBonus = this.gameStats.itemsCollected * 25;
        const hintPenalty = this.gameStats.hintsUsed * 10;
        
        const score = Math.round(timeBonus + explorationBonus + puzzleBonus + itemBonus - hintPenalty);
        return Math.max(0, score);
    }

    onGameLost(reason = "The darkness has consumed you...") {
        this.gameState = 'lost';
        
        this.showInteraction(
            "💀 Game Over",
            `${reason}
            
            <div style="margin: 20px 0; padding: 15px; background: rgba(139,0,0,0.3); border-radius: 5px;">
                <p style="margin: 0;">Don't give up! Every attempt teaches you something new about the mansion's secrets.</p>
            </div>`,
            ["Try Again", "Main Menu"],
            (choice) => {
                if (choice === 0) {
                    location.reload();
                } else {
                    document.getElementById('welcome-screen').style.display = 'flex';
                    document.querySelector('#game-canvas').style.display = 'none';
                }
            }
        );
    }

    // Room management
    tick(delta) {
        if (this.gameState !== 'playing') return;

        // Get the room the player is currently in
        const detectedRoom = this.mansion.getCurrentRoom(this.camera.position);

        // Check if the room has changed since the last frame
        if (detectedRoom !== this.currentRoom) {
            // A transition has occurred.
            
            // 1. Handle exiting the PREVIOUS room (if we were in one)
            if (this.currentRoom) {
                this.onRoomExited(this.currentRoom);
            }

            // 2. Handle entering the NEW room (if we are now in one)
            if (detectedRoom) {
                this.onRoomEntered(detectedRoom);
            }

            // 3. Update the state variables
            this.previousRoom = this.currentRoom;
            this.currentRoom = detectedRoom;
            
            // 4. Always update the UI after a transition
            this.updateUI();
        }

        // --- Objective progress checks ---
        this.checkTimedObjectives();

        // Check for monster collision (player death)
        this.checkMonsterCollision();

        this.nextAmbientSoundTime -= delta;
        if (this.nextAmbientSoundTime <= 0) {
            if (this.audioManager) {
                this.audioManager.playRandomAmbientSound();
            }
            // Reset the timer for the next sound
            this.nextAmbientSoundTime = this.getRandomAmbientTime();
        }
    }

    onRoomEntered(room) {
        console.log(`🚪 Entered ${room.name}`);

        // Show a hint only on the very first visit
        if (!this.gameStats.roomsVisited.has(room.name)) {
            // this.handleFirstRoomEntry(room); // Room hints disabled
        }

        // Add to visited rooms list (moved here for better logic)
        this.gameStats.roomsVisited.add(room.name);

        // Trigger any other events that should happen EVERY time you enter
        this.triggerRoomSpecialEvents(room);

        // Update exploration objective (moved here from tick)
        if (this.gameStats.roomsVisited.size >= 5) {
            this.completeObjective('explore_mansion');
        }
    }

    /**
     * NEW METHOD: Handles logic for when a player leaves a room.
     * @param {object} room - The room object that was just exited.
     */
    onRoomExited(room) {
        console.log(`🚪 Exited ${room.name}`);
        // This is the place to add logic for when you leave a room, e.g.:
        // - Stop room-specific ambient sounds
        // - Hide room-specific UI elements
    }

    /**
     * NEW METHOD: Centralizes time-based objective checks.
     */
    checkTimedObjectives() {
        // Survival time tracking
        const survivalTime = (Date.now() - this.gameStats.startTime) / 1000;
        if (survivalTime > 300) { // 5 minutes
            this.completeObjective('survive_horrors');
        }
    }

    /**
     * RENAMED: This method now specifically handles FIRST-TIME entry events.
     * @param {object} room - The room being entered for the first time.
     */
    handleFirstRoomEntry(room) {
        const roomType = room.name.toLowerCase();

        if (roomType.includes('entrance')) {
            this.showHint("You're in the mansion's entrance hall. Look for clues about how to escape.");
        } else if (roomType.includes('library')) {
            this.showHint("Ancient books line the walls. Some might contain important information.");
        } else if (roomType.includes('kitchen')) {
            this.showHint("The kitchen feels cold and unused. Check the cabinets and drawers.");
        } else if (roomType.includes('bedroom')) {
            this.showHint("Someone once slept here. Search under the bed and in the dresser.");
        } else if (roomType.includes('study')) {
            this.showHint("This study might contain the mansion owner's personal documents.");
        } else if (roomType.includes('attic')) {
            this.showHint("The attic is full of old memories... and perhaps old secrets.");
        } else {
            this.showHint(`You've discovered the ${room.name}.`);
        }
    }

    triggerRoomSpecialEvents(room) {
        // Room special events removed - no longer showing hints except for inventory
    }

    // Save/Load system (basic localStorage implementation)
    saveGame() {
        const saveData = {
            inventory: this.inventory,
            objectives: this.objectives,
            gameStats: this.gameStats,
            currentRoom: this.currentRoom?.id,
            mansionSeed: this.mansion.seed, // If mansion uses seed for generation
            version: '1.0'
        };
        
        try {
            localStorage.setItem('mansion_escape_save', JSON.stringify(saveData));
            return true;
        } catch (error) {
            return false;
        }
    }

    loadGame() {
        try {
            const saveData = localStorage.getItem('mansion_escape_save');
            if (saveData) {
                const parsed = JSON.parse(saveData);
                
                this.inventory = parsed.inventory || [];
                this.objectives = parsed.objectives || [];
                this.gameStats = parsed.gameStats || this.gameStats;

                this.updateUI();
                return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    // NEW: Stage 2 transition
    async startStage2() {
        console.log('🎭 Starting Stage 2...');
        this.gameStage = 2;

        // Show Stage 2 title screen
        await window.gameControls.narrativeManager.triggerEvent('stage2.stage_2_title');

        // Inner monologue using narrative manager
        await window.gameControls.narrativeManager.triggerEvent('stage2.transition_start');

        // Add objective to escape the mansion
        await window.gameControls.narrativeManager.triggerEvent('stage2.escape_objective');

        // Player must now try to interact with the entrance door
        // The lights will go out when they try the door (handled in InteractionSystem)
    }

    spawnMonsterNearStudy() {
        const monsterAI = window.gameControls.monsterAI;
        const pathfinding = monsterAI.pathfinding;

        try {
            const zone = pathfinding.zones[monsterAI.ZONE];
            const nodes = zone.groups[monsterAI.groupID];

            // Find nodes near the study (you may need to adjust coordinates based on your mansion layout)
            // For now, we'll look for a specific node or use a fallback
            let studyNode = null;

            // Try to find a node close to study position
            // You'll need to adjust these coordinates based on your actual study location
            const studyApproxPosition = new THREE.Vector3(0, 0, 0); // Placeholder - adjust this!

            let closestDistance = Infinity;
            for (const node of nodes) {
                const distance = node.centroid.distanceTo(studyApproxPosition);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    studyNode = node;
                }
            }

            if (studyNode) {
                monsterAI.monster.position.copy(studyNode.centroid);
                monsterAI.monster.visible = true; // Make monster visible
                console.log(`👾 Monster spawned near study at node`);
            } else {
                monsterAI.spawn(); // Fallback to random spawn
                monsterAI.monster.visible = true; // Make monster visible
            }

            // Start heartbeat when monster spawns
            if (!monsterAI.heartbeatStarted) {
                monsterAI.audioManager.playHeartbeat();
                monsterAI.heartbeatStarted = true;
            }

            window.gameControls.narrativeManager.triggerEvent('stage2.something_moving');
        } catch (error) {
            console.error("Failed to spawn monster near study:", error);
            monsterAI.spawn(); // Fallback
        }
    }

    async fixFuseBox() {
        console.log('💡 Fuse box fixed!');
        this.fuseBoxFixed = true;
        this.lightsOn = true;

        if (this.mansion) {
            this.mansion.setAllLightsEnabled(true);
        }

        this.completeObjective('fix_fuse_box');

        await window.gameControls.narrativeManager.triggerEvent('stage2.lights_restored');
        await window.gameControls.narrativeManager.triggerEvent('stage2.not_alone');

        // Set monster to CURIOUS (level 3) after fuse box is fixed
        if (window.gameControls.monsterAI) {
            window.gameControls.monsterAI.setAggressionLevel(3); // CURIOUS
            console.log('👾 Monster is now CURIOUS');
        }

        // Make the diary glow immediately after fuse box is complete
        if (this.mansion) {
            this.mansion.enableDiaryGlow();
            console.log('✨ Diary glow enabled immediately after fuse box');
        }
        await window.gameControls.narrativeManager.triggerEvent('stage1.notice_diary');

        // Now make diary interactable and show objective
        if (this.mansion) {
            const diary = this.mansion.props.get('diary');
            if (diary) {
                diary.userData.interactable = true;
            }
        }
        await window.gameControls.narrativeManager.triggerEvent('stage1.read_diary_objective');
    }

    async onPlayerDeath(deathType = 'monster_curious') {
        console.log(`💀 Player died: ${deathType}`);
        this.gameState = 'lost';

        // Play death sound
        if (this.audioManager) {
            this.audioManager.playSound('player_death', 'public/audio/sfx/hit_sound.mp3');
        }

        // Stop player controls
        if (this.controls) {
            this.controls.freeze();
        }

        // Show appropriate death screen based on death type
        const deathEvent = `endings.death_${deathType}`;
        await window.gameControls.narrativeManager.triggerEvent(deathEvent);

        // R key restart is handled by PlayerControls.js onKeyDown handler
        console.log('💀 Press R to restart the game');
    }

    checkMonsterCollision() {
        if (this.gameState !== 'playing') return;
        if (!window.gameControls.monsterAI) return;

        // Only check collision if we're in Stage 2 (monster is spawned)
        if (this.gameStage !== 2) return;

        const monster = window.gameControls.monsterAI.monster;
        if (!monster) return;

        const playerPos = this.camera.position;
        const monsterPos = monster.position;

        const distance = playerPos.distanceTo(monsterPos);

        // If player touches monster (within 1.5 units), they die
        if (distance < 1.5) {
            // Determine death message based on monster aggression level
            const aggressionLevel = window.gameControls.monsterAI.aggressionLevel;
            let deathType;
            if (aggressionLevel >= 5) {
                deathType = 'monster_hostile';
            } else if (aggressionLevel >= 4) {
                deathType = 'monster_bold';
            } else {
                deathType = 'monster_curious';
            }
            this.onPlayerDeath(deathType);
        }
    }

    // Cleanup
    dispose() {
        // Remove UI elements
        if (this.ui.container) {
            document.body.removeChild(this.ui.container);
        }
        if (this.ui.hint) {
            document.body.removeChild(this.ui.hint);
        }
        if (this.ui.interaction) {
            document.body.removeChild(this.ui.interaction);
        }
        if (this.ui.gameMenu) {
            document.body.removeChild(this.ui.gameMenu);
        }
        
        // Clean up global references
        if (window.gameManager === this) {
            delete window.gameManager;
        }
        if (window.gameInteractionCallback) {
            delete window.gameInteractionCallback;
        }
    }
}

// Make GameManager available globally for UI callbacks
if (typeof window !== 'undefined') {
    window.GameManager = GameManager;
}

export { GameManager };