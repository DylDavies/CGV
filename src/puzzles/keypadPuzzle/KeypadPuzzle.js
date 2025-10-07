// src/puzzles/keypadPuzzle/KeypadPuzzle.js
import { PuzzleResult } from '../colorPuzzle/PuzzleResult.js';

export class KeypadPuzzle {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.solution = "107";
        this.currentInput = "";
        this.onSolveCallback = null;
        this.onCloseCallback = null;
        this.result = new PuzzleResult();
        this.controls = null; // To hold a reference to the player controls
        this.initialize();
    }

    initialize() {
        this.uiManager.setupKeypad(
            this.handleKeyPress.bind(this),
            this.handleClose.bind(this)
        );
    }

    // This method allows the main game to give the puzzle control over the player
    setControls(controls) {
        this.controls = controls;
    }

    show(onSolve, onClose) {
        if (this.controls) this.controls.freeze(); // Freeze player movement
        this.onSolveCallback = onSolve;
        this.onCloseCallback = onClose;
        this.currentInput = "";
        this.uiManager.updateKeypadDisplay(this.currentInput);
        this.uiManager.showKeypad();
    }

    hide() {
        if (this.controls) this.controls.unfreeze(); // Unfreeze player movement
        this.uiManager.hideKeypad(); // Hide the puzzle UI
        
        // Notify the InteractionSystem that the puzzle is closed
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    handleClose() {
        this.hide();
    }

    handleKeyPress(key) {
        if (key === "E") {
            if (this.currentInput === this.solution) {
                // On success, show the result screen.
                this.result.show(true, () => {
                    if (this.onSolveCallback) {
                        this.onSolveCallback(); // This calls the logic in InteractionSystem
                    }
                }, "SAFE OPENED");
            } else {
                // On failure, show an error message
                this.currentInput = "";
                this.uiManager.updateKeypadDisplay("ERROR");
                setTimeout(() => this.uiManager.updateKeypadDisplay(this.currentInput), 1000);
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