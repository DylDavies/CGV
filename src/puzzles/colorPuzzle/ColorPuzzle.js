import { PuzzleLogic } from './PuzzleLogic.js';
import { PuzzleUI } from './PuzzleUI.js';
import { PuzzleTimer } from './PuzzleTimer.js';
import { PuzzleResult } from './PuzzleResult.js';

export class ColorPuzzle {
    constructor() {
        this.allLevels = [];
        this.colorMap = { 0: 'blue', 1: 'yellow', 2: 'green', 3: 'red', 4: 'orange', 5: 'purple', 6: 'pink', 7: 'cyan' };
        this.controls = null;
        this.puzzleContainer = document.getElementById('puzzle-container');
        this.isAnimating = false;
        
        this.onManualCloseCallback = null; // For when the user clicks the "Close" button

        this.ui = new PuzzleUI({
            onTileClick: (row, col) => this.handleTileClick(row, col),
            onColorSelect: (color) => this.handleColorSelect(color),
            onReset: () => this.startCurrentLevel(),
            onClose: () => {
                if (this.onManualCloseCallback) this.onManualCloseCallback();
            }
        });

        this.result = new PuzzleResult();
        this.onSolveCallback = null;
        this.successMessage = 'The mechanism clicks open.';
    }
    
    setControls(controls) { this.controls = controls; }

    async loadLevels() {
        const response = await fetch('public/puzzles/colorPuzzle/levels.json');
        this.allLevels = await response.json();

        this.allLevels = this.allLevels.filter(level => !level.levelData.board.flat().includes(-1));
        //console.log(`Loaded ${this.allLevels.length} solvable color puzzle levels.`);
    }

    start(moveCount) {
        this.lastMoveCount = moveCount;
        const suitableLevels = this.allLevels.filter(level => level.levelData.turns === moveCount);
        if (suitableLevels.length === 0) {
            this.hide();
            return;
        }
        
        const randomLevel = suitableLevels[Math.floor(Math.random() * suitableLevels.length)];

        // Debug weird puzzle issues
        // console.log("🧩 New Puzzle Selected");
        // console.log(`   - Level ID: ${randomLevel.id}`);
        // console.log("   - Level Data:", randomLevel.levelData);


        this.currentLevelData = randomLevel.levelData;
        
        this.startCurrentLevel(true); 
    }
    
    startCurrentLevel(isFirstLoad = false) {
        if (!this.currentLevelData) {
            console.error("Cannot reset, no level data is currently loaded.");
            return;
        }

        this.logic = new PuzzleLogic(this.currentLevelData, this.colorMap);
        const availableColors = [...new Set(this.logic.originalLevelData.board.flat())]
            .map(index => this.logic.colorMap[index])
            .filter(Boolean);

        // --- DEBUG LOG ---
        //console.log("   - Available Colors (Palette):", availableColors);

        this.logic.selectedColor = availableColors[0];

        //console.log(`   - Initially Selected Color: ${this.logic.selectedColor}`);
        // --- END DEBUG LOG ---

        this.ui.render(this.logic);
        
        if (isFirstLoad) {
            this.startTimer();
        }
    }

    show(moveCount, onManualClose) {
        this.onManualCloseCallback = onManualClose; // Store the callback from InteractionSystem
        this.puzzleContainer.style.display = 'flex';
        this.start(moveCount);
    }

    async handleTileClick(row, col) {
        if (this.isAnimating) return;

        const animationSteps = this.logic.getAnimatedFloodFillSteps(row, col);

        if (animationSteps) {
            this.isAnimating = true;
            await this.ui.animateTileChanges(animationSteps, this.logic.selectedColor);
            
            this.logic.applyGridChanges(animationSteps);
            this.ui.updateText(this.logic);
            
            const gameState = this.logic.checkWinCondition();
            if (gameState !== 'continue') {
                if (this.timer) this.timer.stop();
                this.result.show(gameState === 'win', () => {
                    // This onComplete runs after the result overlay disappears
                    this.hide(); // First, always hide the puzzle
                    if (gameState === 'win') {
                        if (this.onSolveCallback) this.onSolveCallback();
                    } else {
                        // This handles a loss (timer running out)
                        if (this.onManualCloseCallback) this.onManualCloseCallback();
                    }
                }, 
                this.successMessage);
            }
            this.isAnimating = false;
        }
    }

    handleColorSelect(color) {
        this.logic.selectedColor = color;

        // Debug current selected color
        console.log(`Color change. New selected color: ${color}`);

        this.ui.renderPalette(this.logic);
    }
    
    hide() {
        if (this.timer) {
            this.timer.stop();
        }
        if (this.controls) this.controls.unfreeze();
        this.puzzleContainer.style.display = 'none';
        if (this.onCloseCallback) this.onCloseCallback();
    }

    startTimer() {
        if (this.timer) this.timer.stop();
        this.timer = new PuzzleTimer(60, 
            (time) => {},
            () => { // onEnd callback for the timer
                this.result.show(false, () => {
                    this.hide();
                    if (this.onManualCloseCallback) this.onManualCloseCallback();
                });
            }
        );
        this.timer.start();
    }

    onSolve(callback, successMessage) { 
        this.onSolveCallback = callback;
        if (successMessage) {
            this.successMessage = successMessage;
        }
     }
    onClose(callback) { this.onManualCloseCallback = callback; }
}