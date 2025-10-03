export class PuzzleResult {
    // Allow passing custom IDs for the elements
    constructor(
        overlayId = 'puzzle-result-overlay', 
        titleId = 'result-title', 
        subtitleId = 'result-subtitle'
    ) {
        this.resultOverlay = document.getElementById(overlayId);
        this.resultTitle = document.getElementById(titleId);
        this.resultSubtitle = document.getElementById(subtitleId);
    }

    show(isSuccess, onComplete) {
        if (!this.resultOverlay) return;

        if (isSuccess){
            this.resultOverlay.className = 'success';
            this.resultTitle.textContent = 'Success';
            this.resultSubtitle.textContent = 'The mechanism clicks open.';
        } 
        else{
            const failureMessages = [
                "A floorboard creaks above you.",
                "It's getting closer.",
                "The creature grows restless.",
                "You hear a faint scratching from behind the wall.",
                "A guttural growl echoes from the darkness."
            ];

            this.resultOverlay.className = 'failure';
            this.resultTitle.textContent = 'Failure';
            this.resultSubtitle.textContent = failureMessages[Math.floor(Math.random() * failureMessages.length)];
        }

        this.resultOverlay.classList.remove('hidden');

        setTimeout(() => {
            this.resultOverlay.className = 'hidden';
            if (onComplete) onComplete();
        }, 3500);
    }
}