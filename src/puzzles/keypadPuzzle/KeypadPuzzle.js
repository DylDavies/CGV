// src/puzzles/keypadPuzzle/KeypadPuzzle.js

export class KeypadPuzzle {
    constructor(uiManager, onSolve) {
        this.uiManager = uiManager;
        this.onSolve = onSolve;
        this.solution = "107";
        this.currentInput = "";
        this.initialize();
    }

    initialize() {
        this.uiManager.setupKeypad(this.handleKeyPress.bind(this));
    }

    handleKeyPress(key) {
        if (key === "E") {
            if (this.currentInput === this.solution) {
                this.uiManager.hideKeypad();
                this.onSolve();
            } else {
                this.currentInput = "";
                this.uiManager.updateKeypadDisplay(this.currentInput);
            }
        } else if (key === "C") {
            this.currentInput = "";
            this.uiManager.updateKeypadDisplay(this.currentInput);
        } else {
            if (this.currentInput.length < 3) {
                this.currentInput += key;
                this.uiManager.updateKeypadDisplay(this.currentInput);
            }
        }
    }
}