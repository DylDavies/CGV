import { WirePuzzleLogic } from './WirePuzzleLogic.js';
import { WirePuzzleUI } from './WirePuzzleUI.js';
import { PuzzleTimer } from '../colorPuzzle/PuzzleTimer.js';
import { PuzzleResult } from '../colorPuzzle/PuzzleResult.js';

export class WirePuzzle {
    constructor() {
        this.levels = [];
        this.logic = null;
        this.controls = null;
        this.onSolveCallback = null;
        this.onCloseCallback = null;

        this.container = document.getElementById('wire-puzzle-container');
        
        this.ui = new WirePuzzleUI(document.getElementById('wire-puzzle-canvas'), {
            onPathStart: (x, y) => this.handlePathStart(x, y),
            onPathDraw: (x, y) => this.handlePathDraw(x, y),
            onPathEnd: () => this.handlePathEnd()
        });
        
        this.result = new PuzzleResult(
            'wire-puzzle-result-overlay',
            'wire-result-title',
            'wire-result-subtitle'
        );

        document.getElementById('wire-reset-puzzle-btn').addEventListener('click', () => this.startCurrentLevel());
        document.getElementById('wire-close-puzzle-btn').addEventListener('click', () => this.hide());
    }

    async loadLevels() {
        try {
            const response = await fetch('/public/puzzles/wirePuzzle/levels.json');
            this.levels = await response.json();
        } catch (error) {
            console.error('Failed to load wire puzzle levels:', error);
        }
    }

    setControls(controls) {
        this.controls = controls;
    }

    show() { // Can add a difficulty parameter here then we can choose th levels we want to take
        if (this.controls) this.controls.freeze();
        this.container.style.display = 'flex';
        
        // check we were able to load levels
        if (!this.levels || this.levels.length === 0) {
            console.error(`No wire puzzle levels are loaded.`);
            this.hide();
            return;
        }

        // random level selection
        const randomIndex = Math.floor(Math.random() * this.levels.length);
        const level = this.levels[randomIndex];
        
        this.currentLevel = level;
        this.startCurrentLevel(true);
    }

    startCurrentLevel(isFirstLoad = false) {
        if (!this.currentLevel) return;

        //console.log(this.currentLevel);
        this.logic = new WirePuzzleLogic(this.currentLevel.levelData);
        this.ui.render(this.logic);
        
        if (isFirstLoad) {
            this.startTimer(this.currentLevel.timeLimit || 60);
        }
    }

    hide() {
        if (this.timer) this.timer.stop();
        if (this.controls) this.controls.unfreeze();
        this.container.style.display = 'none';
        // Call close callback after hiding to avoid re-triggering
        setTimeout(() => {
            if (this.onCloseCallback) this.onCloseCallback();
        }, 0);
    }

    handlePathStart(x, y) {
        if (this.logic) {
            this.logic.startPath(x, y);
            this.ui.render(this.logic);
        }
    }

    handlePathDraw(x, y) {
        if (this.logic && this.logic.isDrawing) {
            this.logic.updatePath(x, y);
            this.ui.render(this.logic);
        }
    }

    handlePathEnd() {
        if (this.logic) {
            this.logic.endPath();
            this.ui.render(this.logic); // Re-render to show the final state
            if (this.logic.checkWinCondition()) {
                if (this.timer) this.timer.stop();
                console.log('Wire puzzle solved!');
                this.result.show(true, () => {
                    if (this.onSolveCallback) this.onSolveCallback();
                    this.hide();
                });
            }
        }
    }

    startTimer(duration) {
        if (this.timer) this.timer.stop();
        this.timer = new PuzzleTimer(
            duration, 
            () => {},
            () => {
                this.result.show(false, () => this.hide());
            },
            'wire-timer-value'
        );
        this.timer.start();
    }

    onSolve(callback) { this.onSolveCallback = callback; }
    onClose(callback) { this.onCloseCallback = callback; }
}