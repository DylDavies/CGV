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

        // Now that the HTML is loaded, cache the elements inside it
        this.uiElements = {
            welcomeScreen: document.getElementById('welcome-screen'),
            playButton: document.getElementById('play-btn'),
            creditsButton: document.getElementById('credits-btn'),
            settingsButton: document.getElementById('settings-btn'),
            loadingScreen: document.getElementById('loading-screen'),
            loadingContainer: document.getElementById('loading-container'),
            loadingText: document.getElementById('loading-text'),
            puzzleContainer: document.getElementById('puzzle-container'),
            wirePuzzleContainer: document.getElementById('wire-puzzle-container'), 
            crosshair: document.getElementById('crosshair'),
            interactionPrompt: document.getElementById('interaction-prompt'),
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
            
            // Play main menu music
            if (this.audioManager) {
                this.audioManager.playMusic('public/audio/music/main_menu_audio.mp3');
            }

            this.uiElements.playButton.onclick = () => {
                if (this.audioManager) {
                    this.audioManager.stopMusic(); // Fade out the music
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