// src/systems/uiManager.js

export class UIManager {
    constructor(audioManager) { 
        this.uiElements = {};
        this.isInitialized = false;
        this.audioManager = audioManager; 
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
        };
        
        if (!this.uiElements.welcomeScreen || !this.uiElements.playButton) {
            console.error("UIManager Critical Error: Welcome screen elements not found after loading.");
            return;
        }
        
        this._addMenuEventListeners();
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
    }

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
}