export class UIManager {
    constructor() {
        this.uiElements = {};
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Load the HTML content into the containers
        await this._loadHTML('src/ui/welcomeScreen/welcome-screen.html', 'welcome-screen-container');
        await this._loadHTML('src/ui/colorPuzzle/color-puzzle.html', 'puzzle-container');
        await this._loadHTML('src/ui/creditsScreen/credits-screen.html', 'credits-screen-container');
        await this._loadHTML('src/ui/settingsScreen/settings-screen.html', 'settings-screen-container');


        // Now that the HTML is loaded, cache the elements inside it
        this.uiElements = {
            welcomeScreen: document.getElementById('welcome-screen'),
            playButton: document.getElementById('play-btn'),
            creditsButton: document.getElementById('credits-btn'),
            settingsButton: document.getElementById('settings-btn'),
            loadingContainer: document.getElementById('loading-container'),
            loadingText: document.getElementById('loading-text'),
            puzzleContainer: document.getElementById('puzzle-container'),
            crosshair: document.getElementById('crosshair'), 
            interactionPrompt: document.getElementById('interaction-prompt'),
            gameStatsContainer: document.getElementById('game-stats-container'),
            objectivesContainer: document.getElementById('objectives-container'),
            inventoryContainer: document.getElementById('inventory-container'),
            creditsScreen: document.getElementById('credits-screen'),
            closeCreditsButton: document.getElementById('close-credits-btn'),
            settingsScreen: document.getElementById('settings-screen'),
            closeSettingsButton: document.getElementById('close-settings-btn'),
        };
        
        if (!this.uiElements.welcomeScreen || !this.uiElements.playButton) {
            console.error("UIManager Critical Error: Welcome screen elements (#welcome-screen or #play-btn) not found after loading. Check file paths and the HTML content.");
            return; // Stop execution to prevent further errors
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

    // --- Loading and Welcome Screen Methods ---
    showWelcomeScreen(onPlayCallback) {
        // This check prevents the error if initialization failed
        if (this.uiElements.welcomeScreen && this.uiElements.playButton) {
            this.uiElements.welcomeScreen.style.display = 'flex';
            this.uiElements.playButton.onclick = () => {
                this.uiElements.welcomeScreen.style.display = 'none';
                this.showLoadingScreen("Initializing...");
                onPlayCallback();
            };
        } else {
            console.error("Cannot show welcome screen because UI elements are missing.");
        }
    }

    showLoadingScreen(text) {
        if (this.uiElements.loadingContainer) {
            this.uiElements.loadingContainer.style.display = 'flex';
            this.updateLoadingText(text);
        }
    }
    
    hideLoadingScreen() {
        if (this.uiElements.loadingContainer) {
            this.uiElements.loadingContainer.style.display = 'none';
        }
    }

    updateLoadingText(text) {
        if (this.uiElements.loadingText) {
            this.uiElements.loadingText.textContent = text;
        }
    }


    updateObjectives(objectives) {
        if (this.uiElements.objectivesContainer) {
            this.uiElements.objectivesContainer.innerHTML = `<h3>Objectives</h3><p>${objectives.length} active</p>`;
        }
    }
    
    updateInventory(inventory) {
        if (this.uiElements.inventoryContainer) {
            this.uiElements.inventoryContainer.innerHTML = `<h3>Inventory</h3><p>${inventory.length} items</p>`;
        }
    }

    showInteractionPrompt(text) {
        if (this.uiElements.interactionPrompt) {
            this.uiElements.interactionPrompt.textContent = text;
            this.uiElements.interactionPrompt.style.display = 'block';
        }
    }

    hideInteractionPrompt() {
        if (this.uiElements.interactionPrompt) {
            this.uiElements.interactionPrompt.style.display = 'none';
        }
    }
    
    showPuzzle() {
        if (this.uiElements.puzzleContainer) {
            this.uiElements.puzzleContainer.style.display = 'flex';
        }
    }

    hidePuzzle() {
        if (this.uiElements.puzzleContainer) {
            this.uiElements.puzzleContainer.style.display = 'none';
        }
    }
}