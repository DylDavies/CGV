// src/puzzles/colorPuzzle/PuzzleResult.js

export class PuzzleResult {
    constructor(
        overlayId = 'puzzle-result-overlay',
        titleId = 'result-title',
        subtitleId = 'result-subtitle'
    ) {
        this.resultOverlay = document.getElementById(overlayId);
        this.resultTitle = document.getElementById(titleId);
        this.resultSubtitle = document.getElementById(subtitleId);
    }

    // src/puzzles/colorPuzzle/PuzzleResult.js

    show(isSuccess, onComplete, successMessage = 'The mechanism clicks open.') {
        if (!this.resultOverlay) return;

        // Set the title and message
        this.resultTitle.textContent = isSuccess ? 'Success' : 'Failure';

        if (isSuccess){
            this.resultSubtitle.textContent = successMessage;
            // Use classList to properly add/remove classes
            this.resultOverlay.classList.remove('hidden');
            this.resultOverlay.classList.add('success');
            this.resultOverlay.classList.remove('failure');
        }
        else{
            const failureMessages = [
                "A floorboard creaks above you.",
                "It's getting closer.",
                "The creature grows restless.",
                "You hear a faint scratching from behind the wall.",
                "A guttural growl echoes from the darkness."
            ];

            this.resultSubtitle.textContent = failureMessages[Math.floor(Math.random() * failureMessages.length)];
            // Use classList to properly add/remove classes
            this.resultOverlay.classList.remove('hidden');
            this.resultOverlay.classList.add('failure');
            this.resultOverlay.classList.remove('success');
        }

        // Show result for 1.5 seconds, then hide and allow player to regain control
        setTimeout(() => {
            this.resultOverlay.classList.add('hidden');
            this.resultOverlay.classList.remove('success');
            this.resultOverlay.classList.remove('failure');
            if (onComplete) onComplete();
        }, 1500);
    }
}