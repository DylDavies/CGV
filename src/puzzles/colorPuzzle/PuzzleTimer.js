export class PuzzleTimer {
    constructor(duration, onTick, onEnd) {
        this.duration = duration;
        this.onTick = onTick;
        this.onEnd = onEnd;
        this.timeRemaining = duration;
        this.timerInterval = null; 
        this.timerValueElement = document.getElementById('timer-value');
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