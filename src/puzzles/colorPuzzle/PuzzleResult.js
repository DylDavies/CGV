// src/puzzles/colorPuzzle/PuzzleResult.js

export class PuzzleResult {
    constructor(
        overlayId = 'puzzle-result-overlay',
        titleId = 'result-title',
        subtitleId = 'result-subtitle'
    ) {
        this.overlayId = overlayId;
        this.titleId = titleId;
        this.subtitleId = subtitleId;
    }

    // src/puzzles/colorPuzzle/PuzzleResult.js

    show(isSuccess, onComplete, successMessage = 'The mechanism clicks open.') {
        // Look up elements fresh each time (they may have been reloaded during stage transitions)
        const resultOverlay = document.getElementById(this.overlayId);
        const resultTitle = document.getElementById(this.titleId);
        const resultSubtitle = document.getElementById(this.subtitleId);

        if (!resultOverlay) {
            console.error(`Result overlay element not found with ID: ${this.overlayId}`);
            return;
        }
        if (!resultTitle) {
            console.error(`Result title element not found with ID: ${this.titleId}`);
            return;
        }
        if (!resultSubtitle) {
            console.error(`Result subtitle element not found with ID: ${this.subtitleId}`);
            return;
        }

        console.log(`Showing puzzle result: ${isSuccess ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`   Overlay element: ${resultOverlay ? 'FOUND' : 'NOT FOUND'}`);
        console.log(`   Title element: ${resultTitle ? 'FOUND' : 'NOT FOUND'}`);
        console.log(`   Subtitle element: ${resultSubtitle ? 'FOUND' : 'NOT FOUND'}`);

        // Set the title and message
        resultTitle.textContent = isSuccess ? 'Success' : 'Failure';

        if (isSuccess){
            resultSubtitle.textContent = successMessage;
            // Use classList to properly add/remove classes
            resultOverlay.classList.remove('hidden');
            resultOverlay.classList.add('success');
            resultOverlay.classList.remove('failure');
            console.log('Added success styling');
        }
        else{
            const failureMessages = [
                "A floorboard creaks above you.",
                "It's getting closer.",
                "The creature grows restless.",
                "You hear a faint scratching from behind the wall.",
                "A guttural growl echoes from the darkness."
            ];

            resultSubtitle.textContent = failureMessages[Math.floor(Math.random() * failureMessages.length)];
            // Use classList to properly add/remove classes
            resultOverlay.classList.remove('hidden');
            resultOverlay.classList.add('failure');
            resultOverlay.classList.remove('success');
            console.log('Added failure styling');
        }

        // Show result for 3.5 seconds, then hide and allow player to regain control
        setTimeout(() => {
            resultOverlay.classList.add('hidden');
            resultOverlay.classList.remove('success');
            resultOverlay.classList.remove('failure');
            console.log('Result overlay hidden');
            if (onComplete) onComplete();
        }, 3500);
    }
}