export class PuzzleTimer {
    constructor(duration, onTick, onEnd, elementId = 'timer-value') { // Default to old ID
        this.duration = duration;
        this.onTick = onTick;
        this.onEnd = onEnd;
        this.timeRemaining = duration;
        this.timerInterval = null; 
        this.timerValueElement = document.getElementById(elementId); // Use the provided ID
    }

    start() {
        this.stop();
        this.timeRemaining = this.duration;
        this.updateDisplay();

        this.timerInterval = setInterval(() => {
            this.timeRemaining -= 0.01;
            this.updateDisplay();
            this.onTick(this.timeRemaining);

            if (this.timeRemaining <= 0) {
                this.stop();
                this.onEnd();
            }
        }, 10);
    }

    stop() {
        clearInterval(this.timerInterval);
    }

    updateDisplay() {
        if (this.timerValueElement) {
            this.timerValueElement.textContent = Math.max(0, this.timeRemaining).toFixed(2);
        }
    }
}