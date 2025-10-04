// src/systems/NarrativeManager.js

export class NarrativeManager {
    constructor() {
        this.elements = {
            speechBubble: document.getElementById('speech-bubble'),
            speechTitle: document.getElementById('speech-title'),
            speechText: document.getElementById('speech-text'),
            wakeUpOverlay: document.getElementById('wake-up-overlay'),
            narrativeScreen: document.getElementById('narrative-screen'),
            narrativeText: document.getElementById('narrative-text'),
            blackoutScreen: document.getElementById('blackout-screen'),
        };
        // This will hold all our story data from the JSON file
        this.narrativeData = null; 
        console.log('📖 NarrativeManager Initialized');
    }

    /**
     * Loads the narrative data from a JSON file.
     */
    async loadNarrative(path) {
        try {
            const response = await fetch(path);
            this.narrativeData = await response.json();
            console.log('✅ Narrative data loaded successfully.');
        } catch (error) {
            console.error('❌ Failed to load narrative data:', error);
        }
    }

    /**
     * A generic function to trigger any narrative event by its ID from the JSON file.
     */
    async triggerEvent(eventId) {
        if (!this.narrativeData) return;

        // Find the event data by splitting the ID (e.g., "intro.black_screen_1")
        const keys = eventId.split('.');
        let eventData = this.narrativeData;
        for (const key of keys) {
            eventData = eventData[key];
            if (!eventData) {
                console.error(`Narrative event not found: ${eventId}`);
                return;
            }
        }

        // Call the correct function based on the event's "type"
        switch (eventData.type) {
            case 'blackScreen':
                return this.showNarrativeScreen(eventData.text, eventData.duration);
            case 'speechBubble':
                return this.showSpeechBubble(eventData.title, eventData.text, eventData.duration);
            case 'wakeUp':
                return this.playWakeUpEffect(eventData.duration);
            
            // You can add more types here later (e.g., for objectives, warnings)
            case 'objective':
                // Example: window.gameControls.gameManager.addObjective(eventData);
                console.log('Triggering objective:', eventData.description);
                break;
            case 'warning':
                // Example: window.gameControls.uiManager.showWarning(eventData.text);
                 console.log('Triggering warning:', eventData.text);
                break;
        }
    }
    
    /**
     * The intro sequence now just calls events from the JSON data.
     */
    async playIntroSequence() {
        this.showBlackout();
        await this.triggerEvent('intro.black_screen_1');
        await this.triggerEvent('intro.wake_up');
        await this.triggerEvent('intro.speech_bubble_1');
    }

    // --- (Keep all your other methods like showBlackout, showNarrativeScreen, etc.) ---

    showBlackout() { this.elements.blackoutScreen.classList.remove('hidden'); }
    hideBlackout() { this.elements.blackoutScreen.classList.add('hidden'); }

    showNarrativeScreen(text, duration = 4000) {
        return new Promise(resolve => {
            this.elements.narrativeText.textContent = text;
            this.elements.narrativeScreen.classList.remove('hidden');
            setTimeout(() => {
                this.elements.narrativeScreen.classList.add('hidden');
                setTimeout(resolve, 1000);
            }, duration);
        });
    }

    playWakeUpEffect(duration = 8000) {
        return new Promise(resolve => {
            this.hideBlackout();
            this.elements.wakeUpOverlay.style.display = 'block';
            setTimeout(() => {
                this.elements.wakeUpOverlay.style.display = 'none';
                resolve();
            }, duration);
        });
    }

    showSpeechBubble(title, text, duration = 5000) {
        return new Promise(resolve => {
            if (!this.elements.speechBubble) return resolve();
            this.elements.speechTitle.textContent = title;
            this.elements.speechText.textContent = text;
            this.elements.speechBubble.classList.remove('hidden');
            setTimeout(() => {
                this.elements.speechBubble.classList.add('hidden');
                setTimeout(resolve, 500);
            }, duration);
        });
    }
}