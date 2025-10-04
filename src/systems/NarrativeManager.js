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
        console.log('📖 NarrativeManager Initialized');
    }

    showBlackout() {
        this.elements.blackoutScreen.classList.remove('hidden');
    }

    hideBlackout() {
        this.elements.blackoutScreen.classList.add('hidden');
    }

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

    async playIntroSequence() {
        this.showBlackout();
        await this.showNarrativeScreen('You are a journalist. You came here chasing a story… Now the story has you.', 5000);
        await this.playWakeUpEffect(8000);
        await this.showSpeechBubble('Inner Monologue', 'Ugh... my head. Where am I? What happened?\n(click to look around)', 5000);
    }
}