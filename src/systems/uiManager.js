// src/systems/uiManager.js

export class UIManager {
    constructor(audioManager) { 
        this.uiElements = {};
        this.isInitialized = false;
        this.audioManager = audioManager; 
        this.controls = null;
    }

    setControls(controls) {
        this.controls = controls;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Load the HTML content into the containers
        await this._loadHTML('src/ui/welcomeScreen/welcome-screen.html', 'welcome-screen-container');
        await this._loadHTML('src/ui/colorPuzzle/color-puzzle.html', 'puzzle-container');
        await this._loadHTML('src/ui/wirePuzzle/wire-puzzle.html', 'wire-puzzle-container');
        await this._loadHTML('src/ui/creditsScreen/credits-screen.html', 'credits-screen-container');
        await this._loadHTML('src/ui/settingsScreen/settings-screen.html', 'settings-screen-container');
        await this._loadHTML('src/ui/narrative/narrative-elements.html', 'narrative-container');
        await this._loadHTML('src/ui/objectiveTracker/objective-tracker.html', 'objective-tracker-container');
        await this._loadHTML('src/ui/clueScreen/clue-screen.html', 'clue-screen-container');
        await this._loadHTML('src/ui/resultScreen/result-screen.html', 'result-screen-container');
        await this._loadHTML('src/ui/keypad/keypad.html', 'keypad-container');

        // Now that the HTML is loaded, cache the elements inside it
        this.uiElements = {
            welcomeScreen: document.getElementById('welcome-screen'),
            playButton: document.getElementById('play-btn'),
            creditsButton: document.getElementById('credits-btn'),
            settingsButton: document.getElementById('settings-btn'),
            loadingScreen: document.getElementById('loading-screen'),
            loadingBar: document.getElementById('loading-bar'),
            monsterIcon: document.getElementById('monster-icon'), 
            loadingText: document.getElementById('loading-text'),
            puzzleContainer: document.getElementById('puzzle-container'),
            wirePuzzleContainer: document.getElementById('wire-puzzle-container'), 
            crosshair: document.getElementById('crosshair'),
            interactionPrompt: document.getElementById('interaction-prompt'),
            creditsScreen: document.getElementById('credits-screen'),
            closeCreditsButton: document.getElementById('close-credits-btn'),
            settingsScreen: document.getElementById('settings-screen'),
            closeSettingsButton: document.getElementById('close-settings-btn'),

            // Objective Stuff
            objectiveTracker: document.getElementById('objective-tracker'),
            objectiveTitle: document.getElementById('objective-title'),
            objectiveDescription: document.getElementById('objective-description'),

            // Clue Screen
            clueScreen: document.getElementById('clue-screen'),
            closeClueButton: document.getElementById('close-clue-btn'),

            resultOverlay: document.getElementById('result-overlay'),

            // Keypad
            keypadContainer: document.getElementById('keypad-container'),
            keypadDisplay: document.getElementById('keypad-display'),
            keypadButtons: document.querySelectorAll('.keypad-button, #keypad-enter-button'),
            keypadCloseButton: document.getElementById('keypad-close-button'),       
        };
        
        if (!this.uiElements.welcomeScreen || !this.uiElements.playButton) {
            console.error("UIManager Critical Error: Welcome screen elements not found after loading.");
            return;
        }

        if (this.uiElements.clueScreen) this.uiElements.clueScreen.style.display = 'none';
        
        this._addMenuEventListeners();
        this._setupSettingsTabs();
        this._setupVideoSettings();
        console.log('✅ UI Manager Initialized');
        this.isInitialized = true;


    }
    
