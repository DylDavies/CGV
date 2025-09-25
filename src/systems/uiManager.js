export class UIManager {
    constructor() {
        this.uiElements = {};
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Load the HTML content into the containers
        await this._loadHTML('src//ui/welcome-screen.html', 'welcome-screen-container');
        await this._loadHTML('src/ui/puzzle-ui.html', 'puzzle-container');

        // Now that the HTML is loaded, cache the elements inside it
        this.uiElements = {
            welcomeScreen: document.getElementById('welcome-screen'),
            playButton: document.getElementById('play-btn'),
            loadingContainer: document.getElementById('loading-container'),
            loadingText: document.getElementById('loading-text'),
            puzzleContainer: document.getElementById('puzzle-container'),
            crosshair: document.getElementById('crosshair'), 
            interactionPrompt: document.getElementById('interaction-prompt'),
            gameStatsContainer: document.getElementById('game-stats-container'),
            objectivesContainer: document.getElementById('objectives-container'),
            inventoryContainer: document.getElementById('inventory-container'),
        };
        
        // --- FIX: Add validation to ensure elements were found ---
        if (!this.uiElements.welcomeScreen || !this.uiElements.playButton) {
            console.error("UIManager Critical Error: Welcome screen elements (#welcome-screen or #play-btn) not found after loading. Check file paths and the HTML content.");
            return; // Stop execution to prevent further errors
        }
        
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
        // This would have caused the next error. We check for it now.
        if (this.uiElements.loadingText) {
            this.uiElements.loadingText.textContent = text;
        }
    }

    // --- Other methods remain the same ---

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