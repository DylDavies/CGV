export class PuzzleTimer {
    constructor(duration, onTick, onEnd, elementId = 'timer-value') { 
        this.duration = duration;
        this.onTick = onTick;
        this.onEnd = onEnd;
        this.timeRemaining = duration;
        this.timerInterval = null; 
        this.timerValueElement = document.getElementById(elementId); 
        this.startTime = 0;
    }

    start() {
        this.stop();
        this.timeRemaining = this.duration;
        this.startTime = performance.now();
        this.updateDisplay();

        this.timerInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = (now - this.startTime) / 1000; 
            
            // Calculate new remaining time
            this.timeRemaining = this.duration - elapsed;

            this.updateDisplay();
            this.onTick(this.timeRemaining);

            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0; 
                this.updateDisplay();  
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