    async _loadHTML(url, targetId) {
        const targetElement = document.getElementById(targetId);
        if (!targetElement) {
            console.error(`UI target element #${targetId} not found in index.html.`);
            return;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.statusText}`);
            }
            targetElement.innerHTML = await response.text();
        } catch (error) {
            console.error(`Error loading HTML from ${url}:`, error);
        }
    }
    
    _addMenuEventListeners() {
        this.uiElements.settingsButton.onclick = () => {
            this.uiElements.welcomeScreen.style.display = 'none';
            this.uiElements.settingsScreen.classList.remove('hidden');
            this._loadVideoSettings(); // Load current settings when opening
        };

        this.uiElements.creditsButton.onclick = () => {
            this.uiElements.welcomeScreen.style.display = 'none';
            this.uiElements.creditsScreen.classList.remove('hidden');
        };

        this.uiElements.closeSettingsButton.onclick = () => {
            this.uiElements.settingsScreen.classList.add('hidden');
            this.uiElements.welcomeScreen.style.display = 'flex';
        };

        this.uiElements.closeCreditsButton.onclick = () => {
            this.uiElements.creditsScreen.classList.add('hidden');
            this.uiElements.welcomeScreen.style.display = 'flex';
        };

               if (this.uiElements.closeClueButton) {

            this.uiElements.closeClueButton.onclick = () => {
                window.gameControls.interactionSystem.closePuzzleUI();
            };

            // this.uiElements.closeClueButton.onclick = () => {
            //     if (this.uiElements.clueScreen) {
            //         this.uiElements.clueScreen.style.display = 'none';
            //     }
            //     if (this.controls) {
            //         this.controls.unfreeze();
            //     }
            // };
        }

        // This listener stops clicks from passing through to the game
        if (this.uiElements.clueScreen) {
            this.uiElements.clueScreen.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
    }

    _setupSettingsTabs() {
        const tabButtons = document.querySelectorAll('#settings-screen .tab-btn');
        const tabContents = document.querySelectorAll('#settings-screen .tab-content');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Skip if button is disabled
                if (btn.disabled) return;

                const targetTab = e.target.getAttribute('data-tab');

                // Update active tab button
                tabButtons.forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');

                // Update active tab content
                tabContents.forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }

    _setupVideoSettings() {
        // Load settings from localStorage or use defaults
        this.settings = {
            antialiasing: false,
            quality: 'medium'
        };

        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
            if (!this.settings.quality) {
                this.settings.quality = 'medium';
            }
        }

        // Quality preset selector
        const qualitySelect = document.getElementById('quality-select');
        if (qualitySelect) {
            qualitySelect.value = this.settings.quality;
            qualitySelect.addEventListener('change', (e) => {
                this.settings.quality = e.target.value;
                this._saveSettings();
                this._showNotification(`✅ Quality set to ${this.settings.quality}`);

                // Emit custom event that other systems can listen to
                window.dispatchEvent(new CustomEvent('qualitychange', {
                    detail: { quality: this.settings.quality }
                }));
            });
        }

        // Anti-aliasing toggle
        const aaToggle = document.getElementById('antialiasing-toggle');
        if (aaToggle) {
            aaToggle.checked = this.settings.antialiasing;
            aaToggle.addEventListener('change', (e) => {
                this.settings.antialiasing = e.target.checked;
                this._saveSettings();
                this._showNotification('⚠️ Restart required for anti-aliasing change');
            });
        }
    }

    _loadVideoSettings() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
            if (!this.settings.quality) {
                this.settings.quality = 'medium';
            }

            const qualitySelect = document.getElementById('quality-select');
            const aaToggle = document.getElementById('antialiasing-toggle');

            if (qualitySelect) qualitySelect.value = this.settings.quality;
            if (aaToggle) aaToggle.checked = this.settings.antialiasing;
        }
    }

    _saveSettings() {
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        console.log('💾 Settings saved');
    }

    _showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4a6fa5;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-family: 'Courier New', monospace;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    getSettings() {
        return this.settings;
    }

    // --- Loading and Welcome Screen Methods ---
    showWelcomeScreen(onPlayCallback) {
        if (this.uiElements.welcomeScreen && this.uiElements.playButton) {
            this.uiElements.welcomeScreen.style.display = 'flex';
            
            if (this.audioManager) {
                this.audioManager.playMainMenuMusic();
            }

            this.uiElements.playButton.onclick = () => {
                if (this.audioManager) {
                    this.audioManager.stopMainMenuMusic(); 
                }

                this.uiElements.welcomeScreen.style.display = 'none';
                this.showLoadingScreen("Initializing...");
                onPlayCallback();
            };
        } else {
            console.error("Cannot show welcome screen because UI elements are missing.");
        }
    }

    showLoadingScreen(text) {
        if (this.uiElements.loadingScreen) {
            this.uiElements.loadingScreen.style.display = 'flex';
            this.updateLoadingText(text);
        }
    }

    hideLoadingScreen() {
        if (this.uiElements.loadingScreen) {
            this.uiElements.loadingScreen.style.display = 'none';
        }
    }

    updateLoadingText(text) {
        if (this.uiElements.loadingText) {
            this.uiElements.loadingText.textContent = text;
        }
    }

    updateLoadingProgress(percentage, text) {
        if (this.uiElements.loadingBar && this.uiElements.monsterIcon) {
            const percent = Math.max(0, Math.min(100, percentage));
            this.uiElements.loadingBar.style.width = `${percent}%`;
            this.uiElements.monsterIcon.style.left = `${percent}%`;
        }
        if (text) {
            this.updateLoadingText(text);
        }
    }

 /**
     * The single function responsible for displaying an objective.
     * It will automatically hide any currently visible objective first.
     */
    displayObjective(objectiveData) {
        const tracker = this.uiElements.objectiveTracker;
        if (!tracker) return;

        const showNewObjective = () => {
            // Update the text content
            tracker.setAttribute('data-objective-id', objectiveData.id); // Store ID for completion check
            this.uiElements.objectiveTitle.textContent = objectiveData.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            this.uiElements.objectiveDescription.textContent = objectiveData.description;

            // Reset all classes and slide the new objective into view
            tracker.className = 'new-objective'; // Removes 'hidden' and 'completed'
            
            // Remove the 'new-objective' class after the banner animation
            setTimeout(() => {
                tracker.classList.remove('new-objective');
            }, 2500);
        };

        // If an objective is already visible, hide it first, then show the new one.
        if (!tracker.classList.contains('hidden')) {
            tracker.classList.add('hidden');
            setTimeout(showNewObjective, 600); // Wait for slide-out animation
        } else {
            showNewObjective(); // Otherwise, show it immediately
        }
    }

    /**
     * Marks the currently visible objective as complete by adding a line-through.
     * It no longer hides the objective.
     */
    markObjectiveComplete(objectiveId) {
        const tracker = this.uiElements.objectiveTracker;
        // Only mark it complete if it's the correct objective currently on screen
        if (tracker && tracker.getAttribute('data-objective-id') === objectiveId) {
            tracker.classList.add('completed');
        }
    }

    showClueScreen(clueText) {
        if (this.uiElements.clueScreen) {
            const clueTextElement = this.uiElements.clueScreen.querySelector('.clue-text');
            if (clueTextElement) {
                clueTextElement.textContent = clueText;
            }
            this.uiElements.clueScreen.style.display = 'flex';
            
            // This tiny delay gives the browser time to render the element before focusing
            setTimeout(() => {
                this.uiElements.clueScreen.focus();
            }, 50); // 50ms is a safe, imperceptible delay

            if (this.controls) {
                this.controls.freeze();
            }
        }
    }

    // Keypad stuff
    showKeypad() {
        if (this.uiElements.keypadContainer) {
            this.uiElements.keypadContainer.style.display = 'flex';
        }
    }

    hideKeypad() {
        if (this.uiElements.keypadContainer) {
            this.uiElements.keypadContainer.style.display = 'none';
        }
    }

    updateKeypadDisplay(text) {
        if (this.uiElements.keypadDisplay) {
            this.uiElements.keypadDisplay.textContent = text;
        }
    }

    setupKeypad(onKeyPress, onClose) {
        if (this.uiElements.keypadButtons) {
            this.uiElements.keypadButtons.forEach(button => {
                button.addEventListener('click', () => {
                    onKeyPress(button.textContent);
                });
            });
        }
        if (this.uiElements.keypadCloseButton) {
            this.uiElements.keypadCloseButton.addEventListener('click', () => {
                onClose();
            });
        }
    }  
}

