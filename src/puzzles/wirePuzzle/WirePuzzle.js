import { WirePuzzleLogic } from './WirePuzzleLogic.js';
import { WirePuzzleUI } from './WirePuzzleUI.js'; // <-- THE MISSING IMPORT
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
        
        // This line was causing the error because WirePuzzleUI was not imported
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

    show(difficulty = 1) {
        if (this.controls) this.controls.freeze();
        this.container.style.display = 'flex';
        
        const level = this.levels.find(l => l.difficulty === difficulty);
        if (!level) {
            console.error(`No wire puzzle found for difficulty: ${difficulty}`);
            this.hide();
            return;
        }
        this.currentLevel = level;
        this.startCurrentLevel(true);
    }

    startCurrentLevel(isFirstLoad = false) {
        if (!this.currentLevel) return;

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
        if (this.onCloseCallback) this.onCloseCallback();
    }

    handlePathStart(x, y) {
        if (this.logic) {
            this.logic.startPath(x, y);
            this.ui.render(this.logic);
        }
    }

    handlePathDraw(x, y) {
        if (this.logic && this.logic.isDrawing) {
            this.logic.addPointToPath(x, y);
            this.ui.render(this.logic);
        }
    }

    handlePathEnd() {
        if (this.logic) {
            this.logic.endPath(false);
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