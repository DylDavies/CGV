// src/systems/NarrativeManager.js

export class NarrativeManager {
    constructor(stageManager = null) {
        this.elements = {
            speechBubble: document.getElementById('speech-bubble'),
            speechTitle: document.getElementById('speech-title'),
            speechText: document.getElementById('speech-text'),
            wakeUpOverlay: document.getElementById('wake-up-overlay'),
            narrativeScreen: document.getElementById('narrative-screen'),
            narrativeText: document.getElementById('narrative-text'),
            blackoutScreen: document.getElementById('blackout-screen'),
        };
        this.narrativeData = null;
        this.stageManager = stageManager;
        console.log('📖 NarrativeManager Initialized');
    }

    async loadNarrative(path) {
        try {
            const response = await fetch(path);
            this.narrativeData = await response.json();
            console.log('✅ Narrative data loaded successfully.');
        } catch (error) {
            console.error('❌ Failed to load narrative data:', error);
        }
    }

    async triggerEvent(eventId) {
        if (!this.narrativeData) return;

        const keys = eventId.split('.');
        let eventData = this.narrativeData;
        for (const key of keys) {
            eventData = eventData[key];
            if (!eventData) {
                console.error(`Narrative event not found: ${eventId}`);
                return;
            }
        }

        switch (eventData.type) {
            case 'blackScreen':
                return this.showNarrativeScreen(eventData.text, eventData.duration);
            case 'deathScreen':
                return this.showDeathScreen(eventData.text, eventData.duration);
            case 'speechBubble':
                return this.showSpeechBubble(eventData.title, eventData.text, eventData.duration);
            case 'wakeUp':
                return this.playWakeUpEffect(eventData.duration);
            case 'stageTransition':
                return this.transitionToStage(eventData.stage, eventData.fadeOutDuration, eventData.fadeInDuration);
            case 'objective':
                // Directly call the UIManager to display the objective
                if (window.gameControls && window.gameControls.uiManager) {
                    console.log('📜 NarrativeManager: Directly telling UIManager to display objective ->', eventData.id);
                    window.gameControls.uiManager.displayObjective(eventData);
                } else {
                    console.error('UIManager not available to display objective.');
                }
                break;
            case 'warning':
                 console.log('Triggering warning:', eventData.text);
                break;
        }
    }

    /**
     * Transition to a new stage
     * @param {string} stageName - Name of the stage to transition to
     * @param {number} fadeOutDuration - Duration of fade out in ms
     * @param {number} fadeInDuration - Duration of fade in in ms
     */
    async transitionToStage(stageName, fadeOutDuration = 1000, fadeInDuration = 1000) {
        console.log("transitioning to stage")
        if (!this.stageManager) {
            console.error('❌ StageManager not available for narrative stage transition');
            return;
        }

        console.log(`🎬 Narrative triggering stage transition to: ${stageName}`);

        // show blackscreen between transitions
        this.showBlackout();
        await new Promise(resolve => setTimeout(resolve, 50)); // wait to ensure mansion is rendered

        try {
            await this.stageManager.switchToStage(stageName, {
                fadeOutDuration,
                fadeInDuration,
                onProgress: (progress, message) => {
                    if (window.gameControls && window.gameControls.uiManager) {
                        window.gameControls.uiManager.updateLoadingProgress(progress, message);
                    }
                }
            });

            window.gameControls.carRepairSystem.initialize();

            // Reload result screen after stage transition to ensure it persists
            if (window.gameControls && window.gameControls.uiManager) {
                await window.gameControls.uiManager.reloadResultScreen();
            }

            console.log(`✅ Stage transition to "${stageName}" complete`);

            // Initialize stage-specific gameplay when entering mansion
            if (stageName === 'mansion') {
                console.log('🏚️ Initializing mansion stage...');

                // Reinitialize minimap for the new stage
                if (window.gameControls && window.gameControls.minimap) {
                    window.gameControls.minimap.reinitialize();
                }

                // Brief pause for player to get oriented
                await new Promise(resolve => setTimeout(resolve, 1000));


                // Schedule phone ring after 30 seconds (like initial game start)
                if (window.gameControls && window.gameControls.gameManager) {
                    setTimeout(async () => {
                        // Show stage 1 title
                        console.log("showing")

                        await this.playIntroSequence();

                        setTimeout(() => {
                            window.gameControls.gameManager.startPhoneRingEvent();
                        }, 1000);
                    }, 1000);
                }
            }

        } catch (error) {
            console.error(`❌ Failed to transition to stage "${stageName}":`, error);
        }
    }
    
    async playIntroSequence() {

        await this.triggerEvent('intro.stage_1_title');
        await this.triggerEvent('intro.black_screen_1');
        
 
        this.elements.wakeUpOverlay.style.display = 'block';
        this.hideBlackout(); 
        
        await this.triggerEvent('intro.wake_up'); 
        await this.triggerEvent('intro.speech_bubble_1');
    }

    // (The rest of the file remains the same)
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

    showDeathScreen(text, duration = -1) {
        return new Promise(resolve => {
            // Use narrative screen for death screen - same black/white style as other screens
            this.elements.narrativeText.innerHTML = text.replace(/\n/g, '<br>');
            this.elements.narrativeScreen.classList.remove('hidden');
            // No special styling - uses default black/white from CSS

            // Duration -1 means stay forever (until restart)
            if (duration > 0) {
                setTimeout(() => {
                    this.elements.narrativeScreen.classList.add('hidden');
                    setTimeout(resolve, 1000);
                }, duration);
            }
            // If duration is -1, never resolve (stays until page reload)
        });
    }

    playWakeUpEffect(duration = 8000) {
        this.hideBlackout();
        return new Promise(resolve => {
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